'use client';

import { useState, useEffect, useCallback } from 'react';
import { Radar, Target, ChevronRight, RefreshCw, Filter, Flame, Sun, Sprout, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface OpportunityItem { companyId: string; companyName: string; industry: string | null; category: string; title: string; description: string; score: number; confidence: number; signalCount: number; topSignals: Array<{ type: string; title: string; score: number }>; }

function categoryIcon(cat: string) { switch (cat) { case 'HOT_ACCOUNT': return Flame; case 'WARM_ACCOUNT': return Sun; case 'NURTURE': return Sprout; case 'AT_RISK': return AlertTriangle; default: return Target; } }
function categoryColor(cat: string) { switch (cat) { case 'HOT_ACCOUNT': return 'bg-red-100 text-red-700 border-red-200'; case 'WARM_ACCOUNT': return 'bg-amber-100 text-amber-700 border-amber-200'; case 'NURTURE': return 'bg-emerald-100 text-emerald-700 border-emerald-200'; case 'AT_RISK': return 'bg-gray-100 text-gray-700 border-gray-200'; default: return 'bg-gray-100 text-gray-600 border-gray-200'; } }
function categoryLabel(cat: string) { return cat.replace(/_/g, ' '); }
function signalTypeColor(type: string) { switch (type) { case 'TECHNOLOGY': return 'border-blue-400 bg-blue-50 text-blue-700'; case 'GROWTH': return 'border-emerald-400 bg-emerald-50 text-emerald-700'; case 'PARTNERSHIP': return 'border-purple-400 bg-purple-50 text-purple-700'; case 'PAIN': return 'border-red-400 bg-red-50 text-red-700'; case 'LEADERSHIP': return 'border-amber-400 bg-amber-50 text-amber-700'; default: return 'border-gray-400 bg-gray-50 text-gray-700'; } }
function scoreGradient(score: number) { if (score >= 80) return 'from-emerald-500 to-emerald-600'; if (score >= 60) return 'from-amber-500 to-amber-600'; return 'from-red-400 to-red-500'; }

function OpportunityCard({ opp, onViewBrief }: { opp: OpportunityItem; onViewBrief: (id: string) => void }) {
  const CatIcon = categoryIcon(opp.category);
  return (
    <div className="bg-white border border-border rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      <div className={`h-2 bg-gradient-to-r ${scoreGradient(opp.score)}`} />
      <div className="p-5 space-y-4">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0"><h3 className="text-base font-semibold text-foreground leading-tight truncate">{opp.companyName}</h3><p className="text-sm text-muted-foreground mt-0.5">{opp.industry || 'Unknown'}</p></div>
          <div className="flex flex-col items-end gap-1 shrink-0 ml-3"><span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${categoryColor(opp.category)}`}><CatIcon className="w-3 h-3" />{categoryLabel(opp.category)}</span><div className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold bg-gradient-to-br from-gray-800 to-gray-900 text-white">{opp.score}</div></div>
        </div>
        <p className="text-sm text-foreground/80 leading-relaxed line-clamp-2">{opp.description}</p>
        <div className="flex flex-wrap gap-1.5">{opp.topSignals.slice(0, 4).map((s, i) => (<Badge key={i} variant="outline" className={`text-[10px] ${signalTypeColor(s.type)}`}>{s.type} {s.score}</Badge>))}{opp.signalCount > 4 && <Badge variant="secondary" className="text-[10px]">+{opp.signalCount - 4} more</Badge>}</div>
        <div className="space-y-1"><div className="flex items-center justify-between text-xs"><span className="text-muted-foreground">Confidence</span><span className="font-medium">{Math.round(opp.confidence * 100)}%</span></div><div className="h-1.5 rounded-full bg-muted/40 overflow-hidden"><div className="h-full rounded-full bg-emerald-400 transition-all" style={{ width: `${Math.round(opp.confidence * 100)}%` }} /></div></div>
        <div className="flex items-center justify-between pt-2 border-t border-border/50"><span className="text-xs text-muted-foreground">{opp.signalCount} signals</span><button onClick={() => onViewBrief(opp.companyId)} className="inline-flex items-center gap-1 text-sm font-medium text-gold hover:text-gold-bright transition-colors group/btn">View Brief<ChevronRight className="w-4 h-4 group-hover/btn:translate-x-0.5 transition-transform" /></button></div>
      </div>
    </div>
  );
}

export default function RevenueIntelligenceOpportunitiesScreen({ navigateTo }: { navigateTo?: (screen: string, companyId?: string) => void }) {
  const [opportunities, setOpportunities] = useState<OpportunityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string | null>(null);

  const fetchOpps = useCallback(async () => {
    setLoading(true); setError(null);
    try { const p = new URLSearchParams(); if (filterType) p.set('category', filterType); const res = await fetch(`/api/g-revenue-intelligence/opportunities?${p}`); if (!res.ok) throw new Error(`${res.status}`); const j = await res.json(); setOpportunities(j.data ?? j); } catch (e) { setError(e instanceof Error ? e.message : 'Failed'); } finally { setLoading(false); }
  }, [filterType]);

  useEffect(() => { fetchOpps(); }, [fetchOpps]);

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8">
      <header className="space-y-1">
        <div className="flex items-center justify-between"><div className="flex items-center gap-2.5"><div className="w-9 h-9 rounded-lg bg-gold-subtle flex items-center justify-center"><Radar className="w-5 h-5 text-gold" /></div><h1 className="text-2xl font-semibold text-foreground">Opportunity Radar</h1></div><button onClick={fetchOpps} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground border border-border rounded-lg hover:bg-black/[0.04] transition-colors"><RefreshCw className="w-3.5 h-3.5" />Refresh</button></div>
        <p className="text-sm text-muted-foreground">Cross-account opportunity detection powered by signal analysis.</p>
      </header>

      <div className="flex flex-wrap gap-2">
        {[{ label: 'Dashboard', view: 'revenue-intelligence' }, { label: 'Opportunity Radar', view: 'revenue-intelligence-opportunities', active: true }, { label: 'Recommendations', view: 'revenue-intelligence-recommendations' }].map(item => (<button key={item.view} onClick={() => !(item as any).active && navigateTo?.(item.view as any)} disabled={(item as any).active} className={`px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors ${(item as any).active ? 'bg-primary text-primary-foreground' : 'bg-muted/60 text-muted-foreground hover:text-foreground hover:bg-muted'}`}>{item.label}</button>))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground"><Filter className="w-4 h-4" />Filters:</div>
        {[{ label: 'All', value: null }, { label: 'TECHNOLOGY', value: 'TECHNOLOGY' }, { label: 'GROWTH', value: 'GROWTH' }, { label: 'PARTNERSHIP', value: 'PARTNERSHIP' }, { label: 'PAIN', value: 'PAIN' }, { label: 'LEADERSHIP', value: 'LEADERSHIP' }].map(f => (<button key={String(f.value)} onClick={() => setFilterType(f.value)} className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${filterType === f.value ? 'bg-primary text-primary-foreground' : 'bg-muted/60 text-muted-foreground hover:text-foreground'}`}>{f.label}</button>))}
      </div>

      {loading ? (<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">{[...Array(6)].map((_, i) => (<div key={i} className="h-72 bg-muted rounded-xl animate-pulse" />))}</div>) : error || opportunities.length === 0 ? (<div className="bg-white border border-border rounded-xl p-12 text-center"><Radar className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" /><p className="text-sm text-muted-foreground">{error || 'No opportunities detected.'}</p></div>) : (<><p className="text-sm text-muted-foreground">{opportunities.length} opportunities found</p><div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">{opportunities.map(o => (<OpportunityCard key={o.companyId} opp={o} onViewBrief={id => navigateTo?.('revenue-intelligence-brief' as any, id)} />))}</div></>)}
    </div>
  );
}
