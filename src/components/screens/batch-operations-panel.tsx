'use client';

import { useState } from 'react';
import { tokens } from '@/components/intelligence-os/design-tokens';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import {
  Zap,
  Database,
  Download,
  Trash2,
  Play,
  CheckCircle2,
  Clock,
  Loader2,
  AlertTriangle,
  History,
} from 'lucide-react';

const OPERATION_TYPES = [
  { value: 'enrich', label: 'Enrich', icon: Zap, color: '#38bdf8', bg: 'rgba(56,189,248,0.12)' },
  {
    value: 'score',
    label: 'Score',
    icon: Database,
    color: '#a78bfa',
    bg: 'rgba(167,139,250,0.12)',
  },
  {
    value: 'export',
    label: 'Export',
    icon: Download,
    color: '#34d399',
    bg: 'rgba(52,211,153,0.12)',
  },
  {
    value: 'delete',
    label: 'Delete',
    icon: Trash2,
    color: '#f87171',
    bg: 'rgba(248,113,113,0.12)',
  },
];

const ENTITY_TYPES = ['Company', 'Contact', 'Opportunity'];

const mockPreview = [
  { name: 'Acme Corp', type: 'Company', field: 'industry', current: '—', new: 'SaaS' },
  { name: 'Vertex Solutions', type: 'Company', field: 'revenue', current: '$45M', new: '$52M' },
  { name: 'NovaTech AI', type: 'Company', field: 'employees', current: '240', new: '285' },
  { name: 'Jane Doe', type: 'Contact', field: 'title', current: 'VP Sales', new: 'CRO' },
  {
    name: 'Mark Smith',
    type: 'Contact',
    field: 'email',
    current: 'mark@v...',
    new: 'mark.smith@v...',
  },
];

const mockHistory = [
  {
    id: 'BATCH-001',
    op: 'Enrich',
    entity: 'Company',
    scope: 'All',
    status: 'completed',
    count: 142,
    time: '2h ago',
  },
  {
    id: 'BATCH-002',
    op: 'Score',
    entity: 'Company',
    scope: 'Filtered',
    status: 'completed',
    count: 38,
    time: '5h ago',
  },
  {
    id: 'BATCH-003',
    op: 'Export',
    entity: 'Contact',
    scope: 'Selected',
    status: 'completed',
    count: 56,
    time: '1d ago',
  },
  {
    id: 'BATCH-004',
    op: 'Enrich',
    entity: 'Opportunity',
    scope: 'All',
    status: 'failed',
    count: 0,
    time: '2d ago',
  },
  {
    id: 'BATCH-005',
    op: 'Delete',
    entity: 'Company',
    scope: 'Selected',
    status: 'completed',
    count: 3,
    time: '3d ago',
  },
];

function HistoryStatusBadge({ status }: { status: string }) {
  if (status === 'completed')
    return (
      <Badge className="border-emerald-500/40 bg-emerald-500/15 text-emerald-400 gap-1">
        <CheckCircle2 className="size-3" /> completed
      </Badge>
    );
  if (status === 'running')
    return (
      <Badge className="border-sky-500/40 bg-sky-500/15 text-sky-400 gap-1">
        <Loader2 className="size-3 animate-spin" /> running
      </Badge>
    );
  if (status === 'failed')
    return (
      <Badge className="border-red-500/40 bg-red-500/15 text-red-400 gap-1">
        <AlertTriangle className="size-3" /> failed
      </Badge>
    );
  return (
    <Badge className="border-amber-500/40 bg-amber-500/15 text-amber-400 gap-1">
      <Clock className="size-3" /> queued
    </Badge>
  );
}

export function BatchOperationsPanel() {
  const [loading] = useState(false);
  const [operationType, setOperationType] = useState('enrich');
  const [entityType, setEntityType] = useState('Company');
  const [scope, setScope] = useState('all');
  const [executing, setExecuting] = useState(false);

  const selectedOp = OPERATION_TYPES.find((o) => o.value === operationType);

  const handleExecute = () => {
    setExecuting(true);
    setTimeout(() => setExecuting(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: tokens.text.primary }}>
          Batch Operations
        </h1>
        <p className="text-sm mt-1" style={{ color: tokens.text.secondary }}>
          Execute bulk operations on your data entities
        </p>
      </div>

      {/* Operation Config */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Operation Type */}
        <Card className="py-0 gap-0">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Operation Type</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-2">
            {OPERATION_TYPES.map((op) => (
              <button
                key={op.value}
                onClick={() => setOperationType(op.value)}
                className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors text-left ${
                  operationType === op.value
                    ? 'border-primary/50 bg-primary/10'
                    : 'hover:bg-muted/50'
                }`}
                style={operationType === op.value ? {} : { borderColor: tokens.border.default }}
              >
                <div className="rounded-lg p-2" style={{ backgroundColor: op.bg }}>
                  <op.icon className="size-4" style={{ color: op.color }} />
                </div>
                <span className="text-sm font-medium" style={{ color: tokens.text.primary }}>
                  {op.label}
                </span>
              </button>
            ))}
          </CardContent>
        </Card>

        {/* Entity & Scope */}
        <Card className="py-0 gap-0">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Target</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-4">
            <div className="space-y-2">
              <Label className="text-xs" style={{ color: tokens.text.muted }}>
                Entity Type
              </Label>
              <Select value={entityType} onValueChange={setEntityType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ENTITY_TYPES.map((e) => (
                    <SelectItem key={e} value={e}>
                      {e}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs" style={{ color: tokens.text.muted }}>
                Scope
              </Label>
              <RadioGroup value={scope} onValueChange={setScope} className="space-y-2">
                {['all', 'selected', 'filtered'].map((s) => (
                  <div key={s} className="flex items-center gap-2">
                    <RadioGroupItem value={s} id={`scope-${s}`} />
                    <Label
                      htmlFor={`scope-${s}`}
                      className="text-sm capitalize"
                      style={{ color: tokens.text.primary }}
                    >
                      {s}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
          </CardContent>
        </Card>

        {/* Execute */}
        <Card className="py-0 gap-0">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Execute</CardTitle>
            <CardDescription>Review and confirm</CardDescription>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-4">
            <div
              className="rounded-lg border p-3 space-y-2"
              style={{
                borderColor: tokens.border.default,
                backgroundColor: tokens.surface.secondary,
              }}
            >
              <div className="flex justify-between text-xs">
                <span style={{ color: tokens.text.muted }}>Operation</span>
                <span className="font-medium capitalize" style={{ color: tokens.text.primary }}>
                  {operationType}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span style={{ color: tokens.text.muted }}>Entity</span>
                <span className="font-medium" style={{ color: tokens.text.primary }}>
                  {entityType}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span style={{ color: tokens.text.muted }}>Scope</span>
                <span className="font-medium capitalize" style={{ color: tokens.text.primary }}>
                  {scope}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span style={{ color: tokens.text.muted }}>Affected</span>
                <span className="font-medium" style={{ color: tokens.text.primary }}>
                  {mockPreview.length} records
                </span>
              </div>
            </div>
            <Button className="w-full gap-2" onClick={handleExecute} disabled={executing}>
              {executing ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Play className="size-4" />
              )}
              {executing ? 'Executing...' : 'Confirm & Execute'}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Preview Table */}
      <Card className="py-0 gap-0">
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            {selectedOp && (
              <selectedOp.icon className="size-4" style={{ color: selectedOp.color }} />
            )}
            Preview — {entityType} {operationType}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          <div className="max-h-[260px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Field</TableHead>
                  <TableHead>Current</TableHead>
                  <TableHead className="pr-6">New Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockPreview.map((row, i) => (
                  <TableRow key={i}>
                    <TableCell
                      className="pl-6 text-sm font-medium"
                      style={{ color: tokens.text.primary }}
                    >
                      {row.name}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{row.type}</Badge>
                    </TableCell>
                    <TableCell className="text-xs font-mono" style={{ color: tokens.text.muted }}>
                      {row.field}
                    </TableCell>
                    <TableCell
                      className="text-sm line-through"
                      style={{ color: tokens.text.muted }}
                    >
                      {row.current}
                    </TableCell>
                    <TableCell
                      className="pr-6 text-sm font-medium"
                      style={{ color: tokens.confidence.high.value }}
                    >
                      {row.new}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* History */}
      <Card className="py-0 gap-0">
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <History className="size-4" style={{ color: tokens.text.secondary }} />
            Operation History
          </CardTitle>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          <div className="max-h-[280px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Batch ID</TableHead>
                  <TableHead>Operation</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Scope</TableHead>
                  <TableHead>Records</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="pr-6">Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockHistory.map((h) => (
                  <TableRow key={h.id}>
                    <TableCell
                      className="pl-6 font-mono text-xs"
                      style={{ color: tokens.accent.primary }}
                    >
                      {h.id}
                    </TableCell>
                    <TableCell
                      className="text-sm capitalize"
                      style={{ color: tokens.text.primary }}
                    >
                      {h.op}
                    </TableCell>
                    <TableCell className="text-sm" style={{ color: tokens.text.secondary }}>
                      {h.entity}
                    </TableCell>
                    <TableCell
                      className="text-sm capitalize"
                      style={{ color: tokens.text.secondary }}
                    >
                      {h.scope}
                    </TableCell>
                    <TableCell
                      className="font-mono text-sm"
                      style={{ color: tokens.text.secondary }}
                    >
                      {h.count}
                    </TableCell>
                    <TableCell>
                      <HistoryStatusBadge status={h.status} />
                    </TableCell>
                    <TableCell className="pr-6 text-xs" style={{ color: tokens.text.muted }}>
                      {h.time}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default BatchOperationsPanel;
