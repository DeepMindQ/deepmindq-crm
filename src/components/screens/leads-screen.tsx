'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users, Search, Sparkles, Eye, ChevronLeft, ChevronRight, ShieldCheck, MailCheck } from 'lucide-react';

interface Company { id: string; name: string; domain?: string; industry?: string; }
interface Lead {
  id: string;
  name: string;
  email?: string;
  jobTitle?: string;
  status: string;
  emailHealth?: string;
  score?: number;
  company?: Company;
}

const PAGE_SIZE = 20;

const STATUS_COLORS: Record<string, string> = {
  imported: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30',
  cleaned: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  drafted: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  'pending_review': 'bg-amber-500/20 text-amber-300 border-amber-500/30',
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

export default function LeadsScreen() {
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
  const [verifyResult, setVerifyResult] = useState<Record<string, any>>({});
  const [refreshKey, setRefreshKey] = useState(0);

  // Fetch leads when filters/page/refreshKey change
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
        setLeads(raw.map((l: any) => ({ ...l, name: l.rawName || l.name, jobTitle: l.title || l.jobTitle, score: l.leadScore ?? l.score, company: l.company ? { ...l.company, name: l.company.rawName || l.company.name } : undefined })));
        setTotalCount(Array.isArray(data) ? data.length : data.total || 0);
      })
      .catch(() => {})
      .finally(() => { setLoading(false); });
  }, [search, statusFilter, companyFilter, page, refreshKey]);

  // Fetch companies once on mount
  useEffect(() => {
    fetch('/api/companies')
      .then(r => r.json())
      .then(data => {
        const list = Array.isArray(data) ? data : data.companies || [];
        setCompanies(list.map((c: any) => ({ id: c.id, name: c.rawName || c.name })));
      })
      .catch(() => {});
  }, []);

  const handleSearchChange = (val: string) => {
    setSearch(val);
    setPage(1);
  };

  const handleStatusChange = (val: string) => {
    setStatusFilter(val);
    setPage(1);
  };

  const handleCompanyChange = (val: string) => {
    setCompanyFilter(val);
    setPage(1);
  };

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
        const map: Record<string, any> = {};
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
    } catch { /* ignore */ }
    setGenerating(null);
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

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
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-muted-foreground text-xs">Name</TableHead>
                    <TableHead className="text-muted-foreground text-xs">Email</TableHead>
                    <TableHead className="text-muted-foreground text-xs">Company</TableHead>
                    <TableHead className="text-muted-foreground text-xs hidden lg:table-cell">Title / Role</TableHead>
                    <TableHead className="text-muted-foreground text-xs">Status</TableHead>
                    <TableHead className="text-muted-foreground text-xs hidden md:table-cell">Email Health</TableHead>
                    <TableHead className="text-muted-foreground text-xs text-right hidden sm:table-cell">Score</TableHead>
                    <TableHead className="text-muted-foreground text-xs text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leads.map(lead => {
                    const health = HEALTH_STYLES[lead.emailHealth || 'unknown'] || HEALTH_STYLES.unknown;
                    const canGenerate = lead.status === 'cleaned' || lead.status === 'pending_review';
                    return (
                      <TableRow key={lead.id} className="border-border">
                        <TableCell className="text-foreground text-sm font-medium">{lead.name}</TableCell>
                        <TableCell className="text-muted-foreground text-sm max-w-[180px] truncate">{lead.email || '—'}</TableCell>
                        <TableCell className="text-foreground text-sm">{lead.company?.name || '—'}</TableCell>
                        <TableCell className="text-muted-foreground text-sm hidden lg:table-cell max-w-[200px] truncate">{lead.jobTitle || '—'}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={STATUS_COLORS[lead.status] || STATUS_COLORS.imported}>
                            {lead.status.replace(/_/g, ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          {verifyResult[lead.id] ? (
                            <div className="space-y-1">
                              <div className="flex items-center gap-1.5">
                                <span className={`w-2 h-2 rounded-full ${
                                  verifyResult[lead.id].status === 'valid' ? 'bg-emerald-400' :
                                  verifyResult[lead.id].status === 'risky' ? 'bg-amber-400' : 'bg-red-400'
                                }`} />
                                <span className={`text-xs capitalize ${
                                  verifyResult[lead.id].status === 'valid' ? 'text-emerald-400' :
                                  verifyResult[lead.id].status === 'risky' ? 'text-amber-400' : 'text-red-400'
                                }`}>{verifyResult[lead.id].status}</span>
                                <span className="text-xs text-zinc-500 tabular-nums ml-1">{verifyResult[lead.id].score}</span>
                              </div>
                              <p className="text-[10px] text-zinc-600 max-w-[160px] truncate">{verifyResult[lead.id].recommendation}</p>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <span className={`w-2 h-2 rounded-full ${health.dot}`} />
                              <span className={`text-xs capitalize ${health.text}`}>{lead.emailHealth || 'unknown'}</span>
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right hidden sm:table-cell">
                          <span className={`text-sm font-medium tabular-nums ${
                            !lead.score ? 'text-zinc-500' : lead.score >= 85 ? 'text-emerald-400' : lead.score >= 70 ? 'text-amber-400' : 'text-red-400'
                          }`}>
                            {lead.score ?? '—'}
                          </span>
                        </TableCell>
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
                            <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground hover:text-foreground">
                              <Eye className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {leads.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-muted-foreground text-sm text-center py-8">
                        No leads found.
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
    </div>
  );
}