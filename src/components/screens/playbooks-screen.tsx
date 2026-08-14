'use client';

import { useState, useEffect } from 'react';
import { tokens } from '@/components/intelligence-os/design-tokens';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState, LoadingSkeleton } from '@/components/ui/screen-states';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  BookOpen,
  TrendingUp,
  ListChecks,
  Users,
  MousePointerClick,
  X,
  CheckCircle2,
  Circle,
  ArrowRight,
  Phone,
  Mail,
  MessageSquare,
  Video,
  FileText,
  Target,
} from 'lucide-react';

/* ── Types ── */
interface PlaybookStep {
  id: number;
  title: string;
  description: string;
  channel: 'email' | 'call' | 'social' | 'meeting' | 'document';
  estimatedTime: string;
}

interface Playbook {
  id: string;
  name: string;
  stage: string;
  steps: PlaybookStep[];
  avgWinRate: number;
  usage: number;
  description: string;
  color: string;
}

/* ── Mock data ── */
const PLAYBOOKS: Playbook[] = [
  {
    id: '1',
    name: 'Prospecting Playbook',
    stage: 'Prospecting',
    avgWinRate: 12,
    usage: 1247,
    color: '#2563EB',
    description: 'Multi-touch outreach sequence for net-new accounts in your ICP.',
    steps: [
      {
        id: 1,
        title: 'Research & Prepare',
        description:
          'Review company signals, identify key stakeholders, and craft personalized angle.',
        channel: 'document',
        estimatedTime: '15 min',
      },
      {
        id: 2,
        title: 'Initial Cold Email',
        description: 'Send value-driven cold email referencing a specific trigger event.',
        channel: 'email',
        estimatedTime: '10 min',
      },
      {
        id: 3,
        title: 'LinkedIn Connection',
        description: 'Connect with decision maker on LinkedIn with a personalized note.',
        channel: 'social',
        estimatedTime: '5 min',
      },
      {
        id: 4,
        title: 'Follow-up Call',
        description: 'Phone follow-up 3 days after email. Reference the value prop briefly.',
        channel: 'call',
        estimatedTime: '8 min',
      },
      {
        id: 5,
        title: 'Second Touch Email',
        description: 'Share a relevant case study or insight piece.',
        channel: 'email',
        estimatedTime: '10 min',
      },
    ],
  },
  {
    id: '2',
    name: 'Discovery Playbook',
    stage: 'Discovery',
    avgWinRate: 34,
    usage: 892,
    color: '#7C3AED',
    description: 'Structured discovery process to uncover pain points and qualify opportunities.',
    steps: [
      {
        id: 1,
        title: 'Pre-Discovery Research',
        description:
          'Review all account intelligence, prior touchpoints, and competitive landscape.',
        channel: 'document',
        estimatedTime: '20 min',
      },
      {
        id: 2,
        title: 'Discovery Call — Current State',
        description: 'Explore current workflows, pain points, and business challenges.',
        channel: 'call',
        estimatedTime: '30 min',
      },
      {
        id: 3,
        title: 'Discovery Call — Future State',
        description: 'Understand desired outcomes, success metrics, and decision criteria.',
        channel: 'call',
        estimatedTime: '25 min',
      },
      {
        id: 4,
        title: 'Discovery Summary Email',
        description: 'Send a written summary of findings and proposed next steps.',
        channel: 'email',
        estimatedTime: '15 min',
      },
    ],
  },
  {
    id: '3',
    name: 'Demo Playbook',
    stage: 'Demo',
    avgWinRate: 48,
    usage: 654,
    color: '#059669',
    description: 'Deliver compelling product demos tailored to prospect needs.',
    steps: [
      {
        id: 1,
        title: 'Demo Preparation',
        description: 'Customize demo environment with prospect-relevant data and use cases.',
        channel: 'document',
        estimatedTime: '30 min',
      },
      {
        id: 2,
        title: 'Technical Deep Dive',
        description: 'Present architecture, integrations, and security to technical stakeholders.',
        channel: 'meeting',
        estimatedTime: '45 min',
      },
      {
        id: 3,
        title: 'Business Value Demo',
        description: 'Show ROI-focused dashboard, reporting, and business outcomes.',
        channel: 'meeting',
        estimatedTime: '40 min',
      },
      {
        id: 4,
        title: 'Post-Demo Follow-up',
        description: 'Send recording, answers to open questions, and proposed evaluation plan.',
        channel: 'email',
        estimatedTime: '20 min',
      },
    ],
  },
  {
    id: '4',
    name: 'Proposal Playbook',
    stage: 'Proposal',
    avgWinRate: 61,
    usage: 423,
    color: '#D97706',
    description: 'Create and deliver winning proposals that close deals.',
    steps: [
      {
        id: 1,
        title: 'Proposal Draft',
        description: 'Generate proposal based on discovery notes, demo feedback, and requirements.',
        channel: 'document',
        estimatedTime: '60 min',
      },
      {
        id: 2,
        title: 'Internal Review',
        description: 'Get pricing, legal, and solution team approval.',
        channel: 'meeting',
        estimatedTime: '30 min',
      },
      {
        id: 3,
        title: 'Proposal Presentation',
        description: 'Walk through proposal with decision makers, address concerns.',
        channel: 'meeting',
        estimatedTime: '45 min',
      },
      {
        id: 4,
        title: 'Negotiation Preparation',
        description: 'Prepare concession strategy and value trade-offs.',
        channel: 'document',
        estimatedTime: '20 min',
      },
    ],
  },
  {
    id: '5',
    name: 'Negotiation Playbook',
    stage: 'Negotiation',
    avgWinRate: 73,
    usage: 287,
    color: '#DC2626',
    description: 'Navigate deal negotiations while protecting value and margin.',
    steps: [
      {
        id: 1,
        title: 'Analyze Leverage',
        description: 'Review competitive alternatives, prospect urgency, and budget constraints.',
        channel: 'document',
        estimatedTime: '25 min',
      },
      {
        id: 2,
        title: 'Negotiation Call',
        description: 'Discuss pricing, terms, and find mutual value in the agreement.',
        channel: 'call',
        estimatedTime: '35 min',
      },
      {
        id: 3,
        title: 'Revised Proposal',
        description: 'Submit updated terms reflecting agreed-upon changes.',
        channel: 'email',
        estimatedTime: '20 min',
      },
      {
        id: 4,
        title: 'Executive Sponsor Outreach',
        description: 'Engage executive sponsor for final push.',
        channel: 'call',
        estimatedTime: '15 min',
      },
    ],
  },
  {
    id: '6',
    name: 'Onboarding Playbook',
    stage: 'Onboarding',
    avgWinRate: 89,
    usage: 198,
    color: '#16A34A',
    description: 'Ensure smooth handoff and successful customer activation.',
    steps: [
      {
        id: 1,
        title: 'Handoff Meeting',
        description: 'Internal handoff from sales to customer success with full context.',
        channel: 'meeting',
        estimatedTime: '30 min',
      },
      {
        id: 2,
        title: 'Welcome Email',
        description: 'Send welcome package with onboarding guide, support contacts, and resources.',
        channel: 'email',
        estimatedTime: '15 min',
      },
      {
        id: 3,
        title: 'Kickoff Call',
        description: 'Customer kickoff to align on goals, timeline, and success criteria.',
        channel: 'call',
        estimatedTime: '45 min',
      },
      {
        id: 4,
        title: 'First Value Check-in',
        description: 'Two-week check-in to ensure early adoption and address blockers.',
        channel: 'meeting',
        estimatedTime: '30 min',
      },
      {
        id: 5,
        title: 'Expansion Opportunity ID',
        description: 'Identify cross-sell/upsell opportunities based on onboarding usage patterns.',
        channel: 'document',
        estimatedTime: '20 min',
      },
    ],
  },
];

const CHANNEL_ICONS: Record<string, typeof Mail> = {
  email: Mail,
  call: Phone,
  social: MessageSquare,
  meeting: Video,
  document: FileText,
};

const STAGE_ORDER = ['Prospecting', 'Discovery', 'Demo', 'Proposal', 'Negotiation', 'Onboarding'];

/* ── Component ── */
export default function PlaybooksScreen() {
  const [loading, setLoading] = useState(true);
  const [selectedPlaybook, setSelectedPlaybook] = useState<Playbook | null>(null);
  const [stageFilter, setStageFilter] = useState('All');

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(t);
  }, []);

  const filtered =
    stageFilter === 'All' ? PLAYBOOKS : PLAYBOOKS.filter((p) => p.stage === stageFilter);

  if (loading) return <LoadingSkeleton variant="cards" />;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div
        className="flex items-center justify-between px-6 py-4 border-b"
        style={{ borderColor: tokens.border.default }}
      >
        <div className="flex items-center gap-3">
          <BookOpen className="w-5 h-5" style={{ color: tokens.domain.reasoning }} />
          <div>
            <h1 className="text-lg font-semibold" style={{ color: tokens.text.primary }}>
              Sales Playbooks
            </h1>
            <p className="text-xs" style={{ color: tokens.text.muted }}>
              Structured playbooks for every stage of the sales journey
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-xs" style={{ color: tokens.text.muted }}>
            <BookOpen className="w-3.5 h-3.5" />
            {PLAYBOOKS.length} playbooks
          </div>
        </div>
      </div>

      {/* Stage Filter */}
      <div
        className="flex items-center gap-2 px-6 py-3 border-b overflow-x-auto"
        style={{ borderColor: tokens.borderFaint }}
      >
        <Button
          variant={stageFilter === 'All' ? 'default' : 'ghost'}
          size="sm"
          className="h-7 text-xs shrink-0"
          onClick={() => setStageFilter('All')}
        >
          All
        </Button>
        {STAGE_ORDER.map((stage) => (
          <Button
            key={stage}
            variant={stageFilter === stage ? 'default' : 'ghost'}
            size="sm"
            className="h-7 text-xs shrink-0"
            onClick={() => setStageFilter(stage)}
          >
            {stage}
          </Button>
        ))}
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-auto">
        {filtered.length === 0 ? (
          <EmptyState
            icon="folder"
            title="No playbooks found"
            description="No playbooks match your current filter"
          />
        ) : (
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((playbook) => (
              <Card
                key={playbook.id}
                className="cursor-pointer transition-all hover:shadow-md group"
                style={{ borderColor: tokens.border.default }}
                onClick={() => setSelectedPlaybook(playbook)}
              >
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `${playbook.color}15`, color: playbook.color }}
                    >
                      <BookOpen className="w-5 h-5" />
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {playbook.stage}
                    </Badge>
                  </div>

                  <h3
                    className="text-sm font-semibold mb-1.5 group-hover:underline"
                    style={{ color: tokens.text.primary }}
                  >
                    {playbook.name}
                  </h3>
                  <p className="text-xs mb-4 line-clamp-2" style={{ color: tokens.text.muted }}>
                    {playbook.description}
                  </p>

                  <div
                    className="grid grid-cols-3 gap-3 pt-3 border-t"
                    style={{ borderColor: tokens.borderFaint }}
                  >
                    <div>
                      <p className="text-xs" style={{ color: tokens.text.muted }}>
                        Steps
                      </p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <ListChecks className="w-3.5 h-3.5" style={{ color: playbook.color }} />
                        <span
                          className="text-sm font-semibold"
                          style={{ color: tokens.text.primary }}
                        >
                          {playbook.steps.length}
                        </span>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs" style={{ color: tokens.text.muted }}>
                        Win Rate
                      </p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <TrendingUp
                          className="w-3.5 h-3.5"
                          style={{ color: tokens.confidence.high.value }}
                        />
                        <span
                          className="text-sm font-semibold"
                          style={{ color: tokens.confidence.high.value }}
                        >
                          {playbook.avgWinRate}%
                        </span>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs" style={{ color: tokens.text.muted }}>
                        Usage
                      </p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <Users className="w-3.5 h-3.5" style={{ color: tokens.text.muted }} />
                        <span
                          className="text-sm font-semibold"
                          style={{ color: tokens.text.primary }}
                        >
                          {playbook.usage}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Slide-over */}
      <Sheet open={!!selectedPlaybook} onOpenChange={(open) => !open && setSelectedPlaybook(null)}>
        <SheetContent className="w-full sm:max-w-lg p-0">
          {selectedPlaybook && (
            <>
              <SheetHeader
                className="px-6 pt-6 pb-4 border-b"
                style={{ borderColor: tokens.border.default }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{
                      backgroundColor: `${selectedPlaybook.color}15`,
                      color: selectedPlaybook.color,
                    }}
                  >
                    <BookOpen className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <SheetTitle className="text-base">{selectedPlaybook.name}</SheetTitle>
                    <p className="text-xs mt-0.5" style={{ color: tokens.text.muted }}>
                      {selectedPlaybook.description}
                    </p>
                  </div>
                </div>
                <div className="flex gap-4 mt-3">
                  <Badge variant="outline">{selectedPlaybook.stage}</Badge>
                  <span
                    className="text-xs flex items-center gap-1"
                    style={{ color: tokens.confidence.high.value }}
                  >
                    <TrendingUp className="w-3 h-3" /> {selectedPlaybook.avgWinRate}% win rate
                  </span>
                  <span
                    className="text-xs flex items-center gap-1"
                    style={{ color: tokens.text.muted }}
                  >
                    <Users className="w-3 h-3" /> {selectedPlaybook.usage} uses
                  </span>
                </div>
              </SheetHeader>
              <ScrollArea className="h-[calc(100vh-220px)]">
                <div className="px-6 py-5">
                  <h3 className="text-sm font-semibold mb-4" style={{ color: tokens.text.primary }}>
                    Playbook Steps
                  </h3>
                  <div className="space-y-0">
                    {selectedPlaybook.steps.map((step, idx) => {
                      const IconComponent = CHANNEL_ICONS[step.channel] || FileText;
                      return (
                        <div key={step.id}>
                          <div className="flex gap-4 py-3 group/step">
                            <div className="flex flex-col items-center">
                              <div
                                className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                                style={{
                                  backgroundColor: `${selectedPlaybook.color}15`,
                                  color: selectedPlaybook.color,
                                }}
                              >
                                <IconComponent className="w-4 h-4" />
                              </div>
                              {idx < selectedPlaybook.steps.length - 1 && (
                                <div
                                  className="w-px flex-1 mt-1"
                                  style={{ backgroundColor: tokens.border.default }}
                                />
                              )}
                            </div>
                            <div className="flex-1 pb-2">
                              <div className="flex items-center justify-between mb-1">
                                <h4
                                  className="text-sm font-medium"
                                  style={{ color: tokens.text.primary }}
                                >
                                  {step.title}
                                </h4>
                                <span
                                  className="text-xs px-2 py-0.5 rounded-full"
                                  style={{
                                    backgroundColor: tokens.surfaceExtended,
                                    color: tokens.text.muted,
                                  }}
                                >
                                  {step.estimatedTime}
                                </span>
                              </div>
                              <p
                                className="text-xs leading-relaxed"
                                style={{ color: tokens.text.secondary }}
                              >
                                {step.description}
                              </p>
                            </div>
                          </div>
                          {idx < selectedPlaybook.steps.length - 1 && (
                            <div
                              className="ml-4 border-t"
                              style={{ borderColor: tokens.borderFaint }}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </ScrollArea>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
