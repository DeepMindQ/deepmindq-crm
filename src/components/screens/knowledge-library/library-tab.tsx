'use client';

import { useState, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  AnimatedCard, StaggerGrid, StaggerItem,
} from '@/components/ui/animated-components';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Search, RefreshCw, Database, Upload, Eye, Trash2, Globe,
} from 'lucide-react';
import { toast } from 'sonner';
import type { KnowledgeAsset } from './knowledge-utils';
import { CATEGORY_CONFIG, CATEGORY_LABELS, SERVICE_LINE_LIST } from './knowledge-types';

export function LibraryTab({
  onAssetsChanged, onSwitchTab,
}: {
  onAssetsChanged: () => void;
  onSwitchTab: (tab: string) => void;
}) {
  const [assets, setAssets] = useState<KnowledgeAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [librarySearch, setLibrarySearch] = useState('');
  const [libraryCategory, setLibraryCategory] = useState('');
  const [libraryServiceLine, setLibraryServiceLine] = useState('');
  const [viewAsset, setViewAsset] = useState<KnowledgeAsset | null>(null);

  const loadAssets = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (libraryCategory) params.set('category', libraryCategory);
      const res = await fetch(`/api/capabilities?${params}`);
      const data = await res.json();
      setAssets(Array.isArray(data) ? data : []);
    } catch { setAssets([]); }
    setLoading(false);
  }, [libraryCategory]);

  useEffect(() => { loadAssets(); }, [loadAssets]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      await fetch('/api/capabilities', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
      toast.success('Asset deleted');
      loadAssets();
      onAssetsChanged();
    } catch { toast.error('Failed to delete'); }
  }, [loadAssets, onAssetsChanged]);

  const filteredAssets = assets.filter(a => {
    if (librarySearch) {
      const q = librarySearch.toLowerCase();
      return a.title.toLowerCase().includes(q) || (a.summary || '').toLowerCase().includes(q) || (a.serviceLine || '').toLowerCase().includes(q);
    }
    if (libraryServiceLine) { return (a.serviceLine || '').toLowerCase().includes(libraryServiceLine.toLowerCase()); }
    return true;
  });

  const categoryCounts = assets.reduce<Record<string, number>>((acc, a) => { acc[a.category] = (acc[a.category] || 0) + 1; return acc; }, {});

  return (
    <div className="space-y-4">
      <AnimatedCard delay={0.1}>
        <div className="p-4 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search knowledge assets by title, summary, or service line..." value={librarySearch} onChange={e => setLibrarySearch(e.target.value)} className="pl-9 h-9 text-sm bg-background border-border" />
          </div>
          <Select value={libraryCategory} onValueChange={v => setLibraryCategory(v === '__all__' ? '' : v)}>
            <SelectTrigger className="h-10 w-[160px] text-xs bg-background border-border"><SelectValue placeholder="Category" /></SelectTrigger>
            <SelectContent className="bg-card border-border">
              <SelectItem value="__all__" className="text-xs">All Categories</SelectItem>
              {Object.entries(CATEGORY_LABELS).map(([k, v]) => (<SelectItem key={k} value={k} className="text-xs">{v}</SelectItem>))}
            </SelectContent>
          </Select>
          <Select value={libraryServiceLine} onValueChange={v => setLibraryServiceLine(v === '__all__' ? '' : v)}>
            <SelectTrigger className="h-10 w-[180px] text-xs bg-background border-border"><SelectValue placeholder="Service Line" /></SelectTrigger>
            <SelectContent className="bg-card border-border">
              <SelectItem value="__all__" className="text-xs">All Service Lines</SelectItem>
              {SERVICE_LINE_LIST.map(sl => (<SelectItem key={sl} value={sl} className="text-xs">{sl}</SelectItem>))}
            </SelectContent>
          </Select>
          <Button variant="ghost" size="sm" className="h-10 text-xs text-muted-foreground min-h-[44px]" onClick={loadAssets}>
            <RefreshCw className="w-3.5 h-3.5 mr-1" /> Refresh
          </Button>
        </div>
      </AnimatedCard>

      <StaggerGrid className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3" stagger={0.05} delay={0.15}>
        {Object.entries(CATEGORY_LABELS).map(([key, label]) => {
          const config = CATEGORY_CONFIG[key] || CATEGORY_CONFIG.service_line;
          const Icon = config.icon;
          const count = categoryCounts[key] || 0;
          return (
            <StaggerItem key={key}>
              <AnimatedCard hover className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `${config.color}15` }}><Icon className="w-4 h-4" style={{ color: config.color }} /></div>
                  <div><p className="text-lg font-bold text-foreground tabular-nums">{count}</p><p className="text-[11px] text-muted-foreground">{label}</p></div>
                </div>
              </AnimatedCard>
            </StaggerItem>
          );
        })}
      </StaggerGrid>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border bg-card/60 p-4 space-y-3">
              <Skeleton className="h-5 w-3/4" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-2/3" />
              <div className="flex gap-2"><Skeleton className="h-5 w-16" /><Skeleton className="h-5 w-20" /></div>
            </div>
          ))}
        </div>
      ) : filteredAssets.length === 0 ? (
        <AnimatedCard>
          <div className="text-center py-12 space-y-3">
            <Database className="w-12 h-12 text-muted-foreground/30 mx-auto" />
            <p className="text-sm text-muted-foreground">{assets.length === 0 ? 'No knowledge assets yet' : 'No matching assets found'}</p>
            <p className="text-xs text-muted-foreground/60">{assets.length === 0 ? 'Upload documents or add assets manually to build your knowledge base' : 'Try adjusting your search or filters'}</p>
            {assets.length === 0 && <Button size="sm" className="h-10 text-xs gap-1.5 mt-2 min-h-[44px]" onClick={() => onSwitchTab('upload')}><Upload className="w-3.5 h-3.5" />Upload Documents</Button>}
          </div>
        </AnimatedCard>
      ) : (
        <StaggerGrid className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4" stagger={0.04} delay={0.2}>
          {filteredAssets.map(asset => {
            const config = CATEGORY_CONFIG[asset.category] || CATEGORY_CONFIG.service_line;
            const Icon = config.icon;
            return (
              <StaggerItem key={asset.id}>
                <AnimatedCard hover className="p-4 flex flex-col h-full">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0" style={{ background: `${config.color}15` }}><Icon className="w-3.5 h-3.5" style={{ color: config.color }} /></div>
                      <div className="min-w-0"><p className="text-sm font-medium text-foreground truncate">{asset.title}</p></div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => setViewAsset(asset)} className="p-1 rounded-md hover:bg-gray-100 text-muted-foreground hover:text-foreground transition-colors" aria-label="View details"><Eye className="w-3.5 h-3.5" /></button>
                      <button onClick={() => handleDelete(asset.id)} className="p-1 rounded-md hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors" aria-label="Delete asset"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 mb-3 flex-1">{asset.summary}</p>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Badge variant="outline" className={`text-[11px] ${config.badge}`}>{CATEGORY_LABELS[asset.category] || asset.category}</Badge>
                    {asset.serviceLine && <Badge variant="outline" className="text-[11px] border-border text-muted-foreground">{asset.serviceLine}</Badge>}
                    {asset.targetIndustries && <Badge variant="outline" className="text-[11px] border-border text-muted-foreground"><Globe className="w-2.5 h-2.5 mr-0.5" />{asset.targetIndustries.split(',').slice(0, 2).join(', ')}</Badge>}
                  </div>
                </AnimatedCard>
              </StaggerItem>
            );
          })}
        </StaggerGrid>
      )}

      {/* View Asset Dialog */}
      {viewAsset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setViewAsset(null)}>
          <div className="bg-card rounded-xl border border-border p-6 max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <h3 className="text-lg font-bold text-foreground">{viewAsset.title}</h3>
              <button onClick={() => setViewAsset(null)} className="text-muted-foreground hover:text-foreground">✕</button>
            </div>
            <Badge variant="outline" className={`text-[11px] mb-3 ${(CATEGORY_CONFIG[viewAsset.category] || CATEGORY_CONFIG.service_line).badge}`}>{CATEGORY_LABELS[viewAsset.category] || viewAsset.category}</Badge>
            <p className="text-sm text-muted-foreground mb-4">{viewAsset.summary}</p>
            {viewAsset.content && <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{viewAsset.content}</p>}
            {viewAsset.serviceLine && <p className="text-xs text-muted-foreground mt-3">Service Line: {viewAsset.serviceLine}</p>}
            {viewAsset.targetIndustries && <p className="text-xs text-muted-foreground">Industries: {viewAsset.targetIndustries}</p>}
            {viewAsset.targetRoles && <p className="text-xs text-muted-foreground">Roles: {viewAsset.targetRoles}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
