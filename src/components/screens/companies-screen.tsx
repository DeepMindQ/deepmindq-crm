'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { PageTransition, AnimatedCounter } from '@/components/ui/animated-components';
import {
  Building2, Globe, MapPin, Users, Search, Brain, Download,
  ChevronLeft, ChevronRight, MoreHorizontal, Sparkles,
  TrendingUp, BarChart3, Signal, X,
} from 'lucide-react';

/* ═══════════════════════════════════════════════════════════════
   Design Tokens
   ═══════════════════════════════════════════════════════════════ */
const gold = '#D4AF37';
const card = 'rgba(255, 255, 255, 0.85)';
const border = 'rgba(0, 0, 0, 0.05)';
const textMuted = '#6B7280';

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  prospect:     { bg: 'rgba(59,130,246,0.12)', text: '#60a5fa' },
  researching:  { bg: 'rgba(245,158,11,0.12)', text: '#fbbf24' },
  active:       { bg: 'rgba(16,185,129,0.12)', text: '#34d399' },
  engaged:      { bg: 'rgba(139,92,246,0.12)', text: '#a78bfa' },
  paused:       { bg: 'rgba(161,161,170,0.12)', text: '#a1a1aa' },
  closed_won:   { bg: 'rgba(34,197,94,0.12)', text: '#4ade80' },
  closed_lost:  { bg: 'rgba(239,68,68,0.12)', text: '#f87171' },
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
  if (!s) return '#475569';
  if (s >= 80) return '#4ade80';
  if (s >= 60) return '#fbbf24';
  return '#f87171';
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
  return (
    <div className="flex items-center gap-2 min-w-[100px]">
      <div className="flex-1 h-1.5 rounded-full" style={{ background: 'rgba(0, 0, 0, 0.05)' }}>
        <motion.div
          className="h-full rounded-full"
          style={{ background: col }}
          initial={{ width: 0 }}
          animate={{ width: `${v}%` }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
      <span className="text-xs font-semibold tabular-nums w-6 text-right" style={{ color: col }}>{v}</span>
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
    { label: 'View Details', action: () => navigateTo?.('company-detail', companyId) },
    { label: 'Enrich Data', action: () => toast.info('Enrichment started') },
    { label: 'Add Note', action: () => toast.info('Coming soon') },
  ];

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        className="p-1 rounded-md hover:bg-black/5 transition-colors"
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
            style={{ background: 'rgba(15,23,42,0.95)', borderColor: border, backdropFilter: 'blur(12px)' }}
          >
            {items.map((item) => (
              <button
                key={item.label}
                onClick={(e) => { e.stopPropagation(); setOpen(false); item.action(); }}
                className="w-full text-left px-3 py-1.5 text-xs hover:bg-black/5 transition-colors"
                style={{ color: '#cbd5e1' }}
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
        <div key={i} className="flex items-center gap-4 px-4 py-3 rounded-lg" style={{ background: i % 2 === 0 ? 'rgba(0,0,0,0.01)' : 'transparent' }}>
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
  const [stats, setStats] = useState({ withContacts: 0, withSignals: 0, avgScore: 0 });
  const [metaLoading, setMetaLoading] = useState(true);

  /* ── Filter state ── */
  const [search, setSearch] = useState('');
  const [industry, setIndustry] = useState('');
  const [country, setCountry] = useState('');
  const [page, setPage] = useState(1);
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
      const avg = list.length > 0
        ? Math.round(list.reduce((a: number, c: Company) => a + (c.intelligenceScore ?? 0), 0) / list.length)
        : 0;
      setStats({ withContacts: wc, withSignals: ws, avgScore: avg });
    } catch {
      toast.error('Failed to load companies');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, industry, country, page]);

  useEffect(() => { fetchCompanies(); }, [fetchCompanies]);

  // Reset page on filter change
  useEffect(() => { setPage(1); }, [debouncedSearch, industry, country]);

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const showEmpty = !loading && companies.length === 0;
  const activeFilters = [search, industry, country].filter(Boolean).length;

  /* ── Native select styles ── */
  const selectCls = `h-8 text-xs rounded-md border px-2 pr-7 appearance-none cursor-pointer
    focus:outline-none focus:ring-1 transition-colors`;
  const selectStyle: React.CSSProperties = {
    background: card,
    borderColor: border,
    color: '#cbd5e1',
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
          <h1 className="text-lg font-bold tracking-tight text-white">Companies</h1>
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
                color: '#e2e8f0',
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
            style={{ borderColor: 'rgba(0, 0, 0, 0.06)', color: '#cbd5e1' }}
          >
            <Download size={14} className="mr-1.5" />
            Export
          </Button>

          {/* Add Company */}
          <Button
            size="sm"
            onClick={() => toast.info('Add company dialog coming soon')}
            className="h-8 px-3 text-xs font-semibold rounded-lg shrink-0"
            style={{ background: gold, color: '#0c1220' }}
          >
            <Brain size={14} className="mr-1.5" />
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
          { icon: Building2, value: total, label: 'Total Companies', color: '#e2e8f0' },
          { icon: Users, value: stats.withContacts, label: 'With Contacts', color: '#60a5fa' },
          { icon: Signal, value: stats.withSignals, label: 'With Signals', color: '#fbbf24' },
          { icon: BarChart3, value: stats.avgScore, label: 'Avg Intelligence Score', color: '#34d399' },
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

      {/* ═══ Table ═══ */}
      <div className="flex-1 min-h-0 rounded-xl border overflow-hidden" style={{ background: card, borderColor: border }}>
        {/* Header */}
        <div
          className="flex items-center gap-4 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider border-b"
          style={{ color: textMuted, borderColor: border }}
        >
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
            /* ── Empty State ── */
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-16 gap-3"
            >
              <div className="p-4 rounded-2xl" style={{ background: 'rgba(212,175,55,0.08)' }}>
                <Building2 size={40} style={{ color: gold, opacity: 0.6 }} />
              </div>
              <p className="text-sm font-medium" style={{ color: '#94a3b8' }}>No companies found</p>
              <p className="text-xs" style={{ color: textMuted }}>
                {activeFilters > 0 ? 'Try adjusting your filters' : 'Add your first company to get started'}
              </p>
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
                const sc = STATUS_COLORS[company.status] || { bg: 'rgba(100,100,100,0.12)', text: '#a1a1aa' };
                const cc = company.contactCount ?? company._count?.contacts ?? 0;
                return (
                  <motion.div
                    key={company.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 8 }}
                    transition={{ duration: 0.25, delay: i * 0.02 }}
                    onClick={() => navigateTo?.('company-detail', company.id)}
                    className="group flex items-center gap-4 px-4 py-2.5 cursor-pointer border-l-2 border-l-transparent hover:border-l-[3px] transition-all duration-200"
                    style={{
                      background: i % 2 === 0 ? 'rgba(0,0,0,0.01)' : 'transparent',
                      hoverBorderLeftColor: gold,
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderLeftColor = gold; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderLeftColor = 'transparent'; }}
                  >
                    {/* Company Name + Industry */}
                    <div className="w-[220px] shrink-0 min-w-0">
                      <div className="text-sm font-medium text-white truncate">{company.rawName}</div>
                      {company.industry && (
                        <span
                          className="inline-block mt-0.5 text-[10px] px-1.5 py-0.5 rounded"
                          style={{ background: 'rgba(212,175,55,0.08)', color: gold }}
                        >
                          {company.industry}
                        </span>
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
                        <span className="text-xs font-medium" style={{ color: '#cbd5e1' }}>{company.country}</span>
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
                          style={{ background: 'rgba(96,165,250,0.12)', color: '#60a5fa' }}
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
                className="p-1.5 rounded-md transition-colors disabled:opacity-30 hover:bg-black/5"
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
                className="p-1.5 rounded-md transition-colors disabled:opacity-30 hover:bg-black/5"
              >
                <ChevronRight size={14} style={{ color: textMuted }} />
              </button>
            </div>
          </div>
        )}
      </div>
    </PageTransition>
  );
}