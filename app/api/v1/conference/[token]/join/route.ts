import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse, PortalRole } from '@/types';
import { db } from '@/lib/db';
import { ensureRoom, createLiveKitToken } from '@/lib/livekit';

/**
 * POST /api/v1/conference/[token]/join — Join a conference
 * Body: { name: string }
 * Returns LiveKit token + URL
 */

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const body = await request.json();
    let name = (body.name as string || '').trim();
    const sid = (body.sid as string || '').trim();

    // If sid provided and name empty, look up name from share record
    if (!name && sid) {
      const shareRes = await db.query(
        `SELECT name FROM conference_shares WHERE id = $1 LIMIT 1`,
        [sid]
      );
      if (shareRes.rows.length > 0) {
        name = (String(shareRes.rows[0].name || '')).trim();
      }
    }

    if (!name) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Name is required' }, { status: 400 });
    }

    // Determine role from token
    let conference: Record<string, unknown> | null = null;
    let role: 'admin' | 'user' = 'user';

    const adminRes = await db.query(
      `SELECT * FROM conferences WHERE admin_token = $1 LIMIT 1`,
      [token]
    );
    if (adminRes.rows.length > 0) {
      conference = adminRes.rows[0] as Record<string, unknown>;
      role = 'admin';
    } else {
      const userRes = await db.query(
        `SELECT * FROM conferences WHERE user_token = $1 LIMIT 1`,
        [token]
      );
      if (userRes.rows.length > 0) {
        conference = userRes.rows[0] as Record<string, unknown>;
        role = 'user';
      }
    }

    if (!conference) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Conference not found' }, { status: 404 });
    }

    if (conference.status === 'ended') {
      return NextResponse.json<ApiResponse>({ success: false, error: 'This conference has ended' }, { status: 410 });
    }

    // Time gate for scheduled conferences (users only — admins bypass)
    if (role === 'user' && conference.conference_type === 'scheduled' && conference.scheduled_at) {
      const scheduledTime = new Date(String(conference.scheduled_at)).getTime();
      const earlyLobby = scheduledTime - 5 * 60 * 1000;
      if (Date.now() < earlyLobby) {
        const minsLeft = Math.ceil((earlyLobby - Date.now()) / 60000);
        return NextResponse.json<ApiResponse>({
          success: false,
          error: `Conference opens in ${minsLeft} minute${minsLeft === 1 ? '' : 's'}. Lobby opens 5 minutes before the scheduled time.`,
        }, { status: 425 });
      }
    }

    // Create or reuse LiveKit room
    const roomName = conference.livekit_room_name
      ? String(conference.livekit_room_name)
      : `conf_${String(conference.id).replace(/-/g, '').slice(0, 16)}`;

    await ensureRoom(roomName, JSON.stringify({ conference_id: conference.id, title: conference.title }));

    // Update conference with room name + status if first join
    if (!conference.livekit_room_name || conference.status === 'created') {
      await db.query(
        `UPDATE conferences SET livekit_room_name = $1, status = 'live', started_at = COALESCE(started_at, NOW()) WHERE id = $2`,
        [roomName, conference.id]
      );
    }

    // Record participant
    const partRes = await db.query(
      `INSERT INTO conference_participants (conference_id, name, role)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [conference.id, name, role]
    );
    const participantId = String(partRes.rows[0].id);

    // Look up parent-student relationship if sid provided
    let studentNames: string[] = [];
    if (sid) {
      try {
        const shareRes = await db.query(
          `SELECT cs.phone, cs.email FROM conference_shares cs WHERE cs.id = $1 LIMIT 1`,
          [sid]
        );
        if (shareRes.rows.length > 0) {
          const sharePhone = String(shareRes.rows[0].phone || '');
          const shareEmail = String(shareRes.rows[0].email || '');
          // Find parent user by phone or email
          let parentEmail: string | null = null;
          if (shareEmail) {
            const pu = await db.query(
              `SELECT email FROM portal_users WHERE email = $1 AND portal_role = 'parent' LIMIT 1`,
              [shareEmail]
            );
            if (pu.rows.length > 0) parentEmail = String(pu.rows[0].email);
          }
          if (!parentEmail && sharePhone) {
            const pu = await db.query(
              `SELECT up.email FROM user_profiles up
               JOIN portal_users pu ON pu.email = up.email
               WHERE up.phone = $1 AND pu.portal_role = 'parent' LIMIT 1`,
              [sharePhone]
            );
            if (pu.rows.length > 0) parentEmail = String(pu.rows[0].email);
          }
          if (parentEmail) {
            const stuRes = await db.query(
              `SELECT pu.full_name FROM batch_students bs
               JOIN portal_users pu ON pu.email = bs.student_email
               WHERE bs.parent_email = $1
               GROUP BY pu.full_name`,
              [parentEmail]
            );
            studentNames = stuRes.rows.map((r: Record<string, unknown>) => String(r.full_name));
          }
        }
      } catch { /* best effort — don't block join */ }
    }

    // Generate unique identity: role_participantId
    const identity = `${role}_${participantId}`;
    const portalRole: PortalRole = role === 'admin' ? 'conference_host' : 'conference_user';

    const metadata = JSON.stringify({
      conference_id: conference.id,
      conference_role: role,
      participant_id: participantId,
      portal_role: portalRole,
      ...(studentNames.length > 0 ? { student_names: studentNames } : {}),
    });

    const livekitToken = await createLiveKitToken({
      roomName,
      participantIdentity: identity,
      participantName: name,
      role: portalRole,
      metadata,
      ttl: '8h',
    });

    const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL || 'ws://localhost:7880';

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        livekit_token: livekitToken,
        livekit_url: livekitUrl,
        room_name: roomName,
        role,
        participant_name: name,
        participant_identity: identity,
        conference_id: conference.id,
        conference_title: conference.title,
      },
    });
  } catch (err) {
    console.error('[conference/join]', err);
    return NextResponse.json<ApiResponse>({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
