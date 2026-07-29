'use client';

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  Building2, Globe, MapPin, Users, Search, Download,
  ChevronLeft, ChevronRight, MoreHorizontal, Sparkles, Loader2,
  Plus, LayoutGrid, List, Trash2, Check, X, Eye, Pencil,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { EmptyState } from '@/components/shared/design-system';
import { useAppStore } from '@/lib/store';
import { fetchApi } from '@/lib/fetchApi';
import { cn } from '@/lib/utils';

/* ═══════════════════════════════════════════════════════════════
   Types & Constants
   ═══════════════════════════════════════════════════════════════ */

interface CompanyRow {
  id: string; rawName: string; domain: string | null; industry: string | null;
  sizeRange: string | null; country: string | null; status: string;
  intelligenceScore: number | null; contactCount: number; signalCount: number;
  isEnriched: boolean; topSignal: any; updatedAt: string | null;
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  prospect: { bg: 'rgba(59,130,246,0.12)', text: '#2563EB' },
  researching: { bg: 'rgba(245,158,11,0.12)', text: '#D97706' },
  active: { bg: 'rgba(16,185,129,0.12)', text: '#059669' },
  engaged: { bg: 'rgba(139,92,246,0.12)', text: '#7C3AED' },
  paused: { bg: 'rgba(161,161,170,0.12)', text: '#52525B' },
  closed_won: { bg: 'rgba(34,197,94,0.12)', text: '#16A34A' },
  closed_lost: { bg: 'rgba(239,68,68,0.12)', text: '#DC2626' },
};
const SIZE_RANGES = ['1-10', '11-50', '51-200', '201-1000', '1001-5000', '5001+'];
const STATUS_OPTIONS = ['prospect', 'researching', 'active', 'engaged', 'paused', 'closed_won', 'closed_lost'];

/* ═══════════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════════ */

const scoreColor = (s: number | null) => s == null || s < 40 ? '#9CA3AF' : s >= 80 ? '#059669' : s >= 60 ? '#D97706' : '#2563EB';
const scoreGradient = (s: number | null) =>
  s == null || s < 40 ? 'linear-gradient(90deg,#9CA3AF,#D1D5DB)' : s >= 80 ? 'linear-gradient(90deg,#059669,#34D399)' : s >= 60 ? 'linear-gradient(90deg,#D97706,#FBBF24)' : 'linear-gradient(90deg,#2563EB,#60A5FA)';

function statusLabel(s: string) { return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()); }

function relativeTime(d: string | null) {
  if (!d) return '—';
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (m < 1) return 'now'; if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h`;
  const days = Math.floor(h / 24); if (days < 30) return `${days}d`;
  return `${Math.floor(days / 30)}mo`;
}

function csvEscape(v: unknown) {
  if (v == null) return '""'; const s = String(v);
  return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
}

function exportCSV(rows: CompanyRow[]) {
  const hdr = 'Name,Domain,Industry,Size,Country,Contacts,Score,Status,Updated\n';
  const body = rows.map(r =>
    [r.rawName, r.domain, r.industry, r.sizeRange, r.country, r.contactCount, r.intelligenceScore, r.status, r.updatedAt].map(csvEscape).join(',')
  ).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['\uFEFF' + hdr + body], { type: 'text/csv' }));
  a.download = 'companies.csv'; a.click();
}

const blankForm = () => ({ rawName: '', domain: '', industry: '', sizeRange: '', country: '', website: '', notes: '' });
type Form = ReturnType<typeof blankForm>;

/* ═══════════════════════════════════════════════════════════════
   Sub-components
   ═══════════════════════════════════════════════════════════════ */

function ScoreBar({ score }: { score: number | null }) {
  const v = score ?? 0;
  return (
    <div className="flex items-center gap-1.5 min-w-[90px]">
      <div className="relative flex-1 h-2 rounded-full bg-black/5">
        <motion.div className="h-full rounded-full" style={{ background: scoreGradient(score), boxShadow: v >= 80 ? '0 0 8px rgba(5,150,105,.5)' : undefined }}
          initial={{ width: 0 }} animate={{ width: `${v}%` }} transition={{ duration: .8, ease: [.22,1,.36,1] }} />
      </div>
      <span className="text-[11px] font-bold tabular-nums w-7 text-right" style={{ color: scoreColor(score) }}>{v}</span>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const c = STATUS_COLORS[status] ?? { bg: 'rgba(100,100,100,.12)', text: '#52525B' };
  return <span className="inline-flex text-[11px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap" style={{ background: c.bg, color: c.text }}>{statusLabel(status)}</span>;
}

function ScoreCircle({ score }: { score: number | null }) {
  const v = score ?? 0, col = scoreColor(score), r = 20, circ = 2 * Math.PI * r;
  return (
    <div className="relative" style={{ width: 48, height: 48 }}>
      <svg aria-hidden="true" viewBox="0 0 48 48" className="w-full h-full -rotate-90">
        <circle cx="24" cy="24" r={r} fill="none" stroke="#F3F4F6" strokeWidth="4" />
        <circle cx="24" cy="24" r={r} fill="none" stroke={col} strokeWidth="4" strokeDasharray={circ}
          strokeDashoffset={circ - (v / 100) * circ} strokeLinecap="round" className="transition-all duration-700" />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xs font-bold tabular-nums" style={{ color: col }}>{v}</span>
      </div>
    </div>
  );
}

function SortHead({ label, field, sortBy, sortDir, onSort, className }: {
  label: string; field: string; sortBy: string; sortDir: string; onSort: (f: string) => void; className?: string;
}) {
  return (
    <TableHead className={cn('cursor-pointer select-none hover:text-foreground/80', className)} onClick={() => onSort(field)}>
      <div className="flex items-center gap-1">{label}{sortBy === field && <ChevronRight size={12} className={cn('transition-transform', sortDir === 'desc' && '-rotate-90')} />}</div>
    </TableHead>
  );
}

function TableSkeleton() {
  return Array.from({ length: 8 }).map((_, i) => (
    <TableRow key={i}>
      <TableCell><Skeleton className="h-4 w-4" /></TableCell>
      <TableCell><Skeleton className="h-4 w-36" /></TableCell>
      <TableCell className="hidden lg:table-cell"><Skeleton className="h-4 w-28" /></TableCell>
      <TableCell className="hidden md:table-cell"><Skeleton className="h-4 w-20" /></TableCell>
      <TableCell className="hidden md:table-cell"><Skeleton className="h-4 w-16" /></TableCell>
      <TableCell><Skeleton className="h-4 w-14" /></TableCell>
      <TableCell><Skeleton className="h-4 w-10" /></TableCell>
      <TableCell className="hidden sm:table-cell"><Skeleton className="h-4 w-20" /></TableCell>
      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
      <TableCell className="hidden sm:table-cell"><Skeleton className="h-4 w-14" /></TableCell>
      <TableCell><Skeleton className="h-4 w-4 ml-auto" /></TableCell>
    </TableRow>
  ));
}

function CompanyCard({ c, onClick }: { c: CompanyRow; onClick: () => void }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} whileHover={{ y: -2 }} onClick={onClick}
      className="rounded-xl border p-4 cursor-pointer transition-shadow hover:shadow-md flex flex-col gap-3"
      style={{ background: 'rgba(255,255,255,.85)', borderColor: 'rgba(0,0,0,.05)' }}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-gray-900 truncate">{c.rawName}</h3>
          {c.domain && <p className="text-xs text-gray-500 truncate mt-0.5 flex items-center gap-1"><Globe size={11} />{c.domain}</p>}
        </div>
        {c.isEnriched && <Badge variant="outline" className="text-[8px] font-bold uppercase tracking-wider shrink-0 border-emerald-300 text-emerald-700 bg-emerald-50 px-1.5">AI</Badge>}
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          {c.industry && <Badge variant="secondary" className="text-[11px]">{c.industry}</Badge>}
          {c.country && <span className="text-[11px] text-gray-400 flex items-center gap-0.5"><MapPin size={10} />{c.country}</span>}
        </div>
        <StatusBadge status={c.status} />
      </div>
      <div className="flex items-center justify-between pt-1 border-t border-gray-100">
        <span className="text-[11px] text-gray-500 flex items-center gap-1"><Users size={12} /><span className="font-medium">{c.contactCount}</span> contacts</span>
        <ScoreCircle score={c.intelligenceScore} />
      </div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Company Dialog (Create / Edit)
   ═══════════════════════════════════════════════════════════════ */

function CompanyDialog({ open, onOpenChange, editing, onSubmit, submitting }: {
  open: boolean; onOpenChange: (o: boolean) => void; editing: CompanyRow | null;
  onSubmit: (f: Form, id?: string) => void; submitting: boolean;
}) {
  const [form, setForm] = useState<Form>(() => editing
    ? { rawName: editing.rawName, domain: editing.domain ?? '', industry: editing.industry ?? '', sizeRange: editing.sizeRange ?? '', country: editing.country ?? '', website: '', notes: '' }
    : blankForm());

  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm(f => ({ ...f, [k]: e.target.value }));
  const valid = form.rawName.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">{editing ? 'Edit Company' : 'Add New Company'}</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">{editing ? 'Update company details.' : 'Name is required; other fields are optional.'}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3.5 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Company Name <span className="text-red-500">*</span></Label>
            <Input placeholder="e.g. Acme Corp" value={form.rawName} onChange={set('rawName')} className="h-9 text-sm" autoFocus
              onKeyDown={e => { if (e.key === 'Enter' && valid) onSubmit(form, editing?.id); }} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label className="text-xs font-medium">Domain</Label><Input placeholder="acme.com" value={form.domain} onChange={set('domain')} className="h-9 text-sm" /></div>
            <div className="space-y-1.5"><Label className="text-xs font-medium">Website</Label><Input placeholder="https://acme.com" value={form.website} onChange={set('website')} className="h-9 text-sm" /></div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Industry</Label>
            <Input placeholder="e.g. Technology" value={form.industry} onChange={set('industry')} className="h-9 text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Size Range</Label>
              <Select value={form.sizeRange} onValueChange={v => setForm(f => ({ ...f, sizeRange: v }))}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select size" /></SelectTrigger>
                <SelectContent>{SIZE_RANGES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label className="text-xs font-medium">Country</Label><Input placeholder="e.g. US" value={form.country} onChange={set('country')} className="h-9 text-sm" /></div>
          </div>
          <div className="space-y-1.5"><Label className="text-xs font-medium">Notes</Label>
            <Textarea placeholder="Internal notes..." value={form.notes} onChange={set('notes')} className="text-sm min-h-[56px] resize-none" />
          </div>
        </div>
        <DialogFooter className="gap-2 pt-2">
          <Button variant="outline" size="sm" className="text-xs" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button size="sm" className="text-xs font-medium" disabled={submitting || !valid} onClick={() => onSubmit(form, editing?.id)}
            style={{ background: 'var(--color-gold)', color: '#0c1220' }}>
            {submitting ? <Loader2 size={14} className="mr-1.5 animate-spin" /> : <Plus size={14} className="mr-1.5" />}
            {submitting ? 'Saving...' : editing ? 'Update' : 'Add Company'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Main Component
   ═══════════════════════════════════════════════════════════════ */

export default function CompaniesScreen() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [industry, setIndustry] = useState('');
  const [status, setStatus] = useState('');
  const [sizeRange, setSizeRange] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const [view, setView] = useState<'table' | 'grid'>('table');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dlgOpen, setDlgOpen] = useState(false);
  const [editing, setEditing] = useState<CompanyRow | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const updateSearch = useCallback((v: string) => {
    setSearch(v); setPage(1); clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setDebounced(v), 300);
  }, []);
  useEffect(() => () => clearTimeout(timerRef.current), []);
  useEffect(() => setPage(1), [industry, status, sizeRange]);

  /* ── Queries ── */
  const { data, isLoading } = useQuery({
    queryKey: ['companies', page, debounced, industry, status, sizeRange, sortBy, sortDir],
    queryFn: async () => {
      const { data: d, error } = await fetchApi('/api/companies', { params: {
        page, limit: 20, search: debounced || undefined, industry: industry || undefined,
        status: status || undefined, sizeRange: sizeRange || undefined, sortBy, sortDir,
      }});
      if (error) throw new Error(error);
      return d!;
    },
  });
  const companies = data?.companies ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / 20));

  const { data: meta } = useQuery({
    queryKey: ['companies-meta'],
    queryFn: async () => { const { data: d, error } = await fetchApi('/api/companies/meta'); if (error) throw new Error(error); return d!; },
    staleTime: 60_000,
  });
  const industries = meta?.industries ?? [];

  /* ── Mutations ── */
  const invalidate = () => qc.invalidateQueries({ queryKey: ['companies'] });

  const handleSubmit = useCallback(async (form: Form, id?: string) => {
    setSubmitting(true);
    try {
      if (id) {
        const body: Record<string, string> = {};
        Object.entries(form).forEach(([k, v]) => { if (v) body[k === 'notes' ? 'internalSummary' : k] = v; });
        const { error } = await fetchApi(`/api/companies/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        if (error) throw new Error(error);
        toast.success('Company updated');
      } else {
        const { error, data: d } = await fetchApi('/api/companies', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rawName: form.rawName, domain: form.domain || undefined, industry: form.industry || undefined, sizeRange: form.sizeRange || undefined, country: form.country || undefined, website: form.website || undefined }),
        });
        if (error) throw new Error(error);
        if ((d as any)?.companyId) { toast.info('Company already exists — navigating'); useAppStore.getState().setSelectedCompanyId((d as any).companyId); }
        else toast.success('Company created');
      }
      invalidate(); setDlgOpen(false); setEditing(null);
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Request failed'); }
    setSubmitting(false);
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    const { error } = await fetchApi(`/api/companies/${id}`, { method: 'DELETE' });
    if (error) { toast.error(error); return; }
    invalidate(); toast.success('Company deleted'); setDeleteId(null);
  }, []);

  /* ── Sort ── */
  const handleSort = useCallback((f: string) => {
    if (sortBy === f) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(f); setSortDir('asc'); }
    setPage(1);
  }, [sortBy]);

  const goTo = useCallback((id: string) => useAppStore.getState().setSelectedCompanyId(id), []);

  /* ── Bulk ── */
  const allSel = companies.length > 0 && companies.every(c => selected.has(c.id));
  const someSel = selected.size > 0 && !allSel;
  const toggleAll = () => allSel ? setSelected(new Set()) : setSelected(new Set(companies.map(c => c.id)));

  const bulkDelete = async () => {
    if (!selected.size) return;
    await Promise.all([...selected].map(id => fetchApi(`/api/companies/${id}`, { method: 'DELETE' })));
    invalidate(); toast.success(`Deleted ${selected.size} companies`); setSelected(new Set());
  };

  const bulkEnrich = async () => {
    if (!selected.size) return;
    toast.loading(`Enriching ${selected.size} companies…`, { id: 'enrich' });
    const { error } = await fetchApi('/api/companies/enrich', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ companyIds: [...selected] }),
    });
    if (error) toast.error('Enrichment failed', { id: 'enrich' });
    else toast.success(`Enrichment queued for ${selected.size} companies`, { id: 'enrich' });
    setSelected(new Set());
  };

  const activeFilters = [search, industry, status, sizeRange].filter(Boolean).length;
  const showEmpty = !isLoading && companies.length === 0;

  /* ═══════════════════════════════════════════════════════════════
     Render
     ═══════════════════════════════════════════════════════════════ */
  return (
    <div className="flex flex-col gap-5 h-full overflow-hidden">
      {/* ── Header ── */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2.5">
            <h1 className="text-lg font-bold tracking-tight text-gray-900">Companies</h1>
            <Badge variant="secondary" className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">{total}</Badge>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-lg border border-gray-200 p-0.5" style={{ background: 'rgba(255,255,255,.85)' }}>
              <Button variant="ghost" size="sm" className={cn('h-7 w-7 p-0', view === 'table' && 'bg-gray-100')} onClick={() => setView('table')}><List size={14} /></Button>
              <Button variant="ghost" size="sm" className={cn('h-7 w-7 p-0', view === 'grid' && 'bg-gray-100')} onClick={() => setView('grid')}><LayoutGrid size={14} /></Button>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 px-3 text-xs font-medium"><Download size={14} className="mr-1.5" />Export</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => { exportCSV(companies); toast.success(`Exported ${companies.length}`); }}>Export All</DropdownMenuItem>
                {selected.size > 0 && <DropdownMenuItem onClick={() => { exportCSV(companies.filter(c => selected.has(c.id))); toast.success(`Exported ${selected.size}`); }}>Export Selected ({selected.size})</DropdownMenuItem>}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button size="sm" onClick={() => { setEditing(null); setDlgOpen(true); }}
              className="h-8 px-3 text-xs font-semibold rounded-lg" style={{ background: 'var(--color-gold)', color: '#0c1220' }}>
              <Plus size={14} className="mr-1.5" />Add Company
            </Button>
          </div>
        </div>

        {/* ── Filters ── */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input placeholder="Search name, domain, industry…" value={search} onChange={e => updateSearch(e.target.value)} className="h-8 pl-8 pr-8 text-xs rounded-lg" />
            {search && <button onClick={() => { setSearch(''); setDebounced(''); setPage(1); }} className="absolute right-2.5 top-1/2 -translate-y-1/2"><X size={12} className="text-gray-400" /></button>}
          </div>
          <FilterSelect value={industry} onChange={v => setIndustry(v)} placeholder="All Industries" items={industries.slice(0, 20)} />
          <FilterSelect value={status} onChange={v => setStatus(v)} placeholder="All Statuses" items={STATUS_OPTIONS.map(statusLabel)} keys={STATUS_OPTIONS} />
          <FilterSelect value={sizeRange} onChange={v => setSizeRange(v)} placeholder="All Sizes" items={SIZE_RANGES} />
          {activeFilters > 0 && (
            <Button variant="ghost" size="sm" className="h-8 text-xs text-gray-500" onClick={() => { setSearch(''); setDebounced(''); setIndustry(''); setStatus(''); setSizeRange(''); setPage(1); }}>Clear all</Button>
          )}
        </div>
      </div>

      {/* ── Bulk Actions ── */}
      <AnimatePresence>
        {selected.size > 0 && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="flex items-center gap-3 px-4 py-2.5 rounded-xl border" style={{ background: 'rgba(59,130,246,.04)', borderColor: 'rgba(59,130,246,.15)' }}>
            <Check size={14} className="text-blue-600" />
            <span className="text-xs font-medium text-blue-600">{selected.size} selected</span>
            <Button variant="outline" size="sm" className="h-7 text-xs ml-2" onClick={bulkDelete}><Trash2 size={12} className="mr-1" />Delete</Button>
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => { exportCSV(companies.filter(c => selected.has(c.id))); toast.success(`Exported ${selected.size}`); }}><Download size={12} className="mr-1" />Export</Button>
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={bulkEnrich} style={{ borderColor: 'rgba(212,175,55,.4)', color: 'var(--color-gold)' }}><Sparkles size={12} className="mr-1" />AI Enrich</Button>
            <Button variant="ghost" size="sm" className="h-7 text-xs ml-auto text-gray-400" onClick={() => setSelected(new Set())}>Clear</Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Content ── */}
      <div className="flex-1 min-h-0">
        {showEmpty ? (
          <EmptyState icon={Building2}
            title={activeFilters > 0 ? 'No companies match your criteria' : 'Your intelligence database is empty'}
            description={activeFilters > 0 ? 'Try adjusting your filters.' : 'Import companies to activate AI-powered signal detection, scoring, and opportunity identification.'}
            actionLabel={activeFilters > 0 ? undefined : 'Import Companies'}
            onAction={activeFilters > 0 ? undefined : () => useAppStore.getState().setActiveView('import')}
            secondaryActionLabel="Add Company Manually" onSecondaryAction={() => setDlgOpen(true)} />
        ) : view === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 overflow-y-auto h-full pb-4" style={{ maxHeight: 'calc(100vh - 320px)' }}>
            <AnimatePresence mode="popLayout">{companies.map(c => <CompanyCard key={c.id} c={c} onClick={() => goTo(c.id)} />)}</AnimatePresence>
          </div>
        ) : (
          <div className="rounded-xl border overflow-hidden flex flex-col" style={{ background: 'rgba(255,255,255,.85)', borderColor: 'rgba(0,0,0,.05)', height: 'calc(100vh - 320px)' }}>
            <div className="overflow-x-auto flex-1 min-h-0">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-10"><Checkbox checked={allSel} ref={el => { if (el) el.dataset.state = allSel ? 'checked' : someSel ? 'mixed' : 'unchecked'; }} onCheckedChange={toggleAll} /></TableHead>
                    <SortHead label="Company" field="name" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} className="min-w-[200px]" />
                    <TableHead className="hidden lg:table-cell text-muted-foreground">Domain</TableHead>
                    <TableHead className="hidden md:table-cell text-muted-foreground">Industry</TableHead>
                    <SortHead label="Size" field="sizeRange" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} className="hidden md:table-cell" />
                    <TableHead className="text-muted-foreground">Country</TableHead>
                    <SortHead label="Contacts" field="contacts" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                    <SortHead label="Score" field="score" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} className="hidden sm:table-cell" />
                    <TableHead className="text-muted-foreground">Status</TableHead>
                    <SortHead label="Updated" field="updatedAt" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} className="hidden sm:table-cell" />
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? <TableSkeleton /> : (
                    <AnimatePresence mode="popLayout">
                      {companies.map((c, i) => (
                        <motion.tr key={c.id} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 6 }}
                          transition={{ duration: .2, delay: i * .015 }} onClick={() => goTo(c.id)}
                          className="cursor-pointer border-b border-gray-50 hover:bg-gray-50/60 transition-colors">
                          <TableCell onClick={e => e.stopPropagation()}>
                            <Checkbox checked={selected.has(c.id)} onCheckedChange={() => setSelected(p => { const n = new Set(p); if (n.has(c.id)) { n.delete(c.id); } else { n.add(c.id); } return n; })} />
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-semibold text-gray-900 truncate max-w-[180px]">{c.rawName}</span>
                              {c.isEnriched && <Badge variant="outline" className="text-[8px] font-bold uppercase tracking-wider shrink-0 border-emerald-300 text-emerald-700 bg-emerald-50 px-1 py-px">AI</Badge>}
                            </div>
                          </TableCell>
                          <TableCell className="hidden lg:table-cell">{c.domain ? <span className="text-xs text-gray-500 truncate">{c.domain}</span> : <span className="text-xs text-gray-300">—</span>}</TableCell>
                          <TableCell className="hidden md:table-cell">{c.industry ? <Badge variant="secondary" className="text-[11px]">{c.industry}</Badge> : <span className="text-xs text-gray-300">—</span>}</TableCell>
                          <TableCell className="hidden md:table-cell">{c.sizeRange ? <Badge variant="secondary" className="text-[11px]">{c.sizeRange}</Badge> : <span className="text-xs text-gray-300">—</span>}</TableCell>
                          <TableCell>{c.country ? <span className="text-xs text-gray-500">{c.country}</span> : <span className="text-xs text-gray-300">—</span>}</TableCell>
                          <TableCell>{c.contactCount > 0 ? <span className="text-[11px] font-semibold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full">{c.contactCount}</span> : <span className="text-xs text-gray-300">0</span>}</TableCell>
                          <TableCell className="hidden sm:table-cell"><ScoreBar score={c.intelligenceScore} /></TableCell>
                          <TableCell><StatusBadge status={c.status} /></TableCell>
                          <TableCell className="hidden sm:table-cell"><span className="text-[11px] text-gray-400">{relativeTime(c.updatedAt)}</span></TableCell>
                          <TableCell onClick={e => e.stopPropagation()}>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild><Button variant="ghost" size="sm" className="h-7 w-7 p-0"><MoreHorizontal size={14} className="text-gray-400" /></Button></DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => goTo(c.id)}><Eye size={14} className="mr-2" />View</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => { setEditing(c); setDlgOpen(true); }}><Pencil size={14} className="mr-2" />Edit</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => {
                                  toast.loading('AI research…', { id: 'ai' });
                                  fetchApi(`/api/ai/account-brief?companyId=${c.id}`).then(({ data: d }) => { toast.success('AI brief generated!', { id: 'ai' }); goTo(c.id); }).catch(() => toast.error('AI research failed', { id: 'ai' }));
                                }}><Sparkles size={14} className="mr-2" />AI Research</DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="text-red-600" onClick={() => setDeleteId(c.id)}><Trash2 size={14} className="mr-2" />Delete</DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </motion.tr>
                      ))}
                    </AnimatePresence>
                  )}
                </TableBody>
              </Table>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-2.5 border-t border-gray-100 shrink-0">
                <span className="text-xs text-gray-500">{(page - 1) * 20 + 1}–{Math.min(page * 20, total)} of {total}</span>
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={page <= 1} onClick={() => setPage(p => p - 1)}><ChevronLeft size={14} /></Button>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let p: number;
                    if (totalPages <= 5) p = i + 1;
                    else if (page <= 3) p = i + 1;
                    else if (page >= totalPages - 2) p = totalPages - 4 + i;
                    else p = page - 2 + i;
                    return <Button key={p} variant={p === page ? 'default' : 'outline'} size="sm" className={cn('h-7 w-7 p-0 text-xs', p === page && 'bg-amber-500 hover:bg-amber-600 text-white')} onClick={() => setPage(p)}>{p}</Button>;
                  })}
                  <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}><ChevronRight size={14} /></Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Dialogs ── */}
      <CompanyDialog key={editing?.id ?? '__new__'} open={dlgOpen} onOpenChange={v => { setDlgOpen(v); if (!v) setEditing(null); }} editing={editing} onSubmit={handleSubmit} submitting={submitting} />

      <AlertDialog open={!!deleteId} onOpenChange={v => !v && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Company</AlertDialogTitle>
            <AlertDialogDescription>This will permanently remove the company and all associated data.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700 text-white" onClick={() => deleteId && handleDelete(deleteId)}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   FilterSelect helper
   ═══════════════════════════════════════════════════════════════ */

function FilterSelect({ value, onChange, placeholder, items, keys }: {
  value: string; onChange: (v: string) => void; placeholder: string;
  items: string[]; keys?: string[];
}) {
  return (
    <Select value={value || '__all__'} onValueChange={v => onChange(v === '__all__' ? '' : v)}>
      <SelectTrigger className="h-8 w-[140px] text-xs"><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent>
        <SelectItem value="__all__">{placeholder}</SelectItem>
        {items.map((item, i) => <SelectItem key={keys?.[i] ?? item} value={keys?.[i] ?? item}>{item}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}
