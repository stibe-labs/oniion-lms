// ═══════════════════════════════════════════════════════════════
// Invoice/Receipt PDF API — GET /api/v1/payment/receipt/[id]
// Generates a printable HTML receipt/invoice page
// Can be printed from browser as PDF (Ctrl+P → Save as PDF)
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifySession, COOKIE_NAME } from '@/lib/session';
import { formatAmount } from '@/lib/payment';
import { getLogoDataUri } from '@/lib/pdf-logo';
import { parseDescription } from '@/lib/invoice-description';
import { getPlatformName } from '@/lib/platform-config';

/* ─── Helpers ──────────────────────────────────────────── */
function dt(d: string | null | unknown) { return d ? new Date(String(d)).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'; }
function esc(s: string) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

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
    const type = new URL(req.url).searchParams.get('type') || 'invoice';

    if (type === 'receipt') {
      // Fetch receipt
      const receiptResult = await db.query(
        `SELECT pr.*, i.invoice_number, i.description, i.billing_period,
                i.period_start, i.period_end, i.due_date,
                pu.full_name AS student_name
         FROM payment_receipts pr
         JOIN invoices i ON i.id = pr.invoice_id
         LEFT JOIN portal_users pu ON pu.email = pr.student_email
         WHERE pr.id = $1`,
        [id]
      );

      if (receiptResult.rows.length === 0) {
        return NextResponse.json({ success: false, error: 'Receipt not found' }, { status: 404 });
      }

      const receipt = receiptResult.rows[0] as Record<string, unknown>;

      // Verify access
      if (user.role === 'student' && receipt.student_email !== user.id) {
        return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
      }

      const platformName = await getPlatformName();
      const html = generateReceiptHTML(receipt, platformName);
      return new NextResponse(html, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    // Fetch invoice
    const invoiceResult = await db.query(
      `SELECT i.*, pu.full_name AS student_name
       FROM invoices i
       LEFT JOIN portal_users pu ON pu.email = i.student_email
       WHERE i.id = $1`,
      [id]
    );

    if (invoiceResult.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Invoice not found' }, { status: 404 });
    }

    const invoice = invoiceResult.rows[0] as Record<string, unknown>;

    // Verify access
    if (user.role === 'student' && invoice.student_email !== user.id) {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
    }
    if (user.role === 'parent') {
      const childCheck = await db.query(
        `SELECT 1 FROM user_profiles WHERE email = $1 AND parent_email = $2`,
        [invoice.student_email, user.id]
      );
      if (childCheck.rows.length === 0) {
        return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
      }
    }

    const platformName = await getPlatformName();
    const html = generateInvoiceHTML(invoice, platformName);
    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  } catch (err) {
    console.error('[payment/receipt] GET error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

function generateInvoiceHTML(invoice: Record<string, unknown>, platformName: string): string {
  const amount = formatAmount(Number(invoice.amount_paise || 0), String(invoice.currency || 'INR'));
  const status = String(invoice.status || 'pending');
  const name = String(invoice.student_name || invoice.student_email);
  const logoSrc = getLogoDataUri();
  const parsed = parseDescription(String(invoice.description || ''));

  const descriptionTable = parsed ? `
    <table class="items">
      <thead><tr><th>Subject</th><th class="r">Sessions</th><th class="r">Rate</th><th class="r">Amount</th></tr></thead>
      <tbody>
        ${parsed.items.map(li => `<tr>
          <td>${esc(li.subject)}</td><td class="r">${esc(li.sessions)}</td>
          <td class="r">${esc(li.rate)}</td><td class="r amt">${esc(li.total)}</td>
        </tr>`).join('')}
        <tr class="total-row"><td colspan="3" class="r">Total</td><td class="r amt">${esc(amount)}</td></tr>
      </tbody>
    </table>
    <p style="font-size:11px;color:#9ca3af;margin-top:8px">${esc(parsed.header)}</p>
  ` : `
    <table class="items">
      <thead><tr><th>Description</th><th>Period</th><th class="r">Amount</th></tr></thead>
      <tbody>
        <tr><td>${esc(String(invoice.description || 'Tuition Fee'))}</td><td>${dt(invoice.period_start)} – ${dt(invoice.period_end)}</td><td class="r amt">${esc(amount)}</td></tr>
        <tr class="total-row"><td colspan="2" class="r">Total</td><td class="r amt">${esc(amount)}</td></tr>
      </tbody>
    </table>
  `;

  return pageShell(`Invoice ${invoice.invoice_number}`, `
  <div class="hdr">
    <div class="logo-block">
      <div class="logo-box"><img src="${logoSrc}" alt="Logo" height="36"/></div>
      <div class="brand"><h1>${platformName}</h1><p>Online Classes</p></div>
    </div>
    <div class="doc-tag">
      <div class="type">Invoice</div>
      <div class="num">${esc(String(invoice.invoice_number || ''))}</div>
    </div>
  </div>
  <div class="body">
    <div class="meta">
      <div class="meta-col">
        <div class="label">Billed To</div>
        <div class="val">
          <strong>${esc(name)}</strong><br/>${esc(String(invoice.student_email))}
          ${invoice.parent_email ? `<br/><span style="color:#9ca3af;font-size:11px">Parent: ${esc(String(invoice.parent_email))}</span>` : ''}
        </div>
      </div>
      <div class="meta-col" style="text-align:right">
        <div class="label">Details</div>
        <div class="val">
          Date: ${dt(invoice.created_at)}<br/>
          Due: ${dt(invoice.due_date)}<br/>
          <span class="badge badge-${status}">${status}</span>
        </div>
      </div>
    </div>
    ${descriptionTable}
  </div>
  <div class="ft">
    <p>This is a computer-generated document. No signature required.</p>
    <p>${platformName} Online Classes · stibelearning.online</p>
  </div>`);
}

function generateReceiptHTML(receipt: Record<string, unknown>, platformName: string): string {
  const amount = formatAmount(Number(receipt.amount_paise || 0), String(receipt.currency || 'INR'));
  const name = String(receipt.student_name || receipt.student_email);
  const logoSrc = getLogoDataUri();
  const parsed = parseDescription(String(receipt.description || ''));

  const descriptionTable = parsed ? `
    <table class="items">
      <thead><tr><th>Subject</th><th class="r">Sessions</th><th class="r">Rate</th><th class="r">Amount</th></tr></thead>
      <tbody>
        ${parsed.items.map(li => `<tr>
          <td>${esc(li.subject)}</td><td class="r">${esc(li.sessions)}</td>
          <td class="r">${esc(li.rate)}</td><td class="r amt">${esc(li.total)}</td>
        </tr>`).join('')}
        <tr class="total-row"><td colspan="3" class="r">Total Paid</td><td class="r amt">${esc(amount)}</td></tr>
      </tbody>
    </table>
    <p style="font-size:11px;color:#9ca3af;margin-top:8px">${esc(parsed.header)}</p>
  ` : `
    <table class="items">
      <thead><tr><th>Description</th><th>Period</th><th class="r">Amount</th></tr></thead>
      <tbody>
        <tr><td>${esc(String(receipt.description || 'Tuition Fee'))}</td><td>${dt(receipt.period_start)} – ${dt(receipt.period_end)}</td><td class="r amt">${esc(amount)}</td></tr>
        <tr class="total-row"><td colspan="2" class="r">Total Paid</td><td class="r amt">${esc(amount)}</td></tr>
      </tbody>
    </table>
  `;

  return pageShell(`Receipt ${receipt.receipt_number}`, `
  <div class="hdr">
    <div class="logo-block">
      <div class="logo-box"><img src="${logoSrc}" alt="Logo" height="36"/></div>
      <div class="brand"><h1>${platformName}</h1><p>Online Classes</p></div>
    </div>
    <div class="doc-tag">
      <div class="type">Payment Receipt</div>
      <div class="num">${esc(String(receipt.receipt_number || ''))}</div>
    </div>
  </div>
  <div class="body">
    <div class="paid-banner">
      <span style="font-size:20px">&#10004;</span>
      <div>
        <div class="paid-title">Payment Successful</div>
        <div class="paid-amount">${esc(amount)}</div>
      </div>
    </div>
    <div class="meta">
      <div class="meta-col">
        <div class="label">Student</div>
        <div class="val">
          <strong>${esc(name)}</strong><br/>${esc(String(receipt.student_email))}
        </div>
      </div>
      <div class="meta-col" style="text-align:right">
        <div class="label">Payment Details</div>
        <div class="val">
          Date: ${dt(receipt.created_at)}<br/>
          Method: ${esc(String(receipt.payment_method || 'Online').replace('_', ' '))}<br/>
          <span style="font-family:monospace;font-size:11px">${esc(String(receipt.transaction_id || '—'))}</span>
        </div>
      </div>
    </div>
    ${receipt.invoice_number ? `
    <div style="margin-bottom:20px">
      <table class="items" style="margin:0">
        <tbody>
          <tr><td style="color:#6b7280;width:38%;background:#f9fafb">Invoice #</td><td><strong>${esc(String(receipt.invoice_number))}</strong></td></tr>
          ${receipt.due_date ? `<tr><td style="color:#6b7280;width:38%;background:#f9fafb">Due Date</td><td>${dt(receipt.due_date)}</td></tr>` : ''}
          <tr><td style="color:#6b7280;width:38%;background:#f9fafb">Period</td><td>${dt(receipt.period_start)} – ${dt(receipt.period_end)}</td></tr>
        </tbody>
      </table>
    </div>` : ''}
    ${descriptionTable}
  </div>
  <div class="ft">
    <p>This is a computer-generated receipt. No signature required.</p>
    <p>${platformName} Online Classes · stibelearning.online</p>
  </div>`);
}

/* ─── Shared page shell (matches invoice-pdf design) ──── */
function pageShell(title: string, content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${title}</title>
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
.doc-tag .num{font-size:15px;font-weight:700;color:#111827;margin-top:2px}
.body{padding:28px 36px 32px}
.meta{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:28px}
.meta-col .label{font-size:10px;text-transform:uppercase;letter-spacing:.8px;color:#9ca3af;font-weight:600;margin-bottom:5px}
.meta-col .val{font-size:13px;color:#374151;line-height:1.6}
.meta-col .val strong{color:#111827}
.badge{display:inline-block;padding:3px 10px;border-radius:12px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px}
.badge-paid{background:#ecfdf5;color:#059669}.badge-pending{background:#fffbeb;color:#d97706}.badge-overdue{background:#fef2f2;color:#dc2626}
.paid-banner{display:flex;align-items:center;gap:14px;padding:16px 20px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;margin-bottom:24px}
.paid-title{font-size:14px;font-weight:700;color:#059669}.paid-amount{font-size:22px;font-weight:800;color:#111827;margin-top:2px}
table.items{width:100%;border-collapse:collapse;margin-bottom:0}
table.items th{font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:#6b7280;font-weight:600;padding:8px 12px;text-align:left;border-bottom:2px solid #e5e7eb;background:#fafafa}
table.items td{padding:10px 12px;border-bottom:1px solid #f3f4f6;font-size:13px;color:#374151}
table.items .r{text-align:right}
table.items .amt{font-weight:600;color:#111827}
table.items .total-row{background:#f9fafb}
table.items .total-row td{font-weight:700;font-size:14px;color:#111827;padding:12px}
.ft{padding:20px 36px;border-top:1px solid #e5e7eb;text-align:center}
.ft p{font-size:10px;color:#9ca3af;line-height:1.5}
.print-bar{text-align:center;padding:14px}
.print-btn{background:#111827;color:#fff;border:none;padding:9px 24px;border-radius:5px;font-size:13px;font-weight:600;cursor:pointer}
.print-btn:hover{background:#374151}
</style>
</head>
<body>
<div class="page">
  ${content}
  <div class="print-bar no-print"><button class="print-btn" onclick="window.print()">Print / Save as PDF</button></div>
</div>
</body>
</html>`;
}
