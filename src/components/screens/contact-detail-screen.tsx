'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, ShieldCheck, Sparkles, Plus, Archive, Mail, Phone, MapPin,
  Building2, Linkedin, Copy, RefreshCw, FileText, Clock, Loader2, X,
  AlertTriangle, CheckCircle2, XCircle, ChevronDown, ChevronUp,
  ExternalLink, Eye, ChevronRight,
} from 'lucide-react'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'
import { useAppStore } from '@/lib/store'
import { EmptyState, getActivityIcon, ScoreGauge } from '@/components/shared/design-system'
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
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'

/* ── Style helpers ── */

const healthVariant = (h: string) =>
  h === 'valid'
    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
    : h === 'risky'
      ? 'bg-amber-50 text-amber-700 border border-amber-200'
      : h === 'invalid'
        ? 'bg-red-50 text-red-700 border border-red-200'
        : 'bg-gray-100 text-gray-600 border border-gray-200'

const draftStatusVariant = (s: string) =>
  s === 'sent'
    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
    : s === 'rejected'
      ? 'bg-red-50 text-red-700 border border-red-200'
      : 'bg-gray-100 text-gray-600 border border-gray-200'

const matchScoreColor = (score: number | null) =>
  score == null
    ? 'text-gray-400'
    : score >= 80
      ? 'text-emerald-600'
      : score >= 60
        ? 'text-amber-600'
        : 'text-red-500'

const ROLES = ['Executive', 'Manager', 'Technical', 'Operations', 'Sales', 'Other']

/* ── Component ── */

export default function ContactDetailScreen() {
  const { selectedContactId, setActiveView, setSelectedCompanyId } = useAppStore()
  const qc = useQueryClient()

  /* ── Local state ── */
  const [tab, setTab] = useState('overview')
  const [noteOpen, setNoteOpen] = useState(false)
  const [noteBody, setNoteBody] = useState('')
  const [noteType, setNoteType] = useState('')
  const [deleteNoteId, setDeleteNoteId] = useState<string | null>(null)
  const [expandedDraftId, setExpandedDraftId] = useState<string | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [editForm, setEditForm] = useState({
    name: '', email: '', jobTitle: '', roleBucket: '',
    phone: '', location: '', linkedinUrl: '',
  })

  /* ── Validation detailed result ── */
  const [validationDetail, setValidationDetail] = useState<any>(null)
  const [showValidation, setShowValidation] = useState(false)

  /* ── Generate email result ── */
  const [generatedEmail, setGeneratedEmail] = useState<any>(null)

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
      qc.invalidateQueries({ queryKey: ['contact', selectedContactId] })
      setNoteOpen(false)
      setNoteBody('')
      setNoteType('')
      toast.success('Note added')
    },
    onError: () => toast.error('Failed to add note'),
  })

  const deleteNoteMutation = useMutation({
    mutationFn: (noteId: string) =>
      fetch(`/api/notes/${noteId}`, { method: 'DELETE' }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contact', selectedContactId] })
      setDeleteNoteId(null)
      toast.success('Note deleted')
    },
    onError: () => toast.error('Failed to delete note'),
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
      })
        .then(r => r.ok ? r.json() : r.json().then(e => { throw new Error(e.error || 'Failed to update contact') })),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contact', selectedContactId] })
      qc.invalidateQueries({ queryKey: ['contacts'] })
      setEditOpen(false)
      toast.success('Contact updated')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const validateEmail = useMutation({
    mutationFn: () =>
      fetch(`/api/contacts/${selectedContactId}/validate`, {
        method: 'POST',
      })
        .then(r => r.ok ? r.json() : r.json().then(e => { throw new Error(e.error || 'Validation failed') })),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['contact', selectedContactId] })
      setValidationDetail(result)
      setShowValidation(true)
      toast.success('Email validated')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const generateEmail = useMutation({
    mutationFn: () =>
      fetch(`/api/contacts/${selectedContactId}/generate-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
        .then(r => r.ok ? r.json() : r.json().then(e => { throw new Error(e.error || 'Generation failed') })),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['contact', selectedContactId] })
      setGeneratedEmail(result)
      toast.success('Email generated')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const regenerateDraft = useMutation({
    mutationFn: () =>
      fetch(`/api/contacts/${selectedContactId}/generate-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
        .then(r => r.ok ? r.json() : r.json().then(e => { throw new Error(e.error || 'Regeneration failed') })),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contact', selectedContactId] })
      toast.success('Draft regenerated')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const updateDraftStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      fetch(`/api/drafts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
        .then(r => r.ok ? r.json() : r.json().then(e => { throw new Error(e.error || 'Failed to update draft') })),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contact', selectedContactId] })
      toast.success('Draft status updated')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  /* ── Helpers ── */

  const openEditDialog = () => {
    if (!data) return
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

  const navigateToCompany = (companyId: string) => {
    setSelectedCompanyId(companyId)
    setActiveView('company-profile')
  }

  const navigateToEmailGen = () => {
    useAppStore.getState().setSelectedContactId(selectedContactId)
    setActiveView('email-generation')
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
        <Skeleton className="h-10 w-48 rounded-lg" />
        <div className="rounded-xl bg-white card-rest p-6 space-y-4">
          <div className="flex items-start gap-4">
            <Skeleton className="size-12 rounded-full shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-6 w-52" />
              <Skeleton className="h-4 w-80" />
              <div className="flex gap-2 mt-2">
                <Skeleton className="h-8 w-28 rounded-lg" />
                <Skeleton className="h-8 w-32 rounded-lg" />
                <Skeleton className="h-8 w-24 rounded-lg" />
              </div>
            </div>
          </div>
        </div>
        <Skeleton className="h-8 w-80 rounded-lg" />
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
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
  const hasDrafts = drafts.length > 0

  return (
    <div className="space-y-6">
      {/* ════════════ Header Card ════════════ */}
      <div className="rounded-xl bg-white p-4 md:p-6 card-rest slide-up">
        <div className="flex items-start gap-4 md:gap-5">
          {/* Avatar */}
          <div className="size-12 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
            <span className="text-lg font-bold text-amber-700">
              {data.name?.charAt(0)?.toUpperCase()}
            </span>
          </div>

          {/* Info block */}
          <div className="flex-1 min-w-0">
            {/* Top row: back, name, badges */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setActiveView('contacts')}
                className="inline-flex items-center gap-1.5 text-gray-400 hover:text-amber-600 transition-colors duration-150"
                title="Back to contacts"
              >
                <ArrowLeft className="size-3.5" />
                <span className="text-xs font-medium hover:underline underline-offset-2">Contacts</span>
              </button>
              <span className="text-gray-300 text-sm mx-1">/</span>
              <h2 className="text-xl font-bold text-gray-900 tracking-tight truncate">{data.name}</h2>
              {data.jobTitle && (
                <span className="text-sm text-gray-500 hidden sm:inline">· {data.jobTitle}</span>
              )}
              {data.status && data.status !== 'new' && (
                <Badge className="bg-blue-50 text-blue-700 border border-blue-200 text-xs font-medium capitalize">
                  {data.status}
                </Badge>
              )}
              {hasDrafts && (
                <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-200 px-2 py-0.5 text-[10px] font-medium">
                  <Sparkles className="size-2.5" />
                  AI Drafts
                </span>
              )}
            </div>

            {/* Meta row */}
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              {data.company?.name && (
                <button
                  onClick={() => navigateToCompany(data.companyId)}
                  className="inline-flex items-center gap-1.5 text-amber-600 hover:text-amber-700 text-xs font-medium hover:underline underline-offset-2 transition-colors duration-150"
                >
                  <Building2 className="size-3" />
                  {data.company.name}
                  <ChevronRight className="size-3" />
                </button>
              )}
              {data.email && (
                <span className="text-xs font-mono text-gray-500 flex items-center gap-1">
                  <Mail className="size-3" />
                  {data.email}
                </span>
              )}
              {data.phone && (
                <span className="text-xs text-gray-500 flex items-center gap-1">
                  <Phone className="size-3" />
                  {data.phone}
                </span>
              )}
              {data.location && (
                <span className="text-xs text-gray-500 flex items-center gap-1">
                  <MapPin className="size-3" />
                  {data.location}
                </span>
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
              {data.emailHealth && data.emailHealth !== 'unknown' && (
                <span className={cn('inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium gap-1', healthVariant(data.emailHealth))}>
                  <ShieldCheck className="size-3" />
                  {data.emailHealth}
                  {data.emailHealthScore != null && (
                    <span className="font-bold">{data.emailHealthScore}</span>
                  )}
                </span>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2 mt-4 flex-wrap">
              <Button
                size="sm"
                className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg press-scale shadow-xs"
                onClick={() => validateEmail.mutate()}
                disabled={validateEmail.isPending}
              >
                {validateEmail.isPending
                  ? <Loader2 className="size-3.5 mr-1.5 animate-spin" />
                  : <ShieldCheck className="size-3.5 mr-1.5" />
                }
                {validateEmail.isPending ? 'Validating...' : 'Validate Email'}
              </Button>
              <Button
                size="sm"
                className="h-8 text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg press-scale shadow-xs"
                onClick={() => { setTab('ai-emails'); generateEmail.mutate() }}
                disabled={generateEmail.isPending}
              >
                {generateEmail.isPending
                  ? <Loader2 className="size-3.5 mr-1.5 animate-spin" />
                  : <Sparkles className="size-3.5 mr-1.5" />
                }
                {generateEmail.isPending ? 'Generating...' : 'Generate Email'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs border-gray-200 text-gray-600 rounded-lg"
                onClick={() => { setTab('notes'); setNoteOpen(true) }}
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
              {data.companyId && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs gap-1.5 border-gray-200 text-gray-600 rounded-lg"
                  onClick={() => navigateToCompany(data.companyId)}
                >
                  <Building2 className="size-3.5" /> View Company
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ════════════ Tabs ════════════ */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-gray-100 rounded-lg p-1 h-auto gap-0.5 overflow-x-auto">
          {[
            { key: 'overview', label: 'Overview' },
            { key: 'ai-emails', label: 'AI Emails', count: drafts.length },
            { key: 'notes', label: 'Notes', count: notes.length },
            { key: 'activity', label: 'Activity', count: timeline.length },
          ].map(({ key, label, count }) => (
            <TabsTrigger
              key={key}
              value={key}
              className="rounded-md text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-gray-900 data-[state=active]:font-medium text-gray-500 hover:text-gray-700 transition-colors px-3 py-1.5"
            >
              {label}
              {count > 0 && (
                <span className="ml-1.5 text-[10px] bg-gray-200 text-gray-600 px-1.5 rounded-full tabular-nums">
                  {count}
                </span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* ════════════ OVERVIEW TAB ════════════ */}
        <TabsContent value="overview" className="space-y-6 mt-5">
          {/* Info Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 slide-up">
            {([
              ['Email', data.email, Mail],
              ['Phone', data.phone, Phone],
              ['Job Title', data.jobTitle, FileText],
              ['Role', data.roleBucket, Building2],
              ['Location', data.location, MapPin],
              ['LinkedIn', data.linkedinUrl, Linkedin],
            ] as const).map(([label, val, Icon]) => (
              <div key={label} className="rounded-xl bg-white p-5 card-rest">
                <div className="flex items-center gap-2 mb-1.5">
                  <Icon className="size-3.5 text-gray-400" />
                  <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">{label}</p>
                </div>
                {label === 'LinkedIn' && val ? (
                  <a
                    href={val}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-amber-600 hover:text-amber-700 inline-flex items-center gap-1 transition-colors"
                  >
                    View Profile <ExternalLink className="size-3" />
                  </a>
                ) : (
                  <p className="text-sm font-semibold text-gray-900 capitalize break-all">{val || '—'}</p>
                )}
              </div>
            ))}
          </div>

          {/* Company Card — clickable */}
          {data.company && (
            <button
              onClick={() => navigateToCompany(data.companyId)}
              className="w-full text-left rounded-xl bg-white p-5 card-interactive hover:ring-amber-200 slide-up transition-all"
            >
              <div className="flex items-center gap-4">
                <div className="size-10 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
                  <Building2 className="size-5 text-amber-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">Company</p>
                  <p className="text-sm font-bold text-gray-900 truncate">{data.company.name}</p>
                  {data.company.domain && (
                    <p className="text-xs text-gray-500 mt-0.5">{data.company.domain}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 text-gray-400">
                  {data.company.industry && (
                    <span className="text-xs bg-gray-100 px-2 py-0.5 rounded-md text-gray-600">
                      {data.company.industry}
                    </span>
                  )}
                  <ArrowLeft className="size-4 rotate-180" />
                </div>
              </div>
            </button>
          )}

          {/* Email Health Score — Visual Gauge */}
          <div className="rounded-xl bg-white p-6 card-rest slide-up">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <ShieldCheck className="size-4 text-gray-400" />
                Email Health Score
              </h3>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs border-gray-200 text-gray-600 rounded-lg"
                onClick={() => validateEmail.mutate()}
                disabled={validateEmail.isPending}
              >
                {validateEmail.isPending
                  ? <Loader2 className="size-3 mr-1 animate-spin" />
                  : <RefreshCw className="size-3 mr-1" />
                }
                Re-validate
              </Button>
            </div>

            {latestCheck || validationDetail ? (() => {
              const check = validationDetail || latestCheck
              const score = check.score ?? check.emailHealthScore ?? 0
              return (
                <>
                  <div className="flex flex-col sm:flex-row items-center gap-8">
                    <ScoreGauge
                      score={score}
                      size={140}
                      strokeWidth={12}
                      label={check.status || 'unknown'}
                      sublabel={`Checked ${formatDistanceToNow(new Date(check.checkedAt || check.createdAt), { addSuffix: true })}`}
                      segments={[
                        { label: 'Syntax', value: check.syntaxOk ? 100 : 0, color: check.syntaxOk ? '#059669' : '#DC2626' },
                        { label: 'Domain', value: check.domainOk ? 100 : 0, color: check.domainOk ? '#059669' : '#DC2626' },
                        { label: 'MX Record', value: check.mxOk ? 100 : 0, color: check.mxOk ? '#059669' : '#DC2626' },
                        { label: 'Not Disposable', value: check.disposableOk ? 100 : 0, color: check.disposableOk ? '#059669' : '#DC2626' },
                      ]}
                    />
                  </div>

                  {/* Detailed breakdown */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-6">
                    {([
                      ['Syntax', check.syntaxOk],
                      ['Domain', check.domainOk],
                      ['MX Record', check.mxOk],
                      ['Not Disposable', check.disposableOk],
                    ] as const).map(([label, ok]) => (
                      <div key={label} className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2.5">
                        {ok ? (
                          <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
                        ) : (
                          <XCircle className="size-4 text-red-400 shrink-0" />
                        )}
                        <span className="text-xs font-medium text-gray-700">{label}</span>
                      </div>
                    ))}
                  </div>

                  {check.actionRecommendation && (
                    <div className="mt-4 rounded-lg bg-blue-50 border border-blue-100 px-4 py-3">
                      <p className="text-xs font-semibold text-blue-700 mb-1">Recommendation</p>
                      <p className="text-sm text-blue-800 leading-relaxed">{check.actionRecommendation}</p>
                    </div>
                  )}
                </>
              )
            })() : (
              <div className="flex flex-col items-center py-8 text-center">
                <div className="size-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                  <ShieldCheck className="size-6 text-gray-300" />
                </div>
                <p className="text-sm text-gray-500 mb-3">No email validation performed yet.</p>
                <Button
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg press-scale shadow-xs h-8 text-xs"
                  onClick={() => validateEmail.mutate()}
                  disabled={validateEmail.isPending}
                >
                  {validateEmail.isPending
                    ? <Loader2 className="size-3.5 mr-1.5 animate-spin" />
                    : <ShieldCheck className="size-3.5 mr-1.5" />
                  }
                  {validateEmail.isPending ? 'Validating...' : 'Validate Now'}
                </Button>
              </div>
            )}
          </div>
        </TabsContent>

        {/* ════════════ AI EMAILS TAB ════════════ */}
        <TabsContent value="ai-emails" className="mt-5">
          {/* Generate result banner */}
          {generatedEmail && (
            <div className="rounded-xl bg-indigo-50 border border-indigo-100 p-5 mb-5 slide-up">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="size-4 text-indigo-600" />
                <h4 className="text-sm font-semibold text-indigo-900">Just Generated</h4>
                <Badge className="bg-indigo-100 text-indigo-700 border border-indigo-200 text-[10px] font-medium">
                  AI Generated
                </Badge>
              </div>
              <p className="text-sm font-semibold text-gray-900 mb-1">{generatedEmail.subject}</p>
              <p className="text-xs text-gray-600 line-clamp-3 whitespace-pre-wrap mb-3">{generatedEmail.body}</p>
              <div className="flex items-center gap-3 flex-wrap">
                {generatedEmail.matchScore != null && (
                  <span className={cn('text-xs font-semibold', matchScoreColor(generatedEmail.matchScore))}>
                    Match {generatedEmail.matchScore}%
                  </span>
                )}
                {generatedEmail.confidence != null && (
                  <span className="text-xs text-gray-500">Confidence {generatedEmail.confidence}%</span>
                )}
                {generatedEmail.tone && (
                  <span className="text-xs bg-white text-gray-600 px-2 py-0.5 rounded-md border border-gray-200">
                    {generatedEmail.tone}
                  </span>
                )}
                {generatedEmail.emailLength && (
                  <span className="text-xs bg-white text-gray-600 px-2 py-0.5 rounded-md border border-gray-200">
                    {generatedEmail.emailLength}
                  </span>
                )}
                {generatedEmail.ctaStyle && (
                  <span className="text-xs bg-white text-gray-600 px-2 py-0.5 rounded-md border border-gray-200">
                    CTA: {generatedEmail.ctaStyle}
                  </span>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs border-gray-200 text-gray-600 rounded-md ml-auto"
                  onClick={() => {
                    navigator.clipboard.writeText(generatedEmail.body)
                    toast.success('Copied to clipboard')
                  }}
                >
                  <Copy className="size-3 mr-1" /> Copy
                </Button>
              </div>
            </div>
          )}

          {/* Generate button */}
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-gray-500">
              {drafts.length} draft{drafts.length !== 1 ? 's' : ''} generated for this contact
            </p>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                className="bg-amber-600 hover:bg-amber-700 text-white rounded-lg press-scale shadow-xs"
                onClick={() => generateEmail.mutate()}
                disabled={generateEmail.isPending}
              >
                {generateEmail.isPending
                  ? <Loader2 className="size-3.5 mr-1.5 animate-spin" />
                  : <Sparkles className="size-3.5 mr-1.5" />
                }
                {generateEmail.isPending ? 'Generating...' : 'Generate New Email'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="border-gray-200 text-gray-600 rounded-lg"
                onClick={navigateToEmailGen}
              >
                <Eye className="size-3.5 mr-1.5" /> Open in Generator
              </Button>
            </div>
          </div>

          {drafts.length === 0 && !generatedEmail ? (
            <EmptyState
              icon={Sparkles}
              title="No AI drafts yet"
              description="Generate an AI-powered email draft tailored for this contact."
              actionLabel="Generate Email"
              onAction={() => generateEmail.mutate()}
            />
          ) : (
            <div className="space-y-3">
              {drafts.map((d: any) => {
                const isExpanded = expandedDraftId === d.id
                const isTemplate = d.sourceType === 'template' || d.isTemplateBased
                return (
                  <div key={d.id} className="rounded-xl bg-white card-rest slide-up overflow-hidden">
                    {/* Draft header */}
                    <button
                      className="w-full p-5 text-left"
                      onClick={() => setExpandedDraftId(isExpanded ? null : d.id)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-semibold text-gray-900 truncate">
                              {d.subject || 'Untitled Draft'}
                            </p>
                            {isTemplate ? (
                              <Badge className="bg-gray-100 text-gray-600 border border-gray-200 text-[10px] font-medium">
                                Template
                              </Badge>
                            ) : (
                              <Badge className="bg-indigo-50 text-indigo-600 border border-indigo-200 text-[10px] font-medium inline-flex items-center gap-0.5">
                                <Sparkles className="size-2.5" /> AI
                              </Badge>
                            )}
                            {isExpanded
                              ? <ChevronUp className="size-3.5 text-gray-400 shrink-0" />
                              : <ChevronDown className="size-3.5 text-gray-400 shrink-0" />
                            }
                          </div>
                          <p className={cn(
                            'text-sm text-gray-500 mt-1 leading-relaxed whitespace-pre-wrap',
                            isExpanded ? '' : 'line-clamp-2',
                          )}>
                            {d.body}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                          {d.matchScore != null && (
                            <span className={cn('text-xs font-semibold', matchScoreColor(d.matchScore))}>
                              Match {d.matchScore}%
                            </span>
                          )}
                          {d.confidenceScore != null && (
                            <span className="text-xs font-medium text-gray-400">
                              Conf {d.confidenceScore}%
                            </span>
                          )}
                          <span className={cn(
                            'inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium capitalize border',
                            draftStatusVariant(d.status),
                          )}>
                            {d.status}
                          </span>
                        </div>
                      </div>
                      {!isExpanded && (
                        <span className="text-[11px] text-gray-400 mt-2 block">
                          {formatDistanceToNow(new Date(d.createdAt), { addSuffix: true })}
                        </span>
                      )}
                    </button>

                    {/* Expanded actions */}
                    {isExpanded && (
                      <div className="flex items-center gap-2 px-5 pb-4 pt-0 border-t border-gray-50 mt-0 pt-3">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs border-gray-200 text-gray-600 rounded-md"
                          onClick={() => regenerateDraft.mutate()}
                          disabled={regenerateDraft.isPending}
                        >
                          {regenerateDraft.isPending
                            ? <Loader2 className="size-3 mr-1 animate-spin" />
                            : <RefreshCw className="size-3 mr-1" />
                          }
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
                        {d.status === 'draft' && (
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 rounded-md"
                              onClick={() => updateDraftStatus.mutate({ id: d.id, status: 'sent' })}
                              disabled={updateDraftStatus.isPending}
                            >
                              <CheckCircle2 className="size-3 mr-1" /> Mark Sent
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 rounded-md"
                              onClick={() => updateDraftStatus.mutate({ id: d.id, status: 'rejected' })}
                              disabled={updateDraftStatus.isPending}
                            >
                              <XCircle className="size-3 mr-1" /> Reject
                            </Button>
                          </div>
                        )}
                        <span className="text-[11px] text-gray-400 ml-auto">
                          {formatDistanceToNow(new Date(d.createdAt), { addSuffix: true })}
                        </span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </TabsContent>

        {/* ════════════ NOTES TAB ════════════ */}
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
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm text-gray-700 leading-relaxed flex-1">{n.body}</p>
                    <button
                      onClick={() => setDeleteNoteId(n.id)}
                      className="shrink-0 text-gray-300 hover:text-red-500 transition-colors p-0.5 rounded-md hover:bg-red-50"
                      title="Delete note"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
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

        {/* ════════════ ACTIVITY TAB ════════════ */}
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
      </Tabs>

      {/* ════════════ Delete Note Confirmation ════════════ */}
      <Dialog open={!!deleteNoteId} onOpenChange={(open) => { if (!open) setDeleteNoteId(null) }}>
        <DialogContent className="sm:max-w-sm rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-gray-900 flex items-center gap-2">
              <AlertTriangle className="size-4 text-red-500" /> Delete Note
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">
            Are you sure you want to delete this note? This action cannot be undone.
          </p>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setDeleteNoteId(null)}
              className="text-gray-600 border-gray-200 hover:bg-gray-50 hover:text-gray-900"
            >
              Cancel
            </Button>
            <Button
              onClick={() => deleteNoteMutation.mutate(deleteNoteId!)}
              disabled={deleteNoteMutation.isPending}
              className="bg-red-600 text-white hover:bg-red-700 press-scale"
            >
              {deleteNoteMutation.isPending ? <Loader2 className="size-3.5 mr-1.5 animate-spin" /> : null}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ════════════ Edit Contact Dialog ════════════ */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md bg-white rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-gray-900">Edit Contact</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Name *</Label>
              <Input
                value={editForm.name}
                onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Full name"
                className="border-gray-200 rounded-lg"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Email</Label>
              <Input
                type="email"
                value={editForm.email}
                onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))}
                placeholder="email@company.com"
                className="border-gray-200 rounded-lg font-mono"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Job Title</Label>
                <Input
                  value={editForm.jobTitle}
                  onChange={e => setEditForm(f => ({ ...f, jobTitle: e.target.value }))}
                  placeholder="e.g. VP Engineering"
                  className="border-gray-200 rounded-lg"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Role Bucket</Label>
                <Select value={editForm.roleBucket} onValueChange={v => setEditForm(f => ({ ...f, roleBucket: v }))}>
                  <SelectTrigger className="w-full border-gray-200 rounded-lg">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</Label>
                <Input
                  type="tel"
                  value={editForm.phone}
                  onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))}
                  placeholder="+1 (555) 000-0000"
                  className="border-gray-200 rounded-lg"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Location</Label>
                <Input
                  value={editForm.location}
                  onChange={e => setEditForm(f => ({ ...f, location: e.target.value }))}
                  placeholder="City, Country"
                  className="border-gray-200 rounded-lg"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-500 uppercase tracking-wider">LinkedIn URL</Label>
              <Input
                value={editForm.linkedinUrl}
                onChange={e => setEditForm(f => ({ ...f, linkedinUrl: e.target.value }))}
                placeholder="https://linkedin.com/in/..."
                className="border-gray-200 rounded-lg"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setEditOpen(false)}
              className="text-gray-600 border-gray-200 hover:bg-gray-50 hover:text-gray-900"
            >
              Cancel
            </Button>
            <Button
              onClick={() => editContact.mutate(editForm)}
              disabled={!editForm.name.trim() || editContact.isPending}
              className="bg-amber-600 hover:bg-amber-700 text-white press-scale"
            >
              {editContact.isPending ? <Loader2 className="size-3.5 mr-1.5 animate-spin" /> : null}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ════════════ Add Note Dialog ════════════ */}
      <Dialog open={noteOpen} onOpenChange={setNoteOpen}>
        <DialogContent className="sm:max-w-md bg-white rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-gray-900">Add Note</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Type</Label>
              <Select value={noteType} onValueChange={setNoteType}>
                <SelectTrigger className="w-full border-gray-200 rounded-lg">
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
                className="resize-none border-gray-200 rounded-lg"
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
              className="bg-amber-600 hover:bg-amber-700 text-white press-scale"
            >
              {addNote.isPending ? <Loader2 className="size-3.5 mr-1.5 animate-spin" /> : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}