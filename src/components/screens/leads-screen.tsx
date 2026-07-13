'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  Search, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
  Filter, X, ExternalLink, Building2, Mail, MapPin, Briefcase, Globe, Users,
  ArrowUpDown, SlidersHorizontal, Database, MailCheck, FileEdit, Send, Sparkles,
  Loader2, CheckCircle2, Brain, ShieldCheck, ShieldAlert, ShieldX, UserPlus,
  StickyNote, Clock, Activity, Tag, AlertTriangle, SendHorizontal, Linkedin,
  Link, CalendarDays, Handshake, Inbox, List, MousePointerClick,
  Download, Copy, RefreshCw, GitMerge, Eye, Ban,
} from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PageTransition, AnimatedCard, SectionHeader, StatCard, StaggerGrid, StaggerItem,
  GlassPanel, EmptyState, ShimmerText, TabBar,
} from '@/components/ui/animated-components';

/* ══════════════════════════ Types ══════════════════════════════ */

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
  };
}

interface LeadsResponse {
  leads: Lead[]; total: number; page: number; totalPages: number; _source?: string;
}

type SortDir = 'asc' | 'desc';
const SORTABLE_COLUMNS = ['company', 'country', 'city', 'industry', 'title', 'score'] as const;
type SortColumn = (typeof SORTABLE_COLUMNS)[number];
const PAGE_SIZE_OPTIONS = [25, 50, 100];

interface TimelineEvent {
  type: string; title: string; description: string; timestamp: string; metadata?: Record<string, unknown>;
}

interface ContactNote {
  id: string; body: string; createdAt: string; updatedAt: string;
}

const CONSENT_COLORS: Record<string, string> = {
  opted_in: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  unknown: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  opted_out: 'bg-red-500/20 text-red-300 border-red-500/30',
};

const HEALTH_COLORS: Record<string, string> = {
  valid: 'bg-emerald-500/20 text-emerald-300',
  risky: 'bg-amber-500/20 text-amber-300',
  invalid: 'bg-red-500/20 text-red-300',
  unknown: 'bg-zinc-500/20 text-zinc-400',
};

const SOURCE_ICONS: Record<string, typeof Linkedin> = {
  linkedin: Linkedin, event: CalendarDays, referral: Handshake, cold_list: List,
  inbound: MousePointerClick, manual: Database, purchased: Inbox,
};

const TIMELINE_ICONS: Record<string, typeof Activity> = {
  import: Database, verify: MailCheck, draft_created: FileEdit, draft_approved: CheckCircle2,
  email_sent: Send, email_opened: Eye, email_replied: Mail, bounce: Ban,
  status_change: Activity, note_added: StickyNote, enrichment: Sparkles,
};

/* ═════════════════════════ Multi-Select Dropdown ══════════════════════════════ */

function MultiSelectDropdown({ label, options, selected, onChange, totalCount }: {
  label: string; options: MetaItem[]; selected: string[]; onChange: (v: string[]) => void; totalCount: number;
}) {
  const [open, setOpen] = useState(false);
  const [localSearch, setLocalSearch] = useState('');
  const filtered = localSearch ? options.filter(o => o.v.toLowerCase().includes(localSearch.toLowerCase())) : options;

  const toggle = (v: string) => { onChange(selected.includes(v) ? selected.filter(x => x !== v) : [...selected, v]); };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs font-normal border-white/[0.1] bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/[0.15] transition-all duration-200">
          <span className="truncate max-w-[120px]">{label}</span>
          {selected.length > 0 && <Badge className="bg-primary/15 border-primary/25 text-primary text-[10px] h-4 min-w-4 px-1.5 rounded-full font-semibold">{selected.length}</Badge>}
          <span className="text-muted-foreground text-[10px]">({totalCount})</span>
          <ChevronDown className="w-3 h-3 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0 border-white/[0.1] bg-black/60 backdrop-blur-2xl shadow-2xl shadow-black/40" align="start">
        <div className="p-2.5 border-b border-white/[0.08]">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input placeholder={`Search ${label.toLowerCase()}...`} value={localSearch} onChange={e => setLocalSearch(e.target.value)} className="h-7 pl-8 text-xs bg-white/[0.05] border-white/[0.1] text-foreground placeholder:text-muted-foreground/60 focus:border-primary/30" />
          </div>
        </div>
        {selected.length > 0 && (
          <div className="px-2.5 py-2 border-b border-white/[0.08] flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground">{selected.length} selected</span>
            <Button variant="ghost" size="sm" className="h-5 text-[10px] text-muted-foreground hover:text-foreground px-1.5" onClick={e => { e.stopPropagation(); onChange([]); }}>Clear</Button>
          </div>
        )}
        <div className="max-h-60 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">No results</div>
          ) : filtered.map(option => (
            <label key={option.v} className="flex items-center gap-2.5 px-2.5 py-2 hover:bg-white/[0.04] cursor-pointer transition-colors">
              <Checkbox checked={selected.includes(option.v)} onCheckedChange={() => toggle(option.v)} className="h-3.5 w-3.5" />
              <span className="text-xs text-foreground truncate flex-1">{option.v}</span>
              <span className="text-[10px] text-muted-foreground/60 shrink-0 tabular-nums">{option.c.toLocaleString()}</span>
            </label>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/* ═════════════════════════ Main Component ═══════════════════════════ */

export default function LeadsScreen({ navigateTo }: { navigateTo?: (screen: string) => void }) {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [metaLoading, setMetaLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [countries, setCountries] = useState<string[]>([]);
  const [industries, setIndustries] = useState<string[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [titles, setTitles] = useState<string[]>([]);
  const [empCats, setEmpCats] = useState<string[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [states, setStates] = useState<string[]>([]);
  const [statuses, setStatuses] = useState<string[]>([]);
  const [consentFilter, setConsentFilter] = useState<string[]>([]);
  const [assigneeFilter, setAssigneeFilter] = useState<string[]>([]);
  const [sourceFilter, setSourceFilter] = useState<string[]>([]);

  const [leads, setLeads] = useState<Lead[]>([]);
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [sortBy, setSortBy] = useState<SortColumn>('company');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const [filtersOpen, setFiltersOpen] = useState(true);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [generatingEmail, setGeneratingEmail] = useState(false);
  const [generatedDraft, setGeneratedDraft] = useState<any>(null);
  const [emailGenError, setEmailGenError] = useState('');

  /* L-10: Verify queue */
  const [verifying, setVerifying] = useState(false);

  /* L-11: Timeline */
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [detailTab, setDetailTab] = useState('info');

  /* L-13: Notes */
  const [notes, setNotes] = useState<ContactNote[]>([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [newNote, setNewNote] = useState('');

  /* L-14: Assignment */
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [assignMethod, setAssignMethod] = useState('manual');
  const [assignTo, setAssignTo] = useState('Ravi Shanker');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  /* L-02: Score tooltip */
  const [scoreBreakdowns, setScoreBreakdowns] = useState<Record<string, any>>({});
  const [recalculating, setRecalculating] = useState(false);

  /* L-05: Export */
  const [exporting, setExporting] = useState(false);

  /* L-06: Dedup */
  const [dedupOpen, setDedupOpen] = useState(false);
  const [dedupLoading, setDedupLoading] = useState(false);
  const [dedupGroups, setDedupGroups] = useState<{contacts: any[]; matchType: string}[]>([]);
  const [merging, setMerging] = useState(false);

  /* L-07: Status transitions */
  const [statusTransitions, setStatusTransitions] = useState<Record<string, string[]>>({});
  const [transitioningId, setTransitioningId] = useState<string | null>(null);

  /* Debounce */
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const activeFilterCount = [
    countries.length, industries.length, departments.length, titles.length,
    empCats.length, cities.length, states.length, statuses.length,
    consentFilter.length, assigneeFilter.length, sourceFilter.length,
    search.trim().length > 0,
  ].filter(Boolean).length;

  useEffect(() => {
    let cancelled = false;
    async function fetchMeta() {
      try {
        setMetaLoading(true);
        const res = await fetch('/api/leads?meta=true');
        if (!res.ok) throw new Error();
        const data = await res.json();
        if (!cancelled && data.meta) setMeta(data.meta);
      } catch { if (!cancelled) toast.error('Failed to load filter options'); }
      finally { if (!cancelled) setMetaLoading(false); }
    }
    fetchMeta();
    return () => { cancelled = true; };
  }, []);

  const buildQueryString = useCallback(() => {
    const params = new URLSearchParams();
    if (search.trim()) params.set('search', search.trim());
    if (countries.length) params.set('country', countries.join(','));
    if (industries.length) params.set('industry', industries.join(','));
    if (departments.length) params.set('department', departments.join(','));
    if (titles.length) params.set('title', titles.join(','));
    if (empCats.length) params.set('empCat', empCats.join(','));
    if (cities.length) params.set('city', cities.join(','));
    if (states.length) params.set('state', states.join(','));
    if (statuses.length) params.set('status', statuses.join(','));
    if (consentFilter.length) params.set('consentStatus', consentFilter.join(','));
    if (assigneeFilter.length) params.set('assignee', assigneeFilter.join(','));
    if (sourceFilter.length) params.set('source', sourceFilter.join(','));
    params.set('sortBy', sortBy);
    params.set('sortDir', sortDir);
    params.set('page', String(page));
    params.set('limit', String(limit));
    return params.toString();
  }, [search, countries, industries, departments, titles, empCats, cities, states, statuses, consentFilter, assigneeFilter, sourceFilter, sortBy, sortDir, page, limit]);

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

  useEffect(() => { setPage(1); }, [search, countries, industries, departments, titles, empCats, cities, states, statuses, consentFilter, assigneeFilter, sourceFilter, limit]);

  const handleSort = (col: SortColumn) => {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('asc'); }
    setPage(1);
  };

  const clearAllFilters = () => {
    setSearch(''); setCountries([]); setIndustries([]); setDepartments([]);
    setTitles([]); setEmpCats([]); setCities([]); setStates([]);
    setStatuses([]); setConsentFilter([]); setAssigneeFilter([]); setSourceFilter([]);
    setPage(1);
  };

  /* L-10: Verify all unverified emails */
  const handleVerifyAll = async () => {
    setVerifying(true);
    try {
      await fetch('/api/verify-queue', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ verifyAll: true }) });
      // Process immediately
      const processRes = await fetch('/api/verify-queue/process', { method: 'POST' });
      const processData = await processRes.json();
      toast.success(processData.message || 'Verification started');
      fetchLeads();
    } catch { toast.error('Verification failed'); }
    setVerifying(false);
  };

  /* L-10: Verify single email */
  const handleVerifySingle = async (lead: Lead, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await fetch('/api/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: lead.email }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`${lead.email}: ${data.result.status} (score: ${data.result.score})`);
        fetchLeads();
      }
    } catch { toast.error('Verification failed'); }
  };

  /* L-11 & L-13: Open detail panel */
  const openDetail = async (lead: Lead) => {
    setSelectedLead(lead);
    setGeneratedDraft(null);
    setEmailGenError('');
    setDetailTab('info');
    setNotes([]);
    setTimeline([]);
    setNewNote('');
    setDetailOpen(true);

    // Load timeline
    if (lead._dbFields) {
      setTimelineLoading(true);
      setNotesLoading(true);
      fetch(`/api/contacts/${lead.id}/timeline`)
        .then(r => r.json())
        .then(d => { if (d.timeline) setTimeline(d.timeline); })
        .catch(() => {})
        .finally(() => setTimelineLoading(false));

      fetch(`/api/contacts/${lead.id}/notes`)
        .then(r => r.json())
        .then(d => { if (Array.isArray(d)) setNotes(d); })
        .catch(() => {})
        .finally(() => setNotesLoading(false));
    }
  };

  /* L-13: Add note */
  const handleAddNote = async () => {
    if (!selectedLead || !newNote.trim()) return;
    try {
      const res = await fetch(`/api/contacts/${selectedLead.id}/notes`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body: newNote.trim() }),
      });
      if (res.ok) {
        const note = await res.json();
        setNotes(prev => [note, ...prev]);
        setNewNote('');
        toast.success('Note added');
      }
    } catch { toast.error('Failed to add note'); }
  };

  /* L-12: Update consent */
  const handleUpdateConsent = async (contactId: string, status: string) => {
    try {
      await fetch('/api/leads/consent', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: contactId, consentStatus: status }),
      });
      toast.success(`Consent updated to ${status}`);
      fetchLeads();
    } catch { toast.error('Failed to update consent'); }
  };

  /* L-14: Assign leads */
  const handleAssign = async () => {
    const ids = selectedIds.size > 0 ? Array.from(selectedIds) : leads.map(l => l.id);
    if (ids.length === 0) { toast.error('No leads to assign'); return; }
    try {
      const res = await fetch('/api/leads/assign', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactIds: ids, assignTo: assignMethod === 'manual' ? assignTo : undefined, method: assignMethod }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        setSelectedIds(new Set());
        setAssignDialogOpen(false);
        fetchLeads();
      }
    } catch { toast.error('Assignment failed'); }
  };

  /* Generate AI email */
  const handleGenerateEmail = async () => {
    if (!selectedLead) return;
    setGeneratingEmail(true); setGeneratedDraft(null); setEmailGenError('');
    try {
      const res = await fetch('/api/drafts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: selectedLead.rawName, email: selectedLead.email, title: selectedLead.title, company: selectedLead.company, industry: selectedLead.industry, companySize: selectedLead.employeeCategory }),
      });
      const data = await res.json();
      if (data.success && data.draft) {
        setGeneratedDraft({ subject: data.draft.subject, body: data.draft.body, cta: data.draft.cta || '', confidenceScore: data.draft.confidenceScore || 0, generationMethod: data.draft.generationMethod || 'ai', sourceSnippets: data.draft.sourceSnippets || [], assumptionFlags: data.draft.assumptionFlags || [] });
        toast.success(`Email generated for ${selectedLead.rawName}`);
      } else { setEmailGenError(data.error || 'Generation failed'); toast.error(data.error || 'Email generation failed'); }
    } catch { setEmailGenError('Network error'); toast.error('Network error'); }
    setGeneratingEmail(false);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  };

  const showingFrom = total === 0 ? 0 : (page - 1) * limit + 1;
  const showingTo = Math.min(page * limit, total);

  /* L-02: Fetch score breakdown for a contact */
  const handleScoreHover = async (contactId: string) => {
    if (scoreBreakdowns[contactId]) return;
    try {
      const res = await fetch('/api/leads/recalculate-scores', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactId }),
      });
      const data = await res.json();
      if (data.breakdown) {
        setScoreBreakdowns(prev => ({ ...prev, [contactId]: data.breakdown }));
      }
    } catch { /* ignore */ }
  };

  /* L-02: Recalculate all scores */
  const handleRecalculateScores = async () => {
    setRecalculating(true);
    try {
      const res = await fetch('/api/leads/recalculate-scores', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
      const data = await res.json();
      if (data.success) {
        toast.success(`Recalculated ${data.updated} lead scores`);
        setScoreBreakdowns({});
        fetchLeads();
      }
    } catch { toast.error('Score recalculation failed'); }
    setRecalculating(false);
  };

  /* L-05: Export CSV */
  const handleExportCSV = async () => {
    setExporting(true);
    try {
      const qs = buildQueryString();
      const ids = selectedIds.size > 0 ? `&ids=${Array.from(selectedIds).join(',')}` : '';
      const res = await fetch(`/api/leads/export?${qs}${ids}`);
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `deepmindq-leads-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('CSV exported');
      } else {
        toast.error('Export failed');
      }
    } catch { toast.error('Export failed'); }
    setExporting(false);
  };

  /* L-06: Find duplicates */
  const handleFindDuplicates = async () => {
    setDedupLoading(true);
    setDedupOpen(true);
    try {
      const res = await fetch('/api/leads/dedup');
      const data = await res.json();
      setDedupGroups(data.groups || []);
    } catch { toast.error('Failed to find duplicates'); }
    setDedupLoading(false);
  };

  /* L-06: Merge duplicates */
  const handleMergeGroup = async (primaryId: string, secondaryIds: string[]) => {
    setMerging(true);
    try {
      const res = await fetch('/api/leads/dedup', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ primaryId, secondaryIds }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Merged ${data.mergedCount} contact(s)`);
        setDedupGroups(prev => prev.filter(g => g.contacts[0]?.id !== primaryId));
        fetchLeads();
      } else {
        toast.error(data.error || 'Merge failed');
      }
    } catch { toast.error('Merge failed'); }
    setMerging(false);
  };

  /* L-07: Get valid transitions for a status */
  const getTransitions = async (contactId: string, currentStatus: string) => {
    if (statusTransitions[contactId]) return statusTransitions[contactId];
    try {
      const res = await fetch(`/api/leads/status?status=${currentStatus}`);
      const data = await res.json();
      if (data.validTransitions) {
        setStatusTransitions(prev => ({ ...prev, [contactId]: data.validTransitions }));
        return data.validTransitions;
      }
    } catch { /* ignore */ }
    return [];
  };

  /* L-07: Transition contact status */
  const handleTransitionStatus = async (contactId: string, newStatus: string) => {
    setTransitioningId(contactId);
    try {
      const res = await fetch('/api/leads/status', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: contactId, status: newStatus }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Status changed to ${newStatus}`);
        setStatusTransitions(prev => { const n = { ...prev }; delete n[contactId]; return n; });
        fetchLeads();
      } else {
        toast.error(data.error || 'Status change failed');
      }
    } catch { toast.error('Status change failed'); }
    setTransitioningId(null);
  };

  const SortIcon = ({ col }: { col: SortColumn }) => {
    if (sortBy !== col) return <ArrowUpDown className="w-3 h-3 ml-1 opacity-30 inline" />;
    return sortDir === 'asc' ? <ChevronUp className="w-3 h-3 ml-1 text-primary inline" /> : <ChevronDown className="w-3 h-3 ml-1 text-primary inline" />;
  };

  const formatTime = (ts: string) => {
    try { const d = new Date(ts); return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
    catch { return ts; }
  };

  /* ═════════════════════════ Render ═══════════════════════════════════════════ */

  return (
    <PageTransition>
    <div className="space-y-8">

      {/* Header */}
      <div className="flex flex-col gap-2 pt-2">
        <div className="flex items-center gap-4">
          <div className="h-10 w-2 rounded-full" style={{ background: 'linear-gradient(180deg, #E8C860, #D4AF37, #9A8340)', boxShadow: '0 0 20px rgba(212, 175, 55, 0.3)' }} />
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground"><ShimmerText>Leads</ShimmerText></h1>
            <p className="text-sm text-muted-foreground mt-1 ml-1">{metaLoading ? 'Loading contacts...' : `${(meta?.totalRecords ?? 0).toLocaleString()} total contacts in database`}</p>
          </div>
        </div>
      </div>

      {/* Stat Cards */}
      <StaggerGrid className="grid grid-cols-2 lg:grid-cols-5 gap-4" stagger={0.06}>
        <StaggerItem><StatCard label="Total Leads" value={meta?.totalRecords ?? 0} icon={Database} color="#D4AF37" delay={0} /></StaggerItem>
        <StaggerItem><StatCard label="Verified" value={leads.filter(l => l._dbFields?.emailHealth && l._dbFields.emailHealth !== 'unknown').length} icon={MailCheck} color="#10B981" delay={0.06} /></StaggerItem>
        <StaggerItem><StatCard label="Results" value={total} icon={FileEdit} color="#6366F1" delay={0.12} /></StaggerItem>
        <StaggerItem><StatCard label="Filters" value={activeFilterCount} icon={Filter} color="#F59E0B" delay={0.18} /></StaggerItem>
        <StaggerItem><StatCard label="Selected" value={selectedIds.size} icon={Users} color="#EC4899" delay={0.24} /></StaggerItem>
      </StaggerGrid>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" className="h-9 gap-2 text-xs border-white/[0.1] bg-white/[0.03]" onClick={() => setFiltersOpen(!filtersOpen)}>
          <SlidersHorizontal className="w-3.5 h-3.5" />Filters
          {activeFilterCount > 0 && <Badge className="bg-primary/15 border-primary/25 text-primary text-[10px] h-4 min-w-4 px-1.5 rounded-full font-semibold">{activeFilterCount}</Badge>}
        </Button>
        {activeFilterCount > 0 && <Button variant="ghost" size="sm" className="h-9 text-xs text-muted-foreground hover:text-foreground" onClick={clearAllFilters}><X className="w-3 h-3 mr-1" />Clear all</Button>}

        <div className="flex-1" />

        {/* L-10: Verify Emails */}
        <Button variant="outline" size="sm" className="h-9 gap-2 text-xs border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/10" onClick={handleVerifyAll} disabled={verifying}>
          {verifying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MailCheck className="w-3.5 h-3.5" />}
          {verifying ? 'Verifying...' : 'Verify Emails'}
        </Button>

        {/* L-14: Assign */}
        <Button variant="outline" size="sm" className="h-9 gap-2 text-xs border-primary/20 text-primary hover:bg-primary/10" onClick={() => setAssignDialogOpen(true)}>
          <UserPlus className="w-3.5 h-3.5" />Assign {selectedIds.size > 0 ? `(${selectedIds.size})` : ''}
        </Button>

        {/* L-05: Export CSV */}
        <Button variant="outline" size="sm" className="h-9 gap-2 text-xs border-white/[0.1] bg-white/[0.03] hover:bg-white/[0.06]" onClick={handleExportCSV} disabled={exporting}>
          {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
          {exporting ? 'Exporting...' : 'Export CSV'}
        </Button>

        {/* L-06: Find Duplicates */}
        <Button variant="outline" size="sm" className="h-9 gap-2 text-xs border-amber-500/20 text-amber-400 hover:bg-amber-500/10" onClick={handleFindDuplicates}>
          <Copy className="w-3.5 h-3.5" />Find Duplicates
        </Button>

        {/* L-02: Recalculate Scores */}
        <Button variant="outline" size="sm" className="h-9 gap-2 text-xs border-white/[0.1] bg-white/[0.03] hover:bg-white/[0.06]" onClick={handleRecalculateScores} disabled={recalculating}>
          {recalculating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          {recalculating ? 'Recalculating...' : 'Recalc Scores'}
        </Button>
      </div>

      {/* Filter Panel */}
      {filtersOpen && (
        <GlassPanel className="overflow-hidden">
          <div className="p-5 space-y-4">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input ref={searchInputRef} placeholder="Search by name, email, company, title, city, or country..." value={search} onChange={e => setSearch(e.target.value)} className="h-10 pl-10 pr-9 text-sm bg-white/[0.03] border-white/[0.08] text-foreground placeholder:text-muted-foreground/50 focus:border-primary/30" />
              {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"><X className="w-4 h-4" /></button>}
            </div>
            {metaLoading ? (
              <div className="flex flex-wrap gap-2">{Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-9 w-28 rounded-lg bg-white/[0.05]" />)}</div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <MultiSelectDropdown label="Status" options={[{v:'imported',c:0},{v:'cleaned',c:0},{v:'drafted',c:0},{v:'sent',c:0},{v:'replied',c:0},{v:'bounced',c:0}]} selected={statuses} onChange={setStatuses} totalCount={6} />
                <MultiSelectDropdown label="Country" options={meta?.countries ?? []} selected={countries} onChange={setCountries} totalCount={meta?.countries.length ?? 0} />
                <MultiSelectDropdown label="Industry" options={meta?.industries ?? []} selected={industries} onChange={setIndustries} totalCount={meta?.industries.length ?? 0} />
                <MultiSelectDropdown label="Department" options={meta?.departments ?? []} selected={departments} onChange={setDepartments} totalCount={meta?.departments.length ?? 0} />
                <MultiSelectDropdown label="Company Size" options={meta?.employeeCategories ?? []} selected={empCats} onChange={setEmpCats} totalCount={meta?.employeeCategories.length ?? 0} />
                <MultiSelectDropdown label="City" options={meta?.cities ?? []} selected={cities} onChange={setCities} totalCount={meta?.cities.length ?? 0} />
                <MultiSelectDropdown label="State" options={meta?.states ?? []} selected={states} onChange={setStates} totalCount={meta?.states.length ?? 0} />
                {/* L-12: Consent filter */}
                <MultiSelectDropdown label="Consent" options={[{v:'opted_in',c:0},{v:'unknown',c:0},{v:'opted_out',c:0}]} selected={consentFilter} onChange={setConsentFilter} totalCount={3} />
                {/* L-14: Assignee filter */}
                <MultiSelectDropdown label="Assignee" options={meta?.assignees ?? []} selected={assigneeFilter} onChange={setAssigneeFilter} totalCount={meta?.assignees?.length ?? 0} />
                {/* L-15: Source filter */}
                <MultiSelectDropdown label="Source" options={meta?.sources ?? []} selected={sourceFilter} onChange={setSourceFilter} totalCount={meta?.sources?.length ?? 0} />
              </div>
            )}
          </div>
        </GlassPanel>
      )}

      {/* Active Filter Badges */}
      {activeFilterCount > 0 && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] text-muted-foreground/60 mr-1 uppercase tracking-widest font-medium">Active:</span>
          {search.trim() && <Badge className="bg-primary/10 border-primary/20 text-primary text-[10px] h-6 px-2.5 gap-1.5 cursor-pointer hover:bg-primary/20 rounded-full" onClick={() => setSearch('')}>Search: &quot;{search.trim()}&quot;<X className="w-2.5 h-2.5" /></Badge>}
          {countries.map(c => <Badge key={c} className="bg-primary/10 border-primary/20 text-primary text-[10px] h-6 px-2.5 gap-1.5 cursor-pointer hover:bg-primary/20 rounded-full" onClick={() => setCountries(f => f.filter(x => x !== c))}>{c}<X className="w-2.5 h-2.5" /></Badge>)}
          {industries.map(v => <Badge key={v} className="bg-primary/10 border-primary/20 text-primary text-[10px] h-6 px-2.5 gap-1.5 cursor-pointer hover:bg-primary/20 rounded-full" onClick={() => setIndustries(f => f.filter(x => x !== v))}>{v}<X className="w-2.5 h-2.5" /></Badge>)}
          {statuses.map(s => <Badge key={s} className="bg-primary/10 border-primary/20 text-primary text-[10px] h-6 px-2.5 gap-1.5 cursor-pointer hover:bg-primary/20 rounded-full" onClick={() => setStatuses(f => f.filter(x => x !== s))}>{s}<X className="w-2.5 h-2.5" /></Badge>)}
          {consentFilter.map(c => <Badge key={c} className="bg-primary/10 border-primary/20 text-primary text-[10px] h-6 px-2.5 gap-1.5 cursor-pointer hover:bg-primary/20 rounded-full" onClick={() => setConsentFilter(f => f.filter(x => x !== c))}>Consent: {c}<X className="w-2.5 h-2.5" /></Badge>)}
          {sourceFilter.map(s => <Badge key={s} className="bg-primary/10 border-primary/20 text-primary text-[10px] h-6 px-2.5 gap-1.5 cursor-pointer hover:bg-primary/20 rounded-full" onClick={() => setSourceFilter(f => f.filter(x => x !== s))}>Source: {s}<X className="w-2.5 h-2.5" /></Badge>)}
          {assigneeFilter.map(a => <Badge key={a} className="bg-primary/10 border-primary/20 text-primary text-[10px] h-6 px-2.5 gap-1.5 cursor-pointer hover:bg-primary/20 rounded-full" onClick={() => setAssigneeFilter(f => f.filter(x => x !== a))}>{a}<X className="w-2.5 h-2.5" /></Badge>)}
        </motion.div>
      )}

      {/* Leads Table */}
      <GlassPanel className="overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-white/[0.06] hover:bg-transparent">
                <TableHead className="w-10"><Checkbox checked={leads.length > 0 && selectedIds.size === leads.length && leads.every(l => selectedIds.has(l.id))} onCheckedChange={checked => { if (checked) setSelectedIds(new Set(leads.map(l => l.id))); else setSelectedIds(new Set()); }} className="h-3.5 w-3.5" /></TableHead>
                <TableHead className="text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-wider h-11 w-[180px]">Name</TableHead>
                <TableHead className="text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-wider h-11 w-[200px]">Email</TableHead>
                <TableHead className="text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-wider h-11 w-[60px]">Health</TableHead>
                <TableHead className="text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-wider h-11 w-[60px]">Consent</TableHead>
                <TableHead className="text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-wider h-11 w-[55px] cursor-pointer" onClick={() => handleSort('score')}><span className="inline-flex items-center">Score<SortIcon col="score" /></span></TableHead>
                <TableHead className="text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-wider h-11 w-[80px]">Status</TableHead>
                <TableHead className="text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-wider h-11 w-[130px] cursor-pointer" onClick={() => handleSort('title')}><span className="inline-flex items-center">Title<SortIcon col="title" /></span></TableHead>
                <TableHead className="text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-wider h-11 w-[130px] cursor-pointer" onClick={() => handleSort('company')}><span className="inline-flex items-center">Company<SortIcon col="company" /></span></TableHead>
                <TableHead className="text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-wider h-11 w-[100px]">Source</TableHead>
                <TableHead className="text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-wider h-11 w-[80px]">Assignee</TableHead>
                <TableHead className="text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-wider h-11 w-[90px] cursor-pointer" onClick={() => handleSort('country')}><span className="inline-flex items-center">Country<SortIcon col="country" /></span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leadsLoading ? (
                Array.from({ length: 15 }).map((_, i) => <TableRow key={`skel-${i}`} className="border-white/[0.04] hover:bg-transparent"><TableCell colSpan={12} className="py-0"><Skeleton className="h-10 w-full my-0.5 bg-white/[0.03]" /></TableCell></TableRow>)
              ) : leads.length === 0 ? (
                <TableRow className="border-white/[0.04] hover:bg-transparent"><TableCell colSpan={12} className="h-48"><EmptyState icon={Users} title="No leads found" description={activeFilterCount > 0 ? 'Try adjusting your filters.' : 'No contacts match your criteria.'} action={activeFilterCount > 0 ? <Button variant="outline" size="sm" className="text-xs border-primary/20 text-primary" onClick={clearAllFilters}><X className="w-3 h-3 mr-1" />Clear all</Button> : undefined} /></TableCell></TableRow>
              ) : leads.map((lead, idx) => {
                const dbf = lead._dbFields;
                const health = dbf?.emailHealth || 'unknown';
                const consent = dbf?.consentStatus || 'unknown';
                const src = dbf?.source;
                const assignee = dbf?.assignedTo;
                const SrcIcon = src ? SOURCE_ICONS[src] : null;

                return (
                  <motion.tr key={lead.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.25, delay: Math.min(idx * 0.015, 0.3) }}
                    className="group border-white/[0.04] cursor-pointer transition-all duration-200 hover:bg-white/[0.04] relative"
                    style={{ borderLeft: selectedIds.has(lead.id) ? '3px solid #D4AF37' : '3px solid transparent' }}
                    onClick={() => openDetail(lead)}
                    onMouseEnter={e => { if (!selectedIds.has(lead.id)) (e.currentTarget as HTMLElement).style.borderLeftColor = '#D4AF3750'; }}
                    onMouseLeave={e => { if (!selectedIds.has(lead.id)) (e.currentTarget as HTMLElement).style.borderLeftColor = 'transparent'; }}
                  >
                    <td className="py-3 px-3 relative z-10" onClick={e => e.stopPropagation()}>
                      <Checkbox checked={selectedIds.has(lead.id)} onCheckedChange={() => toggleSelect(lead.id)} className="h-3.5 w-3.5" />
                    </td>
                    <td className="py-3 px-4 text-xs text-foreground font-medium relative z-10">{lead.rawName || '-'}</td>
                    <td className="py-3 px-4 text-xs text-muted-foreground truncate max-w-[200px] relative z-10 flex items-center gap-1.5">
                      {lead.email || '-'}
                      {/* L-10: Click health badge to verify */}
                      {lead.email && health === 'unknown' && (
                        <button onClick={e => handleVerifySingle(lead, e)} className="shrink-0 text-muted-foreground hover:text-primary transition-colors" title="Verify email">
                          <MailCheck className="w-3 h-3" />
                        </button>
                      )}
                    </td>
                    {/* L-10: Email health badge */}
                    <td className="py-3 px-2 relative z-10" onClick={e => { if (health !== 'unknown') e.stopPropagation(); }}>
                      <Badge variant="outline" className={`text-[10px] h-5 px-1.5 rounded-full border-0 ${HEALTH_COLORS[health] || HEALTH_COLORS.unknown}`}>
                        {health === 'valid' ? '✓' : health === 'risky' ? '~' : health === 'invalid' ? '✗' : '?'}
                      </Badge>
                    </td>
                    {/* L-12: Consent badge */}
                    <td className="py-3 px-2 relative z-10">
                      <Badge variant="outline" className={`text-[10px] h-5 px-1.5 rounded-full ${CONSENT_COLORS[consent] || CONSENT_COLORS.unknown}`}>
                        {consent === 'opted_in' ? '✓' : consent === 'opted_out' ? '✗' : '?'}
                      </Badge>
                    </td>
                    {/* L-02: Score with tooltip */}
                    <td className="py-3 px-2 relative z-10">
                      <TooltipProvider delayDuration={300}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span
                              className={`text-xs font-bold tabular-nums cursor-help ${dbf?.leadScore != null ? (dbf.leadScore >= 70 ? 'text-emerald-400' : dbf.leadScore >= 40 ? 'text-amber-400' : 'text-red-400') : 'text-muted-foreground/50'}`}
                              onMouseEnter={() => dbf?.companyId && handleScoreHover(lead.id)}
                            >
                              {dbf?.leadScore != null ? dbf.leadScore : '—'}
                            </span>
                          </TooltipTrigger>
                          {scoreBreakdowns[lead.id] && (
                            <TooltipContent side="bottom" className="bg-black/90 backdrop-blur-xl border-white/[0.1] text-foreground p-3 max-w-[200px]">
                              <p className="text-[10px] font-semibold text-primary mb-2 uppercase tracking-wider">Score Breakdown</p>
                              {[
                                { label: 'Role', value: scoreBreakdowns[lead.id].role, max: 25 },
                                { label: 'Email Health', value: scoreBreakdowns[lead.id].emailHealth, max: 15 },
                                { label: 'Company Fit', value: scoreBreakdowns[lead.id].companyFit, max: 20 },
                                { label: 'Completeness', value: scoreBreakdowns[lead.id].dataCompleteness, max: 15 },
                                { label: 'Engagement', value: scoreBreakdowns[lead.id].engagement, max: 15 },
                                { label: 'Enrichment', value: scoreBreakdowns[lead.id].enrichment, max: 10 },
                              ].map(d => (
                                <div key={d.label} className="flex items-center justify-between gap-3 text-[10px] mb-1">
                                  <span className="text-muted-foreground">{d.label}</span>
                                  <div className="flex items-center gap-1.5">
                                    <div className="w-16 h-1.5 rounded-full bg-white/[0.08] overflow-hidden">
                                      <div className="h-full rounded-full bg-primary" style={{ width: `${(d.value / d.max) * 100}%` }} />
                                    </div>
                                    <span className="text-foreground tabular-nums w-5 text-right">{d.value}</span>
                                  </div>
                                </div>
                              ))}
                              <div className="mt-2 pt-2 border-t border-white/[0.08] flex justify-between text-[10px] font-bold">
                                <span>Total</span>
                                <span className="text-primary">{scoreBreakdowns[lead.id].total}/100</span>
                              </div>
                            </TooltipContent>
                          )}
                        </Tooltip>
                      </TooltipProvider>
                    </td>
                    {/* L-07: Status with transition dropdown */}
                    <td className="py-3 px-2 relative z-10" onClick={e => e.stopPropagation()}>
                      {dbf?.status ? (
                        <Popover onOpenChange={(open) => { if (open) getTransitions(lead.id, dbf.status!); }}>
                          <PopoverTrigger asChild>
                            <Badge
                              variant="outline"
                              className={`text-[10px] h-5 px-1.5 rounded-full cursor-pointer hover:bg-white/[0.08] transition-colors ${
                                dbf.status === 'imported' ? 'bg-zinc-500/15 text-zinc-300 border-zinc-500/20' :
                                dbf.status === 'sent' ? 'bg-blue-500/15 text-blue-300 border-blue-500/20' :
                                dbf.status === 'replied' ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20' :
                                dbf.status === 'bounced' ? 'bg-red-500/15 text-red-300 border-red-500/20' :
                                dbf.status === 'suppressed' ? 'bg-red-500/20 text-red-300 border-red-500/30' :
                                dbf.status === 'drafted' ? 'bg-purple-500/15 text-purple-300 border-purple-500/20' :
                                dbf.status === 'queued' ? 'bg-amber-500/15 text-amber-300 border-amber-500/20' :
                                'bg-white/[0.06] text-muted-foreground border-white/[0.08]'
                              }`}
                            >
                              {transitioningId === lead.id ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : dbf.status}
                            </Badge>
                          </PopoverTrigger>
                          <PopoverContent className="w-44 p-1 border-white/[0.1] bg-black/80 backdrop-blur-2xl" align="start">
                            <div className="px-2 py-1.5 text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Change Status</div>
                            {(() => {
                              const transitions = statusTransitions[lead.id] || [];
                              if (transitions.length === 0) {
                                return <div className="px-2 py-2 text-[10px] text-muted-foreground">No valid transitions</div>;
                              }
                              return transitions.map(t => (
                                <button
                                  key={t}
                                  className="w-full text-left text-xs text-foreground px-2 py-1.5 rounded-md hover:bg-white/[0.06] transition-colors capitalize"
                                  onClick={(e) => { e.stopPropagation(); handleTransitionStatus(lead.id, t); }}
                                >{t.replace(/_/g, ' ')}</button>
                              ));
                            })()}
                          </PopoverContent>
                        </Popover>
                      ) : '-'}
                    </td>
                    <td className="py-3 px-4 text-xs text-muted-foreground truncate max-w-[130px] relative z-10">{lead.title || '-'}</td>
                    <td className="py-3 px-4 text-xs text-foreground truncate max-w-[130px] relative z-10">
                      <span className="truncate">{lead.company || '-'}</span>
                      {/* L-03: Enrichment indicator */}
                      {dbf?.hasEnrichedCompany && <Sparkles className="w-3 h-3 text-primary/50 inline ml-1 align-text-bottom" />}
                    </td>
                    {/* L-15: Source badge */}
                    <td className="py-3 px-2 relative z-10">
                      {src ? (
                        <Badge variant="outline" className="text-[10px] h-5 px-1.5 rounded-full border-white/[0.08] text-muted-foreground gap-1">
                          {SrcIcon && <SrcIcon className="w-2.5 h-2.5" />}
                          {src}
                        </Badge>
                      ) : '-'}
                    </td>
                    {/* L-14: Assignee */}
                    <td className="py-3 px-3 text-xs text-muted-foreground truncate max-w-[80px] relative z-10">{assignee || '-'}</td>
                    <td className="py-3 px-4 text-xs text-muted-foreground truncate max-w-[90px] relative z-10">{lead.country || '-'}</td>
                  </motion.tr>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {!leadsLoading && total > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-5 py-4 border-t border-white/[0.06]">
            <div className="text-xs text-muted-foreground">
              Showing <span className="text-foreground font-medium tabular-nums">{showingFrom.toLocaleString()}</span> - <span className="text-foreground font-medium tabular-nums">{showingTo.toLocaleString()}</span> of <span className="text-foreground font-medium tabular-nums">{total.toLocaleString()}</span> results
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Rows:</span>
                <div className="flex gap-0.5 p-0.5 rounded-lg bg-white/[0.04] border border-white/[0.06]">
                  {PAGE_SIZE_OPTIONS.map(size => (
                    <Button key={size} variant={limit === size ? 'default' : 'ghost'} size="sm" className={`h-7 px-3 text-xs rounded-md transition-all ${limit === size ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20' : 'text-muted-foreground hover:text-foreground hover:bg-white/[0.04]'}`} onClick={() => setLimit(size)}>{size}</Button>
                  ))}
                </div>
              </div>
              <Separator orientation="vertical" className="h-5 bg-white/[0.08]" />
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 hover:bg-white/[0.06] text-muted-foreground" disabled={page <= 1} onClick={() => setPage(1)}><ChevronsLeft className="w-3.5 h-3.5" /></Button>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 hover:bg-white/[0.06] text-muted-foreground" disabled={page <= 1} onClick={() => setPage(page - 1)}><ChevronLeft className="w-3.5 h-3.5" /></Button>
                <span className="text-xs text-foreground px-3 min-w-[90px] text-center tabular-nums font-medium">Page {page} of {totalPages}</span>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 hover:bg-white/[0.06] text-muted-foreground" disabled={page >= totalPages} onClick={() => setPage(page + 1)}><ChevronRight className="w-3.5 h-3.5" /></Button>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 hover:bg-white/[0.06] text-muted-foreground" disabled={page >= totalPages} onClick={() => setPage(totalPages)}><ChevronsRight className="w-3.5 h-3.5" /></Button>
              </div>
            </div>
          </div>
        )}
      </GlassPanel>

      {/* ═════════════════════════ Lead Detail Panel (Sheet) ═════════════════════════ */}
      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent className="w-full sm:max-w-xl bg-card/95 backdrop-blur-2xl border-white/[0.08] text-foreground overflow-y-auto">
          <SheetHeader className="pr-6">
            <SheetTitle className="text-base font-semibold text-foreground">{selectedLead?.rawName || 'Lead Details'}</SheetTitle>
          </SheetHeader>

          {selectedLead && (
            <div className="mt-6 space-y-6 pr-6 pb-24">
              {/* Tabs */}
              <TabBar
                tabs={[
                  { key: 'info', label: 'Details' },
                  { key: 'timeline', label: 'Timeline', count: timeline.length || undefined },
                  { key: 'notes', label: 'Notes', count: notes.length || undefined },
                ]}
                active={detailTab}
                onChange={setDetailTab}
              />

              {/* ═══ INFO TAB ═══ */}
              {detailTab === 'info' && (
                <div className="space-y-4">
                  {/* Name & Title */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/70 uppercase tracking-widest font-medium"><Users className="w-3 h-3" />Name</div>
                      <p className="text-sm text-foreground font-medium mt-1">{selectedLead.rawName || '-'}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/70 uppercase tracking-widest font-medium"><Briefcase className="w-3 h-3" />Title</div>
                      <p className="text-sm text-foreground font-medium mt-1">{selectedLead.title || '-'}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/70 uppercase tracking-widest font-medium"><Building2 className="w-3 h-3" />Company</div>
                      <p className="text-sm text-foreground font-medium mt-1">{selectedLead.company || '-'}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/70 uppercase tracking-widest font-medium"><Globe className="w-3 h-3" />Industry</div>
                      <p className="text-sm text-foreground font-medium mt-1">{selectedLead.industry || '-'}</p>
                    </div>
                  </div>

                  {/* Email */}
                  <div className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/70 uppercase tracking-widest font-medium"><Mail className="w-3 h-3" />Email</div>
                      {selectedLead._dbFields?.emailHealth && (
                        <Badge variant="outline" className={`text-[10px] h-5 px-1.5 rounded-full border-0 ${HEALTH_COLORS[selectedLead._dbFields.emailHealth]}`}>
                          {selectedLead._dbFields.emailHealth} ({selectedLead._dbFields.emailHealthScore}/100)
                        </Badge>
                      )}
                    </div>
                    {selectedLead.email ? (
                      <a href={`mailto:${selectedLead.email}`} className="text-sm text-primary hover:underline flex items-center gap-1.5 mt-1" onClick={e => e.stopPropagation()}>{selectedLead.email}<ExternalLink className="w-3 h-3" /></a>
                    ) : <p className="text-sm text-muted-foreground mt-1">-</p>}
                  </div>

                  {/* Location */}
                  <div className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/70 uppercase tracking-widest font-medium"><MapPin className="w-3 h-3" />Location</div>
                    <p className="text-sm text-foreground font-medium mt-1">{[selectedLead.city, selectedLead.state, selectedLead.country].filter(Boolean).join(', ') || '-'}</p>
                  </div>

                  <Separator className="bg-white/[0.06]" />

                  {/* L-12: Consent Status */}
                  <div className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/70 uppercase tracking-widest font-medium mb-2">
                      <ShieldCheck className="w-3 h-3" />GDPR Consent
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className={`text-xs px-2 py-0.5 ${CONSENT_COLORS[selectedLead._dbFields?.consentStatus || 'unknown']}`}>
                        {selectedLead._dbFields?.consentStatus || 'unknown'}
                      </Badge>
                      <div className="flex gap-1.5 ml-auto">
                        <Button size="sm" variant="ghost" className="h-7 text-[10px] text-emerald-400 hover:bg-emerald-500/10 px-2" onClick={() => selectedLead._dbFields && handleUpdateConsent(selectedLead._dbFields?.companyId || selectedLead.id, 'opted_in')}>Opt In</Button>
                        <Button size="sm" variant="ghost" className="h-7 text-[10px] text-red-400 hover:bg-red-500/10 px-2" onClick={() => selectedLead._dbFields && handleUpdateConsent(selectedLead._dbFields?.companyId || selectedLead.id, 'opted_out')}>Opt Out</Button>
                      </div>
                    </div>
                    {selectedLead._dbFields?.consentStatus === 'opted_out' && (
                      <div className="flex items-center gap-1.5 mt-2 text-[10px] text-amber-400">
                        <AlertTriangle className="w-3 h-3" />
                        This lead has opted out — drafting is not recommended
                      </div>
                    )}
                  </div>

                  {/* L-14: Assignee */}
                  <div className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/70 uppercase tracking-widest font-medium"><UserPlus className="w-3 h-3" />Assigned To</div>
                    <p className="text-sm text-foreground font-medium mt-1">{selectedLead._dbFields?.assignedTo || 'Unassigned'}</p>
                  </div>

                  {/* L-15: Source */}
                  <div className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/70 uppercase tracking-widest font-medium"><Tag className="w-3 h-3" />Lead Source</div>
                    <div className="flex items-center gap-1.5 mt-1">
                      {(() => {
                        const s = selectedLead._dbFields?.source;
                        const SrcIcon = s ? SOURCE_ICONS[s] : null;
                        return SrcIcon ? <SrcIcon className="w-3.5 h-3.5 text-primary" /> : null;
                      })()}
                      <p className="text-sm text-foreground font-medium">{selectedLead._dbFields?.source || '-'}</p>
                    </div>
                  </div>

                  {/* LinkedIn */}
                  {selectedLead.linkedin && (
                    <div className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/70 uppercase tracking-widest font-medium"><Linkedin className="w-3 h-3" />LinkedIn</div>
                      <a href={selectedLead.linkedin.startsWith('http') ? selectedLead.linkedin : `https://${selectedLead.linkedin}`} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline flex items-center gap-1.5 mt-1" onClick={e => e.stopPropagation()}>View Profile<ExternalLink className="w-3 h-3" /></a>
                    </div>
                  )}

                  <Separator className="bg-white/[0.06]" />

                  {/* Generate Email */}
                  <Button className="w-full h-10 gap-2 text-sm font-medium" style={{ background: 'linear-gradient(135deg, #D4AF37, #E8C860)', color: '#000' }} disabled={generatingEmail || !selectedLead.email} onClick={handleGenerateEmail}>
                    {generatingEmail ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    {generatingEmail ? 'Generating...' : 'Generate AI Email'}
                  </Button>

                  {generatedDraft && (
                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
                      <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400" /><span className="text-xs font-medium text-emerald-400">Email Generated ({generatedDraft.confidenceScore}%)</span></div>
                      <div className="p-2.5 rounded-lg bg-white/[0.03] border border-white/[0.06]"><p className="text-[10px] text-muted-foreground uppercase mb-1">Subject</p><p className="text-xs text-foreground">{generatedDraft.subject}</p></div>
                      <div className="p-2.5 rounded-lg bg-white/[0.03] border border-white/[0.06]"><p className="text-[10px] text-muted-foreground uppercase mb-1">Body</p><p className="text-xs text-foreground/80 leading-relaxed whitespace-pre-wrap line-clamp-6">{generatedDraft.body}</p></div>
                    </motion.div>
                  )}
                  {emailGenError && <div className="p-2.5 rounded-lg border border-red-500/20 bg-red-500/5"><p className="text-xs text-red-400">{emailGenError}</p></div>}
                </div>
              )}

              {/* ═══ TIMELINE TAB (L-11) ═══ */}
              {detailTab === 'timeline' && (
                <div className="space-y-0">
                  {timelineLoading ? (
                    <div className="space-y-3 py-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 bg-white/[0.03] rounded-lg" />)}</div>
                  ) : timeline.length === 0 ? (
                    <div className="py-12 text-center"><Activity className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" /><p className="text-sm text-muted-foreground">No activity recorded yet</p></div>
                  ) : (
                    <div className="relative">
                      {/* Vertical line */}
                      <div className="absolute left-[15px] top-2 bottom-2 w-px bg-white/[0.08]" />
                      <div className="space-y-0">
                        {timeline.map((event, i) => {
                          const IconComp = TIMELINE_ICONS[event.type] || Activity;
                          return (
                            <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: Math.min(i * 0.03, 0.3) }} className="relative flex gap-4 py-3 group">
                              {/* Icon */}
                              <div className="relative z-10 w-[30px] h-[30px] rounded-full bg-white/[0.04] border border-white/[0.08] flex items-center justify-center shrink-0 group-hover:border-primary/30 transition-colors">
                                <IconComp className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                              </div>
                              {/* Content */}
                              <div className="flex-1 min-w-0 pt-0.5">
                                <p className="text-xs font-medium text-foreground">{event.title}</p>
                                {event.description && <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{event.description}</p>}
                                <p className="text-[10px] text-muted-foreground/50 mt-1">{formatTime(event.timestamp)}</p>
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ═══ NOTES TAB (L-13) ═══ */}
              {detailTab === 'notes' && (
                <div className="space-y-4">
                  {/* Add note */}
                  <div className="space-y-2">
                    <Textarea placeholder="Add a note about this lead..." value={newNote} onChange={e => setNewNote(e.target.value)} className="min-h-[80px] text-sm bg-white/[0.03] border-white/[0.08] text-foreground placeholder:text-muted-foreground/50 focus:border-primary/30 resize-none" />
                    <Button size="sm" className="h-8 text-xs gap-1.5" style={{ background: 'linear-gradient(135deg, #D4AF37, #E8C860)', color: '#000' }} disabled={!newNote.trim()} onClick={handleAddNote}>
                      <StickyNote className="w-3 h-3" />Add Note
                    </Button>
                  </div>

                  <Separator className="bg-white/[0.06]" />

                  {/* Notes list */}
                  {notesLoading ? (
                    <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 bg-white/[0.03] rounded-lg" />)}</div>
                  ) : notes.length === 0 ? (
                    <div className="py-8 text-center"><StickyNote className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" /><p className="text-sm text-muted-foreground">No notes yet</p></div>
                  ) : (
                    <div className="space-y-3">
                      {notes.map(note => (
                        <motion.div key={note.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                          <p className="text-sm text-foreground/90 whitespace-pre-wrap">{note.body}</p>
                          <p className="text-[10px] text-muted-foreground/50 mt-2">{formatTime(note.createdAt)}</p>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* ═══ L-14: Assign Dialog ═══ */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent className="bg-card/95 backdrop-blur-xl border-white/[0.08] text-foreground max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm">Assign Leads</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              {selectedIds.size > 0 ? `Assign ${selectedIds.size} selected leads` : `Assign all ${total} leads`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Method</label>
              <Select value={assignMethod} onValueChange={setAssignMethod}>
                <SelectTrigger className="h-9 text-xs bg-white/[0.03] border-white/[0.08]"><SelectValue /></SelectTrigger>
                <SelectContent className="border-white/[0.1] bg-black/60 backdrop-blur-2xl">
                  <SelectItem value="manual" className="text-xs text-foreground">Manual — assign to specific person</SelectItem>
                  <SelectItem value="round_robin" className="text-xs text-foreground">Round Robin — distribute evenly</SelectItem>
                  <SelectItem value="territory" className="text-xs text-foreground">Territory — assign by geography</SelectItem>
                  <SelectItem value="industry" className="text-xs text-foreground">Industry — assign by industry match</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {assignMethod === 'manual' && (
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Assign To</label>
                <Select value={assignTo} onValueChange={setAssignTo}>
                  <SelectTrigger className="h-9 text-xs bg-white/[0.03] border-white/[0.08]"><SelectValue /></SelectTrigger>
                  <SelectContent className="border-white/[0.1] bg-black/60 backdrop-blur-2xl">
                    <SelectItem value="Ravi Shanker" className="text-xs text-foreground">Ravi Shanker</SelectItem>
                    <SelectItem value="Sarah Chen" className="text-xs text-foreground">Sarah Chen</SelectItem>
                    <SelectItem value="Marcus Johnson" className="text-xs text-foreground">Marcus Johnson</SelectItem>
                    <SelectItem value="Priya Patel" className="text-xs text-foreground">Priya Patel</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <Button className="w-full h-9 gap-2 text-xs font-medium" style={{ background: 'linear-gradient(135deg, #D4AF37, #E8C860)', color: '#000' }} onClick={handleAssign}>
              <UserPlus className="w-3.5 h-3.5" />Assign Leads
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══ L-06: Dedup Dialog ═══ */}
      <Dialog open={dedupOpen} onOpenChange={setDedupOpen}>
        <DialogContent className="bg-card/95 backdrop-blur-xl border-white/[0.08] text-foreground max-w-3xl max-h-[85vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <GitMerge className="w-4 h-4 text-amber-400" />
              Duplicate Detection
              <Badge variant="outline" className="bg-amber-500/10 text-amber-300 border-amber-500/20 text-[10px] ml-2">
                {dedupGroups.length} groups
              </Badge>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">Review and merge duplicate contacts</DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[65vh] pr-2">
            {dedupLoading ? (
              <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
            ) : dedupGroups.length === 0 ? (
              <div className="py-12 text-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-400/50 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No duplicates found</p>
              </div>
            ) : (
              <div className="space-y-4 pb-4">
                {dedupGroups.map((group, gi) => {
                  const primary = group.contacts[0];
                  const secondaries = group.contacts.slice(1);
                  return (
                    <div key={gi} className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06] space-y-3">
                      <div className="flex items-center justify-between">
                        <Badge variant="outline" className={`${group.matchType === 'exact' ? 'bg-red-500/15 text-red-300 border-red-500/20' : group.matchType === 'likely' ? 'bg-amber-500/15 text-amber-300 border-amber-500/20' : 'bg-zinc-500/15 text-zinc-300 border-zinc-500/20'} text-[10px]`}>
                          {group.matchType} match
                        </Badge>
                        <Button
                          size="sm" variant="outline" className="h-7 text-[10px] gap-1.5 border-primary/20 text-primary hover:bg-primary/10"
                          onClick={() => handleMergeGroup(primary.id, secondaries.map((c: any) => c.id))}
                          disabled={merging}
                        >
                          {merging ? <Loader2 className="w-3 h-3 animate-spin" /> : <GitMerge className="w-3 h-3" />}
                          Merge into {primary.rawName}
                        </Button>
                      </div>
                      <div className="space-y-2">
                        {group.contacts.map((c: any) => (
                          <div key={c.id} className="flex items-center gap-3 py-2 px-3 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                            <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                              <span className="text-[10px] font-bold text-primary">{(c.rawName || '?').charAt(0).toUpperCase()}</span>
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-medium text-foreground truncate">{c.rawName || '-'}</p>
                              <p className="text-[10px] text-muted-foreground truncate">{c.email || '-'}</p>
                            </div>
                            <span className="text-[10px] text-muted-foreground truncate max-w-[100px]">{c.company?.rawName || '-'}</span>
                            {c.id === primary.id && (
                              <Badge variant="outline" className="text-[9px] h-4 px-1.5 bg-primary/10 text-primary border-primary/20">Primary</Badge>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
    </PageTransition>
  );
}