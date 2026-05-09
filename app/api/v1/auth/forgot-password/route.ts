import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse } from '@/types';
import { db } from '@/lib/db';
import { redis } from '@/lib/redis';
import { sendEmail } from '@/lib/email';
import { passwordResetOtpTemplate } from '@/lib/email-templates';

/**
 * POST /api/v1/auth/forgot-password
 * Body: { email }
 * Generates a 6-digit OTP, stores in Redis (10 min TTL), sends via email.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body as { email?: string };

    if (!email) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Email is required' },
        { status: 400 }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Check user exists and is active
    const result = await db.query<{ email: string; full_name: string; is_active: boolean }>(
      `SELECT email, full_name, is_active FROM portal_users WHERE email = $1`,
      [normalizedEmail]
    );

    if (result.rows.length === 0) {
      // Don't reveal whether email exists — always return success
      return NextResponse.json<ApiResponse>(
        { success: true, message: 'If an account with that email exists, an OTP has been sent.' },
        { status: 200 }
      );
    }

    const user = result.rows[0];
    if (!user.is_active) {
      return NextResponse.json<ApiResponse>(
        { success: true, message: 'If an account with that email exists, an OTP has been sent.' },
        { status: 200 }
      );
    }

    // Rate limit: max 3 OTP requests per email per 10 minutes
    const rateLimitKey = `pwd-reset-rate:${normalizedEmail}`;
    const attempts = await redis.incr(rateLimitKey);
    if (attempts === 1) {
      await redis.expire(rateLimitKey, 600);
    }
    if (attempts > 3) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Too many requests. Please wait a few minutes and try again.' },
        { status: 429 }
      );
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Store OTP in Redis with 10-minute TTL
    const otpKey = `pwd-reset-otp:${normalizedEmail}`;
    await redis.set(otpKey, otp, 'EX', 600);

    // Send OTP email
    const { subject, html, text } = passwordResetOtpTemplate({
      recipientName: user.full_name,
      recipientEmail: normalizedEmail,
      otp,
    });

    const emailResult = await sendEmail({
      to: normalizedEmail,
      subject,
      html,
      text,
      priority: 'high',
    });

    if (!emailResult.success) {
      console.error('[ForgotPassword] Failed to send OTP email:', emailResult.error);
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Failed to send email. Please try again.' },
        { status: 500 }
      );
    }

    return NextResponse.json<ApiResponse>(
      { success: true, message: 'OTP sent to your email address.' },
      { status: 200 }
    );
  } catch (err) {
    console.error('[ForgotPassword] Error:', err);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
