import { NextRequest, NextResponse } from 'next/server';
import { db, resolveRoomId } from '@/lib/db';
import { verifyAuth } from '@/lib/auth';
import type { ApiResponse } from '@/types';

/**
 * GET  /api/v1/room/[room_id]/homework — list assignments + questions + submissions
 * POST /api/v1/room/[room_id]/homework — assign / submit / grade
 */

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ room_id: string }> },
) {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const { room_id: rawRoomId } = await params;
    const room_id = await resolveRoomId(rawRoomId);

    const assignments = await db.query(
      `SELECT id, subject, title, description, due_date, due_time,
              assigned_by, assigned_by_name, status, created_at,
              attachment_urls, attachment_names
       FROM homework_assignments
       WHERE room_id = $1
       ORDER BY created_at DESC`,
      [room_id],
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

    const isTeacher = user.role === 'teacher' || user.role === 'academic_operator' || user.role === 'owner';
    const submissions = await db.query(
      `SELECT hs.id, hs.homework_id, hs.student_email, hs.student_name,
              hs.submission_text, hs.file_urls, hs.file_names,
              hs.completion_status, hs.delay_days,
              hs.submitted_at, hs.grade, hs.teacher_comment, hs.graded_by, hs.graded_at
       FROM homework_submissions hs
       JOIN homework_assignments ha ON ha.id = hs.homework_id
       WHERE ha.room_id = $1 ${isTeacher ? '' : 'AND hs.student_email = $2'}
       ORDER BY hs.submitted_at DESC`,
      isTeacher ? [room_id] : [room_id, user.id],
    );

    return NextResponse.json<ApiResponse>({
      success: true,
      data: { assignments: assignmentsWithQ, submissions: submissions.rows },
    });
  } catch (err) {
    console.error('[homework] GET error:', err);
    return NextResponse.json<ApiResponse>({ success: false, error: 'Internal error' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ room_id: string }> },
) {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const { room_id: rawRoomId } = await params;
    const room_id = await resolveRoomId(rawRoomId);
    const body = await request.json();
    const { action } = body;

    // ── ASSIGN ──────────────────────────────────────────
    if (action === 'assign') {
      if (user.role !== 'teacher' && user.role !== 'academic_operator' && user.role !== 'owner') {
        return NextResponse.json<ApiResponse>({ success: false, error: 'Only teachers can assign homework' }, { status: 403 });
      }

      const { title, description, due_date, due_time, questions, attachment_urls, attachment_names } = body as {
        title?: string; description?: string; due_date?: string; due_time?: string;
        questions?: { question_number: number; question_text: string }[];
        attachment_urls?: string[]; attachment_names?: string[];
      };
      if (!title?.trim()) {
        return NextResponse.json<ApiResponse>({ success: false, error: 'Title is required' }, { status: 400 });
      }

      const room = await db.query(`SELECT batch_id, subject FROM rooms WHERE room_id = $1`, [room_id]);
      const roomData = room.rows[0] as Record<string, unknown> | undefined;
      if (!roomData?.batch_id) {
        return NextResponse.json<ApiResponse>({ success: false, error: 'Room has no associated batch' }, { status: 400 });
      }

      const result = await db.query(
        `INSERT INTO homework_assignments
           (room_id, batch_id, subject, title, description, due_date, due_time, assigned_by, assigned_by_name, attachment_urls, attachment_names)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING *`,
        [
          room_id, roomData.batch_id, roomData.subject || 'General',
          title.trim().slice(0, 500),
          (description || '').trim().slice(0, 2000) || null,
          due_date || null, due_time || null,
          user.id, user.name || user.id,
          attachment_urls || [], attachment_names || [],
        ],
      );
      const assignment = result.rows[0] as Record<string, unknown>;

      // Insert questions
      const insertedQuestions: Record<string, unknown>[] = [];
      if (questions && Array.isArray(questions)) {
        for (const q of questions) {
          if (!q.question_text?.trim()) continue;
          const qRes = await db.query(
            `INSERT INTO homework_questions (homework_id, question_number, question_text)
             VALUES ($1, $2, $3) RETURNING *`,
            [assignment.id, q.question_number, q.question_text.trim().slice(0, 2000)],
          );
          insertedQuestions.push(qRes.rows[0] as Record<string, unknown>);
        }
      }

      return NextResponse.json<ApiResponse>({
        success: true, data: { ...assignment, questions: insertedQuestions },
      });
    }

    // ── SUBMIT ──────────────────────────────────────────
    if (action === 'submit') {
      const { homework_id, submission_text, file_urls, file_names, completion_status } = body as {
        homework_id?: string; submission_text?: string;
        file_urls?: string[]; file_names?: string[];
        completion_status?: string;
      };
      if (!homework_id) {
        return NextResponse.json<ApiResponse>({ success: false, error: 'homework_id is required' }, { status: 400 });
      }

      const validStatus = ['completed', 'partial', 'not_started'];
      const status = validStatus.includes(completion_status || '') ? completion_status : 'completed';

      // Calculate delay days (IST calendar-day comparison)
      const hwRes = await db.query(`SELECT due_date FROM homework_assignments WHERE id = $1`, [homework_id]);
      const hwData = hwRes.rows[0] as Record<string, unknown> | undefined;
      let delayDays = 0;
      if (hwData?.due_date) {
        const dueStr = String(hwData.due_date).slice(0, 10); // 'YYYY-MM-DD'
        const todayIST = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); // 'YYYY-MM-DD'
        if (todayIST > dueStr) {
          delayDays = Math.round((new Date(todayIST).getTime() - new Date(dueStr).getTime()) / 86_400_000);
        }
      }

      const result = await db.query(
        `INSERT INTO homework_submissions
           (homework_id, student_email, student_name, submission_text,
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
    }

    // ── GRADE ───────────────────────────────────────────
    if (action === 'grade') {
      if (user.role !== 'teacher' && user.role !== 'academic_operator' && user.role !== 'owner') {
        return NextResponse.json<ApiResponse>({ success: false, error: 'Only teachers can grade' }, { status: 403 });
      }

      const { submission_id, grade, teacher_comment } = body;
      if (!submission_id) {
        return NextResponse.json<ApiResponse>({ success: false, error: 'submission_id is required' }, { status: 400 });
      }

      const result = await db.query(
        `UPDATE homework_submissions
         SET grade = $2, teacher_comment = $3, graded_by = $4, graded_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [submission_id, grade || null, (teacher_comment || '').trim().slice(0, 1000) || null, user.id],
      );
      if (result.rowCount === 0) {
        return NextResponse.json<ApiResponse>({ success: false, error: 'Submission not found' }, { status: 404 });
      }
      return NextResponse.json<ApiResponse>({ success: true, data: result.rows[0] });
    }

    return NextResponse.json<ApiResponse>({ success: false, error: 'Invalid action' }, { status: 400 });
  } catch (err) {
    console.error('[homework] POST error:', err);
    return NextResponse.json<ApiResponse>({ success: false, error: 'Internal error' }, { status: 500 });
  }
}
