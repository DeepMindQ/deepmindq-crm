'use client'

import { useState, useRef, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Upload, CheckCircle2, ArrowRight, ArrowLeft, RefreshCw, FileSpreadsheet,
  AlertTriangle, FileText, Eye, UploadCloud,
} from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { toast } from 'sonner'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const FIELDS = ['companyName','contactName','email','jobTitle','role','linkedin','phone','location','industry','country'] as const
const FIELD_LABELS: Record<string, string> = { companyName:'Company Name', contactName:'Contact Name', email:'Email', jobTitle:'Job Title', role:'Role', linkedin:'LinkedIn', phone:'Phone', location:'Location', industry:'Industry', country:'Country' }

function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.split(/\r?\n/).filter(l => l.trim())
  if (lines.length < 2) return { headers: [], rows: [] }
  const parseLine = (line: string) => {
    const f: string[] = []; let c = '', q = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (q) { if (ch === '"' && line[i+1] === '"') { c += '"'; i++ } else if (ch === '"') q = false; else c += ch }
      else { if (ch === '"') q = true; else if (ch === ',') { f.push(c.trim()); c = '' } else c += ch }
    }
    f.push(c.trim()); return f
  }
  return { headers: parseLine(lines[0]), rows: lines.slice(1).map(parseLine) }
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
  const [isDragging, setIsDragging] = useState(false)
  const [showPreview, setShowPreview] = useState(false)

  const { data: history } = useQuery({ queryKey: ['imports'], queryFn: () => fetch('/api/imports').then(r => r.json()) })

  const doImport = useMutation({
    mutationFn: async (f: File) => { const fd = new FormData(); fd.append('file', f); return fetch('/api/imports', { method: 'POST', body: fd }).then(r => r.json()) },
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
      setMapping(m); setStep(2)
    }
    reader.readAsText(f)
  }, [])

  const onDrop = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }, [handleFile])

  const companyColIdx = Object.entries(mapping).find(([, v]) => v === 'companyName')?.[0]
  const emailColIdx = Object.entries(mapping).find(([, v]) => v === 'email')?.[0]
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
  const uniqueCompanies = companyColIdx != null ? new Set(csv.rows.map(r => r[companyColIdx]).filter(Boolean)).size : 0
  const invalidEmails = emailColIdx != null ? csv.rows.filter(r => r[emailColIdx] && !emailRe.test(r[emailColIdx])).length : 0
  const readyCount = csv.rows.length - invalidEmails
  const invalidRowIndices = emailColIdx != null ? csv.rows.map((r, i) => r[emailColIdx] && !emailRe.test(r[emailColIdx]) ? i : -1).filter(i => i >= 0) : []

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
      <div className="flex items-center justify-center">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className="flex flex-col items-center gap-1.5">
              <div className={cn(
                'flex size-8 items-center justify-center rounded-full text-sm font-bold transition-all duration-300',
                i + 1 < step ? 'bg-amber-600 text-white' : i + 1 === step ? 'bg-amber-600 text-white ring-4 ring-amber-100' : 'bg-gray-100 text-gray-400'
              )}>
                {i + 1 < step ? <CheckCircle2 className="size-4" /> : i + 1}
              </div>
              <span className={cn('hidden sm:inline text-xs whitespace-nowrap', i + 1 === step ? 'font-medium text-gray-900' : 'text-gray-400')}>{s}</span>
            </div>
            {i < 3 && <ArrowRight className="size-4 text-gray-300 mx-3 -mt-5 sm:-mt-6" />}
          </div>
        ))}
      </div>

      {/* Step 1: Upload */}
      {step === 1 && (
        <div
          className={cn(
            'rounded-2xl border-2 border-dashed p-16 text-center cursor-pointer transition-all duration-300',
            isDragging
              ? 'border-amber-400 bg-amber-50/50 scale-[1.01]'
              : 'border-gray-300 hover:border-amber-300 hover:bg-amber-50/30'
          )}
          onClick={() => fileRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
        >
          <div className={cn('mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl transition-all duration-300', isDragging ? 'bg-amber-100 scale-110' : 'bg-gray-100')}>
            <UploadCloud className={cn('size-8 transition-colors', isDragging ? 'text-amber-600' : 'text-gray-400')} />
          </div>
          <p className="text-base font-semibold text-gray-900">{isDragging ? 'Drop it here!' : 'Drop your CSV file here'}</p>
          <p className="text-sm text-gray-500 mt-1">or <span className="text-amber-600 font-medium">click to browse</span> your files</p>
          <p className="text-xs text-gray-400 mt-3">Supports .csv files</p>
          <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
        </div>
      )}

      {/* Step 2: Column Mapping */}
      {step === 2 && (
        <div className="rounded-xl bg-white card-rest">
          <div className="p-6 pb-3">
            <h3 className="text-sm font-semibold text-gray-900">Column Mapping</h3>
            <p className="text-xs text-gray-500 mt-0.5">Map your CSV columns to the correct fields. Auto-detected mappings are pre-selected.</p>
          </div>
          <div className="px-6 space-y-2 max-h-80 overflow-y-auto pb-3">
            {csv.headers.map((h, i) => {
              const isMapped = mapping[i] && mapping[i] !== '_skip'
              return (
                <div key={i} className={cn('flex items-center gap-3 p-2 rounded-lg transition-colors', isMapped ? 'bg-amber-50/50' : 'bg-gray-50/50')}>
                  <span className="text-sm font-medium text-gray-900 w-44 truncate">{h}</span>
                  <ArrowRight className="size-3.5 text-gray-300 shrink-0" />
                  <Select value={mapping[i] || '_skip'} onValueChange={v => setMapping(p => ({ ...p, [i]: v }))}>
                    <SelectTrigger className={cn('w-48 h-8 rounded-lg text-xs', isMapped ? 'border-amber-200 bg-white' : 'border-gray-200')}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_skip">-- Skip --</SelectItem>
                      {FIELDS.map(f => <SelectItem key={f} value={f}>{FIELD_LABELS[f]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )
            })}
          </div>
          <div className="flex justify-between p-6 pt-3 border-t border-gray-100">
            <Button variant="ghost" className="text-gray-500 text-sm" onClick={() => { setStep(1); setCsv({ headers: [], rows: [] }); setMapping({}) }}>
              <ArrowLeft className="size-3.5 mr-1" /> Back
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="text-xs border-gray-200 text-gray-600" onClick={() => setShowPreview(p => !p)}>
                <Eye className="size-3.5 mr-1" /> {showPreview ? 'Hide Preview' : 'Preview Data'}
              </Button>
              <Button className="bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm press-scale" onClick={() => setStep(3)}>
                Next <ArrowRight className="size-3.5 ml-1" />
              </Button>
            </div>
          </div>
          {/* Data Preview */}
          {showPreview && csv.rows.length > 0 && (
            <div className="px-6 pb-6">
              <div className="rounded-lg border border-gray-200 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50/80 hover:bg-transparent">
                      <TableHead className="text-[10px] text-gray-400 w-8">#</TableHead>
                      {csv.headers.map((h, i) => (
                        <TableHead key={i} className={cn('text-[10px]', mapping[i] && mapping[i] !== '_skip' ? 'text-amber-700 font-semibold' : 'text-gray-400')}>{h}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {csv.rows.slice(0, 5).map((row, ri) => (
                      <TableRow key={ri} className={cn('text-xs', invalidRowIndices.includes(ri) ? 'bg-red-50/50' : '')}>
                        <TableCell className="text-gray-400 tabular-nums">{ri + 1}</TableCell>
                        {row.map((cell, ci) => (
                          <TableCell key={ci} className={cn(
                            'text-gray-600 max-w-[150px] truncate',
                            ci === emailColIdx && cell && !emailRe.test(cell) && 'text-red-600 font-medium'
                          )}>
                            {cell || <span className="text-gray-300">—</span>}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {csv.rows.length > 5 && <p className="text-xs text-gray-400 mt-2 text-center">Showing first 5 of {csv.rows.length} rows</p>}
            </div>
          )}
        </div>
      )}

      {/* Step 3: Review */}
      {step === 3 && (
        <div className="rounded-xl bg-white card-rest">
          <div className="p-6 pb-3">
            <h3 className="text-sm font-semibold text-gray-900">Import Summary</h3>
            <p className="text-xs text-gray-500 mt-0.5">Review your import details before proceeding.</p>
          </div>
          <div className="px-6 py-4 grid grid-cols-2 md:grid-cols-5 gap-6">
            {([
              ['Total Rows', csv.rows.length, 'text-gray-900'],
              ['New Companies', uniqueCompanies, 'text-blue-600'],
              ['Invalid Emails', invalidEmails, invalidEmails > 0 ? 'text-red-600' : 'text-gray-900'],
              ['Ready to Import', readyCount, 'text-emerald-600'],
              ['File', file?.name ?? '', 'text-gray-500'],
            ] as const).map(([label, val, color]) => (
              <div key={label}>
                <p className="text-xs text-gray-500">{label}</p>
                <p className={cn('text-xl font-bold mt-1 tabular-nums', color, label === 'File' && 'text-sm font-medium truncate max-w-[120px]')}>{val}</p>
              </div>
            ))}
          </div>
          {invalidEmails > 0 && (
            <div className="mx-6 mb-4 p-3 rounded-lg bg-red-50 border border-red-100 flex items-start gap-2">
              <AlertTriangle className="size-4 text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-medium text-red-700">{invalidEmails} rows have invalid email addresses</p>
                <p className="text-[11px] text-red-500 mt-0.5">These rows will be skipped during import. You can fix them and re-import later.</p>
              </div>
            </div>
          )}
          <div className="flex justify-between p-6 pt-0 border-t border-gray-100">
            <Button variant="ghost" className="text-gray-500 text-sm" onClick={() => setStep(2)}>
              <ArrowLeft className="size-3.5 mr-1" /> Back
            </Button>
            <Button className="bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm press-scale" onClick={runImport} disabled={readyCount === 0}>
              Start Import
            </Button>
          </div>
        </div>
      )}

      {/* Step 4: Progress */}
      {step === 4 && (
        <div className="rounded-xl bg-white card-rest">
          <div className="p-8 text-center space-y-5">
            {progress < 100 ? (
              <>
                <div className="mx-auto max-w-md">
                  <Progress value={progress} className="h-2 [&>div]:bg-amber-500" />
                </div>
                <p className="text-sm text-gray-500 animate-pulse">Importing your data...</p>
              </>
            ) : (
              <div className="scale-in">
                <CheckCircle2 className="size-14 mx-auto text-emerald-500" />
                <div className="mt-4">
                  <p className="text-lg font-bold text-gray-900">Import Complete!</p>
                  {importResult && <p className="text-sm text-gray-500 mt-1">{importResult.totalRows} rows processed, {importResult.acceptedRows} accepted.</p>}
                </div>
                <div className="flex justify-center gap-2 pt-4">
                  <Button variant="outline" className="text-gray-600 border-gray-200 rounded-lg text-sm" onClick={() => { setStep(1); setFile(null); setCsv({ headers: [], rows: [] }); setMapping({}); setImportResult(null) }}>
                    <RefreshCw className="size-3.5 mr-1.5" /> Import Another
                  </Button>
                  <Button className="bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm press-scale" onClick={() => setActiveView('companies')}>
                    Go to Companies <ArrowRight className="size-3.5 ml-1" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Import History */}
      {history && history.length > 0 && (
        <div className="rounded-xl bg-white card-rest">
          <div className="p-6 pb-3">
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <FileSpreadsheet className="size-4 text-gray-400" /> Import History
            </h3>
          </div>
          <div className="px-6 pb-6">
            <div className="rounded-lg border border-gray-200 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50/80 hover:bg-gray-50/80">
                    <TableHead className="text-[11px] font-semibold text-gray-500 uppercase">File</TableHead>
                    <TableHead className="text-[11px] font-semibold text-gray-500 uppercase">Rows</TableHead>
                    <TableHead className="text-[11px] font-semibold text-gray-500 uppercase">Accepted</TableHead>
                    <TableHead className="text-[11px] font-semibold text-gray-500 uppercase">Duplicates</TableHead>
                    <TableHead className="text-[11px] font-semibold text-gray-500 uppercase">Invalid</TableHead>
                    <TableHead className="text-[11px] font-semibold text-gray-500 uppercase">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((b: any) => (
                    <TableRow key={b.id} className="table-row-hover">
                      <TableCell className="font-medium text-gray-900 text-sm">{b.fileName}</TableCell>
                      <TableCell className="text-sm text-gray-600 tabular-nums">{b.totalRows}</TableCell>
                      <TableCell className="text-sm text-emerald-600 font-medium tabular-nums">{b.acceptedRows}</TableCell>
                      <TableCell className="text-sm text-gray-600 tabular-nums">{b.duplicateRows}</TableCell>
                      <TableCell className="text-sm text-red-600 tabular-nums">{b.invalidRows}</TableCell>
                      <TableCell>
                        <Badge className={cn('text-[11px] border', b.status === 'completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-100 text-gray-600 border-gray-200')}>
                          {b.status}
                        </Badge>
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