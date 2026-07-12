'use client'

import { useState, useMemo } from 'react'
import {
  ChevronDown, ChevronRight, Clock, AlertTriangle, Sparkles,
  Mail, Building2, User, Target, Brain, Cpu, DollarSign,
  CheckCircle2, XCircle, Eye, RotateCcw, MessageSquare, Send,
  ChevronUp, FileText, Shield, Zap, Pencil,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible'
import { MOCK_ENHANCED_DRAFTS, type EnhancedDraft, type DraftReviewStatus } from '@/lib/mock-data'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'

// ── Constants ──────────────────────────────────────────────────────

const STATUS_CONFIG: Record<DraftReviewStatus, { label: string; bg: string; text: string; dot: string }> = {
  generated: { label: 'Generated', bg: 'bg-zinc-800', text: 'text-zinc-300', dot: 'bg-zinc-500' },
  reviewed: { label: 'Reviewed', bg: 'bg-blue-500/15', text: 'text-blue-300', dot: 'bg-blue-400' },
  approved: { label: 'Approved', bg: 'bg-emerald-500/15', text: 'text-emerald-300', dot: 'bg-emerald-400' },
  rejected: { label: 'Rejected', bg: 'bg-red-500/15', text: 'text-red-300', dot: 'bg-red-400' },
}

type FilterTab = 'pending' | 'approved' | 'rejected' | 'all'

const FILTER_TABS: Array<{ key: FilterTab; label: string; status: DraftReviewStatus | null }> = [
  { key: 'pending', label: 'Pending Review', status: 'generated' },
  { key: 'approved', label: 'Approved', status: 'approved' },
  { key: 'rejected', label: 'Rejected', status: 'rejected' },
  { key: 'all', label: 'All', status: null },
]

// ── Component ──────────────────────────────────────────────────────

export default function DraftsScreen() {
  const [activeTab, setActiveTab] = useState<FilterTab>('pending')
  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(null)
  const [editSubject, setEditSubject] = useState('')
  const [editBody, setEditBody] = useState('')
  const [editCta, setEditCta] = useState('')
  const [reviewNotes, setReviewNotes] = useState('')
  const [contextCollapsed, setContextCollapsed] = useState(false)
  const [emailPreviewMode, setEmailPreviewMode] = useState(false)

  // ── Derived data ──
  const filteredDrafts = useMemo(() => {
    let result = [...MOCK_ENHANCED_DRAFTS]
    if (activeTab === 'pending') {
      result = result.filter((d) => d.status === 'generated' || d.status === 'reviewed')
    } else if (activeTab === 'approved') {
      result = result.filter((d) => d.status === 'approved')
    } else if (activeTab === 'rejected') {
      result = result.filter((d) => d.status === 'rejected')
    }
    return result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }, [activeTab])

  const tabCounts = useMemo(() => ({
    pending: MOCK_ENHANCED_DRAFTS.filter((d) => d.status === 'generated' || d.status === 'reviewed').length,
    approved: MOCK_ENHANCED_DRAFTS.filter((d) => d.status === 'approved').length,
    rejected: MOCK_ENHANCED_DRAFTS.filter((d) => d.status === 'rejected').length,
    all: MOCK_ENHANCED_DRAFTS.length,
  }), [])

  const selectedDraft = useMemo(
    () => MOCK_ENHANCED_DRAFTS.find((d) => d.id === selectedDraftId) ?? null,
    [selectedDraftId]
  )

  // Sync edits when selecting a draft
  const selectDraft = (draft: EnhancedDraft) => {
    setSelectedDraftId(draft.id)
    setEditSubject(draft.subject)
    setEditBody(draft.body)
    setEditCta(draft.cta)
    setReviewNotes(draft.reviewNotes || '')
    setEmailPreviewMode(false)
  }

  // ── Render ──
  return (
    <div className="flex h-full">
      {/* Left Panel: Draft List */}
      <div className="w-[380px] flex-shrink-0 border-r border-zinc-800/60 flex flex-col bg-zinc-950/50">
        {/* Panel Header */}
        <div className="px-4 pt-5 pb-3 flex-shrink-0">
          <h1 className="text-lg font-bold text-zinc-100 mb-3">Draft Review</h1>
          {/* Filter Tabs */}
          <div className="flex gap-1 flex-wrap">
            {FILTER_TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  'px-2.5 py-1.5 text-[11px] font-medium rounded-md transition-colors',
                  activeTab === tab.key
                    ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 border border-transparent'
                )}
              >
                {tab.label}
                <span className="ml-1 text-[10px] opacity-60">({tabCounts[tab.key]})</span>
              </button>
            ))}
          </div>
        </div>

        {/* Draft List */}
        <ScrollArea className="flex-1">
          <div className="px-3 pb-4 space-y-2">
            {filteredDrafts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Mail className="size-8 text-zinc-700 mb-2" />
                <p className="text-xs text-zinc-500">No drafts in this category</p>
              </div>
            ) : (
              filteredDrafts.map((draft) => (
                <DraftListItem
                  key={draft.id}
                  draft={draft}
                  isSelected={selectedDraftId === draft.id}
                  onClick={() => selectDraft(draft)}
                />
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Right Panel: Draft Detail */}
      <div className="flex-1 flex flex-col min-w-0 bg-zinc-950">
        {selectedDraft ? (
          <>
            <ScrollArea className="flex-1">
              <div className="max-w-4xl mx-auto px-6 py-5 space-y-5">
                {/* Confidence Score Bar */}
                <div className="flex items-center gap-4">
                  <div
                    className={cn(
                      'inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-bold',
                      selectedDraft.confidenceScore >= 80
                        ? 'bg-emerald-500/15 text-emerald-300'
                        : selectedDraft.confidenceScore >= 50
                          ? 'bg-amber-500/15 text-amber-300'
                          : 'bg-red-500/15 text-red-300'
                    )}
                  >
                    <Brain className="size-4" />
                    {selectedDraft.confidenceScore}% Confidence
                  </div>
                  <span
                    className={cn(
                      'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium',
                      STATUS_CONFIG[selectedDraft.status].bg,
                      STATUS_CONFIG[selectedDraft.status].text
                    )}
                  >
                    <span className={cn('w-1.5 h-1.5 rounded-full', STATUS_CONFIG[selectedDraft.status].dot)} />
                    {STATUS_CONFIG[selectedDraft.status].label}
                  </span>
                  <span className="text-[11px] text-zinc-500 flex items-center gap-1 ml-auto">
                    <Clock className="size-3" />
                    {formatDistanceToNow(new Date(selectedDraft.createdAt), { addSuffix: true })}
                  </span>
                </div>

                {/* Context Sections (collapsible) */}
                <Collapsible open={!contextCollapsed} onOpenChange={(open) => setContextCollapsed(!open)}>
                  <CollapsibleTrigger className="flex items-center gap-2 text-xs font-semibold text-zinc-400 uppercase tracking-wider hover:text-zinc-200 transition-colors mb-3 w-full">
                    {contextCollapsed ? <ChevronRight className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                    Contact & Company Context
                    <span className="text-[10px] font-normal text-zinc-600">(click to {contextCollapsed ? 'expand' : 'collapse'})</span>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-2">
                      {/* Contact Context */}
                      <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-4 space-y-3">
                        <div className="flex items-center gap-2 text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                          <User className="size-3.5 text-amber-500" />
                          Contact
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold text-zinc-100">{selectedDraft.contactName}</span>
                            <Badge
                              variant="secondary"
                              className={cn(
                                'text-[10px] font-semibold',
                                selectedDraft.contactScore >= 80
                                  ? 'bg-emerald-500/15 text-emerald-300 border-0'
                                  : selectedDraft.contactScore >= 60
                                    ? 'bg-amber-500/15 text-amber-300 border-0'
                                    : 'bg-red-500/15 text-red-300 border-0'
                              )}
                            >
                              {selectedDraft.contactScore}
                            </Badge>
                          </div>
                          <div className="text-xs text-zinc-400 space-y-1">
                            <p>{selectedDraft.contactTitle}</p>
                            <p className="text-zinc-500">{selectedDraft.contactEmail}</p>
                            <div className="flex items-center gap-2 pt-1">
                              <Badge variant="outline" className="text-[10px] text-zinc-400 border-zinc-700/50 h-5">
                                {selectedDraft.contactRoleBucket}
                              </Badge>
                              <Badge
                                variant="outline"
                                className={cn(
                                  'text-[10px] h-5 border',
                                  selectedDraft.contactEmailHealth === 'Valid'
                                    ? 'text-emerald-400 border-emerald-500/30'
                                    : 'text-amber-400 border-amber-500/30'
                                )}
                              >
                                <Shield className="size-2.5 mr-0.5" />
                                {selectedDraft.contactEmailHealth} ({selectedDraft.contactEmailHealthScore})
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Company Context */}
                      <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-4 space-y-3">
                        <div className="flex items-center gap-2 text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                          <Building2 className="size-3.5 text-amber-500" />
                          Company
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold text-zinc-100">{selectedDraft.companyName}</span>
                            <span className="text-[10px] text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded">
                              {selectedDraft.companySize} emp
                            </span>
                          </div>
                          <p className="text-[11px] text-zinc-400 leading-relaxed line-clamp-3">
                            {selectedDraft.companyResearchSummary}
                          </p>
                          <div className="flex flex-wrap gap-1">
                            <Badge variant="outline" className="text-[10px] text-zinc-400 border-zinc-700/50 h-5">
                              {selectedDraft.companyIndustry}
                            </Badge>
                            {selectedDraft.companyPainPoints.slice(0, 2).map((pp) => (
                              <Badge key={pp} className="text-[10px] bg-amber-500/10 text-amber-400/80 border-0 h-5">
                                {pp}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                <Separator className="bg-zinc-800/40" />

                {/* Source Intelligence */}
                <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-4 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                    <Sparkles className="size-3.5 text-amber-500" />
                    Capability Snippets Used
                    <span className="text-[10px] font-normal text-zinc-600">({selectedDraft.capabilitySnippets.length})</span>
                  </div>
                  <div className="space-y-2">
                    {selectedDraft.capabilitySnippets.map((snippet) => (
                      <Collapsible key={snippet.id}>
                        <CollapsibleTrigger className="w-full text-left">
                          <div className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-zinc-800/40 transition-colors group">
                            <FileText className="size-3.5 text-zinc-500 group-hover:text-amber-400 transition-colors flex-shrink-0" />
                            <span className="text-xs text-zinc-300 group-hover:text-amber-200 transition-colors truncate flex-1">
                              {snippet.capabilityTitle}
                            </span>
                            <ChevronRight className="size-3 text-zinc-600 group-hover:text-zinc-400 transition-colors flex-shrink-0 [[data-state=open]>&]:rotate-90" />
                          </div>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="ml-5 pl-4 border-l border-zinc-800/50 py-2 pr-2 mb-1">
                            <p className="text-[11px] text-zinc-400 leading-relaxed italic">
                              &ldquo;{snippet.excerpt}&rdquo;
                            </p>
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    ))}
                  </div>
                </div>

                {/* Email Preview Section */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                      <Mail className="size-3.5 text-amber-500" />
                      Email Content
                    </div>
                    <button
                      onClick={() => setEmailPreviewMode(!emailPreviewMode)}
                      className="flex items-center gap-1.5 text-[11px] text-zinc-400 hover:text-zinc-200 transition-colors"
                    >
                      {emailPreviewMode ? (
                        <>
                          <Pencil className="size-3" />
                          Edit Mode
                        </>
                      ) : (
                        <>
                          <Eye className="size-3" />
                          Preview as Email
                        </>
                      )}
                    </button>
                  </div>

                  {emailPreviewMode ? (
                    /* Email Preview Mode */
                    <div className="rounded-xl border border-zinc-800/60 bg-white overflow-hidden">
                      {/* Email Chrome */}
                      <div className="bg-zinc-100 border-b border-zinc-200 px-5 py-3">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="flex gap-1.5">
                            <div className="w-3 h-3 rounded-full bg-red-400" />
                            <div className="w-3 h-3 rounded-full bg-yellow-400" />
                            <div className="w-3 h-3 rounded-full bg-green-400" />
                          </div>
                          <span className="text-[11px] text-zinc-400 ml-2">Email Preview</span>
                        </div>
                        <div className="space-y-1.5 text-[12px]">
                          <div className="flex gap-2">
                            <span className="text-zinc-400 w-10">From:</span>
                            <span className="text-zinc-700">Ravi Shanker &lt;ravi@deepmindq.com&gt;</span>
                          </div>
                          <div className="flex gap-2">
                            <span className="text-zinc-400 w-10">To:</span>
                            <span className="text-zinc-700">{selectedDraft.contactEmail}</span>
                          </div>
                          <div className="flex gap-2">
                            <span className="text-zinc-400 w-10">Subject:</span>
                            <span className="text-zinc-900 font-medium">{editSubject}</span>
                          </div>
                        </div>
                      </div>
                      {/* Email Body */}
                      <div className="bg-white p-6">
                        <div className="text-[13px] text-zinc-800 leading-relaxed whitespace-pre-wrap">
                          {editBody}
                        </div>
                        <div className="mt-4 pt-3 border-t border-zinc-100 text-[13px] text-zinc-600">
                          {editCta}
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Edit Mode */
                    <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-5 space-y-4">
                      <div>
                        <Label className="text-xs text-zinc-400 mb-1.5 block">Subject Line</Label>
                        <Input
                          value={editSubject}
                          onChange={(e) => setEditSubject(e.target.value)}
                          className="bg-zinc-900/60 border-zinc-800 text-zinc-200 text-sm font-medium"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-zinc-400 mb-1.5 block">Email Body</Label>
                        <Textarea
                          value={editBody}
                          onChange={(e) => setEditBody(e.target.value)}
                          rows={16}
                          className="bg-zinc-900/60 border-zinc-800 text-zinc-200 text-sm leading-relaxed resize-none"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-zinc-400 mb-1.5 block">Call-to-Action Line</Label>
                        <Input
                          value={editCta}
                          onChange={(e) => setEditCta(e.target.value)}
                          className="bg-zinc-900/60 border-zinc-800 text-zinc-200 text-sm"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* AI Metadata */}
                <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-4 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                    <Cpu className="size-3.5 text-amber-500" />
                    AI Metadata
                  </div>

                  <div className="grid grid-cols-3 gap-4 text-xs">
                    <div>
                      <p className="text-zinc-500 mb-0.5">Model</p>
                      <p className="text-zinc-300 font-medium">{selectedDraft.modelUsed}</p>
                    </div>
                    <div>
                      <p className="text-zinc-500 mb-0.5">Tokens</p>
                      <p className="text-zinc-300 font-medium">{selectedDraft.tokensConsumed.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-zinc-500 mb-0.5">Est. Cost</p>
                      <p className="text-zinc-300 font-medium">${selectedDraft.estimatedCost.toFixed(3)}</p>
                    </div>
                  </div>

                  {/* Confidence Explanation */}
                  <div>
                    <p className="text-[11px] text-zinc-500 mb-1">Confidence Explanation</p>
                    <p className="text-xs text-zinc-400 leading-relaxed">{selectedDraft.confidenceExplanation}</p>
                  </div>

                  {/* Assumption Flags */}
                  {selectedDraft.assumptionFlags.length > 0 && (
                    <div>
                      <p className="text-[11px] text-zinc-500 mb-2 flex items-center gap-1">
                        <AlertTriangle className="size-3 text-amber-500" />
                        Assumption Flags ({selectedDraft.assumptionFlags.length})
                      </p>
                      <div className="space-y-2">
                        {selectedDraft.assumptionFlags.map((af) => (
                          <div
                            key={af.id}
                            className="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-500/5 border border-amber-500/10"
                          >
                            <AlertTriangle className="size-3 text-amber-500 mt-0.5 flex-shrink-0" />
                            <div>
                              <p className="text-[11px] font-medium text-amber-300">{af.flag}</p>
                              <p className="text-[10px] text-zinc-500 leading-relaxed">{af.description}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Spacer for sticky actions */}
                <div className="h-32" />
              </div>
            </ScrollArea>

            {/* Review Actions (Sticky Bottom) */}
            <div className="flex-shrink-0 border-t border-zinc-800/60 bg-zinc-950 px-6 py-4">
              <div className="max-w-4xl mx-auto">
                <div className="mb-3">
                  <Label className="text-xs text-zinc-400 mb-1.5 block">Review Notes</Label>
                  <Textarea
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    placeholder="Add notes for the SDR team..."
                    rows={2}
                    className="bg-zinc-900/60 border-zinc-800 text-zinc-200 text-xs resize-none"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Button className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs gap-2 h-9">
                    <CheckCircle2 className="size-3.5" />
                    Approve &amp; Queue
                  </Button>
                  <Button
                    variant="outline"
                    className="border-amber-500/30 text-amber-300 hover:bg-amber-500/10 text-xs gap-2 h-9"
                  >
                    <MessageSquare className="size-3.5" />
                    Request Revision
                  </Button>
                  <Button
                    variant="outline"
                    className="border-red-500/30 text-red-300 hover:bg-red-500/10 text-xs gap-2 h-9"
                  >
                    <XCircle className="size-3.5" />
                    Reject
                  </Button>
                  <Button
                    variant="outline"
                    className="border-zinc-700 text-zinc-400 hover:bg-zinc-800 text-xs gap-2 h-9 ml-auto"
                  >
                    <RotateCcw className="size-3.5" />
                    Regenerate
                  </Button>
                </div>
              </div>
            </div>
          </>
        ) : (
          /* Empty State */
          <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
            <div className="size-16 rounded-2xl bg-zinc-800/50 flex items-center justify-center mb-4">
              <Mail className="size-7 text-zinc-600" />
            </div>
            <h3 className="text-sm font-medium text-zinc-300 mb-1">Select a draft to review</h3>
            <p className="text-xs text-zinc-500 max-w-xs">
              Choose a draft from the list to view the contact context, AI intelligence sources, and email content.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Draft List Item ────────────────────────────────────────────────

function DraftListItem({
  draft,
  isSelected,
  onClick,
}: {
  draft: EnhancedDraft
  isSelected: boolean
  onClick: () => void
}) {
  const statusCfg = STATUS_CONFIG[draft.status]

  const confidenceColor =
    draft.confidenceScore >= 80
      ? 'text-emerald-400 bg-emerald-500/10'
      : draft.confidenceScore >= 50
        ? 'text-amber-400 bg-amber-500/10'
        : 'text-red-400 bg-red-500/10'

  return (
    <div
      onClick={onClick}
      className={cn(
        'rounded-lg border p-3.5 cursor-pointer transition-all',
        'bg-zinc-900/30 border-zinc-800/40 hover:border-zinc-700/60',
        isSelected && 'bg-amber-500/5 border-amber-500/30 ring-1 ring-amber-500/20'
      )}
    >
      {/* Contact + Company */}
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-zinc-100 truncate">{draft.contactName}</p>
          <p className="text-[11px] text-zinc-500 truncate">{draft.companyName}</p>
        </div>
        <div
          className={cn(
            'flex-shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold',
            confidenceColor
          )}
        >
          {draft.confidenceScore}%
        </div>
      </div>

      {/* Subject */}
      <p className="text-xs text-zinc-300 line-clamp-1 mb-2">{draft.subject}</p>

      {/* Status + Timestamp */}
      <div className="flex items-center justify-between">
        <span
          className={cn(
            'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium',
            statusCfg.bg,
            statusCfg.text
          )}
        >
          <span className={cn('w-1 h-1 rounded-full', statusCfg.dot)} />
          {statusCfg.label}
        </span>
        <span className="text-[10px] text-zinc-600 flex items-center gap-1">
          <Clock className="size-2.5" />
          {formatDistanceToNow(new Date(draft.createdAt), { addSuffix: true })}
        </span>
      </div>

      {/* Assumption Flags */}
      {draft.assumptionFlags.length > 0 && (
        <div className="flex items-center gap-1 mt-2 flex-wrap">
          {draft.assumptionFlags.slice(0, 2).map((af) => (
            <span
              key={af.id}
              className="inline-flex items-center gap-1 text-[9px] text-amber-400/80 bg-amber-500/8 px-1.5 py-0.5 rounded"
            >
              <AlertTriangle className="size-2" />
              {af.flag}
            </span>
          ))}
          {draft.assumptionFlags.length > 2 && (
            <span className="text-[9px] text-zinc-600">+{draft.assumptionFlags.length - 2}</span>
          )}
        </div>
      )}

      {/* Review notes badge */}
      {draft.reviewNotes && (
        <p className="text-[10px] text-zinc-500 mt-2 line-clamp-1 italic">
          &ldquo;{draft.reviewNotes}&rdquo;
        </p>
      )}
    </div>
  )
}