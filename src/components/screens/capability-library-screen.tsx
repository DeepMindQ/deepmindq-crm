'use client'

import { useState, useMemo } from 'react'
import {
  Search, Plus, BookOpen, Eye, Pencil, ChevronDown, ChevronRight,
  Layers, FileText, Award, MessageSquare, MousePointerClick, Archive,
  Filter, Clock, GitBranch, Sparkles, X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible'
import { MOCK_CAPABILITY_ASSETS, type CapabilityAsset, type CapabilityCategory } from '@/lib/mock-data'
import { useAppStore } from '@/lib/store'
import { cn } from '@/lib/utils'

// ── Constants ──────────────────────────────────────────────────────

const CATEGORY_CONFIG: Record<CapabilityCategory, { label: string; icon: typeof Layers; color: string; badgeBg: string; badgeText: string; borderHover: string }> = {
  service_line: {
    label: 'Service Line',
    icon: Layers,
    color: 'text-blue-400',
    badgeBg: 'bg-blue-500/15',
    badgeText: 'text-blue-300',
    borderHover: 'hover:border-blue-500/40',
  },
  case_study: {
    label: 'Case Study',
    icon: FileText,
    color: 'text-purple-400',
    badgeBg: 'bg-purple-500/15',
    badgeText: 'text-purple-300',
    borderHover: 'hover:border-purple-500/40',
  },
  proof_point: {
    label: 'Proof Point',
    icon: Award,
    color: 'text-emerald-400',
    badgeBg: 'bg-emerald-500/15',
    badgeText: 'text-emerald-300',
    borderHover: 'hover:border-emerald-500/40',
  },
  objection_response: {
    label: 'Objection Response',
    icon: MessageSquare,
    color: 'text-amber-400',
    badgeBg: 'bg-amber-500/15',
    badgeText: 'text-amber-300',
    borderHover: 'hover:border-amber-500/40',
  },
  cta: {
    label: 'CTA',
    icon: MousePointerClick,
    color: 'text-yellow-400',
    badgeBg: 'bg-yellow-500/15',
    badgeText: 'text-yellow-300',
    borderHover: 'hover:border-yellow-500/40',
  },
}

const FILTER_TABS = [
  { key: 'all', label: 'All' },
  { key: 'service_line', label: 'Service Lines' },
  { key: 'case_study', label: 'Case Studies' },
  { key: 'proof_point', label: 'Proof Points' },
  { key: 'objection_response', label: 'Objections' },
  { key: 'cta', label: 'CTAs' },
] as const

type FilterKey = typeof FILTER_TABS[number]['key']

// ── Component ──────────────────────────────────────────────────────

export default function CapabilityLibraryScreen() {
  const [search, setSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all')
  const [selectedAsset, setSelectedAsset] = useState<CapabilityAsset | null>(null)
  const [showArchived, setShowArchived] = useState(false)

  // ── Derived data ──
  const allAssets = useMemo(() => {
    return MOCK_CAPABILITY_ASSETS.filter((a) => showArchived || a.isActive)
  }, [showArchived])

  const filteredAssets = useMemo(() => {
    let result = allAssets
    if (activeFilter !== 'all') {
      result = result.filter((a) => a.category === activeFilter)
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(
        (a) =>
          a.title.toLowerCase().includes(q) ||
          a.summary.toLowerCase().includes(q) ||
          a.serviceLine.toLowerCase().includes(q) ||
          a.targetIndustries.some((i) => i.toLowerCase().includes(q)) ||
          a.targetRoles.some((r) => r.toLowerCase().includes(q))
      )
    }
    return result
  }, [allAssets, activeFilter, search])

  const stats = useMemo(() => {
    const active = allAssets.filter((a) => a.isActive)
    const serviceLines = new Set(active.filter((a) => a.category === 'service_line').map((a) => a.serviceLine))
    return {
      total: active.length,
      serviceLines: serviceLines.size,
      caseStudies: active.filter((a) => a.category === 'case_study').length,
      proofPoints: active.filter((a) => a.category === 'proof_point').length,
      objectionResponses: active.filter((a) => a.category === 'objection_response').length,
      ctas: active.filter((a) => a.category === 'cta').length,
    }
  }, [allAssets])

  const activeCount = useMemo(() => {
    return filteredAssets.filter((a) => a.isActive).length
  }, [filteredAssets])

  const archivedCount = useMemo(() => {
    return filteredAssets.filter((a) => !a.isActive).length
  }, [filteredAssets])

  // ── Render ──
  return (
    <div className="flex h-full">
      {/* Main content area */}
      <div className={cn('flex-1 flex flex-col min-w-0 transition-all', selectedAsset ? 'mr-0 lg:mr-[520px]' : '')}>
        {/* Header */}
        <header className="flex-shrink-0 px-6 pt-6 pb-4">
          <div className="flex items-start justify-between gap-4 mb-1">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-zinc-50">Capability Library</h1>
              <p className="text-sm text-zinc-400 mt-1">Your company&apos;s approved knowledge assets for AI-powered outreach</p>
            </div>
            <Button
              className="bg-amber-500 hover:bg-amber-400 text-black font-semibold gap-2 flex-shrink-0"
            >
              <Plus className="size-4" />
              Add Capability
            </Button>
          </div>

          {/* Search + Filters */}
          <div className="flex flex-col sm:flex-row gap-3 mt-5">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-zinc-500" />
              <Input
                placeholder="Search capabilities, industries, roles..."
                className="pl-9 bg-zinc-900/60 border-zinc-800 text-zinc-200 placeholder:text-zinc-500 focus-visible:ring-amber-500/30 focus-visible:border-amber-500/40"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300">
                  <X className="size-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-1 mt-4 overflow-x-auto pb-1">
            {FILTER_TABS.map((tab) => {
              const count = tab.key === 'all'
                ? filteredAssets.length
                : filteredAssets.filter((a) => a.category === tab.key).length
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveFilter(tab.key)}
                  className={cn(
                    'px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors',
                    activeFilter === tab.key
                      ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 border border-transparent'
                  )}
                >
                  {tab.label}
                  <span className="ml-1.5 text-[10px] opacity-60">({count})</span>
                </button>
              )
            })}
            <div className="ml-auto flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => setShowArchived(!showArchived)}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md transition-colors',
                  showArchived ? 'bg-zinc-700 text-zinc-200' : 'text-zinc-500 hover:text-zinc-300'
                )}
              >
                <Archive className="size-3" />
                Archived
                {archivedCount > 0 && <span className="text-[10px] opacity-60">({archivedCount})</span>}
              </button>
            </div>
          </div>

          {/* Stats Bar */}
          <div className="flex items-center gap-4 mt-3 text-xs text-zinc-500">
            <span className="flex items-center gap-1.5">
              <Sparkles className="size-3 text-amber-500" />
              <span className="text-zinc-300 font-medium">{stats.total}</span> active assets across{' '}
              <span className="text-zinc-300 font-medium">{stats.serviceLines}</span> service lines
            </span>
            <Separator orientation="vertical" className="h-3 bg-zinc-800" />
            <span>{stats.caseStudies} case studies</span>
            <span>{stats.proofPoints} proof points</span>
            <span>{stats.objectionResponses} objections</span>
            <span>{stats.ctas} CTAs</span>
          </div>
        </header>

        {/* Card Grid */}
        <ScrollArea className="flex-1 px-6">
          {filteredAssets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="size-16 rounded-2xl bg-zinc-800/50 flex items-center justify-center mb-4">
                <BookOpen className="size-7 text-zinc-600" />
              </div>
              <h3 className="text-sm font-medium text-zinc-300 mb-1">No capabilities found</h3>
              <p className="text-xs text-zinc-500 max-w-xs">
                {search
                  ? `No results for "${search}". Try adjusting your search or filters.`
                  : `No ${activeFilter === 'all' ? '' : FILTER_TABS.find((t) => t.key === activeFilter)?.label + ' '}assets found in this category.`}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 pb-6">
              {filteredAssets.map((asset) => (
                <CapabilityCard
                  key={asset.id}
                  asset={asset}
                  isSelected={selectedAsset?.id === asset.id}
                  onClick={() => setSelectedAsset(asset)}
                />
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Detail Panel */}
      {selectedAsset && (
        <aside className="fixed right-0 top-0 bottom-0 w-[520px] max-w-full bg-zinc-950 border-l border-zinc-800/80 z-40 flex flex-col shadow-2xl shadow-black/50 fade-in">
          <DetailPanel asset={selectedAsset} onClose={() => setSelectedAsset(null)} />
        </aside>
      )}
    </div>
  )
}

// ── Capability Card ────────────────────────────────────────────────

function CapabilityCard({
  asset,
  isSelected,
  onClick,
}: {
  asset: CapabilityAsset
  isSelected: boolean
  onClick: () => void
}) {
  const catConfig = CATEGORY_CONFIG[asset.category]
  const CatIcon = catConfig.icon

  const [evidenceExpanded, setEvidenceExpanded] = useState(false)

  return (
    <div
      onClick={onClick}
      className={cn(
        'group relative rounded-xl border p-5 cursor-pointer transition-all',
        'bg-zinc-900/60 border-zinc-800/60',
        catConfig.borderHover,
        isSelected && 'ring-1 ring-amber-500/40 border-amber-500/30',
        !asset.isActive && 'opacity-50'
      )}
    >
      {/* Category badge + Version */}
      <div className="flex items-center justify-between mb-3">
        <span
          className={cn(
            'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold',
            catConfig.badgeBg,
            catConfig.badgeText
          )}
        >
          <CatIcon className="size-3" />
          {catConfig.label}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-zinc-600 flex items-center gap-1">
            <GitBranch className="size-2.5" />
            v{asset.version}
          </span>
          {!asset.isActive && (
            <span className="text-[10px] text-zinc-500 bg-zinc-800 px-1.5 py-0.5 rounded">Archived</span>
          )}
        </div>
      </div>

      {/* Title */}
      <h3 className="text-[15px] font-semibold text-zinc-100 leading-snug mb-2 group-hover:text-amber-200 transition-colors line-clamp-2">
        {asset.title}
      </h3>

      {/* Summary */}
      <p className="text-xs text-zinc-400 leading-relaxed mb-3 line-clamp-3">
        {asset.summary}
      </p>

      {/* Service Line Tag */}
      <div className="mb-3">
        <span className="text-[10px] font-medium text-amber-500/80 bg-amber-500/10 px-2 py-0.5 rounded">
          {asset.serviceLine}
        </span>
      </div>

      {/* Target Industries */}
      <div className="flex flex-wrap gap-1 mb-2">
        {asset.targetIndustries.slice(0, 4).map((ind) => (
          <span
            key={ind}
            className="text-[10px] text-zinc-400 bg-zinc-800/80 px-1.5 py-0.5 rounded"
          >
            {ind}
          </span>
        ))}
        {asset.targetIndustries.length > 4 && (
          <span className="text-[10px] text-zinc-500">+{asset.targetIndustries.length - 4}</span>
        )}
      </div>

      {/* Target Roles */}
      <div className="flex flex-wrap gap-1 mb-3">
        {asset.targetRoles.slice(0, 3).map((role) => (
          <span
            key={role}
            className="text-[10px] text-zinc-500 bg-zinc-800/50 border border-zinc-700/40 px-1.5 py-0.5 rounded"
          >
            {role}
          </span>
        ))}
        {asset.targetRoles.length > 3 && (
          <span className="text-[10px] text-zinc-600">+{asset.targetRoles.length - 3}</span>
        )}
      </div>

      {/* Problems Solved */}
      <div className="flex flex-wrap gap-1 mb-3">
        {asset.problemsSolved.slice(0, 3).map((prob) => (
          <span
            key={prob}
            className="text-[10px] text-zinc-400 bg-zinc-800/40 border border-zinc-700/30 px-1.5 py-0.5 rounded-md"
          >
            {prob}
          </span>
        ))}
      </div>

      {/* Supporting Evidence (collapsible) */}
      <Collapsible open={evidenceExpanded} onOpenChange={setEvidenceExpanded}>
        <CollapsibleTrigger className="flex items-center gap-1 text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors mb-1">
          {evidenceExpanded ? <ChevronDown className="size-2.5" /> : <ChevronRight className="size-2.5" />}
          Supporting Evidence
        </CollapsibleTrigger>
        <CollapsibleContent>
          <p className="text-[11px] text-zinc-500 leading-relaxed mb-3 line-clamp-3">
            {asset.supportingEvidence}
          </p>
        </CollapsibleContent>
      </Collapsible>

      {/* Footer: Used in Drafts + Actions */}
      <div className="flex items-center justify-between mt-auto pt-2 border-t border-zinc-800/40">
        <span className="text-[10px] text-zinc-500 flex items-center gap-1">
          <Eye className="size-2.5" />
          Used in {asset.usedInDrafts} drafts
        </span>
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={(e) => { e.stopPropagation(); }}
            className="p-1.5 rounded-md text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
          >
            <Pencil className="size-3" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); }}
            className="p-1.5 rounded-md text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
          >
            <Eye className="size-3" />
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Detail Panel ───────────────────────────────────────────────────

function DetailPanel({ asset, onClose }: { asset: CapabilityAsset; onClose: () => void }) {
  const catConfig = CATEGORY_CONFIG[asset.category]
  const CatIcon = catConfig.icon
  const [isEditing, setIsEditing] = useState(false)
  const [editTitle, setEditTitle] = useState(asset.title)
  const [editSummary, setEditSummary] = useState(asset.summary)
  const [editEvidence, setEditEvidence] = useState(asset.supportingEvidence)

  return (
    <>
      {/* Panel Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/60 flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <span
            className={cn(
              'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold flex-shrink-0',
              catConfig.badgeBg,
              catConfig.badgeText
            )}
          >
            <CatIcon className="size-3" />
            {catConfig.label}
          </span>
          <span className="text-[10px] text-zinc-600 flex items-center gap-1">
            <GitBranch className="size-2.5" />
            v{asset.version}
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-md text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
        >
          <X className="size-4" />
        </button>
      </div>

      <ScrollArea className="flex-1">
        <div className="px-6 py-5 space-y-5">
          {isEditing ? (
            /* ── Edit Mode ── */
            <div className="space-y-4">
              <div>
                <Label className="text-xs text-zinc-400 mb-1.5 block">Title</Label>
                <Input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="bg-zinc-900/60 border-zinc-800 text-zinc-200 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs text-zinc-400 mb-1.5 block">Summary</Label>
                <Textarea
                  value={editSummary}
                  onChange={(e) => setEditSummary(e.target.value)}
                  rows={4}
                  className="bg-zinc-900/60 border-zinc-800 text-zinc-200 text-sm resize-none"
                />
              </div>
              <div>
                <Label className="text-xs text-zinc-400 mb-1.5 block">Supporting Evidence</Label>
                <Textarea
                  value={editEvidence}
                  onChange={(e) => setEditEvidence(e.target.value)}
                  rows={5}
                  className="bg-zinc-900/60 border-zinc-800 text-zinc-200 text-sm resize-none"
                />
              </div>
              <div className="flex items-center gap-2 pt-2">
                <Button
                  onClick={() => setIsEditing(false)}
                  className="bg-amber-500 hover:bg-amber-400 text-black font-semibold text-xs h-8"
                >
                  Save Changes
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setIsEditing(false)}
                  className="border-zinc-700 text-zinc-300 text-xs h-8"
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            /* ── View Mode ── */
            <>
              {/* Title + Actions */}
              <div>
                <div className="flex items-start justify-between gap-3 mb-1">
                  <h2 className="text-lg font-bold text-zinc-100 leading-tight">{asset.title}</h2>
                  <Button
                    variant="outline"
                    onClick={() => setIsEditing(true)}
                    className="border-zinc-700 text-zinc-300 text-xs h-7 gap-1 flex-shrink-0 hover:bg-zinc-800"
                  >
                    <Pencil className="size-3" />
                    Edit
                  </Button>
                </div>
                <span className="text-[11px] text-amber-500/80 bg-amber-500/10 px-2 py-0.5 rounded font-medium">
                  {asset.serviceLine}
                </span>
              </div>

              {/* Summary */}
              <div>
                <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Summary</h4>
                <p className="text-sm text-zinc-300 leading-relaxed">{asset.summary}</p>
              </div>

              {/* Target Industries */}
              <div>
                <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Target Industries</h4>
                <div className="flex flex-wrap gap-1.5">
                  {asset.targetIndustries.map((ind) => (
                    <Badge
                      key={ind}
                      variant="secondary"
                      className="text-[11px] bg-zinc-800 text-zinc-300 border border-zinc-700/50"
                    >
                      {ind}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Target Roles */}
              <div>
                <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Target Roles</h4>
                <div className="flex flex-wrap gap-1.5">
                  {asset.targetRoles.map((role) => (
                    <Badge
                      key={role}
                      variant="outline"
                      className="text-[11px] text-zinc-400 border-zinc-700/50"
                    >
                      {role}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Problems Solved */}
              <div>
                <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Problems It Solves</h4>
                <div className="space-y-1.5">
                  {asset.problemsSolved.map((prob) => (
                    <div
                      key={prob}
                      className="flex items-start gap-2 text-sm text-zinc-300"
                    >
                      <div className="w-1 h-1 rounded-full bg-amber-500 mt-2 flex-shrink-0" />
                      {prob}
                    </div>
                  ))}
                </div>
              </div>

              {/* Supporting Evidence */}
              <div>
                <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Supporting Evidence</h4>
                <p className="text-sm text-zinc-300 leading-relaxed bg-zinc-900/50 rounded-lg p-4 border border-zinc-800/50">
                  {asset.supportingEvidence}
                </p>
              </div>

              {/* Version History */}
              <div>
                <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Version History</h4>
                <div className="space-y-2">
                  {[...asset.versionHistory].reverse().map((vh, i) => (
                    <div key={vh.version} className="flex items-start gap-3 text-xs">
                      <div className="flex flex-col items-center">
                        <div className={cn(
                          'w-2 h-2 rounded-full mt-0.5',
                          i === 0 ? 'bg-amber-500' : 'bg-zinc-700'
                        )} />
                        {i < asset.versionHistory.length - 1 && (
                          <div className="w-px h-full bg-zinc-800 min-h-[16px]" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-zinc-300">v{vh.version}</span>
                          <span className="text-zinc-600">·</span>
                          <span className="text-zinc-500">
                            {new Date(vh.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </span>
                        </div>
                        <p className="text-zinc-500 mt-0.5">{vh.note}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Metadata */}
              <div className="flex items-center gap-4 pt-2 text-[11px] text-zinc-500">
                <span className="flex items-center gap-1">
                  <Eye className="size-3" />
                  Used in <span className="text-zinc-300 font-medium">{asset.usedInDrafts}</span> drafts
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="size-3" />
                  Updated {new Date(asset.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
              </div>

              {/* Active/Archived Toggle */}
              <div className="flex items-center justify-between py-3 border-t border-zinc-800/50">
                <div>
                  <p className="text-sm font-medium text-zinc-200">Status</p>
                  <p className="text-xs text-zinc-500">{asset.isActive ? 'Active — used in AI outreach' : 'Archived — not used in outreach'}</p>
                </div>
                <Switch
                  checked={asset.isActive}
                  className="data-[state=checked]:bg-amber-500"
                />
              </div>
            </>
          )}
        </div>
      </ScrollArea>
    </>
  )
}