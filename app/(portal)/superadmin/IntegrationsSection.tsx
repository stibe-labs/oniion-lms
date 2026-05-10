'use client';

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/components/dashboard/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Eye, EyeOff, Video, Mail, MessageCircle, CreditCard,
  Brain, Youtube, Facebook, Webhook, ChevronDown, ChevronRight,
  Loader2, CheckCircle, AlertCircle, RefreshCw,
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
  color: string;
  fields: FieldDef[];
  testable?: boolean;
}

const SERVICES: ServiceDef[] = [
  {
    id: 'livekit',
    title: 'LiveKit',
    desc: 'Real-time video infrastructure for classrooms and conference rooms',
    Icon: Video,
    color: 'text-blue-500 bg-blue-50',
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
    desc: 'Transactional email for invitations, receipts, reminders',
    Icon: Mail,
    color: 'text-orange-500 bg-orange-50',
    testable: true,
    fields: [
      { key: 'integration_smtp_host', label: 'SMTP Host', placeholder: 'smtp.gmail.com' },
      { key: 'integration_smtp_port', label: 'SMTP Port', placeholder: '587' },
      { key: 'integration_smtp_secure', label: 'Use SSL/TLS', placeholder: 'false', hint: 'true or false' },
      { key: 'integration_smtp_user', label: 'SMTP Username', placeholder: 'you@gmail.com' },
      { key: 'integration_smtp_pass', label: 'SMTP Password / App Password', secret: true, placeholder: '••••••••' },
      { key: 'integration_email_from_name', label: 'From Name', placeholder: 'stibe Classes' },
      { key: 'integration_email_from_address', label: 'From Address', placeholder: 'noreply@stibelearning.online' },
      { key: 'integration_email_mode', label: 'Mode', placeholder: 'smtp', hint: '"smtp" = send real emails, "log" = console only' },
    ],
  },
  {
    id: 'whatsapp',
    title: 'WhatsApp (Meta)',
    desc: 'WhatsApp Business API for student and parent messaging',
    Icon: MessageCircle,
    color: 'text-green-600 bg-green-50',
    testable: true,
    fields: [
      { key: 'integration_whatsapp_api_token', label: 'API Token', secret: true, placeholder: 'EAAxxxxxxxx...' },
      { key: 'integration_whatsapp_phone_id', label: 'Phone Number ID', placeholder: '1234567890' },
      { key: 'integration_whatsapp_business_id', label: 'Business Account ID', placeholder: '9876543210' },
      { key: 'integration_whatsapp_mode', label: 'Mode', placeholder: 'mock', hint: '"live" = send real messages, "mock" = console only' },
      { key: 'integration_meta_verify_token', label: 'Webhook Verify Token', placeholder: 'stibe_wa_verify_2026' },
      { key: 'integration_meta_app_secret', label: 'Meta App Secret', secret: true, placeholder: 'abc123...' },
    ],
  },
  {
    id: 'razorpay',
    title: 'Razorpay',
    desc: 'Payment gateway for tuition fee collection',
    Icon: CreditCard,
    color: 'text-indigo-500 bg-indigo-50',
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
    color: 'text-purple-500 bg-purple-50',
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
    color: 'text-red-500 bg-red-50',
    fields: [
      { key: 'integration_youtube_client_id', label: 'OAuth Client ID', placeholder: 'xxxxx.apps.googleusercontent.com' },
      { key: 'integration_youtube_client_secret', label: 'OAuth Client Secret', secret: true, placeholder: 'GOCSPX-...' },
      { key: 'integration_youtube_refresh_token', label: 'Refresh Token', secret: true, placeholder: '1//0e...' },
    ],
  },
  {
    id: 'facebook',
    title: 'Facebook / Meta Ads',
    desc: 'Lead generation and ad campaign integration',
    Icon: Facebook,
    color: 'text-blue-600 bg-blue-50',
    fields: [
      { key: 'integration_fb_page_id', label: 'Page ID', placeholder: '1234567890' },
      { key: 'integration_fb_page_token', label: 'Page Access Token', secret: true, placeholder: 'EAAxxxxxxxx...' },
      { key: 'integration_fb_ad_account_id', label: 'Ad Account ID', placeholder: 'act_1234567890' },
    ],
  },
  {
    id: 'crm',
    title: 'CRM Webhook',
    desc: 'Webhook notifications for demo and enrollment lifecycle events',
    Icon: Webhook,
    color: 'text-teal-500 bg-teal-50',
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
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
        DB
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border">
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
        className="pr-9 font-mono text-sm"
        autoComplete="new-password"
      />
      <button
        type="button"
        onClick={() => setShow(s => !s)}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
      >
        {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
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
  if (serviceId === 'livekit') {
    const r = await fetch('/api/v1/superadmin/test-connection?service=livekit');
    const d = await r.json();
    return { ok: d.success, message: d.message || (d.success ? 'Connected' : 'Failed') };
  }
  if (serviceId === 'email') {
    const r = await fetch('/api/v1/superadmin/test-connection?service=email');
    const d = await r.json();
    return { ok: d.success, message: d.message || (d.success ? 'Connected' : 'Failed') };
  }
  if (serviceId === 'whatsapp') {
    const r = await fetch('/api/v1/superadmin/test-connection?service=whatsapp');
    const d = await r.json();
    return { ok: d.success, message: d.message || (d.success ? 'Connected' : 'Failed') };
  }
  return { ok: false, message: 'Test not available' };
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
      toast.success(`${service.title} settings saved`);
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

  const { Icon, color } = service;
  const anyInDb = service.fields.some(f => sourceMap[f.key]?.hasDbValue);

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-5 py-4 hover:bg-muted/30 transition-colors text-left"
      >
        <div className={`flex-shrink-0 p-2 rounded-lg ${color}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">{service.title}</span>
            {anyInDb && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-semibold border border-primary/20">
                configured
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{service.desc}</p>
        </div>
        {open ? <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
      </button>

      {/* Body */}
      {open && (
        <div className="border-t border-border px-5 py-5 space-y-4 bg-muted/10">
          <div className="grid gap-4">
            {service.fields.map(field => {
              const src = sourceMap[field.key];
              const currentVal = values[field.key] ?? '';
              return (
                <div key={field.key} className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-medium text-foreground">{field.label}</label>
                    {src && <SourceBadge source={src.source} />}
                  </div>
                  {field.secret ? (
                    <SecretInput
                      value={currentVal}
                      onChange={v => handleChange(field.key, v)}
                      placeholder={field.hint ? `${field.placeholder} — ${field.hint}` : field.placeholder}
                    />
                  ) : (
                    <Input
                      value={currentVal}
                      onChange={e => handleChange(field.key, e.target.value)}
                      placeholder={field.hint ? `${field.placeholder} — ${field.hint}` : field.placeholder}
                      className="font-mono text-sm"
                    />
                  )}
                  {field.hint && !field.secret && (
                    <p className="text-[11px] text-muted-foreground">{field.hint}</p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div className="flex items-center gap-3 pt-2 border-t border-border">
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving || !dirty}
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
              {saving ? 'Saving…' : 'Save'}
            </Button>

            {dirty && (
              <Button size="sm" variant="ghost" onClick={() => { setValues({}); setDirty(false); }}>
                Discard
              </Button>
            )}

            {service.testable && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleTest}
                disabled={test.status === 'loading'}
                className="ml-auto"
              >
                {test.status === 'loading' ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                )}
                Test Connection
              </Button>
            )}
          </div>

          {/* Test result */}
          {test.status !== 'idle' && test.status !== 'loading' && (
            <div className={`flex items-center gap-2 text-xs rounded-lg px-3 py-2 ${test.status === 'pass' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
              {test.status === 'pass'
                ? <CheckCircle className="h-3.5 w-3.5 flex-shrink-0" />
                : <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />}
              {test.message}
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
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
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
