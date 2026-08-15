'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { tokens } from '@/components/intelligence-os/design-tokens';
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  Mail,
  Globe,
  Zap,
  Users,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  AlertTriangle,
  Eye,
  RefreshCw,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

// ── Mock Data ──
const overallScore = 82;
const totalRecords = 2480;
const verifiedRecords = 1856;
const unverifiedRecords = 487;
const flaggedRecords = 137;

const categoryCards = [
  {
    name: 'Email Trust',
    score: 78,
    verified: 1204,
    total: 1540,
    icon: <Mail className="w-5 h-5" />,
    color: tokens.accent.primary,
    trend: '+2.3%',
  },
  {
    name: 'Domain Trust',
    score: 91,
    verified: 420,
    total: 460,
    icon: <Globe className="w-5 h-5" />,
    color: tokens.confidence.high.value,
    trend: '+1.1%',
  },
  {
    name: 'Signal Trust',
    score: 74,
    verified: 156,
    total: 210,
    icon: <Zap className="w-5 h-5" />,
    color: tokens.confidence.medium.value,
    trend: '-0.8%',
  },
  {
    name: 'Contact Trust',
    score: 85,
    verified: 76,
    total: 90,
    icon: <Users className="w-5 h-5" />,
    color: tokens.confidence.high.value,
    trend: '+3.2%',
  },
];

const trustEvents = [
  {
    id: 'te1',
    event: '12 emails verified for Acme Corp',
    type: 'verified' as const,
    time: '5 min ago',
    category: 'Email',
  },
  {
    id: 'te2',
    event: 'Domain MX record updated for NovaTech',
    type: 'updated' as const,
    time: '22 min ago',
    category: 'Domain',
  },
  {
    id: 'te3',
    event: '3 contacts flagged with outdated info at Pinnacle Health',
    type: 'flagged' as const,
    time: '1h ago',
    category: 'Contact',
  },
  {
    id: 'te4',
    event: 'Signal source reliability downgraded for job board scraper',
    type: 'flagged' as const,
    time: '2h ago',
    category: 'Signal',
  },
  {
    id: 'te5',
    event: '18 emails re-verified batch job completed',
    type: 'verified' as const,
    time: '3h ago',
    category: 'Email',
  },
  {
    id: 'te6',
    event: 'New domain discovered for SkyBridge Labs subsidiary',
    type: 'updated' as const,
    time: '4h ago',
    category: 'Domain',
  },
  {
    id: 'te7',
    event: 'Contact phone number validated for Quantum Dynamics VP',
    type: 'verified' as const,
    time: '5h ago',
    category: 'Contact',
  },
  {
    id: 'te8',
    event: 'Email bounce rate spike detected — DataFlow Inc domain',
    type: 'flagged' as const,
    time: '6h ago',
    category: 'Email',
  },
];

const trendData = [
  { date: 'Jan 14', email: 75, domain: 90, signal: 72, contact: 82 },
  { date: 'Jan 15', email: 76, domain: 89, signal: 71, contact: 83 },
  { date: 'Jan 16', email: 74, domain: 90, signal: 73, contact: 83 },
  { date: 'Jan 17', email: 77, domain: 91, signal: 74, contact: 84 },
  { date: 'Jan 18', email: 78, domain: 91, signal: 73, contact: 85 },
  { date: 'Jan 19', email: 77, domain: 90, signal: 72, contact: 84 },
  { date: 'Jan 20', email: 78, domain: 91, signal: 74, contact: 85 },
];

const lineColors = {
  email: tokens.accent.primary,
  domain: tokens.confidence.high.value,
  signal: tokens.confidence.medium.value,
  contact: tokens.domain.reasoning,
};

const eventIcons: Record<string, React.ReactNode> = {
  verified: <CheckCircle2 className="w-4 h-4" style={{ color: tokens.confidence.high.value }} />,
  updated: <RefreshCw className="w-4 h-4" style={{ color: tokens.accent.primary }} />,
  flagged: <AlertTriangle className="w-4 h-4" style={{ color: tokens.confidence.low.value }} />,
};

// ── Component ──
export default function TrustDashboardScreen() {
  const [loading, setLoading] = useState(true);

  useMemo(() => {
    const t = setTimeout(() => setLoading(false), 700);
    return () => clearTimeout(t);
  }, []);

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-4 gap-4">
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-72 rounded-xl" />
          <Skeleton className="h-72 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: tokens.text.primary }}>
            Trust Dashboard
          </h1>
          <p className="text-sm mt-1" style={{ color: tokens.text.secondary }}>
            Monitor data quality and trust scores across all intelligence sources
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          style={{ color: tokens.accent.primary, borderColor: tokens.accent.primary }}
        >
          <RefreshCw className="w-3.5 h-3.5" /> Run Verification
        </Button>
      </div>

      {/* Overall Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            label: 'Overall Trust Score',
            value: `${overallScore}%`,
            icon: Shield,
            color:
              overallScore >= 80 ? tokens.confidence.high.value : tokens.confidence.medium.value,
            desc: 'Across all categories',
          },
          {
            label: 'Verified Records',
            value: verifiedRecords.toLocaleString(),
            icon: ShieldCheck,
            color: tokens.confidence.high.value,
            desc: `${((verifiedRecords / totalRecords) * 100).toFixed(1)}% of total`,
          },
          {
            label: 'Unverified',
            value: unverifiedRecords.toLocaleString(),
            icon: Eye,
            color: tokens.confidence.medium.value,
            desc: 'Pending verification',
          },
          {
            label: 'Flagged',
            value: flaggedRecords.toLocaleString(),
            icon: ShieldAlert,
            color: tokens.confidence.low.value,
            desc: 'Require attention',
          },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.label} className="py-4 gap-2">
              <CardContent className="p-4 pb-0">
                <div className="flex items-center gap-2 mb-2">
                  <Icon className="w-4 h-4" style={{ color: s.color }} />
                  <span className="text-xs font-medium" style={{ color: tokens.text.muted }}>
                    {s.label}
                  </span>
                </div>
                <p className="text-2xl font-bold" style={{ color: tokens.text.primary }}>
                  {s.value}
                </p>
                <p className="text-[11px] mt-1" style={{ color: tokens.text.muted }}>
                  {s.desc}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Trust by Category Cards */}
      <div>
        <h2 className="text-base font-semibold mb-4" style={{ color: tokens.text.primary }}>
          Trust by Category
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {categoryCards.map((cat) => {
            const isPositive = cat.trend.startsWith('+');
            return (
              <Card key={cat.name} className="overflow-hidden">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div
                      className="p-2 rounded-lg"
                      style={{ backgroundColor: `${cat.color}12`, color: cat.color }}
                    >
                      {cat.icon}
                    </div>
                    <span
                      className="flex items-center gap-1 text-xs font-medium"
                      style={{
                        color: isPositive
                          ? tokens.confidence.high.value
                          : tokens.confidence.low.value,
                      }}
                    >
                      {isPositive ? (
                        <TrendingUp className="w-3 h-3" />
                      ) : (
                        <TrendingDown className="w-3 h-3" />
                      )}
                      {cat.trend}
                    </span>
                  </div>
                  <p className="text-sm font-medium" style={{ color: tokens.text.primary }}>
                    {cat.name}
                  </p>
                  <div className="flex items-end justify-between mt-2">
                    <div>
                      <p className="text-3xl font-bold" style={{ color: tokens.text.primary }}>
                        {cat.score}
                      </p>
                      <p className="text-[11px]" style={{ color: tokens.text.muted }}>
                        {cat.verified}/{cat.total} verified
                      </p>
                    </div>
                    <div className="w-16 h-16 relative">
                      <svg className="w-16 h-16 -rotate-90" viewBox="0 0 36 36">
                        <circle
                          cx="18"
                          cy="18"
                          r="15.5"
                          fill="none"
                          stroke={tokens.neutral['100']}
                          strokeWidth="3"
                        />
                        <circle
                          cx="18"
                          cy="18"
                          r="15.5"
                          fill="none"
                          stroke={cat.color}
                          strokeWidth="3"
                          strokeDasharray={`${(cat.score / 100) * 97.4} 97.4`}
                          strokeLinecap="round"
                        />
                      </svg>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Trend Chart + Events Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Trust Trends Chart */}
        <Card className="lg:col-span-3">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold" style={{ color: tokens.text.primary }}>
              Trust Score Trends
            </CardTitle>
            <CardDescription>7-day trust score movement by category</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData} margin={{ top: 5, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke={tokens.border.default}
                    opacity={0.5}
                  />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke={tokens.text.muted} />
                  <YAxis domain={[60, 100]} tick={{ fontSize: 11 }} stroke={tokens.text.muted} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: tokens.surface.card,
                      border: `1px solid ${tokens.border.default}`,
                      borderRadius: '8px',
                      fontSize: '13px',
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="email"
                    stroke={lineColors.email}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    name="Email"
                  />
                  <Line
                    type="monotone"
                    dataKey="domain"
                    stroke={lineColors.domain}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    name="Domain"
                  />
                  <Line
                    type="monotone"
                    dataKey="signal"
                    stroke={lineColors.signal}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    name="Signal"
                  />
                  <Line
                    type="monotone"
                    dataKey="contact"
                    stroke={lineColors.contact}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    name="Contact"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div
              className="flex items-center justify-center gap-4 mt-3 text-[11px]"
              style={{ color: tokens.text.muted }}
            >
              {Object.entries(lineColors).map(([key, color]) => (
                <span key={key} className="flex items-center gap-1">
                  <span className="w-2.5 h-0.5 rounded" style={{ backgroundColor: color }} />
                  {key.charAt(0).toUpperCase() + key.slice(1)}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Trust Events */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold" style={{ color: tokens.text.primary }}>
              Recent Trust Events
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-0 max-h-80 overflow-y-auto">
              {trustEvents.map((evt, i) => (
                <div key={evt.id} className="flex gap-3 pb-4 relative">
                  {i < trustEvents.length - 1 && (
                    <div
                      className="absolute left-[15px] top-8 bottom-0 w-px"
                      style={{ backgroundColor: tokens.border.default }}
                    />
                  )}
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                    style={{ backgroundColor: `${tokens.neutral['100']}` }}
                  >
                    {eventIcons[evt.type]}
                  </div>
                  <div className="flex-1 min-w-0 pt-0.5">
                    <p className="text-sm leading-snug" style={{ color: tokens.text.primary }}>
                      {evt.event}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge
                        variant="outline"
                        className="text-[10px]"
                        style={{ borderColor: tokens.border.default, color: tokens.text.muted }}
                      >
                        {evt.category}
                      </Badge>
                      <span className="text-[11px]" style={{ color: tokens.text.muted }}>
                        {evt.time}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
