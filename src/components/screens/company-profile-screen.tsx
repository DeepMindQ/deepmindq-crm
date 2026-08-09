'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, Building2, Globe, MapPin, Users, Plus, Target, StickyNote, FileText,
  Sparkles, Mail, Phone, ExternalLink, Linkedin, DollarSign, Calendar,
  CheckCircle2, Clock, BarChart3, Loader2, X, AlertTriangle, Trash2, Shield,
  ChevronRight, Cpu, Pencil, Zap, Brain, MessageSquare, Megaphone,
  TrendingUp, UserCheck, Crosshair, Lightbulb, RefreshCw, ShieldCheck,
  AlertCircle, Eye, Keyboard, ChevronDown, Ban, ShieldAlert,
} from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { formatDistanceToNow } from 'date-fns'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
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
import { ScoreTriple, type ScoreItem, getActivityIcon, StatusDot, EmptyState } from '@/components/shared/design-system'
import { ScreenBreadcrumb } from '@/components/shared/screen-breadcrumb'
import {
  getHealthVariant, getStatusBorder, getOppStatusVariant, getCompanyStatusVariant,
  DEFAULT_INDUSTRIES, EMPLOYEE_SIZES, ROLE_BUCKETS,
} from '@/lib/constants'
import { fetchApi } from '@/lib/fetchApi'
import { normalizeTierForDisplay, getTierColor } from '@/lib/intelligence-api/types'
import type {
  IntelligenceCompanyContext, IntelligenceSignal, IntelligenceContact, IntelligenceBrief,
} from '@/lib/intelligence-api/types'
import type { ActionResult, RecommendedAction } from '@/lib/engines/action-engine'
import Image from 'next/image'
import type { Company, Contact, Opportunity, CompanyNote, CompanyResearchCard, TimelineEntry, CompanyStatus } from '@/lib/types'

/* ═══════════════════════════════════════════════════════════════
   Constants & Helpers
   ═══════════════════════════════════════════════════════════════ */

const RESEARCH_LABELS: Record<string, { label: string; icon: React.ElementType }> = {
  businessOverview: { label: 'Business Overview', icon: Building2 },
  revenue: { label: 'Revenue', icon: DollarSign },
  employeeCount: { label: 'Employees', icon: Users },
  fundingStage: { label: 'Funding Stage', icon: Target },
  techStack: { label: 'Technology Stack', icon: Cpu },
  industry: { label: 'Industry', icon: BarChart3 },
  website: { label: 'Website', icon: Globe },
  enrichmentSource: { label: 'Data Source', icon: FileText },
  enrichmentDate: { label: 'Last Enriched', icon: Calendar },
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

/** Severity color mapping for signals */
const getSeverityVariant = (severity: string) => {
  switch (severity) {
    case 'critical': return 'bg-red-100 text-red-700 border-red-200'
    case 'high': return 'bg-orange-100 text-orange-700 border-orange-200'
    case 'medium': return 'bg-amber-100 text-amber-700 border-amber-200'
    case 'low': return 'bg-blue-100 text-blue-700 border-blue-200'
    default: return 'bg-gray-100 text-gray-600 border-gray-200'
  }
}

/** Urgency color mapping for actions */
const getUrgencyVariant = (urgency: string) => {
  switch (urgency) {
    case 'immediate': return 'bg-red-100 text-red-700 border-red-200'
    case 'high': return 'bg-orange-100 text-orange-700 border-orange-200'
    case 'medium': return 'bg-amber-100 text-amber-700 border-amber-200'
    case 'low': return 'bg-emerald-100 text-emerald-700 border-emerald-200'
    default: return 'bg-gray-100 text-gray-600 border-gray-200'
  }
}

/** Governance status badge — Design Bible §6.2 */
function GovernanceBadge({ status }: { status: 'verified' | 'needs_review' | 'failed' | 'not_evaluated' | null | undefined }) {
  if (!status || status === 'not_evaluated') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-gray-100 text-gray-500 border border-gray-200">
        <span className="size-1.5 rounded-full bg-gray-400" /> Not Evaluated
      </span>
    )
  }
  if (status === 'verified') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
        <ShieldCheck className="size-3" /> Verified
      </span>
    )
  }
  if (status === 'needs_review') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200">
        <AlertCircle className="size-3" /> Needs Review
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-red-50 text-red-700 border border-red-200">
      <ShieldAlert className="size-3" /> Governance Failed
    </span>
  )
}

/** Evidence grounding bar — Design Bible §6.3 */
function EvidenceGroundingBar({ warnings }: { warnings: string[] | undefined }) {
  const hasUnverified = warnings?.some(w => w.toLowerCase().includes('unverified') || w.toLowerCase().includes('hallucin'))
  if (!warnings || warnings.length === 0) {
    return (
      <div className="flex items-center gap-1.5 text-[10px] text-emerald-600 bg-emerald-50/60 border border-emerald-100 rounded-md px-2 py-1">
        <CheckCircle2 className="size-3" />
        Evidence grounded — no fabricated metrics
      </div>
    )
  }
  return (
    <div className="flex items-center gap-1.5 text-[10px] text-amber-600 bg-amber-50/60 border border-amber-100 rounded-md px-2 py-1">
      <AlertTriangle className="size-3" />
      Contains unverified claims — review recommended
    </div>
  )
}

/** AI Footer — Design Bible §6.4 */
function AIFooter({ model, durationMs }: { model?: string; durationMs?: number }) {
  if (!model && !durationMs) return null
  return (
    <p className="text-[10px] text-gray-400 mt-2 italic">
      Generated by DeepMindQ{model ? ` · ${model}` : ''}{durationMs ? ` · ${(durationMs / 1000).toFixed(1)}s` : ''}
    </p>
  )
}

/** Section error state with retry — Design Bible §1.6 */
function SectionError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50/40 p-6 text-center">
      <AlertCircle className="size-6 text-red-400 mx-auto mb-2" />
      <p className="text-sm text-red-700 font-medium">{message}</p>
      <Button size="sm" variant="outline" className="mt-2 border-red-200 text-red-600 hover:bg-red-50 rounded-md text-xs" onClick={onRetry}>
        <RefreshCw className="size-3 mr-1" /> Retry
      </Button>
    </div>
  )
}

/** Narrative divider between Q sections — Design Bible §1.5
 *  These are chapter breaks in an intelligence story.
 *  The transition text provides emotional pacing between cognitive stages. */
function NarrativeDivider({ label, subtitle, color, transition }: { label: string; subtitle: string; color: string; transition?: string }) {
  const colorMap: Record<string, { text: string; icon: string; bg: string }> = {
    blue: { text: 'text-blue-700', icon: 'text-blue-500', bg: 'bg-blue-50' },
    violet: { text: 'text-violet-700', icon: 'text-violet-500', bg: 'bg-violet-50' },
    emerald: { text: 'text-emerald-700', icon: 'text-emerald-500', bg: 'bg-emerald-50' },
    amber: { text: 'text-amber-700', icon: 'text-amber-500', bg: 'bg-amber-50' },
    rose: { text: 'text-rose-700', icon: 'text-rose-500', bg: 'bg-rose-50' },
  }
  const c = colorMap[color] || colorMap.blue
  return (
    <div className="space-y-1.5 py-2">
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-gray-200" />
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${c.bg}`}>
          <p className={`text-xs font-bold uppercase tracking-wider ${c.text}`}>{label}</p>
          <span className="text-gray-300">·</span>
          <p className="text-[10px] text-gray-500">{subtitle}</p>
        </div>
        <div className="h-px flex-1 bg-gray-200" />
      </div>
      {transition && (
        <p className="text-center text-[11px] text-gray-400 italic">{transition}</p>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   Progressive Disclosure Hook — lazy-RENDERS section when visible
   (Data comes from parent one-shot fetch, NOT per-section API calls)
   Design Bible §4.2: One-shot fetch, progressive RENDER
   ═══════════════════════════════════════════════════════════════ */

function useSectionVisible(sectionId: string) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect() } },
      { rootMargin: '200px 0px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [sectionId])

  return { ref, visible }
}

/* ═══════════════════════════════════════════════════════════════
   Q1: What Changed? — Signal Timeline
   Architecture T7: SignalTimeline component
   Design Bible §4.2: Data passed as props from one-shot fetch
   ═══════════════════════════════════════════════════════════════ */

function Q1WhatChanged({
  signals,
  loading,
  error,
  onRetry,
  governanceStatus,
}: {
  signals: IntelligenceSignal[]
  loading: boolean
  error: string | null
  onRetry: () => void
  governanceStatus?: 'verified' | 'needs_review' | 'failed' | 'not_evaluated' | null
}) {
  const { ref, visible } = useSectionVisible('q1')

  return (
    <div ref={ref} id="q1-what-changed" className="space-y-5">
      {/* Section Header */}
      <div className="flex items-center gap-3">
        <div className="flex size-10 rounded-xl bg-blue-50 items-center justify-center">
          <Zap className="size-5 text-blue-600" />
        </div>
        <div>
          <h3 className="text-base font-bold text-gray-900">Q1: What Changed?</h3>
          <p className="text-xs text-gray-500">Latest signals, news, and people movements</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <GovernanceBadge status={governanceStatus} />
          <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
            {signals.length} signal{signals.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {error ? (
        <SectionError message={error} onRetry={onRetry} />
      ) : loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
        </div>
      ) : signals.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 p-8 text-center">
          <Zap className="size-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">No active signals detected yet</p>
          <p className="text-xs text-gray-400 mt-1">Signals will appear here as the intelligence engine detects changes</p>
        </div>
      ) : visible ? (
        <div className="relative pl-6">
          <div className="absolute left-[7px] top-2 bottom-2 border-l-2 border-blue-200" />
          <div className="space-y-3">
            {signals.map((signal, idx) => (
              <div key={signal.id} className="relative flex items-start gap-4 slide-up" style={{ animationDelay: `${idx * 40}ms` }}>
                <div className="absolute -left-6 top-2 size-3 rounded-full bg-white ring-4 ring-white border-2 border-blue-400" />
                <div className="flex-1 rounded-xl bg-white border border-gray-100 p-4 card-rest min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-gray-900">{signal.title}</p>
                        <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase border ${getSeverityVariant(signal.severity)}`}>
                          {signal.severity}
                        </span>
                      </div>
                      {signal.summary && (
                        <p className="text-xs text-gray-500 mt-1.5 line-clamp-2">{signal.summary}</p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[11px] text-gray-400">{formatDistanceToNow(new Date(signal.createdAt), { addSuffix: true })}</p>
                      {signal.confidence > 0 && (
                        <p className="text-[11px] text-gray-500 mt-0.5">{Math.round(signal.confidence * 100)}% confidence</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 mt-2">
                    {signal.signalType && (
                      <Badge className="bg-gray-50 text-gray-600 hover:bg-gray-50 text-[10px] font-medium border-0 rounded-md">
                        {signal.signalType.replace(/_/g, ' ')}
                      </Badge>
                    )}
                    {signal.evidenceCount > 0 && (
                      <span className="text-[11px] text-gray-400">{signal.evidenceCount} evidence items</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
        </div>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   Q2: Why Does It Matter? — Enterprise Reasoning + Impact
   Architecture T7: ReasoningSummary component
   GAP FIX 3: Added impact assessment, reasoning summary
   ═══════════════════════════════════════════════════════════════ */

function Q2WhyMatters({
  brief,
  actions,
  loading,
  error,
  onRetry,
  governanceStatus,
}: {
  brief: IntelligenceBrief | undefined
  actions: ActionResult | undefined
  loading: boolean
  error: string | null
  onRetry: () => void
  governanceStatus?: 'verified' | 'needs_review' | 'failed' | 'not_evaluated' | null
}) {
  const { ref, visible } = useSectionVisible('q2')

  return (
    <div ref={ref} id="q2-why-matters" className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="flex size-10 rounded-xl bg-violet-50 items-center justify-center">
          <Brain className="size-5 text-violet-600" />
        </div>
        <div>
          <h3 className="text-base font-bold text-gray-900">Q2: Why Does It Matter?</h3>
          <p className="text-xs text-gray-500">Enterprise reasoning, impact assessment, and strategic context</p>
        </div>
        <div className="ml-auto">
          <GovernanceBadge status={governanceStatus} />
        </div>
      </div>

      {error ? (
        <SectionError message={error} onRetry={onRetry} />
      ) : loading ? (
        <Skeleton className="h-48 w-full rounded-xl" />
      ) : !brief && !actions?.accountStrategy ? (
        <div className="rounded-xl border border-dashed border-gray-200 p-8 text-center">
          <Brain className="size-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">No AI reasoning generated yet</p>
          <p className="text-xs text-gray-400 mt-1">Run intelligence analysis to see strategic insights</p>
        </div>
      ) : visible ? (
        <div className="space-y-4">
          {/* Evidence grounding bar — Design Bible §6.3 */}
          {(brief?.warnings || actions) && (
            <EvidenceGroundingBar warnings={brief?.warnings} />
          )}

          {/* Detected Sales Motion */}
          {actions?.detectedSalesMotion && (
            <div className="rounded-xl bg-violet-50 border border-violet-100 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Megaphone className="size-3.5 text-violet-600" />
                <p className="text-xs font-bold text-violet-800 uppercase tracking-wider">Detected Sales Motion</p>
              </div>
              <p className="text-sm text-violet-900 font-medium capitalize">{String(actions.detectedSalesMotion).replace(/_/g, ' ')}</p>
            </div>
          )}

          {/* Account Strategy — GAP FIX 3: Impact assessment */}
          {actions?.accountStrategy && (
            <div className="rounded-xl bg-white border border-gray-100 p-5">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="size-3.5 text-gray-600" />
                <p className="text-xs font-bold text-gray-700 uppercase tracking-wider">Account Strategy & Impact Assessment</p>
              </div>
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{String(actions.accountStrategy)}</p>
            </div>
          )}

          {/* Brief Sections with confidence and AI footer */}
          {brief?.sections && brief.sections.length > 0 && (
            <div className="space-y-3">
              {brief.sections.map((section, idx) => (
                <div key={idx} className="rounded-xl bg-white border border-gray-100 p-5">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-bold text-gray-700 uppercase tracking-wider">{section.heading}</p>
                    {section.confidence > 0 && (
                      <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                        section.confidence >= 0.7 ? 'bg-emerald-50 text-emerald-700' :
                        section.confidence >= 0.4 ? 'bg-amber-50 text-amber-700' :
                        'bg-red-50 text-red-700'
                      }`}>
                        {Math.round(section.confidence * 100)}% confidence
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{section.body}</p>
                  {/* AI Footer — Design Bible §6.4 */}
                  {idx === 0 && (
                    <AIFooter model={brief.modelUsed} durationMs={brief.durationMs} />
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Trigger signals — context for why this matters */}
          {actions?.triggerSignals && actions.triggerSignals.length > 0 && (
            <div className="rounded-xl bg-gray-50 border border-gray-100 p-4">
              <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">Trigger Signals ({actions.triggerSignals.length})</p>
              <div className="flex flex-wrap gap-1.5">
                {actions.triggerSignals.slice(0, 8).map((s, i) => (
                  <Badge key={i} className="bg-white text-gray-600 hover:bg-white text-[10px] font-medium border border-gray-200 rounded-md">{s}</Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <Skeleton className="h-48 w-full rounded-xl" />
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   Q3: Who Should We Engage? — Buying Committee + Influence
   Architecture T7: BuyingCommittee component
   GAP FIX 4: Added buyingRole classification, influence scores,
   engagement signal indicators
   ═══════════════════════════════════════════════════════════════ */

const BUYING_ROLE_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  decision_maker: { label: 'Decision Maker', color: 'bg-red-100 text-red-700 border-red-200', icon: Target },
  champion: { label: 'Champion', color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: UserCheck },
  influencer: { label: 'Influencer', color: 'bg-blue-100 text-blue-700 border-blue-200', icon: MessageSquare },
  blocker: { label: 'Blocker', color: 'bg-gray-100 text-gray-600 border-gray-200', icon: Ban },
  budget_holder: { label: 'Budget Holder', color: 'bg-amber-100 text-amber-700 border-amber-200', icon: DollarSign },
}

function getBuyingRoleLabel(role: string | null | undefined): string {
  if (!role) return 'Unidentified'
  const mapped = role.toLowerCase().replace(/\s+/g, '_')
  for (const [key, val] of Object.entries(BUYING_ROLE_CONFIG)) {
    if (mapped.includes(key)) return val.label
  }
  if (mapped.includes('exec') || mapped.includes('vp') || mapped.includes('cfo') || mapped.includes('cto') || mapped.includes('ceo')) return 'Decision Maker'
  if (mapped.includes('director') || mapped.includes('senior')) return 'Influencer'
  return 'Unidentified'
}

function getBuyingRoleColor(role: string | null | undefined): string {
  if (!role) return 'bg-gray-100 text-gray-500 border-gray-200'
  const mapped = role.toLowerCase().replace(/\s+/g, '_')
  for (const [key, val] of Object.entries(BUYING_ROLE_CONFIG)) {
    if (mapped.includes(key)) return val.color
  }
  if (mapped.includes('exec') || mapped.includes('vp') || mapped.includes('cfo') || mapped.includes('cto') || mapped.includes('ceo')) return BUYING_ROLE_CONFIG.decision_maker.color
  if (mapped.includes('director') || mapped.includes('senior')) return BUYING_ROLE_CONFIG.influencer.color
  return 'bg-gray-100 text-gray-500 border-gray-200'
}

function Q3WhoEngage({
  contacts,
  keyPeople,
  loading,
  error,
  onRetry,
  onViewContact,
  onGenerateEmail,
}: {
  contacts: IntelligenceContact[]
  keyPeople: Array<{ name: string; title: string; department?: string }>
  loading: boolean
  error: string | null
  onRetry: () => void
  onViewContact: (id: string) => void
  onGenerateEmail: (id: string) => void
}) {
  const { ref, visible } = useSectionVisible('q3')

  // Merge intelligence contacts with key people from research
  const buyingCommittee = contacts.length > 0 ? contacts.map(c => ({
    id: c.id,
    name: c.rawName,
    title: c.title || 'Unknown Role',
    role: c.role,
    email: c.email,
    phone: c.phone,
    leadScore: c.leadScore,
    confidence: c.confidence,
    status: c.status,
    lastActivityAt: c.lastActivityAt,
  })) : keyPeople.map((p, i) => ({
    id: `kp-${i}`,
    name: p.name,
    title: p.title,
    role: p.department,
    email: null,
    phone: null,
    leadScore: 0,
    confidence: 0,
    status: 'research',
    lastActivityAt: null,
  }))

  const sortedCommittee = [...buyingCommittee].sort((a, b) => b.leadScore - a.leadScore)

  return (
    <div ref={ref} id="q3-who-engage" className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="flex size-10 rounded-xl bg-emerald-50 items-center justify-center">
          <UserCheck className="size-5 text-emerald-600" />
        </div>
        <div>
          <h3 className="text-base font-bold text-gray-900">Q3: Who Should We Engage?</h3>
          <p className="text-xs text-gray-500">Buying committee, contacts, and influence mapping</p>
        </div>
        <div className="ml-auto">
          <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
            {sortedCommittee.length} contact{sortedCommittee.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {error ? (
        <SectionError message={error} onRetry={onRetry} />
      ) : loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
        </div>
      ) : sortedCommittee.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 p-8 text-center">
          <UserCheck className="size-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">No contacts identified yet</p>
          <p className="text-xs text-gray-400 mt-1">Add contacts or run research to identify the buying committee</p>
        </div>
      ) : visible ? (
        <div className="space-y-2">
          {/* Buying Committee Header */}
          <div className="flex items-center gap-2 px-1">
            <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Buying Committee</p>
            <p className="text-[11px] text-gray-400">(sorted by lead score)</p>
          </div>
          {sortedCommittee.map((person, idx) => {
            const buyingRole = getBuyingRoleLabel(person.role)
            const buyingRoleColor = getBuyingRoleColor(person.role)
            const hasRecentActivity = person.lastActivityAt
              ? (Date.now() - new Date(person.lastActivityAt).getTime()) < 30 * 24 * 60 * 60 * 1000
              : false
            return (
              <div
                key={person.id}
                className={`flex items-center gap-4 rounded-xl bg-white border border-gray-100 p-4 card-rest cursor-pointer group slide-up ${
                  idx === 0 ? 'ring-1 ring-amber-200 border-amber-100' : ''
                }`}
                style={{ animationDelay: `${idx * 30}ms` }}
                onClick={() => { if (person.email) onViewContact(person.id) }}
              >
                {/* Rank Badge */}
                <div className={`flex size-8 rounded-lg items-center justify-center text-xs font-bold shrink-0 ${
                  idx === 0 ? 'bg-amber-100 text-amber-700' : idx === 1 ? 'bg-gray-100 text-gray-600' : 'bg-gray-50 text-gray-400'
                }`}>
                  {idx + 1}
                </div>

                {/* Avatar */}
                <div className="flex size-9 rounded-full bg-gray-100 items-center justify-center shrink-0 text-xs font-semibold text-gray-600">
                  {person.name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-gray-900 group-hover:text-amber-700 transition-colors truncate">{person.name}</p>
                    {idx === 0 && (
                      <Badge className="bg-amber-50 text-amber-700 hover:bg-amber-50 text-[10px] font-bold border-0 rounded-md">PRIMARY</Badge>
                    )}
                    {/* GAP FIX 4: Buying Role badge */}
                    <Badge className={`text-[10px] font-medium border rounded-md ${buyingRoleColor}`}>
                      {buyingRole}
                    </Badge>
                  </div>
                  <p className="text-xs text-gray-500 truncate">{person.title}{person.role && person.title !== person.role ? ` · ${person.role}` : ''}</p>
                </div>

                {/* GAP FIX 4: Engagement signal indicator */}
                {hasRecentActivity && (
                  <div className="shrink-0" title="Recent engagement activity">
                    <div className="flex items-center gap-1 text-emerald-500">
                      <div className="size-2 rounded-full bg-emerald-400 animate-pulse" />
                    </div>
                  </div>
                )}

                {/* Lead Score */}
                <div className="shrink-0 text-right">
                  <div className={`text-sm font-bold tabular-nums ${
                    person.leadScore >= 70 ? 'text-emerald-600' : person.leadScore >= 40 ? 'text-amber-600' : 'text-gray-400'
                  }`}>
                    {person.leadScore > 0 ? person.leadScore : '—'}
                  </div>
                  <p className="text-[10px] text-gray-400 uppercase">score</p>
                </div>

                {/* Action */}
                {person.email && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs text-gray-600 hover:text-amber-600 hover:bg-amber-50 rounded-md shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => { e.stopPropagation(); onGenerateEmail(person.id) }}
                  >
                    <Mail className="size-3.5 mr-1" /> Email
                  </Button>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
        </div>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   Q4: What Should We Say? — Conversation Prep + Talking Points
   Architecture T7: ConversationPrep component
   GAP FIX 5: Added objection handling cards
   ═══════════════════════════════════════════════════════════════ */

/** Sample objection handling cards — architecture says "objection cards" */
function generateObjectionCards(brief: IntelligenceBrief | undefined): Array<{ objection: string; response: string }> {
  if (!brief?.content) return []
  // Extract objection-related lines from brief content if present
  const lines = brief.content.split('\n')
  const objections: Array<{ objection: string; response: string }> = []

  for (const line of lines) {
    const objMatch = line.match(/objection[:\s]+(.+?)(?:\||$)/i)
    const respMatch = line.match(/response[:\s]+(.+?)(?:\||$)/i)
    if (objMatch) {
      objections.push({
        objection: objMatch[1].trim(),
        response: respMatch ? respMatch[1].trim() : '',
      })
    }
  }

  // If no structured objection data found, derive from brief warnings
  if (objections.length === 0 && brief?.warnings?.length) {
    const riskWarnings = brief.warnings.filter(w =>
      w.toLowerCase().includes('risk') || w.toLowerCase().includes('objection') || w.toLowerCase().includes('concern')
    )
    for (const w of riskWarnings.slice(0, 3)) {
      objections.push({
        objection: w,
        response: 'Address by leading with evidence-based insights from the intelligence brief. Reference specific data points that counter this concern.',
      })
    }
  }

  return objections.slice(0, 4)
}

function Q4WhatSay({
  brief,
  capabilities,
  loading,
  error,
  onRetry,
  onGenerateEmail,
}: {
  brief: IntelligenceBrief | undefined
  capabilities: Array<Record<string, unknown>>
  loading: boolean
  error: string | null
  onRetry: () => void
  onGenerateEmail: (contactId: string) => void
}) {
  const { ref, visible } = useSectionVisible('q4')

  // Extract talking points from brief content
  const talkingPoints: string[] = []
  if (brief?.content) {
    const lines = brief.content.split('\n').filter(l => l.trim().startsWith('- '))
    for (const line of lines.slice(0, 6)) {
      talkingPoints.push(line.replace(/^-\s*/, '').trim())
    }
  }

  // GAP FIX 5: Generate objection cards
  const objectionCards = generateObjectionCards(brief)

  return (
    <div ref={ref} id="q4-what-say" className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="flex size-10 rounded-xl bg-amber-50 items-center justify-center">
          <MessageSquare className="size-5 text-amber-600" />
        </div>
        <div>
          <h3 className="text-base font-bold text-gray-900">Q4: What Should We Say?</h3>
          <p className="text-xs text-gray-500">Conversation prep, talking points, and capability matches</p>
        </div>
      </div>

      {error ? (
        <SectionError message={error} onRetry={onRetry} />
      ) : loading ? (
        <Skeleton className="h-48 w-full rounded-xl" />
      ) : !brief && capabilities.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 p-8 text-center">
          <MessageSquare className="size-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">No conversation prep generated yet</p>
          <p className="text-xs text-gray-400 mt-1">The AI conversation engine will create talking points based on intelligence data</p>
        </div>
      ) : visible ? (
        <div className="space-y-4">
          {/* Evidence grounding bar — Design Bible §6.3 */}
          <EvidenceGroundingBar warnings={brief?.warnings} />

          {/* Conversation Brief Summary */}
          {brief && (
            <div className="rounded-xl bg-white border border-gray-100 p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Lightbulb className="size-3.5 text-amber-500" />
                  <p className="text-xs font-bold text-gray-700 uppercase tracking-wider">AI Conversation Brief</p>
                </div>
                {brief.confidence > 0 && (
                  <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                    brief.confidence >= 0.7 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                  }`}>
                    {Math.round(brief.confidence * 100)}% confidence
                  </span>
                )}
              </div>
              {/* Brief body (first section) */}
              {brief.sections?.[0]?.body && (
                <p className="text-sm text-gray-700 leading-relaxed">{brief.sections[0].body}</p>
              )}
              <AIFooter model={brief.modelUsed} durationMs={brief.durationMs} />
            </div>
          )}

          {/* Talking Points */}
          {talkingPoints.length > 0 && (
            <div className="rounded-xl bg-gradient-to-br from-amber-50/80 to-orange-50/40 border border-amber-100/60 p-5">
              <p className="text-xs font-bold text-amber-800 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Crosshair className="size-3.5" />
                Talking Points
              </p>
              <div className="space-y-2">
                {talkingPoints.map((point, idx) => (
                  <div key={idx} className="flex items-start gap-2.5">
                    <div className="flex size-5 rounded-full bg-amber-100 items-center justify-center shrink-0 mt-0.5">
                      <span className="text-[10px] font-bold text-amber-700">{idx + 1}</span>
                    </div>
                    <p className="text-sm text-gray-800 leading-relaxed">{point}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* GAP FIX 5: Objection Handling Cards */}
          {objectionCards.length > 0 && (
            <div className="rounded-xl bg-gradient-to-br from-red-50/60 to-orange-50/30 border border-red-100/50 p-5">
              <p className="text-xs font-bold text-red-800 uppercase tracking-wider mb-3 flex items-center gap-2">
                <ShieldAlert className="size-3.5" />
                Objection Handling
                <span className="text-[10px] font-normal text-gray-500 normal-case">{objectionCards.length} objection{objectionCards.length !== 1 ? 's' : ''}</span>
              </p>
              <div className="space-y-3">
                {objectionCards.map((obj, idx) => (
                  <div key={idx} className="rounded-lg bg-white/80 border border-red-100/50 p-3.5">
                    <p className="text-sm font-medium text-gray-900 flex items-start gap-2">
                      <Ban className="size-3.5 text-red-400 mt-0.5 shrink-0" />
                      {obj.objection}
                    </p>
                    {obj.response && (
                      <p className="text-xs text-gray-600 mt-2 ml-5.5 pl-1 border-l-2 border-amber-200 leading-relaxed">
                        {obj.response}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Capability Matches */}
          {capabilities.length > 0 && (
            <div className="rounded-xl bg-white border border-gray-100 p-5">
              <p className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Sparkles className="size-3.5 text-amber-500" />
                Capability Matches
                <span className="text-[10px] font-normal text-gray-400 normal-case">{capabilities.length} match{capabilities.length !== 1 ? 'es' : ''}</span>
              </p>
              <div className="grid gap-2 md:grid-cols-2">
                {capabilities.slice(0, 6).map((cap) => (
                  <div key={String(cap.id)} className="rounded-lg border border-gray-100 p-3 bg-gray-50/50">
                    <p className="text-sm font-medium text-gray-900">{String(cap.title)}</p>
                    {cap.summary != null && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{String(cap.summary)}</p>}
                    {cap.serviceLine != null && (
                      <Badge className="mt-1.5 bg-blue-50 text-blue-600 hover:bg-blue-50 text-[10px] font-medium border-0 rounded-md">{String(cap.serviceLine)}</Badge>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <Skeleton className="h-48 w-full rounded-xl" />
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   Q5: What Should We Do? — Actions + Opportunities
   Architecture T7: ActionList component
   GAP FIX 6: Added action status tracking (dismiss/snooze)
   ═══════════════════════════════════════════════════════════════ */

function Q5WhatDo({
  actions,
  opportunities,
  loading,
  error,
  onRetry,
}: {
  actions: ActionResult | undefined
  opportunities: Opportunity[]
  loading: boolean
  error: string | null
  onRetry: () => void
}) {
  const { ref, visible } = useSectionVisible('q5')
  const actionList: RecommendedAction[] = actions?.success ? (actions.actions || []) : []
  const primaryAction = actions?.success ? actions.primaryAction : null

  // GAP FIX 6: Local action dismissal state
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set())
  const toggleDismiss = (id: string) => {
    setDismissedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const visibleActions = actionList.filter(a => !dismissedIds.has(a.id))

  return (
    <div ref={ref} id="q5-what-do" className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="flex size-10 rounded-xl bg-rose-50 items-center justify-center">
          <Crosshair className="size-5 text-rose-600" />
        </div>
        <div>
          <h3 className="text-base font-bold text-gray-900">Q5: What Should We Do?</h3>
          <p className="text-xs text-gray-500">Next best actions, opportunities, and recommended sequences</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {visibleActions.length > 0 && (
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-rose-50 text-rose-700">
              {visibleActions.length} action{visibleActions.length !== 1 ? 's' : ''}
            </span>
          )}
          {dismissedIds.size > 0 && (
            <Button size="sm" variant="ghost" className="h-6 text-[10px] text-gray-400 hover:text-gray-600" onClick={() => setDismissedIds(new Set())}>
              Show dismissed ({dismissedIds.size})
            </Button>
          )}
        </div>
      </div>

      {error ? (
        <SectionError message={error} onRetry={onRetry} />
      ) : loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
        </div>
      ) : visibleActions.length === 0 && opportunities.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 p-8 text-center">
          <Crosshair className="size-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">No actions recommended yet</p>
          <p className="text-xs text-gray-400 mt-1">
            {actions && !actions.success
              ? 'Action engine returned an error. Try re-running intelligence analysis.'
              : 'The AI action engine will analyze signals and contacts to recommend next steps.'}
          </p>
        </div>
      ) : visible ? (
        <div className="space-y-4">
          {/* Evidence grounding bar */}
          {actions?.success && (
            <EvidenceGroundingBar warnings={undefined} />
          )}

          {/* Recommended Actions */}
          {visibleActions.length > 0 && (
            <div>
              <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2 px-1">Recommended Actions</p>
              <div className="space-y-2">
                {visibleActions.map((action, idx) => {
                  const isPrimary = primaryAction?.id === action.id || idx === 0
                  return (
                    <div
                      key={action.id}
                      className={`rounded-xl bg-white border border-gray-100 p-4 card-rest slide-up ${
                        isPrimary ? 'ring-1 ring-amber-200 border-amber-100' : ''
                      }`}
                      style={{ animationDelay: `${idx * 30}ms` }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            {isPrimary && (
                              <Badge className="bg-amber-50 text-amber-700 hover:bg-amber-50 text-[10px] font-bold border-0 rounded-md">BEST ACTION</Badge>
                            )}
                            <p className="text-sm font-semibold text-gray-900">{action.title}</p>
                            <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase border ${getUrgencyVariant(action.urgency)}`}>
                              {action.urgency}
                            </span>
                            {/* GAP FIX 6: Confidence badge */}
                            {action.confidence > 0 && (
                              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                                action.confidence >= 70 ? 'bg-emerald-50 text-emerald-700' :
                                action.confidence >= 40 ? 'bg-amber-50 text-amber-700' :
                                'bg-gray-100 text-gray-500'
                              }`}>
                                {Math.round(action.confidence)}% conf.
                              </span>
                            )}
                          </div>
                          {action.reason && (
                            <p className="text-xs text-gray-500 mt-1">{action.reason}</p>
                          )}
                          {action.concreteStep && (
                            <div className="mt-2 flex items-start gap-2 bg-gray-50 rounded-lg p-2.5">
                              <ChevronRight className="size-3 text-amber-500 mt-0.5 shrink-0" />
                              <p className="text-xs text-gray-700">{action.concreteStep}</p>
                            </div>
                          )}
                          {action.suggestedMessage && (
                            <div className="mt-2 bg-blue-50/50 border border-blue-100 rounded-lg p-2.5">
                              <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider mb-1">Suggested Message</p>
                              <p className="text-xs text-blue-900 leading-relaxed line-clamp-3">{action.suggestedMessage}</p>
                            </div>
                          )}
                          <div className="flex items-center gap-3 mt-2">
                            {action.targetContact && (
                              <span className="text-[11px] text-gray-400 flex items-center gap-1">
                                <Users className="size-3" /> {action.targetContact}
                              </span>
                            )}
                            {action.salesMotion && (
                              <Badge className="bg-gray-50 text-gray-500 hover:bg-gray-50 text-[10px] font-medium border-0 rounded-md">
                                {String(action.salesMotion).replace(/_/g, ' ')}
                              </Badge>
                            )}
                          </div>
                        </div>
                        {/* GAP FIX 6: Dismiss action */}
                        <button
                          onClick={() => toggleDismiss(action.id)}
                          className="shrink-0 p-1 text-gray-300 hover:text-red-400 transition-colors rounded-md hover:bg-red-50"
                          title="Dismiss this action"
                        >
                          <X className="size-3.5" />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Active Opportunities */}
          {opportunities.length > 0 && (
            <div>
              <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2 px-1">
                Active Opportunities
                <span className="text-gray-400 font-normal normal-case ml-1">({opportunities.length})</span>
              </p>
              <div className="space-y-2">
                {opportunities.map((o) => (
                  <div
                    key={o.id}
                    className={`rounded-xl bg-white card-interactive border-l-[3px] ${getStatusBorder(o.status)} p-4 flex items-center justify-between gap-3`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-900">{o.title}</p>
                      {o.nextAction && (
                        <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                          <ChevronRight className="size-3 text-amber-600" /> {o.nextAction}
                        </p>
                      )}
                    </div>
                    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium capitalize border ${getOppStatusVariant(o.status)}`}>
                      {o.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI Footer for actions */}
          {actions?.success && (
            <AIFooter model={actions.modelUsed} durationMs={actions.durationMs} />
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
        </div>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   Intelligence Health Tab (preserved from Phase 6)
   ═══════════════════════════════════════════════════════════════ */

function IntelligenceTab({ companyId }: { companyId: string }) {
  const [validating, setValidating] = useState(false)

  const { data: health, isLoading: healthLoading } = useQuery({
    queryKey: ['intel-health', companyId],
    queryFn: async () => {
      const r = await fetch(`/api/g-intelligence/companies/${companyId}/health`)
      if (!r.ok) throw new Error('Not calculated')
      return r.json()
    },
    retry: false,
  })

  const { data: report, isLoading: reportLoading } = useQuery({
    queryKey: ['intel-report', companyId],
    queryFn: () => fetch(`/api/g-intelligence/companies/${companyId}/validation-report`).then(r => r.json()),
    retry: false,
  })

  const qc = useQueryClient()
  const handleValidate = async () => {
    setValidating(true)
    try {
      const res = await fetch(`/api/g-intelligence/companies/${companyId}/validate`, { method: 'POST' })
      if (!res.ok) throw new Error('Validation failed')
      toast.success('Validation complete')
      await Promise.all([qc.invalidateQueries({ queryKey: ['intel-health', companyId] }), qc.invalidateQueries({ queryKey: ['intel-report', companyId] })])
    } catch { toast.error('Validation failed') }
    finally { setValidating(false) }
  }

  const getTierLabel = (score: number) => score >= 90 ? 'EXCELLENT' : score >= 70 ? 'GOOD' : score >= 50 ? 'FAIR' : 'POOR'
  const getTierColorLocal = (score: number) => score >= 90 ? 'text-emerald-600 bg-emerald-50' : score >= 70 ? 'text-blue-600 bg-blue-50' : score >= 50 ? 'text-amber-600 bg-amber-50' : 'text-red-600 bg-red-50'

  const fieldCoverage = health?.fieldCoverage as Record<string, boolean> | null
  const FIELD_LABELS: Record<string, string> = { industry: 'Industry', revenue: 'Revenue', employeeCount: 'Employees', techStack: 'Tech Stack', fundingStage: 'Funding', businessOverview: 'Overview', website: 'Website', location: 'Location', country: 'Country', contacts: 'Contacts', signals: 'Signals', evidence: 'Evidence' }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white rounded-lg press-scale" onClick={handleValidate} disabled={validating}>
          {validating ? <Loader2 className="size-3.5 mr-1.5 animate-spin" /> : <Sparkles className="size-3.5 mr-1.5" />}
          Run Full Validation
        </Button>
      </div>

      {healthLoading ? <Skeleton className="h-40 w-full rounded-xl" /> : !health ? (
        <div className="text-center py-12 text-gray-400">
          <Shield className="size-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No health data yet. Click &quot;Run Full Validation&quot; to calculate.</p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-semibold text-gray-800">Overall Intelligence Health</span>
              <span className={`px-3 py-1 rounded-full text-xs font-bold ${getTierColorLocal(health.overallHealthScore)}`}>
                {health.overallHealthScore}% — {getTierLabel(health.overallHealthScore)}
              </span>
            </div>
            <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-500 ${health.overallHealthScore >= 70 ? 'bg-emerald-500' : health.overallHealthScore >= 50 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${health.overallHealthScore}%` }} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {[
              { label: 'Data Completeness', score: health.dataCompletenessScore, detail: `${health.filledFields}/${health.totalTrackedFields} fields` },
              { label: 'Signal Coverage', score: health.signalCoverageScore, detail: `${health.activeSignals} active / ${health.totalSignals} total` },
              { label: 'Evidence Quality', score: health.evidenceCoverageScore, detail: `${health.activeEvidence} active / ${health.totalEvidence} total` },
              { label: 'Contact Coverage', score: health.contactCoverageScore, detail: `${health.totalContacts} contacts` },
            ].map(item => (
              <div key={item.label} className="bg-white rounded-xl border border-gray-100 p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{item.label}</span>
                  <span className={`text-lg font-bold ${item.score >= 70 ? 'text-emerald-600' : item.score >= 50 ? 'text-amber-600' : 'text-red-600'}`}>{item.score}%</span>
                </div>
                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${item.score >= 70 ? 'bg-emerald-500' : item.score >= 50 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${item.score}%` }} />
                </div>
                <p className="text-xs text-gray-400 mt-1.5">{item.detail}</p>
              </div>
            ))}
          </div>

          {fieldCoverage && (
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <h3 className="text-sm font-semibold text-gray-800 mb-3">Field Coverage</h3>
              <div className="grid grid-cols-4 gap-2">
                {Object.entries(FIELD_LABELS).map(([key, label]) => (
                  <div key={key} className="flex items-center gap-2 text-sm">
                    {fieldCoverage[key] ? <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" /> : <X className="size-3.5 text-red-400 shrink-0" />}
                    <span className={fieldCoverage[key] ? 'text-gray-700' : 'text-gray-400'}>{label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {report && (
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white rounded-xl border border-gray-100 p-5">
                <h3 className="text-sm font-semibold text-gray-800 mb-3">Signal Validation Summary</h3>
                <div className="flex gap-4">
                  {[
                    { label: 'VALID', count: report.signalValidationSummary.valid, color: 'text-emerald-600 bg-emerald-50' },
                    { label: 'WEAK', count: report.signalValidationSummary.weak, color: 'text-amber-600 bg-amber-50' },
                    { label: 'CONFLICTING', count: report.signalValidationSummary.conflicting, color: 'text-orange-600 bg-orange-50' },
                    { label: 'EXPIRED', count: report.signalValidationSummary.expired, color: 'text-gray-500 bg-gray-100' },
                  ].map(s => (
                    <div key={s.label} className="text-center">
                      <div className={`text-xl font-bold ${s.color.split(' ')[0]}`}>{s.count}</div>
                      <div className="text-[11px] text-gray-500 uppercase">{s.label}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-white rounded-xl border border-gray-100 p-5">
                <h3 className="text-sm font-semibold text-gray-800 mb-3">Active Conflicts</h3>
                {report.topConflicts.length === 0 ? (
                  <p className="text-sm text-gray-400">No open conflicts detected</p>
                ) : (
                  <div className="space-y-2">
                    {report.topConflicts.map((c: { id: string; conflictType: string; description: string; severity: string }) => (
                      <div key={c.id} className="flex items-start gap-2 p-2 rounded-lg bg-orange-50 border border-orange-100">
                        <AlertTriangle className="size-3.5 text-orange-500 mt-0.5 shrink-0" />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-orange-700">{c.conflictType.replace(/_/g, ' ')}</span>
                            <span className={`text-[11px] px-1.5 py-0.5 rounded font-bold ${c.severity === 'high' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>{c.severity.toUpperCase()}</span>
                          </div>
                          <p className="text-xs text-gray-600 mt-0.5 line-clamp-2">{c.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   Company Profile Screen — 5Q Workspace
   ═══════════════════════════════════════════════════════════════ */

export default function CompanyProfileScreen() {
  const { selectedCompanyId, setSelectedContactId, setActiveView } = useAppStore()
  const qc = useQueryClient()

  // ── View mode: '5q' (default) or 'intelligence' ──
  const [viewMode, setViewMode] = useState<'5q' | 'intelligence'>('5q')

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

  // ═══════════════════════════════════════════════════════════════
  // GAP FIX 1 + 13: ONE-SHOT API FETCH (Design Bible §4.2)
  // Fetch ALL intelligence data in ONE call, distribute to Q sections
  // ═══════════════════════════════════════════════════════════════

  // ── Fetch company (basic CRUD — includes contacts, notes, research, opportunities, timeline) ──
  const { data, isLoading, error } = useQuery({
    queryKey: ['company', selectedCompanyId],
    queryFn: () => fetch(`/api/companies/${selectedCompanyId}`).then(r => {
      if (!r.ok) throw new Error('Failed to load company')
      return r.json()
    }),
    enabled: !!selectedCompanyId,
  })

  // ── ONE-SHOT: Fetch ALL intelligence data for 5Q workspace ──
  const INCLUDES = 'signals,contacts,timeline,actions,brief,knowledge,scores'
  type IntelEnvelope = { success: boolean; data: IntelligenceCompanyContext; meta?: Record<string, unknown> }
  const {
    data: intelResponseRaw,
    isLoading: intelLoading,
    error: intelError,
    refetch: refetchIntel,
  } = useQuery({
    queryKey: ['intel-company-5q', selectedCompanyId],
    queryFn: async () => {
      const res = await fetch(`/api/intelligence/company/${selectedCompanyId}?include=${INCLUDES}`)
      if (!res.ok) throw new Error('Failed to load intelligence data')
      return res.json() as Promise<IntelEnvelope>
    },
    enabled: !!selectedCompanyId,
    staleTime: 120_000,
  })

  // Extract intelligence data from one-shot response
  const intelData = intelResponseRaw?.data ?? null
  const intelMeta = intelResponseRaw?.meta as Record<string, unknown> | undefined
  const governanceStatus = intelMeta?.governance as Record<string, unknown> | undefined
  const govPassed = governanceStatus?.passed as boolean | undefined

  // ── Fetch unified 3-score data ──
  const { data: scoresData } = useQuery({
    queryKey: ['company-scores', selectedCompanyId],
    queryFn: () => fetch(`/api/companies/${selectedCompanyId}/scores`).then(r => {
      if (!r.ok) throw new Error('Failed to load scores')
      return r.json()
    }),
    enabled: !!selectedCompanyId,
    staleTime: 60_000,
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
      const res = await fetch('/api/g-data/jobs/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'enqueue-research', companyIds: [selectedCompanyId], force: true }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to queue research' }))
        throw new Error(err.error || 'Failed to queue research')
      }
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['company', selectedCompanyId] })
      qc.invalidateQueries({ queryKey: ['company-breadcrumb', selectedCompanyId] })
      qc.invalidateQueries({ queryKey: ['intel-company-5q', selectedCompanyId] })
      toast.success('Research job queued — check Command Center for progress')
    },
    onError: (err) => toast.error(err.message || 'Failed to queue research'),
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
      qc.invalidateQueries({ queryKey: ['intel-company-5q', selectedCompanyId] })
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
      qc.invalidateQueries({ queryKey: ['intel-company-5q', selectedCompanyId] })
      setEditCompanyOpen(false)
      toast.success('Company updated')
    },
    onError: (err) => toast.error(err.message || 'Failed to update company'),
  })

  // ── Handlers ──

  // ═══════════════════════════════════════════════════════════════
  // GAP FIX T7-KB: Keyboard shortcuts (Design Bible §5.1)
  // 1-5: Jump to question section
  // R:   Refresh intelligence
  // Cmd/Ctrl+E: Trigger enrichment
  // ═══════════════════════════════════════════════════════════════
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Skip if user is typing in an input/textarea/select
    const tag = (e.target as HTMLElement)?.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
    // Skip if any dialog is open
    if (noteOpen || contactOpen || oppOpen || statusConfirmOpen || editCompanyOpen || !!deleteNoteId) return

    // 1-5: Jump to Q section
    if (e.key >= '1' && e.key <= '5' && !e.metaKey && !e.ctrlKey && !e.altKey) {
      e.preventDefault()
      const sectionMap: Record<string, string> = {
        '1': 'q1-what-changed',
        '2': 'q2-why-matters',
        '3': 'q3-who-engage',
        '4': 'q4-what-say',
        '5': 'q5-what-do',
      }
      const target = document.getElementById(sectionMap[e.key])
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }

    // R: Refresh intelligence
    if (e.key === 'r' && !e.metaKey && !e.ctrlKey && !e.altKey) {
      e.preventDefault()
      refetchIntel()
      return
    }

    // Cmd/Ctrl+E: Trigger enrichment
    if (e.key === 'e' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      if (!generateResearch.isPending) generateResearch.mutate()
      return
    }
  }, [noteOpen, contactOpen, oppOpen, statusConfirmOpen, editCompanyOpen, deleteNoteId, refetchIntel, generateResearch])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

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

  // ═══════════════════════════════════════════════════════════════
  // GAP FIX 12: Keyboard Shortcuts (Design Bible §5.1)
  // 1-5 jump to Q sections, Cmd+E enrichment, R refresh
  // ═══════════════════════════════════════════════════════════════

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      // 1-5 jump to Q sections
      if (e.key >= '1' && e.key <= '5' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault()
        const sectionId = `q${e.key}-`
        const el = document.querySelector(`[id^="${sectionId}"]`)
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }

      // Cmd+E / Ctrl+E: Trigger enrichment
      if (e.key === 'e' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        if (generateResearch.isPending) return
        generateResearch.mutate()
      }

      // R: Refresh intelligence
      if (e.key === 'r' && !e.metaKey && !e.ctrlKey) {
        qc.invalidateQueries({ queryKey: ['intel-company-5q', selectedCompanyId] })
        qc.invalidateQueries({ queryKey: ['company', selectedCompanyId] })
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedCompanyId, generateResearch.isPending])

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
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-9 w-24 rounded-lg" />)}
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

  // ═══════════════════════════════════════════════════════════════
  // GAP FIX 11: Context-aware intelligence adaptation (Design Bible §7.1)
  // New-account hero: when 0 signals AND 0 contacts AND no research
  // Stale intelligence indicator: freshness > 60 days
  // ═══════════════════════════════════════════════════════════════

  const intelSignals: IntelligenceSignal[] = intelData?.signals ?? []
  const intelContacts: IntelligenceContact[] = intelData?.contacts ?? []
  const hasIntelData = intelSignals.length > 0 || intelContacts.length > 0 || !!intelData?.brief || (intelData?.actions?.success && intelData.actions.actions.length > 0)
  const isNewAccount = !researchCard && intelSignals.length === 0 && intelContacts.length === 0 && contacts.length === 0

  // Stale intelligence check
  const lastEnriched = data.lastEnrichedAt ? new Date(data.lastEnrichedAt) : null
  const daysSinceEnrichment = lastEnriched ? Math.floor((Date.now() - lastEnriched.getTime()) / (1000 * 60 * 60 * 24)) : null
  const isStaleIntel = daysSinceEnrichment !== null && daysSinceEnrichment > 60

  // Build ScoreTriple items from unified scores data
  const getDynamicColor = (s: number) => s >= 80 ? '#059669' : s >= 60 ? '#D97706' : s >= 40 ? '#F59E0B' : '#DC2626'

  const intelligenceScoreItem: ScoreItem | null = scoresData?.intelligence
    ? {
        label: 'Intelligence',
        score: scoresData.intelligence.score,
        tier: normalizeTierForDisplay(scoresData.intelligence.tier, 'intelligence'),
        color: getTierColor(scoresData.intelligence.tier, 'intelligence'),
      }
    : { label: 'Intelligence', score, tier: normalizeTierForDisplay(score >= 70 ? 'hot' : score >= 40 ? 'warm' : score >= 15 ? 'cold' : 'unknown', 'intelligence'), color: getDynamicColor(score) }

  const priorityScoreItem: ScoreItem | null = scoresData?.accountPriority
    ? {
        label: 'Priority',
        score: Math.round(scoresData.accountPriority.score),
        tier: normalizeTierForDisplay(scoresData.accountPriority.tier, 'accountPriority'),
        color: getTierColor(scoresData.accountPriority.tier, 'accountPriority'),
      }
    : data.accountPriorityScore != null
      ? {
          label: 'Priority',
          score: Math.round(data.accountPriorityScore),
          tier: normalizeTierForDisplay(data.priorityTier ?? null, 'accountPriority'),
          color: getDynamicColor(data.accountPriorityScore),
        }
      : null

  const revenueScoreItem: ScoreItem | null = scoresData?.revenueOpportunity
    ? {
        label: 'Revenue',
        score: Math.round(scoresData.revenueOpportunity.score),
        tier: normalizeTierForDisplay(scoresData.revenueOpportunity.category, 'revenue'),
        color: getTierColor(scoresData.revenueOpportunity.category, 'revenue'),
      }
    : null

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
      <ScreenBreadcrumb
        items={[
          { label: 'Companies', href: '/dashboard' },
          { label: data?.name || 'Company' },
        ]}
      />

      {/* ══════════════════════════════════════════════════════════
          HEADER — Back button, Company card, Score Gauge
          ══════════════════════════════════════════════════════════ */}
      <div className="rounded-xl bg-white p-4 md:p-6 card-rest slide-up">
        <div className="flex flex-col sm:flex-row items-start gap-4 md:gap-5">
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
                  <a href={`https://${data.domain}`} target="_blank" rel="noopener noreferrer" className="hover:text-gray-900 transition-colors" onClick={e => e.stopPropagation()}>
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
                <a href={data.website.startsWith('http') ? data.website : `https://${data.website}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-amber-600 hover:text-amber-700 transition-colors" onClick={e => e.stopPropagation()}>
                  <ExternalLink className="size-3.5" />Website
                </a>
              )}
              {data.linkedinUrl && (
                <a href={data.linkedinUrl.startsWith('http') ? data.linkedinUrl : `https://${data.linkedinUrl}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-blue-600 hover:text-blue-700 transition-colors" onClick={e => e.stopPropagation()}>
                  <Linkedin className="size-3.5" />LinkedIn
                </a>
              )}
              {data.dataFreshness && (
                <span className="flex items-center gap-1.5">
                  <StatusDot status={data.dataFreshness === 'fresh' ? 'fresh' : data.dataFreshness === 'stale' ? 'stale' : 'unknown'} pulse={data.dataFreshness === 'fresh'} />
                  <span className="capitalize">{String(data.dataFreshness)}</span>
                </span>
              )}
            </div>

            {/* GAP FIX 7: Trust Indicator — Design Bible §6.1 */}
            <div className="mt-3 flex items-center gap-3 text-[11px]">
              {intelData?.freshness && (
                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full ${
                  intelData.freshness.level === 'fresh' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                  intelData.freshness.level === 'stale' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                  intelData.freshness.level === 'very_stale' ? 'bg-red-50 text-red-700 border border-red-200' :
                  'bg-gray-50 text-gray-500 border border-gray-200'
                }`}>
                  <ShieldCheck className="size-3" />
                  Intelligence Quality: {intelData.freshness.score}% · {intelData.freshness.level === 'fresh' ? 'Fresh' : intelData.freshness.level === 'stale' ? `Stale · ${daysSinceEnrichment}d ago` : `Old · ${daysSinceEnrichment}d ago`}
                </span>
              )}
              {govPassed !== undefined && (
                <GovernanceBadge status={govPassed ? 'verified' : 'failed'} />
              )}
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2 mt-4 flex-wrap">
              <Button size="sm" variant="outline" className="h-8 text-xs border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 hover:text-gray-900" onClick={() => setEditCompanyOpen(true)}>
                <Pencil className="size-3.5 mr-1.5" /> Edit Company
              </Button>
              <Button data-action="generate-research" size="sm" className="h-8 text-xs bg-amber-600 hover:bg-amber-700 text-white rounded-lg press-scale shadow-xs" onClick={() => generateResearch.mutate()} disabled={generateResearch.isPending}>
                {generateResearch.isPending ? <Loader2 className="size-3.5 mr-1.5 animate-spin" /> : <Sparkles className="size-3.5 mr-1.5" />}
                {generateResearch.isPending ? 'Generating...' : 'Generate AI Research'}
              </Button>
              <Button size="sm" variant="outline" className="h-8 text-xs border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 hover:text-gray-900" onClick={() => setNoteOpen(true)}>
                <Plus className="size-3.5 mr-1.5" /> Add Note
              </Button>
              <Button size="sm" variant="outline" className="h-8 text-xs border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 hover:text-gray-900" onClick={() => setContactOpen(true)}>
                <Plus className="size-3.5 mr-1.5" /> Add Contact
              </Button>
              <Button size="sm" variant="outline" className="h-8 text-xs border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 hover:text-gray-900" onClick={() => setOppOpen(true)}>
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
                  <Button size="sm" variant="outline" className="h-8 text-xs border-amber-200 text-amber-700 rounded-lg hover:bg-amber-50 hover:text-amber-800" onClick={() => handleGenerateEmail(getResolvedEmailContactId())} disabled={!getResolvedEmailContactId()}>
                    <Mail className="size-3.5 mr-1.5" /> Generate Email
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Score Triple — visible on all viewports */}
          <div className="shrink-0">
            <ScoreTriple
              intelligence={intelligenceScoreItem}
              accountPriority={priorityScoreItem}
              revenueOpportunity={revenueScoreItem}
            />
          </div>
        </div>

        {/* Quick Stats */}
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
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
              <p className="text-lg font-semibold text-gray-900">{researchCard ? `${researchCard.confidenceScore || 0}%` : '—'}</p>
              <p className="text-[11px] text-gray-500 uppercase tracking-wider font-medium">Research</p>
            </div>
          </div>
        </div>
      </div>

      {/* GAP FIX 11: New account hero — Design Bible §7.1 */}
      {isNewAccount && (
        <div className="rounded-xl border border-dashed border-gray-200 bg-gradient-to-br from-amber-50/60 to-orange-50/30 p-10 text-center slide-up">
          <Brain className="size-12 text-amber-400 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-gray-900 mb-2">This account has no intelligence yet</h3>
          <p className="text-sm text-gray-600 max-w-md mx-auto mb-6">
            Start by enriching this company to discover signals, build analysis,
            and get AI-powered recommendations across all 5 intelligence questions.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Button className="bg-amber-600 hover:bg-amber-700 text-white rounded-lg press-scale shadow-sm" onClick={() => generateResearch.mutate()} disabled={generateResearch.isPending}>
              {generateResearch.isPending ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Sparkles className="size-4 mr-2" />}
              Enrich Now
            </Button>
            <Button variant="outline" className="border-gray-200 text-gray-600 hover:bg-gray-50 rounded-lg" onClick={() => setContactOpen(true)}>
              <Plus className="size-4 mr-1.5" /> Add Contact Manually
            </Button>
          </div>
        </div>
      )}

      {/* GAP FIX 11: Stale intelligence warning — Design Bible §7.1 */}
      {isStaleIntel && !isNewAccount && (
        <div className="rounded-lg border border-amber-200 bg-amber-50/40 p-3 flex items-center gap-3">
          <AlertTriangle className="size-4 text-amber-500 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-amber-800">Stale Intelligence</p>
            <p className="text-[11px] text-amber-600">Last enriched {daysSinceEnrichment} days ago. Consider re-running enrichment for up-to-date analysis.</p>
          </div>
          <Button size="sm" className="h-7 text-xs bg-amber-600 hover:bg-amber-700 text-white rounded-md press-scale" onClick={() => generateResearch.mutate()} disabled={generateResearch.isPending}>
            {generateResearch.isPending ? <Loader2 className="size-3 mr-1 animate-spin" /> : <RefreshCw className="size-3 mr-1" />}
            Re-enrich
          </Button>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          VIEW TOGGLE — 5Q Intelligence vs Traditional
          ══════════════════════════════════════════════════════════ */}
      <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 h-9 w-fit">
        <button
          onClick={() => setViewMode('5q')}
          className={`rounded-md text-xs px-3 py-1.5 transition-colors flex items-center gap-1.5 ${
            viewMode === '5q'
              ? 'bg-white shadow-sm text-gray-900 font-medium'
              : 'text-gray-500 hover:text-gray-800'
          }`}
        >
          <Brain className="size-3.5" />
          5Q Intelligence
        </button>
        <button
          onClick={() => setViewMode('intelligence')}
          className={`rounded-md text-xs px-3 py-1.5 transition-colors ${
            viewMode === 'intelligence'
              ? 'bg-white shadow-sm text-gray-900 font-medium'
              : 'text-gray-500 hover:text-gray-800'
          }`}
        >
          <Shield className="size-3.5 inline mr-1" />
          Health & Validation
        </button>
        {/* GAP FIX T7-KB: Keyboard shortcut hints (Design Bible §5.1) */}
        <div className="ml-2 hidden md:flex items-center gap-2 text-[10px] text-gray-400">
          <span className="flex items-center gap-0.5"><Keyboard className="size-3" />1-5</span>
          <span className="flex items-center gap-0.5">R refresh</span>
          <span className="flex items-center gap-0.5">⌘E enrich</span>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════
          5Q PROGRESSIVE DISCLOSURE SCROLL
          One-shot data → progressive render (Design Bible §4.2)
          ══════════════════════════════════════════════════════════ */}
      {viewMode === '5q' ? (
        <div className="space-y-6">
          {/* Research Card Quick View */}
          {researchCard ? (
            <div className="rounded-xl bg-white card-rest overflow-hidden slide-up">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                  <Sparkles className="size-4 text-amber-500" />
                  AI Research Summary
                  {researchCard.confidenceScore && (
                    <span className="text-[11px] font-medium text-gray-600">{researchCard.confidenceScore}% confidence</span>
                  )}
                </h3>
                <Button size="sm" className="h-7 text-xs bg-amber-600 hover:bg-amber-700 text-white rounded-md press-scale shadow-xs" onClick={() => generateResearch.mutate()} disabled={generateResearch.isPending}>
                  {generateResearch.isPending ? <Loader2 className="size-3 mr-1 animate-spin" /> : <Sparkles className="size-3 mr-1" />}
                  Regenerate
                </Button>
              </div>
              <div className="p-6">
                <div className="grid gap-3 md:grid-cols-2">
                  {(Object.entries(RESEARCH_LABELS) as [string, typeof RESEARCH_LABELS[string]][]).slice(0, 6).map(([key, cfg], idx) =>
                    (researchCard as unknown as Record<string, unknown>)[key] ? (
                      <div key={String(key)} className={`rounded-lg border p-4 ${researchColors[idx % researchColors.length]} slide-up`} style={{ animationDelay: `${idx * 40}ms` }}>
                        <div className="flex items-center gap-2 mb-1.5">
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
          ) : null}

          {/* Narrative Dividers + Q sections — Design Bible §1.5 */}
          <NarrativeDivider label="Q1" subtitle="What Changed?" color="blue" />
          <div className="rounded-xl bg-gradient-to-br from-blue-50/40 to-cyan-50/20 border border-blue-100/60 p-6">
            <Q1WhatChanged
              signals={intelSignals}
              loading={intelLoading}
              error={intelError ? 'Failed to load signals' : null}
              onRetry={() => refetchIntel()}
              governanceStatus={govPassed !== undefined ? (govPassed ? 'verified' : 'failed') : 'not_evaluated'}
            />
          </div>

          <NarrativeDivider label="Q2" subtitle="Why Does It Matter?" color="violet" transition="WHY THIS MATTERS — Understanding the strategic impact" />
          <div className="rounded-xl bg-gradient-to-br from-violet-50/40 to-purple-50/20 border border-violet-100/60 p-6">
            <Q2WhyMatters
              brief={intelData?.brief}
              actions={intelData?.actions}
              loading={intelLoading}
              error={intelError ? 'Failed to load reasoning' : null}
              onRetry={() => refetchIntel()}
              governanceStatus={govPassed !== undefined ? (govPassed ? 'verified' : 'failed') : 'not_evaluated'}
            />
          </div>

          <NarrativeDivider label="Q3" subtitle="Who Should We Engage?" color="emerald" transition="WHO TO APPROACH — Mapping the buying committee" />
          <div className="rounded-xl bg-gradient-to-br from-emerald-50/40 to-teal-50/20 border border-emerald-100/60 p-6">
            <Q3WhoEngage
              contacts={intelContacts}
              keyPeople={intelData?.keyPeople || []}
              loading={intelLoading}
              error={intelError ? 'Failed to load contacts' : null}
              onRetry={() => refetchIntel()}
              onViewContact={handleViewContact}
              onGenerateEmail={handleGenerateEmail}
            />
          </div>

          <NarrativeDivider label="Q4" subtitle="What Should We Say?" color="amber" transition="WHAT TO SAY — Preparing the right message" />
          <div className="rounded-xl bg-gradient-to-br from-amber-50/40 to-yellow-50/20 border border-amber-100/60 p-6">
            <Q4WhatSay
              brief={intelData?.brief}
              capabilities={intelData?.knowledge?.capabilities || []}
              loading={intelLoading}
              error={intelError ? 'Failed to load conversation prep' : null}
              onRetry={() => refetchIntel()}
              onGenerateEmail={handleGenerateEmail}
            />
          </div>

          <NarrativeDivider label="Q5" subtitle="What Should We Do?" color="rose" transition="WHAT TO DO — Turning intelligence into action" />
          <div className="rounded-xl bg-gradient-to-br from-rose-50/40 to-pink-50/20 border border-rose-100/60 p-6">
            <Q5WhatDo
              actions={intelData?.actions}
              opportunities={opportunities}
              loading={intelLoading}
              error={intelError ? 'Failed to load actions' : null}
              onRetry={() => refetchIntel()}
            />
          </div>

          {/* Notes Timeline (always visible below 5Q) */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <StickyNote className="size-4 text-violet-600" />
                <h3 className="text-sm font-semibold text-gray-900">
                  Notes
                  <span className="text-xs font-normal text-gray-500 ml-1.5">({notes.length})</span>
                </h3>
              </div>
              <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white rounded-lg press-scale shadow-xs text-xs" onClick={() => setNoteOpen(true)}>
                <Plus className="size-3.5 mr-1.5" /> Add Note
              </Button>
            </div>
            {notes.length === 0 ? (
              <EmptyState icon={StickyNote} title="No notes yet" description="Add notes to track conversations and insights." actionLabel="Add Note" onAction={() => setNoteOpen(true)} />
            ) : (
              <div className="relative pl-6">
                <div className="absolute left-[7px] top-2 bottom-2 border-l-2 border-gray-200" />
                <div className="space-y-3">
                  {notes.map((n, idx) => (
                    <div key={n.id} className="relative flex items-start gap-4 slide-up" style={{ animationDelay: `${idx * 30}ms` }}>
                      <div className="absolute -left-6 top-2 size-3 rounded-full bg-white ring-4 ring-white border-2 border-amber-400" />
                      <div className="flex-1 rounded-xl bg-white p-4 card-rest min-w-0">
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap flex-1">{n.body}</p>
                          <button onClick={() => setDeleteNoteId(n.id)} className="shrink-0 text-gray-700 hover:text-red-500 transition-colors p-0.5 rounded-md hover:bg-red-50" aria-label="Delete note" title="Delete note">
                            <X className="size-3.5" />
                          </button>
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          {n.noteType && <Badge className="bg-gray-100 text-gray-600 hover:bg-gray-100 text-[11px] font-normal border-0 rounded-md capitalize">{n.noteType}</Badge>}
                          <span className="text-[11px] text-gray-600">{formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Activity Timeline (always visible below notes) */}
          {timeline.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Clock className="size-4 text-gray-600" />
                <h3 className="text-sm font-semibold text-gray-900">
                  Activity
                  <span className="text-xs font-normal text-gray-500 ml-1.5">({timeline.length})</span>
                </h3>
              </div>
              <div className="relative pl-6">
                <div className="absolute left-[7px] top-2 bottom-2 border-l-2 border-gray-200" />
                <div className="space-y-3">
                  {timeline.slice(0, 10).map((t, idx) => {
                    const iconData = getActivityIcon(t.action)
                    const Icon = iconData.icon
                    return (
                      <div key={t.id} className="relative flex items-start gap-4 slide-up" style={{ animationDelay: `${idx * 30}ms` }}>
                        <div className="absolute -left-6 top-1.5 size-3 rounded-full bg-white ring-4 ring-white border-2 border-amber-400" />
                        <div className={`shrink-0 mt-0.5 rounded-lg p-1.5 ${iconData.bg}`}>
                          <Icon className={`size-3.5 ${iconData.color}`} />
                        </div>
                        <div className="min-w-0 flex-1 rounded-lg bg-white p-3.5 card-rest">
                          <p className="text-sm font-medium text-gray-900 capitalize">{t.action.replace(/_/g, ' ')}</p>
                          {t.details && <p className="text-xs text-gray-500 mt-0.5">{t.details}</p>}
                          <p className="text-[11px] text-gray-600 mt-1">{formatDistanceToNow(new Date(t.createdAt), { addSuffix: true })}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* ══════════════════════════════════════════════════════════
           INTELLIGENCE HEALTH VIEW
           ══════════════════════════════════════════════════════════ */
        <IntelligenceTab companyId={data.id} />
      )}

      {/* ══════════════════════════════════════════════════════════
          DIALOGS (all preserved)
          ══════════════════════════════════════════════════════════ */}

      {/* Status Cycle Confirmation */}
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
            <AlertDialogAction className="rounded-lg bg-amber-600 hover:bg-amber-700 text-white" onClick={handleStatusCycle} disabled={updateCompanyStatus.isPending}>
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
            <Button onClick={() => deleteNoteMutation.mutate(deleteNoteId!)} disabled={deleteNoteMutation.isPending} className="bg-red-600 text-white hover:bg-red-700 press-scale">
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

      {/* Edit Company Dialog */}
      <Dialog open={editCompanyOpen} onOpenChange={setEditCompanyOpen}>
        <DialogContent className="sm:max-w-md rounded-xl">
          <DialogHeader><DialogTitle className="text-gray-900">Edit Company</DialogTitle></DialogHeader>
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

      {/* Add Contact Dialog */}
      <Dialog open={contactOpen} onOpenChange={setContactOpen}>
        <DialogContent className="sm:max-w-md rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-gray-900">Add Contact</DialogTitle>
            <p className="text-xs text-gray-500 mt-1">Adding to <span className="font-medium text-gray-800">{data.name}</span></p>
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

      {/* Add Opportunity Dialog */}
      <Dialog open={oppOpen} onOpenChange={setOppOpen}>
        <DialogContent className="sm:max-w-md rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-gray-900">Create Opportunity</DialogTitle>
            <p className="text-xs text-gray-500 mt-1">For <span className="font-medium text-gray-800">{data.name}</span></p>
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
                <Select value={oppForm.targetContactId || ''} onValueChange={v => setOppForm(f => ({ ...f, targetContactId: v === '__none__' ? '' : v }))}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Select contact (optional)" /></SelectTrigger>
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
