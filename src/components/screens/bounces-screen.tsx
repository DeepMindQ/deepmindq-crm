'use client';

import { useState, useEffect } from 'react';
import {
  PageTransition,
  AnimatedCard,
  SectionHeader,
  TabBar,
  StatCard,
  GlassPanel,
  EmptyState,
  StaggerGrid,
  StaggerItem,
  PulseDot,
} from '@/components/ui/animated-components';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Ban, ShieldOff, Trash2, AlertTriangle, TrendingDown, ShieldAlert } from 'lucide-react';

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
  hard: 'bg-red-500/20 text-red-600 border-red-500/30',
  soft: 'bg-amber-500/20 text-amber-700 border-amber-500/30',
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
    } catch (err) { console.error('[Bounces] remove suppression failed:', err); }
  };

  const hardBounces = bounces.filter(b => b.bounceType === 'hard').length;
  const softBounces = bounces.filter(b => b.bounceType === 'soft').length;

  return (
    <PageTransition>
      <div className="max-h-[calc(100vh-120px)] overflow-y-auto space-y-8 pr-1 pb-8">

        {/* Page Header */}
        <div className="flex items-start justify-between">
          <div>
            <SectionHeader
              title="Bounces & Suppressions"
              subtitle="Monitor email delivery failures and manage contact suppression lists"
              className="mb-0"
            />
          </div>
          <div className="flex items-center gap-2 pt-2">
            <PulseDot color="#EF4444" />
            <span className="text-xs text-muted-foreground">Live monitoring</span>
          </div>
        </div>

        {/* Stat Cards */}
        <StaggerGrid className="grid grid-cols-2 lg:grid-cols-4 gap-4" stagger={0.08}>
          <StaggerItem>
            <StatCard
              label="Total Bounces"
              value={bounces.length}
              icon={TrendingDown}
              color="#EF4444"
              delay={0}
            />
          </StaggerItem>
          <StaggerItem>
            <StatCard
              label="Hard Bounces"
              value={hardBounces}
              icon={Ban}
              color="#F97316"
              delay={0.08}
            />
          </StaggerItem>
          <StaggerItem>
            <StatCard
              label="Soft Bounces"
              value={softBounces}
              icon={AlertTriangle}
              color="#FBBF24"
              delay={0.16}
            />
          </StaggerItem>
          <StaggerItem>
            <StatCard
              label="Suppressions"
              value={suppressions.length}
              icon={ShieldAlert}
              color="#A855F7"
              delay={0.24}
            />
          </StaggerItem>
        </StaggerGrid>

        {/* Tabs */}
        <div className="pt-2">
          <TabBar
            tabs={[
              { key: 'bounces', label: 'Bounces', count: bounces.length },
              { key: 'suppressions', label: 'Suppressions', count: suppressions.length },
            ]}
            active={activeTab}
            onChange={setActiveTab}
          />
        </div>

        {/* Bounces Table */}
        {activeTab === 'bounces' && (
          <GlassPanel className="overflow-hidden">
            <div className="px-6 pt-5 pb-2">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-lg bg-red-50 flex items-center justify-center">
                  <Ban className="w-4.5 h-4.5 text-red-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-foreground">Bounce Log</h3>
                  <p className="text-xs text-muted-foreground">All recorded email bounces across campaigns</p>
                </div>
                <Badge variant="outline" className="bg-red-50 text-red-600 border-red-500/20 text-xs px-3 py-1">
                  {bounces.length} entries
                </Badge>
              </div>
            </div>

            {loadingBounces ? (
              <div className="px-6 pb-6 space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full rounded-lg" />
                ))}
              </div>
            ) : bounces.length === 0 ? (
              <EmptyState
                icon={Ban}
                title="No bounces recorded"
                description="All emails have been delivered successfully. Bounces will appear here if any are detected."
                className="pb-4"
              />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border/50 hover:bg-transparent">
                      <TableHead className="text-muted-foreground text-xs font-semibold uppercase tracking-wider pl-6">Contact</TableHead>
                      <TableHead className="text-muted-foreground text-xs font-semibold uppercase tracking-wider hidden sm:table-cell">Company</TableHead>
                      <TableHead className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">Bounce Type</TableHead>
                      <TableHead className="text-muted-foreground text-xs font-semibold uppercase tracking-wider hidden md:table-cell">Reason</TableHead>
                      <TableHead className="text-muted-foreground text-xs font-semibold uppercase tracking-wider text-right hidden lg:table-cell">Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bounces.map(b => (
                      <TableRow
                        key={b.id}
                        className="border-border/30 hover:bg-gray-50 transition-colors duration-200 group"
                      >
                        <TableCell className="pl-6 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="w-[3px] h-8 rounded-full bg-red-500/0 group-hover:bg-red-500 transition-colors duration-300" />
                            <span className="text-foreground text-sm font-medium">{b.contactName}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm hidden sm:table-cell py-3.5">{b.companyName || '-'}</TableCell>
                        <TableCell className="py-3.5">
                          <Badge variant="outline" className={
                            b.bounceType === 'hard'
                              ? BOUNCE_TYPE_COLORS.hard
                              : BOUNCE_TYPE_COLORS.soft
                          }>
                            <AlertTriangle className="w-3 h-3 mr-1" />
                            {b.bounceType}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm hidden md:table-cell max-w-[200px] truncate py-3.5">{b.reason || '-'}</TableCell>
                        <TableCell className="text-muted-foreground text-xs text-right hidden lg:table-cell whitespace-nowrap py-3.5">{b.date}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            <div className="h-2" />
          </GlassPanel>
        )}

        {/* Suppressions Table */}
        {activeTab === 'suppressions' && (
          <GlassPanel className="overflow-hidden">
            <div className="px-6 pt-5 pb-2">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-lg bg-purple-50 flex items-center justify-center">
                  <ShieldOff className="w-4.5 h-4.5 text-purple-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-foreground">Suppression List</h3>
                  <p className="text-xs text-muted-foreground">Contacts excluded from future email sends</p>
                </div>
                <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-500/20 text-xs px-3 py-1">
                  {suppressions.length} contacts
                </Badge>
              </div>
            </div>

            {loadingSuppressions ? (
              <div className="px-6 pb-6 space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full rounded-lg" />
                ))}
              </div>
            ) : suppressions.length === 0 ? (
              <EmptyState
                icon={ShieldOff}
                title="No suppressions"
                description="There are no suppressed contacts. Suppressions are added automatically when hard bounces are detected."
                className="pb-4"
              />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border/50 hover:bg-transparent">
                      <TableHead className="text-muted-foreground text-xs font-semibold uppercase tracking-wider pl-6">Contact</TableHead>
                      <TableHead className="text-muted-foreground text-xs font-semibold uppercase tracking-wider hidden sm:table-cell">Company</TableHead>
                      <TableHead className="text-muted-foreground text-xs font-semibold uppercase tracking-wider hidden md:table-cell">Reason</TableHead>
                      <TableHead className="text-muted-foreground text-xs font-semibold uppercase tracking-wider text-right hidden lg:table-cell">Created Date</TableHead>
                      <TableHead className="text-muted-foreground text-xs font-semibold uppercase tracking-wider text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {suppressions.map(s => (
                      <TableRow
                        key={s.id}
                        className="border-border/30 hover:bg-gray-50 transition-colors duration-200 group"
                      >
                        <TableCell className="pl-6 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="w-[3px] h-8 rounded-full bg-purple-500/0 group-hover:bg-purple-500 transition-colors duration-300" />
                            <span className="text-foreground text-sm font-medium">{s.contactName}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm hidden sm:table-cell py-3.5">{s.companyName || '-'}</TableCell>
                        <TableCell className="text-muted-foreground text-sm hidden md:table-cell max-w-[240px] truncate py-3.5">{s.reason}</TableCell>
                        <TableCell className="text-muted-foreground text-xs text-right hidden lg:table-cell whitespace-nowrap py-3.5">{s.createdAt}</TableCell>
                        <TableCell className="text-right py-3.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 text-xs text-red-600 hover:text-red-600 hover:bg-red-50 gap-1.5"
                            onClick={() => handleRemoveSuppression(s.id)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Remove</span>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            <div className="h-2" />
          </GlassPanel>
        )}

      </div>
    </PageTransition>
  );
}