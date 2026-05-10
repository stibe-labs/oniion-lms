// ═══════════════════════════════════════════════════════════════
// stibe Portal — Reusable Dashboard UI Components
// ═══════════════════════════════════════════════════════════════
// Shared building blocks used across all owner/admin pages.
// Design: light theme, white cards, emerald primary, teal secondary.
//
// BRAND PALETTE (only these colors — never hardcode others):
//   Primary:   emerald  — CTAs, active states, success
//   Secondary: teal     — secondary actions, info states
//   Warning:   amber    — warnings, pending, financial
//   Danger:    red      — errors, cancelled, inactive
//   Neutral:   gray     — defaults, legacy, ghost
//   Success:   green    — live, paid, active
// ═══════════════════════════════════════════════════════════════

'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { MiniCharacterLoader } from '@/components/loading/CharacterLoader';
import {
  Loader2,
  Search,
  X,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  Info,
  RefreshCw,
  Shield,
  MapPin,
  Building,
  Briefcase,
  BookOpen,
  GraduationCap,
  Users,
  Eye,
  User,
  Inbox,
  type LucideIcon,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────
// SECTION 1: BUTTONS
// ─────────────────────────────────────────────────────────────

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success';
type ButtonSize = 'xs' | 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: LucideIcon;
  iconRight?: LucideIcon;
  loading?: boolean;
}

const BTN_VARIANT: Record<ButtonVariant, string> = {
  primary:   'bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm',
  secondary: 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50',
  outline:   'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50',
  ghost:     'text-gray-600 hover:bg-gray-100',
  danger:    'bg-red-600 text-white hover:bg-red-700 shadow-sm',
  success:   'bg-primary text-white hover:bg-green-700 shadow-sm',
};

const BTN_SIZE: Record<ButtonSize, string> = {
  xs: 'px-2 py-1 text-xs gap-1 rounded-md',
  sm: 'px-3 py-1.5 text-xs gap-1 rounded-lg',
  md: 'px-4 py-2 text-sm gap-1.5 rounded-lg',
  lg: 'px-5 py-2.5 text-base gap-2 rounded-lg',
};

const BTN_ICON: Record<ButtonSize, string> = {
  xs: 'h-3 w-3',
  sm: 'h-3.5 w-3.5',
  md: 'h-4 w-4',
  lg: 'h-5 w-5',
};

export function Button({
  variant = 'primary',
  size = 'md',
  icon: Icon,
  iconRight: IconRight,
  loading,
  disabled,
  children,
  className,
  ...props
}: ButtonProps) {
  const iconCls = BTN_ICON[size];
  return (
    <button
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center font-medium transition disabled:opacity-50 ${BTN_VARIANT[variant]} ${BTN_SIZE[size]} ${className ?? ''}`}
      {...props}
    >
      {loading ? <Loader2 className={`animate-spin ${iconCls}`} /> : Icon ? <Icon className={iconCls} /> : null}
      {children}
      {IconRight && !loading && <IconRight className={iconCls} />}
    </button>
  );
}

/** Icon-only button — for table actions, close buttons, etc. */
export function IconButton({
  icon: Icon,
  variant = 'ghost',
  size = 'sm',
  loading,
  className,
  ...props
}: Omit<ButtonProps, 'children'> & { icon: LucideIcon }) {
  const sizeMap: Record<ButtonSize, string> = { xs: 'p-1 min-h-[36px] min-w-[36px]', sm: 'p-1.5 min-h-[36px] min-w-[36px]', md: 'p-2', lg: 'p-2.5' };
  const iconMap: Record<ButtonSize, string> = { xs: 'h-3 w-3', sm: 'h-4 w-4', md: 'h-4 w-4', lg: 'h-5 w-5' };
  return (
    <button
      disabled={props.disabled || loading}
      className={`inline-flex items-center justify-center rounded-md transition disabled:opacity-50 ${BTN_VARIANT[variant]} ${sizeMap[size]} ${className ?? ''}`}
      {...props}
    >
      {loading ? <Loader2 className={`animate-spin ${iconMap[size]}`} /> : <Icon className={iconMap[size]} />}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────
// SECTION 2: INPUTS
// ─────────────────────────────────────────────────────────────

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export function Input({ error, className, ...props }: InputProps) {
  return (
    <input
      {...props}
      className={`w-full rounded-lg border bg-white py-2 px-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition ${
        error
          ? 'border-red-300 focus:border-red-400 focus:ring-2 focus:ring-red-100'
          : 'border-gray-200 focus:border-primary/60 focus:ring-2 focus:ring-primary/15'
      } ${className ?? ''}`}
    />
  );
}

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

export function Textarea({ error, className, ...props }: TextareaProps) {
  return (
    <textarea
      {...props}
      className={`w-full rounded-lg border bg-white py-2 px-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition resize-none ${
        error
          ? 'border-red-300 focus:border-red-400 focus:ring-2 focus:ring-red-100'
          : 'border-gray-200 focus:border-primary/60 focus:ring-2 focus:ring-primary/15'
      } ${className ?? ''}`}
    />
  );
}

export interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  className?: string;
  error?: boolean;
}

export function Select({ value, onChange, options, placeholder, error, className }: SelectProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full rounded-lg border bg-white py-2 px-3 text-sm text-gray-900 outline-none transition ${
        error
          ? 'border-red-300 focus:border-red-400 focus:ring-2 focus:ring-red-100'
          : 'border-gray-200 focus:border-primary/60 focus:ring-2 focus:ring-primary/15'
      } ${className ?? ''}`}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

export interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function SearchInput({ value, onChange, placeholder = 'Search…', className }: SearchInputProps) {
  return (
    <div className={`relative flex-1 min-w-0 sm:min-w-60 ${className ?? ''}`}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-4 text-sm text-gray-900 placeholder:text-gray-400 focus:border-primary/60 focus:ring-2 focus:ring-primary/15 outline-none"
      />
    </div>
  );
}

/** Toggle switch component */
export interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  size?: 'sm' | 'md';
}

export function Toggle({ checked, onChange, label, disabled, size = 'md' }: ToggleProps) {
  const trackSize = size === 'sm' ? 'h-5 w-9' : 'h-6 w-11';
  const dotSize = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4';
  const dotPos = size === 'sm'
    ? (checked ? 'translate-x-4' : 'translate-x-0.5')
    : (checked ? 'translate-x-5' : 'translate-x-0.5');
  const dotTop = size === 'sm' ? 'top-[3px]' : 'top-1';

  return (
    <label className={`inline-flex items-center gap-2 ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex ${trackSize} items-center rounded-full transition-colors ${
          checked ? 'bg-primary' : 'bg-gray-300'
        }`}
      >
        <span className={`${dotSize} ${dotTop} absolute rounded-full bg-white shadow transition-transform ${dotPos}`} />
      </button>
      {label && <span className="text-sm text-gray-700">{label}</span>}
    </label>
  );
}

// ─────────────────────────────────────────────────────────────
// SECTION 3: LAYOUT & NAVIGATION
// ─────────────────────────────────────────────────────────────

export interface PageHeaderProps {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}

export function PageHeader({ icon: Icon, title, subtitle, children }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-3 sm:gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Icon className="h-5 w-5 sm:h-6 sm:w-6 text-primary" /> {title}
        </h1>
        {subtitle && <p className="mt-0.5 sm:mt-1 text-xs sm:text-sm text-gray-500">{subtitle}</p>}
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  );
}

/** Refresh button (outline style) */
export function RefreshButton({ loading, onClick, label = 'Refresh' }: { loading?: boolean; onClick: () => void; label?: string }) {
  return (
    <Button variant="outline" onClick={onClick} disabled={loading} icon={RefreshCw}>
      {loading && <span className="sr-only">Loading</span>}
      {label}
    </Button>
  );
}

export interface TabItem {
  key: string;
  label: string;
  icon?: LucideIcon;
  count?: number;
}

export interface TabBarProps {
  tabs: TabItem[];
  active: string;
  onChange: (key: string) => void;
}

/** Pill-style tab bar — hidden on mobile (replaced by bottom nav), scrollable pills on desktop */
export function TabBar({ tabs, active, onChange }: TabBarProps) {
  return (
    <>
      {/* Desktop: scrollable pills */}
      <div className="hidden sm:flex gap-2 overflow-x-auto pb-1">
        {tabs.map((t) => {
          const isActive = active === t.key;
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => onChange(t.key)}
              className={`whitespace-nowrap inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                isActive
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              {Icon && <Icon className="h-3.5 w-3.5" />}
              {t.label}
              {t.count !== undefined && ` (${t.count})`}
            </button>
          );
        })}
      </div>
    </>
  );
}

/** Underline-style tab bar for section tabs */
export function UnderlineTabBar({ tabs, active, onChange }: TabBarProps) {
  return (
    <div className="flex gap-2 border-b border-gray-200">
      {tabs.map((t) => {
        const isActive = active === t.key;
        const Icon = t.icon;
        return (
          <button
            key={t.key}
            onClick={() => onChange(t.key)}
            className={`inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition ${
              isActive ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {Icon && <Icon className="h-4 w-4" />}
            {t.label}
            {t.count !== undefined && ` (${t.count})`}
          </button>
        );
      })}
    </div>
  );
}

/** Filter select (small inline dropdown) */
export interface FilterSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}

export function FilterSelect({ value, onChange, options }: FilterSelectProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-lg border border-gray-200 bg-white py-2 px-3 text-sm text-gray-700 outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/15"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

// ─────────────────────────────────────────────────────────────
// SECTION 4: FORMS
// ─────────────────────────────────────────────────────────────

export interface FormPanelProps {
  title: string;
  icon?: LucideIcon;
  onClose?: () => void;
  children: React.ReactNode;
}

export function FormPanel({ title, icon: Icon, onClose, children }: FormPanelProps) {
  return (
    <div className="rounded-xl border border-primary/20 bg-primary/5 p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          {Icon && <Icon className="h-5 w-5 text-primary" />} {title}
        </h3>
        {onClose && (
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition">
            <X className="h-5 w-5" />
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

export interface FormFieldProps {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}

export function FormField({ label, required, error, hint, children, className }: FormFieldProps) {
  return (
    <div className={className}>
      <label className="block text-xs font-medium text-gray-600 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      {hint && !error && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
    </div>
  );
}

/** Grid wrapper for form fields */
export function FormGrid({ cols = 2, children, className }: { cols?: 1 | 2 | 3 | 4; children: React.ReactNode; className?: string }) {
  const colClass: Record<number, string> = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 md:grid-cols-4',
  };
  return <div className={`grid gap-4 ${colClass[cols]} ${className ?? ''}`}>{children}</div>;
}

/** Form action bar — always at the bottom of a form */
export interface FormActionsProps {
  onCancel?: () => void;
  onSubmit?: () => void;
  submitLabel?: string;
  submitDisabled?: boolean;
  submitting?: boolean;
  cancelLabel?: string;
  children?: React.ReactNode;
}

export function FormActions({
  onCancel,
  onSubmit,
  submitLabel = 'Create',
  submitDisabled,
  submitting,
  cancelLabel = 'Cancel',
  children,
}: FormActionsProps) {
  return (
    <div className="flex justify-end gap-2 pt-2">
      {children || (
        <>
          {onCancel && <Button variant="secondary" onClick={onCancel}>{cancelLabel}</Button>}
          {onSubmit && (
            <Button variant="primary" onClick={onSubmit} disabled={submitDisabled} loading={submitting}>
              {submitLabel}
            </Button>
          )}
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// SECTION 5: MODAL
// ─────────────────────────────────────────────────────────────

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl';
  fullScreen?: boolean;
  children: React.ReactNode;
}

export function Modal({ open, onClose, title, subtitle, maxWidth = 'md', fullScreen, children }: ModalProps) {
  const widthClass: Record<string, string> = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg', xl: 'max-w-xl' };

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className={fullScreen
          ? 'bg-white w-full h-full flex flex-col overflow-hidden'
          : `bg-white rounded-xl shadow-2xl w-full ${widthClass[maxWidth]} mx-4 p-6 space-y-5`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`flex items-center justify-between ${fullScreen ? 'px-6 py-4 border-b border-gray-200 shrink-0' : ''}`}>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
            {subtitle && <div className="text-sm text-gray-500 mt-0.5">{subtitle}</div>}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>
        {fullScreen
          ? <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
          : children}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// SECTION 5b: CONFIRM DIALOG
// ─────────────────────────────────────────────────────────────

export interface ConfirmDialogOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'info';
  icon?: LucideIcon;
}

interface ConfirmContextType {
  confirm: (options: ConfirmDialogOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextType | null>(null);

export function useConfirm(): ConfirmContextType {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be wrapped in <ConfirmProvider>');
  return ctx;
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<{
    open: boolean;
    options: ConfirmDialogOptions;
    resolve: ((v: boolean) => void) | null;
  }>({ open: false, options: { title: '', message: '' }, resolve: null });

  const confirm = useCallback((options: ConfirmDialogOptions): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      setState({ open: true, options, resolve });
    });
  }, []);

  const handleClose = useCallback((result: boolean) => {
    state.resolve?.(result);
    setState({ open: false, options: { title: '', message: '' }, resolve: null });
  }, [state.resolve]);

  useEffect(() => {
    if (state.open) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [state.open]);

  // Escape key support
  useEffect(() => {
    if (!state.open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state.open, handleClose]);

  const { options } = state;
  const variant = options.variant ?? 'danger';
  const VARIANT_STYLES = {
    danger:  { bg: 'bg-red-50',   border: 'border-red-200',   iconBg: 'bg-red-100',   iconColor: 'text-red-600',   btnBg: 'bg-red-600 hover:bg-red-700',   text: 'text-red-800' },
    warning: { bg: 'bg-amber-50', border: 'border-amber-200', iconBg: 'bg-amber-100', iconColor: 'text-amber-600', btnBg: 'bg-amber-600 hover:bg-amber-700', text: 'text-amber-800' },
    info:    { bg: 'bg-teal-50',  border: 'border-teal-200',  iconBg: 'bg-teal-100',  iconColor: 'text-teal-600',  btnBg: 'bg-secondary hover:bg-teal-700',  text: 'text-teal-800' },
  };
  const DEFAULT_ICONS: Record<string, LucideIcon> = { danger: AlertTriangle, warning: AlertCircle, info: Info };
  const vs = VARIANT_STYLES[variant];
  const IconComp = options.icon ?? DEFAULT_ICONS[variant];

  const api = React.useMemo<ConfirmContextType>(() => ({ confirm }), [confirm]);

  return (
    <ConfirmContext.Provider value={api}>
      {children}

      {/* ── Confirmation Dialog Overlay ── */}
      {state.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => handleClose(false)}>
          <div
            className="w-full max-w-sm rounded-2xl bg-white shadow-2xl ring-1 ring-gray-200 animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Icon + Title */}
            <div className="p-6 pb-0">
              <div className="flex items-start gap-4">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${vs.iconBg}`}>
                  <IconComp className={`h-5 w-5 ${vs.iconColor}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-semibold text-gray-900">{options.title}</h3>
                  <p className="mt-1 text-sm text-gray-500 leading-relaxed">{options.message}</p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 p-6 pt-5">
              <button
                onClick={() => handleClose(false)}
                className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-200"
              >
                {options.cancelLabel ?? 'Cancel'}
              </button>
              <button
                onClick={() => handleClose(true)}
                className={`rounded-lg px-4 py-2 text-sm font-medium text-white transition focus:outline-none focus:ring-2 focus:ring-offset-2 ${vs.btnBg}`}
              >
                {options.confirmLabel ?? 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

// ─────────────────────────────────────────────────────────────
// SECTION 6: CARDS
// ─────────────────────────────────────────────────────────────

/** Base card with border and shadow */
export function Card({ children, className, onClick }: { children: React.ReactNode; className?: string; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      className={`rounded-xl border border-gray-200 bg-white shadow-sm ${onClick ? 'cursor-pointer' : ''} ${className ?? ''}`}
    >
      {children}
    </div>
  );
}

/** Stat card — for KPI display */
export interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
}

const STAT_ICON: Record<string, string> = {
  default: 'text-gray-500',
  success: 'text-primary',
  warning: 'text-amber-600',
  danger:  'text-red-500',
  info:    'text-teal-600',
};

const STAT_VALUE: Record<string, string> = {
  default: 'text-gray-900',
  success: 'text-primary',
  warning: 'text-amber-700',
  danger:  'text-red-600',
  info:    'text-teal-700',
};

export function StatCard({ icon: Icon, label, value, variant = 'default' }: StatCardProps) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3 sm:p-4 flex items-center gap-2.5 sm:gap-3 shadow-sm">
      <Icon className={`h-6 w-6 sm:h-8 sm:w-8 shrink-0 ${STAT_ICON[variant]}`} />
      <div className="min-w-0">
        <p className={`text-lg sm:text-2xl font-bold truncate ${STAT_VALUE[variant]}`}>{value}</p>
        <p className="text-xs text-gray-500 leading-tight">{label}</p>
      </div>
    </div>
  );
}

/** Compact stat card for dense grids */
export function StatCardSmall({ icon: Icon, label, value, variant = 'default' }: StatCardProps) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3 sm:p-4 flex items-center gap-2.5 sm:gap-3">
      <Icon className={`h-5 w-5 sm:h-7 sm:w-7 shrink-0 ${STAT_ICON[variant]}`} />
      <div className="min-w-0">
        <p className={`text-lg sm:text-xl font-bold ${STAT_VALUE[variant]}`}>{value}</p>
        <p className="text-[10px] sm:text-xs text-gray-500 truncate">{label}</p>
      </div>
    </div>
  );
}

/** Small info card inside detail panels */
export interface InfoCardProps {
  label: string;
  icon?: LucideIcon;
  children: React.ReactNode;
}

export function InfoCard({ label, icon: Icon, children }: InfoCardProps) {
  return (
    <div className="rounded-lg bg-gray-50 p-3">
      <p className="text-xs text-gray-400 mb-1 flex items-center gap-1">
        {Icon && <Icon className="h-3 w-3" />} {label}
      </p>
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// SECTION 7: TABLES
// ─────────────────────────────────────────────────────────────

export interface TableWrapperProps {
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function TableWrapper({ children, footer }: TableWrapperProps) {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
      <table className="w-full text-sm">
        {children}
      </table>
      {footer && (
        <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3 text-xs text-gray-400">
          {footer}
        </div>
      )}
    </div>
  );
}

export function THead({ children }: { children: React.ReactNode }) {
  return (
    <thead>
      <tr className="border-b border-gray-100 bg-gray-50/80">
        {children}
      </tr>
    </thead>
  );
}

export function TH({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <th className={`px-4 py-3 text-left font-medium text-gray-500 ${className ?? ''}`}>
      {children}
    </th>
  );
}

/** Standard table row with hover and selection support */
export function TRow({
  selected,
  onClick,
  children,
  className,
}: {
  selected?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <tr
      onClick={onClick}
      className={`border-b border-gray-50 hover:bg-primary/5 transition ${
        onClick ? 'cursor-pointer' : ''
      } ${selected ? 'bg-primary/10 border-primary/20' : ''} ${className ?? ''}`}
    >
      {children}
    </tr>
  );
}

// ─────────────────────────────────────────────────────────────
// SECTION 8: DETAIL PANEL
// ─────────────────────────────────────────────────────────────

export interface DetailPanelProps {
  onClose?: () => void;
  loading?: boolean;
  emptyMessage?: string;
  children: React.ReactNode;
}

export function DetailPanel({ onClose, loading, emptyMessage, children }: DetailPanelProps) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-5">
      {loading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : children ? (
        children
      ) : (
        <p className="text-sm text-gray-400 text-center py-10">{emptyMessage || 'No data available'}</p>
      )}
    </div>
  );
}

export interface DetailHeaderProps {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children?: React.ReactNode;
}

export function DetailHeader({ title, subtitle, onClose, children }: DetailHeaderProps) {
  return (
    <div className="flex items-start justify-between">
      <div>
        <h3 className="text-lg font-bold text-gray-900">{title}</h3>
        {subtitle && <p className="text-sm text-gray-400 font-mono">{subtitle}</p>}
        {children}
      </div>
      <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition">
        <X className="h-5 w-5" />
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// SECTION 9: BADGES
// ─────────────────────────────────────────────────────────────

export type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'primary' | 'secondary';

const BADGE_COLORS: Record<BadgeVariant, string> = {
  default:   'bg-gray-50 border-gray-200 text-gray-600',
  success:   'bg-primary/5 border-primary/20 text-primary',
  warning:   'bg-amber-50 border-amber-200 text-amber-700',
  danger:    'bg-red-50 border-red-200 text-red-600',
  info:      'bg-teal-50 border-teal-200 text-teal-700',
  primary:   'bg-primary/10 border-primary/25 text-primary',
  secondary: 'bg-teal-50 border-teal-200 text-teal-700',
};

export interface BadgeProps {
  icon?: LucideIcon;
  label: string;
  variant?: BadgeVariant;
  colorClass?: string;
}

export function Badge({ icon: Icon, label, variant = 'default', colorClass }: BadgeProps) {
  const cls = colorClass ?? BADGE_COLORS[variant];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${cls}`}>
      {Icon && <Icon className="h-3 w-3" />}
      {label}
    </span>
  );
}

/** Status badge auto-maps common statuses to colors */
const STATUS_MAP: Record<string, BadgeVariant> = {
  active:      'success',
  inactive:    'danger',
  paid:        'success',
  unpaid:      'warning',
  pending:     'warning',
  pending_ao:  'warning',
  pending_hr:  'info',
  confirmed:   'success',
  overdue:     'danger',
  draft:       'default',
  scheduled:   'info',
  live:        'primary',
  ended:       'default',
  cancelled:   'danger',
  finalized:   'info',
  exempt:      'info',
  scholarship: 'primary',
  completed:   'success',
  graded:      'success',
  submitted:   'info',
  published:   'primary',
  approved:    'success',
  rejected:    'danger',
  withdrawn:   'danger',
};

export function StatusBadge({ status, icon, label }: { status: string; icon?: LucideIcon; label?: string }) {
  const variant = STATUS_MAP[status] ?? 'default';
  return <Badge icon={icon} label={label || status} variant={variant} />;
}

// ─────────────────────────────────────────────────────────────
// SECTION 10: ROLE CONFIG (centralized)
// ─────────────────────────────────────────────────────────────

export interface RoleConfig {
  label: string;
  variant: BadgeVariant;
  icon: LucideIcon;
  color: string;
  bg: string;
}

export const ROLE_CONFIG: Record<string, RoleConfig> = {
  owner:             { label: 'Owner',             variant: 'primary',   icon: Shield,        color: 'text-primary',     bg: 'bg-primary/10' },
  batch_coordinator: { label: 'Batch Coordinator', variant: 'info',      icon: MapPin,        color: 'text-teal-600',    bg: 'bg-teal-50' },
  academic_operator: { label: 'Academic Op',       variant: 'success',   icon: Building,      color: 'text-primary',   bg: 'bg-primary/5' },
  hr:                { label: 'HR',                variant: 'warning',   icon: Briefcase,     color: 'text-amber-600',   bg: 'bg-amber-50' },
  teacher:           { label: 'Teacher',           variant: 'info',      icon: BookOpen,      color: 'text-teal-600',    bg: 'bg-teal-50' },
  teacher_screen:    { label: 'Teacher Screen',    variant: 'default',   icon: BookOpen,      color: 'text-gray-600',    bg: 'bg-gray-50' },
  student:           { label: 'Student',           variant: 'primary',   icon: GraduationCap, color: 'text-primary',     bg: 'bg-primary/10' },
  parent:            { label: 'Parent',            variant: 'success',   icon: Users,         color: 'text-primary',   bg: 'bg-primary/5' },
  ghost:             { label: 'Ghost',             variant: 'default',   icon: Eye,           color: 'text-gray-500',    bg: 'bg-gray-50' },
  academic:          { label: 'Academic (Legacy)',  variant: 'default',   icon: GraduationCap, color: 'text-gray-600',    bg: 'bg-gray-50' },
};

/** Renders a role badge using centralized config */
export function RoleBadge({ role }: { role: string }) {
  const cfg = ROLE_CONFIG[role] || { label: role, variant: 'default' as BadgeVariant, icon: User };
  return <Badge icon={cfg.icon} label={cfg.label} variant={cfg.variant} />;
}

/** Active / Inactive status indicator */
export function ActiveIndicator({ active }: { active: boolean }) {
  return (
    <Badge
      icon={active ? CheckCircle : X}
      label={active ? 'Active' : 'Inactive'}
      variant={active ? 'success' : 'danger'}
    />
  );
}

// ─────────────────────────────────────────────────────────────
// SECTION 11: LOADING & EMPTY STATES
// ─────────────────────────────────────────────────────────────

/** Full-section loading spinner */
export function LoadingState() {
  return (
    <div className="flex items-center justify-center" style={{ minHeight: 'calc(100vh - 120px)' }}>
      <MiniCharacterLoader text="Loading" />
    </div>
  );
}

/** Inline spinner */
export function Spinner({ size = 'md', className }: { size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const sizeMap = { sm: 16, md: 24, lg: 32 };
  const px = sizeMap[size];
  return (
    <span className={className ?? ''} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: px, height: px }}>
      <span style={{ width: px, height: px, borderRadius: '50%', border: `${Math.max(2, Math.round(px / 8))}px solid #e5e7eb`, borderTopColor: 'var(--primary)', animation: 'spinnerSpin 0.8s linear infinite', display: 'inline-block' }} />
      <style>{`@keyframes spinnerSpin{to{transform:rotate(360deg)}}`}</style>
    </span>
  );
}

/** Skeleton loading placeholder */
export function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-gray-200 ${className ?? ''}`} />;
}

/** Empty state with icon and message */
export interface EmptyStateProps {
  icon?: LucideIcon;
  message?: string;
}

export function EmptyState({ icon: Icon, message = 'No data found' }: EmptyStateProps) {
  const FallbackIcon = Icon || Inbox;
  return (
    <div className="flex flex-col items-center justify-center py-20 text-gray-400">
      <FallbackIcon className="h-12 w-12 mb-3 opacity-40" />
      <p className="text-sm">{message}</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// SECTION 12: ALERTS & FEEDBACK
// ─────────────────────────────────────────────────────────────

type AlertVariant = 'success' | 'error' | 'warning' | 'info';

const ALERT_STYLES: Record<AlertVariant, { bg: string; border: string; text: string; icon: LucideIcon }> = {
  success: { bg: 'bg-primary/5',  border: 'border-primary/20', text: 'text-primary',  icon: CheckCircle },
  error:   { bg: 'bg-red-50',    border: 'border-red-200',   text: 'text-red-700',    icon: AlertCircle },
  warning: { bg: 'bg-amber-50',  border: 'border-amber-200', text: 'text-amber-700',  icon: AlertTriangle },
  info:    { bg: 'bg-teal-50',   border: 'border-teal-200',  text: 'text-teal-700',   icon: Info },
};

export interface AlertProps {
  variant: AlertVariant;
  message: string;
  onDismiss?: () => void;
  className?: string;
}

export function Alert({ variant, message, onDismiss, className }: AlertProps) {
  const style = ALERT_STYLES[variant];
  const Icon = style.icon;
  return (
    <div className={`${style.bg} border ${style.border} rounded-xl px-4 py-3 flex items-start gap-3 ${className ?? ''}`}>
      <Icon className={`h-5 w-5 ${style.text} shrink-0 mt-0.5`} />
      <p className={`text-sm ${style.text} flex-1`}>{message}</p>
      {onDismiss && (
        <button onClick={onDismiss} className={`${style.text} hover:opacity-70 shrink-0`}>
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// SECTION 13: TOAST / SNACKBAR SYSTEM
// ─────────────────────────────────────────────────────────────

interface ToastItem {
  id: number;
  variant: AlertVariant;
  message: string;
}

interface ToastContextType {
  success: (message: string) => void;
  error: (message: string) => void;
  warning: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function useToast(): ToastContextType {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be wrapped in <ToastProvider>');
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const add = useCallback((variant: AlertVariant, message: string) => {
    const id = nextId.current++;
    setToasts((prev) => [...prev, { id, variant, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const api = React.useMemo<ToastContextType>(() => ({
    success: (msg) => add('success', msg),
    error:   (msg) => add('error', msg),
    warning: (msg) => add('warning', msg),
    info:    (msg) => add('info', msg),
  }), [add]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      {/* Toast container — bottom-right on desktop, full-width on mobile */}
      <div className="fixed bottom-4 left-3 right-3 sm:left-auto sm:right-4 z-9999 flex flex-col gap-2 sm:max-w-sm pointer-events-none">
        {toasts.map((t) => {
          const style = ALERT_STYLES[t.variant];
          const Icon = style.icon;
          return (
            <div
              key={t.id}
              className={`pointer-events-auto ${style.bg} border ${style.border} rounded-xl px-4 py-3 flex items-start gap-3 shadow-lg transition-all duration-300`}
            >
              <Icon className={`h-5 w-5 ${style.text} shrink-0 mt-0.5`} />
              <p className={`text-sm ${style.text} flex-1`}>{t.message}</p>
              <button onClick={() => dismiss(t.id)} className={`${style.text} hover:opacity-70 shrink-0 pointer-events-auto`}>
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

// ─────────────────────────────────────────────────────────────
// SECTION 14: AVATAR
// ─────────────────────────────────────────────────────────────

export interface AvatarProps {
  name: string;
  src?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function Avatar({ name, src, size = 'md', className }: AvatarProps) {
  const sizeMap = {
    sm: 'h-8 w-8 text-xs',
    md: 'h-9 w-9 text-sm',
    lg: 'h-14 w-14 text-xl',
  };
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name}
        className={`rounded-full object-cover ${sizeMap[size]} ${className ?? ''}`}
      />
    );
  }
  return (
    <div className={`flex items-center justify-center rounded-full bg-primary/10 font-bold text-primary ${sizeMap[size]} ${className ?? ''}`}>
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// SECTION 15: UTILITIES
// ─────────────────────────────────────────────────────────────

/** Money formatter (INR) */
export function money(paise: number, currency = 'INR') {
  const sym = currency === 'INR' ? '₹' : currency === 'AED' ? 'د.إ' : currency === 'USD' ? '$' : currency;
  return sym + (paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 });
}

// ─── Backward Compatibility Aliases ─────────────────────────
// Ensure older pages that use old API still compile during migration.

/** @deprecated Use <Button variant="primary"> instead */
export function PrimaryButton({
  icon,
  onClick,
  disabled,
  loading,
  children,
}: {
  icon?: LucideIcon;
  color?: string;
  hoverColor?: string;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  children: React.ReactNode;
}) {
  return <Button variant="primary" icon={icon} onClick={onClick} disabled={disabled} loading={loading}>{children}</Button>;
}

/** @deprecated Use <Input> instead */
export function FormInput({ accentColor, className, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { accentColor?: string }) {
  return <Input className={className} {...props} />;
}

/** @deprecated Use <Select> instead */
export function FormSelect({ value, onChange, options, className }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; className?: string }) {
  return <Select value={value} onChange={onChange} options={options} className={className} />;
}
