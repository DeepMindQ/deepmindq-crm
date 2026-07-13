'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { PageTransition, AnimatedCard, SectionHeader, TabBar } from '@/components/ui/animated-components';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { MailX, ShieldOff, Trash2, AlertTriangle } from 'lucide-react';

interface BounceEntry {
  id: string;
  contactName: string;
  companyName?: string;
  bounceType: string;
  reason?: string;
  date: string;
}

interface SuppressionEntry {
  id: string;
  contactName: string;
  companyName?: string;
  reason: string;
  createdAt: string;
}

const BOUNCE_TYPE_COLORS: Record<string, string> = {
  hard: 'bg-red-500/20 text-red-300 border-red-500/30',
  soft: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
};

export default function BouncesScreen({ navigateTo }: { navigateTo?: (screen: string) => void }) {
  const [bounces, setBounces] = useState<BounceEntry[]>([]);
  const [suppressions, setSuppressions] = useState<SuppressionEntry[]>([]);
  const [loadingBounces, setLoadingBounces] = useState(true);
  const [loadingSuppressions, setLoadingSuppressions] = useState(true);
  const [activeTab, setActiveTab] = useState('bounces');

  useEffect(() => {
    fetch('/api/bounces')
      .then(r => r.json())
      .then(d => {
        const raw = Array.isArray(d) ? d : d.bounces || [];
        setBounces(raw.map((b: any) => ({
          ...b,
          contactName: b.contact?.rawName || b.contactName || '-',
          companyName: b.contact?.company?.rawName || b.companyName || '-',
          date: b.bouncedAt || b.date,
        })));
        setLoadingBounces(false);
      })
      .catch(() => setLoadingBounces(false));

    fetch('/api/suppressions')
      .then(r => r.json())
      .then(d => {
        const raw = Array.isArray(d) ? d : d.suppressions || [];
        setSuppressions(raw.map((s: any) => ({
          ...s,
          contactName: s.contact?.rawName || s.contactName || '-',
          companyName: s.contact?.company?.rawName || s.companyName || '-',
        })));
        setLoadingSuppressions(false);
      })
      .catch(() => setLoadingSuppressions(false));
  }, []);

  const handleRemoveSuppression = async (id: string) => {
    try {
      await fetch('/api/suppressions', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      setSuppressions(prev => prev.filter(s => s.id !== id));
    } catch { /* ignore */ }
  };

  return (
    <PageTransition>
    <div className="max-h-[calc(100vh-200px)] overflow-y-auto space-y-4 pr-1">
      <SectionHeader title="Bounces & Suppressions" />
      <TabBar
        tabs={[
          { key: 'bounces', label: 'Bounces', count: bounces.length },
          { key: 'suppressions', label: 'Suppressions', count: suppressions.length },
        ]}
        active={activeTab}
        onChange={setActiveTab}
      />

      {activeTab === 'bounces' && (
        <AnimatedCard hover={false}>
          <div className="px-4 pt-4">
            <div className="flex items-center gap-2 mb-3">
              <MailX className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold text-foreground">Bounces</span>
              <Badge variant="outline" className="ml-1 bg-primary/15 text-primary border-primary/30 text-[10px]">
                {bounces.length}
              </Badge>
            </div>
            {loadingBounces ? (
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border hover:bg-transparent">
                      <TableHead className="text-muted-foreground text-xs">Contact</TableHead>
                      <TableHead className="text-muted-foreground text-xs hidden sm:table-cell">Company</TableHead>
                      <TableHead className="text-muted-foreground text-xs">Bounce Type</TableHead>
                      <TableHead className="text-muted-foreground text-xs hidden md:table-cell">Reason</TableHead>
                      <TableHead className="text-muted-foreground text-xs text-right hidden lg:table-cell">Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bounces.map(b => (
                      <TableRow key={b.id} className="border-border">
                        <TableCell className="text-foreground text-sm font-medium">{b.contactName}</TableCell>
                        <TableCell className="text-muted-foreground text-sm hidden sm:table-cell">{b.companyName || '-'}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={
                            b.bounceType === 'hard'
                              ? BOUNCE_TYPE_COLORS.hard
                              : BOUNCE_TYPE_COLORS.soft
                          }>
                            <AlertTriangle className="w-3 h-3 mr-1" />
                            {b.bounceType}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm hidden md:table-cell max-w-[200px] truncate">{b.reason || '-'}</TableCell>
                        <TableCell className="text-muted-foreground text-xs text-right hidden lg:table-cell whitespace-nowrap">{b.date}</TableCell>
                      </TableRow>
                    ))}
                    {bounces.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-muted-foreground text-sm text-center py-8">
                          No bounces recorded.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </AnimatedCard>
      )}

      {activeTab === 'suppressions' && (
        <AnimatedCard hover={false}>
          <div className="px-4 pt-4">
            <div className="flex items-center gap-2 mb-3">
              <ShieldOff className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold text-foreground">Suppressions</span>
              <Badge variant="outline" className="ml-1 bg-primary/15 text-primary border-primary/30 text-[10px]">
                {suppressions.length}
              </Badge>
            </div>
            {loadingSuppressions ? (
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border hover:bg-transparent">
                      <TableHead className="text-muted-foreground text-xs">Contact</TableHead>
                      <TableHead className="text-muted-foreground text-xs hidden sm:table-cell">Company</TableHead>
                      <TableHead className="text-muted-foreground text-xs hidden md:table-cell">Reason</TableHead>
                      <TableHead className="text-muted-foreground text-xs text-right hidden lg:table-cell">Created Date</TableHead>
                      <TableHead className="text-muted-foreground text-xs text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {suppressions.map(s => (
                      <TableRow key={s.id} className="border-border">
                        <TableCell className="text-foreground text-sm font-medium">{s.contactName}</TableCell>
                        <TableCell className="text-muted-foreground text-sm hidden sm:table-cell">{s.companyName || '-'}</TableCell>
                        <TableCell className="text-muted-foreground text-sm hidden md:table-cell max-w-[240px] truncate">{s.reason}</TableCell>
                        <TableCell className="text-muted-foreground text-xs text-right hidden lg:table-cell whitespace-nowrap">{s.createdAt}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10"
                            onClick={() => handleRemoveSuppression(s.id)}
                          >
                            <Trash2 className="w-3.5 h-3.5 mr-1" />
                            Remove
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {suppressions.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-muted-foreground text-sm text-center py-8">
                          No suppressions.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </AnimatedCard>
      )}
    </div>
    </PageTransition>
  );
}