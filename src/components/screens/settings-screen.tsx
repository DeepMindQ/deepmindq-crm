'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Eye, EyeOff, Download, Stethoscope, Save, Loader2, Mail,
  Cpu, Database, Trash2, AlertTriangle, Settings,
} from 'lucide-react'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

const DEFAULTS = {
  tone: 'professional-casual', emailLength: 'medium', openerStyle: 'Hi [First Name]',
  signOff: 'Regards, Ravi', avoidPhrases: '', ctaStyle: 'soft',
  aiProvider: 'openai', aiModel: 'gpt-4o-mini', aiApiKey: '',
}

const sampleEmail = (tone: string, length: string, cta: string) => {
  const opener = 'Hi John,'
  const bodies: Record<string, string> = {
    'professional-casual': "I've been following Acme Corp's recent expansion into the APAC market, and it's impressive how you've scaled operations across three new regions this quarter. Our team at DeepMindQ has helped similar manufacturing companies optimize their supply chain visibility — resulting in an average 34% reduction in lead times.",
    formal: "I am writing to introduce DeepMindQ's enterprise intelligence platform. We specialize in helping manufacturing organizations streamline their procurement and supply chain operations. Our recent work with companies in your sector has demonstrated measurable improvements in operational efficiency.",
    direct: "Your APAC expansion is exactly the kind of challenge we solve. We helped three manufacturers cut supply chain lead times by 34% this quarter. Worth a 15-minute call?",
  }
  const ctas: Record<string, string> = {
    soft: "Would you be open to a brief 15-minute conversation this week to explore if there's a fit?",
    direct: "Can we schedule a 15-minute call this Thursday at 2 PM IST?",
  }
  let body = bodies[tone] || bodies['professional-casual']
  if (length === 'short') body = body.split('.').slice(0, 2).join('.') + '.'
  const ctaText = ctas[cta] || ctas.soft
  return `${opener}\n\n${body}\n\n${ctaText}\n\nRegards,\nRavi`
}

export function SettingsScreen() {
  const qc = useQueryClient()
  const [draft, setDraft] = useState<Record<string, string> | null>(null)
  const [showKey, setShowKey] = useState(false)
  const [dangerOpen, setDangerOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('email')

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

  const handleDeleteAll = useMutation({
    mutationFn: () => fetch('/api/reset', { method: 'DELETE' }).then(r => r.json()),
    onSuccess: () => { toast.success('All data deleted'); setDangerOpen(false); qc.invalidateQueries({ queryKey: ['companies'] }); qc.invalidateQueries({ queryKey: ['contacts'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }) },
    onError: () => toast.error('Failed to delete data'),
  })

  const set = (k: string, v: string) => setDraft(p => ({ ...(p || {}), [k]: v }))

  if (isLoading) return <div className="space-y-4">{[...Array(3)].map((_, i) => <div key={i} className="h-48 rounded-xl bg-gray-100 animate-pulse" />)}</div>

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="text-lg font-bold text-gray-900 tracking-tight">Settings</h1>
        <p className="text-sm text-gray-500">Configure your workspace, AI preferences, and data management.</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-gray-100 rounded-lg p-1 h-auto gap-0.5 mb-6">
          {[
            { value: 'email', label: 'Email Style', icon: Mail },
            { value: 'ai', label: 'AI Config', icon: Cpu },
            { value: 'data', label: 'Data', icon: Database },
            { value: 'danger', label: 'Advanced', icon: AlertTriangle },
          ].map(tab => (
            <TabsTrigger key={tab.value} value={tab.value}
              className="rounded-md text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-gray-900 data-[state=active]:font-medium text-gray-500 hover:text-gray-700 transition-colors px-3 py-2 flex items-center gap-1.5">
              <tab.icon className="size-3.5" /> {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* ── Email Style ── */}
        <TabsContent value="email" className="space-y-6">
          <div className="rounded-xl bg-white card-rest p-6 space-y-5">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Email Generation Preferences</h3>
              <p className="text-xs text-gray-500 mt-0.5">These settings control how AI generates outreach emails.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { label: 'Tone', key: 'tone', opts: ['Formal', 'Professional-Casual', 'Direct'], vals: ['formal', 'professional-casual', 'direct'] },
                { label: 'Length', key: 'emailLength', opts: ['Short', 'Medium', 'Detailed'], vals: ['short', 'medium', 'detailed'] },
                { label: 'CTA Style', key: 'ctaStyle', opts: ['Soft', 'Direct'], vals: ['soft', 'direct'] },
              ].map(({ label, key, opts, vals }) => (
                <div key={key}>
                  <label className="text-xs font-medium text-gray-700 block mb-1.5">{label}</label>
                  <Select value={form[key]} onValueChange={v => set(key, v)}>
                    <SelectTrigger className="h-9 border-gray-200 rounded-lg text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>{opts.map((o, i) => <SelectItem key={vals[i]} value={vals[i]}>{o}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              ))}
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700 block mb-1.5">Opener Style</label>
              <Input value={form.openerStyle} onChange={e => set('openerStyle', e.target.value)} className="h-9 border-gray-200 rounded-lg text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700 block mb-1.5">Sign-off</label>
              <Input value={form.signOff} onChange={e => set('signOff', e.target.value)} className="h-9 border-gray-200 rounded-lg text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700 block mb-1.5">Avoid Phrases</label>
              <Textarea value={form.avoidPhrases} onChange={e => set('avoidPhrases', e.target.value)} rows={2} className="border-gray-200 rounded-lg resize-none text-sm" placeholder="One phrase per line..." />
            </div>
            <div className="pt-1 flex justify-end">
              <Button className="bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm press-scale" onClick={() => savePrefs.mutate({ tone: form.tone, emailLength: form.emailLength, openerStyle: form.openerStyle, signOff: form.signOff, avoidPhrases: form.avoidPhrases, ctaStyle: form.ctaStyle })} disabled={savePrefs.isPending}>
                {savePrefs.isPending ? <Loader2 className="size-3.5 animate-spin mr-1.5" /> : <Save className="size-3.5 mr-1.5" />} Save Preferences
              </Button>
            </div>
          </div>

          {/* Live Preview */}
          <div className="rounded-xl bg-white card-rest p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Mail className="size-4 text-gray-400" /> Email Preview
            </h3>
            <div className="rounded-lg border border-gray-200 bg-gray-50/50 p-5">
              <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">{sampleEmail(form.tone, form.emailLength, form.ctaStyle)}</pre>
            </div>
            <p className="text-[11px] text-gray-400 mt-2">This is a sample preview. Actual emails will be personalized per contact.</p>
          </div>
        </TabsContent>

        {/* ── AI Config ── */}
        <TabsContent value="ai" className="space-y-6">
          <div className="rounded-xl bg-white card-rest p-6 space-y-5">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">AI Provider Configuration</h3>
              <p className="text-xs text-gray-500 mt-0.5">Set your AI provider and model for email generation and research.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1.5">AI Provider</label>
                <Select value={form.aiProvider} onValueChange={v => set('aiProvider', v)}>
                  <SelectTrigger className="h-9 border-gray-200 rounded-lg text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="openai">OpenAI</SelectItem>
                    <SelectItem value="google-gemini">Google Gemini</SelectItem>
                    <SelectItem value="groq">Groq</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1.5">Model</label>
                <Input value={form.aiModel} onChange={e => set('aiModel', e.target.value)} className="h-9 border-gray-200 rounded-lg text-sm" />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700 block mb-1.5">API Key</label>
              <div className="relative">
                <Input type={showKey ? 'text' : 'password'} value={form.aiApiKey} onChange={e => set('aiApiKey', e.target.value)} className="h-9 pr-10 border-gray-200 rounded-lg text-sm font-mono" placeholder="sk-..." />
                <button type="button" className="absolute right-0 top-0 h-9 px-3 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors" onClick={() => setShowKey(p => !p)}>
                  {showKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              <p className="text-[11px] text-gray-400 mt-1.5">Your API key is encrypted and stored securely. It is never shared.</p>
            </div>
            <div className="pt-1 flex justify-end">
              <Button className="bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm press-scale" onClick={() => savePrefs.mutate({ aiProvider: form.aiProvider, aiModel: form.aiModel, aiApiKey: form.aiApiKey })} disabled={savePrefs.isPending}>
                {savePrefs.isPending ? <Loader2 className="size-3.5 animate-spin mr-1.5" /> : <Save className="size-3.5 mr-1.5" />} Save AI Config
              </Button>
            </div>
          </div>
        </TabsContent>

        {/* ── Data Management ── */}
        <TabsContent value="data" className="space-y-6">
          <div className="rounded-xl bg-white card-rest p-6 space-y-5">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Data Management</h3>
              <p className="text-xs text-gray-500 mt-0.5">Export your data or run maintenance tasks.</p>
            </div>
            <div className="grid gap-3">
              <div className="flex items-center justify-between p-4 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="size-9 rounded-lg bg-blue-50 flex items-center justify-center"><Download className="size-4 text-blue-600" /></div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Export All Data</p>
                    <p className="text-xs text-gray-500">Download companies and contacts as CSV</p>
                  </div>
                </div>
                <Button variant="outline" size="sm" className="text-xs border-gray-200 text-gray-600 rounded-lg" onClick={() => handleExport.mutate()} disabled={handleExport.isPending}>
                  {handleExport.isPending ? <Loader2 className="size-3.5 animate-spin" /> : 'Export'}
                </Button>
              </div>
              <div className="flex items-center justify-between p-4 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="size-9 rounded-lg bg-emerald-50 flex items-center justify-center"><Stethoscope className="size-4 text-emerald-600" /></div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Run Email Health Check</p>
                    <p className="text-xs text-gray-500">Validate all email addresses in your database</p>
                  </div>
                </div>
                <Button variant="outline" size="sm" className="text-xs border-gray-200 text-gray-600 rounded-lg" onClick={() => handleHealthCheck.mutate()} disabled={handleHealthCheck.isPending}>
                  {handleHealthCheck.isPending ? <Loader2 className="size-3.5 animate-spin" /> : 'Run Check'}
                </Button>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ── Danger Zone ── */}
        <TabsContent value="danger" className="space-y-6">
          <div className="rounded-xl border border-red-200 bg-white p-6 space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-red-700 flex items-center gap-2">
                <AlertTriangle className="size-4" /> Danger Zone
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">Irreversible and destructive actions.</p>
            </div>
            <div className="flex items-center justify-between p-4 rounded-lg border border-red-200 bg-red-50/30">
              <div>
                <p className="text-sm font-medium text-gray-900">Delete All Data</p>
                <p className="text-xs text-gray-500">Permanently remove all companies, contacts, and notes. This cannot be undone.</p>
              </div>
              <Button variant="outline" size="sm" className="text-xs border-red-300 text-red-600 hover:bg-red-50 rounded-lg" onClick={() => setDangerOpen(true)}>
                <Trash2 className="size-3.5 mr-1" /> Delete All
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <Separator className="bg-gray-100 my-8" />
      <p className="text-center text-xs text-gray-400 pb-4">DeepMindQ v1.0 — AI-Powered Sales Intelligence</p>

      {/* Danger Dialog */}
      <Dialog open={dangerOpen} onOpenChange={setDangerOpen}>
        <DialogContent className="sm:max-w-md rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-red-700">Delete All Data?</DialogTitle>
            <DialogDescription className="text-sm text-gray-500">This will permanently delete all companies, contacts, notes, research cards, and opportunities. This action cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDangerOpen(false)} className="border-gray-200 text-gray-600">Cancel</Button>
            <Button variant="destructive" className="bg-red-600 hover:bg-red-700 text-white rounded-lg" onClick={() => handleDeleteAll.mutate()} disabled={handleDeleteAll.isPending}>
              {handleDeleteAll.isPending ? <Loader2 className="size-3.5 animate-spin mr-1" /> : <Trash2 className="size-3.5 mr-1" />} Yes, Delete Everything
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}