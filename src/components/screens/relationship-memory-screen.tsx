'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Users, Heart, AlertTriangle, Activity, Plus, ArrowRight, Sparkles,
  Mail, Phone, MessageSquare, BookOpen, StickyNote, Clock, RefreshCw,
  Loader2, Inbox, AlertCircle, Brain,
} from 'lucide-react';
import { PageTransition, StatCard, StaggerGrid, StaggerItem, SectionHeader, GlassPanel } from '@/components/ui/animated-components';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

/* ── Types ──────────────────────────────────────────── */
type InteractionType = 'Email Sent' | 'Meeting' | 'Call' | 'Research' | 'Note';

interface Contact {
  name: string;
  initials: string;
  color: string;
}

interface TimelineEntry {
  date: string;
  type: InteractionType;
  description: string;
  nextAction?: string;
}

interface CompanyTimeline {
  id: string;
  name: string;
  health: number;
  healthColor: 'green' | 'amber' | 'red';
  contacts: Contact[];
  interactions: TimelineEntry[];
  aiNarrative?: string;
  aiHealthReasoning?: string;
}

interface RecommendedAction {
  company: string;
  companyId: string;
  person: string;
  action: string;
  reason: string;
  priority: 'high' | 'medium';
}

interface ApiStats {
  activeRelationships: number;
  strongConnections: number;
  needAttention: number;
  totalInteractions: number;
}

interface ApiWeeklyActivity {
  emailsSent: number;
  meetings: number;
  calls: number;
  notesAdded: number;
}

interface ApiCompanyTimeline {
  id: string;
  name: string;
  health: number;
  contacts: Contact[];
  interactions: Array<{
    date: string;
    type: InteractionType;
    description: string;
    nextAction?: string;
  }>;
  aiNarrative?: string;
  aiHealthReasoning?: string;
}

interface ApiRecommendedAction {
  company: string;
  companyId: string;
  person: string;
  action: string;
  reason: string;
  priority: 'high' | 'medium';
}

interface ApiData {
  stats: ApiStats;
  companyTimelines: ApiCompanyTimeline[];
  recommendedActions: ApiRecommendedAction[];
  weeklyActivity: ApiWeeklyActivity;
  aiRelationshipSummary?: string;
  aiTrendAnalysis?: string;
}

/* ── Static Maps ───────────────────────────────────── */
const interactionIcons: Record<InteractionType, typeof Mail> = {
  'Email Sent': Mail,
  Meeting: MessageSquare,
  Call: Phone,
  Research: BookOpen,
  Note: StickyNote,
};

const interactionColors: Record<InteractionType, string> = {
  'Email Sent': 'bg-blue-50 text-blue-700 border-blue-200',
  Meeting: 'bg-purple-50 text-purple-700 border-purple-200',
  Call: 'bg-green-50 text-green-700 border-green-200',
  Research: 'bg-amber-50 text-amber-700 border-amber-200',
  Note: 'bg-gray-50 text-gray-700 border-gray-200',
};

/* ── Helpers ────────────────────────────────────────── */
function getHealthColor(health: number): 'green' | 'amber' | 'red' {
  if (health >= 60) return 'green';
  if (health >= 40) return 'amber';
  return 'red';
}

function healthBarColor(healthColor: string) {
  if (healthColor === 'green') return '#10B981';
  if (healthColor === 'amber') return '#F59E0B';
  return '#EF4444';
}

function HealthBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ background: `linear-gradient(90deg, ${color}, ${color}CC)` }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
      <span className="text-xs font-semibold tabular-nums w-9 text-right" style={{ color }}>{pct}%</span>
    </div>
  );
}

/* ── Skeleton / Placeholder ─────────────────────────── */
function SkeletonPulse({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-gray-200 ${className ?? ''}`} />;
}

function LoadingSkeleton() {
  return (
    <PageTransition className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Header skeleton */}
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <SkeletonPulse className="h-7 w-52" />
          <SkeletonPulse className="h-4 w-64" />
        </div>
        <SkeletonPulse className="h-10 w-40" />
      </div>

      {/* Stats skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonPulse key={i} className="h-28 w-full rounded-xl" />
        ))}
      </div>

      {/* Main content skeleton */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-5">
          <SkeletonPulse className="h-5 w-64" />
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonPulse key={i} className="h-72 w-full rounded-xl" />
          ))}
        </div>
        <div className="space-y-5">
          <SkeletonPulse className="h-5 w-48" />
          <SkeletonPulse className="h-96 w-full rounded-xl" />
          <SkeletonPulse className="h-40 w-full rounded-xl" />
        </div>
      </div>
    </PageTransition>
  );
}

/* ── Component ──────────────────────────────────────── */
export default function RelationshipMemoryScreen({ navigateTo }: { navigateTo?: (screen: string, id?: string) => void }) {
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/ai/relationship-memory');
      if (!res.ok) {
        throw new Error(`Request failed with status ${res.status}`);
      }
      const json = await res.json();
      const apiData: ApiData = json.data ?? json;
      setData(apiData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load relationship data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /* ── Derived data ─────────────────────────────── */
  const stats = data
    ? [
        { label: 'Active Relationships', value: data.stats.activeRelationships, icon: Users, color: '#D4AF37', trend: { value: `${data.stats.activeRelationships} accounts`, up: true } },
        { label: 'Strong Connections', value: data.stats.strongConnections, icon: Heart, color: '#10B981', trend: { value: `${data.stats.strongConnections} connections`, up: true } },
        { label: 'Need Attention', value: data.stats.needAttention, icon: AlertTriangle, color: '#F59E0B', trend: { value: `${data.stats.needAttention} accounts`, up: false } },
        { label: 'Total Interactions', value: data.stats.totalInteractions, icon: Activity, color: '#6366F1', trend: { value: `${data.weeklyActivity.emailsSent + data.weeklyActivity.meetings + data.weeklyActivity.calls + data.weeklyActivity.notesAdded} this week`, up: true } },
      ]
    : [];

  const companyTimelines: CompanyTimeline[] = data
    ? data.companyTimelines.map((ct) => ({
        ...ct,
        healthColor: getHealthColor(ct.health),
      }))
    : [];

  const recommendedActions: RecommendedAction[] = data
    ? data.recommendedActions
    : [];

  const weeklyActivity = data?.weeklyActivity ?? null;

  /* ── States ───────────────────────────────────── */
  if (loading) return <LoadingSkeleton />;

  if (error) {
    return (
      <PageTransition className="p-6 max-w-7xl mx-auto">
        <div className="flex flex-col items-center justify-center py-24 space-y-4">
          <div className="w-16 h-16 rounded-full flex items-center justify-center bg-red-50">
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">Failed to Load Data</h2>
          <p className="text-sm text-muted-foreground max-w-md text-center">{error}</p>
          <Button onClick={fetchData} variant="outline" className="gap-2 mt-2">
            <RefreshCw className="w-4 h-4" /> Try Again
          </Button>
        </div>
      </PageTransition>
    );
  }

  if (!data || (data.companyTimelines.length === 0 && data.recommendedActions.length === 0)) {
    return (
      <PageTransition className="p-6 max-w-7xl mx-auto">
        <div className="flex flex-col items-center justify-center py-24 space-y-4">
          <motion.div
            animate={{ scale: [1, 1.08, 1] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
            className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.2)' }}
          >
            <Brain className="w-7 h-7" style={{ color: '#D4AF37' }} />
          </motion.div>
          <h2 className="text-lg font-semibold text-foreground">No Relationship Intelligence Yet</h2>
          <p className="text-sm text-muted-foreground max-w-md text-center">
            Start logging interactions to unlock AI-powered relationship insights. The engine will automatically identify patterns, sentiment shifts, and engagement opportunities.
          </p>
          <div className="space-y-2 mt-2">
            {[
              'Track email replies, meetings, and touchpoints',
              'AI detects relationship strength and risk signals',
              'Get proactive engagement recommendations',
            ].map((text, i) => (
              <motion.p
                key={i}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + i * 0.15, duration: 0.4 }}
                className="flex items-center gap-2 text-xs text-muted-foreground"
              >
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: '#D4AF37' }} />
                {text}
              </motion.p>
            ))}
          </div>
          <Button
            onClick={() => navigateTo?.('interactions', 'new')}
            className="gap-2 mt-3 font-medium shadow-sm"
            style={{ background: '#D4AF37', color: '#fff' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#C5A030'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = '#D4AF37'; }}
          >
            <Plus className="w-4 h-4" /> Add Your First Interaction
          </Button>
        </div>
      </PageTransition>
    );
  }

  /* ── Main Render ──────────────────────────────── */
  return (
    <PageTransition className="p-6 max-w-7xl mx-auto space-y-8">
      {/* ── 1. Page Header ─────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Relationship Memory</h1>
          <p className="text-sm text-muted-foreground mt-1">Track every interaction. Never lose context.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={fetchData}
            variant="outline"
            className="gap-2 font-medium shadow-sm"
            disabled={loading}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Refresh
          </Button>
          <Button
            onClick={() => navigateTo?.('interactions', 'new')}
            className="gap-2 font-medium shadow-sm"
            style={{ background: '#D4AF37', color: '#fff' }}
          >
            <Plus className="w-4 h-4" /> Add Interaction
          </Button>
        </div>
      </div>

      {/* ── 2. Relationship Health Overview ─────────── */}
      <StaggerGrid className="grid grid-cols-2 lg:grid-cols-4 gap-4" stagger={0.08}>
        {stats.map((s) => (
          <StaggerItem key={s.label}>
            <StatCard label={s.label} value={s.value} icon={s.icon} color={s.color} trend={s.trend} />
          </StaggerItem>
        ))}
      </StaggerGrid>

      {/* ── 2b. AI Relationship Summary ──────────── */}
      {data.aiRelationshipSummary && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.35 }}
        >
          <div
            className="rounded-xl border p-5 shadow-sm"
            style={{
              background: 'linear-gradient(135deg, #FFFDF5 0%, #FFFBEB 100%)',
              borderColor: 'rgba(184, 134, 11, 0.25)',
            }}
          >
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(184, 134, 11, 0.12)' }}>
                <Sparkles className="w-4 h-4" style={{ color: '#B8860B' }} />
              </div>
              <h3 className="text-sm font-semibold" style={{ color: '#8B6914' }}>AI Relationship Summary</h3>
              <span
                className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(184, 134, 11, 0.12)', color: '#B8860B' }}
              >
                Live AI
              </span>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: '#374151' }}>{data.aiRelationshipSummary}</p>
          </div>
        </motion.div>
      )}

      {/* ── 3 + 4. Main Content Grid ───────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left: Account Timelines (2/3) */}
        <div className="xl:col-span-2 space-y-5">
          <SectionHeader title="Account Relationship Timeline" subtitle="Recent interactions grouped by company" />

          <StaggerGrid className="space-y-5" stagger={0.1}>
            {companyTimelines.map((company) => (
              <StaggerItem key={company.id}>
                <GlassPanel className="p-5 space-y-4">
                  {/* Company header row */}
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => navigateTo?.('company', company.id)}
                      className="flex items-center gap-2 group"
                    >
                      <h3 className="text-base font-semibold text-foreground group-hover:underline underline-offset-2">
                        {company.name}
                      </h3>
                      <ArrowRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                    <span className="text-xs text-muted-foreground">{company.contacts.length} contacts</span>
                  </div>

                  {/* Health bar */}
                  <div className="space-y-1">
                    <HealthBar pct={company.health} color={healthBarColor(company.healthColor)} />
                    {company.aiHealthReasoning && (
                      <p className="text-[11px] leading-relaxed" style={{ color: '#9CA3AF' }}>
                        <Sparkles className="w-3 h-3 inline-block mr-1 -mt-0.5" style={{ color: '#D4AF37' }} />
                        {company.aiHealthReasoning}
                      </p>
                    )}
                  </div>

                  {/* Key contacts */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {company.contacts.map((c) => (
                      <div key={c.name} className="flex items-center gap-1.5 bg-gray-50 rounded-full pl-1 pr-3 py-1">
                        <span
                          className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                          style={{ background: c.color }}
                        >
                          {c.initials}
                        </span>
                        <span className="text-xs text-foreground font-medium">{c.name}</span>
                      </div>
                    ))}
                  </div>

                  {/* AI Narrative */}
                  {company.aiNarrative && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.3, duration: 0.5 }}
                      className="relative rounded-lg px-4 py-3"
                      style={{ background: 'rgba(184, 134, 11, 0.05)', borderLeft: '3px solid #D4AF37' }}
                    >
                      <p className="text-sm leading-relaxed italic" style={{ color: '#6B7280' }}>
                        <Sparkles className="w-3 h-3 inline-block mr-1 -mt-0.5" style={{ color: '#D4AF37' }} />
                        {company.aiNarrative}
                      </p>
                    </motion.div>
                  )}

                  {/* Interaction timeline */}
                  <div className="relative pl-5 border-l-2 border-gray-100 space-y-4 mt-2">
                    {company.interactions.map((entry, idx) => {
                      const Icon = interactionIcons[entry.type];
                      return (
                        <motion.div
                          key={idx}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.08, duration: 0.4 }}
                          className="relative"
                        >
                          {/* Timeline dot */}
                          <div
                            className="absolute -left-[21px] top-1.5 w-3 h-3 rounded-full border-2 border-white"
                            style={{ background: healthBarColor(company.healthColor) }}
                          />

                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs text-muted-foreground font-medium">{entry.date}</span>
                              <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${interactionColors[entry.type]}`}>
                                <Icon className="w-3 h-3 mr-1" />
                                {entry.type}
                              </Badge>
                            </div>
                            <p className="text-sm text-foreground leading-relaxed">{entry.description}</p>
                            {entry.nextAction && (
                              <div className="flex items-center gap-1.5 mt-1.5 px-2.5 py-1.5 rounded-lg bg-amber-50 border border-amber-200 w-fit">
                                <Clock className="w-3 h-3 text-amber-600" />
                                <span className="text-xs text-amber-800 font-medium">Next Action: {entry.nextAction}</span>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </GlassPanel>
              </StaggerItem>
            ))}
          </StaggerGrid>
        </div>

        {/* Right: AI Next Best Action Panel (1/3) */}
        <div className="space-y-5">
          <SectionHeader title="Today's Recommended Actions" subtitle="AI-prioritized based on relationship signals" />

          <GlassPanel
            className="p-5 space-y-4"
            style={{ borderColor: 'rgba(212, 175, 55, 0.3)' }}
          >
            {/* Panel header accent */}
            <div className="flex items-center gap-2 pb-3 border-b border-gray-100">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(212, 175, 55, 0.12)' }}>
                <Sparkles className="w-4 h-4" style={{ color: '#D4AF37' }} />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Smart Suggestions</p>
                <p className="text-[11px] text-muted-foreground">{recommendedActions.length} actions for today</p>
              </div>
            </div>

            {recommendedActions.map((rec, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 + idx * 0.1, duration: 0.4 }}
                className="group relative p-4 rounded-xl border border-gray-100 hover:border-gray-200 hover:shadow-sm transition-all bg-white space-y-2.5"
              >
                {/* Priority indicator */}
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                    style={{
                      background: rec.priority === 'high' ? 'rgba(239, 68, 68, 0.08)' : 'rgba(245, 158, 11, 0.08)',
                      color: rec.priority === 'high' ? '#DC2626' : '#D97706',
                    }}
                  >
                    {rec.priority} priority
                  </span>
                </div>

                <div>
                  <p className="text-sm font-semibold text-foreground">{rec.company}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Contact: {rec.person}</p>
                </div>

                <p className="text-sm text-foreground leading-relaxed">{rec.action}</p>

                <p className="text-[11px] text-muted-foreground italic">{rec.reason}</p>

                <Button
                  size="sm"
                  className="w-full mt-1 text-xs font-medium gap-1.5"
                  variant="outline"
                  onClick={() => navigateTo?.('company-detail', rec.companyId)}
                >
                  Do It <ArrowRight className="w-3 h-3" />
                </Button>
              </motion.div>
            ))}
          </GlassPanel>

          {/* AI Trend Analysis */}
          {data.aiTrendAnalysis && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.5 }}
            >
              <GlassPanel
                className="p-4 space-y-2"
                style={{ borderColor: 'rgba(184, 134, 11, 0.2)' }}
              >
                <div className="flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5" style={{ color: '#D4AF37' }} />
                  <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#8B6914' }}>AI Trend Insight</p>
                </div>
                <p className="text-sm leading-relaxed" style={{ color: '#6B7280' }}>{data.aiTrendAnalysis}</p>
              </GlassPanel>
            </motion.div>
          )}

          {/* Quick stats mini-card */}
          {weeklyActivity && (
            <GlassPanel className="p-4 space-y-3">
              <p className="text-xs font-semibold text-foreground uppercase tracking-wider">This Week</p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Emails Sent', value: String(weeklyActivity.emailsSent), color: '#6366F1' },
                  { label: 'Meetings', value: String(weeklyActivity.meetings), color: '#10B981' },
                  { label: 'Calls Made', value: String(weeklyActivity.calls), color: '#0EA5E9' },
                  { label: 'Notes Added', value: String(weeklyActivity.notesAdded), color: '#D4AF37' },
                ].map((item) => (
                  <div key={item.label} className="text-center p-2 rounded-lg bg-gray-50">
                    <p className="text-lg font-bold tabular-nums" style={{ color: item.color }}>{item.value}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{item.label}</p>
                  </div>
                ))}
              </div>
            </GlassPanel>
          )}
        </div>
      </div>
    </PageTransition>
  );
}