'use client';

import { useState } from 'react';
import { Toaster } from '@/components/ui/sonner';
import {
  LayoutDashboard, Upload, Users, Building2, FileText, Send,
  Archive, Mail, MailX, Sparkles, RefreshCw, Menu, X,
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

const NAV_ITEMS = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'import', label: 'Import', icon: Upload },
  { key: 'leads', label: 'Leads', icon: Users },
  { key: 'companies', label: 'Companies', icon: Building2 },
  { key: 'drafts', label: 'Drafts', icon: FileText },
  { key: 'queue', label: 'Send Queue', icon: Send },
  { key: 'capabilities', label: 'Capability Library', icon: Archive },
  { key: 'replies', label: 'Replies', icon: Mail },
  { key: 'bounces', label: 'Bounces & Suppressions', icon: MailX },
];

const SCREEN_MAP: Record<string, React.ComponentType> = {
  dashboard: DashboardScreen,
  import: ImportScreen,
  leads: LeadsScreen,
  companies: CompaniesScreen,
  drafts: DraftsScreen,
  queue: QueueScreen,
  capabilities: CapabilityScreen,
  replies: RepliesScreen,
  bounces: BouncesScreen,
};

export default function HomePage() {
  const [activeScreen, setActiveScreen] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const ActiveComponent = SCREEN_MAP[activeScreen] || DashboardScreen;
  const activeLabel = NAV_ITEMS.find(n => n.key === activeScreen)?.label || 'Dashboard';

  return (
    <div className="min-h-screen bg-background text-foreground flex">
      <Toaster theme="dark" position="top-right" />

      {/* ── Sidebar Overlay (mobile) ── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ── */}
      <aside className={`fixed lg:sticky top-0 left-0 z-50 h-screen w-56 bg-card border-r border-border flex flex-col shrink-0 transition-transform duration-200 ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      }`}>
        {/* Logo */}
        <div className="h-14 flex items-center gap-2.5 px-4 border-b border-border shrink-0">
          <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-primary-foreground" />
          </div>
          <div>
            <span className="font-semibold text-sm text-foreground">DeepMindQ</span>
          </div>
        </div>

        {/* Nav Items */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
          {NAV_ITEMS.map(item => {
            const Icon = item.icon;
            const isActive = activeScreen === item.key;
            return (
              <button
                key={item.key}
                onClick={() => { setActiveScreen(item.key); setSidebarOpen(false); }}
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
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-border shrink-0">
          <div className="flex items-center gap-2.5 px-2">
            <div className="w-7 h-7 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-primary text-xs font-semibold">
              RS
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-foreground truncate">Admin</p>
              <p className="text-[10px] text-muted-foreground">Operations</p>
            </div>
          </div>
        </div>
      </aside>

      {/* ── Main Content ── */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* ── Top Bar ── */}
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

        {/* ── Screen Content ── */}
        <main className="flex-1 p-4 sm:p-6">
          <ActiveComponent key={activeScreen} />
        </main>
      </div>
    </div>
  );
}