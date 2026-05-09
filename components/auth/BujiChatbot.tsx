'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, X, Maximize2, Shrink, Paperclip, FileText, Plus, MessageSquare, Trash2, Menu } from 'lucide-react';
import { usePlatformName } from '@/components/providers/PlatformProvider';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

// ── Buji animation paths (APNG for true alpha transparency) ──
const BUJI = {
  idle: '/buji/3 second resting.png',
  thinking: '/buji/4 second thinking.png',
  thinkingShort: '/buji/4 second thinking last2s.png',
  celebration: '/buji/1 second loading celebration.png',
  reading: '/buji/8 second reading.png',
};

// Shuffled button animations — cycles through with crossfade (>4s only)
const BUJI_SHUFFLE = [
  '/buji/8 second reading.png',
  '/buji/5 second fly.png',
  '/buji/5 second upside doown animation.png',
  '/buji/6 second reading and running.png',
];

// Duration (ms) each animation plays before crossfading to next
const SHUFFLE_DURATIONS = [8000, 5000, 5000, 6000];

type BujiState = 'idle' | 'thinking' | 'celebration';

const BADGE_MESSAGES = [
  'Ask me anything! 🎓',
  'Need help? 👋',
  'Hi there! 💬',
  'Let\'s chat! ✨',
  'Questions? 🤔',
];

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  fileName?: string;
  fileType?: 'image' | 'pdf';
  filePreviewUrl?: string;
}

interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

const STORAGE_KEY = 'buji-chat-history';
const MAX_CONVERSATIONS = 50;

function getStorageKey(userEmail?: string) {
  return userEmail ? `${STORAGE_KEY}-${userEmail}` : STORAGE_KEY;
}

function loadConversations(key: string): Conversation[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Conversation[];
    return parsed.sort((a, b) => b.updatedAt - a.updatedAt);
  } catch { return []; }
}

function saveConversations(convos: Conversation[], key: string) {
  try {
    const trimmed = convos.slice(0, MAX_CONVERSATIONS);
    localStorage.setItem(key, JSON.stringify(trimmed));
  } catch { /* quota exceeded — silently fail */ }
}

function generateTitle(messages: ChatMessage[]): string {
  const first = messages.find(m => m.role === 'user');
  if (!first) return 'New Chat';
  const text = first.content.replace(/📎\s*/g, '').trim();
  return text.length > 40 ? text.slice(0, 40) + '…' : text || 'New Chat';
}

function formatTimeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

// Group conversations: Today, Yesterday, Previous 7 Days, Older
function groupConversations(convos: Conversation[]): { label: string; items: Conversation[] }[] {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterdayStart = todayStart - 86400000;
  const weekStart = todayStart - 7 * 86400000;

  const groups: { label: string; items: Conversation[] }[] = [
    { label: 'Today', items: [] },
    { label: 'Yesterday', items: [] },
    { label: 'Previous 7 Days', items: [] },
    { label: 'Older', items: [] },
  ];

  for (const c of convos) {
    if (c.updatedAt >= todayStart) groups[0].items.push(c);
    else if (c.updatedAt >= yesterdayStart) groups[1].items.push(c);
    else if (c.updatedAt >= weekStart) groups[2].items.push(c);
    else groups[3].items.push(c);
  }

  return groups.filter(g => g.items.length > 0);
}

// ── Typewriter text reveal component (renders markdown progressively) ──
function TypewriterText({ text, speed = 12, onDone }: { text: string; speed?: number; onDone?: () => void }) {
  const [charCount, setCharCount] = useState(0);
  const indexRef = useRef(0);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    indexRef.current = 0;
    setCharCount(0);
    const interval = setInterval(() => {
      indexRef.current++;
      if (indexRef.current <= text.length) {
        setCharCount(indexRef.current);
      } else {
        clearInterval(interval);
        onDoneRef.current?.();
      }
    }, speed);
    return () => clearInterval(interval);
  }, [text, speed]);

  const displayed = text.slice(0, charCount);

  return (
    <div className="buji-markdown">
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
        {displayed}
      </ReactMarkdown>
      {charCount < text.length && (
        <span className="inline-block w-[2px] h-[14px] bg-emerald-400/80 ml-0.5 align-middle animate-pulse" />
      )}
    </div>
  );
}

// ── Markdown content renderer for completed messages ──
function MarkdownContent({ content }: { content: string }) {
  return (
    <div className="buji-markdown">
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
        {content}
      </ReactMarkdown>
    </div>
  );
}

interface BujiProps {
  userEmail?: string;
  userName?: string;
  userContext?: string;
}

export default function BujiChatbot({ userEmail, userName, userContext }: BujiProps = {}) {
  const platformName = usePlatformName();
  const storageKey = getStorageKey(userEmail);
  const [isOpen, setIsOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [bujiState, setBujiState] = useState<BujiState>('idle');
  const [isAnimatingOpen, setIsAnimatingOpen] = useState(false);
  const [isAnimatingClose, setIsAnimatingClose] = useState(false);
  const [badgeIndex, setBadgeIndex] = useState(0);
  const [badgeVisible, setBadgeVisible] = useState(true);
  const [badgePhase, setBadgePhase] = useState<'text' | 'dots'>('text');
  const [shuffleIndex, setShuffleIndex] = useState(0);
  const [shuffleFading, setShuffleFading] = useState(false);
  const [typingMsgIndex, setTypingMsgIndex] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const celebrationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shuffleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingPreview, setPendingPreview] = useState<string | null>(null);

  // ── Drag state ──
  const [dragPos, setDragPos] = useState<{ right: number; bottom: number } | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; startRight: number; startBottom: number; moved: boolean; pointerId: number; el: HTMLElement } | null>(null);

  function onDragStart(e: React.PointerEvent) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const curRight = vw - rect.right;
    const curBottom = vh - rect.bottom;
    // Store pointerId and element but do NOT setPointerCapture yet.
    // Capturing immediately suppresses click events on desktop because pointerup
    // is redirected to the capturing element, preventing the button's click from firing.
    // We only capture once real drag movement is detected in onDragMove.
    dragRef.current = {
      startX: e.clientX, startY: e.clientY,
      startRight: curRight, startBottom: curBottom,
      moved: false, pointerId: e.pointerId,
      el: e.currentTarget as HTMLElement,
    };
  }

  function onDragMove(e: React.PointerEvent) {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
      if (!dragRef.current.moved) {
        // First time drag threshold crossed — now safe to capture
        dragRef.current.el.setPointerCapture(dragRef.current.pointerId);
      }
      dragRef.current.moved = true;
    }
    if (!dragRef.current.moved) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const newRight = Math.max(0, Math.min(vw - 60, dragRef.current.startRight - dx));
    const newBottom = Math.max(0, Math.min(vh - 60, dragRef.current.startBottom - dy));
    setDragPos({ right: newRight, bottom: newBottom });
  }

  function onDragEnd(e: React.PointerEvent) {
    if (!dragRef.current) return;
    const wasDrag = dragRef.current.moved;
    dragRef.current = null;
    if (!wasDrag) setDragPos(prev => prev); // no-op to keep position
  }

  // ── Chat History State ──
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvoId, setActiveConvoId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Load conversations from localStorage on mount
  useEffect(() => {
    setConversations(loadConversations(storageKey));
  }, [storageKey]);

  // Persist conversations to localStorage when they change
  const persistRef = useRef(conversations);
  persistRef.current = conversations;
  useEffect(() => {
    if (conversations.length > 0 || localStorage.getItem(storageKey)) {
      saveConversations(conversations, storageKey);
    }
  }, [conversations, storageKey]);

  // Save current chat to active conversation whenever messages change
  useEffect(() => {
    if (!activeConvoId || messages.length === 0) return;
    setConversations(prev => {
      const idx = prev.findIndex(c => c.id === activeConvoId);
      if (idx === -1) return prev;
      const updated = [...prev];
      updated[idx] = {
        ...updated[idx],
        messages: messages.map(m => ({ role: m.role, content: m.content, fileName: m.fileName, fileType: m.fileType })),
        title: generateTitle(messages),
        updatedAt: Date.now(),
      };
      return updated.sort((a, b) => b.updatedAt - a.updatedAt);
    });
  }, [messages, activeConvoId]);

  // Scroll to bottom on new messages / during typewriter
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typingMsgIndex]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && !loading) {
      setTimeout(() => inputRef.current?.focus(), 350);
    }
  }, [isOpen, loading]);

  // Cleanup timers
  useEffect(() => {
    return () => {
      if (celebrationTimer.current) clearTimeout(celebrationTimer.current);
      if (shuffleTimer.current) clearTimeout(shuffleTimer.current);
    };
  }, []);

  // Shuffle animation with crossfade — runs for both button and header
  useEffect(() => {
    const scheduleNext = () => {
      shuffleTimer.current = setTimeout(() => {
        setShuffleFading(true);
        setTimeout(() => {
          setShuffleIndex((prev) => (prev + 1) % BUJI_SHUFFLE.length);
          setShuffleFading(false);
        }, 400);
      }, SHUFFLE_DURATIONS[shuffleIndex]);
    };
    scheduleNext();
    return () => {
      if (shuffleTimer.current) clearTimeout(shuffleTimer.current);
    };
  }, [shuffleIndex]);

  // Badge message rotation
  useEffect(() => {
    if (isOpen) return;
    const interval = setInterval(() => {
      setBadgePhase('dots');
      setTimeout(() => {
        setBadgeIndex((prev) => (prev + 1) % BADGE_MESSAGES.length);
        setBadgePhase('text');
      }, 1200);
    }, 4000);
    return () => clearInterval(interval);
  }, [isOpen]);

  // Badge entrance delay
  useEffect(() => {
    setBadgeVisible(false);
    const timer = setTimeout(() => setBadgeVisible(true), 1500);
    return () => clearTimeout(timer);
  }, []);

  const openChat = useCallback(() => {
    setIsAnimatingOpen(true);
    setIsOpen(true);
    setTimeout(() => setIsAnimatingOpen(false), 800);
  }, []);

  const closeChat = useCallback(() => {
    setIsAnimatingClose(true);
    setIsFullscreen(false);
    setSidebarOpen(false);
    setTimeout(() => {
      setIsOpen(false);
      setIsAnimatingClose(false);
    }, 500);
  }, []);

  function startNewChat() {
    const id = crypto.randomUUID();
    setMessages([]);
    setActiveConvoId(id);
    setTypingMsgIndex(null);
    setBujiState('idle');
    setSidebarOpen(false);
    // Don't create the conversation entry yet — it'll be created on first message
  }

  function switchToConversation(convo: Conversation) {
    setMessages(convo.messages);
    setActiveConvoId(convo.id);
    setTypingMsgIndex(null);
    setBujiState('idle');
    setSidebarOpen(false);
  }

  function deleteConversation(id: string) {
    setDeletingId(id);
    setTimeout(() => {
      setConversations(prev => prev.filter(c => c.id !== id));
      if (activeConvoId === id) {
        setMessages([]);
        setActiveConvoId(null);
      }
      setDeletingId(null);
    }, 200);
  }

  // Ensure there's an active conversation when sending
  function ensureConversation(): string {
    if (activeConvoId) {
      // Create the conversation entry if it doesn't exist yet
      const exists = conversations.some(c => c.id === activeConvoId);
      if (!exists) {
        const newConvo: Conversation = {
          id: activeConvoId,
          title: 'New Chat',
          messages: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        setConversations(prev => [newConvo, ...prev]);
      }
      return activeConvoId;
    }
    const id = crypto.randomUUID();
    const newConvo: Conversation = {
      id,
      title: 'New Chat',
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setConversations(prev => [newConvo, ...prev]);
    setActiveConvoId(id);
    return id;
  }

  async function handleSend() {
    const text = input.trim();
    const file = pendingFile;
    const preview = pendingPreview;
    if (!text && !file) return;
    if (loading) return;

    ensureConversation();

    setInput('');
    setPendingFile(null);
    setPendingPreview(null);

    const userMsg: ChatMessage = {
      role: 'user',
      content: text || (file ? `📎 ${file.name}` : ''),
      ...(file && {
        fileName: file.name,
        fileType: (file.type.startsWith('image/') ? 'image' : 'pdf') as 'image' | 'pdf',
        filePreviewUrl: preview || undefined,
      }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);
    setBujiState('thinking');

    try {
      let res: Response;

      if (file) {
        const formData = new FormData();
        formData.append('message', text);
        formData.append('file', file);
        formData.append('history', JSON.stringify(messages.slice(-10)));
        if (userContext) formData.append('userContext', userContext);
        res = await fetch('/api/v1/chatbot', { method: 'POST', body: formData });
      } else {
        res = await fetch('/api/v1/chatbot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: text, history: messages.slice(-10), userContext }),
        });
      }

      const data = await res.json();
      const reply = data.reply || data.error || "Sorry, I couldn't understand that. Try again!";

      setBujiState('celebration');
      setMessages((prev) => {
        const updated = [...prev, { role: 'assistant' as const, content: reply }];
        setTypingMsgIndex(updated.length - 1);
        return updated;
      });

      celebrationTimer.current = setTimeout(() => setBujiState('idle'), 2000);
    } catch {
      setMessages((prev) => {
        const updated = [...prev, { role: 'assistant' as const, content: "Oops! I'm having trouble connecting. Please try again." }];
        setTypingMsgIndex(updated.length - 1);
        return updated;
      });
      setBujiState('idle');
    } finally {
      setLoading(false);
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
    if (!allowed.includes(file.type) || file.size > 10 * 1024 * 1024) return;
    if (pendingPreview) URL.revokeObjectURL(pendingPreview);
    setPendingFile(file);
    setPendingPreview(file.type.startsWith('image/') ? URL.createObjectURL(file) : null);
    e.target.value = '';
  }

  function handleQuickAction(q: string) {
    ensureConversation();
    setMessages([{ role: 'user', content: q }]);
    setLoading(true);
    setBujiState('thinking');
    fetch('/api/v1/chatbot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: q, history: [], userContext }),
    })
      .then((r) => r.json())
      .then((data) => {
        setBujiState('celebration');
        setMessages((prev) => {
          const updated = [...prev, { role: 'assistant' as const, content: data.reply || 'Please try again!' }];
          setTypingMsgIndex(updated.length - 1);
          return updated;
        });
        setTimeout(() => setBujiState('idle'), 2000);
      })
      .catch(() => {
        setMessages((prev) => {
          const updated = [...prev, { role: 'assistant' as const, content: 'Connection error. Please try again.' }];
          setTypingMsgIndex(updated.length - 1);
          return updated;
        });
        setBujiState('idle');
      })
      .finally(() => setLoading(false));
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const headerGif = BUJI_SHUFFLE[shuffleIndex];
  const grouped = groupConversations(conversations);
  const hasHistory = conversations.length > 0;

  const chatWindowClass = isFullscreen
    ? 'fixed inset-0 z-50 flex flex-col overflow-hidden bg-gray-950'
    : 'fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 w-[calc(100vw-2rem)] sm:w-[400px] h-[min(600px,calc(100vh-3rem))] flex flex-col rounded-2xl overflow-hidden bg-gray-950';

  return (
    <>
      {/* ── Floating Buji Button ─────────────────────────── */}
      {!isOpen && (
        <div
          className="fixed z-50 flex flex-col items-center touch-none select-none"
          style={dragPos
            ? { right: dragPos.right, bottom: dragPos.bottom }
            : { right: '1rem', bottom: '1rem' }
          }
          onPointerDown={onDragStart}
          onPointerMove={onDragMove}
          onPointerUp={onDragEnd}
          onPointerCancel={onDragEnd}
        >
          {/* Speech bubble on TOP — near Buji's mouth */}
          {badgeVisible && (
            <div className="relative mb-1 animate-badge-in">
              <div className="relative bg-white/95 dark:bg-emerald-950/90 backdrop-blur-md rounded-2xl px-3.5 py-2 shadow-lg shadow-black/10 dark:shadow-black/30 border border-emerald-200/50 dark:border-emerald-500/20 min-w-[130px] max-w-[170px]">
                {badgePhase === 'text' ? (
                  <p className="text-[12px] font-medium text-emerald-800 dark:text-emerald-200 animate-badge-text-in leading-snug text-center">
                    {BADGE_MESSAGES[badgeIndex]}
                  </p>
                ) : (
                  <div className="flex gap-1 py-0.5 justify-center">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/70 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/70 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/70 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                )}
              </div>
              <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white/95 dark:bg-emerald-950/90 border-r border-b border-emerald-200/50 dark:border-emerald-500/20 transform rotate-45" />
            </div>
          )}

          {/* Buji character — shuffling with crossfade */}
          <button
            onClick={(e) => { if (dragRef.current?.moved) { e.preventDefault(); return; } openChat(); }}
            className="group cursor-pointer relative shrink-0 buji-float"
            aria-label="Chat with Buji"
          >
            <div className="absolute inset-0 rounded-full bg-emerald-400/0 group-hover:bg-emerald-400/10 transition-all duration-500 scale-110 blur-xl pointer-events-none" />
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-20 h-4 bg-black/10 dark:bg-emerald-400/10 rounded-full blur-lg group-hover:w-24 group-hover:bg-emerald-400/15 transition-all duration-300" />
            <div className="relative w-28 h-28 sm:w-36 sm:h-36 group-hover:scale-115 group-active:scale-90 transition-transform duration-300 ease-out drop-shadow-[0_6px_20px_rgba(16,185,129,0.3)] group-hover:drop-shadow-[0_8px_30px_rgba(16,185,129,0.5)]">
              <img
                src={BUJI_SHUFFLE[shuffleIndex]}
                alt="Buji"
                className="w-full h-full object-contain transition-opacity duration-400 ease-in-out"
                style={{ opacity: shuffleFading ? 0 : 1 }}
                loading="eager"
              />
              {/* Demo badge on the floating button */}
              <span className="absolute -top-1 -right-1 rounded-full bg-amber-400 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-amber-900 shadow-md shadow-amber-400/40 ring-2 ring-gray-950/60">DEMO</span>
            </div>
          </button>
        </div>
      )}

      {/* ── Chat Window ──────────────────────────────────── */}
      {isOpen && (
        <div
          className={`${chatWindowClass} border border-emerald-500/20 shadow-2xl shadow-black/40 transition-all duration-300 ease-out ${
            isAnimatingClose
              ? 'animate-chatbot-close'
              : isAnimatingOpen
              ? 'animate-chatbot-open'
              : ''
          }`}
          style={{ transformOrigin: isFullscreen ? 'center center' : 'bottom right' }}
        >
          {/* ── Sidebar Overlay ────────────────────────── */}
          <div className={`absolute inset-0 z-30 ${sidebarOpen ? '' : 'pointer-events-none'}`}>
            <div
              className={`absolute inset-0 bg-black/50 transition-opacity duration-300 ${sidebarOpen ? 'opacity-100' : 'opacity-0'}`}
              onClick={() => setSidebarOpen(false)}
            />
            <div className={`absolute top-0 left-0 bottom-0 w-[280px] max-w-[80%] bg-gradient-to-b from-emerald-950 via-gray-950 to-gray-950 border-r border-emerald-500/20 flex flex-col shadow-2xl shadow-black/60 transition-transform duration-300 ease-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
              <div className="flex items-center justify-between px-4 py-3 border-b border-emerald-500/15 shrink-0">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full overflow-hidden border border-emerald-400/30 bg-emerald-950">
                    <img src={BUJI.idle} alt="Buji" className="w-full h-full object-cover" />
                  </div>
                  <span className="text-sm font-semibold text-white">Buji</span>
                </div>
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-white/10 text-emerald-200/50 hover:text-white transition-colors cursor-pointer"
                  aria-label="Close sidebar"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="px-3 py-3">
                <button
                  onClick={startNewChat}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/20 hover:border-emerald-400/30 text-emerald-200 text-sm font-medium transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  New Chat
                </button>
              </div>
              <div className="flex-1 overflow-y-auto scrollbar-thin">
                {conversations.length === 0 ? (
                  <div className="px-4 py-8 text-center">
                    <p className="text-xs text-emerald-200/30">No conversations yet</p>
                  </div>
                ) : (
                  <div className="pb-2">
                    {grouped.map(group => (
                      <div key={group.label}>
                        <div className="px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-emerald-400/40">
                          {group.label}
                        </div>
                        {group.items.map(convo => (
                          <div
                            key={convo.id}
                            className={`group flex items-center gap-2 mx-2 px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-150 ${
                              convo.id === activeConvoId
                                ? 'bg-emerald-500/15 border border-emerald-500/20'
                                : 'hover:bg-white/5 border border-transparent'
                            } ${deletingId === convo.id ? 'opacity-0 scale-95 transition-all duration-200' : ''}`}
                            onClick={() => switchToConversation(convo)}
                          >
                            <MessageSquare className="w-3.5 h-3.5 text-emerald-400/40 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-[12px] text-emerald-50 truncate leading-snug">{convo.title}</p>
                              <p className="text-[10px] text-emerald-200/30 mt-0.5">
                                {convo.messages.length} msg{convo.messages.length !== 1 ? 's' : ''} · {formatTimeAgo(convo.updatedAt)}
                              </p>
                            </div>
                            <button
                              onClick={(e) => { e.stopPropagation(); deleteConversation(convo.id); }}
                              className="p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-red-500/15 text-emerald-200/30 hover:text-red-400 transition-all cursor-pointer"
                              aria-label="Delete"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="px-4 py-3 border-t border-emerald-500/10 shrink-0">
                <p className="text-[10px] text-emerald-200/20 text-center">{conversations.length} conversation{conversations.length !== 1 ? 's' : ''}</p>
              </div>
            </div>
          </div>

          {/* ── Header ─────────────────────────────────── */}
          <div className="relative flex items-center gap-2 px-3 py-3 bg-gradient-to-r from-emerald-900/95 via-emerald-950/95 to-teal-950/95 backdrop-blur-xl border-b border-emerald-500/15 shrink-0">
            <button
              onClick={() => setSidebarOpen(s => !s)}
              className="p-1.5 rounded-lg hover:bg-white/10 text-emerald-200/60 hover:text-white transition-colors cursor-pointer"
              aria-label="Toggle sidebar"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="w-9 h-9 rounded-full overflow-hidden border border-emerald-400/40 bg-emerald-950 shrink-0">
              <img
                src={headerGif}
                alt="Buji"
                className="w-full h-full object-cover transition-opacity duration-400"
                style={{ opacity: shuffleFading ? 0 : 1 }}
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-white leading-tight">Buji</h3>
                <span className="inline-flex items-center rounded-full bg-amber-400/20 border border-amber-400/40 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-300">Demo</span>
              </div>
              <p className="text-[11px] text-emerald-300/70 flex items-center gap-1.5">
                {loading ? (
                  <>
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                    Thinking...
                  </>
                ) : (
                  <>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    {platformName} AI Assistant
                  </>
                )}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={startNewChat}
                className="p-1.5 rounded-lg hover:bg-white/10 text-emerald-200/60 hover:text-white transition-colors cursor-pointer"
                aria-label="New chat"
                title="New chat"
              >
                <Plus className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsFullscreen((f) => !f)}
                className="p-1.5 rounded-lg hover:bg-white/10 text-emerald-200/60 hover:text-white transition-colors cursor-pointer"
                aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
              >
                {isFullscreen ? <Shrink className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
              <button
                onClick={() => {
                  closeChat();
                  setBujiState('idle');
                  setTypingMsgIndex(null);
                }}
                className="p-1.5 rounded-lg hover:bg-white/10 text-emerald-200/60 hover:text-white transition-colors cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* ── Messages Area ──────────────────────────── */}
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-gradient-to-b from-gray-950 via-gray-950 to-emerald-950 scrollbar-thin">
                {/* Welcome message */}
                {messages.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full text-center px-4 animate-fade-in">
                    <div className="w-28 h-28 rounded-2xl overflow-hidden mb-4 border border-emerald-500/20 shadow-lg shadow-emerald-500/10 bg-emerald-950/50">
                      <img
                        src={BUJI.reading}
                        alt="Buji reading"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <h4 className="text-lg font-semibold text-white mb-1.5">{userName ? `Hi ${userName.split(' ')[0]}! 👋` : "Hi, I'm Buji! 👋"}</h4>
                    <p className="text-sm text-emerald-200/60 mb-5 max-w-[280px]">
                      {userName ? `Your personal ${platformName} AI assistant. I know your classes, exams, and schedule!` : `Your ${platformName} AI assistant. Ask me anything about our live classes, demo sessions, or enrollment!`}
                    </p>
                    <div className="flex flex-wrap justify-center gap-2">
                      {(userName ? [
                        'My upcoming sessions',
                        'My attendance summary',
                        'My exam scores',
                        'My pending fees',
                      ] : [
                        'How do classes work?',
                        'Book a demo',
                        'Fee structure',
                        'Subjects offered',
                      ]).map((q) => (
                        <button
                          key={q}
                          onClick={() => handleQuickAction(q)}
                          className="px-3 py-1.5 rounded-full text-xs font-medium bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 hover:bg-emerald-500/20 hover:border-emerald-400/30 transition-all duration-200 cursor-pointer"
                        >
                          {q}
                        </button>
                      ))}
                    </div>

                    {/* Recent chats shortcut below welcome */}
                    {hasHistory && (
                      <div className="mt-6 w-full max-w-[300px]">
                        <button
                          onClick={() => setSidebarOpen(true)}
                          className="flex items-center gap-2 text-[11px] text-emerald-300/40 hover:text-emerald-300/70 transition-colors cursor-pointer mx-auto mb-2"
                        >
                          <MessageSquare className="w-3 h-3" />
                          Recent conversations
                        </button>
                        <div className="space-y-1">
                          {conversations.slice(0, 3).map(convo => (
                            <button
                              key={convo.id}
                              onClick={() => switchToConversation(convo)}
                              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-white/3 hover:bg-white/6 border border-white/5 hover:border-emerald-500/15 text-left transition-all cursor-pointer"
                            >
                              <MessageSquare className="w-3 h-3 text-emerald-400/30 shrink-0" />
                              <span className="text-[11px] text-emerald-100/50 truncate flex-1">{convo.title}</span>
                              <span className="text-[9px] text-emerald-200/20 shrink-0">{formatTimeAgo(convo.updatedAt)}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Chat messages */}
                {messages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-message-in`}
                  >
                    {/* Buji avatar — shows last-2s thinking during typewriter */}
                    {msg.role === 'assistant' && (
                      <div className="w-7 h-7 rounded-full overflow-hidden border border-emerald-500/30 shrink-0 mt-0.5 bg-emerald-950">
                        <img
                          src={i === typingMsgIndex ? BUJI.thinkingShort : BUJI.idle}
                          alt="Buji"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    <div
                      className={`max-w-[80%] px-3.5 py-2.5 rounded-2xl text-[13px] leading-relaxed ${
                        msg.role === 'user'
                          ? 'bg-emerald-600/80 text-white rounded-br-md'
                          : 'bg-white/12 text-emerald-50 border border-white/8 rounded-bl-md'
                      }`}
                    >
                      {msg.fileName && (
                        <div className="mb-1.5">
                          {msg.fileType === 'image' && msg.filePreviewUrl ? (
                            <img src={msg.filePreviewUrl} alt={msg.fileName} className="w-full max-w-[180px] rounded-lg mb-1" />
                          ) : msg.fileType === 'pdf' ? (
                            <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/10 mb-1 w-fit">
                              <FileText className="w-3.5 h-3.5 shrink-0" />
                              <span className="text-[11px] truncate max-w-[150px]">{msg.fileName}</span>
                            </div>
                          ) : null}
                        </div>
                      )}
                      {msg.role === 'assistant' && i === typingMsgIndex ? (
                        <TypewriterText
                          text={msg.content}
                          speed={12}
                          onDone={() => setTypingMsgIndex(null)}
                        />
                      ) : msg.role === 'assistant' ? (
                        <MarkdownContent content={msg.content} />
                      ) : (
                        msg.content
                      )}
                    </div>
                  </div>
                ))}

                {/* Typing indicator — bouncing dots while waiting for API */}
                {loading && (
                  <div className="flex gap-2.5 justify-start animate-message-in">
                    <div className="w-7 h-7 rounded-full overflow-hidden border border-emerald-500/30 shrink-0 mt-0.5 bg-emerald-950">
                      <img
                        src={BUJI.thinking}
                        alt="Buji thinking"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="px-4 py-3 rounded-2xl rounded-bl-md bg-white/8 border border-white/5">
                      <div className="flex gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-400/70 animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-2 h-2 rounded-full bg-emerald-400/70 animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-2 h-2 rounded-full bg-emerald-400/70 animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* ── Input Area ─────────────────────────────── */}
              <div className="border-t border-emerald-500/10 bg-gray-950 shrink-0">
                {pendingFile && (
                  <div className="px-3 pt-2.5 flex items-center gap-2">
                    {pendingFile.type.startsWith('image/') && pendingPreview ? (
                      <img src={pendingPreview} alt="" className="w-14 h-14 rounded-lg object-cover border border-emerald-500/20" />
                    ) : (
                      <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/5 border border-emerald-500/15">
                        <FileText className="w-4 h-4 text-emerald-400" />
                        <span className="text-xs text-emerald-200/70 truncate max-w-[200px]">{pendingFile.name}</span>
                      </div>
                    )}
                    <button
                      onClick={() => { if (pendingPreview) URL.revokeObjectURL(pendingPreview); setPendingFile(null); setPendingPreview(null); }}
                      className="p-1 rounded-full hover:bg-white/10 text-emerald-200/50 hover:text-white transition-colors cursor-pointer"
                      aria-label="Remove file"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
                <div className="px-3 py-3">
                  <div className="flex items-center gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/gif,image/webp,application/pdf"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={loading}
                      className="h-10 w-10 rounded-xl bg-white/5 border border-emerald-500/15 hover:bg-white/10 hover:border-emerald-400/30 disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center text-emerald-300/60 hover:text-emerald-200 transition-all duration-200 cursor-pointer shrink-0"
                      aria-label="Attach file"
                    >
                      <Paperclip className="w-4 h-4" />
                    </button>
                    <input
                      ref={inputRef}
                      type="text"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder={pendingFile ? 'Add a message or send...' : 'Ask Buji anything...'}
                      disabled={loading}
                      maxLength={500}
                      className="flex-1 h-10 px-4 rounded-xl bg-white/5 border border-emerald-500/15 text-white text-sm placeholder:text-emerald-200/30 outline-none focus:border-emerald-400/40 focus:ring-1 focus:ring-emerald-400/20 transition-all duration-200 disabled:opacity-50"
                    />
                    <button
                      onClick={handleSend}
                      disabled={(!input.trim() && !pendingFile) || loading}
                      className="h-10 w-10 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center text-white transition-all duration-200 active:scale-95 cursor-pointer shrink-0"
                      aria-label="Send message"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-[10px] text-emerald-200/25 text-center mt-1.5">
                    Powered by {platformName} AI
                  </p>
                </div>
              </div>
        </div>
      )}
    </>
  );
}
