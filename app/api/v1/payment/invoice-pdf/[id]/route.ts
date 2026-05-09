import { NextRequest, NextResponse } from 'next/server';
import { verifySession, COOKIE_NAME } from '@/lib/session';
import { verifyPayToken, buildPayUrl } from '@/lib/pay-token';
import { db } from '@/lib/db';
import { getLogoDataUri } from '@/lib/pdf-logo';
import { parseDescription } from '@/lib/invoice-description';
import { getPlatformName } from '@/lib/platform-config';

/* ─── Helpers ──────────────────────────────────────────── */
const CUR: Record<string, string> = { INR: '₹', AED: 'د.إ', SAR: 'ر.س', QAR: 'ر.ق', KWD: 'د.ك', OMR: 'ر.ع.', BHD: '.د.ب', USD: '$' };
function amt(p: number, c = 'INR') { return `${CUR[c] || c} ${(p / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`; }
function dt(d: string | null) { return d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'; }
function esc(s: string) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

interface InvoiceRow {
  id: string; invoice_number: string; student_email: string; parent_email: string | null;
  description: string | null; billing_period: string; period_start: string; period_end: string;
  amount_paise: number; currency: string; status: string; due_date: string;
  paid_at: string | null; payment_method: string | null; transaction_id: string | null;
  created_at: string; student_name?: string; [k: string]: unknown;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    // ── Auth: session cookie OR HMAC pay token (?t=...) ──────
    const payToken = req.nextUrl.searchParams.get('t');
    let isPublicAccess = false;

    if (payToken) {
      // Token-based access (from WhatsApp / public links)
      if (!verifyPayToken(id, payToken)) {
        return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 403 });
      }
      isPublicAccess = true;
    } else {
      // Session-based access (logged-in users)
      const sessionToken = req.cookies.get(COOKIE_NAME)?.value;
      if (!sessionToken) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
      const user = await verifySession(sessionToken);
      if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { rows } = await db.query<InvoiceRow>(
      `SELECT i.*, pu.full_name AS student_name FROM invoices i LEFT JOIN portal_users pu ON pu.email = i.student_email WHERE i.id = $1`, [id]
    );
    if (rows.length === 0) return NextResponse.json({ success: false, error: 'Invoice not found' }, { status: 404 });
    const inv = rows[0];

    let receipt: { receipt_number: string; payment_method: string | null; transaction_id: string | null; [k: string]: unknown } | null = null;
    if (inv.status === 'paid') {
      const rRes = await db.query<{ receipt_number: string; payment_method: string | null; transaction_id: string | null; [k: string]: unknown }>(`SELECT * FROM payment_receipts WHERE invoice_id = $1 LIMIT 1`, [id]);
      if (rRes.rows.length > 0) receipt = rRes.rows[0];
    }

    // Individual session rows for session_group invoices
    type SessionRow = { subject: string; scheduled_date: string; start_time: string; duration_minutes: number; amount_paise: number; status: string };
    let sessionRows: SessionRow[] = [];
    // Grouped summary (for legacy fallback path)
    let lineItems: Array<{ subject: string; count: number; dur: number; rate: number; total: number }> = [];

    if (inv.billing_period === 'session_group') {
      const sp = await db.query(
        `SELECT bs.subject, bs.scheduled_date, bs.start_time, bs.duration_minutes, sp.amount_paise, sp.status
         FROM session_payments sp
         JOIN batch_sessions bs ON bs.session_id = sp.batch_session_id
         WHERE sp.invoice_id = $1 ORDER BY bs.scheduled_date, bs.start_time`, [id]
      );
      sessionRows = sp.rows as SessionRow[];

      // Also build grouped summary
      const m = new Map<string, { count: number; dur: number; total: number }>();
      for (const r of sessionRows) {
        const e = m.get(r.subject);
        if (e) { e.count++; e.total += r.amount_paise; }
        else m.set(r.subject, { count: 1, dur: r.duration_minutes, total: r.amount_paise });
      }
      lineItems = Array.from(m.entries()).map(([s, g]) => ({
        subject: s, count: g.count, dur: g.dur,
        rate: Math.round(g.total / g.count / (g.dur / 60)), total: g.total,
      }));
    }

    const isPaid = inv.status === 'paid';
    const isOverdue = inv.status === 'overdue';
    const name = inv.student_name || inv.student_email;
    const logoSrc = getLogoDataUri();
    const platformName = await getPlatformName();

    // Parse description for fallback path (non-session-group invoices with pipe-delimited descriptions)
    const parsedDesc = lineItems.length === 0 ? parseDescription(inv.description) : null;

    // Subject colour map
    const SUBJ_COLORS: Record<string, string> = {
      Mathematics: '#6366f1', Math: '#6366f1', Physics: '#0ea5e9', Chemistry: '#f59e0b',
      Biology: '#10b981', English: '#8b5cf6', Hindi: '#ec4899', History: '#f97316',
      Geography: '#14b8a6', Science: '#06b6d4', 'Social Science': '#a855f7',
      'Special Class': '#64748b', 'Exam Special': '#ef4444',
    };
    function subColor(s: string) { return SUBJ_COLORS[s] || '#0d9488'; }
    function subInitial(s: string) { return (s || '?').charAt(0).toUpperCase(); }
    function fmtDate(d: string) {
      return new Date(d).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
    }
    function fmtTime(t: string) {
      const [h, m] = t.split(':').map(Number);
      return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
    }

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${isPaid ? 'Receipt' : 'Invoice'} — ${esc(inv.invoice_number)}</title>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:13px;color:#1f2937;background:#f0faf7;-webkit-print-color-adjust:exact;print-color-adjust:exact}
@media print{body{background:#fff}.no-print{display:none!important}.page{box-shadow:none!important;margin:0!important;border-radius:0!important}}
.page{max-width:680px;margin:24px auto 40px;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08)}

/* ── Header ─────────────────────────────── */
.hdr{background:linear-gradient(135deg,#0d9488 0%,#0f766e 50%,#065f46 100%);padding:32px 36px 44px;position:relative;overflow:hidden}
.hdr::before{content:'';position:absolute;top:-30px;right:-30px;width:160px;height:160px;border-radius:50%;background:rgba(255,255,255,.07)}
.hdr::after{content:'';position:absolute;top:10px;right:80px;width:60px;height:60px;border-radius:50%;background:rgba(255,255,255,.05)}
.hdr-inner{display:flex;justify-content:space-between;align-items:flex-start;position:relative;z-index:1}
.brand{display:flex;align-items:center;gap:12px}
.brand-icon{width:42px;height:42px;border-radius:12px;background:rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center}
.brand-icon img{width:28px;height:28px;border-radius:6px;object-fit:contain}
.brand-text h1{font-size:18px;font-weight:800;color:#fff;letter-spacing:-.3px}
.brand-text p{font-size:11px;color:rgba(255,255,255,.65);margin-top:1px}
.doc-info{text-align:right}
.doc-type{font-size:10px;text-transform:uppercase;letter-spacing:2px;color:rgba(255,255,255,.6);font-weight:600}
.doc-num{font-size:15px;font-weight:700;color:#fff;margin-top:3px;font-family:monospace}
.amount-hero{text-align:center;margin-top:20px;position:relative;z-index:1}
.amount-label{font-size:11px;color:rgba(255,255,255,.65);text-transform:uppercase;letter-spacing:1px;font-weight:600}
.amount-value{font-size:42px;font-weight:900;color:#fff;letter-spacing:-1.5px;margin-top:4px}
.status-pill{display:inline-flex;align-items:center;gap:6px;margin-top:10px;padding:5px 14px;border-radius:20px;font-size:11px;font-weight:700}
.pill-paid{background:rgba(52,211,153,.25);color:#a7f3d0}
.pill-pending{background:rgba(251,191,36,.2);color:#fde68a}
.pill-overdue{background:rgba(248,113,113,.25);color:#fca5a5}

/* ── Floating Card ───────────────────────── */
.card{margin:-16px 20px 0;background:#fff;border-radius:16px;box-shadow:0 2px 12px rgba(0,0,0,.06);border:1px solid #e5e7eb;overflow:hidden}

/* ── Student Row ─────────────────────────── */
.student-row{display:flex;align-items:center;gap:12px;padding:16px 20px;border-bottom:1px solid #f3f4f6}
.student-avatar{width:44px;height:44px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:800;color:#fff;flex-shrink:0;background:linear-gradient(135deg,#0d9488,#059669)}
.student-info{flex:1;min-width:0}
.student-name{font-size:14px;font-weight:700;color:#111827}
.student-email{font-size:11px;color:#9ca3af;margin-top:1px}
.student-meta{text-align:right}
.student-grade{font-size:11px;font-weight:700;color:#0d9488;background:#f0fdfa;border:1px solid #99f6e4;border-radius:6px;padding:2px 8px;display:inline-block}

/* ── Invoice Meta Row ────────────────────── */
.inv-meta{display:flex;justify-content:space-between;align-items:center;padding:12px 20px;border-bottom:1px solid #f3f4f6;background:#fafafa}
.inv-meta-item .ilabel{font-size:9px;text-transform:uppercase;letter-spacing:.8px;color:#9ca3af;font-weight:600}
.inv-meta-item .ival{font-size:12px;font-weight:700;color:#374151;margin-top:2px}
.inv-meta-item .ival.mono{font-family:monospace;font-size:11px}
.badge{display:inline-block;padding:3px 10px;border-radius:10px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px}
.badge-paid{background:#ecfdf5;color:#059669}.badge-pending{background:#fffbeb;color:#d97706}.badge-overdue{background:#fef2f2;color:#dc2626}

/* ── Section ─────────────────────────────── */
.section{padding:16px 20px;border-bottom:1px solid #f3f4f6}
.section-title{font-size:9px;text-transform:uppercase;letter-spacing:1px;color:#9ca3af;font-weight:700;margin-bottom:12px}

/* ── Subject Pills ───────────────────────── */
.pills{display:flex;flex-wrap:wrap;gap:7px}
.pill{display:inline-flex;align-items:center;gap:5px;border-radius:20px;padding:5px 11px;font-size:11px;font-weight:700;border:1.5px solid transparent}

/* ── Session Rows ────────────────────────── */
.session-row{display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px dashed #f3f4f6}
.session-row:last-child{border-bottom:none}
.subj-dot{width:32px;height:32px;border-radius:9px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;color:#fff;flex-shrink:0}
.sess-info{flex:1}
.sess-subj{font-size:12px;font-weight:700;color:#111827}
.sess-meta{font-size:10px;color:#9ca3af;margin-top:1px}
.sess-amt{font-size:13px;font-weight:700;color:#111827;text-align:right;white-space:nowrap}
.prepaid-tag{font-size:9px;font-weight:700;color:#059669;background:#ecfdf5;border:1px solid #a7f3d0;border-radius:6px;padding:2px 7px}

/* ── Fallback Table ──────────────────────── */
table.items{width:100%;border-collapse:collapse}
table.items th{font-size:9px;text-transform:uppercase;letter-spacing:.5px;color:#6b7280;font-weight:700;padding:8px 0;text-align:left;border-bottom:1.5px solid #e5e7eb}
table.items td{padding:9px 0;border-bottom:1px solid #f3f4f6;font-size:12px;color:#374151}
table.items .r{text-align:right}
table.items .amt{font-weight:700;color:#111827}

/* ── Total ───────────────────────────────── */
.total-row{display:flex;justify-content:space-between;align-items:center;padding:14px 20px;background:#f9fafb;border-bottom:1px solid #e5e7eb}
.total-label{font-size:13px;font-weight:600;color:#6b7280}
.total-val{font-size:22px;font-weight:900;color:#111827;letter-spacing:-.5px}

/* ── Payment Details ─────────────────────── */
.pay-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:16px 20px;background:#f0fdfa;border-top:2px solid #99f6e4}
.pay-cell .dlabel{font-size:9px;text-transform:uppercase;letter-spacing:.8px;color:#0d9488;font-weight:700}
.pay-cell .dval{font-size:12px;color:#065f46;font-weight:600;margin-top:2px}
.pay-cell .dval.mono{font-family:monospace;font-size:11px}

/* ── Footer ──────────────────────────────── */
.footer{padding:18px 24px;border-top:1px solid #e5e7eb;display:flex;align-items:center;justify-content:space-between;background:#fafafa}
.footer-text p{font-size:9px;color:#9ca3af;line-height:1.5}
.footer-text p strong{color:#6b7280}

/* ── Action Bar ──────────────────────────── */
.action-bar{padding:16px 24px;display:flex;justify-content:center;gap:10px;flex-wrap:wrap}
.btn-pay{background:linear-gradient(135deg,#0d9488,#059669);color:#fff;border:none;padding:11px 28px;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;text-decoration:none;display:inline-block}
.btn-print{background:#111827;color:#fff;border:none;padding:11px 28px;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer}
.btn-print:hover{background:#374151}
</style>
</head>
<body>
<div class="page">

  <!-- Header -->
  <div class="hdr">
    <div class="hdr-inner">
      <div class="brand">
        <div class="brand-icon"><img src="${logoSrc}" alt="Logo"/></div>
        <div class="brand-text"><h1>${platformName}</h1><p>Learning Academy</p></div>
      </div>
      <div class="doc-info">
        <div class="doc-type">${isPaid ? 'Receipt' : 'Invoice'}</div>
        <div class="doc-num">${esc(inv.invoice_number)}</div>
      </div>
    </div>
    <div class="amount-hero">
      <div class="amount-label">Amount ${isPaid ? 'Paid' : 'Due'}</div>
      <div class="amount-value">${amt(inv.amount_paise, inv.currency)}</div>
      <div>
        <span class="status-pill ${isPaid ? 'pill-paid' : isOverdue ? 'pill-overdue' : 'pill-pending'}">
          ${isPaid ? '✓ Paid' + (inv.paid_at ? ' · ' + dt(inv.paid_at) : '') : isOverdue ? '⚠ Overdue · Due ' + dt(inv.due_date) : '⏳ Pending · Due ' + dt(inv.due_date)}
        </span>
      </div>
    </div>
  </div>

  <!-- Floating Card -->
  <div class="card">

    <!-- Student -->
    <div class="student-row">
      <div class="student-avatar">${esc(name.charAt(0).toUpperCase())}</div>
      <div class="student-info">
        <div class="student-name">${esc(name)}</div>
        <div class="student-email">${esc(inv.student_email)}</div>
        ${inv.parent_email ? `<div style="font-size:10px;color:#9ca3af;margin-top:1px">Parent: ${esc(inv.parent_email as string)}</div>` : ''}
      </div>
    </div>

    <!-- Invoice Meta -->
    <div class="inv-meta">
      <div class="inv-meta-item">
        <div class="ilabel">Invoice No.</div>
        <div class="ival mono">${esc(inv.invoice_number)}</div>
      </div>
      <div class="inv-meta-item">
        <div class="ilabel">Issued</div>
        <div class="ival">${dt(inv.created_at)}</div>
      </div>
      <div class="inv-meta-item">
        <div class="ilabel">Status</div>
        <div class="ival"><span class="badge badge-${inv.status}">${inv.status}</span></div>
      </div>
    </div>

    ${sessionRows.length > 0 ? `
    <!-- Subject Summary Pills -->
    <div class="section">
      <div class="section-title">Sessions Included</div>
      <div class="pills">
        ${lineItems.map(li => `
        <div class="pill" style="border-color:${subColor(li.subject)}33;background:${subColor(li.subject)}12;color:${subColor(li.subject)}">
          ${li.count}× ${esc(li.subject)} · ${amt(li.total, inv.currency)}
        </div>`).join('')}
      </div>
    </div>

    <!-- Session Details -->
    <div class="section">
      <div class="section-title">Session Details</div>
      ${sessionRows.map(s => `
      <div class="session-row">
        <div class="subj-dot" style="background:${subColor(s.subject)}">${subInitial(s.subject)}</div>
        <div class="sess-info">
          <div class="sess-subj">${esc(s.subject)}</div>
          <div class="sess-meta">${fmtDate(String(s.scheduled_date))} · ${fmtTime(String(s.start_time))} · ${s.duration_minutes} min</div>
        </div>
        <div class="sess-amt">
          ${s.status === 'prepaid' ? '<span class="prepaid-tag">Prepaid</span>' : amt(s.amount_paise, inv.currency)}
        </div>
      </div>`).join('')}
    </div>
    ` : parsedDesc ? `
    <div class="section">
      <div class="section-title">${esc(parsedDesc.header)}</div>
      <table class="items">
        <thead><tr><th>Subject</th><th class="r">Sessions</th><th class="r">Rate</th><th class="r">Amount</th></tr></thead>
        <tbody>
          ${parsedDesc.items.map(li => `<tr>
            <td>${esc(li.subject)}</td><td class="r">${esc(li.sessions)}</td>
            <td class="r">${esc(li.rate)}</td><td class="r amt">${esc(li.total)}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
    ` : `
    <div class="section">
      <div class="section-title">Description</div>
      <p style="font-size:13px;color:#374151;line-height:1.6">${esc(inv.description || 'Tuition Fee')}</p>
      <p style="font-size:11px;color:#9ca3af;margin-top:6px">Period: ${dt(inv.period_start)} – ${dt(inv.period_end)}</p>
    </div>
    `}

    <!-- Total -->
    <div class="total-row">
      <span class="total-label">Total Amount</span>
      <span class="total-val">${amt(inv.amount_paise, inv.currency)}</span>
    </div>

    ${isPaid && receipt ? `
    <!-- Payment Details -->
    <div class="pay-grid">
      <div class="pay-cell"><div class="dlabel">Receipt No.</div><div class="dval">${esc(receipt.receipt_number)}</div></div>
      <div class="pay-cell"><div class="dlabel">Payment Date</div><div class="dval">${dt(inv.paid_at)}</div></div>
      <div class="pay-cell"><div class="dlabel">Method</div><div class="dval">${esc(inv.payment_method || receipt.payment_method as string || 'Online')}</div></div>
      <div class="pay-cell"><div class="dlabel">Transaction Ref</div><div class="dval mono">${esc(inv.transaction_id || receipt.transaction_id as string || '—')}</div></div>
    </div>` : ''}

  </div><!-- /card -->

  <!-- Footer -->
  <div class="footer" style="margin:0 20px;border-radius:0 0 12px 12px;border:1px solid #e5e7eb;border-top:none">
    <div class="footer-text">
      <p>Computer-generated document. No signature required.</p>
      <p><strong>${platformName} Learning Academy</strong> · stibelearning.online</p>
    </div>
  </div>

  <!-- Action Bar -->
  <div class="action-bar no-print">
    ${!isPaid && isPublicAccess ? `<a href="${esc(buildPayUrl(inv.id))}" class="btn-pay">Pay Now — ${amt(inv.amount_paise, inv.currency)}</a>` : ''}
    <button class="btn-print" onclick="window.print()">Print / Save as PDF</button>
  </div>

</div>
</body>
</html>`;

    return new NextResponse(html, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  } catch (err) {
    console.error('[invoice-pdf] error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
