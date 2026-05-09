// ═══════════════════════════════════════════════════════════════
// Admission Workflow API
// Structured: enquiry → registered → fee_confirmed → allocated → active
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse } from '@/types';
import { verifySession, COOKIE_NAME } from '@/lib/session';
import { db } from '@/lib/db';

// ── GET — List admission requests ────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get(COOKIE_NAME)?.value;
    if (!token) return NextResponse.json<ApiResponse>({ success: false, error: 'Auth required' }, { status: 401 });
    const user = await verifySession(token);
    if (!user) return NextResponse.json<ApiResponse>({ success: false, error: 'Session expired' }, { status: 401 });

    const allowed = ['owner', 'batch_coordinator', 'academic_operator', 'hr'];
    if (!allowed.includes(user.role)) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Insufficient permissions' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const grade = searchParams.get('grade');

    let query = 'SELECT * FROM admission_requests';
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (status) { params.push(status); conditions.push(`status = $${params.length}`); }
    if (grade) { params.push(grade); conditions.push(`grade = $${params.length}`); }

    if (conditions.length > 0) query += ' WHERE ' + conditions.join(' AND ');
    query += ' ORDER BY created_at DESC LIMIT 200';

    const result = await db.query(query, params);

    return NextResponse.json<ApiResponse>({
      success: true,
      data: { admissions: result.rows },
    });
  } catch (err) {
    console.error('[admissions] GET error:', err);
    return NextResponse.json<ApiResponse>({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// ── POST — Create or advance admission ────────────────────────

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get(COOKIE_NAME)?.value;
    if (!token) return NextResponse.json<ApiResponse>({ success: false, error: 'Auth required' }, { status: 401 });
    const user = await verifySession(token);
    if (!user) return NextResponse.json<ApiResponse>({ success: false, error: 'Session expired' }, { status: 401 });

    const allowed = ['owner', 'batch_coordinator', 'academic_operator', 'hr'];
    if (!allowed.includes(user.role)) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const { action } = body as { action: string };

    // ── Create new admission enquiry ────────────────────────
    if (action === 'create') {
      const { studentName, studentEmail, parentName, parentEmail, parentPhone, grade, subjects, board, batchTypePref, notes } = body;

      if (!studentName || !studentEmail || !grade) {
        return NextResponse.json<ApiResponse>({ success: false, error: 'studentName, studentEmail, grade required' }, { status: 400 });
      }

      const result = await db.query(
        `INSERT INTO admission_requests
           (student_name, student_email, parent_name, parent_email, parent_phone, grade, subjects, board, batch_type_pref, notes, processed_by, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'enquiry')
         RETURNING *`,
        [studentName, studentEmail, parentName || null, parentEmail || null, parentPhone || null,
         grade, subjects || [], board || null, batchTypePref || 'one_to_many', notes || null, user.id]
      );

      return NextResponse.json<ApiResponse>({ success: true, data: { admission: result.rows[0] } }, { status: 201 });
    }

    // ── Advance admission status ────────────────────────────
    if (action === 'advance') {
      const { admissionId, newStatus, feeStructureId, allocatedBatchId, notes } = body;

      if (!admissionId || !newStatus) {
        return NextResponse.json<ApiResponse>({ success: false, error: 'admissionId and newStatus required' }, { status: 400 });
      }

      const validTransitions: Record<string, string[]> = {
        'enquiry': ['registered', 'rejected'],
        'registered': ['fee_confirmed', 'rejected'],
        'fee_confirmed': ['allocated', 'rejected'],
        'allocated': ['active', 'rejected'],
      };

      // Get current status
      const current = await db.query('SELECT status FROM admission_requests WHERE id = $1', [admissionId]);
      if (current.rows.length === 0) {
        return NextResponse.json<ApiResponse>({ success: false, error: 'Admission not found' }, { status: 404 });
      }
      const currentStatus = current.rows[0].status as string;

      if (!validTransitions[currentStatus]?.includes(newStatus)) {
        return NextResponse.json<ApiResponse>({ success: false, error: `Cannot transition from ${currentStatus} to ${newStatus}` }, { status: 400 });
      }

      const updates: string[] = ['status = $1', 'processed_by = $2', 'updated_at = NOW()'];
      const params: unknown[] = [newStatus, user.id];
      let paramIdx = 3;

      if (feeStructureId) { updates.push(`fee_structure_id = $${paramIdx}`); params.push(feeStructureId); paramIdx++; }
      if (allocatedBatchId) { updates.push(`allocated_batch_id = $${paramIdx}`); params.push(allocatedBatchId); paramIdx++; }
      if (notes) { updates.push(`notes = $${paramIdx}`); params.push(notes); paramIdx++; }

      params.push(admissionId);
      const result = await db.query(
        `UPDATE admission_requests SET ${updates.join(', ')} WHERE id = $${paramIdx} RETURNING *`,
        params
      );

      // On 'active' status — auto-create portal_user and user_profile if they don't exist
      if (newStatus === 'active') {
        const admission = result.rows[0] as Record<string, unknown>;
        const email = admission.student_email as string;

        // Create portal_user if not exists
        await db.query(
          `INSERT INTO portal_users (email, full_name, portal_role, is_active)
           VALUES ($1, $2, 'student', true)
           ON CONFLICT (email) DO NOTHING`,
          [email, admission.student_name]
        );

        // Create user_profile if not exists
        await db.query(
          `INSERT INTO user_profiles (email, grade, board, parent_email, admission_date)
           VALUES ($1, $2, $3, $4, NOW())
           ON CONFLICT (email) DO NOTHING`,
          [email, admission.grade, admission.board || null, admission.parent_email || null]
        );

        // Create parent portal_user if parent_email exists
        if (admission.parent_email) {
          await db.query(
            `INSERT INTO portal_users (email, full_name, portal_role, is_active)
             VALUES ($1, $2, 'parent', true)
             ON CONFLICT (email) DO NOTHING`,
            [admission.parent_email, admission.parent_name || 'Parent']
          );
        }

        // Log event
        await db.query(
          `INSERT INTO room_events (room_id, event_type, participant_email, payload)
           VALUES ('system', 'admission_status_change', $1, $2)`,
          [user.id, JSON.stringify({ admissionId, newStatus, studentEmail: email })]
        );
      }

      return NextResponse.json<ApiResponse>({ success: true, data: { admission: result.rows[0] } });
    }

    return NextResponse.json<ApiResponse>({ success: false, error: 'Invalid action' }, { status: 400 });
  } catch (err) {
    console.error('[admissions] POST error:', err);
    return NextResponse.json<ApiResponse>({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
