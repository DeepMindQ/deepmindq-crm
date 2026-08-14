'use client';

import { useState, useEffect } from 'react';
import { tokens } from '@/components/intelligence-os/design-tokens';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState, LoadingSkeleton } from '@/components/ui/screen-states';
import { Card, CardContent } from '@/components/ui/card';
import {
  Lightbulb,
  Check,
  X,
  Building2,
  TrendingUp,
  Target,
  ArrowUpRight,
  RefreshCw,
  Sparkles,
  Shield,
  Zap,
  BarChart3,
} from 'lucide-react';

/* ── Types ── */
type StrategyType = 'expansion' | 'retention' | 'penetration';
type StrategyStatus = 'suggested' | 'adopted' | 'dismissed';

interface Strategy {
  id: string;
  title: string;
  type: StrategyType;
  description: string;
  affectedAccounts: number;
  priority: 'high' | 'medium' | 'low';
  expectedImpact: string;
  status: StrategyStatus;
  reasoning: string;
  metrics: string[];
}

/* ── Mock data ── */
const INITIAL_STRATEGIES: Strategy[] = [
  {
    id: '1', title: 'Expand into FinTech Vertical', type: 'expansion',
    description: 'Leverage recent wins at TechVenture to target 15 similar FinTech companies showing buying signals. Create a dedicated vertical playbook and sequence.',
    affectedAccounts: 15, priority: 'high', expectedImpact: '+$3.2M pipeline', status: 'suggested',
    reasoning: 'Pattern analysis shows FinTech companies with Series B+ funding have 3.2x higher conversion rate when approached with vertical-specific messaging.',
    metrics: ['Pipeline generated', 'Conversion rate', 'Avg deal size'],
  },
  {
    id: '2', title: 'Proactive Churn Prevention', type: 'retention',
    description: 'Implement AI-driven early warning system for accounts showing declining engagement. Target 8 at-risk accounts with personalized retention plays.',
    affectedAccounts: 8, priority: 'high', expectedImpact: '-$1.8M at-risk ARR saved', status: 'adopted',
    reasoning: 'Usage data shows 8 enterprise accounts have dropped below 60% feature adoption in the last 30 days. Historical data suggests 40% of similar accounts churn within 90 days without intervention.',
    metrics: ['Retention rate', 'NPS score', 'Feature adoption'],
  },
  {
    id: '3', title: 'Deepen DataFlow Systems Relationship', type: 'penetration',
    description: 'Expand from current single-department usage to enterprise-wide deployment. Target 4 additional departments with tailored use cases.',
    affectedAccounts: 1, priority: 'medium', expectedImpact: '+$1.5M expansion ARR', status: 'suggested',
    reasoning: 'DataFlow Systems has achieved 92% user satisfaction in the data team. Cross-sell opportunity to sales ops and competitive intelligence teams based on their restructuring.',
    metrics: ['Expansion revenue', 'User seats', 'Departments active'],
  },
  {
    id: '4', title: 'Win-Back Dormant Accounts', type: 'retention',
    description: 'Re-engage 12 accounts that showed high intent 6+ months ago but went dark. Use new intelligence signals to trigger personalized re-engagement.',
    affectedAccounts: 12, priority: 'medium', expectedImpact: '+$2.1M recovered pipeline', status: 'suggested',
    reasoning: '12 previously engaged accounts have shown renewed signal activity (hiring, funding, leadership changes). The timing aligns well for re-engagement with updated messaging.',
    metrics: ['Re-engagement rate', 'Meetings booked', 'Pipeline recovered'],
  },
  {
    id: '5', title: 'Competitive Displacement Campaign', type: 'penetration',
    description: 'Target 6 accounts currently using TechGiant Inc where contract renewal is within 6 months. Create competitive displacement playbook.',
    affectedAccounts: 6, priority: 'high', expectedImpact: '+$4.0M pipeline', status: 'dismissed',
    reasoning: 'Intelligence shows TechGiant Inc customers report declining satisfaction scores. 6 accounts have contracts expiring in Q2-Q3, creating a window for displacement.',
    metrics: ['Displacement rate', 'Competitive wins', 'Time to close'],
  },
  {
    id: '6', title: 'Strategic Partnership Program', type: 'expansion',
    description: 'Establish referral partnerships with 3 complementary SaaS companies in the data and analytics space for mutual lead sharing.',
    affectedAccounts: 20, priority: 'low', expectedImpact: '+$1.8M partner-sourced pipeline', status: 'suggested',
    reasoning: 'Network analysis identifies 3 SaaS companies with overlapping ICP but non-competing products. Similar partnership programs have generated 2.3x ROI in the industry.',
    metrics: ['Partner-sourced leads', 'Conversion rate', 'Partner revenue share'],
  },
];

const TYPE_CONFIG: Record<StrategyType, { icon: typeof TrendingUp; label: string; color: string; bg: string }> = {
  expansion: { icon: ArrowUpRight, label: 'Expansion', color: tokens.domain.opportunity, bg: '#ECFDF5' },
  retention: { icon: Shield, label: 'Retention', color: tokens.domain.reasoning, bg: '#EDE9FE' },
  penetration: { icon: Zap, label: 'Penetration', color: tokens.accent.DEFAULT, bg: tokens.accent.subtle },
};

const PRIORITY_CONFIG: Record<string, { class: string }> = {
  high: { class: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300' },
  medium: { class: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300' },
  low: { class: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300' },
};

const STATUS_CONFIG: Record<StrategyStatus, { class: string; icon: typeof Check }> = {
  suggested: { class: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300', icon: Lightbulb },
  adopted: { class: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300', icon: Check },
  dismissed: { class: 'bg-gray-100 text-gray-700 dark:bg-gray-800/40 dark:text-gray-400', icon: X },
};

/* ── Component ── */
export default function AIStrategyScreen() {
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StrategyStatus | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<StrategyType | 'all'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => { setStrategies(INITIAL_STRATEGIES); setLoading(false); }, 600);
    return () => clearTimeout(t);
  }, []);

  const filtered = strategies.filter((s) => {
    const matchStatus = statusFilter === 'all' || s.status === statusFilter;
    const matchType = typeFilter === 'all' || s.type === typeFilter;
    return matchStatus && matchType;
  });

  const adoptStrategy = (id: string) => {
    setStrategies((prev) => prev.map((s) => s.id === id ? { ...s, status: 'adopted' as StrategyStatus } : s));
  };

  const dismissStrategy = (id: string) => {
    setStrategies((prev) => prev.map((s) => s.id === id ? { ...s, status: 'dismissed' as StrategyStatus } : s));
  };

  const resetStrategy = (id: string) => {
    setStrategies((prev) => prev.map((s) => s.id === id ? { ...s, status: 'suggested' as StrategyStatus } : s));
  };

  const summaryStats = {
    total: strategies.length,
    adopted: strategies.filter((s) => s.status === 'adopted').length,
    suggested: strategies.filter((s) => s.status === 'suggested').length,
    totalImpact: strategies.filter((s) => s.status === 'adopted' || s.status === 'suggested').length,
  };

  if (loading) return <LoadingSkeleton />;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: tokens.border.default }}>
        <div className="flex items-center gap-3">
          <Sparkles className="w-5 h-5" style={{ color: tokens.domain.reasoning }} />
          <div>
            <h1 className="text-lg font-semibold" style={{ color: tokens.text.primary }}>AI Strategy Recommendations</h1>
            <p className="text-xs" style={{ color: tokens.text.muted }}>AI-generated strategic recommendations to drive revenue growth</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex gap-3 text-xs">
            <span className="flex items-center gap-1 px-2 py-1 rounded" style={{ backgroundColor: tokens.surface.secondary, color: tokens.text.secondary }}>
              <Lightbulb className="w-3 h-3" style={{ color: tokens.accent.DEFAULT }} /> {summaryStats.suggested} suggested
            </span>
            <span className="flex items-center gap-1 px-2 py-1 rounded" style={{ backgroundColor: tokens.confidence.high.bg, color: tokens.confidence.high.value }}>
              <Check className="w-3 h-3" /> {summaryStats.adopted} adopted
            </span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 px-6 py-3 border-b" style={{ borderColor: tokens.borderFaint }}>
        <span className="text-xs font-medium" style={{ color: tokens.text.muted }}>Status:</span>
        {(['all', 'suggested', 'adopted', 'dismissed'] as const).map((s) => (
          <Button key={s} variant={statusFilter === s ? 'default' : 'ghost'} size="sm" className="h-7 text-xs capitalize" onClick={() => setStatusFilter(s)}>
            {s === 'all' ? 'All' : s}
          </Button>
        ))}
        <div className="w-px h-5" style={{ backgroundColor: tokens.border.default }} />
        <span className="text-xs font-medium" style={{ color: tokens.text.muted }}>Type:</span>
        {(['all', 'expansion', 'retention', 'penetration'] as const).map((t) => (
          <Button key={t} variant={typeFilter === t ? 'default' : 'ghost'} size="sm" className="h-7 text-xs capitalize" onClick={() => setTypeFilter(t)}>
            {t === 'all' ? 'All' : t}
          </Button>
        ))}
      </div>

      {/* Strategy Grid */}
      <div className="flex-1 overflow-auto">
        {filtered.length === 0 ? (
          <EmptyState icon="lightbulb" title="No strategies found" description="Try adjusting your filters" />
        ) : (
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((strategy) => {
              const typeCfg = TYPE_CONFIG[strategy.type];
              const prioCfg = PRIORITY_CONFIG[strategy.priority];
              const statusCfg = STATUS_CONFIG[strategy.status];
              const StatusIcon = statusCfg.icon;
              const isExpanded = expandedId === strategy.id;

              return (
                <Card
                  key={strategy.id}
                  className={`overflow-hidden transition-all ${strategy.status === 'dismissed' ? 'opacity-60' : ''}`}
                  style={{ borderColor: tokens.border.default }}
                >
                  <CardContent className="p-0">
                    {/* Card Header */}
                    <div className="px-5 pt-5 pb-3">
                      <div className="flex items-start justify-between mb-3">
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: typeCfg.bg, color: typeCfg.color }}>
                          <typeCfg.icon className="w-5 h-5" />
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Badge className={`${prioCfg.class} text-xs capitalize`}>{strategy.priority}</Badge>
                          <Badge className={`${statusCfg.class} text-xs flex items-center gap-1`}>
                            <StatusIcon className="w-3 h-3" /> {strategy.status}
                          </Badge>
                        </div>
                      </div>

                      <h3 className="text-sm font-semibold mb-1.5 cursor-pointer hover:underline" style={{ color: tokens.text.primary }} onClick={() => setExpandedId(isExpanded ? null : strategy.id)}>
                        {strategy.title}
                      </h3>
                      <p className="text-xs leading-relaxed line-clamp-2" style={{ color: tokens.text.muted }}>{strategy.description}</p>
                    </div>

                    {/* Metrics Row */}
                    <div className="px-5 py-3 border-t" style={{ borderColor: tokens.borderFaint }}>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <p className="text-xs" style={{ color: tokens.text.muted }}>Affected Accounts</p>
                          <div className="flex items-center gap-1 mt-0.5">
                            <Building2 className="w-3.5 h-3.5" style={{ color: tokens.text.muted }} />
                            <span className="text-sm font-semibold" style={{ color: tokens.text.primary }}>{strategy.affectedAccounts}</span>
                          </div>
                        </div>
                        <div>
                          <p className="text-xs" style={{ color: tokens.text.muted }}>Expected Impact</p>
                          <div className="flex items-center gap-1 mt-0.5">
                            <TrendingUp className="w-3.5 h-3.5" style={{ color: tokens.confidence.high.value }} />
                            <span className="text-sm font-semibold" style={{ color: tokens.confidence.high.value }}>{strategy.expectedImpact}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Expanded Details */}
                    {isExpanded && (
                      <div className="px-5 py-3 border-t" style={{ borderColor: tokens.border.default, backgroundColor: tokens.surface.secondary }}>
                        <p className="text-xs font-medium mb-1.5" style={{ color: tokens.text.secondary }}>AI Reasoning</p>
                        <p className="text-xs leading-relaxed mb-3" style={{ color: tokens.text.muted }}>{strategy.reasoning}</p>
                        <p className="text-xs font-medium mb-1.5" style={{ color: tokens.text.secondary }}>Key Metrics</p>
                        <div className="flex flex-wrap gap-1.5">
                          {strategy.metrics.map((m, i) => (
                            <Badge key={i} variant="outline" className="text-xs">{m}</Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="px-5 py-3 border-t flex items-center gap-2" style={{ borderColor: tokens.borderFaint }}>
                      {strategy.status === 'suggested' && (
                        <>
                          <Button size="sm" className="h-8 text-xs flex-1" onClick={() => adoptStrategy(strategy.id)}>
                            <Check className="w-3.5 h-3.5 mr-1" /> Adopt
                          </Button>
                          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => dismissStrategy(strategy.id)}>
                            <X className="w-3.5 h-3.5 mr-1" /> Dismiss
                          </Button>
                        </>
                      )}
                      {strategy.status !== 'suggested' && (
                        <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => resetStrategy(strategy.id)}>
                          <RefreshCw className="w-3.5 h-3.5 mr-1" /> Reset to Suggested
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" className="h-8 text-xs ml-auto" onClick={() => setExpandedId(isExpanded ? null : strategy.id)}>
                        {isExpanded ? 'Less' : 'More'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
