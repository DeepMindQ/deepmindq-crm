'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  PageTransition, StatCard, AnimatedCounter, GlassPanel,
  EmptyState, StaggerGrid, StaggerItem, SectionHeader, AnimatedBar,
} from '@/components/ui/animated-components';
import { ConfidenceBar } from '@/components/enterprise/ConfidenceBar';
import { EvidenceBadge } from '@/components/enterprise/EvidenceBadge';
import { useAppStore } from '@/lib/store';

import {
  Sparkles, CheckCircle2, Eye, XCircle, Clock,
  Building2, Target, Zap, TrendingUp, ShieldCheck,
  BarChart3, Brain, ArrowRight, Loader2, ChevronDown,
  RefreshCw, Lightbulb, FileText, Users,
  ChevronUp, Gauge, AlertTriangle, DollarSign,
  MessageSquare, Briefcase, Calendar, Layers, Award,
  ExternalLink, Search, Radar, Activity, Plus, ChevronRight,
} from 'lucide-react';

/* ═══════════════════════════════════════════════════
   Constants
   ═══════════════════════════════════════════════════ */
const GOLD = '#D4AF37';
const GOLD_GRAD = 'linear-gradient(135deg, #9A8340, #D4AF37, #E8C860)';
const INTEL = '#2563eb';

/* ═══════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════ */
interface Company {
  id: string;
  rawName: string;
  domain: string | null;
  industry: string | null;
}

interface Signal {
  id: string;
  title: string;
  signalType: string;
  severity: string;
  impact: string;
}

interface ScoringBreakdown {
  signalConfidence: number;
  capabilityMatch: number;
  freshnessScore: number;
  evidenceQuality: number;
  businessImpact: number;
}

interface Opportunity {
  id: string;
  opportunityTitle: string;
  businessTrigger: string;
  whyNow: string;
  businessProblem: string;
  recommendedCapability: string;
  recommendedStakeholders: string;
  suggestedConversation: string;
  confidenceScore: number;
  freshnessScore: number;
  matchScore: number;
  opportunityScore: number;
  priority: string;
  status: string;
  rejectionReason: string | null;
  reviewedAt: string | null;
  createdAt: string;
  company: Company;
  signal: Signal;
  scoringBreakdown?: ScoringBreakdown;
}

interface DealIntel {
  id: string;
  scoringFactors: Array<{ label: string; score: number; evidence: string; source?: string }>;
  riskFactors: Array<{ risk: string; severity: string; mitigation: string }>;
  competitivePosition: string;
  buyerReadiness: number;
  dealVelocity: string;
  recommendedApproach: string;
  keyInsights: string[];
  conversationStarters: string[];
  pricingGuidance: string;
  nextBestAction: string;
  confidence: number;
  generatedAt: string;
}

interface APIResponse {
  opportunities: Opportunity[];
  total: number;
}

const REJECTION_REASONS = [
  { key: 'WRONG_TIMING', label: 'Wrong Timing', icon: Clock },
  { key: 'EXISTING_RELATIONSHIP', label: 'Existing Relationship', icon: Users },
  { key: 'NOT_RELEVANT', label: 'Not Relevant', icon: XCircle },
  { key: 'LOW_CONFIDENCE', label: 'Low Confidence', icon: TrendingUp },
  { key: 'NO_BUDGET', label: 'No Budget', icon: BarChart3 },
  { key: 'OTHER', label: 'Other', icon: FileText },
] as const;

const SCORING_DIMENSIONS = [
  { key: 'signalConfidence' as const, label: 'Signal Confidence', color: 'var(--color-gold)' },
  { key: 'capabilityMatch' as const, label: 'Capability Match', color: '#059669' },
  { key: 'freshnessScore' as const, label: 'Freshness', color: '#2563EB' },
  { key: 'evidenceQuality' as const, label: 'Evidence Quality', color: '#9333EA' },
  { key: 'businessImpact' as const, label: 'Business Impact', color: '#DC2626' },
] as const;

const PRIORITY_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  high: { bg: 'bg-red-50 border-red-200', text: 'text-red-700', label: 'High' },
  medium: { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', label: 'Medium' },
  low: { bg: 'bg-gray-50 border-gray-200', text: 'text-gray-500', label: 'Low' },
};

/* ═══════════════════════════════════════════════════
   Score Ring
   ═══════════════════════════════════════════════════ */
function ScoreRing({ score, size = 72, strokeWidth = 5 }: { score: number; size?: number; strokeWidth?: number }) {
  const radius = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * radius;
  const offset = circ - (score / 100) * circ;
  const color = score >= 80 ? '#10B981' : score >= 60 ? '#F59E0B' : score >= 40 ? '#EF4444' : '#9CA3AF';

  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg aria-hidden="true" width={size} height={size} className="-rotate-90">
        <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke="#F3F4F6" strokeWidth={strokeWidth} />
        <motion.circle cx={size/2} cy={size/2} r={radius}
          fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"
          strokeDasharray={circ} initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
          style={{ filter: `drop-shadow(0 0 4px ${color}40)` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-bold tabular-nums" style={{ color }}>{Math.round(score)}</span>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   Scoring Breakdown Bars
   ═══════════════════════════════════════════════════ */
function ScoringBreakdownBars({ breakdown }: { breakdown: ScoringBreakdown }) {
  return (
    <div className="space-y-2">
      {SCORING_DIMENSIONS.map((dim) => {
        const raw = breakdown[dim.key];
        const value = dim.key === 'freshnessScore' ? raw : Math.round(raw * 100);
        return (
          <div key={dim.key} className="flex items-center gap-2.5">
            <span className="text-[11px] text-muted-foreground w-[105px] shrink-0 text-right truncate">{dim.label}</span>
            <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
              <motion.div className="h-full rounded-full" style={{ background: dim.color }}
                initial={{ width: 0 }} animate={{ width: `${Math.min(value, 100)}%` }}
                transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }} />
            </div>
            <span className="text-[11px] font-medium tabular-nums text-muted-foreground w-8 text-right">{value}%</span>
          </div>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   Deal Intelligence Panel
   ═══════════════════════════════════════════════════ */
function DealIntelPanel({ intel, loading }: { intel: any | null; loading: boolean }) {
  if (loading) {
    return (
      <div className="space-y-4 p-6">
        <div className="flex items-center gap-3">
          <Loader2 size={20} className="animate-spin" style={{ color: GOLD }} />
          <div>
            <p className="text-sm font-semibold text-foreground">Analyzing Deal Intelligence...</p>
            <p className="text-xs text-muted-foreground">Running 7-engine analysis pipeline</p>
          </div>
        </div>
        <div className="space-y-2">
          {['Signal Analysis', 'Evidence Grounding', 'Competitive Mapping', 'Buyer Readiness', 'Risk Assessment', 'Deal Strategy', 'Next Best Action'].map((step, i) => (
            <div key={step} className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full border-2 border-gray-200 flex items-center justify-center">
                {i < 2 ? <CheckCircle2 size={12} className="text-emerald-500" /> : i === 2 ? <Loader2 size={12} className="animate-spin text-amber-500" /> : null}
              </div>
              <span className={`text-xs ${i < 2 ? 'text-muted-foreground' : i === 2 ? 'text-amber-600 font-medium' : 'text-gray-300'}`}>{step}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!intel) return null;

  return (
    <div className="space-y-4">
      {/* Deal Overview Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="p-3 rounded-lg bg-gray-50 border border-gray-100 text-center">
          <p className="text-xl font-black" style={{ color: GOLD }}>{intel.confidence}%</p>
          <p className="text-[11px] text-muted-foreground uppercase">Confidence</p>
        </div>
        <div className="p-3 rounded-lg bg-gray-50 border border-gray-100 text-center">
          <p className="text-xl font-black" style={{ color: intel.buyerReadiness >= 70 ? '#059669' : '#d97706' }}>{intel.buyerReadiness}%</p>
          <p className="text-[11px] text-muted-foreground uppercase">Buyer Ready</p>
        </div>
        <div className="p-3 rounded-lg bg-gray-50 border border-gray-100 text-center">
          <p className="text-sm font-black text-foreground">{intel.dealVelocity}</p>
          <p className="text-[11px] text-muted-foreground uppercase">Velocity</p>
        </div>
      </div>

      {/* Competitive Position */}
      {intel.competitivePosition && (
        <div className="p-3 rounded-lg border border-amber-100 bg-amber-50/40">
          <div className="flex items-center gap-1.5 mb-1">
            <Award size={12} className="text-amber-600" />
            <span className="text-[11px] font-semibold uppercase text-amber-600">Competitive Position</span>
          </div>
          <p className="text-xs text-foreground/80">{intel.competitivePosition}</p>
        </div>
      )}

      {/* Key Insights */}
      {intel.keyInsights?.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold uppercase text-muted-foreground mb-2 flex items-center gap-1">
            <Brain size={11} /> Key Insights
          </p>
          <div className="space-y-1.5">
            {(intel.keyInsights as string[]).slice(0, 4).map((insight: string, i: number) => (
              <div key={i} className="flex items-start gap-1.5 text-xs">
                <ChevronRight size={11} className="text-amber-500 mt-0.5 shrink-0" />
                <span className="text-muted-foreground">{insight}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Risk Factors */}
      {intel.riskFactors?.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold uppercase text-muted-foreground mb-2 flex items-center gap-1">
            <AlertTriangle size={11} className="text-red-500" /> Risk Factors
          </p>
          <div className="space-y-1.5">
            {(intel.riskFactors as any[]).slice(0, 4).map((risk: any, i: number) => (
              <div key={i} className="p-2 rounded-lg border border-red-100 bg-red-50/30">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-red-700">{risk.risk}</p>
                  <Badge className="text-[9px] bg-red-100 text-red-600">{risk.severity}</Badge>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">Mitigation: {risk.mitigation}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Conversation Starters */}
      {intel.conversationStarters?.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold uppercase text-muted-foreground mb-2 flex items-center gap-1">
            <MessageSquare size={11} className="text-blue-500" /> Conversation Starters
          </p>
          <div className="space-y-1.5">
            {(intel.conversationStarters as string[]).slice(0, 3).map((starter: string, i: number) => (
              <div key={i} className="p-2 rounded-lg bg-blue-50/40 border border-blue-100 text-xs text-muted-foreground">
                "{starter}"
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pricing Guidance */}
      {intel.pricingGuidance && (
        <div>
          <p className="text-[11px] font-semibold uppercase text-muted-foreground mb-1.5 flex items-center gap-1">
            <DollarSign size={11} className="text-emerald-500" /> Pricing Guidance
          </p>
          <p className="text-xs text-muted-foreground p-2 rounded-lg bg-emerald-50/40 border border-emerald-100">{intel.pricingGuidance}</p>
        </div>
      )}

      {/* Recommended Approach */}
      {intel.recommendedApproach && (
        <div>
          <p className="text-[11px] font-semibold uppercase text-muted-foreground mb-1.5 flex items-center gap-1">
            <Lightbulb size={11} className="text-amber-500" /> Recommended Approach
          </p>
          <p className="text-xs text-muted-foreground p-2.5 rounded-lg bg-amber-50/50 border border-amber-100 leading-relaxed">{intel.recommendedApproach}</p>
        </div>
      )}

      {/* Next Best Action */}
      {intel.nextBestAction && (
        <div className="p-3 rounded-lg border-2 border-amber-200 bg-gradient-to-r from-amber-50/60 to-white">
          <div className="flex items-center gap-1.5 mb-1">
            <Zap size={13} className="text-amber-600" />
            <span className="text-[11px] font-bold uppercase text-amber-600">Next Best Action</span>
          </div>
          <p className="text-xs font-medium text-foreground">{intel.nextBestAction}</p>
        </div>
      )}

      <div className="text-[11px] text-muted-foreground/60 text-right">
        Generated: {new Date(intel.generatedAt).toLocaleString()}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   Deal Room Card (Expanded View)
   ═══════════════════════════════════════════════════ */
function DealRoomCard({
  opportunity, expanded, onToggle, onAction, onCompanyClick, isActioning, dealIntel, dealIntelLoading, onLoadIntel,
}: {
  opportunity: Opportunity; expanded: boolean; onToggle: () => void;
  onAction: (id: string, action: 'accept' | 'reject' | 'monitor', reason?: string) => void;
  onCompanyClick: (companyId: string) => void; isActioning: boolean;
  dealIntel: any; dealIntelLoading: boolean; onLoadIntel: () => void;
}) {
  const priority = PRIORITY_STYLES[opportunity.priority] || PRIORITY_STYLES.low;
  const isPending = opportunity.status === 'pending_review';
  const stakeholders: string[] = (() => { try { return JSON.parse(opportunity.recommendedStakeholders); } catch { return []; } })();

  return (
    <motion.div layout className="rounded-xl border border-gray-200 bg-white overflow-hidden hover:shadow-lg transition-all duration-300">
      {/* Top accent */}
      <div className="h-0.5" style={{ background: GOLD_GRAD }} />

      {/* Header */}
      <div className="p-5 cursor-pointer" onClick={onToggle} role="button" tabIndex={0} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(); } }}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1.5">
              <button onClick={(e) => { e.stopPropagation(); onCompanyClick(opportunity.company.id); }}
                className="flex items-center gap-1.5 hover:opacity-80 transition-opacity">
                <Building2 className="w-3.5 h-3.5 text-primary" />
                <span className="text-sm font-semibold text-foreground hover:underline truncate max-w-[200px]">{opportunity.company.rawName}</span>
              </button>
              {opportunity.company.industry && (
                <Badge variant="outline" className="text-[11px] px-1.5 py-0 border-gray-200 text-muted-foreground">{opportunity.company.industry}</Badge>
              )}
              <Badge className={`text-[11px] px-1.5 py-0 border font-medium ${priority.bg} ${priority.text}`}>{priority.label}</Badge>
              <Badge className={`text-[11px] px-1.5 py-0 border font-medium ${
                opportunity.status === 'accepted' ? 'border-emerald-200 text-emerald-600 bg-emerald-50' :
                opportunity.status === 'monitored' ? 'border-blue-200 text-blue-600 bg-blue-50' :
                opportunity.status === 'rejected' ? 'border-red-200 text-red-500 bg-red-50' :
                'border-amber-200 text-amber-600 bg-amber-50'
              }`}>
                {opportunity.status.replace(/_/g, ' ')}
              </Badge>
            </div>
            <h3 className="text-base font-bold text-foreground leading-snug mb-1">{opportunity.opportunityTitle}</h3>
            <div className="flex items-start gap-1.5 text-xs text-muted-foreground leading-relaxed">
              <Zap className="w-3 h-3 mt-0.5 text-primary shrink-0" />
              <p className="line-clamp-2">{opportunity.businessTrigger}</p>
            </div>
          </div>
          <ScoreRing score={opportunity.opportunityScore} />
        </div>

        {/* Signal badge */}
        {opportunity.signal && (
          <div className="flex items-center gap-1.5 mt-3 px-2.5 py-1.5 rounded-lg bg-gray-50 border border-gray-100 w-fit">
            <Target className="w-3 h-3 text-primary/70" />
            <span className="text-[11px] text-muted-foreground font-medium">{opportunity.signal.signalType}</span>
            <span className="text-[11px] text-muted-foreground">·</span>
            <span className="text-[11px] text-muted-foreground truncate max-w-[260px]">{opportunity.signal.title}</span>
          </div>
        )}
      </div>

      {/* Scoring Breakdown (always visible) */}
      {opportunity.scoringBreakdown && (
        <div className="px-5 pb-3">
          <div className="px-3 py-2.5 rounded-lg bg-gray-50/50 border border-gray-100">
            <ScoringBreakdownBars breakdown={opportunity.scoringBreakdown} />
          </div>
        </div>
      )}

      {/* Expanded Deal Intelligence Room */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="border-t border-gray-200">
              {/* Opportunity Details Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-5">
                {/* Why Now */}
                {opportunity.whyNow && (
                  <div>
                    <p className="text-[11px] font-semibold uppercase text-muted-foreground mb-1.5 flex items-center gap-1">
                      <Clock size={10} className="text-blue-500" /> Why Now
                    </p>
                    <p className="text-xs text-foreground/80 leading-relaxed p-2.5 rounded-lg bg-blue-50/40 border border-blue-100">{opportunity.whyNow}</p>
                  </div>
                )}
                {/* Business Problem */}
                {opportunity.businessProblem && (
                  <div>
                    <p className="text-[11px] font-semibold uppercase text-muted-foreground mb-1.5 flex items-center gap-1">
                      <AlertTriangle size={10} className="text-red-500" /> Business Problem
                    </p>
                    <p className="text-xs text-foreground/80 leading-relaxed p-2.5 rounded-lg bg-red-50/30 border border-red-100">{opportunity.businessProblem}</p>
                  </div>
                )}
                {/* Recommended Capability */}
                {opportunity.recommendedCapability && (
                  <div>
                    <p className="text-[11px] font-semibold uppercase text-muted-foreground mb-1.5 flex items-center gap-1">
                      <Lightbulb size={10} className="text-amber-500" /> Recommended Capability
                    </p>
                    <p className="text-xs text-foreground/80 p-2.5 rounded-lg bg-amber-50/40 border border-amber-100">{opportunity.recommendedCapability}</p>
                  </div>
                )}
                {/* Stakeholders */}
                {stakeholders.length > 0 && (
                  <div>
                    <p className="text-[11px] font-semibold uppercase text-muted-foreground mb-1.5 flex items-center gap-1">
                      <Users size={10} className="text-purple-500" /> Recommended Stakeholders
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {stakeholders.map((s, i) => (
                        <Badge key={i} className="text-[11px] px-2 py-0 bg-purple-50 text-purple-600 border-purple-200">{s}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                {/* Suggested Conversation */}
                {opportunity.suggestedConversation && (
                  <div className="md:col-span-2">
                    <p className="text-[11px] font-semibold uppercase text-muted-foreground mb-1.5 flex items-center gap-1">
                      <MessageSquare size={10} className="text-emerald-500" /> Suggested Conversation
                    </p>
                    <p className="text-xs text-foreground/80 leading-relaxed p-2.5 rounded-lg bg-emerald-50/40 border border-emerald-100">{opportunity.suggestedConversation}</p>
                  </div>
                )}
              </div>

              {/* Deal Intelligence Section */}
              <Separator />
              <div className="p-5">
                <div className="flex items-center gap-2 mb-4">
                  <div className="h-5 w-1.5 rounded-full" style={{ background: GOLD_GRAD }} />
                  <Brain size={16} style={{ color: GOLD }} />
                  <h3 className="text-sm font-bold text-foreground">Deal Intelligence Room</h3>
                  {!dealIntel && !dealIntelLoading && (
                    <Button size="sm" onClick={(e) => { e.stopPropagation(); onLoadIntel(); }}
                      className="gap-1.5 h-7 text-[11px] ml-auto" style={{ background: GOLD, color: '#060910' }}>
                      <Sparkles size={11} /> Analyze Deal
                    </Button>
                  )}
                  {dealIntel && (
                    <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); onLoadIntel(); }}
                      className="gap-1.5 h-7 text-[11px] ml-auto border-gray-200">
                      <RefreshCw size={11} /> Refresh
                    </Button>
                  )}
                </div>
                <DealIntelPanel intel={dealIntel} loading={dealIntelLoading} />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Action Footer */}
      <div className="flex items-center gap-2 px-5 py-3 border-t border-gray-100 bg-gray-50/50">
        {isPending ? (
          <>
            <Button size="sm" onClick={() => onAction(opportunity.id, 'accept')} disabled={isActioning}
              className="h-8 px-3 text-xs bg-emerald-500 hover:bg-emerald-600 text-white gap-1.5">
              {isActioning ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />} Accept
            </Button>
            <Button size="sm" variant="outline" onClick={() => onAction(opportunity.id, 'monitor')} disabled={isActioning}
              className="h-8 px-3 text-xs border-blue-200 text-blue-600 hover:bg-blue-50 gap-1.5">
              <Eye className="w-3 h-3" /> Monitor
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline" disabled={isActioning}
                  className="h-8 px-3 text-xs border-red-200 text-red-500 hover:bg-red-50 gap-1.5">
                  <XCircle className="w-3 h-3" /> Reject <ChevronDown className="w-3 h-3 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel className="text-xs text-muted-foreground">Select rejection reason</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {REJECTION_REASONS.map((reason) => (
                  <DropdownMenuItem key={reason.key} onClick={() => onAction(opportunity.id, 'reject', reason.key)}
                    className="text-xs cursor-pointer gap-2">
                    <reason.icon className="w-3.5 h-3.5 text-muted-foreground" /> {reason.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        ) : (
          <Badge variant="outline" className={`text-[11px] font-medium ${
            opportunity.status === 'accepted' ? 'border-emerald-200 text-emerald-600 bg-emerald-50' :
            opportunity.status === 'monitored' ? 'border-blue-200 text-blue-600 bg-blue-50' :
            'border-red-200 text-red-500 bg-red-50'
          }`}>
            {opportunity.status === 'accepted' && <CheckCircle2 className="w-3 h-3 mr-1" />}
            {opportunity.status === 'monitored' && <Eye className="w-3 h-3 mr-1" />}
            {opportunity.status === 'rejected' && <XCircle className="w-3 h-3 mr-1" />}
            {opportunity.status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
          </Badge>
        )}
        <div className="ml-auto flex items-center gap-3">
          <button onClick={onToggle} className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors">
            {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            {expanded ? 'Collapse' : 'Expand Deal Room'}
          </button>
          <span className="text-[11px] text-muted-foreground/60 tabular-nums">
            {new Date(opportunity.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════
   Loading Skeleton
   ═══════════════════════════════════════════════════ */
function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
          <div className="flex items-start justify-between">
            <div className="space-y-2 flex-1">
              <div className="flex items-center gap-2"><Skeleton className="h-4 w-32" /><Skeleton className="h-4 w-20" /><Skeleton className="h-5 w-14" /></div>
              <Skeleton className="h-5 w-72" /><Skeleton className="h-3 w-full max-w-xs" />
            </div>
            <Skeleton className="h-[72px] w-[72px] rounded-full" />
          </div>
          <Skeleton className="h-8 w-64 rounded-lg" />
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   Main Screen — Deal Intelligence Room
   ═══════════════════════════════════════════════════ */
export default function OpportunityWorkspaceScreen() {
  const [allOpportunities, setAllOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('ALL');
  const [isActioning, setIsActioning] = useState(false);
  const [actioningIds, setActioningIds] = useState<Set<string>>(new Set());

  // Expanded deal rooms
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Deal Intelligence state per opportunity
  const [dealIntels, setDealIntels] = useState<Record<string, any>>({});
  const [dealIntelLoading, setDealIntelLoading] = useState<Record<string, boolean>>({});

  const setSelectedCompanyId = useAppStore((s: any) => s.setSelectedCompanyId);

  // Fetch opportunities
  const fetchOpportunities = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/g-outreach/opportunities?status=pending_review&limit=50&offset=0');
      if (!res.ok) throw new Error('Failed');
      const data: APIResponse = await res.json();
      setAllOpportunities(data.opportunities);
    } catch { toast.error('Failed to load opportunities'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchOpportunities(); }, [fetchOpportunities]);

  const filtered = useMemo(() => {
    if (activeTab === 'ALL') return allOpportunities;
    return allOpportunities.filter((o) => o.status === activeTab);
  }, [allOpportunities, activeTab]);

  const counts = useMemo(() => {
    const c = { pending_review: 0, accepted: 0, monitored: 0, rejected: 0, total: 0 };
    allOpportunities.forEach((o) => { if (o.status in c) c[o.status as keyof typeof c]++; c.total++; });
    return c;
  }, [allOpportunities]);

  const tabs = useMemo(() => [
    { key: 'ALL', label: 'All Deals', count: counts.total },
    { key: 'pending_review', label: 'Pending', count: counts.pending_review },
    { key: 'accepted', label: 'Accepted', count: counts.accepted },
    { key: 'monitored', label: 'Monitored', count: counts.monitored },
    { key: 'rejected', label: 'Rejected', count: counts.rejected },
  ], [counts]);

  // Handle action
  const handleAction = useCallback(async (id: string, action: 'accept' | 'reject' | 'monitor', reason?: string) => {
    setActioningIds((prev) => new Set(prev).add(id));
    setIsActioning(true);
    try {
      const res = await fetch('/api/g-outreach/opportunities/batch', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, opportunityIds: [id], rejectionReason: reason }),
      });
      if (!res.ok) throw new Error('Action failed');
      setAllOpportunities((prev) => prev.map((o) =>
        o.id === id ? { ...o, status: action === 'accept' ? 'accepted' : action === 'reject' ? 'rejected' : 'monitored', rejectionReason: reason ?? o.rejectionReason } : o
      ));
      const labels: Record<string, string> = { accept: 'accepted', reject: 'rejected', monitor: 'monitored' };
      toast.success(`Opportunity ${labels[action]}`);
    } catch { toast.error('Failed to update opportunity'); }
    finally {
      setActioningIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
      setIsActioning(false);
    }
  }, []);

  // Toggle expanded
  const toggleExpanded = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  // Load deal intelligence for an opportunity
  const loadDealIntel = useCallback(async (id: string) => {
    setDealIntelLoading((prev) => ({ ...prev, [id]: true }));
    try {
      // Simulate deal intel generation (in real app this calls an API)
      await new Promise(r => setTimeout(r, 1500));
      setDealIntels((prev) => ({
        ...prev,
        [id]: {
          id,
          confidence: 72 + Math.round(Math.random() * 20),
          buyerReadiness: 55 + Math.round(Math.random() * 35),
          dealVelocity: ['Fast (1-2 weeks)', 'Medium (2-4 weeks)', 'Steady (4-8 weeks)'][Math.floor(Math.random() * 3)],
          competitivePosition: 'Strong positioning — no incumbent vendor detected. Early engagement stage with high influence access.',
          keyInsights: [
            'Company recently raised Series B funding, signaling expansion budget',
            'CIO published article about digital transformation priorities',
            'No current vendor in this capability space detected',
            'Buying cycle typically 6-8 weeks based on industry benchmarks',
          ],
          riskFactors: [
            { risk: 'Budget timing — Q4 freeze possible', severity: 'medium', mitigation: 'Position as Q1 initiative with early-bird pricing' },
            { risk: 'Competitor evaluation in progress', severity: 'low', mitigation: 'Differentiate on implementation speed and support quality' },
          ],
          conversationStarters: [
            'I noticed your recent expansion plans — how is your team thinking about scaling operations?',
            'With your recent funding round, what capability gaps are you prioritizing?',
          ],
          pricingGuidance: 'Enterprise tier recommended based on company size. Volume discount available for multi-year commitment.',
          recommendedApproach: 'Lead with business impact metrics. CIO is data-driven — lead with ROI case studies from similar companies.',
          nextBestAction: 'Schedule a 30-min discovery call with CIO focusing on Q1 priorities and budget allocation.',
          generatedAt: new Date().toISOString(),
        },
      }));
    } catch { toast.error('Failed to generate deal intelligence'); }
    finally { setDealIntelLoading((prev) => ({ ...prev, [id]: false })); }
  }, []);

  return (
    <PageTransition>
      <div className="space-y-6 p-4 md:p-6 max-w-[1200px] mx-auto">
        {/* ─── Header ─── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="h-7 w-1.5 rounded-full" style={{ background: GOLD_GRAD, boxShadow: '0 0 12px rgba(212, 175, 55, 0.3)' }} />
              <h1 className="text-2xl font-bold text-foreground tracking-tight">Deal Intelligence Room</h1>
            </div>
            <p className="text-sm text-muted-foreground ml-5">AI-analyzed opportunities with full deal intelligence</p>
          </div>
          <Button onClick={fetchOpportunities}
            className="gap-2 shadow-md shadow-amber-500/20" style={{ background: GOLD_GRAD, color: '#060910' }}>
            <Sparkles className="w-4 h-4" /> Generate Deals
          </Button>
        </div>

        {/* ─── Stats ─── */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <StatCard label="Total Deals" value={counts.total} icon={BarChart3} color={GOLD} delay={0} />
          <StatCard label="Pending Review" value={counts.pending_review} icon={Clock} color="#d97706" delay={0.05} />
          <StatCard label="Accepted" value={counts.accepted} icon={CheckCircle2} color="#059669" delay={0.1} />
          <StatCard label="Monitored" value={counts.monitored} icon={Eye} color="#2563EB" delay={0.15} />
          <StatCard label="Avg Score" value={allOpportunities.length > 0 ? Math.round(allOpportunities.reduce((s, o) => s + o.opportunityScore, 0) / allOpportunities.length) : 0} icon={Gauge} color="#7c3aed" delay={0.2} />
        </div>

        {/* ─── Tab Bar ─── */}
        <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-xl border border-gray-200 w-fit">
          {tabs.map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium transition-all ${
                activeTab === t.key ? 'bg-white shadow-sm border border-gray-200' : 'text-muted-foreground hover:text-foreground border border-transparent'
              }`}>
              {t.label}
              {t.count > 0 && <span className="text-[11px] bg-gray-200 text-muted-foreground px-1.5 rounded-full tabular-nums">{t.count}</span>}
            </button>
          ))}
        </div>

        {/* ─── Content ─── */}
        {loading ? (
          <LoadingSkeleton />
        ) : filtered.length === 0 ? (
          <EmptyState icon={Brain} title="No opportunities yet"
            description="Generate opportunities to see AI-identified revenue chances here."
            action={<Button onClick={fetchOpportunities} variant="outline" className="gap-2 border-primary/30 text-primary hover:bg-primary/5">
              <Sparkles className="w-3.5 h-3.5" /> Generate Opportunities
            </Button>} />
        ) : (
          <div className="space-y-4">
            <AnimatePresence mode="popLayout">
              {filtered.map((opp) => (
                <motion.div key={opp.id} layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.3 }}>
                  <DealRoomCard
                    opportunity={opp}
                    expanded={expandedIds.has(opp.id)}
                    onToggle={() => toggleExpanded(opp.id)}
                    onAction={handleAction}
                    onCompanyClick={(cid) => setSelectedCompanyId(cid)}
                    isActioning={actioningIds.has(opp.id)}
                    dealIntel={dealIntels[opp.id] || null}
                    dealIntelLoading={!!dealIntelLoading[opp.id]}
                    onLoadIntel={() => loadDealIntel(opp.id)}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </PageTransition>
  );
}
