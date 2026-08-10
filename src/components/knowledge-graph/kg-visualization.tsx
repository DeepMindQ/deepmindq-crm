'use client'

import { useState, useMemo } from 'react'
import { tokens } from '@/components/intelligence-os/design-tokens';
import { motion } from 'framer-motion'
import { ZoomIn, ZoomOut, Maximize2, Info, Filter, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

export interface KGNode {
  id: string
  label: string
  type: 'company' | 'person' | 'technology' | 'industry' | 'signal' | 'opportunity' | 'concept'
  importance?: number // 0-1, affects node size
  confidence?: number
  x?: number
  y?: number
}

export interface KGEdge {
  id: string
  source: string
  target: string
  type: 'related_to' | 'works_at' | 'uses' | 'competes_with' | 'signals' | 'part_of' | 'leads_to'
  weight?: number // 0-1, affects edge thickness
  label?: string
}

interface KGVisualizationProps {
  nodes: KGNode[]
  edges: KGEdge[]
  width?: number
  height?: number
  onNodeClick?: (node: KGNode) => void
  onEdgeClick?: (edge: KGEdge) => void
  highlightNodeIds?: string[]
  className?: string
}

const NODE_COLORS: Record<string, { fill: string; stroke: string; glow: string }> = {
  company: { fill: tokens.accent.strong, stroke: tokens.accent.DEFAULT, glow: tokens.accent.strong },
  person: { fill: tokens.domain.opportunity, stroke: tokens.domain.opportunity, glow: tokens.domain.opportunity },
  technology: { fill: tokens.domain.enrichment, stroke: tokens.domain.enrichment, glow: tokens.domain.enrichment },
  industry: { fill: tokens.confidence.medium.border, stroke: tokens.domain.reasoning, glow: tokens.trust.medium.border },
  signal: { fill: tokens.confidence.low.border, stroke: tokens.domain.risk, glow: 'rgba(239,68,68,0.3)' },
  opportunity: { fill: tokens.trust.verified.border, stroke: tokens.domain.action, glow: tokens.trust.verified.border },
  concept: { fill: tokens.priority.low.border, stroke: tokens.text.secondary, glow: tokens.priority.low.border },
}

const EDGE_COLORS: Record<string, string> = {
  related_to: tokens.text.secondary,
  works_at: tokens.domain.opportunity,
  uses: tokens.domain.enrichment,
  competes_with: tokens.domain.risk,
  signals: tokens.accent.DEFAULT,
  part_of: tokens.domain.reasoning,
  leads_to: tokens.domain.action,
}

// Circular layout algorithm
function computeLayout(nodes: KGNode[], width: number, height: number): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>()
  const cx = width / 2, cy = height / 2
  const radius = Math.min(width, height) * 0.35

  nodes.forEach((node, i) => {
    if (node.x !== undefined && node.y !== undefined) {
      positions.set(node.id, { x: node.x, y: node.y })
    } else {
      const angle = (2 * Math.PI * i) / nodes.length - Math.PI / 2
      positions.set(node.id, { x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) })
    }
  })
  return positions
}

export function KGVisualization({
  nodes, edges, width = 600, height = 400,
  onNodeClick, onEdgeClick, highlightNodeIds = [], className
}: KGVisualizationProps) {
  const [zoom, setZoom] = useState(1)
  const [hoveredNode, setHoveredNode] = useState<string | null>(null)
  const [activeFilter, setActiveFilter] = useState<string | null>(null)

  const positions = useMemo(() => computeLayout(nodes, width, height), [nodes, width, height])

  const filteredNodes = activeFilter ? nodes.filter(n => n.type === activeFilter) : nodes
  const filteredNodeIds = new Set(filteredNodes.map(n => n.id))
  const filteredEdges = activeFilter ? edges.filter(e => filteredNodeIds.has(e.source) && filteredNodeIds.has(e.target)) : edges

  const connectedNodeIds = useMemo(() => {
    if (!hoveredNode) return new Set<string>()
    const connected = new Set<string>()
    connected.add(hoveredNode)
    edges.forEach(e => {
      if (e.source === hoveredNode) connected.add(e.target)
      if (e.target === hoveredNode) connected.add(e.source)
    })
    return connected
  }, [hoveredNode, edges])

  return (
    <div className={cn('rounded-xl border border-border bg-card overflow-hidden', className)}>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Knowledge Graph</span>
          <Badge variant="outline" className="text-[10px] h-4 px-1.5">
            {nodes.length} nodes · {edges.length} edges
          </Badge>
        </div>
        <div className="flex items-center gap-1">
          {/* Type filter chips */}
          {['company', 'person', 'technology', 'signal', 'opportunity'].map(type => (
            <button
              key={type}
              onClick={() => setActiveFilter(activeFilter === type ? null : type)}
              className={cn(
                'text-[10px] px-2 py-0.5 rounded-full border transition-colors capitalize',
                activeFilter === type
                  ? 'border-primary/50 bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground hover:border-primary/30'
              )}
              aria-pressed={activeFilter === type}
            >
              {type}
            </button>
          ))}
          <div className="w-px h-4 bg-border mx-1" />
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setZoom(z => Math.max(0.5, z - 0.1))} aria-label="Zoom out">
            <ZoomOut className="w-3.5 h-3.5" />
          </Button>
          <span className="text-[10px] text-muted-foreground tabular-nums w-8 text-center">{Math.round(zoom * 100)}%</span>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setZoom(z => Math.min(2, z + 0.1))} aria-label="Zoom in">
            <ZoomIn className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setZoom(1)} aria-label="Reset zoom">
            <RotateCcw className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* SVG Canvas */}
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        style={{ background: tokens.text.inverse }}
        role="img"
        aria-label="Knowledge graph visualization"
      >
        <g transform={`scale(${zoom})`}>
          {/* Edges */}
          {filteredEdges.map(edge => {
            const from = positions.get(edge.source)
            const to = positions.get(edge.target)
            if (!from || !to) return null
            const isHighlighted = hoveredNode && (edge.source === hoveredNode || edge.target === hoveredNode)
            const dimmed = hoveredNode && !isHighlighted
            return (
              <g
                key={edge.id}
                onClick={() => onEdgeClick?.(edge)}
                className="cursor-pointer"
                opacity={dimmed ? 0.15 : isHighlighted ? 1 : 0.4}
                role="button"
                aria-label={`Edge: ${edge.label || edge.type}`}
              >
                <line
                  x1={from.x} y1={from.y} x2={to.x} y2={to.y}
                  stroke={EDGE_COLORS[edge.type] || tokens.text.secondary}
                  strokeWidth={(edge.weight || 0.5) * 2 + 0.5}
                  strokeDasharray={edge.type === 'signals' ? '4 4' : undefined}
                />
              </g>
            )
          })}

          {/* Nodes */}
          {filteredNodes.map(node => {
            const pos = positions.get(node.id)
            if (!pos) return null
            const colors = NODE_COLORS[node.type] || NODE_COLORS.concept
            const r = (node.importance || 0.5) * 12 + 8
            const isConnected = hoveredNode ? connectedNodeIds.has(node.id) : true
            const isHighlight = highlightNodeIds.includes(node.id)

            return (
              <g
                key={node.id}
                onClick={() => onNodeClick?.(node)}
                onMouseEnter={() => setHoveredNode(node.id)}
                onMouseLeave={() => setHoveredNode(null)}
                className="cursor-pointer"
                opacity={isConnected ? 1 : 0.2}
                role="button"
                aria-label={`${node.label} (${node.type})`}
              >
                {/* Glow ring for highlighted nodes */}
                {isHighlight && (
                  <circle
                    cx={pos.x} cy={pos.y} r={r + 6}
                    fill="none" stroke={colors.glow} strokeWidth="2" opacity="0.5"
                  >
                    <animate attributeName="r" values={`${r + 4};${r + 8};${r + 4}`} dur="2s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.5;0.2;0.5" dur="2s" repeatCount="indefinite" />
                  </circle>
                )}
                {/* Node circle */}
                <circle
                  cx={pos.x} cy={pos.y} r={r}
                  fill={colors.fill}
                  stroke={colors.stroke}
                  strokeWidth="1.5"
                />
                {/* Label */}
                <text
                  x={pos.x} y={pos.y + r + 14}
                  textAnchor="middle"
                  fill={tokens.text.primary}
                  fontSize="10"
                  fontWeight="500"
                >
                  {node.label.length > 15 ? node.label.slice(0, 14) + '...' : node.label}
                </text>
              </g>
            )
          })}
        </g>
      </svg>

      {/* Legend */}
      <div className="flex items-center gap-3 px-4 py-2 border-t border-border flex-wrap">
        {Object.entries(NODE_COLORS).map(([type, colors]) => (
          <div key={type} className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: colors.stroke }} />
            <span className="text-[10px] text-muted-foreground capitalize">{type}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
