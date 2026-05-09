import { NextResponse } from 'next/server';
import { db, resolveRoomId } from '@/lib/db';
import { sendDemoSummaryNotifications } from '@/lib/demo-summary';

/**
 * POST /api/v1/room/[room_id]/feedback
 *
 * Submit student feedback for a class session.
 * Called by the FeedbackDialog when student leaves.
 *
 * Body: { student_email, student_name, rating (1-5), feedback_text?, tags? }
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ room_id: string }> },
) {
  try {
    const { room_id } = await params;
    const actualRoomId = await resolveRoomId(room_id);
    const body = await req.json();
    const { student_email, student_name, rating, feedback_text, tags, attendance_confirmed, interest } = body;

    if (!student_email || !rating || rating < 1 || rating > 5) {
      return NextResponse.json({ error: 'Missing student_email and valid rating (1-5)' }, { status: 400 });
    }

    await db.query(
      `INSERT INTO student_feedback
         (room_id, student_email, student_name, rating, feedback_text, tags, attendance_confirmed)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (room_id, student_email) DO UPDATE SET
         rating = EXCLUDED.rating,
         feedback_text = EXCLUDED.feedback_text,
         tags = EXCLUDED.tags,
         attendance_confirmed = EXCLUDED.attendance_confirmed,
         created_at = NOW()`,
      [actualRoomId, student_email, student_name || '', rating, feedback_text || '', tags || '', attendance_confirmed ?? false],
    );

    // Bridge feedback into session_ratings (used by HR performance views)
    try {
      const roomInfo = await db.query(
        `SELECT r.teacher_email, r.batch_session_id, r.batch_id
         FROM rooms r WHERE r.room_id = $1`,
        [actualRoomId],
      );
      const ri = roomInfo.rows[0] as Record<string, string | null> | undefined;
      if (ri?.teacher_email) {
        await db.query(
          `INSERT INTO session_ratings
             (session_id, student_email, teacher_email, batch_id,
              punctuality, teaching_quality, communication, overall,
              comment, is_anonymous)
           VALUES ($1, $2, $3, $4, $5, $5, $5, $5, $6, false)
           ON CONFLICT (session_id, student_email) DO UPDATE
             SET overall = EXCLUDED.overall,
                 punctuality = EXCLUDED.punctuality,
                 teaching_quality = EXCLUDED.teaching_quality,
                 communication = EXCLUDED.communication,
                 comment = EXCLUDED.comment`,
          [
            ri.batch_session_id || actualRoomId,
            student_email,
            ri.teacher_email,
            ri.batch_id || null,
            rating,
            feedback_text || '',
          ],
        );
      }
    } catch (e) {
      console.warn('[feedback] Bridge to session_ratings warning:', e);
    }

    // For demo rooms: fire demo summary notifications
    if (actualRoomId.startsWith('demo_')) {
      sendDemoSummaryNotifications(actualRoomId, 3000).catch(e =>
        console.error('[feedback] Demo summary notification error:', e)
      );

      // Update student interest + notify CRM if applicable
      if (typeof interest === 'boolean') {
        try {
          await db.query(
            `UPDATE demo_requests SET student_interest = $1, updated_at = NOW()
             WHERE room_id = $2`,
            [interest, actualRoomId],
          );
          const dr = await db.query(
            `SELECT id, crm_lead_id, crm_tenant_id FROM demo_requests WHERE room_id = $1 LIMIT 1`,
            [actualRoomId],
          );
          const row = dr.rows[0] as Record<string, unknown> | undefined;
          if (row?.crm_lead_id && row?.crm_tenant_id) {
            const { notifyCRM } = await import('@/lib/crm-webhook');
            await notifyCRM({
              event: 'demo_interest',
              crm_lead_id: row.crm_lead_id as string,
              crm_tenant_id: row.crm_tenant_id as string,
              demo_request_id: row.id as string,
              interested: interest,
            });
          }
        } catch (crmErr) {
          console.warn('[feedback] CRM interest webhook error:', crmErr);
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[feedback] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * GET /api/v1/room/[room_id]/feedback
 *
 * Get all feedback for a room session.
 * Accessible to teacher, coordinator, academic_operator, owner, ghost, hr.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ room_id: string }> },
) {
  try {
    const { room_id } = await params;
    const actualRoomId = await resolveRoomId(room_id);

    const result = await db.query(
      `SELECT student_email, student_name, rating, feedback_text, tags, attendance_confirmed, created_at
       FROM student_feedback
       WHERE room_id = $1
       ORDER BY created_at DESC`,
      [actualRoomId],
    );

    // Compute summary
    const feedbacks = result.rows;
    const totalRating = feedbacks.reduce((sum, f) => sum + Number((f as Record<string, unknown>).rating ?? 0), 0);
    const avgRating = feedbacks.length > 0 ? totalRating / feedbacks.length : 0;

    return NextResponse.json({
      feedback: feedbacks,
      summary: {
        total_responses: feedbacks.length,
        average_rating: Math.round(avgRating * 10) / 10,
      },
    });
  } catch (err) {
    console.error('[feedback] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
