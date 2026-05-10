'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useState, useRef, useCallback, useEffect } from 'react';
import {
  LogOut, Menu, X, LayoutDashboard, BookOpen, Users, GraduationCap,
  Eye, Shield, UserCheck, ChevronLeft, PanelLeftClose, PanelLeftOpen,
  type LucideIcon,
} from 'lucide-react';
import { getNavForRole, resolveActiveNav } from '@/lib/nav-config';
import { usePlatformName, usePlatformContext } from '@/components/providers/PlatformProvider';

interface NavItem { label: string; href: string; icon: LucideIcon; active?: boolean; }

interface DashboardShellProps {
  role: string;
  userName: string;
  userEmail: string;
  children: React.ReactNode;
  permissions?: Record<string, boolean>;
  navBadges?: Record<string, number>;
}

const ROLE_LABELS: Record<string, string> = {
  superadmin: 'Superadmin', batch_coordinator: 'Coordinator',
  academic_operator: 'Academic Ops', hr: 'HR Associate', teacher: 'Teacher',
  student: 'Student', academic: 'Academic', parent: 'Parent',
  owner: 'Owner', ghost: 'Ghost Observer', sales: 'Sales CRM',
};

const ROLE_COLORS: Record<string, string> = {
  superadmin: 'bg-violet-500/20 text-violet-300',
  owner: 'bg-amber-500/20 text-amber-300',
  teacher: 'bg-primary/20 text-primary',
  student: 'bg-sky-500/20 text-sky-300',
  batch_coordinator: 'bg-primary/20 text-primary',
  academic_operator: 'bg-primary/20 text-primary',
  hr: 'bg-rose-500/20 text-rose-300',
  parent: 'bg-teal-500/20 text-teal-300',
  ghost: 'bg-gray-500/20 text-gray-400',
  sales: 'bg-orange-500/20 text-orange-300',
  academic: 'bg-primary/20 text-primary',
};

/* ── Tooltip for collapsed nav items ── */
function NavTooltip({ label, children }: { label: string; children: React.ReactNode }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      {children}
      {show && (
        <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 z-50">
          <div className="bg-gray-900 text-white text-xs font-medium px-2.5 py-1.5 rounded-lg shadow-xl whitespace-nowrap border border-white/10">
            {label}
          </div>
          <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-gray-900" />
        </div>
      )}
    </div>
  );
}

/* ── Nav item ── */
function SidebarNavItem({
  item, collapsed, index, onNavigate, currentPathname, badge,
}: {
  item: NavItem; collapsed: boolean; index: number;
  onNavigate?: () => void; currentPathname: string; badge?: number;
}) {
  const hasBadge = badge !== undefined && badge > 0;

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    const url = new URL(item.href, window.location.origin);
    if (url.pathname === currentPathname) {
      e.preventDefault();
      window.location.hash = url.hash;
    }
    onNavigate?.();
  };

  const inner = (
    <a
      href={item.href}
      onClick={handleClick}
      style={{ animationDelay: `${index * 35}ms` }}
      title={undefined}
      className={`
        group relative flex items-center gap-3 rounded-xl text-[13px] font-medium
        transition-all duration-200 ease-out select-none
        ${collapsed ? 'justify-center p-2.5' : 'px-3 py-2.5'}
        ${item.active
          ? 'bg-primary text-white shadow-lg shadow-primary/25'
          : 'text-slate-400 hover:bg-white/6 hover:text-white'
        }
      `}
    >
      {/* Icon */}
      <span className="relative shrink-0 flex items-center justify-center">
        <span className={`
          flex items-center justify-center rounded-lg transition-all duration-200
          ${collapsed ? 'h-8 w-8' : 'h-6 w-6'}
        `}>
          <item.icon className={`transition-all duration-200
            ${collapsed ? 'h-4.5 w-4.5' : 'h-4 w-4'}
            ${item.active ? 'text-white' : 'text-slate-500 group-hover:text-white'}
          `} />
        </span>
        {hasBadge && collapsed && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-0.5 text-[9px] font-bold text-white ring-1 ring-slate-900 shadow">
            {badge! > 99 ? '99+' : badge}
          </span>
        )}
      </span>

      {!collapsed && (
        <>
          <span className="flex-1 truncate">{item.label}</span>
          {hasBadge ? (
            <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white shadow">
              {badge! > 99 ? '99+' : badge}
            </span>
          ) : item.active ? (
            <span className="ml-auto h-1.5 w-1.5 rounded-full bg-white/60 animate-pulse" />
          ) : null}
        </>
      )}
    </a>
  );

  return collapsed ? <NavTooltip label={item.label}>{inner}</NavTooltip> : inner;
}

export default function DashboardShell({
  role, userName, userEmail, children, permissions, navBadges,
}: DashboardShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const platformName = usePlatformName();
  const { logoSmallUrl, logoSidebarHeight } = usePlatformContext();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [currentHash, setCurrentHash] = useState('');
  const [currentSearch, setCurrentSearch] = useState('');
  const [profileImage, setProfileImage] = useState<string | null>(null);

  useEffect(() => {
    setCurrentHash(window.location.hash);
    setCurrentSearch(window.location.search);
    const onHash = () => { setCurrentHash(window.location.hash); setCurrentSearch(window.location.search); };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    fetch('/api/v1/users/profile-image')
      .then(r => r.json())
      .then(d => { if (d.success && d.data?.profile_image) setProfileImage(d.data.profile_image); })
      .catch(() => {});
  }, []);

  const roleLabel = ROLE_LABELS[role] || role;
  const roleBadgeClass = ROLE_COLORS[role] || 'bg-primary/20 text-primary';
  const navItems = resolveActiveNav(getNavForRole(role, permissions), pathname, currentHash, currentSearch);
  const activeNavItem = navItems.find(n => n.active);
  const isSubTab = !!currentHash;
  const mobileTabLabel = isSubTab
    ? (activeNavItem?.label ?? currentHash.replace('#', '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()))
    : '';
  const initials = userName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

  async function handleLogout() {
    setLoggingOut(true);
    await fetch('/api/v1/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  return (
    <div className="flex h-screen bg-slate-50 text-gray-900">

      {/* ═══ SIDEBAR ═══ */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 flex flex-col
        bg-slate-900
        transition-all duration-300 ease-in-out
        lg:static lg:translate-x-0
        ${collapsed ? 'w-[68px]' : 'w-[240px]'}
        ${sidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full lg:translate-x-0'}
      `}>

        {/* Subtle gradient overlay */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-primary/8 via-transparent to-primary/4 rounded-none" />

        {/* ── Brand ── */}
        <div className={`
          relative flex items-center gap-3 pt-[env(safe-area-inset-top)]
          border-b border-white/6
          ${collapsed ? 'justify-center px-2 h-16' : 'px-4 h-16'}
        `}>
          {/* Logo mark */}
          <div className="relative shrink-0 flex items-center justify-center h-9 w-9 rounded-xl bg-primary/15 ring-1 ring-primary/30 shadow-lg shadow-primary/10">
            <img
              src={logoSmallUrl ?? '/logo/main.png'}
              alt="Logo"
              style={{ height: logoSidebarHeight, width: logoSidebarHeight }}
              className="object-contain"
            />
            <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-slate-900 shadow" />
          </div>

          {!collapsed && (
            <div className="flex-1 min-w-0">
              <h1 className="text-sm font-bold text-white tracking-wide truncate">{platformName}</h1>
              <span className={`inline-flex items-center mt-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-semibold tracking-wide ${roleBadgeClass}`}>
                {roleLabel}
              </span>
            </div>
          )}

          {/* Mobile close */}
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden ml-auto flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-white/8 hover:text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>

          {/* Desktop collapse toggle */}
          <button
            onClick={() => setCollapsed(c => !c)}
            className="hidden lg:flex ml-auto h-7 w-7 items-center justify-center rounded-lg text-slate-500 hover:bg-white/8 hover:text-white transition-all duration-200 active:scale-90"
            title={collapsed ? 'Expand' : 'Collapse'}
          >
            {collapsed ? <PanelLeftOpen className="h-3.5 w-3.5" /> : <PanelLeftClose className="h-3.5 w-3.5" />}
          </button>
        </div>

        {/* ── Navigation ── */}
        <nav className={`relative flex-1 overflow-y-auto overflow-x-hidden py-3 space-y-0.5 ${collapsed ? 'px-1.5' : 'px-3'}`}>
          {!collapsed && (
            <p className="px-3 pt-1 pb-2 text-[9px] font-bold uppercase tracking-[0.15em] text-slate-600">
              Menu
            </p>
          )}
          {navItems.map((item, i) => (
            <SidebarNavItem
              key={`${item.href}-${item.label}`}
              item={item}
              collapsed={collapsed}
              index={i}
              onNavigate={() => setSidebarOpen(false)}
              currentPathname={pathname}
              badge={navBadges?.[item.href]}
            />
          ))}
        </nav>

        {/* ── User card ── */}
        <div className={`
          relative border-t border-white/6
          pb-[max(0.75rem,env(safe-area-inset-bottom))]
          ${collapsed ? 'px-1.5 pt-2' : 'px-3 pt-2'}
        `}>
          {/* Profile row */}
          <button
            onClick={() => { if (role === 'owner') router.push('/owner/admins'); setSidebarOpen(false); }}
            className={`
              w-full flex items-center gap-3 rounded-xl p-2
              hover:bg-white/6 transition-all duration-200 active:scale-[0.98]
              ${collapsed ? 'justify-center' : ''}
            `}
          >
            {/* Avatar */}
            <div className="relative shrink-0">
              {profileImage ? (
                <img src={profileImage} alt={userName} className="h-8 w-8 rounded-full object-cover ring-2 ring-white/10 shadow" />
              ) : (
                <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-[11px] font-bold text-white shadow ring-2 ring-primary/30">
                  {initials}
                </div>
              )}
              <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-primary ring-1 ring-slate-900" />
            </div>

            {!collapsed && (
              <div className="flex-1 min-w-0 text-left">
                <p className="text-[13px] font-semibold text-white truncate leading-tight">{userName}</p>
                <p className="text-[11px] text-slate-500 truncate leading-tight">{userEmail}</p>
              </div>
            )}
          </button>

          {/* Logout */}
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className={`
              mt-1 w-full flex items-center gap-2 rounded-xl
              text-slate-500 hover:text-red-400 hover:bg-red-500/10
              transition-all duration-200 active:scale-95 disabled:opacity-40
              ${collapsed ? 'justify-center p-2.5' : 'px-3 py-2'}
            `}
          >
            <LogOut className={`h-4 w-4 shrink-0 ${loggingOut ? 'animate-spin' : ''}`} />
            {!collapsed && <span className="text-[13px] font-medium">{loggingOut ? 'Signing out…' : 'Sign out'}</span>}
          </button>
        </div>
      </aside>

      {/* Overlay (mobile) */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ═══ MAIN CONTENT ═══ */}
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">

        {/* ── Mobile top bar ── */}
        <header className="lg:hidden bg-white border-b border-gray-100 shadow-sm pt-[env(safe-area-inset-top)]">
          <div className="flex h-14 items-center gap-3 px-3">
            {isSubTab ? (
              <>
                <button
                  onClick={() => { window.location.hash = ''; }}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors active:scale-95"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <h1 className="flex-1 min-w-0 text-sm font-bold text-gray-900 truncate">{mobileTabLabel}</h1>
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-gray-400 hover:bg-gray-100 transition-colors"
                >
                  <Menu className="h-4.5 w-4.5" />
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors active:scale-95"
                >
                  <Menu className="h-5 w-5" />
                </button>
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/20">
                    <img src={logoSmallUrl ?? '/logo/main.png'} alt="Logo" className="h-4 w-4 object-contain" />
                  </div>
                  <h1 className="text-sm font-bold text-gray-900 truncate">{platformName}</h1>
                </div>
                <button
                  onClick={() => { if (role === 'owner') router.push('/owner/admins'); }}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-white ring-2 ring-primary/20 active:scale-95 transition-transform overflow-hidden shadow"
                >
                  {profileImage
                    ? <img src={profileImage} alt={userName} className="h-full w-full object-cover" />
                    : initials}
                </button>
              </>
            )}
          </div>
        </header>

        {/* ── Page content ── */}
        <main className="flex-1 overflow-auto bg-slate-50 px-3 py-4 pb-24 sm:p-5 sm:pb-5 lg:p-6">
          {children}
        </main>
      </div>

      <style>{`
        @keyframes sidebar-indicator { from { transform: scaleY(0); opacity: 0; } to { transform: scaleY(1); opacity: 1; } }
        @keyframes sidebar-fade-in   { from { opacity: 0; transform: translateX(-6px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes sidebar-ripple    { to { transform: scale(4); opacity: 0; } }
      `}</style>
    </div>
  );
}
