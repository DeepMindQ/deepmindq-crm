'use client'

import { useState, useCallback, useRef, useMemo, useEffect } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Upload,
  FileSpreadsheet,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  FileText,
  Building2,
  Users,
  Copy,
  MailWarning,
  Clock,
  Check,
  Loader2,
  RefreshCw,
  ExternalLink,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ParsedCSV {
  headers: string[]
  rows: Record<string, string>[]
}

type MappingField =
  | 'companyName'
  | 'contactName'
  | 'email'
  | 'jobTitle'
  | 'role'
  | 'linkedin'
  | 'phone'
  | 'location'
  | 'industry'
  | 'country'
  | 'domain'
  | 'employeeSize'
  | 'website'
  | '__skip__'

interface ColumnMapping {
  [csvColumn: string]: MappingField
}

interface ImportHistoryItem {
  id: string
  fileName: string
  rows: number
  status: 'completed' | 'failed' | 'processing'
  date: string
}

interface ImportResult {
  companiesCreated: number
  contactsAdded: number
  duplicatesSkipped: number
  invalidEmailsArchived: number
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAPPING_OPTIONS: { value: MappingField; label: string; recommended?: boolean }[] = [
  { value: 'companyName', label: 'Company Name', recommended: true },
  { value: 'contactName', label: 'Contact Name', recommended: true },
  { value: 'email', label: 'Email' },
  { value: 'jobTitle', label: 'Job Title' },
  { value: 'role', label: 'Role' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'phone', label: 'Phone' },
  { value: 'location', label: 'Location' },
  { value: 'industry', label: 'Industry' },
  { value: 'country', label: 'Country' },
  { value: 'domain', label: 'Domain' },
  { value: 'employeeSize', label: 'Employee Size' },
  { value: 'website', label: 'Website' },
  { value: '__skip__', label: '-- Skip --' },
]

const AUTO_DETECT_RULES: { pattern: RegExp; field: MappingField }[] = [
  { pattern: /e[-_]?mail/i, field: 'email' },
  { pattern: /company/i, field: 'companyName' },
  { pattern: /organization|org\b/i, field: 'companyName' },
  { pattern: /firm|account/i, field: 'companyName' },
  { pattern: /(contact|full)[\s_-]*name/i, field: 'contactName' },
  { pattern: /^(name|first[\s_-]*name|last[\s_-]*name)$/i, field: 'contactName' },
  { pattern: /job[\s_-]*title|position|title/i, field: 'jobTitle' },
  { pattern: /role/i, field: 'role' },
  { pattern: /linkedin/i, field: 'linkedin' },
  { pattern: /phone|tel/i, field: 'phone' },
  { pattern: /location|city|address/i, field: 'location' },
  { pattern: /industry|sector/i, field: 'industry' },
  { pattern: /country/i, field: 'country' },
  { pattern: /domain/i, field: 'domain' },
  { pattern: /employee|size|headcount|head[_\s]*count/i, field: 'employeeSize' },
  { pattern: /website|url|site/i, field: 'website' },
]

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const STEPS = [
  { id: 1, title: 'Upload', description: 'Choose your CSV file' },
  { id: 2, title: 'Map Columns', description: 'Match fields to your data' },
  { id: 3, title: 'Review', description: 'Verify import summary' },
  { id: 4, title: 'Import', description: 'Process your data' },
] as const

// ---------------------------------------------------------------------------
// CSV Parser
// ---------------------------------------------------------------------------

function parseCSV(text: string): ParsedCSV {
  const lines = text.split('\n').filter((l) => l.trim())
  if (lines.length === 0) return { headers: [], rows: [] }

  const headers = lines[0]
    .split(',')
    .map((h) => h.trim().replace(/^"|"$/g, ''))

  const rows = lines.slice(1).map((line) => {
    const values = line
      .split(',')
      .map((v) => v.trim().replace(/^"|"$/g, ''))
    const row: Record<string, string> = {}
    headers.forEach((h, i) => {
      row[h] = values[i] || ''
    })
    return row
  })

  return { headers, rows }
}

// ---------------------------------------------------------------------------
// Smart auto-detection
// ---------------------------------------------------------------------------

function autoDetectMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {}
  const usedFields = new Set<MappingField>()

  for (const header of headers) {
    let matched = false
    for (const rule of AUTO_DETECT_RULES) {
      if (rule.pattern.test(header) && !usedFields.has(rule.field)) {
        mapping[header] = rule.field
        usedFields.add(rule.field)
        matched = true
        break
      }
    }
    if (!matched) {
      mapping[header] = '__skip__'
    }
  }

  return mapping
}

// ---------------------------------------------------------------------------
// Step animations
// ---------------------------------------------------------------------------

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 80 : -80,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction < 0 ? 80 : -80,
    opacity: 0,
  }),
}

// ---------------------------------------------------------------------------
// Summary calculator
// ---------------------------------------------------------------------------

function computeSummary(
  rows: Record<string, string>[],
  mapping: ColumnMapping
) {
  const companyKey = Object.entries(mapping).find(
    ([, v]) => v === 'companyName'
  )?.[0]
  const emailKey = Object.entries(mapping).find(
    ([, v]) => v === 'email'
  )?.[0]
  const contactKey = Object.entries(mapping).find(
    ([, v]) => v === 'contactName'
  )?.[0]

  const totalRows = rows.length

  const companySet = new Set<string>()
  rows.forEach((row) => {
    if (companyKey) {
      const val = (row[companyKey] || '').trim().toLowerCase()
      if (val) companySet.add(val)
    }
  })
  const uniqueCompanies = companySet.size

  let invalidEmails = 0
  rows.forEach((row) => {
    if (emailKey) {
      const val = (row[emailKey] || '').trim()
      if (val && !EMAIL_REGEX.test(val)) invalidEmails++
    }
  })

  const seen = new Set<string>()
  let duplicates = 0
  rows.forEach((row) => {
    const email = emailKey ? (row[emailKey] || '').trim().toLowerCase() : ''
    const name = contactKey ? (row[contactKey] || '').trim().toLowerCase() : ''
    const company = companyKey
      ? (row[companyKey] || '').trim().toLowerCase()
      : ''
    const key = email || `${name}||${company}`
    if (key && seen.has(key)) {
      duplicates++
    } else {
      seen.add(key)
    }
  })

  const validRows = Math.max(0, totalRows - duplicates)

  return {
    totalRows,
    uniqueCompanies,
    duplicates,
    invalidEmails,
    validRows,
  }
}

// ---------------------------------------------------------------------------
// Fallback import history data
// ---------------------------------------------------------------------------

const FALLBACK_HISTORY: ImportHistoryItem[] = [
  {
    id: '1',
    fileName: 'leads-q4-2024.csv',
    rows: 1250,
    status: 'completed',
    date: '12/15/2024',
  },
  {
    id: '2',
    fileName: 'conference-attendees.csv',
    rows: 340,
    status: 'completed',
    date: '12/10/2024',
  },
  {
    id: '3',
    fileName: 'website-leads-dec.csv',
    rows: 89,
    status: 'failed',
    date: '12/8/2024',
  },
]

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ImportScreen() {
  const [currentStep, setCurrentStep] = useState(1)
  const [direction, setDirection] = useState(0)

  // Step 1: Upload
  const [file, setFile] = useState<File | null>(null)
  const [parsedData, setParsedData] = useState<ParsedCSV | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Step 2: Mapping
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({})

  // Step 4: Import
  const [importProgress, setImportProgress] = useState(0)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)

  // -----------------------------------------------------------------------
  // Derived summary
  // -----------------------------------------------------------------------
  const summary = useMemo(() => {
    if (!parsedData) return null
    return computeSummary(parsedData.rows, columnMapping)
  }, [parsedData, columnMapping])

  // -----------------------------------------------------------------------
  // Import history query
  // -----------------------------------------------------------------------
  const { data: historyData } = useQuery<ImportHistoryItem[]>({
    queryKey: ['import-history'],
    queryFn: async () => {
      try {
        const res = await fetch('/api/imports')
        if (res.ok) {
          const data = await res.json()
          return (data ?? []).map(
            (item: Record<string, unknown>) =>
              ({
                id: String(item.id ?? ''),
                fileName: String(item.fileName ?? 'Unknown'),
                rows: Number(item.totalRows ?? 0),
                status:
                  (item.status as string) === 'completed'
                    ? 'completed'
                    : (item.status as string) === 'failed'
                      ? 'failed'
                      : 'processing',
                date: item.createdAt
                  ? String(new Date(item.createdAt as string).toLocaleDateString())
                  : '—',
              }) satisfies ImportHistoryItem
          )
        }
      } catch {
        // API not available yet — use fallback
      }
      return FALLBACK_HISTORY
    },
    staleTime: 30_000,
  })

  // -----------------------------------------------------------------------
  // Import mutation (simulated)
  // -----------------------------------------------------------------------
  const importMutation = useMutation({
    mutationFn: async () => {
      // Simulate the import with a 2-second animated progress
      await new Promise<void>((resolve) => {
        setImportProgress(0)
        const duration = 2000
        const interval = 30
        let elapsed = 0

        const timer = setInterval(() => {
          elapsed += interval
          const t = Math.min(elapsed / duration, 1)
          // Ease-out cubic
          const eased = 1 - Math.pow(1 - t, 3)
          setImportProgress(Math.round(eased * 100))
          if (t >= 1) {
            clearInterval(timer)
            resolve()
          }
        }, interval)
      })
    },
    onSuccess: () => {
      setImportResult({
        companiesCreated: summary?.uniqueCompanies ?? 0,
        contactsAdded: summary?.validRows ?? 0,
        duplicatesSkipped: summary?.duplicates ?? 0,
        invalidEmailsArchived: summary?.invalidEmails ?? 0,
      })
    },
  })

  // -----------------------------------------------------------------------
  // File handling
  // -----------------------------------------------------------------------
  const handleFile = useCallback((f: File) => {
    if (!f.name.endsWith('.csv')) return
    setFile(f)
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      const data = parseCSV(text)
      setParsedData(data)
      setColumnMapping(autoDetectMapping(data.headers))
    }
    reader.readAsText(f)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      const f = e.dataTransfer.files[0]
      if (f) handleFile(f)
    },
    [handleFile]
  )

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0]
      if (f) handleFile(f)
    },
    [handleFile]
  )

  // -----------------------------------------------------------------------
  // Navigation
  // -----------------------------------------------------------------------
  const goToStep = useCallback(
    (step: number) => {
      setDirection(step > currentStep ? 1 : -1)
      setCurrentStep(step)
    },
    [currentStep]
  )

  const handleContinue = useCallback(() => {
    if (currentStep < 4) goToStep(currentStep + 1)
  }, [currentStep, goToStep])

  const handleBack = useCallback(() => {
    if (currentStep > 1) goToStep(currentStep - 1)
  }, [currentStep, goToStep])

  const handleReset = useCallback(() => {
    setCurrentStep(1)
    setFile(null)
    setParsedData(null)
    setColumnMapping({})
    setImportProgress(0)
    setImportResult(null)
    importMutation.reset()
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [importMutation])

  // -----------------------------------------------------------------------
  // Column mapping helpers
  // -----------------------------------------------------------------------
  const updateMapping = useCallback(
    (csvColumn: string, field: MappingField) => {
      setColumnMapping((prev) => {
        const next = { ...prev, [csvColumn]: field }
        // If this field was mapped elsewhere, un-map the other column
        if (field !== '__skip__') {
          for (const [col, f] of Object.entries(prev)) {
            if (col !== csvColumn && f === field) {
              next[col] = '__skip__'
            }
          }
        }
        return next
      })
    },
    []
  )

  const hasCompanyMapping = Object.values(columnMapping).includes('companyName')
  const hasContactMapping = Object.values(columnMapping).includes('contactName')

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------
  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / 1048576).toFixed(1)} MB`
  }

  // -----------------------------------------------------------------------
  // When step changes to 4, trigger import automatically
  // -----------------------------------------------------------------------
  const prevStepRef = useRef(currentStep)
  useEffect(() => {
    if (prevStepRef.current !== 4 && currentStep === 4 && !importResult) {
      const timer = setTimeout(() => importMutation.mutate(), 200)
      return () => clearTimeout(timer)
    }
    prevStepRef.current = currentStep
  }, [currentStep, importResult, importMutation])

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-slate-50 to-white">
      {/* ---- Header ---- */}
      <header className="border-b border-slate-200/80 bg-white/80 backdrop-blur-xl sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-slate-900">
                Import Data
              </h1>
              <p className="text-sm text-slate-500 mt-0.5">
                Upload a CSV file to import companies and contacts
              </p>
            </div>
            {currentStep === 4 && importResult && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleReset}
                className="gap-1.5 text-slate-600"
              >
                <RefreshCw className="size-3.5" />
                Import Another
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* ---- Main ---- */}
      <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stepper */}
        <div className="mb-10">
          <div className="flex items-center justify-between">
            {STEPS.map((step, idx) => {
              const isActive = step.id === currentStep
              const isCompleted = step.id < currentStep
              const isLast = idx === STEPS.length - 1

              return (
                <div
                  key={step.id}
                  className="flex items-center flex-1 last:flex-none"
                >
                  <div className="flex flex-col items-center gap-2">
                    <motion.div
                      className={cn(
                        'relative flex items-center justify-center rounded-full border-2 size-10 transition-colors duration-300',
                        isActive &&
                          'border-emerald-500 bg-emerald-500 text-white shadow-lg shadow-emerald-500/25',
                        isCompleted &&
                          'border-emerald-500 bg-emerald-500 text-white',
                        !isActive &&
                          !isCompleted &&
                          'border-slate-300 bg-white text-slate-400'
                      )}
                      animate={isActive ? { scale: [1, 1.08, 1] } : {}}
                      transition={
                        isActive
                          ? { duration: 0.6, repeat: Infinity, repeatDelay: 2 }
                          : {}
                      }
                    >
                      {isCompleted ? (
                        <Check className="size-4.5" strokeWidth={3} />
                      ) : (
                        <span className="text-sm font-semibold">{step.id}</span>
                      )}
                    </motion.div>
                    <div className="text-center">
                      <p
                        className={cn(
                          'text-xs font-medium transition-colors',
                          isActive
                            ? 'text-emerald-700'
                            : isCompleted
                              ? 'text-slate-700'
                              : 'text-slate-400'
                        )}
                      >
                        {step.title}
                      </p>
                      <p className="text-[11px] text-slate-400 hidden sm:block mt-0.5">
                        {step.description}
                      </p>
                    </div>
                  </div>

                  {!isLast && (
                    <div className="flex-1 mx-3 sm:mx-4 mt-[-1.25rem]">
                      <div className="h-0.5 rounded-full overflow-hidden bg-slate-200">
                        <motion.div
                          className="h-full bg-emerald-500 rounded-full"
                          initial={{ width: '0%' }}
                          animate={{
                            width: isCompleted
                              ? '100%'
                              : isActive
                                ? '50%'
                                : '0%',
                          }}
                          transition={{ duration: 0.5, ease: 'easeInOut' }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* ---- Step Content ---- */}
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={currentStep}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            {/* =========================================================== */}
            {/* STEP 1 — Upload                                              */}
            {/* =========================================================== */}
            {currentStep === 1 && (
              <div className="max-w-2xl mx-auto">
                <Card className="border-slate-200/80 shadow-sm overflow-hidden">
                  <CardHeader className="pb-0">
                    <CardTitle className="text-lg text-slate-900">
                      Upload CSV File
                    </CardTitle>
                    <CardDescription>
                      Select a CSV file containing your leads or contacts data
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-6">
                    {/* Drop zone */}
                    <motion.div
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      onClick={() => fileInputRef.current?.click()}
                      className={cn(
                        'relative cursor-pointer rounded-xl border-2 border-dashed px-6 py-16 sm:py-20',
                        'flex flex-col items-center justify-center gap-4 text-center',
                        'transition-all duration-300 ease-out',
                        isDragging
                          ? 'border-emerald-400 bg-emerald-50/80 scale-[1.01]'
                          : file
                            ? 'border-emerald-300 bg-emerald-50/40'
                            : 'border-slate-300 bg-slate-50/50 hover:border-emerald-400 hover:bg-emerald-50/40 hover:scale-[1.005] active:scale-[0.995]'
                      )}
                      whileHover={!isDragging ? { y: -2 } : {}}
                      whileTap={!isDragging ? { scale: 0.995 } : {}}
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".csv"
                        onChange={handleFileInput}
                        className="hidden"
                      />

                      {file ? (
                        <>
                          <motion.div
                            initial={{ scale: 0, rotate: -10 }}
                            animate={{ scale: 1, rotate: 0 }}
                            transition={{
                              type: 'spring',
                              stiffness: 200,
                              damping: 15,
                            }}
                            className="flex items-center justify-center size-14 rounded-2xl bg-emerald-100 text-emerald-600"
                          >
                            <FileSpreadsheet className="size-7" />
                          </motion.div>
                          <div>
                            <p className="text-sm font-semibold text-slate-900">
                              {file.name}
                            </p>
                            <p className="text-xs text-slate-500 mt-1">
                              {formatFileSize(file.size)}
                            </p>
                          </div>
                          <button
                            type="button"
                            className="text-xs text-slate-500 hover:text-emerald-600 underline underline-offset-2 transition-colors"
                            onClick={(e) => {
                              e.stopPropagation()
                              fileInputRef.current?.click()
                            }}
                          >
                            Change file
                          </button>
                        </>
                      ) : (
                        <>
                          <motion.div
                            className="flex items-center justify-center size-14 rounded-2xl bg-slate-100 text-slate-400"
                            animate={
                              isDragging
                                ? {
                                    scale: 1.1,
                                    backgroundColor: 'rgba(16,185,129,0.15)',
                                    color: 'rgb(5,150,105)',
                                  }
                                : {}
                            }
                            transition={{ duration: 0.2 }}
                          >
                            <Upload className="size-7" />
                          </motion.div>
                          <div>
                            <p className="text-sm font-medium text-slate-700">
                              Drop CSV file here or{' '}
                              <span className="text-emerald-600 font-semibold">
                                click to browse
                              </span>
                            </p>
                            <p className="text-xs text-slate-400 mt-1">
                              Supports .csv files up to 10 MB
                            </p>
                          </div>
                        </>
                      )}
                    </motion.div>

                    {/* Parsed confirmation */}
                    {parsedData && (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-4 flex items-center gap-2 text-xs text-slate-500"
                      >
                        <CheckCircle2 className="size-3.5 text-emerald-500" />
                        <span>
                          Parsed{' '}
                          <strong className="text-slate-700">
                            {parsedData.rows.length}
                          </strong>{' '}
                          rows with{' '}
                          <strong className="text-slate-700">
                            {parsedData.headers.length}
                          </strong>{' '}
                          columns
                        </span>
                      </motion.div>
                    )}

                    <div className="mt-6 flex justify-end">
                      <Button
                        onClick={handleContinue}
                        disabled={!file || !parsedData}
                        className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-600/20"
                      >
                        Continue
                        <ArrowRight className="size-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* =========================================================== */}
            {/* STEP 2 — Column Mapping                                      */}
            {/* =========================================================== */}
            {currentStep === 2 && parsedData && (
              <div className="space-y-6">
                {/* Preview Table */}
                <Card className="border-slate-200/80 shadow-sm overflow-hidden">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-lg text-slate-900">
                          Data Preview
                        </CardTitle>
                        <CardDescription>
                          First{' '}
                          {Math.min(5, parsedData.rows.length)} rows of your
                          file
                        </CardDescription>
                      </div>
                      <Badge
                        variant="outline"
                        className="text-xs font-normal text-slate-500"
                      >
                        {parsedData.rows.length} total rows
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="max-h-72">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-slate-200/80 bg-slate-50/80 hover:bg-slate-50/80">
                            <TableHead className="text-slate-500 font-medium text-xs uppercase tracking-wider w-10">
                              #
                            </TableHead>
                            {parsedData.headers.map((h) => (
                              <TableHead
                                key={h}
                                className="text-slate-500 font-medium text-xs uppercase tracking-wider"
                              >
                                {h}
                              </TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {parsedData.rows.slice(0, 5).map((row, i) => (
                            <TableRow key={i} className="border-slate-100">
                              <TableCell className="text-slate-400 text-xs font-mono">
                                {i + 1}
                              </TableCell>
                              {parsedData.headers.map((h) => (
                                <TableCell
                                  key={h}
                                  className="text-slate-700 text-sm max-w-[200px] truncate"
                                >
                                  {row[h] || (
                                    <span className="text-slate-300 italic">
                                      empty
                                    </span>
                                  )}
                                </TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  </CardContent>
                </Card>

                {/* Column Mapping Interface */}
                <Card className="border-slate-200/80 shadow-sm overflow-hidden">
                  <CardHeader>
                    <CardTitle className="text-lg text-slate-900">
                      Column Mapping
                    </CardTitle>
                    <CardDescription>
                      Map your CSV columns to the corresponding fields
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {parsedData.headers.map((header, idx) => {
                        const mappedTo = columnMapping[header] || '__skip__'
                        const option = MAPPING_OPTIONS.find(
                          (o) => o.value === mappedTo
                        )
                        return (
                          <motion.div
                            key={header}
                            initial={{ opacity: 0, x: -12 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.04 }}
                            className="flex items-center gap-4 py-2"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-slate-800 truncate">
                                  {header}
                                </span>
                                {parsedData.rows.length > 0 && (
                                  <span className="text-xs text-slate-400 truncate max-w-[180px]">
                                    — &ldquo;
                                    {parsedData.rows[0]?.[header]?.slice(0, 30)}
                                    &rdquo;
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-xs text-slate-400 hidden sm:inline">
                                Map to
                              </span>
                              <Select
                                value={mappedTo}
                                onValueChange={(val) =>
                                  updateMapping(header, val as MappingField)
                                }
                              >
                                <SelectTrigger className="w-[180px] h-8 text-sm">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {MAPPING_OPTIONS.map((opt) => (
                                    <SelectItem key={opt.value} value={opt.value}>
                                      <span className="flex items-center gap-2">
                                        {opt.recommended && (
                                          <span className="inline-flex items-center gap-0.5">
                                            <span className="size-1.5 rounded-full bg-emerald-400" />
                                          </span>
                                        )}
                                        {opt.label}
                                      </span>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {option?.recommended &&
                                mappedTo !== '__skip__' && (
                                  <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] px-1.5 py-0">
                                    Recommended
                                  </Badge>
                                )}
                            </div>
                          </motion.div>
                        )
                      })}
                    </div>

                    {/* Warning if no recommended mappings */}
                    {!hasCompanyMapping && !hasContactMapping && (
                      <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-4"
                      >
                        <Alert className="border-amber-200 bg-amber-50/80 text-amber-800">
                          <AlertTriangle className="size-4 text-amber-500" />
                          <AlertTitle>Missing recommended mappings</AlertTitle>
                          <AlertDescription>
                            For best results, map at least a Company Name and
                            Contact Name column.
                          </AlertDescription>
                        </Alert>
                      </motion.div>
                    )}

                    <Separator className="my-6 bg-slate-200/60" />

                    <div className="flex items-center justify-between">
                      <Button
                        variant="ghost"
                        onClick={handleBack}
                        className="gap-1.5 text-slate-500 hover:text-slate-700"
                      >
                        <ArrowLeft className="size-4" />
                        Back
                      </Button>
                      <Button
                        onClick={handleContinue}
                        className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-600/20"
                      >
                        Continue
                        <ArrowRight className="size-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* =========================================================== */}
            {/* STEP 3 — Pre-Import Summary                                  */}
            {/* =========================================================== */}
            {currentStep === 3 && summary && (
              <div className="max-w-2xl mx-auto">
                <Card className="border-slate-200/80 shadow-sm overflow-hidden">
                  <CardHeader>
                    <CardTitle className="text-lg text-slate-900">
                      Import Summary
                    </CardTitle>
                    <CardDescription>
                      Review the following details before importing
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {/* File info */}
                      <div className="flex items-center gap-3 p-3.5 rounded-lg bg-slate-50 border border-slate-200/60">
                        <div className="flex items-center justify-center size-10 rounded-xl bg-white border border-slate-200 shadow-sm">
                          <FileText className="size-5 text-slate-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-800 truncate">
                            {file?.name}
                          </p>
                          <p className="text-xs text-slate-400">
                            {file ? formatFileSize(file.size) : ''}
                          </p>
                        </div>
                      </div>

                      {/* Stats Grid */}
                      <div className="grid grid-cols-2 gap-3">
                        <motion.div
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.05 }}
                          className="p-4 rounded-xl bg-slate-50/80 border border-slate-200/60"
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <FileText className="size-3.5 text-slate-400" />
                            <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                              Total Rows
                            </span>
                          </div>
                          <p className="text-2xl font-bold text-slate-900">
                            {summary.totalRows}
                          </p>
                        </motion.div>

                        <motion.div
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.1 }}
                          className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-200/60"
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <Building2 className="size-3.5 text-emerald-500" />
                            <span className="text-xs font-medium text-emerald-700 uppercase tracking-wide">
                              New Companies
                            </span>
                          </div>
                          <p className="text-2xl font-bold text-emerald-700">
                            {summary.uniqueCompanies}
                          </p>
                        </motion.div>

                        <motion.div
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.15 }}
                          className="p-4 rounded-xl bg-slate-50/80 border border-slate-200/60"
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <Users className="size-3.5 text-slate-400" />
                            <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                              Ready to Import
                            </span>
                          </div>
                          <p className="text-2xl font-bold text-slate-900">
                            {summary.validRows}
                          </p>
                        </motion.div>

                        <motion.div
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.2 }}
                          className="p-4 rounded-xl bg-slate-50/80 border border-slate-200/60"
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <Copy className="size-3.5 text-slate-400" />
                            <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                              Possible Duplicates
                            </span>
                          </div>
                          <p
                            className={cn(
                              'text-2xl font-bold',
                              summary.duplicates > 0
                                ? 'text-amber-600'
                                : 'text-slate-900'
                            )}
                          >
                            {summary.duplicates}
                          </p>
                        </motion.div>
                      </div>

                      {/* Warnings */}
                      {summary.duplicates > 0 && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          transition={{ delay: 0.25 }}
                        >
                          <Alert className="border-amber-200 bg-amber-50/80 text-amber-800">
                            <AlertTriangle className="size-4 text-amber-500" />
                            <AlertTitle>Duplicates detected</AlertTitle>
                            <AlertDescription>
                              {summary.duplicates} duplicate
                              {summary.duplicates === 1 ? '' : 's'} found.
                              Duplicates will be skipped during import.
                            </AlertDescription>
                          </Alert>
                        </motion.div>
                      )}

                      {summary.invalidEmails > 0 && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          transition={{ delay: 0.3 }}
                        >
                          <Alert className="border-amber-200 bg-amber-50/80 text-amber-800">
                            <MailWarning className="size-4 text-amber-500" />
                            <AlertTitle>Invalid emails found</AlertTitle>
                            <AlertDescription>
                              {summary.invalidEmails} row
                              {summary.invalidEmails === 1 ? '' : 's'} with
                              invalid email format will be archived for review.
                            </AlertDescription>
                          </Alert>
                        </motion.div>
                      )}

                      <Separator className="bg-slate-200/60" />

                      {/* Active Mappings Summary */}
                      <div>
                        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3">
                          Active Mappings
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {Object.entries(columnMapping)
                            .filter(([, v]) => v !== '__skip__')
                            .map(([col, field]) => (
                              <Badge
                                key={col}
                                variant="outline"
                                className="text-xs font-normal border-slate-200 text-slate-600 bg-white"
                              >
                                {col}
                                <ArrowRight className="size-3 mx-0.5 text-slate-300" />
                                <span className="font-medium text-slate-800">
                                  {
                                    MAPPING_OPTIONS.find(
                                      (o) => o.value === field
                                    )?.label
                                  }
                                </span>
                              </Badge>
                            ))}
                          {Object.values(columnMapping).every(
                            (v) => v === '__skip__'
                          ) && (
                            <span className="text-xs text-slate-400 italic">
                              No columns mapped
                            </span>
                          )}
                        </div>
                      </div>

                      <Separator className="bg-slate-200/60" />

                      <div className="flex items-center justify-between">
                        <Button
                          variant="ghost"
                          onClick={handleBack}
                          className="gap-1.5 text-slate-500 hover:text-slate-700"
                        >
                          <ArrowLeft className="size-4" />
                          Back
                        </Button>
                        <Button
                          onClick={handleContinue}
                          size="lg"
                          className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-600/20 px-6"
                        >
                          Import {summary.validRows} Row
                          {summary.validRows !== 1 ? 's' : ''}
                          <ArrowRight className="size-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* =========================================================== */}
            {/* STEP 4 — Import Progress & Result                            */}
            {/* =========================================================== */}
            {currentStep === 4 && (
              <div className="max-w-2xl mx-auto">
                <AnimatePresence mode="wait">
                  {!importResult ? (
                    <motion.div
                      key="progress"
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.98 }}
                    >
                      <Card className="border-slate-200/80 shadow-sm overflow-hidden">
                        <CardContent className="py-16 px-8">
                          <div className="flex flex-col items-center gap-6 text-center">
                            <motion.div
                              className="flex items-center justify-center size-16 rounded-2xl bg-emerald-50 text-emerald-600"
                              animate={{ rotate: 360 }}
                              transition={{
                                duration: 2,
                                repeat: Infinity,
                                ease: 'linear',
                              }}
                            >
                              <Loader2 className="size-8" />
                            </motion.div>
                            <div>
                              <p className="text-lg font-semibold text-slate-900">
                                Importing your data&hellip;
                              </p>
                              <p className="text-sm text-slate-500 mt-1">
                                Creating companies and contacts
                              </p>
                            </div>
                            <div className="w-full max-w-sm">
                              <Progress
                                value={importProgress}
                                className="h-2.5 bg-slate-100 [&>div]:bg-emerald-500 [&>div]:rounded-full"
                              />
                              <p className="text-xs text-slate-400 mt-2">
                                {importProgress}%
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="result"
                      initial={{ opacity: 0, scale: 0.95, y: 10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      transition={{
                        type: 'spring',
                        stiffness: 180,
                        damping: 20,
                      }}
                    >
                      <Card className="border-emerald-200/80 shadow-sm shadow-emerald-100/50 overflow-hidden">
                        <CardContent className="py-10 px-8">
                          <div className="flex flex-col items-center gap-6 text-center">
                            {/* Success icon */}
                            <motion.div
                              className="flex items-center justify-center size-16 rounded-2xl bg-emerald-500 text-white"
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              transition={{
                                type: 'spring',
                                stiffness: 200,
                                damping: 12,
                                delay: 0.1,
                              }}
                            >
                              <CheckCircle2
                                className="size-8"
                                strokeWidth={2.5}
                              />
                            </motion.div>

                            <div>
                              <p className="text-xl font-bold text-slate-900">
                                Import Complete
                              </p>
                              <p className="text-sm text-slate-500 mt-1">
                                Your data has been processed successfully
                              </p>
                            </div>

                            {/* Result stat cards */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full mt-2">
                              {[
                                {
                                  label: 'Companies',
                                  value: importResult.companiesCreated,
                                  icon: Building2,
                                  color: 'text-emerald-600',
                                  bg: 'bg-emerald-50',
                                },
                                {
                                  label: 'Contacts',
                                  value: importResult.contactsAdded,
                                  icon: Users,
                                  color: 'text-slate-700',
                                  bg: 'bg-slate-50',
                                },
                                {
                                  label: 'Duplicates Skipped',
                                  value: importResult.duplicatesSkipped,
                                  icon: Copy,
                                  color: 'text-amber-600',
                                  bg: 'bg-amber-50',
                                },
                                {
                                  label: 'Invalid Emails',
                                  value: importResult.invalidEmailsArchived,
                                  icon: MailWarning,
                                  color:
                                    importResult.invalidEmailsArchived > 0
                                      ? 'text-red-500'
                                      : 'text-slate-400',
                                  bg:
                                    importResult.invalidEmailsArchived > 0
                                      ? 'bg-red-50'
                                      : 'bg-slate-50',
                                },
                              ].map((stat, idx) => (
                                <motion.div
                                  key={stat.label}
                                  initial={{ opacity: 0, y: 12 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  transition={{ delay: 0.2 + idx * 0.08 }}
                                  className={cn(
                                    'p-4 rounded-xl border border-slate-200/60',
                                    stat.bg
                                  )}
                                >
                                  <stat.icon
                                    className={cn(
                                      'size-4 mx-auto mb-2',
                                      stat.color
                                    )}
                                  />
                                  <p
                                    className={cn(
                                      'text-2xl font-bold',
                                      stat.color
                                    )}
                                  >
                                    {stat.value}
                                  </p>
                                  <p className="text-xs text-slate-500 mt-0.5">
                                    {stat.label}
                                  </p>
                                </motion.div>
                              ))}
                            </div>

                            <Separator className="bg-slate-200/60 w-full" />

                            <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
                              <Button
                                variant="outline"
                                className="gap-2 border-slate-200 text-slate-600 hover:bg-slate-50 w-full sm:w-auto"
                                onClick={handleReset}
                              >
                                <RefreshCw className="size-4" />
                                Import Another
                              </Button>
                              <Button className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-600/20 w-full sm:w-auto">
                                Go to Companies
                                <ExternalLink className="size-3.5" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* ---- Import History ---- */}
        {currentStep !== 4 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mt-16"
          >
            <Separator className="bg-slate-200/60 mb-8" />
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Clock className="size-4 text-slate-400" />
                <h2 className="text-base font-semibold text-slate-800">
                  Import History
                </h2>
              </div>
              <Card className="border-slate-200/80 shadow-sm overflow-hidden">
                <CardContent className="p-0">
                  {historyData && historyData.length > 0 ? (
                    <ScrollArea className="max-h-64">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-slate-200/80 bg-slate-50/80 hover:bg-slate-50/80">
                            <TableHead className="text-slate-500 font-medium text-xs uppercase tracking-wider">
                              File Name
                            </TableHead>
                            <TableHead className="text-slate-500 font-medium text-xs uppercase tracking-wider">
                              Rows
                            </TableHead>
                            <TableHead className="text-slate-500 font-medium text-xs uppercase tracking-wider">
                              Status
                            </TableHead>
                            <TableHead className="text-slate-500 font-medium text-xs uppercase tracking-wider text-right">
                              Date
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {historyData.map((item) => (
                            <TableRow
                              key={item.id}
                              className="border-slate-100"
                            >
                              <TableCell className="text-slate-700 text-sm font-medium">
                                <div className="flex items-center gap-2">
                                  <FileSpreadsheet className="size-4 text-slate-400" />
                                  {item.fileName}
                                </div>
                              </TableCell>
                              <TableCell className="text-slate-600 text-sm">
                                {item.rows.toLocaleString()}
                              </TableCell>
                              <TableCell>
                                <Badge
                                  className={cn(
                                    'text-[11px] font-medium border-0',
                                    item.status === 'completed' &&
                                      'bg-emerald-50 text-emerald-700',
                                    item.status === 'processing' &&
                                      'bg-amber-50 text-amber-700',
                                    item.status === 'failed' &&
                                      'bg-red-50 text-red-600'
                                  )}
                                >
                                  {item.status === 'completed' && (
                                    <CheckCircle2 className="size-3 mr-1" />
                                  )}
                                  {item.status === 'processing' && (
                                    <Loader2 className="size-3 mr-1 animate-spin" />
                                  )}
                                  {item.status === 'failed' && (
                                    <XCircle className="size-3 mr-1" />
                                  )}
                                  {item.status.charAt(0).toUpperCase() +
                                    item.status.slice(1)}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-slate-500 text-sm text-right">
                                {item.date}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  ) : (
                    <div className="py-12 text-center">
                      <div className="flex items-center justify-center size-10 rounded-xl bg-slate-100 text-slate-400 mx-auto mb-3">
                        <FileText className="size-5" />
                      </div>
                      <p className="text-sm text-slate-500">
                        No import history yet
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Your completed imports will appear here
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </motion.div>
        )}
      </main>
    </div>
  )
}