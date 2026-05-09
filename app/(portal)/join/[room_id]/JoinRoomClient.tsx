'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { fmtDateShortLocal, fmtTimeLocal } from '@/lib/utils';
import Script from 'next/script';
import {
  Video, Calendar, Clock, CheckCircle2, AlertCircle,
  Loader2, Timer, CreditCard, Shield, Ban,
} from 'lucide-react';
import { usePlatformName } from '@/components/providers/PlatformProvider';

interface Props {
  roomId: string;
  roomName: string;
  subject: string;
  grade: string;
  status: string;
  scheduledStart: string;
  durationMinutes: number;
  teacherEmail: string | null;
  userName: string;
  userEmail: string;
  userRole: string;
  emailToken: string | null;
  device: string;
}

interface RazorpayOrder {
  orderId: string;
  amount: number;
  currency: string;
  gatewayKeyId: string;
  callbackUrl: string;
  prefill: { name: string; email: string };
  mode: string;
}

interface PaymentInfo {
  paymentRequired: boolean;
  paid?: boolean;
  reason?: string;
  invoiceId?: string;
  invoiceIds?: string[];
  invoiceNumber?: string;
  amount?: number;
  amountFormatted?: string;
  currency?: string;
  perHourRate?: number;
  durationMinutes?: number;
  description?: string;
  extensionDue?: boolean;
  creditsExhausted?: boolean;
  totalAllotted?: number;
  totalUsed?: number;
  message?: string;
  batchFlatFee?: boolean;
  batchName?: string;
  items?: { label: string; amount: number; amountFormatted: string }[];
  order?: RazorpayOrder;
}

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => { open: () => void };
  }
}

function fmtCountdown(ms: number): string {
  if (ms <= 0) return '0s';
  const totalSec = Math.ceil(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}
export default function JoinRoomClient({
  roomId, roomName, subject, grade, status,
  scheduledStart, durationMinutes, teacherEmail,
  userName, userEmail, userRole, emailToken, device,
}: Props) {
  const platformName = usePlatformName();
  const router = useRouter();
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState('');
  const [invoiceBlocked, setInvoiceBlocked] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [waitingForTeacher, setWaitingForTeacher] = useState(false);
  const [pollCount, setPollCount] = useState(0);

  // Payment state
  const [paymentInfo, setPaymentInfo] = useState<PaymentInfo | null>(null);
  const [checkingPayment, setCheckingPayment] = useState(false);
  const [paying, setPaying] = useState(false);
  const [paymentComplete, setPaymentComplete] = useState(false);
  const [razorpayLoaded, setRazorpayLoaded] = useState(false);

  useEffect(() => setMounted(true), []);

  const startDate = new Date(scheduledStart);
  const lobbyOpenTime = new Date(startDate.getTime() - 15 * 60 * 1000);

  const isLive = status === 'live';
  const isScheduled = status === 'scheduled';
  const isEnded = status === 'ended';
  const lobbyOpen = now >= lobbyOpenTime;
  const sessionTimeReached = now >= startDate;
  const canJoin = lobbyOpen && !isEnded;
  const msUntilLobby = lobbyOpenTime.getTime() - now.getTime();
  const msUntilStart = startDate.getTime() - now.getTime();

  const isDemo = roomId.startsWith('demo_');
  const needsPaymentCheck = !isDemo && ['student', 'parent'].includes(userRole);
  const paymentResolved = !needsPaymentCheck || paymentComplete ||
    (paymentInfo !== null && !paymentInfo.paymentRequired);

  const needsTick = useCallback(() => {
    return mounted && !isEnded && !sessionTimeReached;
  }, [mounted, isEnded, sessionTimeReached]);

  useEffect(() => {
    if (!needsTick()) return;
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, [needsTick]);

  // Check payment on mount for students/parents
  useEffect(() => {
    if (!needsPaymentCheck || !mounted) return;
    checkPayment();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, needsPaymentCheck]);

  async function checkPayment() {
    setCheckingPayment(true);
    setPaymentComplete(false); // Reset in case re-checking after extension payment
    try {
      const res = await fetch('/api/v1/payment/session-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room_id: roomId }),
      });
      const data = await res.json();
      if (data.success) {
        setPaymentInfo(data.data);
        if (!data.data.paymentRequired || data.data.paid) {
          setPaymentComplete(true);
        }
      }
    } catch (err) {
      console.error('Payment check failed:', err);
      setPaymentComplete(true); // dont block on network error
    } finally {
      setCheckingPayment(false);
    }
  }

  async function handlePayment() {
    if (!paymentInfo?.order) return;
    setPaying(true);
    setError('');
    const order = paymentInfo.order;

    if (order.mode === 'test' || order.mode === 'mock') {
      try {
        // Support combined payment: send all invoice IDs
        const invoiceIds = paymentInfo.invoiceIds || (paymentInfo.invoiceId ? [paymentInfo.invoiceId] : []);
        const res = await fetch('/api/v1/payment/callback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mock: true, invoice_ids: invoiceIds }),
        });
        const data = await res.json();
        if (data.success) { setPaymentComplete(true); }
        else { setError(data.error || 'Payment failed'); }
      } catch { setError('Payment failed - please try again'); }
      finally { setPaying(false); }
      return;
    }

    // Live Razorpay checkout
    if (!window.Razorpay) {
      setError('Payment gateway is loading. Please wait...');
      setPaying(false);
      return;
    }

    const options = {
      key: order.gatewayKeyId,
      amount: order.amount,
      currency: order.currency,
      name: platformName,
      description: `Session: ${roomName} (${subject})`,
      order_id: order.orderId,
      prefill: order.prefill,
      theme: { color: '#2563eb' },
      handler: async (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
        try {
          const res = await fetch('/api/v1/payment/callback', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(response),
          });
          const data = await res.json();
          if (data.success) { setPaymentComplete(true); }
          else { setError('Payment verification failed'); }
        } catch { setError('Payment verification failed'); }
        finally { setPaying(false); }
      },
      modal: { ondismiss: () => { setPaying(false); } },
    };

    const rzp = new window.Razorpay(options);
    rzp.open();
  }

  // Auto-poll for teacher
  const MAX_POLL = 60;
  useEffect(() => {
    if (!waitingForTeacher) return;
    if (pollCount >= MAX_POLL) {
      setWaitingForTeacher(false);
      setError('Teacher has not started the session yet. Please try again later.');
      return;
    }
    const id = setInterval(() => {
      if (!joining) { setPollCount((c) => c + 1); handleJoin(); }
    }, 5000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waitingForTeacher, pollCount, joining]);

  async function handleJoin() {
    if (needsPaymentCheck && !paymentResolved && paymentInfo?.paymentRequired) {
      handlePayment();
      return;
    }
    setJoining(true);
    setError('');
    setInvoiceBlocked(false);
    try {
      const isScreenDevice = device === 'screen' || device === 'tablet';
      const res = await fetch('/api/v1/room/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          room_id: roomId,
          ...(isScreenDevice && userRole === 'teacher' ? { device: 'screen' } : {}),
          ...(emailToken ? { email_token: emailToken } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        if (data.error === 'CLASS_NOT_LIVE' || data.error === 'SESSION_NOT_STARTED' || data.error === 'AGENT_NOT_JOINED') {
          setWaitingForTeacher(true);
          setError('');
          return;
        }
        if (data.error === 'EXTENSION_FEE_DUE') {
          // Re-check payment — session-check API will now return the extension invoice
          await checkPayment();
          return;
        }
        if (data.error === 'CREDITS_EXHAUSTED') {
          setPaymentInfo({ paymentRequired: true, creditsExhausted: true, message: data.message });
          return;
        }
        if (data.error === 'INVOICE_OVERDUE' || data.error === 'QUARTERLY_PAYMENT_DUE') {
          setInvoiceBlocked(true);
          setError(data.message || 'You have overdue invoices. Please clear your outstanding fees to join this class.');
          return;
        }
        setError(data.message || data.error || 'Failed to join batch');
        return;
      }
      setWaitingForTeacher(false);
      const result = data.data;
      if (result?.livekit_token) {
        sessionStorage.setItem('lk_token', result.livekit_token);
        sessionStorage.setItem('lk_url', result.livekit_url || '');
        sessionStorage.setItem('room_name', result.room_name || roomId);
        sessionStorage.setItem('participant_role', result.role || userRole);
        sessionStorage.setItem('participant_name', result.participant_name || userName);
        sessionStorage.setItem('participant_email', userEmail || '');
        sessionStorage.setItem('scheduled_start', result.scheduled_start || new Date().toISOString());
        sessionStorage.setItem('duration_minutes', String(result.duration_minutes || durationMinutes));
        sessionStorage.setItem('device', result.device || 'primary');
        sessionStorage.setItem('room_status', result.room_status || 'scheduled');
        sessionStorage.setItem('is_rejoin', result.is_rejoin ? 'true' : 'false');
        sessionStorage.setItem('topic', result.topic || '');
        router.push(`/classroom/${roomId}`);
      } else { setError('No token received from server'); }
    } catch { setError('Network error - please try again'); }
    finally { setJoining(false); }
  }

  // Auto-join after payment completes
  useEffect(() => {
    if (paymentComplete && canJoin && !joining && paymentInfo?.paymentRequired) {
      const t = setTimeout(() => handleJoin(), 1500);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentComplete, canJoin]);
  // Derive the single status state for clean UI
  const showPayment = needsPaymentCheck && !paymentComplete && !checkingPayment
    && paymentInfo?.paymentRequired && !paymentInfo.paid && !paymentInfo.creditsExhausted;

  return (
    <>
      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        onLoad={() => setRazorpayLoaded(true)}
        strategy="afterInteractive"
      />

      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
          {/* ── Header ── */}
          <div className="bg-linear-to-br from-brand-green to-brand-teal p-6 text-center">
            <Video className="mx-auto mb-2 h-8 w-8 text-white/90" />
            <h1 className="text-lg font-bold text-white leading-tight">{roomName}</h1>
            <p className="text-sm text-white/70 mt-1">{subject} &middot; {grade}</p>
          </div>

          <div className="p-5 space-y-4">
            {/* ── Schedule ── */}
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4 shrink-0" />
              <span suppressHydrationWarning>{mounted ? fmtDateShortLocal(startDate) : '\u00A0'}</span>
              <span className="text-border">|</span>
              <Clock className="h-4 w-4 shrink-0" />
              <span suppressHydrationWarning>{mounted ? `${fmtTimeLocal(startDate)} \u00b7 ${durationMinutes}m` : '\u00A0'}</span>
            </div>

            {/* ── Student info ── */}
            <div className="flex items-center gap-3 rounded-lg bg-muted/40 px-3 py-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                {userName.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{userName}</p>
                <p className="text-xs text-muted-foreground truncate">{userEmail}</p>
              </div>
            </div>

            {/* ── Payment checking ── */}
            {needsPaymentCheck && !paymentComplete && checkingPayment && (
              <div className="flex items-center gap-3 rounded-lg border border-border p-3">
                <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />
                <span className="text-sm text-muted-foreground">Verifying payment status&hellip;</span>
              </div>
            )}

            {/* ── Credits exhausted ── */}
            {paymentInfo?.creditsExhausted && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Ban className="h-5 w-5 text-red-600" />
                  <p className="text-sm font-semibold text-red-800">Session Credits Exhausted</p>
                </div>
                <p className="text-xs text-red-600">
                  All your prepaid session credits have been used. Please renew your session package to continue attending classes.
                </p>
                <a
                  href="/student#fees"
                  className="block w-full rounded-lg bg-red-600 py-2.5 text-sm font-semibold text-white hover:bg-red-700 transition-colors text-center"
                >
                  Renew Session Package
                </a>
              </div>
            )}

            {/* ── Payment required ── */}
            {showPayment && (
              <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-warning" />
                  <p className="text-sm font-semibold">
                    {paymentInfo.batchFlatFee
                      ? `Batch Registration Fee${paymentInfo.batchName ? ` — ${paymentInfo.batchName}` : ''}`
                      : paymentInfo.items && paymentInfo.items.length > 1
                        ? 'Payment Due'
                        : paymentInfo.extensionDue === true
                          ? 'Extension Fee'
                          : 'Session Fee'}
                  </p>
                </div>

                <div className="space-y-1.5 text-sm">
                  {/* Itemized breakdown for combined payment */}
                  {paymentInfo.items && paymentInfo.items.length > 1 ? (
                    paymentInfo.items.map((item, i) => (
                      <div key={i} className="flex justify-between">
                        <span className="text-muted-foreground">{item.label}</span>
                        <span>{item.amountFormatted}</span>
                      </div>
                    ))
                  ) : (
                    <>
                      {paymentInfo.batchFlatFee && (
                        <p className="text-xs text-muted-foreground">One-time batch registration fee. You will not be charged again for future classes in this batch.</p>
                      )}
                      {!paymentInfo.batchFlatFee && paymentInfo.extensionDue === true && paymentInfo.description && (
                        <p className="text-xs text-muted-foreground">{paymentInfo.description}</p>
                      )}
                      {!paymentInfo.batchFlatFee && !paymentInfo.extensionDue && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Duration</span>
                          <span>{paymentInfo.durationMinutes || durationMinutes} min</span>
                        </div>
                      )}
                    </>
                  )}
                  <div className="border-t border-border" />
                  <div className="flex justify-between items-baseline">
                    <span className="font-medium">Total</span>
                    <span className="text-lg font-bold text-foreground">{paymentInfo.amountFormatted}</span>
                  </div>
                  {paymentInfo.invoiceNumber && (
                    <p className="text-[10px] text-muted-foreground text-right">Inv: {paymentInfo.invoiceNumber}</p>
                  )}
                </div>

                <button
                  onClick={handlePayment}
                  disabled={paying}
                  className="w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:bg-brand-green-dark transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {paying ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Processing&hellip;</>
                  ) : paymentInfo.items && paymentInfo.items.length > 1 ? (
                    <>Pay All {paymentInfo.amountFormatted}</>
                  ) : (
                    <>Pay {paymentInfo.amountFormatted}</>
                  )}
                </button>
                <p className="text-[11px] text-muted-foreground text-center flex items-center justify-center gap-1">
                  <Shield className="h-3 w-3" /> Secure payment via Razorpay
                </p>
              </div>
            )}

            {/* ── Payment success ── */}
            {paymentComplete && paymentInfo?.paymentRequired && (
              <div className="flex items-center gap-2.5 rounded-lg border border-primary/30 bg-primary/5 p-3">
                <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                <span className="text-sm font-medium text-primary">Payment complete — joining session&hellip;</span>
              </div>
            )}

            {/* ── Single status indicator (mutually exclusive) ── */}
            {!showPayment && mounted && !isEnded && (() => {
              if (waitingForTeacher) return (
                <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/20 p-3">
                  <Loader2 className="h-4 w-4 text-secondary animate-spin shrink-0" />
                  <div>
                    <p className="text-sm font-medium">Waiting for teacher&hellip;</p>
                    <p className="text-xs text-muted-foreground">You&apos;ll join automatically when the session goes live</p>
                  </div>
                </div>
              );
              if (isLive && paymentResolved) return (
                <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
                  <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                  <span className="text-sm font-medium text-primary">Session is live</span>
                </div>
              );
              if (isScheduled && !lobbyOpen) return (
                <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Lobby opens at <span className="font-medium text-foreground">{fmtTimeLocal(lobbyOpenTime)}</span>
                  </p>
                  <div className="flex items-center gap-2 text-sm" suppressHydrationWarning>
                    <Timer className="h-4 w-4 text-muted-foreground" />
                    <span className="font-mono text-foreground">{fmtCountdown(msUntilLobby)}</span>
                  </div>
                </div>
              );
              if (isScheduled && lobbyOpen && paymentResolved) return (
                <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/20 p-3">
                  <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-sm text-muted-foreground" suppressHydrationWarning>
                    Session starts in <span className="font-medium text-foreground">{fmtCountdown(msUntilStart)}</span>
                  </span>
                </div>
              );
              return null;
            })()}

            {isEnded && (
              <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 p-3 text-muted-foreground">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm">This session has ended</span>
              </div>
            )}

            {invoiceBlocked && error && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
                  <p className="text-sm font-semibold text-red-800">Overdue Invoice — Access Blocked</p>
                </div>
                <p className="text-xs text-red-700">{error}</p>
                <a
                  href={`/${userRole === 'parent' ? 'parent' : 'student'}#fees`}
                  className="block w-full rounded-lg bg-red-600 py-2.5 text-sm font-semibold text-white hover:bg-red-700 transition-colors text-center"
                >
                  Pay Now
                </a>
              </div>
            )}
            {!invoiceBlocked && error && (
              <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
            )}

            {/* ── Single action button ── */}
            {!showPayment && !waitingForTeacher && !paymentInfo?.creditsExhausted && !invoiceBlocked && (
              <button
                onClick={handleJoin}
                disabled={!canJoin || joining || isEnded}
                className="w-full rounded-lg py-3 text-sm font-semibold transition-colors flex items-center justify-center gap-2 bg-primary text-primary-foreground hover:bg-brand-green-dark disabled:bg-muted disabled:text-muted-foreground"
              >
                {joining ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Connecting&hellip;</>
                ) : isEnded ? (
                  'Session Ended'
                ) : !canJoin && mounted ? (
                  <><Timer className="h-4 w-4" /> {msUntilStart > 86400000 ? fmtDateShortLocal(startDate) : `Opens in ${fmtCountdown(msUntilLobby)}`}</>
                ) : !canJoin ? (
                  'Not Available Yet'
                ) : (
                  <><Video className="h-4 w-4" /> Join Session</>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}