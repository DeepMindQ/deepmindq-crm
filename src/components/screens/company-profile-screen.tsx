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

const healthVariant = (h: string) =>
  h === 'valid'
    ? 'bg-emerald-50 text-emerald-700'
    : h === 'risky'
      ? 'bg-amber-50 text-amber-700'
      : h === 'invalid'
        ? 'bg-red-50 text-red-700'
        : 'bg-gray-100 text-gray-600'

const statusBorder = (s: string) =>
  s === 'open'
    ? 'border-l-amber-400'
    : s === 'won'
      ? 'border-l-blue-500'
      : s === 'lost'
        ? 'border-l-red-400'
        : 'border-l-gray-300'

const statusBg = (s: string) =>
  s === 'open'
    ? 'bg-amber-50 text-amber-700'
    : s === 'won'
      ? 'bg-blue-50 text-blue-700'
      : s === 'lost'
        ? 'bg-red-50 text-red-700'
        : 'bg-gray-100 text-gray-600'

const RESEARCH_LABELS: Record<string, string> = {
  businessOverview: 'Business Overview',
  currentTechLandscape: 'Tech Landscape',
  potentialChallenges: 'Challenges',
  possibleOpportunities: 'Opportunities',
  relevantServices: 'Relevant Services',
  keyDecisionMakers: 'Decision Makers',
  lastInteraction: 'Last Interaction',
  nextAction: 'Next Action',
}

export default function CompanyProfileScreen() {
  const { selectedCompanyId, setActiveView } = useAppStore()
  const qc = useQueryClient()
  const [noteOpen, setNoteOpen] = useState(false)
  const [noteBody, setNoteBody] = useState('')
  const [noteType, setNoteType] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['company', selectedCompanyId],
    queryFn: () =>
      fetch(`/api/companies/${selectedCompanyId}`).then((r) => r.json()),
    enabled: !!selectedCompanyId,
  })

  const addNote = useMutation({
    mutationFn: (body: { body: string; noteType: string }) =>
      fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, companyId: selectedCompanyId }),
      }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['company'] })
      setNoteOpen(false)
      setNoteBody('')
      setNoteType('')
      toast.success('Note added')
    },
    onError: () => toast.error('Failed to add note'),
  })

  if (!selectedCompanyId)
    return <p className="text-sm text-gray-400">No company selected.</p>
  if (isLoading)
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32" />
        <Skeleton className="h-64" />
      </div>
    )
  if (!data)
    return <p className="text-sm text-gray-400">Company not found.</p>

  const {
    contacts = [],
    notes = [],
    researchCard,
    opportunities = [],
    timeline = [],
  } = data

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setActiveView('companies')}
          className="text-gray-400 hover:text-gray-900 transition-colors"
          aria-label="Go back"
        >
          <ArrowLeft className="size-5" />
        </button>
        <div className="min-w-0 flex-1">
          <h2 className="text-2xl font-bold text-gray-900 truncate">
            {data.name}
          </h2>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {data.domain && (
              <span className="text-sm text-gray-500 flex items-center gap-1">
                <Globe className="size-3.5" />
                {data.domain}
              </span>
            )}
            {data.industry && (
              <Badge className="bg-gray-100 text-gray-600 hover:bg-gray-100 text-xs font-normal border-0">
                {data.industry}
              </Badge>
            )}
            {data.country && (
              <span className="text-sm text-gray-500 flex items-center gap-1">
                <MapPin className="size-3.5" />
                {data.country}
              </span>
            )}
          </div>
        </div>
        <div className="ml-auto text-right shrink-0">
          <p className="text-3xl font-bold text-gray-900 leading-none">
            {data.intelligenceScore ?? '—'}
          </p>
          <p className="text-xs font-medium text-gray-500 mt-1">
            Intel Score
          </p>
        </div>
      </div>

      {/* ── Tabs ── */}
      <Tabs defaultValue="overview">
        <TabsList className="bg-gray-100 rounded-lg p-1 h-auto gap-0.5">
          {['overview', 'contacts', 'opportunities', 'timeline', 'notes'].map(
            (tab) => (
              <TabsTrigger
                key={tab}
                value={tab}
                className="rounded-md text-sm data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-gray-900 data-[state=active]:font-medium text-gray-500 hover:text-gray-700 transition-colors px-4 py-1.5"
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </TabsTrigger>
            ),
          )}
        </TabsList>

        {/* ── Overview ── */}
        <TabsContent value="overview" className="space-y-6 mt-5">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {(
              [
                ['Website', data.website],
                ['Industry', data.industry],
                ['Employees', data.employeeSize],
                ['Location', data.location ?? data.country],
                ['Status', data.status],
                ['Freshness', data.dataFreshness],
              ] as const
            ).map(([label, val]) => (
              <div
                key={label}
                className="rounded-xl border border-gray-200/80 shadow-sm p-4"
              >
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                  {label}
                </p>
                <p className="text-sm font-semibold text-gray-900 mt-1 capitalize">
                  {val || '—'}
                </p>
              </div>
            ))}
          </div>

          {/* Research Card */}
          <div className="rounded-xl border border-gray-200/80 shadow-sm">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                <FileText className="size-4 text-gray-400" />
                Research Card
              </h3>
            </div>
            <div className="p-5">
              {researchCard ? (
                <div className="grid gap-5">
                  {(
                    Object.entries(RESEARCH_LABELS) as [
                      keyof typeof researchCard,
                      string,
                    ][]
                  ).map(([key, label]) =>
                    researchCard[key] ? (
                      <div key={key}>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                          {label}
                        </p>
                        <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                          {researchCard[key]}
                        </p>
                      </div>
                    ) : null,
                  )}
                </div>
              ) : (
                <div className="text-center py-10">
                  <FileText className="size-8 text-gray-200 mx-auto mb-3" />
                  <p className="text-sm text-gray-400 mb-3">
                    No research yet
                  </p>
                  <Button
                    size="sm"
                    className="bg-gray-900 text-white hover:bg-gray-800"
                    onClick={() => toast.info('Research triggered!')}
                  >
                    Generate Research
                  </Button>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* ── Contacts ── */}
        <TabsContent value="contacts" className="mt-5">
          {contacts.length === 0 ? (
            <div className="text-center py-16">
              <Users className="size-8 text-gray-200 mx-auto mb-3" />
              <p className="text-sm text-gray-400">No contacts found.</p>
            </div>
          ) : (
            <div className="rounded-xl border border-gray-200/80 shadow-sm overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="border-gray-100 hover:bg-transparent">
                    <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Name
                    </TableHead>
                    <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Title
                    </TableHead>
                    <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Email
                    </TableHead>
                    <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Health
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contacts.map((c: any) => (
                    <TableRow
                      key={c.id}
                      className="border-gray-50 hover:bg-gray-50/50"
                    >
                      <TableCell className="font-medium text-gray-900 text-sm">
                        {c.name}
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">
                        {c.jobTitle || '—'}
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">
                        {c.email || '—'}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${healthVariant(c.emailHealth)}`}
                        >
                          {c.emailHealth || 'unknown'}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* ── Opportunities ── */}
        <TabsContent value="opportunities" className="mt-5">
          {opportunities.length === 0 ? (
            <div className="text-center py-16">
              <Target className="size-8 text-gray-200 mx-auto mb-3" />
              <p className="text-sm text-gray-400">No opportunities yet.</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {opportunities.map((o: any) => (
                <div
                  key={o.id}
                  className={`rounded-xl border border-gray-200/80 shadow-sm border-l-[3px] ${statusBorder(o.status)} p-4 flex items-start justify-between gap-4`}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900">
                      {o.title}
                    </p>
                    {o.description && (
                      <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                        {o.description}
                      </p>
                    )}
                  </div>
                  <span
                    className={`shrink-0 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${statusBg(o.status)}`}
                  >
                    {o.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Timeline ── */}
        <TabsContent value="timeline" className="mt-5">
          {timeline.length === 0 ? (
            <div className="text-center py-16">
              <StickyNote className="size-8 text-gray-200 mx-auto mb-3" />
              <p className="text-sm text-gray-400">
                No timeline entries.
              </p>
            </div>
          ) : (
            <div className="relative pl-6">
              <div className="absolute left-[7px] top-1 bottom-1 border-l-2 border-gray-200" />
              <div className="space-y-6">
                {timeline.map((t: any) => (
                  <div key={t.id} className="relative flex items-start gap-4">
                    <div className="absolute -left-6 top-1.5 size-3 rounded-full bg-amber-400 ring-4 ring-white" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 capitalize">
                        {t.action.replace(/_/g, ' ')}
                      </p>
                      {t.details && (
                        <p className="text-sm text-gray-500 mt-0.5">
                          {t.details}
                        </p>
                      )}
                      <p className="text-xs text-gray-400 mt-1">
                        {formatDistanceToNow(new Date(t.createdAt), {
                          addSuffix: true,
                        })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        {/* ── Notes ── */}
        <TabsContent value="notes" className="mt-5">
          <div className="flex justify-end mb-4">
            <Button
              size="sm"
              className="bg-amber-600 hover:bg-amber-700 text-white"
              onClick={() => setNoteOpen(true)}
            >
              <Plus className="size-3.5 mr-1.5" />
              Add Note
            </Button>
          </div>
          {notes.length === 0 ? (
            <div className="text-center py-16">
              <StickyNote className="size-8 text-gray-200 mx-auto mb-3" />
              <p className="text-sm text-gray-400">No notes yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {notes.map((n: any) => (
                <div
                  key={n.id}
                  className="rounded-xl border border-gray-200/80 shadow-sm p-4"
                >
                  <p className="text-sm text-gray-700 leading-relaxed">
                    {n.body}
                  </p>
                  <div className="flex items-center gap-2 mt-3">
                    {n.noteType && (
                      <Badge className="bg-gray-100 text-gray-600 hover:bg-gray-100 text-xs font-normal border-0 capitalize">
                        {n.noteType}
                      </Badge>
                    )}
                    <span className="text-xs text-gray-400">
                      {formatDistanceToNow(new Date(n.createdAt), {
                        addSuffix: true,
                      })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ── Add Note Dialog ── */}
      <Dialog open={noteOpen} onOpenChange={setNoteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-gray-900">Add Note</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                Type
              </Label>
              <Select value={noteType} onValueChange={setNoteType}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="call">Call</SelectItem>
                  <SelectItem value="meeting">Meeting</SelectItem>
                  <SelectItem value="research">Research</SelectItem>
                  <SelectItem value="general">General</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                Note
              </Label>
              <Textarea
                value={noteBody}
                onChange={(e) => setNoteBody(e.target.value)}
                rows={3}
                placeholder="Write your note..."
                className="resize-none"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setNoteOpen(false)}
              className="text-gray-600 border-gray-200 hover:bg-gray-50 hover:text-gray-900"
            >
              Cancel
            </Button>
            <Button
              onClick={() =>
                addNote.mutate({ body: noteBody, noteType: noteType })
              }
              disabled={!noteBody.trim() || addNote.isPending}
              className="bg-gray-900 text-white hover:bg-gray-800"
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}