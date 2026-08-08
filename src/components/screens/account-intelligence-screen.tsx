'use client';

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useAppStore } from '@/lib/store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import {
  Search, Target, Zap, MessageSquare, Shield, Brain,
  ChevronDown, ChevronUp, Loader2, Building2, ArrowRight,
  AlertTriangle, CheckCircle2, Clock, TrendingUp, Users,
  Activity, BarChart3, User, FileText, Sparkles,
} from 'lucide-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { SkeletonCard } from '@/components/loading';

// ─── Types ──────────────────────────────────────────────────────────────

interface Company {
  id: string;
  rawName: string;
  normalizedName?: string;
  domain?: string;
  industry?: string;
  sizeRange?: string;
  status?: string;
  intelligenceScore?: number;
}

interface CompanySignal {
  id: string;
  title?: string;
  signalType: string;
  severity?: string;
  createdAt: string;
  businessImpact?: string;
  description?: string;
}

interface Contact {
  id: string;
  rawName: string;
  title?: string;
  leadScore?: number;
  status?: string;
}

interface ScoreFactor {
  dimension: string;
  label: string;
  points: number;
  maxPoints: number;
  evidence: string;
  source: string;
}

interface ScoreResult {
  success: boolean;
  error?: string | null;
  companyId: string;
  companyName: string;
  score: number;
  grade: string;
  priorityTier: string;
  confidence: number;
  factors: ScoreFactor[];
  breakdownText: string;
  narrative: string | null;
  recommendedAction: string;
  nextBestActions: string[];
  timingWindow: string;
  evidenceCount: number;
  signalCount: number;
  scoredAt: string;
  durationMs: number;
}

interface RecommendedAction {
  id: string;
  type: string;
  title: string;
  reason: string;
  concreteStep: string;
  suggestedMessage: string | null;
  targetContact: string | null;
  salesMotion: string;
  urgency: string;
  impactScore: number;
  evidence: string[];
  confidence: number;
}

interface ActionResult {
  success: boolean;
  error?: string | null;
  companyName: string;
  primaryAction: RecommendedAction | null;
  actions: RecommendedAction[];
  detectedSalesMotion: string;
  accountStrategy: string | null;
  riskActions: RecommendedAction[];
  currentScore: number | null;
  strategyNarrative: string | null;
}

// ─── Grade Colors ────────────────────────────────────────────────────────

const gradeColors: Record<string, string> = {
  A: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  B: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  C: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  D: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  F: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
};

const priorityColors: Record<string, string> = {
  critical: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  high: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  medium: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  low: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  nurture: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500',
};

const urgencyColors: Record<string, string> = {
  immediate: 'text-red-600 bg-red-50 dark:bg-red-950',
  this_week: 'text-amber-600 bg-amber-50 dark:bg-amber-950',
  this_month: 'text-blue-600 bg-blue-50 dark:bg-blue-950',
  this_quarter: 'text-gray-600 bg-gray-50 dark:bg-gray-950',
  when_ready: 'text-gray-500 bg-gray-50 dark:bg-gray-950',
};

// ─── Component ──────────────────────────────────────────────────────────

export default function AccountIntelligenceScreen() {
  const { selectedCompanyId, setSelectedCompanyId, setActiveView } = useAppStore();
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const [expandedActions, setExpandedActions] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    setExpandedActions(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  };

  // Fetch companies
  const { data: companies, isLoading: loadingCompanies } = useQuery({
    queryKey: ['account-intelligence-companies'],
    queryFn: async () => {
      const res = await fetch('/api/companies?limit=50&sortBy=updatedAt');
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      return (data.companies || data || []) as Company[];
    },
    staleTime: 60_000,
  });

  // Fetch company details
  const { data: company } = useQuery({
    queryKey: ['account-intelligence-company', selectedCompanyId],
    queryFn: async () => {
      if (!selectedCompanyId) return null;
      const res = await fetch(`/api/companies/${selectedCompanyId}`);
      if (!res.ok) return null;
      return res.json() as Promise<Company>;
    },
    enabled: !!selectedCompanyId,
    staleTime: 60_000,
  });

  // Fetch signals
  const { data: signals } = useQuery({
    queryKey: ['account-intelligence-signals', selectedCompanyId],
    queryFn: async () => {
      if (!selectedCompanyId) return [];
      const res = await fetch(`/api/companies/${selectedCompanyId}/signals`);
      if (!res.ok) return [];
      const data = await res.json();
      return (data.signals || data || []) as CompanySignal[];
    },
    enabled: !!selectedCompanyId,
    staleTime: 60_000,
  });

  // Fetch contacts
  const { data: contacts } = useQuery({
    queryKey: ['account-intelligence-contacts', selectedCompanyId],
    queryFn: async () => {
      if (!selectedCompanyId) return [];
      const res = await fetch(`/api/companies/${selectedCompanyId}/contacts`);
      if (!res.ok) return [];
      const data = await res.json();
      return (data.contacts || data || []) as Contact[];
    },
    enabled: !!selectedCompanyId,
    staleTime: 60_000,
  });

  // Score mutation
  const scoreMutation = useMutation({
    mutationFn: async (companyId: string) => {
      const res = await fetch('/api/engines/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'single', companyId, skipNarrative: false }),
      });
      if (!res.ok) throw new Error('Failed to score');
      const data = await res.json();
      return data.score as ScoreResult;
    },
    onSuccess: () => {
      toast.success('Revenue Intelligence Score generated');
      setActiveTab('score');
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Scoring failed'),
  });

  // Actions mutation
  const actionsMutation = useMutation({
    mutationFn: async (companyId: string) => {
      const res = await fetch('/api/engines/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, skipNarrative: false }),
      });
      if (!res.ok) throw new Error('Failed to generate actions');
      const data = await res.json();
      return data.result as ActionResult;
    },
    onSuccess: () => {
      toast.success('Recommended actions generated');
      setActiveTab('actions');
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Action generation failed'),
  });

  const score = scoreMutation.data;
  const actions = actionsMutation.data;
  const selectedCompany = company || companies?.find(c => c.id === selectedCompanyId);

  const filteredCompanies = (companies || []).filter(c => {
    const name = c.normalizedName || c.rawName;
    return name.toLowerCase().includes(search.toLowerCase()) ||
           (c.industry || '').toLowerCase().includes(search.toLowerCase());
  });

  // ─── No company selected: Company selector ───
  if (!selectedCompanyId) {
    return (
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Target className="h-6 w-6 text-blue-600" />
            Account Intelligence
          </h1>
          <p className="text-muted-foreground mt-1">
            Full AI-powered intelligence workspace for every account
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Select a Company</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search companies..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="max-h-[500px] overflow-y-auto space-y-1">
              {loadingCompanies && (
                <div className="flex items-center gap-2 text-muted-foreground p-4">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading...
                </div>
              )}
              {filteredCompanies.length === 0 && !loadingCompanies && (
                <div className="text-center py-8 text-muted-foreground">
                  <Building2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>No companies found. Import companies to get started.</p>
                </div>
              )}
              {filteredCompanies.map(c => (
                <button
                  key={c.id}
                  onClick={() => { setSelectedCompanyId(c.id); scoreMutation.reset(); actionsMutation.reset(); }}
                  className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-accent transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="font-medium text-sm">{c.normalizedName || c.rawName}</div>
                      <div className="text-xs text-muted-foreground">{c.industry || 'No industry'}</div>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── Company selected: Full Intelligence Workspace ───
  const companyName = selectedCompany?.normalizedName || selectedCompany?.rawName || 'Unknown';

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <button
              onClick={() => { setSelectedCompanyId(null); scoreMutation.reset(); actionsMutation.reset(); }}
              className="hover:underline"
            >
              Account Intelligence
            </button>
            <span>/</span>
            <span className="text-foreground">{companyName}</span>
          </div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Target className="h-6 w-6 text-blue-600" />
            {companyName}
            {selectedCompany?.industry && (
              <Badge variant="outline" className="text-sm font-normal">{selectedCompany.industry}</Badge>
            )}
          </h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setSelectedCompanyId(null)}>
            Back to List
          </Button>
        </div>
      </div>

      {/* Score Summary Card */}
      <ErrorBoundary>
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Score Circle */}
        <Card className="lg:col-span-1">
          <CardContent className="p-6 flex flex-col items-center justify-center">
            {score && score.success ? (
              <>
                <div className={`w-24 h-24 rounded-full border-4 flex items-center justify-center text-3xl font-bold ${
                  score.score >= 85 ? 'border-green-500 text-green-600'
                  : score.score >= 70 ? 'border-blue-500 text-blue-600'
                  : score.score >= 55 ? 'border-amber-500 text-amber-600'
                  : score.score >= 35 ? 'border-orange-500 text-orange-600'
                  : 'border-gray-400 text-gray-500'
                }`}>
                  {score.score}
                </div>
                <div className="flex gap-2 mt-3">
                  <Badge className={gradeColors[score.grade] || ''}>{score.grade}</Badge>
                  <Badge className={priorityColors[score.priorityTier] || ''}>
                    {score.priorityTier}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground mt-2">
                  Confidence: {score.confidence}%
                </div>
              </>
            ) : (
              <div className="w-24 h-24 rounded-full border-4 border-dashed border-muted flex items-center justify-center">
                <span className="text-3xl font-bold text-muted-foreground/50">?</span>
              </div>
            )}
            <Button
              size="sm"
              variant="outline"
              className="mt-4 w-full"
              onClick={() => scoreMutation.mutate(selectedCompanyId)}
              disabled={scoreMutation.isPending}
            >
              {scoreMutation.isPending ? (
                <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Scoring...</>
              ) : score ? 'Re-score' : 'Generate Score'}
            </Button>
          </CardContent>
        </Card>

        {/* Quick Stats */}
        <div className="lg:col-span-3 grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/50">
                <Activity className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{signals?.length || 0}</div>
                <div className="text-xs text-muted-foreground">Total Signals</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/50">
                <Users className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{contacts?.length || 0}</div>
                <div className="text-xs text-muted-foreground">Stakeholders</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/50">
                <TrendingUp className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{selectedCompany?.intelligenceScore || 0}/5</div>
                <div className="text-xs text-muted-foreground">Data Enrichment</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/50">
                <Zap className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{actions?.actions?.length || 0}</div>
                <div className="text-xs text-muted-foreground">Actions Available</div>
              </div>
            </CardContent>
          </Card>

          {/* Generate Actions button area */}
          <div className="col-span-2 md:col-span-4">
            <Button
              onClick={() => actionsMutation.mutate(selectedCompanyId)}
              disabled={actionsMutation.isPending}
              className="w-full"
            >
              {actionsMutation.isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Analyzing account for recommended actions...</>
              ) : (
                <><Sparkles className="h-4 w-4 mr-2" /> Generate AI Actions</>
              )}
            </Button>
          </div>
        </div>
      </div>
      </ErrorBoundary>

      {/* Tabs */}
      <ErrorBoundary>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="score">Score</TabsTrigger>
          <TabsTrigger value="actions">Actions</TabsTrigger>
        </TabsList>

        {/* ─── Overview Tab ─── */}
        <TabsContent value="overview" className="space-y-6 mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Signals */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Activity className="h-4 w-4 text-blue-600" />
                  Recent Signals
                  <Badge variant="secondary" className="text-xs ml-auto">{signals?.length || 0}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {(!signals || signals.length === 0) && (
                  <p className="text-sm text-muted-foreground text-center py-4">No signals detected for this account</p>
                )}
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {signals?.slice(0, 15).map((signal, i) => (
                    <div key={signal.id || i} className="flex items-start gap-2 p-2 rounded-lg hover:bg-accent/50">
                      <Badge variant="outline" className="text-xs capitalize flex-shrink-0 mt-0.5">
                        {signal.signalType?.replace('_', ' ') || 'signal'}
                      </Badge>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate">{signal.title || 'Signal'}</div>
                        {signal.businessImpact && (
                          <div className="text-xs text-muted-foreground truncate">{signal.businessImpact}</div>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground flex-shrink-0">
                        {new Date(signal.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Contacts */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-4 w-4 text-green-600" />
                  Stakeholders
                  <Badge variant="secondary" className="text-xs ml-auto">{contacts?.length || 0}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {(!contacts || contacts.length === 0) && (
                  <p className="text-sm text-muted-foreground text-center py-4">No contacts tracked for this account</p>
                )}
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {contacts?.slice(0, 15).map((contact, i) => (
                    <button
                      key={contact.id || i}
                      onClick={() => {
                        setActiveView('contact-detail');
                        (useAppStore.getState() as any).setSelectedContactId?.(contact.id);
                      }}
                      className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-accent transition-colors text-left"
                    >
                      <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium">{contact.rawName || 'Unknown'}</div>
                        <div className="text-xs text-muted-foreground">{contact.title || 'No title'}</div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {contact.leadScore !== undefined && contact.leadScore > 0 && (
                          <div className="w-12 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-500 rounded-full"
                              style={{ width: `${Math.min(100, contact.leadScore)}%` }}
                            />
                          </div>
                        )}
                        <Badge variant="outline" className="text-xs capitalize">{contact.status || 'prospect'}</Badge>
                      </div>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ─── Score Tab ─── */}
        <TabsContent value="score" className="space-y-6 mt-4">
          {!score && !scoreMutation.isPending && (
            <div className="text-center py-12">
              <BarChart3 className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
              <h3 className="font-medium text-muted-foreground">No score generated yet</h3>
              <p className="text-sm text-muted-foreground mt-1">Click &quot;Generate Score&quot; to analyze this account</p>
            </div>
          )}

          {scoreMutation.isPending && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2, 3].map(i => (
                <SkeletonCard key={i} />
              ))}
            </div>
          )}

          {score && score.success && (
            <div className="space-y-6">
              {/* Score summary bar */}
              <Card className="border-blue-200 dark:border-blue-800">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    <div>
                      <div className="text-lg font-bold">{companyName}</div>
                      <div className="text-sm text-muted-foreground">
                        {score.evidenceCount} evidence sources, {score.signalCount} signals
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="text-3xl font-bold">{score.score}/100</div>
                        <div className="text-xs text-muted-foreground">Scored {new Date(score.scoredAt).toLocaleString()}</div>
                      </div>
                      <Badge className={`text-sm px-3 py-1 ${gradeColors[score.grade]}`}>{score.grade}</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* AI Narrative */}
              {score.narrative && (
                <Card className="border-purple-200 dark:border-purple-800">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <Brain className="h-5 w-5 text-purple-600" />
                      <span className="font-semibold text-sm">AI Score Explanation</span>
                    </div>
                    <p className="text-sm leading-relaxed">{score.narrative}</p>
                  </CardContent>
                </Card>
              )}

              {/* Factor Breakdown */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" />
                    Score Breakdown
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {score.factors.map((factor, i) => {
                      const widthPct = (Math.abs(factor.points) / factor.maxPoints) * 100;
                      return (
                        <div key={i} className="space-y-1">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">{factor.label}</span>
                              <span className={`text-sm font-bold ${factor.points > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {factor.points > 0 ? '+' : ''}{factor.points}
                              </span>
                            </div>
                            <span className="text-xs text-muted-foreground">max {factor.maxPoints}</span>
                          </div>
                          <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                factor.points > 0 ? 'bg-green-500' : 'bg-red-500'
                              }`}
                              style={{ width: `${Math.min(100, widthPct)}%` }}
                            />
                          </div>
                          <div className="text-xs text-muted-foreground">{factor.evidence}</div>
                        </div>
                      );
                    })}
                  </div>

                  {score.breakdownText && (
                    <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                      <div className="text-xs font-medium text-muted-foreground mb-1">Summary</div>
                      <div className="text-xs text-muted-foreground">{score.breakdownText}</div>
                    </div>
                  )}

                  {score.nextBestActions.length > 0 && (
                    <div className="mt-4">
                      <div className="text-sm font-medium mb-2">Recommended Next Steps</div>
                      <div className="space-y-1">
                        {score.nextBestActions.map((action, i) => (
                          <div key={i} className="flex items-start gap-2 text-sm">
                            <CheckCircle2 className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                            {action}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {score && !score.success && (
            <Card className="border-red-200">
              <CardContent className="p-6 text-center">
                <AlertTriangle className="h-8 w-8 text-red-500 mx-auto mb-3" />
                <p className="font-medium text-red-600">Scoring failed</p>
                <p className="text-sm text-muted-foreground mt-1">{score.error}</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ─── Actions Tab ─── */}
        <TabsContent value="actions" className="space-y-6 mt-4">
          {!actions && !actionsMutation.isPending && (
            <div className="text-center py-12">
              <Zap className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
              <h3 className="font-medium text-muted-foreground">No actions generated yet</h3>
              <p className="text-sm text-muted-foreground mt-1">Click &quot;Generate AI Actions&quot; to get recommendations</p>
            </div>
          )}

          {actionsMutation.isPending && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2, 3].map(i => (
                <SkeletonCard key={i} />
              ))}
            </div>
          )}

          {actions && actions.success && (
            <div className="space-y-6">
              {/* Strategy Narrative */}
              {actions.strategyNarrative && (
                <Card className="border-blue-200 dark:border-blue-800">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <Brain className="h-5 w-5 text-blue-600" />
                      <span className="font-semibold text-sm">Account Strategy</span>
                      <Badge variant="outline" className="text-xs capitalize ml-auto">
                        {actions.detectedSalesMotion.replace('_', ' ')}
                      </Badge>
                    </div>
                    <p className="text-sm leading-relaxed">{actions.strategyNarrative}</p>
                  </CardContent>
                </Card>
              )}

              {/* Primary Action */}
              {actions.primaryAction && (
                <Card className="border-green-200 dark:border-green-800">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Zap className="h-4 w-4 text-green-600" />
                      Primary Recommendation
                      <Badge className={`text-xs ml-auto ${urgencyColors[actions.primaryAction.urgency] || ''}`}>
                        {actions.primaryAction.urgency.replace('_', ' ')}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <h3 className="text-lg font-semibold">{actions.primaryAction.title}</h3>
                    <p className="text-sm">{actions.primaryAction.reason}</p>
                    <Separator />
                    <div>
                      <div className="text-xs font-medium text-muted-foreground mb-1">Concrete Step</div>
                      <p className="text-sm">{actions.primaryAction.concreteStep}</p>
                    </div>
                    {actions.primaryAction.suggestedMessage && (
                      <div>
                        <div className="text-xs font-medium text-muted-foreground mb-1">Suggested Message</div>
                        <div className="p-3 bg-muted/50 rounded-lg text-sm italic">
                          &quot;{actions.primaryAction.suggestedMessage}&quot;
                        </div>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">Impact: {actions.primaryAction.impactScore}/100</Badge>
                      <Badge variant="outline" className="text-xs">Confidence: {actions.primaryAction.confidence}%</Badge>
                      {actions.primaryAction.targetContact && (
                        <Badge variant="outline" className="text-xs">Target: {actions.primaryAction.targetContact}</Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* All Actions */}
              {actions.actions.length > 1 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      All Recommended Actions
                      <Badge variant="secondary" className="text-xs ml-auto">{actions.actions.length}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {actions.actions.slice(1).map((action) => {
                      const isExpanded = expandedActions.has(action.id);
                      const isRisk = action.type === 'risk_mitigation';
                      return (
                        <div key={action.id} className={`border rounded-lg ${isRisk ? 'border-red-200 dark:border-red-800' : ''}`}>
                          <button
                            onClick={() => toggleExpand(action.id)}
                            className="w-full flex items-center justify-between p-3 text-left hover:bg-accent/50 transition-colors"
                          >
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              {isRisk && <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0" />}
                              <span className="text-sm font-medium truncate">{action.title}</span>
                              <Badge variant="outline" className={`text-xs capitalize flex-shrink-0 ${urgencyColors[action.urgency] || ''}`}>
                                {action.urgency.replace('_', ' ')}
                              </Badge>
                              <Badge variant="outline" className="text-xs flex-shrink-0">
                                {action.impactScore}/100
                              </Badge>
                            </div>
                            {isExpanded ? <ChevronUp className="h-4 w-4 flex-shrink-0" /> : <ChevronDown className="h-4 w-4 flex-shrink-0" />}
                          </button>
                          {isExpanded && (
                            <div className="px-3 pb-3 pt-0 space-y-2 border-t">
                              <div className="mt-2">
                                <div className="text-xs font-medium text-muted-foreground mb-1">Reason</div>
                                <p className="text-sm">{action.reason}</p>
                              </div>
                              <div>
                                <div className="text-xs font-medium text-muted-foreground mb-1">Concrete Step</div>
                                <p className="text-sm">{action.concreteStep}</p>
                              </div>
                              {action.suggestedMessage && (
                                <div>
                                  <div className="text-xs font-medium text-muted-foreground mb-1">Suggested Message</div>
                                  <div className="p-2 bg-muted/50 rounded text-sm italic">&quot;{action.suggestedMessage}&quot;</div>
                                </div>
                              )}
                              {action.evidence.length > 0 && (
                                <div>
                                  <div className="text-xs font-medium text-muted-foreground mb-1">Evidence</div>
                                  <div className="flex flex-wrap gap-1">
                                    {action.evidence.map((ev, i) => (
                                      <Badge key={i} variant="secondary" className="text-xs">{ev}</Badge>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {actions && !actions.success && (
            <Card className="border-red-200">
              <CardContent className="p-6 text-center">
                <AlertTriangle className="h-8 w-8 text-red-500 mx-auto mb-3" />
                <p className="font-medium text-red-600">Action generation failed</p>
                <p className="text-sm text-muted-foreground mt-1">{actions.error}</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
      </ErrorBoundary>
    </div>
  );
}
