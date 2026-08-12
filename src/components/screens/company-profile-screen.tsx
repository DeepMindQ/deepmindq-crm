'use client'

import { useState, useCallback, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Globe, Brain, Shield, Keyboard, Loader2, Sparkles, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useAppStore } from '@/lib/store'
import { ScreenBreadcrumb } from '@/components/shared/screen-breadcrumb'
import { EmptyState } from '@/components/shared/design-system'
import { DEFAULT_INDUSTRIES } from '@/lib/constants'
import { fetchApi } from '@/lib/fetchApi'
import { normalizeTierForDisplay, getTierColor } from '@/lib/intelligence-api/types'
import type { IntelligenceCompanyContext } from '@/lib/intelligence-api/types'
import type { Company, Contact, Opportunity, CompanyNote, CompanyResearchCard, TimelineEntry, CompanyStatus } from '@/lib/types'
import type { ScoreItem } from '@/components/shared/design-system'

// Sub-components
import { IntelligenceBriefing } from './company-profile/intelligence-briefing'
import { Q1WhatChanged, Q2WhyMatters, Q3WhoEngage, Q4WhatSay, Q5WhatDo } from './company-profile/q-sections'
import { IntelligenceTab } from './company-profile/intelligence-health-tab'
import { CompanyHeader, RESEARCH_LABELS, researchColors } from './company-profile/company-header'
import { NotesTimeline } from './company-profile/notes-timeline'
import {
  StatusConfirmDialog, DeleteNoteDialog, AddNoteDialog,
  EditCompanyDialog, AddContactDialog, AddOpportunityDialog,
} from './company-profile/profile-dialogs'
import { NarrativeDivider } from './company-profile/profile-utilities'

const STATUS_CYCLE: readonly string[] = ['new', 'researching', 'contacted', 'qualified', 'ready', 'won', 'lost']

export default function CompanyProfileScreen() {
  const { selectedCompanyId, setSelectedContactId, setActiveView } = useAppStore()
  const qc = useQueryClient()

  const [viewMode, setViewMode] = useState<'5q' | 'intelligence'>('5q')
  const [noteOpen, setNoteOpen] = useState(false)
  const [noteBody, setNoteBody] = useState('')
  const [noteType, setNoteType] = useState('')
  const [deleteNoteId, setDeleteNoteId] = useState<string | null>(null)
  const [contactOpen, setContactOpen] = useState(false)
  const [contactForm, setContactForm] = useState({ name: '', email: '', jobTitle: '', roleBucket: '', phone: '', linkedinUrl: '' })
  const [oppOpen, setOppOpen] = useState(false)
  const [oppForm, setOppForm] = useState({ title: '', description: '', status: 'researching', nextAction: '', targetContactId: '' })
  const [statusConfirmOpen, setStatusConfirmOpen] = useState(false)
  const [editCompanyOpen, setEditCompanyOpen] = useState(false)
  const [editForm, setEditForm] = useState({ name: '', domain: '', industry: '', website: '', linkedinUrl: '', employeeSize: '', country: '', location: '' })

  // ── Data fetching ──
  const { data, isLoading, error } = useQuery({
    queryKey: ['company', selectedCompanyId],
    queryFn: () => fetch(`/api/companies/${selectedCompanyId}`).then(r => { if (!r.ok) throw new Error('Failed to load company'); return r.json() }),
    enabled: !!selectedCompanyId,
  })

  const INCLUDES = 'signals,contacts,timeline,actions,brief,knowledge,scores'
  type IntelEnvelope = { success: boolean; data: IntelligenceCompanyContext; meta?: Record<string, unknown> }
  const { data: intelResponseRaw, isLoading: intelLoading, error: intelError, refetch: refetchIntel } = useQuery({
    queryKey: ['intel-company-5q', selectedCompanyId],
    queryFn: async () => { const res = await fetch(`/api/intelligence/company/${selectedCompanyId}?include=${INCLUDES}`); if (!res.ok) throw new Error('Failed to load intelligence data'); return res.json() as Promise<IntelEnvelope> },
    enabled: !!selectedCompanyId, staleTime: 120_000,
  })

  const intelData = intelResponseRaw?.data ?? null
  const intelMeta = intelResponseRaw?.meta as Record<string, unknown> | undefined
  const governanceStatus = intelMeta?.governance as Record<string, unknown> | undefined
  const govPassed = governanceStatus?.passed as boolean | undefined

  const { data: scoresData } = useQuery({
    queryKey: ['company-scores', selectedCompanyId],
    queryFn: () => fetch(`/api/companies/${selectedCompanyId}/scores`).then(r => { if (!r.ok) throw new Error('Failed'); return r.json() }),
    enabled: !!selectedCompanyId, staleTime: 60_000,
  })

  const { data: meta, isLoading: metaLoading } = useQuery({
    queryKey: ['companies-meta'],
    queryFn: () => fetch('/api/companies/meta').then(r => { if (!r.ok) throw new Error('Failed'); return r.json() }),
    enabled: editCompanyOpen,
  })
  const editIndustries = [...new Set([...DEFAULT_INDUSTRIES, ...(meta?.industries || [])])].sort((a, b) => a.localeCompare(b))

  // ── Mutations ──
  const addNote = useMutation({
    mutationFn: (body: { body: string; noteType: string }) => fetch('/api/notes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, companyId: selectedCompanyId }) }).then(r => { if (!r.ok) throw new Error(); return r.json() }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['company', selectedCompanyId] }); qc.invalidateQueries({ queryKey: ['company'] }); setNoteOpen(false); setNoteBody(''); setNoteType(''); toast.success('Note added') },
    onError: () => toast.error('Failed to add note'),
  })

  const generateResearch = useMutation({
    mutationFn: async () => { const res = await fetch('/api/g-data/jobs/actions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'enqueue-research', companyIds: [selectedCompanyId], force: true }) }); if (!res.ok) { const err = await res.json().catch(() => ({ error: 'Failed' })); throw new Error(err.error || 'Failed') } const d = await res.json(); if (d.error) throw new Error(d.error); return d },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['company', selectedCompanyId] }); qc.invalidateQueries({ queryKey: ['company-breadcrumb', selectedCompanyId] }); qc.invalidateQueries({ queryKey: ['intel-company-5q', selectedCompanyId] }); toast.success('Research job queued') },
    onError: (err) => toast.error(err.message || 'Failed'),
  })

  const addContact = useMutation({
    mutationFn: (form: typeof contactForm) => fetch('/api/contacts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, companyId: selectedCompanyId }) }).then(r => { if (!r.ok) return r.json().then(e => { throw new Error(e.error || 'Failed') }); return r.json() }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['company', selectedCompanyId] }); qc.invalidateQueries({ queryKey: ['intel-company-5q', selectedCompanyId] }); setContactOpen(false); setContactForm({ name: '', email: '', jobTitle: '', roleBucket: '', phone: '', linkedinUrl: '' }); toast.success('Contact added') },
    onError: (err) => toast.error(err.message || 'Failed'),
  })

  const addOpportunity = useMutation({
    mutationFn: (form: typeof oppForm) => fetch('/api/opportunities', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ companyId: selectedCompanyId, ...form }) }).then(r => { if (!r.ok) return r.json().then(e => { throw new Error(e.error || 'Failed') }); return r.json() }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['company', selectedCompanyId] }); setOppOpen(false); setOppForm({ title: '', description: '', status: 'researching', nextAction: '', targetContactId: '' }); toast.success('Opportunity created') },
    onError: (err) => toast.error(err.message || 'Failed'),
  })

  const updateCompanyStatus = useMutation({
    mutationFn: async (newStatus: string) => { const res = await fetch(`/api/companies/${selectedCompanyId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: newStatus }) }); if (!res.ok) { const err = await res.json().catch(() => ({ error: 'Failed' })); throw new Error(err.error || 'Failed') } return res.json() },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['company', selectedCompanyId] }); qc.invalidateQueries({ queryKey: ['company-breadcrumb', selectedCompanyId] }); setStatusConfirmOpen(false); toast.success('Status updated') },
    onError: () => { setStatusConfirmOpen(false); toast.error('Failed to update status') },
  })

  const editCompanyMutation = useMutation({
    mutationFn: async (form: typeof editForm) => { const { error } = await fetchApi(`/api/companies/${selectedCompanyId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) }); if (error) throw new Error(error); return null },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['company', selectedCompanyId] }); qc.invalidateQueries({ queryKey: ['company-breadcrumb', selectedCompanyId] }); qc.invalidateQueries({ queryKey: ['intel-company-5q', selectedCompanyId] }); setEditCompanyOpen(false); toast.success('Company updated') },
    onError: (err) => toast.error(err.message || 'Failed'),
  })

  const deleteNoteMutation = useMutation({
    mutationFn: (noteId: string) => fetch(`/api/notes?id=${noteId}`, { method: 'DELETE' }).then(r => { if (!r.ok) throw new Error(); return r.json() }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['company', selectedCompanyId] }); setDeleteNoteId(null); toast.success('Note deleted') },
    onError: () => toast.error('Failed to delete note'),
  })

  // ── Handlers ──
  const getNextStatus = () => { if (!data) return null; const cur = data.status as string; const idx = STATUS_CYCLE.indexOf(cur); return STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length] }
  const handleStatusCycle = () => { const next = getNextStatus(); if (next) updateCompanyStatus.mutate(next) }
  const handleBack = () => setActiveView('companies')
  const handleGenerateEmail = (id: string) => { setSelectedContactId(id); setActiveView('email-generation') }
  const handleViewContact = (id: string) => { setSelectedContactId(id); setActiveView('contact-profile') }
  const openEditCompanyDialog = () => { if (data) setEditForm({ name: data.name || '', domain: data.domain || '', industry: data.industry || '', website: data.website || '', linkedinUrl: data.linkedinUrl || '', employeeSize: data.employeeSize || '', country: data.country || '', location: data.location || '' }); setEditCompanyOpen(true) }

  // ── Keyboard shortcuts ──
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const tag = (e.target as HTMLElement)?.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
    if (noteOpen || contactOpen || oppOpen || statusConfirmOpen || editCompanyOpen || !!deleteNoteId) return
    if (e.key >= '1' && e.key <= '5' && !e.metaKey && !e.ctrlKey && !e.altKey) {
      e.preventDefault()
      const map: Record<string, string> = { '1': 'q1-what-changed', '2': 'q2-why-matters', '3': 'q3-who-engage', '4': 'q4-what-say', '5': 'q5-what-do' }
      document.getElementById(map[e.key])?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
    if (e.key === 'r' && !e.metaKey && !e.ctrlKey) { e.preventDefault(); refetchIntel() }
    if (e.key === 'e' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); if (!generateResearch.isPending) generateResearch.mutate() }
  }, [noteOpen, contactOpen, oppOpen, statusConfirmOpen, editCompanyOpen, deleteNoteId, refetchIntel, generateResearch.isPending])

  useEffect(() => { window.addEventListener('keydown', handleKeyDown); return () => window.removeEventListener('keydown', handleKeyDown) }, [handleKeyDown])

  // ── Derived data ──
  const contacts: Contact[] = data?.contacts || []
  const notes: CompanyNote[] = data?.notes || []
  const researchCard: CompanyResearchCard | null = data?.researchCard || null
  const opportunities: Opportunity[] = data?.opportunities || []
  const timeline: TimelineEntry[] = data?.timeline || []
  const score = data?.intelligenceScore ?? 0
  const intelSignals = intelData?.signals ?? []
  const intelContacts = intelData?.contacts ?? []
  const isNewAccount = !researchCard && intelSignals.length === 0 && intelContacts.length === 0 && contacts.length === 0
  const lastEnriched = data?.lastEnrichedAt ? new Date(data.lastEnrichedAt) : null
  const daysSinceEnrichment = lastEnriched ? Math.floor((Date.now() - lastEnriched.getTime()) / (1000 * 60 * 60 * 24)) : null
  const isStaleIntel = daysSinceEnrichment !== null && daysSinceEnrichment > 60
  const getDynamicColor = (s: number) => s >= 80 ? 'var(--dmq-emerald-deep)' : s >= 60 ? 'var(--dmq-amber-deep)' : s >= 40 ? 'var(--dmq-domain-reasoning)' : 'var(--dmq-red)'
  const intelligenceScoreItem: ScoreItem | null = scoresData?.intelligence ? { label: 'Intelligence', score: scoresData.intelligence.score, tier: normalizeTierForDisplay(scoresData.intelligence.tier, 'intelligence'), color: getTierColor(scoresData.intelligence.tier, 'intelligence') } : { label: 'Intelligence', score, tier: normalizeTierForDisplay(score >= 70 ? 'hot' : score >= 40 ? 'warm' : score >= 15 ? 'cold' : 'unknown', 'intelligence'), color: getDynamicColor(score) }
  const priorityScoreItem: ScoreItem | null = scoresData?.accountPriority ? { label: 'Priority', score: Math.round(scoresData.accountPriority.score), tier: normalizeTierForDisplay(scoresData.accountPriority.tier, 'accountPriority'), color: getTierColor(scoresData.accountPriority.tier, 'accountPriority') } : data?.accountPriorityScore != null ? { label: 'Priority', score: Math.round(data.accountPriorityScore), tier: normalizeTierForDisplay(data.priorityTier ?? null, 'accountPriority'), color: getDynamicColor(data.accountPriorityScore) } : null
  const revenueScoreItem: ScoreItem | null = scoresData?.revenueOpportunity ? { label: 'Revenue', score: Math.round(scoresData.revenueOpportunity.score), tier: normalizeTierForDisplay(scoresData.revenueOpportunity.category, 'revenue'), color: getTierColor(scoresData.revenueOpportunity.category, 'revenue') } : null

  // ── Guards ──
  if (!selectedCompanyId) return <EmptyState icon={Globe} title="No company selected" description="Go back to Companies and select one." actionLabel="Back to Companies" onAction={() => setActiveView('companies')} />
  if (isLoading) return <div className="space-y-6"><Skeleton className="h-40 w-full rounded-xl" /><div className="flex gap-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-9 w-24 rounded-lg" />)}</div><Skeleton className="h-64 w-full rounded-xl" /><Skeleton className="h-48 w-full rounded-xl" /></div>
  if (error) return <div className="space-y-4"><div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">Failed to load company.</div><Button variant="outline" onClick={handleBack}>Back to Companies</Button></div>
  if (!data) return <EmptyState icon={Globe} title="Company not found" description="This company may have been deleted." actionLabel="Back to Companies" onAction={() => setActiveView('companies')} />

  return (
    <div className="space-y-6">
      <ScreenBreadcrumb items={[{ label: 'Companies', href: '/dashboard' }, { label: data?.name || 'Company' }]} />

      <CompanyHeader
        data={data} contacts={contacts} notes={notes} opportunities={opportunities} researchCard={researchCard}
        intelligenceScoreItem={intelligenceScoreItem} priorityScoreItem={priorityScoreItem} revenueScoreItem={revenueScoreItem}
        isStaleIntel={isStaleIntel} daysSinceEnrichment={daysSinceEnrichment ?? 0} govPassed={govPassed} intelData={intelData}
        updateCompanyStatusPending={updateCompanyStatus.isPending} generateResearchPending={generateResearch.isPending}
        onBack={handleBack} onStatusClick={() => setStatusConfirmOpen(true)} onEditCompany={openEditCompanyDialog}
        onGenerateResearch={() => generateResearch.mutate()} onAddNote={() => setNoteOpen(true)} onAddContact={() => setContactOpen(true)}
        onAddOpportunity={() => setOppOpen(true)} onGenerateEmail={handleGenerateEmail} onReEnrich={() => generateResearch.mutate()}
      />

      {/* ── AI Intelligence Briefing — The Hero Moment ── */}
      <IntelligenceBriefing companyId={selectedCompanyId} />

      {isNewAccount && (
        <div className="rounded-xl border border-dashed border-gray-200 bg-gradient-to-br from-amber-50/60 to-orange-50/30 p-10 text-center slide-up">
          <Brain className="size-12 text-amber-400 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-gray-900 mb-2">This account has no intelligence yet</h3>
          <p className="text-sm text-gray-600 max-w-md mx-auto mb-6">Start by enriching this company to discover signals, build analysis, and get AI-powered recommendations.</p>
          <div className="flex items-center justify-center gap-3">
            <Button className="bg-amber-600 hover:bg-amber-700 text-white rounded-lg press-scale shadow-sm" onClick={() => generateResearch.mutate()} disabled={generateResearch.isPending}>
              {generateResearch.isPending ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Sparkles className="size-4 mr-2" />}Enrich Now
            </Button>
            <Button variant="outline" className="border-gray-200 text-gray-600 hover:bg-gray-50 rounded-lg" onClick={() => setContactOpen(true)}><Plus className="size-4 mr-1.5" />Add Contact Manually</Button>
          </div>
        </div>
      )}

      {/* View Toggle */}
      <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 h-10 w-fit">
        <button onClick={() => setViewMode('5q')} className={`rounded-md text-xs px-3 py-2.5 transition-colors flex items-center gap-1.5 ${viewMode === '5q' ? 'bg-white shadow-sm text-gray-900 font-medium' : 'text-gray-500 hover:text-gray-800'}`}><Brain className="size-3.5" />5Q Intelligence</button>
        <button onClick={() => setViewMode('intelligence')} className={`rounded-md text-xs px-3 py-2.5 transition-colors ${viewMode === 'intelligence' ? 'bg-white shadow-sm text-gray-900 font-medium' : 'text-gray-500 hover:text-gray-800'}`}><Shield className="size-3.5 inline mr-1" />Health & Validation</button>
        <div className="ml-2 hidden md:flex items-center gap-2 text-[10px] text-gray-400"><span className="flex items-center gap-0.5"><Keyboard className="size-3" />1-5</span><span className="flex items-center gap-0.5">R refresh</span><span className="flex items-center gap-0.5">⌘E enrich</span></div>
      </div>

      {viewMode === '5q' ? (
        <div className="space-y-6">
          {researchCard && (
            <div className="rounded-xl bg-white card-rest overflow-hidden slide-up">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2"><Sparkles className="size-4 text-amber-500" />AI Research Summary{researchCard.confidenceScore && <span className="text-[11px] font-medium text-gray-600">{researchCard.confidenceScore}% confidence</span>}</h3>
                <Button size="sm" className="h-10 text-xs bg-amber-600 hover:bg-amber-700 text-white rounded-md press-scale shadow-xs min-h-[44px]" onClick={() => generateResearch.mutate()} disabled={generateResearch.isPending}>{generateResearch.isPending ? <Loader2 className="size-3 mr-1 animate-spin" /> : <Sparkles className="size-3 mr-1" />}Regenerate</Button>
              </div>
              <div className="p-6">
                <div className="grid gap-3 md:grid-cols-2">
                  {(Object.entries(RESEARCH_LABELS) as [string, typeof RESEARCH_LABELS[string]][]).slice(0, 6).map(([key, cfg], idx) =>
                    (researchCard as unknown as Record<string, unknown>)[key] ? (
                      <div key={String(key)} className={`rounded-lg border p-4 ${researchColors[idx % researchColors.length]} slide-up`} style={{ animationDelay: `${idx * 40}ms` }}>
                        <div className="flex items-center gap-2 mb-1.5"><cfg.icon className="size-3.5 text-gray-500" /><p className="text-xs font-semibold text-gray-800 uppercase tracking-wider">{cfg.label}</p></div>
                        <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap line-clamp-3">{String((researchCard as unknown as Record<string, unknown>)[key])}</p>
                      </div>
                    ) : null,
                  )}
                </div>
              </div>
            </div>
          )}

          <NarrativeDivider label="Q1" subtitle="What Changed?" color="blue" />
          <div className="rounded-xl bg-gradient-to-br from-blue-50/40 to-cyan-50/20 border border-blue-100/60 p-6"><Q1WhatChanged signals={intelSignals} loading={intelLoading} error={intelError ? 'Failed to load signals' : null} onRetry={() => refetchIntel()} governanceStatus={govPassed !== undefined ? (govPassed ? 'verified' : 'failed') : 'not_evaluated'} /></div>
          <NarrativeDivider label="Q2" subtitle="Why Does It Matter?" color="violet" transition="WHY THIS MATTERS — Understanding the strategic impact" />
          <div className="rounded-xl bg-gradient-to-br from-violet-50/40 to-purple-50/20 border border-violet-100/60 p-6"><Q2WhyMatters brief={intelData?.brief} actions={intelData?.actions} loading={intelLoading} error={intelError ? 'Failed to load reasoning' : null} onRetry={() => refetchIntel()} governanceStatus={govPassed !== undefined ? (govPassed ? 'verified' : 'failed') : 'not_evaluated'} /></div>
          <NarrativeDivider label="Q3" subtitle="Who Should We Engage?" color="emerald" transition="WHO TO APPROACH — Mapping the buying committee" />
          <div className="rounded-xl bg-gradient-to-br from-emerald-50/40 to-teal-50/20 border border-emerald-100/60 p-6"><Q3WhoEngage contacts={intelContacts} keyPeople={intelData?.keyPeople || []} loading={intelLoading} error={intelError ? 'Failed to load contacts' : null} onRetry={() => refetchIntel()} onViewContact={handleViewContact} onGenerateEmail={handleGenerateEmail} /></div>
          <NarrativeDivider label="Q4" subtitle="What Should We Say?" color="amber" transition="WHAT TO SAY — Preparing the right message" />
          <div className="rounded-xl bg-gradient-to-br from-amber-50/40 to-yellow-50/20 border border-amber-100/60 p-6"><Q4WhatSay brief={intelData?.brief} capabilities={intelData?.knowledge?.capabilities || []} loading={intelLoading} error={intelError ? 'Failed to load conversation prep' : null} onRetry={() => refetchIntel()} onGenerateEmail={handleGenerateEmail} /></div>
          <NarrativeDivider label="Q5" subtitle="What Should We Do?" color="rose" transition="WHAT TO DO — Turning intelligence into action" />
          <div className="rounded-xl bg-gradient-to-br from-rose-50/40 to-pink-50/20 border border-rose-100/60 p-6"><Q5WhatDo actions={intelData?.actions} opportunities={opportunities} loading={intelLoading} error={intelError ? 'Failed to load actions' : null} onRetry={() => refetchIntel()} /></div>

          <NotesTimeline notes={notes} timeline={timeline} onAddNote={() => setNoteOpen(true)} onDeleteNote={(id) => setDeleteNoteId(id)} />
        </div>
      ) : (
        <IntelligenceTab companyId={data.id} />
      )}

      {/* Dialogs */}
      <StatusConfirmDialog open={statusConfirmOpen} onOpenChange={setStatusConfirmOpen} currentStatus={data.status} nextStatus={getNextStatus() || ''} pending={updateCompanyStatus.isPending} onConfirm={handleStatusCycle} />
      <DeleteNoteDialog open={!!deleteNoteId} onOpenChange={(v) => { if (!v) setDeleteNoteId(null) }} pending={deleteNoteMutation.isPending} onConfirm={() => deleteNoteMutation.mutate(deleteNoteId!)} />
      <AddNoteDialog open={noteOpen} onOpenChange={setNoteOpen} noteType={noteType} setNoteType={setNoteType} noteBody={noteBody} setNoteBody={setNoteBody} pending={addNote.isPending} onSubmit={() => addNote.mutate({ body: noteBody, noteType })} />
      <EditCompanyDialog open={editCompanyOpen} onOpenChange={setEditCompanyOpen} form={editForm} setForm={setEditForm} industries={editIndustries} pending={editCompanyMutation.isPending} onSubmit={() => { if (editForm.name.trim()) editCompanyMutation.mutate(editForm) }} />
      <AddContactDialog open={contactOpen} onOpenChange={setContactOpen} form={contactForm} setForm={setContactForm} companyName={data.name} pending={addContact.isPending} onSubmit={() => { if (contactForm.name.trim()) addContact.mutate(contactForm) }} />
      <AddOpportunityDialog open={oppOpen} onOpenChange={setOppOpen} form={oppForm} setForm={setOppForm} contacts={contacts} pending={addOpportunity.isPending} onSubmit={() => { if (oppForm.title.trim()) addOpportunity.mutate(oppForm) }} />
    </div>
  )
}
