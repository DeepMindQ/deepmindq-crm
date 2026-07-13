'use client';

import { useState, useEffect } from 'react';
import { Toaster } from '@/components/ui/sonner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  LayoutDashboard, Upload, Users, Building2, FileText, Send,
  Archive, Mail, MailX, Sparkles, RefreshCw, Menu, X,
  Eye, EyeOff, Building, UsersRound, Target, BookOpen, SendHorizontal, BarChart3,
  Brain, GitBranch, ScrollText, Settings, LogOut,
} from 'lucide-react';
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
   Landing Page
   ═══════════════════════════════════════════════════ */
function LandingPage({ onLogin }: { onLogin: () => void }) {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please enter your email and password.');
      return;
    }
    setError('');
    setLoading(true);
    // Simulate auth — in production this would hit a real auth endpoint
    setTimeout(() => {
      setLoading(false);
      onLogin();
    }, 800);
  };

  const FEATURES = [
    { icon: Building, title: 'Company Intelligence', desc: 'Deep company research & insights' },
    { icon: UsersRound, title: 'Contact Database', desc: 'Clean, deduplicated lead records' },
    { icon: Target, title: 'Opportunity Matcher', desc: 'AI-matched outreach angles' },
    { icon: BookOpen, title: 'Knowledge Base', desc: 'Curated capability library' },
    { icon: SendHorizontal, title: 'Email Assistant', desc: 'AI drafts, human approval' },
    { icon: BarChart3, title: 'Insights Dashboard', desc: 'Real-time operational metrics' },
  ];

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #080c14 0%, #0c1018 40%, #10141c 100%)' }}>

      {/* Background texture overlay */}
      <div className="absolute inset-0 opacity-[0.03]"
        style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.3) 1px, transparent 0)', backgroundSize: '32px 32px' }} />

      {/* ── Header ── */}
      <header className="relative z-10 flex items-center justify-between px-6 md:px-10 h-14 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #b89068, #d0a878)' }}>
            <Brain className="w-5 h-5 text-white" />
          </div>
          <span className="font-semibold text-white text-base tracking-tight">DeepMindQ</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
            style={{ background: 'linear-gradient(135deg, #b89068, #d0a878)', color: '#080c14' }}>
            RS
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-semibold text-white leading-tight">Ravi Shanker</p>
            <p className="text-[11px] text-zinc-500 leading-tight">Enterprise Sales Leader</p>
          </div>
        </div>
      </header>

      {/* ── Main Content ── */}
      <div className="relative z-10 flex-1 flex flex-col lg:flex-row items-center justify-center gap-12 lg:gap-20 px-6 md:px-10 py-8 lg:py-0">

        {/* Left: Welcome + Stats */}
        <div className="flex-1 max-w-lg space-y-8 text-center lg:text-left">
          <div className="space-y-3 fade-in">
            <p className="text-zinc-500 text-sm tracking-wide">Welcome back,</p>
            <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight leading-tight">
              Ravi Shanker
              <span className="block h-1 w-20 mt-2 mx-auto lg:mx-0 rounded-full"
                style={{ background: 'linear-gradient(90deg, #b89068, #d0a878)' }} />
            </h1>
            <p className="text-zinc-400 text-base leading-relaxed max-w-md mx-auto lg:mx-0">
              Your personal AI-powered workspace for enterprise sales intelligence.
            </p>
          </div>

          {/* Stats Row */}
          <div className="flex items-center justify-center lg:justify-start gap-8 slide-up">
            {[
              { icon: Building, value: '250K+', label: 'Companies' },
              { icon: Users, value: '3M+', label: 'Contacts' },
              { icon: Target, value: '1.2K+', label: 'Opportunities' },
            ].map(stat => (
              <div key={stat.label} className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ background: 'rgba(184, 144, 104, 0.12)' }}>
                  <stat.icon className="w-5 h-5" style={{ color: '#b89068' }} />
                </div>
                <div>
                  <p className="text-xl font-bold tabular-nums" style={{ color: '#c8a070' }}>{stat.value}</p>
                  <p className="text-xs text-zinc-500">{stat.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Login Form */}
        <div className="w-full max-w-sm slide-up" style={{ animationDelay: '0.1s' }}>
          <div className="rounded-xl p-6 md:p-8 border border-white/[0.06]"
            style={{ background: 'rgba(16, 20, 28, 0.8)', backdropFilter: 'blur(20px)' }}>
            <div className="space-y-1 mb-6">
              <h2 className="text-lg font-bold text-white">Access Your Workspace</h2>
              <p className="text-sm text-zinc-500">Enter your credentials to continue</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-sm text-zinc-300">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setError(''); }}
                  className="h-10 bg-white/[0.04] border-white/[0.08] text-white placeholder:text-zinc-600 focus:border-[#b89068] focus:ring-[#b89068]/20"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-sm text-zinc-300">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    value={password}
                    onChange={e => { setPassword(e.target.value); setError(''); }}
                    className="h-10 bg-white/[0.04] border-white/[0.08] text-white placeholder:text-zinc-600 pr-10 focus:border-[#b89068] focus:ring-[#b89068]/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="remember"
                  checked={remember}
                  onCheckedChange={(v) => setRemember(v === true)}
                  className="border-zinc-600 data-[state=checked]:bg-[#b89068] data-[state=checked]:border-[#b89068]"
                />
                <Label htmlFor="remember" className="text-sm text-zinc-500 cursor-pointer">Remember me</Label>
              </div>

              {error && (
                <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-md px-3 py-2">{error}</p>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-11 text-sm font-semibold rounded-md transition-all press-scale"
                style={{
                  background: loading ? '#8a7050' : 'linear-gradient(135deg, #b89068, #c8a070)',
                  color: '#080c14',
                }}
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-[#080c14] border-t-transparent rounded-full animate-spin" />
                ) : 'LOGIN'}
              </Button>
            </form>
          </div>
        </div>
      </div>

      {/* ── Features Bar ── */}
      <div className="relative z-10 border-t border-white/[0.04] mt-auto">
        <div className="px-6 md:px-10 py-8">
          <p className="text-center text-xs uppercase tracking-[0.2em] text-zinc-600 mb-6">Your Intelligence Workspace</p>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-6 max-w-3xl mx-auto">
            {FEATURES.map((f, i) => (
              <div key={f.title} className="flex flex-col items-center gap-2 text-center scale-in"
                style={{ animationDelay: `${i * 0.05}s` }}>
                <div className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ background: 'rgba(184, 144, 104, 0.08)' }}>
                  <f.icon className="w-5 h-5" style={{ color: '#b89068' }} />
                </div>
                <div>
                  <p className="text-xs font-semibold text-zinc-300">{f.title}</p>
                  <p className="text-[10px] text-zinc-600 mt-0.5 hidden sm:block">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Footer ── */}
      <footer className="relative z-10 text-center py-4 border-t border-white/[0.03]">
        <p className="text-xs font-semibold text-zinc-500">DeepMindQ</p>
        <p className="text-[10px] text-zinc-700 mt-0.5">Built for focus. Designed for results. Yours.</p>
      </footer>
    </div>
  );
}

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