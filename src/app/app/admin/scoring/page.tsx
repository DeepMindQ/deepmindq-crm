/**
 * Phase 7.3 — Admin Dashboard: Scoring Configuration
 *
 * Client Component for configuring scoring weights, tier thresholds,
 * signal recency, and sub-dimension weights.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';

// ── Types ──

interface ScoringWeights {
  staticFit: number;
  dynamicIntelligence: number;
  timingUrgency: number;
}

interface TierThresholds {
  hot: number;
  active: number;
  nurture: number;
}

interface DynamicIntelSubWeights {
  intelligenceScore: number;
  researchDepth: number;
  signalQuality: number;
  contactCoverage: number;
}

interface TimingUrgencySubWeights {
  signalRecency: number;
  engagementRecency: number;
  growthIndicator: number;
}

interface ScoringConfig {
  weights: ScoringWeights;
  tierThresholds: TierThresholds;
  signalRecencyDays: number;
  subDimensionWeights: {
    dynamicIntelligence: DynamicIntelSubWeights;
    timingUrgency: TimingUrgencySubWeights;
  };
}

interface HistoryEntry {
  id: string;
  previousConfig: Record<string, unknown>;
  newConfig: Record<string, unknown>;
  changedBy: string;
  changeReason: string | null;
  createdAt: string;
}

const DEFAULT_WEIGHTS: ScoringWeights = {
  staticFit: 0.40,
  dynamicIntelligence: 0.40,
  timingUrgency: 0.20,
};

const DEFAULT_THRESHOLDS: TierThresholds = {
  hot: 90,
  active: 70,
  nurture: 50,
};

const DEFAULT_SUB_DI: DynamicIntelSubWeights = {
  intelligenceScore: 0.30,
  researchDepth: 0.25,
  signalQuality: 0.25,
  contactCoverage: 0.20,
};

const DEFAULT_SUB_TU: TimingUrgencySubWeights = {
  signalRecency: 0.40,
  engagementRecency: 0.35,
  growthIndicator: 0.25,
};

function pct(val: number): number {
  return Math.round(val * 100);
}

function toDecimal(pctVal: number): number {
  return pctVal / 100;
}

function sumTo(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0);
}

export default function AdminScoringPage() {
  // ── Config State ──
  const [config, setConfig] = useState<ScoringConfig | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);

  // ── Expanded Sections ──
  const [diExpanded, setDiExpanded] = useState(false);
  const [tuExpanded, setTuExpanded] = useState(false);

  // ── Working State ──
  const [weights, setWeights] = useState<ScoringWeights>(DEFAULT_WEIGHTS);
  const [thresholds, setThresholds] = useState<TierThresholds>(DEFAULT_THRESHOLDS);
  const [recencyDays, setRecencyDays] = useState(30);
  const [subDI, setSubDI] = useState<DynamicIntelSubWeights>(DEFAULT_SUB_DI);
  const [subTU, setSubTU] = useState<TimingUrgencySubWeights>(DEFAULT_SUB_TU);
  const [changeReason, setChangeReason] = useState('');

  // ── Fetch current config + history ──
  const fetchConfig = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/scoring');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.success) {
        const c = json.data.config as ScoringConfig;
        setConfig(c);
        setWeights({ ...c.weights });
        setThresholds({ ...c.tierThresholds });
        setRecencyDays(c.signalRecencyDays);
        setSubDI({ ...c.subDimensionWeights.dynamicIntelligence });
        setSubTU({ ...c.subDimensionWeights.timingUrgency });
        setHistory(json.data.history || []);
      } else {
        toast.error(json.error || 'Failed to load scoring config');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load scoring config');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  // ── Validation ──
  const weightSum = sumTo([weights.staticFit, weights.dynamicIntelligence, weights.timingUrgency]);
  const weightsValid = Math.abs(weightSum - 1.0) < 0.02;

  const diSum = sumTo([subDI.intelligenceScore, subDI.researchDepth, subDI.signalQuality, subDI.contactCoverage]);
  const diValid = Math.abs(diSum - 1.0) < 0.02;

  const tuSum = sumTo([subTU.signalRecency, subTU.engagementRecency, subTU.growthIndicator]);
  const tuValid = Math.abs(tuSum - 1.0) < 0.02;

  const thresholdsValid = thresholds.hot > thresholds.active && thresholds.active > thresholds.nurture;

  const hasChanges = config && (
    weights.staticFit !== config.weights.staticFit ||
    weights.dynamicIntelligence !== config.weights.dynamicIntelligence ||
    weights.timingUrgency !== config.weights.timingUrgency ||
    thresholds.hot !== config.tierThresholds.hot ||
    thresholds.active !== config.tierThresholds.active ||
    thresholds.nurture !== config.tierThresholds.nurture ||
    recencyDays !== config.signalRecencyDays ||
    subDI.intelligenceScore !== config.subDimensionWeights.dynamicIntelligence.intelligenceScore ||
    subDI.researchDepth !== config.subDimensionWeights.dynamicIntelligence.researchDepth ||
    subDI.signalQuality !== config.subDimensionWeights.dynamicIntelligence.signalQuality ||
    subDI.contactCoverage !== config.subDimensionWeights.dynamicIntelligence.contactCoverage ||
    subTU.signalRecency !== config.subDimensionWeights.timingUrgency.signalRecency ||
    subTU.engagementRecency !== config.subDimensionWeights.timingUrgency.engagementRecency ||
    subTU.growthIndicator !== config.subDimensionWeights.timingUrgency.growthIndicator
  );

  const isAllValid = weightsValid && diValid && tuValid && thresholdsValid &&
    recencyDays >= 1 && recencyDays <= 365;

  // ── Save Handler ──
  const handleSave = async () => {
    if (!isAllValid) {
      toast.error('Please fix validation errors before saving.');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/admin/scoring', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          weights,
          tierThresholds: thresholds,
          signalRecencyDays: recencyDays,
          subDimensionWeights: {
            dynamicIntelligence: subDI,
            timingUrgency: subTU,
          },
          changeReason: changeReason || undefined,
        }),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || 'Failed to save');
      }
      toast.success('Scoring configuration saved successfully');
      setChangeReason('');
      await fetchConfig();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  // ── Reset Handler ──
  const handleReset = async () => {
    if (!confirm('Reset all scoring weights to defaults? This cannot be undone.')) return;
    setResetting(true);
    try {
      const res = await fetch('/api/admin/scoring', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset' }),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || 'Failed to reset');
      }
      toast.success('Scoring configuration reset to defaults');
      await fetchConfig();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to reset');
    } finally {
      setResetting(false);
    }
  };

  if (loading && !config) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-4xl mx-auto text-center py-20 text-gray-400">
          Loading scoring configuration...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* ── Header ── */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Scoring Configuration</h1>
          <p className="text-sm text-gray-500 mt-1">
            Configure intelligence scoring weights, tier thresholds, and signal recency. Phase 7.3.
          </p>
        </div>

        {/* ── Dimension Weights Section ── */}
        <div className="bg-white rounded-lg border p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Dimension Weights</h2>
          <p className="text-xs text-gray-500 mb-4">
            Adjust the relative importance of each scoring dimension. All weights must sum to 100%.
          </p>

          {/* Validation banner */}
          {!weightsValid && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm mb-4">
              Warning: Weights sum to {pct(weightSum)}%. Must equal 100%.
            </div>
          )}
          {weightsValid && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-2 rounded-lg text-sm mb-4">
              Weights sum to {pct(weightSum)}% — Valid
            </div>
          )}

          <div className="space-y-4">
            {/* Static Fit */}
            <div className="flex items-center gap-4">
              <label className="text-sm font-medium text-gray-700 w-44">Static Fit</label>
              <input
                type="range"
                min="0"
                max="100"
                step="1"
                value={pct(weights.staticFit)}
                onChange={(e) => setWeights({ ...weights, staticFit: toDecimal(Number(e.target.value)) })}
                className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
              <input
                type="number"
                min="0"
                max="100"
                value={pct(weights.staticFit)}
                onChange={(e) => setWeights({ ...weights, staticFit: toDecimal(Number(e.target.value)) })}
                className="w-16 border rounded px-2 py-1 text-sm text-center focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
              <span className="text-sm text-gray-500">%</span>
            </div>

            {/* Dynamic Intelligence */}
            <div className="flex items-center gap-4">
              <label className="text-sm font-medium text-gray-700 w-44">Dynamic Intelligence</label>
              <input
                type="range"
                min="0"
                max="100"
                step="1"
                value={pct(weights.dynamicIntelligence)}
                onChange={(e) => setWeights({ ...weights, dynamicIntelligence: toDecimal(Number(e.target.value)) })}
                className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
              <input
                type="number"
                min="0"
                max="100"
                value={pct(weights.dynamicIntelligence)}
                onChange={(e) => setWeights({ ...weights, dynamicIntelligence: toDecimal(Number(e.target.value)) })}
                className="w-16 border rounded px-2 py-1 text-sm text-center focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
              <span className="text-sm text-gray-500">%</span>
            </div>

            {/* Timing/Urgency */}
            <div className="flex items-center gap-4">
              <label className="text-sm font-medium text-gray-700 w-44">Timing / Urgency</label>
              <input
                type="range"
                min="0"
                max="100"
                step="1"
                value={pct(weights.timingUrgency)}
                onChange={(e) => setWeights({ ...weights, timingUrgency: toDecimal(Number(e.target.value)) })}
                className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
              <input
                type="number"
                min="0"
                max="100"
                value={pct(weights.timingUrgency)}
                onChange={(e) => setWeights({ ...weights, timingUrgency: toDecimal(Number(e.target.value)) })}
                className="w-16 border rounded px-2 py-1 text-sm text-center focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
              <span className="text-sm text-gray-500">%</span>
            </div>
          </div>
        </div>

        {/* ── Tier Thresholds Section ── */}
        <div className="bg-white rounded-lg border p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Tier Thresholds</h2>
          <p className="text-xs text-gray-500 mb-4">
            Minimum scores required for tier classification. Must satisfy: Hot &gt; Active &gt; Nurture.
          </p>

          {!thresholdsValid && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm mb-4">
              Warning: Thresholds must satisfy Hot ({thresholds.hot}) &gt; Active ({thresholds.active}) &gt; Nurture ({thresholds.nurture}).
            </div>
          )}

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Hot (≥)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={thresholds.hot}
                onChange={(e) => setThresholds({ ...thresholds, hot: Number(e.target.value) })}
                className="w-full border rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Active (≥)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={thresholds.active}
                onChange={(e) => setThresholds({ ...thresholds, active: Number(e.target.value) })}
                className="w-full border rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nurture (≥)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={thresholds.nurture}
                onChange={(e) => setThresholds({ ...thresholds, nurture: Number(e.target.value) })}
                className="w-full border rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* ── Signal Recency ── */}
        <div className="bg-white rounded-lg border p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Signal Recency</h2>
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-gray-700 w-44">
              Recency Window
            </label>
            <input
              type="number"
              min="1"
              max="365"
              value={recencyDays}
              onChange={(e) => setRecencyDays(Number(e.target.value))}
              className="w-24 border rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
            <span className="text-sm text-gray-500">days</span>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Signals older than this window receive reduced or zero scoring weight.
          </p>
        </div>

        {/* ── Sub-dimension Weights: Dynamic Intelligence ── */}
        <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
          <button
            onClick={() => setDiExpanded(!diExpanded)}
            className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-gray-50 transition-colors"
          >
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Dynamic Intelligence Sub-Weights</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Sum: {pct(diSum)}% {!diValid && '(must equal 100%)'}
              </p>
            </div>
            <svg
              className={`w-5 h-5 text-gray-400 transition-transform ${diExpanded ? 'rotate-180' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {diExpanded && (
            <div className="px-6 pb-6 border-t space-y-4 pt-4">
              {!diValid && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm">
                  Warning: Sub-weights sum to {pct(diSum)}%. Must equal 100%.
                </div>
              )}
              <WeightSlider label="Intelligence Score" value={subDI.intelligenceScore}
                onChange={(v) => setSubDI({ ...subDI, intelligenceScore: v })} />
              <WeightSlider label="Research Depth" value={subDI.researchDepth}
                onChange={(v) => setSubDI({ ...subDI, researchDepth: v })} />
              <WeightSlider label="Signal Quality" value={subDI.signalQuality}
                onChange={(v) => setSubDI({ ...subDI, signalQuality: v })} />
              <WeightSlider label="Contact Coverage" value={subDI.contactCoverage}
                onChange={(v) => setSubDI({ ...subDI, contactCoverage: v })} />
            </div>
          )}
        </div>

        {/* ── Sub-dimension Weights: Timing/Urgency ── */}
        <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
          <button
            onClick={() => setTuExpanded(!tuExpanded)}
            className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-gray-50 transition-colors"
          >
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Timing / Urgency Sub-Weights</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Sum: {pct(tuSum)}% {!tuValid && '(must equal 100%)'}
              </p>
            </div>
            <svg
              className={`w-5 h-5 text-gray-400 transition-transform ${tuExpanded ? 'rotate-180' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {tuExpanded && (
            <div className="px-6 pb-6 border-t space-y-4 pt-4">
              {!tuValid && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm">
                  Warning: Sub-weights sum to {pct(tuSum)}%. Must equal 100%.
                </div>
              )}
              <WeightSlider label="Signal Recency" value={subTU.signalRecency}
                onChange={(v) => setSubTU({ ...subTU, signalRecency: v })} />
              <WeightSlider label="Engagement Recency" value={subTU.engagementRecency}
                onChange={(v) => setSubTU({ ...subTU, engagementRecency: v })} />
              <WeightSlider label="Growth Indicator" value={subTU.growthIndicator}
                onChange={(v) => setSubTU({ ...subTU, growthIndicator: v })} />
            </div>
          )}
        </div>

        {/* ── Change Reason ── */}
        <div className="bg-white rounded-lg border p-6 shadow-sm">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Change Reason (optional)
          </label>
          <input
            type="text"
            value={changeReason}
            onChange={(e) => setChangeReason(e.target.value)}
            placeholder="Describe the reason for this change..."
            className="w-full border rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>

        {/* ── Action Bar ── */}
        <div className="flex items-center gap-4">
          <button
            onClick={handleSave}
            disabled={saving || !hasChanges || !isAllValid}
            className="px-6 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
          <button
            onClick={handleReset}
            disabled={resetting}
            className="px-6 py-2.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors"
          >
            {resetting ? 'Resetting...' : 'Reset to Defaults'}
          </button>
          {hasChanges && (
            <span className="text-sm text-amber-600">
              Unsaved changes
            </span>
          )}
        </div>

        {/* ── Change History ── */}
        <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b">
            <h2 className="text-lg font-semibold text-gray-900">Change History</h2>
            <p className="text-xs text-gray-500 mt-0.5">Last 10 configuration changes</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Timestamp</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Changed By</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Reason</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Summary</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {history.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-12 text-center text-gray-400">
                      No configuration changes recorded.
                    </td>
                  </tr>
                ) : (
                  history.map((entry) => (
                    <tr key={entry.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                        {new Date(entry.createdAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-gray-700 font-mono text-xs">
                        {truncateStr(entry.changedBy, 16)}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {entry.changeReason || '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {summarizeChange(entry.previousConfig, entry.newConfig)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ──

function WeightSlider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-4">
      <label className="text-sm text-gray-600 w-44">{label}</label>
      <input
        type="range"
        min="0"
        max="100"
        step="1"
        value={pct(value)}
        onChange={(e) => onChange(toDecimal(Number(e.target.value)))}
        className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
      />
      <input
        type="number"
        min="0"
        max="100"
        value={pct(value)}
        onChange={(e) => onChange(toDecimal(Number(e.target.value)))}
        className="w-16 border rounded px-2 py-1 text-sm text-center focus:ring-2 focus:ring-blue-500 focus:outline-none"
      />
      <span className="text-sm text-gray-500">%</span>
    </div>
  );
}

function truncateStr(str: string | null | undefined, max: number): string {
  if (!str) return '—';
  return str.length > max ? str.substring(0, max) + '...' : str;
}

function summarizeChange(prev: Record<string, unknown>, next: Record<string, unknown>): string {
  const diffs: string[] = [];

  const compareNested = (prefix: string, a: Record<string, unknown>, b: Record<string, unknown>) => {
    for (const key of Object.keys(b)) {
      const path = `${prefix}.${key}`;
      if (typeof b[key] === 'object' && b[key] !== null && !Array.isArray(b[key])) {
        if (typeof a[key] === 'object' && a[key] !== null && !Array.isArray(a[key])) {
          compareNested(path, a[key] as Record<string, unknown>, b[key] as Record<string, unknown>);
        } else {
          diffs.push(`${path}: set`);
        }
      } else if (a[key] !== b[key]) {
        diffs.push(`${path}: ${a[key]} → ${b[key]}`);
      }
    }
  };

  compareNested('', prev, next);
  if (diffs.length === 0) return 'No changes';
  return diffs.slice(0, 3).join('; ') + (diffs.length > 3 ? ` (+${diffs.length - 3} more)` : '');
}
