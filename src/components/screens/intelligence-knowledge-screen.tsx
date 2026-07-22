'use client';

import { PageTransition, SectionHeader } from '@/components/ui/animated-components';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Search, Filter, Database, History, GitCompare, RotateCcw, ChevronDown, RefreshCw } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useState, useCallback } from 'react';

// ─── Knowledge entry type (mirrors Prisma KnowledgeEntry) ──
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

// ─── Version types ──────────────────────────────────
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

// ─── Knowledge categories (4 groups, 14 total) ──
const KNOWLEDGE_GROUPS: Record<string, string[]> = {
  Company: ['Strategy', 'Products', 'Technology', 'Leadership'],
  Sales: ['Opportunities', 'Stakeholders', 'Conversations'],
  Technical: ['Platforms', 'Architecture', 'Patents'],
  Competitive: ['Competitors', 'Partnerships', 'Market'],
};

export default function IntelligenceKnowledgeScreen() {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // ─── Version History State ───
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [versions, setVersions] = useState<KnowledgeVersion[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [versionsExpanded, setVersionsExpanded] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // ─── Compare Dialog State ───
  const [compareDialogOpen, setCompareDialogOpen] = useState(false);
  const [compareData, setCompareData] = useState<VersionCompareResult | null>(null);
  const [compareFrom, setCompareFrom] = useState<number | null>(null);
  const [compareTo, setCompareTo] = useState<number | null>(null);

  // Fetch versions for a knowledge entry
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

  return (
    <PageTransition>
      <div className="space-y-6">
        {/* Header */}
        <SectionHeader
          title="Knowledge Fabric"
          subtitle="Structured business intelligence memory organized by company and category."
        />

        {/* Search & Filter Bar */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60" />
            <input
              type="text"
              placeholder="Search knowledge entries..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-9 pl-9 pr-3 bg-black/[0.04] border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/40"
            />
          </div>
          <Button variant="outline" size="sm" className="gap-2">
            <Filter className="w-4 h-4" />
            Filter
          </Button>
        </div>

        {/* Category Groups */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Object.entries(KNOWLEDGE_GROUPS).map(([group, categories]) => (
            <Card key={group} className="border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">{group}</CardTitle>
                <CardDescription className="text-xs">
                  {categories.length} categories
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {categories.map((cat) => (
                  <Badge
                    key={cat}
                    variant={selectedCategory === cat ? 'default' : 'outline'}
                    className="cursor-pointer text-xs"
                    onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
                  >
                    {cat}
                  </Badge>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Version History Section */}
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-muted-foreground" />
                <CardTitle className="text-sm font-semibold">Version History</CardTitle>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Enter knowledge entry ID to view versions..."
                  value={selectedEntryId ?? ''}
                  onChange={(e) => {
                    setSelectedEntryId(e.target.value || null);
                    if (e.target.value) {
                      setVersionsExpanded(true);
                      fetchVersions(e.target.value);
                    } else {
                      setVersions([]);
                      setVersionsExpanded(false);
                    }
                  }}
                  className="w-72 h-8 px-3 bg-black/[0.04] border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/40"
                />
                {selectedEntryId && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setVersionsExpanded(!versionsExpanded);
                      if (!versionsExpanded) fetchVersions(selectedEntryId);
                    }}
                    className="gap-1.5"
                  >
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform ${versionsExpanded ? 'rotate-180' : ''}`} />
                    {versionsExpanded ? 'Hide' : 'Show'}
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {!selectedEntryId ? (
              <div className="py-8 flex flex-col items-center justify-center text-center">
                <Database className="w-10 h-10 text-muted-foreground/40 mb-3" />
                <p className="text-sm text-muted-foreground">
                  Knowledge entries will appear here once intelligence is acquired.
                </p>
                <p className="text-xs text-muted-foreground/60 mt-1">
                  Enter a knowledge entry ID above to view version history.
                </p>
              </div>
            ) : versionsLoading ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="w-5 h-5 text-muted-foreground animate-spin" />
                <span className="ml-2 text-sm text-muted-foreground">Loading version history...</span>
              </div>
            ) : versionsExpanded && versions.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No version history found for this entry.</p>
            ) : versionsExpanded ? (
              <div className="space-y-2">
                {versions.map((v, idx) => (
                  <div
                    key={v.version}
                    className="flex items-start gap-3 p-3 rounded-lg border border-border/50 hover:bg-black/[0.02] transition-colors"
                  >
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-xs font-semibold text-primary">v{v.version}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground">Version {v.version}</span>
                        {idx === 0 && (
                          <Badge variant="default" className="text-xs">Latest</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{v.changeReason || 'No change reason recorded'}</p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground/70">
                        <span>{v.changedBy || 'System'}</span>
                        <span>·</span>
                        <span>{new Date(v.changedAt).toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {idx < versions.length - 1 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCompare(v.version, versions[idx + 1].version)}
                          disabled={!!actionLoading}
                          className="gap-1.5 text-xs h-7"
                        >
                          {actionLoading === 'compare' ? (
                            <RefreshCw className="w-3 h-3 animate-spin" />
                          ) : (
                            <GitCompare className="w-3 h-3" />
                          )}
                          Compare
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRestore(v.version)}
                        disabled={!!actionLoading || idx === 0}
                        className="gap-1.5 text-xs h-7"
                      >
                        {actionLoading === `restore-${v.version}` ? (
                          <RefreshCw className="w-3 h-3 animate-spin" />
                        ) : (
                          <RotateCcw className="w-3 h-3" />
                        )}
                        Restore
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>

        {/* Compare Dialog */}
        <Dialog open={compareDialogOpen} onOpenChange={setCompareDialogOpen}>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <GitCompare className="w-4 h-4" />
                Version Comparison
              </DialogTitle>
            </DialogHeader>
            {compareData && (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Badge variant="outline">v{compareFrom}</Badge>
                  <span className="text-muted-foreground text-sm">→</span>
                  <Badge variant="default">v{compareTo}</Badge>
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
                <div className="rounded-lg border border-border p-3">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Summary</h4>
                  <p className="text-sm text-foreground">{compareData.summary}</p>
                </div>
                {compareData.diff && (
                  <div className="rounded-lg border border-border p-3 max-h-64 overflow-y-auto">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Diff</h4>
                    <pre className="text-xs text-foreground whitespace-pre-wrap font-mono leading-relaxed">
                      {compareData.diff}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </PageTransition>
  );
}