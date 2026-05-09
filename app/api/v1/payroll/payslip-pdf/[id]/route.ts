// ═══════════════════════════════════════════════════════════════
// Payslip PDF — GET /api/v1/payroll/payslip-pdf/[id]
// Renders a clean light-themed payslip matching the invoice design
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { verifySession, COOKIE_NAME } from '@/lib/session';
import { db } from '@/lib/db';
import { getLogoDataUri } from '@/lib/pdf-logo';
import { getPlatformName } from '@/lib/platform-config';

const CUR: Record<string, string> = { INR: '₹', AED: 'د.إ', SAR: 'ر.س', QAR: 'ر.ق', KWD: 'د.ك', OMR: 'ر.ع.', BHD: '.د.ب', USD: '$' };
function amt(p: number) { return `${CUR.INR} ${(p / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`; }
function dt(d: string | null) { return d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'; }
function esc(s: string) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

interface PayslipRow {
  id: string;
  payroll_period_id: string;
  teacher_email: string;
  classes_conducted: number;
  classes_missed: number;
  classes_cancelled: number;
  rate_per_class: number;
  base_pay_paise: number;
  incentive_paise: number;
  lop_paise: number;
  total_paise: number;
  medical_leave_adjustment_paise: number;
  status: string;
  created_at: string;
  teacher_name?: string;
  period_label?: string;
  period_start?: string;
  period_end?: string;
  [k: string]: unknown;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    const user = await verifySession(token);
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;

    const { rows } = await db.query<PayslipRow>(
      `SELECT ps.*, pu.full_name AS teacher_name,
              pp.period_label, pp.period_start, pp.period_end
       FROM payslips ps
       LEFT JOIN portal_users pu ON pu.email = ps.teacher_email
       LEFT JOIN payroll_periods pp ON pp.id = ps.payroll_period_id
       WHERE ps.id = $1`,
      [id]
    );

    if (rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Payslip not found' }, { status: 404 });
    }
    const ps = rows[0];

    // Teachers can only view their own payslips
    if (user.role === 'teacher' && ps.teacher_email !== user.id) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }
    if (!['owner', 'hr', 'academic_operator', 'teacher'].includes(user.role)) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const name = ps.teacher_name || ps.teacher_email;
    const isPaid = ps.status === 'paid';
    const logoSrc = getLogoDataUri();
    const platformName = await getPlatformName();

    // Earnings & deductions breakdown
    const earnings = [
      { label: 'Base Pay', detail: `${ps.classes_conducted} classes × ${amt(ps.rate_per_class)}`, amount: ps.base_pay_paise },
    ];
    if (ps.incentive_paise > 0) {
      earnings.push({ label: 'Incentive Bonus', detail: 'Performance incentive', amount: ps.incentive_paise });
    }
    if ((ps.medical_leave_adjustment_paise || 0) > 0) {
      earnings.push({ label: 'Medical Leave Adjustment', detail: 'Sick leave with certificate', amount: ps.medical_leave_adjustment_paise });
    }
    const grossPaise = earnings.reduce((s, e) => s + e.amount, 0);

    const deductions: Array<{ label: string; detail: string; amount: number }> = [];
    if (ps.lop_paise > 0) {
      deductions.push({ label: 'Loss of Pay (LOP)', detail: `${ps.classes_missed} missed classes`, amount: ps.lop_paise });
    }
    const totalDeductions = deductions.reduce((s, d) => s + d.amount, 0);

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Payslip — ${esc(ps.period_label || '')} — ${esc(name)}</title>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:13px;color:#1f2937;background:#f9fafb}
.page{max-width:780px;margin:20px auto;background:#fff;border-radius:6px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.06),0 1px 2px rgba(0,0,0,.04)}
@media print{body{background:#fff}.page{margin:0;box-shadow:none;border-radius:0}.no-print{display:none!important}}
.hdr{padding:32px 36px 28px;border-bottom:1px solid #e5e7eb;display:flex;justify-content:space-between;align-items:flex-start}
.logo-block{display:flex;align-items:center;gap:14px}
.logo-box{background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:4px;display:inline-flex;align-items:center;justify-content:center;line-height:0}
.logo-box img{display:block;width:auto;border-radius:5px}
.brand h1{font-size:18px;font-weight:700;color:#111827;letter-spacing:-.3px}
.brand p{font-size:11px;color:#9ca3af;margin-top:1px}
.doc-tag{text-align:right}
.doc-tag .type{font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:#6b7280;font-weight:600}
.doc-tag .num{font-size:14px;font-weight:700;color:#111827;margin-top:2px}
.body{padding:28px 36px 32px}
.meta{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:28px}
.meta-col .label{font-size:10px;text-transform:uppercase;letter-spacing:.8px;color:#9ca3af;font-weight:600;margin-bottom:5px}
.meta-col .val{font-size:13px;color:#374151;line-height:1.6}
.meta-col .val strong{color:#111827}
.badge{display:inline-block;padding:3px 10px;border-radius:12px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px}
.badge-paid{background:#ecfdf5;color:#059669}.badge-draft{background:#eff6ff;color:#3b82f6}.badge-finalized{background:#fffbeb;color:#d97706}
.section-title{font-size:11px;text-transform:uppercase;letter-spacing:.8px;color:#6b7280;font-weight:600;margin:0 0 10px;padding-bottom:6px;border-bottom:1px solid #f3f4f6}
table.items{width:100%;border-collapse:collapse;margin-bottom:20px}
table.items th{font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:#6b7280;font-weight:600;padding:8px 12px;text-align:left;border-bottom:2px solid #e5e7eb;background:#fafafa}
table.items td{padding:10px 12px;border-bottom:1px solid #f3f4f6;font-size:13px;color:#374151}
table.items .r{text-align:right}
table.items .amt{font-weight:600;color:#111827}
table.items .sub{font-size:11px;color:#9ca3af;display:block;margin-top:1px}
.summary{display:grid;grid-template-columns:1fr auto;gap:4px 24px;margin-top:20px;padding:16px 20px;background:#f9fafb;border-radius:6px;border:1px solid #e5e7eb}
.summary .lbl{font-size:12px;color:#6b7280}
.summary .val{font-size:13px;font-weight:600;color:#374151;text-align:right}
.summary .total .lbl{font-size:13px;font-weight:700;color:#111827}
.summary .total .val{font-size:16px;font-weight:700;color:#111827}
.divider{height:1px;background:#e5e7eb;margin:8px 0}
.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:28px}
.stat{padding:14px 16px;background:#f9fafb;border-radius:6px;border:1px solid #f3f4f6;text-align:center}
.stat .num{font-size:22px;font-weight:700;color:#111827}
.stat .lbl{font-size:10px;text-transform:uppercase;letter-spacing:.6px;color:#9ca3af;margin-top:2px}
.ft{padding:20px 36px;border-top:1px solid #e5e7eb;text-align:center}
.ft p{font-size:10px;color:#9ca3af;line-height:1.5}
.print-bar{text-align:center;padding:14px}
.print-btn{background:#111827;color:#fff;border:none;padding:9px 24px;border-radius:5px;font-size:13px;font-weight:600;cursor:pointer}
.print-btn:hover{background:#374151}
</style>
</head>
<body>
<div class="page">
  <div class="hdr">
    <div class="logo-block">
      <div class="logo-box"><img src="${logoSrc}" alt="Logo" height="36"/></div>
      <div class="brand"><h1>${platformName}</h1><p>Online Classes</p></div>
    </div>
    <div class="doc-tag">
      <div class="type">Payslip</div>
      <div class="num">${esc(ps.period_label || 'Payslip')}</div>
    </div>
  </div>

  <div class="body">
    <div class="meta">
      <div class="meta-col">
        <div class="label">Employee</div>
        <div class="val">
          <strong>${esc(name)}</strong><br/>${esc(ps.teacher_email)}
        </div>
      </div>
      <div class="meta-col" style="text-align:right">
        <div class="label">Pay Period</div>
        <div class="val">
          ${dt(ps.period_start || null)} — ${dt(ps.period_end || null)}<br/>
          <span class="badge badge-${ps.status}">${ps.status}</span>
        </div>
      </div>
    </div>

    <div class="stats">
      <div class="stat"><div class="num">${ps.classes_conducted}</div><div class="lbl">Conducted</div></div>
      <div class="stat"><div class="num">${ps.classes_missed}</div><div class="lbl">Missed</div></div>
      <div class="stat"><div class="num">${ps.classes_cancelled}</div><div class="lbl">Cancelled</div></div>
    </div>

    <div class="section-title">Earnings</div>
    <table class="items">
      <thead><tr><th>Component</th><th class="r">Amount</th></tr></thead>
      <tbody>
        ${earnings.map(e => `<tr><td>${esc(e.label)}<span class="sub">${esc(e.detail)}</span></td><td class="r amt">${amt(e.amount)}</td></tr>`).join('')}
        <tr style="background:#f9fafb"><td class="r" style="font-weight:600;color:#374151">Gross Earnings</td><td class="r amt">${amt(grossPaise)}</td></tr>
      </tbody>
    </table>

    ${deductions.length > 0 ? `
    <div class="section-title">Deductions</div>
    <table class="items">
      <thead><tr><th>Component</th><th class="r">Amount</th></tr></thead>
      <tbody>
        ${deductions.map(d => `<tr><td>${esc(d.label)}<span class="sub">${esc(d.detail)}</span></td><td class="r amt">- ${amt(d.amount)}</td></tr>`).join('')}
        <tr style="background:#f9fafb"><td class="r" style="font-weight:600;color:#374151">Total Deductions</td><td class="r amt">- ${amt(totalDeductions)}</td></tr>
      </tbody>
    </table>
    ` : ''}

    <div class="summary">
      <div class="lbl">Gross Earnings</div><div class="val">${amt(grossPaise)}</div>
      ${totalDeductions > 0 ? `<div class="lbl">Total Deductions</div><div class="val">- ${amt(totalDeductions)}</div>` : ''}
      <div class="divider" style="grid-column:1/-1"></div>
      <div class="total"><div class="lbl">Net Pay</div></div>
      <div class="total"><div class="val">${amt(ps.total_paise)}</div></div>
    </div>
  </div>

  <div class="ft">
    <p>This is a computer-generated payslip. No signature required.</p>
    <p>${platformName} Online Classes · stibelearning.online</p>
  </div>
  <div class="print-bar no-print"><button class="print-btn" onclick="window.print()">Print / Save as PDF</button></div>
</div>
</body>
</html>`;

    return new NextResponse(html, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  } catch (err) {
    console.error('[payslip-pdf] error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
