// ═══════════════════════════════════════════════════════════════
// stibe Portal — Email Queue (Step 05)
// ═══════════════════════════════════════════════════════════════
// Redis-backed BullMQ queue for background email sending.
// Coordinator "Send Notifications" queues N jobs → returns
// immediately → worker processes in background.
// ═══════════════════════════════════════════════════════════════

import { Queue, Worker, type Job, type ConnectionOptions } from 'bullmq';
import {
  sendEmail,
  logEmailQueued,
  logEmailSent,
  logEmailFailed,
} from '@/lib/email';
import {
  teacherInviteTemplate,
  studentInviteTemplate,
  paymentConfirmationTemplate,
  roomReminderTemplate,
  roomCancelledTemplate,
  roomRescheduledTemplate,
  coordinatorSummaryTemplate,
  type TeacherInviteData,
  type StudentInviteData,
  type PaymentConfirmationData,
  type RoomReminderData,
  type RoomCancelledData,
  type RoomRescheduledData,
  type CoordinatorSummaryData,
} from '@/lib/email-templates';

// ── Queue Name ──────────────────────────────────────────────

const QUEUE_NAME = 'stibe-email-queue';

// ── Redis Connection Options (for BullMQ) ───────────────────
// BullMQ bundles its own ioredis, so we pass connection options
// instead of an ioredis instance to avoid type conflicts.

function parseRedisUrl(url: string): ConnectionOptions {
  const parsed = new URL(url);
  return {
    host: parsed.hostname || 'localhost',
    port: parseInt(parsed.port || '6379', 10),
    password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
    maxRetriesPerRequest: null, // required by BullMQ
  };
}

const redisOpts = parseRedisUrl(process.env.REDIS_URL || 'redis://localhost:6379');

const globalForQueue = globalThis as unknown as {
  emailQueue: Queue | undefined;
  emailWorker: Worker | undefined;
};

// ── Job Types ───────────────────────────────────────────────

export type EmailTemplateType =
  | 'teacher_invite'
  | 'student_invite'
  | 'payment_confirmation'
  | 'room_reminder'
  | 'room_cancelled'
  | 'room_rescheduled'
  | 'coordinator_summary';

export interface EmailJobData {
  templateType: EmailTemplateType;
  roomId: string | null;
  recipientEmail: string;
  templateData: Record<string, unknown>;
  priority: 'high' | 'normal' | 'low';
}

// ── Priority Mapping (BullMQ uses lower = higher priority) ──

const PRIORITY_MAP: Record<string, number> = {
  high: 1,
  normal: 2,
  low: 3,
};

// ── Queue Instance ──────────────────────────────────────────

export function getEmailQueue(): Queue<EmailJobData> {
  if (globalForQueue.emailQueue) {
    return globalForQueue.emailQueue as Queue<EmailJobData>;
  }

  const queue = new Queue<EmailJobData>(QUEUE_NAME, {
    connection: redisOpts,
    defaultJobOptions: {
      attempts: 2,
      backoff: { type: 'fixed', delay: 30_000 },
      removeOnComplete: { count: 1000 },
      removeOnFail: { count: 500 },
    },
  });

  if (process.env.NODE_ENV !== 'production') {
    globalForQueue.emailQueue = queue;
  }

  return queue;
}

// ── Enqueue Functions ───────────────────────────────────────

/**
 * Add a single email job to the queue. Returns the BullMQ job ID.
 */
export async function enqueueEmail(jobData: EmailJobData): Promise<string> {
  const queue = getEmailQueue();
  const job = await queue.add(`email-${jobData.templateType}`, jobData, {
    priority: PRIORITY_MAP[jobData.priority] ?? 2,
  });
  return job.id ?? 'unknown';
}

/**
 * Enqueue a batch of email jobs (e.g., all student invites for a room).
 * Returns count of queued jobs.
 */
export async function enqueueBatch(jobs: EmailJobData[]): Promise<number> {
  const queue = getEmailQueue();
  const bulkJobs = jobs.map((jobData) => ({
    name: `email-${jobData.templateType}`,
    data: jobData,
    opts: {
      priority: PRIORITY_MAP[jobData.priority] ?? 2,
    },
  }));

  await queue.addBulk(bulkJobs);
  return bulkJobs.length;
}

// ── Template Resolver ───────────────────────────────────────

function resolveTemplate(
  templateType: EmailTemplateType,
  data: Record<string, unknown>
): { subject: string; html: string; text: string } {
  switch (templateType) {
    case 'teacher_invite':
      return teacherInviteTemplate(data as unknown as TeacherInviteData);
    case 'student_invite':
      return studentInviteTemplate(data as unknown as StudentInviteData);
    case 'payment_confirmation':
      return paymentConfirmationTemplate(data as unknown as PaymentConfirmationData);
    case 'room_reminder':
      return roomReminderTemplate(data as unknown as RoomReminderData);
    case 'room_cancelled':
      return roomCancelledTemplate(data as unknown as RoomCancelledData);
    case 'room_rescheduled':
      return roomRescheduledTemplate(data as unknown as RoomRescheduledData);
    case 'coordinator_summary':
      return coordinatorSummaryTemplate(data as unknown as CoordinatorSummaryData);
    default:
      throw new Error(`Unknown template type: ${templateType}`);
  }
}

// ── Worker (processes queued email jobs) ─────────────────────

export function startEmailWorker(): Worker<EmailJobData> {
  if (globalForQueue.emailWorker) {
    return globalForQueue.emailWorker;
  }

  const worker = new Worker<EmailJobData>(
    QUEUE_NAME,
    async (job: Job<EmailJobData>) => {
      const { templateType, roomId, recipientEmail, templateData, priority } = job.data;

      console.log(`[EmailWorker] Processing job ${job.id}: ${templateType} → ${recipientEmail}`);

      // Resolve template
      const { subject, html, text } = resolveTemplate(templateType, templateData);

      // Log as queued in DB
      const logId = await logEmailQueued(roomId, recipientEmail, templateType, subject);

      // Send
      const result = await sendEmail({ to: recipientEmail, subject, html, text, priority });

      if (result.success) {
        await logEmailSent(logId, result.messageId);
        console.log(`[EmailWorker] ✓ Sent ${templateType} to ${recipientEmail} (${result.messageId})`);
      } else {
        await logEmailFailed(logId, result.error || 'Unknown error');
        console.error(`[EmailWorker] ✗ Failed ${templateType} to ${recipientEmail}: ${result.error}`);
        throw new Error(result.error); // triggers BullMQ retry
      }
    },
    {
      connection: redisOpts,
      concurrency: 5,
      limiter: {
        max: 10,
        duration: 1000, // max 10 emails/sec to avoid SMTP rate limits
      },
    }
  );

  worker.on('completed', (job) => {
    console.log(`[EmailWorker] Job ${job.id} completed`);
  });

  worker.on('failed', (job, error) => {
    console.error(`[EmailWorker] Job ${job?.id} failed:`, error.message);
  });

  if (process.env.NODE_ENV !== 'production') {
    globalForQueue.emailWorker = worker;
  }

  return worker;
}

// ── Queue Status (for coordinator progress polling) ─────────

export interface QueueStatus {
  total: number;
  sent: number;
  failed: number;
  pending: number;
}

/**
 * Get notification send progress for a specific room.
 * Queries email_log table for status counts.
 */
export async function getNotifyStatus(roomId: string): Promise<QueueStatus> {
  const { db: database } = await import('@/lib/db');
  const result = await database.query<{ status: string; count: string }>(
    `SELECT status, COUNT(*)::text as count
     FROM email_log
     WHERE room_id = $1
     GROUP BY status`,
    [roomId]
  );

  const counts: Record<string, number> = {};
  for (const row of result.rows) {
    counts[row.status] = parseInt(row.count, 10);
  }

  const sent = counts['sent'] ?? 0;
  const failed = counts['failed'] ?? 0;
  const queued = counts['queued'] ?? 0;

  return {
    total: sent + failed + queued,
    sent,
    failed,
    pending: queued,
  };
}
