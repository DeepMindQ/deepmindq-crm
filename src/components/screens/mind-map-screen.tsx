'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  Building2, Users, AlertTriangle, FileText, ZoomIn, ZoomOut,
  RotateCcw, Filter, X, Loader2, ChevronRight, ExternalLink,
  Target, Activity, MapPin, Briefcase, Hash, Maximize2,
} from 'lucide-react';
import { PageTransition, GlassPanel, EmptyState } from '@/components/ui/animated-components';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

/* ═══════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════ */
interface MindMapProps { navigateTo?: (screen: string, companyId?: string) => void }

interface GraphNode {
  id: string; type: 'company' | 'contact' | 'signal' | 'note';
  label: string; x: number; y: number;
  data: any; radius: number; color: string;
}

interface GraphEdge {
  id: string; source: string; target: string; label: string; type: string;
}

interface MindMapData {
  nodes: Array<{ id: string; type: string; label: string; data: any }>;
  edges: Array<{ id: string; source: string; target: string; label: string; type: string }>;
  stats: { totalNodes: number; totalEdges: number; companies: number; contacts: number; signals: number; notes: number; crossCompanyEdges: number };
}

/* ═══════════════════════════════════════════════════
   Constants
   ═══════════════════════════════════════════════════ */
const GOLD = '#D4AF37';
const GOLD_LIGHT = '#E8C860';

const NODE_STYLES: Record<string, { color: string; glow: string; radius: number; label: string }> = {
  company: { color: '#A855F7', glow: 'rgba(168,85,247,0.3)', radius: 28, label: 'Company' },
  contact: { color: '#3B82F6', glow: 'rgba(59,130,246,0.2)', radius: 14, label: 'Contact' },
  signal: { color: '#F59E0B', glow: 'rgba(245,158,11,0.3)', radius: 12, label: 'Signal' },
  note: { color: '#10B981', glow: 'rgba(16,185,129,0.2)', radius: 11, label: 'Note' },
};

const SEVERITY_COLORS: Record<string, string> = { critical: '#EF4444', high: '#F59E0B', medium: '#3B82F6', low: '#71717A' };

/* ═══════════════════════════════════════════════════
   Force-Directed Layout (simple spring simulation)
   ═══════════════════════════════════════════════════ */
function computeLayout(rawNodes: MindMapData['nodes'], rawEdges: MindMapData['edges'], width: number, height: number): { nodes: GraphNode[]; edges: GraphEdge[] } {
  if (rawNodes.length === 0) return { nodes: [], edges: [] };

  const nodeMap = new Map<string, GraphNode>();
  const cx = width / 2;
  const cy = height / 2;

  // Initialize positions in a spiral
  rawNodes.forEach((n, i) => {
    const style = NODE_STYLES[n.type] || NODE_STYLES.company;
    const angle = (i / rawNodes.length) * Math.PI * 2 * 3;
    const dist = n.type === 'company' ? Math.min(width, height) * 0.3 : 80 + Math.random() * 120;
    nodeMap.set(n.id, {
      id: n.id, type: n.type as any, label: n.label,
      x: cx + Math.cos(angle) * dist,
      y: cy + Math.sin(angle) * dist,
      data: n.data, radius: style.radius, color: style.color,
    });
  });

  // Simple force simulation (30 iterations)
  const nodes = Array.from(nodeMap.values());
  for (let iter = 0; iter < 40; iter++) {
    // Repulsion between all nodes
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[j].x - nodes[i].x;
        const dy = nodes[j].y - nodes[i].y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = 800 / (dist * dist);
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        nodes[i].x -= fx; nodes[i].y -= fy;
        nodes[j].x += fx; nodes[j].y += fy;
      }
    }

    // Attraction along edges
    rawEdges.forEach(e => {
      const src = nodeMap.get(e.source);
      const tgt = nodeMap.get(e.target);
      if (!src || !tgt) return;
      const dx = tgt.x - src.x;
      const dy = tgt.y - src.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const idealDist = e.type === 'cross-company' ? 250 : e.type === 'company-contact' ? 100 : 80;
      const force = (dist - idealDist) * 0.01;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      src.x += fx; src.y += fy;
      tgt.x -= fx; tgt.y -= fy;
    });

    // Center gravity
    nodes.forEach(n => {
      n.x += (cx - n.x) * 0.01;
      n.y += (cy - n.y) * 0.01;
      // Bounds
      n.x = Math.max(n.radius, Math.min(width - n.radius, n.x));
      n.y = Math.max(n.radius, Math.min(height - n.radius, n.y));
    });
  }

  return { nodes, edges: rawEdges };
}

/* ═══════════════════════════════════════════════════
   Node Detail Panel
   ═══════════════════════════════════════════════════ */
function NodeDetailPanel({ node, onClose, navigateTo }: { node: GraphNode; onClose: () => void; navigateTo?: (s: string, c?: string) => void }) {
  const d = node.data;
  const style = NODE_STYLES[node.type];

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="absolute top-4 right-4 w-72 rounded-xl border overflow-hidden z-30"
      style={{ background: 'rgba(8,12,20,0.95)', borderColor: `${style.color}30`, backdropFilter: 'blur(20px)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3" style={{ background: `${style.color}10` }}>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: `${style.color}20` }}>
            {node.type === 'company' ? <Building2 className="w-3 h-3" style={{ color: style.color }} /> :
             node.type === 'contact' ? <Users className="w-3 h-3" style={{ color: style.color }} /> :
             node.type === 'signal' ? <Activity className="w-3 h-3" style={{ color: style.color }} /> :
             <FileText className="w-3 h-3" style={{ color: style.color }} />}
          </div>
          <span className="text-[9px] uppercase tracking-widest font-medium" style={{ color: style.color }}>{style.label}</span>
        </div>
        <button onClick={onClose} className="p-1 rounded hover:bg-white/10 transition-colors"><X className="w-3.5 h-3.5" style={{ color: '#7A8699' }} /></button>
      </div>

      {/* Content */}
      <div className="p-4 space-y-3">
        <h3 className="text-sm font-semibold text-foreground">{node.label}</h3>

        {node.type === 'company' && (
          <>
            <div className="grid grid-cols-2 gap-2">
              {d.industry && <div className="text-[10px]"><span style={{ color: '#3A4555' }}>Industry: </span><span className="text-foreground">{d.industry}</span></div>}
              {d.location && <div className="text-[10px]"><span style={{ color: '#3A4555' }}>Location: </span><span className="text-foreground">{d.location}</span></div>}
              {d.size && <div className="text-[10px]"><span style={{ color: '#3A4555' }}>Size: </span><span className="text-foreground">{d.size}</span></div>}
            </div>
            <div className="flex gap-2">
              <div className="flex-1 text-center px-2 py-2 rounded-lg" style={{ background: `${GOLD}10` }}>
                <div className="text-sm font-bold" style={{ color: GOLD }}>{d.score}</div>
                <div className="text-[8px]" style={{ color: '#3A4555' }}>IQ Score</div>
              </div>
              <div className="flex-1 text-center px-2 py-2 rounded-lg" style={{ background: `${style.color}10` }}>
                <div className="text-sm font-bold" style={{ color: style.color }}>{d.engagementScore}</div>
                <div className="text-[8px]" style={{ color: '#3A4555' }}>Engagement</div>
              </div>
              <div className="flex-1 text-center px-2 py-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)' }}>
                <div className="text-[9px] font-medium text-foreground capitalize">{d.status}</div>
                <div className="text-[8px]" style={{ color: '#3A4555' }}>Status</div>
              </div>
            </div>
            <button
              onClick={() => navigateTo?.('companies', d.id)}
              className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium border transition-colors"
              style={{ borderColor: `${style.color}30`, color: style.color }}
              onMouseEnter={e => (e.currentTarget.style.background = `${style.color}10`)}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              View Full Profile <ExternalLink className="w-3 h-3" />
            </button>
          </>
        )}

        {node.type === 'contact' && (
          <>
            <div className="space-y-1">
              {d.email && <div className="text-[10px]"><span style={{ color: '#3A4555' }}>Email: </span><span className="text-foreground">{d.email}</span></div>}
              {d.title && <div className="text-[10px]"><span style={{ color: '#3A4555' }}>Title: </span><span className="text-foreground">{d.title}</span></div>}
            </div>
            <div className="flex gap-2">
              <div className="flex-1 text-center px-2 py-2 rounded-lg" style={{ background: `${GOLD}10` }}>
                <div className="text-sm font-bold" style={{ color: GOLD }}>{d.score}</div>
                <div className="text-[8px]" style={{ color: '#3A4555' }}>Lead Score</div>
              </div>
              <div className="flex-1 text-center px-2 py-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)' }}>
                <div className="text-[9px] font-medium text-foreground capitalize">{d.status}</div>
                <div className="text-[8px]" style={{ color: '#3A4555' }}>Status</div>
              </div>
            </div>
          </>
        )}

        {node.type === 'signal' && (
          <>
            <div className="flex items-center gap-2">
              <Badge className="text-[9px] capitalize" style={{ background: `${SEVERITY_COLORS[d.severity] || '#71717A'}20`, color: SEVERITY_COLORS[d.severity] || '#71717A', border: 'none' }}>
                {d.severity}
              </Badge>
              <span className="text-[10px] capitalize" style={{ color: '#7A8699' }}>{(d.type || '').replace(/_/g, ' ')}</span>
            </div>
            {d.source && <p className="text-[10px]" style={{ color: '#3A4555' }}>Source: {d.source}</p>}
          </>
        )}

        {node.type === 'note' && (
          <>
            <Badge className="text-[9px] capitalize" style={{ background: `${style.color}15`, color: style.color, border: 'none' }}>{d.category}</Badge>
            {d.pinned && <p className="text-[10px] flex items-center gap-1" style={{ color: GOLD }}>📌 Pinned</p>}
          </>
        )}
      </div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════
   Main Mind Map Screen
   ═══════════════════════════════════════════════════ */
export default function CompanyMindMapScreen({ navigateTo }: MindMapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<MindMapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [filter, setFilter] = useState<Set<string>>(new Set(['company', 'contact', 'signal', 'note']));
  const [layoutNodes, setLayoutNodes] = useState<GraphNode[]>([]);
  const [layoutEdges, setLayoutEdges] = useState<GraphEdge[]>([]);
  const isPanning = useRef(false);
  const lastPan = useRef({ x: 0, y: 0 });
  const animFrame = useRef(0);

  // Fetch data
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/companies/mind-map');
        const json = await res.json();
        if (json && json.nodes) setData(json);
      } catch { /* silent */ }
      setLoading(false);
    })();
  }, []);

  // Compute layout when data changes
  useEffect(() => {
    if (!data || !canvasRef.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    const filteredNodes = data.nodes.filter(n => filter.has(n.type));
    const filteredNodeIds = new Set(filteredNodes.map(n => n.id));
    const filteredEdges = data.edges.filter(e => filteredNodeIds.has(e.source) && filteredNodeIds.has(e.target));
    const { nodes, edges } = computeLayout(filteredNodes, filteredEdges, w, h);
    setLayoutNodes(nodes);
    setLayoutEdges(edges);
  }, [data, filter, zoom, pan]);

  // Draw canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || layoutNodes.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, rect.width, rect.height);

    ctx.save();
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);

    const nodeMap = new Map(layoutNodes.map(n => [n.id, n]));

    // Draw edges
    layoutEdges.forEach(e => {
      const src = nodeMap.get(e.source);
      const tgt = nodeMap.get(e.target);
      if (!src || !tgt) return;
      const isHighlight = hoveredNode === e.source || hoveredNode === e.target;
      ctx.beginPath();
      ctx.moveTo(src.x, src.y);
      // Curve for cross-company edges
      if (e.type === 'cross-company') {
        const mx = (src.x + tgt.x) / 2;
        const my = (src.y + tgt.y) / 2 - 30;
        ctx.quadraticCurveTo(mx, my, tgt.x, tgt.y);
      } else {
        ctx.lineTo(tgt.x, tgt.y);
      }
      ctx.strokeStyle = isHighlight ? 'rgba(212,175,55,0.5)' : e.type === 'cross-company' ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.08)';
      ctx.lineWidth = isHighlight ? 2 : 1;
      if (e.type === 'cross-company') ctx.setLineDash([4, 4]);
      else ctx.setLineDash([]);
      ctx.stroke();
      ctx.setLineDash([]);
    });

    // Draw nodes
    layoutNodes.forEach(n => {
      const isHovered = hoveredNode === n.id;
      const isConnected = layoutEdges.some(e => (e.source === hoveredNode && e.target === n.id) || (e.target === hoveredNode && e.source === n.id));
      const dimmed = hoveredNode && !isHovered && !isConnected;

      // Glow
      if ((isHovered || n.type === 'company') && !dimmed) {
        const glow = ctx.createRadialGradient(n.x, n.y, n.radius * 0.5, n.x, n.y, n.radius * 2.5);
        glow.addColorStop(0, NODE_STYLES[n.type].glow);
        glow.addColorStop(1, 'transparent');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.radius * 2.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Circle
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.radius * (isHovered ? 1.15 : 1), 0, Math.PI * 2);
      ctx.fillStyle = dimmed ? 'rgba(255,255,255,0.05)' : `${n.color}20`;
      ctx.fill();
      ctx.strokeStyle = dimmed ? 'rgba(255,255,255,0.05)' : isHovered ? n.color : `${n.color}80`;
      ctx.lineWidth = isHovered ? 2.5 : 1.5;
      ctx.stroke();

      // Inner dot for small nodes
      if (n.type !== 'company') {
        ctx.beginPath();
        ctx.arc(n.x, n.y, 3, 0, Math.PI * 2);
        ctx.fillStyle = dimmed ? 'rgba(255,255,255,0.1)' : n.color;
        ctx.fill();
      }

      // Label
      if (!dimmed) {
        ctx.font = n.type === 'company' ? 'bold 11px Inter, system-ui' : '10px Inter, system-ui';
        ctx.textAlign = 'center';
        ctx.fillStyle = n.type === 'company' ? '#E8ECF1' : '#7A8699';
        const label = n.label.length > (n.type === 'company' ? 20 : 15) ? n.label.slice(0, n.type === 'company' ? 20 : 15) + '...' : n.label;
        ctx.fillText(label, n.x, n.y + n.radius + 14);
      }

      // Score badge for companies
      if (n.type === 'company' && n.data?.score > 0 && !dimmed) {
        const badgeX = n.x + n.radius * 0.7;
        const badgeY = n.y - n.radius * 0.7;
        ctx.beginPath();
        ctx.arc(badgeX, badgeY, 10, 0, Math.PI * 2);
        ctx.fillStyle = '#0C121E';
        ctx.fill();
        ctx.strokeStyle = GOLD;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.font = 'bold 8px Inter, system-ui';
        ctx.textAlign = 'center';
        ctx.fillStyle = GOLD;
        ctx.fillText(String(n.data.score), badgeX, badgeY + 3);
      }
    });

    ctx.restore();
  }, [layoutNodes, layoutEdges, hoveredNode, zoom, pan]);

  // Mouse interactions
  const getNodeAt = useCallback((mx: number, my: number) => {
    const x = (mx - pan.x) / zoom;
    const y = (my - pan.y) / zoom;
    for (let i = layoutNodes.length - 1; i >= 0; i--) {
      const n = layoutNodes[i];
      const dx = x - n.x; const dy = y - n.y;
      if (dx * dx + dy * dy <= (n.radius + 5) * (n.radius + 5)) return n;
    }
    return null;
  }, [layoutNodes, zoom, pan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanning.current) {
      setPan(p => ({ x: p.x + e.clientX - lastPan.current.x, y: p.y + e.clientY - lastPan.current.y }));
      lastPan.current = { x: e.clientX, y: e.clientY };
      return;
    }
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const node = getNodeAt(e.clientX - rect.left, e.clientY - rect.top);
    setHoveredNode(node?.id || null);
    canvasRef.current!.style.cursor = node ? 'pointer' : 'grab';
  }, [getNodeAt]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const node = getNodeAt(e.clientX - rect.left, e.clientY - rect.top);
    if (node) {
      setSelectedNode(node);
    } else {
      isPanning.current = true;
      lastPan.current = { x: e.clientX, y: e.clientY };
      canvasRef.current!.style.cursor = 'grabbing';
    }
  }, [getNodeAt]);

  const handleMouseUp = useCallback(() => {
    isPanning.current = false;
    if (canvasRef.current) canvasRef.current.style.cursor = 'grab';
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setZoom(z => Math.max(0.3, Math.min(3, z - e.deltaY * 0.001)));
  }, []);

  const toggleFilter = (type: string) => {
    setFilter(prev => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type); else next.add(type);
      return next;
    });
  };

  /* ── Loading ── */
  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-[500px] rounded-xl" />
      </div>
    );
  }

  if (!data || data.stats.totalNodes === 0) {
    return <EmptyState icon={MapPin} title="No Mind Map Data" description="Import companies and contacts to see the relationship graph." />;
  }

  return (
    <PageTransition>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #A855F7, #7C3AED)' }}>
              <MapPin className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground">Company Mind Map</h1>
              <p className="text-[11px]" style={{ color: '#7A8699' }}>
                {data.stats.companies} companies, {data.stats.contacts} contacts, {data.stats.signals} signals, {data.stats.notes} notes
              </p>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Filters */}
          <div className="flex items-center gap-1 p-1 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <Filter className="w-3 h-3 mx-1.5" style={{ color: '#3A4555' }} />
            {Object.entries(NODE_STYLES).map(([type, style]) => (
              <button key={type} onClick={() => toggleFilter(type)}
                className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium transition-all"
                style={{
                  background: filter.has(type) ? `${style.color}15` : 'transparent',
                  color: filter.has(type) ? style.color : '#3A4555',
                  border: `1px solid ${filter.has(type) ? `${style.color}30` : 'transparent'}`,
                }}
              >
                <div className="w-2 h-2 rounded-full" style={{ background: filter.has(type) ? style.color : '#3A4555' }} />
                {style.label}
              </button>
            ))}
          </div>

          {/* Zoom Controls */}
          <div className="flex items-center gap-1 ml-auto">
            <button onClick={() => setZoom(z => Math.min(3, z + 0.2))} className="p-1.5 rounded-lg border transition-colors" style={{ borderColor: 'rgba(255,255,255,0.06)', color: '#7A8699' }}>
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <span className="text-[10px] tabular-nums w-10 text-center" style={{ color: '#3A4555' }}>{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom(z => Math.max(0.3, z - 0.2))} className="p-1.5 rounded-lg border transition-colors" style={{ borderColor: 'rgba(255,255,255,0.06)', color: '#7A8699' }}>
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} className="p-1.5 rounded-lg border transition-colors" style={{ borderColor: 'rgba(255,255,255,0.06)', color: '#7A8699' }}>
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Canvas Container */}
        <div ref={containerRef} className="relative rounded-xl border overflow-hidden" style={{ height: '560px', background: 'rgba(6,9,15,0.8)', borderColor: 'rgba(255,255,255,0.06)' }}>
          <canvas
            ref={canvasRef}
            onMouseMove={handleMouseMove}
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onWheel={handleWheel}
            style={{ cursor: 'grab' }}
          />

          {/* Legend */}
          <div className="absolute bottom-3 left-3 flex items-center gap-3 px-3 py-2 rounded-lg" style={{ background: 'rgba(6,9,15,0.9)', border: '1px solid rgba(255,255,255,0.06)' }}>
            {Object.entries(NODE_STYLES).map(([type, style]) => (
              <div key={type} className="flex items-center gap-1">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: style.color }} />
                <span className="text-[9px]" style={{ color: '#3A4555' }}>{style.label}</span>
              </div>
            ))}
            <div className="w-px h-3" style={{ background: 'rgba(255,255,255,0.1)' }} />
            <div className="flex items-center gap-1">
              <div className="w-4 h-px" style={{ background: 'rgba(255,255,255,0.3)' }} />
              <span className="text-[9px]" style={{ color: '#3A4555' }}>Link</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-4 h-px border-t border-dashed" style={{ borderColor: 'rgba(255,255,255,0.2)' }} />
              <span className="text-[9px]" style={{ color: '#3A4555' }}>Same Industry</span>
            </div>
          </div>

          {/* Node Detail Panel */}
          <AnimatePresence>
            {selectedNode && (
              <NodeDetailPanel node={selectedNode} onClose={() => setSelectedNode(null)} navigateTo={navigateTo} />
            )}
          </AnimatePresence>
        </div>
      </div>
    </PageTransition>
  );
}