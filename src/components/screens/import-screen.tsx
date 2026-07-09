'use client'

import { useState, useRef, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Upload, CheckCircle2, ArrowRight, ArrowLeft, RefreshCw, FileSpreadsheet } from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { toast } from 'sonner'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

const FIELDS = ['companyName', 'contactName', 'email', 'jobTitle', 'role', 'linkedin', 'phone', 'location', 'industry', 'country'] as const
const FIELD_LABELS: Record<string, string> = { companyName: 'Company Name', contactName: 'Contact Name', email: 'Email', jobTitle: 'Job Title', role: 'Role', linkedin: 'LinkedIn', phone: 'Phone', location: 'Location', industry: 'Industry', country: 'Country' }

function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.split(/\r?\n/).filter(l => l.trim())
  if (lines.length < 2) return { headers: [], rows: [] }
  const parseLine = (line: string) => { const f: string[] = []; let c = '', q = false; for (let i = 0; i < line.length; i++) { const ch = line[i]; if (q) { if (ch === '"' && line[i + 1] === '"') { c += '"'; i++ } else if (ch === '"') q = false; else c += ch } else { if (ch === '"') q = true; else if (ch === ',') { f.push(c.trim()); c = '' } else c += ch } } f.push(c.trim()); return f }
  const headers = parseLine(lines[0])
  const rows = lines.slice(1).map(parseLine)
  return { headers, rows }
}

function autoDetect(header: string): string {
  const h = header.toLowerCase()
  if (h.includes('email') || h.includes('e-mail')) return 'email'
  if (h.includes('company') || h.includes('org') || h.includes('account')) return 'companyName'
  if (h.includes('linkedin')) return 'linkedin'
  if (h.includes('phone') || h.includes('mobile')) return 'phone'
  if (h.includes('location') || h.includes('city') || h.includes('address')) return 'location'
  if (h.includes('industry') || h.includes('sector')) return 'industry'
  if (h.includes('country') || h.includes('nation')) return 'country'
  if (h.includes('title') || h.includes('position') || h.includes('job')) return 'jobTitle'
  if (h.includes('role') || h.includes('function')) return 'role'
  if (h.includes('name') || h.includes('contact') || h.includes('person')) return 'contactName'
  return ''
}

export default function ImportScreen() {
  const { setActiveView } = useAppStore()
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState(1)
  const [file, setFile] = useState<File | null>(null)
  const [csv, setCsv] = useState<{ headers: string[]; rows: string[][] }>({ headers: [], rows: [] })
  const [mapping, setMapping] = useState<Record<number, string>>({})
  const [progress, setProgress] = useState(0)
  const [importResult, setImportResult] = useState<{ totalRows: number; acceptedRows: number } | null>(null)

  const { data: history } = useQuery({ queryKey: ['imports'], queryFn: () => fetch('/api/imports').then(r => r.json()) })

  const doImport = useMutation({
    mutationFn: async (f: File) => {
      const fd = new FormData(); fd.append('file', f)
      return fetch('/api/imports', { method: 'POST', body: fd }).then(r => r.json())
    },
    onSuccess: (d) => { setImportResult(d); setProgress(100); qc.invalidateQueries({ queryKey: ['imports'] }); toast.success('Import complete!') },
    onError: (e: any) => toast.error(e.error || 'Import failed'),
  })

  const handleFile = useCallback((f: File) => {
    if (!f.name.toLowerCase().endsWith('.csv')) { toast.error('Please upload a CSV file'); return }
    setFile(f)
    const reader = new FileReader()
    reader.onload = (e) => {
      const parsed = parseCSV(e.target?.result as string)
      if (parsed.headers.length === 0) { toast.error('Could not parse CSV headers'); return }
      setCsv(parsed)
      const m: Record<number, string> = {}
      parsed.headers.forEach((h, i) => { m[i] = autoDetect(h) })
      setMapping(m)
      setStep(2)
    }
    reader.readAsText(f)
  }, [])

  const onDrop = useCallback((e: React.DragEvent) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }, [handleFile])

  const companyColIdx = Object.entries(mapping).find(([, v]) => v === 'companyName')?.[0]
  const emailColIdx = Object.entries(mapping).find(([, v]) => v === 'email')?.[0]
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
  const uniqueCompanies = companyColIdx != null ? new Set(csv.rows.map(r => r[companyColIdx]).filter(Boolean)).size : 0
  const invalidEmails = emailColIdx != null ? csv.rows.filter(r => r[emailColIdx] && !emailRe.test(r[emailColIdx])).length : 0
  const readyCount = csv.rows.length - invalidEmails

  const runImport = () => {
    if (!file) return
    setStep(4); setProgress(0)
    let p = 0
    const iv = setInterval(() => { p += Math.random() * 30 + 10; if (p > 90) p = 90; setProgress(Math.min(p, 90)) }, 400)
    doImport.mutate(file, { onSettled: () => { clearInterval(iv); setProgress(100) } })
  }

  const STEPS = ['Upload', 'Map Columns', 'Review', 'Import']

  return (
    <div className="space-y-6">
      {/* Step Indicator */}
      <div className="flex items-center justify-center gap-0">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={`flex size-8 items-center justify-center rounded-full text-sm font-bold transition-all ${
                  i + 1 < step
                    ? 'bg-amber-600 text-white'
                    : i + 1 === step
                      ? 'bg-amber-600 text-white ring-4 ring-amber-100'
                      : 'bg-gray-100 text-gray-400'
                }`}
              >
                {i + 1 < step ? <CheckCircle2 className="size-4" /> : i + 1}
              </div>
              <span
                className={`hidden sm:inline whitespace-nowrap ${
                  i + 1 === step
                    ? 'text-sm font-medium text-gray-900'
                    : 'text-sm text-gray-400'
                }`}
              >
                {s}
              </span>
            </div>
            {i < 3 && <ArrowRight className="size-4 text-gray-300 mx-3 mt-[-20px] sm:mt-[-24px]" />}
          </div>
        ))}
      </div>

      {/* Step 1: Upload */}
      {step === 1 && (
        <div
          className="border-2 border-dashed border-gray-300 rounded-2xl p-16 text-center cursor-pointer hover:border-amber-400 hover:bg-amber-50/50 transition-colors"
          onClick={() => fileRef.current?.click()}
          onDragOver={e => e.preventDefault()}
          onDrop={onDrop}
        >
          <Upload className="size-10 mx-auto text-gray-300" />
          <p className="mt-4 text-base font-medium text-gray-700">
            Drop your CSV file here or click to browse
          </p>
          <p className="text-sm text-gray-400 mt-1.5">
            .csv files only
          </p>
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
          />
        </div>
      )}

      {/* Step 2: Column Mapping */}
      {step === 2 && (
        <div className="rounded-xl border border-gray-200/80 shadow-sm bg-white">
          <div className="p-5 pb-3">
            <h3 className="text-base font-semibold text-gray-900">Column Mapping</h3>
            <p className="text-sm text-gray-500 mt-0.5">Map your CSV columns to the correct fields.</p>
          </div>
          <div className="px-5 space-y-3 max-h-96 overflow-y-auto pb-3">
            {csv.headers.map((h, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-sm font-medium text-gray-900 w-44 truncate">{h}</span>
                <ArrowRight className="size-3.5 text-gray-300 flex-shrink-0" />
                <Select
                  value={mapping[i] || '_skip'}
                  onValueChange={v => setMapping(p => ({ ...p, [i]: v }))}
                >
                  <SelectTrigger className="w-48 h-9 border-gray-200 rounded-lg">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_skip">-- Skip --</SelectItem>
                    {FIELDS.map(f => (
                      <SelectItem key={f} value={f}>{FIELD_LABELS[f]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
          <div className="flex justify-end p-5 pt-3 gap-2 border-t border-gray-100">
            <button
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
              onClick={() => { setStep(1); setCsv({ headers: [], rows: [] }); setMapping({}) }}
            >
              <ArrowLeft className="size-3.5" />
              Back
            </button>
            <button
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors"
              onClick={() => setStep(3)}
            >
              Next
              <ArrowRight className="size-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Review */}
      {step === 3 && (
        <div className="rounded-xl border border-gray-200/80 shadow-sm bg-white">
          <div className="p-5 pb-3">
            <h3 className="text-base font-semibold text-gray-900">Import Summary</h3>
            <p className="text-sm text-gray-500 mt-0.5">Review your import details before proceeding.</p>
          </div>
          <div className="px-5 py-4 grid grid-cols-2 md:grid-cols-5 gap-6">
            {([
              ['Total Rows', csv.rows.length],
              ['New Companies', uniqueCompanies],
              ['Invalid Emails', invalidEmails],
              ['Ready', readyCount],
              ['File', file?.name ?? ''],
            ] as const).map(([label, val]) => (
              <div key={label}>
                <p className="text-sm text-gray-500">{label}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{val}</p>
              </div>
            ))}
          </div>
          <div className="flex justify-end p-5 pt-0 gap-2 border-t border-gray-100">
            <button
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
              onClick={() => setStep(2)}
            >
              <ArrowLeft className="size-3.5" />
              Back
            </button>
            <button
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={runImport}
              disabled={readyCount === 0}
            >
              Start Import
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Progress */}
      {step === 4 && (
        <div className="rounded-xl border border-gray-200/80 shadow-sm bg-white">
          <div className="p-8 text-center space-y-5">
            {progress < 100 ? (
              <>
                <div className="mx-auto max-w-md">
                  <Progress value={progress} className="h-2.5 [&>div]:bg-amber-500" />
                </div>
                <p className="text-sm text-gray-500">Importing your data...</p>
              </>
            ) : (
              <>
                <CheckCircle2 className="size-14 mx-auto text-emerald-500" />
                <div>
                  <p className="text-lg font-semibold text-gray-900">Import Complete!</p>
                  {importResult && (
                    <p className="text-sm text-gray-500 mt-1">
                      {importResult.totalRows} rows processed, {importResult.acceptedRows} accepted.
                    </p>
                  )}
                </div>
                <div className="flex justify-center gap-2 pt-2">
                  <button
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
                    onClick={() => { setStep(1); setFile(null); setCsv({ headers: [], rows: [] }); setMapping({}); setImportResult(null) }}
                  >
                    <RefreshCw className="size-3.5" />
                    Import Another
                  </button>
                  <button
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors"
                    onClick={() => setActiveView('companies')}
                  >
                    Go to Companies
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Import History */}
      {history && history.length > 0 && (
        <div className="rounded-xl border border-gray-200/80 shadow-sm bg-white">
          <div className="p-5 pb-3">
            <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <FileSpreadsheet className="size-4 text-gray-400" />
              Import History
            </h3>
          </div>
          <div className="px-5 pb-5">
            <div className="rounded-lg border border-gray-200/80 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50/80 hover:bg-gray-50/80">
                    <TableHead className="text-xs font-semibold text-gray-500 uppercase">File</TableHead>
                    <TableHead className="text-xs font-semibold text-gray-500 uppercase">Rows</TableHead>
                    <TableHead className="text-xs font-semibold text-gray-500 uppercase">Accepted</TableHead>
                    <TableHead className="text-xs font-semibold text-gray-500 uppercase">Duplicates</TableHead>
                    <TableHead className="text-xs font-semibold text-gray-500 uppercase">Invalid</TableHead>
                    <TableHead className="text-xs font-semibold text-gray-500 uppercase">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((b: any) => (
                    <TableRow key={b.id}>
                      <TableCell className="font-medium text-gray-900">{b.fileName}</TableCell>
                      <TableCell className="text-gray-600">{b.totalRows}</TableCell>
                      <TableCell className="text-gray-600">{b.acceptedRows}</TableCell>
                      <TableCell className="text-gray-600">{b.duplicateRows}</TableCell>
                      <TableCell className="text-gray-600">{b.invalidRows}</TableCell>
                      <TableCell>
                        {b.status === 'completed' ? (
                          <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50">
                            {b.status}
                          </Badge>
                        ) : (
                          <Badge variant="secondary">{b.status}</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}