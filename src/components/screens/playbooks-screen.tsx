'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BookOpen, Plus, Search, Sparkles, ChevronRight, Play,
  Target, MessageSquare, Handshake, FileCheck, TrendingUp,
  ShieldAlert, MoreHorizontal, Pencil, Trash2, Copy, Eye,
  Filter, X, Loader2, Zap, Users, Building2, CheckCircle2,
  Lightbulb, ArrowRight, Bookmark, BookmarkPlus
} from 'lucide-react';

/* ═══════════════════════════════════════
   Types
   ═══════════════════════════════════════ */

interface PlaybookStep {
  title: string;
  description: string;
  tips: string[];
  order: number;
}

interface Playbook {
  id: string;
  name: string;
  description: string | null;
  category: string;
  targetIndustry: string | null;
  targetRole: string | null;
  targetCompanySize: string | null;
  steps: PlaybookStep[];
  aiTips: string | null;
  isActive: boolean;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

const CATEGORY_CONFIG: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  introduction: { icon: MessageSquare, color: 'text-blue-600 bg-blue-50', label: 'Introduction' },
  follow_up: { icon: ArrowRight, color: 'text-emerald-600 bg-emerald-50', label: 'Follow-Up' },
  discovery: { icon: Search, color: 'text-violet-600 bg-violet-50', label: 'Discovery' },
  proposal: { icon: FileCheck, color: 'text-amber-600 bg-amber-50', label: 'Proposal' },
  negotiation: { icon: Handshake, color: 'text-orange-600 bg-orange-50', label: 'Negotiation' },
  closing: { icon: CheckCircle2, color: 'text-green-600 bg-green-50', label: 'Closing' },
  objection_handling: { icon: ShieldAlert, color: 'text-red-600 bg-red-50', label: 'Objection Handling' },
  custom: { icon: Zap, color: 'text-gray-600 bg-gray-50', label: 'Custom' },
};

/* ═══════════════════════════════════════
   Main Screen
   ═══════════════════════════════════════ */

export default function PlaybooksScreen() {
  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [selectedPlaybook, setSelectedPlaybook] = useState<Playbook | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  // Create form state
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState('introduction');
  const [newDescription, setNewDescription] = useState('');
  const [newTargetIndustry, setNewTargetIndustry] = useState('');
  const [newTargetRole, setNewTargetRole] = useState('');

  const fetchPlaybooks = useCallback(async () => {
    try {
      const res = await fetch('/api/playbooks');
      if (res.ok) {
        const data = await res.json();
        setPlaybooks(data);
      }
    } catch {
      // Silently handle — use empty state
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPlaybooks(); }, [fetchPlaybooks]);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handler = () => setMenuOpen(null);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [menuOpen]);

  const filtered = playbooks
    .filter(p => p.isActive)
    .filter(p => !activeCategory || p.category === activeCategory)
    .filter(p => !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase()) || (p.description || '').toLowerCase().includes(searchQuery.toLowerCase()));

  const handleCreatePlaybook = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch('/api/playbooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName,
          description: newDescription || null,
          category: newCategory,
          targetIndustry: newTargetIndustry || null,
          targetRole: newTargetRole || null,
        }),
      });
      if (res.ok) {
        const created = await res.json();
        setPlaybooks(prev => [created, ...prev]);
        setShowCreateForm(false);
        setNewName('');
        setNewDescription('');
        setNewTargetIndustry('');
        setNewTargetRole('');
        setSelectedPlaybook(created);
      }
    } catch {
      // Handle error silently
    } finally {
      setCreating(false);
    }
  };

  const handleAIGenerate = async () => {
    setAiGenerating(true);
    try {
      const res = await fetch('/api/playbooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName || 'AI-Generated Playbook',
          description: `AI-generated ${CATEGORY_CONFIG[newCategory]?.label || 'sales'} playbook`,
          category: newCategory,
          targetIndustry: newTargetIndustry || null,
          targetRole: newTargetRole || null,
          aiGenerate: true,
        }),
      });
      if (res.ok) {
        const created = await res.json();
        setPlaybooks(prev => [created, ...prev]);
        setShowCreateForm(false);
        setNewName('');
        setNewDescription('');
        setSelectedPlaybook(created);
      }
    } catch {
      // Handle error silently
    } finally {
      setAiGenerating(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/playbooks/${id}`, { method: 'DELETE' });
      setPlaybooks(prev => prev.filter(p => p.id !== id));
      if (selectedPlaybook?.id === id) setSelectedPlaybook(null);
    } catch {
      // Handle error silently
    }
  };

  const handleDuplicate = async (p: Playbook) => {
    try {
      const res = await fetch('/api/playbooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${p.name} (Copy)`,
          description: p.description,
          category: p.category,
          targetIndustry: p.targetIndustry,
          targetRole: p.targetRole,
          steps: p.steps,
          aiTips: p.aiTips,
        }),
      });
      if (res.ok) {
        const dup = await res.json();
        setPlaybooks(prev => [dup, ...prev]);
      }
    } catch {
      // Handle error silently
    }
  };

  const categories = [...new Set(playbooks.map(p => p.category))];

  /* ── Skeleton Loader ── */
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="h-8 w-48 rounded-lg bg-gray-200 animate-pulse" />
          <div className="h-9 w-36 rounded-lg bg-gray-200 animate-pulse" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-48 rounded-xl bg-white border border-gray-200 p-5 space-y-3">
              <div className="h-4 w-24 rounded bg-gray-200 animate-pulse" />
              <div className="h-6 w-3/4 rounded bg-gray-100 animate-pulse" />
              <div className="h-3 w-full rounded bg-gray-100 animate-pulse" />
              <div className="h-3 w-2/3 rounded bg-gray-100 animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  /* ── Selected Playbook Detail ── */
  if (selectedPlaybook) {
    const cat = CATEGORY_CONFIG[selectedPlaybook.category] || CATEGORY_CONFIG.custom;
    const CatIcon = cat.icon;
    const steps: PlaybookStep[] = Array.isArray(selectedPlaybook.steps) ? selectedPlaybook.steps : [];
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSelectedPlaybook(null)}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            style={{ color: 'var(--text-dim)' }}
          >
            <ChevronRight className="w-4 h-4 rotate-180" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5">
              <h1 className="text-lg font-semibold text-foreground tracking-tight truncate">{selectedPlaybook.name}</h1>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium ${cat.color}`}>
                <CatIcon className="w-3 h-3" />
                {cat.label}
              </span>
            </div>
            {selectedPlaybook.description && (
              <p className="text-sm mt-1" style={{ color: 'var(--text-dim)' }}>{selectedPlaybook.description}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {(selectedPlaybook.targetIndustry || selectedPlaybook.targetRole) && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-50 border border-gray-200">
                {selectedPlaybook.targetIndustry && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Building2 className="w-3 h-3" />{selectedPlaybook.targetIndustry}
                  </span>
                )}
                {selectedPlaybook.targetIndustry && selectedPlaybook.targetRole && <span className="text-gray-300">|</span>}
                {selectedPlaybook.targetRole && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Users className="w-3 h-3" />{selectedPlaybook.targetRole}
                  </span>
                )}
              </div>
            )}
            <span className="text-[11px] px-2.5 py-1 rounded-full bg-gray-100 text-muted-foreground font-medium">
              {selectedPlaybook.usageCount} uses
            </span>
          </div>
        </div>

        {/* AI Tips */}
        {selectedPlaybook.aiTips && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl bg-white border p-5"
            style={{ borderColor: 'var(--color-gold)', borderWidth: '1.5px' }}
          >
            <div className="flex items-center gap-2 mb-3">
              <Lightbulb className="w-4 h-4" style={{ color: 'var(--color-gold)' }} />
              <h3 className="text-sm font-semibold text-foreground">AI Engagement Tips</h3>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">{selectedPlaybook.aiTips}</p>
          </motion.div>
        )}

        {/* Steps */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Playbook Steps</h3>
          {steps.length > 0 ? steps.sort((a, b) => a.order - b.order).map((step, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.08 }}
              className="rounded-xl bg-white border border-gray-200 p-4 hover:shadow-sm transition-shadow"
            >
              <div className="flex items-start gap-3">
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 mt-0.5"
                  style={{ background: 'color-mix(in oklch, var(--color-gold) 12%, transparent)', color: 'var(--color-gold)' }}
                >
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold text-foreground">{step.title}</h4>
                  {step.description && <p className="text-sm mt-1 text-muted-foreground leading-relaxed">{step.description}</p>}
                  {step.tips?.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {step.tips.map((tip, j) => (
                        <span key={j} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-[11px] font-medium">
                          <Sparkles className="w-2.5 h-2.5" />{tip}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )) : (
            <div className="rounded-xl bg-white border border-gray-200 p-8 text-center">
              <BookOpen className="w-8 h-8 mx-auto mb-2 text-gray-300" />
              <p className="text-sm text-muted-foreground">No steps defined yet. Use AI to generate playbook steps.</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'color-mix(in oklch, var(--color-gold) 12%, transparent)' }}
          >
            <BookOpen className="w-4.5 h-4.5" style={{ color: 'var(--color-gold)' }} />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground tracking-tight">Sales Playbooks</h1>
            <p className="text-xs" style={{ color: 'var(--text-dim)' }}>
              {playbooks.length} playbooks across {categories.length} categories
            </p>
          </div>
        </div>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => setShowCreateForm(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white shadow-sm transition-colors"
          style={{ background: 'linear-gradient(135deg, var(--color-gold), var(--color-gold-dim))' }}
        >
          <Plus className="w-4 h-4" />
          Create Playbook
        </motion.button>
      </div>

      {/* Search + Filters */}
      <div className="flex items-center gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search playbooks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-gold)]/20 focus:border-[var(--color-gold)] transition-all"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="w-3.5 h-3.5 text-gray-400 hover:text-gray-600" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {categories.map(cat => {
            const config = CATEGORY_CONFIG[cat] || CATEGORY_CONFIG.custom;
            const Icon = config.icon;
            const isActive = activeCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(isActive ? null : cat)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-all ${
                  isActive ? 'border-[var(--color-gold)] bg-amber-50 text-amber-700' : 'border-gray-200 bg-white text-muted-foreground hover:bg-gray-50'
                }`}
              >
                <Icon className="w-3 h-3" />
                {config.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Playbook Grid */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence>
            {filtered.map((playbook, i) => {
              const cat = CATEGORY_CONFIG[playbook.category] || CATEGORY_CONFIG.custom;
              const CatIcon = cat.icon;
              const stepCount = Array.isArray(playbook.steps) ? playbook.steps.length : 0;
              return (
                <motion.div
                  key={playbook.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: i * 0.04 }}
                  className="group rounded-xl bg-white border border-gray-200 p-5 hover:shadow-md transition-all cursor-pointer relative"
                  onClick={() => setSelectedPlaybook(playbook)}
                >
                  {/* Category badge */}
                  <div className="flex items-center justify-between mb-3">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium ${cat.color}`}>
                      <CatIcon className="w-3 h-3" />
                      {cat.label}
                    </span>
                    <div className="relative" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={(e) => { e.stopPropagation(); setMenuOpen(menuOpen === playbook.id ? null : playbook.id); }}
                        className="p-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-gray-100"
                      >
                        <MoreHorizontal className="w-4 h-4 text-gray-400" />
                      </button>
                      <AnimatePresence>
                        {menuOpen === playbook.id && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="absolute right-0 top-full mt-1 w-36 rounded-lg border border-gray-200 bg-white shadow-lg z-10 py-1"
                          >
                            <button onClick={(e) => { e.stopPropagation(); handleDuplicate(playbook); setMenuOpen(null); }} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground hover:bg-gray-50">
                              <Copy className="w-3.5 h-3.5" /> Duplicate
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); handleDelete(playbook.id); setMenuOpen(null); }} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-500 hover:bg-red-50">
                              <Trash2 className="w-3.5 h-3.5" /> Delete
                            </button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>

                  {/* Title + desc */}
                  <h3 className="text-sm font-semibold text-foreground mb-1.5 group-hover:text-[var(--color-gold)] transition-colors line-clamp-2">
                    {playbook.name}
                  </h3>
                  <p className="text-xs text-muted-foreground line-clamp-2 mb-4 leading-relaxed">
                    {playbook.description || 'No description provided'}
                  </p>

                  {/* Footer */}
                  <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Play className="w-3 h-3" /> {stepCount} steps
                      </span>
                      <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        <TrendingUp className="w-3 h-3" /> {playbook.usageCount}
                      </span>
                    </div>
                    {playbook.aiTips && (
                      <span className="flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full" style={{ background: 'color-mix(in oklch, var(--color-gold) 10%, transparent)', color: 'var(--color-gold)' }}>
                        <Sparkles className="w-2.5 h-2.5" /> AI
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
          <BookOpen className="w-12 h-12 mx-auto mb-4 text-gray-200" />
          <h3 className="text-sm font-semibold text-foreground mb-1">
            {searchQuery || activeCategory ? 'No matching playbooks' : 'No playbooks yet'}
          </h3>
          <p className="text-xs text-muted-foreground mb-4 max-w-sm mx-auto">
            {searchQuery || activeCategory
              ? 'Try adjusting your search or filters'
              : 'Create your first sales playbook to standardize your team\'s outreach strategies across different scenarios and industries.'}
          </p>
          {!searchQuery && !activeCategory && (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => setShowCreateForm(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium text-white"
              style={{ background: 'linear-gradient(135deg, var(--color-gold), var(--color-gold-dim))' }}
            >
              <Plus className="w-3.5 h-3.5" /> Create First Playbook
            </motion.button>
          )}
        </div>
      )}

      {/* Create Playbook Modal */}
      <AnimatePresence>
        {showCreateForm && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
              onClick={() => setShowCreateForm(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
            >
              <div className="w-full max-w-lg rounded-2xl bg-white border border-gray-200 shadow-xl overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'color-mix(in oklch, var(--color-gold) 12%, transparent)' }}>
                      <Plus className="w-4 h-4" style={{ color: 'var(--color-gold)' }} />
                    </div>
                    <h2 className="text-sm font-semibold text-foreground">Create Playbook</h2>
                  </div>
                  <button onClick={() => setShowCreateForm(false)} className="p-1.5 rounded-lg hover:bg-gray-100">
                    <X className="w-4 h-4 text-gray-400" />
                  </button>
                </div>
                <div className="px-6 py-4 space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1.5">Playbook Name</label>
                    <input
                      type="text"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="e.g., Enterprise SaaS Introduction"
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-gold)]/20 focus:border-[var(--color-gold)]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1.5">Description</label>
                    <textarea
                      value={newDescription}
                      onChange={(e) => setNewDescription(e.target.value)}
                      placeholder="What is this playbook designed to achieve?"
                      rows={2}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-gold)]/20 focus:border-[var(--color-gold)] resize-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1.5">Category</label>
                    <div className="grid grid-cols-4 gap-2">
                      {Object.entries(CATEGORY_CONFIG).map(([key, config]) => {
                        const Icon = config.icon;
                        return (
                          <button
                            key={key}
                            onClick={() => setNewCategory(key)}
                            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-medium border transition-all ${
                              newCategory === key
                                ? 'border-[var(--color-gold)] bg-amber-50 text-amber-700'
                                : 'border-gray-200 bg-white text-muted-foreground hover:bg-gray-50'
                            }`}
                          >
                            <Icon className="w-3 h-3" />
                            {config.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-foreground mb-1.5">Target Industry</label>
                      <input
                        type="text"
                        value={newTargetIndustry}
                        onChange={(e) => setNewTargetIndustry(e.target.value)}
                        placeholder="e.g., FinTech, Healthcare"
                        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-gold)]/20 focus:border-[var(--color-gold)]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-foreground mb-1.5">Target Role</label>
                      <input
                        type="text"
                        value={newTargetRole}
                        onChange={(e) => setNewTargetRole(e.target.value)}
                        placeholder="e.g., CTO, VP Sales"
                        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-gold)]/20 focus:border-[var(--color-gold)]"
                      />
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50/50">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={handleAIGenerate}
                    disabled={aiGenerating || !newCategory}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium border border-gray-200 bg-white text-muted-foreground hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    {aiGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                    {aiGenerating ? 'Generating with AI...' : 'Generate with AI'}
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={handleCreatePlaybook}
                    disabled={creating || !newName.trim()}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium text-white disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ background: 'linear-gradient(135deg, var(--color-gold), var(--color-gold-dim))' }}
                  >
                    {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                    Create Playbook
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