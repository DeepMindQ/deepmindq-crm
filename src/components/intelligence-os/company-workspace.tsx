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
  Plus,
  Loader2,
  Send,
  Network,
} from 'lucide-react';
import { GraphVisualization } from '@/components/intelligence-os/graph-visualization';

/* ── Types ── */

interface SignalItem {
  type: string;
  description: string;
  timestamp: string;
  severity: 'high' | 'medium' | 'low';
  icon: typeof Activity;
}

interface ContactItem {
  name: string;
  title: string;
  email: string;
  initials: string;
  color: string;
}

interface NoteItem {
  id: string;
  author?: string;
  timestamp: string;
  text: string;
  title?: string;
  createdAt?: string;
}

interface OrgData {
  id: string;
  name: string;
  domain?: string;
  industry?: string;
  intelligenceScore?: number;
  _count?: { signals?: number; people?: number };
  signalCount?: number;
  signals?: unknown[];
  people?: unknown[];
  [key: string]: unknown;
}

const TABS = ['Overview', 'Signals', 'Contacts', 'Graph', 'Activity', 'Notes'] as const;
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
  const [orgData, setOrgData] = useState<OrgData | null>(null);
  const [signalData, setSignalData] = useState<SignalItem[]>([]);
  const [contactData, setContactData] = useState<ContactItem[]>([]);
  const [noteData, setNoteData] = useState<NoteItem[]>([]);
  const [noteLoading, setNoteLoading] = useState(false);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [newNoteText, setNewNoteText] = useState('');
  const [submittingNote, setSubmittingNote] = useState(false);

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
              const sevIcons: Record<string, typeof Activity> = {
                funding: DollarSign,
                hiring: Users,
                technology: Zap,
                market: MapPin,
              };
              setSignalData(
                (detail.signals as Record<string, unknown>[]).slice(0, 4).map((s) => ({
                  type: (s.signalType as string) || (s.title as string) || 'Signal',
                  description: (s.description as string) || (s.title as string) || '',
                  timestamp: s.detectedAt ? new Date(s.detectedAt as string).toLocaleString() : '',
                  severity: ((s.severity as string) || 'medium') as 'high' | 'medium' | 'low',
                  icon: sevIcons[s.signalType as string] || Activity,
                })),
              );
            }
            // Map contacts from detail
            if (detail.people?.length > 0) {
              const colors = ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B'];
              setContactData(
                (detail.people as Record<string, unknown>[]).slice(0, 4).map((p, i) => ({
                  name: (p.fullName as string) || '',
                  title: (p.title as string) || '',
                  email: (p.email as string) || '',
                  initials: ((p.fullName as string) || '')
                    .split(' ')
                    .map((n) => n[0])
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

  // Fetch contacts when Contacts tab is selected
  useEffect(() => {
    if (activeTab !== 'Contacts' || !orgData?.id) return;
    let cancelled = false;
    async function fetchContacts() {
      try {
        setContactsLoading(true);
        const res = await fetchApi('/api/contacts', {
          params: { organizationId: orgData!.id },
        });
        if (cancelled) return;
        if (!res.error && res.data?.data?.length > 0) {
          const colors = ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B'];
          setContactData(
            (res.data.data as Record<string, unknown>[]).map((p, i) => ({
              name: (p.fullName as string) || '',
              title: (p.title as string) || '',
              email: (p.email as string) || '',
              initials: ((p.fullName as string) || '')
                .split(' ')
                .map((n) => n[0])
                .join('')
                .slice(0, 2),
              color: colors[i % colors.length],
            })),
          );
        }
      } catch (_err) {
        // silently fail, keep existing data
      } finally {
        if (!cancelled) setContactsLoading(false);
      }
    }
    fetchContacts();
    return () => {
      cancelled = true;
    };
  }, [activeTab, orgData?.id]);

  // Fetch notes when Notes tab is selected
  useEffect(() => {
    if (activeTab !== 'Notes' && activeTab !== 'Overview') return;
    if (!orgData?.id) return;
    let cancelled = false;
    async function fetchNotes() {
      try {
        setNoteLoading(true);
        const res = await fetchApi('/api/notes', {
          params: { organizationId: orgData!.id },
        });
        if (cancelled) return;
        if (!res.error && res.data?.data?.length > 0) {
          setNoteData(
            (res.data.data as Record<string, unknown>[]).map((n) => ({
              id: (n.id as string) || '',
              author: 'Team',
              timestamp: n.createdAt ? new Date(n.createdAt as string).toLocaleString() : '',
              text: (n.narrative as string) || (n.title as string) || '',
              title: (n.title as string) || '',
              createdAt: n.createdAt as string,
            })),
          );
        }
      } catch (_err) {
        // silently fail
      } finally {
        if (!cancelled) setNoteLoading(false);
      }
    }
    fetchNotes();
    return () => {
      cancelled = true;
    };
  }, [activeTab, orgData?.id]);

  const handleAddNote = async () => {
    if (!newNoteText.trim() || !orgData?.id) return;
    try {
      setSubmittingNote(true);
      const res = await fetchApi('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId: orgData.id,
          title: newNoteText.trim().slice(0, 80),
          narrative: newNoteText.trim(),
        }),
      });
      if (!res.error && res.data?.data) {
        const created = res.data.data;
        setNoteData((prev) => [
          {
            id: created.id,
            author: 'You',
            timestamp: created.createdAt
              ? new Date(created.createdAt).toLocaleString()
              : new Date().toLocaleString(),
            text: newNoteText.trim(),
            title: newNoteText.trim().slice(0, 80),
          },
          ...prev,
        ]);
        setNewNoteText('');
      }
    } catch (_err) {
      // silently fail
    } finally {
      setSubmittingNote(false);
    }
  };

  const companyName = orgData?.name || 'Acme Corporation';
  const companyDomain = orgData?.domain || 'acme.com';
  const companyIndustry = orgData?.industry || 'Enterprise SaaS';
  const intelScore = orgData?.intelligenceScore;
  const signalCount = orgData?._count?.signals ?? orgData?.signalCount ?? 14;
  const peopleCount = orgData?._count?.people ?? 23;

  return (
    <div role="region" aria-label="Company Workspace">
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
          <div aria-label={`Intelligence Score: ${intelScore ? `${intelScore}/100` : '87/100'}`}>
            <StatCard
              label="Intelligence Score"
              value={intelScore ? `${intelScore}/100` : '87/100'}
              icon={Brain}
              color="#3B82F6"
            />
          </div>
          <div aria-label={`Active Signals: ${signalCount}`}>
            <StatCard label="Active Signals" value={signalCount} icon={Activity} color="#F59E0B" />
          </div>
          <div aria-label={`Contacts Tracked: ${peopleCount}`}>
            <StatCard label="Contacts Tracked" value={peopleCount} icon={Users} color="#10B981" />
          </div>
          <div aria-label="Last Scan: 2h ago">
            <StatCard label="Last Scan" value="2h ago" icon={Clock} color="#8B5CF6" />
          </div>
        </div>

        {/* ── Tabs ── */}
        <div
          className="flex items-center gap-1 p-1.5 rounded-xl overflow-x-auto"
          style={{ background: 'var(--ios-bg-secondary)', border: '1px solid var(--ios-border)' }}
          role="tablist"
          aria-label="Company information tabs"
        >
          {TABS.map((tab) => {
            const isActive = tab === activeTab;
            return (
              <motion.button
                key={tab}
                onClick={() => setActiveTab(tab)}
                role="tab"
                aria-selected={isActive}
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
              role="tabpanel"
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
                      <Users
                        className="w-3.5 h-3.5"
                        style={{ color: 'var(--ios-text-secondary)' }}
                      />
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
                  {contactsLoading && (
                    <div className="flex items-center justify-center py-8">
                      <Loader2
                        className="w-5 h-5 animate-spin"
                        style={{ color: 'var(--ios-text-secondary)' }}
                      />
                    </div>
                  )}
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
                  <h3
                    className="text-sm font-semibold"
                    style={{ color: 'var(--ios-text-primary)' }}
                  >
                    Intelligence Notes
                  </h3>
                  <button
                    className="text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
                    style={{ color: '#3B82F6', background: 'rgba(59,130,246,0.1)' }}
                  >
                    + Add Note
                  </button>
                </div>

                {/* Add Note Input */}
                <div className="flex items-center gap-2 mb-4">
                  <input
                    type="text"
                    aria-label="Add intelligence note"
                    value={newNoteText}
                    onChange={(e) => setNewNoteText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAddNote();
                    }}
                    placeholder="Add a new intelligence note..."
                    className="flex-1 h-9 px-3 rounded-lg text-sm outline-none transition-all focus:ring-2 focus:ring-[#3B82F6]/40"
                    style={{
                      color: 'var(--ios-text-primary)',
                      background: 'var(--ios-bg-secondary)',
                      border: '1px solid var(--ios-border)',
                    }}
                    disabled={submittingNote}
                  />
                  <motion.button
                    onClick={handleAddNote}
                    disabled={submittingNote || !newNoteText.trim()}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                    style={{ color: '#fff', background: '#3B82F6' }}
                    whileHover={{ scale: submittingNote ? 1 : 1.02 }}
                    whileTap={{ scale: submittingNote ? 1 : 0.98 }}
                  >
                    {submittingNote ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Send className="w-3.5 h-3.5" />
                    )}
                    Add
                  </motion.button>
                </div>

                <div className="space-y-3">
                  {noteLoading && (
                    <div className="flex items-center justify-center py-4">
                      <Loader2
                        className="w-5 h-5 animate-spin"
                        style={{ color: 'var(--ios-text-secondary)' }}
                      />
                    </div>
                  )}
                  {noteData.length === 0 && !noteLoading && (
                    <p
                      className="text-xs text-center py-4"
                      style={{ color: 'var(--ios-text-secondary)' }}
                    >
                      No notes yet. Add one above.
                    </p>
                  )}
                  {noteData.map((note) => (
                    <motion.div
                      key={note.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
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
                        <span
                          className="text-[11px]"
                          style={{ color: 'var(--ios-text-secondary)' }}
                        >
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

          {activeTab === 'Contacts' && (
            <motion.div
              key="contacts"
              role="tabpanel"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3 }}
              className="space-y-4"
            >
              <h3 className="text-sm font-semibold" style={{ color: 'var(--ios-text-primary)' }}>
                Contacts
              </h3>
              {contactsLoading && (
                <div className="flex items-center justify-center py-12">
                  <Loader2
                    className="w-6 h-6 animate-spin"
                    style={{ color: 'var(--ios-text-secondary)' }}
                  />
                </div>
              )}
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
                {!contactsLoading && contactData.length === 0 && (
                  <p
                    className="text-xs text-center py-8"
                    style={{ color: 'var(--ios-text-secondary)' }}
                  >
                    No contacts found for this organization.
                  </p>
                )}
              </StaggerGrid>
            </motion.div>
          )}

          {activeTab === 'Signals' && (
            <motion.div
              key="signals-view"
              role="tabpanel"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3 }}
              className="space-y-4"
            >
              <h3 className="text-sm font-semibold" style={{ color: 'var(--ios-text-primary)' }}>
                Signals
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
            </motion.div>
          )}

          {activeTab === 'Notes' && (
            <motion.div
              key="notes-view"
              role="tabpanel"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3 }}
              className="space-y-4"
            >
              <GlassPanel className="p-5">
                <h3
                  className="text-sm font-semibold mb-4"
                  style={{ color: 'var(--ios-text-primary)' }}
                >
                  Intelligence Notes
                </h3>

                {/* Add Note Input */}
                <div className="flex items-center gap-2 mb-4">
                  <input
                    type="text"
                    aria-label="Add intelligence note"
                    value={newNoteText}
                    onChange={(e) => setNewNoteText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAddNote();
                    }}
                    placeholder="Add a new intelligence note..."
                    className="flex-1 h-9 px-3 rounded-lg text-sm outline-none transition-all focus:ring-2 focus:ring-[#3B82F6]/40"
                    style={{
                      color: 'var(--ios-text-primary)',
                      background: 'var(--ios-bg-secondary)',
                      border: '1px solid var(--ios-border)',
                    }}
                    disabled={submittingNote}
                  />
                  <motion.button
                    onClick={handleAddNote}
                    disabled={submittingNote || !newNoteText.trim()}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                    style={{ color: '#fff', background: '#3B82F6' }}
                    whileHover={{ scale: submittingNote ? 1 : 1.02 }}
                    whileTap={{ scale: submittingNote ? 1 : 0.98 }}
                  >
                    {submittingNote ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Send className="w-3.5 h-3.5" />
                    )}
                    Add
                  </motion.button>
                </div>

                <div className="space-y-3">
                  {noteLoading && (
                    <div className="flex items-center justify-center py-4">
                      <Loader2
                        className="w-5 h-5 animate-spin"
                        style={{ color: 'var(--ios-text-secondary)' }}
                      />
                    </div>
                  )}
                  {noteData.length === 0 && !noteLoading && (
                    <p
                      className="text-xs text-center py-4"
                      style={{ color: 'var(--ios-text-secondary)' }}
                    >
                      No notes yet. Add one above.
                    </p>
                  )}
                  {noteData.map((note) => (
                    <motion.div
                      key={note.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
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
                        <span
                          className="text-[11px]"
                          style={{ color: 'var(--ios-text-secondary)' }}
                        >
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

          {activeTab === 'Graph' && (
            <motion.div
              key="graph-view"
              role="tabpanel"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3 }}
              className="space-y-4"
            >
              <h3 className="text-sm font-semibold" style={{ color: 'var(--ios-text-primary)' }}>
                Knowledge Graph
              </h3>
              {orgData?.id ? (
                <GraphVisualization
                  centerEntityId={orgData.id}
                  entityType="organization"
                  depth={2}
                  height={400}
                />
              ) : (
                <div className="flex flex-col items-center justify-center py-12">
                  <Network
                    className="w-10 h-10 mb-3"
                    style={{ color: 'var(--ios-text-secondary)', opacity: 0.4 }}
                  />
                  <p className="text-sm" style={{ color: 'var(--ios-text-secondary)' }}>
                    Select a company to view its knowledge graph
                  </p>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'Activity' && (
            <motion.div
              key="activity"
              role="tabpanel"
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
                Activity view
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--ios-text-secondary)' }}>
                Full activity content would be rendered here
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </PageTransition>
    </div>
  );
}
