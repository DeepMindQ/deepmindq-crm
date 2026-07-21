'use client';

import React, { useCallback, useState } from 'react';
import {
  LayoutDashboard,
  Users,
  Building2,
  Upload,
  FileText,
  Send,
  BookOpen,
  MessageSquare,
  Copy,
  Shield,
  Settings,
  Brain,
  Search,
  Bell,
  ChevronLeft,
  ChevronRight,
  PanelLeftClose,
  PanelLeft,
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import type { ViewId } from '@/lib/store';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

/* ═══════════════════════════════════════════════════════════════════════
   Navigation Configuration
   ═══════════════════════════════════════════════════════════════════════ */

interface NavItem {
  label: string;
  view: ViewId;
  icon: React.ElementType;
  badge?: string;
  badgeCount?: number;
  isHeart?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', view: 'dashboard', icon: LayoutDashboard },
  { label: 'Leads', view: 'leads', icon: Users },
  { label: 'Companies', view: 'companies', icon: Building2 },
  { label: 'Import', view: 'import', icon: Upload },
  { label: 'Draft Review', view: 'drafts', icon: FileText, badgeCount: 23 },
  { label: 'Send Queue', view: 'queue', icon: Send },
  { label: 'Capability Library', view: 'capability-library', icon: BookOpen, isHeart: true },
  { label: 'Replies & Bounces', view: 'replies', icon: MessageSquare },
  { label: 'Duplicates', view: 'duplicates', icon: Copy },
  { label: 'Audit Log', view: 'audit', icon: Shield },
  { label: 'Settings', view: 'settings', icon: Settings },
];

/* ═══════════════════════════════════════════════════════════════════════
   Sidebar Nav Button
   ═══════════════════════════════════════════════════════════════════════ */

function NavButton({
  item,
  active,
  collapsed,
  onClick,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  onClick: () => void;
}) {
  const Icon = item.icon;

  const button = (
    <button
      onClick={onClick}
      className={`
        group relative flex items-center w-full gap-3 rounded-lg text-sm font-medium
        transition-all duration-200 ease-out outline-none
        ${collapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2.5'}
        ${
          active
            ? 'bg-primary/15 text-primary'
            : 'text-muted-foreground hover:bg-black/[0.04] hover:text-foreground'
        }
        focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-[oklch(0.11_0.01_260)]
      `}
      aria-current={active ? 'page' : undefined}
    >
      {/* Active accent line */}
      {active && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-primary" />
      )}

      <Icon
        className={`shrink-0 transition-colors duration-200 ${
          active ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'
        }`}
        size={20}
        strokeWidth={active ? 2.2 : 1.8}
      />

      {!collapsed && (
        <span className="truncate">{item.label}</span>
      )}

      {!collapsed && item.isHeart && (
        <span className="ml-auto text-[10px] font-semibold uppercase tracking-wider text-primary/70 bg-primary/10 px-1.5 py-0.5 rounded">
          Heart
        </span>
      )}

      {!collapsed && item.badgeCount !== undefined && item.badgeCount > 0 && (
        <Badge
          variant="secondary"
          className="ml-auto h-5 min-w-5 px-1.5 text-[11px] font-semibold bg-primary/15 text-primary border-0"
        >
          {item.badgeCount}
        </Badge>
      )}
    </button>
  );

  if (collapsed) {
    return (
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent
          side="right"
          sideOffset={12}
          className="bg-[oklch(0.17_0.01_260)] border-[oklch(0.27_0.005_260)] text-foreground"
        >
          <p className="font-medium">{item.label}</p>
          {item.badgeCount !== undefined && item.badgeCount > 0 && (
            <p className="text-xs text-muted-foreground mt-0.5">{item.badgeCount} pending</p>
          )}
          {item.isHeart && (
            <p className="text-[10px] uppercase tracking-wider text-primary mt-0.5">The Heart</p>
          )}
        </TooltipContent>
      </Tooltip>
    );
  }

  return button;
}

/* ═══════════════════════════════════════════════════════════════════════
   Sidebar
   ═══════════════════════════════════════════════════════════════════════ */

function Sidebar() {
  const { activeView, sidebarCollapsed, setActiveView, toggleSidebar } = useAppStore();

  const handleNavClick = useCallback(
    (view: ViewId) => {
      setActiveView(view);
    },
    [setActiveView]
  );

  return (
    <aside
      className={`
        fixed top-0 left-0 z-40 h-screen flex flex-col
        bg-[oklch(0.11_0.01_260)] border-r border-[oklch(0.22_0.005_260)]
        transition-[width] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]
        ${sidebarCollapsed ? 'w-16' : 'w-[260px]'}
      `}
    >
      {/* ── Brand ── */}
      <div
        className={`
          flex items-center h-16 shrink-0 border-b border-[oklch(0.22_0.005_260)]
          transition-all duration-300 ${sidebarCollapsed ? 'px-3 justify-center' : 'px-5'}
        `}
      >
        <div className="flex items-center gap-2.5 overflow-hidden">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/15 shrink-0">
            <Brain className="w-[18px] h-[18px] text-primary" strokeWidth={2.2} />
          </div>
          {!sidebarCollapsed && (
            <span className="text-[17px] font-bold tracking-tight text-foreground whitespace-nowrap fade-in">
              DeepMind<span className="text-primary">Q</span>
            </span>
          )}
        </div>
      </div>

      {/* ── Navigation ── */}
      <ScrollArea className="flex-1 py-3">
        <nav className="flex flex-col gap-0.5" role="navigation" aria-label="Main navigation">
          {NAV_ITEMS.map((item) => (
            <div
              key={item.view}
              className={sidebarCollapsed ? 'px-2' : 'px-3'}
            >
              <NavButton
                item={item}
                active={activeView === item.view}
                collapsed={sidebarCollapsed}
                onClick={() => handleNavClick(item.view)}
              />
            </div>
          ))}
        </nav>
      </ScrollArea>

      {/* ── Collapse Toggle ── */}
      <div className="shrink-0 border-t border-[oklch(0.22_0.005_260)] p-2">
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <button
              onClick={toggleSidebar}
              className={`
                flex items-center w-full gap-3 rounded-lg text-sm font-medium
                text-muted-foreground hover:bg-black/[0.04] hover:text-foreground
                transition-all duration-200 outline-none
                focus-visible:ring-2 focus-visible:ring-ring
                ${sidebarCollapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2.5'}
              `}
              aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {sidebarCollapsed ? (
                <ChevronRight className="w-5 h-5" />
              ) : (
                <>
                  <PanelLeftClose className="w-[18px] h-[18px]" strokeWidth={1.8} />
                  <span className="truncate">Collapse</span>
                </>
              )}
            </button>
          </TooltipTrigger>
          {sidebarCollapsed && (
            <TooltipContent
              side="right"
              sideOffset={12}
              className="bg-[oklch(0.17_0.01_260)] border-[oklch(0.27_0.005_260)] text-foreground"
            >
              Expand sidebar
            </TooltipContent>
          )}
        </Tooltip>
      </div>
    </aside>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   Header
   ═══════════════════════════════════════════════════════════════════════ */

function Header() {
  const sidebarCollapsed = useAppStore((s) => s.sidebarCollapsed);

  return (
    <header
      className={`
        sticky top-0 z-30 flex items-center h-16 gap-4 px-6
        bg-[oklch(0.11_0.01_260)]/80 backdrop-blur-xl
        border-b border-[oklch(0.22_0.005_260)]
        transition-[padding-left] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]
        ${sidebarCollapsed ? 'pl-20' : 'pl-[276px]'}
      `}
    >
      {/* Mobile sidebar toggle */}
      <button
        onClick={() => useAppStore.setState({ sidebarCollapsed: false })}
        className="lg:hidden flex items-center justify-center w-8 h-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-black/[0.04] transition-colors"
        aria-label="Open sidebar"
      >
        <PanelLeft className="w-5 h-5" />
      </button>

      {/* Search */}
      <div className="flex-1 max-w-xl">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60 pointer-events-none" />
          <Input
            type="search"
            placeholder="Search leads, companies..."
            className="h-9 pl-9 bg-black/[0.04] border-[oklch(0.27_0.005_260)] text-foreground placeholder:text-muted-foreground/50 focus-visible:border-primary/40 focus-visible:ring-primary/20"
          />
          <kbd className="absolute right-3 top-1/2 -translate-y-1/2 hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground/50 bg-black/[0.04] border border-[oklch(0.27_0.005_260)] rounded">
            <span className="text-[10px]">⌘</span>K
          </kbd>
        </div>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-2">
        {/* Notifications */}
        <button
          className="relative flex items-center justify-center w-9 h-9 rounded-lg text-muted-foreground hover:text-foreground hover:bg-black/[0.04] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Notifications"
        >
          <Bell className="w-[18px] h-[18px]" strokeWidth={1.8} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-primary ring-2 ring-[oklch(0.11_0.01_260)]" />
        </button>

        {/* Separator */}
        <div className="w-px h-6 bg-[oklch(0.27_0.005_260)] mx-1" />

        {/* User */}
        <div className="flex items-center gap-3 pl-1">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-primary/15 text-primary text-xs font-semibold">
              RS
            </AvatarFallback>
          </Avatar>
          <div className="hidden md:flex flex-col">
            <span className="text-sm font-medium text-foreground leading-tight">Ravi Shanker</span>
            <span className="text-[11px] text-muted-foreground leading-tight">Administrator</span>
          </div>
        </div>
      </div>
    </header>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   App Shell
   ═══════════════════════════════════════════════════════════════════════ */

export function AppShell({ children }: { children: React.ReactNode }) {
  const sidebarCollapsed = useAppStore((s) => s.sidebarCollapsed);

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div
        className={`
          flex flex-col min-h-screen
          transition-[margin-left] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]
          ${sidebarCollapsed ? 'ml-16' : 'ml-[260px]'}
        `}
      >
        <Header />
        <main className="flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  );
}