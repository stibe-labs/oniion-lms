import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse, PortalRole } from '@/types';
import { signSession } from '@/lib/session';
import { createLiveKitToken, ensureRoom, ghostIdentity } from '@/lib/livekit';
import { isGhostRole } from '@/lib/utils';

/**
 * POST /api/v1/dev/token
 * DEV-ONLY: Generates a session cookie + LiveKit token for any role.
 * Bypasses Frappe login entirely. Only works in development mode.
 */

// Dev user definitions per spec 14.2
const DEV_USERS: Record<string, { name: string; email: string; identity: string }> = {
  teacher: { name: 'Priya Sharma', email: 'priya@stibelearning.online', identity: 'teacher_priya_sharma' },
  teacher_screen: { name: 'Priya Sharma (Screen)', email: 'priya@stibelearning.online', identity: 'teacher_priya_sharma_screen' },
  student: { name: 'Rahul Nair', email: 'rahul@student.stibelearning.online', identity: 'student_rahul_nair' },
  owner: { name: 'Admin', email: 'admin@stibelearning.online', identity: 'ghost_owner_admin_1' },
  coordinator: { name: 'Seema Verma', email: 'seema@stibelearning.online', identity: 'ghost_coordinator_seema_1' },
  academic: { name: 'Dr. Mehta', email: 'mehta@stibelearning.online', identity: 'ghost_academic_dr_mehta_1' },
  academic_operator: { name: 'Dr. Mehta', email: 'mehta@stibelearning.online', identity: 'ghost_academic_dr_mehta_1' },
  parent: { name: 'Nair Parent', email: 'nair.parent@gmail.com', identity: 'ghost_parent_nair_1' },
  ghost: { name: 'Ghost Observer', email: 'ghost@stibelearning.online', identity: 'ghost_ghost_observer_1' },
};

function isDevMode(): boolean {
  return process.env.NODE_ENV === 'development' || process.env.ENABLE_DEV_PAGE === 'true';
}

export async function POST(request: NextRequest) {
  // Guard: dev mode only
  if (!isDevMode()) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }

  try {
    const body = await request.json();
    const { role, name: customName, room_id, room_name, duration_minutes: reqDuration } = body as {
      role: string;
      name?: string;
      room_id: string;
      room_name?: string;
      duration_minutes?: number;
    };

    const duration_minutes = reqDuration || 60;
    const scheduled_start = new Date().toISOString();

    if (!role || !room_id) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Missing required fields: role, room_id' },
        { status: 400 }
      );
    }

    // Validate role
    const validRoles: PortalRole[] = ['teacher', 'teacher_screen', 'student', 'batch_coordinator', 'academic_operator', 'academic', 'parent', 'owner', 'ghost'];
    if (!validRoles.includes(role as PortalRole)) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: `Invalid role: ${role}. Valid roles: ${validRoles.join(', ')}` },
        { status: 400 }
      );
    }

    const portalRole = role as PortalRole;
    const devUser = DEV_USERS[portalRole] || DEV_USERS.student;
    const userName = customName || devUser.name;
    const userEmail = devUser.email;

    // Determine identity
    let participantIdentity: string;
    if (isGhostRole(portalRole)) {
      participantIdentity = ghostIdentity(portalRole, userName);
    } else {
      participantIdentity = `${portalRole}_${userName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
    }

    // Create portal session user
    const sessionUser = {
      id: userEmail,
      name: userName,
      role: portalRole,
    };

    // Sign session JWT
    const sessionJwt = await signSession(sessionUser);

    // Ensure room exists on LiveKit
    const displayName = room_name || `Dev Room: ${room_id}`;
    await ensureRoom(room_id, JSON.stringify({ room_name: displayName, dev: true }));

    // Determine device type for metadata
    const isScreenDevice = portalRole === 'teacher_screen';
    const effectiveRole = isScreenDevice ? 'teacher' : portalRole;

    // Generate LiveKit token
    const lk_token = await createLiveKitToken({
      roomName: room_id,
      participantIdentity,
      participantName: userName,
      role: portalRole,
      metadata: JSON.stringify({
        portal_user_id: userEmail,
        portal_role: effectiveRole,
        effective_role: effectiveRole,
        ...(isScreenDevice ? { device: 'screen' } : {}),
        dev: true,
      }),
    });

    // Build response with session cookie
    const response = NextResponse.json<ApiResponse<{
      lk_token: string;
      livekit_url: string;
      room_id: string;
      room_name: string;
      user: { name: string; email: string; role: PortalRole };
      participant_identity: string;
      scheduled_start: string;
      duration_minutes: number;
      room_status: string;
    }>>(
      {
        success: true,
        data: {
          lk_token,
          livekit_url: process.env.NEXT_PUBLIC_LIVEKIT_URL || 'ws://localhost:7880',
          room_id,
          room_name: displayName,
          user: { name: userName, email: userEmail, role: portalRole },
          participant_identity: participantIdentity,
          scheduled_start,
          duration_minutes,
          room_status: 'scheduled', // Dev mode: always starts as scheduled so teacher can test Go Live
        },
      },
      { status: 200 }
    );

    // Set session cookie (same as real login)
    response.cookies.set('stibe-session', sessionJwt, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 8 * 60 * 60, // 8 hours
    });

    return response;
  } catch (err) {
    console.error('[dev/token] Error:', err);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
