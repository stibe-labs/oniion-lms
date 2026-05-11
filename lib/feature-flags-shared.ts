export interface FeatureFlags {
  livekit:     boolean; // Video classroom (teacher go-live, student join)
  aiExam:      boolean; // Groq AI exam generation in classroom
  paymentGate: boolean; // Payment required before joining sessions
  recording:   boolean; // YouTube recording in classroom
  demo:        boolean; // Demo class booking workflow
  homework:    boolean; // Homework assignments (teacher + student)
  sessionExam: boolean; // In-session exam questions
  whatsapp:    boolean; // WhatsApp notifications
}

export const FLAG_KEYS: Record<keyof FeatureFlags, string> = {
  livekit:     'feature_livekit',
  aiExam:      'feature_ai_exam',
  paymentGate: 'feature_payment_gate',
  recording:   'feature_recording',
  demo:        'feature_demo',
  homework:    'feature_homework',
  sessionExam: 'feature_session_exam',
  whatsapp:    'feature_whatsapp',
};

export const FLAG_LABELS: Record<keyof FeatureFlags, { label: string; description: string }> = {
  livekit:     { label: 'Video Classroom',        description: 'Teacher go-live and student session joining via LiveKit.' },
  aiExam:      { label: 'AI Exam Generation',     description: 'Groq AI-powered question generation inside the classroom.' },
  paymentGate: { label: 'Payment Gate',           description: 'Block students from joining if fees are overdue.' },
  recording:   { label: 'Session Recording',      description: 'YouTube live recording controls in the classroom.' },
  demo:        { label: 'Demo Classes',            description: 'Demo booking workflow for teachers and sales team.' },
  homework:    { label: 'Homework',               description: 'Homework assignments in teacher and student dashboards.' },
  sessionExam: { label: 'In-Session Exams',       description: 'Send exam questions to students during a live class.' },
  whatsapp:    { label: 'WhatsApp Notifications',  description: 'Send WhatsApp messages for attendance, enrollment, etc.' },
};

export const DEFAULT_FLAGS: FeatureFlags = {
  livekit:     true,
  aiExam:      true,
  paymentGate: true,
  recording:   true,
  demo:        true,
  homework:    true,
  sessionExam: true,
  whatsapp:    true,
};
