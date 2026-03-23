'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Activity,
  Bot,
  CalendarClock,
  CalendarDays,
  ChevronRight,
  LayoutDashboard,
  LogOut,
  Menu,
  Sparkles,
  UserCircle2,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface StudyTetherShellProps {
  studentId: string;
  viewerName?: string;
  showLogout?: boolean;
  children: ReactNode;
}

interface NavItem {
  href: string;
  label: string;
  description: string;
  icon: typeof LayoutDashboard;
}

const primaryNavigation: NavItem[] = [
  {
    href: '/app/dashboard',
    label: 'Dashboard',
    description: 'Progress, weak areas, and exam pressure',
    icon: LayoutDashboard,
  },
  {
    href: '/app/chat',
    label: 'Chat Coach',
    description: 'Quiz, ask, and revise with memory context',
    icon: Bot,
  },
  {
    href: '/app/schedule',
    label: 'Schedule',
    description: 'Log sessions and track exam dates',
    icon: CalendarDays,
  },
  {
    href: '/app/plan',
    label: 'Study Plan',
    description: 'Adaptive timeline built from real records',
    icon: CalendarClock,
  },
  {
    href: '/app/tools',
    label: 'Study Tools',
    description: 'Summary, flashcards, timer, and calculator',
    icon: Sparkles,
  },
  {
    href: '/app/activity',
    label: 'Activity',
    description: 'Timeline of account and study events',
    icon: Activity,
  },
];

const accountNavigation: NavItem[] = [
  {
    href: '/app/profile',
    label: 'Profile',
    description: 'Identity, stats, and account settings',
    icon: UserCircle2,
  },
  {
    href: '/app/profile/edit',
    label: 'Edit Profile',
    description: 'Update your name and password',
    icon: Sparkles,
  },
];

function NavSection({
  items,
  pathname,
}: {
  items: NavItem[];
  pathname: string;
}) {
  return (
    <div className="grid gap-2">
      {items.map((item) => {
        const active = pathname === item.href;

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'group rounded-[1.35rem] border px-4 py-3 transition-[transform,border-color,background-color,color] duration-200 hover:-translate-y-0.5',
              active
                ? 'border-[var(--color-accent)]/70 bg-[var(--color-accent)]/12 text-white'
                : 'border-white/10 bg-white/[0.03] text-[var(--color-muted)] hover:border-white/20 hover:bg-white/[0.06] hover:text-white',
            )}
          >
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  'mt-0.5 rounded-2xl border p-2',
                  active
                    ? 'border-[var(--color-accent)]/30 bg-[var(--color-accent)]/10 text-[var(--color-accent)]'
                    : 'border-white/10 bg-black/20 text-[var(--color-muted)]',
                )}
              >
                <item.icon className="h-4 w-4" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-white">{item.label}</p>
                <p className="mt-1 text-xs leading-5 text-[var(--color-muted)]">{item.description}</p>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

function SidebarContent({
  viewerName,
  studentId,
  initials,
  pathname,
  showLogout,
  primaryNavigation,
  accountNavigation,
}: {
  viewerName?: string;
  studentId: string;
  initials?: string;
  pathname: string;
  showLogout: boolean;
  primaryNavigation: NavItem[];
  accountNavigation: NavItem[];
}) {
  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="app-eyebrow">Student Workspace</p>
          <div>
            <h1 className="text-2xl font-semibold tracking-[-0.04em] text-white">
              StudyTether
            </h1>
            <p className="mt-2 max-w-xs text-sm leading-6 text-[var(--color-muted)]">
              One workspace for revision, planning, exam tracking, and account history.
            </p>
          </div>
        </div>
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-[var(--color-accent)]">
          <Sparkles className="h-5 w-5" aria-hidden="true" />
        </div>
      </div>

      <section className="app-card p-4">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--color-accent)]/15 text-base font-semibold text-[var(--color-accent)]">
            {initials || 'SC'}
          </div>
          <div className="min-w-0">
            <p className="text-base font-medium text-white">{viewerName || studentId}</p>
            <p className="mt-1 break-all text-sm text-[var(--color-muted)]">{studentId}</p>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="app-eyebrow">Study</p>
          <span className="app-chip">
            <span className="h-2 w-2 rounded-full bg-[var(--color-accent)]" />
            Live
          </span>
        </div>
        <NavSection items={primaryNavigation} pathname={pathname} />
      </section>

      <section className="space-y-3">
        <p className="app-eyebrow">Account</p>
        <NavSection items={accountNavigation} pathname={pathname} />
      </section>

      <section className="app-card p-4">
        <p className="app-eyebrow">Quick Actions</p>
        <div className="mt-3 grid gap-2">
          <Link href="/app/schedule" className="app-action-secondary justify-between">
            Log Today&apos;s Progress
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          <Link href="/app/profile/edit" className="app-action-secondary justify-between">
            Update Account
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </section>

      {showLogout ? (
        <form action="/api/auth/logout" method="post" className="mt-auto">
          <button type="submit" className="app-action-secondary w-full">
            <LogOut className="h-4 w-4" aria-hidden="true" />
            Logout
          </button>
        </form>
      ) : null}
    </>
  );
}

export default function StudyTetherShell({
  studentId,
  viewerName,
  showLogout = false,
  children,
}: StudyTetherShellProps) {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const initials = viewerName
    ?.split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <main className="relative min-h-screen text-[var(--color-text)]">
      <a
        href="#main-content"
        className="absolute left-4 top-4 z-50 rounded-full bg-white px-4 py-2 text-sm font-medium text-slate-950 opacity-0 shadow-lg transition-opacity focus:opacity-100"
      >
        Skip to content
      </a>

      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(73,215,181,0.16),transparent_22%),radial-gradient(circle_at_bottom_right,rgba(255,184,108,0.12),transparent_18%)]" />

      {/* Mobile Namespace Bar */}
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-white/10 bg-black/40 px-5 py-4 backdrop-blur-md lg:hidden">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-[var(--color-accent)]" aria-hidden="true" />
          <span className="font-semibold text-white">StudyTether</span>
        </div>
        <button
          type="button"
          onClick={() => setIsMobileMenuOpen(true)}
          className="rounded-xl border border-white/10 bg-white/5 p-2.5 text-white active:scale-95 transition-transform"
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
        </button>
      </header>

      {/* Mobile Drawer Overlay */}
      {isMobileMenuOpen ? (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setIsMobileMenuOpen(false)}
            aria-hidden="true"
          />
          <aside className="relative flex w-80 max-w-[85vw] flex-col gap-6 overflow-y-auto bg-slate-950/95 border-r border-white/5 p-5 shadow-2xl backdrop-blur-md">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-[var(--color-accent)]" />
                <span className="font-semibold text-white">Workspace</span>
              </div>
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(false)}
                className="rounded-xl border border-white/10 p-2 text-[var(--color-muted)] hover:text-white"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            
            <div className="flex flex-col gap-6">
              <SidebarContent 
                viewerName={viewerName} 
                studentId={studentId} 
                initials={initials} 
                pathname={pathname} 
                showLogout={showLogout} 
                primaryNavigation={primaryNavigation}
                accountNavigation={accountNavigation}
              />
            </div>
          </aside>
        </div>
      ) : null}

      <div className="relative mx-auto flex min-h-screen w-full max-w-[1500px] flex-col gap-5 px-4 py-6 sm:px-6 lg:grid lg:grid-cols-[320px_minmax(0,1fr)] lg:gap-6 lg:px-8">
        <aside className="app-shell-panel hidden lg:flex flex-col gap-6 p-5 lg:sticky lg:top-6 lg:h-[calc(100vh-3rem)] lg:overflow-y-auto">
          <SidebarContent 
            viewerName={viewerName} 
            studentId={studentId} 
            initials={initials} 
            pathname={pathname} 
            showLogout={showLogout} 
            primaryNavigation={primaryNavigation}
            accountNavigation={accountNavigation}
          />
        </aside>

        <div id="main-content" className="min-w-0 space-y-5">
          {children}
        </div>
      </div>
    </main>
  );
}
