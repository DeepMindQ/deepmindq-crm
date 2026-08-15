'use client';

import { useState, useMemo, useEffect } from 'react';
import { tokens } from '@/components/intelligence-os/design-tokens';
import { ScreenSkeleton } from '@/components/ui/screen-skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Database,
  Plus,
  RefreshCw,
  Search,
  Cloud,
  Upload,
  Cpu,
  Plug,
  AlertCircle,
} from 'lucide-react';
import { fetchApi } from '@/lib/fetchApi';
import { toast } from 'sonner';

interface SignalSource {
  id: string;
  name: string;
  type: string;
  status: string;
  lastSync: string;
  records: number;
  quality: number;
}

function getTypeIcon(type: string) {
  switch (type) {
    case 'crm':
      return <Database className="size-4" style={{ color: tokens.accent.primary }} />;
    case 'upload':
      return <Upload className="size-4" style={{ color: tokens.domain.value }} />;
    case 'external':
      return <Cloud className="size-4" style={{ color: tokens.confidence.high.value }} />;
    case 'ai':
      return <Cpu className="size-4" style={{ color: tokens.gold.dark }} />;
    default:
      return <Database className="size-4" />;
  }
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'active':
      return (
        <Badge
          style={{
            backgroundColor: tokens.confidence.high.bg,
            color: tokens.confidence.high.value,
            borderWidth: 1,
            borderColor: tokens.confidence.high.border,
          }}
        >
          Active
        </Badge>
      );
    case 'disconnected':
      return (
        <Badge
          style={{
            backgroundColor: tokens.neutral['100'],
            color: tokens.text.secondary,
            borderWidth: 1,
            borderColor: tokens.border.default,
          }}
        >
          Disconnected
        </Badge>
      );
    case 'error':
      return (
        <Badge variant="destructive">
          <AlertCircle className="size-3 mr-1" />
          Error
        </Badge>
      );
    default:
      return <Badge variant="secondary">Unknown</Badge>;
  }
}

function getQualityBadge(quality: number) {
  if (quality === 0) return <span style={{ color: tokens.text.muted }}>N/A</span>;
  const color =
    quality >= 0.9
      ? tokens.confidence.high.value
      : quality >= 0.75
        ? tokens.confidence.medium.value
        : tokens.confidence.low.value;
  return (
    <span className="font-medium" style={{ color }}>
      {(quality * 100).toFixed(0)}%
    </span>
  );
}

export default function IntelligenceSources() {
  const [isLoading, setIsLoading] = useState(true);
  const [sources, setSources] = useState<SignalSource[]>([]);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [syncing, setSyncing] = useState<string | null>(null);
  const [connectOpen, setConnectOpen] = useState(false);
  const [newSourceName, setNewSourceName] = useState('');
  const [newSourceType, setNewSourceType] = useState('');

  useEffect(() => {
    async function loadSources() {
      setIsLoading(true);
      const { data, error } = await fetchApi<SignalSource[]>('/api/signals');
      if (error) {
        toast.error('Failed to load data sources', { description: error });
      } else if (Array.isArray(data)) {
        setSources(data);
      }
      setIsLoading(false);
    }
    loadSources();
  }, []);

  if (isLoading) return <ScreenSkeleton rows={8} className="p-6" />;

  const filtered = useMemo(() => {
    return sources.filter((s) => {
      if (typeFilter !== 'all' && s.type !== typeFilter) return false;
      if (search && !s.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [search, typeFilter]);

  const handleSync = (id: string) => {
    setSyncing(id);
    setTimeout(() => setSyncing(null), 2000);
  };

  const stats = useMemo(
    () => ({
      total: sources.length,
      active: sources.filter((s) => s.status === 'active').length,
      totalRecords: sources.reduce((a, b) => a + b.records, 0),
      avgQuality:
        sources.filter((s) => s.quality > 0).length > 0
          ? (
              (sources.filter((s) => s.quality > 0).reduce((a, b) => a + b.quality, 0) /
                sources.filter((s) => s.quality > 0).length) *
              100
            ).toFixed(1)
          : '0.0',
    }),
    [sources],
  );

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: tokens.text.primary }}>
            Data Sources
          </h1>
          <p className="text-sm mt-1" style={{ color: tokens.text.secondary }}>
            Manage and monitor intelligence data source connections
          </p>
        </div>
        <Button size="sm" onClick={() => setConnectOpen(true)}>
          <Plus className="size-4" />
          Connect Source
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: 'Total Sources',
            value: stats.total,
            icon: Plug,
            color: tokens.accent.primary,
            bg: tokens.accent.subtle,
          },
          {
            label: 'Active',
            value: stats.active,
            icon: Cloud,
            color: tokens.confidence.high.value,
            bg: tokens.confidence.high.bg,
          },
          {
            label: 'Total Records',
            value: stats.totalRecords.toLocaleString(),
            icon: Database,
            color: tokens.domain.value,
            bg: tokens.domain.bg,
          },
          {
            label: 'Avg Quality',
            value: `${stats.avgQuality}%`,
            icon: Cpu,
            color: tokens.gold.dark,
            bg: tokens.gold.bgMedium,
          },
        ].map((stat) => (
          <Card key={stat.label} className="gap-4 py-4">
            <CardContent className="flex items-center gap-4">
              <div
                className="size-10 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: stat.bg }}
              >
                <stat.icon className="size-5" style={{ color: stat.color }} />
              </div>
              <div>
                <p className="text-xs font-medium" style={{ color: tokens.text.secondary }}>
                  {stat.label}
                </p>
                <p className="text-2xl font-bold" style={{ color: tokens.text.primary }}>
                  {stat.value}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card className="gap-4 py-4">
        <CardContent className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="relative flex-1 w-full sm:max-w-xs">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 size-4"
              style={{ color: tokens.text.muted }}
            />
            <Input
              placeholder="Search sources..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-full sm:w-[150px]">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="crm">CRM</SelectItem>
              <SelectItem value="upload">Upload</SelectItem>
              <SelectItem value="external">External</SelectItem>
              <SelectItem value="ai">AI</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-xs" style={{ color: tokens.text.muted }}>
            {filtered.length} of {sources.length} sources
          </span>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="gap-0 py-0 overflow-hidden">
        <CardContent className="p-0 max-h-[480px] overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow style={{ backgroundColor: tokens.surface.secondary }}>
                <TableHead>Source Name</TableHead>
                <TableHead className="w-[90px]">Type</TableHead>
                <TableHead className="w-[110px]">Status</TableHead>
                <TableHead className="w-[150px]">Last Sync</TableHead>
                <TableHead className="w-[100px] text-right">Records</TableHead>
                <TableHead className="w-[90px] text-right">Quality</TableHead>
                <TableHead className="w-[80px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="h-32 text-center"
                    style={{ color: tokens.text.muted }}
                  >
                    No data sources match the current filters.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((source) => (
                  <TableRow key={source.id} className="hover:bg-muted/50 transition-colors">
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getTypeIcon(source.type)}
                        <span className="font-medium" style={{ color: tokens.text.primary }}>
                          {source.name}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span
                        className="uppercase text-[10px] font-bold"
                        style={{ color: tokens.text.secondary }}
                      >
                        {source.type}
                      </span>
                    </TableCell>
                    <TableCell>{getStatusBadge(source.status)}</TableCell>
                    <TableCell className="text-xs" style={{ color: tokens.text.secondary }}>
                      {source.lastSync}
                    </TableCell>
                    <TableCell
                      className="text-xs font-mono text-right"
                      style={{ color: tokens.text.primary }}
                    >
                      {source.records.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">{getQualityBadge(source.quality)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        onClick={() => handleSync(source.id)}
                        disabled={source.status === 'disconnected'}
                      >
                        <RefreshCw
                          className={`size-3.5 ${syncing === source.id ? 'animate-spin' : ''}`}
                        />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Connect Dialog */}
      <Dialog open={connectOpen} onOpenChange={setConnectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Connect New Data Source</DialogTitle>
            <DialogDescription>
              Add a new intelligence data source to the platform.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium" style={{ color: tokens.text.secondary }}>
                Source Name
              </span>
              <Input
                placeholder="e.g. Salesforce Production"
                value={newSourceName}
                onChange={(e) => setNewSourceName(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium" style={{ color: tokens.text.secondary }}>
                Source Type
              </span>
              <Select value={newSourceType} onValueChange={setNewSourceType}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="crm">CRM</SelectItem>
                  <SelectItem value="upload">File Upload</SelectItem>
                  <SelectItem value="external">External API</SelectItem>
                  <SelectItem value="ai">AI Pipeline</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConnectOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => setConnectOpen(false)}>Connect</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
