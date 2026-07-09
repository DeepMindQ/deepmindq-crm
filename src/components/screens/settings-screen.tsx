'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Eye, EyeOff, Download, Stethoscope, Save, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
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

  if (isLoading) return <div className="space-y-4">{[...Array(3)].map((_, i) => <div key={i} className="h-48 rounded-xl bg-muted animate-pulse" />)}</div>

  return (
    <div className="max-w-2xl space-y-6">
      <Card>
        <CardHeader><CardTitle className="text-base">Email Style Preferences</CardTitle><CardDescription>Configure how AI generates outreach emails.</CardDescription></CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div><Label className="text-xs">Tone</Label><Select value={form.tone} onValueChange={v => set('tone', v)}><SelectTrigger className="mt-1 h-9"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="formal">Formal</SelectItem><SelectItem value="professional-casual">Professional-Casual</SelectItem><SelectItem value="direct">Direct</SelectItem></SelectContent></Select></div>
            <div><Label className="text-xs">Email Length</Label><Select value={form.emailLength} onValueChange={v => set('emailLength', v)}><SelectTrigger className="mt-1 h-9"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="short">Short</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="detailed">Detailed</SelectItem></SelectContent></Select></div>
            <div><Label className="text-xs">CTA Style</Label><Select value={form.ctaStyle} onValueChange={v => set('ctaStyle', v)}><SelectTrigger className="mt-1 h-9"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="soft">Soft</SelectItem><SelectItem value="direct">Direct</SelectItem></SelectContent></Select></div>
          </div>
          <div><Label className="text-xs">Opener Style</Label><Input value={form.openerStyle} onChange={e => set('openerStyle', e.target.value)} className="mt-1 h-9" /></div>
          <div><Label className="text-xs">Sign-off</Label><Input value={form.signOff} onChange={e => set('signOff', e.target.value)} className="mt-1 h-9" /></div>
          <div><Label className="text-xs">Avoid Phrases</Label><Textarea value={form.avoidPhrases} onChange={e => set('avoidPhrases', e.target.value)} rows={2} className="mt-1" placeholder="One phrase per line..." /></div>
          <Button size="sm" onClick={() => savePrefs.mutate({ tone: form.tone, emailLength: form.emailLength, openerStyle: form.openerStyle, signOff: form.signOff, avoidPhrases: form.avoidPhrases, ctaStyle: form.ctaStyle })} disabled={savePrefs.isPending}>
            {savePrefs.isPending ? <Loader2 className="size-3.5 mr-1.5 animate-spin" /> : <Save className="size-3.5 mr-1.5" />}Save Email Preferences
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">AI Configuration</CardTitle><CardDescription>Set your AI provider and model for email generation.</CardDescription></CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><Label className="text-xs">AI Provider</Label><Select value={form.aiProvider} onValueChange={v => set('aiProvider', v)}><SelectTrigger className="mt-1 h-9"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="openai">OpenAI</SelectItem><SelectItem value="google-gemini">Google Gemini</SelectItem><SelectItem value="groq">Groq</SelectItem></SelectContent></Select></div>
            <div><Label className="text-xs">Model</Label><Input value={form.aiModel} onChange={e => set('aiModel', e.target.value)} className="mt-1 h-9" /></div>
          </div>
          <div><Label className="text-xs">API Key</Label>
            <div className="relative mt-1"><Input type={showKey ? 'text' : 'password'} value={form.aiApiKey} onChange={e => set('aiApiKey', e.target.value)} className="h-9 pr-10" placeholder="sk-..." />
              <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 size-9" onClick={() => setShowKey(p => !p)}>{showKey ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}</Button>
            </div>
          </div>
          <Button size="sm" onClick={() => savePrefs.mutate({ aiProvider: form.aiProvider, aiModel: form.aiModel, aiApiKey: form.aiApiKey })} disabled={savePrefs.isPending}>
            {savePrefs.isPending ? <Loader2 className="size-3.5 mr-1.5 animate-spin" /> : <Save className="size-3.5 mr-1.5" />}Save AI Config
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Data Management</CardTitle><CardDescription>Export data or run maintenance tasks.</CardDescription></CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button variant="outline" size="sm" onClick={() => handleExport.mutate()} disabled={handleExport.isPending}><Download className="size-3.5 mr-1.5" />Export All Data</Button>
          <Button variant="outline" size="sm" onClick={() => handleHealthCheck.mutate()} disabled={handleHealthCheck.isPending}><Stethoscope className="size-3.5 mr-1.5" />Run Email Health Check</Button>
        </CardContent>
      </Card>

      <Separator />
      <p className="text-center text-xs text-muted-foreground pb-4">DeepMindQ v1.0 — AI-Powered Sales Intelligence</p>
    </div>
  )
}