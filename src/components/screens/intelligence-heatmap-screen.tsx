'use client';

/**
 * Phase 3 — Item 5.5: Intelligence Coverage Heatmap
 *
 * Admin screen showing a Companies × Intelligence Dimensions matrix.
 * Each cell shows a confidence score colored by value (red→yellow→green).
 *
 * Consumes: GET /api/intelligence/heatmap?industry=xxx&minScore=xxx&limit=xxx
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Grid3x3,
  RefreshCw,
  Filter,
  ArrowUpDown,
  Search,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { EnterpriseLoading, EnterpriseEmptyState } from '@/components/enterprise';

// ── Types ──

interface HeatmapCell {
  companyId: string;
  companyName: string;
  industry: string;
  domain: string;
  intelligenceScore: number;
  dimensions: Record<string, number>;
}

interface HeatmapResponse {
  success: boolean;
  data: HeatmapCell[];
  meta: { total: number; limit: number; filtered: number };
}

const DIMENSIONS = [
  { key: 'data_quality', label: 'Data Quality' },
  { key: 'source_reliability', label: 'Source Reliability' },
  { key: 'freshness', label: 'Freshness' },
  { key: 'cross_validation', label: 'Cross Validation' },
  { key: 'evidence_coverage', label: 'Evidence Coverage' },
  { key: 'ai_certainty', label: 'AI Certainty' },
] as const;

const PAGE_SIZE = 20;

function getScoreColor(score: number): string {
  if (score >= 70) return 'bg-emerald-500';
  if (score >= 50) return 'bg-emerald-400';
  if (score >= 35) return 'bg-yellow-400';
  if (score >= 20) return 'bg-amber-400';
  return 'bg-red-400';
}

function getScoreTextColor(score: number): string {
  return score >= 50 ? 'text-white' : score >= 35 ? 'text-gray-900' : 'text-white';
}

function getScoreBadgeVariant(score: number): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (score >= 70) return 'default';
  if (score >= 50) return 'secondary';
  return 'destructive';
}

// ── Component ──

export function IntelligenceHeatmapScreen() {
  const [companies, setCompanies] = useState<HeatmapCell[]>([]);
  const [loading, setLoading] = useState(true);
  const [industry, setIndustry] = useState('');
  const [minScore, setMinScore] = useState('0');
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [sortDimension, setSortDimension] = useState<string>('intelligenceScore');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const fetchHeatmap = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (industry) params.set('industry', industry);
      if (minScore && parseInt(minScore) > 0) params.set('minScore', minScore);
      params.set('limit', '200');

      const res = await fetch(`/api/intelligence/heatmap?${params}`);
      if (res.ok) {
        const json: HeatmapResponse = await res.json();
        setCompanies(json.data || []);
        setTotal(json.meta?.total || 0);
      }
    } catch (err) {
      console.warn('Failed to fetch heatmap:', err);
    }
    setLoading(false);
    setLastRefreshed(new Date());
  }, [industry, minScore]);

  useEffect(() => {
    fetchHeatmap();
  }, [fetchHeatmap]);

  const sortedCompanies = useMemo(() => {
    return [...companies].sort((a, b) => {
      let valA: number, valB: number;
      if (sortDimension === 'intelligenceScore') {
        valA = a.intelligenceScore;
        valB = b.intelligenceScore;
      } else {
        valA = a.dimensions[sortDimension] ?? 0;
        valB = b.dimensions[sortDimension] ?? 0;
      }
      return sortDir === 'desc' ? valB - valA : valA - valB;
    });
  }, [companies, sortDimension, sortDir]);

  const pagedCompanies = sortedCompanies.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(sortedCompanies.length / PAGE_SIZE);

  const handleSort = (dim: string) => {
    if (sortDimension === dim) {
      setSortDir(prev => prev === 'desc' ? 'asc' : 'desc');
    } else {
      setSortDimension(dim);
      setSortDir('desc');
    }
    setPage(0);
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Grid3x3 className="w-6 h-6" />
            Intelligence Coverage Heatmap
          </h1>
          <p className="text-sm text-[var(--primary-dim)] mt-1">
            Companies × Intelligence Dimensions matrix — identify coverage gaps at a glance
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-[var(--primary-dim)]">
            {lastRefreshed ? `Updated: ${lastRefreshed.toLocaleTimeString()}` : ''}
          </span>
          <Button variant="outline" size="sm" onClick={fetchHeatmap} disabled={loading}>
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-[var(--primary-dim)]" />
              <span className="text-xs font-medium">Filters:</span>
            </div>
            <Input
              placeholder="Industry filter..."
              value={industry}
              onChange={e => { setIndustry(e.target.value); setPage(0); }}
              className="w-48 h-10 text-xs"
            />
            <Input
              placeholder="Min score"
              type="number"
              min="0"
              max="100"
              value={minScore}
              onChange={e => { setMinScore(e.target.value); setPage(0); }}
              className="w-28 h-10 text-xs"
            />
            <Badge variant="outline" className="text-xs">
              {companies.length} companies
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Heatmap Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left p-3 font-medium sticky left-0 bg-muted/30 min-w-[180px]">
                    Company
                  </th>
                  <th
                    className="p-3 font-medium cursor-pointer hover:bg-muted/50 min-w-[60px]"
                    onClick={() => handleSort('intelligenceScore')}
                  >
                    <div className="flex items-center gap-1">
                      <ArrowUpDown className="w-3 h-3" />
                      Score
                    </div>
                  </th>
                  {DIMENSIONS.map(dim => (
                    <th
                      key={dim.key}
                      className="p-3 font-medium cursor-pointer hover:bg-muted/50 min-w-[70px]"
                      onClick={() => handleSort(dim.key)}
                    >
                      <div className="flex items-center gap-1">
                        <ArrowUpDown className="w-3 h-3" />
                        {dim.label}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={DIMENSIONS.length + 2} className="text-center p-8">
                      <EnterpriseLoading message="Loading heatmap data..." size="sm" />
                    </td>
                  </tr>
                ) : pagedCompanies.length === 0 ? (
                  <tr>
                    <td colSpan={DIMENSIONS.length + 2} className="text-center p-8">
                      <EnterpriseEmptyState
                        icon={Search}
                        title="No companies match the current filters"
                        description="Try adjusting your industry or score filters to see results."
                      />
                    </td>
                  </tr>
                ) : (
                  pagedCompanies.map(company => (
                    <tr key={company.companyId} className="border-b hover:bg-muted/20 transition-colors">
                      <td className="p-3 sticky left-0 bg-white">
                        <div className="font-medium text-xs">{company.companyName}</div>
                        <div className="text-[10px] text-[var(--primary-dim)]">{company.industry || company.domain}</div>
                      </td>
                      <td className="p-3">
                        <div
                          className={`inline-flex items-center justify-center w-10 h-6 rounded text-[10px] font-bold ${getScoreColor(company.intelligenceScore)} ${getScoreTextColor(company.intelligenceScore)}`}
                        >
                          {company.intelligenceScore}
                        </div>
                      </td>
                      {DIMENSIONS.map(dim => {
                        const score = company.dimensions[dim.key] ?? 0;
                        return (
                          <td key={dim.key} className="p-1.5">
                            <div
                              className={`inline-flex items-center justify-center w-full h-6 rounded text-[10px] font-medium ${getScoreColor(score)} ${getScoreTextColor(score)} cursor-default`}
                              title={`${dim.label}: ${score}/100`}
                            >
                              {score}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between p-3 border-t">
              <div className="text-xs text-[var(--primary-dim)]">
                Page {page + 1} of {totalPages} ({companies.length} companies)
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-10 text-xs min-h-[44px]"
                  disabled={page === 0}
                  onClick={() => setPage(p => p - 1)}
                >
                  <ChevronLeft className="w-3 h-3" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-10 text-xs min-h-[44px]"
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage(p => p + 1)}
                >
                  <ChevronRight className="w-3 h-3" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-[var(--primary-dim)]">
        <span>Legend:</span>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-3 rounded bg-red-400" /> 0-19
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-3 rounded bg-amber-400" /> 20-34
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-3 rounded bg-yellow-400" /> 35-49
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-3 rounded bg-emerald-400" /> 50-69
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-3 rounded bg-emerald-500" /> 70-100
        </div>
      </div>
    </div>
  );
}
