'use client';

import { tokens } from '@/components/intelligence-os/design-tokens';
import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Brain, BookOpen, FileText, Search, Upload, Plus,
  ChevronRight, RefreshCw, Sparkles, Tag, FolderOpen,
  ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useAppStore } from '@/lib/store';
import { logger } from '@/lib/logger';

/* ═══════════════════════════════════════════════════
   Knowledge Workspace
   "What does DeepMindQ know about our business?"
   ═══════════════════════════════════════════════════ */

interface KnowledgeItem {
  id: string;
  title: string;
  type: string;
  category: string;
  description?: string;
  createdAt: string;
}

interface CapabilityItem {
  id: string;
  name: string;
  category: string;
  description?: string;
  version?: number;
}

export function KnowledgeWorkspace() {
  const [capabilities, setCapabilities] = useState<CapabilityItem[]>([]);
  const [knowledge, setKnowledge] = useState<KnowledgeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const [capRes, knRes] = await Promise.all([
        fetch('/api/capabilities'),
        fetch('/api/knowledge'),
      ]);
      if (capRes.ok) {
        const d = await capRes.json();
        setCapabilities(Array.isArray(d) ? d : d.data ?? []);
      }
      if (knRes.ok) {
        const d = await knRes.json();
        setKnowledge(Array.isArray(d) ? d : d.data ?? []);
      }
    } catch (e) {
      logger.error('Knowledge fetch error:', { error: e });
      setFetchError(e instanceof Error ? e.message : 'Failed to load knowledge data');
    }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filteredCapabilities = searchQuery
    ? capabilities.filter(c =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.category?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : capabilities;

  const filteredKnowledge = searchQuery
    ? knowledge.filter(k =>
        k.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        k.category?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : knowledge;

  const categoryCount = (items: Array<{ category: string }>) => {
    const counts: Record<string, number> = {};
    items.forEach(item => {
      const cat = item.category || 'Uncategorized';
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return counts;
  };

  const capCategories = categoryCount(capabilities);
  const knCategories = categoryCount(knowledge);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 rounded-lg bg-gray-200 animate-pulse" />
        <div className="h-12 rounded-xl bg-white border border-gray-200 animate-pulse" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-40 rounded-xl bg-white border border-gray-200 animate-pulse" />)}
        </div>
      </div>
    );
  }

  if (fetchError && capabilities.length === 0 && knowledge.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4" style={{ background: tokens.confidence.low.bg, border: '1px solid tokens.priority.critical.border' }}>
          <FolderOpen className="w-6 h-6 text-red-500" />
        </div>
        <h3 className="text-sm font-semibold text-foreground mb-1">Failed to load knowledge</h3>
        <p className="text-xs text-muted-foreground mb-4 max-w-xs">{fetchError}</p>
        <Button variant="outline" size="sm" className="text-xs" onClick={fetchData}>
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Retry
        </Button>
      </div>
    );
  }

  return (
    <div role="main" aria-label="Knowledge Intelligence" className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">Knowledge Workspace</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            What does DeepMindQ know about our business?
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => useAppStore.getState().setActiveView('activation-workspace')} className="gap-1.5 text-xs">
            <Plus className="w-3.5 h-3.5" />
            Add Knowledge
          </Button>
          <Button variant="outline" size="sm" onClick={fetchData} className="gap-1.5 text-xs">
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
        <Input
          aria-label="Search knowledge and capabilities"
          type="search"
          placeholder="Search capabilities and knowledge..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {[
          { label: 'Capabilities', value: capabilities.length, icon: Sparkles, color: 'var(--ios-opportunity)' },
          { label: 'Knowledge Items', value: knowledge.length, icon: BookOpen, color: 'var(--ios-accent-dim)' },
          { label: 'Categories', value: Object.keys(capCategories).length + Object.keys(knCategories).length, icon: Tag, color: 'var(--ios-confidence-medium)' },
        ].map(stat => (
          <div key={stat.label} className="stat-card">
            <div className="flex items-center gap-2 mb-2">
              <stat.icon className="w-3.5 h-3.5" style={{ color: stat.color }} />
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{stat.label}</span>
            </div>
            <p className="text-lg font-bold tabular-nums text-foreground">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Two columns: Capabilities + Knowledge */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Capabilities */}
        <div className="section-container">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-violet-500" />
              <h2 className="text-sm font-semibold text-foreground">Capabilities</h2>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-violet-50 text-violet-700 border-0">
                {filteredCapabilities.length}
              </Badge>
            </div>
          </div>
          <div className="divide-y divide-gray-50 max-h-[400px] overflow-y-auto">
            {filteredCapabilities.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <Sparkles className="w-8 h-8 text-muted-foreground/20 mx-auto mb-3" />
                <p className="text-xs text-muted-foreground">
                  {capabilities.length === 0 ? 'No capabilities yet. Upload capabilities to get started.' : 'No matching capabilities.'}
                </p>
              </div>
            ) : (
              filteredCapabilities.map((cap, i) => (
                <motion.div
                  key={cap.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.02 }}
                  className="flex items-start gap-3 px-5 py-3 hover:bg-gray-50/50 transition-colors cursor-pointer"
                  onClick={() => useAppStore.getState().setActiveView('capability-workspace')}
                >
                  <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center text-xs font-bold text-violet-600 shrink-0 mt-0.5">
                    {cap.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{cap.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {cap.category && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-gray-100 text-gray-600 border-0">
                          {cap.category}
                        </Badge>
                      )}
                      {cap.version && (
                        <span className="text-[10px] text-muted-foreground">v{cap.version}</span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground/30 shrink-0 mt-1" />
                </motion.div>
              ))
            )}
          </div>
        </div>

        {/* Knowledge */}
        <div className="section-container">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-blue-500" />
              <h2 className="text-sm font-semibold text-foreground">Knowledge</h2>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-blue-50 text-blue-700 border-0">
                {filteredKnowledge.length}
              </Badge>
            </div>
          </div>
          <div className="divide-y divide-gray-50 max-h-[400px] overflow-y-auto">
            {filteredKnowledge.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <BookOpen className="w-8 h-8 text-muted-foreground/20 mx-auto mb-3" />
                <p className="text-xs text-muted-foreground">
                  {knowledge.length === 0 ? 'No knowledge items yet. Upload documents to enrich the intelligence engine.' : 'No matching knowledge.'}
                </p>
              </div>
            ) : (
              filteredKnowledge.map((item, i) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.02 }}
                  className="flex items-start gap-3 px-5 py-3 hover:bg-gray-50/50 transition-colors"
                >
                  <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0 mt-0.5">
                    <FileText className="w-4 h-4 text-blue-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{item.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {item.type && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-gray-100 text-gray-600 border-0">
                          {item.type}
                        </Badge>
                      )}
                      {item.category && (
                        <span className="text-[10px] text-muted-foreground">{item.category}</span>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
