'use client';

import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Shield, Database, Brain, RefreshCw, CheckCircle2, Lock, Eye, FileDown, Activity, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { fetchApi } from '@/lib/fetchApi';
import { cn } from '@/lib/utils';

interface PlatformData {
  totalContacts: number; totalCompanies: number; totalOpportunities: number; totalPursuits: number;
  totalAIInsights: number; totalAuditLogs: number; totalUsers: number;
  consentBreakdown: { optedIn: number; optedOut: number; unknown: number };
  complianceScore: number; gdprReady: boolean;
  features: Record<string, boolean>;
  platformReadinessScore?: number; enterpriseReadinessScore?: number;
  readinessBreakdown: { data: number; security: number; ai: number };
  waveCompletion: Record<string, boolean>;
}

const FEATURE_ICONS: Record<string, React.ReactNode> = {
  authentication: <Lock className="h-4 w-4" />,
  sessionManagement: <Lock className="h-4 w-4" />,
  auditLogging: <Eye className="h-4 w-4" />,
  consentManagement: <CheckCircle2 className="h-4 w-4" />,
  dataExport: <FileDown className="h-4 w-4" />,
  aiIntelligence: <Brain className="h-4 w-4" />,
  revenueIntelligence: <Database className="h-4 w-4" />,
  pipelineIntelligence: <Activity className="h-4 w-4" />,
  salesExecution: <Shield className="h-4 w-4" />,
  revOps: <Database className="h-4 w-4" />,
  contactIntelligence: <Users className="h-4 w-4" />,
};

const FEATURE_LABELS: Record<string, string> = {
  authentication: 'Authentication', sessionManagement: 'Session Management', auditLogging: 'Audit Logging',
  consentManagement: 'Consent Management', suppressionManagement: 'Suppression Management',
  dataExport: 'Data Export', aiIntelligence: 'AI Intelligence', revenueIntelligence: 'Revenue Intelligence',
  pipelineIntelligence: 'Pipeline Intelligence', salesExecution: 'Sales Execution', revOps: 'RevOps',
  contactIntelligence: 'Contact Intelligence',
};

const WAVE_LABELS: Record<string, string> = {
  wave4_pipelineIntelligence: 'Wave 4: Pipeline Intelligence',
  wave5_contactIntelligence: 'Wave 5: Contact Intelligence',
  wave6_salesExecution: 'Wave 6: Sales Execution',
  wave7_revOps: 'Wave 7: RevOps',
  wave8_aiIntelligence: 'Wave 8: AI Intelligence Foundation',
  wave9_platformReadiness: 'Wave 9: Platform Readiness',
};

const FALLBACK: PlatformData = {
  totalContacts: 0, totalCompanies: 0, totalOpportunities: 0, totalPursuits: 0,
  totalAIInsights: 0, totalAuditLogs: 0, totalUsers: 0,
  consentBreakdown: { optedIn: 0, optedOut: 0, unknown: 0 },
  complianceScore: 0, gdprReady: false, features: {}, platformReadinessScore: 0,
  readinessBreakdown: { data: 0, security: 0, ai: 0 }, waveCompletion: {},
};

export default function PlatformReadinessScreen() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['enterprise'],
    queryFn: async (): Promise<PlatformData> => {
      const res = await fetchApi<PlatformData>('/api/enterprise');
      return res.data ?? FALLBACK;
    },
    refetchInterval: 120000,
  });

  const readinessScore = data?.platformReadinessScore ?? data?.enterpriseReadinessScore ?? 0;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-gray-700 to-gray-900 text-white"><Shield className="h-5 w-5" /></div>
          <div><h1 className="text-2xl font-bold tracking-tight">Platform Readiness</h1><p className="text-sm text-muted-foreground">SaaS platform maturity, compliance, and feature overview</p></div>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}><RefreshCw className="mr-2 h-3.5 w-3.5" /> Refresh</Button>
      </div>

      {isLoading && <div className="grid gap-4 md:grid-cols-4">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)}</div>}

      {data && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          {/* Readiness Score + Stats */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card className="bg-gradient-to-br from-gray-600/10 to-gray-800/5">
              <CardContent className="flex items-center gap-4 p-4">
                <div className="relative flex h-16 w-16 items-center justify-center">
                  <svg className="h-16 w-16 -rotate-90" viewBox="0 0 60 60"><circle cx="30" cy="30" r="25" fill="none" stroke="currentColor" className="text-muted/20" strokeWidth="5" /><circle cx="30" cy="30" r="25" fill="none" stroke={readinessScore >= 60 ? '#22c55e' : readinessScore >= 30 ? '#f59e0b' : '#ef4444'} strokeWidth="5" strokeDasharray={`${(readinessScore / 100) * 157} 157`} strokeLinecap="round" /></svg>
                  <span className="absolute text-lg font-bold">{readinessScore}</span>
                </div>
                <div><div className="text-xs text-muted-foreground">Platform Readiness</div><div className="text-sm font-medium">/ 100</div></div>
              </CardContent>
            </Card>
            <Kpi icon={<Database className="h-4 w-4" />} label="Data Records" value={data.totalContacts + data.totalCompanies} sub={`${data.totalContacts} contacts, ${data.totalCompanies} companies`} bg="from-blue-500/10 to-blue-600/5" iconBg="bg-blue-100 text-blue-600" />
            <Kpi icon={<Eye className="h-4 w-4" />} label="Audit Logs" value={data.totalAuditLogs} sub="total recorded events" bg="from-indigo-500/10 to-indigo-600/5" iconBg="bg-indigo-100 text-indigo-600" />
            <Kpi icon={<CheckCircle2 className="h-4 w-4" />} label="Compliance" value={`${data.complianceScore}%`} sub={data.gdprReady ? 'GDPR Ready' : 'Needs improvement'} bg={data.gdprReady ? 'from-green-500/10 to-green-600/5' : 'from-amber-500/10 to-amber-600/5'} iconBg={data.gdprReady ? 'bg-green-100 text-green-600' : 'bg-amber-100 text-amber-600'} />
          </div>

          {/* Maturity Breakdown */}
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">Platform Maturity</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {Object.entries(data.readinessBreakdown).map(([key, score]) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-sm">{key === 'data' ? 'Data Maturity' : key === 'security' ? 'Security Maturity' : 'AI Maturity'}</span>
                  <div className="flex items-center gap-2"><Progress value={score} className="h-2 w-32" /><span className="text-xs w-8 text-right">{score}</span></div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* SaaS Features */}
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">SaaS Platform Features</CardTitle></CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {Object.entries(data.features).map(([key, enabled]) => (
                  <div key={key} className={cn('flex items-center gap-3 rounded-lg border p-3', enabled ? 'border-green-200 bg-green-50/30' : 'border-muted bg-muted/30')}>
                    <div className={cn('flex h-8 w-8 items-center justify-center rounded-full', enabled ? 'bg-green-100 text-green-600' : 'bg-muted text-muted-foreground')}>{FEATURE_ICONS[key] || <CheckCircle2 className="h-4 w-4" />}</div>
                    <div><span className="text-sm font-medium">{FEATURE_LABELS[key] || key}</span><div className="text-xs text-muted-foreground">{enabled ? 'Enabled' : 'Not available'}</div></div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Wave Completion */}
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">Product Transformation — Wave Completion</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {Object.entries(data.waveCompletion).map(([key, complete]) => (
                  <div key={key} className="flex items-center justify-between rounded-lg border p-3">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className={cn('h-5 w-5', complete ? 'text-green-500' : 'text-muted-foreground')} />
                      <span className="text-sm font-medium">{WAVE_LABELS[key] || key}</span>
                    </div>
                    <Badge variant={complete ? 'default' : 'secondary'}>{complete ? 'Complete' : 'In Progress'}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Consent Distribution */}
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">GDPR Consent Distribution</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm"><span>Opted In</span><span className="font-semibold text-green-600">{data.consentBreakdown.optedIn}</span></div>
              <Progress value={data.totalContacts > 0 ? (data.consentBreakdown.optedIn / data.totalContacts) * 100 : 0} className="h-2" />
              <div className="flex justify-between text-sm"><span>Unknown</span><span className="font-semibold text-amber-600">{data.consentBreakdown.unknown}</span></div>
              <Progress value={data.totalContacts > 0 ? (data.consentBreakdown.unknown / data.totalContacts) * 100 : 0} className="h-2" />
              <div className="flex justify-between text-sm"><span>Opted Out</span><span className="font-semibold text-red-500">{data.consentBreakdown.optedOut}</span></div>
              <Progress value={data.totalContacts > 0 ? (data.consentBreakdown.optedOut / data.totalContacts) * 100 : 0} className="h-2" />
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}

function Kpi({ icon, label, value, sub, bg, iconBg }: { icon: React.ReactNode; label: string; value: string | number; sub: string; bg: string; iconBg: string }) {
  return (
    <Card className={cn('bg-gradient-to-br border', bg)}>
      <CardContent className="flex items-center gap-3 p-4">
        <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', iconBg)}>{icon}</div>
        <div><div className="text-xs text-muted-foreground">{label}</div><div className="text-xl font-bold">{value}</div><div className="text-xs text-muted-foreground">{sub}</div></div>
      </CardContent>
    </Card>
  );
}
