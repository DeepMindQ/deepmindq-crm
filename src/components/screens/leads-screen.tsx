'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
} from 'lucide-react';
import { toast } from 'sonner';

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
          className="h-8 gap-1.5 text-xs font-normal border-border hover:bg-accent/50"
        >
          <span className="truncate max-w-[120px]">{label}</span>
          {selected.length > 0 && (
            <Badge className="bg-primary/10 border-primary/20 text-primary text-[10px] h-4 min-w-4 px-1 rounded-full">
              {selected.length}
            </Badge>
          )}
          <span className="text-muted-foreground text-[10px]">({totalCount})</span>
          <ChevronDown className="w-3 h-3 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <div className="p-2 border-b border-border">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
            <Input
              placeholder={`Search ${label.toLowerCase()}...`}
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              className="h-7 pl-7 text-xs bg-background"
            />
          </div>
        </div>
        {selected.length > 0 && (
          <div className="px-2 py-1.5 border-b border-border flex items-center justify-between">
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
            <div className="py-6 text-center text-xs text-muted-foreground">
              No results found
            </div>
          ) : (
            filtered.map((option) => (
              <label
                key={option.v}
                className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent/50 cursor-pointer transition-colors"
              >
                <Checkbox
                  checked={selected.includes(option.v)}
                  onCheckedChange={() => toggle(option.v)}
                  className="h-3.5 w-3.5"
                />
                <span className="text-xs text-foreground truncate flex-1">
                  {option.v}
                </span>
                <span className="text-[10px] text-muted-foreground shrink-0">
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
    setDetailOpen(true);
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
    <div className="space-y-4">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Users className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">Leads</h2>
            <p className="text-xs text-muted-foreground">
              {metaLoading
                ? 'Loading contacts...'
                : `${(meta?.totalRecords ?? 0).toLocaleString()} contacts available`}
            </p>
          </div>
        </div>
      </div>

      {/* ── Filter Panel Toggle ── */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-2 text-xs"
          onClick={() => setFiltersOpen(!filtersOpen)}
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          Filters
          {activeFilterCount > 0 && (
            <Badge className="bg-primary/10 border-primary/20 text-primary text-[10px] h-4 min-w-4 px-1.5 rounded-full">
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
            className="h-8 text-xs text-muted-foreground hover:text-foreground"
            onClick={clearAllFilters}
          >
            <X className="w-3 h-3 mr-1" />
            Clear all
          </Button>
        )}
      </div>

      {/* ── Filter Panel ── */}
      {filtersOpen && (
        <div className="bg-card/50 border border-border rounded-lg p-4 space-y-3">
          {/* Search row */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              placeholder="Search by name, email, company, title, city, or country..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 pl-9 pr-8 text-sm bg-background border-border"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Filter dropdowns */}
          {metaLoading ? (
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: 7 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-28 rounded-md" />
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
      )}

      {/* ── Active filter badges ── */}
      {activeFilterCount > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] text-muted-foreground mr-1">Active:</span>
          {search.trim() && (
            <Badge
              className="bg-primary/10 border-primary/20 text-primary text-[10px] h-5 px-2 gap-1 cursor-pointer hover:bg-primary/20 transition-colors"
              onClick={() => setSearch('')}
            >
              Search: &quot;{search.trim()}&quot;
              <X className="w-2.5 h-2.5" />
            </Badge>
          )}
          {countries.map((c) => (
            <Badge
              key={`country-${c}`}
              className="bg-primary/10 border-primary/20 text-primary text-[10px] h-5 px-2 gap-1 cursor-pointer hover:bg-primary/20 transition-colors"
              onClick={() => setCountries(countries.filter((v) => v !== c))}
            >
              {c}
              <X className="w-2.5 h-2.5" />
            </Badge>
          ))}
          {industries.map((v) => (
            <Badge
              key={`industry-${v}`}
              className="bg-primary/10 border-primary/20 text-primary text-[10px] h-5 px-2 gap-1 cursor-pointer hover:bg-primary/20 transition-colors"
              onClick={() => setIndustries(industries.filter((i) => i !== v))}
            >
              {v}
              <X className="w-2.5 h-2.5" />
            </Badge>
          ))}
          {departments.map((d) => (
            <Badge
              key={`dept-${d}`}
              className="bg-primary/10 border-primary/20 text-primary text-[10px] h-5 px-2 gap-1 cursor-pointer hover:bg-primary/20 transition-colors"
              onClick={() => setDepartments(departments.filter((v) => v !== d))}
            >
              {d}
              <X className="w-2.5 h-2.5" />
            </Badge>
          ))}
          {titles.slice(0, 5).map((t) => (
            <Badge
              key={`title-${t}`}
              className="bg-primary/10 border-primary/20 text-primary text-[10px] h-5 px-2 gap-1 cursor-pointer hover:bg-primary/20 transition-colors"
              onClick={() => setTitles(titles.filter((v) => v !== t))}
            >
              {t}
              <X className="w-2.5 h-2.5" />
            </Badge>
          ))}
          {titles.length > 5 && (
            <Badge className="bg-primary/10 border-primary/20 text-primary text-[10px] h-5 px-2">
              +{titles.length - 5} more titles
            </Badge>
          )}
          {empCats.map((e) => (
            <Badge
              key={`empcat-${e}`}
              className="bg-primary/10 border-primary/20 text-primary text-[10px] h-5 px-2 gap-1 cursor-pointer hover:bg-primary/20 transition-colors"
              onClick={() => setEmpCats(empCats.filter((v) => v !== e))}
            >
              {e}
              <X className="w-2.5 h-2.5" />
            </Badge>
          ))}
          {cities.slice(0, 5).map((c) => (
            <Badge
              key={`city-${c}`}
              className="bg-primary/10 border-primary/20 text-primary text-[10px] h-5 px-2 gap-1 cursor-pointer hover:bg-primary/20 transition-colors"
              onClick={() => setCities(cities.filter((v) => v !== c))}
            >
              {c}
              <X className="w-2.5 h-2.5" />
            </Badge>
          ))}
          {cities.length > 5 && (
            <Badge className="bg-primary/10 border-primary/20 text-primary text-[10px] h-5 px-2">
              +{cities.length - 5} more cities
            </Badge>
          )}
          {states.map((s) => (
            <Badge
              key={`state-${s}`}
              className="bg-primary/10 border-primary/20 text-primary text-[10px] h-5 px-2 gap-1 cursor-pointer hover:bg-primary/20 transition-colors"
              onClick={() => setStates(states.filter((v) => v !== s))}
            >
              {s}
              <X className="w-2.5 h-2.5" />
            </Badge>
          ))}
        </div>
      )}

      {/* ── Leads Table ── */}
      <Card className="bg-card border border-border">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-[11px] font-medium text-muted-foreground h-9 w-[180px]">
                    Name
                  </TableHead>
                  <TableHead className="text-[11px] font-medium text-muted-foreground h-9 w-[200px]">
                    Email
                  </TableHead>
                  <TableHead
                    className="text-[11px] font-medium text-muted-foreground h-9 w-[160px] cursor-pointer select-none hover:text-foreground transition-colors"
                    onClick={() => handleSort('title')}
                  >
                    <span className="inline-flex items-center">
                      Title
                      <SortIcon col="title" />
                    </span>
                  </TableHead>
                  <TableHead className="text-[11px] font-medium text-muted-foreground h-9 w-[120px]">
                    Department
                  </TableHead>
                  <TableHead
                    className="text-[11px] font-medium text-muted-foreground h-9 w-[160px] cursor-pointer select-none hover:text-foreground transition-colors"
                    onClick={() => handleSort('company')}
                  >
                    <span className="inline-flex items-center">
                      Company
                      <SortIcon col="company" />
                    </span>
                  </TableHead>
                  <TableHead
                    className="text-[11px] font-medium text-muted-foreground h-9 w-[140px] cursor-pointer select-none hover:text-foreground transition-colors"
                    onClick={() => handleSort('industry')}
                  >
                    <span className="inline-flex items-center">
                      Industry
                      <SortIcon col="industry" />
                    </span>
                  </TableHead>
                  <TableHead
                    className="text-[11px] font-medium text-muted-foreground h-9 w-[120px] cursor-pointer select-none hover:text-foreground transition-colors"
                    onClick={() => handleSort('city')}
                  >
                    <span className="inline-flex items-center">
                      City
                      <SortIcon col="city" />
                    </span>
                  </TableHead>
                  <TableHead
                    className="text-[11px] font-medium text-muted-foreground h-9 w-[100px] cursor-pointer select-none hover:text-foreground transition-colors"
                    onClick={() => handleSort('country')}
                  >
                    <span className="inline-flex items-center">
                      Country
                      <SortIcon col="country" />
                    </span>
                  </TableHead>
                  <TableHead className="text-[11px] font-medium text-muted-foreground h-9 w-[100px]">
                    Size
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leadsLoading ? (
                  Array.from({ length: 15 }).map((_, i) => (
                    <TableRow key={`skel-${i}`} className="border-border hover:bg-transparent">
                      <TableCell colSpan={9} className="py-0">
                        <Skeleton className="h-8 w-full my-0.5" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : leads.length === 0 ? (
                  <TableRow className="border-border hover:bg-transparent">
                    <TableCell colSpan={9} className="h-32 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <Users className="w-8 h-8 text-muted-foreground/50" />
                        <p className="text-sm text-muted-foreground">
                          No leads found
                        </p>
                        {activeFilterCount > 0 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs"
                            onClick={clearAllFilters}
                          >
                            Clear filters
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  leads.map((lead) => (
                    <TableRow
                      key={lead.id}
                      className="border-border cursor-pointer hover:bg-accent/30 transition-colors"
                      onClick={() => openDetail(lead)}
                    >
                      <TableCell className="py-2 text-xs text-foreground font-medium">
                        {lead.rawName || '—'}
                      </TableCell>
                      <TableCell className="py-2 text-xs text-muted-foreground truncate max-w-[200px]">
                        {lead.email || '—'}
                      </TableCell>
                      <TableCell className="py-2 text-xs text-muted-foreground truncate max-w-[160px]">
                        {lead.title || '—'}
                      </TableCell>
                      <TableCell className="py-2 text-xs text-muted-foreground truncate max-w-[120px]">
                        {lead.department || '—'}
                      </TableCell>
                      <TableCell className="py-2 text-xs text-foreground truncate max-w-[160px]">
                        {lead.company || '—'}
                      </TableCell>
                      <TableCell className="py-2 text-xs text-muted-foreground truncate max-w-[140px]">
                        {lead.industry || '—'}
                      </TableCell>
                      <TableCell className="py-2 text-xs text-muted-foreground truncate max-w-[120px]">
                        {lead.city || '—'}
                      </TableCell>
                      <TableCell className="py-2 text-xs text-muted-foreground truncate max-w-[100px]">
                        {lead.country || '—'}
                      </TableCell>
                      <TableCell className="py-2 text-xs text-muted-foreground">
                        {lead.employeeCategory || '—'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* ── Pagination ── */}
          {!leadsLoading && total > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-border">
              <div className="text-xs text-muted-foreground">
                Showing {showingFrom.toLocaleString()}-{showingTo.toLocaleString()} of{' '}
                {total.toLocaleString()} results
              </div>
              <div className="flex items-center gap-3">
                {/* Page size selector */}
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">Rows:</span>
                  <div className="flex gap-0.5">
                    {PAGE_SIZE_OPTIONS.map((size) => (
                      <Button
                        key={size}
                        variant={limit === size ? 'default' : 'ghost'}
                        size="sm"
                        className={`h-7 px-2 text-xs ${
                          limit === size
                            ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                        onClick={() => setLimit(size)}
                      >
                        {size}
                      </Button>
                    ))}
                  </div>
                </div>

                <Separator orientation="vertical" className="h-5" />

                {/* Page controls */}
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    disabled={page <= 1}
                    onClick={() => setPage(1)}
                  >
                    <ChevronsLeft className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    disabled={page <= 1}
                    onClick={() => setPage(page - 1)}
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </Button>
                  <span className="text-xs text-foreground px-2 min-w-[80px] text-center">
                    Page {page} of {totalPages}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    disabled={page >= totalPages}
                    onClick={() => setPage(page + 1)}
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    disabled={page >= totalPages}
                    onClick={() => setPage(totalPages)}
                  >
                    <ChevronsRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Lead Detail Dialog ── */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-lg bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-base text-foreground">
              {selectedLead?.rawName || 'Lead Details'}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Contact information and company details
            </DialogDescription>
          </DialogHeader>
          {selectedLead && (
            <div className="space-y-4 mt-2">
              {/* Name & Title */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase tracking-wider">
                    <Users className="w-3 h-3" />
                    Name
                  </div>
                  <p className="text-sm text-foreground">{selectedLead.rawName || '—'}</p>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase tracking-wider">
                    <Briefcase className="w-3 h-3" />
                    Title
                  </div>
                  <p className="text-sm text-foreground">{selectedLead.title || '—'}</p>
                </div>
              </div>

              {/* Department & Company */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase tracking-wider">
                    <Building2 className="w-3 h-3" />
                    Department
                  </div>
                  <p className="text-sm text-foreground">{selectedLead.department || '—'}</p>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase tracking-wider">
                    <Building2 className="w-3 h-3" />
                    Company
                  </div>
                  <p className="text-sm text-foreground">{selectedLead.company || '—'}</p>
                </div>
              </div>

              {/* Industry & Company Size */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase tracking-wider">
                    <Globe className="w-3 h-3" />
                    Industry
                  </div>
                  <p className="text-sm text-foreground">{selectedLead.industry || '—'}</p>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase tracking-wider">
                    <Users className="w-3 h-3" />
                    Company Size
                  </div>
                  <p className="text-sm text-foreground">
                    {selectedLead.employeeCategory || '—'}
                    {selectedLead.employeeNumber && selectedLead.employeeCategory !== '—' && (
                      <span className="text-muted-foreground"> ({selectedLead.employeeNumber})</span>
                    )}
                  </p>
                </div>
              </div>

              <Separator className="bg-border" />

              {/* Email */}
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase tracking-wider">
                  <Mail className="w-3 h-3" />
                  Email
                </div>
                {selectedLead.email ? (
                  <a
                    href={`mailto:${selectedLead.email}`}
                    className="text-sm text-primary hover:underline flex items-center gap-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {selectedLead.email}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                ) : (
                  <p className="text-sm text-muted-foreground">—</p>
                )}
              </div>

              {/* LinkedIn */}
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase tracking-wider">
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
                    className="text-sm text-primary hover:underline flex items-center gap-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    View Profile
                    <ExternalLink className="w-3 h-3" />
                  </a>
                ) : (
                  <p className="text-sm text-muted-foreground">—</p>
                )}
              </div>

              {/* Website */}
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase tracking-wider">
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
                    className="text-sm text-primary hover:underline flex items-center gap-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {selectedLead.website}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                ) : (
                  <p className="text-sm text-muted-foreground">—</p>
                )}
              </div>

              {/* Location */}
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase tracking-wider">
                  <MapPin className="w-3 h-3" />
                  Location
                </div>
                <p className="text-sm text-foreground">
                  {[selectedLead.city, selectedLead.state, selectedLead.country]
                    .filter(Boolean)
                    .join(', ') || '—'}
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}