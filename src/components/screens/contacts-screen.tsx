'use client';

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Search,
  Users,
  MoreHorizontal,
  ExternalLink,
  Archive,
  CheckCircle2,
  Mail,
  ChevronLeft,
  ChevronRight,
  Linkedin,
  MapPin,
  Phone,
  Building2,
  Clock,
  StickyNote,
  ShieldCheck,
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import type { Contact, Company } from '@/lib/types';
import { formatDistanceToNow, format } from 'date-fns';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
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
  DropdownMenuSeparator,
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
import { Textarea } from '@/components/ui/textarea';

// ─── Constants ────────────────────────────────────────────────────────────────

const ROLE_BUCKETS = ['Executive', 'Manager', 'Technical', 'Operations', 'Sales', 'Other'];

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'outreach_pending', label: 'Outreach Pending' },
  { value: 'contacted', label: 'Contacted' },
];

const HEALTH_OPTIONS = [
  { value: '', label: 'All Health' },
  { value: 'valid', label: 'Valid' },
  { value: 'risky', label: 'Risky' },
  { value: 'invalid', label: 'Invalid' },
  { value: 'unknown', label: 'Unknown' },
];

const PAGE_SIZE = 20;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getHealthBadge(emailHealth: string) {
  const map: Record<string, { className: string; label: string; dot?: string }> = {
    valid: {
      className: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-800',
      label: 'Valid',
      dot: 'bg-emerald-500',
    },
    risky: {
      className: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-800',
      label: 'Risky',
      dot: 'bg-amber-500',
    },
    invalid: {
      className: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/50 dark:text-red-400 dark:border-red-800',
      label: 'Invalid',
      dot: 'bg-red-500',
    },
    unknown: {
      className: 'bg-gray-100 text-gray-500 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700',
      label: 'Unknown',
      dot: 'bg-gray-400',
    },
  };
  const config = map[emailHealth] || map.unknown;
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`size-1.5 rounded-full ${config.dot}`} />
      <span className={`text-[11px] font-medium px-2 py-0 inline-flex items-center rounded-md border ${config.className}`}>
        {config.label}
      </span>
    </span>
  );
}

function getStatusBadge(status: string) {
  const map: Record<string, { className: string; label: string }> = {
    active: {
      className: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-800',
      label: 'Active',
    },
    inactive: {
      className: 'bg-gray-100 text-gray-500 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700',
      label: 'Inactive',
    },
    outreach_pending: {
      className: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-800',
      label: 'Outreach Pending',
    },
    contacted: {
      className: 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/50 dark:text-teal-400 dark:border-teal-800',
      label: 'Contacted',
    },
  };
  const config = map[status] || { className: 'bg-gray-100 text-gray-500 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700', label: status };
  return (
    <Badge variant="outline" className={`text-[11px] font-medium px-2 py-0 ${config.className}`}>
      {config.label}
    </Badge>
  );
}

function formatRelative(date: string) {
  return formatDistanceToNow(new Date(date), { addSuffix: true });
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function TableSkeleton() {
  return (
    <div className="space-y-3 p-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <Skeleton className="size-4" />
          <Skeleton className="h-4 w-[140px]" />
          <Skeleton className="h-4 w-[120px]" />
          <Skeleton className="h-4 w-[150px]" />
          <Skeleton className="h-4 w-[80px]" />
          <Skeleton className="h-4 w-[70px]" />
          <Skeleton className="h-4 w-[60px]" />
          <Skeleton className="h-4 w-[60px]" />
        </div>
      ))}
    </div>
  );
}

// ─── Add Contact Dialog ───────────────────────────────────────────────────────

function AddContactDialog({
  open,
  onOpenChange,
  companies,
  preselectedCompanyId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  companies: { id: string; name: string }[];
  preselectedCompanyId?: string | null;
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
    companyId: preselectedCompanyId || '',
  });
  const [submitting, setSubmitting] = useState(false);

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to create contact');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      setForm({ name: '', email: '', jobTitle: '', roleBucket: '', linkedinUrl: '', phone: '', location: '', companyId: '' });
      onOpenChange(false);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.companyId) return;
    setSubmitting(true);
    mutation.mutate(undefined, { onSettled: () => setSubmitting(false) });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">Add Contact</DialogTitle>
          <DialogDescription>Add a new contact to your pipeline.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="c-name">Name *</Label>
            <Input id="c-name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required placeholder="Jane Smith" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="c-email">Email</Label>
              <Input id="c-email" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="jane@acme.com" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="c-title">Job Title</Label>
              <Input id="c-title" value={form.jobTitle} onChange={(e) => setForm((f) => ({ ...f, jobTitle: e.target.value }))} placeholder="VP of Engineering" />
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
              <Label htmlFor="c-phone">Phone</Label>
              <Input id="c-phone" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="+1 555-0123" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Company *</Label>
            <Select value={form.companyId} onValueChange={(v) => setForm((f) => ({ ...f, companyId: v }))}>
              <SelectTrigger className="w-full" size="default"><SelectValue placeholder="Select company..." /></SelectTrigger>
              <SelectContent>
                {companies.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="c-linkedin">LinkedIn URL</Label>
            <Input id="c-linkedin" value={form.linkedinUrl} onChange={(e) => setForm((f) => ({ ...f, linkedinUrl: e.target.value }))} placeholder="https://linkedin.com/in/janesmith" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="c-location">Location</Label>
            <Input id="c-location" value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} placeholder="San Francisco, CA" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={!form.name.trim() || !form.companyId || submitting} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              {submitting ? 'Adding...' : 'Add Contact'}
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
  const { setSelectedCompanyId, setActiveView } = useAppStore();
  const queryClient = useQueryClient();

  const { data: contact, isLoading } = useQuery({
    queryKey: ['contact-detail', contactId],
    queryFn: async () => {
      const res = await fetch(`/api/contacts/${contactId}`);
      if (!res.ok) throw new Error('Failed');
      return res.json() as Promise<Contact>;
    },
    enabled: !!contactId && open,
  });

  const archiveMutation = useMutation({
    mutationFn: async () => {
      await fetch(`/api/contacts/${contactId}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      onOpenChange(false);
    },
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-lg w-full p-0 overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-4 animate-pulse">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-64" />
            <Separator />
            <div className="grid grid-cols-2 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="space-y-1">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-4 w-full" />
                </div>
              ))}
            </div>
          </div>
        ) : contact ? (
          <div className="flex flex-col h-full">
            <SheetHeader className="p-6 pb-4 border-b border-border/40">
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <SheetTitle className="text-lg">{contact.name}</SheetTitle>
                  <SheetDescription className="mt-0.5">{contact.jobTitle || 'No title specified'}</SheetDescription>
                </div>
                {contact.company && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0 ml-4 h-7 text-xs"
                    onClick={() => {
                      setSelectedCompanyId(contact.companyId);
                      setActiveView('company-profile');
                      onOpenChange(false);
                    }}
                  >
                    <Building2 className="size-3 mr-1.5" />
                    {contact.company.name}
                  </Button>
                )}
              </div>
            </SheetHeader>

            <ScrollArea className="flex-1 p-6 space-y-6">
              {/* Info Grid */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className="grid grid-cols-2 gap-x-6 gap-y-4"
              >
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-1 flex items-center gap-1">
                    <Mail className="size-3" /> Email
                  </p>
                  <div className="flex items-center gap-2">
                    {contact.email ? (
                      <a href={`mailto:${contact.email}`} className="text-sm text-teal-600 dark:text-teal-400 hover:underline truncate">
                        {contact.email}
                      </a>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                    {getHealthBadge(contact.emailHealth)}
                  </div>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-1 flex items-center gap-1">
                    <Phone className="size-3" /> Phone
                  </p>
                  <p className="text-sm text-foreground">{contact.phone || '—'}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-1 flex items-center gap-1">
                    <ShieldCheck className="size-3" /> Role
                  </p>
                  <p className="text-sm text-foreground">{contact.roleBucket || '—'}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-1 flex items-center gap-1">
                    <MapPin className="size-3" /> Location
                  </p>
                  <p className="text-sm text-foreground">{contact.location || '—'}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Status</p>
                  {getStatusBadge(contact.status)}
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Created</p>
                  <p className="text-sm text-foreground">
                    {contact.createdAt ? format(new Date(contact.createdAt), 'MMM d, yyyy') : '—'}
                  </p>
                </div>
              </motion.div>

              {contact.linkedinUrl && (
                <a
                  href={contact.linkedinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-teal-600 dark:text-teal-400 hover:underline"
                >
                  <Linkedin className="size-3.5" /> LinkedIn Profile <ExternalLink className="size-3" />
                </a>
              )}

              <Separator />

              {/* Timeline */}
              {contact.timeline && contact.timeline.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: 0.05 }}
                >
                  <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-1.5">
                    <Clock className="size-3.5 text-muted-foreground" /> Timeline
                  </h3>
                  <div className="space-y-0">
                    {contact.timeline.slice(0, 10).map((entry, idx) => (
                      <motion.div
                        key={entry.id}
                        initial={{ opacity: 0, x: -6 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.05 + idx * 0.03 }}
                        className="flex gap-3 pb-4 last:pb-0"
                      >
                        <div className="flex flex-col items-center shrink-0">
                          <div className="size-2 rounded-full bg-emerald-500 mt-1.5" />
                          <div className="w-px flex-1 bg-border/50" />
                        </div>
                        <div>
                          <p className="text-sm text-foreground">{entry.details || entry.action.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{formatRelative(entry.createdAt)}</p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Notes */}
              {contact.notes && contact.notes.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: 0.1 }}
                >
                  <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-1.5">
                    <StickyNote className="size-3.5 text-muted-foreground" /> Notes
                  </h3>
                  <div className="space-y-3">
                    {contact.notes.map((note) => (
                      <div key={note.id} className="rounded-lg border border-border/50 bg-muted/30 p-3">
                        <div className="flex items-center gap-2 mb-1">
                          {note.noteType && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 capitalize">{note.noteType}</Badge>
                          )}
                          <span className="text-xs text-muted-foreground">{formatRelative(note.createdAt)}</span>
                        </div>
                        <p className="text-sm text-foreground leading-relaxed">{note.body}</p>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </ScrollArea>

            {/* Footer Actions */}
            <div className="shrink-0 border-t border-border/40 p-4 flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/20"
                onClick={() => archiveMutation.mutate()}
              >
                <Archive className="size-3.5 mr-1.5" /> Archive
              </Button>
              {contact.email && (
                <Button size="sm" className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white" asChild>
                  <a href={`mailto:${contact.email}`}>
                    <Mail className="size-3.5 mr-1.5" /> Send Email
                  </a>
                </Button>
              )}
            </div>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ContactsScreen() {
  const queryClient = useQueryClient();

  // Filters
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [emailHealth, setEmailHealth] = useState('');
  const [roleBucket, setRoleBucket] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Debounced search
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const handleSearchChange = (val: string) => {
    setSearch(val);
    const timer = setTimeout(() => {
      setDebouncedSearch(val);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  };

  const handleFilterChange = (filterType: string, val: string) => {
    if (filterType === 'status') setStatus(val === '__all' ? '' : val);
    else if (filterType === 'emailHealth') setEmailHealth(val === '__all' ? '' : val);
    else if (filterType === 'roleBucket') setRoleBucket(val === '__all' ? '' : val);
    else if (filterType === 'companyId') setCompanyId(val === '__all' ? '' : val);
    setPage(1);
  };

  // Fetch contacts
  const { data, isLoading, isError } = useQuery({
    queryKey: ['contacts', debouncedSearch, status, emailHealth, roleBucket, companyId, page, PAGE_SIZE],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (status) params.set('status', status);
      if (emailHealth) params.set('emailHealth', emailHealth);
      if (roleBucket) params.set('roleBucket', roleBucket);
      if (companyId) params.set('companyId', companyId);
      params.set('page', String(page));
      params.set('pageSize', String(PAGE_SIZE));
      const res = await fetch(`/api/contacts?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json() as Promise<{
        contacts: (Contact & { company?: Pick<Company, 'id' | 'name'> })[];
        total: number;
        page: number;
        pageSize: number;
      }>;
    },
  });

  // Fetch companies for the dialog dropdown
  const { data: companiesData } = useQuery({
    queryKey: ['companies-list'],
    queryFn: async () => {
      const res = await fetch('/api/companies?pageSize=200');
      if (!res.ok) throw new Error('Failed');
      const json = await res.json();
      return json.companies as { id: string; name: string }[];
    },
  });

  // Fetch companies for filter dropdown
  const { data: filterCompanies } = useQuery({
    queryKey: ['companies-filter-list'],
    queryFn: async () => {
      const res = await fetch('/api/companies?pageSize=500');
      if (!res.ok) throw new Error('Failed');
      const json = await res.json();
      return json.companies as { id: string; name: string }[];
    },
  });

  const contacts = data?.contacts || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);

  // Selection logic
  const allSelected = contacts.length > 0 && contacts.every((c) => selectedIds.has(c.id));
  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(contacts.map((c) => c.id)));
    }
  };
  const toggleOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBulkArchive = async () => {
    const promises = Array.from(selectedIds).map((id) =>
      fetch(`/api/contacts/${id}`, { method: 'DELETE' })
    );
    await Promise.all(promises);
    setSelectedIds(new Set());
    queryClient.invalidateQueries({ queryKey: ['contacts'] });
  };

  const handleBulkHealthCheck = async () => {
    const promises = Array.from(selectedIds).map((id) =>
      fetch('/api/health-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactId: id }),
      })
    );
    await Promise.all(promises);
    setSelectedIds(new Set());
    queryClient.invalidateQueries({ queryKey: ['contacts'] });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex flex-col gap-4 px-6 pt-6 pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center size-9 rounded-lg bg-teal-50 dark:bg-teal-950/50">
              <Users className="size-5 text-teal-600 dark:text-teal-400" />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-foreground">Contacts</h1>
              {!isLoading && (
                <p className="text-sm text-muted-foreground">
                  {total} {total === 1 ? 'contact' : 'contacts'} total
                </p>
              )}
            </div>
          </div>
          <Button
            onClick={() => setDialogOpen(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
          >
            <Plus className="size-4 mr-1.5" />
            Add Contact
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Search contacts..."
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-9 h-9 bg-muted/50 border-muted-foreground/10 focus-visible:border-emerald-500/50 focus-visible:ring-emerald-500/20"
            />
          </div>
          <Select value={status || '__all'} onValueChange={(v) => handleFilterChange('status', v)}>
            <SelectTrigger size="sm" className="w-[150px] bg-muted/50 border-muted-foreground/10">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value || '__all'} value={opt.value || '__all'}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={emailHealth || '__all'} onValueChange={(v) => handleFilterChange('emailHealth', v)}>
            <SelectTrigger size="sm" className="w-[140px] bg-muted/50 border-muted-foreground/10">
              <SelectValue placeholder="All Health" />
            </SelectTrigger>
            <SelectContent>
              {HEALTH_OPTIONS.map((opt) => (
                <SelectItem key={opt.value || '__all'} value={opt.value || '__all'}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={roleBucket || '__all'} onValueChange={(v) => handleFilterChange('roleBucket', v)}>
            <SelectTrigger size="sm" className="w-[140px] bg-muted/50 border-muted-foreground/10">
              <SelectValue placeholder="All Roles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">All Roles</SelectItem>
              {ROLE_BUCKETS.map((r) => (
                <SelectItem key={r} value={r}>{r}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={companyId || '__all'} onValueChange={(v) => handleFilterChange('companyId', v)}>
            <SelectTrigger size="sm" className="w-[170px] bg-muted/50 border-muted-foreground/10">
              <SelectValue placeholder="All Companies" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">All Companies</SelectItem>
              {(filterCompanies || []).map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Bulk Action Bar */}
      <AnimatePresence>
        {selectedIds.size > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mx-6 mt-2 px-4 py-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 flex items-center justify-between gap-4">
              <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                {selectedIds.size} {selectedIds.size === 1 ? 'contact' : 'contacts'} selected
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-950/50"
                  onClick={handleBulkHealthCheck}
                >
                  <ShieldCheck className="size-3 mr-1.5" /> Run Health Check
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20"
                  onClick={handleBulkArchive}
                >
                  <Archive className="size-3 mr-1.5" /> Archive Selected
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Table */}
      <div className="flex-1 overflow-hidden px-6 py-4">
        <div className="h-full flex flex-col rounded-xl border border-border/60 bg-card overflow-hidden">
          {isLoading ? (
            <TableSkeleton />
          ) : isError ? (
            <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
              Failed to load contacts. Please try again.
            </div>
          ) : contacts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 gap-3 text-center px-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
              >
                <div className="flex items-center justify-center size-16 rounded-2xl bg-muted/80 mb-2">
                  <Users className="size-8 text-muted-foreground/50" />
                </div>
              </motion.div>
              <div>
                <p className="text-sm font-medium text-foreground">No contacts found</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Add a contact or adjust your filters.
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setDialogOpen(true)} className="mt-1">
                <Plus className="size-3.5 mr-1.5" /> Add Contact
              </Button>
            </div>
          ) : (
            <div className="flex-1 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-border/40 bg-muted/30">
                    <TableHead className="w-10 pl-4">
                      <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
                    </TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground/70">
                      Name
                    </TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground/70">
                      Company
                    </TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground/70">
                      Job Title
                    </TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground/70">
                      Email
                    </TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground/70">
                      Role
                    </TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground/70">
                      Status
                    </TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground/70">
                      Health
                    </TableHead>
                    <TableHead className="w-10 pr-4" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <AnimatePresence mode="popLayout">
                    {contacts.map((contact, idx) => (
                      <motion.tr
                        key={contact.id}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.15, delay: idx * 0.02 }}
                        className={`group border-b border-border/30 last:border-0 transition-colors cursor-pointer ${
                          selectedIds.has(contact.id) ? 'bg-emerald-50/50 dark:bg-emerald-950/10' : 'hover:bg-muted/40'
                        }`}
                        onClick={() => setSelectedContactId(contact.id)}
                      >
                        <TableCell className="pl-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedIds.has(contact.id)}
                            onCheckedChange={() => toggleOne(contact.id)}
                          />
                        </TableCell>
                        <TableCell className="py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="size-7 rounded-full bg-gradient-to-br from-teal-50 to-emerald-50 dark:from-teal-950/50 dark:to-emerald-950/50 flex items-center justify-center border border-border/50 shrink-0">
                              <span className="text-[10px] font-bold text-teal-700 dark:text-teal-300">{contact.name.slice(0, 2).toUpperCase()}</span>
                            </div>
                            <span className="text-sm font-medium text-foreground truncate max-w-[160px]">{contact.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="py-3">
                          {contact.company ? (
                            <span className="text-sm text-muted-foreground truncate max-w-[140px] block">{contact.company.name}</span>
                          ) : (
                            <span className="text-xs text-muted-foreground/50">—</span>
                          )}
                        </TableCell>
                        <TableCell className="py-3">
                          <span className="text-sm text-muted-foreground truncate max-w-[160px] block">{contact.jobTitle || '—'}</span>
                        </TableCell>
                        <TableCell className="py-3">
                          {contact.email ? (
                            <div className="flex items-center gap-1.5">
                              <Mail className="size-3 text-muted-foreground shrink-0" />
                              <span className="text-sm text-muted-foreground truncate max-w-[180px]">{contact.email}</span>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground/50">—</span>
                          )}
                        </TableCell>
                        <TableCell className="py-3">
                          {contact.roleBucket ? (
                            <Badge variant="secondary" className="text-[11px] font-medium bg-muted/80">{contact.roleBucket}</Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground/50">—</span>
                          )}
                        </TableCell>
                        <TableCell className="py-3">{getStatusBadge(contact.status)}</TableCell>
                        <TableCell className="py-3">{getHealthBadge(contact.emailHealth)}</TableCell>
                        <TableCell className="py-3 pr-4" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="size-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <MoreHorizontal className="size-4" />
                                <span className="sr-only">Actions</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44">
                              <DropdownMenuItem onClick={() => setSelectedContactId(contact.id)}>
                                <CheckCircle2 className="size-4 mr-2" /> View Details
                              </DropdownMenuItem>
                              {contact.email && (
                                <DropdownMenuItem asChild>
                                  <a href={`mailto:${contact.email}`}>
                                    <Mail className="size-4 mr-2" /> Send Email
                                  </a>
                                </DropdownMenuItem>
                              )}
                              {contact.linkedinUrl && (
                                <DropdownMenuItem asChild>
                                  <a href={contact.linkedinUrl} target="_blank" rel="noopener noreferrer">
                                    <Linkedin className="size-4 mr-2" /> LinkedIn
                                  </a>
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-red-600 dark:text-red-400"
                                onClick={async () => {
                                  await fetch(`/api/contacts/${contact.id}`, { method: 'DELETE' });
                                  queryClient.invalidateQueries({ queryKey: ['contacts'] });
                                }}
                              >
                                <Archive className="size-4 mr-2" /> Archive
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination */}
          {!isLoading && !isError && contacts.length > 0 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border/40 bg-muted/20">
              <p className="text-sm text-muted-foreground">
                Showing <span className="font-medium text-foreground">{from}</span>–
                <span className="font-medium text-foreground">{to}</span> of{' '}
                <span className="font-medium text-foreground">{total}</span>
              </p>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="h-8"
                >
                  <ChevronLeft className="size-4" />
                  <span className="sr-only sm:not-sr-only ml-1">Previous</span>
                </Button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum: number;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (page <= 3) {
                    pageNum = i + 1;
                  } else if (page >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = page - 2 + i;
                  }
                  return (
                    <Button
                      key={pageNum}
                      variant={page === pageNum ? 'default' : 'outline'}
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => setPage(pageNum)}
                    >
                      {pageNum}
                    </Button>
                  );
                })}
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="h-8"
                >
                  <span className="sr-only sm:not-sr-only mr-1">Next</span>
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Dialogs */}
      <AddContactDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        companies={companiesData || []}
      />
      <ContactDetailSheet
        contactId={selectedContactId}
        open={!!selectedContactId}
        onOpenChange={(open) => { if (!open) setSelectedContactId(null); }}
      />
    </div>
  );
}