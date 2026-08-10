'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AnimatedCard, StaggerGrid, StaggerItem,
} from '@/components/ui/animated-components';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Search, Sparkles, Loader2, Filter, CheckCircle2, Brain, ArrowUpRight, ChevronDown, ChevronUp, Cpu,
} from 'lucide-react';
import { CATEGORY_CONFIG, CATEGORY_LABELS, MATCHED_FIELD_LABELS, INDUSTRY_LIST, ROLE_LIST, goldAlpha, blackAlpha } from './knowledge-types';

interface SearchResult {
  id: string; title: string; summary: string; category: string;
  relevanceScore: number; matchedFields: string[]; serviceLine?: string; content?: string;
}

export function SearchTab({ navigateTo }: { navigateTo?: (screen: string) => void }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchIndustry, setSearchIndustry] = useState('');
  const [searchRole, setSearchRole] = useState('');
  const [searchMode, setSearchMode] = useState('hybrid');
  const [minScore, setMinScore] = useState(0);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [totalMatches, setTotalMatches] = useState(0);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [searchProblems, setSearchProblems] = useState('');
  const [searchCompanySize, setSearchCompanySize] = useState('');

  const gold = 'var(--color-gold-dim)';
  const goldLight = 'var(--color-gold)';

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;
    setSearchLoading(true); setHasSearched(true);
    try {
      const body: Record<string, unknown> = {
        query: searchQuery.trim(), industry: searchIndustry || undefined, role: searchRole || undefined,
        category: undefined, companySize: searchCompanySize || undefined, serviceLine: undefined,
        problems: searchProblems || undefined, searchMode, minRelevanceScore: minScore > 0 ? minScore : undefined,
        includeContent: true, limit: 12,
      };
      const res = await fetch('/api/knowledge/search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      setSearchResults(data.results || []); setTotalMatches(data.totalMatches || 0);
    } catch { setSearchResults([]); setTotalMatches(0); }
    setSearchLoading(false);
  }, [searchQuery, searchIndustry, searchRole, searchMode, minScore, searchProblems, searchCompanySize]);

  return (
    <div className="space-y-4">
      <AnimatedCard delay={0.1}>
        <div className="p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `linear-gradient(135deg, ${goldAlpha(0.2)}, ${goldAlpha(0.05)})` }}><Cpu className="w-5 h-5" style={{ color: gold }} /></div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">DeepMindQ Knowledge Retrieval Engine v2.0</p>
            <p className="text-xs text-muted-foreground">Hybrid search (keyword + semantic TF-overlap) with multi-field weighted scoring, industry/role boosting, and category-aware ranking</p>
          </div>
          <Badge variant="outline" className="text-[11px] border-emerald-500/30 text-emerald-600 bg-emerald-500/5 shrink-0"><CheckCircle2 className="w-3 h-3 mr-1" />Active</Badge>
        </div>
      </AnimatedCard>

      <AnimatedCard delay={0.15}>
        <div className="p-4 space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[240px]">
              <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: gold }} />
              <Input placeholder="Describe a prospect's context: industry, role, company, challenges..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearch()} className="pl-10 h-10 text-sm bg-background border-border" />
            </div>
            <Select value={searchIndustry} onValueChange={v => setSearchIndustry(v === '__all__' ? '' : v)}>
              <SelectTrigger className="h-10 w-[150px] text-xs bg-background border-border"><SelectValue placeholder="Industry" /></SelectTrigger>
              <SelectContent className="bg-card border-border">
                <SelectItem value="__all__" className="text-xs">Any Industry</SelectItem>
                {INDUSTRY_LIST.map(i => (<SelectItem key={i} value={i} className="text-xs">{i}</SelectItem>))}
              </SelectContent>
            </Select>
            <Select value={searchRole} onValueChange={v => setSearchRole(v === '__all__' ? '' : v)}>
              <SelectTrigger className="h-10 w-[160px] text-xs bg-background border-border"><SelectValue placeholder="Role" /></SelectTrigger>
              <SelectContent className="bg-card border-border">
                <SelectItem value="__all__" className="text-xs">Any Role</SelectItem>
                {ROLE_LIST.map(r => (<SelectItem key={r} value={r} className="text-xs">{r}</SelectItem>))}
              </SelectContent>
            </Select>
            <Button className="h-10 text-sm gap-2" style={{ background: `linear-gradient(135deg, ${gold}, ${goldLight})`, color: 'var(--dmq-black)' }} disabled={!searchQuery.trim() || searchLoading} onClick={handleSearch}>
              {searchLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}Search Knowledge
            </Button>
            <Button variant="ghost" size="sm" className="h-10 text-xs text-muted-foreground" onClick={() => setShowAdvanced(!showAdvanced)}>
              <Filter className="w-3.5 h-3.5 mr-1" />Advanced{showAdvanced ? <ChevronUp className="w-3 h-3 ml-1" /> : <ChevronDown className="w-3 h-3 ml-1" />}
            </Button>
          </div>
          <AnimatePresence>
            {showAdvanced && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                <div className="p-4 rounded-lg border border-border bg-card/50 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Search Mode</Label>
                      <Select value={searchMode} onValueChange={setSearchMode}>
                        <SelectTrigger className="h-10 text-xs bg-background border-border"><SelectValue /></SelectTrigger>
                        <SelectContent className="bg-card border-border">
                          <SelectItem value="keyword" className="text-xs">Keyword</SelectItem>
                          <SelectItem value="semantic" className="text-xs">Semantic (TF-Overlap)</SelectItem>
                          <SelectItem value="hybrid" className="text-xs">Hybrid (Recommended)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Company Size</Label>
                      <Select value={searchCompanySize} onValueChange={v => setSearchCompanySize(v === '__all__' ? '' : v)}>
                        <SelectTrigger className="h-10 text-xs bg-background border-border"><SelectValue placeholder="Any Size" /></SelectTrigger>
                        <SelectContent className="bg-card border-border">
                          <SelectItem value="__all__" className="text-xs">Any Size</SelectItem>
                          <SelectItem value="Startup" className="text-xs">Startup</SelectItem>
                          <SelectItem value="Mid-Market" className="text-xs">Mid-Market</SelectItem>
                          <SelectItem value="Enterprise" className="text-xs">Enterprise</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Problem Statement</Label>
                      <Input placeholder="e.g. data silos, legacy infrastructure" value={searchProblems} onChange={e => setSearchProblems(e.target.value)} className="h-8 text-xs bg-background border-border" />
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs text-muted-foreground">Min Relevance</Label>
                        <span className="text-xs font-medium tabular-nums" style={{ color: gold }}>{minScore}%</span>
                      </div>
                      <Slider value={[minScore]} onValueChange={([v]) => setMinScore(v)} min={0} max={80} step={5} className="w-full mt-2" />
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </AnimatedCard>

      {searchLoading && <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" style={{ color: gold }} /><span className="ml-3 text-sm text-muted-foreground">Searching knowledge base with {searchMode} mode...</span></div>}
      {!searchLoading && hasSearched && searchResults.length === 0 && (
        <AnimatedCard><div className="text-center py-12 space-y-3"><Search className="w-12 h-12 text-muted-foreground/30 mx-auto" /><p className="text-sm text-muted-foreground">No matching knowledge found</p><p className="text-xs text-muted-foreground/60">Try different keywords, lower the minimum score, or switch to semantic mode</p></div></AnimatedCard>
      )}
      {!searchLoading && searchResults.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-3">
              <p className="text-sm text-muted-foreground"><span className="font-semibold text-foreground">{totalMatches}</span> match{totalMatches !== 1 ? 'es' : ''} found</p>
              <Badge variant="outline" className="text-[11px] border-border text-muted-foreground">Mode: {searchMode}</Badge>
            </div>
            {navigateTo && <button onClick={() => navigateTo('capabilities')} className="text-xs flex items-center gap-1 transition-colors" style={{ color: gold }}>Manage in Capability Library <ArrowUpRight className="w-3 h-3" /></button>}
          </div>
          <StaggerGrid className="space-y-3" stagger={0.04} delay={0.1}>
            {searchResults.map((result, idx) => {
              const config = CATEGORY_CONFIG[result.category] || CATEGORY_CONFIG.service_line;
              return (
                <StaggerItem key={result.id}>
                  <AnimatedCard hover className="p-4" delay={idx * 0.04}>
                    <div className="flex items-start gap-4">
                      <div className="shrink-0 flex flex-col items-center gap-1.5 w-14">
                        <span className="text-lg font-bold tabular-nums" style={{ color: result.relevanceScore >= 80 ? 'var(--dmq-emerald-light)' : result.relevanceScore >= 50 ? 'var(--dmq-amber)' : 'var(--dmq-rose)' }}>{result.relevanceScore}%</span>
                        <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                          <motion.div className="h-full rounded-full" style={{ background: result.relevanceScore >= 80 ? 'var(--dmq-emerald-light)' : result.relevanceScore >= 50 ? 'var(--dmq-amber)' : 'var(--dmq-rose)' }} initial={{ width: 0 }} animate={{ width: `${result.relevanceScore}%` }} transition={{ duration: 0.6, delay: idx * 0.05 }} />
                        </div>
                        <span className="text-[9px] text-muted-foreground uppercase tracking-wider">Relevance</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                          <p className="text-sm font-semibold text-foreground truncate">{result.title}</p>
                          <Badge variant="outline" className={`text-[11px] shrink-0 ${config.badge}`}>{CATEGORY_LABELS[result.category] || result.category}</Badge>
                          {result.serviceLine && <Badge variant="outline" className="text-[11px] border-border text-muted-foreground shrink-0">{result.serviceLine}</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 mb-2">{result.summary}</p>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[11px] text-muted-foreground">Matched:</span>
                          {result.matchedFields.map(field => (<span key={field} className="inline-flex items-center text-[11px] px-1.5 py-0.5 rounded" style={{ background: `${goldAlpha(0.08)}`, color: gold }}>{MATCHED_FIELD_LABELS[field] || field}</span>))}
                        </div>
                        {result.content && <div className="mt-3 p-3 rounded-lg bg-muted/30 border border-border/50"><p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-3">{result.content}</p></div>}
                      </div>
                      <div className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold" style={{ background: idx === 0 ? 'linear-gradient(135deg, var(--dmq-gold), var(--dmq-gold-light))' : `${blackAlpha(0.04)}`, color: idx === 0 ? 'var(--dmq-black)' : 'text-muted-foreground' }}>{idx + 1}</div>
                    </div>
                  </AnimatedCard>
                </StaggerItem>
              );
            })}
          </StaggerGrid>
        </div>
      )}
      {!searchLoading && !hasSearched && (
        <AnimatedCard delay={0.2}>
          <div className="text-center py-16 space-y-4">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto" style={{ background: `linear-gradient(135deg, ${goldAlpha(0.15)}, ${goldAlpha(0.05)})` }}><Brain className="w-8 h-8" style={{ color: gold }} /></div>
            <div><p className="text-sm font-medium text-foreground mb-1">Test the Knowledge Engine</p><p className="text-xs text-muted-foreground max-w-md mx-auto">Enter a prospect's context (industry, role, company, challenges) to see how the RAG engine retrieves and ranks relevant knowledge for email personalization</p></div>
            <div className="flex items-center justify-center gap-2 flex-wrap">
              {['CTO in Financial Services needing AI solutions', 'Healthcare VP of Engineering cloud migration', 'Mid-market retailer with data silos'].map(q => (
                <button key={q} onClick={() => setSearchQuery(q)} className="text-[11px] px-3 py-2.5 rounded-full border border-border text-muted-foreground hover:border-primary/30 hover:text-primary transition-colors min-h-[44px]">{q}</button>
              ))}
            </div>
          </div>
        </AnimatedCard>
      )}
    </div>
  );
}
