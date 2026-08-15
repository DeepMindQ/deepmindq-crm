'use client';

import { useState, useEffect } from 'react';
import { tokens } from '@/components/intelligence-os/design-tokens';
import { ScreenSkeleton } from '@/components/ui/screen-skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  ShieldCheck,
  Mail,
  Globe,
  Radio,
  TrendingUp,
  Lightbulb,
  ArrowRight,
  Clock,
  Building2,
  AlertCircle,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────

interface TrustDimension {
  key: string;
  label: string;
  score: number;
  detail: string;
}

interface TrustHistoryItem {
  date: string;
  score: number;
  event: string;
}

interface TrustRecommendation {
  priority: string;
  title: string;
  detail: string;
  action: string;
}

interface TrustScoreData {
  organizationId: string;
  organizationName: string;
  overallScore: number;
  dimensions: TrustDimension[];
  trustHistory: TrustHistoryItem[];
  recommendations: TrustRecommendation[];
}

const ICON_MAP: Record<string, typeof ShieldCheck> = {
  dataVerification: ShieldCheck,
  sourceDiversity: Globe,
  signalReliability: Radio,
  recency: Clock,
};

const COLOR_MAP: Record<string, string> = {
  dataVerification: '#3B82F6',
  sourceDiversity: '#8B5CF6',
  signalReliability: '#F59E0B',
  recency: '#10B981',
};

// ─── Component ─────────────────────────────────────────────────────────

export default function CompanyTrustDetail() {
  const [data, setData] = useState<TrustScoreData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchTrustScore() {
      try {
        setIsLoading(true);
        // Use the first organization as default demo target
        const res = await fetch('/api/organizations?take=1');
        if (!res.ok) throw new Error('Failed to fetch organizations');
        const orgs = await res.json();
        if (!orgs?.data?.length) {
          setError('No organizations found. Upload data to see trust scores.');
          setIsLoading(false);
          return;
        }

        const orgId = orgs.data[0].id;
        const trustRes = await fetch(`/api/trust-score/${orgId}`);
        if (!trustRes.ok) throw new Error('Failed to fetch trust score');
        const trustData = await trustRes.json();
        setData(trustData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoading(false);
      }
    }
    fetchTrustScore();
  }, []);

  if (isLoading) return <ScreenSkeleton rows={8} className="p-6" />;

  if (error || !data) {
    return (
      <div className="p-6">
        <div
          className="flex items-center gap-3 p-4 rounded-lg"
          style={{ backgroundColor: '#FEF2F2' }}
        >
          <AlertCircle className="size-5 text-red-500" />
          <div>
            <p className="text-sm font-medium text-red-800">{error || 'No data available'}</p>
            <p className="text-xs text-red-600 mt-1">
              Trust scores require at least one organization with data. Upload a CSV or enrich an
              existing entity.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const overallColor =
    data.overallScore >= 80 ? '#16A34A' : data.overallScore >= 60 ? '#D97706' : '#DC2626';
  const overallLabel =
    data.overallScore >= 80 ? 'High' : data.overallScore >= 60 ? 'Medium' : 'Low';

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Building2 className="size-4" style={{ color: tokens.text.secondary }} />
          <span className="text-sm" style={{ color: tokens.text.secondary }}>
            {data.organizationName}
          </span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: tokens.text.primary }}>
          Trust Score Detail
        </h1>
        <p className="text-sm mt-1" style={{ color: tokens.text.secondary }}>
          Data-driven trust assessment across four computed dimensions
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Score Ring */}
        <Card className="py-0 gap-0">
          <CardContent className="p-6 flex justify-center">
            <TrustScoreRing score={data.overallScore} color={overallColor} label={overallLabel} />
          </CardContent>
        </Card>

        {/* Dimensions */}
        <div className="lg:col-span-2 space-y-4">
          {data.dimensions.map((dim) => {
            const Icon = ICON_MAP[dim.key] || ShieldCheck;
            const color = COLOR_MAP[dim.key] || '#3B82F6';
            return (
              <Card key={dim.key} className="py-0 gap-0">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div
                      className="rounded-lg p-2 mt-0.5 shrink-0"
                      style={{ backgroundColor: `${color}15` }}
                    >
                      <Icon className="size-4" style={{ color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-medium" style={{ color: tokens.text.primary }}>
                          {dim.label}
                        </p>
                        <span className="text-sm font-mono font-bold" style={{ color }}>
                          {dim.score}
                        </span>
                      </div>
                      <Progress
                        value={dim.score}
                        className="h-2 mb-2"
                        style={{ '--progress-color': color } as React.CSSProperties}
                      />
                      <p className="text-xs" style={{ color: tokens.text.muted }}>
                        {dim.detail}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Trust History */}
        <Card className="py-0 gap-0">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="size-4" style={{ color: tokens.accent.primary }} />
              Trust History
            </CardTitle>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            {data.trustHistory.length > 0 ? (
              <div className="max-h-[320px] overflow-y-auto">
                {data.trustHistory.map((h, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 px-6 py-3 border-b last:border-b-0"
                    style={{ borderColor: tokens.borderFaint }}
                  >
                    <div className="flex flex-col items-center">
                      <span
                        className="text-lg font-bold"
                        style={{ color: h.score >= 75 ? '#16A34A' : '#D97706' }}
                      >
                        {h.score}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm" style={{ color: tokens.text.primary }}>
                        {h.event}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: tokens.text.muted }}>
                        {h.date}
                      </p>
                    </div>
                    {h.score > (data.trustHistory[i + 1]?.score ?? 0) ? (
                      <TrendingUp className="size-4 text-emerald-400 shrink-0" />
                    ) : (
                      <TrendingUp className="size-4 text-red-400 rotate-180 shrink-0" />
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="px-6 py-8 text-center">
                <p className="text-sm" style={{ color: tokens.text.muted }}>
                  No trust history available. Evidence records create trust history entries.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recommendations */}
        <Card className="py-0 gap-0">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Lightbulb className="size-4" style={{ color: tokens.gold.dark }} />
              Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            <div className="max-h-[320px] overflow-y-auto">
              {data.recommendations.map((rec, i) => (
                <div
                  key={i}
                  className="px-6 py-3 border-b last:border-b-0 space-y-2"
                  style={{ borderColor: tokens.borderFaint }}
                >
                  <div className="flex items-center gap-2">
                    <PriorityBadge priority={rec.priority} />
                    <p className="text-sm font-medium" style={{ color: tokens.text.primary }}>
                      {rec.title}
                    </p>
                  </div>
                  <p className="text-xs" style={{ color: tokens.text.secondary }}>
                    {rec.detail}
                  </p>
                  <button
                    className="text-xs flex items-center gap-1 hover:underline"
                    style={{ color: tokens.accent.primary }}
                  >
                    {rec.action} <ArrowRight className="size-3" />
                  </button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────

function TrustScoreRing({ score, color, label }: { score: number; color: string; label: string }) {
  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className="relative flex items-center justify-center"
        style={{ width: 150, height: 150 }}
      >
        <svg width="150" height="150" className="-rotate-90">
          <circle
            cx="75"
            cy="75"
            r={radius}
            fill="none"
            stroke={tokens.border.default}
            strokeWidth="10"
          />
          <circle
            cx="75"
            cy="75"
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-all duration-1000"
          />
        </svg>
        <div className="absolute flex flex-col items-center">
          <span className="text-4xl font-bold" style={{ color }}>
            {score}
          </span>
          <span className="text-xs" style={{ color: tokens.text.muted }}>
            out of 100
          </span>
        </div>
      </div>
      <Badge
        className={`${score >= 80 ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-400' : 'border-amber-500/40 bg-amber-500/15 text-amber-400'}`}
      >
        {label} Trust
      </Badge>
    </div>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const cls: Record<string, string> = {
    high: 'border-red-500/40 bg-red-500/15 text-red-400',
    medium: 'border-amber-500/40 bg-amber-500/15 text-amber-400',
    low: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-400',
  };
  return <Badge className={cls[priority] || ''}>{priority}</Badge>;
}
