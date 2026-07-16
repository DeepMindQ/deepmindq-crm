'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Compass, Plus, Search, Building2, Users, Target, TrendingUp,
  ChevronRight, X, Loader2, Sparkles, Edit3, Save, Trash2,
  ArrowRight, Shield, Swords, Lightbulb, AlertTriangle,
  CheckCircle2, Clock, MoreHorizontal, Eye, Zap, Brain,
  BookmarkPlus, BarChart3, UserCheck, UserX, Crown, CircleDot
} from 'lucide-react';

/* ═══════════════════════════════════════
   Types
   ═══════════════════════════════════════ */

interface Initiative {
  title: string;
  owner: string;
  status: 'not_started' | 'in_progress' | 'completed' | 'blocked';
  dueDate: string | null;
}

interface Stakeholder {
  name: string;
  role: string;
  type: 'champion' | 'influencer' | 'blocker' | 'decision_maker';
  notes: string;
}

interface SwotItem {
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  threats: string[];
}

interface Strategy {
  id: string;
  companyId: string | null;
  title: string;
  objective: string | null;
  currentSituation: string | null;
  swotAnalysis: SwotItem | null;
  keyInitiatives: Initiative[] | null;
  stakeholderMap: { champions: Stakeholder[]; influencers: Stakeholder[]; blockers: Stakeholder[]; decisionMakers: Stakeholder[] } | null;
  competitivePosition: string | null;
  nextSteps: string | null;
  status: 'draft' | 'active' | 'review' | 'completed' | 'archived';
  createdAt: string;
  updatedAt: string;
  companyName?: string;
}

const STATUS_CONFIG: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  draft: { icon: Edit3, color: 'bg-gray-100 text-gray-600', label: 'Draft' },
  active: { icon: CircleDot, color: 'bg-emerald-100 text-emerald-600', label: 'Active' },
  review: { icon: Eye, color: 'bg-amber-100 text-amber-600', label: 'In Review' },
  completed: { icon: CheckCircle2, color: 'bg-blue-100 text-blue-600', label: 'Completed' },
  archived: { icon: Archive, color: 'bg-gray-100 text-gray-400', label: 'Archived' },
};

/* ═══════════════════════════════════════
   Main Screen
   ═══════════════════════════════════════ */

export default function StrategyRoomScreen() {
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStrategy, setSelectedStrategy] = useState<Strategy | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState<Partial<Strategy>>({});

  // Create form
  const [newTitle, setNewTitle] = useState('');
  const [newCompany, setNewCompany] = useState('');
  const [newObjective, setNewObjective] = useState('');
  const [newSituation, setNewSituation] = useState('');

  const fetchStrategies = useCallback(async () => {
    try {
      const res = await fetch('/api/strategy-room');
      if (res.ok) setStrategies(await res.json());
    } catch { /* empty */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchStrategies(); }, [fetchStrategies]);

  const filtered = strategies
    .filter(s => !searchQuery || s.title.toLowerCase().includes(searchQuery.toLowerCase()) || (s.companyName || '').toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    setCreating(true);
    try {
      const res = await fetch('/api/strategy-room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle,
          companyName: newCompany || null,
          objective: newObjective || null,
          currentSituation: newSituation || null,
          aiGenerate: false,
        }),
      });
      if (res.ok) {
        const created = await res.json();
        setStrategies(prev => [created, ...prev]);
        setShowCreate(false);
        resetForm();
        setSelectedStrategy(created);
      }
    } catch { /* empty */ } finally { setCreating(false); }
  };

  const handleAIGenerate = async () => {
    if (!newTitle.trim()) return;
    setAiGenerating(true);
    try {
      const res = await fetch('/api/strategy-room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle,
          companyName: newCompany || null,
          objective: newObjective || null,
          currentSituation: newSituation || null,
          aiGenerate: true,
        }),
      });
      if (res.ok) {
        const created = await res.json();
        setStrategies(prev => [created, ...prev]);
        setShowCreate(false);
        resetForm();
        setSelectedStrategy(created);
      }
    } catch { /* empty */ } finally { setAiGenerating(false); }
  };

  const resetForm = () => {
    setNewTitle(''); setNewCompany(''); setNewObjective(''); setNewSituation('');
  };

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/strategy-room/${id}`, { method: 'DELETE' });
      setStrategies(prev => prev.filter(s => s.id !== id));
      if (selectedStrategy?.id === id) setSelectedStrategy(null);
    } catch { /* empty */ }
  };

  /* ── Skeleton ── */
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="h-8 w-48 rounded-lg bg-gray-200 animate-pulse" />
          <div className="h-9 w-36 rounded-lg bg-gray-200 animate-pulse" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-56 rounded-xl bg-white border border-gray-200 p-5 space-y-3">
              <div className="h-3 w-20 rounded bg-gray-200 animate-pulse" />
              <div className="h-6 w-3/4 rounded bg-gray-100 animate-pulse" />
              <div className="h-3 w-full rounded bg-gray-100 animate-pulse" />
              <div className="h-3 w-2/3 rounded bg-gray-100 animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  /* ── Strategy Detail View ── */
  if (selectedStrategy) {
    const swot = selectedStrategy.swotAnalysis;
    const initiatives = Array.isArray(selectedStrategy.keyInitiatives) ? selectedStrategy.keyInitiatives : [];
    const stakeholders = selectedStrategy.stakeholderMap;
    const statusCfg = STATUS_CONFIG[selectedStrategy.status] || STATUS_CONFIG.draft;
    const StatusIcon = statusCfg.icon;

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button onClick={() => { setSelectedStrategy(null); setEditMode(false); }} className="p-2 rounded-lg hover:bg-gray-100 transition-colors" style={{ color: 'var(--text-dim)' }}>
            <ChevronRight className="w-4 h-4 rotate-180" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5">
              <h1 className="text-lg font-semibold text-foreground tracking-tight truncate">{selectedStrategy.title}</h1>
              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium ${statusCfg.color}`}>
                <StatusIcon className="w-3 h-3" />
                {statusCfg.label}
              </span>
            </div>
            {selectedStrategy.companyName && (
              <p className="text-xs mt-1 flex items-center gap-1.5" style={{ color: 'var(--text-dim)' }}>
                <Building2 className="w-3 h-3" />{selectedStrategy.companyName}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {!editMode && (
              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                onClick={() => { setEditMode(true); setEditData(selectedStrategy); }}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border border-gray-200 bg-white text-muted-foreground hover:bg-gray-50">
                <Edit3 className="w-3.5 h-3.5" /> Edit
              </motion.button>
            )}
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
              onClick={() => handleDelete(selectedStrategy.id)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border border-red-200 bg-white text-red-500 hover:bg-red-50">
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </motion.button>
          </div>
        </div>

        {/* Objective */}
        {selectedStrategy.objective && (
          <div className="rounded-xl bg-white border p-5 shadow-sm" style={{ borderColor: 'var(--color-gold)', borderWidth: '1.5px' }}>
            <div className="flex items-center gap-2 mb-2">
              <Target className="w-4 h-4" style={{ color: 'var(--color-gold)' }} />
              <h3 className="text-sm font-semibold text-foreground">Strategic Objective</h3>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">{selectedStrategy.objective}</p>
          </div>
        )}

        {/* Current Situation */}
        {selectedStrategy.currentSituation && (
          <div className="rounded-xl bg-white border border-gray-200 p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-foreground mb-2">Current Situation Assessment</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{selectedStrategy.currentSituation}</p>
          </div>
        )}

        {/* SWOT Analysis */}
        {swot && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">SWOT Analysis</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {([
                { key: 'strengths', label: 'Strengths', icon: TrendingUp, color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
                { key: 'weaknesses', label: 'Weaknesses', icon: AlertTriangle, color: 'text-red-600 bg-red-50 border-red-200' },
                { key: 'opportunities', label: 'Opportunities', icon: Lightbulb, color: 'text-blue-600 bg-blue-50 border-blue-200' },
                { key: 'threats', label: 'Threats', icon: Shield, color: 'text-amber-600 bg-amber-50 border-amber-200' },
              ] as const).map(({ key, label, icon: SWotIcon, color }) => (
                <div key={key} className={`rounded-xl border p-4 ${color}`}>
                  <div className="flex items-center gap-2 mb-2.5">
                    <SWotIcon className="w-4 h-4" />
                    <h4 className="text-xs font-semibold">{label}</h4>
                  </div>
                  <ul className="space-y-1.5">
                    {(swot[key] || []).map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs leading-relaxed">
                        <ChevronRight className="w-3 h-3 shrink-0 mt-0.5" />
                        <span>{item}</span>
                      </li>
                    ))}
                    {(swot[key] || []).length === 0 && (
                      <li className="text-xs italic opacity-60">Not yet defined</li>
                    )}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Key Initiatives */}
        {initiatives.length > 0 && (
          <div className="rounded-xl bg-white border border-gray-200 p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-foreground mb-3">Key Initiatives</h3>
            <div className="space-y-2">
              {initiatives.map((init, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${
                    init.status === 'completed' ? 'bg-emerald-500' :
                    init.status === 'in_progress' ? 'bg-blue-500' :
                    init.status === 'blocked' ? 'bg-red-500' : 'bg-gray-300'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{init.title}</p>
                    {init.owner && <p className="text-[11px] text-muted-foreground">{init.owner}</p>}
                  </div>
                  {init.dueDate && (
                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <Clock className="w-3 h-3" />{init.dueDate}
                    </span>
                  )}
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                    init.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                    init.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                    init.status === 'blocked' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {init.status.replace('_', ' ')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Stakeholder Map */}
        {stakeholders && (
          <div className="rounded-xl bg-white border border-gray-200 p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-foreground mb-3">Stakeholder Map</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {([
                { key: 'champions' as const, label: 'Champions', icon: UserCheck, color: 'text-emerald-600' },
                { key: 'influencers' as const, label: 'Influencers', icon: Users, color: 'text-blue-600' },
                { key: 'blockers' as const, label: 'Potential Blockers', icon: UserX, color: 'text-red-600' },
                { key: 'decisionMakers' as const, label: 'Decision Makers', icon: Crown, color: 'text-amber-600' },
              ]).map(({ key, label, icon: SIcon, color }) => (
                <div key={key} className="rounded-lg border border-gray-100 p-3">
                  <div className={`flex items-center gap-2 mb-2 ${color}`}>
                    <SIcon className="w-3.5 h-3.5" />
                    <h4 className="text-xs font-semibold">{label}</h4>
                  </div>
                  {(stakeholders[key] || []).length > 0 ? (
                    <div className="space-y-1.5">
                      {stakeholders[key]!.map((s, i) => (
                        <div key={i} className="text-xs">
                          <span className="font-medium text-foreground">{s.name}</span>
                          <span className="text-muted-foreground"> — {s.role}</span>
                          {s.notes && <p className="text-muted-foreground mt-0.5">{s.notes}</p>}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-muted-foreground italic">Not yet mapped</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Next Steps */}
        {selectedStrategy.nextSteps && (
          <div className="rounded-xl bg-white border border-gray-200 p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <ArrowRight className="w-4 h-4" style={{ color: 'var(--color-gold)' }} />
              <h3 className="text-sm font-semibold text-foreground">Recommended Next Steps</h3>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{selectedStrategy.nextSteps}</p>
          </div>
        )}

        {/* Competitive Position */}
        {selectedStrategy.competitivePosition && (
          <div className="rounded-xl bg-white border border-gray-200 p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <Swords className="w-4 h-4 text-purple-500" />
              <h3 className="text-sm font-semibold text-foreground">Competitive Position</h3>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">{selectedStrategy.competitivePosition}</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'color-mix(in oklch, var(--color-gold) 12%, transparent)' }}>
            <Compass className="w-4.5 h-4.5" style={{ color: 'var(--color-gold)' }} />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground tracking-tight">Strategy Room</h1>
            <p className="text-xs" style={{ color: 'var(--text-dim)' }}>
              {strategies.length} strategy documents
            </p>
          </div>
        </div>
        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white shadow-sm"
          style={{ background: 'linear-gradient(135deg, var(--color-gold), var(--color-gold-dim))' }}
        >
          <Plus className="w-4 h-4" /> New Strategy
        </motion.button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input type="text" placeholder="Search strategies..." value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-4 py-2 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-gold)]/20 focus:border-[var(--color-gold)] transition-all"
        />
      </div>

      {/* Strategy Cards */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence>
            {filtered.map((strategy, i) => {
              const statusCfg = STATUS_CONFIG[strategy.status] || STATUS_CONFIG.draft;
              const StatusIcon = statusCfg.icon;
              const hasSwot = strategy.swotAnalysis && (
                (strategy.swotAnalysis.strengths?.length || 0) +
                (strategy.swotAnalysis.weaknesses?.length || 0) +
                (strategy.swotAnalysis.opportunities?.length || 0) +
                (strategy.swotAnalysis.threats?.length || 0)
              ) > 0;
              const initCount = Array.isArray(strategy.keyInitiatives) ? strategy.keyInitiatives.length : 0;

              return (
                <motion.div
                  key={strategy.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: i * 0.04 }}
                  className="group rounded-xl bg-white border border-gray-200 p-5 hover:shadow-md transition-all cursor-pointer"
                  onClick={() => setSelectedStrategy(strategy)}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium ${statusCfg.color}`}>
                      <StatusIcon className="w-3 h-3" />{statusCfg.label}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(strategy.updatedAt).toLocaleDateString()}
                    </span>
                  </div>
                  <h3 className="text-sm font-semibold text-foreground mb-1 group-hover:text-[var(--color-gold)] transition-colors line-clamp-2">
                    {strategy.title}
                  </h3>
                  {strategy.companyName && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mb-2">
                      <Building2 className="w-3 h-3" />{strategy.companyName}
                    </p>
                  )}
                  {strategy.objective && (
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-3 leading-relaxed">{strategy.objective}</p>
                  )}
                  <div className="flex items-center gap-3 pt-3 border-t border-gray-100">
                    {hasSwot && (
                      <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Swords className="w-3 h-3" /> SWOT
                      </span>
                    )}
                    {initCount > 0 && (
                      <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Target className="w-3 h-3" /> {initCount} initiatives
                      </span>
                    )}
                    {strategy.stakeholderMap && (
                      <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Users className="w-3 h-3" /> Stakeholders
                      </span>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      ) : (
        <div className="rounded-xl bg-white border border-gray-200 p-12 text-center">
          <Compass className="w-12 h-12 mx-auto mb-4 text-gray-200" />
          <h3 className="text-sm font-semibold text-foreground mb-1">
            {searchQuery ? 'No matching strategies' : 'No strategies yet'}
          </h3>
          <p className="text-xs text-muted-foreground mb-4 max-w-sm mx-auto">
            {searchQuery ? 'Try adjusting your search' : 'Create your first account strategy to plan and collaborate on deal approaches, SWOT analysis, and key initiatives.'}
          </p>
          {!searchQuery && (
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
              onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium text-white"
              style={{ background: 'linear-gradient(135deg, var(--color-gold), var(--color-gold-dim))' }}>
              <Plus className="w-3.5 h-3.5" /> Create First Strategy
            </motion.button>
          )}
        </div>
      )}

      {/* Create Modal */}
      <AnimatePresence>
        {showCreate && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm" onClick={() => setShowCreate(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }} className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="w-full max-w-lg rounded-2xl bg-white border border-gray-200 shadow-xl overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'color-mix(in oklch, var(--color-gold) 12%, transparent)' }}>
                      <Plus className="w-4 h-4" style={{ color: 'var(--color-gold)' }} />
                    </div>
                    <h2 className="text-sm font-semibold text-foreground">New Account Strategy</h2>
                  </div>
                  <button onClick={() => setShowCreate(false)} className="p-1.5 rounded-lg hover:bg-gray-100">
                    <X className="w-4 h-4 text-gray-400" />
                  </button>
                </div>
                <div className="px-6 py-4 space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1.5">Strategy Title</label>
                    <input type="text" value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
                      placeholder="e.g., Acme Corp Enterprise Expansion"
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-gold)]/20 focus:border-[var(--color-gold)]" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1.5">Company Name (optional)</label>
                    <input type="text" value={newCompany} onChange={(e) => setNewCompany(e.target.value)}
                      placeholder="e.g., Acme Corporation"
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-gold)]/20 focus:border-[var(--color-gold)]" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1.5">Objective</label>
                    <textarea value={newObjective} onChange={(e) => setNewObjective(e.target.value)}
                      placeholder="What is the primary strategic objective?" rows={2}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-gold)]/20 focus:border-[var(--color-gold)] resize-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1.5">Current Situation</label>
                    <textarea value={newSituation} onChange={(e) => setNewSituation(e.target.value)}
                      placeholder="Describe the current situation and context..." rows={2}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-gold)]/20 focus:border-[var(--color-gold)] resize-none" />
                  </div>
                </div>
                <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50/50">
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                    onClick={handleAIGenerate} disabled={aiGenerating || !newTitle.trim()}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium border border-gray-200 bg-white text-muted-foreground hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">
                    {aiGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                    {aiGenerating ? 'Generating...' : 'AI Generate Strategy'}
                  </motion.button>
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                    onClick={handleCreate} disabled={creating || !newTitle.trim()}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium text-white disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ background: 'linear-gradient(135deg, var(--color-gold), var(--color-gold-dim))' }}>
                    {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                    Create Strategy
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// Archive icon for the status config
function Archive(props: React.SVGProps<SVGSVGElement> & { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect width="20" height="5" x="2" y="3" rx="1" /><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" /><path d="M10 12h4" />
    </svg>
  );
}