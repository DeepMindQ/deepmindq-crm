'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, ShieldCheck, Sparkles, Plus, Archive, Mail, Phone, MapPin,
  Building2, Linkedin, Copy, RefreshCw, FileText, Clock, Loader2,
} from 'lucide-react'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'
import { useAppStore } from '@/lib/store'
import { EmptyState, getActivityIcon } from '@/components/shared/design-system'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

/* ── Helpers ── */

const healthVariant = (h: string) =>
  h === 'valid' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
  : h === 'risky' ? 'bg-amber-50 text-amber-700 border border-amber-200'
  : h === 'invalid' ? 'bg-red-50 text-red-700 border border-red-200'
  : 'bg-gray-100 text-gray-600 border border-gray-200'

const draftStatusVariant = (s: string) =>
  s === 'sent' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
  : s === 'rejected' ? 'bg-red-50 text-red-700 border border-red-200'
  : 'bg-gray-100 text-gray-600 border border-gray-200'

const matchScoreColor = (score: number | null) =>
  score == null ? 'text-gray-400' : score >= 80 ? 'text-emerald-600' : score >= 60 ? 'text-amber-600' : 'text-red-500'

/* ── Component ── */

export default function ContactDetailScreen() {
  const { selectedContactId, setActiveView } = useAppStore()
  const qc = useQueryClient()

  const [noteOpen, setNoteOpen] = useState(false)
  const [noteBody, setNoteBody] = useState('')
  const [noteType, setNoteType] = useState('')

  const [editOpen, setEditOpen] = useState(false)
  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    jobTitle: '',
    roleBucket: '',
    phone: '',
    location: '',
    linkedinUrl: '',
  })

  /* ── Query ── */
  const { data, isLoading } = useQuery({
    queryKey: ['contact', selectedContactId],
    queryFn: () => fetch(`/api/contacts/${selectedContactId}`).then(r => r.json()),
    enabled: !!selectedContactId,
  })

  /* ── Mutations ── */
  const addNote = useMutation({
    mutationFn: (body: { body: string; noteType: string }) =>
      fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, contactId: selectedContactId }),
      }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contact'] })
      setNoteOpen(false)
      setNoteBody('')
      setNoteType('')
      toast.success('Note added')
    },
    onError: () => toast.error('Failed to add note'),
  })

  const archiveContact = useMutation({
    mutationFn: () =>
      fetch(`/api/contacts/${selectedContactId}`, { method: 'DELETE' }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contact'] })
      qc.invalidateQueries({ queryKey: ['contacts'] })
      toast.success('Contact archived')
      setActiveView('contacts')
    },
    onError: () => toast.error('Failed to archive contact'),
  })

  const editContact = useMutation({
    mutationFn: (form: typeof editForm) =>
      fetch(`/api/contacts/${selectedContactId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      }).then(r => r.ok ? r.json() : r.json().then(e => { throw new Error(e.error || 'Failed to update contact') })),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contact', selectedContactId] })
      qc.invalidateQueries({ queryKey: ['contacts'] })
      setEditOpen(false)
      toast.success('Contact updated')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const openEditDialog = () => {
    setEditForm({
      name: data.name || '',
      email: data.email || '',
      jobTitle: data.jobTitle || '',
      roleBucket: data.roleBucket || '',
      phone: data.phone || '',
      location: data.location || '',
      linkedinUrl: data.linkedinUrl || '',
    })
    setEditOpen(true)
  }

  const validateEmail = useMutation({
    mutationFn: () =>
      fetch(`/api/contacts/${selectedContactId}/validate`, {
        method: 'POST',
      }).then(r => r.ok ? r.json() : r.json().then(e => { throw new Error(e.error || 'Validation failed') })),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contact', selectedContactId] })
      toast.success('Email validated')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const regenerateDraft = useMutation({
    mutationFn: () =>
      fetch(`/api/contacts/${selectedContactId}/generate-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }).then(r => r.ok ? r.json() : r.json().then(e => { throw new Error(e.error || 'Regeneration failed') })),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contact', selectedContactId] })
      toast.success('Draft regenerated')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  /* ── Handlers ── */
  const handleGenerateEmail = () => {
    useAppStore.getState().setSelectedContactId(selectedContactId)
    useAppStore.getState().setActiveView('email-generation')
  }

  /* ── Guards ── */
  if (!selectedContactId) {
    return (
      <EmptyState
        icon={Mail}
        title="No contact selected"
        description="Go back to Contacts and select one."
        actionLabel="Back to Contacts"
        onAction={() => setActiveView('contacts')}
      />
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32" />
        <Skeleton className="h-64" />
      </div>
    )
  }

  if (!data) {
    return (
      <EmptyState
        icon={Mail}
        title="Contact not found"
        description="This contact may have been deleted."
        actionLabel="Back to Contacts"
        onAction={() => setActiveView('contacts')}
      />
    )
  }

  const { notes = [], timeline = [], drafts = [], healthChecks = [] } = data
  const latestCheck = healthChecks[0] ?? null

  return (
    <div className="space-y-6">
      {/* ════════════ Header ════════════ */}
      <div className="rounded-xl bg-white p-4 md:p-6 card-rest slide-up">
        <div className="flex items-start gap-4 md:gap-5">
          {/* Avatar */}
          <div className="size-12 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
            <span className="text-lg font-bold text-amber-700">{data.name?.charAt(0)?.toUpperCase()}</span>
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setActiveView('contacts')}
                className="text-gray-400 hover:text-gray-700 transition-colors"
              >
                <ArrowLeft className="size-4" />
              </button>
              <h2 className="text-xl font-bold text-gray-900 tracking-tight truncate">{data.name}</h2>
              {data.jobTitle && (
                <span className="text-sm text-gray-500">{data.jobTitle}</span>
              )}
            </div>

            <div className="flex items-center gap-3 mt-2 flex-wrap">
              {data.company?.name && (
                <Badge className="bg-gray-100 text-gray-600 hover:bg-gray-100 text-xs font-normal border-0">
                  {data.company.name}
                </Badge>
              )}
              {data.email && (
                <span className="text-xs font-mono text-gray-500">{data.email}</span>
              )}
              {data.linkedinUrl && (
                <a
                  href={data.linkedinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-blue-600 transition-colors"
                >
                  <Linkedin className="size-3.5" />
                </a>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 mt-4 flex-wrap">
              <Button
                size="sm"
                className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg press-scale shadow-xs"
                onClick={() => validateEmail.mutate()}
                disabled={validateEmail.isPending}
              >
                {validateEmail.isPending ? (
                  <Loader2 className="size-3.5 mr-1.5 animate-spin" />
                ) : (
                  <ShieldCheck className="size-3.5 mr-1.5" />
                )}
                {validateEmail.isPending ? 'Validating...' : 'Validate Email'}
              </Button>
              <Button
                size="sm"
                className="h-8 text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg press-scale shadow-xs"
                onClick={handleGenerateEmail}
              >
                <Sparkles className="size-3.5 mr-1.5" /> Generate Email
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs border-gray-200 text-gray-600 rounded-lg"
                onClick={() => setNoteOpen(true)}
              >
                <Plus className="size-3.5 mr-1.5" /> Add Note
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs border-gray-200 text-gray-600 rounded-lg"
                onClick={openEditDialog}
              >
                <FileText className="size-3.5 mr-1.5" /> Edit
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs border-gray-200 text-gray-600 rounded-lg"
                onClick={() => archiveContact.mutate()}
                disabled={archiveContact.isPending}
              >
                <Archive className="size-3.5 mr-1.5" /> Archive
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* ════════════ Tabs ════════════ */}
      <Tabs defaultValue="overview">
        <TabsList className="bg-gray-100 rounded-lg p-1 h-auto gap-0.5 overflow-x-auto">
          {['overview', 'notes', 'activity', 'drafts'].map((tab) => (
            <TabsTrigger
              key={tab}
              value={tab}
              className="rounded-md text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-gray-900 data-[state=active]:font-medium text-gray-500 hover:text-gray-700 transition-colors px-3 py-1.5"
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
              {tab === 'notes' && notes.length > 0 && (
                <span className="ml-1.5 text-[10px] bg-gray-200 text-gray-600 px-1.5 rounded-full">{notes.length}</span>
              )}
              {tab === 'activity' && timeline.length > 0 && (
                <span className="ml-1.5 text-[10px] bg-gray-200 text-gray-600 px-1.5 rounded-full">{timeline.length}</span>
              )}
              {tab === 'drafts' && drafts.length > 0 && (
                <span className="ml-1.5 text-[10px] bg-gray-200 text-gray-600 px-1.5 rounded-full">{drafts.length}</span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* ── Overview ── */}
        <TabsContent value="overview" className="space-y-6 mt-5">
          {/* Info Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {([
              ['Email', data.email, Mail],
              ['Phone', data.phone, Phone],
              ['Job Title', data.jobTitle, FileText],
              ['Role', data.roleBucket, Building2],
              ['Company', data.company?.name, Building2],
              ['Location', data.location, MapPin],
            ] as const).map(([label, val, Icon]) => (
              <div key={label} className="rounded-xl bg-white p-6 card-rest">
                <div className="flex items-center gap-2 mb-1">
                  <Icon className="size-3.5 text-gray-400" />
                  <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">{label}</p>
                </div>
                <p className="text-sm font-semibold text-gray-900 capitalize">{val || '—'}</p>
              </div>
            ))}
          </div>

          {/* Email Health */}
          <div className="rounded-xl bg-white p-6 card-rest">
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-4">
              <ShieldCheck className="size-4 text-gray-400" /> Email Health
            </h3>
            {data.emailHealth ? (
              <div className="flex items-center gap-4 flex-wrap">
                <span className={cn('inline-flex items-center rounded-md px-2.5 py-1 text-xs font-medium', healthVariant(data.emailHealth))}>
                  {data.emailHealth}
                </span>
                {data.emailHealthScore != null && (
                  <span className="text-sm text-gray-500">
                    Score: <span className="font-semibold text-gray-900">{data.emailHealthScore}/100</span>
                  </span>
                )}
                {data.lastValidatedAt && (
                  <span className="text-xs text-gray-400 flex items-center gap-1">
                    <Clock className="size-3" />
                    Last validated {formatDistanceToNow(new Date(data.lastValidatedAt), { addSuffix: true })}
                  </span>
                )}
              </div>
            ) : latestCheck ? (
              <div className="flex items-center gap-4 flex-wrap">
                <span className={cn('inline-flex items-center rounded-md px-2.5 py-1 text-xs font-medium', healthVariant(latestCheck.status))}>
                  {latestCheck.status}
                </span>
                <span className="text-sm text-gray-500">
                  Score: <span className="font-semibold text-gray-900">{latestCheck.score}/100</span>
                </span>
                <span className="text-xs text-gray-400 flex items-center gap-1">
                  <Clock className="size-3" />
                  Last validated {formatDistanceToNow(new Date(latestCheck.checkedAt), { addSuffix: true })}
                </span>
              </div>
            ) : (
              <p className="text-sm text-gray-500">No email validation performed yet.</p>
            )}
          </div>
        </TabsContent>

        {/* ── Notes ── */}
        <TabsContent value="notes" className="mt-5">
          <div className="flex justify-end mb-4">
            <Button
              size="sm"
              className="bg-amber-600 hover:bg-amber-700 text-white rounded-lg press-scale"
              onClick={() => setNoteOpen(true)}
            >
              <Plus className="size-3.5 mr-1.5" /> Add Note
            </Button>
          </div>
          {notes.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No notes yet"
              description="Add notes to track conversations, insights, and action items for this contact."
              actionLabel="Add Note"
              onAction={() => setNoteOpen(true)}
            />
          ) : (
            <div className="space-y-3">
              {notes.map((n: any) => (
                <div key={n.id} className="rounded-xl bg-white p-5 card-rest slide-up">
                  <p className="text-sm text-gray-700 leading-relaxed">{n.body}</p>
                  <div className="flex items-center gap-2 mt-3">
                    {n.noteType && (
                      <Badge className="bg-gray-100 text-gray-600 hover:bg-gray-100 text-[11px] font-normal border-0 capitalize">
                        {n.noteType}
                      </Badge>
                    )}
                    <span className="text-[11px] text-gray-400">
                      {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Activity ── */}
        <TabsContent value="activity" className="mt-5">
          {timeline.length === 0 ? (
            <EmptyState
              icon={Clock}
              title="No activity yet"
              description="Activity will appear here as you interact with this contact."
            />
          ) : (
            <div className="relative pl-6">
              <div className="absolute left-[7px] top-1 bottom-1 border-l-2 border-gray-200" />
              <div className="space-y-4">
                {timeline.map((t: any) => {
                  const iconData = getActivityIcon(t.action)
                  const Icon = iconData.icon
                  return (
                    <div key={t.id} className="relative flex items-start gap-4 slide-up">
                      <div className="absolute -left-6 top-1 size-3 rounded-full bg-white ring-4 ring-white border-2 border-amber-400" />
                      <div className={cn('shrink-0 mt-0.5 rounded-lg p-1.5', iconData.bg)}>
                        <Icon className={cn('size-3.5', iconData.color)} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 capitalize">
                          {t.action.replace(/_/g, ' ')}
                        </p>
                        {t.details && (
                          <p className="text-sm text-gray-500 mt-0.5">{t.details}</p>
                        )}
                        <p className="text-[11px] text-gray-400 mt-1">
                          {formatDistanceToNow(new Date(t.createdAt), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </TabsContent>

        {/* ── Drafts ── */}
        <TabsContent value="drafts" className="mt-5">
          {drafts.length === 0 ? (
            <EmptyState
              icon={Sparkles}
              title="No drafts yet"
              description="Generate AI-powered email drafts for this contact to get started."
            />
          ) : (
            <div className="space-y-3">
              {drafts.map((d: any) => (
                <div key={d.id} className="rounded-xl bg-white p-5 card-rest slide-up">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-900 truncate">{d.subject || 'Untitled Draft'}</p>
                      <p className="text-sm text-gray-500 mt-1 line-clamp-2 leading-relaxed">{d.body}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {d.matchScore != null && (
                        <span className={cn('text-xs font-semibold', matchScoreColor(d.matchScore))}>
                          {d.matchScore}%
                        </span>
                      )}
                      <span className={cn('inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium capitalize border', draftStatusVariant(d.status))}>
                        {d.status}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs border-gray-200 text-gray-600 rounded-md"
                      onClick={() => regenerateDraft.mutate()}
                      disabled={regenerateDraft.isPending}
                    >
                      {regenerateDraft.isPending ? (
                        <Loader2 className="size-3 mr-1 animate-spin" />
                      ) : (
                        <RefreshCw className="size-3 mr-1" />
                      )}
                      {regenerateDraft.isPending ? 'Regenerating...' : 'Regenerate'}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs border-gray-200 text-gray-600 rounded-md"
                      onClick={() => {
                        navigator.clipboard.writeText(d.body)
                        toast.success('Draft copied to clipboard')
                      }}
                    >
                      <Copy className="size-3 mr-1" /> Copy
                    </Button>
                    <span className="text-[11px] text-gray-400 ml-auto">
                      {formatDistanceToNow(new Date(d.createdAt), { addSuffix: true })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ════════════ Edit Contact Dialog ════════════ */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-gray-900">Edit Contact</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Name *</Label>
              <Input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} placeholder="Full name" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Email</Label>
              <Input type="email" value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} placeholder="email@company.com" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Job Title</Label>
                <Input value={editForm.jobTitle} onChange={e => setEditForm(f => ({ ...f, jobTitle: e.target.value }))} placeholder="e.g. VP Engineering" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Role Bucket</Label>
                <Select value={editForm.roleBucket} onValueChange={v => setEditForm(f => ({ ...f, roleBucket: v }))}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Select role" /></SelectTrigger>
                  <SelectContent>
                    {['Executive', 'Manager', 'Technical', 'Operations', 'Sales', 'Other'].map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</Label>
                <Input type="tel" value={editForm.phone} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} placeholder="+1 (555) 000-0000" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Location</Label>
                <Input value={editForm.location} onChange={e => setEditForm(f => ({ ...f, location: e.target.value }))} placeholder="City, Country" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-500 uppercase tracking-wider">LinkedIn URL</Label>
              <Input value={editForm.linkedinUrl} onChange={e => setEditForm(f => ({ ...f, linkedinUrl: e.target.value }))} placeholder="https://linkedin.com/in/..." />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setEditOpen(false)} className="text-gray-600 border-gray-200 hover:bg-gray-50 hover:text-gray-900">Cancel</Button>
            <Button
              onClick={() => editContact.mutate(editForm)}
              disabled={!editForm.name.trim() || editContact.isPending}
              className="bg-gray-900 text-white hover:bg-gray-800 press-scale"
            >
              {editContact.isPending ? <Loader2 className="size-3.5 mr-1.5 animate-spin" /> : null}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ════════════ Add Note Dialog ════════════ */}
      <Dialog open={noteOpen} onOpenChange={setNoteOpen}>
        <DialogContent className="sm:max-w-md rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-gray-900">Add Note</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Type</Label>
              <Select value={noteType} onValueChange={setNoteType}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="call">Call</SelectItem>
                  <SelectItem value="meeting">Meeting</SelectItem>
                  <SelectItem value="research">Research</SelectItem>
                  <SelectItem value="general">General</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Note</Label>
              <Textarea
                value={noteBody}
                onChange={(e) => setNoteBody(e.target.value)}
                rows={3}
                placeholder="Write your note..."
                className="resize-none"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setNoteOpen(false)}
              className="text-gray-600 border-gray-200 hover:bg-gray-50 hover:text-gray-900"
            >
              Cancel
            </Button>
            <Button
              onClick={() => addNote.mutate({ body: noteBody, noteType: noteType })}
              disabled={!noteBody.trim() || addNote.isPending}
              className="bg-gray-900 text-white hover:bg-gray-800 press-scale"
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}