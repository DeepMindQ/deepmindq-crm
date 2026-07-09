'use client'

import { useState, useRef, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Upload, CheckCircle2, ArrowRight, ArrowLeft, RefreshCw, FileSpreadsheet } from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

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
      <div className="flex items-center gap-4">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`flex size-7 items-center justify-center rounded-full text-xs font-bold ${i + 1 <= step ? 'bg-emerald-500 text-white' : 'bg-muted text-muted-foreground'}`}>{i + 1 <= step && i + 1 < step ? <CheckCircle2 className="size-4" /> : i + 1}</div>
            <span className={`text-sm hidden sm:inline ${i + 1 === step ? 'font-medium' : 'text-muted-foreground'}`}>{s}</span>
            {i < 3 && <ArrowRight className="size-3.5 text-muted-foreground mx-1" />}
          </div>
        ))}
      </div>

      {step === 1 && (
        <div className="border-2 border-dashed rounded-xl p-12 text-center cursor-pointer hover:border-emerald-400 hover:bg-emerald-50/50 transition-colors" onClick={() => fileRef.current?.click()} onDragOver={e => e.preventDefault()} onDrop={onDrop}>
          <Upload className="size-10 mx-auto text-muted-foreground/60" />
          <p className="mt-3 font-medium">Drop your CSV file here or click to browse</p>
          <p className="text-xs text-muted-foreground mt-1">.csv files only</p>
          <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
        </div>
      )}

      {step === 2 && (
        <Card><CardHeader className="pb-3"><CardTitle className="text-sm">Column Mapping</CardTitle></CardHeader>
          <CardContent className="space-y-2 max-h-96 overflow-y-auto">
            {csv.headers.map((h, i) => (
              <div key={i} className="flex items-center gap-3"><span className="text-sm font-medium w-40 truncate">{h}</span><span className="text-muted-foreground">→</span>
                <Select value={mapping[i] || '_skip'} onValueChange={v => setMapping(p => ({ ...p, [i]: v }))}><SelectTrigger className="w-44 h-8"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="_skip">-- Skip --</SelectItem>{FIELDS.map(f => <SelectItem key={f} value={f}>{FIELD_LABELS[f]}</SelectItem>)}</SelectContent></Select>
              </div>
            ))}
          </CardContent>
          <div className="flex justify-end p-4 pt-0 gap-2"><Button variant="outline" size="sm" onClick={() => { setStep(1); setCsv({ headers: [], rows: [] }); setMapping({}) }}><ArrowLeft className="size-3.5 mr-1" />Back</Button><Button size="sm" onClick={() => setStep(3)}>Next<ArrowRight className="size-3.5 ml-1" /></Button></div>
        </Card>
      )}

      {step === 3 && (
        <Card><CardHeader className="pb-3"><CardTitle className="text-sm">Import Summary</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[['Total Rows', csv.rows.length], ['New Companies', uniqueCompanies], ['Invalid Emails', invalidEmails], ['Ready', readyCount], ['File', file?.name ?? '']].map(([label, val]) => (
              <div key={label as string}><p className="text-xs text-muted-foreground">{label}</p><p className="text-lg font-bold mt-0.5">{val}</p></div>
            ))}
          </CardContent>
          <div className="flex justify-end p-4 pt-0 gap-2"><Button variant="outline" size="sm" onClick={() => setStep(2)}><ArrowLeft className="size-3.5 mr-1" />Back</Button><Button size="sm" onClick={runImport} disabled={readyCount === 0}>Start Import</Button></div>
        </Card>
      )}

      {step === 4 && (
        <Card><CardContent className="p-6 text-center space-y-4">
          {progress < 100 ? (<><Progress value={progress} className="h-2" /><p className="text-sm text-muted-foreground">Importing...</p></>)
            : (<><CheckCircle2 className="size-12 mx-auto text-emerald-500" /><p className="font-semibold">Import Complete!</p>
              {importResult && <p className="text-sm text-muted-foreground">{importResult.totalRows} rows processed, {importResult.acceptedRows} accepted.</p>}
              <div className="flex justify-center gap-2"><Button variant="outline" size="sm" onClick={() => { setStep(1); setFile(null); setCsv({ headers: [], rows: [] }); setMapping({}); setImportResult(null) }}><RefreshCw className="size-3.5 mr-1" />Import Another</Button><Button size="sm" onClick={() => setActiveView('companies')}>Go to Companies</Button></div>
            </>)}
        </CardContent></Card>
      )}

      {history && history.length > 0 && (
        <Card><CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><FileSpreadsheet className="size-4" />Import History</CardTitle></CardHeader>
          <CardContent><div className="rounded-lg border overflow-x-auto">
            <Table><TableHeader><TableRow><TableHead>File</TableHead><TableHead>Rows</TableHead><TableHead>Accepted</TableHead><TableHead>Duplicates</TableHead><TableHead>Invalid</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>{history.map((b: any) => (
              <TableRow key={b.id}><TableCell className="font-medium">{b.fileName}</TableCell><TableCell>{b.totalRows}</TableCell><TableCell>{b.acceptedRows}</TableCell><TableCell>{b.duplicateRows}</TableCell><TableCell>{b.invalidRows}</TableCell><TableCell><Badge variant="secondary" className={b.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : ''}>{b.status}</Badge></TableCell></TableRow>
            ))}</TableBody></Table>
          </div></CardContent></Card>
      )}
    </div>
  )
}