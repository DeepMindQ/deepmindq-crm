'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AnimatedCard, StaggerGrid, StaggerItem, StatCard, GlassPanel, SectionHeader,
} from '@/components/ui/animated-components';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Network, GitBranch, Layers, Target, X,
} from 'lucide-react';
import {
  Treemap, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar,
  XAxis, YAxis, Tooltip,
} from 'recharts';
import { cardSolid, colors } from '@/components/design-system';
import { GRAPH_CATEGORY_COLORS, CATEGORY_LABELS, CATEGORY_CONFIG, goldAlpha, blackAlpha } from './knowledge-types';
import { buildTreemapData, CustomTreemapContent } from './knowledge-utils';

export function GraphTab() {
  const [graphData, setGraphData] = useState<any>(null);
  const [graphLoading, setGraphLoading] = useState(false);
  const [selectedGraphNode, setSelectedGraphNode] = useState<any>(null);

  const loadGraphData = useCallback(async () => {
    setGraphLoading(true);
    try {
      const res = await fetch('/api/knowledge/graph');
      const data = await res.json();
      setGraphData(data);
    } catch { setGraphData(null); }
    setGraphLoading(false);
  }, []);

  useEffect(() => { loadGraphData(); }, [loadGraphData]);

  const gold = 'var(--color-gold-dim)';
  const goldLight = 'var(--color-gold)';

  return (
    <div className="space-y-4">
      <StaggerGrid className="grid grid-cols-2 lg:grid-cols-4 gap-3" stagger={0.05}>
        <StaggerItem><StatCard label="Total Nodes" value={graphData?.totalAssets || 0} icon={Network} color={gold} delay={0} /></StaggerItem>
        <StaggerItem><StatCard label="Connections" value={graphData?.edges?.length || 0} icon={GitBranch} color={colors.green} delay={0.05} /></StaggerItem>
        <StaggerItem><StatCard label="Service Lines" value={Object.keys(graphData?.serviceLines || {}).length} icon={Layers} color={colors.blue} delay={0.1} /></StaggerItem>
        <StaggerItem><StatCard label="Categories" value={Object.keys(graphData?.categories || {}).length} icon={Target} color={colors.purple} delay={0.15} /></StaggerItem>
      </StaggerGrid>

      {graphLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border bg-card/60 p-6 space-y-4">
              <Skeleton className="h-5 w-1/2" /><Skeleton className="h-[300px] w-full" />
            </div>
          ))}
        </div>
      ) : graphData && graphData.nodes && graphData.nodes.length > 0 ? (
        <>
          <AnimatedCard delay={0.1}>
            <div className="p-5">
              <div className="flex items-center justify-between mb-4">
                <SectionHeader title="Knowledge Map" subtitle="Assets grouped by service line — cell size reflects relevance score, color indicates category" />
                <div className="flex items-center gap-1.5 flex-wrap">
                  {Object.entries(GRAPH_CATEGORY_COLORS).map(([cat, color]) => (
                    <div key={cat} className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-sm" style={{ background: color }} /><span className="text-[11px] text-muted-foreground">{CATEGORY_LABELS[cat] || cat}</span></div>
                  ))}
                </div>
              </div>
              <div className="h-[380px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <Treemap data={buildTreemapData(graphData.nodes)} dataKey="size" aspectRatio={4 / 3} stroke="${blackAlpha(0.05)}" content={<CustomTreemapContent />} />
                </ResponsiveContainer>
              </div>
            </div>
          </AnimatedCard>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <AnimatedCard delay={0.15}>
              <div className="p-5">
                <SectionHeader title="Category Distribution" subtitle="Knowledge asset types breakdown" />
                <div className="h-[260px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={Object.entries(graphData.categories || {}).map(([name, value]) => ({ name: CATEGORY_LABELS[name] || name, value: value as number, category: name }))} cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={3} dataKey="value" stroke="none">
                        {Object.entries(graphData.categories || {}).map(([name]) => (<Cell key={name} fill={GRAPH_CATEGORY_COLORS[name] || 'var(--color-gold)'} />))}
                      </Pie>
                      <Tooltip contentStyle={{ background: cardSolid, border: `1px solid ${blackAlpha(0.06)}`, boxShadow: `0 4px 16px ${blackAlpha(0.12)}`, borderRadius: '8px', fontSize: '12px', color: 'var(--dmq-neutral-700)' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </AnimatedCard>

            <AnimatedCard delay={0.2}>
              <div className="p-5">
                <SectionHeader title="Service Line Distribution" subtitle="Assets per service line" />
                <div className="h-[260px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={Object.entries(graphData.serviceLines || {}).map(([name, count]) => ({ name, count: count as number })).sort((a, b) => b.count - a.count)} layout="vertical" margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
                      <XAxis type="number" tick={{ fill: `${blackAlpha(0.1)}`, fontSize: 11 }} axisLine={{ stroke: `${blackAlpha(0.06)}` }} tickLine={false} />
                      <YAxis type="category" dataKey="name" tick={{ fill: `${blackAlpha(0.12)}`, fontSize: 11 }} axisLine={false} tickLine={false} width={140} />
                      <Tooltip contentStyle={{ background: cardSolid, border: `1px solid ${blackAlpha(0.06)}`, boxShadow: `0 4px 16px ${blackAlpha(0.12)}`, borderRadius: '8px', fontSize: '12px', color: 'var(--dmq-neutral-700)' }} />
                      <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={24}>
                        {Object.entries(graphData.serviceLines || {}).map((_, idx) => (<Cell key={idx} fill={idx === 0 ? gold : `rgba(212,175,55,${Math.max(0.3, 1 - idx * 0.15)})`} />))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </AnimatedCard>
          </div>

          <AnimatePresence>
            {selectedGraphNode && (
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
                <GlassPanel className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `${GRAPH_CATEGORY_COLORS[selectedGraphNode.category] || gold}15` }}><Network className="w-4 h-4" style={{ color: GRAPH_CATEGORY_COLORS[selectedGraphNode.category] || gold }} /></div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">{selectedGraphNode.label}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className={`text-[11px] ${(CATEGORY_CONFIG[selectedGraphNode.category] || CATEGORY_CONFIG.service_line).badge}`}>{CATEGORY_LABELS[selectedGraphNode.category] || selectedGraphNode.category}</Badge>
                          {selectedGraphNode.group && selectedGraphNode.group !== selectedGraphNode.category && <Badge variant="outline" className="text-[11px] border-border text-muted-foreground">{selectedGraphNode.group}</Badge>}
                        </div>
                      </div>
                    </div>
                    <button onClick={() => setSelectedGraphNode(null)} className="p-1.5 rounded-md hover:bg-gray-100 text-muted-foreground hover:text-foreground transition-colors" aria-label="Close details"><X className="w-4 h-4" /></button>
                  </div>
                  <div className="grid grid-cols-4 gap-4 mt-3">
                    <div className="text-center p-3 rounded-lg bg-white border border-gray-200 shadow-sm"><p className="text-lg font-bold tabular-nums" style={{ color: gold }}>{selectedGraphNode.score}</p><p className="text-[11px] text-muted-foreground">Score</p></div>
                    <div className="text-center p-3 rounded-lg bg-white border border-gray-200 shadow-sm"><p className="text-lg font-bold tabular-nums text-emerald-600">{selectedGraphNode.upvotes}</p><p className="text-[11px] text-muted-foreground">Upvotes</p></div>
                    <div className="text-center p-3 rounded-lg bg-white border border-gray-200 shadow-sm"><p className="text-lg font-bold tabular-nums text-blue-600">{selectedGraphNode.usedInEmails}</p><p className="text-[11px] text-muted-foreground">Used in Emails</p></div>
                    <div className="text-center p-3 rounded-lg bg-white border border-gray-200 shadow-sm"><p className="text-lg font-bold tabular-nums text-muted-foreground">v{selectedGraphNode.version}</p><p className="text-[11px] text-muted-foreground">Version</p></div>
                  </div>
                </GlassPanel>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      ) : (
        <AnimatedCard>
          <div className="text-center py-16 space-y-4">
            <Network className="w-12 h-12 text-muted-foreground/30 mx-auto" />
            <div><p className="text-sm font-medium text-foreground">No knowledge graph data</p><p className="text-xs text-muted-foreground mt-1">Add knowledge assets to see the knowledge graph visualization</p></div>
          </div>
        </AnimatedCard>
      )}
    </div>
  );
}
