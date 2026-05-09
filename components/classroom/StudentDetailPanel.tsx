'use client';

import { type Participant, ConnectionQuality } from 'livekit-client';
import VideoTile from './VideoTile';
import { cn } from '@/lib/utils';

interface AttentionData {
  email: string;
  name: string;
  attentionScore: number;
  isAttentive: boolean;
  faceDetected: boolean;
  faceCount: number;
  monitorState: string;
  eyesClosed: boolean;
  gazeAway: boolean;
  headYaw: number;
  headPitch: number;
  yawning: boolean;
  tabVisible: boolean;
  isInactive: boolean;
  isMobile: boolean;
  lastUpdate: number;
}

interface StudentDetailPanelProps {
  participant: Participant;
  attention: AttentionData | undefined;
  isMuted: boolean;
  onToggleMute: () => void;
  onClose: () => void;
  handRaised: boolean;
  connectionQuality?: ConnectionQuality;
  /** When true, hides the mute/unmute button (e.g. BC/AO monitors cannot mute students) */
  readOnly?: boolean;
}

function StatRow({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color?: string }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <div className="flex items-center gap-2 text-[#9aa0a6] text-xs">
        {icon}
        <span>{label}</span>
      </div>
      <span className={cn('text-xs font-medium', color || 'text-[#e8eaed]')}>{value}</span>
    </div>
  );
}

export default function StudentDetailPanel({
  participant,
  attention,
  isMuted,
  onToggleMute,
  onClose,
  handRaised,
  connectionQuality,
  readOnly = false,
}: StudentDetailPanelProps) {
  const displayName = participant.name || participant.identity;
  const att = attention;
  const score = att?.attentionScore ?? 100;

  const scoreColor = score >= 75 ? 'text-[#34a853]' : score >= 50 ? 'text-[#f9ab00]' : 'text-[#ea4335]';
  const scoreBg = score >= 75 ? 'bg-[#34a853]/15' : score >= 50 ? 'bg-[#f9ab00]/15' : 'bg-[#ea4335]/15';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
      <div
        className="relative flex w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-[#202124] shadow-2xl ring-1 ring-white/10 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white/70 hover:bg-black/60 hover:text-white transition-colors"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>

        {/* Large video */}
        <div className="relative aspect-video w-full bg-[#1a1c20]">
          <VideoTile
            participant={participant}
            size="large"
            showName={false}
            showMicIndicator={false}
            playAudio={true}
            handRaised={handRaised}
            connectionQuality={connectionQuality}
          />
        </div>

        {/* Student info + controls */}
        <div className="px-5 py-4">
          {/* Name row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#5f6368] text-sm font-semibold text-white">
                {displayName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)}
              </div>
              <div>
                <h3 className="text-base font-semibold text-[#e8eaed]">{displayName}</h3>
                <p className="text-xs text-[#9aa0a6]">{att?.email || participant.identity}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Mic toggle — hidden for read-only observers */}
              {!readOnly && (
              <button
                onClick={onToggleMute}
                className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-full transition-colors',
                  isMuted
                    ? 'bg-[#ea4335]/20 text-[#ea4335] hover:bg-[#ea4335]/30'
                    : 'bg-[#34a853]/20 text-[#34a853] hover:bg-[#34a853]/30'
                )}
                title={isMuted ? 'Unmute student' : 'Mute student'}
              >
                {isMuted ? (
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12L9 9z"/><path d="M15 9.34V4a3 3 0 0 0-5.94-.6"/><path d="M17 16.95A7 7 0 0 1 5 12v-2"/><path d="M19 10v1.17"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
                ) : (
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="1" width="6" height="12" rx="3"/><path d="M19 10v1a7 7 0 0 1-14 0v-1"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
                )}
              </button>
              )}
            </div>
          </div>

          {/* Hand raised indicator */}
          {handRaised && (
            <div className="mt-3 flex items-center gap-2 rounded-lg bg-[#f9ab00]/15 px-3 py-2 text-xs font-medium text-[#f9ab00]">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M18 11V6a2 2 0 0 0-4 0v5"/><path d="M14 10V4a2 2 0 0 0-4 0v6"/><path d="M10 10.5V2a2 2 0 0 0-4 0v8.5"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15V4a2 2 0 0 1 4 0v6"/></svg>
              Hand raised
            </div>
          )}

          {/* Attention monitoring section */}
          {att ? (
            <div className="mt-4 space-y-3">
              {/* Score bar */}
              <div className="flex items-center gap-3">
                <div className={cn('flex items-center gap-1.5 rounded-lg px-3 py-1.5', scoreBg)}>
                  <svg className={cn('h-4 w-4', scoreColor)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  <span className={cn('text-sm font-bold', scoreColor)}>{score}%</span>
                </div>
                <span className="text-xs text-[#9aa0a6]">Attention Score</span>
                <div className="flex-1 h-1.5 rounded-full bg-[#3c4043] overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all duration-500',
                      score >= 75 ? 'bg-[#34a853]' : score >= 50 ? 'bg-[#f9ab00]' : 'bg-[#ea4335]'
                    )}
                    style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
                  />
                </div>
              </div>

              {/* Status */}
              <div className="rounded-lg bg-[#292a2d] px-3 py-2">
                <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[#9aa0a6]">Status</div>
                <div className="space-y-0.5 divide-y divide-[#3c4043]/50">
                  <StatRow
                    icon={<svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>}
                    label="State"
                    value={att.monitorState === 'eyes_closed' ? 'Eyes Closed' : att.monitorState === 'looking_away' ? 'Looking Away' : att.monitorState === 'attentive' ? 'Attentive' : att.monitorState}
                    color={att.monitorState === 'attentive' ? 'text-[#34a853]' : att.monitorState === 'eyes_closed' ? 'text-[#ea4335]' : 'text-[#f9ab00]'}
                  />
                  <StatRow
                    icon={<svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>}
                    label="Face Detected"
                    value={att.faceDetected ? `Yes (${att.faceCount})` : 'No'}
                    color={att.faceDetected ? 'text-[#34a853]' : 'text-[#ea4335]'}
                  />
                  <StatRow
                    icon={<svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>}
                    label="Gaze"
                    value={att.gazeAway ? 'Away' : 'Focused'}
                    color={att.gazeAway ? 'text-[#f9ab00]' : 'text-[#34a853]'}
                  />
                  <StatRow
                    icon={<svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>}
                    label="Eyes"
                    value={att.eyesClosed ? 'Closed' : 'Open'}
                    color={att.eyesClosed ? 'text-[#ea4335]' : 'text-[#34a853]'}
                  />
                  <StatRow
                    icon={<svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>}
                    label="Yawning"
                    value={att.yawning ? 'Yes' : 'No'}
                    color={att.yawning ? 'text-[#f9ab00]' : 'text-[#9aa0a6]'}
                  />
                </div>
              </div>

              {/* Head pose + environment */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-[#292a2d] px-3 py-2">
                  <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[#9aa0a6]">Head Pose</div>
                  <div className="flex items-center justify-center gap-4 py-1">
                    <div className="text-center">
                      <div className="text-lg font-bold text-[#e8eaed]">{att.headYaw.toFixed(0)}°</div>
                      <div className="text-[10px] text-[#9aa0a6]">Yaw</div>
                    </div>
                    <div className="h-8 w-px bg-[#3c4043]" />
                    <div className="text-center">
                      <div className="text-lg font-bold text-[#e8eaed]">{att.headPitch.toFixed(0)}°</div>
                      <div className="text-[10px] text-[#9aa0a6]">Pitch</div>
                    </div>
                  </div>
                </div>
                <div className="rounded-lg bg-[#292a2d] px-3 py-2">
                  <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[#9aa0a6]">Environment</div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[#9aa0a6]">Tab Visible</span>
                      <span className={att.tabVisible ? 'text-[#34a853]' : 'text-[#ea4335]'}>{att.tabVisible ? 'Yes' : 'No'}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[#9aa0a6]">Active</span>
                      <span className={!att.isInactive ? 'text-[#34a853]' : 'text-[#ea4335]'}>{att.isInactive ? 'Inactive' : 'Active'}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[#9aa0a6]">Device</span>
                      <span className="text-[#e8eaed]">{att.isMobile ? 'Mobile' : 'Desktop'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-lg bg-[#292a2d] px-3 py-4 text-center text-xs text-[#9aa0a6]">
              No attention data available yet
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
