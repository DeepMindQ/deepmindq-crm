'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2, Users, Activity, FileText, ZoomIn, ZoomOut,
  RotateCcw, Filter, X, Loader2, ExternalLink,
  MapPin, Search, ArrowLeft, Eye,
} from 'lucide-react';
import { PageTransition, EmptyState } from '@/components/ui/animated-components';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

/* ═══════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════ */
interface MindMapProps {
  navigateTo?: (screen: string, companyId?: string) => void;
}

interface GraphNode {
  id: string;
  type: 'company' | 'contact' | 'signal' | 'note';
  label: string;
  x: number;
  y: number;
  data: Record<string, unknown>;
  radius: number;
  color: string;
}

interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: string;
}

interface MindMapData {
  nodes: Array<{ id: string; type: string; label: string; data: Record<string, unknown> }>;
  edges: Array<{ id: string; source: string; target: string; type: string }>;
  stats: {
    totalNodes: number;
    totalEdges: number;
    companies: number;
    contacts: number;
    signals: number;
    notes: number;
  };
  mode: 'focused' | 'search' | 'overview';
  focusedCompanyId?: string;
}

/* ═══════════════════════════════════════════════════
   Constants
   ═══════════════════════════════════════════════════ */
const GOLD = '#D4AF37';

const NODE_STYLES: Record<string, { color: string; glow: string; radius: number; label: string }> = {
  company:  { color: '#A855F7', glow: 'rgba(168,85,247,0.3)',  radius: 28, label: 'Company' },
  contact:  { color: '#3B82F6', glow: 'rgba(59,130,246,0.2)',  radius: 14, label: 'Contact' },
  signal:   { color: '#F59E0B', glow: 'rgba(245,158,11,0.3)', radius: 12, label: 'Signal' },
  note:     { color: '#10B981', glow: 'rgba(16,185,129,0.2)',  radius: 11, label: 'Note' },
};

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#EF4444', high: '#F59E0B', medium: '#3B82F6', low: '#71717A',
};

/* ═══════════════════════════════════════════════════
   Layout: Radial tree for focused (single-company) view
   Company at center → contacts at 120px → signals/notes at 80px
   ═══════════════════════════════════════════════════ */
function computeRadialLayout(
  rawNodes: MindMapData['nodes'],
  rawEdges: MindMapData['edges'],
  width: number,
  height: number,
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const cx = width / 2;
  const cy = height / 2;
  const nodeMap = new Map<string, GraphNode>();

  // Categorize children by type
  const contacts: typeof rawNodes = [];
  const signals: typeof rawNodes = [];
  const notes: typeof rawNodes = [];
  let companyNode: (typeof rawNodes)[number] | null = null;

  for (const n of rawNodes) {
    const style = NODE_STYLES[n.type] || NODE_STYLES.company;
    if (n.type === 'company') {
      companyNode = n;
      nodeMap.set(n.id, {
        id: n.id, type: n.type as GraphNode['type'], label: n.label,
        x: cx, y: cy,
        data: n.data as GraphNode['data'],
        radius: style.radius, color: style.color,
      });
    } else if (n.type === 'contact') {
      contacts.push(n);
    } else if (n.type === 'signal') {
      signals.push(n);
    } else if (n.type === 'note') {
      notes.push(n);
    }
  }

  // Place contacts in a circle at 120px
  const contactDist = 120;
  for (let i = 0; i < contacts.length; i++) {
    const angle = (i / Math.max(contacts.length, 1)) * Math.PI * 2 - Math.PI / 2;
    const style = NODE_STYLES.contact;
    nodeMap.set(contacts[i].id, {
      id: contacts[i].id, type: 'contact', label: contacts[i].label,
      x: cx + Math.cos(angle) * contactDist,
      y: cy + Math.sin(angle) * contactDist,
      data: contacts[i].data as GraphNode['data'],
      radius: style.radius, color: style.color,
    });
  }

  // Place signals and notes interleaved at 80px
  const innerItems = [...signals, ...notes];
  const innerDist = 80;
  const contactOffset = contacts.length > 0
    ? (contacts.length / Math.max(contacts.length, 1)) * Math.PI * 2 - Math.PI / 2
    : -Math.PI / 2;
  for (let i = 0; i < innerItems.length; i++) {
    const baseAngle = contactOffset + Math.PI / contacts.length * 0.5;
    const angle = innerItems.length === 1
      ? baseAngle
      : baseAngle + (i / innerItems.length) * Math.PI * 2;
    const style = NODE_STYLES[innerItems[i].type] || NODE_STYLES.signal;
    nodeMap.set(innerItems[i].id, {
      id: innerItems[i].id, type: innerItems[i].type as GraphNode['type'], label: innerItems[i].label,
      x: cx + Math.cos(angle) * innerDist,
      y: cy + Math.sin(angle) * innerDist,
      data: innerItems[i].data as GraphNode['data'],
      radius: style.radius, color: style.color,
    });
  }

  return { nodes: Array.from(nodeMap.values()), edges: rawEdges };
}

/* ═══════════════════════════════════════════════════
   Layout: Clean force-directed for overview / search
   Fewer nodes, tighter spring constants
   ═══════════════════════════════════════════════════ */
function computeForceLayout(
  rawNodes: MindMapData['nodes'],
  rawEdges: MindMapData['edges'],
  width: number,
  height: number,
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  if (rawNodes.length === 0) return { nodes: [], edges: [] };

  const cx = width / 2;
  const cy = height / 2;
  const nodeMap = new Map<string, GraphNode>();

  // Initialize: companies in a wider ring, children near parent
  const companies: GraphNode[] = [];
  const children: GraphNode[] = [];

  rawNodes.forEach((n, i) => {
    const style = NODE_STYLES[n.type] || NODE_STYLES.company;
    const gn: GraphNode = {
      id: n.id, type: n.type as GraphNode['type'], label: n.label,
      x: cx, y: cy,
      data: n.data as GraphNode['data'],
      radius: style.radius, color: style.color,
    };
    nodeMap.set(n.id, gn);
    if (n.type === 'company') {
      const angle = (i / Math.max(rawNodes.filter(nn => nn.type === 'company').length, 1)) * Math.PI * 2 * 2.5;
      const dist = Math.min(width, height) * 0.28;
      gn.x = cx + Math.cos(angle) * dist;
      gn.y = cy + Math.sin(angle) * dist;
      companies.push(gn);
    } else {
      gn.x = cx + (Math.random() - 0.5) * 100;
      gn.y = cy + (Math.random() - 0.5) * 100;
      children.push(gn);
    }
  });

  // Build adjacency: parent → children
  const parentOf = new Map<string, string>();
  rawEdges.forEach(e => {
    if (e.type !== 'cross-company') parentOf.set(e.target, e.source);
  });

  const nodes = Array.from(nodeMap.values());
  const edges = rawEdges.filter(e => e.type !== 'cross-company');

  // 50 iterations of simple force
  for (let iter = 0; iter < 50; iter++) {
    // Repulsion between all pairs
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[j].x - nodes[i].x;
        const dy = nodes[j].y - nodes[i].y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const minDist = nodes[i].radius + nodes[j].radius + 20;
        const force = (minDist * 60) / (dist * dist);
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        nodes[i].x -= fx;
        nodes[i].y -= fy;
        nodes[j].x += fx;
        nodes[j].y += fy;
      }
    }

    // Attraction along edges (spring)
    edges.forEach(e => {
      const src = nodeMap.get(e.source);
      const tgt = nodeMap.get(e.target);
      if (!src || !tgt) return;
      const dx = tgt.x - src.x;
      const dy = tgt.y - src.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const ideal = e.type === 'company-contact' ? 90 : 65;
      const force = (dist - ideal) * 0.02;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      src.x += fx;
      src.y += fy;
      tgt.x -= fx;
      tgt.y -= fy;
    });

    // Center gravity
    nodes.forEach(n => {
      n.x += (cx - n.x) * 0.008;
      n.y += (cy - n.y) * 0.008;
      n.x = Math.max(n.radius + 5, Math.min(width - n.radius - 5, n.x));
      n.y = Math.max(n.radius + 5, Math.min(height - n.radius - 5, n.y));
    });
  }

  return { nodes, edges };
}

/* ═══════════════════════════════════════════════════
   Node Detail Panel
   ═══════════════════════════════════════════════════ */
function NodeDetailPanel({
  node,
  onClose,
  navigateTo,
  onViewContacts,
}: {
  node: GraphNode;
  onClose: () => void;
  navigateTo?: (s: string, c?: string) => void;
  onViewContacts?: (companyId: string) => void;
}) {
  const d = node.data;
  const style = NODE_STYLES[node.type];

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="absolute top-4 right-4 w-72 rounded-xl border overflow-hidden z-30"
      style={{
        background: 'rgba(8,12,20,0.95)',
        borderColor: `${style.color}30`,
        backdropFilter: 'blur(20px)',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ background: `${style.color}10` }}
      >
        <div className="flex items-center gap-2">
          <div
            className="w-6 h-6 rounded-md flex items-center justify-center"
            style={{ background: `${style.color}20` }}
          >
            {node.type === 'company' ? (
              <Building2 className="w-3 h-3" style={{ color: style.color }} />
            ) : node.type === 'contact' ? (
              <Users className="w-3 h-3" style={{ color: style.color }} />
            ) : node.type === 'signal' ? (
              <Activity className="w-3 h-3" style={{ color: style.color }} />
            ) : (
              <FileText className="w-3 h-3" style={{ color: style.color }} />
            )}
          </div>
          <span
            className="text-[9px] uppercase tracking-widest font-medium"
            style={{ color: style.color }}
          >
            {style.label}
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-white/10 transition-colors"
        >
          <X className="w-3.5 h-3.5" style={{ color: '#7A8699' }} />
        </button>
      </div>

      {/* Content */}
      <div className="p-4 space-y-3">
        <h3 className="text-sm font-semibold text-foreground">{node.label}</h3>

        {node.type === 'company' && (
          <>
            <div className="grid grid-cols-2 gap-2">
              {d.industry && (
                <div className="text-[10px]">
                  <span style={{ color: '#3A4555' }}>Industry: </span>
                  <span className="text-foreground">{String(d.industry)}</span>
                </div>
              )}
              {d.location && (
                <div className="text-[10px]">
                  <span style={{ color: '#3A4555' }}>Location: </span>
                  <span className="text-foreground">{String(d.location)}</span>
                </div>
              )}
              {d.size && (
                <div className="text-[10px]">
                  <span style={{ color: '#3A4555' }}>Size: </span>
                  <span className="text-foreground">{String(d.size)}</span>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <div
                className="flex-1 text-center px-2 py-2 rounded-lg"
                style={{ background: `${GOLD}10` }}
              >
                <div className="text-sm font-bold" style={{ color: GOLD }}>
                  {Number(d.score) || 0}
                </div>
                <div className="text-[8px]" style={{ color: '#3A4555' }}>
                  IQ Score
                </div>
              </div>
              <div
                className="flex-1 text-center px-2 py-2 rounded-lg"
                style={{ background: `${style.color}10` }}
              >
                <div className="text-sm font-bold" style={{ color: style.color }}>
                  {Number(d.engagementScore) || 0}
                </div>
                <div className="text-[8px]" style={{ color: '#3A4555' }}>
                  Engagement
                </div>
              </div>
              <div
                className="flex-1 text-center px-2 py-2 rounded-lg"
                style={{ background: 'rgba(255,255,255,0.03)' }}
              >
                <div className="text-[9px] font-medium text-foreground capitalize">
                  {String(d.status || '—')}
                </div>
                <div className="text-[8px]" style={{ color: '#3A4555' }}>
                  Status
                </div>
              </div>
            </div>

            {/* View Contacts button — zooms into company tree */}
            <button
              onClick={() => onViewContacts?.(String(d.id))}
              className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium border transition-colors"
              style={{
                borderColor: `${style.color}30`,
                color: style.color,
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = `${style.color}10`)
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = 'transparent')
              }
            >
              <Eye className="w-3 h-3" />
              View Contacts
            </button>

            {/* View Full Profile */}
            <button
              onClick={() => navigateTo?.('companies', String(d.id))}
              className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium border transition-colors"
              style={{
                borderColor: `${GOLD}30`,
                color: GOLD,
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = `${GOLD}10`)
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = 'transparent')
              }
            >
              View Full Profile <ExternalLink className="w-3 h-3" />
            </button>
          </>
        )}

        {node.type === 'contact' && (
          <>
            <div className="space-y-1">
              {d.email && (
                <div className="text-[10px]">
                  <span style={{ color: '#3A4555' }}>Email: </span>
                  <span className="text-foreground">{String(d.email)}</span>
                </div>
              )}
              {d.title && (
                <div className="text-[10px]">
                  <span style={{ color: '#3A4555' }}>Title: </span>
                  <span className="text-foreground">{String(d.title)}</span>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <div
                className="flex-1 text-center px-2 py-2 rounded-lg"
                style={{ background: `${GOLD}10` }}
              >
                <div className="text-sm font-bold" style={{ color: GOLD }}>
                  {Number(d.score) || 0}
                </div>
                <div className="text-[8px]" style={{ color: '#3A4555' }}>
                  Lead Score
                </div>
              </div>
              <div
                className="flex-1 text-center px-2 py-2 rounded-lg"
                style={{ background: 'rgba(255,255,255,0.03)' }}
              >
                <div className="text-[9px] font-medium text-foreground capitalize">
                  {String(d.status || '—')}
                </div>
                <div className="text-[8px]" style={{ color: '#3A4555' }}>
                  Status
                </div>
              </div>
            </div>
          </>
        )}

        {node.type === 'signal' && (
          <>
            <div className="flex items-center gap-2">
              <Badge
                className="text-[9px] capitalize"
                style={{
                  background: `${SEVERITY_COLORS[String(d.severity)] || '#71717A'}20`,
                  color: SEVERITY_COLORS[String(d.severity)] || '#71717A',
                  border: 'none',
                }}
              >
                {String(d.severity)}
              </Badge>
              <span
                className="text-[10px] capitalize"
                style={{ color: '#7A8699' }}
              >
                {String(d.type || '').replace(/_/g, ' ')}
              </span>
            </div>
            {d.source && (
              <p className="text-[10px]" style={{ color: '#3A4555' }}>
                Source: {String(d.source)}
              </p>
            )}
          </>
        )}

        {node.type === 'note' && (
          <>
            <Badge
              className="text-[9px] capitalize"
              style={{
                background: `${style.color}15`,
                color: style.color,
                border: 'none',
              }}
            >
              {String(d.category)}
            </Badge>
            {d.pinned && (
              <p className="text-[10px] flex items-center gap-1" style={{ color: GOLD }}>
                📌 Pinned
              </p>
            )}
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

  // View state
  const [data, setData] = useState<MindMapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [focusedCompanyId, setFocusedCompanyId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchInput, setSearchInput] = useState('');

  // Interaction state
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [filter, setFilter] = useState<Set<string>>(
    new Set(['company', 'contact', 'signal', 'note']),
  );
  const [layoutNodes, setLayoutNodes] = useState<GraphNode[]>([]);
  const [layoutEdges, setLayoutEdges] = useState<GraphEdge[]>([]);

  const isPanning = useRef(false);
  const lastPan = useRef({ x: 0, y: 0 });
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ── Fetch data ── */
  const fetchData = useCallback(async (params: string = '') => {
    setLoading(true);
    setSelectedNode(null);
    try {
      const url = `/api/companies/mind-map${params ? `?${params}` : ''}`;
      const res = await fetch(url);
      const json = await res.json();
      if (json && json.nodes) {
        setData(json);
        if (json.mode === 'focused') {
          setFocusedCompanyId(json.focusedCompanyId || null);
          setZoom(1);
          setPan({ x: 0, y: 0 });
        } else {
          setFocusedCompanyId(null);
        }
      }
    } catch {
      /* silent */
    }
    setLoading(false);
  }, []);

  // Initial load
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
  }, [fetchData]);

  /* ── Search handler with debounce ── */
  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (!value.trim()) {
      setSearchTerm('');
      setFocusedCompanyId(null);
      fetchData();
      return;
    }
    searchTimeout.current = setTimeout(() => {
      setSearchTerm(value.trim());
      setFocusedCompanyId(null);
      fetchData(`search=${encodeURIComponent(value.trim())}`);
    }, 350);
  };

  /* ── Focus on a company ── */
  const focusCompany = useCallback(
    (companyId: string) => {
      setFocusedCompanyId(companyId);
      fetchData(`companyId=${companyId}`);
    },
    [fetchData],
  );

  /* ── Back to overview ── */
  const backToOverview = useCallback(() => {
    setFocusedCompanyId(null);
    setSearchTerm('');
    setSearchInput('');
    fetchData();
  }, [fetchData]);

  /* ── Compute layout when data changes ── */
  useEffect(() => {
    if (!data || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;

    const filteredNodes = data.nodes.filter((n) => filter.has(n.type));
    const filteredNodeIds = new Set(filteredNodes.map((n) => n.id));
    const filteredEdges = data.edges.filter(
      (e) => filteredNodeIds.has(e.source) && filteredNodeIds.has(e.target),
    );

    const isFocused = data.mode === 'focused';
    const { nodes, edges } = isFocused
      ? computeRadialLayout(filteredNodes, filteredEdges, w, h)
      : computeForceLayout(filteredNodes, filteredEdges, w, h);

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLayoutNodes(nodes);
    setLayoutEdges(edges);
  }, [data, filter]);

  /* ── Draw canvas ── */
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

    const nodeMap = new Map(layoutNodes.map((n) => [n.id, n]));

    // Draw edges
    layoutEdges.forEach((e) => {
      const src = nodeMap.get(e.source);
      const tgt = nodeMap.get(e.target);
      if (!src || !tgt) return;
      const isHighlight =
        hoveredNode === e.source || hoveredNode === e.target;
      ctx.beginPath();
      ctx.moveTo(src.x, src.y);
      ctx.lineTo(tgt.x, tgt.y);
      ctx.strokeStyle = isHighlight
        ? 'rgba(212,175,55,0.5)'
        : 'rgba(255,255,255,0.08)';
      ctx.lineWidth = isHighlight ? 2 : 1;
      ctx.stroke();
    });

    // Draw nodes
    layoutNodes.forEach((n) => {
      const isHovered = hoveredNode === n.id;
      const isConnected = layoutEdges.some(
        (e) =>
          (e.source === hoveredNode && e.target === n.id) ||
          (e.target === hoveredNode && e.source === n.id),
      );
      const dimmed = hoveredNode && !isHovered && !isConnected;

      // Glow for companies and hovered nodes
      if ((isHovered || n.type === 'company') && !dimmed) {
        const glow = ctx.createRadialGradient(
          n.x, n.y, n.radius * 0.5,
          n.x, n.y, n.radius * 2.5,
        );
        glow.addColorStop(0, NODE_STYLES[n.type]?.glow || 'rgba(168,85,247,0.3)');
        glow.addColorStop(1, 'transparent');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.radius * 2.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Circle
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.radius * (isHovered ? 1.15 : 1), 0, Math.PI * 2);
      ctx.fillStyle = dimmed
        ? 'rgba(255,255,255,0.05)'
        : `${n.color}20`;
      ctx.fill();
      ctx.strokeStyle = dimmed
        ? 'rgba(255,255,255,0.05)'
        : isHovered
          ? n.color
          : `${n.color}80`;
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
        ctx.font =
          n.type === 'company'
            ? 'bold 11px Inter, system-ui'
            : '10px Inter, system-ui';
        ctx.textAlign = 'center';
        ctx.fillStyle =
          n.type === 'company' ? '#E8ECF1' : '#7A8699';
        const maxLen = n.type === 'company' ? 20 : 15;
        const label =
          n.label.length > maxLen
            ? n.label.slice(0, maxLen) + '...'
            : n.label;
        ctx.fillText(label, n.x, n.y + n.radius + 14);
      }

      // Score badge for companies
      if (n.type === 'company' && (n.data?.score as number) > 0 && !dimmed) {
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

  /* ── Mouse interactions ── */
  const getNodeAt = useCallback(
    (mx: number, my: number) => {
      const x = (mx - pan.x) / zoom;
      const y = (my - pan.y) / zoom;
      for (let i = layoutNodes.length - 1; i >= 0; i--) {
        const n = layoutNodes[i];
        const dx = x - n.x;
        const dy = y - n.y;
        if (dx * dx + dy * dy <= (n.radius + 5) * (n.radius + 5)) return n;
      }
      return null;
    },
    [layoutNodes, zoom, pan],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isPanning.current) {
        setPan((p) => ({
          x: p.x + e.clientX - lastPan.current.x,
          y: p.y + e.clientY - lastPan.current.y,
        }));
        lastPan.current = { x: e.clientX, y: e.clientY };
        return;
      }
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const node = getNodeAt(e.clientX - rect.left, e.clientY - rect.top);
      setHoveredNode(node?.id || null);
      if (canvasRef.current) {
        canvasRef.current.style.cursor = node ? 'pointer' : 'grab';
      }
    },
    [getNodeAt],
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const node = getNodeAt(e.clientX - rect.left, e.clientY - rect.top);
      if (node) {
        setSelectedNode(node);
      } else {
        isPanning.current = true;
        lastPan.current = { x: e.clientX, y: e.clientY };
        if (canvasRef.current) canvasRef.current.style.cursor = 'grabbing';
      }
    },
    [getNodeAt],
  );

  const handleMouseUp = useCallback(() => {
    isPanning.current = false;
    if (canvasRef.current) canvasRef.current.style.cursor = 'grab';
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setZoom((z) => Math.max(0.3, Math.min(3, z - e.deltaY * 0.001)));
  }, []);

  const toggleFilter = (type: string) => {
    setFilter((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  /* ── Loading ── */
  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-[560px] rounded-xl" />
      </div>
    );
  }

  if (!data || data.stats.totalNodes === 0) {
    return (
      <EmptyState
        icon={MapPin}
        title="No Mind Map Data"
        description="Import companies and contacts to see the relationship graph."
      />
    );
  }

  return (
    <PageTransition>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #A855F7, #7C3AED)' }}
            >
              <MapPin className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground">
                {focusedCompanyId ? 'Company Tree' : 'Company Mind Map'}
              </h1>
              <p className="text-[11px]" style={{ color: '#7A8699' }}>
                {data.stats.companies} companies, {data.stats.contacts}{' '}
                contacts, {data.stats.signals} signals, {data.stats.notes}{' '}
                notes
              </p>
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="flex items-center gap-3">
          <div
            className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors"
            style={{
              background: 'rgba(255,255,255,0.03)',
              borderColor: searchInput
                ? `${GOLD}40`
                : 'rgba(255,255,255,0.08)',
            }}
          >
            <Search className="w-4 h-4 flex-shrink-0" style={{ color: '#7A8699' }} />
            <input
              type="text"
              placeholder="Search companies by name, domain, or industry…"
              value={searchInput}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-[#3A4555] outline-none"
            />
            {searchInput && (
              <button
                onClick={() => handleSearchChange('')}
                className="p-0.5 rounded hover:bg-white/10 transition-colors"
              >
                <X className="w-3.5 h-3.5" style={{ color: '#7A8699' }} />
              </button>
            )}
          </div>

          {/* Back to Overview (only in focused mode) */}
          {focusedCompanyId && (
            <button
              onClick={backToOverview}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-colors"
              style={{
                borderColor: `${GOLD}30`,
                color: GOLD,
                background: `${GOLD}08`,
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = `${GOLD}15`)
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = `${GOLD}08`)
              }
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to Overview
            </button>
          )}
        </div>

        {/* Controls: Filters + Zoom */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Filters */}
          <div
            className="flex items-center gap-1 p-1 rounded-lg"
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <Filter className="w-3 h-3 mx-1.5" style={{ color: '#3A4555' }} />
            {Object.entries(NODE_STYLES).map(([type, style]) => (
              <button
                key={type}
                onClick={() => toggleFilter(type)}
                className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium transition-all"
                style={{
                  background: filter.has(type)
                    ? `${style.color}15`
                    : 'transparent',
                  color: filter.has(type) ? style.color : '#3A4555',
                  border: `1px solid ${
                    filter.has(type) ? `${style.color}30` : 'transparent'
                  }`,
                }}
              >
                <div
                  className="w-2 h-2 rounded-full"
                  style={{
                    background: filter.has(type) ? style.color : '#3A4555',
                  }}
                />
                {style.label}
              </button>
            ))}
          </div>

          {/* Zoom Controls */}
          <div className="flex items-center gap-1 ml-auto">
            <button
              onClick={() => setZoom((z) => Math.min(3, z + 0.2))}
              className="p-1.5 rounded-lg border transition-colors"
              style={{
                borderColor: 'rgba(255,255,255,0.06)',
                color: '#7A8699',
              }}
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <span
              className="text-[10px] tabular-nums w-10 text-center"
              style={{ color: '#3A4555' }}
            >
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom((z) => Math.max(0.3, z - 0.2))}
              className="p-1.5 rounded-lg border transition-colors"
              style={{
                borderColor: 'rgba(255,255,255,0.06)',
                color: '#7A8699',
              }}
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => {
                setZoom(1);
                setPan({ x: 0, y: 0 });
              }}
              className="p-1.5 rounded-lg border transition-colors"
              style={{
                borderColor: 'rgba(255,255,255,0.06)',
                color: '#7A8699',
              }}
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Canvas Container */}
        <div
          ref={containerRef}
          className="relative rounded-xl border overflow-hidden"
          style={{
            height: '560px',
            background: 'rgba(6,9,15,0.8)',
            borderColor: 'rgba(255,255,255,0.06)',
          }}
        >
          <canvas
            ref={canvasRef}
            onMouseMove={handleMouseMove}
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onWheel={handleWheel}
            style={{ cursor: 'grab' }}
          />

          {/* Legend — NO "Same Industry" */}
          <div
            className="absolute bottom-3 left-3 flex items-center gap-3 px-3 py-2 rounded-lg"
            style={{
              background: 'rgba(6,9,15,0.9)',
              border: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            {Object.entries(NODE_STYLES).map(([type, style]) => (
              <div key={type} className="flex items-center gap-1">
                <div
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ background: style.color }}
                />
                <span className="text-[9px]" style={{ color: '#3A4555' }}>
                  {style.label}
                </span>
              </div>
            ))}
            <div
              className="w-px h-3"
              style={{ background: 'rgba(255,255,255,0.1)' }}
            />
            <div className="flex items-center gap-1">
              <div
                className="w-4 h-px"
                style={{ background: 'rgba(255,255,255,0.3)' }}
              />
              <span className="text-[9px]" style={{ color: '#3A4555' }}>
                Link
              </span>
            </div>
          </div>

          {/* Node Detail Panel */}
          <AnimatePresence>
            {selectedNode && (
              <NodeDetailPanel
                node={selectedNode}
                onClose={() => setSelectedNode(null)}
                navigateTo={navigateTo}
                onViewContacts={focusCompany}
              />
            )}
          </AnimatePresence>
        </div>
      </div>
    </PageTransition>
  );
}