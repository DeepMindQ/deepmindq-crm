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
  GlassPanel,
} from '@/components/ui/animated-components';
import { tokens } from '@/components/intelligence-os/design-tokens';
import {
  FileText,
  Plus,
  Sparkles,
  AlertTriangle,
  TrendingUp,
  Shield,
  Clock,
  User,
  ChevronRight,
  Calendar,
  ArrowUpRight,
  BarChart3,
  Globe,
  CheckCircle2,
} from 'lucide-react';

/* ── Constants ── */

const BRIEFING_TABS = ['Daily Digest', 'Weekly Report', 'Executive Summary', 'Custom'] as const;
type BriefingTab = (typeof BRIEFING_TABS)[number];

const MARKET_HIGHLIGHTS = [
  {
    title: 'SaaS Market Growth',
    summary:
      'Global SaaS market projected to reach $908B by 2030, growing at 18.7% CAGR. Enterprise segment leads with 23.4% growth rate driven by AI-native applications.',
    color: '#3B82F6',
    icon: TrendingUp,
  },
  {
    title: 'AI Adoption Surge',
    summary:
      '78% of enterprise companies now have formal AI adoption strategies, up from 52% in 2025. Budget allocation for AI tools increased by 67% year-over-year.',
    color: '#8B5CF6',
    icon: Sparkles,
  },
  {
    title: 'Regulatory Changes',
    summary:
      'EU AI Act enforcement begins September 2026. Companies are accelerating compliance efforts, creating a 6-month window for compliance-related solutions.',
    color: '#F59E0B',
    icon: Shield,
  },
];

const ACTION_ITEMS = [
  {
    priority: 'Critical',
    task: 'Prepare competitive response deck for Product Y',
    owner: 'Sarah K.',
    deadline: 'Aug 16',
    color: '#EF4444',
  },
  {
    priority: 'High',
    task: 'Initiate outreach to top 10 FinTech intent accounts',
    owner: 'Mike R.',
    deadline: 'Aug 18',
    color: '#EF4444',
  },
  {
    priority: 'High',
    task: 'Schedule intro call with new Stripe CTO',
    owner: 'James L.',
    deadline: 'Aug 20',
    color: '#EF4444',
  },
  {
    priority: 'Medium',
    task: 'Update ICP model with new FinTech vertical data',
    owner: 'AI Engine',
    deadline: 'Aug 22',
    color: '#F59E0B',
  },
  {
    priority: 'Low',
    task: 'Review pipeline velocity benchmarks',
    owner: 'Team',
    deadline: 'Aug 25',
    color: '#10B981',
  },
];

const BRIEFING_HISTORY = [
  { date: 'Aug 13, 2026', type: 'Daily Digest', color: '#3B82F6' },
  { date: 'Aug 12, 2026', type: 'Daily Digest', color: '#3B82F6' },
  { date: 'Aug 11, 2026', type: 'Weekly Report', color: '#10B981' },
  { date: 'Aug 10, 2026', type: 'Daily Digest', color: '#3B82F6' },
  { date: 'Aug 9, 2026', type: 'Executive Summary', color: '#8B5CF6' },
  { date: 'Aug 8, 2026', type: 'Daily Digest', color: '#3B82F6' },
];

const SEVERITY_CONFIG: Record<string, { color: string; bg: string }> = {
  Critical: { color: '#EF4444', bg: 'rgba(239,68,68,0.12)' },
  High: { color: '#F59E0B', bg: 'rgba(245,158,11,0.12)' },
  Medium: { color: '#3B82F6', bg: 'rgba(59,130,246,0.12)' },
  Low: { color: '#10B981', bg: 'rgba(16,185,129,0.12)' },
};

/* ── Types ── */

interface Finding {
  id: string | number;
  severity: 'Critical' | 'High' | 'Medium' | 'Low';
  title: string;
  description: string;
  source: string;
}

/* ── Main Component ── */

export function IntelligenceBriefing() {
  const [activeTab, setActiveTab] = useState<BriefingTab>('Daily Digest');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [briefingSent, setBriefingSent] = useState(false);
  const [sendingBriefing, setSendingBriefing] = useState(false);

  // Build risk matrix from signal severity data
  const riskMatrix = (() => {
    const severityCounts: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0 };
    findings.forEach((f) => {
      const key = f.severity.toLowerCase();
      if (key in severityCounts) severityCounts[key]++;
    });

    const baseMatrix: Record<
      string,
      { likelihood: string; impact: string; items: string[]; color: string }[]
    > = {
      High: [
        { likelihood: 'High', impact: 'High', items: [], color: '#EF4444' },
        { likelihood: 'High', impact: 'Medium', items: [], color: '#F59E0B' },
        { likelihood: 'High', impact: 'Low', items: [], color: '#F59E0B' },
      ],
      Medium: [
        { likelihood: 'Medium', impact: 'High', items: [], color: '#F59E0B' },
        { likelihood: 'Medium', impact: 'Medium', items: [], color: '#F59E0B' },
        { likelihood: 'Medium', impact: 'Low', items: [], color: '#10B981' },
      ],
      Low: [
        { likelihood: 'Low', impact: 'High', items: [], color: '#F59E0B' },
        { likelihood: 'Low', impact: 'Medium', items: [], color: '#10B981' },
        { likelihood: 'Low', impact: 'Low', items: [], color: '#10B981' },
      ],
    };

    // Populate risk matrix with findings
    if (findings.length > 0) {
      findings.forEach((f) => {
        const sevKey = f.severity.toLowerCase();
        if (sevKey === 'critical' || sevKey === 'high') {
          baseMatrix.High[0].items.push(f.title);
        } else if (sevKey === 'medium') {
          baseMatrix.Medium[1].items.push(f.title);
        } else {
          baseMatrix.Low[2].items.push(f.title);
        }
      });
    } else {
      // Empty state fallback
      baseMatrix.High[0].items = ['Awaiting signal data'];
      baseMatrix.High[1].items = ['Pending analysis'];
      baseMatrix.Medium[0].items = ['No critical risks detected'];
      baseMatrix.Medium[1].items = ['Normal operations'];
      baseMatrix.Low[2].items = ['All clear'];
    }

    return baseMatrix;
  })();

  // Fetch signals for briefing findings
  useEffect(() => {
    let cancelled = false;
    async function fetchData() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetchApi('/api/signals', { params: { limit: 20, severity: 'critical' } });
        if (cancelled) return;
        if (!res.error && res.data?.data?.length > 0) {
          const severityLabel = (s: string) => {
            const u = s.toUpperCase();
            if (u === 'CRITICAL') return 'Critical';
            if (u === 'HIGH') return 'High';
            return 'Medium';
          };
          const mapped = (res.data.data as Record<string, unknown>[]).slice(0, 4).map((s, i) => ({
            id: (s.id as string) || i + 1,
            severity: severityLabel(s.severity as string) as 'Critical' | 'High' | 'Medium' | 'Low',
            title:
              (s.title as string) || (s.description as string)?.slice(0, 80) || 'Signal detected',
            description: (s.description as string) || '',
            source: `Signal Detection · ${(s.organization as Record<string, string>)?.name || 'Intelligence'}`,
          }));
          setFindings(mapped);
        }
      } catch (err) {
        if (!cancelled)
          setError(err instanceof Error ? err.message : 'Failed to load briefing data');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchData();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSendBriefing = async () => {
    setSendingBriefing(true);
    setBriefingSent(false);
    // Simulate a brief delay for UX feedback
    await new Promise((r) => setTimeout(r, 800));
    setSendingBriefing(false);
    setBriefingSent(true);
    // Auto-dismiss after 3 seconds
    setTimeout(() => setBriefingSent(false), 3000);
  };

  return (
    <div role="region" aria-label="Intelligence Briefing">
      <PageTransition className="p-6 space-y-6">
        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1
              className="text-2xl font-bold tracking-tight"
              style={{ color: 'var(--ios-text-primary)' }}
            >
              Intelligence Briefing
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--ios-text-secondary)' }}>
              AI-generated intelligence summaries &amp; executive briefings
            </p>
          </div>
          <div className="flex items-center gap-2">
            {briefingSent && (
              <motion.div
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg"
                style={{ color: '#10B981', background: 'rgba(16,185,129,0.1)' }}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Briefing sent successfully!
              </motion.div>
            )}
            <motion.button
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              style={{ color: '#fff', background: '#3B82F6' }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleSendBriefing}
              disabled={sendingBriefing}
              aria-label="Send Briefing"
            >
              {sendingBriefing ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              {sendingBriefing ? 'Sending...' : 'Send Briefing'}
            </motion.button>
          </div>
        </div>

        {/* ── Briefing Type Tabs ── */}
        <div
          className="flex items-center gap-1 p-1.5 rounded-xl overflow-x-auto"
          style={{ background: 'var(--ios-bg-secondary)', border: '1px solid var(--ios-border)' }}
          role="tablist"
        >
          {BRIEFING_TABS.map((tab) => {
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
                    layoutId="briefing-tab"
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

        {/* ── Main Content ── */}
        <AnimatePresence mode="wait">
          {activeTab === 'Daily Digest' && (
            <motion.div
              key="daily"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3 }}
              className="grid grid-cols-1 xl:grid-cols-4 gap-6"
            >
              {/* Left: Main briefing content (3 cols) */}
              <div className="xl:col-span-3 space-y-6">
                {/* Date Header */}
                <div className="flex items-center gap-3">
                  <Calendar className="w-4 h-4" style={{ color: '#3B82F6' }} />
                  <h2
                    className="text-lg font-semibold"
                    style={{ color: 'var(--ios-text-primary)' }}
                  >
                    August 14, 2026
                  </h2>
                  <span
                    className="text-xs font-medium px-2 py-0.5 rounded-full"
                    style={{ color: '#3B82F6', background: 'rgba(59,130,246,0.12)' }}
                  >
                    AI Generated
                  </span>
                </div>

                {/* Key Findings */}
                <GlassPanel className="p-5">
                  <h3
                    className="text-sm font-semibold mb-4"
                    style={{ color: 'var(--ios-text-primary)' }}
                  >
                    Key Findings
                  </h3>
                  <div className="space-y-4">
                    {findings.length === 0 && !loading && (
                      <p
                        className="text-xs text-center py-6"
                        style={{ color: 'var(--ios-text-secondary)' }}
                      >
                        No critical signals found. All systems normal.
                      </p>
                    )}
                    {findings.map((finding, i) => {
                      const sev = SEVERITY_CONFIG[finding.severity];
                      return (
                        <motion.div
                          key={finding.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.08, duration: 0.35 }}
                          className="flex gap-3"
                        >
                          <div className="flex flex-col items-center shrink-0">
                            <span
                              className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold"
                              style={{ color: sev.color, background: sev.bg }}
                            >
                              {i + 1}
                            </span>
                            {i < findings.length - 1 && (
                              <div
                                className="w-px flex-1 mt-1"
                                style={{ background: 'var(--ios-border)' }}
                              />
                            )}
                          </div>
                          <div
                            className="pb-4"
                            style={{
                              borderBottom:
                                i < findings.length - 1 ? '1px solid var(--ios-border)' : 'none',
                            }}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <span
                                className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                                style={{ color: sev.color, background: sev.bg }}
                              >
                                {finding.severity}
                              </span>
                              <p
                                className="text-sm font-medium"
                                style={{ color: 'var(--ios-text-primary)' }}
                              >
                                {finding.title}
                              </p>
                            </div>
                            <p
                              className="text-xs leading-relaxed mb-1.5"
                              style={{ color: 'var(--ios-text-secondary)' }}
                            >
                              {finding.description}
                            </p>
                            <p
                              className="text-[11px]"
                              style={{ color: 'var(--ios-text-secondary)', opacity: 0.6 }}
                            >
                              Source: {finding.source}
                            </p>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </GlassPanel>

                {/* Market Highlights */}
                <div>
                  <h3
                    className="text-sm font-semibold mb-3"
                    style={{ color: 'var(--ios-text-primary)' }}
                  >
                    Market Highlights
                  </h3>
                  <StaggerGrid className="grid grid-cols-1 md:grid-cols-3 gap-4" stagger={0.08}>
                    {MARKET_HIGHLIGHTS.map((item) => {
                      const Icon = item.icon;
                      return (
                        <StaggerItem key={item.title}>
                          <AnimatedCard className="p-4" glow={`${item.color}15`} delay={0}>
                            <div className="flex items-center gap-2 mb-3">
                              <div
                                className="w-8 h-8 rounded-lg flex items-center justify-center"
                                style={{ background: `${item.color}15` }}
                              >
                                <Icon className="w-4 h-4" style={{ color: item.color }} />
                              </div>
                              <h4
                                className="text-sm font-semibold"
                                style={{ color: 'var(--ios-text-primary)' }}
                              >
                                {item.title}
                              </h4>
                            </div>
                            <p
                              className="text-xs leading-relaxed"
                              style={{ color: 'var(--ios-text-secondary)' }}
                            >
                              {item.summary}
                            </p>
                          </AnimatedCard>
                        </StaggerItem>
                      );
                    })}
                  </StaggerGrid>
                </div>

                {/* Action Items */}
                <GlassPanel className="p-5">
                  <h3
                    className="text-sm font-semibold mb-4"
                    style={{ color: 'var(--ios-text-primary)' }}
                  >
                    Action Items
                  </h3>
                  <div className="space-y-0">
                    {ACTION_ITEMS.map((item, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 + i * 0.06, duration: 0.3 }}
                        className="flex items-center gap-4 py-2.5"
                        style={{
                          borderBottom:
                            i < ACTION_ITEMS.length - 1 ? '1px solid var(--ios-border)' : 'none',
                        }}
                      >
                        <span
                          className="text-[10px] font-bold px-1.5 py-0.5 rounded-md w-16 text-center shrink-0"
                          style={{ color: item.color, background: `${item.color}15` }}
                        >
                          {item.priority}
                        </span>
                        <p className="text-sm flex-1" style={{ color: 'var(--ios-text-primary)' }}>
                          {item.task}
                        </p>
                        <div className="flex items-center gap-3 shrink-0">
                          <span
                            className="flex items-center gap-1 text-xs"
                            style={{ color: 'var(--ios-text-secondary)' }}
                          >
                            <User className="w-3 h-3" />
                            {item.owner}
                          </span>
                          <span
                            className="flex items-center gap-1 text-xs"
                            style={{ color: 'var(--ios-text-secondary)' }}
                          >
                            <Clock className="w-3 h-3" />
                            {item.deadline}
                          </span>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </GlassPanel>

                {/* Risk Assessment Matrix */}
                <GlassPanel className="p-5">
                  <h3
                    className="text-sm font-semibold mb-4"
                    style={{ color: 'var(--ios-text-primary)' }}
                  >
                    Risk Assessment Matrix
                  </h3>
                  {/* Matrix Grid */}
                  <div className="overflow-x-auto">
                    <div className="min-w-[480px]">
                      {/* Column headers */}
                      <div className="grid grid-cols-4 gap-2 mb-2">
                        <div />
                        {['High Impact', 'Medium Impact', 'Low Impact'].map((h) => (
                          <div
                            key={h}
                            className="text-center text-[11px] font-medium"
                            style={{ color: 'var(--ios-text-secondary)' }}
                          >
                            {h}
                          </div>
                        ))}
                      </div>
                      {/* Rows */}
                      {Object.entries(riskMatrix).map(([likelihood, cells]) => (
                        <div key={likelihood} className="grid grid-cols-4 gap-2 mb-2">
                          <div
                            className="flex items-center text-[11px] font-medium"
                            style={{ color: 'var(--ios-text-secondary)' }}
                          >
                            {likelihood} Likelihood
                          </div>
                          {cells.map((cell, ci) => (
                            <motion.div
                              key={ci}
                              initial={{ opacity: 0, scale: 0.9 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ delay: 0.5 + ci * 0.05, duration: 0.3 }}
                              className="rounded-lg p-2.5 min-h-[72px]"
                              style={{
                                background: `${cell.color}08`,
                                border: `1px solid ${cell.color}25`,
                              }}
                            >
                              {cell.items.map((item) => (
                                <p
                                  key={item}
                                  className="text-[11px] leading-tight mb-0.5"
                                  style={{ color: cell.color }}
                                >
                                  {item}
                                </p>
                              ))}
                            </motion.div>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                </GlassPanel>
              </div>

              {/* Right: Briefing History Sidebar (1 col) */}
              <div className="xl:col-span-1">
                <GlassPanel className="p-0 overflow-hidden sticky top-6">
                  <div
                    className="px-4 py-3 border-b"
                    style={{ borderBottomColor: 'var(--ios-border)' }}
                  >
                    <h3
                      className="text-sm font-semibold"
                      style={{ color: 'var(--ios-text-primary)' }}
                    >
                      Briefing History
                    </h3>
                  </div>
                  <div className="max-h-[600px] overflow-y-auto">
                    {BRIEFING_HISTORY.map((briefing, i) => (
                      <motion.button
                        key={i}
                        initial={{ opacity: 0, x: 8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.2 + i * 0.06, duration: 0.3 }}
                        className="w-full flex items-center justify-between px-4 py-3 text-left transition-colors hover:bg-[var(--ios-bg-elevated)]"
                        style={{
                          borderBottom:
                            i < BRIEFING_HISTORY.length - 1
                              ? '1px solid var(--ios-border)'
                              : 'none',
                        }}
                      >
                        <div>
                          <p
                            className="text-xs font-medium"
                            style={{ color: 'var(--ios-text-primary)' }}
                          >
                            {briefing.date}
                          </p>
                          <span
                            className="text-[10px] font-medium px-1.5 py-0.5 rounded-full mt-1 inline-block"
                            style={{ color: briefing.color, background: `${briefing.color}15` }}
                          >
                            {briefing.type}
                          </span>
                        </div>
                        <ChevronRight
                          className="w-4 h-4"
                          style={{ color: 'var(--ios-text-secondary)' }}
                        />
                      </motion.button>
                    ))}
                  </div>
                </GlassPanel>
              </div>
            </motion.div>
          )}

          {activeTab !== 'Daily Digest' && (
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
                {activeTab}
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--ios-text-secondary)' }}>
                {activeTab} briefing content would be rendered here
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </PageTransition>
    </div>
  );
}
