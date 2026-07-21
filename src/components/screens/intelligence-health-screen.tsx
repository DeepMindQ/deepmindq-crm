'use client';

import { useState, useEffect, useCallback } from 'react';
import { Shield, AlertTriangle, CheckCircle, BarChart3, RefreshCw, ArrowRight } from 'lucide-react';

interface HealthTierCounts { excellent: number; good: number; fair: number; poor: number; }
interface LowHealthCompany { companyId: string; companyName: string; healthScore: number; }
interface RecentConflict { id: string; companyId: string; companyName: string; conflictType: string; severity: string; detectedAt: string; }

interface DashboardData {
  summary: {
    totalCompanies: number;
    avgHealthScore: number;
    companiesByHealthTier: HealthTierCounts;
    totalConflicts: number;
    openConflicts: number;
    validationRate: number;
  };
  lowestHealthCompanies: LowHealthCompany[];
  recentConflicts: RecentConflict[];
}

function HealthTierBar({ tiers }: { tiers: HealthTierCounts }) {
  const total = tiers.excellent + tiers.good + tiers.fair + tiers.poor;
  if (total === 0) return <p className="text-sm text-gray-500">No companies scored yet</p>;

  const segments = [
    { label: 'Excellent (90+)', count: tiers.excellent, color: 'bg-emerald-500', textColor: 'text-emerald-700' },
    { label: 'Good (70-89)', count: tiers.good, color: 'bg-blue-500', textColor: 'text-blue-700' },
    { label: 'Fair (50-69)', count: tiers.fair, color: 'bg-amber-500', textColor: 'text-amber-700' },
    { label: 'Poor (<50)', count: tiers.poor, color: 'bg-red-500', textColor: 'text-red-700' },
  ];

  return (
    <div className="space-y-2">
      {/* Stacked bar */}
      <div className="flex h-6 rounded-md overflow-hidden bg-gray-100">
        {segments.map(s => (
          <div
            key={s.label}
            className={`${s.color} transition-all duration-500`}
            style={{ width: `${total > 0 ? (s.count / total) * 100 : 0}%` }}
          />
        ))}
      </div>
      {/* Legend */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-1">
        {segments.map(s => (
          <div key={s.label} className="flex items-center gap-2 text-sm">
            <div className={`w-3 h-3 rounded-sm ${s.color}`} />
            <span className="text-gray-600">{s.label}</span>
            <span className={`font-semibold ${s.textColor}`}>{s.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const colors: Record<string, string> = {
    critical: 'bg-red-100 text-red-700',
    high: 'bg-orange-100 text-orange-700',
    medium: 'bg-amber-100 text-amber-700',
    low: 'bg-gray-100 text-gray-600',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[severity] || colors.low}`}>
      {severity.toUpperCase()}
    </span>
  );
}

export default function IntelligenceHealthScreen() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/g-intelligence/dashboard');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="w-6 h-6 text-gray-400 animate-spin" />
        <span className="ml-3 text-gray-500">Loading intelligence health data...</span>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="flex items-center justify-center h-96 text-red-500">
        <AlertTriangle className="w-5 h-5 mr-2" />
        {error}
      </div>
    );
  }

  if (!data) return null;

  const { summary, lowestHealthCompanies, recentConflicts } = data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-50 rounded-lg">
            <Shield className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Intelligence Health Dashboard</h1>
            <p className="text-sm text-gray-500">Monitor intelligence quality and trust metrics across all companies</p>
          </div>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="flex items-center gap-2 text-gray-500 text-xs font-medium uppercase tracking-wide">
            <Shield className="w-3.5 h-3.5" /> Avg Health
          </div>
          <div className="mt-2 text-3xl font-bold text-gray-900">{summary.avgHealthScore}%</div>
          <div className="mt-1 text-xs text-gray-400">{summary.totalCompanies} companies scored</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="flex items-center gap-2 text-gray-500 text-xs font-medium uppercase tracking-wide">
            <AlertTriangle className="w-3.5 h-3.5" /> Open Conflicts
          </div>
          <div className="mt-2 text-3xl font-bold text-orange-600">{summary.openConflicts}</div>
          <div className="mt-1 text-xs text-gray-400">{summary.totalConflicts} total detected</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="flex items-center gap-2 text-gray-500 text-xs font-medium uppercase tracking-wide">
            <CheckCircle className="w-3.5 h-3.5" /> Validation Rate
          </div>
          <div className="mt-2 text-3xl font-bold text-blue-600">{Math.round(summary.validationRate * 100)}%</div>
          <div className="mt-1 text-xs text-gray-400">Companies with health records</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="flex items-center gap-2 text-gray-500 text-xs font-medium uppercase tracking-wide">
            <BarChart3 className="w-3.5 h-3.5" /> Coverage
          </div>
          <div className="mt-2 text-3xl font-bold text-emerald-600">
            {summary.avgHealthScore >= 70 ? 'Good' : summary.avgHealthScore >= 50 ? 'Fair' : 'Low'}
          </div>
          <div className="mt-1 text-xs text-gray-400">Based on average health score</div>
        </div>
      </div>

      {/* Health Distribution */}
      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <h2 className="text-sm font-semibold text-gray-800 mb-4">Health Distribution</h2>
        <HealthTierBar tiers={summary.companiesByHealthTier} />
      </div>

      {/* Two-column tables */}
      <div className="grid grid-cols-2 gap-6">
        {/* Lowest Health Companies */}
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <h2 className="text-sm font-semibold text-gray-800 mb-4">Lowest Health Companies</h2>
          {lowestHealthCompanies.length === 0 ? (
            <p className="text-sm text-gray-400">No companies scored yet</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                    <th className="pb-2 font-medium">Company</th>
                    <th className="pb-2 font-medium text-right">Health</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {lowestHealthCompanies.map(c => (
                    <tr key={c.companyId} className="hover:bg-gray-50 transition-colors">
                      <td className="py-2 text-gray-800 font-medium truncate max-w-[200px]">{c.companyName}</td>
                      <td className="py-2 text-right">
                        <span className={`font-semibold ${c.healthScore >= 70 ? 'text-emerald-600' : c.healthScore >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                          {c.healthScore}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Recent Conflicts */}
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <h2 className="text-sm font-semibold text-gray-800 mb-4">Recent Conflicts</h2>
          {recentConflicts.length === 0 ? (
            <p className="text-sm text-gray-400">No open conflicts detected</p>
          ) : (
            <div className="space-y-2">
              {recentConflicts.map(c => (
                <div key={c.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors">
                  <AlertTriangle className="w-4 h-4 text-orange-500 mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-800 truncate">{c.companyName}</span>
                      <SeverityBadge severity={c.severity} />
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5 truncate">{c.conflictType.replace(/_/g, ' ')}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}