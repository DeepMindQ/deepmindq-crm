'use client';

import { useState, useEffect, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Mail, MailCheck, MailX, Clock, MinusCircle, Tag, TrendingUp, TrendingDown, Inbox } from 'lucide-react';
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
  contactName: string;
  companyName?: string;
  subject: string;
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
  negative: MailX,
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

  useEffect(() => {
    fetch('/api/replies')
      .then(r => r.json())
      .then(data => {
        const raw = Array.isArray(data) ? data : data.replies || [];
        const mapped = raw.map((r: any) => ({
          ...r,
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

  return (
    <PageTransition>
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
                  <TableRow className="border-white/[0.06] hover:bg-transparent">
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
                      return (
                        <StaggerItem key={reply.id}>
                          <TableRow
                            className="border-white/[0.04] transition-all duration-200 hover:bg-white/[0.03] group"
                            style={{
                              borderLeft: `3px solid transparent`,
                            }}
                            onMouseEnter={(e) => {
                              (e.currentTarget as HTMLElement).style.borderLeftColor = borderColor;
                            }}
                            onMouseLeave={(e) => {
                              (e.currentTarget as HTMLElement).style.borderLeftColor = 'transparent';
                            }}
                          >
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
                              {navigateTo && reply.category === 'unsubscribe' && (
                                <span
                                  onClick={(e) => { e.stopPropagation(); navigateTo('bounces'); }}
                                  className="text-xs text-muted-foreground cursor-pointer hover:text-primary transition-colors whitespace-nowrap"
                                >
                                  Add to Suppression
                                </span>
                              )}
                            </TableCell>
                          </TableRow>
                        </StaggerItem>
                      );
                    })}
                  </StaggerGrid>
                </TableBody>
              </Table>
            </div>
          )}
        </GlassPanel>
      </div>
    </PageTransition>
  );
}