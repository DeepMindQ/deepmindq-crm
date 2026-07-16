'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PageTransition, AnimatedCard, StaggerGrid, StaggerItem, SectionHeader,
  TabBar, GradientCard, StatCard, AnimatedBar, PulseDot, GlassPanel,
  EmptyState, ShimmerText, AnimatedCounter,
} from '@/components/ui/animated-components';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import {
  Layers, BookOpen, Trophy, MessageSquare, Target, Tag, Eye,
  Plus, Upload, Search, Pencil, Trash2, X, FileText,
  Brain, Cpu, Database, CheckCircle2, ArrowUpRight, AlertTriangle, Sparkles,
  Loader2, Zap, Workflow, ChevronDown, ChevronUp, Mail, Lightbulb,
  Hash, Filter, Download, Globe, Link2, GitBranch, Check, Ban,
} from 'lucide-react';

/* -- Types -- */
interface Capability {
  id: string;
  title: string;
  summary: string;
  category: string;
  serviceLine?: string | null;
  targetIndustries?: string | null;
  targetRoles?: string | null;
  problems?: string | null;
  evidence?: string | null;
  content?: string | null;
  isActive: boolean;
  version?: number;
  tags?: string[];
  targetCompanySizes?: string | null;
  upvotes?: number;
  downvotes?: number;
  usedInEmails?: number;
  parentAssetId?: string | null;
}

interface CapabilityScreenProps {
  navigateTo?: (screen: string) => void;
}

/* -- Constants -- */
const TABS = [
  { value: 'all', label: 'All' },
  { value: 'service_line', label: 'Service Lines' },
  { value: 'case_study', label: 'Case Studies' },
  { value: 'proof_point', label: 'Proof Points' },
  { value: 'objection_response', label: 'Objections' },
  { value: 'cta', label: 'CTAs' },
];

const CAT_ICON: Record<string, typeof Tag> = {
  service_line: Layers, case_study: BookOpen, proof_point: Trophy,
  objection_response: MessageSquare, cta: Target,
};
const CAT_BADGE: Record<string, string> = {
  service_line: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  case_study: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  proof_point: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  objection_response: 'bg-red-500/20 text-red-300 border-red-500/30',
  cta: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
};
const CAT_LABEL: Record<string, string> = {
  service_line: 'Service Line', case_study: 'Case Study', proof_point: 'Proof Point',
  objection_response: 'Objection Response', cta: 'CTA',
};
const CAT_GRADIENT: Record<string, { from: string; to: string; glow: string }> = {
  service_line: { from: 'rgba(59, 130, 246, 0.3)', to: 'rgba(59, 130, 246, 0.05)', glow: 'rgba(59, 130, 246, 0.12)' },
  case_study: { from: 'rgba(16, 185, 129, 0.3)', to: 'rgba(16, 185, 129, 0.05)', glow: 'rgba(16, 185, 129, 0.12)' },
  proof_point: { from: 'rgba(139, 92, 246, 0.3)', to: 'rgba(139, 92, 246, 0.05)', glow: 'rgba(139, 92, 246, 0.12)' },
  objection_response: { from: 'rgba(239, 68, 68, 0.3)', to: 'rgba(239, 68, 68, 0.05)', glow: 'rgba(239, 68, 68, 0.12)' },
  cta: { from: 'rgba(245, 158, 11, 0.3)', to: 'rgba(245, 158, 11, 0.05)', glow: 'rgba(245, 158, 11, 0.12)' },
};

const EMPTY_FORM = {
  title: '',
  summary: '',
  category: 'service_line',
  serviceLine: '',
  targetIndustries: '',
  targetRoles: '',
  problems: '',
  evidence: '',
  content: '',
  isActive: true,
  tags: [] as string[],
  targetCompanySizes: '',
  parentAssetId: '' as string,
};

/* ========
   Tag Input Component (C-15)
   ======== */
function TagInput({ tags, onChange, allTags }: { tags: string[]; onChange: (tags: string[]) => void; allTags: string[] }) {
  const [input, setInput] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const suggestions = useMemo(() => {
    if (!input.trim()) return [];
    const lower = input.trim().toLowerCase();
    return allTags
      .filter(t => t.includes(lower) && !tags.includes(t))
      .slice(0, 8);
  }, [input, allTags, tags]);

  const addTag = (tag: string) => {
    const cleaned = tag.trim().toLowerCase();
    if (cleaned && !tags.includes(cleaned)) {
      onChange([...tags, cleaned]);
    }
    setInput('');
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  const removeTag = (tag: string) => {
    onChange(tags.filter(t => t !== tag));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (input.trim()) addTag(input.trim());
      else if (suggestions.length > 0) addTag(suggestions[0]);
    }
    if (e.key === 'Backspace' && input === '' && tags.length > 0) {
      removeTag(tags[tags.length - 1]);
    }
    if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  return (
    <div className="space-y-1.5" ref={containerRef}>
      <Label className="text-sm">Tags</Label>
      <div className="flex flex-wrap items-center gap-1.5 p-2 rounded-lg bg-black/[0.03] border border-gray-200 focus-within:border-primary/40 min-h-[40px]">
        {tags.map(tag => (
          <Badge key={tag} variant="outline" className="text-[10px] gap-1 border-primary/30 text-primary bg-primary/5 px-2 py-0.5">
            {tag}
            <button type="button" onClick={() => removeTag(tag)} className="hover:text-primary-foreground transition-colors">
              <X className="w-2.5 h-2.5" />
            </button>
          </Badge>
        ))}
        <div className="relative flex-1 min-w-[100px]">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => { setInput(e.target.value); setShowSuggestions(true); }}
            onFocus={() => setShowSuggestions(true)}
            onKeyDown={handleKeyDown}
            placeholder={tags.length === 0 ? 'Type tag and press Enter...' : 'Add more...'}
            className="h-7 text-xs bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground/50 w-full"
          />
          {/* Autocomplete suggestions */}
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute top-full left-0 mt-1 w-full min-w-[180px] rounded-lg border border-gray-200 bg-card shadow-xl z-50 max-h-40 overflow-y-auto">
              {suggestions.map(s => (
                <button
                  key={s}
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); addTag(s); }}
                  className="w-full text-left px-3 py-1.5 text-xs text-foreground hover:bg-primary/10 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <p className="text-[10px] text-muted-foreground">Press Enter or select a suggestion to add tags</p>
    </div>
  );
}

/* ========
   Glass Dialog Shell
   ======== */
function GlassDialog({ children, onClose, title, subtitle, actions }: {
  children: React.ReactNode;
  onClose: () => void;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/25 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* Panel */}
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.98 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-white/[0.1] bg-black/[0.04] backdrop-blur-2xl shadow-2xl shadow-black/40"
        onClick={e => e.stopPropagation()}
      >
        {/* Top glow line */}
        <div
          className="absolute top-0 left-8 right-8 h-px"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(212, 175, 55, 0.4), transparent)' }}
        />
        <div className="p-6 sm:p-8">
          {/* Header */}
          <div className="flex items-start justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-foreground tracking-tight">{title}</h2>
              {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-black/[0.06] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          {children}
          {actions && <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-gray-200">{actions}</div>}
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ========
   Knowledge Engine (RAG) Panel
   ======== */
function KnowledgeEnginePanel({ items, navigateTo }: { items: Capability[]; navigateTo?: (s: string) => void }) {
  const [activeTab, setActiveTab] = useState<'search' | 'coverage' | 'flow'>('search');

  // RAG Search Test state
  const [ragQuery, setRagQuery] = useState('');
  const [ragIndustry, setRagIndustry] = useState('');
  const [ragRole, setRagRole] = useState('');
  const [ragMode, setRagMode] = useState('hybrid');
  const [ragLoading, setRagLoading] = useState(false);
  const [ragResults, setRagResults] = useState<any[] | null>(null);
  const [ragInsight, setRagInsight] = useState<any>(null);

  // Coverage state
  const [coverage, setCoverage] = useState<any>(null);
  const [coverageLoading, setCoverageLoading] = useState(false);
  const coverageLoaded = useRef(false);

  // Auto-load coverage on first view
  useEffect(() => {
    if (activeTab !== 'coverage' || coverageLoaded.current) return;
    coverageLoaded.current = true;
    let cancelled = false;
    (async () => {
      setCoverageLoading(true);
      try {
        const res = await fetch('/api/knowledge/engine', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'coverage' }),
        });
        const data = await res.json();
        if (!cancelled) setCoverage(data);
      } catch { /* ignore */ }
      if (!cancelled) setCoverageLoading(false);
    })();
    return () => { cancelled = true; };
  }, [activeTab]);

  const runRagSearch = async () => {
    if (!ragQuery.trim()) return;
    setRagLoading(true);
    setRagResults(null);
    try {
      const res = await fetch('/api/knowledge/engine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'test',
          query: ragQuery,
          industry: ragIndustry || undefined,
          role: ragRole || undefined,
          searchMode: ragMode,
        }),
      });
      const data = await res.json();
      setRagResults(data.results || []);
      setRagInsight(data.engineInsight || null);
    } catch { setRagResults([]); }
    setRagLoading(false);
  };

  const slCount = new Set(items.filter(i => i.category === 'service_line').map(i => i.serviceLine).filter(Boolean)).size;
  const csCount = items.filter(i => i.category === 'case_study').length;
  const ppCount = items.filter(i => i.category === 'proof_point').length;

  const ENGINE_TABS = [
    { key: 'search', label: 'RAG Search Test' },
    { key: 'coverage', label: 'Coverage Gaps' },
    { key: 'flow', label: 'Email Flow' },
  ];

  return (
    <GlassPanel className="p-0 overflow-hidden">
      {/* Header */}
      <div className="px-6 pt-6 pb-4">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center shadow-lg"
              style={{ background: 'linear-gradient(135deg, rgba(212,175,55,0.3), rgba(212,175,55,0.08))', boxShadow: '0 0 20px rgba(212,175,55,0.15)' }}
            >
              <Brain className="w-5 h-5" style={{ color: '#D4AF37' }} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-base font-bold text-foreground">Knowledge Engine</p>
                <Badge variant="outline" className="text-[9px] border-emerald-500/30 text-emerald-600 bg-emerald-500/5 gap-1 px-1.5">
                  <PulseDot color="#10B981" />
                  Active
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">Retrieval-Augmented Generation powers every personalized email</p>
            </div>
          </div>
          {navigateTo && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-[10px] gap-1.5 border-primary/30 text-primary hover:bg-primary/10"
              onClick={() => navigateTo('knowledge')}
            >
              <Database className="w-3 h-3" />
              Knowledge Library
              <ArrowUpRight className="w-3 h-3" />
            </Button>
          )}
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { icon: Database, label: 'Total Assets', value: items.length, color: '#D4AF37' },
            { icon: Layers, label: 'Service Lines', value: slCount, color: '#3B82F6' },
            { icon: BookOpen, label: 'Case Studies', value: csCount, color: '#10B981' },
            { icon: Trophy, label: 'Proof Points', value: ppCount, color: '#8B5CF6' },
            { icon: Cpu, label: 'Search Modes', value: 3, color: '#F59E0B', isText: true, text: 'K / S / H' },
          ].map((s, idx) => (
            <div key={idx} className="p-3 rounded-lg bg-white/[0.02] border border-gray-200">
              <div className="flex items-center gap-1.5 mb-1">
                <s.icon className="w-3 h-3" style={{ color: s.color }} />
                <span className="text-[10px] text-muted-foreground">{s.label}</span>
              </div>
              {s.isText ? (
                <p className="text-sm font-bold text-foreground">{s.text}</p>
              ) : (
                <p className="text-lg font-bold tabular-nums" style={{ color: s.color }}>{s.value}</p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Engine sub-tabs */}
      <div className="px-6 pb-2">
        <TabBar tabs={ENGINE_TABS} active={activeTab} onChange={setActiveTab} />
      </div>

      {/* Tab content */}
      <div className="px-6 pb-6">
        <AnimatePresence mode="wait">
          {activeTab === 'search' && (
            <motion.div key="search" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }} className="space-y-4">
              {/* Search form */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="sm:col-span-2 lg:col-span-2 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder='Try: "AI for healthcare CTO" or "cloud migration financial services"'
                    value={ragQuery}
                    onChange={e => setRagQuery(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && runRagSearch()}
                    className="h-10 text-sm pl-10 bg-black/[0.03] border-gray-200 focus:border-primary/40"
                  />
                </div>
                <Input
                  placeholder="Industry (e.g. Healthcare)"
                  value={ragIndustry}
                  onChange={e => setRagIndustry(e.target.value)}
                  className="h-10 text-sm bg-black/[0.03] border-gray-200"
                />
                <Input
                  placeholder="Role (e.g. CTO)"
                  value={ragRole}
                  onChange={e => setRagRole(e.target.value)}
                  className="h-10 text-sm bg-black/[0.03] border-gray-200"
                />
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Mode:</span>
                  {(['keyword', 'semantic', 'hybrid'] as const).map(mode => (
                    <button
                      key={mode}
                      onClick={() => setRagMode(mode)}
                      className={`px-3 py-1 rounded-md text-[11px] font-medium transition-all duration-200 ${
                        ragMode === mode
                          ? 'text-foreground border border-primary/30 shadow-sm'
                          : 'text-muted-foreground border border-transparent hover:text-foreground hover:bg-black/[0.03]'
                      }`}
                      style={ragMode === mode ? { background: 'rgba(212,175,55,0.1)' } : {}}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
                <Button
                  size="sm"
                  className="h-8 text-xs gap-1.5 ml-auto"
                  onClick={runRagSearch}
                  disabled={ragLoading || !ragQuery.trim()}
                >
                  {ragLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                  {ragLoading ? 'Searching...' : 'Test Retrieval'}
                </Button>
              </div>

              {/* Results */}
              {ragResults && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
                  {/* Insight bar */}
                  {ragInsight && (
                    <div className="flex flex-wrap items-center gap-3 px-4 py-3 rounded-lg bg-white/[0.02] border border-gray-200">
                      <span className="text-[10px] text-muted-foreground">
                        {ragResults.length} results in {ragInsight.resultCategories?.length || 0} categories
                      </span>
                      {ragInsight.avgRelevanceScore > 0 && (
                        <span className="text-[10px] font-medium" style={{ color: '#D4AF37' }}>
                          Avg score: {ragInsight.avgRelevanceScore}%
                        </span>
                      )}
                      {ragInsight.topMatchedFields?.length > 0 && (
                        <span className="text-[10px] text-muted-foreground">
                          Matched: {ragInsight.topMatchedFields.join(', ')}
                        </span>
                      )}
                      {ragInsight.queryTokens && (
                        <span className="text-[10px] text-muted-foreground ml-auto">
                          Tokens: [{ragInsight.queryTokens.join(', ')}]
                        </span>
                      )}
                    </div>
                  )}

                  {/* Result cards */}
                  {ragResults.length === 0 ? (
                    <div className="text-center py-8 text-sm text-muted-foreground">No results. Try different keywords.</div>
                  ) : (
                    <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                      {ragResults.map((r: any, idx: number) => {
                        const catColor = CAT_GRADIENT[r.category]?.from || 'rgba(212,175,55,0.2)';
                        const CatIcon = CAT_ICON[r.category] || FileText;
                        return (
                          <motion.div
                            key={r.id}
                            initial={{ opacity: 0, x: -12 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.04 }}
                            className="flex items-start gap-3 p-3 rounded-lg bg-white/[0.02] border border-white/[0.05] hover:border-white/[0.1] transition-colors"
                          >
                            {/* Relevance score */}
                            <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold tabular-nums"
                              style={{ background: `${catColor}`, color: '#fff' }}
                            >
                              {r.relevanceScore}%
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5">
                                <CatIcon className="w-3 h-3 text-muted-foreground shrink-0" />
                                <p className="text-sm font-medium text-foreground truncate">{r.title}</p>
                              </div>
                              <p className="text-[11px] text-muted-foreground line-clamp-2">{r.summary || r.content?.slice(0, 120)}</p>
                              {r.matchedFields && r.matchedFields.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1.5">
                                  {r.matchedFields.map((f: string) => (
                                    <span key={f} className="text-[9px] px-1.5 py-0.5 rounded bg-black/[0.04] text-muted-foreground">{f}</span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  )}
                </motion.div>
              )}

              {/* Placeholder when no search yet */}
              {!ragResults && !ragLoading && (
                <div className="text-center py-8">
                  <Brain className="w-8 h-8 text-primary/30 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Test how the Knowledge Engine retrieves context for any prospect</p>
                  <p className="text-xs text-muted-foreground mt-1">Enter a query simulating a contact profile to see what knowledge gets retrieved</p>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'coverage' && (
            <motion.div key="coverage" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }} className="space-y-4">
              {coverageLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                  <span className="ml-2 text-sm text-muted-foreground">Analyzing knowledge coverage...</span>
                </div>
              ) : coverage ? (
                <>
                  {/* Overall score */}
                  <div className="flex items-center gap-4 p-4 rounded-lg bg-white/[0.02] border border-gray-200">
                    <div className="text-center">
                      <p className="text-3xl font-bold tabular-nums" style={{ color: coverage.overallScore >= 70 ? '#10B981' : coverage.overallScore >= 40 ? '#F59E0B' : '#EF4444' }}>
                        {coverage.overallScore}%
                      </p>
                      <p className="text-[10px] text-muted-foreground">Completeness</p>
                    </div>
                    <div className="flex-1">
                      <AnimatedBar value={coverage.overallScore} max={100} color={coverage.overallScore >= 70 ? '#10B981' : coverage.overallScore >= 40 ? '#F59E0B' : '#EF4444'} />
                      <p className="text-[10px] text-muted-foreground mt-1">Service line completeness score (service line + case study + proof point + objection + CTA)</p>
                    </div>
                  </div>

                  {/* Service line completeness */}
                  {Object.entries(coverage.serviceLineCompleteness || {}).map(([sl, data]: [string, any]) => (
                    <div key={sl} className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.05]">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-medium text-foreground">{sl}</p>
                        <span className="text-xs font-bold tabular-nums" style={{ color: data.score >= 70 ? '#10B981' : data.score >= 40 ? '#F59E0B' : '#EF4444' }}>{data.score}%</span>
                      </div>
                      <div className="flex gap-2 mb-2">
                        {[
                          { key: 'hasServiceLine', label: 'Service', c: '#3B82F6' },
                          { key: 'hasCaseStudy', label: 'Case Study', c: '#10B981' },
                          { key: 'hasProofPoint', label: 'Proof', c: '#8B5CF6' },
                          { key: 'hasObjection', label: 'Objection', c: '#EF4444' },
                          { key: 'hasCTA', label: 'CTA', c: '#F59E0B' },
                        ].map(item => (
                          <span
                            key={item.key}
                            className="text-[9px] px-2 py-0.5 rounded-full border"
                            style={{
                              background: data[item.key as keyof typeof data] ? `${item.c}15` : 'transparent',
                              borderColor: data[item.key as keyof typeof data] ? `${item.c}40` : 'rgba(0, 0, 0, 0.05)',
                              color: data[item.key as keyof typeof data] ? item.c : 'rgba(0, 0, 0, 0.08)',
                            }}
                          >
                            {data[item.key as keyof typeof data] ? '' : 'No '}{item.label}
                          </span>
                        ))}
                      </div>
                      <AnimatedBar value={data.score} max={100} color={data.score >= 70 ? '#10B981' : '#F59E0B'} delay={0.1} />
                    </div>
                  ))}

                  {/* Recommendations */}
                  {(coverage.recommendations || []).length > 0 && (
                    <div className="space-y-2 pt-2">
                      <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <Lightbulb className="w-3.5 h-3.5 text-amber-600" />
                        Recommendations
                      </p>
                      {coverage.recommendations.map((rec: string, idx: number) => (
                        <div key={idx} className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-500/[0.04] border border-amber-500/10">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600/70 shrink-0 mt-0.5" />
                          <p className="text-[11px] text-muted-foreground leading-relaxed">{rec}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-6">
                  <p className="text-sm text-muted-foreground">Click to analyze knowledge gaps</p>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'flow' && (
            <motion.div key="flow" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }}>
              <div className="relative">
                {/* Flow visualization */}
                <div className="space-y-0">
                  {[
                    { step: 1, icon: Upload, title: 'Contact Imported', desc: 'Name, title, company, industry parsed from CSV/Excel', color: '#3B82F6', detail: 'Lead data flows into the CRM with email verification' },
                    { step: 2, icon: Target, title: 'Query Constructed', desc: 'Industry + role + company size + problems form the search query', color: '#8B5CF6', detail: 'Hybrid mode: keyword matching + TF-IDF semantic similarity' },
                    { step: 3, icon: Brain, title: 'Knowledge Retrieved', desc: `Top ${items.length > 0 ? Math.min(8, items.length) : 8} relevant assets scored and ranked by relevance`, color: '#D4AF37', detail: 'Service lines, case studies, proof points, objections, CTAs' },
                    { step: 4, icon: Sparkles, title: 'Email Generated', desc: 'Retrieved knowledge injected into AI prompt with contact context', color: '#10B981', detail: 'Personalized subject, body, and CTA based on matched knowledge' },
                    { step: 5, icon: Mail, title: 'Draft Ready for Review', desc: 'Draft appears in Drafts screen with source snippets and confidence scores', color: '#F59E0B', detail: 'You can edit, approve, or regenerate before sending' },
                  ].map((item, idx) => (
                    <div key={idx} className="flex gap-4">
                      {/* Step number + connector */}
                      <div className="flex flex-col items-center">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-lg"
                          style={{ background: `${item.color}20`, boxShadow: `0 0 16px ${item.color}15` }}
                        >
                          <item.icon className="w-4 h-4" style={{ color: item.color }} />
                        </div>
                        {idx < 4 && (
                          <div className="w-px h-8 my-1" style={{ background: `linear-gradient(180deg, ${item.color}40, transparent)` }} />
                        )}
                      </div>
                      {/* Content */}
                      <div className="pb-4">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: item.color }}>Step {item.step}</span>
                        </div>
                        <p className="text-sm font-semibold text-foreground mt-0.5">{item.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                        <p className="text-[11px] text-muted-foreground/70 mt-1 italic">{item.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Live connection indicator */}
                <div className="mt-4 flex items-center gap-2 px-4 py-3 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.04]">
                  <Workflow className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs text-emerald-600 font-medium">RAG Pipeline Active</span>
                  <span className="text-[10px] text-muted-foreground ml-1">
                    - Every draft uses this pipeline. The knowledge you add here directly determines email quality.
                  </span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Category distribution bar at bottom */}
      <div className="px-6 py-3 border-t border-gray-200 bg-white/[0.01]">
        <div className="flex items-center gap-4">
          {Object.entries({
            service_line: { label: 'Services', color: '#3B82F6' },
            case_study: { label: 'Cases', color: '#10B981' },
            proof_point: { label: 'Proof', color: '#8B5CF6' },
            objection_response: { label: 'Objections', color: '#EF4444' },
            cta: { label: 'CTAs', color: '#F59E0B' },
          }).map(([cat, { label, color }]) => {
            const count = items.filter(i => i.category === cat).length;
            return (
              <div key={cat} className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[9px] text-muted-foreground">{label}</span>
                  <span className="text-[9px] tabular-nums text-muted-foreground">{count}</span>
                </div>
                <AnimatedBar value={count} max={items.length || 1} color={color} delay={0.3} />
              </div>
            );
          })}
        </div>
      </div>
    </GlassPanel>
  );
}

/* ========
   Tag Cloud Dialog (C-15)
   ======== */
function TagCloudDialog({ items, onSelectTag, onClose }: { items: Capability[]; onSelectTag: (tag: string) => void; onClose: () => void }) {
  const tagCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of items) {
      if (item.tags && Array.isArray(item.tags)) {
        for (const tag of item.tags) {
          counts.set(tag, (counts.get(tag) || 0) + 1);
        }
      }
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [items]);

  const maxCount = tagCounts.length > 0 ? tagCounts[0][1] : 1;

  return (
    <GlassDialog title="All Tags" subtitle={`${tagCounts.length} unique tags across ${items.length} assets`} onClose={onClose}>
      {tagCounts.length === 0 ? (
        <div className="text-center py-8">
          <Hash className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No tags have been added yet</p>
          <p className="text-xs text-muted-foreground/60">Add tags to capabilities to organize and filter your knowledge base</p>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {tagCounts.map(([tag, count]) => {
            const intensity = Math.max(0.4, count / maxCount);
            return (
              <button
                key={tag}
                onClick={() => { onSelectTag(tag); onClose(); }}
                className="group flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 bg-white/[0.02] hover:border-primary/30 hover:bg-primary/5 transition-all duration-200"
              >
                <Hash className="w-3 h-3 text-primary/50 group-hover:text-primary transition-colors" />
                <span className="text-xs font-medium" style={{ color: `rgba(212, 175, 55, ${intensity})` }}>{tag}</span>
                <span className="text-[9px] tabular-nums text-muted-foreground bg-black/[0.04] rounded-full px-1.5 py-0.5">{count}</span>
              </button>
            );
          })}
        </div>
      )}
    </GlassDialog>
  );
}

/* ========
   Main Component
   ======== */
export default function CapabilityScreen({ navigateTo }: CapabilityScreenProps) {
  const [items, setItems] = useState<Capability[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('all');
  const [search, setSearch] = useState('');
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const [showTagCloud, setShowTagCloud] = useState(false);

  // View dialog
  const [selected, setSelected] = useState<Capability | null>(null);

  // Create/Edit dialog
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // Upload dialog
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadResults, setUploadResults] = useState<Array<{ fileName: string; success?: boolean; error?: string; assetsGenerated?: number; duplicates?: Array<{ existingId: string; title: string }> }>>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Delete dialog
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // C-11: Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);

  // C-12: Enrich dialog
  const [showEnrich, setShowEnrich] = useState(false);
  const [enrichUrl, setEnrichUrl] = useState('');
  const [enrichLoading, setEnrichLoading] = useState(false);
  const [enrichResult, setEnrichResult] = useState<any>(null);
  const [enrichSaving, setEnrichSaving] = useState(false);

  // C-10: Import dialog
  const [showImport, setShowImport] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);

  /* -- All unique tags across assets -- */
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    for (const item of items) {
      if (item.tags && Array.isArray(item.tags)) {
        for (const tag of item.tags) {
          tagSet.add(tag);
        }
      }
    }
    return [...tagSet].sort();
  }, [items]);

  /* -- Fetch capabilities -- */
  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (tab !== 'all') params.set('category', tab);
      const res = await fetch(`/api/capabilities?${params.toString()}`);
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  /* -- Computed stats -- */
  const activeCount = items.filter(i => i.isActive).length;
  const categoryCount = new Set(items.map(i => i.category)).size;
  const serviceLineCount = new Set(items.filter(i => i.category === 'service_line').map(i => i.serviceLine).filter(Boolean)).size;

  /* -- Filtered items -- */
  const filtered = useMemo(() => {
    let result = search
      ? items.filter(c =>
          c.title.toLowerCase().includes(search.toLowerCase()) ||
          c.summary.toLowerCase().includes(search.toLowerCase())
        )
      : items;

    // C-15: Tag filtering
    if (filterTag) {
      result = result.filter(c =>
        c.tags && Array.isArray(c.tags) && c.tags.includes(filterTag)
      );
    }

    return result;
  }, [items, search, filterTag]);

  /* -- Form handlers -- */
  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const openEdit = (cap: Capability) => {
    setEditingId(cap.id);
    setForm({
      title: cap.title,
      summary: cap.summary,
      category: cap.category,
      serviceLine: cap.serviceLine || '',
      targetIndustries: cap.targetIndustries || '',
      targetRoles: cap.targetRoles || '',
      problems: cap.problems || '',
      evidence: cap.evidence || '',
      content: cap.content || '',
      isActive: cap.isActive,
      tags: Array.isArray(cap.tags) ? [...cap.tags] : [],
      targetCompanySizes: cap.targetCompanySizes || '',
      parentAssetId: cap.parentAssetId || '',
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.summary.trim()) {
      toast.error('Title and summary are required');
      return;
    }
    setSaving(true);
    try {
      const isEdit = !!editingId;
      const url = '/api/capabilities';
      const method = isEdit ? 'PUT' : 'POST';
      const body = isEdit
        ? { id: editingId, ...form, parentAssetId: form.parentAssetId && form.parentAssetId !== '__none__' ? form.parentAssetId : null }
        : { ...form, parentAssetId: form.parentAssetId && form.parentAssetId !== '__none__' ? form.parentAssetId : null };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to save');
      }

      const savedData = await res.json();
      toast.success(isEdit ? `Updated (v${savedData.version || ''})` : 'Capability created');
      setShowForm(false);
      fetchItems();
      if (isEdit && selected?.id === editingId) {
        setSelected(prev => prev ? { ...prev, ...form } : null);
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const res = await fetch('/api/capabilities', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: deleteId }),
      });
      if (!res.ok) throw new Error('Failed to delete');
      toast.success('Capability deleted');
      setSelected(prev => prev?.id === deleteId ? null : prev);
      fetchItems();
    } catch {
      toast.error('Failed to delete capability');
    } finally {
      setDeleteId(null);
    }
  };

  /* -- Upload handlers -- */
  const handleFileUpload = async (files: FileList | File[]) => {
    const fileArr = Array.from(files);
    const invalid = fileArr.find(f => {
      const ext = f.name.split('.').pop()?.toLowerCase();
      return !['txt', 'md', 'pdf', 'docx'].includes(ext || '');
    });
    if (invalid) {
      toast.error(`Unsupported file type: ${invalid.name}. Use .txt, .md, .pdf, or .docx`);
      return;
    }
    const tooBig = fileArr.find(f => f.size > 25 * 1024 * 1024);
    if (tooBig) {
      toast.error(`File too large: ${tooBig.name} (max 25MB)`);
      return;
    }

    setUploading(true);
    setUploadResults([]);
    try {
      const fd = new FormData();
      for (const f of fileArr) fd.append('file', f);
      const res = await fetch('/api/capabilities/upload', { method: 'POST', body: fd });
      const data = await res.json();

      if (!data.success && data.error) {
        setUploadResults([{ fileName: 'Upload', error: data.error }]);
        return;
      }

      // Multi-file result
      if (data.results) {
        setUploadResults(data.results.map((r: any) => ({
          fileName: r.fileName,
          success: r.success,
          error: r.error,
          assetsGenerated: r.assetsGenerated,
          duplicates: r.duplicates,
          wordCount: r.wordCount,
        })));
      } else {
        // Single file result
        setUploadResults([{
          fileName: data.fileName,
          success: true,
          assetsGenerated: data.assetsGenerated,
          duplicates: data.duplicates,
          wordCount: data.wordCount,
        }]);
      }
      fetchItems();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files.length > 0) handleFileUpload(e.dataTransfer.files);
  };

  const handleCreateFromUpload = (result: typeof uploadResults[0]) => {
    setShowUpload(false);
    setUploadResults([]);
    setEditingId(null);
    setForm({
      ...EMPTY_FORM,
      title: result.fileName.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' '),
      summary: `Uploaded from ${result.fileName} (${result.wordCount || ''} words)`,
    });
    setShowForm(true);
  };

  /* -- C-11: Bulk operations -- */
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(c => c.id)));
    }
  };
  const handleBulkAction = async (action: 'activate' | 'deactivate' | 'delete') => {
    if (selectedIds.size === 0) return;
    setBulkLoading(true);
    try {
      const res = await fetch('/api/capabilities', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedIds), action }),
      });
      if (!res.ok) throw new Error('Bulk action failed');
      const data = await res.json();
      toast.success(`${action === 'delete' ? 'Deleted' : action === 'activate' ? 'Activated' : 'Deactivated'} ${data.processed} items`);
      setSelectedIds(new Set());
      fetchItems();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Bulk action failed');
    } finally {
      setBulkLoading(false);
    }
  };

  /* -- C-10: Export -- */
  const handleExport = async (format: 'json' | 'csv') => {
    try {
      const res = await fetch(`/api/capabilities/export?format=${format}`);
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `deepmindq-capabilities.${format}`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported as ${format.toUpperCase()}`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Export failed');
    }
  };

  /* -- C-10: Import -- */
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportLoading(true);
    setImportResult(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/capabilities/import', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Import failed');
      setImportResult(data);
      toast.success(`Imported ${data.created} of ${data.total} assets`);
      fetchItems();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setImportLoading(false);
      e.target.value = '';
    }
  };

  /* -- C-12: Enrich from URL -- */
  const handleEnrich = async () => {
    if (!enrichUrl.trim()) return;
    setEnrichLoading(true);
    setEnrichResult(null);
    try {
      const res = await fetch('/api/capabilities/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: enrichUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Enrichment failed');
      setEnrichResult(data);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Enrichment failed');
    } finally {
      setEnrichLoading(false);
    }
  };

  const handleSaveEnrichedAssets = async () => {
    if (!enrichResult?.assets?.length) return;
    setEnrichSaving(true);
    let created = 0;
    try {
      for (const asset of enrichResult.assets) {
        const res = await fetch('/api/capabilities', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(asset),
        });
        if (res.ok) created++;
      }
      toast.success(`Saved ${created} enriched assets`);
      setShowEnrich(false);
      setEnrichResult(null);
      setEnrichUrl('');
      fetchItems();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to save enriched assets');
    } finally {
      setEnrichSaving(false);
    }
  };

  /* -- Tab bar data with counts -- */
  const tabBarTabs = TABS.map(t => ({
    key: t.value,
    label: t.label,
    count: t.value === 'all' ? items.length : items.filter(i => i.category === t.value).length,
  }));

  /* -- Render -- */
  if (loading && items.length === 0) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-48 rounded-xl" />)}
      </div>
    );
  }

  return (
    <PageTransition>
    <div className="max-h-[calc(100vh-200px)] overflow-y-auto space-y-8 pr-1">

      {/* ===== Page Header ===== */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <SectionHeader title="" className="mb-0" />
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            <ShimmerText>Capability Library</ShimmerText>
          </h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-lg">
            Curate the knowledge assets that power personalized AI-driven email generation.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <Button size="sm" className="h-9 text-xs gap-1.5 shadow-lg shadow-primary/10" onClick={openCreate}>
            <Plus className="w-3.5 h-3.5" />Add Capability
          </Button>
          <Button size="sm" variant="outline" className="h-9 text-xs gap-1.5" onClick={() => { setUploadResults([]); setShowUpload(true); }}>
            <Upload className="w-3.5 h-3.5" />Upload
          </Button>
          <Button size="sm" variant="outline" className="h-9 text-xs gap-1.5" onClick={() => setShowEnrich(true)}>
            <Globe className="w-3.5 h-3.5" />Enrich
          </Button>
          <Button size="sm" variant="outline" className="h-9 text-xs gap-1.5" onClick={() => handleExport('json')}>
            <Download className="w-3.5 h-3.5" />Export
          </Button>
          <Button size="sm" variant="outline" className="h-9 text-xs gap-1.5" onClick={() => setShowImport(true)}>
            <Upload className="w-3.5 h-3.5" />Import
          </Button>
        </div>
      </div>

      {/* ===== Stat Cards Row ===== */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <StatCard
          label="Total Capabilities"
          value={items.length}
          icon={Database}
          color="#D4AF37"
          delay={0}
        />
        <StatCard
          label="Active"
          value={activeCount}
          icon={CheckCircle2}
          color="#10B981"
          delay={0.08}
        />
        <StatCard
          label="Categories Used"
          value={categoryCount}
          icon={Layers}
          color="#8B5CF6"
          delay={0.16}
        />
        <StatCard
          label="Tags"
          value={allTags.length}
          icon={Tag}
          color="#F59E0B"
          delay={0.24}
        />
      </div>

      {/* ===== Knowledge Engine (RAG) ===== */}
      <KnowledgeEnginePanel items={items} navigateTo={navigateTo} />

      {/* ===== Search & Filter (GlassPanel) ===== */}
      <GlassPanel className="p-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search capabilities by title or summary..."
              value={search}
              onChange={e => { setSearch(e.target.value); setFilterTag(null); }}
              className="h-10 text-sm pl-10 bg-black/[0.03] border-gray-200 focus:border-primary/40"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{filtered.length} result{filtered.length !== 1 ? 's' : ''}</span>
            {(search || filterTag) && (
              <Badge variant="outline" className="text-[10px] gap-1">
                <Sparkles className="w-3 h-3 text-primary" />
                Filtered
              </Badge>
            )}
            {/* C-15: Tag filter indicator */}
            {filterTag && (
              <Badge variant="outline" className="text-[10px] gap-1 border-primary/30 text-primary bg-primary/5">
                <Tag className="w-2.5 h-2.5" />
                {filterTag}
                <button onClick={() => setFilterTag(null)}>
                  <X className="w-2.5 h-2.5" />
                </button>
              </Badge>
            )}
            {/* C-15: Tag Cloud button */}
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-[10px] text-muted-foreground hover:text-foreground"
              onClick={() => setShowTagCloud(true)}
            >
              <Hash className="w-3 h-3 mr-1" />
              All Tags ({allTags.length})
            </Button>
          </div>
        </div>

        {/* C-15: Quick tag filter pills */}
        {allTags.length > 0 && !filterTag && !search && (
          <div className="flex items-center gap-1.5 mt-3 flex-wrap">
            <span className="text-[10px] text-muted-foreground">Quick filter:</span>
            {allTags.slice(0, 12).map(tag => (
              <button
                key={tag}
                onClick={() => setFilterTag(tag)}
                className="text-[10px] px-2 py-0.5 rounded-full border border-gray-200 bg-white/[0.02] text-muted-foreground hover:border-primary/30 hover:text-primary hover:bg-primary/5 transition-all duration-200"
              >
                {tag}
              </button>
            ))}
            {allTags.length > 12 && (
              <button
                onClick={() => setShowTagCloud(true)}
                className="text-[10px] text-primary hover:text-primary/80 transition-colors"
              >
                +{allTags.length - 12} more
              </button>
            )}
          </div>
        )}
      </GlassPanel>

      {/* ===== Category Tabs ===== */}
      <SectionHeader
        title="Browse by Category"
        subtitle="Filter capabilities by type to find exactly what you need"
      />
      <TabBar
        tabs={tabBarTabs}
        active={tab}
        onChange={(key) => { setTab(key); setSearch(''); setFilterTag(null); }}
      />

      {/* ===== C-11: Bulk Action Bar ===== */}
      <AnimatePresence>
        {selectedIds.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="flex items-center justify-between gap-4 p-3 rounded-xl border border-primary/20 shadow-lg"
            style={{ background: 'rgba(212,175,55,0.06)', backdropFilter: 'blur(12px)' }}
          >
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-foreground">{selectedIds.size} selected</span>
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={toggleSelectAll}>
                {selectedIds.size === filtered.length ? 'Deselect All' : 'Select All'}
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" onClick={() => handleBulkAction('activate')} disabled={bulkLoading}>
                <Check className="w-3 h-3 text-emerald-600" />Activate
              </Button>
              <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" onClick={() => handleBulkAction('deactivate')} disabled={bulkLoading}>
                <Ban className="w-3 h-3 text-amber-600" />Deactivate
              </Button>
              <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5 text-red-600 border-red-500/30 hover:bg-red-50" onClick={() => handleBulkAction('delete')} disabled={bulkLoading}>
                <Trash2 className="w-3 h-3" />Delete
              </Button>
              {bulkLoading && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ===== Card Grid ===== */}
      <StaggerGrid className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {filtered.map(cap => {
          const Icon = CAT_ICON[cap.category] || Tag;
          const grad = CAT_GRADIENT[cap.category] || CAT_GRADIENT.service_line;
          const hasChildren = items.some(i => i.parentAssetId === cap.id);
          const parentCap = cap.parentAssetId ? items.find(i => i.id === cap.parentAssetId) : null;
          return (
            <StaggerItem key={cap.id}>
              <AnimatedCard
                glow={grad.glow}
                className="group/card"
              >
                {/* Gradient border via outer wrapper */}
                <div
                  className="rounded-xl p-[1.5px] transition-all duration-500 group-hover/card:shadow-lg"
                  style={{
                    background: `linear-gradient(135deg, ${grad.from}, ${grad.to}, transparent 70%)`,
                    boxShadow: 'inset 0 0 0 0 transparent',
                  }}
                >
                  <div className="rounded-xl bg-card p-5">
                    {/* Card header */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2.5 mb-2">
                          {/* C-11: Checkbox */}
                          <button
                            onClick={() => toggleSelect(cap.id)}
                            className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-all duration-200 ${
                              selectedIds.has(cap.id)
                                ? 'border-primary bg-primary text-primary-foreground'
                                : 'border-gray-300 hover:border-primary/50'
                            }`}
                          >
                            {selectedIds.has(cap.id) && <Check className="w-2.5 h-2.5" />}
                          </button>
                          <div
                            className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-transform duration-300 group-hover/card:scale-110"
                            style={{ background: `${grad.from}` }}
                          >
                            <Icon className="w-3.5 h-3.5 text-white" />
                          </div>
                          <h3 className="text-sm font-semibold text-foreground truncate">{cap.title}</h3>
                        </div>
                        <div className="flex items-center gap-1.5 ml-[34px]">
                          <Badge variant="outline" className={`text-[10px] ${CAT_BADGE[cap.category] || ''}`}>
                            {CAT_LABEL[cap.category] || cap.category}
                          </Badge>
                          {/* C-07: Version badge */}
                          {(cap.version || 0) > 1 && (
                            <Badge variant="outline" className="text-[9px] border-primary/30 text-primary bg-primary/5">
                              v{cap.version}
                            </Badge>
                          )}
                          {/* C-08: Parent indicator */}
                          {parentCap && (
                            <Badge variant="outline" className="text-[9px] gap-0.5 border-purple-500/30 text-purple-300 bg-purple-500/5">
                              <Link2 className="w-2.5 h-2.5" />{parentCap.title.slice(0, 20)}
                            </Badge>
                          )}
                          {/* C-08: Children indicator */}
                          {hasChildren && (
                            <Badge variant="outline" className="text-[9px] gap-0.5 border-emerald-500/30 text-emerald-300 bg-emerald-500/5">
                              <GitBranch className="w-2.5 h-2.5" />children
                            </Badge>
                          )}
                        </div>
                      </div>
                      <span
                        className={`w-2.5 h-2.5 rounded-full mt-2 shrink-0 transition-shadow duration-300 ${
                          cap.isActive
                            ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]'
                            : 'bg-zinc-600'
                        }`}
                        title={cap.isActive ? 'Active' : 'Inactive'}
                      />
                    </div>

                    {/* Summary */}
                    <p className="text-xs text-muted-foreground mt-3 line-clamp-3 leading-relaxed">{cap.summary}</p>

                    {/* Tags (C-15) */}
                    {cap.tags && Array.isArray(cap.tags) && cap.tags.length > 0 && (
                      <div className="flex items-center gap-1 mt-3 flex-wrap">
                        {cap.tags.slice(0, 4).map(tag => (
                          <button
                            key={tag}
                            onClick={() => setFilterTag(tag)}
                            className="text-[9px] px-1.5 py-0.5 rounded border border-gray-200 bg-white/[0.02] text-muted-foreground hover:border-primary/30 hover:text-primary hover:bg-primary/5 transition-all duration-200"
                          >
                            {tag}
                          </button>
                        ))}
                        {cap.tags.length > 4 && (
                          <span className="text-[9px] text-muted-foreground/50">+{cap.tags.length - 4}</span>
                        )}
                      </div>
                    )}

                    {/* Meta fields */}
                    {cap.serviceLine && (
                      <p className="text-[11px] text-muted-foreground mt-3 flex items-center gap-1.5">
                        <Layers className="w-3 h-3 text-blue-600/70" />{cap.serviceLine}
                      </p>
                    )}
                    {cap.targetIndustries && (
                      <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1.5">
                        <Tag className="w-3 h-3 text-purple-600/70" />{cap.targetIndustries}
                      </p>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-1 mt-4 pt-3 border-t border-border/40">
                      <Button variant="ghost" size="sm" className="h-7 text-xs text-primary hover:text-primary/80 hover:bg-primary/10 px-2.5 rounded-lg"
                        onClick={() => setSelected(cap)}>
                        <Eye className="w-3.5 h-3.5 mr-1" />View
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground hover:text-foreground hover:bg-black/[0.04] px-2.5 rounded-lg"
                        onClick={() => openEdit(cap)}>
                        <Pencil className="w-3.5 h-3.5 mr-1" />Edit
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground hover:text-red-600 hover:bg-red-50 px-2.5 rounded-lg ml-auto"
                        onClick={() => setDeleteId(cap.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              </AnimatedCard>
            </StaggerItem>
          );
        })}

        {filtered.length === 0 && !loading && (
          <div className="col-span-full">
            <EmptyState
              icon={filterTag ? Tag : search ? Search : Database}
              title={filterTag ? `No capabilities tagged "${filterTag}"` : search ? 'No matching capabilities' : 'No capabilities yet'}
              description={filterTag
                ? 'Try selecting a different tag or clearing the filter.'
                : search
                  ? 'Try adjusting your search terms or clearing the filter.'
                  : 'Add capabilities to improve AI draft quality and enable semantic retrieval.'}
              action={
                filterTag ? (
                  <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" onClick={() => setFilterTag(null)}>
                    <X className="w-3 h-3" />Clear Tag Filter
                  </Button>
                ) : !search ? (
                  <Button size="sm" className="h-8 text-xs gap-1.5" onClick={openCreate}>
                    <Plus className="w-3 h-3" />Add First Capability
                  </Button>
                ) : undefined
              }
            />
          </div>
        )}
      </StaggerGrid>

      {/* ===== View Dialog (Glassmorphism) ===== */}
      {selected && (
        <GlassDialog
          title={selected.title}
          subtitle={CAT_LABEL[selected.category] || selected.category}
          onClose={() => setSelected(null)}
          actions={
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" className="h-8 text-xs gap-1.5" onClick={() => { openEdit(selected); setSelected(null); }}>
                <Pencil className="w-3.5 h-3.5" />Edit
              </Button>
              <Button variant="ghost" size="sm" className="h-8 text-xs gap-1.5 text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => { setDeleteId(selected.id); setSelected(null); }}>
                <Trash2 className="w-3.5 h-3.5" />Delete
              </Button>
            </div>
          }
        >
          <div className="space-y-5 text-sm">
            <div className="flex items-center gap-2">
              {(() => { const I = CAT_ICON[selected.category] || Tag; return <I className="w-4 h-4 text-primary" />; })()}
              <Badge variant="outline" className={`text-[10px] ${CAT_BADGE[selected.category] || ''}`}>
                {CAT_LABEL[selected.category] || selected.category}
              </Badge>
              <span className={`w-2 h-2 rounded-full ${selected.isActive ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]' : 'bg-zinc-600'}`} />
              <span className="text-[11px] text-muted-foreground">{selected.isActive ? 'Active' : 'Inactive'}</span>
              {/* C-07: Version badge in view */}
              {(selected.version || 0) > 1 && (
                <Badge variant="outline" className="text-[10px] border-primary/30 text-primary bg-primary/5">
                  v{selected.version}
                </Badge>
              )}
            </div>

            {/* C-08: Parent info in view */}
            {selected.parentAssetId && (
              <div className="flex items-center gap-2">
                <Link2 className="w-3.5 h-3.5 text-purple-600" />
                <span className="text-[11px] text-muted-foreground">Parent: {items.find(i => i.id === selected.parentAssetId)?.title || selected.parentAssetId}</span>
              </div>
            )}

            {/* C-15: Tags in view dialog */}
            {selected.tags && Array.isArray(selected.tags) && selected.tags.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <Hash className="w-3.5 h-3.5 text-primary/60" />
                {selected.tags.map(tag => (
                  <button
                    key={tag}
                    onClick={() => { setSelected(null); setFilterTag(tag); }}
                    className="text-[10px] px-2 py-0.5 rounded-full border border-primary/20 text-primary bg-primary/5 hover:bg-primary/10 transition-colors"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            )}

            {selected.serviceLine && (
              <GlassPanel className="p-3">
                <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-1">Service Line</p>
                <p className="text-foreground">{selected.serviceLine}</p>
              </GlassPanel>
            )}
            {selected.targetIndustries && (
              <GlassPanel className="p-3">
                <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-1">Target Industries</p>
                <p className="text-foreground">{selected.targetIndustries}</p>
              </GlassPanel>
            )}
            {selected.targetRoles && (
              <GlassPanel className="p-3">
                <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-1">Target Roles</p>
                <p className="text-foreground">{selected.targetRoles}</p>
              </GlassPanel>
            )}
            {selected.targetCompanySizes && (
              <GlassPanel className="p-3">
                <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-1">Target Company Sizes</p>
                <p className="text-foreground">{selected.targetCompanySizes}</p>
              </GlassPanel>
            )}
            {selected.problems && (
              <GlassPanel className="p-3">
                <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-1">Problems Addressed</p>
                <p className="text-foreground">{selected.problems}</p>
              </GlassPanel>
            )}
            {selected.evidence && (
              <GlassPanel className="p-3">
                <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-1">Evidence / Proof</p>
                <p className="text-foreground">{selected.evidence}</p>
              </GlassPanel>
            )}

            <div>
              <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-2">Summary</p>
              <p className="text-foreground leading-relaxed">{selected.summary}</p>
            </div>
            {selected.content && (
              <div>
                <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-2">Full Content</p>
                <div className="max-h-64 overflow-y-auto rounded-xl border border-border/50 bg-white/[0.02] p-4">
                  <p className="text-foreground leading-relaxed whitespace-pre-wrap text-sm">{selected.content}</p>
                </div>
              </div>
            )}

            {/* C-09: Feedback stats in view dialog */}
            <div className="flex items-center gap-4 pt-2">
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <span className="text-emerald-600">▲</span> {selected.upvotes || 0} upvotes
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <span className="text-red-600">▼</span> {selected.downvotes || 0} downvotes
              </div>
              {(selected.usedInEmails || 0) > 0 && (
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <Mail className="w-3 h-3" /> Used in {selected.usedInEmails} email{selected.usedInEmails! > 1 ? 's' : ''}
                </div>
              )}
            </div>
          </div>
        </GlassDialog>
      )}

      {/* ===== Create/Edit Dialog (Glassmorphism) ===== */}
      {showForm && (
        <GlassDialog
          title={editingId ? 'Edit Capability' : 'New Capability'}
          subtitle={editingId ? 'Update the details of this capability' : 'Add a new knowledge asset to the library'}
          onClose={() => setShowForm(false)}
          actions={
            <>
              <Button variant="ghost" size="sm" onClick={() => setShowForm(false)} className="text-sm">
                Cancel
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving} className="text-sm shadow-lg shadow-primary/10">
                {saving ? (
                  <div className="w-3.5 h-3.5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin mr-1.5" />
                ) : null}
                {editingId ? 'Update' : 'Create'}
              </Button>
            </>
          }
        >
          <div className="space-y-5">
            {/* Title */}
            <div className="space-y-1.5">
              <Label htmlFor="cap-title" className="text-sm">Title <span className="text-red-600">*</span></Label>
              <Input
                id="cap-title"
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="Capability title"
                className="h-10 text-sm bg-black/[0.03] border-gray-200 focus:border-primary/40"
              />
            </div>

            {/* Category + Active */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-sm">Category <span className="text-red-600">*</span></Label>
                <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                  <SelectTrigger className="h-10 text-sm bg-black/[0.03] border-gray-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="service_line">Service Line</SelectItem>
                    <SelectItem value="case_study">Case Study</SelectItem>
                    <SelectItem value="proof_point">Proof Point</SelectItem>
                    <SelectItem value="objection_response">Objection Response</SelectItem>
                    <SelectItem value="cta">CTA</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end gap-2 pb-1">
                <Switch
                  checked={form.isActive}
                  onCheckedChange={v => setForm(f => ({ ...f, isActive: v }))}
                />
                <Label className="text-sm text-muted-foreground">Active</Label>
              </div>
            </div>

            {/* Service Line */}
            <div className="space-y-1.5">
              <Label htmlFor="cap-sl" className="text-sm">Service Line</Label>
              <Input
                id="cap-sl"
                value={form.serviceLine}
                onChange={e => setForm(f => ({ ...f, serviceLine: e.target.value }))}
                placeholder="e.g., AI & Data, Cloud & Infrastructure"
                className="h-10 text-sm bg-black/[0.03] border-gray-200 focus:border-primary/40"
              />
            </div>

            {/* C-08: Parent Asset dropdown (for case_study/proof_point/objection_response) */}
            {(form.category === 'case_study' || form.category === 'proof_point' || form.category === 'objection_response') && (
              <div className="space-y-1.5">
                <Label className="text-sm">Parent Asset <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Select value={form.parentAssetId} onValueChange={v => setForm(f => ({ ...f, parentAssetId: v }))}>
                  <SelectTrigger className="h-10 text-sm bg-black/[0.03] border-gray-200">
                    <SelectValue placeholder="Select a parent service line..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {items
                      .filter(i => i.category === 'service_line')
                      .map(sl => (
                        <SelectItem key={sl.id} value={sl.id}>{sl.title}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground">Link this asset to a parent service line</p>
              </div>
            )}

            {/* C-15: Tag Input */}
            <TagInput tags={form.tags} onChange={tags => setForm(f => ({ ...f, tags }))} allTags={allTags} />

            {/* Target Company Sizes (C-03) */}
            <div className="space-y-1.5">
              <Label htmlFor="cap-cs" className="text-sm">Target Company Sizes</Label>
              <Input
                id="cap-cs"
                value={form.targetCompanySizes}
                onChange={e => setForm(f => ({ ...f, targetCompanySizes: e.target.value }))}
                placeholder="Comma-separated: Startup, Mid-Market, Enterprise"
                className="h-10 text-sm bg-black/[0.03] border-gray-200 focus:border-primary/40"
              />
            </div>

            {/* Target Industries + Target Roles */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="cap-ind" className="text-sm">Target Industries</Label>
                <Input
                  id="cap-ind"
                  value={form.targetIndustries}
                  onChange={e => setForm(f => ({ ...f, targetIndustries: e.target.value }))}
                  placeholder="Comma-separated"
                  className="h-10 text-sm bg-black/[0.03] border-gray-200 focus:border-primary/40"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cap-roles" className="text-sm">Target Roles</Label>
                <Input
                  id="cap-roles"
                  value={form.targetRoles}
                  onChange={e => setForm(f => ({ ...f, targetRoles: e.target.value }))}
                  placeholder="Comma-separated"
                  className="h-10 text-sm bg-black/[0.03] border-gray-200 focus:border-primary/40"
                />
              </div>
            </div>

            {/* Problems Addressed */}
            <div className="space-y-1.5">
              <Label htmlFor="cap-problems" className="text-sm">Problems Addressed</Label>
              <Textarea
                id="cap-problems"
                value={form.problems}
                onChange={e => setForm(f => ({ ...f, problems: e.target.value }))}
                placeholder="Key problems this capability solves"
                className="text-sm min-h-[60px] bg-black/[0.03] border-gray-200 focus:border-primary/40"
                rows={2}
              />
            </div>

            {/* Evidence */}
            <div className="space-y-1.5">
              <Label htmlFor="cap-evidence" className="text-sm">Evidence / Proof</Label>
              <Textarea
                id="cap-evidence"
                value={form.evidence}
                onChange={e => setForm(f => ({ ...f, evidence: e.target.value }))}
                placeholder="Supporting evidence, metrics, or proof points"
                className="text-sm min-h-[60px] bg-black/[0.03] border-gray-200 focus:border-primary/40"
                rows={2}
              />
            </div>

            {/* Summary */}
            <div className="space-y-1.5">
              <Label htmlFor="cap-summary" className="text-sm">Summary <span className="text-red-600">*</span></Label>
              <Textarea
                id="cap-summary"
                value={form.summary}
                onChange={e => setForm(f => ({ ...f, summary: e.target.value }))}
                placeholder="Brief summary of the capability"
                className="text-sm min-h-[80px] bg-black/[0.03] border-gray-200 focus:border-primary/40"
                rows={3}
              />
            </div>

            {/* Full Content */}
            <div className="space-y-1.5">
              <Label htmlFor="cap-content" className="text-sm">Full Content</Label>
              <Textarea
                id="cap-content"
                value={form.content}
                onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                placeholder="Detailed content (optional)"
                className="text-sm min-h-[100px] bg-black/[0.03] border-gray-200 focus:border-primary/40"
                rows={4}
              />
            </div>
          </div>
        </GlassDialog>
      )}

      {/* ===== Upload Dialog (Glassmorphism) — C-14: Multi-file ===== */}
      {showUpload && (
        <GlassDialog
          title="Upload Documents"
          subtitle="Extract content from one or more files (supports .txt, .md, .pdf, .docx)"
          onClose={() => { setShowUpload(false); setUploadResults([]); }}
        >
          {/* Drop zone */}
          <div
            className="border-2 border-dashed border-gray-200 rounded-2xl p-10 text-center hover:border-primary/40 transition-all duration-300 cursor-pointer group/drop bg-white/[0.01] hover:bg-black/[0.03]"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={handleDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.md,.pdf,.docx"
              multiple
              className="hidden"
              onChange={e => {
                if (e.target.files && e.target.files.length > 0) handleFileUpload(e.target.files);
                e.target.value = '';
              }}
            />
            {uploading ? (
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-muted-foreground">Extracting text...</p>
              </div>
            ) : (
              <>
                <div
                  className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center transition-transform duration-300 group-hover/drop:scale-110"
                  style={{ background: 'linear-gradient(135deg, rgba(212,175,55,0.15), rgba(212,175,55,0.03))' }}
                >
                  <Upload className="w-6 h-6" style={{ color: '#D4AF37' }} />
                </div>
                <p className="text-sm font-medium text-foreground">Drag and drop or click to upload</p>
                <p className="text-xs text-muted-foreground mt-1.5">.txt, .md, .pdf, .docx — multiple files supported</p>
              </>
            )}
          </div>

          {/* Per-file results */}
          {uploadResults.length > 0 && (
            <div className="mt-5 space-y-3 max-h-72 overflow-y-auto">
              <p className="text-xs font-medium text-foreground flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-primary" />
                Results ({uploadResults.length} file{uploadResults.length !== 1 ? 's' : ''})
              </p>
              {uploadResults.map((r, idx) => (
                <div key={idx} className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.02] border border-gray-200">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: r.error ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)' }}>
                    {r.error ? <X className="w-4 h-4 text-red-600" /> : <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{r.fileName}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {r.error
                        ? r.error
                        : `${r.wordCount || 0} words • ${r.assetsGenerated || 0} assets extracted${(r.duplicates?.length || 0) > 0 ? ` • ${r.duplicates.length} duplicate(s)` : ''}`}
                    </p>
                  </div>
                  {r.success && (
                    <Button variant="ghost" size="sm" className="h-7 text-xs text-primary hover:text-primary/80 shrink-0"
                      onClick={() => handleCreateFromUpload(r)}>
                      <Plus className="w-3 h-3 mr-1" />Use
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </GlassDialog>
      )}

      {/* ===== C-12: Enrich from URL Dialog ===== */}
      {showEnrich && (
        <GlassDialog
          title="Enrich from Website"
          subtitle="AI-powered knowledge extraction from any webpage"
          onClose={() => { setShowEnrich(false); setEnrichResult(null); setEnrichUrl(''); }}
          actions={enrichResult?.assets?.length ? (
            <Button size="sm" onClick={handleSaveEnrichedAssets} disabled={enrichSaving} className="text-sm shadow-lg shadow-primary/10">
              {enrichSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Plus className="w-3.5 h-3.5 mr-1.5" />}
              Save All ({enrichResult.assets.length} assets)
            </Button>
          ) : undefined}
        >
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="https://example.com/services"
                value={enrichUrl}
                onChange={e => setEnrichUrl(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleEnrich()}
                className="h-10 text-sm bg-black/[0.03] border-gray-200 focus:border-primary/40 flex-1"
              />
              <Button size="sm" onClick={handleEnrich} disabled={enrichLoading || !enrichUrl.trim()} className="h-10 text-xs gap-1.5">
                {enrichLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                {enrichLoading ? 'Extracting...' : 'Extract'}
              </Button>
            </div>

            {enrichResult?.success && (
              <div className="space-y-4">
                <div className="flex items-center gap-2.5 p-3 rounded-lg bg-emerald-500/[0.06] border border-emerald-500/15">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-foreground">{enrichResult.pageTitle}</p>
                    <p className="text-[11px] text-muted-foreground">{enrichResult.overallSummary?.slice(0, 120)}</p>
                  </div>
                </div>

                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {enrichResult.assets?.map((asset: any, idx: number) => {
                    const CatIcon = CAT_ICON[asset.category] || FileText;
                    return (
                      <div key={idx} className="p-3 rounded-lg bg-white/[0.02] border border-gray-200">
                        <div className="flex items-center gap-2 mb-1.5">
                          <CatIcon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          <p className="text-sm font-medium text-foreground truncate">{asset.title}</p>
                          <Badge variant="outline" className={`text-[9px] ml-auto shrink-0 ${CAT_BADGE[asset.category] || ''}`}>
                            {CAT_LABEL[asset.category] || asset.category}
                          </Badge>
                        </div>
                        <p className="text-[11px] text-muted-foreground line-clamp-2">{asset.summary}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </GlassDialog>
      )}

      {/* ===== C-10: Import Dialog ===== */}
      {showImport && (
        <GlassDialog
          title="Import Capabilities"
          subtitle="Upload a JSON or CSV file with capability assets"
          onClose={() => { setShowImport(false); setImportResult(null); }}
        >
          <div className="space-y-4">
            <div
              className="border-2 border-dashed border-gray-200 rounded-2xl p-8 text-center hover:border-primary/40 transition-all duration-300 cursor-pointer"
              onClick={() => document.getElementById('import-file-input')?.click()}
            >
              <input
                id="import-file-input"
                type="file"
                accept=".json,.csv"
                className="hidden"
                onChange={handleImport}
              />
              <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm font-medium text-foreground">{importLoading ? 'Importing...' : 'Click to select JSON or CSV'}</p>
              {importLoading && <Loader2 className="w-4 h-4 animate-spin text-primary mx-auto mt-2" />}
            </div>

            {importResult && (
              <div className="space-y-3 p-4 rounded-lg bg-white/[0.02] border border-gray-200">
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <p className="text-lg font-bold text-emerald-600">{importResult.created}</p>
                    <p className="text-[10px] text-muted-foreground">Created</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-amber-600">{importResult.skipped}</p>
                    <p className="text-[10px] text-muted-foreground">Skipped</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-red-600">{importResult.errors}</p>
                    <p className="text-[10px] text-muted-foreground">Errors</p>
                  </div>
                </div>
                {importResult.skippedDetails?.length > 0 && (
                  <div className="mt-2 max-h-32 overflow-y-auto">
                    {importResult.skippedDetails.slice(0, 5).map((d: any, i: number) => (
                      <p key={i} className="text-[10px] text-muted-foreground">⊘ {d.title}: {d.reason}</p>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </GlassDialog>
      )}

      {/* ===== Tag Cloud Dialog (C-15) ===== */}
      {showTagCloud && (
        <TagCloudDialog
          items={items}
          onSelectTag={setFilterTag}
          onClose={() => setShowTagCloud(false)}
        />
      )}

      {/* ===== Delete Confirmation ===== */}
      <AlertDialog open={!!deleteId} onOpenChange={open => { if (!open) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <AlertDialogTitle>Delete Capability</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="pl-[52px]">
              Are you sure you want to delete this capability? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteId(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700 text-white">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Info Note at bottom */}
      {navigateTo && (
        <p className="text-xs text-muted-foreground pb-2">
          Capabilities are used by the AI draft engine.{' '}
          <span
            onClick={() => navigateTo('drafts')}
            className="text-primary cursor-pointer hover:text-primary/80 transition-colors underline decoration-primary/30 underline-offset-2"
          >
            View generated drafts
          </span>
        </p>
      )}
    </div>
    </PageTransition>
  );
}