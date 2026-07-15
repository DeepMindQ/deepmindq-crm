'use client';

import { useState, useEffect, lazy, Suspense, Component, type ReactNode } from 'react';
import { Toaster } from '@/components/ui/sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { PageTransition } from '@/components/ui/animated-components';

import {
  LayoutDashboard, Upload, Users, Building2, FileText, Send,
  Archive, Mail, XCircle, RefreshCw, Menu, X,
  Brain, GitBranch, ScrollText, Settings, LogOut, BarChart3, Bell,
  LayoutTemplate, Layers, AlertTriangle, Loader2, Sparkles, Network,
  UserPlus, Target, FileBarChart, Code2, Copy, ClipboardList, Kanban, MailPlus,
  ChevronDown,
} from 'lucide-react';

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
    heading: 'AI COMMAND',
    defaultOpen: true,
    items: [
      { key: 'command-center', label: 'Command Center', icon: Sparkles },
      { key: 'mind-map', label: 'Company Mind Map', icon: Network },
    ],
  },
  {
    heading: 'WORKSPACE',
    defaultOpen: true,
    items: [
      { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { key: 'pipeline', label: 'Pipeline', icon: GitBranch },
      { key: 'analytics', label: 'Analytics', icon: BarChart3 },
    ],
  },
  {
    heading: 'PEOPLE',
    defaultOpen: true,
    items: [
      { key: 'contacts', label: 'Contacts', icon: Users },
      { key: 'companies', label: 'Companies', icon: Building2 },
      { key: 'opportunities', label: 'Opportunities', icon: Target },
    ],
  },
  {
    heading: 'OPERATIONS',
    defaultOpen: true,
    items: [
      { key: 'import', label: 'Import', icon: Upload },
      { key: 'leads', label: 'Leads', icon: Layers },
      { key: 'segments', label: 'Segments', icon: Kanban },
      { key: 'duplicates', label: 'Duplicates', icon: Copy },
      { key: 'capabilities', label: 'Capability Library', icon: Archive },
      { key: 'knowledge', label: 'Knowledge Engine', icon: Brain },
    ],
  },
  {
    heading: 'OUTREACH',
    defaultOpen: true,
    items: [
      { key: 'email-generation', label: 'Email Generator', icon: MailPlus },
      { key: 'drafts', label: 'Drafts', icon: FileText },
      { key: 'queue', label: 'Send Queue', icon: Send },
      { key: 'templates', label: 'Templates', icon: LayoutTemplate },
      { key: 'sequences', label: 'Sequences', icon: GitBranch },
      { key: 'replies', label: 'Replies', icon: Mail },
      { key: 'bounces', label: 'Bounces & Suppressions', icon: XCircle },
    ],
  },
  {
    heading: 'INSIGHTS',
    defaultOpen: false,
    items: [
      { key: 'reports', label: 'Reports', icon: FileBarChart },
      { key: 'tasks', label: 'Tasks', icon: ClipboardList },
      { key: 'prompt-templates', label: 'AI Prompts', icon: Code2 },
    ],
  },
  {
    heading: 'SYSTEM',
    defaultOpen: false,
    items: [
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
  'command-center': CommandCenterScreen,
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
};

const SCREEN_LABELS: Record<string, string> = {};
NAV_SECTIONS.forEach(s => s.items.forEach(i => { SCREEN_LABELS[i.key] = i.label; }));

const PIPELINE_STAGES = [
  { key: 'import', label: 'Import' },
  { key: 'leads', label: 'Leads' },
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
            className="px-4 py-2 text-xs font-medium rounded-lg bg-white/5 border border-white/10 text-muted-foreground hover:bg-white/10 hover:text-foreground transition-colors"
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
    <div className="flex items-center justify-center py-24">
      <Loader2 className="w-6 h-6 animate-spin text-primary/50" />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   App Shell
   ═══════════════════════════════════════════════════════════════ */

function AppShell({ onLogout }: { onLogout: () => void }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeScreen, setActiveScreen] = useState('command-center');
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [stageCounts, setStageCounts] = useState<Record<string, number>>({});
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

  // URL hash sync for bookmarkability
  useEffect(() => {
    const hash = window.location.hash.replace('#', '');
    if (hash && SCREEN_MAP[hash]) {
      setActiveScreen(hash);
    }
  }, []);

  useEffect(() => {
    window.location.hash = activeScreen;
    document.title = `${SCREEN_LABELS[activeScreen] || 'DeepMindQ'} — DeepMindQ`;
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

  const handleNavClick = (key: string) => {
    setSelectedCompanyId(null);
    setSelectedContactId(null);
    setActiveScreen(key);
    setSidebarOpen(false);
  };

  const toggleSection = (heading: string) => {
    setCollapsedSections(prev => ({ ...prev, [heading]: !prev[heading] }));
  };

  const LazyComponent = SCREEN_MAP[activeScreen] || DashboardScreen;
  const activeLabel = SCREEN_LABELS[activeScreen] || 'DeepMindQ';

  /* ── Design tokens via CSS vars (no more inline gold/constants) ── */
  const styles = {
    sidebarBg: 'var(--sidebar-glass, rgba(8, 10, 18, 0.92))',
    headerBg: 'var(--header-glass, rgba(8, 10, 18, 0.75))',
    border: 'var(--border-subtle, rgba(255,255,255,0.06))',
    gold: 'var(--color-gold)',
    goldLight: 'var(--color-gold-bright)',
    goldDim: 'var(--color-gold-dim)',
    textDim: 'var(--text-dim, #4A5568)',
    textMuted: 'var(--color-muted-foreground)',
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex">
      <Toaster theme="dark" position="top-right" />

      {/* Sidebar Overlay (mobile) */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
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
                            if (!isActive) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)';
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
                                background: isActive ? 'color-mix(in oklch, var(--color-gold) 20%, transparent)' : 'rgba(255,255,255,0.05)',
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
                        background: hasItems ? 'linear-gradient(135deg, var(--color-gold), var(--color-gold-bright))' : 'rgba(113,113,122,0.2)',
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
                      style={{ background: 'linear-gradient(90deg, color-mix(in oklch, var(--color-gold) 12%, transparent), rgba(113,113,122,0.08))' }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* User Section */}
        <div className="p-3 border-t shrink-0" style={{ borderColor: styles.border }}>
          <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg transition-colors duration-200 hover:bg-white/[0.03]">
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
          <div className="flex items-center gap-3 flex-1">
            <motion.button
              className="lg:hidden p-1 rounded-md"
              style={{ color: styles.textMuted }}
              onClick={() => setSidebarOpen(!sidebarOpen)}
              whileTap={{ scale: 0.9 }}
            >
              {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </motion.button>
            <h1 className="text-sm font-semibold text-foreground tracking-tight">{activeLabel}</h1>
          </div>
          <div className="flex items-center gap-1">
            <motion.button
              className="p-2 rounded-lg transition-colors duration-200 hover:bg-white/5 relative"
              style={{ color: styles.textDim }}
              whileHover={{ color: styles.textMuted }}
              whileTap={{ scale: 0.9 }}
              title="Notifications"
            >
              <Bell className="w-4 h-4" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full" style={{ background: 'var(--color-gold)' }} />
            </motion.button>
            <motion.button
              className="p-2 rounded-lg transition-colors duration-200 hover:bg-white/5"
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
   Root Page — toggles between Landing and App
   ═══════════════════════════════════════════════════ */
export default function HomePage() {
  const [loggedIn, setLoggedIn] = useState(false);

  // Restore login state from sessionStorage
  useEffect(() => {
    if (sessionStorage.getItem('dmq_logged_in') === '1') {
      setLoggedIn(true);
    }
  }, []);

  const handleLogin = () => {
    sessionStorage.setItem('dmq_logged_in', '1');
    setLoggedIn(true);
    window.location.hash = '#command-center';
  };

  const handleLogout = () => {
    sessionStorage.removeItem('dmq_logged_in');
    setLoggedIn(false);
    window.location.hash = '';
    window.location.replace('/');
  };

  if (!loggedIn) {
    return <LandingPage onLogin={handleLogin} />;
  }

  return <AppShell onLogout={handleLogout} />;
}