'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  FileText, Check, X, Eye, AlertTriangle, Sparkles, Building2, Mail, User, Tag, Target, BookOpen, Flag,
} from 'lucide-react';

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
}

interface AssumptionFlag {
  id: string;
  assumption: string;
  confidence: string;
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
  sourceSnippets?: SourceSnippet[];
  assumptionFlags?: AssumptionFlag[];
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

/* ── AI Demo Draft Type ── */
interface AIDemoDraft {
  subject: string;
  body: string;
  cta: string;
  confidenceScore: number;
  assumptions: string[];
  sourceSnippets: { id: string; title: string; snippetType: string }[];
  generatedAt: string;
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

  // AI Demo state
  const [showAiDemo, setShowAiDemo] = useState(false);
  const [aiName, setAiName] = useState('');
  const [aiTitle, setAiTitle] = useState('');
  const [aiCompany, setAiCompany] = useState('');
  const [aiIndustry, setAiIndustry] = useState('');
  const [aiTone, setAiTone] = useState('professional');
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiResult, setAiResult] = useState<AIDemoDraft | null>(null);
  const [aiError, setAiError] = useState('');

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

  const handleApprove = async () => {
    if (!selectedDraft) return;
    try {
      await fetch('/api/drafts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selectedDraft.id, status: 'approved', ...(isEditing ? { subject: editSubject, body: editBody, cta: editCta } : {}) }),
      });
      setSelectedDraft(null);
      setRefreshKey(k => k + 1);
    } catch { /* ignore */ }
  };

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

  const confidenceColor = (s?: number) => !s ? 'text-zinc-500' : s >= 85 ? 'text-emerald-400' : s >= 70 ? 'text-amber-400' : 'text-red-400';

  const handleAiGenerate = async () => {
    if (!aiName.trim()) return;
    setAiGenerating(true);
    setAiError('');
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
          tone: aiTone,
        }),
      });
      const data = await res.json();
      if (data.success && data.draft) {
        setAiResult(data.draft);
      } else {
        setAiError(data.error || 'Generation failed');
      }
    } catch {
      setAiError('Network error — please try again');
    }
    setAiGenerating(false);
  };

  return (
    <div className="max-h-[calc(100vh-200px)] overflow-y-auto space-y-4 pr-1">
      {/* ── Tab Filters ── */}
      <Card className="bg-card border border-border">
        <CardContent className="p-2">
          <div className="flex items-center gap-1">
            {TAB_OPTIONS.map(t => (
              <Button
                key={t.value}
                variant={tab === t.value ? 'default' : 'ghost'}
                size="sm"
                className={`h-8 text-xs px-3 ${tab === t.value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                onClick={() => setTab(t.value)}
              >
                {t.label}
              </Button>
            ))}
            <div className="flex-1" />
            <Button
              variant={showAiDemo ? 'default' : 'outline'}
              size="sm"
              className={`h-8 text-xs gap-1.5 ${showAiDemo ? 'bg-primary text-primary-foreground' : 'border-primary/30 text-primary hover:bg-primary/10'}`}
              onClick={() => setShowAiDemo(!showAiDemo)}
            >
              <Sparkles className="w-3.5 h-3.5" />
              Test AI Engine
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── AI Demo Panel ── */}
      {showAiDemo && (
        <Card className="bg-card border border-primary/20">
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-primary">
              <Sparkles className="w-4 h-4" />
              AI Draft Generator
              <span className="text-[10px] font-normal text-muted-foreground ml-1">No database needed — test the AI engine directly</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Contact Name *</label>
                <Input
                  placeholder="e.g. Sarah Chen"
                  value={aiName}
                  onChange={e => setAiName(e.target.value)}
                  className="h-8 text-sm bg-background border-border"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Job Title</label>
                <Input
                  placeholder="e.g. VP of Engineering"
                  value={aiTitle}
                  onChange={e => setAiTitle(e.target.value)}
                  className="h-8 text-sm bg-background border-border"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Company</label>
                <Input
                  placeholder="e.g. Acme Corp"
                  value={aiCompany}
                  onChange={e => setAiCompany(e.target.value)}
                  className="h-8 text-sm bg-background border-border"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Industry</label>
                <Input
                  placeholder="e.g. Financial Services"
                  value={aiIndustry}
                  onChange={e => setAiIndustry(e.target.value)}
                  className="h-8 text-sm bg-background border-border"
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Tone</label>
                <div className="flex gap-1">
                  {(['professional', 'casual', 'executive'] as const).map(t => (
                    <Button
                      key={t}
                      variant={aiTone === t ? 'default' : 'outline'}
                      size="sm"
                      className={`h-7 text-[11px] px-2.5 capitalize ${aiTone === t ? 'bg-primary text-primary-foreground' : 'border-border text-muted-foreground'}`}
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
                className="h-8 text-xs bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
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
              <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-md px-3 py-2">{aiError}</p>
            )}

            {/* AI Result */}
            {aiResult && (
              <div className="space-y-3 pt-2 border-t border-border">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                  <div className="lg:col-span-2 space-y-3">
                    <div className="space-y-1">
                      <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Subject</p>
                      <p className="text-sm font-medium text-foreground">{aiResult.subject}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Email Body</p>
                      <div className="p-3 rounded-md bg-background border border-border">
                        <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{aiResult.body}</p>
                      </div>
                    </div>
                    {aiResult.cta && (
                      <div className="space-y-1">
                        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Call to Action</p>
                        <p className="text-sm text-primary">{aiResult.cta}</p>
                      </div>
                    )}
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Confidence</span>
                      <span className={`text-sm font-bold tabular-nums ${confidenceColor(aiResult.confidenceScore)}`}>{aiResult.confidenceScore}%</span>
                    </div>
                    {aiResult.assumptions.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-[11px] font-medium text-amber-400 uppercase tracking-wider">Assumptions</p>
                        {aiResult.assumptions.map((a, i) => (
                          <div key={i} className="flex items-start gap-1.5">
                            <AlertTriangle className="w-3 h-3 text-amber-400 mt-0.5 shrink-0" />
                            <p className="text-xs text-muted-foreground">{a}</p>
                          </div>
                        ))}
                      </div>
                    )}
                    {aiResult.sourceSnippets.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-[11px] font-medium text-primary uppercase tracking-wider">Source Capabilities</p>
                        {aiResult.sourceSnippets.map(s => (
                          <div key={s.id} className="flex items-center gap-1.5">
                            <BookOpen className="w-3 h-3 text-primary shrink-0" />
                            <span className="text-xs text-muted-foreground">{s.title}</span>
                            <Badge variant="outline" className="text-[9px] border-border text-zinc-500 ml-auto">{s.snippetType?.replace('_', ' ')}</Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Drafts Table ── */}
      <Card className="bg-card border border-border">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-muted-foreground text-xs">Contact</TableHead>
                    <TableHead className="text-muted-foreground text-xs hidden sm:table-cell">Company</TableHead>
                    <TableHead className="text-muted-foreground text-xs">Subject</TableHead>
                    <TableHead className="text-muted-foreground text-xs">Status</TableHead>
                    <TableHead className="text-muted-foreground text-xs text-right hidden sm:table-cell">Confidence</TableHead>
                    <TableHead className="text-muted-foreground text-xs text-right hidden md:table-cell">Date</TableHead>
                    <TableHead className="text-muted-foreground text-xs text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {drafts.map(draft => (
                    <TableRow key={draft.id} className="border-border">
                      <TableCell className="text-foreground text-sm font-medium">
                        <span>{draft.contact?.name || '—'}</span>
                        {navigateTo && draft.contact?.name && (
                          <span
                            onClick={(e) => { e.stopPropagation(); navigateTo('leads'); }}
                            className="ml-2 text-xs text-muted-foreground cursor-pointer hover:text-primary transition-colors"
                          >View in Leads</span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm hidden sm:table-cell">{draft.contact?.company?.name || '—'}</TableCell>
                      <TableCell className="text-foreground text-sm max-w-[200px] md:max-w-[280px] truncate">{draft.subject}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={DRAFT_STATUS_COLORS[draft.status] || DRAFT_STATUS_COLORS.draft}>
                          {draft.status.replace(/_/g, ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell className={`text-right text-sm tabular-nums hidden sm:table-cell ${confidenceColor(draft.confidenceScore)}`}>
                        {draft.confidenceScore ?? '—'}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs text-right hidden md:table-cell whitespace-nowrap">{draft.createdAt || '—'}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-primary hover:text-primary/80"
                          onClick={() => openDraft(draft)}
                        >
                          <Eye className="w-3.5 h-3.5 mr-1" />
                          Review
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {drafts.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-muted-foreground text-sm text-center py-8">
                        No drafts found.
                        {navigateTo && (
                          <span
                            onClick={() => navigateTo('import')}
                            className="ml-2 text-xs text-primary cursor-pointer hover:text-primary/80 transition-colors"
                          >Import leads first</span>
                        )}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Review Dialog ── */}
      <Dialog open={!!selectedDraft} onOpenChange={() => setSelectedDraft(null)}>
        <DialogContent className="bg-card border border-border text-foreground max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center justify-between pr-6">
              <span className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" />
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
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Left: Contact Info + Research Context */}
              <div className="space-y-4">
                <Card className="bg-background border border-border">
                  <CardHeader className="pb-2 pt-3 px-4">
                    <CardTitle className="text-xs font-semibold flex items-center gap-2 text-primary">
                      <User className="w-3.5 h-3.5" />
                      Contact Info
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-3 space-y-1.5">
                    <p className="text-sm font-medium text-foreground">{selectedDraft.contact?.name || '—'}</p>
                    {selectedDraft.contact?.email && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1"><Mail className="w-3 h-3" />{selectedDraft.contact.email}</p>
                    )}
                    {selectedDraft.contact?.jobTitle && (
                      <p className="text-xs text-muted-foreground">{selectedDraft.contact.jobTitle}</p>
                    )}
                    {selectedDraft.contact?.company && (
                      <p className="text-xs text-primary flex items-center gap-1">
                        <Building2 className="w-3 h-3" />{selectedDraft.contact.company.name}
                      </p>
                    )}
                  </CardContent>
                </Card>

                {selectedDraft.contact?.company?.research && (
                  <Card className="bg-background border border-border">
                    <CardHeader className="pb-2 pt-3 px-4">
                      <CardTitle className="text-xs font-semibold flex items-center gap-2 text-primary">
                        <BookOpen className="w-3.5 h-3.5" />
                        Research Context
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-3 space-y-2">
                      {selectedDraft.contact.company.research.businessOverview && (
                        <p className="text-xs text-muted-foreground leading-relaxed">{selectedDraft.contact.company.research.businessOverview}</p>
                      )}
                      {selectedDraft.contact.company.research.relevantServices && (
                        <p className="text-xs text-muted-foreground leading-relaxed">{selectedDraft.contact.company.research.relevantServices}</p>
                      )}
                      {selectedDraft.contact.company.research.nextAction && (
                        <p className="text-xs text-primary font-medium">→ {selectedDraft.contact.company.research.nextAction}</p>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Source Snippets */}
                {selectedDraft.sourceSnippets && selectedDraft.sourceSnippets.length > 0 && (
                  <Card className="bg-background border border-border">
                    <CardHeader className="pb-2 pt-3 px-4">
                      <CardTitle className="text-xs font-semibold flex items-center gap-2 text-primary">
                        <Sparkles className="w-3.5 h-3.5" />
                        Source Snippets ({selectedDraft.sourceSnippets.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-3 space-y-2">
                      {selectedDraft.sourceSnippets.map(s => (
                        <div key={s.id} className="p-2 rounded bg-card border border-border">
                          <p className="text-[11px] font-medium text-foreground">{s.title}</p>
                          <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{s.content}</p>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {/* Assumption Flags */}
                {selectedDraft.assumptionFlags && selectedDraft.assumptionFlags.length > 0 && (
                  <Card className="bg-background border border-border">
                    <CardHeader className="pb-2 pt-3 px-4">
                      <CardTitle className="text-xs font-semibold flex items-center gap-2 text-amber-400">
                        <Flag className="w-3.5 h-3.5" />
                        Assumptions ({selectedDraft.assumptionFlags.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-3 space-y-2">
                      {selectedDraft.assumptionFlags.map(a => (
                        <div key={a.id} className="flex items-start gap-2">
                          <AlertTriangle className="w-3 h-3 text-amber-400 mt-0.5 shrink-0" />
                          <div>
                            <p className="text-xs text-foreground">{a.assumption}</p>
                            <p className="text-[10px] text-muted-foreground">{a.confidence}</p>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Right: Draft Content */}
              <div className="lg:col-span-2 space-y-4">
                <Card className="bg-background border border-border">
                  <CardHeader className="pb-2 pt-3 px-4">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-xs font-semibold flex items-center gap-2 text-primary">
                        <Tag className="w-3.5 h-3.5" />
                        Subject
                      </CardTitle>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-[10px] text-muted-foreground hover:text-foreground"
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
                  </CardHeader>
                  <CardContent className="px-4 pb-3">
                    {isEditing ? (
                      <Input
                        value={editSubject}
                        onChange={e => setEditSubject(e.target.value)}
                        className="text-sm bg-card border-border"
                      />
                    ) : (
                      <p className="text-sm font-medium text-foreground">{selectedDraft.subject}</p>
                    )}
                  </CardContent>
                </Card>

                <Card className="bg-background border border-border">
                  <CardHeader className="pb-2 pt-3 px-4">
                    <CardTitle className="text-xs font-semibold flex items-center gap-2 text-primary">
                      <FileText className="w-3.5 h-3.5" />
                      Body
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-3">
                    {isEditing ? (
                      <Textarea
                        value={editBody}
                        onChange={e => setEditBody(e.target.value)}
                        rows={12}
                        className="text-sm bg-card border-border resize-none"
                      />
                    ) : (
                      <ScrollArea className="max-h-[280px]">
                        <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{selectedDraft.body}</p>
                      </ScrollArea>
                    )}
                  </CardContent>
                </Card>

                {selectedDraft.cta && (
                  <Card className="bg-background border border-border">
                    <CardHeader className="pb-2 pt-3 px-4">
                      <CardTitle className="text-xs font-semibold flex items-center gap-2 text-primary">
                        <Target className="w-3.5 h-3.5" />
                        Call to Action
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-3">
                      {isEditing ? (
                        <Textarea
                          value={editCta}
                          onChange={e => setEditCta(e.target.value)}
                          rows={2}
                          className="text-sm bg-card border-border resize-none"
                        />
                      ) : (
                        <p className="text-sm text-foreground">{selectedDraft.cta}</p>
                      )}
                    </CardContent>
                  </Card>
                )}

                <Separator className="bg-border" />

                {/* Navigation Links */}
                <div className="flex items-center gap-3 mb-1">
                  {selectedDraft.status === 'approved' && navigateTo && (
                    <span
                      onClick={() => { setSelectedDraft(null); navigateTo('queue'); }}
                      className="text-xs text-muted-foreground cursor-pointer hover:text-primary transition-colors"
                    >View in Queue →</span>
                  )}
                  {navigateTo && selectedDraft.contact?.company?.id && (
                    <span
                      onClick={() => navigateTo('companies')}
                      className="text-xs text-muted-foreground cursor-pointer hover:text-primary transition-colors"
                    >View Company →</span>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 border-red-500/30 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                    onClick={handleReject}
                  >
                    <X className="w-4 h-4 mr-1.5" />
                    Reject
                  </Button>
                  <Button
                    size="sm"
                    className="h-9 bg-primary text-primary-foreground hover:bg-primary/90"
                    onClick={handleApprove}
                  >
                    <Check className="w-4 h-4 mr-1.5" />
                    Approve & Queue
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}