'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import {
  Users,
  Search,
  Sparkles,
  Eye,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  ShieldCheck,
  MailCheck,
  Mail,
  Building2,
  MapPin,
  Phone,
  Briefcase,
  CircleDot,
  CheckCircle2,
  XCircle,
  Upload,
  Download,
  Ban,
  ArrowUpDown,
  UserPlus,
  Clock,
  FileText,
  Shield,
  Inbox,
  Send,
  AlertTriangle,
  Activity,
} from 'lucide-react';

/* ────────────────────────── Types ────────────────────────── */

interface Company {
  id: string;
  name: string;
  domain?: string;
  industry?: string;
}

interface Lead {
  id: string;
  name: string;
  email?: string;
  jobTitle?: string;
  role?: string;
  phone?: string;
  location?: string;
  status: string;
  emailHealth?: string;
  emailHealthScore?: number;
  score?: number;
  company?: Company;
  isSuppressed?: boolean;
  suppressionReason?: string;
  lastCheckedAt?: string;
  lastContactedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface VerifyResult {
  status: string;
  score: number;
  recommendation: string;
  checks?: {
    syntax?: boolean;
    mx_records?: boolean;
    disposable?: boolean;
    role_based?: boolean;
    free_provider?: boolean;
    company_match?: boolean;
  };
}

type SortField = 'name' | 'score' | 'status';
type SortDir = 'asc' | 'desc';

/* ────────────────────────── Constants ────────────────────────── */

const PAGE_SIZE = 20;

const STATUS_COLORS: Record<string, string> = {
  imported: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30',
  cleaned: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  drafted: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  pending_review: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  queued: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  sent: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  replied: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  bounced: 'bg-red-500/20 text-red-300 border-red-500/30',
  suppressed: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  archived: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30',
};

const HEALTH_STYLES: Record<string, { dot: string; text: string }> = {
  valid: { dot: 'bg-emerald-400', text: 'text-emerald-400' },
  risky: { dot: 'bg-amber-400', text: 'text-amber-400' },
  invalid: { dot: 'bg-red-400', text: 'text-red-400' },
  unknown: { dot: 'bg-zinc-500', text: 'text-zinc-500' },
};

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'imported', label: 'Imported' },
  { value: 'cleaned', label: 'Cleaned' },
  { value: 'drafted', label: 'Drafted' },
  { value: 'pending_review', label: 'Pending Review' },
  { value: 'queued', label: 'Queued' },
  { value: 'sent', label: 'Sent' },
  { value: 'replied', label: 'Replied' },
  { value: 'bounced', label: 'Bounced' },
  { value: 'suppressed', label: 'Suppressed' },
  { value: 'archived', label: 'Archived' },
];

const STATUS_FLOW = ['imported', 'cleaned', 'drafted', 'pending_review', 'queued', 'sent', 'replied', 'bounced', 'suppressed', 'archived'];

const CHECK_LABELS: Record<string, string> = {
  syntax: 'Syntax',
  mx_records: 'MX Records',
  disposable: 'Disposable',
  role_based: 'Role Based',
  free_provider: 'Free Provider',
  company_match: 'Company Match',
};

/* ────────────────────────── Helpers ────────────────────────── */

function formatDate(dateStr?: string | null) {
  if (!dateStr) return null;
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + ' at ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return dateStr;
  }
}

function scoreColor(score: number | undefined | null) {
  if (!score) return 'text-zinc-500';
  if (score >= 85) return 'text-emerald-400';
  if (score >= 70) return 'text-amber-400';
  return 'text-red-400';
}

function scoreBgColor(score: number | undefined | null) {
  if (!score) return 'bg-zinc-500/10';
  if (score >= 85) return 'bg-emerald-500/10';
  if (score >= 70) return 'bg-amber-500/10';
  return 'bg-red-500/10';
}

/* ────────────────────────── Sub-Components ────────────────────────── */

function SortIcon({ field, sortField, sortDir }: { field: SortField; sortField: SortField | null; sortDir: SortDir }) {
  if (sortField !== field) return <ArrowUpDown className="w-3 h-3 ml-1 opacity-40" />;
  return sortDir === 'asc'
    ? <ChevronUp className="w-3 h-3 ml-1 text-primary" />
    : <ChevronDown className="w-3 h-3 ml-1 text-primary" />;
}

function CheckResultRow({ label, passed }: { label: string; passed: boolean | undefined }) {
  if (passed === undefined) return null;
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-sm text-muted-foreground">{label}</span>
      {passed ? (
        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
      ) : (
        <XCircle className="w-4 h-4 text-red-400" />
      )}
    </div>
  );
}

function InlineVerifyExpansion({ result }: { result: VerifyResult }) {
  return (
    <div className="mt-2 p-2.5 rounded-md bg-background/80 border border-border space-y-1">
      {result.checks && Object.entries(result.checks).map(([key, val]) => (
        <CheckResultRow key={key} label={CHECK_LABELS[key] || key} passed={val} />
      ))}
      <Separator className="my-1.5" />
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">Overall</span>
        <span className={`text-xs font-semibold tabular-nums ${scoreColor(result.score)}`}>{result.score}/100</span>
      </div>
      {result.recommendation && (
        <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">{result.recommendation}</p>
      )}
    </div>
  );
}

function EmptyState({ navigateTo }: { navigateTo?: (screen: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="w-20 h-20 rounded-full bg-primary/5 flex items-center justify-center mb-5">
        <UserPlus className="w-9 h-9 text-primary/40" />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-1.5">No leads yet</h3>
      <p className="text-sm text-muted-foreground text-center max-w-xs mb-6">
        Import your first list to get started building your outreach pipeline.
      </p>
      {navigateTo && (
        <Button
          onClick={() => navigateTo('import')}
          className="gap-2"
          size="sm"
        >
          <Upload className="w-4 h-4" />
          Go to Import
        </Button>
      )}
    </div>
  );
}

/* ────────────────────────── Main Component ────────────────────────── */

export default function LeadsScreen({ navigateTo }: { navigateTo?: (screen: string) => void }) {
  /* ── Core State ── */
  const [leads, setLeads] = useState<Lead[]>([]);
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [companyFilter, setCompanyFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [generating, setGenerating] = useState<string | null>(null);
  const [verifying, setVerifying] = useState<string | null>(null);
  const [verifyResult, setVerifyResult] = useState<Record<string, VerifyResult>>({});
  const [refreshKey, setRefreshKey] = useState(0);

  /* ── New State ── */
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [detailLead, setDetailLead] = useState<Lead | null>(null);
  const [detailStatus, setDetailStatus] = useState<string>('');
  const [expandedEmailId, setExpandedEmailId] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [bulkStatusOpen, setBulkStatusOpen] = useState(false);
  const [bulkVerifying, setBulkVerifying] = useState(false);
  const [bulkDrafting, setBulkDrafting] = useState(false);
  const [detailVerifying, setDetailVerifying] = useState(false);
  const [detailSuppressing, setDetailSuppressing] = useState(false);

  /* ── Fetch leads ── */
  useEffect(() => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (statusFilter !== 'all') params.set('status', statusFilter);
    if (companyFilter !== 'all') params.set('companyId', companyFilter);
    params.set('page', String(page));
    params.set('limit', String(PAGE_SIZE));

    fetch(`/api/leads?${params}`)
      .then(r => r.json())
      .then(data => {
        const raw = Array.isArray(data) ? data : data.leads || [];
        setLeads(raw.map((l: any) => ({
          ...l,
          name: l.rawName || l.name,
          jobTitle: l.title || l.jobTitle,
          role: l.role,
          phone: l.phone,
          location: l.location,
          score: l.leadScore ?? l.score,
          emailHealthScore: l.emailHealthScore,
          isSuppressed: l.isSuppressed,
          suppressionReason: l.suppressionReason,
          lastCheckedAt: l.lastCheckedAt,
          lastContactedAt: l.lastContactedAt,
          createdAt: l.createdAt,
          updatedAt: l.updatedAt,
          company: l.company
            ? { ...l.company, name: l.company.rawName || l.company.name, domain: l.company.domain, industry: l.company.industry }
            : undefined,
        })));
        setTotalCount(Array.isArray(data) ? data.length : data.total || 0);
      })
      .catch(() => {})
      .finally(() => { setLoading(false); });
  }, [search, statusFilter, companyFilter, page, refreshKey]);

  /* ── Fetch companies ── */
  useEffect(() => {
    fetch('/api/companies')
      .then(r => r.json())
      .then(data => {
        const list = Array.isArray(data) ? data : data.companies || [];
        setCompanies(list.map((c: any) => ({ id: c.id, name: c.rawName || c.name })));
      })
      .catch(() => {});
  }, []);

  /* ── Handlers ── */
  const handleSearchChange = useCallback((val: string) => {
    setSearch(val);
    setPage(1);
    setSelectedIds(new Set());
  }, []);

  const handleStatusChange = useCallback((val: string) => {
    setStatusFilter(val);
    setPage(1);
    setSelectedIds(new Set());
  }, []);

  const handleCompanyChange = useCallback((val: string) => {
    setCompanyFilter(val);
    setPage(1);
    setSelectedIds(new Set());
  }, []);

  const handleVerifyEmail = async (lead: Lead) => {
    if (!lead.email) return;
    setVerifying(lead.id);
    try {
      const res = await fetch('/api/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: lead.email, companyDomain: lead.company?.domain }),
      });
      const data = await res.json();
      if (data.success) {
        setVerifyResult(prev => ({ ...prev, [lead.id]: data.result }));
      }
    } catch {}
    setVerifying(null);
  };

  const handleVerifyAll = async () => {
    const emails = leads.filter(l => l.email).map(l => ({ email: l.email, companyDomain: l.company?.domain }));
    if (emails.length === 0) return;
    setVerifying('all');
    try {
      const res = await fetch('/api/verify-email', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emails }),
      });
      const data = await res.json();
      if (data.success) {
        const map: Record<string, VerifyResult> = {};
        for (const r of data.results) {
          const lead = leads.find(l => l.email === r.email);
          if (lead) map[lead.id] = r;
        }
        setVerifyResult(map);
      }
    } catch {}
    setVerifying(null);
  };

  const handleGenerateDraft = async (lead: Lead) => {
    setGenerating(lead.id);
    try {
      await fetch('/api/drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactId: lead.id }),
      });
      setRefreshKey(k => k + 1);
    } catch {}
    setGenerating(null);
  };

  /* ── Bulk handlers ── */
  const handleBulkVerify = async () => {
    const selectedLeads = leads.filter(l => selectedIds.has(l.id) && l.email);
    if (selectedLeads.length === 0) return;
    setBulkVerifying(true);
    try {
      const emails = selectedLeads.map(l => ({ email: l.email, companyDomain: l.company?.domain }));
      const res = await fetch('/api/verify-email', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emails }),
      });
      const data = await res.json();
      if (data.success) {
        const map: Record<string, VerifyResult> = {};
        for (const r of data.results) {
          const lead = selectedLeads.find(l => l.email === r.email);
          if (lead) map[lead.id] = r;
        }
        setVerifyResult(prev => ({ ...prev, ...map }));
      }
    } catch {}
    setBulkVerifying(false);
  };

  const handleBulkDrafts = async () => {
    const selectedLeads = leads.filter(l => selectedIds.has(l.id) && (l.status === 'cleaned' || l.status === 'pending_review'));
    if (selectedLeads.length === 0) return;
    setBulkDrafting(true);
    try {
      await Promise.allSettled(
        selectedLeads.map(l =>
          fetch('/api/drafts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contactId: l.id }),
          })
        )
      );
      setRefreshKey(k => k + 1);
    } catch {}
    setBulkDrafting(false);
  };

  const handleBulkStatusChange = async (newStatus: string) => {
    if (selectedIds.size === 0) return;
    try {
      await Promise.allSettled(
        Array.from(selectedIds).map(id =>
          fetch(`/api/leads/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus }),
          })
        )
      );
      setRefreshKey(k => k + 1);
      setSelectedIds(new Set());
    } catch {}
  };

  const handleBulkSuppress = async () => {
    if (selectedIds.size === 0) return;
    try {
      await Promise.allSettled(
        Array.from(selectedIds).map(id =>
          fetch(`/api/leads/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'suppressed', isSuppressed: true, suppressionReason: 'Bulk suppressed' }),
          })
        )
      );
      setRefreshKey(k => k + 1);
      setSelectedIds(new Set());
    } catch {}
  };

  /* ── Detail dialog handlers ── */
  const openDetail = (lead: Lead) => {
    setDetailLead(lead);
    setDetailStatus(lead.status);
  };

  const handleDetailVerify = async () => {
    if (!detailLead?.email) return;
    setDetailVerifying(true);
    try {
      const res = await fetch('/api/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: detailLead.email, companyDomain: detailLead.company?.domain }),
      });
      const data = await res.json();
      if (data.success) {
        setVerifyResult(prev => ({ ...prev, [detailLead.id]: data.result }));
      }
    } catch {}
    setDetailVerifying(false);
  };

  const handleDetailStatusChange = async (newStatus: string) => {
    if (!detailLead) return;
    setDetailStatus(newStatus);
    try {
      await fetch(`/api/leads/${detailLead.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      setLeads(prev => prev.map(l => l.id === detailLead.id ? { ...l, status: newStatus } : l));
      setRefreshKey(k => k + 1);
    } catch {}
  };

  const handleDetailSuppress = async () => {
    if (!detailLead) return;
    setDetailSuppressing(true);
    try {
      await fetch(`/api/leads/${detailLead.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'suppressed', isSuppressed: true, suppressionReason: 'Manually suppressed' }),
      });
      setLeads(prev => prev.map(l => l.id === detailLead.id ? { ...l, status: 'suppressed', isSuppressed: true } : l));
      setRefreshKey(k => k + 1);
      setDetailLead({ ...detailLead, status: 'suppressed', isSuppressed: true });
      setDetailStatus('suppressed');
    } catch {}
    setDetailSuppressing(false);
  };

  const handleDetailGenerateDraft = async () => {
    if (!detailLead) return;
    setGenerating(detailLead.id);
    try {
      await fetch('/api/drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactId: detailLead.id }),
      });
      setRefreshKey(k => k + 1);
      if (navigateTo) navigateTo('drafts');
    } catch {}
    setGenerating(null);
  };

  /* ── Selection handlers ── */
  const allSelected = leads.length > 0 && leads.every(l => selectedIds.has(l.id));
  const someSelected = leads.some(l => selectedIds.has(l.id)) && !allSelected;

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(leads.map(l => l.id)));
    }
  };

  const toggleOne = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  /* ── Sorting ── */
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const sortedLeads = useMemo(() => {
    if (!sortField) return leads;
    return [...leads].sort((a, b) => {
      let aVal: string | number = '';
      let bVal: string | number = '';
      if (sortField === 'name') { aVal = a.name.toLowerCase(); bVal = b.name.toLowerCase(); }
      else if (sortField === 'score') { aVal = a.score ?? 0; bVal = b.score ?? 0; }
      else if (sortField === 'status') { aVal = a.status; bVal = b.status; }
      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [leads, sortField, sortDir]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  /* ── Build activity timeline for detail ── */
  const buildTimeline = (lead: Lead) => {
    const items: { icon: React.ReactNode; label: string; date: string | null | undefined; color: string }[] = [];
    items.push({ icon: <Inbox className="w-3.5 h-3.5" />, label: 'Imported', date: lead.createdAt, color: 'text-zinc-400' });
    if (lead.lastCheckedAt || verifyResult[lead.id]) {
      items.push({ icon: <Shield className="w-3.5 h-3.5" />, label: 'Email verified', date: lead.lastCheckedAt, color: 'text-emerald-400' });
    }
    if (lead.status === 'drafted' || lead.status === 'pending_review') {
      items.push({ icon: <FileText className="w-3.5 h-3.5" />, label: 'Draft generated', date: lead.updatedAt, color: 'text-amber-400' });
    }
    if (lead.status === 'sent') {
      items.push({ icon: <Send className="w-3.5 h-3.5" />, label: 'Email sent', date: lead.lastContactedAt, color: 'text-emerald-400' });
    }
    if (lead.status === 'replied') {
      items.push({ icon: <Activity className="w-3.5 h-3.5" />, label: 'Received reply', date: lead.lastContactedAt, color: 'text-emerald-300' });
    }
    if (lead.status === 'bounced') {
      items.push({ icon: <AlertTriangle className="w-3.5 h-3.5" />, label: 'Email bounced', date: lead.lastContactedAt, color: 'text-red-400' });
    }
    if (lead.isSuppressed) {
      items.push({ icon: <Ban className="w-3.5 h-3.5" />, label: 'Suppressed', date: lead.updatedAt, color: 'text-slate-400' });
    }
    return items;
  };

  const detailVerifyResult = detailLead ? verifyResult[detailLead.id] : null;

  return (
    <div className="max-h-[calc(100vh-200px)] overflow-y-auto space-y-4 pr-1">
      {/* ── Filters ── */}
      <Card className="bg-card border border-border">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search leads by name, email, company, or title..."
                value={search}
                onChange={e => handleSearchChange(e.target.value)}
                className="pl-9 h-9 text-sm bg-background border-border"
              />
            </div>
            <Select value={statusFilter} onValueChange={handleStatusChange}>
              <SelectTrigger className="w-full sm:w-44 h-9 text-sm bg-background border-border">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map(o => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={companyFilter} onValueChange={handleCompanyChange}>
              <SelectTrigger className="w-full sm:w-48 h-9 text-sm bg-background border-border">
                <SelectValue placeholder="Company" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Companies</SelectItem>
                {companies.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* ── Bulk Action Bar ── */}
      {selectedIds.size > 0 && (
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <p className="text-sm font-medium text-primary">
                <span className="tabular-nums">{selectedIds.size}</span> lead{selectedIds.size !== 1 ? 's' : ''} selected
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs gap-1.5 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                  disabled={bulkVerifying}
                  onClick={handleBulkVerify}
                >
                  {bulkVerifying ? (
                    <div className="w-3.5 h-3.5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <><MailCheck className="w-3.5 h-3.5" />Verify Emails</>
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs gap-1.5 border-primary/30 text-primary hover:bg-primary/10"
                  disabled={bulkDrafting}
                  onClick={handleBulkDrafts}
                >
                  {bulkDrafting ? (
                    <div className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <><Sparkles className="w-3.5 h-3.5" />Generate Drafts</>
                  )}
                </Button>
                <DropdownMenu open={bulkStatusOpen} onOpenChange={setBulkStatusOpen}>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 border-border">
                      <CircleDot className="w-3.5 h-3.5" />Change Status
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44">
                    <DropdownMenuLabel className="text-xs text-muted-foreground">Set status to:</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {STATUS_FLOW.map(s => (
                      <DropdownMenuItem key={s} className="text-xs capitalize cursor-pointer" onClick={() => { handleBulkStatusChange(s); setBulkStatusOpen(false); }}>
                        {s.replace(/_/g, ' ')}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs gap-1.5 border-border"
                  onClick={() => { /* placeholder */ }}
                >
                  <Download className="w-3.5 h-3.5" />Export
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs gap-1.5 border-red-500/30 text-red-400 hover:bg-red-500/10"
                  onClick={handleBulkSuppress}
                >
                  <Ban className="w-3.5 h-3.5" />Suppress
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Total Count + Actions ── */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          <Users className="w-3.5 h-3.5 inline mr-1.5" />
          <span className="text-primary font-medium tabular-nums">{totalCount}</span> leads total
        </p>
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs gap-1.5 border-primary/30 text-primary hover:bg-primary/10"
          disabled={verifying === 'all' || leads.length === 0}
          onClick={handleVerifyAll}
        >
          {verifying === 'all' ? (
            <div className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          ) : (
            <><MailCheck className="w-3.5 h-3.5" />Verify All Emails</>
          )}
        </Button>
      </div>

      {/* ── Leads Table ── */}
      <Card className="bg-card border border-border">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : leads.length === 0 && !loading ? (
            <EmptyState navigateTo={navigateTo} />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-muted-foreground text-xs w-10">
                      <Checkbox
                        checked={allSelected}
                        ref={(el: any) => { if (el) (el as any).dataset.state = someSelected ? 'indeterminate' : el.dataset.state; }}
                        onCheckedChange={toggleAll}
                        aria-label="Select all leads"
                      />
                    </TableHead>
                    <TableHead
                      className="text-muted-foreground text-xs cursor-pointer select-none"
                      onClick={() => handleSort('name')}
                    >
                      <div className="flex items-center">
                        Name
                        <SortIcon field="name" sortField={sortField} sortDir={sortDir} />
                      </div>
                    </TableHead>
                    <TableHead className="text-muted-foreground text-xs">Email</TableHead>
                    <TableHead className="text-muted-foreground text-xs">Company</TableHead>
                    <TableHead className="text-muted-foreground text-xs hidden lg:table-cell">Title / Role</TableHead>
                    <TableHead
                      className="text-muted-foreground text-xs cursor-pointer select-none"
                      onClick={() => handleSort('status')}
                    >
                      <div className="flex items-center">
                        Status
                        <SortIcon field="status" sortField={sortField} sortDir={sortDir} />
                      </div>
                    </TableHead>
                    <TableHead className="text-muted-foreground text-xs hidden md:table-cell">Email Health</TableHead>
                    <TableHead
                      className="text-muted-foreground text-xs text-right hidden sm:table-cell cursor-pointer select-none"
                      onClick={() => handleSort('score')}
                    >
                      <div className="flex items-center justify-end">
                        Score
                        <SortIcon field="score" sortField={sortField} sortDir={sortDir} />
                      </div>
                    </TableHead>
                    <TableHead className="text-muted-foreground text-xs text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedLeads.map(lead => {
                    const health = HEALTH_STYLES[lead.emailHealth || 'unknown'] || HEALTH_STYLES.unknown;
                    const canGenerate = lead.status === 'cleaned' || lead.status === 'pending_review';
                    const vr = verifyResult[lead.id];
                    const isExpanded = expandedEmailId === lead.id;
                    return (
                      <TableRow key={lead.id} className="border-border">
                        {/* Checkbox */}
                        <TableCell className="w-10">
                          <Checkbox
                            checked={selectedIds.has(lead.id)}
                            onCheckedChange={() => toggleOne(lead.id)}
                            aria-label={`Select ${lead.name}`}
                          />
                        </TableCell>

                        {/* Name */}
                        <TableCell className="text-foreground text-sm font-medium">{lead.name}</TableCell>

                        {/* Email */}
                        <TableCell className="text-muted-foreground text-sm max-w-[180px] truncate">{lead.email || '—'}</TableCell>

                        {/* Company */}
                        <TableCell className="text-foreground text-sm">{lead.company?.name || '—'}</TableCell>

                        {/* Title / Role */}
                        <TableCell className="text-muted-foreground text-sm hidden lg:table-cell max-w-[200px] truncate">
                          {lead.jobTitle || lead.role || '—'}
                        </TableCell>

                        {/* Status */}
                        <TableCell>
                          <Badge variant="outline" className={STATUS_COLORS[lead.status] || STATUS_COLORS.imported}>
                            {lead.status.replace(/_/g, ' ')}
                          </Badge>
                        </TableCell>

                        {/* Email Health - expandable */}
                        <TableCell className="hidden md:table-cell">
                          {vr ? (
                            <div>
                              <button
                                className="flex items-center gap-1.5 cursor-pointer group"
                                onClick={() => setExpandedEmailId(isExpanded ? null : lead.id)}
                              >
                                <span className={`w-2 h-2 rounded-full shrink-0 ${
                                  vr.status === 'valid' ? 'bg-emerald-400' :
                                  vr.status === 'risky' ? 'bg-amber-400' : 'bg-red-400'
                                }`} />
                                <span className={`text-xs capitalize ${
                                  vr.status === 'valid' ? 'text-emerald-400' :
                                  vr.status === 'risky' ? 'text-amber-400' : 'text-red-400'
                                }`}>{vr.status}</span>
                                <span className="text-xs text-zinc-500 tabular-nums ml-1">{vr.score}</span>
                                <ChevronDown className={`w-3 h-3 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                              </button>
                              {isExpanded && <InlineVerifyExpansion result={vr} />}
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <span className={`w-2 h-2 rounded-full ${health.dot}`} />
                              <span className={`text-xs capitalize ${health.text}`}>{lead.emailHealth || 'unknown'}</span>
                            </div>
                          )}
                        </TableCell>

                        {/* Score */}
                        <TableCell className="text-right hidden sm:table-cell">
                          <span className={`text-sm font-medium tabular-nums ${scoreColor(lead.score)}`}>
                            {lead.score ?? '—'}
                          </span>
                        </TableCell>

                        {/* Actions */}
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {lead.email && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs text-emerald-400 hover:text-emerald-300"
                                disabled={verifying === lead.id}
                                onClick={() => handleVerifyEmail(lead)}
                                title="Verify email"
                              >
                                {verifying === lead.id ? (
                                  <div className="w-3.5 h-3.5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                                ) : (
                                  <ShieldCheck className="w-3.5 h-3.5" />
                                )}
                              </Button>
                            )}
                            {canGenerate && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs text-primary hover:text-primary/80"
                                disabled={generating === lead.id}
                                onClick={() => handleGenerateDraft(lead)}
                              >
                                {generating === lead.id ? (
                                  <div className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                                ) : (
                                  <><Sparkles className="w-3.5 h-3.5 mr-1" />Draft</>
                                )}
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs text-muted-foreground hover:text-foreground"
                              onClick={() => openDetail(lead)}
                              title="View details"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {sortedLeads.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={9} className="text-muted-foreground text-sm text-center py-8">
                        No leads match your filters.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Page {page} of {totalPages}
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0 border-border"
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
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
                <Button
                  key={pageNum}
                  variant={pageNum === page ? 'default' : 'outline'}
                  size="sm"
                  className={`h-8 w-8 p-0 text-xs ${pageNum === page ? 'bg-primary text-primary-foreground' : 'border-border'}`}
                  onClick={() => setPage(pageNum)}
                >
                  {pageNum}
                </Button>
              );
            })}
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0 border-border"
              disabled={page >= totalPages}
              onClick={() => setPage(p => p + 1)}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ══════════════════════ Lead Detail Dialog ══════════════════════ */}
      <Dialog open={!!detailLead} onOpenChange={(open) => { if (!open) setDetailLead(null); }}>
        {detailLead && (
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0">
            <div className="p-6 pb-4">
              <DialogHeader>
                <DialogTitle className="text-xl">{detailLead.name}</DialogTitle>
                <DialogDescription className="text-sm">
                  {detailLead.jobTitle || detailLead.role ? `${[detailLead.jobTitle, detailLead.role].filter(Boolean).join(' · ')}` : 'Lead details'}
                </DialogDescription>
              </DialogHeader>
            </div>

            <ScrollArea className="flex-1">
              <div className="px-6 pb-6 space-y-6">

                {/* ── Contact Info ── */}
                <section>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Contact Information</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-muted/30">
                      <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Email</p>
                        <p className="text-sm text-foreground truncate">{detailLead.email || '—'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-muted/30">
                      <Phone className="w-4 h-4 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Phone</p>
                        <p className="text-sm text-foreground truncate">{detailLead.phone || '—'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-muted/30">
                      <MapPin className="w-4 h-4 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Location</p>
                        <p className="text-sm text-foreground truncate">{detailLead.location || '—'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-muted/30">
                      <Briefcase className="w-4 h-4 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Title / Role</p>
                        <p className="text-sm text-foreground truncate">{detailLead.jobTitle || detailLead.role || '—'}</p>
                      </div>
                    </div>
                  </div>
                </section>

                <Separator />

                {/* ── Company ── */}
                <section>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Company</h4>
                  <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-muted/30">
                    <Building2 className="w-4 h-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground">{detailLead.company?.name || '—'}</p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        {detailLead.company?.domain && <span>{detailLead.company.domain}</span>}
                        {detailLead.company?.industry && <span>· {detailLead.company.industry}</span>}
                      </div>
                    </div>
                    {navigateTo && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs shrink-0"
                        onClick={() => { setDetailLead(null); navigateTo('companies'); }}
                      >
                        View Company
                      </Button>
                    )}
                  </div>
                </section>

                <Separator />

                {/* ── Email Health ── */}
                <section>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Email Health</h4>
                  {detailVerifyResult ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                        <div className="flex items-center gap-2">
                          <span className={`w-2.5 h-2.5 rounded-full ${
                            detailVerifyResult.status === 'valid' ? 'bg-emerald-400' :
                            detailVerifyResult.status === 'risky' ? 'bg-amber-400' : 'bg-red-400'
                          }`} />
                          <span className="text-sm font-medium capitalize">
                            {detailVerifyResult.status}
                          </span>
                        </div>
                        <div className={`text-lg font-bold tabular-nums ${scoreColor(detailVerifyResult.score)}`}>
                          {detailVerifyResult.score}
                          <span className="text-xs font-normal text-muted-foreground ml-0.5">/100</span>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {detailVerifyResult.checks && Object.entries(detailVerifyResult.checks).map(([key, val]) => (
                          <div key={key} className="flex items-center gap-2 p-2 rounded-md bg-muted/20">
                            {val ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                            ) : (
                              <XCircle className="w-4 h-4 text-red-400 shrink-0" />
                            )}
                            <span className="text-xs text-foreground">{CHECK_LABELS[key] || key}</span>
                          </div>
                        ))}
                      </div>
                      {detailVerifyResult.recommendation && (
                        <p className="text-xs text-muted-foreground leading-relaxed p-2.5 rounded-md bg-muted/20">
                          <span className="font-medium text-foreground">Recommendation: </span>
                          {detailVerifyResult.recommendation}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                      <div className="flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${HEALTH_STYLES[detailLead.emailHealth || 'unknown'].dot}`} />
                        <span className={`text-sm capitalize ${HEALTH_STYLES[detailLead.emailHealth || 'unknown'].text}`}>
                          {detailLead.emailHealth || 'unknown'}
                        </span>
                      </div>
                      {detailLead.email && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs gap-1.5 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                          disabled={detailVerifying}
                          onClick={handleDetailVerify}
                        >
                          {detailVerifying ? (
                            <div className="w-3.5 h-3.5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <><ShieldCheck className="w-3.5 h-3.5" />Verify Email</>
                          )}
                        </Button>
                      )}
                    </div>
                  )}
                </section>

                <Separator />

                {/* ── Status ── */}
                <section>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Status</h4>
                  <Select value={detailStatus} onValueChange={handleDetailStatusChange}>
                    <SelectTrigger className="h-9 text-sm bg-background border-border w-full sm:w-64">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_FLOW.map(s => (
                        <SelectItem key={s} value={s} className="capitalize">
                          {s.replace(/_/g, ' ')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </section>

                <Separator />

                {/* ── Lead Score ── */}
                <section>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Lead Score</h4>
                  <div className="flex items-center gap-4">
                    <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${scoreBgColor(detailLead.score)}`}>
                      <span className={`text-xl font-bold tabular-nums ${scoreColor(detailLead.score)}`}>
                        {detailLead.score ?? 0}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground leading-relaxed">
                      {detailLead.score == null || detailLead.score === 0 ? (
                        <p>Score not yet calculated. Verify the email and clean the lead to generate a score.</p>
                      ) : detailLead.score >= 85 ? (
                        <p><span className="text-emerald-400 font-medium">High quality lead.</span> Strong email health, valid data, and good engagement signals.</p>
                      ) : detailLead.score >= 70 ? (
                        <p><span className="text-amber-400 font-medium">Moderate quality.</span> Some concerns detected. Review email health and data completeness.</p>
                      ) : detailLead.score >= 50 ? (
                        <p><span className="text-amber-400 font-medium">Low quality.</span> Multiple risk factors. Consider verifying data before outreach.</p>
                      ) : (
                        <p><span className="text-red-400 font-medium">Very low quality.</span> High risk of bounce or invalid data. Consider suppressing.</p>
                      )}
                    </div>
                  </div>
                </section>

                <Separator />

                {/* ── Activity Timeline ── */}
                {buildTimeline(detailLead).length > 0 && (
                  <section>
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Activity Timeline</h4>
                    <div className="relative space-y-0">
                      {buildTimeline(detailLead).map((item, i, arr) => (
                        <div key={i} className="flex gap-3">
                          {/* Timeline line */}
                          <div className="flex flex-col items-center">
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center ${item.color} bg-muted/50 shrink-0`}>
                              {item.icon}
                            </div>
                            {i < arr.length - 1 && (
                              <div className="w-px flex-1 bg-border my-1" />
                            )}
                          </div>
                          {/* Content */}
                          <div className="pb-4 min-w-0">
                            <p className="text-sm text-foreground">{item.label}</p>
                            {item.date && (
                              <p className="text-xs text-muted-foreground">{formatDate(item.date)}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}
              </div>
            </ScrollArea>

            {/* ── Dialog Footer Actions ── */}
            <div className="p-4 border-t border-border bg-muted/20 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1.5 border-primary/30 text-primary hover:bg-primary/10"
                disabled={generating === detailLead.id || (detailLead.status !== 'cleaned' && detailLead.status !== 'pending_review')}
                onClick={handleDetailGenerateDraft}
              >
                {generating === detailLead.id ? (
                  <div className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                ) : (
                  <><Sparkles className="w-3.5 h-3.5" />Generate AI Draft</>
                )}
              </Button>
              {navigateTo && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs gap-1.5 border-border"
                  onClick={() => { setDetailLead(null); navigateTo('companies'); }}
                >
                  <Building2 className="w-3.5 h-3.5" />View Company
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1.5 border-red-500/30 text-red-400 hover:bg-red-500/10"
                disabled={detailLead.isSuppressed || detailSuppressing}
                onClick={handleDetailSuppress}
              >
                {detailSuppressing ? (
                  <div className="w-3.5 h-3.5 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <><Ban className="w-3.5 h-3.5" />Add to Suppression</>
                )}
              </Button>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}