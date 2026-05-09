// ═══════════════════════════════════════════════════════════════
// Owner Admin — PATCH (toggle active) + DELETE (remove)
// PATCH /api/v1/owner/admins/[email] — Toggle active status
// DELETE /api/v1/owner/admins/[email] — Remove admin account
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifySession, COOKIE_NAME } from '@/lib/session';

async function requireOwner(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const user = await verifySession(token);
  if (!user || user.role !== 'owner') return null;
  return user;
}

// ── PATCH — Update admin (toggle active, edit name/phone) ───
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ email: string }> }
) {
  const caller = await requireOwner(req);
  if (!caller) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const { email } = await params;
  const targetEmail = decodeURIComponent(email).toLowerCase().trim();

  const body = await req.json();
  const { is_active, full_name, phone } = body;

  // Build dynamic SET clauses
  const sets: string[] = ['updated_at = NOW()'];
  const values: unknown[] = [];
  let idx = 1;

  if (typeof is_active === 'boolean') {
    // Prevent deactivating yourself
    if (targetEmail === caller.id) {
      return NextResponse.json(
        { success: false, error: 'You cannot deactivate your own account' },
        { status: 400 }
      );
    }
    sets.push(`is_active = $${idx}`);
    values.push(is_active);
    idx++;
  }

  if (typeof full_name === 'string' && full_name.trim()) {
    sets.push(`full_name = $${idx}`);
    values.push(full_name.trim());
    idx++;
  }

  if (phone !== undefined) {
    sets.push(`phone = $${idx}`);
    values.push(phone ? String(phone).trim() : null);
    idx++;
  }

  if (values.length === 0) {
    return NextResponse.json(
      { success: false, error: 'No fields to update' },
      { status: 400 }
    );
  }

  values.push(targetEmail);

  const result = await db.query(
    `UPDATE portal_users SET ${sets.join(', ')}
     WHERE email = $${idx} AND portal_role = 'owner'
     RETURNING email, full_name, phone, is_active`,
    values
  );

  if (result.rows.length === 0) {
    return NextResponse.json(
      { success: false, error: 'Admin account not found' },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true, data: result.rows[0] });
}

// ── DELETE — Remove admin account ───────────────────────────
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ email: string }> }
) {
  const caller = await requireOwner(req);
  if (!caller) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  const { email } = await params;
  const targetEmail = decodeURIComponent(email).toLowerCase().trim();

  // Prevent deleting yourself
  if (targetEmail === caller.id) {
    return NextResponse.json(
      { success: false, error: 'You cannot delete your own account' },
      { status: 400 }
    );
  }

  const result = await db.query(
    `DELETE FROM portal_users WHERE email = $1 AND portal_role = 'owner' RETURNING email`,
    [targetEmail]
  );

  if (result.rows.length === 0) {
    return NextResponse.json(
      { success: false, error: 'Admin account not found' },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true, message: `Admin ${targetEmail} removed` });
}
