import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAuth } from '@/lib/auth';
import type { ApiResponse } from '@/types';

/**
 * GET /api/v1/teacher/homework — all homework assigned by this teacher across batches
 * Returns: assignments with questions + submission stats
 */
export async function GET(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (user.role !== 'teacher' && user.role !== 'academic_operator' && user.role !== 'owner') {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    // Fetch all homework assigned by this teacher
    const assignRes = await db.query(
      `SELECT ha.id, ha.room_id, ha.batch_id, ha.subject, ha.title, ha.description,
              ha.due_date, ha.due_time, ha.status, ha.created_at,
              ha.attachment_urls, ha.attachment_names,
              b.batch_name, b.grade,
              r.room_name
       FROM homework_assignments ha
       LEFT JOIN batches b ON b.batch_id = ha.batch_id
       LEFT JOIN rooms r ON r.room_id = ha.room_id
       WHERE ha.assigned_by = $1
       ORDER BY ha.created_at DESC`,
      [user.id],
    );

    const assignments = assignRes.rows as Record<string, unknown>[];
    const assignmentIds = assignments.map(a => a.id as string);

    // Fetch questions
    let questionsByHw: Record<string, Record<string, unknown>[]> = {};
    if (assignmentIds.length > 0) {
      const qRes = await db.query(
        `SELECT id, homework_id, question_number, question_text
         FROM homework_questions WHERE homework_id = ANY($1)
         ORDER BY question_number ASC`,
        [assignmentIds],
      );
      for (const q of qRes.rows as Record<string, unknown>[]) {
        const hwId = q.homework_id as string;
        if (!questionsByHw[hwId]) questionsByHw[hwId] = [];
        questionsByHw[hwId].push(q);
      }
    }

    // Fetch all submissions for these assignments
    let submissionsByHw: Record<string, Record<string, unknown>[]> = {};
    if (assignmentIds.length > 0) {
      const subRes = await db.query(
        `SELECT id, homework_id, student_email, student_name,
                submission_text, file_urls, file_names,
                completion_status, delay_days,
                submitted_at, grade, teacher_comment, graded_by, graded_at
         FROM homework_submissions
         WHERE homework_id = ANY($1)
         ORDER BY submitted_at DESC`,
        [assignmentIds],
      );
      for (const s of subRes.rows as Record<string, unknown>[]) {
        const hwId = s.homework_id as string;
        if (!submissionsByHw[hwId]) submissionsByHw[hwId] = [];
        submissionsByHw[hwId].push(s);
      }
    }

    // Get batch student counts for submission rate
    const batchIds = [...new Set(assignments.map(a => a.batch_id).filter(Boolean))] as string[];
    let studentCountByBatch: Record<string, number> = {};
    if (batchIds.length > 0) {
      const cntRes = await db.query(
        `SELECT batch_id, COUNT(*) as count FROM batch_students
         WHERE batch_id = ANY($1) AND student_status = 'active'
         GROUP BY batch_id`,
        [batchIds],
      );
      for (const r of cntRes.rows as Record<string, unknown>[]) {
        studentCountByBatch[r.batch_id as string] = Number(r.count);
      }
    }

    const data = assignments.map(a => ({
      ...a,
      questions: questionsByHw[a.id as string] || [],
      submissions: submissionsByHw[a.id as string] || [],
      total_students: studentCountByBatch[a.batch_id as string] || 0,
      submission_count: (submissionsByHw[a.id as string] || []).length,
    }));

    return NextResponse.json<ApiResponse>({ success: true, data: { assignments: data } });
  } catch (err) {
    console.error('[teacher/homework] GET error:', err);
    return NextResponse.json<ApiResponse>({ success: false, error: 'Internal error' }, { status: 500 });
  }
}
