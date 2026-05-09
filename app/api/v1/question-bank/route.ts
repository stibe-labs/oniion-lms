// ═══════════════════════════════════════════════════════════════
// Question Bank API — GET + POST /api/v1/question-bank
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { verifySession, COOKIE_NAME } from '@/lib/session';
import { getQuestionBank, addToQuestionBank } from '@/lib/exam';

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    const user = await verifySession(token);
    if (!user || !['teacher', 'owner', 'academic_operator'].includes(user.role)) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    const url = new URL(req.url);
    const questions = await getQuestionBank({
      subject: url.searchParams.get('subject') || undefined,
      grade: url.searchParams.get('grade') || undefined,
      difficulty: url.searchParams.get('difficulty') || undefined,
      topic: url.searchParams.get('topic') || undefined,
      createdBy: user.role === 'teacher' ? user.id : undefined,
      limit: Number(url.searchParams.get('limit')) || 100,
    });

    return NextResponse.json({ success: true, data: { questions } });
  } catch (err) {
    console.error('[question-bank] GET error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    const user = await verifySession(token);
    if (!user || !['teacher', 'owner', 'academic_operator'].includes(user.role)) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    const body = await req.json();
    const { question_text, question_type, options, correct_answer, marks, difficulty, topic, subject, grade } = body;

    if (!question_text || !subject || !grade) {
      return NextResponse.json({ success: false, error: 'question_text, subject, grade required' }, { status: 400 });
    }

    const question = await addToQuestionBank({
      question_text, question_type: question_type || 'mcq',
      options: options || [], correct_answer: correct_answer ?? 0,
      marks: marks || 1, difficulty, topic,
      subject, grade, createdBy: user.id,
    });

    return NextResponse.json({ success: true, data: question });
  } catch (err) {
    console.error('[question-bank] POST error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
