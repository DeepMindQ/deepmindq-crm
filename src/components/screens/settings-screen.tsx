'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PageTransition,
  GlassPanel,
  SectionHeader,
  TabBar,
  ShimmerText,
  PulseDot,
} from '@/components/ui/animated-components';
import { ScreenBreadcrumb } from '@/components/shared/screen-breadcrumb';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import {
  Mail, Clock, ShieldCheck, Star, Ban, Plug, Database,
  Users, ShieldAlert, UserCircle,
} from 'lucide-react';
import DataRulesSection from './settings-data-rules';
import TeamPerformanceSection from './settings/team-performance-section';
import { ComplianceSection } from './settings/compliance-section';
import { ProfileTab } from './settings/profile-tab';
import { AiProvidersTab } from './settings/ai-providers-tab';
import { MailboxTab, WorkingHoursTab } from './settings/general-settings';
import { VerificationTab, ScoringTab, SuppressionTab } from './settings/quality-settings';

// ── Theme color opacity helpers ─────────────────────
const goldAlpha = (a: number) => `rgba(212,175,55,${a})`;
const greenAlpha = (a: number) => `rgba(16,185,129,${a})`;
const blackAlpha = (a: number) => `rgba(0,0,0,${a})`;

const SETTINGS_TABS = [
  { key: 'profile', label: 'My Profile' },
  { key: 'ai-providers', label: 'AI Providers' },
  { key: 'mailbox', label: 'Mailbox' },
  { key: 'hours', label: 'Working Hours' },
  { key: 'verification', label: 'Verification' },
  { key: 'scoring', label: 'Lead Scoring' },
  { key: 'data-rules', label: 'Data Rules' },
  { key: 'suppression', label: 'Suppression' },
  { key: 'team', label: 'Team Performance' },
  { key: 'compliance', label: 'Compliance' },
];

const TAB_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  profile: UserCircle,
  'ai-providers': Plug,
  mailbox: Mail,
  hours: Clock,
  verification: ShieldCheck,
  scoring: Star,
  'data-rules': Database,
  suppression: Ban,
  team: Users,
  compliance: ShieldAlert,
};

export default function SettingsScreen({ navigateTo }: { navigateTo?: (screen: string) => void }) {
  const [activeTab, setActiveTab] = useState('profile');

  // ── Toast state ──────────────────────────────────────────
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  return (
    <PageTransition>
      <div role="main" aria-label="Settings" className="max-h-[calc(100vh-200px)] overflow-y-auto space-y-8 pr-1 pb-8">
        <ScreenBreadcrumb items={[{ label: 'Settings' }]} />

        {/* Toast notification */}
        <AnimatePresence>
          {toastMessage && (
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="fixed top-6 right-6 z-50"
            >
              <div
                className="flex items-center gap-2.5 rounded-xl border border-emerald-500/30 px-5 py-3 text-sm text-emerald-700 backdrop-blur-xl"
                style={{
                  background: `linear-gradient(135deg, ${greenAlpha(0.12)}, ${greenAlpha(0.04)})`,
                  boxShadow: `0 4px 30px ${blackAlpha(0.3)}, 0 0 20px ${greenAlpha(0.08)}`,
                }}
              >
                ✅ <span className="font-medium">{toastMessage}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Page header */}
        <div className="space-y-2">
          <SectionHeader title="Settings" subtitle="Configure your DeepMindQ workspace preferences" className="mb-2" />
          <div className="flex items-center gap-2 ml-5">
            <PulseDot />
            <span className="text-xs text-muted-foreground">System active - 8 modules configured</span>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex items-center gap-3">
          <TabBar tabs={SETTINGS_TABS} active={activeTab} onChange={setActiveTab} />
          {TAB_ICONS[activeTab] && (
            <motion.div key={activeTab} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3 }}
              className="hidden sm:flex w-9 h-9 rounded-lg items-center justify-center shrink-0"
              style={{ background: `linear-gradient(135deg, ${goldAlpha(0.15)}, ${goldAlpha(0.05)})`, border: `1px solid ${goldAlpha(0.2)}` }}
            >
              {(() => { const Icon = TAB_ICONS[activeTab]; return <Icon className="size-4 text-[var(--color-gold-dim)]" />; })()}
            </motion.div>
          )}
        </div>

        {/* Tabs content */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsContent value="profile" className="mt-6 space-y-6"><ProfileTab showToast={showToast} /></TabsContent>
          <TabsContent value="ai-providers" className="mt-6 space-y-6"><AiProvidersTab showToast={showToast} /></TabsContent>
          <TabsContent value="mailbox" className="mt-6 space-y-6"><MailboxTab showToast={showToast} /></TabsContent>
          <TabsContent value="hours" className="mt-6 space-y-6"><WorkingHoursTab showToast={showToast} /></TabsContent>
          <TabsContent value="verification" className="mt-6 space-y-6"><VerificationTab showToast={showToast} /></TabsContent>
          <TabsContent value="scoring" className="mt-6 space-y-6"><ScoringTab showToast={showToast} /></TabsContent>
          <TabsContent value="data-rules" className="mt-6 space-y-6"><DataRulesSection /></TabsContent>
          <TabsContent value="suppression" className="mt-6 space-y-6"><SuppressionTab showToast={showToast} /></TabsContent>
          <TabsContent value="team" className="mt-6 space-y-6"><TeamPerformanceSection /></TabsContent>
          <TabsContent value="compliance" className="mt-6 space-y-6"><ComplianceSection navigateTo={navigateTo} /></TabsContent>
        </Tabs>
      </div>
    </PageTransition>
  );
}
