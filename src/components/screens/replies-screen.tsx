'use client';

import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Mail, MailCheck, MailX, Clock, MinusCircle, Tag } from 'lucide-react';
import { motion } from 'framer-motion';
import { PageTransition, AnimatedCard, SectionHeader, TabBar } from '@/components/ui/animated-components';

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
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState('all');

  useEffect(() => {
    const params = categoryFilter !== 'all' ? `?category=${categoryFilter}` : '';
    fetch(`/api/replies${params}`)
      .then(r => r.json())
      .then(data => {
        const raw = Array.isArray(data) ? data : data.replies || [];
        setReplies(raw.map((r: any) => ({
          ...r,
          contactName: r.contact?.rawName || r.contactName || '-',
          companyName: r.contact?.company?.rawName || r.companyName || '-',
        })));
      })
      .catch(() => {})
      .finally(() => { setLoading(false); });
  }, [categoryFilter]);

  return (
    <PageTransition>
      <div className="max-h-[calc(100vh-200px)] overflow-y-auto space-y-4 pr-1">
        {/* Category Filters */}
        <TabBar
          tabs={CATEGORY_TABS}
          active={categoryFilter}
          onChange={setCategoryFilter}
        />

        {/* Count */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            <Mail className="w-3.5 h-3.5 inline mr-1.5" />
            <span className="text-primary font-medium tabular-nums">{replies.length}</span> replies
          </p>
        </div>

        {/* Replies Table */}
        <SectionHeader title="Replies" />

        <AnimatedCard hover={false}>
          <div className="p-0">
            {loading ? (
              <div className="p-6 space-y-3">
                {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border hover:bg-transparent">
                      <TableHead className="text-muted-foreground text-xs">Contact</TableHead>
                      <TableHead className="text-muted-foreground text-xs hidden sm:table-cell">Company</TableHead>
                      <TableHead className="text-muted-foreground text-xs">Subject</TableHead>
                      <TableHead className="text-muted-foreground text-xs">Category</TableHead>
                      <TableHead className="text-muted-foreground text-xs text-right hidden md:table-cell">Received At</TableHead>
                      <TableHead className="text-muted-foreground text-xs text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {replies.map(reply => {
                      const Icon = CATEGORY_ICONS[reply.category] || Mail;
                      return (
                        <TableRow key={reply.id} className="border-border">
                          <TableCell className="text-foreground text-sm font-medium">
                            <span>{reply.contactName}</span>
                            {navigateTo && (
                              <span
                                onClick={(e) => { e.stopPropagation(); navigateTo('leads'); }}
                                className="ml-2 text-xs text-muted-foreground cursor-pointer hover:text-primary transition-colors"
                              >View Contact</span>
                            )}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm hidden sm:table-cell">{reply.companyName || '-'}</TableCell>
                          <TableCell className="text-foreground text-sm max-w-[240px] md:max-w-[320px] truncate">{reply.subject}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`gap-1 ${CATEGORY_COLORS[reply.category] || CATEGORY_COLORS.other}`}>
                              <Icon className="w-3 h-3" />
                              {reply.category.replace(/_/g, ' ')}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-xs text-right hidden md:table-cell whitespace-nowrap">{reply.receivedAt}</TableCell>
                          <TableCell className="text-right">
                            {navigateTo && reply.category === 'unsubscribe' && (
                              <span
                                onClick={(e) => { e.stopPropagation(); navigateTo('bounces'); }}
                                className="text-xs text-muted-foreground cursor-pointer hover:text-primary transition-colors whitespace-nowrap"
                              >Add to Suppression</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {replies.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-muted-foreground text-sm text-center py-8">
                          No replies found.
                          {navigateTo && (
                            <span
                              onClick={() => navigateTo('queue')}
                              className="ml-2 text-xs text-primary cursor-pointer hover:text-primary/80 transition-colors"
                            >Send emails to start getting replies -&gt;</span>
                          )}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </AnimatedCard>
      </div>
    </PageTransition>
  );
}