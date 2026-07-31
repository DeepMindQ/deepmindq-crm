/* ═══════════════════════════════════════════════════
   Navigation Configuration
   
   Intelligence OS — Enterprise-grade 3-section navigation.
   Single source of truth for sidebar structure.
   
   INTELLIGENCE → Business questions, daily operations
   WORKSPACES   → Deep contextual intelligence
   ADMIN        → Enterprise operations
   ═══════════════════════════════════════════════════ */

import {
  LayoutDashboard, Cpu, Building2, Search,
  Brain, BookOpen, Layers, Radar, Target,
  Settings, Shield, Database, Plug, Activity,
  ChevronRight, BarChart3, Inbox,
} from 'lucide-react';

export interface NavItem {
  key: string;
  label: string;
  icon: React.ElementType;
  badgeCount?: number;
  isNew?: boolean;
}

export interface NavSection {
  heading: string;
  items: NavItem[];
  defaultOpen?: boolean;
}

export const NAV_SECTIONS: NavSection[] = [
  /* ── INTELLIGENCE ── */
  {
    heading: 'INTELLIGENCE',
    defaultOpen: true,
    items: [
      { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { key: 'command-center', label: 'Command Center', icon: LayoutDashboard, isNew: true },
      { key: 'accounts', label: 'Accounts', icon: Building2 },
      { key: 'signal-intelligence', label: 'Signal Intelligence', icon: Radar, isNew: true },
      { key: 'intelligence-inbox', label: 'Intelligence Inbox', icon: Inbox, isNew: true },
      { key: 'opportunity-radar', label: 'Opportunity Radar', icon: Target, isNew: true },
      { key: 'intelligence-search', label: 'Intelligence Search', icon: Search },
    ],
  },

  /* ── WORKSPACES ── */
  {
    heading: 'WORKSPACES',
    defaultOpen: true,
    items: [
      { key: 'company-workspace', label: 'Company Workspace', icon: Layers, isNew: true },
      { key: 'knowledge-workspace', label: 'Knowledge & Capabilities', icon: Brain, isNew: true },
      { key: 'capability-workspace', label: 'Capability Workspace', icon: Cpu, isNew: true },
    ],
  },

  /* ── ADMINISTRATION ── */
  {
    heading: 'ADMINISTRATION',
    defaultOpen: false,
    items: [
      { key: 'import', label: 'Data Management', icon: Database },
      { key: 'analytics', label: 'Analytics', icon: BarChart3 },
      { key: 'settings', label: 'Settings', icon: Settings },
      { key: 'data-health', label: 'Integrations', icon: Plug },
      { key: 'ai-health', label: 'System Health', icon: Activity },
      { key: 'audit', label: 'Audit Log', icon: Shield },
    ],
  },
];
