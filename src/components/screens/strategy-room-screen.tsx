'use client';

import { useState, useEffect } from 'react';
import { tokens } from '@/components/intelligence-os/design-tokens';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { EmptyState, LoadingSkeleton } from '@/components/ui/screen-states';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  MapPin,
  Users,
  Radio,
  StickyNote,
  CheckSquare,
  Plus,
  Trash2,
  ChevronDown,
  Building2,
  Target,
  Shield,
  AlertTriangle,
  TrendingUp,
  Briefcase,
} from 'lucide-react';

/* ── Types ── */
interface Account {
  id: string;
  name: string;
  industry: string;
  revenue: string;
  stage: string;
  arr: string;
  riskLevel: 'low' | 'medium' | 'high';
}

interface Contact {
  id: string;
  name: string;
  title: string;
  relationship: string;
  lastContact: string;
}

interface Signal {
  id: string;
  title: string;
  source: string;
  date: string;
  impact: 'positive' | 'negative' | 'neutral';
}

interface ActionItem {
  id: string;
  text: string;
  completed: boolean;
  assignee: string;
  dueDate: string;
}

interface CompetitorPosition {
  name: string;
  strength: 'strong' | 'moderate' | 'weak';
  notes: string;
}

/* ── Mock data ── */
const ACCOUNTS: Account[] = [
  {
    id: '1',
    name: 'Acme Corp',
    industry: 'SaaS',
    revenue: '$120M',
    stage: 'Active Eval',
    arr: '$1.2M',
    riskLevel: 'medium',
  },
  {
    id: '2',
    name: 'TechVenture Inc',
    industry: 'FinTech',
    revenue: '$85M',
    stage: 'Discovery',
    arr: '$480K',
    riskLevel: 'low',
  },
  {
    id: '3',
    name: 'DataFlow Systems',
    industry: 'Data',
    revenue: '$200M',
    stage: 'Demo',
    arr: '$2.1M',
    riskLevel: 'high',
  },
  {
    id: '4',
    name: 'CloudPeak',
    industry: 'Cloud',
    revenue: '$95M',
    stage: 'Prospecting',
    arr: '$0',
    riskLevel: 'low',
  },
];

const CONTACTS_DATA: Record<string, Contact[]> = {
  '1': [
    {
      id: 'c1',
      name: 'Marcus Johnson',
      title: 'CIO',
      relationship: 'Champion',
      lastContact: '2 days ago',
    },
    {
      id: 'c2',
      name: 'Sarah Chen',
      title: 'VP Engineering',
      relationship: 'Influencer',
      lastContact: '5 days ago',
    },
    {
      id: 'c3',
      name: 'Emily Rodriguez',
      title: 'Head of Procurement',
      relationship: 'Decision Maker',
      lastContact: '1 week ago',
    },
    {
      id: 'c4',
      name: 'David Kim',
      title: 'Director of Product',
      relationship: 'End User',
      lastContact: '3 days ago',
    },
  ],
  '2': [
    {
      id: 'c5',
      name: 'Lisa Park',
      title: 'VP Sales',
      relationship: 'Champion',
      lastContact: '1 day ago',
    },
    {
      id: 'c6',
      name: 'Tom Wright',
      title: 'CTO',
      relationship: 'Decision Maker',
      lastContact: '4 days ago',
    },
  ],
  '3': [
    {
      id: 'c7',
      name: 'John Smith',
      title: 'CEO',
      relationship: 'Executive Sponsor',
      lastContact: '1 week ago',
    },
    {
      id: 'c8',
      name: 'Anna Lee',
      title: 'VP Data',
      relationship: 'Champion',
      lastContact: '2 days ago',
    },
  ],
  '4': [
    {
      id: 'c9',
      name: 'Amy Wong',
      title: 'VP Engineering',
      relationship: 'Prospect',
      lastContact: '3 days ago',
    },
  ],
};

const SIGNALS_DATA: Record<string, Signal[]> = {
  '1': [
    {
      id: 's1',
      title: 'Acme Corp issued RFP for intelligence platform',
      source: 'Public Filing',
      date: '2 days ago',
      impact: 'positive',
    },
    {
      id: 's2',
      title: 'New CIO Marcus Johnson hired from competitor',
      source: 'LinkedIn',
      date: '1 week ago',
      impact: 'positive',
    },
    {
      id: 's3',
      title: 'Q4 budget freeze rumor',
      source: 'Industry Forum',
      date: '3 days ago',
      impact: 'negative',
    },
  ],
  '2': [
    {
      id: 's4',
      title: 'Series B funding closed — $45M',
      source: 'Crunchbase',
      date: '5 days ago',
      impact: 'positive',
    },
    {
      id: 's5',
      title: 'Hiring 20+ sales reps',
      source: 'Job Board',
      date: '1 week ago',
      impact: 'positive',
    },
  ],
  '3': [
    {
      id: 's6',
      title: 'DataFlow wins major government contract',
      source: 'Press Release',
      date: '1 day ago',
      impact: 'negative',
    },
  ],
  '4': [
    {
      id: 's7',
      title: 'Multi-cloud migration announcement',
      source: 'Blog',
      date: '1 week ago',
      impact: 'positive',
    },
  ],
};

const COMPETITORS_DATA: Record<string, CompetitorPosition[]> = {
  '1': [
    {
      name: 'TechGiant Inc',
      strength: 'strong',
      notes: 'Already has 3-year contract, renewing soon',
    },
    {
      name: 'CloudFirst Ltd',
      strength: 'moderate',
      notes: 'Partnering with Acme on data initiative',
    },
  ],
  '2': [{ name: 'RivalIQ', strength: 'strong', notes: 'Deep FinTech vertical expertise' }],
  '3': [
    { name: 'DataDog', strength: 'strong', notes: 'Existing monitoring relationship' },
    { name: 'Splunk', strength: 'moderate', notes: 'Legacy SIEM being replaced' },
  ],
  '4': [{ name: 'Datadog', strength: 'weak', notes: 'No presence in cloud migration' }],
};

const STRENGTH_COLORS: Record<string, string> = {
  strong: tokens.confidence.high.value,
  moderate: tokens.confidence.medium.value,
  weak: tokens.confidence.low.value,
};

const IMPACT_BADGE: Record<string, string> = {
  positive: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  negative: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  neutral: 'bg-gray-100 text-gray-800',
};

/* ── Component ── */
export default function StrategyRoomScreen() {
  const [loading, setLoading] = useState(true);
  const [selectedAccountId, setSelectedAccountId] = useState('1');
  const [notes, setNotes] = useState(
    'Acme Corp is in active evaluation. Marcus Johnson (new CIO) is the primary champion. Key risk: Q4 budget freeze may delay procurement. Strategy: Accelerate demo cycle to secure budget before freeze. Competitive threat from TechGiant Inc — need to differentiate on AI capabilities.',
  );
  const [actionItems, setActionItems] = useState<ActionItem[]>([
    {
      id: 'a1',
      text: 'Schedule technical deep-dive with Emily Rodriguez',
      completed: false,
      assignee: 'Sarah Chen',
      dueDate: 'Jan 15',
    },
    {
      id: 'a2',
      text: 'Prepare competitive battlecard vs TechGiant Inc',
      completed: true,
      assignee: 'David Kim',
      dueDate: 'Jan 12',
    },
    {
      id: 'a3',
      text: 'Send case study from similar SaaS customer',
      completed: false,
      assignee: 'Emily Rodriguez',
      dueDate: 'Jan 16',
    },
    {
      id: 'a4',
      text: 'Get executive sponsor intro from our VP Sales',
      completed: false,
      assignee: 'Sarah Chen',
      dueDate: 'Jan 18',
    },
  ]);
  const [newAction, setNewAction] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 600);
    return () => clearTimeout(t);
  }, []);

  const account = ACCOUNTS.find((a) => a.id === selectedAccountId)!;
  const contacts = CONTACTS_DATA[selectedAccountId] || [];
  const signals = SIGNALS_DATA[selectedAccountId] || [];
  const competitors = COMPETITORS_DATA[selectedAccountId] || [];

  const toggleAction = (id: string) => {
    setActionItems((prev) =>
      prev.map((a) => (a.id === id ? { ...a, completed: !a.completed } : a)),
    );
  };

  const removeAction = (id: string) => {
    setActionItems((prev) => prev.filter((a) => a.id !== id));
  };

  const addAction = () => {
    if (!newAction.trim()) return;
    setActionItems((prev) => [
      ...prev,
      { id: `a${Date.now()}`, text: newAction, completed: false, assignee: 'You', dueDate: 'TBD' },
    ]);
    setNewAction('');
  };

  if (loading) return <LoadingSkeleton />;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div
        className="flex items-center justify-between px-6 py-4 border-b"
        style={{ borderColor: tokens.border.default }}
      >
        <div className="flex items-center gap-3">
          <MapPin className="w-5 h-5" style={{ color: tokens.domain.action }} />
          <div>
            <h1 className="text-lg font-semibold" style={{ color: tokens.text.primary }}>
              Strategy Room
            </h1>
            <p className="text-xs" style={{ color: tokens.text.muted }}>
              Strategic account planning workspace
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs" style={{ color: tokens.text.muted }}>
            Account:
          </span>
          <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
            <SelectTrigger className="w-48 h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ACCOUNTS.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-6 space-y-6 max-w-7xl mx-auto">
          {/* Account Overview Card */}
          <div
            className="rounded-xl border p-5"
            style={{ borderColor: tokens.border.default, backgroundColor: tokens.surface.primary }}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: tokens.accent.subtle }}
                >
                  <Building2 className="w-6 h-6" style={{ color: tokens.accent.DEFAULT }} />
                </div>
                <div>
                  <h2 className="text-base font-semibold" style={{ color: tokens.text.primary }}>
                    {account.name}
                  </h2>
                  <p className="text-xs" style={{ color: tokens.text.muted }}>
                    {account.industry} · {account.revenue} revenue
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{account.stage}</Badge>
                <Badge
                  className={
                    account.riskLevel === 'high'
                      ? 'bg-red-100 text-red-800'
                      : account.riskLevel === 'medium'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-green-100 text-green-800'
                  }
                >
                  <Shield className="w-3 h-3 mr-1" />
                  {account.riskLevel} risk
                </Badge>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-4">
              {[
                { label: 'Industry', value: account.industry, icon: Briefcase },
                { label: 'Revenue', value: account.revenue, icon: TrendingUp },
                { label: 'Target ARR', value: account.arr, icon: Target },
                { label: 'Stage', value: account.stage, icon: MapPin },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-lg p-3"
                  style={{ backgroundColor: tokens.surface.secondary }}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <item.icon className="w-3.5 h-3.5" style={{ color: tokens.text.muted }} />
                    <p className="text-xs" style={{ color: tokens.text.muted }}>
                      {item.label}
                    </p>
                  </div>
                  <p className="text-sm font-semibold" style={{ color: tokens.text.primary }}>
                    {item.value}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Two Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Key Contacts */}
            <div
              className="rounded-xl border"
              style={{
                borderColor: tokens.border.default,
                backgroundColor: tokens.surface.primary,
              }}
            >
              <div
                className="px-5 py-4 border-b flex items-center justify-between"
                style={{ borderColor: tokens.border.default }}
              >
                <h3
                  className="text-sm font-semibold flex items-center gap-2"
                  style={{ color: tokens.text.primary }}
                >
                  <Users className="w-4 h-4" style={{ color: tokens.accent.DEFAULT }} /> Key
                  Contacts
                </h3>
                <Badge variant="secondary" className="text-xs">
                  {contacts.length}
                </Badge>
              </div>
              <div className="p-4 space-y-2 max-h-72 overflow-y-auto">
                {contacts.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between p-2.5 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold"
                        style={{
                          backgroundColor: tokens.accent.subtle,
                          color: tokens.accent.DEFAULT,
                        }}
                      >
                        {c.name
                          .split(' ')
                          .map((n) => n[0])
                          .join('')}
                      </div>
                      <div>
                        <p className="text-sm font-medium" style={{ color: tokens.text.primary }}>
                          {c.name}
                        </p>
                        <p className="text-xs" style={{ color: tokens.text.muted }}>
                          {c.title}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant="outline" className="text-xs mb-1">
                        {c.relationship}
                      </Badge>
                      <p className="text-xs" style={{ color: tokens.text.muted }}>
                        {c.lastContact}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Signals */}
            <div
              className="rounded-xl border"
              style={{
                borderColor: tokens.border.default,
                backgroundColor: tokens.surface.primary,
              }}
            >
              <div
                className="px-5 py-4 border-b flex items-center justify-between"
                style={{ borderColor: tokens.border.default }}
              >
                <h3
                  className="text-sm font-semibold flex items-center gap-2"
                  style={{ color: tokens.text.primary }}
                >
                  <Radio className="w-4 h-4" style={{ color: tokens.domain.opportunity }} /> Recent
                  Signals
                </h3>
                <Badge variant="secondary" className="text-xs">
                  {signals.length}
                </Badge>
              </div>
              <div className="p-4 space-y-2 max-h-72 overflow-y-auto">
                {signals.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <AlertTriangle
                      className={`w-4 h-4 mt-0.5 shrink-0 ${s.impact === 'positive' ? '' : s.impact === 'negative' ? '' : ''}`}
                      style={{
                        color:
                          s.impact === 'positive'
                            ? tokens.confidence.high.value
                            : s.impact === 'negative'
                              ? tokens.confidence.low.value
                              : tokens.text.muted,
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-sm font-medium truncate"
                        style={{ color: tokens.text.primary }}
                      >
                        {s.title}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs" style={{ color: tokens.text.muted }}>
                          {s.source}
                        </span>
                        <span className="text-xs" style={{ color: tokens.text.muted }}>
                          ·
                        </span>
                        <span className="text-xs" style={{ color: tokens.text.muted }}>
                          {s.date}
                        </span>
                        <Badge className={`${IMPACT_BADGE[s.impact]} text-xs ml-auto capitalize`}>
                          {s.impact}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Strategic Notes */}
          <div
            className="rounded-xl border"
            style={{ borderColor: tokens.border.default, backgroundColor: tokens.surface.primary }}
          >
            <div
              className="px-5 py-4 border-b flex items-center gap-2"
              style={{ borderColor: tokens.border.default }}
            >
              <StickyNote className="w-4 h-4" style={{ color: tokens.domain.reasoning }} />
              <h3 className="text-sm font-semibold" style={{ color: tokens.text.primary }}>
                Strategic Notes
              </h3>
            </div>
            <div className="p-5">
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                className="text-sm resize-none"
                placeholder="Add strategic notes for this account..."
              />
            </div>
          </div>

          {/* Action Items + Competitive Positioning */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Action Items */}
            <div
              className="rounded-xl border"
              style={{
                borderColor: tokens.border.default,
                backgroundColor: tokens.surface.primary,
              }}
            >
              <div
                className="px-5 py-4 border-b flex items-center justify-between"
                style={{ borderColor: tokens.border.default }}
              >
                <h3
                  className="text-sm font-semibold flex items-center gap-2"
                  style={{ color: tokens.text.primary }}
                >
                  <CheckSquare className="w-4 h-4" style={{ color: tokens.domain.action }} /> Action
                  Items
                </h3>
                <span className="text-xs" style={{ color: tokens.text.muted }}>
                  {actionItems.filter((a) => a.completed).length}/{actionItems.length} done
                </span>
              </div>
              <div className="p-4 space-y-2 max-h-80 overflow-y-auto">
                {actionItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 p-2 rounded-lg group hover:bg-muted/50 transition-colors"
                  >
                    <Checkbox
                      checked={item.completed}
                      onCheckedChange={() => toggleAction(item.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-sm ${item.completed ? 'line-through' : ''}`}
                        style={{ color: item.completed ? tokens.text.muted : tokens.text.primary }}
                      >
                        {item.text}
                      </p>
                      <p className="text-xs" style={{ color: tokens.text.muted }}>
                        {item.assignee} · {item.dueDate}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => removeAction(item.id)}
                    >
                      <Trash2 className="w-3 h-3" style={{ color: tokens.confidence.low.value }} />
                    </Button>
                  </div>
                ))}
                <div className="flex gap-2 pt-2">
                  <Input
                    value={newAction}
                    onChange={(e) => setNewAction(e.target.value)}
                    placeholder="Add action item..."
                    className="h-8 text-sm"
                    onKeyDown={(e) => e.key === 'Enter' && addAction()}
                  />
                  <Button
                    size="sm"
                    className="h-8"
                    onClick={addAction}
                    disabled={!newAction.trim()}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Competitive Positioning */}
            <div
              className="rounded-xl border"
              style={{
                borderColor: tokens.border.default,
                backgroundColor: tokens.surface.primary,
              }}
            >
              <div
                className="px-5 py-4 border-b flex items-center gap-2"
                style={{ borderColor: tokens.border.default }}
              >
                <Shield className="w-4 h-4" style={{ color: tokens.confidence.low.value }} />
                <h3 className="text-sm font-semibold" style={{ color: tokens.text.primary }}>
                  Competitive Positioning
                </h3>
              </div>
              <div className="p-4 space-y-3">
                {competitors.map((comp, i) => (
                  <div
                    key={i}
                    className="p-3 rounded-lg"
                    style={{ backgroundColor: tokens.surface.secondary }}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium" style={{ color: tokens.text.primary }}>
                        {comp.name}
                      </span>
                      <Badge
                        className={
                          comp.strength === 'strong'
                            ? 'bg-red-100 text-red-800'
                            : comp.strength === 'moderate'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-green-100 text-green-800'
                        }
                      >
                        {comp.strength}
                      </Badge>
                    </div>
                    <p className="text-xs" style={{ color: tokens.text.secondary }}>
                      {comp.notes}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
