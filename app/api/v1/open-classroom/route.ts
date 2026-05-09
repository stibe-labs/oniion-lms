import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { hash as bcryptHash } from 'bcryptjs';
import { verifySession, COOKIE_NAME } from '@/lib/session';
import { db } from '@/lib/db';
import { sendWhatsApp } from '@/lib/whatsapp';
import type { ApiResponse } from '@/types';

/**
 * GET  /api/v1/open-classroom — List open classrooms
 * POST /api/v1/open-classroom — Create a new open classroom
 */

const ALLOWED_CREATE = ['owner', 'academic_operator', 'academic'];

export async function GET(request: NextRequest) {
  try {
    const sessionToken = request.cookies.get(COOKIE_NAME)?.value;
    if (!sessionToken) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    const user = await verifySession(sessionToken);
    if (!user) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Invalid session' }, { status: 401 });
    }

    let result;
    if (user.role === 'owner') {
      // Owner sees all
      result = await db.query(
        `SELECT oc.*,
                COALESCE(pu.full_name, oc.teacher_name_manual) AS teacher_name,
                (SELECT COUNT(*) FROM open_classroom_participants p WHERE p.classroom_id = oc.id) AS participant_count,
                (SELECT COUNT(*) FROM open_classroom_participants p WHERE p.classroom_id = oc.id AND p.payment_status = 'paid') AS paid_count,
                oc.price_paise * (SELECT COUNT(*) FROM open_classroom_participants p WHERE p.classroom_id = oc.id AND p.payment_status = 'paid') AS revenue_paise
         FROM open_classrooms oc
         LEFT JOIN portal_users pu ON pu.email = oc.teacher_email
         ORDER BY oc.created_at DESC
         LIMIT 100`
      );
    } else if (user.role === 'teacher') {
      // Teacher sees classrooms assigned to them
      result = await db.query(
        `SELECT oc.*,
                COALESCE(pu.full_name, oc.teacher_name_manual) AS teacher_name,
                (SELECT COUNT(*) FROM open_classroom_participants p WHERE p.classroom_id = oc.id) AS participant_count,
                (SELECT COUNT(*) FROM open_classroom_participants p WHERE p.classroom_id = oc.id AND p.payment_status = 'paid') AS paid_count,
                oc.price_paise * (SELECT COUNT(*) FROM open_classroom_participants p WHERE p.classroom_id = oc.id AND p.payment_status = 'paid') AS revenue_paise
         FROM open_classrooms oc
         LEFT JOIN portal_users pu ON pu.email = oc.teacher_email
         WHERE oc.teacher_email = $1
         ORDER BY oc.created_at DESC
         LIMIT 100`,
        [user.id]
      );
    } else {
      // AO sees ones they created
      result = await db.query(
        `SELECT oc.*,
                COALESCE(pu.full_name, oc.teacher_name_manual) AS teacher_name,
                (SELECT COUNT(*) FROM open_classroom_participants p WHERE p.classroom_id = oc.id) AS participant_count,
                (SELECT COUNT(*) FROM open_classroom_participants p WHERE p.classroom_id = oc.id AND p.payment_status = 'paid') AS paid_count,
                oc.price_paise * (SELECT COUNT(*) FROM open_classroom_participants p WHERE p.classroom_id = oc.id AND p.payment_status = 'paid') AS revenue_paise
         FROM open_classrooms oc
         LEFT JOIN portal_users pu ON pu.email = oc.teacher_email
         WHERE oc.created_by = $1
         ORDER BY oc.created_at DESC
         LIMIT 100`,
        [user.id]
      );
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://stibelearning.online';
    const data = result.rows.map((oc: Record<string, unknown>) => ({
      ...oc,
      host_link: `${baseUrl}/open-classroom/${oc.host_token}`,
      join_link: `${baseUrl}/open-classroom/${oc.join_token}`,
    }));

    return NextResponse.json<ApiResponse>({ success: true, data });
  } catch (err) {
    console.error('[open-classroom/list]', err);
    return NextResponse.json<ApiResponse>({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const sessionToken = request.cookies.get(COOKIE_NAME)?.value;
    if (!sessionToken) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    const user = await verifySession(sessionToken);
    if (!user || !ALLOWED_CREATE.includes(user.role)) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    const body = await request.json();
    const subject = (body.subject as string || '').trim();
    const grade = (body.grade as string || '').trim() || null;
    const description = (body.description as string || '').trim() || null;
    const teacherEmail = (body.teacher_email as string || '').trim().toLowerCase();
    const manualTeacherName = (body.teacher_name as string || '').trim();
    const manualTeacherWhatsapp = (body.teacher_whatsapp as string || '').trim();

    if (!subject) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Subject is required' }, { status: 400 });
    }

    // Resolve teacher: either from platform or manual entry
    let resolvedName = manualTeacherName;
    let resolvedWhatsapp = manualTeacherWhatsapp;
    let resolvedEmail: string | null = null; // only set if confirmed portal user

    if (teacherEmail) {
      // Try to find as a portal user — if found, use as FK reference
      const teacherRes = await db.query(
        `SELECT pu.email, pu.full_name, COALESCE(up.whatsapp, up.phone, pu.phone) AS whatsapp
         FROM portal_users pu
         LEFT JOIN user_profiles up ON up.email = pu.email
         WHERE pu.email = $1`,
        [teacherEmail]
      );
      if (teacherRes.rows.length > 0) {
        // Confirmed portal user — use as FK
        resolvedEmail = String(teacherRes.rows[0].email);
        resolvedName = resolvedName || String(teacherRes.rows[0].full_name || '');
        resolvedWhatsapp = resolvedWhatsapp || String(teacherRes.rows[0].whatsapp || '');
      }
      // If not found in portal_users, treat email as contact info only (stored in teacher_whatsapp_manual)
      // resolvedEmail stays null to avoid FK violation
    }

    if (!resolvedName) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Teacher name is required' }, { status: 400 });
    }

    // Auto-generate title: "Subject — Teacher Name"
    const title = (body.title as string || '').trim() || `${subject} — ${resolvedName}`;

    const scheduledAt = body.scheduled_at ? new Date(body.scheduled_at as string) : null;
    const durationMinutes = body.duration_minutes != null ? Number(body.duration_minutes) : 60;
    const classroomType = scheduledAt ? 'scheduled' : 'instant';
    const paymentEnabled = Boolean(body.payment_enabled);
    const pricePaise = paymentEnabled ? Math.max(0, Math.round(Number(body.price_paise) || 0)) : 0;
    const currency = (body.currency as string || 'INR').toUpperCase();
    const maxParticipants = Number(body.max_participants) || 0; // 0 = unlimited
    const autoApproveJoins = body.auto_approve_joins !== false; // default true
    const meetingType = (body.meeting_type as string || '').trim() || null;

    const teacherPassword = (body.teacher_password as string || '').trim();

    const hostToken = crypto.randomBytes(6).toString('hex');
    const joinToken = crypto.randomBytes(6).toString('hex');

    // ── Create temp portal user for manual teachers with a password ──
    let tempAccountEmail: string | null = null;
    if (!resolvedEmail && teacherPassword) {
      const genEmail = (teacherEmail || `oc_${hostToken}@temp.stibe.in`).toLowerCase();
      const passwordHash = await bcryptHash(teacherPassword, 10);
      await db.query(
        `INSERT INTO portal_users (email, full_name, portal_role, password_hash, plain_password, is_active, is_temp_account)
         VALUES ($1, $2, 'teacher_screen', $3, $4, true, true)
         ON CONFLICT (email) DO NOTHING`,
        [genEmail, resolvedName, passwordHash, teacherPassword]
      );
      resolvedEmail = genEmail;
      tempAccountEmail = genEmail;
    }

    const result = await db.query(
      `INSERT INTO open_classrooms
         (title, description, created_by, teacher_email, host_token, join_token,
          classroom_type, scheduled_at, duration_minutes,
          payment_enabled, price_paise, currency, max_participants, subject, grade, auto_approve_joins, meeting_type,
          teacher_name_manual, teacher_whatsapp_manual)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
       RETURNING *`,
      [title, description, user.id, resolvedEmail || null, hostToken, joinToken,
       classroomType, scheduledAt, durationMinutes,
       paymentEnabled, pricePaise, currency, maxParticipants, subject || null, grade, autoApproveJoins, meetingType,
       resolvedEmail ? null : (resolvedName || null),
       resolvedEmail ? null : (resolvedWhatsapp || null)]
    );

    const oc = result.rows[0];
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://stibelearning.online';
    const hostLink = `${baseUrl}/open-classroom/${hostToken}`;
    const joinLink = `${baseUrl}/open-classroom/${joinToken}`;

    // Send host link to teacher's WhatsApp
    let teacherWhatsappSent = false;
    if (resolvedWhatsapp) {
      const phone = resolvedWhatsapp.startsWith('+') ? resolvedWhatsapp : `+${resolvedWhatsapp}`;
      let timeInfo = '';
      if (classroomType === 'scheduled' && scheduledAt) {
        timeInfo = `\n📅 ${scheduledAt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })} at ${scheduledAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })}`;
      }
      const message = `You've been assigned as host for *${title}*.${timeInfo}\n\n🔗 Join as teacher: ${hostLink}`;
      try {
        const res = await sendWhatsApp({
          to: phone,
          template: 'general',
          templateData: { recipientName: resolvedName, message },
          recipientEmail: resolvedEmail || undefined,
        });
        teacherWhatsappSent = res.success;
      } catch { /* ignore */ }
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        ...oc,
        teacher_name: resolvedName,
        host_link: hostLink,
        join_link: joinLink,
        teacher_whatsapp_sent: teacherWhatsappSent,
        ...(tempAccountEmail ? {
          temp_teacher_email: tempAccountEmail,
          temp_teacher_password: (body.teacher_password as string || '').trim(),
        } : {}),
      },
    }, { status: 201 });
  } catch (err) {
    console.error('[open-classroom/create]', err);
    return NextResponse.json<ApiResponse>({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
