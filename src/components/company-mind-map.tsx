'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Users, Cpu, BookOpen, Lightbulb, Bell, FileText, Brain } from 'lucide-react';

interface CompanyMindMapProps {
  company: any;
  contacts: any[];
  notes: any[];
  signals: any[];
  researchCard: any;
}

const GOLD = '#D4AF37';
const GOLD_DIM = 'rgba(212,175,55,0.25)';
const GOLD_LINE = 'rgba(212,175,55,0.35)';
const BG_DARK = '#FAFAFA';
const NODE_BG = 'rgba(15,20,30,0.85)';
const NODE_BORDER = 'rgba(212,175,55,0.3)';
const CHILD_BG = 'rgba(15,20,30,0.7)';
const CHILD_BORDER = 'rgba(212,175,55,0.15)';

interface MindNode {
  id: string;
  label: string;
  icon?: React.ReactNode;
  x: number;
  y: number;
  children?: { id: string; label: string; x: number; y: number }[];
  count?: number;
  color?: string;
}

function parseJsonField(field: string | null | undefined): any {
  if (!field) return null;
  try { return JSON.parse(field); } catch { return null; }
}

export function CompanyMindMap({ company, contacts, notes, signals, researchCard }: CompanyMindMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 700, h: 600 });
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [expandedNode, setExpandedNode] = useState<string | null>(null);

  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setSize({ w: rect.width || 700, h: Math.max(rect.height || 600, 500) });
      }
    };
    updateSize();
    const ro = new ResizeObserver(updateSize);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const techStack = useMemo(() => {
    const raw = researchCard?.techStack;
    if (!raw) return [];
    try {
      if (typeof raw === 'string') {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
        if (typeof parsed === 'string') return parsed.split(',').map((s: string) => s.trim()).filter(Boolean);
      }
      if (typeof raw === 'object' && Array.isArray(raw)) return raw;
      return String(raw).split(',').map(s => s.trim()).filter(Boolean);
    } catch {
      return String(raw).split(',').map(s => s.trim()).filter(Boolean);
    }
  }, [researchCard]);

  const socialProfiles = useMemo(() => parseJsonField(researchCard?.socialProfiles), [researchCard]);

  const { cx, cy, innerRadius, childRadius, nodes } = useMemo(() => {
    const w = size.w;
    const h = size.h;
    const centerX = w / 2;
    const centerY = h / 2;
    const iRadius = Math.min(w, h) * 0.28;
    const cRadius = Math.min(w, h) * 0.44;

    const companyName = company?.rawName || company?.name || 'Company';
    const hasResearch = !!(researchCard?.businessOverview);

    const signalSeverities = (signals || []).map((s: any) => s.severity);
    const hasCritical = signalSeverities.includes('critical');
    const hasHigh = signalSeverities.includes('high');
    const signalColor = hasCritical ? '#ef4444' : hasHigh ? '#f97316' : GOLD;

    const innerNodes: MindNode[] = [
      {
        id: 'contacts',
        label: 'Contacts',
        icon: <Users size={14} />,
        x: centerX + iRadius * Math.cos(-Math.PI / 2),
        y: centerY + iRadius * Math.sin(-Math.PI / 2),
        count: contacts?.length || 0,
        children: (contacts || []).slice(0, 6).map((c: any, i: number) => {
          const angle = -Math.PI / 2 - 0.6 + (i / Math.max((contacts || []).length - 1, 1)) * 1.2;
          const useAngle = (contacts || []).length === 1 ? -Math.PI / 2 : angle;
          return {
            id: `contact-${c.id}`,
            label: c.rawName || c.name || c.email || 'Unknown',
            x: centerX + cRadius * Math.cos(useAngle),
            y: centerY + cRadius * Math.sin(useAngle),
          };
        }),
      },
      {
        id: 'techstack',
        label: 'Tech Stack',
        icon: <Cpu size={14} />,
        x: centerX + iRadius * Math.cos(-Math.PI / 6),
        y: centerY + iRadius * Math.sin(-Math.PI / 6),
        count: techStack.length,
        children: techStack.slice(0, 8).map((t: string, i: number) => {
          const angle = -Math.PI / 6 - 0.5 + (i / Math.max(techStack.length - 1, 1)) * 1.0;
          const useAngle = techStack.length === 1 ? -Math.PI / 6 : angle;
          return {
            id: `tech-${i}`,
            label: t,
            x: centerX + cRadius * Math.cos(useAngle),
            y: centerY + cRadius * Math.sin(useAngle),
          };
        }),
      },
      {
        id: 'research',
        label: 'Research',
        icon: <BookOpen size={14} />,
        x: centerX + iRadius * Math.cos(Math.PI / 6),
        y: centerY + iRadius * Math.sin(Math.PI / 6),
        count: hasResearch ? 1 : 0,
        children: [
          ...(researchCard?.businessOverview ? [{ id: 'r-overview', label: 'Business Overview' }] : []),
          ...(researchCard?.possibleOpportunities ? [{ id: 'r-opp', label: 'Opportunities' }] : []),
          ...(researchCard?.potentialChallenges ? [{ id: 'r-challenges', label: 'Challenges' }] : []),
          ...(researchCard?.relevantServices ? [{ id: 'r-services', label: 'Services' }] : []),
        ].map((item, i, arr) => {
          const baseAngle = Math.PI / 6;
          const spread = 0.7;
          const angle = arr.length === 1 ? baseAngle : baseAngle - spread / 2 + (i / (arr.length - 1)) * spread;
          return { ...item, x: centerX + cRadius * Math.cos(angle), y: centerY + cRadius * Math.sin(angle) };
        }),
      },
      {
        id: 'opportunities',
        label: 'Opportunities',
        icon: <Lightbulb size={14} />,
        x: centerX + iRadius * Math.cos(Math.PI / 2),
        y: centerY + iRadius * Math.sin(Math.PI / 2),
        count: researchCard?.possibleOpportunities ? 1 : 0,
        children: (researchCard?.possibleOpportunities || '').split('\n').filter(Boolean).slice(0, 4).map((line: string, i: number, arr: string[]) => {
          const baseAngle = Math.PI / 2;
          const spread = 0.6;
          const angle = arr.length === 1 ? baseAngle : baseAngle - spread / 2 + (i / (arr.length - 1)) * spread;
          return {
            id: `opp-${i}`,
            label: line.length > 30 ? line.substring(0, 30) + '...' : line,
            x: centerX + cRadius * Math.cos(angle),
            y: centerY + cRadius * Math.sin(angle),
          };
        }),
      },
      {
        id: 'signals',
        label: 'Signals',
        icon: <Bell size={14} />,
        x: centerX + iRadius * Math.cos(5 * Math.PI / 6),
        y: centerY + iRadius * Math.sin(5 * Math.PI / 6),
        count: signals?.length || 0,
        color: signalColor,
        children: (signals || []).slice(0, 5).map((s: any, i: number, arr: any[]) => {
          const baseAngle = 5 * Math.PI / 6;
          const spread = 0.6;
          const angle = arr.length === 1 ? baseAngle : baseAngle - spread / 2 + (i / (arr.length - 1)) * spread;
          return {
            id: `sig-${s.id}`,
            label: s.title?.length > 28 ? s.title.substring(0, 28) + '...' : (s.title || 'Signal'),
            x: centerX + cRadius * Math.cos(angle),
            y: centerY + cRadius * Math.sin(angle),
          };
        }),
      },
      {
        id: 'notes',
        label: 'Notes',
        icon: <FileText size={14} />,
        x: centerX + iRadius * Math.cos(-5 * Math.PI / 6),
        y: centerY + iRadius * Math.sin(-5 * Math.PI / 6),
        count: notes?.length || 0,
        children: (notes || []).slice(0, 5).map((n: any, i: number, arr: any[]) => {
          const baseAngle = -5 * Math.PI / 6;
          const spread = 0.6;
          const angle = arr.length === 1 ? baseAngle : baseAngle - spread / 2 + (i / (arr.length - 1)) * spread;
          return {
            id: `note-${n.id}`,
            label: n.title || (n.body?.substring(0, 25) || 'Note'),
            x: centerX + cRadius * Math.cos(angle),
            y: centerY + cRadius * Math.sin(angle),
          };
        }),
      },
    ];

    return { cx: centerX, cy: centerY, innerRadius: iRadius, childRadius: cRadius, nodes: innerNodes, companyName };
  }, [company, contacts, notes, signals, researchCard, techStack, size]);

  const companyName = company?.rawName || company?.name || 'Company';

  return (
    <div ref={containerRef} className="w-full h-full min-h-[500px] relative" style={{ background: BG_DARK }}>
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${size.w} ${size.h}`}
        className="overflow-visible"
      >
        <defs>
          <filter id="glow-gold">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="glow-strong">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <radialGradient id="centerGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={GOLD} stopOpacity={0.2} />
            <stop offset="100%" stopColor={GOLD} stopOpacity={0} />
          </radialGradient>
          <linearGradient id="lineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={GOLD} stopOpacity={0.5} />
            <stop offset="100%" stopColor={GOLD} stopOpacity={0.15} />
          </linearGradient>
        </defs>

        {/* Ambient glow */}
        <circle cx={cx} cy={cy} r={size.w * 0.35} fill="url(#centerGrad)" />

        {/* Lines from center to inner nodes */}
        {nodes.map((node, i) => (
          <motion.line
            key={`line-${node.id}`}
            x1={cx} y1={cy}
            x2={node.x} y2={node.y}
            stroke={node.color || GOLD_LINE}
            strokeWidth={hoveredNode === node.id ? 2.5 : 1.5}
            filter={hoveredNode === node.id ? 'url(#glow-gold)' : undefined}
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 0.6, delay: i * 0.08, ease: 'easeOut' }}
          />
        ))}

        {/* Lines from inner to children (when expanded) */}
        {expandedNode && nodes.find(n => n.id === expandedNode)?.children?.map((child, i) => (
          <motion.line
            key={`child-line-${child.id}`}
            x1={nodes.find(n => n.id === expandedNode)!.x}
            y1={nodes.find(n => n.id === expandedNode)!.y}
            x2={child.x}
            y2={child.y}
            stroke={GOLD_DIM}
            strokeWidth={1}
            strokeDasharray="4 3"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 0.4, delay: i * 0.05 }}
          />
        ))}

        {/* Center node */}
        <motion.g
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          <circle cx={cx} cy={cy} r={50} fill={NODE_BG} stroke={GOLD} strokeWidth={2} filter="url(#glow-strong)" />
          <circle cx={cx} cy={cy} r={50} fill="rgba(212,175,55,0.06)" />
          <foreignObject x={cx - 20} y={cy - 24} width={40} height={40}>
            <div className="flex items-center justify-center w-full h-full">
              <Brain size={22} color={GOLD} />
            </div>
          </foreignObject>
          <text x={cx} y={cy + 14} textAnchor="middle" fill={GOLD} fontSize={9} fontWeight="700" fontFamily="system-ui, sans-serif">
            {companyName.length > 12 ? companyName.substring(0, 12) + '...' : companyName}
          </text>
        </motion.g>

        {/* Inner ring nodes */}
        {nodes.map((node, i) => {
          const isHovered = hoveredNode === node.id;
          const isExpanded = expandedNode === node.id;
          const r = isHovered ? 36 : 32;

          return (
            <motion.g
              key={node.id}
              initial={{ scale: 0, opacity: 0, x: cx, y: cy }}
              animate={{ scale: 1, opacity: 1, x: 0, y: 0 }}
              transition={{ duration: 0.5, delay: 0.15 + i * 0.07, ease: [0.22, 1, 0.36, 1] }}
              onMouseEnter={() => setHoveredNode(node.id)}
              onMouseLeave={() => setHoveredNode(null)}
              onClick={() => setExpandedNode(isExpanded ? null : node.id)}
              style={{ cursor: 'pointer' }}
            >
              <g transform={`translate(${node.x}, ${node.y})`}>
                <circle r={r} fill={NODE_BG} stroke={isHovered ? (node.color || GOLD) : NODE_BORDER} strokeWidth={isHovered ? 2 : 1.2} />
                <circle r={r} fill={`rgba(212,175,55,${isHovered ? 0.08 : 0.03})`} />
                <foreignObject x={-10} y={-18} width={20} height={20}>
                  <div className="flex items-center justify-center w-full h-full">
                    <span style={{ color: node.color || GOLD }}>{node.icon}</span>
                  </div>
                </foreignObject>
                <text y={6} textAnchor="middle" fill="#e2e8f0" fontSize={8} fontWeight="600" fontFamily="system-ui, sans-serif">
                  {node.label}
                </text>
                {node.count !== undefined && node.count > 0 && (
                  <g transform={`translate(${r * 0.55}, ${-r * 0.6})`}>
                    <circle r={8} fill={node.color || GOLD} opacity={0.9} />
                    <text y={3} textAnchor="middle" fill={BG_DARK} fontSize={7} fontWeight="700" fontFamily="system-ui, sans-serif">
                      {node.count}
                    </text>
                  </g>
                )}
                {isHovered && (
                  <text y={r + 14} textAnchor="middle" fill="rgba(212,175,55,0.7)" fontSize={7} fontFamily="system-ui, sans-serif">
                    Click to {isExpanded ? 'collapse' : 'expand'}
                  </text>
                )}
              </g>
            </motion.g>
          );
        })}

        {/* Child nodes (expanded) */}
        {expandedNode && nodes.find(n => n.id === expandedNode)?.children?.map((child, i) => (
          <motion.g
            key={child.id}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.35, delay: i * 0.04 }}
          >
            <g transform={`translate(${child.x}, ${child.y})`}>
              <rect x={-45} y={-12} width={90} height={24} rx={6} fill={CHILD_BG} stroke={CHILD_BORDER} strokeWidth={0.8} />
              <text y={4} textAnchor="middle" fill="#cbd5e1" fontSize={7} fontFamily="system-ui, sans-serif">
                {child.label.length > 20 ? child.label.substring(0, 20) + '...' : child.label}
              </text>
            </g>
          </motion.g>
        ))}
      </svg>

      {/* Tooltip overlay */}
      {hoveredNode && !expandedNode && (
        <div
          className="absolute top-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg text-xs"
          style={{
            background: 'rgba(15,20,30,0.95)',
            border: '1px solid rgba(212,175,55,0.3)',
            color: '#e2e8f0',
            boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
          }}
        >
          {hoveredNode === 'contacts' && `${contacts?.length || 0} contacts at this company`}
          {hoveredNode === 'techstack' && `${techStack.length} technologies detected`}
          {hoveredNode === 'research' && researchCard?.businessOverview ? 'Research data available' : 'No research data'}
          {hoveredNode === 'opportunities' && researchCard?.possibleOpportunities ? 'Opportunities identified' : 'No opportunities yet'}
          {hoveredNode === 'signals' && `${signals?.length || 0} signals detected`}
          {hoveredNode === 'notes' && `${notes?.length || 0} notes`}
        </div>
      )}
    </div>
  );
}