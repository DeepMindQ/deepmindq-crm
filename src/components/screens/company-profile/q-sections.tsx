'use client'

import { useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import {
  Zap, Brain, UserCheck, MessageSquare, Crosshair, Ban, DollarSign, Target,
  Mail, Users, Megaphone, TrendingUp, Lightbulb, Sparkles, X, ShieldAlert,
  ChevronRight,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useSectionVisible, GovernanceBadge, EvidenceGroundingBar, AIFooter, SectionError } from './profile-utilities'
import type { IntelligenceSignal, IntelligenceContact, IntelligenceBrief } from '@/lib/intelligence-api/types'
import type { ActionResult, RecommendedAction } from '@/lib/engines/action-engine'
import type { Opportunity } from '@/lib/types'
import { getStatusBorder, getOppStatusVariant } from '@/lib/constants'

/* ═══════════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════════ */

const getSeverityVariant = (severity: string) => {
  switch (severity) {
    case 'critical': return 'bg-red-100 text-red-700 border-red-200'
    case 'high': return 'bg-orange-100 text-orange-700 border-orange-200'
    case 'medium': return 'bg-amber-100 text-amber-700 border-amber-200'
    case 'low': return 'bg-blue-100 text-blue-700 border-blue-200'
    default: return 'bg-gray-100 text-gray-600 border-gray-200'
  }
}

const getUrgencyVariant = (urgency: string) => {
  switch (urgency) {
    case 'immediate': return 'bg-red-100 text-red-700 border-red-200'
    case 'high': return 'bg-orange-100 text-orange-700 border-orange-200'
    case 'medium': return 'bg-amber-100 text-amber-700 border-amber-200'
    case 'low': return 'bg-emerald-100 text-emerald-700 border-emerald-200'
    default: return 'bg-gray-100 text-gray-600 border-gray-200'
  }
}

/* ═══════════════════════════════════════════════════════════════
   Q1: What Changed? — Signal Timeline
   ═══════════════════════════════════════════════════════════════ */

export function Q1WhatChanged({
  signals, loading, error, onRetry, governanceStatus,
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
   ═══════════════════════════════════════════════════════════════ */

export function Q2WhyMatters({
  brief, actions, loading, error, onRetry, governanceStatus,
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
          {(brief?.warnings || actions) && (
            <EvidenceGroundingBar warnings={brief?.warnings} />
          )}

          {actions?.detectedSalesMotion && (
            <div className="rounded-xl bg-violet-50 border border-violet-100 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Megaphone className="size-3.5 text-violet-600" />
                <p className="text-xs font-bold text-violet-800 uppercase tracking-wider">Detected Sales Motion</p>
              </div>
              <p className="text-sm text-violet-900 font-medium capitalize">{String(actions.detectedSalesMotion).replace(/_/g, ' ')}</p>
            </div>
          )}

          {actions?.accountStrategy && (
            <div className="rounded-xl bg-white border border-gray-100 p-5">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="size-3.5 text-gray-600" />
                <p className="text-xs font-bold text-gray-700 uppercase tracking-wider">Account Strategy & Impact Assessment</p>
              </div>
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{String(actions.accountStrategy)}</p>
            </div>
          )}

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
                  {idx === 0 && (
                    <AIFooter model={brief.modelUsed} durationMs={brief.durationMs} />
                  )}
                </div>
              ))}
            </div>
          )}

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
   Q3: Who Should We Engage? — Buying Committee
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

export function Q3WhoEngage({
  contacts, keyPeople, loading, error, onRetry, onViewContact, onGenerateEmail,
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

  const buyingCommittee = contacts.length > 0 ? contacts.map(c => ({
    id: c.id, name: c.rawName, title: c.title || 'Unknown Role', role: c.role,
    email: c.email, phone: c.phone, leadScore: c.leadScore, confidence: c.confidence,
    status: c.status, lastActivityAt: c.lastActivityAt,
  })) : keyPeople.map((p, i) => ({
    id: `kp-${i}`, name: p.name, title: p.title, role: p.department,
    email: null, phone: null, leadScore: 0, confidence: 0, status: 'research', lastActivityAt: null,
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
                <div className={`flex size-8 rounded-lg items-center justify-center text-xs font-bold shrink-0 ${
                  idx === 0 ? 'bg-amber-100 text-amber-700' : idx === 1 ? 'bg-gray-100 text-gray-600' : 'bg-gray-50 text-gray-400'
                }`}>
                  {idx + 1}
                </div>
                <div className="flex size-9 rounded-full bg-gray-100 items-center justify-center shrink-0 text-xs font-semibold text-gray-600">
                  {person.name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-gray-900 group-hover:text-amber-700 transition-colors truncate">{person.name}</p>
                    {idx === 0 && (
                      <Badge className="bg-amber-50 text-amber-700 hover:bg-amber-50 text-[10px] font-bold border-0 rounded-md">PRIMARY</Badge>
                    )}
                    <Badge className={`text-[10px] font-medium border rounded-md ${buyingRoleColor}`}>{buyingRole}</Badge>
                  </div>
                  <p className="text-xs text-gray-500 truncate">{person.title}{person.role && person.title !== person.role ? ` · ${person.role}` : ''}</p>
                </div>
                {hasRecentActivity && (
                  <div className="shrink-0" title="Recent engagement activity">
                    <div className="flex items-center gap-1 text-emerald-500">
                      <div className="size-2 rounded-full bg-emerald-400 animate-pulse" />
                    </div>
                  </div>
                )}
                <div className="shrink-0 text-right">
                  <div className={`text-sm font-bold tabular-nums ${
                    person.leadScore >= 70 ? 'text-emerald-600' : person.leadScore >= 40 ? 'text-amber-600' : 'text-gray-400'
                  }`}>
                    {person.leadScore > 0 ? person.leadScore : '—'}
                  </div>
                  <p className="text-[10px] text-gray-400 uppercase">score</p>
                </div>
                {person.email && (
                  <Button
                    size="sm" variant="ghost"
                    className="h-10 text-xs text-gray-600 hover:text-amber-600 hover:bg-amber-50 rounded-md shrink-0 opacity-0 group-hover:opacity-100 transition-opacity min-h-[44px]"
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
   Q4: What Should We Say? — Conversation Prep
   ═══════════════════════════════════════════════════════════════ */

function generateObjectionCards(brief: IntelligenceBrief | undefined): Array<{ objection: string; response: string }> {
  if (!brief?.content) return []
  const lines = brief.content.split('\n')
  const objections: Array<{ objection: string; response: string }> = []
  for (const line of lines) {
    const objMatch = line.match(/objection[:\s]+(.+?)(?:\||$)/i)
    const respMatch = line.match(/response[:\s]+(.+?)(?:\||$)/i)
    if (objMatch) {
      objections.push({ objection: objMatch[1].trim(), response: respMatch ? respMatch[1].trim() : '' })
    }
  }
  if (objections.length === 0 && brief?.warnings?.length) {
    const riskWarnings = brief.warnings.filter(w =>
      w.toLowerCase().includes('risk') || w.toLowerCase().includes('objection') || w.toLowerCase().includes('concern')
    )
    for (const w of riskWarnings.slice(0, 3)) {
      objections.push({ objection: w, response: 'Address by leading with evidence-based insights from the intelligence brief. Reference specific data points that counter this concern.' })
    }
  }
  return objections.slice(0, 4)
}

export function Q4WhatSay({
  brief, capabilities, loading, error, onRetry, onGenerateEmail,
}: {
  brief: IntelligenceBrief | undefined
  capabilities: Array<Record<string, unknown>>
  loading: boolean
  error: string | null
  onRetry: () => void
  onGenerateEmail: (contactId: string) => void
}) {
  const { ref, visible } = useSectionVisible('q4')

  const talkingPoints: string[] = []
  if (brief?.content) {
    const lines = brief.content.split('\n').filter(l => l.trim().startsWith('- '))
    for (const line of lines.slice(0, 6)) {
      talkingPoints.push(line.replace(/^\-\s*/, '').trim())
    }
  }

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
          <EvidenceGroundingBar warnings={brief?.warnings} />

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
              {brief.sections?.[0]?.body && (
                <p className="text-sm text-gray-700 leading-relaxed">{brief.sections[0].body}</p>
              )}
              <AIFooter model={brief.modelUsed} durationMs={brief.durationMs} />
            </div>
          )}

          {talkingPoints.length > 0 && (
            <div className="rounded-xl bg-gradient-to-br from-amber-50/80 to-orange-50/40 border border-amber-100/60 p-5">
              <p className="text-xs font-bold text-amber-800 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Crosshair className="size-3.5" /> Talking Points
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

          {objectionCards.length > 0 && (
            <div className="rounded-xl bg-gradient-to-br from-red-50/60 to-orange-50/30 border border-red-100/50 p-5">
              <p className="text-xs font-bold text-red-800 uppercase tracking-wider mb-3 flex items-center gap-2">
                <ShieldAlert className="size-3.5" /> Objection Handling
                <span className="text-[10px] font-normal text-gray-500 normal-case">{objectionCards.length} objection{objectionCards.length !== 1 ? 's' : ''}</span>
              </p>
              <div className="space-y-3">
                {objectionCards.map((obj, idx) => (
                  <div key={idx} className="rounded-lg bg-white/80 border border-red-100/50 p-3.5">
                    <p className="text-sm font-medium text-gray-900 flex items-start gap-2">
                      <Ban className="size-3.5 text-red-400 mt-0.5 shrink-0" /> {obj.objection}
                    </p>
                    {obj.response && (
                      <p className="text-xs text-gray-600 mt-2 ml-5.5 pl-1 border-l-2 border-amber-200 leading-relaxed">{obj.response}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {capabilities.length > 0 && (
            <div className="rounded-xl bg-white border border-gray-100 p-5">
              <p className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Sparkles className="size-3.5 text-amber-500" /> Capability Matches
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
   ═══════════════════════════════════════════════════════════════ */

export function Q5WhatDo({
  actions, opportunities, loading, error, onRetry,
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

  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set())
  const toggleDismiss = (id: string) => {
    setDismissedIds(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next })
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
          {actions?.success && <EvidenceGroundingBar warnings={undefined} />}

          {visibleActions.length > 0 && (
            <div>
              <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2 px-1">Recommended Actions</p>
              <div className="space-y-2">
                {visibleActions.map((action, idx) => {
                  const isPrimary = primaryAction?.id === action.id || idx === 0
                  return (
                    <div key={action.id} className={`rounded-xl bg-white border border-gray-100 p-4 card-rest slide-up ${isPrimary ? 'ring-1 ring-amber-200 border-amber-100' : ''}`} style={{ animationDelay: `${idx * 30}ms` }}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            {isPrimary && <Badge className="bg-amber-50 text-amber-700 hover:bg-amber-50 text-[10px] font-bold border-0 rounded-md">BEST ACTION</Badge>}
                            <p className="text-sm font-semibold text-gray-900">{action.title}</p>
                            <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase border ${getUrgencyVariant(action.urgency)}`}>{action.urgency}</span>
                            {action.confidence > 0 && (
                              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                                action.confidence >= 70 ? 'bg-emerald-50 text-emerald-700' : action.confidence >= 40 ? 'bg-amber-50 text-amber-700' : 'bg-gray-100 text-gray-500'
                              }`}>
                                {Math.round(action.confidence)}% conf.
                              </span>
                            )}
                          </div>
                          {action.reason && <p className="text-xs text-gray-500 mt-1">{action.reason}</p>}
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
                            {action.targetContact && <span className="text-[11px] text-gray-400 flex items-center gap-1"><Users className="size-3" /> {action.targetContact}</span>}
                            {action.salesMotion && <Badge className="bg-gray-50 text-gray-500 hover:bg-gray-50 text-[10px] font-medium border-0 rounded-md">{String(action.salesMotion).replace(/_/g, ' ')}</Badge>}
                          </div>
                        </div>
                        <button onClick={() => toggleDismiss(action.id)} className="shrink-0 p-1 text-gray-300 hover:text-red-400 transition-colors rounded-md hover:bg-red-50" title="Dismiss this action">
                          <X className="size-3.5" />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {opportunities.length > 0 && (
            <div>
              <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2 px-1">Active Opportunities <span className="text-gray-400 font-normal normal-case ml-1">({opportunities.length})</span></p>
              <div className="space-y-2">
                {opportunities.map((o) => (
                  <div key={o.id} className={`rounded-xl bg-white card-interactive border-l-[3px] ${getStatusBorder(o.status)} p-4 flex items-center justify-between gap-3`}>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-900">{o.title}</p>
                      {o.nextAction && <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1"><ChevronRight className="size-3 text-amber-600" /> {o.nextAction}</p>}
                    </div>
                    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium capitalize border ${getOppStatusVariant(o.status)}`}>{o.status}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {actions?.success && <AIFooter model={actions.modelUsed} durationMs={actions.durationMs} />}
        </div>
      ) : (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
        </div>
      )}
    </div>
  )
}
