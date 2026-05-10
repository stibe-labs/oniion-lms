// ═══════════════════════════════════════════════════════════════
// stibe Portal — Dashboard UI Components (v4 — Modern Redesign)
// ═══════════════════════════════════════════════════════════════

'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { MiniCharacterLoader } from '@/components/loading/CharacterLoader';
import {
  Loader2, Search, X, CheckCircle, AlertCircle, AlertTriangle, Info, RefreshCw,
  Shield, MapPin, Building, Briefcase, BookOpen, GraduationCap, Users, Eye, User, Inbox,
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
  primary:   'bg-primary text-white hover:bg-primary/90 shadow-sm shadow-primary/20 active:scale-[0.97]',
  secondary: 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 hover:border-gray-300 shadow-sm active:scale-[0.97]',
  outline:   'bg-transparent text-gray-600 border border-gray-200 hover:bg-gray-50 hover:text-gray-900 active:scale-[0.97]',
  ghost:     'text-gray-500 hover:bg-gray-100 hover:text-gray-800 active:scale-[0.97]',
  danger:    'bg-red-500 text-white hover:bg-red-600 shadow-sm shadow-red-200 active:scale-[0.97]',
  success:   'bg-primary text-white hover:bg-primary/90 shadow-sm shadow-primary/20 active:scale-[0.97]',
};

const BTN_SIZE: Record<ButtonSize, string> = {
  xs: 'px-2.5 py-1 text-xs gap-1 rounded-lg h-7',
  sm: 'px-3 py-1.5 text-xs gap-1.5 rounded-lg h-8',
  md: 'px-4 py-2 text-sm gap-1.5 rounded-xl h-9',
  lg: 'px-5 py-2.5 text-sm gap-2 rounded-xl h-10',
};

const BTN_ICON: Record<ButtonSize, string> = {
  xs: 'h-3 w-3',
  sm: 'h-3.5 w-3.5',
  md: 'h-4 w-4',
  lg: 'h-4 w-4',
};

export function Button({
  variant = 'primary', size = 'md', icon: Icon, iconRight: IconRight,
  loading, disabled, children, className, ...props
}: ButtonProps) {
  const iconCls = BTN_ICON[size];
  return (
    <button
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center font-medium transition-all duration-150 disabled:opacity-40 disabled:pointer-events-none ${BTN_VARIANT[variant]} ${BTN_SIZE[size]} ${className ?? ''}`}
      {...props}
    >
      {loading ? <Loader2 className={`animate-spin ${iconCls}`} /> : Icon ? <Icon className={iconCls} /> : null}
      {children}
      {IconRight && !loading && <IconRight className={iconCls} />}
    </button>
  );
}

export function IconButton({
  icon: Icon, variant = 'ghost', size = 'sm', loading, className, ...props
}: Omit<ButtonProps, 'children'> & { icon: LucideIcon }) {
  const sizeMap: Record<ButtonSize, string> = {
    xs: 'h-7 w-7', sm: 'h-8 w-8', md: 'h-9 w-9', lg: 'h-10 w-10',
  };
  const iconMap: Record<ButtonSize, string> = {
    xs: 'h-3.5 w-3.5', sm: 'h-4 w-4', md: 'h-4 w-4', lg: 'h-5 w-5',
  };
  return (
    <button
      disabled={props.disabled || loading}
      className={`inline-flex items-center justify-center rounded-xl transition-all duration-150 disabled:opacity-40 ${BTN_VARIANT[variant]} ${sizeMap[size]} ${className ?? ''}`}
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
      className={`w-full h-9 rounded-xl border bg-white px-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition-all duration-150 ${
        error
          ? 'border-red-300 focus:border-red-400 focus:ring-2 focus:ring-red-100'
          : 'border-gray-200 hover:border-gray-300 focus:border-primary/50 focus:ring-2 focus:ring-primary/10'
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
      className={`w-full rounded-xl border bg-white py-2.5 px-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition-all duration-150 resize-none ${
        error
          ? 'border-red-300 focus:border-red-400 focus:ring-2 focus:ring-red-100'
          : 'border-gray-200 hover:border-gray-300 focus:border-primary/50 focus:ring-2 focus:ring-primary/10'
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
      className={`w-full h-9 rounded-xl border bg-white px-3 text-sm text-gray-900 outline-none transition-all duration-150 cursor-pointer ${
        error
          ? 'border-red-300 focus:border-red-400 focus:ring-2 focus:ring-red-100'
          : 'border-gray-200 hover:border-gray-300 focus:border-primary/50 focus:ring-2 focus:ring-primary/10'
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
    <div className={`relative flex-1 min-w-0 sm:min-w-56 ${className ?? ''}`}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-9 rounded-xl border border-gray-200 bg-white pl-9 pr-4 text-sm text-gray-900 placeholder:text-gray-400 hover:border-gray-300 focus:border-primary/50 focus:ring-2 focus:ring-primary/10 outline-none transition-all duration-150"
      />
      {value && (
        <button onClick={() => onChange('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

export interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  size?: 'sm' | 'md';
}

export function Toggle({ checked, onChange, label, disabled, size = 'md' }: ToggleProps) {
  const trackSize = size === 'sm' ? 'h-5 w-9' : 'h-6 w-11';
  const dotSize   = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4.5 w-4.5';
  const dotPos    = size === 'sm'
    ? (checked ? 'translate-x-[18px]' : 'translate-x-[3px]')
    : (checked ? 'translate-x-[22px]' : 'translate-x-[3px]');

  return (
    <label className={`inline-flex items-center gap-2.5 ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex ${trackSize} items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary/20 ${
          checked ? 'bg-primary shadow-sm shadow-primary/30' : 'bg-gray-200'
        }`}
      >
        <span className={`${dotSize} absolute top-[3px] rounded-full bg-white shadow-sm transition-transform duration-200 ${dotPos}`} />
      </button>
      {label && <span className="text-sm text-gray-700 select-none">{label}</span>}
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
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/20">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">{title}</h1>
          {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {children && <div className="flex items-center gap-2 flex-wrap">{children}</div>}
    </div>
  );
}

export function RefreshButton({ loading, onClick, label = 'Refresh' }: { loading?: boolean; onClick: () => void; label?: string }) {
  return (
    <Button variant="outline" size="sm" onClick={onClick} disabled={loading} icon={RefreshCw} className={loading ? '[&_svg]:animate-spin' : ''}>
      {label}
    </Button>
  );
}

export interface TabItem { key: string; label: string; icon?: LucideIcon; count?: number; }
export interface TabBarProps { tabs: TabItem[]; active: string; onChange: (key: string) => void; }

export function TabBar({ tabs, active, onChange }: TabBarProps) {
  return (
    <div className="hidden sm:flex items-center gap-1 p-1 bg-gray-100/80 rounded-xl w-fit max-w-full overflow-x-auto">
      {tabs.map((t) => {
        const isActive = active === t.key;
        const Icon = t.icon;
        return (
          <button
            key={t.key}
            onClick={() => onChange(t.key)}
            className={`whitespace-nowrap inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all duration-150 ${
              isActive
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700 hover:bg-white/60'
            }`}
          >
            {Icon && <Icon className="h-3.5 w-3.5 shrink-0" />}
            {t.label}
            {t.count !== undefined && (
              <span className={`ml-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                isActive ? 'bg-primary/10 text-primary' : 'bg-gray-200 text-gray-500'
              }`}>
                {t.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function UnderlineTabBar({ tabs, active, onChange }: TabBarProps) {
  return (
    <div className="flex gap-0 border-b border-gray-200 overflow-x-auto">
      {tabs.map((t) => {
        const isActive = active === t.key;
        const Icon = t.icon;
        return (
          <button
            key={t.key}
            onClick={() => onChange(t.key)}
            className={`relative inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-all duration-150 ${
              isActive ? 'text-primary' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {Icon && <Icon className="h-3.5 w-3.5 shrink-0" />}
            {t.label}
            {t.count !== undefined && (
              <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                isActive ? 'bg-primary/10 text-primary' : 'bg-gray-100 text-gray-500'
              }`}>{t.count}</span>
            )}
            {isActive && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />}
          </button>
        );
      })}
    </div>
  );
}

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
      className="h-8 rounded-lg border border-gray-200 bg-white px-2.5 text-xs font-medium text-gray-700 outline-none hover:border-gray-300 focus:border-primary/50 focus:ring-2 focus:ring-primary/10 cursor-pointer transition-all"
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
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gray-50/60">
        <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
          {Icon && <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary/10"><Icon className="h-3.5 w-3.5 text-primary" /></span>}
          {title}
        </h3>
        {onClose && (
          <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-200 hover:text-gray-600 transition-colors">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      <div className="p-5 space-y-4">{children}</div>
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
      <label className="block text-xs font-semibold text-gray-600 mb-1.5">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {error  && <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1"><AlertCircle className="h-3 w-3 shrink-0" />{error}</p>}
      {hint && !error && <p className="mt-1.5 text-xs text-gray-400">{hint}</p>}
    </div>
  );
}

export function FormGrid({ cols = 2, children, className }: { cols?: 1 | 2 | 3 | 4; children: React.ReactNode; className?: string }) {
  const colClass: Record<number, string> = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 md:grid-cols-4',
  };
  return <div className={`grid gap-4 ${colClass[cols]} ${className ?? ''}`}>{children}</div>;
}

export interface FormActionsProps {
  onCancel?: () => void;
  onSubmit?: () => void;
  submitLabel?: string;
  submitDisabled?: boolean;
  submitting?: boolean;
  cancelLabel?: string;
  children?: React.ReactNode;
}

export function FormActions({ onCancel, onSubmit, submitLabel = 'Save', submitDisabled, submitting, cancelLabel = 'Cancel', children }: FormActionsProps) {
  return (
    <div className="flex justify-end gap-2 pt-3 border-t border-gray-100 mt-2">
      {children || (
        <>
          {onCancel && <Button variant="secondary" size="sm" onClick={onCancel}>{cancelLabel}</Button>}
          {onSubmit && (
            <Button variant="primary" size="sm" onClick={onSubmit} disabled={submitDisabled} loading={submitting}>
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

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className={fullScreen
          ? 'bg-white w-full h-full flex flex-col overflow-hidden'
          : `bg-white w-full ${widthClass[maxWidth]} mx-0 sm:mx-4 shadow-2xl overflow-hidden
             rounded-t-2xl sm:rounded-2xl
             animate-in fade-in slide-in-from-bottom-4 sm:slide-in-from-bottom-2 duration-200`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`flex items-center justify-between px-5 py-4 border-b border-gray-100 ${fullScreen ? 'shrink-0' : ''}`}>
          <div>
            <h2 className="text-base font-semibold text-gray-900">{title}</h2>
            {subtitle && <div className="text-xs text-gray-500 mt-0.5">{subtitle}</div>}
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-xl bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {/* Body */}
        {fullScreen
          ? <div className="flex-1 overflow-y-auto p-5">{children}</div>
          : <div className="p-5 overflow-y-auto max-h-[80vh]">{children}</div>}
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

interface ConfirmContextType { confirm: (options: ConfirmDialogOptions) => Promise<boolean>; }
const ConfirmContext = createContext<ConfirmContextType | null>(null);

export function useConfirm(): ConfirmContextType {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be wrapped in <ConfirmProvider>');
  return ctx;
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<{ open: boolean; options: ConfirmDialogOptions; resolve: ((v: boolean) => void) | null }>({
    open: false, options: { title: '', message: '' }, resolve: null,
  });

  const confirm = useCallback((options: ConfirmDialogOptions): Promise<boolean> =>
    new Promise<boolean>((resolve) => setState({ open: true, options, resolve })), []);

  const handleClose = useCallback((result: boolean) => {
    state.resolve?.(result);
    setState({ open: false, options: { title: '', message: '' }, resolve: null });
  }, [state.resolve]);

  useEffect(() => {
    if (state.open) { document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = ''; }; }
  }, [state.open]);

  useEffect(() => {
    if (!state.open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state.open, handleClose]);

  const { options } = state;
  const variant = options.variant ?? 'danger';
  const VS = {
    danger:  { iconBg: 'bg-red-100',   iconColor: 'text-red-600',   btn: 'bg-red-500 hover:bg-red-600 text-white shadow-sm shadow-red-200' },
    warning: { iconBg: 'bg-amber-100', iconColor: 'text-amber-600', btn: 'bg-amber-500 hover:bg-amber-600 text-white shadow-sm shadow-amber-200' },
    info:    { iconBg: 'bg-primary/10', iconColor: 'text-primary',  btn: 'bg-primary hover:bg-primary/90 text-white shadow-sm shadow-primary/20' },
  };
  const DEFAULT_ICONS: Record<string, LucideIcon> = { danger: AlertTriangle, warning: AlertCircle, info: Info };
  const vs = VS[variant];
  const IconComp = options.icon ?? DEFAULT_ICONS[variant];
  const api = React.useMemo<ConfirmContextType>(() => ({ confirm }), [confirm]);

  return (
    <ConfirmContext.Provider value={api}>
      {children}
      {state.open && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => handleClose(false)}>
          <div
            className="w-full max-w-sm rounded-2xl bg-white shadow-2xl ring-1 ring-gray-200/80 animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex items-start gap-4">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${vs.iconBg}`}>
                  <IconComp className={`h-5 w-5 ${vs.iconColor}`} />
                </div>
                <div className="flex-1 min-w-0 pt-0.5">
                  <h3 className="text-sm font-semibold text-gray-900">{options.title}</h3>
                  <p className="mt-1.5 text-sm text-gray-500 leading-relaxed">{options.message}</p>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 mt-5">
                <button
                  onClick={() => handleClose(false)}
                  className="h-9 rounded-xl border border-gray-200 bg-white px-4 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  {options.cancelLabel ?? 'Cancel'}
                </button>
                <button
                  onClick={() => handleClose(true)}
                  className={`h-9 rounded-xl px-4 text-sm font-medium transition-all active:scale-[0.97] ${vs.btn}`}
                >
                  {options.confirmLabel ?? 'Confirm'}
                </button>
              </div>
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

export function Card({ children, className, onClick }: { children: React.ReactNode; className?: string; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      className={`rounded-2xl border border-gray-200 bg-white shadow-sm ${onClick ? 'cursor-pointer hover:shadow-md hover:border-gray-300 transition-all duration-150' : ''} ${className ?? ''}`}
    >
      {children}
    </div>
  );
}

export interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
}

const STAT_STYLES: Record<string, { iconBg: string; iconColor: string; valueColor: string }> = {
  default: { iconBg: 'bg-gray-100',    iconColor: 'text-gray-500',  valueColor: 'text-gray-900' },
  success: { iconBg: 'bg-primary/10',  iconColor: 'text-primary',   valueColor: 'text-primary' },
  warning: { iconBg: 'bg-amber-100',   iconColor: 'text-amber-600', valueColor: 'text-amber-700' },
  danger:  { iconBg: 'bg-red-100',     iconColor: 'text-red-500',   valueColor: 'text-red-600' },
  info:    { iconBg: 'bg-sky-100',     iconColor: 'text-sky-600',   valueColor: 'text-sky-700' },
};

export function StatCard({ icon: Icon, label, value, variant = 'default' }: StatCardProps) {
  const s = STAT_STYLES[variant];
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 flex items-center gap-3.5 shadow-sm">
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${s.iconBg}`}>
        <Icon className={`h-5 w-5 ${s.iconColor}`} />
      </div>
      <div className="min-w-0">
        <p className={`text-2xl font-bold tracking-tight truncate ${s.valueColor}`}>{value}</p>
        <p className="text-xs text-gray-500 leading-tight mt-0.5">{label}</p>
      </div>
    </div>
  );
}

export function StatCardSmall({ icon: Icon, label, value, variant = 'default' }: StatCardProps) {
  const s = STAT_STYLES[variant];
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3 flex items-center gap-3 shadow-sm">
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${s.iconBg}`}>
        <Icon className={`h-4 w-4 ${s.iconColor}`} />
      </div>
      <div className="min-w-0">
        <p className={`text-xl font-bold tracking-tight ${s.valueColor}`}>{value}</p>
        <p className="text-[11px] text-gray-500 truncate leading-tight">{label}</p>
      </div>
    </div>
  );
}

export interface InfoCardProps { label: string; icon?: LucideIcon; children: React.ReactNode; }

export function InfoCard({ label, icon: Icon, children }: InfoCardProps) {
  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-3">
      <p className="text-[11px] font-medium text-gray-400 mb-1.5 flex items-center gap-1 uppercase tracking-wide">
        {Icon && <Icon className="h-3 w-3" />} {label}
      </p>
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// SECTION 7: TABLES
// ─────────────────────────────────────────────────────────────

export interface TableWrapperProps { children: React.ReactNode; footer?: React.ReactNode; }

export function TableWrapper({ children, footer }: TableWrapperProps) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
      <table className="w-full text-sm">{children}</table>
      {footer && (
        <div className="flex items-center justify-between border-t border-gray-100 px-4 py-2.5 text-xs text-gray-400 bg-gray-50/60">
          {footer}
        </div>
      )}
    </div>
  );
}

export function THead({ children }: { children: React.ReactNode }) {
  return (
    <thead>
      <tr className="border-b border-gray-100 bg-gray-50/80">{children}</tr>
    </thead>
  );
}

export function TH({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <th className={`px-4 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider ${className ?? ''}`}>
      {children}
    </th>
  );
}

export function TRow({ selected, onClick, children, className }: {
  selected?: boolean; onClick?: () => void; children: React.ReactNode; className?: string;
}) {
  return (
    <tr
      onClick={onClick}
      className={`border-b border-gray-50 last:border-0 transition-colors duration-100 ${
        onClick ? 'cursor-pointer' : ''
      } ${selected ? 'bg-primary/8 border-primary/15' : 'hover:bg-gray-50/80'} ${className ?? ''}`}
    >
      {children}
    </tr>
  );
}

// ─────────────────────────────────────────────────────────────
// SECTION 8: DETAIL PANEL
// ─────────────────────────────────────────────────────────────

export interface DetailPanelProps { onClose?: () => void; loading?: boolean; emptyMessage?: string; children: React.ReactNode; }

export function DetailPanel({ onClose, loading, emptyMessage, children }: DetailPanelProps) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <div className="p-5 space-y-5">
        {loading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : children ? children : (
          <p className="text-sm text-gray-400 text-center py-12">{emptyMessage || 'No data available'}</p>
        )}
      </div>
    </div>
  );
}

export interface DetailHeaderProps { title: string; subtitle?: string; onClose: () => void; children?: React.ReactNode; }

export function DetailHeader({ title, subtitle, onClose, children }: DetailHeaderProps) {
  return (
    <div className="flex items-start justify-between">
      <div>
        <h3 className="text-base font-bold text-gray-900">{title}</h3>
        {subtitle && <p className="text-xs text-gray-400 font-mono mt-0.5">{subtitle}</p>}
        {children}
      </div>
      <button
        onClick={onClose}
        className="flex h-8 w-8 items-center justify-center rounded-xl bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700 transition-colors ml-3 shrink-0"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// SECTION 9: BADGES
// ─────────────────────────────────────────────────────────────

export type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'primary' | 'secondary';

const BADGE_COLORS: Record<BadgeVariant, string> = {
  default:   'bg-gray-100 text-gray-600',
  success:   'bg-primary/10 text-primary',
  warning:   'bg-amber-100 text-amber-700',
  danger:    'bg-red-100 text-red-600',
  info:      'bg-sky-100 text-sky-700',
  primary:   'bg-primary/10 text-primary',
  secondary: 'bg-secondary/10 text-secondary',
};

export interface BadgeProps { icon?: LucideIcon; label: string; variant?: BadgeVariant; colorClass?: string; }

export function Badge({ icon: Icon, label, variant = 'default', colorClass }: BadgeProps) {
  const cls = colorClass ?? BADGE_COLORS[variant];
  return (
    <span className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-xs font-semibold ${cls}`}>
      {Icon && <Icon className="h-3 w-3 shrink-0" />}
      {label}
    </span>
  );
}

const STATUS_MAP: Record<string, BadgeVariant> = {
  active: 'success', inactive: 'danger', paid: 'success', unpaid: 'warning',
  pending: 'warning', pending_ao: 'warning', pending_hr: 'info', confirmed: 'success',
  overdue: 'danger', draft: 'default', scheduled: 'info', live: 'primary',
  ended: 'default', cancelled: 'danger', finalized: 'info', exempt: 'info',
  scholarship: 'primary', completed: 'success', graded: 'success', submitted: 'info',
  published: 'primary', approved: 'success', rejected: 'danger', withdrawn: 'danger',
};

const STATUS_DOTS: Record<BadgeVariant, string> = {
  default: 'bg-gray-400', success: 'bg-primary', warning: 'bg-amber-500',
  danger: 'bg-red-500', info: 'bg-sky-500', primary: 'bg-primary', secondary: 'bg-secondary',
};

export function StatusBadge({ status, icon, label }: { status: string; icon?: LucideIcon; label?: string }) {
  const variant = STATUS_MAP[status] ?? 'default';
  const cls = BADGE_COLORS[variant];
  const dotCls = STATUS_DOTS[variant];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-0.5 text-xs font-semibold ${cls}`}>
      {icon ? React.createElement(icon, { className: 'h-3 w-3 shrink-0' }) : <span className={`h-1.5 w-1.5 rounded-full ${dotCls} shrink-0`} />}
      {label || status}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────
// SECTION 10: ROLE CONFIG
// ─────────────────────────────────────────────────────────────

export interface RoleConfig { label: string; variant: BadgeVariant; icon: LucideIcon; color: string; bg: string; }

export const ROLE_CONFIG: Record<string, RoleConfig> = {
  owner:             { label: 'Owner',             variant: 'primary',   icon: Shield,        color: 'text-primary',   bg: 'bg-primary/10' },
  batch_coordinator: { label: 'Batch Coordinator', variant: 'info',      icon: MapPin,        color: 'text-sky-600',   bg: 'bg-sky-50' },
  academic_operator: { label: 'Academic Op',       variant: 'success',   icon: Building,      color: 'text-primary',   bg: 'bg-primary/5' },
  hr:                { label: 'HR',                variant: 'warning',   icon: Briefcase,     color: 'text-amber-600', bg: 'bg-amber-50' },
  teacher:           { label: 'Teacher',           variant: 'info',      icon: BookOpen,      color: 'text-sky-600',   bg: 'bg-sky-50' },
  teacher_screen:    { label: 'Teacher Screen',    variant: 'default',   icon: BookOpen,      color: 'text-gray-600',  bg: 'bg-gray-50' },
  student:           { label: 'Student',           variant: 'primary',   icon: GraduationCap, color: 'text-primary',   bg: 'bg-primary/10' },
  parent:            { label: 'Parent',            variant: 'success',   icon: Users,         color: 'text-primary',   bg: 'bg-primary/5' },
  ghost:             { label: 'Ghost',             variant: 'default',   icon: Eye,           color: 'text-gray-500',  bg: 'bg-gray-50' },
  academic:          { label: 'Academic (Legacy)', variant: 'default',   icon: GraduationCap, color: 'text-gray-600',  bg: 'bg-gray-50' },
};

export function RoleBadge({ role }: { role: string }) {
  const cfg = ROLE_CONFIG[role] || { label: role, variant: 'default' as BadgeVariant, icon: User };
  return <Badge icon={cfg.icon} label={cfg.label} variant={cfg.variant} />;
}

export function ActiveIndicator({ active }: { active: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-0.5 text-xs font-semibold ${active ? 'bg-primary/10 text-primary' : 'bg-gray-100 text-gray-500'}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-primary' : 'bg-gray-400'}`} />
      {active ? 'Active' : 'Inactive'}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────
// SECTION 11: LOADING & EMPTY STATES
// ─────────────────────────────────────────────────────────────

export function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center gap-3" style={{ minHeight: 'calc(100vh - 140px)' }}>
      <MiniCharacterLoader text="Loading" />
    </div>
  );
}

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

export function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-gray-100 ${className ?? ''}`} />;
}

export interface EmptyStateProps { icon?: LucideIcon; message?: string; }

export function EmptyState({ icon: Icon, message = 'No data found' }: EmptyStateProps) {
  const FallbackIcon = Icon || Inbox;
  return (
    <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-3">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100">
        <FallbackIcon className="h-7 w-7 text-gray-400" />
      </div>
      <p className="text-sm font-medium text-gray-400">{message}</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// SECTION 12: ALERTS & FEEDBACK
// ─────────────────────────────────────────────────────────────

type AlertVariant = 'success' | 'error' | 'warning' | 'info';

const ALERT_STYLES: Record<AlertVariant, { border: string; iconBg: string; iconColor: string; text: string; bg: string; icon: LucideIcon }> = {
  success: { bg: 'bg-white', border: 'border-primary/20 border-l-4 border-l-primary', iconBg: 'bg-primary/10', iconColor: 'text-primary',  text: 'text-gray-700', icon: CheckCircle },
  error:   { bg: 'bg-white', border: 'border-red-200   border-l-4 border-l-red-500',  iconBg: 'bg-red-50',    iconColor: 'text-red-500',   text: 'text-gray-700', icon: AlertCircle },
  warning: { bg: 'bg-white', border: 'border-amber-200 border-l-4 border-l-amber-500',iconBg: 'bg-amber-50',  iconColor: 'text-amber-600', text: 'text-gray-700', icon: AlertTriangle },
  info:    { bg: 'bg-white', border: 'border-sky-200   border-l-4 border-l-sky-500',  iconBg: 'bg-sky-50',    iconColor: 'text-sky-600',   text: 'text-gray-700', icon: Info },
};

export interface AlertProps { variant: AlertVariant; message: string; onDismiss?: () => void; className?: string; }

export function Alert({ variant, message, onDismiss, className }: AlertProps) {
  const style = ALERT_STYLES[variant];
  const Icon = style.icon;
  return (
    <div className={`${style.bg} ${style.border} border rounded-xl px-4 py-3 flex items-start gap-3 shadow-sm ${className ?? ''}`}>
      <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${style.iconBg} mt-0.5`}>
        <Icon className={`h-3.5 w-3.5 ${style.iconColor}`} />
      </div>
      <p className={`text-sm ${style.text} flex-1 leading-relaxed`}>{message}</p>
      {onDismiss && (
        <button onClick={onDismiss} className="text-gray-400 hover:text-gray-600 mt-0.5 shrink-0 transition-colors">
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// SECTION 13: TOAST SYSTEM
// ─────────────────────────────────────────────────────────────

interface ToastItem { id: number; variant: AlertVariant; message: string; }
interface ToastContextType { success: (msg: string) => void; error: (msg: string) => void; warning: (msg: string) => void; info: (msg: string) => void; }
const ToastContext = createContext<ToastContextType | null>(null);

export function useToast(): ToastContextType {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be wrapped in <ToastProvider>');
  return ctx;
}

const TOAST_STYLES: Record<AlertVariant, { dot: string; icon: LucideIcon; iconColor: string }> = {
  success: { dot: 'bg-primary',  icon: CheckCircle,  iconColor: 'text-primary' },
  error:   { dot: 'bg-red-500',  icon: AlertCircle,  iconColor: 'text-red-400' },
  warning: { dot: 'bg-amber-500',icon: AlertTriangle, iconColor: 'text-amber-400' },
  info:    { dot: 'bg-sky-500',  icon: Info,          iconColor: 'text-sky-400' },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const add = useCallback((variant: AlertVariant, message: string) => {
    const id = nextId.current++;
    setToasts((prev) => [...prev, { id, variant, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4500);
  }, []);

  const dismiss = useCallback((id: number) => setToasts((prev) => prev.filter((t) => t.id !== id)), []);

  const api = React.useMemo<ToastContextType>(() => ({
    success: (msg) => add('success', msg),
    error:   (msg) => add('error', msg),
    warning: (msg) => add('warning', msg),
    info:    (msg) => add('info', msg),
  }), [add]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="fixed bottom-4 left-3 right-3 sm:left-auto sm:right-4 z-[9999] flex flex-col gap-2 sm:max-w-sm pointer-events-none">
        {toasts.map((t) => {
          const s = TOAST_STYLES[t.variant];
          const Icon = s.icon;
          return (
            <div
              key={t.id}
              className="pointer-events-auto flex items-start gap-3 rounded-2xl bg-gray-900 px-4 py-3 shadow-xl ring-1 ring-white/10 animate-in slide-in-from-bottom-3 duration-300"
            >
              <Icon className={`h-4 w-4 shrink-0 mt-0.5 ${s.iconColor}`} />
              <p className="text-sm text-white flex-1 leading-relaxed">{t.message}</p>
              <button onClick={() => dismiss(t.id)} className="text-gray-500 hover:text-gray-300 shrink-0 transition-colors ml-1">
                <X className="h-3.5 w-3.5" />
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

export interface AvatarProps { name: string; src?: string | null; size?: 'sm' | 'md' | 'lg'; className?: string; }

export function Avatar({ name, src, size = 'md', className }: AvatarProps) {
  const sizeMap = { sm: 'h-8 w-8 text-xs', md: 'h-9 w-9 text-sm', lg: 'h-14 w-14 text-xl' };
  if (src) {
    return <img src={src} alt={name} className={`rounded-full object-cover ${sizeMap[size]} ${className ?? ''}`} />;
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

export function money(paise: number, currency = 'INR') {
  const sym = currency === 'INR' ? '₹' : currency === 'AED' ? 'د.إ' : currency === 'USD' ? '$' : currency;
  return sym + (paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 });
}

// ── Backward Compatibility Aliases ──────────────────────────

/** @deprecated Use <Button variant="primary"> */
export function PrimaryButton({ icon, onClick, disabled, loading, children }: { icon?: LucideIcon; color?: string; hoverColor?: string; onClick: () => void; disabled?: boolean; loading?: boolean; children: React.ReactNode }) {
  return <Button variant="primary" icon={icon} onClick={onClick} disabled={disabled} loading={loading}>{children}</Button>;
}

/** @deprecated Use <Input> */
export function FormInput({ accentColor, className, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { accentColor?: string }) {
  return <Input className={className} {...props} />;
}

/** @deprecated Use <Select> */
export function FormSelect({ value, onChange, options, className }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; className?: string }) {
  return <Select value={value} onChange={onChange} options={options} className={className} />;
}
