'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Eye, EyeOff, Download, Stethoscope, Save, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'

const DEFAULTS = {
  tone: 'professional-casual', emailLength: 'medium', openerStyle: 'Hi [First Name]',
  signOff: 'Regards, Ravi', avoidPhrases: '', ctaStyle: 'soft',
  aiProvider: 'openai', aiModel: 'gpt-4o-mini', aiApiKey: '',
}

export function SettingsScreen() {
  const qc = useQueryClient()
  const [draft, setDraft] = useState<Record<string, string> | null>(null)
  const [showKey, setShowKey] = useState(false)

  const { data: prefs, isLoading } = useQuery({
    queryKey: ['preferences'],
    queryFn: () => fetch('/api/preferences').then(r => r.json()),
  })

  const form = { ...DEFAULTS, ...prefs, ...draft }

  const savePrefs = useMutation({
    mutationFn: (data: Record<string, string>) =>
      fetch('/api/preferences', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then(r => r.json()),
    onSuccess: () => { toast.success('Preferences saved'); setDraft(null); qc.invalidateQueries({ queryKey: ['preferences'] }) },
    onError: () => toast.error('Failed to save preferences'),
  })

  const handleExport = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/export')
      const data = await res.json()
      const csv = `=== COMPANIES ===\n${data.companies}\n\n=== CONTACTS ===\n${data.contacts}`
      const blob = new Blob([csv], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = 'deepmindq-export.csv'; a.click()
      URL.revokeObjectURL(url)
    },
    onSuccess: () => toast.success('Data exported successfully'),
    onError: () => toast.error('Export failed'),
  })

  const handleHealthCheck = useMutation({
    mutationFn: () => fetch('/api/health-check', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ checkAll: true }) }).then(r => r.json()),
    onSuccess: (d) => toast.success(`Health check complete: ${d.valid} valid, ${d.invalid} invalid out of ${d.checked}`),
    onError: () => toast.error('Health check failed'),
  })

  const set = (k: string, v: string) => setDraft(p => ({ ...(p || {}), [k]: v }))

  if (isLoading) return <div className="space-y-4">{[...Array(3)].map((_, i) => <div key={i} className="h-48 rounded-xl bg-gray-100 animate-pulse" />)}</div>

  return (
    <div className="max-w-2xl space-y-6">
      {/* Email Style Preferences */}
      <div className="rounded-xl border border-gray-200/80 shadow-sm bg-white">
        <div className="p-6 pb-4">
          <h3 className="text-base font-semibold text-gray-900">Email Style Preferences</h3>
          <p className="text-sm text-gray-500 mt-0.5">Configure how AI generates outreach emails.</p>
        </div>
        <div className="px-6 pb-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 block">Tone</label>
              <Select value={form.tone} onValueChange={v => set('tone', v)}>
                <SelectTrigger className="mt-1.5 h-10 border-gray-200 rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="formal">Formal</SelectItem>
                  <SelectItem value="professional-casual">Professional-Casual</SelectItem>
                  <SelectItem value="direct">Direct</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block">Email Length</label>
              <Select value={form.emailLength} onValueChange={v => set('emailLength', v)}>
                <SelectTrigger className="mt-1.5 h-10 border-gray-200 rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="short">Short</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="detailed">Detailed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block">CTA Style</label>
              <Select value={form.ctaStyle} onValueChange={v => set('ctaStyle', v)}>
                <SelectTrigger className="mt-1.5 h-10 border-gray-200 rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="soft">Soft</SelectItem>
                  <SelectItem value="direct">Direct</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block">Opener Style</label>
            <Input
              value={form.openerStyle}
              onChange={e => set('openerStyle', e.target.value)}
              className="mt-1.5 h-10 border-gray-200 rounded-lg"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block">Sign-off</label>
            <Input
              value={form.signOff}
              onChange={e => set('signOff', e.target.value)}
              className="mt-1.5 h-10 border-gray-200 rounded-lg"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block">Avoid Phrases</label>
            <Textarea
              value={form.avoidPhrases}
              onChange={e => set('avoidPhrases', e.target.value)}
              rows={2}
              className="mt-1.5 border-gray-200 rounded-lg resize-none"
              placeholder="One phrase per line..."
            />
          </div>
          <div className="pt-1">
            <button
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={() => savePrefs.mutate({ tone: form.tone, emailLength: form.emailLength, openerStyle: form.openerStyle, signOff: form.signOff, avoidPhrases: form.avoidPhrases, ctaStyle: form.ctaStyle })}
              disabled={savePrefs.isPending}
            >
              {savePrefs.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
              Save Email Preferences
            </button>
          </div>
        </div>
      </div>

      {/* AI Configuration */}
      <div className="rounded-xl border border-gray-200/80 shadow-sm bg-white">
        <div className="p-6 pb-4">
          <h3 className="text-base font-semibold text-gray-900">AI Configuration</h3>
          <p className="text-sm text-gray-500 mt-0.5">Set your AI provider and model for email generation.</p>
        </div>
        <div className="px-6 pb-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 block">AI Provider</label>
              <Select value={form.aiProvider} onValueChange={v => set('aiProvider', v)}>
                <SelectTrigger className="mt-1.5 h-10 border-gray-200 rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="openai">OpenAI</SelectItem>
                  <SelectItem value="google-gemini">Google Gemini</SelectItem>
                  <SelectItem value="groq">Groq</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block">Model</label>
              <Input
                value={form.aiModel}
                onChange={e => set('aiModel', e.target.value)}
                className="mt-1.5 h-10 border-gray-200 rounded-lg"
              />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block">API Key</label>
            <div className="relative mt-1.5">
              <Input
                type={showKey ? 'text' : 'password'}
                value={form.aiApiKey}
                onChange={e => set('aiApiKey', e.target.value)}
                className="h-10 pr-10 border-gray-200 rounded-lg"
                placeholder="sk-..."
              />
              <button
                type="button"
                className="absolute right-0 top-0 h-10 px-3 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors"
                onClick={() => setShowKey(p => !p)}
              >
                {showKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>
          <div className="pt-1">
            <button
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={() => savePrefs.mutate({ aiProvider: form.aiProvider, aiModel: form.aiModel, aiApiKey: form.aiApiKey })}
              disabled={savePrefs.isPending}
            >
              {savePrefs.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
              Save AI Config
            </button>
          </div>
        </div>
      </div>

      {/* Data Management */}
      <div className="rounded-xl border border-gray-200/80 shadow-sm bg-white">
        <div className="p-6 pb-4">
          <h3 className="text-base font-semibold text-gray-900">Data Management</h3>
          <p className="text-sm text-gray-500 mt-0.5">Export data or run maintenance tasks.</p>
        </div>
        <div className="px-6 pb-6 flex flex-wrap gap-3">
          <button
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={() => handleExport.mutate()}
            disabled={handleExport.isPending}
          >
            <Download className="size-3.5 text-gray-500" />
            Export All Data
          </button>
          <button
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={() => handleHealthCheck.mutate()}
            disabled={handleHealthCheck.isPending}
          >
            <Stethoscope className="size-3.5 text-gray-500" />
            Run Email Health Check
          </button>
        </div>
      </div>

      <Separator className="bg-gray-100" />
      <p className="text-center text-xs text-gray-400 pb-4">DeepMindQ v1.0 — AI-Powered Sales Intelligence</p>
    </div>
  )
}