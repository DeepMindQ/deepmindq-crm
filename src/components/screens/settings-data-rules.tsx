'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassPanel } from '@/components/ui/animated-components';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Database, Plus, Trash2, RefreshCw, Loader2, CheckCircle2,
  AlertTriangle, Zap, ArrowUpDown, Shield, BarChart3, Save,
} from 'lucide-react';
import { toast } from 'sonner';

// ── Target fields for dropdowns ──
const TARGET_FIELDS = [
  'name', 'email', 'company', 'title', 'phone', 'linkedin',
  'location', 'country', 'industry', 'size', 'website', 'domain',
  'revenue', 'funding', 'state', 'zip', 'address',
];

const RULE_TYPES = ['required', 'regex', 'format', 'range', 'uniqueness', 'custom'] as const;
const SEVERITIES = ['error', 'warning'] as const;

const NORM_CATEGORIES = ['industry', 'country', 'employee_size', 'title'];

// ── Types ──
interface ColumnRule {
  id: string; name: string; pattern: string; targetField: string;
  priority: number; isActive: boolean;
}
interface ValidationRule {
  id: string; name: string; targetField: string; ruleType: string;
  config: string; severity: string; message: string; priority: number; isActive: boolean;
}
interface NormMapping {
  id: string; category: string; sourceValue: string;
  normalizedValue: string; isActive: boolean;
}
interface ScoringWeight {
  id: string; dimension: string; field: string | null; key: string | null;
  weight: number; maxScore: number; description: string | null; isActive: boolean;
}

// ═══════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════

export default function DataRulesSection() {
  const [activeSubTab, setActiveSubTab] = useState('column-rules');
  const [seedLoading, setSeedLoading] = useState(false);
  const [recalcLoading, setRecalcLoading] = useState(false);

  // ── Data states ──
  const [columnRules, setColumnRules] = useState<ColumnRule[]>([]);
  const [validationRules, setValidationRules] = useState<ValidationRule[]>([]);
  const [normMappings, setNormMappings] = useState<NormMapping[]>([]);
  const [scoringWeights, setScoringWeights] = useState<ScoringWeight[]>([]);

  const [loading, setLoading] = useState<Record<string, boolean>>({});

  // ── Dialog states ──
  const [showColDialog, setShowColDialog] = useState(false);
  const [showValDialog, setShowValDialog] = useState(false);
  const [showNormDialog, setShowNormDialog] = useState(false);
  const [showScoreDialog, setShowScoreDialog] = useState(false);

  // ── Form states ──
  const [colForm, setColForm] = useState({ name: '', pattern: '', targetField: 'name', priority: 5 });
  const [valForm, setValForm] = useState({ name: '', targetField: 'email', ruleType: 'format', severity: 'warning', message: '', config: '', priority: 5 });
  const [normForm, setNormForm] = useState({ category: 'industry', sourceValue: '', normalizedValue: '' });
  const [scoreForm, setScoreForm] = useState({ dimension: 'data_quality', field: '', key: 'completeness', weight: 40, maxScore: 100, description: '' });

  // ── Fetch functions ──
  const fetchColumnRules = useCallback(async () => {
    try {
      const res = await fetch('/api/config/column-rules');
      if (res.ok) setColumnRules(await res.json());
    } catch { /* silent */ }
  }, []);

  const fetchValidationRules = useCallback(async () => {
    try {
      const res = await fetch('/api/config/validation-rules');
      if (res.ok) setValidationRules(await res.json());
    } catch { /* silent */ }
  }, []);

  const fetchNormMappings = useCallback(async () => {
    try {
      const res = await fetch('/api/config/normalization');
      if (res.ok) {
        const data = await res.json();
        setNormMappings(data.all || []);
      }
    } catch { /* silent */ }
  }, []);

  const fetchScoringWeights = useCallback(async () => {
    try {
      const res = await fetch('/api/config/scoring');
      if (res.ok) {
        const data = await res.json();
        setScoringWeights(data.all || []);
      }
    } catch { /* silent */ }
  }, []);

  // ── Load on mount and tab switch ──
  useEffect(() => {
    const loaders: Record<string, () => Promise<void>> = {
      'column-rules': fetchColumnRules,
      'validation-rules': fetchValidationRules,
      'normalization': fetchNormMappings,
      'scoring': fetchScoringWeights,
    };
    loaders[activeSubTab]?.();
  }, [activeSubTab, fetchColumnRules, fetchValidationRules, fetchNormMappings, fetchScoringWeights]);

  // ── Delete handlers ──
  const deleteColumnRule = async (id: string) => {
    try {
      const res = await fetch(`/api/config/column-rules/${id}`, { method: 'DELETE' });
      if (res.ok) { setColumnRules(prev => prev.filter(r => r.id !== id)); toast.success('Rule deleted'); }
    } catch { toast.error('Delete failed'); }
  };

  const deleteValidationRule = async (id: string) => {
    try {
      const res = await fetch(`/api/config/validation-rules/${id}`, { method: 'DELETE' });
      if (res.ok) { setValidationRules(prev => prev.filter(r => r.id !== id)); toast.success('Rule deleted'); }
    } catch { toast.error('Delete failed'); }
  };

  const deleteNormMapping = async (id: string) => {
    try {
      const res = await fetch(`/api/config/normalization/${id}`, { method: 'DELETE' });
      if (res.ok) { setNormMappings(prev => prev.filter(r => r.id !== id)); toast.success('Mapping deleted'); }
    } catch { toast.error('Delete failed'); }
  };

  const deleteScoringWeight = async (id: string) => {
    try {
      const res = await fetch(`/api/config/scoring/${id}`, { method: 'DELETE' });
      if (res.ok) { setScoringWeights(prev => prev.filter(r => r.id !== id)); toast.success('Weight deleted'); }
    } catch { toast.error('Delete failed'); }
  };

  // ── Create handlers ──
  const createColumnRule = async () => {
    if (!colForm.name || !colForm.pattern || !colForm.targetField) return;
    setLoading(prev => ({ ...prev, col: true }));
    try {
      const res = await fetch('/api/config/column-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(colForm),
      });
      if (res.ok) {
        toast.success('Column rule created');
        setShowColDialog(false);
        setColForm({ name: '', pattern: '', targetField: 'name', priority: 5 });
        fetchColumnRules();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Create failed');
      }
    } catch { toast.error('Network error'); }
    finally { setLoading(prev => ({ ...prev, col: false })); }
  };

  const createValidationRule = async () => {
    if (!valForm.name || !valForm.targetField || !valForm.message) return;
    setLoading(prev => ({ ...prev, val: true }));
    try {
      const res = await fetch('/api/config/validation-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(valForm),
      });
      if (res.ok) {
        toast.success('Validation rule created');
        setShowValDialog(false);
        setValForm({ name: '', targetField: 'email', ruleType: 'format', severity: 'warning', message: '', config: '', priority: 5 });
        fetchValidationRules();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Create failed');
      }
    } catch { toast.error('Network error'); }
    finally { setLoading(prev => ({ ...prev, val: false })); }
  };

  const createNormMapping = async () => {
    if (!normForm.sourceValue || !normForm.normalizedValue) return;
    setLoading(prev => ({ ...prev, norm: true }));
    try {
      const res = await fetch('/api/config/normalization', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(normForm),
      });
      if (res.ok) {
        toast.success('Normalization mapping created');
        setShowNormDialog(false);
        setNormForm({ category: 'industry', sourceValue: '', normalizedValue: '' });
        fetchNormMappings();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Create failed');
      }
    } catch { toast.error('Network error'); }
    finally { setLoading(prev => ({ ...prev, norm: false })); }
  };

  const createScoringWeight = async () => {
    if (!scoreForm.dimension) return;
    setLoading(prev => ({ ...prev, score: true }));
    try {
      const res = await fetch('/api/config/scoring', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(scoreForm),
      });
      if (res.ok) {
        toast.success('Scoring weight saved');
        setShowScoreDialog(false);
        setScoreForm({ dimension: 'data_quality', field: '', key: 'completeness', weight: 40, maxScore: 100, description: '' });
        fetchScoringWeights();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Save failed');
      }
    } catch { toast.error('Network error'); }
    finally { setLoading(prev => ({ ...prev, score: false })); }
  };

  // ── Seed default rules ──
  const seedDefaults = async () => {
    setSeedLoading(true);
    try {
      const res = await fetch('/api/config/seed', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        toast.success(data.message || 'Defaults seeded');
        // Reload all
        fetchColumnRules(); fetchValidationRules(); fetchNormMappings(); fetchScoringWeights();
      } else {
        const err = await res.json();
        toast.info(err.message || 'Seed skipped');
      }
    } catch { toast.error('Seed failed'); }
    finally { setSeedLoading(false); }
  };

  // ── Recalculate all lead scores ──
  const recalculateScores = async () => {
    setRecalcLoading(true);
    try {
      const res = await fetch('/api/leads/recalculate-scores', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        toast.success(`${data.updated || 0} lead scores recalculated`);
      } else {
        toast.error('Recalculation failed');
      }
    } catch { toast.error('Network error'); }
    finally { setRecalcLoading(false); }
  };

  // ── Helper: Rule count badges ──
  const ruleCounts = {
    'column-rules': columnRules.length,
    'validation-rules': validationRules.length,
    'normalization': normMappings.length,
    'scoring': scoringWeights.length,
  };

  return (
    <div className="space-y-6">
      {/* ── Header with actions ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Database className="size-4 text-[#D4AF37]" />
            Data Intelligence Configuration
          </h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            All business rules are database-driven. Changes take effect immediately without code deployment.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={seedDefaults} disabled={seedLoading}>
            {seedLoading ? <Loader2 className="size-3.5 animate-spin mr-1.5" /> : <RefreshCw className="size-3.5 mr-1.5" />}
            Seed Defaults
          </Button>
          <Button variant="outline" size="sm" onClick={recalculateScores} disabled={recalcLoading}>
            {recalcLoading ? <Loader2 className="size-3.5 animate-spin mr-1.5" /> : <Zap className="size-3.5 mr-1.5" />}
            Recalculate Scores
          </Button>
        </div>
      </div>

      {/* ── Sub-tabs ── */}
      <Tabs value={activeSubTab} onValueChange={setActiveSubTab}>
        <TabsList className="bg-muted/50 p-1 h-auto">
          <TabsTrigger value="column-rules" className="text-xs data-[state=active]:bg-[#D4AF37]/15 data-[state=active]:text-[#D4AF37]">
            <ArrowUpDown className="size-3 mr-1" /> Column Rules
            {ruleCounts['column-rules'] > 0 && (
              <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5 py-0">{ruleCounts['column-rules']}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="validation-rules" className="text-xs data-[state=active]:bg-[#D4AF37]/15 data-[state=active]:text-[#D4AF37]">
            <Shield className="size-3 mr-1" /> Validation Rules
            {ruleCounts['validation-rules'] > 0 && (
              <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5 py-0">{ruleCounts['validation-rules']}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="normalization" className="text-xs data-[state=active]:bg-[#D4AF37]/15 data-[state=active]:text-[#D4AF37]">
            <RefreshCw className="size-3 mr-1" /> Normalization
            {ruleCounts['normalization'] > 0 && (
              <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5 py-0">{ruleCounts['normalization']}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="scoring" className="text-xs data-[state=active]:bg-[#D4AF37]/15 data-[state=active]:text-[#D4AF37]">
            <BarChart3 className="size-3 mr-1" /> Scoring Weights
            {ruleCounts['scoring'] > 0 && (
              <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5 py-0">{ruleCounts['scoring']}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ═══ Column Mapping Rules ═══ */}
        <TabsContent value="column-rules" className="mt-4">
          <GlassPanel>
            <div className="flex items-center justify-between px-6 py-4 border-b border-border/50">
              <div>
                <h4 className="text-sm font-semibold">Column Mapping Rules</h4>
                <p className="text-xs text-muted-foreground mt-0.5">Regex patterns that auto-detect which file columns map to which system fields</p>
              </div>
              <Button size="sm" onClick={() => setShowColDialog(true)}>
                <Plus className="size-3.5 mr-1" /> Add Rule
              </Button>
            </div>
            <ScrollArea className="max-h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Name</TableHead>
                    <TableHead className="text-xs">Pattern</TableHead>
                    <TableHead className="text-xs">Target Field</TableHead>
                    <TableHead className="text-xs text-center">Priority</TableHead>
                    <TableHead className="text-xs text-center">Active</TableHead>
                    <TableHead className="text-xs text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {columnRules.map(rule => (
                    <TableRow key={rule.id}>
                      <TableCell className="text-sm font-medium">{rule.name}</TableCell>
                      <TableCell className="text-xs font-mono text-muted-foreground max-w-[200px] truncate">{rule.pattern}</TableCell>
                      <TableCell><Badge variant="outline" className="text-xs">{rule.targetField}</Badge></TableCell>
                      <TableCell className="text-center text-xs">{rule.priority}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant={rule.isActive ? 'default' : 'secondary'} className="text-[10px]">
                          {rule.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => deleteColumnRule(rule.id)}>
                          <Trash2 className="size-3" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {columnRules.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">
                        No column mapping rules. Click &quot;Seed Defaults&quot; to create standard rules.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </GlassPanel>
        </TabsContent>

        {/* ═══ Validation Rules ═══ */}
        <TabsContent value="validation-rules" className="mt-4">
          <GlassPanel>
            <div className="flex items-center justify-between px-6 py-4 border-b border-border/50">
              <div>
                <h4 className="text-sm font-semibold">Field Validation Rules</h4>
                <p className="text-xs text-muted-foreground mt-0.5">Rules that validate data quality during import (errors block, warnings allow review)</p>
              </div>
              <Button size="sm" onClick={() => setShowValDialog(true)}>
                <Plus className="size-3.5 mr-1" /> Add Rule
              </Button>
            </div>
            <ScrollArea className="max-h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Name</TableHead>
                    <TableHead className="text-xs">Field</TableHead>
                    <TableHead className="text-xs">Type</TableHead>
                    <TableHead className="text-xs">Severity</TableHead>
                    <TableHead className="text-xs">Message</TableHead>
                    <TableHead className="text-xs text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {validationRules.map(rule => (
                    <TableRow key={rule.id}>
                      <TableCell className="text-sm font-medium">{rule.name}</TableCell>
                      <TableCell><Badge variant="outline" className="text-xs">{rule.targetField}</Badge></TableCell>
                      <TableCell className="text-xs">{rule.ruleType}</TableCell>
                      <TableCell>
                        <Badge variant={rule.severity === 'error' ? 'destructive' : 'secondary'} className="text-[10px]">
                          {rule.severity}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{rule.message}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => deleteValidationRule(rule.id)}>
                          <Trash2 className="size-3" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {validationRules.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">
                        No validation rules configured.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </GlassPanel>
        </TabsContent>

        {/* ═══ Normalization Mappings ═══ */}
        <TabsContent value="normalization" className="mt-4">
          <GlassPanel>
            <div className="flex items-center justify-between px-6 py-4 border-b border-border/50">
              <div>
                <h4 className="text-sm font-semibold">Normalization Mappings</h4>
                <p className="text-xs text-muted-foreground mt-0.5">Maps messy input values to clean standard values (e.g., &quot;fintech&quot; to &quot;Financial Technology&quot;)</p>
              </div>
              <Button size="sm" onClick={() => setShowNormDialog(true)}>
                <Plus className="size-3.5 mr-1" /> Add Mapping
              </Button>
            </div>
            <ScrollArea className="max-h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Category</TableHead>
                    <TableHead className="text-xs">Source Value</TableHead>
                    <TableHead className="text-xs">Normalized To</TableHead>
                    <TableHead className="text-xs text-center">Active</TableHead>
                    <TableHead className="text-xs text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {normMappings.map(m => (
                    <TableRow key={m.id}>
                      <TableCell><Badge variant="outline" className="text-xs">{m.category}</Badge></TableCell>
                      <TableCell className="text-sm">{m.sourceValue}</TableCell>
                      <TableCell className="text-sm font-medium text-[#D4AF37]">{m.normalizedValue}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant={m.isActive ? 'default' : 'secondary'} className="text-[10px]">
                          {m.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => deleteNormMapping(m.id)}>
                          <Trash2 className="size-3" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {normMappings.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">
                        No normalization mappings. Add mappings or seed defaults.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </GlassPanel>
        </TabsContent>

        {/* ═══ Scoring Weights ═══ */}
        <TabsContent value="scoring" className="mt-4">
          <GlassPanel>
            <div className="flex items-center justify-between px-6 py-4 border-b border-border/50">
              <div>
                <h4 className="text-sm font-semibold">Scoring Weights</h4>
                <p className="text-xs text-muted-foreground mt-0.5">Configure how data quality and lead scores are calculated. All weights are editable without code changes.</p>
              </div>
              <Button size="sm" onClick={() => setShowScoreDialog(true)}>
                <Plus className="size-3.5 mr-1" /> Add Weight
              </Button>
            </div>
            <ScrollArea className="max-h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Dimension</TableHead>
                    <TableHead className="text-xs">Key</TableHead>
                    <TableHead className="text-xs text-center">Weight</TableHead>
                    <TableHead className="text-xs text-center">Max Score</TableHead>
                    <TableHead className="text-xs">Description</TableHead>
                    <TableHead className="text-xs text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {scoringWeights.map(w => (
                    <TableRow key={w.id}>
                      <TableCell><Badge variant="outline" className="text-xs">{w.dimension}</Badge></TableCell>
                      <TableCell className="text-xs font-medium">{w.key || w.field || '-'}</TableCell>
                      <TableCell className="text-center text-sm font-semibold text-[#D4AF37]">{w.weight}</TableCell>
                      <TableCell className="text-center text-xs text-muted-foreground">{w.maxScore}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{w.description || '-'}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => deleteScoringWeight(w.id)}>
                          <Trash2 className="size-3" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {scoringWeights.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">
                        No scoring weights configured. Seed defaults to start.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </GlassPanel>
        </TabsContent>
      </Tabs>

      {/* ═══════════════════════════════════════════════════════
          DIALOGS
         ═══════════════════════════════════════════════════════ */}

      {/* Column Rule Dialog */}
      <Dialog open={showColDialog} onOpenChange={setShowColDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Column Mapping Rule</DialogTitle>
            <DialogDescription>Define a regex pattern to auto-detect a column header and map it to a system field.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Rule Name</Label>
              <Input placeholder="e.g., Email variants" value={colForm.name} onChange={e => setColForm(p => ({ ...p, name: e.target.value }))} className="text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Regex Pattern</Label>
              <Input placeholder="e.g., ^(email|e-mail|email_address)$" value={colForm.pattern} onChange={e => setColForm(p => ({ ...p, pattern: e.target.value }))} className="text-sm font-mono" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Target Field</Label>
              <Select value={colForm.targetField} onValueChange={v => setColForm(p => ({ ...p, targetField: v }))}>
                <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TARGET_FIELDS.map(f => <SelectItem key={f} value={f} className="text-sm">{f}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Priority (higher = checked first)</Label>
              <Input type="number" min={0} max={100} value={colForm.priority} onChange={e => setColForm(p => ({ ...p, priority: parseInt(e.target.value) || 0 }))} className="text-sm" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowColDialog(false)}>Cancel</Button>
            <Button onClick={createColumnRule} disabled={loading.col}>
              {loading.col && <Loader2 className="size-3.5 animate-spin mr-1.5" />}
              <Save className="size-3.5 mr-1" /> Create Rule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Validation Rule Dialog */}
      <Dialog open={showValDialog} onOpenChange={setShowValDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Validation Rule</DialogTitle>
            <DialogDescription>Define a rule that validates imported data. Errors block import; warnings allow review.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Rule Name</Label>
              <Input placeholder="e.g., Email format check" value={valForm.name} onChange={e => setValForm(p => ({ ...p, name: e.target.value }))} className="text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Target Field</Label>
                <Select value={valForm.targetField} onValueChange={v => setValForm(p => ({ ...p, targetField: v }))}>
                  <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TARGET_FIELDS.map(f => <SelectItem key={f} value={f} className="text-sm">{f}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Rule Type</Label>
                <Select value={valForm.ruleType} onValueChange={v => setValForm(p => ({ ...p, ruleType: v }))}>
                  <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {RULE_TYPES.map(t => <SelectItem key={t} value={t} className="text-sm">{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Severity</Label>
              <Select value={valForm.severity} onValueChange={v => setValForm(p => ({ ...p, severity: v }))}>
                <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SEVERITIES.map(s => <SelectItem key={s} value={s} className="text-sm">{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Error Message</Label>
              <Input placeholder="e.g., Invalid email format" value={valForm.message} onChange={e => setValForm(p => ({ ...p, message: e.target.value }))} className="text-sm" />
            </div>
            {(valForm.ruleType === 'regex' || valForm.ruleType === 'format' || valForm.ruleType === 'custom') && (
              <div className="space-y-1.5">
                <Label className="text-xs">Config (JSON)</Label>
                <Input
                  placeholder='{"format":"email"} or {"pattern":"^...$"}'
                  value={valForm.config}
                  onChange={e => setValForm(p => ({ ...p, config: e.target.value }))}
                  className="text-sm font-mono"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowValDialog(false)}>Cancel</Button>
            <Button onClick={createValidationRule} disabled={loading.val}>
              {loading.val && <Loader2 className="size-3.5 animate-spin mr-1.5" />}
              <Save className="size-3.5 mr-1" /> Create Rule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Normalization Mapping Dialog */}
      <Dialog open={showNormDialog} onOpenChange={setShowNormDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Normalization Mapping</DialogTitle>
            <DialogDescription>Map a messy input value to a clean standard value.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Category</Label>
              <Select value={normForm.category} onValueChange={v => setNormForm(p => ({ ...p, category: v }))}>
                <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {NORM_CATEGORIES.map(c => <SelectItem key={c} value={c} className="text-sm">{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Source Value (as it appears in imports)</Label>
              <Input placeholder="e.g., fintech" value={normForm.sourceValue} onChange={e => setNormForm(p => ({ ...p, sourceValue: e.target.value }))} className="text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Normalized Value (clean standard)</Label>
              <Input placeholder="e.g., Financial Technology" value={normForm.normalizedValue} onChange={e => setNormForm(p => ({ ...p, normalizedValue: e.target.value }))} className="text-sm" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNormDialog(false)}>Cancel</Button>
            <Button onClick={createNormMapping} disabled={loading.norm}>
              {loading.norm && <Loader2 className="size-3.5 animate-spin mr-1.5" />}
              <Save className="size-3.5 mr-1" /> Create Mapping
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Scoring Weight Dialog */}
      <Dialog open={showScoreDialog} onOpenChange={setShowScoreDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add / Update Scoring Weight</DialogTitle>
            <DialogDescription>Configure a scoring dimension weight. Changing weights affects all future score calculations.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Dimension</Label>
              <Select value={scoreForm.dimension} onValueChange={v => setScoreForm(p => ({ ...p, dimension: v }))}>
                <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['data_quality', 'role', 'company_fit', 'email_health', 'engagement', 'enrichment'].map(d =>
                    <SelectItem key={d} value={d} className="text-sm">{d}</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Key</Label>
              <Input placeholder="e.g., completeness, c_level" value={scoreForm.key} onChange={e => setScoreForm(p => ({ ...p, key: e.target.value }))} className="text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Weight</Label>
                <Input type="number" min={0} value={scoreForm.weight} onChange={e => setScoreForm(p => ({ ...p, weight: parseInt(e.target.value) || 0 }))} className="text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Max Score</Label>
                <Input type="number" min={0} value={scoreForm.maxScore} onChange={e => setScoreForm(p => ({ ...p, maxScore: parseInt(e.target.value) || 0 }))} className="text-sm" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Description</Label>
              <Input placeholder="e.g., Fields filled" value={scoreForm.description} onChange={e => setScoreForm(p => ({ ...p, description: e.target.value }))} className="text-sm" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowScoreDialog(false)}>Cancel</Button>
            <Button onClick={createScoringWeight} disabled={loading.score}>
              {loading.score && <Loader2 className="size-3.5 animate-spin mr-1.5" />}
              <Save className="size-3.5 mr-1" /> Save Weight
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}