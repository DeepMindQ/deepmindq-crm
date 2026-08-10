'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  AnimatedCard, StaggerGrid, StaggerItem, GradientCard, SectionHeader, AnimatedBar, StatValue,
} from '@/components/ui/animated-components';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  BarChart3, Database, Layers, Globe, Users, Shield, AlertTriangle,
} from 'lucide-react';
import {
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar,
  XAxis, YAxis, Tooltip, Legend,
} from 'recharts';
import { cardSolid, colors } from '@/components/design-system';
import type { KnowledgeAsset, CoverageData } from './knowledge-utils';
import { buildCoverage } from './knowledge-utils';
import { GRAPH_CATEGORY_COLORS, CATEGORY_CONFIG, CATEGORY_LABELS, goldAlpha, blackAlpha, greenAlpha } from './knowledge-types';

export function CoverageTab() {
  const [coverage, setCoverage] = useState<CoverageData | null>(null);
  const [coverageLoading, setCoverageLoading] = useState(false);
  const [healthData, setHealthData] = useState<any>(null);
  const [healthLoading, setHealthLoading] = useState(false);

  const loadCoverage = useCallback(async () => {
    setCoverageLoading(true);
    try {
      const cov = buildCoverage([]);
      setCoverage(cov);
      try {
        const allRes = await fetch('/api/capabilities');
        const allCaps: KnowledgeAsset[] = Array.isArray(await allRes.json()) ? await allRes.json() : [];
        setCoverage(buildCoverage(allCaps));
      } catch { /* use fallback */ }
    } catch { setCoverage(null); }
    setCoverageLoading(false);
  }, []);

  const loadHealth = useCallback(async () => {
    setHealthLoading(true);
    try {
      const res = await fetch('/api/knowledge/engine', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'coverage_v2' }) });
      setHealthData(await res.json());
    } catch { setHealthData(null); }
    setHealthLoading(false);
  }, []);

  useEffect(() => { loadCoverage(); loadHealth(); }, [loadCoverage, loadHealth]);

  const gold = 'var(--color-gold-dim)';

  return (
    <div className="space-y-4">
      {healthLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{Array.from({ length: 4 }).map((_, i) => (<div key={i} className="rounded-xl border border-border bg-card/60 p-5 space-y-3"><Skeleton className="h-5 w-1/2" /><Skeleton className="h-3 w-full" /><Skeleton className="h-3 w-3/4" /></div>))}</div>
      ) : healthData && !healthData.error ? (
        <GradientCard gradient="gold">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div><h3 className="text-base font-bold text-foreground flex items-center gap-2"><Shield className="w-5 h-5" style={{ color: gold }} />Knowledge Health</h3><p className="text-xs text-muted-foreground mt-0.5">Comprehensive knowledge base quality assessment</p></div>
              <Badge className="text-sm px-3 py-1 font-bold" style={{ background: `${healthData.healthColor}20`, color: healthData.healthColor, border: `1px solid ${healthData.healthColor}40` }}>{healthData.overallHealthScore}%</Badge>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {Object.entries(healthData.dimensions || {}).map(([key, dim]: [string, any]) => (
                <div key={key} className="p-3 rounded-lg bg-white border border-gray-200 shadow-sm">
                  <div className="flex items-center justify-between mb-2"><span className="text-[11px] text-muted-foreground uppercase tracking-wider">{dim.label}</span><span className="text-xs font-bold tabular-nums" style={{ color: dim.score >= 70 ? colors.green : dim.score >= 40 ? 'var(--dmq-amber)' : colors.red }}>{dim.score}%</span></div>
                  <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden"><motion.div className="h-full rounded-full" style={{ background: dim.score >= 70 ? colors.green : dim.score >= 40 ? 'var(--dmq-amber)' : colors.red }} initial={{ width: 0 }} animate={{ width: `${dim.score}%` }} transition={{ duration: 0.8 }} /></div>
                  <p className="text-[11px] text-muted-foreground mt-1">{dim.detail}</p>
                </div>
              ))}
            </div>
            {healthData.gaps && healthData.gaps.totalGaps > 0 && (
              <div className="mt-4 p-3 rounded-lg border border-amber-500/20 bg-amber-500/5">
                <div className="flex items-center gap-2 mb-2"><AlertTriangle className="w-4 h-4 text-amber-600" /><span className="text-xs font-semibold text-amber-600">{healthData.gaps.totalGaps} Coverage Gaps Detected</span></div>
                {healthData.gaps.industries.length > 0 && <div className="mb-1"><span className="text-[11px] text-muted-foreground">No industry coverage: </span><span className="text-[11px] text-amber-700">{healthData.gaps.industries.join(', ')}</span></div>}
                {healthData.gaps.roles.length > 0 && <div><span className="text-[11px] text-muted-foreground">No role coverage: </span><span className="text-[11px] text-amber-700">{healthData.gaps.roles.join(', ')}</span></div>}
              </div>
            )}
            {healthData.serviceLines && healthData.serviceLines.length > 0 && (
              <div className="mt-4 space-y-2">
                <p className="text-xs font-semibold text-foreground">Service Line Completeness</p>
                {healthData.serviceLines.map((sl: any) => (
                  <div key={sl.name} className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-40 shrink-0 truncate">{sl.name}</span>
                    <div className="flex-1"><AnimatedBar value={sl.score} max={100} color={sl.score >= 70 ? colors.green : sl.score >= 40 ? 'var(--dmq-amber)' : colors.red} /></div>
                    <span className="text-xs tabular-nums text-foreground w-8 text-right">{sl.score}%</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </GradientCard>
      ) : null}

      {coverageLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{Array.from({ length: 4 }).map((_, i) => (<div key={i} className="rounded-xl border border-border bg-card/60 p-5 space-y-3"><Skeleton className="h-5 w-1/2" /><Skeleton className="h-3 w-full" /><Skeleton className="h-3 w-3/4" /></div>))}</div>
      ) : coverage ? (
        <>
          <StaggerGrid className="grid grid-cols-2 lg:grid-cols-4 gap-4" stagger={0.06}>
            <StaggerItem><GradientCard gradient="gold"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: `${goldAlpha(0.15)}` }}><Database className="w-5 h-5" style={{ color: gold }} /></div><div><StatValue value={coverage.totalAssets} /><p className="text-[11px] text-muted-foreground">Total Assets</p></div></div></GradientCard></StaggerItem>
            <StaggerItem><GradientCard gradient="blue"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-lg flex items-center justify-center bg-blue-500/15"><Layers className="w-5 h-5 text-blue-600" /></div><div><StatValue value={coverage.serviceLines.length} /><p className="text-[11px] text-muted-foreground">Service Lines</p></div></div></GradientCard></StaggerItem>
            <StaggerItem><GradientCard gradient="green"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-lg flex items-center justify-center bg-emerald-500/15"><Globe className="w-5 h-5 text-emerald-600" /></div><div><StatValue value={`${coverage.industries.filter(i => i.coverage >= 50).length}/${coverage.industries.length}`} /><p className="text-[11px] text-muted-foreground">Industries Covered</p></div></div></GradientCard></StaggerItem>
            <StaggerItem><GradientCard gradient="purple"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-lg flex items-center justify-center bg-purple-500/15"><Users className="w-5 h-5 text-purple-600" /></div><div><StatValue value={`${coverage.roles.filter(r => r.coverage >= 50).length}/${coverage.roles.length}`} /><p className="text-[11px] text-muted-foreground">Roles Covered</p></div></div></GradientCard></StaggerItem>
          </StaggerGrid>

          <AnimatedCard delay={0.2}><div className="p-5"><SectionHeader title="Industry Coverage" subtitle="Knowledge assets targeting each industry sector" /><div className="space-y-3">{coverage.industries.map((ind, i) => (
            <div key={ind.name} className="flex items-center gap-4">
              <span className="text-xs text-muted-foreground w-40 shrink-0 truncate">{ind.name}</span>
              <div className="flex-1"><AnimatedBar value={ind.count} max={Math.max(...coverage.industries.map(x => x.count), 1)} color={ind.coverage >= 70 ? 'var(--dmq-emerald-light)' : ind.coverage >= 40 ? 'var(--dmq-amber)' : 'var(--dmq-rose)'} delay={i * 0.05} /></div>
              <span className="text-xs tabular-nums text-foreground w-8 text-right">{ind.count}</span>
              {ind.gaps.length > 0 && (<div className="relative group"><AlertTriangle className="w-3.5 h-3.5 text-amber-600 cursor-help" /><div className="absolute right-0 bottom-full mb-2 w-56 p-2 rounded-lg bg-card border border-border shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10"><p className="text-[11px] font-medium text-amber-600 mb-1">Gaps for {ind.name}:</p>{ind.gaps.map((g, gi) => (<p key={gi} className="text-[11px] text-muted-foreground">- {g}</p>))}</div></div>)}
            </div>
          ))}</div></div></AnimatedCard>

          <AnimatedCard delay={0.25}><div className="p-5"><SectionHeader title="Service Line Depth" subtitle="Assets per service line including case studies and proof points" /><div className="space-y-4">{coverage.serviceLines.map((sl, i) => (<div key={sl.name} className="space-y-2"><div className="flex items-center justify-between"><span className="text-xs font-medium text-foreground">{sl.name}</span><div className="flex items-center gap-2"><Badge variant="outline" className="text-[11px] border-emerald-500/30 text-emerald-600">{sl.caseStudies} case studies</Badge><Badge variant="outline" className="text-[11px] border-purple-500/30 text-purple-600">{sl.proofPoints} proof points</Badge><span className="text-xs text-muted-foreground">{sl.count} total</span></div></div><AnimatedBar value={sl.count} max={Math.max(...coverage.serviceLines.map(x => x.count), 1)} color={gold} delay={i * 0.05} /></div>))}</div></div></AnimatedCard>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <AnimatedCard delay={0.3}><div className="p-5"><SectionHeader title="Category Distribution" subtitle="Balance of knowledge asset types" /><StaggerGrid className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3" stagger={0.05}>{coverage.categories.map(cat => {const config = CATEGORY_CONFIG[cat.name] || CATEGORY_CONFIG.service_line; const Icon = config.icon; return (<StaggerItem key={cat.name}><div className="p-4 rounded-xl border border-border bg-background/50 text-center space-y-2"><div className="w-10 h-10 rounded-lg flex items-center justify-center mx-auto" style={{ background: `${config.color}15` }}><Icon className="w-5 h-5" style={{ color: config.color }} /></div><StatValue value={cat.count} /><p className="text-[11px] text-muted-foreground">{CATEGORY_LABELS[cat.name] || cat.name}</p></div></StaggerItem>);})}</StaggerGrid></div></AnimatedCard>
            <AnimatedCard delay={0.35}><div className="p-5"><SectionHeader title="Category Breakdown" subtitle="Visual distribution of asset types" /><div className="h-[220px] w-full"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={coverage.categories.map(cat => ({ name: CATEGORY_LABELS[cat.name] || cat.name, value: cat.count }))} cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={3} dataKey="value" stroke="none">{coverage.categories.map((cat) => (<Cell key={cat.name} fill={GRAPH_CATEGORY_COLORS[cat.name] || (CATEGORY_CONFIG[cat.name] || CATEGORY_CONFIG.service_line).color} />))}</Pie><Tooltip contentStyle={{ background: cardSolid, border: `1px solid ${blackAlpha(0.06)}`, boxShadow: `0 4px 16px ${blackAlpha(0.12)}`, borderRadius: '8px', fontSize: '12px', color: 'var(--dmq-neutral-700)' }} /><Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '11px', color: `${blackAlpha(0.15)}` }} /></PieChart></ResponsiveContainer></div></div></AnimatedCard>
          </div>

          <AnimatedCard delay={0.4}><div className="p-5"><SectionHeader title="Industry Coverage Map" subtitle="Asset count per industry — highlights knowledge gaps" /><div className="h-[280px] w-full"><ResponsiveContainer width="100%" height="100%"><BarChart data={coverage.industries.map(ind => ({ name: ind.name, count: ind.count, coverage: ind.coverage })).sort((a, b) => b.count - a.count)} layout="vertical" margin={{ left: 10, right: 20, top: 5, bottom: 5 }}><XAxis type="number" tick={{ fill: `${blackAlpha(0.1)}`, fontSize: 11 }} axisLine={{ stroke: `${blackAlpha(0.06)}` }} tickLine={false} /><YAxis type="category" dataKey="name" tick={{ fill: `${blackAlpha(0.12)}`, fontSize: 11 }} axisLine={false} tickLine={false} width={120} /><Tooltip contentStyle={{ background: cardSolid, border: `1px solid ${blackAlpha(0.06)}`, boxShadow: `0 4px 16px ${blackAlpha(0.12)}`, borderRadius: '8px', fontSize: '12px', color: 'var(--dmq-neutral-700)' }} formatter={(value: number, name: string) => [`${value} assets`, name]} /><Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={20}>{coverage.industries.map((ind, idx) => (<Cell key={ind.name} fill={ind.count === 0 ? colors.red : ind.coverage >= 70 ? colors.green : ind.coverage >= 40 ? 'var(--dmq-amber)' : 'var(--dmq-rose)'} />))}</Bar></BarChart></ResponsiveContainer></div><div className="flex items-center gap-4 mt-3 justify-center"><div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-sm bg-emerald-500" /><span className="text-[11px] text-muted-foreground">Good Coverage</span></div><div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-sm bg-amber-400" /><span className="text-[11px] text-muted-foreground">Partial Coverage</span></div><div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-sm bg-red-500" /><span className="text-[11px] text-muted-foreground">Gap / No Assets</span></div></div></div></AnimatedCard>
        </>
      ) : (
        <AnimatedCard><div className="text-center py-12"><BarChart3 className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" /><p className="text-sm text-muted-foreground">Unable to load coverage data</p></div></AnimatedCard>
      )}
    </div>
  );
}
