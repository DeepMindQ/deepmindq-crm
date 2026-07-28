/* ═══════════════════════════════════════════════════
   Navigation Configuration
   
   Enterprise-grade 5-section navigation.
   Single source of truth for sidebar structure.
   ═══════════════════════════════════════════════════ */

import {
  LayoutDashboard, Sparkles, Radar,
  Building2, Users, Target, Kanban,
  GitBranch, FileText, Mail,
  Upload, BarChart3, Brain, Activity,
  Settings, ScrollText, Shield, Copy,
  Cpu, Crosshair, MessageSquareText,
  Zap,
} from 'lucide-react';

export interface NavItem {
  key: string;
  label: string;
  icon: React.ElementType;
  badgeCount?: number;
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
      { key: 'ai-command-center', label: 'AI Command Center', icon: Cpu },
      { key: 'revenue-intelligence', label: 'Revenue Intelligence', icon: Sparkles },
      { key: 'signal-intelligence', label: 'Signal Intelligence', icon: Radar },
    ],
  },

  /* ── AI ENGINES ── */
  {
    heading: 'AI ENGINES',
    defaultOpen: false,
    items: [
      { key: 'account-intelligence', label: 'Account Intelligence', icon: Crosshair },
      { key: 'conversation-planner', label: 'Conversation Planner', icon: MessageSquareText },
      { key: 'action-center', label: 'Action Center', icon: Zap },
    ],
  },

  /* ── ACCOUNTS ── */
  {
    heading: 'ACCOUNTS',
    defaultOpen: false,
    items: [
      { key: 'companies', label: 'Companies', icon: Building2 },
      { key: 'contacts', label: 'Stakeholders', icon: Users },
      { key: 'opportunities', label: 'Opportunities', icon: Target },
      { key: 'segments', label: 'Segments', icon: Kanban },
    ],
  },

  /* ── PIPELINE & ENGAGEMENT ── */
  {
    heading: 'PIPELINE & ENGAGEMENT',
    defaultOpen: false,
    items: [
      { key: 'pipeline', label: 'Pipeline', icon: GitBranch },
      { key: 'sequences', label: 'Sequences', icon: GitBranch },
      { key: 'email-studio', label: 'Email Studio', icon: FileText },
      { key: 'inbox', label: 'Replies & Bounces', icon: Mail, badgeCount: 0 },
    ],
  },

  /* ── OPERATIONS ── */
  {
    heading: 'OPERATIONS',
    defaultOpen: false,
    items: [
      { key: 'import', label: 'Import', icon: Upload },
      { key: 'analytics', label: 'Analytics', icon: BarChart3 },
      { key: 'knowledge', label: 'Knowledge Base', icon: Brain },
      { key: 'ai-health', label: 'AI Health', icon: Activity },
    ],
  },

  /* ── SETTINGS ── */
  {
    heading: 'SETTINGS',
    defaultOpen: false,
    items: [
      { key: 'settings', label: 'Settings', icon: Settings },
      { key: 'audit', label: 'Audit Log', icon: ScrollText },
      { key: 'data-health', label: 'Data Health', icon: Shield },
      { key: 'duplicates', label: 'Duplicates', icon: Copy },
    ],
  },
];
