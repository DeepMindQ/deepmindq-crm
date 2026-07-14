'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import {
  Building2,
  Globe,
  MapPin,
  Users,
  Search,
  Plus,
  Grid3X3,
  List,
  ArrowUpDown,
  Filter,
  GitCompare,
  X,
  ExternalLink,
  Brain,
  Bell,
  FileText,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Activity,
  Loader2,
  Eye,
  Tag,
  Briefcase,
  Hash,
} from 'lucide-react';
import {
  PageTransition,
  StatCard,
  GlassPanel,
  EmptyState,
  StaggerGrid,
  StaggerItem,
  SectionHeader,
  AnimatedCounter,
} from '@/components/ui/animated-components';

/* ═══════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════ */

interface CompanyCounts {
  contacts: number;
  notes: number;
  signals: number;
}

interface Company {
  id: string;
  rawName: string;
  domain: string | null;
  industry: string | null;
  sizeRange: string | null;
  location: string | null;
  country: string | null;
  website: string | null;
  internalSummary: string | null;
  tags: string;
  status: string;
  lifecycleStage: string | null;
  assignedTo: string | null;
  intelligenceScore: number | null;
  engagementScore: number | null;
  lastEnrichedAt: string | null;
  lastActivityAt: string | null;
  source: string | null;
  createdAt: string;
  _count: CompanyCounts;
  researchCard?: Record<string, unknown> | null;
}

interface CompaniesResponse {
  companies: Company[];
  total: number;
  page: number;
  limit: number;
}

interface CompanyStats {
  total: number;
  enriched: number;
  active: number;
  avgIntelligenceScore: number;
}

interface CompareData {
  companies: Company[];
  fields: { key: string; label: string; values: (string | number | null)[] }[];
}

interface CompaniesScreenProps {
  navigateTo?: (screen: string) => void;
}

/* ═══════════════════════════════════════════════════════════════
   Constants
   ═══════════════════════════════════════════════════════════════ */

const GOLD = '#D4AF37';
const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  prospect: { bg: 'rgba(59,130,246,0.12)', text: '#60a5fa', border: 'rgba(59,130,246,0.25)' },
  researching: { bg: 'rgba(245,158,11,0.12)', text: '#fbbf24', border: 'rgba(245,158,11,0.25)' },
  active: { bg: 'rgba(16,185,129,0.12)', text: '#34d399', border: 'rgba(16,185,129,0.25)' },
  engaged: { bg: 'rgba(139,92,246,0.12)', text: '#a78bfa', border: 'rgba(139,92,246,0.25)' },
  paused: { bg: 'rgba(161,161,170,0.12)', text: '#a1a1aa', border: 'rgba(161,161,170,0.25)' },
  closed_won: { bg: 'rgba(34,197,94,0.12)', text: '#4ade80', border: 'rgba(34,197,94,0.25)' },
  closed_lost: { bg: 'rgba(239,68,68,0.12)', text: '#f87171', border: 'rgba(239,68,68,0.25)' },
};

const INDUSTRIES = [
  'Technology',
  'Financial Services',
  'Healthcare',
  'Manufacturing',
  'Retail & E-Commerce',
  'Education',
  'Real Estate',
  'Energy & Utilities',
  'Media & Entertainment',
  'Transportation & Logistics',
  'Professional Services',
  'Telecommunications',
  'Agriculture',
  'Government & Public Sector',
  'Non-Profit',
  'Other',
];

const SIZE_RANGES = [
  '1-10',
  '11-50',
  '51-200',
  '201-500',
  '501-1000',
  '1001-5000',
  '5001-10000',
  '10000+',
];

const STATUS_OPTIONS = [
  { value: 'prospect', label: 'Prospect' },
  { value: 'researching', label: 'Researching' },
  { value: 'active', label: 'Active' },
  { value: 'engaged', label: 'Engaged' },
  { value: 'paused', label: 'Paused' },
  { value: 'closed_won', label: 'Closed Won' },
  { value: 'closed_lost', label: 'Closed Lost' },
];

const SORT_OPTIONS = [
  { value: 'name', label: 'Name' },
  { value: 'contacts', label: 'Contacts' },
  { value: 'intelligenceScore', label: 'Intelligence Score' },
  { value: 'lastActivityAt', label: 'Last Activity' },
  { value: 'createdAt', label: 'Updated' },
];

const PAGE_SIZE = 12;

/* ═══════════════════════════════════════════════════════════════
   Helper: parse tags from JSON string
   ═══════════════════════════════════════════════════════════════ */
function parseTags(tagsStr: string | null | undefined): string[] {
  if (!tagsStr) return [];
  try {
    const parsed = JSON.parse(tagsStr);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return tagsStr.split(',').map((t) => t.trim()).filter(Boolean);
  }
}

/* ═══════════════════════════════════════════════════════════════
   Helper: format date
   ═══════════════════════════════════════════════════════════════ */
function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/* ═══════════════════════════════════════════════════════════════
   Score Ring Component
   ═══════════════════════════════════════════════════════════════ */
function ScoreRing({ score, label, color }: { score: number | null; label: string; color: string }) {
  const val = score ?? 0;
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (val / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-11 h-11">
        <svg className="w-11 h-11 -rotate-90" viewBox="0 0 44 44">
          <circle cx="22" cy="22" r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3" />
          <motion.circle
            cx="22"
            cy="22"
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset }}
            transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold" style={{ color }}>
          {val}
        </span>
      </div>
      <span className="text-[10px] text-muted-foreground leading-none">{label}</span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Main Component
   ═══════════════════════════════════════════════════════════════ */
export default function CompaniesScreen({ navigateTo }: CompaniesScreenProps) {
  /* ── State: data ── */
  const [companies, setCompanies] = useState<Company[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<CompanyStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingStats, setLoadingStats] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* ── State: filters & sort ── */
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [industryFilter, setIndustryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sizeFilter, setSizeFilter] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);

  /* ── State: view ── */
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  /* ── State: selection ── */
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  /* ── State: dialogs ── */
  const [detailCompany, setDetailCompany] = useState<Company | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showCompareDialog, setShowCompareDialog] = useState(false);
  const [compareData, setCompareData] = useState<CompareData | null>(null);
  const [loadingCompare, setLoadingCompare] = useState(false);

  /* ── State: create form ── */
  const [createForm, setCreateForm] = useState({
    rawName: '',
    domain: '',
    industry: '',
    sizeRange: '',
    location: '',
    country: '',
    website: '',
  });
  const [creating, setCreating] = useState(false);

  /* ── State: status update ── */
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);

  /* ── Refs ── */
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  /* ═══════════════════════════════════════════════════════════
     Debounced Search
     ═══════════════════════════════════════════════════════════ */
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(searchInput);
      setPage(1);
    }, 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchInput]);

  /* ═══════════════════════════════════════════════════════════
     Fetch Companies
     ═══════════════════════════════════════════════════════════ */
  const fetchCompanies = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (industryFilter) params.set('industry', industryFilter);
      if (statusFilter) params.set('status', statusFilter);
      if (sizeFilter) params.set('sizeRange', sizeFilter);
      if (sortBy) params.set('sortBy', sortBy);
      if (sortDir) params.set('sortDir', sortDir);
      params.set('page', String(page));
      params.set('limit', String(PAGE_SIZE));

      const res = await fetch(`/api/companies?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch companies');
      const data: CompaniesResponse = await res.json();
      setCompanies(data.companies || []);
      setTotal(data.total || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setCompanies([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, industryFilter, statusFilter, sizeFilter, sortBy, sortDir, page]);

  useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies]);

  /* ═══════════════════════════════════════════════════════════
     Fetch Stats
     ═══════════════════════════════════════════════════════════ */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingStats(true);
      try {
        const res = await fetch('/api/companies/stats');
        if (!res.ok) throw new Error('Failed to fetch stats');
        const data = await res.json();
        if (!cancelled) setStats(data);
      } catch {
        /* stats are non-critical */
      } finally {
        if (!cancelled) setLoadingStats(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  /* ═══════════════════════════════════════════════════════════
     Selection handlers
     ═══════════════════════════════════════════════════════════ */
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < 3) next.add(id);
      else toast.info('You can compare up to 3 companies at a time');
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === companies.length && companies.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(companies.slice(0, 3).map((c) => c.id)));
    }
  };

  /* ═══════════════════════════════════════════════════════════
     Filter change handlers — reset to page 1
     ═══════════════════════════════════════════════════════════ */
  const handleIndustryChange = (val: string) => { setIndustryFilter(val); setPage(1); };
  const handleStatusChange = (val: string) => { setStatusFilter(val); setPage(1); };
  const handleSizeChange = (val: string) => { setSizeFilter(val); setPage(1); };
  const handleSortChange = (val: string) => { setSortBy(val); setPage(1); };
  const handleSortDirToggle = () => { setSortDir((d) => (d === 'asc' ? 'desc' : 'asc')); setPage(1); };

  const hasActiveFilters = !!(debouncedSearch || industryFilter || statusFilter || sizeFilter);
  const clearFilters = () => {
    setSearchInput('');
    setDebouncedSearch('');
    setIndustryFilter('');
    setStatusFilter('');
    setSizeFilter('');
    setPage(1);
  };

  /* ═══════════════════════════════════════════════════════════
     Pagination
     ═══════════════════════════════════════════════════════════ */
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const showingFrom = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const showingTo = Math.min(page * PAGE_SIZE, total);

  /* ═══════════════════════════════════════════════════════════
     Create Company
     ═══════════════════════════════════════════════════════════ */
  const handleCreateCompany = async () => {
    if (!createForm.rawName.trim()) {
      toast.error('Company name is required');
      return;
    }
    setCreating(true);
    try {
      const res = await fetch('/api/companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...createForm,
          domain: createForm.domain || undefined,
          industry: createForm.industry || undefined,
          sizeRange: createForm.sizeRange || undefined,
          location: createForm.location || undefined,
          country: createForm.country || undefined,
          website: createForm.website || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to create company');
      }
      toast.success('Company created successfully');
      setShowCreateDialog(false);
      setCreateForm({ rawName: '', domain: '', industry: '', sizeRange: '', location: '', country: '', website: '' });
      fetchCompanies();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create company');
    } finally {
      setCreating(false);
    }
  };

  /* ═══════════════════════════════════════════════════════════
     Status Update
     ═══════════════════════════════════════════════════════════ */
  const handleStatusUpdate = async (companyId: string, newStatus: string) => {
    setUpdatingStatusId(companyId);
    try {
      const res = await fetch('/api/companies/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'updateStatus', companyIds: [companyId], status: newStatus }),
      });
      if (!res.ok) throw new Error('Failed to update status');
      toast.success('Status updated');
      fetchCompanies();
      if (detailCompany?.id === companyId) {
        setDetailCompany((prev) => prev ? { ...prev, status: newStatus } : null);
      }
    } catch {
      toast.error('Failed to update status');
    } finally {
      setUpdatingStatusId(null);
    }
  };

  /* ═══════════════════════════════════════════════════════════
     Compare
     ═══════════════════════════════════════════════════════════ */
  const handleCompare = async () => {
    if (selectedIds.size < 2) {
      toast.info('Select at least 2 companies to compare');
      return;
    }
    setLoadingCompare(true);
    setShowCompareDialog(true);
    try {
      const res = await fetch('/api/companies/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyIds: Array.from(selectedIds) }),
      });
      if (!res.ok) throw new Error('Failed to fetch comparison data');
      const data = await res.json();
      setCompareData(data);
    } catch {
      toast.error('Failed to load comparison data');
      setShowCompareDialog(false);
    } finally {
      setLoadingCompare(false);
    }
  };

  /* ═══════════════════════════════════════════════════════════
     Comparison fields builder
     ═══════════════════════════════════════════════════════════ */
  const buildCompareFields = useCallback(
    (compareCompanies: Company[]): CompareData['fields'] => {
      const pick = (c: Company, field: keyof Company) => {
        const v = c[field];
        if (v === null || v === undefined) return '—';
        if (typeof v === 'number') return v;
        return String(v);
      };

      return [
        { key: 'industry', label: 'Industry', values: compareCompanies.map((c) => pick(c, 'industry')) },
        { key: 'sizeRange', label: 'Size', values: compareCompanies.map((c) => pick(c, 'sizeRange')) },
        { key: 'location', label: 'Location', values: compareCompanies.map((c) => pick(c, 'location')) },
        { key: 'country', label: 'Country', values: compareCompanies.map((c) => pick(c, 'country')) },
        { key: 'status', label: 'Status', values: compareCompanies.map((c) => pick(c, 'status')) },
        {
          key: 'intelligenceScore',
          label: 'Intelligence Score',
          values: compareCompanies.map((c) => c.intelligenceScore ?? '—'),
        },
        {
          key: 'engagementScore',
          label: 'Engagement Score',
          values: compareCompanies.map((c) => c.engagementScore ?? '—'),
        },
        {
          key: 'contacts',
          label: 'Contacts',
          values: compareCompanies.map((c) => c._count?.contacts ?? 0),
        },
        {
          key: 'notes',
          label: 'Notes',
          values: compareCompanies.map((c) => c._count?.notes ?? 0),
        },
        {
          key: 'signals',
          label: 'Signals',
          values: compareCompanies.map((c) => c._count?.signals ?? 0),
        },
        {
          key: 'tags',
          label: 'Tags',
          values: compareCompanies.map((c) => {
            const tags = parseTags(c.tags);
            return tags.length > 0 ? tags.join(', ') : '—';
          }),
        },
      ];
    },
    [],
  );

  /* ═══════════════════════════════════════════════════════════
     Comparison companies (from API or local selection)
     ═══════════════════════════════════════════════════════════ */
  const compareCompanies = useMemo(() => {
    if (compareData?.companies) return compareData.companies;
    return companies.filter((c) => selectedIds.has(c.id));
  }, [compareData, companies, selectedIds]);

  const compareFields = useMemo(
    () => buildCompareFields(compareCompanies),
    [compareCompanies, buildCompareFields],
  );

  /* ═══════════════════════════════════════════════════════════
     Render helpers: determine if a value is different from others
     ═══════════════════════════════════════════════════════════ */
  const isDifferent = (values: (string | number | null)[], index: number) => {
    const current = values[index];
    return values.some((v, i) => i !== index && v !== current);
  };

  /* ═══════════════════════════════════════════════════════════
     Skeleton loaders
     ═══════════════════════════════════════════════════════════ */
  const SkeletonGrid = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-56 rounded-xl" />
      ))}
    </div>
  );

  const SkeletonList = () => (
    <div className="space-y-2">
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={i} className="h-14 w-full rounded-lg" />
      ))}
    </div>
  );

  /* ═══════════════════════════════════════════════════════════
     Render: Company Grid Card
     ═══════════════════════════════════════════════════════════ */
  const renderCompanyCard = (company: Company) => {
    const tags = parseTags(company.tags);
    const statusStyle = STATUS_COLORS[company.status] || STATUS_COLORS.prospect;
    const isSelected = selectedIds.has(company.id);

    return (
      <StaggerItem key={company.id}>
        <motion.div
          className="rounded-xl cursor-pointer relative group/card"
          whileHover={{ y: -6, transition: { duration: 0.25, ease: [0.22, 1, 0.36, 1] } }}
          onClick={() => setDetailCompany(company)}
        >
          {/* Outer glow on hover */}
          <div
            className="absolute -inset-[2px] rounded-xl opacity-0 group-hover/card:opacity-100 transition-all duration-500 blur-md"
            style={{
              background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.35), rgba(212, 175, 55, 0.08), rgba(59, 130, 246, 0.12), transparent 70%)',
            }}
          />
          {/* Gradient border */}
          <div
            className="relative rounded-xl p-[1px] transition-all duration-300"
            style={{
              background: isSelected
                ? `linear-gradient(135deg, ${GOLD}90, ${GOLD}40, transparent 70%)`
                : 'linear-gradient(135deg, rgba(212, 175, 55, 0.2), rgba(212, 175, 55, 0.05) 40%, rgba(59, 130, 246, 0.08) 80%, transparent)',
            }}
          >
            <div className="rounded-xl bg-card p-5 transition-all duration-300 group-hover/card:bg-card/95">
              {/* Header row */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  {/* Checkbox */}
                  <div
                    className="shrink-0 mt-0.5"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleSelect(company.id)}
                      className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                    />
                  </div>
                  {/* Icon + Name */}
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 transition-all duration-300"
                    style={{
                      background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.15), rgba(212, 175, 55, 0.05))',
                      boxShadow: 'inset 0 1px 0 rgba(212, 175, 55, 0.1)',
                    }}
                  >
                    <Building2 className="w-5 h-5" style={{ color: GOLD }} />
                  </div>
                  <div className="min-w-0">
                    <p
                      className="text-sm font-semibold text-foreground truncate group-hover/card:text-primary transition-colors duration-200"
                    >
                      {company.rawName}
                    </p>
                    {company.domain && (
                      <a
                        href={company.website || `https://${company.domain}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-muted-foreground flex items-center gap-1.5 mt-1 hover:text-primary transition-colors"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Globe className="w-3 h-3" />
                        {company.domain}
                        <ExternalLink className="w-2.5 h-2.5 opacity-50" />
                      </a>
                    )}
                  </div>
                </div>
                {/* Status badge */}
                <Badge
                  variant="outline"
                  className="shrink-0 text-[10px] font-semibold px-2 py-0.5"
                  style={{
                    background: statusStyle.bg,
                    color: statusStyle.text,
                    borderColor: statusStyle.border,
                  }}
                >
                  {company.status.replace('_', ' ')}
                </Badge>
              </div>

              {/* Tags */}
              {tags.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {tags.slice(0, 4).map((tag, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium"
                      style={{
                        background: 'rgba(212, 175, 55, 0.08)',
                        color: GOLD,
                        border: '1px solid rgba(212, 175, 55, 0.15)',
                      }}
                    >
                      <Tag className="w-2.5 h-2.5" />
                      {tag}
                    </span>
                  ))}
                  {tags.length > 4 && (
                    <span className="text-[10px] text-muted-foreground px-1 py-0.5">
                      +{tags.length - 4}
                    </span>
                  )}
                </div>
              )}

              {/* Meta row */}
              <div className="mt-4 flex flex-wrap gap-x-3 gap-y-2 text-xs text-muted-foreground">
                {company.industry && (
                  <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/[0.03] border border-white/[0.05]">
                    <Briefcase className="w-3 h-3" style={{ color: `${GOLD}99` }} />
                    {company.industry}
                  </span>
                )}
                {company.sizeRange && (
                  <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/[0.03] border border-white/[0.05]">
                    <Users className="w-3 h-3" style={{ color: `${GOLD}99` }} />
                    {company.sizeRange}
                  </span>
                )}
                {(company.location || company.country) && (
                  <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/[0.03] border border-white/[0.05]">
                    <MapPin className="w-3 h-3" style={{ color: `${GOLD}99` }} />
                    {company.location || company.country}
                  </span>
                )}
              </div>

              {/* Scores */}
              <div className="mt-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <ScoreRing score={company.intelligenceScore} label="IQ" color={GOLD} />
                  <ScoreRing score={company.engagementScore} label="Engage" color="#a78bfa" />
                </div>
              </div>

              {/* Footer stats */}
              <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-center justify-between text-xs text-muted-foreground">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    {company._count?.contacts ?? 0}
                  </span>
                  <span className="flex items-center gap-1">
                    <FileText className="w-3 h-3" />
                    {company._count?.notes ?? 0}
                  </span>
                  <span className="flex items-center gap-1">
                    <Bell className="w-3 h-3" />
                    {company._count?.signals ?? 0}
                  </span>
                </div>
                {company._count && company._count.signals > 0 && (
                  <span
                    className="flex items-center gap-1 text-[10px] font-medium"
                    style={{ color: GOLD }}
                  >
                    <Sparkles className="w-3 h-3" />
                    New signals
                  </span>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      </StaggerItem>
    );
  };

  /* ═══════════════════════════════════════════════════════════
     Render: Company List Row
     ═══════════════════════════════════════════════════════════ */
  const renderCompanyRow = (company: Company) => {
    const statusStyle = STATUS_COLORS[company.status] || STATUS_COLORS.prospect;
    const isSelected = selectedIds.has(company.id);
    const tags = parseTags(company.tags);

    return (
      <motion.div
        key={company.id}
        className="flex items-center gap-4 px-4 py-3 rounded-lg bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.05] cursor-pointer transition-all duration-200 group/row"
        whileHover={{ x: 2 }}
        onClick={() => setDetailCompany(company)}
      >
        {/* Checkbox */}
        <div onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={isSelected}
            onCheckedChange={() => toggleSelect(company.id)}
            className="data-[state=checked]:bg-primary data-[state=checked]:border-primary shrink-0"
          />
        </div>

        {/* Company icon + name */}
        <div className="flex items-center gap-3 min-w-0 w-[200px] shrink-0">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: 'rgba(212, 175, 55, 0.1)' }}
          >
            <Building2 className="w-4 h-4" style={{ color: GOLD }} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground truncate group-hover/row:text-primary transition-colors">
              {company.rawName}
            </p>
            {company.domain && (
              <p className="text-[11px] text-muted-foreground truncate">{company.domain}</p>
            )}
          </div>
        </div>

        {/* Industry */}
        <div className="w-[120px] shrink-0 hidden md:block">
          <span className="text-xs text-muted-foreground truncate block">{company.industry || '—'}</span>
        </div>

        {/* Status */}
        <div className="w-[100px] shrink-0 hidden lg:block">
          <Badge
            variant="outline"
            className="text-[10px] font-semibold px-2 py-0.5"
            style={{ background: statusStyle.bg, color: statusStyle.text, borderColor: statusStyle.border }}
          >
            {company.status.replace('_', ' ')}
          </Badge>
        </div>

        {/* Size */}
        <div className="w-[90px] shrink-0 hidden md:block">
          <span className="text-xs text-muted-foreground">{company.sizeRange || '—'}</span>
        </div>

        {/* Location */}
        <div className="w-[100px] shrink-0 hidden xl:block">
          <span className="text-xs text-muted-foreground truncate block">
            {company.location || company.country || '—'}
          </span>
        </div>

        {/* IQ Score */}
        <div className="w-[60px] shrink-0 hidden lg:flex items-center justify-center">
          <span className="text-xs font-semibold" style={{ color: company.intelligenceScore ? GOLD : 'rgba(255,255,255,0.3)' }}>
            {company.intelligenceScore ?? '—'}
          </span>
        </div>

        {/* Engagement Score */}
        <div className="w-[60px] shrink-0 hidden lg:flex items-center justify-center">
          <span className="text-xs font-semibold" style={{ color: company.engagementScore ? '#a78bfa' : 'rgba(255,255,255,0.3)' }}>
            {company.engagementScore ?? '—'}
          </span>
        </div>

        {/* Counts */}
        <div className="flex items-center gap-3 shrink-0 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><Users className="w-3 h-3" />{company._count?.contacts ?? 0}</span>
          <span className="flex items-center gap-1"><FileText className="w-3 h-3" />{company._count?.notes ?? 0}</span>
          <span className="flex items-center gap-1"><Bell className="w-3 h-3" />{company._count?.signals ?? 0}</span>
        </div>

        {/* Tags preview */}
        <div className="hidden xl:flex items-center gap-1 w-[120px] shrink-0">
          {tags.slice(0, 2).map((tag, i) => (
            <span
              key={i}
              className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium truncate max-w-[55px]"
              style={{ background: 'rgba(212,175,55,0.08)', color: GOLD }}
            >
              {tag}
            </span>
          ))}
          {tags.length > 2 && <span className="text-[9px] text-muted-foreground">+{tags.length - 2}</span>}
        </div>

        {/* View button */}
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 shrink-0 opacity-0 group-hover/row:opacity-100 transition-opacity"
          onClick={(e) => { e.stopPropagation(); setDetailCompany(company); }}
        >
          <Eye className="w-3.5 h-3.5" />
        </Button>
      </motion.div>
    );
  };

  /* ═══════════════════════════════════════════════════════════
     Render: Pagination
     ═══════════════════════════════════════════════════════════ */
  const renderPagination = () => {
    if (total <= PAGE_SIZE) return null;
    return (
      <div className="flex items-center justify-between pt-4">
        <p className="text-xs text-muted-foreground">
          Showing <span className="font-medium text-foreground">{showingFrom}</span>–<span className="font-medium text-foreground">{showingTo}</span> of <span className="font-medium text-foreground">{total}</span> companies
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-3 text-xs border-white/[0.1] hover:border-primary/30 hover:text-primary"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft className="w-3.5 h-3.5 mr-1" />
            Previous
          </Button>
          {/* Page numbers */}
          <div className="hidden sm:flex items-center gap-1">
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum: number;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (page <= 3) {
                pageNum = i + 1;
              } else if (page >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = page - 2 + i;
              }
              return (
                <button
                  key={pageNum}
                  className="w-8 h-8 rounded-md text-xs font-medium transition-colors flex items-center justify-center"
                  style={{
                    background: pageNum === page ? 'rgba(212, 175, 55, 0.15)' : 'transparent',
                    color: pageNum === page ? GOLD : 'rgba(255,255,255,0.5)',
                    border: pageNum === page ? '1px solid rgba(212, 175, 55, 0.3)' : '1px solid transparent',
                  }}
                  onClick={() => setPage(pageNum)}
                >
                  {pageNum}
                </button>
              );
            })}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-3 text-xs border-white/[0.1] hover:border-primary/30 hover:text-primary"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Next
            <ChevronRight className="w-3.5 h-3.5 ml-1" />
          </Button>
        </div>
      </div>
    );
  };

  /* ═══════════════════════════════════════════════════════════
     Render: List header (for list view)
     ═══════════════════════════════════════════════════════════ */
  const renderListHeader = () => (
    <div className="flex items-center gap-4 px-4 py-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider border-b border-white/[0.06] mb-2">
      <div className="w-5 shrink-0" />
      <div className="w-[200px] shrink-0">Company</div>
      <div className="w-[120px] shrink-0 hidden md:block">Industry</div>
      <div className="w-[100px] shrink-0 hidden lg:block">Status</div>
      <div className="w-[90px] shrink-0 hidden md:block">Size</div>
      <div className="w-[100px] shrink-0 hidden xl:block">Location</div>
      <div className="w-[60px] shrink-0 hidden lg:flex items-center justify-center">IQ</div>
      <div className="w-[60px] shrink-0 hidden lg:flex items-center justify-center">Engage</div>
      <div className="shrink-0">Stats</div>
      <div className="w-[120px] shrink-0 hidden xl:block">Tags</div>
      <div className="w-7 shrink-0" />
    </div>
  );

  /* ═══════════════════════════════════════════════════════════
     MAIN RENDER
     ═══════════════════════════════════════════════════════════ */
  return (
    <PageTransition>
      <div className="max-h-[calc(100vh-200px)] overflow-y-auto space-y-6 pr-1 pb-8">

        {/* ── Stats Row ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Total Companies"
            value={loadingStats ? '-' : (stats?.total ?? 0)}
            icon={Building2}
            color={GOLD}
            delay={0}
          />
          <StatCard
            label="Enriched"
            value={loadingStats ? '-' : (stats?.enriched ?? 0)}
            icon={Sparkles}
            color="#60a5fa"
            delay={0.08}
          />
          <StatCard
            label="Active"
            value={loadingStats ? '-' : (stats?.active ?? 0)}
            icon={Activity}
            color="#34d399"
            delay={0.16}
          />
          <StatCard
            label="Avg Intelligence"
            value={loadingStats ? '-' : (stats?.avgIntelligenceScore ?? 0)}
            icon={Brain}
            color="#a78bfa"
            delay={0.24}
          />
        </div>

        {/* ── Toolbar ── */}
        <GlassPanel className="p-4">
          <div className="flex flex-col gap-4">
            {/* Top row: Search + Actions */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search companies by name, domain, or industry..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="pl-10 h-9 text-sm bg-white/[0.03] border-white/[0.08] focus-visible:border-primary/30 focus-visible:ring-primary/10"
                />
                {searchInput && (
                  <button
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => setSearchInput('')}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2 shrink-0">
                {/* Compare button */}
                {selectedIds.size >= 2 && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                  >
                    <Button
                      size="sm"
                      className="h-9 gap-1.5 text-xs font-semibold"
                      style={{ background: GOLD, color: '#000' }}
                      onClick={handleCompare}
                    >
                      <GitCompare className="w-3.5 h-3.5" />
                      Compare ({selectedIds.size})
                    </Button>
                  </motion.div>
                )}

                {/* Add Company */}
                <Button
                  size="sm"
                  variant="outline"
                  className="h-9 gap-1.5 text-xs border-primary/25 text-primary hover:bg-primary/10"
                  onClick={() => setShowCreateDialog(true)}
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Company
                </Button>

                {/* View Toggle */}
                <div className="flex items-center rounded-lg border border-white/[0.1] overflow-hidden">
                  <button
                    className="p-2 transition-colors"
                    style={{
                      background: viewMode === 'grid' ? 'rgba(212, 175, 55, 0.12)' : 'transparent',
                      color: viewMode === 'grid' ? GOLD : 'rgba(255,255,255,0.4)',
                    }}
                    onClick={() => setViewMode('grid')}
                  >
                    <Grid3X3 className="w-4 h-4" />
                  </button>
                  <button
                    className="p-2 transition-colors"
                    style={{
                      background: viewMode === 'list' ? 'rgba(212, 175, 55, 0.12)' : 'transparent',
                      color: viewMode === 'list' ? GOLD : 'rgba(255,255,255,0.4)',
                    }}
                    onClick={() => setViewMode('list')}
                  >
                    <List className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Filter row */}
            <div className="flex flex-wrap items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground shrink-0" />

              {/* Industry filter */}
              <Select value={industryFilter} onValueChange={handleIndustryChange}>
                <SelectTrigger size="sm" className="w-[150px] h-8 text-xs bg-white/[0.03] border-white/[0.08]">
                  <SelectValue placeholder="Industry" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all">All Industries</SelectItem>
                  {INDUSTRIES.map((ind) => (
                    <SelectItem key={ind} value={ind}>
                      {ind}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Status filter */}
              <Select value={statusFilter} onValueChange={handleStatusChange}>
                <SelectTrigger size="sm" className="w-[140px] h-8 text-xs bg-white/[0.03] border-white/[0.08]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all">All Statuses</SelectItem>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Size filter */}
              <Select value={sizeFilter} onValueChange={handleSizeChange}>
                <SelectTrigger size="sm" className="w-[130px] h-8 text-xs bg-white/[0.03] border-white/[0.08]">
                  <SelectValue placeholder="Size" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all">All Sizes</SelectItem>
                  {SIZE_RANGES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Sort */}
              <Select value={sortBy} onValueChange={handleSortChange}>
                <SelectTrigger size="sm" className="w-[140px] h-8 text-xs bg-white/[0.03] border-white/[0.08]">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  {SORT_OPTIONS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Sort direction */}
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-2.5 text-xs border-white/[0.08] hover:border-primary/30 hover:text-primary"
                onClick={handleSortDirToggle}
              >
                <ArrowUpDown className="w-3.5 h-3.5 mr-1" />
                {sortDir === 'asc' ? 'ASC' : 'DESC'}
              </Button>

              {/* Clear filters */}
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs text-muted-foreground hover:text-foreground"
                  onClick={clearFilters}
                >
                  <X className="w-3 h-3 mr-1" />
                  Clear
                </Button>
              )}
            </div>
          </div>
        </GlassPanel>

        {/* ── Content Area ── */}
        <div>
          {/* Selection bar */}
          {selectedIds.size > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-3 mb-4 px-4 py-2.5 rounded-lg border border-primary/20"
              style={{ background: 'rgba(212, 175, 55, 0.06)' }}
            >
              <span className="text-xs font-medium" style={{ color: GOLD }}>
                {selectedIds.size} selected
              </span>
              {selectedIds.size < 3 && (
                <span className="text-[11px] text-muted-foreground">
                  — select up to {3 - selectedIds.size} more to compare
                </span>
              )}
              <button
                className="ml-auto text-xs text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setSelectedIds(new Set())}
              >
                Clear selection
              </button>
            </motion.div>
          )}

          {loading ? (
            viewMode === 'grid' ? <SkeletonGrid /> : <SkeletonList />
          ) : error ? (
            <GlassPanel className="p-8 text-center">
              <p className="text-sm text-red-400 mb-2">Failed to load companies</p>
              <p className="text-xs text-muted-foreground mb-4">{error}</p>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs border-primary/25 text-primary hover:bg-primary/10"
                onClick={fetchCompanies}
              >
                Try Again
              </Button>
            </GlassPanel>
          ) : companies.length === 0 ? (
            <EmptyState
              icon={Building2}
              title="No companies found"
              description={
                hasActiveFilters
                  ? 'Try adjusting your filters or search query to find companies.'
                  : 'Get started by adding your first company to the CRM.'
              }
              action={
                !hasActiveFilters ? (
                  <Button
                    size="sm"
                    className="gap-1.5 text-xs font-semibold"
                    style={{ background: GOLD, color: '#000' }}
                    onClick={() => setShowCreateDialog(true)}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Company
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div>
              <SectionHeader
                title="Companies"
                subtitle={`${total} total${hasActiveFilters ? ` (filtered)` : ''}`}
              />

              {viewMode === 'grid' ? (
                <StaggerGrid className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {companies.map(renderCompanyCard)}
                </StaggerGrid>
              ) : (
                <div>
                  {renderListHeader()}
                  <div className="space-y-1.5 max-h-[600px] overflow-y-auto pr-1">
                    {companies.map(renderCompanyRow)}
                  </div>
                </div>
              )}

              {renderPagination()}
            </div>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════
          Company Detail Dialog
          ═══════════════════════════════════════════════════════ */}
      <Dialog open={!!detailCompany} onOpenChange={(open) => !open && setDetailCompany(null)}>
        <DialogContent
          className="bg-card/95 backdrop-blur-xl border border-white/[0.08] text-foreground max-w-2xl max-h-[85vh] overflow-hidden"
        >
          <DialogHeader>
            <DialogTitle className="text-base flex items-center justify-between pr-6">
              <span className="flex items-center gap-2.5">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{
                    background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.2), rgba(212, 175, 55, 0.05))',
                    boxShadow: '0 0 12px rgba(212, 175, 55, 0.1)',
                  }}
                >
                  <Building2 className="w-4 h-4" style={{ color: GOLD }} />
                </div>
                {detailCompany?.rawName}
              </span>
              <div className="flex items-center gap-2">
                {/* Status update dropdown */}
                {detailCompany && (
                  <Select
                    value={detailCompany.status}
                    onValueChange={(val) => handleStatusUpdate(detailCompany.id, val)}
                    disabled={updatingStatusId === detailCompany.id}
                  >
                    <SelectTrigger size="sm" className="w-[130px] h-7 text-xs border-white/[0.1]">
                      {updatingStatusId === detailCompany.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : null}
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 shrink-0 rounded-lg"
                  onClick={() => setDetailCompany(null)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[70vh] pr-2">
            {detailCompany && (
              <div className="space-y-5 pb-4">
                {/* Company Info */}
                <GlassPanel className="p-4">
                  <div className="flex flex-wrap gap-x-5 gap-y-2.5 text-sm text-muted-foreground">
                    {detailCompany.domain && (
                      <span className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-md flex items-center justify-center" style={{ background: 'rgba(212,175,55,0.1)' }}>
                          <Globe className="w-3.5 h-3.5" style={{ color: GOLD }} />
                        </div>
                        {detailCompany.domain}
                      </span>
                    )}
                    {detailCompany.industry && (
                      <span className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-md flex items-center justify-center" style={{ background: 'rgba(212,175,55,0.1)' }}>
                          <Briefcase className="w-3.5 h-3.5" style={{ color: GOLD }} />
                        </div>
                        {detailCompany.industry}
                      </span>
                    )}
                    {detailCompany.sizeRange && (
                      <span className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-md flex items-center justify-center" style={{ background: 'rgba(212,175,55,0.1)' }}>
                          <Users className="w-3.5 h-3.5" style={{ color: GOLD }} />
                        </div>
                        {detailCompany.sizeRange}
                      </span>
                    )}
                    {(detailCompany.location || detailCompany.country) && (
                      <span className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-md flex items-center justify-center" style={{ background: 'rgba(212,175,55,0.1)' }}>
                          <MapPin className="w-3.5 h-3.5" style={{ color: GOLD }} />
                        </div>
                        {detailCompany.location || detailCompany.country}
                      </span>
                    )}
                  </div>
                </GlassPanel>

                {/* Scores */}
                <GlassPanel className="p-4">
                  <div className="flex items-center justify-around">
                    <div className="flex flex-col items-center gap-2">
                      <ScoreRing score={detailCompany.intelligenceScore} label="Intelligence" color={GOLD} />
                      <span className="text-[11px] text-muted-foreground font-medium">Intelligence Score</span>
                    </div>
                    <div className="w-px h-16 bg-white/[0.06]" />
                    <div className="flex flex-col items-center gap-2">
                      <ScoreRing score={detailCompany.engagementScore} label="Engagement" color="#a78bfa" />
                      <span className="text-[11px] text-muted-foreground font-medium">Engagement Score</span>
                    </div>
                  </div>
                </GlassPanel>

                {/* Tags */}
                {parseTags(detailCompany.tags).length > 0 && (
                  <GlassPanel className="p-4">
                    <h4 className="text-sm font-semibold flex items-center gap-2 mb-3">
                      <Tag className="w-3.5 h-3.5" style={{ color: GOLD }} />
                      Tags
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {parseTags(detailCompany.tags).map((tag, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium"
                          style={{
                            background: 'rgba(212, 175, 55, 0.08)',
                            color: GOLD,
                            border: '1px solid rgba(212, 175, 55, 0.15)',
                          }}
                        >
                          <Hash className="w-2.5 h-2.5" />
                          {tag}
                        </span>
                      ))}
                    </div>
                  </GlassPanel>
                )}

                {/* Internal Summary */}
                {detailCompany.internalSummary && (
                  <GlassPanel className="p-4">
                    <h4 className="text-sm font-semibold flex items-center gap-2 mb-3">
                      <FileText className="w-3.5 h-3.5" style={{ color: GOLD }} />
                      Internal Summary
                    </h4>
                    <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">
                      {detailCompany.internalSummary}
                    </p>
                  </GlassPanel>
                )}

                {/* Counts overview */}
                <GlassPanel className="p-4">
                  <h4 className="text-sm font-semibold flex items-center gap-2 mb-3">
                    <Activity className="w-3.5 h-3.5" style={{ color: GOLD }} />
                    Activity Overview
                  </h4>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center p-3 rounded-lg bg-white/[0.02] border border-white/[0.05]">
                      <div className="flex items-center justify-center gap-1.5 mb-1">
                        <Users className="w-4 h-4" style={{ color: GOLD }} />
                        <span className="text-xl font-bold" style={{ color: GOLD }}>
                          {detailCompany._count?.contacts ?? 0}
                        </span>
                      </div>
                      <span className="text-[11px] text-muted-foreground">Contacts</span>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-white/[0.02] border border-white/[0.05]">
                      <div className="flex items-center justify-center gap-1.5 mb-1">
                        <FileText className="w-4 h-4" style={{ color: '#34d399' }} />
                        <span className="text-xl font-bold" style={{ color: '#34d399' }}>
                          {detailCompany._count?.notes ?? 0}
                        </span>
                      </div>
                      <span className="text-[11px] text-muted-foreground">Notes</span>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-white/[0.02] border border-white/[0.05]">
                      <div className="flex items-center justify-center gap-1.5 mb-1">
                        <Bell className="w-4 h-4" style={{ color: '#a78bfa' }} />
                        <span className="text-xl font-bold" style={{ color: '#a78bfa' }}>
                          {detailCompany._count?.signals ?? 0}
                        </span>
                      </div>
                      <span className="text-[11px] text-muted-foreground">Signals</span>
                    </div>
                  </div>
                </GlassPanel>

                {/* Metadata */}
                <GlassPanel className="p-4">
                  <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs text-muted-foreground">
                    <div className="flex justify-between">
                      <span>Source</span>
                      <span className="text-foreground/70 font-medium">{detailCompany.source || '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Lifecycle</span>
                      <span className="text-foreground/70 font-medium">{detailCompany.lifecycleStage || '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Assigned To</span>
                      <span className="text-foreground/70 font-medium">{detailCompany.assignedTo || '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Created</span>
                      <span className="text-foreground/70 font-medium">{formatDate(detailCompany.createdAt)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Last Enriched</span>
                      <span className="text-foreground/70 font-medium">{formatDate(detailCompany.lastEnrichedAt)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Last Activity</span>
                      <span className="text-foreground/70 font-medium">{formatDate(detailCompany.lastActivityAt)}</span>
                    </div>
                  </div>
                </GlassPanel>

                {/* View Full Profile button */}
                <div className="flex justify-center pt-2">
                  <Button
                    className="gap-2 text-sm font-semibold px-6"
                    style={{ background: GOLD, color: '#000' }}
                    onClick={() => {
                      if (navigateTo) navigateTo('companies');
                      toast.info('Full profile view coming soon');
                    }}
                  >
                    <ExternalLink className="w-4 h-4" />
                    View Full Profile
                  </Button>
                </div>
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════════════════
          Create Company Dialog
          ═══════════════════════════════════════════════════════ */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="bg-card/95 backdrop-blur-xl border border-white/[0.08] text-foreground max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2.5">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{
                  background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.2), rgba(212, 175, 55, 0.05))',
                  boxShadow: '0 0 12px rgba(212, 175, 55, 0.1)',
                }}
              >
                <Plus className="w-4 h-4" style={{ color: GOLD }} />
              </div>
              Add New Company
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {/* Name */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Company Name <span style={{ color: '#f87171' }}>*</span>
              </label>
              <Input
                placeholder="e.g. Acme Corp"
                value={createForm.rawName}
                onChange={(e) => setCreateForm((f) => ({ ...f, rawName: e.target.value }))}
                className="h-9 text-sm bg-white/[0.03] border-white/[0.08] focus-visible:border-primary/30"
              />
            </div>

            {/* Domain + Website */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Domain</label>
                <Input
                  placeholder="acme.com"
                  value={createForm.domain}
                  onChange={(e) => setCreateForm((f) => ({ ...f, domain: e.target.value }))}
                  className="h-9 text-sm bg-white/[0.03] border-white/[0.08] focus-visible:border-primary/30"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Website</label>
                <Input
                  placeholder="https://acme.com"
                  value={createForm.website}
                  onChange={(e) => setCreateForm((f) => ({ ...f, website: e.target.value }))}
                  className="h-9 text-sm bg-white/[0.03] border-white/[0.08] focus-visible:border-primary/30"
                />
              </div>
            </div>

            {/* Industry + Size */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Industry</label>
                <Select
                  value={createForm.industry}
                  onValueChange={(val) => setCreateForm((f) => ({ ...f, industry: val === '__none' ? '' : val }))}
                >
                  <SelectTrigger className="h-9 text-sm bg-white/[0.03] border-white/[0.08]">
                    <SelectValue placeholder="Select industry" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">None</SelectItem>
                    {INDUSTRIES.map((ind) => (
                      <SelectItem key={ind} value={ind}>
                        {ind}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Size Range</label>
                <Select
                  value={createForm.sizeRange}
                  onValueChange={(val) => setCreateForm((f) => ({ ...f, sizeRange: val === '__none' ? '' : val }))}
                >
                  <SelectTrigger className="h-9 text-sm bg-white/[0.03] border-white/[0.08]">
                    <SelectValue placeholder="Select size" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">None</SelectItem>
                    {SIZE_RANGES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Location + Country */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Location</label>
                <Input
                  placeholder="San Francisco, CA"
                  value={createForm.location}
                  onChange={(e) => setCreateForm((f) => ({ ...f, location: e.target.value }))}
                  className="h-9 text-sm bg-white/[0.03] border-white/[0.08] focus-visible:border-primary/30"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Country</label>
                <Input
                  placeholder="United States"
                  value={createForm.country}
                  onChange={(e) => setCreateForm((f) => ({ ...f, country: e.target.value }))}
                  className="h-9 text-sm bg-white/[0.03] border-white/[0.08] focus-visible:border-primary/30"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                className="h-9 text-xs border-white/[0.1] hover:border-white/[0.2]"
                onClick={() => setShowCreateDialog(false)}
              >
                Cancel
              </Button>
              <Button
                className="h-9 text-xs font-semibold gap-1.5"
                style={{ background: GOLD, color: '#000' }}
                disabled={creating}
                onClick={handleCreateCompany}
              >
                {creating ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="w-3.5 h-3.5" />
                    Create Company
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════════════════
          Compare Dialog
          ═══════════════════════════════════════════════════════ */}
      <Dialog open={showCompareDialog} onOpenChange={setShowCompareDialog}>
        <DialogContent className="bg-card/95 backdrop-blur-xl border border-white/[0.08] text-foreground max-w-4xl max-h-[85vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2.5">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{
                  background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.2), rgba(212, 175, 55, 0.05))',
                  boxShadow: '0 0 12px rgba(212, 175, 55, 0.1)',
                }}
              >
                <GitCompare className="w-4 h-4" style={{ color: GOLD }} />
              </div>
              Company Comparison
              <span className="text-xs text-muted-foreground font-normal ml-2">
                ({compareCompanies.length} companies)
              </span>
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[70vh] pr-2">
            {loadingCompare ? (
              <div className="space-y-4 py-8">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-48 w-full rounded-xl" />
                ))}
              </div>
            ) : compareCompanies.length < 2 ? (
              <EmptyState
                icon={GitCompare}
                title="Not enough companies"
                description="Select at least 2 companies to compare."
              />
            ) : (
              <div className="pb-4">
                {/* Company headers */}
                <div className="grid gap-4 mb-6" style={{ gridTemplateColumns: `180px repeat(${compareCompanies.length}, 1fr)` }}>
                  <div />
                  {compareCompanies.map((c) => (
                    <div key={c.id} className="text-center">
                      <div className="flex items-center justify-center gap-2 mb-1">
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                          style={{ background: 'rgba(212, 175, 55, 0.12)' }}
                        >
                          <Building2 className="w-4 h-4" style={{ color: GOLD }} />
                        </div>
                        <p className="text-sm font-semibold text-foreground truncate">{c.rawName}</p>
                      </div>
                      {c.domain && (
                        <p className="text-[11px] text-muted-foreground">{c.domain}</p>
                      )}
                    </div>
                  ))}
                </div>

                {/* Comparison rows */}
                <div className="space-y-1">
                  {compareFields.map((field, fieldIdx) => (
                    <motion.div
                      key={field.key}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: fieldIdx * 0.04 }}
                      className="grid gap-4 py-3 px-4 rounded-lg border border-white/[0.04] hover:bg-white/[0.02] transition-colors"
                      style={{ gridTemplateColumns: `180px repeat(${compareCompanies.length}, 1fr)` }}
                    >
                      {/* Label */}
                      <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        {field.label}
                      </div>
                      {/* Values */}
                      {field.values.map((val, valIdx) => {
                        const diff = isDifferent(field.values, valIdx);
                        return (
                          <div
                            key={valIdx}
                            className="flex items-center justify-center text-sm"
                            style={{
                              color: diff ? GOLD : 'rgba(255,255,255,0.7)',
                              fontWeight: diff ? 600 : 400,
                              background: diff ? 'rgba(212, 175, 55, 0.06)' : 'transparent',
                              borderRadius: '6px',
                              padding: '4px 8px',
                            }}
                          >
                            {val}
                          </div>
                        );
                      })}
                    </motion.div>
                  ))}
                </div>
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </PageTransition>
  );
}