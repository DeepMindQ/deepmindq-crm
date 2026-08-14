'use client';

import { useState, useEffect } from 'react';
import { tokens, elevation } from '@/components/intelligence-os/design-tokens';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { EmptyState, LoadingSkeleton } from '@/components/ui/screen-states';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  MessageSquare,
  Send,
  ChevronDown,
  Inbox,
  CheckCircle2,
  AlertCircle,
  Clock,
  Mail,
  User,
  Reply,
  Paperclip,
} from 'lucide-react';

/* ── Types ── */
type EmailStatus = 'sent' | 'replied' | 'bounced';

interface EmailThread {
  id: string;
  from: string;
  to: string;
  subject: string;
  preview: string;
  body: string;
  date: string;
  status: EmailStatus;
  isOutbound: boolean;
}

interface CompanyThread {
  companyId: string;
  companyName: string;
  threads: EmailThread[];
}

/* ── Mock data ── */
const COMPANIES: CompanyThread[] = [
  {
    companyId: '1',
    companyName: 'Acme Corp',
    threads: [
      {
        id: 'e1',
        from: 'Sarah Chen <sarah@deepmindq.com>',
        to: 'Marcus Johnson <marcus@acme.com>',
        subject: 'Re: Enterprise Intelligence Platform',
        preview:
          'Thanks for taking the time to speak last week. I wanted to follow up on our discussion about your data challenges...',
        body: "Hi Marcus,\n\nThanks for taking the time to speak last week. I wanted to follow up on our discussion about your data challenges and how our intelligence platform could help streamline your go-to-market operations.\n\nAs we discussed, Acme Corp's current manual research process could be automated, potentially saving your team 15+ hours per week.\n\nWould you be open to a 30-minute demo this Thursday?\n\nBest,\nSarah",
        date: '2025-01-12 09:30',
        status: 'replied',
        isOutbound: true,
      },
      {
        id: 'e2',
        from: 'Marcus Johnson <marcus@acme.com>',
        to: 'Sarah Chen <sarah@deepmindq.com>',
        subject: 'Re: Enterprise Intelligence Platform',
        preview:
          "Hi Sarah, thanks for the follow-up. Thursday works well — how about 2pm ET? I'd also like our Head of Data to join.",
        body: "Hi Sarah,\n\nThanks for the follow-up. Thursday works well — how about 2pm ET? I'd also like our Head of Data, Emily Rodriguez, to join if that's okay.\n\nWe're particularly interested in the competitive intelligence features you mentioned.\n\nLooking forward to it.\n\nMarcus",
        date: '2025-01-12 14:15',
        status: 'replied',
        isOutbound: false,
      },
      {
        id: 'e3',
        from: 'Sarah Chen <sarah@deepmindq.com>',
        to: 'Marcus Johnson <marcus@acme.com>',
        subject: 'Enterprise Intelligence Platform — Initial Introduction',
        preview:
          'Hi Marcus, I noticed Acme Corp recently announced a major digital transformation initiative. Our platform helps revenue teams...',
        body: "Hi Marcus,\n\nI noticed Acme Corp recently announced a major digital transformation initiative. Our platform helps revenue teams like yours automate competitive intelligence and account research, reducing research time by up to 80%.\n\nCompanies like TechVenture and DataFlow have seen significant improvements in their win rates using our platform.\n\nI'd love to share how we could help Acme Corp achieve similar results. Would a 15-minute call be possible?\n\nBest regards,\nSarah Chen",
        date: '2025-01-05 10:00',
        status: 'replied',
        isOutbound: true,
      },
    ],
  },
  {
    companyId: '2',
    companyName: 'TechVenture Inc',
    threads: [
      {
        id: 'e4',
        from: 'David Kim <david@deepmindq.com>',
        to: 'Lisa Park <lisa@techventure.com>',
        subject: 'AI-Powered Sales Intelligence',
        preview:
          "Hi Lisa, I came across TechVenture's recent Series B announcement — congratulations! With rapid scaling comes the challenge of...",
        body: "Hi Lisa,\n\nI came across TechVenture's recent Series B announcement — congratulations!\n\nWith rapid scaling comes the challenge of maintaining intelligence quality at volume. Our platform helps growing sales teams stay ahead of market signals without the manual effort.\n\nWould love to chat about how we support FinTech companies in your stage.\n\nDavid",
        date: '2025-01-10 08:45',
        status: 'sent',
        isOutbound: true,
      },
      {
        id: 'e5',
        from: 'David Kim <david@deepmindq.com>',
        to: 'Lisa Park <lisa@techventure.com>',
        subject: 'Re: AI-Powered Sales Intelligence',
        preview:
          'Just sharing a quick case study from a similar FinTech company that reduced their sales cycle by 35% using our platform...',
        body: "Hi Lisa,\n\nJust sharing a quick case study from a similar FinTech company that reduced their sales cycle by 35% using our platform.\n\nThought it might be relevant given TechVenture's current growth trajectory. Happy to walk through the details anytime.\n\nDavid",
        date: '2025-01-11 11:20',
        status: 'sent',
        isOutbound: true,
      },
    ],
  },
  {
    companyId: '3',
    companyName: 'DataFlow Systems',
    threads: [
      {
        id: 'e6',
        from: 'Emily Rodriguez <emily@deepmindq.com>',
        to: 'John Smith <john@dataflow.com>',
        subject: 'Data Intelligence Partnership',
        preview:
          'Hi John, following up on the data analytics conference last month. I enjoyed your talk on real-time signal processing...',
        body: "Hi John,\n\nFollowing up on the data analytics conference last month. I really enjoyed your talk on real-time signal processing for enterprise accounts.\n\nOur platform complements data infrastructure like DataFlow's by providing the intelligence layer on top. Several of our customers use both.\n\nWould be great to explore potential synergies.\n\nEmily",
        date: '2025-01-08 16:30',
        status: 'bounced',
        isOutbound: true,
      },
    ],
  },
  {
    companyId: '4',
    companyName: 'CloudPeak',
    threads: [
      {
        id: 'e7',
        from: 'Sarah Chen <sarah@deepmindq.com>',
        to: 'Amy Wong <amy@cloudpeak.com>',
        subject: 'Cloud Migration Intelligence',
        preview:
          "Hi Amy, I saw CloudPeak's announcement about migrating to a multi-cloud architecture. Our platform helps teams track...",
        body: "Hi Amy,\n\nI saw CloudPeak's announcement about migrating to a multi-cloud architecture. Our platform helps teams track competitive positioning and market signals during major transitions like this.\n\nWould love to share some insights.\n\nSarah",
        date: '2025-01-09 09:00',
        status: 'replied',
        isOutbound: true,
      },
      {
        id: 'e8',
        from: 'Amy Wong <amy@cloudpeak.com>',
        to: 'Sarah Chen <sarah@deepmindq.com>',
        subject: 'Re: Cloud Migration Intelligence',
        preview:
          "Thanks Sarah, interesting timing indeed. We're evaluating several intelligence tools. Can you send over some documentation?",
        body: "Thanks Sarah,\n\nInteresting timing indeed. We're evaluating several intelligence tools as part of our transformation initiative.\n\nCan you send over some documentation on your cloud-native capabilities? We're particularly interested in API-first approaches.\n\nAmy",
        date: '2025-01-09 15:45',
        status: 'replied',
        isOutbound: false,
      },
    ],
  },
];

const STATUS_CONFIG: Record<
  EmailStatus,
  { icon: typeof CheckCircle2; label: string; class: string }
> = {
  sent: {
    icon: Clock,
    label: 'Sent',
    class: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  },
  replied: {
    icon: CheckCircle2,
    label: 'Replied',
    class: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  },
  bounced: {
    icon: AlertCircle,
    label: 'Bounced',
    class: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  },
};

/* ── Component ── */
export default function ConversationStudioScreen() {
  const [loading, setLoading] = useState(true);
  const [selectedCompanyId, setSelectedCompanyId] = useState('1');
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [replyTo, setReplyTo] = useState<EmailThread | null>(null);
  const [companyThreads, setCompanyThreads] = useState(COMPANIES);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(t);
  }, []);

  const currentCompany = companyThreads.find((c) => c.companyId === selectedCompanyId);
  const sortedThreads =
    currentCompany?.threads.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    ) || [];

  const handleSendReply = () => {
    if (!replyTo || !replyText.trim() || !currentCompany) return;
    const newEmail: EmailThread = {
      id: `e${Date.now()}`,
      from: 'You <sarah@deepmindq.com>',
      to: replyTo.from,
      subject: `Re: ${replyTo.subject}`,
      preview: replyText.slice(0, 120),
      body: replyText,
      date: new Date().toISOString().replace('T', ' ').slice(0, 16),
      status: 'sent',
      isOutbound: true,
    };
    setCompanyThreads((prev) =>
      prev.map((c) =>
        c.companyId === selectedCompanyId ? { ...c, threads: [...c.threads, newEmail] } : c,
      ),
    );
    setReplyText('');
    setReplyOpen(false);
    setReplyTo(null);
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
          <MessageSquare className="w-5 h-5" style={{ color: tokens.domain.reasoning }} />
          <div>
            <h1 className="text-lg font-semibold" style={{ color: tokens.text.primary }}>
              Conversation Studio
            </h1>
            <p className="text-xs" style={{ color: tokens.text.muted }}>
              View and manage email conversations with prospects and customers
            </p>
          </div>
        </div>
      </div>

      {/* Company Selector */}
      <div
        className="flex items-center gap-3 px-6 py-3 border-b"
        style={{ borderColor: tokens.borderFaint }}
      >
        <span className="text-xs font-medium" style={{ color: tokens.text.muted }}>
          Company:
        </span>
        <div className="relative">
          <button
            className="flex items-center gap-2 h-9 px-3 rounded-md border text-sm"
            style={{
              borderColor: tokens.border.default,
              backgroundColor: tokens.surface.primary,
              color: tokens.text.primary,
            }}
            onClick={() => setDropdownOpen(!dropdownOpen)}
          >
            <Inbox className="w-3.5 h-3.5" style={{ color: tokens.accent.DEFAULT }} />
            {currentCompany?.companyName || 'Select company'}
            <ChevronDown className="w-3.5 h-3.5" style={{ color: tokens.text.muted }} />
          </button>
          {dropdownOpen && (
            <div
              className="absolute top-full left-0 mt-1 w-56 rounded-lg border py-1 z-10"
              style={{
                backgroundColor: tokens.surface.primary,
                borderColor: tokens.border.default,
                boxShadow: elevation.lg,
              }}
            >
              {companyThreads.map((c) => (
                <button
                  key={c.companyId}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-muted/50 flex items-center justify-between"
                  style={{ color: tokens.text.primary }}
                  onClick={() => {
                    setSelectedCompanyId(c.companyId);
                    setDropdownOpen(false);
                    setReplyOpen(false);
                  }}
                >
                  {c.companyName}
                  <Badge variant="secondary" className="text-xs ml-2">
                    {c.threads.length}
                  </Badge>
                </button>
              ))}
            </div>
          )}
        </div>
        {currentCompany && (
          <div className="flex items-center gap-4 text-xs" style={{ color: tokens.text.muted }}>
            <span>{currentCompany.threads.length} emails</span>
            <span className="flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" style={{ color: tokens.confidence.high.value }} />
              {currentCompany.threads.filter((e) => e.status === 'replied').length} replies
            </span>
          </div>
        )}
      </div>

      {/* Thread */}
      <div className="flex-1 overflow-hidden">
        {!currentCompany || sortedThreads.length === 0 ? (
          <EmptyState
            icon="inbox"
            title="No conversations"
            description="Select a company to view email threads"
          />
        ) : (
          <ScrollArea className="h-full">
            <div className="max-w-3xl mx-auto p-6 space-y-4">
              {/* Thread header */}
              <div className="flex items-center gap-2 mb-6">
                <Mail className="w-4 h-4" style={{ color: tokens.accent.DEFAULT }} />
                <h2 className="text-sm font-semibold" style={{ color: tokens.text.primary }}>
                  {sortedThreads[0]?.subject}
                </h2>
                <Badge variant="outline" className="text-xs">
                  {sortedThreads.length} messages
                </Badge>
              </div>

              {/* Emails */}
              {sortedThreads.map((email) => {
                const statusCfg = STATUS_CONFIG[email.status];
                const StatusIcon = statusCfg.icon;
                return (
                  <div
                    key={email.id}
                    className={`rounded-lg border p-4 transition-colors ${email.isOutbound ? 'ml-12' : 'mr-12'}`}
                    style={{
                      borderColor: tokens.border.default,
                      backgroundColor: email.isOutbound
                        ? tokens.accent.ghost
                        : tokens.surface.secondary,
                    }}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center"
                          style={{
                            backgroundColor: email.isOutbound
                              ? tokens.accent.subtle
                              : tokens.surfaceExtended,
                          }}
                        >
                          {email.isOutbound ? (
                            <Send className="w-3 h-3" style={{ color: tokens.accent.DEFAULT }} />
                          ) : (
                            <User className="w-3 h-3" style={{ color: tokens.text.muted }} />
                          )}
                        </div>
                        <div>
                          <p className="text-xs font-medium" style={{ color: tokens.text.primary }}>
                            {email.isOutbound ? `To: ${email.to}` : email.from}
                          </p>
                          <p className="text-xs" style={{ color: tokens.text.muted }}>
                            {email.date}
                          </p>
                        </div>
                      </div>
                      <Badge className={`${statusCfg.class} text-xs`}>{statusCfg.label}</Badge>
                    </div>
                    <p
                      className="text-sm leading-relaxed mb-3"
                      style={{ color: tokens.text.secondary }}
                    >
                      {email.body}
                    </p>
                    {!email.isOutbound && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => {
                          setReplyTo(email);
                          setReplyOpen(true);
                          setReplyText('');
                        }}
                      >
                        <Reply className="w-3 h-3 mr-1" /> Reply
                      </Button>
                    )}
                  </div>
                );
              })}

              {/* Inline Reply Composer */}
              {replyOpen && replyTo && (
                <div
                  className="rounded-lg border p-4 ml-12"
                  style={{
                    borderColor: tokens.accent.DEFAULT,
                    backgroundColor: tokens.accent.ghost,
                  }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Reply className="w-3.5 h-3.5" style={{ color: tokens.accent.DEFAULT }} />
                    <span className="text-xs font-medium" style={{ color: tokens.text.primary }}>
                      Reply to: {replyTo.from.split('<')[0].trim()}
                    </span>
                  </div>
                  <Textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Write your reply..."
                    rows={4}
                    className="text-sm resize-none mb-3"
                  />
                  <div className="flex items-center justify-between">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs"
                      onClick={() => {
                        setReplyOpen(false);
                        setReplyTo(null);
                      }}
                    >
                      <Paperclip className="w-3.5 h-3.5 mr-1" /> Attach
                    </Button>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs"
                        onClick={() => {
                          setReplyOpen(false);
                          setReplyTo(null);
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        className="text-xs"
                        onClick={handleSendReply}
                        disabled={!replyText.trim()}
                      >
                        <Send className="w-3.5 h-3.5 mr-1" /> Send Reply
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  );
}
