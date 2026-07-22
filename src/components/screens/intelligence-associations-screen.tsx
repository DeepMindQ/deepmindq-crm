'use client';

import { useState, useEffect, useCallback } from 'react';
import { GitBranch, Copy, AlertTriangle, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

// ─── Types ──────────────────────────────────────────
interface DuplicateItem {
  id: string;
  content: string;
  sourceType: string;
  similarityScore: number;
  sourceEntryId: string;
  targetEntryId: string;
}

interface DuplicateGroup {
  groupId: string;
  items: DuplicateItem[];
}

interface ConflictItem {
  id: string;
  objectIdA: string;
  objectIdB: string;
  category: string;
  conflictType: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

interface Association {
  id: string;
  sourceId: string;
  targetId: string;
  type: string;
  confidence: number;
  resolved: boolean;
}

// ─── Props ───────────────────────────────────────────
interface IntelligenceAssociationsScreenProps {
  companyId: string;
}

// ─── Helpers ────────────────────────────────────────
function severityColor(severity: string): string {
  switch (severity) {
    case 'critical': return 'bg-red-100 text-red-700 border-red-200';
    case 'high': return 'bg-orange-100 text-orange-700 border-orange-200';
    case 'medium': return 'bg-amber-100 text-amber-700 border-amber-200';
    default: return 'bg-gray-100 text-gray-600 border-gray-200';
  }
}

function confidenceColor(confidence: number): string {
  if (confidence >= 0.8) return 'text-emerald-600';
  if (confidence >= 0.5) return 'text-amber-600';
  return 'text-red-600';
}

// ─── Component ──────────────────────────────────────
export default function IntelligenceAssociationsScreen({ companyId }: IntelligenceAssociationsScreenProps) {
  const [activeTab, setActiveTab] = useState('duplicates');
  const [duplicateGroups, setDuplicateGroups] = useState<DuplicateGroup[]>([]);
  const [conflicts, setConflicts] = useState<ConflictItem[]>([]);
  const [associations, setAssociations] = useState<Association[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch all associations
  const fetchAssociations = useCallback(async () => {
    try {
      const res = await fetch(`/api/g-intel-acquisition/associations?companyId=${encodeURIComponent(companyId)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setAssociations(Array.isArray(json) ? json : json.associations ?? []);
    } catch (err) {
      console.error('Failed to fetch associations:', err);
    }
  }, [companyId]);

  useEffect(() => { fetchAssociations(); }, [fetchAssociations]);

  // Detect duplicates
  const handleDetectDuplicates = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/g-intel-acquisition/associations/detect-duplicates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setDuplicateGroups(Array.isArray(json) ? json : json.groups ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to detect duplicates');
    } finally {
      setLoading(false);
    }
  };

  // Detect conflicts
  const handleDetectConflicts = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/g-intel-acquisition/associations/detect-conflicts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setConflicts(Array.isArray(json) ? json : json.conflicts ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to detect conflicts');
    } finally {
      setLoading(false);
    }
  };

  // Merge a duplicate pair
  const handleMerge = async (groupId: string) => {
    setActionLoading(groupId);
    try {
      const res = await fetch('/api/g-intel-acquisition/associations/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupId, companyId }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setDuplicateGroups(prev => prev.filter(g => g.groupId !== groupId));
      fetchAssociations();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Merge failed');
    } finally {
      setActionLoading(null);
    }
  };

  // Resolve an association
  const handleResolve = async (associationId: string) => {
    setActionLoading(associationId);
    try {
      const res = await fetch('/api/g-intel-acquisition/associations/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ associationId, companyId }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setAssociations(prev =>
        prev.map(a => a.id === associationId ? { ...a, resolved: true } : a)
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Resolve failed');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-violet-50 rounded-lg">
            <GitBranch className="w-5 h-5 text-violet-600" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Intelligence Associations</h1>
            <p className="text-sm text-gray-500">Manage duplicates, conflicts, and cross-references</p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchAssociations}
          disabled={loading}
          className="gap-2"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {error}
          <button onClick={() => setError(null)} className="ml-auto text-red-500 hover:text-red-700">
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="duplicates" className="gap-1.5">
            <Copy className="w-3.5 h-3.5" />
            Duplicates
          </TabsTrigger>
          <TabsTrigger value="conflicts" className="gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" />
            Conflicts
          </TabsTrigger>
        </TabsList>

        {/* ── Duplicates Tab ── */}
        <TabsContent value="duplicates" className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">
              {duplicateGroups.length > 0
                ? `${duplicateGroups.length} duplicate group${duplicateGroups.length !== 1 ? 's' : ''} detected`
                : 'Run detection to find duplicate intelligence entries'}
            </p>
            <Button
              size="sm"
              onClick={handleDetectDuplicates}
              disabled={loading}
              className="gap-2"
            >
              <Copy className="w-3.5 h-3.5" />
              {loading && activeTab === 'duplicates' ? 'Detecting...' : 'Detect Duplicates'}
            </Button>
          </div>

          {duplicateGroups.length === 0 && !loading && (
            <Card className="border-border/50">
              <CardContent className="py-12 flex flex-col items-center justify-center text-center">
                <Copy className="w-10 h-10 text-muted-foreground/40 mb-3" />
                <p className="text-sm text-muted-foreground">No duplicate groups detected yet.</p>
                <p className="text-xs text-muted-foreground/60 mt-1">
                  Click &quot;Detect Duplicates&quot; to scan for overlapping intelligence entries.
                </p>
              </CardContent>
            </Card>
          )}

          <div className="space-y-3">
            {duplicateGroups.map((group) => (
              <Card key={group.groupId} className="border-border/50">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold text-gray-800">
                      Duplicate Group — {group.items.length} entries
                    </CardTitle>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleMerge(group.groupId)}
                      disabled={!!actionLoading}
                      className="gap-1.5"
                    >
                      {actionLoading === group.groupId ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <GitBranch className="w-3.5 h-3.5" />
                      )}
                      Merge
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {group.items.map((item, idx) => (
                      <div
                        key={item.id}
                        className="flex items-start gap-3 p-2.5 rounded-lg bg-gray-50/60 border border-gray-100"
                      >
                        <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium text-gray-600 shrink-0">
                          {idx + 1}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-gray-800 line-clamp-2">{item.content}</p>
                          <div className="flex items-center gap-3 mt-1.5">
                            <Badge variant="outline" className="text-xs">
                              {item.sourceType}
                            </Badge>
                            <span className="text-xs text-gray-500">
                              Similarity: <span className={confidenceColor(item.similarityScore)}>{(item.similarityScore * 100).toFixed(0)}%</span>
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* ── Conflicts Tab ── */}
        <TabsContent value="conflicts" className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">
              {conflicts.length > 0
                ? `${conflicts.length} conflict${conflicts.length !== 1 ? 's' : ''} detected`
                : 'Run detection to find conflicting intelligence entries'}
            </p>
            <Button
              size="sm"
              onClick={handleDetectConflicts}
              disabled={loading}
              className="gap-2"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              {loading && activeTab === 'conflicts' ? 'Detecting...' : 'Detect Conflicts'}
            </Button>
          </div>

          {conflicts.length === 0 && !loading && (
            <Card className="border-border/50">
              <CardContent className="py-12 flex flex-col items-center justify-center text-center">
                <CheckCircle className="w-10 h-10 text-muted-foreground/40 mb-3" />
                <p className="text-sm text-muted-foreground">No conflicts detected.</p>
                <p className="text-xs text-muted-foreground/60 mt-1">
                  Click &quot;Detect Conflicts&quot; to scan for contradictory intelligence entries.
                </p>
              </CardContent>
            </Card>
          )}

          <div className="space-y-3">
            {conflicts.map((c) => (
              <Card key={c.id} className="border-border/50">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-sm font-semibold text-gray-800">
                        {c.conflictType.replace(/_/g, ' ')}
                      </CardTitle>
                      <Badge variant="outline" className={severityColor(c.severity)}>
                        {c.severity.toUpperCase()}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-sm text-gray-700">{c.description}</p>
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span>
                      <span className="font-medium text-gray-600">Object A:</span> {c.objectIdA.slice(0, 12)}...
                    </span>
                    <span>
                      <span className="font-medium text-gray-600">Object B:</span> {c.objectIdB.slice(0, 12)}...
                    </span>
                    <Badge variant="outline" className="text-xs">{c.category}</Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* ── All Associations ── */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-gray-800">All Associations</CardTitle>
        </CardHeader>
        <CardContent>
          {associations.length === 0 ? (
            <p className="text-sm text-gray-400 py-4">No associations found for this company.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                    <th className="pb-2 font-medium">Source ID</th>
                    <th className="pb-2 font-medium">Target ID</th>
                    <th className="pb-2 font-medium">Type</th>
                    <th className="pb-2 font-medium">Confidence</th>
                    <th className="pb-2 font-medium">Status</th>
                    <th className="pb-2 font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {associations.map((a) => (
                    <tr key={a.id} className="hover:bg-gray-50 transition-colors">
                      <td className="py-2.5 text-gray-600 font-mono text-xs">{a.sourceId.slice(0, 16)}...</td>
                      <td className="py-2.5 text-gray-600 font-mono text-xs">{a.targetId.slice(0, 16)}...</td>
                      <td className="py-2.5">
                        <Badge variant="outline" className="text-xs">{a.type}</Badge>
                      </td>
                      <td className="py-2.5">
                        <span className={`text-xs font-medium ${confidenceColor(a.confidence)}`}>
                          {(a.confidence * 100).toFixed(0)}%
                        </span>
                      </td>
                      <td className="py-2.5">
                        {a.resolved ? (
                          <span className="flex items-center gap-1 text-xs text-emerald-600">
                            <CheckCircle className="w-3 h-3" /> Resolved
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs text-amber-600">
                            <XCircle className="w-3 h-3" /> Open
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 text-right">
                        {!a.resolved && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleResolve(a.id)}
                            disabled={!!actionLoading}
                            className="gap-1.5"
                          >
                            {actionLoading === a.id ? (
                              <RefreshCw className="w-3 h-3 animate-spin" />
                            ) : (
                              <CheckCircle className="w-3 h-3" />
                            )}
                            Resolve
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}