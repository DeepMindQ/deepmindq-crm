'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, ShieldCheck, Sparkles, Plus, Archive, Mail, Phone, MapPin,
  Building2, Linkedin, Copy, RefreshCw, FileText, Clock, Loader2, X,
  AlertTriangle, CheckCircle2, XCircle, ChevronDown, ChevronUp,
  ExternalLink, Eye, ChevronRight, UserCircle, MessageSquare, Search,
  Brain, Target, Zap, Lightbulb, TrendingUp, Gauge, Award, Network,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { useAppStore } from '@/lib/store';
import { EmptyState } from '@/components/shared/design-system';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { PageTransition, AnimatedCard, GlassPanel } from '@/components/ui/animated-components';
import {
  Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbPage, BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { ConfidenceBar } from '@/components/enterprise/ConfidenceBar';
import { EvidenceBadge } from '@/components/enterprise/EvidenceBadge';
import { getHealthVariant } from '@/lib/constants';
import type { Contact, ContactNote, Draft, EmailHealthCheck } from '@/lib/types';
import { logger } from '@/lib/logger';

/* ═══════════════════════════════════════════════════
   Constants
   ═══════════════════════════════════════════════════ */
const PURPLE = '#7c3aed';
const PURPLE_GRAD = 'linear-gradient(135deg, #6d28d9, #7c3aed, #a78bfa)';

/* ═══════════════════════════════════════════════════
   Score Ring
   ═══════════════════════════════════════════════════ */
function ScoreRing({ score, size = 64, strokeWidth = 5, label }: {
  score: number; size?: number; strokeWidth?: number; label?: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * radius;
  const offset = circ - (score / 100) * circ;
  const c = score >= 80 ? '#059669' : score >= 60 ? '#D97706' : score >= 40 ? '#ea580c' : '#DC2626';
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        <svg aria-hidden="true" width={size} height={size} className="-rotate-90">
          <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke="#F3F4F6" strokeWidth={strokeWidth} />
          <motion.circle cx={size/2} cy={size/2} r={radius}
            fill="none" stroke={c} strokeWidth={strokeWidth} strokeLinecap="round"
            strokeDasharray={circ} initial={{ strokeDashoffset: circ }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1, ease: [0.22, 1, 0.36, 1], delay: 0.3 }}
            style={{ filter: `drop-shadow(0 0 5px ${c}40)` }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-base font-black tabular-nums" style={{ color: c }}>{Math.round(score)}</span>
        </div>
      </div>
      {label && <span className="text-[11px] text-muted-foreground font-medium">{label}</span>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   Stat Card
   ═══════════════════════════════════════════════════ */
function BuyerStat({ icon: Icon, label, value, color }: { icon: any; label: string; value: string | number; color: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50/80 border border-gray-100">
      <Icon size={13} style={{ color }} />
      <div>
        <p className="text-[11px] text-muted-foreground uppercase tracking-wider">{label}</p>
        <p className="text-sm font-black" style={{ color }}>{value}</p>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   Panel
   ═══════════════════════════════════════════════════ */
function IntelPanel({ title, icon, accent, count, children, onRefresh }: {
  title: string; icon: any; accent?: string; count?: number; children: React.ReactNode; onRefresh?: () => void;
}) {
  return (
    <div className="rounded-xl border border-gray-200/80 bg-white overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 bg-gray-50/50">
        <div className="h-4 w-1 rounded-full" style={{ background: accent || PURPLE }} />
        {React.createElement(icon, { size: 14, style: { color: accent || PURPLE } })}
        <h3 className="text-xs font-bold text-foreground flex-1">{title}</h3>
        {count !== undefined && <Badge className="text-[11px] px-1.5 py-0 bg-gray-100 text-muted-foreground">{count}</Badge>}
        {onRefresh && (
          <button onClick={onRefresh} className="text-muted-foreground hover:text-foreground transition-colors">
            <RefreshCw size={12} />
          </button>
        )}
      </div>
      <div className="p-3">{children}</div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════ */
interface ContactDraft extends Draft {
  sourceType?: string | null;
  isTemplateBased?: boolean | null;
  confidence?: string | null;
}

interface GeneratedEmailResult {
  subject: string;
  body: string;
  matchScore: number | null;
  confidence: string | null;
  tone: string | null;
  emailLength: string | null;
  ctaStyle: string | null;
}

/* ═══════════════════════════════════════════════════
   Main Component — Buyer Intelligence Profile
   ═══════════════════════════════════════════════════ */
export default function ContactDetailScreen() {
  const { selectedContactId, setActiveView, setSelectedCompanyId } = useAppStore();
  const qc = useQueryClient();

  const [tab, setTab] = useState('buyer_intel');
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteBody, setNoteBody] = useState('');
  const [noteType, setNoteType] = useState('');
  const [deleteNoteId, setDeleteNoteId] = useState<string | null>(null);
  const [archiveConfirmOpen, setArchiveConfirmOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '', email: '', jobTitle: '', roleBucket: '', phone: '', location: '', linkedinUrl: '',
  });
  const [validationDetail, setValidationDetail] = useState<EmailHealthCheck | null>(null);
  const [showValidation, setShowValidation] = useState(false);
  const [briefing, setBriefing] = useState<any>(null);
  const [briefingLoading, setBriefingLoading] = useState(false);
  const [generatedEmail, setGeneratedEmail] = useState<GeneratedEmailResult | null>(null);

  /* ── Fetch Buyer Intelligence Briefing ── */
  const fetchBriefing = async () => {
    if (!data?.companyId || !selectedContactId) return;
    setBriefingLoading(true);
    try {
      const res = await fetch(`/api/contacts/${selectedContactId}/briefing`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ briefingType: 'meeting_prep', skipNarrative: true }),
      });
      if (res.ok) setBriefing(await res.json());
    } catch (err) { logger.error('[briefing] failed:', { error: err }); }
    finally { setBriefingLoading(false); }
  };

  /* ── Query ── */
  const { data, isLoading, error, refetch } = useQuery<Contact>({
    queryKey: ['contact', selectedContactId],
    queryFn: () => fetch(`/api/contacts/${selectedContactId}`).then(r => {
      if (!r.ok) throw new Error('Failed to load contact');
      return r.json();
    }),
    enabled: !!selectedContactId,
  });

  /* ── Mutations ── */
  const addNote = useMutation({
    mutationFn: (body: { body: string; noteType: string }) =>
      fetch('/api/notes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, contactId: selectedContactId }) })
        .then(r => { if (!r.ok) throw new Error('Failed'); return r.json(); }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['contact', selectedContactId] }); setNoteOpen(false); setNoteBody(''); setNoteType(''); toast.success('Note added'); },
    onError: () => toast.error('Failed to add note'),
  });

  const deleteNoteMutation = useMutation({
    mutationFn: (noteId: string) => fetch(`/api/notes/${noteId}`, { method: 'DELETE' }).then(r => { if (!r.ok) throw new Error('Failed'); return r.json(); }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['contact', selectedContactId] }); setDeleteNoteId(null); toast.success('Note deleted'); },
    onError: () => toast.error('Failed to delete note'),
  });

  const archiveContact = useMutation({
    mutationFn: () => fetch(`/api/contacts/${selectedContactId}`, { method: 'DELETE' }).then(r => { if (!r.ok) throw new Error('Failed'); return r.json(); }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['contact'] }); toast.success('Contact archived'); setActiveView('contacts'); },
    onError: () => toast.error('Failed to archive contact'),
  });

  const editContact = useMutation({
    mutationFn: (form: typeof editForm) => fetch(`/api/contacts/${selectedContactId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      .then(r => r.ok ? r.json() : r.json().then((e: { error?: string }) => { throw new Error(e.error || 'Failed'); })),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['contact', selectedContactId] }); setEditOpen(false); toast.success('Contact updated'); },
    onError: (e: Error) => toast.error(e.message),
  });

  const validateEmail = useMutation({
    mutationFn: () => fetch(`/api/contacts/${selectedContactId}/validate`, { method: 'POST' })
      .then(r => r.ok ? r.json() : r.json().then((e: { error?: string }) => { throw new Error(e.error || 'Validation failed'); })),
    onSuccess: (result: EmailHealthCheck) => { qc.invalidateQueries({ queryKey: ['contact', selectedContactId] }); setValidationDetail(result); setShowValidation(true); toast.success('Email validated'); },
    onError: (e: Error) => toast.error(e.message),
  });

  const generateEmail = useMutation({
    mutationFn: () => fetch(`/api/contacts/${selectedContactId}/generate-email`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
      .then(r => r.ok ? r.json() : r.json().then((e: { error?: string }) => { throw new Error(e.error || 'Failed'); })),
    onSuccess: (result: GeneratedEmailResult) => { qc.invalidateQueries({ queryKey: ['contact', selectedContactId] }); setGeneratedEmail(result); toast.success('Email generated'); },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateDraftStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => fetch(`/api/drafts/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) })
      .then(r => r.ok ? r.json() : r.json().then((e: { error?: string }) => { throw new Error(e.error || 'Failed'); })),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['contact', selectedContactId] }); toast.success('Draft updated'); },
    onError: (e: Error) => toast.error(e.message),
  });

  const copyToClipboard = async (text: string) => {
    try { await navigator.clipboard.writeText(text); toast.success('Copied'); }
    catch { toast.error('Failed to copy'); }
  };

  const openEditDialog = () => {
    if (!data) return;
    setEditForm({ name: data.name || '', email: data.email || '', jobTitle: data.jobTitle || '', roleBucket: data.roleBucket || '', phone: data.phone || '', location: data.location || '', linkedinUrl: data.linkedinUrl || '' });
    setEditOpen(true);
  };

  const navigateToCompany = (companyId: string) => { setSelectedCompanyId(companyId); setActiveView('company-detail'); };

  /* ── Auto-trigger briefing ── */
  const briefingFetchedRef = useRef(false);
  useEffect(() => {
    if (data?.companyId && !briefing && !briefingLoading && !briefingFetchedRef.current) {
      briefingFetchedRef.current = true;
      fetchBriefing();
    }
  }, [data?.companyId, briefing, briefingLoading]);  

  /* ── Guards ── */
  if (!selectedContactId) {
    return <EmptyState icon={Mail} title="No contact selected" description="Go back to Contacts and select one." actionLabel="Back to Contacts" onAction={() => setActiveView('contacts')} />;
  }
  if (isLoading) {
    return (
      <div className="p-6 space-y-5 bg-gray-50 min-h-screen">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <Skeleton className="h-72 rounded-xl" /><Skeleton className="h-72 rounded-xl col-span-2" />
        </div>
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="p-6 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3">
        <AlertTriangle className="size-5 text-red-500 shrink-0" />
        <div><p className="text-sm font-semibold text-red-900">Failed to load contact</p><p className="text-sm text-red-700 mt-0.5">{error?.message}</p></div>
      </div>
    );
  }

  const notes = data.notes ?? [];
  const timeline = data.timeline ?? [];
  const drafts = (data.drafts ?? []) as ContactDraft[];
  const healthChecks = data.healthChecks ?? [];
  const latestCheck = healthChecks[0] ?? null;

  /* ═══════════════════════════════════════════════════
     Render — Buyer Intelligence Profile
     ═══════════════════════════════════════════════════ */
  return (
    <div className="min-h-screen bg-gray-50">
      <PageTransition>
        {/* ── Top Navigation Bar ── */}
        <div className="sticky top-0 z-30 border-b border-gray-200" style={{ background: 'rgba(6,9,15,0.88)', backdropFilter: 'blur(20px)' }}>
          <div className="flex items-center justify-between max-w-[1400px] mx-auto px-5 py-3">
            <div className="flex items-center gap-3">
              <motion.button whileHover={{ x: -2 }} whileTap={{ scale: 0.95 }} onClick={() => setActiveView('contacts')}
                className="w-8 h-8 rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center hover:border-purple-500/30 transition-colors">
                <ArrowLeft size={15} className="text-muted-foreground" />
              </motion.button>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full flex items-center justify-center bg-purple-100 text-xs font-bold" style={{ color: PURPLE }}>
                  {data.name?.charAt(0)?.toUpperCase()}
                </div>
                <div>
                  <span className="text-sm font-bold text-white">{data.name}</span>
                  <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
                    {data.jobTitle && <span>{data.jobTitle}</span>}
                    {data.company?.name && <><span className="mx-0.5">·</span><span>{data.company.name}</span></>}
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={() => validateEmail.mutate()} disabled={validateEmail.isPending}
                className="gap-1.5 h-8 text-[11px] bg-purple-600 hover:bg-purple-700 text-white">
                {validateEmail.isPending ? <Loader2 size={12} className="animate-spin" /> : <ShieldCheck size={12} />}
                Validate
              </Button>
              <Button size="sm" onClick={() => { setTab('ai-emails'); generateEmail.mutate(); }} disabled={generateEmail.isPending}
                className="gap-1.5 h-8 text-[11px] bg-blue-600 hover:bg-blue-700 text-white">
                {generateEmail.isPending ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                AI Email
              </Button>
              <Button size="sm" variant="outline" onClick={openEditDialog}
                className="gap-1.5 h-8 text-[11px] border-gray-600 text-gray-300 hover:text-white">
                Edit
              </Button>
            </div>
          </div>
        </div>

        {/* ── Breadcrumbs ── */}
        <div className="max-w-[1400px] mx-auto px-5 pt-4 pb-1">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild><span className="cursor-pointer hover:text-foreground text-muted-foreground" onClick={() => setActiveView('contacts')}>Intelligence</span></BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink asChild><span className="cursor-pointer hover:text-foreground text-muted-foreground" onClick={() => setActiveView('contacts')}>Contacts</span></BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage className="font-medium">{data.name}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>

        <div className="max-w-[1400px] mx-auto px-5 py-5">
          {/* ── Buyer Intelligence Hero ── */}
          <AnimatedCard delay={0} glow="rgba(124, 58, 237, 0.1)">
            <div className="overflow-hidden">
              <div className="h-1" style={{ background: PURPLE_GRAD }} />
              <div className="p-5">
                <div className="flex items-start gap-5">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <Brain size={18} style={{ color: PURPLE }} />
                      <h2 className="text-lg font-black text-foreground">Buyer Intelligence Profile</h2>
                      <Badge className="text-[11px] px-1.5 py-0 bg-purple-50 text-purple-600 border-purple-200">{data.roleBucket || 'Unknown'}</Badge>
                      {data.emailHealth && data.emailHealth !== 'unknown' && (
                        <span className={cn('text-[11px] px-1.5 py-0 rounded-full font-medium', getHealthVariant(data.emailHealth))}>
                          <ShieldCheck size={10} className="inline mr-0.5" />{data.emailHealth}
                        </span>
                      )}
                    </div>

                    {/* Contact info row */}
                    <div className="flex flex-wrap gap-3 mb-4 text-xs">
                      {data.email && <span className="flex items-center gap-1 text-muted-foreground"><Mail size={11} />{data.email}</span>}
                      {data.phone && <span className="flex items-center gap-1 text-muted-foreground"><Phone size={11} />{data.phone}</span>}
                      {data.location && <span className="flex items-center gap-1 text-muted-foreground"><MapPin size={11} />{data.location}</span>}
                      {data.linkedinUrl && (
                        <a href={data.linkedinUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-blue-600 hover:underline">
                          <Linkedin size={11} /> LinkedIn
                        </a>
                      )}
                      {data.company?.name && (
                        <button onClick={() => navigateToCompany(data.companyId)} className="flex items-center gap-1 text-amber-600 hover:underline">
                          <Building2 size={11} />{data.company.name}<ChevronRight size={11} />
                        </button>
                      )}
                    </div>

                    {/* Buyer Stats */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <BuyerStat icon={Target} label="Influence" value={briefing?.buyerProfile?.influenceScore ?? data.emailHealthScore ?? '-'} color={PURPLE} />
                      <BuyerStat icon={MessageSquare} label="Drafts" value={drafts.length} color="#2563eb" />
                      <BuyerStat icon={FileText} label="Notes" value={notes.length} color="#059669" />
                      <BuyerStat icon={Clock} label="Last Contact" value={data.lastContactedAt ? formatDistanceToNow(new Date(data.lastContactedAt), { addSuffix: true }) : 'Never'} color="#d97706" />
                    </div>
                  </div>

                  {/* Influence Score Ring */}
                  <ScoreRing score={briefing?.buyerProfile?.influenceScore ?? 50} size={80} strokeWidth={5} label="Influence" />
                </div>

                {/* Detected Priorities */}
                {briefing?.buyerProfile?.detectedPriorities?.length > 0 && (
                  <div className="mt-4 flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] text-muted-foreground uppercase tracking-wider">Priorities:</span>
                    {briefing.buyerProfile.detectedPriorities.map((p: string, i: number) => (
                      <Badge key={i} className="text-[11px] px-2 py-0 bg-purple-50 text-purple-700 border-purple-200">{p}</Badge>
                    ))}
                  </div>
                )}

                {/* Action strip */}
                <div className="mt-4 flex items-center gap-2">
                  <Button size="sm" onClick={fetchBriefing} disabled={briefingLoading}
                    className="gap-1.5 h-8 text-[11px] bg-purple-600 hover:bg-purple-700 text-white">
                    {briefingLoading ? <Loader2 size={12} className="animate-spin" /> : <Brain size={12} />}
                    {briefingLoading ? 'Analyzing...' : 'Run Buyer Intel'}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setNoteOpen(true)}
                    className="gap-1.5 h-8 text-[11px] border-gray-200">
                    <Plus size={12} /> Add Note
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setArchiveConfirmOpen(true)}
                    className="gap-1.5 h-8 text-[11px] border-red-200 text-red-500 hover:bg-red-50 ml-auto">
                    <Archive size={12} /> Archive
                  </Button>
                </div>
              </div>
            </div>
          </AnimatedCard>

          {/* ── View Tabs ── */}
          <div className="mt-5 flex items-center gap-1 p-1 bg-gray-100 rounded-xl border border-gray-200 w-fit">
            {[
              { key: 'buyer_intel', label: 'Buyer Intelligence', icon: Brain },
              { key: 'ai-emails', label: 'AI Emails', icon: Sparkles },
              { key: 'notes', label: 'Notes', icon: FileText },
              { key: 'activity', label: 'Activity', icon: Clock },
            ].map(v => (
              <button key={v.key} onClick={() => setTab(v.key)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium transition-all ${
                  tab === v.key ? 'bg-white text-purple-600 shadow-sm border border-gray-200' : 'text-muted-foreground hover:text-foreground hover:bg-gray-50 border border-transparent'
                }`}>
                <v.icon size={13} /> {v.label}
              </button>
            ))}
          </div>

          {/* ════════════ BUYER INTELLIGENCE TAB ════════════ */}
          {tab === 'buyer_intel' && (
            <div className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Meeting Objective & Talking Points */}
              <div className="space-y-5">
                <IntelPanel title="Meeting Objective" icon={Target} accent="#2563eb" onRefresh={fetchBriefing}>
                  {briefingLoading && !briefing ? (
                    <div className="flex flex-col items-center py-6 gap-2">
                      <Loader2 size={24} className="animate-spin text-blue-500" />
                      <p className="text-xs text-muted-foreground">Analyzing buyer...</p>
                    </div>
                  ) : briefing ? (
                    <div className="space-y-3">
                      <div className="p-3 rounded-lg bg-blue-50/50 border border-blue-100 border-l-4 border-l-blue-500">
                        <p className="text-xs font-semibold text-blue-800 mb-1">Objective</p>
                        <p className="text-xs text-muted-foreground">{briefing.meetingObjective || 'No objective set'}</p>
                      </div>
                      <div className="flex gap-3 text-[11px] text-muted-foreground">
                        <span>Type: <strong className="text-foreground">{briefing.meetingType?.replace(/_/g, ' ') || '-'}</strong></span>
                        <span>Duration: <strong className="text-foreground">{briefing.suggestedDuration || '-'}</strong></span>
                        <span>Style: <strong className="text-foreground">{briefing.buyerProfile?.communicationStyle || '-'}</strong></span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-6 text-muted-foreground">
                      <Brain size={24} className="mx-auto mb-2 opacity-30" />
                      <p className="text-xs">Run Buyer Intel to generate</p>
                    </div>
                  )}
                </IntelPanel>

                <IntelPanel title="Talking Points" icon={MessageSquare} accent="#059669" count={briefing?.talkingPoints?.length}>
                  {briefing?.talkingPoints?.length > 0 ? (
                    <div className="space-y-2">
                      {briefing.talkingPoints.map((tp: any, i: number) => (
                        <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                          className="flex items-start gap-2 p-2.5 rounded-lg bg-gray-50 border border-gray-100">
                          <CheckCircle2 size={13} className="text-emerald-500 mt-0.5 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-foreground">{tp.point}</p>
                            {tp.evidence && <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{tp.evidence}</p>}
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-4 text-muted-foreground"><p className="text-xs">No talking points yet</p></div>
                  )}
                </IntelPanel>
              </div>

              {/* Questions & Objections */}
              <div className="space-y-5">
                <IntelPanel title="Questions to Ask" icon={Search} accent="#d97706" count={briefing?.questionsToAsk?.length}>
                  {briefing?.questionsToAsk?.length > 0 ? (
                    <div className="space-y-2">
                      {briefing.questionsToAsk.map((q: any, i: number) => (
                        <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                          className="flex items-start gap-2.5 p-2.5 rounded-lg bg-gray-50 border border-gray-100">
                          <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-600 text-[11px] font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                          <div>
                            <p className="text-xs font-medium text-foreground">{q.question}</p>
                            <p className="text-[11px] text-muted-foreground mt-0.5">Purpose: {q.purpose} · Timing: {q.timing}</p>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-4 text-muted-foreground"><p className="text-xs">No questions prepared</p></div>
                  )}
                </IntelPanel>

                <IntelPanel title="Objection Handling" icon={AlertTriangle} accent="#dc2626" count={briefing?.objectionsToPrepare?.length}>
                  {briefing?.objectionsToPrepare?.length > 0 ? (
                    <div className="space-y-2">
                      {briefing.objectionsToPrepare.map((obj: any, i: number) => (
                        <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                          className="p-3 rounded-lg border border-red-100 bg-red-50/40">
                          <div className="flex items-start gap-2">
                            <AlertTriangle size={13} className="text-red-500 mt-0.5 shrink-0" />
                            <div className="flex-1">
                              <p className="text-xs font-semibold text-red-700">{obj.objection}</p>
                              <p className="text-[11px] text-muted-foreground mt-1">{obj.rebuttal}</p>
                              {obj.evidence && <p className="text-[11px] text-muted-foreground mt-1 italic">{obj.evidence}</p>}
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-4 text-muted-foreground"><p className="text-xs">No objections prepared</p></div>
                  )}
                </IntelPanel>
              </div>

              {/* Buyer Profile Details (full width) */}
              {briefing?.buyerProfile && (
                <div className="lg:col-span-2">
                  <IntelPanel title="Buyer Profile Details" icon={UserCircle} accent={PURPLE}>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {([
                        ['Name', briefing.buyerProfile.name],
                        ['Role', briefing.buyerProfile.role],
                        ['Seniority', briefing.buyerProfile.seniority?.replace(/_/g, ' ') || '-'],
                        ['Buyer Type', briefing.buyerProfile.buyerRole?.replace(/_/g, ' ') || '-'],
                        ['Influence', (briefing.buyerProfile.influenceScore ?? 0) + '/100'],
                        ['Relationship', briefing.buyerProfile.relationshipStrength || '-'],
                        ['Style', briefing.buyerProfile.communicationStyle || '-'],
                        ['Risk Level', briefing.buyerProfile.riskLevel?.replace(/_/g, ' ') || '-'],
                      ] as const).map(([label, val]) => (
                        <div key={label} className="px-3 py-2 rounded-lg bg-gray-50 border border-gray-100">
                          <p className="text-[11px] text-muted-foreground uppercase tracking-wider">{label}</p>
                          <p className="text-sm font-bold text-foreground">{val || '-'}</p>
                        </div>
                      ))}
                    </div>
                  </IntelPanel>
                </div>
              )}
            </div>
          )}

          {/* ════════════ AI EMAILS TAB ════════════ */}
          {tab === 'ai-emails' && (
            <div className="mt-5 space-y-5">
              <IntelPanel title="AI-Generated Emails" icon={Sparkles} accent={INTEL} count={drafts.length}>
                {generateEmail.isPending ? (
                  <div className="flex flex-col items-center py-8 gap-2">
                    <Loader2 size={24} className="animate-spin text-blue-500" />
                    <p className="text-xs text-muted-foreground">Generating personalized email...</p>
                  </div>
                ) : generatedEmail ? (
                  <div className="space-y-3">
                    <div className="p-4 rounded-lg bg-blue-50/50 border border-blue-100">
                      <p className="text-xs font-semibold text-blue-800 mb-1">Subject: {generatedEmail.subject}</p>
                      <div className="text-xs text-muted-foreground whitespace-pre-wrap mt-2 leading-relaxed">{generatedEmail.body}</div>
                      <div className="flex items-center gap-3 mt-3 flex-wrap">
                        {generatedEmail.matchScore != null && <Badge className="text-[11px] bg-emerald-50 text-emerald-600 border-emerald-200">Match: {generatedEmail.matchScore}%</Badge>}
                        {generatedEmail.confidence && <Badge className="text-[11px] bg-blue-50 text-blue-600 border-blue-200">Confidence: {generatedEmail.confidence}</Badge>}
                        {generatedEmail.tone && <Badge className="text-[11px] bg-purple-50 text-purple-600 border-purple-200">Tone: {generatedEmail.tone}</Badge>}
                      </div>
                      <div className="flex gap-2 mt-3">
                        <Button size="sm" className="h-7 text-[11px] gap-1" onClick={() => copyToClipboard(generatedEmail.body)}><Copy size={11} /> Copy</Button>
                        <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1" onClick={() => generateEmail.mutate()}><RefreshCw size={11} /> Regenerate</Button>
                      </div>
                    </div>
                  </div>
                ) : drafts.length > 0 ? (
                  <div className="space-y-2">
                    {drafts.map((d: ContactDraft) => (
                      <div key={d.id} className="p-3 rounded-lg border border-gray-200 bg-gray-50/50">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-xs font-semibold truncate">{d.subject}</p>
                          <Badge className="text-[9px] shrink-0 ml-2">{d.status}</Badge>
                        </div>
                        <p className="text-[11px] text-muted-foreground line-clamp-2">{d.body?.slice(0, 150)}...</p>
                        {d.matchScore != null && <p className="text-[11px] text-emerald-600 mt-1">Match: {d.matchScore}%</p>}
                        <div className="flex gap-1.5 mt-2">
                          {d.status === 'draft' && (
                            <>
                              <Button size="sm" variant="outline" className="h-6 text-[11px]" onClick={() => updateDraftStatus.mutate({ id: d.id, status: 'approved' })}>Approve</Button>
                              <Button size="sm" variant="outline" className="h-6 text-[11px]" onClick={() => updateDraftStatus.mutate({ id: d.id, status: 'rejected' })}>Reject</Button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Sparkles size={32} className="mx-auto mb-3 text-muted-foreground/30" />
                    <p className="text-sm text-muted-foreground">No AI emails generated</p>
                    <Button size="sm" className="mt-3 gap-1.5 text-xs bg-blue-600 text-white" onClick={() => generateEmail.mutate()} disabled={generateEmail.isPending}>
                      <Sparkles size={13} /> Generate Email
                    </Button>
                  </div>
                )}
              </IntelPanel>
            </div>
          )}

          {/* ════════════ NOTES TAB ════════════ */}
          {tab === 'notes' && (
            <div className="mt-5">
              <IntelPanel title="Research Notes" icon={FileText} accent="#059669" count={notes.length}>
                <div className="flex items-center gap-2 mb-3">
                  <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1" onClick={() => setNoteOpen(true)}><Plus size={11} /> Add Note</Button>
                </div>
                {notes.length > 0 ? (
                  <div className="space-y-2">
                    {notes.map((note: ContactNote) => (
                      <div key={note.id} className="p-3 rounded-lg bg-gray-50 border border-gray-100 group">
                        <div className="flex items-start justify-between">
                          <p className="text-xs text-foreground/80 leading-relaxed">{note.body}</p>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2">
                            <button onClick={() => setDeleteNoteId(note.id)} className="p-1 hover:bg-red-100 rounded"><X size={11} className="text-red-400" /></button>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mt-1.5">
                          <Badge className="text-[9px] bg-gray-100 text-muted-foreground">{note.noteType || 'note'}</Badge>
                          <span className="text-[11px] text-muted-foreground">{new Date(note.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 text-muted-foreground"><p className="text-xs">No notes yet</p></div>
                )}
              </IntelPanel>
            </div>
          )}

          {/* ════════════ ACTIVITY TAB ════════════ */}
          {tab === 'activity' && (
            <div className="mt-5">
              <IntelPanel title="Activity Timeline" icon={Clock} accent="#3b82f6" count={timeline.length}>
                {timeline.length > 0 ? (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {timeline.map((entry: any) => (
                      <div key={entry.id} className="flex items-start gap-2.5">
                        <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center shrink-0 mt-0.5">
                          {entry.action?.includes('email') ? <Mail size={11} className="text-blue-500" /> : <Activity size={11} className="text-gray-500" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] text-foreground/80">{entry.details || entry.action?.replace(/_/g, ' ')}</p>
                          <p className="text-[11px] text-muted-foreground">{new Date(entry.createdAt).toLocaleDateString()}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 text-muted-foreground"><p className="text-xs">No activity recorded</p></div>
                )}
              </IntelPanel>
            </div>
          )}
        </div>
      </PageTransition>

      {/* ── Note Dialog ── */}
      <Dialog open={noteOpen} onOpenChange={setNoteOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle className="text-sm font-bold">Add Note</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Select value={noteType} onValueChange={setNoteType}>
              <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Note type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="call">Call</SelectItem>
                <SelectItem value="meeting">Meeting</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="research">Research</SelectItem>
                <SelectItem value="note">General Note</SelectItem>
              </SelectContent>
            </Select>
            <Textarea placeholder="Note content..." value={noteBody} onChange={e => setNoteBody(e.target.value)} className="text-xs min-h-[100px]" />
            <div className="flex gap-2">
              <Button size="sm" onClick={() => addNote.mutate({ body: noteBody, noteType: noteType || 'note' })} disabled={addNote.isPending || !noteBody.trim()}
                className="h-8 text-xs bg-purple-600 text-white">{addNote.isPending ? <Loader2 size={12} className="animate-spin mr-1" /> : null} Save</Button>
              <Button size="sm" variant="outline" onClick={() => { setNoteOpen(false); setNoteBody(''); setNoteType(''); }} className="h-8 text-xs">Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Edit Dialog ── */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle className="text-sm font-bold">Edit Contact</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {['name', 'email', 'jobTitle', 'phone', 'location', 'linkedinUrl'].map(field => (
              <div key={field}>
                <Label className="text-[11px] text-muted-foreground uppercase tracking-wider">{field.replace(/([A-Z])/g, ' $1')}</Label>
                <Input value={editForm[field as keyof typeof editForm] || ''} onChange={e => setEditForm(p => ({ ...p, [field]: e.target.value }))} className="mt-1 h-8 text-xs" />
              </div>
            ))}
            <div>
              <Label className="text-[11px] text-muted-foreground uppercase tracking-wider">Role Bucket</Label>
              <Select value={editForm.roleBucket} onValueChange={v => setEditForm(p => ({ ...p, roleBucket: v }))}>
                <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue placeholder="Select role" /></SelectTrigger>
                <SelectContent>
                  {['Executive', 'Manager', 'Technical', 'Operations', 'Sales', 'Other'].map(r => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button size="sm" onClick={() => editContact.mutate(editForm)} disabled={editContact.isPending}
                className="h-8 text-xs bg-purple-600 text-white">{editContact.isPending ? <Loader2 size={12} className="animate-spin mr-1" /> : null} Save</Button>
              <Button size="sm" variant="outline" onClick={() => setEditOpen(false)} className="h-8 text-xs">Cancel</Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Archive Confirmation ── */}
      <Dialog open={archiveConfirmOpen} onOpenChange={setArchiveConfirmOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle className="text-sm font-bold">Archive Contact?</DialogTitle></DialogHeader>
          <p className="text-xs text-muted-foreground">This will archive {data.name}. You can restore them later.</p>
          <DialogFooter>
            <Button size="sm" variant="destructive" onClick={() => archiveContact.mutate()} disabled={archiveContact.isPending}
              className="h-8 text-xs">{archiveContact.isPending ? <Loader2 size={12} className="animate-spin mr-1" /> : null} Archive</Button>
            <Button size="sm" variant="outline" onClick={() => setArchiveConfirmOpen(false)} className="h-8 text-xs">Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Note Confirmation ── */}
      <Dialog open={!!deleteNoteId} onOpenChange={() => setDeleteNoteId(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle className="text-sm font-bold">Delete Note?</DialogTitle></DialogHeader>
          <DialogFooter>
            <Button size="sm" variant="destructive" onClick={() => deleteNoteId && deleteNoteMutation.mutate(deleteNoteId)} className="h-8 text-xs">Delete</Button>
            <Button size="sm" variant="outline" onClick={() => setDeleteNoteId(null)} className="h-8 text-xs">Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const INTEL = '#2563eb';
const Activity = ({ size, className }: { size: number; className: string }) => <span className={className} style={{ display: 'inline-block', width: size, height: size }} />;
