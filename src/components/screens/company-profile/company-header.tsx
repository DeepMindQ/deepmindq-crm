'use client'

import Image from 'next/image'
import {
  ArrowLeft, Globe, MapPin, Users, Plus, Target, StickyNote, FileText,
  Sparkles, Mail, ExternalLink, Linkedin, Loader2, Pencil, Brain,
  ShieldCheck, AlertTriangle, RefreshCw, Keyboard, CheckCircle2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ScoreTriple } from '@/components/shared/design-system'
import { StatusDot } from '@/components/shared/design-system'
import { getCompanyStatusVariant } from '@/lib/constants'
import type { ScoreItem } from '@/components/shared/design-system'
import type { Company, Contact, CompanyNote, CompanyResearchCard, CompanyStatus } from '@/lib/types'

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

const RESEARCH_LABELS: Record<string, { label: string; icon: React.ElementType }> = {
  businessOverview: { label: 'Business Overview', icon: FileText },
  revenue: { label: 'Revenue', icon: () => <span /> },
  employeeCount: { label: 'Employees', icon: Users },
  fundingStage: { label: 'Funding Stage', icon: Target },
  techStack: { label: 'Technology Stack', icon: () => <span /> },
  industry: { label: 'Industry', icon: () => <span /> },
  website: { label: 'Website', icon: Globe },
  enrichmentSource: { label: 'Data Source', icon: FileText },
  enrichmentDate: { label: 'Last Enriched', icon: () => <span /> },
}

const researchColors = [
  'bg-blue-50 border-blue-100', 'bg-violet-50 border-violet-100', 'bg-amber-50 border-amber-100',
  'bg-emerald-50 border-emerald-100', 'bg-rose-50 border-rose-100', 'bg-indigo-50 border-indigo-100',
  'bg-cyan-50 border-cyan-100', 'bg-orange-50 border-orange-100',
]

interface CompanyHeaderProps {
  data: Company & { dataFreshness?: string; intelligenceScore?: number; accountPriorityScore?: number; priorityTier?: string; lastEnrichedAt?: string }
  contacts: Contact[]
  notes: CompanyNote[]
  opportunities: { id: string; title: string; status: string }[]
  researchCard: CompanyResearchCard | null
  intelligenceScoreItem: ScoreItem | null
  priorityScoreItem: ScoreItem | null
  revenueScoreItem: ScoreItem | null
  isStaleIntel: boolean
  daysSinceEnrichment: number | null
  govPassed: boolean | undefined
  intelData: any
  updateCompanyStatusPending: boolean
  generateResearchPending: boolean
  onBack: () => void
  onStatusClick: () => void
  onEditCompany: () => void
  onGenerateResearch: () => void
  onAddNote: () => void
  onAddContact: () => void
  onAddOpportunity: () => void
  onGenerateEmail: (contactId: string) => void
  onReEnrich: () => void
}

export function CompanyHeader({
  data, contacts, notes, opportunities, researchCard,
  intelligenceScoreItem, priorityScoreItem, revenueScoreItem,
  isStaleIntel, daysSinceEnrichment, govPassed, intelData,
  updateCompanyStatusPending, generateResearchPending,
  onBack, onStatusClick, onEditCompany, onGenerateResearch,
  onAddNote, onAddContact, onAddOpportunity, onGenerateEmail, onReEnrich,
}: CompanyHeaderProps) {
  const emailContactId = contacts[0]?.id || ''

  return (
    <>
      <div className="rounded-xl bg-white p-4 md:p-6 card-rest slide-up">
        <div className="flex flex-col sm:flex-row items-start gap-4 md:gap-5">
          <div className="size-14 rounded-xl bg-gray-100 overflow-hidden shrink-0 flex items-center justify-center border border-gray-200/60">
            {data.domain ? (
              <Image src={`https://logo.clearbit.com/${data.domain}`} alt="" width={56} height={56} className="size-14 object-contain p-2" onError={e => handleLogoError(e, data.name, 'size-14 text-xl')} />
            ) : (
              <span className="text-xl font-bold text-gray-600">{data.name?.charAt(0)}</span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors group rounded-md px-1.5 py-0.5 -ml-1.5 hover:bg-gray-100">
                <ArrowLeft className="size-4 group-hover:-translate-x-0.5 transition-transform" />
                <span className="hidden sm:inline">Back</span>
              </button>
              <span className="text-gray-700">/</span>
              <h2 className="text-xl font-bold text-gray-900 tracking-tight truncate">{data.name}</h2>
              {data.industry && <Badge className="bg-gray-100 text-gray-600 hover:bg-gray-100 text-xs font-normal border-0 rounded-md">{data.industry}</Badge>}
              <button onClick={onStatusClick} disabled={updateCompanyStatusPending} className={`text-[11px] font-medium px-2 py-0.5 rounded-md border capitalize ${getCompanyStatusVariant(data.status as CompanyStatus)} ${updateCompanyStatusPending ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:opacity-80'} transition-colors`} title="Click to change status">
                {updateCompanyStatusPending ? <Loader2 className="size-3 animate-spin inline" /> : null} {data.status}
              </button>
            </div>
            <div className="flex items-center gap-x-5 gap-y-1.5 mt-2.5 text-sm text-gray-500 flex-wrap">
              {data.domain && <span className="flex items-center gap-1.5"><Globe className="size-3.5 text-gray-600" /><a href={`https://${data.domain}`} target="_blank" rel="noopener noreferrer" className="hover:text-gray-900 transition-colors" onClick={e => e.stopPropagation()}>{data.domain}</a></span>}
              {data.location && <span className="flex items-center gap-1.5"><MapPin className="size-3.5 text-gray-600" />{data.location}</span>}
              {data.country && data.location !== data.country && <span className="flex items-center gap-1.5"><MapPin className="size-3.5 text-gray-600" />{data.country}</span>}
              {data.employeeSize && <span className="flex items-center gap-1.5"><Users className="size-3.5 text-gray-600" />{data.employeeSize} employees</span>}
              {data.website && <a href={data.website.startsWith('http') ? data.website : `https://${data.website}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-amber-600 hover:text-amber-700 transition-colors" onClick={e => e.stopPropagation()}><ExternalLink className="size-3.5" />Website</a>}
              {data.linkedinUrl && <a href={data.linkedinUrl.startsWith('http') ? data.linkedinUrl : `https://${data.linkedinUrl}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-blue-600 hover:text-blue-700 transition-colors" onClick={e => e.stopPropagation()}><Linkedin className="size-3.5" />LinkedIn</a>}
              {data.dataFreshness && <span className="flex items-center gap-1.5"><StatusDot status={data.dataFreshness === 'fresh' ? 'fresh' : data.dataFreshness === 'stale' ? 'stale' : 'unknown'} pulse={data.dataFreshness === 'fresh'} /><span className="capitalize">{String(data.dataFreshness)}</span></span>}
            </div>
            <div className="mt-3 flex items-center gap-3 text-[11px]">
              {intelData?.freshness && (
                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full ${
                  intelData.freshness.level === 'fresh' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : intelData.freshness.level === 'stale' ? 'bg-amber-50 text-amber-700 border border-amber-200' : intelData.freshness.level === 'very_stale' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-gray-50 text-gray-500 border border-gray-200'
                }`}>
                  <ShieldCheck className="size-3" />
                  Intelligence Quality: {intelData.freshness.score}% · {intelData.freshness.level === 'fresh' ? 'Fresh' : intelData.freshness.level === 'stale' ? `Stale · ${daysSinceEnrichment}d ago` : `Old · ${daysSinceEnrichment}d ago`}
                </span>
              )}
              {govPassed !== undefined && (
                <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md ${govPassed ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                  <ShieldCheck className="size-3" /> {govPassed ? 'Verified' : 'Failed'}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-4 flex-wrap">
              <Button size="sm" variant="outline" className="h-10 text-xs border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 hover:text-gray-900 min-h-[44px]" onClick={onEditCompany}><Pencil className="size-3.5 mr-1.5" /> Edit Company</Button>
              <Button data-action="generate-research" size="sm" className="h-10 text-xs bg-amber-600 hover:bg-amber-700 text-white rounded-lg press-scale shadow-xs min-h-[44px]" onClick={onGenerateResearch} disabled={generateResearchPending}>
                {generateResearchPending ? <Loader2 className="size-3.5 mr-1.5 animate-spin" /> : <Sparkles className="size-3.5 mr-1.5" />}{generateResearchPending ? 'Generating...' : 'Generate AI Research'}
              </Button>
              <Button size="sm" variant="outline" className="h-10 text-xs border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 hover:text-gray-900 min-h-[44px]" onClick={onAddNote}><Plus className="size-3.5 mr-1.5" /> Add Note</Button>
              <Button size="sm" variant="outline" className="h-10 text-xs border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 hover:text-gray-900 min-h-[44px]" onClick={onAddContact}><Plus className="size-3.5 mr-1.5" /> Add Contact</Button>
              <Button size="sm" variant="outline" className="h-10 text-xs border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 hover:text-gray-900 min-h-[44px]" onClick={onAddOpportunity}><Target className="size-3.5 mr-1.5" /> Add Opportunity</Button>
              {contacts.length > 0 && (
                <div className="flex items-center gap-2">
                  <Select value={emailContactId} onValueChange={(v) => onGenerateEmail(v)}>
                    <SelectTrigger className="h-10 w-auto min-w-[140px] text-xs border-gray-200 rounded-lg"><SelectValue placeholder="Select contact" /></SelectTrigger>
                    <SelectContent>{contacts.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}{c.jobTitle ? ` — ${c.jobTitle}` : ''}</SelectItem>)}</SelectContent>
                  </Select>
                  <Button size="sm" variant="outline" className="h-10 text-xs border-amber-200 text-amber-700 rounded-lg hover:bg-amber-50 hover:text-amber-800 min-h-[44px]" onClick={() => onGenerateEmail(emailContactId)} disabled={!emailContactId}>
                    <Mail className="size-3.5 mr-1.5" /> Generate Email
                  </Button>
                </div>
              )}
            </div>
          </div>
          <div className="shrink-0"><ScoreTriple intelligence={intelligenceScoreItem} accountPriority={priorityScoreItem} revenueOpportunity={revenueScoreItem} /></div>
        </div>
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { icon: Users, label: 'Contacts', value: contacts.length, bg: 'bg-blue-50', color: 'text-blue-600' },
            { icon: Target, label: 'Opportunities', value: opportunities.length, bg: 'bg-amber-50', color: 'text-amber-600' },
            { icon: StickyNote, label: 'Notes', value: notes.length, bg: 'bg-violet-50', color: 'text-violet-600' },
            { icon: researchCard ? CheckCircle2 : FileText, label: 'Research', value: researchCard ? `${researchCard.confidenceScore || 0}%` : '—', bg: 'bg-emerald-50', color: researchCard ? 'text-emerald-600' : 'text-gray-600' },
          ].map(stat => (
            <div key={stat.label} className="flex items-center gap-3 rounded-lg bg-gray-50/80 p-3">
              <div className={`flex size-9 rounded-lg ${stat.bg} items-center justify-center shrink-0`}><stat.icon className={`size-4 ${stat.color}`} /></div>
              <div><p className="text-lg font-semibold text-gray-900 tabular-nums">{stat.value}</p><p className="text-[11px] text-gray-500 uppercase tracking-wider font-medium">{stat.label}</p></div>
            </div>
          ))}
        </div>
      </div>

      {/* New account hero */}
      {isStaleIntel && (
        <div className="rounded-lg border border-amber-200 bg-amber-50/40 p-3 flex items-center gap-3">
          <AlertTriangle className="size-4 text-amber-500 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-amber-800">Stale Intelligence</p>
            <p className="text-[11px] text-amber-600">Last enriched {daysSinceEnrichment} days ago. Consider re-running enrichment for up-to-date analysis.</p>
          </div>
          <Button size="sm" className="h-10 text-xs bg-amber-600 hover:bg-amber-700 text-white rounded-md press-scale min-h-[44px]" onClick={onReEnrich} disabled={generateResearchPending}>
            {generateResearchPending ? <Loader2 className="size-3 mr-1 animate-spin" /> : <RefreshCw className="size-3 mr-1" />}Re-enrich
          </Button>
        </div>
      )}
    </>
  )
}

export { RESEARCH_LABELS, researchColors, handleLogoError }
