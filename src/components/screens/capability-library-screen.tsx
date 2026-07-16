'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Search, Plus, Upload, BookOpen, Eye, Pencil, ChevronDown, ChevronRight,
  Layers, FileText, Award, MessageSquare, MousePointerClick, X,
  Brain, Sparkles, Target, TrendingUp, AlertTriangle, Database,
  Lightbulb, Zap, BarChart3, ArrowRight, RefreshCw, ExternalLink,
  FileUp, CheckCircle2, Info, Filter, ChevronUp, GitBranch, Archive,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Progress } from '@/components/ui/progress'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import {
  Collapsible, CollapsibleTrigger, CollapsibleContent,
} from '@/components/ui/collapsible'
import { PageTransition, AnimatedCard, SectionHeader, PulseDot, TabBar, StaggerGrid, StaggerItem } from '@/components/ui/animated-components'

// ── Types ──────────────────────────────────────────────────────

interface KnowledgeDocument {
  id: string
  title: string
  description: string | null
  fileType: string
  fileName: string
  snippetCount: number
  createdAt: string
}

interface KnowledgeSnippet {
  id: string
  documentId: string
  documentTitle: string
  fileName: string
  type: string
  title: string
  content: string
  industries: string[]
  outcomes: string[]
  score?: number
  createdAt: string
}

interface CoverageData {
  byType: Record<string, number>
  byIndustry: { industry: string; count: number }[]
  total: number
}

interface SearchResult {
  results: KnowledgeSnippet[]
  query: string
  totalSnippets: number
  contactContext: { industry: string; role: string } | null
  coverage: CoverageData
}

const TYPE_CONFIG: Record<string, { label: string; icon: typeof Layers; color: string; bg: string; border: string }> = {
  case_study:  { label: 'Case Study',  icon: FileText,         color: 'text-purple-600', bg: 'bg-purple-500/15', border: 'border-purple-500/30' },
  service:     { label: 'Service',     icon: Layers,           color: 'text-blue-600',   bg: 'bg-blue-500/15',   border: 'border-blue-500/30' },
  capability:  { label: 'Capability',  icon: Zap,              color: 'text-emerald-600',bg: 'bg-emerald-500/15', border: 'border-emerald-500/30' },
  outcome:     { label: 'Outcome',     icon: Award,            color: 'text-amber-600',  bg: 'bg-amber-500/15',  border: 'border-amber-500/30' },
}

const FILTER_TABS = [
  { key: 'all', label: 'All' },
  { key: 'service', label: 'Services' },
  { key: 'case_study', label: 'Case Studies' },
  { key: 'capability', label: 'Capabilities' },
  { key: 'outcome', label: 'Outcomes' },
] as const

// ── Component ──────────────────────────────────────────────────

export default function CapabilityLibraryScreen() {
  // Data state
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([])
  const [snippets, setSnippets] = useState<KnowledgeSnippet[]>([])
  const [coverage, setCoverage] = useState<CoverageData>({ byType: {}, byIndustry: [], total: 0 })
  const [loading, setLoading] = useState(true)

  // UI state
  const [search, setSearch] = useState('')
  const [engineQuery, setEngineQuery] = useState('')
  const [engineIndustry, setEngineIndustry] = useState('')
  const [engineRole, setEngineRole] = useState('')
  const [activeFilter, setActiveFilter] = useState<string>('all')
  const [selectedDoc, setSelectedDoc] = useState<KnowledgeDocument | null>(null)
  const [selectedSnippet, setSelectedSnippet] = useState<KnowledgeSnippet | null>(null)
  const [showUpload, setShowUpload] = useState(false)
  const [showEngine, setShowEngine] = useState(false)
  const [engineResults, setEngineResults] = useState<SearchResult | null>(null)
  const [engineLoading, setEngineLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadTitle, setUploadTitle] = useState('')
  const [uploadDesc, setUploadDesc] = useState('')
  const [docSnippets, setDocSnippets] = useState<KnowledgeSnippet[]>([])
  const [expandedDocs, setExpandedDocs] = useState<Set<string>>(new Set())

  // ── Fetch all data ──
  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/knowledge?include=snippets')
      if (!res.ok) throw new Error()
      const data = await res.json()
      if (data.success && data.data) {
        setDocuments(data.data.documents || [])
        const allSnippets: KnowledgeSnippet[] = (data.data.snippets || []).map((s: any) => ({
          id: s.id,
          documentId: s.documentId,
          documentTitle: '',
          fileName: '',
          type: s.type,
          title: s.title,
          content: s.content,
          industries: s.industries || [],
          outcomes: s.outcomes || [],
          createdAt: s.createdAt || new Date().toISOString(),
        }))
        // Map document titles to snippets
        const docMap = new Map((data.data.documents || []).map((d: any) => [d.id, d.title]))
        allSnippets.forEach(s => { s.documentTitle = docMap.get(s.documentId) || '' })
        setSnippets(allSnippets)
      }
    } catch {
      // Will work with empty state
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // ── Compute coverage from snippets ──
  useEffect(() => {
    if (snippets.length === 0) { setCoverage({ byType: {}, byIndustry: [], total: 0 }); return }
    const byType: Record<string, number> = {}
    const byIndustry: Record<string, number> = {}
    for (const s of snippets) {
      byType[s.type] = (byType[s.type] || 0) + 1
      for (const ind of s.industries) {
        byIndustry[ind] = (byIndustry[ind] || 0) + 1
      }
    }
    setCoverage({
      byType,
      byIndustry: Object.entries(byIndustry).sort((a, b) => b[1] - a[1]).slice(0, 15).map(([industry, count]) => ({ industry, count })),
      total: snippets.length,
    })
  }, [snippets])

  // ── Filtered snippets ──
  const filteredSnippets = useMemo(() => {
    let result = snippets
    if (activeFilter !== 'all') {
      result = result.filter(s => s.type === activeFilter)
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(s =>
        s.title.toLowerCase().includes(q) ||
        s.content.toLowerCase().includes(q) ||
        s.industries.some(i => i.toLowerCase().includes(q))
      )
    }
    return result
  }, [snippets, activeFilter, search])

  // ── Knowledge Engine Search ──
  const handleEngineSearch = async () => {
    if (!engineQuery.trim() && !engineIndustry.trim() && !engineRole.trim()) {
      toast.error('Enter a query, industry, or role to test')
      return
    }
    setEngineLoading(true)
    try {
      const params = new URLSearchParams()
      if (engineQuery) params.set('q', engineQuery)
      if (engineIndustry) params.set('industry', engineIndustry)
      if (engineRole) params.set('role', engineRole)
      params.set('limit', '10')
      const res = await fetch(`/api/knowledge/search?${params}`)
      const data = await res.json()
      if (data.success && data.data) {
        setEngineResults(data.data)
      }
    } catch {
      toast.error('Search failed')
    }
    setEngineLoading(false)
  }

  // ── Upload handler ──
  const handleUpload = async () => {
    if (!uploadFile) { toast.error('Select a file first'); return }
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', uploadFile)
      fd.append('title', uploadTitle || uploadFile.name.replace(/\.[^.]+$/, ''))
      fd.append('description', uploadDesc)
      fd.append('docType', uploadFile.name.split('.').pop() || 'TXT')
      const res = await fetch('/api/knowledge', { method: 'POST', body: fd })
      const data = await res.json()
      if (data.success) {
        toast.success('Document uploaded and snippets extracted')
        setShowUpload(false)
        setUploadFile(null)
        setUploadTitle('')
        setUploadDesc('')
        fetchData()
      } else {
        toast.error(data.error || 'Upload failed')
      }
    } catch {
      toast.error('Upload failed')
    }
    setUploading(false)
  }

  // ── View document snippets ──
  const handleViewDoc = (doc: KnowledgeDocument) => {
    setSelectedDoc(doc)
    const docSnips = snippets.filter(s => s.documentId === doc.id)
    setDocSnippets(docSnips)
  }

  const toggleDocExpand = (docId: string) => {
    setExpandedDocs(prev => {
      const next = new Set(prev)
      if (next.has(docId)) next.delete(docId)
      else next.add(docId)
      return next
    })
  }

  // ── Render ──
  return (
    <PageTransition>
      <div className="flex h-full">
        {/* Main content */}
        <div className={cn('flex-1 flex flex-col min-w-0 transition-all', selectedDoc ? 'mr-0 lg:mr-[560px]' : '')}>
          {/* Header */}
          <header className="flex-shrink-0 px-6 pt-6 pb-4">
            <div className="flex items-start justify-between gap-4 mb-1">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-zinc-50 flex items-center gap-2.5">
                  <Brain className="size-6 text-amber-500" />
                  Knowledge Engine
                </h1>
                <p className="text-sm text-gray-500 mt-1">
                  RAG-powered knowledge base that fuels personalized AI outreach
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Button
                  variant="outline"
                  className={cn(
                    'border-gray-300 text-gray-500 text-xs gap-1.5',
                    showEngine && 'bg-amber-50 border-amber-500/40 text-amber-700'
                  )}
                  onClick={() => setShowEngine(!showEngine)}
                >
                  <Zap className="size-3.5" />
                  Test Retrieval
                </Button>
                <Button
                  className="bg-amber-500 hover:bg-amber-400 text-black font-semibold gap-2"
                  onClick={() => setShowUpload(true)}
                >
                  <Upload className="size-4" />
                  Upload Knowledge
                </Button>
              </div>
            </div>

            {/* Coverage Bar */}
            {coverage.total > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 flex items-center gap-4 flex-wrap"
              >
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Database className="size-3.5 text-amber-500" />
                  <span className="text-gray-900 font-semibold">{coverage.total}</span> snippets from{' '}
                  <span className="text-gray-900 font-semibold">{documents.length}</span> documents
                </div>
                <Separator orientation="vertical" className="h-3 bg-gray-200" />
                {Object.entries(TYPE_CONFIG).map(([key, cfg]) => (
                  coverage.byType[key] ? (
                    <span key={key} className="flex items-center gap-1 text-xs">
                      <span className={cn('w-1.5 h-1.5 rounded-full', cfg.color.replace('text-', 'bg-'))} />
                      <span className="text-gray-500">{cfg.label}</span>
                      <span className="text-gray-900 font-medium">{coverage.byType[key]}</span>
                    </span>
                  ) : null
                ))}
                <Separator orientation="vertical" className="h-3 bg-gray-200" />
                <span className="text-xs text-gray-400">
                  {coverage.byIndustry.length} industries covered
                </span>
              </motion.div>
            )}

            {/* Search + Filters */}
            <div className="flex flex-col sm:flex-row gap-3 mt-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
                <Input
                  placeholder="Search snippets, industries, content..."
                  className="pl-9 bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 focus-visible:ring-amber-500/20 focus-visible:border-amber-500/30"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                {search && (
                  <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-500">
                    <X className="size-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Filter Tabs */}
            <div className="mt-3">
              <TabBar
                tabs={FILTER_TABS.map(t => ({
                  key: t.key,
                  label: t.label,
                  count: t.key === 'all' ? filteredSnippets.length : snippets.filter(s => s.type === t.key).length,
                }))}
                active={activeFilter}
                onChange={setActiveFilter}
              />
            </div>
          </header>

          {/* Knowledge Engine Test Panel */}
          <AnimatePresence>
            {showEngine && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="px-6 overflow-hidden"
              >
                <AnimatedCard hover={false} className="!border-amber-500/20 !bg-amber-500/[0.03] mb-4">
                  <div className="p-4 space-y-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-amber-700">
                      <Brain className="size-4" />
                      Knowledge Retrieval Test
                      <span className="text-[10px] text-gray-400 font-normal ml-2">Test what the AI will retrieve for a given context</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-gray-400" />
                        <Input
                          placeholder="Query (e.g. cost reduction, compliance...)"
                          className="pl-9 h-9 bg-gray-50 border-gray-300 text-gray-900 text-xs"
                          value={engineQuery}
                          onChange={e => setEngineQuery(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleEngineSearch()}
                        />
                      </div>
                      <Input
                        placeholder="Industry (e.g. Healthcare, Finance)"
                        className="h-9 bg-gray-50 border-gray-300 text-gray-900 text-xs"
                        value={engineIndustry}
                        onChange={e => setEngineIndustry(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleEngineSearch()}
                      />
                      <Input
                        placeholder="Role (e.g. CTO, VP Sales)"
                        className="h-9 bg-gray-50 border-gray-300 text-gray-900 text-xs"
                        value={engineRole}
                        onChange={e => setEngineRole(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleEngineSearch()}
                      />
                    </div>
                    <div className="flex items-center gap-3">
                      <Button
                        size="sm"
                        className="bg-amber-500 hover:bg-amber-400 text-black text-xs h-8 gap-1.5"
                        onClick={handleEngineSearch}
                        disabled={engineLoading}
                      >
                        {engineLoading ? <RefreshCw className="size-3 animate-spin" /> : <Zap className="size-3" />}
                        {engineLoading ? 'Searching...' : 'Test Retrieval'}
                      </Button>
                      {engineResults && (
                        <span className="text-[11px] text-gray-400">
                          {engineResults.results.length} results from {engineResults.totalSnippets} total snippets
                        </span>
                      )}
                    </div>

                    {/* Engine Results */}
                    {engineResults && (
                      <div className="mt-2 space-y-2 max-h-[300px] overflow-y-auto">
                        {engineResults.results.length === 0 ? (
                          <div className="text-center py-8 text-gray-400 text-xs">
                            <Database className="size-6 mx-auto mb-2 opacity-30" />
                            No matching snippets found. Upload more knowledge documents.
                          </div>
                        ) : (
                          engineResults.results.map((r, i) => {
                            const cfg = TYPE_CONFIG[r.type] || TYPE_CONFIG.outcome
                            const Icon = cfg.icon
                            return (
                              <motion.div
                                key={r.id}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.05 }}
                                className="rounded-lg border border-gray-200 bg-gray-50 p-3"
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex items-start gap-2 min-w-0">
                                    <div className={cn('w-6 h-6 rounded flex items-center justify-center shrink-0 mt-0.5', cfg.bg)}>
                                      <Icon className={cn('size-3', cfg.color)} />
                                    </div>
                                    <div className="min-w-0">
                                      <p className="text-xs font-medium text-gray-900 truncate">{r.title}</p>
                                      <p className="text-[11px] text-gray-400 line-clamp-2 mt-0.5">{r.content}</p>
                                      {r.industries.length > 0 && (
                                        <div className="flex gap-1 mt-1.5">
                                          {r.industries.slice(0, 3).map(ind => (
                                            <span key={ind} className="text-[10px] text-gray-500 bg-gray-200 px-1.5 py-0.5 rounded">{ind}</span>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex flex-col items-end gap-1 shrink-0">
                                    <Badge className={cn('text-[10px] font-mono h-5', r.score >= 30 ? 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30' : r.score >= 15 ? 'bg-amber-500/15 text-amber-600 border-amber-500/30' : 'bg-gray-200 text-gray-500 border-gray-300')} variant="outline">
                                      {r.score}pts
                                    </Badge>
                                    <span className={cn('text-[10px]', cfg.color)}>{TYPE_CONFIG[r.type]?.label}</span>
                                  </div>
                                </div>
                              </motion.div>
                            )
                          })
                        )}
                      </div>
                    )}
                  </div>
                </AnimatedCard>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Empty State */}
          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <RefreshCw className="size-6 text-gray-500 animate-spin" />
            </div>
          ) : documents.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
              <div className="size-20 rounded-2xl bg-gray-100/80 flex items-center justify-center mb-4">
                <Database className="size-9 text-gray-500" />
              </div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">No knowledge base yet</h3>
              <p className="text-xs text-gray-400 max-w-md mb-6 leading-relaxed">
                Upload your company&apos;s knowledge documents (case studies, service descriptions, proof points, objection responses).
                The AI will use this knowledge to write highly personalized outreach emails.
              </p>
              <Button
                className="bg-amber-500 hover:bg-amber-400 text-black font-semibold gap-2"
                onClick={() => setShowUpload(true)}
              >
                <FileUp className="size-4" />
                Upload First Document
              </Button>
            </div>
          ) : (
            <ScrollArea className="flex-1 px-6">
              {/* Coverage Cards */}
              {coverage.total > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pb-4">
                  {Object.entries(TYPE_CONFIG).map(([key, cfg]) => (
                    <motion.div
                      key={key}
                      className="rounded-lg border border-gray-200 bg-gray-50/80 p-3"
                      whileHover={{ y: -2 }}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <div className={cn('w-6 h-6 rounded flex items-center justify-center', cfg.bg)}>
                          <cfg.icon className={cn('size-3', cfg.color)} />
                        </div>
                        <span className="text-[11px] text-gray-500">{cfg.label}s</span>
                      </div>
                      <p className={cn('text-xl font-bold tabular-nums', cfg.color)}>
                        {coverage.byType[key] || 0}
                      </p>
                    </motion.div>
                  ))}
                </div>
              )}

              {/* Industry Coverage */}
              {coverage.byIndustry.length > 0 && (
                <div className="mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Target className="size-3.5 text-amber-500" />
                    <span className="text-xs font-semibold text-gray-500">Industry Coverage</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {coverage.byIndustry.map(item => {
                      const pct = Math.round((item.count / coverage.total) * 100)
                      return (
                        <span
                          key={item.industry}
                          className="text-[11px] text-gray-500 bg-gray-100 border border-gray-200/60 px-2 py-1 rounded-md"
                        >
                          {item.industry}
                          <span className="text-gray-400 ml-1.5">{item.count}</span>
                        </span>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Documents List */}
              <div className="space-y-3 pb-6">
                <div className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  <FileText className="size-3.5 text-amber-500" />
                  Documents & Extracted Knowledge
                </div>
                {documents.map(doc => {
                  const docSnipCount = snippets.filter(s => s.documentId === doc.id).length
                  const isExpanded = expandedDocs.has(doc.id)
                  const docSnips = isExpanded ? snippets.filter(s => s.documentId === doc.id) : []

                  return (
                    <motion.div
                      key={doc.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="rounded-xl border border-gray-200 bg-gray-50/80 overflow-hidden"
                    >
                      <button
                        onClick={() => toggleDocExpand(doc.id)}
                        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors text-left"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
                            <FileText className="size-4 text-amber-500" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{doc.title}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[10px] text-gray-400">{doc.fileType}</span>
                              <span className="text-[10px] text-gray-500">|</span>
                              <span className="text-[10px] text-amber-500/80">{docSnipCount} snippets extracted</span>
                              {doc.description && (
                                <>
                                  <span className="text-[10px] text-gray-500">|</span>
                                  <span className="text-[10px] text-gray-400 truncate max-w-[200px]">{doc.description}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[10px] text-gray-400 border-gray-300/50 h-5">
                            {new Date(doc.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </Badge>
                          {isExpanded ? <ChevronDown className="size-4 text-gray-400" /> : <ChevronRight className="size-4 text-gray-400" />}
                        </div>
                      </button>

                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="px-4 pb-4 space-y-2 border-t border-gray-200/40 pt-3">
                              {docSnips.length === 0 ? (
                                <p className="text-xs text-gray-400 text-center py-4">No snippets extracted</p>
                              ) : (
                                docSnips.map((snip, i) => {
                                  const cfg = TYPE_CONFIG[snip.type] || TYPE_CONFIG.outcome
                                  const Icon = cfg.icon
                                  return (
                                    <motion.div
                                      key={snip.id}
                                      initial={{ opacity: 0, y: 5 }}
                                      animate={{ opacity: 1, y: 0 }}
                                      transition={{ delay: i * 0.03 }}
                                      className="rounded-lg border border-gray-200/40 bg-gray-50 p-3"
                                    >
                                      <div className="flex items-start gap-2">
                                        <div className={cn('w-5 h-5 rounded flex items-center justify-center shrink-0 mt-0.5', cfg.bg)}>
                                          <Icon className={cn('size-2.5', cfg.color)} />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                          <div className="flex items-center gap-2">
                                            <p className="text-xs font-medium text-gray-900">{snip.title}</p>
                                            <Badge className={cn('text-[9px] h-4 border', cfg.border, cfg.bg, cfg.color)} variant="outline">
                                              {cfg.label}
                                            </Badge>
                                          </div>
                                          <p className="text-[11px] text-gray-500 leading-relaxed mt-1 line-clamp-3">{snip.content}</p>
                                          {snip.industries.length > 0 && (
                                            <div className="flex gap-1 mt-1.5">
                                              {snip.industries.map(ind => (
                                                <span key={ind} className="text-[9px] text-gray-400 bg-gray-200 px-1.5 py-0.5 rounded">{ind}</span>
                                              ))}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </motion.div>
                                  )
                                })
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  )
                })}
              </div>

              {/* All Snippets (filtered) */}
              {filteredSnippets.length > 0 && (
                <div className="space-y-3 pb-6">
                  <div className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    <Sparkles className="size-3.5 text-amber-500" />
                    All Snippets
                    <span className="text-gray-500 font-normal normal-case">({filteredSnippets.length})</span>
                  </div>
                  <StaggerGrid className="grid grid-cols-1 xl:grid-cols-2 gap-3" stagger={0.04}>
                    {filteredSnippets.slice(0, 40).map(snip => {
                      const cfg = TYPE_CONFIG[snip.type] || TYPE_CONFIG.outcome
                      const Icon = cfg.icon
                      return (
                        <StaggerItem key={snip.id}>
                          <motion.div
                            className="rounded-xl border border-gray-200 bg-gray-50/80 p-4 cursor-pointer hover:border-amber-500/40 transition-colors"
                            whileHover={{ y: -2 }}
                            onClick={() => setSelectedSnippet(snip)}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <div className={cn('w-6 h-6 rounded flex items-center justify-center', cfg.bg)}>
                                  <Icon className={cn('size-3', cfg.color)} />
                                </div>
                                <Badge className={cn('text-[10px] h-5 border', cfg.border, cfg.bg, cfg.color)} variant="outline">
                                  {cfg.label}
                                </Badge>
                              </div>
                              {snip.score !== undefined && (
                                <Badge className="text-[10px] font-mono h-5 bg-emerald-500/15 text-emerald-600 border-emerald-500/30" variant="outline">
                                  {snip.score}pts
                                </Badge>
                              )}
                            </div>
                            <h3 className="text-sm font-medium text-gray-900 leading-snug mb-1.5">{snip.title}</h3>
                            <p className="text-[11px] text-gray-500 leading-relaxed line-clamp-3">{snip.content}</p>
                            <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                              {snip.industries.slice(0, 3).map(ind => (
                                <span key={ind} className="text-[10px] text-gray-500 bg-gray-200 px-1.5 py-0.5 rounded">{ind}</span>
                              ))}
                              {snip.documentTitle && (
                                <span className="text-[10px] text-gray-500 ml-auto truncate max-w-[150px]">
                                  from: {snip.documentTitle}
                                </span>
                              )}
                            </div>
                          </motion.div>
                        </StaggerItem>
                      )
                    })}
                  </StaggerGrid>
                </div>
              )}
            </ScrollArea>
          )}
        </div>

        {/* Snippet Detail Panel */}
        <AnimatePresence>
          {selectedSnippet && (
            <motion.aside
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="fixed right-0 top-0 bottom-0 w-[520px] max-w-full bg-white border-l border-gray-200 z-40 flex flex-col shadow-2xl shadow-gray-400/40"
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
                <div className="flex items-center gap-2">
                  {(() => { const cfg = TYPE_CONFIG[selectedSnippet.type] || TYPE_CONFIG.outcome; const Icon = cfg.icon; return (
                    <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold', cfg.bg, cfg.color)}>
                      <Icon className="size-3" /> {cfg.label}
                    </span>
                  )})()}
                  {selectedSnippet.score !== undefined && (
                    <Badge className="text-[10px] font-mono h-5 bg-emerald-500/15 text-emerald-600 border-emerald-500/30" variant="outline">
                      Relevance: {selectedSnippet.score}pts
                    </Badge>
                  )}
                </div>
                <button onClick={() => setSelectedSnippet(null)} className="p-1.5 rounded-md text-gray-400 hover:text-gray-900 hover:bg-gray-200 transition-colors">
                  <X className="size-4" />
                </button>
              </div>
              <ScrollArea className="flex-1">
                <div className="px-6 py-5 space-y-5">
                  <div>
                    <h2 className="text-lg font-bold text-zinc-100">{selectedSnippet.title}</h2>
                    {selectedSnippet.documentTitle && (
                      <p className="text-[11px] text-gray-400 mt-1">Source: {selectedSnippet.documentTitle}</p>
                    )}
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Content</h4>
                    <div className="text-sm text-gray-500 leading-relaxed bg-gray-50 rounded-lg p-4 border border-gray-200/50 whitespace-pre-wrap">
                      {selectedSnippet.content}
                    </div>
                  </div>
                  {selectedSnippet.industries.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Target Industries</h4>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedSnippet.industries.map(ind => (
                          <Badge key={ind} variant="secondary" className="text-[11px] bg-gray-200 text-gray-500 border border-gray-300/50">{ind}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {selectedSnippet.outcomes.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Expected Outcomes</h4>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedSnippet.outcomes.map(out => (
                          <Badge key={out} variant="outline" className="text-[11px] text-amber-600 border-amber-500/30">{out}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* How this gets used */}
                  <div className="rounded-lg border border-amber-500/20 bg-amber-500/[0.03] p-4">
                    <div className="flex items-center gap-2 text-xs font-semibold text-amber-700 mb-2">
                      <Lightbulb className="size-3.5" />
                      How This Gets Used
                    </div>
                    <p className="text-[11px] text-gray-500 leading-relaxed">
                      When generating an email, the Knowledge Engine scores all snippets against the contact&apos;s industry, role, and company.
                      Top-scoring snippets are injected into the AI prompt as context, enabling truly personalized outreach.
                      Higher-scoring snippets have better industry/keyword alignment with the target.
                    </p>
                  </div>
                </div>
              </ScrollArea>
            </motion.aside>
          )}
        </AnimatePresence>
      </div>

      {/* Upload Dialog */}
      <Dialog open={showUpload} onOpenChange={setShowUpload}>
        <DialogContent className="bg-white border-gray-200 max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-zinc-100 flex items-center gap-2">
              <Upload className="size-4 text-amber-500" />
              Upload Knowledge Document
            </DialogTitle>
            <DialogDescription className="text-gray-500">
              Upload a .txt or .md file. The system will auto-extract knowledge snippets and classify them for AI retrieval.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs text-gray-500 mb-1.5 block">Document Title</Label>
              <Input
                placeholder="e.g. Q4 2024 Case Studies"
                className="bg-gray-200 border-gray-300 text-gray-900 text-sm"
                value={uploadTitle}
                onChange={e => setUploadTitle(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs text-gray-500 mb-1.5 block">Description (optional)</Label>
              <Textarea
                placeholder="Brief description of what this document contains..."
                className="bg-gray-200 border-gray-300 text-gray-900 text-sm resize-none"
                rows={2}
                value={uploadDesc}
                onChange={e => setUploadDesc(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs text-gray-500 mb-1.5 block">File (.txt or .md)</Label>
              <div
                className={cn(
                  'border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors',
                  uploadFile ? 'border-amber-500/40 bg-amber-500/5' : 'border-gray-300 hover:border-gray-300'
                )}
                onClick={() => document.getElementById('knowledge-upload')?.click()}
              >
                <input
                  id="knowledge-upload"
                  type="file"
                  accept=".txt,.md"
                  className="hidden"
                  onChange={e => setUploadFile(e.target.files?.[0] || null)}
                />
                {uploadFile ? (
                  <div className="flex items-center justify-center gap-2 text-sm text-amber-700">
                    <CheckCircle2 className="size-4" />
                    {uploadFile.name}
                    <button onClick={(e) => { e.stopPropagation(); setUploadFile(null) }} className="text-gray-400 hover:text-gray-500">
                      <X className="size-3.5" />
                    </button>
                  </div>
                ) : (
                  <>
                    <FileUp className="size-8 text-gray-500 mx-auto mb-2" />
                    <p className="text-xs text-gray-500">Click to select a .txt or .md file</p>
                    <p className="text-[10px] text-gray-500 mt-1">Max 10MB</p>
                  </>
                )}
              </div>
            </div>
            <div className="rounded-lg border border-blue-500/20 bg-blue-500/[0.03] p-3">
              <div className="flex items-start gap-2">
                <Info className="size-3.5 text-blue-600 shrink-0 mt-0.5" />
                <p className="text-[11px] text-gray-500 leading-relaxed">
                  The system auto-extracts snippets by splitting your document into sections and classifying them as
                  Case Studies, Services, Capabilities, or Outcomes based on content analysis.
                  For best results, use clear headings and separate topics into paragraphs.
                </p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUpload(false)} className="border-gray-300 text-gray-500 text-xs">
              Cancel
            </Button>
            <Button
              className="bg-amber-500 hover:bg-amber-400 text-black font-semibold text-xs gap-1.5"
              onClick={handleUpload}
              disabled={!uploadFile || uploading}
            >
              {uploading ? <RefreshCw className="size-3 animate-spin" /> : <Upload className="size-3" />}
              {uploading ? 'Uploading...' : 'Upload & Extract'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageTransition>
  )
}