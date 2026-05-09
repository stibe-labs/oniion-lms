// ═══════════════════════════════════════════════════════════════
// Join Room — /join/[room_id]
// Participants arrive here from email invite links.
// Validates their token/session and routes to classroom.
// If ?token= is in URL (email link), auth is NOT required.
// ═══════════════════════════════════════════════════════════════

import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { verifySession, COOKIE_NAME } from '@/lib/session';
import { db } from '@/lib/db';
import JoinRoomClient from './JoinRoomClient';

interface Props {
  params: Promise<{ room_id: string }>;
  searchParams: Promise<{ token?: string; device?: string }>;
}

/**
 * Decode a JWT payload without verifying signature.
 * Used to extract display info from the email's LiveKit token.
 */
function decodeJwtPayload(jwt: string): Record<string, unknown> | null {
  try {
    const parts = jwt.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(
      Buffer.from(parts[1], 'base64url').toString('utf-8')
    );
    return payload;
  } catch {
    return null;
  }
}

export default async function JoinRoomPage({ params, searchParams }: Props) {
  const { room_id } = await params;
  const { token: emailToken, device } = await searchParams;

  // Get room info — support both livekit_room_name and batch session_id
  const roomResult = await db.query(
    `SELECT room_id, room_name, subject, grade, status, scheduled_start,
            duration_minutes, teacher_email, open_at, expires_at
     FROM rooms WHERE room_id = $1 OR batch_session_id = $1 LIMIT 1`,
    [room_id]
  );

  if (roomResult.rows.length === 0) {
    // Check if there's a batch_session with this id (teacher hasn't started yet)
    const sessionCheck = await db.query(
      `SELECT session_id, subject, start_time, scheduled_date, status, teacher_name
       FROM batch_sessions WHERE session_id = $1 LIMIT 1`,
      [room_id]
    );
    if (sessionCheck.rows.length > 0) {
      const sess = sessionCheck.rows[0] as { subject: string; start_time: string; scheduled_date: string; status: string; teacher_name: string | null };

      // Authenticate via session_join_tokens if token provided
      let tokenUser: { name: string; type: string } | null = null;
      if (emailToken) {
        const tokenRes = await db.query(
          `SELECT participant_name, participant_type FROM session_join_tokens
           WHERE session_id = $1 AND join_token = $2 LIMIT 1`,
          [room_id, emailToken]
        );
        if (tokenRes.rows.length > 0) {
          const tRow = tokenRes.rows[0] as { participant_name: string; participant_type: string };
          tokenUser = { name: tRow.participant_name, type: tRow.participant_type };
        }
      }

      // Check if user is logged in via session cookie
      const cookieStoreEarly = await cookies();
      const earlySessionToken = cookieStoreEarly.get(COOKIE_NAME)?.value;
      const earlyUser = earlySessionToken ? await verifySession(earlySessionToken) : null;

      // If neither logged in nor token-authenticated, redirect to login
      if (!earlyUser && !tokenUser) {
        if (emailToken) {
          // Invalid token — still show page but don't authenticate
        } else {
          redirect(`/login?redirect=${encodeURIComponent(`/join/${room_id}`)}`);
        }
      }

      const displayName = earlyUser?.name || tokenUser?.name || 'there';
      const tokenParam = emailToken ? `?token=${emailToken}` : '';

      return (
        <div className="flex min-h-screen items-center justify-center bg-background">
          <div className="text-center max-w-sm px-6">
            <div className="mb-3 text-4xl">⏳</div>
            <h1 className="text-xl font-bold text-foreground">
              Hi {displayName}!
            </h1>
            <p className="mt-2 text-muted-foreground">
              The <strong>{sess.subject}</strong> class ({sess.scheduled_date?.slice(0,10)} {sess.start_time?.slice(0,5)}) is scheduled but the teacher hasn&apos;t opened the classroom yet.
            </p>
            {sess.teacher_name && (
              <p className="mt-1 text-sm text-muted-foreground">Teacher: {sess.teacher_name}</p>
            )}
            <p className="mt-3 text-sm text-muted-foreground">This page will auto-refresh when the class starts.</p>
            <a href={`/join/${room_id}${tokenParam}`} className="mt-4 inline-block rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-white hover:opacity-90">
              Refresh Now
            </a>
            {/* Auto-refresh every 15 seconds */}
            <meta httpEquiv="refresh" content={`15;url=/join/${room_id}${tokenParam}`} />
          </div>
        </div>
      );
    }
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-xl font-bold text-red-400">Session Not Found</h1>
          <p className="mt-2 text-muted-foreground">This session does not exist or may have been deleted.</p>
        </div>
      </div>
    );
  }

  const room = roomResult.rows[0] as Record<string, unknown>;

  // Check if room is cancelled
  if (room.status === 'cancelled') {
    const isDemoRoom = String(room.room_id).startsWith('demo_');
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center max-w-sm px-6">
          <div className="mb-3 text-4xl">❌</div>
          <h1 className="text-xl font-bold text-red-400">
            {isDemoRoom ? 'Demo Session Cancelled' : 'Batch Cancelled'}
          </h1>
          <p className="mt-2 text-muted-foreground">
            {isDemoRoom
              ? 'This demo session was cancelled. The teacher was unavailable. Our team will contact you to reschedule.'
              : 'This session has been cancelled by the coordinator.'}
          </p>
        </div>
      </div>
    );
  }

  // Check if room has ended
  if (room.status === 'ended') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="mb-3 text-4xl">✅</div>
          <h1 className="text-xl font-bold text-foreground">Session Ended</h1>
          <p className="mt-2 text-muted-foreground">This session has already ended.</p>
        </div>
      </div>
    );
  }

  // ── Auth: session OR email token ───────────────────────────
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(COOKIE_NAME)?.value;
  let user = null;
  if (sessionToken) {
    user = await verifySession(sessionToken);
  }

  // If email token present → extract participant info from JWT payload,
  // or fall back to a DB lookup for short join codes (non-JWT tokens).
  // No login required — the token itself is the auth.
  let emailUser: { name: string; email: string; role: string } | null = null;
  if (emailToken && !user) {
    const payload = decodeJwtPayload(emailToken);
    if (payload) {
      // Legacy JWT token path
      const metadata = typeof payload.metadata === 'string'
        ? JSON.parse(payload.metadata) as Record<string, unknown>
        : {};
      emailUser = {
        name: (payload.name as string) || 'Participant',
        email: (payload.sub as string) || '',
        role: (metadata.role as string) || 'student',
      };
    } else {
      // Short join code — look up participant info from room_assignments
      const assignResult = await db.query(
        `SELECT participant_email, participant_name, participant_type
         FROM room_assignments
         WHERE room_id = $1 AND join_token = $2
         LIMIT 1`,
        [String(room.room_id), emailToken]
      );
      if (assignResult.rows.length > 0) {
        const row = assignResult.rows[0] as Record<string, string>;
        emailUser = {
          name: row.participant_name || 'Participant',
          email: row.participant_email || '',
          role: row.participant_type || 'student',
        };
      } else {
        // Fallback: check session_join_tokens (token generated at schedule time)
        const sjtResult = await db.query(
          `SELECT participant_email, participant_name, participant_type
           FROM session_join_tokens
           WHERE join_token = $1
           LIMIT 1`,
          [emailToken]
        );
        if (sjtResult.rows.length > 0) {
          const row = sjtResult.rows[0] as Record<string, string>;
          emailUser = {
            name: row.participant_name || 'Participant',
            email: row.participant_email || '',
            role: row.participant_type || 'student',
          };
        }
      }
    }
  }

  // If neither session nor email token → redirect to login
  if (!user && !emailUser) {
    const returnPath = `/join/${room_id}${emailToken || device ? '?' : ''}${emailToken ? `token=${emailToken}` : ''}${emailToken && device ? '&' : ''}${device ? `device=${device}` : ''}`;
    redirect(`/login?redirect=${encodeURIComponent(returnPath)}`);
  }

  // Resolved user info (session takes priority over email token)
  const displayName = user?.name || emailUser!.name;
  const displayEmail = user?.id || emailUser!.email;
  const displayRole = user?.role || emailUser!.role;

  return (
    <JoinRoomClient
      roomId={String(room.room_id)}
      roomName={room.room_name as string}
      subject={room.subject as string}
      grade={room.grade as string}
      status={room.status as string}
      scheduledStart={room.scheduled_start as string}
      durationMinutes={room.duration_minutes as number}
      teacherEmail={room.teacher_email as string | null}
      userName={displayName}
      userEmail={displayEmail}
      userRole={displayRole}
      emailToken={emailToken || null}
      device={device || 'desktop'}
    />
  );
}
