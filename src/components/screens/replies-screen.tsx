'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Mail, MailCheck, Ban, Clock, MinusCircle, Tag, TrendingUp, TrendingDown, Inbox,
  Eye, MessageSquarePlus, ThumbsUp, ThumbsDown, ShieldBan, ChevronDown, ChevronUp,
  User, Building2, Calendar,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  PageTransition,
  SectionHeader,
  TabBar,
  StatCard,
  GlassPanel,
  EmptyState,
  StaggerGrid,
  StaggerItem,
  PulseDot,
} from '@/components/ui/animated-components';

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
  positive: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  negative: 'bg-red-500/20 text-red-300 border-red-500/30',
  out_of_office: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  unsubscribe: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30',
  other: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
};

const CATEGORY_BORDER_COLORS: Record<string, string> = {
  positive: '#10b981',
  negative: '#ef4444',
  out_of_office: '#f59e0b',
  unsubscribe: '#71717a',
  other: '#3b82f6',
};

const CATEGORY_ICONS: Record<string, typeof Tag> = {
  positive: MailCheck,
  negative: Ban,
  out_of_office: Clock,
  unsubscribe: MinusCircle,
  other: Mail,
};

interface RepliesScreenProps {
  navigateTo?: (screen: string) => void;
}

export default function RepliesScreen({ navigateTo }: RepliesScreenProps) {
  const [replies, setReplies] = useState<Reply[]>([]);
  const [allReplies, setAllReplies] = useState<Reply[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState('all');

  // Expanded row state
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Detail modal state
  const [detailReply, setDetailReply] = useState<Reply | null>(null);

  // Follow-up dialog state
  const [followUpReply, setFollowUpReply] = useState<Reply | null>(null);
  const [followUpLoading, setFollowUpLoading] = useState(false);

  // Mark category dialog
  const [markDialog, setMarkDialog] = useState<{ reply: Reply; category: string } | null>(null);
  const [markLoading, setMarkLoading] = useState(false);

  // Suppress dialog
  const [suppressReply, setSuppressReply] = useState<Reply | null>(null);
  const [suppressLoading, setSuppressLoading] = useState(false);

  const loadReplies = useCallback(() => {
    fetch('/api/replies')
      .then(r => r.json())
      .then(data => {
        const raw = Array.isArray(data) ? data : data.replies || [];
        const mapped = raw.map((r: any) => ({
          ...r,
          contactId: r.contact?.id || r.contactId,
          contactEmail: r.contact?.email || r.contactEmail,
          contactName: r.contact?.rawName || r.contactName || '-',
          companyName: r.contact?.company?.rawName || r.companyName || '-',
        }));
        setAllReplies(mapped);
        setReplies(mapped);
      })
      .catch(() => {})
      .finally(() => { setLoading(false); });
  }, []);

  useEffect(() => {
    loadReplies();
  }, [loadReplies]);

  useEffect(() => {
    if (categoryFilter === 'all') {
      setReplies(allReplies);
    } else {
      setReplies(allReplies.filter(r => r.category === categoryFilter));
    }
  }, [categoryFilter, allReplies]);

  const stats = useMemo(() => {
    const total = allReplies.length;
    const positive = allReplies.filter(r => r.category === 'positive').length;
    const negative = allReplies.filter(r => r.category === 'negative').length;
    return { total, positive, negative };
  }, [allReplies]);

  const tabsWithCounts = useMemo(() => {
    return CATEGORY_TABS.map(tab => ({
      ...tab,
      count: tab.key === 'all'
        ? allReplies.length
        : allReplies.filter(r => r.category === tab.key).length,
    }));
  }, [allReplies]);

  // Toggle row expand
  const toggleExpand = (reply: Reply) => {
    setExpandedId(prev => prev === reply.id ? null : reply.id);
  };

  // Handle double-click to open detail
  const handleRowDblClick = (reply: Reply) => {
    setDetailReply(reply);
  };

  // Create Follow-Up
  const handleCreateFollowUp = async () => {
    if (!followUpReply) return;
    setFollowUpLoading(true);
    try {
      const res = await fetch('/api/drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactId: followUpReply.contactId,
          inReplyToDraftId: followUpReply.id,
          tone: 'professional',
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('Follow-up draft created successfully');
        setFollowUpReply(null);
        if (navigateTo) navigateTo('drafts');
      } else {
        toast.error(data.error || 'Failed to create follow-up draft');
      }
    } catch {
      toast.error('Failed to create follow-up draft');
    }
    setFollowUpLoading(false);
  };

  // Mark Category
  const handleMarkCategory = async () => {
    if (!markDialog) return;
    setMarkLoading(true);
    try {
      const res = await fetch('/api/replies', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: markDialog.reply.id, category: markDialog.category }),
      });
      if (res.ok) {
        toast.success(`Reply marked as ${markDialog.category.replace(/_/g, ' ')}`);
        setMarkDialog(null);
        loadReplies();
      } else {
        toast.error('Failed to update reply category');
      }
    } catch {
      toast.error('Failed to update reply category');
    }
    setMarkLoading(false);
  };

  // Add to Suppression
  const handleSuppress = async () => {
    if (!suppressReply) return;
    setSuppressLoading(true);
    try {
      const res = await fetch('/api/suppressions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: suppressReply.contactEmail, contactId: suppressReply.contactId }),
      });
      if (res.ok) {
        toast.success('Added to suppression list');
        setSuppressReply(null);
      } else {
        toast.error('Failed to add to suppression list');
      }
    } catch {
      toast.error('Failed to add to suppression list');
    }
    setSuppressLoading(false);
  };

  return (
    <PageTransition>
      <TooltipProvider>
        <div className="max-h-[calc(100vh-200px)] overflow-y-auto pr-1 space-y-8">

          {/* Header Section */}
          <div className="space-y-1">
            <SectionHeader title="Replies" subtitle="Track and manage all incoming email responses" />
          </div>

          {/* Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard
              label="Total Replies"
              value={stats.total}
              icon={Inbox}
              color="#D4AF37"
              delay={0}
            />
            <StatCard
              label="Positive"
              value={stats.positive}
              icon={TrendingUp}
              color="#10b981"
              delay={0.1}
            />
            <StatCard
              label="Negative"
              value={stats.negative}
              icon={TrendingDown}
              color="#ef4444"
              delay={0.2}
            />
          </div>

          {/* Category Filters */}
          <TabBar
            tabs={tabsWithCounts}
            active={categoryFilter}
            onChange={setCategoryFilter}
          />

          {/* Replies Table */}
          <SectionHeader
            title={categoryFilter === 'all' ? 'All Replies' : `${CATEGORY_TABS.find(t => t.key === categoryFilter)?.label ?? 'Filtered'} Replies`}
            subtitle={`${replies.length} response${replies.length !== 1 ? 's' : ''} found`}
          />

          <GlassPanel>
            {loading ? (
              <div className="p-6 space-y-4">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <Skeleton className="h-4 w-32 rounded" />
                    <Skeleton className="h-4 w-24 rounded hidden sm:block" />
                    <Skeleton className="h-4 w-48 rounded flex-1" />
                    <Skeleton className="h-6 w-20 rounded-full" />
                  </div>
                ))}
              </div>
            ) : replies.length === 0 ? (
              <EmptyState
                icon={Mail}
                title="No replies found"
                description="Send emails to start getting responses."
                action={
                  navigateTo ? (
                    <span
                      onClick={() => navigateTo('queue')}
                      className="text-sm text-primary cursor-pointer hover:text-primary/80 transition-colors font-medium"
                    >
                      Go to Queue &rarr;
                    </span>
                  ) : undefined
                }
              />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-gray-200 hover:bg-transparent">
                      <TableHead className="text-muted-foreground text-xs font-medium uppercase tracking-wider w-8" />
                      <TableHead className="text-muted-foreground text-xs font-medium uppercase tracking-wider">Contact</TableHead>
                      <TableHead className="text-muted-foreground text-xs font-medium uppercase tracking-wider hidden sm:table-cell">Company</TableHead>
                      <TableHead className="text-muted-foreground text-xs font-medium uppercase tracking-wider">Subject</TableHead>
                      <TableHead className="text-muted-foreground text-xs font-medium uppercase tracking-wider">Category</TableHead>
                      <TableHead className="text-muted-foreground text-xs font-medium uppercase tracking-wider text-right hidden md:table-cell">Received</TableHead>
                      <TableHead className="text-muted-foreground text-xs font-medium uppercase tracking-wider text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <StaggerGrid stagger={0.04}>
                      {replies.map(reply => {
                        const Icon = CATEGORY_ICONS[reply.category] || Mail;
                        const borderColor = CATEGORY_BORDER_COLORS[reply.category] || CATEGORY_BORDER_COLORS.other;
                        const isExpanded = expandedId === reply.id;
                        const isSuppressee = reply.category === 'unsubscribe' || reply.category === 'negative';
                        return (
                          <StaggerItem key={reply.id}>
                            <>
                              <TableRow
                                className="border-gray-200 transition-all duration-200 hover:bg-gray-50 group cursor-pointer"
                                style={{
                                  borderLeft: `3px solid ${isExpanded ? borderColor : 'transparent'}`,
                                }}
                                onMouseEnter={(e) => {
                                  if (!isExpanded) {
                                    (e.currentTarget as HTMLElement).style.borderLeftColor = borderColor;
                                  }
                                }}
                                onMouseLeave={(e) => {
                                  if (!isExpanded) {
                                    (e.currentTarget as HTMLElement).style.borderLeftColor = 'transparent';
                                  }
                                }}
                                onClick={() => toggleExpand(reply)}
                                onDoubleClick={() => handleRowDblClick(reply)}
                              >
                                {/* Expand chevron */}
                                <TableCell className="py-3.5 w-8 px-2">
                                  <motion.div
                                    animate={{ rotate: isExpanded ? 180 : 0 }}
                                    transition={{ duration: 0.2 }}
                                    className="text-muted-foreground"
                                  >
                                    <ChevronDown className="w-3.5 h-3.5" />
                                  </motion.div>
                                </TableCell>
                                <TableCell className="text-foreground text-sm font-medium py-3.5">
                                  <div className="flex items-center gap-2">
                                    <PulseDot color={borderColor} />
                                    <span>{reply.contactName}</span>
                                  </div>
                                  {navigateTo && (
                                    <span
                                      onClick={(e) => { e.stopPropagation(); navigateTo('leads'); }}
                                      className="ml-7 text-xs text-muted-foreground cursor-pointer hover:text-primary transition-colors"
                                    >
                                      View Contact
                                    </span>
                                  )}
                                </TableCell>
                                <TableCell className="text-muted-foreground text-sm hidden sm:table-cell py-3.5">
                                  {reply.companyName || '-'}
                                </TableCell>
                                <TableCell className="text-foreground text-sm max-w-[240px] md:max-w-[320px] truncate py-3.5 group-hover:text-foreground/90 transition-colors">
                                  {reply.subject}
                                </TableCell>
                                <TableCell className="py-3.5">
                                  <Badge variant="outline" className={`gap-1 text-[11px] ${CATEGORY_COLORS[reply.category] || CATEGORY_COLORS.other}`}>
                                    <Icon className="w-3 h-3" />
                                    {reply.category.replace(/_/g, ' ')}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-muted-foreground text-xs text-right hidden md:table-cell whitespace-nowrap py-3.5">
                                  {reply.receivedAt}
                                </TableCell>
                                <TableCell className="text-right py-3.5">
                                  <div className="flex items-center justify-end gap-0.5">
                                    {/* View detail */}
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                                          onClick={(e) => { e.stopPropagation(); setDetailReply(reply); }}
                                        >
                                          <Eye className="w-3.5 h-3.5" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>View Details</TooltipContent>
                                    </Tooltip>

                                    {/* Create Follow-Up */}
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-7 w-7 p-0 text-primary/70 hover:text-primary hover:bg-primary/10"
                                          onClick={(e) => { e.stopPropagation(); setFollowUpReply(reply); }}
                                        >
                                          <MessageSquarePlus className="w-3.5 h-3.5" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>Create Follow-Up</TooltipContent>
                                    </Tooltip>

                                    {/* Mark Positive */}
                                    {reply.category !== 'positive' && (
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-7 w-7 p-0 text-emerald-600/70 hover:text-emerald-600 hover:bg-emerald-50"
                                            onClick={(e) => { e.stopPropagation(); setMarkDialog({ reply, category: 'positive' }); }}
                                          >
                                            <ThumbsUp className="w-3.5 h-3.5" />
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>Mark Positive</TooltipContent>
                                      </Tooltip>
                                    )}

                                    {/* Mark Negative */}
                                    {reply.category !== 'negative' && (
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-7 w-7 p-0 text-red-600/70 hover:text-red-600 hover:bg-red-50"
                                            onClick={(e) => { e.stopPropagation(); setMarkDialog({ reply, category: 'negative' }); }}
                                          >
                                            <ThumbsDown className="w-3.5 h-3.5" />
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>Mark Negative</TooltipContent>
                                      </Tooltip>
                                    )}

                                    {/* Add to Suppression */}
                                    {isSuppressee && (
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-7 w-7 p-0 text-zinc-400/70 hover:text-zinc-300 hover:bg-zinc-500/10"
                                            onClick={(e) => { e.stopPropagation(); setSuppressReply(reply); }}
                                          >
                                            <ShieldBan className="w-3.5 h-3.5" />
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>Add to Suppression</TooltipContent>
                                      </Tooltip>
                                    )}

                                    {/* Legacy suppression link for non-unsubscribe */}
                                    {navigateTo && reply.category === 'unsubscribe' && (
                                      <span
                                        onClick={(e) => { e.stopPropagation(); navigateTo('bounces'); }}
                                        className="text-xs text-muted-foreground cursor-pointer hover:text-primary transition-colors whitespace-nowrap ml-1"
                                      >
                                        Suppression
                                      </span>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>

                              {/* Expandable Body Row */}
                              <TableRow className="border-0 p-0 hover:bg-transparent">
                                <TableCell colSpan={7} className="p-0 border-0">
                                  <AnimatePresence>
                                    {isExpanded && (
                                      <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                                        className="overflow-hidden"
                                      >
                                        <div
                                          className="mx-4 mb-4 mt-1 rounded-lg border border-gray-200 bg-gray-50 backdrop-blur-sm p-4 text-sm text-muted-foreground leading-relaxed"
                                          style={{ boxShadow: 'inset 0 1px 0 rgba(0, 0, 0, 0.03)' }}
                                        >
                                          <p className="text-xs text-muted-foreground/60 uppercase tracking-wider font-medium mb-2">Reply Body</p>
                                          <div className="whitespace-pre-wrap break-words max-h-48 overflow-y-auto custom-scrollbar">
                                            {reply.body || reply.snippet || 'No body content available.'}
                                          </div>
                                        </div>
                                      </motion.div>
                                    )}
                                  </AnimatePresence>
                                </TableCell>
                              </TableRow>
                            </>
                          </StaggerItem>
                        );
                      })}
                    </StaggerGrid>
                  </TableBody>
                </Table>
              </div>
            )}
          </GlassPanel>

          {/* Custom scrollbar styles */}
          <style>{`
            .custom-scrollbar::-webkit-scrollbar { width: 4px; }
            .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
            .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(0, 0, 0, 0.06); border-radius: 2px; }
            .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(0, 0, 0, 0.08); }
          `}</style>
        </div>

        {/* ── Reply Detail Modal ── */}
        <Dialog open={!!detailReply} onOpenChange={(open) => { if (!open) setDetailReply(null); }}>
          <DialogContent className="sm:max-w-lg border-gray-200 bg-[#12141E] backdrop-blur-xl">
            {detailReply && (
              <>
                <DialogHeader>
                  <DialogTitle className="text-foreground text-base">Reply Details</DialogTitle>
                  <DialogDescription className="text-muted-foreground">
                    Full reply information and actions
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 mt-2">
                  {/* Contact Info */}
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <User className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-muted-foreground">Name:</span>
                      <span className="text-foreground font-medium">{detailReply.contactName}</span>
                    </div>
                    {detailReply.contactEmail && (
                      <div className="flex items-center gap-2 text-sm">
                        <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-muted-foreground">Email:</span>
                        <span className="text-foreground font-medium">{detailReply.contactEmail}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-sm">
                      <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-muted-foreground">Company:</span>
                      <span className="text-foreground font-medium">{detailReply.companyName || '-'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-muted-foreground">Received:</span>
                      <span className="text-foreground font-medium">{detailReply.receivedAt}</span>
                    </div>
                  </div>

                  {/* Category Badge */}
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Category:</span>
                    <Badge variant="outline" className={`gap-1 text-[11px] ${CATEGORY_COLORS[detailReply.category] || CATEGORY_COLORS.other}`}>
                      {(() => { const Ic = CATEGORY_ICONS[detailReply.category] || Mail; return <Ic className="w-3 h-3" />; })()}
                      {detailReply.category.replace(/_/g, ' ')}
                    </Badge>
                  </div>

                  {/* Subject */}
                  <div>
                    <p className="text-xs text-muted-foreground/60 uppercase tracking-wider font-medium mb-1.5">Subject</p>
                    <p className="text-sm text-foreground font-medium">{detailReply.subject}</p>
                  </div>

                  {/* Body */}
                  <div>
                    <p className="text-xs text-muted-foreground/60 uppercase tracking-wider font-medium mb-1.5">Body</p>
                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap break-words max-h-64 overflow-y-auto custom-scrollbar">
                      {detailReply.body || detailReply.snippet || 'No body content available.'}
                    </div>
                  </div>
                </div>
                <DialogFooter className="gap-2 mt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-primary/30 text-primary hover:bg-primary/10 gap-1.5"
                    onClick={() => {
                      setDetailReply(null);
                      setFollowUpReply(detailReply);
                    }}
                  >
                    <MessageSquarePlus className="w-3.5 h-3.5" />
                    Create Follow-Up Draft
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDetailReply(null)}
                  >
                    Close
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* ── Follow-Up Confirmation Dialog ── */}
        <AlertDialog open={!!followUpReply} onOpenChange={(open) => { if (!open) setFollowUpReply(null); }}>
          <AlertDialogContent className="border-gray-200 bg-[#12141E] backdrop-blur-xl">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-foreground">Create Follow-Up Draft</AlertDialogTitle>
              <AlertDialogDescription className="text-muted-foreground">
                Generate a professional follow-up draft in reply to{' '}
                <span className="text-foreground font-medium">{followUpReply?.contactName}</span>&apos;s email.
                You will be redirected to the Drafts screen to review and edit it.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="gap-2">
              <AlertDialogCancel className="border-gray-200 text-muted-foreground hover:text-foreground">
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                className="bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={handleCreateFollowUp}
                disabled={followUpLoading}
              >
                {followUpLoading ? (
                  <div className="w-3.5 h-3.5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                ) : null}
                Create Draft
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* ── Mark Category Confirmation Dialog ── */}
        <AlertDialog open={!!markDialog} onOpenChange={(open) => { if (!open) setMarkDialog(null); }}>
          <AlertDialogContent className="border-gray-200 bg-[#12141E] backdrop-blur-xl">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-foreground">
                Mark as {markDialog?.category.replace(/_/g, ' ') || ''}
              </AlertDialogTitle>
              <AlertDialogDescription className="text-muted-foreground">
                Are you sure you want to reclassify{' '}
                <span className="text-foreground font-medium">{markDialog?.reply.contactName}</span>&apos;s reply
                as <span className="font-medium" style={{ color: markDialog?.category === 'positive' ? '#10b981' : '#ef4444' }}>
                  {markDialog?.category?.replace(/_/g, ' ')}
                </span>?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="gap-2">
              <AlertDialogCancel className="border-gray-200 text-muted-foreground hover:text-foreground" disabled={markLoading}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                className={markDialog?.category === 'positive'
                  ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                  : 'bg-red-600 text-white hover:bg-red-500'
                }
                onClick={handleMarkCategory}
                disabled={markLoading}
              >
                {markLoading && (
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                )}
                Confirm
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* ── Suppress Confirmation Dialog ── */}
        <AlertDialog open={!!suppressReply} onOpenChange={(open) => { if (!open) setSuppressReply(null); }}>
          <AlertDialogContent className="border-gray-200 bg-[#12141E] backdrop-blur-xl">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-foreground">Add to Suppression List</AlertDialogTitle>
              <AlertDialogDescription className="text-muted-foreground">
                This will add <span className="text-foreground font-medium">{suppressReply?.contactEmail || suppressReply?.contactName}</span>
                {' '}to the suppression list. They will no longer receive emails from future campaigns.
                This action cannot be easily undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="gap-2">
              <AlertDialogCancel className="border-gray-200 text-muted-foreground hover:text-foreground" disabled={suppressLoading}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                className="bg-zinc-600 text-white hover:bg-zinc-500"
                onClick={handleSuppress}
                disabled={suppressLoading}
              >
                {suppressLoading && (
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                )}
                Add to Suppression
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </TooltipProvider>
    </PageTransition>
  );
}