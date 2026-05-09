'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { LiveKitRoom } from '@livekit/components-react';
import { Room, RoomEvent, DisconnectReason, VideoPresets } from 'livekit-client';
import { useRouter, useSearchParams } from 'next/navigation';
import ConferenceHostView from './ConferenceHostView';
import ConferenceUserView from './ConferenceUserView';

interface ConferenceWrapperProps {
  token: string;
}

interface ConferenceInfo {
  id: string;
  title: string;
  status: string;
  role: 'admin' | 'user';
  participant_count: number;
  scheduled_at: string | null;
  duration_minutes: number;
  conference_type: 'instant' | 'scheduled';
  can_join: boolean;
  opens_at: string | null;
  share_name: string | null;
}

export default function ConferenceWrapper({ token }: ConferenceWrapperProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Pre-join state
  const [conferenceInfo, setConferenceInfo] = useState<ConferenceInfo | null>(null);
  const [name, setName] = useState('');
  const [joining, setJoining] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<string | null>(null);
  const [canJoinNow, setCanJoinNow] = useState(true);

  // Post-join state
  const [livekitToken, setLivekitToken] = useState<string | null>(null);
  const [livekitUrl, setLivekitUrl] = useState('');
  const [role, setRole] = useState<'admin' | 'user'>('user');
  const [participantName, setParticipantName] = useState('');
  const [conferenceTitle, setConferenceTitle] = useState('');
  const [conferenceId, setConferenceId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const [room] = useState(() => new Room({
    adaptiveStream: true,
    dynacast: true,
    videoCaptureDefaults: {
      resolution: VideoPresets.h720.resolution,
    },
    publishDefaults: {
      simulcast: true,
      videoSimulcastLayers: [VideoPresets.h360],
      videoCodec: 'vp8',
    },
  }));

  // Fetch conference info on mount
  useEffect(() => {
    (async () => {
      try {
        const sid = searchParams.get('sid');
        const sidParam = sid ? `${token.includes('?') ? '&' : '?'}sid=${sid}` : '';
        const res = await fetch(`/api/v1/conference/${token}${sidParam}`);
        const data = await res.json();
        if (!data.success) {
          setFetchError(data.error || 'Conference not found');
          return;
        }
        setConferenceInfo(data.data);
        // Auto-populate name from share record
        if (data.data.share_name) {
          setName(data.data.share_name);
        }
        // If URL has ?role=admin, verify it matches
        const urlRole = searchParams.get('role');
        if (urlRole === 'admin' && data.data.role !== 'admin') {
          setFetchError('Invalid admin link');
        }
      } catch {
        setFetchError('Failed to load conference');
      }
    })();
  }, [token, searchParams]);

  // Countdown timer for scheduled conferences
  useEffect(() => {
    if (!conferenceInfo) return;
    if (conferenceInfo.conference_type !== 'scheduled' || !conferenceInfo.opens_at) {
      setCanJoinNow(true);
      setCountdown(null);
      return;
    }
    // Admins can always join
    if (conferenceInfo.role === 'admin') {
      setCanJoinNow(true);
      setCountdown(null);
      return;
    }
    const opensAt = new Date(conferenceInfo.opens_at).getTime();
    const tick = () => {
      const diff = opensAt - Date.now();
      if (diff <= 0) {
        setCanJoinNow(true);
        setCountdown(null);
        return;
      }
      setCanJoinNow(false);
      const hrs = Math.floor(diff / 3600000);
      const mins = Math.floor((diff % 3600000) / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      if (hrs > 0) setCountdown(`${hrs}h ${mins}m ${secs}s`);
      else if (mins > 0) setCountdown(`${mins}m ${secs}s`);
      else setCountdown(`${secs}s`);
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [conferenceInfo]);

  // Join conference
  const handleJoin = useCallback(async () => {
    if (!name.trim() || !conferenceInfo) return;
    setJoining(true);
    try {
      const sid = searchParams.get('sid');
      const res = await fetch(`/api/v1/conference/${token}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), ...(sid ? { sid } : {}) }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error || 'Failed to join');
        setJoining(false);
        return;
      }
      setLivekitToken(data.data.livekit_token);
      setLivekitUrl(data.data.livekit_url);
      setRole(data.data.role);
      setParticipantName(data.data.participant_name);
      setConferenceTitle(data.data.conference_title);
      setConferenceId(data.data.conference_id);
    } catch {
      setError('Connection failed');
      setJoining(false);
    }
  }, [name, conferenceInfo, token, searchParams]);

  const leftRef = useRef(false);

  const handleDisconnected = useCallback((reason?: DisconnectReason) => {
    if (leftRef.current) return;
    const endReasons: (DisconnectReason | undefined)[] = [
      DisconnectReason.CLIENT_INITIATED,
      DisconnectReason.SERVER_SHUTDOWN,
      DisconnectReason.ROOM_DELETED,
      DisconnectReason.PARTICIPANT_REMOVED,
    ];
    if (endReasons.includes(reason)) {
      leftRef.current = true;
      setLivekitToken(null);
      setError('Conference ended');
    }
  }, []);

  const handleLeave = useCallback(() => {
    if (leftRef.current) return;
    leftRef.current = true;
    room.disconnect();
    setLivekitToken(null);
    setConferenceInfo(null);
    setFetchError('You have left the conference.');
  }, [room]);

  const handleEndConference = useCallback(async () => {
    try {
      await fetch(`/api/v1/conference/${token}`, { method: 'DELETE' });
    } catch { /* room deletion handles participant removal */ }
    leftRef.current = true;
    room.disconnect();
    setLivekitToken(null);
    setConferenceInfo(null);
    setFetchError('Conference ended.');
  }, [token, room]);

  // ── Error / ended state ──
  if (fetchError || error) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-950">
        <div className="text-center max-w-sm">
          <div className="mb-4 text-5xl">
            {fetchError === 'You have left the conference.' || fetchError === 'Conference ended.' ? '👋' : '⚠️'}
          </div>
          <h2 className="mb-2 text-lg font-semibold text-white">{fetchError || error}</h2>
          <p className="text-sm text-zinc-400 mb-6">
            {fetchError === 'Conference not found'
              ? 'This link may be invalid or the conference has ended.'
              : 'You can close this tab.'}
          </p>
        </div>
      </div>
    );
  }

  // ── Loading conference info ──
  if (!conferenceInfo) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-950">
        <div className="text-center">
          <div className="mb-3 h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-white mx-auto" />
          <p className="mt-2 text-sm text-zinc-400">Loading conference...</p>
        </div>
      </div>
    );
  }

  // ── Pre-join lobby ──
  if (!livekitToken) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-950">
        <div className="w-full max-w-md mx-4">
          <div className="bg-zinc-900 rounded-2xl p-8 border border-zinc-800">
            {/* Header */}
            <div className="text-center mb-8">
              <div className="w-16 h-16 rounded-2xl bg-emerald-600/20 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15.6 11.6L22 7v10l-6.4-4.5v-1Z" />
                  <rect width="14" height="10" x="2" y="7" rx="2" ry="2" />
                </svg>
              </div>
              <h1 className="text-xl font-bold text-white mb-1">{conferenceInfo.title}</h1>
              <p className="text-sm text-zinc-400">
                {conferenceInfo.role === 'admin' ? 'Joining as Host' : 'Joining as Participant'}
              </p>
              {conferenceInfo.participant_count > 0 && (
                <p className="text-xs text-zinc-500 mt-1">
                  {conferenceInfo.participant_count} already in conference
                </p>
              )}
              {conferenceInfo.conference_type === 'scheduled' && conferenceInfo.scheduled_at && (
                <p className="text-xs text-zinc-400 mt-2">
                  Scheduled: {new Date(conferenceInfo.scheduled_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })}
                </p>
              )}
            </div>

            {/* Countdown for scheduled conferences */}
            {!canJoinNow && countdown && (
              <div className="mb-6 rounded-xl bg-amber-900/20 border border-amber-700/30 p-4 text-center">
                <p className="text-sm text-amber-400 font-medium mb-1">Lobby opens soon</p>
                <p className="text-2xl font-bold text-amber-300 font-mono">{countdown}</p>
                <p className="text-xs text-amber-500 mt-1">You can join 5 minutes before the scheduled time</p>
              </div>
            )}

            {/* Name input — hidden when name is from share link */}
            {conferenceInfo.share_name ? (
              <div className="mb-6 rounded-xl bg-zinc-800/50 border border-zinc-700/50 p-4 text-center">
                <p className="text-sm text-zinc-400">Joining as</p>
                <p className="text-lg font-semibold text-white mt-1">{name}</p>
              </div>
            ) : (
              <div className="mb-6">
                <label className="block text-sm font-medium text-zinc-300 mb-2">Your Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                  placeholder="Enter your name"
                  className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  autoFocus
                  maxLength={50}
                />
              </div>
            )}

            {/* Join button */}
            <button
              onClick={handleJoin}
              disabled={!name.trim() || joining || !canJoinNow}
              className="w-full py-3 px-4 rounded-xl font-semibold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {joining ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Connecting...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M15.6 11.6L22 7v10l-6.4-4.5v-1Z" />
                    <rect width="14" height="10" x="2" y="7" rx="2" ry="2" />
                  </svg>
                  Join Conference
                </>
              )}
            </button>

            {conferenceInfo.status === 'ended' && (
              <p className="mt-4 text-center text-sm text-red-400">This conference has ended.</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── In-conference (LiveKit room) ──
  return (
    <LiveKitRoom
      token={livekitToken}
      serverUrl={livekitUrl}
      room={room}
      connect={true}
      audio={false}
      video={false}
      onDisconnected={handleDisconnected}
      onError={(err) => {
        console.error('[Conference] LiveKit error:', err);
        if (err?.message?.includes('Permission denied') || err?.message?.includes('NotAllowedError')) return;
        if (err?.message?.includes('getUserMedia') || err?.message?.includes('mediaDevices')) return;
        if (err?.message?.includes('Client initiated disconnect')) return;
        setError(`Connection error: ${err.message}`);
      }}
      className="h-screen"
    >
      {role === 'admin' ? (
        <ConferenceHostView
          conferenceTitle={conferenceTitle}
          conferenceToken={token}
          onEndConference={handleEndConference}
          onLeave={handleLeave}
        />
      ) : (
        <ConferenceUserView
          conferenceTitle={conferenceTitle}
          onLeave={handleLeave}
        />
      )}
    </LiveKitRoom>
  );
}
