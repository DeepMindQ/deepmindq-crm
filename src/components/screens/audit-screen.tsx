'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import {
  PageTransition,
  StaggerGrid,
  StaggerItem,
  SectionHeader,
  TabBar,
  StatCard,
  GlassPanel,
  EmptyState,
} from '@/components/ui/animated-components';
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
  BarChart3,
  Hash,
  Layers,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────

interface AuditEntry {
  id: string;
  timestamp: string;
  userId: string;
  action: string;
  entityType: string;
  entityName: string;
  details: string;
}

// ── Action color map ───────────────────────────────────────────────────────

const ACTION_COLORS: Record<string, string> = {
  create:  'bg-emerald-500/15 text-emerald-700 border-emerald-500/30',
  update:  'bg-blue-500/15 text-blue-700 border-blue-500/30',
  delete:  'bg-red-500/15 text-red-600 border-red-500/30',
  approve: 'bg-green-500/15 text-green-300 border-green-500/30',
  reject:  'bg-amber-500/15 text-amber-700 border-amber-500/30',
  send:    'bg-purple-500/15 text-purple-700 border-purple-500/30',
  import:  'bg-blue-500/15 text-blue-700 border-blue-500/30',
  verify:  'bg-cyan-500/15 text-cyan-700 border-cyan-500/30',
};

// ── Action accent hex colors (for left border bar) ─────────────────────────

const ACTION_ACCENT_HEX: Record<string, string> = {
  create:  '#059669',
  update:  '#2563EB',
  delete:  '#DC2626',
  approve: '#16A34A',
  reject:  '#D97706',
  send:    '#9333EA',
  import:  '#0284C7',
  verify:  '#22d3ee',
};

// ── Action accent colors (for StatCard) ────────────────────────────────────

const ACTION_ACCENT_COLORS: Record<string, string> = {
  create:  '#059669',
  update:  '#2563EB',
  delete:  '#DC2626',
  approve: '#16A34A',
  reject:  '#D97706',
  send:    '#9333EA',
  import:  '#0284C7',
  verify:  '#22d3ee',
};

// ── Entity icon map ────────────────────────────────────────────────────────

const ENTITY_ICONS: Record<string, string> = {
  Contact:      '\u{1F464}',
  Company:      '\u{1F3E2}',
  Draft:        '\u{1F4DD}',
  SendQueue:    '\u{1F4E4}',
  ImportBatch:  '\u{1F4E6}',
  Suppression:  '\u{1F6AB}',
  Capability:   '\u2699\uFE0F',
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
          setData([]);
        }
      })
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, []);

  // ── Derived: filtered data ─────────────────────────────────────────────
  const filtered = useMemo(() => {
    if (!data) return [];
    let result = [...data];

    if (entityFilter !== 'All') {
      result = result.filter(e => e.entityType === entityFilter);
    }

    const now = Date.now();
    if (dateRange === '7d') {
      result = result.filter(e => now - new Date(e.timestamp).getTime() <= 7 * 86400_000);
    } else if (dateRange === '30d') {
      result = result.filter(e => now - new Date(e.timestamp).getTime() <= 30 * 86400_000);
    }

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

  // ── Derived: stats ─────────────────────────────────────────────────────
  const stats = useMemo(() => {
    if (!data) return { total: 0, topAction: 'N/A', topActionColor: '#D4AF37', uniqueEntities: 0 };

    const total = data.length;

    const actionCounts: Record<string, number> = {};
    data.forEach(e => { actionCounts[e.action] = (actionCounts[e.action] || 0) + 1; });
    const topAction = Object.entries(actionCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';
    const topActionColor = ACTION_ACCENT_COLORS[topAction] || '#D4AF37';

    const entitySet = new Set(data.map(e => e.entityType));

    return { total, topAction, topActionColor, uniqueEntities: entitySet.size };
  }, [data]);

  // ── Derived: paginated data ────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const safePage   = Math.min(page, totalPages);
  const paged      = filtered.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE);

  useEffect(() => { setPage(1); }, [search, entityFilter, dateRange]);

  const toggleRow = useCallback((id: string) => {
    setExpandedRow(prev => prev === id ? null : id);
  }, []);

  const handleExport = useCallback(() => {
    if (!data || data.length === 0) {
      toast.error('No data to export');
      return;
    }
    const exportData = filtered.length > 0 ? filtered : data;
    const headers = ['Timestamp', 'User', 'Action', 'Entity Type', 'Entity Name', 'Details'];
    const rows = exportData.map(e => [
      new Date(e.timestamp).toISOString(),
      e.userId,
      e.action,
      e.entityType,
      e.entityName,
      (e.details ?? '').replace(/"/g, '""'),
    ]);
    const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${exportData.length} entries`);
  }, [data, filtered]);

  // ── Loading skeleton ───────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-20 rounded-xl" />
        <div className="grid grid-cols-3 gap-4">
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
        </div>
        <Skeleton className="h-[500px] rounded-xl" />
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <PageTransition>
      <div className="max-h-[calc(100vh-200px)] overflow-y-auto space-y-8 pr-1 pb-4">

        {/* ── Page Header ───────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 pt-2">
          <div className="flex items-center gap-4">
            <SectionHeader
              title="Audit Log"
              subtitle="Track every action across your workspace"
              className="!mb-0"
            />
            {data && (
              <Badge
                variant="outline"
                className="text-xs font-normal text-muted-foreground mt-1 border-primary/20 bg-primary/5"
              >
                {filtered.length} {filtered.length === 1 ? 'entry' : 'entries'}
              </Badge>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-fit text-muted-foreground hover:text-foreground border-border hover:border-primary/30 hover:bg-primary/5 transition-all duration-300"
            onClick={handleExport}
          >
            <Download className="h-3.5 w-3.5 mr-1.5" />
            Export CSV
          </Button>
        </div>

        {/* ── Stat Cards ────────────────────────────────────────────────── */}
        <StaggerGrid className="grid grid-cols-1 sm:grid-cols-3 gap-4" stagger={0.1}>
          <StaggerItem>
            <StatCard
              label="Total Actions"
              value={stats.total}
              icon={BarChart3}
              color="#D4AF37"
              delay={0}
            />
          </StaggerItem>
          <StaggerItem>
            <StatCard
              label="Most Common Action"
              value={stats.topAction.toUpperCase()}
              icon={Activity}
              color={stats.topActionColor}
              delay={0.1}
            />
          </StaggerItem>
          <StaggerItem>
            <StatCard
              label="Unique Entities"
              value={stats.uniqueEntities}
              icon={Layers}
              color="#818cf8"
              delay={0.2}
            />
          </StaggerItem>
        </StaggerGrid>

        {/* ── Search & Filter Bar (GlassPanel) ──────────────────────────── */}
        <GlassPanel className="overflow-hidden">
          <div className="p-5 space-y-4">
            {/* Row 1: Search + Entity filter */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search actions, entities, details..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-10 h-10 bg-gray-100/50 border-gray-200 text-foreground placeholder:text-muted-foreground/60 focus:border-primary/40 focus:ring-primary/10 transition-all duration-200"
                />
              </div>
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
                <Select value={entityFilter} onValueChange={setEntityFilter}>
                  <SelectTrigger className="w-[180px] h-10 bg-gray-100/50 border-gray-200 text-foreground focus:border-primary/40 transition-all duration-200">
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
            <TabBar tabs={[...DATE_TABS]} active={dateRange} onChange={setDateRange} />
          </div>
        </GlassPanel>

        {/* ── Audit Table (GlassPanel) ──────────────────────────────────── */}
        <GlassPanel className="overflow-hidden">
          {filtered.length === 0 ? (
            <EmptyState
              icon={Activity}
              title="No matching audit entries"
              description="Try adjusting your search query or filters to find what you are looking for."
            />
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-gray-200 hover:bg-transparent">
                      <TableHead className="text-muted-foreground text-xs font-medium w-[140px] h-11">
                        <Clock className="inline h-3 w-3 mr-1.5 opacity-60" />
                        Timestamp
                      </TableHead>
                      <TableHead className="text-muted-foreground text-xs font-medium w-[120px] h-11">
                        <User className="inline h-3 w-3 mr-1.5 opacity-60" />
                        User
                      </TableHead>
                      <TableHead className="text-muted-foreground text-xs font-medium w-[100px] h-11">
                        Action
                      </TableHead>
                      <TableHead className="text-muted-foreground text-xs font-medium w-[190px] h-11">
                        <FileText className="inline h-3 w-3 mr-1.5 opacity-60" />
                        Entity
                      </TableHead>
                      <TableHead className="text-muted-foreground text-xs font-medium h-11">
                        Details
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paged.map((entry, idx) => {
                      const isExpanded = expandedRow === entry.id;
                      const actionColor = ACTION_COLORS[entry.action] || 'bg-zinc-500/15 text-zinc-600 border-zinc-500/30';
                      const accentHex = ACTION_ACCENT_HEX[entry.action] || '#52525B';
                      const entityIcon  = ENTITY_ICONS[entry.entityType] || '\u{1F4CB}';
                      const isLong      = entry.details.length > 80;

                      return (
                        <motion.tr
                          key={entry.id}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.3, delay: idx * 0.04 }}
                          className="group border-b border-gray-200 hover:bg-gray-50 cursor-pointer transition-colors duration-200"
                          style={{ borderLeftWidth: '3px', borderLeftStyle: 'solid', borderLeftColor: 'transparent' }}
                          whileHover={{ borderLeftColor: accentHex }}
                          onClick={() => isLong && toggleRow(entry.id)}
                        >
                          {/* Timestamp */}
                          <TableCell className="text-muted-foreground text-xs whitespace-nowrap py-3.5">
                            <div className="flex items-center gap-1.5">
                              <Hash className="h-3 w-3 opacity-30" />
                              {relativeTime(entry.timestamp)}
                            </div>
                          </TableCell>

                          {/* User */}
                          <TableCell className="text-foreground text-xs font-medium py-3.5">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary/70 shrink-0">
                                {entry.userId.split(' ').map(n => n[0]).join('').slice(0, 2)}
                              </div>
                              <span className="truncate">{entry.userId}</span>
                            </div>
                          </TableCell>

                          {/* Action */}
                          <TableCell className="py-3.5">
                            <Badge
                              variant="outline"
                              className={`text-[10px] font-semibold uppercase tracking-wider transition-all duration-200 ${actionColor}`}
                            >
                              {entry.action}
                            </Badge>
                          </TableCell>

                          {/* Entity */}
                          <TableCell className="py-3.5">
                            <div className="flex items-center gap-2">
                              <span className="text-sm shrink-0">{entityIcon}</span>
                              <div className="min-w-0">
                                <div className="text-[10px] text-muted-foreground/60 uppercase tracking-wider leading-none mb-0.5">
                                  {entry.entityType}
                                </div>
                                <div className="text-xs text-foreground font-medium truncate">
                                  {entry.entityName}
                                </div>
                              </div>
                            </div>
                          </TableCell>

                          {/* Details */}
                          <TableCell className="py-3.5 max-w-[360px]">
                            <p className={`text-xs text-muted-foreground/80 leading-relaxed ${isLong && isExpanded ? '' : 'line-clamp-2'}`}>
                              {entry.details}
                            </p>
                            {isLong && (
                              <button
                                className="text-[10px] text-primary hover:text-primary/80 hover:underline mt-1 font-medium transition-colors duration-150"
                                onClick={e => { e.stopPropagation(); toggleRow(entry.id); }}
                              >
                                {isExpanded ? 'Show less' : 'Show more'}
                              </button>
                            )}
                          </TableCell>
                        </motion.tr>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* ── Pagination ────────────────────────────────────────── */}
              <div className="flex items-center justify-between px-5 py-4 border-t border-gray-200">
                <p className="text-xs text-muted-foreground/60">
                  Showing {(safePage - 1) * ITEMS_PER_PAGE + 1}-{Math.min(safePage * ITEMS_PER_PAGE, filtered.length)} of {filtered.length}
                </p>
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 w-8 p-0 border-gray-200 text-muted-foreground hover:text-foreground hover:border-gray-300 transition-all duration-200"
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
                      className={`h-8 w-8 p-0 text-xs font-medium transition-all duration-200 ${
                        p === safePage
                          ? 'bg-gradient-to-br from-yellow-500/90 to-amber-600/90 text-black shadow-lg shadow-amber-500/20 hover:from-yellow-500 hover:to-amber-600 border-0'
                          : 'border-gray-200 text-muted-foreground hover:text-foreground hover:border-gray-300 hover:bg-gray-100/50'
                      }`}
                      onClick={() => setPage(p)}
                    >
                      {p}
                    </Button>
                  ))}

                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 w-8 p-0 border-gray-200 text-muted-foreground hover:text-foreground hover:border-gray-300 transition-all duration-200"
                    disabled={safePage >= totalPages}
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </GlassPanel>

      </div>
    </PageTransition>
  );
}