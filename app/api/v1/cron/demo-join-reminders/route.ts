import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse } from '@/types';
import { db } from '@/lib/db';
import { fireWhatsApp } from '@/lib/whatsapp';

const CRON_SECRET = process.env.CRON_SECRET || '';

/**
 * GET /api/v1/cron/demo-join-reminders
 * Called every 5 minutes by server cron.
 * Auth: ?secret=CRON_SECRET query param.
 *
 * Finds demo_requests with:
 *   - status = 'accepted'
 *   - scheduled_start BETWEEN NOW()+14min AND NOW()+16min
 *   - join_links_sent = FALSE
 *
 * Sends WhatsApp join links to teacher + student.
 * Sets join_links_sent = TRUE to prevent duplicates.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get('secret');

  if (!CRON_SECRET || secret !== CRON_SECRET) {
    return NextResponse.json<ApiResponse>({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Find demos in the 14–16 min window before start
    const dueResult = await db.query(
      `SELECT
          id, student_name, student_phone, student_email, teacher_email, teacher_name,
          teacher_join_url, student_join_url, scheduled_start, duration_minutes, subject as demo_subject
       FROM demo_requests
       WHERE status = 'accepted'
         AND join_links_sent = FALSE
         AND scheduled_start BETWEEN NOW() + INTERVAL '14 minutes' AND NOW() + INTERVAL '16 minutes'`,
    );

    const demos = dueResult.rows as {
      id: string;
      student_name: string;
      student_phone: string;
      student_email: string | null;
      teacher_email: string;
      teacher_name: string | null;
      teacher_join_url: string | null;
      student_join_url: string | null;
      scheduled_start: Date;
      duration_minutes: number | null;
      demo_subject: string | null;
    }[];

    if (demos.length === 0) {
      return NextResponse.json<ApiResponse>({ success: true, data: { processed: 0 }, message: 'No demos due' });
    }

    let sent = 0;
    const errors: string[] = [];

    for (const demo of demos) {
      try {
        const timeStr = new Date(demo.scheduled_start).toLocaleString('en-IN', {
          dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata',
        });
        const subject = demo.demo_subject || 'Demo Session';
        const teacherName = demo.teacher_name || 'Teacher';

        // Mark sent first (idempotent guard before external calls)
        await db.query(`UPDATE demo_requests SET join_links_sent = TRUE WHERE id = $1`, [demo.id]);

        // Teacher join link
        if (demo.teacher_email && demo.teacher_join_url) {
          // Fetch teacher phone
          const tPhoneResult = await db.query<{ phone: string | null }>(
            `SELECT up.phone FROM user_profiles up WHERE up.email = $1`,
            [demo.teacher_email],
          );
          const tRow = tPhoneResult.rows[0];
          const tPhone = tRow?.phone;

          await fireWhatsApp(
            demo.teacher_email,
            `Demo starts in 15 min`,
            undefined,
            'stibe_alert',
            [teacherName, `Your demo with ${demo.student_name} (${subject}) starts at ${timeStr}! Join now: ${demo.teacher_join_url}`],
            tPhone || undefined,
          );
        }

        // Student join link
        if (demo.student_phone && demo.student_join_url) {
          const cleanPhone = demo.student_phone.replace(/\D/g, '');
          const normalizedPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;

          await fireWhatsApp(
            `demo_student_${demo.id}`,
            `Demo starts in 15 min`,
            undefined,
            'stibe_alert',
            [demo.student_name, `Your free demo class (${subject}) with ${teacherName} starts at ${timeStr}! Join here: ${demo.student_join_url}`],
            normalizedPhone,
          );
        }

        sent++;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        errors.push(`demo ${demo.id}: ${msg}`);
        console.error(`[cron/demo-join-reminders] Error for demo ${demo.id}:`, e);
        // Roll back join_links_sent if failed so cron retries next window
        await db.query(`UPDATE demo_requests SET join_links_sent = FALSE WHERE id = $1`, [demo.id]).catch(() => {});
      }
    }

    console.log(`[cron/demo-join-reminders] processed ${demos.length}, sent ${sent}, errors ${errors.length}`);

    return NextResponse.json<ApiResponse>({
      success: true,
      data: { processed: demos.length, sent, errors: errors.length > 0 ? errors : undefined },
      message: `Sent join links for ${sent}/${demos.length} demos`,
    });
  } catch (err) {
    console.error('[cron/demo-join-reminders] Error:', err);
    return NextResponse.json<ApiResponse>({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
