'use client';

import { useState } from 'react';
import { tokens } from '@/components/intelligence-os/design-tokens';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  User,
  Mail,
  Phone,
  MapPin,
  Clock,
  Bell,
  Building2,
  Calendar,
  TrendingUp,
  Zap,
  Linkedin,
  Globe,
  Quote,
} from 'lucide-react';

type Sentiment = 'positive' | 'neutral' | 'negative';

interface ContactData {
  name: string;
  title: string;
  company: string;
  email: string;
  phone: string;
  location: string;
  initials: string;
  social: { platform: string; activity: string; time: string }[];
  mentions: { source: string; text: string; time: string; sentiment: Sentiment }[];
  companyContext: string;
  outreachTiming: { recommendation: string; reason: string; bestDay: string; bestTime: string };
  preferences: { channel: string; frequency: string; style: string; notes: string }[];
}

const CONTACTS: Record<string, ContactData> = {
  sarah: {
    name: 'Sarah Chen',
    title: 'Chief Technology Officer',
    company: 'Acme Corporation',
    email: 'sarah.chen@acme.com',
    phone: '+1 (555) 234-5678',
    location: 'San Francisco, CA',
    initials: 'SC',
    social: [
      {
        platform: 'LinkedIn',
        activity: 'Shared article on AI platform consolidation strategies',
        time: '2h ago',
      },
      {
        platform: 'Twitter',
        activity: 'Tweeted about ML infrastructure challenges at scale',
        time: '1d ago',
      },
      {
        platform: 'GitHub',
        activity: 'Starred 3 repos related to distributed computing',
        time: '3d ago',
      },
    ],
    mentions: [
      {
        source: 'TechCrunch',
        text: "Sarah Chen leads Acme's $50M AI initiative",
        time: '3d ago',
        sentiment: 'positive',
      },
      {
        source: 'Internal',
        text: 'Promoted to CTO with platform consolidation mandate',
        time: '1w ago',
        sentiment: 'positive',
      },
      {
        source: 'Conference',
        text: 'Keynote speaker at Enterprise AI Summit 2025',
        time: '2w ago',
        sentiment: 'positive',
      },
    ],
    companyContext:
      'Recently promoted CTO at Acme Corp ($180M ARR, 2,400 employees). Leading a major AI/ML platform consolidation initiative. Has authority over technology purchasing decisions. Reports directly to CEO.',
    outreachTiming: {
      recommendation: 'High Priority — Engage Now',
      reason:
        'Recently promoted with new mandate. Active on social media discussing platform consolidation — aligns perfectly with our value prop.',
      bestDay: 'Tuesday',
      bestTime: '9:00 AM PST',
    },
    preferences: [
      {
        channel: 'Email',
        frequency: 'Responsive within 24h',
        style: 'Technical, data-driven. Prefers concise emails with clear ROI metrics.',
        notes: 'Opened 4 of our emails but not replied.',
      },
      {
        channel: 'LinkedIn',
        frequency: 'Checks daily',
        style: 'Engages with thought leadership content.',
        notes: 'Recently followed our company page.',
      },
      {
        channel: 'Phone',
        frequency: 'Rarely picks up unknown numbers',
        style: 'Prefers scheduled calls. Leave voicemail with email follow-up.',
        notes: 'Direct line goes through EA.',
      },
    ],
  },
  priya: {
    name: 'Priya Sharma',
    title: 'Chief Revenue Officer',
    company: 'Nexus Technologies',
    email: 'priya.sharma@nexustech.com',
    phone: '+1 (555) 876-5432',
    location: 'New York, NY',
    initials: 'PS',
    social: [
      {
        platform: 'LinkedIn',
        activity: 'Posted about scaling sales teams post-Series C',
        time: '5h ago',
      },
      {
        platform: 'Twitter',
        activity: 'Commented on RevOps best practices for fintech',
        time: '2d ago',
      },
    ],
    mentions: [
      {
        source: 'LinkedIn Article',
        text: 'Shares playbook for 40% sales team expansion',
        time: '4d ago',
        sentiment: 'positive',
      },
      {
        source: 'Industry Report',
        text: 'Listed as top 50 Women in Revenue Operations',
        time: '2w ago',
        sentiment: 'positive',
      },
      {
        source: 'News',
        text: 'Hiring RevOps Manager — first operations hire',
        time: '2w ago',
        sentiment: 'neutral',
      },
    ],
    companyContext:
      'CRO at Nexus Technologies ($64M ARR, 850 employees). Recently closed $45M Series C. Leading 40% sales team expansion. Key decision maker for all revenue technology purchases.',
    outreachTiming: {
      recommendation: 'Engage This Week',
      reason:
        'Actively hiring RevOps Manager — perfect timing to introduce our platform as the foundation for their scaled operations.',
      bestDay: 'Wednesday',
      bestTime: '10:00 AM EST',
    },
    preferences: [
      {
        channel: 'Email',
        frequency: 'Responsive within 12h',
        style: 'Business outcome focused. Wants case studies with metrics.',
        notes: 'Opened our last 2 emails, clicked pricing page.',
      },
      {
        channel: 'LinkedIn',
        frequency: 'Active 3-4x weekly',
        style: 'Engages with revenue leadership content.',
        notes: 'Connected with our VP of Sales last month.',
      },
      {
        channel: 'Phone',
        frequency: 'Open to scheduled calls',
        style: 'Direct communicator. Respects brevity and preparation.',
        notes: 'Best reached through warm introduction.',
      },
    ],
  },
  emily: {
    name: 'Emily Zhang',
    title: 'CEO & Co-Founder',
    company: 'Vertex Solutions',
    email: 'emily@vertexsol.com',
    phone: '+1 (555) 123-4567',
    location: 'Austin, TX',
    initials: 'EZ',
    social: [
      {
        platform: 'LinkedIn',
        activity: 'Shared Gartner "Cool Vendors" recognition post',
        time: '1d ago',
      },
      {
        platform: 'Twitter',
        activity: 'Announced v2.0 launch with 3x performance improvement',
        time: '5d ago',
      },
    ],
    mentions: [
      {
        source: 'Gartner',
        text: 'Vertex Solutions named Cool Vendor in Cloud Infrastructure',
        time: '3w ago',
        sentiment: 'positive',
      },
      {
        source: 'Tech Blog',
        text: 'Emily Zhang on building developer-first cloud tools',
        time: '1mo ago',
        sentiment: 'positive',
      },
      {
        source: 'News',
        text: 'Preparing Series A pitch — targeting $8-12M',
        time: '1d ago',
        sentiment: 'neutral',
      },
    ],
    companyContext:
      'CEO & Co-founder of Vertex Solutions (120 employees, $12M ARR). Pre-Series A startup. Gartner Cool Vendor recognition. Technical co-founder with strong engineering background. Building sales team from scratch.',
    outreachTiming: {
      recommendation: 'Strategic — Build Relationship',
      reason:
        "Pre-funding window is ideal for early engagement. Post-Series A they'll be vendor-bombed. Focus on technical partnership, not hard sell.",
      bestDay: 'Thursday',
      bestTime: '2:00 PM CST',
    },
    preferences: [
      {
        channel: 'Email',
        frequency: 'Responsive within 48h',
        style: 'Technical. Respect her engineering background. No buzzwords.',
        notes: 'Prefers plain text emails. Avoid marketing templates.',
      },
      {
        channel: 'LinkedIn',
        frequency: 'Moderate — 2-3x weekly',
        style: 'Appreciates genuine technical commentary, not generic engagement.',
        notes: "Engaged with our CTO's post on developer platforms.",
      },
      {
        channel: 'Phone',
        frequency: 'Difficult to reach directly',
        style: 'Startup CEO — busy. Email first to schedule.',
        notes: 'First sales hire (Sam) is better initial point of contact.',
      },
    ],
  },
};

function getSentimentStyle(s: Sentiment) {
  if (s === 'positive')
    return { bg: tokens.confidence.high.bg, color: tokens.confidence.high.value };
  if (s === 'negative') return { bg: tokens.confidence.low.bg, color: tokens.confidence.low.value };
  return { bg: tokens.neutral['100'], color: tokens.text.secondary };
}

function getPlatformIcon(platform: string) {
  if (platform === 'LinkedIn')
    return <Linkedin className="size-3.5" style={{ color: '#0A66C2' }} />;
  if (platform === 'Twitter')
    return <Globe className="size-3.5" style={{ color: tokens.text.secondary }} />;
  if (platform === 'GitHub')
    return <Globe className="size-3.5" style={{ color: tokens.text.primary }} />;
  return <Globe className="size-3.5" style={{ color: tokens.text.muted }} />;
}

export default function ContactIntelligence() {
  const [selected, setSelected] = useState<string>('sarah');
  const c = CONTACTS[selected];

  if (!c) {
    return (
      <div className="flex items-center justify-center h-64" style={{ color: tokens.text.muted }}>
        <p>Select a contact to view intelligence</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: tokens.text.primary }}>
            Contact Intelligence
          </h1>
          <p className="text-sm mt-1" style={{ color: tokens.text.secondary }}>
            AI-enriched contact profiles with outreach recommendations
          </p>
        </div>
        <Select value={selected} onValueChange={setSelected}>
          <SelectTrigger className="w-full sm:w-[260px]">
            <User className="size-4 mr-2" style={{ color: tokens.text.muted }} />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="sarah">Sarah Chen — Acme Corp</SelectItem>
            <SelectItem value="priya">Priya Sharma — Nexus Tech</SelectItem>
            <SelectItem value="emily">Emily Zhang — Vertex Sol</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Profile + Social + Preferences */}
        <div className="lg:col-span-1 flex flex-col gap-6">
          {/* Contact Profile Card */}
          <Card className="gap-4 py-4">
            <CardContent className="flex flex-col items-center gap-4">
              <Avatar className="size-16">
                <AvatarFallback
                  className="text-xl"
                  style={{ backgroundColor: tokens.domain.bg, color: tokens.domain.value }}
                >
                  {c.initials}
                </AvatarFallback>
              </Avatar>
              <div className="text-center">
                <h2 className="text-lg font-bold" style={{ color: tokens.text.primary }}>
                  {c.name}
                </h2>
                <p className="text-sm" style={{ color: tokens.text.secondary }}>
                  {c.title}
                </p>
                <Badge
                  className="mt-1"
                  style={{ backgroundColor: tokens.accent.subtle, color: tokens.accent.primary }}
                >
                  {c.company}
                </Badge>
              </div>
              <div className="w-full flex flex-col gap-2 text-sm">
                <div className="flex items-center gap-2">
                  <Mail className="size-4" style={{ color: tokens.text.muted }} />
                  <span style={{ color: tokens.text.secondary }}>{c.email}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="size-4" style={{ color: tokens.text.muted }} />
                  <span style={{ color: tokens.text.secondary }}>{c.phone}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="size-4" style={{ color: tokens.text.muted }} />
                  <span style={{ color: tokens.text.secondary }}>{c.location}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Communication Preferences */}
          <Card className="gap-4 py-4">
            <CardHeader className="pb-0 pt-0 px-6">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Bell className="size-4" style={{ color: tokens.gold.dark }} />
                Communication Preferences
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {c.preferences.map((pref, idx) => (
                <div
                  key={idx}
                  className="flex flex-col gap-1 p-3 rounded-lg"
                  style={{ backgroundColor: tokens.surface.secondary }}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold" style={{ color: tokens.text.primary }}>
                      {pref.channel}
                    </span>
                    <span className="text-xs" style={{ color: tokens.confidence.high.value }}>
                      {pref.frequency}
                    </span>
                  </div>
                  <p className="text-xs" style={{ color: tokens.text.secondary }}>
                    {pref.style}
                  </p>
                  <p className="text-xs mt-1" style={{ color: tokens.text.muted }}>
                    {pref.notes}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Social, Mentions, Company, Timing */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          {/* Social Signals */}
          <Card className="gap-4 py-4">
            <CardHeader className="pb-0 pt-0 px-6">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Globe className="size-4" style={{ color: tokens.accent.primary }} />
                Social Signals
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {c.social.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div
                    className="size-7 rounded-md flex items-center justify-center shrink-0 mt-0.5"
                    style={{ backgroundColor: tokens.surface.secondary }}
                  >
                    {getPlatformIcon(item.platform)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium" style={{ color: tokens.text.primary }}>
                        {item.platform}
                      </span>
                      <span className="text-xs" style={{ color: tokens.text.muted }}>
                        {item.time}
                      </span>
                    </div>
                    <p className="text-sm mt-0.5" style={{ color: tokens.text.secondary }}>
                      {item.activity}
                    </p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Recent Mentions */}
          <Card className="gap-4 py-4">
            <CardHeader className="pb-0 pt-0 px-6">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Quote className="size-4" style={{ color: tokens.domain.value }} />
                Recent Mentions
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {c.mentions.map((m, idx) => {
                const ss = getSentimentStyle(m.sentiment);
                return (
                  <div
                    key={idx}
                    className="flex items-start gap-3 p-2.5 rounded-lg"
                    style={{ backgroundColor: tokens.surface.secondary }}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className="text-xs font-medium"
                          style={{ color: tokens.text.primary }}
                        >
                          {m.source}
                        </span>
                        <span className="text-xs" style={{ color: tokens.text.muted }}>
                          {m.time}
                        </span>
                        <Badge
                          className="text-[10px] px-1.5 py-0"
                          style={{ backgroundColor: ss.bg, color: ss.color }}
                        >
                          {m.sentiment}
                        </Badge>
                      </div>
                      <p className="text-sm" style={{ color: tokens.text.secondary }}>
                        {m.text}
                      </p>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Company Context + Outreach Timing */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="gap-4 py-4">
              <CardHeader className="pb-0 pt-0 px-6">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Building2 className="size-4" style={{ color: tokens.accent.primary }} />
                  Company Context
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed" style={{ color: tokens.text.secondary }}>
                  {c.companyContext}
                </p>
              </CardContent>
            </Card>

            <Card
              className="gap-4 py-4"
              style={{ borderLeft: `4px solid ${tokens.confidence.high.value}` }}
            >
              <CardHeader className="pb-0 pt-0 px-6">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Calendar className="size-4" style={{ color: tokens.confidence.high.value }} />
                  Outreach Timing
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <div
                  className="p-3 rounded-lg"
                  style={{ backgroundColor: tokens.confidence.high.bg }}
                >
                  <p
                    className="text-sm font-semibold"
                    style={{ color: tokens.confidence.high.value }}
                  >
                    {c.outreachTiming.recommendation}
                  </p>
                  <p className="text-xs mt-1" style={{ color: tokens.text.secondary }}>
                    {c.outreachTiming.reason}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div
                    className="p-2.5 rounded-lg"
                    style={{ backgroundColor: tokens.surface.secondary }}
                  >
                    <p className="text-xs" style={{ color: tokens.text.muted }}>
                      Best Day
                    </p>
                    <p className="text-sm font-semibold" style={{ color: tokens.text.primary }}>
                      {c.outreachTiming.bestDay}
                    </p>
                  </div>
                  <div
                    className="p-2.5 rounded-lg"
                    style={{ backgroundColor: tokens.surface.secondary }}
                  >
                    <p className="text-sm font-semibold" style={{ color: tokens.text.primary }}>
                      {c.outreachTiming.bestTime}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
