'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { tokens, elevation } from '@/components/intelligence-os/design-tokens';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState, LoadingSkeleton } from '@/components/ui/screen-states';
import {
  Crosshair,
  X,
  Building2,
  TrendingUp,
  Target,
  DollarSign,
  ArrowUpRight,
  Clock,
} from 'lucide-react';

/* ── Types ── */
interface RadarCompany {
  id: string;
  name: string;
  fitScore: number; // 0-100
  intentScore: number; // 0-100
  revenue: string;
  industry: string;
  stage: string;
  owner: string;
  lastSignal: string;
  confidence: 'high' | 'medium' | 'low';
}

/* ── Mock data ── */
const COMPANIES: RadarCompany[] = [
  {
    id: '1',
    name: 'Acme Corp',
    fitScore: 92,
    intentScore: 88,
    revenue: '$120M',
    industry: 'SaaS',
    stage: 'Active Eval',
    owner: 'Sarah Chen',
    lastSignal: '2d ago — RFP issued',
    confidence: 'high',
  },
  {
    id: '2',
    name: 'TechVenture Inc',
    fitScore: 85,
    intentScore: 79,
    revenue: '$85M',
    industry: 'FinTech',
    stage: 'Discovery',
    owner: 'Marcus J',
    lastSignal: '5d ago — Hiring spree',
    confidence: 'high',
  },
  {
    id: '3',
    name: 'DataFlow Systems',
    fitScore: 78,
    intentScore: 82,
    revenue: '$200M',
    industry: 'Data',
    stage: 'Demo',
    owner: 'Emily R',
    lastSignal: '1d ago — VP posted about data challenges',
    confidence: 'high',
  },
  {
    id: '4',
    name: 'CloudPeak',
    fitScore: 88,
    intentScore: 65,
    revenue: '$95M',
    industry: 'Cloud',
    stage: 'Prospecting',
    owner: 'David Kim',
    lastSignal: '1w ago — Platform migration signal',
    confidence: 'medium',
  },
  {
    id: '5',
    name: 'RetailMax',
    fitScore: 82,
    intentScore: 58,
    revenue: '$300M',
    industry: 'Retail',
    stage: 'Prospecting',
    owner: 'Sarah Chen',
    lastSignal: '2w ago — Digital transformation',
    confidence: 'medium',
  },
  {
    id: '6',
    name: 'HealthFirst',
    fitScore: 75,
    intentScore: 71,
    revenue: '$150M',
    industry: 'HealthTech',
    stage: 'Discovery',
    owner: 'Marcus J',
    lastSignal: '3d ago — FDA approval news',
    confidence: 'high',
  },
  {
    id: '7',
    name: 'FinServe Global',
    fitScore: 70,
    intentScore: 45,
    revenue: '$500M',
    industry: 'Finance',
    stage: 'Nurture',
    owner: 'Emily R',
    lastSignal: '3w ago — Quarterly earnings',
    confidence: 'low',
  },
  {
    id: '8',
    name: 'GreenEnergy Co',
    fitScore: 55,
    intentScore: 40,
    revenue: '$80M',
    industry: 'Energy',
    stage: 'Monitor',
    owner: 'David Kim',
    lastSignal: '1mo ago — Sustainability report',
    confidence: 'low',
  },
  {
    id: '9',
    name: 'LogiTech',
    fitScore: 62,
    intentScore: 38,
    revenue: '$60M',
    industry: 'Logistics',
    stage: 'Monitor',
    owner: 'Sarah Chen',
    lastSignal: '2w ago — Expansion news',
    confidence: 'low',
  },
  {
    id: '10',
    name: 'MediaWave',
    fitScore: 48,
    intentScore: 52,
    revenue: '$45M',
    industry: 'Media',
    stage: 'Nurture',
    owner: 'Marcus J',
    lastSignal: '4d ago — Content platform launch',
    confidence: 'medium',
  },
  {
    id: '11',
    name: 'EduTech Pro',
    fitScore: 58,
    intentScore: 60,
    revenue: '$35M',
    industry: 'EdTech',
    stage: 'Nurture',
    owner: 'Emily R',
    lastSignal: '6d ago — Series B funding',
    confidence: 'medium',
  },
  {
    id: '12',
    name: 'CyberShield',
    fitScore: 90,
    intentScore: 42,
    revenue: '$70M',
    industry: 'Cybersecurity',
    stage: 'Prospecting',
    owner: 'David Kim',
    lastSignal: '2w ago — Security breach in industry',
    confidence: 'medium',
  },
  {
    id: '13',
    name: 'AutoDrive AI',
    fitScore: 68,
    intentScore: 75,
    revenue: '$40M',
    industry: 'Automotive',
    stage: 'Discovery',
    owner: 'Sarah Chen',
    lastSignal: '3d ago — Partnership announcement',
    confidence: 'high',
  },
  {
    id: '14',
    name: 'BuildRight',
    fitScore: 35,
    intentScore: 30,
    revenue: '$25M',
    industry: 'Construction',
    stage: 'Monitor',
    owner: 'Marcus J',
    lastSignal: '1mo ago — Tech adoption survey',
    confidence: 'low',
  },
  {
    id: '15',
    name: 'QuantumLabs',
    fitScore: 42,
    intentScore: 55,
    revenue: '$15M',
    industry: 'Research',
    stage: 'Nurture',
    owner: 'Emily R',
    lastSignal: '1w ago — Research paper published',
    confidence: 'low',
  },
];

const CONFIDENCE_COLORS = {
  high: {
    bg: tokens.confidence.high.bg,
    color: tokens.confidence.high.value,
    border: tokens.confidence.high.border,
  },
  medium: {
    bg: tokens.confidence.medium.bg,
    color: tokens.confidence.medium.value,
    border: tokens.confidence.medium.border,
  },
  low: {
    bg: tokens.confidence.low.bg,
    color: tokens.confidence.low.value,
    border: tokens.confidence.low.border,
  },
};

const QUADRANTS = [
  {
    id: 'hot',
    label: '🔥 Hot / High-Intent',
    x: '75%',
    y: '25%',
    textColor: '#DC2626',
    bgColor: 'rgba(220,38,38,0.03)',
  },
  {
    id: 'warm',
    label: '⚡ Warm / High-Fit',
    x: '25%',
    y: '25%',
    textColor: '#D97706',
    bgColor: 'rgba(217,119,6,0.03)',
  },
  {
    id: 'nurture',
    label: '🌱 Nurture',
    x: '25%',
    y: '75%',
    textColor: '#16A34A',
    bgColor: 'rgba(22,163,74,0.03)',
  },
  {
    id: 'monitor',
    label: '👁 Monitor',
    x: '75%',
    y: '75%',
    textColor: '#6B7280',
    bgColor: 'rgba(107,114,128,0.03)',
  },
];

const RADAR_PADDING = 50;

/* ── Component ── */
export default function OpportunityRadarScreen() {
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<RadarCompany | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 600);
    return () => clearTimeout(t);
  }, []);

  const getPosition = useCallback((fit: number, intent: number, w: number, h: number) => {
    const x = RADAR_PADDING + (fit / 100) * (w - RADAR_PADDING * 2);
    const y = RADAR_PADDING + ((100 - intent) / 100) * (h - RADAR_PADDING * 2);
    return { x, y };
  }, []);

  if (loading) return <LoadingSkeleton />;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div
        className="flex items-center justify-between px-6 py-4 border-b"
        style={{ borderColor: tokens.border.default }}
      >
        <div className="flex items-center gap-3">
          <Crosshair className="w-5 h-5" style={{ color: tokens.domain.opportunity }} />
          <div>
            <h1 className="text-lg font-semibold" style={{ color: tokens.text.primary }}>
              Opportunity Radar
            </h1>
            <p className="text-xs" style={{ color: tokens.text.muted }}>
              Companies plotted by fit score (x) and intent score (y)
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs" style={{ color: tokens.text.muted }}>
          <span>{COMPANIES.length} companies</span>
          <div className="flex items-center gap-3">
            {Object.entries(CONFIDENCE_COLORS).map(([key, val]) => (
              <span key={key} className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: val.color }} />
                <span className="capitalize">{key}</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Radar Grid */}
      <div className="flex-1 relative p-4">
        <div
          ref={containerRef}
          className="w-full h-full relative rounded-xl border overflow-hidden"
          style={{ borderColor: tokens.border.default, backgroundColor: tokens.surface.secondary }}
        >
          {/* Quadrant backgrounds */}
          {QUADRANTS.map((q) => (
            <div
              key={q.id}
              className="absolute flex items-center justify-center pointer-events-none"
              style={{
                left: q.id === 'warm' || q.id === 'nurture' ? 0 : '50%',
                top: q.id === 'hot' || q.id === 'warm' ? 0 : '50%',
                width: '50%',
                height: '50%',
                backgroundColor: q.bgColor,
              }}
            >
              <span className="text-xs font-medium opacity-40" style={{ color: q.textColor }}>
                {q.label}
              </span>
            </div>
          ))}

          {/* Grid lines */}
          <div
            className="absolute left-1/2 top-0 bottom-0 w-px"
            style={{ backgroundColor: tokens.border.default, opacity: 0.5 }}
          />
          <div
            className="absolute top-1/2 left-0 right-0 h-px"
            style={{ backgroundColor: tokens.border.default, opacity: 0.5 }}
          />

          {/* Axis labels */}
          <div
            className="absolute bottom-2 left-1/2 -translate-x-1/2 text-xs font-medium"
            style={{ color: tokens.text.muted }}
          >
            ← Low Fit
            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
            High Fit →
          </div>
          <div
            className="absolute left-2 top-1/2 -translate-y-1/2 text-xs font-medium [writing-mode:vertical-rl]"
            style={{ color: tokens.text.muted }}
          >
            High Intent ↑
          </div>

          {/* Company dots */}
          <RadarPlot
            companies={COMPANIES}
            getPosition={getPosition}
            selected={selected}
            hovered={hovered}
            onSelect={setSelected}
            onHover={setHovered}
          />

          {/* Detail Popup */}
          {selected && (
            <div
              className="absolute z-20 w-72 rounded-xl border p-0 overflow-hidden"
              style={{
                backgroundColor: tokens.surface.primary,
                borderColor: tokens.border.default,
                boxShadow: elevation.xl,
                right: 16,
                top: 16,
              }}
            >
              <div
                className="flex items-center justify-between px-4 py-3 border-b"
                style={{ borderColor: tokens.border.default }}
              >
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4" style={{ color: tokens.accent.DEFAULT }} />
                  <span className="text-sm font-semibold" style={{ color: tokens.text.primary }}>
                    {selected.name}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => setSelected(null)}
                >
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
              <div className="p-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div
                    className="rounded-lg p-2.5"
                    style={{ backgroundColor: tokens.surface.secondary }}
                  >
                    <p className="text-xs" style={{ color: tokens.text.muted }}>
                      Fit Score
                    </p>
                    <p className="text-lg font-bold" style={{ color: tokens.accent.DEFAULT }}>
                      {selected.fitScore}
                    </p>
                  </div>
                  <div
                    className="rounded-lg p-2.5"
                    style={{ backgroundColor: tokens.surface.secondary }}
                  >
                    <p className="text-xs" style={{ color: tokens.text.muted }}>
                      Intent Score
                    </p>
                    <p className="text-lg font-bold" style={{ color: tokens.domain.opportunity }}>
                      {selected.intentScore}
                    </p>
                  </div>
                </div>
                <div className="space-y-2">
                  {[
                    { icon: DollarSign, label: 'Revenue', value: selected.revenue },
                    { icon: Building2, label: 'Industry', value: selected.industry },
                    { icon: Target, label: 'Stage', value: selected.stage },
                    { icon: TrendingUp, label: 'Owner', value: selected.owner },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <span
                        className="text-xs flex items-center gap-1.5"
                        style={{ color: tokens.text.muted }}
                      >
                        <item.icon className="w-3 h-3" /> {item.label}
                      </span>
                      <span className="text-xs font-medium" style={{ color: tokens.text.primary }}>
                        {item.value}
                      </span>
                    </div>
                  ))}
                </div>
                <div
                  className="flex items-start gap-2 pt-2 border-t"
                  style={{ borderColor: tokens.border.default }}
                >
                  <Clock
                    className="w-3.5 h-3.5 mt-0.5 shrink-0"
                    style={{ color: tokens.text.muted }}
                  />
                  <div>
                    <p className="text-xs" style={{ color: tokens.text.muted }}>
                      Last Signal
                    </p>
                    <p className="text-xs font-medium" style={{ color: tokens.text.secondary }}>
                      {selected.lastSignal}
                    </p>
                  </div>
                </div>
                <Badge
                  className={
                    selected.confidence === 'high'
                      ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
                      : selected.confidence === 'medium'
                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                        : 'bg-gray-100 text-gray-800'
                  }
                >
                  {selected.confidence} confidence
                </Badge>
                <Button size="sm" className="w-full mt-1">
                  <ArrowUpRight className="w-3.5 h-3.5 mr-1.5" /> View Account
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Inner Plot Component (handles resize) ── */
function RadarPlot({
  companies,
  getPosition,
  selected,
  hovered,
  onSelect,
  onHover,
}: {
  companies: RadarCompany[];
  getPosition: (fit: number, intent: number, w: number, h: number) => { x: number; y: number };
  selected: RadarCompany | null;
  hovered: string | null;
  onSelect: (c: RadarCompany | null) => void;
  onHover: (id: string | null) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: 500 });

  useEffect(() => {
    const el = ref.current?.parentElement;
    if (!el) return;
    const obs = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setSize({ w: width, h: height });
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div ref={ref} className="absolute inset-0">
      {companies.map((c) => {
        const pos = getPosition(c.fitScore, c.intentScore, size.w, size.h);
        const isSelected = selected?.id === c.id;
        const isHovered = hovered === c.id;
        const cc = CONFIDENCE_COLORS[c.confidence];
        return (
          <div
            key={c.id}
            className="absolute cursor-pointer group"
            style={{
              left: pos.x - 8,
              top: pos.y - 8,
              transform: `scale(${isSelected || isHovered ? 1.5 : 1})`,
              transition: 'transform 0.15s ease',
              zIndex: isSelected ? 10 : isHovered ? 5 : 1,
            }}
            onClick={() => onSelect(isSelected ? null : c)}
            onMouseEnter={() => onHover(c.id)}
            onMouseLeave={() => onHover(null)}
          >
            {/* Tooltip */}
            {(isHovered || isSelected) && (
              <div
                className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 rounded text-xs whitespace-nowrap pointer-events-none"
                style={{
                  backgroundColor: tokens.surface.primary,
                  border: `1px solid ${tokens.border.default}`,
                  boxShadow: elevation.md,
                  color: tokens.text.primary,
                }}
              >
                {c.name} ({c.fitScore}/{c.intentScore})
              </div>
            )}
            <div
              className="w-4 h-4 rounded-full border-2"
              style={{
                backgroundColor: cc.bg,
                borderColor: cc.color,
                boxShadow: isSelected ? `0 0 0 4px ${cc.bg}` : undefined,
              }}
            />
          </div>
        );
      })}
    </div>
  );
}
