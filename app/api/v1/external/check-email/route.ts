import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse } from '@/types';
import { db } from '@/lib/db';

const CRM_API_KEY = process.env.CRM_INTEGRATION_API_KEY || '';

/**
 * GET /api/v1/external/check-email?email=...
 * Checks whether an email is already used in stibe portal users (any role).
 * Auth: X-API-Key header.
 */
export async function GET(req: NextRequest) {
  try {
    const apiKey = req.headers.get('x-api-key');
    if (!CRM_API_KEY || apiKey !== CRM_API_KEY) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Invalid API key' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const email = (searchParams.get('email') ?? '').trim().toLowerCase();
    if (!email) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'email is required' }, { status: 400 });
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email)) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'invalid email format' }, { status: 400 });
    }

    const userRes = await db.query<{
      email: string;
      full_name: string;
      portal_role: string;
      is_active: boolean;
    }>(
      `SELECT email, full_name, portal_role, is_active
       FROM portal_users
       WHERE LOWER(email) = $1
       LIMIT 1`,
      [email],
    );

    if (userRes.rows.length === 0) {
      return NextResponse.json<ApiResponse>({
        success: true,
        data: { exists: false },
      });
    }

    const user = userRes.rows[0];
    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        exists: true,
        user: {
          email: user.email,
          full_name: user.full_name,
          portal_role: user.portal_role,
          is_active: user.is_active,
        },
      },
    });
  } catch (err) {
    console.error('[external/check-email] GET error:', err);
    return NextResponse.json<ApiResponse>({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
