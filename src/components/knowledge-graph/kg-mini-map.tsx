'use client'

import { KGVisualization, type KGNode, type KGEdge } from './kg-visualization'

interface KGMiniMapProps {
  nodes: KGNode[]
  edges: KGEdge[]
  onNodeClick?: (node: KGNode) => void
  className?: string
}

export function KGMiniMap({ nodes, edges, onNodeClick, className }: KGMiniMapProps) {
  // Limit to top 20 most important nodes
  const topNodes = nodes
    .sort((a, b) => (b.importance || 0) - (a.importance || 0))
    .slice(0, 20)

  const topNodeIds = new Set(topNodes.map(n => n.id))
  const topEdges = edges.filter(e => topNodeIds.has(e.source) && topNodeIds.has(e.target))

  return (
    <KGVisualization
      nodes={topNodes}
      edges={topEdges}
      width={300}
      height={200}
      onNodeClick={onNodeClick}
      className={className}
    />
  )
}
