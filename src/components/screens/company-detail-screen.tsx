'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  PageTransition, AnimatedCard, StatCard, GlassPanel,
  EmptyState, StaggerGrid, StaggerItem, SectionHeader,
} from '@/components/ui/animated-components';
import { AIInsightCard } from '@/components/enterprise/AIInsightCard';
import { ConfidenceBar } from '@/components/enterprise/ConfidenceBar';
import { EvidenceBadge } from '@/components/enterprise/EvidenceBadge';
import { AIProgressTracker } from '@/components/enterprise/AIProgressTracker';
import { ErrorState } from '@/components/enterprise/ErrorState';
import { CompanyMindMap } from '@/components/company-mind-map';
import {
  ArrowLeft, ArrowRight, Globe, MapPin, Users, Building2, ExternalLink, Edit3, Save,
  X, Sparkles, Loader2, Pin, Trash2, Plus, FileText, Mail,
  Target, Brain, Activity, TrendingUp, Award, UserCircle, Eye,
  EyeOff, AlertTriangle, CheckCircle2, Clock, MessageSquare,
  Send, MailOpen, RotateCcw, DollarSign, Layers, BookOpen,
  Lightbulb, Bell, Search, ChevronRight, Briefcase, Link2, Network, Database,
} from 'lucide-react';

/* ═══════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════ */
interface CompanyDetailScreenProps {
  companyId: string;
  navigateTo?: (screen: string) => void;
  onBack?: () => void;
}

interface NoteCategory {
  key: string;
  label: string;
}

const NOTE_CATEGORIES: NoteCategory[] = [
  { key: 'all', label: 'All' },
  { key: 'research', label: 'Research' },
  { key: 'call', label: 'Call' },
  { key: 'meeting', label: 'Meeting' },
  { key: 'swot', label: 'SWOT' },
  { key: 'competitive', label: 'Competitive' },
  { key: 'discovery', label: 'Discovery' },
  { key: 'general', label: 'General' },
];

const NOTE_TEMPLATES: Record<string, { title: string; body: string }> = {
  swot: {
    title: 'SWOT Analysis',
    body: `## Strengths\n- \n- \n\n## Weaknesses\n- \n- \n\n## Opportunities\n- \n- \n\n## Threats\n- \n- `,
  },
  discovery: {
    title: 'Discovery Questions',
    body: `## Current State\n1. What are your biggest challenges right now?\n2. What tools/processes are you currently using?\n\n## Pain Points\n1. What would you improve if you could?\n2. What's the cost of not solving this?\n\n## Decision Process\n1. Who else is involved in this decision?\n2. What's your timeline?`,
  },
  competitive: {
    title: 'Competitive Analysis',
    body: `## Competitor 1: \n- Strengths: \n- Weaknesses: \n- Our Advantage: \n\n## Competitor 2: \n- Strengths: \n- Weaknesses: \n- Our Advantage: \n\n## Positioning Strategy\n`,
  },
  call_prep: {
    title: 'Call Prep',
    body: `## Objective\n\n## Key Talking Points\n- \n- \n- \n\n## Objections to Handle\n- \n\n## Next Steps\n- [ ] \n- [ ] `,
  },
  meeting_notes: {
    title: 'Meeting Notes',
    body: `## Meeting Date: \n## Attendees: \n\n## Summary\n\n## Key Decisions\n- \n\n## Action Items\n- [ ] \n- [ ] \n\n## Follow-up Date: `,
  },
};

const STATUS_COLORS: Record<string, string> = {
  prospect: 'bg-blue-500/20 text-blue-600 border-blue-500/30',
  researching: 'bg-amber-500/20 text-amber-600 border-amber-500/30',
  active: 'bg-emerald-500/20 text-emerald-600 border-emerald-500/30',
  engaged: 'bg-purple-500/20 text-purple-600 border-purple-500/30',
  paused: 'bg-gray-500/20 text-gray-600 border-gray-500/30',
  closed_won: 'bg-green-500/20 text-green-400 border-green-500/30',
  closed_lost: 'bg-red-500/20 text-red-600 border-red-500/30',
};

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'bg-red-500/20 text-red-600 border-red-500/30',
  high: 'bg-orange-500/20 text-orange-600 border-orange-500/30',
  medium: 'bg-yellow-500/20 text-yellow-600 border-yellow-500/30',
  low: 'bg-green-500/20 text-green-400 border-green-500/30',
};

const TIMELINE_ICONS: Record<string, React.ReactNode> = {
  email_sent: <Send size={14} className="text-blue-600" />,
  email_opened: <MailOpen size={14} className="text-emerald-600" />,
  email_replied: <MessageSquare size={14} className="text-purple-600" />,
  email_bounced: <RotateCcw size={14} className="text-red-600" />,
  note_added: <FileText size={14} className="text-blue-500" />,
  enrichment: <Sparkles size={14} className="text-blue-500" />,
  status_change: <Activity size={14} className="text-amber-600" />,
  signal: <Bell size={14} className="text-orange-600" />,
  contact_added: <UserCircle size={14} className="text-cyan-600" />,
  research_saved: <BookOpen size={14} className="text-blue-500" />,
};

const INTEL = '#2563eb';

/* ═══════════════════════════════════════════════════
   Score Bar Component
   ═══════════════════════════════════════════════════ */
function ScoreBar({ label, value, max = 100, color = INTEL }: { label: string; value: number; max?: number; color?: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="text-xs font-semibold" style={{ color }}>{pct}%</span>
      </div>
      <div className="h-2 rounded-full overflow-hidden bg-gray-100">
        <motion.div
          className="h-full rounded-full"
          style={{ background: `linear-gradient(90deg, ${color}, ${color}CC)` }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   Note Template Button
   ═══════════════════════════════════════════════════ */
function NoteTemplateItem({ template, onSelect }: { template: { key: string; label: string }; onSelect: (key: string) => void }) {
  return (
    <button
      onClick={() => onSelect(template.key)}
      className="w-full text-left px-3 py-2.5 rounded-lg text-sm hover:bg-gray-100/50 transition-colors flex items-center gap-3 group"
    >
      <FileText size={14} className="text-muted-foreground group-hover:text-[#2563eb] transition-colors" />
      <span className="text-foreground/80 group-hover:text-foreground transition-colors">{template.label}</span>
    </button>
  );
}

/* ═══════════════════════════════════════════════════
   Evidence Panel (Phase 3)
   ═══════════════════════════════════════════════════ */
function EvidencePanel({ companyId }: { companyId: string }) {
  const [evidence, setEvidence] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedField, setSelectedField] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [evRes, sumRes] = await Promise.all([
          fetch(`/api/g-crm/companies/${companyId}/evidence?limit=50`),
          fetch(`/api/g-crm/companies/${companyId}/evidence?summary=true`),
        ]);
        const evData = await evRes.json();
        const sumData = await sumRes.json();
        setEvidence(evData.evidence || []);
        setSummary(sumData.summary || null);
      } catch (err) {
        console.error('[EvidencePanel] fetch failed:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [companyId]);

  if (loading) {
    return <div className="space-y-3"><Skeleton className="h-20 w-full" /><Skeleton className="h-20 w-full" /><Skeleton className="h-20 w-full" /></div>;
  }

  const filteredEvidence = selectedField
    ? evidence.filter((e: any) => e.extractedField === selectedField)
    : evidence;

  const fieldEntries = summary?.fields ? Object.entries(summary.fields) : [];

  return (
    <div className="space-y-4">
      {/* Summary */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-lg border border-border/50 bg-white/50 p-3 text-center">
            <div className="text-2xl font-bold" style={{ color: INTEL }}>{summary.totalEvidence}</div>
            <div className="text-xs text-muted-foreground">Total Sources</div>
          </div>
          {fieldEntries.slice(0, 3).map(([field, data]: [string, any]) => (
            <div key={field} className="rounded-lg border border-border/50 bg-white/50 p-3 text-center">
              <div className="text-2xl font-bold" style={{ color: INTEL }}>{data.count}</div>
              <div className="text-xs text-muted-foreground truncate">{field}</div>
            </div>
          ))}
        </div>
      )}

      {/* Field filter chips */}
      {fieldEntries.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedField(null)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${!selectedField ? 'bg-black text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            All ({summary?.totalEvidence || 0})
          </button>
          {fieldEntries.map(([field, data]: [string, any]) => (
            <button
              key={field}
              onClick={() => setSelectedField(selectedField === field ? null : field)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${selectedField === field ? 'bg-black text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              {field} ({data.count})
            </button>
          ))}
        </div>
      )}

      {/* Evidence list */}
      {filteredEvidence.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Database size={32} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No evidence found. Run research to collect evidence sources.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredEvidence.map((e: any) => (
            <a
              key={e.id}
              href={e.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block rounded-lg border border-border/50 bg-white/50 p-3 hover:bg-gray-50/80 transition-colors group"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {e.sourceQualityTier && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                        e.sourceQualityTier === 'premium' ? 'bg-amber-100 text-amber-700' :
                        e.sourceQualityTier === 'standard' ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {e.sourceQualityTier}
                      </span>
                    )}
                    {e.extractedField && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">{e.extractedField}</span>
                    )}
                    <span className="text-[10px] text-muted-foreground">{e.sourceName || new URL(e.sourceUrl).hostname}</span>
                  </div>
                  <p className="text-xs text-foreground/80 line-clamp-2">{e.snippet || e.sourceTitle}</p>
                  {e.extractedValue && e.extractedValue !== 'Not found' && (
                    <p className="text-xs font-medium mt-1" style={{ color: INTEL }}>→ {e.extractedValue}</p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  {e.confidence > 0 && (
                    <span className="text-[10px] font-medium text-muted-foreground">{Math.round(e.confidence * 100)}%</span>
                  )}
                  <ExternalLink size={12} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   Main Component
   ═══════════════════════════════════════════════════ */
export default function CompanyDetailScreen({ companyId, navigateTo, onBack }: CompanyDetailScreenProps) {
  /* ── State ── */
  const [company, setCompany] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [contacts, setContacts] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [signals, setSignals] = useState<any[]>([]);
  const [timeline, setTimeline] = useState<any[]>([]);
  // Suggested contacts (AI)
  const [suggestedContacts, setSuggestedContacts] = useState<any[]>([]);
  const [loadingSuggested, setLoadingSuggested] = useState(false);

  // Account brief (AI)
  const [brief, setBrief] = useState<any>(null);
  const [briefSources, setBriefSources] = useState<Array<{title: string; url: string; snippet: string}>>([]);

  // AI Intelligence
  const [aiInsights, setAiInsights] = useState<any>(null);
  const [aiIntelligence, setAiIntelligence] = useState<any>(null);
  const [loadingIntel, setLoadingIntel] = useState(false);
  const [intelError, setIntelError] = useState<string | null>(null);
  const [intelSteps, setIntelSteps] = useState<Array<{label: string; status: 'pending' | 'processing' | 'complete' | 'error'}>>([
    { label: 'Gathering company data', status: 'pending' },
    { label: 'Searching live web sources', status: 'pending' },
    { label: 'Analyzing competitive landscape', status: 'pending' },
    { label: 'Generating intelligence report', status: 'pending' },
  ]);
  const [loadingBrief, setLoadingBrief] = useState(false);

  const [activeTab, setActiveTab] = useState('overview');
  const [noteFilter, setNoteFilter] = useState('all');
  const [signalFilter, setSignalFilter] = useState<string | null>(null);

  // Edit mode
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<any>({});

  // Note dialog
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [noteForm, setNoteForm] = useState({ title: '', body: '', category: 'general' });
  const [editingNote, setEditingNote] = useState<any>(null);
  const [expandedNote, setExpandedNote] = useState<string | null>(null);
  const [savingNote, setSavingNote] = useState(false);

  // Enrich
  const [enriching, setEnriching] = useState(false);

  // Template menu
  const [templateMenuOpen, setTemplateMenuOpen] = useState(false);

  /* ── Fetch AI Intelligence ── */
  const fetchIntelligence = useCallback(async () => {
    setLoadingIntel(true);
    setIntelError(null);
    setIntelSteps(prev => prev.map((s, i) => ({ ...s, status: i === 0 ? 'processing' : 'pending' })));
    try {
      await new Promise(r => setTimeout(r, 600));
      setIntelSteps(prev => prev.map((s, i) => ({ ...s, status: i === 0 ? 'complete' : i === 1 ? 'processing' : 'pending' })));
      await new Promise(r => setTimeout(r, 600));
      setIntelSteps(prev => prev.map((s, i) => ({ ...s, status: i <= 1 ? 'complete' : i === 2 ? 'processing' : 'pending' })));
      await new Promise(r => setTimeout(r, 600));
      setIntelSteps(prev => prev.map((s, i) => ({ ...s, status: i <= 2 ? 'complete' : i === 3 ? 'processing' : 'pending' })));
      const res = await fetch(`/api/companies/${companyId}/intelligence`);
      if (!res.ok) throw new Error('Failed to fetch intelligence');
      const data = await res.json();
      setAiInsights(data.aiInsights);
      setAiIntelligence(data);
      setIntelSteps(prev => prev.map(s => ({ ...s, status: 'complete' as const })));
    } catch (err: any) {
      setIntelError(err.message || 'Intelligence analysis failed');
      setIntelSteps(prev => prev.map(s => s.status === 'processing' ? { ...s, status: 'error' as const } : s));
    } finally {
      setLoadingIntel(false);
    }
  }, [companyId]);

  /* ── Fetch Company ── */
  const fetchCompany = useCallback(async () => {
    try {
      const res = await fetch(`/api/companies/${companyId}`);
      if (res.ok) {
        const data = await res.json();
        setCompany(data);
        setEditForm({
          name: data.rawName || data.name,
          industry: data.industry || '',
          sizeRange: data.sizeRange || '',
          location: data.location || '',
          country: data.country || '',
          website: data.website || '',
          status: data.status || 'prospect',
          lifecycleStage: data.lifecycleStage || 'discovery',
          assignedTo: data.assignedTo || '',
          internalSummary: data.internalSummary || '',
        });
      }
    } catch (err) { console.error('[CompanyDetail] fetch company failed:', err); }
  }, [companyId]);

  /* ── Fetch Contacts ── */
  const fetchContacts = useCallback(async () => {
    try {
      const res = await fetch(`/api/companies/${companyId}/contacts`);
      if (res.ok) {
        const data = await res.json();
        setContacts(data.contacts || data || []);
      }
    } catch (err) { console.error('[CompanyDetail] fetch contacts failed:', err); }
  }, [companyId]);

  /* ── Fetch Notes ── */
  const fetchNotes = useCallback(async (category?: string) => {
    try {
      const params = category && category !== 'all' ? `?category=${category}` : '';
      const res = await fetch(`/api/companies/${companyId}/notes${params}`);
      if (res.ok) {
        const data = await res.json();
        setNotes(data.notes || data || []);
      }
    } catch (err) { console.error('[CompanyDetail] fetch notes failed:', err); }
  }, [companyId]);

  /* ── Fetch Signals ── */
  const fetchSignals = useCallback(async (type?: string) => {
    try {
      const params = type ? `?type=${type}` : '';
      const res = await fetch(`/api/companies/${companyId}/signals${params}`);
      if (res.ok) {
        const data = await res.json();
        setSignals(data.signals || data || []);
      }
    } catch (err) { console.error('[CompanyDetail] fetch signals failed:', err); }
  }, [companyId]);

  /* ── Fetch Timeline ── */
  const fetchTimeline = useCallback(async () => {
    try {
      const res = await fetch(`/api/companies/${companyId}/timeline?limit=50`);
      if (res.ok) {
        const data = await res.json();
        setTimeline(data.events || data || []);
      }
    } catch (err) { console.error('[CompanyDetail] fetch timeline failed:', err); }
  }, [companyId]);

  /* ── Initial Load ── */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      await Promise.all([fetchCompany(), fetchContacts(), fetchNotes(), fetchSignals(), fetchTimeline()]);
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [fetchCompany, fetchContacts, fetchNotes, fetchSignals, fetchTimeline]);

  /* ── Refetch notes on filter change ── */
  useEffect(() => {
    let cancelled = false;
    const run = async () => { await fetchNotes(noteFilter); void cancelled; };
    run();
    return () => { cancelled = true; };
  }, [noteFilter, fetchNotes]);

  /* ── Auto-fetch Intelligence when tab activates ── */
  useEffect(() => {
    if (activeTab === 'intelligence' && !aiInsights && !loadingIntel && !intelError) {
      fetchIntelligence();
    }
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Save Company Edit ── */
  const saveCompany = async () => {
    try {
      const res = await fetch(`/api/companies/${companyId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      if (res.ok) {
        setIsEditing(false);
        toast.success('Company updated');
        fetchCompany();
      }
    } catch {
      toast.error('Failed to update company');
    }
  };

  /* ── Enrich Company (async via job queue) ── */
  const handleEnrich = async () => {
    setEnriching(true);
    try {
      const res = await fetch('/api/g-data/jobs/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'enqueue-research', companyIds: [companyId], force: true }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Research job queued — check Command Center for progress');
        // Poll for completion
        const pollInterval = setInterval(async () => {
          try {
            const jobRes = await fetch(`/api/g-data/jobs?companyId=${companyId}&type=research&page=1&pageSize=1`);
            const jobData = await jobRes.json();
            const job = (jobData.jobs || [])[0];
            if (job && (job.status === 'completed' || job.status === 'failed')) {
              clearInterval(pollInterval);
              setEnriching(false);
              if (job.status === 'completed') {
                toast.success('Research completed successfully');
                fetchCompany();
              } else {
                toast.error('Research job failed — check Command Center');
              }
            }
          } catch { /* continue polling */ }
        }, 5000);
      } else {
        toast.error('Failed to queue research');
        setEnriching(false);
      }
    } catch {
      toast.error('Failed to queue research');
      setEnriching(false);
    }
  };

  /* ── Create / Update Note ── */
  const saveNote = async () => {
    if (!noteForm.body.trim()) return;
    setSavingNote(true);
    try {
      if (editingNote) {
        const res = await fetch(`/api/companies/${companyId}/notes/${editingNote.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(noteForm),
        });
        if (res.ok) toast.success('Note updated');
      } else {
        const res = await fetch(`/api/companies/${companyId}/notes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(noteForm),
        });
        if (res.ok) toast.success('Note created');
      }
      setNoteDialogOpen(false);
      setEditingNote(null);
      setNoteForm({ title: '', body: '', category: 'general' });
      fetchNotes(noteFilter);
    } catch {
      toast.error('Failed to save note');
    }
    setSavingNote(false);
  };

  /* ── Delete Note ── */
  const deleteNote = async (noteId: string) => {
    try {
      const res = await fetch(`/api/companies/${companyId}/notes/${noteId}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Note deleted');
        fetchNotes(noteFilter);
      }
    } catch {
      toast.error('Failed to delete note');
    }
  };

  /* ── Toggle Signal Read ── */
  const toggleSignalRead = async (signal: any) => {
    const updated = { ...signal, isRead: !signal.isRead };
    setSignals(prev => prev.map(s => s.id === signal.id ? updated : s));
    try {
      await fetch(`/api/companies/${companyId}/signals/${signal.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isRead: !signal.isRead }),
      });
    } catch (err) { console.error('[CompanyDetail] signal read toggle failed:', err); }
  };

  /* ── Parse helpers ── */
  const parseTags = (tagsStr: string | null | undefined): string[] => {
    if (!tagsStr) return [];
    try { return JSON.parse(tagsStr); } catch (err) { console.error('[CompanyDetail] parse tags failed:', err); return []; }
  };

  const parseTechStack = (tech: string | null | undefined): string[] => {
    if (!tech) return [];
    try {
      const parsed = JSON.parse(tech);
      if (Array.isArray(parsed)) return parsed;
      if (typeof parsed === 'string') return parsed.split(',').map((s: string) => s.trim()).filter(Boolean);
    } catch (err) { console.error('[CompanyDetail] parse tech stack failed:', err); }
    return String(tech).split(',').map(s => s.trim()).filter(Boolean);
  };

  const parseSocials = (socials: string | null | undefined): Record<string, string> => {
    if (!socials) return {};
    try { return JSON.parse(socials); } catch (err) { console.error('[CompanyDetail] parse socials failed:', err); return {}; }
  };

  const researchCard = company?.researchCard;
  const tags = parseTags(company?.tags);
  const techStack = parseTechStack(researchCard?.techStack);
  const socials = parseSocials(researchCard?.socialProfiles);
  const companyName = company?.rawName || company?.name || 'Loading...';
  const status = company?.status || 'prospect';

  /* ═══════════════════════════════════════════════════
     Loading State
     ═══════════════════════════════════════════════════ */
  if (loading) {
    return (
      <div className="p-6 space-y-6" style={{ background: '#FAFAFA', minHeight: '100vh' }}>
        <div className="flex items-center gap-4">
          <Skeleton className="w-8 h-8 rounded-lg" />
          <Skeleton className="h-8 w-64" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="h-96 rounded-xl" />
          <Skeleton className="h-96 rounded-xl col-span-2" />
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════
     Render
     ═══════════════════════════════════════════════════ */
  return (
    <div style={{ background: '#FAFAFA' }} className="min-h-screen">
    <PageTransition className="min-h-screen">
      {/* ── Header ── */}
      <div className="sticky top-0 z-30 px-6 py-4 border-b border-gray-200" style={{ background: 'rgba(6,9,15,0.85)', backdropFilter: 'blur(20px)' }}>
        <div className="flex items-center justify-between max-w-[1400px] mx-auto">
          <div className="flex items-center gap-4">
            <motion.button
              whileHover={{ x: -2 }}
              whileTap={{ scale: 0.95 }}
              onClick={onBack}
              className="w-9 h-9 rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center hover:border-[#2563eb]/30 transition-colors"
            >
              <ArrowLeft size={16} className="text-muted-foreground" />
            </motion.button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-blue-50 border border-blue-100">
                <Building2 size={20} style={{ color: INTEL }} />
              </div>
              <div>
                <h1 className="text-lg font-bold text-foreground">{companyName}</h1>
                <div className="flex items-center gap-2 mt-0.5">
                  {company?.domain && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Globe size={10} /> {company.domain}
                    </span>
                  )}
                  <Badge className={`text-[10px] px-1.5 py-0 ${STATUS_COLORS[status] || 'bg-gray-500/20 text-gray-600'}`}>
                    {status.replace(/_/g, ' ')}
                  </Badge>
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleEnrich}
              disabled={enriching}
              className="gap-2 text-xs border-gray-200 hover:border-[#2563eb]/30 hover:bg-[#2563eb]/5"
            >
              {enriching ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} style={{ color: INTEL }} />}
              {enriching ? 'Enriching...' : 'AI Enrich'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditing(!isEditing)}
              className="gap-2 text-xs border-gray-200 hover:border-[#2563eb]/30 hover:bg-[#2563eb]/5"
            >
              {isEditing ? <X size={13} /> : <Edit3 size={13} style={{ color: INTEL }} />}
              {isEditing ? 'Cancel' : 'Edit'}
            </Button>
            {isEditing && (
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
                <Button size="sm" onClick={saveCompany} className="gap-2 text-xs" style={{ background: INTEL, color: '#FAFAFA' }}>
                  <Save size={13} /> Save
                </Button>
              </motion.div>
            )}
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="max-w-[1400px] mx-auto px-6 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-gray-50 border border-gray-200 rounded-xl p-1 h-auto flex-wrap gap-1">
            {[
              { key: 'overview', label: 'Overview', icon: Building2 },
              { key: 'intelligence', label: 'Intelligence', icon: Sparkles },
              { key: 'mindmap', label: 'Mind Map', icon: Brain },
              { key: 'notes', label: 'Notes', icon: FileText, count: company?._count?.notes || notes.length },
              { key: 'contacts', label: 'Contacts', icon: Users, count: company?._count?.contacts || contacts.length },
              { key: 'timeline', label: 'Timeline', icon: Clock },
              { key: 'signals', label: 'Signals', icon: Bell, count: signals.length },
              { key: 'brief', label: 'Account Brief', icon: Sparkles },
              { key: 'stakeholders', label: 'AI Stakeholders', icon: Network },
              { key: 'evidence', label: 'Evidence', icon: Database },
            ].map(tab => (
              <TabsTrigger
                key={tab.key}
                value={tab.key}
                className="data-[state=active]:bg-blue-500/10 data-[state=active]:text-blue-600 data-[state=active]:border-blue-500/25 rounded-lg px-4 py-2 text-xs gap-2 border border-transparent transition-all"
              >
                <tab.icon size={14} />
                {tab.label}
                {tab.count !== undefined && tab.count > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-muted-foreground data-[state=active]:bg-blue-500/15 data-[state=active]:text-blue-600">
                    {tab.count}
                  </span>
                )}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* ═════════════════════════════════════════════
              TAB 1: Overview
              ═════════════════════════════════════════════ */}
          <TabsContent value="overview" className="space-y-6 mt-2">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Company Profile Card */}
              <AnimatedCard className="lg:col-span-1" delay={0}>
                <div className="p-5 space-y-5">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="h-5 w-1.5 rounded-full" style={{ background: `linear-gradient(180deg, #60a5fa, ${INTEL})` }} />
                    <h3 className="text-sm font-bold text-foreground">Company Profile</h3>
                  </div>

                  {isEditing ? (
                    <div className="space-y-3">
                      <div>
                        <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Name</label>
                        <Input value={editForm.name} onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))} className="mt-1 h-8 text-xs bg-gray-50 border-gray-200" />
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Industry</label>
                        <Input value={editForm.industry} onChange={e => setEditForm(p => ({ ...p, industry: e.target.value }))} className="mt-1 h-8 text-xs bg-gray-50 border-gray-200" />
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Size Range</label>
                        <Input value={editForm.sizeRange} onChange={e => setEditForm(p => ({ ...p, sizeRange: e.target.value }))} className="mt-1 h-8 text-xs bg-gray-50 border-gray-200" />
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Location</label>
                        <Input value={editForm.location} onChange={e => setEditForm(p => ({ ...p, location: e.target.value }))} className="mt-1 h-8 text-xs bg-gray-50 border-gray-200" />
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Country</label>
                        <Input value={editForm.country} onChange={e => setEditForm(p => ({ ...p, country: e.target.value }))} className="mt-1 h-8 text-xs bg-gray-50 border-gray-200" />
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Website</label>
                        <Input value={editForm.website} onChange={e => setEditForm(p => ({ ...p, website: e.target.value }))} className="mt-1 h-8 text-xs bg-gray-50 border-gray-200" />
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Assigned To</label>
                        <Input value={editForm.assignedTo} onChange={e => setEditForm(p => ({ ...p, assignedTo: e.target.value }))} className="mt-1 h-8 text-xs bg-gray-50 border-gray-200" />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {company?.industry && (
                        <div className="flex items-center gap-2 text-xs">
                          <Briefcase size={13} className="text-muted-foreground" />
                          <span className="text-muted-foreground">Industry:</span>
                          <span className="text-foreground font-medium">{company.industry}</span>
                        </div>
                      )}
                      {company?.sizeRange && (
                        <div className="flex items-center gap-2 text-xs">
                          <Users size={13} className="text-muted-foreground" />
                          <span className="text-muted-foreground">Size:</span>
                          <span className="text-foreground font-medium">{company.sizeRange}</span>
                        </div>
                      )}
                      {(company?.location || company?.country) && (
                        <div className="flex items-center gap-2 text-xs">
                          <MapPin size={13} className="text-muted-foreground" />
                          <span className="text-foreground font-medium">{[company.location, company.country].filter(Boolean).join(', ')}</span>
                        </div>
                      )}
                      {company?.website && (
                        <div className="flex items-center gap-2 text-xs">
                          <Link2 size={13} className="text-muted-foreground" />
                          <a href={company.website.startsWith('http') ? company.website : `https://${company.website}`} target="_blank" rel="noopener noreferrer" className="font-medium hover:underline" style={{ color: INTEL }}>
                            {company.website}
                          </a>
                          <ExternalLink size={10} className="text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-xs">
                        <Activity size={13} className="text-muted-foreground" />
                        <span className="text-muted-foreground">Lifecycle:</span>
                        <Badge className="text-[10px] px-1.5 py-0 bg-gray-100/50 border-gray-200 text-foreground">
                          {(company?.lifecycleStage || 'discovery').replace(/_/g, ' ')}
                        </Badge>
                      </div>
                      {company?.assignedTo && (
                        <div className="flex items-center gap-2 text-xs">
                          <UserCircle size={13} className="text-muted-foreground" />
                          <span className="text-muted-foreground">Assigned:</span>
                          <span className="text-foreground font-medium">{company.assignedTo}</span>
                        </div>
                      )}

                      {/* Tags */}
                      {tags.length > 0 && (
                        <div className="pt-2">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Tags</p>
                          <div className="flex flex-wrap gap-1.5">
                            {tags.map((tag: string, i: number) => (
                              <Badge key={i} variant="outline" className="text-[10px] px-2 py-0 border-gray-200 text-foreground/70">{tag}</Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Scores */}
                  <div className="space-y-3 pt-3 border-t border-gray-200">
                    <ScoreBar label="Intelligence Score" value={company?.intelligenceScore || 0} color={INTEL} />
                    <ScoreBar label="Engagement Score" value={company?.engagementScore || 0} color="#3b82f6" />
                  </div>

                  {/* Internal Summary */}
                  {isEditing ? (
                    <div className="pt-2">
                      <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Internal Summary</label>
                      <Textarea
                        value={editForm.internalSummary}
                        onChange={e => setEditForm(p => ({ ...p, internalSummary: e.target.value }))}
                        className="mt-1 text-xs min-h-[80px] bg-gray-50 border-gray-200 resize-none"
                      />
                    </div>
                  ) : company?.internalSummary ? (
                    <div className="pt-3 border-t border-gray-200">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">Internal Summary</p>
                      <p className="text-xs text-foreground/70 leading-relaxed">{company.internalSummary}</p>
                    </div>
                  ) : null}
                </div>
              </AnimatedCard>

              {/* Research Card */}
              <AnimatedCard className="lg:col-span-2" delay={0.1}>
                <div className="p-5 space-y-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-5 w-1.5 rounded-full" style={{ background: `linear-gradient(180deg, #60a5fa, ${INTEL})` }} />
                      <h3 className="text-sm font-bold text-foreground">Research Intelligence</h3>
                    </div>
                    {researchCard && (
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Clock size={10} />
                        {researchCard.enrichmentDate ? new Date(researchCard.enrichmentDate).toLocaleDateString() : 'N/A'}
                      </span>
                    )}
                  </div>

                  {/* Phase 3: Enrichment metadata */}
                  {researchCard && (
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[10px] text-muted-foreground">Last enriched</span>
                      <span className="text-[10px] font-medium">{researchCard.enrichmentDate ? new Date(researchCard.enrichmentDate).toLocaleDateString() : 'N/A'}</span>
                    </div>
                  )}
                  {researchCard?.enrichmentSource && (
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] text-muted-foreground">Source</span>
                      <span className="text-[10px] font-medium">{researchCard.enrichmentSource}</span>
                    </div>
                  )}
                  {/* Phase 3: Per-field confidence */}
                  {researchCard?.fieldConfidence && (() => {
                    try {
                      const fc = JSON.parse(researchCard.fieldConfidence) as Record<string, number>;
                      const entries = Object.entries(fc).filter(([, v]) => v > 0);
                      if (entries.length === 0) return null;
                      return (
                        <div className="mt-3 space-y-2">
                          <span className="text-[10px] text-muted-foreground font-medium">Field Confidence</span>
                          {entries.slice(0, 6).map(([field, conf]) => (
                            <ScoreBar key={field} label={field} value={Math.round(conf * 100)} max={100} color={conf >= 0.7 ? '#22c55e' : conf >= 0.4 ? INTEL : '#ef4444'} />
                          ))}
                        </div>
                      );
                    } catch { return null; }
                  })()}

                  {!researchCard ? (
                    <EmptyState
                      icon={BookOpen}
                      title="No Research Data"
                      description="Enrich this company to generate AI-powered research intelligence."
                      action={
                        <Button size="sm" onClick={handleEnrich} disabled={enriching} className="gap-2 text-xs" style={{ background: INTEL, color: '#FAFAFA' }}>
                          {enriching ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                          Enrich Now
                        </Button>
                      }
                    />
                  ) : (
                    <div className="space-y-4">
                      {researchCard.businessOverview && (
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                            <Building2 size={10} /> Business Overview
                          </p>
                          <p className="text-xs text-foreground/70 leading-relaxed bg-gray-50 rounded-lg p-3 border border-gray-200">{researchCard.businessOverview}</p>
                        </div>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {researchCard.techLandscape && (
                          <div>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                              <Layers size={10} /> Tech Landscape
                            </p>
                            <p className="text-xs text-foreground/70 leading-relaxed bg-gray-50 rounded-lg p-3 border border-gray-200">{researchCard.techLandscape}</p>
                          </div>
                        )}
                        {researchCard.potentialChallenges && (
                          <div>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                              <AlertTriangle size={10} /> Challenges
                            </p>
                            <p className="text-xs text-foreground/70 leading-relaxed bg-gray-50 rounded-lg p-3 border border-gray-200">{researchCard.potentialChallenges}</p>
                          </div>
                        )}
                        {researchCard.possibleOpportunities && (
                          <div>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                              <Lightbulb size={10} /> Opportunities
                            </p>
                            <p className="text-xs text-foreground/70 leading-relaxed bg-gray-50 rounded-lg p-3 border border-gray-200">{researchCard.possibleOpportunities}</p>
                          </div>
                        )}
                        {researchCard.relevantServices && (
                          <div>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                              <Target size={10} /> Relevant Services
                            </p>
                            <p className="text-xs text-foreground/70 leading-relaxed bg-gray-50 rounded-lg p-3 border border-gray-200">{researchCard.relevantServices}</p>
                          </div>
                        )}
                      </div>

                      {researchCard.keyDecisionMakers && (
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                            <Award size={10} /> Key Decision Makers
                          </p>
                          <p className="text-xs text-foreground/70 leading-relaxed bg-gray-50 rounded-lg p-3 border border-gray-200">{researchCard.keyDecisionMakers}</p>
                        </div>
                      )}

                      {/* Enrichment Metadata */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2">
                        {[
                          { label: 'Revenue', value: researchCard.revenue, icon: DollarSign },
                          { label: 'Employees', value: researchCard.employeeCount, icon: Users },
                          { label: 'Funding', value: researchCard.fundingStage, icon: TrendingUp },
                          { label: 'Source', value: researchCard.enrichmentSource || 'N/A', icon: Search },
                        ].map((item, i) => (
                          <div key={i} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                            <div className="flex items-center gap-1.5 mb-1">
                              <item.icon size={10} className="text-muted-foreground" />
                              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{item.label}</span>
                            </div>
                            <p className="text-xs font-semibold text-foreground">{item.value || 'N/A'}</p>
                          </div>
                        ))}
                      </div>

                      {/* Tech Stack Tags */}
                      {techStack.length > 0 && (
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            <Layers size={10} /> Tech Stack
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {techStack.map((tech: string, i: number) => (
                              <Badge key={i} variant="outline" className="text-[10px] px-2 py-0 border-[#2563eb]/20 text-[#2563eb]/80">{tech}</Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Social Profiles */}
                      {Object.keys(socials).length > 0 && (
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            <Globe size={10} /> Social Profiles
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {Object.entries(socials).map(([platform, url]) => (
                              <a key={platform} href={url as string} target="_blank" rel="noopener noreferrer"
                                className="text-xs px-2.5 py-1.5 rounded-lg bg-gray-50 border border-gray-200 hover:border-[#2563eb]/30 transition-colors flex items-center gap-1.5 text-foreground/70 hover:text-foreground"
                              >
                                <ExternalLink size={10} />
                                <span className="capitalize">{platform}</span>
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </AnimatedCard>
            </div>
          </TabsContent>

          {/* ═════════════════════════════════════════════
              TAB 1.5: Intelligence (AI)
              ════════════════════════════════════════════ */}
          <TabsContent value="intelligence" className="mt-2 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Sparkles size={16} className="text-blue-600" />
                  AI Intelligence Profile
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">Evidence-backed intelligence with full reasoning chain</p>
              </div>
              {!aiInsights && !loadingIntel && (
                <Button size="sm" onClick={fetchIntelligence} className="bg-blue-600 hover:bg-blue-700 text-white text-xs gap-2">
                  <Sparkles size={14} /> Analyze Company
                </Button>
              )}
              {aiInsights && (
                <Button size="sm" onClick={fetchIntelligence} variant="outline" className="gap-2 text-xs border-blue-200 hover:bg-blue-50">
                  <RotateCcw size={13} /> Re-analyze
                </Button>
              )}
            </div>

            {loadingIntel ? (
              <AnimatedCard>
                <div className="p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Loader2 size={16} className="text-blue-600 animate-spin" />
                    <span className="text-sm font-medium text-foreground">Gathering intelligence with web search + AI analysis...</span>
                  </div>
                  <AIProgressTracker steps={intelSteps} />
                </div>
              </AnimatedCard>
            ) : intelError ? (
              <AnimatedCard>
                <div className="p-6">
                  <ErrorState
                    title="Intelligence Analysis Failed"
                    message={intelError}
                    onRetry={fetchIntelligence}
                  />
                </div>
              </AnimatedCard>
            ) : aiInsights ? (
              <div className="space-y-6">
                {/* ── Company Understanding ── */}
                <AnimatedCard delay={0}>
                  <div className="p-5 space-y-4">
                    <div className="flex items-center gap-2">
                      <div className="h-5 w-1.5 rounded-full bg-blue-500" />
                      <h4 className="text-xs font-bold text-blue-600 uppercase tracking-wider flex items-center gap-1.5">
                        <Building2 size={12} /> Company Understanding
                      </h4>
                    </div>
                    {aiInsights.companyUnderstanding ? (
                      <div className="space-y-3">
                        <p className="text-sm text-foreground/80 leading-relaxed">{aiInsights.companyUnderstanding.overview}</p>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                          {aiInsights.companyUnderstanding.industryClassification && (
                            <div className="p-2.5 rounded-lg bg-gray-50 border border-gray-200">
                              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Industry</p>
                              <p className="text-xs font-medium text-foreground mt-0.5">{aiInsights.companyUnderstanding.industryClassification}</p>
                            </div>
                          )}
                          {aiInsights.companyUnderstanding.businessModel && (
                            <div className="p-2.5 rounded-lg bg-gray-50 border border-gray-200">
                              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Business Model</p>
                              <p className="text-xs font-medium text-foreground mt-0.5">{aiInsights.companyUnderstanding.businessModel}</p>
                            </div>
                          )}
                          {aiInsights.companyUnderstanding.geographicPresence && (
                            <div className="p-2.5 rounded-lg bg-gray-50 border border-gray-200">
                              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Geography</p>
                              <p className="text-xs font-medium text-foreground mt-0.5">{aiInsights.companyUnderstanding.geographicPresence}</p>
                            </div>
                          )}
                        </div>
                        {(aiInsights.companyUnderstanding.revenueIndicators?.length > 0) && (
                          <div className="space-y-1.5">
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Revenue Indicators</p>
                            <div className="space-y-1">
                              {aiInsights.companyUnderstanding.revenueIndicators.map((ri: string, i: number) => (
                                <div key={i} className="flex items-start gap-2">
                                  <DollarSign size={11} className="text-emerald-600 shrink-0 mt-0.5" />
                                  <p className="text-xs text-foreground/70">{ri}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {(aiInsights.companyUnderstanding.employeeSignals?.length > 0) && (
                          <div className="space-y-1.5">
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Employee Signals</p>
                            <div className="space-y-1">
                              {aiInsights.companyUnderstanding.employeeSignals.map((es: string, i: number) => (
                                <div key={i} className="flex items-start gap-2">
                                  <Users size={11} className="text-blue-600 shrink-0 mt-0.5" />
                                  <p className="text-xs text-foreground/70">{es}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-foreground/80 leading-relaxed">{aiInsights.businessOverview}</p>
                    )}
                    <div className="flex items-center gap-3 pt-1">
                      <ConfidenceBar value={aiInsights.dataQuality?.overallConfidence ?? company?.intelligenceScore ?? 70} label="Overall Confidence" size="sm" />
                      {aiInsights.dataQuality && (
                        <span className="text-[10px] text-muted-foreground">
                          {aiInsights.dataQuality.webSourcesUsed} web sources | {aiInsights.dataQuality.crmSignalsUsed} CRM signals
                        </span>
                      )}
                    </div>
                  </div>
                </AnimatedCard>

                {/* ── Evidence-Backed Business Signals ── */}
                {aiInsights.businessSignals && aiInsights.businessSignals.length > 0 && (
                  <AnimatedCard delay={0.1}>
                    <div className="p-5 space-y-4">
                      <div className="flex items-center gap-2">
                        <div className="h-5 w-1.5 rounded-full bg-amber-500" />
                        <h4 className="text-xs font-bold text-amber-600 uppercase tracking-wider flex items-center gap-1.5">
                          <Bell size={12} /> Business Signals — Evidence Chain
                        </h4>
                        <Badge className="text-[10px] bg-amber-100 text-amber-700 border-amber-200">{aiInsights.businessSignals.length}</Badge>
                      </div>
                      <div className="space-y-3">
                        {aiInsights.businessSignals.map((sig: any, i: number) => (
                          <div key={i} className="p-3 rounded-lg border border-amber-100 bg-amber-50/30 space-y-2">
                            <div className="flex items-start justify-between gap-3">
                              <p className="text-xs font-medium text-foreground flex-1">{sig.signal}</p>
                              <div className="flex items-center gap-2 shrink-0">
                                <ConfidenceBar value={sig.confidence || 50} size="sm" className="max-w-[80px]" />
                                <span className="text-[10px] font-semibold" style={{ color: sig.confidence >= 75 ? '#16a34a' : sig.confidence >= 50 ? '#ca8a04' : '#dc2626' }}>
                                  {sig.confidence || 50}%
                                </span>
                              </div>
                            </div>
                            {sig.whyDetected && (
                              <p className="text-[11px] text-foreground/60 pl-3 border-l-2 border-amber-200">
                                <span className="font-medium text-amber-700">Why detected:</span> {sig.whyDetected}
                              </p>
                            )}
                            <div className="flex items-center gap-4 pl-3 text-[10px]">
                              {sig.evidenceSource && <span className="text-muted-foreground">Source: <span className="font-medium text-foreground/70">{sig.evidenceSource}</span></span>}
                              {sig.sourceDate && <span className="text-muted-foreground">Date: <span className="font-medium text-foreground/70">{sig.sourceDate}</span></span>}
                              {sig.evidenceUrl && (
                                <a href={sig.evidenceUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-blue-600 hover:underline">
                                  <ExternalLink size={10} /> Verify
                                </a>
                              )}
                            </div>
                            {sig.businessImpact && (
                              <p className="text-[11px] text-foreground/60 pl-3">
                                <span className="font-medium text-blue-600">Impact:</span> {sig.businessImpact}
                              </p>
                            )}
                            {sig.recommendedAction && (
                              <div className="ml-3 px-2.5 py-1.5 rounded-md bg-blue-50 border border-blue-100 text-[11px] text-blue-800">
                                <span className="font-medium">Action:</span> {sig.recommendedAction}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </AnimatedCard>
                )}

                {/* ── Key Developments with Evidence ── */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {aiInsights.keyDevelopments && aiInsights.keyDevelopments.length > 0 && typeof aiInsights.keyDevelopments[0] === 'object' ? (
                    <AnimatedCard delay={0.15}>
                      <div className="p-5 space-y-4">
                        <div className="flex items-center gap-2">
                          <div className="h-5 w-1.5 rounded-full bg-emerald-500" />
                          <h4 className="text-xs font-bold text-emerald-600 uppercase tracking-wider flex items-center gap-1.5">
                            <TrendingUp size={12} /> Key Developments
                          </h4>
                        </div>
                        <div className="space-y-3">
                          {aiInsights.keyDevelopments.map((dev: any, i: number) => (
                            <div key={i} className="p-3 rounded-lg bg-emerald-50/30 border border-emerald-100 space-y-2">
                              <div className="flex items-start justify-between gap-2">
                                <p className="text-xs font-medium text-foreground flex-1">{dev.signal || dev.text || dev}</p>
                                <ConfidenceBar value={dev.confidence || 70} size="sm" className="max-w-[70px] shrink-0" />
                              </div>
                              {(dev.whyDetected || dev.evidenceSource) && (
                                <p className="text-[11px] text-foreground/60 pl-3 border-l-2 border-emerald-200">
                                  {dev.whyDetected || `Source: ${dev.evidenceSource || 'web intelligence'}`}
                                </p>
                              )}
                              {dev.recommendedAction && (
                                <div className="ml-3 px-2.5 py-1.5 rounded-md bg-emerald-50 border border-emerald-100 text-[11px] text-emerald-800">
                                  <span className="font-medium">Action:</span> {dev.recommendedAction}
                                </div>
                              )}
                              {dev.evidenceUrl && (
                                <a href={dev.evidenceUrl} target="_blank" rel="noopener noreferrer" className="ml-3 flex items-center gap-1 text-[10px] text-blue-600 hover:underline">
                                  <ExternalLink size={10} /> {dev.evidenceSource || dev.evidenceUrl}
                                </a>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </AnimatedCard>
                  ) : (
                    <AnimatedCard delay={0.1}>
                      <div className="p-5 space-y-4">
                        <div className="flex items-center gap-2">
                          <div className="h-5 w-1.5 rounded-full bg-amber-500" />
                          <h4 className="text-xs font-bold text-amber-600 uppercase tracking-wider flex items-center gap-1.5">
                            <TrendingUp size={12} /> Key Developments
                          </h4>
                        </div>
                        <div className="space-y-3">
                          {(aiInsights.keyDevelopments || []).map((dev: any, i: number) => {
                            const text = typeof dev === 'string' ? dev : dev.text || dev.description || dev.signal || '';
                            const conf = typeof dev === 'object' ? (dev.confidence ?? 70) : 75;
                            return text ? (
                              <div key={i} className="p-3 rounded-lg bg-amber-50/50 border border-amber-100">
                                <p className="text-xs text-foreground/80 leading-relaxed">{text}</p>
                                <div className="flex items-center gap-3 mt-2">
                                  <EvidenceBadge source={dev.evidenceSource || dev.source || 'web'} confidence={conf} />
                                  <ConfidenceBar value={Math.min(conf, 98)} size="sm" className="flex-1 max-w-[120px]" />
                                </div>
                              </div>
                            ) : null;
                          })}
                          {!aiInsights.keyDevelopments?.length && <p className="text-xs text-muted-foreground italic py-2">No developments detected yet.</p>}
                        </div>
                      </div>
                    </AnimatedCard>
                  )}

                  {/* ── Challenges ── */}
                  <AnimatedCard delay={0.2}>
                    <div className="p-5 space-y-4">
                      <div className="flex items-center gap-2">
                        <div className="h-5 w-1.5 rounded-full bg-red-400" />
                        <h4 className="text-xs font-bold text-red-500 uppercase tracking-wider flex items-center gap-1.5">
                          <AlertTriangle size={12} /> Current Challenges
                        </h4>
                      </div>
                      <div className="space-y-3">
                        {(aiInsights.potentialChallenges || []).length === 0 && (
                          <p className="text-xs text-muted-foreground italic py-2">No challenges identified. AI analysis will surface potential friction points.</p>
                        )}
                        {(aiInsights.potentialChallenges || []).map((ch: string, i: number) => (
                          <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-red-50/50 border border-red-100">
                            <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-100 text-[10px] font-bold text-red-600">{i + 1}</div>
                            <p className="text-xs text-foreground/80 leading-relaxed">{ch}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </AnimatedCard>
                </div>

                {/* ── Technology Intelligence ── */}
                {aiInsights.technologyIntelligence && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <AnimatedCard delay={0.25}>
                      <div className="p-5 space-y-4">
                        <div className="flex items-center gap-2">
                          <div className="h-5 w-1.5 rounded-full bg-blue-500" />
                          <h4 className="text-xs font-bold text-blue-600 uppercase tracking-wider flex items-center gap-1.5">
                            <Layers size={12} /> Technology Stack
                          </h4>
                        </div>
                        {aiInsights.technologyIntelligence.digitalMaturity && (
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-[10px] text-muted-foreground">Digital Maturity:</span>
                            <Badge className={`text-[10px] px-2 py-0 ${
                              aiInsights.technologyIntelligence.digitalMaturity === 'advanced' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                              aiInsights.technologyIntelligence.digitalMaturity === 'high' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                              aiInsights.technologyIntelligence.digitalMaturity === 'medium' ? 'bg-amber-100 text-amber-700 border-amber-200' :
                              'bg-red-100 text-red-700 border-red-200'
                            }`}>{aiInsights.technologyIntelligence.digitalMaturity}</Badge>
                          </div>
                        )}
                        {aiInsights.technologyIntelligence.cloudUsage && (
                          <p className="text-xs text-foreground/60 mb-2"><span className="font-medium">Cloud:</span> {aiInsights.technologyIntelligence.cloudUsage}</p>
                        )}
                        <div className="flex flex-wrap gap-2">
                          {(aiInsights.technologyIntelligence.techStack || aiInsights.techStack || []).length === 0 && (
                            <p className="text-xs text-muted-foreground italic">No technologies detected.</p>
                          )}
                          {(aiInsights.technologyIntelligence.techStack || aiInsights.techStack || []).map((tech: string, i: number) => (
                            <Badge key={i} variant="outline" className="text-xs px-3 py-1 border-blue-200 text-blue-700 bg-blue-50/50">{tech}</Badge>
                          ))}
                        </div>
                        {/* Engineering Signals with evidence */}
                        {aiInsights.technologyIntelligence.engineeringSignals?.length > 0 && (
                          <div className="space-y-2 mt-3 pt-3 border-t border-gray-200">
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Engineering Signals</p>
                            {aiInsights.technologyIntelligence.engineeringSignals.map((es: any, i: number) => (
                              <div key={i} className="p-2.5 rounded-lg bg-blue-50/30 border border-blue-100 space-y-1">
                                <div className="flex items-start justify-between gap-2">
                                  <p className="text-[11px] font-medium text-foreground">{es.signal}</p>
                                  <span className="text-[10px] font-medium text-blue-600">{es.confidence}%</span>
                                </div>
                                {es.evidence && <p className="text-[10px] text-foreground/50">{es.evidence}</p>}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </AnimatedCard>

                    {/* ── Competitive Landscape ── */}
                    <AnimatedCard delay={0.3}>
                      <div className="p-5 space-y-4">
                        <div className="flex items-center gap-2">
                          <div className="h-5 w-1.5 rounded-full bg-sky-500" />
                          <h4 className="text-xs font-bold text-sky-600 uppercase tracking-wider flex items-center gap-1.5">
                            <Target size={12} /> Competitive Landscape
                          </h4>
                        </div>
                        <div className="space-y-2">
                          {(aiInsights.competitors || []).length === 0 && (
                            <p className="text-xs text-muted-foreground italic">No competitors identified.</p>
                          )}
                          {(aiInsights.competitors || []).map((comp: any, i: number) => {
                            const name = typeof comp === 'string' ? comp : comp.name || 'Unknown';
                            const threat = comp.threat || 'medium';
                            const evidence = comp.evidence || '';
                            return (
                              <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg bg-sky-50/30 border border-sky-100">
                                <div className="w-7 h-7 rounded-full bg-sky-100 flex items-center justify-center text-[10px] font-bold text-sky-700 shrink-0">{i + 1}</div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-medium text-foreground">{name}</p>
                                  {evidence && <p className="text-[10px] text-muted-foreground line-clamp-1">{evidence}</p>}
                                </div>
                                <Badge className={`text-[9px] px-1.5 py-0 ${
                                  threat === 'high' ? 'bg-red-100 text-red-700' :
                                  threat === 'medium' ? 'bg-amber-100 text-amber-700' :
                                  'bg-green-100 text-green-700'
                                }`}>{threat}</Badge>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </AnimatedCard>
                  </div>
                )}

                {/* ── Outreach Strategy with Evidence ── */}
                <AnimatedCard delay={0.35}>
                  <div className="p-5 rounded-xl bg-gradient-to-br from-blue-50 to-blue-100/50 border border-blue-200">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-500">
                        <Lightbulb size={16} className="text-white" />
                      </div>
                      <div className="space-y-2 flex-1">
                        <h4 className="text-xs font-bold text-blue-800 uppercase tracking-wider">Recommended Engagement Strategy</h4>
                        {typeof aiInsights.outreachAngle === 'object' ? (
                          <div className="space-y-2">
                            <p className="text-sm text-blue-900/80 leading-relaxed">{aiInsights.outreachAngle?.angle || 'Not determined'}</p>
                            {aiInsights.outreachAngle?.rationale && (
                              <p className="text-xs text-blue-800/60"><span className="font-medium">Rationale:</span> {aiInsights.outreachAngle.rationale}</p>
                            )}
                            {aiInsights.outreachAngle?.evidence && (
                              <p className="text-[11px] text-blue-800/50"><span className="font-medium">Evidence:</span> {aiInsights.outreachAngle.evidence}</p>
                            )}
                            {aiInsights.outreachAngle?.recommendedApproach && (
                              <div className="px-3 py-2 rounded-lg bg-white/50 border border-blue-200 mt-1">
                                <p className="text-[10px] text-blue-700 uppercase tracking-wider font-medium">Approach</p>
                                <p className="text-xs text-blue-900">{aiInsights.outreachAngle.recommendedApproach}</p>
                              </div>
                            )}
                            {aiInsights.outreachAngle?.targetStakeholders?.length > 0 && (
                              <div className="mt-2 space-y-1.5">
                                <p className="text-[10px] text-blue-700 uppercase tracking-wider font-medium">Target Stakeholders</p>
                                {aiInsights.outreachAngle.targetStakeholders.map((ts: any, i: number) => (
                                  <div key={i} className="flex items-start gap-2 p-2 rounded-md bg-white/40">
                                    <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center text-[9px] font-bold text-blue-600 shrink-0 mt-0.5">{ts.role?.charAt(0)}</div>
                                    <div>
                                      <p className="text-xs font-medium text-blue-900">{ts.role}</p>
                                      <p className="text-[10px] text-blue-700/60">{ts.focus}{ts.whyRelevant ? ` — ${ts.whyRelevant}` : ''}</p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ) : (
                          <p className="text-sm text-blue-900/80 leading-relaxed">{aiInsights.outreachAngle || 'Run analysis to receive a personalized engagement recommendation.'}</p>
                        )}
                      </div>
                    </div>
                  </div>
                </AnimatedCard>

                {/* ── Source Citations ── */}
                {aiInsights.webFindings && aiInsights.webFindings.length > 0 && (
                  <AnimatedCard delay={0.4}>
                    <div className="p-5 space-y-3">
                      <div className="flex items-center gap-2">
                        <div className="h-5 w-1.5 rounded-full bg-emerald-500" />
                        <h4 className="text-xs font-bold text-emerald-600 uppercase tracking-wider flex items-center gap-1.5">
                          <Globe size={12} /> Source Citations ({aiInsights.webFindings.length})
                        </h4>
                      </div>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {aiInsights.webFindings.map((src: any, i: number) => {
                          let domain = '';
                          try { domain = new URL(src.url).hostname.replace('www.', ''); } catch { domain = src.url; }
                          return (
                            <a key={i} href={src.url} target="_blank" rel="noopener noreferrer"
                              className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-gray-50 transition-colors group">
                              <ExternalLink size={12} className="mt-0.5 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 mb-0.5">
                                  <p className="text-xs font-medium text-foreground line-clamp-1 group-hover:text-blue-600 transition-colors">{src.title || domain}</p>
                                </div>
                                <p className="text-[10px] text-muted-foreground">{domain}</p>
                              </div>
                            </a>
                          );
                        })}
                      </div>
                    </div>
                  </AnimatedCard>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20">
                <div className="p-4 rounded-2xl bg-blue-50 mb-4">
                  <Sparkles size={48} className="text-blue-400" />
                </div>
                <p className="text-sm font-medium text-foreground mb-1">AI Intelligence Not Yet Generated</p>
                <p className="text-xs text-muted-foreground mb-4 max-w-md text-center">
                  Click "Analyze Company" to generate a comprehensive intelligence profile with live web data, competitive analysis, and recommended engagement strategies.
                </p>
                <Button size="sm" onClick={fetchIntelligence} className="bg-blue-600 hover:bg-blue-700 text-white text-xs gap-2">
                  <Sparkles size={14} /> Analyze Company
                </Button>
              </div>
            )}
          </TabsContent>

          {/* ═════════════════════════════════════════════
              TAB 2: Mind Map
              ═════════════════════════════════════════════ */}
          <TabsContent value="mindmap" className="mt-2">
            <AnimatedCard hover={false}>
              <div className="p-4">
                <div className="flex items-center gap-2 mb-4">
                  <div className="h-5 w-1.5 rounded-full" style={{ background: `linear-gradient(180deg, #60a5fa, ${INTEL})` }} />
                  <h3 className="text-sm font-bold text-foreground">Company Intelligence Mind Map</h3>
                  <span className="text-[10px] text-muted-foreground ml-2">Click nodes to expand</span>
                </div>
                <div className="rounded-xl overflow-hidden border border-gray-200" style={{ height: '600px' }}>
                  <CompanyMindMap
                    company={company}
                    contacts={contacts}
                    notes={notes}
                    signals={signals}
                    researchCard={researchCard}
                  />
                </div>
              </div>
            </AnimatedCard>
          </TabsContent>

          {/* ═════════════════════════════════════════════
              TAB 3: Notes
              ═════════════════════════════════════════════ */}
          <TabsContent value="notes" className="mt-2 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-1.5 flex-wrap">
                {NOTE_CATEGORIES.map(cat => (
                  <Button
                    key={cat.key}
                    variant="ghost"
                    size="sm"
                    onClick={() => setNoteFilter(cat.key)}
                    className={`text-[11px] h-7 px-3 rounded-lg ${noteFilter === cat.key ? 'bg-[#2563eb]/10 text-[#2563eb]' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    {cat.label}
                  </Button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 text-xs border-gray-200 hover:border-[#2563eb]/30"
                    onClick={() => setTemplateMenuOpen(!templateMenuOpen)}
                  >
                    <FileText size={13} style={{ color: INTEL }} />
                    Templates
                    <ChevronRight size={12} className={`transition-transform ${templateMenuOpen ? 'rotate-90' : ''}`} />
                  </Button>
                  <AnimatePresence>
                    {templateMenuOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: -4, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -4, scale: 0.97 }}
                        transition={{ duration: 0.15 }}
                        className="absolute right-0 top-full mt-1 w-56 rounded-xl border border-gray-200 bg-white shadow-xl z-50 overflow-hidden"
                      >
                        <div className="p-1.5 border-b border-gray-200">
                          <p className="text-[10px] text-muted-foreground px-2 py-1 uppercase tracking-wider">Note Templates</p>
                        </div>
                        {Object.entries(NOTE_TEMPLATES).map(([key, tpl]) => (
                          <NoteTemplateItem
                            key={key}
                            template={{ key, label: tpl.title }}
                            onSelect={(k) => {
                              setNoteForm({ title: NOTE_TEMPLATES[k].title, body: NOTE_TEMPLATES[k].body, category: k === 'swot' ? 'swot' : k === 'discovery' ? 'discovery' : k === 'competitive' ? 'competitive' : 'general' });
                              setEditingNote(null);
                              setNoteDialogOpen(true);
                              setTemplateMenuOpen(false);
                            }}
                          />
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                <Button
                  size="sm"
                  onClick={() => {
                    setNoteForm({ title: '', body: '', category: noteFilter !== 'all' ? noteFilter : 'general' });
                    setEditingNote(null);
                    setNoteDialogOpen(true);
                  }}
                  className="gap-2 text-xs"
                  style={{ background: INTEL, color: '#FAFAFA' }}
                >
                  <Plus size={13} /> New Note
                </Button>
              </div>
            </div>

            {notes.length === 0 ? (
              <EmptyState icon={FileText} title="No notes yet" description="Create a note to track your research and conversations." />
            ) : (
              <StaggerGrid className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {notes.map((note: any) => (
                  <StaggerItem key={note.id}>
                    <div className="p-4 hover:border-[#2563eb]/20 transition-all cursor-pointer" onClick={() => setExpandedNote(expandedNote === note.id ? null : note.id)}>
                    <GlassPanel className="p-0 border-0 bg-transparent shadow-none" style={{ boxShadow: 'none' }}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1.5">
                            {note.pinned && <Pin size={12} style={{ color: INTEL }} />}
                            <h4 className="text-sm font-semibold text-foreground truncate">
                              {note.title || 'Untitled Note'}
                            </h4>
                            <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-gray-200 text-muted-foreground capitalize shrink-0">
                              {note.category}
                            </Badge>
                          </div>
                          {expandedNote === note.id ? (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              className="text-xs text-foreground/70 leading-relaxed whitespace-pre-wrap mt-2"
                            >
                              {note.body}
                              <div className="flex items-center gap-3 mt-4 pt-3 border-t border-gray-200">
                                <Button
                                  size="sm" variant="ghost" className="text-[11px] text-muted-foreground hover:text-[#2563eb] h-7"
                                  onClick={(e) => { e.stopPropagation(); setEditingNote(note); setNoteForm({ title: note.title, body: note.body, category: note.category }); setNoteDialogOpen(true); }}
                                >
                                  <Edit3 size={12} className="mr-1" /> Edit
                                </Button>
                                <Button
                                  size="sm" variant="ghost" className="text-[11px] text-red-600 hover:text-red-700 h-7"
                                  onClick={(e) => { e.stopPropagation(); deleteNote(note.id); }}
                                >
                                  <Trash2 size={12} className="mr-1" /> Delete
                                </Button>
                              </div>
                            </motion.div>
                          ) : (
                            <p className="text-xs text-foreground/50 line-clamp-2">
                              {note.body}
                            </p>
                          )}
                        </div>
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap mt-0.5">
                          {new Date(note.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </GlassPanel>
                    </div>
                  </StaggerItem>
                ))}
              </StaggerGrid>
            )}
          </TabsContent>

          {/* ═════════════════════════════════════════════
              TAB 4: Contacts
              ═════════════════════════════════════════════ */}
          <TabsContent value="contacts" className="mt-2">
            {contacts.length === 0 ? (
              <EmptyState icon={Users} title="No contacts found" description="This company has no associated contacts yet." />
            ) : (
              <StaggerGrid className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {contacts.map((contact: any) => (
                  <StaggerItem key={contact.id}>
                    <GlassPanel className="p-4 hover:border-[#2563eb]/20 transition-all">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-blue-50 border border-blue-100">
                          <UserCircle size={20} style={{ color: INTEL }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-semibold text-foreground truncate">{contact.rawName || contact.name}</h4>
                          {contact.title && (
                            <p className="text-[11px] text-muted-foreground truncate mt-0.5">{contact.title}</p>
                          )}
                          {contact.email && (
                            <p className="text-[11px] text-muted-foreground truncate flex items-center gap-1 mt-1">
                              <Mail size={10} /> {contact.email}
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-gray-200 text-muted-foreground capitalize">
                              {contact.status || 'unknown'}
                            </Badge>
                            {(contact.leadScore || contact.leadScore === 0) && (
                              <Badge
                                className="text-[9px] px-1.5 py-0"
                                style={{
                                  background: contact.leadScore >= 80 ? 'rgba(16,185,129,0.15)' : contact.leadScore >= 50 ? 'rgba(234,179,8,0.15)' : 'rgba(239,68,68,0.15)',
                                  color: contact.leadScore >= 80 ? '#059669' : contact.leadScore >= 50 ? '#facc15' : '#DC2626',
                                  border: `1px solid ${contact.leadScore >= 80 ? 'rgba(16,185,129,0.3)' : contact.leadScore >= 50 ? 'rgba(234,179,8,0.3)' : 'rgba(239,68,68,0.3)'}`,
                                }}
                              >
                                {contact.leadScore}
                              </Badge>
                            )}
                          </div>
                          {navigateTo && (
                            <button
                              onClick={() => navigateTo('leads')}
                              className="text-[10px] mt-2 flex items-center gap-1 hover:underline transition-colors"
                              style={{ color: INTEL }}
                            >
                              View in Leads <ChevronRight size={10} />
                            </button>
                          )}
                        </div>
                      </div>
                    </GlassPanel>
                  </StaggerItem>
                ))}
              </StaggerGrid>
            )}
          </TabsContent>

          {/* ═════════════════════════════════════════════
              TAB 5: Timeline
              ═════════════════════════════════════════════ */}
          <TabsContent value="timeline" className="mt-2">
            {timeline.length === 0 ? (
              <EmptyState icon={Clock} title="No timeline events" description="Company activity will appear here as events occur." />
            ) : (
              <div className="relative pl-8 space-y-0">
                {/* Timeline line */}
                <div className="absolute left-3 top-2 bottom-2 w-px bg-gray-100" />

                {timeline.map((event: any, idx: number) => {
                  const icon = TIMELINE_ICONS[event.eventType] || <Activity size={14} className="text-muted-foreground" />;
                  return (
                    <motion.div
                      key={event.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.04 }}
                      className="relative pb-6 last:pb-0"
                    >
                      {/* Timeline dot */}
                      <div className="absolute -left-5 top-1 w-6 h-6 rounded-full bg-white border border-gray-200 flex items-center justify-center">
                        {icon}
                      </div>

                      <GlassPanel className="p-4 hover:border-gray-300 transition-all">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-medium text-foreground">{event.title}</h4>
                            {event.description && (
                              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{event.description}</p>
                            )}
                            {event.metadata && event.metadata !== '{}' && (
                              <div className="mt-2 text-[10px] text-foreground/40 bg-gray-50 rounded p-2 font-mono max-h-20 overflow-hidden">
                                {typeof event.metadata === 'string' ? event.metadata.substring(0, 150) : JSON.stringify(event.metadata).substring(0, 150)}
                              </div>
                            )}
                          </div>
                          <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                            {new Date(event.createdAt).toLocaleDateString()} {new Date(event.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </GlassPanel>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* ═════════════════════════════════════════════
              TAB 6: Signals
              ═════════════════════════════════════════════ */}
          <TabsContent value="signals" className="mt-2 space-y-3">
            {signals.length === 0 ? (
              <EmptyState icon={Bell} title="No signals detected" description="AI-detected signals will appear here when available." />
            ) : (
              <StaggerGrid className="grid grid-cols-1 gap-3">
                {signals.map((signal: any) => (
                  <StaggerItem key={signal.id}>
                    <GlassPanel className={`p-4 hover:border-gray-300 transition-all ${signal.isRead ? 'opacity-60' : ''}`}>
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{
                          background: SEVERITY_COLORS[signal.severity]?.replace('/20', '/15').replace('text-', 'bg-').split(' ')[0] || 'rgba(212,175,55,0.1)',
                          border: `1px solid ${SEVERITY_COLORS[signal.severity]?.match(/border-(\S+)/)?.[1]?.replace('/30', '/25') || 'rgba(212,175,55,0.2)'}`,
                        }}>
                          <Bell size={18} className={signal.severity === 'critical' ? 'text-red-600' : signal.severity === 'high' ? 'text-orange-600' : signal.severity === 'medium' ? 'text-yellow-600' : 'text-green-400'} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="text-sm font-semibold text-foreground">{signal.title}</h4>
                            <Badge className={`text-[9px] px-1.5 py-0 capitalize ${SEVERITY_COLORS[signal.severity] || 'bg-gray-500/20 text-gray-600'}`}>
                              {signal.severity}
                            </Badge>
                            <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-gray-200 text-muted-foreground capitalize">
                              {signal.signalType?.replace(/_/g, ' ')}
                            </Badge>
                          </div>
                          {signal.description && (
                            <p className="text-xs text-foreground/60 leading-relaxed">{signal.description}</p>
                          )}
                          <div className="flex items-center gap-4 mt-2">
                            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                              <Clock size={10} /> {new Date(signal.createdAt).toLocaleDateString()}
                            </span>
                            {signal.sourceUrl && (
                              <a href={signal.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] flex items-center gap-1 hover:underline" style={{ color: INTEL }}>
                                <ExternalLink size={10} /> Source
                              </a>
                            )}
                            <button
                              onClick={() => toggleSignalRead(signal)}
                              className="text-[10px] flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors ml-auto"
                            >
                              {signal.isRead ? <EyeOff size={10} /> : <Eye size={10} />}
                              {signal.isRead ? 'Mark unread' : 'Mark read'}
                            </button>
                          </div>
                        </div>
                      </div>
                    </GlassPanel>
                  </StaggerItem>
                ))}
              </StaggerGrid>
            )}
          </TabsContent>

          {/* ═════════════════════════════════════════════
              TAB: Account Brief (AI-Generated)
              ═════════════════════════════════════════════ */}
          <TabsContent value="brief" className="mt-2 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-foreground">AI-Generated Account Brief</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Powered by web intelligence and AI analysis</p>
              </div>
              {!brief && (
                <Button size="sm" onClick={async () => {
                  setLoadingBrief(true);
                  try {
                    const res = await fetch(`/api/ai/account-brief?companyId=${companyId}`);
                    const data = await res.json();
                    setBrief(data.brief);
                    setBriefSources(data.sources || []);
                    toast.success('Account brief generated');
                  } catch { toast.error('Failed to generate brief'); }
                  finally { setLoadingBrief(false); }
                }} disabled={loadingBrief} className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-xs">
                  {loadingBrief ? <Loader2 size={14} className="animate-spin mr-1.5" /> : <Sparkles size={14} className="mr-1.5" />}
                  Generate Account Brief
                </Button>
              )}
            </div>

            {loadingBrief ? (
              <div className="space-y-3">
                <Skeleton className="h-40 w-full rounded-xl" />
                <Skeleton className="h-32 w-full rounded-xl" />
              </div>
            ) : brief ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <AnimatedCard delay={0}>
                  <div className="p-5 space-y-4">
                    <h4 className="text-xs font-bold text-[#2563eb] uppercase tracking-wider flex items-center gap-2"><Briefcase size={14} /> Business Overview</h4>
                    <p className="text-sm text-gray-700 leading-relaxed">{brief.businessOverview}</p>
                  </div>
                </AnimatedCard>
                <AnimatedCard delay={0.1}>
                  <div className="p-5 space-y-4">
                    <h4 className="text-xs font-bold text-[#2563eb] uppercase tracking-wider flex items-center gap-2"><Activity size={14} /> Technology Context</h4>
                    <p className="text-sm text-gray-700 leading-relaxed">{brief.technologyContext}</p>
                  </div>
                </AnimatedCard>
                <AnimatedCard delay={0.2}>
                  <div className="p-5 space-y-4">
                    <h4 className="text-xs font-bold text-[#2563eb] uppercase tracking-wider flex items-center gap-2"><AlertTriangle size={14} /> Industry Challenges & Pain Points</h4>
                    <p className="text-sm text-gray-700 leading-relaxed">{brief.industryChallenges}</p>
                    <div className="flex flex-wrap gap-2">
                      {(brief.painPoints || []).map((p: string, i: number) => (
                        <span key={i} className="text-[11px] px-2.5 py-1 rounded-full bg-red-50 text-red-700 border border-red-200">{p}</span>
                      ))}
                    </div>
                  </div>
                </AnimatedCard>
                <AnimatedCard delay={0.3}>
                  <div className="p-5 space-y-4">
                    <h4 className="text-xs font-bold text-[#2563eb] uppercase tracking-wider flex items-center gap-2"><Lightbulb size={14} /> Relevant Solutions & Approach</h4>
                    <div className="flex flex-wrap gap-2">
                      {(brief.relevantSolutions || []).map((s: string, i: number) => (
                        <span key={i} className="text-[11px] px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">{s}</span>
                      ))}
                    </div>
                    <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                      <p className="text-xs font-semibold text-gray-700 mb-1">Recommended Approach</p>
                      <p className="text-xs text-gray-500">{brief.recommendedApproach}</p>
                    </div>
                  </div>
                </AnimatedCard>
                <AnimatedCard className="lg:col-span-2" delay={0.4}>
                  <div className="p-5 space-y-4">
                    <h4 className="text-xs font-bold text-[#2563eb] uppercase tracking-wider flex items-center gap-2"><Users size={14} /> Target Executives & Conversation Starters</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs font-semibold text-gray-600 mb-2">Target Executives</p>
                        {(brief.targetExecutives || []).map((e: any, i: number) => (
                          <div key={i} className="flex items-start gap-2 mb-2">
                            <div className="w-6 h-6 rounded-full bg-[#2563eb]/10 flex items-center justify-center text-[10px] font-bold text-[#2563eb] shrink-0 mt-0.5">{e.role?.charAt(0)}</div>
                            <div>
                              <p className="text-xs font-semibold text-gray-900">{e.role}</p>
                              <p className="text-[11px] text-gray-500">{e.focus}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-gray-600 mb-2">Conversation Starters</p>
                        {(brief.conversationStarters || []).map((c: string, i: number) => (
                          <div key={i} className="p-2 bg-gray-50 rounded-lg mb-1.5">
                            <p className="text-[11px] text-gray-700 italic">"{c}"</p>
                          </div>
                        ))}
                      </div>
                    </div>
                    {brief.strategicPriority && (
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs text-muted-foreground">Strategic Priority:</span>
                        <Badge variant="outline" className={brief.strategicPriority === 'High' ? 'border-red-300 text-red-700' : brief.strategicPriority === 'Medium' ? 'border-amber-300 text-amber-700' : 'border-gray-300 text-gray-600'}>{brief.strategicPriority}</Badge>
                        {brief.confidence && <span className="text-[10px] text-muted-foreground">{brief.confidence}% confidence</span>}
                      </div>
                    )}
                  </div>
                </AnimatedCard>

                {briefSources.length > 0 && (
                  <div className="lg:col-span-2">
                    <AnimatedCard delay={0.5}>
                      <div className="p-5 space-y-3">
                        <h4 className="text-xs font-bold uppercase tracking-wider flex items-center gap-2 text-blue-600">
                          <Globe size={14} /> Research Sources ({briefSources.length})
                        </h4>
                        <div className="space-y-2 max-h-48 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
                          {briefSources.map((src, i) => {
                            let domain = '';
                            try { domain = new URL(src.url).hostname.replace('www.', ''); } catch (err) { console.error('[CompanyDetail] parse URL domain failed:', err); domain = src.url; }
                            return (
                              <a key={i} href={src.url} target="_blank" rel="noopener noreferrer"
                                className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-gray-50 transition-colors group">
                                <ExternalLink size={12} className="mt-0.5 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                                <div className="min-w-0 flex-1">
                                  <p className="text-xs font-medium text-gray-900 line-clamp-1 group-hover:text-[#2563eb] transition-colors">{src.title || domain}</p>
                                  <p className="text-[10px] text-muted-foreground">{domain}</p>
                                </div>
                              </a>
                            );
                          })}
                        </div>
                      </div>
                    </AnimatedCard>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="p-4 rounded-2xl bg-[#2563eb]/5 mb-3"><Sparkles size={40} className="text-[#2563eb]/40" /></div>
                <p className="text-sm text-muted-foreground">Click "Generate Account Brief" to create an AI-powered intelligence summary</p>
              </div>
            )}
          </TabsContent>

          {/* ═════════════════════════════════════════════
              TAB: AI Suggested Stakeholders
              ═════════════════════════════════════════════ */}
          <TabsContent value="stakeholders" className="mt-2 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-foreground">AI-Discovered Stakeholders</h3>
                <p className="text-xs text-muted-foreground mt-0.5">AI finds relevant executives from web intelligence</p>
              </div>
              {!suggestedContacts.length && (
                <Button size="sm" onClick={async () => {
                  setLoadingSuggested(true);
                  try {
                    const res = await fetch(`/api/ai/suggested-contacts?companyId=${companyId}`);
                    const data = await res.json();
                    setSuggestedContacts(data.contacts || []);
                    toast.success(`Found ${data.contacts?.length || 0} suggested stakeholders`);
                  } catch { toast.error('Failed to discover stakeholders'); }
                  finally { setLoadingSuggested(false); }
                }} disabled={loadingSuggested} className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-xs">
                  {loadingSuggested ? <Loader2 size={14} className="animate-spin mr-1.5" /> : <Network size={14} className="mr-1.5" />}
                  Discover Stakeholders
                </Button>
              )}
            </div>

            {loadingSuggested ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
              </div>
            ) : suggestedContacts.length > 0 ? (
              <StaggerGrid className="grid-cols-1 md:grid-cols-2 gap-3">
                {suggestedContacts.map((contact: any, i: number) => {
                  const influenceColors: Record<string, string> = {
                    'Decision Maker': 'bg-red-50 text-red-700 border-red-200',
                    'Technical Influencer': 'bg-blue-50 text-blue-700 border-blue-200',
                    'Business Sponsor': 'bg-emerald-50 text-emerald-700 border-emerald-200',
                    'Champion': 'bg-amber-50 text-amber-700 border-amber-200',
                    'Blocker': 'bg-gray-100 text-gray-600 border-gray-200',
                  };
                  const stars = '★'.repeat(contact.priority || 0) + '☆'.repeat(5 - (contact.priority || 0));
                  return (
                    <StaggerItem key={i}>
                      <AnimatedCard>
                        <div className="p-4 space-y-3">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-[#2563eb]/10 flex items-center justify-center text-sm font-bold text-[#2563eb]">
                                {contact.name ? contact.name.split(' ').map((n: string) => n[0]).join('') : (contact.role || '?').charAt(0)}
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-gray-900">{contact.name || 'Unknown'}</p>
                                <p className="text-xs text-muted-foreground">{contact.role}</p>
                              </div>
                            </div>
                            {contact.influence && (
                              <Badge variant="outline" className={`text-[10px] ${influenceColors[contact.influence] || 'border-gray-300 text-gray-600'}`}>{contact.influence}</Badge>
                            )}
                          </div>
                          {contact.whyRelevant && <p className="text-xs text-gray-600 leading-relaxed">{contact.whyRelevant}</p>}
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] text-amber-600 tracking-wider">{stars}</span>
                            {contact.recommendedAction && (
                              <span className="text-[10px] text-muted-foreground flex items-center gap-1"><ArrowRight size={10} /> {contact.recommendedAction}</span>
                            )}
                          </div>
                        </div>
                      </AnimatedCard>
                    </StaggerItem>
                  );
                })}
              </StaggerGrid>
            ) : (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="p-4 rounded-2xl bg-[#2563eb]/5 mb-3"><Network size={40} className="text-[#2563eb]/40" /></div>
                <p className="text-sm text-muted-foreground">Click "Discover Stakeholders" to find relevant executives</p>
              </div>
            )}
          </TabsContent>

          {/* ═════════════════════════════════════════════
              TAB: Evidence (Phase 3)
              ═════════════════════════════════════════════ */}
          <TabsContent value="evidence" className="space-y-4">
            <EvidencePanel companyId={companyId} />
          </TabsContent>
        </Tabs>
      </div>

      {/* ── Note Dialog ── */}
      <Dialog open={noteDialogOpen} onOpenChange={(open) => { if (!open) { setNoteDialogOpen(false); setEditingNote(null); setNoteForm({ title: '', body: '', category: 'general' }); } }}>
        <DialogContent className="bg-white border-gray-200 text-foreground max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold flex items-center gap-2">
              <FileText size={16} style={{ color: INTEL }} />
              {editingNote ? 'Edit Note' : 'New Note'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Title</label>
              <Input
                value={noteForm.title}
                onChange={e => setNoteForm(p => ({ ...p, title: e.target.value }))}
                placeholder="Note title..."
                className="mt-1 h-9 text-sm bg-gray-50 border-gray-200"
              />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Category</label>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {NOTE_CATEGORIES.filter(c => c.key !== 'all').map(cat => (
                  <Button
                    key={cat.key}
                    variant="ghost"
                    size="sm"
                    onClick={() => setNoteForm(p => ({ ...p, category: cat.key }))}
                    className={`text-[11px] h-7 px-3 rounded-lg ${noteForm.category === cat.key ? 'bg-[#2563eb]/10 text-[#2563eb] border border-[#2563eb]/25' : 'text-muted-foreground hover:text-foreground border border-transparent'}`}
                  >
                    {cat.label}
                  </Button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Body</label>
              <Textarea
                value={noteForm.body}
                onChange={e => setNoteForm(p => ({ ...p, body: e.target.value }))}
                placeholder="Write your note..."
                className="mt-1 text-sm min-h-[200px] bg-gray-50 border-gray-200 resize-none"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setNoteDialogOpen(false); setEditingNote(null); }}
                className="text-xs text-muted-foreground"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={saveNote}
                disabled={savingNote || !noteForm.body.trim()}
                className="text-xs gap-2"
                style={{ background: INTEL, color: '#FAFAFA' }}
              >
                {savingNote ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                {editingNote ? 'Update' : 'Create'} Note
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </PageTransition>
    </div>
  );
}