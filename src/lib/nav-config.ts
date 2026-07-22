/* ═══════════════════════════════════════════════════
   Navigation Configuration
   
   Extracted from page.tsx to reduce monolith size.
   Contains all nav section definitions.
   ═══════════════════════════════════════════════════ */

import {
  LayoutDashboard, Upload, Users, Building2, FileText, Send,
  Archive, Mail, XCircle, Brain, GitBranch, ScrollText, Settings,
  BarChart3, LayoutTemplate, Layers, Sparkles, Network, Target,
  FileBarChart, Code2, Copy, ClipboardList, Kanban, MailPlus,
  Radar, MessageSquare, Heart, Shield, Database, BookOpen, Compass,
  Crosshair, Lightbulb,
} from 'lucide-react';

export interface NavItem {
  key: string;
  label: string;
  icon: React.ElementType;
}

export interface NavSection {
  heading: string;
  items: NavItem[];
  defaultOpen?: boolean;
}

export const NAV_SECTIONS: NavSection[] = [
  {
    heading: 'REVENUE INTELLIGENCE',
    defaultOpen: true,
    items: [
      { key: 'revenue-intelligence', label: 'Revenue Intelligence', icon: Sparkles },
      { key: 'revenue-intelligence-opportunities', label: 'Opportunity Radar', icon: Radar },
      { key: 'revenue-intelligence-recommendations', label: 'Exec Recommendations', icon: Lightbulb },
      { key: 'revenue-intelligence-brief', label: 'Company Brief', icon: Target },
      { key: 'intelligence-reasoning', label: 'AI Reasoning', icon: Brain },
      { key: 'intelligence-report', label: 'Intelligence Report', icon: FileText },
      { key: 'account-ranking', label: 'Account Ranking', icon: Target },
      { key: 'opportunity-workspace', label: 'Opportunity Workspace', icon: Radar },
      { key: 'pursuit-workspace', label: 'Pursuit Tracker', icon: Compass },
    ],
  },
  {
    heading: 'INTELLIGENCE LAYER',
    defaultOpen: true,
    items: [
      { key: 'signal-intelligence', label: 'Signal Intelligence', icon: Layers },
      { key: 'research-agent', label: 'Research Agent', icon: Brain },
      { key: 'opportunity-radar', label: 'Opportunity Radar', icon: Target },
      { key: 'playbooks', label: 'Sales Playbooks', icon: BookOpen },
    ],
  },
  {
    heading: 'ACCOUNTS & CONTACTS',
    defaultOpen: false,
    items: [
      { key: 'companies', label: 'Companies', icon: Building2 },
      { key: 'contacts', label: 'Stakeholders', icon: Network },
      { key: 'leads', label: 'Leads', icon: Database },
      { key: 'segments', label: 'Segments', icon: Kanban },
    ],
  },
  {
    heading: 'ENGAGEMENT',
    defaultOpen: false,
    items: [
      { key: 'conversation-studio', label: 'Conversation Studio', icon: MessageSquare },
      { key: 'strategy-room', label: 'Strategy Room', icon: Compass },
      { key: 'email-generation', label: 'Email Generator', icon: MailPlus },
      { key: 'drafts', label: 'Drafts', icon: FileText },
      { key: 'sequences', label: 'Sequences', icon: GitBranch },
      { key: 'queue', label: 'Send Queue', icon: Send },
      { key: 'templates', label: 'Templates', icon: LayoutTemplate },
    ],
  },
  {
    heading: 'INBOX',
    defaultOpen: false,
    items: [
      { key: 'replies', label: 'Replies', icon: Mail },
      { key: 'bounces', label: 'Bounces & Suppressions', icon: XCircle },
    ],
  },
  {
    heading: 'KNOWLEDGE',
    defaultOpen: false,
    items: [
      { key: 'knowledge', label: 'Solution Intelligence', icon: Brain },
      { key: 'capabilities', label: 'Capability Library', icon: Archive },
      { key: 'mind-map', label: 'Mind Map', icon: Network },
      { key: 'prompt-templates', label: 'AI Prompts', icon: Code2 },
    ],
  },
  {
    heading: 'OPERATIONS',
    defaultOpen: false,
    items: [
      { key: 'pipeline', label: 'Pipeline', icon: GitBranch },
      { key: 'import', label: 'Import', icon: Upload },
      { key: 'analytics', label: 'Analytics', icon: BarChart3 },
      { key: 'reports', label: 'Reports', icon: FileBarChart },
    ],
  },
  {
    heading: 'CONFIGURE',
    defaultOpen: false,
    items: [
      { key: 'intelligence-health', label: 'Intelligence Health', icon: Shield },
      { key: 'icp-settings', label: 'ICP Configuration', icon: Crosshair },
      { key: 'data-health', label: 'Data Health', icon: Shield },
      { key: 'relationship-memory', label: 'Relationship Memory', icon: Heart },
      { key: 'tasks', label: 'Tasks', icon: ClipboardList },
      { key: 'duplicates', label: 'Duplicates', icon: Copy },
      { key: 'audit', label: 'Audit Log', icon: ScrollText },
      { key: 'settings', label: 'Settings', icon: Settings },
    ],
  },
];
