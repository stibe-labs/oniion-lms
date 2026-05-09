// ═══════════════════════════════════════════════════════════════
// Public Payment Page — /pay/[id]
// Accessible without login via HMAC-signed token in URL.
// Shows invoice summary + session line items + Razorpay checkout.
// ═══════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { verifyPayToken } from '@/lib/pay-token';
import { formatAmount } from '@/lib/payment';
import { notFound } from 'next/navigation';
import PayClient from './PayClient';
import { getPlatformName } from '@/lib/platform-config';

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ t?: string; returnUrl?: string }>;
}

const SUBJECT_COLORS: Record<string, string> = {
  Mathematics: '#6366f1', Math: '#6366f1',
  Physics: '#0ea5e9', Chemistry: '#f59e0b',
  Biology: '#10b981', English: '#8b5cf6',
  Hindi: '#ec4899', History: '#f97316',
  Geography: '#14b8a6', Science: '#06b6d4',
  'Social Science': '#a855f7', 'Special Class': '#64748b',
  'Exam Special': '#ef4444', Default: '#0d9488',
};
function subjectColor(subject: string) {
  return SUBJECT_COLORS[subject] || SUBJECT_COLORS.Default;
}
function subjectInitial(subject: string) {
  return (subject || '?').charAt(0).toUpperCase();
}
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}
function fmtTime(t: string) {
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hr = h % 12 || 12;
  return `${hr}:${String(m).padStart(2, '0')} ${ampm}`;
}

export async function generateMetadata() {
  const n = await getPlatformName();
  return { title: `Payment · ${n}` };
}

export default async function PayPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { t: token, returnUrl } = await searchParams;
  const platformName = await getPlatformName();

  if (!token || !verifyPayToken(id, token)) notFound();

  // Fetch invoice + student name
  const inv = await db.query(
    `SELECT i.*, pu.full_name AS student_name, up.grade, up.board
     FROM invoices i
     LEFT JOIN portal_users pu ON pu.email = i.student_email
     LEFT JOIN user_profiles up ON up.email = i.student_email
     WHERE i.id = $1`,
    [id],
  );
  if (inv.rows.length === 0) notFound();

  const invoice = inv.rows[0] as Record<string, unknown>;
  const status = invoice.status as string;
  const amountPaise = Number(invoice.amount_paise);
  const currency = String(invoice.currency || 'INR');
  const amount = formatAmount(amountPaise, currency);
  const studentName = String(invoice.student_name || invoice.student_email);
  const studentEmail = String(invoice.student_email);
  const invoiceNumber = String(invoice.invoice_number);
  const grade = invoice.grade ? `Grade ${invoice.grade}` : null;
  const board = invoice.board ? String(invoice.board) : null;
  const paidAt = invoice.paid_at
    ? new Date(String(invoice.paid_at)).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : null;
  const dueDate = invoice.due_date
    ? new Date(String(invoice.due_date)).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : '';

  // Fetch session line items (if session_group invoice)
  type SessionItem = { subject: string; scheduled_date: string; start_time: string; duration_minutes: number; amount_paise: number; status: string };
  let sessionItems: SessionItem[] = [];
  if (invoice.schedule_group_id) {
    const spRes = await db.query(
      `SELECT bs.subject, bs.scheduled_date, bs.start_time, bs.duration_minutes,
              sp.amount_paise, sp.status
       FROM session_payments sp
       JOIN batch_sessions bs ON bs.session_id = sp.batch_session_id
       WHERE sp.invoice_id = $1
       ORDER BY bs.scheduled_date, bs.start_time`,
      [id],
    );
    sessionItems = spRes.rows as SessionItem[];
  }

  // Group sessions by subject for summary
  const subjectGroups: Record<string, { count: number; totalPaise: number; color: string }> = {};
  for (const s of sessionItems) {
    if (!subjectGroups[s.subject]) subjectGroups[s.subject] = { count: 0, totalPaise: 0, color: subjectColor(s.subject) };
    subjectGroups[s.subject].count++;
    subjectGroups[s.subject].totalPaise += s.amount_paise;
  }

  const isPaid = status === 'paid';
  const isOverdue = status === 'overdue';

  return (
    <div className="min-h-screen bg-[#f0faf7] flex flex-col">

      {/* ── Header ── */}
      <div className="relative bg-gradient-to-br from-teal-600 via-teal-700 to-emerald-800 px-5 pt-12 pb-16 overflow-hidden">
        {/* Decorative circles */}
        <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-white/5" />
        <div className="absolute top-4 right-8 w-20 h-20 rounded-full bg-white/5" />
        <div className="absolute -bottom-6 -left-6 w-32 h-32 rounded-full bg-teal-500/20" />

        {/* Brand */}
        <div className="relative flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-lg">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <div>
            <p className="text-white font-bold text-base leading-none">{platformName}</p>
            <p className="text-teal-200 text-[11px] mt-0.5">Learning Academy</p>
          </div>
          <div className="ml-auto flex items-center gap-1.5 bg-white/10 backdrop-blur-sm rounded-full px-3 py-1">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-300" />
            <span className="text-white/80 text-[10px] font-medium">Secured</span>
          </div>
        </div>

        {/* Amount hero */}
        <div className="relative text-center">
          <p className="text-teal-200 text-sm font-medium mb-1">Amount Due</p>
          <p className="text-5xl font-black text-white tracking-tight">{amount}</p>
          {dueDate && !isPaid && (
            <div className={`inline-flex items-center gap-1.5 mt-3 rounded-full px-3 py-1 text-xs font-semibold ${
              isOverdue ? 'bg-red-500/30 text-red-100' : 'bg-white/15 text-teal-100'
            }`}>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {isOverdue ? 'Overdue · ' : 'Due '}{dueDate}
            </div>
          )}
          {isPaid && (
            <div className="inline-flex items-center gap-1.5 mt-3 rounded-full bg-emerald-400/20 px-3 py-1 text-xs font-semibold text-emerald-100">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
              Paid{paidAt ? ` · ${paidAt}` : ''}
            </div>
          )}
        </div>
      </div>

      {/* ── Main Card (floats over header) ── */}
      <div className="relative -mt-8 mx-3 flex-1 pb-32">
        <div className="bg-white rounded-3xl shadow-xl shadow-teal-900/10 overflow-hidden border border-gray-100">

          {/* Student Info */}
          <div className="px-5 pt-5 pb-4 flex items-center gap-3 border-b border-gray-100">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-600 text-white flex items-center justify-center text-base font-bold shadow-sm">
              {studentName.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-gray-900 truncate">{studentName}</p>
              <p className="text-xs text-gray-400 truncate">{studentEmail}</p>
            </div>
            {(grade || board) && (
              <div className="text-right">
                {grade && <p className="text-xs font-semibold text-teal-700 bg-teal-50 border border-teal-100 rounded-lg px-2 py-0.5">{grade}</p>}
                {board && <p className="text-[10px] text-gray-400 mt-0.5 text-center">{board}</p>}
              </div>
            )}
          </div>

          {/* Invoice Meta */}
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Invoice</p>
              <p className="text-sm font-bold text-gray-800 font-mono mt-0.5">{invoiceNumber}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Status</p>
              <span className={`inline-block mt-0.5 text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                isPaid ? 'bg-emerald-100 text-emerald-700' :
                isOverdue ? 'bg-red-100 text-red-700' :
                'bg-amber-100 text-amber-700'
              }`}>
                {isPaid ? 'Paid' : isOverdue ? 'Overdue' : 'Pending'}
              </span>
            </div>
          </div>

          {/* Subject Summary Pills */}
          {Object.keys(subjectGroups).length > 0 && (
            <div className="px-5 py-3.5 border-b border-gray-100">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2.5">Sessions Included</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(subjectGroups).map(([subject, info]) => (
                  <div
                    key={subject}
                    className="flex items-center gap-1.5 rounded-full px-3 py-1.5 border text-[11px] font-semibold"
                    style={{ borderColor: info.color + '33', backgroundColor: info.color + '12', color: info.color }}
                  >
                    <span>{info.count}×</span>
                    <span>{subject}</span>
                    <span className="opacity-60">·</span>
                    <span>₹{(info.totalPaise / 100).toLocaleString('en-IN')}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Session Line Items */}
          {sessionItems.length > 0 && (
            <div className="px-5 py-4 border-b border-gray-100">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Session Details</p>
              <div className="space-y-2">
                {sessionItems.map((s, i) => {
                  const color = subjectColor(s.subject);
                  const initial = subjectInitial(s.subject);
                  const isPrepaid = s.status === 'prepaid';
                  return (
                    <div key={i} className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold text-white shrink-0 shadow-sm"
                        style={{ backgroundColor: color }}
                      >
                        {initial}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-800">{s.subject}</p>
                        <p className="text-[11px] text-gray-400">
                          {fmtDate(String(s.scheduled_date))} · {fmtTime(String(s.start_time))} · {s.duration_minutes}min
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        {isPrepaid ? (
                          <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">Prepaid</span>
                        ) : (
                          <p className="text-sm font-bold text-gray-800">₹{(s.amount_paise / 100).toLocaleString('en-IN')}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Total Row */}
          <div className="px-5 py-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-500">Total Amount</span>
              <span className="text-xl font-black text-gray-900">{amount}</span>
            </div>
          </div>

          {/* Paid state inside card */}
          {isPaid && (
            <div className="mx-5 mb-5 rounded-2xl bg-emerald-50 border border-emerald-200 p-5 text-center">
              <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-3">
                <svg className="w-7 h-7 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-emerald-700 font-bold text-base">Payment Complete</p>
              <p className="text-emerald-600/70 text-sm mt-1">A receipt has been sent to your email.</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Sticky Pay Button ── */}
      {!isPaid && (
        <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-gray-200 px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] z-50">
          <PayClient
            invoiceId={id}
            token={token}
            amount={amount}
            studentName={studentName}
            returnUrl={returnUrl}
          />
          {/* Trust Row */}
          <div className="flex items-center justify-center gap-2 mt-3">
            <svg className="w-3 h-3 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <span className="text-gray-400 text-[11px]">256-bit SSL &middot; Powered by Razorpay</span>
          </div>
          {/* Payment method logos */}
          <div className="flex items-center justify-center gap-2 mt-2.5">
            {/* UPI */}
            <div className="h-6 px-2 bg-white border border-gray-200 rounded-md flex items-center justify-center shadow-sm">
              <svg viewBox="0 0 60 22" className="h-3.5 w-auto" fill="none" xmlns="http://www.w3.org/2000/svg">
                <text x="0" y="16" fontFamily="Arial" fontWeight="800" fontSize="16" fill="#097939">U</text>
                <text x="12" y="16" fontFamily="Arial" fontWeight="800" fontSize="16" fill="#ed1c24">P</text>
                <text x="24" y="16" fontFamily="Arial" fontWeight="800" fontSize="16" fill="#000080">I</text>
              </svg>
            </div>
            {/* Visa */}
            <div className="h-6 px-2.5 bg-[#1a1f71] border border-[#1a1f71] rounded-md flex items-center justify-center shadow-sm">
              <svg viewBox="0 0 48 16" className="h-3 w-auto" fill="none" xmlns="http://www.w3.org/2000/svg">
                <text x="0" y="13" fontFamily="Arial" fontWeight="900" fontSize="15" fill="white" fontStyle="italic" letterSpacing="-1">VISA</text>
              </svg>
            </div>
            {/* Mastercard */}
            <div className="h-6 px-2 bg-white border border-gray-200 rounded-md flex items-center gap-0.5 shadow-sm">
              <div className="w-4 h-4 rounded-full bg-[#eb001b] opacity-90" />
              <div className="w-4 h-4 rounded-full bg-[#f79e1b] -ml-2 opacity-90" />
            </div>
            {/* RuPay */}
            <div className="h-6 px-2 bg-white border border-gray-200 rounded-md flex items-center justify-center shadow-sm">
              <svg viewBox="0 0 58 18" className="h-3 w-auto" fill="none" xmlns="http://www.w3.org/2000/svg">
                <text x="0" y="14" fontFamily="Arial" fontWeight="800" fontSize="13" fill="#003399">Ru</text>
                <text x="22" y="14" fontFamily="Arial" fontWeight="800" fontSize="13" fill="#e30613">Pay</text>
              </svg>
            </div>
            {/* Razorpay */}
            <div className="h-6 px-2 bg-[#2d64f6] border border-[#2d64f6] rounded-md flex items-center gap-1 shadow-sm">
              <svg viewBox="0 0 14 18" className="h-3.5 w-auto" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M9.5 0L3 11h4.5L5 18l9-11H9L12.5 0H9.5z" fill="white" />
              </svg>
              <span className="text-white text-[9px] font-bold tracking-wide">razorpay</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
