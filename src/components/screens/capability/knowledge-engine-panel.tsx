'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TabBar, GlassPanel, AnimatedBar, PulseDot,
} from '@/components/ui/animated-components';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Search, Database, Layers, BookOpen, Trophy, Cpu, Brain, ArrowUpRight,
  FileText, Sparkles, Loader2, Mail, Zap, Lightbulb, Upload, Target, Workflow, AlertTriangle,
} from 'lucide-react';
import { logger } from '@/lib/logger';
import { colors } from '@/components/design-system';
import type { Capability } from './capability-shared';
import { goldAlpha, blackAlpha, CAT_ICON, CAT_GRADIENT } from './capability-shared';

export function KnowledgeEnginePanel({ items, navigateTo }: { items: Capability[]; navigateTo?: (s: string) => void }) {
  const [activeTab, setActiveTab] = useState<'search' | 'coverage' | 'flow'>('search');

  // RAG Search Test state
  const [ragQuery, setRagQuery] = useState('');
  const [ragIndustry, setRagIndustry] = useState('');
  const [ragRole, setRagRole] = useState('');
  const [ragMode, setRagMode] = useState('hybrid');
  const [ragLoading, setRagLoading] = useState(false);
  const [ragResults, setRagResults] = useState<any[] | null>(null);
  const [ragInsight, setRagInsight] = useState<any>(null);

  // Coverage state
  const [coverage, setCoverage] = useState<any>(null);
  const [coverageLoading, setCoverageLoading] = useState(false);
  const coverageLoaded = useRef(false);

  // Auto-load coverage on first view
  useEffect(() => {
    if (activeTab !== 'coverage' || coverageLoaded.current) return;
    coverageLoaded.current = true;
    let cancelled = false;
    (async () => {
      setCoverageLoading(true);
      try {
        const res = await fetch('/api/knowledge/engine', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'coverage' }),
        });
        const data = await res.json();
        if (!cancelled) setCoverage(data);
      } catch (err) { logger.error('[Capability] fetch coverage failed:', { error: err }); }
      if (!cancelled) setCoverageLoading(false);
    })();
    return () => { cancelled = true; };
  }, [activeTab]);

  const runRagSearch = async () => {
    if (!ragQuery.trim()) return;
    setRagLoading(true);
    setRagResults(null);
    try {
      const res = await fetch('/api/knowledge/engine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'test',
          query: ragQuery,
          industry: ragIndustry || undefined,
          role: ragRole || undefined,
          searchMode: ragMode,
        }),
      });
      const data = await res.json();
      setRagResults(data.results || []);
      setRagInsight(data.engineInsight || null);
    } catch (err) { logger.error('[Capability] RAG search failed:', { error: err }); setRagResults([]); }
    setRagLoading(false);
  };

  const slCount = new Set(items.filter(i => i.category === 'service_line').map(i => i.serviceLine).filter(Boolean)).size;
  const csCount = items.filter(i => i.category === 'case_study').length;
  const ppCount = items.filter(i => i.category === 'proof_point').length;

  const ENGINE_TABS = [
    { key: 'search', label: 'RAG Search Test' },
    { key: 'coverage', label: 'Coverage Gaps' },
    { key: 'flow', label: 'Email Flow' },
  ];

  return (
    <GlassPanel className="p-0 overflow-hidden">
      {/* Header */}
      <div className="px-6 pt-6 pb-4">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center shadow-lg"
              style={{ background: `linear-gradient(135deg, ${goldAlpha(0.3)}, ${goldAlpha(0.08)})`, boxShadow: `0 0 20px ${goldAlpha(0.15)}` }}
            >
              <Brain className="w-5 h-5" style={{ color: 'var(--color-gold)' }} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-base font-bold text-foreground">Knowledge Engine</p>
                <Badge variant="outline" className="text-[9px] border-emerald-500/30 text-emerald-600 bg-emerald-500/5 gap-1 px-1.5">
                  <PulseDot color={colors.green} />
                  Active
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">Retrieval-Augmented Generation powers every personalized email</p>
            </div>
          </div>
          {navigateTo && (
            <Button
              variant="outline"
              size="sm"
              className="h-10 text-[11px] gap-1.5 border-primary/30 text-primary hover:bg-primary/10 min-h-[44px]"
              onClick={() => navigateTo('knowledge')}
            >
              <Database className="w-3 h-3" />
              Knowledge Library
              <ArrowUpRight className="w-3 h-3" />
            </Button>
          )}
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { icon: Database, label: 'Total Assets', value: items.length, color: 'var(--color-gold)' },
            { icon: Layers, label: 'Service Lines', value: slCount, color: colors.blue },
            { icon: BookOpen, label: 'Case Studies', value: csCount, color: colors.green },
            { icon: Trophy, label: 'Proof Points', value: ppCount, color: colors.purple },
            { icon: Cpu, label: 'Search Modes', value: 3, color: colors.amber, isText: true, text: 'K / S / H' },
          ].map((s, idx) => (
            <div key={idx} className="p-3 rounded-lg bg-gray-50 border border-gray-200">
              <div className="flex items-center gap-1.5 mb-1">
                <s.icon className="w-3 h-3" style={{ color: s.color }} />
                <span className="text-[11px] text-muted-foreground">{s.label}</span>
              </div>
              {s.isText ? (
                <p className="text-sm font-bold text-foreground">{s.text}</p>
              ) : (
                <p className="text-lg font-bold tabular-nums" style={{ color: s.color }}>{s.value}</p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Engine sub-tabs */}
      <div className="px-6 pb-2">
        <TabBar tabs={ENGINE_TABS} active={activeTab} onChange={(v: string) => setActiveTab(v as typeof activeTab)} />
      </div>

      {/* Tab content */}
      <div className="px-6 pb-6">
        <AnimatePresence mode="wait">
          {activeTab === 'search' && (
            <motion.div key="search" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }} className="space-y-4">
              {/* Search form */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="sm:col-span-2 lg:col-span-2 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder='Try: "AI for healthcare CTO" or "cloud migration financial services"'
                    value={ragQuery}
                    onChange={e => setRagQuery(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && runRagSearch()}
                    className="h-10 text-sm pl-10 bg-gray-50 border-gray-200 focus:border-primary/40"
                  />
                </div>
                <Input
                  placeholder="Industry (e.g. Healthcare)"
                  value={ragIndustry}
                  onChange={e => setRagIndustry(e.target.value)}
                  className="h-10 text-sm bg-gray-50 border-gray-200"
                />
                <Input
                  placeholder="Role (e.g. CTO)"
                  value={ragRole}
                  onChange={e => setRagRole(e.target.value)}
                  className="h-10 text-sm bg-gray-50 border-gray-200"
                />
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-muted-foreground uppercase tracking-wider">Mode:</span>
                  {(['keyword', 'semantic', 'hybrid'] as const).map(mode => (
                    <button
                      key={mode}
                      onClick={() => setRagMode(mode)}
                      className={`px-3 py-1 rounded-md text-[11px] font-medium transition-all duration-200 ${
                        ragMode === mode
                          ? 'text-foreground border border-primary/30 shadow-sm'
                          : 'text-muted-foreground border border-transparent hover:text-foreground hover:bg-gray-50'
                      }`}
                      style={ragMode === mode ? { background: `${goldAlpha(0.1)}` } : {}}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
                <Button
                  size="sm"
                  className="h-10 text-xs gap-1.5 ml-auto min-h-[44px]"
                  onClick={runRagSearch}
                  disabled={ragLoading || !ragQuery.trim()}
                >
                  {ragLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                  {ragLoading ? 'Searching...' : 'Test Retrieval'}
                </Button>
              </div>

              {/* Results */}
              {ragResults && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
                  {/* Insight bar */}
                  {ragInsight && (
                    <div className="flex flex-wrap items-center gap-3 px-4 py-3 rounded-lg bg-gray-50 border border-gray-200">
                      <span className="text-[11px] text-muted-foreground">
                        {ragResults.length} results in {ragInsight.resultCategories?.length || 0} categories
                      </span>
                      {ragInsight.avgRelevanceScore > 0 && (
                        <span className="text-[11px] font-medium" style={{ color: 'var(--color-gold)' }}>
                          Avg score: {ragInsight.avgRelevanceScore}%
                        </span>
                      )}
                      {ragInsight.topMatchedFields?.length > 0 && (
                        <span className="text-[11px] text-muted-foreground">
                          Matched: {ragInsight.topMatchedFields.join(', ')}
                        </span>
                      )}
                      {ragInsight.queryTokens && (
                        <span className="text-[11px] text-muted-foreground ml-auto">
                          Tokens: [{ragInsight.queryTokens.join(', ')}]
                        </span>
                      )}
                    </div>
                  )}

                  {/* Result cards */}
                  {ragResults.length === 0 ? (
                    <div className="text-center py-8 text-sm text-muted-foreground">No results. Try different keywords.</div>
                  ) : (
                    <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                      {ragResults.map((r: any, idx: number) => {
                        const catColor = CAT_GRADIENT[r.category]?.from || `${goldAlpha(0.2)}`;
                        const CatIcon = CAT_ICON[r.category] || FileText;
                        return (
                          <motion.div
                            key={r.id}
                            initial={{ opacity: 0, x: -12 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.04 }}
                            className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 border border-gray-100 hover:border-gray-200 transition-colors"
                          >
                            <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold tabular-nums"
                              style={{ background: `${catColor}`, color: 'var(--dmq-white)' }}
                            >
                              {r.relevanceScore}%
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5">
                                <CatIcon className="w-3 h-3 text-muted-foreground shrink-0" />
                                <p className="text-sm font-medium text-foreground truncate">{r.title}</p>
                              </div>
                              <p className="text-[11px] text-muted-foreground line-clamp-2">{r.summary || r.content?.slice(0, 120)}</p>
                              {r.matchedFields && r.matchedFields.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1.5">
                                  {r.matchedFields.map((f: string) => (
                                    <span key={f} className="text-[9px] px-1.5 py-0.5 rounded bg-gray-100/50 text-muted-foreground">{f}</span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  )}
                </motion.div>
              )}

              {!ragResults && !ragLoading && (
                <div className="text-center py-8">
                  <Brain className="w-8 h-8 text-primary/30 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Test how the Knowledge Engine retrieves context for any prospect</p>
                  <p className="text-xs text-muted-foreground mt-1">Enter a query simulating a contact profile to see what knowledge gets retrieved</p>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'coverage' && (
            <motion.div key="coverage" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }} className="space-y-4">
              {coverageLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                  <span className="ml-2 text-sm text-muted-foreground">Analyzing knowledge coverage...</span>
                </div>
              ) : coverage ? (
                <>
                  <div className="flex items-center gap-4 p-4 rounded-lg bg-gray-50 border border-gray-200">
                    <div className="text-center">
                      <p className="text-3xl font-bold tabular-nums" style={{ color: coverage.overallScore >= 70 ? colors.green : coverage.overallScore >= 40 ? colors.amber : colors.red }}>
                        {coverage.overallScore}%
                      </p>
                      <p className="text-[11px] text-muted-foreground">Completeness</p>
                    </div>
                    <div className="flex-1">
                      <AnimatedBar value={coverage.overallScore} max={100} color={coverage.overallScore >= 70 ? colors.green : coverage.overallScore >= 40 ? colors.amber : colors.red} />
                      <p className="text-[11px] text-muted-foreground mt-1">Service line completeness score (service line + case study + proof point + objection + CTA)</p>
                    </div>
                  </div>

                  {Object.entries(coverage.serviceLineCompleteness || {}).map(([sl, data]: [string, any]) => (
                    <div key={sl} className="p-3 rounded-lg bg-gray-50 border border-gray-100">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-medium text-foreground">{sl}</p>
                        <span className="text-xs font-bold tabular-nums" style={{ color: data.score >= 70 ? colors.green : data.score >= 40 ? colors.amber : colors.red }}>{data.score}%</span>
                      </div>
                      <div className="flex gap-2 mb-2">
                        {[
                          { key: 'hasServiceLine', label: 'Service', c: colors.blue },
                          { key: 'hasCaseStudy', label: 'Case Study', c: colors.green },
                          { key: 'hasProofPoint', label: 'Proof', c: colors.purple },
                          { key: 'hasObjection', label: 'Objection', c: colors.red },
                          { key: 'hasCTA', label: 'CTA', c: colors.amber },
                        ].map(item => (
                          <span
                            key={item.key}
                            className="text-[9px] px-2 py-0.5 rounded-full border"
                            style={{
                              background: data[item.key as keyof typeof data] ? `${item.c}15` : 'transparent',
                              borderColor: data[item.key as keyof typeof data] ? `${item.c}40` : `${blackAlpha(0.05)}`,
                              color: data[item.key as keyof typeof data] ? item.c : `${blackAlpha(0.08)}`,
                            }}
                          >
                            {data[item.key as keyof typeof data] ? '' : 'No '}{item.label}
                          </span>
                        ))}
                      </div>
                      <AnimatedBar value={data.score} max={100} color={data.score >= 70 ? colors.green : colors.amber} delay={0.1} />
                    </div>
                  ))}

                  {(coverage.recommendations || []).length > 0 && (
                    <div className="space-y-2 pt-2">
                      <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <Lightbulb className="w-3.5 h-3.5 text-amber-600" />
                        Recommendations
                      </p>
                      {coverage.recommendations.map((rec: string, idx: number) => (
                        <div key={idx} className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-500/[0.04] border border-amber-500/10">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600/70 shrink-0 mt-0.5" />
                          <p className="text-[11px] text-muted-foreground leading-relaxed">{rec}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-6">
                  <p className="text-sm text-muted-foreground">Click to analyze knowledge gaps</p>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'flow' && (
            <motion.div key="flow" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }}>
              <div className="relative">
                <div className="space-y-0">
                  {[
                    { step: 1, icon: Upload, title: 'Contact Imported', desc: 'Name, title, company, industry parsed from CSV/Excel', color: colors.blue, detail: 'Lead data flows into the CRM with email verification' },
                    { step: 2, icon: Target, title: 'Query Constructed', desc: 'Industry + role + company size + problems form the search query', color: colors.purple, detail: 'Hybrid mode: keyword matching + TF-IDF semantic similarity' },
                    { step: 3, icon: Brain, title: 'Knowledge Retrieved', desc: `Top ${items.length > 0 ? Math.min(8, items.length) : 8} relevant assets scored and ranked by relevance`, color: 'var(--color-gold)', detail: 'Service lines, case studies, proof points, objections, CTAs' },
                    { step: 4, icon: Sparkles, title: 'Email Generated', desc: 'Retrieved knowledge injected into AI prompt with contact context', color: colors.green, detail: 'Personalized subject, body, and CTA based on matched knowledge' },
                    { step: 5, icon: Mail, title: 'Draft Ready for Review', desc: 'Draft appears in Drafts screen with source snippets and confidence scores', color: colors.amber, detail: 'You can edit, approve, or regenerate before sending' },
                  ].map((item, idx) => (
                    <div key={idx} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-lg"
                          style={{ background: `${item.color}20`, boxShadow: `0 0 16px ${item.color}15` }}
                        >
                          <item.icon className="w-4 h-4" style={{ color: item.color }} />
                        </div>
                        {idx < 4 && (
                          <div className="w-px h-8 my-1" style={{ background: `linear-gradient(180deg, ${item.color}40, transparent)` }} />
                        )}
                      </div>
                      <div className="pb-4">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: item.color }}>Step {item.step}</span>
                        </div>
                        <p className="text-sm font-semibold text-foreground mt-0.5">{item.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                        <p className="text-[11px] text-muted-foreground/70 mt-1 italic">{item.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 flex items-center gap-2 px-4 py-3 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.04]">
                  <Workflow className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs text-emerald-600 font-medium">RAG Pipeline Active</span>
                  <span className="text-[11px] text-muted-foreground ml-1">
                    - Every draft uses this pipeline. The knowledge you add here directly determines email quality.
                  </span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Category distribution bar at bottom */}
      <div className="px-6 py-3 border-t border-gray-200 bg-gray-50/50">
        <div className="flex items-center gap-4">
          {Object.entries({
            service_line: { label: 'Services', color: colors.blue },
            case_study: { label: 'Cases', color: colors.green },
            proof_point: { label: 'Proof', color: colors.purple },
            objection_response: { label: 'Objections', color: colors.red },
            cta: { label: 'CTAs', color: colors.amber },
          }).map(([cat, { label, color }]) => {
            const count = items.filter(i => i.category === cat).length;
            return (
              <div key={cat} className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[9px] text-muted-foreground">{label}</span>
                  <span className="text-[9px] tabular-nums text-muted-foreground">{count}</span>
                </div>
                <AnimatedBar value={count} max={items.length || 1} color={color} delay={0.3} />
              </div>
            );
          })}
        </div>
      </div>
    </GlassPanel>
  );
}
