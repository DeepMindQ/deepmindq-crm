'use client';

import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Sparkles, Target, Clock, AlertTriangle, Zap, RefreshCw, Loader2, FileText, BarChart3 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface AccountBriefData {
  id: string; companyId: string; summary: string;
  keySignals: Array<{ type: string; title: string; score: number }>;
  themes: string[];
  risks: Array<{ risk: string; severity: string; evidence: string }>;
  recommendations: Array<{ action: string; priority: string; rationale: string }>;
  confidence: number; generatedAt: string; generatedBy: string;
}
interface OpportunitySignal { id: string; signalType: string; title: string; description: string | null; supportingIntelligenceIds: string[]; score: number; confidence: number; status: string; createdAt: string; }

function signalTypeColor(type: string) { switch (type) { case 'TECHNOLOGY': return 'border-blue-400 bg-blue-50 text-blue-700'; case 'GROWTH': return 'border-emerald-400 bg-emerald-50 text-emerald-700'; case 'PARTNERSHIP': return 'border-purple-400 bg-purple-50 text-purple-700'; case 'PAIN': return 'border-red-400 bg-red-50 text-red-700'; case 'LEADERSHIP': return 'border-amber-400 bg-amber-50 text-amber-700'; default: return 'border-gray-400 bg-gray-50 text-gray-700'; } }
function priorityStyle(p: string) { switch (p) { case 'high': return 'bg-red-100 text-red-700'; case 'medium': return 'bg-amber-100 text-amber-700'; default: return 'bg-gray-100 text-gray-600'; } }
function severityStyle(s: string) { switch (s) { case 'high': return 'bg-red-100 text-red-700 border-red-200'; case 'medium': return 'bg-amber-100 text-amber-700 border-amber-200'; default: return 'bg-gray-100 text-gray-600 border-gray-200'; } }

export default function RevenueIntelligenceBriefScreen({ companyId, navigateTo }: { companyId?: string; navigateTo?: (screen: string, companyId?: string) => void }) {
  const [brief, setBrief] = useState<AccountBriefData | null>(null);
  const [signals, setSignals] = useState<OpportunitySignal[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!companyId) return;
    setLoading(true); setError(null);
    try {
      const [briefRes, signalsRes] = await Promise.allSettled([
        fetch(`/api/g-revenue-intelligence/accounts/${companyId}/brief`),
        fetch(`/api/g-revenue-intelligence/accounts/${companyId}/signals`),
      ]);
      if (briefRes.status === 'fulfilled' && briefRes.value.ok) { const j = await briefRes.value.json(); setBrief(j.data ?? j); }
      if (signalsRes.status === 'fulfilled' && signalsRes.value.ok) { const j = await signalsRes.value.json(); setSignals(j.data ?? j); }
    } catch (err) { setError('Failed to load brief data'); } finally { setLoading(false); }
  }, [companyId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleGenerate = async () => {
    if (!companyId || generating) return;
    setGenerating(true);
    try {
      const res = await fetch(`/api/g-revenue-intelligence/accounts/${companyId}/generate-brief`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ runSignalDetection: true }) });
      if (res.ok) await fetchData(); else setError('Generation failed');
    } catch { setError('Generation failed'); } finally { setGenerating(false); }
  };

  if (loading) return (<div className="max-w-4xl mx-auto p-8 space-y-8 animate-pulse"><div className="h-4 w-24 bg-muted rounded" /><div className="h-9 w-72 bg-muted rounded" />{[1,2,3].map(i => (<div key={i} className="h-48 w-full bg-muted rounded-xl" />))}</div>);

  if (!companyId) return (<div className="max-w-4xl mx-auto p-8 text-center"><FileText className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" /><p className="text-sm text-muted-foreground">Select a company to view its intelligence brief.</p><button onClick={() => navigateTo?.('revenue-intelligence')} className="mt-4 inline-flex items-center gap-1.5 text-sm text-gold"><ArrowLeft className="w-4 h-4" />Back</button></div>);

  const noBrief = !brief && !generating;

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <button onClick={() => navigateTo?.('revenue-intelligence')} className="group inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8"><ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />Back to Revenue Intelligence</button>

      {noBrief ? (
        <div className="bg-white border border-border rounded-xl p-12 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-gold-subtle flex items-center justify-center mx-auto"><Sparkles className="w-8 h-8 text-gold" /></div>
          <h2 className="text-lg font-semibold text-foreground">No Intelligence Brief Yet</h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">Generate a hybrid intelligence brief combining signal detection, account scoring, and AI narrative from your Intelligence Fabric.</p>
          <button onClick={handleGenerate} className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">{generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}{generating ? 'Generating...' : 'Generate Intelligence Brief'}</button>
          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>
      ) : (
        <div className="space-y-8">
          <div className="flex items-start justify-between gap-4">
            <div><h1 className="text-2xl font-semibold text-foreground">Account Intelligence Brief</h1><p className="text-sm text-muted-foreground mt-1">Company ID: {companyId}</p></div>
            <button onClick={handleGenerate} disabled={generating} className="shrink-0 inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors">{generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}{generating ? 'Regenerating...' : 'Regenerate'}</button>
          </div>

          {generating && (<div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center gap-3"><Loader2 className="w-5 h-5 text-blue-500 animate-spin" /><p className="text-sm text-blue-700">Running signal detection and generating hybrid brief...</p></div>)}

          {brief && (<>
            <section className="bg-white rounded-xl border p-6 space-y-4"><div className="flex items-center gap-2 text-sm font-semibold text-foreground"><FileText className="w-4 h-4 text-gold" />Executive Summary</div><p className="text-base leading-relaxed text-foreground/80">{brief.summary}</p><div className="flex items-center gap-4 pt-2"><div className="flex items-center gap-2"><Clock className="w-4 h-4 text-muted-foreground" /><span className="text-sm text-muted-foreground">Confidence: <span className="font-semibold text-foreground">{Math.round(brief.confidence * 100)}%</span></span></div><span className="text-sm text-muted-foreground">Generated: {new Date(brief.generatedAt).toLocaleDateString()}</span></div></section>

            <section className="bg-white rounded-xl border p-6 space-y-4"><div className="flex items-center gap-2 text-sm font-semibold text-foreground"><Zap className="w-4 h-4 text-gold" />Key Revenue Signals</div>
              {brief.keySignals.length === 0 ? <p className="text-sm text-muted-foreground italic">No signals detected.</p> : (<div className="space-y-2">{brief.keySignals.map((sig, i) => (<div key={i} className={`flex items-center gap-3 p-3 rounded-lg border-l-3 ${signalTypeColor(sig.type)}`}><div className="flex-1 min-w-0"><p className="text-sm font-medium text-foreground">{sig.title}</p></div><div className="text-right shrink-0"><span className="text-sm font-bold">{sig.score}</span><span className="text-xs text-muted-foreground ml-0.5">/100</span></div></div>))}</div>)}
            </section>

            {brief.themes.length > 0 && (<section className="bg-white rounded-xl border p-6 space-y-4"><div className="flex items-center gap-2 text-sm font-semibold text-foreground"><BarChart3 className="w-4 h-4 text-gold" />Strategic Themes</div><div className="flex flex-wrap gap-2">{brief.themes.map((t, i) => (<Badge key={i} variant="outline" className="text-sm px-3 py-1">{t}</Badge>))}</div></section>)}

            {brief.risks.length > 0 && (<section className="bg-white rounded-xl border p-6 space-y-4"><div className="flex items-center gap-2 text-sm font-semibold text-foreground"><AlertTriangle className="w-4 h-4 text-amber-500" />Business Risks</div><div className="space-y-3">{brief.risks.map((r, i) => (<div key={i} className={`flex items-start gap-3 p-3 rounded-lg border ${severityStyle(r.severity)}`}><AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /><div className="flex-1"><p className="text-sm font-medium">{r.risk}</p><p className="text-xs text-muted-foreground mt-0.5">{r.evidence}</p></div><Badge variant="secondary" className={`text-[10px] uppercase ${severityStyle(r.severity)}`}>{r.severity}</Badge></div>))}</div></section>)}

            {brief.recommendations.length > 0 && (<section className="bg-white rounded-xl border p-6 space-y-4"><div className="flex items-center gap-2 text-sm font-semibold text-foreground"><Target className="w-4 h-4 text-gold" />Recommended Actions</div><div className="space-y-3">{brief.recommendations.map((rec, i) => (<div key={i} className="flex items-start gap-3 p-4 rounded-lg bg-muted/40 border border-border/50"><div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs font-bold text-white ${priorityStyle(rec.priority)}`}>{i + 1}</div><div className="flex-1"><p className="text-sm font-medium text-foreground">{rec.action}</p><p className="text-xs text-muted-foreground mt-1">{rec.rationale}</p></div><Badge variant="secondary" className={`text-[10px] uppercase shrink-0 ${priorityStyle(rec.priority)}`}>{rec.priority}</Badge></div>))}</div></section>)}
          </>)}

          {signals.length > 0 && (<section className="bg-white rounded-xl border p-6 space-y-4"><div className="flex items-center gap-2 text-sm font-semibold text-foreground">Opportunity Signals Detail</div><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-border"><th className="text-left py-2 pr-4 font-medium text-muted-foreground">Type</th><th className="text-left py-2 pr-4 font-medium text-muted-foreground">Title</th><th className="text-right py-2 pr-4 font-medium text-muted-foreground">Score</th><th className="text-right py-2 pr-4 font-medium text-muted-foreground">Confidence</th><th className="text-left py-2 font-medium text-muted-foreground">Status</th></tr></thead><tbody className="divide-y divide-border/50">{signals.map(s => (<tr key={s.id} className="hover:bg-muted/30"><td className="py-2.5 pr-4"><Badge variant="outline" className={`text-[10px] ${signalTypeColor(s.signalType)}`}>{s.signalType}</Badge></td><td className="py-2.5 pr-4 font-medium">{s.title}</td><td className="py-2.5 pr-4 text-right font-semibold">{s.score}</td><td className="py-2.5 pr-4 text-right text-muted-foreground">{(s.confidence * 100).toFixed(0)}%</td><td className="py-2.5"><Badge variant="secondary" className="text-[10px]">{s.status}</Badge></td></tr>))}</tbody></table></div></section>)}

          {error && (<div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3"><AlertTriangle className="w-5 h-5 text-red-500 shrink-0" /><p className="text-sm text-red-700">{error}</p></div>)}
        </div>
      )}
    </div>
  );
}
