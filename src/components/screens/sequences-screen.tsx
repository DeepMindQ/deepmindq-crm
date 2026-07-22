'use client';

import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import {
  GitBranch, Plus, Pencil, Trash2, Play, Users, ChevronRight, GripVertical,
  Clock, Mail, CheckCircle2, XCircle, Pause, ArrowRight, RefreshCw,
} from 'lucide-react';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import {
  PageTransition, AnimatedCard, StaggerGrid, StaggerItem, SectionHeader,
  GlassPanel, EmptyState, PulseDot,
} from '@/components/ui/animated-components';
import { toast } from 'sonner';

interface SequenceStep {
  id: string;
  stepNumber: number;
  delayDays: number;
  subject: string;
  bodyPreview: string;
  cta: string | null;
}

interface Sequence {
  id: string;
  name: string;
  description: string | null;
  serviceLine: string | null;
  isActive: boolean;
  stepCount: number;
  enrollmentCount: number;
  steps: SequenceStep[];
  createdAt: string;
}

interface Enrollment {
  id: string;
  contactId: string;
  currentStep: number;
  status: string;
  nextStepAt: string | null;
  contact: { rawName: string; email: string; title: string | null };
}

export default function SequencesScreen({ navigateTo }: { navigateTo?: (screen: string) => void }) {
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [enrollDialogOpen, setEnrollDialogOpen] = useState(false);
  const [selectedSeq, setSelectedSeq] = useState<Sequence | null>(null);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [enrollContactIds, setEnrollContactIds] = useState('');
  const [processing, setProcessing] = useState(false);

  const fetchSequences = async () => {
    try {
      const res = await fetch('/api/sequences');
      const data = await res.json();
      setSequences(Array.isArray(data) ? data : []);
    } catch {
      setSequences([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    let cancelled = false;
    fetch('/api/sequences')
      .then(r => r.json())
      .then(data => { if (!cancelled) { setSequences(Array.isArray(data) ? data : []); setLoading(false); } })
      .catch(() => { if (!cancelled) { setSequences([]); setLoading(false); } });
    return () => { cancelled = true; };
  }, []);

  // Form state
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formServiceLine, setFormServiceLine] = useState('');
  const [formSteps, setFormSteps] = useState<{ stepNumber: number; delayDays: number; subject: string; body: string; cta: string }[]>([
    { stepNumber: 1, delayDays: 0, subject: '', body: '', cta: 'Would you be open to a brief call this week?' },
    { stepNumber: 2, delayDays: 3, subject: '', body: '', cta: 'Just following up on my previous note.' },
    { stepNumber: 3, delayDays: 7, subject: '', body: '', cta: 'Would a different time work better?' },
  ]);

  const openCreate = () => {
    setSelectedSeq(null);
    setFormName(''); setFormDesc(''); setFormServiceLine('');
    setFormSteps([
      { stepNumber: 1, delayDays: 0, subject: '', body: '', cta: 'Would you be open to a brief call this week?' },
      { stepNumber: 2, delayDays: 3, subject: '', body: '', cta: 'Just following up on my previous note.' },
      { stepNumber: 3, delayDays: 7, subject: '', body: '', cta: 'Would a different time work better?' },
    ]);
    setDialogOpen(true);
  };

  const openEnroll = (seq: Sequence) => {
    setSelectedSeq(seq);
    fetchEnrollments(seq.id);
    setEnrollContactIds('');
    setEnrollDialogOpen(true);
  };

  const fetchEnrollments = async (seqId: string) => {
    // TODO: There is no dedicated enrollments list endpoint yet.
    // Replace with: const res = await fetch(`/api/sequences/${seqId}/enrollments`);
    // const data = await res.json(); setEnrollments(data.enrollments || []);
    setEnrollments([]);
  };

  const handleSave = async () => {
    if (!formName || formSteps.some(s => !s.subject || !s.body)) {
      toast.error('Name and all step subjects/bodies are required');
      return;
    }

    try {
      if (selectedSeq) {
        await fetch('/api/sequences', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: selectedSeq.id, name: formName, description: formDesc, serviceLine: formServiceLine || null }),
        });
        toast.success('Sequence updated');
      } else {
        await fetch('/api/sequences', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: formName,
            description: formDesc || null,
            serviceLine: formServiceLine || null,
            steps: formSteps.map((s, i) => ({ stepNumber: i + 1, delayDays: s.delayDays, subject: s.subject, body: s.body, cta: s.cta })),
          }),
        });
        toast.success('Sequence created');
      }
      setDialogOpen(false);
      fetchSequences();
    } catch {
      toast.error('Failed to save sequence');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/sequences?id=${id}`, { method: 'DELETE' });
      toast.success('Sequence archived');
      fetchSequences();
    } catch {
      toast.error('Failed to archive sequence');
    }
  };

  const handleProcess = async () => {
    setProcessing(true);
    try {
      const res = await fetch('/api/sequences/process', { method: 'POST' });
      const data = await res.json();
      toast.success(`Processed ${data.processed} enrollments`);
      fetchSequences();
    } catch {
      toast.error('Failed to process sequences');
    }
    setProcessing(false);
  };

  const handleEnroll = async () => {
    if (!selectedSeq || !enrollContactIds.trim()) return;
    const ids = enrollContactIds.split(',').map(s => s.trim()).filter(Boolean);
    try {
      const res = await fetch('/api/sequences/enroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sequenceId: selectedSeq.id, contactIds: ids }),
      });
      const data = await res.json();
      toast.success(`Enrolled ${data.enrolled} contacts (${data.skipped} skipped)`);
      fetchSequences();
    } catch {
      toast.error('Failed to enroll contacts');
    }
  };

  const updateStep = (index: number, field: string, value: string | number) => {
    const updated = [...formSteps];
    (updated[index] as any)[field] = value;
    setFormSteps(updated);
  };

  const addStep = () => {
    const lastDelay = formSteps[formSteps.length - 1]?.delayDays || 3;
    setFormSteps([...formSteps, {
      stepNumber: formSteps.length + 1,
      delayDays: lastDelay + 3,
      subject: '',
      body: '',
      cta: '',
    }]);
  };

  const removeStep = (index: number) => {
    if (formSteps.length <= 1) return;
    const updated = formSteps.filter((_, i) => i !== index).map((s, i) => ({ ...s, stepNumber: i + 1 }));
    setFormSteps(updated);
  };

  const moveStep = (from: number, to: number) => {
    const updated = [...formSteps];
    const [item] = updated.splice(from, 1);
    updated.splice(to, 0, item);
    setFormSteps(updated.map((s, i) => ({ ...s, stepNumber: i + 1 })));
  };

  const gold = 'var(--color-gold)';

  return (
    <PageTransition>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <SectionHeader title="Email Sequences" subtitle="Multi-step drip campaigns with automated follow-ups" />
          <div className="flex gap-2">
            <Button onClick={handleProcess} disabled={processing} variant="outline" className="gap-2">
              <RefreshCw className={`w-4 h-4 ${processing ? 'animate-spin' : ''}`} />
              {processing ? 'Processing...' : 'Process Due'}
            </Button>
            <Button onClick={openCreate} className="gap-2" style={{ background: `linear-gradient(135deg, ${gold}, #E8C860)` }}>
              <Plus className="w-4 h-4" /> New Sequence
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2].map(i => <div key={i} className="h-56 rounded-xl bg-card/50 border border-border/50 animate-pulse" />)}
          </div>
        ) : sequences.length === 0 ? (
          <GlassPanel className="p-8">
            <EmptyState
              icon={GitBranch}
              title="No sequences yet"
              description="Create multi-step email sequences to automate your outreach cadence"
              action={
                <Button onClick={openCreate} variant="outline" className="gap-2">
                  <Plus className="w-4 h-4" /> Create Sequence
                </Button>
              }
            />
          </GlassPanel>
        ) : (
          <StaggerGrid className="grid grid-cols-1 lg:grid-cols-2 gap-4" stagger={0.06}>
            {sequences.map(seq => (
              <StaggerItem key={seq.id}>
                <AnimatedCard hover className="p-0 overflow-hidden">
                  <div className="p-4 space-y-4">
                    {/* Header */}
                    <div className="flex items-start justify-between">
                      <div className="space-y-1 flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <GitBranch className="w-4 h-4 text-primary shrink-0" />
                          <h3 className="text-sm font-semibold text-foreground truncate">{seq.name}</h3>
                        </div>
                        {seq.description && <p className="text-xs text-muted-foreground ml-6">{seq.description}</p>}
                      </div>
                      <div className="flex gap-1 shrink-0 ml-2">
                        <button onClick={() => openEnroll(seq)} className="p-1.5 rounded-md hover:bg-gray-100 text-muted-foreground hover:text-foreground transition-colors" title="Enroll contacts">
                          <Users className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDelete(seq.id)} className="p-1.5 rounded-md hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors" title="Archive">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="flex gap-4 ml-6">
                      <div className="flex items-center gap-1.5">
                        <Mail className="w-3 h-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">{seq.stepCount} steps</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Users className="w-3 h-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">{seq.enrollmentCount} enrolled</span>
                      </div>
                      {seq.serviceLine && (
                        <Badge variant="outline" className="text-[10px] text-primary/80 bg-primary/5 border-primary/20">{seq.serviceLine}</Badge>
                      )}
                    </div>

                    {/* Step Timeline */}
                    <div className="ml-6 space-y-0">
                      {(seq.steps || []).map((step, i) => (
                        <div key={step.id} className="flex items-start gap-3">
                          {/* Timeline line + dot */}
                          <div className="flex flex-col items-center">
                            <div
                              className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                              style={{ background: `linear-gradient(135deg, ${gold}, #E8C860)` }}
                            >
                              {step.stepNumber}
                            </div>
                            {i < seq.steps.length - 1 && (
                              <div className="w-px h-8 bg-gradient-to-b from-primary/30 to-primary/5" />
                            )}
                          </div>
                          {/* Step content */}
                          <div className="flex-1 min-w-0 pb-3">
                            <p className="text-xs font-medium text-foreground truncate">{step.subject}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                <Clock className="w-2.5 h-2.5" />
                                {step.delayDays === 0 ? 'Immediate' : `+${step.delayDays}d`}
                              </span>
                              {step.bodyPreview && (
                                <span className="text-[10px] text-muted-foreground/60 truncate max-w-[200px]">{step.bodyPreview}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 pt-2 border-t border-border/50">
                      <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => openEnroll(seq)}>
                        <Users className="w-3 h-3" /> Enroll
                      </Button>
                      <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => { setSelectedSeq(seq); setFormName(seq.name); setFormDesc(seq.description || ''); setFormServiceLine(seq.serviceLine || ''); setFormSteps((seq.steps || []).map(s => ({ stepNumber: s.stepNumber, delayDays: s.delayDays, subject: s.subject, body: s.bodyPreview || '', cta: s.cta || '' }))); setDialogOpen(true); }}>
                        <Pencil className="w-3 h-3" /> Edit
                      </Button>
                    </div>
                  </div>
                </AnimatedCard>
              </StaggerItem>
            ))}
          </StaggerGrid>
        )}
      </div>

      {/* Create/Edit Sequence Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedSeq ? 'Edit Sequence' : 'Create Sequence'}</DialogTitle>
            <DialogDescription>Define the steps in your email sequence. Drag to reorder.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Sequence Name</Label>
                <Input value={formName} onChange={e => setFormName(e.target.value)} placeholder="e.g., 3-Step Enterprise AI Outreach" />
              </div>
              <div className="space-y-2">
                <Label>Service Line</Label>
                <Select value={formServiceLine} onValueChange={setFormServiceLine}>
                  <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AI & ML">AI & ML</SelectItem>
                    <SelectItem value="Cloud Engineering">Cloud Engineering</SelectItem>
                    <SelectItem value="Data Engineering">Data Engineering</SelectItem>
                    <SelectItem value="Digital Transformation">Digital Transformation</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input value={formDesc} onChange={e => setFormDesc(e.target.value)} placeholder="Brief description of this sequence" />
            </div>

            {/* Steps */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Steps</Label>
                <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={addStep}>
                  <Plus className="w-3 h-3" /> Add Step
                </Button>
              </div>
              <div className="space-y-3">
                <AnimatePresence>
                  {formSteps.map((step, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="p-4 rounded-lg border border-border/50 bg-gray-50 space-y-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0" style={{ background: `linear-gradient(135deg, ${gold}, #E8C860)` }}>
                          {index + 1}
                        </div>
                        <div className="flex items-center gap-2 flex-1">
                          <Input
                            placeholder="Step subject line"
                            value={step.subject}
                            onChange={e => updateStep(index, 'subject', e.target.value)}
                            className="text-sm"
                          />
                          <div className="flex items-center gap-1 shrink-0">
                            <Clock className="w-3 h-3 text-muted-foreground" />
                            <Input
                              type="number"
                              min={0}
                              value={step.delayDays}
                              onChange={e => updateStep(index, 'delayDays', parseInt(e.target.value) || 0)}
                              className="w-20 text-sm text-center"
                            />
                            <span className="text-[10px] text-muted-foreground w-4">d</span>
                          </div>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          {index > 0 && (
                            <button onClick={() => moveStep(index, index - 1)} className="p-1 rounded hover:bg-gray-100 text-muted-foreground hover:text-foreground">
                              <ChevronRight className="w-3 h-3 rotate-180" />
                            </button>
                          )}
                          {index < formSteps.length - 1 && (
                            <button onClick={() => moveStep(index, index + 1)} className="p-1 rounded hover:bg-gray-100 text-muted-foreground hover:text-foreground">
                              <ChevronRight className="w-3 h-3" />
                            </button>
                          )}
                          {formSteps.length > 1 && (
                            <button onClick={() => removeStep(index)} className="p-1 rounded hover:bg-red-50 text-muted-foreground hover:text-red-600">
                              <XCircle className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                      <Textarea
                        placeholder="Email body content..."
                        value={step.body}
                        onChange={e => updateStep(index, 'body', e.target.value)}
                        rows={3}
                        className="text-sm font-mono ml-10"
                      />
                      <div className="ml-10">
                        <Input
                          placeholder="CTA (optional)"
                          value={step.cta}
                          onChange={e => updateStep(index, 'cta', e.target.value)}
                          className="text-sm"
                        />
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSave} style={{ background: `linear-gradient(135deg, ${gold}, #E8C860)` }}>
                {selectedSeq ? 'Update' : 'Create'} Sequence
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Enroll Dialog */}
      <Dialog open={enrollDialogOpen} onOpenChange={setEnrollDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Enroll Contacts</DialogTitle>
            <DialogDescription>
              {selectedSeq && `Add contacts to "${selectedSeq.name}". Enter comma-separated contact IDs.`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Contact IDs</Label>
              <Textarea
                placeholder="Enter contact IDs separated by commas..."
                value={enrollContactIds}
                onChange={e => setEnrollContactIds(e.target.value)}
                rows={3}
              />
              <p className="text-[10px] text-muted-foreground">Paste contact IDs from the Leads screen, separated by commas</p>
            </div>
            {selectedSeq && (
              <div className="p-3 rounded-lg bg-gray-50 border border-border/50 space-y-2">
                <p className="text-xs font-medium text-foreground">{selectedSeq.name}</p>
                <div className="flex gap-3 text-[10px] text-muted-foreground">
                  <span>{selectedSeq.stepCount} steps</span>
                  <span>{selectedSeq.enrollmentCount} currently enrolled</span>
                </div>
                {/* Step overview */}
                <div className="flex gap-2 pt-1">
                  {(selectedSeq.steps || []).map(step => (
                    <div key={step.id} className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <span className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold text-white" style={{ background: gold }}>
                        {step.stepNumber}
                      </span>
                      {step.stepNumber < selectedSeq.steps.length && <ArrowRight className="w-2.5 h-2.5" />}
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEnrollDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleEnroll} style={{ background: `linear-gradient(135deg, ${gold}, #E8C860)` }}>
                Enroll Contacts
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </PageTransition>
  );
}