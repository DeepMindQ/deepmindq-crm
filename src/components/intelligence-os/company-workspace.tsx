'use client';

import { useState, useEffect } from 'react';
import { fetchApi } from '@/lib/fetchApi';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PageTransition,
  StatCard,
  StaggerGrid,
  StaggerItem,
  AnimatedCard,
  AnimatedCounter,
  PulseDot,
  GlassPanel,
} from '@/components/ui/animated-components';
import { tokens } from '@/components/intelligence-os/design-tokens';
import {
  MapPin,
  Brain,
  AlertTriangle,
  Users,
  Clock,
  Building2,
  DollarSign,
  Calendar,
  Tag,
  Bell,
  FileText,
  Activity,
  User,
  Mail,
  TrendingUp,
  Shield,
  Zap,
} from 'lucide-react';

/* ── Constants ── */

const TABS = ['Overview', 'Signals', 'Contacts', 'Activity', 'Notes'] as const;
type TabKey = (typeof TABS)[number];

const TECH_TAGS = [
  'React',
  'TypeScript',
  'Node.js',
  'AWS',
  'PostgreSQL',
  'Redis',
  'Kubernetes',
  'GraphQL',
];

const SIGNALS_DATA = [
  {
    type: 'Funding',
    description:
      'Series C funding round of $120M led by Sequoia Capital with participation from a16z.',
    timestamp: '4 hours ago',
    severity: 'high' as const,
    icon: DollarSign,
  },
  {
    type: 'Hiring',
    description:
      '14 new engineering hires in the last 30 days, including 3 senior principal engineers.',
    timestamp: '1 day ago',
    severity: 'medium' as const,
    icon: Users,
  },
  {
    type: 'Technology',
    description:
      'Migrated from REST to GraphQL for all public APIs. Indicates modernization effort.',
    timestamp: '2 days ago',
    severity: 'low' as const,
    icon: Zap,
  },
  {
    type: 'Market',
    description: 'Expanded operations to the EU with a new office in Amsterdam, Netherlands.',
    timestamp: '3 days ago',
    severity: 'medium' as const,
    icon: MapPin,
  },
];

const CONTACTS_DATA = [
  {
    name: 'Sarah Chen',
    title: 'VP of Engineering',
    email: 'sarah.chen@acme.com',
    initials: 'SC',
    color: '#3B82F6',
  },
  {
    name: 'Marcus Johnson',
    title: 'CTO & Co-Founder',
    email: 'marcus@acme.com',
    initials: 'MJ',
    color: '#8B5CF6',
  },
  {
    name: 'Elena Rodriguez',
    title: 'Head of Product',
    email: 'elena@acme.com',
    initials: 'ER',
    color: '#10B981',
  },
  {
    name: 'David Kim',
    title: 'Director of Sales',
    email: 'david.kim@acme.com',
    initials: 'DK',
    color: '#F59E0B',
  },
];

const NOTES_DATA = [
  {
    author: 'Sarah K.',
    timestamp: 'Aug 13, 2026 · 2:34 PM',
    text: 'Acme just closed their Series C. This is a prime time for platform integration discussions — their new engineering hires suggest they are scaling infrastructure heavily.',
  },
  {
    author: 'Mike R.',
    timestamp: 'Aug 11, 2026 · 10:15 AM',
    text: 'Had a warm intro through Sequoia. David Kim (Dir. of Sales) is the best entry point. He responded positively to the initial outreach last quarter.',
  },
  {
    author: 'AI Analyst',
    timestamp: 'Aug 10, 2026 · Auto-generated',
    text: 'Risk assessment updated: Acme shows high growth trajectory with increasing technology adoption. Recommendation: prioritize for enterprise tier outreach within the next 60 days.',
  },
];

const SEVERITY_CONFIG = {
  high: { color: '#EF4444', bg: 'rgba(239,68,68,0.12)', label: 'High' },
  medium: { color: '#F59E0B', bg: 'rgba(245,158,11,0.12)', label: 'Medium' },
  low: { color: '#10B981', bg: 'rgba(16,185,129,0.12)', label: 'Low' },
};

/* ── Main Component ── */

export function CompanyWorkspace() {
  const [activeTab, setActiveTab] = useState<TabKey>('Overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [orgData, setOrgData] = useState<any>(null);
  const [signalData, setSignalData] = useState<any[]>(SIGNALS_DATA);
  const [contactData, setContactData] = useState(CONTACTS_DATA);

  // Fetch organization data on mount
  useEffect(() => {
    let cancelled = false;
    async function fetchData() {
      try {
        setLoading(true);
        setError(null);
        // Fetch a recent organization as the demo company
        const orgsRes = await fetchApi('/api/organizations', {
          params: { limit: 1, status: 'active' },
        });
        if (cancelled) return;
        if (!orgsRes.error && orgsRes.data?.data?.length > 0) {
          const org = orgsRes.data.data[0];
          setOrgData(org);
          // Fetch detail for this org
          const detailRes = await fetchApi(`/api/organizations/${org.id}`);
          if (!detailRes.error && detailRes.data?.data) {
            const detail = detailRes.data.data;
            setOrgData(detail);
            // Map signals from detail
            if (detail.signals?.length > 0) {
              const sevIcons: Record<string, any> = {
                funding: DollarSign,
                hiring: Users,
                technology: Zap,
                market: MapPin,
              };
              setSignalData(
                detail.signals.slice(0, 4).map((s: any) => ({
                  type: s.signalType || s.title || 'Signal',
                  description: s.description || s.title || '',
                  timestamp: s.detectedAt ? new Date(s.detectedAt).toLocaleString() : '',
                  severity: (s.severity || 'medium') as string as 'high' | 'medium' | 'low',
                  icon: sevIcons[s.signalType] || Activity,
                })),
              );
            }
            // Map contacts from detail
            if (detail.people?.length > 0) {
              const colors = ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B'];
              setContactData(
                detail.people.slice(0, 4).map((p: any, i: number) => ({
                  name: p.fullName || '',
                  title: p.title || '',
                  email: p.email || '',
                  initials: (p.fullName || '')
                    .split(' ')
                    .map((n: string) => n[0])
                    .join('')
                    .slice(0, 2),
                  color: colors[i % colors.length],
                })),
              );
            }
          }
        }
      } catch (err) {
        if (!cancelled)
          setError(err instanceof Error ? err.message : 'Failed to load company data');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchData();
    return () => {
      cancelled = true;
    };
  }, []);

  const companyName = orgData?.name || 'Acme Corporation';
  const companyDomain = orgData?.domain || 'acme.com';
  const companyIndustry = orgData?.industry || 'Enterprise SaaS';
  const intelScore = orgData?.intelligenceScore;
  const signalCount = orgData?._count?.signals ?? orgData?.signalCount ?? 14;
  const peopleCount = orgData?._count?.people ?? 23;

  return (
    <PageTransition className="p-6 space-y-6">
      {/* ── Company Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div
            className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0"
            style={{
              background: 'linear-gradient(135deg, rgba(59,130,246,0.2), rgba(139,92,246,0.2))',
            }}
          >
            <Building2 className="w-7 h-7" style={{ color: '#3B82F6' }} />
          </div>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1
                className="text-2xl font-bold tracking-tight"
                style={{ color: 'var(--ios-text-primary)' }}
              >
                {companyName}
              </h1>
              <span
                className="text-xs font-medium px-2.5 py-1 rounded-full"
                style={{ color: '#3B82F6', background: 'rgba(59,130,246,0.12)' }}
              >
                {companyIndustry}
              </span>
            </div>
            <div className="flex items-center gap-4 mt-1.5">
              <span className="text-sm" style={{ color: 'var(--ios-text-secondary)' }}>
                {companyDomain}
              </span>
              <span
                className="flex items-center gap-1 text-sm"
                style={{ color: 'var(--ios-text-secondary)' }}
              >
                <MapPin className="w-3.5 h-3.5" />
                San Francisco, CA
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <PulseDot color="#10B981" />
          <span className="text-xs font-medium" style={{ color: '#10B981' }}>
            Actively monitored
          </span>
        </div>
      </div>

      {/* ── Stats Row ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Intelligence Score"
          value={intelScore ? `${intelScore}/100` : '87/100'}
          icon={Brain}
          color="#3B82F6"
        />
        <StatCard label="Active Signals" value={signalCount} icon={Activity} color="#F59E0B" />
        <StatCard label="Contacts Tracked" value={peopleCount} icon={Users} color="#10B981" />
        <StatCard label="Last Scan" value="2h ago" icon={Clock} color="#8B5CF6" />
      </div>

      {/* ── Tabs ── */}
      <div
        className="flex items-center gap-1 p-1.5 rounded-xl overflow-x-auto"
        style={{ background: 'var(--ios-bg-secondary)', border: '1px solid var(--ios-border)' }}
      >
        {TABS.map((tab) => {
          const isActive = tab === activeTab;
          return (
            <motion.button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground/70'
              }`}
              whileTap={{ scale: 0.96 }}
            >
              {isActive && (
                <motion.div
                  layoutId="company-tab-indicator"
                  className="absolute inset-0 rounded-lg"
                  style={{
                    background:
                      'linear-gradient(135deg, rgba(59,130,246,0.12), rgba(59,130,246,0.06))',
                    border: '1px solid rgba(59,130,246,0.25)',
                    boxShadow: '0 0 12px rgba(59,130,246,0.08)',
                  }}
                  transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                />
              )}
              <span className="relative z-10">{tab}</span>
            </motion.button>
          );
        })}
      </div>

      {/* ── Tab Content ── */}
      <AnimatePresence mode="wait">
        {activeTab === 'Overview' && (
          <motion.div
            key="overview"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
          >
            {/* Company Profile Card */}
            <GlassPanel className="p-5">
              <h3
                className="text-sm font-semibold mb-4"
                style={{ color: 'var(--ios-text-primary)' }}
              >
                Company Profile
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <Calendar
                      className="w-3.5 h-3.5"
                      style={{ color: 'var(--ios-text-secondary)' }}
                    />
                    <span className="text-xs" style={{ color: 'var(--ios-text-secondary)' }}>
                      Founded
                    </span>
                  </div>
                  <p className="text-sm font-medium" style={{ color: 'var(--ios-text-primary)' }}>
                    2018
                  </p>
                </div>
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <Users className="w-3.5 h-3.5" style={{ color: 'var(--ios-text-secondary)' }} />
                    <span className="text-xs" style={{ color: 'var(--ios-text-secondary)' }}>
                      Employees
                    </span>
                  </div>
                  <p className="text-sm font-medium" style={{ color: 'var(--ios-text-primary)' }}>
                    340 – 500
                  </p>
                </div>
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <DollarSign
                      className="w-3.5 h-3.5"
                      style={{ color: 'var(--ios-text-secondary)' }}
                    />
                    <span className="text-xs" style={{ color: 'var(--ios-text-secondary)' }}>
                      Revenue
                    </span>
                  </div>
                  <p className="text-sm font-medium" style={{ color: 'var(--ios-text-primary)' }}>
                    $50M – $100M
                  </p>
                </div>
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <TrendingUp
                      className="w-3.5 h-3.5"
                      style={{ color: 'var(--ios-text-secondary)' }}
                    />
                    <span className="text-xs" style={{ color: 'var(--ios-text-secondary)' }}>
                      Growth
                    </span>
                  </div>
                  <p className="text-sm font-medium" style={{ color: '#10B981' }}>
                    +47% YoY
                  </p>
                </div>
              </div>
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <Tag className="w-3.5 h-3.5" style={{ color: 'var(--ios-text-secondary)' }} />
                  <span className="text-xs" style={{ color: 'var(--ios-text-secondary)' }}>
                    Tech Stack
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {TECH_TAGS.map((tag) => (
                    <span
                      key={tag}
                      className="text-xs font-medium px-2.5 py-1 rounded-md"
                      style={{
                        color: 'var(--ios-text-primary)',
                        background: 'var(--ios-bg-elevated)',
                        border: '1px solid var(--ios-border)',
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </GlassPanel>

            {/* Recent Signals + Key Contacts 2-col */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {/* Recent Signals */}
              <div>
                <h3
                  className="text-sm font-semibold mb-3"
                  style={{ color: 'var(--ios-text-primary)' }}
                >
                  Recent Signals
                </h3>
                <StaggerGrid className="space-y-3" stagger={0.06}>
                  {signalData.map((signal) => {
                    const Icon = signal.icon;
                    const sev =
                      SEVERITY_CONFIG[signal.severity as keyof typeof SEVERITY_CONFIG] ||
                      SEVERITY_CONFIG.medium;
                    return (
                      <StaggerItem key={signal.type}>
                        <AnimatedCard className="p-4" delay={0}>
                          <div className="flex items-start gap-3">
                            <div
                              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                              style={{ background: `${sev.color}15` }}
                            >
                              <Icon className="w-4 h-4" style={{ color: sev.color }} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span
                                  className="text-sm font-medium"
                                  style={{ color: 'var(--ios-text-primary)' }}
                                >
                                  {signal.type}
                                </span>
                                <span
                                  className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                                  style={{ color: sev.color, background: sev.bg }}
                                >
                                  {sev.label}
                                </span>
                              </div>
                              <p
                                className="text-xs leading-relaxed"
                                style={{ color: 'var(--ios-text-secondary)' }}
                              >
                                {signal.description}
                              </p>
                              <p
                                className="text-[11px] mt-1.5"
                                style={{ color: 'var(--ios-text-secondary)', opacity: 0.7 }}
                              >
                                {signal.timestamp}
                              </p>
                            </div>
                          </div>
                        </AnimatedCard>
                      </StaggerItem>
                    );
                  })}
                </StaggerGrid>
              </div>

              {/* Key Contacts */}
              <div>
                <h3
                  className="text-sm font-semibold mb-3"
                  style={{ color: 'var(--ios-text-primary)' }}
                >
                  Key Contacts
                </h3>
                <StaggerGrid className="space-y-3" stagger={0.06}>
                  {contactData.map((contact) => (
                    <StaggerItem key={contact.email}>
                      <AnimatedCard className="p-4" delay={0}>
                        <div className="flex items-center gap-3">
                          <div
                            className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-xs font-bold"
                            style={{ color: contact.color, background: `${contact.color}20` }}
                          >
                            {contact.initials}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p
                              className="text-sm font-medium"
                              style={{ color: 'var(--ios-text-primary)' }}
                            >
                              {contact.name}
                            </p>
                            <p className="text-xs" style={{ color: 'var(--ios-text-secondary)' }}>
                              {contact.title}
                            </p>
                          </div>
                          <button
                            className="p-2 rounded-lg transition-colors"
                            style={{ color: 'var(--ios-text-secondary)' }}
                          >
                            <Mail className="w-4 h-4" />
                          </button>
                        </div>
                      </AnimatedCard>
                    </StaggerItem>
                  ))}
                </StaggerGrid>
              </div>
            </div>

            {/* Intelligence Notes */}
            <GlassPanel className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold" style={{ color: 'var(--ios-text-primary)' }}>
                  Intelligence Notes
                </h3>
                <button
                  className="text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
                  style={{ color: '#3B82F6', background: 'rgba(59,130,246,0.1)' }}
                >
                  + Add Note
                </button>
              </div>
              <div className="space-y-3">
                {NOTES_DATA.map((note, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 + i * 0.08, duration: 0.35 }}
                    className="p-3 rounded-lg"
                    style={{ background: 'var(--ios-bg-secondary)' }}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span
                        className="text-xs font-medium"
                        style={{ color: 'var(--ios-text-primary)' }}
                      >
                        {note.author}
                      </span>
                      <span className="text-[11px]" style={{ color: 'var(--ios-text-secondary)' }}>
                        {note.timestamp}
                      </span>
                    </div>
                    <p
                      className="text-xs leading-relaxed"
                      style={{ color: 'var(--ios-text-secondary)' }}
                    >
                      {note.text}
                    </p>
                  </motion.div>
                ))}
              </div>
            </GlassPanel>
          </motion.div>
        )}

        {activeTab !== 'Overview' && (
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col items-center justify-center py-20"
          >
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
              style={{ background: 'var(--ios-bg-card)' }}
            >
              <FileText className="w-8 h-8" style={{ color: 'var(--ios-text-secondary)' }} />
            </div>
            <p className="text-sm font-medium" style={{ color: 'var(--ios-text-primary)' }}>
              {activeTab} view
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--ios-text-secondary)' }}>
              Full {activeTab.toLowerCase()} content would be rendered here
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </PageTransition>
  );
}
