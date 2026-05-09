import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse } from '@/types';
import { redis } from '@/lib/redis';
import { SignJWT } from 'jose';

const resetSecret = new TextEncoder().encode(process.env.JWT_SECRET! + '-pwd-reset');

/**
 * POST /api/v1/auth/verify-otp
 * Body: { email, otp }
 * Verifies the OTP and returns a short-lived reset token (5 min).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, otp } = body as { email?: string; otp?: string };

    if (!email || !otp) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Email and OTP are required' },
        { status: 400 }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();
    const otpKey = `pwd-reset-otp:${normalizedEmail}`;

    // Rate limit verification attempts
    const verifyLimitKey = `pwd-reset-verify:${normalizedEmail}`;
    const verifyAttempts = await redis.incr(verifyLimitKey);
    if (verifyAttempts === 1) {
      await redis.expire(verifyLimitKey, 600);
    }
    if (verifyAttempts > 5) {
      // Too many wrong attempts — delete the OTP
      await redis.del(otpKey);
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Too many failed attempts. Please request a new OTP.' },
        { status: 429 }
      );
    }

    // Retrieve stored OTP
    const storedOtp = await redis.get(otpKey);
    if (!storedOtp) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'OTP expired or not found. Please request a new one.' },
        { status: 400 }
      );
    }

    if (storedOtp !== otp.trim()) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Invalid OTP. Please check and try again.' },
        { status: 400 }
      );
    }

    // OTP is valid — delete it so it can't be reused
    await redis.del(otpKey);
    await redis.del(verifyLimitKey);

    // Generate a short-lived reset token (5 minutes)
    const resetToken = await new SignJWT({ email: normalizedEmail, purpose: 'password-reset' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(resetSecret);

    return NextResponse.json<ApiResponse<{ resetToken: string }>>(
      { success: true, data: { resetToken } },
      { status: 200 }
    );
  } catch (err) {
    console.error('[VerifyOTP] Error:', err);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
