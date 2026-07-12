'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Mail, MailCheck, MailX, Clock, MinusCircle, Tag } from 'lucide-react';

interface Reply {
  id: string;
  contactName: string;
  companyName?: string;
  subject: string;
  category: string;
  receivedAt: string;
  snippet?: string;
}

const CATEGORY_OPTIONS = [
  { value: 'all', label: 'All Categories' },
  { value: 'positive', label: 'Positive' },
  { value: 'negative', label: 'Negative' },
  { value: 'out_of_office', label: 'Out of Office' },
  { value: 'unsubscribe', label: 'Unsubscribe' },
  { value: 'other', label: 'Other' },
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

export default function RepliesScreen() {
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
          contactName: r.contact?.rawName || r.contactName || '—',
          companyName: r.contact?.company?.rawName || r.companyName || '—',
        })));
      })
      .catch(() => {})
      .finally(() => { setLoading(false); });
  }, [categoryFilter]);

  return (
    <div className="max-h-[calc(100vh-200px)] overflow-y-auto space-y-4 pr-1">
      {/* ── Category Filters ── */}
      <Card className="bg-card border border-border">
        <CardContent className="p-2">
          <div className="flex gap-1 flex-wrap">
            {CATEGORY_OPTIONS.map(c => (
              <Button
                key={c.value}
                variant={categoryFilter === c.value ? 'default' : 'ghost'}
                size="sm"
                className={`h-8 text-xs px-3 ${categoryFilter === c.value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                onClick={() => setCategoryFilter(c.value)}
              >
                {c.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── Count ── */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          <Mail className="w-3.5 h-3.5 inline mr-1.5" />
          <span className="text-primary font-medium tabular-nums">{replies.length}</span> replies
        </p>
      </div>

      {/* ── Replies Table ── */}
      <Card className="bg-card border border-border">
        <CardContent className="p-0">
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {replies.map(reply => {
                    const Icon = CATEGORY_ICONS[reply.category] || Mail;
                    return (
                      <TableRow key={reply.id} className="border-border">
                        <TableCell className="text-foreground text-sm font-medium">{reply.contactName}</TableCell>
                        <TableCell className="text-muted-foreground text-sm hidden sm:table-cell">{reply.companyName || '—'}</TableCell>
                        <TableCell className="text-foreground text-sm max-w-[240px] md:max-w-[320px] truncate">{reply.subject}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`gap-1 ${CATEGORY_COLORS[reply.category] || CATEGORY_COLORS.other}`}>
                            <Icon className="w-3 h-3" />
                            {reply.category.replace(/_/g, ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs text-right hidden md:table-cell whitespace-nowrap">{reply.receivedAt}</TableCell>
                      </TableRow>
                    );
                  })}
                  {replies.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-muted-foreground text-sm text-center py-8">
                        No replies found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}