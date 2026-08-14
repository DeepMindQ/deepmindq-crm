'use client';

import React from 'react';
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
  type LucideIcon,
} from 'lucide-react';
import { PageTransition } from '@/components/ui/animated-components';

/* ═══════════════════════════════════════════════════════
   Navigation Data Model
   ═══════════════════════════════════════════════════════ */

interface NavItem {
  label: string;
  viewId: ViewId;
  icon: LucideIcon;
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
      { label: 'Intelligence Ops', viewId: 'intelligence-operations', icon: Radar },
      { label: 'Command Center', viewId: 'command-center', icon: Monitor },
      { label: 'AI Advisor', viewId: 'ai-advisor', icon: Sparkles },
      { label: 'Intelligence Search', viewId: 'intelligence-search', icon: Search },
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

/* Flat lookup map for display names — built from nav groups */
const VIEW_LABEL_MAP: Record<string, string> = NAV_GROUPS.reduce(
  (acc, group) => {
    for (const item of group.items) {
      acc[item.viewId] = item.label;
    }
    return acc;
  },
  {} as Record<string, string>,
);

/* ═══════════════════════════════════════════════════════
   UserNav — Avatar dropdown in the top header bar
   ═══════════════════════════════════════════════════════ */

function UserNav() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="flex items-center gap-2 rounded-full p-1 transition-colors hover:bg-[var(--ios-bg-card-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
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
            <Settings className="mr-2 h-4 w-4" />
            Profile &amp; Settings
          </DropdownMenuItem>
          <DropdownMenuItem className="cursor-pointer">
            <Bell className="mr-2 h-4 w-4" />
            Notifications
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="cursor-pointer text-destructive focus:text-destructive">
          <LogOut className="mr-2 h-4 w-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* ═══════════════════════════════════════════════════════
   NavGroupSection — A single nav group in the sidebar
   ═══════════════════════════════════════════════════════ */

const NavGroupSection = React.memo(function NavGroupSection({ group }: { group: NavGroup }) {
  const activeView = useAppStore((s) => s.activeView);
  const setActiveView = useAppStore((s) => s.setActiveView);

  return (
    <SidebarGroup>
      <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
      <SidebarMenu>
        {group.items.map((item) => (
          <SidebarMenuItem key={item.viewId}>
            <SidebarMenuButton
              isActive={activeView === item.viewId}
              tooltip={item.label}
              size="lg"
              onClick={() => setActiveView(item.viewId)}
            >
              <item.icon className="h-4 w-4" />
              <span>{item.label}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  );
});

/* ═══════════════════════════════════════════════════════
   ActiveScreen — Memoized screen renderer
   ═══════════════════════════════════════════════════════ */

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

/* ═══════════════════════════════════════════════════════
   AppSidebar — The left sidebar with all navigation
   ═══════════════════════════════════════════════════════ */

function AppSidebar() {
  return (
    <Sidebar collapsible="icon" variant="sidebar">
      {/* ── Header: Logo ── */}
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

      {/* ── Navigation Groups ── */}
      <SidebarContent>
        {NAV_GROUPS.map((group) => (
          <NavGroupSection key={group.label} group={group} />
        ))}
      </SidebarContent>

      {/* ── Footer: User ── */}
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

/* ═══════════════════════════════════════════════════════
   Header — Sticky top bar inside SidebarInset
   ═══════════════════════════════════════════════════════ */

function AppHeader() {
  const activeView = useAppStore((s) => s.activeView);
  const viewLabel = VIEW_LABEL_MAP[activeView] ?? activeView;

  return (
    <header
      className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b px-4"
      style={{
        background: 'var(--ios-bg-card)',
        borderBottomColor: 'var(--ios-border)',
      }}
    >
      {/* Sidebar toggle */}
      <SidebarTrigger className="-ml-1" />

      {/* Breadcrumb */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbPage className="text-sm font-medium">{viewLabel}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Decorative search */}
      <div className="relative hidden sm:block">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
        <input
          type="text"
          readOnly
          placeholder="Search anything... (Ctrl+K)"
          className="h-9 w-64 rounded-lg border bg-[var(--ios-bg-secondary)] pl-9 pr-3 text-sm text-muted-foreground placeholder:text-muted-foreground/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
          style={{ borderColor: 'var(--ios-border)' }}
        />
      </div>

      {/* Notification bell */}
      <button
        className="relative inline-flex size-9 items-center justify-center rounded-lg transition-colors hover:bg-[var(--ios-bg-card-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
        aria-label="Notifications"
      >
        <Bell className="h-4 w-4 text-muted-foreground" />
        {/* Notification dot indicator */}
        <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[var(--destructive)]" />
      </button>

      {/* User avatar dropdown */}
      <UserNav />
    </header>
  );
}

/* ═══════════════════════════════════════════════════════
   Page — Root app shell
   ═══════════════════════════════════════════════════════ */

export default function Page() {
  const activeView = useAppStore((s) => s.activeView);

  return (
    <SidebarProvider>
      <AppSidebar />

      <SidebarInset className="overflow-hidden" style={{ background: 'var(--ios-bg-primary)' }}>
        <AppHeader />

        <div className="flex-1 overflow-auto">
          <ActiveScreen viewId={activeView} />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
