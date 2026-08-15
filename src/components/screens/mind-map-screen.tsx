'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { tokens, elevation } from '@/components/intelligence-os/design-tokens';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/screen-states';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  X,
  Building2,
  Users,
  Radio,
  Swords,
  AlertTriangle,
  TrendingUp,
  Briefcase,
  Target,
} from 'lucide-react';

/* ── Types ── */
type NodeType = 'company' | 'person' | 'signal' | 'competitor' | 'risk' | 'opportunity';

interface MindMapNode {
  id: string;
  label: string;
  type: NodeType;
  x: number;
  y: number;
  description: string;
  meta?: string;
}

interface MindMapEdge {
  from: string;
  to: string;
  label?: string;
}

/* ── Mock data ── */
const NODES: MindMapNode[] = [
  {
    id: 'center',
    label: 'Acme Corp',
    type: 'company',
    x: 500,
    y: 350,
    description: 'Enterprise SaaS company, $120M ARR',
    meta: 'F500 · Series D',
  },
  {
    id: 'p1',
    label: 'Sarah Chen',
    type: 'person',
    x: 280,
    y: 180,
    description: 'VP of Engineering',
    meta: 'CTO Office · 12yr tenure',
  },
  {
    id: 'p2',
    label: 'Marcus Johnson',
    type: 'person',
    x: 720,
    y: 180,
    description: 'CIO',
    meta: 'Digital Transformation Lead',
  },
  {
    id: 'p3',
    label: 'Emily Rodriguez',
    type: 'person',
    x: 200,
    y: 520,
    description: 'Head of Procurement',
    meta: 'Vendor Evaluation Committee',
  },
  {
    id: 'p4',
    label: 'David Kim',
    type: 'person',
    x: 800,
    y: 520,
    description: 'Director of Product',
    meta: 'Product Strategy',
  },
  {
    id: 's1',
    label: 'Tech Stack Migration',
    type: 'signal',
    x: 120,
    y: 350,
    description: 'Planning to migrate from legacy Java to cloud-native',
    meta: 'High confidence · 2w ago',
  },
  {
    id: 's2',
    label: 'Hiring Spree',
    type: 'signal',
    x: 880,
    y: 350,
    description: 'Hiring 40+ engineers in Q3',
    meta: 'Medium confidence · 1w ago',
  },
  {
    id: 'c1',
    label: 'TechGiant Inc',
    type: 'competitor',
    x: 500,
    y: 100,
    description: 'Primary competitor, $80M ARR',
    meta: 'Overlapping in 3 accounts',
  },
  {
    id: 'c2',
    label: 'CloudFirst Ltd',
    type: 'competitor',
    x: 500,
    y: 600,
    description: 'Cloud infrastructure vendor',
    meta: 'Recent partnership with Acme',
  },
  {
    id: 'r1',
    label: 'Budget Freeze Risk',
    type: 'risk',
    x: 150,
    y: 100,
    description: 'Q4 budget review may freeze new purchases',
    meta: 'Probability: 35%',
  },
  {
    id: 'o1',
    label: 'Platform Expansion',
    type: 'opportunity',
    x: 850,
    y: 100,
    description: 'Looking to expand analytics platform usage',
    meta: 'Est. $2.4M opportunity',
  },
];

const EDGES: MindMapEdge[] = [
  { from: 'center', to: 'p1', label: 'reports to' },
  { from: 'center', to: 'p2', label: 'influences' },
  { from: 'center', to: 'p3', label: 'buys from' },
  { from: 'center', to: 'p4', label: 'uses' },
  { from: 'center', to: 's1', label: 'signals' },
  { from: 'center', to: 's2', label: 'signals' },
  { from: 'center', to: 'c1', label: 'competes' },
  { from: 'center', to: 'c2', label: 'partners' },
  { from: 'center', to: 'r1', label: 'risk' },
  { from: 'center', to: 'o1', label: 'opportunity' },
  { from: 'p1', to: 's1', label: 'owns' },
  { from: 'p2', to: 's2', label: 'drives' },
  { from: 'p4', to: 'o1', label: 'champions' },
  { from: 'c1', to: 'o1', label: 'threatens' },
];

const NODE_STYLES: Record<
  NodeType,
  { fill: string; stroke: string; icon: typeof Building2; badgeClass: string }
> = {
  company: {
    fill: tokens.accent.subtle,
    stroke: tokens.accent.DEFAULT,
    icon: Building2,
    badgeClass: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  },
  person: {
    fill: '#DCFCE7',
    stroke: '#16A34A',
    icon: Users,
    badgeClass: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  },
  signal: {
    fill: '#FEF3C7',
    stroke: '#D97706',
    icon: Radio,
    badgeClass: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  },
  competitor: {
    fill: '#FEE2E2',
    stroke: '#DC2626',
    icon: Swords,
    badgeClass: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  },
  risk: {
    fill: '#FEE2E2',
    stroke: '#991B1B',
    icon: AlertTriangle,
    badgeClass: 'bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-300',
  },
  opportunity: {
    fill: '#EDE9FE',
    stroke: '#7C3AED',
    icon: TrendingUp,
    badgeClass: 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300',
  },
};

const NODE_RADIUS: Record<NodeType, number> = {
  company: 48,
  person: 36,
  signal: 30,
  competitor: 34,
  risk: 28,
  opportunity: 32,
};

/* ── Component ── */
export default function MindMapScreen() {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [selectedNode, setSelectedNode] = useState<MindMapNode | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const svgRef = useRef<SVGSVGElement>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 600);
    return () => clearTimeout(t);
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setZoom((z) => Math.min(3, Math.max(0.3, z - e.deltaY * 0.001)));
  }, []);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if ((e.target as SVGElement).closest('.mind-node')) return;
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    },
    [pan],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isPanning) return;
      setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
    },
    [isPanning, panStart],
  );

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const zoomIn = () => setZoom((z) => Math.min(3, z + 0.2));
  const zoomOut = () => setZoom((z) => Math.max(0.3, z - 0.2));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full relative">
      {/* Header */}
      <div
        className="flex items-center justify-between px-6 py-4 border-b"
        style={{ borderColor: tokens.border.default }}
      >
        <div className="flex items-center gap-3">
          <Target className="w-5 h-5" style={{ color: tokens.domain.reasoning }} />
          <div>
            <h1 className="text-lg font-semibold" style={{ color: tokens.text.primary }}>
              Relationship Mind Map
            </h1>
            <p className="text-xs" style={{ color: tokens.text.muted }}>
              Visualize company ecosystem — people, signals, competitors, and opportunities
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {Object.entries(NODE_STYLES).map(([type, style]) => (
            <div
              key={type}
              className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs capitalize"
              style={{ backgroundColor: style.fill, color: style.stroke }}
            >
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: style.stroke }} />
              {type}
            </div>
          ))}
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 relative overflow-hidden bg-[radial-gradient(circle_at_50%_50%,#f8fafc_1px,transparent_1px)] bg-[length:20px_20px]">
        <svg
          ref={svgRef}
          className="w-full h-full cursor-grab"
          style={{ cursor: isPanning ? 'grabbing' : 'grab' }}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <g
            transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}
            style={{
              transformOrigin: '0 0',
              transition: isPanning ? 'none' : 'transform 0.15s ease',
            }}
          >
            {/* Edges */}
            {EDGES.map((edge, i) => {
              const from = NODES.find((n) => n.id === edge.from)!;
              const to = NODES.find((n) => n.id === edge.to)!;
              const midX = (from.x + to.x) / 2;
              const midY = (from.y + to.y) / 2;
              return (
                <g key={i}>
                  <line
                    x1={from.x}
                    y1={from.y}
                    x2={to.x}
                    y2={to.y}
                    stroke={tokens.neutral['400']}
                    strokeWidth={1.5}
                    strokeDasharray={
                      edge.label === 'competes' || edge.label === 'risk' ? '6,4' : 'none'
                    }
                    opacity={0.5}
                  />
                  {edge.label && (
                    <text
                      x={midX}
                      y={midY - 6}
                      textAnchor="middle"
                      fontSize={10}
                      fill={tokens.text.muted}
                    >
                      {edge.label}
                    </text>
                  )}
                </g>
              );
            })}

            {/* Nodes */}
            {NODES.map((node) => {
              const style = NODE_STYLES[node.type];
              const r = NODE_RADIUS[node.type];
              const isSelected = selectedNode?.id === node.id;
              return (
                <g
                  key={node.id}
                  className="mind-node cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedNode(isSelected ? null : node);
                  }}
                >
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={r + (isSelected ? 6 : 0)}
                    fill="none"
                    stroke={isSelected ? style.stroke : 'transparent'}
                    strokeWidth={isSelected ? 3 : 0}
                    opacity={isSelected ? 0.3 : 0}
                  />
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={r}
                    fill={style.fill}
                    stroke={style.stroke}
                    strokeWidth={2}
                    style={{ transition: 'r 0.2s ease' }}
                  />
                  <text
                    x={node.x}
                    y={node.y}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={node.type === 'company' ? 11 : 9}
                    fontWeight={node.type === 'company' ? 700 : 500}
                    fill={style.stroke}
                    style={{ pointerEvents: 'none' }}
                  >
                    {node.label.length > 14 ? node.label.slice(0, 12) + '…' : node.label}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>

        {/* Zoom Controls */}
        <div
          className="absolute bottom-4 right-4 flex flex-col gap-1 rounded-lg border p-1"
          style={{
            backgroundColor: tokens.surface.primary,
            borderColor: tokens.border.default,
            boxShadow: elevation.md,
          }}
        >
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={zoomIn}>
            <ZoomIn className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={zoomOut}>
            <ZoomOut className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={resetView}>
            <Maximize2 className="w-4 h-4" />
          </Button>
        </div>

        {/* Zoom indicator */}
        <div
          className="absolute bottom-4 left-4 px-2 py-1 rounded text-xs"
          style={{
            backgroundColor: tokens.surface.primary,
            color: tokens.text.muted,
            border: `1px solid ${tokens.border.default}`,
          }}
        >
          {Math.round(zoom * 100)}%
        </div>

        {/* Detail Panel */}
        {selectedNode && (
          <div
            className="absolute top-4 right-4 w-80 rounded-xl border p-0 overflow-hidden"
            style={{
              backgroundColor: tokens.surface.primary,
              borderColor: tokens.border.default,
              boxShadow: elevation.xl,
            }}
          >
            <div
              className="flex items-center justify-between px-4 py-3 border-b"
              style={{ borderColor: tokens.border.default }}
            >
              <Badge className={NODE_STYLES[selectedNode.type].badgeClass}>
                {selectedNode.type}
              </Badge>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setSelectedNode(null)}
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>
            <CardHeader className="px-4 pt-4 pb-2">
              <CardTitle className="text-base">{selectedNode.label}</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-3">
              <p className="text-sm" style={{ color: tokens.text.secondary }}>
                {selectedNode.description}
              </p>
              {selectedNode.meta && (
                <div className="flex items-center gap-2">
                  <Briefcase className="w-3.5 h-3.5" style={{ color: tokens.text.muted }} />
                  <span className="text-xs" style={{ color: tokens.text.muted }}>
                    {selectedNode.meta}
                  </span>
                </div>
              )}
              <div className="pt-2 border-t" style={{ borderColor: tokens.border.default }}>
                <p className="text-xs font-medium mb-2" style={{ color: tokens.text.secondary }}>
                  Connections
                </p>
                <div className="space-y-1">
                  {EDGES.filter((e) => e.from === selectedNode.id || e.to === selectedNode.id).map(
                    (edge, i) => {
                      const otherId = edge.from === selectedNode.id ? edge.to : edge.from;
                      const other = NODES.find((n) => n.id === otherId);
                      return (
                        <div key={i} className="flex items-center justify-between text-xs">
                          <span style={{ color: tokens.text.secondary }}>{other?.label}</span>
                          <span
                            className="px-1.5 py-0.5 rounded"
                            style={{
                              backgroundColor: tokens.surfaceExtended,
                              color: tokens.text.muted,
                            }}
                          >
                            {edge.label}
                          </span>
                        </div>
                      );
                    },
                  )}
                </div>
              </div>
            </CardContent>
          </div>
        )}
      </div>
    </div>
  );
}
