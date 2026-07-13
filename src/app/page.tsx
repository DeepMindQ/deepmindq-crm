'use client';

import { useState, useEffect } from 'react';
import { Toaster } from '@/components/ui/sonner';
import { motion, AnimatePresence } from 'framer-motion';

import {
  LayoutDashboard, Upload, Users, Building2, FileText, Send,
  Archive, Mail, MailX, RefreshCw, Menu, X,
  Brain, GitBranch, ScrollText, Settings, LogOut, BarChart3, Bell, Cpu,
} from 'lucide-react';
import LandingPage from '@/app/landing-page';
import { PageTransition } from '@/components/ui/animated-components';
import DashboardScreen from '@/components/screens/dashboard-screen';
import ImportScreen from '@/components/screens/import-screen';
import LeadsScreen from '@/components/screens/leads-screen';
import CompaniesScreen from '@/components/screens/companies-screen';
import DraftsScreen from '@/components/screens/drafts-screen';
import QueueScreen from '@/components/screens/queue-screen';
import CapabilityScreen from '@/components/screens/capability-screen';
import KnowledgeLibraryScreen from '@/components/screens/knowledge-library-screen';
import RepliesScreen from '@/components/screens/replies-screen';
import BouncesScreen from '@/components/screens/bounces-screen';
import PipelineScreen from '@/components/screens/pipeline-screen';
import AnalyticsScreen from '@/components/screens/analytics-screen';
import AuditScreen from '@/components/screens/audit-screen';
import SettingsScreen from '@/components/screens/settings-screen';

/* ═══════════════════════════════════════════════════
   App Shell (after login)
   ═══════════════════════════════════════════════════ */

const NAV_SECTIONS = [
  {
    heading: 'WORKSPACE',
    items: [
      { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { key: 'pipeline', label: 'Pipeline', icon: GitBranch },
      { key: 'analytics', label: 'Analytics', icon: BarChart3 },
    ],
  },
  {
    heading: 'OPERATIONS',
    items: [
      { key: 'import', label: 'Import', icon: Upload },
      { key: 'leads', label: 'Leads', icon: Users },
      { key: 'companies', label: 'Companies', icon: Building2 },
      { key: 'capabilities', label: 'Capability Library', icon: Archive },
      { key: 'knowledge', label: 'Knowledge Engine', icon: Brain },
    ],
  },
  {
    heading: 'OUTREACH',
    items: [
      { key: 'drafts', label: 'Drafts', icon: FileText },
      { key: 'queue', label: 'Send Queue', icon: Send },
      { key: 'replies', label: 'Replies', icon: Mail },
      { key: 'bounces', label: 'Bounces & Suppressions', icon: MailX },
    ],
  },
  {
    heading: 'SYSTEM',
    items: [
      { key: 'audit', label: 'Audit Log', icon: ScrollText },
      { key: 'settings', label: 'Settings', icon: Settings },
    ],
  },
];

const SCREEN_MAP: Record<string, React.ComponentType<{ navigateTo?: (screen: string) => void }>> = {
  dashboard: DashboardScreen,
  import: ImportScreen,
  knowledge: 0,
  leads: LeadsScreen,
  companies: CompaniesScreen,
  drafts: DraftsScreen,
  queue: QueueScreen,
  capabilities: CapabilityScreen,
  knowledge: KnowledgeLibraryScreen,
  replies: RepliesScreen,
  bounces: BouncesScreen,
  pipeline: PipelineScreen,
  analytics: AnalyticsScreen,
  audit: AuditScreen,
  settings: SettingsScreen,
};

const PIPELINE_STAGES = [
  { key: 'import', label: 'Import' },
  { key: 'leads', label: 'Leads' },
  { key: 'drafts', label: 'Drafts' },
  { key: 'queue', label: 'Queue' },
  { key: 'replies', label: 'Replies' },
  { key: 'bounces', label: 'Bounced' },
];

function AppShell({ onLogout, navigateTo, activeScreen }: { onLogout: () => void; navigateTo: (screen: string) => void; activeScreen: string }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [stageCounts, setStageCounts] = useState<Record<string, number>>({});

  useEffect(() => {
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
  }, []);

  const ActiveComponent = SCREEN_MAP[activeScreen] || DashboardScreen;
  const activeLabel = NAV_SECTIONS
    .flatMap(s => s.items)
    .find(n => n.key === activeScreen)?.label || 'Dashboard';

  const handleNavClick = (key: string) => {
    navigateTo(key);
    setSidebarOpen(false);
  };

  const gold = '#D4AF37';
  const goldLight = '#E8C860';
  const border = 'rgba(255,255,255,0.06)';
  const textDim = '#3A4555';
  const textMuted = '#7A8699';

  return (
    <div className="min-h-screen bg-background text-foreground flex">
      <Toaster theme="dark" position="top-right" />

      {/* Sidebar Overlay (mobile) - animated */}
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

      {/* Sidebar - Glassmorphism */}
      <aside
        className={`fixed lg:sticky top-0 left-0 z-50 h-screen w-56 flex flex-col shrink-0 transition-transform duration-300 ease-out ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
        style={{
          background: 'rgba(8, 10, 18, 0.88)',
          backdropFilter: 'blur(24px) saturate(1.5)',
          borderRight: `1px solid ${border}`,
        }}
      >
        {/* Logo */}
        <div className="h-14 flex items-center gap-2.5 px-4 border-b shrink-0" style={{ borderColor: border }}>
          <motion.div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: `linear-gradient(135deg, ${gold}, ${goldLight})` }}
            whileHover={{ scale: 1.05, rotate: 5 }}
          >
            <Brain className="w-4 h-4 text-white" />
          </motion.div>
          <span className="font-bold text-sm text-foreground tracking-tight">
            DeepMind<span style={{ color: gold }}>Q</span>
          </span>
        </div>

        {/* Nav Items */}
        <nav className="flex-1 overflow-y-auto py-4 px-2.5">
          {NAV_SECTIONS.map(section => (
            <div key={section.heading} className="mb-1">
              <div className="text-[10px] uppercase tracking-[0.2em] px-3 pt-5 pb-1.5 font-medium" style={{ color: textDim }}>
                {section.heading}
              </div>
              <div className="space-y-0.5">
                {section.items.map(item => {
                  const Icon = item.icon;
                  const isActive = activeScreen === item.key;
                  const count = stageCounts[item.key];
                  return (
                    <motion.button
                      key={item.key}
                      onClick={() => handleNavClick(item.key)}
                      whileTap={{ scale: 0.97 }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm relative transition-all duration-200"
                      style={
                        isActive
                          ? { background: 'rgba(212, 175, 55, 0.12)', color: gold }
                          : { color: textMuted }
                      }
                    >
                      {isActive && (
                        <motion.div
                          layoutId="nav-active"
                          className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full"
                          style={{ background: gold }}
                          transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                        />
                      )}
                      <Icon className={`w-4 h-4 shrink-0 transition-colors duration-200 ${isActive ? '' : 'opacity-60'}`} />
                      <span className="flex-1 text-left">{item.label}</span>
                      {count !== undefined && count > 0 && (
                        <span
                          className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full min-w-[20px] text-center"
                          style={{
                            background: isActive ? 'rgba(212, 175, 55, 0.2)' : 'rgba(255,255,255,0.05)',
                            color: isActive ? gold : textMuted,
                          }}
                        >
                          {count}
                        </span>
                      )}
                    </motion.button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Pipeline Progress - Enhanced */}
        <div className="px-4 py-4 border-t" style={{ borderColor: border }}>
          <div className="flex items-center justify-between px-0.5 mb-3">
            <span className="text-[10px] uppercase tracking-[0.2em] font-semibold" style={{ color: textDim }}>Pipeline</span>
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
                        style={{ background: 'rgba(212, 175, 55, 0.2)' }}
                        animate={{ scale: [1, 1.8, 1], opacity: [0.3, 0, 0.3] }}
                        transition={{ duration: 2.5, repeat: Infinity, delay: i * 0.3 }}
                      />
                    )}
                    <div
                      className={`w-3 h-3 rounded-full transition-all duration-300 ${isActive ? 'ring-2 ring-offset-1' : ''}`}
                      style={{
                        background: hasItems ? `linear-gradient(135deg, ${gold}, ${goldLight})` : 'rgba(113,113,122,0.2)',
                        boxShadow: hasItems ? `0 0 8px rgba(212, 175, 55, 0.3)` : 'none',
                        ...(isActive ? { '--tw-ring-color': gold } as React.CSSProperties : {}),
                      }}
                    />
                    <span
                      className="text-[8px] leading-none font-medium transition-colors"
                      style={{ color: isActive ? gold : textDim }}
                    >
                      {stage.label}
                    </span>
                  </motion.button>
                  {i < PIPELINE_STAGES.length - 1 && (
                    <div
                      className="w-full h-px mx-1 mb-3 shrink-0"
                      style={{ background: 'linear-gradient(90deg, rgba(212,175,55,0.12), rgba(113,113,122,0.08))' }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* User Section - Gradient avatar */}
        <div className="p-3 border-t shrink-0" style={{ borderColor: border }}>
          <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg transition-colors duration-200 hover:bg-white/[0.03]">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
              style={{ background: `linear-gradient(135deg, ${gold}, #9A8340)`, boxShadow: `0 0 12px rgba(212,175,55,0.2)` }}
            >
              RS
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-foreground truncate">Ravi Shanker</p>
              <p className="text-[10px]" style={{ color: textDim }}>Enterprise Sales Leader</p>
            </div>
            <motion.button
              onClick={onLogout}
              className="p-1.5 rounded-md transition-colors duration-200 hover:bg-red-500/10"
              style={{ color: textDim }}
              whileHover={{ color: '#EF4444' }}
              title="Sign out"
            >
              <LogOut className="w-3.5 h-3.5" />
            </motion.button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Header - Enhanced glassmorphism */}
        <header
          className="sticky top-0 z-30 h-14 flex items-center px-4 sm:px-6 shrink-0 border-b"
          style={{
            background: 'rgba(8, 10, 18, 0.7)',
            backdropFilter: 'blur(20px) saturate(1.5)',
            borderColor: border,
          }}
        >
          <div className="flex items-center gap-3 flex-1">
            <motion.button
              className="lg:hidden p-1 rounded-md"
              style={{ color: textMuted }}
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
              style={{ color: textDim }}
              whileHover={{ color: textMuted }}
              whileTap={{ scale: 0.9 }}
              title="Notifications"
            >
              <Bell className="w-4 h-4" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full" style={{ background: gold }} />
            </motion.button>
            <motion.button
              className="p-2 rounded-lg transition-colors duration-200 hover:bg-white/5"
              style={{ color: textDim }}
              whileHover={{ color: textMuted }}
              whileTap={{ scale: 0.9 }}
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </motion.button>
          </div>
        </header>

        {/* Screen Content with Page Transition */}
        <main className="flex-1 p-4 sm:p-6">
          <AnimatePresence mode="wait">
            <PageTransition key={activeScreen}>
              <ActiveComponent navigateTo={navigateTo} />
            </PageTransition>
          </AnimatePresence>
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
  const [activeScreen, setActiveScreen] = useState('dashboard');

  const handleLogout = () => {
    setLoggedIn(false);
    setActiveScreen('dashboard');
    window.history.replaceState(null, '', '/');
  };

  if (!loggedIn) {
    return <LandingPage onLogin={() => { setLoggedIn(true); window.history.replaceState(null, '', '/'); }} />;
  }

  return <AppShell onLogout={handleLogout} navigateTo={setActiveScreen} activeScreen={activeScreen} />;
}