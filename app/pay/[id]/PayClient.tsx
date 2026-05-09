'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Script from 'next/script';
import { usePlatformName } from '@/components/providers/PlatformProvider';

interface Props {
  invoiceId: string;
  token: string;
  amount: string;
  studentName: string;
  autoOpen?: boolean;
  returnUrl?: string;
}

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => { open: () => void };
  }
}

export default function PayClient({ invoiceId, token, amount, studentName, autoOpen, returnUrl }: Props) {
  const platformName = usePlatformName();
  const [paying, setPaying] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [paid, setPaid] = useState(false);
  const [error, setError] = useState('');
  const [razorpayLoaded, setRazorpayLoaded] = useState(false);
  const autoOpenFired = useRef(false);
  // Track whether the Razorpay handler has started (prevents ondismiss from showing button)
  const handlerStarted = useRef(false);

  const handlePay = useCallback(async () => {
    setPaying(true);
    setError('');

    try {
      const res = await fetch('/api/v1/payment/public-initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoice_id: invoiceId, token }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error || 'Payment initiation failed');
        setPaying(false);
        return;
      }

      const order = data.data;

      if (order.mode === 'test' || order.mode === 'mock') {
        const cbRes = await fetch('/api/v1/payment/callback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mock: true, invoice_id: invoiceId }),
        });
        const cbData = await cbRes.json();
        if (cbData.success) setPaid(true);
        else setError('Payment failed. Please try again.');
        setPaying(false);
        return;
      }

      if (!window.Razorpay) {
        setError('Payment gateway is loading. Please wait and try again.');
        setPaying(false);
        return;
      }

      const rzp = new window.Razorpay({
        key: order.gatewayKeyId,
        amount: order.amount,
        currency: order.currency,
        name: platformName,
        description: `Invoice Payment — ${studentName}`,
        order_id: order.orderId,
        prefill: order.prefill,
        theme: { color: '#0d9488' },
        handler: async (response: Record<string, string>) => {
          handlerStarted.current = true;
          setPaying(false);
          setVerifying(true);
          try {
            const cbRes = await fetch('/api/v1/payment/callback', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(response),
            });
            const cbData = await cbRes.json();
            if (cbData.success) setPaid(true);
            else setError('Payment verification failed');
          } catch {
            setError('Payment verification failed');
          } finally {
            setVerifying(false);
          }
        },
        modal: {
          ondismiss: () => {
            // Only reset if handler hasn't taken over (i.e. user cancelled)
            if (!handlerStarted.current) setPaying(false);
          },
        },
      });
      rzp.open();
    } catch {
      setError('Network error. Please check your connection.');
      setPaying(false);
    }
  }, [invoiceId, token, studentName]);

  // Auto-open Razorpay when loaded (from WhatsApp link)
  useEffect(() => {
    if (autoOpen && razorpayLoaded && !autoOpenFired.current && !paid) {
      autoOpenFired.current = true;
      handlePay();
    }
  }, [autoOpen, razorpayLoaded, paid, handlePay]);

  // Redirect to returnUrl or reload page after payment success (so server re-renders with paid status)
  useEffect(() => {
    if (!paid) return;
    const timer = setTimeout(() => {
      if (returnUrl) {
        window.location.href = returnUrl;
      } else {
        window.location.reload();
      }
    }, 2500);
    return () => clearTimeout(timer);
  }, [paid, returnUrl]);

  if (paid) {
    return (
      <div className="text-center py-2">
        <div className="relative w-16 h-16 mx-auto mb-3">
          <div className="absolute inset-0 bg-emerald-400/20 rounded-full animate-ping" />
          <div className="relative w-16 h-16 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-full flex items-center justify-center shadow-lg shadow-emerald-200">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        </div>
        <p className="text-gray-900 font-bold text-lg">Payment Successful!</p>
        <p className="text-gray-500 text-sm mt-1">
          {returnUrl ? 'Redirecting you back…' : 'Receipt sent to your email & WhatsApp.'}
        </p>
      </div>
    );
  }

  return (
    <>
      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        onLoad={() => setRazorpayLoaded(true)}
      />

      {verifying && (
        <div className="flex items-center justify-center gap-2.5 py-3 bg-teal-50 border border-teal-200 rounded-2xl text-teal-700 text-sm font-medium">
          <svg className="animate-spin h-4 w-4 text-teal-600 shrink-0" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Verifying your payment…
        </div>
      )}

      {!verifying && error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-2xl text-red-600 text-sm">
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {error}
        </div>
      )}

      {!verifying && (
        <button
          onClick={handlePay}
          disabled={paying}
          className="w-full py-4 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 disabled:from-gray-300 disabled:to-gray-300 disabled:cursor-not-allowed text-white font-bold rounded-2xl transition-all text-base shadow-lg shadow-teal-500/30 active:scale-[0.98]"
        >
          {paying ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Opening Payment…
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
              Pay {amount}
            </span>
          )}
        </button>
      )}
    </>
  );
}
