'use client'

import { useState, useRef, useCallback, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  FileText, Plus, Trash2, Search, Upload, BookOpen, Tag,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { EmptyState } from '@/components/shared/design-system'
import { cn } from '@/lib/utils'

/* ── helpers ──────────────────────────────────────────────────── */

function relativeDate(dateStr: string): string {
  const now = Date.now()
  const diff = now - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mo ago`
  return `${Math.floor(months / 12)}y ago`
}

function getFileExtension(filename: string): string {
  return (filename.split('.').pop() || '').toUpperCase()
}

const fileTypeConfig: Record<string, { color: string; bg: string }> = {
  PDF:  { color: 'text-red-600',  bg: 'bg-red-50' },
  DOCX: { color: 'text-blue-600', bg: 'bg-blue-50' },
  DOC:  { color: 'text-blue-600', bg: 'bg-blue-50' },
  TXT:  { color: 'text-gray-600', bg: 'bg-gray-100' },
  MD:   { color: 'text-gray-600', bg: 'bg-gray-100' },
}

const snippetTypeConfig: Record<string, { color: string; bg: string; label: string }> = {
  case_study: { color: 'text-violet-700',   bg: 'bg-violet-50',   label: 'Case Study' },
  service:    { color: 'text-blue-700',     bg: 'bg-blue-50',     label: 'Service' },
  capability: { color: 'text-emerald-700',  bg: 'bg-emerald-50',  label: 'Capability' },
  outcome:    { color: 'text-amber-700',    bg: 'bg-amber-50',    label: 'Outcome' },
}

/* ── types ────────────────────────────────────────────────────── */

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
  type: string
  title: string
  content: string
  industries: string[] | null
  outcomes: string[] | null
}

/* ── component ────────────────────────────────────────────────── */

export default function KnowledgeLibraryScreen() {
  const qc = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [search, setSearch] = useState('')
  const [uploadOpen, setUploadOpen] = useState(false)
  const [form, setForm] = useState({ title: '', description: '' })
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  /* ── queries ────────────────────────────────────────────────── */

  const { data: documents = [], isLoading: docsLoading } = useQuery<KnowledgeDocument[]>({
    queryKey: ['knowledge'],
    queryFn: () => fetch('/api/knowledge').then(r => r.json()).then(d => d.documents ?? d),
  })

  const hasDocuments = documents.length > 0

  const { data: snippetsData } = useQuery<{ documents: KnowledgeDocument[]; snippets: KnowledgeSnippet[] }>({
    queryKey: ['knowledge', 'snippets'],
    queryFn: () => fetch('/api/knowledge?include=snippets').then(r => r.json()),
    enabled: hasDocuments,
  })

  const snippets: KnowledgeSnippet[] = useMemo(() => snippetsData?.snippets ?? [], [snippetsData])

  /* ── filtered lists ─────────────────────────────────────────── */

  const query = search.toLowerCase().trim()

  const filteredDocs = useMemo(() => {
    if (!query) return documents
    return documents.filter(
      (d) =>
        d.title?.toLowerCase().includes(query) ||
        d.description?.toLowerCase().includes(query) ||
        d.fileName?.toLowerCase().includes(query) ||
        d.fileType?.toLowerCase().includes(query)
    )
  }, [documents, query])

  const filteredSnippets = useMemo(() => {
    if (!query) return snippets
    return snippets.filter(
      (s) =>
        s.title?.toLowerCase().includes(query) ||
        s.content?.toLowerCase().includes(query) ||
        s.type?.toLowerCase().includes(query) ||
        s.industries?.some((i) => i.toLowerCase().includes(query)) ||
        s.outcomes?.some((o) => o.toLowerCase().includes(query))
    )
  }, [snippets, query])

  /* ── mutations ──────────────────────────────────────────────── */

  const uploadMutation = useMutation({
    mutationFn: async () => {
      const fd = new FormData()
      if (selectedFile) fd.append('file', selectedFile)
      fd.append('title', form.title)
      fd.append('description', form.description)
      const res = await fetch('/api/knowledge', { method: 'POST', body: fd })
      if (!res.ok) throw new Error('Upload failed')
      return res.json()
    },
    onSuccess: () => {
      toast.success('Document uploaded successfully')
      setUploadOpen(false)
      setForm({ title: '', description: '' })
      setSelectedFile(null)
      qc.invalidateQueries({ queryKey: ['knowledge'] })
    },
    onError: () => {
      toast.error('Failed to upload document')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => fetch(`/api/knowledge/${id}`, { method: 'DELETE' }).then(r => r.json()),
    onSuccess: () => {
      toast.success('Document deleted')
      qc.invalidateQueries({ queryKey: ['knowledge'] })
    },
    onError: () => {
      toast.error('Failed to delete document')
    },
  })

  /* ── handlers ───────────────────────────────────────────────── */

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedFile(file)
      if (!form.title) {
        setForm((prev) => ({ ...prev, title: file.name.replace(/\.[^/.]+$/, '') }))
      }
    }
  }, [form.title])

  const handleUpload = useCallback(() => {
    if (!selectedFile) {
      toast.error('Please select a file')
      return
    }
    uploadMutation.mutate()
  }, [selectedFile, uploadMutation])

  const handleOpenUpload = useCallback(() => {
    setForm({ title: '', description: '' })
    setSelectedFile(null)
    setUploadOpen(true)
  }, [])

  const handleCloseUpload = useCallback(() => {
    setUploadOpen(false)
    setForm({ title: '', description: '' })
    setSelectedFile(null)
  }, [])

  /* ── render ─────────────────────────────────────────────────── */

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-gray-900 tracking-tight">
            Knowledge Library
          </h1>
          <p className="text-sm text-gray-500">
            Upload capability documents, case studies, and service descriptions. AI uses these to personalize your outreach.
          </p>
        </div>
        <Button
          className="bg-amber-600 hover:bg-amber-700 text-white rounded-lg press-scale shadow-xs shrink-0"
          onClick={handleOpenUpload}
        >
          <Plus className="size-4 sm:mr-1.5" />
          <span className="hidden sm:inline">Upload Document</span>
        </Button>
      </div>

      {/* ── Search ─────────────────────────────────────────── */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
        <Input
          placeholder="Search documents and snippets..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-9 bg-white border-gray-200 rounded-lg text-sm focus:border-amber-400 focus:ring-amber-100"
        />
      </div>

      {/* ── Section 1: Documents Grid ──────────────────────── */}
      <section>
        {!docsLoading && filteredDocs.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No documents yet"
            description="Upload your first capability document to power AI-generated emails."
            actionLabel="Upload Document"
            onAction={handleOpenUpload}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {docsLoading
              ? Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="rounded-xl bg-white card-rest p-5 space-y-3 animate-pulse">
                    <div className="h-6 w-12 rounded-md bg-gray-100" />
                    <div className="h-4 w-3/4 rounded bg-gray-100" />
                    <div className="h-3 w-full rounded bg-gray-100" />
                    <div className="h-3 w-1/2 rounded bg-gray-100" />
                  </div>
                ))
              : filteredDocs.map((doc) => {
                  const ext = getFileExtension(doc.fileName || '')
                  const cfg = fileTypeConfig[ext] || fileTypeConfig.TXT
                  return (
                    <div
                      key={doc.id}
                      className="group rounded-xl bg-white card-rest p-5 flex flex-col gap-3"
                    >
                      <div className="flex items-start justify-between">
                        <div
                          className={cn(
                            'inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-semibold',
                            cfg.bg,
                            cfg.color
                          )}
                        >
                          <FileText className="size-3" />
                          {ext || 'FILE'}
                        </div>
                        <button
                          onClick={() => deleteMutation.mutate(doc.id)}
                          className="p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-red-50 transition-all"
                        >
                          <Trash2 className="size-3.5 text-red-500" />
                        </button>
                      </div>

                      <h3 className="text-sm font-semibold text-gray-900 leading-snug">
                        {doc.title || doc.fileName}
                      </h3>

                      {doc.description && (
                        <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">
                          {doc.description}
                        </p>
                      )}

                      <div className="flex items-center gap-2 mt-auto pt-1">
                        <span className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600">
                          <BookOpen className="size-2.5" />
                          {doc.snippetCount ?? 0} snippets
                        </span>
                        <span className="text-[10px] text-gray-400 ml-auto">
                          {relativeDate(doc.createdAt)}
                        </span>
                      </div>
                    </div>
                  )
                })}
          </div>
        )}
      </section>

      {/* ── Section 2: Extracted Snippets ──────────────────── */}
      {hasDocuments && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-base font-semibold text-gray-900">Extracted Snippets</h2>
            <span className="inline-flex items-center justify-center rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
              {filteredSnippets.length}
            </span>
          </div>

          {filteredSnippets.length === 0 ? (
            <div className="text-center py-12">
              <Tag className="size-8 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">
                {query
                  ? 'No snippets match your search.'
                  : 'No snippets extracted yet. Upload a document to get started.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredSnippets.map((snippet) => {
                const typeCfg = snippetTypeConfig[snippet.type] || {
                  color: 'text-gray-700',
                  bg: 'bg-gray-100',
                  label: snippet.type,
                }
                return (
                  <div
                    key={snippet.id}
                    className="rounded-xl bg-white card-rest p-5 flex flex-col gap-3"
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={cn(
                          'inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold',
                          typeCfg.bg,
                          typeCfg.color
                        )}
                      >
                        {typeCfg.label}
                      </span>
                    </div>

                    <h3 className="text-sm font-semibold text-gray-900 leading-snug">
                      {snippet.title}
                    </h3>

                    <p className="text-xs text-gray-600 line-clamp-3 whitespace-pre-wrap leading-relaxed">
                      {snippet.content}
                    </p>

                    <div className="flex items-center gap-2 flex-wrap mt-auto pt-1">
                      {snippet.industries && snippet.industries.length > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600">
                          <Tag className="size-2.5" />
                          {snippet.industries.join(', ')}
                        </span>
                      )}
                      {snippet.outcomes && snippet.outcomes.length > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                          {snippet.outcomes.join(', ')}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      )}

      {/* ── Upload Dialog ──────────────────────────────────── */}
      <Dialog open={uploadOpen} onOpenChange={handleCloseUpload}>
        <DialogContent className="sm:max-w-md rounded-xl p-6">
          <DialogHeader>
            <DialogTitle className="text-gray-900">Upload Document</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            {/* File picker */}
            <div className="grid gap-1.5">
              <Label className="text-sm font-medium text-gray-700">File</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.txt,.md"
                onChange={handleFileChange}
                className="block w-full text-sm text-gray-500
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-lg file:border-0
                  file:text-sm file:font-medium
                  file:bg-amber-50 file:text-amber-700
                  hover:file:bg-amber-100
                  file:cursor-pointer file:transition-colors
                  cursor-pointer rounded-lg border border-dashed border-gray-300 bg-gray-50/50 p-6 text-center"
              />
              {selectedFile && (
                <p className="text-xs text-gray-500 mt-1">
                  <Upload className="size-3 inline mr-1" />
                  {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                </p>
              )}
            </div>

            {/* Title */}
            <div className="grid gap-1.5">
              <Label className="text-sm font-medium text-gray-700">Title</Label>
              <Input
                placeholder="e.g. Manufacturing Capabilities 2024"
                value={form.title}
                onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                className="border-gray-200 rounded-lg"
              />
            </div>

            {/* Description */}
            <div className="grid gap-1.5">
              <Label className="text-sm font-medium text-gray-700">Description</Label>
              <Textarea
                placeholder="Brief description of this document's content..."
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                className="border-gray-200 rounded-lg min-h-[80px] resize-none"
              />
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button
              variant="outline"
              onClick={handleCloseUpload}
              className="border-gray-200 text-gray-600 hover:bg-gray-50 rounded-lg"
            >
              Cancel
            </Button>
            <Button
              className="bg-amber-600 hover:bg-amber-700 text-white rounded-lg"
              onClick={handleUpload}
              disabled={!selectedFile || uploadMutation.isPending}
            >
              {uploadMutation.isPending ? (
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Uploading…
                </span>
              ) : (
                <>
                  <Upload className="size-4 mr-1.5" />
                  Upload
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}