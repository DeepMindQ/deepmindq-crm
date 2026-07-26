'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel } from '@/components/ui/alert-dialog';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Layers, Plus, Trash2, ChevronRight, Users, Search, X, Loader2,
  Send, Filter, ArrowLeft, Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';
import { fetchApi } from '@/lib/fetchApi';

/* ══════════════════════════════ Types ══════════════════════════════ */

interface Segment {
  id: string;
  name: string;
  description?: string | null;
  filters: string;
  contactCount: number;
  isStatic: boolean;
  createdAt: string;
}

interface SegmentContact {
  id: string;
  rawName: string;
  email: string;
  title?: string;
  role?: string;
  leadScore: number;
  status: string;
  company: string;
  industry: string;
}

/* ══════════════════════════════ Design Tokens ══════════════════════════════ */

const gold = 'var(--color-gold-dim)', goldLight = 'var(--color-gold)';
const card = 'rgba(255, 255, 255, 0.85)', border = 'rgba(0, 0, 0, 0.08)';

/* ══════════════════════════════ Component ══════════════════════════════ */

export default function SegmentsScreen({ navigateTo }: { navigateTo?: (screen: string) => void }) {
  const queryClient = useQueryClient();

  /* ── Data fetching with useQuery ── */
  const { data: segments = [], isLoading } = useQuery<Segment[]>({
    queryKey: ['segments'],
    queryFn: () => fetch('/api/segments').then(r => r.json()).then(d => Array.isArray(d) ? d : []),
    staleTime: 30000,
  });

  /* ── Create mutation ── */
  const createMutation = useMutation({
    mutationFn: async (body: any) => {
      const res = await fetch('/api/segments', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to create segment');
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Segment "${data.name}" created with ${data.contactCount || 0} contacts`);
      queryClient.invalidateQueries({ queryKey: ['segments'] });
      resetCreateForm();
      setCreateOpen(false);
    },
    onError: (err: any) => toast.error(err.message || 'Failed to create segment'),
  });

  /* ── Delete mutation ── */
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/segments?id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
    },
    onSuccess: () => {
      toast.success('Segment deleted');
      queryClient.invalidateQueries({ queryKey: ['segments'] });
      setDeleteConfirm(null);
    },
    onError: () => toast.error('Failed to delete segment'),
  });

  /* ── Local state ── */
  const [createOpen, setCreateOpen] = useState(false);
  const [detailSegment, setDetailSegment] = useState<Segment | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);
  const [search, setSearch] = useState('');

  /* ── Detail contacts with useQuery ── */
  const { data: detailContacts = [], isLoading: detailLoading } = useQuery<SegmentContact[]>({
    queryKey: ['segment-contacts', detailSegment?.id],
    queryFn: () => fetch(`/api/segments/${detailSegment!.id}/contacts`)
      .then(r => r.json()).then(d => d.contacts || []),
    enabled: !!detailSegment,
  });

  /* ── Zod schema ── */
  const segmentSchema = z.object({
    name: z.string().min(1, 'Segment name is required').max(100, 'Name must be 100 characters or less'),
    description: z.string().max(500, 'Description must be 500 characters or less').optional(),
    scoreMin: z.coerce.number().min(0, 'Min score must be at least 0').max(100, 'Max score must be at most 100'),
    scoreMax: z.coerce.number().min(0, 'Max score must be at least 0').max(100, 'Max score must be at most 100'),
  }).refine(d => d.scoreMin <= d.scoreMax, { message: 'Min score cannot exceed max score', path: ['scoreMax'] });

  /* ── Create form state ── */
  const [segName, setSegName] = useState('');
  const [segDesc, setSegDesc] = useState('');
  const [segIndustries, setSegIndustries] = useState<string[]>([]);
  const [segStatuses, setSegStatuses] = useState<string[]>([]);
  const [segScoreMin, setSegScoreMin] = useState('0');
  const [segScoreMax, setSegScoreMax] = useState('100');
  const [segIsStatic, setSegIsStatic] = useState(false);

  const STATUS_OPTIONS = ['imported', 'cleaned', 'drafted', 'queued', 'sent', 'replied', 'bounced', 'suppressed', 'archived'];
  const INDUSTRY_OPTIONS = ['Technology', 'Fintech', 'Healthcare', 'IT Services', 'E-commerce', 'Manufacturing', 'Aerospace', 'Financial Services'];

  const resetCreateForm = () => {
    setSegName(''); setSegDesc(''); setSegIndustries([]); setSegStatuses([]);
    setSegScoreMin('0'); setSegScoreMax('100'); setSegIsStatic(false);
  };

  const handleCreate = () => {
    const result = segmentSchema.safeParse({ name: segName, description: segDesc || undefined, scoreMin: segScoreMin, scoreMax: segScoreMax });
    if (!result.success) { toast.error(result.error.issues[0].message); return; }
    const filters: any = {};
    if (segIndustries.length > 0) filters.industry = segIndustries;
    if (segStatuses.length > 0) filters.status = segStatuses;
    if (segScoreMin !== '0' || segScoreMax !== '100') filters.scoreRange = [parseInt(segScoreMin), parseInt(segScoreMax)];
    createMutation.mutate({ name: segName, description: segDesc || undefined, filters, isStatic: segIsStatic });
  };

  const toggleIndustry = (v: string) => setSegIndustries(prev => prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v]);
  const toggleStatus = (v: string) => setSegStatuses(prev => prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v]);

  /* ── Derived ── */
  const filteredSegments = search
    ? segments.filter(s => s.name.toLowerCase().includes(search.toLowerCase()))
    : segments;
  const totalContacts = segments.reduce((s, seg) => s + seg.contactCount, 0);
  const dynamicCount = segments.filter(s => !s.isStatic).length;

  /* ══════════════════════════════ Render ══════════════════════════════ */
  return (
    <div className="max-h-[calc(100vh-200px)] overflow-y-auto space-y-5 pr-1">

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { icon: Layers, label: 'Total Segments', value: segments.length, color: gold },
          { icon: Users, label: 'Segmented Contacts', value: totalContacts, color: '#10B981' },
          { icon: Filter, label: 'Dynamic Lists', value: dynamicCount, color: '#6366F1' },
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
              <span className="text-2xl font-bold tabular-nums text-foreground">
                {isLoading ? '\u2014' : value.toLocaleString()}
              </span>
            </div>
          </motion.div>
        ))}
      </div>

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-foreground tracking-tight">Lead Segments</h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">{segments.length} segment{segments.length !== 1 ? 's' : ''} configured</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search segments..."
              className="h-8 pl-8 pr-7 w-48 text-xs rounded-lg" style={{ background: card, border: `1px solid ${border}` }} />
            {search && <X className="w-3 h-3 absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground cursor-pointer hover:text-foreground" onClick={() => setSearch('')} />}
          </div>
          <Button className="h-8 gap-1.5 text-xs font-medium px-3"
            style={{ background: 'linear-gradient(135deg, #D4AF37, #E8C860)', color: '#000' }}
            onClick={() => setCreateOpen(true)}>
            <Plus className="w-3.5 h-3.5" /> New Segment
          </Button>
        </div>
      </div>

      {/* ── Segment Grid ── */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-36 rounded-xl" />)}
        </div>
      ) : filteredSegments.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center py-16 text-center rounded-xl"
          style={{ background: card, border: `1px solid ${border}` }}>
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3" style={{ background: `${gold}15`, border: `1px solid ${gold}30` }}>
            <Layers className="w-6 h-6" style={{ color: gold }} />
          </div>
          <p className="text-sm font-medium text-foreground">{search ? 'No matching segments' : 'No segments yet'}</p>
          <p className="text-xs text-muted-foreground mt-1">{search ? 'Try a different search term' : 'Create your first segment to organize leads by criteria'}</p>
          {!search && (
            <Button className="mt-4 h-8 gap-1.5 text-xs" style={{ background: 'linear-gradient(135deg, #D4AF37, #E8C860)', color: '#000' }} onClick={() => setCreateOpen(true)}>
              <Plus className="w-3.5 h-3.5" /> Create Segment
            </Button>
          )}
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSegments.map((seg, i) => {
            const parsedFilters = JSON.parse(seg.filters || '{}');
            const filterSummary = [
              parsedFilters.industry?.length ? `${parsedFilters.industry.length} industries` : '',
              parsedFilters.status?.length ? `${parsedFilters.status.length} statuses` : '',
              parsedFilters.scoreRange ? `Score ${parsedFilters.scoreRange[0]}\u2013${parsedFilters.scoreRange[1]}` : '',
            ].filter(Boolean).join(' \u00B7 ') || 'No filters';

            return (
              <motion.div key={seg.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: i * 0.04, ease: [0.22, 1, 0.36, 1] }}
                whileHover={{ y: -2 }}
                className="rounded-xl cursor-pointer group relative overflow-hidden"
                style={{ background: card, backdropFilter: 'blur(20px)', border: `1px solid ${border}` }}
                onClick={() => setDetailSegment(seg)}>
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">{seg.name}</p>
                      <p className="text-[11px] text-muted-foreground mt-1 truncate">{filterSummary}</p>
                    </div>
                    <Badge variant="outline"
                      className={`${seg.isStatic ? 'bg-emerald-50 text-emerald-700 border-emerald-500/20' : 'bg-purple-50 text-purple-700 border-purple-500/20'} text-[10px] shrink-0`}>
                      {seg.isStatic ? 'Static' : 'Dynamic'}
                    </Badge>
                  </div>
                  <div className="mt-4 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-xs font-medium tabular-nums text-foreground">{seg.contactCount.toLocaleString()}</span>
                      <span className="text-[11px] text-muted-foreground">contacts</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <motion.button
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-colors"
                        onClick={(e) => { e.stopPropagation(); setDeleteConfirm({ id: seg.id, name: seg.name }); }}
                        whileTap={{ scale: 0.9 }}>
                        <Trash2 className="w-3 h-3" />
                      </motion.button>
                      <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* ── Create Dialog ── */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-hidden" style={{ background: card, border: `1px solid ${border}` }}>
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <Plus className="w-4 h-4" style={{ color: gold }} /> Create Segment
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">Define filters to create a lead segment</DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[65vh] pr-2">
            <div className="space-y-5 pb-4">
              <div className="space-y-1.5">
                <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">Segment Name</label>
                <Input value={segName} onChange={e => setSegName(e.target.value)} placeholder="e.g. SaaS Decision Makers"
                  className="h-9 text-sm" style={{ background: 'rgba(0,0,0,0.02)', border: `1px solid ${border}` }} />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">Description (optional)</label>
                <Input value={segDesc} onChange={e => setSegDesc(e.target.value)} placeholder="What this segment is for..."
                  className="h-9 text-sm" style={{ background: 'rgba(0,0,0,0.02)', border: `1px solid ${border}` }} />
              </div>
              <Separator style={{ background: border }} />
              <div>
                <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium block mb-2">Industries</label>
                <div className="flex flex-wrap gap-1.5">
                  {INDUSTRY_OPTIONS.map(ind => (
                    <button key={ind}
                      className={`text-[10px] px-2.5 py-1.5 rounded-lg border transition-all duration-200 ${segIndustries.includes(ind)
                        ? 'bg-primary/15 border-primary/25 text-primary'
                        : 'hover:bg-gray-100'}`}
                      style={!segIndustries.includes(ind) ? { background: 'rgba(0,0,0,0.02)', border: `1px solid ${border}`, color: '#71717A' } : {}}
                      onClick={() => toggleIndustry(ind)}>{ind}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium block mb-2">Statuses</label>
                <div className="flex flex-wrap gap-1.5">
                  {STATUS_OPTIONS.map(st => (
                    <button key={st}
                      className={`text-[10px] px-2.5 py-1.5 rounded-lg border transition-all duration-200 capitalize ${segStatuses.includes(st)
                        ? 'bg-primary/15 border-primary/25 text-primary'
                        : 'hover:bg-gray-100'}`}
                      style={!segStatuses.includes(st) ? { background: 'rgba(0,0,0,0.02)', border: `1px solid ${border}`, color: '#71717A' } : {}}
                      onClick={() => toggleStatus(st)}>{st}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium block mb-2">Lead Score Range</label>
                <div className="flex items-center gap-3">
                  <Input type="number" value={segScoreMin} onChange={e => setSegScoreMin(e.target.value)}
                    className="h-8 w-20 text-xs" style={{ background: 'rgba(0,0,0,0.02)', border: `1px solid ${border}` }} min={0} max={100} />
                  <span className="text-xs text-muted-foreground">to</span>
                  <Input type="number" value={segScoreMax} onChange={e => setSegScoreMax(e.target.value)}
                    className="h-8 w-20 text-xs" style={{ background: 'rgba(0,0,0,0.02)', border: `1px solid ${border}` }} min={0} max={100} />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Checkbox checked={segIsStatic} onCheckedChange={(v) => setSegIsStatic(!!v)} className="h-4 w-4" />
                <label className="text-xs text-foreground">Static list (snapshot of matching contacts now)</label>
              </div>
              <Button className="w-full h-10 gap-2 text-sm font-medium"
                style={{ background: 'linear-gradient(135deg, #D4AF37, #E8C860)', color: '#000' }}
                onClick={handleCreate} disabled={createMutation.isPending || !segName.trim()}>
                {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                {createMutation.isPending ? 'Creating...' : 'Create Segment'}
              </Button>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* ── Detail Dialog ── */}
      <Dialog open={!!detailSegment} onOpenChange={() => setDetailSegment(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden" style={{ background: card, border: `1px solid ${border}` }}>
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <Layers className="w-4 h-4" style={{ color: gold }} />
              {detailSegment?.name}
              {detailSegment && (
                <Badge variant="outline" className="ml-2 text-[10px] bg-primary/10 text-primary border-primary/20">
                  {detailSegment.contactCount.toLocaleString()} contacts
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[65vh] pr-2">
            {detailLoading ? (
              <div className="space-y-3 py-4">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}</div>
            ) : detailContacts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Users className="w-8 h-8 text-muted-foreground/30 mb-2" />
                <p className="text-sm text-muted-foreground">No contacts match this segment</p>
              </div>
            ) : (
              <div className="space-y-1 pb-4">
                {detailContacts.map(c => (
                  <motion.div key={c.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="flex items-center gap-4 py-2.5 px-3 rounded-lg hover:bg-black/[0.02] transition-colors">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-foreground truncate">{c.rawName}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{c.email}</p>
                    </div>
                    <span className="text-[10px] text-muted-foreground truncate max-w-[120px]">{c.title || '\u2014'}</span>
                    <span className="text-[10px] text-muted-foreground truncate max-w-[120px]">{c.company}</span>
                    <span className={`text-[10px] font-bold tabular-nums w-6 text-right ${c.leadScore >= 70 ? 'text-emerald-600' : c.leadScore >= 40 ? 'text-amber-600' : 'text-red-600'}`}>
                      {c.leadScore}
                    </span>
                    <Badge variant="outline" className="text-[9px] h-4 px-1.5 bg-zinc-500/10 text-zinc-600 border-zinc-500/20 shrink-0">{c.status}</Badge>
                  </motion.div>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation ── */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => { if (!open) setDeleteConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Segment</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete segment &ldquo;{deleteConfirm?.name}&rdquo;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteConfirm && deleteMutation.mutate(deleteConfirm.id)} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
