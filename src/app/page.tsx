'use client';

import { useState, useEffect } from 'react';
import { Toaster } from '@/components/ui/sonner';

import {
  LayoutDashboard, Upload, Users, Building2, FileText, Send,
  Archive, Mail, MailX, Sparkles, RefreshCw, Menu, X,
  Brain, GitBranch, ScrollText, Settings, LogOut, BarChart3,
} from 'lucide-react';
import LandingPage from '@/app/landing-page';
import DashboardScreen from '@/components/screens/dashboard-screen';
import ImportScreen from '@/components/screens/import-screen';
import LeadsScreen from '@/components/screens/leads-screen';
import CompaniesScreen from '@/components/screens/companies-screen';
import DraftsScreen from '@/components/screens/drafts-screen';
import QueueScreen from '@/components/screens/queue-screen';
import CapabilityScreen from '@/components/screens/capability-screen';
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
  leads: LeadsScreen,
  companies: CompaniesScreen,
  drafts: DraftsScreen,
  queue: QueueScreen,
  capabilities: CapabilityScreen,
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

  // Resolve active label from all sections
  const activeLabel = NAV_SECTIONS
    .flatMap(s => s.items)
    .find(n => n.key === activeScreen)?.label || 'Dashboard';

  const handleNavClick = (key: string) => {
    navigateTo(key);
    setSidebarOpen(false);
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex">
      <Toaster theme="dark" position="top-right" />

      {/* Sidebar Overlay (mobile) */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed lg:sticky top-0 left-0 z-50 h-screen w-56 bg-card border-r border-border flex flex-col shrink-0 transition-transform duration-200 ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      }`}>
        <div className="h-14 flex items-center gap-2.5 px-4 border-b border-border shrink-0">
          <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-semibold text-sm text-foreground">DeepMindQ</span>
        </div>

        <nav className="flex-1 overflow-y-auto py-3 px-2">
          {NAV_SECTIONS.map(section => (
            <div key={section.heading}>
              <div className="text-[10px] uppercase tracking-[0.15em] text-zinc-600 font-medium px-3 pt-4 pb-1">
                {section.heading}
              </div>
              <div className="space-y-0.5">
                {section.items.map(item => {
                  const Icon = item.icon;
                  const isActive = activeScreen === item.key;
                  return (
                    <button
                      key={item.key}
                      onClick={() => handleNavClick(item.key)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
                        isActive
                          ? 'bg-primary/15 text-primary font-medium'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Pipeline Progress Indicator */}
        <div className="px-3 py-3 border-t border-border">
          <div className="flex items-center justify-between px-0.5 mb-2">
            <span className="text-[10px] uppercase tracking-[0.12em] text-zinc-500 font-medium">Pipeline</span>
          </div>
          <div className="flex items-center gap-0 px-0.5">
            {PIPELINE_STAGES.map((stage, i) => {
              const count = stageCounts[stage.key] ?? 0;
              const isActive = activeScreen === stage.key;
              const hasItems = count > 0;
              return (
                <div key={stage.key} className="flex items-center">
                  <button
                    onClick={() => handleNavClick(stage.key)}
                    className="flex flex-col items-center gap-0.5 group"
                    title={`${stage.label}: ${count}`}
                  >
                    <div
                      className={`w-3.5 h-3.5 rounded-full transition-all ${
                        isActive
                          ? 'ring-2 ring-offset-1 ring-offset-card'
                          : ''
                      }`}
                      style={{
                        backgroundColor: hasItems ? '#b89068' : 'rgba(113,113,122,0.25)',
                        ...(isActive ? { '--tw-ring-color': '#b89068' } as React.CSSProperties : {}),
                      }}
                    />
                    <span
                      className={`text-[8px] leading-none transition-colors ${
                        isActive ? 'text-primary font-semibold' : 'text-zinc-500'
                      }`}
                    >
                      {stage.label}
                    </span>
                  </button>
                  {i < PIPELINE_STAGES.length - 1 && (
                    <div
                      className="w-2.5 h-px mx-0.5 mb-3 shrink-0"
                      style={{ backgroundColor: 'rgba(113,113,122,0.2)' }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* User Section */}
        <div className="p-3 border-t border-border shrink-0">
          <div className="flex items-center gap-2.5 px-2">
            <div className="w-7 h-7 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-primary text-xs font-semibold">
              RS
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-foreground truncate">Ravi Shanker</p>
              <p className="text-[10px] text-muted-foreground">Enterprise Sales Leader</p>
            </div>
            <button
              onClick={onLogout}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-red-400 transition-colors"
              title="Sign out"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-border h-14 flex items-center px-4 sm:px-6 shrink-0">
          <div className="flex items-center gap-3 flex-1">
            <button
              className="lg:hidden text-muted-foreground hover:text-foreground"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <h1 className="text-sm font-semibold text-foreground">{activeLabel}</h1>
          </div>
          <button className="text-muted-foreground hover:text-foreground transition-colors" title="Refresh">
            <RefreshCw className="w-4 h-4" />
          </button>
        </header>

        <main className="flex-1 p-4 sm:p-6">
          <ActiveComponent key={activeScreen} navigateTo={navigateTo} />
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