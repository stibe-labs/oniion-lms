import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse } from '@/types';
import { db } from '@/lib/db';
import { hash } from 'bcryptjs';
import { jwtVerify } from 'jose';

const resetSecret = new TextEncoder().encode(process.env.JWT_SECRET! + '-pwd-reset');

/**
 * POST /api/v1/auth/reset-password
 * Body: { resetToken, newPassword }
 * Validates the reset token and updates the password.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { resetToken, newPassword } = body as { resetToken?: string; newPassword?: string };

    if (!resetToken || !newPassword) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Reset token and new password are required' },
        { status: 400 }
      );
    }

    if (newPassword.length < 6) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Password must be at least 6 characters' },
        { status: 400 }
      );
    }

    // Verify reset token
    let email: string;
    try {
      const { payload } = await jwtVerify(resetToken, resetSecret);
      if (payload.purpose !== 'password-reset' || typeof payload.email !== 'string') {
        return NextResponse.json<ApiResponse>(
          { success: false, error: 'Invalid reset token' },
          { status: 400 }
        );
      }
      email = payload.email;
    } catch {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Reset token expired or invalid. Please start over.' },
        { status: 400 }
      );
    }

    // Hash new password
    const passwordHash = await hash(newPassword, 12);

    // Update password in database
    const result = await db.query(
      `UPDATE portal_users SET password_hash = $1, updated_at = NOW() WHERE email = $2 AND is_active = TRUE`,
      [passwordHash, email]
    );

    if (result.rowCount === 0) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Account not found or is disabled' },
        { status: 400 }
      );
    }

    return NextResponse.json<ApiResponse>(
      { success: true, message: 'Password updated successfully. You can now sign in.' },
      { status: 200 }
    );
  } catch (err) {
    console.error('[ResetPassword] Error:', err);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
