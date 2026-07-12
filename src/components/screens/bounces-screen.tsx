'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MailX, ShieldOff, Trash2, AlertTriangle, Building2, Calendar } from 'lucide-react';

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

export default function BouncesScreen() {
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
          contactName: b.contact?.rawName || b.contactName || '—',
          companyName: b.contact?.company?.rawName || b.companyName || '—',
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
          contactName: s.contact?.rawName || s.contactName || '—',
          companyName: s.contact?.company?.rawName || s.companyName || '—',
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

  const renderBounces = () => (
    <Card className="bg-card border border-border">
      <CardHeader className="pb-3 pt-4 px-4">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <MailX className="w-4 h-4 text-primary" />
          Bounces
          <Badge variant="outline" className="ml-1 bg-primary/15 text-primary border-primary/30 text-[10px]">
            {bounces.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">
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
                    <TableCell className="text-muted-foreground text-sm hidden sm:table-cell">{b.companyName || '—'}</TableCell>
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
                    <TableCell className="text-muted-foreground text-sm hidden md:table-cell max-w-[200px] truncate">{b.reason || '—'}</TableCell>
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
      </CardContent>
    </Card>
  );

  const renderSuppressions = () => (
    <Card className="bg-card border border-border">
      <CardHeader className="pb-3 pt-4 px-4">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <ShieldOff className="w-4 h-4 text-primary" />
          Suppressions
          <Badge variant="outline" className="ml-1 bg-primary/15 text-primary border-primary/30 text-[10px]">
            {suppressions.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">
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
                    <TableCell className="text-muted-foreground text-sm hidden sm:table-cell">{s.companyName || '—'}</TableCell>
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
      </CardContent>
    </Card>
  );

  return (
    <div className="max-h-[calc(100vh-200px)] overflow-y-auto space-y-4 pr-1">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <Card className="bg-card border border-border">
          <CardContent className="p-1">
            <TabsList className="bg-transparent h-9 p-0 gap-1">
              <TabsTrigger
                value="bounces"
                className="h-8 text-xs px-4 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-md"
              >
                <MailX className="w-3.5 h-3.5 mr-1.5" />
                Bounces
                {bounces.length > 0 && (
                  <Badge variant="outline" className="ml-1.5 bg-primary/15 text-primary border-primary/30 text-[10px] px-1.5 py-0">
                    {bounces.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger
                value="suppressions"
                className="h-8 text-xs px-4 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-md"
              >
                <ShieldOff className="w-3.5 h-3.5 mr-1.5" />
                Suppressions
                {suppressions.length > 0 && (
                  <Badge variant="outline" className="ml-1.5 bg-primary/15 text-primary border-primary/30 text-[10px] px-1.5 py-0">
                    {suppressions.length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>
          </CardContent>
        </Card>

        <TabsContent value="bounces" className="mt-4">
          {renderBounces()}
        </TabsContent>
        <TabsContent value="suppressions" className="mt-4">
          {renderSuppressions()}
        </TabsContent>
      </Tabs>
    </div>
  );
}