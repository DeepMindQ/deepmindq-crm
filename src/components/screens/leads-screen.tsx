'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '@/components/ui/popover';
import {
  Search,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Filter,
  X,
  ExternalLink,
  Building2,
  Mail,
  MapPin,
  Briefcase,
  Globe,
  Users,
  ArrowUpDown,
  SlidersHorizontal,
  Database,
  MailCheck,
  FileEdit,
  Send,
  Sparkles,
  Loader2,
  CheckCircle2,
  Brain,
} from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import {
  PageTransition,
  AnimatedCard,
  SectionHeader,
  StatCard,
  StaggerGrid,
  StaggerItem,
  GlassPanel,
  EmptyState,
  ShimmerText,
} from '@/components/ui/animated-components';

/* ══════════════════════════════ Types ══════════════════════════════ */

interface MetaItem {
  v: string;
  c: number;
}

interface Meta {
  countries: MetaItem[];
  industries: MetaItem[];
  departments: MetaItem[];
  employeeCategories: MetaItem[];
  titles: MetaItem[];
  cities: MetaItem[];
  states: MetaItem[];
  totalRecords: number;
}

interface Lead {
  id: string;
  rawName: string;
  email: string;
  title: string;
  department: string;
  linkedin: string;
  company: string;
  website: string;
  employeeCategory: string;
  employeeNumber: string;
  industry: string;
  city: string;
  state: string;
  country: string;
}

interface LeadsResponse {
  leads: Lead[];
  total: number;
  page: number;
  totalPages: number;
  _source?: string;
}

type SortDir = 'asc' | 'desc';

const SORTABLE_COLUMNS = ['company', 'country', 'city', 'industry', 'title'] as const;
type SortColumn = (typeof SORTABLE_COLUMNS)[number];

const PAGE_SIZE_OPTIONS = [25, 50, 100];

/* ══════════════════════ Multi-Select Dropdown ══════════════════════ */

function MultiSelectDropdown({
  label,
  options,
  selected,
  onChange,
  totalCount,
}: {
  label: string;
  options: MetaItem[];
  selected: string[];
  onChange: (values: string[]) => void;
  totalCount: number;
}) {
  const [open, setOpen] = useState(false);
  const [localSearch, setLocalSearch] = useState('');

  const filtered = localSearch
    ? options.filter((o) => o.v.toLowerCase().includes(localSearch.toLowerCase()))
    : options;

  const toggle = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  const clearThis = () => {
    onChange([]);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-9 gap-1.5 text-xs font-normal border-white/[0.1] bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/[0.15] transition-all duration-200"
        >
          <span className="truncate max-w-[120px]">{label}</span>
          {selected.length > 0 && (
            <Badge className="bg-primary/15 border-primary/25 text-primary text-[10px] h-4 min-w-4 px-1.5 rounded-full font-semibold">
              {selected.length}
            </Badge>
          )}
          <span className="text-muted-foreground text-[10px]">({totalCount})</span>
          <ChevronDown className="w-3 h-3 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-64 p-0 border-white/[0.1] bg-black/60 backdrop-blur-2xl shadow-2xl shadow-black/40"
        align="start"
      >
        <div className="p-2.5 border-b border-white/[0.08]">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder={`Search ${label.toLowerCase()}...`}
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              className="h-7 pl-8 text-xs bg-white/[0.05] border-white/[0.1] text-foreground placeholder:text-muted-foreground/60 focus:border-primary/30"
            />
          </div>
        </div>
        {selected.length > 0 && (
          <div className="px-2.5 py-2 border-b border-white/[0.08] flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground">
              {selected.length} selected
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-5 text-[10px] text-muted-foreground hover:text-foreground px-1.5"
              onClick={(e) => {
                e.stopPropagation();
                clearThis();
              }}
            >
              Clear
            </Button>
          </div>
        )}
        <div className="max-h-60 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
              No results found
            </div>
          ) : (
            filtered.map((option) => (
              <label
                key={option.v}
                className="flex items-center gap-2.5 px-2.5 py-2 hover:bg-white/[0.04] cursor-pointer transition-colors"
              >
                <Checkbox
                  checked={selected.includes(option.v)}
                  onCheckedChange={() => toggle(option.v)}
                  className="h-3.5 w-3.5"
                />
                <span className="text-xs text-foreground truncate flex-1">
                  {option.v}
                </span>
                <span className="text-[10px] text-muted-foreground/60 shrink-0 tabular-nums">
                  {option.c.toLocaleString()}
                </span>
              </label>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/* ═════════════════════════ Main Component ═════════════════════════ */

export default function LeadsScreen({
  navigateTo,
}: {
  navigateTo?: (screen: string) => void;
}) {
  /* ── Meta state ── */
  const [meta, setMeta] = useState<Meta | null>(null);
  const [metaLoading, setMetaLoading] = useState(true);

  /* ── Filter state ── */
  const [search, setSearch] = useState('');
  const [countries, setCountries] = useState<string[]>([]);
  const [industries, setIndustries] = useState<string[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [titles, setTitles] = useState<string[]>([]);
  const [empCats, setEmpCats] = useState<string[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [states, setStates] = useState<string[]>([]);

  /* ── Table state ── */
  const [leads, setLeads] = useState<Lead[]>([]);
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [sortBy, setSortBy] = useState<SortColumn>('company');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  /* ── UI state ── */
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  /* ── Email generation state ── */
  const [generatingEmail, setGeneratingEmail] = useState(false);
  const [generatedDraft, setGeneratedDraft] = useState<{
    subject: string; body: string; cta: string; confidenceScore: number;
    generationMethod: string; sourceSnippets: Array<{ id: string; title: string; snippetType: string; relevanceScore?: number }>;
    assumptionFlags: Array<{ id: string; assumption: string; confidence: string }>;
  } | null>(null);
  const [emailGenError, setEmailGenError] = useState('');

  /* ── Debounce / refs ── */
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  /* ── Derived: active filter count ── */
  const activeFilterCount = [
    countries.length > 0,
    industries.length > 0,
    departments.length > 0,
    titles.length > 0,
    empCats.length > 0,
    cities.length > 0,
    states.length > 0,
    search.trim().length > 0,
  ].filter(Boolean).length;

  /* ── Load metadata ── */
  useEffect(() => {
    let cancelled = false;
    async function fetchMeta() {
      try {
        setMetaLoading(true);
        const res = await fetch('/api/leads?meta=true');
        if (!res.ok) throw new Error('Failed to load metadata');
        const data = await res.json();
        if (!cancelled && data.meta) {
          setMeta(data.meta);
        }
      } catch (err) {
        if (!cancelled) {
          toast.error('Failed to load filter options');
          console.error(err);
        }
      } finally {
        if (!cancelled) setMetaLoading(false);
      }
    }
    fetchMeta();
    return () => {
      cancelled = true;
    };
  }, []);

  /* ── Build query string from state ── */
  const buildQueryString = useCallback(() => {
    const params = new URLSearchParams();
    if (search.trim()) params.set('search', search.trim());
    if (countries.length > 0) params.set('country', countries.join(','));
    if (industries.length > 0) params.set('industry', industries.join(','));
    if (departments.length > 0) params.set('department', departments.join(','));
    if (titles.length > 0) params.set('title', titles.join(','));
    if (empCats.length > 0) params.set('empCat', empCats.join(','));
    if (cities.length > 0) params.set('city', cities.join(','));
    if (states.length > 0) params.set('state', states.join(','));
    params.set('sortBy', sortBy);
    params.set('page', String(page));
    params.set('limit', String(limit));
    return params.toString();
  }, [search, countries, industries, departments, titles, empCats, cities, states, sortBy, page, limit]);

  /* ── Fetch leads (debounced) ── */
  const fetchLeads = useCallback(async () => {
    try {
      setLeadsLoading(true);
      const qs = buildQueryString();
      const res = await fetch(`/api/leads?${qs}`);
      if (!res.ok) throw new Error('Failed to fetch leads');
      const data: LeadsResponse = await res.json();
      setLeads(data.leads || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 0);
    } catch (err) {
      toast.error('Failed to load leads');
      console.error(err);
    } finally {
      setLeadsLoading(false);
    }
  }, [buildQueryString]);

  /* ── Debounced fetch on filter/sort change ── */
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchLeads();
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [fetchLeads]);

  /* ── Reset page when filters change ── */
  useEffect(() => {
    setPage(1);
  }, [search, countries, industries, departments, titles, empCats, cities, states, limit]);

  /* ── Sort handler ── */
  const handleSort = (col: SortColumn) => {
    if (sortBy === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(col);
      setSortDir('asc');
    }
    setPage(1);
  };

  /* ── Clear all filters ── */
  const clearAllFilters = () => {
    setSearch('');
    setCountries([]);
    setIndustries([]);
    setDepartments([]);
    setTitles([]);
    setEmpCats([]);
    setCities([]);
    setStates([]);
    setPage(1);
  };

  /* ── Open detail dialog ── */
  const openDetail = (lead: Lead) => {
    setSelectedLead(lead);
    setGeneratedDraft(null);
    setEmailGenError('');
    setDetailOpen(true);
  };

  /* ── Generate AI email for a lead ── */
  const handleGenerateEmail = async () => {
    if (!selectedLead) return;
    setGeneratingEmail(true);
    setGeneratedDraft(null);
    setEmailGenError('');
    try {
      const res = await fetch('/api/drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: selectedLead.rawName,
          email: selectedLead.email,
          title: selectedLead.title,
          company: selectedLead.company,
          industry: selectedLead.industry,
          companySize: selectedLead.employeeCategory,
        }),
      });
      const data = await res.json();
      if (data.success && data.draft) {
        setGeneratedDraft({
          subject: data.draft.subject,
          body: data.draft.body,
          cta: data.draft.cta || '',
          confidenceScore: data.draft.confidenceScore || 0,
          generationMethod: data.draft.generationMethod || 'ai',
          sourceSnippets: data.draft.sourceSnippets || [],
          assumptionFlags: data.draft.assumptionFlags || [],
        });
        toast.success(`Email generated for ${selectedLead.rawName}`);
      } else {
        setEmailGenError(data.error || 'Generation failed');
        toast.error(data.error || 'Email generation failed');
      }
    } catch {
      setEmailGenError('Network error');
      toast.error('Network error — please try again');
    }
    setGeneratingEmail(false);
  };

  /* ── Pagination info ── */
  const showingFrom = total === 0 ? 0 : (page - 1) * limit + 1;
  const showingTo = Math.min(page * limit, total);

  /* ── Render sort icon ── */
  const SortIcon = ({ col }: { col: SortColumn }) => {
    if (sortBy !== col)
      return <ArrowUpDown className="w-3 h-3 ml-1 opacity-30 inline" />;
    return sortDir === 'asc' ? (
      <ChevronUp className="w-3 h-3 ml-1 text-primary inline" />
    ) : (
      <ChevronDown className="w-3 h-3 ml-1 text-primary inline" />
    );
  };

  /* ════════════════════════ Render ════════════════════════ */

  return (
    <PageTransition>
    <div className="space-y-8">

      {/* ═══ Page Header ═══ */}
      <div className="flex flex-col gap-2 pt-2">
        <div className="flex items-center gap-4">
          <div
            className="h-10 w-2 rounded-full"
            style={{
              background: 'linear-gradient(180deg, #E8C860, #D4AF37, #9A8340)',
              boxShadow: '0 0 20px rgba(212, 175, 55, 0.3)',
            }}
          />
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              <ShimmerText>Leads</ShimmerText>
            </h1>
            <p className="text-sm text-muted-foreground mt-1 ml-1">
              {metaLoading
                ? 'Loading contacts...'
                : `${(meta?.totalRecords ?? 0).toLocaleString()} total contacts in database`}
            </p>
          </div>
        </div>
      </div>

      {/* ═══ Stat Cards ═══ */}
      <StaggerGrid
        className="grid grid-cols-2 lg:grid-cols-4 gap-4"
        stagger={0.08}
      >
        <StaggerItem>
          <StatCard
            label="Total Leads"
            value={meta?.totalRecords ?? 0}
            icon={Database}
            color="#D4AF37"
            delay={0}
          />
        </StaggerItem>
        <StaggerItem>
          <StatCard
            label="Verified Emails"
            value={leads.filter((l) => l.email && l.email !== '-').length}
            icon={MailCheck}
            color="#10B981"
            delay={0.08}
          />
        </StaggerItem>
        <StaggerItem>
          <StatCard
            label="Showing Results"
            value={total}
            icon={FileEdit}
            color="#6366F1"
            delay={0.16}
          />
        </StaggerItem>
        <StaggerItem>
          <StatCard
            label="Active Filters"
            value={activeFilterCount}
            icon={Filter}
            color="#F59E0B"
            delay={0.24}
          />
        </StaggerItem>
      </StaggerGrid>

      {/* ═══ Filter Panel Toggle ═══ */}
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          className="h-9 gap-2 text-xs border-white/[0.1] bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/[0.15] transition-all duration-200"
          onClick={() => setFiltersOpen(!filtersOpen)}
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          Filters
          {activeFilterCount > 0 && (
            <Badge className="bg-primary/15 border-primary/25 text-primary text-[10px] h-4 min-w-4 px-1.5 rounded-full font-semibold">
              {activeFilterCount}
            </Badge>
          )}
          {filtersOpen ? (
            <ChevronUp className="w-3 h-3" />
          ) : (
            <ChevronDown className="w-3 h-3" />
          )}
        </Button>
        {activeFilterCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-9 text-xs text-muted-foreground hover:text-foreground"
            onClick={clearAllFilters}
          >
            <X className="w-3 h-3 mr-1" />
            Clear all
          </Button>
        )}
      </div>

      {/* ═══ Filter Panel ═══ */}
      {filtersOpen && (
        <GlassPanel className="overflow-hidden">
          <div className="p-5 space-y-4">
            {/* Search row */}
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                ref={searchInputRef}
                placeholder="Search by name, email, company, title, city, or country..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-10 pl-10 pr-9 text-sm bg-white/[0.03] border-white/[0.08] text-foreground placeholder:text-muted-foreground/50 focus:border-primary/30 focus:ring-1 focus:ring-primary/10 transition-all duration-200"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Filter dropdowns */}
            {metaLoading ? (
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: 7 }).map((_, i) => (
                  <Skeleton key={i} className="h-9 w-28 rounded-lg bg-white/[0.05]" />
                ))}
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <MultiSelectDropdown
                  label="Country"
                  options={meta?.countries ?? []}
                  selected={countries}
                  onChange={setCountries}
                  totalCount={meta?.countries.length ?? 0}
                />
                <MultiSelectDropdown
                  label="Industry"
                  options={meta?.industries ?? []}
                  selected={industries}
                  onChange={setIndustries}
                  totalCount={meta?.industries.length ?? 0}
                />
                <MultiSelectDropdown
                  label="Department"
                  options={meta?.departments ?? []}
                  selected={departments}
                  onChange={setDepartments}
                  totalCount={meta?.departments.length ?? 0}
                />
                <MultiSelectDropdown
                  label="Designation"
                  options={meta?.titles ?? []}
                  selected={titles}
                  onChange={setTitles}
                  totalCount={meta?.titles.length ?? 0}
                />
                <MultiSelectDropdown
                  label="Company Size"
                  options={meta?.employeeCategories ?? []}
                  selected={empCats}
                  onChange={setEmpCats}
                  totalCount={meta?.employeeCategories.length ?? 0}
                />
                <MultiSelectDropdown
                  label="City"
                  options={meta?.cities ?? []}
                  selected={cities}
                  onChange={setCities}
                  totalCount={meta?.cities.length ?? 0}
                />
                <MultiSelectDropdown
                  label="State"
                  options={meta?.states ?? []}
                  selected={states}
                  onChange={setStates}
                  totalCount={meta?.states.length ?? 0}
                />
              </div>
            )}
          </div>
        </GlassPanel>
      )}

      {/* ═══ Active Filter Badges ═══ */}
      {activeFilterCount > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-wrap items-center gap-2"
        >
          <span className="text-[10px] text-muted-foreground/60 mr-1 uppercase tracking-widest font-medium">Active:</span>
          {search.trim() && (
            <Badge
              className="bg-primary/10 border-primary/20 text-primary text-[10px] h-6 px-2.5 gap-1.5 cursor-pointer hover:bg-primary/20 transition-all duration-200 rounded-full"
              onClick={() => setSearch('')}
            >
              Search: &quot;{search.trim()}&quot;
              <X className="w-2.5 h-2.5" />
            </Badge>
          )}
          {countries.map((c) => (
            <Badge
              key={`country-${c}`}
              className="bg-primary/10 border-primary/20 text-primary text-[10px] h-6 px-2.5 gap-1.5 cursor-pointer hover:bg-primary/20 transition-all duration-200 rounded-full"
              onClick={() => setCountries(countries.filter((v) => v !== c))}
            >
              {c}
              <X className="w-2.5 h-2.5" />
            </Badge>
          ))}
          {industries.map((v) => (
            <Badge
              key={`industry-${v}`}
              className="bg-primary/10 border-primary/20 text-primary text-[10px] h-6 px-2.5 gap-1.5 cursor-pointer hover:bg-primary/20 transition-all duration-200 rounded-full"
              onClick={() => setIndustries(industries.filter((i) => i !== v))}
            >
              {v}
              <X className="w-2.5 h-2.5" />
            </Badge>
          ))}
          {departments.map((d) => (
            <Badge
              key={`dept-${d}`}
              className="bg-primary/10 border-primary/20 text-primary text-[10px] h-6 px-2.5 gap-1.5 cursor-pointer hover:bg-primary/20 transition-all duration-200 rounded-full"
              onClick={() => setDepartments(departments.filter((v) => v !== d))}
            >
              {d}
              <X className="w-2.5 h-2.5" />
            </Badge>
          ))}
          {titles.slice(0, 5).map((t) => (
            <Badge
              key={`title-${t}`}
              className="bg-primary/10 border-primary/20 text-primary text-[10px] h-6 px-2.5 gap-1.5 cursor-pointer hover:bg-primary/20 transition-all duration-200 rounded-full"
              onClick={() => setTitles(titles.filter((v) => v !== t))}
            >
              {t}
              <X className="w-2.5 h-2.5" />
            </Badge>
          ))}
          {titles.length > 5 && (
            <Badge className="bg-primary/10 border-primary/20 text-primary text-[10px] h-6 px-2.5 rounded-full">
              +{titles.length - 5} more titles
            </Badge>
          )}
          {empCats.map((e) => (
            <Badge
              key={`empcat-${e}`}
              className="bg-primary/10 border-primary/20 text-primary text-[10px] h-6 px-2.5 gap-1.5 cursor-pointer hover:bg-primary/20 transition-all duration-200 rounded-full"
              onClick={() => setEmpCats(empCats.filter((v) => v !== e))}
            >
              {e}
              <X className="w-2.5 h-2.5" />
            </Badge>
          ))}
          {cities.slice(0, 5).map((c) => (
            <Badge
              key={`city-${c}`}
              className="bg-primary/10 border-primary/20 text-primary text-[10px] h-6 px-2.5 gap-1.5 cursor-pointer hover:bg-primary/20 transition-all duration-200 rounded-full"
              onClick={() => setCities(cities.filter((v) => v !== c))}
            >
              {c}
              <X className="w-2.5 h-2.5" />
            </Badge>
          ))}
          {cities.length > 5 && (
            <Badge className="bg-primary/10 border-primary/20 text-primary text-[10px] h-6 px-2.5 rounded-full">
              +{cities.length - 5} more cities
            </Badge>
          )}
          {states.map((s) => (
            <Badge
              key={`state-${s}`}
              className="bg-primary/10 border-primary/20 text-primary text-[10px] h-6 px-2.5 gap-1.5 cursor-pointer hover:bg-primary/20 transition-all duration-200 rounded-full"
              onClick={() => setStates(states.filter((v) => v !== s))}
            >
              {s}
              <X className="w-2.5 h-2.5" />
            </Badge>
          ))}
        </motion.div>
      )}

      {/* ═══ Leads Table ═══ */}
      <GlassPanel className="overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-white/[0.06] hover:bg-transparent">
                <TableHead className="text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-wider h-11 w-[180px]">
                  Name
                </TableHead>
                <TableHead className="text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-wider h-11 w-[200px]">
                  Email
                </TableHead>
                <TableHead
                  className="text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-wider h-11 w-[160px] cursor-pointer select-none hover:text-foreground transition-colors"
                  onClick={() => handleSort('title')}
                >
                  <span className="inline-flex items-center">
                    Title
                    <SortIcon col="title" />
                  </span>
                </TableHead>
                <TableHead className="text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-wider h-11 w-[120px]">
                  Department
                </TableHead>
                <TableHead
                  className="text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-wider h-11 w-[160px] cursor-pointer select-none hover:text-foreground transition-colors"
                  onClick={() => handleSort('company')}
                >
                  <span className="inline-flex items-center">
                    Company
                    <SortIcon col="company" />
                  </span>
                </TableHead>
                <TableHead
                  className="text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-wider h-11 w-[140px] cursor-pointer select-none hover:text-foreground transition-colors"
                  onClick={() => handleSort('industry')}
                >
                  <span className="inline-flex items-center">
                    Industry
                    <SortIcon col="industry" />
                  </span>
                </TableHead>
                <TableHead
                  className="text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-wider h-11 w-[120px] cursor-pointer select-none hover:text-foreground transition-colors"
                  onClick={() => handleSort('city')}
                >
                  <span className="inline-flex items-center">
                    City
                    <SortIcon col="city" />
                  </span>
                </TableHead>
                <TableHead
                  className="text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-wider h-11 w-[100px] cursor-pointer select-none hover:text-foreground transition-colors"
                  onClick={() => handleSort('country')}
                >
                  <span className="inline-flex items-center">
                    Country
                    <SortIcon col="country" />
                  </span>
                </TableHead>
                <TableHead className="text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-wider h-11 w-[100px]">
                  Size
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leadsLoading ? (
                Array.from({ length: 15 }).map((_, i) => (
                  <TableRow key={`skel-${i}`} className="border-white/[0.04] hover:bg-transparent">
                    <TableCell colSpan={9} className="py-0">
                      <Skeleton className="h-10 w-full my-0.5 bg-white/[0.03]" />
                    </TableCell>
                  </TableRow>
                ))
              ) : leads.length === 0 ? (
                <TableRow className="border-white/[0.04] hover:bg-transparent">
                  <TableCell colSpan={9} className="h-48">
                    <EmptyState
                      icon={Users}
                      title="No leads found"
                      description={activeFilterCount > 0 ? 'Try adjusting your filters or search terms to find what you are looking for.' : 'No contacts match your current criteria.'}
                      action={
                        activeFilterCount > 0 ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs border-primary/20 text-primary hover:bg-primary/10 hover:border-primary/30 transition-all duration-200"
                            onClick={clearAllFilters}
                          >
                            <X className="w-3 h-3 mr-1" />
                            Clear all filters
                          </Button>
                        ) : undefined
                      }
                    />
                  </TableCell>
                </TableRow>
              ) : (
                leads.map((lead, idx) => (
                  <motion.tr
                    key={lead.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.25, delay: Math.min(idx * 0.02, 0.4) }}
                    className="group border-white/[0.04] cursor-pointer transition-all duration-200 hover:bg-white/[0.04] relative"
                    style={{ borderLeft: '3px solid transparent' }}
                    onClick={() => openDetail(lead)}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.borderLeftColor = '#D4AF37';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.borderLeftColor = 'transparent';
                    }}
                  >
                    <td className="py-3 px-4 text-xs text-foreground font-medium relative z-10">
                      {lead.rawName || '-'}
                    </td>
                    <td className="py-3 px-4 text-xs text-muted-foreground truncate max-w-[200px] relative z-10">
                      {lead.email || '-'}
                    </td>
                    <td className="py-3 px-4 text-xs text-muted-foreground truncate max-w-[160px] relative z-10">
                      {lead.title || '-'}
                    </td>
                    <td className="py-3 px-4 text-xs text-muted-foreground truncate max-w-[120px] relative z-10">
                      {lead.department || '-'}
                    </td>
                    <td className="py-3 px-4 text-xs text-foreground truncate max-w-[160px] relative z-10">
                      {lead.company || '-'}
                    </td>
                    <td className="py-3 px-4 text-xs text-muted-foreground truncate max-w-[140px] relative z-10">
                      {lead.industry || '-'}
                    </td>
                    <td className="py-3 px-4 text-xs text-muted-foreground truncate max-w-[120px] relative z-10">
                      {lead.city || '-'}
                    </td>
                    <td className="py-3 px-4 text-xs text-muted-foreground truncate max-w-[100px] relative z-10">
                      {lead.country || '-'}
                    </td>
                    <td className="py-3 px-4 text-xs text-muted-foreground relative z-10">
                      {lead.employeeCategory || '-'}
                    </td>
                  </motion.tr>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* ═══ Pagination ═══ */}
        {!leadsLoading && total > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-5 py-4 border-t border-white/[0.06]">
            <div className="text-xs text-muted-foreground">
              Showing{' '}
              <span className="text-foreground font-medium tabular-nums">{showingFrom.toLocaleString()}</span>
              {' - '}
              <span className="text-foreground font-medium tabular-nums">{showingTo.toLocaleString()}</span>
              {' of '}
              <span className="text-foreground font-medium tabular-nums">{total.toLocaleString()}</span>
              {' results'}
            </div>
            <div className="flex items-center gap-4">
              {/* Page size selector */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Rows:</span>
                <div className="flex gap-0.5 p-0.5 rounded-lg bg-white/[0.04] border border-white/[0.06]">
                  {PAGE_SIZE_OPTIONS.map((size) => (
                    <Button
                      key={size}
                      variant={limit === size ? 'default' : 'ghost'}
                      size="sm"
                      className={`h-7 px-3 text-xs rounded-md transition-all duration-200 ${
                        limit === size
                          ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20 hover:bg-primary/90'
                          : 'text-muted-foreground hover:text-foreground hover:bg-white/[0.04]'
                      }`}
                      onClick={() => setLimit(size)}
                    >
                      {size}
                    </Button>
                  ))}
                </div>
              </div>

              <Separator orientation="vertical" className="h-5 bg-white/[0.08]" />

              {/* Page controls */}
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 hover:bg-white/[0.06] text-muted-foreground hover:text-foreground transition-colors"
                  disabled={page <= 1}
                  onClick={() => setPage(1)}
                >
                  <ChevronsLeft className="w-3.5 h-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 hover:bg-white/[0.06] text-muted-foreground hover:text-foreground transition-colors"
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </Button>
                <span className="text-xs text-foreground px-3 min-w-[90px] text-center tabular-nums font-medium">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 hover:bg-white/[0.06] text-muted-foreground hover:text-foreground transition-colors"
                  disabled={page >= totalPages}
                  onClick={() => setPage(page + 1)}
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 hover:bg-white/[0.06] text-muted-foreground hover:text-foreground transition-colors"
                  disabled={page >= totalPages}
                  onClick={() => setPage(totalPages)}
                >
                  <ChevronsRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </GlassPanel>

      {/* ═══ Lead Detail Dialog ═══ */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-lg bg-card/95 backdrop-blur-2xl border-white/[0.08] shadow-2xl shadow-black/40">
          <DialogHeader>
            <DialogTitle className="text-base text-foreground font-semibold">
              {selectedLead?.rawName || 'Lead Details'}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Contact information and company details
            </DialogDescription>
          </DialogHeader>
          {selectedLead && (
            <div className="space-y-5 mt-3">
              {/* Name & Title */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5 p-3 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/70 uppercase tracking-widest font-medium">
                    <Users className="w-3 h-3" />
                    Name
                  </div>
                  <p className="text-sm text-foreground font-medium">{selectedLead.rawName || '-'}</p>
                </div>
                <div className="space-y-1.5 p-3 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/70 uppercase tracking-widest font-medium">
                    <Briefcase className="w-3 h-3" />
                    Title
                  </div>
                  <p className="text-sm text-foreground font-medium">{selectedLead.title || '-'}</p>
                </div>
              </div>

              {/* Department & Company */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5 p-3 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/70 uppercase tracking-widest font-medium">
                    <Building2 className="w-3 h-3" />
                    Department
                  </div>
                  <p className="text-sm text-foreground font-medium">{selectedLead.department || '-'}</p>
                </div>
                <div className="space-y-1.5 p-3 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/70 uppercase tracking-widest font-medium">
                    <Building2 className="w-3 h-3" />
                    Company
                  </div>
                  <p className="text-sm text-foreground font-medium">{selectedLead.company || '-'}</p>
                </div>
              </div>

              {/* Industry & Company Size */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5 p-3 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/70 uppercase tracking-widest font-medium">
                    <Globe className="w-3 h-3" />
                    Industry
                  </div>
                  <p className="text-sm text-foreground font-medium">{selectedLead.industry || '-'}</p>
                </div>
                <div className="space-y-1.5 p-3 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/70 uppercase tracking-widest font-medium">
                    <Users className="w-3 h-3" />
                    Company Size
                  </div>
                  <p className="text-sm text-foreground font-medium">
                    {selectedLead.employeeCategory || '-'}
                    {selectedLead.employeeNumber && selectedLead.employeeCategory !== '-' && (
                      <span className="text-muted-foreground font-normal"> ({selectedLead.employeeNumber})</span>
                    )}
                  </p>
                </div>
              </div>

              <Separator className="bg-white/[0.06]" />

              {/* Email */}
              <div className="space-y-1.5 p-3 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/70 uppercase tracking-widest font-medium">
                  <Mail className="w-3 h-3" />
                  Email
                </div>
                {selectedLead.email ? (
                  <a
                    href={`mailto:${selectedLead.email}`}
                    className="text-sm text-primary hover:underline flex items-center gap-1.5"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {selectedLead.email}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                ) : (
                  <p className="text-sm text-muted-foreground">-</p>
                )}
              </div>

              {/* LinkedIn */}
              <div className="space-y-1.5 p-3 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/70 uppercase tracking-widest font-medium">
                  <Globe className="w-3 h-3" />
                  LinkedIn
                </div>
                {selectedLead.linkedin ? (
                  <a
                    href={
                      selectedLead.linkedin.startsWith('http')
                        ? selectedLead.linkedin
                        : `https://${selectedLead.linkedin}`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline flex items-center gap-1.5"
                    onClick={(e) => e.stopPropagation()}
                  >
                    View Profile
                    <ExternalLink className="w-3 h-3" />
                  </a>
                ) : (
                  <p className="text-sm text-muted-foreground">-</p>
                )}
              </div>

              {/* Website */}
              <div className="space-y-1.5 p-3 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/70 uppercase tracking-widest font-medium">
                  <Globe className="w-3 h-3" />
                  Website
                </div>
                {selectedLead.website ? (
                  <a
                    href={
                      selectedLead.website.startsWith('http')
                        ? selectedLead.website
                        : `https://${selectedLead.website}`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline flex items-center gap-1.5"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {selectedLead.website}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                ) : (
                  <p className="text-sm text-muted-foreground">-</p>
                )}
              </div>

              {/* Location */}
              <div className="space-y-1.5 p-3 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/70 uppercase tracking-widest font-medium">
                  <MapPin className="w-3 h-3" />
                  Location
                </div>
                <p className="text-sm text-foreground font-medium">
                  {[selectedLead.city, selectedLead.state, selectedLead.country]
                    .filter(Boolean)
                    .join(', ') || '-'}
                </p>
              </div>

              {/* ═══ Generate Email Action ═══ */}
              <div className="pt-2">
                <Button
                  className="w-full h-10 gap-2 text-sm font-medium"
                  style={{ background: 'linear-gradient(135deg, #D4AF37, #E8C860)', color: '#000' }}
                  disabled={generatingEmail || !selectedLead.email}
                  onClick={handleGenerateEmail}
                >
                  {generatingEmail ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  {generatingEmail ? 'Generating with AI...' : 'Generate AI Email'}
                </Button>
                {!selectedLead.email && (
                  <p className="text-[10px] text-amber-400 mt-1.5 text-center">No email address available for this lead</p>
                )}
              </div>

              {/* ═══ Generated Draft Preview ═══ */}
              {generatedDraft && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-3 space-y-2"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-medium text-emerald-400">
                      Email Generated ({generatedDraft.generationMethod === 'ai' ? 'AI-Powered' : 'Template'})
                    </span>
                    <span className="text-[10px] text-muted-foreground ml-auto">
                      Confidence: {generatedDraft.confidenceScore}%
                    </span>
                  </div>

                  {/* Subject */}
                  <div className="p-2.5 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Subject</p>
                    <p className="text-xs text-foreground font-medium">{generatedDraft.subject}</p>
                  </div>

                  {/* Body preview */}
                  <div className="p-2.5 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Body</p>
                    <p className="text-xs text-foreground/80 leading-relaxed whitespace-pre-wrap line-clamp-6">
                      {generatedDraft.body}
                    </p>
                  </div>

                  {/* Source snippets */}
                  {generatedDraft.sourceSnippets.length > 0 && (
                    <div className="p-2.5 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                        <Brain className="w-3 h-3" />
                        Knowledge Sources Used
                      </p>
                      <div className="space-y-1">
                        {generatedDraft.sourceSnippets.slice(0, 3).map((s, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-primary/60 shrink-0" />
                            <span className="text-[11px] text-muted-foreground">{s.title}</span>
                            <span className="text-[10px] text-muted-foreground/50 ml-auto">{s.snippetType}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <p className="text-[10px] text-muted-foreground text-center">
                    Draft saved to queue — view in{' '}
                    <button onClick={() => { setDetailOpen(false); }} className="text-primary hover:underline">
                      Drafts screen
                    </button>
                  </p>
                </motion.div>
              )}

              {/* Error */}
              {emailGenError && (
                <div className="mt-3 p-2.5 rounded-lg border border-red-500/20 bg-red-500/5">
                  <p className="text-xs text-red-400">{emailGenError}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
    </PageTransition>
  );
}