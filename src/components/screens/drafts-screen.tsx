'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  FileText, Check, X, Eye, AlertTriangle, Sparkles, Building2, Mail, User, Tag, Target, BookOpen, Flag, FileCode2, CheckCircle2, Search, SlidersHorizontal, ChevronDown, ChevronUp, ChevronRight, Send, Calendar as CalendarIcon, Clock, Reply, Trash2, RefreshCw, GitBranch, MessagesSquare,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import KnowledgeSearch from '@/components/knowledge-search';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  PageTransition, AnimatedCard, StaggerGrid, StaggerItem, SectionHeader,
  TabBar, StatCard, GlassPanel, EmptyState, GradientCard, PulseDot,
} from '@/components/ui/animated-components';

interface Contact {
  id: string;
  name: string;
  email?: string;
  jobTitle?: string;
  company?: { id: string; name: string; research?: { businessOverview?: string; relevantServices?: string; nextAction?: string } };
}

interface SourceSnippet {
  id: string;
  title: string;
  content: string;
  snippetType?: string;
  relevanceScore?: number;
}

interface AssumptionFlag {
  id: string;
  assumption: string;
  confidence: string;
}

interface ReplyItem {
  id: string;
  draftId?: string;
  subject?: string;
  body?: string;
  category?: string;
  receivedAt?: string;
}

interface Draft {
  id: string;
  contactId: string;
  contact?: Contact;
  subject: string;
  body: string;
  cta?: string;
  serviceAngle?: string;
  confidenceScore?: number;
  status: string;
  createdAt?: string;
  messageId?: string;
  inReplyTo?: string;
  references?: string;
  sourceSnippets?: SourceSnippet[];
  assumptionFlags?: AssumptionFlag[];
  replies?: ReplyItem[];
}

const TAB_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'pending_review', label: 'Pending Review' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
];

const DRAFT_STATUS_COLORS: Record<string, string> = {
  'pending_review': 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  approved: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  rejected: 'bg-red-500/20 text-red-300 border-red-500/30',
  draft: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30',
};

/* -- AI Demo Draft Type -- */
interface AIDemoDraft {
  subject: string;
  body: string;
  cta: string;
  confidenceScore: number;
  assumptions: string[];
  sourceSnippets: { id: string; title: string; snippetType: string; relevanceScore?: number }[];
  generatedAt?: string;
  generationMethod?: 'ai' | 'template';
}

interface DraftsScreenProps {
  navigateTo?: (screen: string) => void;
}

export default function DraftsScreen({ navigateTo }: DraftsScreenProps) {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('all');
  const [selectedDraft, setSelectedDraft] = useState<Draft | null>(null);
  const [editBody, setEditBody] = useState('');
  const [editSubject, setEditSubject] = useState('');
  const [editCta, setEditCta] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [isEditing, setIsEditing] = useState(false);

  // Knowledge search dialog
  const [showKnowledgeSearch, setShowKnowledgeSearch] = useState(false);
  const [attachedCapabilities, setAttachedCapabilities] = useState<Array<{ id: string; title: string; summary: string; category: string; relevanceScore: number }>>([]);

  // AI Demo state
  const [showAiDemo, setShowAiDemo] = useState(false);
  const [aiName, setAiName] = useState('');
  const [aiTitle, setAiTitle] = useState('');
  const [aiCompany, setAiCompany] = useState('');
  const [aiIndustry, setAiIndustry] = useState('');
  const [aiCompanySize, setAiCompanySize] = useState('');
  const [aiServiceLine, setAiServiceLine] = useState('');
  const [aiProblems, setAiProblems] = useState('');
  const [aiSearchMode, setAiSearchMode] = useState('hybrid');
  const [aiMinScore, setAiMinScore] = useState(20);
  const [aiShowAdvanced, setAiShowAdvanced] = useState(false);
  const [aiTone, setAiTone] = useState('professional');
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiResult, setAiResult] = useState<AIDemoDraft | null>(null);
  const [aiError, setAiError] = useState('');
  const [aiSuccess, setAiSuccess] = useState('');

  // Search filter
  const [searchQuery, setSearchQuery] = useState('');

  // E-12: Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);

  // E-10: A/B test state
  const [showAbTest, setShowAbTest] = useState(false);
  const [abTestName, setAbTestName] = useState('');
  const [abTestServiceLine, setAbTestServiceLine] = useState('');
  const [abTestTone, setAbTestTone] = useState('professional');
  const [abTestLoading, setAbTestLoading] = useState(false);

  // E-06: Follow-up state
  const [followUpDraftId, setFollowUpDraftId] = useState<string | null>(null);
  const [followUpLoading, setFollowUpLoading] = useState(false);

  // Thread view state
  const [viewMode, setViewMode] = useState<'flat' | 'thread'>('flat');
  const [expandedThreads, setExpandedThreads] = useState<Set<string>>(new Set());

  useEffect(() => {
    const params = tab !== 'all' ? `?status=${tab}` : '';
    fetch(`/api/drafts${params}`)
      .then(r => r.json())
      .then(data => {
        const raw = Array.isArray(data) ? data : data.drafts || [];
        setDrafts(raw.map((d: any) => ({
          ...d,
          contact: d.contact ? {
            ...d.contact,
            name: d.contact.rawName || d.contact.name,
            jobTitle: d.contact.title || d.contact.jobTitle,
            company: d.contact.company ? {
              ...d.contact.company,
              name: d.contact.company.rawName || d.contact.company.name,
              research: d.contact.company.researchCard || d.contact.company.research,
            } : undefined,
          } : undefined,
        })));
      })
      .catch(() => {})
      .finally(() => { setLoading(false); });
  }, [tab, refreshKey]);

  const openDraft = (draft: Draft) => {
    setSelectedDraft(draft);
    setEditSubject(draft.subject);
    setEditBody(draft.body);
    setEditCta(draft.cta || '');
    setIsEditing(false);
  };

  // Scheduling state (E-05)
  const [scheduleMode, setScheduleMode] = useState<'now' | 'schedule'>('now');
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('09:00');

  const handleApprove = async () => {
    if (!selectedDraft) return;
    try {
      const payload: Record<string, unknown> = {
        id: selectedDraft.id,
        status: 'approved',
        ...(isEditing ? { subject: editSubject, body: editBody, cta: editCta } : {}),
      };
      if (scheduleMode === 'schedule' && scheduleDate) {
        payload.scheduledAt = new Date(`${scheduleDate}T${scheduleTime || '09:00'}:00`).toISOString();
      } else {
        payload.scheduledAt = 'now';
      }
      await fetch('/api/drafts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      setSelectedDraft(null);
      setScheduleMode('now');
      setScheduleDate('');
      setScheduleTime('09:00');
      setRefreshKey(k => k + 1);
    } catch { /* ignore */ }
  };

  // Get tomorrow's date as default min
  const tomorrowDate = new Date();
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const minDateStr = tomorrowDate.toISOString().split('T')[0];

  const handleReject = async () => {
    if (!selectedDraft) return;
    try {
      await fetch('/api/drafts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selectedDraft.id, status: 'rejected', rejectReason: 'Manual rejection' }),
      });
      setSelectedDraft(null);
      setRefreshKey(k => k + 1);
    } catch { /* ignore */ }
  };

  const confidenceColor = (s?: number) => !s ? 'text-zinc-500' : s >= 85 ? 'text-emerald-600' : s >= 70 ? 'text-amber-600' : 'text-red-600';

  const handleAiGenerate = async () => {
    if (!aiName.trim()) return;
    setAiGenerating(true);
    setAiError('');
    setAiSuccess('');
    setAiResult(null);
    try {
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: aiName,
          title: aiTitle || undefined,
          company: aiCompany || undefined,
          industry: aiIndustry || undefined,
          companySize: aiCompanySize || undefined,
          tone: aiTone,
          serviceLine: aiServiceLine || undefined,
          problems: aiProblems || undefined,
          knowledgeSearchMode: aiSearchMode,
          knowledgeMinScore: aiMinScore,
        }),
      });
      const data = await res.json();
      if (data.success && data.draft) {
        setAiResult(data.draft);
        setAiSuccess(data.draft.generationMethod === 'ai'
          ? 'Draft generated by AI engine'
          : 'Draft generated using template engine (AI API unavailable)');
      } else {
        setAiError(data.error || 'Generation failed');
      }
    } catch {
      setAiError('Network error - please try again');
    }
    setAiGenerating(false);
  };

  // Computed stats
  const stats = useMemo(() => {
    const total = drafts.length;
    const pending = drafts.filter(d => d.status === 'pending_review').length;
    const approved = drafts.filter(d => d.status === 'approved').length;
    const rejected = drafts.filter(d => d.status === 'rejected').length;
    return { total, pending, approved, rejected };
  }, [drafts]);

  // Filtered drafts
  const filteredDrafts = useMemo(() => {
    if (!searchQuery.trim()) return drafts;
    const q = searchQuery.toLowerCase();
    return drafts.filter(d =>
      (d.contact?.name || '').toLowerCase().includes(q) ||
      (d.contact?.company?.name || '').toLowerCase().includes(q) ||
      d.subject.toLowerCase().includes(q)
    );
  }, [drafts, searchQuery]);

  // Thread grouping: group drafts by contact
  const threadGroups = useMemo(() => {
    const map = new Map<string, { contact: Contact; drafts: Draft[] }>();
    for (const d of filteredDrafts) {
      const key = d.contactId;
      if (!map.has(key)) {
        map.set(key, {
          contact: d.contact || { id: key, name: 'Unknown' },
          drafts: [],
        });
      }
      map.get(key)!.drafts.push(d);
    }
    // Sort each thread's drafts by createdAt ascending (oldest first)
    for (const group of map.values()) {
      group.drafts.sort((a, b) => {
        const da = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const db = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return da - db;
      });
    }
    // Sort threads by most recent draft (newest first)
    return Array.from(map.values()).sort((a, b) => {
      const aLast = a.drafts[a.drafts.length - 1];
      const bLast = b.drafts[b.drafts.length - 1];
      const aTime = aLast?.createdAt ? new Date(aLast.createdAt).getTime() : 0;
      const bTime = bLast?.createdAt ? new Date(bLast.createdAt).getTime() : 0;
      return bTime - aTime;
    });
  }, [filteredDrafts]);

  const toggleThread = (contactId: string) => {
    setExpandedThreads(prev => {
      const next = new Set(prev);
      if (next.has(contactId)) next.delete(contactId); else next.add(contactId);
      return next;
    });
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredDrafts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredDrafts.map(d => d.id)));
    }
  };

  const handleBulkAction = async (action: string) => {
    if (selectedIds.size === 0) return;
    setBulkLoading(true);
    try {
      const res = await fetch('/api/drafts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedIds), action }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Bulk ${action} completed`);
        setSelectedIds(new Set());
        setRefreshKey(k => k + 1);
      } else {
        toast.error('Bulk action failed');
      }
    } catch { toast.error('Network error'); }
    setBulkLoading(false);
  };

  const handleFollowUp = async (draft: Draft) => {
    if (!draft.contactId) return;
    setFollowUpLoading(true);
    try {
      const res = await fetch('/api/drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactId: draft.contactId, inReplyToDraftId: draft.id }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Follow-up draft created');
        setRefreshKey(k => k + 1);
      }
    } catch { toast.error('Failed to create follow-up'); }
    setFollowUpLoading(false);
  };

  const handleCreateAbTest = async () => {
    if (!abTestName || selectedIds.size === 0) {
      toast.error('Test name and selected drafts required');
      return;
    }
    setAbTestLoading(true);
    try {
      const contactIds = drafts
        .filter(d => selectedIds.has(d.id))
        .map(d => d.contactId)
        .filter(Boolean);
      const res = await fetch('/api/ab-tests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: abTestName, contactIds, serviceLine: abTestServiceLine || undefined, tone: abTestTone }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`A/B test created with ${data.test.variants?.length || 0} variants`);
        setShowAbTest(false);
        setSelectedIds(new Set());
        setRefreshKey(k => k + 1);
      } else {
        toast.error(data.error || 'Failed to create test');
      }
    } catch { toast.error('Network error'); }
    setAbTestLoading(false);
  };

  const hasSentDrafts = drafts.some(d => d.status === 'approved' || d.status === 'sent');
  const tabData = TAB_OPTIONS.map(t => ({
    key: t.value,
    label: t.label,
    count: t.value === 'all' ? stats.total : t.value === 'pending_review' ? stats.pending : t.value === 'approved' ? stats.approved : stats.rejected,
  }));

  return (
    <PageTransition>
    <div className="max-h-[calc(100vh-200px)] overflow-y-auto space-y-6 pr-1 pb-8">

      {/* -- Page Header -- */}
      <div className="flex items-end justify-between">
        <div>
          <SectionHeader
            title="Email Drafts"
            subtitle="Review, edit, and approve AI-generated outreach drafts"
            className="!mb-0"
          />
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {/* View mode toggle */}
          <div className="flex items-center rounded-lg bg-black/[0.03] border border-gray-200 p-0.5">
            <button
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                viewMode === 'flat'
                  ? 'bg-primary/15 text-primary border border-primary/25'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => setViewMode('flat')}
            >
              <FileText className="w-3.5 h-3.5" />
              All Drafts
            </button>
            <button
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                viewMode === 'thread'
                  ? 'bg-primary/15 text-primary border border-primary/25'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => setViewMode('thread')}
            >
              <MessagesSquare className="w-3.5 h-3.5" />
              Thread View
            </button>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-9 text-xs gap-1.5 border-primary/20 text-primary hover:bg-primary/10 hover:text-primary hover:border-primary/40 transition-all"
            onClick={() => setShowKnowledgeSearch(true)}
          >
            <Search className="w-3.5 h-3.5" />
            Knowledge Base
          </Button>
          <Button
            variant={showAiDemo ? 'default' : 'outline'}
            size="sm"
            className={`h-9 text-xs gap-1.5 transition-all ${showAiDemo ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20' : 'border-primary/30 text-primary hover:bg-primary/10 hover:border-primary/50'}`}
            onClick={() => setShowAiDemo(!showAiDemo)}
          >
            <Sparkles className="w-3.5 h-3.5" />
            AI Test
          </Button>
          {selectedIds.size > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="h-9 text-xs gap-1.5 border-emerald-500/30 text-emerald-600 hover:bg-emerald-50 transition-all"
              onClick={() => setShowAbTest(true)}
            >
              <GitBranch className="w-3.5 h-3.5" />
              A/B Test ({selectedIds.size})
            </Button>
          )}
        </div>
      </div>

      {/* -- Stat Cards Row -- */}
      <StaggerGrid className="grid grid-cols-2 lg:grid-cols-4 gap-4" stagger={0.08}>
        <StaggerItem>
          <StatCard
            label="Total Drafts"
            value={stats.total}
            icon={FileText}
            color="#D4AF37"
            delay={0}
          />
        </StaggerItem>
        <StaggerItem>
          <StatCard
            label="Pending Review"
            value={stats.pending}
            icon={AlertTriangle}
            color="#F59E0B"
            delay={0.08}
          />
        </StaggerItem>
        <StaggerItem>
          <StatCard
            label="Approved"
            value={stats.approved}
            icon={CheckCircle2}
            color="#10B981"
            delay={0.16}
          />
        </StaggerItem>
        <StaggerItem>
          <StatCard
            label="Rejected"
            value={stats.rejected}
            icon={X}
            color="#EF4444"
            delay={0.24}
          />
        </StaggerItem>
      </StaggerGrid>

      {/* -- Tabs + Search Bar in Glass Panel -- */}
      <GlassPanel className="p-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <TabBar tabs={tabData} active={tab} onChange={setTab} />
          <div className="flex-1" />
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder="Search drafts..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="h-9 pl-9 text-sm bg-black/[0.03] border-gray-200 placeholder:text-muted-foreground/60 focus:border-primary/30 focus:ring-1 focus:ring-primary/10"
            />
          </div>
        </div>
      </GlassPanel>

      {/* -- AI Demo Panel -- */}
      {showAiDemo && (
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        >
          <GradientCard gradient="gold" className="!p-0 overflow-hidden">
            <div className="rounded-xl bg-card">
              <CardHeader className="pb-3 pt-4 px-5">
                <CardTitle className="text-sm font-semibold flex items-center gap-2.5 text-primary">
                  <div className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center">
                    <Sparkles className="w-4 h-4 text-primary" />
                  </div>
                  AI Draft Generator
                  <span className="text-[10px] font-normal text-muted-foreground ml-1">No database needed - test the AI engine directly</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs text-muted-foreground font-medium">Contact Name *</label>
                    <Input
                      placeholder="e.g. Sarah Chen"
                      value={aiName}
                      onChange={e => setAiName(e.target.value)}
                      className="h-9 text-sm bg-black/[0.03] border-gray-200 focus:border-primary/30"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-muted-foreground font-medium">Job Title</label>
                    <Input
                      placeholder="e.g. VP of Engineering"
                      value={aiTitle}
                      onChange={e => setAiTitle(e.target.value)}
                      className="h-9 text-sm bg-black/[0.03] border-gray-200 focus:border-primary/30"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-muted-foreground font-medium">Company</label>
                    <Input
                      placeholder="e.g. Acme Corp"
                      value={aiCompany}
                      onChange={e => setAiCompany(e.target.value)}
                      className="h-9 text-sm bg-black/[0.03] border-gray-200 focus:border-primary/30"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-muted-foreground font-medium">Industry</label>
                    <Input
                      placeholder="e.g. Financial Services"
                      value={aiIndustry}
                      onChange={e => setAiIndustry(e.target.value)}
                      className="h-9 text-sm bg-black/[0.03] border-gray-200 focus:border-primary/30"
                    />
                  </div>
                </div>

                {/* Advanced Knowledge Parameters toggle */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setAiShowAdvanced(!aiShowAdvanced)}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                    Knowledge Engine Parameters
                    {aiShowAdvanced ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                </div>

                {aiShowAdvanced && (
                  <GlassPanel className="p-4 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground font-medium">Company Size</Label>
                        <Select value={aiCompanySize} onValueChange={v => setAiCompanySize(v === '__all__' ? '' : v)}>
                          <SelectTrigger className="h-9 text-xs bg-black/[0.03] border-gray-200">
                            <SelectValue placeholder="Any Size" />
                          </SelectTrigger>
                          <SelectContent className="bg-card border-border">
                            <SelectItem value="__all__" className="text-xs">Any Size</SelectItem>
                            <SelectItem value="Startup" className="text-xs">Startup</SelectItem>
                            <SelectItem value="Mid-Market" className="text-xs">Mid-Market</SelectItem>
                            <SelectItem value="Enterprise" className="text-xs">Enterprise</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground font-medium">Service Line</Label>
                        <Select value={aiServiceLine} onValueChange={v => setAiServiceLine(v === '__all__' ? '' : v)}>
                          <SelectTrigger className="h-9 text-xs bg-black/[0.03] border-gray-200">
                            <SelectValue placeholder="Auto-detect" />
                          </SelectTrigger>
                          <SelectContent className="bg-card border-border">
                            <SelectItem value="__all__" className="text-xs">Auto-detect</SelectItem>
                            <SelectItem value="AI & Machine Learning" className="text-xs">AI & Machine Learning</SelectItem>
                            <SelectItem value="Cloud Engineering" className="text-xs">Cloud Engineering</SelectItem>
                            <SelectItem value="Data Engineering" className="text-xs">Data Engineering</SelectItem>
                            <SelectItem value="Digital Transformation" className="text-xs">Digital Transformation</SelectItem>
                            <SelectItem value="Cybersecurity" className="text-xs">Cybersecurity</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground font-medium">Search Mode</Label>
                        <Select value={aiSearchMode} onValueChange={setAiSearchMode}>
                          <SelectTrigger className="h-9 text-xs bg-black/[0.03] border-gray-200">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-card border-border">
                            <SelectItem value="keyword" className="text-xs">Keyword</SelectItem>
                            <SelectItem value="semantic" className="text-xs">Semantic</SelectItem>
                            <SelectItem value="hybrid" className="text-xs">Hybrid (Recommended)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground font-medium">Problem / Pain Points</Label>
                      <Input
                        placeholder="e.g. data silos, legacy infrastructure, compliance overhead"
                        value={aiProblems}
                        onChange={e => setAiProblems(e.target.value)}
                        className="h-9 text-xs bg-black/[0.03] border-gray-200 focus:border-primary/30"
                      />
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="flex-1 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs text-muted-foreground font-medium">Min Relevance Score</Label>
                          <span className="text-xs text-primary font-semibold tabular-nums">{aiMinScore}%</span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={80}
                          step={5}
                          value={aiMinScore}
                          onChange={e => setAiMinScore(Number(e.target.value))}
                          className="w-full h-1.5 bg-muted rounded-full appearance-none cursor-pointer accent-primary"
                        />
                      </div>
                    </div>
                  </GlassPanel>
                )}

                <div className="flex items-center gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs text-muted-foreground font-medium">Tone</label>
                    <div className="flex gap-1">
                      {(['professional', 'casual', 'executive'] as const).map(t => (
                        <Button
                          key={t}
                          variant={aiTone === t ? 'default' : 'outline'}
                          size="sm"
                          className={`h-8 text-[11px] px-3 capitalize transition-all ${aiTone === t ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20' : 'border-gray-200 text-muted-foreground hover:text-foreground hover:border-primary/30'}`}
                          onClick={() => setAiTone(t)}
                        >
                          {t}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <div className="flex-1" />
                  <Button
                    size="sm"
                    className="h-9 text-xs bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 shadow-lg shadow-primary/20 transition-all"
                    disabled={!aiName.trim() || aiGenerating}
                    onClick={handleAiGenerate}
                  >
                    {aiGenerating ? (
                      <div className="w-3.5 h-3.5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <><Sparkles className="w-3.5 h-3.5 mr-1.5" />Generate Draft</>
                    )}
                  </Button>
                </div>

                {aiError && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-start gap-2 text-xs text-red-600 bg-red-50 border border-red-500/20 rounded-lg px-4 py-2.5"
                  >
                    <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <span>{aiError}</span>
                  </motion.div>
                )}

                {aiSuccess && !aiError && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-2 text-xs text-emerald-600 bg-emerald-50 border border-emerald-500/20 rounded-lg px-4 py-2.5"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span>{aiSuccess}</span>
                  </motion.div>
                )}

                {/* AI Result */}
                {aiResult && (
                  <div className="space-y-4 pt-4 border-t border-gray-200">
                    {/* Generation method badge */}
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={aiResult.generationMethod === 'ai'
                          ? 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30 text-[10px]'
                          : 'bg-amber-500/15 text-amber-600 border-amber-500/30 text-[10px]'
                        }
                      >
                        {aiResult.generationMethod === 'ai'
                          ? <><Sparkles className="w-3 h-3 mr-1" />AI Generated</>
                          : <><FileCode2 className="w-3 h-3 mr-1" />Template Generated</>
                        }
                      </Badge>
                      {aiResult.generationMethod === 'template' && (
                        <span className="text-[10px] text-muted-foreground">Template engine used - AI API was unavailable</span>
                      )}
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                      <div className="lg:col-span-2 space-y-4">
                        <div className="space-y-1.5">
                          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">Subject</p>
                          <p className="text-sm font-medium text-foreground leading-relaxed">{aiResult.subject}</p>
                        </div>
                        <div className="space-y-1.5">
                          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">Email Body</p>
                          <GlassPanel className="p-4">
                            <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{aiResult.body}</p>
                          </GlassPanel>
                        </div>
                        {aiResult.cta && (
                          <div className="space-y-1.5">
                            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">Call to Action</p>
                            <p className="text-sm text-primary font-medium">{aiResult.cta}</p>
                          </div>
                        )}
                      </div>
                      <div className="space-y-4">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">Confidence</span>
                          <span className={`text-sm font-bold tabular-nums ${confidenceColor(aiResult.confidenceScore)}`}>{aiResult.confidenceScore}%</span>
                        </div>
                        {aiResult.assumptions.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-[11px] font-semibold text-amber-600 uppercase tracking-widest">Assumptions</p>
                            {aiResult.assumptions.map((a, i) => (
                              <div key={i} className="flex items-start gap-2">
                                <AlertTriangle className="w-3 h-3 text-amber-600 mt-0.5 shrink-0" />
                                <p className="text-xs text-muted-foreground leading-relaxed">{a}</p>
                              </div>
                            ))}
                          </div>
                        )}
                        {aiResult.sourceSnippets.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-[11px] font-semibold text-primary uppercase tracking-widest">Source Capabilities</p>
                            {aiResult.sourceSnippets.map(s => (
                              <div key={s.id} className="flex items-center gap-1.5">
                                <BookOpen className="w-3 h-3 text-primary shrink-0" />
                                <span className="text-xs text-muted-foreground flex-1 truncate">{s.title}</span>
                                {s.relevanceScore != null && (
                                  <span className={`text-[9px] tabular-nums font-medium ${s.relevanceScore >= 80 ? 'text-emerald-600' : s.relevanceScore >= 50 ? 'text-amber-600' : 'text-zinc-500'}`}>{s.relevanceScore}%</span>
                                )}
                                <Badge variant="outline" className="text-[9px] border-gray-200 text-zinc-500 shrink-0">{s.snippetType?.replace('_', ' ')}</Badge>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </div>
          </GradientCard>
        </motion.div>
      )}

      {/* -- Drafts Table / Thread View -- */}
      {viewMode === 'flat' ? (
        <>
          <div className="flex items-center justify-between">
            <SectionHeader
              title="Draft Queue"
              subtitle={`${filteredDrafts.length} draft${filteredDrafts.length !== 1 ? 's' : ''} found`}
              className="!mb-0"
            />
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={filteredDrafts.length > 0 && selectedIds.size === filteredDrafts.length}
                onChange={toggleSelectAll}
                className="w-4 h-4 rounded border-gray-300 bg-black/5 text-primary accent-primary"
              />
              <span className="text-xs text-muted-foreground">Select All</span>
            </label>
          </div>

          {loading ? (
            <AnimatedCard hover={false}>
              <CardContent className="p-6 space-y-4">
                {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
              </CardContent>
            </AnimatedCard>
          ) : filteredDrafts.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No drafts found"
              description={searchQuery ? 'Try adjusting your search query or filters.' : 'Drafts will appear here once generated from your leads.'}
              action={navigateTo && !searchQuery ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs border-primary/30 text-primary hover:bg-primary/10"
                  onClick={() => navigateTo('import')}
                >
                  Import leads first
                </Button>
              ) : undefined}
            />
          ) : (
            <StaggerGrid className="space-y-2" stagger={0.04}>
              {filteredDrafts.map(draft => (
                <StaggerItem key={draft.id}>
                  <AnimatedCard
                    glow={
                      draft.status === 'approved' ? 'rgba(16, 185, 129, 0.08)' :
                      draft.status === 'rejected' ? 'rgba(239, 68, 68, 0.08)' :
                      'rgba(212, 175, 55, 0.08)'
                    }
                    className="!rounded-xl"
                  >
                    <div className="flex items-center gap-4 px-5 py-4">
                      {/* E-12: Checkbox */}
                      <label className="shrink-0 cursor-pointer" onClick={e => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(draft.id)}
                          onChange={() => toggleSelect(draft.id)}
                          className="w-4 h-4 rounded border-gray-300 bg-black/5 text-primary accent-primary"
                        />
                      </label>

                      {/* Status indicator */}
                      <div className="shrink-0">
                        {draft.status === 'approved' ? (
                          <div className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          </div>
                        ) : draft.status === 'rejected' ? (
                          <div className="w-8 h-8 rounded-lg bg-red-500/15 flex items-center justify-center">
                            <X className="w-4 h-4 text-red-600" />
                          </div>
                        ) : (
                          <PulseDot color="#F59E0B" />
                        )}
                      </div>

                      {/* Contact info */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-sm font-semibold text-foreground truncate">{draft.contact?.name || 'Unknown'}</span>
                          <Badge variant="outline" className={DRAFT_STATUS_COLORS[draft.status] || DRAFT_STATUS_COLORS.draft}>
                            {draft.status.replace(/_/g, ' ')}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {draft.contact?.company?.name && (
                            <span className="flex items-center gap-1">
                              <Building2 className="w-3 h-3" />
                              {draft.contact.company.name}
                            </span>
                          )}
                          <span className="hidden sm:inline">|</span>
                          <span className="hidden sm:inline truncate max-w-[240px] md:max-w-[320px]">{draft.subject}</span>
                        </div>
                      </div>

                      {/* Confidence */}
                      <div className="hidden sm:flex items-center gap-2 shrink-0">
                        <span className={`text-sm font-bold tabular-nums ${confidenceColor(draft.confidenceScore)}`}>
                          {draft.confidenceScore != null ? `${draft.confidenceScore}%` : '-'}
                        </span>
                      </div>

                      {/* Date */}
                      <div className="hidden md:block text-xs text-muted-foreground tabular-nums shrink-0 w-20 text-right">
                        {draft.createdAt || '-'}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {(draft.status === 'approved' || draft.status === 'sent') && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 text-xs text-amber-600 hover:text-amber-300 hover:bg-amber-50 transition-all"
                            onClick={(e) => { e.stopPropagation(); handleFollowUp(draft); }}
                            disabled={followUpLoading}
                          >
                            <Reply className="w-3.5 h-3.5 mr-1" />
                            <span className="hidden lg:inline">Follow Up</span>
                          </Button>
                        )}
                        {navigateTo && draft.contact?.name && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 text-[11px] text-muted-foreground hover:text-foreground"
                            onClick={(e) => { e.stopPropagation(); navigateTo('leads'); }}
                          >
                            <User className="w-3 h-3 mr-1" />
                            <span className="hidden lg:inline">Leads</span>
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-xs text-primary hover:text-primary/80 hover:bg-primary/10 transition-all"
                          onClick={() => openDraft(draft)}
                        >
                          <Eye className="w-3.5 h-3.5 mr-1" />
                          Review
                        </Button>
                      </div>
                    </div>
                  </AnimatedCard>
                </StaggerItem>
              ))}
            </StaggerGrid>
          )}
        </>
      ) : (
        /* ═══════════════════════════════════════════════
           THREAD VIEW — drafts grouped by contact
           ═══════════════════════════════════════════════ */
        <>
          <div className="flex items-center justify-between">
            <SectionHeader
              title="Conversation Threads"
              subtitle={`${threadGroups.length} thread${threadGroups.length !== 1 ? 's' : ''} across ${filteredDrafts.length} draft${filteredDrafts.length !== 1 ? 's' : ''}`}
              className="!mb-0"
            />
          </div>

          {loading ? (
            <AnimatedCard hover={false}>
              <CardContent className="p-6 space-y-4">
                {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
              </CardContent>
            </AnimatedCard>
          ) : threadGroups.length === 0 ? (
            <EmptyState
              icon={MessagesSquare}
              title="No threads found"
              description={searchQuery ? 'Try adjusting your search query or filters.' : 'Threads will appear when multiple drafts exist for a contact.'}
            />
          ) : (
            <StaggerGrid className="space-y-3" stagger={0.05}>
              {threadGroups.map(group => {
                const { contact, drafts: threadDrafts } = group;
                const isExpanded = expandedThreads.has(contact.id);
                const lastDraft = threadDrafts[threadDrafts.length - 1];

                return (
                  <StaggerItem key={contact.id}>
                    <GlassPanel className="overflow-hidden">
                      {/* Thread header — always visible */}
                      <button
                        className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-white/[0.02] transition-colors"
                        onClick={() => toggleThread(contact.id)}
                      >
                        {/* Expand/collapse icon */}
                        <motion.div
                          animate={{ rotate: isExpanded ? 90 : 0 }}
                          transition={{ duration: 0.2 }}
                          className="shrink-0"
                        >
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        </motion.div>

                        {/* Contact avatar placeholder */}
                        <div
                          className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 text-sm font-bold"
                          style={{ background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.15), rgba(212, 175, 55, 0.05))', color: '#D4AF37' }}
                        >
                          {(contact.name || 'U').charAt(0).toUpperCase()}
                        </div>

                        {/* Contact info */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-sm font-semibold text-foreground truncate">{contact.name}</span>
                            <Badge variant="outline" className="bg-black/[0.05] border-white/[0.1] text-muted-foreground text-[10px] px-1.5">
                              {threadDrafts.length} draft{threadDrafts.length !== 1 ? 's' : ''}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            {contact.email && (
                              <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{contact.email}</span>
                            )}
                            {contact.company?.name && (
                              <><span className="hidden sm:inline">|</span><span className="hidden sm:inline flex items-center gap-1"><Building2 className="w-3 h-3" />{contact.company.name}</span></>
                            )}
                          </div>
                        </div>

                        {/* Last draft subject preview */}
                        <div className="hidden md:block text-xs text-muted-foreground truncate max-w-[200px] lg:max-w-[300px]">
                          {lastDraft?.subject}
                        </div>

                        {/* Last draft status */}
                        {lastDraft && (
                          <Badge variant="outline" className={`shrink-0 text-[10px] ${DRAFT_STATUS_COLORS[lastDraft.status] || DRAFT_STATUS_COLORS.draft}`}>
                            {lastDraft.status.replace(/_/g, ' ')}
                          </Badge>
                        )}
                      </button>

                      {/* Thread body — collapsible */}
                      <AnimatePresence initial={false}>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                            className="overflow-hidden"
                          >
                            <div className="border-t border-gray-200">
                              {threadDrafts.map((draft, idx) => {
                                const isFollowUp = !!draft.inReplyTo;
                                const bodyPreview = draft.body.length > 100 ? draft.body.slice(0, 100) + '...' : draft.body;
                                const replyLinked = draft.replies && draft.replies.length > 0 ? draft.replies[0] : null;

                                return (
                                  <div key={draft.id} className="relative">
                                    {/* Vertical connector line */}
                                    {idx < threadDrafts.length - 1 && (
                                      <div className="absolute left-[29px] top-[52px] bottom-0 w-px bg-gradient-to-b from-primary/20 to-transparent" />
                                    )}

                                    <div className="flex gap-4 px-5 py-3 hover:bg-white/[0.015] transition-colors">
                                      {/* Thread dot / connector node */}
                                      <div className="shrink-0 flex flex-col items-center pt-1">
                                        <div className={`w-2.5 h-2.5 rounded-full border-2 ${
                                          draft.status === 'approved' ? 'bg-emerald-500 border-emerald-400/30' :
                                          draft.status === 'rejected' ? 'bg-red-500 border-red-400/30' :
                                          draft.status === 'sent' ? 'bg-blue-500 border-blue-400/30' :
                                          'bg-amber-400 border-amber-400/30'
                                        }`} />
                                      </div>

                                      {/* Draft content */}
                                      <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                          {isFollowUp && (
                                            <Reply className="w-3 h-3 text-amber-600" />
                                          )}
                                          <span className="text-sm font-semibold text-foreground truncate">{draft.subject}</span>
                                          <Badge variant="outline" className={`text-[10px] shrink-0 ${DRAFT_STATUS_COLORS[draft.status] || DRAFT_STATUS_COLORS.draft}`}>
                                            {draft.status.replace(/_/g, ' ')}
                                          </Badge>
                                        </div>
                                        <p className="text-xs text-muted-foreground leading-relaxed mb-1.5">{bodyPreview}</p>
                                        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                                          <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{draft.createdAt}</span>
                                          {draft.confidenceScore != null && (
                                            <span className={`font-medium tabular-nums ${confidenceColor(draft.confidenceScore)}`}>
                                              {draft.confidenceScore}% confidence
                                            </span>
                                          )}
                                          {draft.messageId && (
                                            <span className="hidden lg:flex items-center gap-1 text-zinc-600">
                                              <MessagesSquare className="w-3 h-3" />threaded
                                            </span>
                                          )}
                                        </div>

                                        {/* Linked reply snippet */}
                                        {replyLinked && (
                                          <div className="mt-2 pl-3 border-l-2 border-primary/20">
                                            <p className="text-[10px] font-semibold text-primary mb-0.5 flex items-center gap-1">
                                              <Reply className="w-3 h-3" /> Reply received
                                              {replyLinked.category && (
                                                <Badge variant="outline" className="text-[9px] ml-1 border-gray-200 text-zinc-500">{replyLinked.category}</Badge>
                                              )}
                                            </p>
                                            <p className="text-[11px] text-muted-foreground leading-relaxed truncate max-w-lg">
                                              {replyLinked.body && replyLinked.body.length > 80
                                                ? replyLinked.body.slice(0, 80) + '...'
                                                : replyLinked.body || 'No content'}
                                            </p>
                                          </div>
                                        )}
                                      </div>

                                      {/* Actions */}
                                      <div className="flex items-center gap-1 shrink-0">
                                        {(draft.status === 'approved' || draft.status === 'sent') && (
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-7 text-[10px] text-amber-600 hover:text-amber-300 hover:bg-amber-50"
                                            onClick={(e) => { e.stopPropagation(); handleFollowUp(draft); }}
                                            disabled={followUpLoading}
                                          >
                                            <Reply className="w-3 h-3 mr-0.5" />
                                            <span className="hidden xl:inline">Follow Up</span>
                                          </Button>
                                        )}
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-7 text-[10px] text-primary hover:text-primary/80 hover:bg-primary/10"
                                          onClick={() => openDraft(draft)}
                                        >
                                          <Eye className="w-3 h-3 mr-0.5" />
                                          Review
                                        </Button>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </GlassPanel>
                  </StaggerItem>
                );
              })}
            </StaggerGrid>
          )}
        </>
      )}

      {/* -- Knowledge Search Dialog -- */}
      <Dialog open={showKnowledgeSearch} onOpenChange={setShowKnowledgeSearch}>
        <DialogContent
          className="backdrop-blur-xl bg-card/80 border border-gray-200 text-foreground max-w-2xl max-h-[85vh] shadow-2xl shadow-black/40"
          style={{ boxShadow: '0 25px 60px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(0, 0, 0, 0.05)' }}
        >
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center">
                <Search className="w-4 h-4 text-primary" />
              </div>
              Knowledge Base Search
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              Find relevant capabilities, case studies, and proof points to guide your draft generation.
            </DialogDescription>
          </DialogHeader>
          {attachedCapabilities.length > 0 && (
            <GlassPanel className="p-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">Attached:</span>
                {attachedCapabilities.map(cap => (
                  <Badge
                    key={cap.id}
                    variant="outline"
                    className="text-[10px] bg-primary/10 border-primary/25 text-primary gap-1"
                  >
                    {cap.title}
                    <button
                      onClick={() => setAttachedCapabilities(prev => prev.filter(c => c.id !== cap.id))}
                      className="ml-0.5 hover:text-red-600 transition-colors"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </Badge>
                ))}
                <button
                  onClick={() => setAttachedCapabilities([])}
                  className="text-[10px] text-muted-foreground hover:text-red-600 transition-colors"
                >
                  Clear all
                </button>
              </div>
            </GlassPanel>
          )}
          <KnowledgeSearch
            onUseCapability={(cap) => {
              if (!attachedCapabilities.find(c => c.id === cap.id)) {
                setAttachedCapabilities(prev => [...prev, {
                  id: cap.id,
                  title: cap.title,
                  summary: cap.summary,
                  category: cap.category,
                  relevanceScore: cap.relevanceScore,
                }]);
              }
            }}
            navigateTo={navigateTo}
          />
        </DialogContent>
      </Dialog>

      {/* -- Review Dialog -- */}
      <Dialog open={!!selectedDraft} onOpenChange={() => setSelectedDraft(null)}>
        <DialogContent
          className="backdrop-blur-xl bg-card/80 border border-gray-200 text-foreground max-w-4xl max-h-[90vh]"
          style={{ boxShadow: '0 25px 60px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(0, 0, 0, 0.05)' }}
        >
          <DialogHeader>
            <DialogTitle className="text-base flex items-center justify-between pr-6">
              <span className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center">
                  <FileText className="w-4 h-4 text-primary" />
                </div>
                Draft Review
              </span>
              {selectedDraft && (
                <Badge variant="outline" className={DRAFT_STATUS_COLORS[selectedDraft.status] || DRAFT_STATUS_COLORS.draft}>
                  {selectedDraft.status.replace(/_/g, ' ')}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          {selectedDraft && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mt-2">
              {/* Left: Contact Info + Research Context */}
              <div className="space-y-4">
                <GlassPanel className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 rounded-md bg-primary/15 flex items-center justify-center">
                      <User className="w-3.5 h-3.5 text-primary" />
                    </div>
                    <h3 className="text-xs font-bold uppercase tracking-widest text-foreground">Contact Info</h3>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-foreground">{selectedDraft.contact?.name || '-'}</p>
                    {selectedDraft.contact?.email && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Mail className="w-3 h-3" />{selectedDraft.contact.email}</p>
                    )}
                    {selectedDraft.contact?.jobTitle && (
                      <p className="text-xs text-muted-foreground">{selectedDraft.contact.jobTitle}</p>
                    )}
                    {selectedDraft.contact?.company && (
                      <p className="text-xs text-primary flex items-center gap-1.5 font-medium">
                        <Building2 className="w-3 h-3" />{selectedDraft.contact.company.name}
                      </p>
                    )}
                  </div>
                </GlassPanel>

                {selectedDraft.contact?.company?.research && (
                  <GlassPanel className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-6 h-6 rounded-md bg-primary/15 flex items-center justify-center">
                        <BookOpen className="w-3.5 h-3.5 text-primary" />
                      </div>
                      <h3 className="text-xs font-bold uppercase tracking-widest text-foreground">Research Context</h3>
                    </div>
                    <div className="space-y-2.5">
                      {selectedDraft.contact.company.research.businessOverview && (
                        <p className="text-xs text-muted-foreground leading-relaxed">{selectedDraft.contact.company.research.businessOverview}</p>
                      )}
                      {selectedDraft.contact.company.research.relevantServices && (
                        <p className="text-xs text-muted-foreground leading-relaxed">{selectedDraft.contact.company.research.relevantServices}</p>
                      )}
                      {selectedDraft.contact.company.research.nextAction && (
                        <p className="text-xs text-primary font-semibold">{'->'} {selectedDraft.contact.company.research.nextAction}</p>
                      )}
                    </div>
                  </GlassPanel>
                )}

                {/* Source Snippets */}
                {selectedDraft.sourceSnippets && selectedDraft.sourceSnippets.length > 0 && (
                  <GlassPanel className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-6 h-6 rounded-md bg-primary/15 flex items-center justify-center">
                        <Sparkles className="w-3.5 h-3.5 text-primary" />
                      </div>
                      <h3 className="text-xs font-bold uppercase tracking-widest text-foreground">Source Snippets ({selectedDraft.sourceSnippets.length})</h3>
                    </div>
                    <div className="space-y-2">
                      {selectedDraft.sourceSnippets.map(s => (
                        <div key={s.id} className="p-2.5 rounded-lg bg-black/[0.03] border border-gray-200">
                          <p className="text-[11px] font-semibold text-foreground">{s.title}</p>
                          <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">{s.content}</p>
                        </div>
                      ))}
                    </div>
                  </GlassPanel>
                )}

                {/* Assumption Flags */}
                {selectedDraft.assumptionFlags && selectedDraft.assumptionFlags.length > 0 && (
                  <GlassPanel className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-6 h-6 rounded-md bg-amber-500/15 flex items-center justify-center">
                        <Flag className="w-3.5 h-3.5 text-amber-600" />
                      </div>
                      <h3 className="text-xs font-bold uppercase tracking-widest text-amber-600">Assumptions ({selectedDraft.assumptionFlags.length})</h3>
                    </div>
                    <div className="space-y-2">
                      {selectedDraft.assumptionFlags.map(a => (
                        <div key={a.id} className="flex items-start gap-2.5">
                          <AlertTriangle className="w-3 h-3 text-amber-600 mt-0.5 shrink-0" />
                          <div>
                            <p className="text-xs text-foreground leading-relaxed">{a.assumption}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">{a.confidence}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </GlassPanel>
                )}
              </div>

              {/* Right: Draft Content */}
              <div className="lg:col-span-2 space-y-4">
                <GlassPanel className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-md bg-primary/15 flex items-center justify-center">
                        <Tag className="w-3.5 h-3.5 text-primary" />
                      </div>
                      <h3 className="text-xs font-bold uppercase tracking-widest text-foreground">Subject</h3>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                        onClick={() => setIsEditing(!isEditing)}
                      >
                        {isEditing ? 'Preview' : 'Edit'}
                      </Button>
                      {selectedDraft.confidenceScore != null && (
                        <Badge variant="outline" className={`text-[10px] ${confidenceColor(selectedDraft.confidenceScore)}`}>
                          Confidence: {selectedDraft.confidenceScore}
                        </Badge>
                      )}
                    </div>
                  </div>
                  {isEditing ? (
                    <Input
                      value={editSubject}
                      onChange={e => setEditSubject(e.target.value)}
                      className="text-sm bg-black/[0.03] border-gray-200 focus:border-primary/30"
                    />
                  ) : (
                    <p className="text-sm font-semibold text-foreground leading-relaxed">{selectedDraft.subject}</p>
                  )}
                </GlassPanel>

                <GlassPanel className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 rounded-md bg-primary/15 flex items-center justify-center">
                      <FileText className="w-3.5 h-3.5 text-primary" />
                    </div>
                    <h3 className="text-xs font-bold uppercase tracking-widest text-foreground">Body</h3>
                  </div>
                  {isEditing ? (
                    <Textarea
                      value={editBody}
                      onChange={e => setEditBody(e.target.value)}
                      rows={12}
                      className="text-sm bg-black/[0.03] border-gray-200 resize-none focus:border-primary/30"
                    />
                  ) : (
                    <ScrollArea className="max-h-[300px]">
                      <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{selectedDraft.body}</p>
                    </ScrollArea>
                  )}
                </GlassPanel>

                {selectedDraft.cta && (
                  <GlassPanel className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-6 h-6 rounded-md bg-primary/15 flex items-center justify-center">
                        <Target className="w-3.5 h-3.5 text-primary" />
                      </div>
                      <h3 className="text-xs font-bold uppercase tracking-widest text-foreground">Call to Action</h3>
                    </div>
                    {isEditing ? (
                      <Textarea
                        value={editCta}
                        onChange={e => setEditCta(e.target.value)}
                        rows={2}
                        className="text-sm bg-black/[0.03] border-gray-200 resize-none focus:border-primary/30"
                      />
                    ) : (
                      <p className="text-sm text-primary font-medium leading-relaxed">{selectedDraft.cta}</p>
                    )}
                  </GlassPanel>
                )}

                <Separator className="bg-black/[0.06]" />

                {/* Navigation Links */}
                <div className="flex items-center gap-3 mb-1">
                  {selectedDraft.status === 'approved' && navigateTo && (
                    <span
                      onClick={() => { setSelectedDraft(null); navigateTo('queue'); }}
                      className="text-xs text-muted-foreground cursor-pointer hover:text-primary transition-colors"
                    >{'View in Queue ->'}</span>
                  )}
                  {navigateTo && selectedDraft.contact?.company?.id && (
                    <span
                      onClick={() => navigateTo('companies')}
                      className="text-xs text-muted-foreground cursor-pointer hover:text-primary transition-colors"
                    >{'View Company ->'}</span>
                  )}
                </div>

                {/* Action Buttons + Scheduling (E-05) */}
                {selectedDraft.status === 'pending_review' && (
                  <GlassPanel className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-6 h-6 rounded-md bg-primary/15 flex items-center justify-center">
                        <Clock className="w-3.5 h-3.5 text-primary" />
                      </div>
                      <h3 className="text-xs font-bold uppercase tracking-widest text-foreground">Delivery Options</h3>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <div className="flex items-center gap-2">
                        <button
                          className={`px-3.5 py-2 rounded-lg text-xs font-medium border transition-all ${
                            scheduleMode === 'now'
                              ? 'bg-primary/15 border-primary/40 text-primary'
                              : 'bg-black/[0.03] border-gray-200 text-muted-foreground hover:text-foreground hover:border-gray-300'
                          }`}
                          onClick={() => setScheduleMode('now')}
                        >
                          <Send className="w-3 h-3 inline mr-1.5" />
                          Send Now
                        </button>
                        <button
                          className={`px-3.5 py-2 rounded-lg text-xs font-medium border transition-all ${
                            scheduleMode === 'schedule'
                              ? 'bg-primary/15 border-primary/40 text-primary'
                              : 'bg-black/[0.03] border-gray-200 text-muted-foreground hover:text-foreground hover:border-gray-300'
                          }`}
                          onClick={() => setScheduleMode('schedule')}
                        >
                          <CalendarIcon className="w-3 h-3 inline mr-1.5" />
                          Schedule
                        </button>
                      </div>
                      {scheduleMode === 'schedule' && (
                        <motion.div
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="flex items-center gap-2"
                        >
                          <Input
                            type="date"
                            min={minDateStr}
                            value={scheduleDate}
                            onChange={e => setScheduleDate(e.target.value)}
                            className="h-8 w-[150px] text-xs bg-black/[0.03] border-gray-200 focus:border-primary/30"
                          />
                          <Input
                            type="time"
                            value={scheduleTime}
                            onChange={e => setScheduleTime(e.target.value)}
                            className="h-8 w-[100px] text-xs bg-black/[0.03] border-gray-200 focus:border-primary/30"
                          />
                          {scheduleDate && (
                            <span className="text-[10px] text-muted-foreground">
                              {new Date(`${scheduleDate}T${scheduleTime}`).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                        </motion.div>
                      )}
                    </div>
                  </GlassPanel>
                )}

                <div className="flex items-center justify-end gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-10 px-5 border-red-500/30 text-red-600 hover:text-red-300 hover:bg-red-50 hover:border-red-500/50 transition-all"
                    onClick={handleReject}
                  >
                    <X className="w-4 h-4 mr-2" />
                    Reject
                  </Button>
                  <Button
                    size="sm"
                    className="h-10 px-5 bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all"
                    onClick={handleApprove}
                    disabled={scheduleMode === 'schedule' && !scheduleDate}
                  >
                    <Check className="w-4 h-4 mr-2" />
                    {scheduleMode === 'schedule' && scheduleDate ? 'Approve & Schedule' : 'Approve & Queue'}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* E-12: Floating Bulk Action Bar */}
      <AnimatePresence>
        {selectedIds.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50"
          >
            <GlassPanel className="flex items-center gap-3 px-5 py-3 shadow-2xl shadow-black/40" style={{ borderColor: 'rgba(212, 175, 55, 0.3)' }}>
              <span className="text-sm font-semibold text-primary">{selectedIds.size} selected</span>
              <div className="w-px h-6 bg-border" />
              <Button size="sm" className="h-8 text-xs gap-1.5 bg-emerald-500/20 text-emerald-600 hover:bg-emerald-500/30 border-0" onClick={() => handleBulkAction('approve')} disabled={bulkLoading}>
                <Check className="w-3.5 h-3.5" /> Approve
              </Button>
              <Button size="sm" className="h-8 text-xs gap-1.5 bg-red-500/20 text-red-600 hover:bg-red-500/30 border-0" onClick={() => handleBulkAction('reject')} disabled={bulkLoading}>
                <X className="w-3.5 h-3.5" /> Reject
              </Button>
              <Button size="sm" className="h-8 text-xs gap-1.5 bg-amber-500/20 text-amber-600 hover:bg-amber-500/30 border-0" onClick={() => handleBulkAction('regenerate')} disabled={bulkLoading}>
                <RefreshCw className="w-3.5 h-3.5" /> Regenerate
              </Button>
              <Button size="sm" className="h-8 text-xs gap-1.5 bg-black/[0.04] text-muted-foreground hover:bg-gray-200 border-0" onClick={() => handleBulkAction('delete')} disabled={bulkLoading}>
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </Button>
              <div className="w-px h-6 bg-border" />
              <button onClick={() => setSelectedIds(new Set())} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                Clear
              </button>
            </GlassPanel>
          </motion.div>
        )}
      </AnimatePresence>

      {/* E-10: A/B Test Creation Dialog */}
      <Dialog open={showAbTest} onOpenChange={setShowAbTest}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <GitBranch className="w-4 h-4 text-emerald-600" />
              Create A/B Test
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Generate multiple subject line variants for {selectedIds.size} selected contacts
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Test Name</Label>
              <Input
                value={abTestName}
                onChange={e => setAbTestName(e.target.value)}
                placeholder="e.g., Q3 Enterprise AI Outreach"
                className="h-9 text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Service Line</Label>
                <Select value={abTestServiceLine} onValueChange={setAbTestServiceLine}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Auto" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AI & Machine Learning">AI & ML</SelectItem>
                    <SelectItem value="Cloud Engineering">Cloud</SelectItem>
                    <SelectItem value="Data Engineering">Data</SelectItem>
                    <SelectItem value="Digital Transformation">DX</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Tone</Label>
                <Select value={abTestTone} onValueChange={setAbTestTone}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="professional">Professional</SelectItem>
                    <SelectItem value="casual">Casual</SelectItem>
                    <SelectItem value="executive">Executive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="p-3 rounded-lg bg-black/[0.03] border border-border/50 text-xs text-muted-foreground">
              AI will generate 3 subject line variants (curiosity-driven, value-driven, control) and assign them randomly across the {selectedIds.size} contacts.
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowAbTest(false)}>Cancel</Button>
              <Button onClick={handleCreateAbTest} disabled={abTestLoading} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                {abTestLoading ? 'Creating...' : 'Create Test'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
    </PageTransition>
  );
}