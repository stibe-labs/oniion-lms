/**
 * Test script: Group batch OTP/SPO invoice generation
 * Tests all 6 scenarios for manual enrollment of group batches.
 *
 * Run: node scripts/test-group-invoice.mjs
 */

const BASE = 'https://stibelearning.online';
const BATCH_ID = 'batch_3ff692a6-f96';   // 1:30 PCSM Class 10 CBSE B1

// Grade 10 CBSE one_to_thirty fees (offer active — no expiry):
// regularFee=3500000, otpTotal=3500000*0.75=2625000, spoTotal=3500000*0.80=2800000
const OTP   = 2625000;   // ₹26,250
const Q123  = 840000;    // ₹8,400  (2800000*0.30 = 840000)
const Q4    = 280000;    // ₹2,800  (2800000 - 840000*3 = 280000)
const ADVANCE_OTP = 1000000;  // ₹10,000 (partial OTP advance)
const ADVANCE_SPO = 500000;   // ₹5,000  (partial Q1 advance)

const SCENARIOS = [
  {
    id: 'otp-none',
    label: '1. OTP + no payment',
    student_email: 'test.otp.none@stibetest.dev',
    student_name: 'Test OTP None',
    payment_type: 'otp',
    payment_mode: 'none',
    amount_paise: 0,
    fee_otp_paise: OTP,
    fee_spo_q123_paise: Q123,
    fee_spo_q4_paise: Q4,
    expect: [
      { status: 'pending', amount: OTP, note: 'pending OTP invoice (₹26,250)' },
    ],
    expect_gate: true,   // quarterly_due_date should be set
  },
  {
    id: 'otp-advance',
    label: '2. OTP + advance payment (₹10,000)',
    student_email: 'test.otp.advance@stibetest.dev',
    student_name: 'Test OTP Advance',
    payment_type: 'otp',
    payment_mode: 'advance',
    amount_paise: ADVANCE_OTP,
    fee_otp_paise: OTP,
    fee_spo_q123_paise: Q123,
    fee_spo_q4_paise: Q4,
    expect: [
      { status: 'paid',    amount: ADVANCE_OTP,         note: 'paid advance receipt (₹10,000)' },
      { status: 'pending', amount: OTP - ADVANCE_OTP,   note: 'pending balance invoice (₹16,250)' },
    ],
    expect_gate: true,
  },
  {
    id: 'otp-full',
    label: '3. OTP + full payment (₹26,250)',
    student_email: 'test.otp.full@stibetest.dev',
    student_name: 'Test OTP Full',
    payment_type: 'otp',
    payment_mode: 'full',
    amount_paise: OTP,
    fee_otp_paise: OTP,
    fee_spo_q123_paise: Q123,
    fee_spo_q4_paise: Q4,
    expect: [
      { status: 'paid', amount: OTP, note: 'paid full OTP invoice (₹26,250)' },
    ],
    expect_gate: false,  // no gate for full OTP
  },
  {
    id: 'spo-none',
    label: '4. SPO + no payment',
    student_email: 'test.spo.none@stibetest.dev',
    student_name: 'Test SPO None',
    payment_type: 'spo',
    payment_mode: 'none',
    amount_paise: 0,
    fee_otp_paise: OTP,
    fee_spo_q123_paise: Q123,
    fee_spo_q4_paise: Q4,
    expect: [
      { status: 'pending',   amount: Q123, installment: 1, note: 'Q1 pending (₹8,400)' },
      { status: 'scheduled', amount: Q123, installment: 2, note: 'Q2 scheduled (₹8,400)' },
      { status: 'scheduled', amount: Q123, installment: 3, note: 'Q3 scheduled (₹8,400)' },
      { status: 'scheduled', amount: Q4,   installment: 4, note: 'Q4 scheduled (₹2,800)' },
    ],
    expect_gate: true,
  },
  {
    id: 'spo-advance',
    label: '5. SPO + partial advance (₹5,000 < Q1 ₹8,400)',
    student_email: 'test.spo.advance@stibetest.dev',
    student_name: 'Test SPO Advance',
    payment_type: 'spo',
    payment_mode: 'advance',
    amount_paise: ADVANCE_SPO,
    fee_otp_paise: OTP,
    fee_spo_q123_paise: Q123,
    fee_spo_q4_paise: Q4,
    expect: [
      { status: 'paid',      amount: ADVANCE_SPO,        installment: 1, note: 'Q1 partial paid (₹5,000)' },
      { status: 'pending',   amount: Q123 - ADVANCE_SPO, installment: 1, note: 'Q1 balance pending (₹3,400)' },
      { status: 'scheduled', amount: Q123, installment: 2, note: 'Q2 scheduled (₹8,400)' },
      { status: 'scheduled', amount: Q123, installment: 3, note: 'Q3 scheduled (₹8,400)' },
      { status: 'scheduled', amount: Q4,   installment: 4, note: 'Q4 scheduled (₹2,800)' },
    ],
    expect_gate: true,
  },
  {
    id: 'spo-full',
    label: '6. SPO + full Q1 payment (₹8,400)',
    student_email: 'test.spo.full@stibetest.dev',
    student_name: 'Test SPO Full Q1',
    payment_type: 'spo',
    payment_mode: 'full',
    amount_paise: Q123,
    fee_otp_paise: OTP,
    fee_spo_q123_paise: Q123,
    fee_spo_q4_paise: Q4,
    expect: [
      { status: 'paid',      amount: Q123, installment: 1, note: 'Q1 paid (₹8,400)' },
      { status: 'scheduled', amount: Q123, installment: 2, note: 'Q2 scheduled (₹8,400)' },
      { status: 'scheduled', amount: Q123, installment: 3, note: 'Q3 scheduled (₹8,400)' },
      { status: 'scheduled', amount: Q4,   installment: 4, note: 'Q4 scheduled (₹2,800)' },
    ],
    expect_gate: false,  // Q1 fully paid → gate not blocking now
  },
];

// ── Helpers ────────────────────────────────────────────────────────────────

const fmt = (p) => `₹${(p/100).toLocaleString('en-IN')}`;

async function login() {
  const res = await fetch(`${BASE}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'dev.poornasree@gmail.com', password: 'Test@1234' }),
  });
  const setCookie = res.headers.get('set-cookie') || '';
  const match = setCookie.match(/stibe-session=([^;]+)/);
  if (!match) throw new Error('Login failed — no session cookie');
  console.log('✓ Logged in as dev.poornasree@gmail.com');
  return match[1];
}

async function cleanupTestStudents(token) {
  // Remove any prior test runs from DB via the portal's own delete if available,
  // or just allow the ON CONFLICT DO UPDATE to handle re-runs.
  // For batch_students we need to remove them so re-enrollment doesn't conflict.
  // We'll just run each scenario fresh by checking if student already in batch.
}

async function enrollStudent(token, scenario) {
  const res = await fetch(`${BASE}/api/v1/enrollment/manual`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `stibe-session=${token}`,
    },
    body: JSON.stringify({
      student_name:        scenario.student_name,
      student_email:       scenario.student_email,
      student_grade:       '10',
      student_board:       'CBSE',
      batch_id:            BATCH_ID,
      payment_type:        scenario.payment_type,
      payment_mode:        scenario.payment_mode,
      payment_method:      'cash',
      amount_paise:        scenario.amount_paise,
      fee_otp_paise:       scenario.fee_otp_paise,
      fee_spo_q123_paise:  scenario.fee_spo_q123_paise,
      fee_spo_q4_paise:    scenario.fee_spo_q4_paise,
    }),
  });
  const data = await res.json();
  if (!data.success) throw new Error(`Enrollment failed: ${data.error}`);
  return data;
}

async function getInvoices(token, email) {
  const res = await fetch(`${BASE}/api/v1/invoices?student_email=${encodeURIComponent(email)}`, {
    headers: { 'Cookie': `stibe-session=${token}` },
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.invoices || data.data || data;
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  GROUP BATCH OTP/SPO INVOICE — SCENARIO TESTS');
  console.log(`  Batch: ${BATCH_ID}  |  OTP=${fmt(OTP)}  Q1-Q3=${fmt(Q123)}  Q4=${fmt(Q4)}`);
  console.log('═══════════════════════════════════════════════════════════════\n');

  const token = await login();
  const results = [];

  for (const sc of SCENARIOS) {
    console.log(`\n── ${sc.label} ──────────────────────────────────`);
    console.log(`   Email: ${sc.email}  |  payment_mode=${sc.payment_mode}  amount=${fmt(sc.amount_paise)}`);

    try {
      const enroll = await enrollStudent(token, sc);
      console.log(`   ✓ Enrolled  invoice=${enroll.invoice_number || 'n/a'}  receipt=${enroll.receipt_number || 'n/a'}`);

      // Small delay to let DB commit
      await new Promise(r => setTimeout(r, 300));

      // Fetch invoices via API to verify
      const invoices = await getInvoices(token, sc.student_email);
      const relevant = Array.isArray(invoices)
        ? invoices.filter(i => ['pending','paid','scheduled'].includes(i.status) && !i.is_topup)
        : [];

      const PASS = '\x1b[32m✓\x1b[0m';
      const FAIL = '\x1b[31m✗\x1b[0m';
      let scenarioPassed = true;

      console.log(`   Invoices found: ${relevant.length}`);
      relevant.forEach(inv => {
        const inst = inv.installment_number ? ` Q${inv.installment_number}` : '';
        console.log(`     • [${inv.status.padEnd(9)}]${inst.padEnd(3)} ${fmt(inv.amount_paise).padStart(10)} — ${inv.description?.substring(0,60)}`);
      });

      // Verify each expected invoice
      for (const exp of sc.expect) {
        const match = relevant.find(inv =>
          inv.status === exp.status &&
          Math.abs(inv.amount_paise - exp.amount) < 100 &&
          (exp.installment == null || inv.installment_number === exp.installment)
        );
        if (match) {
          console.log(`   ${PASS} ${exp.note}`);
        } else {
          console.log(`   ${FAIL} MISSING: ${exp.note} (expected status=${exp.status} amount=${fmt(exp.amount)})`);
          scenarioPassed = false;
        }
      }

      // Unexpected extras?
      if (relevant.length > sc.expect.length) {
        console.log(`   ⚠  Got ${relevant.length} invoices, expected ${sc.expect.length}`);
      }

      results.push({ label: sc.label, passed: scenarioPassed });

    } catch (err) {
      console.log(`   ${'\x1b[31m✗\x1b[0m'} ERROR: ${err.message}`);
      results.push({ label: sc.label, passed: false, error: err.message });
    }
  }

  // Summary
  console.log('\n\n════════════ RESULTS ════════════');
  let allPassed = true;
  for (const r of results) {
    const icon = r.passed ? '\x1b[32m✓ PASS\x1b[0m' : '\x1b[31m✗ FAIL\x1b[0m';
    console.log(`  ${icon}  ${r.label}${r.error ? ` — ${r.error}` : ''}`);
    if (!r.passed) allPassed = false;
  }
  console.log(allPassed ? '\n\x1b[32m All scenarios passed!\x1b[0m\n' : '\n\x1b[31m Some scenarios FAILED.\x1b[0m\n');
}

main().catch(e => { console.error(e); process.exit(1); });
