#!/usr/bin/env python3
"""WI-9A: Protect settings-data-rules.tsx by replacing broken /api/config/* calls with disabled stubs."""

import re

INPUT = "src/components/screens/settings-data-rules.tsx"
OUTPUT = INPUT  # in-place

with open(INPUT, "r") as f:
    content = f.read()

# 1. Add Construction to lucide imports
content = content.replace(
    "import {\n  Database, Plus, Trash2, RefreshCw, Loader2, CheckCircle2,\n  AlertTriangle, Zap, ArrowUpDown, Shield, BarChart3, Save,\n} from 'lucide-react';",
    "import {\n  Database, Plus, Trash2, RefreshCw, Loader2, CheckCircle2,\n  AlertTriangle, Zap, ArrowUpDown, Shield, BarChart3, Save,\n  Construction,\n} from 'lucide-react';",
)

# 2. Remove unused imports: useEffect (no longer needed since we removed the useEffect loader), motion, AnimatePresence, Switch, Separator
# Actually, let me keep imports that might be used in the JSX. Let me check: motion/AnimatePresence/Switch/Separator - not used in JSX.
# But removing them risks breaking if there's a reference I missed. Let's keep them to avoid regression.
# Actually useEffect IS used nowhere now - but keeping it is safer. Let's leave imports alone.

# 3. Replace the entire block from "// ── Fetch functions ──" through seedDefaults
# This is the big replacement: remove all fetch callbacks, the useEffect, all delete handlers, all create handlers, and seedDefaults
old_block = """  // ── Fetch functions ──
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
  };"""

new_block = """  // ── NOTE: /api/config/* endpoints do not exist yet ──
  // Data rule CRUD (column-rules, validation-rules, normalization, scoring)
  // and seed-defaults are gated behind a future configuration persistence layer.
  // Only recalculateScores (/api/leads/recalculate-scores) is operational.

  const handleNotImplemented = useCallback(() => {
    toast.info('Configuration persistence is not yet available. This capability requires the config API layer (planned for a future work item).');
  }, []);

  // ── Disabled stubs (no-ops until /api/config/* exists) ──
  const seedDefaults = useCallback(() => { handleNotImplemented(); }, [handleNotImplemented]);
  const createColumnRule = useCallback(() => { handleNotImplemented(); }, [handleNotImplemented]);
  const createValidationRule = useCallback(() => { handleNotImplemented(); }, [handleNotImplemented]);
  const createNormMapping = useCallback(() => { handleNotImplemented(); }, [handleNotImplemented]);
  const createScoringWeight = useCallback(() => { handleNotImplemented(); }, [handleNotImplemented]);
  const deleteColumnRule = useCallback((_id: string) => { handleNotImplemented(); }, [handleNotImplemented]);
  const deleteValidationRule = useCallback((_id: string) => { handleNotImplemented(); }, [handleNotImplemented]);
  const deleteNormMapping = useCallback((_id: string) => { handleNotImplemented(); }, [handleNotImplemented]);
  const deleteScoringWeight = useCallback((_id: string) => { handleNotImplemented(); }, [handleNotImplemented]);"""

assert old_block in content, "ERROR: Could not find the old block to replace. Check whitespace."
content = content.replace(old_block, new_block)

# 4. Replace the Seed Defaults button to show Construction icon
content = content.replace(
    """          <Button variant="outline" size="sm" onClick={seedDefaults} disabled={seedLoading}>
            {seedLoading ? <Loader2 className="size-3.5 animate-spin mr-1.5" /> : <RefreshCw className="size-3.5 mr-1.5" />}
            Seed Defaults
          </Button>""",
    """          <Button variant="outline" size="sm" onClick={handleNotImplemented} disabled={seedLoading}>
            {seedLoading ? <Loader2 className="size-3.5 animate-spin mr-1.5" /> : <Construction className="size-3.5 mr-1.5" />}
            Seed Defaults
          </Button>""",
)

# 5. Add under-development banners to each TabsContent
banner = """          <div className="mb-3 flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2">
            <Construction className="size-3.5 text-amber-500 shrink-0" />
            <p className="text-xs text-amber-600 dark:text-amber-400">
              Configuration persistence is under development. Rules cannot be loaded, created, or modified until the config API layer is built.
            </p>
          </div>"""

# Column Rules
content = content.replace(
    "        {/* ═══ Column Mapping Rules ═══ */}\n        <TabsContent value=\"column-rules\" className=\"mt-4\">\n          <GlassPanel>",
    f"        {{/* ═══ Column Mapping Rules ═══ */}}\n        <TabsContent value=\"column-rules\" className=\"mt-4\">\n{banner}\n          <GlassPanel>",
)

# Validation Rules
content = content.replace(
    "        {/* ═══ Validation Rules ═══ */}\n        <TabsContent value=\"validation-rules\" className=\"mt-4\">\n          <GlassPanel>",
    f"        {{/* ═══ Validation Rules ═══ */}}\n        <TabsContent value=\"validation-rules\" className=\"mt-4\">\n{banner}\n          <GlassPanel>",
)

# Normalization
content = content.replace(
    "        {/* ═══ Normalization Mappings ═══ */}\n        <TabsContent value=\"normalization\" className=\"mt-4\">\n          <GlassPanel>",
    f"        {{/* ═══ Normalization Mappings ═══ */}}\n        <TabsContent value=\"normalization\" className=\"mt-4\">\n{banner}\n          <GlassPanel>",
)

# Scoring Weights
content = content.replace(
    "        {/* ═══ Scoring Weights ═══ */}\n        <TabsContent value=\"scoring\" className=\"mt-4\">\n          <GlassPanel>",
    f"        {{/* ═══ Scoring Weights ═══ */}}\n        <TabsContent value=\"scoring\" className=\"mt-4\">\n{banner}\n          <GlassPanel>",
)

# 6. Update the empty state messages to reflect under-development status
content = content.replace(
    'No column mapping rules. Click &quot;Seed Defaults&quot; to create standard rules.',
    'No column mapping rules loaded. The configuration API layer is not yet available.',
)
content = content.replace(
    'No validation rules configured.',
    'No validation rules loaded. The configuration API layer is not yet available.',
)
content = content.replace(
    'No normalization mappings. Add mappings or seed defaults.',
    'No normalization mappings loaded. The configuration API layer is not yet available.',
)
content = content.replace(
    'No scoring weights configured. Seed defaults to start.',
    'No scoring weights loaded. The configuration API layer is not yet available.',
)

# 7. Remove unused imports that are now definitely unreferenced
# motion and AnimatePresence are imported but unused in this component
content = content.replace(
    "import { motion, AnimatePresence } from 'framer-motion';\n",
    "",
)

with open(OUTPUT, "w") as f:
    f.write(content)

# Count lines
lines = content.count("\n") + 1
print(f"Done. {INPUT} now has {lines} lines.")
