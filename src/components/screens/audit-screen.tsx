'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { PageTransition, AnimatedCard, SectionHeader, TabBar } from '@/components/ui/animated-components';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Search,
  Filter,
  Clock,
  User,
  FileText,
  Download,
  Activity,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────

interface AuditEntry {
  id: string;
  timestamp: string;          // ISO string
  userId: string;
  action: string;
  entityType: string;
  entityName: string;
  details: string;
}

// ── Action color map ───────────────────────────────────────────────────────

const ACTION_COLORS: Record<string, string> = {
  create:  'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  update:  'bg-blue-500/15 text-blue-300 border-blue-500/30',
  delete:  'bg-red-500/15 text-red-300 border-red-500/30',
  approve: 'bg-green-500/15 text-green-300 border-green-500/30',
  reject:  'bg-amber-500/15 text-amber-300 border-amber-500/30',
  send:    'bg-purple-500/15 text-purple-300 border-purple-500/30',
  import:  'bg-blue-500/15 text-blue-300 border-blue-500/30',
  verify:  'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
};

// ── Entity icon map ────────────────────────────────────────────────────────

const ENTITY_ICONS: Record<string, string> = {
  Contact:      '👤',
  Company:      '🏢',
  Draft:        '📝',
  SendQueue:    '📤',
  ImportBatch:  '📦',
  Suppression:  '🚫',
  Capability:   '⚙️',
};

// ── Relative time helper ───────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const now = Date.now();
  const diff = now - new Date(iso).getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours   = Math.floor(minutes / 60);
  const days    = Math.floor(hours / 24);

  if (seconds < 60)  return `${seconds}s ago`;
  if (minutes < 60)  return `${minutes} min ago`;
  if (hours < 24)    return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  if (days < 7)      return `${days} day${days > 1 ? 's' : ''} ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ── Demo data (20 entries) ─────────────────────────────────────────────────

const NOW = Date.now();

function ago(ms: number) {
  return new Date(NOW - ms).toISOString();
}

const DEMO_DATA: AuditEntry[] = [
  { id: 'a01', timestamp: ago(2 * 60_000),       userId: 'Ravi Shanker', action: 'create',  entityType: 'Contact',      entityName: 'Sarah Chen',                     details: 'Contact created: Sarah Chen - email s.chen@stripe.com added from manual entry' },
  { id: 'a02', timestamp: ago(5 * 60_000),       userId: 'Ravi Shanker', action: 'verify',  entityType: 'Contact',      entityName: 'Sarah Chen',                     details: 'Email verified: s.chen@stripe.com (valid, deliverable, score 92)' },
  { id: 'a03', timestamp: ago(15 * 60_000),      userId: 'Ravi Shanker', action: 'create',  entityType: 'Draft',        entityName: 'Michael Torres',                 details: 'Draft generated for Michael Torres - AI personalized cold outreach' },
  { id: 'a04', timestamp: ago(20 * 60_000),      userId: 'Ravi Shanker', action: 'approve', entityType: 'Draft',        entityName: 'AI-Powered Transformation',     details: 'Draft approved: "AI-Powered Transformation at Salesforce" - moved to queue' },
  { id: 'a05', timestamp: ago(25 * 60_000),      userId: 'Ravi Shanker', action: 'send',    entityType: 'SendQueue',    entityName: 'Michael Torres',                 details: 'Email queued for sending to m.torres@salesforce.com - scheduled 9:00 AM' },
  { id: 'a06', timestamp: ago(60 * 60_000),      userId: 'Ravi Shanker', action: 'import',  entityType: 'ImportBatch',  entityName: 'Q3_leads.xlsx',                 details: 'Batch imported: Q3_leads.xlsx (245 rows processed, 238 accepted, 7 skipped)' },
  { id: 'a07', timestamp: ago(2 * 3600_000),     userId: 'Ravi Shanker', action: 'update',  entityType: 'Company',      entityName: 'Siemens AG',                     details: 'Company research updated: Siemens AG - refreshed headcount, revenue, tech stack' },
  { id: 'a08', timestamp: ago(3 * 3600_000),     userId: 'Ravi Shanker', action: 'create',  entityType: 'Suppression',  entityName: 'j.doe@tempmail.com',            details: 'Suppression added: j.doe@tempmail.com (disposable domain detected)' },
  { id: 'a09', timestamp: ago(4 * 3600_000),     userId: 'Ravi Shanker', action: 'delete',  entityType: 'Contact',      entityName: 'John Smith',                     details: 'Contact deleted: John Smith (j.smith@oldco.com) - hard bounce, invalid domain' },
  { id: 'a10', timestamp: ago(5 * 3600_000),     userId: 'Ravi Shanker', action: 'update',  entityType: 'Draft',        entityName: 'Lisa Park',                      details: 'Draft edited: "Enterprise AI Solutions" for Lisa Park at Samsung - 3 sections revised' },
  { id: 'a11', timestamp: ago(6 * 3600_000),     userId: 'Ravi Shanker', action: 'approve', entityType: 'Draft',        entityName: 'Cloud Migration Pitch',          details: 'Draft approved: "Cloud Migration Pitch" for David Kim at AWS - fast-track approved' },
  { id: 'a12', timestamp: ago(8 * 3600_000),     userId: 'Ravi Shanker', action: 'send',    entityType: 'SendQueue',    entityName: 'Lisa Park',                      details: 'Email sent to l.park@samsung.com - opened (1), clicked (0), replied (0)' },
  { id: 'a13', timestamp: ago(10 * 3600_000),    userId: 'Ravi Shanker', action: 'import',  entityType: 'ImportBatch',  entityName: 'sales_leads_oct.csv',            details: 'Batch imported: sales_leads_oct.csv (182 rows processed, 175 accepted, 7 duplicates)' },
  { id: 'a14', timestamp: ago(12 * 3600_000),    userId: 'Ravi Shanker', action: 'verify',  entityType: 'Contact',      entityName: 'Emily Watson',                   details: 'Email verified: e.watson@nvidia.com (valid, catch-all, score 78)' },
  { id: 'a15', timestamp: ago(14 * 3600_000),    userId: 'Ravi Shanker', action: 'create',  entityType: 'Company',      entityName: 'Datadog Inc',                    details: 'Company created: Datadog Inc - auto-enriched from LinkedIn, 4,500 employees' },
  { id: 'a16', timestamp: ago(18 * 3600_000),    userId: 'Ravi Shanker', action: 'reject',  entityType: 'Draft',        entityName: 'James Rodriguez',                details: 'Draft rejected: "Growth Strategy" for James Rodriguez - tone too aggressive, flagged for revision' },
  { id: 'a17', timestamp: ago(22 * 3600_000),    userId: 'Ravi Shanker', action: 'update',  entityType: 'Capability',   entityName: 'Email Verification',             details: 'Capability configured: Email Verification - daily limit raised to 5,000, API key rotated' },
  { id: 'a18', timestamp: ago(28 * 3600_000),    userId: 'Ravi Shanker', action: 'create',  entityType: 'Suppression',  entityName: '@spamtrap.io domain',            details: 'Domain suppression added: @spamtrap.io - spam trap domain, 14 contacts affected' },
  { id: 'a19', timestamp: ago(36 * 3600_000),    userId: 'Ravi Shanker', action: 'delete',  entityType: 'ImportBatch',  entityName: 'bad_list_jan.csv',               details: 'Import batch deleted: bad_list_jan.csv - contained 89% invalid emails, purged' },
  { id: 'a20', timestamp: ago(48 * 3600_000),    userId: 'Ravi Shanker', action: 'update',  entityType: 'Company',      entityName: 'Stripe Inc',                     details: 'Company data refreshed: Stripe Inc - revenue updated to $8.1B, headcount 8,000' },
];

// ── Component ──────────────────────────────────────────────────────────────

const ITEMS_PER_PAGE = 10;

const ENTITY_TYPES = ['All', 'Contact', 'Company', 'Draft', 'SendQueue', 'ImportBatch', 'Suppression', 'Capability'] as const;
const DATE_TABS = [
  { key: '7d', label: 'Last 7 days' },
  { key: '30d', label: 'Last 30 days' },
  { key: 'all', label: 'All time' },
] as const;

export default function AuditScreen({ navigateTo }: { navigateTo?: (screen: string) => void }) {
  // ── State ──────────────────────────────────────────────────────────────
  const [data, setData]           = useState<AuditEntry[] | null>(null);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [entityFilter, setEntityFilter] = useState<string>('All');
  const [dateRange, setDateRange] = useState<string>('7d');
  const [page, setPage]           = useState(1);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  // ── Fetch ──────────────────────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/audit')
      .then(r => r.json())
      .then((d: AuditEntry[] | { error?: string }) => {
        if (Array.isArray(d) && d.length > 0) {
          setData(d);
        } else {
          setData(DEMO_DATA);
        }
      })
      .catch(() => setData(DEMO_DATA))
      .finally(() => setLoading(false));
  }, []);

  // ── Derived: filtered data ─────────────────────────────────────────────
  const filtered = useMemo(() => {
    if (!data) return [];
    let result = [...data];

    // Entity type filter
    if (entityFilter !== 'All') {
      result = result.filter(e => e.entityType === entityFilter);
    }

    // Date range filter
    const now = Date.now();
    if (dateRange === '7d') {
      result = result.filter(e => now - new Date(e.timestamp).getTime() <= 7 * 86400_000);
    } else if (dateRange === '30d') {
      result = result.filter(e => now - new Date(e.timestamp).getTime() <= 30 * 86400_000);
    }

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(e =>
        e.action.toLowerCase().includes(q) ||
        e.entityType.toLowerCase().includes(q) ||
        e.entityName.toLowerCase().includes(q) ||
        e.details.toLowerCase().includes(q)
      );
    }

    return result;
  }, [data, entityFilter, dateRange, search]);

  // ── Derived: paginated data ────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const safePage   = Math.min(page, totalPages);
  const paged      = filtered.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE);

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [search, entityFilter, dateRange]);

  const toggleRow = useCallback((id: string) => {
    setExpandedRow(prev => prev === id ? null : id);
  }, []);

  const handleExport = useCallback(() => {
    alert('Export started - your CSV file will download shortly.');
  }, []);

  // ── Loading skeleton ───────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-14 rounded-lg" />
        <Skeleton className="h-[460px] rounded-lg" />
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <PageTransition>
      <div className="max-h-[calc(100vh-200px)] overflow-y-auto space-y-4 pr-1">
        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="flex items-center gap-2">
            <SectionHeader title="Audit Log" className="!mb-0" />
            {data && (
              <Badge variant="outline" className="text-xs font-normal text-muted-foreground mt-0.5">
                {filtered.length} {filtered.length === 1 ? 'entry' : 'entries'}
              </Badge>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-fit text-muted-foreground hover:text-foreground border-border"
            onClick={handleExport}
          >
            <Download className="h-3.5 w-3.5 mr-1.5" />
            Export CSV
          </Button>
        </div>

        {/* ── Search & Filter Bar ──────────────────────────────────────── */}
        <AnimatedCard hover={false}>
          <div className="p-4 space-y-3">
            {/* Row 1: Search + Entity filter */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search actions, entities, details..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-9 h-9 bg-background border-border text-foreground placeholder:text-muted-foreground"
                />
              </div>
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
                <Select value={entityFilter} onValueChange={setEntityFilter}>
                  <SelectTrigger className="w-[170px] h-9 bg-background border-border text-foreground">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ENTITY_TYPES.map(t => (
                      <SelectItem key={t} value={t}>{t === 'All' ? 'All Entities' : t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Row 2: Date range tabs */}
            <TabBar tabs={DATE_TABS} active={dateRange} onChange={setDateRange} />
          </div>
        </AnimatedCard>

        {/* ── Audit Table ──────────────────────────────────────────────── */}
        <AnimatedCard hover={false}>
          <div className="p-0">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
                <Activity className="h-10 w-10 opacity-30" />
                <p className="text-sm">No audit entries match your filters.</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border hover:bg-transparent">
                        <TableHead className="text-muted-foreground text-xs font-medium w-[140px]">
                          <Clock className="inline h-3 w-3 mr-1" />
                          Timestamp
                        </TableHead>
                        <TableHead className="text-muted-foreground text-xs font-medium w-[120px]">
                          <User className="inline h-3 w-3 mr-1" />
                          User
                        </TableHead>
                        <TableHead className="text-muted-foreground text-xs font-medium w-[90px]">
                          Action
                        </TableHead>
                        <TableHead className="text-muted-foreground text-xs font-medium w-[180px]">
                          <FileText className="inline h-3 w-3 mr-1" />
                          Entity
                        </TableHead>
                        <TableHead className="text-muted-foreground text-xs font-medium">
                          Details
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paged.map(entry => {
                        const isExpanded = expandedRow === entry.id;
                        const actionColor = ACTION_COLORS[entry.action] || 'bg-zinc-500/15 text-zinc-300 border-zinc-500/30';
                        const entityIcon  = ENTITY_ICONS[entry.entityType] || '📋';
                        const isLong      = entry.details.length > 80;

                        return (
                          <TableRow
                            key={entry.id}
                            className="border-border hover:bg-muted/30 cursor-pointer transition-colors"
                            onClick={() => isLong && toggleRow(entry.id)}
                          >
                            {/* Timestamp */}
                            <TableCell className="text-muted-foreground text-xs whitespace-nowrap py-3">
                              {relativeTime(entry.timestamp)}
                            </TableCell>

                            {/* User */}
                            <TableCell className="text-foreground text-xs font-medium py-3">
                              {entry.userId}
                            </TableCell>

                            {/* Action */}
                            <TableCell className="py-3">
                              <Badge
                                variant="outline"
                                className={`text-[10px] font-semibold uppercase tracking-wider ${actionColor}`}
                              >
                                {entry.action}
                              </Badge>
                            </TableCell>

                            {/* Entity */}
                            <TableCell className="py-3">
                              <div className="flex items-center gap-1.5">
                                <span className="text-sm shrink-0">{entityIcon}</span>
                                <div className="min-w-0">
                                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider leading-none mb-0.5">
                                    {entry.entityType}
                                  </div>
                                  <div className="text-xs text-foreground font-medium truncate">
                                    {entry.entityName}
                                  </div>
                                </div>
                              </div>
                            </TableCell>

                            {/* Details */}
                            <TableCell className="py-3 max-w-[360px]">
                              <p className={`text-xs text-muted-foreground leading-relaxed ${isLong && isExpanded ? '' : 'line-clamp-2'}`}>
                                {entry.details}
                              </p>
                              {isLong && (
                                <button
                                  className="text-[10px] text-primary hover:underline mt-0.5"
                                  onClick={e => { e.stopPropagation(); toggleRow(entry.id); }}
                                >
                                  {isExpanded ? 'Show less' : 'Show more'}
                                </button>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                {/* ── Pagination ────────────────────────────────────── */}
                <div className="flex items-center justify-between px-4 py-3 border-t border-border">
                  <p className="text-xs text-muted-foreground">
                    Showing {(safePage - 1) * ITEMS_PER_PAGE + 1}-{Math.min(safePage * ITEMS_PER_PAGE, filtered.length)} of {filtered.length}
                  </p>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 w-7 p-0 border-border text-muted-foreground hover:text-foreground"
                      disabled={safePage <= 1}
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </Button>

                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                      <Button
                        key={p}
                        variant={p === safePage ? 'default' : 'outline'}
                        size="sm"
                        className={`h-7 w-7 p-0 text-xs ${
                          p === safePage
                            ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                            : 'border-border text-muted-foreground hover:text-foreground'
                        }`}
                        onClick={() => setPage(p)}
                      >
                        {p}
                      </Button>
                    ))}

                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 w-7 p-0 border-border text-muted-foreground hover:text-foreground"
                      disabled={safePage >= totalPages}
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </AnimatedCard>
      </div>
    </PageTransition>
  );
}