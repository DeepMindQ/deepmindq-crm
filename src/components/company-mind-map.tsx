'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Cpu, BookOpen, Lightbulb, Bell, FileText, Brain, Building2, ChevronRight } from 'lucide-react';

interface CompanyMindMapProps {
  company: any;
  contacts: any[];
  notes: any[];
  signals: any[];
  researchCard: any;
}

const GOLD = 'var(--color-gold)';
const GOLD_DIM = 'rgba(212,175,55,0.25)';
const GOLD_LINE = 'rgba(212,175,55,0.35)';
const BG_LIGHT = '#FFFFFF';
const NODE_BG = 'rgba(15,20,30,0.92)';
const NODE_BORDER = 'rgba(212,175,55,0.4)';
const CHILD_BG = 'rgba(15,20,30,0.75)';
const CHILD_BORDER = 'rgba(212,175,55,0.2)';
const DEPT_COLORS = ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444', '#06B6D4'];

interface MindNode {
  id: string;
  label: string;
  icon?: React.ReactNode;
  x: number;
  y: number;
  children?: { id: string; label: string; sublabel?: string; x: number; y: number }[];
  count?: number;
  color?: string;
}

function parseJsonField(field: string | null | undefined): any {
  if (!field) return null;
  try { return JSON.parse(field); } catch { return null; }
}

export function CompanyMindMap({ company, contacts, notes, signals, researchCard }: CompanyMindMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: 650 });
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [expandedNode, setExpandedNode] = useState<string | null>(null);

  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setSize({ w: rect.width || 800, h: Math.max(rect.height || 650, 550) });
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

  // ── Group contacts by department/role ──
  const contactGroups = useMemo(() => {
    const groups: Map<string, typeof contacts> = new Map();
    for (const c of (contacts || [])) {
      const dept = c.role || c.title || 'General';
      // Shorten long department names
      const shortDept = dept.length > 20 ? dept.substring(0, 20) + '...' : dept;
      if (!groups.has(shortDept)) groups.set(shortDept, []);
      groups.get(shortDept)!.push(c);
    }
    return Array.from(groups.entries());
  }, [contacts]);

  const signalSeverities = (signals || []).map((s: any) => s.severity);
  const hasCritical = signalSeverities.includes('critical');
  const hasHigh = signalSeverities.includes('high');
  const signalColor = hasCritical ? '#ef4444' : hasHigh ? '#f97316' : GOLD;

  const { cx, cy, innerRadius, childRadius, nodes } = useMemo(() => {
    const w = size.w;
    const h = size.h;
    const centerX = w / 2;
    const centerY = h / 2;
    const iRadius = Math.min(w, h) * 0.25;
    const cRadius = Math.min(w, h) * 0.42;

    const companyName = company?.rawName || company?.name || 'Company';
    const hasResearch = !!(researchCard?.businessOverview);

    const innerNodes: MindNode[] = [
      // ── DEPARTMENT GROUPS (hierarchical: Company → Departments → Contacts) ──
      ...contactGroups.map(([dept, deptContacts], gi) => {
        const totalGroups = contactGroups.length;
        const baseAngle = -Math.PI / 2 + (gi / totalGroups) * Math.PI * 2;
        return {
          id: `dept-${gi}`,
          label: dept,
          icon: <ChevronRight size={12} />,
          x: centerX + iRadius * Math.cos(baseAngle),
          y: centerY + iRadius * Math.sin(baseAngle),
          count: deptContacts.length,
          color: DEPT_COLORS[gi % DEPT_COLORS.length],
          children: deptContacts.slice(0, 8).map((c: any, ci: number) => {
            const childCount = deptContacts.length;
            const spread = Math.min(0.8, childCount * 0.12);
            const angle = childCount === 1
              ? baseAngle
              : baseAngle - spread / 2 + (ci / (childCount - 1)) * spread;
            return {
              id: `contact-${c.id}`,
              label: c.rawName || c.name || c.email || 'Unknown',
              sublabel: c.title || '',
              x: centerX + cRadius * Math.cos(angle),
              y: centerY + cRadius * Math.sin(angle),
            };
          }),
        };
      }),
      // ── SIGNALS ──
      {
        id: 'signals',
        label: 'Signals',
        icon: <Bell size={14} />,
        x: centerX + iRadius * Math.cos(Math.PI / 2),
        y: centerY + iRadius * Math.sin(Math.PI / 2),
        count: signals?.length || 0,
        color: signalColor,
        children: (signals || []).slice(0, 6).map((s: any, i: number, arr: any[]) => {
          const baseAngle = Math.PI / 2;
          const spread = 0.7;
          const angle = arr.length === 1 ? baseAngle : baseAngle - spread / 2 + (i / (arr.length - 1)) * spread;
          return {
            id: `sig-${s.id}`,
            label: s.title?.length > 28 ? s.title.substring(0, 28) + '...' : (s.title || 'Signal'),
            sublabel: s.severity || s.signalType || '',
            x: centerX + cRadius * Math.cos(angle),
            y: centerY + cRadius * Math.sin(angle),
          };
        }),
      },
      // ── NOTES ──
      {
        id: 'notes',
        label: 'Notes',
        icon: <FileText size={14} />,
        x: centerX + iRadius * Math.cos(Math.PI / 2 + Math.PI / 2.5),
        y: centerY + iRadius * Math.sin(Math.PI / 2 + Math.PI / 2.5),
        count: notes?.length || 0,
        children: (notes || []).slice(0, 5).map((n: any, i: number, arr: any[]) => {
          const baseAngle = Math.PI / 2 + Math.PI / 2.5;
          const spread = 0.6;
          const angle = arr.length === 1 ? baseAngle : baseAngle - spread / 2 + (i / (arr.length - 1)) * spread;
          return {
            id: `note-${n.id}`,
            label: n.title || (n.body?.substring(0, 25) || 'Note'),
            sublabel: n.category || 'general',
            x: centerX + cRadius * Math.cos(angle),
            y: centerY + cRadius * Math.sin(angle),
          };
        }),
      },
      // ── RESEARCH ──
      {
        id: 'research',
        label: 'Research',
        icon: <BookOpen size={14} />,
        x: centerX + iRadius * Math.cos(-Math.PI / 2 + Math.PI / 3),
        y: centerY + iRadius * Math.sin(-Math.PI / 2 + Math.PI / 3),
        count: hasResearch ? 1 : 0,
        children: [
          ...(researchCard?.businessOverview ? [{ id: 'r-overview', label: 'Business Overview' }] : []),
          ...(researchCard?.possibleOpportunities ? [{ id: 'r-opp', label: 'Opportunities' }] : []),
          ...(researchCard?.potentialChallenges ? [{ id: 'r-challenges', label: 'Challenges' }] : []),
          ...(researchCard?.relevantServices ? [{ id: 'r-services', label: 'Services' }] : []),
        ].map((item, i, arr) => {
          const baseAngle = -Math.PI / 2 + Math.PI / 3;
          const spread = 0.7;
          const angle = arr.length === 1 ? baseAngle : baseAngle - spread / 2 + (i / (arr.length - 1)) * spread;
          return { ...item, x: centerX + cRadius * Math.cos(angle), y: centerY + cRadius * Math.sin(angle) };
        }),
      },
      // ── TECH STACK ──
      ...(techStack.length > 0 ? [{
        id: 'techstack',
        label: 'Tech',
        icon: <Cpu size={14} />,
        x: centerX + iRadius * Math.cos(-Math.PI / 2 + Math.PI * 2 / 3),
        y: centerY + iRadius * Math.sin(-Math.PI / 2 + Math.PI * 2 / 3),
        count: techStack.length,
        children: techStack.slice(0, 8).map((t: string, i: number) => {
          const baseAngle = -Math.PI / 2 + Math.PI * 2 / 3;
          const spread = 0.6;
          const angle = techStack.length === 1 ? baseAngle : baseAngle - spread / 2 + (i / (techStack.length - 1)) * spread;
          return { id: `tech-${i}`, label: t, x: centerX + cRadius * Math.cos(angle), y: centerY + cRadius * Math.sin(angle) };
        }),
      }] : []),
    ];

    return { cx: centerX, cy: centerY, innerRadius: iRadius, childRadius: cRadius, nodes: innerNodes, companyName };
  }, [company, contacts, notes, signals, researchCard, contactGroups, techStack, size]);

  const companyName = company?.rawName || company?.name || 'Company';
  const totalContacts = contacts?.length || 0;

  return (
    <div ref={containerRef} className="w-full h-full min-h-[550px] relative rounded-xl overflow-hidden" style={{ background: 'linear-gradient(135deg, #0a0a1a 0%, #111128 100%)' }}>
      <svg width="100%" height="100%" viewBox={`0 0 ${size.w} ${size.h}`} className="overflow-visible">
        <defs>
          <filter id="glow-gold">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="glow-strong">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <radialGradient id="centerGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#d4af37" stopOpacity={0.15} />
            <stop offset="100%" stopColor="#d4af37" stopOpacity={0} />
          </radialGradient>
        </defs>

        {/* Ambient glow */}
        <circle cx={cx} cy={cy} r={size.w * 0.3} fill="url(#centerGrad)" />

        {/* Lines from center to inner nodes */}
        {nodes.map((node, i) => (
          <motion.line
            key={`line-${node.id}`}
            x1={cx} y1={cy}
            x2={node.x} y2={node.y}
            stroke={node.color || GOLD_LINE}
            strokeWidth={hoveredNode === node.id ? 2.5 : 1.5}
            strokeDasharray={node.color && node.color !== GOLD ? '6 3' : undefined}
            filter={hoveredNode === node.id ? 'url(#glow-gold)' : undefined}
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 0.6, delay: i * 0.08, ease: 'easeOut' }}
          />
        ))}

        {/* Lines from inner to children (when expanded) */}
        <AnimatePresence>
          {expandedNode && nodes.find(n => n.id === expandedNode)?.children?.map((child, i) => (
            <motion.line
              key={`child-line-${child.id}`}
              x1={nodes.find(n => n.id === expandedNode)!.x}
              y1={nodes.find(n => n.id === expandedNode)!.y}
              x2={child.x}
              y2={child.y}
              stroke={nodes.find(n => n.id === expandedNode)?.color || GOLD_DIM}
              strokeWidth={1}
              strokeDasharray="4 3"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 0.4, delay: i * 0.05 }}
            />
          ))}
        </AnimatePresence>

        {/* Center node — Company */}
        <motion.g
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          <circle cx={cx} cy={cy} r={55} fill={NODE_BG} stroke={GOLD} strokeWidth={2.5} filter="url(#glow-strong)" />
          <circle cx={cx} cy={cy} r={55} fill="rgba(212,175,55,0.08)" />
          <foreignObject x={cx - 22} y={cy - 28} width={44} height={44}>
            <div className="flex items-center justify-center w-full h-full">
              <Building2 size={24} color={GOLD} />
            </div>
          </foreignObject>
          <text x={cx} y={cy + 16} textAnchor="middle" fill={GOLD} fontSize={10} fontWeight="700" fontFamily="system-ui, sans-serif">
            {companyName.length > 14 ? companyName.substring(0, 14) + '...' : companyName}
          </text>
        </motion.g>

        {/* Inner ring nodes */}
        {nodes.map((node, i) => {
          const isHovered = hoveredNode === node.id;
          const isExpanded = expandedNode === node.id;
          const r = isHovered ? 38 : 32;

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
                <circle r={r} fill={NODE_BG} stroke={isHovered ? (node.color || GOLD) : NODE_BORDER} strokeWidth={isHovered ? 2.5 : 1.2} />
                <circle r={r} fill={`rgba(212,175,55,${isHovered ? 0.12 : 0.04})`} />
                <foreignObject x={-10} y={-20} width={20} height={20}>
                  <div className="flex items-center justify-center w-full h-full">
                    <span style={{ color: node.color || GOLD }}>{node.icon}</span>
                  </div>
                </foreignObject>
                <text y={5} textAnchor="middle" fill="#e2e8f0" fontSize={8} fontWeight="600" fontFamily="system-ui, sans-serif">
                  {node.label.length > 12 ? node.label.substring(0, 12) + '...' : node.label}
                </text>
                {node.count !== undefined && node.count > 0 && (
                  <g transform={`translate(${r * 0.55}, ${-r * 0.6})`}>
                    <circle r={9} fill={node.color || GOLD} opacity={0.9} />
                    <text y={3.5} textAnchor="middle" fill={BG_LIGHT} fontSize={7} fontWeight="700" fontFamily="system-ui, sans-serif">
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
        <AnimatePresence>
          {expandedNode && nodes.find(n => n.id === expandedNode)?.children?.map((child, i) => (
            <motion.g
              key={child.id}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.35, delay: i * 0.04 }}
            >
              <g transform={`translate(${child.x}, ${child.y})`}>
                <rect x={-50} y={-14} width={100} height={28} rx={6} fill={CHILD_BG} stroke={CHILD_BORDER} strokeWidth={0.8} />
                <text y={-2} textAnchor="middle" fill="#e2e8f0" fontSize={7.5} fontWeight="600" fontFamily="system-ui, sans-serif">
                  {child.label.length > 22 ? child.label.substring(0, 22) + '...' : child.label}
                </text>
                {child.sublabel && (
                  <text y={10} textAnchor="middle" fill="rgba(148,163,184,0.8)" fontSize={6} fontFamily="system-ui, sans-serif">
                    {child.sublabel.length > 18 ? child.sublabel.substring(0, 18) + '...' : child.sublabel}
                  </text>
                )}
              </g>
            </motion.g>
          ))}
        </AnimatePresence>

        {/* Legend */}
        <g transform={`translate(12, ${size.h - 12})`}>
          <rect x={-4} y={-14} width={180} height={20} rx={4} fill="rgba(0,0,0,0.5)" />
          <text y={0} fill="rgba(212,175,55,0.6)" fontSize={7} fontFamily="system-ui, sans-serif">
            {companyName} • {totalContacts} contacts • {nodes.length} categories
          </text>
        </g>
      </svg>

      {/* Tooltip */}
      <AnimatePresence>
        {hoveredNode && !expandedNode && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            className="absolute top-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg text-xs"
            style={{
              background: 'rgba(15,20,30,0.95)',
              border: '1px solid rgba(212,175,55,0.3)',
              color: '#e2e8f0',
              boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
            }}
          >
            {hoveredNode.startsWith('dept-') && (() => {
              const gi = parseInt(hoveredNode.split('-')[1]);
              const [dept, ctArr] = contactGroups[gi] || ['Unknown', []];
              return `${dept}: ${ctArr.length} contact${ctArr.length > 1 ? 's' : ''}`;
            })()}
            {hoveredNode === 'signals' && `${signals?.length || 0} intelligence signals`}
            {hoveredNode === 'notes' && `${notes?.length || 0} internal notes`}
            {hoveredNode === 'research' && researchCard?.businessOverview ? 'Research data available' : 'No research yet'}
            {hoveredNode === 'techstack' && `${techStack.length} technologies detected`}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
