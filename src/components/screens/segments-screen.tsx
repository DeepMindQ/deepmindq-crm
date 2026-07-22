'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PageTransition, AnimatedCard, SectionHeader, StatCard,
  StaggerGrid, StaggerItem, GlassPanel, EmptyState, ShimmerText,
} from '@/components/ui/animated-components';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel } from '@/components/ui/alert-dialog';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Layers, Plus, Trash2, ChevronRight, Users, Search, X, Loader2,
  Send, Filter, ArrowLeft, Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';

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

/* ══════════════════════════════ Component ══════════════════════════════ */

export default function SegmentsScreen({ navigateTo }: { navigateTo?: (screen: string) => void }) {
  /* ── Load segments ── */
  const [segments, setSegments] = useState<Segment[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [detailSegment, setDetailSegment] = useState<Segment | null>(null);
  const [detailContacts, setDetailContacts] = useState<SegmentContact[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);

  const fetchSegments = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/segments');
      const data = await res.json();
      setSegments(Array.isArray(data) ? data : []);
    } catch { toast.error('Failed to load segments'); }
    setLoading(false);
  };

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

  /* ── Load segments ── */
  useEffect(() => {
    fetchSegments();
  }, []);

  /* ── Create segment ── */
  const handleCreate = async () => {
    if (!segName.trim()) { toast.error('Segment name is required'); return; }
    setCreating(true);
    try {
      const filters: any = {};
      if (segIndustries.length > 0) filters.industry = segIndustries;
      if (segStatuses.length > 0) filters.status = segStatuses;
      if (segScoreMin !== '0' || segScoreMax !== '100') filters.scoreRange = [parseInt(segScoreMin), parseInt(segScoreMax)];

      const res = await fetch('/api/segments', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: segName, description: segDesc || undefined, filters, isStatic: segIsStatic }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Segment "${segName}" created with ${data.contactCount} contacts`);
        setCreateOpen(false);
        setSegName(''); setSegDesc('');
        setSegIndustries([]); setSegStatuses([]);
        setSegScoreMin('0'); setSegScoreMax('100');
        setSegIsStatic(false);
        fetchSegments();
      } else { toast.error(data.error || 'Failed to create segment'); }
    } catch { toast.error('Failed to create segment'); }
    setCreating(false);
  };

  /* ── Delete segment ── */
  const handleDelete = async (id: string, name: string) => {
    try {
      await fetch(`/api/segments?id=${id}`, { method: 'DELETE' });
      toast.success('Segment deleted');
      fetchSegments();
    } catch { toast.error('Failed to delete segment'); }
  };

  /* ── View segment contacts ── */
  const openSegment = async (seg: Segment) => {
    setDetailSegment(seg);
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/segments/${seg.id}/contacts`);
      const data = await res.json();
      setDetailContacts(data.contacts || []);
    } catch { toast.error('Failed to load contacts'); }
    setDetailLoading(false);
  };

  const toggleIndustry = (v: string) => {
    setSegIndustries(prev => prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v]);
  };
  const toggleStatus = (v: string) => {
    setSegStatuses(prev => prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v]);
  };

  return (
    <PageTransition>
      <div className="max-h-[calc(100vh-200px)] overflow-y-auto space-y-8 pr-1 pb-8">

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard label="Total Segments" value={loading ? '-' : segments.length} icon={Layers} color="var(--color-gold)" delay={0} />
          <StatCard label="Total Contacts" value={loading ? '-' : segments.reduce((s, seg) => s + seg.contactCount, 0)} icon={Users} color="#10B981" delay={0.08} />
          <StatCard label="Dynamic Lists" value={loading ? '-' : segments.filter(s => !s.isStatic).length} icon={Filter} color="#6366F1" delay={0.16} />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between">
          <SectionHeader title="Lead Segments" subtitle={`${segments.length} segment${segments.length !== 1 ? 's' : ''}`} />
          <Button
            className="h-9 gap-2 text-xs font-medium"
            style={{ background: 'linear-gradient(135deg, #D4AF37, #E8C860)', color: '#000' }}
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="w-4 h-4" />
            New Segment
          </Button>
        </div>

        {/* Segment Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-36 rounded-xl" />)}
          </div>
        ) : segments.length === 0 ? (
          <EmptyState icon={Layers} title="No segments yet" description="Create your first segment to organize leads by criteria." />
        ) : (
          <StaggerGrid className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {segments.map(seg => {
              const parsedFilters = JSON.parse(seg.filters || '{}');
              const filterSummary = [
                parsedFilters.industry?.length ? `${parsedFilters.industry.length} industries` : '',
                parsedFilters.status?.length ? `${parsedFilters.status.length} statuses` : '',
                parsedFilters.scoreRange ? `Score ${parsedFilters.scoreRange[0]}-${parsedFilters.scoreRange[1]}` : '',
              ].filter(Boolean).join(' · ') || 'No filters';

              return (
                <StaggerItem key={seg.id}>
                  <motion.div
                    className="rounded-xl cursor-pointer relative group/seg"
                    whileHover={{ y: -4, transition: { duration: 0.25 } }}
                    onClick={() => openSegment(seg)}
                  >
                    <div className="absolute -inset-[2px] rounded-xl opacity-0 group-hover/seg:opacity-100 transition-all duration-500 blur-md"
                      style={{ background: 'linear-gradient(135deg, rgba(212,175,55,0.3), rgba(212,175,55,0.05), transparent 70%)' }}
                    />
                    <div className="relative rounded-xl p-[1px]"
                      style={{ background: 'linear-gradient(135deg, rgba(212,175,55,0.2), rgba(212,175,55,0.05) 40%, transparent)' }}
                    >
                      <div className="rounded-xl bg-card p-5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-foreground truncate group-hover/seg:text-primary transition-colors">{seg.name}</p>
                            <p className="text-[11px] text-muted-foreground mt-1 truncate">{filterSummary}</p>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <Badge variant="outline" className={`${seg.isStatic ? 'bg-emerald-50 text-emerald-700 border-emerald-500/20' : 'bg-purple-50 text-purple-700 border-purple-500/20'} text-[10px]`}>
                              {seg.isStatic ? 'Static' : 'Dynamic'}
                            </Badge>
                          </div>
                        </div>
                        <div className="mt-4 flex items-center justify-between">
                          <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                            <Users className="w-3.5 h-3.5" /> {seg.contactCount} contacts
                          </span>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost" size="sm" className="h-7 text-[10px] text-muted-foreground hover:text-red-600 px-2"
                              onClick={(e) => { e.stopPropagation(); setDeleteConfirm({ id: seg.id, name: seg.name }); }}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                            <ChevronRight className="w-4 h-4 text-muted-foreground/40" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                </StaggerItem>
              );
            })}
          </StaggerGrid>
        )}

        {/* Create Segment Dialog */}
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent className="bg-card/95 backdrop-blur-xl border-gray-200 text-foreground max-w-lg max-h-[85vh] overflow-hidden">
            <DialogHeader>
              <DialogTitle className="text-base flex items-center gap-2">
                <Plus className="w-4 h-4 text-primary" />
                Create Segment
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">Define filters to create a lead segment</DialogDescription>
            </DialogHeader>
            <ScrollArea className="max-h-[65vh] pr-2">
              <div className="space-y-5 pb-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">Segment Name</label>
                  <Input value={segName} onChange={e => setSegName(e.target.value)} placeholder="e.g. SaaS Decision Makers" className="h-9 text-sm bg-gray-50 border-gray-200" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">Description (optional)</label>
                  <Input value={segDesc} onChange={e => setSegDesc(e.target.value)} placeholder="What this segment is for..." className="h-9 text-sm bg-gray-50 border-gray-200" />
                </div>
                <Separator className="bg-gray-100" />
                <div>
                  <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium block mb-2">Industries</label>
                  <div className="flex flex-wrap gap-1.5">
                    {INDUSTRY_OPTIONS.map(ind => (
                      <button key={ind}
                        className={`text-[10px] px-2.5 py-1.5 rounded-lg border transition-all duration-200 ${segIndustries.includes(ind) ? 'bg-primary/15 border-primary/25 text-primary' : 'bg-gray-50 border-gray-200 text-muted-foreground hover:bg-gray-100'}`}
                        onClick={() => toggleIndustry(ind)}
                      >{ind}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium block mb-2">Statuses</label>
                  <div className="flex flex-wrap gap-1.5">
                    {STATUS_OPTIONS.map(st => (
                      <button key={st}
                        className={`text-[10px] px-2.5 py-1.5 rounded-lg border transition-all duration-200 capitalize ${segStatuses.includes(st) ? 'bg-primary/15 border-primary/25 text-primary' : 'bg-gray-50 border-gray-200 text-muted-foreground hover:bg-gray-100'}`}
                        onClick={() => toggleStatus(st)}
                      >{st}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium block mb-2">Lead Score Range</label>
                  <div className="flex items-center gap-3">
                    <Input type="number" value={segScoreMin} onChange={e => setSegScoreMin(e.target.value)} className="h-8 w-20 text-xs bg-gray-50 border-gray-200" min={0} max={100} />
                    <span className="text-xs text-muted-foreground">to</span>
                    <Input type="number" value={segScoreMax} onChange={e => setSegScoreMax(e.target.value)} className="h-8 w-20 text-xs bg-gray-50 border-gray-200" min={0} max={100} />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Checkbox checked={segIsStatic} onCheckedChange={(v) => setSegIsStatic(!!v)} className="h-4 w-4" />
                  <label className="text-xs text-foreground">Static list (snapshot of matching contacts now)</label>
                </div>
                <Button
                  className="w-full h-10 gap-2 text-sm font-medium"
                  style={{ background: 'linear-gradient(135deg, #D4AF37, #E8C860)', color: '#000' }}
                  onClick={handleCreate} disabled={creating || !segName.trim()}
                >
                  {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  {creating ? 'Creating...' : 'Create Segment'}
                </Button>
              </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>

        {/* Segment Detail Dialog */}
        <Dialog open={!!detailSegment} onOpenChange={() => { setDetailSegment(null); setDetailContacts([]); }}>
          <DialogContent className="bg-card/95 backdrop-blur-xl border-gray-200 text-foreground max-w-3xl max-h-[85vh] overflow-hidden">
            <DialogHeader>
              <DialogTitle className="text-base flex items-center gap-2">
                <ArrowLeft className="w-4 h-4 text-muted-foreground cursor-pointer" onClick={() => setDetailSegment(null)} />
                <Layers className="w-4 h-4 text-primary" />
                {detailSegment?.name}
                <Badge variant="outline" className="ml-2 text-[10px] bg-primary/10 text-primary border-primary/20">
                  {detailSegment?.contactCount} contacts
                </Badge>
              </DialogTitle>
            </DialogHeader>
            <ScrollArea className="max-h-[65vh] pr-2">
              {detailLoading ? (
                <div className="space-y-3 py-4">
                  {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
                </div>
              ) : detailContacts.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No contacts match this segment</p>
              ) : (
                <div className="space-y-1.5 pb-4">
                  {detailContacts.map(c => (
                    <div key={c.id} className="flex items-center gap-4 py-2.5 px-3 rounded-lg hover:bg-gray-50 transition-colors">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-foreground truncate">{c.rawName}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{c.email}</p>
                      </div>
                      <span className="text-[10px] text-muted-foreground truncate max-w-[120px]">{c.title || '-'}</span>
                      <span className="text-[10px] text-muted-foreground truncate max-w-[120px]">{c.company}</span>
                      <span className={`text-[10px] font-bold tabular-nums w-6 text-right ${c.leadScore >= 70 ? 'text-emerald-600' : c.leadScore >= 40 ? 'text-amber-600' : 'text-red-600'}`}>
                        {c.leadScore}
                      </span>
                      <Badge variant="outline" className="text-[9px] h-4 px-1.5 bg-zinc-500/10 text-zinc-600 border-zinc-500/20 shrink-0">{c.status}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </DialogContent>
        </Dialog>

        {/* Delete confirmation dialog */}
        <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => { if (!open) setDeleteConfirm(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Segment</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete segment "{deleteConfirm?.name}"? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => { if (deleteConfirm) { handleDelete(deleteConfirm.id, deleteConfirm.name); setDeleteConfirm(null); } }}>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </PageTransition>
  );
}