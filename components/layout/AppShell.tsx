'use client';
// components/layout/AppShell.tsx
// Main authenticated layout shell with team switcher.

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { clsx } from 'clsx';
import {
  LayoutDashboard,
  Users,
  Calendar,
  Trophy,
  ClipboardList,
  StickyNote,
  Settings,
  LogOut,
  Menu,
  X,
} from 'lucide-react';
import type { TeamContext } from '@/lib/types/app.types';
import { isCoach } from '@/lib/utils/roles';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import {
  TeamSwitcher,
  type TeamOption,
} from '@/components/layout/TeamSwitcher';

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  coachOnly?: boolean;
  mobileHide?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Feed', icon: LayoutDashboard },
  { href: '/roster', label: 'Roster', icon: Users },
  { href: '/calendar', label: 'Calendar', icon: Calendar },
  { href: '/matches', label: 'Matches', icon: Trophy },
  { href: '/challenges', label: 'Ladder', icon: ClipboardList },
  {
    href: '/practices',
    label: 'Practices',
    icon: ClipboardList,
    coachOnly: true,
    mobileHide: true,
  },
  {
    href: '/notes',
    label: 'Notes',
    icon: StickyNote,
    coachOnly: true,
    mobileHide: true,
  },
  { href: '/settings', label: 'Settings', icon: Settings },
];

interface AppShellProps {
  teamContext: TeamContext;
  allTeams: TeamOption[];
  children: React.ReactNode;
}

export function AppShell({ teamContext, allTeams, children }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const visibleNavItems = NAV_ITEMS.filter(
    (item) => !item.coachOnly || isCoach(teamContext.role),
  );

  const mobileNavItems = visibleNavItems
    .filter((item) => !item.mobileHide)
    .slice(0, 5);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push('/auth/login');
  }

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* ── Desktop sidebar ─────────────────────────────── */}
      <aside className="hidden lg:flex flex-col w-60 fixed inset-y-0 left-0 bg-white border-r border-gray-200 z-30">
        {/* Team switcher — replaces static brand header */}
        <div className="px-3 pt-3 pb-2 border-b border-gray-100">
          <TeamSwitcher
            currentTeamId={teamContext.teamId}
            currentTeamName={teamContext.teamName}
            allTeams={allTeams}
            isCreator={teamContext.isCreator}
          />
          <div className="text-xs text-gray-400 capitalize px-2 mt-0.5">
            {teamContext.role}
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
          {visibleNavItems.map((item) => (
            <SidebarNavLink
              key={item.href}
              item={item}
              active={pathname.startsWith(item.href)}
            />
          ))}
        </nav>

        {/* User footer */}
        <div className="border-t border-gray-100 p-3">
          <div className="flex items-center gap-3 px-2 py-2 mb-1">
            <UserAvatar
              name={teamContext.fullName}
              avatarUrl={teamContext.avatarUrl}
              size="sm"
            />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-gray-900 truncate">
                {teamContext.fullName}
              </div>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-2 px-2 py-2 text-sm text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <LogOut size={15} />
            Sign out
          </button>
        </div>
      </aside>

      {/* ── Mobile header ────────────────────────────────── */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-30 flex items-center justify-between px-4 h-14 bg-white border-b border-gray-200">
        {/* Compact team switcher on mobile header */}
        <TeamSwitcher
          currentTeamId={teamContext.teamId}
          currentTeamName={teamContext.teamName}
          allTeams={allTeams}
          isCreator={teamContext.isCreator}
        />
        <button
          onClick={() => setMobileMenuOpen(true)}
          className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100"
        >
          <Menu size={20} />
        </button>
      </div>

      {/* ── Mobile slide-over menu ───────────────────────── */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative w-64 bg-white flex flex-col h-full shadow-xl">
            <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100">
              {/* Team switcher in mobile menu too */}
              <div className="flex-1 mr-2">
                <TeamSwitcher
                  currentTeamId={teamContext.teamId}
                  currentTeamName={teamContext.teamName}
                  allTeams={allTeams}
                  isCreator={teamContext.isCreator}
                />
              </div>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-1 text-gray-400 hover:text-gray-600 flex-shrink-0"
              >
                <X size={20} />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
              {visibleNavItems.map((item) => (
                <SidebarNavLink
                  key={item.href}
                  item={item}
                  active={pathname.startsWith(item.href)}
                  onClick={() => setMobileMenuOpen(false)}
                />
              ))}
            </nav>
            <div className="border-t border-gray-100 p-3">
              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <LogOut size={15} />
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Main content ─────────────────────────────────── */}
      <main className="flex-1 lg:ml-60 pt-14 lg:pt-0 pb-16 lg:pb-0 min-h-screen">
        <div className="max-w-4xl mx-auto px-4 py-6">{children}</div>
      </main>

      {/* ── Mobile bottom nav ────────────────────────────── */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 flex bg-white border-t border-gray-200">
        {mobileNavItems.map((item) => {
          const Icon = item.icon;
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                'flex-1 flex flex-col items-center justify-center py-2 text-xs font-medium transition-colors',
                active ? 'text-brand-600' : 'text-gray-400 hover:text-gray-600',
              )}
            >
              <Icon size={20} strokeWidth={active ? 2.5 : 1.8} />
              <span className="mt-0.5">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

// ── Sidebar nav link ──────────────────────────────────────────
function SidebarNavLink({
  item,
  active,
  onClick,
}: {
  item: NavItem;
  active: boolean;
  onClick?: () => void;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={clsx(
        'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
        active
          ? 'bg-brand-50 text-brand-700'
          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
      )}
    >
      <Icon size={17} strokeWidth={active ? 2.5 : 1.8} />
      {item.label}
    </Link>
  );
}

// ── User avatar ───────────────────────────────────────────────
export function UserAvatar({
  name,
  avatarUrl,
  size = 'md',
}: {
  name: string;
  avatarUrl: string | null;
  size?: 'sm' | 'md' | 'lg';
}) {
  const sizeClasses = {
    sm: 'w-7 h-7 text-xs',
    md: 'w-9 h-9 text-sm',
    lg: 'w-12 h-12 text-base',
  };
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt={name}
        className={clsx(
          'rounded-full object-cover flex-shrink-0',
          sizeClasses[size],
        )}
      />
    );
  }

  return (
    <div
      className={clsx(
        'rounded-full bg-brand-100 text-brand-700 font-semibold flex items-center justify-center flex-shrink-0',
        sizeClasses[size],
      )}
    >
      {initials}
    </div>
  );
}
