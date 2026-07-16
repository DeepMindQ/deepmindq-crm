'use client'

import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import {
  Mail, Sparkles, Copy, RefreshCw, User, CheckCircle2, Loader2, Search,
  ExternalLink, Zap, AlertTriangle, Building2, Eye, Save, ChevronRight,
  Database, ChevronDown, Brain, X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { useAppStore } from '@/lib/store'
import { EmptyState } from '@/components/shared/design-system'
import { cn } from '@/lib/utils'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

/* ═══════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════ */

type Tone = 'formal' | 'professional-casual' | 'direct'
type EmailLength = 'short' | 'medium' | 'detailed'
type CtaStyle = 'soft' | 'direct'

interface ContactRow {
  id: string
  name: string
  email: string | null
  jobTitle: string | null
  company: { id: string; name: string } | null
  emailHealth: string
  emailHealthScore: number | null
  companyId: string | null
}

interface CompanyRow {
  id: string
  rawName: string
  industry: string | null
  country: string | null
  _count: { contacts: number }
}

/* ═══════════════════════════════════════════════════════════════
   Constants
   ═══════════════════════════════════════════════════════════════ */

const TONE_OPTIONS: { value: Tone; label: string }[] = [
  { value: 'formal', label: 'Formal' },
  { value: 'professional-casual', label: 'Professional-Casual' },
  { value: 'direct', label: 'Direct' },
]

const LENGTH_OPTIONS: { value: EmailLength; label: string }[] = [
  { value: 'short', label: 'Short' },
  { value: 'medium', label: 'Medium' },
  { value: 'detailed', label: 'Detailed' },
]

const CTA_OPTIONS: { value: CtaStyle; label: string }[] = [
  { value: 'soft', label: 'Soft Ask' },
  { value: 'direct', label: 'Direct Ask' },
]

const TOGGLE_ACTIVE = 'bg-amber-600 text-white shadow-xs'
const TOGGLE_INACTIVE = 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'

/* ═══════════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════════ */

function matchScoreClasses(score: number | null | undefined) {
  if (score == null) return 'bg-gray-100 text-gray-600 border border-gray-200'
  if (score >= 80) return 'bg-emerald-50 text-emerald-700 border border-emerald-200'
  if (score >= 60) return 'bg-amber-50 text-amber-700 border border-amber-200'
  return 'bg-red-50 text-red-700 border border-red-200'
}

function confidenceClasses(confidence: string | undefined) {
  switch (confidence) {
    case 'high': return 'bg-emerald-50 text-emerald-700 border border-emerald-200'
    case 'medium': return 'bg-amber-50 text-amber-700 border border-amber-200'
    case 'low': return 'bg-red-50 text-red-700 border border-red-200'
    default: return 'bg-gray-100 text-gray-600 border border-gray-200'
  }
}

function emailHealthBadge(health: string) {
  switch (health) {
    case 'valid': return { label: 'Valid', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
    case 'risky': return { label: 'Risky', cls: 'bg-amber-50 text-amber-700 border-amber-200' }
    case 'invalid': return { label: 'Invalid', cls: 'bg-red-50 text-red-700 border-red-200' }
    default: return { label: 'Unknown', cls: 'bg-gray-100 text-gray-600 border-gray-200' }
  }
}

function providerDisplayName(provider: string) {
  switch (provider) {
    case 'openai': return 'OpenAI'
    case 'gemini': return 'Google Gemini'
    case 'groq': return 'Groq'
    default: return provider
  }
}

/* ═══════════════════════════════════════════════════════════════
   AI Status Banner
   ═══════════════════════════════════════════════════════════════ */

function AiStatusBanner({ onGoToSettings }: { onGoToSettings: () => void }) {
  const { data: prefs, error: prefsError } = useQuery({
    queryKey: ['preferences'],
    queryFn: () => fetch('/api/preferences').then(r => {
      if (!r.ok) throw new Error('Failed to load preferences')
      return r.json()
    }),
  })

  if (prefsError) return null

  const hasKey = !!prefs?.aiApiKey
  const provider = prefs?.aiProvider || 'openai'
  const model = prefs?.aiModel || 'gpt-4o-mini'

  if (hasKey) {
    return (
      <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-emerald-50 border border-emerald-200/80">
        <span className="relative flex size-2.5 shrink-0">
          <span className="absolute inset-0 rounded-full bg-emerald-500 animate-ping opacity-40" />
          <span className="relative inline-flex size-2.5 rounded-full bg-emerald-500" />
        </span>
        <div className="flex items-center gap-1.5 text-sm text-emerald-800">
          <Zap className="size-3.5" />
          <span className="font-semibold">AI Powered:</span>
          <span className="text-emerald-600">Using {providerDisplayName(provider)} / {model}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-amber-50 border border-amber-200/80">
      <AlertTriangle className="size-4 text-amber-600 shrink-0" />
      <p className="text-sm text-amber-800">
        <span className="font-semibold">Template Mode:</span>{' '}
        Configure your AI provider in Settings for personalized emails
      </p>
      <button
        onClick={onGoToSettings}
        className="ml-auto text-sm font-medium text-amber-700 hover:text-amber-900 underline underline-offset-2 shrink-0 transition-colors"
      >
        Configure AI
      </button>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   Toggle Group — reusable for Tone / Length / CTA
   ═══════════════════════════════════════════════════════════════ */

function ToggleGroup<T extends string>({
  label,
  description,
  options,
  value,
  onChange,
}: {
  label: string
  description: string
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200/80 card-rest p-4 md:p-6 space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-gray-900">{label}</h3>
        <p className="text-xs text-gray-500 mt-0.5">{description}</p>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {options.map(opt => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150',
              value === opt.value ? TOGGLE_ACTIVE : TOGGLE_INACTIVE,
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   Main Component
   ═══════════════════════════════════════════════════════════════ */

export default function EmailGenerationScreen() {
  const { selectedContactId, setSelectedContactId, setSelectedCompanyId, setActiveView } = useAppStore()

  // ── Capture and clear selectedContactId on mount ──
  const [localContactId, setLocalContactId] = useState<string | null>(selectedContactId)
  const contactId = localContactId

  // Reason: we intentionally read `selectedContactId` only on mount to capture a navigated-in
  // contact ID, then immediately clear it from the store so the sidebar isn't permanently
  // highlighted. Re-running this effect when selectedContactId changes would defeat the purpose.
  useEffect(() => {
    if (selectedContactId) {
      setSelectedContactId(null)
    }
  }, [])

  // ── Company selector state ──
  const [selectedCompany, setSelectedCompany] = useState<CompanyRow | null>(null)
  const [companySearch, setCompanySearch] = useState('')
  const [debouncedCompanySearch, setDebouncedCompanySearch] = useState('')
  const companyTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  const handleCompanySearchChange = (val: string) => {
    setCompanySearch(val)
    if (companyTimerRef.current) clearTimeout(companyTimerRef.current)
    companyTimerRef.current = setTimeout(() => setDebouncedCompanySearch(val), 300)
  }

  const clearCompany = () => {
    setSelectedCompany(null)
    setCompanySearch('')
    setDebouncedCompanySearch('')
  }

  // ── Company search query ──
  const { data: companiesData, isLoading: companiesLoading } = useQuery({
    queryKey: ['companies', 'email-gen-selector', debouncedCompanySearch],
    queryFn: () => {
      const p = new URLSearchParams({ limit: '20', sortBy: 'contacts' })
      if (debouncedCompanySearch) p.set('search', debouncedCompanySearch)
      return fetch(`/api/companies?${p}`).then(r => {
        if (!r.ok) throw new Error('Failed to load companies')
        return r.json()
      })
    },
    enabled: !selectedCompany,
  })

  const companies = (companiesData?.companies ?? []) as CompanyRow[]

  // ── Search debounce ──
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const [contactSearch, setContactSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      if (companyTimerRef.current) clearTimeout(companyTimerRef.current)
    }
  }, [])

  const handleSearchChange = (val: string) => {
    setContactSearch(val)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setDebouncedSearch(val), 300)
  }

  // ── Preferences for defaults ──
  const { data: prefs, error: prefsError } = useQuery({
    queryKey: ['preferences'],
    queryFn: () => fetch('/api/preferences').then(r => {
      if (!r.ok) throw new Error('Failed to load preferences')
      return r.json()
    }),
  })

  // ── Sync defaults from prefs once loaded ──
  const [tone, setTone] = useState<Tone>('professional-casual')
  const [emailLength, setEmailLength] = useState<EmailLength>('medium')
  const [ctaStyle, setCtaStyle] = useState<CtaStyle>('soft')
  const [generatedSubject, setGeneratedSubject] = useState('')
  const [generatedBody, setGeneratedBody] = useState('')
  const [lastDraftId, setLastDraftId] = useState<string | null>(null)
  const [lastMatchScore, setLastMatchScore] = useState<number | null>(null)
  const [lastConfidence, setLastConfidence] = useState<string | undefined>(undefined)
  const [knowledgeUsed, setKnowledgeUsed] = useState<{ id: string; title: string; type: string; score: number; industries: string[] }[]>([])
  const [knowledgeAvailable, setKnowledgeAvailable] = useState<number>(0)
  const [showKnowledge, setShowKnowledge] = useState(false)
  const [draftContactId, setDraftContactId] = useState<string | null>(null)
  const [isAiGenerated, setIsAiGenerated] = useState(false)
  const [aiProviderName, setAiProviderName] = useState('')
  const [subjectSaving, setSubjectSaving] = useState(false)

  useEffect(() => {
    if (prefs) {
      setTone((prefs.tone as Tone) || 'professional-casual')
      setEmailLength((prefs.emailLength as EmailLength) || 'medium')
      setCtaStyle((prefs.ctaStyle as CtaStyle) || 'soft')
    }
  }, [prefs])

  // ── Contacts ──
  const { data: contactsData, isLoading: contactsLoading, error: contactsError } = useQuery({
    queryKey: ['contacts', 'email-gen-sidebar', debouncedSearch, selectedCompany?.id],
    queryFn: () => {
      const p = new URLSearchParams({ pageSize: '50' })
      if (selectedCompany) {
        p.set('companyId', selectedCompany.id)
      } else if (debouncedSearch) {
        p.set('search', debouncedSearch)
      }
      return fetch(`/api/contacts?${p}`).then(r => {
        if (!r.ok) throw new Error('Failed to load contacts')
        return r.json()
      })
    },
  })

  const contacts = (contactsData?.contacts ?? []) as ContactRow[]

  // ── Selected contact (may need separate fetch if navigated from elsewhere) ──
  const selectedContact = contacts.find(c => c.id === contactId) ?? null

  const { data: preselectedContact, isLoading: preselectedLoading, error: preselectedError } = useQuery({
    queryKey: ['contact', contactId],
    queryFn: () => fetch(`/api/contacts/${contactId}`).then(r => {
      if (!r.ok) throw new Error('Failed to load contact')
      return r.json()
    }),
    enabled: !!contactId && !selectedContact,
  })

  const activeContact = selectedContact || (preselectedContact ? {
    id: preselectedContact.id,
    name: preselectedContact.name,
    email: preselectedContact.email,
    jobTitle: preselectedContact.jobTitle,
    company: preselectedContact.company ? { id: preselectedContact.company.id, name: preselectedContact.company.name } : null,
    emailHealth: preselectedContact.emailHealth || 'unknown',
    emailHealthScore: preselectedContact.emailHealthScore,
    companyId: preselectedContact.companyId,
  } : null)

  const hasDraft = generatedBody.length > 0 && draftContactId === contactId

  // ── Navigation helpers ──
  const goToSettings = () => setActiveView('settings')
  const goToContactProfile = () => {
    if (activeContact) {
      setSelectedContactId(activeContact.id)
      setActiveView('contact-profile')
    }
  }
  const goToCompanyProfile = (companyId: string) => {
    setSelectedCompanyId(companyId)
    setActiveView('company-profile')
  }

  const clearDraft = () => {
    setGeneratedSubject('')
    setGeneratedBody('')
    setLastDraftId(null)
    setLastMatchScore(null)
    setLastConfidence(undefined)
    setKnowledgeUsed([])
    setKnowledgeAvailable(0)
    setShowKnowledge(false)
    setDraftContactId(null)
    setIsAiGenerated(false)
    setAiProviderName('')
  }

  // ── Generate mutation ──
  const generateMutation = useMutation({
    mutationFn: () =>
      fetch(`/api/contacts/${contactId}/generate-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tone, emailLength, ctaStyle }),
      })
        .then(r => r.ok ? r.json() : r.json().then((e: { error?: string }) => { throw new Error(e.error || 'Generation failed') })),
    onSuccess: (data: { subject?: string; body?: string; draftId?: string; matchScore?: number; confidence?: string; knowledgeUsed?: any[]; knowledgeAvailable?: number }) => {
      setGeneratedSubject(data.subject || '')
      setGeneratedBody(data.body || '')
      setLastDraftId(data.draftId || null)
      setLastMatchScore(data.matchScore ?? null)
      setLastConfidence(data.confidence)
      setKnowledgeUsed(data.knowledgeUsed || [])
      setKnowledgeAvailable(data.knowledgeAvailable || 0)
      setShowKnowledge((data.knowledgeUsed || []).length > 0)
      setDraftContactId(contactId || null)
      // Determine if AI was used based on prefs
      const aiKey = prefs?.aiApiKey
      setIsAiGenerated(!!aiKey)
      setAiProviderName(providerDisplayName(prefs?.aiProvider || 'openai'))
      toast.success('Email generated successfully')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  // ── Save edited subject ──
  const saveSubjectMutation = useMutation({
    mutationFn: ({ draftId, subject }: { draftId: string; subject: string }) =>
      fetch(`/api/drafts/${draftId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject }),
      })
        .then(r => r.ok ? r.json() : r.json().then((e: { error?: string }) => { throw new Error(e.error || 'Failed to save subject') })),
    onSuccess: () => {
      toast.success('Subject updated')
      setSubjectSaving(false)
    },
    onError: (e: Error) => {
      toast.error(e.message)
      setSubjectSaving(false)
    },
  })

  const handleSaveSubject = () => {
    if (!lastDraftId) return
    setSubjectSaving(true)
    saveSubjectMutation.mutate({ draftId: lastDraftId, subject: generatedSubject })
  }

  // ── Copy ──
  const handleCopy = async () => {
    const fullEmail = generatedSubject
      ? `Subject: ${generatedSubject}\n\n${generatedBody}`
      : generatedBody
    try {
      await navigator.clipboard.writeText(fullEmail)
      toast.success('Copied to clipboard')
    } catch {
      toast.error('Failed to copy to clipboard')
    }
  }

  // ── Select contact ──
  const selectContact = (contact: ContactRow) => {
    setLocalContactId(contact.id)
    clearDraft()
  }

  return (
    <div className="flex h-full -m-6 flex-col md:flex-row">
      {/* ═══════════════════════════════════════════════════════
          Mobile Contact Selector
         ═══════════════════════════════════════════════════════ */}
      <div className="md:hidden p-4 border-b border-gray-200/60 bg-white space-y-3">
        <Select value={contactId || ''} onValueChange={(id) => {
          const c = contacts.find(ct => ct.id === id)
          if (c) selectContact(c)
        }}>
          <SelectTrigger className="w-full h-9 border-gray-200 rounded-lg text-sm">
            <SelectValue placeholder="Select a contact..." />
          </SelectTrigger>
          <SelectContent>
            {contacts.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                <span className="font-medium">{c.name}</span>
                {c.jobTitle && <span className="text-gray-600 ml-2">{c.jobTitle}</span>}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <AiStatusBanner onGoToSettings={goToSettings} />
      </div>

      {/* ═══════════════════════════════════════════════════════
          Left Sidebar (hidden on mobile)
         ═══════════════════════════════════════════════════════ */}
      <aside className="hidden md:flex w-80 border-r border-gray-200/80 bg-gray-50/50 flex-col shrink-0">
        {/* AI Status Banner */}
        <div className="p-4 border-b border-gray-200/60 bg-white">
          <AiStatusBanner onGoToSettings={goToSettings} />
        </div>

        {/* Company Selector */}
        <div className="p-4 border-b border-gray-200/60 bg-white space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
              <Building2 className="size-3" />
              Company Filter
            </h3>
            {selectedCompany && (
              <button
                onClick={clearCompany}
                className="text-[11px] text-gray-600 hover:text-gray-600 flex items-center gap-0.5 transition-colors"
              >
                <X className="size-3" />
                Clear
              </button>
            )}
          </div>

          {selectedCompany ? (
            /* Selected company card */
            <div className="rounded-lg border border-amber-300/80 bg-amber-50/60 p-3 space-y-1.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <button
                    onClick={() => goToCompanyProfile(selectedCompany.id)}
                    className="text-sm font-semibold text-gray-900 hover:text-amber-700 transition-colors truncate block"
                  >
                    {selectedCompany.rawName}
                  </button>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {selectedCompany.industry && (
                      <Badge variant="outline" className="text-[10px] font-medium px-1.5 py-0 border-gray-300 text-gray-600 bg-white">
                        {selectedCompany.industry}
                      </Badge>
                    )}
                    <span className="text-[11px] text-gray-500 flex items-center gap-1">
                      <User className="size-2.5" />
                      {selectedCompany._count.contacts} contact{selectedCompany._count.contacts !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
                <button
                  onClick={clearCompany}
                  className="p-1 rounded-md text-gray-600 hover:text-gray-600 hover:bg-gray-200/60 transition-colors shrink-0"
                  title="Clear company filter"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            </div>
          ) : (
            /* Company search input */
            <>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-gray-600" />
                <Input
                  placeholder="Search companies..."
                  value={companySearch}
                  onChange={e => handleCompanySearchChange(e.target.value)}
                  className="pl-8 h-8 bg-gray-100 border-gray-200 rounded-lg text-xs focus-visible:ring-amber-500/20 focus-visible:border-amber-400"
                />
              </div>

              {companiesLoading && companySearch ? (
                <div className="space-y-1.5">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-12 rounded-lg bg-gray-100 animate-pulse" />
                  ))}
                </div>
              ) : companies.length > 0 && companySearch ? (
                <div className="max-h-60 overflow-y-auto rounded-lg border border-gray-200/80 bg-white shadow-sm">
                  {companies.map((comp) => (
                    <button
                      key={comp.id}
                      onClick={() => { setSelectedCompany(comp); setCompanySearch(''); setDebouncedCompanySearch('') }}
                      className="w-full px-3 py-2.5 text-left hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-0 flex items-center gap-2.5"
                    >
                      <div className="size-7 rounded-md bg-gray-100 flex items-center justify-center text-gray-500 shrink-0">
                        <Building2 className="size-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-gray-900 truncate">{comp.rawName}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {comp.industry && (
                            <span className="text-[10px] text-gray-600 truncate">{comp.industry}</span>
                          )}
                          <span className="text-[10px] text-gray-600 shrink-0">
                            {comp._count.contacts} contact{comp._count.contacts !== 1 ? 's' : ''}
                          </span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : null}
            </>
          )}
        </div>

        {/* Selected Contact Card */}
        {activeContact && (
          <div className="p-4 border-b border-gray-200/60 bg-white">
            <div className="flex items-start gap-3">
              <div className="size-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 text-sm font-bold shrink-0 mt-0.5">
                {activeContact.name?.charAt(0)?.toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <button
                  onClick={goToContactProfile}
                  className="text-sm font-semibold text-gray-900 hover:text-amber-700 truncate block transition-colors"
                >
                  {activeContact.name}
                </button>
                <p className="text-xs text-gray-500 font-mono truncate mt-0.5">{activeContact.email}</p>
                {activeContact.company && (
                  <button
                    onClick={() => goToCompanyProfile(activeContact.company?.id || activeContact.companyId || '')}
                    className="text-xs text-amber-600 hover:text-amber-800 truncate block mt-0.5 transition-colors"
                  >
                    {activeContact.company.name} →
                  </button>
                )}
                {activeContact.jobTitle && (
                  <p className="text-xs text-gray-600 mt-0.5 truncate">{activeContact.jobTitle}</p>
                )}
                {activeContact.emailHealth && (
                  <Badge className={cn('text-[10px] font-medium px-2 py-0.5 mt-2 border', emailHealthBadge(activeContact.emailHealth).cls)}>
                    {emailHealthBadge(activeContact.emailHealth).label}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Contact List */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-4 pt-4 pb-2">
            <h3 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Contacts</h3>
          </div>
          <div className="px-3 pb-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-gray-600" />
              <Input
                placeholder="Search contacts..."
                value={contactSearch}
                onChange={e => handleSearchChange(e.target.value)}
                className="pl-8 h-8 bg-gray-100 border-gray-200 rounded-lg text-xs focus-visible:ring-amber-500/20 focus-visible:border-amber-400"
              />
            </div>
          </div>

          {contactsLoading ? (
            <div className="px-4 space-y-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-16 rounded-lg bg-gray-100 animate-pulse" />
              ))}
            </div>
          ) : contactsError ? (
            <div className="px-4 py-6 text-center">
              <AlertTriangle className="size-6 text-red-600 mx-auto mb-2" />
              <p className="text-xs text-red-500">Failed to load contacts</p>
            </div>
          ) : contacts.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <User className="size-8 text-gray-700 mx-auto mb-2" />
              <p className="text-xs text-gray-600">No contacts found</p>
            </div>
          ) : (
            <div className="px-2 space-y-1 pb-4">
              {contacts.map((c) => {
                const isActive = c.id === contactId
                const health = emailHealthBadge(c.emailHealth)
                return (
                  <button
                    key={c.id}
                    onClick={() => selectContact(c)}
                    className={cn(
                      'w-full p-3 rounded-lg cursor-pointer transition-colors flex items-center gap-2.5 text-left group',
                      isActive
                        ? 'bg-amber-50 border border-amber-200/80'
                        : 'hover:bg-gray-100/60 border border-transparent'
                    )}
                  >
                    <div className="size-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 text-[11px] font-bold shrink-0">
                      {c.name?.charAt(0)?.toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 truncate">{c.name}</p>
                      <p className="text-[11px] text-gray-500 truncate">{c.jobTitle || 'No title'}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <p className="text-[11px] text-gray-600 truncate">{c.company?.name || '—'}</p>
                        <Badge className={cn('text-[9px] font-medium px-1.5 py-0 border shrink-0', health.cls)}>
                          {health.label}
                        </Badge>
                      </div>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); setSelectedContactId(c.id); setActiveView('contact-profile') }}
                      className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-amber-600 transition-all duration-150 shrink-0 p-1 rounded-md hover:bg-amber-50"
                      title="View contact profile"
                    >
                      <ChevronRight className="size-3.5" />
                    </button>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </aside>

      {/* ═══════════════════════════════════════════════════════
          Main Area
         ═══════════════════════════════════════════════════════ */}
      <main className="flex-1 overflow-y-auto min-h-0">
        {!activeContact && !preselectedLoading ? (
          <div className="h-full">
            <EmptyState
              icon={Mail}
              title="Select a contact to generate a personalized email"
              description="Choose a contact from the sidebar to begin crafting an AI-powered outreach email tailored to their role, company, and industry."
            />
          </div>
        ) : preselectedError ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center space-y-3">
              <AlertTriangle className="size-8 text-red-600 mx-auto" />
              <p className="text-sm text-red-600 font-medium">Failed to load contact</p>
              <p className="text-xs text-red-600">{preselectedError.message}</p>
            </div>
          </div>
        ) : preselectedLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="size-6 animate-spin text-amber-600" />
          </div>
        ) : (
          <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-4 md:space-y-5">
            {/* ── Preferences error banner ── */}
            {prefsError && (
              <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 flex items-center gap-3">
                <AlertTriangle className="size-4 text-amber-500 shrink-0" />
                <p className="text-sm text-amber-700 flex-1">Could not load AI preferences. Using defaults.</p>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs border-amber-200 text-amber-700 hover:bg-amber-100 shrink-0"
                  onClick={goToSettings}
                >
                  Open Settings
                </Button>
              </div>
            )}

            {/* ── Contact context header ── */}
            <div className="bg-white rounded-xl border border-gray-200/80 card-rest p-4 md:p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="size-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 text-sm font-bold shrink-0">
                    {activeContact?.name?.charAt(0)?.toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={goToContactProfile}
                        className="text-sm font-semibold text-gray-900 hover:text-amber-700 transition-colors truncate"
                      >
                        {activeContact?.name}
                      </button>
                      {activeContact?.company && (
                        <>
                          <span className="text-gray-700">·</span>
                          <button
                            onClick={() => goToCompanyProfile(activeContact.company?.id || activeContact.companyId || '')}
                            className="text-sm text-gray-500 hover:text-amber-700 transition-colors flex items-center gap-1 truncate"
                          >
                            <Building2 className="size-3" />
                            {activeContact.company.name}
                          </button>
                        </>
                      )}
                    </div>
                    <p className="text-xs text-gray-600 mt-0.5">
                      {activeContact?.email} {activeContact?.jobTitle ? `· ${activeContact.jobTitle}` : ''}
                    </p>
                  </div>
                </div>
                <button
                  onClick={goToContactProfile}
                  className="hidden sm:flex items-center gap-1 text-xs font-medium text-amber-600 hover:text-amber-800 transition-colors shrink-0"
                >
                  <Eye className="size-3.5" />
                  View Profile
                </button>
              </div>
            </div>

            {/* ── Configuration Panel ── */}
            <ToggleGroup
              label="Email Tone"
              description="Choose the voice and style of your outreach message"
              options={TONE_OPTIONS}
              value={tone}
              onChange={setTone}
            />

            <ToggleGroup
              label="Email Length"
              description="How detailed should the generated email be?"
              options={LENGTH_OPTIONS}
              value={emailLength}
              onChange={setEmailLength}
            />

            <ToggleGroup
              label="CTA Style"
              description="How should the call-to-action be framed?"
              options={CTA_OPTIONS}
              value={ctaStyle}
              onChange={setCtaStyle}
            />

            {/* ── Generate Button ── */}
            <Button
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending}
              className="w-full h-13 bg-amber-600 hover:bg-amber-700 text-white rounded-xl press-scale shadow-sm text-base font-semibold gap-2.5 transition-all duration-200"
            >
              {generateMutation.isPending ? (
                <>
                  <Loader2 className="size-5 animate-spin" />
                  Generating with {providerDisplayName(prefs?.aiProvider || 'openai')}...
                </>
              ) : (
                <>
                  <Sparkles className="size-5" />
                  Generate Email
                </>
              )}
            </Button>

            {/* ── Generated Draft ── */}
            {hasDraft && (
              <div className="space-y-4 animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
                {/* Generation source + Badges */}
                <div className="bg-white rounded-xl border border-gray-200/80 card-rest p-4 md:p-5 space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <Badge className={cn('text-[11px] font-semibold px-2.5 py-1 border', matchScoreClasses(lastMatchScore))}>
                        Match: {lastMatchScore != null ? `${lastMatchScore}%` : '—'}
                      </Badge>
                      <Badge className={cn('text-[11px] font-semibold px-2.5 py-1 border', confidenceClasses(lastConfidence))}>
                        Confidence: {lastConfidence ? lastConfidence.charAt(0).toUpperCase() + lastConfidence.slice(1) : '—'}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-gray-600 font-medium">
                      {isAiGenerated
                        ? <span className="flex items-center gap-1"><Zap className="size-3 text-emerald-500" /> Generated by {aiProviderName}</span>
                        : <span className="flex items-center gap-1"><AlertTriangle className="size-3 text-amber-500" /> Template-based (<button onClick={goToSettings} className="text-amber-600 hover:underline">configure AI</button>)</span>
                      }
                    </p>

                    {/* Knowledge Context Toggle */}
                    {knowledgeUsed.length > 0 && (
                      <button
                        onClick={() => setShowKnowledge(!showKnowledge)}
                        className="flex items-center gap-1.5 text-[11px] text-amber-600 hover:text-amber-700 transition-colors"
                      >
                        <Brain className="size-3" />
                        {knowledgeUsed.length} knowledge snippets used
                        <ChevronDown className={cn('size-3 transition-transform', showKnowledge && 'rotate-180')} />
                      </button>
                    )}
                    {knowledgeAvailable === 0 && lastDraftId && (
                      <p className="text-[11px] text-amber-500 flex items-center gap-1">
                        <AlertTriangle className="size-3" />
                        No knowledge base - <button onClick={() => { const store = useAppStore.getState(); store.setActiveView('capability-library') }} className="underline hover:text-amber-600">upload documents</button>
                      </p>
                    )}
                  </div>

                  {/* Knowledge Context Panel */}
                  {showKnowledge && knowledgeUsed.length > 0 && (
                    <div className="border border-amber-200/60 bg-amber-50/50 rounded-lg p-3 space-y-2">
                      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-800">
                        <Brain className="size-3.5" />
                        Knowledge Context Used by AI
                      </div>
                      {knowledgeUsed.map((k, i) => (
                        <div key={k.id || i} className="flex items-start gap-2 text-[11px]">
                          <Badge className="shrink-0 text-[9px] h-4 bg-amber-100 text-amber-700 border-amber-200" variant="outline">
                            {k.type === 'case_study' ? 'Case Study' : k.type === 'service' ? 'Service' : k.type === 'capability' ? 'Capability' : 'Outcome'}
                          </Badge>
                          <div className="min-w-0">
                            <p className="text-gray-800 font-medium truncate">{k.title}</p>
                            <p className="text-gray-600">Relevance: {k.score}pts{k.industries.length > 0 ? ` | ${k.industries.join(', ')}` : ''}</p>
                          </div>
                        </div>
                      ))}
                      <p className="text-[10px] text-gray-600 pt-1">
                        {knowledgeAvailable} total snippets in knowledge base
                      </p>
                    </div>
                  )}

                  {/* Subject */}
                  <div>
                    <label className="text-xs font-medium text-gray-500 block mb-1.5">Subject Line</label>
                    <div className="flex items-center gap-2">
                      <Input
                        value={generatedSubject}
                        onChange={e => setGeneratedSubject(e.target.value)}
                        className="border-gray-200 rounded-lg h-10 text-sm font-semibold text-gray-900 focus-visible:ring-amber-500/20 focus-visible:border-amber-400 flex-1"
                        placeholder="Email subject..."
                      />
                      {lastDraftId && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-900 rounded-lg h-10 shrink-0"
                          onClick={handleSaveSubject}
                          disabled={subjectSaving || saveSubjectMutation.isPending}
                        >
                          {subjectSaving || saveSubjectMutation.isPending ? (
                            <Loader2 className="size-3.5 mr-1 animate-spin" />
                          ) : (
                            <Save className="size-3.5 mr-1" />
                          )}
                          Save Edit
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Body */}
                <div className="bg-gray-50/60 border border-gray-200/80 rounded-xl p-5 md:p-6">
                  <label className="text-xs font-medium text-gray-500 block mb-2">Email Body</label>
                  <pre className="whitespace-pre-wrap text-sm text-gray-800 leading-relaxed font-sans">
                    {generatedBody}
                  </pre>
                </div>

                {/* Action Row */}
                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    variant="outline"
                    onClick={() => generateMutation.mutate()}
                    disabled={generateMutation.isPending}
                    className="border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-900 rounded-lg gap-2"
                  >
                    <RefreshCw className={cn('size-4', generateMutation.isPending && 'animate-spin')} />
                    Regenerate
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleCopy}
                    className="border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-900 rounded-lg gap-2"
                  >
                    <Copy className="size-4" />
                    Copy Email
                  </Button>
                  <Button
                    disabled={!!lastDraftId}
                    className={cn(
                      'rounded-lg gap-2 press-scale',
                      lastDraftId
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-50'
                        : 'bg-amber-600 hover:bg-amber-700 text-white'
                    )}
                  >
                    <Save className="size-4" />
                    {lastDraftId ? 'Draft Auto-Saved' : 'Save as Draft'}
                  </Button>
                  <span className="ml-auto flex items-center gap-3">
                  <button
                    onClick={goToContactProfile}
                    className="flex items-center gap-1 text-xs font-medium text-amber-600 hover:text-amber-800 transition-colors duration-150"
                  >
                    <ExternalLink className="size-3.5" />
                    View Contact Profile
                  </button>
                  {activeContact?.company && (
                    <button
                      onClick={() => goToCompanyProfile(activeContact.company?.id || activeContact.companyId || '')}
                      className="flex items-center gap-1 text-xs font-medium text-amber-600 hover:text-amber-800 transition-colors duration-150"
                    >
                      <Building2 className="size-3.5" />
                      View Company
                    </button>
                  )}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}

// Named export alias for consumers that import by name
export { EmailGenerationScreen }