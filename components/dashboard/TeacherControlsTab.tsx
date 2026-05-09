'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  PageHeader, RefreshButton, Alert, useToast,
} from '@/components/dashboard/shared';
import { Settings, Radio, FileText, ClipboardCheck, Video, Timer, Loader2, PhoneOff, Brain, Smartphone, Shield, Eye, LogIn } from 'lucide-react';

interface ControlItem {
  key: string;
  label: string;
  description: string;
  icon: React.ElementType;
}

const CONTROLS: ControlItem[] = [
  {
    key: 'go_live_skip_coordinator',
    label: 'Go Live Without Coordinator Approval',
    description: 'Teachers can start live sessions directly without waiting for batch coordinator approval.',
    icon: Radio,
  },
  {
    key: 'allow_go_live_before_schedule',
    label: 'Allow Go Live Before Scheduled Time',
    description: 'Teachers can click GO LIVE and start class before the scheduled start time.',
    icon: Radio,
  },
  {
    key: 'end_class_skip_coordinator',
    label: 'End Class Without Coordinator Approval',
    description: 'Teachers can end live sessions before scheduled time without waiting for batch coordinator approval.',
    icon: PhoneOff,
  },
  {
    key: 'allow_session_extend',
    label: 'Allow Session Extension',
    description: 'Teachers can request to extend session duration during a live class.',
    icon: Timer,
  },
  {
    key: 'allow_homework_create',
    label: 'Allow Homework Creation',
    description: 'Teachers can create and assign homework to students from their dashboard.',
    icon: FileText,
  },
  {
    key: 'allow_exam_push',
    label: 'Allow Exam Push in Class',
    description: 'Teachers can push MCQ exams to students during a live classroom session.',
    icon: ClipboardCheck,
  },
  {
    key: 'allow_recording',
    label: 'Allow Teacher Recording',
    description: 'Teachers can start and stop recording of live classroom sessions from the teacher classroom UI.',
    icon: Video,
  },
];

const CLASSROOM_POLICY_CONTROLS: ControlItem[] = [
  {
    key: 'free_rejoin',
    label: 'Allow Free Rejoin (No Permission Required)',
    description: 'Students who leave and return during a live session can rejoin immediately without waiting for teacher approval.',
    icon: LogIn,
  },
];

const MONITORING_CONTROLS: ControlItem[] = [
  {
    key: 'writing_aware_mode',
    label: 'Writing-Aware Mode (Recommended)',
    description: 'Treat note-taking (head down, brief frame exits) as engaged time instead of flagging as distracted. Prevents false "out of frame" alerts during live online classes.',
    icon: Brain,
  },
  {
    key: 'mobile_relaxed_thresholds',
    label: 'Mobile Relaxed Thresholds',
    description: 'Relax head-pose and absence thresholds for students on mobile devices where small movements are expected.',
    icon: Smartphone,
  },
  {
    key: 'low_visibility_fallback',
    label: 'Low-Visibility Fallback',
    description: 'When the camera feed has poor lighting or low detection confidence, emit a neutral "low visibility" signal instead of false distraction flags.',
    icon: Eye,
  },
  {
    key: 'exam_strict_mode',
    label: 'Strict Mode for Exam Sessions',
    description: 'During live exams, disable writing-aware mode so any head drop or brief absence is flagged immediately.',
    icon: Shield,
  },
];

export default function TeacherControlsTab() {
  const [controls, setControls] = useState<Record<string, boolean>>({});
  const [tuning, setTuning] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const toast = useToast();

  const fetchControls = useCallback(async () => {
    setLoading(true);
    try {
      const [ctrlRes, tuneRes] = await Promise.all([
        fetch('/api/v1/teacher-controls'),
        fetch('/api/v1/monitoring-tuning'),
      ]);
      const ctrlData = await ctrlRes.json();
      const tuneData = await tuneRes.json();
      if (ctrlData.success) setControls(ctrlData.data);
      if (tuneData.success) setTuning(tuneData.data);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchControls(); }, [fetchControls]);

  const toggleControl = useCallback(async (key: string, value: boolean) => {
    setSaving(key);
    const prev = controls[key];
    setControls(c => ({ ...c, [key]: value }));
    try {
      const res = await fetch('/api/v1/teacher-controls', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: value }),
      });
      const data = await res.json();
      if (!data.success) {
        setControls(c => ({ ...c, [key]: prev }));
        toast.error(data.error || 'Failed to update');
      } else {
        toast.success('Setting updated');
      }
    } catch {
      setControls(c => ({ ...c, [key]: prev }));
      toast.error('Network error');
    }
    setSaving(null);
  }, [controls, toast]);

  const toggleTuning = useCallback(async (key: string, value: boolean) => {
    setSaving(`tune_${key}`);
    const prev = tuning[key];
    setTuning(t => ({ ...t, [key]: value }));
    try {
      const res = await fetch('/api/v1/monitoring-tuning', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: value }),
      });
      const data = await res.json();
      if (!data.success) {
        setTuning(t => ({ ...t, [key]: prev }));
        toast.error(data.error || 'Failed to update');
      } else {
        toast.success('Monitoring tuning updated');
      }
    } catch {
      setTuning(t => ({ ...t, [key]: prev }));
      toast.error('Network error');
    }
    setSaving(null);
  }, [tuning, toast]);

  return (
    <div className="space-y-5">
      <PageHeader icon={Settings} title="Settings" subtitle="Teacher permissions and classroom controls">
        <RefreshButton loading={loading} onClick={fetchControls} />
      </PageHeader>

      <Alert variant="info" message="These settings apply globally to all teachers. Changes take effect immediately for new sessions." />

      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <Loader2 className="h-6 w-6 animate-spin mr-2" /> Loading settings…
        </div>
      ) : (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Teacher Controls</h3>
          <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
            {CONTROLS.map(({ key, label, description, icon: Icon }) => (
              <div key={key} className="flex items-center justify-between px-6 py-5">
                <div className="flex items-start gap-4 min-w-0">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                    controls[key] ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-100 text-gray-400'
                  }`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-800">{label}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{description}</p>
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={!!controls[key]}
                  onClick={() => toggleControl(key, !controls[key])}
                  disabled={saving === key}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:opacity-50 ${
                    controls[key] ? 'bg-emerald-500' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      controls[key] ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            ))}
          </div>

          {/* ── Classroom Policies Section ── */}
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider pt-4">Classroom Policies</h3>
          <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
            {CLASSROOM_POLICY_CONTROLS.map(({ key, label, description, icon: Icon }) => (
              <div key={key} className="flex items-center justify-between px-6 py-5">
                <div className="flex items-start gap-4 min-w-0">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                    controls[key] ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-100 text-gray-400'
                  }`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-800">{label}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{description}</p>
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={!!controls[key]}
                  onClick={() => toggleControl(key, !controls[key])}
                  disabled={saving === key}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:opacity-50 ${
                    controls[key] ? 'bg-emerald-500' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      controls[key] ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            ))}
          </div>

          {/* ── AI Monitoring Tuning Section ── */}
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider pt-4">AI Monitoring Tuning</h3>
          <p className="text-xs text-gray-500 -mt-1">
            Fine-tune student attention monitoring to reduce false positives during writing / note-taking.
          </p>
          <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
            {MONITORING_CONTROLS.map(({ key, label, description, icon: Icon }) => (
              <div key={key} className="flex items-center justify-between px-6 py-5">
                <div className="flex items-start gap-4 min-w-0">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                    tuning[key] ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-400'
                  }`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-800">{label}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{description}</p>
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={!!tuning[key]}
                  onClick={() => toggleTuning(key, !tuning[key])}
                  disabled={saving === `tune_${key}`}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 ${
                    tuning[key] ? 'bg-indigo-500' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      tuning[key] ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
