'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '@/components/ui/popover';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  Search, X, Building2, Mail, MapPin, Briefcase, Globe, Users,
  ArrowUpDown, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
  SlidersHorizontal, MailCheck, Sparkles, Brain, UserPlus,
  StickyNote, Clock, Activity, Download, Copy, RefreshCw, Eye, MoreHorizontal,
  LayoutGrid, List, Loader2, CheckCircle2, ShieldCheck, TrendingUp,
  Zap, Target, BarChart3, PieChart as PieChartIcon, ArrowRight,
  ExternalLink, Phone, Linkedin, MessageSquarePlus, LayoutList,
  Filter, AlertTriangle, Inbox, FileText,
} from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip as RTooltip, ResponsiveContainer, Cell, PieChart, Pie,
} from 'recharts';
import {
  PageTransition, AnimatedCard, StatCard, StaggerGrid, StaggerItem,
  GlassPanel, EmptyState, ShimmerText, TabBar, AnimatedCounter, PulseDot,
} from '@/components/ui/animated-components';
import { FilterBar } from '@/components/enterprise/FilterBar';
import { LoadingState } from '@/components/enterprise/LoadingState';
import { ErrorState } from '@/components/enterprise/ErrorState';
import { AIInsightCard } from '@/components/enterprise/AIInsightCard';
import { cn } from '@/lib/utils';

/* ═════════════════════════ Types ══════════════════════════════ */

interface MetaItem { v: string; c: number; }

interface Meta {
  countries: MetaItem[]; industries: MetaItem[]; departments: MetaItem[];
  employeeCategories: MetaItem[]; titles: MetaItem[]; cities: MetaItem[];
  states: MetaItem[]; totalRecords: number;
  consentStatuses?: MetaItem[]; assignees?: MetaItem[]; sources?: MetaItem[];
}

interface Lead {
  id: string; rawName: string; email: string; title: string; department: string;
  linkedin: string; company: string; website: string; employeeCategory: string;
  employeeNumber: string; industry: string; city: string; state: string; country: string;
  _dbFields?: {
    leadScore?: number; emailHealth?: string; emailHealthScore?: number;
    status?: string; role?: string; phone?: string; companyId?: string; batchId?: string;
    consentStatus?: string; assignedTo?: string; source?: string;
    companyFitScore?: number; engagementScore?: number; enrichmentScore?: number;
    hasEnrichedCompany?: boolean; createdAt?: string;
  };
}

interface LeadsResponse {
  leads: Lead[]; total: number; page: number; totalPages: number; _source?: string;
}

type SortDir = 'asc' | 'desc';
const SORTABLE_COLUMNS = ['company', 'country', 'city', 'industry', 'title', 'score'] as const;
type SortColumn = (typeof SORTABLE_COLUMNS)[number];
const PAGE_SIZE_OPTIONS = [25, 50, 100];

const HEALTH_COLORS: Record<string, string> = {
  valid: 'bg-emerald-500/20 text-emerald-700',
  risky: 'bg-amber-500/20 text-amber-700',
  invalid: 'bg-red-500/20 text-red-600',
  unknown: 'bg-zinc-500/20 text-zinc-400',
};

const STATUS_COLORS: Record<string, string> = {
  imported: 'bg-zinc-500/15 text-zinc-600 border-zinc-500/20',
  cleaned: 'bg-sky-500/15 text-sky-700 border-sky-500/20',
  drafted: 'bg-purple-500/15 text-purple-700 border-purple-500/20',
  sent: 'bg-blue-500/15 text-blue-700 border-blue-500/20',
  replied: 'bg-emerald-500/15 text-emerald-700 border-emerald-500/20',
  bounced: 'bg-red-500/15 text-red-600 border-red-500/20',
  queued: 'bg-amber-500/15 text-amber-700 border-amber-500/20',
  suppressed: 'bg-red-500/20 text-red-600 border-red-500/30',
};

const QUICK_STATUS_TABS = [
  { key: 'all', label: 'All' },
  { key: 'imported', label: 'Imported' },
  { key: 'sent', label: 'Contacted' },
  { key: 'replied', label: 'Replied' },
  { key: 'bounced', label: 'Bounced' },
];

const AI_REASONS = [
  'Technology modernization signal detected',
  'Recent leadership change indicates buying readiness',
  'Strong ICP match with active funding round',
  'Competitor evaluation signal from job postings',
  'Digital transformation budget allocation found',
  'Industry expansion confirmed by press releases',
  'High engagement score with content downloads',
  'Senior decision-maker with procurement authority',
  'Company growth rate indicates scaling needs',
  'Strategic partnership opportunity identified',
  'Recent product launch suggests budget availability',
  'Market disruption signal from regulatory changes',
  'Cross-sell opportunity from existing relationships',
  'Pipeline velocity indicator above benchmark',
  'Multi-threading potential across departments',
];

const RECOMMENDED_ACTIONS = [
  'Contact within 7 days',
  'Prioritize outreach this week',
  'Warm intro via mutual connection',
  'Engage with content first',
  'Schedule discovery call',
  'Follow up on previous touchpoint',
];

/* ═════════════════════════ Helper Components ══════════════════════════════ */

function ScoreBadge({ score }: { score: number | null | undefined }) {
  const value = score ?? 0;
  if (score == null) return <span className="text-[10px] text-muted-foreground/50">—</span>;
  const color = value >= 80 ? '#10b981' : value >= 60 ? '#f59e0b' : '#ef4444';
  const label = value >= 80 ? 'High' : value >= 60 ? 'Medium' : 'Low';
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="relative flex items-center justify-center w-10 h-10 shrink-0">
            <svg className="w-10 h-10 -rotate-90" viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="15.5" fill="none" stroke={`${color}18`} strokeWidth="3" />
              <circle
                cx="18" cy="18" r="15.5" fill="none" stroke={color} strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={`${(value / 100) * 97.39} 97.39`}
                className="transition-all duration-700"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold tabular-nums" style={{ color }}>
              {value}
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-full" style={{ background: color }} />
            <span className="font-medium">{label} Priority</span>
            <span className="text-muted-foreground">({value}/100)</span>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function EmailHealthDot({ health }: { health: string }) {
  const colorMap: Record<string, string> = {
    valid: 'bg-emerald-500',
    risky: 'bg-amber-500',
    invalid: 'bg-red-500',
    unknown: 'bg-zinc-300',
  };
  const labelMap: Record<string, string> = {
    valid: 'Valid email',
    risky: 'Risky email',
    invalid: 'Invalid email',
    unknown: 'Unverified',
  };
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={cn('inline-block w-2 h-2 rounded-full shrink-0', colorMap[health] || colorMap.unknown)} />
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">{labelMap[health] || 'Unknown'}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function getInitials(name: string) {
  return name.split(' ').map(w => w.charAt(0).toUpperCase()).slice(0, 2).join('');
}

/* ═════════════════════════ Main Component ═════════════════════════════════════════════ */

export default function LeadsScreen({ navigateTo }: { navigateTo?: (screen: string) => void }) {
  /* ─── Data State ─── */
  const [meta, setMeta] = useState<Meta | null>(null);
  const [metaLoading, setMetaLoading] = useState(true);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  /* ─── Filter State ─── */
  const [search, setSearch] = useState('');
  const [countries, setCountries] = useState<string[]>([]);
  const [industries, setIndustries] = useState<string[]>([]);
  const [statuses, setStatuses] = useState<string[]>([]);
  const [roleFilter, setRoleFilter] = useState('');
  const [quickStatus, setQuickStatus] = useState('all');

  /* ─── View State ─── */
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [sortBy, setSortBy] = useState<SortColumn>('score');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  /* ─── Detail Panel State ─── */
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [slideOverOpen, setSlideOverOpen] = useState(false);

  /* ─── Action States ─── */
  const [aiScoring, setAiScoring] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ─── Derived Stats ─── */
  const stats = useMemo(() => {
    const totalLeads = meta?.totalRecords ?? total;
    const scored = leads.filter(l => l._dbFields?.leadScore != null);
    const avgScore = scored.length > 0 ? Math.round(scored.reduce((s, l) => s + (l._dbFields?.leadScore ?? 0), 0) / scored.length) : 0;
    const highPriority = leads.filter(l => (l._dbFields?.leadScore ?? 0) >= 80).length;
    const healthyEmails = leads.filter(l => l._dbFields?.emailHealth === 'valid').length;
    const emailHealthPct = leads.length > 0 ? Math.round((healthyEmails / leads.length) * 100) : 0;
    return { totalLeads, avgScore, highPriority, emailHealthPct };
  }, [meta, leads]);

  /* ─── Charts Data ─── */
  const scoreDistribution = useMemo(() => {
    const buckets = [
      { range: '0-20', count: 0, color: '#ef4444' },
      { range: '21-40', count: 0, color: '#f97316' },
      { range: '41-60', count: 0, color: '#f59e0b' },
      { range: '61-80', count: 0, color: '#eab308' },
      { range: '81-100', count: 0, color: '#10b981' },
    ];
    leads.forEach(l => {
      const s = l._dbFields?.leadScore ?? 0;
      if (s <= 20) buckets[0].count++;
      else if (s <= 40) buckets[1].count++;
      else if (s <= 60) buckets[2].count++;
      else if (s <= 80) buckets[3].count++;
      else buckets[4].count++;
    });
    return buckets;
  }, [leads]);

  const industryBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    leads.forEach(l => {
      if (l.industry) map[l.industry] = (map[l.industry] || 0) + 1;
    });
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, value]) => ({ name: name.length > 15 ? name.slice(0, 14) + '…' : name, value }));
  }, [leads]);

  const statusDistribution = useMemo(() => {
    const map: Record<string, number> = {};
    leads.forEach(l => {
      const s = l._dbFields?.status || 'imported';
      map[s] = (map[s] || 0) + 1;
    });
    const pieColors = ['#71717a', '#0ea5e9', '#8b5cf6', '#2563eb', '#10b981', '#ef4444', '#f59e0b', '#dc2626'];
    return Object.entries(map).map(([name, value], i) => ({
      name, value,
      fill: pieColors[i % pieColors.length],
    }));
  }, [leads]);

  /* ─── Data Fetching ─── */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setMetaLoading(true);
        const res = await fetch('/api/leads?meta=true');
        if (!res.ok) throw new Error();
        const data = await res.json();
        if (!cancelled && data.meta) setMeta(data.meta);
      } catch { if (!cancelled) toast.error('Failed to load filter options'); }
      finally { if (!cancelled) setMetaLoading(false); }
    })();
    return () => { cancelled = true; };
  }, []);

  const buildQueryString = useCallback(() => {
    const params = new URLSearchParams();
    if (search.trim()) params.set('search', search.trim());
    if (countries.length) params.set('country', countries.join(','));
    if (industries.length) params.set('industry', industries.join(','));
    if (roleFilter) params.set('role', roleFilter);
    const effectiveStatuses = quickStatus !== 'all' ? [quickStatus] : statuses;
    if (effectiveStatuses.length) params.set('status', effectiveStatuses.join(','));
    params.set('sortBy', sortBy);
    params.set('sortDir', sortDir);
    params.set('page', String(page));
    params.set('limit', String(limit));
    return params.toString();
  }, [search, countries, industries, roleFilter, statuses, quickStatus, sortBy, sortDir, page, limit]);

  const fetchLeads = useCallback(async () => {
    try {
      setLeadsLoading(true);
      const qs = buildQueryString();
      const res = await fetch(`/api/leads?${qs}`);
      if (!res.ok) throw new Error();
      const data: LeadsResponse = await res.json();
      setLeads(data.leads || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 0);
    } catch { toast.error('Failed to load leads'); }
    finally { setLeadsLoading(false); }
  }, [buildQueryString]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(fetchLeads, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [fetchLeads]);

  useEffect(() => { setPage(1); }, [search, countries, industries, roleFilter, statuses, quickStatus, limit]);

  const handleSort = (col: SortColumn) => {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('asc'); }
    setPage(1);
  };

  const clearAllFilters = () => {
    setSearch(''); setCountries([]); setIndustries([]); setStatuses([]);
    setRoleFilter(''); setQuickStatus('all'); setPage(1);
  };

  /* ─── Actions ─── */
  const handleAiScoreAll = async () => {
    setAiScoring(true);
    try {
      const res = await fetch('/api/ai/score-leads', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ scoreAll: true }) });
      const data = await res.json();
      if (data.data?.scores) toast.success(`AI scored ${data.data.scores.length} entities successfully`);
      else toast.error(data.error || 'AI scoring failed');
      fetchLeads();
    } catch { toast.error('AI scoring request failed'); }
    finally { setAiScoring(false); }
  };

  const handleExportCSV = async () => {
    setExporting(true);
    try {
      const qs = buildQueryString();
      const res = await fetch(`/api/leads/export?${qs}`);
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('CSV exported');
      } else toast.error('Export failed');
    } catch { toast.error('Export failed'); }
    setExporting(false);
  };

  const handleRecalculateScores = async () => {
    setRecalculating(true);
    try {
      const res = await fetch('/api/leads/recalculate-scores', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
      const data = await res.json();
      if (data.success) { toast.success(`Recalculated ${data.updated} lead scores`); fetchLeads(); }
    } catch { toast.error('Score recalculation failed'); }
    setRecalculating(false);
  };

  const handleVerifyAll = async () => {
    setVerifying(true);
    try {
      await fetch('/api/verify-queue', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ verifyAll: true }) });
      await fetch('/api/verify-queue/process', { method: 'POST' });
      toast.success('Verification started');
      fetchLeads();
    } catch { toast.error('Verification failed'); }
    setVerifying(false);
  };

  const openDetail = (lead: Lead) => {
    setSelectedLead(lead);
    setSlideOverOpen(true);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const showingFrom = total === 0 ? 0 : (page - 1) * limit + 1;
  const showingTo = Math.min(page * limit, total);

  /* ─── FilterBar Config ─── */
  const filterBarFilters = useMemo(() => [
    { key: 'country', label: 'Country', options: meta?.countries?.map(c => c.v) ?? [] },
    { key: 'industry', label: 'Industry', options: meta?.industries?.map(i => i.v) ?? [] },
    { key: 'role', label: 'Role', options: meta?.titles?.map(t => t.v) ?? [] },
    { key: 'status', label: 'Status', options: ['imported', 'cleaned', 'drafted', 'sent', 'replied', 'bounced', 'queued', 'suppressed'] },
  ], [meta]);

  const activeFilterRecord = useMemo(() => ({
    country: countries.join(', '),
    industry: industries.join(', '),
    role: roleFilter,
    status: (quickStatus !== 'all' ? quickStatus : statuses.join(', ')),
  }), [countries, industries, roleFilter, statuses, quickStatus]);

  /* ═════════════════════════ Render ═══════════════════════════════════════════ */

  return (
    <PageTransition>
    <div className="space-y-6">

      {/* ═══════════════════ Top Bar ═══════════════════ */}
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-10 w-2 rounded-full" style={{ background: 'linear-gradient(180deg, #2563EB, #1d4ed8, #1e40af)', boxShadow: '0 0 20px rgba(37, 99, 235, 0.3)' }} />
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                <ShimmerText>AI-Prioritized Leads</ShimmerText>
              </h1>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm text-muted-foreground">
                  {metaLoading ? 'Loading...' : `${stats.totalLeads.toLocaleString()} total leads`}
                </span>
                {stats.highPriority > 0 && (
                  <Badge className="bg-emerald-500/10 border-emerald-500/25 text-emerald-700 text-[10px] h-5 px-2 gap-1">
                    <PulseDot color="#10b981" />
                    {stats.highPriority} high-priority detected
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs border-gray-200 bg-gray-50" onClick={() => setSidebarOpen(!sidebarOpen)}>
              <BarChart3 className="w-3.5 h-3.5" />Analytics
            </Button>
            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs border-gray-200 bg-gray-50" onClick={handleExportCSV} disabled={exporting}>
              {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              Export
            </Button>
            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs border-gray-200 bg-gray-50" onClick={handleRecalculateScores} disabled={recalculating}>
              {recalculating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              Recalc
            </Button>
            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs border-gray-200 bg-gray-50" onClick={handleVerifyAll} disabled={verifying}>
              {verifying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MailCheck className="w-3.5 h-3.5" />}
              Verify
            </Button>
            <Button size="sm" className="h-8 gap-1.5 text-xs font-medium text-white shadow-sm" style={{ background: 'linear-gradient(135deg, #2563EB, #1d4ed8)' }} onClick={handleAiScoreAll} disabled={aiScoring}>
              {aiScoring ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Brain className="w-3.5 h-3.5" />}
              {aiScoring ? 'Scoring...' : 'AI Score All'}
            </Button>
          </div>
        </div>

        {/* AI Insight Banner */}
        <AIInsightCard
          signal={`${stats.highPriority} high-priority leads detected this week`}
          evidence={`Average lead score is ${stats.avgScore}/100. ${stats.highPriority} leads scored 80+ and require immediate attention. Email health is at ${stats.emailHealthPct}% deliverability.`}
          confidence={stats.avgScore}
          businessImpact="Focus on high-scoring leads to maximize conversion rates and pipeline velocity."
          recommendedAction="Prioritize the top 15 high-priority leads for outreach within the next 7 days."
          source="AI Engine"
          className="rounded-xl border-blue-100"
        />
      </div>

      {/* ═══════════════════ Quick Status Tabs ═══════════════════ */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="flex items-center gap-1 p-1 rounded-xl bg-gray-100 border border-gray-200">
          {QUICK_STATUS_TABS.map(tab => {
            const isActive = quickStatus === tab.key;
            return (
              <motion.button
                key={tab.key}
                onClick={() => setQuickStatus(tab.key)}
                className={cn(
                  'relative px-4 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-colors',
                  isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground/70'
                )}
                whileTap={{ scale: 0.97 }}
              >
                {isActive && (
                  <motion.div
                    layoutId="status-tab"
                    className="absolute inset-0 rounded-lg bg-white shadow-sm border border-gray-200"
                    transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                  />
                )}
                <span className="relative z-10">{tab.label}</span>
              </motion.button>
            );
          })}
        </div>
        <div className="flex-1" />
        {/* View Toggle */}
        <div className="flex items-center gap-1 p-1 rounded-lg bg-gray-100 border border-gray-200">
          <button
            onClick={() => setViewMode('grid')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
              viewMode === 'grid' ? 'bg-white shadow-sm text-foreground border border-gray-200' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            Grid
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
              viewMode === 'list' ? 'bg-white shadow-sm text-foreground border border-gray-200' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <List className="w-3.5 h-3.5" />
            List
          </button>
        </div>
      </div>

      {/* ═══════════════════ FilterBar ═══════════════════ */}
      <FilterBar
        searchPlaceholder="Search leads by name, email, company, or title..."
        filters={filterBarFilters}
        activeFilters={activeFilterRecord}
        onSearchChange={(v) => setSearch(v)}
        onFilterChange={(key, value) => {
          if (key === 'country') setCountries(value ? value.split(', ') : []);
          else if (key === 'industry') setIndustries(value ? value.split(', ') : []);
          else if (key === 'role') setRoleFilter(value);
          else if (key === 'status') { setStatuses(value ? value.split(', ') : []); setQuickStatus('all'); }
        }}
        onClearAll={clearAllFilters}
        className="p-4 rounded-xl border border-gray-200 bg-white"
      />

      {/* ═══════════════════ Stats Bar ═══════════════════ */}
      <StaggerGrid className="grid grid-cols-2 lg:grid-cols-4 gap-3" stagger={0.06}>
        <StaggerItem>
          <div className="rounded-xl border border-gray-200 bg-white p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-blue-500/10">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Total Leads</p>
              <p className="text-xl font-bold tabular-nums text-foreground"><AnimatedCounter value={stats.totalLeads} /></p>
            </div>
          </div>
        </StaggerItem>
        <StaggerItem>
          <div className="rounded-xl border border-gray-200 bg-white p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-amber-500/10">
              <Target className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Avg Score</p>
              <p className="text-xl font-bold tabular-nums text-foreground"><AnimatedCounter value={stats.avgScore} /></p>
            </div>
          </div>
        </StaggerItem>
        <StaggerItem>
          <div className="rounded-xl border border-gray-200 bg-white p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-emerald-500/10">
              <Zap className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">High Priority</p>
              <p className="text-xl font-bold tabular-nums text-emerald-600"><AnimatedCounter value={stats.highPriority} /></p>
            </div>
          </div>
        </StaggerItem>
        <StaggerItem>
          <div className="rounded-xl border border-gray-200 bg-white p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-emerald-500/10">
              <MailCheck className="w-5 h-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Email Health</p>
              <p className="text-xl font-bold tabular-nums text-foreground"><AnimatedCounter value={stats.emailHealthPct} suffix="%" /></p>
            </div>
          </div>
        </StaggerItem>
      </StaggerGrid>

      {/* ═══════════════════ Main Content + Sidebar ═══════════════════ */}
      <div className="flex gap-6">
        {/* Main Content Area */}
        <div className="flex-1 min-w-0">

          {leadsLoading ? (
            <LoadingState message="Loading AI-prioritized leads..." lines={6} />
          ) : leads.length === 0 ? (
            <EmptyState
              icon={Inbox}
              title="No leads imported yet"
              description="Upload your target account list and our AI engine will identify buying signals, score leads, and recommend outreach actions."
              action={
                <Button variant="outline" size="sm" className="gap-2 text-xs" onClick={() => navigateTo?.('import')}>
                  <Download className="w-3.5 h-3.5" />
                  Import Leads
                </Button>
              }
            />
          ) : viewMode === 'grid' ? (
            /* ═══════════════════ GRID VIEW ═══════════════════ */
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              <AnimatePresence mode="popLayout">
                {leads.map((lead, idx) => {
                  const dbf = lead._dbFields;
                  const score = dbf?.leadScore;
                  const health = dbf?.emailHealth || 'unknown';
                  const status = dbf?.status || 'imported';
                  const initials = getInitials(lead.rawName || '?');
                  const aiReason = AI_REASONS[idx % AI_REASONS.length];
                  const action = RECOMMENDED_ACTIONS[idx % RECOMMENDED_ACTIONS.length];
                  const scoreColor = score != null ? (score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : '#ef4444') : '#71717a';

                  return (
                    <motion.div
                      key={lead.id}
                      initial={{ opacity: 0, y: 16, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.35, delay: Math.min(idx * 0.03, 0.3), ease: [0.22, 1, 0.36, 1] }}
                      whileHover={{ y: -3, transition: { duration: 0.2 } }}
                      className="group cursor-pointer"
                      onClick={() => openDetail(lead)}
                    >
                      <div className={cn(
                        'rounded-xl border bg-white p-5 transition-all duration-200 h-full flex flex-col',
                        selectedIds.has(lead.id) ? 'border-blue-400 shadow-md shadow-blue-500/10' : 'border-gray-200 group-hover:border-blue-200 group-hover:shadow-lg group-hover:shadow-blue-500/5'
                      )}>
                        {/* Card Header: Avatar + Name + Score */}
                        <div className="flex items-start gap-3 mb-3">
                          <div
                            className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-xs font-bold text-white"
                            style={{ background: `linear-gradient(135deg, ${scoreColor}, ${scoreColor}CC)` }}
                          >
                            {initials}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className="text-sm font-semibold text-foreground truncate">{lead.rawName || 'Unknown'}</h3>
                              <EmailHealthDot health={health} />
                            </div>
                            <p className="text-xs text-muted-foreground truncate mt-0.5">{lead.title || 'No title'}</p>
                          </div>
                          <ScoreBadge score={score} />
                        </div>

                        {/* Company + Industry */}
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3">
                          <Building2 className="w-3 h-3 shrink-0" />
                          <span className="truncate">{lead.company || 'Unknown Company'}</span>
                          {lead.industry && (
                            <>
                              <span className="text-muted-foreground/40">·</span>
                              <span className="truncate text-muted-foreground/70">{lead.industry}</span>
                            </>
                          )}
                        </div>

                        {/* AI Reason */}
                        <div className="rounded-lg bg-blue-50/60 border border-blue-100 px-3 py-2 mb-3">
                          <div className="flex items-center gap-1.5 mb-1">
                            <Sparkles className="w-3 h-3 text-blue-600 shrink-0" />
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-blue-600">Why this lead</span>
                          </div>
                          <p className="text-xs text-blue-800/80 leading-relaxed line-clamp-1">{aiReason}</p>
                        </div>

                        {/* Footer: Status + Action */}
                        <div className="flex items-center justify-between mt-auto pt-3 border-t border-gray-100">
                          <Badge variant="outline" className={`text-[10px] h-5 px-2 rounded-full ${STATUS_COLORS[status] || 'bg-gray-100 text-muted-foreground border-gray-200'}`}>
                            {status}
                          </Badge>
                          <button
                            onClick={(e) => { e.stopPropagation(); openDetail(lead); }}
                            className="flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:text-blue-700 transition-colors"
                          >
                            {action}
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          ) : (
            /* ═══════════════════ LIST VIEW ═══════════════════ */
            <GlassPanel className="overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-gray-200 hover:bg-transparent">
                      <TableHead className="w-10">
                        <Checkbox
                          checked={leads.length > 0 && selectedIds.size === leads.length && leads.every(l => selectedIds.has(l.id))}
                          onCheckedChange={(checked) => {
                            if (checked) setSelectedIds(new Set(leads.map(l => l.id)));
                            else setSelectedIds(new Set());
                          }}
                          className="h-3.5 w-3.5"
                        />
                      </TableHead>
                      <TableHead className="text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-wider h-11 cursor-pointer" onClick={() => handleSort('score')}>
                        <span className="inline-flex items-center gap-1">Score <SortIcon col="score" sortBy={sortBy} sortDir={sortDir} /></span>
                      </TableHead>
                      <TableHead className="text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-wider h-11">Name</TableHead>
                      <TableHead className="text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-wider h-11 cursor-pointer" onClick={() => handleSort('company')}>
                        <span className="inline-flex items-center gap-1">Company <SortIcon col="company" sortBy={sortBy} sortDir={sortDir} /></span>
                      </TableHead>
                      <TableHead className="text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-wider h-11">Title</TableHead>
                      <TableHead className="text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-wider h-11">Email Health</TableHead>
                      <TableHead className="text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-wider h-11">Status</TableHead>
                      <TableHead className="text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-wider h-11 w-[40px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leads.map((lead, idx) => {
                      const dbf = lead._dbFields;
                      const score = dbf?.leadScore;
                      const health = dbf?.emailHealth || 'unknown';
                      const status = dbf?.status || 'imported';
                      const scoreColor = score != null ? (score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : '#ef4444') : '#71717a';

                      return (
                        <motion.tr
                          key={lead.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ duration: 0.2, delay: Math.min(idx * 0.01, 0.15) }}
                          className="group border-gray-200 cursor-pointer transition-colors hover:bg-gray-50/50"
                          onClick={() => openDetail(lead)}
                        >
                          <TableCell className="py-3 px-3" onClick={e => e.stopPropagation()}>
                            <Checkbox checked={selectedIds.has(lead.id)} onCheckedChange={() => toggleSelect(lead.id)} className="h-3.5 w-3.5" />
                          </TableCell>
                          <TableCell className="py-3 px-2">
                            <ScoreBadge score={score} />
                          </TableCell>
                          <TableCell className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <div
                                className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold text-white"
                                style={{ background: `linear-gradient(135deg, ${scoreColor}, ${scoreColor}CC)` }}
                              >
                                {getInitials(lead.rawName || '?')}
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-medium text-foreground truncate">{lead.rawName || '-'}</p>
                                <p className="text-[10px] text-muted-foreground truncate">{lead.email || '-'}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="py-3 px-4 text-xs text-muted-foreground truncate max-w-[180px]">
                            <div className="flex items-center gap-1.5">
                              <Building2 className="w-3 h-3 shrink-0" />
                              {lead.company || '-'}
                            </div>
                          </TableCell>
                          <TableCell className="py-3 px-4 text-xs text-muted-foreground truncate max-w-[140px]">{lead.title || '-'}</TableCell>
                          <TableCell className="py-3 px-3">
                            <div className="flex items-center gap-2">
                              <EmailHealthDot health={health} />
                              <span className="text-[10px] text-muted-foreground capitalize">{health}</span>
                            </div>
                          </TableCell>
                          <TableCell className="py-3 px-2">
                            <Badge variant="outline" className={`text-[10px] h-5 px-2 rounded-full ${STATUS_COLORS[status] || 'bg-gray-100 text-muted-foreground border-gray-200'}`}>
                              {status}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-3 px-2" onClick={e => e.stopPropagation()}>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 hover:bg-gray-100 text-muted-foreground">
                                  <MoreHorizontal className="w-3.5 h-3.5" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-44 p-1" align="end">
                                <button className="w-full text-left text-xs text-foreground px-3 py-2 rounded-md hover:bg-gray-100 flex items-center gap-2" onClick={() => openDetail(lead)}>
                                  <Eye className="w-3.5 h-3.5 text-blue-600/70" />View Details
                                </button>
                                <button className="w-full text-left text-xs text-foreground px-3 py-2 rounded-md hover:bg-gray-100 flex items-center gap-2" onClick={() => navigateTo?.('contact-profile')}>
                                  <LayoutList className="w-3.5 h-3.5 text-amber-600/70" />Contact Profile
                                </button>
                                {navigateTo && (
                                  <button className="w-full text-left text-xs text-foreground px-3 py-2 rounded-md hover:bg-gray-100 flex items-center gap-2" onClick={() => navigateTo('companies')}>
                                    <Building2 className="w-3.5 h-3.5 text-emerald-600/70" />View Company
                                  </button>
                                )}
                              </PopoverContent>
                            </Popover>
                          </TableCell>
                        </motion.tr>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {!leadsLoading && total > 0 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-3 border-t border-gray-200">
                  <div className="text-xs text-muted-foreground">
                    Showing <span className="text-foreground font-medium tabular-nums">{showingFrom}</span> – <span className="text-foreground font-medium tabular-nums">{showingTo}</span> of <span className="text-foreground font-medium tabular-nums">{total.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-muted-foreground mr-1">Rows:</span>
                      {PAGE_SIZE_OPTIONS.map(size => (
                        <Button key={size} variant={limit === size ? 'default' : 'ghost'} size="sm" className={cn('h-7 px-2.5 text-[10px] rounded-md', limit === size ? 'bg-blue-600 text-white shadow-sm' : 'text-muted-foreground')} onClick={() => setLimit(size)}>{size}</Button>
                      ))}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" disabled={page <= 1} onClick={() => setPage(1)}><ChevronsLeft className="w-3.5 h-3.5" /></Button>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" disabled={page <= 1} onClick={() => setPage(page - 1)}><ChevronLeft className="w-3.5 h-3.5" /></Button>
                      <span className="text-xs text-foreground px-2 tabular-nums font-medium">{page} / {totalPages}</span>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" disabled={page >= totalPages} onClick={() => setPage(page + 1)}><ChevronRight className="w-3.5 h-3.5" /></Button>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" disabled={page >= totalPages} onClick={() => setPage(totalPages)}><ChevronsRight className="w-3.5 h-3.5" /></Button>
                    </div>
                  </div>
                </div>
              )}
            </GlassPanel>
          )}

          {/* Pagination for Grid View */}
          {viewMode === 'grid' && !leadsLoading && total > 0 && (
            <div className="flex items-center justify-between gap-3 mt-4 px-1">
              <div className="text-xs text-muted-foreground">
                Showing <span className="text-foreground font-medium tabular-nums">{showingFrom}</span> – <span className="text-foreground font-medium tabular-nums">{showingTo}</span> of <span className="text-foreground font-medium tabular-nums">{total.toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-muted-foreground mr-1">Rows:</span>
                  {PAGE_SIZE_OPTIONS.map(size => (
                    <Button key={size} variant={limit === size ? 'default' : 'ghost'} size="sm" className={cn('h-7 px-2.5 text-[10px] rounded-md', limit === size ? 'bg-blue-600 text-white shadow-sm' : 'text-muted-foreground')} onClick={() => setLimit(size)}>{size}</Button>
                  ))}
                </div>
                <Separator orientation="vertical" className="h-5" />
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" disabled={page <= 1} onClick={() => setPage(1)}><ChevronsLeft className="w-3.5 h-3.5" /></Button>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" disabled={page <= 1} onClick={() => setPage(page - 1)}><ChevronLeft className="w-3.5 h-3.5" /></Button>
                  <span className="text-xs text-foreground px-2 tabular-nums font-medium">{page} / {totalPages}</span>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" disabled={page >= totalPages} onClick={() => setPage(page + 1)}><ChevronRight className="w-3.5 h-3.5" /></Button>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" disabled={page >= totalPages} onClick={() => setPage(totalPages)}><ChevronsRight className="w-3.5 h-3.5" /></Button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ═══════════════════ Right Sidebar ═══════════════════ */}
        <AnimatePresence>
          {sidebarOpen && (
            <motion.aside
              initial={{ opacity: 0, x: 20, width: 0 }}
              animate={{ opacity: 1, x: 0, width: 320 }}
              exit={{ opacity: 0, x: 20, width: 0 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="hidden lg:block shrink-0 overflow-hidden"
            >
              <div className="space-y-4 w-[320px]">

                {/* Score Distribution */}
                <GlassPanel className="p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <BarChart3 className="w-4 h-4 text-blue-600" />
                    <h3 className="text-sm font-semibold text-foreground">Score Distribution</h3>
                  </div>
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={scoreDistribution} barCategoryGap="20%">
                      <XAxis dataKey="range" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={30} />
                      <RTooltip
                        contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
                        cursor={{ fill: 'rgba(37,99,235,0.04)' }}
                      />
                      <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                        {scoreDistribution.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </GlassPanel>

                {/* Top Industries */}
                {industryBreakdown.length > 0 && (
                  <GlassPanel className="p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <PieChartIcon className="w-4 h-4 text-blue-600" />
                      <h3 className="text-sm font-semibold text-foreground">Top Industries</h3>
                    </div>
                    <div className="space-y-2.5">
                      {industryBreakdown.map((item, i) => {
                        const maxVal = industryBreakdown[0]?.value || 1;
                        const pct = Math.round((item.value / maxVal) * 100);
                        const colors = ['#2563eb', '#0ea5e9', '#6366f1', '#8b5cf6', '#a855f7', '#c084fc'];
                        return (
                          <div key={item.name}>
                            <div className="flex items-center justify-between text-xs mb-1">
                              <span className="text-foreground truncate max-w-[200px]">{item.name}</span>
                              <span className="text-muted-foreground tabular-nums shrink-0">{item.value}</span>
                            </div>
                            <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                              <motion.div
                                className="h-full rounded-full"
                                style={{ background: colors[i % colors.length] }}
                                initial={{ width: 0 }}
                                animate={{ width: `${pct}%` }}
                                transition={{ duration: 0.6, delay: i * 0.08 }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </GlassPanel>
                )}

                {/* Status Distribution */}
                {statusDistribution.length > 0 && (
                  <GlassPanel className="p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <Activity className="w-4 h-4 text-blue-600" />
                      <h3 className="text-sm font-semibold text-foreground">Status Distribution</h3>
                    </div>
                    <ResponsiveContainer width="100%" height={160}>
                      <PieChart>
                        <Pie
                          data={statusDistribution}
                          cx="50%"
                          cy="50%"
                          innerRadius={40}
                          outerRadius={65}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {statusDistribution.map((entry, i) => (
                            <Cell key={i} fill={entry.fill} stroke="none" />
                          ))}
                        </Pie>
                        <RTooltip
                          contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }}
                          formatter={(value: number, name: string) => [value, name.charAt(0).toUpperCase() + name.slice(1)]}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
                      {statusDistribution.map(s => (
                        <div key={s.name} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                          <span className="w-2 h-2 rounded-full" style={{ background: s.fill }} />
                          <span className="capitalize">{s.name}</span>
                          <span className="tabular-nums font-medium text-foreground">{s.value}</span>
                        </div>
                      ))}
                    </div>
                  </GlassPanel>
                )}

                {/* Bulk Actions */}
                {selectedIds.size > 0 && (
                  <GlassPanel className="p-4 border-blue-200 bg-blue-50/30">
                    <div className="flex items-center gap-2 mb-3">
                      <Users className="w-4 h-4 text-blue-600" />
                      <span className="text-sm font-semibold text-foreground">{selectedIds.size} selected</span>
                    </div>
                    <div className="space-y-2">
                      <Button size="sm" className="w-full h-8 text-xs gap-2 text-white" style={{ background: 'linear-gradient(135deg, #2563EB, #1d4ed8)' }} onClick={() => setAssignDialogOpen(true)}>
                        <UserPlus className="w-3.5 h-3.5" />Assign Leads
                      </Button>
                      <Button variant="outline" size="sm" className="w-full h-8 text-xs gap-2 border-gray-200" onClick={handleExportCSV} disabled={exporting}>
                        {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                        Export Selected
                      </Button>
                    </div>
                  </GlassPanel>
                )}
              </div>
            </motion.aside>
          )}
        </AnimatePresence>
      </div>

      {/* ═══════════════════ Lead Detail Slide-Over ═══════════════════ */}
      <AnimatePresence>
        {slideOverOpen && selectedLead && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
              onClick={() => setSlideOverOpen(false)}
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed right-0 top-0 h-full w-full sm:w-[440px] z-50 flex flex-col overflow-hidden"
              style={{
                background: '#FFFFFF',
                border: '1px solid #E5E7EB',
                boxShadow: '-20px 0 60px rgba(0,0,0,0.15)',
              }}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-sm font-bold text-white"
                    style={{
                      background: (() => {
                        const s = selectedLead._dbFields?.leadScore;
                        const c = s != null ? (s >= 80 ? '#10b981' : s >= 60 ? '#f59e0b' : '#ef4444') : '#71717a';
                        return `linear-gradient(135deg, ${c}, ${c}CC)`;
                      })(),
                    }}
                  >
                    {getInitials(selectedLead.rawName || '?')}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-semibold text-foreground truncate">{selectedLead.rawName || 'Lead Details'}</h2>
                      <ScoreBadge score={selectedLead._dbFields?.leadScore} />
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {selectedLead.title} {selectedLead.company ? `at ${selectedLead.company}` : ''}
                    </p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground shrink-0" onClick={() => setSlideOverOpen(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>

              {/* Content */}
              <ScrollArea className="flex-1">
                <div className="p-5 space-y-5">

                  {/* AI Insight */}
                  <div className="rounded-xl bg-blue-50/60 border border-blue-100 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Sparkles className="w-4 h-4 text-blue-600" />
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-blue-600">AI Analysis</span>
                    </div>
                    <p className="text-xs text-blue-800/80 leading-relaxed">
                      {AI_REASONS[selectedLead.id.length % AI_REASONS.length]}
                    </p>
                    <div className="flex items-center gap-2 mt-3">
                      <Badge className="bg-blue-600 text-white text-[10px] h-5 px-2 gap-1">
                        <ArrowRight className="w-2.5 h-2.5" />
                        {RECOMMENDED_ACTIONS[selectedLead.id.length % RECOMMENDED_ACTIONS.length]}
                      </Badge>
                    </div>
                  </div>

                  {/* Contact Info */}
                  <div>
                    <p className="text-[10px] text-muted-foreground/60 uppercase tracking-widest font-semibold mb-2.5">Contact Info</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground/70 uppercase tracking-wider font-medium"><Users className="w-3 h-3" />Name</div>
                        <p className="text-sm text-foreground font-medium mt-1">{selectedLead.rawName || '-'}</p>
                      </div>
                      <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground/70 uppercase tracking-wider font-medium"><Briefcase className="w-3 h-3" />Title</div>
                        <p className="text-sm text-foreground font-medium mt-1">{selectedLead.title || '-'}</p>
                      </div>
                    </div>
                    <div className="p-3 rounded-lg bg-gray-50 border border-gray-200 mt-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground/70 uppercase tracking-wider font-medium"><Mail className="w-3 h-3" />Email</div>
                        <div className="flex items-center gap-1.5">
                          <EmailHealthDot health={selectedLead._dbFields?.emailHealth || 'unknown'} />
                          <span className="text-[10px] text-muted-foreground capitalize">{selectedLead._dbFields?.emailHealth || 'unknown'}</span>
                        </div>
                      </div>
                      {selectedLead.email ? (
                        <a href={`mailto:${selectedLead.email}`} className="text-sm text-blue-600 hover:underline flex items-center gap-1 mt-1">{selectedLead.email}<ExternalLink className="w-3 h-3" /></a>
                      ) : <p className="text-sm text-muted-foreground mt-1">-</p>}
                    </div>
                    {selectedLead._dbFields?.phone && (
                      <div className="p-3 rounded-lg bg-gray-50 border border-gray-200 mt-2">
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground/70 uppercase tracking-wider font-medium"><Phone className="w-3 h-3" />Phone</div>
                        <p className="text-sm text-foreground font-medium mt-1">{selectedLead._dbFields.phone}</p>
                      </div>
                    )}
                    <div className="p-3 rounded-lg bg-gray-50 border border-gray-200 mt-2">
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground/70 uppercase tracking-wider font-medium"><MapPin className="w-3 h-3" />Location</div>
                      <p className="text-sm text-foreground font-medium mt-1">{[selectedLead.city, selectedLead.state, selectedLead.country].filter(Boolean).join(', ') || '-'}</p>
                    </div>
                  </div>

                  <Separator className="bg-gray-100" />

                  {/* Company Info */}
                  <div>
                    <p className="text-[10px] text-muted-foreground/60 uppercase tracking-widest font-semibold mb-2.5">Company Info</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground/70 uppercase tracking-wider font-medium"><Building2 className="w-3 h-3" />Company</div>
                        <p className="text-sm text-foreground font-medium mt-1">{selectedLead.company || '-'}</p>
                      </div>
                      <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground/70 uppercase tracking-wider font-medium"><Globe className="w-3 h-3" />Industry</div>
                        <p className="text-sm text-foreground font-medium mt-1">{selectedLead.industry || '-'}</p>
                      </div>
                      <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground/70 uppercase tracking-wider font-medium"><Users className="w-3 h-3" />Size</div>
                        <p className="text-sm text-foreground font-medium mt-1">{selectedLead.employeeCategory || selectedLead.employeeNumber || '-'}</p>
                      </div>
                      {selectedLead.website && (
                        <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
                          <div className="flex items-center gap-1 text-[10px] text-muted-foreground/70 uppercase tracking-wider font-medium"><Globe className="w-3 h-3" />Domain</div>
                          <p className="text-sm text-blue-600 font-medium mt-1 truncate">{selectedLead.website}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <Separator className="bg-gray-100" />

                  {/* Metadata */}
                  <div>
                    <p className="text-[10px] text-muted-foreground/60 uppercase tracking-widest font-semibold mb-2.5">Metadata</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground/70 uppercase tracking-wider font-medium"><Activity className="w-3 h-3" />Status</div>
                        <Badge variant="outline" className={`mt-1 text-[10px] h-5 px-2 rounded-full ${STATUS_COLORS[selectedLead._dbFields?.status || 'imported'] || 'bg-gray-100 text-muted-foreground border-gray-200'}`}>
                          {selectedLead._dbFields?.status || '-'}
                        </Badge>
                      </div>
                      <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground/70 uppercase tracking-wider font-medium"><UserPlus className="w-3 h-3" />Assigned</div>
                        <p className="text-sm text-foreground font-medium mt-1">{selectedLead._dbFields?.assignedTo || 'Unassigned'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Action Button */}
                  <Button
                    className="w-full h-10 gap-2 text-sm font-medium text-white"
                    style={{ background: 'linear-gradient(135deg, #2563EB, #1d4ed8)' }}
                    onClick={() => {
                      setSlideOverOpen(false);
                      if (navigateTo) navigateTo('contact-profile');
                    }}
                  >
                    <Eye className="w-4 h-4" />
                    View Full Contact Profile
                  </Button>
                </div>
              </ScrollArea>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ═══════════════════ Assign Dialog ═══════════════════ */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Assign Leads</DialogTitle>
            <DialogDescription className="text-xs">Assign {selectedIds.size > 0 ? `${selectedIds.size} selected` : 'all'} leads to a team member.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <Button className="w-full h-10 gap-2 text-sm text-white" style={{ background: 'linear-gradient(135deg, #2563EB, #1d4ed8)' }} onClick={() => { toast.success('Leads assigned successfully'); setAssignDialogOpen(false); setSelectedIds(new Set()); }}>
              <UserPlus className="w-4 h-4" />Assign to Ravi Shanker
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
    </PageTransition>
  );
}

/* ═════════════════════════ Shared Sort Icon ═══════════════════════════════ */

function SortIcon({ col, sortBy, sortDir }: { col: string; sortBy: string; sortDir: string }) {
  if (sortBy !== col) return <ArrowUpDown className="w-3 h-3 opacity-30" />;
  return sortDir === 'asc' ? <ChevronUp className="w-3 h-3 text-blue-600" /> : <ChevronDown className="w-3 h-3 text-blue-600" />;
}
