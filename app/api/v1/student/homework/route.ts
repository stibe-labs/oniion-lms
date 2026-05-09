// ═══════════════════════════════════════════════════════════════
// Student Homework API — GET /api/v1/student/homework
// Returns all homework (with questions) across batches the student
// is enrolled in, plus the student's submissions.
// POST — submit homework from dashboard (outside live session)
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifySession, COOKIE_NAME } from '@/lib/session';
import type { ApiResponse } from '@/types';

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (!token) return NextResponse.json<ApiResponse>({ success: false, error: 'Unauthorized' }, { status: 401 });
    const user = await verifySession(token);
    if (!user || !['student', 'owner'].includes(user.role))
      return NextResponse.json<ApiResponse>({ success: false, error: 'Unauthorized' }, { status: 401 });

    const studentEmail = user.id;

    const batchIds = await db.query(
      `SELECT batch_id FROM batch_students WHERE student_email = $1 AND student_status = 'active'`,
      [studentEmail],
    );
    const ids = batchIds.rows.map(r => r.batch_id as string);
    if (ids.length === 0) {
      return NextResponse.json<ApiResponse>({
        success: true,
        data: { assignments: [], submissions: [] },
      });
    }

    // All homework across student's batches
    const assignments = await db.query(
      `SELECT ha.id, ha.room_id, ha.batch_id, ha.subject, ha.title, ha.description,
              ha.due_date, ha.due_time, ha.assigned_by, ha.assigned_by_name, ha.status, ha.created_at,
              ha.attachment_urls, ha.attachment_names,
              b.batch_name
       FROM homework_assignments ha
       LEFT JOIN batches b ON b.batch_id = ha.batch_id
       WHERE ha.batch_id = ANY($1)
       ORDER BY ha.created_at DESC`,
      [ids],
    );

    // Fetch questions for all assignments
    const assignmentIds = assignments.rows.map(a => (a as Record<string, unknown>).id as string);
    let questions: Record<string, unknown>[] = [];
    if (assignmentIds.length > 0) {
      const qRes = await db.query(
        `SELECT id, homework_id, question_number, question_text
         FROM homework_questions WHERE homework_id = ANY($1)
         ORDER BY question_number ASC`,
        [assignmentIds],
      );
      questions = qRes.rows as Record<string, unknown>[];
    }
    const questionsByHw: Record<string, Record<string, unknown>[]> = {};
    for (const q of questions) {
      const hwId = q.homework_id as string;
      if (!questionsByHw[hwId]) questionsByHw[hwId] = [];
      questionsByHw[hwId].push(q);
    }
    const assignmentsWithQ = assignments.rows.map(a => {
      const hw = a as Record<string, unknown>;
      return { ...hw, questions: questionsByHw[hw.id as string] || [] };
    });

    // Student's submissions
    const submissions = await db.query(
      `SELECT hs.id, hs.homework_id, hs.student_email, hs.student_name,
              hs.submission_text, hs.file_urls, hs.file_names,
              hs.completion_status, hs.delay_days,
              hs.submitted_at, hs.grade, hs.teacher_comment,
              hs.graded_by, hs.graded_at
       FROM homework_submissions hs
       JOIN homework_assignments ha ON ha.id = hs.homework_id
       WHERE hs.student_email = $1 AND ha.batch_id = ANY($2)
       ORDER BY hs.submitted_at DESC`,
      [studentEmail, ids],
    );

    return NextResponse.json<ApiResponse>({
      success: true,
      data: { assignments: assignmentsWithQ, submissions: submissions.rows },
    });
  } catch (err) {
    console.error('[student/homework] GET error:', err);
    return NextResponse.json<ApiResponse>({ success: false, error: 'Internal error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (!token) return NextResponse.json<ApiResponse>({ success: false, error: 'Unauthorized' }, { status: 401 });
    const user = await verifySession(token);
    if (!user || !['student', 'owner'].includes(user.role))
      return NextResponse.json<ApiResponse>({ success: false, error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { homework_id, submission_text, file_urls, file_names, completion_status } = body;

    if (!homework_id) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'homework_id is required' }, { status: 400 });
    }

    // Verify student is in the batch that owns this homework
    const hw = await db.query(
      `SELECT ha.batch_id, ha.due_date FROM homework_assignments ha
       JOIN batch_students bs ON bs.batch_id = ha.batch_id
       WHERE ha.id = $1 AND bs.student_email = $2 AND bs.student_status = 'active'`,
      [homework_id, user.id],
    );
    if (hw.rows.length === 0) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Homework not found or not enrolled' }, { status: 404 });
    }

    const validStatus = ['completed', 'partial', 'not_started'];
    const status = validStatus.includes(completion_status || '') ? completion_status : 'completed';

    // Calculate delay days (IST calendar-day comparison)
    const hwData = hw.rows[0] as Record<string, unknown>;
    let delayDays = 0;
    if (hwData.due_date) {
      const dueStr = String(hwData.due_date).slice(0, 10); // 'YYYY-MM-DD'
      const todayIST = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); // 'YYYY-MM-DD'
      if (todayIST > dueStr) {
        delayDays = Math.round((new Date(todayIST).getTime() - new Date(dueStr).getTime()) / 86_400_000);
      }
    }

    const result = await db.query(
      `INSERT INTO homework_submissions (homework_id, student_email, student_name, submission_text,
         file_urls, file_names, completion_status, delay_days)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (homework_id, student_email) DO UPDATE SET
         submission_text = EXCLUDED.submission_text,
         file_urls = EXCLUDED.file_urls,
         file_names = EXCLUDED.file_names,
         completion_status = EXCLUDED.completion_status,
         delay_days = EXCLUDED.delay_days,
         submitted_at = NOW()
       RETURNING *`,
      [
        homework_id, user.id, user.name || user.id,
        (submission_text || '').trim().slice(0, 5000) || null,
        file_urls || [], file_names || [], status, delayDays,
      ],
    );

    return NextResponse.json<ApiResponse>({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('[student/homework] POST error:', err);
    return NextResponse.json<ApiResponse>({ success: false, error: 'Internal error' }, { status: 500 });
  }
}
