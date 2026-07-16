'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Brain, Building2, User, Globe, TrendingUp, Users, DollarSign,
  Cpu, Newspaper, ChevronRight, Loader2, Sparkles, ExternalLink,
  Download, RotateCcw, Target, ArrowRight, Zap, FileText,
  Briefcase, Linkedin, Clock, Shield, BarChart3
} from 'lucide-react';

/* ═══════════════════════════════════════
   Types
   ═══════════════════════════════════════ */

interface ResearchSection {
  title: string;
  icon: React.ElementType;
  content: string;
  sources?: Array<{ title: string; url: string; domain: string }>;
}

interface ResearchResult {
  query: string;
  type: 'company' | 'person';
  generatedAt: string;
  sections: ResearchSection[];
  executiveSummary: string;
  keyInsights: string[];
  riskFactors: string[];
  opportunitySignals: string[];
}

/* ═══════════════════════════════════════
   Main Screen
   ═══════════════════════════════════════ */

export default function ResearchAgentScreen() {
  const [query, setQuery] = useState('');
  const [researchType, setResearchType] = useState<'company' | 'person'>('company');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ResearchResult | null>(null);
  const [history, setHistory] = useState<Array<{ query: string; type: string; timestamp: string }>>([]);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [genPhase, setGenPhase] = useState(0);

  const PHASES = [
    'Scanning public sources and databases...',
    'Analyzing company financials and metrics...',
    'Mapping leadership and organizational structure...',
    'Evaluating technology stack and digital footprint...',
    'Identifying competitive landscape...',
    'Synthesizing intelligence report...',
  ];

  const handleResearch = useCallback(async () => {
    if (!query.trim()) return;
    setLoading(true);
    setResult(null);
    setActiveSection(null);
    setGenPhase(0);

    const phaseInterval = setInterval(() => {
      setGenPhase(prev => (prev < PHASES.length - 1 ? prev + 1 : prev));
    }, 2500);

    try {
      const res = await fetch('/api/research-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query.trim(), type: researchType }),
      });
      clearInterval(phaseInterval);
      if (res.ok) {
        const data = await res.json();
        setResult(data);
        setHistory(prev => [
          { query: query.trim(), type: researchType, timestamp: new Date().toLocaleString() },
          ...prev.slice(0, 9),
        ]);
      }
    } catch {
      clearInterval(phaseInterval);
    } finally {
      setLoading(false);
    }
  }, [query, researchType]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !loading) handleResearch();
  };

  const handleExport = () => {
    if (!result) return;
    const lines = [
      `# Research Report: ${result.query}`,
      `Generated: ${result.generatedAt}`,
      `Type: ${result.type === 'company' ? 'Company Research' : 'Person Research'}`,
      '',
      '## Executive Summary',
      result.executiveSummary,
      '',
      '## Key Insights',
      ...result.keyInsights.map((ins, i) => `${i + 1}. ${ins}`),
      '',
      '## Risk Factors',
      ...result.riskFactors.map((r, i) => `- ${r}`),
      '',
      '## Opportunity Signals',
      ...result.opportunitySignals.map((o, i) => `- ${o}`),
      '',
      ...result.sections.flatMap(s => [
        `## ${s.title}`,
        s.content,
        ...(s.sources?.length ? ['', '### Sources', ...s.sources.map(src => `- [${src.title}](${src.url})`)] : []),
        '',
      ]),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `research-${result.query.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'color-mix(in oklch, var(--color-gold) 12%, transparent)' }}
          >
            <Brain className="w-4.5 h-4.5" style={{ color: 'var(--color-gold)' }} />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground tracking-tight">Research Agent</h1>
            <p className="text-xs" style={{ color: 'var(--text-dim)' }}>
              Deep AI-powered research on companies and people
            </p>
          </div>
        </div>
        {result && (
          <motion.button
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            onClick={handleExport}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border border-gray-200 bg-white text-muted-foreground hover:bg-gray-50 transition-all"
          >
            <Download className="w-3.5 h-3.5" />
            Export Report
          </motion.button>
        )}
      </div>

      {/* Search Bar */}
      <div className="rounded-xl bg-white border border-gray-200 p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={researchType === 'company' ? 'Enter company name or website...' : 'Enter person name and company...'}
              className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-200 bg-gray-50/50 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-gold)]/20 focus:border-[var(--color-gold)] focus:bg-white transition-all"
              disabled={loading}
            />
          </div>
          <div className="flex items-center gap-1 p-1 rounded-lg border border-gray-200 bg-gray-50">
            {(['company', 'person'] as const).map(t => (
              <button
                key={t}
                onClick={() => setResearchType(t)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-all ${
                  researchType === t
                    ? 'bg-white text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {t === 'company' ? <Building2 className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
                {t === 'company' ? 'Company' : 'Person'}
              </button>
            ))}
          </div>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            onClick={handleResearch}
            disabled={loading || !query.trim()}
            className="flex items-center gap-2 px-5 py-3 rounded-lg text-sm font-medium text-white disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            style={{ background: 'linear-gradient(135deg, var(--color-gold), var(--color-gold-dim))' }}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
            {loading ? 'Researching...' : 'Research'}
          </motion.button>
        </div>

        {/* Research History Chips */}
        {history.length > 0 && (
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
            <span className="text-[11px] font-medium" style={{ color: 'var(--text-dim)' }}>Recent:</span>
            {history.slice(0, 5).map((h, i) => (
              <button
                key={i}
                onClick={() => { setQuery(h.query); setResearchType(h.type as 'company' | 'person'); }}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-100 hover:bg-gray-200 text-[11px] text-muted-foreground transition-colors"
              >
                {h.type === 'company' ? <Building2 className="w-2.5 h-2.5" /> : <User className="w-2.5 h-2.5" />}
                {h.query}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Loading State */}
      {loading && (
        <div className="rounded-xl bg-white border border-gray-200 p-8 shadow-sm">
          <div className="text-center mb-6">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
              className="w-12 h-12 mx-auto mb-3 rounded-xl flex items-center justify-center"
              style={{ background: 'color-mix(in oklch, var(--color-gold) 12%, transparent)' }}
            >
              <Brain className="w-6 h-6" style={{ color: 'var(--color-gold)' }} />
            </motion.div>
            <h3 className="text-sm font-semibold text-foreground mb-1">Deep Research in Progress</h3>
            <p className="text-xs text-muted-foreground">Analyzing multiple data sources for comprehensive intelligence</p>
          </div>
          {/* Progress phases */}
          <div className="max-w-md mx-auto space-y-2">
            {PHASES.map((phase, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: i <= genPhase ? 1 : 0.3, x: 0 }}
                transition={{ delay: i * 0.1 }}
                className="flex items-center gap-3 px-3 py-2 rounded-lg"
                style={{
                  background: i === genPhase ? 'color-mix(in oklch, var(--color-gold) 6%, transparent)' : i < genPhase ? 'bg-emerald-50/50' : 'transparent',
                }}
              >
                {i < genPhase ? (
                  <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
                    <span className="text-[10px] text-white font-bold">✓</span>
                  </div>
                ) : i === genPhase ? (
                  <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--color-gold)' }} />
                ) : (
                  <div className="w-5 h-5 rounded-full border border-gray-200" />
                )}
                <span className={`text-xs ${i <= genPhase ? 'text-foreground' : 'text-muted-foreground'}`}>
                  {phase}
                </span>
              </motion.div>
            ))}
          </div>
          {/* Shimmer bar */}
          <div className="mt-6 h-1 rounded-full bg-gray-100 overflow-hidden max-w-md mx-auto">
            <motion.div
              className="h-full rounded-full"
              style={{ background: 'linear-gradient(90deg, var(--color-gold), var(--color-gold-bright), var(--color-gold))', backgroundSize: '200% 100%' }}
              animate={{ width: `${((genPhase + 1) / PHASES.length) * 100}%`, backgroundPosition: ['0% 0%', '100% 0%', '0% 0%'] }}
              transition={{ width: { duration: 0.5 }, backgroundPosition: { duration: 2, repeat: Infinity } }}
            />
          </div>
        </div>
      )}

      {/* Results */}
      {result && !loading && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          {/* Executive Summary Card */}
          <div className="rounded-xl bg-white border p-5 shadow-sm" style={{ borderColor: 'var(--color-gold)', borderWidth: '1.5px' }}>
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4" style={{ color: 'var(--color-gold)' }} />
              <h2 className="text-sm font-semibold text-foreground">Executive Summary</h2>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-muted-foreground font-medium ml-auto">
                {result.generatedAt}
              </span>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">{result.executiveSummary}</p>
          </div>

          {/* Key Insights + Risks + Opportunities */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-xl bg-white border border-gray-200 p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <Target className="w-4 h-4 text-blue-500" />
                <h3 className="text-xs font-semibold text-foreground">Key Insights</h3>
              </div>
              <ul className="space-y-2">
                {result.keyInsights.map((ins, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                    <ChevronRight className="w-3 h-3 text-blue-400 shrink-0 mt-0.5" />
                    <span className="leading-relaxed">{ins}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl bg-white border border-gray-200 p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <Shield className="w-4 h-4 text-amber-500" />
                <h3 className="text-xs font-semibold text-foreground">Risk Factors</h3>
              </div>
              <ul className="space-y-2">
                {result.riskFactors.map((r, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                    <ChevronRight className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />
                    <span className="leading-relaxed">{r}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl bg-white border border-gray-200 p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <Zap className="w-4 h-4 text-emerald-500" />
                <h3 className="text-xs font-semibold text-foreground">Opportunity Signals</h3>
              </div>
              <ul className="space-y-2">
                {result.opportunitySignals.map((o, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                    <ChevronRight className="w-3 h-3 text-emerald-400 shrink-0 mt-0.5" />
                    <span className="leading-relaxed">{o}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Detailed Sections */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Detailed Analysis</h3>
            <div className="space-y-3">
              {result.sections.map((section, i) => {
                const Icon = section.icon;
                const isOpen = activeSection === section.title;
                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.06 }}
                    className="rounded-xl bg-white border border-gray-200 overflow-hidden shadow-sm"
                  >
                    <button
                      onClick={() => setActiveSection(isOpen ? null : section.title)}
                      className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-gray-50 transition-colors"
                    >
                      <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center shrink-0">
                        <Icon className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <span className="text-sm font-semibold text-foreground flex-1">{section.title}</span>
                      <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                    </button>
                    <AnimatePresence>
                      {isOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="px-5 pb-4 border-t border-gray-100 pt-4">
                            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{section.content}</p>
                            {section.sources?.length > 0 && (
                              <div className="mt-4 pt-3 border-t border-gray-100">
                                <h4 className="text-[11px] font-semibold text-foreground uppercase tracking-wider mb-2">Sources</h4>
                                <div className="space-y-1.5">
                                  {section.sources.map((src, j) => (
                                    <a
                                      key={j}
                                      href={src.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex items-center gap-2 text-xs text-[var(--color-gold)] hover:underline group"
                                    >
                                      <ExternalLink className="w-3 h-3 shrink-0" />
                                      <span className="truncate group-hover:underline">{src.title}</span>
                                      <span className="text-[10px] text-gray-400 ml-auto shrink-0">{src.domain}</span>
                                    </a>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </motion.div>
      )}

      {/* Empty State */}
      {!result && !loading && (
        <div className="rounded-xl bg-white border border-gray-200 p-16 text-center shadow-sm">
          <motion.div
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center"
            style={{ background: 'color-mix(in oklch, var(--color-gold) 8%, transparent)' }}
          >
            <Brain className="w-8 h-8" style={{ color: 'var(--color-gold)' }} />
          </motion.div>
          <h3 className="text-sm font-semibold text-foreground mb-1.5">Deep Research Agent</h3>
          <p className="text-xs text-muted-foreground max-w-md mx-auto mb-6 leading-relaxed">
            Enter a company name or person to trigger a comprehensive AI-powered research analysis. The agent scans multiple public data sources to generate actionable intelligence reports.
          </p>
          <div className="flex items-center justify-center gap-6 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5"><Globe className="w-3.5 h-3.5" /> Web Sources</div>
            <div className="flex items-center gap-1.5"><BarChart3 className="w-3.5 h-3.5" /> Financials</div>
            <div className="flex items-center gap-1.5"><Cpu className="w-3.5 h-3.5" /> Tech Stack</div>
            <div className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> Leadership</div>
          </div>
        </div>
      )}
    </div>
  );
}