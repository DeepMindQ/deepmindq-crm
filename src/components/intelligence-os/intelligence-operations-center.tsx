'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain, Activity, Shield, Zap, Target, AlertTriangle,
  RefreshCw, ChevronRight, Clock, TrendingUp, ArrowRight,
  Radio, Eye, Loader2, Building2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAppStore, type ViewId } from '@/lib/store';
import { ConfidenceIndicator } from './confidence-indicator';
import { EvidenceChain } from './evidence-chain';
import { ActionCTA } from './action-cta';
import { IntelligenceCard } from './intelligence-card';
import { IntelligenceNarrative } from './intelligence-narrative';
import { AccountDeltaTracker } from './account-delta-tracker';
import { StatusMetricsBar, type StatusMetricsKPIs, type SystemHealth } from './status-metrics-bar';
import { ActionQueue, type ExtractedAction } from './action-queue';
import { IntelligenceQueue } from './intelligence-queue';
import { InlineReasoning } from './inline-reasoning';
import { IntelligencePanel } from './intelligence-panel';
import { tokens, getConfidenceTier, getPriorityTier, motion as motionTokens } from './design-tokens';
import type { IntelligenceNarrativeData } from '@/lib/intelligence-narrative-service';
import { logger } from '@/lib/logger';
import { FirstExperienceGuide } from '@/components/shared/first-experience-guide';
import { MainIntelligenceDashboard } from '@/components/screens/main-intelligence-dashboard';

/* ═══════════════════════════════════════════════════════════════
   Intelligence Operations Center — Daily Proactive Intelligence Cockpit
   
   Phase 1D / WI-1 — The user's daily intelligence operations surface.
   
   Answers:
     "What changed?"    → Alerts from autonomous monitoring
     "Why does it matter?" → Evidence-backed descriptions
     "Which accounts?"  → Cross-account patterns with affected companies
     "What should I do?" → ActionQueue derived from intelligence
     "How confident?"  → ConfidenceIndicator on every item
   
   Intelligence Flow:
     Engine (autonomous-monitor / cross-account / predictive)
       → API endpoint
         → Operations Center (display)
           → Evidence + Reasoning + Action
   
   UX DNA Compliance:
     ✅ Intelligence First — Alerts/patterns/predictions shown immediately
     ✅ Reasoning Transparency — Every item explains "Why?"
     ✅ Evidence Visibility — Evidence chain expandable per item
     ✅ Confidence Layer — ConfidenceIndicator on every intelligence item
     ✅ Action Orientation — ActionCTA terminates every alert/pattern
     ✅ Context Preservation — Navigate to company with full context
     ✅ Trust Over Volume — Severity ranking, confidence filtering
   
   Composed from existing Intelligence OS components:
     AccountDeltaTracker, StatusMetricsBar, IntelligenceQueue, ActionQueue,
     IntelligenceCard, IntelligenceNarrative, ConfidenceIndicator,
     EvidenceChain, ActionCTA, InlineReasoning, IntelligencePanel
   ═══════════════════════════════════════════════════════════════ */

// ─── Types from existing engines ──────────────────────────────────

type AlertSeverity = 'info' | 'warning' | 'urgent' | 'critical';
type AlertType =
  | 'new_high_confidence_signal' | 'new_signal_type_detected'
  | 'signal_cluster_detected' | 'fresh_critical_signal'
  | 'correlation_pattern_found' | 'prediction_generated';

interface OperationsAlert {
  id: string;
  companyId: string;
  companyName: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  description: string;
  signalId?: string;
  correlation?: {
    pattern: string;
    description: string;
    confidence: number;
    businessImplication: string;
    recommendedAction: string;
  };
  prediction?: {
    type: string;
    description: string;
    confidence: number;
    timeframe: string;
    salesImplication: string;
    recommendedPreparation: string;
  };
  actionRequired: string;
  createdAt: string;
}

type CrossAccountPattern =
  | 'industry_trend' | 'technology_wave' | 'competitive_signal'
  | 'market_timing' | 'segment_opportunity';

interface CrossAccountInsight {
  pattern: CrossAccountPattern;
  description: string;
  affectedCompanyIds: string[];
  affectedCompanyNames: string[];
  signalCount: number;
  industry?: string;
  technology?: string;
  businessImplication: string;
  recommendedStrategy: string;
  confidence: number;
  detectedAt: string;
}

interface IntelligencePrediction {
  type: string;
  description: string;
  confidence: number;
  timeframe: string;
  supportingSignals: string[];
  historicalEvidence: string;
  salesImplication: string;
  recommendedPreparation: string;
  predictionDate: string;
  companyName?: string;
  companyId?: string;
}

interface CommandCenterInsights {
  kpis: {
    totalAccounts: number;
    activeSignals: number;
    avgIntelligenceScore: number;
    pendingActions: number;
  };
  recentSignals: Array<{ id: string; companyId: string; companyName: string; signalType: string; title: string; severity: string; impact: string; confidence: number; createdAt: string }>;
  systemHealth: { engines: Array<{ name: string; status: string }>; aiStatus: string };
}

// WI-5: Learning insight type for Signal Quality section
interface LearningInsightData {
  signalType: string;
  accuracyScore: number;
  relevanceScore: number;
  actionabilityScore: number;
  totalFeedback: number;
  surpriseScore: number;
  trend: 'improving' | 'stable' | 'declining';
}

interface SectionState {
  loading: boolean;
  error: string | null;
  lastRefresh: number | null;
}

// ─── Severity / Pattern helpers ──────────────────────────────────

const SEVERITY_ORDER: Record<AlertSeverity, number> = { critical: 0, urgent: 1, warning: 2, info: 3 };

const SEVERITY_STYLES: Record<AlertSeverity, { color: string; bg: string; border: string; icon: React.ElementType }> = {
  critical: { color: tokens.domain.risk, bg: tokens.priority.critical.bg, border: tokens.confidence.low.border, icon: AlertTriangle },
  urgent:   { color: tokens.domain.reasoning, bg: tokens.confidence.medium.bg, border: tokens.confidence.medium.border, icon: AlertTriangle },
  warning:  { color: tokens.accent.DEFAULT, bg: tokens.accent.ghost, border: tokens.accent.strong, icon: Radio },
  info:     { color: tokens.text.secondary, bg: tokens.opacity.trace, border: tokens.priority.low.border, icon: Eye },
};

const PATTERN_LABELS: Record<CrossAccountPattern, string> = {
  industry_trend: 'Industry Trend',
  technology_wave: 'Technology Wave',
  competitive_signal: 'Competitive Signal',
  market_timing: 'Market Timing',
  segment_opportunity: 'Segment Opportunity',
};

const PATTERN_ICONS: Record<CrossAccountPattern, React.ElementType> = {
  industry_trend: TrendingUp,
  technology_wave: Zap,
  competitive_signal: Shield,
  market_timing: Clock,
  segment_opportunity: Target,
};

// ─── Minimum confidence for display (trust over volume) ──────────

const MIN_ALERT_CONFIDENCE = 30;
const MIN_PATTERN_CONFIDENCE = 30;
const MIN_PREDICTION_CONFIDENCE = 20;

/* ═══════════════════════════════════════════════════════════════
   Main Component
   ═══════════════════════════════════════════════════════════════ */

export function IntelligenceOperationsCenter() {
  const { intelligenceActivated, setActiveView, setSelectedCompanyId } = useAppStore();

  // ── S11 Dashboard navigation handler ──
  const [dashboardExpanded, setDashboardExpanded] = useState(false);
  const handleNavigate = useCallback((href: string) => {
    const key = href.replace('#', '') as ViewId;
    setActiveView(key);
  }, [setActiveView]);

  // ── Section states (independent) ──
  const [alertsState, setAlertsState] = useState<SectionState>({ loading: false, error: null, lastRefresh: null });
  const [patternsState, setPatternsState] = useState<SectionState>({ loading: false, error: null, lastRefresh: null });
  const [predictionsState, setPredictionsState] = useState<SectionState>({ loading: false, error: null, lastRefresh: null });
  const [insightsState, setInsightsState] = useState<SectionState>({ loading: false, error: null, lastRefresh: null });
  const [learningState, setLearningState] = useState<SectionState>({ loading: false, error: null, lastRefresh: null });

  // ── Data ──
  const [alerts, setAlerts] = useState<OperationsAlert[]>([]);
  const [patterns, setPatterns] = useState<CrossAccountInsight[]>([]);
  const [predictions, setPredictions] = useState<IntelligencePrediction[]>([]);
  const [insights, setInsights] = useState<CommandCenterInsights | null>(null);
  const [companyIds, setCompanyIds] = useState<string[]>([]);
  const [alertSummary, setAlertSummary] = useState<{ bySeverity: Record<string, number>; byStatus: Record<string, number>; total: number } | null>(null);
  const [learningInsights, setLearningInsights] = useState<LearningInsightData[]>([]);
  const [hasFetched, setHasFetched] = useState(false);

  // ── Navigation helper ──
  const navigateToCompany = useCallback((companyId: string) => {
    setSelectedCompanyId(companyId);
    setActiveView('company-workspace');
  }, [setActiveView, setSelectedCompanyId]);

  // ═══════════════════════════════════════════════════════════════
  //  DATA FETCHING — Each section independent, no cascading failures
  // ═══════════════════════════════════════════════════════════════

  // ── Fetch company IDs (foundation for other fetches) ──
  const fetchCompanyIds = useCallback(async () => {
    try {
      const res = await fetch('/api/companies?limit=50');
      if (!res.ok) return [];
      const json = await res.json();
      const companies = json.data ?? json ?? [];
      return companies.map((c: { id: string }) => c.id).filter(Boolean);
    } catch (err) {
      logger.error('[OperationsCenter] Company fetch failed:', { error: err });
      return [];
    }
  }, []);

  // ── Fetch alerts from persisted store (WI-3: lightweight DB read) ──
  const fetchAlerts = useCallback(async (_cIds: string[]) => {
    setAlertsState(prev => ({ ...prev, loading: true, error: null }));
    try {
      const params = new URLSearchParams({ status: 'active', limit: '20', includeSummary: 'true' });
      const res = await fetch(`/api/intelligence/monitor?${params}`);
      if (!res.ok) throw new Error(`Monitor returned ${res.status}`);
      const json = await res.json();

      // Store summary for status indicator
      if (json.summary) {
        setAlertSummary({
          bySeverity: json.summary.bySeverity ?? {},
          byStatus: json.summary.byStatus ?? {},
          total: json.summary.total ?? 0,
        });
      }

      // Map persisted DB alerts to OperationsAlert format
      const dbAlerts: OperationsAlert[] = (json.alerts ?? []).map((a: Record<string, unknown>) => {
        const metadata = typeof a.metadata === 'string' ? JSON.parse(a.metadata) : (a.metadata ?? {});
        return {
          id: a.id,
          companyId: a.companyId ?? '',
          companyName: (a.company as Record<string, string>)?.rawName ?? metadata.companyName ?? 'Unknown',
          type: a.alertType,
          severity: metadata.originalSeverity ?? a.severity,
          title: a.title,
          description: a.description,
          signalId: metadata.signalId ?? undefined,
          correlation: metadata.correlation ?? undefined,
          prediction: metadata.prediction ?? undefined,
          actionRequired: metadata.actionRequired ?? '',
          createdAt: a.createdAt,
        };
      });

      // Filter: trust over volume — only show alerts with meaningful confidence
      const filtered = dbAlerts.filter(a => {
        const hasConfidence = a.correlation?.confidence ?? a.prediction?.confidence ?? null;
        if (hasConfidence !== null && hasConfidence * 100 < MIN_ALERT_CONFIDENCE) return false;
        return true;
      });
      // Sort by severity
      filtered.sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 3) - (SEVERITY_ORDER[b.severity] ?? 3));
      setAlerts(filtered);
      setAlertsState({ loading: false, error: null, lastRefresh: Date.now() });
    } catch (err) {
      logger.error('[OperationsCenter] Alerts fetch failed:', { error: err });
      setAlertsState({ loading: false, error: 'Alert monitoring unavailable', lastRefresh: null });
    }
  }, []);

  // ── Fetch cross-account patterns — persisted-first with live fallback (WI-4) ──
  const fetchPatterns = useCallback(async (cIds: string[]) => {
    if (cIds.length < 2) { setPatterns([]); return; }
    setPatternsState(prev => ({ ...prev, loading: true, error: null }));
    try {
      // First try: read persisted cross-account alerts from DB (lightweight)
      const persistedParams = new URLSearchParams({
        status: 'active',
        alertType: 'cross_account_industry_trend,cross_account_technology_wave,cross_account_segment_opportunity',
        limit: '20',
      });
      const persistedRes = await fetch(`/api/intelligence/monitor?${persistedParams}`);
      if (persistedRes.ok) {
        const persistedJson = await persistedRes.json();
        const persistedAlerts = persistedJson.alerts ?? [];
        if (persistedAlerts.length > 0) {
          // Map persisted alerts to CrossAccountInsight format
          const mapped: CrossAccountInsight[] = persistedAlerts.map((a: Record<string, unknown>) => {
            const metadata = typeof a.metadata === 'string' ? JSON.parse(a.metadata) : (a.metadata ?? {});
            const insight = metadata.crossAccountInsight ?? metadata;
            return {
              pattern: insight.pattern ?? a.alertType,
              description: a.description ?? insight.description ?? '',
              affectedCompanyIds: insight.affectedCompanyIds ?? [],
              affectedCompanyNames: insight.affectedCompanyNames ?? [],
              signalCount: insight.signalCount ?? 0,
              industry: insight.industry ?? null,
              confidence: insight.confidence ?? 0.5,
              businessImplication: insight.businessImplication ?? '',
              recommendedStrategy: insight.recommendedStrategy ?? '',
              detectedAt: a.createdAt ?? new Date().toISOString(),
            };
          });
          const filtered = mapped.filter((p: CrossAccountInsight) => p.confidence * 100 >= MIN_PATTERN_CONFIDENCE);
          setPatterns(filtered);
          setPatternsState({ loading: false, error: null, lastRefresh: Date.now() });
          return;
        }
      }

      // Fallback: live computation via existing cross-account endpoint
      const idsParam = cIds.slice(0, 30).join(',');
      const res = await fetch(`/api/intelligence/cross-account?companyIds=${idsParam}`);
      if (!res.ok) throw new Error(`Cross-account returned ${res.status}`);
      const json = await res.json();
      const data = json.success ? json.data : json;
      const result = Array.isArray(data?.patterns) ? data.patterns : [];
      const filtered = result.filter((p: CrossAccountInsight) => p.confidence * 100 >= MIN_PATTERN_CONFIDENCE);
      setPatterns(filtered);
      setPatternsState({ loading: false, error: null, lastRefresh: Date.now() });
    } catch (err) {
      logger.error('[OperationsCenter] Patterns fetch failed:', { error: err });
      setPatternsState({ loading: false, error: 'Cross-account analysis unavailable', lastRefresh: null });
    }
  }, []);

  // ── Fetch predictions for top accounts — persisted-first with live fallback (WI-4) ──
  const fetchPredictions = useCallback(async (cIds: string[]) => {
    if (cIds.length === 0) { setPredictions([]); return; }
    setPredictionsState(prev => ({ ...prev, loading: true, error: null }));
    try {
      // First try: read persisted high-confidence prediction alerts from DB
      const persistedParams = new URLSearchParams({
        status: 'active',
        alertType: 'high_confidence_prediction',
        limit: '20',
      });
      const persistedRes = await fetch(`/api/intelligence/monitor?${persistedParams}`);
      if (persistedRes.ok) {
        const persistedJson = await persistedRes.json();
        const persistedAlerts = persistedJson.alerts ?? [];
        if (persistedAlerts.length > 0) {
          // Map persisted alerts to IntelligencePrediction format
          const mapped: IntelligencePrediction[] = persistedAlerts.map((a: Record<string, unknown>) => {
            const metadata = typeof a.metadata === 'string' ? JSON.parse(a.metadata) : (a.metadata ?? {});
            const pred = metadata.prediction ?? metadata;
            return {
              ...pred,
              companyId: metadata.companyId ?? a.companyId ?? '',
              confidence: pred.confidence ?? metadata.confidence ?? 0.5,
            } as IntelligencePrediction;
          });
          const filtered = mapped.filter(p => p.confidence * 100 >= MIN_PREDICTION_CONFIDENCE);
          setPredictions(filtered);
          setPredictionsState({ loading: false, error: null, lastRefresh: Date.now() });
          return;
        }
      }

      // Fallback: live computation via existing predictions endpoint
      const topIds = cIds.slice(0, 5);
      const allPredictions: IntelligencePrediction[] = [];
      for (const cid of topIds) {
        try {
          const res = await fetch(`/api/intelligence/predictions?companyId=${cid}`);
          if (res.ok) {
            const json = await res.json();
            const data = json.success ? json.data : json;
            const preds = Array.isArray(data?.predictions) ? data.predictions : [];
            for (const p of preds) {
              allPredictions.push({ ...p, companyId: cid });
            }
          }
        } catch { /* skip individual company */ }
      }
      const filtered = allPredictions.filter(p => p.confidence * 100 >= MIN_PREDICTION_CONFIDENCE);
      setPredictions(filtered);
      setPredictionsState({ loading: false, error: null, lastRefresh: Date.now() });
    } catch (err) {
      logger.error('[OperationsCenter] Predictions fetch failed:', { error: err });
      setPredictionsState({ loading: false, error: 'Predictions unavailable', lastRefresh: null });
    }
  }, []);

  // ── Fetch insights (KPIs + system health) ──
  const fetchInsights = useCallback(async () => {
    setInsightsState(prev => ({ ...prev, loading: true, error: null }));
    try {
      const res = await fetch('/api/command-center/insights');
      if (!res.ok) throw new Error(`Insights returned ${res.status}`);
      const json = await res.json();
      const data = json.success ? json.data : json;
      setInsights(data);
      setInsightsState({ loading: false, error: null, lastRefresh: Date.now() });
    } catch (err) {
      logger.error('[OperationsCenter] Insights fetch failed:', { error: err });
      setInsightsState({ loading: false, error: 'System insights unavailable', lastRefresh: null });
    }
  }, []);

  // ── Fetch learning insights from feedback API (WI-5) ──
  const fetchLearningInsights = useCallback(async () => {
    setLearningState(prev => ({ ...prev, loading: true, error: null }));
    try {
      const res = await fetch('/api/intelligence/feedback');
      if (!res.ok) throw new Error(`Feedback returned ${res.status}`);
      const json = await res.json();
      const data = json.success ? json.data : json;
      const result = Array.isArray(data?.insights) ? data.insights : [];
      setLearningInsights(result);
      setLearningState({ loading: false, error: null, lastRefresh: Date.now() });
    } catch (err) {
      logger.error('[OperationsCenter] Learning insights fetch failed:', { error: err });
      setLearningState({ loading: false, error: 'Learning insights unavailable', lastRefresh: null });
    }
  }, []);

  // ── Signal feedback handler (WI-5) ──
  const handleSignalFeedback = useCallback(async (signalId: string, companyId: string, type: 'accurate' | 'inaccurate') => {
    try {
      await fetch('/api/intelligence/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signalId, companyId, type }),
      });
      // Refresh learning insights after feedback
      setTimeout(() => fetchLearningInsights(), 1000);
    } catch (err) {
      logger.error('[OperationsCenter] Signal feedback failed:', { error: err });
    }
  }, [fetchLearningInsights]);

  // ── Alert lifecycle handler (WI-3) ──
  const handleAlertAction = useCallback(async (alertId: string, action: 'acknowledge' | 'resolve' | 'dismiss') => {
    try {
      const res = await fetch('/api/intelligence/monitor', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alertId, action }),
      });
      if (!res.ok) throw new Error(`Alert ${action} failed: ${res.status}`);
      // Remove from local state immediately for responsiveness
      setAlerts(prev => prev.filter(a => a.id !== alertId));
    } catch (err) {
      logger.error(`[OperationsCenter] Alert ${action} failed:`, { error: err });
    }
  }, []);

  // ── Master fetch: get companies, then fan out to all sections ──
  const fetchAll = useCallback(async () => {
    const cIds = await fetchCompanyIds();
    setCompanyIds(cIds);
    // All sections fire in parallel — no cascading failures
    await Promise.allSettled([
      fetchAlerts(cIds),
      fetchPatterns(cIds),
      fetchPredictions(cIds),
      fetchInsights(),
      fetchLearningInsights(),
    ]);
    setHasFetched(true);
  }, [fetchCompanyIds, fetchAlerts, fetchPatterns, fetchPredictions, fetchInsights, fetchLearningInsights]);

  // ── Initial load + polling ──
  useEffect(() => {
    if (!intelligenceActivated) return;
    fetchAll();
    // Alerts & health: 60-second polling
    const alertPoll = setInterval(() => {
      if (companyIds.length > 0) {
        fetchAlerts(companyIds);
        fetchInsights();
      }
    }, 60_000);
    // Patterns, predictions & learning: 5-minute polling
    const patternPoll = setInterval(() => {
      if (companyIds.length > 0) {
        fetchPatterns(companyIds);
        fetchPredictions(companyIds);
        fetchLearningInsights();
      }
    }, 5 * 60_000);
    return () => { clearInterval(alertPoll); clearInterval(patternPoll); };
  }, [intelligenceActivated, fetchAll, fetchAlerts, fetchPatterns, fetchPredictions, fetchInsights, fetchLearningInsights, companyIds]);

  // ── Derived: Operations summary for hero ──
  const criticalAlertCount = alerts.filter(a => a.severity === 'critical').length;
  const totalAlertCount = alerts.length;
  const patternCount = patterns.length;
  const predictionCount = predictions.length;
  const avgConfidence = insights?.kpis?.avgIntelligenceScore ?? 0;

  // ── Derived: Extract actions from alerts + patterns ──
  const extractedActions: ExtractedAction[] = useMemo(() => {
    const actions: ExtractedAction[] = [];
    for (const a of alerts.slice(0, 3)) {
      actions.push({
        id: `alert-${a.id}`,
        type: a.severity === 'critical' || a.severity === 'urgent' ? 'risk' : 'signal',
        title: a.title,
        description: a.description,
        company: a.companyName,
        companyId: a.companyId,
        priority: a.severity === 'critical' ? 'high' : a.severity === 'urgent' ? 'medium' : 'low',
        confidence: Math.round((a.correlation?.confidence ?? a.prediction?.confidence ?? 0.5) * 100),
        reason: a.actionRequired,
        createdAt: a.createdAt,
      });
    }
    for (const p of patterns.slice(0, 2)) {
      actions.push({
        id: `pattern-${p.pattern}-${p.detectedAt}`,
        type: 'opportunity',
        title: `Cross-account: ${PATTERN_LABELS[p.pattern]}`,
        description: p.description,
        company: p.affectedCompanyNames.slice(0, 2).join(', '),
        companyId: p.affectedCompanyIds[0] || '',
        priority: p.confidence >= 0.6 ? 'high' : 'medium',
        confidence: Math.round(p.confidence * 100),
        reason: p.recommendedStrategy,
        createdAt: p.detectedAt,
      });
    }
    return actions.slice(0, 5);
  }, [alerts, patterns]);

  // ═══════════════════════════════════════════════════════════════
  //  RENDER
  // ═══════════════════════════════════════════════════════════════

  // ── Empty state: Intelligence not activated ──
  if (!intelligenceActivated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] px-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center max-w-lg">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6" style={{ background: tokens.accent.ghost }}>
            <Brain className="w-8 h-8" style={{ color: tokens.accent.bright }} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: tokens.text.primary }}>Intelligence Operations Center</h1>
          <p className="text-sm mt-2" style={{ color: tokens.text.secondary }}>Your intelligence monitoring system is ready. Activate intelligence to begin continuous operations.</p>
          <Button onClick={() => setActiveView('activation-workspace')} className="gap-2 px-6 mt-6">
            Activate Intelligence <ArrowRight className="w-4 h-4" />
          </Button>
        </motion.div>
      </div>
    );
  }

  // ── Loading skeleton ──
  const isInitialLoad = alertsState.loading && patternsState.loading && insightsState.loading && alerts.length === 0;

  if (isInitialLoad) {
    return (
      <div className="space-y-4 p-1">
        <div className="rounded-xl border p-6 space-y-4" style={{ background: tokens.surface.card, borderColor: tokens.border.subtle }}>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl animate-pulse" style={{ background: tokens.accent.ghost }} />
            <div className="flex-1 space-y-2">
              <div className="h-5 w-3/4 rounded-lg animate-pulse" style={{ background: tokens.border.subtle }} />
              <div className="h-3 w-1/2 rounded-lg animate-pulse" style={{ background: tokens.border.subtle }} />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 rounded-xl border animate-pulse" style={{ background: tokens.surface.card, borderColor: tokens.border.subtle }} />
          ))}
        </div>
      </div>
    );
  }

  // ── Empty state: No data yet — show first experience guide ──
  if (hasFetched && companyIds.length === 0) {
    return (
      <FirstExperienceGuide
        onNavigate={(screen) => setActiveView(screen as ViewId)}
        hasCompanies={false}
        hasContacts={false}
        hasImported={false}
      />
    );
  }

  return (
    <div className="space-y-5" role="main" aria-label="Intelligence Operations Center">
      {/* ═══ HEADER ═══ */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight" style={{ color: tokens.text.primary }}>
            Operations Center
          </h1>
          <p className="text-sm mt-0.5" style={{ color: tokens.text.secondary }}>
            Autonomous Intelligence Monitoring
          </p>
        </div>
        <div className="flex items-center gap-2">
          {alertSummary && (
            <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ color: tokens.text.muted, background: tokens.surface.secondary }}>
              {alertSummary.total} total alerts
            </span>
          )}
          {alertsState.lastRefresh && (
            <span className="text-[10px]" style={{ color: tokens.text.muted }}>
              Last scan: {new Date(alertsState.lastRefresh).toLocaleTimeString()}
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={fetchAll}
            className="gap-1.5 text-xs"
            disabled={alertsState.loading}
          >
            {alertsState.loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Refresh
          </Button>
        </div>
      </div>

      {/* ═══ 1. OPERATIONS SUMMARY HERO ═══ */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...motionTokens.smooth }}
        className="rounded-xl border overflow-hidden"
        style={{ background: tokens.surface.card, borderColor: tokens.border.subtle }}
      >
        {/* L1: Decision — Operational status at a glance */}
        <div className="p-5 pb-4">
          <div className="flex items-start gap-4">
            <div className="shrink-0">
              <ConfidenceIndicator
                value={avgConfidence}
                mode="ring"
                size="lg"
                label="System Confidence"
                showPercentage={true}
                animated={true}
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <Badge
                  className="text-[10px] px-2 py-0.5 font-semibold"
                  style={{
                    color: criticalAlertCount > 0 ? tokens.domain.risk : tokens.accent.bright,
                    background: criticalAlertCount > 0 ? tokens.priority.critical.bg : tokens.accent.ghost,
                    border: `1px solid ${criticalAlertCount > 0 ? 'tokens.priority.critical.border' : tokens.border.subtle}`,
                  }}
                >
                  {criticalAlertCount > 0 ? `${criticalAlertCount} CRITICAL ALERT${criticalAlertCount > 1 ? 'S' : ''}` : 'ALL CLEAR'}
                </Badge>
                <span className="text-[10px]" style={{ color: tokens.text.muted }}>
                  {insights?.kpis?.totalAccounts ?? 0} accounts monitored
                </span>
              </div>
              <h2 className="text-lg font-semibold leading-snug" style={{ color: tokens.text.primary }}>
                {totalAlertCount > 0
                  ? `${totalAlertCount} alert${totalAlertCount > 1 ? 's' : ''} detected · ${patternCount} pattern${patternCount !== 1 ? 's' : ''} discovered · ${predictionCount} prediction${predictionCount !== 1 ? 's' : ''} active`
                  : 'No critical intelligence requires immediate attention'
                }
              </h2>
              {totalAlertCount === 0 && (
                <p className="text-sm mt-1" style={{ color: tokens.text.secondary }}>
                  The intelligence monitoring system is actively watching your portfolio. New alerts, patterns, and predictions will appear here as they are detected.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* L2: Quick stats row */}
        {(totalAlertCount > 0 || patternCount > 0 || predictionCount > 0) && (
          <div
            className="flex items-center gap-0 divide-x overflow-x-auto"
            style={{ borderColor: tokens.border.subtle, background: tokens.surface.secondary }}
          >
            <OpStatItem
              icon={<AlertTriangle className="w-3.5 h-3.5" />}
              label="Alerts"
              value={totalAlertCount}
              color={criticalAlertCount > 0 ? tokens.domain.risk : tokens.domain.signal}
            />
            <OpStatItem
              icon={<TrendingUp className="w-3.5 h-3.5" />}
              label="Patterns"
              value={patternCount}
              color={tokens.domain.opportunity}
            />
            <OpStatItem
              icon={<Target className="w-3.5 h-3.5" />}
              label="Predictions"
              value={predictionCount}
              color={tokens.domain.reasoning}
            />
            <OpStatItem
              icon={<Zap className="w-3.5 h-3.5" />}
              label="Signals"
              value={insights?.kpis?.activeSignals ?? 0}
              color={tokens.domain.signal}
            />
            <OpStatItem
              icon={<Activity className="w-3.5 h-3.5" />}
              label="Confidence"
              value={`${avgConfidence}%`}
              color={tokens.confidence[getConfidenceTier(avgConfidence)].value}
            />
          </div>
        )}

        {/* Action CTA */}
        <div className="px-5 py-3">
          <ActionCTA
            label={criticalAlertCount > 0 ? 'Investigate Critical Alert' : 'View Intelligence Feed'}
            variant="primary"
            priority={criticalAlertCount > 0 ? 'critical' : 'medium'}
            onClick={() => {
              if (criticalAlertCount > 0 && alerts[0]) {
                navigateToCompany(alerts[0].companyId);
              } else {
                setActiveView('signal-intelligence');
              }
            }}
            icon={true}
          />
        </div>
      </motion.div>

      {/* ═══ S11: Intelligence Overview Dashboard (collapsible) ═══ */}
      <div className="rounded-xl border overflow-hidden" style={{ background: tokens.surface.card, borderColor: tokens.border.subtle }}>
        <button
          onClick={() => setDashboardExpanded(v => !v)}
          className="w-full flex items-center justify-between px-5 py-3 text-left"
        >
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4" style={{ color: tokens.accent.bright }} />
            <span className="text-sm font-semibold" style={{ color: tokens.text.primary }}>Intelligence Overview</span>
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0" style={{ background: tokens.accent.ghost, color: tokens.accent.bright, border: 0 }}>S11</Badge>
          </div>
          <ChevronRight className="w-4 h-4 transition-transform" style={{ color: tokens.text.muted, transform: dashboardExpanded ? 'rotate(90deg)' : 'none' }} />
        </button>
        <AnimatePresence>
          {dashboardExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="px-5 pb-5">
                <MainIntelligenceDashboard onNavigate={handleNavigate} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ═══ ERROR BANNERS (per-section, non-blocking) ═══ */}
      {alertsState.error && <SectionErrorBanner message={alertsState.error} onRetry={() => fetchAlerts(companyIds)} />}
      {patternsState.error && <SectionErrorBanner message={patternsState.error} onRetry={() => fetchPatterns(companyIds)} />}
      {predictionsState.error && <SectionErrorBanner message={predictionsState.error} onRetry={() => fetchPredictions(companyIds)} />}

      {/* ═══ 2. ACTIVE ALERTS ═══ */}
      <AnimatePresence>
        {alerts.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4" style={{ color: criticalAlertCount > 0 ? tokens.domain.risk : tokens.domain.signal }} />
              <h2 className="text-sm font-semibold" style={{ color: tokens.text.primary }}>Active Alerts</h2>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0" style={{ background: tokens.accent.ghost, color: tokens.accent.bright, border: 0 }}>
                {alerts.length}
              </Badge>
              {alertsState.loading && <Loader2 className="w-3 h-3 animate-spin" style={{ color: tokens.text.muted }} />}
            </div>
            <div className="space-y-2">
              {alerts.slice(0, 10).map((alert) => (
                <AlertCard
                  key={alert.id}
                  alert={alert}
                  onNavigateToCompany={navigateToCompany}
                  onAlertAction={handleAlertAction}
                  onSignalFeedback={handleSignalFeedback}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ 3. CROSS-ACCOUNT INTELLIGENCE PATTERNS ═══ */}
      <AnimatePresence>
        {patterns.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4" style={{ color: tokens.domain.opportunity }} />
              <h2 className="text-sm font-semibold" style={{ color: tokens.text.primary }}>Cross-Account Intelligence</h2>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0" style={{ background: tokens.domain.opportunity + '15', color: tokens.domain.opportunity, border: 0 }}>
                {patterns.length}
              </Badge>
              {patternsState.loading && <Loader2 className="w-3 h-3 animate-spin" style={{ color: tokens.text.muted }} />}
            </div>
            <div className="space-y-2">
              {patterns.map((pattern, i) => (
                <PatternCard
                  key={`${pattern.pattern}-${i}`}
                  pattern={pattern}
                  onNavigateToCompany={navigateToCompany}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ 4. PREDICTIVE INTELLIGENCE ═══ */}
      <AnimatePresence>
        {predictions.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <div className="flex items-center gap-2 mb-2">
              <Target className="w-4 h-4" style={{ color: tokens.domain.reasoning }} />
              <h2 className="text-sm font-semibold" style={{ color: tokens.text.primary }}>Predictive Intelligence</h2>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0" style={{ background: tokens.domain.reasoning + '15', color: tokens.domain.reasoning, border: 0 }}>
                {predictions.length}
              </Badge>
              {predictionsState.loading && <Loader2 className="w-3 h-3 animate-spin" style={{ color: tokens.text.muted }} />}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {predictions.slice(0, 6).map((pred, i) => (
                <PredictionCard
                  key={`pred-${pred.type}-${i}`}
                  prediction={pred}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ 3b. SIGNAL QUALITY (WI-5) ═══ */}
      <AnimatePresence>
        {learningInsights.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="rounded-xl border p-5"
            style={{ background: tokens.surface.card, borderColor: tokens.border.subtle }}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4" style={{ color: tokens.accent.bright }} />
                <h2 className="text-sm font-semibold" style={{ color: tokens.text.primary }}>Signal Quality</h2>
              </div>
              <Badge variant="secondary" className="text-[10px] px-2">
                {learningInsights.length} signal type{learningInsights.length !== 1 ? 's' : ''}
              </Badge>
            </div>
            <div className="space-y-2">
              {learningInsights.slice(0, 5).map((li, i) => (
                <div
                  key={`quality-${li.signalType}-${i}`}
                  className="flex items-center justify-between rounded-lg p-3"
                  style={{ background: tokens.surface.secondary }}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded-full" style={{
                      color: li.accuracyScore >= 0.7 ? tokens.domain.action : li.accuracyScore >= 0.4 ? tokens.domain.reasoning : tokens.domain.risk,
                      background: li.accuracyScore >= 0.7 ? tokens.trust.verified.bg : li.accuracyScore >= 0.4 ? tokens.confidence.medium.bg : tokens.confidence.low.bg,
                    }}>
                      {Math.round(li.accuracyScore * 100)}%
                    </span>
                    <div>
                      <p className="text-xs font-medium" style={{ color: tokens.text.primary }}>
                        {li.signalType.replace(/_/g, ' ')}
                      </p>
                      <p className="text-[10px]" style={{ color: tokens.text.muted }}>
                        {li.totalFeedback} feedback{li.totalFeedback !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded" style={{
                    color: li.trend === 'improving' ? tokens.domain.action : li.trend === 'declining' ? tokens.domain.risk : tokens.text.muted,
                    background: li.trend === 'improving' ? tokens.trust.verified.bg : li.trend === 'declining' ? tokens.priority.critical.bg : tokens.surface.secondary,
                  }}>
                    {li.trend === 'improving' ? '↑ improving' : li.trend === 'declining' ? '↓ declining' : '→ stable'}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ 5. ACCOUNT DELTA TRACKER ═══ */}
      <AccountDeltaTracker
        autoFetch={true}
        onNavigateToCompany={navigateToCompany}
        onInvestigate={(delta) => navigateToCompany(delta.companyId)}
      />

      {/* ═══ 6. INTELLIGENCE SYSTEM HEALTH ═══ */}
      <StatusMetricsBar
        kpis={insights?.kpis ?? null}
        systemHealth={insights?.systemHealth ?? null}
      />

      {/* ═══ 7. RECOMMENDED ACTIONS ═══ */}
      {extractedActions.length > 0 && (
        <ActionQueue
          actions={extractedActions}
          onNavigateToCompany={navigateToCompany}
          onActionExecute={(action) => navigateToCompany(action.companyId)}
        />
      )}

      {/* ═══ LOADING INDICATORS FOR EMPTY SECTIONS ═══ */}
      {alerts.length === 0 && !alertsState.error && alertsState.loading && (
        <div className="flex items-center gap-3 rounded-xl border p-4" style={{ background: tokens.surface.card, borderColor: tokens.border.subtle }}>
          <Loader2 className="w-4 h-4 animate-spin" style={{ color: tokens.accent.bright }} />
          <span className="text-xs" style={{ color: tokens.text.secondary }}>Scanning portfolio for alerts...</span>
        </div>
      )}
      {patterns.length === 0 && !patternsState.error && patternsState.loading && (
        <div className="flex items-center gap-3 rounded-xl border p-4" style={{ background: tokens.surface.card, borderColor: tokens.border.subtle }}>
          <Loader2 className="w-4 h-4 animate-spin" style={{ color: tokens.accent.bright }} />
          <span className="text-xs" style={{ color: tokens.text.secondary }}>Analyzing cross-account patterns...</span>
        </div>
      )}
      {predictions.length === 0 && !predictionsState.error && predictionsState.loading && (
        <div className="flex items-center gap-3 rounded-xl border p-4" style={{ background: tokens.surface.card, borderColor: tokens.border.subtle }}>
          <Loader2 className="w-4 h-4 animate-spin" style={{ color: tokens.accent.bright }} />
          <span className="text-xs" style={{ color: tokens.text.secondary }}>Generating predictions for top accounts...</span>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Sub-Components — Inline, not separate files
   ═══════════════════════════════════════════════════════════════ */

function OpStatItem({ icon, label, value, color }: {
  icon: React.ReactNode; label: string; value: number | string; color: string;
}) {
  return (
    <div className="flex items-center gap-2 px-4 py-2.5 min-w-[100px]">
      <span style={{ color }}>{icon}</span>
      <div>
        <p className="text-sm font-bold tabular-nums" style={{ color }}>{value}</p>
        <p className="text-[10px]" style={{ color: tokens.text.muted }}>{label}</p>
      </div>
    </div>
  );
}

function SectionErrorBanner({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border p-4" style={{ background: tokens.opacity.shadow, borderColor: tokens.confidence.low.bg }}>
      <AlertTriangle className="w-4 h-4 shrink-0" style={{ color: tokens.domain.risk }} />
      <p className="text-sm flex-1" style={{ color: tokens.text.secondary }}>{message}</p>
      <Button variant="outline" size="sm" onClick={onRetry} className="text-xs">Retry</Button>
    </div>
  );
}

function AlertCard({ alert, onNavigateToCompany, onAlertAction, onSignalFeedback }: {
  alert: OperationsAlert;
  onNavigateToCompany: (id: string) => void;
  onAlertAction: (alertId: string, action: 'acknowledge' | 'resolve' | 'dismiss') => void;
  onSignalFeedback: (signalId: string, companyId: string, type: 'accurate' | 'inaccurate') => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [feedbackGiven, setFeedbackGiven] = useState<string | null>(null);
  const style = SEVERITY_STYLES[alert.severity] || SEVERITY_STYLES.info;
  const SeverityIcon = style.icon;
  const alertConfidence = Math.round((alert.correlation?.confidence ?? alert.prediction?.confidence ?? 0.5) * 100);

  return (
    <motion.div
      layout
      className="rounded-xl border overflow-hidden transition-colors"
      style={{ background: tokens.surface.card, borderColor: style.border }}
    >
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full text-left p-4 flex items-start gap-3"
      >
        <div className="shrink-0 mt-0.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: style.bg }}>
            <SeverityIcon className="w-4 h-4" style={{ color: style.color }} />
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <Badge className="text-[10px] px-2 py-0 font-semibold uppercase" style={{ color: style.color, background: style.bg, border: `1px solid ${style.border}` }}>
              {alert.severity}
            </Badge>
            <span className="text-[10px]" style={{ color: tokens.text.muted }}>
              {alert.companyName}
            </span>
          </div>
          <p className="text-sm font-medium" style={{ color: tokens.text.primary }}>{alert.title}</p>
          {!expanded && (
            <p className="text-xs mt-1 line-clamp-1" style={{ color: tokens.text.secondary }}>{alert.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <ConfidenceIndicator value={alertConfidence} mode="bar" size="xs" showPercentage={true} />
          <ChevronRight className="w-4 h-4 transition-transform" style={{ color: tokens.text.muted, transform: expanded ? 'rotate(90deg)' : 'none' }} />
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 pt-0" style={{ borderTop: `1px solid ${tokens.border.subtle}` }}>
          <p className="text-sm mt-3 leading-relaxed" style={{ color: tokens.text.secondary }}>{alert.description}</p>
          
          {/* Reasoning: Why should I care? */}
          {alert.actionRequired && (
            <div className="mt-3">
              <InlineReasoning
                reasoning={alert.actionRequired}
                positiveFactors={alert.correlation ? [alert.correlation.businessImplication] : alert.prediction ? [alert.prediction.salesImplication] : []}
                negativeFactors={[]}
                onClickExpand={() => {}}
              />
            </div>
          )}

          {/* Evidence for correlation alerts */}
          {alert.correlation && (
            <div className="mt-3">
              <p className="text-[11px] uppercase tracking-wider font-semibold mb-1.5" style={{ color: tokens.text.muted }}>Correlation Evidence</p>
              <EvidenceChain
                items={[{
                  source: 'Cross-Signal Analysis',
                  sourceType: 'internal',
                  snippet: `${alert.correlation.pattern.replace(/_/g, ' ')} — ${alert.correlation.description}`,
                }]}
                title="Pattern Evidence"
                conclusion={alert.correlation.businessImplication}
                verdict={alert.correlation.confidence >= 0.7 ? 'strong' : alert.correlation.confidence >= 0.5 ? 'moderate' : 'weak'}
              />
            </div>
          )}

          {/* Prediction details */}
          {alert.prediction && (
            <div className="mt-3 rounded-lg p-3" style={{ background: tokens.surface.secondary }}>
              <p className="text-[11px] uppercase tracking-wider font-semibold mb-1" style={{ color: tokens.text.muted }}>Prediction</p>
              <p className="text-xs" style={{ color: tokens.text.secondary }}>{alert.prediction.description}</p>
              <div className="flex items-center gap-3 mt-2">
                <span className="text-[10px]" style={{ color: tokens.text.muted }}>
                  Timeframe: {alert.prediction.timeframe}
                </span>
              </div>
            </div>
          )}

          {/* Action + Lifecycle buttons */}
          <div className="mt-3 flex items-center gap-2">
            <ActionCTA
              label="Investigate Account"
              variant="inline"
              priority={alert.severity === 'critical' ? 'critical' : 'medium'}
              onClick={() => onNavigateToCompany(alert.companyId)}
              icon={true}
            />
            <div className="flex items-center gap-1 ml-auto">
              <button
                onClick={(e) => { e.stopPropagation(); setActionLoading('acknowledge'); onAlertAction(alert.id, 'acknowledge'); setTimeout(() => setActionLoading(null), 500); }}
                className="text-[10px] px-2 py-1 rounded-md border transition-colors"
                style={{ color: tokens.text.muted, background: tokens.surface.secondary, borderColor: tokens.border.subtle }}
                disabled={actionLoading !== null}
              >
                {actionLoading === 'acknowledge' ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Acknowledge'}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setActionLoading('resolve'); onAlertAction(alert.id, 'resolve'); setTimeout(() => setActionLoading(null), 500); }}
                className="text-[10px] px-2 py-1 rounded-md border transition-colors"
                style={{ color: tokens.domain.action, background: tokens.surface.secondary, borderColor: tokens.border.subtle }}
                disabled={actionLoading !== null}
              >
                {actionLoading === 'resolve' ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Resolve'}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setActionLoading('dismiss'); onAlertAction(alert.id, 'dismiss'); setTimeout(() => setActionLoading(null), 500); }}
                className="text-[10px] px-2 py-1 rounded-md border transition-colors"
                style={{ color: tokens.text.muted, background: tokens.surface.secondary, borderColor: tokens.border.subtle }}
                disabled={actionLoading !== null}
              >
                {actionLoading === 'dismiss' ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Dismiss'}
              </button>
            </div>
          </div>
          {/* WI-5: Signal quality feedback — only shown when alert has a signalId */}
          {alert.signalId && alert.companyId && (
            <div className="mt-2 pt-2 flex items-center gap-2" style={{ borderTop: `1px solid ${tokens.border.subtle}` }}>
              <span className="text-[10px]" style={{ color: tokens.text.muted }}>Was this signal useful?</span>
              {feedbackGiven ? (
                <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ color: tokens.domain.action, background: tokens.trust.verified.bg }}>Thanks for feedback</span>
              ) : (
                <>
                  <button
                    onClick={(e) => { e.stopPropagation(); setFeedbackGiven('accurate'); onSignalFeedback(alert.signalId!, alert.companyId, 'accurate'); }}
                    className="text-[10px] px-2 py-0.5 rounded-full border transition-colors"
                    style={{ color: tokens.domain.action, background: tokens.opacity.shadow, borderColor: tokens.trust.verified.border }}
                    title="Accurate"
                  >&#x1F44D;&#xFE0F; Accurate</button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setFeedbackGiven('inaccurate'); onSignalFeedback(alert.signalId!, alert.companyId, 'inaccurate'); }}
                    className="text-[10px] px-2 py-0.5 rounded-full border transition-colors"
                    style={{ color: tokens.domain.risk, background: tokens.opacity.shadow, borderColor: tokens.confidence.low.border }}
                    title="Inaccurate"
                  >&#x1F44E;&#xFE0F; Inaccurate</button>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}

function PatternCard({ pattern, onNavigateToCompany }: {
  pattern: CrossAccountInsight;
  onNavigateToCompany: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const PatternIcon = PATTERN_ICONS[pattern.pattern] || TrendingUp;
  const confidence = Math.round(pattern.confidence * 100);

  return (
    <motion.div
      layout
      className="rounded-xl border overflow-hidden"
      style={{ background: tokens.surface.card, borderColor: tokens.border.subtle }}
    >
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full text-left p-4 flex items-start gap-3"
      >
        <div className="shrink-0 mt-0.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: tokens.domain.opportunity + '12' }}>
            <PatternIcon className="w-4 h-4" style={{ color: tokens.domain.opportunity }} />
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <Badge className="text-[10px] px-2 py-0 font-semibold" style={{ color: tokens.domain.opportunity, background: tokens.domain.opportunity + '12', border: `1px solid ${tokens.domain.opportunity}25` }}>
              {PATTERN_LABELS[pattern.pattern]}
            </Badge>
            <span className="text-[10px]" style={{ color: tokens.text.muted }}>
              {pattern.signalCount} signals · {pattern.affectedCompanyNames.length} accounts
            </span>
          </div>
          <p className="text-sm font-medium" style={{ color: tokens.text.primary }}>{pattern.description}</p>
          {!expanded && (
            <div className="flex flex-wrap gap-1 mt-2">
              {pattern.affectedCompanyNames.slice(0, 3).map(name => (
                <span key={name} className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: tokens.surface.secondary, color: tokens.text.secondary }}>
                  {name}
                </span>
              ))}
              {pattern.affectedCompanyNames.length > 3 && (
                <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: tokens.surface.secondary, color: tokens.text.muted }}>
                  +{pattern.affectedCompanyNames.length - 3} more
                </span>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <ConfidenceIndicator value={confidence} mode="bar" size="xs" showPercentage={true} />
          <ChevronRight className="w-4 h-4 transition-transform" style={{ color: tokens.text.muted, transform: expanded ? 'rotate(90deg)' : 'none' }} />
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 pt-0" style={{ borderTop: `1px solid ${tokens.border.subtle}` }}>
          <InlineReasoning
            reasoning={pattern.businessImplication}
            positiveFactors={[pattern.recommendedStrategy]}
            negativeFactors={[]}
            onClickExpand={() => {}}
          />

          {/* Affected companies — clickable */}
          <div className="mt-3">
            <p className="text-[11px] uppercase tracking-wider font-semibold mb-1.5" style={{ color: tokens.text.muted }}>
              Affected Accounts ({pattern.affectedCompanyNames.length})
            </p>
            <div className="flex flex-wrap gap-1.5">
              {pattern.affectedCompanyNames.map((name, i) => (
                <button
                  key={`${name}-${i}`}
                  onClick={() => {
                    const cid = pattern.affectedCompanyIds[i];
                    if (cid) onNavigateToCompany(cid);
                  }}
                  className="text-[10px] px-2 py-0.5 rounded-full transition-colors"
                  style={{
                    background: tokens.accent.ghost,
                    color: tokens.accent.bright,
                    border: `1px solid ${tokens.accent.bright}30`,
                  }}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-3">
            <ActionCTA
              label="Explore Pattern"
              variant="inline"
              priority="medium"
              onClick={() => {
                if (pattern.affectedCompanyIds[0]) {
                  onNavigateToCompany(pattern.affectedCompanyIds[0]);
                }
              }}
              icon={true}
            />
          </div>
        </div>
      )}
    </motion.div>
  );
}

function PredictionCard({ prediction }: { prediction: IntelligencePrediction }) {
  const confidence = Math.round(prediction.confidence * 100);
  const tier = getConfidenceTier(confidence);
  const tierColor = tokens.confidence[tier].value;

  return (
    <div className="rounded-xl border p-4" style={{ background: tokens.surface.card, borderColor: tokens.border.subtle }}>
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: tokens.text.muted }}>
            {prediction.type.replace(/_/g, ' ')}
          </p>
          <p className="text-sm font-medium mt-0.5 leading-snug" style={{ color: tokens.text.primary }}>
            {prediction.description}
          </p>
        </div>
        <ConfidenceIndicator value={confidence} mode="ring" size="sm" showPercentage={true} />
      </div>

      <div className="flex items-center gap-3 mt-2 mb-3">
        <span className="text-[10px] flex items-center gap-1" style={{ color: tokens.text.muted }}>
          <Clock className="w-3 h-3" /> {prediction.timeframe}
        </span>
        <span className="text-[10px] flex items-center gap-1" style={{ color: tokens.text.muted }}>
          <Zap className="w-3 h-3" /> {prediction.supportingSignals.length} signals
        </span>
      </div>

      {/* Sales implication — truncated */}
      <p className="text-xs leading-relaxed line-clamp-2" style={{ color: tokens.text.secondary }}>
        {prediction.salesImplication}
      </p>

      {/* Recommended preparation — on expand via tooltip */}
      {prediction.recommendedPreparation && (
        <div className="mt-2 rounded-lg p-2" style={{ background: tokens.surface.secondary }}>
          <p className="text-[10px]" style={{ color: tierColor }}>
            <span className="font-semibold">Preparation: </span>
            {prediction.recommendedPreparation}
          </p>
        </div>
      )}
    </div>
  );
}
