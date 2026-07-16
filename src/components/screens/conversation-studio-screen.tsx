'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Sparkles, Brain, Mail, Plus, Target, Shield, ArrowRight, Lightbulb,
  MessageSquare, Loader2, ExternalLink, X, ChevronRight, Zap, Users, Trash2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { PageTransition, StaggerGrid, StaggerItem, EmptyState } from '@/components/ui/animated-components';

/* ── Types ── */
interface ApiPlan {
  executiveProfile: { likelyPriorities: string[]; communicationStyle: string; decisionMakingStyle: string };
  conversationPlan: {
    suggestedOpening: string; keyTopics: string[]; topicsToAvoid: string[];
    valueProposition: string; questionsToAsk: string[]; successSignals: string[]; nextSteps: string;
  };
  approachRecommendation: { method: string; reasoning: string; confidence: number; timing: string };
  aiReasoning: string;
}

interface GeneratedPlan {
  id: string;
  companyName: string;
  executiveRole: string;
  executiveName: string;
  industry: string;
  plan: ApiPlan;
  generatedAt: string;
}

interface Source { title?: string; url?: string; snippet?: string }

const ROLES = ['CIO', 'CTO', 'COO', 'CEO', 'VP Digital', 'VP Engineering', 'CDO', 'CFO', 'Director IT'];

const APPROACH_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  Direct:              { bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200' },
  'Warm Introduction': { bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200' },
  'Event-based':       { bg: 'bg-purple-50',  text: 'text-purple-700',  border: 'border-purple-200' },
  Referral:            { bg: 'bg-emerald-50',  text: 'text-emerald-700',  border: 'border-emerald-200' },
  'Content-led':       { bg: 'bg-rose-50',    text: 'text-rose-700',    border: 'border-rose-200' },
};

/* ── Component ── */
export default function ConversationStudioScreen({ navigateTo }: { navigateTo?: (screen: string) => void }) {
  const [plans, setPlans] = useState<GeneratedPlan[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [genPhase, setGenPhase] = useState(0);
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const GEN_PHASES = [
    'Researching executive profile...',
    'Analyzing conversation patterns...',
    'Crafting engagement strategy...',
    'Finalizing approach recommendation...',
  ];

  // Fetch saved plans on mount
  useEffect(() => {
    fetch('/api/conversation-plans')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          setPlans(data.map((p: any) => ({
            id: p.id,
            companyName: p.companyName,
            executiveRole: p.executiveRole,
            executiveName: p.executiveName || '',
            industry: p.industry || '',
            plan: p.plan,
            generatedAt: p.generatedAt || p.createdAt,
          })));
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (loading) {
      setGenPhase(0);
      const phaseInterval = setInterval(() => {
        setGenPhase((p) => (p + 1) % GEN_PHASES.length);
      }, 1500);
      progressRef.current = phaseInterval;
      return () => clearInterval(phaseInterval);
    } else {
      setGenPhase(0);
    }
  }, [loading]);

  // Form state
  const [form, setForm] = useState({ companyName: '', executiveRole: '', executiveName: '', industry: '', context: '', yourCapabilities: '' });

  const updateForm = useCallback((k: string, v: string) => setForm((p) => ({ ...p, [k]: v })), []);

  const selected = plans.find((p) => p.id === selectedId) ?? null;

  /* ── Generate Plan ── */
  const handleGenerate = async () => {
    if (!form.companyName.trim() || !form.executiveRole) {
      toast.error('Please fill in company name and executive role');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/ai/conversation-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: form.companyName,
          executiveRole: form.executiveRole,
          executiveName: form.executiveName || undefined,
          industry: form.industry || undefined,
          context: form.context || undefined,
          yourCapabilities: form.yourCapabilities || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Generation failed');

      const newPlan: GeneratedPlan = {
        id: `cp-${Date.now()}`,
        companyName: form.companyName,
        executiveRole: form.executiveRole,
        executiveName: form.executiveName,
        industry: form.industry,
        plan: data.data.plan,
        generatedAt: data.data.generatedAt,
      };
      setPlans((p) => [newPlan, ...p]);
      setSelectedId(newPlan.id);
      setShowForm(false);
      setForm({ companyName: '', executiveRole: '', executiveName: '', industry: '', context: '', yourCapabilities: '' });
      toast.success('Conversation plan generated!');

      // Persist to DB and update ID
      fetch('/api/conversation-plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: form.companyName,
          executiveRole: form.executiveRole,
          executiveName: form.executiveName || undefined,
          industry: form.industry || undefined,
          context: form.context || undefined,
          capabilities: form.yourCapabilities || undefined,
          plan: data.data.plan,
        }),
      }).then(r => r.json()).then(saved => {
        if (saved?.id) {
          setPlans(prev => prev.map(p => p.id === newPlan.id ? { ...p, id: saved.id } : p));
          if (selectedId === newPlan.id) setSelectedId(saved.id);
        }
      }).catch(() => {});
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to generate plan');
    } finally {
      setLoading(false);
    }
  };

  /* ── Helpers ── */
  const getInitials = (name: string, role: string) => {
    if (name) return name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
    return role.slice(0, 2).toUpperCase();
  };

  const approachColor = (method: string) => APPROACH_COLORS[method] || { bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-200' };

  const handleDeletePlan = async (planId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setPlans(prev => prev.filter(p => p.id !== planId));
    if (selectedId === planId) setSelectedId(null);
    try {
      await fetch(`/api/conversation-plans/${planId}`, { method: 'DELETE' });
    } catch { /* already removed from local state */ }
  };

  return (
    <PageTransition className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Conversation Studio</h1>
          <p className="text-sm text-muted-foreground mt-0.5">AI-powered executive engagement preparation</p>
        </div>
        <Button
          onClick={() => setShowForm((s) => !s)}
          className="gap-2 font-semibold text-sm shadow-sm"
          style={{ background: '#D4AF37', color: '#fff', border: 'none' }}
        >
          {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showForm ? 'Cancel' : 'New Conversation Plan'}
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="px-6 py-6 space-y-6">
          {/* ── Generation Form ── */}
          <AnimatePresence>
            {showForm && (
              <motion.div
                key="form"
                initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                animate={{ opacity: 1, height: 'auto', marginBottom: 24 }}
                exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                className="overflow-hidden"
              >
                <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
                  <div className="flex items-center gap-2 mb-5">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(212,175,55,0.12)' }}>
                      <Sparkles className="w-4 h-4" style={{ color: '#D4AF37' }} />
                    </div>
                    <h2 className="text-sm font-semibold text-foreground">Generate Conversation Plan</h2>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-medium">Company Name *</Label>
                      <Input placeholder="e.g. ABC Manufacturing" value={form.companyName} onChange={(e) => updateForm('companyName', e.target.value)} className="h-9 text-sm" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-medium">Executive Role *</Label>
                      <Select value={form.executiveRole} onValueChange={(v) => updateForm('executiveRole', v)}>
                        <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select role" /></SelectTrigger>
                        <SelectContent>{ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-medium">Executive Name</Label>
                      <Input placeholder="e.g. John Smith" value={form.executiveName} onChange={(e) => updateForm('executiveName', e.target.value)} className="h-9 text-sm" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-medium">Industry</Label>
                      <Input placeholder="e.g. Manufacturing" value={form.industry} onChange={(e) => updateForm('industry', e.target.value)} className="h-9 text-sm" />
                    </div>
                    <div className="md:col-span-2 space-y-2">
                      <Label className="text-xs font-medium">Additional Context</Label>
                      <Textarea placeholder="Recent news, mutual connections, specific pain points..." value={form.context} onChange={(e) => updateForm('context', e.target.value)} className="text-sm min-h-[72px] resize-none" />
                    </div>
                    <div className="md:col-span-2 space-y-2">
                      <Label className="text-xs font-medium">Your Capabilities</Label>
                      <Input placeholder="e.g. AI Automation, Data Analytics" value={form.yourCapabilities} onChange={(e) => updateForm('yourCapabilities', e.target.value)} className="h-9 text-sm" />
                    </div>
                  </div>

                  {/* Loading Overlay */}
                  <AnimatePresence>
                    {loading && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.3 }}
                        className="mt-5 p-6 rounded-xl border text-center"
                        style={{ background: 'rgba(212,175,55,0.03)', borderColor: 'rgba(212,175,55,0.15)' }}
                      >
                        <motion.div
                          animate={{ scale: [1, 1.15, 1] }}
                          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                          className="inline-flex items-center justify-center w-12 h-12 rounded-full mb-4"
                          style={{ background: 'rgba(212,175,55,0.12)' }}
                        >
                          <Brain className="w-6 h-6" style={{ color: '#D4AF37' }} />
                        </motion.div>
                        <p className="text-sm font-semibold text-foreground mb-2">Generating Plan</p>
                        <motion.p
                          key={genPhase}
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          transition={{ duration: 0.3 }}
                          className="text-xs text-muted-foreground mb-4"
                        >
                          {GEN_PHASES[genPhase]}
                        </motion.p>
                        <div className="w-full h-1.5 rounded-full bg-gray-100 overflow-hidden">
                          <motion.div
                            className="h-full rounded-full"
                            style={{ background: 'linear-gradient(90deg, #D4AF37, #E8C84A, #D4AF37)', backgroundSize: '200% 100%' }}
                            initial={{ width: '0%' }}
                            animate={{ width: '100%', backgroundPosition: ['0% 0%', '100% 0%', '0% 0%'] }}
                            transition={{ width: { duration: 6, ease: 'linear' }, backgroundPosition: { duration: 2, repeat: Infinity, ease: 'linear' } }}
                          />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="flex justify-end mt-5">
                    <Button onClick={handleGenerate} disabled={loading} className="gap-2 font-semibold text-sm shadow-sm" style={{ background: '#D4AF37', color: '#fff', border: 'none' }}>
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                      {loading ? 'Generating...' : 'Generate Plan'}
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Content ── */}
          {plans.length === 0 && !showForm ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4 }}
              className="flex flex-col items-center justify-center py-16 text-center"
            >
              <motion.div
                animate={{ scale: [1, 1.08, 1] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
                style={{ background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.2)' }}
              >
                <Brain className="w-7 h-7" style={{ color: '#D4AF37' }} />
              </motion.div>
              <p className="text-sm font-medium text-foreground mb-1">Generate your first conversation plan</p>
              <p className="text-xs text-muted-foreground max-w-sm">
                Enter executive and company details to get an AI-powered engagement strategy. The engine researches the executive's background, communication style, and likely priorities to craft personalized outreach plans.
              </p>
              <p className="text-[11px] text-muted-foreground/70 max-w-sm mt-1.5">
                Plans include opening lines, key topics, approach recommendations, and conversation starters.
              </p>
              <div className="mt-4">
                <Button onClick={() => setShowForm(true)} className="gap-2 text-sm font-semibold shadow-sm" style={{ background: '#D4AF37', color: '#fff', border: 'none' }}>
                  <Plus className="w-4 h-4" /> Create Plan
                </Button>
              </div>
            </motion.div>
          ) : (
            <div className="flex gap-6 items-start">
              {/* Plan Cards */}
              <div className="flex-1 min-w-0 space-y-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4" style={{ color: '#D4AF37' }} />
                  <h2 className="text-sm font-semibold text-foreground">AI-Generated Conversation Plans</h2>
                  {plans.length > 0 && <Badge variant="secondary" className="ml-1 text-xs font-medium">{plans.length} generated</Badge>}
                </div>

                <StaggerGrid className="space-y-4" stagger={0.08}>
                  {plans.map((p) => {
                    const ac = approachColor(p.plan.approachRecommendation.method);
                    const ep = p.plan.executiveProfile;
                    const cp = p.plan.conversationPlan;
                    return (
                      <StaggerItem key={p.id}>
                        <motion.div
                          whileHover={{ y: -2 }}
                          transition={{ duration: 0.2 }}
                          className={`bg-white border rounded-xl shadow-sm p-5 cursor-pointer transition-shadow duration-200 hover:shadow-md ${
                            selectedId === p.id ? 'ring-2 ring-[#D4AF37]/40 border-[#D4AF37]/30' : 'border-gray-200'
                          }`}
                          onClick={() => setSelectedId(selectedId === p.id ? null : p.id)}
                        >
                          {/* Header */}
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0" style={{ background: 'linear-gradient(135deg, #D4AF37, #9A8340)' }}>
                                {getInitials(p.executiveName, p.executiveRole)}
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-foreground truncate">{p.executiveName || p.executiveRole}</p>
                                <p className="text-xs text-muted-foreground">{p.executiveRole}{p.executiveName ? '' : ''}</p>
                                <p className="text-xs text-muted-foreground/70 mt-0.5">{p.companyName}{p.industry ? ` · ${p.industry}` : ''}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0 ml-3">
                              <Badge className={`text-[11px] font-medium ${ac.bg} ${ac.text} border ${ac.border}`}>{p.plan.approachRecommendation.method}</Badge>
                              <span className="text-[11px] font-semibold tabular-nums" style={{ color: p.plan.approachRecommendation.confidence >= 80 ? '#10b981' : '#D4AF37' }}>
                                {p.plan.approachRecommendation.confidence}%
                              </span>
                              <button
                                onClick={(e) => handleDeletePlan(p.id, e)}
                                className="p-1 rounded-md hover:bg-red-50 text-muted-foreground hover:text-red-500 transition-colors"
                                title="Delete plan"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-muted-foreground">
                              Generated {new Date(p.generatedAt).toLocaleString()}
                            </span>
                          </div>

                          {/* Likely Priorities */}
                          <div className="mb-3">
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Likely Priorities</p>
                            <ul className="space-y-1">
                              {ep.likelyPriorities.map((item, i) => (
                                <li key={i} className="flex items-start gap-2 text-xs text-foreground/80">
                                  <Target className="w-3 h-3 mt-0.5 shrink-0" style={{ color: '#D4AF37' }} />
                                  <span>{item}</span>
                                </li>
                              ))}
                            </ul>
                          </div>

                          {/* Opening & Value Prop */}
                          <div className="mb-3">
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Suggested Opening</p>
                            <p className="text-xs text-foreground/80 leading-relaxed italic bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">
                              &ldquo;{cp.suggestedOpening}&rdquo;
                            </p>
                          </div>

                          {/* Value Proposition */}
                          {cp.valueProposition && (
                            <div className="mt-2 p-2.5 rounded-lg border" style={{ background: 'rgba(212,175,55,0.04)', borderColor: 'rgba(212,175,55,0.2)' }}>
                              <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: '#D4AF37' }}>Value Proposition</p>
                              <p className="text-xs text-gray-700 leading-relaxed">{cp.valueProposition}</p>
                            </div>
                          )}

                          {/* Topics to Avoid */}
                          {cp.topicsToAvoid.length > 0 && (
                            <div className="mb-4">
                              <p className="text-[11px] font-semibold uppercase tracking-wider text-red-500/70 mb-1">Topics to Avoid</p>
                              <div className="flex flex-wrap gap-1.5">
                                {cp.topicsToAvoid.map((t, i) => (
                                  <span key={i} className="text-[11px] bg-red-50 text-red-600 border border-red-100 rounded-md px-2 py-0.5 flex items-center gap-1">
                                    <Shield className="w-3 h-3" /> {t}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Actions */}
                          <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                            <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5 font-medium"
                              onClick={(e) => { e.stopPropagation(); setSelectedId(p.id); }}>
                              <Brain className="w-3 h-3" /> View Reasoning
                            </Button>
                            <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5 font-medium"
                              onClick={(e) => { e.stopPropagation(); navigateTo?.('email-generation'); }}>
                              <Mail className="w-3 h-3" /> Generate Email
                            </Button>
                            <div className="ml-auto">
                              <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${selectedId === p.id ? 'rotate-90' : ''}`} />
                            </div>
                          </div>
                        </motion.div>
                      </StaggerItem>
                    );
                  })}
                </StaggerGrid>
              </div>

              {/* ── AI Reasoning Panel ── */}
              <div className="hidden xl:block w-[400px] shrink-0">
                <AnimatePresence mode="wait">
                  {selected ? (
                    <motion.div
                      key={selected.id}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                      className="bg-white border border-gray-200 rounded-xl shadow-sm sticky top-6 overflow-hidden"
                    >
                      {/* Panel Header */}
                      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between" style={{ background: 'linear-gradient(135deg, rgba(212,175,55,0.06), rgba(212,175,55,0.02))' }}>
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(212,175,55,0.12)' }}>
                            <Brain className="w-4 h-4" style={{ color: '#D4AF37' }} />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-foreground">AI Reasoning</p>
                            <p className="text-[11px] text-muted-foreground">{selected.companyName}</p>
                          </div>
                        </div>
                        <button onClick={() => setSelectedId(null)} className="p-1 rounded-md hover:bg-gray-100 transition-colors">
                          <X className="w-4 h-4 text-muted-foreground" />
                        </button>
                      </div>

                      <div className="p-5 space-y-5 max-h-[calc(100vh-220px)] overflow-y-auto">
                        {/* Confidence */}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Confidence</span>
                            <span className="text-lg font-bold tabular-nums" style={{ color: selected.plan.approachRecommendation.confidence >= 80 ? '#10b981' : '#D4AF37' }}>
                              {selected.plan.approachRecommendation.confidence}%
                            </span>
                          </div>
                          <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                            <motion.div
                              className="h-full rounded-full"
                              style={{ background: selected.plan.approachRecommendation.confidence >= 80 ? 'linear-gradient(90deg, #10b981, #34d399)' : 'linear-gradient(90deg, #D4AF37, #E8C860)' }}
                              initial={{ width: 0 }}
                              animate={{ width: `${selected.plan.approachRecommendation.confidence}%` }}
                              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                            />
                          </div>
                        </div>

                        <Separator />

                        {/* Executive Profile */}
                        <div>
                          <div className="flex items-center gap-1.5 mb-2">
                            <Users className="w-3.5 h-3.5" style={{ color: '#D4AF37' }} />
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Executive Profile</p>
                          </div>
                          <div className="space-y-2 text-xs text-foreground/80">
                            <div className="flex gap-2"><span className="font-medium text-muted-foreground shrink-0 w-36">Communication:</span><span>{selected.plan.executiveProfile.communicationStyle}</span></div>
                            <div className="flex gap-2"><span className="font-medium text-muted-foreground shrink-0 w-36">Decision Style:</span><span>{selected.plan.executiveProfile.decisionMakingStyle}</span></div>
                          </div>
                        </div>

                        <Separator />

                        {/* Approach Recommendation */}
                        <div>
                          <div className="flex items-center gap-1.5 mb-2">
                            <Zap className="w-3.5 h-3.5" style={{ color: '#D4AF37' }} />
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Recommended Approach</p>
                          </div>
                          <div className="space-y-2 text-xs text-foreground/80">
                            <div className="flex gap-2"><span className="font-medium text-muted-foreground shrink-0 w-36">Method:</span><span>{selected.plan.approachRecommendation.method}</span></div>
                            <div className="flex gap-2"><span className="font-medium text-muted-foreground shrink-0 w-36">Timing:</span><span>{selected.plan.approachRecommendation.timing}</span></div>
                            <p className="leading-relaxed mt-1">{selected.plan.approachRecommendation.reasoning}</p>
                          </div>
                        </div>

                        <Separator />

                        {/* Key Topics */}
                        <div>
                          <div className="flex items-center gap-1.5 mb-2">
                            <Target className="w-3.5 h-3.5" style={{ color: '#D4AF37' }} />
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Key Topics</p>
                          </div>
                          <ul className="space-y-1.5">
                            {selected.plan.conversationPlan.keyTopics.map((t, i) => (
                              <motion.li key={i} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 + i * 0.06 }}
                                className="flex items-start gap-2 text-xs text-foreground/80">
                                <ArrowRight className="w-3 h-3 mt-0.5 shrink-0" style={{ color: '#D4AF37' }} />
                                <span>{t}</span>
                              </motion.li>
                            ))}
                          </ul>
                        </div>

                        <Separator />

                        {/* Questions to Ask */}
                        <div>
                          <div className="flex items-center gap-1.5 mb-2">
                            <MessageSquare className="w-3.5 h-3.5" style={{ color: '#D4AF37' }} />
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Questions to Ask</p>
                          </div>
                          <ul className="space-y-1.5">
                            {selected.plan.conversationPlan.questionsToAsk.map((q, i) => (
                              <li key={i} className="text-xs text-foreground/80 flex items-start gap-2">
                                <span className="text-[10px] font-bold mt-0.5 shrink-0" style={{ color: '#D4AF37' }}>Q{i + 1}</span>
                                <span>{q}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        <Separator />

                        {/* AI Reasoning */}
                        <div>
                          <div className="flex items-center gap-1.5 mb-2">
                            <Lightbulb className="w-3.5 h-3.5" style={{ color: '#D4AF37' }} />
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">AI Reasoning</p>
                          </div>
                          <p className="text-xs text-foreground/80 leading-relaxed">{selected.plan.aiReasoning}</p>
                        </div>

                        {/* Next Steps */}
                        {selected.plan.conversationPlan.nextSteps && (
                          <>
                            <Separator />
                            <div>
                              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Next Steps</p>
                              <p className="text-xs text-foreground/80 leading-relaxed">{selected.plan.conversationPlan.nextSteps}</p>
                            </div>
                          </>
                        )}

                        {/* Success Signals */}
                        {selected.plan.conversationPlan.successSignals.length > 0 && (
                          <>
                            <Separator />
                            <div>
                              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Success Signals</p>
                              <div className="flex flex-wrap gap-1.5">
                                {selected.plan.conversationPlan.successSignals.map((s, i) => (
                                  <span key={i} className="text-[11px] bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-md px-2 py-0.5">{s}</span>
                                ))}
                              </div>
                            </div>
                          </>
                        )}

                        {/* CTA */}
                        <Button
                          className="w-full gap-2 text-sm font-semibold shadow-sm mt-2"
                          style={{ background: '#D4AF37', color: '#fff', border: 'none' }}
                          onClick={() => navigateTo?.('email-generation')}
                        >
                          <Mail className="w-4 h-4" /> Generate Outreach Email
                        </Button>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div key="empty-panel" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="bg-white border border-gray-200 rounded-xl shadow-sm p-8 text-center sticky top-6">
                      <div className="w-12 h-12 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center mx-auto mb-4">
                        <Brain className="w-6 h-6 text-gray-300" />
                      </div>
                      <p className="text-sm font-medium text-foreground mb-1">AI Reasoning Panel</p>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Select a conversation plan to see the AI&apos;s reasoning, confidence score, executive profile, and approach recommendations.
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </PageTransition>
  );
}