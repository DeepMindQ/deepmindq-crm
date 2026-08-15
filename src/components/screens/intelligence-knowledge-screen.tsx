'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { tokens } from '@/components/intelligence-os/design-tokens';
import { ScreenSkeleton } from '@/components/ui/screen-skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { GitBranch, Search, Network, ArrowRight, X } from 'lucide-react';
import { fetchApi } from '@/lib/fetchApi';
import { GraphVisualization } from '@/components/intelligence-os/graph-visualization';

/* ── Types ── */

interface TopEntity {
  id: string;
  name: string;
  type: string;
  connections: number;
}

interface ConnectionItem {
  name: string;
  type: string;
  relation: string;
}

interface GraphStats {
  totalNodes: number;
  totalEdges: number;
  organizations: number;
  people: number;
  relationshipTypes: Record<string, number>;
  avgConnectionsPerNode: number;
  isolatedNodes: number;
  largestCluster: number;
}

function getTypeColor(type: string) {
  switch (type) {
    case 'Company':
    case 'organization':
      return { bg: tokens.accent.subtle, color: tokens.accent.primary };
    case 'Person':
    case 'person':
      return { bg: tokens.domain.bg, color: tokens.domain.value };
    case 'Industry':
      return { bg: tokens.confidence.high.bg, color: tokens.confidence.high.value };
    case 'Technology':
      return { bg: tokens.gold.bgMedium, color: tokens.gold.dark };
    default:
      return { bg: tokens.neutral['100'], color: tokens.text.secondary };
  }
}

export default function IntelligenceKnowledge() {
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedEntity, setSelectedEntity] = useState<string | null>(null);
  const [stats, setStats] = useState<GraphStats | null>(null);
  const [topEntities, setTopEntities] = useState<TopEntity[]>([]);
  const [connections, setConnections] = useState<ConnectionItem[]>([]);
  const [connectionsLoading, setConnectionsLoading] = useState(false);

  // Fetch stats and top entities from real API
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [statsRes, nodesRes] = await Promise.all([
        fetchApi('/api/knowledge-graph/stats'),
        fetchApi('/api/knowledge-folders'),
      ]);

      // Parse stats
      if (!statsRes.error && statsRes.data?.data) {
        setStats(statsRes.data.data as GraphStats);
      }

      // Parse top entities from nodes returned by knowledge-folders
      if (!nodesRes.error && nodesRes.data?.data?.nodes) {
        const nodes = nodesRes.data.data.nodes as Array<{
          id: string;
          name?: string;
          label?: string;
          type: string;
          industry?: string;
          intelligenceScore?: number;
        }>;
        // Build connections count from a connections subquery — approximate
        const entities: TopEntity[] = nodes.map((n) => ({
          id: n.id,
          name: n.name || n.label || n.id,
          type: n.type === 'person' ? 'Person' : 'Company',
          connections: 0, // Will be enriched if possible
        }));
        setTopEntities(entities);
      }
    } catch {
      // Silent fail — keep empty state
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Fetch connections for selected entity
  const fetchConnections = useCallback(async (entityId: string) => {
    setConnectionsLoading(true);
    try {
      const res = await fetchApi(`/api/knowledge-graph/connections/${entityId}`);
      if (!res.error && res.data?.data) {
        const data = res.data.data as {
          organizations?: Array<{
            org: Record<string, unknown>;
            relationship: { type: string; label: string | null };
          }>;
          people?: Array<{
            person: Record<string, unknown>;
            relationship: { type: string; label: string | null };
          }>;
        };
        const items: ConnectionItem[] = [];
        if (data.organizations) {
          for (const conn of data.organizations) {
            items.push({
              name: (conn.org.name as string) || (conn.org.id as string) || 'Unknown',
              type: 'Company',
              relation: conn.relationship.label || conn.relationship.type,
            });
          }
        }
        if (data.people) {
          for (const conn of data.people) {
            items.push({
              name: (conn.person.fullName as string) || (conn.person.id as string) || 'Unknown',
              type: 'Person',
              relation: conn.relationship.label || conn.relationship.type,
            });
          }
        }
        setConnections(items);
      } else {
        setConnections([]);
      }
    } catch {
      setConnections([]);
    } finally {
      setConnectionsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedEntity) {
      fetchConnections(selectedEntity);
    } else {
      setConnections([]);
    }
  }, [selectedEntity, fetchConnections]);

  const filteredEntities = useMemo(() => {
    if (!search) return topEntities;
    return topEntities.filter((e) => e.name.toLowerCase().includes(search.toLowerCase()));
  }, [search, topEntities]);

  if (isLoading) return <ScreenSkeleton rows={8} className="p-6" />;

  const selectedName = topEntities.find((e) => e.id === selectedEntity)?.name;
  const selectedType = topEntities.find((e) => e.id === selectedEntity)?.type;

  // Compute stats values with fallbacks
  const totalNodes = stats?.totalNodes ?? 0;
  const totalEdges = stats?.totalEdges ?? 0;
  const avgConnections = stats?.avgConnectionsPerNode ?? 0;
  const coverage =
    totalNodes > 0
      ? Math.min(
          100,
          Math.round(((totalNodes - (stats?.isolatedNodes ?? 0)) / totalNodes) * 100 * 10) / 10,
        )
      : 0;

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: tokens.text.primary }}>
          Knowledge Graph
        </h1>
        <p className="text-sm mt-1" style={{ color: tokens.text.secondary }}>
          Explore entity relationships and graph topology
        </p>
      </div>

      {/* Stats — now from real API */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: 'Total Nodes',
            value: totalNodes.toLocaleString(),
            icon: Network,
            color: tokens.accent.primary,
            bg: tokens.accent.subtle,
          },
          {
            label: 'Total Edges',
            value: totalEdges.toLocaleString(),
            icon: GitBranch,
            color: tokens.domain.value,
            bg: tokens.domain.bg,
          },
          {
            label: 'Avg Connections',
            value: avgConnections.toFixed(1),
            icon: Network,
            color: tokens.confidence.high.value,
            bg: tokens.confidence.high.bg,
          },
          {
            label: 'Graph Coverage',
            value: `${coverage}%`,
            icon: GitBranch,
            color: tokens.gold.dark,
            bg: tokens.gold.bgMedium,
          },
        ].map((stat) => (
          <Card key={stat.label} className="gap-4 py-4">
            <CardContent className="flex items-center gap-4">
              <div
                className="size-10 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: stat.bg }}
              >
                <stat.icon className="size-5" style={{ color: stat.color }} />
              </div>
              <div>
                <p className="text-xs font-medium" style={{ color: tokens.text.secondary }}>
                  {stat.label}
                </p>
                <p className="text-2xl font-bold" style={{ color: tokens.text.primary }}>
                  {stat.value}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Entity List */}
        <div className="lg:col-span-1 flex flex-col gap-4">
          <Card className="gap-4 py-4">
            <CardHeader className="pb-0 pt-0 px-6">
              <CardTitle className="text-sm font-semibold">Top Connected Entities</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <div className="relative">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 size-4"
                  style={{ color: tokens.text.muted }}
                />
                <Input
                  placeholder="Search nodes..."
                  className="pl-9"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1 max-h-96 overflow-y-auto">
                {filteredEntities.length === 0 ? (
                  <div className="py-8 text-center text-sm" style={{ color: tokens.text.muted }}>
                    {topEntities.length === 0 ? 'No entities in graph yet' : 'No entities found'}
                  </div>
                ) : (
                  filteredEntities.map((entity) => {
                    const typeStyle = getTypeColor(entity.type);
                    const isSelected = selectedEntity === entity.id;
                    return (
                      <button
                        key={entity.id}
                        onClick={() => setSelectedEntity(isSelected ? null : entity.id)}
                        className="flex items-center justify-between p-3 rounded-lg text-left transition-colors w-full"
                        style={{
                          backgroundColor: isSelected ? tokens.accent.ghost : 'transparent',
                          border: isSelected
                            ? `1px solid ${tokens.accent.subtle}`
                            : '1px solid transparent',
                        }}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div
                            className="size-2 rounded-full shrink-0"
                            style={{ backgroundColor: typeStyle.color }}
                          />
                          <div className="min-w-0">
                            <p
                              className="text-sm font-medium truncate"
                              style={{ color: tokens.text.primary }}
                            >
                              {entity.name}
                            </p>
                            <p className="text-xs" style={{ color: tokens.text.muted }}>
                              {entity.type}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <GitBranch className="size-3" style={{ color: tokens.text.muted }} />
                          <span
                            className="text-xs font-mono"
                            style={{ color: tokens.text.secondary }}
                          >
                            {entity.connections}
                          </span>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Connections Detail / Graph Visualization */}
        <div className="lg:col-span-2">
          <Card className="gap-4 py-4 h-full">
            <CardHeader className="pb-0 pt-0 px-6">
              {selectedEntity && selectedName ? (
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold">
                    Connections for{' '}
                    <span style={{ color: tokens.domain.value }}>{selectedName}</span>
                  </CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedEntity(null)}>
                    <X className="size-4" /> Close
                  </Button>
                </div>
              ) : (
                <CardTitle className="text-sm font-semibold">Entity Connections</CardTitle>
              )}
            </CardHeader>
            <CardContent>
              {!selectedEntity ? (
                <div
                  className="flex flex-col items-center justify-center h-64 gap-3"
                  style={{ color: tokens.text.muted }}
                >
                  <Network className="size-12 opacity-30" />
                  <p className="text-sm">Select an entity to view its connections</p>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {/* Real graph visualization from subgraph API */}
                  <GraphVisualization
                    centerEntityId={selectedEntity}
                    entityType={selectedType === 'Person' ? 'person' : 'organization'}
                    depth={2}
                    height={280}
                  />

                  {/* Connection list from connections API */}
                  {connectionsLoading ? (
                    <div className="flex items-center justify-center py-6">
                      <div className="w-5 h-5 border-2 border-[#3B82F6] border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : connections.length === 0 ? (
                    <div
                      className="flex items-center justify-center h-16"
                      style={{ color: tokens.text.muted }}
                    >
                      <p className="text-sm">No connections found for this entity.</p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3 max-h-64 overflow-y-auto">
                      <div
                        className="rounded-lg p-4"
                        style={{
                          backgroundColor: tokens.accent.ghost,
                          border: `1px solid ${tokens.accent.subtle}`,
                        }}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <div
                            className="size-3 rounded-full"
                            style={{
                              backgroundColor: getTypeColor(selectedType || '')?.color,
                            }}
                          />
                          <span
                            className="text-sm font-semibold"
                            style={{ color: tokens.text.primary }}
                          >
                            {selectedName}
                          </span>
                        </div>
                        <p className="text-xs" style={{ color: tokens.text.secondary }}>
                          {connections.length} connections in knowledge graph (real-time data from
                          subgraph API)
                        </p>
                      </div>
                      {connections.map((conn, idx) => {
                        const typeStyle = getTypeColor(conn.type);
                        return (
                          <div
                            key={idx}
                            className="flex items-center gap-3 p-3 rounded-lg"
                            style={{ border: `1px solid ${tokens.border.default}` }}
                          >
                            <div
                              className="size-2 rounded-full shrink-0"
                              style={{ backgroundColor: typeStyle.color }}
                            />
                            <div className="flex-1 min-w-0">
                              <p
                                className="text-sm font-medium"
                                style={{ color: tokens.text.primary }}
                              >
                                {conn.name}
                              </p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <Badge
                                  className="text-[10px] px-1.5 py-0"
                                  style={{ backgroundColor: typeStyle.bg, color: typeStyle.color }}
                                >
                                  {conn.type}
                                </Badge>
                              </div>
                            </div>
                            <div
                              className="flex items-center gap-1.5 shrink-0 px-3 py-1.5 rounded-full"
                              style={{ backgroundColor: tokens.surface.secondary }}
                            >
                              <span className="text-xs" style={{ color: tokens.text.muted }}>
                                {conn.relation}
                              </span>
                              <ArrowRight className="size-3" style={{ color: tokens.text.muted }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
