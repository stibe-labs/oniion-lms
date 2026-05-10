'use client';

import { Settings2, Palette, Sparkles, Plug, Activity, CheckCircle2, AlertCircle, Clock } from 'lucide-react';
import type { PortalUser } from '@/types';
import { useEffect, useState } from 'react';

interface IntegrationStatus {
  name: string;
  key: string;
  configured: boolean;
}

function QuickCard({
  title,
  description,
  icon: Icon,
  href,
  accent,
}: {
  title: string;
  description: string;
  icon: React.ElementType;
  href: string;
  accent: string;
}) {
  return (
    <a
      href={href}
      className="group relative flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm hover:shadow-md hover:border-gray-300 transition-all duration-200 active:scale-[0.99]"
    >
      <div className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${accent}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-sm font-semibold text-gray-900 group-hover:text-primary transition-colors">{title}</p>
        <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{description}</p>
      </div>
      <span className="absolute top-4 right-4 text-gray-300 group-hover:text-gray-400 transition-colors text-lg leading-none">›</span>
    </a>
  );
}

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${
      ok ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-gray-100 text-gray-400 border border-gray-200'
    }`}>
      {ok
        ? <CheckCircle2 className="h-3 w-3 shrink-0" />
        : <Clock className="h-3 w-3 shrink-0" />
      }
      {label}
    </div>
  );
}

export default function SuperadminOverview({ user }: { user: PortalUser }) {
  const [integrations, setIntegrations] = useState<IntegrationStatus[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/v1/superadmin/integrations')
      .then(r => r.json())
      .then(d => {
        if (!d.success) return;
        const cfg = d.config;
        setIntegrations([
          { name: 'LiveKit',    key: 'livekit',    configured: !!cfg?.livekit?.url && !!cfg?.livekit?.apiKey },
          { name: 'Email',     key: 'email',      configured: !!cfg?.email?.smtpHost },
          { name: 'Razorpay',  key: 'razorpay',   configured: !!cfg?.razorpay?.keyId },
          { name: 'WhatsApp',  key: 'whatsapp',   configured: !!cfg?.whatsapp?.phoneNumberId },
          { name: 'Groq AI',   key: 'groq',       configured: !!d.data?.integration_groq_api_key?.hasDbValue },
          { name: 'YouTube',   key: 'youtube',    configured: !!cfg?.youtube?.clientId },
          { name: 'Facebook',  key: 'facebook',   configured: !!cfg?.facebook?.pageId },
          { name: 'CRM',       key: 'crm',        configured: !!cfg?.crm?.webhookUrl },
        ]);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const configuredCount = integrations.filter(i => i.configured).length;

  return (
    <div className="max-w-4xl">

      {/* Header */}
      <div className="mb-8">
        <p className="text-[11px] font-semibold text-primary uppercase tracking-widest mb-1">Superadmin</p>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Platform Overview</h1>
        <p className="text-sm text-gray-500 mt-1">Manage platform configuration, branding, and integrations.</p>
      </div>

      {/* Integration summary card */}
      <div className="mb-6 rounded-2xl border border-gray-200 bg-white shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-gray-400" />
            <p className="text-sm font-semibold text-gray-800">Integration Status</p>
          </div>
          <a href="/superadmin/settings#integrations" className="text-xs text-primary font-medium hover:underline">
            Configure →
          </a>
        </div>
        {loading ? (
          <div className="flex gap-2 flex-wrap">
            {[1,2,3,4].map(i => (
              <div key={i} className="h-6 w-20 rounded-full bg-gray-100 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {integrations.map(intg => (
              <StatusBadge key={intg.key} ok={intg.configured} label={intg.name} />
            ))}
          </div>
        )}
        {!loading && (
          <p className="text-xs text-gray-400 mt-3">
            {configuredCount} of {integrations.length} services configured
          </p>
        )}
      </div>

      {/* Quick nav grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <QuickCard
          title="General"
          description="Platform name, AI assistant, and feature flags."
          icon={Settings2}
          href="/superadmin/settings#general"
          accent="bg-blue-50 text-blue-600"
        />
        <QuickCard
          title="Branding"
          description="Upload logos, set colors, and configure theme."
          icon={Palette}
          href="/superadmin/settings#branding"
          accent="bg-purple-50 text-purple-600"
        />
        <QuickCard
          title="Appearance"
          description="Customize the splash screen and login page layouts."
          icon={Sparkles}
          href="/superadmin/settings#appearance"
          accent="bg-amber-50 text-amber-600"
        />
        <QuickCard
          title="Integrations"
          description="Connect LiveKit, email, payments, WhatsApp, and more."
          icon={Plug}
          href="/superadmin/settings#integrations"
          accent="bg-emerald-50 text-emerald-600"
        />
      </div>

    </div>
  );
}
