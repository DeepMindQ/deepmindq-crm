'use client'

import { useState, useMemo } from 'react'
import {
  Search, SlidersHorizontal, FileDown, FileSpreadsheet, Tag, Plus,
  MoreHorizontal, ChevronDown, ChevronUp, ArrowUpDown,
  Mail, Pencil, Trash2, Eye, Copy, Ban,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableHeader, TableRow, TableHead, TableBody, TableCell,
} from '@/components/ui/table'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { ScrollArea } from '@/components/ui/scroll-area'
import { MOCK_LEADS, type LeadStatus, type ScoreTier } from '@/lib/mock-data'
import { useAppStore } from '@/lib/store'
import { formatDistanceToNow } from 'date-fns'

/* ═══════════════════════════════════════════════════════════════════════
   Constants & Mappings
   ═══════════════════════════════════════════════════════════════════════ */

const STATUS_STYLES: Record<LeadStatus, string> = {
  imported:    'bg-gray-500/15 text-gray-400 border-gray-500/20',
  cleaned:     'bg-blue-500/15 text-blue-400 border-blue-500/20',
  ready:       'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  drafted:     'bg-amber-500/15 text-amber-400 border-amber-500/20',
  queued:      'bg-purple-500/15 text-purple-400 border-purple-500/20',
  sent:        'bg-cyan-500/15 text-cyan-400 border-cyan-500/20',
  replied:     'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  bounced:     'bg-red-500/15 text-red-400 border-red-500/20',
  suppressed:  'bg-gray-500/15 text-gray-500 border-gray-500/20 line-through',
  archived:    'bg-muted text-muted-foreground border-muted',
}

const SCORE_STYLES: Record<ScoreTier, string> = {
  hot:  'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  warm: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
  cold: 'bg-muted text-muted-foreground border-muted',
}

const EMAIL_HEALTH_DOT: Record<string, string> = {
  valid:   'bg-emerald-400',
  risky:   'bg-amber-400',
  invalid: 'bg-red-400',
  unknown: 'bg-gray-500',
}

const EMAIL_HEALTH_LABEL: Record<string, string> = {
  valid:   'Valid',
  risky:   'Risky',
  invalid: 'Invalid',
  unknown: 'Unknown',
}

const INDUSTRIES = [...new Set(MOCK_LEADS.map(l => l.industry))].sort()
const ROLES = ['All', 'Executive', 'Manager', 'Technical', 'Operations', 'Sales', 'Other']

const SAVED_SEGMENTS = [
  { id: 'all', label: 'All Leads' },
  { id: 'hot', label: 'Hot Leads (80+)' },
  { id: 'ready', label: 'Ready for Drafting' },
  { id: 'recent', label: 'Recently Imported' },
  { id: 'risk', label: 'At Risk' },
]

const PAGE_SIZE = 20

/* ═══════════════════════════════════════════════════════════════════════
   Leads Screen
   ═══════════════════════════════════════════════════════════════════════ */

export function LeadsScreen() {
  const { setSelectedContactId } = useAppStore()

  // ── Filter State ──
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [industryFilter, setIndustryFilter] = useState<string>('all')
  const [healthFilter, setHealthFilter] = useState<string>('all')
  const [scoreFilter, setScoreFilter] = useState<string>('all')
  const [segment, setSegment] = useState('all')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [page, setPage] = useState(1)

  // ── Computed filtered leads ──
  const filtered = useMemo(() => {
    let leads = [...MOCK_LEADS]

    // Segment pre-filters
    if (segment === 'hot') leads = leads.filter(l => l.score >= 80)
    if (segment === 'ready') leads = leads.filter(l => l.status === 'ready')
    if (segment === 'recent') leads = leads.filter(l => {
      const created = new Date(l.lastContactedAt || l.id)
      return (Date.now() - created.getTime()) < 14 * 86400000
    })
    if (segment === 'risk') leads = leads.filter(l => l.emailHealth === 'risky' || l.emailHealth === 'invalid' || l.status === 'bounced')

    if (search) {
      const q = search.toLowerCase()
      leads = leads.filter(l =>
        l.name.toLowerCase().includes(q) ||
        l.email.toLowerCase().includes(q) ||
        l.company.toLowerCase().includes(q) ||
        l.jobTitle.toLowerCase().includes(q)
      )
    }
    if (statusFilter !== 'all') leads = leads.filter(l => l.status === statusFilter)
    if (roleFilter !== 'all') leads = leads.filter(l => l.roleBucket === roleFilter)
    if (industryFilter !== 'all') leads = leads.filter(l => l.industry === industryFilter)
    if (healthFilter !== 'all') leads = leads.filter(l => l.emailHealth === healthFilter)
    if (scoreFilter !== 'all') {
      if (scoreFilter === 'hot') leads = leads.filter(l => l.score >= 80)
      else if (scoreFilter === 'warm') leads = leads.filter(l => l.score >= 60 && l.score < 80)
      else if (scoreFilter === 'cold') leads = leads.filter(l => l.score < 60)
    }

    return leads
  }, [search, statusFilter, roleFilter, industryFilter, healthFilter, scoreFilter, segment])

  const totalFiltered = filtered.length
  const totalPages = Math.max(1, Math.ceil(totalFiltered / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)
  const showingFrom = totalFiltered === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1
  const showingTo = Math.min(safePage * PAGE_SIZE, totalFiltered)

  // ── Selection ──
  const allOnPageSelected = paged.length > 0 && paged.every(l => selectedIds.has(l.id))
  const toggleAll = () => {
    if (allOnPageSelected) {
      setSelectedIds(prev => { const next = new Set(prev); paged.forEach(l => next.delete(l.id)); return next })
    } else {
      setSelectedIds(prev => { const next = new Set(prev); paged.forEach(l => next.add(l.id)); return next })
    }
  }
  const toggleOne = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="space-y-4">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Lead Database</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {MOCK_LEADS.length.toLocaleString()} contacts
            {totalFiltered !== MOCK_LEADS.length && (
              <span className="text-primary font-medium"> — {totalFiltered.toLocaleString()} shown</span>
            )}
          </p>
        </div>
      </div>

      {/* ── Search ── */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder="Search leads by name, email, company, or title..."
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1) }}
          className="pl-10 h-10 bg-card border-border text-foreground placeholder:text-muted-foreground/60"
        />
      </div>

      {/* ── Saved Segments ── */}
      <div className="flex flex-wrap gap-2">
        {SAVED_SEGMENTS.map(seg => (
          <Button
            key={seg.id}
            variant={segment === seg.id ? 'default' : 'outline'}
            size="sm"
            className={`h-7 text-xs rounded-full px-3 ${
              segment === seg.id
                ? 'bg-primary text-primary-foreground'
                : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
            onClick={() => { setSegment(seg.id); setPage(1) }}
          >
            {seg.label}
          </Button>
        ))}
      </div>

      {/* ── Filter Row ── */}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setPage(1) }}>
          <SelectTrigger size="sm" className="w-[140px] border-border bg-card text-foreground">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent className="bg-popover border-border">
            <SelectItem value="all">All Statuses</SelectItem>
            {(['imported','cleaned','ready','drafted','queued','sent','replied','bounced','suppressed','archived'] as LeadStatus[]).map(s => (
              <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={roleFilter} onValueChange={v => { setRoleFilter(v); setPage(1) }}>
          <SelectTrigger size="sm" className="w-[130px] border-border bg-card text-foreground">
            <SelectValue placeholder="Role" />
          </SelectTrigger>
          <SelectContent className="bg-popover border-border">
            {ROLES.map(r => (
              <SelectItem key={r} value={r}>{r}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={industryFilter} onValueChange={v => { setIndustryFilter(v); setPage(1) }}>
          <SelectTrigger size="sm" className="w-[160px] border-border bg-card text-foreground">
            <SelectValue placeholder="Industry" />
          </SelectTrigger>
          <SelectContent className="bg-popover border-border max-h-60">
            <SelectItem value="all">All Industries</SelectItem>
            {INDUSTRIES.map(i => (
              <SelectItem key={i} value={i}>{i}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={healthFilter} onValueChange={v => { setHealthFilter(v); setPage(1) }}>
          <SelectTrigger size="sm" className="w-[140px] border-border bg-card text-foreground">
            <SelectValue placeholder="Email Health" />
          </SelectTrigger>
          <SelectContent className="bg-popover border-border">
            <SelectItem value="all">All Health</SelectItem>
            {['valid','risky','invalid','unknown'].map(h => (
              <SelectItem key={h} value={h} className="capitalize">{EMAIL_HEALTH_LABEL[h]}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={scoreFilter} onValueChange={v => { setScoreFilter(v); setPage(1) }}>
          <SelectTrigger size="sm" className="w-[120px] border-border bg-card text-foreground">
            <SelectValue placeholder="Score" />
          </SelectTrigger>
          <SelectContent className="bg-popover border-border">
            <SelectItem value="all">All Scores</SelectItem>
            <SelectItem value="hot">Hot (80+)</SelectItem>
            <SelectItem value="warm">Warm (60-79)</SelectItem>
            <SelectItem value="cold">Cold (&lt;60)</SelectItem>
          </SelectContent>
        </Select>

        {(statusFilter !== 'all' || roleFilter !== 'all' || industryFilter !== 'all' || healthFilter !== 'all' || scoreFilter !== 'all') && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => {
              setStatusFilter('all'); setRoleFilter('all'); setIndustryFilter('all')
              setHealthFilter('all'); setScoreFilter('all'); setPage(1)
            }}
          >
            Clear filters
          </Button>
        )}
      </div>

      {/* ── Bulk Actions ── */}
      {selectedIds.size > 0 && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-3 flex items-center gap-3 flex-wrap">
            <span className="text-sm font-medium text-foreground">
              {selectedIds.size} selected
            </span>
            <Separator orientation="vertical" className="h-5 bg-border" />
            <Button variant="outline" size="sm" className="h-7 text-xs border-border text-foreground gap-1.5">
              <Pencil className="size-3" /> Generate Drafts
            </Button>
            <Button variant="outline" size="sm" className="h-7 text-xs border-border text-foreground gap-1.5">
              <Plus className="size-3" /> Add to Queue
            </Button>
            <Button variant="outline" size="sm" className="h-7 text-xs border-border text-foreground gap-1.5">
              <FileDown className="size-3" /> Export
            </Button>
            <Button variant="outline" size="sm" className="h-7 text-xs border-border text-red-400 gap-1.5">
              <Ban className="size-3" /> Suppress
            </Button>
            <Button variant="outline" size="sm" className="h-7 text-xs border-border text-foreground gap-1.5">
              <Tag className="size-3" /> Tag
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── Main Table ── */}
      <Card className="border-border bg-card overflow-hidden">
        <ScrollArea className="max-h-[600px]">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-card">
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="w-10 px-3">
                  <Checkbox checked={allOnPageSelected} onCheckedChange={toggleAll} />
                </TableHead>
                <TableHead className="text-muted-foreground text-xs font-medium">
                  <button className="flex items-center gap-1 hover:text-foreground transition-colors">
                    Name & Company <ArrowUpDown className="size-3" />
                  </button>
                </TableHead>
                <TableHead className="text-muted-foreground text-xs font-medium">
                  <button className="flex items-center gap-1 hover:text-foreground transition-colors">
                    Title & Role <ArrowUpDown className="size-3" />
                  </button>
                </TableHead>
                <TableHead className="text-muted-foreground text-xs font-medium">Email</TableHead>
                <TableHead className="text-muted-foreground text-xs font-medium">
                  <button className="flex items-center gap-1 hover:text-foreground transition-colors">
                    Score <ArrowUpDown className="size-3" />
                  </button>
                </TableHead>
                <TableHead className="text-muted-foreground text-xs font-medium">Status</TableHead>
                <TableHead className="text-muted-foreground text-xs font-medium hidden xl:table-cell">Source Batch</TableHead>
                <TableHead className="text-muted-foreground text-xs font-medium hidden lg:table-cell">Last Contacted</TableHead>
                <TableHead className="w-10 px-3" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-32 text-center text-muted-foreground text-sm">
                    No leads match your filters.
                  </TableCell>
                </TableRow>
              ) : (
                paged.map((lead, idx) => (
                  <TableRow
                    key={lead.id}
                    className={`border-border/50 transition-colors ${
                      selectedIds.has(lead.id) ? 'bg-primary/5' : ''
                    } hover:bg-muted/30`}
                  >
                    {/* Checkbox */}
                    <TableCell className="px-3">
                      <Checkbox
                        checked={selectedIds.has(lead.id)}
                        onCheckedChange={() => toggleOne(lead.id)}
                      />
                    </TableCell>

                    {/* Name + Company */}
                    <TableCell className="py-2.5 pr-4">
                      <button
                        className="text-left group"
                        onClick={() => setSelectedContactId(lead.id)}
                      >
                        <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors leading-tight">
                          {lead.name}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-0.5 truncate max-w-[180px]">
                          {lead.company}
                        </p>
                      </button>
                    </TableCell>

                    {/* Title & Role */}
                    <TableCell className="py-2.5 pr-4">
                      <p className="text-xs text-foreground/80 truncate max-w-[160px]">
                        {lead.jobTitle}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {lead.roleBucket}
                      </p>
                    </TableCell>

                    {/* Email with health indicator */}
                    <TableCell className="py-2.5 pr-4">
                      <div className="flex items-center gap-2">
                        <span className={`size-2 rounded-full shrink-0 ${EMAIL_HEALTH_DOT[lead.emailHealth]}`} />
                        <span className="text-xs text-foreground/80 truncate max-w-[180px]">
                          {lead.email}
                        </span>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="text-[10px] text-muted-foreground shrink-0">
                              {EMAIL_HEALTH_LABEL[lead.emailHealth]}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="bg-popover text-popover-foreground border-border text-xs">
                            Email health: {EMAIL_HEALTH_LABEL[lead.emailHealth]}
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </TableCell>

                    {/* Score */}
                    <TableCell className="py-2.5 pr-4">
                      <Badge
                        variant="outline"
                        className={`text-[10px] font-semibold tabular-nums rounded-md px-1.5 py-0 ${SCORE_STYLES[lead.scoreTier]}`}
                      >
                        {lead.score}
                      </Badge>
                    </TableCell>

                    {/* Status */}
                    <TableCell className="py-2.5 pr-4">
                      <Badge
                        variant="outline"
                        className={`text-[10px] font-medium rounded-md px-1.5 py-0 capitalize ${STATUS_STYLES[lead.status]}`}
                      >
                        {lead.status}
                      </Badge>
                    </TableCell>

                    {/* Source Batch */}
                    <TableCell className="py-2.5 pr-4 hidden xl:table-cell">
                      <span className="text-[11px] text-muted-foreground truncate max-w-[180px] block">
                        {lead.sourceBatch}
                      </span>
                    </TableCell>

                    {/* Last Contacted */}
                    <TableCell className="py-2.5 pr-4 hidden lg:table-cell">
                      {lead.lastContactedAt ? (
                        <span className="text-[11px] text-muted-foreground">
                          {formatDistanceToNow(new Date(lead.lastContactedAt), { addSuffix: true })}
                        </span>
                      ) : (
                        <span className="text-[11px] text-muted-foreground/50">Never</span>
                      )}
                    </TableCell>

                    {/* Actions Menu */}
                    <TableCell className="px-3 py-2.5">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="size-7 p-0 text-muted-foreground hover:text-foreground">
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-popover border-border w-44 rounded-lg">
                          <DropdownMenuItem className="text-sm text-foreground cursor-pointer rounded-md">
                            <Eye className="size-3.5 mr-2 text-muted-foreground" /> View Profile
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-sm text-foreground cursor-pointer rounded-md">
                            <Mail className="size-3.5 mr-2 text-muted-foreground" /> Generate Email
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-sm text-foreground cursor-pointer rounded-md">
                            <Copy className="size-3.5 mr-2 text-muted-foreground" /> Copy Email
                          </DropdownMenuItem>
                          <DropdownMenuSeparator className="bg-border" />
                          <DropdownMenuItem className="text-sm text-red-400 cursor-pointer rounded-md">
                            <Trash2 className="size-3.5 mr-2" /> Suppress Lead
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </Card>

      {/* ── Pagination ── */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Showing <span className="font-medium text-foreground tabular-nums">{showingFrom}</span>–<span className="font-medium text-foreground tabular-nums">{showingTo}</span> of{' '}
          <span className="font-medium text-foreground tabular-nums">{totalFiltered.toLocaleString()}</span>
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs border-border text-muted-foreground"
            disabled={safePage <= 1}
            onClick={() => setPage(p => p - 1)}
          >
            Previous
          </Button>
          <div className="flex items-center gap-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
              <Button
                key={p}
                variant={p === safePage ? 'default' : 'ghost'}
                size="sm"
                className={`size-8 p-0 text-xs tabular-nums rounded-md ${
                  p === safePage
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
                onClick={() => setPage(p)}
              >
                {p}
              </Button>
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs border-border text-muted-foreground"
            disabled={safePage >= totalPages}
            onClick={() => setPage(p => p + 1)}
          >
            Next
          </Button>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs border-border text-foreground gap-1.5"
        >
          <FileSpreadsheet className="size-3.5" /> Export CSV
        </Button>
      </div>
    </div>
  )
}