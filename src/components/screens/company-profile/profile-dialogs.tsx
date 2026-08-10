'use client'

import { Loader2, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DEFAULT_INDUSTRIES, EMPLOYEE_SIZES, ROLE_BUCKETS } from '@/lib/constants'
import type { Contact } from '@/lib/types'

/* ═══════════════════════════════════════════════════════════════
   Status Cycle Confirmation Dialog
   ═══════════════════════════════════════════════════════════════ */

export function StatusConfirmDialog({ open, onOpenChange, currentStatus, nextStatus, pending, onConfirm }: {
  open: boolean; onOpenChange: (v: boolean) => void; currentStatus: string; nextStatus: string; pending: boolean; onConfirm: () => void
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="rounded-xl">
        <AlertDialogHeader>
          <AlertDialogTitle>Change Company Status</AlertDialogTitle>
          <AlertDialogDescription>
            Change status from <span className="font-semibold text-gray-900 capitalize">{currentStatus}</span> to{' '}
            <span className="font-semibold text-gray-900 capitalize">{nextStatus}</span>?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="rounded-lg" disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction className="rounded-lg bg-amber-600 hover:bg-amber-700 text-white" onClick={onConfirm} disabled={pending}>
            {pending ? <Loader2 className="size-4 mr-2 animate-spin" /> : null} Confirm
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

/* ═══════════════════════════════════════════════════════════════
   Delete Note Dialog
   ═══════════════════════════════════════════════════════════════ */

export function DeleteNoteDialog({ open, onOpenChange, pending, onConfirm }: {
  open: boolean; onOpenChange: (v: boolean) => void; pending: boolean; onConfirm: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm rounded-xl">
        <DialogHeader>
          <DialogTitle className="text-gray-900 flex items-center gap-2">
            <AlertTriangle className="size-4 text-red-500" /> Delete Note
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-gray-600">Are you sure you want to delete this note? This action cannot be undone.</p>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="text-gray-600 border-gray-200 hover:bg-gray-50 hover:text-gray-900">Cancel</Button>
          <Button onClick={onConfirm} disabled={pending} className="bg-red-600 text-white hover:bg-red-700 press-scale">
            {pending ? <Loader2 className="size-3.5 mr-1.5 animate-spin" /> : null} Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ═══════════════════════════════════════════════════════════════
   Add Note Dialog
   ═══════════════════════════════════════════════════════════════ */

export function AddNoteDialog({ open, onOpenChange, noteType, setNoteType, noteBody, setNoteBody, pending, onSubmit }: {
  open: boolean; onOpenChange: (v: boolean) => void; noteType: string; setNoteType: (v: string) => void; noteBody: string; setNoteBody: (v: string) => void; pending: boolean; onSubmit: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-xl">
        <DialogHeader><DialogTitle className="text-gray-900">Add Note</DialogTitle></DialogHeader>
        <div className="space-y-4 py-1">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Type</Label>
            <Select value={noteType} onValueChange={setNoteType}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Select type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="call">Call</SelectItem>
                <SelectItem value="meeting">Meeting</SelectItem>
                <SelectItem value="research">Research</SelectItem>
                <SelectItem value="general">General</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Note</Label>
            <Textarea value={noteBody} onChange={e => setNoteBody(e.target.value)} rows={3} placeholder="Write your note..." className="resize-none" />
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="text-gray-600 border-gray-200 hover:bg-gray-50 hover:text-gray-900">Cancel</Button>
          <Button onClick={onSubmit} disabled={!noteBody.trim() || pending} className="bg-amber-600 hover:bg-amber-700 text-white press-scale">Save Note</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ═══════════════════════════════════════════════════════════════
   Edit Company Dialog
   ═══════════════════════════════════════════════════════════════ */

export function EditCompanyDialog({ open, onOpenChange, form, setForm, industries, pending, onSubmit }: {
  open: boolean; onOpenChange: (v: boolean) => void
  form: { name: string; domain: string; industry: string; website: string; linkedinUrl: string; employeeSize: string; country: string; location: string }
  setForm: (f: typeof form) => void; industries: string[]; pending: boolean; onSubmit: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-xl">
        <DialogHeader><DialogTitle className="text-gray-900">Edit Company</DialogTitle></DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-1.5"><Label className="text-sm font-medium text-gray-800">Name</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Company name" /></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="grid gap-1.5"><Label className="text-sm font-medium text-gray-800">Domain</Label><Input value={form.domain} onChange={e => setForm({ ...form, domain: e.target.value })} placeholder="example.com" /></div>
            <div className="grid gap-1.5">
              <Label className="text-sm font-medium text-gray-800">Industry</Label>
              <Select value={form.industry} onValueChange={v => setForm({ ...form, industry: v })}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{industries.map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="grid gap-1.5"><Label className="text-sm font-medium text-gray-800">Website</Label><Input value={form.website} onChange={e => setForm({ ...form, website: e.target.value })} placeholder="https://..." /></div>
            <div className="grid gap-1.5"><Label className="text-sm font-medium text-gray-800">LinkedIn</Label><Input value={form.linkedinUrl} onChange={e => setForm({ ...form, linkedinUrl: e.target.value })} placeholder="https://linkedin.com/..." /></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label className="text-sm font-medium text-gray-800">Employee Size</Label>
              <Select value={form.employeeSize} onValueChange={v => setForm({ ...form, employeeSize: v })}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{EMPLOYEE_SIZES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5"><Label className="text-sm font-medium text-gray-800">Country</Label><Input value={form.country} onChange={e => setForm({ ...form, country: e.target.value })} placeholder="USA" /></div>
          </div>
          <div className="grid gap-1.5"><Label className="text-sm font-medium text-gray-800">Location</Label><Input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} placeholder="San Francisco, CA" /></div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="text-gray-600 border-gray-200 hover:bg-gray-50 hover:text-gray-900">Cancel</Button>
          <Button onClick={onSubmit} disabled={!form.name.trim() || pending} className="bg-amber-600 hover:bg-amber-700 text-white press-scale">
            {pending ? <Loader2 className="size-3.5 mr-1.5 animate-spin" /> : null} Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ═══════════════════════════════════════════════════════════════
   Add Contact Dialog
   ═══════════════════════════════════════════════════════════════ */

export function AddContactDialog({ open, onOpenChange, form, setForm, companyName, pending, onSubmit }: {
  open: boolean; onOpenChange: (v: boolean) => void
  form: { name: string; email: string; jobTitle: string; roleBucket: string; phone: string; linkedinUrl: string }
  setForm: (f: typeof form) => void; companyName: string; pending: boolean; onSubmit: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-xl">
        <DialogHeader>
          <DialogTitle className="text-gray-900">Add Contact</DialogTitle>
          <p className="text-xs text-gray-500 mt-1">Adding to <span className="font-medium text-gray-800">{companyName}</span></p>
        </DialogHeader>
        <div className="space-y-4 py-1">
          <div className="space-y-1.5"><Label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Name *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Full name" /></div>
          <div className="space-y-1.5"><Label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Email</Label><Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder={`name@${companyName.toLowerCase().replace(/\s+/g, '')}.com`} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Job Title</Label><Input value={form.jobTitle} onChange={e => setForm({ ...form, jobTitle: e.target.value })} placeholder="e.g. VP of Engineering" /></div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Role Bucket</Label>
              <Select value={form.roleBucket} onValueChange={v => setForm({ ...form, roleBucket: v })}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Select role" /></SelectTrigger>
                <SelectContent>{ROLE_BUCKETS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5"><Label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</Label><Input type="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+1 (555) 000-0000" /></div>
          <div className="space-y-1.5"><Label className="text-xs font-medium text-gray-500 uppercase tracking-wider">LinkedIn URL</Label><Input value={form.linkedinUrl} onChange={e => setForm({ ...form, linkedinUrl: e.target.value })} placeholder="https://linkedin.com/in/..." /></div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="text-gray-600 border-gray-200 hover:bg-gray-50 hover:text-gray-900">Cancel</Button>
          <Button onClick={onSubmit} disabled={!form.name.trim() || pending} className="bg-amber-600 hover:bg-amber-700 text-white press-scale">
            {pending ? <Loader2 className="size-3.5 mr-1.5 animate-spin" /> : null} Add Contact
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ═══════════════════════════════════════════════════════════════
   Add Opportunity Dialog
   ═══════════════════════════════════════════════════════════════ */

const OPP_STATUSES = ['researching', 'contacted', 'proposed', 'negotiation', 'won', 'lost'] as const

export function AddOpportunityDialog({ open, onOpenChange, form, setForm, contacts, pending, onSubmit }: {
  open: boolean; onOpenChange: (v: boolean) => void
  form: { title: string; description: string; status: string; nextAction: string; targetContactId: string }
  setForm: (f: typeof form) => void; contacts: Contact[]; pending: boolean; onSubmit: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-xl">
        <DialogHeader>
          <DialogTitle className="text-gray-900">Create Opportunity</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-1">
          <div className="space-y-1.5"><Label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Title *</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Opportunity title" /></div>
          <div className="space-y-1.5"><Label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Description</Label><Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} placeholder="Describe the opportunity..." className="resize-none" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Status</Label>
              <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Select status" /></SelectTrigger>
                <SelectContent>{OPP_STATUSES.map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Target Contact</Label>
              <Select value={form.targetContactId || ''} onValueChange={v => setForm({ ...form, targetContactId: v === '__none__' ? '' : v })}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Select contact (optional)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No contact</SelectItem>
                  {contacts.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}{c.jobTitle ? ` — ${c.jobTitle}` : ''}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5"><Label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Next Action</Label><Input value={form.nextAction} onChange={e => setForm({ ...form, nextAction: e.target.value })} placeholder="What's the next step?" /></div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="text-gray-600 border-gray-200 hover:bg-gray-50 hover:text-gray-900">Cancel</Button>
          <Button onClick={onSubmit} disabled={!form.title.trim() || pending} className="bg-amber-600 hover:bg-amber-700 text-white press-scale">
            {pending ? <Loader2 className="size-3.5 mr-1.5 animate-spin" /> : null} Create Opportunity
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
