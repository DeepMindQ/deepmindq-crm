'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain, Target, Zap, TrendingUp, Shield, Database, Network, RefreshCw,
  Play, ChevronRight, BarChart3, Lightbulb, Trophy, ArrowRight,
  Search, Filter, Loader2, AlertTriangle, CheckCircle2, XCircle,
  BookOpen, FileText, Award, Layers, Sparkles, GitBranch, Activity,
  Users, Building2, ExternalLink, ChevronDown, ChevronUp,
  Eye, MessageSquare, Gauge, Cpu, Radar, LucideIcon,
} from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { PageTransition, AnimatedCard, SectionHeader, PulseDot } from '@/components/ui/animated-components';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

/* ═══════════════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════════════ */

interface KnowledgeNode {
  id: string;
  label: string;
  category: string;
  group: string;
  size: number;
  score: number;
  version: number;
}

interface KnowledgeEdge {
  source: string;
  target: string;
  type: 'parent' | 'service_line' | 'industry';
  strength: number;
}

interface KnowledgeGraphData {
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
  categories: Record<string, number>;
  serviceLines: Record<string, number>;
  totalAssets: number;
}

interface GraphStatus {
  totalCapabilities: number;
  capabilitiesByCategory: Record<string, number>;
  totalSignalMatches: number;
  totalOpportunities: number;
  opportunitiesByPriority: Record<string, number>;
}

interface CompanySignal {
  id: string;
  signalType: string;
  title: string;
  description: string | null;
  severity: string;
  source: string | null;
  sourceUrl: string | null;
  createdAt: string;
  confidence: number;
}

interface CapabilityMatch {
  capabilityId: string;
  capabilityTitle: string;
  capabilityCategory: string;
  matchScore: number;
  reason: string;
  businessProblem: string;
  expectedOutcome: string;
  salesAngle: string;
}

interface SignalMatchResult {
  success: boolean;
  companyId: string;
  signalId: string;
  matches: CapabilityMatch[];
  error: string | null;
}

interface WinProbabilityResult {
  success: boolean;
  probability: number;
  factors: {
    signalStrength: number;
    capabilityFit: number;
    evidenceStrength: number;
    timingScore: number;
    competitivePosition: number;
  };
  reasoning: string;
  recommendation: string;
  error: string | null;
}

interface FullPipelineResult {
  success: boolean;
  signalsMatched: number;
  opportunitiesGenerated: number;
  winProbability: number;
  error: string | null;
}

interface OpportunityRecommendation {
  id: string;
  opportunityTitle: string;
  opportunityScore: number;
  priority: string;
  confidence: number;
  salesAngle: string;
  createdAt: string;
}

/* ═══════════════════════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════════════════════ */

const CATEGORY_CONFIG: Record<string, { label: string; icon: LucideIcon; color: string; bg: string; border: string; badge: string }> = {
  service_line:        { label: 'Service Line',     icon: Layers,    color: 'text-blue-400',     bg: 'bg-blue-500/15',     border: 'border-blue-500/30',    badge: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
  solution:            { label: 'Solution',         icon: Zap,       color: 'text-violet-400',   bg: 'bg-violet-500/15',   border: 'border-violet-500/30',  badge: 'bg-violet-500/20 text-violet-300 border-violet-500/30' },
  case_study:          { label: 'Case Study',       icon: FileText,  color: 'text-emerald-400',  bg: 'bg-emerald-500/15',  border: 'border-emerald-500/30', badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
  proof_point:         { label: 'Proof Point',      icon: Award,     color: 'text-amber-400',    bg: 'bg-amber-500/15',    border: 'border-amber-500/30',   badge: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
  technology:          { label: 'Technology',       icon: Cpu,       color: 'text-cyan-400',     bg: 'bg-cyan-500/15',     border: 'border-cyan-500/30',    badge: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' },
  accelerator:         { label: 'Accelerator',      icon: Zap,       color: 'text-rose-400',     bg: 'bg-rose-500/15',     border: 'border-rose-500/30',    badge: 'bg-rose-500/20 text-rose-300 border-rose-500/30' },
  objection_response:  { label: 'Objection Response', icon: Shield,  color: 'text-orange-400',   bg: 'bg-orange-500/15',   border: 'border-orange-500/30',  badge: 'bg-orange-500/20 text-orange-300 border-orange-500/30' },
  ip_platform:         { label: 'IP Platform',      icon: Database,  color: 'text-teal-400',    bg: 'bg-teal-500/15',     border: 'border-teal-500/30',    badge: 'bg-teal-500/20 text-teal-300 border-teal-500/30' },
  whitepaper:          { label: 'Whitepaper',      icon: BookOpen,  color: 'text-indigo-400',   bg: 'bg-indigo-500/15',   border: 'border-indigo-500/30',  badge: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' },
  industry_expertise:   { label: 'Industry Expertise', icon: Building2, color: 'text-pink-400', bg: 'bg-pink-500/15',     border: 'border-pink-500/30',    badge: 'bg-pink-500/20 text-pink-300 border-pink-500/30' },
  certification:       { label: 'Certification',   icon: CheckCircle2, color: 'text-lime-400', bg: 'bg-lime-500/15',    border: 'border-lime-500/30',    badge: 'bg-lime-500/20 text-lime-300 border-lime-500/30' },
  delivery_capability: { label: 'Delivery',         icon: Target,    color: 'text-sky-400',      bg: 'bg-sky-500/15',      border: 'border-sky-500/30',     badge: 'bg-sky-500/20 text-sky-300 border-sky-500/30' },
  messaging:           { label: 'Messaging',        icon: MessageSquare, color: 'text-fuchsia-400', bg: 'bg-fuchsia-500/15', border: 'border-fuchsia-500/30', badge: 'bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/30' },
};

const DEFAULT_CATEGORY = { label: 'Asset', icon: FileText, color: 'text-slate-400', bg: 'bg-slate-500/15', border: 'border-slate-500/30', badge: 'bg-slate-500/20 text-slate-300 border-slate-500/30' };

const SEVERITY_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  critical: { label: 'Critical', color: 'text-red-400', bg: 'bg-red-500/20 border-red-500/30' },
  high:     { label: 'High',     color: 'text-orange-400', bg: 'bg-orange-500/20 border-orange-500/30' },
  medium:   { label: 'Medium',   color: 'text-amber-400', bg: 'bg-amber-500/20 border-amber-500/30' },
  low:      { label: 'Low',      color: 'text-slate-400', bg: 'bg-slate-500/20 border-slate-500/30' },
};

const SIGNAL_TYPE_ICONS: Record<string, LucideIcon> = {
  funding: TrendingUp,
  hiring: Users,
  leadership_change: Users,
  tech_change: Cpu,
  news: FileText,
  mention: MessageSquare,
  partnership: GitBranch,
  expansion: Building2,
};

/* ═══════════════════════════════════════════════════════════════════════
   HELPER COMPONENTS
   ═══════════════════════════════════════════════════════════════════════ */

function MatchScoreBar({ score, label, showLabel = true }: { score: number; label?: string; showLabel?: boolean }) {
  const pct = Math.round(score * 100);
  const barColor = pct > 60 ? 'bg-emerald-500' : pct > 30 ? 'bg-amber-500' : 'bg-slate-500';
  const textColor = pct > 60 ? 'text-emerald-400' : pct > 30 ? 'text-amber-400' : 'text-slate-400';

  return (
    <div className="space-y-1.5">
      {showLabel && label && (
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-400">{label}</span>
          <span className={cn('font-semibold', textColor)}>{pct}%</span>
        </div>
      )}
      <div className="h-2 w-full rounded-full bg-slate-700/50 overflow-hidden">
        <motion.div
          className={cn('h-full rounded-full', barColor)}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const config = SEVERITY_CONFIG[severity] || SEVERITY_CONFIG.medium;
  return (
    <Badge variant="outline" className={cn('text-[10px] font-semibold px-2 py-0.5 border', config.bg, config.color)}>
      {config.label}
    </Badge>
  );
}

function CategoryBadge({ category }: { category: string }) {
  const config = CATEGORY_CONFIG[category] || DEFAULT_CATEGORY;
  return (
    <Badge variant="outline" className={cn('text-[10px] font-medium px-2 py-0.5 border', config.badge)}>
      {config.label}
    </Badge>
  );
}

function CategoryIcon({ category, className }: { category: string; className?: string }) {
  const config = CATEGORY_CONFIG[category] || DEFAULT_CATEGORY;
  const Icon = config.icon;
  return <Icon className={cn('h-4 w-4', config.color, className)} />;
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  iconBg,
  iconColor,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  sub?: string;
  iconBg: string;
  iconColor: string;
}) {
  return (
    <Card className="bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700/50 rounded-xl">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">{label}</p>
            <p className="text-3xl font-bold text-white">{value}</p>
            {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
          </div>
          <div className={cn('p-2.5 rounded-xl', iconBg)}>
            <Icon className={cn('h-5 w-5', iconColor)} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl bg-slate-800/50" />
        ))}
      </div>
      <Skeleton className="h-64 rounded-xl bg-slate-800/50" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Skeleton className="h-80 rounded-xl bg-slate-800/50" />
        <Skeleton className="h-80 rounded-xl bg-slate-800/50" />
      </div>
    </div>
  );
}

function ErrorCard({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Card className="bg-slate-900/95 border border-red-500/30 rounded-xl">
      <CardContent className="p-6 flex items-start gap-4">
        <div className="p-2 rounded-lg bg-red-500/15 shrink-0">
          <AlertTriangle className="h-5 w-5 text-red-400" />
        </div>
        <div className="flex-1 space-y-2">
          <p className="text-sm font-medium text-red-300">Something went wrong</p>
          <p className="text-xs text-slate-400">{message}</p>
          {onRetry && (
            <Button variant="outline" size="sm" onClick={onRetry} className="mt-2 border-slate-700 text-slate-300 hover:bg-slate-800">
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Retry
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyState({ icon: Icon, title, description }: { icon: LucideIcon; title: string; description: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-16 px-8 text-center"
    >
      <div className="p-4 rounded-2xl bg-slate-800/50 border border-slate-700/50 mb-6">
        <Icon className="h-10 w-10 text-slate-500" />
      </div>
      <h3 className="text-base font-semibold text-white mb-2">{title}</h3>
      <p className="text-sm text-slate-400 max-w-sm">{description}</p>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   TAB 1: KNOWLEDGE GRAPH
   ═══════════════════════════════════════════════════════════════════════ */

function KnowledgeGraphTab() {
  const [graphData, setGraphData] = useState<KnowledgeGraphData | null>(null);
  const [graphStatus, setGraphStatus] = useState<GraphStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  const fetchGraphData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [graphRes, statusRes] = await Promise.all([
        fetch('/api/knowledge/graph'),
        fetch('/api/intelligence/capability-pipeline?action=status'),
      ]);
      if (!graphRes.ok || !statusRes.ok) throw new Error('Failed to fetch intelligence data');
      const graph = await graphRes.json();
      const status = await statusRes.json();
      setGraphData(graph);
      setGraphStatus(status);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchGraphData(); }, [fetchGraphData]);

  const toggleCategory = (cat: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
  };

  const filteredNodes = useMemo(() => {
    if (!graphData) return [];
    let nodes = graphData.nodes;
    if (activeCategory !== 'all') {
      nodes = nodes.filter(n => n.category === activeCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      nodes = nodes.filter(n => n.label.toLowerCase().includes(q) || n.category.toLowerCase().includes(q));
    }
    return nodes;
  }, [graphData, activeCategory, searchQuery]);

  const categoryKeys = graphData ? Object.keys(graphData.categories) : [];
  const totalMatches = graphStatus?.totalSignalMatches ?? 0;
  const totalOpps = graphStatus?.totalOpportunities ?? 0;

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorCard message={error} onRetry={fetchGraphData} />;
  if (!graphData) return <EmptyState icon={Database} title="No Knowledge Graph Data" description="The internal intelligence graph is empty. Ingest capabilities to populate it." />;

  return (
    <div className="space-y-6">
      {/* Category Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard icon={Database} label="Total Assets" value={graphData.totalAssets} sub={`${categoryKeys.length} categories`} iconBg="bg-emerald-500/15" iconColor="text-emerald-400" />
        <StatCard icon={Network} label="Knowledge Edges" value={graphData.edges.length} sub="Cross-references" iconBg="bg-blue-500/15" iconColor="text-blue-400" />
        <StatCard icon={Target} label="Signal Matches" value={totalMatches} sub="AI-processed" iconBg="bg-violet-500/15" iconColor="text-violet-400" />
        <StatCard icon={Trophy} label="Opportunities" value={totalOpps} sub="Generated" iconBg="bg-amber-500/15" iconColor="text-amber-400" />
      </div>

      {/* Category Distribution */}
      <Card className="bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700/50 rounded-xl">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
              <Layers className="h-4 w-4 text-emerald-400" />
              Knowledge Categories
            </CardTitle>
            <div className="relative w-48">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
              <Input
                placeholder="Search assets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-10 text-xs bg-slate-800/50 border-slate-700/50 pl-8 pr-3 text-slate-300 placeholder:text-slate-500 focus:border-emerald-500/50"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="flex flex-wrap gap-2 mb-4">
            <Badge
              variant="outline"
              className={cn('cursor-pointer text-xs border transition-colors', activeCategory === 'all' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' : 'bg-slate-800/50 text-slate-400 border-slate-700/50 hover:border-slate-600')}
              onClick={() => setActiveCategory('all')}
            >
              All ({graphData.totalAssets})
            </Badge>
            {categoryKeys.map(cat => {
              const config = CATEGORY_CONFIG[cat] || DEFAULT_CATEGORY;
              const count = graphData.categories[cat] || 0;
              return (
                <Badge
                  key={cat}
                  variant="outline"
                  className={cn('cursor-pointer text-xs border transition-colors', activeCategory === cat ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' : `${config.bg} ${config.color} ${config.border} hover:opacity-80`)}
                  onClick={() => setActiveCategory(cat)}
                >
                  {config.label} ({count})
                </Badge>
              );
            })}
          </div>

          {/* Service Line Distribution */}
          {graphData.serviceLines && Object.keys(graphData.serviceLines).length > 0 && (
            <div className="mb-4">
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Service Lines</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {Object.entries(graphData.serviceLines).map(([sl, count]) => (
                  <div key={sl} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800/40 border border-slate-700/30">
                    <GitBranch className="h-3.5 w-3.5 text-slate-500" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-slate-300 truncate">{sl}</p>
                      <p className="text-[10px] text-slate-500">{count as number} assets</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Separator className="bg-slate-700/30 my-3" />

          {/* Asset Nodes */}
          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1 custom-scrollbar">
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
              {filteredNodes.length} Asset{filteredNodes.length !== 1 ? 's' : ''}
            </p>
            {filteredNodes.length === 0 ? (
              <p className="text-xs text-slate-500 py-8 text-center">No assets match the current filter.</p>
            ) : (
              filteredNodes.map((node, idx) => {
                const config = CATEGORY_CONFIG[node.category] || DEFAULT_CATEGORY;
                return (
                  <motion.div
                    key={node.id}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.03 }}
                    className="flex items-start gap-3 px-3 py-2.5 rounded-lg bg-slate-800/30 border border-slate-700/20 hover:border-slate-700/50 transition-colors group"
                  >
                    <div className={cn('p-1.5 rounded-lg shrink-0 mt-0.5', config.bg)}>
                      <CategoryIcon category={node.category} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-xs font-medium text-slate-200 truncate">{node.label}</p>
                        <span className="text-[10px] text-slate-600">v{node.version}</span>
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <CategoryBadge category={node.category} />
                        {node.group && node.group !== node.category && (
                          <span className="text-[10px] text-slate-600">· {node.group}</span>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-semibold text-emerald-400">{node.score}</p>
                      <p className="text-[10px] text-slate-600">score</p>
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   TAB 2: AI MATCHING ENGINE (DEMO HERO)
   ═══════════════════════════════════════════════════════════════════════ */

function AIMatchingEngineTab({ companyId }: { companyId: string | null }) {
  const [signals, setSignals] = useState<CompanySignal[]>([]);
  const [matchResults, setMatchResults] = useState<Map<string, SignalMatchResult>>(new Map());
  const [winProbability, setWinProbability] = useState<WinProbabilityResult | null>(null);
  const [pipelineResult, setPipelineResult] = useState<FullPipelineResult | null>(null);
  const [loadingSignals, setLoadingSignals] = useState(false);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [loadingPipeline, setLoadingPipeline] = useState(false);
  const [loadingWinProb, setLoadingWinProb] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSignalId, setSelectedSignalId] = useState<string | null>(null);

  // Fetch company signals
  useEffect(() => {
    if (!companyId) { setSignals([]); return; }
    const fetchSignals = async () => {
      setLoadingSignals(true);
      setError(null);
      try {
        const res = await fetch(`/api/companies/${companyId}/signals`);
        if (!res.ok) throw new Error('Failed to fetch signals');
        const data = await res.json();
        setSignals(data.signals || []);
        if (data.signals?.length > 0) setSelectedSignalId(data.signals[0].id);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoadingSignals(false);
      }
    };
    fetchSignals();
  }, [companyId]);

  // Match selected signal
  const matchSignal = useCallback(async (signalId: string) => {
    if (!companyId || !signalId) return;
    setLoadingMatches(true);
    try {
      const res = await fetch('/api/intelligence/capability-pipeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'match-signal', companyId, signalId }),
      });
      if (!res.ok) throw new Error('Failed to match signal');
      const data: SignalMatchResult = await res.json();
      setMatchResults(prev => new Map(prev).set(signalId, data));

      // Auto-fetch win probability after match
      if (data.success && data.matches.length > 0) {
        const wpRes = await fetch('/api/intelligence/capability-pipeline', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'win-probability', companyId }),
        });
        if (wpRes.ok) {
          const wpData: WinProbabilityResult = await wpRes.json();
          setWinProbability(wpData);
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Match failed');
    } finally {
      setLoadingMatches(false);
    }
  }, [companyId]);

  // Run Full Pipeline
  const runFullPipeline = useCallback(async () => {
    if (!companyId) return;
    setLoadingPipeline(true);
    try {
      const res = await fetch('/api/intelligence/capability-pipeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'run-pipeline', companyId }),
      });
      if (!res.ok) throw new Error('Pipeline failed');
      const data: FullPipelineResult = await res.json();
      setPipelineResult(data);
      if (data.success) {
        toast.success(`Pipeline complete: ${data.signalsMatched} signals matched, ${data.opportunitiesGenerated} opportunities generated`);
        // Re-fetch signals to get updated data
        const sigRes = await fetch(`/api/companies/${companyId}/signals`);
        if (sigRes.ok) {
          const sigData = await sigRes.json();
          setSignals(sigData.signals || []);
        }
      } else {
        toast.error(data.error || 'Pipeline failed');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Pipeline failed');
    } finally {
      setLoadingPipeline(false);
    }
  }, [companyId]);

  const currentMatch = selectedSignalId ? matchResults.get(selectedSignalId) : null;
  const allMatches = Array.from(matchResults.values()).flatMap(r => r.matches || []);

  if (!companyId) {
    return (
      <EmptyState
        icon={Target}
        title="Select a Company to See AI Matching"
        description="Navigate to a company profile and click the Intelligence tab, or pass ?companyId=xxx in the URL to see the AI Matching Engine in action."
      />
    );
  }

  return (
    <div className="space-y-5">
      {/* Pipeline Status Banner */}
      {pipelineResult && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            'px-5 py-4 rounded-xl border',
            pipelineResult.success
              ? 'bg-emerald-500/10 border-emerald-500/30'
              : 'bg-red-500/10 border-red-500/30'
          )}
        >
          <div className="flex items-center gap-3">
            {pipelineResult.success ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-400" />
            ) : (
              <XCircle className="h-5 w-5 text-red-400" />
            )}
            <div className="flex-1">
              <p className={cn('text-sm font-semibold', pipelineResult.success ? 'text-emerald-300' : 'text-red-300')}>
                {pipelineResult.success ? 'Pipeline Executed Successfully' : 'Pipeline Failed'}
              </p>
              {pipelineResult.success && (
                <p className="text-xs text-slate-400 mt-0.5">
                  {pipelineResult.signalsMatched} signals matched · {pipelineResult.opportunitiesGenerated} opportunities generated · Win probability: {pipelineResult.winProbability}%
                </p>
              )}
              {pipelineResult.error && <p className="text-xs text-red-400 mt-0.5">{pipelineResult.error}</p>}
            </div>
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* LEFT PANEL: External Signals */}
        <Card className="lg:col-span-4 bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700/50 rounded-xl">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-blue-500/15">
                <Radar className="h-4 w-4 text-blue-400" />
              </div>
              <div>
                <CardTitle className="text-sm font-semibold text-white">External Signals</CardTitle>
                <CardDescription className="text-[10px] text-slate-500">Detected intelligence for this company</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {loadingSignals ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-lg bg-slate-800/50" />)}
              </div>
            ) : signals.length === 0 ? (
              <div className="text-center py-8">
                <Radar className="h-8 w-8 text-slate-600 mx-auto mb-3" />
                <p className="text-xs text-slate-500">No signals detected for this company yet.</p>
                <p className="text-[10px] text-slate-600 mt-1">Run intelligence enrichment to detect signals.</p>
              </div>
            ) : (
              <ScrollArea className="max-h-[450px]">
                <div className="space-y-2 pr-2">
                  {signals.map((signal, idx) => {
                    const SigIcon = SIGNAL_TYPE_ICONS[signal.signalType] || FileText;
                    const isMatched = matchResults.has(signal.id);
                    const isSelected = selectedSignalId === signal.id;

                    return (
                      <motion.button
                        key={signal.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        onClick={() => {
                          setSelectedSignalId(signal.id);
                          if (!isMatched) matchSignal(signal.id);
                        }}
                        className={cn(
                          'w-full text-left px-3 py-2.5 rounded-lg border transition-all duration-200 group',
                          isSelected
                            ? 'bg-emerald-500/10 border-emerald-500/40 shadow-lg shadow-emerald-500/5'
                            : isMatched
                            ? 'bg-slate-800/60 border-slate-700/50 hover:border-slate-600'
                            : 'bg-slate-800/30 border-slate-700/30 hover:border-slate-600'
                        )}
                      >
                        <div className="flex items-start gap-2.5">
                          <div className={cn('p-1.5 rounded-md shrink-0 mt-0.5', isSelected ? 'bg-emerald-500/20' : 'bg-slate-700/50')}>
                            <SigIcon className={cn('h-3.5 w-3.5', isSelected ? 'text-emerald-400' : 'text-slate-400')} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <p className={cn('text-xs font-medium truncate', isSelected ? 'text-emerald-300' : 'text-slate-200')}>{signal.title}</p>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <SeverityBadge severity={signal.severity} />
                              <span className="text-[10px] text-slate-600 capitalize">{signal.signalType.replace('_', ' ')}</span>
                              {isMatched && <CheckCircle2 className="h-3 w-3 text-emerald-500 ml-auto" />}
                            </div>
                          </div>
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        {/* CENTER/RIGHT PANEL: Matching Results + Win Probability */}
        <div className="lg:col-span-8 space-y-4">
          {/* Match Results */}
          <Card className="bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700/50 rounded-xl">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-emerald-500/15">
                    <Brain className="h-4 w-4 text-emerald-400" />
                  </div>
                  <div>
                    <CardTitle className="text-sm font-semibold text-white">Signal → Capability Matches</CardTitle>
                    <CardDescription className="text-[10px] text-slate-500">
                      {currentMatch ? `${currentMatch.matches.length} matching capabilities found` : 'Select a signal to match'}
                    </CardDescription>
                  </div>
                </div>
                <Badge variant="outline" className="bg-slate-800/50 text-slate-400 border-slate-700/50 text-[10px]">
                  {allMatches.length} total matches
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              {loadingMatches && !currentMatch ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-lg bg-slate-800/50" />)}
                </div>
              ) : currentMatch ? (
                <ScrollArea className="max-h-[320px]">
                  <div className="space-y-3 pr-2">
                    {currentMatch.matches.length === 0 ? (
                      <div className="text-center py-8">
                        <Target className="h-8 w-8 text-slate-600 mx-auto mb-2" />
                        <p className="text-xs text-slate-500">No matching capabilities found for this signal.</p>
                      </div>
                    ) : (
                      currentMatch.matches.map((match, idx) => {
                        const config = CATEGORY_CONFIG[match.capabilityCategory] || DEFAULT_CATEGORY;
                        return (
                          <motion.div
                            key={match.capabilityId}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.1 }}
                            className="px-4 py-3.5 rounded-xl bg-slate-800/40 border border-slate-700/30 hover:border-slate-600/50 transition-all"
                          >
                            <div className="flex items-start justify-between gap-3 mb-2">
                              <div className="flex items-center gap-2">
                                <div className={cn('p-1.5 rounded-md', config.bg)}>
                                  <CategoryIcon category={match.capabilityCategory} />
                                </div>
                                <div>
                                  <p className="text-xs font-semibold text-white">{match.capabilityTitle}</p>
                                  <CategoryBadge category={match.capabilityCategory} />
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                <p className={cn('text-lg font-bold', match.matchScore > 0.6 ? 'text-emerald-400' : match.matchScore > 0.3 ? 'text-amber-400' : 'text-slate-400')}>
                                  {Math.round(match.matchScore * 100)}%
                                </p>
                                <p className="text-[10px] text-slate-600">match score</p>
                              </div>
                            </div>
                            <MatchScoreBar score={match.matchScore} showLabel={false} />
                            {match.businessProblem && (
                              <div className="mt-2.5 space-y-1">
                                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Business Problem</p>
                                <p className="text-xs text-slate-400 leading-relaxed">{match.businessProblem}</p>
                              </div>
                            )}
                            {match.salesAngle && (
                              <div className="mt-2 flex items-start gap-2">
                                <ArrowRight className="h-3 w-3 text-emerald-400 mt-0.5 shrink-0" />
                                <p className="text-xs text-emerald-400/90 leading-relaxed">{match.salesAngle}</p>
                              </div>
                            )}
                          </motion.div>
                        );
                      })
                    )}
                  </div>
                </ScrollArea>
              ) : (
                <div className="text-center py-10">
                  <Brain className="h-10 w-10 text-slate-700 mx-auto mb-3" />
                  <p className="text-sm text-slate-500 font-medium">AI Matching Engine Ready</p>
                  <p className="text-xs text-slate-600 mt-1">Select a signal on the left to find matching internal capabilities</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Win Probability + Action */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Win Probability Card */}
            <Card className="bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700/50 rounded-xl">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-amber-500/15">
                    <Trophy className="h-4 w-4 text-amber-400" />
                  </div>
                  <div>
                    <CardTitle className="text-sm font-semibold text-white">Win Probability</CardTitle>
                    <CardDescription className="text-[10px] text-slate-500">Composite scoring model</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                {winProbability?.success ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-center py-2">
                      <div className="relative w-28 h-28">
                        <svg className="w-28 h-28 -rotate-90" viewBox="0 0 100 100">
                          <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth="8" className="text-slate-700/30" />
                          <motion.circle
                            cx="50" cy="50" r="40" fill="none"
                            stroke="currentColor"
                            strokeWidth="8"
                            strokeLinecap="round"
                            strokeDasharray={`${winProbability.probability * 2.51} 251`}
                            className={winProbability.probability > 60 ? 'text-emerald-500' : winProbability.probability > 30 ? 'text-amber-500' : 'text-slate-500'}
                            initial={{ strokeDasharray: '0 251' }}
                            animate={{ strokeDasharray: `${winProbability.probability * 2.51} 251` }}
                            transition={{ duration: 1.2, ease: 'easeOut' }}
                          />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <span className={cn('text-2xl font-bold', winProbability.probability > 60 ? 'text-emerald-400' : winProbability.probability > 30 ? 'text-amber-400' : 'text-slate-400')}>
                            {Math.round(winProbability.probability)}
                          </span>
                          <span className="text-[10px] text-slate-500">probability</span>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <MatchScoreBar score={winProbability.factors.signalStrength / 100} label="Signal Strength" />
                      <MatchScoreBar score={winProbability.factors.capabilityFit / 100} label="Capability Fit" />
                      <MatchScoreBar score={winProbability.factors.evidenceStrength / 100} label="Evidence Strength" />
                      <MatchScoreBar score={winProbability.factors.timingScore / 100} label="Timing Score" />
                      <MatchScoreBar score={winProbability.factors.competitivePosition / 100} label="Competitive Position" />
                    </div>
                    {winProbability.recommendation && (
                      <div className="mt-2 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                        <p className="text-[10px] font-semibold text-emerald-400 mb-1">RECOMMENDATION</p>
                        <p className="text-xs text-emerald-300/80 leading-relaxed">{winProbability.recommendation}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Trophy className="h-8 w-8 text-slate-700 mx-auto mb-2" />
                    <p className="text-xs text-slate-500">Match a signal to calculate win probability</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Run Pipeline Card */}
            <Card className="bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700/50 rounded-xl">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-violet-500/15">
                    <Zap className="h-4 w-4 text-violet-400" />
                  </div>
                  <div>
                    <CardTitle className="text-sm font-semibold text-white">Full Pipeline</CardTitle>
                    <CardDescription className="text-[10px] text-slate-500">Match all signals → Generate opportunities → Score</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="space-y-4">
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-2.5 text-xs">
                      <div className={cn('w-6 h-6 rounded-full flex items-center justify-center', signals.length > 0 ? 'bg-emerald-500/20' : 'bg-slate-700/50')}>
                        {signals.length > 0 ? <CheckCircle2 className="h-3 w-3 text-emerald-400" /> : <span className="text-[10px] text-slate-500">1</span>}
                      </div>
                      <span className={signals.length > 0 ? 'text-slate-300' : 'text-slate-500'}>Collect External Signals</span>
                      <span className="text-[10px] text-slate-600 ml-auto">{signals.length} detected</span>
                    </div>
                    <div className="flex items-center gap-2.5 text-xs">
                      <div className={cn('w-6 h-6 rounded-full flex items-center justify-center', allMatches.length > 0 ? 'bg-emerald-500/20' : 'bg-slate-700/50')}>
                        {allMatches.length > 0 ? <CheckCircle2 className="h-3 w-3 text-emerald-400" /> : <span className="text-[10px] text-slate-500">2</span>}
                      </div>
                      <span className={allMatches.length > 0 ? 'text-slate-300' : 'text-slate-500'}>Match Internal Capabilities</span>
                      <span className="text-[10px] text-slate-600 ml-auto">{allMatches.length} matched</span>
                    </div>
                    <div className="flex items-center gap-2.5 text-xs">
                      <div className={cn('w-6 h-6 rounded-full flex items-center justify-center', pipelineResult?.success ? 'bg-emerald-500/20' : 'bg-slate-700/50')}>
                        {pipelineResult?.success ? <CheckCircle2 className="h-3 w-3 text-emerald-400" /> : <span className="text-[10px] text-slate-500">3</span>}
                      </div>
                      <span className={pipelineResult?.success ? 'text-slate-300' : 'text-slate-500'}>Generate Opportunities</span>
                      <span className="text-[10px] text-slate-600 ml-auto">{pipelineResult?.opportunitiesGenerated ?? 0} generated</span>
                    </div>
                    <div className="flex items-center gap-2.5 text-xs">
                      <div className={cn('w-6 h-6 rounded-full flex items-center justify-center', winProbability?.success ? 'bg-emerald-500/20' : 'bg-slate-700/50')}>
                        {winProbability?.success ? <CheckCircle2 className="h-3 w-3 text-emerald-400" /> : <span className="text-[10px] text-slate-500">4</span>}
                      </div>
                      <span className={winProbability?.success ? 'text-slate-300' : 'text-slate-500'}>Calculate Win Probability</span>
                      <span className="text-[10px] text-slate-600 ml-auto">{winProbability ? `${Math.round(winProbability.probability)}%` : '—'}</span>
                    </div>
                  </div>
                  <Separator className="bg-slate-700/30" />
                  <Button
                    onClick={runFullPipeline}
                    disabled={loadingPipeline || signals.length === 0}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-6 py-3 rounded-lg transition-all duration-200 hover:shadow-lg hover:shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loadingPipeline ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Running Pipeline...
                      </>
                    ) : (
                      <>
                        <Play className="h-4 w-4 mr-2" /> Run Full Pipeline
                      </>
                    )}
                  </Button>
                  {signals.length === 0 && !loadingSignals && (
                    <p className="text-[10px] text-center text-slate-600">No signals detected — run intelligence enrichment first</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   TAB 3: ACCOUNT STRATEGY
   ═══════════════════════════════════════════════════════════════════════ */

function AccountStrategyTab({ companyId }: { companyId: string | null }) {
  const [signals, setSignals] = useState<CompanySignal[]>([]);
  const [opportunities, setOpportunities] = useState<OpportunityRecommendation[]>([]);
  const [winProb, setWinProb] = useState<WinProbabilityResult | null>(null);
  const [matches, setMatches] = useState<CapabilityMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStrategyData = useCallback(async () => {
    if (!companyId) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      // Fetch signals
      const sigRes = await fetch(`/api/companies/${companyId}/signals`);
      if (sigRes.ok) {
        const sigData = await sigRes.json();
        setSignals(sigData.signals || []);
      }

      // Fetch opportunities for this company
      const oppRes = await fetch(`/api/opportunities?companyId=${companyId}`);
      if (oppRes.ok) {
        const oppData = await oppRes.json();
        setOpportunities(Array.isArray(oppData) ? oppData : oppData.opportunities || []);
      }

      // Fetch win probability
      const wpRes = await fetch('/api/intelligence/capability-pipeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'win-probability', companyId }),
      });
      if (wpRes.ok) {
        const wpData = await wpRes.json();
        setWinProb(wpData);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => { fetchStrategyData(); }, [fetchStrategyData]);

  if (!companyId) {
    return (
      <EmptyState
        icon={BarChart3}
        title="No Company Selected"
        description="Select a company and run the Full Pipeline to generate an account strategy."
      />
    );
  }

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorCard message={error} onRetry={fetchStrategyData} />;

  const hasData = signals.length > 0 || opportunities.length > 0 || winProb?.success;

  return (
    <div className="space-y-5">
      {/* Strategy Header */}
      <Card className="bg-gradient-to-br from-slate-900 to-slate-800 border border-emerald-500/30 rounded-xl overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 via-violet-500 to-blue-500" />
        <CardContent className="p-6 pt-5">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-emerald-500/15 shrink-0">
              <BarChart3 className="h-6 w-6 text-emerald-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-base font-bold text-white mb-1">Generated Account Strategy</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                AI-generated strategy combining external signals with internal capabilities.
                Run the Full Pipeline in the AI Matching tab to refresh this strategy.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchStrategyData}
              className="border-slate-700 text-slate-300 hover:bg-slate-800 shrink-0"
            >
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {!hasData ? (
        <EmptyState
          icon={BarChart3}
          title="No Strategy Generated Yet"
          description="Run the Full Pipeline from the AI Matching Engine tab to generate a comprehensive account strategy."
        />
      ) : (
        <>
          {/* Capability Match Summary */}
          <Card className="bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700/50 rounded-xl">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-blue-500/15">
                  <Target className="h-4 w-4 text-blue-400" />
                </div>
                <CardTitle className="text-sm font-semibold text-white">Capability Match Summary</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                <div className="px-3 py-2.5 rounded-lg bg-slate-800/40 border border-slate-700/30 text-center">
                  <p className="text-xl font-bold text-white">{signals.length}</p>
                  <p className="text-[10px] text-slate-500">Signals</p>
                </div>
                <div className="px-3 py-2.5 rounded-lg bg-slate-800/40 border border-slate-700/30 text-center">
                  <p className="text-xl font-bold text-white">{matches.length}</p>
                  <p className="text-[10px] text-slate-500">Matches</p>
                </div>
                <div className="px-3 py-2.5 rounded-lg bg-slate-800/40 border border-slate-700/30 text-center">
                  <p className="text-xl font-bold text-white">{opportunities.length}</p>
                  <p className="text-[10px] text-slate-500">Opportunities</p>
                </div>
                <div className="px-3 py-2.5 rounded-lg bg-slate-800/40 border border-slate-700/30 text-center">
                  <p className={cn('text-xl font-bold', winProb?.success && winProb.probability > 60 ? 'text-emerald-400' : winProb?.success ? 'text-amber-400' : 'text-white')}>
                    {winProb?.success ? `${Math.round(winProb.probability)}%` : '—'}
                  </p>
                  <p className="text-[10px] text-slate-500">Win Prob.</p>
                </div>
              </div>

              {winProb?.success && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Factor Breakdown</p>
                    <MatchScoreBar score={winProb.factors.signalStrength / 100} label="Signal Strength" />
                    <MatchScoreBar score={winProb.factors.capabilityFit / 100} label="Capability Fit" />
                    <MatchScoreBar score={winProb.factors.evidenceStrength / 100} label="Evidence Strength" />
                    <MatchScoreBar score={winProb.factors.timingScore / 100} label="Timing" />
                    <MatchScoreBar score={winProb.factors.competitivePosition / 100} label="Competitive Pos." />
                  </div>
                  <div className="space-y-2">
                    <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">AI Reasoning</p>
                    <div className="px-3 py-2.5 rounded-lg bg-slate-800/50 border border-slate-700/30">
                      <p className="text-xs text-slate-400 leading-relaxed">{winProb.reasoning}</p>
                    </div>
                    {winProb.recommendation && (
                      <div className="px-3 py-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                        <p className="text-[10px] font-semibold text-emerald-400 mb-1">RECOMMENDATION</p>
                        <p className="text-xs text-emerald-300/80 leading-relaxed">{winProb.recommendation}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Signals Detected */}
          <Card className="bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700/50 rounded-xl">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-blue-500/15">
                  <Activity className="h-4 w-4 text-blue-400" />
                </div>
                <CardTitle className="text-sm font-semibold text-white">Detected Signals</CardTitle>
                <Badge variant="outline" className="ml-auto bg-slate-800/50 text-slate-400 border-slate-700/50 text-[10px]">{signals.length}</Badge>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              {signals.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-4">No signals detected.</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1 custom-scrollbar">
                  {signals.map((sig) => {
                    const SigIcon = SIGNAL_TYPE_ICONS[sig.signalType] || FileText;
                    return (
                      <div key={sig.id} className="flex items-start gap-2.5 px-3 py-2 rounded-lg bg-slate-800/30 border border-slate-700/20">
                        <div className="p-1.5 rounded-md bg-slate-700/50 shrink-0 mt-0.5">
                          <SigIcon className="h-3.5 w-3.5 text-slate-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-slate-200">{sig.title}</p>
                          {sig.description && <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-2">{sig.description}</p>}
                        </div>
                        <SeverityBadge severity={sig.severity} />
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Generated Opportunities */}
          <Card className="bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700/50 rounded-xl">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-violet-500/15">
                  <Lightbulb className="h-4 w-4 text-violet-400" />
                </div>
                <CardTitle className="text-sm font-semibold text-white">Generated Opportunities</CardTitle>
                <Badge variant="outline" className="ml-auto bg-slate-800/50 text-slate-400 border-slate-700/50 text-[10px]">{opportunities.length}</Badge>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              {opportunities.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-4">No opportunities generated. Run the Full Pipeline first.</p>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1 custom-scrollbar">
                  {opportunities.map((opp) => (
                    <div key={opp.id} className="flex items-start gap-2.5 px-3 py-2.5 rounded-lg bg-slate-800/30 border border-slate-700/20">
                      <div className={cn(
                        'p-1.5 rounded-md shrink-0 mt-0.5',
                        opp.priority === 'high' ? 'bg-emerald-500/20' : opp.priority === 'medium' ? 'bg-amber-500/20' : 'bg-slate-700/50'
                      )}>
                        <Lightbulb className={cn(
                          'h-3.5 w-3.5',
                          opp.priority === 'high' ? 'text-emerald-400' : opp.priority === 'medium' ? 'text-amber-400' : 'text-slate-400'
                        )} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-slate-200">{opp.opportunityTitle}</p>
                        {opp.salesAngle && <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-2">{opp.salesAngle}</p>}
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className={cn('text-[9px] px-1.5 py-0 border', opp.priority === 'high' ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' : opp.priority === 'medium' ? 'bg-amber-500/15 text-amber-300 border-amber-500/30' : 'bg-slate-700/50 text-slate-400 border-slate-600')}>
                            {opp.priority || 'medium'}
                          </Badge>
                          <span className="text-[10px] text-slate-600">Score: {Math.round(opp.opportunityScore || 0)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Conversation Strategy */}
          <Card className="bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700/50 rounded-xl">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-emerald-500/15">
                  <MessageSquare className="h-4 w-4 text-emerald-400" />
                </div>
                <CardTitle className="text-sm font-semibold text-white">Conversation Strategy</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="space-y-3">
                <div className="px-4 py-3 rounded-lg bg-slate-800/40 border border-slate-700/30">
                  <div className="flex items-center gap-2 mb-2">
                    <ChevronRight className="h-3.5 w-3.5 text-emerald-400" />
                    <p className="text-xs font-semibold text-emerald-300">Opening Angle</p>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    {winProb?.recommendation || 'Reference the strongest signal detected and position our matching capability as the solution. Lead with the specific business problem we solve.'}
                  </p>
                </div>
                <div className="px-4 py-3 rounded-lg bg-slate-800/40 border border-slate-700/30">
                  <div className="flex items-center gap-2 mb-2">
                    <ChevronRight className="h-3.5 w-3.5 text-blue-400" />
                    <p className="text-xs font-semibold text-blue-300">Key Differentiator</p>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Lead with relevant case studies and proof points from our knowledge base. Our evidence-backed approach differentiates us from competitors who rely on generic pitches.
                  </p>
                </div>
                <div className="px-4 py-3 rounded-lg bg-slate-800/40 border border-slate-700/30">
                  <div className="flex items-center gap-2 mb-2">
                    <ChevronRight className="h-3.5 w-3.5 text-violet-400" />
                    <p className="text-xs font-semibold text-violet-300">Objection Handling</p>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Anticipate budget and timing objections. Counter with ROI data from similar implementations and offer a phased approach to reduce perceived risk.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Executive Brief */}
          <Card className="bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700/50 rounded-xl">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-amber-500/15">
                  <Sparkles className="h-4 w-4 text-amber-400" />
                </div>
                <CardTitle className="text-sm font-semibold text-white">Executive Brief</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="px-4 py-4 rounded-lg bg-gradient-to-br from-slate-800/60 to-slate-800/30 border border-slate-700/30">
                <p className="text-xs text-slate-300 leading-relaxed">
                  {winProb?.reasoning || 'Run the Full Pipeline to generate an AI-powered executive brief. The brief combines external signal analysis with internal capability matching to produce a comprehensive account strategy.'}
                </p>
                <div className="flex items-center gap-2 mt-3">
                  <Gauge className="h-3.5 w-3.5 text-slate-500" />
                  <span className="text-[10px] text-slate-600">AI-generated · {new Date().toLocaleDateString()}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   MAIN SCREEN COMPONENT
   ═══════════════════════════════════════════════════════════════════════ */

export default function InternalIntelligenceScreen() {
  const searchParams = useSearchParams();
  const companyId = searchParams.get('companyId');
  const [activeTab, setActiveTab] = useState('knowledge-graph');
  const [totalAssets, setTotalAssets] = useState(0);
  const [capabilityMatches, setCapabilityMatches] = useState(0);
  const [loadingStats, setLoadingStats] = useState(true);

  // Fetch overview stats
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [graphRes, statusRes] = await Promise.all([
          fetch('/api/knowledge/graph'),
          fetch('/api/intelligence/capability-pipeline?action=status'),
        ]);
        if (graphRes.ok) {
          const graph = await graphRes.json();
          setTotalAssets(graph.totalAssets || 0);
        }
        if (statusRes.ok) {
          const status = await statusRes.json();
          setCapabilityMatches(status.totalSignalMatches || 0);
        }
      } catch {
        // Silent fail for stats
      } finally {
        setLoadingStats(false);
      }
    };
    fetchStats();
  }, []);

  return (
    <PageTransition>
      <div className="space-y-6">
        {/* ── HEADER ── */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 border border-emerald-500/30 shrink-0">
              <Brain className="h-7 w-7 text-emerald-400" />
            </div>
            <div className="flex-1">
              <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-3 flex-wrap">
                Internal Intelligence
                <span className="text-base sm:text-lg font-medium text-emerald-400">— AI Matching Engine</span>
              </h1>
              <p className="text-sm text-slate-400 mt-1 max-w-2xl">
                Dual Intelligence System: <span className="text-blue-400">External Signals</span> × <span className="text-emerald-400">Internal Capabilities</span> → <span className="text-amber-400">Account Strategy</span>
              </p>
            </div>
            {companyId && (
              <Badge variant="outline" className="bg-slate-800/50 text-slate-300 border-slate-700/50 text-xs shrink-0">
                Company ID: {companyId.slice(0, 8)}...
              </Badge>
            )}
          </div>

          {/* Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="px-5 py-4 rounded-xl bg-gradient-to-r from-emerald-500/10 to-emerald-500/5 border border-emerald-500/20"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-semibold text-emerald-400/80 uppercase tracking-wider">Internal Knowledge Assets</p>
                  <p className="text-3xl font-bold text-white mt-1">
                    {loadingStats ? (
                      <Skeleton className="h-9 w-16 bg-slate-700/50 inline-block" />
                    ) : totalAssets}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-emerald-500/15">
                  <Database className="h-6 w-6 text-emerald-400" />
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="px-5 py-4 rounded-xl bg-gradient-to-r from-blue-500/10 to-violet-500/5 border border-blue-500/20"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-semibold text-blue-400/80 uppercase tracking-wider">Capability Matches</p>
                  <p className="text-3xl font-bold text-white mt-1">
                    {loadingStats ? (
                      <Skeleton className="h-9 w-16 bg-slate-700/50 inline-block" />
                    ) : capabilityMatches}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-blue-500/15">
                  <Target className="h-6 w-6 text-blue-400" />
                </div>
              </div>
            </motion.div>
          </div>

          {/* Intelligence Flow Visualization */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="flex items-center gap-2 px-5 py-3 rounded-xl bg-slate-900/60 border border-slate-700/30 overflow-x-auto"
          >
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-500/15 border border-blue-500/25 shrink-0">
              <Radar className="h-3.5 w-3.5 text-blue-400" />
              <span className="text-xs font-medium text-blue-300">External Signals</span>
            </div>
            <ArrowRight className="h-4 w-4 text-slate-600 shrink-0" />
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/25 shrink-0">
              <Brain className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-xs font-medium text-emerald-300">Internal Capabilities</span>
            </div>
            <ArrowRight className="h-4 w-4 text-slate-600 shrink-0" />
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/25 shrink-0">
              <Zap className="h-3.5 w-3.5 text-amber-400" />
              <span className="text-xs font-medium text-amber-300">AI Matching</span>
            </div>
            <ArrowRight className="h-4 w-4 text-slate-600 shrink-0" />
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-violet-500/15 border border-violet-500/25 shrink-0">
              <Trophy className="h-3.5 w-3.5 text-violet-400" />
              <span className="text-xs font-medium text-violet-300">Account Strategy</span>
            </div>
          </motion.div>
        </motion.div>

        {/* ── TABS ── */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="bg-slate-800/50 border border-slate-700/50 p-1 rounded-xl h-auto">
            <TabsTrigger
              value="knowledge-graph"
              className="px-4 py-2 text-xs font-medium rounded-lg data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-300 data-[state=active]:shadow-sm transition-all"
            >
              <Network className="h-3.5 w-3.5 mr-1.5" />
              Knowledge Graph
            </TabsTrigger>
            <TabsTrigger
              value="ai-matching"
              className="px-4 py-2 text-xs font-medium rounded-lg data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-300 data-[state=active]:shadow-sm transition-all"
            >
              <Brain className="h-3.5 w-3.5 mr-1.5" />
              AI Matching Engine
              {companyId && <span className="ml-1.5 flex"><PulseDot color="var(--dmq-emerald)" /></span>}
            </TabsTrigger>
            <TabsTrigger
              value="account-strategy"
              className="px-4 py-2 text-xs font-medium rounded-lg data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-300 data-[state=active]:shadow-sm transition-all"
            >
              <BarChart3 className="h-3.5 w-3.5 mr-1.5" />
              Account Strategy
            </TabsTrigger>
          </TabsList>

          <TabsContent value="knowledge-graph" className="mt-0">
            <KnowledgeGraphTab />
          </TabsContent>

          <TabsContent value="ai-matching" className="mt-0">
            <AIMatchingEngineTab companyId={companyId} />
          </TabsContent>

          <TabsContent value="account-strategy" className="mt-0">
            <AccountStrategyTab companyId={companyId} />
          </TabsContent>
        </Tabs>
      </div>

      {/* Custom scrollbar styles */}
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: var(--dmq-slate-thumb); border-radius: 9999px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: var(--dmq-slate-thumb-hover); }
      `}</style>
    </PageTransition>
  );
}
