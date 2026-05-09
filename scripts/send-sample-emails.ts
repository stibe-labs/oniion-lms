/**
 * Send sample emails for ALL 45 templates to a test recipient.
 * Usage: npx tsx scripts/send-sample-emails.ts
 */

import { config } from 'dotenv';
config({ path: '.env.local' });
import * as nodemailer from 'nodemailer';
import {
  teacherInviteTemplate,
  studentInviteTemplate,
  paymentConfirmationTemplate,
  roomReminderTemplate,
  roomCancelledTemplate,
  roomRescheduledTemplate,
  coordinatorSummaryTemplate,
  credentialsTemplate,
  roomStartedTemplate,
  batchCoordinatorNotifyTemplate,
  batchTeacherNotifyTemplate,
  batchStudentNotifyTemplate,
  batchParentNotifyTemplate,
  dailyTimetableTemplate,
  sessionReminderTemplate,
  weeklyTimetableTemplate,
  sessionRequestSubmittedTemplate,
  sessionRequestApprovedTemplate,
  sessionRequestRejectedTemplate,
  sessionRescheduledNotifyTemplate,
  sessionCancelledNotifyTemplate,
  sessionSubstituteNotifyTemplate,
  leaveRequestSubmittedTemplate,
  leaveRequestApprovedTemplate,
  leaveRequestRejectedTemplate,
  leaveSessionsAffectedTemplate,
  leaveHRApprovedTemplate,
  leaveAOActionRequiredTemplate,
  invoiceGeneratedTemplate,
  paymentReceiptTemplate,
  payslipNotificationTemplate,
  paymentReminderTemplate,
  passwordResetOtpTemplate,
  demoTeacherRequestTemplate,
  demoTeacherAssignedTemplate,
  demoStudentAcceptedTemplate,
  demoAOAcceptedTemplate,
  demoAgentJoinTemplate,
  demoStudentSearchingTemplate,
  demoStudentRejectedTemplate,
  demoSummaryTeacherTemplate,
  demoSummaryAOTemplate,
  demoSummaryStudentTemplate,
  teacherReportNotifyTemplate,
  earlyExitAlertTemplate,
  absentNotificationTemplate,
  joinReminderTemplate,
  refundApprovedTemplate,
  lowCreditsWarningTemplate,
  enrollmentPaymentLinkEmail,
} from '../lib/email-templates';

const TO = 'official.tishnu@gmail.com';
const BASE_URL = 'https://stibelearning.online';

// ── Sample data shared ────────────────────────────────────────────────

const DEMO_SCHEDULED = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1h from now

const templates: Array<{ subject: string; html: string; text: string }> = [

  // 1. Teacher Invite
  teacherInviteTemplate({
    teacherName: 'Arjun Nair',
    roomName: 'Grade 10 — Physics — Session 14',
    subject: 'Physics',
    grade: 'Grade 10',
    date: '10 May 2026',
    time: '10:00 AM',
    duration: '60 minutes',
    notes: 'Please cover Newton\'s 3rd law and friction problems today.',
    laptopLink: `${BASE_URL}/join/sample-room?token=teacher_laptop`,
    tabletLink: `${BASE_URL}/join/sample-room?token=teacher_tablet`,
    recipientEmail: TO,
  }),

  // 2. Student Invite
  studentInviteTemplate({
    studentName: 'Tishnu T.',
    roomName: 'Grade 10 — Physics — Session 14',
    subject: 'Physics',
    grade: 'Grade 10',
    date: '10 May 2026',
    time: '10:00 AM',
    duration: '60 minutes',
    joinLink: `${BASE_URL}/join/sample-room?token=student`,
    paymentStatus: 'paid',
    recipientEmail: TO,
  }),

  // 3. Payment Confirmation
  paymentConfirmationTemplate({
    studentName: 'Tishnu T.',
    roomName: 'Grade 10 — Physics — Session 14',
    amount: '₹1,500',
    transactionId: 'TXN202605101234',
    date: '10 May 2026',
    joinLink: `${BASE_URL}/join/sample-room?token=student`,
    recipientEmail: TO,
  }),

  // 4. Room Reminder (student)
  roomReminderTemplate({
    recipientName: 'Tishnu T.',
    recipientRole: 'student',
    roomName: 'Grade 10 — Physics — Session 14',
    startTime: '10:00 AM IST',
    teacherName: 'Arjun Nair',
    joinLink: `${BASE_URL}/join/sample-room?token=student`,
    recipientEmail: TO,
    minutesBefore: 30,
  }),

  // 5. Room Cancelled
  roomCancelledTemplate({
    roomName: 'Grade 10 — Physics — Session 14',
    date: '10 May 2026',
    time: '10:00 AM',
    reason: 'Teacher unavailable due to medical emergency.',
    recipientEmail: TO,
  }),

  // 6. Room Rescheduled
  roomRescheduledTemplate({
    roomName: 'Grade 10 — Physics — Session 14',
    oldDate: '10 May 2026',
    oldTime: '10:00 AM',
    newDate: '12 May 2026',
    newTime: '11:00 AM',
    joinLink: `${BASE_URL}/join/sample-room?token=student`,
    recipientEmail: TO,
  }),

  // 7. Coordinator Summary
  coordinatorSummaryTemplate({
    coordinatorName: 'Poornasree Dev',
    roomName: 'Grade 10 — Physics — Session 14',
    date: '10 May 2026',
    teacherName: 'Arjun Nair',
    teacherLaptopLink: `${BASE_URL}/join/sample-room?token=teacher_laptop`,
    teacherTabletLink: `${BASE_URL}/join/sample-room?token=teacher_tablet`,
    studentCount: 12,
    unpaidCount: 2,
    recipientEmail: TO,
  }),

  // 8. Credentials (Student)
  credentialsTemplate({
    recipientEmail: TO,
    recipientName: 'Tishnu T.',
    role: 'Student',
    loginEmail: 'official.tishnu@gmail.com',
    tempPassword: 'Temp@1234',
    loginUrl: `${BASE_URL}/login`,
    additionalInfo: 'Grade 10 · CBSE · Physics, Maths',
  }),

  // 9. Room Started
  roomStartedTemplate({
    studentName: 'Tishnu T.',
    roomName: 'Grade 10 — Physics — Session 14',
    teacherName: 'Arjun Nair',
    joinLink: `${BASE_URL}/join/sample-room?token=student`,
    recipientEmail: TO,
  }),

  // 10. Batch Coordinator Notify
  batchCoordinatorNotifyTemplate({
    coordinatorName: 'Poornasree Dev',
    batchName: 'G10-CBSE-Physics-2026',
    batchType: 'One-to-Many (1:30)',
    subjects: ['Physics', 'Chemistry'],
    grade: 'Grade 10',
    board: 'CBSE',
    teacherCount: 2,
    studentCount: 24,
    teachers: [
      { name: 'Arjun Nair', email: 'arjun@stibe.in', subject: 'Physics' },
      { name: 'Riya Menon', email: 'riya@stibe.in', subject: 'Chemistry' },
    ],
    students: [
      { name: 'Tishnu T.', email: 'official.tishnu@gmail.com' },
      { name: 'Aditi Sharma', email: 'aditi@example.com' },
    ],
    loginUrl: `${BASE_URL}/login`,
    recipientEmail: TO,
  }),

  // 11. Batch Teacher Notify
  batchTeacherNotifyTemplate({
    teacherName: 'Arjun Nair',
    batchName: 'G10-CBSE-Physics-2026',
    batchType: 'One-to-Many (1:30)',
    subjects: ['Physics'],
    grade: 'Grade 10',
    board: 'CBSE',
    assignedSubject: 'Physics',
    coordinatorName: 'Poornasree Dev',
    coordinatorEmail: 'dev.poornasree@gmail.com',
    studentCount: 24,
    loginUrl: `${BASE_URL}/login`,
    recipientEmail: TO,
  }),

  // 12. Batch Student Notify
  batchStudentNotifyTemplate({
    studentName: 'Tishnu T.',
    batchName: 'G10-CBSE-Physics-2026',
    batchType: 'One-to-Many (1:30)',
    subjects: ['Physics', 'Chemistry'],
    grade: 'Grade 10',
    board: 'CBSE',
    teachers: [
      { name: 'Arjun Nair', subject: 'Physics' },
      { name: 'Riya Menon', subject: 'Chemistry' },
    ],
    coordinatorName: 'Poornasree Dev',
    coordinatorEmail: 'dev.poornasree@gmail.com',
    loginUrl: `${BASE_URL}/login`,
    recipientEmail: TO,
  }),

  // 13. Batch Parent Notify
  batchParentNotifyTemplate({
    parentName: 'Rajesh T.',
    childName: 'Tishnu T.',
    childEmail: 'official.tishnu@gmail.com',
    batchName: 'G10-CBSE-Physics-2026',
    batchType: 'One-to-Many (1:30)',
    subjects: ['Physics', 'Chemistry'],
    grade: 'Grade 10',
    board: 'CBSE',
    teachers: [
      { name: 'Arjun Nair', subject: 'Physics' },
      { name: 'Riya Menon', subject: 'Chemistry' },
    ],
    coordinatorName: 'Poornasree Dev',
    coordinatorEmail: 'dev.poornasree@gmail.com',
    loginUrl: `${BASE_URL}/login`,
    recipientEmail: TO,
  }),

  // 14. Daily Timetable
  dailyTimetableTemplate({
    recipientName: 'Tishnu T.',
    recipientRole: 'student',
    date: 'Saturday, 10 May 2026',
    sessions: [
      { subject: 'Physics', teacherName: 'Arjun Nair', startTime: '10:00 AM', duration: '60 minutes', batchName: 'G10-CBSE', topic: 'Thermodynamics' },
      { subject: 'Chemistry', teacherName: 'Riya Menon', startTime: '12:00 PM', duration: '90 minutes', batchName: 'G10-CBSE' },
    ],
    loginUrl: `${BASE_URL}/login`,
    recipientEmail: TO,
  }),

  // 15. Session Reminder (30 min)
  sessionReminderTemplate({
    recipientName: 'Tishnu T.',
    recipientRole: 'student',
    subject: 'Physics',
    teacherName: 'Arjun Nair',
    batchName: 'G10-CBSE',
    startTime: '10:00 AM',
    duration: '60 minutes',
    topic: 'Thermodynamics',
    joinUrl: `${BASE_URL}/join/sample-room?token=student`,
    recipientEmail: TO,
    minutesBefore: 30,
  }),

  // 16. Weekly Timetable
  weeklyTimetableTemplate({
    recipientName: 'Tishnu T.',
    recipientRole: 'student',
    batchName: 'G10-CBSE-Physics-2026',
    batchGrade: '10',
    slots: [
      { day: 'Monday', subject: 'Physics', teacherName: 'Arjun Nair', startTime: '10:00 AM', endTime: '11:00 AM', duration: '60 min' },
      { day: 'Wednesday', subject: 'Chemistry', teacherName: 'Riya Menon', startTime: '11:00 AM', endTime: '12:30 PM', duration: '90 min' },
      { day: 'Friday', subject: 'Physics', teacherName: 'Arjun Nair', startTime: '10:00 AM', endTime: '11:00 AM', duration: '60 min' },
    ],
    loginUrl: `${BASE_URL}/login`,
    recipientEmail: TO,
  }),

  // 17. Session Request Submitted
  sessionRequestSubmittedTemplate({
    aoName: 'Poornasree Dev',
    requesterName: 'Tishnu T.',
    requesterRole: 'Student',
    requestType: 'reschedule',
    batchName: 'G10-CBSE',
    reason: 'Family function on that date',
    proposedDate: '15 May 2026',
    proposedTime: '11:00 AM',
  }),

  // 18. Session Request Approved
  sessionRequestApprovedTemplate({
    requesterName: 'Tishnu T.',
    requestType: 'reschedule',
    batchName: 'G10-CBSE',
    subject: 'Physics',
    sessionDate: '10 May 2026',
    proposedDate: '15 May 2026',
    proposedTime: '11:00 AM',
  }),

  // 19. Session Request Rejected
  sessionRequestRejectedTemplate({
    requesterName: 'Tishnu T.',
    requestType: 'reschedule',
    batchName: 'G10-CBSE',
    subject: 'Physics',
    sessionDate: '10 May 2026',
    reason: 'No available slots on the requested date.',
  }),

  // 20. Session Rescheduled Notify
  sessionRescheduledNotifyTemplate({
    recipientName: 'Tishnu T.',
    batchName: 'G10-CBSE',
    subject: 'Physics',
    oldDate: '10 May 2026',
    oldTime: '10:00 AM',
    newDate: '12 May 2026',
    newTime: '11:00 AM',
    reason: 'Teacher requested reschedule due to medical leave.',
    requestedBy: 'Arjun Nair',
    joinUrl: `${BASE_URL}/join/sample-room?token=student`,
    recipientEmail: TO,
    duration: '60 minutes',
    topic: 'Thermodynamics',
  }),

  // 21. Session Cancelled Notify
  sessionCancelledNotifyTemplate({
    recipientName: 'Tishnu T.',
    batchName: 'G10-CBSE',
    subject: 'Physics',
    sessionDate: '10 May 2026',
    startTime: '10:00 AM',
    reason: 'Teacher on approved leave.',
    cancelledBy: 'Academic Operator',
    recipientEmail: TO,
  }),

  // 22. Session Substitute Notify (stakeholder view)
  sessionSubstituteNotifyTemplate({
    recipientName: 'Tishnu T.',
    batchName: 'G10-CBSE',
    subject: 'Physics',
    sessionDate: '10 May 2026',
    startTime: '10:00 AM',
    substituteTeacher: 'Dr. Vivek Kumar',
    originalTeacher: 'Arjun Nair',
    reason: 'Arjun Nair is on approved leave.',
    requestedBy: 'Academic Operator',
    joinUrl: `${BASE_URL}/join/sample-room?token=student`,
    recipientEmail: TO,
    duration: '60 minutes',
    topic: 'Thermodynamics',
    isSubstitute: false,
  }),

  // 22b. Session Substitute Notify (substitute teacher view)
  sessionSubstituteNotifyTemplate({
    recipientName: 'Dr. Vivek Kumar',
    batchName: 'G10-CBSE',
    subject: 'Physics',
    sessionDate: '10 May 2026',
    startTime: '10:00 AM',
    substituteTeacher: 'Dr. Vivek Kumar',
    originalTeacher: 'Arjun Nair',
    reason: 'Arjun Nair is on approved leave.',
    requestedBy: 'Academic Operator',
    joinUrl: `${BASE_URL}/join/sample-room?token=teacher`,
    recipientEmail: TO,
    duration: '60 minutes',
    topic: 'Thermodynamics',
    grade: 'Grade 10',
    studentCount: 24,
    isSubstitute: true,
  }),

  // 23. Leave Request Submitted
  leaveRequestSubmittedTemplate({
    reviewerName: 'Poornasree Dev',
    teacherName: 'Arjun Nair',
    leaveType: 'sick',
    startDate: '12 May 2026',
    endDate: '14 May 2026',
    reason: 'Fever and medical rest advised.',
    affectedSessions: 3,
  }),

  // 24. Leave Request Approved
  leaveRequestApprovedTemplate({
    teacherName: 'Arjun Nair',
    leaveType: 'sick',
    startDate: '12 May 2026',
    endDate: '14 May 2026',
    affectedSessions: 3,
  }),

  // 25. Leave Request Rejected
  leaveRequestRejectedTemplate({
    teacherName: 'Arjun Nair',
    leaveType: 'casual',
    startDate: '12 May 2026',
    endDate: '13 May 2026',
    rejectedBy: 'Poornasree Dev',
    rejectedByRole: 'Academic Operator',
    reason: 'Critical exams scheduled. No alternate teacher available.',
  }),

  // 26. Leave Sessions Affected
  leaveSessionsAffectedTemplate({
    recipientName: 'Tishnu T.',
    teacherName: 'Arjun Nair',
    batchName: 'G10-CBSE',
    sessionDates: '12 May, 13 May, 14 May 2026',
    sessionsCount: 3,
    leaveType: 'sick',
    startDate: '12 May 2026',
    endDate: '14 May 2026',
  }),

  // 27. Leave HR Approved
  leaveHRApprovedTemplate({
    teacherName: 'Arjun Nair',
    leaveType: 'sick',
    startDate: '12 May 2026',
    endDate: '14 May 2026',
    hrReviewerName: 'Sreeja HR',
  }),

  // 28. Leave AO Action Required
  leaveAOActionRequiredTemplate({
    aoName: 'Poornasree Dev',
    teacherName: 'Arjun Nair',
    leaveType: 'sick',
    startDate: '12 May 2026',
    endDate: '14 May 2026',
    reason: 'Fever and medical rest advised.',
    affectedSessions: 3,
  }),

  // 29. Invoice Generated
  invoiceGeneratedTemplate({
    recipientName: 'Rajesh T.',
    recipientEmail: TO,
    studentName: 'Tishnu T.',
    invoiceNumber: 'INV-2026-0042',
    description: 'May 2026 Tuition | Physics: 8×60min @₹250/hr=₹2,000 | Chemistry: 4×90min @₹250/hr=₹1,500',
    amount: '₹3,500',
    dueDate: '20 May 2026',
    billingPeriod: 'May 2026',
    payLink: `${BASE_URL}/pay/sample-invoice`,
    invoiceLink: `${BASE_URL}/invoices/sample`,
  }),

  // 30. Payment Receipt
  paymentReceiptTemplate({
    recipientName: 'Rajesh T.',
    recipientEmail: TO,
    studentName: 'Tishnu T.',
    receiptNumber: 'RCP-2026-0042',
    invoiceNumber: 'INV-2026-0042',
    amount: '₹3,500',
    transactionId: 'TXN202605101234',
    paymentMethod: 'UPI / Razorpay',
    paymentDate: '10 May 2026',
    receiptLink: `${BASE_URL}/receipts/sample`,
    description: 'May 2026 Tuition | Physics: 8×60min @₹250/hr=₹2,000 | Chemistry: 4×90min @₹250/hr=₹1,500',
  }),

  // 31. Payslip Notification
  payslipNotificationTemplate({
    teacherName: 'Arjun Nair',
    recipientEmail: TO,
    periodLabel: 'April 2026',
    classesConducted: 28,
    basePay: '₹14,000',
    incentive: '₹2,000',
    deductions: '₹0',
    totalPay: '₹16,000',
    status: 'paid',
  }),

  // 32. Payment Reminder (due)
  paymentReminderTemplate({
    recipientName: 'Rajesh T.',
    recipientEmail: TO,
    studentName: 'Tishnu T.',
    invoiceNumber: 'INV-2026-0041',
    amount: '₹3,500',
    dueDate: '10 May 2026',
    daysOverdue: 0,
    payLink: `${BASE_URL}/pay/sample-invoice`,
  }),

  // 33. Password Reset OTP
  passwordResetOtpTemplate({
    recipientName: 'Tishnu T.',
    recipientEmail: TO,
    otp: '847291',
  }),

  // 34. Demo Teacher Request
  demoTeacherRequestTemplate({
    teacherName: 'Arjun Nair',
    studentName: 'Rahul Sharma',
    studentGrade: '10',
    subject: 'Physics',
    portions: 'Newton\'s Laws, Friction, Work-Energy Theorem',
    recipientEmail: TO,
  }),

  // 35. Demo Teacher Assigned
  demoTeacherAssignedTemplate({
    teacherName: 'Arjun Nair',
    studentName: 'Rahul Sharma',
    subject: 'Physics',
    scheduledStart: DEMO_SCHEDULED,
    joinLink: `${BASE_URL}/join/demo-room?token=teacher`,
    durationMinutes: 30,
    recipientEmail: TO,
    studentGrade: '10',
  }),

  // 36. Demo Student Accepted
  demoStudentAcceptedTemplate({
    studentName: 'Rahul Sharma',
    teacherName: 'Arjun Nair',
    subject: 'Physics',
    scheduledStart: DEMO_SCHEDULED,
    joinLink: `${BASE_URL}/join/demo-room?token=student`,
    durationMinutes: 30,
    recipientEmail: TO,
  }),

  // 37. Demo AO Accepted
  demoAOAcceptedTemplate({
    teacherName: 'Arjun Nair',
    studentName: 'Rahul Sharma',
    subject: 'Physics',
    studentGrade: '10',
    scheduledStart: DEMO_SCHEDULED,
    durationMinutes: 30,
    recipientEmail: TO,
  }),

  // 38. Demo Agent Join
  demoAgentJoinTemplate({
    agentName: 'Sales Agent',
    teacherName: 'Arjun Nair',
    studentName: 'Rahul Sharma',
    subject: 'Physics',
    scheduledStart: DEMO_SCHEDULED,
    joinLink: `${BASE_URL}/join/demo-room?token=agent`,
    durationMinutes: 30,
    recipientEmail: TO,
  }),

  // 39. Demo Student Searching
  demoStudentSearchingTemplate({
    studentName: 'Rahul Sharma',
    subject: 'Physics',
    recipientEmail: TO,
  }),

  // 40. Demo Student Rejected
  demoStudentRejectedTemplate({
    studentName: 'Rahul Sharma',
    subject: 'Physics',
    reason: 'No teacher is available for the requested subject at this time.',
    recipientEmail: TO,
  }),

  // 41. Demo Summary — Teacher
  demoSummaryTeacherTemplate({
    roomId: 'demo_sample_001',
    roomName: 'Demo — Physics (Rahul Sharma)',
    subject: 'Physics',
    grade: '10',
    scheduledStr: '10 May 2026, 10:00 AM IST',
    endedStr: '10 May 2026, 10:32 AM IST',
    durationMinutes: 32,
    outcome: 'completed',
    outcomeLabel: 'Completed',
    portions: 'Newton\'s Laws, Friction',
    teacherName: 'Arjun Nair',
    studentName: 'Rahul Sharma',
    studentEmail: 'rahul@example.com',
    durationStr: '32 min',
    studentJoinedAt: '10:03 AM IST',
    studentDurationSec: 1740,
    studentLate: true,
    studentLateBySec: 180,
    studentJoinCount: 2,
    attentionScore: 82,
    attentiveMinutes: 25,
    lookingAwayMinutes: 3,
    eyesClosedMinutes: 1,
    notInFrameMinutes: 1,
    distractedMinutes: 4,
    phoneDetectedMinutes: 0,
    headTurnedMinutes: 1,
    yawningMinutes: 0,
    inactiveMinutes: 2,
    tabSwitchedMinutes: 0,
    totalMonitoringEvents: 14,
    alerts: [
      { type: 'distracted', severity: 'medium', message: 'Student looked away for 3+ minutes' },
    ],
    exam: {
      totalQuestions: 5,
      answered: 5,
      skipped: 0,
      score: 4,
      totalMarks: 5,
      percentage: 80,
      gradeLetter: 'A',
      timeTakenSeconds: 240,
      questions: [
        { questionText: 'What is Newton\'s 1st law?', correctAnswer: 'Law of Inertia', selectedOption: 'Law of Inertia', isCorrect: true, marks: 1 },
        { questionText: 'Unit of force?', correctAnswer: 'Newton', selectedOption: 'Newton', isCorrect: true, marks: 1 },
        { questionText: 'Formula for friction force?', correctAnswer: 'μN', selectedOption: 'μN', isCorrect: true, marks: 1 },
        { questionText: 'Action-reaction is Newton\'s?', correctAnswer: '3rd law', selectedOption: '3rd law', isCorrect: true, marks: 1 },
        { questionText: 'Unit of acceleration?', correctAnswer: 'm/s²', selectedOption: 'km/h', isCorrect: false, marks: 0 },
      ],
    },
    feedback: { rating: 5, text: 'Great explanation! Very easy to understand.', tags: 'clear,engaging,helpful' },
    recipientEmail: TO,
  }),

  // 42. Demo Summary — AO
  demoSummaryAOTemplate({
    roomId: 'demo_sample_001',
    roomName: 'Demo — Physics (Rahul Sharma)',
    subject: 'Physics',
    grade: '10',
    scheduledStr: '10 May 2026, 10:00 AM IST',
    endedStr: '10 May 2026, 10:32 AM IST',
    durationMinutes: 32,
    outcome: 'completed',
    outcomeLabel: 'Completed',
    portions: 'Newton\'s Laws, Friction',
    teacherName: 'Arjun Nair',
    studentName: 'Rahul Sharma',
    studentEmail: 'rahul@example.com',
    durationStr: '32 min',
    studentJoinedAt: '10:03 AM IST',
    studentDurationSec: 1740,
    studentLate: true,
    studentLateBySec: 180,
    studentJoinCount: 2,
    attentionScore: 82,
    attentiveMinutes: 25,
    lookingAwayMinutes: 3,
    eyesClosedMinutes: 1,
    notInFrameMinutes: 1,
    distractedMinutes: 4,
    phoneDetectedMinutes: 0,
    headTurnedMinutes: 1,
    yawningMinutes: 0,
    inactiveMinutes: 2,
    tabSwitchedMinutes: 0,
    totalMonitoringEvents: 14,
    alerts: [
      { type: 'distracted', severity: 'medium', message: 'Student looked away for 3+ minutes' },
    ],
    exam: {
      totalQuestions: 5,
      answered: 5,
      skipped: 0,
      score: 4,
      totalMarks: 5,
      percentage: 80,
      gradeLetter: 'A',
      timeTakenSeconds: 240,
      questions: [],
    },
    feedback: { rating: 5, text: 'Great explanation! Very easy to understand.', tags: 'clear,engaging,helpful' },
    recipientEmail: TO,
  }),

  // 43. Demo Summary — Student
  demoSummaryStudentTemplate({
    roomId: 'demo_sample_001',
    roomName: 'Demo — Physics (Rahul Sharma)',
    subject: 'Physics',
    grade: '10',
    scheduledStr: '10 May 2026, 10:00 AM IST',
    endedStr: '10 May 2026, 10:32 AM IST',
    durationMinutes: 32,
    outcome: 'completed',
    outcomeLabel: 'Completed',
    portions: 'Newton\'s Laws, Friction',
    teacherName: 'Arjun Nair',
    studentName: 'Rahul Sharma',
    studentEmail: 'rahul@example.com',
    durationStr: '32 min',
    studentJoinedAt: '10:03 AM IST',
    studentDurationSec: 1740,
    studentLate: true,
    studentLateBySec: 180,
    studentJoinCount: 2,
    attentionScore: 82,
    attentiveMinutes: 25,
    lookingAwayMinutes: 3,
    eyesClosedMinutes: 1,
    notInFrameMinutes: 1,
    distractedMinutes: 4,
    phoneDetectedMinutes: 0,
    headTurnedMinutes: 1,
    yawningMinutes: 0,
    inactiveMinutes: 2,
    tabSwitchedMinutes: 0,
    totalMonitoringEvents: 14,
    alerts: [],
    exam: {
      totalQuestions: 5,
      answered: 5,
      skipped: 0,
      score: 4,
      totalMarks: 5,
      percentage: 80,
      gradeLetter: 'A',
      timeTakenSeconds: 240,
      questions: [
        { questionText: 'What is Newton\'s 1st law?', correctAnswer: 'Law of Inertia', selectedOption: 'Law of Inertia', isCorrect: true, marks: 1 },
        { questionText: 'Unit of force?', correctAnswer: 'Newton', selectedOption: 'Newton', isCorrect: true, marks: 1 },
        { questionText: 'Formula for friction force?', correctAnswer: 'μN', selectedOption: 'μN', isCorrect: true, marks: 1 },
        { questionText: 'Action-reaction is Newton\'s?', correctAnswer: '3rd law', selectedOption: '3rd law', isCorrect: true, marks: 1 },
        { questionText: 'Unit of acceleration?', correctAnswer: 'm/s²', selectedOption: 'km/h', isCorrect: false, marks: 0 },
      ],
    },
    feedback: { rating: 5, text: 'Great explanation!', tags: 'clear,engaging' },
    recipientEmail: TO,
  }),

  // 44. Teacher Report Notify
  teacherReportNotifyTemplate({
    recipientName: 'Poornasree Dev',
    recipientRole: 'academic_operator',
    recipientEmail: TO,
    studentName: 'Tishnu T.',
    teacherName: 'Arjun Nair',
    roomName: 'G10-CBSE Physics Session 14',
    category: 'inappropriate_content',
    categoryLabel: 'Inappropriate Content',
    description: 'Teacher shared off-topic and inappropriate material during class.',
    severity: 'high',
    reportId: 'RPT-a1b2c3d4-e5f6',
    reportedAt: '10 May 2026, 10:22 AM IST',
  }),

  // 45. Early Exit Alert (parent)
  earlyExitAlertTemplate({
    recipientName: 'Rajesh T.',
    recipientEmail: TO,
    recipientRole: 'parent',
    studentName: 'Tishnu T.',
    studentEmail: 'official.tishnu@gmail.com',
    roomName: 'G10-CBSE Physics Session 14',
    subject: 'Physics',
    scheduledEnd: '11:00 AM',
    exitTime: '10:38 AM',
    remainingMinutes: 22,
  }),

  // 46. Absent Notification (student)
  absentNotificationTemplate({
    recipientName: 'Tishnu T.',
    recipientEmail: TO,
    studentName: 'Tishnu T.',
    subject: 'Physics',
    batchName: 'G10-CBSE',
    date: '10 May 2026',
    time: '10:00 AM',
    teacherName: 'Arjun Nair',
    isParent: false,
  }),

  // 47. Join Reminder (student)
  joinReminderTemplate({
    recipientName: 'Tishnu T.',
    recipientEmail: TO,
    studentName: 'Tishnu T.',
    subject: 'Physics',
    batchName: 'G10-CBSE',
    teacherName: 'Arjun Nair',
    joinUrl: `${BASE_URL}/join/sample-room?token=student`,
    isParent: false,
  }),

  // 48. Refund Approved
  refundApprovedTemplate({
    recipientName: 'Rajesh T.',
    recipientEmail: TO,
    studentName: 'Tishnu T.',
    amount: '1,500',
    sessionSubject: 'Physics',
    sessionDate: '5 May 2026',
    batchName: 'G10-CBSE',
    refundMethod: 'UPI (original payment source)',
    reviewNotes: 'Session was cancelled due to technical issues on our side.',
  }),

  // 49. Low Credits Warning
  lowCreditsWarningTemplate({
    recipientName: 'Rajesh T.',
    recipientEmail: TO,
    studentName: 'Tishnu T.',
    remainingCredits: 2,
    totalAllotted: 20,
    usedCredits: 18,
    subjectBreakdown: [
      { subject: 'Physics', remaining: 1, total: 12 },
      { subject: 'Chemistry', remaining: 1, total: 8 },
    ],
    renewLink: `${BASE_URL}/pay/renew-sample`,
    isExhausted: false,
  }),

  // 50. Enrollment Payment Link
  enrollmentPaymentLinkEmail({
    studentName: 'Tishnu T.',
    grade: '10',
    board: 'CBSE',
    batchType: 'One-to-One (1:1)',
    amount: '₹18,000',
    paymentUrl: `${BASE_URL}/pay/enroll-sample`,
  }),
];

// ── Mailer ────────────────────────────────────────────────────

async function main() {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER || process.env.SMTP_USERNAME,
      pass: (process.env.SMTP_PASS || process.env.SMTP_PASSWORD || '').replace(/\s/g, ''),
    },
    tls: { rejectUnauthorized: false },
  });

  const fromName = process.env.EMAIL_FROM_NAME || 'stibe Classes';
  const fromAddr = process.env.EMAIL_FROM_ADDRESS || process.env.SMTP_USER || '';
  const from = `"${fromName}" <${fromAddr}>`;

  const limit = process.env.SAMPLE_LIMIT ? parseInt(process.env.SAMPLE_LIMIT) : templates.length;
  const batch = templates.slice(0, limit);

  console.log(`\nSending ${batch.length} sample emails to ${TO}\n`);

  let sent = 0;
  let failed = 0;

  for (let i = 0; i < batch.length; i++) {
    const t = batch[i];
    try {
      await transporter.sendMail({
        from,
        to: TO,
        subject: `[SAMPLE ${String(i + 1).padStart(2, '0')}] ${t.subject}`,
        html: t.html,
        text: t.text,
      });
      console.log(`  ✓ [${String(i + 1).padStart(2, '0')}] ${t.subject}`);
      sent++;
      // Throttle slightly to avoid Gmail rate-limiting
      await new Promise(r => setTimeout(r, 400));
    } catch (err) {
      console.error(`  ✗ [${String(i + 1).padStart(2, '0')}] ${t.subject} — ${(err as Error).message}`);
      failed++;
    }
  }

  console.log(`\nDone. ${sent} sent, ${failed} failed.\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
