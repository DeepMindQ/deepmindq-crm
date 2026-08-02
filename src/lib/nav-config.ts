/* ═══════════════════════════════════════════════════
   Navigation Configuration
   
   DeepMindQ — 5-section sidebar navigation.
   Single source of truth for sidebar structure.
   
   INTELLIGENCE  → Core intelligence views
   REVENUE       → Pipeline & outreach
   KNOWLEDGE     → Capability & knowledge management
   DATA          → Data import & quality
   OPERATIONS    → System admin, analytics, governance
   ═══════════════════════════════════════════════════ */

import {
  LayoutDashboard, Cpu, Building2, Search,
  Brain, BookOpen, Layers, Radar, Target,
  Settings, Shield, Database, Plug, Activity,
  BarChart3, Inbox, Upload, Radio,
  TrendingUp, Telescope, ScrollText,
  Users, GitBranch, Mail, FileDown,
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
      { key: 'intelligence-operations', label: 'Executive Dashboard', icon: LayoutDashboard },
      { key: 'accounts', label: 'Company Intelligence', icon: Building2 },
      { key: 'contacts', label: 'Contact Intelligence', icon: Users },
      { key: 'signal-intelligence', label: 'AI Insights', icon: Radar },
      { key: 'opportunity-radar', label: 'Opportunities', icon: Target },
      { key: 'intelligence-search', label: 'Intelligence Search', icon: Search },
    ],
  },

  /* ── REVENUE ── */
  {
    heading: 'REVENUE',
    defaultOpen: true,
    items: [
      { key: 'pipeline', label: 'Pipeline', icon: GitBranch },
      { key: 'email-studio', label: 'Email Studio', icon: Mail },
    ],
  },

  /* ── KNOWLEDGE ── */
  {
    heading: 'KNOWLEDGE',
    defaultOpen: false,
    items: [
      { key: 'knowledge-workspace', label: 'Knowledge Intelligence', icon: Brain },
    ],
  },

  /* ── DATA ── */
  {
    heading: 'DATA',
    defaultOpen: false,
    items: [
      { key: 'data-import', label: 'Import Data', icon: FileDown },
      { key: 'data-health', label: 'Data Health', icon: Activity },
    ],
  },

  /* ── OPERATIONS ── */
  {
    heading: 'OPERATIONS',
    defaultOpen: false,
    items: [
      { key: 'analytics', label: 'Analytics', icon: BarChart3 },
      { key: 'ai-health', label: 'System Health', icon: Cpu },
      { key: 'settings', label: 'Settings', icon: Settings },
      { key: 'audit', label: 'Audit & Governance', icon: Shield },
    ],
  },
];
