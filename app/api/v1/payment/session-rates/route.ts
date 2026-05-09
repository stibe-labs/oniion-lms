// 
// Session Fee Rates — GET/POST /api/v1/payment/session-rates
// Manage per-batch/subject hourly rates for session payment
// 

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifySession, COOKIE_NAME } from '@/lib/session';

// GET — List all active session fee rates
export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    const user = await verifySession(token);
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    // Only HR, owner, AO, coordinator can view
    const allowed = ['owner', 'hr', 'academic_operator', 'batch_coordinator'];
    if (!allowed.includes(user.role)) {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
    }

    const url = new URL(req.url);
    const batchId = url.searchParams.get('batch_id');

    let query = `
      SELECT sfr.*, b.batch_name, b.batch_type
      FROM session_fee_rates sfr
      LEFT JOIN batches b ON sfr.batch_id = b.batch_id
      WHERE sfr.is_active = true
    `;
    const params: string[] = [];

    if (batchId) {
      params.push(batchId);
      query += ` AND sfr.batch_id = $${params.length}`;
    }

    query += ` ORDER BY b.batch_name, sfr.subject`;

    const result = await db.query(query, params);

    return NextResponse.json({
      success: true,
      data: { rates: result.rows },
    });
  } catch (err) {
    console.error('[session-rates] GET error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// POST — Create or update a session fee rate
export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    const user = await verifySession(token);
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    // Only HR and owner can manage rates
    if (!['owner', 'hr'].includes(user.role)) {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
    }

    const body = await req.json();
    const { batch_id, subject, grade, per_hour_rate_paise, currency, notes, id: rateId } = body;

    if (!subject || typeof subject !== 'string' || !subject.trim()) {
      return NextResponse.json({ success: false, error: 'Subject is required' }, { status: 400 });
    }
    if (!grade || typeof grade !== 'string' || !grade.trim()) {
      return NextResponse.json({ success: false, error: 'Grade is required' }, { status: 400 });
    }
    if (!per_hour_rate_paise || per_hour_rate_paise <= 0) {
      return NextResponse.json({ success: false, error: 'per_hour_rate_paise must be > 0' }, { status: 400 });
    }

    // Update existing
    if (rateId) {
      const result = await db.query(
        `UPDATE session_fee_rates
         SET per_hour_rate_paise = $1, currency = COALESCE($2, currency),
             subject = COALESCE($3, subject), grade = COALESCE($4, grade),
             notes = COALESCE($5, notes), batch_id = COALESCE($6, batch_id)
         WHERE id = $7
         RETURNING *`,
        [per_hour_rate_paise, currency || null, subject || null, grade || null, notes || null, batch_id || null, rateId]
      );
      if (result.rows.length === 0) {
        return NextResponse.json({ success: false, error: 'Rate not found' }, { status: 404 });
      }
      return NextResponse.json({ success: true, data: result.rows[0] });
    }

    // Create new
    const result = await db.query(
      `INSERT INTO session_fee_rates (batch_id, subject, grade, per_hour_rate_paise, currency, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [batch_id || null, subject || null, grade || null, per_hour_rate_paise, currency || 'INR', notes || null, user.id]
    );

    return NextResponse.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('[session-rates] POST error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE — Remove a session fee rate
export async function DELETE(req: NextRequest) {
  try {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    const user = await verifySession(token);
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    if (!['owner', 'hr'].includes(user.role)) {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
    }

    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    if (!id) return NextResponse.json({ success: false, error: 'id is required' }, { status: 400 });

    const result = await db.query(
      `DELETE FROM session_fee_rates WHERE id = $1 RETURNING id`,
      [id]
    );
    if (result.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Rate not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[session-rates] DELETE error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
