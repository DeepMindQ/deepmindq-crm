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
  Download, Copy, RefreshCw, GitMerge, Eye, Ban, MoreHorizontal, FileText, Phone,
  MessageSquarePlus, LayoutList, Building, ChevronRight as ChevronRightIcon,
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

interface TimelineEvent {
  type: string; title: string; description: string; timestamp: string; metadata?: Record<string, unknown>;
}

interface ContactNote {
  id: string; body: string; createdAt: string; updatedAt: string;
}

const CONSENT_COLORS: Record<string, string> = {
  opted_in: 'bg-emerald-500/20 text-emerald-700 border-emerald-500/30',
  unknown: 'bg-amber-500/20 text-amber-700 border-amber-500/30',
  opted_out: 'bg-red-500/20 text-red-600 border-red-500/30',
};

const HEALTH_COLORS: Record<string, string> = {
  valid: 'bg-emerald-500/20 text-emerald-700',
  risky: 'bg-amber-500/20 text-amber-700',
  invalid: 'bg-red-500/20 text-red-600',
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
        <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs font-normal border-gray-200 bg-gray-50 hover:bg-gray-100 hover:border-gray-300 transition-all duration-200">
          <span className="truncate max-w-[120px]">{label}</span>
          {selected.length > 0 && <Badge className="bg-primary/15 border-primary/25 text-primary text-[10px] h-4 min-w-4 px-1.5 rounded-full font-semibold">{selected.length}</Badge>}
          <span className="text-muted-foreground text-[10px]">({totalCount})</span>
          <ChevronDown className="w-3 h-3 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0 bg-white border border-gray-200 shadow-lg shadow-2xl shadow-gray-400/30" align="start">
        <div className="p-2.5 border-b border-gray-200">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input placeholder={`Search ${label.toLowerCase()}...`} value={localSearch} onChange={e => setLocalSearch(e.target.value)} className="h-7 pl-8 text-xs bg-gray-100/50 border-gray-200 text-foreground placeholder:text-muted-foreground/60 focus:border-primary/30" />
          </div>
        </div>
        {selected.length > 0 && (
          <div className="px-2.5 py-2 border-b border-gray-200 flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground">{selected.length} selected</span>
            <Button variant="ghost" size="sm" className="h-5 text-[10px] text-muted-foreground hover:text-foreground px-1.5" onClick={e => { e.stopPropagation(); onChange([]); }}>Clear</Button>
          </div>
        )}
        <div className="max-h-60 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">No results</div>
          ) : filtered.map(option => (
            <label key={option.v} className="flex items-center gap-2.5 px-2.5 py-2 hover:bg-gray-100/50 cursor-pointer transition-colors">
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

  /* AI: Score all leads */
  const [aiScoring, setAiScoring] = useState(false);
  const handleAiScoreAll = async () => {
    setAiScoring(true);
    try {
      const res = await fetch('/api/ai/score-leads', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ scoreAll: true }) });
      const data = await res.json();
      if (data.data?.scores) {
        const count = data.data.scores.length;
        toast.success(`AI scored ${count} entities successfully`);
        // Refresh leads to show new scores
        fetchLeads();
      } else {
        toast.error(data.error || 'AI scoring failed');
      }
    } catch { toast.error('AI scoring request failed'); }
    finally { setAiScoring(false); }
  };

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

  /* Task 2: Inline note from row action */
  const [inlineNoteOpen, setInlineNoteOpen] = useState(false);
  const [inlineNoteLeadId, setInlineNoteLeadId] = useState<string>('');
  const [inlineNoteText, setInlineNoteText] = useState('');
  const [inlineNoteSaving, setInlineNoteSaving] = useState(false);

  /* Task 2: Bulk status update dialog */
  const [bulkStatusOpen, setBulkStatusOpen] = useState(false);
  const [bulkNewStatus, setBulkNewStatus] = useState('');

  /* Task 2: Slide-over detail panel */
  const [slideOverOpen, setSlideOverOpen] = useState(false);

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
    setSlideOverOpen(true);
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

  /* Task 2: Quick draft from row action */
  const handleQuickDraft = async (lead: Lead, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      toast.loading('Generating draft...', { id: 'quick-draft' });
      const res = await fetch('/api/drafts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactId: lead.id, name: lead.rawName, email: lead.email, title: lead.title, company: lead.company, industry: lead.industry, companySize: lead.employeeCategory }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Draft generated for ${lead.rawName}`, { id: 'quick-draft' });
        if (navigateTo) navigateTo('drafts');
      } else {
        toast.error(data.error || 'Draft generation failed', { id: 'quick-draft' });
      }
    } catch {
      toast.error('Network error', { id: 'quick-draft' });
    }
  };

  /* Task 2: Open inline note dialog */
  const openInlineNote = (lead: Lead, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setInlineNoteLeadId(lead.id);
    setInlineNoteText('');
    setInlineNoteOpen(true);
  };

  /* Task 2: Save inline note */
  const handleInlineNoteSave = async () => {
    if (!inlineNoteText.trim()) return;
    setInlineNoteSaving(true);
    try {
      const res = await fetch(`/api/contacts/${inlineNoteLeadId}/notes`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: inlineNoteText.trim() }),
      });
      if (res.ok) {
        toast.success('Note added');
        setInlineNoteOpen(false);
        setInlineNoteText('');
        fetchLeads();
      } else {
        toast.error('Failed to add note');
      }
    } catch { toast.error('Failed to add note'); }
    setInlineNoteSaving(false);
  };

  /* Task 2: Bulk generate drafts */
  const handleBulkGenerateDrafts = async () => {
    if (selectedIds.size === 0) return;
    toast.loading(`Generating drafts for ${selectedIds.size} leads...`, { id: 'bulk-drafts' });
    let count = 0;
    for (const id of Array.from(selectedIds)) {
      try {
        const res = await fetch('/api/drafts', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contactId: id }),
        });
        const data = await res.json();
        if (data.success) count++;
      } catch { /* skip */ }
    }
    toast.success(`Generated ${count} draft(s) for ${selectedIds.size} leads`, { id: 'bulk-drafts' });
    if (count > 0 && navigateTo) navigateTo('drafts');
  };

  /* Task 2: Bulk export selected */
  const handleBulkExportSelected = async () => {
    if (selectedIds.size === 0) return;
    try {
      const res = await fetch(`/api/leads/export?ids=${Array.from(selectedIds).join(',')}`);
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `deepmindq-leads-selected-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('Selected leads exported');
      }
    } catch { toast.error('Export failed'); }
  };

  /* Task 2: Bulk status update */
  const handleBulkStatusUpdate = async () => {
    if (selectedIds.size === 0 || !bulkNewStatus) return;
    try {
      const res = await fetch('/api/leads/status', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedIds), status: bulkNewStatus }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Updated ${selectedIds.size} leads to ${bulkNewStatus}`);
        setBulkStatusOpen(false);
        setBulkNewStatus('');
        setSelectedIds(new Set());
        fetchLeads();
      } else {
        toast.error(data.error || 'Bulk status update failed');
      }
    } catch { toast.error('Bulk status update failed'); }
  };

  /* Task 2: Compute data completeness score */
  const computeCompleteness = (lead: Lead): number => {
    let filled = 0;
    const fields = [lead.rawName, lead.email, lead.title, lead.department, lead.company, lead.industry, lead.city, lead.state, lead.country, lead.website, lead.linkedin, lead.employeeCategory];
    fields.forEach(f => { if (f && f.trim()) filled++; });
    if (lead._dbFields?.phone) filled++;
    return Math.round((filled / (fields.length + 1)) * 15);
  };

  /* Task 2: Get score color */
  const getScoreColor = (score: number | null | undefined) => {
    if (score == null) return '#71717a';
    if (score >= 70) return '#10b981';
    if (score >= 40) return '#f59e0b';
    return '#ef4444';
  };

  /* Task 2: Get score bar color */
  const getBarColor = (value: number, max: number) => {
    const pct = (value / max) * 100;
    if (pct >= 70) return '#10b981';
    if (pct >= 40) return '#f59e0b';
    return '#ef4444';
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
        <StaggerItem><StatCard label="Total Leads" value={meta?.totalRecords ?? 0} icon={Database} color="var(--color-gold)" delay={0} /></StaggerItem>
        <StaggerItem><StatCard label="Verified" value={leads.filter(l => l._dbFields?.emailHealth && l._dbFields.emailHealth !== 'unknown').length} icon={MailCheck} color="#10B981" delay={0.06} /></StaggerItem>
        <StaggerItem><StatCard label="Results" value={total} icon={FileEdit} color="#6366F1" delay={0.12} /></StaggerItem>
        <StaggerItem><StatCard label="Filters" value={activeFilterCount} icon={Filter} color="#F59E0B" delay={0.18} /></StaggerItem>
        <StaggerItem><StatCard label="Selected" value={selectedIds.size} icon={Users} color="#EC4899" delay={0.24} /></StaggerItem>
      </StaggerGrid>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" className="h-9 gap-2 text-xs border-gray-200 bg-gray-50" onClick={() => setFiltersOpen(!filtersOpen)}>
          <SlidersHorizontal className="w-3.5 h-3.5" />Filters
          {activeFilterCount > 0 && <Badge className="bg-primary/15 border-primary/25 text-primary text-[10px] h-4 min-w-4 px-1.5 rounded-full font-semibold">{activeFilterCount}</Badge>}
        </Button>
        {activeFilterCount > 0 && <Button variant="ghost" size="sm" className="h-9 text-xs text-muted-foreground hover:text-foreground" onClick={clearAllFilters}><X className="w-3 h-3 mr-1" />Clear all</Button>}

        <div className="flex-1" />

        {/* L-10: Verify Emails */}
        <Button variant="outline" size="sm" className="h-9 gap-2 text-xs border-emerald-500/20 text-emerald-600 hover:bg-emerald-50" onClick={handleVerifyAll} disabled={verifying}>
          {verifying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MailCheck className="w-3.5 h-3.5" />}
          {verifying ? 'Verifying...' : 'Verify Emails'}
        </Button>

        {/* L-14: Assign */}
        <Button variant="outline" size="sm" className="h-9 gap-2 text-xs border-primary/20 text-primary hover:bg-primary/10" onClick={() => setAssignDialogOpen(true)}>
          <UserPlus className="w-3.5 h-3.5" />Assign {selectedIds.size > 0 ? `(${selectedIds.size})` : ''}
        </Button>

        {/* L-05: Export CSV */}
        <Button variant="outline" size="sm" className="h-9 gap-2 text-xs border-gray-200 bg-gray-50 hover:bg-gray-100" onClick={handleExportCSV} disabled={exporting}>
          {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
          {exporting ? 'Exporting...' : 'Export CSV'}
        </Button>

        {/* L-06: Find Duplicates */}
        <Button variant="outline" size="sm" className="h-9 gap-2 text-xs border-amber-500/20 text-amber-600 hover:bg-amber-50" onClick={handleFindDuplicates}>
          <Copy className="w-3.5 h-3.5" />Find Duplicates
        </Button>

        {/* L-02: Recalculate Scores */}
        <Button variant="outline" size="sm" className="h-9 gap-2 text-xs border-gray-200 bg-gray-50 hover:bg-gray-100" onClick={handleRecalculateScores} disabled={recalculating}>
          {recalculating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          {recalculating ? 'Recalculating...' : 'Recalc Scores'}
        </Button>

        {/* AI: Score All Leads with AI */}
        <Button size="sm" className="h-9 gap-2 text-xs font-medium text-white shadow-sm" style={{ background: 'linear-gradient(135deg, #D4AF37, #B8960F)' }} onClick={handleAiScoreAll} disabled={aiScoring}>
          {aiScoring ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Brain className="w-3.5 h-3.5" />}
          {aiScoring ? 'AI Scoring...' : 'AI Score All'}
        </Button>
      </div>

      {/* Filter Panel */}
      {filtersOpen && (
        <GlassPanel className="overflow-hidden">
          <div className="p-5 space-y-4">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input ref={searchInputRef} placeholder="Search by name, email, company, title, city, or country..." value={search} onChange={e => setSearch(e.target.value)} className="h-10 pl-10 pr-9 text-sm bg-gray-50 border-gray-200 text-foreground placeholder:text-muted-foreground/50 focus:border-primary/30" />
              {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"><X className="w-4 h-4" /></button>}
            </div>
            {metaLoading ? (
              <div className="flex flex-wrap gap-2">{Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-9 w-28 rounded-lg bg-gray-100/50" />)}</div>
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
              <TableRow className="border-gray-200 hover:bg-transparent">
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
                <TableHead className="text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-wider h-11 w-[40px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leadsLoading ? (
                Array.from({ length: 15 }).map((_, i) => <TableRow key={`skel-${i}`} className="border-gray-200 hover:bg-transparent"><TableCell colSpan={13} className="py-0"><Skeleton className="h-10 w-full my-0.5 bg-gray-50" /></TableCell></TableRow>)
              ) : leads.length === 0 ? (
                <TableRow className="border-gray-200 hover:bg-transparent"><TableCell colSpan={13} className="h-48"><EmptyState icon={Users} title="No leads found" description={activeFilterCount > 0 ? 'Try adjusting your filters.' : 'No contacts match your criteria.'} action={activeFilterCount > 0 ? <Button variant="outline" size="sm" className="text-xs border-primary/20 text-primary" onClick={clearAllFilters}><X className="w-3 h-3 mr-1" />Clear all</Button> : undefined} /></TableCell></TableRow>
              ) : leads.map((lead, idx) => {
                const dbf = lead._dbFields;
                const health = dbf?.emailHealth || 'unknown';
                const consent = dbf?.consentStatus || 'unknown';
                const src = dbf?.source;
                const assignee = dbf?.assignedTo;
                const SrcIcon = src ? SOURCE_ICONS[src] : null;

                return (
                  <motion.tr key={lead.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.25, delay: Math.min(idx * 0.015, 0.3) }}
                    className="group border-gray-200 cursor-pointer transition-all duration-200 hover:bg-gray-100/50 relative"
                    style={{ borderLeft: selectedIds.has(lead.id) ? '3px solid #D4AF37' : '3px solid transparent' }}
                    onClick={() => openDetail(lead)}
                    onMouseEnter={e => { if (!selectedIds.has(lead.id)) (e.currentTarget as HTMLElement).style.borderLeftColor = '#D4AF3750'; }}
                    onMouseLeave={e => { if (!selectedIds.has(lead.id)) (e.currentTarget as HTMLElement).style.borderLeftColor = 'transparent'; }}
                  >
                    <td className="py-3 px-3 relative z-10" onClick={e => e.stopPropagation()}>
                      <Checkbox checked={selectedIds.has(lead.id)} onCheckedChange={() => toggleSelect(lead.id)} className="h-3.5 w-3.5" />
                    </td>
                    <td className="py-3 px-4 text-xs text-foreground font-medium relative z-10 flex items-center gap-2">
                      {lead.rawName || '-'}
                      {dbf?.leadScore != null && (
                        <span
                          className="shrink-0 inline-flex items-center justify-center h-5 min-w-[22px] px-1 rounded-full text-[10px] font-bold tabular-nums"
                          style={{ backgroundColor: `${getScoreColor(dbf.leadScore)}18`, color: getScoreColor(dbf.leadScore), border: `1px solid ${getScoreColor(dbf.leadScore)}30` }}
                        >
                          {dbf.leadScore}
                        </span>
                      )}
                    </td>
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
                              className={`text-xs font-bold tabular-nums cursor-help ${dbf?.leadScore != null ? (dbf.leadScore >= 70 ? 'text-emerald-600' : dbf.leadScore >= 40 ? 'text-amber-600' : 'text-red-600') : 'text-muted-foreground/50'}`}
                              onMouseEnter={() => dbf?.companyId && handleScoreHover(lead.id)}
                            >
                              {dbf?.leadScore != null ? dbf.leadScore : '—'}
                            </span>
                          </TooltipTrigger>
                          {scoreBreakdowns[lead.id] && (
                            <TooltipContent side="bottom" className="bg-white border border-gray-200 shadow-lg border-gray-200 text-foreground p-3 max-w-[200px]">
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
                                    <div className="w-16 h-1.5 rounded-full bg-gray-100/50 overflow-hidden">
                                      <div className="h-full rounded-full bg-primary" style={{ width: `${(d.value / d.max) * 100}%` }} />
                                    </div>
                                    <span className="text-foreground tabular-nums w-5 text-right">{d.value}</span>
                                  </div>
                                </div>
                              ))}
                              <div className="mt-2 pt-2 border-t border-gray-200 flex justify-between text-[10px] font-bold">
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
                              className={`text-[10px] h-5 px-1.5 rounded-full cursor-pointer hover:bg-gray-100/50 transition-colors ${
                                dbf.status === 'imported' ? 'bg-zinc-500/15 text-zinc-600 border-zinc-500/20' :
                                dbf.status === 'sent' ? 'bg-blue-500/15 text-blue-700 border-blue-500/20' :
                                dbf.status === 'replied' ? 'bg-emerald-500/15 text-emerald-700 border-emerald-500/20' :
                                dbf.status === 'bounced' ? 'bg-red-500/15 text-red-600 border-red-500/20' :
                                dbf.status === 'suppressed' ? 'bg-red-500/20 text-red-600 border-red-500/30' :
                                dbf.status === 'drafted' ? 'bg-purple-500/15 text-purple-700 border-purple-500/20' :
                                dbf.status === 'queued' ? 'bg-amber-500/15 text-amber-700 border-amber-500/20' :
                                'bg-gray-100 text-muted-foreground border-gray-200'
                              }`}
                            >
                              {transitioningId === lead.id ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : dbf.status}
                            </Badge>
                          </PopoverTrigger>
                          <PopoverContent className="w-44 p-1 bg-white border border-gray-200 shadow-lg" align="start">
                            <div className="px-2 py-1.5 text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Change Status</div>
                            {(() => {
                              const transitions = statusTransitions[lead.id] || [];
                              if (transitions.length === 0) {
                                return <div className="px-2 py-2 text-[10px] text-muted-foreground">No valid transitions</div>;
                              }
                              return transitions.map(t => (
                                <button
                                  key={t}
                                  className="w-full text-left text-xs text-foreground px-2 py-1.5 rounded-md hover:bg-gray-100 transition-colors capitalize"
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
                        <Badge variant="outline" className="text-[10px] h-5 px-1.5 rounded-full border-gray-200 text-muted-foreground gap-1">
                          {SrcIcon && <SrcIcon className="w-2.5 h-2.5" />}
                          {src}
                        </Badge>
                      ) : '-'}
                    </td>
                    {/* L-14: Assignee */}
                    <td className="py-3 px-3 text-xs text-muted-foreground truncate max-w-[80px] relative z-10">{assignee || '-'}</td>
                    <td className="py-3 px-4 text-xs text-muted-foreground truncate max-w-[90px] relative z-10">{lead.country || '-'}</td>
                    {/* Task 2: Actions column */}
                    <td className="py-3 px-2 relative z-10" onClick={e => e.stopPropagation()}>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 hover:bg-gray-100 text-muted-foreground hover:text-foreground">
                            <MoreHorizontal className="w-3.5 h-3.5" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-48 p-1 bg-white border border-gray-200 shadow-lg shadow-xl shadow-gray-400/30" align="end">
                          <button
                            className="w-full text-left text-xs text-foreground px-3 py-2 rounded-md hover:bg-gray-100 transition-colors flex items-center gap-2.5"
                            onClick={(e) => handleQuickDraft(lead, e)}
                          >
                            <FileText className="w-3.5 h-3.5 text-primary/70" />Generate Draft
                          </button>
                          <button
                            className="w-full text-left text-xs text-foreground px-3 py-2 rounded-md hover:bg-gray-100 transition-colors flex items-center gap-2.5"
                            onClick={(e) => openInlineNote(lead, e)}
                          >
                            <MessageSquarePlus className="w-3.5 h-3.5 text-emerald-600/70" />Add Note
                          </button>
                          <button
                            className="w-full text-left text-xs text-foreground px-3 py-2 rounded-md hover:bg-gray-100 transition-colors flex items-center gap-2.5"
                            onClick={(e) => { e.stopPropagation(); openDetail(lead); }}
                          >
                            <LayoutList className="w-3.5 h-3.5 text-amber-600/70" />View Timeline
                          </button>
                          {navigateTo && (
                            <button
                              className="w-full text-left text-xs text-foreground px-3 py-2 rounded-md hover:bg-gray-100 transition-colors flex items-center gap-2.5"
                              onClick={(e) => { e.stopPropagation(); navigateTo('companies'); }}
                            >
                              <Building className="w-3.5 h-3.5 text-blue-600/70" />View Company
                            </button>
                          )}
                        </PopoverContent>
                      </Popover>
                    </td>
                  </motion.tr>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {!leadsLoading && total > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-5 py-4 border-t border-gray-200">
            <div className="text-xs text-muted-foreground">
              Showing <span className="text-foreground font-medium tabular-nums">{showingFrom.toLocaleString()}</span> - <span className="text-foreground font-medium tabular-nums">{showingTo.toLocaleString()}</span> of <span className="text-foreground font-medium tabular-nums">{total.toLocaleString()}</span> results
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Rows:</span>
                <div className="flex gap-0.5 p-0.5 rounded-lg bg-gray-100/50 border border-gray-200">
                  {PAGE_SIZE_OPTIONS.map(size => (
                    <Button key={size} variant={limit === size ? 'default' : 'ghost'} size="sm" className={`h-7 px-3 text-xs rounded-md transition-all ${limit === size ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20' : 'text-muted-foreground hover:text-foreground hover:bg-gray-100/50'}`} onClick={() => setLimit(size)}>{size}</Button>
                  ))}
                </div>
              </div>
              <Separator orientation="vertical" className="h-5 bg-gray-100/50" />
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 hover:bg-gray-100 text-muted-foreground" disabled={page <= 1} onClick={() => setPage(1)}><ChevronsLeft className="w-3.5 h-3.5" /></Button>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 hover:bg-gray-100 text-muted-foreground" disabled={page <= 1} onClick={() => setPage(page - 1)}><ChevronLeft className="w-3.5 h-3.5" /></Button>
                <span className="text-xs text-foreground px-3 min-w-[90px] text-center tabular-nums font-medium">Page {page} of {totalPages}</span>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 hover:bg-gray-100 text-muted-foreground" disabled={page >= totalPages} onClick={() => setPage(page + 1)}><ChevronRight className="w-3.5 h-3.5" /></Button>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 hover:bg-gray-100 text-muted-foreground" disabled={page >= totalPages} onClick={() => setPage(totalPages)}><ChevronsRight className="w-3.5 h-3.5" /></Button>
              </div>
            </div>
          </div>
        )}
      </GlassPanel>

      {/* ═════════════════════════ Lead Detail Slide-Over Panel ═════════════════════════ */}
      <AnimatePresence>
        {slideOverOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
              onClick={() => { setSlideOverOpen(false); setDetailOpen(false); }}
            />
            {/* Panel */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed right-0 top-0 h-full w-full sm:w-[420px] z-50 flex flex-col border-l border-gray-200 overflow-hidden"
              style={{
                background: '#FFFFFF', border: '1px solid #E5E7EB',
                boxShadow: '-20px 0 60px rgba(0, 0, 0, 0.5), inset 1px 0 0 rgba(0, 0, 0, 0.04)',
              }}
            >
              {selectedLead && (
                <>
                  {/* Header */}
                  <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 shrink-0">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ background: 'linear-gradient(135deg, rgba(212,175,55,0.15), rgba(212,175,55,0.05))', border: '1px solid rgba(212,175,55,0.2)' }}>
                        <span className="text-sm font-bold text-primary">{(selectedLead.rawName || '?').charAt(0).toUpperCase()}</span>
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h2 className="text-sm font-semibold text-foreground truncate">{selectedLead.rawName || 'Lead Details'}</h2>
                          {selectedLead._dbFields?.leadScore != null && (
                            <span
                              className="shrink-0 inline-flex items-center justify-center h-5 min-w-[22px] px-1.5 rounded-full text-[10px] font-bold tabular-nums"
                              style={{ backgroundColor: `${getScoreColor(selectedLead._dbFields.leadScore)}18`, color: getScoreColor(selectedLead._dbFields.leadScore), border: `1px solid ${getScoreColor(selectedLead._dbFields.leadScore)}30` }}
                            >
                              {selectedLead._dbFields.leadScore}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{selectedLead.title} {selectedLead.company ? `at ${selectedLead.company}` : ''}</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground hover:bg-gray-100 shrink-0" onClick={() => { setSlideOverOpen(false); setDetailOpen(false); }}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>

                  {/* Tabs */}
                  <div className="px-5 pt-4 shrink-0">
                    <TabBar
                      tabs={[
                        { key: 'info', label: 'Details' },
                        { key: 'scores', label: 'Scores' },
                        { key: 'timeline', label: 'Timeline', count: timeline.length || undefined },
                        { key: 'notes', label: 'Notes', count: notes.length || undefined },
                      ]}
                      active={detailTab}
                      onChange={setDetailTab}
                    />
                  </div>

                  {/* Scrollable content */}
                  <ScrollArea className="flex-1 mt-4">
                    <div className="px-5 pb-24 space-y-4">

              {/* ═══ INFO TAB ═══ */}
              {detailTab === 'info' && (
                <div className="space-y-4">
                  {/* Contact Info Section */}
                  <div>
                    <p className="text-[10px] text-muted-foreground/60 uppercase tracking-widest font-semibold mb-2">Contact Info</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/70 uppercase tracking-widest font-medium"><Users className="w-3 h-3" />Name</div>
                        <p className="text-sm text-foreground font-medium mt-1">{selectedLead.rawName || '-'}</p>
                      </div>
                      <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/70 uppercase tracking-widest font-medium"><Briefcase className="w-3 h-3" />Title</div>
                        <p className="text-sm text-foreground font-medium mt-1">{selectedLead.title || '-'}</p>
                      </div>
                    </div>
                    <div className="p-3 rounded-lg bg-gray-50 border border-gray-200 mt-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/70 uppercase tracking-widest font-medium"><Mail className="w-3 h-3" />Email</div>
                        {selectedLead._dbFields?.emailHealth && (
                          <Badge variant="outline" className={`text-[10px] h-5 px-1.5 rounded-full border-0 ${HEALTH_COLORS[selectedLead._dbFields.emailHealth]}`}>
                            {selectedLead._dbFields.emailHealth} ({selectedLead._dbFields.emailHealthScore}/100)
                          </Badge>
                        )}
                      </div>
                      {selectedLead.email ? (
                        <a href={`mailto:${selectedLead.email}`} className="text-sm text-primary hover:underline flex items-center gap-1.5 mt-1">{selectedLead.email}<ExternalLink className="w-3 h-3" /></a>
                      ) : <p className="text-sm text-muted-foreground mt-1">-</p>}
                    </div>
                    {selectedLead._dbFields?.phone && (
                      <div className="p-3 rounded-lg bg-gray-50 border border-gray-200 mt-2">
                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/70 uppercase tracking-widest font-medium"><Phone className="w-3 h-3" />Phone</div>
                        <p className="text-sm text-foreground font-medium mt-1">{selectedLead._dbFields.phone}</p>
                      </div>
                    )}
                    <div className="p-3 rounded-lg bg-gray-50 border border-gray-200 mt-2">
                      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/70 uppercase tracking-widest font-medium"><MapPin className="w-3 h-3" />Location</div>
                      <p className="text-sm text-foreground font-medium mt-1">{[selectedLead.city, selectedLead.state, selectedLead.country].filter(Boolean).join(', ') || '-'}</p>
                    </div>
                    {selectedLead.linkedin && (
                      <div className="p-3 rounded-lg bg-gray-50 border border-gray-200 mt-2">
                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/70 uppercase tracking-widest font-medium"><Linkedin className="w-3 h-3" />LinkedIn</div>
                        <a href={selectedLead.linkedin.startsWith('http') ? selectedLead.linkedin : `https://${selectedLead.linkedin}`} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline flex items-center gap-1.5 mt-1">View Profile<ExternalLink className="w-3 h-3" /></a>
                      </div>
                    )}
                  </div>

                  <Separator className="bg-gray-100" />

                  {/* Company Info Section */}
                  <div>
                    <p className="text-[10px] text-muted-foreground/60 uppercase tracking-widest font-semibold mb-2">Company Info</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/70 uppercase tracking-widest font-medium"><Building2 className="w-3 h-3" />Company</div>
                        <p className="text-sm text-foreground font-medium mt-1">{selectedLead.company || '-'}</p>
                      </div>
                      <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/70 uppercase tracking-widest font-medium"><Globe className="w-3 h-3" />Industry</div>
                        <p className="text-sm text-foreground font-medium mt-1">{selectedLead.industry || '-'}</p>
                      </div>
                      <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/70 uppercase tracking-widest font-medium"><Users className="w-3 h-3" />Size</div>
                        <p className="text-sm text-foreground font-medium mt-1">{selectedLead.employeeCategory || selectedLead.employeeNumber || '-'}</p>
                      </div>
                      {selectedLead.website && (
                        <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
                          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/70 uppercase tracking-widest font-medium"><Globe className="w-3 h-3" />Domain</div>
                          <p className="text-sm text-primary font-medium mt-1 truncate">{selectedLead.website}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <Separator className="bg-gray-100" />

                  {/* Metadata Section */}
                  <div>
                    <p className="text-[10px] text-muted-foreground/60 uppercase tracking-widest font-semibold mb-2">Metadata</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/70 uppercase tracking-widest font-medium"><Activity className="w-3 h-3" />Status</div>
                        <Badge
                          variant="outline"
                          className={`mt-1 text-[10px] h-5 px-1.5 rounded-full ${
                            selectedLead._dbFields?.status === 'imported' ? 'bg-zinc-500/15 text-zinc-600 border-zinc-500/20' :
                            selectedLead._dbFields?.status === 'sent' ? 'bg-blue-500/15 text-blue-700 border-blue-500/20' :
                            selectedLead._dbFields?.status === 'replied' ? 'bg-emerald-500/15 text-emerald-700 border-emerald-500/20' :
                            selectedLead._dbFields?.status === 'bounced' ? 'bg-red-500/15 text-red-600 border-red-500/20' :
                            'bg-gray-100 text-muted-foreground border-gray-200'
                          }`}
                        >
                          {selectedLead._dbFields?.status || '-'}
                        </Badge>
                      </div>
                      <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/70 uppercase tracking-widest font-medium"><ShieldCheck className="w-3 h-3" />Consent</div>
                        <Badge variant="outline" className={`mt-1 text-[10px] h-5 px-1.5 rounded-full ${CONSENT_COLORS[selectedLead._dbFields?.consentStatus || 'unknown']}`}>
                          {selectedLead._dbFields?.consentStatus || 'unknown'}
                        </Badge>
                      </div>
                      <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/70 uppercase tracking-widest font-medium"><Tag className="w-3 h-3" />Source</div>
                        <p className="text-sm text-foreground font-medium mt-1">{selectedLead._dbFields?.source || '-'}</p>
                      </div>
                      <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/70 uppercase tracking-widest font-medium"><UserPlus className="w-3 h-3" />Assigned To</div>
                        <p className="text-sm text-foreground font-medium mt-1">{selectedLead._dbFields?.assignedTo || 'Unassigned'}</p>
                      </div>
                    </div>
                    {selectedLead._dbFields?.createdAt && (
                      <div className="p-3 rounded-lg bg-gray-50 border border-gray-200 mt-2">
                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/70 uppercase tracking-widest font-medium"><Clock className="w-3 h-3" />Created</div>
                        <p className="text-sm text-foreground font-medium mt-1">{formatTime(selectedLead._dbFields.createdAt)}</p>
                      </div>
                    )}
                  </div>

                  <Separator className="bg-gray-100" />

                  {/* Generate Email */}
                  <Button className="w-full h-10 gap-2 text-sm font-medium" style={{ background: 'linear-gradient(135deg, #D4AF37, #E8C860)', color: '#000' }} disabled={generatingEmail || !selectedLead.email} onClick={handleGenerateEmail}>
                    {generatingEmail ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    {generatingEmail ? 'Generating...' : 'Generate AI Email'}
                  </Button>

                  {generatedDraft && (
                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
                      <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-600" /><span className="text-xs font-medium text-emerald-600">Email Generated ({generatedDraft.confidenceScore}%)</span></div>
                      <div className="p-2.5 rounded-lg bg-gray-50 border border-gray-200"><p className="text-[10px] text-muted-foreground uppercase mb-1">Subject</p><p className="text-xs text-foreground">{generatedDraft.subject}</p></div>
                      <div className="p-2.5 rounded-lg bg-gray-50 border border-gray-200"><p className="text-[10px] text-muted-foreground uppercase mb-1">Body</p><p className="text-xs text-foreground/80 leading-relaxed whitespace-pre-wrap line-clamp-6">{generatedDraft.body}</p></div>
                    </motion.div>
                  )}
                  {emailGenError && <div className="p-2.5 rounded-lg border border-red-500/20 bg-red-500/5"><p className="text-xs text-red-600">{emailGenError}</p></div>}
                </div>
              )}

              {/* ═══ SCORES TAB (Task 2) ═══ */}
              {detailTab === 'scores' && selectedLead._dbFields && (
                <div className="space-y-4">
                  {/* Total Score */}
                  <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50 border border-gray-200">
                    <div>
                      <p className="text-[10px] text-muted-foreground/60 uppercase tracking-widest font-semibold">Lead Score</p>
                      <p className="text-2xl font-bold tabular-nums mt-1" style={{ color: getScoreColor(selectedLead._dbFields.leadScore) }}>
                        {selectedLead._dbFields.leadScore ?? 0}<span className="text-sm text-muted-foreground font-normal">/100</span>
                      </p>
                    </div>
                    <div
                      className="w-14 h-14 rounded-full flex items-center justify-center border-2"
                      style={{ borderColor: getScoreColor(selectedLead._dbFields.leadScore), backgroundColor: `${getScoreColor(selectedLead._dbFields.leadScore)}10` }}
                    >
                      <span className="text-lg font-bold tabular-nums" style={{ color: getScoreColor(selectedLead._dbFields.leadScore) }}>
                        {selectedLead._dbFields.leadScore ?? 0}
                      </span>
                    </div>
                  </div>

                  {/* Score Breakdown Bars */}
                  <div className="space-y-3">
                    {(() => {
                      const dbf = selectedLead._dbFields!;
                      const bd = scoreBreakdowns[selectedLead.id];
                      const scores = [
                        { label: 'Role Score', value: bd?.role ?? Math.min(Math.round((dbf.companyFitScore ?? 0) * 0.6), 25), max: 25, icon: Briefcase },
                        { label: 'Email Health', value: bd?.emailHealth ?? Math.round(((dbf.emailHealthScore ?? 0) / 100) * 15), max: 15, icon: MailCheck },
                        { label: 'Company Fit', value: bd?.companyFit ?? Math.round(((dbf.companyFitScore ?? 0) / 100) * 20), max: 20, icon: Building2 },
                        { label: 'Data Completeness', value: bd?.dataCompleteness ?? computeCompleteness(selectedLead), max: 15, icon: Database },
                        { label: 'Engagement', value: bd?.engagement ?? Math.round(((dbf.engagementScore ?? 0) / 100) * 15), max: 15, icon: Activity },
                        { label: 'Enrichment', value: bd?.enrichment ?? Math.round(((dbf.enrichmentScore ?? 0) / 100) * 10), max: 10, icon: Sparkles },
                      ];
                      return scores.map(s => {
                        const pct = s.max > 0 ? Math.round((s.value / s.max) * 100) : 0;
                        const barColor = getBarColor(s.value, s.max);
                        return (
                          <div key={s.label} className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <s.icon className="w-3.5 h-3.5 text-muted-foreground/50" />
                                <span className="text-xs text-foreground/80 font-medium">{s.label}</span>
                              </div>
                              <span className="text-xs font-bold tabular-nums" style={{ color: barColor }}>{s.value}<span className="text-muted-foreground/40 font-normal">/{s.max}</span></span>
                            </div>
                            <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                              <motion.div
                                className="h-full rounded-full"
                                style={{ background: `linear-gradient(90deg, ${barColor}, ${barColor}CC)` }}
                                initial={{ width: 0 }}
                                animate={{ width: `${pct}%` }}
                                transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                              />
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>

                  {/* Refresh score breakdown */}
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full h-8 gap-2 text-xs border-gray-200 text-muted-foreground hover:text-foreground hover:bg-gray-100/50"
                    onClick={() => handleScoreHover(selectedLead.id)}
                  >
                    <RefreshCw className="w-3 h-3" />Refresh Breakdown
                  </Button>
                </div>
              )}

              {/* ═══ TIMELINE TAB (L-11) ═══ */}
              {detailTab === 'timeline' && (
                <div className="space-y-0">
                  {timelineLoading ? (
                    <div className="space-y-3 py-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 bg-gray-50 rounded-lg" />)}</div>
                  ) : timeline.length === 0 ? (
                    <div className="py-12 text-center"><Activity className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" /><p className="text-sm text-muted-foreground">No activity recorded yet</p></div>
                  ) : (
                    <div className="relative">
                      <div className="absolute left-[15px] top-2 bottom-2 w-px bg-gray-100/50" />
                      <div className="space-y-0">
                        {timeline.map((event, i) => {
                          const IconComp = TIMELINE_ICONS[event.type] || Activity;
                          return (
                            <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: Math.min(i * 0.03, 0.3) }} className="relative flex gap-4 py-3 group">
                              <div className="relative z-10 w-[30px] h-[30px] rounded-full bg-gray-100/50 border border-gray-200 flex items-center justify-center shrink-0 group-hover:border-primary/30 transition-colors">
                                <IconComp className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                              </div>
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
                  <div className="space-y-2">
                    <Textarea placeholder="Add a note about this lead..." value={newNote} onChange={e => setNewNote(e.target.value)} className="min-h-[80px] text-sm bg-gray-50 border-gray-200 text-foreground placeholder:text-muted-foreground/50 focus:border-primary/30 resize-none" />
                    <Button size="sm" className="h-8 text-xs gap-1.5" style={{ background: 'linear-gradient(135deg, #D4AF37, #E8C860)', color: '#000' }} disabled={!newNote.trim()} onClick={handleAddNote}>
                      <StickyNote className="w-3 h-3" />Add Note
                    </Button>
                  </div>

                  <Separator className="bg-gray-100" />

                  {notesLoading ? (
                    <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 bg-gray-50 rounded-lg" />)}</div>
                  ) : notes.length === 0 ? (
                    <div className="py-8 text-center"><StickyNote className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" /><p className="text-sm text-muted-foreground">No notes yet</p></div>
                  ) : (
                    <div className="space-y-3">
                      {notes.map(note => (
                        <motion.div key={note.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-3 rounded-lg bg-gray-50 border border-gray-200">
                          <p className="text-sm text-foreground/90 whitespace-pre-wrap">{note.body}</p>
                          <p className="text-[10px] text-muted-foreground/50 mt-2">{formatTime(note.createdAt)}</p>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>
              )}

                    </div>
                  </ScrollArea>
                </>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Keep old Sheet hidden for compatibility — replaced by slide-over */}
      <Sheet open={false} onOpenChange={setDetailOpen}>
        <SheetContent className="w-full sm:max-w-xl bg-card/95 backdrop-blur-2xl border-gray-200 text-foreground overflow-y-auto" />
      </Sheet>

      {/* ═══ L-14: Assign Dialog ═══ */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent className="bg-card/95 backdrop-blur-xl border-gray-200 text-foreground max-w-md">
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
                <SelectTrigger className="h-9 text-xs bg-gray-50 border-gray-200"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-white border border-gray-200 shadow-lg">
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
                  <SelectTrigger className="h-9 text-xs bg-gray-50 border-gray-200"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-white border border-gray-200 shadow-lg">
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
        <DialogContent className="bg-card/95 backdrop-blur-xl border-gray-200 text-foreground max-w-3xl max-h-[85vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <GitMerge className="w-4 h-4 text-amber-600" />
              Duplicate Detection
              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-500/20 text-[10px] ml-2">
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
                <CheckCircle2 className="w-8 h-8 text-emerald-600/50 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No duplicates found</p>
              </div>
            ) : (
              <div className="space-y-4 pb-4">
                {dedupGroups.map((group, gi) => {
                  const primary = group.contacts[0];
                  const secondaries = group.contacts.slice(1);
                  return (
                    <div key={gi} className="p-4 rounded-xl bg-gray-50 border border-gray-200 space-y-3">
                      <div className="flex items-center justify-between">
                        <Badge variant="outline" className={`${group.matchType === 'exact' ? 'bg-red-500/15 text-red-600 border-red-500/20' : group.matchType === 'likely' ? 'bg-amber-500/15 text-amber-700 border-amber-500/20' : 'bg-zinc-500/15 text-zinc-600 border-zinc-500/20'} text-[10px]`}>
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
                          <div key={c.id} className="flex items-center gap-3 py-2 px-3 rounded-lg bg-gray-50 border border-gray-200">
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

      {/* ═══ Task 2: Bulk Actions Toolbar ═══ */}
      <AnimatePresence>
        {selectedIds.size > 0 && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 px-4 py-3 rounded-2xl border border-gray-200 shadow-2xl shadow-gray-400/40"
            style={{
              background: '#FFFFFF', border: '1px solid #E5E7EB', boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
              backdropFilter: 'blur(40px)',
            }}
          >
            <span className="text-xs font-medium text-foreground tabular-nums pr-2 border-r border-gray-200">
              {selectedIds.size} selected
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-gray-100 px-3"
              onClick={() => { setSelectedIds(new Set()); }}
            >
              <X className="w-3 h-3" />Clear
            </Button>
            <Separator orientation="vertical" className="h-5 bg-gray-100/50" />
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 text-xs text-primary hover:bg-primary/10 px-3"
              onClick={handleBulkGenerateDrafts}
            >
              <FileText className="w-3 h-3" />Generate Drafts
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 text-xs text-emerald-600 hover:bg-emerald-50 px-3"
              onClick={() => setAssignDialogOpen(true)}
            >
              <UserPlus className="w-3 h-3" />Add to Segment
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 text-xs text-amber-600 hover:bg-amber-50 px-3"
              onClick={handleBulkExportSelected}
            >
              <Download className="w-3 h-3" />Export
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-gray-100 px-3"
              onClick={() => setBulkStatusOpen(true)}
            >
              <Activity className="w-3 h-3" />Update Status
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ Task 2: Inline Note Dialog ═══ */}
      <Dialog open={inlineNoteOpen} onOpenChange={setInlineNoteOpen}>
        <DialogContent className="bg-card/95 backdrop-blur-xl border-gray-200 text-foreground max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm">Add Note</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">Add a note to this lead</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <Textarea
              placeholder="Write your note here..."
              value={inlineNoteText}
              onChange={e => setInlineNoteText(e.target.value)}
              className="min-h-[100px] text-sm bg-gray-50 border-gray-200 text-foreground placeholder:text-muted-foreground/50 focus:border-primary/30 resize-none"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setInlineNoteOpen(false)}>Cancel</Button>
              <Button
                size="sm"
                className="h-8 text-xs gap-1.5"
                style={{ background: 'linear-gradient(135deg, #D4AF37, #E8C860)', color: '#000' }}
                disabled={!inlineNoteText.trim() || inlineNoteSaving}
                onClick={handleInlineNoteSave}
              >
                {inlineNoteSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <StickyNote className="w-3 h-3" />}
                {inlineNoteSaving ? 'Saving...' : 'Save Note'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══ Task 2: Bulk Status Update Dialog ═══ */}
      <Dialog open={bulkStatusOpen} onOpenChange={setBulkStatusOpen}>
        <DialogContent className="bg-card/95 backdrop-blur-xl border-gray-200 text-foreground max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm">Update Status</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Change status for {selectedIds.size} selected lead{selectedIds.size !== 1 ? 's' : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground uppercase tracking-wider font-medium">New Status</label>
              <Select value={bulkNewStatus} onValueChange={setBulkNewStatus}>
                <SelectTrigger className="h-9 text-xs bg-gray-50 border-gray-200"><SelectValue placeholder="Select status..." /></SelectTrigger>
                <SelectContent className="bg-white border border-gray-200 shadow-lg">
                  <SelectItem value="imported" className="text-xs text-foreground">Imported</SelectItem>
                  <SelectItem value="cleaned" className="text-xs text-foreground">Cleaned</SelectItem>
                  <SelectItem value="drafted" className="text-xs text-foreground">Drafted</SelectItem>
                  <SelectItem value="queued" className="text-xs text-foreground">Queued</SelectItem>
                  <SelectItem value="sent" className="text-xs text-foreground">Sent</SelectItem>
                  <SelectItem value="replied" className="text-xs text-foreground">Replied</SelectItem>
                  <SelectItem value="bounced" className="text-xs text-foreground">Bounced</SelectItem>
                  <SelectItem value="suppressed" className="text-xs text-foreground">Suppressed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setBulkStatusOpen(false)}>Cancel</Button>
              <Button
                size="sm"
                className="h-8 text-xs gap-1.5"
                style={{ background: 'linear-gradient(135deg, #D4AF37, #E8C860)', color: '#000' }}
                disabled={!bulkNewStatus}
                onClick={handleBulkStatusUpdate}
              >
                <Activity className="w-3 h-3" />Update {selectedIds.size} Leads
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
    </PageTransition>
  );
}