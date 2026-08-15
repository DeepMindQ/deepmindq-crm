'use client';

import { useState, useEffect } from 'react';
import {
  Brain,
  Sparkles,
  Target,
  Users,
  MessageSquare,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Loader2,
  Shield,
  AlertTriangle,
  Clock,
  TrendingUp,
  Zap,
  ArrowRight,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchApi } from '@/lib/fetchApi';

// ── Types (mirror of AccountBrief from route) ──

interface ExecutiveBriefSection {
  title: string;
  content: string;
  evidence?: string;
  confidence: number;
  actionItems?: string[];
}

interface TargetStakeholder {
  role: string;
  focus: string;
  whyApproach: string;
  conversationAngle: string;
  evidence: string;
  priority: 'primary' | 'secondary' | 'tertiary';
}

interface ConversationStarter {
  context: string;
  opening: string;
  evidence: string;
  expectedReaction: string;
}

interface AccountBrief {
  executiveSummary: string;
  executiveSummaryConfidence: number;
  currentState: ExecutiveBriefSection;
  businessChallenges: ExecutiveBriefSection;
  technologyChallenges: ExecutiveBriefSection;
  strategicOpportunities: ExecutiveBriefSection;
  strategicPriority: string;
  keySignals: Array<{ signal: string; evidence: string; confidence: number }>;
  overallConfidence: number;
  targetStakeholders: TargetStakeholder[];
  conversationStarters: ConversationStarter[];
  recommendedEngagement: {
    approach: string;
    timeline: string;
    firstMeetingGoal: string;
    successCriteria: string[];
    evidence: string;
  };
  sources: Array<{ title: string; url: string; snippet: string }>;
}

// ── Sub-components ──

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const color =
    confidence >= 75
      ? 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20'
      : confidence >= 50
        ? 'text-amber-400 bg-amber-400/10 border-amber-400/20'
        : 'text-red-400 bg-red-400/10 border-red-400/20';
  const label =
    confidence >= 75
      ? 'High Confidence'
      : confidence >= 50
        ? 'Medium Confidence'
        : 'Low Confidence';
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium border rounded-full ${color}`}
    >
      <Shield className="size-3" />
      {label} · {confidence}%
    </span>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const isHigh = priority.toLowerCase().includes('high');
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold rounded-full ${isHigh ? 'text-rose-400 bg-rose-400/10 border border-rose-400/20' : 'text-blue-400 bg-blue-400/10 border border-blue-400/20'}`}
    >
      <TrendingUp className="size-3" />
      {priority}
    </span>
  );
}

function SignalPill({
  signal,
  evidence,
  confidence,
}: {
  signal: string;
  evidence: string;
  confidence: number;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="group">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left flex items-start gap-2.5 p-3 rounded-lg hover:bg-[var(--ios-bg-card-hover)] hover:border-[var(--ios-border-hover)] transition-all"
        style={{
          background: 'var(--ios-bg-card)',
          border: '1px solid var(--ios-border)',
        }}
      >
        <div
          className="mt-0.5 size-2 rounded-full shrink-0"
          style={{
            backgroundColor:
              confidence >= 75 ? '#34d399' : confidence >= 50 ? '#fbbf24' : '#f87171',
          }}
        />
        <div className="flex-1 min-w-0">
          <p className="text-[13px] leading-relaxed" style={{ color: 'var(--ios-text-primary)' }}>
            {signal}
          </p>
          <AnimatePresence>
            {expanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <p
                  className="mt-1.5 text-[11px] leading-relaxed"
                  style={{ color: 'var(--ios-text-muted)' }}
                >
                  {evidence}
                </p>
                <p className="mt-1 text-[10px]" style={{ color: 'var(--ios-text-muted)' }}>
                  Confidence: {confidence}%
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        {expanded ? (
          <ChevronDown
            className="size-3.5 shrink-0 mt-0.5"
            style={{ color: 'var(--ios-text-muted)' }}
          />
        ) : (
          <ChevronRight
            className="size-3.5 shrink-0 mt-0.5"
            style={{ color: 'var(--ios-text-muted)' }}
          />
        )}
      </button>
    </motion.div>
  );
}

function StakeholderCard({ s }: { s: TargetStakeholder }) {
  const priorityColor =
    s.priority === 'primary'
      ? 'border-emerald-500/30'
      : s.priority === 'secondary'
        ? 'border-amber-500/30'
        : '';
  const priorityBg =
    s.priority === 'primary'
      ? 'rgba(16,185,129,0.04)'
      : s.priority === 'secondary'
        ? 'rgba(245,158,11,0.04)'
        : 'var(--ios-bg-card)';
  const priorityBorder =
    s.priority === 'primary'
      ? 'rgba(16,185,129,0.3)'
      : s.priority === 'secondary'
        ? 'rgba(245,158,11,0.3)'
        : 'var(--ios-border)';
  const priorityLabel =
    s.priority === 'primary' ? 'Primary' : s.priority === 'secondary' ? 'Secondary' : 'Tertiary';
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`p-4 rounded-xl border ${priorityColor}`}
      style={{ background: priorityBg, borderColor: priorityBorder }}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Users className="size-3.5" style={{ color: 'var(--ios-text-secondary)' }} />
          <span className="text-[13px] font-semibold" style={{ color: 'var(--ios-text-primary)' }}>
            {s.role}
          </span>
        </div>
        <span
          className="text-[10px] font-medium uppercase tracking-wider"
          style={{ color: 'var(--ios-text-muted)' }}
        >
          {priorityLabel}
        </span>
      </div>
      <p className="text-[12px] mb-1.5" style={{ color: 'var(--ios-text-secondary)' }}>
        <span style={{ color: 'var(--ios-text-muted)' }} className="font-medium">
          Focus:
        </span>{' '}
        {s.focus}
      </p>
      <p className="text-[12px] mb-1.5" style={{ color: 'var(--ios-text-secondary)' }}>
        <span style={{ color: 'var(--ios-text-muted)' }} className="font-medium">
          Why approach:
        </span>{' '}
        {s.whyApproach}
      </p>
      <div
        className="mt-2 p-2.5 rounded-lg"
        style={{ background: 'var(--ios-bg-card)', border: '1px solid var(--ios-border)' }}
      >
        <p className="text-[11px] mb-1" style={{ color: 'var(--ios-text-muted)' }}>
          Conversation angle
        </p>
        <p
          className="text-[12px] italic leading-relaxed"
          style={{ color: 'var(--ios-text-secondary)' }}
        >
          "{s.conversationAngle}"
        </p>
      </div>
    </motion.div>
  );
}

function ConversationCard({ c }: { c: ConversationStarter }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 rounded-xl"
      style={{ background: 'var(--ios-bg-card)', border: '1px solid var(--ios-border)' }}
    >
      <div className="flex items-center gap-1.5 mb-2">
        <MessageSquare className="size-3.5" style={{ color: 'var(--ios-accent)' }} />
        <span
          className="text-[11px] font-medium uppercase tracking-wider"
          style={{ color: 'var(--ios-accent)' }}
        >
          {c.context}
        </span>
      </div>
      <p
        className="text-[13px] leading-relaxed italic mb-2"
        style={{ color: 'var(--ios-text-primary)' }}
      >
        "{c.opening}"
      </p>
      <p className="text-[11px]" style={{ color: 'var(--ios-text-muted)' }}>
        Expected: {c.expectedReaction}
      </p>
    </motion.div>
  );
}

function SectionCard({
  section,
  icon: Icon,
  accentColor,
}: {
  section: ExecutiveBriefSection;
  icon: typeof Brain;
  accentColor: string;
}) {
  const [showEvidence, setShowEvidence] = useState(false);
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 rounded-xl hover:border-[var(--ios-border-hover)] transition-all"
      style={{ background: 'var(--ios-bg-card)', border: '1px solid var(--ios-border)' }}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Icon className={`size-3.5 ${accentColor}`} />
          <span className="text-[13px] font-semibold" style={{ color: 'var(--ios-text-primary)' }}>
            {section.title}
          </span>
        </div>
        <ConfidenceBadge confidence={section.confidence} />
      </div>
      <p
        className="text-[13px] leading-relaxed mb-3"
        style={{ color: 'var(--ios-text-secondary)' }}
      >
        {section.content}
      </p>
      {section.evidence && (
        <button
          onClick={() => setShowEvidence(!showEvidence)}
          className="text-[11px] flex items-center gap-1 transition-colors hover:text-[var(--ios-text-secondary)]"
          style={{ color: 'var(--ios-text-muted)' }}
        >
          {showEvidence ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
          {showEvidence ? 'Hide' : 'Show'} evidence
        </button>
      )}
      <AnimatePresence>
        {showEvidence && section.evidence && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <p
              className="mt-2 text-[11px] leading-relaxed pl-3 border-l-2"
              style={{ color: 'var(--ios-text-muted)', borderLeftColor: 'var(--ios-border)' }}
            >
              {section.evidence}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
      {section.actionItems && section.actionItems.length > 0 && (
        <div className="mt-3 space-y-1">
          {section.actionItems.slice(0, 3).map((item, i) => (
            <div key={i} className="flex items-start gap-2">
              <ArrowRight
                className="size-3 shrink-0 mt-0.5"
                style={{ color: 'var(--ios-text-muted)' }}
              />
              <p className="text-[11px]" style={{ color: 'var(--ios-text-secondary)' }}>
                {item}
              </p>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}

// ── Main Component ──

interface IntelligenceBriefingProps {
  companyId: string;
  companyName?: string;
}

type BriefTab = 'overview' | 'stakeholders' | 'conversation';

export function IntelligenceBriefing({ companyId }: IntelligenceBriefingProps) {
  const [brief, setBrief] = useState<AccountBrief | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<BriefTab>('overview');

  const fetchBrief = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await fetchApi(`/api/ai/account-brief`, {
        params: { companyId },
      });
      if (fetchError || !data) throw new Error(fetchError || 'Invalid response format');
      if (data.success && data.data?.brief) {
        setBrief(data.data.brief);
      } else {
        throw new Error(data.error || 'Invalid response format');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load intelligence briefing');
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (companyId) fetchBrief();
  }, [companyId]);

  // Loading state
  if (loading) {
    return (
      <div
        className="rounded-2xl p-6 space-y-4"
        style={{
          background:
            'linear-gradient(to bottom right, rgba(139,92,246,0.06), rgba(99,102,241,0.04), transparent)',
          border: '1px solid var(--ios-border)',
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="size-10 rounded-xl flex items-center justify-center"
            style={{ background: 'var(--ios-bg-card)' }}
          >
            <Brain className="size-5 animate-pulse" style={{ color: 'var(--ios-accent)' }} />
          </div>
          <div>
            <div
              className="h-4 w-48 rounded animate-pulse"
              style={{ background: 'var(--ios-bg-card)' }}
            />
            <div
              className="h-3 w-32 rounded animate-pulse mt-1.5"
              style={{ background: 'var(--ios-bg-card)' }}
            />
          </div>
        </div>
        <div className="space-y-2 mt-6">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-3 rounded animate-pulse"
              style={{
                width: `${90 - i * 15}%`,
                animationDelay: `${i * 200}ms`,
                background: 'var(--ios-bg-card)',
              }}
            />
          ))}
        </div>
        <div className="flex items-center gap-2 mt-4">
          <Loader2 className="size-3.5 animate-spin" style={{ color: 'var(--ios-accent)' }} />
          <span className="text-[11px]" style={{ color: 'var(--ios-accent)', opacity: 0.7 }}>
            Generating intelligence briefing...
          </span>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="rounded-2xl border border-red-500/20 bg-red-500/[0.04] p-6">
        <div className="flex items-center gap-3 mb-3">
          <AlertTriangle className="size-5 text-red-400" />
          <div>
            <p className="text-sm font-medium text-red-300">Intelligence Briefing Unavailable</p>
            <p className="text-[12px] text-red-400/60 mt-0.5">{error}</p>
          </div>
        </div>
        <button
          onClick={fetchBrief}
          className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-red-300 border border-red-500/20 rounded-lg hover:bg-red-500/10 transition-colors"
        >
          <Sparkles className="size-3" />
          Retry
        </button>
      </div>
    );
  }

  // No brief
  if (!brief) return null;

  const tabs: { key: BriefTab; label: string; icon: typeof Brain }[] = [
    { key: 'overview', label: 'Intelligence Overview', icon: Brain },
    { key: 'stakeholders', label: 'Stakeholders', icon: Users },
    { key: 'conversation', label: 'Conversation Prep', icon: MessageSquare },
  ];

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background:
          'linear-gradient(to bottom right, rgba(139,92,246,0.06), rgba(99,102,241,0.04), transparent)',
        border: '1px solid var(--ios-border)',
      }}
    >
      {/* ── Header ── */}
      <div className="px-6 pt-5 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="size-10 rounded-xl flex items-center justify-center"
              style={{
                background:
                  'linear-gradient(to bottom right, rgba(139,92,246,0.2), rgba(99,102,241,0.2))',
                border: '1px solid rgba(139,92,246,0.2)',
              }}
            >
              <Brain className="size-5" style={{ color: 'var(--ios-accent)' }} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2
                  className="text-[15px] font-semibold"
                  style={{ color: 'var(--ios-text-primary)' }}
                >
                  AI Intelligence Briefing
                </h2>
                <ConfidenceBadge confidence={brief.overallConfidence} />
              </div>
              <p className="text-[12px] mt-0.5" style={{ color: 'var(--ios-text-muted)' }}>
                Generated by DeepMindQ Intelligence Engine
                <span className="mx-1.5" style={{ color: 'var(--ios-text-muted)' }}>
                  ·
                </span>
                <PriorityBadge priority={brief.strategicPriority} />
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchBrief}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium rounded-lg transition-all hover:bg-[var(--ios-bg-card-hover)] hover:text-[var(--ios-text-secondary)]"
              style={{
                color: 'var(--ios-text-secondary)',
                border: '1px solid var(--ios-border)',
              }}
              title="Regenerate briefing"
            >
              <Sparkles className="size-3" />
              Regenerate
            </button>
          </div>
        </div>

        {/* Executive Summary */}
        <div
          className="mt-4 p-4 rounded-xl"
          style={{ background: 'var(--ios-bg-card)', border: '1px solid var(--ios-border)' }}
        >
          <p className="text-[13px] leading-relaxed" style={{ color: 'var(--ios-text-primary)' }}>
            {brief.executiveSummary}
          </p>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div style={{ borderBottom: '1px solid var(--ios-border)' }}>
        <div className="flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-[12px] font-medium transition-all border-b-2 -mb-px ${activeTab === tab.key ? '' : 'border-transparent hover:text-[var(--ios-text-secondary)]'}`}
              style={{
                color: activeTab === tab.key ? 'var(--ios-accent)' : 'var(--ios-text-muted)',
                borderBottomColor: activeTab === tab.key ? 'var(--ios-accent)' : 'transparent',
              }}
            >
              <tab.icon className="size-3.5" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab Content ── */}
      <div className="p-6">
        <AnimatePresence mode="wait">
          {activeTab === 'overview' && (
            <motion.div
              key="overview"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="space-y-4"
            >
              {/* Key Signals */}
              {brief.keySignals.length > 0 && (
                <div>
                  <h3
                    className="text-[12px] font-semibold uppercase tracking-wider mb-3 flex items-center gap-2"
                    style={{ color: 'var(--ios-text-secondary)' }}
                  >
                    <Zap className="size-3.5 text-amber-400" />
                    Key Signals ({brief.keySignals.length})
                  </h3>
                  <div className="space-y-2">
                    {brief.keySignals.map((s, i) => (
                      <SignalPill
                        key={i}
                        signal={s.signal}
                        evidence={s.evidence}
                        confidence={s.confidence}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Intelligence Sections */}
              <div className="grid gap-4 md:grid-cols-2">
                <SectionCard
                  section={brief.strategicOpportunities}
                  icon={TrendingUp}
                  accentColor="text-emerald-400"
                />
                <SectionCard
                  section={brief.businessChallenges}
                  icon={AlertTriangle}
                  accentColor="text-amber-400"
                />
                <SectionCard
                  section={brief.technologyChallenges}
                  icon={Brain}
                  accentColor="text-blue-400"
                />
                <SectionCard
                  section={brief.currentState}
                  icon={Clock}
                  accentColor="text-[var(--ios-accent)]"
                />
              </div>

              {/* Engagement Strategy */}
              {brief.recommendedEngagement && (
                <div className="mt-2 p-4 rounded-xl border border-emerald-500/15 bg-emerald-500/[0.03]">
                  <h3 className="text-[12px] font-semibold text-emerald-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Target className="size-3.5" />
                    Recommended Engagement
                  </h3>
                  <p
                    className="text-[13px] leading-relaxed mb-2"
                    style={{ color: 'var(--ios-text-secondary)' }}
                  >
                    {brief.recommendedEngagement.approach}
                  </p>
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <div>
                      <p
                        className="text-[11px] font-medium"
                        style={{ color: 'var(--ios-text-muted)' }}
                      >
                        Timeline
                      </p>
                      <p className="text-[12px]" style={{ color: 'var(--ios-text-secondary)' }}>
                        {brief.recommendedEngagement.timeline}
                      </p>
                    </div>
                    <div>
                      <p
                        className="text-[11px] font-medium"
                        style={{ color: 'var(--ios-text-muted)' }}
                      >
                        First Meeting Goal
                      </p>
                      <p className="text-[12px]" style={{ color: 'var(--ios-text-secondary)' }}>
                        {brief.recommendedEngagement.firstMeetingGoal}
                      </p>
                    </div>
                  </div>
                  {brief.recommendedEngagement.successCriteria.length > 0 && (
                    <div className="mt-3">
                      <p
                        className="text-[11px] font-medium mb-1.5"
                        style={{ color: 'var(--ios-text-muted)' }}
                      >
                        Success Criteria
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {brief.recommendedEngagement.successCriteria.map((c, i) => (
                          <span
                            key={i}
                            className="px-2 py-0.5 text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/15 rounded-full"
                          >
                            {c}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Sources */}
              {brief.sources.length > 0 && (
                <div className="mt-2">
                  <button
                    onClick={(e) => {
                      const el = e.currentTarget.nextElementSibling;
                      if (el) el.classList.toggle('hidden');
                    }}
                    className="text-[11px] flex items-center gap-1 transition-colors hover:text-[var(--ios-text-secondary)]"
                    style={{ color: 'var(--ios-text-muted)' }}
                  >
                    <ExternalLink className="size-3" />
                    {brief.sources.length} intelligence sources
                    <ChevronRight className="size-3" />
                  </button>
                  <div className="hidden mt-2 space-y-1 max-h-32 overflow-y-auto">
                    {brief.sources.slice(0, 10).map((s, i) => (
                      <a
                        key={i}
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block text-[11px] truncate transition-colors hover:text-[var(--ios-accent)]"
                        style={{ color: 'var(--ios-accent)', opacity: 0.7 }}
                      >
                        {s.title} <span style={{ color: 'var(--ios-text-muted)' }}>— {s.url}</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'stakeholders' && (
            <motion.div
              key="stakeholders"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
            >
              {brief.targetStakeholders.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {brief.targetStakeholders.map((s, i) => (
                    <StakeholderCard key={i} s={s} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Users
                    className="size-8 mx-auto mb-3"
                    style={{ color: 'var(--ios-text-muted)' }}
                  />
                  <p className="text-[13px]" style={{ color: 'var(--ios-text-muted)' }}>
                    No stakeholders identified yet
                  </p>
                  <p className="text-[11px] mt-1" style={{ color: 'var(--ios-text-muted)' }}>
                    Add contacts to this company to generate stakeholder intelligence
                  </p>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'conversation' && (
            <motion.div
              key="conversation"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="space-y-4"
            >
              <h3
                className="text-[12px] font-semibold uppercase tracking-wider flex items-center gap-2"
                style={{ color: 'var(--ios-text-secondary)' }}
              >
                <MessageSquare className="size-3.5" style={{ color: 'var(--ios-accent)' }} />
                Conversation Starters
              </h3>
              {brief.conversationStarters.length > 0 ? (
                <div className="space-y-3">
                  {brief.conversationStarters.map((c, i) => (
                    <ConversationCard key={i} c={c} />
                  ))}
                </div>
              ) : (
                <p className="text-[12px] py-4" style={{ color: 'var(--ios-text-muted)' }}>
                  No conversation starters generated. Regenerate the briefing for more data.
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
