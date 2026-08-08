'use client';

import React, { useState, useEffect, Suspense, Component, useCallback, lazy, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PageTransition } from '@/components/ui/animated-components';
import { Toaster } from '@/components/ui/sonner';
import { AiChatSidebar } from '@/components/shared/ai-chat-sidebar';
import { AiChatButton } from '@/components/shared/ai-chat-button';
import { CommandPalette } from '@/components/shared/command-palette';
import { OnboardingFlow } from '@/components/onboarding-flow';
import { SkipNavigation } from '@/components/accessibility/skip-navigation';
import { NotificationBell } from '@/components/notifications/notification-bell';
import { NotificationPanel } from '@/components/notifications/notification-panel';
import { useAppStore } from '@/lib/store';
import { NAV_SECTIONS, type NavItem as NavConfigItem } from '@/lib/nav-config';
import { SCREEN_MAP } from '@/lib/screen-map';
import { useSession } from '@/providers/auth-provider';
import { logger } from '@/lib/logger';
import {
  ChevronRight,
  PanelLeftClose,
  PanelLeft,
  Brain,
  Search,
  ChevronDown,
  AlertTriangle,
  RefreshCw,
  LogOut,
  Sparkles,
  Menu,
  X,
} from 'lucide-react';
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
   Lazy screen components
   ═══════════════════════════════════════════════════════════════════════ */

const CompanyDetailScreen = lazy(() => import('@/components/screens/company-detail-screen'));
const ContactDetailBridge = lazy(() => import('@/lib/screen-map').then(m => ({ default: m.ContactDetailBridge })));

/* ═══════════════════════════════════════════════════════════════════════
   Constants
   ═══════════════════════════════════════════════════════════════════════ */

const SCREEN_LABELS: Record<string, string> = {};
NAV_SECTIONS.forEach(s => s.items.forEach(i => { SCREEN_LABELS[i.key] = i.label; }));

const PIPELINE_STAGES = [
  { key: 'import', label: 'Import' },
  { key: 'companies', label: 'Accounts' },
  { key: 'email-studio', label: 'Studio' },
  { key: 'pipeline', label: 'Pipeline' },
  { key: 'inbox', label: 'Inbox' },
];

/* ═══════════════════════════════════════════════════════════════════════
   RBAC — role-based navigation filtering
   ═══════════════════════════════════════════════════════════════════════ */

/**
 * Nav items restricted to admin-only access.
 * Phase 0 RBAC: 2 roles (admin, user). Admin sees everything; user sees intelligence + read-only.
 * operator/viewer roles are reserved for Phase 2 RBAC expansion.
 */
const ADMIN_ONLY_NAV_KEYS = new Set([
  'settings',
  'users',
  'audit',
  'ai-health',
  'data-import',
  'data-health',
  'trust-dashboard',
  'pipeline',
  'email-studio',
]);

function filterSectionsByRole(sections: typeof NAV_SECTIONS, role: string) {
  return sections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        if (ADMIN_ONLY_NAV_KEYS.has(item.key)) return role === 'admin';
        return true;
      }),
    }))
    .filter((section) => section.items.length > 0);
}

/* ═══════════════════════════════════════════════════════════════════════
   Screen-level error boundary (per-screen error isolation)
   ═══════════════════════════════════════════════════════════════════════ */

interface ScreenErrorBoundaryState { hasError: boolean; error?: Error }
class ScreenErrorBoundary extends Component<{ children: ReactNode; name: string }, ScreenErrorBoundaryState> {
  constructor(props: { children: ReactNode; name: string }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center py-24 text-center px-4">
          <div className="w-14 h-14 rounded-2xl bg-red-500/10 flex items-center justify-center mb-4">
            <AlertTriangle className="w-7 h-7 text-red-400" />
          </div>
          <p className="text-sm font-medium text-foreground mb-1">Screen failed to load</p>
          <p className="text-xs text-muted-foreground max-w-sm mb-4">
            {this.props.name} encountered an error. Other screens still work fine.
          </p>
          <button
            className="px-4 py-2 text-xs font-medium rounded-lg bg-gray-100 border border-gray-200 text-muted-foreground hover:bg-gray-200 hover:text-foreground transition-colors"
            onClick={() => this.setState({ hasError: false, error: undefined })}
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

/* ═══════════════════════════════════════════════════════════════════════
   Screen Loader (skeleton)
   ═══════════════════════════════════════════════════════════════════════ */

function ScreenLoader() {
  return (
    <div className="space-y-6 p-1">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-7 w-48 rounded-lg bg-gray-200 animate-pulse" />
          <div className="h-7 w-24 rounded-lg bg-gray-200 animate-pulse" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-8 w-28 rounded-lg bg-gray-200 animate-pulse" />
          <div className="h-8 w-8 rounded-lg bg-gray-200 animate-pulse" />
        </div>
      </div>
      {/* Stat cards skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-xl bg-white border border-gray-200 p-4 space-y-3">
            <div className="h-3 w-16 rounded bg-gray-200 animate-pulse" />
            <div className="h-6 w-20 rounded bg-gray-100 animate-pulse" />
          </div>
        ))}
      </div>
      {/* Table skeleton */}
      <div className="rounded-xl bg-white border border-gray-200 overflow-hidden">
        <div className="flex items-center gap-4 px-4 py-3 border-b border-gray-200">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-3 flex-1 rounded bg-gray-200 animate-pulse" />
          ))}
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-gray-100">
            <div className="h-4 w-4 rounded bg-gray-200 animate-pulse" />
            {Array.from({ length: 5 }).map((_, j) => (
              <div key={j} className="h-3 flex-1 rounded bg-gray-100 animate-pulse" style={{ animationDelay: `${(i * 5 + j) * 50}ms` }} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   Sidebar Nav Button (with tooltip for collapsed state)
   ═══════════════════════════════════════════════════════════════════════ */

function NavButton({
  item,
  active,
  collapsed,
  stageCount,
  onClick,
}: {
  item: NavConfigItem;
  active: boolean;
  collapsed: boolean;
  stageCount?: number;
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
      aria-label={collapsed ? item.label : undefined}
    >
      {/* Active accent line */}
      {active && (
        <motion.span
          layoutId="nav-active"
          className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-primary"
          transition={{ type: 'spring', stiffness: 350, damping: 30 }}
        />
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

      {!collapsed && stageCount !== undefined && stageCount > 0 && (
        <Badge
          variant="secondary"
          className="ml-auto h-5 min-w-5 px-1.5 text-[11px] font-semibold bg-primary/15 text-primary border-0 tabular-nums"
        >
          {stageCount >= 1000 ? `${(stageCount / 1000).toFixed(1)}k` : stageCount}
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
          {stageCount !== undefined && stageCount > 0 && (
            <p className="text-xs text-muted-foreground mt-0.5">{stageCount} pending</p>
          )}
        </TooltipContent>
      </Tooltip>
    );
  }

  return button;
}

/* ═══════════════════════════════════════════════════════════════════════
   Sidebar (RBAC + Collapsible + Pipeline dots + Mobile)
   ═══════════════════════════════════════════════════════════════════════ */

interface SidebarProps {
  stageCounts: Record<string, number>;
  onLogout: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

function Sidebar({ stageCounts, onLogout, mobileOpen, onMobileClose }: SidebarProps) {
  const { activeView, sidebarCollapsed, setActiveView, toggleSidebar } = useAppStore();
  const { session } = useSession();
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

  // Filter navigation based on user role (admin sees all)
  const visibleSections = session?.role
    ? filterSectionsByRole(NAV_SECTIONS, session.role)
    : NAV_SECTIONS;

  const handleNavClick = useCallback(
    (view: string) => {
      setActiveView(view as any);
      onMobileClose();
    },
    [setActiveView, onMobileClose]
  );

  const toggleSection = useCallback((heading: string) => {
    setCollapsedSections(prev => ({ ...prev, [heading]: !prev[heading] }));
  }, []);

  return (
    <>
      {/* Mobile sidebar overlay backdrop */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm lg:hidden"
            onClick={onMobileClose}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside
        id="sidebar-navigation"
        role="navigation"
        aria-label="Main navigation"
        tabIndex={-1}
        className={`
          fixed top-0 left-0 z-50 h-screen flex flex-col
          bg-[oklch(0.11_0.01_260)] border-r border-[oklch(0.22_0.005_260)]
          transition-[width,transform] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]
          ${sidebarCollapsed ? 'w-16' : 'w-[260px]'}
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
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

        {/* ── Navigation Sections ── */}
        <ScrollArea className="flex-1 py-3">
          <nav className="flex flex-col gap-0.5" role="navigation" aria-label="Main navigation">
            {visibleSections.map((section) => {
              const isCollapsed = collapsedSections[section.heading] ?? !section.defaultOpen;

              if (sidebarCollapsed) {
                // Collapsed: show items without section headers
                return (
                  <div key={section.heading} className="space-y-0.5">
                    {section.items.map((item) => (
                      <div key={item.key} className="px-2">
                        <NavButton
                          item={item}
                          active={activeView === item.key}
                          collapsed={sidebarCollapsed}
                          stageCount={stageCounts[item.key]}
                          onClick={() => handleNavClick(item.key)}
                        />
                      </div>
                    ))}
                  </div>
                );
              }

              // Expanded: show section headers with collapsible items
              return (
                <div key={section.heading} className="mb-1">
                  <button
                    onClick={() => toggleSection(section.heading)}
                    className="w-full flex items-center gap-1.5 px-3 pt-3 pb-1.5 group"
                  >
                    <span className="text-[11px] uppercase tracking-[0.18em] font-semibold flex-1 text-left text-muted-foreground">
                      {section.heading}
                    </span>
                    <ChevronDown
                      className={`w-3 h-3 transition-transform duration-200 text-muted-foreground ${
                        isCollapsed ? '-rotate-90' : ''
                      }`}
                    />
                  </button>

                  {!isCollapsed && (
                    <div className="space-y-0.5 pb-1">
                      {section.items.map((item) => (
                        <div key={item.key} className="px-3">
                          <NavButton
                            item={item}
                            active={activeView === item.key}
                            collapsed={false}
                            stageCount={stageCounts[item.key]}
                            onClick={() => handleNavClick(item.key)}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        </ScrollArea>

        {/* ── Pipeline Progress Dots ── */}
        {!sidebarCollapsed && (
          <div className="px-3 py-3 border-t border-[oklch(0.22_0.005_260)]">
            <div className="flex items-center justify-between px-0.5 mb-2.5">
              <span className="text-[11px] uppercase tracking-[0.18em] font-semibold text-muted-foreground">Pipeline</span>
            </div>
            <div className="flex items-center justify-between px-1">
              {PIPELINE_STAGES.map((stage, i) => {
                const count = stageCounts[stage.key] ?? 0;
                const isActive = activeView === stage.key;
                const hasItems = count > 0;
                return (
                  <div key={stage.key} className="flex items-center flex-1">
                    <motion.button
                      onClick={() => handleNavClick(stage.key)}
                      className="flex flex-col items-center gap-1.5 group relative"
                      title={`${stage.label}: ${count}`}
                      whileHover={{ scale: 1.15 }}
                    >
                      {hasItems && (
                        <motion.div
                          className="absolute -top-0.5 w-4 h-4 rounded-full bg-primary/20"
                          animate={{ scale: [1, 1.8, 1], opacity: [0.3, 0, 0.3] }}
                          transition={{ duration: 2.5, repeat: Infinity, delay: i * 0.3 }}
                        />
                      )}
                      <div
                        className={`w-3 h-3 rounded-full transition-all duration-300 ${isActive ? 'ring-2 ring-offset-1 ring-primary' : ''}`}
                        style={{
                          background: hasItems ? 'linear-gradient(135deg, var(--color-gold), var(--color-gold-bright))' : 'rgba(255,255,255,0.08)',
                          boxShadow: hasItems ? '0 0 8px color-mix(in oklch, var(--color-gold) 30%, transparent)' : 'none',
                        }}
                      />
                      <span
                        className={`text-[8px] leading-none font-medium transition-colors ${
                          isActive ? 'text-primary' : 'text-muted-foreground'
                        }`}
                      >
                        {stage.label}
                      </span>
                    </motion.button>
                    {i < PIPELINE_STAGES.length - 1 && (
                      <div
                        className="w-full h-px mx-1 mb-3 shrink-0"
                        style={{ background: 'linear-gradient(90deg, oklch(0.6 0.12 85 / 0.12), oklch(0.3 0 0 / 0.06))' }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── User Avatar + Logout ── */}
        {!sidebarCollapsed ? (
          <div className="shrink-0 border-t border-[oklch(0.22_0.005_260)] px-4 py-3">
            <div className="flex items-center gap-3">
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarFallback className="bg-primary/15 text-primary text-xs font-semibold">
                  {session?.email
                    ? session.email.split('@')[0].slice(0, 2).toUpperCase()
                    : 'DQ'}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-sm font-medium text-foreground leading-tight truncate">{session?.email ?? 'DeepMindQ User'}</span>
                <span className="text-[11px] text-muted-foreground leading-tight capitalize">{session?.role ?? 'user'}</span>
              </div>
              <motion.button
                onClick={onLogout}
                className="p-1.5 rounded-md transition-colors duration-200 hover:bg-red-500/10 text-muted-foreground hover:text-red-400"
                whileTap={{ scale: 0.9 }}
                title="Sign out"
              >
                <LogOut className="w-3.5 h-3.5" />
              </motion.button>
            </div>
          </div>
        ) : (
          <div className="shrink-0 border-t border-[oklch(0.22_0.005_260)] px-2 py-2 flex flex-col items-center gap-1">
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-primary/15 text-primary text-xs font-semibold">
                    {session?.email
                      ? session.email.split('@')[0].slice(0, 2).toUpperCase()
                      : 'DQ'}
                  </AvatarFallback>
                </Avatar>
              </TooltipTrigger>
              <TooltipContent
                side="right"
                sideOffset={12}
                className="bg-[oklch(0.17_0.01_260)] border-[oklch(0.27_0.005_260)] text-foreground"
              >
                <p className="font-medium">{session?.email ?? 'DeepMindQ User'}</p>
                <p className="text-xs text-muted-foreground capitalize">{session?.role ?? 'user'}</p>
              </TooltipContent>
            </Tooltip>
            <motion.button
              onClick={onLogout}
              className="p-1.5 rounded-md transition-colors duration-200 hover:bg-red-500/10 text-muted-foreground hover:text-red-400"
              whileTap={{ scale: 0.9 }}
              title="Sign out"
            >
              <LogOut className="w-3.5 h-3.5" />
            </motion.button>
          </div>
        )}

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
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   Header (Search + Breadcrumbs + Notifications + AI Chat + Refresh)
   ═══════════════════════════════════════════════════════════════════════ */

interface HeaderProps {
  breadcrumbs: { label: string; key?: string }[];
  aiChatOpen: boolean;
  onAiChatToggle: () => void;
  onRefresh: () => void;
  onMobileMenuToggle: () => void;
  mobileOpen: boolean;
}

function Header({
  breadcrumbs,
  aiChatOpen,
  onAiChatToggle,
  onRefresh,
  onMobileMenuToggle,
  mobileOpen,
}: HeaderProps) {
  const sidebarCollapsed = useAppStore((s) => s.sidebarCollapsed);
  const { session } = useSession();

  return (
    <header
      className={`
        sticky top-0 z-30 flex items-center h-14 gap-4 px-4 sm:px-6 shrink-0
        bg-[oklch(0.11_0.01_260)]/80 backdrop-blur-xl
        border-b border-[oklch(0.22_0.005_260)]
        transition-[padding-left] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]
        ${sidebarCollapsed ? 'pl-20' : 'pl-[276px]'}
      `}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {/* Mobile sidebar toggle */}
        <motion.button
          className="lg:hidden p-1 rounded-md shrink-0 text-muted-foreground hover:text-foreground hover:bg-black/[0.04] transition-colors"
          onClick={onMobileMenuToggle}
          whileTap={{ scale: 0.9 }}
          aria-label={mobileOpen ? 'Close sidebar' : 'Open sidebar'}
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </motion.button>

        {/* Breadcrumbs */}
        <nav className="hidden sm:flex items-center gap-1.5 min-w-0">
          {breadcrumbs.map((crumb, i) => (
            <span key={i} className="flex items-center gap-1.5 min-w-0">
              {i > 0 && <ChevronRight className="w-3 h-3 shrink-0 text-muted-foreground" />}
              <span className={`truncate ${
                crumb.key
                  ? 'text-xs font-medium text-muted-foreground hover:text-primary transition-colors cursor-pointer'
                  : 'text-sm font-semibold text-foreground tracking-tight'
              }`}>
                {crumb.label}
              </span>
            </span>
          ))}
        </nav>
      </div>

      {/* Search */}
      <div className="hidden md:flex flex-1 max-w-xl justify-center">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60 pointer-events-none" />
          <Input
            type="search"
            placeholder="Search accounts, contacts..."
            className="h-9 pl-9 bg-black/[0.04] border-[oklch(0.27_0.005_260)] text-foreground placeholder:text-muted-foreground/50 focus-visible:border-primary/40 focus-visible:ring-primary/20"
            aria-label="Search accounts, contacts"
          />
          <kbd className="absolute right-3 top-1/2 -translate-y-1/2 hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground/50 bg-black/[0.04] border border-[oklch(0.27_0.005_260)] rounded">
            <span className="text-[11px]">⌘</span>K
          </kbd>
        </div>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-1 shrink-0">
        {/* AI Chat toggle — visible on md+ screens */}
        <motion.button
          className="hidden md:flex p-2 rounded-lg transition-colors duration-200 hover:bg-black/[0.04] text-muted-foreground hover:text-foreground"
          style={{ color: aiChatOpen ? 'var(--color-gold)' : undefined }}
          whileTap={{ scale: 0.9 }}
          onClick={onAiChatToggle}
          title="AI Assistant"
        >
          <Sparkles className="w-4 h-4" />
        </motion.button>

        {/* Notifications */}
        <NotificationBell />

        {/* Refresh */}
        <motion.button
          className="p-2 rounded-lg transition-colors duration-200 hover:bg-black/[0.04] text-muted-foreground hover:text-foreground"
          whileTap={{ scale: 0.9 }}
          title="Refresh data"
          onClick={onRefresh}
        >
          <RefreshCw className="w-4 h-4" />
        </motion.button>

        {/* Separator */}
        <div className="w-px h-6 bg-[oklch(0.27_0.005_260)] mx-1" />

        {/* User avatar */}
        <div className="flex items-center gap-3 pl-1">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-primary/15 text-primary text-xs font-semibold">
              {session?.email
                ? session.email.split('@')[0].slice(0, 2).toUpperCase()
                : 'DQ'}
            </AvatarFallback>
          </Avatar>
          <div className="hidden lg:flex flex-col">
            <span className="text-sm font-medium text-foreground leading-tight">{session?.email ?? 'DeepMindQ User'}</span>
            <span className="text-[11px] text-muted-foreground leading-tight capitalize">{session?.role ?? 'user'}</span>
          </div>
        </div>
      </div>
    </header>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   App Shell
   ═══════════════════════════════════════════════════════════════════════ */

export function AppShell({ onLogout }: { onLogout: () => void }) {
  const [stageCounts, setStageCounts] = useState<Record<string, number>>({});
  const [aiChatOpen, setAiChatOpen] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Single source of truth: useAppStore
  const activeScreen = useAppStore((s) => s.activeView);
  const selectedCompanyId = useAppStore((s) => s.selectedCompanyId);
  const selectedContactId = useAppStore((s) => s.selectedContactId);
  const setActiveScreen = useAppStore((s) => s.setActiveView);
  const setSelectedCompanyId = useAppStore((s) => s.setSelectedCompanyId);
  const setSelectedContactId = useAppStore((s) => s.setSelectedContactId);
  const sidebarCollapsed = useAppStore((s) => s.sidebarCollapsed);

  // ── URL hash sync for bookmarkability + browser back/forward ──
  useEffect(() => {
    const syncHash = () => {
      const hash = window.location.hash.replace('#', '');
      if (hash && SCREEN_MAP[hash] && hash !== activeScreen) {
        setSelectedCompanyId(null);
        setSelectedContactId(null);
        setActiveScreen(hash as any);
      }
    };
    syncHash();
    window.addEventListener('hashchange', syncHash);
    return () => window.removeEventListener('hashchange', syncHash);
  }, []);

  useEffect(() => {
    if (activeScreen) {
      window.location.hash = activeScreen;
      document.title = `${SCREEN_LABELS[activeScreen] || 'DeepMindQ'} — DeepMindQ`;
    }
  }, [activeScreen]);

  // ── Fetch pipeline counts every 30s ──
  useEffect(() => {
    const fetchCounts = () => {
      fetch('/api/dashboard')
        .then(res => res.json())
        .then((data) => {
          setStageCounts({
            import: data.importedCount ?? 0,
            companies: data.totalLeads ?? 0,
            'email-studio': data.draftCount ?? 0,
            pipeline: data.queueCount ?? 0,
            inbox: (data.replyCount ?? 0) + (data.bounceCount ?? 0),
          });
        })
        .catch((err) => { logger.error('[AppShell] Dashboard fetch error:', { error: err }); });
    };
    fetchCounts();
    const interval = setInterval(fetchCounts, 30000);
    return () => clearInterval(interval);
  }, []);

  // ── Close mobile sidebar on Escape key ──
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && mobileSidebarOpen) {
        setMobileSidebarOpen(false);
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [mobileSidebarOpen]);

  // ── Navigation callback (passed to screens) ──
  const navigateTo = useCallback((screen: string, companyId?: string) => {
    if (companyId) {
      setSelectedCompanyId(companyId);
    } else {
      setSelectedCompanyId(null);
      setSelectedContactId(null);
    }
    setActiveScreen(screen as any);
    setMobileSidebarOpen(false);
  }, [setActiveScreen, setSelectedCompanyId, setSelectedContactId]);

  // ── Refresh pipeline counts (immediate) ──
  const handleRefresh = useCallback(() => {
    fetch('/api/dashboard')
      .then(res => res.json())
      .then((data) => {
        setStageCounts({
          import: data.importedCount ?? 0,
          companies: data.totalLeads ?? 0,
          'email-studio': data.draftCount ?? 0,
          pipeline: data.queueCount ?? 0,
          inbox: (data.replyCount ?? 0) + (data.bounceCount ?? 0),
        });
      })
      .catch((err) => { logger.error('[AppShell] Refresh error:', { error: err }); });
  }, []);

  // ── Screen component ──
  const LazyComponent = SCREEN_MAP[activeScreen] || SCREEN_MAP['dashboard'];
  const activeLabel = SCREEN_LABELS[activeScreen] || 'DeepMindQ';

  // ── Breadcrumb trail ──
  const breadcrumbs = [
    ...(activeScreen === 'company-workspace' && selectedCompanyId
      ? [{ label: 'Command Center', key: 'command-center' }, { label: 'Company Workspace' }]
      : selectedCompanyId
      ? [{ label: 'Companies', key: 'companies' }, { label: 'Company Detail' }]
      : selectedContactId
      ? [{ label: 'Contacts', key: 'contacts' }, { label: 'Contact Detail' }]
      : [{ label: activeLabel }]),
  ];

  return (
    <div className="min-h-screen bg-background text-foreground flex">
      <Toaster theme="light" position="top-right" />

      {/* Accessibility */}
      <SkipNavigation />

      {/* Global overlays */}
      <CommandPalette />
      <OnboardingFlow />
      <NotificationPanel />

      {/* AI Chat Sidebar + FAB */}
      <AiChatSidebar isOpen={aiChatOpen} onClose={() => setAiChatOpen(false)} />
      <div className="md:hidden">
        <AiChatButton isOpen={aiChatOpen} onToggle={() => setAiChatOpen(!aiChatOpen)} />
      </div>

      {/* Sidebar */}
      <Sidebar
        stageCounts={stageCounts}
        onLogout={onLogout}
        mobileOpen={mobileSidebarOpen}
        onMobileClose={() => setMobileSidebarOpen(false)}
      />

      {/* ── Main Content Area ── */}
      <div
        className={`
          flex-1 min-w-0 flex flex-col
          transition-[margin-left] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]
          ${sidebarCollapsed ? 'ml-16' : 'ml-[260px]'}
        `}
      >
        {/* Header */}
        <Header
          breadcrumbs={breadcrumbs}
          aiChatOpen={aiChatOpen}
          onAiChatToggle={() => setAiChatOpen(!aiChatOpen)}
          onRefresh={handleRefresh}
          onMobileMenuToggle={() => setMobileSidebarOpen(!mobileSidebarOpen)}
          mobileOpen={mobileSidebarOpen}
        />

        {/* Screen Content */}
        <main id="main-content" role="main" tabIndex={-1} className="flex-1 p-4 sm:p-6">
          {/*
            Routing priority:
            1. Intelligence OS screens (company-workspace) handle selectedCompanyId internally
            2. Legacy Company Detail overlay — only for non-workspace views
            3. Contact Detail overlay
            4. Default: render activeScreen from SCREEN_MAP
          */}
          {activeScreen === 'company-workspace' ? (
            <AnimatePresence mode="wait">
              <PageTransition key="company-workspace">
                <ScreenErrorBoundary name="Company Workspace">
                  <Suspense fallback={<ScreenLoader />}>
                    <LazyComponent navigateTo={navigateTo} />
                  </Suspense>
                </ScreenErrorBoundary>
              </PageTransition>
            </AnimatePresence>
          ) : selectedCompanyId ? (
            <PageTransition key="company-detail">
              <Suspense fallback={<ScreenLoader />}>
                <ScreenErrorBoundary name="Company Detail">
                  <CompanyDetailScreen
                    companyId={selectedCompanyId}
                    navigateTo={navigateTo}
                    onBack={() => {
                      setSelectedCompanyId(null);
                      window.history.back();
                    }}
                  />
                </ScreenErrorBoundary>
              </Suspense>
            </PageTransition>
          ) : selectedContactId ? (
            <PageTransition key="contact-detail">
              <Suspense fallback={<ScreenLoader />}>
                <ScreenErrorBoundary name="Contact Detail">
                  <ContactDetailBridge
                    contactId={selectedContactId}
                  />
                </ScreenErrorBoundary>
              </Suspense>
            </PageTransition>
          ) : (
            <AnimatePresence mode="wait">
              <PageTransition key={activeScreen}>
                <ScreenErrorBoundary name={activeLabel}>
                  <Suspense fallback={<ScreenLoader />}>
                    <LazyComponent navigateTo={navigateTo} />
                  </Suspense>
                </ScreenErrorBoundary>
              </PageTransition>
            </AnimatePresence>
          )}
        </main>
      </div>
    </div>
  );
}
