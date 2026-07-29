'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import {
  GitBranch, Plus, Pencil, Trash2, Play, Users, ChevronRight,
  Clock, Mail, XCircle, ArrowRight, RefreshCw, Loader2, Search, X,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

/* ══════════════════════════════ Types ══════════════════════════════ */

interface SequenceStep {
  id: string; stepNumber: number; delayDays: number;
  subject: string; bodyPreview: string; cta: string | null;
}

interface Sequence {
  id: string; name: string; description: string | null;
  serviceLine: string | null; isActive: boolean; stepCount: number;
  enrollmentCount: number; steps: SequenceStep[]; createdAt: string;
}

/* ══════════════════════════════ Design Tokens ══════════════════════════════ */

const gold = 'var(--color-gold-dim)', goldLight = 'var(--color-gold)';
const card = 'rgba(255, 255, 255, 0.85)', border = 'rgba(0, 0, 0, 0.08)';

/* ══════════════════════════════ Component ══════════════════════════════ */

export default function SequencesScreen({ navigateTo }: { navigateTo?: (screen: string) => void }) {
  const queryClient = useQueryClient();

  /* ── Data fetching ── */
  const { data: sequences = [], isLoading } = useQuery<Sequence[]>({
    queryKey: ['sequences'],
    queryFn: () => fetch('/api/sequences').then(r => r.json()).then(d => Array.isArray(d) ? d : []),
    staleTime: 30000,
  });

  /* ── Mutations ── */
  const saveMutation = useMutation({
    mutationFn: async ({ id, ...body }: any) => {
      const isEdit = !!id;
      const res = await fetch('/api/sequences', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save');
      return data;
    },
    onSuccess: (_, vars) => {
      toast.success(vars.id ? 'Sequence updated' : 'Sequence created');
      queryClient.invalidateQueries({ queryKey: ['sequences'] });
      setDialogOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => fetch(`/api/sequences?id=${id}`, { method: 'DELETE' }).then(r => { if (!r.ok) throw new Error(); }),
    onSuccess: () => { toast.success('Sequence archived'); queryClient.invalidateQueries({ queryKey: ['sequences'] }); },
    onError: () => toast.error('Failed to archive'),
  });

  const processMutation = useMutation({
    mutationFn: () => fetch('/api/sequences/process', { method: 'POST' }).then(r => r.json()),
    onSuccess: (d) => { toast.success(`Processed ${d.processed || 0} enrollments`); queryClient.invalidateQueries({ queryKey: ['sequences'] }); },
    onError: () => toast.error('Failed to process'),
  });

  const enrollMutation = useMutation({
    mutationFn: ({ sequenceId, contactIds }: { sequenceId: string; contactIds: string[] }) =>
      fetch('/api/sequences/enroll', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sequenceId, contactIds }),
      }).then(r => r.json()),
    onSuccess: (d, vars) => {
      toast.success(`Enrolled ${d.enrolled || 0} contacts`);
      queryClient.invalidateQueries({ queryKey: ['sequences'] });
      setEnrollDialogOpen(false);
    },
    onError: () => toast.error('Failed to enroll'),
  });

  /* ── Local state ── */
  const [dialogOpen, setDialogOpen] = useState(false);
  const [enrollDialogOpen, setEnrollDialogOpen] = useState(false);
  const [selectedSeq, setSelectedSeq] = useState<Sequence | null>(null);
  const [enrollContactIds, setEnrollContactIds] = useState('');
  const [search, setSearch] = useState('');

  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formServiceLine, setFormServiceLine] = useState('');
  const [formSteps, setFormSteps] = useState<{ stepNumber: number; delayDays: number; subject: string; body: string; cta: string }[]>([]);

  const defaultSteps = () => [
    { stepNumber: 1, delayDays: 0, subject: '', body: '', cta: 'Would you be open to a brief call this week?' },
    { stepNumber: 2, delayDays: 3, subject: '', body: '', cta: 'Just following up on my previous note.' },
    { stepNumber: 3, delayDays: 7, subject: '', body: '', cta: 'Would a different time work better?' },
  ];

  const openCreate = () => {
    setSelectedSeq(null); setFormName(''); setFormDesc(''); setFormServiceLine('');
    setFormSteps(defaultSteps()); setDialogOpen(true);
  };

  const openEdit = (seq: Sequence) => {
    setSelectedSeq(seq); setFormName(seq.name); setFormDesc(seq.description || '');
    setFormServiceLine(seq.serviceLine || '');
    setFormSteps((seq.steps || []).map(s => ({ stepNumber: s.stepNumber, delayDays: s.delayDays, subject: s.subject, body: s.bodyPreview || '', cta: s.cta || '' })));
    setDialogOpen(true);
  };

  const openEnroll = (seq: Sequence) => { setSelectedSeq(seq); setEnrollContactIds(''); setEnrollDialogOpen(true); };

  const handleSave = () => {
    if (!formName || formSteps.some(s => !s.subject || !s.body)) {
      toast.error('Name and all step subjects/bodies are required'); return;
    }
    saveMutation.mutate({
      id: selectedSeq?.id || undefined,
      name: formName, description: formDesc || null, serviceLine: formServiceLine || null,
      ...(selectedSeq ? {} : { steps: formSteps.map((s, i) => ({ stepNumber: i + 1, delayDays: s.delayDays, subject: s.subject, body: s.body, cta: s.cta })) }),
    });
  };

  const handleEnroll = () => {
    if (!selectedSeq || !enrollContactIds.trim()) return;
    const ids = enrollContactIds.split(',').map(s => s.trim()).filter(Boolean);
    enrollMutation.mutate({ sequenceId: selectedSeq.id, contactIds: ids });
  };

  const updateStep = (index: number, field: string, value: string | number) => {
    const updated = [...formSteps]; (updated[index] as any)[field] = value; setFormSteps(updated);
  };
  const addStep = () => {
    const last = formSteps[formSteps.length - 1]?.delayDays || 3;
    setFormSteps([...formSteps, { stepNumber: formSteps.length + 1, delayDays: last + 3, subject: '', body: '', cta: '' }]);
  };
  const removeStep = (i: number) => {
    if (formSteps.length <= 1) return;
    setFormSteps(formSteps.filter((_, idx) => idx !== i).map((s, idx) => ({ ...s, stepNumber: idx + 1 })));
  };
  const moveStep = (from: number, to: number) => {
    const updated = [...formSteps]; const [item] = updated.splice(from, 1);
    updated.splice(to, 0, item); setFormSteps(updated.map((s, i) => ({ ...s, stepNumber: i + 1 })));
  };

  /* ── Derived ── */
  const filtered = search ? sequences.filter(s => s.name.toLowerCase().includes(search.toLowerCase())) : sequences;
  const totalEnrolled = sequences.reduce((s, seq) => s + seq.enrollmentCount, 0);
  const activeCount = sequences.filter(s => s.isActive).length;

  /* ══════════════════════════════ Render ══════════════════════════════ */
  return (
    <div className="max-h-[calc(100vh-200px)] overflow-y-auto space-y-5 pr-1">

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { icon: GitBranch, label: 'Total Sequences', value: sequences.length, color: gold },
          { icon: Users, label: 'Enrolled Contacts', value: totalEnrolled, color: '#3B82F6' },
          { icon: Play, label: 'Active', value: activeCount, color: '#10B981' },
        ].map(({ icon: Icon, label, value, color }, i) => (
          <motion.div key={label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] }}
            className="rounded-xl overflow-hidden" style={{ background: card, backdropFilter: 'blur(20px)', border: `1px solid ${border}`, borderLeft: `3px solid ${color}` }}>
            <div className="p-4 space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${color}18` }}>
                  <Icon className="w-4 h-4" style={{ color }} />
                </div>
                <span className="text-xs font-medium text-muted-foreground">{label}</span>
              </div>
              <span className="text-2xl font-bold tabular-nums text-foreground">{isLoading ? '\u2014' : value.toLocaleString()}</span>
            </div>
          </motion.div>
        ))}
      </div>

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-foreground tracking-tight">Email Sequences</h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">Multi-step drip campaigns with automated follow-ups</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search sequences..."
              className="h-8 pl-8 pr-7 w-48 text-xs rounded-lg" style={{ background: card, border: `1px solid ${border}` }} />
            {search && <X className="w-3 h-3 absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground cursor-pointer hover:text-foreground" onClick={() => setSearch('')} />}
          </div>
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => processMutation.mutate()} disabled={processMutation.isPending}>
            {processMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Process Due
          </Button>
          <Button className="h-8 gap-1.5 text-xs font-medium px-3"
            style={{ background: 'linear-gradient(135deg, #D4AF37, #E8C860)', color: '#000' }}
            onClick={openCreate}>
            <Plus className="w-3.5 h-3.5" /> New Sequence
          </Button>
        </div>
      </div>

      {/* ── Grid ── */}
      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-56 rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center py-16 text-center rounded-xl"
          style={{ background: card, border: `1px solid ${border}` }}>
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3" style={{ background: `${gold}15`, border: `1px solid ${gold}30` }}>
            <GitBranch className="w-6 h-6" style={{ color: gold }} />
          </div>
          <p className="text-sm font-medium text-foreground">{search ? 'No matching sequences' : 'No sequences yet'}</p>
          <p className="text-xs text-muted-foreground mt-1">{search ? 'Try a different search' : 'Create multi-step email sequences to automate your outreach'}</p>
          {!search && (
            <Button className="mt-4 h-8 gap-1.5 text-xs" style={{ background: 'linear-gradient(135deg, #D4AF37, #E8C860)', color: '#000' }} onClick={openCreate}>
              <Plus className="w-3.5 h-3.5" /> Create Sequence
            </Button>
          )}
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map((seq, i) => (
            <motion.div key={seq.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.04, ease: [0.22, 1, 0.36, 1] }}
              className="rounded-xl overflow-hidden group" style={{ background: card, backdropFilter: 'blur(20px)', border: `1px solid ${border}` }}>
              <div className="p-5 space-y-4">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${gold}15` }}>
                      <GitBranch className="w-4 h-4" style={{ color: gold }} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{seq.name}</p>
                      {seq.description && <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{seq.description}</p>}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <motion.button whileTap={{ scale: 0.9 }} onClick={() => openEnroll(seq)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-black/[0.03] transition-colors">
                      <Users className="w-3.5 h-3.5" />
                    </motion.button>
                    <motion.button whileTap={{ scale: 0.9 }} onClick={() => openEdit(seq)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-black/[0.03] transition-colors">
                      <Pencil className="w-3.5 h-3.5" />
                    </motion.button>
                    <motion.button whileTap={{ scale: 0.9 }} onClick={() => deleteMutation.mutate(seq.id)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </motion.button>
                  </div>
                </div>

                {/* Stats */}
                <div className="flex items-center gap-4">
                  <span className="text-[11px] text-muted-foreground flex items-center gap-1"><Mail className="w-3 h-3" />{seq.stepCount} steps</span>
                  <span className="text-[11px] text-muted-foreground flex items-center gap-1"><Users className="w-3 h-3" />{seq.enrollmentCount} enrolled</span>
                  {seq.serviceLine && (
                    <Badge variant="outline" className="text-[11px] bg-primary/5 text-primary/80 border-primary/20">{seq.serviceLine}</Badge>
                  )}
                </div>

                {/* Step Timeline */}
                {(seq.steps || []).length > 0 && (
                  <div className="space-y-0">
                    {(seq.steps || []).map((step, si) => (
                      <div key={step.id} className="flex items-start gap-3">
                        <div className="flex flex-col items-center">
                          <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-black shrink-0"
                            style={{ background: `linear-gradient(135deg, #D4AF37, #E8C860)` }}>
                            {step.stepNumber}
                          </div>
                          {si < seq.steps.length - 1 && <div className="w-px h-6 bg-gray-100" />}
                        </div>
                        <div className="flex-1 min-w-0 pb-2">
                          <p className="text-[11px] font-medium text-foreground truncate">{step.subject}</p>
                          <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5" />{step.delayDays === 0 ? 'Immediate' : `+${step.delayDays}d`}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-2" style={{ borderTop: `1px solid ${border}` }}>
                  <Button size="sm" variant="outline" className="h-7 gap-1 text-[11px]" onClick={() => openEnroll(seq)}>
                    <Users className="w-3 h-3" /> Enroll
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 gap-1 text-[11px]" onClick={() => openEdit(seq)}>
                    <Pencil className="w-3 h-3" /> Edit
                  </Button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* ── Create/Edit Dialog ── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto" style={{ background: card, border: `1px solid ${border}` }}>
          <DialogHeader>
            <DialogTitle>{selectedSeq ? 'Edit Sequence' : 'Create Sequence'}</DialogTitle>
            <DialogDescription>Define the steps in your email sequence</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">Sequence Name</Label>
                <Input value={formName} onChange={e => setFormName(e.target.value)} placeholder="e.g. 3-Step Enterprise AI Outreach" className="h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">Service Line</Label>
                <Select value={formServiceLine} onValueChange={setFormServiceLine}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Optional" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AI & ML">AI & ML</SelectItem>
                    <SelectItem value="Cloud Engineering">Cloud Engineering</SelectItem>
                    <SelectItem value="Data Engineering">Data Engineering</SelectItem>
                    <SelectItem value="Digital Transformation">Digital Transformation</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">Description</Label>
              <Input value={formDesc} onChange={e => setFormDesc(e.target.value)} placeholder="Brief description" className="h-9 text-sm" />
            </div>

            {/* Steps Editor */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">Steps</Label>
                <Button variant="outline" size="sm" className="h-7 gap-1 text-[11px]" onClick={addStep}>
                  <Plus className="w-3 h-3" /> Add Step
                </Button>
              </div>
              <AnimatePresence>
                {formSteps.map((step, index) => (
                  <motion.div key={index} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -20 }} className="p-4 rounded-lg space-y-3"
                    style={{ background: 'rgba(0,0,0,0.02)', border: `1px solid ${border}` }}>
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold text-black shrink-0"
                        style={{ background: 'linear-gradient(135deg, #D4AF37, #E8C860)' }}>{index + 1}</div>
                      <Input placeholder="Step subject line" value={step.subject}
                        onChange={e => updateStep(index, 'subject', e.target.value)} className="text-sm flex-1" />
                      <div className="flex items-center gap-1 shrink-0">
                        <Clock className="w-3 h-3 text-muted-foreground" />
                        <Input type="number" min={0} value={step.delayDays}
                          onChange={e => updateStep(index, 'delayDays', parseInt(e.target.value) || 0)}
                          className="w-16 text-sm text-center h-8" />
                        <span className="text-[11px] text-muted-foreground">d</span>
                      </div>
                      <div className="flex gap-0.5">
                        {index > 0 && <button onClick={() => moveStep(index, index - 1)} className="p-1 rounded hover:bg-gray-100 text-muted-foreground"><ChevronRight className="w-3 h-3 rotate-180" /></button>}
                        {index < formSteps.length - 1 && <button onClick={() => moveStep(index, index + 1)} className="p-1 rounded hover:bg-gray-100 text-muted-foreground"><ChevronRight className="w-3 h-3" /></button>}
                        {formSteps.length > 1 && <button onClick={() => removeStep(index)} className="p-1 rounded hover:bg-red-50 text-muted-foreground hover:text-red-600"><XCircle className="w-3 h-3" /></button>}
                      </div>
                    </div>
                    <Textarea placeholder="Email body content..." value={step.body}
                      onChange={e => updateStep(index, 'body', e.target.value)} rows={2} className="text-xs font-mono ml-9" />
                    <Input placeholder="CTA (optional)" value={step.cta}
                      onChange={e => updateStep(index, 'cta', e.target.value)} className="text-xs ml-9 h-8" />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={saveMutation.isPending}
                style={{ background: 'linear-gradient(135deg, #D4AF37, #E8C860)', color: '#000' }}>
                {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {selectedSeq ? 'Update' : 'Create'} Sequence
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Enroll Dialog ── */}
      <Dialog open={enrollDialogOpen} onOpenChange={setEnrollDialogOpen}>
        <DialogContent className="max-w-lg" style={{ background: card, border: `1px solid ${border}` }}>
          <DialogHeader>
            <DialogTitle>Enroll Contacts</DialogTitle>
            <DialogDescription>{selectedSeq && `Add contacts to "${selectedSeq.name}". Enter comma-separated contact IDs.`}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">Contact IDs</Label>
              <Textarea placeholder="Enter contact IDs separated by commas..." value={enrollContactIds}
                onChange={e => setEnrollContactIds(e.target.value)} rows={3} className="text-sm" />
              <p className="text-[11px] text-muted-foreground">Paste contact IDs from the Stakeholders screen, separated by commas</p>
            </div>
            {selectedSeq && (
              <div className="p-3 rounded-lg space-y-2" style={{ background: 'rgba(0,0,0,0.02)', border: `1px solid ${border}` }}>
                <p className="text-xs font-medium text-foreground">{selectedSeq.name}</p>
                <div className="flex gap-3 text-[11px] text-muted-foreground">
                  <span>{selectedSeq.stepCount} steps</span><span>{selectedSeq.enrollmentCount} enrolled</span>
                </div>
                <div className="flex gap-2 pt-1">
                  {(selectedSeq.steps || []).map(step => (
                    <div key={step.id} className="flex items-center gap-1 text-[11px] text-muted-foreground">
                      <span className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold text-black"
                        style={{ background: 'linear-gradient(135deg, #D4AF37, #E8C860)' }}>{step.stepNumber}</span>
                      {step.stepNumber < selectedSeq.steps.length && <ArrowRight className="w-2.5 h-2.5" />}
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEnrollDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleEnroll} disabled={enrollMutation.isPending}
                style={{ background: 'linear-gradient(135deg, #D4AF37, #E8C860)', color: '#000' }}>
                {enrollMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Enroll Contacts'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
