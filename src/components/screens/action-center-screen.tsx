'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Zap, Target, Users, Map, ShieldCheck, ArrowRight,
  Loader2, Building2, RefreshCw, ChevronDown, ChevronUp,
  Clock, AlertCircle, CheckCircle2, Eye, Copy, ExternalLink,
  Brain, Crosshair, MessageSquare, BarChart3, UserCheck,
  Briefcase, Search, FileText, TrendingUp,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';

/* ═══════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════ */

interface CompanyOption {
  id: string;
  name: string;
  domain: string | null;
  industry: string | null;
  sizeRange: string | null;
}

interface ActionResponse {
  actionType: string;
  summary: string;
  content: Record<string, unknown>;
  priorityScore: number;
  confidence: number;
  evidenceReferences: Array<{ type: string; id: string; snippet: string }>;
  sourceSignalCount: number;
  sourceContactCount: number;
}

interface Sprint3Response {
  company: { id: string; name: string; industry: string | null; sizeRange: string | null; country: string | null };
  context: { signalCount: number; contactCount: number; evidenceCount: number; insightCount: number };
  actions: ActionResponse[];
  meta: { pipelineLatencyMs: number; aiModelUsed: boolean; actionsGenerated: number; errors: string[] };
}

/* ═══════════════════════════════════════════════════════════════
   Constants
   ═══════════════════════════════════════════════════════════════ */

const ACTION_CONFIG: Record<string, {
  label: string;
  description: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  borderColor: string;
}> = {
  meeting_prep: {
    label: 'Meeting Prep Brief',
    description: 'Executive summary, talking points, and discovery questions',
    icon: Briefcase,
    color: 'text-violet-700',
    bgColor: 'bg-violet-50',
    borderColor: 'border-violet-200',
  },
  executive_outreach: {
    label: 'Executive Outreach',
    description: 'Who to approach, why, and personalized messaging',
    icon: UserCheck,
    color: 'text-blue-700',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
  },
  account_strategy: {
    label: 'Account Strategy',
    description: 'Business priorities, solution alignment, and risks',
    icon: Target,
    color: 'text-emerald-700',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
  },
  stakeholder_map: {
    label: 'Stakeholder Map',
    description: 'Decision makers, influencers, and relationships',
    icon: Users,
    color: 'text-amber-700',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
  },
  opportunity_qualification: {
    label: 'Opportunity Qualification',
    description: 'Buying signals, timing, strategic fit, and confidence',
    icon: ShieldCheck,
    color: 'text-sky-700',
    bgColor: 'bg-sky-50',
    borderColor: 'border-sky-200',
  },
  next_best_action: {
    label: 'Next Best Action',
    description: 'What should the salesperson do next and why?',
    icon: Zap,
    color: 'text-orange-700',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
  },
};

const ACTION_ORDER = [
  'next_best_action',
  'meeting_prep',
  'executive_outreach',
  'account_strategy',
  'stakeholder_map',
  'opportunity_qualification',
];

/* ═══════════════════════════════════════════════════════════════
   Component
   ═══════════════════════════════════════════════════════════════ */

export default function ActionCenterScreen() {
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCompany, setSelectedCompany] = useState<CompanyOption | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState('');
  const [result, setResult] = useState<Sprint3Response | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedCard, setExpandedCard] = useState<string | null>('next_best_action');
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Fetch companies
  useEffect(() => {
    fetch('/api/companies?limit=200&fields=id,rawName,domain,industry,sizeRange')
      .then(r => r.json())
      .then(data => {
        const list = Array.isArray(data) ? data : data.companies || [];
        setCompanies(list.map((c: any) => ({
          id: c.id,
          name: c.rawName || c.name,
          domain: c.domain,
          industry: c.industry,
          sizeRange: c.sizeRange,
        })));
      })
      .catch(() => {});
  }, []);

  const filteredCompanies = companies.filter(c => {
    const q = searchQuery.toLowerCase();
    return !q || c.name.toLowerCase().includes(q) || (c.domain || '').toLowerCase().includes(q) || (c.industry || '').toLowerCase().includes(q);
  }).slice(0, 20);

  const handleGenerate = useCallback(async () => {
    if (!selectedCompany || generating) return;
    setGenerating(true);
    setError(null);
    setProgress('Gathering intelligence context...');
    setResult(null);

    try {
      const res = await fetch('/api/intelligence/sprint3/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId: selectedCompany.id }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || `HTTP ${res.status}`);
      }

      setProgress('AI is analyzing signals and generating actions...');
      const data: Sprint3Response = await res.json();

      if (data.meta.errors.length > 0) {
        setError(`${data.meta.errors.length} module(s) had issues. Showing ${data.actions.length}/6 actions.`);
      }

      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setGenerating(false);
      setProgress('');
    }
  }, [selectedCompany, generating]);

  const handleLoadCached = useCallback(async () => {
    if (!selectedCompany || loading) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/intelligence/sprint3/actions?companyId=${selectedCompany.id}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      if (data.actions && data.actions.length > 0) {
        setResult({
          company: data.company,
          context: { signalCount: 0, contactCount: 0, evidenceCount: 0, insightCount: 0 },
          actions: data.actions,
          meta: { pipelineLatencyMs: 0, aiModelUsed: true, actionsGenerated: data.actions.length, errors: [] },
        });
      } else {
        setError('No cached actions found. Click "Generate Actions" to create new ones.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load cached actions');
    } finally {
      setLoading(false);
    }
  }, [selectedCompany, loading]);

  const toggleCard = (actionType: string) => {
    setExpandedCard(prev => prev === actionType ? null : actionType);
  };

  const copyToClipboard = (text: string, fieldId: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopiedField(fieldId);
    setTimeout(() => setCopiedField(null), 2000);
  };

  /* ─── Render Helpers ────────────────────────────────────────── */

  function renderContentBlock(key: string, value: unknown, depth: number = 0): React.ReactNode {
    if (value === null || value === undefined) return null;

    if (typeof value === 'string') {
      return (
        <div key={key} className={depth > 0 ? 'ml-4 mt-1' : 'mt-2'}>
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
          <p className="text-sm text-gray-700 mt-0.5">{value}</p>
        </div>
      );
    }

    if (typeof value === 'number') {
      return (
        <div key={key} className="flex items-center gap-2 mt-1">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
          <span className="text-sm font-semibold text-gray-800">{value}</span>
        </div>
      );
    }

    if (typeof value === 'boolean') {
      return (
        <div key={key} className="flex items-center gap-2 mt-1">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
          {value ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> : <AlertCircle className="w-3.5 h-3.5 text-gray-400" />}
        </div>
      );
    }

    if (Array.isArray(value)) {
      if (value.length === 0) return null;
      return (
        <div key={key} className="mt-2">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
          <div className="mt-1 space-y-1.5">
            {value.map((item, idx) => {
              if (typeof item === 'object' && item !== null) {
                return (
                  <div key={idx} className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                    {renderObjectContent(item as Record<string, unknown>, depth + 1)}
                  </div>
                );
              }
              return (
                <div key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                  <span className="text-gray-400 mt-0.5">•</span>
                  <span>{String(item)}</span>
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    if (typeof value === 'object') {
      return (
        <div key={key} className="mt-2">
          {renderObjectContent(value as Record<string, unknown>, depth)}
        </div>
      );
    }

    return null;
  }

  function renderObjectContent(obj: Record<string, unknown>, depth: number = 0): React.ReactNode {
    return Object.entries(obj).map(([key, value]) => (
      <div key={key}>{renderContentBlock(key, value, depth)}</div>
    ));
  }

  function renderActionCard(action: ActionResponse) {
    const config = ACTION_CONFIG[action.actionType] || ACTION_CONFIG.meeting_prep;
    const Icon = config.icon;
    const isExpanded = expandedCard === action.actionType;
    const isNBA = action.actionType === 'next_best_action';

    return (
      <Card
        key={action.actionType}
        className={`${isNBA ? 'ring-2 ring-orange-200 shadow-md' : ''} hover:shadow-md transition-all duration-200 cursor-pointer`}
        onClick={() => toggleCard(action.actionType)}
      >
        <CardContent className="p-4">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <div className={`w-9 h-9 rounded-lg ${config.bgColor} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                <Icon className={`w-4.5 h-4.5 ${config.color}`} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-gray-900 truncate">{config.label}</h3>
                  {isNBA && (
                    <Badge className="bg-orange-100 text-orange-700 text-[11px] px-1.5 py-0 border-orange-200 h-4">
                      PRIORITY
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{config.description}</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <div className="flex items-center gap-1">
                <div className={`w-16 h-1.5 rounded-full overflow-hidden bg-gray-100`}>
                  <div
                    className={`h-full rounded-full transition-all ${
                      action.confidence >= 0.8 ? 'bg-green-500' :
                      action.confidence >= 0.6 ? 'bg-amber-500' : 'bg-gray-400'
                    }`}
                    style={{ width: `${Math.round(action.confidence * 100)}%` }}
                  />
                </div>
                <span className="text-[11px] text-gray-400 font-medium">{Math.round(action.confidence * 100)}%</span>
              </div>
              {isExpanded ? (
                <ChevronUp className="w-4 h-4 text-gray-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-gray-400" />
              )}
            </div>
          </div>

          {/* Summary */}
          <div className="mt-3">
            <p className={`text-sm ${isNBA ? 'font-medium text-gray-900' : 'text-gray-700'} line-clamp-2`}>
              {action.summary}
            </p>
          </div>

          {/* Expanded Content */}
          {isExpanded && (
            <div className="mt-3 pt-3 border-t border-gray-100" onClick={(e) => e.stopPropagation()} aria-hidden="true">
              <div className="space-y-1">
                {renderObjectContent(action.content)}
              </div>
              {/* Evidence References */}
              {action.evidenceReferences && action.evidenceReferences.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <div className="flex items-center gap-1.5 mb-2">
                    <FileText className="w-3.5 h-3.5 text-gray-400" />
                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Evidence References</span>
                  </div>
                  <div className="space-y-1">
                    {action.evidenceReferences.slice(0, 5).map((ref, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-xs text-gray-600 bg-gray-50 rounded px-2 py-1.5">
                        <Badge className="text-[9px] px-1 py-0 bg-gray-200 text-gray-600 border-0 h-4">{ref.type}</Badge>
                        <span className="truncate">{ref.snippet || ref.id}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* Copy button */}
              <div className="mt-3 flex justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs h-7 gap-1.5"
                  onClick={(e) => {
                    e.stopPropagation();
                    copyToClipboard(JSON.stringify(action.content, null, 2), action.actionType);
                  }}
                >
                  {copiedField === action.actionType ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-gray-400" />
                  )}
                  {copiedField === action.actionType ? 'Copied' : 'Copy JSON'}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  /* ─── Main Render ───────────────────────────────────────────── */

  return (
    <div className="space-y-6 p-1">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-gray-900">Action Center</h1>
              <p className="text-xs text-gray-500">Sprint 3 — Intelligence to Outcomes</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="bg-orange-100 text-orange-700 text-xs px-2 py-0.5 border-orange-200">
            Sprint 3
          </Badge>
        </div>
      </div>

      {/* Company Selector */}
      <Card className="border-gray-200">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search companies..."
                className="pl-9 h-9 text-sm"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && filteredCompanies.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto">
                  {filteredCompanies.map(c => (
                    <button
                      key={c.id}
                      className="w-full text-left px-3 py-2.5 hover:bg-gray-50 flex items-center gap-3 text-sm border-b border-gray-50 last:border-0"
                      onClick={() => {
                        setSelectedCompany(c);
                        setSearchQuery('');
                        setResult(null);
                        setError(null);
                      }}
                    >
                      <Building2 className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <span className="text-gray-900 font-medium">{c.name}</span>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          {c.industry && <span>{c.industry}</span>}
                          {c.sizeRange && <span>• {c.sizeRange}</span>}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleLoadCached}
                disabled={!selectedCompany || loading}
                variant="outline"
                className="h-9 text-sm gap-1.5"
              >
                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Eye className="w-3.5 h-3.5" />}
                Load Cached
              </Button>
              <Button
                onClick={handleGenerate}
                disabled={!selectedCompany || generating}
                className="h-9 text-sm gap-1.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white"
              >
                {generating ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Brain className="w-3.5 h-3.5" />
                )}
                {generating ? 'Generating...' : 'Generate Actions'}
              </Button>
            </div>
          </div>

          {/* Selected company indicator */}
          {selectedCompany && (
            <div className="mt-2.5 flex items-center gap-2 text-xs text-gray-600">
              <Building2 className="w-3.5 h-3.5 text-gray-400" />
              <span className="font-medium text-gray-800">{selectedCompany.name}</span>
              {selectedCompany.industry && <span className="text-gray-400">•</span>}
              {selectedCompany.industry && <span>{selectedCompany.industry}</span>}
              {selectedCompany.sizeRange && <span className="text-gray-400">•</span>}
              {selectedCompany.sizeRange && <span>{selectedCompany.sizeRange}</span>}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Progress indicator */}
      {generating && (
        <Card className="border-orange-200 bg-orange-50/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-8 h-8 rounded-full border-2 border-orange-300 border-t-orange-500 animate-spin" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-800">Generating Action Artifacts</p>
                <p className="text-xs text-gray-500 mt-0.5">{progress}</p>
              </div>
            </div>
            <div className="mt-3 flex gap-1.5">
              {ACTION_ORDER.map((type, idx) => {
                const config = ACTION_CONFIG[type];
                return (
                  <div key={type} className="flex-1">
                    <div className={`h-1 rounded-full transition-all duration-700 ${
                      idx < 1 ? 'bg-orange-400' : idx < 3 ? 'bg-orange-300' : 'bg-gray-200'
                    }`} />
                    <p className={`text-[9px] mt-1 ${idx < 1 ? 'text-orange-600 font-medium' : 'text-gray-400'}`}>
                      {config.label.split(' ')[0]}
                    </p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error */}
      {error && (
        <Card className="border-red-200 bg-red-50/50">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Context summary */}
      {result && !generating && (
        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-50 rounded-lg border border-gray-100">
            <Crosshair className="w-3 h-3 text-gray-400" />
            <span className="text-gray-600"><span className="font-semibold text-gray-800">{result.context.signalCount}</span> signals</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-50 rounded-lg border border-gray-100">
            <Users className="w-3 h-3 text-gray-400" />
            <span className="text-gray-600"><span className="font-semibold text-gray-800">{result.context.contactCount}</span> contacts</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-50 rounded-lg border border-gray-100">
            <FileText className="w-3 h-3 text-gray-400" />
            <span className="text-gray-600"><span className="font-semibold text-gray-800">{result.context.evidenceCount}</span> evidence</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-50 rounded-lg border border-gray-100">
            <Brain className="w-3 h-3 text-gray-400" />
            <span className="text-gray-600"><span className="font-semibold text-gray-800">{result.context.insightCount}</span> insights</span>
          </div>
          <div className="ml-auto text-gray-400">
            {result.meta.pipelineLatencyMs > 0 && `${(result.meta.pipelineLatencyMs / 1000).toFixed(1)}s`}
          </div>
        </div>
      )}

      {/* Action Cards Grid */}
      {result && result.actions.length > 0 && !generating && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {ACTION_ORDER.map(actionType => {
            const action = result.actions.find(a => a.actionType === actionType);
            if (!action) {
              const config = ACTION_CONFIG[actionType];
              const Icon = config.icon;
              return (
                <Card key={actionType} className="border-dashed border-gray-200 opacity-60">
                  <CardContent className="p-4 flex items-center justify-center gap-3 min-h-[100px]">
                    <Icon className={`w-5 h-5 ${config.color} opacity-40`} />
                    <div>
                      <p className="text-sm font-medium text-gray-400">{config.label}</p>
                      <p className="text-xs text-gray-400">Not generated</p>
                    </div>
                  </CardContent>
                </Card>
              );
            }
            return renderActionCard(action);
          })}
        </div>
      )}

      {/* Empty state */}
      {!result && !generating && !error && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-100 to-amber-100 flex items-center justify-center mb-4">
            <Zap className="w-8 h-8 text-orange-500" />
          </div>
          <h3 className="text-base font-semibold text-gray-800 mb-1">Action Center</h3>
          <p className="text-sm text-gray-500 max-w-md mb-1">
            DeepMindQ converts intelligence into outcomes. Select a company and generate
            actionable artifacts across 6 modules.
          </p>
          <p className="text-xs text-gray-400 max-w-sm">
            The Next Best Action answers: <span className="font-medium text-gray-600">"What should the salesperson do next and why?"</span>
          </p>
          <div className="mt-6 flex items-center gap-2 text-xs text-gray-400">
            <span className="px-2 py-1 bg-gray-50 rounded border border-gray-100">Meeting Prep</span>
            <span className="px-2 py-1 bg-gray-50 rounded border border-gray-100">Outreach</span>
            <span className="px-2 py-1 bg-gray-50 rounded border border-gray-100">Strategy</span>
            <span className="px-2 py-1 bg-gray-50 rounded border border-gray-100">Stakeholders</span>
            <span className="px-2 py-1 bg-gray-50 rounded border border-gray-100">Qualification</span>
            <span className="px-2 py-1 bg-orange-50 rounded border border-orange-200 text-orange-600 font-medium">Next Best Action</span>
          </div>
        </div>
      )}
    </div>
  );
}
