'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, Building2, Globe, MapPin, Users, Plus, Target, StickyNote, FileText,
  Sparkles, Mail, Phone, ExternalLink, Linkedin, DollarSign, Calendar,
  CheckCircle2, XCircle, Clock, BarChart3,
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

export default function CompanyProfileScreen() {
  const { selectedCompanyId, setActiveView } = useAppStore()
  const qc = useQueryClient()
  const [noteOpen, setNoteOpen] = useState(false)
  const [noteBody, setNoteBody] = useState('')
  const [noteType, setNoteType] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['company', selectedCompanyId],
    queryFn: () => fetch(`/api/companies/${selectedCompanyId}`).then(r => r.json()),
    enabled: !!selectedCompanyId,
  })

  const addNote = useMutation({
    mutationFn: (body: { body: string; noteType: string }) =>
      fetch('/api/notes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, companyId: selectedCompanyId }) }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['company'] }); setNoteOpen(false); setNoteBody(''); setNoteType(''); toast.success('Note added') },
    onError: () => toast.error('Failed to add note'),
  })

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
      <div className="rounded-xl bg-white p-6 card-rest slide-up">
        <div className="flex items-start gap-5">
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
              <button onClick={() => { const s = data.status === 'archived' ? 'new' : 'archived'; toast.success(`Status changed to ${s}`) }}
                className={`text-[11px] font-medium px-2 py-0.5 rounded-md border ${statusBg(data.status)}`}>
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
              <Button size="sm" className="h-8 text-xs bg-amber-600 hover:bg-amber-700 text-white rounded-lg press-scale shadow-xs" onClick={() => toast.info('Research triggered!')}>
                <Sparkles className="size-3.5 mr-1.5" /> Generate Research
              </Button>
              <Button size="sm" variant="outline" className="h-8 text-xs border-gray-200 text-gray-600 rounded-lg" onClick={() => setNoteOpen(true)}>
                <Plus className="size-3.5 mr-1.5" /> Add Note
              </Button>
              <Button size="sm" variant="outline" className="h-8 text-xs border-gray-200 text-gray-600 rounded-lg" onClick={() => toast.info('Contact form coming soon')}>
                <Plus className="size-3.5 mr-1.5" /> Add Contact
              </Button>
              <Button size="sm" variant="outline" className="h-8 text-xs border-gray-200 text-gray-600 rounded-lg" onClick={() => toast.info('Email generation coming soon')}>
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
        <TabsList className="bg-gray-100 rounded-lg p-1 h-auto gap-0.5">
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
                <Button size="sm" className="h-7 text-xs bg-gray-900 text-white hover:bg-gray-800 rounded-md press-scale" onClick={() => toast.info('Research triggered!')}>
                  <Sparkles className="size-3 mr-1" /> Generate
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
            <EmptyState icon={Users} title="No contacts found" description="Add contacts to this company to start tracking outreach." actionLabel="Add Contact" onAction={() => toast.info('Contact form coming soon')} />
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
                    <TableRow key={c.id} className="table-row-hover border-gray-50">
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
            <EmptyState icon={Target} title="No opportunities yet" description="Create opportunities to track potential deals with this company." actionLabel="Add Opportunity" onAction={() => toast.info('Coming soon')} />
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
                  <span className={`shrink-0 inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium capitalize border ${statusBg(o.status)}`}>{o.status}</span>
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
                  <p className="text-sm text-gray-700 leading-relaxed">{n.body}</p>
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
            <Button onClick={() => addNote.mutate({ body: noteBody, noteType: noteType })} disabled={!noteBody.trim() || addNote.isPending} className="bg-gray-900 text-white hover:bg-gray-800 press-scale">Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}