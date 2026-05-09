'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  useLocalParticipant,
  useDataChannel,
  useRoomContext,
} from '@livekit/components-react';
import { cn, fmtTimeIST } from '@/lib/utils';
import { sfxChatReceive, sfxChatSend } from '@/lib/sounds';
import { detectContact, reportViolation } from '@/lib/contact-detection';
import { safePublish } from '@/lib/livekit-safe-publish';

/**
 * ChatPanel — Realtime chat via LiveKit data channel.
 * Uses topic 'chat' for message exchange.
 * Teacher messages: right-aligned blue bubble.
 * Student/other messages: left-aligned grey bubble.
 *
 * Contact Detection: Scans outgoing messages for phone numbers,
 * social media handles, URLs, and other contact information.
 * Blocks the message, shows a warning, and logs the violation.
 */

export interface ChatPanelProps {
  roomId?: string;
  participantName: string;
  participantRole: string;
  participantEmail?: string;
  onClose?: () => void;
  className?: string;
  /** When set, outgoing messages are only sent to these participant identities (private messaging) */
  targetIdentities?: string[];
  /** Called when a new non-local message arrives (for unread badge tracking) */
  onNewMessage?: () => void;
}

interface ChatMessage {
  id: string;
  sender: string;
  text: string;
  role: string;
  timestamp: string;
  isLocal: boolean;
}

export default function ChatPanel({
  roomId,
  participantName,
  participantRole,
  participantEmail,
  onClose,
  className,
  targetIdentities,
  onNewMessage,
}: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [contactWarning, setContactWarning] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { localParticipant } = useLocalParticipant();

  // Track processed message IDs to avoid duplicates from callback + message state
  const processedIds = useRef(new Set<string>());

  // Handle incoming messages via callback
  const onDataReceived = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (msg: any) => {
      try {
        const payload = msg?.payload;
        if (!payload) return;
        const text = new TextDecoder().decode(payload);
        const data = JSON.parse(text) as {
          sender: string;
          text: string;
          role: string;
          timestamp: string;
        };
        // Students only see teacher messages (own messages are added at send time)
        if (participantRole === 'student' && data.role !== 'teacher') return;
        // De-duplicate using sender+timestamp+text
        const dedupeKey = `${data.sender}_${data.timestamp}_${data.text}`;
        if (processedIds.current.has(dedupeKey)) return;
        processedIds.current.add(dedupeKey);
        sfxChatReceive();
        onNewMessage?.();
        setMessages((prev) => [
          ...prev,
          {
            id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
            sender: data.sender,
            text: data.text,
            role: data.role,
            timestamp: data.timestamp,
            isLocal: false,
          },
        ]);
      } catch {
        // ignore malformed messages
      }
    },
    [participantRole, onNewMessage]
  );

  // Use the hook's send function and message state — ensures topic consistency
  const { message } = useDataChannel('chat', onDataReceived);
  const room = useRoomContext();

  // Load chat history from DB on mount (catches messages sent before component mounted)
  useEffect(() => {
    if (!roomId) return;
    (async () => {
      try {
        const res = await fetch(`/api/v1/room/${encodeURIComponent(roomId)}/chat`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.success && Array.isArray(data.data?.messages)) {
          const history: ChatMessage[] = [];
          for (const m of data.data.messages as { sender_name: string; message_text: string; sender_role: string; sent_at: string }[]) {
            // Students only see teacher messages and their own messages in history
            if (participantRole === 'student' && m.sender_role !== 'teacher' && m.sender_name !== participantName) continue;
            const dedupeKey = `${m.sender_name}_${m.sent_at}_${m.message_text}`;
            if (processedIds.current.has(dedupeKey)) continue;
            processedIds.current.add(dedupeKey);
            history.push({
              id: `hist_${Date.now()}_${Math.random().toString(36).slice(2)}`,
              sender: m.sender_name,
              text: m.message_text,
              role: m.sender_role,
              timestamp: m.sent_at,
              isLocal: m.sender_name === participantName,
            });
          }
          if (history.length > 0) setMessages(prev => [...history, ...prev]);
        }
      } catch { /* non-critical */ }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  // Also process messages arriving via the hook's message observable (fallback path)
  useEffect(() => {
    if (!message) return;
    try {
      const payload = message.payload;
      if (!payload) return;
      const text = new TextDecoder().decode(payload);
      const data = JSON.parse(text) as {
        sender: string;
        text: string;
        role: string;
        timestamp: string;
      };
      const dedupeKey = `${data.sender}_${data.timestamp}_${data.text}`;
      if (processedIds.current.has(dedupeKey)) return;
      processedIds.current.add(dedupeKey);
      // Students only see teacher messages via the fallback path too
      if (participantRole === 'student' && data.role !== 'teacher') return;
      setMessages((prev) => [
        ...prev,
        {
          id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
          sender: data.sender,
          text: data.text,
          role: data.role,
          timestamp: data.timestamp,
          isLocal: false,
        },
      ]);
    } catch {
      // ignore
    }
  }, [message]);

  // Auto-scroll to bottom on new message
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text) return;

    // ── Contact detection — block messages with contact info ──
    const detection = detectContact(text);
    if (detection.detected && detection.severity !== 'info') {
      // Block the message
      setContactWarning(
        detection.severity === 'critical'
          ? 'Sharing personal contact information (phone, email, social media) is not allowed.'
          : 'This message may contain contact information and has been blocked.'
      );
      // Auto-clear warning after 5 seconds
      setTimeout(() => setContactWarning(null), 5000);
      // Report violation to server (best-effort, don't await)
      if (roomId) {
        const email = participantEmail || localParticipant?.identity || '';
        reportViolation(
          roomId,
          email,
          participantName,
          participantRole,
          text,
          detection.patterns.join(', '),
          detection.severity,
        );
      }
      return; // Don't send the message
    }

    const msg = {
      sender: participantName,
      text,
      role: participantRole,
      timestamp: new Date().toISOString(),
    };

    try {
      const bytes = new TextEncoder().encode(JSON.stringify(msg));
      // Safe publish — guards against "PC manager is closed" when transport is briefly unavailable
      const ok = await safePublish(room, localParticipant, bytes, {
        topic: 'chat',
        reliable: true,
        ...(targetIdentities?.length ? { destinationIdentities: targetIdentities } : {}),
      });
      if (!ok) {
        // Connection not ready yet — show inline warning instead of throwing
        setContactWarning('Connection not ready — please try again in a moment.');
        setTimeout(() => setContactWarning(null), 4000);
        return;
      }
      sfxChatSend();

      // Persist to DB (fire-and-forget)
      if (roomId) {
        fetch(`/api/v1/room/${encodeURIComponent(roomId)}/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sender_name: msg.sender, message_text: msg.text, sent_at: msg.timestamp }),
        }).catch(() => {});
      }

      // Add to local messages
      const dedupeKey = `${msg.sender}_${msg.timestamp}_${msg.text}`;
      processedIds.current.add(dedupeKey);
      setMessages((prev) => [
        ...prev,
        {
          id: `${Date.now()}_local`,
          ...msg,
          isLocal: true,
        },
      ]);
      setInput('');
    } catch (err) {
      console.error('Failed to send chat message:', err);
      // Show visible error so user knows the message wasn't sent
      setContactWarning('Failed to send message. Please check your connection and try again.');
      setTimeout(() => setContactWarning(null), 5000);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatTime = (iso: string) => {
    try {
      return fmtTimeIST(iso);
    } catch {
      return '';
    }
  };

  return (
    <div className={cn('flex h-full flex-col bg-[#202124]', className)}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#3c4043] px-3 py-2 shrink-0">
        <span className="text-sm font-medium text-[#e8eaed]">Session Chat</span>
        {onClose && (
          <button
            onClick={onClose}
            className="text-[#9aa0a6] hover:text-[#e8eaed] text-sm"
          >
            ×
          </button>
        )}
      </div>

      {/* Messages area */}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-3 py-2 space-y-3">
        {messages.length === 0 && (
          <p className="text-center text-xs text-[#9aa0a6] mt-8">
            No messages yet. Say hello!
          </p>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn('flex flex-col min-w-0', msg.isLocal ? 'items-end' : 'items-start')}
          >
            <div className="flex items-baseline gap-1.5 mb-0.5">
              <span className="text-xs font-medium text-[#9aa0a6]">
                {msg.isLocal ? 'You' : msg.sender}
              </span>
              {!msg.isLocal && msg.role && (
                <span className="text-[10px] uppercase text-[#9aa0a6]">
                  ({msg.role})
                </span>
              )}
              <span className="text-[10px] text-[#9aa0a6]/80">
                {formatTime(msg.timestamp)}
              </span>
            </div>
            <div
              className={cn(
                'max-w-[85%] rounded-lg px-3 py-1.5 text-sm break-words whitespace-pre-wrap min-w-0',
                msg.isLocal
                  ? 'bg-[#1a73e8] text-white'
                  : 'bg-[#3c4043] text-[#e8eaed]'
              )}
            >
              {msg.text}
            </div>
          </div>
        ))}
      </div>

      {/* Contact detection warning */}
      {contactWarning && (
        <div className="mx-3 mb-1 rounded-lg bg-red-900/60 px-3 py-2 text-xs text-red-200 border border-red-700/50">
          <div className="flex items-center justify-between">
            <span>{contactWarning}</span>
            <button
              onClick={() => setContactWarning(null)}
              className="ml-2 text-red-300 hover:text-white text-xs"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Private messaging indicator */}
      {targetIdentities && targetIdentities.length > 0 && (
        <div className="flex items-center gap-1.5 border-b border-[#3c4043]/50 px-3 py-1">
          <svg className="h-3 w-3 text-[#8ab4f8]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          <span className="text-[10px] text-[#8ab4f8]">Private — messages sent to teacher only</span>
        </div>
      )}

      {/* Input area */}
      <div className="border-t border-[#3c4043] px-3 py-2">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            className="flex-1 rounded-lg bg-[#3c4043] px-3 py-2 text-sm text-[#e8eaed] placeholder:text-[#9aa0a6] outline-none focus:ring-1 focus:ring-[#8ab4f8]"
            maxLength={500}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim()}
            className="rounded-lg bg-[#1a73e8] px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-[#1557b0] disabled:opacity-50"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          </button>
        </div>
      </div>
    </div>
  );
}
