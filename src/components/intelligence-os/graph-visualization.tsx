'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import type { NodeObject } from 'react-force-graph-2d';

interface GraphNode {
  id: string;
  name: string;
  type: 'organization' | 'person';
  intelligenceScore?: number | null;
}

interface GraphLink {
  source: string | GraphNode;
  target: string | GraphNode;
  label: string;
  type: string;
  weight: number;
}

interface GraphVisualizationProps {
  centerEntityId: string;
  entityType?: 'organization' | 'person';
  depth?: number;
  height?: number;

  onNodeClick?: (node: GraphNode) => void;
}

export function GraphVisualization({
  centerEntityId,
  entityType: _entityType = 'organization',
  depth = 2,
  height = 450,
  onNodeClick,
}: GraphVisualizationProps) {
  const [graphData, setGraphData] = useState<{ nodes: GraphNode[]; links: GraphLink[] }>({
    nodes: [],
    links: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fgRef = useRef<any>(null);

  const fetchGraph = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/knowledge-graph/subgraph/${centerEntityId}?depth=${depth}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch graph data');
      const json = await res.json();

      if (json.data) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const nodes: GraphNode[] = json.data.nodes.map((n: any) => ({
          id: n.id,
          name: n.label || n.name || n.id,
          type: n.type || 'organization',
          intelligenceScore: n.intelligenceScore ?? null,
        }));
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const links: GraphLink[] = json.data.edges.map((e: any) => ({
          source: e.source,
          target: e.target,
          label: e.label || e.type || '',
          type: e.type || '',
          weight: e.weight || 0.5,
        }));
        setGraphData({ nodes, links });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load graph');
    } finally {
      setLoading(false);
    }
  }, [centerEntityId, depth]);

  useEffect(() => {
    fetchGraph();
  }, [fetchGraph]);

  // Center the camera on the center node
  useEffect(() => {
    if (fgRef.current && graphData.nodes.length > 0) {
      const centerNode = graphData.nodes.find((n) => n.id === centerEntityId);
      if (centerNode) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const node = fgRef.current.graphData().nodes.find((n: any) => n.id === centerEntityId);
        fgRef.current.centerAt(node?.x ?? 0, node?.y ?? 0, 1000);
        fgRef.current.zoom(2, 1000);
      }
    }
  }, [graphData.nodes, centerEntityId]);

  const nodeColor = useCallback(
    (node: NodeObject) => {
      const n = node as unknown as GraphNode;
      if (n.id === centerEntityId) return '#F59E0B'; // Amber for center
      if (n.type === 'organization') return '#3B82F6'; // Blue
      if (n.type === 'person') return '#10B981'; // Green
      return '#6B7280'; // Gray default
    },
    [centerEntityId],
  );

  const nodeVal = useCallback((node: NodeObject) => {
    const n = node as unknown as GraphNode;
    if (n.type === 'organization') return 12;
    if (n.type === 'person') return 8;
    return 6;
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ height }}>
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-[#3B82F6] border-t-transparent rounded-full animate-spin" />
          <div className="text-sm text-muted-foreground">Loading knowledge graph...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center" style={{ height }}>
        <div className="text-sm text-red-500">{error}</div>
      </div>
    );
  }

  if (graphData.nodes.length === 0) {
    return (
      <div className="flex items-center justify-center" style={{ height }}>
        <div className="text-sm text-muted-foreground">No connections found for this entity</div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border overflow-hidden bg-background">
      <ForceGraph2D
        ref={fgRef}
        graphData={graphData}
        nodeId="id"
        nodeLabel="name"
        nodeColor={nodeColor}
        nodeVal={nodeVal}
        linkLabel="label"
        linkColor={() => 'rgba(148,163,184,0.3)'}
        linkWidth={1}
        linkDirectionalArrowLength={4}
        linkDirectionalArrowRelPos={1}
        enableNodeDrag={true}
        enableZoomInteraction={true}
        enablePanInteraction={true}
        width={600}
        height={height}
        onNodeClick={(node) => {
          if (onNodeClick) onNodeClick(node as unknown as GraphNode);
        }}
        cooldownTicks={100}
      />
    </div>
  );
}
