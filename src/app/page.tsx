'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { fetchApi } from '@/lib/fetchApi';
import { useAppStore, type ViewId } from '@/lib/store';
import { SCREEN_MAP } from '@/lib/screen-map';
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarInset,
  SidebarRail,
  SidebarTrigger,
  SidebarSeparator,
} from '@/components/ui/sidebar';
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbPage,
} from '@/components/ui/breadcrumb';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Brain,
  Radar,
  Monitor,
  Sparkles,
  Search,
  FileText,
  Building2,
  Users,
  Globe,
  Target,
  GitBranch,
  Layers,
  Mail,
  MessageSquare,
  PenLine,
  Inbox,
  BookOpen,
  Library,
  BarChart3,
  TrendingUp,
  Activity,
  FileBarChart,
  Upload,
  UserPlus,
  Send,
  AlertTriangle,
  Copy,
  Settings,
  UserCog,
  Shield,
  Heart,
  Database,
  Zap,
  Bell,
  LogOut,
  X,
  ChevronRight,
  ArrowRight,
  Loader2,
  WifiOff,
  type LucideIcon,
} from 'lucide-react';
import { PageTransition, GlassPanel } from '@/components/ui/animated-components';

/* ── Navigation Data ── */

interface NavItem {
  label: string;
  viewId: ViewId;
  icon: LucideIcon;
  badge?: string;
  shortcut?: string;
}
interface NavGroup {
  label: string;
  items: NavItem[];
  defaultCollapsed?: boolean;
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'INTELLIGENCE',
    items: [
      {
        label: 'Intelligence Ops',
        viewId: 'intelligence-operations',
        icon: Radar,
        badge: 'New',
        shortcut: '⌘1',
      },
      { label: 'Command Center', viewId: 'command-center', icon: Monitor, shortcut: '⌘2' },
      { label: 'AI Advisor', viewId: 'ai-advisor', icon: Sparkles, shortcut: '⌘3' },
      { label: 'Intelligence Search', viewId: 'intelligence-search', icon: Search, shortcut: '⌘K' },
      { label: 'Intelligence Briefing', viewId: 'intelligence-briefing', icon: FileText },
    ],
  },
  {
    label: 'ACCOUNTS',
    items: [
      { label: 'Companies', viewId: 'companies', icon: Building2 },
      { label: 'Contacts', viewId: 'contacts', icon: Users },
      { label: 'Company Workspace', viewId: 'company-workspace', icon: Globe },
    ],
  },
  {
    label: 'PIPELINE',
    items: [
      { label: 'Opportunities', viewId: 'opportunities', icon: Target },
      { label: 'Pipeline', viewId: 'pipeline', icon: GitBranch },
      { label: 'Segments', viewId: 'segments', icon: Layers },
    ],
  },
  {
    label: 'ENGAGE',
    items: [
      { label: 'Sequences', viewId: 'sequences', icon: Mail },
      { label: 'Conversation Studio', viewId: 'conversation-studio', icon: MessageSquare },
      { label: 'Email Studio', viewId: 'email-studio', icon: PenLine },
      { label: 'Inbox', viewId: 'inbox', icon: Inbox },
    ],
  },
  {
    label: 'KNOWLEDGE',
    items: [
      { label: 'Knowledge Library', viewId: 'knowledge', icon: BookOpen },
      { label: 'Knowledge Workspace', viewId: 'knowledge-workspace', icon: Library },
    ],
  },
  {
    label: 'ANALYTICS',
    items: [
      { label: 'Intelligence Hub', viewId: 'dashboard', icon: BarChart3 },
      { label: 'Revenue Intelligence', viewId: 'revenue-intelligence', icon: TrendingUp },
      { label: 'Analytics', viewId: 'analytics', icon: Activity },
      { label: 'Reports', viewId: 'reports', icon: FileBarChart },
    ],
  },
  {
    label: 'OPERATIONS',
    items: [
      { label: 'Data Import', viewId: 'data-import', icon: Upload },
      { label: 'Leads', viewId: 'leads', icon: UserPlus },
      { label: 'Queue', viewId: 'queue', icon: Send },
      { label: 'Bounces', viewId: 'bounces', icon: AlertTriangle },
      { label: 'Duplicates', viewId: 'duplicates', icon: Copy },
    ],
  },
  {
    label: 'ADMIN',
    defaultCollapsed: true,
    items: [
      { label: 'Settings', viewId: 'settings', icon: Settings },
      { label: 'Users', viewId: 'users', icon: UserCog },
      { label: 'Audit Logs', viewId: 'audit-logs', icon: Shield },
      { label: 'AI Health', viewId: 'ai-health', icon: Heart },
      { label: 'Data Health', viewId: 'data-health', icon: Database },
      { label: 'AI Usage', viewId: 'ai-usage', icon: Zap },
    ],
  },
];

const VIEW_LABEL_MAP: Record<string, string> = NAV_GROUPS.reduce(
  (acc, g) => {
    for (const item of g.items) acc[item.viewId] = item.label;
    return acc;
  },
  {} as Record<string, string>,
);

/* ── Command Palette ── */

const COMMANDS = [
  { label: 'Go to Command Center', icon: Monitor, shortcut: '⌘2', action: 'command-center' },
  { label: 'Search Intelligence', icon: Search, shortcut: '⌘K', action: 'intelligence-search' },
  { label: 'Open AI Advisor', icon: Sparkles, shortcut: '⌘3', action: 'ai-advisor' },
  {
    label: 'View Intelligence Ops',
    icon: Radar,
    shortcut: '⌘1',
    action: 'intelligence-operations',
  },
  { label: 'New Sequence', icon: Mail, action: 'sequences' },
  { label: 'View Pipeline', icon: GitBranch, action: 'pipeline' },
  { label: 'Company Search', icon: Building2, action: 'companies' },
  { label: 'Revenue Intelligence', icon: TrendingUp, action: 'revenue-intelligence' },
  { label: 'Settings', icon: Settings, action: 'settings' },
  { label: 'View Inbox', icon: Inbox, action: 'inbox' },
];

function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const setActiveView = useAppStore((s) => s.setActiveView);
  const filtered = COMMANDS.filter((c) => c.label.toLowerCase().includes(query.toLowerCase()));

  const exec = useCallback(
    (action: string) => {
      setActiveView(action as ViewId);
      setQuery('');
      onClose();
    },
    [setActiveView, onClose],
  );

  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative w-full max-w-lg rounded-xl border overflow-hidden shadow-2xl"
        style={{ background: 'var(--ios-bg-elevated)', borderColor: 'var(--ios-border)' }}
      >
        <div
          className="flex items-center gap-3 border-b px-4 py-3"
          style={{ borderBottomColor: 'var(--ios-border)' }}
        >
          <Search className="h-4 w-4 shrink-0" style={{ color: 'var(--ios-text-muted)' }} />
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command or search..."
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--ios-text-muted)]"
            style={{ color: 'var(--ios-text-primary)' }}
          />
          <kbd
            className="hidden sm:inline-flex h-5 items-center rounded border px-1.5 text-[10px] font-medium"
            style={{ borderColor: 'var(--ios-border)', color: 'var(--ios-text-muted)' }}
          >
            ESC
          </kbd>
        </div>
        <div className="max-h-72 overflow-y-auto p-2">
          {filtered.length === 0 && (
            <p className="px-3 py-6 text-center text-sm" style={{ color: 'var(--ios-text-muted)' }}>
              No results found
            </p>
          )}
          {filtered.map((cmd) => (
            <button
              key={cmd.label}
              onClick={() => exec(cmd.action)}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-all duration-200 hover:bg-[var(--ios-bg-card-hover)]"
              style={{ color: 'var(--ios-text-primary)' }}
            >
              <cmd.icon
                className="h-4 w-4 shrink-0"
                style={{ color: 'var(--ios-text-secondary)' }}
              />
              <span className="flex-1">{cmd.label}</span>
              {cmd.shortcut && (
                <kbd
                  className="hidden sm:inline-flex h-5 items-center rounded border px-1.5 text-[10px] font-medium"
                  style={{ borderColor: 'var(--ios-border)', color: 'var(--ios-text-muted)' }}
                >
                  {cmd.shortcut}
                </kbd>
              )}
              <ChevronRight className="h-3 w-3 opacity-40" />
            </button>
          ))}
        </div>
        <div
          className="border-t px-4 py-2 flex items-center gap-4 text-[11px]"
          style={{ borderTopColor: 'var(--ios-border)', color: 'var(--ios-text-muted)' }}
        >
          <span className="flex items-center gap-1">
            <kbd className="rounded border px-1" style={{ borderColor: 'var(--ios-border)' }}>
              ↵
            </kbd>{' '}
            Open
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border px-1" style={{ borderColor: 'var(--ios-border)' }}>
              esc
            </kbd>{' '}
            Close
          </span>
        </div>
      </div>
    </div>
  );
}

/* ── UserNav ── */

function UserNav() {
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const handleLogout = useCallback(() => {
    setShowLogoutConfirm(false);
    // Navigate to the unauthenticated state by clearing the session
    window.location.href = '/api/auth/logout';
  }, []);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="flex items-center gap-2 rounded-full p-1 transition-all duration-200 hover:bg-[var(--ios-bg-card-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
          aria-label="User menu"
        >
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-[var(--primary)] text-[var(--primary-foreground)] text-xs font-semibold">
              DM
            </AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">DeepMindQ Admin</p>
            <p className="text-xs leading-none text-muted-foreground">admin@deepmindq.com</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem
            className="cursor-pointer"
            onClick={() => useAppStore.getState().setActiveView('settings')}
          >
            <Settings className="mr-2 h-4 w-4" /> Profile &amp; Settings
          </DropdownMenuItem>
          <DropdownMenuItem className="cursor-pointer">
            <Bell className="mr-2 h-4 w-4" /> Notifications
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        {showLogoutConfirm ? (
          <div className="flex items-center gap-2 px-2 py-1.5">
            <button
              onClick={handleLogout}
              className="flex-1 rounded-md bg-destructive/10 px-3 py-1.5 text-xs font-medium text-destructive transition-colors hover:bg-destructive/20"
            >
              Confirm
            </button>
            <button
              onClick={() => setShowLogoutConfirm(false)}
              className="flex-1 rounded-md bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/80"
            >
              Cancel
            </button>
          </div>
        ) : (
          <DropdownMenuItem
            className="cursor-pointer text-destructive focus:text-destructive"
            onClick={() => setShowLogoutConfirm(true)}
          >
            <LogOut className="mr-2 h-4 w-4" /> Sign out
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* ── NavGroupSection ── */

const NavGroupSection = React.memo(function NavGroupSection({
  group,
  idx,
}: {
  group: NavGroup;
  idx: number;
}) {
  const activeView = useAppStore((s) => s.activeView);
  const setActiveView = useAppStore((s) => s.setActiveView);
  return (
    <React.Fragment>
      {idx > 0 && (
        <div
          className="mx-3 my-1 h-px"
          style={{
            background: 'linear-gradient(to right, transparent, var(--ios-border), transparent)',
          }}
        />
      )}
      <SidebarGroup>
        <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
        <SidebarMenu>
          {group.items.map((item) => {
            const isActive = activeView === item.viewId;
            return (
              <SidebarMenuItem key={item.viewId}>
                <SidebarMenuButton
                  isActive={isActive}
                  tooltip={item.label}
                  size="lg"
                  onClick={() => setActiveView(item.viewId)}
                  className={`group/item transition-all duration-200 hover:translate-x-0.5 ${isActive ? '[box-shadow:0_0_12px_rgba(59,130,246,0.15),inset_0_0_0_1px_rgba(59,130,246,0.2)]' : ''}`}
                >
                  <item.icon
                    className={`h-4 w-4 transition-all duration-200 ${isActive ? 'text-[var(--ios-accent)]' : ''}`}
                  />
                  <span className="flex-1">{item.label}</span>
                  {item.badge && (
                    <span className="ml-auto rounded-md bg-[var(--ios-accent)] px-1.5 py-0.5 text-[10px] font-semibold text-white leading-none">
                      {item.badge}
                    </span>
                  )}
                  {item.shortcut && (
                    <kbd
                      className="ml-auto hidden lg:inline-flex h-5 items-center rounded border px-1 text-[10px] font-medium opacity-40 group-hover/item:opacity-70 transition-opacity duration-200"
                      style={{ borderColor: 'var(--ios-border)', color: 'var(--ios-text-muted)' }}
                    >
                      {item.shortcut}
                    </kbd>
                  )}
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroup>
    </React.Fragment>
  );
});

/* ── ActiveScreen ── */

const ActiveScreen = React.memo(function ActiveScreen({ viewId }: { viewId: ViewId }) {
  const ScreenComponent = SCREEN_MAP[viewId];
  if (!ScreenComponent) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center space-y-3">
          <Radar className="mx-auto h-12 w-12 text-muted-foreground/50" />
          <p className="text-muted-foreground text-sm">
            Screen &ldquo;{viewId}&rdquo; not found in registry
          </p>
        </div>
      </div>
    );
  }
  return (
    <PageTransition className="h-full">
      <ScreenComponent />
    </PageTransition>
  );
});

/* ── Welcome Banner ── */

function WelcomeBanner() {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;
  return (
    <GlassPanel
      className="mx-4 mt-4 overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, var(--ios-bg-card) 0%, rgba(59,130,246,0.06) 100%)',
      }}
    >
      <div className="flex items-start justify-between gap-4 p-5">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="h-4 w-4 text-[var(--ios-accent)]" />
            <h2 className="text-base font-semibold" style={{ color: 'var(--ios-text-primary)' }}>
              Welcome back, Admin
            </h2>
          </div>
          <p className="text-sm mb-4" style={{ color: 'var(--ios-text-secondary)' }}>
            Here&apos;s your intelligence briefing for today
          </p>
          <div className="flex flex-wrap gap-2 mb-4">
            {[
              { label: '12 New Signals', color: 'var(--ios-confidence-high)' },
              { label: '5 Opportunities', color: 'var(--ios-accent)' },
              { label: '3 Pending Reviews', color: 'var(--ios-confidence-medium)' },
            ].map((pill) => (
              <span
                key={pill.label}
                className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium"
                style={{
                  borderColor: 'var(--ios-border)',
                  background: 'var(--ios-bg-secondary)',
                  color: 'var(--ios-text-primary)',
                }}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: pill.color }} />
                {pill.label}
              </span>
            ))}
          </div>
          <button
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--ios-accent)] px-3.5 py-2 text-xs font-medium text-white transition-all duration-200 hover:bg-[var(--ios-accent-dim)] hover:shadow-lg hover:shadow-[var(--ios-accent)]/20"
            onClick={() => useAppStore.getState().setActiveView('intelligence-briefing')}
          >
            View Full Briefing <ArrowRight className="h-3 w-3" />
          </button>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="shrink-0 rounded-md p-1 transition-all duration-200 hover:bg-[var(--ios-bg-card-hover)]"
          style={{ color: 'var(--ios-text-muted)' }}
          aria-label="Dismiss banner"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </GlassPanel>
  );
}

/* ── AppSidebar ── */

function AppSidebar() {
  return (
    <Sidebar collapsible="icon" variant="sidebar">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" tooltip="DeepMindQ Intelligence OS">
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-[var(--sidebar-primary)] text-[var(--sidebar-primary-foreground)]">
                <Brain className="size-4" />
              </div>
              <div className="flex flex-col gap-0.5 leading-none">
                <span className="font-semibold">DeepMindQ</span>
                <span className="text-xs text-sidebar-foreground/60">Intelligence OS</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarSeparator />
      <SidebarContent>
        {NAV_GROUPS.map((group, idx) => (
          <NavGroupSection key={group.label} group={group} idx={idx} />
        ))}
      </SidebarContent>
      <SidebarFooter>
        <SidebarSeparator />
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              tooltip="Settings"
              onClick={() => useAppStore.getState().setActiveView('settings')}
            >
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-[var(--sidebar-primary)] text-[var(--sidebar-primary-foreground)] text-xs font-semibold">
                  DM
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col gap-0.5 leading-none">
                <span className="text-sm font-medium">Admin</span>
                <span className="text-xs text-sidebar-foreground/60">admin@deepmindq.com</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

/* ── AppHeader ── */

function AppHeader({ onOpenCommandPalette }: { onOpenCommandPalette: () => void }) {
  const activeView = useAppStore((s) => s.activeView);
  const viewLabel = VIEW_LABEL_MAP[activeView] ?? activeView;

  return (
    <header
      className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b px-4"
      style={{
        background: 'linear-gradient(180deg, var(--ios-bg-card) 0%, var(--ios-bg-card-hover) 100%)',
        borderBottomColor: 'var(--ios-border)',
      }}
    >
      <SidebarTrigger className="-ml-1 transition-all duration-200" />
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbPage className="text-sm font-medium">{viewLabel}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <div className="flex-1" />

      {/* AI Status */}
      <div
        className="hidden md:flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all duration-200"
        style={{
          borderColor: 'var(--ios-border)',
          background: 'var(--ios-bg-secondary)',
          color: 'var(--ios-text-secondary)',
        }}
      >
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--ios-confidence-high)] opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--ios-confidence-high)]" />
        </span>
        AI Systems: Online
      </div>

      {/* Search */}
      <button
        onClick={onOpenCommandPalette}
        className="hidden sm:flex relative items-center h-9 w-64 rounded-lg border pl-9 pr-12 text-left text-sm transition-all duration-200 hover:border-[var(--ios-border-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
        style={{
          borderColor: 'var(--ios-border)',
          background: 'var(--ios-bg-secondary)',
          color: 'var(--ios-text-muted)',
        }}
      >
        <Search className="absolute left-3 h-4 w-4" style={{ color: 'var(--ios-text-muted)' }} />
        <span className="truncate">Search anything...</span>
        <kbd
          className="ml-auto inline-flex h-5 items-center rounded border px-1.5 text-[10px] font-medium"
          style={{ borderColor: 'var(--ios-border)', color: 'var(--ios-text-muted)' }}
        >
          ⌘K
        </kbd>
      </button>

      {/* Command Center */}
      <button
        onClick={() => useAppStore.getState().setActiveView('command-center')}
        className="hidden lg:inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-all duration-200 hover:bg-[var(--ios-bg-card-hover)] hover:border-[var(--ios-border-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
        style={{
          borderColor: 'var(--ios-border)',
          background: 'var(--ios-bg-secondary)',
          color: 'var(--ios-text-secondary)',
        }}
      >
        <Monitor className="h-3.5 w-3.5" /> Command Center
      </button>

      {/* Notifications */}
      <button
        className="relative inline-flex size-9 items-center justify-center rounded-lg transition-all duration-200 hover:bg-[var(--ios-bg-card-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
        aria-label="Notifications"
      >
        <Bell className="h-4 w-4" style={{ color: 'var(--ios-text-secondary)' }} />
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[var(--destructive)] px-1 text-[10px] font-bold text-white">
          3
        </span>
      </button>

      <UserNav />
    </header>
  );
}

/* ── Page ── */

export default function Page() {
  const activeView = useAppStore((s) => s.activeView);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);
  const openCmd = useCallback(() => setCmdOpen(true), []);
  const closeCmd = useCallback(() => setCmdOpen(false), []);

  // Offline detection (F3)
  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      toast.success('Back online');
    };
    const handleOffline = () => {
      setIsOffline(true);
      toast.error('You are offline', { description: 'Check your internet connection' });
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    setIsOffline(!navigator.onLine);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Auth check
  useEffect(() => {
    fetchApi('/api/auth/me')
      .then(({ error }) => {
        if (error) {
          // 401 or network error — treat as unauthenticated
          setIsAuthenticated(false);
        } else {
          setIsAuthenticated(true);
        }
      })
      .catch(() => {
        setIsAuthenticated(false);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCmdOpen((p) => !p);
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  // Loading state (F7: polished skeleton)
  if (isLoading) {
    return (
      <div
        className="h-screen w-screen flex items-center justify-center"
        style={{ background: 'var(--ios-bg-primary)' }}
      >
        <div className="text-center">
          <div
            className="inline-flex items-center justify-center w-12 h-12 rounded-2xl mb-4"
            style={{ background: 'linear-gradient(135deg, #EAB308, #F59E0B)' }}
          >
            <Brain className="w-7 h-7 text-white" />
          </div>
          <p className="text-sm" style={{ color: '#94A3B8' }}>
            Loading DeepMindQ...
          </p>
          <Loader2 className="h-4 w-4 mx-auto mt-3 animate-spin" style={{ color: '#EAB308' }} />
        </div>
      </div>
    );
  }

  // Unauthenticated state
  if (!isAuthenticated) {
    return (
      <div
        className="flex h-screen w-screen flex-col items-center justify-center gap-4"
        style={{ background: 'var(--ios-bg-primary)' }}
      >
        <Brain className="size-12" style={{ color: 'var(--ios-accent)' }} />
        <h1 className="text-xl font-semibold" style={{ color: 'var(--ios-text-primary)' }}>
          DeepMindQ Intelligence OS
        </h1>
        <p className="text-sm" style={{ color: 'var(--ios-text-secondary)' }}>
          Please sign in to access the Intelligence OS
        </p>
        <Link
          href="/signup"
          className="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium text-white transition-all duration-200 hover:opacity-90"
          style={{ background: 'var(--ios-accent)' }}
        >
          Sign in <ArrowRight className="size-4" />
        </Link>
      </div>
    );
  }

  return (
    <SidebarProvider>
      {isOffline && (
        <div
          className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium"
          style={{ background: '#DC2626', color: '#fff' }}
        >
          <WifiOff className="h-4 w-4" />
          You are currently offline. Some features may be unavailable.
        </div>
      )}
      <AppSidebar />
      <SidebarInset className="overflow-hidden" style={{ background: 'var(--ios-bg-primary)' }}>
        <AppHeader onOpenCommandPalette={openCmd} />
        <div className="flex-1 overflow-auto">
          {activeView === 'dashboard' && <WelcomeBanner />}
          <ActiveScreen viewId={activeView} />
        </div>
      </SidebarInset>
      <CommandPalette open={cmdOpen} onClose={closeCmd} />
    </SidebarProvider>
  );
}
