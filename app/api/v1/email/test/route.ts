// ═══════════════════════════════════════════════════════════════
// POST /api/v1/email/test — DEV ONLY
// ═══════════════════════════════════════════════════════════════
// Test endpoint to send a sample email (or log it in dev mode).
// Allows testing all 7 templates without real coordinator flow.
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import {
  sendTeacherInvite,
  sendStudentInvite,
  sendPaymentConfirmation,
  sendRoomReminder,
  sendRoomCancelled,
  sendRoomRescheduled,
  sendCoordinatorSummary,
} from '@/lib/email';

const IS_DEV = process.env.NODE_ENV !== 'production';
const BASE_URL = process.env.PORTAL_BASE_URL || 'http://localhost:3000';

export async function POST(request: NextRequest) {
  if (!IS_DEV) {
    return NextResponse.json(
      { success: false, error: 'Email test endpoint is only available in development' },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const { template, recipientEmail } = body as {
      template?: string;
      recipientEmail?: string;
    };

    const email = recipientEmail || 'test@stibelearning.online';
    const roomId = 'class_BATCH001_SCH001';

    const sampleData = {
      roomName: 'Mathematics — Class 10A',
      subject: 'Mathematics',
      grade: '10A',
      date: '28 Feb 2026',
      time: '10:00 AM',
      duration: '60 minutes',
    };

    let result;

    switch (template) {
      case 'teacher_invite':
        result = await sendTeacherInvite({
          ...sampleData,
          teacherName: 'Priya Sharma',
          notes: 'Please focus on Chapter 7 — Coordinate Geometry.',
          laptopLink: `${BASE_URL}/join?token=sample-laptop`,
          tabletLink: `${BASE_URL}/join?token=sample-tablet`,
          recipientEmail: email,
          roomId,
        });
        break;

      case 'student_invite':
        result = await sendStudentInvite({
          ...sampleData,
          studentName: 'Arjun Patel',
          joinLink: `${BASE_URL}/join?token=sample-student`,
          paymentStatus: 'unpaid',
          recipientEmail: email,
          roomId,
        });
        break;

      case 'payment_confirmation':
        result = await sendPaymentConfirmation({
          studentName: 'Arjun Patel',
          roomName: sampleData.roomName,
          amount: '₹500.00',
          transactionId: 'TXN-2026022800123',
          date: sampleData.date,
          joinLink: `${BASE_URL}/join?token=sample-paid`,
          recipientEmail: email,
          roomId,
        });
        break;

      case 'room_reminder':
        result = await sendRoomReminder({
          recipientName: 'Arjun Patel',
          recipientRole: 'student',
          roomName: sampleData.roomName,
          startTime: '10:00 AM',
          teacherName: 'Priya Sharma',
          joinLink: `${BASE_URL}/join?token=sample-reminder`,
          recipientEmail: email,
          roomId,
        });
        break;

      case 'room_cancelled':
        result = await sendRoomCancelled({
          roomName: sampleData.roomName,
          date: sampleData.date,
          time: sampleData.time,
          reason: 'Teacher is unwell. Class will be rescheduled.',
          recipientEmail: email,
          roomId,
        });
        break;

      case 'room_rescheduled':
        result = await sendRoomRescheduled({
          roomName: sampleData.roomName,
          oldDate: '28 Feb 2026',
          oldTime: '10:00 AM',
          newDate: '1 Mar 2026',
          newTime: '11:00 AM',
          joinLink: `${BASE_URL}/join?token=sample-reschedule`,
          recipientEmail: email,
          roomId,
        });
        break;

      case 'coordinator_summary':
        result = await sendCoordinatorSummary({
          coordinatorName: 'Meera Coordinator',
          roomName: sampleData.roomName,
          date: sampleData.date,
          teacherName: 'Priya Sharma',
          teacherLaptopLink: `${BASE_URL}/join?token=sample-teacher-laptop`,
          teacherTabletLink: `${BASE_URL}/join?token=sample-teacher-tablet`,
          studentCount: 28,
          unpaidCount: 3,
          recipientEmail: email,
          roomId,
        });
        break;

      default:
        return NextResponse.json(
          {
            success: false,
            error: `Unknown template: "${template}". Valid templates: teacher_invite, student_invite, payment_confirmation, room_reminder, room_cancelled, room_rescheduled, coordinator_summary`,
          },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      data: {
        template,
        recipientEmail: email,
        result,
      },
    });
  } catch (error) {
    console.error('[email/test] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to send test email' },
      { status: 500 }
    );
  }
}
