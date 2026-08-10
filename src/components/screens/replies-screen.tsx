'use client';

import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Mail, MailCheck, Ban, Clock, MinusCircle, Tag, TrendingUp, TrendingDown, Inbox,
  Eye, MessageSquarePlus, ThumbsUp, ThumbsDown, ChevronDown, ChevronUp,
  User, Building2, Calendar, Search, X, Loader2,
} from 'lucide-react';
import { toast } from 'sonner';

/* ══════════════════════════════ Types ══════════════════════════════ */

interface Reply {
  id: string;
  contactId?: string;
  contactEmail?: string;
  contactName: string;
  companyName?: string;
  subject: string;
  body?: string;
  category: string;
  receivedAt: string;
  snippet?: string;
}

const CATEGORY_TABS = [
  { key: 'all', label: 'All' },
  { key: 'positive', label: 'Positive' },
  { key: 'negative', label: 'Negative' },
  { key: 'out_of_office', label: 'Out of Office' },
  { key: 'unsubscribe', label: 'Unsubscribe' },
  { key: 'other', label: 'Other' },
];

const CATEGORY_COLORS: Record<string, string> = {
  positive: 'bg-emerald-500/20 text-emerald-700 border-emerald-500/30',
  negative: 'bg-red-500/20 text-red-600 border-red-500/30',
  out_of_office: 'bg-amber-500/20 text-amber-700 border-amber-500/30',
  unsubscribe: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30',
  other: 'bg-blue-500/20 text-blue-700 border-blue-500/30',
};

const CATEGORY_ICONS: Record<string, typeof Mail> = {
  positive: MailCheck, negative: Ban, out_of_office: Clock,
  unsubscribe: MinusCircle, other: Mail,
};

/* ══════════════════════════════ Design Tokens ══════════════════════════════ */

const gold = 'var(--color-gold-dim)', goldLight = 'var(--color-gold)';
const card = 'var(--dmq-white-card)', border = 'var(--dmq-black-faint)';

function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/* ══════════════════════════════ Component ══════════════════════════════ */

export default function RepliesScreen({ navigateTo }: { navigateTo?: (screen: string) => void }) {
  const queryClient = useQueryClient();

  /* ── Data fetching ── */
  const { data: allReplies = [], isLoading } = useQuery<Reply[]>({
    queryKey: ['replies'],
    queryFn: () => fetch('/api/replies').then(r => r.json()).then(data => {
      const raw = Array.isArray(data) ? data : data.replies || [];
      return raw.map((r: any) => ({
        ...r,
        contactId: r.contact?.id || r.contactId,
        contactEmail: r.contact?.email || r.contactEmail,
        contactName: r.contact?.rawName || r.contactName || '-',
        companyName: r.contact?.company?.rawName || r.companyName || '-',
      }));
    }),
    staleTime: 15000,
  });

  /* ── Mutations ── */
  const markMutation = useMutation({
    mutationFn: ({ id, category }: { id: string; category: string }) =>
      fetch('/api/replies', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, category }) }).then(r => { if (!r.ok) throw new Error(); }),
    onSuccess: () => { toast.success('Category updated'); queryClient.invalidateQueries({ queryKey: ['replies'] }); setMarkDialog(null); },
    onError: () => toast.error('Failed to update category'),
  });

  const suppressMutation = useMutation({
    mutationFn: ({ email, contactId }: { email: string; contactId?: string }) =>
      fetch('/api/suppressions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, contactId }) }).then(r => { if (!r.ok) throw new Error(); }),
    onSuccess: () => { toast.success('Added to suppression list'); setSuppressReply(null); },
    onError: () => toast.error('Failed to suppress'),
  });

  const followUpMutation = useMutation({
    mutationFn: ({ contactId, replyId }: { contactId: string; replyId: string }) =>
      fetch('/api/drafts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contactId, inReplyToDraftId: replyId, tone: 'professional' }) }).then(r => r.json()),
    onSuccess: () => { toast.success('Follow-up draft created'); setFollowUpReply(null); navigateTo?.('email-studio'); },
    onError: () => toast.error('Failed to create follow-up'),
  });

  /* ── Local state ── */
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detailReply, setDetailReply] = useState<Reply | null>(null);
  const [followUpReply, setFollowUpReply] = useState<Reply | null>(null);
  const [markDialog, setMarkDialog] = useState<{ reply: Reply; category: string } | null>(null);
  const [suppressReply, setSuppressReply] = useState<Reply | null>(null);

  /* ── Derived ── */
  const replies = useMemo(() => {
    let filtered = categoryFilter === 'all' ? allReplies : allReplies.filter(r => r.category === categoryFilter);
    if (search) filtered = filtered.filter(r => r.contactName.toLowerCase().includes(search.toLowerCase()) || r.subject.toLowerCase().includes(search.toLowerCase()));
    return filtered;
  }, [allReplies, categoryFilter, search]);

  const stats = useMemo(() => ({
    total: allReplies.length,
    positive: allReplies.filter(r => r.category === 'positive').length,
    negative: allReplies.filter(r => r.category === 'negative').length,
  }), [allReplies]);

  const tabsWithCounts = useMemo(() => CATEGORY_TABS.map(tab => ({
    ...tab, count: tab.key === 'all' ? allReplies.length : allReplies.filter(r => r.category === tab.key).length,
  })), [allReplies]);

  /* ══════════════════════════════ Render ══════════════════════════════ */
  return (
    <TooltipProvider>
      <div className="max-h-[calc(100vh-200px)] overflow-y-auto space-y-5 pr-1">

        {/* ── KPI Cards ── */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { icon: Inbox, label: 'Total Replies', value: stats.total, color: gold },
            { icon: TrendingUp, label: 'Positive', value: stats.positive, color: 'var(--dmq-emerald)' },
            { icon: TrendingDown, label: 'Negative', value: stats.negative, color: 'var(--dmq-domain-risk)' },
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

        {/* ── Filters ── */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-1.5 flex-wrap">
            {tabsWithCounts.map(tab => (
              <button key={tab.key}
                className={`text-[11px] px-3 py-2.5 rounded-lg font-medium transition-all duration-200 ${
                  categoryFilter === tab.key
                    ? 'text-black'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                style={categoryFilter === tab.key
                  ? { background: 'linear-gradient(135deg, var(--dmq-gold), var(--dmq-gold-light))' }
                  : { background: 'var(--dmq-black-shadow)', border: `1px solid ${border}` }}
                onClick={() => setCategoryFilter(tab.key)}>
                {tab.label}
                <span className={`ml-1.5 tabular-nums ${categoryFilter === tab.key ? 'text-black/70' : 'text-muted-foreground/50'}`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search replies..."
              className="h-10 pl-8 pr-7 w-44 text-xs rounded-lg" style={{ background: card, border: `1px solid ${border}` }} />
            {search && <X className="w-3 h-3 absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground cursor-pointer hover:text-foreground" onClick={() => setSearch('')} />}
          </div>
        </div>

        {/* ── Replies Table ── */}
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-10 rounded-lg" />
            {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
          </div>
        ) : replies.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-16 text-center rounded-xl"
            style={{ background: card, border: `1px solid ${border}` }}>
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3" style={{ background: `${gold}15`, border: `1px solid ${gold}30` }}>
              <Mail className="w-6 h-6" style={{ color: gold }} />
            </div>
            <p className="text-sm font-medium text-foreground">{search ? 'No matching replies' : 'No replies yet'}</p>
            <p className="text-xs text-muted-foreground mt-1">{search ? 'Try a different search' : 'Replies will appear here when contacts respond'}</p>
          </motion.div>
        ) : (
          <div className="rounded-xl overflow-hidden" style={{ background: card, backdropFilter: 'blur(20px)', border: `1px solid ${border}` }}>
            <Table>
              <TableHeader>
                <TableRow style={{ borderBottom: `1px solid ${border}` }}>
                  <TableHead className="text-[11px] uppercase tracking-wider font-medium text-muted-foreground h-9">Contact</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider font-medium text-muted-foreground h-9">Subject</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider font-medium text-muted-foreground h-9">Category</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider font-medium text-muted-foreground h-9 w-28">Received</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider font-medium text-muted-foreground h-9 w-28">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {replies.map((reply, i) => {
                  const isExpanded = expandedId === reply.id;
                  const CatIcon = CATEGORY_ICONS[reply.category] || Mail;
                  const catColor = CATEGORY_COLORS[reply.category] || CATEGORY_COLORS.other;
                  return (
                    <React.Fragment key={reply.id}>
                      <motion.tr
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                        className={`cursor-pointer transition-colors ${isExpanded ? 'bg-black/[0.02]' : 'hover:bg-black/[0.01]'}`}
                        onClick={() => setExpandedId(isExpanded ? null : reply.id)}
                        style={{ borderBottom: `1px solid ${border}` }}>
                        <TableCell className="py-2.5">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-black/[0.03] text-[11px] font-bold text-muted-foreground">
                              {(reply.contactName || '?')[0].toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-medium text-foreground truncate max-w-[160px]">{reply.contactName}</p>
                              <p className="text-[11px] text-muted-foreground truncate max-w-[160px]">{reply.companyName}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="py-2.5">
                          <p className="text-xs text-foreground truncate max-w-[220px]">{reply.subject}</p>
                          {reply.snippet && <p className="text-[11px] text-muted-foreground truncate max-w-[220px] mt-0.5">{reply.snippet}</p>}
                        </TableCell>
                        <TableCell className="py-2.5">
                          <Badge variant="outline" className={`text-[9px] ${catColor} whitespace-nowrap`}>
                            <CatIcon className="w-2.5 h-2.5 mr-1" />{reply.category.replace(/_/g, ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-2.5">
                          <span className="text-[11px] text-muted-foreground tabular-nums whitespace-nowrap">{fmtDate(reply.receivedAt)}</span>
                        </TableCell>
                        <TableCell className="py-2.5">
                          <div className="flex items-center gap-1">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <motion.button whileTap={{ scale: 0.9 }} onClick={(e) => { e.stopPropagation(); setDetailReply(reply); }}
                                  className="w-10 h-10 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-black/[0.03]">
                                  <Eye className="w-3 h-3" />
                                </motion.button>
                              </TooltipTrigger>
                              <TooltipContent><span>View</span></TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <motion.button whileTap={{ scale: 0.9 }}
                                  onClick={(e) => { e.stopPropagation(); setFollowUpReply(reply); }}
                                  className="w-10 h-10 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-black/[0.03]">
                                  <MessageSquarePlus className="w-3 h-3" />
                                </motion.button>
                              </TooltipTrigger>
                              <TooltipContent><span>Follow-up</span></TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <motion.button whileTap={{ scale: 0.9 }}
                                  onClick={(e) => { e.stopPropagation(); setSuppressReply(reply); }}
                                  className="w-10 h-10 rounded-lg flex items-center justify-center text-muted-foreground hover:text-red-600 hover:bg-red-50">
                                  <Ban className="w-3 h-3" />
                                </motion.button>
                              </TooltipTrigger>
                              <TooltipContent><span>Suppress</span></TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <motion.button whileTap={{ scale: 0.9 }}
                                  onClick={(e) => { e.stopPropagation(); setMarkDialog({ reply, category: 'positive' }); }}
                                  className="w-10 h-10 rounded-lg flex items-center justify-center text-muted-foreground hover:text-emerald-600 hover:bg-emerald-50">
                                  <ThumbsUp className="w-3 h-3" />
                                </motion.button>
                              </TooltipTrigger>
                              <TooltipContent><span>Mark Positive</span></TooltipContent>
                            </Tooltip>
                          </div>
                        </TableCell>
                      </motion.tr>
                      {/* Expanded row */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.tr initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }}>
                            <td colSpan={5} className="px-6 pb-4 pt-1" style={{ borderBottom: `1px solid ${border}` }}>
                              <div className="rounded-lg p-4" style={{ background: 'rgba(0,0,0,0.015)', border: `1px solid ${border}` }}>
                                <div className="flex items-center gap-3 mb-3">
                                  <User className="w-3.5 h-3.5 text-muted-foreground" />
                                  <span className="text-[11px] text-muted-foreground">{reply.contactName} &lt;{reply.contactEmail}&gt;</span>
                                  {reply.companyName && (
                                    <><Building2 className="w-3 h-3 text-muted-foreground" /><span className="text-[11px] text-muted-foreground">{reply.companyName}</span></>
                                  )}
                                </div>
                                {reply.body ? (
                                  <div className="text-xs text-foreground leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto">{reply.body}</div>
                                ) : (
                                  <p className="text-xs text-muted-foreground italic">Full body not available</p>
                                )}
                              </div>
                            </td>
                          </motion.tr>
                        )}
                      </AnimatePresence>
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        {/* ── Detail Dialog ── */}
        <Dialog open={!!detailReply} onOpenChange={() => setDetailReply(null)}>
          <DialogContent className="max-w-2xl max-h-[70vh] overflow-y-auto" style={{ background: card, border: `1px solid ${border}` }}>
            {detailReply && (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Mail className="w-4 h-4" style={{ color: gold }} />
                    {detailReply.subject}
                  </DialogTitle>
                  <DialogDescription className="flex items-center gap-2 text-xs">
                    <User className="w-3 h-3" />{detailReply.contactName} &lt;{detailReply.contactEmail}&gt;
                    <Building2 className="w-3 h-3 ml-1" />{detailReply.companyName}
                    <Calendar className="w-3 h-3 ml-1" />{fmtDate(detailReply.receivedAt)}
                  </DialogDescription>
                </DialogHeader>
                <div className="rounded-lg p-4" style={{ background: 'rgba(0,0,0,0.015)', border: `1px solid ${border}` }}>
                  {detailReply.body ? (
                    <div className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{detailReply.body}</div>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">Full body not available</p>
                  )}
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" size="sm" className="gap-1.5 text-xs"
                    onClick={() => { setDetailReply(null); setFollowUpReply(detailReply); }}>
                    <MessageSquarePlus className="w-3 h-3" /> Follow Up
                  </Button>
                  <Button variant="outline" size="sm" className="gap-1.5 text-xs"
                    onClick={() => { setDetailReply(null); setSuppressReply(detailReply); }}>
                    <Ban className="w-3 h-3" /> Suppress
                  </Button>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* ── Follow-up Dialog ── */}
        <Dialog open={!!followUpReply} onOpenChange={() => setFollowUpReply(null)}>
          <DialogContent style={{ background: card, border: `1px solid ${border}` }}>
            <DialogHeader>
              <DialogTitle>Create Follow-up Draft</DialogTitle>
              <DialogDescription>Generate AI follow-up for {followUpReply?.contactName}</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setFollowUpReply(null)}>Cancel</Button>
              <Button onClick={() => followUpReply && followUpMutation.mutate({ contactId: followUpReply.contactId!, replyId: followUpReply.id })}
                disabled={followUpMutation.isPending || !followUpReply?.contactId}
                style={{ background: 'linear-gradient(135deg, var(--dmq-gold), var(--dmq-gold-light))', color: 'var(--dmq-black)' }}>
                {followUpMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Generate Draft'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── Mark Category Dialog ── */}
        <Dialog open={!!markDialog} onOpenChange={() => setMarkDialog(null)}>
          <DialogContent style={{ background: card, border: `1px solid ${border}` }}>
            <DialogHeader>
              <DialogTitle>Update Category</DialogTitle>
              <DialogDescription>Change the category for this reply</DialogDescription>
            </DialogHeader>
            <div className="flex flex-wrap gap-2">
              {CATEGORY_TABS.filter(t => t.key !== 'all').map(tab => (
                <Button key={tab.key} variant={markDialog?.category === tab.key ? 'default' : 'outline'} size="sm" className="text-xs"
                  onClick={() => markDialog && setMarkDialog({ ...markDialog, category: tab.key })}>
                  {tab.label}
                </Button>
              ))}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setMarkDialog(null)}>Cancel</Button>
              <Button onClick={() => markDialog && markMutation.mutate({ id: markDialog.reply.id, category: markDialog.category })}
                disabled={markMutation.isPending}
                style={{ background: 'linear-gradient(135deg, var(--dmq-gold), var(--dmq-gold-light))', color: 'var(--dmq-black)' }}>
                {markMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Update'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── Suppress Dialog ── */}
        <AlertDialog open={!!suppressReply} onOpenChange={() => setSuppressReply(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Suppress Contact</AlertDialogTitle>
              <AlertDialogDescription>
                Add {suppressReply?.contactEmail} to the suppression list? They will no longer receive emails.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => suppressReply && suppressMutation.mutate({ email: suppressReply.contactEmail!, contactId: suppressReply.contactId })}
                disabled={suppressMutation.isPending} className="bg-red-600 hover:bg-red-700">
                {suppressMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Suppress'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  );
}
