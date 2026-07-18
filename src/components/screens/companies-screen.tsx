'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Building2, Globe, MapPin, Users, Search, Brain, Download,
  ChevronLeft, ChevronRight, MoreHorizontal, Sparkles, Loader2, Check,
  CheckSquare, Square,
  TrendingUp, BarChart3, Signal, X, Plus,
} from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { PageTransition, AnimatedCounter } from '@/components/ui/animated-components';
import { useAppStore } from '@/lib/store';

/* ═══════════════════════════════════════════════════════════════
   Design Tokens
   ═══════════════════════════════════════════════════════════════ */
const gold = '#D4AF37';
const card = 'rgba(255, 255, 255, 0.85)';
const border = 'rgba(0, 0, 0, 0.05)';
const textMuted = '#6B7280';

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  prospect:     { bg: 'rgba(59,130,246,0.12)', text: '#2563EB' },
  researching:  { bg: 'rgba(245,158,11,0.12)', text: '#D97706' },
  active:       { bg: 'rgba(16,185,129,0.12)', text: '#059669' },
  engaged:      { bg: 'rgba(139,92,246,0.12)', text: '#7C3AED' },
  paused:       { bg: 'rgba(161,161,170,0.12)', text: '#52525B' },
  closed_won:   { bg: 'rgba(34,197,94,0.12)', text: '#16A34A' },
  closed_lost:  { bg: 'rgba(239,68,68,0.12)', text: '#DC2626' },
};

/* ═══════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════ */
interface Company {
  id: string;
  rawName: string;
  domain: string | null;
  industry: string | null;
  sizeRange: string | null;
  country: string | null;
  status: string;
  intelligenceScore: number | null;
  contactCount?: number;
  _count?: { contacts: number; notes: number; signals: number };
  researchCard?: {
    id: string;
    businessOverview: string | null;
    revenue: string | null;
    employeeCount: string | null;
    fundingStage: string | null;
    enrichmentDate: string | null;
  } | null;
}

interface CompaniesScreenProps {
  navigateTo?: (screen: string, id?: string) => void;
}

/* ═══════════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════════ */
const DEMO_INDUSTRIES = ['Technology','Financial Services','Healthcare','IT Services','E-commerce','Manufacturing','Fintech','Aerospace'];
const DEMO_COUNTRIES  = ['US','IN','GB','CA','DE','KR','NG'];

function scoreColor(s: number | null): string {
  if (!s || s < 40) return '#9CA3AF';
  if (s >= 80) return '#059669';
  if (s >= 60) return '#D97706';
  return '#2563EB';
}

function scoreGradient(s: number | null): string {
  if (!s || s < 40) return 'linear-gradient(90deg, #9CA3AF, #D1D5DB)';
  if (s >= 80) return 'linear-gradient(90deg, #059669, #34D399)';
  if (s >= 60) return 'linear-gradient(90deg, #D97706, #FBBF24)';
  return 'linear-gradient(90deg, #2563EB, #60A5FA)';
}

function scoreGlow(s: number | null): string | undefined {
  if (s != null && s >= 80) return '0 0 8px rgba(5,150,105,0.5)';
  return undefined;
}

function statusLabel(s: string) {
  return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

/* ═══════════════════════════════════════════════════════════════
   Score Bar
   ═══════════════════════════════════════════════════════════════ */
function ScoreBar({ score }: { score: number | null }) {
  const v = score ?? 0;
  const col = scoreColor(score);
  const grad = scoreGradient(score);
  const glow = scoreGlow(score);
  const isHot = score != null && score >= 80;
  const isAi = score != null && score >= 60;
  const label = score != null && score >= 80 ? 'Hot'
    : score != null && score >= 60 ? 'Active'
    : score != null && score >= 40 ? 'Developing'
    : 'Cold';
  const labelColor = col;

  return (
    <div className="flex flex-col gap-0.5 min-w-[100px]">
      <div className="flex items-center gap-1.5">
        <div className="relative flex-1 h-2 rounded-full" style={{ background: 'rgba(0, 0, 0, 0.05)' }}>
          <motion.div
            className="h-full rounded-full"
            style={{
              background: grad,
              boxShadow: glow,
            }}
            initial={{ width: 0 }}
            animate={{ width: `${v}%` }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          />
          {isHot && v > 0 && (
            <motion.span
              className="absolute top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full"
              style={{ background: '#34D399', boxShadow: '0 0 6px rgba(52,211,153,0.8)' }}
              animate={{ opacity: [1, 0.4, 1], scale: [1, 1.3, 1] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
            />
          )}
        </div>
        <div className="flex items-center gap-0.5 w-10 shrink-0 justify-end">
          {isAi && (
            <span
              className="text-[8px] font-bold leading-none px-1 py-px rounded-sm"
              style={{ color: '#D4AF37', background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.25)' }}
            >
              AI
            </span>
          )}
          <span
            className="text-[11px] font-bold tabular-nums"
            style={{
              color: col,
              textShadow: isHot ? '0 0 8px rgba(5,150,105,0.5)' : undefined,
            }}
          >
            {v}
          </span>
        </div>
      </div>
      <span className="text-[9px] font-medium leading-none" style={{ color: labelColor, opacity: 0.75 }}>
        {label}
      </span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   3-Dot Menu
   ═══════════════════════════════════════════════════════════════ */
function ActionMenu({ companyId, navigateTo }: { companyId: string; navigateTo?: (s: string, id?: string) => void }) {
  const [open, setOpen] = useState(false);
  const menuRef = useCallback((node: HTMLDivElement | null) => {
    if (!node) return;
    const handler = (e: MouseEvent) => {
      if (!node.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const items = [
    { label: 'View Details', action: () => { useAppStore.getState().setSelectedCompanyId(companyId); navigateTo?.('companies'); } },
    { label: 'Generate AI Brief', action: async () => {
      toast.loading('Generating AI account brief...', { id: 'ai-brief' });
      try {
        const res = await fetch(`/api/ai/account-brief?companyId=${companyId}`);
        const json = await res.json();
        const data = json.data ?? json;
        if (data.brief) {
          toast.success('AI brief generated! View it in Company Details.', { id: 'ai-brief' });
          useAppStore.getState().setSelectedCompanyId(companyId); navigateTo?.('companies');
        } else {
          toast.error(data.error || 'Failed to generate brief', { id: 'ai-brief' });
        }
      } catch { toast.error('AI brief request failed', { id: 'ai-brief' }); }
    }},
    { label: 'Enrich Data', action: async () => {
      toast.loading('Queueing enrichment job...', { id: 'enrich' });
      try {
        await fetch('/api/g-data/jobs/actions', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'enqueue-enrichment', companyIds: [companyId], force: true }),
        });
        toast.success('Enrichment job queued — check Command Center for progress', { id: 'enrich' });
      } catch { toast.error('Failed to queue enrichment', { id: 'enrich' }); }
    }},
    { label: 'Add Note', action: () => { useAppStore.getState().setSelectedCompanyId(companyId); navigateTo?.('companies'); } },
  ];

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        className="p-1 rounded-md hover:bg-gray-100 transition-colors"
      >
        <MoreHorizontal size={16} className="text-[#6B7280]" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-1 z-50 py-1 rounded-lg border min-w-[140px]"
            style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', boxShadow: '0 4px 16px rgba(0,0,0,0.12)', borderColor: border, backdropFilter: 'blur(12px)' }}
          >
            {items.map((item) => (
              <button
                key={item.label}
                onClick={(e) => { e.stopPropagation(); setOpen(false); item.action(); }}
                className="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-100 transition-colors"
                style={{ color: '#6B7280' }}
              >
                {item.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Loading Skeleton
   ═══════════════════════════════════════════════════════════════ */
function TableSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-3 rounded-lg" style={{ background: i % 2 === 0 ? '#F9FAFB' : 'transparent' }}>
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-8" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-6" />
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Main Component
   ═══════════════════════════════════════════════════════════════ */
export default function CompaniesScreen({ navigateTo }: CompaniesScreenProps) {
  /* ── Data state ── */
  const [companies, setCompanies] = useState<Company[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ withContacts: 0, withSignals: 0, avgScore: 0, enriched: 0 });
  const [metaLoading, setMetaLoading] = useState(true);

  /* ── Add Company dialog state ── */
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [addForm, setAddForm] = useState({ rawName: '', domain: '', industry: '', sizeRange: '', location: '', country: '', website: '' });
  const [addSubmitting, setAddSubmitting] = useState(false);

  const handleAddCompany = async () => {
    if (!addForm.rawName.trim()) { toast.error('Company name is required'); return; }
    setAddSubmitting(true);
    try {
      const res = await fetch('/api/companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(addForm),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`"${addForm.rawName}" added successfully`);
        setShowAddDialog(false);
        setAddForm({ rawName: '', domain: '', industry: '', sizeRange: '', location: '', country: '', website: '' });
        fetchCompanies();
      } else if (res.status === 409) {
        toast.error(data.error || 'Company already exists');
        if (data.companyId) {
          useAppStore.getState().setSelectedCompanyId(data.companyId);
          navigateTo?.('companies');
          setShowAddDialog(false);
        }
      } else {
        toast.error(data.error || 'Failed to add company');
      }
    } catch { toast.error('Request failed'); }
    setAddSubmitting(false);
  };

  /* ── Selection state ── */
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  /* ── Batch enrichment state ── */
  const [enrichLoading, setEnrichLoading] = useState(false);
  const [enrichProgress, setEnrichProgress] = useState<{ current: number; total: number; companyName: string } | null>(null);
  const [enrichCancelled, setEnrichCancelled] = useState(false);
  const enrichCancelRef = useRef(false);

  /* ── Filter state ── */
  const [search, setSearch] = useState('');
  const [industry, setIndustry] = useState('');
  const [country, setCountry] = useState('');
  const [page, setPage] = useState(1);
  const [enrichmentStatus, setEnrichmentStatus] = useState<'' | 'enriched' | 'unenriched'>('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const limit = 20;

  /* ── Meta (filter options) ── */
  const [industries, setIndustries] = useState<string[]>([]);
  const [countries, setCountries] = useState<string[]>([]);

  /* ── Debounce search ── */
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  /* ── Fetch meta ── */
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/companies/meta');
        const data = await res.json();
        const inds = data.data?.industries || data.industries || [];
        const cos = data.data?.countries || data.countries || [];
        setIndustries(inds.length > 0 ? inds.slice(0, 10) : DEMO_INDUSTRIES);
        setCountries(cos.length > 0 ? cos.slice(0, 10) : DEMO_COUNTRIES);
      } catch {
        setIndustries(DEMO_INDUSTRIES);
        setCountries(DEMO_COUNTRIES);
      } finally {
        setMetaLoading(false);
      }
    })();
  }, []);

  /* ── Fetch companies ── */
  const fetchCompanies = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (industry) params.set('industry', industry);
      if (country) params.set('country', country);
      if (enrichmentStatus) params.set('enrichment', enrichmentStatus);
      params.set('sort', 'name');
      params.set('order', 'asc');

      const res = await fetch(`/api/companies?${params}`);
      const data = await res.json();
      const list = data.data?.companies || data.companies || [];
      const t = data.data?.total ?? data.total ?? 0;
      setCompanies(list);
      setTotal(t);

      // Derive stats from the response page
      const wc = list.filter((c: Company) => (c.contactCount || c._count?.contacts || 0) > 0).length;
      const ws = list.filter((c: Company) => (c.intelligenceScore ?? 0) > 0).length;
      const enriched = list.filter((c: Company) => !!c.researchCard).length;
      const avg = list.length > 0
        ? Math.round(list.reduce((a: number, c: Company) => a + (c.intelligenceScore ?? 0), 0) / list.length)
        : 0;
      setStats({ withContacts: wc, withSignals: ws, avgScore: avg, enriched });
    } catch {
      toast.error('Failed to load companies');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, industry, country, page]);

  useEffect(() => { fetchCompanies(); }, [fetchCompanies]);

  /* ── Selection helpers ── */
  const allSelected = companies.length > 0 && companies.every(c => selectedIds.has(c.id));
  const someSelected = selectedIds.size > 0 && !allSelected;

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(companies.map(c => c.id)));
    }
  };

  /* ── Enrichment via Job Queue (Phase 2) ── */
  const enrichSelected = useCallback(async () => {
    // Determine which IDs to enrich
    let idsToEnrich: string[] = [];

    if (selectedIds.size > 0) {
      idsToEnrich = [...selectedIds];
    } else {
      try {
        const res = await fetch('/api/g-crm/companies?limit=500');
        const data = await res.json();
        const all = data.companies || data.data?.companies || [];
        idsToEnrich = all
          .filter((c: Company) => !c.researchCard)
          .map((c: Company) => c.id);
      } catch {
        toast.error('Failed to fetch companies for enrichment');
        return;
      }
    }

    if (idsToEnrich.length === 0) {
      toast.info('No unenriched companies found');
      return;
    }

    setEnrichLoading(true);
    setEnrichCancelled(false);
    enrichCancelRef.current = false;
    setSelectedIds(new Set());

    // Queue all enrichment jobs via the workflow engine
    let createdCount = 0;
    try {
      const res = await fetch('/api/g-data/jobs/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'enqueue-enrichment',
          companyIds: idsToEnrich,
          force: true,
        }),
      });
      const data = await res.json();
      if (data.error) {
        toast.error(`Enrichment queue failed: ${data.error}`);
        setEnrichLoading(false);
        return;
      }
      createdCount = data.created ?? 0;
      const skipped = data.skipped ?? 0;
      if (createdCount === 0) {
        toast.info(`No new jobs created${skipped > 0 ? `, ${skipped} already queued` : ''}`);
        setEnrichLoading(false);
        return;
      }
      toast.success(`${createdCount} enrichment jobs queued — processing will start automatically`);
    } catch {
      toast.error('Failed to queue enrichment jobs');
      setEnrichLoading(false);
      return;
    }

    // Poll job status until all enrichment jobs complete or fail
    const pollInterval = setInterval(async () => {
      if (enrichCancelRef.current) {
        clearInterval(pollInterval);
        setEnrichLoading(false);
        setEnrichProgress(null);
        return;
      }
      try {
        const statsRes = await fetch('/api/g-data/jobs?status=all&type=enrichment&page=1&pageSize=50');
        const statsData = await statsRes.json();
        const jobs = statsData.jobs || [];
        const activeJobs = jobs.filter((j: any) => j.status === 'pending' || j.status === 'queued' || j.status === 'running');
        const completedJobs = jobs.filter((j: any) => j.status === 'completed');
        const failedJobs = jobs.filter((j: any) => j.status === 'failed');

        // Update progress bar
        const runningJob = jobs.find((j: any) => j.status === 'running');
        if (runningJob) {
          setEnrichProgress({
            current: completedJobs.length + failedJobs.length,
            total: createdCount,
            companyName: runningJob.currentStep || 'Processing...',
          });
        } else if (activeJobs.length === 0) {
          // All done — stop polling, refresh company list
          clearInterval(pollInterval);
          setEnrichLoading(false);
          setEnrichProgress(null);
          fetchCompanies();
          if (completedJobs.length > 0) {
            toast.success(`Enrichment complete: ${completedJobs.length} succeeded${failedJobs.length > 0 ? `, ${failedJobs.length} failed` : ''}`);
          } else if (failedJobs.length > 0) {
            toast.error(`Enrichment failed: ${failedJobs.length} jobs failed. Check Command Center for details.`);
          }
        }
      } catch {
        // Silently continue polling — network blips shouldn't stop it
      }
    }, 5000); // Poll every 5 seconds

    // Cleanup on unmount
    return () => clearInterval(pollInterval);
  }, [selectedIds, companies, fetchCompanies]);

  const cancelEnrich = () => {
    enrichCancelRef.current = true;
    setEnrichCancelled(true);
  };

  // Reset page on filter change
  useEffect(() => { setPage(1); }, [debouncedSearch, industry, country, enrichmentStatus]);

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const showEmpty = !loading && companies.length === 0;
  const activeFilters = [search, industry, country].filter(Boolean).length;

  /* ── Native select styles ── */
  const selectCls = `h-8 text-xs rounded-md border px-2 pr-7 appearance-none cursor-pointer
    focus:outline-none focus:ring-1 transition-colors`;
  const selectStyle: React.CSSProperties = {
    background: card,
    borderColor: border,
    color: '#6B7280',
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236B7280' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 8px center',
  };

  return (
    <PageTransition className="flex flex-col gap-5 h-full overflow-hidden">
      {/* ═══ Top Bar ═══ */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        {/* Title + count */}
        <div className="flex items-center gap-2.5 shrink-0">
          <h1 className="text-lg font-bold tracking-tight text-gray-900">Companies</h1>
          <span
            className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
            style={{ background: 'rgba(212,175,55,0.12)', color: gold }}
          >
            {total}
          </span>
        </div>

        {/* Search + Filters */}
        <div className="flex flex-1 items-center gap-2 flex-wrap sm:flex-nowrap">
          {/* Search */}
          <div className="relative flex-1 min-w-[180px]">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: textMuted }} />
            <input
              type="text"
              placeholder="Search companies..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-8 pl-8 pr-8 text-xs rounded-lg border focus:outline-none focus:ring-1 transition-all placeholder:text-[#6B7280]/60"
              style={{
                background: 'rgba(0, 0, 0, 0.03)',
                borderColor: 'rgba(0, 0, 0, 0.06)',
                color: '#374151',
                backdropFilter: 'blur(12px)',
              }}
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2">
                <X size={12} style={{ color: textMuted }} />
              </button>
            )}
          </div>

          {/* Industry */}
          <select
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
            className={selectCls}
            style={selectStyle}
          >
            <option value="">All Industries</option>
            {industries.map((ind) => <option key={ind} value={ind}>{ind}</option>)}
          </select>

          {/* Country */}
          <select
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className={selectCls}
            style={selectStyle}
          >
            <option value="">All Countries</option>
            {countries.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>

          {/* Enrichment Status */}
          <select
            value={enrichmentStatus}
            onChange={(e) => setEnrichmentStatus(e.target.value as '' | 'enriched' | 'unenriched')}
            className={selectCls}
            style={selectStyle}
          >
            <option value="">All Status</option>
            <option value="enriched">Enriched</option>
            <option value="unenriched">Not Enriched</option>
          </select>

          {/* Export CSV */}
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              const rows = [['Name','Domain','Industry','Country','Contacts','Intelligence Score','Status']];
              companies.forEach(c => rows.push([c.rawName, c.domain || '', c.industry || '', c.country || '', String(c.contactCount || c._count?.contacts || 0), String(c.intelligenceScore ?? ''), c.status]));
              const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
              const blob = new Blob([csv], { type: 'text/csv' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url; a.download = 'companies.csv'; a.click();
              URL.revokeObjectURL(url);
              toast.success(`Exported ${companies.length} companies`);
            }}
            className="h-8 px-3 text-xs font-medium rounded-lg shrink-0"
            style={{ borderColor: 'rgba(0, 0, 0, 0.06)', color: '#6B7280' }}
          >
            <Download size={14} className="mr-1.5" />
            Export
          </Button>

          {/* Enrich Selected / Enrich All */}
          {!enrichLoading ? (
            <Button
              size="sm"
              variant="outline"
              onClick={enrichSelected}
              className="h-8 px-3 text-xs font-medium rounded-lg shrink-0"
              style={{ borderColor: selectedIds.size > 0 ? 'rgba(212,175,55,0.5)' : 'rgba(212,175,55,0.3)', color: gold }}
            >
              <Sparkles size={14} className="mr-1.5" />
              {selectedIds.size > 0 ? `Enrich ${selectedIds.size} Selected` : 'Enrich All'}
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={cancelEnrich}
              className="h-8 px-3 text-xs font-medium rounded-lg shrink-0"
              style={{ borderColor: 'rgba(239,68,68,0.4)', color: '#DC2626' }}
            >
              <X size={14} className="mr-1.5" />
              Stop
            </Button>
          )}

          {/* Add Company */}
          <Button
            size="sm"
            onClick={() => setShowAddDialog(true)}
            className="h-8 px-3 text-xs font-semibold rounded-lg shrink-0"
            style={{ background: gold, color: '#0c1220' }}
          >
            <Plus size={14} className="mr-1.5" />
            Add Company
          </Button>
        </div>
      </div>

      {/* ═══ Stats Strip ═══ */}
      <motion.div
        className="grid grid-cols-2 md:grid-cols-4 gap-3"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        {[
          { icon: Building2, value: total, label: 'Total Companies', color: '#374151' },
          { icon: Users, value: stats.withContacts, label: 'With Contacts', color: '#2563EB' },
          { icon: Sparkles, value: stats.enriched, label: 'Enriched (AI)', color: '#059669' },
          { icon: BarChart3, value: stats.avgScore, label: 'Avg Intelligence Score', color: '#D97706' },
        ].map((s) => (
          <div
            key={s.label}
            className="flex items-center gap-3 px-4 py-3 rounded-xl border"
            style={{ background: card, borderColor: border }}
          >
            <div className="p-2 rounded-lg" style={{ background: `${s.color}10` }}>
              <s.icon size={16} style={{ color: s.color }} />
            </div>
            <div>
              <div className="text-base font-bold tabular-nums" style={{ color: s.color }}>
                <AnimatedCounter value={s.value} />
              </div>
              <div className="text-[11px] leading-tight" style={{ color: textMuted }}>{s.label}</div>
            </div>
          </div>
        ))}
      </motion.div>

      {/* ═══ Enrichment Progress Bar ═══ */}
      {enrichLoading && enrichProgress && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border px-4 py-3"
          style={{ background: 'rgba(212,175,55,0.06)', borderColor: 'rgba(212,175,55,0.2)' }}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Loader2 size={14} className="animate-spin" style={{ color: gold }} />
              <span className="text-xs font-semibold" style={{ color: '#374151' }}>
                Enriching: {enrichProgress.companyName}
              </span>
            </div>
            <span className="text-xs font-bold tabular-nums" style={{ color: gold }}>
              {enrichProgress.current} / {enrichProgress.total}
            </span>
          </div>
          <div className="w-full h-2 rounded-full" style={{ background: 'rgba(0,0,0,0.05)' }}>
            <motion.div
              className="h-full rounded-full"
              style={{ background: 'linear-gradient(90deg, #D4AF37, #E8C547)' }}
              initial={{ width: 0 }}
              animate={{ width: `${(enrichProgress.current / enrichProgress.total) * 100}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </motion.div>
      )}

      {/* ═══ Selection Action Bar ═══ */}
      {selectedIds.size > 0 && !enrichLoading && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 px-4 py-2 rounded-xl border"
          style={{ background: 'rgba(59,130,246,0.04)', borderColor: 'rgba(59,130,246,0.15)' }}
        >
          <Check size={14} style={{ color: '#2563EB' }} />
          <span className="text-xs font-medium" style={{ color: '#2563EB' }}>
            {selectedIds.size} company{selectedIds.size > 1 ? 'ies' : 'y'} selected
          </span>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="text-xs underline ml-1"
            style={{ color: '#6B7280' }}
          >
            Clear
          </button>
        </motion.div>
      )}

      {/* ═══ Table ═══ */}
      <div className="flex-1 min-h-0 rounded-xl border overflow-hidden" style={{ background: card, borderColor: border }}>
        {/* Header */}
        <div
          className="flex items-center gap-4 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider border-b"
          style={{ color: textMuted, borderColor: border }}
        >
          <div className="w-8 shrink-0 flex justify-center" onClick={(e) => e.stopPropagation()}>
            <button onClick={toggleSelectAll} className="p-0.5 rounded hover:bg-gray-100 transition-colors">
              {allSelected ? (
                <CheckSquare size={14} style={{ color: gold }} />
              ) : someSelected ? (
                <CheckSquare size={14} style={{ color: '#9CA3AF' }} />
              ) : (
                <Square size={14} style={{ color: '#D1D5DB' }} />
              )}
            </button>
          </div>
          <div className="w-[220px] shrink-0">Company</div>
          <div className="w-[130px] shrink-0 hidden lg:block">Domain</div>
          <div className="w-[60px] shrink-0 hidden md:block">Country</div>
          <div className="w-[100px] shrink-0 hidden md:block">Size</div>
          <div className="w-[56px] shrink-0 text-center">Contacts</div>
          <div className="w-[120px] shrink-0 hidden sm:block">Intelligence</div>
          <div className="w-[90px] shrink-0">Status</div>
          <div className="w-8 shrink-0" />
        </div>

        {/* Body */}
        <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 380px)', minHeight: '200px' }}>
          {loading ? (
            <TableSkeleton />
          ) : showEmpty ? (
            /* ── AI-Powered Empty State ── */
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-16 gap-3 relative"
            >
              {/* AI-Ready badge */}
              <span
                className="absolute top-0 right-8 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full"
                style={{ background: 'rgba(212,175,55,0.1)', color: '#D4AF37', border: '1px solid rgba(212,175,55,0.2)' }}
              >
                AI-Ready
              </span>

              <motion.div
                animate={{ scale: [1, 1.08, 1] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
                style={{ background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.2)' }}
              >
                <Brain className="w-7 h-7" style={{ color: '#D4AF37' }} />
              </motion.div>

              <p className="text-sm font-semibold text-foreground">
                {activeFilters > 0 ? 'No companies match your criteria' : 'Your intelligence database is empty'}
              </p>
              <p className="text-xs text-center max-w-sm" style={{ color: textMuted }}>
                Import companies to activate AI-powered signal detection, scoring, and opportunity identification across your target accounts.
              </p>
              <p className="text-[11px] text-center max-w-md mt-1" style={{ color: '#9CA3AF' }}>
                DeepMindQ will automatically scan for buying signals, leadership changes, and growth triggers once you add companies.
              </p>

              <Button
                size="sm"
                className="mt-3 text-xs font-semibold shadow-sm"
                style={{ background: '#D4AF37', color: '#fff', border: 'none' }}
                onClick={() => navigateTo?.('import')}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#C5A030'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = '#D4AF37'; }}
              >
                Import Companies
              </Button>

              {activeFilters > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setSearch(''); setIndustry(''); setCountry(''); }}
                  className="mt-1 text-xs"
                  style={{ color: gold }}
                >
                  Clear all filters
                </Button>
              )}
            </motion.div>
          ) : (
            <AnimatePresence mode="popLayout">
              {companies.map((company, i) => {
                const sc = STATUS_COLORS[company.status] || { bg: 'rgba(100,100,100,0.12)', text: '#52525B' };
                const cc = company.contactCount ?? company._count?.contacts ?? 0;
                const isSelected = selectedIds.has(company.id);
                const isEnriched = !!company.researchCard;
                return (
                  <motion.div
                    key={company.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 8 }}
                    transition={{ duration: 0.25, delay: i * 0.02 }}
                    onClick={() => { useAppStore.getState().setSelectedCompanyId(company.id); navigateTo?.('companies'); }}
                    className="group flex items-center gap-4 px-4 py-2.5 cursor-pointer border-l-2 border-l-transparent hover:border-l-[3px] transition-all duration-200"
                    style={{
                      background: isSelected ? 'rgba(212,175,55,0.06)' : (i % 2 === 0 ? '#F9FAFB' : 'transparent'),
                      hoverBorderLeftColor: gold,
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderLeftColor = gold; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderLeftColor = 'transparent'; }}
                  >
                    {/* Checkbox */}
                    <div className="w-8 shrink-0 flex justify-center" onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => toggleSelect(company.id)} className="p-0.5 rounded hover:bg-gray-100 transition-colors">
                        {isSelected ? (
                          <CheckSquare size={14} style={{ color: gold }} />
                        ) : (
                          <Square size={14} className="opacity-0 group-hover:opacity-40 transition-opacity" />
                        )}
                      </button>
                    </div>

                    {/* Company Name + Industry + Enriched Badge */}
                    <div className="w-[220px] shrink-0 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-medium text-gray-900 truncate">{company.rawName}</span>
                        {isEnriched && (
                          <span
                            className="shrink-0 text-[8px] font-bold uppercase tracking-wider px-1.5 py-px rounded-full"
                            style={{ background: 'rgba(16,185,129,0.1)', color: '#059669', border: '1px solid rgba(16,185,129,0.2)' }}
                          >
                            AI
                          </span>
                        )}
                      </div>
                      {company.industry && (
                        <span
                          className="inline-block mt-0.5 text-[10px] px-1.5 py-0.5 rounded"
                          style={{ background: 'rgba(212,175,55,0.08)', color: gold }}
                        >
                          {company.industry}
                        </span>
                      )}
                      {isEnriched && company.researchCard && (
                        <div className="mt-0.5 flex items-center gap-1.5 flex-wrap">
                          {company.researchCard.revenue && company.researchCard.revenue !== 'Not found' && company.researchCard.revenue !== 'Unknown' && (
                            <span className="text-[9px]" style={{ color: textMuted }}>
                              {company.researchCard.revenue}
                            </span>
                          )}
                          {company.researchCard.employeeCount && company.researchCard.employeeCount !== 'Not found' && company.researchCard.employeeCount !== 'Unknown' && (
                            <span className="text-[9px]" style={{ color: '#9CA3AF' }}>
                              · {company.researchCard.employeeCount} emp
                            </span>
                          )}
                          {company.researchCard.fundingStage && company.researchCard.fundingStage !== 'Not found' && company.researchCard.fundingStage !== 'Unknown' && (
                            <span className="text-[9px]" style={{ color: '#9CA3AF' }}>
                              · {company.researchCard.fundingStage}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Domain */}
                    <div className="w-[130px] shrink-0 hidden lg:block">
                      {company.domain ? (
                        <span className="text-xs truncate block" style={{ color: textMuted }}>{company.domain}</span>
                      ) : (
                        <span className="text-xs" style={{ color: 'rgba(122,134,153,0.4)' }}>—</span>
                      )}
                    </div>

                    {/* Country */}
                    <div className="w-[60px] shrink-0 hidden md:block">
                      {company.country ? (
                        <span className="text-xs font-medium" style={{ color: '#6B7280' }}>{company.country}</span>
                      ) : (
                        <span className="text-xs" style={{ color: 'rgba(122,134,153,0.4)' }}>—</span>
                      )}
                    </div>

                    {/* Size */}
                    <div className="w-[100px] shrink-0 hidden md:block">
                      {company.sizeRange ? (
                        <span className="text-xs" style={{ color: textMuted }}>{company.sizeRange}</span>
                      ) : (
                        <span className="text-xs" style={{ color: 'rgba(122,134,153,0.4)' }}>—</span>
                      )}
                    </div>

                    {/* Contacts */}
                    <div className="w-[56px] shrink-0 flex justify-center">
                      {cc > 0 ? (
                        <span
                          className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                          style={{ background: 'rgba(96,165,250,0.12)', color: '#2563EB' }}
                        >
                          {cc}
                        </span>
                      ) : (
                        <span className="text-xs" style={{ color: 'rgba(122,134,153,0.4)' }}>0</span>
                      )}
                    </div>

                    {/* Intelligence Score */}
                    <div className="w-[120px] shrink-0 hidden sm:block">
                      <ScoreBar score={company.intelligenceScore} />
                    </div>

                    {/* Status */}
                    <div className="w-[90px] shrink-0">
                      <span
                        className="inline-block text-[10px] font-medium px-2 py-0.5 rounded-full"
                        style={{ background: sc.bg, color: sc.text }}
                      >
                        {statusLabel(company.status)}
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="w-8 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <ActionMenu companyId={company.id} navigateTo={navigateTo} />
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          )}
        </div>

        {/* ═══ Pagination ═══ */}
        {!loading && companies.length > 0 && totalPages > 1 && (
          <div
            className="flex items-center justify-between px-4 py-2.5 border-t"
            style={{ borderColor: border }}
          >
            <span className="text-[11px]" style={{ color: textMuted }}>
              {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}
            </span>
            <div className="flex items-center gap-1">
              <button
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="p-1.5 rounded-md transition-colors disabled:opacity-30 hover:bg-gray-100"
              >
                <ChevronLeft size={14} style={{ color: textMuted }} />
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let p: number;
                if (totalPages <= 5) {
                  p = i + 1;
                } else if (page <= 3) {
                  p = i + 1;
                } else if (page >= totalPages - 2) {
                  p = totalPages - 4 + i;
                } else {
                  p = page - 2 + i;
                }
                return (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className="w-7 h-7 rounded-md text-xs font-medium transition-colors"
                    style={{
                      background: p === page ? `${gold}18` : 'transparent',
                      color: p === page ? gold : textMuted,
                    }}
                  >
                    {p}
                  </button>
                );
              })}
              <button
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
                className="p-1.5 rounded-md transition-colors disabled:opacity-30 hover:bg-gray-100"
              >
                <ChevronRight size={14} style={{ color: textMuted }} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ═══ Add Company Dialog ═══ */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Add New Company</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">Create a new company record. Name is required; other fields are optional.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3.5 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Company Name <span className="text-red-500">*</span></Label>
              <Input
                placeholder="e.g. Acme Corp"
                value={addForm.rawName}
                onChange={e => setAddForm(f => ({ ...f, rawName: e.target.value }))}
                className="h-9 text-sm"
                autoFocus
                onKeyDown={e => { if (e.key === 'Enter') handleAddCompany(); }}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Domain</Label>
                <Input
                  placeholder="acme.com"
                  value={addForm.domain}
                  onChange={e => setAddForm(f => ({ ...f, domain: e.target.value }))}
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Website</Label>
                <Input
                  placeholder="https://acme.com"
                  value={addForm.website}
                  onChange={e => setAddForm(f => ({ ...f, website: e.target.value }))}
                  className="h-9 text-sm"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Industry</Label>
              <Input
                placeholder="e.g. Technology, Healthcare"
                value={addForm.industry}
                onChange={e => setAddForm(f => ({ ...f, industry: e.target.value }))}
                className="h-9 text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Size Range</Label>
                <Input
                  placeholder="e.g. 51-200"
                  value={addForm.sizeRange}
                  onChange={e => setAddForm(f => ({ ...f, sizeRange: e.target.value }))}
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Country</Label>
                <Input
                  placeholder="e.g. US, IN"
                  value={addForm.country}
                  onChange={e => setAddForm(f => ({ ...f, country: e.target.value }))}
                  className="h-9 text-sm"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Location</Label>
              <Input
                placeholder="e.g. San Francisco, CA"
                value={addForm.location}
                onChange={e => setAddForm(f => ({ ...f, location: e.target.value }))}
                className="h-9 text-sm"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 pt-2">
            <Button variant="outline" size="sm" className="text-xs" onClick={() => setShowAddDialog(false)}>Cancel</Button>
            <Button
              size="sm"
              className="text-xs font-medium"
              style={{ background: gold, color: '#0c1220' }}
              disabled={addSubmitting || !addForm.rawName.trim()}
              onClick={handleAddCompany}
            >
              {addSubmitting ? <Loader2 size={14} className="mr-1.5 animate-spin" /> : <Plus size={14} className="mr-1.5" />}
              {addSubmitting ? 'Creating...' : 'Add Company'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageTransition>
  );
}