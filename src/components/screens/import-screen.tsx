'use client'

import { useState, useCallback, useRef } from 'react'
import {
  Upload, UploadCloud, CheckCircle2, ArrowRight, ArrowLeft, AlertTriangle,
  FileSpreadsheet, ShieldCheck, XCircle, Loader2, FileText, Clock,
  CheckCircle, ChevronDown, ChevronUp, Info, Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { MOCK_BATCHES } from '@/lib/mock-data'

// ── Constants ───────────────────────────────────────────────────
const TARGET_FIELDS = [
  { value: 'firstName', label: 'First Name' },
  { value: 'lastName', label: 'Last Name' },
  { value: 'email', label: 'Email' },
  { value: 'companyName', label: 'Company Name' },
  { value: 'domain', label: 'Domain' },
  { value: 'jobTitle', label: 'Job Title' },
  { value: 'role', label: 'Role' },
  { value: 'phone', label: 'Phone' },
  { value: 'location', label: 'Location' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'skip', label: 'Skip (don\'t import)' },
] as const

// Simulated file data
const MOCK_FILE_HEADERS = ['Full Name', 'Email Addr', 'Company', 'Job Title', 'Phone', 'Website']
const MOCK_FILE_ROWS = [
  ['Arjun Mehta', 'arjun.mehta@nexuscore.io', 'NexusCore Technologies', 'VP of Engineering', '+91 98450 12345', 'nexuscore.io'],
  ['Priya Sharma', 'priya.s@quantumleap.tech', 'QuantumLeap Tech', 'Head of Product', '+1 512-555-0201', 'quantumleap.tech'],
  ['Dr. Emily Brown', 'emily.b@healthtechplus.com', 'HealthTech Plus', 'Director of Innovation', '+1 617-555-0401', 'healthtechplus.com'],
]

// Auto-map intelligence
const AUTO_MAP: Record<string, string> = {
  'full name': 'firstName',
  'first name': 'firstName',
  'last name': 'lastName',
  'email': 'email',
  'email addr': 'email',
  'email address': 'email',
  'e-mail': 'email',
  'company': 'companyName',
  'company name': 'companyName',
  'organization': 'companyName',
  'domain': 'domain',
  'website': 'domain',
  'web': 'domain',
  'job title': 'jobTitle',
  'title': 'jobTitle',
  'position': 'jobTitle',
  'role': 'role',
  'seniority': 'role',
  'phone': 'phone',
  'telephone': 'phone',
  'mobile': 'phone',
  'location': 'location',
  'city': 'location',
  'country': 'location',
  'linkedin': 'linkedin',
  'linkedin url': 'linkedin',
}

// Simulated validation data
const MOCK_VALIDATION = {
  total: 248,
  clean: 198,
  needsReview: 32,
  duplicates: 12,
  invalid: 6,
  reviewReasons: [
    { row: 5, reason: 'Missing email address', severity: 'warning' as const },
    { row: 12, reason: 'Duplicate detected (same email as row 3)', severity: 'warning' as const },
    { row: 18, reason: 'Missing job title', severity: 'warning' as const },
    { row: 27, reason: 'Missing company name', severity: 'warning' as const },
    { row: 34, reason: 'Duplicate detected (same email as row 19)', severity: 'warning' as const },
    { row: 41, reason: 'Missing email address', severity: 'warning' as const },
    { row: 55, reason: 'Missing phone number (optional)', severity: 'info' as const },
  ],
  invalidReasons: [
    { row: 8, reason: 'Malformed email: "john@" (incomplete domain)', severity: 'error' as const },
    { row: 22, reason: 'Missing required field: Email', severity: 'error' as const },
    { row: 45, reason: 'Malformed email: "not-an-email"', severity: 'error' as const },
    { row: 67, reason: 'Missing required field: Company Name', severity: 'error' as const },
    { row: 89, reason: 'Malformed email: "user@.com" (no domain name)', severity: 'error' as const },
    { row: 112, reason: 'Missing required field: Email', severity: 'error' as const },
  ],
  duplicateReasons: [
    { row: 3, reason: 'Exact match: arjun.mehta@nexuscore.io exists in database', severity: 'duplicate' as const },
    { row: 15, reason: 'Exact match: priya.s@quantumleap.tech exists in database', severity: 'duplicate' as const },
    { row: 29, reason: 'Fuzzy match: emily@healthtechplus.com likely duplicates emily.b@healthtechplus.com', severity: 'duplicate' as const },
  ],
}

// ── Helpers ────────────────────────────────────────────────────
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

function statusBadge(status: string) {
  switch (status) {
    case 'committed': return <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[10px]">Completed</Badge>
    case 'reviewing': return <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-[10px]">Reviewing</Badge>
    case 'staged': return <Badge className="bg-zinc-500/10 text-zinc-400 border-zinc-500/20 text-[10px]">Staged</Badge>
    case 'archived': return <Badge className="bg-zinc-500/10 text-zinc-400 border-zinc-500/20 text-[10px]">Archived</Badge>
    default: return <Badge className="bg-zinc-500/10 text-zinc-400 border-zinc-500/20 text-[10px]">{status}</Badge>
  }
}

// ── Step Indicator ─────────────────────────────────────────────
function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center justify-center gap-0 py-2">
      {Array.from({ length: total }, (_, i) => {
        const step = i + 1
        const isActive = step === current
        const isDone = step < current
        return (
          <div key={step} className="flex items-center">
            <div className="flex flex-col items-center">
              <div className={cn(
                'size-9 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-200',
                isActive && 'bg-amber-500/20 text-amber-400 ring-2 ring-amber-500/40',
                isDone && 'bg-emerald-500/20 text-emerald-400',
                !isActive && !isDone && 'bg-secondary text-muted-foreground',
              )}>
                {isDone ? <CheckCircle className="size-4" /> : step}
              </div>
              <span className={cn(
                'text-[10px] mt-1.5 font-medium',
                isActive ? 'text-amber-400' : 'text-muted-foreground',
              )}>
                {step === 1 ? 'Upload' : step === 2 ? 'Map' : 'Review'}
              </span>
            </div>
            {step < total && (
              <div className={cn(
                'w-16 sm:w-24 h-px mx-2 mt-[-14px] transition-colors',
                step < current ? 'bg-emerald-500/40' : 'bg-border',
              )} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────
export function ImportScreen() {
  const [step, setStep] = useState(1)
  const [isUploading, setIsUploading] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [uploadedFile, setUploadedFile] = useState<{ name: string; size: number; rows: number } | null>(null)
  const [columnMapping, setColumnMapping] = useState<Record<number, string>>({})
  const [saveProfile, setSaveProfile] = useState(false)
  const [profileName, setProfileName] = useState('Sales Navigator Export')
  const [isCommitting, setIsCommitting] = useState(false)
  const [expandedIssues, setExpandedIssues] = useState<Record<string, boolean>>({})
  const fileInputRef = useRef<HTMLInputElement>(null)

  const toggleIssue = (key: string) =>
    setExpandedIssues(prev => ({ ...prev, [key]: !prev[key] }))

  // ── Step 1: Upload ────────────────────────────────────────────
  const handleUpload = useCallback(() => {
    setIsUploading(true)
    setTimeout(() => {
      setUploadedFile({
        name: 'sales_navigator_export_jul2025.xlsx',
        size: 245760,
        rows: 248,
      })
      setIsUploading(false)
      // Auto-map on upload
      const mapping: Record<number, string> = {}
      MOCK_FILE_HEADERS.forEach((h, i) => {
        const normalized = h.toLowerCase().trim()
        mapping[i] = AUTO_MAP[normalized] || 'skip'
      })
      setColumnMapping(mapping)
      toast.success('File uploaded successfully')
    }, 1500)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    handleUpload()
  }, [handleUpload])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    setIsDragging(false)
  }, [])

  const handleFileSelect = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      handleUpload()
    }
  }, [handleUpload])

  // ── Step 2: Auto-Map ─────────────────────────────────────────
  const handleAutoMap = useCallback(() => {
    const mapping: Record<number, string> = {}
    MOCK_FILE_HEADERS.forEach((h, i) => {
      const normalized = h.toLowerCase().trim()
      mapping[i] = AUTO_MAP[normalized] || 'skip'
    })
    setColumnMapping(mapping)
    toast.success('Columns auto-mapped successfully')
  }, [])

  // ── Step 3: Commit ────────────────────────────────────────────
  const handleCommit = useCallback(() => {
    setIsCommitting(true)
    setTimeout(() => {
      setIsCommitting(false)
      toast.success(`Successfully imported ${MOCK_VALIDATION.clean} rows!`)
      setStep(1)
      setUploadedFile(null)
      setColumnMapping({})
    }, 2000)
  }, [])

  const handleCancel = useCallback(() => {
    setStep(1)
    setUploadedFile(null)
    setColumnMapping({})
    toast.info('Import cancelled')
  }, [])

  // ── Render: Step 1 ────────────────────────────────────────────
  const renderUpload = () => (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Drop Zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={handleFileSelect}
        className={cn(
          'relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-12 cursor-pointer transition-all duration-200',
          isDragging
            ? 'border-amber-500/60 bg-amber-500/5'
            : 'border-border hover:border-amber-500/30 hover:bg-secondary/20',
          isUploading && 'pointer-events-none opacity-60',
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.csv"
          className="hidden"
          onChange={handleFileChange}
        />
        <div className={cn(
          'size-16 rounded-2xl flex items-center justify-center mb-4 transition-colors',
          isDragging ? 'bg-amber-500/10' : 'bg-secondary',
        )}>
          {isUploading ? (
            <Loader2 className="size-8 text-amber-400 animate-spin" />
          ) : (
            <UploadCloud className={cn('size-8', isDragging ? 'text-amber-400' : 'text-muted-foreground')} />
          )}
        </div>
        <p className="text-sm font-medium text-foreground mb-1">
          {isUploading ? 'Uploading...' : 'Drop your Excel or CSV file here, or click to browse'}
        </p>
        <p className="text-xs text-muted-foreground">Accepted formats: .xlsx, .csv</p>
      </div>

      {/* Hash protection note */}
      <div className="flex items-start gap-2.5 p-3 rounded-lg bg-secondary/30 border border-border">
        <ShieldCheck className="size-4 text-emerald-400 mt-0.5 shrink-0" />
        <div>
          <p className="text-xs font-medium text-foreground">Duplicate file protection</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Duplicate files are automatically detected via SHA-256 hash comparison. Re-importing the same file will be blocked.
          </p>
        </div>
      </div>

      {/* Uploaded file info */}
      {uploadedFile && (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <FileSpreadsheet className="size-5 text-amber-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{uploadedFile.name}</p>
              <div className="flex items-center gap-3 mt-0.5">
                <span className="text-[11px] text-muted-foreground">
                  {(uploadedFile.size / 1024).toFixed(1)} KB
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {uploadedFile.rows} rows detected
                </span>
              </div>
            </div>
            <CheckCircle2 className="size-5 text-emerald-400 shrink-0" />
          </div>
          <div className="flex justify-end">
            <Button
              onClick={() => setStep(2)}
              className="h-8 text-xs bg-amber-600 hover:bg-amber-700 text-white"
            >
              Continue to Mapping
              <ArrowRight className="size-3.5 ml-1.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )

  // ── Render: Step 2 ────────────────────────────────────────────
  const renderMapping = () => (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Mapping Table */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="p-4 flex items-center justify-between border-b border-border">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-amber-400" />
            <h3 className="text-sm font-semibold text-foreground">Column Mapping</h3>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleAutoMap}
            className="h-8 text-xs border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
          >
            <Sparkles className="size-3 mr-1" />
            Auto-Map
          </Button>
        </div>

        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Source Column</TableHead>
              <TableHead className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider text-right">Map To</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {MOCK_FILE_HEADERS.map((header, idx) => (
              <TableRow key={idx} className="border-border">
                <TableCell className="py-3">
                  <div className="flex items-center gap-2">
                    <FileText className="size-3.5 text-muted-foreground" />
                    <span className="text-sm text-foreground font-medium">{header}</span>
                  </div>
                </TableCell>
                <TableCell className="py-3 text-right">
                  <Select
                    value={columnMapping[idx] || 'skip'}
                    onValueChange={v => setColumnMapping(prev => ({ ...prev, [idx]: v }))}
                  >
                    <SelectTrigger className="w-[200px] ml-auto h-8 text-xs bg-background border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TARGET_FIELDS.map(f => (
                        <SelectItem key={f.value} value={f.value} className="text-xs">
                          {f.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Save Profile */}
      <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30 border border-border">
        <Checkbox
          id="save-profile"
          checked={saveProfile}
          onCheckedChange={(v) => setSaveProfile(v === true)}
          className="data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-500"
        />
        <Label htmlFor="save-profile" className="text-sm text-foreground cursor-pointer">
          Save as Profile
        </Label>
        {saveProfile && (
          <input
            type="text"
            value={profileName}
            onChange={e => setProfileName(e.target.value)}
            className="ml-auto h-7 w-48 px-2 text-xs rounded-md bg-background border-border text-foreground"
            placeholder="Profile name"
          />
        )}
      </div>

      {/* Preview */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="p-4 border-b border-border">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Preview — First 3 Rows</p>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider w-8">#</TableHead>
                {MOCK_FILE_HEADERS.map((h, i) => (
                  <TableHead key={i} className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    {h}
                    {columnMapping[i] && columnMapping[i] !== 'skip' && (
                      <span className="ml-1.5 text-amber-400 font-normal normal-case">
                        → {TARGET_FIELDS.find(f => f.value === columnMapping[i])?.label}
                      </span>
                    )}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {MOCK_FILE_ROWS.map((row, rIdx) => (
                <TableRow key={rIdx} className="border-border">
                  <TableCell className="py-2 text-[11px] text-muted-foreground">{rIdx + 1}</TableCell>
                  {row.map((cell, cIdx) => (
                    <TableCell key={cIdx} className="py-2 text-xs text-foreground">{cell}</TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={() => setStep(1)}
          className="h-8 text-xs border-border text-muted-foreground"
        >
          <ArrowLeft className="size-3.5 mr-1.5" />
          Back
        </Button>
        <Button
          onClick={() => setStep(3)}
          className="h-8 text-xs bg-amber-600 hover:bg-amber-700 text-white"
        >
          Continue to Review
          <ArrowRight className="size-3.5 ml-1.5" />
        </Button>
      </div>
    </div>
  )

  // ── Render: Step 3 ────────────────────────────────────────────
  const renderReview = () => {
    const v = MOCK_VALIDATION
    const progressPct = Math.round(((v.clean + v.needsReview) / v.total) * 100)

    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        {/* Summary Header */}
        <div className="text-center space-y-2">
          <h2 className="text-lg font-bold text-foreground">Ready to import {v.total} rows</h2>
          <p className="text-sm text-muted-foreground">
            Review validation results before committing. Rows with issues will be flagged for review.
          </p>
        </div>

        {/* Overall Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Overall import readiness</span>
            <span className="text-amber-400 font-medium tabular-nums">{progressPct}%</span>
          </div>
          <Progress value={progressPct} className="h-2" />
        </div>

        {/* Validation Breakdown Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4 text-center">
            <div className="flex items-center justify-center mb-2">
              <CheckCircle className="size-5 text-emerald-400" />
            </div>
            <p className="text-2xl font-bold text-emerald-400 tabular-nums">{v.clean}</p>
            <p className="text-[10px] font-medium text-emerald-400/70 uppercase tracking-wider mt-0.5">Clean</p>
          </div>

          <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4 text-center">
            <div className="flex items-center justify-center mb-2">
              <AlertTriangle className="size-5 text-amber-400" />
            </div>
            <p className="text-2xl font-bold text-amber-400 tabular-nums">{v.needsReview}</p>
            <p className="text-[10px] font-medium text-amber-400/70 uppercase tracking-wider mt-0.5">Needs Review</p>
          </div>

          <div className="rounded-lg border border-sky-500/20 bg-sky-500/5 p-4 text-center">
            <div className="flex items-center justify-center mb-2">
              <Info className="size-5 text-sky-400" />
            </div>
            <p className="text-2xl font-bold text-sky-400 tabular-nums">{v.duplicates}</p>
            <p className="text-[10px] font-medium text-sky-400/70 uppercase tracking-wider mt-0.5">Duplicates</p>
          </div>

          <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-4 text-center">
            <div className="flex items-center justify-center mb-2">
              <XCircle className="size-5 text-red-400" />
            </div>
            <p className="text-2xl font-bold text-red-400 tabular-nums">{v.invalid}</p>
            <p className="text-[10px] font-medium text-red-400/70 uppercase tracking-wider mt-0.5">Invalid</p>
          </div>
        </div>

        {/* Expandable Issue Details */}
        <div className="space-y-3">
          <div className="rounded-xl border border-border overflow-hidden">
            <button
              onClick={() => toggleIssue('review')}
              className="w-full flex items-center justify-between p-3 hover:bg-secondary/30 transition-colors"
            >
              <div className="flex items-center gap-2">
                <AlertTriangle className="size-4 text-amber-400" />
                <span className="text-sm font-medium text-foreground">Needs Review ({v.reviewReasons.length} shown)</span>
              </div>
              {expandedIssues.review ? <ChevronUp className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}
            </button>
            {expandedIssues.review && (
              <div className="px-3 pb-3 space-y-1.5">
                {v.reviewReasons.map((issue, i) => (
                  <div key={i} className="flex items-start gap-2.5 p-2 rounded-lg bg-amber-500/5 text-xs">
                    <span className="text-amber-400 font-mono font-medium shrink-0 mt-0.5">Row {issue.row}</span>
                    <span className="text-muted-foreground">{issue.reason}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-border overflow-hidden">
            <button
              onClick={() => toggleIssue('invalid')}
              className="w-full flex items-center justify-between p-3 hover:bg-secondary/30 transition-colors"
            >
              <div className="flex items-center gap-2">
                <XCircle className="size-4 text-red-400" />
                <span className="text-sm font-medium text-foreground">Invalid ({v.invalidReasons.length} shown)</span>
              </div>
              {expandedIssues.invalid ? <ChevronUp className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}
            </button>
            {expandedIssues.invalid && (
              <div className="px-3 pb-3 space-y-1.5">
                {v.invalidReasons.map((issue, i) => (
                  <div key={i} className="flex items-start gap-2.5 p-2 rounded-lg bg-red-500/5 text-xs">
                    <span className="text-red-400 font-mono font-medium shrink-0 mt-0.5">Row {issue.row}</span>
                    <span className="text-muted-foreground">{issue.reason}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-border overflow-hidden">
            <button
              onClick={() => toggleIssue('duplicates')}
              className="w-full flex items-center justify-between p-3 hover:bg-secondary/30 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Info className="size-4 text-sky-400" />
                <span className="text-sm font-medium text-foreground">Duplicates ({v.duplicateReasons.length} shown)</span>
              </div>
              {expandedIssues.duplicates ? <ChevronUp className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}
            </button>
            {expandedIssues.duplicates && (
              <div className="px-3 pb-3 space-y-1.5">
                {v.duplicateReasons.map((issue, i) => (
                  <div key={i} className="flex items-start gap-2.5 p-2 rounded-lg bg-sky-500/5 text-xs">
                    <span className="text-sky-400 font-mono font-medium shrink-0 mt-0.5">Row {issue.row}</span>
                    <span className="text-muted-foreground">{issue.reason}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Import Profile */}
        <div className="flex items-center gap-2 p-3 rounded-lg bg-secondary/30 border border-border text-xs">
          <FileText className="size-3.5 text-muted-foreground" />
          <span className="text-muted-foreground">Import Profile Used:</span>
          <span className="text-foreground font-medium">{profileName}</span>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-2">
          <Button
            variant="outline"
            onClick={() => setStep(2)}
            className="h-9 text-sm border-border text-muted-foreground"
          >
            <ArrowLeft className="size-4 mr-2" />
            Back
          </Button>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={handleCancel}
              className="h-9 text-sm border-border text-muted-foreground"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCommit}
              disabled={isCommitting}
              className="h-9 text-sm bg-amber-600 hover:bg-amber-700 text-white px-6 font-semibold"
            >
              {isCommitting ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Upload className="size-4 mr-2" />
                  Commit Import
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // ── Main Render ───────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-foreground">Import Data</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Upload, map columns, validate, and commit new contacts and companies.
        </p>
      </div>

      {/* Wizard */}
      <div className="rounded-xl border border-border bg-card/80 overflow-hidden">
        <div className="p-4 border-b border-border bg-secondary/20">
          <StepIndicator current={step} total={3} />
        </div>
        <div className="p-6">
          {step === 1 && renderUpload()}
          {step === 2 && renderMapping()}
          {step === 3 && renderReview()}
        </div>
      </div>

      {/* Recent Batches */}
      <div className="rounded-xl border border-border bg-card/80 overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="size-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">Recent Batches</h3>
          </div>
          <Badge variant="outline" className="text-[10px] border-border">
            {MOCK_BATCHES.length} batches
          </Badge>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">File Name</TableHead>
                <TableHead className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Profile</TableHead>
                <TableHead className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Status</TableHead>
                <TableHead className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider text-right">Total</TableHead>
                <TableHead className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider text-right hidden sm:table-cell">Accepted</TableHead>
                <TableHead className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider text-right hidden sm:table-cell">Duplicates</TableHead>
                <TableHead className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider text-right hidden sm:table-cell">Invalid</TableHead>
                <TableHead className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">Date</TableHead>
                <TableHead className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Uploaded By</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {MOCK_BATCHES.map(batch => (
                <TableRow
                  key={batch.id}
                  className="border-border table-row-hover cursor-pointer"
                  onClick={() => toast.info(`Viewing details for ${batch.fileName}`)}
                >
                  <TableCell className="py-2.5">
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet className="size-3.5 text-muted-foreground shrink-0" />
                      <span className="text-xs text-foreground font-medium truncate max-w-[180px]">
                        {batch.fileName}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="py-2.5">
                    <span className="text-[11px] text-muted-foreground">{batch.profileName}</span>
                  </TableCell>
                  <TableCell className="py-2.5">{statusBadge(batch.status)}</TableCell>
                  <TableCell className="py-2.5 text-right">
                    <span className="text-xs text-foreground tabular-nums">{batch.totalRows}</span>
                  </TableCell>
                  <TableCell className="py-2.5 text-right hidden sm:table-cell">
                    <span className="text-xs text-emerald-400 tabular-nums font-medium">{batch.acceptedRows}</span>
                  </TableCell>
                  <TableCell className="py-2.5 text-right hidden sm:table-cell">
                    <span className="text-xs text-sky-400 tabular-nums">{batch.duplicateRows}</span>
                  </TableCell>
                  <TableCell className="py-2.5 text-right hidden sm:table-cell">
                    <span className="text-xs text-red-400 tabular-nums">{batch.invalidRows}</span>
                  </TableCell>
                  <TableCell className="py-2.5 hidden md:table-cell">
                    <span className="text-[11px] text-muted-foreground">{formatDate(batch.createdAt)}</span>
                  </TableCell>
                  <TableCell className="py-2.5 hidden lg:table-cell">
                    <span className="text-[11px] text-muted-foreground">{batch.uploadedBy}</span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}