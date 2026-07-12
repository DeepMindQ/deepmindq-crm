'use client'

import { useState, useMemo } from 'react'
import {
  Search, Building2, Globe, MapPin, Users, ExternalLink,
  Sparkles, AlertTriangle, Target, FileText, Clock, Send,
  Mail, Plus, ChevronDown, ChevronUp, MessageSquare,
  Shield, Calendar, Brain, Lightbulb, Zap,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import {
  MOCK_COMPANIES,
  MOCK_CONTACTS,
  MOCK_DRAFTS,
  MOCK_COMPANY_NOTES,
} from '@/lib/mock-data'
import type { Company, Contact, Draft } from '@/lib/mock-data'

// ── Helpers ────────────────────────────────────────────────────
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  return `${Math.floor(days / 30)}mo ago`
}

function emailHealthColor(status: string) {
  switch (status) {
    case 'valid': return 'text-emerald-400'
    case 'risky': return 'text-amber-400'
    case 'invalid': return 'text-red-400'
    default: return 'text-zinc-400'
  }
}

function scoreColor(score: number) {
  if (score >= 80) return 'text-emerald-400'
  if (score >= 60) return 'text-amber-400'
  return 'text-red-400'
}

function scoreBandColor(band: string) {
  switch (band) {
    case 'hot': return 'text-emerald-400 bg-emerald-400/10'
    case 'warm': return 'text-amber-400 bg-amber-400/10'
    case 'cold': return 'text-zinc-400 bg-zinc-400/10'
    default: return 'text-zinc-400 bg-zinc-400/10'
  }
}

function contactStatusColor(status: string) {
  switch (status) {
    case 'sent': return 'text-emerald-400 bg-emerald-400/10'
    case 'replied': return 'text-sky-400 bg-sky-400/10'
    case 'drafted': return 'text-amber-400 bg-amber-400/10'
    case 'bounced': return 'text-red-400 bg-red-400/10'
    case 'suppressed': return 'text-zinc-500 bg-zinc-500/10'
    default: return 'text-zinc-400 bg-zinc-400/10'
  }
}

function draftStatusColor(status: string) {
  switch (status) {
    case 'approved': return 'text-emerald-400 border-emerald-500/30'
    case 'reviewed': return 'text-sky-400 border-sky-500/30'
    case 'generated': return 'text-amber-400 border-amber-500/30'
    case 'rejected': return 'text-red-400 border-red-500/30'
    default: return 'text-zinc-400 border-zinc-500/30'
  }
}

function batchStatusColor(status: string) {
  switch (status) {
    case 'committed': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
    case 'reviewing': return 'bg-amber-500/10 text-amber-400 border-amber-500/20'
    case 'staged': return 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'
    default: return 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'
  }
}

// ── Main Component ─────────────────────────────────────────────
export function CompaniesScreen() {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [industryFilter, setIndustryFilter] = useState('all')
  const [newNote, setNewNote] = useState('')
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    research: true,
    contacts: true,
    outreach: false,
    notes: true,
  })

  const toggleSection = (key: string) =>
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }))

  // Group contacts by company
  const contactsByCompany = useMemo(() => {
    const map: Record<string, Contact[]> = {}
    MOCK_CONTACTS.forEach(c => {
      if (!map[c.companyId]) map[c.companyId] = []
      map[c.companyId].push(c)
    })
    return map
  }, [])

  // Group drafts by contact
  const draftsByContact = useMemo(() => {
    const map: Record<string, Draft[]> = {}
    MOCK_DRAFTS.forEach(d => {
      if (!map[d.contactId]) map[d.contactId] = []
      map[d.contactId].push(d)
    })
    return map
  }, [])

  // Group drafts by company
  const draftsByCompany = useMemo(() => {
    const map: Record<string, Draft[]> = {}
    MOCK_DRAFTS.forEach(d => {
      if (!map[d.companyId]) map[d.companyId] = []
      map[d.companyId].push(d)
    })
    return map
  }, [])

  // Group notes by company
  const notesByCompany = useMemo(() => {
    const map: Record<string, typeof MOCK_COMPANY_NOTES> = {}
    MOCK_COMPANY_NOTES.forEach(n => {
      if (!map[n.companyId]) map[n.companyId] = []
      map[n.companyId].push(n)
    })
    return map
  }, [])

  // Unique industries
  const industries = useMemo(() => {
    const set = new Set(MOCK_COMPANIES.map(c => c.industry).filter(Boolean))
    return Array.from(set).sort()
  }, [])

  // Filter companies
  const filteredCompanies = useMemo(() => {
    return MOCK_COMPANIES.filter(c => {
      const matchesSearch = !searchQuery ||
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.domain?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.industry?.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesIndustry = industryFilter === 'all' || c.industry === industryFilter
      return matchesSearch && matchesIndustry
    })
  }, [searchQuery, industryFilter])

  // Selected company data
  const selectedCompany = useMemo(
    () => MOCK_COMPANIES.find(c => c.id === selectedId) ?? null,
    [selectedId],
  )
  const selectedContacts = selectedId ? (contactsByCompany[selectedId] ?? []) : []
  const selectedDrafts = selectedId ? (draftsByCompany[selectedId] ?? []) : []
  const selectedNotes = selectedId ? (notesByCompany[selectedId] ?? []) : []

  // Compute avg score for company
  const companyAvgScore = useMemo(() => {
    if (!selectedContacts.length) return 0
    const sum = selectedContacts.reduce((acc, c) => acc + c.score, 0)
    return Math.round(sum / selectedContacts.length)
  }, [selectedContacts])

  const handleAddNote = () => {
    if (!newNote.trim() || !selectedId) return
    toast.success('Note added successfully')
    setNewNote('')
  }

  return (
    <div className="flex h-full min-h-0">
      {/* ─── LEFT: Company List ─── */}
      <aside className="w-[350px] shrink-0 border-r border-border flex flex-col bg-card/50">
        {/* Search & Filter */}
        <div className="p-4 space-y-3 border-b border-border">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Search companies..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9 h-9 bg-background border-border text-sm"
            />
          </div>
          <Select value={industryFilter} onValueChange={setIndustryFilter}>
            <SelectTrigger className="h-8 bg-background border-border text-xs">
              <SelectValue placeholder="All Industries" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Industries</SelectItem>
              {industries.map(ind => (
                <SelectItem key={ind} value={ind}>{ind}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-[11px] text-muted-foreground">{filteredCompanies.length} companies</p>
        </div>

        {/* Company Cards */}
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {filteredCompanies.map(company => {
              const contactCount = company.contactCount
              const companyContacts = contactsByCompany[company.id] ?? []
              const avgScore = companyContacts.length
                ? Math.round(companyContacts.reduce((a, c) => a + c.score, 0) / companyContacts.length)
                : 0
              const isActive = selectedId === company.id
              return (
                <button
                  key={company.id}
                  onClick={() => setSelectedId(company.id)}
                  className={cn(
                    'w-full text-left p-3 rounded-lg transition-all duration-150 group',
                    'hover:bg-secondary/50',
                    isActive
                      ? 'bg-secondary/80 border border-amber-500/40 shadow-[0_0_0_1px_rgba(245,158,11,0.15)]'
                      : 'border border-transparent',
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className={cn(
                        'text-sm font-semibold truncate',
                        isActive ? 'text-amber-400' : 'text-foreground',
                      )}>
                        {company.name}
                      </p>
                      <p className="text-xs text-muted-foreground truncate mt-0.5 flex items-center gap-1">
                        <Globe className="size-3 shrink-0" />
                        {company.domain}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 border-border font-medium shrink-0">
                      {company.industry}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5">
                      <Users className="size-2.5 mr-1" />
                      {company.employeeSizeBand}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">
                      {contactCount} contact{contactCount !== 1 ? 's' : ''}
                    </span>
                  </div>

                  <div className="flex items-center justify-between mt-2.5">
                    <span className="text-[10px] text-muted-foreground">
                      Researched {timeAgo(company.lastResearchedAt)}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <div className="w-16 h-1.5 rounded-full bg-secondary overflow-hidden">
                        <div
                          className={cn(
                            'h-full rounded-full transition-all',
                            avgScore >= 80 ? 'bg-emerald-500' :
                            avgScore >= 60 ? 'bg-amber-500' : 'bg-red-500',
                          )}
                          style={{ width: `${avgScore}%` }}
                        />
                      </div>
                      <span className={cn('text-[10px] font-medium tabular-nums', scoreColor(avgScore))}>
                        {avgScore}
                      </span>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </ScrollArea>
      </aside>

      {/* ─── RIGHT: Company Detail ─── */}
      <main className="flex-1 min-w-0 overflow-hidden">
        {!selectedCompany ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-6">
            <div className="size-16 rounded-2xl bg-secondary/50 flex items-center justify-center mb-4">
              <Building2 className="size-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-1">Select a company</h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              Choose a company from the list to view intelligence, contacts, research, and outreach history.
            </p>
          </div>
        ) : (
          <ScrollArea className="h-full">
            <div className="p-6 space-y-6 max-w-5xl">
              {/* ── Header ── */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-3">
                    <h2 className="text-xl font-bold text-foreground">{selectedCompany.name}</h2>
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-sm text-muted-foreground flex items-center gap-1">
                      <Globe className="size-3.5" />
                      {selectedCompany.domain}
                    </span>
                    {selectedCompany.website && (
                      <a
                        href={selectedCompany.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 transition-colors"
                      >
                        Visit Website <ExternalLink className="size-3" />
                      </a>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="text-xs border-border">
                    <Building2 className="size-3 mr-1" />
                    {selectedCompany.industry}
                  </Badge>
                  <Badge variant="outline" className="text-xs border-border">
                    <Users className="size-3 mr-1" />
                    {selectedCompany.employeeSizeBand}
                  </Badge>
                  <Badge variant="outline" className="text-xs border-border">
                    <MapPin className="size-3 mr-1" />
                    {selectedCompany.location}
                  </Badge>
                </div>
              </div>

              <Separator className="bg-border" />

              {/* ── Research Card ── */}
              <section className="rounded-xl border border-amber-500/20 bg-card/80 overflow-hidden">
                <button
                  onClick={() => toggleSection('research')}
                  className="w-full flex items-center justify-between p-4 hover:bg-secondary/30 transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="size-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                      <Brain className="size-4 text-amber-400" />
                    </div>
                    <div className="text-left">
                      <h3 className="text-sm font-semibold text-foreground">Research Card</h3>
                      <p className="text-[11px] text-muted-foreground">AI-generated company intelligence</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] text-muted-foreground hidden sm:inline">
                      Last researched: {formatDate(selectedCompany.lastResearchedAt)}
                    </span>
                    {expandedSections.research
                      ? <ChevronUp className="size-4 text-muted-foreground" />
                      : <ChevronDown className="size-4 text-muted-foreground" />
                    }
                  </div>
                </button>

                {expandedSections.research && (
                  <div className="px-4 pb-4 space-y-4">
                    {/* Company Context */}
                    <div className="rounded-lg bg-secondary/30 p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <Sparkles className="size-3.5 text-amber-400" />
                        <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">Company Context</h4>
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {selectedCompany.researchSummary}
                      </p>
                    </div>

                    {/* Pain Points */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="size-3.5 text-red-400" />
                        <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">Pain Points</h4>
                      </div>
                      <ul className="space-y-1.5 pl-6">
                        {selectedCompany.painPoints.map((pp, i) => (
                          <li key={i} className="text-sm text-muted-foreground leading-relaxed flex items-start gap-2">
                            <span className="text-red-400/60 mt-1.5 shrink-0">•</span>
                            {pp}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Opportunity Hypotheses */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Lightbulb className="size-3.5 text-emerald-400" />
                        <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">Opportunity Hypotheses</h4>
                      </div>
                      <ul className="space-y-1.5 pl-6">
                        {selectedCompany.opportunityHypotheses.map((oh, i) => (
                          <li key={i} className="text-sm text-muted-foreground leading-relaxed flex items-start gap-2">
                            <span className="text-emerald-400/60 mt-1.5 shrink-0">•</span>
                            {oh}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Intelligence Score */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="rounded-lg bg-secondary/20 p-3">
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Intel Score (Avg Contact)</p>
                        <div className="flex items-center gap-2">
                          <span className={cn('text-2xl font-bold tabular-nums', scoreColor(companyAvgScore))}>
                            {companyAvgScore}
                          </span>
                          <span className="text-xs text-muted-foreground">/ 100</span>
                        </div>
                      </div>
                      <div className="rounded-lg bg-secondary/20 p-3">
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Contacts</p>
                        <div className="flex items-center gap-2">
                          <span className="text-2xl font-bold tabular-nums text-foreground">{selectedContacts.length}</span>
                          <span className="text-xs text-muted-foreground">linked</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </section>

              {/* ── Linked Contacts ── */}
              <section className="rounded-xl border border-border bg-card/80 overflow-hidden">
                <button
                  onClick={() => toggleSection('contacts')}
                  className="w-full flex items-center justify-between p-4 hover:bg-secondary/30 transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="size-8 rounded-lg bg-sky-500/10 flex items-center justify-center">
                      <Users className="size-4 text-sky-400" />
                    </div>
                    <div className="text-left">
                      <h3 className="text-sm font-semibold text-foreground">Linked Contacts</h3>
                      <p className="text-[11px] text-muted-foreground">{selectedContacts.length} contact{selectedContacts.length !== 1 ? 's' : ''} at this company</p>
                    </div>
                  </div>
                  {expandedSections.contacts
                    ? <ChevronUp className="size-4 text-muted-foreground" />
                    : <ChevronDown className="size-4 text-muted-foreground" />
                  }
                </button>

                {expandedSections.contacts && (
                  <div className="px-4 pb-4">
                    {selectedContacts.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-6 text-center">No contacts linked to this company.</p>
                    ) : (
                      <div className="rounded-lg border border-border overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow className="border-border hover:bg-transparent">
                              <TableHead className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Name</TableHead>
                              <TableHead className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider hidden sm:table-cell">Email</TableHead>
                              <TableHead className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">Status</TableHead>
                              <TableHead className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Score</TableHead>
                              <TableHead className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider text-right">Action</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {selectedContacts.map(contact => (
                              <TableRow key={contact.id} className="border-border table-row-hover">
                                <TableCell className="py-2.5">
                                  <div>
                                    <p className="text-sm font-medium text-foreground">{contact.name}</p>
                                    <p className="text-[11px] text-muted-foreground sm:hidden truncate max-w-[180px]">{contact.emailAddress}</p>
                                    <p className="text-[11px] text-muted-foreground">{contact.jobTitle}</p>
                                  </div>
                                </TableCell>
                                <TableCell className="py-2.5 hidden sm:table-cell">
                                  <span className={cn('text-xs', emailHealthColor(contact.emailHealthStatus))}>
                                    {contact.emailAddress}
                                  </span>
                                </TableCell>
                                <TableCell className="py-2.5 hidden md:table-cell">
                                  <Badge variant="outline" className={cn('text-[10px] border', contactStatusColor(contact.status))}>
                                    {contact.status}
                                  </Badge>
                                </TableCell>
                                <TableCell className="py-2.5 hidden lg:table-cell">
                                  <div className="flex items-center gap-2">
                                    <Badge variant="outline" className={cn('text-[10px] border', scoreBandColor(contact.scoreBand))}>
                                      {contact.scoreBand}
                                    </Badge>
                                    <span className={cn('text-xs font-medium tabular-nums', scoreColor(contact.score))}>
                                      {contact.score}
                                    </span>
                                  </div>
                                </TableCell>
                                <TableCell className="py-2.5 text-right">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-[11px] px-2.5 border-amber-500/30 text-amber-400 hover:bg-amber-500/10 hover:text-amber-300"
                                    onClick={() => toast.info(`Draft generation started for ${contact.name}`)}
                                  >
                                    <Sparkles className="size-3 mr-1" />
                                    Generate
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </div>
                )}
              </section>

              {/* ── Outreach History ── */}
              <section className="rounded-xl border border-border bg-card/80 overflow-hidden">
                <button
                  onClick={() => toggleSection('outreach')}
                  className="w-full flex items-center justify-between p-4 hover:bg-secondary/30 transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="size-8 rounded-lg bg-violet-500/10 flex items-center justify-center">
                      <Send className="size-4 text-violet-400" />
                    </div>
                    <div className="text-left">
                      <h3 className="text-sm font-semibold text-foreground">Outreach History</h3>
                      <p className="text-[11px] text-muted-foreground">{selectedDrafts.length} draft{selectedDrafts.length !== 1 ? 's' : ''}</p>
                    </div>
                  </div>
                  {expandedSections.outreach
                    ? <ChevronUp className="size-4 text-muted-foreground" />
                    : <ChevronDown className="size-4 text-muted-foreground" />
                  }
                </button>

                {expandedSections.outreach && (
                  <div className="px-4 pb-4">
                    {selectedDrafts.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-6 text-center">No outreach history for this company.</p>
                    ) : (
                      <div className="space-y-2 max-h-80 overflow-y-auto">
                        {selectedDrafts.map(draft => {
                          const contact = MOCK_CONTACTS.find(c => c.id === draft.contactId)
                          return (
                            <div
                              key={draft.id}
                              className="flex items-start gap-3 p-3 rounded-lg bg-secondary/20 hover:bg-secondary/30 transition-colors"
                            >
                              <div className={cn(
                                'mt-0.5 size-8 rounded-lg flex items-center justify-center shrink-0',
                                draft.status === 'approved' ? 'bg-emerald-500/10' : 'bg-amber-500/10',
                              )}>
                                {draft.status === 'approved'
                                  ? <Mail className="size-3.5 text-emerald-400" />
                                  : <FileText className="size-3.5 text-amber-400" />
                                }
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="text-sm font-medium text-foreground truncate">{draft.subject}</p>
                                  <Badge variant="outline" className={cn('text-[10px] border shrink-0', draftStatusColor(draft.status))}>
                                    {draft.status}
                                  </Badge>
                                </div>
                                <div className="flex items-center gap-3 mt-1">
                                  <span className="text-[11px] text-muted-foreground">To: {contact?.name ?? 'Unknown'}</span>
                                  <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                                    <Calendar className="size-3" />
                                    {formatDate(draft.createdAt)}
                                  </span>
                                  <span className={cn('text-[11px] font-medium tabular-nums', scoreColor(draft.confidenceScore))}>
                                    Conf: {draft.confidenceScore}%
                                  </span>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}
              </section>

              {/* ── Internal Notes ── */}
              <section className="rounded-xl border border-border bg-card/80 overflow-hidden">
                <button
                  onClick={() => toggleSection('notes')}
                  className="w-full flex items-center justify-between p-4 hover:bg-secondary/30 transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="size-8 rounded-lg bg-zinc-500/10 flex items-center justify-center">
                      <MessageSquare className="size-4 text-zinc-400" />
                    </div>
                    <div className="text-left">
                      <h3 className="text-sm font-semibold text-foreground">Internal Notes</h3>
                      <p className="text-[11px] text-muted-foreground">{selectedNotes.length} note{selectedNotes.length !== 1 ? 's' : ''}</p>
                    </div>
                  </div>
                  {expandedSections.notes
                    ? <ChevronUp className="size-4 text-muted-foreground" />
                    : <ChevronDown className="size-4 text-muted-foreground" />
                  }
                </button>

                {expandedSections.notes && (
                  <div className="px-4 pb-4 space-y-4">
                    <div className="space-y-2">
                      <Textarea
                        placeholder="Add a note about this company..."
                        value={newNote}
                        onChange={e => setNewNote(e.target.value)}
                        className="min-h-[80px] text-sm bg-background border-border resize-none"
                      />
                      <div className="flex justify-end">
                        <Button
                          size="sm"
                          disabled={!newNote.trim()}
                          onClick={handleAddNote}
                          className="h-8 text-xs bg-amber-600 hover:bg-amber-700 text-white"
                        >
                          <Plus className="size-3 mr-1" />
                          Add Note
                        </Button>
                      </div>
                    </div>

                    {selectedNotes.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-4 text-center">No notes yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {selectedNotes.map(note => (
                          <div key={note.id} className="p-3 rounded-lg bg-secondary/20 space-y-1.5">
                            <p className="text-sm text-muted-foreground leading-relaxed">{note.body}</p>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-[10px] border-border text-muted-foreground">
                                {note.noteType}
                              </Badge>
                              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                <Clock className="size-3" />
                                {formatDate(note.createdAt)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </section>
            </div>
          </ScrollArea>
        )}
      </main>
    </div>
  )
}