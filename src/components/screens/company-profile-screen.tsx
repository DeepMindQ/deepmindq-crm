'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Building2,
  Globe,
  Linkedin,
  MapPin,
  Users,
  Calendar,
  ExternalLink,
  Edit3,
  Archive,
  MoreHorizontal,
  Plus,
  FileText,
  Clock,
  Target,
  MessageSquare,
  Sparkles,
  ChevronRight,
  Stethoscope,
  Lightbulb,
  AlertTriangle,
  Handshake,
  UserCheck,
  ArrowRightLeft,
  Zap,
  StickyNote,
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import type { Company, Contact, Opportunity, CompanyNote, CompanyResearchCard, TimelineEntry } from '@/lib/types';
import { formatDistanceToNow, format } from 'date-fns';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Label } from '@/components/ui/label';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ROLE_BUCKETS = ['Executive', 'Manager', 'Technical', 'Operations', 'Sales', 'Other'];

const OPP_STATUS_MAP: Record<string, { className: string; label: string }> = {
  researching: {
    className: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-800',
    label: 'Researching',
  },
  qualified: {
    className: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/50 dark:text-sky-400 dark:border-sky-800',
    label: 'Qualified',
  },
  proposal: {
    className: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/50 dark:text-violet-400 dark:border-violet-800',
    label: 'Proposal',
  },
  won: {
    className: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-800',
    label: 'Won',
  },
  lost: {
    className: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/50 dark:text-red-400 dark:border-red-800',
    label: 'Lost',
  },
};

function getScoreColor(score: number | null) {
  if (score === null) return { text: 'text-gray-400', stroke: 'stroke-gray-300', bg: 'bg-gray-100' };
  if (score >= 80) return { text: 'text-emerald-600 dark:text-emerald-400', stroke: 'stroke-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-950/30' };
  if (score >= 50) return { text: 'text-amber-600 dark:text-amber-400', stroke: 'stroke-amber-500', bg: 'bg-amber-50 dark:bg-amber-950/30' };
  return { text: 'text-gray-500', stroke: 'stroke-gray-400', bg: 'bg-gray-50 dark:bg-gray-900/30' };
}

function getFreshnessInfo(date: string | null) {
  if (!date) return { dot: 'bg-gray-300 dark:bg-gray-600', label: 'Unknown', color: 'text-gray-400' };
  const days = Math.floor((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24));
  if (days <= 30) return { dot: 'bg-emerald-500', label: 'Fresh', color: 'text-emerald-600 dark:text-emerald-400' };
  if (days <= 90) return { dot: 'bg-amber-500', label: 'Stale', color: 'text-amber-600 dark:text-amber-400' };
  return { dot: 'bg-red-500', label: 'Outdated', color: 'text-red-600 dark:text-red-400' };
}

function formatRelative(date: string) {
  return formatDistanceToNow(new Date(date), { addSuffix: true });
}

function getHealthBadge(emailHealth: string) {
  const map: Record<string, { className: string; label: string }> = {
    valid: { className: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-800', label: 'Valid' },
    risky: { className: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-800', label: 'Risky' },
    invalid: { className: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/50 dark:text-red-400 dark:border-red-800', label: 'Invalid' },
    unknown: { className: 'bg-gray-100 text-gray-500 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700', label: 'Unknown' },
  };
  const config = map[emailHealth] || map.unknown;
  return <Badge variant="outline" className={`text-[11px] font-medium px-2 py-0 ${config.className}`}>{config.label}</Badge>;
}

// ─── Score Ring ───────────────────────────────────────────────────────────────

function ScoreRing({ score }: { score: number | null }) {
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const pct = score !== null ? score / 100 : 0;
  const offset = circumference - pct * circumference;
  const colors = getScoreColor(score);

  return (
    <div className={`relative flex items-center justify-center size-24 rounded-full ${colors.bg}`}>
      <svg className="size-24 -rotate-90" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r={radius} fill="none" strokeWidth="6" className="stroke-border/40" />
        <motion.circle
          cx="50" cy="50" r={radius} fill="none" strokeWidth="6"
          strokeLinecap="round" className={colors.stroke}
          strokeDasharray={circumference} strokeDashoffset={circumference}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-xl font-bold tabular-nums ${colors.text}`}>
          {score !== null ? score : '—'}
        </span>
        <span className="text-[10px] text-muted-foreground font-medium -mt-0.5">INTEL</span>
      </div>
    </div>
  );
}

// ─── Full Page Skeleton ───────────────────────────────────────────────────────

function ProfileSkeleton() {
  return (
    <div className="flex flex-col h-full p-6 gap-6 animate-pulse">
      <div className="flex items-center gap-4">
        <Skeleton className="size-8" />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="size-24 rounded-full ml-auto" />
      </div>
      <Skeleton className="h-10 w-96" />
      <div className="grid grid-cols-2 gap-6">
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    </div>
  );
}

// ─── Research Field Block ─────────────────────────────────────────────────────

function ResearchField({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="py-3">
      <div className="flex items-center gap-2 mb-1.5">
        <Icon className="size-3.5 text-muted-foreground" />
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      </div>
      <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{value}</p>
    </div>
  );
}

// ─── Research Dialog ──────────────────────────────────────────────────────────

function ResearchDialog({
  open,
  onOpenChange,
  companyId,
  existing,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  companyId: string;
  existing: CompanyResearchCard | null;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    businessOverview: existing?.businessOverview || '',
    currentTechLandscape: existing?.currentTechLandscape || '',
    potentialChallenges: existing?.potentialChallenges || '',
    possibleOpportunities: existing?.possibleOpportunities || '',
    relevantServices: existing?.relevantServices || '',
    keyDecisionMakers: existing?.keyDecisionMakers || '',
    lastInteraction: existing?.lastInteraction || '',
    nextAction: existing?.nextAction || '',
  });
  const [submitting, setSubmitting] = useState(false);

  const fields = [
    { key: 'businessOverview' as const, label: 'Business Overview', icon: FileText, rows: 3 },
    { key: 'currentTechLandscape' as const, label: 'Current Technology Landscape', icon: Stethoscope, rows: 3 },
    { key: 'potentialChallenges' as const, label: 'Potential Challenges', icon: AlertTriangle, rows: 2 },
    { key: 'possibleOpportunities' as const, label: 'Possible Opportunities', icon: Lightbulb, rows: 3 },
    { key: 'relevantServices' as const, label: 'Relevant Services', icon: Handshake, rows: 3 },
    { key: 'keyDecisionMakers' as const, label: 'Key Decision Makers', icon: UserCheck, rows: 2 },
    { key: 'lastInteraction' as const, label: 'Last Interaction', icon: ArrowRightLeft, rows: 2 },
    { key: 'nextAction' as const, label: 'Next Action', icon: Zap, rows: 2 },
  ];

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, ...form }),
      });
      if (!res.ok) throw new Error('Failed to save research');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company', companyId] });
      onOpenChange(false);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold flex items-center gap-2">
            <Sparkles className="size-5 text-emerald-500" />
            {existing ? 'Edit Research' : 'Start Research'}
          </DialogTitle>
          <DialogDescription>
            {existing ? 'Update the research card for this company.' : 'Fill in intelligence about this company.'}
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh] pr-2">
          <div className="space-y-4 py-2">
            {fields.map(({ key, label, icon: Icon, rows }) => (
              <div key={key} className="space-y-1.5">
                <Label className="text-sm font-medium flex items-center gap-1.5">
                  <Icon className="size-3.5 text-muted-foreground" />
                  {label}
                </Label>
                <Textarea
                  value={form[key]}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  rows={rows}
                  placeholder={`Enter ${label.toLowerCase()}...`}
                  className="resize-none"
                />
              </div>
            ))}
          </div>
        </ScrollArea>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={() => { setSubmitting(true); mutation.mutate(undefined, { onSettled: () => setSubmitting(false) }); }}
            disabled={submitting}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {submitting ? 'Saving...' : 'Save Research'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Add Contact Dialog (Company-scoped) ──────────────────────────────────────

function AddContactDialog({
  open,
  onOpenChange,
  companyId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  companyId: string;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    name: '',
    email: '',
    jobTitle: '',
    roleBucket: '',
    linkedinUrl: '',
    phone: '',
    location: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, companyId }),
      });
      if (!res.ok) throw new Error('Failed to create contact');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company', companyId] });
      setForm({ name: '', email: '', jobTitle: '', roleBucket: '', linkedinUrl: '', phone: '', location: '' });
      onOpenChange(false);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">Add Contact</DialogTitle>
          <DialogDescription>Add a new contact to this company.</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!form.name.trim()) return;
            setSubmitting(true);
            mutation.mutate(undefined, { onSettled: () => setSubmitting(false) });
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="contact-name">Name *</Label>
            <Input id="contact-name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required placeholder="Jane Smith" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="contact-email">Email</Label>
              <Input id="contact-email" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="jane@acme.com" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact-title">Job Title</Label>
              <Input id="contact-title" value={form.jobTitle} onChange={(e) => setForm((f) => ({ ...f, jobTitle: e.target.value }))} placeholder="VP of Engineering" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Role Bucket</Label>
              <Select value={form.roleBucket} onValueChange={(v) => setForm((f) => ({ ...f, roleBucket: v }))}>
                <SelectTrigger className="w-full" size="default"><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>{ROLE_BUCKETS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact-phone">Phone</Label>
              <Input id="contact-phone" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="+1 555-0123" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="contact-linkedin">LinkedIn URL</Label>
            <Input id="contact-linkedin" value={form.linkedinUrl} onChange={(e) => setForm((f) => ({ ...f, linkedinUrl: e.target.value }))} placeholder="https://linkedin.com/in/janesmith" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contact-location">Location</Label>
            <Input id="contact-location" value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} placeholder="San Francisco, CA" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={!form.name.trim() || submitting} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              {submitting ? 'Adding...' : 'Add Contact'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Add Opportunity Dialog ───────────────────────────────────────────────────

function AddOpportunityDialog({
  open,
  onOpenChange,
  companyId,
  contacts,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  companyId: string;
  contacts: Contact[];
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    title: '',
    description: '',
    targetContactId: '',
    status: 'researching',
    nextAction: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/opportunities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, ...form, targetContactId: form.targetContactId || null }),
      });
      if (!res.ok) throw new Error('Failed to create opportunity');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company', companyId] });
      setForm({ title: '', description: '', targetContactId: '', status: 'researching', nextAction: '' });
      onOpenChange(false);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">Add Opportunity</DialogTitle>
          <DialogDescription>Create a new opportunity for this company.</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!form.title.trim()) return;
            setSubmitting(true);
            mutation.mutate(undefined, { onSettled: () => setSubmitting(false) });
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label>Title *</Label>
            <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} required placeholder="Enterprise SaaS migration" />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={3} placeholder="Describe the opportunity..." className="resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Target Contact</Label>
              <Select value={form.targetContactId} onValueChange={(v) => setForm((f) => ({ ...f, targetContactId: v }))}>
                <SelectTrigger className="w-full" size="default"><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>
                  {contacts.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}{c.jobTitle ? ` — ${c.jobTitle}` : ''}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
                <SelectTrigger className="w-full" size="default"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(OPP_STATUS_MAP).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Next Action</Label>
            <Input value={form.nextAction} onChange={(e) => setForm((f) => ({ ...f, nextAction: e.target.value }))} placeholder="Schedule discovery call" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={!form.title.trim() || submitting} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              {submitting ? 'Creating...' : 'Create Opportunity'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Add Note Dialog ──────────────────────────────────────────────────────────

function AddNoteDialog({
  open,
  onOpenChange,
  companyId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  companyId: string;
}) {
  const queryClient = useQueryClient();
  const [body, setBody] = useState('');
  const [noteType, setNoteType] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, body, noteType: noteType || null }),
      });
      if (!res.ok) throw new Error('Failed to add note');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company', companyId] });
      setBody('');
      setNoteType('');
      onOpenChange(false);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">Add Note</DialogTitle>
          <DialogDescription>Add a note to this company.</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!body.trim()) return;
            setSubmitting(true);
            mutation.mutate(undefined, { onSettled: () => setSubmitting(false) });
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={noteType} onValueChange={setNoteType}>
              <SelectTrigger className="w-full" size="default"><SelectValue placeholder="Select type..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="general">General</SelectItem>
                <SelectItem value="call">Call</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="meeting">Meeting</SelectItem>
                <SelectItem value="research">Research</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="note-body">Note *</Label>
            <Textarea id="note-body" value={body} onChange={(e) => setBody(e.target.value)} required rows={4} placeholder="Write your note..." className="resize-none" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={!body.trim() || submitting} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              {submitting ? 'Adding...' : 'Add Note'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Contact Detail Sheet ─────────────────────────────────────────────────────

function ContactDetailSheet({
  contactId,
  open,
  onOpenChange,
}: {
  contactId: string | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { data: contact, isLoading } = useQuery({
    queryKey: ['contact', contactId],
    queryFn: async () => {
      const res = await fetch(`/api/contacts/${contactId}`);
      if (!res.ok) throw new Error('Failed');
      return res.json() as Promise<Contact>;
    },
    enabled: !!contactId && open,
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-md w-full p-0 overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-4">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-56" />
            <Separator />
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-4 w-full" />)}
            </div>
          </div>
        ) : contact ? (
          <div className="flex flex-col h-full">
            <SheetHeader className="p-6 pb-4 border-b border-border/40">
              <SheetTitle className="text-lg">{contact.name}</SheetTitle>
              <SheetDescription>{contact.jobTitle || 'No title specified'}</SheetDescription>
            </SheetHeader>
            <ScrollArea className="flex-1 p-6 space-y-6">
              {/* Info Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Email</p>
                  <p className="text-sm text-foreground flex items-center gap-1.5">
                    {contact.email || '—'}
                    {contact.email && (
                      <span className="inline-flex items-center ml-1">
                        {getHealthBadge(contact.emailHealth)}
                      </span>
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Phone</p>
                  <p className="text-sm text-foreground">{contact.phone || '—'}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Role</p>
                  <p className="text-sm text-foreground">{contact.roleBucket || '—'}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Location</p>
                  <p className="text-sm text-foreground">{contact.location || '—'}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Company</p>
                  <p className="text-sm text-foreground">{contact.company?.name || '—'}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Status</p>
                  <Badge variant="secondary" className="text-xs">{contact.status}</Badge>
                </div>
              </div>

              {contact.linkedinUrl && (
                <div>
                  <a href={contact.linkedinUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-teal-600 dark:text-teal-400 hover:underline">
                    <Linkedin className="size-3.5" /> LinkedIn Profile <ExternalLink className="size-3" />
                  </a>
                </div>
              )}

              <Separator />

              {/* Timeline */}
              {contact.timeline && contact.timeline.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-1.5">
                    <Clock className="size-3.5 text-muted-foreground" /> Timeline
                  </h3>
                  <div className="space-y-3">
                    {contact.timeline.slice(0, 10).map((entry) => (
                      <div key={entry.id} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <div className="size-2 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                          <div className="w-px flex-1 bg-border/50" />
                        </div>
                        <div className="pb-3">
                          <p className="text-sm text-foreground">{entry.details || entry.action}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{formatRelative(entry.createdAt)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Notes */}
              {contact.notes && contact.notes.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-1.5">
                    <StickyNote className="size-3.5 text-muted-foreground" /> Notes
                  </h3>
                  <div className="space-y-3">
                    {contact.notes.map((note) => (
                      <div key={note.id} className="rounded-lg border border-border/50 bg-muted/30 p-3">
                        <p className="text-sm text-foreground">{note.body}</p>
                        <p className="text-xs text-muted-foreground mt-1.5">{formatRelative(note.createdAt)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </ScrollArea>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

// ─── Timeline Entry Component ─────────────────────────────────────────────────

function TimelineItem({ entry, index }: { entry: TimelineEntry; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2, delay: index * 0.03 }}
      className="flex gap-4 group"
    >
      <div className="flex flex-col items-center shrink-0">
        <div className="size-2.5 rounded-full bg-emerald-500 ring-4 ring-background group-hover:ring-emerald-50 dark:group-hover:ring-emerald-950/30 transition-all mt-1" />
        {index < 100 && <div className="w-px flex-1 bg-border/60" />}
      </div>
      <div className="pb-6 flex-1 min-w-0">
        <div className="flex items-baseline gap-2 mb-0.5">
          <p className="text-sm font-medium text-foreground">{entry.action.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</p>
          {entry.contact && (
            <span className="text-xs text-muted-foreground">— {entry.contact.name}</span>
          )}
        </div>
        {entry.details && (
          <p className="text-sm text-muted-foreground leading-relaxed">{entry.details}</p>
        )}
        <p className="text-xs text-muted-foreground/70 mt-1">{formatRelative(entry.createdAt)}</p>
      </div>
    </motion.div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CompanyProfileScreen() {
  const { selectedCompanyId, setActiveView } = useAppStore();
  const queryClient = useQueryClient();

  // Dialogs
  const [researchDialog, setResearchDialog] = useState(false);
  const [contactDialog, setContactDialog] = useState(false);
  const [opportunityDialog, setOpportunityDialog] = useState(false);
  const [noteDialog, setNoteDialog] = useState(false);
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);

  // Fetch company
  const { data: company, isLoading, isError } = useQuery({
    queryKey: ['company', selectedCompanyId],
    queryFn: async () => {
      const res = await fetch(`/api/companies/${selectedCompanyId}`);
      if (!res.ok) throw new Error('Failed');
      return res.json() as Promise<Company>;
    },
    enabled: !!selectedCompanyId,
  });

  const handleArchive = async () => {
    if (!selectedCompanyId) return;
    await fetch(`/api/companies/${selectedCompanyId}`, { method: 'DELETE' });
    queryClient.invalidateQueries({ queryKey: ['companies'] });
    setActiveView('companies');
  };

  const handleBack = () => {
    setActiveView('companies');
  };

  if (!selectedCompanyId) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-muted-foreground">No company selected.</p>
      </div>
    );
  }

  if (isLoading) return <ProfileSkeleton />;
  if (isError || !company) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <p className="text-sm text-muted-foreground">Company not found.</p>
        <Button variant="outline" size="sm" onClick={handleBack}>
          <ArrowLeft className="size-4 mr-1.5" /> Back to Companies
        </Button>
      </div>
    );
  }

  const freshness = getFreshnessInfo(company.lastUpdatedAt);
  const contacts = company.contacts || [];
  const opportunities = company.opportunities || [];
  const timeline = company.timeline || [];
  const notes = company.notes || [];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── Top Header ── */}
      <div className="shrink-0 border-b border-border/40 bg-card/50 backdrop-blur-sm">
        <div className="px-6 py-4">
          <div className="flex items-start gap-4">
            <Button variant="ghost" size="sm" onClick={handleBack} className="mt-1 -ml-2 hover:bg-muted/60">
              <ArrowLeft className="size-4" />
              <span className="sr-only sm:not-sr-only ml-1.5">Back</span>
            </Button>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-bold tracking-tight text-foreground">{company.name}</h1>
                {company.industry && (
                  <Badge variant="outline" className="text-xs font-medium bg-muted/50">{company.industry}</Badge>
                )}
                {company.country && (
                  <span className="text-sm text-muted-foreground flex items-center gap-1">
                    <MapPin className="size-3" /> {company.country}
                  </span>
                )}
              </div>
              {company.domain && (
                <p className="text-sm text-muted-foreground mt-0.5">{company.domain}</p>
              )}
            </div>

            <div className="flex items-center gap-4 shrink-0">
              {/* Freshness */}
              <div className="flex items-center gap-1.5">
                <span className={`size-2 rounded-full ${freshness.dot}`} />
                <span className={`text-xs font-medium ${freshness.color}`}>{freshness.label}</span>
              </div>

              {/* Score Ring */}
              <ScoreRing score={company.intelligenceScore} />

              {/* Actions */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="size-8 p-0">
                    <MoreHorizontal className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuItem>
                    <Edit3 className="size-4 mr-2" /> Edit Company
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-red-600 dark:text-red-400" onClick={handleArchive}>
                    <Archive className="size-4 mr-2" /> Archive
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-6">
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="bg-transparent border-b border-border/40 rounded-none h-auto p-0 w-full justify-start gap-0">
              <TabsTrigger value="overview" className="rounded-none border-b-2 border-transparent data-[state=active]:border-emerald-500 data-[state=active]:bg-transparent data-[state=active]:shadow-none pb-2.5 px-4 text-sm">
                Overview
              </TabsTrigger>
              <TabsTrigger value="contacts" className="rounded-none border-b-2 border-transparent data-[state=active]:border-emerald-500 data-[state=active]:bg-transparent data-[state=active]:shadow-none pb-2.5 px-4 text-sm">
                Contacts {contacts.length > 0 && <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5 py-0 h-4">{contacts.length}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="opportunities" className="rounded-none border-b-2 border-transparent data-[state=active]:border-emerald-500 data-[state=active]:bg-transparent data-[state=active]:shadow-none pb-2.5 px-4 text-sm">
                Opportunities {opportunities.length > 0 && <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5 py-0 h-4">{opportunities.length}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="timeline" className="rounded-none border-b-2 border-transparent data-[state=active]:border-emerald-500 data-[state=active]:bg-transparent data-[state=active]:shadow-none pb-2.5 px-4 text-sm">
                Timeline
              </TabsTrigger>
              <TabsTrigger value="notes" className="rounded-none border-b-2 border-transparent data-[state=active]:border-emerald-500 data-[state=active]:bg-transparent data-[state=active]:shadow-none pb-2.5 px-4 text-sm">
                Notes {notes.length > 0 && <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5 py-0 h-4">{notes.length}</Badge>}
              </TabsTrigger>
            </TabsList>

            {/* ── OVERVIEW TAB ── */}
            <TabsContent value="overview" className="mt-6 pb-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Company Info Card */}
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="rounded-xl border border-border/60 bg-card p-5"
                >
                  <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                    <Building2 className="size-4 text-muted-foreground" /> Company Information
                  </h3>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                    {[
                      { label: 'Website', value: company.website, icon: Globe, href: true },
                      { label: 'LinkedIn', value: company.linkedinUrl, icon: Linkedin, href: true },
                      { label: 'Employee Size', value: company.employeeSize, icon: Users },
                      { label: 'Location', value: company.location, icon: MapPin },
                      { label: 'Status', value: company.status, icon: Target, badge: true },
                      { label: 'Created', value: company.createdAt ? format(new Date(company.createdAt), 'MMM d, yyyy') : null, icon: Calendar },
                    ].map((item) => (
                      <div key={item.label}>
                        <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-1 flex items-center gap-1">
                          <item.icon className="size-3" /> {item.label}
                        </p>
                        {item.value ? (
                          item.badge ? (
                            <Badge variant="outline" className="text-xs capitalize">{item.value}</Badge>
                          ) : item.href ? (
                            <a href={item.value} target="_blank" rel="noopener noreferrer" className="text-sm text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-1 truncate">
                              {item.value.replace(/^https?:\/\//, '')} <ExternalLink className="size-3 shrink-0" />
                            </a>
                          ) : (
                            <p className="text-sm text-foreground">{item.value}</p>
                          )
                        ) : (
                          <p className="text-sm text-muted-foreground/50">—</p>
                        )}
                      </div>
                    ))}
                  </div>
                </motion.div>

                {/* Research Card */}
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.05 }}
                  className="rounded-xl border border-border/60 bg-card p-5"
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <Sparkles className="size-4 text-emerald-500" /> Research Intelligence
                    </h3>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => setResearchDialog(true)}
                    >
                      {company.researchCard ? <Edit3 className="size-3 mr-1" /> : <Plus className="size-3 mr-1" />}
                      {company.researchCard ? 'Edit' : 'Start'} Research
                    </Button>
                  </div>

                  {company.researchCard ? (
                    <ScrollArea className="max-h-[400px] pr-2">
                      <div className="divide-y divide-border/40">
                        <ResearchField icon={FileText} label="Business Overview" value={company.researchCard.businessOverview} />
                        <ResearchField icon={Stethoscope} label="Tech Landscape" value={company.researchCard.currentTechLandscape} />
                        <ResearchField icon={AlertTriangle} label="Challenges" value={company.researchCard.potentialChallenges} />
                        <ResearchField icon={Lightbulb} label="Opportunities" value={company.researchCard.possibleOpportunities} />
                        <ResearchField icon={Handshake} label="Relevant Services" value={company.researchCard.relevantServices} />
                        <ResearchField icon={UserCheck} label="Decision Makers" value={company.researchCard.keyDecisionMakers} />
                        <ResearchField icon={ArrowRightLeft} label="Last Interaction" value={company.researchCard.lastInteraction} />
                        <ResearchField icon={Zap} label="Next Action" value={company.researchCard.nextAction} />
                      </div>
                    </ScrollArea>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <div className="flex items-center justify-center size-12 rounded-xl bg-muted/80 mb-3">
                        <Sparkles className="size-6 text-muted-foreground/40" />
                      </div>
                      <p className="text-sm font-medium text-foreground">No research yet</p>
                      <p className="text-xs text-muted-foreground mt-1 max-w-[200px]">
                        Start researching this company to build intelligence.
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-3 h-8 text-xs"
                        onClick={() => setResearchDialog(true)}
                      >
                        <Plus className="size-3 mr-1" /> Start Research
                      </Button>
                    </div>
                  )}
                </motion.div>
              </div>
            </TabsContent>

            {/* ── CONTACTS TAB ── */}
            <TabsContent value="contacts" className="mt-6 pb-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-foreground">{contacts.length} {contacts.length === 1 ? 'contact' : 'contacts'}</h3>
                <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white h-8 text-xs" onClick={() => setContactDialog(true)}>
                  <Plus className="size-3 mr-1" /> Add Contact
                </Button>
              </div>

              {contacts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="flex items-center justify-center size-12 rounded-xl bg-muted/80 mb-3">
                    <Users className="size-6 text-muted-foreground/40" />
                  </div>
                  <p className="text-sm font-medium text-foreground">No contacts yet</p>
                  <p className="text-xs text-muted-foreground mt-1">Add contacts from this company.</p>
                </div>
              ) : (
                <div className="rounded-xl border border-border/60 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent bg-muted/30 border-border/40">
                        <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground/70 pl-4">Name</TableHead>
                        <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground/70">Title</TableHead>
                        <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground/70">Email</TableHead>
                        <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground/70">Health</TableHead>
                        <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground/70">Role</TableHead>
                        <TableHead className="w-10" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <AnimatePresence>
                        {contacts.map((contact, idx) => (
                          <motion.tr
                            key={contact.id}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ delay: idx * 0.03 }}
                            className="group border-b border-border/30 last:border-0 hover:bg-muted/40 cursor-pointer transition-colors"
                            onClick={() => { setSelectedContactId(contact.id); }}
                          >
                            <TableCell className="pl-4 py-2.5">
                              <div className="flex items-center gap-2.5">
                                <div className="size-7 rounded-full bg-gradient-to-br from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-900 flex items-center justify-center border border-border/50 shrink-0">
                                  <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300">{contact.name.slice(0, 2).toUpperCase()}</span>
                                </div>
                                <div>
                                  <p className="text-sm font-medium text-foreground">{contact.name}</p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="py-2.5 text-sm text-muted-foreground">{contact.jobTitle || '—'}</TableCell>
                            <TableCell className="py-2.5 text-sm text-muted-foreground">{contact.email || '—'}</TableCell>
                            <TableCell className="py-2.5">{getHealthBadge(contact.emailHealth)}</TableCell>
                            <TableCell className="py-2.5 text-sm text-muted-foreground">{contact.roleBucket || '—'}</TableCell>
                            <TableCell className="py-2.5 pr-4" onClick={(e) => e.stopPropagation()}>
                              <Button variant="ghost" size="sm" className="size-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                <ChevronRight className="size-3.5" />
                              </Button>
                            </TableCell>
                          </motion.tr>
                        ))}
                      </AnimatePresence>
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>

            {/* ── OPPORTUNITIES TAB ── */}
            <TabsContent value="opportunities" className="mt-6 pb-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-foreground">{opportunities.length} {opportunities.length === 1 ? 'opportunity' : 'opportunities'}</h3>
                <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white h-8 text-xs" onClick={() => setOpportunityDialog(true)}>
                  <Plus className="size-3 mr-1" /> Add Opportunity
                </Button>
              </div>

              {opportunities.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="flex items-center justify-center size-12 rounded-xl bg-muted/80 mb-3">
                    <Target className="size-6 text-muted-foreground/40" />
                  </div>
                  <p className="text-sm font-medium text-foreground">No opportunities yet</p>
                  <p className="text-xs text-muted-foreground mt-1">Track potential deals here.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <AnimatePresence>
                    {opportunities.map((opp, idx) => {
                      const statusConfig = OPP_STATUS_MAP[opp.status] || OPP_STATUS_MAP.researching;
                      const targetContact = contacts.find((c) => c.id === opp.targetContactId);
                      return (
                        <motion.div
                          key={opp.id}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          transition={{ delay: idx * 0.05 }}
                          className="rounded-xl border border-border/60 bg-card p-4 hover:border-border transition-colors"
                        >
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <h4 className="text-sm font-semibold text-foreground leading-snug">{opp.title}</h4>
                            <Badge variant="outline" className={`text-[11px] font-medium px-2 py-0 shrink-0 ${statusConfig.className}`}>
                              {statusConfig.label}
                            </Badge>
                          </div>
                          {opp.description && (
                            <p className="text-xs text-muted-foreground leading-relaxed mb-3 line-clamp-2">{opp.description}</p>
                          )}
                          <div className="flex items-center justify-between">
                            {targetContact && (
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Users className="size-3" /> {targetContact.name}
                              </span>
                            )}
                            {opp.nextAction && (
                              <span className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                <Zap className="size-3" /> {opp.nextAction}
                              </span>
                            )}
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              )}
            </TabsContent>

            {/* ── TIMELINE TAB ── */}
            <TabsContent value="timeline" className="mt-6 pb-6">
              {timeline.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="flex items-center justify-center size-12 rounded-xl bg-muted/80 mb-3">
                    <Clock className="size-6 text-muted-foreground/40" />
                  </div>
                  <p className="text-sm font-medium text-foreground">No activity yet</p>
                  <p className="text-xs text-muted-foreground mt-1">Actions will appear here as you interact.</p>
                </div>
              ) : (
                <div className="rounded-xl border border-border/60 bg-card p-5">
                  <ScrollArea className="max-h-[500px]">
                    {timeline.map((entry, idx) => (
                      <TimelineItem key={entry.id} entry={entry} index={idx} />
                    ))}
                  </ScrollArea>
                </div>
              )}
            </TabsContent>

            {/* ── NOTES TAB ── */}
            <TabsContent value="notes" className="mt-6 pb-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-foreground">{notes.length} {notes.length === 1 ? 'note' : 'notes'}</h3>
                <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white h-8 text-xs" onClick={() => setNoteDialog(true)}>
                  <Plus className="size-3 mr-1" /> Add Note
                </Button>
              </div>

              {notes.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="flex items-center justify-center size-12 rounded-xl bg-muted/80 mb-3">
                    <MessageSquare className="size-6 text-muted-foreground/40" />
                  </div>
                  <p className="text-sm font-medium text-foreground">No notes yet</p>
                  <p className="text-xs text-muted-foreground mt-1">Keep notes on this company.</p>
                </div>
              ) : (
                <AnimatePresence>
                  <div className="space-y-3">
                    {notes.map((note, idx) => (
                      <motion.div
                        key={note.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ delay: idx * 0.03 }}
                        className="rounded-xl border border-border/60 bg-card p-4"
                      >
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          {note.noteType && (
                            <Badge variant="secondary" className="text-[10px] px-2 py-0 h-5 capitalize">{note.noteType}</Badge>
                          )}
                          <span className="text-xs text-muted-foreground ml-auto shrink-0">{formatRelative(note.createdAt)}</span>
                        </div>
                        <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{note.body}</p>
                      </motion.div>
                    ))}
                  </div>
                </AnimatePresence>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Dialogs */}
      {company.researchCard && (
        <ResearchDialog
          open={researchDialog}
          onOpenChange={setResearchDialog}
          companyId={company.id}
          existing={company.researchCard}
        />
      )}
      {!company.researchCard && (
        <ResearchDialog
          open={researchDialog}
          onOpenChange={setResearchDialog}
          companyId={company.id}
          existing={null}
        />
      )}
      <AddContactDialog open={contactDialog} onOpenChange={setContactDialog} companyId={company.id} />
      <AddOpportunityDialog open={opportunityDialog} onOpenChange={setOpportunityDialog} companyId={company.id} contacts={contacts} />
      <AddNoteDialog open={noteDialog} onOpenChange={setNoteDialog} companyId={company.id} />
      <ContactDetailSheet
        contactId={selectedContactId}
        open={!!selectedContactId}
        onOpenChange={(open) => { if (!open) setSelectedContactId(null); }}
      />
    </div>
  );
}