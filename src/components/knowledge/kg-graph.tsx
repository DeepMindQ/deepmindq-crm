'use client'

import { useState, useCallback, useMemo } from 'react'
import { motion } from 'framer-motion'
import { ZoomIn, ZoomOut, RotateCcw, Network } from 'lucide-react'
import { cn } from '@/lib/utils'
import { tokens } from '@/components/intelligence-os/design-tokens'

export interface KGNode {
  id: string
  label: string
  type: 'company' | 'contact' | 'opportunity' | 'signal' | 'event'
  x: number  // 0-100 percentage
  y: number  // 0-100 percentage
  score?: number
  metadata?: Record<string, string>
}

export interface KGEdge {
  source: string
  target: string
  label?: string
  strength: number // 0-1
  type?: 'reports_to' | 'works_at' | 'associated_with' | 'signals' | 'event_trigger'
}

export interface KGGraphProps {
  nodes: KGNode[]
  edges: KGEdge[]
  className?: string
  onNodeClick?: (node: KGNode) => void
  onEdgeClick?: (edge: KGEdge) => void
  height?: number
  title?: string
}

const NODE_TYPE_CONFIG: Record<string, { color: string; size: number; icon: string }> = {
  company: { color: tokens.domain.opportunity, size: 24, icon: '●' },
  contact: { color: tokens.domain.signal, size: 18, icon: '●' },
  opportunity: { color: tokens.confidence.high.value, size: 20, icon: '◆' },
  signal: { color: tokens.domain.reasoning, size: 16, icon: '▲' },
  event: { color: tokens.domain.risk, size: 16, icon: '■' },
}

const EDGE_TYPE_DASH: Record<string, string> = {
  reports_to: '',
  works_at: '',
  associated_with: '4 4',
  signals: '6 3',
  event_trigger: '2 4',
}

export function KGGraph({ nodes, edges, className, onNodeClick, onEdgeClick, height = 400, title }: KGGraphProps) {
  const [zoom, setZoom] = useState(1)
  const [hoveredNode, setHoveredNode] = useState<string | null>(null)
  const [selectedNode, setSelectedNode] = useState<string | null>(null)
  const [pan, setPan] = useState({ x: 0, y: 0 })

  const nodeMap = useMemo(() => Object.fromEntries(nodes.map(n => [n.id, n])), [nodes])

  const connectedNodes = useMemo(() => {
    if (!selectedNode) return new Set<string>()
    const connected = new Set<string>([selectedNode])
    edges.forEach(e => {
      if (e.source === selectedNode) connected.add(e.target)
      if (e.target === selectedNode) connected.add(e.source)
    })
    return connected
  }, [selectedNode, edges])

  const handleZoomIn = useCallback(() => setZoom(z => Math.min(z * 1.2, 3)), [])
  const handleZoomOut = useCallback(() => setZoom(z => Math.max(z / 1.2, 0.3)), [])
  const handleReset = useCallback(() => { setZoom(1); setPan({ x: 0, y: 0 }); setSelectedNode(null) }, [])

  return (
    <div className={cn('rounded-xl border overflow-hidden', className)} style={{ background: tokens.surface.card, borderColor: tokens.border.default }}>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 border-b" style={{ borderColor: tokens.border.default }}>
        <div className="flex items-center gap-2">
          <Network className="w-4 h-4" style={{ color: tokens.text.secondary }} />
          {title && <span className="text-xs font-semibold" style={{ color: tokens.text.primary }}>{title}</span>}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={handleZoomOut} className="p-1 rounded hover:bg-white/5" title="Zoom out"><ZoomOut className="w-3.5 h-3.5" style={{ color: tokens.text.secondary }} /></button>
          <span className="text-[10px] w-10 text-center tabular-nums" style={{ color: tokens.text.secondary }}>{Math.round(zoom * 100)}%</span>
          <button onClick={handleZoomIn} className="p-1 rounded hover:bg-white/5" title="Zoom in"><ZoomIn className="w-3.5 h-3.5" style={{ color: tokens.text.secondary }} /></button>
          <button onClick={handleReset} className="p-1 rounded hover:bg-white/5" title="Reset"><RotateCcw className="w-3.5 h-3.5" style={{ color: tokens.text.secondary }} /></button>
        </div>
      </div>

      {/* SVG Graph */}
      <svg width="100%" height={height} viewBox={"-50 -50 600 400"} className="cursor-grab active:cursor-grabbing" style={{ background: tokens.surface.base }}>
        <defs>
          <marker id="arrowhead" markerWidth="6" markerHeight="4" refX="6" refY="2" orient="auto">
            <polygon points="0 0, 6 2, 0 4" fill={tokens.text.muted} />
          </marker>
        </defs>

        <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
          {/* Edges */}
          {edges.map((edge, i) => {
            const source = nodeMap[edge.source]
            const target = nodeMap[edge.target]
            if (!source || !target) return null
            const isActive = selectedNode && (edge.source === selectedNode || edge.target === selectedNode)
            const isHovered = hoveredNode && (edge.source === hoveredNode || edge.target === hoveredNode)
            return (
              <g key={`edge-${i}`}>
                <line
                  x1={source.x * 5} y1={source.y * 4}
                  x2={target.x * 5} y2={target.y * 4}
                  stroke={isActive ? tokens.text.primary : isHovered ? tokens.text.secondary : tokens.text.muted}
                  strokeWidth={Math.max(0.5, edge.strength * 2)}
                  strokeDasharray={EDGE_TYPE_DASH[edge.type || 'associated_with'] || ''}
                  opacity={isActive ? 1 : selectedNode ? 0.2 : 0.5}
                  markerEnd="url(#arrowhead)"
                  className="transition-opacity"
                  style={{ cursor: onEdgeClick ? 'pointer' : 'default' }}
                  onClick={() => onEdgeClick?.(edge)}
                />
              </g>
            )
          })}

          {/* Nodes */}
          {nodes.map(node => {
            const config = NODE_TYPE_CONFIG[node.type] || NODE_TYPE_CONFIG.company
            const isHighlighted = selectedNode ? connectedNodes.has(node.id) : true
            const isHovered = hoveredNode === node.id
            const isSelected = selectedNode === node.id
            const r = config.size / 2

            return (
              <g
                key={node.id}
                transform={`translate(${node.x * 5}, ${node.y * 4})`}
                opacity={isHighlighted ? 1 : 0.15}
                className="transition-opacity"
                onMouseEnter={() => setHoveredNode(node.id)}
                onMouseLeave={() => setHoveredNode(null)}
                onClick={() => { setSelectedNode(isSelected ? null : node.id); onNodeClick?.(node) }}
                style={{ cursor: 'pointer' }}
              >
                {/* Glow */}
                {(isHovered || isSelected) && (
                  <circle r={r + 6} fill={`${config.color}20`} className="animate-pulse" />
                )}
                {/* Node circle */}
                <circle r={r} fill={config.color} stroke={isSelected ? tokens.text.primary : config.color} strokeWidth={isSelected ? 2 : 1} />
                {/* Label */}
                <text y={r + 12} textAnchor="middle" fill={tokens.text.primary} fontSize="9" fontWeight="500">{node.label}</text>
                {/* Score badge */}
                {node.score !== undefined && (
                  <g transform={`translate(${r - 2}, ${-r + 2})`}>
                    <circle r="6" fill={tokens.surface.base} />
                    <text textAnchor="middle" y="3" fill={tokens.text.secondary} fontSize="7" fontWeight="600">{node.score}</text>
                  </g>
                )}
              </g>
            )
          })}
        </g>
      </svg>

      {/* Legend */}
      <div className="flex items-center gap-3 px-3 py-2 border-t flex-wrap" style={{ borderColor: tokens.border.default }}>
        {Object.entries(NODE_TYPE_CONFIG).map(([type, config]) => (
          <div key={type} className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full" style={{ background: config.color }} />
            <span className="text-[10px]" style={{ color: tokens.text.muted }}>{type}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
