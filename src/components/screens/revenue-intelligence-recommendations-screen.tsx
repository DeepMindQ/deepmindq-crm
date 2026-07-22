'use client';

import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Lightbulb, Target, RefreshCw, ChevronRight, User, MessageSquare, Clock, AlertTriangle, Star, Zap, BookOpen } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface Recommendation { companyId: string; companyName: string; industry: string | null; category: string; priority: string; action: string; rationale: string; suggestedConversation: string; targetDecisionMaker: string; whyNow: string; supportingSignals: Array<{ type: string; title: string; score: number }>; confidence: number; }

function priorityColor(p: string) { switch (p) { case 'high': return 'bg-red-100 text-red-700 border-red-200'; case 'medium': return 'bg-amber-100 text-amber-700 border-amber-200'; default: return 'bg-gray-100 text-gray-600 border-gray-200'; } }
function categoryLabel(c: string) { return c.replace(/_/g, ' '); }
function signalTypeColor(t: string) { switch (t) { case 'TECHNOLOGY': return 'border-blue-400 bg-blue-50 text-blue-700'; case 'GROWTH': return 'border-emerald-400 bg-emerald-50 text-emerald-700'; case 'PARTNERSHIP': return 'border-purple-400 bg-purple-50 text-purple-700'; case 'PAIN': return 'border-red-400 bg-red-50 text-red-700'; case 'LEADERSHIP': return 'border-amber-400 bg-amber-50 text-amber-700'; default: return 'border-gray-400 bg-gray-50 text-gray-700'; } }
function priorityIcon(p: string) { switch (p) { case 'high': return AlertTriangle; case 'medium': return Star; default: return Zap; } }

function RecCard({ rec, onViewBrief }: { rec: Recommendation; onViewBrief: (id: string) => void }) {
  const PI = priorityIcon(rec.priority);
  return (
    <div className="bg-white border border-border rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      <div className={`h-1 ${rec.priority === 'high' ? 'bg-red-500' : rec.priority === 'medium' ? 'bg-amber-500' : 'bg-gray-400'}`} />
      <div className="p-5 space-y-4">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0"><h3 className="text-base font-semibold text-foreground leading-tight">{rec.companyName}</h3><p className="text-sm text-muted-foreground mt-0.5">{rec.industry || 'Unknown'} &middot; {categoryLabel(rec.category)}</p></div>
          <Badge className={`text-[10px] uppercase font-bold ${priorityColor(rec.priority)}`}><PI className="w-3 h-3 mr-1" />{rec.priority}</Badge>
        </div>
        <div className="bg-gold-subtle/50 rounded-lg p-3 border-l-3 border-gold/50"><p className="text-sm font-medium text-foreground">{rec.action}</p></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex items-start gap-2"><User className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" /><div><p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Target</p><p className="text-sm text-foreground">{rec.targetDecisionMaker}</p></div></div>
          <div className="flex items-start gap-2"><MessageSquare className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" /><div><p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Conversation</p><p className="text-sm text-foreground line-clamp-2">{rec.suggestedConversation}</p></div></div>
          <div className="flex items-start gap-2 sm:col-span-2"><Clock className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" /><div><p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Why Now</p><p className="text-sm text-foreground/80">{rec.whyNow}</p></div></div>
        </div>
        {rec.supportingSignals.length > 0 && (<div className="space-y-2"><p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Supporting Intelligence ({rec.supportingSignals.length})</p><div className="flex flex-wrap gap-1.5">{rec.supportingSignals.slice(0, 6).map((s, i) => (<Badge key={i} variant="outline" className={`text-[10px] ${signalTypeColor(s.type)}`}>{s.type}: {s.title}</Badge>))}</div></div>)}
        <div className="flex items-center justify-between pt-2 border-t border-border/50"><p className="text-xs text-muted-foreground leading-relaxed flex-1 mr-4">{rec.rationale}</p><div className="flex items-center gap-2 shrink-0"><span className="text-xs text-muted-foreground">Confidence</span><span className="text-sm font-semibold">{Math.round(rec.confidence * 100)}%</span></div></div>
        <div className="flex items-center justify-end"><button onClick={() => onViewBrief(rec.companyId)} className="inline-flex items-center gap-1 text-sm font-medium text-gold hover:text-gold-bright transition-colors group/btn">View Full Brief<ChevronRight className="w-4 h-4 group-hover/btn:translate-x-0.5 transition-transform" /></button></div>
      </div>
    </div>
  );
}

export default function RevenueIntelligenceRecommendationsScreen({ navigateTo }: { navigateTo?: (screen: string, companyId?: string) => void }) {
  const [recs, setRecs] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterP, setFilterP] = useState<string | null>(null);

  const fetchRecs = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const dashRes = await fetch('/api/g-revenue-intelligence/dashboard');
      if (!dashRes.ok) throw new Error('Dashboard failed');
      const dash = (await dashRes.json()).data ?? (await dashRes.json());
      const top = dash.topScoredAccounts || [];
      const allRecs: Recommendation[] = [];
      for (let i = 0; i < top.length; i += 5) {
        const batch = top.slice(i, i + 5);
        const results = await Promise.allSettled(batch.map(async (a: { accountId: string; accountName: string; industry: string | null; category: string; score: number }) => {
          const r = await fetch(`/api/g-revenue-intelligence/accounts/${a.accountId}/recommendations`);
          if (!r.ok) return null;
          const d = (await r.json()).data ?? (await r.json());
          if (Array.isArray(d) && d.length > 0) { const t = d[0]; return { companyId: a.accountId, companyName: a.accountName, industry: a.industry, category: a.category, priority: t.priority || 'medium', action: t.action || t.recommendation || 'Engage', rationale: t.rationale || t.reason || '', suggestedConversation: t.suggestedConversation || t.conversation || '', targetDecisionMaker: t.targetDecisionMaker || t.target || 'Decision Maker', whyNow: t.whyNow || t.reason || '', supportingSignals: t.supportingSignals || t.signals || [], confidence: t.confidence || 0.5 }; }
          return null;
        }));
        for (const r of results) { if (r.status === 'fulfilled' && r.value) allRecs.push(r.value); }
      }
      const po: Record<string, number> = { high: 0, medium: 1, low: 2 };
      allRecs.sort((a, b) => (po[a.priority] ?? 2) - (po[b.priority] ?? 2) || b.confidence - a.confidence);
      setRecs(allRecs);
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed'); } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchRecs(); }, [fetchRecs]);

  const filtered = filterP ? recs.filter(r => r.priority === filterP) : recs;
  const hi = recs.filter(r => r.priority === 'high').length;
  const med = recs.filter(r => r.priority === 'medium').length;
  const lo = recs.filter(r => r.priority === 'low').length;

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8">
      <header className="space-y-1">
        <div className="flex items-center justify-between"><div className="flex items-center gap-2.5"><div className="w-9 h-9 rounded-lg bg-gold-subtle flex items-center justify-center"><Lightbulb className="w-5 h-5 text-gold" /></div><h1 className="text-2xl font-semibold text-foreground">Executive Recommendations</h1></div><button onClick={fetchRecs} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground border border-border rounded-lg hover:bg-black/[0.04] transition-colors"><RefreshCw className="w-3.5 h-3.5" />Refresh</button></div>
        <p className="text-sm text-muted-foreground">AI-generated recommendations with decision maker targeting and supporting evidence.</p>
      </header>

      <div className="flex flex-wrap gap-2">
        {[{ label: 'Dashboard', view: 'revenue-intelligence' }, { label: 'Opportunity Radar', view: 'revenue-intelligence-opportunities' }, { label: 'Recommendations', view: 'revenue-intelligence-recommendations', active: true }].map(item => (<button key={item.view} onClick={() => !(item as any).active && navigateTo?.(item.view as any)} disabled={(item as any).active} className={`px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors ${(item as any).active ? 'bg-primary text-primary-foreground' : 'bg-muted/60 text-muted-foreground hover:text-foreground hover:bg-muted'}`}>{item.label}</button>))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground"><BookOpen className="w-4 h-4" />Priority:</div>
        {[{ label: `All (${recs.length})`, value: null }, { label: `High (${hi})`, value: 'high' }, { label: `Medium (${med})`, value: 'medium' }, { label: `Low (${lo})`, value: 'low' }].map(f => (<button key={String(f.value)} onClick={() => setFilterP(f.value)} className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${filterP === f.value ? 'bg-primary text-primary-foreground' : 'bg-muted/60 text-muted-foreground hover:text-foreground'}`}>{f.label}</button>))}
      </div>

      {loading ? (<div className="grid grid-cols-1 lg:grid-cols-2 gap-4">{[...Array(4)].map((_, i) => (<div key={i} className="h-80 bg-muted rounded-xl animate-pulse" />))}</div>) : error || filtered.length === 0 ? (<div className="bg-white border border-border rounded-xl p-12 text-center"><Lightbulb className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" /><p className="text-sm text-muted-foreground">{error || 'No recommendations available.'}</p></div>) : (<div className="grid grid-cols-1 lg:grid-cols-2 gap-4">{filtered.map(r => (<RecCard key={r.companyId} rec={r} onViewBrief={id => navigateTo?.('revenue-intelligence-brief' as any, id)} />))}</div>)}
    </div>
  );
}
