'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, Building2, Globe, MapPin, Users, Plus, Target, StickyNote, FileText,
  Sparkles, Mail, Phone, ExternalLink, Linkedin, DollarSign, Calendar,
  CheckCircle2, XCircle, Clock, BarChart3, Loader2, X, AlertTriangle,
} from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { formatDistanceToNow } from 'date-fns'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ScoreGauge, getActivityIcon, StatusDot, EmptyState } from '@/components/shared/design-system'
import Image from 'next/image'

const healthVariant = (h: string) =>
  h === 'valid' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
  : h === 'risky' ? 'bg-amber-50 text-amber-700 border border-amber-200'
  : h === 'invalid' ? 'bg-red-50 text-red-700 border border-red-200'
  : 'bg-gray-100 text-gray-600 border border-gray-200'

const statusBorder = (s: string) =>
  s === 'open' ? 'border-l-blue-500' : s === 'won' ? 'border-l-emerald-500' : s === 'lost' ? 'border-l-red-400' : 'border-l-gray-300'

const statusBg = (s: string) =>
  s === 'open' ? 'bg-blue-50 text-blue-700 border-blue-200' : s === 'won' ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
  : s === 'lost' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-gray-100 text-gray-600 border-gray-200'

const RESEARCH_LABELS: Record<string, { label: string; icon: React.ElementType }> = {
  businessOverview: { label: 'Business Overview', icon: Building2 },
  currentTechLandscape: { label: 'Tech Landscape', icon: BarChart3 },
  potentialChallenges: { label: 'Challenges', icon: Target },
  possibleOpportunities: { label: 'Opportunities', icon: Sparkles },
  relevantServices: { label: 'Relevant Services', icon: FileText },
  keyDecisionMakers: { label: 'Decision Makers', icon: Users },
  lastInteraction: { label: 'Last Interaction', icon: Clock },
  nextAction: { label: 'Next Action', icon: ArrowLeft },
}

const researchColors = [
  'bg-blue-50 border-blue-100', 'bg-violet-50 border-violet-100', 'bg-amber-50 border-amber-100',
  'bg-emerald-50 border-emerald-100', 'bg-rose-50 border-rose-100', 'bg-indigo-50 border-indigo-100',
  'bg-cyan-50 border-cyan-100', 'bg-orange-50 border-orange-100',
]

const STATUS_CYCLE = ['new', 'researching', 'contacted', 'qualified', 'ready', 'archived'] as const
const OPP_STATUS_CYCLE = ['researching', 'contacted', 'qualified', 'ready', 'won', 'lost'] as const

const ROLE_BUCKETS = ['Executive', 'Manager', 'Technical', 'Operations', 'Sales', 'Other'] as const
const OPP_STATUSES = ['researching', 'contacted', 'proposed', 'negotiation', 'won', 'lost'] as const

const oppStatusVariant = (s: string) => {
  switch (s) {
    case 'researching': return 'bg-blue-50 text-blue-700 border-blue-200'
    case 'contacted': return 'bg-violet-50 text-violet-700 border-violet-200'
    case 'qualified': return 'bg-amber-50 text-amber-700 border-amber-200'
    case 'ready': return 'bg-cyan-50 text-cyan-700 border-cyan-200'
    case 'won': return 'bg-emerald-50 text-emerald-700 border-emerald-200'
    case 'lost': return 'bg-red-50 text-red-700 border-red-200'
    default: return 'bg-gray-100 text-gray-600 border-gray-200'
  }
}

export default function CompanyProfileScreen() {
  const { selectedCompanyId, setActiveView } = useAppStore()
  const qc = useQueryClient()

  // Note dialog state
  const [noteOpen, setNoteOpen] = useState(false)
  const [noteBody, setNoteBody] = useState('')
  const [noteType, setNoteType] = useState('')

  // Delete note confirmation state
  const [deleteNoteId, setDeleteNoteId] = useState<string | null>(null)

  // Contact dialog state
  const [contactOpen, setContactOpen] = useState(false)
  const [contactForm, setContactForm] = useState({
    name: '',
    email: '',
    jobTitle: '',
    roleBucket: '',
    phone: '',
    linkedinUrl: '',
  })

  // Opportunity dialog state
  const [oppOpen, setOppOpen] = useState(false)
  const [oppForm, setOppForm] = useState({
    title: '',
    description: '',
    status: 'researching',
    nextAction: '',
  })

  const { data, isLoading } = useQuery({
    queryKey: ['company', selectedCompanyId],
    queryFn: () => fetch(`/api/companies/${selectedCompanyId}`).then(r => r.json()),
    enabled: !!selectedCompanyId,
  })

  // ── Add Note mutation (existing) ──
  const addNote = useMutation({
    mutationFn: (body: { body: string; noteType: string }) =>
      fetch('/api/notes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, companyId: selectedCompanyId }) }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['company'] }); setNoteOpen(false); setNoteBody(''); setNoteType(''); toast.success('Note added') },
    onError: () => toast.error('Failed to add note'),
  })

  // ── Generate Research mutation (AI-powered) ──
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
      const result = await res.json()
      if (result._usedLlm === false) {
        toast.info('Generated with templates — configure AI key in Settings for AI-powered research')
      }
      return result
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['company'] })
      toast.success('Research generated successfully')
    },
    onError: (err) => toast.error(err.message || 'Failed to generate research'),
  })

  // ── Add Contact mutation ──
  const addContact = useMutation({
    mutationFn: (form: { name: string; email: string; jobTitle: string; roleBucket: string; phone: string; linkedinUrl: string }) =>
      fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, companyId: selectedCompanyId }),
      }).then(r => {
        if (!r.ok) return r.json().then(e => { throw new Error(e.error || 'Failed to add contact') })
        return r.json()
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['company'] })
      setContactOpen(false)
      setContactForm({ name: '', email: '', jobTitle: '', roleBucket: '', phone: '', linkedinUrl: '' })
      toast.success('Contact added successfully')
    },
    onError: (err) => toast.error(err.message || 'Failed to add contact'),
  })

  // ── Add Opportunity mutation ──
  const addOpportunity = useMutation({
    mutationFn: (form: { title: string; description: string; status: string; nextAction: string }) =>
      fetch('/api/opportunities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId: selectedCompanyId, ...form }),
      }).then(r => {
        if (!r.ok) return r.json().then(e => { throw new Error(e.error || 'Failed to add opportunity') })
        return r.json()
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['company'] })
      setOppOpen(false)
      setOppForm({ title: '', description: '', status: 'researching', nextAction: '' })
      toast.success('Opportunity created successfully')
    },
    onError: (err) => toast.error(err.message || 'Failed to add opportunity'),
  })

  // ── Update Opportunity Status mutation ──
  const updateOppMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      fetch(`/api/opportunities`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status }) }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['company', selectedCompanyId] }); toast.success('Opportunity updated') },
    onError: () => toast.error('Failed to update opportunity'),
  })

  // ── Delete Note mutation ──
  const deleteNoteMutation = useMutation({
    mutationFn: (noteId: string) =>
      fetch(`/api/notes?id=${noteId}&type=company`, { method: 'DELETE' }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['company', selectedCompanyId] }); setDeleteNoteId(null); toast.success('Note deleted') },
    onError: () => toast.error('Failed to delete note'),
  })

  // ── Opportunity status cycle handler ──
  const handleOppStatusCycle = (oppId: string, currentStatus: string) => {
    const currentIdx = OPP_STATUS_CYCLE.indexOf(currentStatus as typeof OPP_STATUS_CYCLE[number])
    const nextIdx = (currentIdx + 1) % OPP_STATUS_CYCLE.length
    updateOppMutation.mutate({ id: oppId, status: OPP_STATUS_CYCLE[nextIdx] })
  }

  // ── Update Company Status mutation ──
  const updateCompanyStatus = useMutation({
    mutationFn: async (newStatus: string) => {
      const res = await fetch(`/api/companies/${selectedCompanyId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) throw new Error('Failed to update status')

      // Also create a timeline entry
      await fetch('/api/timeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId: selectedCompanyId,
          action: 'status_changed',
          details: `Company status changed from "${data.status}" to "${newStatus}"`,
        }),
      })

      return res.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['company'] })
      toast.success('Status updated')
    },
    onError: () => toast.error('Failed to update status'),
  })

  // ── Status cycle handler ──
  const handleStatusCycle = () => {
    const current = data.status as string
    const currentIdx = STATUS_CYCLE.indexOf(current as typeof STATUS_CYCLE[number])
    const nextIdx = (currentIdx + 1) % STATUS_CYCLE.length
    const newStatus = STATUS_CYCLE[nextIdx]
    updateCompanyStatus.mutate(newStatus)
  }

  // ── Generate Email handler ──
  const handleGenerateEmail = () => {
    if (contacts.length === 0) {
      toast.error('Add contacts first to generate emails')
      return
    }
    const firstContactId = contacts[0].id
    useAppStore.getState().setSelectedContactId(firstContactId)
    setActiveView('email-generation')
  }

  // ── Contact form submit ──
  const handleContactSubmit = () => {
    if (!contactForm.name.trim()) return
    addContact.mutate(contactForm)
  }

  // ── Opportunity form submit ──
  const handleOppSubmit = () => {
    if (!oppForm.title.trim()) return
    addOpportunity.mutate(oppForm)
  }

  if (!selectedCompanyId) return <EmptyState icon={Globe} title="No company selected" description="Go back to Companies and select one." actionLabel="Back to Companies" onAction={() => setActiveView('companies')} />
  if (isLoading) return <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-32" /><Skeleton className="h-64" /></div>
  if (!data) return <EmptyState icon={Globe} title="Company not found" description="This company may have been deleted." actionLabel="Back to Companies" onAction={() => setActiveView('companies')} />

  const { contacts = [], notes = [], researchCard, opportunities = [], timeline = [] } = data

  const score = data.intelligenceScore ?? 0
  const segments = [
    { label: 'Data Completeness', value: Math.min(100, Math.round((score * 0.4) + 20)), color: '#2563EB' },
    { label: 'Contact Quality', value: Math.min(100, Math.round((score * 0.35) + 15)), color: '#059669' },
    { label: 'Research Depth', value: researchCard ? Math.min(100, Math.round((score * 0.25) + 10)) : 0, color: '#D97706' },
  ]

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="rounded-xl bg-white p-4 md:p-6 card-rest slide-up">
        <div className="flex items-start gap-4 md:gap-5">
          {/* Logo */}
          <div className="size-14 rounded-xl bg-gray-100 overflow-hidden shrink-0 flex items-center justify-center">
            {data.domain ? (
              <Image src={`https://logo.clearbit.com/${data.domain}`} alt="" width={56} height={56} className="size-14 object-contain p-2" onError={e => { (e.target as HTMLImageElement).style.display='none'; (e.target as HTMLImageElement).parentElement!.innerHTML=`<span class="text-xl font-bold text-gray-400">${data.name?.charAt(0)}</span>` }} />
            ) : (
              <span className="text-xl font-bold text-gray-400">{data.name?.charAt(0)}</span>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={() => setActiveView('companies')} className="text-gray-400 hover:text-gray-700 transition-colors">
                <ArrowLeft className="size-4" />
              </button>
              <h2 className="text-xl font-bold text-gray-900 tracking-tight truncate">{data.name}</h2>
              {data.industry && <Badge className="bg-gray-100 text-gray-600 hover:bg-gray-100 text-xs font-normal border-0">{data.industry}</Badge>}
              <button onClick={handleStatusCycle} disabled={updateCompanyStatus.isPending}
                className={`text-[11px] font-medium px-2 py-0.5 rounded-md border ${statusBg(data.status)} ${updateCompanyStatus.isPending ? 'opacity-50 cursor-not-allowed' : ''}`}>
                {updateCompanyStatus.isPending ? <Loader2 className="size-3 animate-spin inline" /> : null}
                {data.status}
              </button>
            </div>
            <div className="flex items-center gap-4 mt-2 text-sm text-gray-500 flex-wrap">
              {data.domain && <span className="flex items-center gap-1"><Globe className="size-3.5" />{data.domain}</span>}
              {data.country && <span className="flex items-center gap-1"><MapPin className="size-3.5" />{data.country}</span>}
              {data.employeeSize && <span>{data.employeeSize} employees</span>}
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2 mt-4 flex-wrap">
              <Button data-action="generate-research" size="sm" className="h-8 text-xs bg-amber-600 hover:bg-amber-700 text-white rounded-lg press-scale shadow-xs" onClick={() => generateResearch.mutate()} disabled={generateResearch.isPending}>
                {generateResearch.isPending ? <Loader2 className="size-3.5 mr-1.5 animate-spin" /> : <Sparkles className="size-3.5 mr-1.5" />}
                {generateResearch.isPending ? 'Generating...' : 'Generate Research'}
              </Button>
              <Button size="sm" variant="outline" className="h-8 text-xs border-gray-200 text-gray-600 rounded-lg" onClick={() => setNoteOpen(true)}>
                <Plus className="size-3.5 mr-1.5" /> Add Note
              </Button>
              <Button size="sm" variant="outline" className="h-8 text-xs border-gray-200 text-gray-600 rounded-lg" onClick={() => setContactOpen(true)}>
                <Plus className="size-3.5 sm:mr-1.5" /> <span className="hidden sm:inline">Add Contact</span>
              </Button>
              <Button size="sm" variant="outline" className="h-8 text-xs border-gray-200 text-gray-600 rounded-lg" onClick={handleGenerateEmail}>
                <Mail className="size-3.5 mr-1.5" /> Generate Email
              </Button>
            </div>
          </div>

          {/* Score Gauge */}
          <div className="hidden md:block">
            <ScoreGauge score={score} size={100} strokeWidth={8} segments={segments} />
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <Tabs defaultValue="overview">
        <TabsList className="bg-gray-100 rounded-lg p-1 h-auto gap-0.5 overflow-x-auto">
          {['overview', 'contacts', 'opportunities', 'timeline', 'notes'].map(tab => (
            <TabsTrigger key={tab} value={tab}
              className="rounded-md text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-gray-900 data-[state=active]:font-medium text-gray-500 hover:text-gray-700 transition-colors px-3 py-1.5">
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
              {tab === 'contacts' && contacts.length > 0 && <span className="ml-1.5 text-[10px] bg-gray-200 text-gray-600 px-1.5 rounded-full">{contacts.length}</span>}
              {tab === 'opportunities' && opportunities.length > 0 && <span className="ml-1.5 text-[10px] bg-gray-200 text-gray-600 px-1.5 rounded-full">{opportunities.length}</span>}
              {tab === 'notes' && notes.length > 0 && <span className="ml-1.5 text-[10px] bg-gray-200 text-gray-600 px-1.5 rounded-full">{notes.length}</span>}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview" className="space-y-6 mt-5">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {([
              ['Website', data.website, Globe], ['Industry', data.industry, BarChart3], ['Employees', data.employeeSize, Users],
              ['Location', data.location ?? data.country, MapPin], ['Status', data.status, CheckCircle2], ['Freshness', data.dataFreshness, Clock],
            ] as const).map(([label, val, Icon]) => (
              <div key={label} className="rounded-lg bg-white p-4 card-rest">
                <div className="flex items-center gap-2 mb-1">
                  <Icon className="size-3.5 text-gray-400" />
                  <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">{label}</p>
                </div>
                <p className="text-sm font-semibold text-gray-900 capitalize">{val || '—'}</p>
              </div>
            ))}
          </div>

          {/* Research Card */}
          <div className="rounded-xl bg-white card-rest overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <FileText className="size-4 text-gray-400" /> AI Research Card
              </h3>
              {!researchCard && (
                <Button size="sm" className="h-7 text-xs bg-gray-900 text-white hover:bg-gray-800 rounded-md press-scale" onClick={() => generateResearch.mutate()} disabled={generateResearch.isPending}>
                  {generateResearch.isPending ? <Loader2 className="size-3 mr-1 animate-spin" /> : <Sparkles className="size-3 mr-1" />}
                  {generateResearch.isPending ? 'Generating...' : 'Generate'}
                </Button>
              )}
            </div>
            <div className="p-6">
              {researchCard ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {(Object.entries(RESEARCH_LABELS) as [keyof typeof researchCard, typeof RESEARCH_LABELS[string]][]).map(([key, cfg], idx) =>
                    researchCard[key] ? (
                      <div key={key} className={`rounded-lg border p-4 ${researchColors[idx % researchColors.length]} slide-up`} style={{ animationDelay: `${idx * 50}ms` }}>
                        <div className="flex items-center gap-2 mb-2">
                          <cfg.icon className="size-3.5 text-gray-500" />
                          <p className="text-xs font-semibold text-gray-700 uppercase tracking-wider">{cfg.label}</p>
                        </div>
                        <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{researchCard[key]}</p>
                      </div>
                    ) : null,
                  )}
                </div>
              ) : (
                <EmptyState
                  icon={FileText}
                  title="No research generated yet"
                  description="Click Generate to create an AI-powered research card with business overview, tech landscape, challenges, and opportunities."
                  className="py-10"
                />
              )}
            </div>
          </div>
        </TabsContent>

        {/* Contacts */}
        <TabsContent value="contacts" className="mt-5">
          {contacts.length === 0 ? (
            <EmptyState icon={Users} title="No contacts found" description="Add contacts to this company to start tracking outreach." actionLabel="Add Contact" onAction={() => setContactOpen(true)} />
          ) : (
            <div className="rounded-xl bg-white card-rest overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="border-gray-100 hover:bg-transparent">
                    <TableHead className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Name</TableHead>
                    <TableHead className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Title</TableHead>
                    <TableHead className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Email</TableHead>
                    <TableHead className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Health</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contacts.map((c: any) => (
                    <TableRow key={c.id} className="table-row-hover border-gray-50 cursor-pointer" onClick={() => { useAppStore.getState().setSelectedContactId(c.id); setActiveView('contact-profile') }}>
                      <TableCell className="font-medium text-gray-900 text-sm">{c.name}</TableCell>
                      <TableCell className="text-sm text-gray-500">{c.jobTitle || '—'}</TableCell>
                      <TableCell className="text-sm text-gray-500 font-mono">{c.email || '—'}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium ${healthVariant(c.emailHealth)}`}>{c.emailHealth || 'unknown'}</span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* Opportunities */}
        <TabsContent value="opportunities" className="mt-5">
          {opportunities.length === 0 ? (
            <EmptyState icon={Target} title="No opportunities yet" description="Create opportunities to track potential deals with this company." actionLabel="Add Opportunity" onAction={() => setOppOpen(true)} />
          ) : (
            <div className="grid gap-3">
              {opportunities.map((o: any) => (
                <div key={o.id} className={`rounded-xl bg-white card-rest border-l-[3px] ${statusBorder(o.status)} p-5 flex items-start justify-between gap-4`}>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900">{o.title}</p>
                    {o.description && <p className="text-sm text-gray-500 mt-1 line-clamp-2">{o.description}</p>}
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                      {o.value && <span className="flex items-center gap-1"><DollarSign className="size-3" />{o.value}</span>}
                      {o.closeDate && <span className="flex items-center gap-1"><Calendar className="size-3" />{o.closeDate}</span>}
                    </div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleOppStatusCycle(o.id, o.status) }}
                    disabled={updateOppMutation.isPending}
                    className={`shrink-0 inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium capitalize border transition-opacity hover:opacity-80 ${oppStatusVariant(o.status)} ${updateOppMutation.isPending ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                    title="Click to cycle status"
                  >
                    {updateOppMutation.isPending ? <Loader2 className="size-3 animate-spin inline mr-1" /> : null}
                    {o.status}
                  </button>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Timeline */}
        <TabsContent value="timeline" className="mt-5">
          {timeline.length === 0 ? (
            <EmptyState icon={Clock} title="No timeline entries" description="Activity will appear here as you interact with this company." />
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
                      <div className={`shrink-0 mt-0.5 rounded-lg p-1.5 ${iconData.bg}`}>
                        <Icon className={`size-3.5 ${iconData.color}`} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 capitalize">{t.action.replace(/_/g, ' ')}</p>
                        {t.details && <p className="text-sm text-gray-500 mt-0.5">{t.details}</p>}
                        <p className="text-[11px] text-gray-400 mt-1">{formatDistanceToNow(new Date(t.createdAt), { addSuffix: true })}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </TabsContent>

        {/* Notes */}
        <TabsContent value="notes" className="mt-5">
          <div className="flex justify-end mb-4">
            <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white rounded-lg press-scale" onClick={() => setNoteOpen(true)}>
              <Plus className="size-3.5 mr-1.5" /> Add Note
            </Button>
          </div>
          {notes.length === 0 ? (
            <EmptyState icon={StickyNote} title="No notes yet" description="Add notes to track conversations, insights, and action items." actionLabel="Add Note" onAction={() => setNoteOpen(true)} />
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
                    {n.noteType && <Badge className="bg-gray-100 text-gray-600 hover:bg-gray-100 text-[11px] font-normal border-0 capitalize">{n.noteType}</Badge>}
                    <span className="text-[11px] text-gray-400">{formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ── Delete Note Confirmation Dialog ── */}
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

      {/* ── Add Note Dialog (existing) ── */}
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
            <Button onClick={() => addNote.mutate({ body: noteBody, noteType: noteType })} disabled={!noteBody.trim() || addNote.isPending} className="bg-gray-900 text-white hover:bg-gray-800 press-scale">Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Add Contact Dialog ── */}
      <Dialog open={contactOpen} onOpenChange={setContactOpen}>
        <DialogContent className="sm:max-w-md rounded-xl">
          <DialogHeader><DialogTitle className="text-gray-900">Add Contact</DialogTitle></DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Name *</Label>
              <Input value={contactForm.name} onChange={e => setContactForm(f => ({ ...f, name: e.target.value }))} placeholder="Full name" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Email</Label>
              <Input type="email" value={contactForm.email} onChange={e => setContactForm(f => ({ ...f, email: e.target.value }))} placeholder="email@company.com" />
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
            <Button onClick={handleContactSubmit} disabled={!contactForm.name.trim() || addContact.isPending} className="bg-gray-900 text-white hover:bg-gray-800 press-scale">
              {addContact.isPending ? <Loader2 className="size-3.5 mr-1.5 animate-spin" /> : null}
              Add Contact
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Add Opportunity Dialog ── */}
      <Dialog open={oppOpen} onOpenChange={setOppOpen}>
        <DialogContent className="sm:max-w-md rounded-xl">
          <DialogHeader><DialogTitle className="text-gray-900">Add Opportunity</DialogTitle></DialogHeader>
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
                <Label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Next Action</Label>
                <Input value={oppForm.nextAction} onChange={e => setOppForm(f => ({ ...f, nextAction: e.target.value }))} placeholder="What's next?" />
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setOppOpen(false)} className="text-gray-600 border-gray-200 hover:bg-gray-50 hover:text-gray-900">Cancel</Button>
            <Button onClick={handleOppSubmit} disabled={!oppForm.title.trim() || addOpportunity.isPending} className="bg-gray-900 text-white hover:bg-gray-800 press-scale">
              {addOpportunity.isPending ? <Loader2 className="size-3.5 mr-1.5 animate-spin" /> : null}
              Create Opportunity
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}