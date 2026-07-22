'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp, Target, Activity, Sparkles, ChevronRight, RefreshCw,
  Flame, Sun, Sprout, AlertTriangle, BarChart3, Zap, Radar,
} from 'lucide-react';

interface DashboardSummary {
  totalAccounts: number; accountsWithScores: number; accountsWithoutScores: number;
  averageScore: number; totalOpportunitySignals: number; signalsNew: number;
  signalsValidated: number; briefsGenerated: number; averageBriefConfidence: number;
}
interface CategoryDist { HOT_ACCOUNT: number; WARM_ACCOUNT: number; NURTURE: number; AT_RISK: number; }
interface TopAccount { accountId: string; accountName: string; industry: string | null; score: number; category: string; calculatedAt: string; }
interface DashboardData { summary: DashboardSummary; categoryDistribution: CategoryDist; topScoredAccounts: TopAccount[]; signalTypeDistribution: Record<string, number>; }

function categoryIcon(cat: string) { switch (cat) { case 'HOT_ACCOUNT': return Flame; case 'WARM_ACCOUNT': return Sun; case 'NURTURE': return Sprout; case 'AT_RISK': return AlertTriangle; default: return BarChart3; } }
function categoryColor(cat: string) { switch (cat) { case 'HOT_ACCOUNT': return 'bg-red-50 border-red-200 text-red-700'; case 'WARM_ACCOUNT': return 'bg-amber-50 border-amber-200 text-amber-700'; case 'NURTURE': return 'bg-emerald-50 border-emerald-200 text-emerald-700'; case 'AT_RISK': return 'bg-gray-100 border-gray-200 text-gray-700'; default: return 'bg-gray-50 border-gray-200 text-gray-600'; } }
function categoryLabel(cat: string) { return cat.replace(/_/g, ' '); }
function scoreColor(score: number) { if (score >= 80) return 'bg-emerald-500 text-white'; if (score >= 60) return 'bg-amber-500 text-white'; return 'bg-red-500 text-white'; }

function KpiCard({ icon: Icon, label, value, context, accent }: { icon: React.ElementType; label: string; value: string | number; context: string; accent?: boolean }) {
  return (
    <div className="bg-white border border-border rounded-xl p-5 flex flex-col gap-2 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center gap-2">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${accent ? 'bg-gold-subtle' : 'bg-muted'}`}><Icon className={`w-4 h-4 ${accent ? 'text-gold' : 'text-muted-foreground'}`} /></div>
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
      </div>
      <p className={`text-3xl font-bold tracking-tight ${accent ? 'text-gold' : 'text-foreground'}`}>{value}</p>
      <p className="text-sm text-muted-foreground leading-snug">{context}</p>
    </div>
  );
}

function AccountCard({ rank, account, onView }: { rank: number; account: TopAccount; onView: (id: string) => void }) {
  const CatIcon = categoryIcon(account.category);
  return (
    <div className="bg-white border border-border rounded-xl p-5 flex flex-col gap-4 shadow-sm hover:shadow-md transition-shadow group">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <span className="w-7 h-7 rounded-full bg-gold-subtle text-gold text-xs font-bold flex items-center justify-center">#{rank}</span>
          <div><h3 className="text-base font-semibold text-foreground leading-tight">{account.accountName}</h3><p className="text-sm text-muted-foreground mt-0.5">{account.industry || 'Unknown industry'}</p></div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${categoryColor(account.category)}`}><CatIcon className="w-3 h-3" />{categoryLabel(account.category)}</span>
          <div className={`w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold ${scoreColor(account.score)}`}>{account.score}</div>
        </div>
      </div>
      <div className="flex items-center justify-between mt-auto pt-1 border-t border-border/50">
        <span className="text-xs text-muted-foreground">Scored {new Date(account.calculatedAt).toLocaleDateString()}</span>
        <button onClick={() => onView(account.accountId)} className="inline-flex items-center gap-1 text-sm font-medium text-gold hover:text-gold-bright transition-colors group/btn">View Brief<ChevronRight className="w-4 h-4 group-hover/btn:translate-x-0.5 transition-transform" /></button>
      </div>
    </div>
  );
}

function SignalDistBar({ distribution }: { distribution: Record<string, number> }) {
  const types = Object.entries(distribution).sort((a, b) => b[1] - a[1]);
  const total = types.reduce((sum, [, c]) => sum + c, 0);
  if (total === 0) return null;
  const colors: Record<string, string> = { TECHNOLOGY: 'bg-blue-500', GROWTH: 'bg-emerald-500', PARTNERSHIP: 'bg-purple-500', PAIN: 'bg-red-500', LEADERSHIP: 'bg-amber-500' };
  return (
    <div className="space-y-3">
      <div className="flex h-4 rounded-full overflow-hidden bg-muted/40">{types.map(([type, count]) => (<div key={type} className={`${colors[type] || 'bg-gray-400'} transition-all duration-500`} style={{ width: `${(count / total) * 100}%` }} title={`${type}: ${count}`} />))}</div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">{types.map(([type, count]) => (<div key={type} className="flex items-center gap-1.5 text-xs text-muted-foreground"><span className={`w-2.5 h-2.5 rounded-full ${colors[type] || 'bg-gray-400'}`} />{type}: {count}</div>))}</div>
    </div>
  );
}

export default function RevenueIntelligenceScreen({ navigateTo }: { navigateTo?: (screen: string, companyId?: string) => void }) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch('/api/g-revenue-intelligence/dashboard?period=90d');
      if (!res.ok) throw new Error(`${res.status}`);
      const json = await res.json();
      setData(json.data ?? json);
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed'); } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

  if (loading) return (<div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6 animate-pulse"><div className="h-8 w-72 bg-muted rounded" /><div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">{[...Array(4)].map((_, i) => (<div key={i} className="h-32 bg-muted rounded-xl" />))}</div><div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">{[...Array(6)].map((_, i) => (<div key={i} className="h-52 bg-muted rounded-xl" />))}</div></div>);

  if (error || !data) return (<div className="p-6 md:p-8 max-w-7xl mx-auto"><div className="bg-white border border-border rounded-xl p-12 text-center"><Activity className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" /><p className="text-sm text-muted-foreground mb-4">{error || 'No data available.'}</p><button onClick={fetchDashboard} className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"><RefreshCw className="w-4 h-4" />Retry</button></div></div>);

  const { summary, categoryDistribution, topScoredAccounts, signalTypeDistribution } = data;
  const entries = Object.entries(categoryDistribution) as [string, number][];

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8">
      <header className="space-y-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5"><div className="w-9 h-9 rounded-lg bg-gold-subtle flex items-center justify-center"><Sparkles className="w-5 h-5 text-gold" /></div><h1 className="text-2xl font-semibold text-foreground">Revenue Intelligence</h1></div>
          <button onClick={fetchDashboard} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground border border-border rounded-lg hover:bg-black/[0.04] transition-colors"><RefreshCw className="w-3.5 h-3.5" />Refresh</button>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">Account scoring, signal detection, and executive intelligence briefs powered by the Intelligence Fabric.</p>
      </header>

      <div className="flex flex-wrap gap-2">
        {[
          { label: 'Dashboard', view: 'revenue-intelligence', active: true },
          { label: 'Opportunity Radar', view: 'revenue-intelligence-opportunities' },
          { label: 'Executive Recommendations', view: 'revenue-intelligence-recommendations' },
        ].map((item) => (<button key={item.view} onClick={() => !item.active && navigateTo?.(item.view as any)} disabled={item.active} className={`px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors ${item.active ? 'bg-primary text-primary-foreground' : 'bg-muted/60 text-muted-foreground hover:text-foreground hover:bg-muted'}`}>{item.label}</button>))}
      </div>

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={Target} label="Accounts Scored" value={summary.accountsWithScores} context={`of ${summary.totalAccounts} total`} accent />
        <KpiCard icon={TrendingUp} label="Average Score" value={summary.averageScore} context="composite intelligence score" />
        <KpiCard icon={Zap} label="Active Signals" value={summary.totalOpportunitySignals} context={`${summary.signalsNew} new, ${summary.signalsValidated} validated`} accent />
        <KpiCard icon={Activity} label="Briefs Generated" value={summary.briefsGenerated} context={`avg confidence: ${Math.round(summary.averageBriefConfidence * 100)}%`} />
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Account Categories</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {entries.map(([cat, count]) => { const Icon = categoryIcon(cat); const total = entries.reduce((s, [, c]) => s + c, 0); return (<div key={cat} className={`rounded-xl border p-4 flex flex-col gap-2 ${categoryColor(cat)}`}><div className="flex items-center gap-2"><Icon className="w-4 h-4" /><span className="text-xs font-semibold uppercase tracking-wider">{categoryLabel(cat)}</span></div><p className="text-2xl font-bold">{count}</p><p className="text-xs opacity-75">{total > 0 ? Math.round((count / total) * 100) : 0}% of scored</p></div>); })}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Signal Distribution</h2>
        <div className="bg-white rounded-xl border p-5"><SignalDistBar distribution={signalTypeDistribution} /></div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Top Scored Accounts</h2>
        {topScoredAccounts.length === 0 ? (
          <div className="bg-white border border-border rounded-xl p-12 text-center"><TrendingUp className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" /><p className="text-sm text-muted-foreground">No accounts scored yet.</p></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {topScoredAccounts.map((account, idx) => (<AccountCard key={account.accountId} rank={idx + 1} account={account} onView={(id) => navigateTo?.('revenue-intelligence-brief' as any, id)} />))}
          </div>
        )}
      </section>
    </div>
  );
}
