'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Globe, MapPin, Users, Plus, Target, StickyNote, FileText } from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { formatDistanceToNow } from 'date-fns'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const scoreColor = (s: number | null) =>
  s == null ? 'text-muted-foreground' : s >= 80 ? 'text-[#D4AF37]' : s >= 50 ? 'text-amber-600' : 'text-red-400'

const healthVariant = (h: string) =>
  h === 'valid' ? 'bg-[#D4AF37]/15 text-[#D4AF37]' : h === 'risky' ? 'bg-amber-100 text-amber-700' : h === 'invalid' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'

const statusVariant = (s: string) =>
  s === 'open' ? 'bg-[#D4AF37]/15 text-[#D4AF37]' : s === 'won' ? 'bg-blue-100 text-blue-700' : s === 'lost' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'

const RESEARCH_LABELS: Record<string, string> = {
  businessOverview: 'Business Overview', currentTechLandscape: 'Tech Landscape',
  potentialChallenges: 'Challenges', possibleOpportunities: 'Opportunities',
  relevantServices: 'Relevant Services', keyDecisionMakers: 'Decision Makers',
  lastInteraction: 'Last Interaction', nextAction: 'Next Action',
}

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

  if (!selectedCompanyId) return <p className="text-sm text-muted-foreground">No company selected.</p>
  if (isLoading) return <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-32" /><Skeleton className="h-64" /></div>
  if (!data) return <p className="text-sm text-muted-foreground">Company not found.</p>

  const { contacts = [], notes = [], researchCard, opportunities = [], timeline = [] } = data

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => setActiveView('companies')}><ArrowLeft className="size-4" /></Button>
        <div className="min-w-0">
          <h2 className="text-xl font-semibold truncate">{data.name}</h2>
          <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
            {data.domain && <span className="flex items-center gap-1"><Globe className="size-3.5" />{data.domain}</span>}
            {data.industry && <Badge variant="secondary" className="text-xs">{data.industry}</Badge>}
            {data.country && <span>{data.country}</span>}
          </div>
        </div>
        <div className="ml-auto text-right">
          <p className="text-2xl font-bold">{data.intelligenceScore ?? '—'}</p>
          <p className={`text-xs font-medium ${scoreColor(data.intelligenceScore)}`}>Intel Score</p>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList><TabsTrigger value="overview">Overview</TabsTrigger><TabsTrigger value="contacts">Contacts</TabsTrigger><TabsTrigger value="opportunities">Opportunities</TabsTrigger><TabsTrigger value="timeline">Timeline</TabsTrigger><TabsTrigger value="notes">Notes</TabsTrigger></TabsList>

        <TabsContent value="overview" className="space-y-4 mt-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[
              ['Website', data.website], ['Industry', data.industry], ['Employees', data.employeeSize],
              ['Location', data.location ?? data.country], ['Status', data.status], ['Freshness', data.dataFreshness],
            ].map(([label, val]) => (
              <Card key={label}><CardContent className="p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="text-sm font-medium mt-1 capitalize">{val || '—'}</p></CardContent></Card>
            ))}
          </div>
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold flex items-center gap-2"><FileText className="size-4" />Research Card</CardTitle></CardHeader>
            <CardContent>
              {researchCard ? (
                <div className="grid gap-3">
                  {(Object.entries(RESEARCH_LABELS) as [keyof typeof researchCard, string][]).map(([key, label]) =>
                    researchCard[key] ? <div key={key}><p className="text-xs font-medium text-muted-foreground">{label}</p><p className="text-sm mt-0.5 whitespace-pre-wrap">{researchCard[key]}</p></div> : null
                  )}
                </div>
              ) : (
                <div className="text-center py-6"><p className="text-sm text-muted-foreground">No research yet</p><Button size="sm" className="mt-2" onClick={() => toast.info('Research triggered!')}>Generate Research</Button></div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contacts" className="mt-4">
          {contacts.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">No contacts found.</p> : (
            <Table><TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Title</TableHead><TableHead>Email</TableHead><TableHead>Health</TableHead></TableRow></TableHeader>
            <TableBody>{contacts.map((c: any) => (
              <TableRow key={c.id}><TableCell className="font-medium">{c.name}</TableCell><TableCell className="text-muted-foreground">{c.jobTitle || '—'}</TableCell><TableCell className="text-muted-foreground">{c.email || '—'}</TableCell>
              <TableCell><span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${healthVariant(c.emailHealth)}`}>{c.emailHealth || 'unknown'}</span></TableCell></TableRow>
            ))}</TableBody></Table>
          )}
        </TabsContent>

        <TabsContent value="opportunities" className="mt-4">
          {opportunities.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">No opportunities yet.</p> : (
            <div className="grid gap-3">{opportunities.map((o: any) => (
              <Card key={o.id}><CardContent className="p-4 flex items-start justify-between gap-4">
                <div className="min-w-0"><p className="font-medium text-sm">{o.title}</p>{o.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{o.description}</p>}</div>
                <span className={`shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusVariant(o.status)}`}>{o.status}</span>
              </CardContent></Card>
            ))}</div>
          )}
        </TabsContent>

        <TabsContent value="timeline" className="mt-4">
          {timeline.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">No timeline entries.</p> : (
            <div className="space-y-3">{timeline.map((t: any) => (
              <div key={t.id} className="flex items-start gap-3"><div className="mt-1.5 size-2 shrink-0 rounded-full bg-[#D4AF37]" /><div className="min-w-0"><p className="text-sm font-medium capitalize">{t.action.replace(/_/g, ' ')}</p>{t.details && <p className="text-xs text-muted-foreground mt-0.5">{t.details}</p>}<p className="text-xs text-muted-foreground/60 mt-0.5">{formatDistanceToNow(new Date(t.createdAt), { addSuffix: true })}</p></div></div>
            ))}</div>
          )}
        </TabsContent>

        <TabsContent value="notes" className="mt-4">
          <div className="flex justify-end mb-3"><Button size="sm" onClick={() => setNoteOpen(true)}><Plus className="size-3.5 mr-1.5" />Add Note</Button></div>
          {notes.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">No notes yet.</p> : (
            <div className="space-y-3">{notes.map((n: any) => (
              <Card key={n.id}><CardContent className="p-4"><p className="text-sm">{n.body}</p><div className="flex items-center gap-2 mt-2">{n.noteType && <Badge variant="secondary" className="text-xs">{n.noteType}</Badge>}<span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}</span></div></CardContent></Card>
            ))}</div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={noteOpen} onOpenChange={setNoteOpen}>
        <DialogContent><DialogHeader><DialogTitle>Add Note</DialogTitle></DialogHeader>
          <div className="space-y-3"><Label className="text-xs">Type</Label><Select value={noteType} onValueChange={setNoteType}><SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger><SelectContent><SelectItem value="call">Call</SelectItem><SelectItem value="meeting">Meeting</SelectItem><SelectItem value="research">Research</SelectItem><SelectItem value="general">General</SelectItem></SelectContent></Select>
          <Label className="text-xs">Note</Label><Textarea value={noteBody} onChange={e => setNoteBody(e.target.value)} rows={3} placeholder="Write your note..." /></div>
          <DialogFooter><Button variant="outline" onClick={() => setNoteOpen(false)}>Cancel</Button><Button onClick={() => addNote.mutate({ body: noteBody, noteType: noteType })} disabled={!noteBody.trim() || addNote.isPending}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}