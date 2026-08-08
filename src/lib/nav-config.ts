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
  TrendingUp, Telescope, ScrollText, Sparkles,
  Users, GitBranch, Mail, FileDown, Sliders, Lightbulb,
  Zap, Wand2,
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
      { key: 'main-dashboard', label: 'Main Dashboard', icon: Telescope },
      { key: 'intelligence-operations', label: 'Executive Dashboard', icon: LayoutDashboard },
      { key: 'ai-advisor', label: 'AI Advisor', icon: Sparkles },
      { key: 'accounts', label: 'Company Intelligence', icon: Building2 },
      { key: 'company-workspace-v2', label: 'Company V2', icon: Building2 },
      { key: 'contacts', label: 'Contact Intelligence', icon: Users },
      { key: 'signal-intelligence', label: 'AI Insights', icon: Radar },
      { key: 'opportunity-radar', label: 'Opportunities', icon: Target },
      { key: 'account-ranking', label: 'Account Ranking', icon: TrendingUp },
      { key: 'intelligence-search', label: 'Intelligence Search', icon: Search },
    ],
  },

  /* ── REVENUE ── */
  {
    heading: 'REVENUE',
    defaultOpen: true,
    items: [
      { key: 'pipeline', label: 'Pipeline', icon: GitBranch },
      { key: 'recommendation-queue', label: 'Recommendations', icon: Lightbulb },
      { key: 'recommendation-queue-v2', label: 'Smart Queue', icon: Zap },
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
      { key: 'trust-dashboard', label: 'AI Trust', icon: Shield },
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
      { key: 'scoring-config', label: 'Scoring Config', icon: Sliders },
      { key: 'scoring-wizard', label: 'Scoring Wizard', icon: Wand2 },
      { key: 'batch-operations', label: 'Batch Operations', icon: Layers },
      { key: 'users', label: 'Users', icon: Users },
      { key: 'audit', label: 'Audit & Governance', icon: Shield },
      { key: 'admin-settings', label: 'Admin Panel', icon: Shield },
    ],
  },
];
