'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  GitBranch, Copy, AlertTriangle, CheckCircle, XCircle, RefreshCw,
  Building2, Users, Zap, Target, ArrowRight, Loader2,
  ChevronRight, Search,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { EmptyState } from '@/components/shared/design-system';
import { ErrorState } from '@/components/enterprise/ErrorState';
import { ConfidenceBar } from '@/components/enterprise/ConfidenceBar';

/* ═══════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════ */
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

interface EntityNode {
  id: string;
  name: string;
  type: 'company' | 'person' | 'signal' | 'opportunity';
  description?: string;
}

interface EntityLink {
  id: string;
  sourceId: string;
  targetId: string;
  type: string;
  label: string;
  confidence: number;
}

/* ═══════════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════════ */
function severityColor(severity: string): string {
  switch (severity) {
    case 'critical': return 'bg-red-100 text-red-700 border-red-200';
    case 'high': return 'bg-orange-100 text-orange-700 border-orange-200';
    case 'medium': return 'bg-amber-100 text-amber-700 border-amber-200';
    default: return 'bg-slate-100 text-slate-600 border-slate-200';
  }
}

function confidenceColor(confidence: number): string {
  if (confidence >= 0.8) return 'text-emerald-600';
  if (confidence >= 0.5) return 'text-amber-600';
  return 'text-red-600';
}

const ENTITY_TYPE_CONFIG: Record<string, { icon: typeof Building2; color: string; bg: string; border: string }> = {
  company:      { icon: Building2,  color: 'text-blue-600',    bg: 'bg-blue-50',    border: 'border-blue-200' },
  person:       { icon: Users,       color: 'text-violet-600', bg: 'bg-violet-50',   border: 'border-violet-200' },
  signal:       { icon: Zap,         color: 'text-amber-600',  bg: 'bg-amber-50',   border: 'border-amber-200' },
  opportunity:  { icon: Target,      color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
};

const LINK_TYPE_CONFIG: Record<string, { color: string; dashStyle?: string }> = {
  'company-to-company':  { color: '#2563EB' },
  'people-to-people':    { color: '#7C3AED' },
  'signal-to-opportunity': { color: '#10B981' },
  'company-to-person':   { color: '#F59E0B' },
};

/* ═══════════════════════════════════════════════════════════════
   Entity Relationship Node Card
   ═══════════════════════════════════════════════════════════════ */
function EntityNodeCard({ node, isSelected, onClick }: {
  node: EntityNode;
  isSelected: boolean;
  onClick: () => void;
}) {
  const cfg = ENTITY_TYPE_CONFIG[node.type] ?? ENTITY_TYPE_CONFIG.company;
  const Icon = cfg.icon;

  return (
    <button
      onClick={onClick}
      className={cn(
        'text-left rounded-xl border p-4 shadow-sm transition-all hover:shadow-md',
        isSelected ? 'ring-2 ring-blue-400 border-blue-300 bg-blue-50/50' : 'border-slate-200 bg-white'
      )}
    >
      <div className="flex items-center gap-3">
        <div className={cn('flex h-9 w-9 items-center justify-center rounded-lg', cfg.bg)}>
          <Icon className={cn('h-4 w-4', cfg.color)} />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-800 truncate">{node.name}</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <Badge variant="outline" className={cn('text-[10px]', cfg.bg, cfg.color, cfg.border)}>
              {node.type}
            </Badge>
          </div>
        </div>
      </div>
      {node.description && (
        <p className="mt-2 text-xs text-slate-500 line-clamp-2">{node.description}</p>
      )}
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Mock data for entity relationships
   ═══════════════════════════════════════════════════════════════ */
const MOCK_NODES: EntityNode[] = [
  { id: 'n-1', name: 'Acme Corp', type: 'company', description: 'Enterprise cloud services provider with $2B revenue' },
  { id: 'n-2', name: 'TechVenture Inc', type: 'company', description: 'SaaS platform for healthcare analytics' },
  { id: 'n-3', name: 'GlobalData Ltd', type: 'company', description: 'Data analytics company with ML-powered platform' },
  { id: 'n-4', name: 'Sarah Chen', type: 'person', description: 'CTO at Acme Corp, ex-Microsoft Azure VP' },
  { id: 'n-5', name: 'John Park', type: 'person', description: 'VP Engineering at TechVenture, former colleague of Sarah Chen' },
  { id: 'n-6', name: 'Cloud Hiring Surge', type: 'signal', description: '300% increase in cloud architect roles at Acme Corp' },
  { id: 'n-7', name: 'AWS Partnership', type: 'signal', description: 'Acme Corp selects AWS as preferred cloud provider' },
  { id: 'n-8', name: 'Healthcare SaaS Expansion', type: 'opportunity', description: 'TechVenture expanding into healthcare vertical with HIPAA tools' },
  { id: 'n-9', name: 'Joint Product Development', type: 'opportunity', description: 'Partnership opportunity for compliance-focused SaaS integration' },
];

const MOCK_LINKS: EntityLink[] = [
  { id: 'l-1', sourceId: 'n-1', targetId: 'n-2', type: 'company-to-company', label: 'Strategic Partnership', confidence: 0.82 },
  { id: 'l-2', sourceId: 'n-4', targetId: 'n-5', type: 'people-to-people', label: 'Former Colleagues', confidence: 0.91 },
  { id: 'l-3', sourceId: 'n-6', targetId: 'n-8', type: 'signal-to-opportunity', label: 'Signal-derived', confidence: 0.78 },
  { id: 'l-4', sourceId: 'n-1', targetId: 'n-4', type: 'company-to-person', label: 'Employment', confidence: 0.95 },
  { id: 'l-5', sourceId: 'n-2', targetId: 'n-5', type: 'company-to-person', label: 'Employment', confidence: 0.95 },
  { id: 'l-6', sourceId: 'n-1', targetId: 'n-3', type: 'company-to-company', label: 'Competitor Intelligence', confidence: 0.65 },
  { id: 'l-7', sourceId: 'n-7', targetId: 'n-9', type: 'signal-to-opportunity', label: 'AWS Integration', confidence: 0.72 },
];

/* ═══════════════════════════════════════════════════════════════
   Main Component
   ═══════════════════════════════════════════════════════════════ */
export default function IntelligenceAssociationsScreen({
  companyId,
}: {
  companyId: string;
}) {
  const [activeTab, setActiveTab] = useState('explorer');
  const [duplicateGroups, setDuplicateGroups] = useState<DuplicateGroup[]>([]);
  const [conflicts, setConflicts] = useState<ConflictItem[]>([]);
  const [associations, setAssociations] = useState<Association[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // ── Fetch associations ──
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

  // ── Detect duplicates ──
  const handleDetectDuplicates = async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch('/api/g-intel-acquisition/associations/detect-duplicates', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ companyId }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setDuplicateGroups(Array.isArray(json) ? json : json.groups ?? []);
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed'); }
    finally { setLoading(false); }
  };

  // ── Detect conflicts ──
  const handleDetectConflicts = async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch('/api/g-intel-acquisition/associations/detect-conflicts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ companyId }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setConflicts(Array.isArray(json) ? json : json.conflicts ?? []);
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed'); }
    finally { setLoading(false); }
  };

  // ── Merge duplicate ──
  const handleMerge = async (groupId: string) => {
    setActionLoading(groupId);
    try {
      const res = await fetch('/api/g-intel-acquisition/associations/merge', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ groupId, companyId }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setDuplicateGroups(prev => prev.filter(g => g.groupId !== groupId));
      fetchAssociations();
    } catch (err) { setError(err instanceof Error ? err.message : 'Merge failed'); }
    finally { setActionLoading(null); }
  };

  // ── Resolve association ──
  const handleResolve = async (associationId: string) => {
    setActionLoading(associationId);
    try {
      const res = await fetch('/api/g-intel-acquisition/associations/resolve', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ associationId, companyId }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setAssociations(prev => prev.map(a => a.id === associationId ? { ...a, resolved: true } : a));
    } catch (err) { setError(err instanceof Error ? err.message : 'Resolve failed'); }
    finally { setActionLoading(null); }
  };

  // Filter nodes by search
  const filteredNodes = searchQuery.trim()
    ? MOCK_NODES.filter(n => n.name.toLowerCase().includes(searchQuery.toLowerCase()) || n.type.toLowerCase().includes(searchQuery.toLowerCase()))
    : MOCK_NODES;

  // Get connections for selected node
  const selectedNodeLinks = selectedNodeId
    ? MOCK_LINKS.filter(l => l.sourceId === selectedNodeId || l.targetId === selectedNodeId)
    : [];

  // ── Render ──
  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50">
            <GitBranch className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900">Entity Relationships</h2>
            <p className="text-sm text-slate-500">Explore company-to-company, people, signals, and opportunity links</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={fetchAssociations} disabled={loading}
          className="gap-2 border-slate-200 text-slate-600 hover:bg-slate-50">
          <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
          <button onClick={() => setError(null)} className="ml-auto text-red-500 hover:text-red-700">
            <XCircle className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ── Tabs ── */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-white border border-slate-200">
          <TabsTrigger value="explorer" className="gap-1.5 data-[state=active]:bg-blue-600 data-[state=active]:text-white">
            <GitBranch className="h-3.5 w-3.5" /> Explorer
          </TabsTrigger>
          <TabsTrigger value="duplicates" className="gap-1.5 data-[state=active]:bg-blue-600 data-[state=active]:text-white">
            <Copy className="h-3.5 w-3.5" /> Duplicates
          </TabsTrigger>
          <TabsTrigger value="conflicts" className="gap-1.5 data-[state=active]:bg-blue-600 data-[state=active]:text-white">
            <AlertTriangle className="h-3.5 w-3.5" /> Conflicts
          </TabsTrigger>
          <TabsTrigger value="all" className="gap-1.5 data-[state=active]:bg-blue-600 data-[state=active]:text-white">
            <Building2 className="h-3.5 w-3.5" /> All
          </TabsTrigger>
        </TabsList>

        {/* ── Explorer Tab ── */}
        <TabsContent value="explorer" className="space-y-4 mt-4">
          {/* Search */}
          <div className="relative max-w-sm">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input className="pl-9 h-9 text-sm border-slate-200" placeholder="Search entities..."
              value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
          </div>

          {/* Entity nodes grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredNodes.map(node => (
              <EntityNodeCard
                key={node.id}
                node={node}
                isSelected={selectedNodeId === node.id}
                onClick={() => setSelectedNodeId(selectedNodeId === node.id ? null : node.id)}
              />
            ))}
          </div>

          {/* Selected node connections */}
          {selectedNodeId && selectedNodeLinks.length > 0 && (
            <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4 mt-4">
              <h3 className="text-sm font-semibold text-blue-800 mb-3 flex items-center gap-2">
                <ArrowRight className="h-4 w-4" />
                Connections for {MOCK_NODES.find(n => n.id === selectedNodeId)?.name}
              </h3>
              <div className="space-y-2">
                {selectedNodeLinks.map(link => {
                  const target = MOCK_NODES.find(n => n.id === (link.sourceId === selectedNodeId ? link.targetId : link.sourceId));
                  const linkCfg = LINK_TYPE_CONFIG[link.type] ?? LINK_TYPE_CONFIG['company-to-company'];
                  return (
                    <div key={link.id} className="flex items-center gap-3 p-3 rounded-lg border border-blue-200 bg-white">
                      <div className="h-8 w-0.5 rounded-full" style={{ backgroundColor: linkCfg.color }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800">{target?.name}</p>
                        <p className="text-xs text-slate-400">{link.label}</p>
                      </div>
                      <div className="text-right">
                        <ConfidenceBar value={Math.round(link.confidence * 100)} size="sm" />
                        <Badge variant="outline" className="text-[10px] mt-1 bg-slate-50">{link.type.replace(/-/g, ' ')}</Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </TabsContent>

        {/* ── Duplicates Tab ── */}
        <TabsContent value="duplicates" className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">
              {duplicateGroups.length > 0
                ? `${duplicateGroups.length} group${duplicateGroups.length !== 1 ? 's' : ''} detected`
                : 'Run detection to find duplicates'}
            </p>
            <Button size="sm" onClick={handleDetectDuplicates} disabled={loading}
              className="gap-2 bg-blue-600 hover:bg-blue-700">
              <Copy className="h-3.5 w-3.5" />
              {loading && activeTab === 'duplicates' ? 'Detecting...' : 'Detect Duplicates'}
            </Button>
          </div>

          {duplicateGroups.length === 0 && !loading && (
            <EmptyState icon={Copy} title="No duplicate groups detected"
              description="Click 'Detect Duplicates' to scan for overlapping intelligence entries." />
          )}

          <div className="space-y-3">
            {duplicateGroups.map(group => (
              <div key={group.groupId} className="rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-800">Duplicate Group</span>
                    <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200">
                      {group.items.length} entries
                    </Badge>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => handleMerge(group.groupId)}
                    disabled={!!actionLoading} className="h-8 text-xs gap-1.5 border-slate-200">
                    {actionLoading === group.groupId ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <GitBranch className="h-3.5 w-3.5" />}
                    Merge
                  </Button>
                </div>
                <div className="p-4 space-y-2">
                  {group.items.map((item, idx) => (
                    <div key={item.id} className="flex items-start gap-3 p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                      <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-xs font-medium text-slate-600 shrink-0">
                        {idx + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-slate-700 line-clamp-2">{item.content}</p>
                        <div className="flex items-center gap-3 mt-1.5">
                          <Badge variant="outline" className="text-[10px]">{item.sourceType}</Badge>
                          <span className="text-xs text-slate-500">
                            Similarity: <span className={confidenceColor(item.similarityScore)}>{(item.similarityScore * 100).toFixed(0)}%</span>
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* ── Conflicts Tab ── */}
        <TabsContent value="conflicts" className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">
              {conflicts.length > 0 ? `${conflicts.length} conflict${conflicts.length !== 1 ? 's' : ''} detected` : 'Run detection to find conflicts'}
            </p>
            <Button size="sm" onClick={handleDetectConflicts} disabled={loading}
              className="gap-2 bg-blue-600 hover:bg-blue-700">
              <AlertTriangle className="h-3.5 w-3.5" />
              {loading && activeTab === 'conflicts' ? 'Detecting...' : 'Detect Conflicts'}
            </Button>
          </div>

          {conflicts.length === 0 && !loading && (
            <EmptyState icon={CheckCircle} title="No conflicts detected"
              description="Click 'Detect Conflicts' to scan for contradictory intelligence entries." />
          )}

          <div className="space-y-3">
            {conflicts.map(c => (
              <div key={c.id} className="rounded-xl border border-slate-200 bg-white shadow-sm p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-semibold text-slate-800">{c.conflictType.replace(/_/g, ' ')}</span>
                  <Badge variant="outline" className={cn('text-[10px]', severityColor(c.severity))}>
                    {c.severity.toUpperCase()}
                  </Badge>
                </div>
                <p className="text-sm text-slate-600">{c.description}</p>
                <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
                  <span>A: {c.objectIdA.slice(0, 12)}...</span>
                  <span>B: {c.objectIdB.slice(0, 12)}...</span>
                  <Badge variant="outline" className="text-[10px]">{c.category}</Badge>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* ── All Associations Tab ── */}
        <TabsContent value="all" className="mt-4">
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            {associations.length === 0 ? (
              <div className="p-8">
                <EmptyState icon={GitBranch} title="No associations found"
                  description="Entity associations will populate as intelligence is acquired." />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100">
                      {['Source', 'Target', 'Type', 'Confidence', 'Status', 'Action'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-[11px] uppercase tracking-wider text-slate-400 font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {associations.map(a => (
                      <tr key={a.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-2.5 font-mono text-xs text-slate-600">{a.sourceId.slice(0, 16)}...</td>
                        <td className="px-4 py-2.5 font-mono text-xs text-slate-600">{a.targetId.slice(0, 16)}...</td>
                        <td className="px-4 py-2.5"><Badge variant="outline" className="text-[10px]">{a.type}</Badge></td>
                        <td className="px-4 py-2.5">
                          <ConfidenceBar value={Math.round(a.confidence * 100)} size="sm" />
                        </td>
                        <td className="px-4 py-2.5">
                          {a.resolved ? (
                            <span className="flex items-center gap-1 text-xs text-emerald-600">
                              <CheckCircle className="h-3 w-3" /> Resolved
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-xs text-amber-600">
                              <XCircle className="h-3 w-3" /> Open
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          {!a.resolved && (
                            <Button variant="outline" size="sm"
                              onClick={() => handleResolve(a.id)}
                              disabled={!!actionLoading}
                              className="h-7 text-xs gap-1 border-slate-200">
                              {actionLoading === a.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3" />}
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
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
