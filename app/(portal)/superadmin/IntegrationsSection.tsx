'use client';

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/components/dashboard/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Eye, EyeOff, Video, Mail, MessageCircle, CreditCard,
  Brain, Youtube, Facebook, Webhook, ChevronDown,
  Loader2, CheckCircle2, AlertCircle, RefreshCw,
} from 'lucide-react';

interface FieldDef {
  key: string;
  label: string;
  placeholder?: string;
  secret?: boolean;
  hint?: string;
  type?: 'text' | 'select';
  options?: { label: string; value: string }[];
}

interface ServiceDef {
  id: string;
  title: string;
  desc: string;
  Icon: React.ElementType;
  iconBg: string;
  iconFg: string;
  fields: FieldDef[];
  testable?: boolean;
}

const SERVICES: ServiceDef[] = [
  {
    id: 'livekit',
    title: 'LiveKit',
    desc: 'Real-time video infrastructure for classrooms and conference rooms',
    Icon: Video,
    iconBg: 'bg-blue-50',
    iconFg: 'text-blue-600',
    testable: true,
    fields: [
      { key: 'integration_livekit_url', label: 'Server URL', placeholder: 'https://livekit.example.com' },
      { key: 'integration_livekit_api_key', label: 'API Key', placeholder: 'devkey' },
      { key: 'integration_livekit_api_secret', label: 'API Secret', secret: true, placeholder: 'secret' },
    ],
  },
  {
    id: 'email',
    title: 'Email (SMTP)',
    desc: 'Transactional email for invitations, receipts, and reminders',
    Icon: Mail,
    iconBg: 'bg-orange-50',
    iconFg: 'text-orange-500',
    testable: true,
    fields: [
      { key: 'integration_smtp_host', label: 'SMTP Host', placeholder: 'smtp.gmail.com' },
      { key: 'integration_smtp_port', label: 'SMTP Port', placeholder: '587' },
      { key: 'integration_smtp_secure', label: 'Use SSL/TLS', placeholder: 'false', hint: 'Enter true or false' },
      { key: 'integration_smtp_user', label: 'SMTP Username', placeholder: 'you@gmail.com' },
      { key: 'integration_smtp_pass', label: 'SMTP Password / App Password', secret: true, placeholder: '••••••••' },
      { key: 'integration_email_from_name', label: 'From Name', placeholder: 'stibe Classes' },
      { key: 'integration_email_from_address', label: 'From Address', placeholder: 'noreply@example.com' },
      { key: 'integration_email_mode', label: 'Send Mode', placeholder: 'smtp', hint: '"smtp" sends real emails · "log" prints to console only' },
    ],
  },
  {
    id: 'whatsapp',
    title: 'WhatsApp (Meta)',
    desc: 'WhatsApp Business API for student and parent messaging',
    Icon: MessageCircle,
    iconBg: 'bg-green-50',
    iconFg: 'text-green-600',
    testable: true,
    fields: [
      { key: 'integration_whatsapp_api_token', label: 'API Token', secret: true, placeholder: 'EAAxxxxxxxx...' },
      { key: 'integration_whatsapp_phone_id', label: 'Phone Number ID', placeholder: '1234567890' },
      { key: 'integration_whatsapp_business_id', label: 'Business Account ID', placeholder: '9876543210' },
      { key: 'integration_whatsapp_mode', label: 'Send Mode', placeholder: 'mock', hint: '"live" sends real messages · "mock" prints to console only' },
      { key: 'integration_meta_verify_token', label: 'Webhook Verify Token', placeholder: 'my_verify_token' },
      { key: 'integration_meta_app_secret', label: 'Meta App Secret', secret: true, placeholder: 'abc123...' },
    ],
  },
  {
    id: 'razorpay',
    title: 'Razorpay',
    desc: 'Payment gateway for tuition fee collection',
    Icon: CreditCard,
    iconBg: 'bg-indigo-50',
    iconFg: 'text-indigo-600',
    fields: [
      { key: 'integration_razorpay_key_id', label: 'Key ID', placeholder: 'rzp_test_...' },
      { key: 'integration_razorpay_key_secret', label: 'Key Secret', secret: true, placeholder: 'secret' },
      { key: 'integration_razorpay_mode', label: 'Mode', placeholder: 'test', hint: '"test" or "live"' },
      { key: 'integration_razorpay_callback_url', label: 'Payment Callback URL', placeholder: 'https://yourdomain.com/api/v1/payment/callback' },
    ],
  },
  {
    id: 'groq',
    title: 'Groq AI',
    desc: 'AI-powered exam generation and question extraction',
    Icon: Brain,
    iconBg: 'bg-purple-50',
    iconFg: 'text-purple-600',
    fields: [
      { key: 'integration_groq_api_key', label: 'API Key', secret: true, placeholder: 'gsk_...' },
      { key: 'integration_groq_model', label: 'Text Model', placeholder: 'llama-3.3-70b-versatile' },
      { key: 'integration_groq_vision_model', label: 'Vision Model', placeholder: 'meta-llama/llama-4-scout-17b-16e-instruct' },
    ],
  },
  {
    id: 'youtube',
    title: 'YouTube',
    desc: 'Live streaming and class recording uploads',
    Icon: Youtube,
    iconBg: 'bg-red-50',
    iconFg: 'text-red-600',
    fields: [
      { key: 'integration_youtube_client_id', label: 'OAuth Client ID', placeholder: 'xxxxx.apps.googleusercontent.com' },
      { key: 'integration_youtube_client_secret', label: 'OAuth Client Secret', secret: true, placeholder: 'GOCSPX-...' },
      { key: 'integration_youtube_refresh_token', label: 'Refresh Token', secret: true, placeholder: '1//0e...' },
    ],
  },
  {
    id: 'crm',
    title: 'CRM Webhook',
    desc: 'Webhook notifications for demo and enrollment lifecycle events',
    Icon: Webhook,
    iconBg: 'bg-teal-50',
    iconFg: 'text-teal-600',
    fields: [
      { key: 'integration_crm_webhook_url', label: 'Webhook URL', placeholder: 'https://yourcrm.com/webhooks/stibe' },
      { key: 'integration_crm_webhook_secret', label: 'Webhook Secret', secret: true, placeholder: 'secret' },
      { key: 'integration_crm_api_key', label: 'API Key', secret: true, placeholder: 'api_...' },
    ],
  },
];

// ── Source Badge ────────────────────────────────────────────

function SourceBadge({ source }: { source: 'db' | 'env' }) {
  if (source === 'db') {
    return (
      <span className="inline-flex h-5 items-center px-1.5 text-[10px] font-bold rounded bg-primary/10 text-primary border border-primary/20 tracking-wide">
        DB
      </span>
    );
  }
  return (
    <span className="inline-flex h-5 items-center px-1.5 text-[10px] font-bold rounded bg-gray-100 text-gray-500 border border-gray-200 tracking-wide">
      ENV
    </span>
  );
}

// ── Secret Input ────────────────────────────────────────────

function SecretInput({
  value, onChange, placeholder, disabled,
}: { value: string; onChange: (v: string) => void; placeholder?: string; disabled?: boolean }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="pr-10 font-mono bg-white"
        autoComplete="new-password"
      />
      <button
        type="button"
        onClick={() => setShow(s => !s)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
        tabIndex={-1}
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

// ── Test Connection ─────────────────────────────────────────

type TestStatus = 'idle' | 'loading' | 'pass' | 'fail';

interface TestResult {
  status: TestStatus;
  message?: string;
}

async function runConnectionTest(serviceId: string): Promise<{ ok: boolean; message: string }> {
  const endpoints: Record<string, string> = { livekit: 'livekit', email: 'email', whatsapp: 'whatsapp' };
  const ep = endpoints[serviceId];
  if (!ep) return { ok: false, message: 'Test not available for this service' };
  const r = await fetch(`/api/v1/superadmin/test-connection?service=${ep}`);
  const d = await r.json();
  return { ok: d.success, message: d.message || (d.success ? 'Connected' : 'Failed') };
}

// ── Field Row ────────────────────────────────────────────────

function FieldRow({
  field,
  source,
  value,
  onChange,
}: {
  field: FieldDef;
  source?: { source: 'db' | 'env'; hasDbValue: boolean };
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-sm font-semibold text-gray-800">{field.label}</label>
        {source && <SourceBadge source={source.source} />}
      </div>
      {field.hint && (
        <p className="text-xs text-gray-400 mb-1.5">{field.hint}</p>
      )}
      {field.secret ? (
        <SecretInput
          value={value}
          onChange={onChange}
          placeholder={field.placeholder}
        />
      ) : (
        <Input
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={field.placeholder}
          className="bg-white font-mono"
        />
      )}
    </div>
  );
}

// ── Service Card ────────────────────────────────────────────

interface SourceMap {
  [key: string]: { source: 'db' | 'env'; hasDbValue: boolean };
}

function ServiceCard({
  service,
  sourceMap,
  onSaved,
}: {
  service: ServiceDef;
  sourceMap: SourceMap;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [test, setTest] = useState<TestResult>({ status: 'idle' });

  function handleChange(key: string, val: string) {
    setValues(v => ({ ...v, [key]: val }));
    setDirty(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch('/api/v1/superadmin/integrations', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Save failed');
      toast.success(`${service.title} saved`);
      setDirty(false);
      setValues({});
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setTest({ status: 'loading' });
    try {
      const result = await runConnectionTest(service.id);
      setTest({ status: result.ok ? 'pass' : 'fail', message: result.message });
    } catch (err) {
      setTest({ status: 'fail', message: err instanceof Error ? err.message : 'Error' });
    }
  }

  const { Icon } = service;
  const anyInDb = service.fields.some(f => sourceMap[f.key]?.hasDbValue);

  return (
    <div className={`rounded-xl border bg-white overflow-hidden transition-shadow ${open ? 'border-gray-300 shadow-md' : 'border-gray-200 shadow-sm hover:border-gray-300'}`}>

      {/* Header */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-gray-50"
      >
        <div className={`shrink-0 flex items-center justify-center h-10 w-10 rounded-xl ${service.iconBg}`}>
          <Icon className={`h-5 w-5 ${service.iconFg}`} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5">
            <span className="text-sm font-bold text-gray-900">{service.title}</span>
            {anyInDb && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 inline-block" />
                Configured
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-0.5 truncate">{service.desc}</p>
        </div>

        <ChevronDown className={`h-4 w-4 text-gray-400 shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Expanded body */}
      {open && (
        <div className="border-t border-gray-100">
          <div className="px-6 py-5 space-y-4 bg-gray-50/50">
            {service.fields.map(field => (
              <FieldRow
                key={field.key}
                field={field}
                source={sourceMap[field.key]}
                value={values[field.key] ?? ''}
                onChange={v => handleChange(field.key, v)}
              />
            ))}
          </div>

          {/* Actions bar */}
          <div className="px-6 py-4 bg-white border-t border-gray-100 flex items-center gap-3 flex-wrap">
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving || !dirty}
              className="min-w-[72px]"
            >
              {saving
                ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />Saving…</>
                : 'Save'
              }
            </Button>

            {dirty && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => { setValues({}); setDirty(false); }}
                className="text-gray-500"
              >
                Discard
              </Button>
            )}

            {service.testable && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleTest}
                disabled={test.status === 'loading'}
                className="ml-auto gap-1.5"
              >
                {test.status === 'loading'
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <RefreshCw className="h-3.5 w-3.5" />
                }
                Test Connection
              </Button>
            )}
          </div>

          {/* Test result */}
          {(test.status === 'pass' || test.status === 'fail') && (
            <div className={`mx-6 mb-4 flex items-start gap-2.5 rounded-lg px-4 py-3 text-sm ${
              test.status === 'pass'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}>
              {test.status === 'pass'
                ? <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                : <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              }
              <span className="font-medium">{test.message}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Section ────────────────────────────────────────────

export default function IntegrationsSection() {
  const [sourceMap, setSourceMap] = useState<SourceMap>({});
  const [loading, setLoading] = useState(true);

  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/superadmin/integrations');
      const d = await res.json();
      if (d.success) {
        const map: SourceMap = {};
        for (const [k, v] of Object.entries(d.data as Record<string, { source: 'db' | 'env'; hasDbValue: boolean }>)) {
          map[k] = { source: v.source, hasDbValue: v.hasDbValue };
        }
        setSourceMap(map);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 text-sm text-gray-400 py-16">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading integration settings…
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {SERVICES.map(svc => (
        <ServiceCard
          key={svc.id}
          service={svc}
          sourceMap={sourceMap}
          onSaved={fetchConfig}
        />
      ))}
    </div>
  );
}
