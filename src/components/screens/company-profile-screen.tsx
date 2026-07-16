'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, Building2, Globe, MapPin, Users, Plus, Target, StickyNote, FileText,
  Sparkles, Mail, Phone, ExternalLink, Linkedin, DollarSign, Calendar,
  CheckCircle2, Clock, BarChart3, Loader2, X, AlertTriangle, Trash2,
  ChevronRight, Cpu, Pencil,
} from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { formatDistanceToNow } from 'date-fns'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog'
import { ScoreGauge, getActivityIcon, StatusDot, EmptyState } from '@/components/shared/design-system'
import {
  getHealthVariant, getStatusBorder, getOppStatusVariant, getCompanyStatusVariant,
  DEFAULT_INDUSTRIES, EMPLOYEE_SIZES, ROLE_BUCKETS,
} from '@/lib/constants'
import { fetchApi } from '@/lib/fetchApi'
import Image from 'next/image'
import type { Company, Contact, Opportunity, CompanyNote, CompanyResearchCard, TimelineEntry, CompanyStatus } from '@/lib/types'

/* ═══════════════════════════════════════════════════════════════
   Constants & Helpers
   ═══════════════════════════════════════════════════════════════ */

const RESEARCH_LABELS: Record<string, { label: string; icon: React.ElementType }> = {
  businessOverview: { label: 'Business Overview', icon: Building2 },
  currentTechLandscape: { label: 'Tech Landscape', icon: BarChart3 },
  potentialChallenges: { label: 'Challenges', icon: Target },
  possibleOpportunities: { label: 'Opportunities', icon: Sparkles },
  relevantServices: { label: 'Relevant Services', icon: FileText },
  keyDecisionMakers: { label: 'Decision Makers', icon: Users },
  lastInteraction: { label: 'Last Interaction', icon: Clock },
  nextAction: { label: 'Next Action', icon: ChevronRight },
}

const researchColors = [
  'bg-blue-50 border-blue-100', 'bg-violet-50 border-violet-100', 'bg-amber-50 border-amber-100',
  'bg-emerald-50 border-emerald-100', 'bg-rose-50 border-rose-100', 'bg-indigo-50 border-indigo-100',
  'bg-cyan-50 border-cyan-100', 'bg-orange-50 border-orange-100',
]

const STATUS_CYCLE: readonly string[] = ['new', 'researching', 'contacted', 'qualified', 'ready', 'won', 'lost']
const OPP_STATUS_CYCLE = ['researching', 'contacted', 'qualified', 'proposed', 'negotiation', 'won', 'lost'] as const
const OPP_STATUSES = ['researching', 'contacted', 'proposed', 'negotiation', 'won', 'lost'] as const

const handleLogoError = (e: React.SyntheticEvent<HTMLImageElement>, name: string, sizeClass: string) => {
  const img = e.currentTarget
  const parent = img.parentElement
  if (parent) {
    parent.innerHTML = ''
    const span = document.createElement('span')
    span.className = `flex items-center justify-center ${sizeClass} rounded-lg bg-gray-100 text-gray-600 font-semibold`
    span.textContent = (name || '?').charAt(0).toUpperCase()
    parent.appendChild(span)
  }
}

/* ═══════════════════════════════════════════════════════════════
   Company Profile Screen
   ═══════════════════════════════════════════════════════════════ */

export default function CompanyProfileScreen() {
  const { selectedCompanyId, setSelectedContactId, setActiveView } = useAppStore()
  const qc = useQueryClient()

  // ── Dialog states ──
  const [noteOpen, setNoteOpen] = useState(false)
  const [noteBody, setNoteBody] = useState('')
  const [noteType, setNoteType] = useState('')
  const [deleteNoteId, setDeleteNoteId] = useState<string | null>(null)
  const [contactOpen, setContactOpen] = useState(false)
  const [contactForm, setContactForm] = useState({
    name: '', email: '', jobTitle: '', roleBucket: '', phone: '', linkedinUrl: '',
  })
  const [oppOpen, setOppOpen] = useState(false)
  const [oppForm, setOppForm] = useState({
    title: '', description: '', status: 'researching', nextAction: '', targetContactId: '',
  })
  const [statusConfirmOpen, setStatusConfirmOpen] = useState(false)
  const [editCompanyOpen, setEditCompanyOpen] = useState(false)
  const [editForm, setEditForm] = useState({
    name: '', domain: '', industry: '', website: '', linkedinUrl: '',
    employeeSize: '', country: '', location: '',
  })

  const openEditCompanyDialog = () => {
    if (data) {
      setEditForm({
        name: data.name || '',
        domain: data.domain || '',
        industry: data.industry || '',
        website: data.website || '',
        linkedinUrl: data.linkedinUrl || '',
        employeeSize: data.employeeSize || '',
        country: data.country || '',
        location: data.location || '',
      })
    }
    setEditCompanyOpen(true)
  }
  const [emailContactId, setEmailContactId] = useState('')

  // ── Active tab ──
  const [activeTab, setActiveTab] = useState('overview')

  // ── Fetch company (includes contacts, notes, research, opportunities, timeline) ──
  const { data, isLoading, error } = useQuery({
    queryKey: ['company', selectedCompanyId],
    queryFn: () => fetch(`/api/companies/${selectedCompanyId}`).then(r => {
      if (!r.ok) throw new Error('Failed to load company')
      return r.json()
    }),
    enabled: !!selectedCompanyId,
  })

  // ── Fetch AI provider info for research tab ──
  const { data: prefs } = useQuery({
    queryKey: ['preferences'],
    queryFn: () => fetch('/api/preferences').then(r => {
      if (!r.ok) throw new Error('Failed to load preferences')
      return r.json()
    }),
    staleTime: 30_000,
  })

  // Default email contact: use emailContactId if set, otherwise fall back to first contact
  // (contacts is defined below in a query hook; this line is safe because it runs inside a callback that executes after render)
  const getResolvedEmailContactId = () => emailContactId || (contacts && contacts[0]?.id) || ''

  // ── Fetch industries for edit form ──
  const { data: meta } = useQuery({
    queryKey: ['companies-meta'],
    queryFn: () => fetch('/api/companies/meta').then(r => {
      if (!r.ok) throw new Error('Failed to load metadata')
      return r.json()
    }),
    enabled: editCompanyOpen,
  })

  const editIndustries = (() => {
    const api: string[] = meta?.industries || []
    return [...new Set([...DEFAULT_INDUSTRIES, ...api])].sort((a, b) => a.localeCompare(b))
  })()

  // ── Mutations ──

  const addNote = useMutation({
    mutationFn: (body: { body: string; noteType: string }) =>
      fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, companyId: selectedCompanyId }),
      }).then(r => { if (!r.ok) throw new Error('Request failed'); return r.json() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['company', selectedCompanyId] })
      qc.invalidateQueries({ queryKey: ['company'] })
      setNoteOpen(false); setNoteBody(''); setNoteType('')
      toast.success('Note added')
    },
    onError: () => toast.error('Failed to add note'),
  })

  const generateResearch = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId: selectedCompanyId, action: 'generate' }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to generate research' }))
        throw new Error(err.error || 'Failed to generate research')
      }
      return res.json()
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['company', selectedCompanyId] })
      qc.invalidateQueries({ queryKey: ['company-breadcrumb', selectedCompanyId] })
      if (result._usedLlm === false) {
        toast.info('Generated with templates — configure AI key in Settings for AI-powered research')
      } else {
        toast.success('AI research generated successfully')
      }
    },
    onError: (err) => toast.error(err.message || 'Failed to generate research'),
  })

  const addContact = useMutation({
    mutationFn: (form: { name: string; email: string; jobTitle: string; roleBucket: string; phone: string; linkedinUrl: string }) =>
      fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, companyId: selectedCompanyId }),
      }).then(r => { if (!r.ok) return r.json().then(e => { throw new Error(e.error || 'Failed to add contact') }); return r.json() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['company', selectedCompanyId] })
      setContactOpen(false)
      setContactForm({ name: '', email: '', jobTitle: '', roleBucket: '', phone: '', linkedinUrl: '' })
      toast.success('Contact added successfully')
    },
    onError: (err) => toast.error(err.message || 'Failed to add contact'),
  })

  const addOpportunity = useMutation({
    mutationFn: (form: { title: string; description: string; status: string; nextAction: string; targetContactId?: string }) =>
      fetch('/api/opportunities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId: selectedCompanyId, ...form }),
      }).then(r => { if (!r.ok) return r.json().then(e => { throw new Error(e.error || 'Failed to add opportunity') }); return r.json() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['company', selectedCompanyId] })
      setOppOpen(false)
      setOppForm({ title: '', description: '', status: 'researching', nextAction: '', targetContactId: '' })
      toast.success('Opportunity created successfully')
    },
    onError: (err) => toast.error(err.message || 'Failed to add opportunity'),
  })

  const updateOppMutation = useMutation({
    mutationFn: ({ id, status: newStatus }: { id: string; status: string }) =>
      fetch(`/api/opportunities/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: newStatus }) })
        .then(r => { if (!r.ok) throw new Error('Request failed'); return r.json() }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['company', selectedCompanyId] }); toast.success('Opportunity updated') },
    onError: () => toast.error('Failed to update opportunity'),
  })

  const deleteOppMutation = useMutation({
    mutationFn: (oppId: string) =>
      fetch(`/api/opportunities/${oppId}`, { method: 'DELETE' })
        .then(r => { if (!r.ok) throw new Error('Request failed'); return r.json() }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['company', selectedCompanyId] }); toast.success('Opportunity deleted') },
    onError: () => toast.error('Failed to delete opportunity'),
  })

  const deleteNoteMutation = useMutation({
    mutationFn: (noteId: string) =>
      fetch(`/api/notes?id=${noteId}`, { method: 'DELETE' })
        .then(r => { if (!r.ok) throw new Error('Request failed'); return r.json() }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['company', selectedCompanyId] }); setDeleteNoteId(null); toast.success('Note deleted') },
    onError: () => toast.error('Failed to delete note'),
  })

  const updateCompanyStatus = useMutation({
    mutationFn: async (newStatus: string) => {
      const res = await fetch(`/api/companies/${selectedCompanyId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to update status' }))
        throw new Error(err.error || 'Failed to update status')
      }
      return res.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['company', selectedCompanyId] })
      qc.invalidateQueries({ queryKey: ['company-breadcrumb', selectedCompanyId] })
      setStatusConfirmOpen(false)
      toast.success('Status updated')
    },
    onError: () => { setStatusConfirmOpen(false); toast.error('Failed to update status') },
  })

  const editCompanyMutation = useMutation({
    mutationFn: async (form: typeof editForm) => {
      const { error } = await fetchApi(`/api/companies/${selectedCompanyId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (error) throw new Error(error)
      return null
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['company', selectedCompanyId] })
      qc.invalidateQueries({ queryKey: ['company-breadcrumb', selectedCompanyId] })
      setEditCompanyOpen(false)
      toast.success('Company updated')
    },
    onError: (err) => toast.error(err.message || 'Failed to update company'),
  })

  // ── Handlers ──

  const handleOppStatusCycle = (oppId: string, currentStatus: string) => {
    const currentIdx = OPP_STATUS_CYCLE.indexOf(currentStatus as typeof OPP_STATUS_CYCLE[number])
    const nextIdx = (currentIdx + 1) % OPP_STATUS_CYCLE.length
    updateOppMutation.mutate({ id: oppId, status: OPP_STATUS_CYCLE[nextIdx] })
  }

  const getNextStatus = (): string | null => {
    if (!data) return null
    const current = data.status as string
    const currentIdx = STATUS_CYCLE.indexOf(current)
    const nextIdx = (currentIdx + 1) % STATUS_CYCLE.length
    return STATUS_CYCLE[nextIdx]
  }

  const handleStatusCycle = () => {
    const next = getNextStatus()
    if (next) {
      updateCompanyStatus.mutate(next)
    }
  }

  const handleGenerateEmail = (contactId: string) => {
    setSelectedContactId(contactId)
    setActiveView('email-generation')
  }

  const handleViewContact = (contactId: string) => {
    setSelectedContactId(contactId)
    setActiveView('contact-profile')
  }

  const handleViewAllContacts = () => {
    setActiveView('contacts')
  }

  const handleContactSubmit = () => {
    if (!contactForm.name.trim()) return
    addContact.mutate(contactForm)
  }

  const handleOppSubmit = () => {
    if (!oppForm.title.trim()) return
    addOpportunity.mutate(oppForm)
  }

  const handleEditCompanySubmit = () => {
    if (!editForm.name.trim()) return
    editCompanyMutation.mutate(editForm)
  }

  const handleBack = () => {
    setActiveView('companies')
  }

  // ── Guard states ──

  if (!selectedCompanyId) {
    return (
      <EmptyState
        icon={Globe}
        title="No company selected"
        description="Go back to Companies and select one."
        actionLabel="Back to Companies"
        onAction={() => setActiveView('companies')}
      />
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-40 w-full rounded-xl" />
        <div className="flex gap-2">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-9 w-24 rounded-lg" />)}
        </div>
        <Skeleton className="h-64 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Failed to load company. Please try again.
        </div>
        <Button variant="outline" onClick={handleBack} className="border-gray-200 text-gray-600 hover:bg-gray-50 rounded-lg">
          <ArrowLeft className="size-4 mr-1.5" /> Back to Companies
        </Button>
      </div>
    )
  }

  if (!data) {
    return (
      <EmptyState
        icon={Globe}
        title="Company not found"
        description="This company may have been deleted."
        actionLabel="Back to Companies"
        onAction={() => setActiveView('companies')}
      />
    )
  }

  const contacts: Contact[] = data.contacts || []
  const notes: CompanyNote[] = data.notes || []
  const researchCard: CompanyResearchCard | null = data.researchCard || null
  const opportunities: Opportunity[] = data.opportunities || []
  const timeline: TimelineEntry[] = data.timeline || []
  const score = data.intelligenceScore ?? 0

  const segments = [
    { label: 'Data Completeness', value: Math.min(100, Math.round((score * 0.4) + 20)), color: '#2563EB' },
    { label: 'Contact Quality', value: Math.min(100, Math.round((score * 0.35) + 15)), color: '#059669' },
    { label: 'Research Depth', value: researchCard ? Math.min(100, Math.round((score * 0.25) + 10)) : 0, color: '#D97706' },
  ]

  // Resolve target contact names for opportunities
  const contactMap: Record<string, string> = {}
  for (const c of contacts) { contactMap[c.id] = c.name }

  const aiProviderLabel = prefs?.aiProvider
    ? prefs.aiProvider.charAt(0).toUpperCase() + prefs.aiProvider.slice(1)
    : null
  const hasAiKey = !!prefs?.aiApiKey

  const nextStatus = getNextStatus()

  /* ═══════════════════════════════════════════════════════════════
     Render
     ═══════════════════════════════════════════════════════════════ */

  return (
    <div className="space-y-6">
      {/* ══════════════════════════════════════════════════════════
          HEADER — Back button, Company card, Score Gauge
          ══════════════════════════════════════════════════════════ */}
      <div className="rounded-xl bg-white p-4 md:p-6 card-rest slide-up">
        <div className="flex items-start gap-4 md:gap-5">
          {/* Company Logo */}
          <div className="size-14 rounded-xl bg-gray-100 overflow-hidden shrink-0 flex items-center justify-center border border-gray-200/60">
            {data.domain ? (
              <Image
                src={`https://logo.clearbit.com/${data.domain}`}
                alt=""
                width={56}
                height={56}
                className="size-14 object-contain p-2"
                onError={e => handleLogoError(e, data.name, 'size-14 text-xl')}
              />
            ) : (
              <span className="text-xl font-bold text-gray-600">{data.name?.charAt(0)}</span>
            )}
          </div>

          {/* Info Block */}
          <div className="flex-1 min-w-0">
            {/* Back button + Company Name */}
            <div className="flex items-center gap-2.5 flex-wrap">
              <button
                onClick={handleBack}
                className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors group rounded-md px-1.5 py-0.5 -ml-1.5 hover:bg-gray-100"
              >
                <ArrowLeft className="size-4 group-hover:-translate-x-0.5 transition-transform" />
                <span className="hidden sm:inline">Back</span>
              </button>
              <span className="text-gray-700">/</span>
              <h2 className="text-xl font-bold text-gray-900 tracking-tight truncate">{data.name}</h2>
              {data.industry && (
                <Badge className="bg-gray-100 text-gray-600 hover:bg-gray-100 text-xs font-normal border-0 rounded-md">
                  {data.industry}
                </Badge>
              )}
              <button
                onClick={() => setStatusConfirmOpen(true)}
                disabled={updateCompanyStatus.isPending}
                className={`text-[11px] font-medium px-2 py-0.5 rounded-md border capitalize ${getCompanyStatusVariant(data.status)} ${updateCompanyStatus.isPending ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:opacity-80'} transition-opacity`}
                title="Click to change status"
              >
                {updateCompanyStatus.isPending ? <Loader2 className="size-3 animate-spin inline" /> : null}
                {data.status}
              </button>
            </div>

            {/* Metadata row */}
            <div className="flex items-center gap-x-5 gap-y-1.5 mt-2.5 text-sm text-gray-500 flex-wrap">
              {data.domain && (
                <span className="flex items-center gap-1.5">
                  <Globe className="size-3.5 text-gray-600" />
                  <a
                    href={`https://${data.domain}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-gray-900 transition-colors"
                    onClick={e => e.stopPropagation()}
                  >
                    {data.domain}
                  </a>
                </span>
              )}
              {data.location && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="size-3.5 text-gray-600" />
                  {data.location}
                </span>
              )}
              {data.country && data.location !== data.country && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="size-3.5 text-gray-600" />
                  {data.country}
                </span>
              )}
              {data.employeeSize && (
                <span className="flex items-center gap-1.5">
                  <Users className="size-3.5 text-gray-600" />
                  {data.employeeSize} employees
                </span>
              )}
              {data.website && (
                <a
                  href={data.website.startsWith('http') ? data.website : `https://${data.website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-amber-600 hover:text-amber-700 transition-colors"
                  onClick={e => e.stopPropagation()}
                >
                  <ExternalLink className="size-3.5" />Website
                </a>
              )}
              {data.linkedinUrl && (
                <a
                  href={data.linkedinUrl.startsWith('http') ? data.linkedinUrl : `https://${data.linkedinUrl}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-blue-600 hover:text-blue-700 transition-colors"
                  onClick={e => e.stopPropagation()}
                >
                  <Linkedin className="size-3.5" />LinkedIn
                </a>
              )}
              {data.dataFreshness && (
                <span className="flex items-center gap-1.5">
                  <StatusDot
                    status={data.dataFreshness === 'fresh' ? 'fresh' : data.dataFreshness === 'stale' ? 'stale' : data.dataFreshness === 'old' ? 'old' : 'unknown'}
                    pulse={data.dataFreshness === 'fresh'}
                  />
                  <span className="capitalize">{data.dataFreshness}</span>
                </span>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2 mt-4 flex-wrap">
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 hover:text-gray-900"
                onClick={() => setEditCompanyOpen(true)}
              >
                <Pencil className="size-3.5 mr-1.5" /> Edit Company
              </Button>
              <Button
                data-action="generate-research"
                size="sm"
                className="h-8 text-xs bg-amber-600 hover:bg-amber-700 text-white rounded-lg press-scale shadow-xs"
                onClick={() => generateResearch.mutate()}
                disabled={generateResearch.isPending}
              >
                {generateResearch.isPending
                  ? <Loader2 className="size-3.5 mr-1.5 animate-spin" />
                  : <Sparkles className="size-3.5 mr-1.5" />
                }
                {generateResearch.isPending ? 'Generating...' : 'Generate AI Research'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 hover:text-gray-900"
                onClick={() => setNoteOpen(true)}
              >
                <Plus className="size-3.5 mr-1.5" /> Add Note
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 hover:text-gray-900"
                onClick={() => setContactOpen(true)}
              >
                <Plus className="size-3.5 mr-1.5" /> Add Contact
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 hover:text-gray-900"
                onClick={() => setOppOpen(true)}
              >
                <Target className="size-3.5 mr-1.5" /> Add Opportunity
              </Button>
              {contacts.length > 0 && (
                <div className="flex items-center gap-2">
                  <Select value={getResolvedEmailContactId()} onValueChange={setEmailContactId}>
                    <SelectTrigger className="h-8 w-auto min-w-[140px] text-xs border-gray-200 rounded-lg">
                      <SelectValue placeholder="Select contact" />
                    </SelectTrigger>
                    <SelectContent>
                      {contacts.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}{c.jobTitle ? ` — ${c.jobTitle}` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs border-amber-200 text-amber-700 rounded-lg hover:bg-amber-50 hover:text-amber-800"
                    onClick={() => handleGenerateEmail(getResolvedEmailContactId())}
                    disabled={!getResolvedEmailContactId()}
                  >
                    <Mail className="size-3.5 mr-1.5" /> Generate Email
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Score Gauge — desktop only */}
          <div className="hidden lg:block shrink-0">
            <ScoreGauge
              score={score}
              size={108}
              strokeWidth={9}
              label="Intel Score"
              sublabel={researchCard ? 'Research complete' : 'Generate research'}
              segments={segments}
            />
          </div>
        </div>

        {/* Quick stats strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-5 border-t border-gray-100">
          <div className="flex items-center gap-3 rounded-lg bg-gray-50/80 p-3">
            <div className="flex size-9 rounded-lg bg-blue-50 items-center justify-center shrink-0">
              <Users className="size-4 text-blue-600" />
            </div>
            <div>
              <p className="text-lg font-semibold text-gray-900 tabular-nums">{contacts.length}</p>
              <p className="text-[11px] text-gray-500 uppercase tracking-wider font-medium">Contacts</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-lg bg-gray-50/80 p-3">
            <div className="flex size-9 rounded-lg bg-amber-50 items-center justify-center shrink-0">
              <Target className="size-4 text-amber-600" />
            </div>
            <div>
              <p className="text-lg font-semibold text-gray-900 tabular-nums">{opportunities.length}</p>
              <p className="text-[11px] text-gray-500 uppercase tracking-wider font-medium">Opportunities</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-lg bg-gray-50/80 p-3">
            <div className="flex size-9 rounded-lg bg-violet-50 items-center justify-center shrink-0">
              <StickyNote className="size-4 text-violet-600" />
            </div>
            <div>
              <p className="text-lg font-semibold text-gray-900 tabular-nums">{notes.length}</p>
              <p className="text-[11px] text-gray-500 uppercase tracking-wider font-medium">Notes</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-lg bg-gray-50/80 p-3">
            <div className="flex size-9 rounded-lg bg-emerald-50 items-center justify-center shrink-0">
              {researchCard ? <CheckCircle2 className="size-4 text-emerald-600" /> : <FileText className="size-4 text-gray-600" />}
            </div>
            <div>
              <p className="text-lg font-semibold text-gray-900">
                {researchCard ? `${researchCard.confidenceScore || 0}%` : '—'}
              </p>
              <p className="text-[11px] text-gray-500 uppercase tracking-wider font-medium">Research</p>
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════
          TABS
          ══════════════════════════════════════════════════════════ */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-gray-100 rounded-lg p-1 h-auto gap-0.5 overflow-x-auto">
          {[
            { key: 'overview', label: 'Overview' },
            { key: 'contacts', label: 'Contacts', count: contacts.length },
            { key: 'research', label: 'Research' },
            { key: 'opportunities', label: 'Opportunities', count: opportunities.length },
            { key: 'notes', label: 'Notes', count: notes.length },
            { key: 'activity', label: 'Activity', count: timeline.length },
          ].map(tab => (
            <TabsTrigger
              key={tab.key}
              value={tab.key}
              className="rounded-md text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-gray-900 data-[state=active]:font-medium text-gray-500 hover:text-gray-800 transition-colors px-3 py-1.5"
            >
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className="ml-1.5 text-[10px] bg-gray-200 data-[state=active]:bg-amber-100 data-[state=active]:text-amber-700 text-gray-600 px-1.5 rounded-full tabular-nums font-medium">
                  {tab.count}
                </span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* ──────────────────────────────────────────────────────────
            TAB: OVERVIEW
            ────────────────────────────────────────────────────────── */}
        <TabsContent value="overview" className="space-y-6 mt-5">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 slide-up">
            {([
              ['Website', data.website, Globe],
              ['Industry', data.industry, BarChart3],
              ['Employees', data.employeeSize, Users],
              ['Location', data.location ?? data.country, MapPin],
              ['Status', data.status, CheckCircle2],
              ['Freshness', data.dataFreshness, Clock],
            ] as const).map(([label, val, Icon]) => (
              <div key={label} className="rounded-xl bg-white p-4 card-rest">
                <div className="flex items-center gap-2 mb-1.5">
                  <Icon className="size-3.5 text-gray-600" />
                  <p className="text-[11px] font-medium text-gray-600 uppercase tracking-wider">{label}</p>
                </div>
                <p className="text-sm font-semibold text-gray-900 capitalize">{val || '—'}</p>
              </div>
            ))}
          </div>

          {/* Contacts Quick View */}
          <div className="rounded-xl bg-white card-rest overflow-hidden slide-up" style={{ animationDelay: '50ms' }}>
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <Users className="size-4 text-gray-600" />
                Key Contacts
                <span className="text-xs font-normal text-gray-600">{contacts.length} total</span>
              </h3>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs text-amber-600 hover:text-amber-700 hover:bg-amber-50 rounded-md"
                  onClick={handleViewAllContacts}
                >
                  View All
                  <ChevronRight className="size-3 ml-0.5" />
                </Button>
                <Button
                  size="sm"
                  className="h-7 text-xs bg-amber-600 hover:bg-amber-700 text-white rounded-md press-scale shadow-xs"
                  onClick={() => setContactOpen(true)}
                >
                  <Plus className="size-3 mr-1" /> Add
                </Button>
              </div>
            </div>
            {contacts.length === 0 ? (
              <div className="px-6 py-8 text-center">
                <Users className="size-8 text-gray-700 mx-auto mb-2" />
                <p className="text-sm text-gray-500">No contacts yet</p>
                <Button size="sm" variant="outline" className="mt-3 h-7 text-xs rounded-md border-gray-200 text-gray-600" onClick={() => setContactOpen(true)}>
                  <Plus className="size-3 mr-1" /> Add your first contact
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {contacts.slice(0, 5).map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center gap-4 px-6 py-3 hover:bg-gray-50/80 transition-colors cursor-pointer group"
                    onClick={() => handleViewContact(c.id)}
                  >
                    <div className="flex size-9 rounded-full bg-gray-100 items-center justify-center shrink-0 text-xs font-semibold text-gray-600">
                      {c.name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 group-hover:text-amber-700 transition-colors truncate">
                        {c.name}
                        <ChevronRight className="size-3 inline ml-1 text-gray-700 group-hover:text-amber-500 transition-colors" />
                      </p>
                      <p className="text-xs text-gray-500 truncate">{c.jobTitle || 'No title'}</p>
                    </div>
                    <div className="hidden sm:flex items-center gap-3 shrink-0">
                      {c.email && (
                        <span className="text-xs text-gray-600 font-mono truncate max-w-[180px]">{c.email}</span>
                      )}
                      {c.emailHealth && (
                        <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-medium border ${getHealthVariant(c.emailHealth)}`}>
                          {c.emailHealth}
                        </span>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs text-gray-600 hover:text-amber-600 hover:bg-amber-50 rounded-md shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => { e.stopPropagation(); handleGenerateEmail(c.id) }}
                    >
                      <Mail className="size-3.5 mr-1" /> Email
                    </Button>
                  </div>
                ))}
                {contacts.length > 5 && (
                  <button
                    onClick={handleViewAllContacts}
                    className="w-full px-6 py-3 text-xs text-amber-600 hover:text-amber-700 hover:bg-amber-50/50 transition-colors font-medium text-center"
                  >
                    View all {contacts.length} contacts →
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Research Quick Preview */}
          {researchCard ? (
            <div className="rounded-xl bg-white card-rest overflow-hidden slide-up" style={{ animationDelay: '100ms' }}>
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                  <Sparkles className="size-4 text-amber-500" />
                  Research Summary
                  {researchCard.confidenceScore && (
                    <span className="text-[11px] font-medium text-gray-600">
                      {researchCard.confidenceScore}% confidence
                    </span>
                  )}
                </h3>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs text-amber-600 hover:text-amber-700 hover:bg-amber-50 rounded-md"
                  onClick={() => setActiveTab('research')}
                >
                  View Full Research
                  <ChevronRight className="size-3 ml-0.5" />
                </Button>
              </div>
              <div className="p-6">
                <div className="grid gap-4 md:grid-cols-2">
                  {(Object.entries(RESEARCH_LABELS) as [string, typeof RESEARCH_LABELS[string]][]).slice(0, 4).map(([key, cfg], idx) =>
                    (researchCard as unknown as Record<string, unknown>)[key] ? (
                      <div key={String(key)} className={`rounded-lg border p-4 ${researchColors[idx]} slide-up`} style={{ animationDelay: `${idx * 40}ms` }}>
                        <div className="flex items-center gap-2 mb-2">
                          <cfg.icon className="size-3.5 text-gray-500" />
                          <p className="text-xs font-semibold text-gray-800 uppercase tracking-wider">{cfg.label}</p>
                        </div>
                        <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap line-clamp-3">{String((researchCard as unknown as Record<string, unknown>)[key])}</p>
                      </div>
                    ) : null,
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl bg-gradient-to-br from-amber-50/80 to-orange-50/40 border border-amber-100/60 p-8 text-center slide-up" style={{ animationDelay: '100ms' }}>
              <div className="flex size-12 rounded-xl bg-amber-100 items-center justify-center mx-auto mb-3">
                <Sparkles className="size-6 text-amber-600" />
              </div>
              <h3 className="text-sm font-semibold text-gray-900 mb-1">No research generated yet</h3>
              <p className="text-sm text-gray-500 mb-4 max-w-md mx-auto">
                Generate an AI-powered research card with business overview, tech landscape, challenges, and opportunities.
              </p>
              <Button
                size="sm"
                className="bg-amber-600 hover:bg-amber-700 text-white rounded-lg press-scale shadow-xs"
                onClick={() => { generateResearch.mutate(); setActiveTab('research') }}
                disabled={generateResearch.isPending}
              >
                {generateResearch.isPending
                  ? <Loader2 className="size-3.5 mr-1.5 animate-spin" />
                  : <Sparkles className="size-3.5 mr-1.5" />
                }
                Generate AI Research
              </Button>
            </div>
          )}

          {/* Opportunities Quick View */}
          {opportunities.length > 0 && (
            <div className="rounded-xl bg-white card-rest overflow-hidden slide-up" style={{ animationDelay: '150ms' }}>
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                  <Target className="size-4 text-gray-600" />
                  Active Opportunities
                </h3>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs text-amber-600 hover:text-amber-700 hover:bg-amber-50 rounded-md"
                  onClick={() => setActiveTab('opportunities')}
                >
                  View All
                  <ChevronRight className="size-3 ml-0.5" />
                </Button>
              </div>
              <div className="divide-y divide-gray-50">
                {opportunities.slice(0, 3).map((o) => (
                  <div key={o.id} className="flex items-center gap-4 px-6 py-3">
                    <div className={`w-0.5 h-8 rounded-full shrink-0 ${
                      o.status === 'won' ? 'bg-emerald-500' : o.status === 'lost' ? 'bg-red-300' : 'bg-amber-400'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{o.title}</p>
                      {o.nextAction && <p className="text-xs text-gray-600 mt-0.5">Next: {o.nextAction}</p>}
                    </div>
                    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-medium capitalize border ${getOppStatusVariant(o.status)}`}>
                      {o.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        {/* ──────────────────────────────────────────────────────────
            TAB: CONTACTS
            ────────────────────────────────────────────────────────── */}
        <TabsContent value="contacts" className="mt-5">
          <div className="flex items-center justify-between mb-4 gap-2">
            <p className="text-sm text-gray-500">
              {contacts.length} contact{contacts.length !== 1 ? 's' : ''} at {data.name}
            </p>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs text-amber-600 hover:text-amber-700 hover:bg-amber-50 rounded-md transition-colors"
                onClick={handleViewAllContacts}
              >
                <Users className="size-3 mr-1" /> View All Contacts
                <ChevronRight className="size-3 ml-0.5" />
              </Button>
              <Button
                size="sm"
                className="bg-amber-600 hover:bg-amber-700 text-white rounded-lg press-scale shadow-xs"
                onClick={() => setContactOpen(true)}
              >
                <Plus className="size-3.5 mr-1.5" /> Add Contact
              </Button>
            </div>
          </div>
          {contacts.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No contacts found"
              description="Add contacts to this company to start tracking outreach and engagement."
              actionLabel="Add Contact"
              onAction={() => setContactOpen(true)}
            />
          ) : (
            <div className="rounded-xl bg-white card-rest overflow-hidden slide-up">
              <Table>
                <TableHeader>
                  <TableRow className="border-gray-100 hover:bg-transparent">
                    <TableHead className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Name</TableHead>
                    <TableHead className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Title</TableHead>
                    <TableHead className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">Email</TableHead>
                    <TableHead className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Health</TableHead>
                    <TableHead className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contacts.map((c) => (
                    <TableRow
                      key={c.id}
                      className="table-row-hover border-gray-50 cursor-pointer group"
                      onClick={() => handleViewContact(c.id)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="flex size-8 rounded-full bg-gray-100 items-center justify-center shrink-0 text-[11px] font-semibold text-gray-600">
                            {c.name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <span className="font-medium text-gray-900 text-sm group-hover:text-amber-700 transition-colors">{c.name}</span>
                            {c.roleBucket && (
                              <p className="text-[11px] text-gray-600 mt-0.5">{c.roleBucket}</p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-gray-500 hidden md:table-cell">{c.jobTitle || '—'}</TableCell>
                      <TableCell className="text-sm text-gray-500 font-mono hidden lg:table-cell">{c.email || '—'}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium border ${getHealthVariant(c.emailHealth)}`}>
                          {c.emailHealth || 'unknown'}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs text-gray-600 hover:text-amber-600 hover:bg-amber-50 rounded-md"
                          onClick={(e) => { e.stopPropagation(); handleGenerateEmail(c.id) }}
                        >
                          <Mail className="size-3.5 mr-1" /> Generate Email
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* ──────────────────────────────────────────────────────────
            TAB: RESEARCH
            ────────────────────────────────────────────────────────── */}
        <TabsContent value="research" className="mt-5">
          <div className="rounded-xl bg-white card-rest overflow-hidden slide-up">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                  <Sparkles className="size-4 text-amber-500" /> AI Research Card
                </h3>
                {/* AI Provider badge */}
                <Badge
                  variant="outline"
                  className={`text-[10px] font-medium rounded-full px-2 py-0.5 ${hasAiKey ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-gray-200 bg-gray-50 text-gray-500'}`}
                >
                  <Cpu className="size-2.5 mr-1" />
                  {hasAiKey ? `Powered by ${aiProviderLabel || 'AI'}` : 'Template-based (configure AI in Settings)'}
                </Badge>
              </div>
              <Button
                size="sm"
                className="h-7 text-xs bg-amber-600 hover:bg-amber-700 text-white rounded-md press-scale shadow-xs"
                onClick={() => generateResearch.mutate()}
                disabled={generateResearch.isPending}
              >
                {generateResearch.isPending
                  ? <Loader2 className="size-3 mr-1 animate-spin" />
                  : <Sparkles className="size-3 mr-1" />
                }
                {generateResearch.isPending ? 'Generating...' : researchCard ? 'Regenerate' : 'Generate AI Research'}
              </Button>
            </div>
            <div className="p-6">
              {researchCard ? (
                <div className="space-y-5">
                  {/* Confidence score bar */}
                  {researchCard.confidenceScore != null && (
                    <div className="flex items-center gap-4 p-4 rounded-lg bg-gray-50/80 border border-gray-100">
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Confidence Score</p>
                          <span className="text-sm font-bold text-gray-900 tabular-nums">{researchCard.confidenceScore}%</span>
                        </div>
                        <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-700 ease-out"
                            style={{
                              width: `${researchCard.confidenceScore}%`,
                              backgroundColor: researchCard.confidenceScore >= 75 ? '#059669' : researchCard.confidenceScore >= 50 ? '#D97706' : '#DC2626',
                            }}
                          />
                        </div>
                      </div>
                      {researchCard.lastResearchedAt && (
                        <div className="text-right shrink-0">
                          <p className="text-[11px] text-gray-600">Last researched</p>
                          <p className="text-xs font-medium text-gray-600">
                            {formatDistanceToNow(new Date(researchCard.lastResearchedAt), { addSuffix: true })}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Research sections grid */}
                  <div className="grid gap-4 md:grid-cols-2">
                    {(Object.entries(RESEARCH_LABELS) as [string, typeof RESEARCH_LABELS[string]][]).map(([key, cfg], idx) =>
                      (researchCard as unknown as Record<string, unknown>)[key] ? (
                        <div key={String(key)} className={`rounded-lg border p-4 ${researchColors[idx % researchColors.length]} slide-up`} style={{ animationDelay: `${idx * 50}ms` }}>
                          <div className="flex items-center gap-2 mb-2">
                            <cfg.icon className="size-3.5 text-gray-500" />
                            <p className="text-xs font-semibold text-gray-800 uppercase tracking-wider">{cfg.label}</p>
                          </div>
                          <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{String((researchCard as unknown as Record<string, unknown>)[key])}</p>
                        </div>
                      ) : null,
                    )}
                  </div>
                </div>
              ) : (
                <EmptyState
                  icon={FileText}
                  title="No research generated yet"
                  description="Click Generate AI Research to create an AI-powered research card with business overview, tech landscape, challenges, and opportunities."
                  actionLabel="Generate AI Research"
                  onAction={() => generateResearch.mutate()}
                  className="py-10"
                />
              )}
            </div>
          </div>
        </TabsContent>

        {/* ──────────────────────────────────────────────────────────
            TAB: OPPORTUNITIES
            ────────────────────────────────────────────────────────── */}
        <TabsContent value="opportunities" className="mt-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-gray-500">
              {opportunities.length} opportunit{opportunities.length !== 1 ? 'ies' : 'y'} for {data.name}
            </p>
            <Button
              size="sm"
              className="bg-amber-600 hover:bg-amber-700 text-white rounded-lg press-scale shadow-xs"
              onClick={() => setOppOpen(true)}
            >
              <Plus className="size-3.5 mr-1.5" /> Create Opportunity
            </Button>
          </div>
          {opportunities.length === 0 ? (
            <EmptyState
              icon={Target}
              title="No opportunities yet"
              description="Create opportunities to track potential deals and engagement with this company."
              actionLabel="Create Opportunity"
              onAction={() => setOppOpen(true)}
            />
          ) : (
            <div className="grid gap-3">
              {opportunities.map((o, idx) => (
                <div
                  key={o.id}
                  className={`rounded-xl bg-white card-interactive border-l-[3px] ${getStatusBorder(o.status)} p-5 flex items-start justify-between gap-4 slide-up`}
                  style={{ animationDelay: `${idx * 30}ms` }}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900">{o.title}</p>
                    {o.description && <p className="text-sm text-gray-500 mt-1 line-clamp-2">{o.description}</p>}
                    {o.nextAction && (
                      <p className="text-xs text-gray-600 mt-2 flex items-center gap-1">
                        <ChevronRight className="size-3 text-amber-600" />
                        {o.nextAction}
                      </p>
                    )}
                    {/* Target contact link */}
                    {o.targetContactId && contactMap[o.targetContactId] && (
                      <button
                        onClick={() => handleViewContact(o.targetContactId!)}
                        className="inline-flex items-center gap-1.5 mt-2 text-xs text-amber-600 hover:text-amber-700 transition-colors"
                      >
                        <Users className="size-3" />
                        {contactMap[o.targetContactId]}
                        <ChevronRight className="size-3" />
                      </button>
                    )}
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-600">
                      <span className="flex items-center gap-1">
                        <Calendar className="size-3" />
                        {formatDistanceToNow(new Date(o.createdAt), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleOppStatusCycle(o.id, o.status) }}
                      disabled={updateOppMutation.isPending}
                      className={`inline-flex items-center rounded-md px-2.5 py-1 text-[11px] font-medium capitalize border transition-all hover:opacity-80 ${getOppStatusVariant(o.status)} ${updateOppMutation.isPending ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                      title="Click to cycle status"
                    >
                      {updateOppMutation.isPending ? <Loader2 className="size-3 animate-spin inline mr-1" /> : null}
                      {o.status}
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteOppMutation.mutate(o.id) }}
                      disabled={deleteOppMutation.isPending}
                      className="text-gray-700 hover:text-red-500 transition-colors p-1 rounded-md hover:bg-red-50"
                      aria-label="Delete opportunity"
                      title="Delete opportunity"
                    >
                      {deleteOppMutation.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ──────────────────────────────────────────────────────────
            TAB: NOTES — Timeline style
            ────────────────────────────────────────────────────────── */}
        <TabsContent value="notes" className="mt-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-gray-500">
              {notes.length} note{notes.length !== 1 ? 's' : ''}
            </p>
            <Button
              size="sm"
              className="bg-amber-600 hover:bg-amber-700 text-white rounded-lg press-scale shadow-xs"
              onClick={() => setNoteOpen(true)}
            >
              <Plus className="size-3.5 mr-1.5" /> Add Note
            </Button>
          </div>
          {notes.length === 0 ? (
            <EmptyState
              icon={StickyNote}
              title="No notes yet"
              description="Add notes to track conversations, insights, and action items for this company."
              actionLabel="Add Note"
              onAction={() => setNoteOpen(true)}
            />
          ) : (
            <div className="relative pl-6">
              {/* Timeline connector line */}
              <div className="absolute left-[7px] top-2 bottom-2 border-l-2 border-gray-200" />
              <div className="space-y-4">
                {notes.map((n, idx) => (
                  <div
                    key={n.id}
                    className="relative flex items-start gap-4 slide-up"
                    style={{ animationDelay: `${idx * 30}ms` }}
                  >
                    {/* Timeline dot */}
                    <div className="absolute -left-6 top-2 size-3 rounded-full bg-white ring-4 ring-white border-2 border-amber-400" />
                    {/* Note card */}
                    <div className="flex-1 rounded-xl bg-white p-5 card-rest min-w-0">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap flex-1">{n.body}</p>
                        <button
                          onClick={() => setDeleteNoteId(n.id)}
                          className="shrink-0 text-gray-700 hover:text-red-500 transition-colors p-0.5 rounded-md hover:bg-red-50"
                          aria-label="Delete note"
                          title="Delete note"
                        >
                          <X className="size-3.5" />
                        </button>
                      </div>
                      <div className="flex items-center gap-2 mt-3">
                        {n.noteType && (
                          <Badge className="bg-gray-100 text-gray-600 hover:bg-gray-100 text-[11px] font-normal border-0 rounded-md capitalize">
                            {n.noteType}
                          </Badge>
                        )}
                        <span className="text-[11px] text-gray-600">
                          {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        {/* ──────────────────────────────────────────────────────────
            TAB: ACTIVITY — Timeline entries
            ────────────────────────────────────────────────────────── */}
        <TabsContent value="activity" className="mt-5">
          {timeline.length === 0 ? (
            <EmptyState
              icon={Clock}
              title="No activity yet"
              description="Activity will appear here as you interact with this company — adding contacts, generating research, and more."
            />
          ) : (
            <div className="relative pl-6">
              {/* Timeline connector */}
              <div className="absolute left-[7px] top-2 bottom-2 border-l-2 border-gray-200" />
              <div className="space-y-4">
                {timeline.map((t, idx) => {
                  const iconData = getActivityIcon(t.action)
                  const Icon = iconData.icon
                  return (
                    <div
                      key={t.id}
                      className="relative flex items-start gap-4 slide-up"
                      style={{ animationDelay: `${idx * 30}ms` }}
                    >
                      {/* Timeline dot */}
                      <div className="absolute -left-6 top-1.5 size-3 rounded-full bg-white ring-4 ring-white border-2 border-amber-400" />
                      {/* Activity icon */}
                      <div className={`shrink-0 mt-0.5 rounded-lg p-1.5 ${iconData.bg}`}>
                        <Icon className={`size-3.5 ${iconData.color}`} />
                      </div>
                      {/* Content */}
                      <div className="min-w-0 flex-1 rounded-lg bg-white p-4 card-rest">
                        <p className="text-sm font-medium text-gray-900 capitalize">
                          {t.action.replace(/_/g, ' ')}
                        </p>
                        {t.details && (
                          <p className="text-sm text-gray-500 mt-0.5">{t.details}</p>
                        )}
                        {/* Cross-nav: if activity references a contact, make it clickable */}
                        {t.contact && (
                          <button
                            onClick={() => handleViewContact(t.contact!.id)}
                            className="inline-flex items-center gap-1 mt-1.5 text-xs text-amber-600 hover:text-amber-700 transition-colors"
                          >
                            <Users className="size-3" />
                            {t.contact!.name}
                            <ChevronRight className="size-3" />
                          </button>
                        )}
                        <p className="text-[11px] text-gray-600 mt-1.5">
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

      {/* ══════════════════════════════════════════════════════════
          DIALOGS
          ══════════════════════════════════════════════════════════ */}

      {/* Status Cycle Confirmation (C2 fix) */}
      <AlertDialog open={statusConfirmOpen} onOpenChange={setStatusConfirmOpen}>
        <AlertDialogContent className="rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Change Company Status</AlertDialogTitle>
            <AlertDialogDescription>
              Change status from <span className="font-semibold text-gray-900 capitalize">{data.status}</span> to{' '}
              <span className="font-semibold text-gray-900 capitalize">{nextStatus}</span>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-lg" disabled={updateCompanyStatus.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-lg bg-amber-600 hover:bg-amber-700 text-white"
              onClick={handleStatusCycle}
              disabled={updateCompanyStatus.isPending}
            >
              {updateCompanyStatus.isPending ? <Loader2 className="size-4 mr-2 animate-spin" /> : null}
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Note Confirmation */}
      <Dialog open={!!deleteNoteId} onOpenChange={(open) => { if (!open) setDeleteNoteId(null) }}>
        <DialogContent className="sm:max-w-sm rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-gray-900 flex items-center gap-2">
              <AlertTriangle className="size-4 text-red-500" /> Delete Note
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">Are you sure you want to delete this note? This action cannot be undone.</p>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDeleteNoteId(null)} className="text-gray-600 border-gray-200 hover:bg-gray-50 hover:text-gray-900">Cancel</Button>
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

      {/* Add Note Dialog */}
      <Dialog open={noteOpen} onOpenChange={setNoteOpen}>
        <DialogContent className="sm:max-w-md rounded-xl">
          <DialogHeader><DialogTitle className="text-gray-900">Add Note</DialogTitle></DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Type</Label>
              <Select value={noteType} onValueChange={setNoteType}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Select type" /></SelectTrigger>
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
              <Textarea value={noteBody} onChange={e => setNoteBody(e.target.value)} rows={3} placeholder="Write your note..." className="resize-none" />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setNoteOpen(false)} className="text-gray-600 border-gray-200 hover:bg-gray-50 hover:text-gray-900">Cancel</Button>
            <Button onClick={() => addNote.mutate({ body: noteBody, noteType: noteType })} disabled={!noteBody.trim() || addNote.isPending} className="bg-amber-600 hover:bg-amber-700 text-white press-scale">Save Note</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Company Dialog (H7 fix) */}
      <Dialog open={editCompanyOpen} onOpenChange={setEditCompanyOpen}>
        <DialogContent className="sm:max-w-md rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-gray-900">Edit Company</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label className="text-sm font-medium text-gray-800">Name</Label>
              <Input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} placeholder="Company name" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label className="text-sm font-medium text-gray-800">Domain</Label>
                <Input value={editForm.domain} onChange={e => setEditForm(f => ({ ...f, domain: e.target.value }))} placeholder="example.com" />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-sm font-medium text-gray-800">Industry</Label>
                <Select value={editForm.industry} onValueChange={v => setEditForm(f => ({ ...f, industry: v }))}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {editIndustries.map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label className="text-sm font-medium text-gray-800">Website</Label>
                <Input value={editForm.website} onChange={e => setEditForm(f => ({ ...f, website: e.target.value }))} placeholder="https://..." />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-sm font-medium text-gray-800">LinkedIn</Label>
                <Input value={editForm.linkedinUrl} onChange={e => setEditForm(f => ({ ...f, linkedinUrl: e.target.value }))} placeholder="https://linkedin.com/..." />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label className="text-sm font-medium text-gray-800">Employee Size</Label>
                <Select value={editForm.employeeSize} onValueChange={v => setEditForm(f => ({ ...f, employeeSize: v }))}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {EMPLOYEE_SIZES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label className="text-sm font-medium text-gray-800">Country</Label>
                <Input value={editForm.country} onChange={e => setEditForm(f => ({ ...f, country: e.target.value }))} placeholder="USA" />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-sm font-medium text-gray-800">Location</Label>
              <Input value={editForm.location} onChange={e => setEditForm(f => ({ ...f, location: e.target.value }))} placeholder="San Francisco, CA" />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setEditCompanyOpen(false)} className="text-gray-600 border-gray-200 hover:bg-gray-50 hover:text-gray-900">Cancel</Button>
            <Button onClick={handleEditCompanySubmit} disabled={!editForm.name.trim() || editCompanyMutation.isPending} className="bg-amber-600 hover:bg-amber-700 text-white press-scale">
              {editCompanyMutation.isPending ? <Loader2 className="size-3.5 mr-1.5 animate-spin" /> : null}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Contact Dialog — pre-fills company */}
      <Dialog open={contactOpen} onOpenChange={setContactOpen}>
        <DialogContent className="sm:max-w-md rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-gray-900">Add Contact</DialogTitle>
            <p className="text-xs text-gray-500 mt-1">
              Adding to <span className="font-medium text-gray-800">{data.name}</span>
            </p>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Name *</Label>
              <Input value={contactForm.name} onChange={e => setContactForm(f => ({ ...f, name: e.target.value }))} placeholder="Full name" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Email</Label>
              <Input type="email" value={contactForm.email} onChange={e => setContactForm(f => ({ ...f, email: e.target.value }))} placeholder={`name@${data.domain || 'company.com'}`} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Job Title</Label>
                <Input value={contactForm.jobTitle} onChange={e => setContactForm(f => ({ ...f, jobTitle: e.target.value }))} placeholder="e.g. VP of Engineering" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Role Bucket</Label>
                <Select value={contactForm.roleBucket} onValueChange={v => setContactForm(f => ({ ...f, roleBucket: v }))}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Select role" /></SelectTrigger>
                  <SelectContent>
                    {ROLE_BUCKETS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</Label>
              <Input type="tel" value={contactForm.phone} onChange={e => setContactForm(f => ({ ...f, phone: e.target.value }))} placeholder="+1 (555) 000-0000" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-500 uppercase tracking-wider">LinkedIn URL</Label>
              <Input value={contactForm.linkedinUrl} onChange={e => setContactForm(f => ({ ...f, linkedinUrl: e.target.value }))} placeholder="https://linkedin.com/in/..." />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setContactOpen(false)} className="text-gray-600 border-gray-200 hover:bg-gray-50 hover:text-gray-900">Cancel</Button>
            <Button onClick={handleContactSubmit} disabled={!contactForm.name.trim() || addContact.isPending} className="bg-amber-600 hover:bg-amber-700 text-white press-scale">
              {addContact.isPending ? <Loader2 className="size-3.5 mr-1.5 animate-spin" /> : null}
              Add Contact
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Opportunity Dialog — can link to target contact */}
      <Dialog open={oppOpen} onOpenChange={setOppOpen}>
        <DialogContent className="sm:max-w-md rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-gray-900">Create Opportunity</DialogTitle>
            <p className="text-xs text-gray-500 mt-1">
              For <span className="font-medium text-gray-800">{data.name}</span>
            </p>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Title *</Label>
              <Input value={oppForm.title} onChange={e => setOppForm(f => ({ ...f, title: e.target.value }))} placeholder="Opportunity title" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Description</Label>
              <Textarea value={oppForm.description} onChange={e => setOppForm(f => ({ ...f, description: e.target.value }))} rows={3} placeholder="Describe the opportunity..." className="resize-none" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Status</Label>
                <Select value={oppForm.status} onValueChange={v => setOppForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Select status" /></SelectTrigger>
                  <SelectContent>
                    {OPP_STATUSES.map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Target Contact</Label>
                <Select
                  value={oppForm.targetContactId || ''}
                  onValueChange={v => setOppForm(f => ({ ...f, targetContactId: v === '__none__' ? '' : v }))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select contact (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">No contact</SelectItem>
                    {contacts.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}{c.jobTitle ? ` — ${c.jobTitle}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Next Action</Label>
              <Input value={oppForm.nextAction} onChange={e => setOppForm(f => ({ ...f, nextAction: e.target.value }))} placeholder="What's the next step?" />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setOppOpen(false)} className="text-gray-600 border-gray-200 hover:bg-gray-50 hover:text-gray-900">Cancel</Button>
            <Button onClick={handleOppSubmit} disabled={!oppForm.title.trim() || addOpportunity.isPending} className="bg-amber-600 hover:bg-amber-700 text-white press-scale">
              {addOpportunity.isPending ? <Loader2 className="size-3.5 mr-1.5 animate-spin" /> : null}
              Create Opportunity
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}