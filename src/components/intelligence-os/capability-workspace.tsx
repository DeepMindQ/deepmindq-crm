'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Cpu, Sparkles, Tag, Upload, RefreshCw, Plus,
  ChevronRight, Search, Layers, CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useAppStore } from '@/lib/store';
import { logger } from '@/lib/logger';

/* ═══════════════════════════════════════════════════
   Capability Workspace
   "What are our capabilities?"
   Detailed view of all capabilities with categories
   ═══════════════════════════════════════════════════ */

interface Capability {
  id: string;
  name: string;
  category: string;
  description?: string;
  solution?: string;
  accelerator?: string;
  technology?: string;
  version?: number;
  status?: string;
}

export function CapabilityWorkspace() {
  const [capabilities, setCapabilities] = useState<Capability[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/capabilities');
      if (res.ok) {
        const d = await res.json();
        setCapabilities(Array.isArray(d) ? d : d.data ?? []);
      }
    } catch (e) { logger.error('Capability fetch error:', { error: e }); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const categories = [...new Set(capabilities.map(c => c.category || 'Uncategorized'))].sort();

  const filtered = capabilities.filter(c => {
    const matchesSearch = !searchQuery ||
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.category?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = !selectedCategory || c.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 rounded-lg bg-gray-200 animate-pulse" />
        <div className="h-12 rounded-xl bg-white border border-gray-200 animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-32 rounded-xl bg-white border border-gray-200 animate-pulse" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">Capability Workspace</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Our complete capability library — what DeepMindQ knows we can do.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => useAppStore.getState().setActiveView('activation-workspace')} className="gap-1.5 text-xs">
            <Plus className="w-3.5 h-3.5" />
            Add Capability
          </Button>
          <Button variant="outline" size="sm" onClick={fetchData} className="gap-1.5 text-xs">
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Search + Category Filter */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
          <Input
            type="search"
            placeholder="Search capabilities..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`px-2.5 py-1 text-xs rounded-lg transition-colors ${
              !selectedCategory ? 'bg-primary text-white' : 'bg-gray-100 text-muted-foreground hover:bg-gray-200'
            }`}
          >
            All ({capabilities.length})
          </button>
          {categories.slice(0, 8).map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-2.5 py-1 text-xs rounded-lg transition-colors ${
                selectedCategory === cat ? 'bg-primary text-white' : 'bg-gray-100 text-muted-foreground hover:bg-gray-200'
              }`}
            >
              {cat} ({capabilities.filter(c => c.category === cat).length})
            </button>
          ))}
        </div>
      </div>

      {/* Capability Grid */}
      {filtered.length === 0 ? (
        <div className="section-container p-12 text-center">
          <Cpu className="w-10 h-10 text-muted-foreground/20 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-foreground mb-2">
            {capabilities.length === 0 ? 'No capabilities yet' : 'No matching capabilities'}
          </h3>
          <p className="text-xs text-muted-foreground mb-4">
            {capabilities.length === 0
              ? 'Upload capabilities to tell DeepMindQ what your business can do.'
              : 'Try a different search term or category.'}
          </p>
          {capabilities.length === 0 && (
            <Button variant="outline" size="sm" onClick={() => useAppStore.getState().setActiveView('activation-workspace')} className="gap-2">
              <Upload className="w-4 h-4" />
              Upload Capabilities
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((cap, i) => (
            <motion.div
              key={cap.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.03, 0.3) }}
              className="card-interactive p-5"
            >
              <div className="flex items-start gap-3 mb-3">
                <div className="w-9 h-9 rounded-lg bg-violet-50 flex items-center justify-center shrink-0">
                  <Sparkles className="w-4 h-4 text-violet-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-foreground truncate">{cap.name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-gray-100 text-gray-600 border-0">
                      {cap.category || 'General'}
                    </Badge>
                    {cap.version && (
                      <span className="text-[10px] text-muted-foreground">v{cap.version}</span>
                    )}
                  </div>
                </div>
              </div>
              {cap.description && (
                <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">{cap.description}</p>
              )}
              {(cap.solution || cap.technology) && (
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100 flex-wrap">
                  {cap.solution && (
                    <span className="text-[10px] text-primary bg-primary/5 px-1.5 py-0.5 rounded">{cap.solution}</span>
                  )}
                  {cap.technology && (
                    <span className="text-[10px] text-muted-foreground bg-gray-50 px-1.5 py-0.5 rounded">{cap.technology}</span>
                  )}
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
