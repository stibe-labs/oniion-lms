// ═══════════════════════════════════════════════════════════════
// Fee Structures API — GET + POST /api/v1/payment/fee-structures
// Owner-only: configure fee rates per batch type
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { verifySession, COOKIE_NAME } from '@/lib/session';
import { getFeeStructures, createFeeStructure } from '@/lib/payment';

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    const user = await verifySession(token);
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const structures = await getFeeStructures();
    return NextResponse.json({ success: true, data: { fee_structures: structures } });
  } catch (err) {
    console.error('[fee-structures] GET error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    const user = await verifySession(token);
    if (!user || user.role !== 'owner') {
      return NextResponse.json({ success: false, error: 'Owner access required' }, { status: 403 });
    }

    const body = await req.json();
    const { batch_type, grade, subject, amount_paise, currency, billing_period, registration_fee, security_deposit } = body;

    if (!batch_type || !amount_paise) {
      return NextResponse.json({ success: false, error: 'batch_type and amount_paise required' }, { status: 400 });
    }

    const structure = await createFeeStructure({
      batchType: batch_type,
      grade, subject,
      amountPaise: amount_paise,
      currency, billingPeriod: billing_period,
      registrationFee: registration_fee,
      securityDeposit: security_deposit,
      createdBy: user.id,
    });

    return NextResponse.json({ success: true, data: structure });
  } catch (err) {
    console.error('[fee-structures] POST error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
