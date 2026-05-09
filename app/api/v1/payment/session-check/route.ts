// 
// Session Payment Check — POST /api/v1/payment/session-check
// Check if student needs to pay for a session.
// 1. First checks pre-generated invoices (created at schedule time via batch_session_id)
// 2. Falls back to room-based fee calculation for legacy/manual rooms
// 3. Also checks for unpaid extension invoices (from extra-time requests)
// 

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifySession, COOKIE_NAME } from '@/lib/session';
import {
  calculateSessionFee,
  checkSessionPayment,
  checkBatchSessionPayment,
  createSessionInvoice,
  createPaymentOrder,
  formatAmount,
} from '@/lib/payment';

// Helper: fetch any unpaid extension invoice for a student
async function getUnpaidExtensionInvoice(studentEmail: string) {
  try {
    const res = await db.query(
      `SELECT i.id, i.invoice_number, i.amount_paise, i.currency, i.description
       FROM session_extension_requests ser
       JOIN invoices i ON i.id = ser.invoice_id
       WHERE ser.student_email = $1
         AND ser.status = 'approved'
         AND i.status = 'overdue'
       ORDER BY i.created_at ASC
       LIMIT 1`,
      [studentEmail]
    );
    if (res.rows.length > 0) {
      const row = res.rows[0] as {
        id: string; invoice_number: string; amount_paise: number;
        currency: string; description: string;
      };
      return row;
    }
  } catch { /* extension tables may not exist */ }
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    const user = await verifySession(token);
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const { room_id: rawRoomId } = await req.json();
    if (!rawRoomId) {
      return NextResponse.json({ success: false, error: 'room_id required' }, { status: 400 });
    }

    // Only students and parents need to pay
    if (!['student', 'parent'].includes(user.role)) {
      return NextResponse.json({
        success: true,
        data: { paymentRequired: false, reason: 'Role exempt from payment' },
      });
    }

    // Demo rooms are always free — skip payment checks
    if (rawRoomId.startsWith('demo_')) {
      return NextResponse.json({
        success: true,
        data: { paymentRequired: false, paid: true, reason: 'Demo session — no fee' },
      });
    }

    // Resolve room_id and batch_session_id
    let roomId: string | null = null;
    let batchSessionId: string | null = null;

    try {
      const resolved = await db.query(
        `SELECT room_id, batch_session_id FROM rooms WHERE room_id = $1 OR batch_session_id = $1 LIMIT 1`,
        [rawRoomId]
      );
      if (resolved.rows.length > 0) {
        roomId = String((resolved.rows[0] as Record<string, unknown>).room_id);
        batchSessionId = (resolved.rows[0] as Record<string, unknown>).batch_session_id as string | null;
      }
    } catch { /* room may not exist yet */ }

    // If rawRoomId looks like a session ID (starts with sess_), use it as batch_session_id
    if (!batchSessionId && rawRoomId.startsWith('sess_')) {
      batchSessionId = rawRoomId;
    }

    // Resolve student email
    let studentEmail = user.id;
    let parentEmail: string | undefined;

    if (user.role === 'parent') {
      // Find child: first try batch_students (if we have batch_session_id), then room_assignments
      let childEmail: string | null = null;

      if (batchSessionId) {
        const childResult = await db.query(
          `SELECT bs2.student_email
           FROM batch_sessions s
           JOIN batch_students bs2 ON bs2.batch_id = s.batch_id
           JOIN user_profiles up ON up.email = bs2.student_email
           WHERE s.session_id = $1 AND up.parent_email = $2
           LIMIT 1`,
          [batchSessionId, user.id]
        );
        if (childResult.rows.length > 0) {
          childEmail = (childResult.rows[0] as Record<string, unknown>).student_email as string;
        }
      }

      if (!childEmail && roomId) {
        const childResult = await db.query(
          `SELECT ra.participant_email
           FROM room_assignments ra
           JOIN user_profiles up ON up.email = ra.participant_email
           WHERE ra.room_id = $1 AND ra.participant_type = 'student' AND up.parent_email = $2
           LIMIT 1`,
          [roomId, user.id]
        );
        if (childResult.rows.length > 0) {
          childEmail = (childResult.rows[0] as Record<string, unknown>).participant_email as string;
        }
      }

      if (!childEmail) {
        return NextResponse.json({
          success: true,
          data: { paymentRequired: false, reason: 'No child enrolled in this session' },
        });
      }
      studentEmail = childEmail;
      parentEmail = user.id;
    } else {
      const profileResult = await db.query(
        `SELECT parent_email FROM user_profiles WHERE email = $1`,
        [user.id]
      );
      if (profileResult.rows.length > 0) {
        parentEmail = (profileResult.rows[0] as Record<string, unknown>).parent_email as string | undefined;
      }
    }

    // ── Batch type gate resolution ──
    // one_to_one / one_to_three → credit-based per-class gate applies
    // all other batch types      → no payment gate (enrolled = already paid)
    // any type with quarterly_due_date overdue → block regardless
    let batchType: string | null = null;
    try {
      const btRes = await db.query<{ batch_type: string }>(
        `SELECT b.batch_type FROM batches b
         JOIN batch_students bs ON bs.batch_id = b.batch_id
         WHERE bs.student_email = $1
           AND (b.batch_id IN (
             SELECT batch_id FROM rooms WHERE room_id = $2
             UNION
             SELECT batch_id FROM batch_sessions WHERE session_id = $3
           ))
         LIMIT 1`,
        [studentEmail, roomId ?? '', batchSessionId ?? '']
      );
      if (btRes.rows.length > 0) batchType = btRes.rows[0].batch_type;
    } catch { /* non-critical */ }

    const isPerClassBatch = batchType === 'one_to_one' || batchType === 'one_to_three';

    // ── Skip payment gate check + quarterly due date ──
    try {
      const gateRes = await db.query<{ skip_payment_gate: boolean; quarterly_due_date: string | null }>(
        `SELECT bs.skip_payment_gate, bs.quarterly_due_date
         FROM batch_students bs
         JOIN batches b ON b.batch_id = bs.batch_id
         LEFT JOIN rooms r ON r.batch_id = b.batch_id
         LEFT JOIN batch_sessions ses ON ses.batch_id = b.batch_id
         WHERE bs.student_email = $1
           AND (
             r.room_id = $2
             OR ses.session_id = $3
             OR b.batch_id IN (
               SELECT batch_id FROM rooms WHERE room_id = $2
               UNION
               SELECT batch_id FROM batch_sessions WHERE session_id = $3
             )
           )
         ORDER BY bs.skip_payment_gate DESC
         LIMIT 1`,
        [studentEmail, roomId ?? '', batchSessionId ?? '']
      );
      if (gateRes.rows.length > 0) {
        const row = gateRes.rows[0];
        if (row.skip_payment_gate === true) {
          return NextResponse.json({
            success: true,
            data: { paymentRequired: false, reason: 'Payment gate disabled for this student' },
          });
        }

        // ── Batch-flat fee gate: check if a special/improvement batch fee is unpaid ──
        try {
          const flatGateRes = await db.query(
            `SELECT efs.id, efs.batch_name, efs.fee_paise, efs.currency
             FROM enrollment_fee_structure efs
             JOIN batches b ON b.batch_type = efs.batch_type
             JOIN batch_students bs2 ON bs2.batch_id = b.batch_id
             WHERE bs2.student_email = $1
               AND efs.fee_type = 'batch_flat'
               AND efs.payment_gate_enabled = true
               AND efs.is_active = true
               AND b.batch_id IN (
                 SELECT batch_id FROM rooms WHERE room_id = $2
                 UNION
                 SELECT batch_id FROM batch_sessions WHERE session_id = $3
               )
               AND NOT EXISTS (
                 SELECT 1 FROM invoices i
                 WHERE i.student_email = $1
                   AND i.batch_flat_fee_id = efs.id
                   AND i.status = 'paid'
               )
             LIMIT 1`,
            [studentEmail, roomId ?? '', batchSessionId ?? ''],
          );
          if (flatGateRes.rows.length > 0) {
            const fg = flatGateRes.rows[0] as { id: string; batch_name: string; fee_paise: number; currency: string };
            // Check if there's a pending invoice, else create one
            let invoiceId: string | null = null;
            let razorpayOrder: unknown = null;
            const existingInv = await db.query(
              `SELECT id, amount_paise, currency FROM invoices
               WHERE student_email = $1 AND batch_flat_fee_id = $2 AND status IN ('pending', 'overdue')
               ORDER BY created_at DESC LIMIT 1`,
              [studentEmail, fg.id],
            );
            if (existingInv.rows.length > 0) {
              const inv = existingInv.rows[0] as { id: string; amount_paise: number; currency: string };
              invoiceId = inv.id;
              try {
                razorpayOrder = await createPaymentOrder({
                  invoiceId: inv.id,
                  amountPaise: inv.amount_paise,
                  currency: inv.currency,
                  studentEmail,
                  studentName: user.name,
                  description: `${fg.batch_name} — batch fee`,
                });
              } catch { /* order may already exist */ }
            } else {
              // Auto-create invoice for this batch flat fee
              try {
                const newInv = await db.query(
                  `INSERT INTO invoices (student_email, description, amount_paise, currency, status, due_date, billing_period, batch_flat_fee_id)
                   VALUES ($1, $2, $3, $4, 'pending', NOW() + INTERVAL '7 days', 'one_time', $5)
                   RETURNING id, amount_paise, currency`,
                  [studentEmail, `${fg.batch_name} — one-time batch fee`, fg.fee_paise, fg.currency, fg.id],
                );
                if (newInv.rows.length > 0) {
                  const ni = newInv.rows[0] as { id: string; amount_paise: number; currency: string };
                  invoiceId = ni.id;
                  try {
                    razorpayOrder = await createPaymentOrder({
                      invoiceId: ni.id,
                      amountPaise: ni.amount_paise,
                      currency: ni.currency,
                      studentEmail,
                      studentName: user.name,
                      description: `${fg.batch_name} — batch fee`,
                    });
                  } catch { /* order creation optional */ }
                }
              } catch { /* non-critical */ }
            }
            return NextResponse.json({
              success: true,
              data: {
                paymentRequired: true,
                batchFlatFee: true,
                batchName: fg.batch_name,
                invoiceId,
                amount: fg.fee_paise,
                amountFormatted: formatAmount(fg.fee_paise, fg.currency),
                currency: fg.currency,
                message: `A one-time batch fee of ${formatAmount(fg.fee_paise, fg.currency)} is required to join ${fg.batch_name}.`,
                ...(razorpayOrder ? { order: razorpayOrder } : {}),
              },
            });
          }
        } catch { /* non-critical — don't block on error */ }

        // Quarterly due date check
        if (row.quarterly_due_date) {
          const dueDate = new Date(row.quarterly_due_date);
          dueDate.setHours(23, 59, 59, 999);
          if (dueDate < new Date()) {
            return NextResponse.json({
              success: true,
              data: {
                paymentRequired: true,
                quarterlyDue: true,
                dueDateFormatted: new Date(row.quarterly_due_date).toLocaleDateString('en-IN', {
                  day: 'numeric', month: 'long', year: 'numeric',
                }),
                message: 'Your quarterly payment is overdue. Please contact the coordinator to process payment and regain access.',
              },
            });
          }
        }
        // Group batch (not 1:1 or 1:3) with no quarterly overdue → check enrollment invoice
        if (!isPerClassBatch) {
          // Block if any enrollment invoice is overdue (unpaid past due_date)
          try {
            const overdueRes = await db.query(
              `SELECT id, invoice_number, amount_paise, currency, due_date
               FROM invoices
               WHERE student_email = $1
                 AND status IN ('pending', 'overdue')
                 AND due_date <= NOW() + INTERVAL '3 days'
                 AND (enrollment_link_id IS NOT NULL OR billing_period = 'one_time')
               ORDER BY due_date ASC LIMIT 1`,
              [studentEmail]
            );
            if (overdueRes.rows.length > 0) {
              const inv = overdueRes.rows[0] as { id: string; invoice_number: string; amount_paise: number; currency: string; due_date: string };
              const isOverdue = new Date(inv.due_date) < new Date();
              return NextResponse.json({
                success: true,
                data: {
                  paymentRequired: true,
                  enrollmentInvoiceOverdue: true,
                  invoiceId: inv.id,
                  invoiceNumber: inv.invoice_number,
                  amount: inv.amount_paise,
                  amountFormatted: formatAmount(inv.amount_paise, inv.currency),
                  currency: inv.currency,
                  dueDateFormatted: new Date(inv.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }),
                  message: isOverdue
                    ? 'Your fee payment is overdue. Please pay your outstanding invoice to continue attending classes.'
                    : `Your invoice is due in less than 3 days (${new Date(inv.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}). Please pay to continue attending classes.`,
                },
              });
            }
          } catch { /* ignore — non-critical gate check */ }
          return NextResponse.json({
            success: true,
            data: { paymentRequired: false, reason: 'Group batch — payment verified at enrollment' },
          });
        }
      } else if (!isPerClassBatch) {
        // No batch_students row found, and it's a group batch — check enrollment invoice too
        try {
          const overdueRes = await db.query(
            `SELECT id, invoice_number, amount_paise, currency, due_date
             FROM invoices
             WHERE student_email = $1
               AND status IN ('pending', 'overdue')
               AND due_date <= NOW() + INTERVAL '3 days'
               AND (enrollment_link_id IS NOT NULL OR billing_period = 'one_time')
             ORDER BY due_date ASC LIMIT 1`,
            [studentEmail]
          );
          if (overdueRes.rows.length > 0) {
            const inv = overdueRes.rows[0] as { id: string; invoice_number: string; amount_paise: number; currency: string; due_date: string };
            const isOverdue = new Date(inv.due_date) < new Date();
            return NextResponse.json({
              success: true,
              data: {
                paymentRequired: true,
                enrollmentInvoiceOverdue: true,
                invoiceId: inv.id,
                invoiceNumber: inv.invoice_number,
                amount: inv.amount_paise,
                amountFormatted: formatAmount(inv.amount_paise, inv.currency),
                currency: inv.currency,
                dueDateFormatted: new Date(inv.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }),
                message: isOverdue
                  ? 'Your fee payment is overdue. Please pay your outstanding invoice to continue attending classes.'
                  : `Your invoice is due in less than 3 days (${new Date(inv.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}). Please pay to continue attending classes.`,
              },
            });
          }
        } catch { /* ignore */ }
        return NextResponse.json({
          success: true,
          data: { paymentRequired: false, reason: 'Group batch — payment verified at enrollment' },
        });
      }
    } catch { /* columns may not exist on older DB — safe to ignore */ }

    // ── Credits exhaustion check (per-class plans: 1:1 and 1:3 only) ──
    try {
      const creditsRes = await db.query(
        `SELECT COALESCE(SUM(total_sessions), 0)::int AS total_allotted,
                COALESCE(SUM(used_sessions), 0)::int AS total_used
         FROM student_session_credits
         WHERE student_email = $1 AND subject = 'general' AND is_active = true`,
        [studentEmail]
      );
      const cr = creditsRes.rows[0] as { total_allotted: number; total_used: number };
      // Credits available → per-class batch student can join (credit will be consumed on room join)
      if (isPerClassBatch && cr.total_allotted > 0 && cr.total_allotted > cr.total_used) {
        return NextResponse.json({
          success: true,
          data: { paymentRequired: false, reason: 'Session credit available' },
        });
      }
      if (cr.total_allotted > 0 && cr.total_allotted <= cr.total_used) {
        // Check for a pending topup invoice
        let topupInvoice: {
          invoiceId: string; amount: number; amountFormatted: string; currency: string; order?: unknown;
        } | null = null;
        try {
          const topupRes = await db.query(
            `SELECT id, amount_paise, currency FROM invoices
             WHERE student_email = $1 AND is_topup = true AND status IN ('pending', 'overdue')
             ORDER BY created_at DESC LIMIT 1`,
            [studentEmail]
          );
          if (topupRes.rows.length > 0) {
            const ti = topupRes.rows[0] as { id: string; amount_paise: number; currency: string };
            const order = await createPaymentOrder({
              invoiceId: ti.id,
              amountPaise: ti.amount_paise,
              currency: ti.currency,
              studentEmail,
              studentName: user.name,
              description: 'Session credits top-up',
            });
            topupInvoice = {
              invoiceId: ti.id,
              amount: ti.amount_paise,
              amountFormatted: formatAmount(ti.amount_paise, ti.currency),
              currency: ti.currency,
              order,
            };
          }
        } catch { /* ignore */ }

        return NextResponse.json({
          success: true,
          data: {
            paymentRequired: true,
            creditsExhausted: true,
            totalAllotted: cr.total_allotted,
            totalUsed: cr.total_used,
            message: 'All prepaid session credits have been used. Please renew your session package to continue attending classes.',
            ...(topupInvoice && {
              invoiceId: topupInvoice.invoiceId,
              amount: topupInvoice.amount,
              amountFormatted: topupInvoice.amountFormatted,
              currency: topupInvoice.currency,
              order: topupInvoice.order,
            }),
          },
        });
      }
    } catch { /* credits table may not exist */ }

    // ── Strategy 1: Check pre-generated invoice from batch session scheduling ──
    if (batchSessionId) {
      const existing = await checkBatchSessionPayment(batchSessionId, studentEmail);
      if (existing.paid) {
        // Session is paid — but check for extension dues
        const extDue = await getUnpaidExtensionInvoice(studentEmail);
        if (extDue) {
          const extOrder = await createPaymentOrder({
            invoiceId: extDue.id,
            amountPaise: extDue.amount_paise,
            currency: extDue.currency,
            studentEmail,
            studentName: user.name,
            description: extDue.description || 'Extension fee',
          });
          return NextResponse.json({
            success: true,
            data: {
              paymentRequired: true,
              extensionDue: true,
              invoiceId: extDue.id,
              invoiceNumber: extDue.invoice_number,
              amount: extDue.amount_paise,
              amountFormatted: formatAmount(extDue.amount_paise, extDue.currency),
              currency: extDue.currency,
              description: extDue.description,
              order: extOrder,
            },
          });
        }
        return NextResponse.json({
          success: true,
          data: { paymentRequired: false, paid: true, reason: 'Already paid' },
        });
      }

      if (existing.invoiceId && (existing.status === 'pending' || existing.status === 'overdue')) {
        // Fetch invoice — this may be a COMBINED invoice covering multiple sessions
        const invRes = await db.query(
          `SELECT amount_paise, currency, description FROM invoices WHERE id = $1`,
          [existing.invoiceId]
        );
        if (invRes.rows.length > 0) {
          const inv = invRes.rows[0] as Record<string, unknown>;
          const sessionAmountPaise = Number(inv.amount_paise);
          const currency = String(inv.currency || 'INR');

          // Check for extension dues — combine into a single payment
          const extDue = await getUnpaidExtensionInvoice(studentEmail);

          if (extDue) {
            // Combined payment: session fee + extension fee in one Razorpay order
            const combinedAmount = sessionAmountPaise + extDue.amount_paise;
            const order = await createPaymentOrder({
              invoiceId: existing.invoiceId,
              amountPaise: combinedAmount,
              currency,
              studentEmail,
              studentName: user.name,
              description: `Session fee + Extension fee`,
            });
            // Tag extension invoice with the same gateway order ID
            await db.query(
              `UPDATE invoices SET gateway_order_id = $1 WHERE id = $2`,
              [order.orderId, extDue.id]
            );
            return NextResponse.json({
              success: true,
              data: {
                paymentRequired: true,
                invoiceIds: [existing.invoiceId, extDue.id],
                items: [
                  { label: inv.description as string || 'Session fee', amount: sessionAmountPaise, amountFormatted: formatAmount(sessionAmountPaise, currency) },
                  { label: extDue.description || 'Extension fee', amount: extDue.amount_paise, amountFormatted: formatAmount(extDue.amount_paise, extDue.currency) },
                ],
                amount: combinedAmount,
                amountFormatted: formatAmount(combinedAmount, currency),
                currency,
                order,
              },
            });
          }

          const order = await createPaymentOrder({
            invoiceId: existing.invoiceId,
            amountPaise: sessionAmountPaise,
            currency,
            studentEmail,
            studentName: user.name,
            description: inv.description as string || 'Session fee',
          });

          return NextResponse.json({
            success: true,
            data: {
              paymentRequired: true,
              invoiceId: existing.invoiceId,
              amount: sessionAmountPaise,
              amountFormatted: formatAmount(sessionAmountPaise, currency),
              currency,
              order,
            },
          });
        }
      }
    }

    // ── Strategy 2: Fallback to room-based fee calculation (legacy flow) ──
    if (!roomId) {
      // No room fee — but check for extension dues
      const extDue = await getUnpaidExtensionInvoice(studentEmail);
      if (extDue) {
        const extOrder = await createPaymentOrder({
          invoiceId: extDue.id,
          amountPaise: extDue.amount_paise,
          currency: extDue.currency,
          studentEmail,
          studentName: user.name,
          description: extDue.description || 'Extension fee',
        });
        return NextResponse.json({
          success: true,
          data: {
            paymentRequired: true,
            extensionDue: true,
            invoiceId: extDue.id,
            invoiceNumber: extDue.invoice_number,
            amount: extDue.amount_paise,
            amountFormatted: formatAmount(extDue.amount_paise, extDue.currency),
            currency: extDue.currency,
            description: extDue.description,
            order: extOrder,
          },
        });
      }
      return NextResponse.json({
        success: true,
        data: { paymentRequired: false, reason: 'No fee configured for this session' },
      });
    }

    const fee = await calculateSessionFee(roomId);
    if (!fee || fee.amountPaise <= 0) {
      // No session fee — but check extension dues
      const extDue = await getUnpaidExtensionInvoice(studentEmail);
      if (extDue) {
        const extOrder = await createPaymentOrder({
          invoiceId: extDue.id,
          amountPaise: extDue.amount_paise,
          currency: extDue.currency,
          studentEmail,
          studentName: user.name,
          description: extDue.description || 'Extension fee',
        });
        return NextResponse.json({
          success: true,
          data: {
            paymentRequired: true,
            extensionDue: true,
            invoiceId: extDue.id,
            invoiceNumber: extDue.invoice_number,
            amount: extDue.amount_paise,
            amountFormatted: formatAmount(extDue.amount_paise, extDue.currency),
            currency: extDue.currency,
            description: extDue.description,
            order: extOrder,
          },
        });
      }
      return NextResponse.json({
        success: true,
        data: { paymentRequired: false, reason: 'No fee configured for this session' },
      });
    }

    // Check room-based payment
    const existing = await checkSessionPayment(roomId, studentEmail);
    if (existing.paid) {
      // Session paid — check extension dues
      const extDue = await getUnpaidExtensionInvoice(studentEmail);
      if (extDue) {
        const extOrder = await createPaymentOrder({
          invoiceId: extDue.id,
          amountPaise: extDue.amount_paise,
          currency: extDue.currency,
          studentEmail,
          studentName: user.name,
          description: extDue.description || 'Extension fee',
        });
        return NextResponse.json({
          success: true,
          data: {
            paymentRequired: true,
            extensionDue: true,
            invoiceId: extDue.id,
            invoiceNumber: extDue.invoice_number,
            amount: extDue.amount_paise,
            amountFormatted: formatAmount(extDue.amount_paise, extDue.currency),
            currency: extDue.currency,
            description: extDue.description,
            order: extOrder,
          },
        });
      }
      return NextResponse.json({
        success: true,
        data: { paymentRequired: false, paid: true, reason: 'Already paid' },
      });
    }

    // Get room info for invoice
    const roomResult = await db.query(
      `SELECT room_name, subject, scheduled_start, duration_minutes FROM rooms WHERE room_id = $1`,
      [roomId]
    );
    const room = roomResult.rows[0] as Record<string, unknown>;

    // Reuse existing pending invoice
    if (existing.invoiceId && existing.status === 'pending') {
      const extDue = await getUnpaidExtensionInvoice(studentEmail);

      if (extDue) {
        // Combined payment: session fee + extension fee
        const combinedAmount = fee.amountPaise + extDue.amount_paise;
        const order = await createPaymentOrder({
          invoiceId: existing.invoiceId,
          amountPaise: combinedAmount,
          currency: fee.currency,
          studentEmail,
          studentName: user.name,
          description: `Session fee + Extension fee`,
        });
        await db.query(
          `UPDATE invoices SET gateway_order_id = $1 WHERE id = $2`,
          [order.orderId, extDue.id]
        );
        return NextResponse.json({
          success: true,
          data: {
            paymentRequired: true,
            invoiceIds: [existing.invoiceId, extDue.id],
            items: [
              { label: `Session fee: ${room.room_name} (${room.subject})`, amount: fee.amountPaise, amountFormatted: formatAmount(fee.amountPaise, fee.currency) },
              { label: extDue.description || 'Extension fee', amount: extDue.amount_paise, amountFormatted: formatAmount(extDue.amount_paise, extDue.currency) },
            ],
            amount: combinedAmount,
            amountFormatted: formatAmount(combinedAmount, fee.currency),
            currency: fee.currency,
            order,
          },
        });
      }

      const order = await createPaymentOrder({
        invoiceId: existing.invoiceId,
        amountPaise: fee.amountPaise,
        currency: fee.currency,
        studentEmail,
        studentName: user.name,
        description: `Session fee: ${room.room_name} (${room.subject})`,
      });

      return NextResponse.json({
        success: true,
        data: {
          paymentRequired: true,
          invoiceId: existing.invoiceId,
          amount: fee.amountPaise,
          amountFormatted: formatAmount(fee.amountPaise, fee.currency),
          currency: fee.currency,
          perHourRate: fee.perHourRate,
          durationMinutes: fee.durationMinutes,
          order,
        },
      });
    }

    // Create new session invoice (legacy room-based)
    const { invoiceId, invoiceNumber } = await createSessionInvoice({
      roomId,
      roomName: room.room_name as string,
      subject: room.subject as string,
      studentEmail,
      parentEmail,
      amountPaise: fee.amountPaise,
      currency: fee.currency,
      durationMinutes: fee.durationMinutes,
      scheduledStart: room.scheduled_start as string,
    });

    // Check for extension dues to combine with new invoice
    const extDueNew = await getUnpaidExtensionInvoice(studentEmail);
    if (extDueNew) {
      const combinedAmount = fee.amountPaise + extDueNew.amount_paise;
      const order = await createPaymentOrder({
        invoiceId,
        amountPaise: combinedAmount,
        currency: fee.currency,
        studentEmail,
        studentName: user.name,
        description: `Session fee + Extension fee`,
      });
      await db.query(
        `UPDATE invoices SET gateway_order_id = $1 WHERE id = $2`,
        [order.orderId, extDueNew.id]
      );
      return NextResponse.json({
        success: true,
        data: {
          paymentRequired: true,
          invoiceIds: [invoiceId, extDueNew.id],
          items: [
            { label: `Session fee: ${room.room_name} (${room.subject})`, amount: fee.amountPaise, amountFormatted: formatAmount(fee.amountPaise, fee.currency) },
            { label: extDueNew.description || 'Extension fee', amount: extDueNew.amount_paise, amountFormatted: formatAmount(extDueNew.amount_paise, extDueNew.currency) },
          ],
          amount: combinedAmount,
          amountFormatted: formatAmount(combinedAmount, fee.currency),
          currency: fee.currency,
          invoiceNumber,
          order,
        },
      });
    }

    const order = await createPaymentOrder({
      invoiceId,
      amountPaise: fee.amountPaise,
      currency: fee.currency,
      studentEmail,
      studentName: user.name,
      description: `Session fee: ${room.room_name} (${room.subject})`,
    });

    return NextResponse.json({
      success: true,
      data: {
        paymentRequired: true,
        invoiceId,
        invoiceNumber,
        amount: fee.amountPaise,
        amountFormatted: formatAmount(fee.amountPaise, fee.currency),
        currency: fee.currency,
        perHourRate: fee.perHourRate,
        durationMinutes: fee.durationMinutes,
        order,
      },
    });
  } catch (err) {
    console.error('[session-check] POST error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
