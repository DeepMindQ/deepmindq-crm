'use client';

import { useState, useEffect, lazy, Suspense, Component, useCallback, type ReactNode } from 'react';
import { Toaster } from '@/components/ui/sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { PageTransition } from '@/components/ui/animated-components';
import { AiChatSidebar } from '@/components/shared/ai-chat-sidebar';
import { AiChatButton } from '@/components/shared/ai-chat-button';
import { CommandPalette } from '@/components/shared/command-palette';
import { ErrorBoundary } from '@/components/error-boundary';
import { QueryProvider } from '@/providers/query-provider';

import {
  LayoutDashboard, Upload, Users, Building2, FileText, Send,
  Archive, Mail, XCircle, RefreshCw, Menu, X,
  Brain, GitBranch, ScrollText, Settings, LogOut, BarChart3, Bell,
  LayoutTemplate, Layers, AlertTriangle, Loader2, Sparkles, Network,
  UserPlus, Target, FileBarChart, Code2, Copy, ClipboardList, Kanban, MailPlus,
  ChevronDown, ChevronRight, Radar, MessageSquare, Heart, Activity, Shield, Database,
  BookOpen, Compass, Search, ExternalLink, Crosshair, Play,
} from 'lucide-react';

import LoginPage from '@/components/login-page';
import LandingPage from '@/app/landing-page';
import { useAppStore } from '@/lib/store';

/* ═════════════════════════════════════════════════════
   Lazy-loaded screen components
   ═══════════════════════════════════════════════════ */

// — Originally active screens (accept navigateTo prop) —
const DashboardScreen = lazy(() => import('@/components/screens/dashboard-screen'));
const CommandCenterScreen = lazy(() => import('@/components/screens/command-center-screen'));
const MindMapScreen = lazy(() => import('@/components/screens/mind-map-screen'));
const ImportScreen = lazy(() => import('@/components/screens/import-screen'));
const LeadsScreen = lazy(() => import('@/components/screens/leads-screen'));
const CompaniesScreen = lazy(() => import('@/components/screens/companies-screen'));
const CompanyDetailScreen = lazy(() => import('@/components/screens/company-detail-screen'));
const SegmentsScreen = lazy(() => import('@/components/screens/segments-screen'));
const DraftsScreen = lazy(() => import('@/components/screens/drafts-screen'));
const QueueScreen = lazy(() => import('@/components/screens/queue-screen'));
const CapabilityScreen = lazy(() => import('@/components/screens/capability-screen'));
const KnowledgeLibraryScreen = lazy(() => import('@/components/screens/knowledge-library-screen'));
const RepliesScreen = lazy(() => import('@/components/screens/replies-screen'));
const BouncesScreen = lazy(() => import('@/components/screens/bounces-screen'));
const PipelineScreen = lazy(() => import('@/components/screens/pipeline-screen'));
const AnalyticsScreen = lazy(() => import('@/components/screens/analytics-screen'));
const AuditScreen = lazy(() => import('@/components/screens/audit-screen'));
const SettingsScreen = lazy(() => import('@/components/screens/settings-screen'));
const TemplatesScreen = lazy(() => import('@/components/screens/templates-screen'));
const SequencesScreen = lazy(() => import('@/components/screens/sequences-screen'));

// — Previously dormant screens (now wired in) —
const ContactsScreen = lazy(() => import('@/components/screens/contacts-screen'));
const ContactDetailScreen = lazy(() => import('@/components/screens/contact-detail-screen'));
const TasksScreen = lazy(() => import('@/components/screens/tasks-screen'));
const OpportunitiesScreen = lazy(() => import('@/components/screens/opportunities-screen'));
const ReportsScreen = lazy(() => import('@/components/screens/reports-screen'));
const EmailGenerationScreen = lazy(() => import('@/components/screens/email-generation-screen'));
const PromptTemplatesScreen = lazy(() => import('@/components/screens/prompt-templates-screen'));
const DuplicatesScreen = lazy(() => import('@/components/screens/duplicates-screen'));

// — New Intelligence Platform screens —
const SignalIntelligenceScreen = lazy(() => import('@/components/screens/signal-intelligence-screen'));
const ConversationStudioScreen = lazy(() => import('@/components/screens/conversation-studio-screen'));
const RelationshipMemoryScreen = lazy(() => import('@/components/screens/relationship-memory-screen'));
const OpportunityRadarScreen = lazy(() => import('@/components/screens/opportunity-radar-screen'));
const DataHealthScreen = lazy(() => import('@/components/screens/data-health-screen'));

// — Phase 4 screens —
const PlaybooksScreen = lazy(() => import('@/components/screens/playbooks-screen'));
const ResearchAgentScreen = lazy(() => import('@/components/screens/research-agent-screen'));
const StrategyRoomScreen = lazy(() => import('@/components/screens/strategy-room-screen'));

// — Phase 6: Intelligence Governance —
const IntelligenceHealthScreen = lazy(() => import('@/components/screens/intelligence-health-screen'));

// — Phase 7: Revenue Intelligence Experience Layer —
const RevenueIntelligenceScreen = lazy(() => import('@/components/screens/revenue-intelligence-screen'));

// — Phase 7.5: Intelligence Acquisition & Fabric —
const IntelligenceSourcesScreen = lazy(() => import('@/components/screens/intelligence-sources-screen'));
const IntelligenceKnowledgeScreen = lazy(() => import('@/components/screens/intelligence-knowledge-screen'));
const RevenueIntelligenceBriefScreen = lazy(() => import('@/components/screens/revenue-intelligence-brief-screen'));
const IntelligenceReasoningScreen = lazy(() => import('@/components/screens/intelligence-reasoning-screen'));
const IntelligenceReportScreen = lazy(() => import('@/components/screens/intelligence-report-screen'));
const DemoExperienceScreen = lazy(() => import('@/components/screens/demo-experience-screen'));

// — Phase 5/7: Revenue Intelligence screens —
const AccountRankingScreen = lazy(() => import('@/components/screens/account-ranking-screen'));
const OpportunityWorkspaceScreen = lazy(() => import('@/components/screens/opportunity-workspace-screen'));
const PursuitWorkspaceScreen = lazy(() => import('@/components/screens/pursuit-workspace-screen'));
const ICPSettingsScreen = lazy(() => import('@/components/screens/icp-settings-screen'));

/* ═══════════════════════════════════════════════════
   Navigation configuration
   ═══════════════════════════════════════════════════ */

interface NavItem {
  key: string;
  label: string;
  icon: React.ElementType;
}

interface NavSection {
  heading: string;
  items: NavItem[];
  defaultOpen?: boolean;
}

const NAV_SECTIONS: NavSection[] = [
  {
    heading: 'REVENUE INTELLIGENCE',
    defaultOpen: true,
    items: [
      { key: 'revenue-intelligence', label: 'Revenue Intelligence', icon: Sparkles },
      { key: 'revenue-intelligence-brief', label: 'Company Brief', icon: Target },
      { key: 'intelligence-reasoning', label: 'AI Reasoning', icon: Brain },
      { key: 'intelligence-report', label: 'Intelligence Report', icon: FileText },
      { key: 'demo-experience', label: 'Demo Mode', icon: Play },
      { key: 'account-ranking', label: 'Account Ranking', icon: Target },
      { key: 'opportunity-workspace', label: 'Opportunity Workspace', icon: Radar },
      { key: 'pursuit-workspace', label: 'Pursuit Tracker', icon: Compass },
    ],
  },
  {
    heading: 'INTELLIGENCE LAYER',
    defaultOpen: true,
    items: [
      { key: 'signal-intelligence', label: 'Signal Intelligence', icon: Activity },
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

/* ═══════════════════════════════════════════════════
   Bridge wrappers for dormant screens
   These translate navigateTo prop → useAppStore actions
   ═══════════════════════════════════════════════════ */

function ContactsBridge({ navigateTo }: { navigateTo?: (screen: string, companyId?: string) => void }) {
  // Contacts screen uses useAppStore internally for sub-navigation (contact-detail, company-profile, email-generation)
  // We sync the active screen to the store so it works
  return <ContactsScreen />;
}

function ContactDetailBridge({ contactId, navigateTo }: { contactId: string; navigateTo?: (screen: string) => void }) {
  // contact-detail-screen reads selectedContactId from store
  useEffect(() => { useAppStore.getState().setSelectedContactId(contactId); }, [contactId]);
  return <ContactDetailScreen />;
}

function TasksBridge() {
  return <TasksScreen />;
}

function OpportunitiesBridge() {
  return <OpportunitiesScreen />;
}

function ReportsBridge() {
  return <ReportsScreen />;
}

function EmailGenBridge() {
  return <EmailGenerationScreen />;
}

function PromptTemplatesBridge() {
  return <PromptTemplatesScreen />;
}

function DuplicatesBridge() {
  return <DuplicatesScreen />;
}

/* ═══════════════════════════════════════════════════
   Screen map — unified registry
   ═══════════════════════════════════════════════════ */

type ScreenComponent = React.LazyExoticComponent<React.ComponentType<any>> | React.FC<any>;

const SCREEN_MAP: Record<string, ScreenComponent> = {
  // Phase 7: Revenue Intelligence Experience Layer
  'revenue-intelligence': RevenueIntelligenceScreen,
  'revenue-intelligence-brief': RevenueIntelligenceBriefScreen,
  'intelligence-reasoning': IntelligenceReasoningScreen,
  'intelligence-report': IntelligenceReportScreen,
  'demo-experience': DemoExperienceScreen,
  // Revenue Intelligence (Phase 5/7)
  'account-ranking': AccountRankingScreen,
  'opportunity-workspace': OpportunityWorkspaceScreen,
  'pursuit-workspace': PursuitWorkspaceScreen,
  'intelligence-health': IntelligenceHealthScreen,
  'icp-settings': ICPSettingsScreen,
  // Intelligence
  'command-center': CommandCenterScreen,
  'signal-intelligence': SignalIntelligenceScreen,
  'research-agent': ResearchAgentScreen,
  'playbooks': PlaybooksScreen,
  'opportunity-radar': OpportunityRadarScreen,
  'conversation-studio': ConversationStudioScreen,
  'strategy-room': StrategyRoomScreen,
  'relationship-memory': RelationshipMemoryScreen,
  'data-health': DataHealthScreen,
  'mind-map': MindMapScreen,
  dashboard: DashboardScreen,
  pipeline: PipelineScreen,
  analytics: AnalyticsScreen,
  contacts: ContactsBridge,
  companies: CompaniesScreen,
  opportunities: OpportunitiesBridge,
  import: ImportScreen,
  leads: LeadsScreen,
  segments: SegmentsScreen,
  duplicates: DuplicatesBridge,
  capabilities: CapabilityScreen,
  knowledge: KnowledgeLibraryScreen,
  'email-generation': EmailGenBridge,
  drafts: DraftsScreen,
  queue: QueueScreen,
  templates: TemplatesScreen,
  sequences: SequencesScreen,
  replies: RepliesScreen,
  bounces: BouncesScreen,
  reports: ReportsBridge,
  tasks: TasksBridge,
  'prompt-templates': PromptTemplatesBridge,
  audit: AuditScreen,
  settings: SettingsScreen,
  // Phase 7.5: Intelligence Fabric
  'intelligence-sources': IntelligenceSourcesScreen,
  'intelligence-knowledge': IntelligenceKnowledgeScreen,
};

const SCREEN_LABELS: Record<string, string> = {};
NAV_SECTIONS.forEach(s => s.items.forEach(i => { SCREEN_LABELS[i.key] = i.label; }));

const PIPELINE_STAGES = [
  { key: 'import', label: 'Import' },
  { key: 'leads', label: 'Accounts' },
  { key: 'drafts', label: 'Drafts' },
  { key: 'queue', label: 'Queue' },
  { key: 'replies', label: 'Replies' },
  { key: 'bounces', label: 'Bounced' },
];

/* ═══════════════════════════════════════════════════
   Screen-level error boundary
   ═══════════════════════════════════════════════════ */

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

/* ═══════════════════════════════════════════════════════════════
   App Shell
   ═══════════════════════════════════════════════════════════════ */

function getTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return `${Math.floor(days / 7)}w`;
}

function AppShell({ onLogout }: { onLogout: () => void }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeScreen, setActiveScreen] = useState('command-center');
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [stageCounts, setStageCounts] = useState<Record<string, number>>({});
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const [aiChatOpen, setAiChatOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Array<{id:string;title:string;message:string;type:string;icon:string;createdAt:string;link:string|null}>>([]);

  // URL hash sync for bookmarkability + browser back/forward
  useEffect(() => {
    const syncHash = () => {
      const hash = window.location.hash.replace('#', '');
      if (hash && SCREEN_MAP[hash] && hash !== activeScreen) {
        setSelectedCompanyId(null);
        setSelectedContactId(null);
        setActiveScreen(hash);
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

  // Listen for sub-view changes from useAppStore (dormant screens)
  useEffect(() => {
    const unsub = useAppStore.subscribe((state, prev) => {
      // If a dormant screen navigated to contact-profile
      if (state.selectedContactId && state.selectedContactId !== prev.selectedContactId) {
        setSelectedContactId(state.selectedContactId);
      }
      // If a dormant screen navigated to company-profile
      if (state.selectedCompanyId && state.selectedCompanyId !== prev.selectedCompanyId && !selectedCompanyId) {
        setSelectedCompanyId(state.selectedCompanyId);
      }
    });
    return unsub;
  }, [selectedCompanyId]);

  // Fetch pipeline counts
  useEffect(() => {
    const fetchCounts = () => {
      fetch('/api/dashboard')
        .then(res => res.json())
        .then((data) => {
          setStageCounts({
            import: data.importedCount ?? 0,
            leads: data.totalLeads ?? 0,
            drafts: data.draftCount ?? 0,
            queue: data.queueCount ?? 0,
            replies: data.replyCount ?? 0,
            bounces: data.bounceCount ?? 0,
          });
        })
        .catch(() => {});
    };
    fetchCounts();
    const interval = setInterval(fetchCounts, 30000); // refresh every 30s
    return () => clearInterval(interval);
  }, []);

  // Fetch notifications
  useEffect(() => {
    const fetchNotifications = () => {
      fetch('/api/notifications')
        .then(res => res.json())
        .then((data) => { if (Array.isArray(data)) setNotifications(data.slice(0, 8)); })
        .catch(() => {});
    };
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, []);

  // Handle navigation
  const navigateTo = (screen: string, companyId?: string) => {
    if (companyId) {
      setSelectedCompanyId(companyId);
    } else {
      setSelectedCompanyId(null);
      setSelectedContactId(null);
      setActiveScreen(screen);
    }
    setSidebarOpen(false);
  };

  const handleNavClick = useCallback((key: string) => {
    setSelectedCompanyId(null);
    setSelectedContactId(null);
    setActiveScreen(key);
    setSidebarOpen(false);
  }, []);

  const toggleSection = (heading: string) => {
    setCollapsedSections(prev => ({ ...prev, [heading]: !prev[heading] }));
  };

  const LazyComponent = SCREEN_MAP[activeScreen] || DashboardScreen;
  const activeLabel = SCREEN_LABELS[activeScreen] || 'DeepMindQ';

  // Breadcrumb trail
  const breadcrumbs = [
    ...(selectedCompanyId
      ? [{ label: 'Companies', key: 'companies' }, { label: 'Company Detail' }]
      : selectedContactId
      ? [{ label: 'Contacts', key: 'contacts' }, { label: 'Contact Detail' }]
      : [{ label: activeLabel }]),
  ];

  /* ── Design tokens via CSS vars (light theme) ── */
  const styles = {
    sidebarBg: 'var(--sidebar-glass, rgba(255, 255, 255, 0.85))',
    headerBg: 'var(--header-glass, rgba(255, 255, 255, 0.8))',
    border: 'var(--border-subtle, #E5E7EB)',
    gold: 'var(--color-gold)',
    goldLight: 'var(--color-gold-bright)',
    goldDim: 'var(--color-gold-dim)',
    textDim: 'var(--text-dim, #9CA3AF)',
    textMuted: 'var(--color-muted-foreground)',
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex">
      <Toaster theme="light" position="top-right" />

      {/* Command Palette (⌘K) */}
      <CommandPalette />

      {/* AI Chat Sidebar */}
      <AiChatSidebar isOpen={aiChatOpen} onClose={() => setAiChatOpen(false)} />
      {/* AI Chat FAB — visible on small screens */}
      <div className="md:hidden">
        <AiChatButton isOpen={aiChatOpen} onToggle={() => setAiChatOpen(!aiChatOpen)} />
      </div>

      {/* Sidebar Overlay (mobile) */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* ── Sidebar ── */}
      <aside
        className={`fixed lg:sticky top-0 left-0 z-50 h-screen w-[232px] flex flex-col shrink-0 transition-transform duration-300 ease-out ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
        style={{
          background: styles.sidebarBg,
          backdropFilter: 'blur(24px) saturate(1.5)',
          borderRight: `1px solid ${styles.border}`,
        }}
      >
        {/* Logo */}
        <div className="h-14 flex items-center gap-2.5 px-4 border-b shrink-0" style={{ borderColor: styles.border }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt="DeepMindQ"
            className="h-7 w-auto object-contain rounded"
          />
        </div>

        {/* Nav Items */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 scrollbar-hide">
          {NAV_SECTIONS.map(section => {
            const isCollapsed = collapsedSections[section.heading] ?? !section.defaultOpen;
            return (
              <div key={section.heading} className="mb-0.5">
                {/* Section header — collapsible */}
                <button
                  onClick={() => toggleSection(section.heading)}
                  className="w-full flex items-center gap-1.5 px-3 pt-4 pb-1.5 group"
                >
                  <span
                    className="text-[10px] uppercase tracking-[0.18em] font-semibold flex-1 text-left"
                    style={{ color: styles.textDim }}
                  >
                    {section.heading}
                  </span>
                  <ChevronDown
                    className={`w-3 h-3 transition-transform duration-200 ${isCollapsed ? '-rotate-90' : ''}`}
                    style={{ color: styles.textDim }}
                  />
                </button>

                {/* Nav items */}
                {!isCollapsed && (
                  <div className="space-y-0.5 pb-2">
                    {section.items.map(item => {
                      const Icon = item.icon;
                      const isActive = activeScreen === item.key;
                      const count = stageCounts[item.key];
                      return (
                        <motion.button
                          key={item.key}
                          onClick={() => handleNavClick(item.key)}
                          whileTap={{ scale: 0.97 }}
                          className="w-full flex items-center gap-2.5 px-3 py-[7px] rounded-lg text-[13px] relative transition-all duration-200"
                          style={
                            isActive
                              ? { background: 'color-mix(in oklch, var(--color-gold) 12%, transparent)', color: 'var(--color-gold)' }
                              : { color: 'var(--color-muted-foreground)' }
                          }
                          onMouseEnter={(e) => {
                            if (!isActive) (e.currentTarget as HTMLElement).style.background = '#F3F4F6';
                          }}
                          onMouseLeave={(e) => {
                            if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent';
                          }}
                        >
                          {isActive && (
                            <motion.div
                              layoutId="nav-active"
                              className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full"
                              style={{ background: 'var(--color-gold)' }}
                              transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                            />
                          )}
                          <Icon className={`w-4 h-4 shrink-0 transition-colors duration-200 ${isActive ? '' : 'opacity-50'}`} />
                          <span className="flex-1 text-left truncate">{item.label}</span>
                          {count !== undefined && count > 0 && (
                            <span
                              className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full min-w-[20px] text-center tabular-nums"
                              style={{
                                background: isActive ? 'color-mix(in oklch, var(--color-gold) 15%, transparent)' : '#F3F4F6',
                                color: isActive ? 'var(--color-gold)' : 'var(--color-muted-foreground)',
                              }}
                            >
                              {count >= 1000 ? `${(count / 1000).toFixed(1)}k` : count}
                            </span>
                          )}
                        </motion.button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Pipeline Progress */}
        <div className="px-3 py-3 border-t" style={{ borderColor: styles.border }}>
          <div className="flex items-center justify-between px-0.5 mb-2.5">
            <span className="text-[10px] uppercase tracking-[0.18em] font-semibold" style={{ color: styles.textDim }}>Pipeline</span>
          </div>
          <div className="flex items-center justify-between px-1">
            {PIPELINE_STAGES.map((stage, i) => {
              const count = stageCounts[stage.key] ?? 0;
              const isActive = activeScreen === stage.key;
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
                        className="absolute -top-0.5 w-4 h-4 rounded-full"
                        style={{ background: 'color-mix(in oklch, var(--color-gold) 20%, transparent)' }}
                        animate={{ scale: [1, 1.8, 1], opacity: [0.3, 0, 0.3] }}
                        transition={{ duration: 2.5, repeat: Infinity, delay: i * 0.3 }}
                      />
                    )}
                    <div
                      className={`w-3 h-3 rounded-full transition-all duration-300 ${isActive ? 'ring-2 ring-offset-1' : ''}`}
                      style={{
                        background: hasItems ? 'linear-gradient(135deg, var(--color-gold), var(--color-gold-bright))' : 'rgba(0,0,0,0.08)',
                        boxShadow: hasItems ? '0 0 8px color-mix(in oklch, var(--color-gold) 30%, transparent)' : 'none',
                        ...(isActive ? { '--tw-ring-color': 'var(--color-gold)' } as React.CSSProperties : {}),
                      }}
                    />
                    <span
                      className="text-[8px] leading-none font-medium transition-colors"
                      style={{ color: isActive ? 'var(--color-gold)' : styles.textDim }}
                    >
                      {stage.label}
                    </span>
                  </motion.button>
                  {i < PIPELINE_STAGES.length - 1 && (
                    <div
                      className="w-full h-px mx-1 mb-3 shrink-0"
                      style={{ background: 'linear-gradient(90deg, color-mix(in oklch, var(--color-gold) 12%, transparent), #F3F4F6)' }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* User Section */}
        <div className="p-3 border-t shrink-0" style={{ borderColor: styles.border }}>
          <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg transition-colors duration-200 hover:bg-gray-50">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
              style={{ background: 'linear-gradient(135deg, var(--color-gold), var(--color-gold-dim))', boxShadow: '0 0 12px color-mix(in oklch, var(--color-gold) 20%, transparent)' }}
            >
              RS
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-foreground truncate">Ravi Shanker</p>
              <p className="text-[10px]" style={{ color: styles.textDim }}>Enterprise Sales Leader</p>
            </div>
            <motion.button
              onClick={onLogout}
              className="p-1.5 rounded-md transition-colors duration-200 hover:bg-red-500/10"
              style={{ color: styles.textDim }}
              whileHover={{ color: '#EF4444' }}
              title="Sign out"
            >
              <LogOut className="w-3.5 h-3.5" />
            </motion.button>
          </div>
        </div>
      </aside>

      {/* ── Main Content ── */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Header */}
        <header
          className="sticky top-0 z-30 h-14 flex items-center px-4 sm:px-6 shrink-0 border-b"
          style={{
            background: styles.headerBg,
            backdropFilter: 'blur(20px) saturate(1.5)',
            borderColor: styles.border,
          }}
        >
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <motion.button
              className="lg:hidden p-1 rounded-md shrink-0"
              style={{ color: styles.textMuted }}
              onClick={() => setSidebarOpen(!sidebarOpen)}
              whileTap={{ scale: 0.9 }}
            >
              {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </motion.button>
            {/* Breadcrumbs */}
            <nav className="flex items-center gap-1.5 min-w-0">
              {breadcrumbs.map((crumb, i) => (
                <span key={i} className="flex items-center gap-1.5 min-w-0">
                  {i > 0 && <ChevronRight className="w-3 h-3 shrink-0" style={{ color: styles.textDim }} />}
                  {crumb.key ? (
                    <button
                      onClick={() => handleNavClick(crumb.key)}
                      className="text-xs font-medium transition-colors hover:text-[var(--color-gold)] truncate"
                      style={{ color: styles.textMuted }}
                    >
                      {crumb.label}
                    </button>
                  ) : (
                    <span className="text-sm font-semibold text-foreground tracking-tight truncate">{crumb.label}</span>
                  )}
                </span>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {/* AI Chat FAB — visible on md+ screens */}
            <motion.button
              className="hidden md:flex p-2 rounded-lg transition-colors duration-200 hover:bg-gray-100"
              style={{ color: aiChatOpen ? 'var(--color-gold)' : styles.textDim }}
              whileHover={{ color: styles.textMuted }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setAiChatOpen(!aiChatOpen)}
              title="AI Assistant"
            >
              <Sparkles className="w-4 h-4" />
            </motion.button>
            {/* Notifications */}
            <div className="relative">
              <motion.button
                className="p-2 rounded-lg transition-colors duration-200 hover:bg-gray-100 relative"
                style={{ color: notificationsOpen ? 'var(--color-gold)' : styles.textDim }}
                whileHover={{ color: styles.textMuted }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setNotificationsOpen(!notificationsOpen)}
                title="Notifications"
              >
                <Bell className="w-4 h-4" />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full" style={{ background: 'var(--color-gold)' }} />
              </motion.button>
              {/* Notification dropdown */}
              <AnimatePresence>
                {notificationsOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setNotificationsOpen(false)} />
                    <motion.div
                      initial={{ opacity: 0, y: -4, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -4, scale: 0.97 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 top-full mt-2 w-72 rounded-xl border z-50 overflow-hidden"
                      style={{
                        background: 'var(--surface-glass-heavy)',
                        backdropFilter: 'blur(24px)',
                        borderColor: 'var(--border-subtle)',
                      }}
                    >
                      <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                        <h3 className="text-xs font-semibold text-foreground">Notifications</h3>
                      </div>
                      <div className="py-1 max-h-80 overflow-y-auto">
                        {notifications.length > 0 ? notifications.map((notif, i) => {
                          const iconColor = notif.type === 'signal' ? 'text-blue-500 bg-blue-50' :
                            notif.type === 'reply' ? 'text-emerald-500 bg-emerald-50' :
                            notif.type === 'feature' ? 'text-[var(--color-gold)]' : 'text-gray-500 bg-gray-50';
                          const NotifIcon = notif.icon === 'Radar' ? Radar :
                            notif.icon === 'Mail' ? Mail :
                            notif.icon === 'Brain' ? Brain :
                            notif.icon === 'BookOpen' ? BookOpen :
                            notif.icon === 'Sparkles' ? Sparkles : Activity;
                          const timeAgo = getTimeAgo(notif.createdAt);
                          return (
                            <div key={notif.id} className="px-4 py-2.5 flex items-start gap-3 hover:bg-gray-50 transition-colors cursor-pointer"
                              onClick={() => { if (notif.link) { window.location.hash = notif.link.replace('#', ''); } setNotificationsOpen(false); }}>
                              <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${iconColor}`}>
                                <NotifIcon className="w-3.5 h-3.5" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-medium text-foreground truncate">{notif.title}</p>
                                <p className="text-[11px] mt-0.5 truncate" style={{ color: styles.textDim }}>{notif.message}</p>
                              </div>
                              <span className="text-[10px] shrink-0 mt-0.5" style={{ color: styles.textDim }}>{timeAgo}</span>
                            </div>
                          );
                        }) : (
                          <div className="px-4 py-6 text-center">
                            <Bell className="w-6 h-6 mx-auto mb-2 text-gray-300" />
                            <p className="text-xs text-muted-foreground">No notifications yet</p>
                          </div>
                        )}
                      </div>
                      <div className="px-4 py-2.5 border-t text-center" style={{ borderColor: 'var(--border-subtle)' }}>
                        <button
                          onClick={() => { setNotificationsOpen(false); handleNavClick('audit'); }}
                          className="text-[11px] font-medium text-[var(--color-gold)] hover:underline"
                        >
                          View all activity
                        </button>
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
            <motion.button
              className="p-2 rounded-lg transition-colors duration-200 hover:bg-gray-100"
              style={{ color: styles.textDim }}
              whileHover={{ color: styles.textMuted }}
              whileTap={{ scale: 0.9 }}
              title="Refresh data"
              onClick={() => {
                fetch('/api/dashboard')
                  .then(res => res.json())
                  .then((data) => {
                    setStageCounts({
                      import: data.importedCount ?? 0,
                      leads: data.totalLeads ?? 0,
                      drafts: data.draftCount ?? 0,
                      queue: data.queueCount ?? 0,
                      replies: data.replyCount ?? 0,
                      bounces: data.bounceCount ?? 0,
                    });
                  })
                  .catch(() => {});
              }}
            >
              <RefreshCw className="w-4 h-4" />
            </motion.button>
          </div>
        </header>

        {/* Screen Content */}
        <main className="flex-1 p-4 sm:p-6">
          {/* Company Detail (overlay) */}
          {selectedCompanyId ? (
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
                    navigateTo={navigateTo}
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

/* ═══════════════════════════════════════════════════
   Root Page — toggles between Login and App
   ═══════════════════════════════════════════════════ */
export default function HomePage() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [checking, setChecking] = useState(true);

  // Check session on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const res = await fetch('/api/auth/me', { signal: controller.signal });
        clearTimeout(timeout);
        if (res.ok && !cancelled) {
          setLoggedIn(true);
        }
      } catch {
        // Not authenticated — show landing
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleLogin = async () => {
    // Verify session actually exists before showing dashboard
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        setLoggedIn(true);
        window.location.hash = '#command-center';
        return;
      }
    } catch { /* fall through */ }
    // Session not found — stay on login
    setLoggedIn(false);
  };

  const handleLogout = async () => {
    try {
      const res = await fetch('/api/auth/logout', { method: 'POST' });
      if (res.ok) {
        // Successfully logged out
        document.cookie = 'dmq_session=; path=/; max-age=0';
        window.location.replace('/');
        return;
      }
    } catch { /* fall through */ }
    // Force-clear cookie as fallback
    document.cookie = 'dmq_session=; path=/; max-age=0';
    window.location.replace('/');
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0a0c10' }}>
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  if (!loggedIn) {
    return <LandingPage onLogin={handleLogin} />;
  }

  return (
    <ErrorBoundary>
      <QueryProvider>
        <AppShell onLogout={handleLogout} />
      </QueryProvider>
    </ErrorBoundary>
  );
}