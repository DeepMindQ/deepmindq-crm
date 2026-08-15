'use client';

import { useState, useMemo, useEffect } from 'react';
import { tokens } from '@/components/intelligence-os/design-tokens';
import { ScreenSkeleton } from '@/components/ui/screen-skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { GitBranch, Search, Network, ArrowRight, X } from 'lucide-react';

const TOP_ENTITIES = [
  { id: '1', name: 'Acme Corporation', type: 'Company', connections: 187 },
  { id: '2', name: 'Sarah Chen', type: 'Person', connections: 134 },
  { id: '3', name: 'Enterprise SaaS', type: 'Industry', connections: 112 },
  { id: '4', name: 'Nexus Technologies', type: 'Company', connections: 98 },
  { id: '5', name: 'AI/ML Platform', type: 'Technology', connections: 89 },
  { id: '6', name: 'Michael Torres', type: 'Person', connections: 76 },
  { id: '7', name: 'Cloud Computing', type: 'Industry', connections: 71 },
  { id: '8', name: 'Vertex Solutions', type: 'Company', connections: 65 },
];

const CONNECTIONS_MAP: Record<string, { name: string; type: string; relation: string }[]> = {
  '1': [
    { name: 'Sarah Chen', type: 'Person', relation: 'CTO at' },
    { name: 'Enterprise SaaS', type: 'Industry', relation: 'operates in' },
    { name: 'Nexus Technologies', type: 'Company', relation: 'competes with' },
    { name: 'AI/ML Platform', type: 'Technology', relation: 'uses' },
    { name: 'Michael Torres', type: 'Person', relation: 'reported to by' },
    { name: 'Cloud Computing', type: 'Industry', relation: 'invests in' },
  ],
  '2': [
    { name: 'Acme Corporation', type: 'Company', relation: 'CTO of' },
    { name: 'Michael Torres', type: 'Person', relation: 'mentors' },
    { name: 'AI/ML Platform', type: 'Technology', relation: 'champions' },
    { name: 'Enterprise SaaS', type: 'Industry', relation: 'speaks at' },
  ],
  '3': [
    { name: 'Acme Corporation', type: 'Company', relation: 'includes' },
    { name: 'Nexus Technologies', type: 'Company', relation: 'includes' },
    { name: 'Cloud Computing', type: 'Industry', relation: 'overlaps with' },
  ],
  '4': [
    { name: 'Acme Corporation', type: 'Company', relation: 'competes with' },
    { name: 'Enterprise SaaS', type: 'Industry', relation: 'operates in' },
    { name: 'Cloud Computing', type: 'Industry', relation: 'leverages' },
  ],
  '5': [
    { name: 'Acme Corporation', type: 'Company', relation: 'used by' },
    { name: 'Sarah Chen', type: 'Person', relation: 'championed by' },
  ],
  '6': [
    { name: 'Sarah Chen', type: 'Person', relation: 'mentored by' },
    { name: 'Acme Corporation', type: 'Company', relation: 'VP Engineering at' },
  ],
  '7': [
    { name: 'Enterprise SaaS', type: 'Industry', relation: 'overlaps with' },
    { name: 'Acme Corporation', type: 'Company', relation: 'invested in by' },
  ],
  '8': [
    { name: 'Nexus Technologies', type: 'Company', relation: 'partners with' },
    { name: 'Enterprise SaaS', type: 'Industry', relation: 'operates in' },
  ],
};

function getTypeColor(type: string) {
  switch (type) {
    case 'Company':
      return { bg: tokens.accent.subtle, color: tokens.accent.primary };
    case 'Person':
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

  const filteredEntities = useMemo(() => {
    if (!search) return TOP_ENTITIES;
    return TOP_ENTITIES.filter((e) => e.name.toLowerCase().includes(search.toLowerCase()));
  }, [search]);

  useEffect(() => {
    const t = setTimeout(() => setIsLoading(false), 600);
    return () => clearTimeout(t);
  }, []);

  if (isLoading) return <ScreenSkeleton rows={8} className="p-6" />;

  const connections = selectedEntity ? CONNECTIONS_MAP[selectedEntity] || [] : [];
  const selectedName = TOP_ENTITIES.find((e) => e.id === selectedEntity)?.name;

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

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: 'Total Nodes',
            value: '24,891',
            icon: Network,
            color: tokens.accent.primary,
            bg: tokens.accent.subtle,
          },
          {
            label: 'Total Edges',
            value: '187,342',
            icon: GitBranch,
            color: tokens.domain.value,
            bg: tokens.domain.bg,
          },
          {
            label: 'Avg Connections',
            value: '15.1',
            icon: Network,
            color: tokens.confidence.high.value,
            bg: tokens.confidence.high.bg,
          },
          {
            label: 'Graph Coverage',
            value: '94.2%',
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
                    No entities found
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

        {/* Connections Detail */}
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
              ) : connections.length === 0 ? (
                <div
                  className="flex items-center justify-center h-32"
                  style={{ color: tokens.text.muted }}
                >
                  <p className="text-sm">No connections found for this entity.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-3 max-h-96 overflow-y-auto">
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
                          backgroundColor: getTypeColor(
                            TOP_ENTITIES.find((e) => e.id === selectedEntity)?.type || '',
                          )?.color,
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
                      {connections.length} connections in knowledge graph
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
                          <p className="text-sm font-medium" style={{ color: tokens.text.primary }}>
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
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
