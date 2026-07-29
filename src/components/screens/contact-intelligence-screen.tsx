'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Users, TrendingUp, AlertTriangle, RefreshCw, Flame, Snowflake, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { fetchApi } from '@/lib/fetchApi';
import { cn } from '@/lib/utils';

interface ContactIntel {
  total: number; tiers: { hot: number; warm: number; cold: number }; averageScore: number;
  contacts: Array<{ contactId: string; name: string; email: string; role: string; status: string; score: number; tier: string; topFactors: string[] }>;
}

const TIER_STYLES: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
  hot: { bg: 'from-red-500/10 to-orange-500/5', text: 'text-red-600', icon: <Flame className="h-4 w-4" /> },
  warm: { bg: 'from-amber-500/10 to-yellow-500/5', text: 'text-amber-600', icon: <Sun className="h-4 w-4" /> },
  cold: { bg: 'from-blue-500/10 to-cyan-500/5', text: 'text-blue-600', icon: <Snowflake className="h-4 w-4" /> },
};

export default function ContactIntelligenceScreen() {
  const [segment, setSegment] = useState<string>('all');
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['contact-intelligence', segment],
    queryFn: async (): Promise<ContactIntel> => {
      const res = await fetchApi<ContactIntel>('/api/ai/contact-intelligence' + (segment !== 'all' ? `?segment=${segment}` : ''));
      return res.data ?? { total: 0, tiers: { hot: 0, warm: 0, cold: 0 }, averageScore: 0, contacts: [] };
    },
    refetchInterval: 60000,
  });

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-orange-500 to-red-600 text-white"><Users className="h-5 w-5" /></div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Contact Intelligence</h1>
            <p className="text-sm text-muted-foreground">AI-powered contact scoring, tiering, and engagement analysis</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}><RefreshCw className="mr-2 h-3.5 w-3.5" /> Refresh</Button>
      </div>

      {isLoading && <div className="space-y-4"><Skeleton className="h-24 rounded-lg" /><Skeleton className="h-64 rounded-lg" /></div>}

      {data && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          {/* Tier Summary Cards */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5"><CardContent className="flex items-center gap-3 p-4"><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600"><Users className="h-4 w-4" /></div><div><div className="text-xs text-muted-foreground">Total Contacts</div><div className="text-xl font-bold">{data.total}</div></div></CardContent></Card>
            {(['hot', 'warm', 'cold'] as const).map(tier => (
              <Card key={tier} className={cn('bg-gradient-to-br', TIER_STYLES[tier].bg)}>
                <CardContent className="flex items-center gap-3 p-4">
                  <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', tier === 'hot' ? 'bg-red-100 text-red-600' : tier === 'warm' ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600')}>{TIER_STYLES[tier].icon}</div>
                  <div><div className="text-xs text-muted-foreground capitalize">{tier}</div><div className="text-xl font-bold">{data.tiers[tier]}</div></div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Segment filter */}
          <div className="flex gap-2">
            {['all', 'hot', 'warm', 'cold'].map(s => (
              <Button key={s} variant={segment === s ? 'default' : 'outline'} size="sm" onClick={() => setSegment(s)} className="capitalize">{s === 'all' ? 'All Contacts' : s}</Button>
            ))}
          </div>

          {/* Contact Table */}
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base font-semibold">Contacts ({data.contacts.length})</CardTitle></CardHeader>
            <CardContent>
              {data.contacts.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground"><Users className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" /><p>No contacts found</p></div>
              ) : (
                <div className="space-y-2">
                  {data.contacts.slice(0, 20).map((c, i) => (
                    <motion.div key={c.contactId} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }} className="flex items-center justify-between rounded-lg border p-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2"><span className="font-medium truncate">{c.name}</span><Badge variant="outline" className="text-xs">{c.status}</Badge></div>
                        <p className="text-xs text-muted-foreground">{c.email}{c.role ? ` · ${c.role}` : ''}</p>
                        <div className="mt-1 flex gap-1">{c.topFactors.slice(0, 3).map(f => <Badge key={f} variant="secondary" className="text-[11px] px-1 py-0">{f}</Badge>)}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className={cn('rounded-full px-3 py-1 text-sm font-bold', c.tier === 'hot' ? 'bg-red-100 text-red-700' : c.tier === 'warm' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700')}>{c.score}</div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
