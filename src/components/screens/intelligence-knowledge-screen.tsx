'use client';

import { useState, useCallback } from 'react';
import {
  Search, Database, Sparkles, BookOpen, Layers, Tag,
  ChevronRight, ExternalLink, Clock, Brain, Building2,
  RotateCcw, GitCompare, ChevronDown, RefreshCw, FileText,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EmptyState } from '@/components/shared/design-system';
import { ConfidenceBar } from '@/components/enterprise/ConfidenceBar';
import { EvidenceBadge } from '@/components/enterprise/EvidenceBadge';

/* ═══════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════ */
interface KnowledgeEntry {
  id: string;
  companyId: string;
  companyName?: string;
  category: string;
  subCategory: string | null;
  content: string;
  source: string | null;
  confidence: number;
  version: number;
  updatedAt: string;
}

interface KnowledgeVersion {
  version: number;
  changeReason: string;
  changedBy: string;
  changedAt: string;
  content: string;
}

interface VersionCompareResult {
  linesAdded: number;
  linesRemoved: number;
  summary: string;
  diff: string;
}

/* ═══════════════════════════════════════════════════════════════
   Knowledge categories (4 groups, 14 total)
   ═══════════════════════════════════════════════════════════════ */
const KNOWLEDGE_GROUPS: Record<string, { icon: typeof BookOpen; color: string; categories: string[] }> = {
  Company:    { icon: Building2,  color: 'text-blue-600',    categories: ['Strategy', 'Products', 'Technology', 'Leadership'] },
  Sales:      { icon: Sparkles,  color: 'text-emerald-600', categories: ['Opportunities', 'Stakeholders', 'Conversations'] },
  Technical:  { icon: Brain,     color: 'text-violet-600',  categories: ['Platforms', 'Architecture', 'Patents'] },
  Competitive:{ icon: Layers,    color: 'text-amber-600',   categories: ['Competitors', 'Partnerships', 'Market'] },
};

const ALL_CATEGORIES = Object.values(KNOWLEDGE_GROUPS).flatMap(g => g.categories);

// Mock data for demonstration
const MOCK_KNOWLEDGE: KnowledgeEntry[] = [
  { id: 'ke-1', companyId: 'comp-1', companyName: 'Acme Corp', category: 'Strategy', subCategory: null, content: 'Acme Corp is pursuing a cloud-first strategy with a $50M investment in AWS infrastructure. Their digital transformation roadmap focuses on AI-driven customer analytics by Q3 2025.', source: 'news', confidence: 87, version: 3, updatedAt: '2025-01-15T10:30:00Z' },
  { id: 'ke-2', companyId: 'comp-1', companyName: 'Acme Corp', category: 'Technology', subCategory: 'Cloud', content: 'The engineering team recently adopted Kubernetes for container orchestration. They are hiring 15 cloud architects and DevOps engineers, signaling a major infrastructure modernization effort.', source: 'web', confidence: 82, version: 2, updatedAt: '2025-01-14T08:00:00Z' },
  { id: 'ke-3', companyId: 'comp-2', companyName: 'TechVenture Inc', category: 'Competitors', subCategory: null, content: 'TechVenture Inc has formed a strategic partnership with CloudScale Technologies for joint product development in the SaaS space. This partnership targets mid-market enterprises in the fintech vertical.', source: 'filing', confidence: 94, version: 1, updatedAt: '2025-01-13T14:20:00Z' },
  { id: 'ke-4', companyId: 'comp-1', companyName: 'Acme Corp', category: 'Leadership', subCategory: 'C-Suite', content: 'Sarah Chen appointed as new CTO. Previous VP Engineering at Microsoft Azure division. Brings 15+ years of enterprise cloud experience and is expected to drive the cloud migration initiative.', source: 'social', confidence: 91, version: 1, updatedAt: '2025-01-12T16:45:00Z' },
  { id: 'ke-5', companyId: 'comp-3', companyName: 'GlobalData Ltd', category: 'Market', subCategory: null, content: 'The enterprise data analytics market is projected to grow at 25% CAGR through 2028. GlobalData Ltd is positioned as a key player with their proprietary ML-powered analytics platform.', source: 'analytics', confidence: 76, version: 4, updatedAt: '2025-01-11T09:15:00Z' },
  { id: 'ke-6', companyId: 'comp-2', companyName: 'TechVenture Inc', category: 'Opportunities', subCategory: null, content: 'TechVenture is expanding into the healthcare SaaS market. Their product roadmap includes HIPAA-compliant data management tools, creating a partnership opportunity for compliance-focused integrations.', source: 'news', confidence: 85, version: 2, updatedAt: '2025-01-10T11:30:00Z' },
];

/* ═══════════════════════════════════════════════════════════════
   Knowledge Card Component
   ═══════════════════════════════════════════════════════════════ */
function KnowledgeCard({ entry }: { entry: KnowledgeEntry }) {
  const [expanded, setExpanded] = useState(false);
  const group = Object.entries(KNOWLEDGE_GROUPS).find(([_, g]) => g.categories.includes(entry.category));
  const groupColor = group ? KNOWLEDGE_GROUPS[group[0]].color : 'text-slate-600';

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition-all group">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* Company & Category */}
          <div className="flex items-center gap-2 flex-wrap mb-2">
            {entry.companyName && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-700 bg-slate-50 px-2 py-0.5 rounded-md">
                <Building2 className="h-3 w-3" />
                {entry.companyName}
              </span>
            )}
            <Badge variant="outline" className={cn('text-[10px]', groupColor)}>
              {entry.category}
            </Badge>
            {entry.subCategory && (
              <Badge variant="outline" className="text-[10px] text-slate-400 bg-slate-50">
                {entry.subCategory}
              </Badge>
            )}
          </div>

          {/* AI Summary */}
          <p className={cn(
            'text-sm text-slate-700 leading-relaxed',
            !expanded && 'line-clamp-3'
          )}>
            {entry.content}
          </p>
          {entry.content.length > 150 && (
            <button
              onClick={() => setExpanded(v => !v)}
              className="mt-1 flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
            >
              {expanded ? 'Show less' : 'Read more'}
              <ChevronRight className={cn('h-3 w-3 transition-transform', expanded && 'rotate-90')} />
            </button>
          )}
        </div>

        {/* Confidence score */}
        <div className="shrink-0 w-16 text-center">
          <ConfidenceBar value={entry.confidence} size="sm" />
        </div>
      </div>

      {/* Footer */}
      <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {entry.source && <EvidenceBadge source={entry.source} />}
          <span className="text-[11px] text-slate-400 flex items-center gap-1">
            <Clock className="h-3 w-3" />
            v{entry.version}
          </span>
        </div>
        <span className="text-[11px] text-slate-400">
          {new Date(entry.updatedAt).toLocaleDateString()}
        </span>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Main Component
   ═══════════════════════════════════════════════════════════════ */
export default function IntelligenceKnowledgeScreen() {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTab, setSelectedTab] = useState<string>('browse');

  // Version history state
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [versions, setVersions] = useState<KnowledgeVersion[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [versionsExpanded, setVersionsExpanded] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [compareDialogOpen, setCompareDialogOpen] = useState(false);
  const [compareData, setCompareData] = useState<VersionCompareResult | null>(null);
  const [compareFrom, setCompareFrom] = useState<number | null>(null);
  const [compareTo, setCompareTo] = useState<number | null>(null);

  const fetchVersions = useCallback(async (entryId: string) => {
    setVersionsLoading(true);
    setVersions([]);
    try {
      const res = await fetch(`/api/g-intel-acquisition/knowledge/${encodeURIComponent(entryId)}/versions`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setVersions(Array.isArray(json) ? json : json.versions ?? []);
    } catch (err) {
      console.error('Failed to fetch versions:', err);
      setVersions([]);
    } finally {
      setVersionsLoading(false);
    }
  }, []);

  const handleCompare = async (fromV: number, toV: number) => {
    if (!selectedEntryId) return;
    setActionLoading('compare');
    try {
      const res = await fetch(`/api/g-intel-acquisition/knowledge/${encodeURIComponent(selectedEntryId)}/versions/compare`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fromVersion: fromV, toVersion: toV }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: VersionCompareResult = await res.json();
      setCompareData(json);
      setCompareFrom(fromV);
      setCompareTo(toV);
      setCompareDialogOpen(true);
    } catch (err) {
      console.error('Compare failed:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRestore = async (version: number) => {
    if (!selectedEntryId) return;
    setActionLoading(`restore-${version}`);
    try {
      const res = await fetch(`/api/g-intel-acquisition/knowledge/${encodeURIComponent(selectedEntryId)}/versions/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      fetchVersions(selectedEntryId);
    } catch (err) {
      console.error('Restore failed:', err);
    } finally {
      setActionLoading(null);
    }
  };

  // Filter knowledge entries
  const filteredEntries = MOCK_KNOWLEDGE.filter(entry => {
    const matchesCategory = !selectedCategory || entry.category === selectedCategory;
    const matchesSearch = !searchQuery.trim() ||
      entry.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.companyName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Related entities extraction
  const getRelatedEntities = (entry: KnowledgeEntry) => {
    const entities: string[] = [];
    if (entry.companyName) entities.push(entry.companyName);
    if (entry.subCategory) entities.push(entry.subCategory);
    return entities;
  };

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50">
            <Database className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900">Knowledge Base</h2>
            <p className="text-sm text-slate-500">Structured business intelligence organized by category</p>
          </div>
        </div>
        <Badge variant="outline" className="self-start text-xs bg-blue-50 text-blue-700 border-blue-200">
          {MOCK_KNOWLEDGE.length} entries
        </Badge>
      </div>

      {/* ── Search Bar ── */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-4">
        <div className="relative max-w-xl">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search knowledge entries by content, company, or category..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full h-10 pl-10 pr-4 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
          />
        </div>
      </div>

      {/* ── Category Tabs ── */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        <button
          onClick={() => setSelectedCategory(null)}
          className={cn(
            'px-3.5 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap',
            !selectedCategory
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          )}
        >
          All Categories
        </button>
        {ALL_CATEGORIES.map(cat => {
          const group = Object.entries(KNOWLEDGE_GROUPS).find(([_, g]) => g.categories.includes(cat));
          const isActive = selectedCategory === cat;
          return (
            <button
              key={cat}
              onClick={() => setSelectedCategory(isActive ? null : cat)}
              className={cn(
                'px-3.5 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap',
                isActive
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              )}
            >
              {cat}
            </button>
          );
        })}
      </div>

      {/* ── Category Group Cards (compact) ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Object.entries(KNOWLEDGE_GROUPS).map(([groupName, group]) => {
          const count = MOCK_KNOWLEDGE.filter(e => group.categories.includes(e.category)).length;
          return (
            <div
              key={groupName}
              className={cn(
                'rounded-lg border p-3 cursor-pointer transition-all hover:shadow-sm',
                selectedCategory && group.categories.includes(selectedCategory)
                  ? 'border-blue-300 bg-blue-50/50'
                  : 'border-slate-200 bg-white'
              )}
              onClick={() => {
                const cat = group.categories[0];
                setSelectedCategory(selectedCategory === cat ? null : cat);
              }}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <group.icon className={cn('h-4 w-4', group.color)} />
                <span className="text-xs font-semibold text-slate-700">{groupName}</span>
              </div>
              <p className="text-[11px] text-slate-400">{count} entries · {group.categories.length} subcategories</p>
            </div>
          );
        })}
      </div>

      {/* ── Knowledge Cards ── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-900">
            {selectedCategory ? selectedCategory : 'All'} Knowledge
          </h3>
          <span className="text-xs text-slate-400">{filteredEntries.length} result{filteredEntries.length !== 1 ? 's' : ''}</span>
        </div>

        {filteredEntries.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title="No knowledge entries found"
            description="Try adjusting your search or category filter to find relevant intelligence."
          />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filteredEntries.map(entry => (
              <div key={entry.id}>
                <KnowledgeCard entry={entry} />
                {/* Related entities */}
                {entry.companyName && (
                  <div className="mt-2 px-1 flex items-center gap-2">
                    <span className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">Related:</span>
                    {getRelatedEntities(entry).map((entity, i) => (
                      <Badge key={i} variant="outline" className="text-[10px] bg-slate-50 text-slate-500">
                        {entity}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Version History ── */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="p-4 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <RotateCcw className="h-4 w-4 text-slate-400" />
              <h3 className="text-sm font-semibold text-slate-900">Version History</h3>
            </div>
          </div>
          <div className="mt-3">
            <Input
              className="h-9 text-sm border-slate-200 max-w-md"
              placeholder="Enter knowledge entry ID to view versions..."
              value={selectedEntryId ?? ''}
              onChange={e => {
                setSelectedEntryId(e.target.value || null);
                if (e.target.value) {
                  setVersionsExpanded(true);
                  fetchVersions(e.target.value);
                } else {
                  setVersions([]);
                  setVersionsExpanded(false);
                }
              }}
            />
          </div>
        </div>

        {!selectedEntryId ? (
          <div className="p-8">
            <EmptyState
              icon={RotateCcw}
              title="View version history"
              description="Enter a knowledge entry ID above to view its version history, compare versions, or restore previous versions."
            />
          </div>
        ) : versionsLoading ? (
          <div className="p-6">
            <div className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4 text-blue-600 animate-spin" />
              <span className="text-sm text-slate-500">Loading version history...</span>
            </div>
          </div>
        ) : versionsExpanded && versions.length === 0 ? (
          <p className="p-4 text-sm text-slate-400 text-center">No version history found for this entry.</p>
        ) : versionsExpanded ? (
          <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
            {versions.map((v, idx) => (
              <div key={v.version} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors">
                <div className="h-8 w-8 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                  <span className="text-xs font-semibold text-blue-600">v{v.version}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-700">Version {v.version}</span>
                    {idx === 0 && <Badge className="text-[10px] bg-blue-600 text-white">Latest</Badge>}
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{v.changeReason || 'No change reason'}</p>
                  <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-400">
                    <span>{v.changedBy || 'System'}</span>
                    <span>·</span>
                    <span>{new Date(v.changedAt).toLocaleString()}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {idx < versions.length - 1 && (
                    <Button variant="outline" size="sm"
                      onClick={() => handleCompare(v.version, versions[idx + 1].version)}
                      disabled={!!actionLoading}
                      className="h-7 text-[11px] border-slate-200 text-slate-600 hover:bg-slate-50 gap-1">
                      {actionLoading === 'compare' ? <RefreshCw className="h-3 w-3 animate-spin" /> : <GitCompare className="h-3 w-3" />}
                      Compare
                    </Button>
                  )}
                  <Button variant="outline" size="sm"
                    onClick={() => handleRestore(v.version)}
                    disabled={!!actionLoading || idx === 0}
                    className="h-7 text-[11px] border-slate-200 text-slate-600 hover:bg-slate-50 gap-1">
                    {actionLoading === `restore-${v.version}` ? <RefreshCw className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
                    Restore
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {/* ── Compare Dialog ── */}
      <Dialog open={compareDialogOpen} onOpenChange={setCompareDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GitCompare className="h-4 w-4" />
              Version Comparison
            </DialogTitle>
          </DialogHeader>
          {compareData && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Badge variant="outline">v{compareFrom}</Badge>
                <span className="text-slate-400 text-sm">→</span>
                <Badge className="bg-blue-600 text-white">v{compareTo}</Badge>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-center">
                  <div className="text-2xl font-bold text-emerald-600">+{compareData.linesAdded}</div>
                  <div className="text-xs text-emerald-700 mt-0.5">Lines Added</div>
                </div>
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-center">
                  <div className="text-2xl font-bold text-red-600">-{compareData.linesRemoved}</div>
                  <div className="text-xs text-red-700 mt-0.5">Lines Removed</div>
                </div>
              </div>
              <div className="rounded-lg border border-slate-200 p-3">
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Summary</h4>
                <p className="text-sm text-slate-700">{compareData.summary}</p>
              </div>
              {compareData.diff && (
                <div className="rounded-lg border border-slate-200 p-3 max-h-64 overflow-y-auto">
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Diff</h4>
                  <pre className="text-xs text-slate-700 whitespace-pre-wrap font-mono leading-relaxed">{compareData.diff}</pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
