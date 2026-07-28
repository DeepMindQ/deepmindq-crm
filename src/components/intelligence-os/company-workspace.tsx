'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2, Brain, Zap, Target, Users, Sparkles,
  ArrowLeft, ExternalLink, RefreshCw, Shield, ChevronRight,
  CheckCircle2, AlertTriangle, HelpCircle, Clock, ArrowUpRight,
  TrendingUp, TrendingDown, Minus, Eye, Layers, Play, Wrench,
  FileText, BarChart3, Share2, Download, ThumbsUp, ThumbsDown,
  MessageSquare,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAppStore } from '@/lib/store';
import type { CompanyIntelligence, IntelligenceObject, EvidenceState, ExecutiveBriefData } from '@/lib/intelligence-types';

/* ═══════════════════════════════════════════════════════════════════════════
   Company Intelligence Workspace — The Gold Standard
   
   "How do I win this account?"
   
   Narrative-first. Not tab-first.
   The user enters an intelligence environment, not a company profile page.
   
   Structure:
   1. Executive Understanding — What changed? Why it matters?
   2. Evidence & Confidence — Signals, sources, freshness
   3. Capability Alignment — Need → Capability → Proof → Positioning
   4. Stakeholders — Who influences this?
   5. Actions — What should happen next?
   6. Intelligence History — How understanding evolved
   
   Every intelligence item has an evidence state:
   confirmed | inferred | unknown
   
   Human feedback on every item:
   accurate | outdated | incorrect
   
   Phase B ready: UI consumes Intelligence Objects.
   ═══════════════════════════════════════════════════════════════════════════ */

/* ── Evidence State Badge ── */
function EvidenceStateIndicator({ state }: { state: EvidenceState }) {
  const config = {
    confirmed: { label: 'Confirmed', color: '#059669', bg: 'rgba(5,150,105,0.08)', icon: CheckCircle2 },
    inferred: { label: 'Inferred', color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', icon: Brain },
    unknown: { label: 'Unknown', color: '#94a3b8', bg: 'rgba(148,163,184,0.08)', icon: HelpCircle },
  }[state];
  const Icon = config.icon;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium" style={{ background: config.bg, color: config.color }}>
      <Icon className="w-2.5 h-2.5" />
      {config.label}
    </span>
  );
}

/* ── Freshness Indicator ── */
function FreshnessIndicator({ lastEnriched, staleness }: { lastEnriched: string; staleness: string }) {
  const config = {
    fresh: { label: 'Fresh', color: '#059669' },
    aging: { label: 'Aging', color: '#f59e0b' },
    stale: { label: 'Stale', color: '#ef4444' },
    unknown: { label: 'Unknown', color: '#94a3b8' },
  }[staleness] || { label: 'Unknown', color: '#94a3b8' };
  
  const dateStr = new Date(lastEnriched).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

  return (
    <span className="inline-flex items-center gap-1.5 text-[10px]" style={{ color: config.color }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: config.color }} />
      {config.label} · {dateStr}
    </span>
  );
}

/* ── Confidence Display ── */
function ConfidenceDisplay({ value, size = 'sm' }: { value: number; size?: 'sm' | 'lg' }) {
  const color = value >= 75 ? '#059669' : value >= 50 ? '#f59e0b' : '#ef4444';
  const bg = value >= 75 ? 'rgba(5,150,105,0.08)' : value >= 50 ? 'rgba(245,158,11,0.08)' : 'rgba(239,68,68,0.08)';
  if (size === 'lg') {
    return (
      <div className="flex items-baseline gap-1">
        <span className="text-3xl font-bold tabular-nums tracking-tight" style={{ color }}>{value}</span>
        <span className="text-sm font-medium" style={{ color }}>%</span>
      </div>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold tabular-nums" style={{ background: bg, color }}>
      {value}%
    </span>
  );
}

/* ── Temporal Confidence (lightweight) ── */
function TemporalDisplay({ temporal }: { temporal?: IntelligenceObject['temporal'] }) {
  if (!temporal) return null;
  const trendIcon = temporal.trend === 'rising' ? TrendingUp : temporal.trend === 'declining' ? TrendingDown : Minus;
  const trendColor = temporal.trend === 'rising' ? '#059669' : temporal.trend === 'declining' ? '#ef4444' : '#94a3b8';
  const TrendIcon = trendIcon;
  
  return (
    <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
      <span>Was <span className="font-medium tabular-nums">{temporal.previous}%</span></span>
      <TrendIcon className="w-3 h-3" style={{ color: trendColor }} />
      <span>Now <span className="font-medium tabular-nums" style={{ color: trendColor }}>{temporal.current}%</span></span>
      {temporal.changeReason && (
        <span className="text-muted-foreground/60">· {temporal.changeReason}</span>
      )}
    </div>
  );
}

/* ── Human Feedback Control ── */
function FeedbackControl({ 
  intelligenceId, 
  companyId,
  artifactType,
  currentFeedback 
}: { 
  intelligenceId: string; 
  companyId: string;
  artifactType: string;
  currentFeedback?: IntelligenceObject['feedback'] 
}) {
  const [status, setStatus] = useState<'accurate' | 'outdated' | 'incorrect' | null>(
    currentFeedback?.status || null
  );
  const [submitting, setSubmitting] = useState(false);

  const submitFeedback = async (feedback: 'accurate' | 'outdated' | 'incorrect') => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await fetch(`/api/companies/${companyId}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artifactType,
          artifactId: intelligenceId,
          feedback,
        }),
      });
      setStatus(feedback);
    } catch (e) {
      console.error('Feedback error:', e);
    } finally {
      setSubmitting(false);
    }
  };

  if (status) {
    const config = {
      accurate: { icon: CheckCircle2, color: '#059669', label: 'Accurate' },
      outdated: { icon: Clock, color: '#f59e0b', label: 'Outdated' },
      incorrect: { icon: AlertTriangle, color: '#ef4444', label: 'Incorrect' },
    }[status];
    const Icon = 'icon' in config ? config.icon : AlertTriangle;
    return (
      <div className="flex items-center gap-1 opacity-60">
        <Icon className="w-3 h-3" style={{ color: config.color }} />
        <span className="text-[9px] font-medium" style={{ color: config.color }}>{config.label}</span>
        <button onClick={() => submitFeedback('outdated')} className="text-[9px] text-muted-foreground hover:text-foreground ml-1">change</button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
      <button
        onClick={() => submitFeedback('accurate')}
        className="p-0.5 rounded hover:bg-emerald-50 transition-colors"
        title="Accurate"
      >
        <ThumbsUp className="w-3 h-3 text-muted-foreground hover:text-emerald-600" />
      </button>
      <button
        onClick={() => submitFeedback('outdated')}
        className="p-0.5 rounded hover:bg-amber-50 transition-colors"
        title="Outdated"
      >
        <Clock className="w-3 h-3 text-muted-foreground hover:text-amber-600" />
      </button>
      <button
        onClick={() => submitFeedback('incorrect')}
        className="p-0.5 rounded hover:bg-red-50 transition-colors"
        title="Incorrect"
      >
        <ThumbsDown className="w-3 h-3 text-muted-foreground hover:text-red-600" />
      </button>
    </div>
  );
}

/* ── Intelligence Card — reusable for all intelligence items ── */
function IntelligenceCard({
  item,
  companyId,
  showReasoning = false,
  showEvidence = false,
  showTemporal = false,
  delay = 0,
  onNavigate,
}: {
  item: IntelligenceObject;
  companyId: string;
  showReasoning?: boolean;
  showEvidence?: boolean;
  showTemporal?: boolean;
  delay?: number;
  onNavigate?: () => void;
}) {
  const [expanded, setExpanded] = useState(showReasoning || showEvidence);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3 }}
      className="group border border-gray-100 rounded-xl bg-white hover:border-gray-200 hover:shadow-sm transition-all overflow-hidden"
    >
      <div className="px-5 py-4">
        {/* Top row: title + confidence + evidence state */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <EvidenceStateIndicator state={item.evidenceState} />
              {item.priority === 'high' && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium bg-red-50 text-red-600">
                  HIGH PRIORITY
                </span>
              )}
            </div>
            <h3 className="text-sm font-semibold text-foreground leading-snug">{item.title}</h3>
            {item.subtitle && (
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{item.subtitle}</p>
            )}
            {/* Why it matters — always visible as supporting context */}
            {item.whyItMatters && (
              <p className="text-xs text-foreground/70 mt-2 leading-relaxed">{item.whyItMatters}</p>
            )}
          </div>
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <ConfidenceDisplay value={item.confidence} />
            {item.freshness && (
              <FreshnessIndicator lastEnriched={item.freshness.lastEnriched} staleness={item.freshness.staleness} />
            )}
          </div>
        </div>

        {/* Actions row */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-50">
          <div className="flex items-center gap-2">
            {item.timing && (
              <span className="text-[10px] text-muted-foreground">
                <Clock className="w-2.5 h-2.5 inline mr-0.5" />
                {item.timing.replace(/_/g, ' ')}
              </span>
            )}
            {(item.evidence.length > 0 || item.reasoning) && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="text-[10px] font-medium text-primary hover:text-primary/80 transition-colors flex items-center gap-0.5"
              >
                {expanded ? 'Less' : 'Why?'}
              </button>
            )}
            {onNavigate && (
              <button onClick={onNavigate} className="text-[10px] font-medium text-primary hover:text-primary/80 flex items-center gap-0.5">
                Details →
              </button>
            )}
          </div>
          <FeedbackControl
            intelligenceId={item.id}
            companyId={companyId}
            artifactType={item.type}
            currentFeedback={item.feedback}
          />
        </div>
      </div>

      {/* Expandable: Reasoning + Evidence */}
      <AnimatePresence>
        {expanded && (item.reasoning || item.evidence.length > 0) && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="border-t border-gray-50 overflow-hidden"
          >
            <div className="px-5 py-4 bg-gray-50/50">
              {item.reasoning && (
                <p className="text-xs text-foreground/70 leading-relaxed mb-3">{item.reasoning}</p>
              )}
              {item.evidence.length > 0 && (
                <div className="space-y-1.5">
                  {item.evidence.map((ev, i) => (
                    <div key={i} className="flex items-start gap-2 px-3 py-2 rounded-lg bg-white border border-gray-100">
                      <span className="w-4 h-4 rounded-full bg-primary/10 flex items-center justify-center text-[8px] font-bold text-primary shrink-0 mt-0.5">
                        {i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-foreground leading-relaxed">{ev.snippet}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] text-muted-foreground">{ev.source}</span>
                          {ev.date && <span className="text-[10px] text-muted-foreground/60">{new Date(ev.date).toLocaleDateString()}</span>}
                          {ev.url && (
                            <a href={ev.url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary hover:text-primary/80 flex items-center gap-0.5">
                              <ExternalLink className="w-2 h-2" /> Source
                            </a>
                          )}
                          <EvidenceStateIndicator state={ev.state} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {showTemporal && item.temporal && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <TemporalDisplay temporal={item.temporal} />
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ── Section Header ── */
function SectionHeader({ icon: Icon, title, count, accent }: { icon: React.ElementType; title: string; count?: number; accent?: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${accent}10` }}>
        <Icon className="w-4 h-4" style={{ color: accent }} />
      </div>
      <h2 className="text-sm font-semibold text-foreground tracking-tight">{title}</h2>
      {count !== undefined && (
        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full" style={{ background: `${accent}10`, color: accent }}>
          {count}
        </span>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Company Intelligence Workspace — Main Component
   ═══════════════════════════════════════════════════════════════════════════ */

type Section = 'executive' | 'evidence' | 'alignment' | 'stakeholders' | 'actions' | 'history';

const SECTIONS: { key: Section; label: string; icon: React.ElementType }[] = [
  { key: 'executive', label: 'Understanding', icon: Brain },
  { key: 'evidence', label: 'Signals & Evidence', icon: Zap },
  { key: 'alignment', label: 'Capability Alignment', icon: Target },
  { key: 'stakeholders', label: 'Stakeholders', icon: Users },
  { key: 'actions', label: 'Actions', icon: Sparkles },
  { key: 'history', label: 'Intelligence History', icon: BarChart3 },
];

export function CompanyWorkspace() {
  const { selectedCompanyId, setActiveView } = useAppStore();
  const [intelligence, setIntelligence] = useState<CompanyIntelligence | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<Section>('executive');
  const [showBrief, setShowBrief] = useState(false);
  const [brief, setBrief] = useState<ExecutiveBriefData | null>(null);

  const fetchIntelligence = useCallback(async () => {
    if (!selectedCompanyId) { setLoading(false); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/companies/${selectedCompanyId}/alignment`);
      if (res.ok) setIntelligence(await res.json());
    } catch (e) { console.error('Intelligence fetch error:', e); }
    finally { setLoading(false); }
  }, [selectedCompanyId]);

  const fetchBrief = useCallback(async () => {
    if (!selectedCompanyId) return;
    try {
      const res = await fetch(`/api/companies/${selectedCompanyId}/brief`);
      if (res.ok) setBrief(await res.json());
    } catch (e) { console.error('Brief fetch error:', e); }
  }, [selectedCompanyId]);

  useEffect(() => { fetchIntelligence(); }, [fetchIntelligence]);

  // No company selected
  if (!selectedCompanyId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh]">
        <Building2 className="w-12 h-12 text-muted-foreground/20 mb-4" />
        <h2 className="text-lg font-semibold text-foreground mb-2">Select an Account</h2>
        <p className="text-sm text-muted-foreground mb-6">Choose an account from the Command Center to explore its intelligence space.</p>
        <Button variant="outline" onClick={() => setActiveView('command-center')} className="gap-2">
          <ArrowLeft className="w-4 h-4" />
          Command Center
        </Button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 rounded-lg bg-gray-200 animate-pulse" />
        <div className="h-48 rounded-2xl bg-gray-100 animate-pulse" />
        <div className="grid grid-cols-1 gap-4">
          {[1,2,3].map(i => <div key={i} className="h-24 rounded-xl bg-gray-100 animate-pulse" />)}
        </div>
      </div>
    );
  }

  if (!intelligence) return null;

  const companyName = intelligence.company.name;

  /* ── Executive Brief Modal ── */
  if (showBrief && brief) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={() => setShowBrief(false)} className="gap-1.5 text-xs">
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to Intelligence Space
            </Button>
            <h1 className="text-sm font-semibold text-foreground">Executive Brief</h1>
          </div>
          <Button variant="outline" size="sm" onClick={() => {
            const text = [
              `ACCOUNT INTELLIGENCE BRIEF`,
              `─────────────────────────`,
              `Account: ${brief.companyName}`,
              `Industry: ${brief.industry || 'Unknown'}`,
              `Generated: ${new Date(brief.generatedAt).toLocaleDateString()}`,
              ``,
              `CURRENT SITUATION`,
              `${brief.currentSituation}`,
              ``,
              `WHY NOW`,
              `${brief.whyNow}`,
              ``,
              `OPPORTUNITY AREAS`,
              ...brief.opportunityAreas.map((a, i) => `${i + 1}. ${a}`),
              ``,
              `RECOMMENDED APPROACH`,
              `${brief.recommendedApproach}`,
              ``,
              `EVIDENCE`,
              ...brief.evidence.map((e, i) => `${i + 1}. [${e.state.toUpperCase()}] ${e.title} — Source: ${e.source}${e.date ? ' (' + new Date(e.date).toLocaleDateString() + ')' : ''}`),
              ``,
              `NEXT ACTIONS`,
              ...brief.nextActions.map((a, i) => `${i + 1}. [${a.priority.toUpperCase()}] ${a.action} (Confidence: ${a.confidence}%)`),
              ``,
              `KEY STAKEHOLDERS`,
              ...brief.keyStakeholders.map((s, i) => `${i + 1}. ${s.role} — ${s.reason}`),
              ``,
              `TOP CAPABILITY MATCHES`,
              ...brief.topCapabilities.map((c, i) => `${i + 1}. ${c}`),
            ].join('\n');
            navigator.clipboard.writeText(text);
          }} className="gap-1.5 text-xs">
            <FileText className="w-3.5 h-3.5" />
            Copy Brief
          </Button>
        </div>
        <div className="section-container p-8 max-w-2xl">
          <div className="text-center mb-8">
            <h1 className="text-xl font-bold text-foreground">{brief.companyName}</h1>
            <p className="text-xs text-muted-foreground mt-1">Account Intelligence Brief · {new Date(brief.generatedAt).toLocaleDateString()}</p>
          </div>
          <div className="space-y-6">
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Current Situation</h3>
              <p className="text-sm text-foreground leading-relaxed">{brief.currentSituation}</p>
            </div>
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Why Now</h3>
              <p className="text-sm text-foreground leading-relaxed">{brief.whyNow}</p>
            </div>
            {brief.opportunityAreas.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Opportunity Areas</h3>
                <ul className="space-y-1.5">
                  {brief.opportunityAreas.map((area, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                      <Target className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
                      {area}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Recommended Approach</h3>
              <p className="text-sm text-foreground leading-relaxed">{brief.recommendedApproach}</p>
            </div>
            {brief.evidence.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Evidence</h3>
                <div className="space-y-1.5">
                  {brief.evidence.map((ev, i) => (
                    <div key={i} className="flex items-start gap-2 px-3 py-2 rounded-lg bg-gray-50">
                      <EvidenceStateIndicator state={ev.state} />
                      <div>
                        <p className="text-xs font-medium text-foreground">{ev.title}</p>
                        <p className="text-[10px] text-muted-foreground">{ev.source}{ev.date ? ` · ${new Date(ev.date).toLocaleDateString()}` : ''}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Next Actions</h3>
              <div className="space-y-1.5">
                {brief.nextActions.map((a, i) => (
                  <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-gray-50">
                    <span className={`w-1.5 h-1.5 rounded-full ${a.priority === 'high' ? 'bg-red-500' : a.priority === 'medium' ? 'bg-amber-500' : 'bg-blue-500'}`} />
                    <span className="text-xs text-foreground flex-1">{a.action}</span>
                    <span className="text-[10px] font-medium tabular-nums text-muted-foreground">{a.confidence}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Company Header ── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex items-start justify-between"
      >
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-xl font-bold text-primary shrink-0">
            {companyName.charAt(0)}
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">{companyName}</h1>
              <EvidenceStateIndicator state={intelligence.executiveUnderstanding.evidenceState} />
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {intelligence.company.industry || 'Technology'}{intelligence.company.domain ? ` · ${intelligence.company.domain}` : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchBrief}
            className="gap-1.5 text-xs"
            title="Generate Executive Brief"
          >
            <FileText className="w-3.5 h-3.5" />
            Brief
          </Button>
          <Button variant="outline" size="sm" onClick={() => setActiveView('accounts')} className="gap-1.5 text-xs">
            <ArrowLeft className="w-3.5 h-3.5" />
            Back
          </Button>
          <Button variant="outline" size="sm" onClick={fetchIntelligence} className="gap-1.5 text-xs">
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
        </div>
      </motion.div>

      {/* ── Executive Understanding — The Headline ── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.4 }}
        className="rounded-2xl border border-gray-100 bg-gradient-to-br from-white to-gray-50/80 p-6"
      >
        <div className="flex items-start gap-5">
          <div className="shrink-0">
            <ConfidenceDisplay value={intelligence.executiveUnderstanding.overallConfidence} size="lg" />
            <div className="mt-2">
              <TemporalDisplay temporal={intelligence.executiveUnderstanding.temporal} />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-semibold text-primary uppercase tracking-widest mb-2">
              Executive Understanding
            </p>
            <h2 className="text-lg font-semibold text-foreground leading-snug mb-2">
              {intelligence.executiveUnderstanding.headline}
            </h2>
            <p className="text-sm text-foreground/70 leading-relaxed">
              {intelligence.executiveUnderstanding.narrative}
            </p>
            <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-100">
              <span className="text-[10px] text-muted-foreground">
                <Zap className="w-3 h-3 inline mr-1" />
                {intelligence.signalCount} signals
              </span>
              <span className="text-[10px] text-muted-foreground">
                <Layers className="w-3 h-3 inline mr-1" />
                {intelligence.capabilityMatches.length} matches
              </span>
              <span className="text-[10px] text-muted-foreground">
                <Sparkles className="w-3 h-3 inline mr-1" />
                {intelligence.actions.length} actions
              </span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── Section Navigation ── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="flex items-center gap-1 overflow-x-auto scrollbar-hide px-0.5"
      >
        {SECTIONS.map(section => {
          const Icon = section.icon;
          const isActive = activeSection === section.key;
          const count = section.key === 'evidence' ? intelligence.signals.length :
            section.key === 'alignment' ? intelligence.capabilityMatches.length :
            section.key === 'stakeholders' ? intelligence.stakeholders.length :
            section.key === 'actions' ? intelligence.actions.length : undefined;
          return (
            <button
              key={section.key}
              onClick={() => setActiveSection(section.key)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-gray-100'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {section.label}
              {count !== undefined && count > 0 && (
                <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${
                  isActive ? 'bg-white/20 text-white' : 'bg-gray-100 text-muted-foreground'
                }`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </motion.div>

      {/* ── Section Content ── */}
      <AnimatePresence mode="wait">
        {/* EXECUTIVE UNDERSTANDING (DETAILED) */}
        {activeSection === 'executive' && (
          <motion.div
            key="executive"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
            {/* Four Questions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { q: 'What changed?', a: intelligence.signals[0]?.title || 'No signals detected yet', icon: Zap, color: '#f59e0b' },
                { q: 'Why it matters', a: intelligence.signals[0]?.whyItMatters || intelligence.executiveUnderstanding.headline, icon: Brain, color: '#8b5cf6' },
                { q: 'Why we\'re relevant', a: intelligence.positioning.message || 'Upload capabilities to enable alignment', icon: Target, color: '#059669' },
                { q: 'What to do', a: intelligence.actions[0]?.title || 'Enrich account to generate recommendations', icon: Sparkles, color: '#2563eb' },
              ].map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08 }}
                  className="rounded-xl border border-gray-100 p-4"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <item.icon className="w-3.5 h-3.5" style={{ color: item.color }} />
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{item.q}</span>
                  </div>
                  <p className="text-sm text-foreground leading-relaxed">{item.a}</p>
                </motion.div>
              ))}
            </div>

            {/* Positioning */}
            {intelligence.positioning.strengthScore > 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.35 }}
                className="rounded-xl border border-primary/10 bg-primary/5 p-5"
              >
                <div className="flex items-center gap-2 mb-2">
                  <Target className="w-4 h-4 text-primary" />
                  <span className="text-[10px] font-semibold text-primary uppercase tracking-widest">Recommended Positioning</span>
                  <span className="ml-auto text-[10px] font-bold text-primary tabular-nums">{intelligence.positioning.strengthScore}%</span>
                </div>
                <p className="text-sm text-foreground leading-relaxed">{intelligence.positioning.message}</p>
                {intelligence.positioning.topCapabilities.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {intelligence.positioning.topCapabilities.map((cap, i) => (
                      <span key={i} className="px-2.5 py-1 rounded-lg bg-white border border-gray-100 text-xs font-medium text-foreground">
                        {cap}
                      </span>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </motion.div>
        )}

        {/* SIGNALS & EVIDENCE */}
        {activeSection === 'evidence' && (
          <motion.div
            key="evidence"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="space-y-3"
          >
            <SectionHeader icon={Zap} title="Market Signals" count={intelligence.signals.length} accent="#f59e0b" />
            {intelligence.signals.length === 0 ? (
              <div className="text-center py-12 rounded-xl border border-gray-100">
                <Zap className="w-8 h-8 text-muted-foreground/20 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No signals detected. Run intelligence enrichment to discover opportunities.</p>
              </div>
            ) : (
              intelligence.signals.map((signal, i) => (
                <IntelligenceCard
                  key={signal.id}
                  item={signal}
                  companyId={selectedCompanyId}
                  showTemporal
                  delay={i * 0.05}
                />
              ))
            )}
          </motion.div>
        )}

        {/* CAPABILITY ALIGNMENT */}
        {activeSection === 'alignment' && (
          <motion.div
            key="alignment"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
            <SectionHeader icon={Target} title="Capability Alignment" count={intelligence.capabilityMatches.length} accent="#059669" />

            {/* Needs → Capabilities flow */}
            {intelligence.needs.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">Detected Business Needs</p>
                <div className="space-y-2">
                  {intelligence.needs.slice(0, 6).map((need, i) => {
                    const related = intelligence.capabilityMatches.filter(m =>
                      m.relatedSignals?.some(rs => need.relatedSignals?.includes(rs))
                    );
                    return (
                      <IntelligenceCard
                        key={need.id}
                        item={need}
                        companyId={selectedCompanyId}
                        showEvidence={related.length > 0}
                        delay={i * 0.05}
                      />
                    );
                  })}
                </div>
              </div>
            )}

            {intelligence.capabilityMatches.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">Capability Matches</p>
                <div className="space-y-2">
                  {intelligence.capabilityMatches.map((match, i) => (
                    <IntelligenceCard
                      key={match.id}
                      item={match}
                      companyId={selectedCompanyId}
                      showEvidence
                      delay={i * 0.05}
                    />
                  ))}
                </div>
              </div>
            )}

            {intelligence.needs.length === 0 && intelligence.capabilityMatches.length === 0 && (
              <div className="text-center py-12 rounded-xl border border-gray-100">
                <Target className="w-8 h-8 text-muted-foreground/20 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No capability alignment yet.</p>
                <p className="text-xs text-muted-foreground mt-1">Upload capabilities and enrich accounts to enable alignment.</p>
                <Button variant="outline" size="sm" onClick={() => setActiveView('activation-workspace')} className="mt-3 gap-1.5 text-xs">
                  <ArrowUpRight className="w-3 h-3" />
                  Manage Capabilities
                </Button>
              </div>
            )}
          </motion.div>
        )}

        {/* STAKEHOLDERS */}
        {activeSection === 'stakeholders' && (
          <motion.div
            key="stakeholders"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="space-y-3"
          >
            <SectionHeader icon={Users} title="Key Stakeholders" count={intelligence.stakeholders.length} accent="#2563eb" />
            {intelligence.positioning.targetStakeholders.length > 0 && (
              <div className="mb-4 p-3 rounded-xl bg-primary/5 border border-primary/10">
                <p className="text-[10px] font-semibold text-primary uppercase tracking-wider mb-2">Recommended Targets</p>
                <div className="flex flex-wrap gap-2">
                  {intelligence.positioning.targetStakeholders.map((s, i) => (
                    <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-gray-100 text-xs">
                      <Users className="w-3 h-3 text-primary" />
                      <span className="font-medium text-foreground">{s.role}</span>
                      <span className="text-[10px] text-muted-foreground">— {s.reason}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
            {intelligence.stakeholders.length === 0 ? (
              <div className="text-center py-12 rounded-xl border border-gray-100">
                <Users className="w-8 h-8 text-muted-foreground/20 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No stakeholders identified. Enrich account to discover contacts.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {intelligence.stakeholders.map((s, i) => (
                  <IntelligenceCard key={s.id} item={s} companyId={selectedCompanyId} delay={i * 0.05} />
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* ACTIONS */}
        {activeSection === 'actions' && (
          <motion.div
            key="actions"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="space-y-3"
          >
            <SectionHeader icon={Sparkles} title="Recommended Actions" count={intelligence.actions.length} accent="#8b5cf6" />
            {intelligence.actions.length === 0 ? (
              <div className="text-center py-12 rounded-xl border border-gray-100">
                <Sparkles className="w-8 h-8 text-muted-foreground/20 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No actions recommended. Enrich account to generate recommendations.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {intelligence.actions.map((action, i) => (
                  <IntelligenceCard key={action.id} item={action} companyId={selectedCompanyId} showReasoning delay={i * 0.05} />
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* INTELLIGENCE HISTORY */}
        {activeSection === 'history' && (
          <motion.div
            key="history"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
            <SectionHeader icon={BarChart3} title="Intelligence Evolution" accent="#06b6d4" />
            <div className="space-y-2">
              {intelligence.signals.slice(0, 5).map((signal, i) => {
                if (!signal.temporal) return null;
                return (
                  <motion.div
                    key={signal.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.05 }}
                    className="flex items-center gap-4 px-5 py-3 rounded-xl border border-gray-100"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{signal.title}</p>
                      <TemporalDisplay temporal={signal.temporal} />
                    </div>
                    <ConfidenceDisplay value={signal.temporal.current} />
                  </motion.div>
                );
              })}
            </div>
            {intelligence.signals.length === 0 && (
              <div className="text-center py-12 rounded-xl border border-gray-100">
                <BarChart3 className="w-8 h-8 text-muted-foreground/20 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Intelligence history will appear as signals are detected over time.</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
