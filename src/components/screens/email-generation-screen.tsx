'use client'

import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Mail, Sparkles, Copy, RefreshCw, User, CheckCircle2, Loader2, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { useAppStore } from '@/lib/store'
import { EmptyState } from '@/components/shared/design-system'
import { cn } from '@/lib/utils'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

type Tone = 'formal' | 'professional-casual' | 'direct'
type EmailLength = 'short' | 'medium' | 'detailed'
type CtaStyle = 'soft' | 'direct'

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

const toggleActive = 'bg-amber-600 text-white'
const toggleInactive = 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'

function matchScoreBadgeClasses(score: number | null | undefined) {
  if (score == null) return 'bg-gray-100 text-gray-600 border border-gray-200'
  if (score >= 80) return 'bg-emerald-50 text-emerald-700 border border-emerald-200'
  if (score >= 60) return 'bg-amber-50 text-amber-700 border border-amber-200'
  return 'bg-red-50 text-red-700 border border-red-200'
}

function confidenceBadgeClasses(confidence: string | undefined) {
  switch (confidence) {
    case 'high': return 'bg-emerald-50 text-emerald-700 border border-emerald-200'
    case 'medium': return 'bg-amber-50 text-amber-700 border border-amber-200'
    case 'low': return 'bg-red-50 text-red-700 border border-red-200'
    default: return 'bg-gray-100 text-gray-600 border border-gray-200'
  }
}

export default function EmailGenerationScreen() {
  const { selectedContactId, setSelectedContactId } = useAppStore()

  const { data: prefs } = useQuery({
    queryKey: ['preferences'],
    queryFn: () => fetch('/api/preferences').then(r => r.json()),
  })

  const [tone, setTone] = useState<Tone>((prefs?.tone as Tone) || 'professional-casual')
  const [emailLength, setEmailLength] = useState<EmailLength>((prefs?.emailLength as EmailLength) || 'medium')
  const [ctaStyle, setCtaStyle] = useState<CtaStyle>((prefs?.ctaStyle as CtaStyle) || 'soft')
  const [contactSearch, setContactSearch] = useState('')
  const [generatedSubject, setGeneratedSubject] = useState('')
  const [generatedBody, setGeneratedBody] = useState('')
  const [lastDraftId, setLastDraftId] = useState<string | null>(null)
  const [lastMatchScore, setLastMatchScore] = useState<number | null>(null)
  const [lastConfidence, setLastConfidence] = useState<string | undefined>(undefined)
  // Track which contactId the current draft belongs to so we can hide it on contact switch
  const [draftContactId, setDraftContactId] = useState<string | null>(null)

  const { data: contactsData, isLoading: contactsLoading } = useQuery({
    queryKey: ['contacts', 'email-gen-sidebar', contactSearch],
    queryFn: () => {
      const p = new URLSearchParams({ pageSize: '50' })
      if (contactSearch) p.set('search', contactSearch)
      return fetch(`/api/contacts?${p}`).then(r => r.json())
    },
  })

  const contacts = (contactsData?.contacts ?? []) as any[]
  const selectedContact = contacts.find((c: any) => c.id === selectedContactId) ?? null

  const { data: preselectedContact, isLoading: preselectedLoading } = useQuery({
    queryKey: ['contact', selectedContactId],
    queryFn: () => fetch(`/api/contacts/${selectedContactId}`).then(r => r.json()),
    enabled: !!selectedContactId && !selectedContact,
  })

  const activeContact = selectedContact || (preselectedContact ? {
    id: preselectedContact.id,
    name: preselectedContact.name,
    email: preselectedContact.email,
    jobTitle: preselectedContact.jobTitle,
    company: preselectedContact.company,
  } : null)

  // Only show draft data when it belongs to the currently selected contact
  const hasDraft = generatedBody.length > 0 && draftContactId === selectedContactId

  const generateMutation = useMutation({
    mutationFn: () =>
      fetch(`/api/contacts/${selectedContactId}/generate-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tone, emailLength, ctaStyle }),
      })
        .then(r => r.ok ? r.json() : r.json().then(e => { throw new Error(e.error || 'Generation failed') })),
    onSuccess: (data) => {
      setGeneratedSubject(data.subject || '')
      setGeneratedBody(data.body || '')
      setLastDraftId(data.draftId || null)
      setLastMatchScore(data.matchScore ?? null)
      setLastConfidence(data.confidence)
      setDraftContactId(selectedContactId || null)
      toast.success('Email generated successfully')
    },
    onError: (e: Error) => toast.error(e.message),
  })

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

  return (
    <div className="flex h-full -m-6 flex-col md:flex-row">
      {/* ─── Mobile Contact Selector ─── */}
      <div className="md:hidden p-4 border-b border-gray-200/60 bg-white">
        <Select value={selectedContactId || ''} onValueChange={(id) => {
          setSelectedContactId(id)
          setGeneratedSubject('')
          setGeneratedBody('')
          setLastDraftId(null)
          setLastMatchScore(null)
          setLastConfidence(undefined)
          setDraftContactId(null)
        }}>
          <SelectTrigger className="w-full h-9 border-gray-200 rounded-lg text-sm">
            <SelectValue placeholder="Select a contact..." />
          </SelectTrigger>
          <SelectContent>
            {contacts.map((c: any) => (
              <SelectItem key={c.id} value={c.id}>
                <span className="font-medium">{c.name}</span>
                {c.jobTitle && <span className="text-gray-400 ml-2">{c.jobTitle}</span>}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ─── Left Sidebar (hidden on mobile) ─── */}
      <aside className="hidden md:flex w-72 border-r border-gray-200/80 bg-gray-50/50 flex-col shrink-0">
        {/* Selected Contact Card */}
        {activeContact && (
          <div className="p-4 border-b border-gray-200/60 bg-white">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 text-sm font-semibold shrink-0">
                {activeContact.name?.charAt(0)?.toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-gray-900 truncate">{activeContact.name}</p>
                <p className="text-xs text-gray-500 font-mono truncate">{activeContact.email}</p>
                <p className="text-xs text-gray-400 mt-0.5 truncate">{activeContact.company?.name || activeContact.company || '—'}</p>
              </div>
            </div>
            <div className="mt-3">
              <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-medium gap-1">
                <CheckCircle2 className="size-3" />
                AI is ready
              </Badge>
            </div>
          </div>
        )}

        {/* Contact List */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-4 pt-4 pb-2">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Select Contact</h3>
          </div>
          <div className="px-3 pb-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-gray-400" />
              <Input
                placeholder="Search contacts..."
                value={contactSearch}
                onChange={e => setContactSearch(e.target.value)}
                className="pl-8 h-8 bg-gray-100 border-gray-200 rounded-lg text-xs focus-visible:ring-amber-500/20 focus-visible:border-amber-400"
              />
            </div>
          </div>

          {contactsLoading ? (
            <div className="px-4 space-y-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-14 rounded-lg bg-gray-100 animate-pulse" />
              ))}
            </div>
          ) : contacts.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <User className="size-8 text-gray-300 mx-auto mb-2" />
              <p className="text-xs text-gray-400">No contacts found</p>
            </div>
          ) : (
            <div className="px-2 space-y-1 pb-4">
              {contacts.map((c: any) => {
                const isActive = c.id === selectedContactId
                return (
                  <button
                    key={c.id}
                    onClick={() => {
                      setSelectedContactId(c.id)
                      setGeneratedSubject('')
                      setGeneratedBody('')
                      setLastDraftId(null)
                      setLastMatchScore(null)
                      setLastConfidence(undefined)
                      setDraftContactId(null)
                    }}
                    className={cn(
                      'w-full p-3 rounded-lg cursor-pointer transition-colors flex items-center gap-2.5 text-left',
                      isActive
                        ? 'bg-amber-50 border border-amber-200/80'
                        : 'hover:bg-gray-100/60 border border-transparent'
                    )}
                  >
                    <div className="size-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 text-[11px] font-semibold shrink-0">
                      {c.name?.charAt(0)?.toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 truncate">{c.name}</p>
                      <p className="text-[11px] text-gray-500 truncate">{c.jobTitle}</p>
                      <p className="text-[11px] text-gray-400 truncate">{c.company?.name || c.company || ''}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </aside>

      {/* ─── Main Area ─── */}
      <main className="flex-1 overflow-y-auto min-h-0">
        {!activeContact && !preselectedLoading ? (
          <div className="h-full">
            <EmptyState
              icon={Mail}
              title="Select a contact to generate a personalized email"
              description="Choose a contact from the sidebar to begin crafting an AI-powered outreach email tailored to them."
            />
          </div>
        ) : preselectedLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="size-6 animate-spin text-amber-600" />
          </div>
        ) : (
          <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-4 md:space-y-6">
            {/* ─── Tone Selector ─── */}
            <div className="bg-white rounded-xl border border-gray-200/80 p-4 md:p-6 elevation-modal space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-1">Email Tone</h3>
                <p className="text-xs text-gray-500">Choose the tone for your outreach message</p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {TONE_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setTone(opt.value)}
                    className={cn(
                      'px-4 py-2 rounded-lg text-sm font-medium transition-all',
                      tone === opt.value ? toggleActive : toggleInactive
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* ─── Email Length ─── */}
            <div className="bg-white rounded-xl border border-gray-200/80 p-4 md:p-6 elevation-modal space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-1">Email Length</h3>
                <p className="text-xs text-gray-500">How detailed should the generated email be?</p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {LENGTH_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setEmailLength(opt.value)}
                    className={cn(
                      'px-4 py-2 rounded-lg text-sm font-medium transition-all',
                      emailLength === opt.value ? toggleActive : toggleInactive
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* ─── CTA Style ─── */}
            <div className="bg-white rounded-xl border border-gray-200/80 p-4 md:p-6 elevation-modal space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-1">CTA Style</h3>
                <p className="text-xs text-gray-500">How should the call-to-action be framed?</p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {CTA_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setCtaStyle(opt.value)}
                    className={cn(
                      'px-4 py-2 rounded-lg text-sm font-medium transition-all',
                      ctaStyle === opt.value ? toggleActive : toggleInactive
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* ─── Generate Button ─── */}
            <Button
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending}
              className="w-full h-12 bg-amber-600 hover:bg-amber-700 text-white rounded-xl press-scale shadow-xs text-base font-semibold gap-2"
            >
              {generateMutation.isPending ? (
                <>
                  <RefreshCw className="size-5 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="size-5" />
                  Generate Email
                </>
              )}
            </Button>

            {/* ─── Generated Draft ─── */}
            {hasDraft && (
              <div className="space-y-4 animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
                {/* Badges row */}
                <div className="flex items-center gap-3">
                  <Badge className={cn('text-[11px] font-semibold px-2.5 py-1', matchScoreBadgeClasses(lastMatchScore))}>
                    Match Score: {lastMatchScore != null ? `${lastMatchScore}%` : '—'}
                  </Badge>
                  <Badge className={cn('text-[11px] font-semibold px-2.5 py-1', confidenceBadgeClasses(lastConfidence))}>
                    Confidence: {lastConfidence ? lastConfidence.charAt(0).toUpperCase() + lastConfidence.slice(1) : '—'}
                  </Badge>
                </div>

                {/* Subject */}
                <div className="bg-white rounded-xl border border-gray-200/80 p-4 md:p-6 elevation-modal space-y-3">
                  <label className="text-sm font-medium text-gray-700 block">Subject Line</label>
                  <Input
                    value={generatedSubject}
                    onChange={e => setGeneratedSubject(e.target.value)}
                    className="border-gray-200 rounded-lg h-10 text-sm font-medium text-gray-900 focus-visible:ring-amber-500/20 focus-visible:border-amber-400"
                    placeholder="Email subject..."
                  />
                </div>

                {/* Body */}
                <div className="bg-gray-50/50 border border-gray-200/80 rounded-xl p-4 md:p-6">
                  <pre className="whitespace-pre-wrap text-sm text-gray-700 leading-relaxed font-sans">
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
                    <CheckCircle2 className="size-4" />
                    {lastDraftId ? 'Draft Auto-Saved' : 'Save as Draft'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}