'use client';

import { useState, useCallback, useEffect } from 'react';
import { tokens } from '@/components/intelligence-os/design-tokens';
import { ScreenSkeleton } from '@/components/ui/screen-skeleton';
import {
  Search,
  FlaskConical,
  Building2,
  Globe,
  Users,
  TrendingUp,
  FileText,
  Star,
  Clock,
  Loader2,
  CheckCircle2,
  ExternalLink,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

// ── Types ──
interface ResearchResult {
  companyName: string;
  domain: string;
  overview: string;
  confidence: number;
  keyFindings: { title: string; description: string; type: 'opportunity' | 'risk' | 'info' }[];
  sources: { title: string; url: string; type: string }[];
}

interface ResearchHistoryItem {
  id: string;
  query: string;
  companyName: string;
  timestamp: Date;
  confidence: number;
}

// ── Mock Research Results ──
const MOCK_RESULTS: Record<string, ResearchResult> = {
  'acme corp': {
    companyName: 'Acme Corporation',
    domain: 'acmecorp.com',
    overview:
      'Acme Corporation is a mid-market enterprise software company headquartered in San Francisco, CA. Founded in 2015, they have grown to approximately 1,200 employees with $180M in annual revenue. They specialize in cloud infrastructure management and recently secured a $45M Series D funding round led by Sequoia Capital. Their primary market is North America with expansion plans into APAC, evidenced by recent job postings in Singapore and Tokyo.',
    confidence: 91,
    keyFindings: [
      {
        title: 'APAC Expansion',
        description:
          '3 new regional director roles posted in Singapore, Tokyo, and Sydney within 48 hours. This signals immediate go-to-market activity in the region.',
        type: 'opportunity',
      },
      {
        title: 'Funding Secure',
        description:
          '$45M Series D at $900M valuation provides 18+ months runway. Budget flexibility for tooling and infrastructure investments is high.',
        type: 'opportunity',
      },
      {
        title: 'Tech Stack Modernization',
        description:
          'Engineering blog posts indicate migration from monolith to microservices architecture. Currently evaluating observability, testing, and deployment tools.',
        type: 'opportunity',
      },
      {
        title: 'Leadership Change',
        description:
          'New CTO hired 3 months ago from a larger enterprise (Salesforce). Expected to drive technology decisions and vendor selection.',
        type: 'info',
      },
      {
        title: 'Competitive Pressure',
        description:
          'Two direct competitors recently launched similar features. Acme may feel urgency to innovate and differentiate, creating buying intent.',
        type: 'risk',
      },
    ],
    sources: [
      { title: 'LinkedIn Job Postings', url: '#', type: 'Job Board' },
      { title: 'Crunchbase Funding Data', url: '#', type: 'Financial' },
      { title: 'Acme Engineering Blog', url: '#', type: 'Company' },
      { title: 'TechCrunch Coverage', url: '#', type: 'News' },
      { title: 'SEC Form D Filing', url: '#', type: 'Regulatory' },
      { title: 'Glassdoor Reviews', url: '#', type: 'Employee' },
    ],
  },
  globalfin: {
    companyName: 'GlobalFin Technologies',
    domain: 'globalfin.io',
    overview:
      'GlobalFin Technologies is a financial technology company providing AI-powered fraud detection and compliance solutions to banks and fintech companies. With 3,400 employees and $520M annual revenue, they are a significant player in the regtech space. Their current fraud detection system has shown a 23% increase in false positives, triggering a search for AI-based alternatives with a $2.5M approved budget.',
    confidence: 88,
    keyFindings: [
      {
        title: 'Active RFP',
        description:
          'RFP issued for AI-based fraud detection system. $2.5M budget approved by CTO. Deadline is in 3 weeks — urgent opportunity.',
        type: 'opportunity',
      },
      {
        title: 'Regulatory Pressure',
        description:
          'New EPA-equivalent financial regulations effective Q2 2025 require enhanced detection capabilities. Non-compliance penalties estimated at $5M+.',
        type: 'opportunity',
      },
      {
        title: 'Current System Issues',
        description:
          '23% increase in false positives creating customer complaints and operational inefficiency. Internal pressure to replace is high.',
        type: 'opportunity',
      },
      {
        title: 'Budget Constraints',
        description:
          'Despite the $2.5M approval, the CFO has mandated ROI within 12 months. Solution must demonstrate clear cost savings.',
        type: 'risk',
      },
    ],
    sources: [
      { title: 'RFP Document (Public)', url: '#', type: 'Procurement' },
      { title: 'CTO Blog Post', url: '#', type: 'Company' },
      { title: 'Gartner Magic Quadrant', url: '#', type: 'Analyst' },
      { title: 'Industry Conference Talk', url: '#', type: 'Event' },
    ],
  },
  'autodrive ai': {
    companyName: 'AutoDrive AI',
    domain: 'autodrive-ai.com',
    overview:
      'AutoDrive AI is a Series C autonomous vehicle technology company with 890 employees and $95M in annual revenue. They recently signed a $50M strategic partnership with a Tier-1 automotive OEM for autonomous driving software, spanning 3 years. This partnership significantly increases their engineering, testing, and simulation needs, creating urgent demand for scalable development tools.',
    confidence: 93,
    keyFindings: [
      {
        title: 'Major OEM Partnership',
        description:
          '$50M, 3-year partnership with a Tier-1 OEM creates immediate scaling needs. Engineering team expected to grow 40% in 2025.',
        type: 'opportunity',
      },
      {
        title: 'Hiring Spree',
        description:
          '28 open engineering positions posted in the last 2 weeks. Roles include simulation engineers, ML ops, and QA automation specialists.',
        type: 'opportunity',
      },
      {
        title: 'Patent Activity',
        description:
          '12 new patent filings in the last 6 months related to sensor fusion and path planning. Indicates heavy R&D investment.',
        type: 'info',
      },
      {
        title: 'Integration Complexity',
        description:
          'New OEM partnership requires integration with legacy systems. May face technical challenges that slow adoption of new tools.',
        type: 'risk',
      },
    ],
    sources: [
      { title: 'Partnership Press Release', url: '#', type: 'Company' },
      { title: 'LinkedIn Job Postings', url: '#', type: 'Job Board' },
      { title: 'USPTO Patent Database', url: '#', type: 'Government' },
      { title: 'Automotive Industry Report', url: '#', type: 'Analyst' },
      { title: 'TechCrunch Exclusive', url: '#', type: 'News' },
    ],
  },
};

// ── Helpers ──
function findBestMatch(query: string): string | null {
  const q = query.toLowerCase().trim();
  for (const key of Object.keys(MOCK_RESULTS)) {
    if (q.includes(key) || key.includes(q)) return key;
  }
  // Check for URL
  if (q.includes('acme')) return 'acme corp';
  if (q.includes('globalfin') || q.includes('global')) return 'globalfin';
  if (q.includes('autodrive') || q.includes('drive')) return 'autodrive ai';
  return null;
}

function getFindingTypeConfig(type: string) {
  switch (type) {
    case 'opportunity':
      return {
        color: tokens.domain.opportunity,
        bg: '#ECFDF5',
        icon: TrendingUp,
        label: 'Opportunity',
      };
    case 'risk':
      return {
        color: tokens.domain.risk,
        bg: tokens.confidence.low.bg,
        icon: ExternalLink,
        label: 'Risk',
      };
    default:
      return {
        color: tokens.text.secondary,
        bg: tokens.neutral['100'],
        icon: FileText,
        label: 'Info',
      };
  }
}

// ── Component ──
export default function ResearchAgent() {
  const [isLoading, setIsLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [researching, setResearching] = useState(false);
  const [result, setResult] = useState<ResearchResult | null>(null);
  const [history, setHistory] = useState<ResearchHistoryItem[]>([
    {
      id: 'h-1',
      query: 'Acme Corp',
      companyName: 'Acme Corporation',
      timestamp: new Date(Date.now() - 3600000),
      confidence: 91,
    },
    {
      id: 'h-2',
      query: 'GlobalFin',
      companyName: 'GlobalFin Technologies',
      timestamp: new Date(Date.now() - 7200000),
      confidence: 88,
    },
    {
      id: 'h-3',
      query: 'autodrive ai',
      companyName: 'AutoDrive AI',
      timestamp: new Date(Date.now() - 86400000),
      confidence: 93,
    },
  ]);
  const [noResult, setNoResult] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setIsLoading(false), 600);
    return () => clearTimeout(t);
  }, []);

  if (isLoading) return <ScreenSkeleton rows={8} className="p-6" />;

  const handleResearch = useCallback(() => {
    const trimmed = query.trim();
    if (!trimmed) return;

    setResearching(true);
    setResult(null);
    setNoResult(false);

    // Simulate research delay
    setTimeout(() => {
      const matchKey = findBestMatch(trimmed);
      if (matchKey && MOCK_RESULTS[matchKey]) {
        const data = MOCK_RESULTS[matchKey];
        setResult(data);
        setHistory((prev) => [
          {
            id: `h-${Date.now()}`,
            query: trimmed,
            companyName: data.companyName,
            timestamp: new Date(),
            confidence: data.confidence,
          },
          ...prev.slice(0, 9),
        ]);
      } else {
        setNoResult(true);
      }
      setResearching(false);
    }, 1800);
  }, [query]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') handleResearch();
    },
    [handleResearch],
  );

  const handleHistoryClick = useCallback((item: ResearchHistoryItem) => {
    setQuery(item.query);
    setResearching(true);
    setResult(null);
    setNoResult(false);

    setTimeout(() => {
      const matchKey = findBestMatch(item.query);
      if (matchKey && MOCK_RESULTS[matchKey]) {
        setResult(MOCK_RESULTS[matchKey]);
      }
      setResearching(false);
    }, 1200);
  }, []);

  const handleClearHistory = useCallback(() => {
    setHistory([]);
  }, []);

  return (
    <div className="p-6 space-y-6">
      {/* ── Header ── */}
      <div>
        <h1
          className="text-xl font-bold flex items-center gap-2"
          style={{ color: tokens.text.primary }}
        >
          <FlaskConical className="h-6 w-6" style={{ color: tokens.accent.primary }} />
          Research Agent
        </h1>
        <p className="text-sm mt-1" style={{ color: tokens.text.secondary }}>
          AI-powered company research with intelligence synthesis
        </p>
      </div>

      {/* ── Search Input ── */}
      <div
        className="rounded-xl p-4"
        style={{ background: tokens.surface.card, border: `1px solid ${tokens.border.default}` }}
      >
        <label
          className="text-xs font-medium uppercase tracking-wider block mb-2"
          style={{ color: tokens.text.muted }}
        >
          Company Name or URL
        </label>
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4"
              style={{ color: tokens.text.muted }}
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="e.g. Acme Corp, globalfin.com"
              className="h-11 pl-10"
              style={{
                background: tokens.surface.secondary,
                border: `1px solid ${tokens.border.default}`,
                color: tokens.text.primary,
              }}
            />
          </div>
          <Button
            onClick={handleResearch}
            disabled={!query.trim() || researching}
            className="h-11 px-6 gap-2"
            style={{
              background:
                query.trim() && !researching ? tokens.accent.primary : tokens.border.default,
              color: tokens.flat.white,
            }}
          >
            {researching ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Researching...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Research
              </>
            )}
          </Button>
        </div>
        <p className="text-[11px] mt-2" style={{ color: tokens.text.muted }}>
          Try: "Acme Corp", "GlobalFin", or "AutoDrive AI" for demo results
        </p>
      </div>

      {/* ── Main Content: Results + History ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Research Results (2/3 width) */}
        <div className="lg:col-span-2 space-y-4">
          {researching && (
            <div
              className="rounded-xl p-8 text-center"
              style={{
                background: tokens.surface.card,
                border: `1px solid ${tokens.border.default}`,
              }}
            >
              <div className="flex flex-col items-center gap-3">
                <div className="relative">
                  <Loader2
                    className="h-8 w-8 animate-spin"
                    style={{ color: tokens.accent.primary }}
                  />
                </div>
                <div>
                  <p className="text-sm font-medium" style={{ color: tokens.text.primary }}>
                    Researching {query}...
                  </p>
                  <p className="text-xs mt-1" style={{ color: tokens.text.secondary }}>
                    Analyzing signals, financials, leadership, and market position
                  </p>
                </div>
                <div
                  className="flex items-center gap-4 text-xs"
                  style={{ color: tokens.text.muted }}
                >
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" style={{ color: '#16A34A' }} /> Web sources
                  </span>
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" style={{ color: '#16A34A' }} /> Financial data
                  </span>
                  <span className="flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" /> AI synthesis
                  </span>
                </div>
              </div>
            </div>
          )}

          {noResult && !researching && (
            <div
              className="rounded-xl p-8 text-center"
              style={{
                background: tokens.surface.card,
                border: `1px solid ${tokens.border.default}`,
              }}
            >
              <Search className="h-8 w-8 mx-auto mb-2" style={{ color: tokens.text.muted }} />
              <p className="text-sm font-medium" style={{ color: tokens.text.primary }}>
                No research data found
              </p>
              <p className="text-xs mt-1" style={{ color: tokens.text.secondary }}>
                Try searching for "Acme Corp", "GlobalFin", or "AutoDrive AI"
              </p>
            </div>
          )}

          {result && !researching && (
            <div className="space-y-4">
              {/* Company Overview */}
              <div
                className="rounded-xl p-5"
                style={{
                  background: tokens.surface.card,
                  border: `1px solid ${tokens.border.default}`,
                }}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg p-2.5" style={{ background: tokens.accent.ghost }}>
                      <Building2 className="h-5 w-5" style={{ color: tokens.accent.primary }} />
                    </div>
                    <div>
                      <h2 className="text-base font-bold" style={{ color: tokens.text.primary }}>
                        {result.companyName}
                      </h2>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Globe className="h-3 w-3" style={{ color: tokens.text.muted }} />
                        <span className="text-xs" style={{ color: tokens.text.secondary }}>
                          {result.domain}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p
                      className="text-[10px] uppercase tracking-wider font-medium"
                      style={{ color: tokens.text.muted }}
                    >
                      Confidence
                    </p>
                    <p
                      className="text-lg font-bold tabular-nums"
                      style={{
                        color:
                          result.confidence >= 85
                            ? '#16A34A'
                            : result.confidence >= 70
                              ? '#D97706'
                              : '#DC2626',
                      }}
                    >
                      {result.confidence}%
                    </p>
                  </div>
                </div>
                <p className="text-sm leading-relaxed" style={{ color: tokens.text.secondary }}>
                  {result.overview}
                </p>
              </div>

              {/* Key Findings */}
              <div>
                <h3
                  className="text-sm font-semibold mb-3 flex items-center gap-2"
                  style={{ color: tokens.text.primary }}
                >
                  <Star className="h-4 w-4" style={{ color: tokens.gold.dark }} />
                  Key Findings
                </h3>
                <div className="space-y-2">
                  {result.keyFindings.map((finding, idx) => {
                    const cfg = getFindingTypeConfig(finding.type);
                    const FindingIcon = cfg.icon;
                    return (
                      <div
                        key={idx}
                        className="rounded-xl p-4 flex items-start gap-3"
                        style={{
                          background: tokens.surface.card,
                          border: `1px solid ${tokens.border.default}`,
                          borderLeft: `3px solid ${cfg.color}`,
                        }}
                      >
                        <div
                          className="shrink-0 rounded-lg p-1.5 mt-0.5"
                          style={{ background: cfg.bg }}
                        >
                          <FindingIcon className="h-3.5 w-3.5" style={{ color: cfg.color }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <h4
                              className="text-sm font-medium"
                              style={{ color: tokens.text.primary }}
                            >
                              {finding.title}
                            </h4>
                            <span
                              className="px-1.5 py-0.5 rounded text-[10px] font-medium"
                              style={{ color: cfg.color, background: cfg.bg }}
                            >
                              {cfg.label}
                            </span>
                          </div>
                          <p
                            className="text-xs leading-relaxed"
                            style={{ color: tokens.text.secondary }}
                          >
                            {finding.description}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Sources */}
              <div
                className="rounded-xl p-5"
                style={{
                  background: tokens.surface.card,
                  border: `1px solid ${tokens.border.default}`,
                }}
              >
                <h3
                  className="text-sm font-semibold mb-3 flex items-center gap-2"
                  style={{ color: tokens.text.primary }}
                >
                  <FileText className="h-4 w-4" style={{ color: tokens.accent.primary }} />
                  Sources ({result.sources.length})
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {result.sources.map((source, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 p-2.5 rounded-lg"
                      style={{ background: tokens.surface.secondary }}
                    >
                      <ExternalLink
                        className="h-3.5 w-3.5 shrink-0"
                        style={{ color: tokens.accent.dim }}
                      />
                      <div className="flex-1 min-w-0">
                        <p
                          className="text-xs font-medium truncate"
                          style={{ color: tokens.text.primary }}
                        >
                          {source.title}
                        </p>
                        <p className="text-[10px]" style={{ color: tokens.text.muted }}>
                          {source.type}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Empty state when nothing is happening */}
          {!researching && !result && !noResult && (
            <div
              className="rounded-xl p-12 text-center"
              style={{
                background: tokens.surface.card,
                border: `1px solid ${tokens.border.default}`,
              }}
            >
              <FlaskConical
                className="h-10 w-10 mx-auto mb-3"
                style={{ color: tokens.text.muted }}
              />
              <h3 className="text-base font-semibold" style={{ color: tokens.text.primary }}>
                Ready to Research
              </h3>
              <p className="text-sm mt-1 max-w-sm mx-auto" style={{ color: tokens.text.secondary }}>
                Enter a company name or URL above and click Research to get AI-powered intelligence
                synthesis.
              </p>
            </div>
          )}
        </div>

        {/* Research History (1/3 width) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3
              className="text-sm font-semibold flex items-center gap-2"
              style={{ color: tokens.text.primary }}
            >
              <Clock className="h-4 w-4" style={{ color: tokens.text.muted }} />
              Research History
            </h3>
            {history.length > 0 && (
              <button
                onClick={handleClearHistory}
                className="text-[10px] font-medium flex items-center gap-1"
                style={{ color: tokens.text.muted }}
              >
                <Trash2 className="h-3 w-3" />
                Clear
              </button>
            )}
          </div>

          {history.length === 0 ? (
            <div
              className="rounded-xl p-6 text-center"
              style={{
                background: tokens.surface.card,
                border: `1px solid ${tokens.border.default}`,
              }}
            >
              <Clock className="h-6 w-6 mx-auto mb-2" style={{ color: tokens.text.muted }} />
              <p className="text-xs" style={{ color: tokens.text.muted }}>
                No research history yet
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {history.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleHistoryClick(item)}
                  className="w-full text-left rounded-xl p-3.5 transition-colors"
                  style={{
                    background: tokens.surface.card,
                    border: `1px solid ${tokens.border.default}`,
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.background = tokens.accent.ghost;
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background = tokens.surface.card;
                  }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium" style={{ color: tokens.text.primary }}>
                      {item.companyName}
                    </span>
                    <span
                      className="text-xs font-medium tabular-nums"
                      style={{
                        color: item.confidence >= 85 ? '#16A34A' : '#D97706',
                      }}
                    >
                      {item.confidence}%
                    </span>
                  </div>
                  <div
                    className="flex items-center gap-1 text-[10px]"
                    style={{ color: tokens.text.muted }}
                  >
                    <Clock className="h-3 w-3" />
                    {item.timestamp.toLocaleTimeString('en-US', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                    <span>•</span>
                    <span>{item.query}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
