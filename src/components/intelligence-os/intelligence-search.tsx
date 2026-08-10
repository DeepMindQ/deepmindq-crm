'use client';

import { tokens } from '@/components/intelligence-os/design-tokens';
import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, ArrowRight, Building2, Users, Brain, Sparkles,
  Zap, X, Loader2, FileText, ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useAppStore } from '@/lib/store';
import { logger } from '@/lib/logger';

/* ═══════════════════════════════════════════════════
   Intelligence Search
   Ask any question about accounts, capabilities, signals
   ═══════════════════════════════════════════════════ */

interface SearchResult {
  type: 'company' | 'capability' | 'signal' | 'contact';
  title: string;
  description: string;
  id: string;
  score?: number;
}

export function IntelligenceSearch() {
  const { setActiveView, setSelectedCompanyId } = useAppStore();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    setHasSearched(true);
    try {
      const res = await fetch('/api/ai/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery }),
      });
      if (res.ok) {
        const data = await res.json();
        setResults(data.results ?? data.data ?? []);
      } else {
        // Fallback: search companies and capabilities directly
        const [compRes, capRes] = await Promise.all([
          fetch(`/api/companies?search=${encodeURIComponent(searchQuery)}&limit=10`),
          fetch(`/api/capabilities`),
        ]);
        const compData = await compRes.json();
        const capData = await capRes.json();
        const companies = (compData.data ?? compData ?? [])
          .filter((c: any) => c.name?.toLowerCase().includes(searchQuery.toLowerCase()))
          .map((c: any) => ({
            type: 'company' as const,
            title: c.name,
            description: c.industry || c.description || '',
            id: c.id,
            score: c.score,
          }));
        const caps = (Array.isArray(capData) ? capData : capData.data ?? [])
          .filter((c: any) => c.name?.toLowerCase().includes(searchQuery.toLowerCase()))
          .map((c: any) => ({
            type: 'capability' as const,
            title: c.name,
            description: c.description || c.category || '',
            id: c.id,
          }));
        setResults([...companies, ...caps]);
      }
    } catch (e) {
      logger.error('Search error:', { error: e });
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch(query);
  };

  const handleResultClick = (result: SearchResult) => {
    if (result.type === 'company') {
      setSelectedCompanyId(result.id);
      setActiveView('company-workspace');
    }
  };

  const typeIcons = {
    company: Building2,
    capability: Sparkles,
    signal: Zap,
    contact: Users,
  };

  const typeColors = {
    company: tokens.accent.dim,
    capability: tokens.extended.purple.value,
    signal: tokens.domain.reasoning,
    contact: tokens.domain.enrichment,
  };

  return (
    <div className="flex flex-col items-center justify-start min-h-[70vh]">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-2xl"
      >
        {/* Header */}
        <div className="text-center mb-8 pt-4">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-5">
            <Search className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground mb-2">
            Intelligence Search
          </h1>
          <p className="text-sm text-muted-foreground">
            Ask any question about your accounts, capabilities, or market intelligence.
          </p>
        </div>

        {/* Search Input */}
        <div className="relative mb-8">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground/50" />
          <Input
            type="search"
            placeholder="e.g., 'What accounts have high signals?' or 'Cloud migration capabilities'"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="h-12 pl-12 pr-24 text-sm rounded-xl border-gray-200 focus-visible:border-primary/40"
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {query && (
              <button
                onClick={() => { setQuery(''); setResults([]); setHasSearched(false); }}
                className="p-1.5 rounded-md hover:bg-gray-100 text-muted-foreground"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
            <Button
              size="sm"
              onClick={() => handleSearch(query)}
              disabled={searching || !query.trim()}
              className="gap-1.5"
            >
              {searching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
              Search
            </Button>
          </div>
        </div>

        {/* Suggested Queries */}
        {!hasSearched && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="mb-8"
          >
            <p className="text-xs font-medium text-muted-foreground mb-3">Try asking:</p>
            <div className="flex flex-wrap gap-2">
              {[
                'Which accounts have the most signals?',
                'What cloud capabilities do we have?',
                'Show me high-priority accounts',
              ].map(suggestion => (
                <button
                  key={suggestion}
                  onClick={() => { setQuery(suggestion); handleSearch(suggestion); }}
                  className="px-3 py-1.5 text-xs rounded-lg bg-gray-50 border border-gray-200 text-muted-foreground hover:bg-gray-100 hover:text-foreground transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {/* Results */}
        <AnimatePresence>
          {hasSearched && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              {searching ? (
                <div className="flex items-center justify-center py-12 gap-3">
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                  <span className="text-sm text-muted-foreground">Searching intelligence...</span>
                </div>
              ) : results.length === 0 ? (
                <div className="text-center py-12">
                  <Brain className="w-10 h-10 text-muted-foreground/20 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">No results found. Try a different query.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground mb-3">{results.length} results found</p>
                  <div className="section-container divide-y divide-gray-50">
                    {results.map((result, i) => {
                      const Icon = typeIcons[result.type];
                      const color = typeColors[result.type];
                      return (
                        <motion.button
                          key={`${result.type}-${result.id}`}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: i * 0.03 }}
                          onClick={() => handleResultClick(result)}
                          className="w-full flex items-start gap-3 px-5 py-3.5 hover:bg-gray-50/50 transition-colors text-left"
                        >
                          <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                            style={{ background: `${color}12` }}
                          >
                            <Icon className="w-4 h-4" style={{ color }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium text-foreground truncate">{result.title}</p>
                              <span className="text-[10px] text-muted-foreground capitalize">{result.type}</span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{result.description}</p>
                          </div>
                          {result.score !== undefined && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-emerald-50 text-emerald-700 border-0 shrink-0">
                              {result.score}
                            </Badge>
                          )}
                          <ChevronRight className="w-4 h-4 text-muted-foreground/30 shrink-0 mt-1" />
                        </motion.button>
                      );
                    })}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
