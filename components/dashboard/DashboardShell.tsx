// ═══════════════════════════════════════════════════════════════
// stibe Portal — Dashboard Shell (shared layout)
// ═══════════════════════════════════════════════════════════════
// Modern white sidebar with green accents, animations & effects.
// ═══════════════════════════════════════════════════════════════

'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useState, useRef, useCallback, useEffect } from 'react';
import {
  LogOut,
  Menu,
  X,
  LayoutDashboard,
  BookOpen,
  Users,
  GraduationCap,
  Eye,
  Shield,
  UserCheck,
  ChevronsLeft,
  ChevronsRight,
  ChevronLeft,
  type LucideIcon,
} from 'lucide-react';
import { getNavForRole, resolveActiveNav } from '@/lib/nav-config';
import { usePlatformName, usePlatformContext } from '@/components/providers/PlatformProvider';

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  active?: boolean;
}

interface DashboardShellProps {
  role: string;
  userName: string;
  userEmail: string;
  children: React.ReactNode;
  /** Optional permissions map for nav filtering */
  permissions?: Record<string, boolean>;
  /** Badge counts keyed by nav item href (e.g. { '/student#fees': 2 }) */
  navBadges?: Record<string, number>;
}

const ROLE_LABELS: Record<string, string> = {
  superadmin:         'Superadmin',
  batch_coordinator:  'Batch Coordinator',
  academic_operator:  'Academic Operator',
  hr:                 'HR Associate',
  teacher:            'Teacher',
  student:            'Student',
  academic:           'Academic (Legacy)',
  parent:             'Parent',
  owner:              'Owner',
  ghost:              'Ghost Observer',
  sales:              'Sales CRM',
};

const ROLE_ICONS: Record<string, LucideIcon> = {
  superadmin:         Shield,
  batch_coordinator:  Users,
  academic_operator:  UserCheck,
  hr:                 Users,
  teacher:            BookOpen,
  student:            GraduationCap,
  academic:           UserCheck,
  parent:             Shield,
  owner:              LayoutDashboard,
  ghost:              Eye,
  sales:              Users,
};

/* ── Ripple effect hook ── */
function useRipple() {
  const ref = useRef<HTMLAnchorElement | HTMLButtonElement>(null);

  const trigger = useCallback((e: React.MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const ripple = document.createElement('span');
    const size = Math.max(rect.width, rect.height) * 2;
    Object.assign(ripple.style, {
      position: 'absolute',
      left: `${x - size / 2}px`,
      top: `${y - size / 2}px`,
      width: `${size}px`,
      height: `${size}px`,
      borderRadius: '50%',
      background: 'rgba(34,197,94,0.15)',
      transform: 'scale(0)',
      animation: 'sidebar-ripple 500ms ease-out forwards',
      pointerEvents: 'none',
    });
    el.style.position = 'relative';
    el.style.overflow = 'hidden';
    el.appendChild(ripple);
    setTimeout(() => ripple.remove(), 550);
  }, []);

  return { ref, trigger };
}

/* ── Nav item with ripple + animations ── */
function SidebarNavItem({
  item,
  collapsed,
  index,
  onNavigate,
  currentPathname,
  badge,
}: {
  item: NavItem;
  collapsed: boolean;
  index: number;
  onNavigate?: () => void;
  currentPathname: string;
  badge?: number;
}) {
  const { ref, trigger } = useRipple();
  const hasBadge = badge !== undefined && badge > 0;

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    trigger(e);
    const url = new URL(item.href, window.location.origin);
    if (url.pathname === currentPathname) {
      e.preventDefault();
      window.location.hash = url.hash;
    }
    onNavigate?.();
  };

  return (
    <a
      ref={ref as React.Ref<HTMLAnchorElement>}
      href={item.href}
      onClick={handleClick}
      className={`
        group relative flex items-center gap-3 rounded-xl text-[13px] font-medium
        transition-all duration-200 ease-out
        ${collapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2.5'}
        ${
          item.active
            ? 'bg-emerald-50 text-emerald-700 shadow-sm shadow-emerald-100'
            : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800 hover:shadow-sm'
        }
      `}
      style={{ animationDelay: `${index * 40}ms` }}
      title={collapsed ? item.label : undefined}
    >
      {/* Active indicator bar */}
      {item.active && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-1 rounded-r-full bg-emerald-500 shadow-[0_0_8px_rgba(34,197,94,0.35)] animate-[sidebar-indicator_300ms_ease-out]" />
      )}

      {/* Icon wrapper — relative so badge can sit on top in collapsed mode */}
      <span className="relative shrink-0">
        <span className={`
          flex items-center justify-center rounded-lg transition-all duration-200
          ${collapsed ? 'h-8 w-8' : 'h-7 w-7'}
          ${item.active
            ? 'bg-emerald-100 shadow-sm shadow-emerald-200'
            : 'group-hover:bg-gray-100'
          }
        `}>
          <item.icon
            className={`h-4 w-4 transition-transform duration-200
              ${item.active ? 'text-emerald-600 scale-110' : 'text-gray-400 group-hover:text-gray-600 group-hover:scale-110'}
            `}
          />
        </span>
        {/* Badge on icon (collapsed mode) */}
        {hasBadge && collapsed && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-0.5 text-[9px] font-bold text-white ring-1 ring-white shadow-sm">
            {badge! > 99 ? '99+' : badge}
          </span>
        )}
      </span>

      {!collapsed && (
        <>
          <span className="flex-1 truncate animate-[sidebar-fade-in_200ms_ease-out]">{item.label}</span>
          {/* Badge on label row */}
          {hasBadge ? (
            <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white shadow-sm animate-[sidebar-fade-in_200ms_ease-out]">
              {badge! > 99 ? '99+' : badge}
            </span>
          ) : item.active ? (
            <span className="ml-auto h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(34,197,94,0.5)] animate-pulse" />
          ) : null}
        </>
      )}
    </a>
  );
}

export default function DashboardShell({
  role,
  userName,
  userEmail,
  children,
  permissions,
  navBadges,
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

  // Fetch profile image on mount
  useEffect(() => {
    fetch('/api/v1/users/profile-image')
      .then(r => r.json())
      .then(d => { if (d.success && d.data?.profile_image) setProfileImage(d.data.profile_image); })
      .catch(() => {});
  }, []);

  const roleLabel = ROLE_LABELS[role] || role;
  const navItems = resolveActiveNav(getNavForRole(role, permissions), pathname, currentHash, currentSearch);
  const activeNavItem = navItems.find(n => n.active);
  const isSubTab = !!currentHash;
  // Resolve label: from nav if matched, or humanize the hash, or fallback
  const mobileTabLabel = isSubTab
    ? (activeNavItem?.label ?? currentHash.replace('#', '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()))
    : '';
  const homeHref = navItems[0]?.href ?? pathname;
  const initials = userName
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  async function handleLogout() {
    setLoggingOut(true);
    await fetch('/api/v1/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  return (
    <div className="flex h-screen bg-gray-50 text-gray-900">
      {/* ── Sidebar ── */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 flex flex-col
          bg-white border-r border-gray-200/80
          transition-all duration-300 ease-in-out
          lg:static
          ${collapsed ? 'w-18' : 'w-64'}
          ${sidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* ── Brand ── pt-[env(safe-area-inset-top)] for iPhone PWA homescreen mode */}
        <div className={`border-b border-gray-100 pt-[env(safe-area-inset-top)] ${collapsed ? 'px-2' : 'px-4'}`}>
        <div className={`flex h-16 items-center ${collapsed ? 'justify-center' : 'gap-3'}`}>
          <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-emerald-50 to-green-50 ring-1 ring-emerald-200/60 shadow-sm">
            <img src={logoSmallUrl ?? '/logo/main.png'} alt="Logo" style={{ height: logoSidebarHeight, width: logoSidebarHeight }} className="object-contain" />
            <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-white animate-pulse" />
          </div>

          {!collapsed && (
            <div className="flex-1 min-w-0 animate-[sidebar-fade-in_200ms_ease-out]">
              <h1 className="text-sm font-bold tracking-wide text-gray-900">{platformName}</h1>
              <p className="text-[10px] text-gray-400 truncate">{roleLabel}</p>
            </div>
          )}

          {/* Close on mobile */}
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden ml-auto flex h-10 w-10 items-center justify-center rounded-xl text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors active:scale-90"
          >
            <X className="h-5 w-5" />
          </button>

          {/* Collapse toggle (desktop) */}
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="hidden lg:flex ml-auto h-7 w-7 items-center justify-center rounded-lg text-gray-300 transition-all duration-200 hover:bg-gray-100 hover:text-gray-600 active:scale-90"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
          </button>
        </div>
        </div>{/* end brand outer wrapper */}

        {/* ── Navigation ── */}
        <nav className={`flex-1 overflow-y-auto py-4 space-y-1 ${collapsed ? 'px-2' : 'px-3'}`}>
          {!collapsed && (
            <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-widest text-gray-300">
              Navigation
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
        <div className={`border-t border-gray-100 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] ${collapsed ? 'flex flex-col items-center' : ''}`}>
          <button
            onClick={() => { if (role === 'owner') { router.push('/owner/admins'); } setSidebarOpen(false); }}
            className={`flex items-center w-full rounded-xl p-1.5 -m-1.5 transition-all duration-200 hover:bg-emerald-50/80 active:scale-[0.98] ${collapsed ? 'justify-center' : 'gap-3'}`}
            title={collapsed ? `${userName}` : userName}
          >
            {/* Animated avatar */}
            <div className="relative group">
              <div className="absolute -inset-0.5 rounded-full bg-linear-to-r from-emerald-400 to-green-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-[2px]" />
              {profileImage ? (
                <img src={profileImage} alt={userName} className="relative h-9 w-9 rounded-full object-cover shadow-sm ring-2 ring-white" />
              ) : (
                <div className="relative flex h-9 w-9 items-center justify-center rounded-full bg-linear-to-br from-emerald-500 to-green-500 text-xs font-bold text-white shadow-sm">
                  {initials}
                </div>
              )}
            </div>

            {!collapsed && (
              <div className="flex-1 min-w-0 text-left animate-[sidebar-fade-in_200ms_ease-out]">
                <p className="text-sm font-medium text-gray-800 truncate">{userName}</p>
                <p className="text-[10px] text-gray-400 truncate">{userEmail}</p>
              </div>
            )}
          </button>

          {/* Logout */}
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className={`
              mt-3 flex w-full items-center justify-center gap-2 rounded-xl
              border border-gray-200 text-sm text-gray-500
              transition-all duration-200
              hover:border-red-200 hover:bg-red-50 hover:text-red-600 hover:shadow-sm
              active:scale-95
              disabled:opacity-50
              ${collapsed ? 'px-2 py-2' : 'px-3 py-2'}
            `}
          >
            <LogOut className={`h-4 w-4 shrink-0 ${loggingOut ? 'animate-spin' : ''}`} />
            {!collapsed && <span>{loggingOut ? 'Signing out…' : 'Sign Out'}</span>}
          </button>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm lg:hidden animate-[sidebar-fade-in_200ms_ease-out]"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Main content ── */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar (mobile) — pt-[env(safe-area-inset-top)] pushes content below iPhone status bar in PWA mode */}
        <header className="border-b border-gray-100 bg-white lg:hidden pt-[env(safe-area-inset-top)]">
        <div className="flex h-14 items-center gap-2.5 px-3">
          {isSubTab ? (
            /* ── Sub-tab mode: back button + tab name ── */
            <>
              <button
                onClick={() => { window.location.hash = ''; }}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 active:scale-95"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <h1 className="text-sm font-bold text-gray-900 truncate flex-1 min-w-0">{mobileTabLabel}</h1>
              <button
                onClick={() => setSidebarOpen(true)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 active:scale-95"
              >
                <Menu className="h-4.5 w-4.5" />
              </button>
            </>
          ) : (
            /* ── Default mode: hamburger + brand + avatar ── */
            <>
              <button
                onClick={() => setSidebarOpen(true)}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 active:scale-95"
              >
                <Menu className="h-5 w-5" />
              </button>
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-linear-to-br from-emerald-50 to-green-50 ring-1 ring-emerald-200/60">
                  <img src={logoSmallUrl ?? '/logo/main.png'} alt="Logo" className="h-4 w-4 object-contain" />
                </div>
                <h1 className="text-sm font-bold text-gray-900 truncate">{platformName}</h1>
              </div>
              <button
                onClick={() => { if (role === 'owner') { router.push('/owner/admins'); } }}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-emerald-500 to-green-500 text-[11px] font-bold text-white ring-2 ring-emerald-100 active:scale-95 transition-transform overflow-hidden"
              >
                {profileImage ? (
                  <img src={profileImage} alt={userName} className="h-full w-full object-cover" />
                ) : initials}
              </button>
            </>
          )}
        </div>
        </header>

        {/* Page content — pb-24 for mobile bottom nav clearance */}
        <main className="flex-1 overflow-auto bg-gray-50/80 px-3 py-4 pb-24 sm:p-4 sm:pb-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
