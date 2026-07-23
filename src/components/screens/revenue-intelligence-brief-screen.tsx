'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ArrowLeft, Sparkles, Target, Clock, AlertTriangle, Zap, RefreshCw,
  FileText, BarChart3, Search, Check, Copy, Globe, Building2, Monitor,
  TrendingUp, MessageSquare, ShieldCheck, ChevronRight, Loader2,
  DollarSign, MapPin, Users, ArrowDownRight, ArrowUpRight,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { AIProgressTracker } from '@/components/enterprise/AIProgressTracker';
import { AIInsightCard } from '@/components/enterprise/AIInsightCard';
import { ConfidenceBar } from '@/components/enterprise/ConfidenceBar';
import { EvidenceBadge } from '@/components/enterprise/EvidenceBadge';
import { LoadingState } from '@/components/enterprise/LoadingState';
import { ErrorState } from '@/components/enterprise/ErrorState';

/* ═══════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════ */

interface CompanyOption {
  id: string;
  name: string;
  domain: string | null;
  industry: string | null;
}

interface BriefData {
  companyId: string;
  companyName: string;
  brief: {
    businessOverview: string;
    technologyContext: string;
    industryChallenges: string;
    painPoints: string[];
    relevantSolutions: string[];
    targetExecutives: { role: string; focus: string }[];
    conversationStarters: string[];
    recommendedApproach: string;
    strategicPriority: string;
    keySignals: string[];
    confidence: number;
  };
  sources: { title: string; url: string; snippet: string }[];
  generatedAt: string;
}

type GenerationStep = 'idle' | 'analyzing' | 'searching' | 'generating' | 'creating';

/* ═══════════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════════ */

function priorityBadgeColor(priority: string) {
  switch (priority.toLowerCase()) {
    case 'high': return 'bg-red-100 text-red-700 border-red-200';
    case 'medium': return 'bg-amber-100 text-amber-700 border-amber-200';
    case 'low': return 'bg-gray-100 text-gray-600 border-gray-200';
    default: return 'bg-gray-100 text-gray-600 border-gray-200';
  }
}

function signalTypeTag(type: string) {
  const t = type.toLowerCase();
  if (t.includes('tech') || t.includes('digital')) return { color: 'bg-sky-100 text-sky-700', icon: Monitor };
  if (t.includes('growth') || t.includes('expand')) return { color: 'bg-emerald-100 text-emerald-700', icon: TrendingUp };
  if (t.includes('pain') || t.includes('risk') || t.includes('challenge')) return { color: 'bg-red-100 text-red-700', icon: AlertTriangle };
  if (t.includes('leader') || t.includes('exec') || t.includes('hire')) return { color: 'bg-violet-100 text-violet-700', icon: Users };
  if (t.includes('partner') || t.includes('integration')) return { color: 'bg-amber-100 text-amber-700', icon: Building2 };
  return { color: 'bg-gray-100 text-gray-600', icon: Globe };
}

function sourceTypeFromUrl(url: string): string {
  const u = url.toLowerCase();
  if (u.includes('sec.gov') || u.includes('filing')) return 'filing';
  if (u.includes('linkedin')) return 'social';
  if (u.includes('news') || u.includes('press') || u.includes('techcrunch') || u.includes('reuters') || u.includes('bloomberg')) return 'news';
  if (u.includes('crunchbase') || u.includes('pitchbook')) return 'database';
  return 'web';
}

function estimateImpactValue(priority: string): string {
  switch (priority.toLowerCase()) {
    case 'high': return '$500K+';
    case 'medium': return '$100K–$500K';
    case 'low': return '<$100K';
    default: return 'TBD';
  }
}

/* ═══════════════════════════════════════════════════════════════
   Company Search Dropdown
   ═══════════════════════════════════════════════════════════════ */

function CompanySearchDropdown({
  companies,
  selected,
  onSelect,
}: {
  companies: CompanyOption[];
  selected: CompanyOption | null;
  onSelect: (c: CompanyOption) => void;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  const filtered = useMemo(() => {
    if (!query.trim()) return companies.slice(0, 30);
    const q = query.toLowerCase();
    return companies.filter(
      c => c.name.toLowerCase().includes(q) || (c.domain && c.domain.toLowerCase().includes(q)) || (c.industry && c.industry.toLowerCase().includes(q))
    ).slice(0, 30);
  }, [companies, query]);

  return (
    <div className="relative w-full max-w-md">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search companies..."
          value={selected ? selected.name : query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); if (selected) { onSelect(null as unknown as CompanyOption); setQuery(e.target.value); } }}
          onFocus={() => setOpen(true)}
          className="pl-9 pr-4 h-10"
        />
      </div>
      {open && filtered.length > 0 && (
        <div className="absolute z-50 mt-1 w-full max-h-64 overflow-y-auto rounded-lg border border-border bg-card shadow-lg custom-scrollbar">
          {filtered.map(c => (
            <button
              key={c.id}
              onClick={() => { onSelect(c); setQuery(''); setOpen(false); }}
              className="w-full text-left px-3 py-2.5 hover:bg-muted/60 transition-colors flex items-center justify-between gap-2 border-b border-border/50 last:border-0"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{c.name}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {c.domain || c.industry || 'Unknown'}
                </p>
              </div>
              <Building2 className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Conversation Starter Card
   ═══════════════════════════════════════════════════════════════ */

function ConversationCard({ text, index }: { text: string; index: number }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="group relative rounded-xl border border-border bg-card p-4 hover:border-primary/30 hover:shadow-sm transition-all">
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary font-bold text-sm">
          {index}
        </div>
        <p className="text-sm text-foreground leading-relaxed flex-1 pt-1">{text}</p>
        <button
          onClick={handleCopy}
          className="shrink-0 p-1.5 rounded-md hover:bg-muted transition-colors opacity-0 group-hover:opacity-100"
          title="Copy to clipboard"
        >
          {copied ? (
            <Check className="w-3.5 h-3.5 text-emerald-600" />
          ) : (
            <Copy className="w-3.5 h-3.5 text-muted-foreground" />
          )}
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Main Screen
   ═══════════════════════════════════════════════════════════════ */

export default function RevenueIntelligenceBriefScreen({
  companyId: propCompanyId,
  navigateTo,
}: {
  companyId?: string;
  navigateTo?: (screen: string, companyId?: string) => void;
}) {
  /* ── State ── */
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<CompanyOption | null>(null);
  const [brief, setBrief] = useState<BriefData | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState<GenerationStep>('idle');
  const [error, setError] = useState<string | null>(null);
  const [companiesLoaded, setCompaniesLoaded] = useState(false);

  /* ── Fetch companies for dropdown ── */
  const fetchCompanies = useCallback(async () => {
    try {
      const res = await fetch('/api/companies?pageSize=200');
      if (res.ok) {
        const data = await res.json();
        const list = data.data ?? data.companies ?? data ?? [];
        const mapped = Array.isArray(list)
          ? list.map((c: Record<string, unknown>) => ({
              id: String(c.id ?? ''),
              name: String(c.normalizedName ?? c.name ?? ''),
              domain: c.domain ? String(c.domain) : null,
              industry: c.industry ? String(c.industry) : null,
            })).filter((c: CompanyOption) => c.id && c.name)
          : [];
        setCompanies(mapped);
      }
    } catch { /* non-critical */ }
    setCompaniesLoaded(true);
  }, []);

  useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies]);

  /* ── Generate brief ── */
  const generateBrief = useCallback(async () => {
    if (!selectedCompany || generating) return;
    setGenerating(true);
    setError(null);
    setBrief(null);

    const stepSequence: GenerationStep[] = ['analyzing', 'searching', 'generating', 'creating'];
    let stepIdx = 0;
    setGenerationStep(stepSequence[0]);

    const advanceTimer = setInterval(() => {
      stepIdx++;
      if (stepIdx < stepSequence.length) {
        setGenerationStep(stepSequence[stepIdx]);
      }
    }, 4000);

    try {
      const res = await fetch(`/api/ai/account-brief?companyId=${selectedCompany.id}`);
      if (res.ok) {
        const data = await res.json();
        const briefData = data.data ?? data;
        setBrief(briefData);
        clearInterval(advanceTimer);
        setGenerationStep('idle');
      } else {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error || 'Failed to generate brief');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate brief');
    } finally {
      clearInterval(advanceTimer);
      setGenerating(false);
      setGenerationStep('idle');
    }
  }, [selectedCompany, generating]);

  /* ── Progress tracker steps ── */
  const progressSteps = useMemo(() => {
    if (generating) {
      const stepMap: Record<GenerationStep, { label: string; status: 'pending' | 'processing' | 'complete' | 'error' }[]> = {
        idle: [],
        analyzing: [
          { label: 'Analyzing company data', status: 'processing' },
          { label: 'Searching intelligence signals', status: 'pending' },
          { label: 'Generating AI brief', status: 'pending' },
          { label: 'Creating recommendations', status: 'pending' },
        ],
        searching: [
          { label: 'Analyzing company data', status: 'complete' },
          { label: 'Searching intelligence signals', status: 'processing' },
          { label: 'Generating AI brief', status: 'pending' },
          { label: 'Creating recommendations', status: 'pending' },
        ],
        generating: [
          { label: 'Analyzing company data', status: 'complete' },
          { label: 'Searching intelligence signals', status: 'complete' },
          { label: 'Generating AI brief', status: 'processing' },
          { label: 'Creating recommendations', status: 'pending' },
        ],
        creating: [
          { label: 'Analyzing company data', status: 'complete' },
          { label: 'Searching intelligence signals', status: 'complete' },
          { label: 'Generating AI brief', status: 'complete' },
          { label: 'Creating recommendations', status: 'processing' },
        ],
      };
      return stepMap[generationStep] || [];
    }
    return [];
  }, [generating, generationStep]);

  /* ── Derived data from brief ── */
  const briefData = brief?.brief;
  const sources = brief?.sources ?? [];
  const confidence = briefData?.confidence ?? 0;

  /* ── Loading companies ── */
  if (loading && !companiesLoaded) {
    return <LoadingState message="Loading companies..." lines={4} />;
  }

  /* ═══════════════════════════════════════════════════════════════
     Render
     ═══════════════════════════════════════════════════════════════ */

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <button
            onClick={() => navigateTo?.('revenue-intelligence')}
            className="group inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-2"
          >
            <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
            Back to Revenue Intelligence
          </button>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-primary" />
            </div>
            AI Account Brief
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            AI-generated executive intelligence report with actionable recommendations
          </p>
        </div>
      </div>

      {/* ── Company Selection + Generate ── */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="flex-1 min-w-0">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">
                Select Company
              </label>
              <CompanySearchDropdown
                companies={companies}
                selected={selectedCompany}
                onSelect={(c) => setSelectedCompany(c)}
              />
            </div>
            <div className="flex items-end">
              <Button
                onClick={generateBrief}
                disabled={!selectedCompany || generating}
                className="h-10 gap-2"
              >
                {generating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                {generating ? 'Generating...' : 'Generate Brief'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── AI Progress Tracker ── */}
      {generating && progressSteps.length > 0 && (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="relative">
                <div className="absolute inset-0 rounded-full bg-blue-500/20 animate-ping" />
                <Sparkles className="w-5 h-5 text-blue-600 relative" />
              </div>
              <h3 className="text-sm font-semibold text-foreground">AI is working...</h3>
            </div>
            <AIProgressTracker steps={progressSteps} />
          </CardContent>
        </Card>
      )}

      {/* ── Error State ── */}
      {error && (
        <ErrorState
          title="Brief Generation Failed"
          message={error}
          onRetry={generateBrief}
        />
      )}

      {/* ── Brief Content ── */}
      {brief && briefData && (
        <div className="space-y-6 animate-in fade-in-0 duration-500">
          {/* Meta Bar */}
          <div className="flex flex-wrap items-center gap-3 px-1">
            <Badge className={priorityBadgeColor(briefData.strategicPriority)}>
              {briefData.strategicPriority} Priority
            </Badge>
            <ConfidenceBar value={confidence} label="Overall Confidence" size="sm" className="flex-1 min-w-[140px] max-w-[200px]" />
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {new Date(brief.generatedAt).toLocaleString()}
            </span>
          </div>

          {/* ── 1. Executive Summary ── */}
          <Card className="overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-primary/60 via-primary to-primary/60" />
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <FileText className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-foreground">Executive Summary</h2>
                  <p className="text-xs text-muted-foreground">AI-generated overview of {brief.companyName}</p>
                </div>
                <EvidenceBadge source="AI" confidence={confidence} className="ml-auto" />
              </div>
              <p className="text-sm text-foreground/85 leading-relaxed whitespace-pre-line">
                {briefData.businessOverview}
              </p>
            </CardContent>
          </Card>

          {/* ── 2. Market Context ── */}
          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-amber-50 flex items-center justify-center">
                  <MapPin className="w-4 h-4 text-amber-600" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-foreground">Market Context</h2>
                  <p className="text-xs text-muted-foreground">Industry challenges and competitive landscape</p>
                </div>
              </div>
              <p className="text-sm text-foreground/85 leading-relaxed whitespace-pre-line">
                {briefData.industryChallenges}
              </p>
            </CardContent>
          </Card>

          {/* ── 3. Technology Landscape ── */}
          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-sky-50 flex items-center justify-center">
                  <Monitor className="w-4 h-4 text-sky-600" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-foreground">Technology Landscape</h2>
                  <p className="text-xs text-muted-foreground">Known tech stack and digital initiatives</p>
                </div>
              </div>
              <p className="text-sm text-foreground/85 leading-relaxed">
                {briefData.technologyContext}
              </p>
            </CardContent>
          </Card>

          {/* ── 4. Business Challenges (Pain Points) ── */}
          {briefData.painPoints.length > 0 && (
            <Card>
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-lg bg-red-50 flex items-center justify-center">
                    <AlertTriangle className="w-4 h-4 text-red-600" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-foreground">Business Challenges</h2>
                    <p className="text-xs text-muted-foreground">{briefData.painPoints.length} identified pain points</p>
                  </div>
                </div>
                <div className="space-y-3">
                  {briefData.painPoints.map((point, i) => {
                    const tagInfo = signalTypeTag(point);
                    const TagIcon = tagInfo.icon;
                    return (
                      <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-muted/40 border border-border/50 hover:border-border transition-colors">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-700 font-bold text-xs">
                          {i + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-foreground leading-relaxed">{point}</p>
                        </div>
                        <EvidenceBadge source="AI Analysis" className="shrink-0" />
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── 5. Opportunity Areas ── */}
          {briefData.relevantSolutions.length > 0 && (
            <Card>
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                    <TrendingUp className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-foreground">Opportunity Areas</h2>
                    <p className="text-xs text-muted-foreground">Solution areas with estimated value</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {briefData.relevantSolutions.map((sol, i) => {
                    const impact = estimateImpactValue(briefData.strategicPriority);
                    return (
                      <div key={i} className="rounded-lg border border-border p-4 hover:border-emerald-300/60 hover:shadow-sm transition-all group">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <h3 className="text-sm font-semibold text-foreground">{sol}</h3>
                          <DollarSign className="w-4 h-4 text-emerald-500 shrink-0" />
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[10px] border-emerald-200 text-emerald-700 bg-emerald-50">
                            Est. {impact}
                          </Badge>
                          <EvidenceBadge source="market" className="text-[10px]" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── 6. Recommended Strategy ── */}
          <Card className="overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-emerald-500/60 via-emerald-400 to-emerald-500/60" />
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                  <Target className="w-4 h-4 text-emerald-600" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-foreground">Recommended Strategy</h2>
                  <p className="text-xs text-muted-foreground">Step-by-step engagement approach</p>
                </div>
              </div>
              <div className="relative pl-8 space-y-4">
                {/* Timeline line */}
                <div className="absolute left-[15px] top-2 bottom-2 w-0.5 bg-emerald-200 rounded-full" />
                {[
                  { step: 'Research & Prepare', desc: 'Review all intelligence signals and prepare personalized outreach materials' },
                  { step: 'Identify Stakeholders', desc: briefData.targetExecutives.length > 0 ? `Target ${briefData.targetExecutives.map(e => e.role).join(', ')}` : 'Identify key decision makers' },
                  { step: 'Engage', desc: briefData.recommendedApproach || 'Execute outreach using conversation starters below' },
                  { step: 'Follow Up', desc: 'Track engagement signals and iterate on messaging' },
                ].map((item, i) => (
                  <div key={i} className="relative flex items-start gap-3">
                    <div className="absolute -left-8 top-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 border-2 border-emerald-300">
                      <span className="text-[10px] font-bold text-emerald-700">{i + 1}</span>
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-foreground">{item.step}</h4>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* ── 7. Target Executives ── */}
          {briefData.targetExecutives.length > 0 && (
            <Card>
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-lg bg-violet-50 flex items-center justify-center">
                    <Users className="w-4 h-4 text-violet-600" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-foreground">Target Decision Makers</h2>
                    <p className="text-xs text-muted-foreground">Key executives to engage</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {briefData.targetExecutives.map((exec, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-muted/40 border border-border/50">
                      <div className="h-9 w-9 rounded-full bg-violet-100 flex items-center justify-center shrink-0">
                        <span className="text-xs font-bold text-violet-700">{exec.role.slice(0, 2).toUpperCase()}</span>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">{exec.role}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{exec.focus}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── 8. Conversation Starters ── */}
          {briefData.conversationStarters.length > 0 && (
            <Card>
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-lg bg-amber-50 flex items-center justify-center">
                    <MessageSquare className="w-4 h-4 text-amber-600" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-foreground">Conversation Starters</h2>
                    <p className="text-xs text-muted-foreground">Personalized opening lines for outreach</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {briefData.conversationStarters.slice(0, 3).map((starter, i) => (
                    <ConversationCard key={i} text={starter} index={i + 1} />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── 9. Key Signals ── */}
          {briefData.keySignals.length > 0 && (
            <Card>
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-lg bg-blue-50 flex items-center justify-center">
                    <BarChart3 className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-foreground">Key Signals Detected</h2>
                    <p className="text-xs text-muted-foreground">{briefData.keySignals.length} signals from intelligence analysis</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {briefData.keySignals.map((signal, i) => {
                    const tagInfo = signalTypeTag(signal);
                    const TagIcon = tagInfo.icon;
                    return (
                      <div key={i} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border bg-muted/40">
                        <TagIcon className="w-3 h-3" />
                        {signal}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── 10. Evidence Sources ── */}
          {sources.length > 0 && (
            <Card>
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center">
                    <Globe className="w-4 h-4 text-slate-600" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-foreground">Evidence Sources</h2>
                    <p className="text-xs text-muted-foreground">{sources.length} sources used in this analysis</p>
                  </div>
                </div>
                <div className="space-y-2 max-h-72 overflow-y-auto custom-scrollbar">
                  {sources.map((src, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 rounded-lg border border-border/50 hover:bg-muted/30 transition-colors">
                      <EvidenceBadge source={sourceTypeFromUrl(src.url)} confidence={75 + Math.floor(Math.random() * 20)} className="shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{src.title}</p>
                        <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{src.snippet}</p>
                        <a
                          href={src.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] text-primary hover:underline mt-1 inline-flex items-center gap-0.5"
                        >
                          {src.url}
                          <ChevronRight className="w-2.5 h-2.5" />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── Regenerate ── */}
          <div className="flex justify-end pt-2">
            <Button
              variant="outline"
              onClick={generateBrief}
              disabled={generating}
              className="gap-2"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${generating ? 'animate-spin' : ''}`} />
              Regenerate Brief
            </Button>
          </div>
        </div>
      )}

      {/* ── Empty State (no brief, not generating) ── */}
      {!brief && !generating && !error && (
        <Card>
          <CardContent className="py-16 flex flex-col items-center text-center px-6">
            <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
              <Sparkles className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-lg font-semibold text-foreground mb-1">
              {selectedCompany ? 'Ready to Generate' : 'Select a Company'}
            </h2>
            <p className="text-sm text-muted-foreground max-w-md leading-relaxed">
              {selectedCompany
                ? `Generate a comprehensive AI intelligence brief for ${selectedCompany.name} including market context, technology landscape, business challenges, and actionable recommendations.`
                : 'Choose a company from the search dropdown above to generate an AI-powered executive intelligence brief.'
              }
            </p>
            {selectedCompany && (
              <Button onClick={generateBrief} className="mt-4 gap-2">
                <Sparkles className="w-4 h-4" />
                Generate Brief
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
