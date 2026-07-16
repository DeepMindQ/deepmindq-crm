'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Radar, AlertTriangle, Eye, TrendingUp, RefreshCw,
  Crown, DollarSign, Cpu, Globe, Clock,
  Lightbulb, Zap, ChevronRight,
  Briefcase, Building2, Target, Activity, BarChart3, Database,
} from 'lucide-react';
import { PageTransition, AnimatedCounter, EmptyState } from '@/components/ui/animated-components';
import { Skeleton } from '@/components/ui/skeleton';

/* ═══════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════ */
type ExternalType = 'hiring' | 'leadership' | 'investment' | 'technology' | 'expansion';
type InternalType = 'high_engagement' | 'score_spike';
type SignalType = ExternalType | InternalType | 'Internal';
type Priority = 'high' | 'medium' | 'low';
type SignalSource = 'external' | 'internal';

interface MergedSignal {
  id: string;
  companyId: string;
  companyName: string;
  type: ExternalType | InternalType;
  priority: Priority;
  title: string;
  description: string;
  whyItMatters?: string;
  recommendedAction?: string;
  detectedAt: string;
  source: string;
  confidence?: number;
  signalSource: SignalSource;
  contactName?: string;
  severity?: string;
}

interface ExternalResponse {
  signals: {
    id: string; companyId: string; companyName: string; type: ExternalType;
    title: string; description: string; whyItMatters: string;
    recommendedAction: string; priority: Priority; source: string;
    detectedAt: string; confidence: number;
  }[];
  scannedCompanies: number;
  totalSignalsFound: number;
}

interface InternalResponse {
  signals: {
    id: string; type: InternalType; title: string; description: string;
    contactName?: string; companyName?: string; severity?: string; detectedAt: string;
  }[];
  summary: Record<string, number>;
}

/* ═══════════════════════════════════════════════════
   Config: colors & icons per signal type
   ═══════════════════════════════════════════════════ */
const externalTypeConfig: Record<ExternalType, { color: string; bg: string; icon: React.ComponentType<{ className?: string }>; label: string }> = {
  hiring:     { color: '#2563EB', bg: 'rgba(37,99,235,0.08)',  icon: Briefcase, label: 'Hiring' },
  leadership: { color: '#7C3AED', bg: 'rgba(124,58,237,0.08)', icon: Crown,     label: 'Leadership' },
  investment: { color: '#D4AF37', bg: 'rgba(212,175,55,0.08)',  icon: DollarSign, label: 'Investment' },
  technology: { color: '#0891B2', bg: 'rgba(8,145,178,0.08)',  icon: Cpu,       label: 'Technology' },
  expansion:  { color: '#059669', bg: 'rgba(5,150,105,0.08)',  icon: Globe,     label: 'Expansion' },
};

const internalTypeConfig: Record<InternalType, { color: string; bg: string; icon: React.ComponentType<{ className?: string }>; label: string }> = {
  high_engagement: { color: '#DC2626', bg: 'rgba(220,38,38,0.08)',  icon: Activity,  label: 'High Engagement' },
  score_spike:     { color: '#EA580C', bg: 'rgba(234,88,12,0.08)',  icon: BarChart3, label: 'Score Spike' },
};

function getTypeConfig(type: ExternalType | InternalType) {
  return type in externalTypeConfig
    ? { ...externalTypeConfig[type as ExternalType], isExternal: true }
    : { ...internalTypeConfig[type as InternalType], isExternal: false };
}

const priorityConfig: Record<Priority, { color: string; bg: string; label: string }> = {
  high:   { color: '#DC2626', bg: 'rgba(220,38,38,0.08)',  label: 'High Priority' },
  medium: { color: '#D97706', bg: 'rgba(217,119,6,0.08)',  label: 'Medium' },
  low:    { color: '#6B7280', bg: 'rgba(107,114,128,0.08)', label: 'Low' },
};

const filterPills: { key: 'All' | 'Internal' | ExternalType; label: string }[] = [
  { key: 'All', label: 'All Signals' },
  { key: 'hiring', label: 'Hiring' },
  { key: 'leadership', label: 'Leadership' },
  { key: 'investment', label: 'Investment' },
  { key: 'technology', label: 'Technology' },
  { key: 'expansion', label: 'Expansion' },
  { key: 'Internal', label: 'Internal' },
];

/* ═══════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════ */
function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'Yesterday';
  return `${days}d ago`;
}

/* ═══════════════════════════════════════════════════
   Component
   ═══════════════════════════════════════════════════ */
export default function SignalIntelligenceScreen({ navigateTo }: { navigateTo?: (screen: string, id?: string) => void }) {
  const [signals, setSignals] = useState<MergedSignal[]>([]);
  const [activeFilter, setActiveFilter] = useState<'All' | 'Internal' | ExternalType>('All');
  const [scanning, setScanning] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState({ scannedCompanies: 0, totalSignalsFound: 0, highPriority: 0, internalCount: 0 });

  const fetchSignals = useCallback(async (bypassCache = false) => {
    setScanning(true);
    setError(null);
    const ts = bypassCache ? `&_t=${Date.now()}` : '';

    try {
      const [extRes, intRes] = await Promise.all([
        fetch(`/api/ai/signals${ts}`).then(r => r.json()) as Promise<ExternalResponse>,
        fetch('/api/signals').then(r => r.json()) as Promise<InternalResponse>,
      ]);

      const external: MergedSignal[] = (extRes.signals ?? []).map(s => ({
        ...s, signalSource: 'external' as const,
        companyId: s.companyId ?? '', companyName: s.companyName ?? 'Unknown',
      }));
      const internal: MergedSignal[] = (intRes.signals ?? []).map(s => ({
        id: s.id, companyId: '', companyName: s.companyName ?? '',
        type: s.type, priority: (s.severity ?? 'medium') as Priority,
        title: s.title, description: s.description,
        detectedAt: s.detectedAt, source: 'CRM / Database',
        signalSource: 'internal' as const, contactName: s.contactName,
      }));

      const merged = [...external, ...internal].sort(
        (a, b) => new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime(),
      );

      setSignals(merged);
      setMeta({
        scannedCompanies: extRes.scannedCompanies ?? 0,
        totalSignalsFound: extRes.totalSignalsFound ?? merged.length,
        highPriority: merged.filter(s => s.priority === 'high').length,
        internalCount: internal.length,
      });
    } catch (err) {
      setError('Failed to load signals. Please try again.');
    } finally {
      setScanning(false);
    }
  }, []);

  useEffect(() => { fetchSignals(); }, [fetchSignals]);

  const filteredSignals = useMemo(() => {
    if (activeFilter === 'All') return signals;
    if (activeFilter === 'Internal') return signals.filter(s => s.signalSource === 'internal');
    return signals.filter(s => s.signalSource === 'external' && s.type === activeFilter);
  }, [signals, activeFilter]);

  const summaryCards = [
    { label: 'Total Signals', value: meta.totalSignalsFound, icon: Radar, color: '#2563EB', bg: 'rgba(37,99,235,0.08)' },
    { label: 'High Priority', value: meta.highPriority, icon: AlertTriangle, color: '#DC2626', bg: 'rgba(220,38,38,0.08)' },
    { label: 'Companies Scanned', value: meta.scannedCompanies, icon: Eye, color: '#D4AF37', bg: 'rgba(212,175,55,0.08)' },
    { label: 'Internal Alerts', value: meta.internalCount, icon: Database, color: '#059669', bg: 'rgba(5,150,105,0.08)' },
  ];

  return (
    <PageTransition className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

        {/* ─── Page Header ─── */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <motion.h1
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight"
            >
              Signal Intelligence
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
              className="text-sm text-muted-foreground mt-1"
            >
              AI-powered change detection across your accounts
            </motion.p>
          </div>
          <motion.button
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => fetchSignals(true)}
            disabled={scanning}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white transition-all duration-200 disabled:opacity-60 cursor-pointer"
            style={{
              background: 'linear-gradient(135deg, #D4AF37, #C5A030)',
              boxShadow: scanning ? '0 0 20px rgba(212,175,55,0.3)' : '0 2px 8px rgba(212,175,55,0.25)',
            }}
          >
            <motion.span
              animate={scanning ? { rotate: 360 } : { rotate: 0 }}
              transition={scanning ? { duration: 1, repeat: Infinity, ease: 'linear' } : { duration: 0 }}
            >
              <RefreshCw className="w-4 h-4" />
            </motion.span>
            {scanning ? 'Scanning…' : 'Scan Now'}
          </motion.button>
        </div>

        {/* ─── Summary Cards ─── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {summaryCards.map((card, i) => (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.15 + i * 0.07, ease: [0.22, 1, 0.36, 1] }}
              whileHover={{ y: -3, transition: { duration: 0.2 } }}
              className="bg-white border border-gray-200 rounded-xl shadow-sm p-5"
            >
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">{card.label}</p>
                  <p className="text-3xl font-bold tabular-nums" style={{ color: card.color }}>
                    {scanning ? <Skeleton className="h-8 w-12 rounded" /> : <AnimatedCounter value={card.value} />}
                  </p>
                </div>
                <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: card.bg }}>
                  <card.icon className="w-5 h-5" style={{ color: card.color }} />
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* ─── Filters + Signal Feed ─── */}
        <div className="space-y-5">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
          >
            <div className="flex items-center gap-3">
              <div
                className="h-6 w-1.5 rounded-full"
                style={{ background: 'linear-gradient(180deg, #E8C860, #D4AF37, #9A8340)', boxShadow: '0 0 12px rgba(212,175,55,0.3)' }}
              />
              <h2 className="text-lg font-bold text-foreground tracking-tight">Live Signal Feed</h2>
              <span className="text-xs text-muted-foreground bg-gray-100 px-2 py-0.5 rounded-full">
                {filteredSignals.length} signal{filteredSignals.length !== 1 ? 's' : ''}
              </span>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              {filterPills.map(pill => {
                const isActive = activeFilter === pill.key;
                const count = pill.key === 'All'
                  ? signals.length
                  : pill.key === 'Internal'
                    ? signals.filter(s => s.signalSource === 'internal').length
                    : signals.filter(s => s.signalSource === 'external' && s.type === pill.key).length;

                return (
                  <motion.button
                    key={pill.key}
                    onClick={() => setActiveFilter(pill.key)}
                    whileTap={{ scale: 0.95 }}
                    className={`relative inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                      isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground/80'
                    }`}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="signal-filter-pill"
                        className="absolute inset-0 rounded-full"
                        style={{
                          background: 'linear-gradient(135deg, rgba(212,175,55,0.12), rgba(212,175,55,0.06))',
                          border: '1px solid rgba(212,175,55,0.25)',
                        }}
                        transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                      />
                    )}
                    <span className="relative z-10">{pill.label}</span>
                    <span className={`relative z-10 text-[10px] px-1.5 py-0.5 rounded-full ${
                      isActive ? 'bg-[#D4AF37]/20 text-[#D4AF37] font-semibold' : 'bg-gray-100 text-muted-foreground'
                    }`}>
                      {count}
                    </span>
                  </motion.button>
                );
              })}
            </div>
          </motion.div>

          {/* ─── Loading Skeleton ─── */}
          <AnimatePresence mode="wait">
            {scanning ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-4"
              >
                <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
                  >
                    <Radar className="w-5 h-5 text-[#D4AF37]" />
                  </motion.div>
                  Scanning for signals…
                </div>
                {[1, 2, 3].map(i => (
                  <div key={i} className="bg-white border border-gray-200 rounded-xl p-5 sm:p-6 space-y-3">
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-6 w-20 rounded-md" />
                      <Skeleton className="h-5 w-32 rounded" />
                      <Skeleton className="h-5 w-20 rounded-full ml-auto" />
                    </div>
                    <Skeleton className="h-5 w-3/4 rounded" />
                    <Skeleton className="h-4 w-full rounded" />
                    <Skeleton className="h-4 w-2/3 rounded" />
                    <Skeleton className="h-16 w-full rounded-lg" />
                  </div>
                ))}
              </motion.div>

            ) : error ? (
              <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <EmptyState icon={AlertTriangle} title={error} description="Please check your connection and try again." />
              </motion.div>

            ) : signals.length === 0 ? (
              <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <EmptyState
                  icon={Radar}
                  title="No companies to scan"
                  description="Add companies first to start detecting signals."
                />
              </motion.div>

            ) : filteredSignals.length === 0 ? (
              <motion.div key="filter-empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <EmptyState
                  icon={Radar}
                  title="No signals found"
                  description={`No ${activeFilter} signals detected in the current time range.`}
                />
              </motion.div>

            ) : (
              <motion.div key="signals" className="space-y-4">
                {filteredSignals.map((signal, index) => {
                  const tCfg = getTypeConfig(signal.type);
                  const pCfg = priorityConfig[signal.priority];
                  const TypeIcon = tCfg.icon;
                  const isExternal = signal.signalSource === 'external';

                  return (
                    <motion.div
                      key={signal.id}
                      layout
                      initial={{ opacity: 0, y: 16, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ duration: 0.4, delay: index * 0.05, ease: [0.22, 1, 0.36, 1] }}
                      className="relative bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-shadow duration-300 overflow-hidden group"
                    >
                      <div className="p-5 sm:p-6">
                        {/* Top row: type badge, company, priority, source, timestamp */}
                        <div className="flex flex-wrap items-center gap-2.5 mb-3">
                          <span
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold"
                            style={{ background: tCfg.bg, color: tCfg.color }}
                          >
                            <TypeIcon className="w-3.5 h-3.5" />
                            {tCfg.label}
                          </span>

                          {signal.companyName && (
                            <button
                              onClick={() => signal.companyId && navigateTo?.('company-detail', signal.companyId)}
                              className="text-sm font-semibold text-foreground hover:text-[#D4AF37] transition-colors cursor-pointer inline-flex items-center gap-1"
                            >
                              {signal.companyName}
                              {signal.companyId && (
                                <ChevronRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                              )}
                            </button>
                          )}

                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold"
                            style={{ background: pCfg.bg, color: pCfg.color }}
                          >
                            {signal.priority === 'high' && <Zap className="w-3 h-3" />}
                            {pCfg.label}
                          </span>

                          {/* Source tag */}
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
                            style={{
                              background: isExternal ? 'rgba(37,99,235,0.06)' : 'rgba(5,150,105,0.06)',
                              color: isExternal ? '#2563EB' : '#059669',
                            }}
                          >
                            {isExternal ? (
                              <>
                                <Activity className="w-3 h-3" />
                                AI Detected
                              </>
                            ) : (
                              <>
                                <Database className="w-3 h-3" />
                                Internal
                              </>
                            )}
                          </span>

                          {/* Confidence (external only) */}
                          {isExternal && signal.confidence != null && (
                            <span className="inline-flex items-center gap-2 text-[11px] text-muted-foreground">
                              <TrendingUp className="w-3 h-3" />
                              <span className="font-medium">{signal.confidence}%</span>
                              <span className="w-16 h-1.5 rounded-full bg-gray-100 inline-block overflow-hidden">
                                <span className="block h-full rounded-full" style={{ width: `${signal.confidence}%`, background: signal.confidence >= 80 ? '#059669' : signal.confidence >= 60 ? '#D4AF37' : '#DC2626', transition: 'width 0.8s ease' }} />
                              </span>
                            </span>
                          )}

                          <span className="ml-auto text-xs text-muted-foreground hidden sm:inline-flex items-center gap-1.5">
                            <Clock className="w-3 h-3" />
                            {formatTimeAgo(signal.detectedAt)}
                          </span>
                        </div>

                        {/* Mobile timestamp */}
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3 sm:hidden">
                          <Clock className="w-3 h-3" />
                          {formatTimeAgo(signal.detectedAt)}
                        </div>

                        {/* Title */}
                        <h3 className="text-[15px] font-semibold text-foreground mb-2 leading-snug">
                          {signal.title}
                        </h3>

                        {/* Description */}
                        <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                          {signal.description}
                        </p>

                        {/* Why it matters (external only) */}
                        {isExternal && signal.whyItMatters && (
                          <div className="rounded-lg bg-gray-50 border border-gray-100 p-4 mb-4">
                            <div className="flex items-center gap-2 mb-1.5">
                              <Lightbulb className="w-4 h-4 text-[#D4AF37]" />
                              <span className="text-xs font-semibold uppercase tracking-wider text-[#D4AF37]">
                                Why It Matters
                              </span>
                            </div>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                              {signal.whyItMatters}
                            </p>
                          </div>
                        )}

                        {/* Recommended Action (external only) */}
                        {isExternal && signal.recommendedAction && (
                          <div className="rounded-lg border border-gray-100 p-4" style={{ background: 'linear-gradient(135deg, rgba(212,175,55,0.03), transparent)' }}>
                            <div className="flex items-center gap-2 mb-1.5">
                              <Target className="w-4 h-4 text-foreground" />
                              <span className="text-xs font-semibold uppercase tracking-wider text-foreground">
                                Recommended Action
                              </span>
                            </div>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                              {signal.recommendedAction}
                            </p>
                          </div>
                        )}

                        {/* Internal: contact info */}
                        {!isExternal && signal.contactName && (
                          <div className="rounded-lg bg-gray-50 border border-gray-100 p-4">
                            <div className="flex items-center gap-2 mb-1.5">
                              <Building2 className="w-4 h-4 text-foreground" />
                              <span className="text-xs font-semibold uppercase tracking-wider text-foreground">
                                Contact
                              </span>
                            </div>
                            <p className="text-sm text-muted-foreground">{signal.contactName}</p>
                          </div>
                        )}
                      </div>

                      {/* Left accent stripe */}
                      <div
                        className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                        style={{ background: `linear-gradient(180deg, ${tCfg.color}, ${tCfg.color}60)` }}
                      />
                    </motion.div>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </PageTransition>
  );
}