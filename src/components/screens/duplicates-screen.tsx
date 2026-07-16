'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  GitMerge, Users, ArrowLeftRight, Check, X, Copy, Eye,
  GitCommitHorizontal, Brain, AlertCircle, RefreshCw,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { PageTransition } from '@/components/ui/animated-components'
import { cn } from '@/lib/utils'

/* ═══════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════ */
interface DuplicateCandidate {
  id: string
  entityType: 'contact'
  existingRecord: {
    name: string
    email: string
    company: string
    jobTitle: string
    phone: string
    location: string
    sourceBatch: string
  }
  newRecord: {
    name: string
    email: string
    company: string
    jobTitle: string
    phone: string
    location: string
    sourceBatch: string
  }
  fields: {
    key: string
    label: string
    existingValue: string
    newValue: string
    differs: boolean
  }[]
  matchScore: number
  matchRule: 'email' | 'name+company' | 'linkedin'
  status: 'pending' | 'merged' | 'rejected'
}

type DuplicateStatus = 'pending' | 'merged' | 'rejected'

interface DuplicatesResponse {
  candidates: DuplicateCandidate[]
  mergeHistory: any[]
  totalScanned: number
  totalFound: number
}

/* ═══════════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════════ */
function scoreColor(score: number) {
  if (score >= 90) return 'text-emerald-600'
  if (score >= 70) return 'text-amber-600'
  return 'text-red-600'
}

function scoreBgColor(score: number) {
  if (score >= 90) return 'bg-emerald-500'
  if (score >= 70) return 'bg-amber-500'
  return 'bg-red-500'
}

function getMergedPreview(candidate: DuplicateCandidate): Record<string, string> {
  const merged: Record<string, string> = {}
  for (const field of candidate.fields) {
    if (field.differs) {
      merged[field.key] = field.existingValue.length >= field.newValue.length
        ? field.existingValue
        : field.newValue
    } else {
      merged[field.key] = field.existingValue
    }
  }
  return merged
}

/* ═══════════════════════════════════════════════════════════════
   AI Scanning Animation
   ═══════════════════════════════════════════════════════════════ */
function ScanningAnimation({ totalScanned }: { totalScanned: number }) {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    let frame: ReturnType<typeof requestAnimationFrame>
    let start: number | null = null
    const duration = 2200

    function animate(timestamp: number) {
      if (!start) start = timestamp
      const elapsed = timestamp - start
      const pct = Math.min(100, (elapsed / duration) * 100)
      setProgress(pct)
      if (pct < 100) {
        frame = requestAnimationFrame(animate)
      }
    }

    frame = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(frame)
  }, [])

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-xl bg-white border border-gray-200 shadow-sm p-6 space-y-4"
    >
      <div className="flex items-center gap-3">
        <motion.div
          animate={{ scale: [1, 1.15, 1] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.15), rgba(212, 175, 55, 0.05))' }}
        >
          <Brain className="w-5 h-5" style={{ color: '#D4AF37' }} />
        </motion.div>
        <div>
          <p className="text-sm font-semibold text-foreground">AI Scanning for Duplicates</p>
          <p className="text-xs text-muted-foreground">
            Scanning {totalScanned} contacts for potential duplicates…
          </p>
        </div>
      </div>

      <div className="h-2.5 rounded-full overflow-hidden bg-gray-100">
        <motion.div
          className="h-full rounded-full relative"
          style={{
            background: 'linear-gradient(90deg, #D4AF37, #E8C860)',
            boxShadow: '0 0 12px rgba(212, 175, 55, 0.4)',
          }}
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.15, ease: 'linear' }}
        />
      </div>

      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span>Analyzing name similarity, email domains, LinkedIn profiles</span>
        <span className="tabular-nums font-medium" style={{ color: '#D4AF37' }}>
          {Math.round(progress)}%
        </span>
      </div>
    </motion.div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   Skeleton Loader (matches DuplicateCard layout)
   ═══════════════════════════════════════════════════════════════ */
function SkeletonCard() {
  return (
    <div className="rounded-xl bg-white border border-gray-200 shadow-sm overflow-hidden space-y-0">
      {/* Header skeleton */}
      <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Skeleton className="h-5 w-10" />
          <Skeleton className="h-5 w-px" />
          <Skeleton className="h-5 w-20 rounded-md" />
          <Skeleton className="h-5 w-16 rounded-md" />
        </div>
        <div className="flex items-center gap-1.5">
          <Skeleton className="h-7 w-20" />
          <Skeleton className="h-7 w-16" />
          <Skeleton className="h-7 w-20" />
        </div>
      </div>

      {/* VS comparison skeleton */}
      <div className="p-4">
        <div className="flex flex-col lg:flex-row gap-4 items-stretch">
          {/* Left card */}
          <div className="rounded-xl border border-gray-200 p-4 flex-1 min-w-0 space-y-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-5 w-16 rounded-md" />
            </div>
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-3 w-48" />
            <Skeleton className="h-3 w-40" />
            <Skeleton className="h-3 w-44" />
            <Skeleton className="h-px w-full" />
            <div className="space-y-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-full" />
            </div>
          </div>

          {/* VS badge */}
          <div className="flex items-center justify-center py-2 lg:py-0">
            <Skeleton className="w-12 h-12 rounded-full" />
          </div>

          {/* Right card */}
          <div className="rounded-xl border border-gray-200 p-4 flex-1 min-w-0 space-y-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-5 w-16 rounded-md" />
            </div>
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-52" />
            <Skeleton className="h-3 w-36" />
            <Skeleton className="h-3 w-44" />
            <Skeleton className="h-px w-full" />
            <div className="space-y-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-full" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   Record Card (existing / new)
   ═══════════════════════════════════════════════════════════════ */
function RecordCard({
  label,
  record,
  fields,
  isExisting,
}: {
  label: string
  record: DuplicateCandidate['existingRecord']
  fields: DuplicateCandidate['fields']
  isExisting: boolean
}) {
  return (
    <div className={cn(
      'rounded-xl border p-4 flex-1 min-w-0 space-y-3',
      isExisting
        ? 'bg-card border-border'
        : 'bg-card border-primary/20',
    )}>
      <div className="flex items-center justify-between">
        <span className={cn(
          'text-[10px] font-semibold uppercase tracking-wider',
          isExisting ? 'text-muted-foreground' : 'text-primary',
        )}>
          {label}
        </span>
        <Badge variant="outline" className="text-[10px] px-2 py-0.5 rounded-md border border-border bg-secondary/50 text-muted-foreground">
          {record.sourceBatch}
        </Badge>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-semibold text-foreground">{record.name}</p>
        <p className="text-xs text-primary font-mono">{record.email}</p>
        <p className="text-xs text-muted-foreground">{record.company} &middot; {record.jobTitle}</p>
        <p className="text-[11px] text-muted-foreground">{record.phone || '—'} &middot; {record.location}</p>
      </div>

      {/* Field-level diff */}
      <Separator className="bg-border/50" />
      <div className="space-y-1.5">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Field Comparison</p>
        {fields.map(field => (
          <div key={field.key} className="flex items-center gap-2 text-[11px]">
            <span className="w-16 shrink-0 text-muted-foreground font-medium">{field.label}</span>
            {field.differs ? (
              <>
                <span className={cn(
                  'truncate',
                  isExisting ? 'text-amber-600 line-through' : 'text-amber-600',
                )}>
                  {isExisting ? field.existingValue : field.newValue}
                </span>
                <ArrowLeftRight className="size-3 text-muted-foreground shrink-0" />
                <span className={cn(
                  'truncate font-medium',
                  isExisting ? 'text-emerald-600' : 'text-emerald-600 line-through',
                )}>
                  {isExisting ? field.newValue : field.existingValue}
                </span>
              </>
            ) : (
              <span className="text-muted-foreground truncate">{field.existingValue || '—'}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   Duplicate Candidate Card
   ═══════════════════════════════════════════════════════════════ */
function DuplicateCard({
  candidate,
  onMerge,
  onKeepBoth,
  onReject,
}: {
  candidate: DuplicateCandidate
  onMerge: (id: string) => void
  onKeepBoth: (id: string) => void
  onReject: (id: string) => void
}) {
  const [showPreview, setShowPreview] = useState(false)
  const mergedPreview = getMergedPreview(candidate)

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-xl bg-card border border-border overflow-hidden"
    >
      {/* Match Header */}
      <div className="px-4 py-3 border-b border-border bg-secondary/20 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={cn('text-lg font-bold tabular-nums', scoreColor(candidate.matchScore))}>
            {candidate.matchScore}%
          </div>
          <div className="h-5 w-px bg-border" />
          <Badge variant="outline" className="text-[10px] px-2 py-0.5 rounded-md border border-primary/30 bg-primary/10 text-primary font-mono">
            {candidate.matchRule}
          </Badge>
          <Badge variant="outline" className={cn(
            'text-[10px] px-2 py-0.5 rounded-md border',
            candidate.status === 'pending' ? 'bg-amber-500/15 text-amber-600 border-amber-500/30'
              : candidate.status === 'merged' ? 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30'
              : 'bg-red-500/15 text-red-600 border-red-500/30',
          )}>
            {candidate.status}
          </Badge>
        </div>

        {candidate.status === 'pending' && (
          <div className="flex items-center gap-1.5">
            <Dialog open={showPreview} onOpenChange={setShowPreview}>
              <DialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-foreground hover:bg-primary/10"
                >
                  <Eye className="size-3 mr-1" />
                  Preview Merge
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-card border-border max-w-md">
                <DialogHeader>
                  <DialogTitle className="text-foreground">Merge Preview</DialogTitle>
                  <DialogDescription className="text-muted-foreground">
                    This is how the merged record will look. Values are chosen from the more complete record.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-2 py-3">
                  {candidate.fields.map(field => (
                    <div key={field.key} className="flex items-center gap-3 text-sm">
                      <span className="w-20 shrink-0 text-xs text-muted-foreground font-medium">{field.label}</span>
                      <span className="text-xs text-foreground font-medium">{mergedPreview[field.key] || '—'}</span>
                      {field.differs && (
                        <Badge variant="outline" className="text-[9px] px-1.5 py-0 rounded bg-amber-50 text-amber-600 border-amber-500/20 ml-auto">
                          merged
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
                <DialogFooter>
                  <Button variant="outline" className="bg-secondary text-secondary-foreground hover:bg-secondary/80 border-border" onClick={() => setShowPreview(false)}>
                    Close
                  </Button>
                  <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => { onMerge(candidate.id); setShowPreview(false) }}>
                    Confirm Merge
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Button
              size="sm"
              className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => onMerge(candidate.id)}
            >
              <GitMerge className="size-3 mr-1" />
              Merge
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs bg-secondary text-secondary-foreground hover:bg-secondary/80 border-border"
              onClick={() => onKeepBoth(candidate.id)}
            >
              <Copy className="size-3 mr-1" />
              Keep Both
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs text-red-600 hover:text-red-600 hover:bg-red-50 border-border"
              onClick={() => onReject(candidate.id)}
            >
              <X className="size-3 mr-1" />
              Reject New
            </Button>
          </div>
        )}
      </div>

      {/* VS Comparison */}
      <div className="p-4">
        <div className="flex flex-col lg:flex-row gap-4 items-stretch">
          <RecordCard
            label="Existing Record"
            record={candidate.existingRecord}
            fields={candidate.fields}
            isExisting
          />

          {/* VS Badge */}
          <div className="flex items-center justify-center py-2 lg:py-0">
            <div className="w-12 h-12 rounded-full bg-primary/10 border-2 border-primary/30 flex items-center justify-center">
              <span className="text-xs font-bold text-primary">VS</span>
            </div>
          </div>

          <RecordCard
            label="New Record"
            record={candidate.newRecord}
            fields={candidate.fields}
            isExisting={false}
          />
        </div>
      </div>
    </motion.div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   DuplicatesScreen
   ═══════════════════════════════════════════════════════════════ */
export default function DuplicatesScreen() {
  const [candidates, setCandidates] = useState<DuplicateCandidate[]>([])
  const [mergeHistory, setMergeHistory] = useState<any[]>([])
  const [filter, setFilter] = useState<DuplicateStatus | 'all'>('all')
  const [showHistory, setShowHistory] = useState(false)
  const [loading, setLoading] = useState(true)
  const [scanning, setScanning] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [totalScanned, setTotalScanned] = useState(0)

  const fetchDuplicates = useCallback(async () => {
    setLoading(true)
    setError(null)
    setScanning(true)
    try {
      const res = await fetch('/api/duplicates')
      if (!res.ok) throw new Error(`Server error: ${res.status}`)
      const data: DuplicatesResponse = await res.json()
      setTotalScanned(data.totalScanned)
      setMergeHistory(data.mergeHistory || [])
      // Brief scanning animation then reveal results
      setTimeout(() => {
        setScanning(false)
        setCandidates(data.candidates || [])
        setLoading(false)
      }, 2200)
    } catch (err) {
      setScanning(false)
      setLoading(false)
      setError(err instanceof Error ? err.message : 'Failed to load duplicates')
    }
  }, [])

  useEffect(() => {
    fetchDuplicates()
  }, [fetchDuplicates])

  // Build client-side merge history from local actions
  const [localMergeHistory, setLocalMergeHistory] = useState<any[]>([])

  const pendingCount = candidates.filter(c => c.status === 'pending').length

  const filtered = useMemo(() => {
    if (filter === 'all') return candidates
    return candidates.filter(c => c.status === filter)
  }, [candidates, filter])

  const combinedHistory = useMemo(() => {
    return [...localMergeHistory, ...mergeHistory]
  }, [localMergeHistory, mergeHistory])

  const handleMerge = (id: string) => {
    const candidate = candidates.find(c => c.id === id)
    setCandidates(prev => prev.map(c =>
      c.id === id ? { ...c, status: 'merged' as const } : c
    ))
    if (candidate) {
      setLocalMergeHistory(prev => [{
        id: `mrg-local-${Date.now()}`,
        survivorName: candidate.existingRecord.name,
        survivorEmail: candidate.existingRecord.email,
        mergedName: candidate.newRecord.name,
        mergedEmail: candidate.newRecord.email,
        matchScore: candidate.matchScore,
        fieldsMerged: candidate.fields.filter(f => f.differs).length,
        reason: `Merged via ${candidate.matchRule} rule`,
        mergedBy: 'You',
        mergedAt: new Date().toISOString(),
      }, ...prev])
    }
    toast.success('Records merged successfully')
  }

  const handleKeepBoth = (id: string) => {
    setCandidates(prev => prev.map(c =>
      c.id === id ? { ...c, status: 'rejected' as const } : c
    ))
    toast.info('Both records kept — duplicate dismissed')
  }

  const handleReject = (id: string) => {
    setCandidates(prev => prev.map(c =>
      c.id === id ? { ...c, status: 'rejected' as const } : c
    ))
    toast.success('New record rejected')
  }

  function timeAgo(iso: string) {
    const diff = Date.now() - new Date(iso).getTime()
    if (diff < 3600000) return `${Math.max(1, Math.round(diff / 60000))}m ago`
    if (diff < 86400000) return `${Math.round(diff / 3600000)}h ago`
    return `${Math.round(diff / 86400000)}d ago`
  }

  return (
    <PageTransition className="space-y-6">
      {/* ═══ Header ═══ */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground tracking-tight flex items-center gap-2.5">
            <Users className="size-5 text-primary" />
            Duplicate Review
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            <span className="text-amber-600 font-semibold">{pendingCount} pending</span> — review and resolve before importing
          </p>
        </div>

        <Button
          variant="outline"
          className={cn(
            'bg-secondary text-secondary-foreground hover:bg-secondary/80 border-border',
            showHistory && 'bg-primary/15 text-primary border-primary/30',
          )}
          onClick={() => setShowHistory(!showHistory)}
        >
          <GitCommitHorizontal className="size-3.5 mr-1.5" />
          Merge History
          <Badge variant="outline" className="ml-2 text-[10px] px-1.5 py-0 rounded-md border border-border bg-secondary/50 text-muted-foreground">
            {combinedHistory.length}
          </Badge>
        </Button>
      </div>

      {/* ═══ Scanning Animation ═══ */}
      <AnimatePresence>
        {scanning && <ScanningAnimation totalScanned={totalScanned || 0} />}
      </AnimatePresence>

      {/* ═══ Error State ═══ */}
      <AnimatePresence>
        {error && !scanning && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="rounded-xl bg-white border border-red-200 shadow-sm p-12 text-center space-y-4"
          >
            <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mx-auto">
              <AlertCircle className="w-7 h-7 text-red-500" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Failed to scan for duplicates</p>
              <p className="text-xs text-muted-foreground mt-1">{error}</p>
            </div>
            <Button
              variant="outline"
              className="bg-secondary text-secondary-foreground hover:bg-secondary/80 border-border"
              onClick={fetchDuplicates}
            >
              <RefreshCw className="size-3.5 mr-1.5" />
              Retry Scan
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ Loading Skeletons ═══ */}
      <AnimatePresence>
        {loading && !error && !scanning && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-4"
          >
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ Filter Tabs ═══ */}
      {!loading && !error && !scanning && (
        <div className="flex gap-1">
          {([
            { key: 'all', label: 'All', count: candidates.length },
            { key: 'pending', label: 'Pending', count: pendingCount },
            { key: 'merged', label: 'Merged', count: candidates.filter(c => c.status === 'merged').length },
            { key: 'rejected', label: 'Rejected', count: candidates.filter(c => c.status === 'rejected').length },
          ] as const).map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                filter === tab.key
                  ? 'bg-primary/15 text-primary border border-primary/30'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary',
              )}
            >
              {tab.label}
              <span className="ml-1.5 text-[10px] opacity-60 tabular-nums">{tab.count}</span>
            </button>
          ))}
        </div>
      )}

      {/* ═══ Candidates ═══ */}
      {!loading && !error && !scanning && (
        <>
          {filtered.length === 0 ? (
            <div className="rounded-xl bg-card border border-border p-12 text-center">
              <Check className="size-8 text-emerald-600 mx-auto mb-3" />
              <p className="text-sm text-foreground font-medium">No duplicates to review</p>
              <p className="text-xs text-muted-foreground mt-1">
                {candidates.length === 0
                  ? `Scanned ${totalScanned} contacts — all clear! New imports will be checked automatically.`
                  : 'No duplicates match the current filter.'}
              </p>
            </div>
          ) : (
            <div className="space-y-4 max-h-[600px] overflow-y-auto pr-1">
              <AnimatePresence mode="popLayout">
                {filtered.map(candidate => (
                  <DuplicateCard
                    key={candidate.id}
                    candidate={candidate}
                    onMerge={handleMerge}
                    onKeepBoth={handleKeepBoth}
                    onReject={handleReject}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}
        </>
      )}

      {/* ═══ Merge History ═══ */}
      {showHistory && !loading && !error && !scanning && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="rounded-xl bg-card border border-border overflow-hidden"
        >
          <div className="px-4 py-3 border-b border-border">
            <h2 className="text-sm font-semibold text-foreground">Merge History</h2>
          </div>
          {combinedHistory.length === 0 ? (
            <div className="p-10 text-center">
              <GitCommitHorizontal className="size-7 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground font-medium">No merge history yet</p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                Merges you perform will appear here for reference.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/20">
                    {['Date', 'Survivor', 'Merged Into', 'Score', 'Fields', 'Reason', 'By'].map(h => (
                      <th key={h} className="text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-2.5 whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {combinedHistory.map((entry, idx) => (
                    <tr key={entry.id} className={cn('border-b border-border/50 hover:bg-primary/5', idx % 2 === 1 && 'bg-secondary/10')}>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">{timeAgo(entry.mergedAt)}</td>
                      <td className="px-4 py-2.5">
                        <p className="text-xs font-medium text-foreground">{entry.survivorName}</p>
                        <code className="text-[10px] text-muted-foreground">{entry.survivorEmail}</code>
                      </td>
                      <td className="px-4 py-2.5">
                        <p className="text-xs font-medium text-foreground">{entry.mergedName}</p>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={cn('text-xs font-semibold tabular-nums', scoreColor(entry.matchScore))}>
                          {entry.matchScore}%
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">{entry.fieldsMerged}</td>
                      <td className="px-4 py-2.5 max-w-[240px]">
                        <p className="text-xs text-muted-foreground line-clamp-1">{entry.reason}</p>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">{entry.mergedBy}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </motion.div>
      )}
    </PageTransition>
  )
}