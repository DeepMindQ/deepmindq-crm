'use client';

import { useState, useEffect } from 'react';
import { tokens } from '@/components/intelligence-os/design-tokens';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { EmptyState, LoadingSkeleton } from '@/components/ui/screen-states';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Search, Plus, Link2, Users, X } from 'lucide-react';

/* ── Types ── */
interface Relationship {
  id: string;
  contactA: string;
  contactB: string;
  organization: string;
  type: string;
  strength: 'strong' | 'moderate' | 'weak';
  lastInteraction: string;
  notes: string;
}

/* ── Mock data ── */
const INITIAL_RELATIONSHIPS: Relationship[] = [
  {
    id: '1',
    contactA: 'Sarah Chen',
    contactB: 'Marcus Johnson',
    organization: 'Acme Corp',
    type: 'Colleague',
    strength: 'strong',
    lastInteraction: '2 days ago',
    notes: 'Work closely on digital transformation initiative. Marcus champions our solution.',
  },
  {
    id: '2',
    contactA: 'Sarah Chen',
    contactB: 'Emily Rodriguez',
    organization: 'Acme Corp',
    type: 'Cross-functional',
    strength: 'moderate',
    lastInteraction: '1 week ago',
    notes: 'Emily is on the procurement committee. Need to build stronger relationship.',
  },
  {
    id: '3',
    contactA: 'David Kim',
    contactB: 'Marcus Johnson',
    organization: 'Acme Corp',
    type: 'Technical Advisor',
    strength: 'moderate',
    lastInteraction: '5 days ago',
    notes: 'David provides technical guidance to Marcus on platform decisions.',
  },
  {
    id: '4',
    contactA: 'Lisa Park',
    contactB: 'Tom Wright',
    organization: 'TechVenture Inc',
    type: 'Manager',
    strength: 'strong',
    lastInteraction: '1 day ago',
    notes: 'Lisa reports to Tom. Both are aligned on platform evaluation.',
  },
  {
    id: '5',
    contactA: 'John Smith',
    contactB: 'Anna Lee',
    organization: 'DataFlow Systems',
    type: 'Executive',
    strength: 'strong',
    lastInteraction: '3 days ago',
    notes: 'CEO and VP Data are both invested in the intelligence initiative.',
  },
  {
    id: '6',
    contactA: 'Amy Wong',
    contactB: 'Chris Taylor',
    organization: 'CloudPeak',
    type: 'Peer',
    strength: 'weak',
    lastInteraction: '2 weeks ago',
    notes: 'Both in engineering leadership. Chris is skeptical of new tools.',
  },
  {
    id: '7',
    contactA: 'Sarah Chen',
    contactB: 'Lisa Park',
    organization: 'Cross-account',
    type: 'Industry Connection',
    strength: 'weak',
    lastInteraction: '3 weeks ago',
    notes: 'Met at SaaStr conference. Potential referral opportunity.',
  },
  {
    id: '8',
    contactA: 'Marcus Johnson',
    contactB: 'Tom Wright',
    organization: 'Cross-account',
    type: 'Former Colleague',
    strength: 'strong',
    lastInteraction: '1 month ago',
    notes: 'Worked together at previous company. Strong mutual trust.',
  },
  {
    id: '9',
    contactA: 'Emily Rodriguez',
    contactB: 'Amy Wong',
    organization: 'Cross-account',
    type: 'Professional Network',
    strength: 'moderate',
    lastInteraction: '2 weeks ago',
    notes: 'Connected on LinkedIn. Both involved in procurement decisions.',
  },
  {
    id: '10',
    contactA: 'David Kim',
    contactB: 'Anna Lee',
    organization: 'Cross-account',
    type: 'Technical Peer',
    strength: 'moderate',
    lastInteraction: '1 week ago',
    notes: 'Share common interests in data architecture. Good for reference calls.',
  },
];

const RELATIONSHIP_TYPES = [
  'All',
  'Colleague',
  'Manager',
  'Cross-functional',
  'Executive',
  'Peer',
  'Technical Advisor',
  'Industry Connection',
  'Former Colleague',
  'Professional Network',
  'Technical Peer',
];

const STRENGTH_CONFIG: Record<string, { class: string; bar: string; barBg: string }> = {
  strong: {
    class: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
    bar: tokens.confidence.high.value,
    barBg: tokens.confidence.high.bg,
  },
  moderate: {
    class: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
    bar: tokens.confidence.medium.value,
    barBg: tokens.confidence.medium.bg,
  },
  weak: {
    class: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
    bar: tokens.confidence.low.value,
    barBg: tokens.confidence.low.bg,
  },
};

/* ── Component ── */
export default function RelationshipMemoryScreen() {
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');
  const [modalOpen, setModalOpen] = useState(false);
  const [formA, setFormA] = useState('');
  const [formB, setFormB] = useState('');
  const [formOrg, setFormOrg] = useState('');
  const [formType, setFormType] = useState('Colleague');
  const [formStrength, setFormStrength] = useState('moderate');
  const [formNotes, setFormNotes] = useState('');

  useEffect(() => {
    const t = setTimeout(() => {
      setRelationships(INITIAL_RELATIONSHIPS);
      setLoading(false);
    }, 500);
    return () => clearTimeout(t);
  }, []);

  const filtered = relationships.filter((r) => {
    const matchSearch =
      r.contactA.toLowerCase().includes(search.toLowerCase()) ||
      r.contactB.toLowerCase().includes(search.toLowerCase()) ||
      r.organization.toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === 'All' || r.type === typeFilter;
    return matchSearch && matchType;
  });

  const handleAdd = () => {
    if (!formA.trim() || !formB.trim()) return;
    const newRel: Relationship = {
      id: String(Date.now()),
      contactA: formA,
      contactB: formB,
      organization: formOrg,
      type: formType,
      strength: formStrength as 'strong' | 'moderate' | 'weak',
      lastInteraction: 'Just now',
      notes: formNotes,
    };
    setRelationships((prev) => [newRel, ...prev]);
    setModalOpen(false);
    setFormA('');
    setFormB('');
    setFormOrg('');
    setFormType('Colleague');
    setFormStrength('moderate');
    setFormNotes('');
  };

  const strengthBar = (strength: string) => {
    const w = strength === 'strong' ? 100 : strength === 'moderate' ? 60 : 30;
    const cfg = STRENGTH_CONFIG[strength];
    return (
      <div className="flex items-center gap-2 w-24">
        <div className="flex-1 h-1.5 rounded-full" style={{ backgroundColor: cfg.barBg }}>
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${w}%`, backgroundColor: cfg.bar }}
          />
        </div>
      </div>
    );
  };

  if (loading) return <LoadingSkeleton variant="table" />;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div
        className="flex items-center justify-between px-6 py-4 border-b"
        style={{ borderColor: tokens.border.default }}
      >
        <div className="flex items-center gap-3">
          <Link2 className="w-5 h-5" style={{ color: tokens.domain.reasoning }} />
          <div>
            <h1 className="text-lg font-semibold" style={{ color: tokens.text.primary }}>
              Relationship Memory
            </h1>
            <p className="text-xs" style={{ color: tokens.text.muted }}>
              Track and manage relationships across contacts and accounts
            </p>
          </div>
        </div>
        <Button onClick={() => setModalOpen(true)} size="sm">
          <Plus className="w-4 h-4 mr-1.5" /> Add Relationship
        </Button>
      </div>

      {/* Filters */}
      <div
        className="flex items-center gap-3 px-6 py-3 border-b"
        style={{ borderColor: tokens.borderFaint }}
      >
        <div className="relative flex-1 max-w-sm">
          <Search
            className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4"
            style={{ color: tokens.text.muted }}
          />
          <Input
            placeholder="Search contacts, organizations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
        <div className="flex gap-1.5 overflow-x-auto">
          {RELATIONSHIP_TYPES.map((type) => (
            <Button
              key={type}
              variant={typeFilter === type ? 'default' : 'ghost'}
              size="sm"
              className="h-8 text-xs shrink-0"
              onClick={() => setTypeFilter(type)}
            >
              {type}
            </Button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {filtered.length === 0 ? (
          <EmptyState
            icon="users"
            title="No relationships found"
            description={
              search || typeFilter !== 'All'
                ? 'Try adjusting your filters'
                : 'Add your first relationship'
            }
            action={
              <Button size="sm" onClick={() => setModalOpen(true)}>
                <Plus className="w-4 h-4 mr-1" /> Add Relationship
              </Button>
            }
          />
        ) : (
          <div className="p-6">
            <div
              className="rounded-lg border overflow-hidden"
              style={{ borderColor: tokens.border.default }}
            >
              <Table>
                <TableHeader>
                  <TableRow style={{ backgroundColor: tokens.surface.secondary }}>
                    <TableHead
                      className="text-xs font-medium"
                      style={{ color: tokens.text.secondary }}
                    >
                      Contact A
                    </TableHead>
                    <TableHead
                      className="text-xs font-medium"
                      style={{ color: tokens.text.secondary }}
                    >
                      Contact B
                    </TableHead>
                    <TableHead
                      className="text-xs font-medium"
                      style={{ color: tokens.text.secondary }}
                    >
                      Organization
                    </TableHead>
                    <TableHead
                      className="text-xs font-medium"
                      style={{ color: tokens.text.secondary }}
                    >
                      Relationship Type
                    </TableHead>
                    <TableHead
                      className="text-xs font-medium"
                      style={{ color: tokens.text.secondary }}
                    >
                      Strength
                    </TableHead>
                    <TableHead
                      className="text-xs font-medium"
                      style={{ color: tokens.text.secondary }}
                    >
                      Last Interaction
                    </TableHead>
                    <TableHead
                      className="text-xs font-medium"
                      style={{ color: tokens.text.secondary }}
                    >
                      Notes
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => (
                    <TableRow key={r.id} className="hover:bg-muted/50 transition-colors">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold"
                            style={{
                              backgroundColor: tokens.accent.subtle,
                              color: tokens.accent.DEFAULT,
                            }}
                          >
                            {r.contactA
                              .split(' ')
                              .map((n) => n[0])
                              .join('')}
                          </div>
                          <span
                            className="text-sm font-medium"
                            style={{ color: tokens.text.primary }}
                          >
                            {r.contactA}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold"
                            style={{
                              backgroundColor: tokens.domain.bg,
                              color: tokens.domain.reasoning,
                            }}
                          >
                            {r.contactB
                              .split(' ')
                              .map((n) => n[0])
                              .join('')}
                          </div>
                          <span
                            className="text-sm font-medium"
                            style={{ color: tokens.text.primary }}
                          >
                            {r.contactB}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm" style={{ color: tokens.text.secondary }}>
                        {r.organization}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {r.type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {strengthBar(r.strength)}
                          <span className="text-xs capitalize" style={{ color: tokens.text.muted }}>
                            {r.strength}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs" style={{ color: tokens.text.muted }}>
                        {r.lastInteraction}
                      </TableCell>
                      <TableCell className="max-w-48">
                        <p
                          className="text-xs truncate"
                          style={{ color: tokens.text.secondary }}
                          title={r.notes}
                        >
                          {r.notes}
                        </p>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </div>

      {/* Add Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-4 h-4" /> Add Relationship
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs">Contact A</Label>
                <Input
                  value={formA}
                  onChange={(e) => setFormA(e.target.value)}
                  placeholder="Name"
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Contact B</Label>
                <Input
                  value={formB}
                  onChange={(e) => setFormB(e.target.value)}
                  placeholder="Name"
                  className="h-9 text-sm"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs">Organization</Label>
                <Input
                  value={formOrg}
                  onChange={(e) => setFormOrg(e.target.value)}
                  placeholder="Company name"
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Relationship Type</Label>
                <select
                  value={formType}
                  onChange={(e) => setFormType(e.target.value)}
                  className="w-full h-9 rounded-md border bg-transparent px-3 text-sm"
                  style={{ borderColor: tokens.border.default, color: tokens.text.primary }}
                >
                  {RELATIONSHIP_TYPES.filter((t) => t !== 'All').map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Strength</Label>
              <div className="flex gap-2">
                {(['strong', 'moderate', 'weak'] as const).map((s) => (
                  <Button
                    key={s}
                    variant={formStrength === s ? 'default' : 'outline'}
                    size="sm"
                    className="h-8 text-xs capitalize"
                    onClick={() => setFormStrength(s)}
                  >
                    {s}
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Notes</Label>
              <textarea
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                placeholder="Context about this relationship..."
                rows={3}
                className="w-full rounded-md border bg-transparent px-3 py-2 text-sm resize-none"
                style={{ borderColor: tokens.border.default, color: tokens.text.primary }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAdd} disabled={!formA.trim() || !formB.trim()}>
              Add Relationship
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
