'use client'

import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart3, Loader2, TrendingUp, DollarSign, Target, Percent, ShieldCheck,
  ArrowUpDown, ChevronDown, AlertTriangle, Lightbulb, Trophy, Users, Mail,
  Building2, Activity, CalendarDays, ArrowRight,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, LineChart, Line, CartesianGrid,
} from 'recharts'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'

/* ═══════════════════════════════════════════════════════════════════════
   Types (local to this screen — maps to API response shapes)
   ═══════════════════════════════════════════════════════════════════════ */

interface PipelineStageData {
  stage: string
  count: number
  value: number
  avgDaysInStage: number
  conversionRate: number
}

interface PipelineData {
  stages: PipelineStageData[]
  totalPipelineValue: number
  weightedPipelineValue: number
  stageVelocity: number
  winRate: number
  avgDealSize: number
  dealCountByMonth: Array<{ month: string; count: number }>
}

interface ForecastMonth {
  month: string
  projected: number
  conservative: number
  optimistic: number
}

interface RevenueData {
  currentMonth: { revenue: number; deals: number }
  forecast: ForecastMonth[]
  pipelineByStage: Array<{ stage: string; value: number }>
  topDeals: Array<{ title: string; company: string; value: number; probability: number; stage: string }>
}

interface ActivityData {
  totalActivities: number
  byType: Array<{ action: string; count: number }>
  byDay: Array<{ date: string; count: number }>
  emailsGenerated: number
  emailsSent: number
  researchGenerated: number
  healthChecksRun: number
  notesCreated: number
  activityHeatmap: Array<{ hour: number; day: number; count: number }>
  topUsers: Array<{ name: string; activities: number }>
}

interface TeamUser {
  userId: string
  name: string
  companiesOwned: number
  contactsCreated: number
  emailsGenerated: number
  emailsSent: number
  dealsWon: number
  dealsLost: number
  winRate: number
  revenue: number
  activities: number
  lastActive: string
}

interface TeamData {
  users: TeamUser[]
  leaderboard: 'companies' | 'emails' | 'deals'
}

interface DQEntity {
  total: number
  completenessByField: Record<string, number>
}

interface DQCompanies extends DQEntity {
  withDomain: number
  withWebsite: number
  withIndustry: number
  withEmployeeSize: number
  withCountry: number
  withLocation: number
  withResearchCard: number
}

interface DQContacts extends DQEntity {
  withEmail: number
  withJobTitle: number
  withPhone: number
  withLocation: number
  withLinkedin: number
  emailHealthBreakdown: { valid: number; risky: number; invalid: number; unknown: number }
}

interface DataQualityData {
  overall: { score: number; total: number; complete: number; partial: number; empty: number }
  companies: DQCompanies
  contacts: DQContacts
  recommendations: string[]
}

/* ═══════════════════════════════════════════════════════════════════════
   Constants
   ═══════════════════════════════════════════════════════════════════════ */

const CHART_COLORS = ['#d97706', '#2563eb', '#059669', '#7c3aed', '#dc2626', '#6b7280']
const PIPELINE_COLORS: Record<string, string> = {
  Researching: '#d97706',
  Qualified: '#7c3aed',
  Proposal: '#2563eb',
  Negotiation: '#059669',
  Won: '#059669',
  Lost: '#dc2626',
}
const EMAIL_HEALTH_COLORS: Record<string, string> = {
  valid: '#059669',
  risky: '#d97706',
  invalid: '#dc2626',
  unknown: '#6b7280',
}
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const DATE_PRESETS = [
  { label: 'Last 7 days', value: '7d' },
  { label: 'Last 30 days', value: '30d' },
  { label: 'Last 90 days', value: '90d' },
  { label: 'This Quarter', value: 'quarter' },
  { label: 'This Year', value: 'year' },
] as const

type SortDir = 'asc' | 'desc'
type SortKey = 'count' | 'value' | 'avgDaysInStage' | 'conversionRate'

/* ═══════════════════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════════════════ */

function getDateRange(preset: string) {
  const now = new Date()
  const from = new Date()
  const to = new Date()
  to.setDate(to.getDate() + 1)

  switch (preset) {
    case '7d': from.setDate(from.getDate() - 7); break
    case '30d': from.setDate(from.getDate() - 30); break
    case '90d': from.setDate(from.getDate() - 90); break
    case 'quarter': {
      const q = Math.floor(now.getMonth() / 3)
      from.setMonth(q * 3, 1)
      break
    }
    case 'year': from.setMonth(0, 1); break
  }
  return {
    from: from.toISOString().split('T')[0],
    to: to.toISOString().split('T')[0],
  }
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(Math.round(n * 100) / 100)
}

/* ═══════════════════════════════════════════════════════════════════════
   Skeleton Loader
   ═══════════════════════════════════════════════════════════════════════ */

function ReportsSkeleton() {
  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-9 w-40" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <div className="grid md:grid-cols-2 gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-80 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-96 rounded-xl" />
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════
   Custom Tooltips
   ═══════════════════════════════════════════════════════════════════════ */

function SimpleTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string; color?: string }>; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-100 px-3 py-2 text-sm">
      {label && <p className="font-medium text-gray-700 mb-1">{label}</p>}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          {p.color && <span className="inline-block size-2.5 rounded-full" style={{ backgroundColor: p.color }} />}
          <span className="text-gray-500">{p.name}:</span>
          <span className="font-semibold text-gray-900 tabular-nums">{formatNumber(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

function PipelineTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: PipelineStageData }> }) {
  if (!active || !payload?.length) return null
  const s = payload[0].payload
  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-100 px-3 py-2 text-sm">
      <p className="font-semibold text-gray-900">{s.stage}</p>
      <p className="text-gray-500">{s.count} deals · {s.avgDaysInStage}d avg</p>
      <p className="text-gray-500">{s.conversionRate}% conversion</p>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════
   Reports Screen
   ═══════════════════════════════════════════════════════════════════════ */

export function ReportsScreen() {
  const [datePreset, setDatePreset] = useState('30d')
  const [pipelineSort, setPipelineSort] = useState<SortKey>('count')
  const [pipelineSortDir, setPipelineSortDir] = useState<SortDir>('desc')
  const [teamSort, setTeamSort] = useState<keyof TeamUser>('activities')
  const [teamSortDir, setTeamSortDir] = useState<SortDir>('desc')

  const dateRange = useMemo(() => getDateRange(datePreset), [datePreset])

  const pipelineQuery = useQuery<PipelineData>({
    queryKey: ['reports', 'pipeline', dateRange],
    queryFn: () => fetch(`/api/reports/pipeline?from=${dateRange.from}&to=${dateRange.to}`).then(r => r.json()),
  })

  const revenueQuery = useQuery<RevenueData>({
    queryKey: ['reports', 'revenue'],
    queryFn: () => fetch('/api/reports/revenue?months=6').then(r => r.json()),
  })

  const activityQuery = useQuery<ActivityData>({
    queryKey: ['reports', 'activity', dateRange],
    queryFn: () => fetch(`/api/reports/activity?from=${dateRange.from}&to=${dateRange.to}`).then(r => r.json()),
  })

  const teamQuery = useQuery<TeamData>({
    queryKey: ['reports', 'team'],
    queryFn: () => fetch('/api/reports/team-performance').then(r => r.json()),
  })

  const dqQuery = useQuery<DataQualityData>({
    queryKey: ['reports', 'data-quality'],
    queryFn: () => fetch('/api/reports/data-quality').then(r => r.json()),
  })

  const isLoading = pipelineQuery.isLoading || revenueQuery.isLoading || activityQuery.isLoading || dqQuery.isLoading

  if (isLoading) return <ReportsSkeleton />

  const pipeline = pipelineQuery.data
  const revenue = revenueQuery.data
  const activity = activityQuery.data
  const team = teamQuery.data
  const dq = dqQuery.data

  // ── KPI values ───────────────────────────────────────────────
  const kpis = [
    {
      label: 'Total Pipeline',
      value: pipeline ? String(pipeline.totalPipelineValue) : '—',
      sub: 'active deals',
      icon: Target,
      bg: 'bg-amber-50',
      color: 'text-amber-600',
    },
    {
      label: 'Weighted Forecast',
      value: pipeline ? formatNumber(pipeline.weightedPipelineValue) : '—',
      sub: 'probability-adjusted',
      icon: TrendingUp,
      bg: 'bg-blue-50',
      color: 'text-blue-600',
    },
    {
      label: 'Win Rate',
      value: pipeline ? `${pipeline.winRate}%` : '—',
      sub: 'won vs lost',
      icon: Percent,
      bg: 'bg-emerald-50',
      color: 'text-emerald-600',
    },
    {
      label: 'Avg Deal Size',
      value: pipeline ? String(pipeline.avgDealSize) : '—',
      sub: 'per opportunity',
      icon: DollarSign,
      bg: 'bg-violet-50',
      color: 'text-violet-600',
    },
    {
      label: 'Data Quality',
      value: dq ? `${dq.overall.score}%` : '—',
      sub: 'completeness score',
      icon: ShieldCheck,
      bg: 'bg-red-50',
      color: 'text-red-600',
    },
  ]

  // ── Pipeline data sorted ─────────────────────────────────────
  const sortedStages = useMemo(() => {
    if (!pipeline?.stages) return []
    return [...pipeline.stages].sort((a, b) => {
      const aVal = a[pipelineSort]
      const bVal = b[pipelineSort]
      return pipelineSortDir === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number)
    })
  }, [pipeline, pipelineSort, pipelineSortDir])

  // ── Team data sorted ─────────────────────────────────────────
  const sortedTeam = useMemo(() => {
    if (!team?.users) return []
    return [...team.users].sort((a, b) => {
      const aVal = typeof a[teamSort] === 'number' ? a[teamSort] : 0
      const bVal = typeof b[teamSort] === 'number' ? b[teamSort] : 0
      return teamSortDir === 'asc' ? aVal - bVal : bVal - aVal
    })
  }, [team, teamSort, teamSortDir])

  // ── Activity heatmap data (max 5 days for display) ───────────
  const heatmapMax = useMemo(() => {
    if (!activity?.activityHeatmap) return 1
    return Math.max(...activity.activityHeatmap.map(h => h.count), 1)
  }, [activity])

  // ── Email health pie data ────────────────────────────────────
  const emailHealthPie = useMemo(() => {
    if (!dq) return []
    const b = dq.contacts.emailHealthBreakdown
    return [
      { name: 'Valid', value: b.valid, color: EMAIL_HEALTH_COLORS.valid },
      { name: 'Risky', value: b.risky, color: EMAIL_HEALTH_COLORS.risky },
      { name: 'Invalid', value: b.invalid, color: EMAIL_HEALTH_COLORS.invalid },
      { name: 'Unknown', value: b.unknown, color: EMAIL_HEALTH_COLORS.unknown },
    ].filter(d => d.value > 0)
  }, [dq])

  // ── Revenue forecast chart data ──────────────────────────────
  const forecastChartData = useMemo(() => {
    if (!revenue) return []
    return revenue.forecast.map(f => ({
      month: f.month,
      Projected: f.projected,
      Conservative: f.conservative,
      Optimistic: f.optimistic,
    }))
  }, [revenue])

  // ── Pipeline funnel data (horizontal bars) ───────────────────
  const funnelData = useMemo(() => {
    if (!pipeline?.stages) return []
    const activeStages = pipeline.stages.filter(s => s.stage !== 'Won' && s.stage !== 'Lost')
    return activeStages.map(s => ({
      stage: s.stage,
      count: s.count,
      fill: PIPELINE_COLORS[s.stage] ?? '#6b7280',
    }))
  }, [pipeline])

  // ── Top performer ────────────────────────────────────────────
  const topPerformer = team?.users?.[0]

  function togglePipelineSort(key: SortKey) {
    if (pipelineSort === key) {
      setPipelineSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setPipelineSort(key)
      setPipelineSortDir('desc')
    }
  }

  function toggleTeamSort(key: keyof TeamUser) {
    if (teamSort === key) {
      setTeamSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setTeamSort(key)
      setTeamSortDir('desc')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50/50">
      {/* ── Header ────────────────────────────────────────────── */}
      <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-md border-b border-gray-200">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-50">
              <BarChart3 className="size-5 text-amber-600" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Analytics</h1>
              <p className="text-sm text-gray-500">Comprehensive reports and insights</p>
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2">
                <CalendarDays className="size-4 text-gray-500" />
                {DATE_PRESETS.find(p => p.value === datePreset)?.label ?? 'Last 30 days'}
                <ChevronDown className="size-3.5 text-gray-400" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {DATE_PRESETS.map(p => (
                <DropdownMenuItem
                  key={p.value}
                  onClick={() => setDatePreset(p.value)}
                  className={cn(p.value === datePreset && 'bg-amber-50 text-amber-700')}
                >
                  {p.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* ── KPI Row ──────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {kpis.map((kpi) => (
            <Card key={kpi.label} className="shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={cn('p-2 rounded-lg', kpi.bg)}>
                    <kpi.icon className={cn('size-4', kpi.color)} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide truncate">{kpi.label}</p>
                    <p className="text-2xl font-bold text-gray-900 tabular-nums">{kpi.value}</p>
                    <p className="text-xs text-gray-400">{kpi.sub}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* ── Charts Grid ──────────────────────────────────────── */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Pipeline Funnel */}
          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Pipeline Funnel</CardTitle>
              <CardDescription>Deals by stage with conversion rates</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={funnelData} layout="vertical" margin={{ left: 10, right: 30, top: 5, bottom: 5 }}>
                  <XAxis type="number" tick={{ fontSize: 12, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="stage" width={90} tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<PipelineTooltip />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
                  <Bar dataKey="count" radius={[0, 6, 6, 0]} barSize={28}>
                    {funnelData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Revenue Forecast */}
          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Revenue Forecast</CardTitle>
              <CardDescription>Projected, conservative, and optimistic</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={forecastChartData} margin={{ left: -10, right: 10, top: 5, bottom: 5 }}>
                  <defs>
                    <linearGradient id="projectedGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#d97706" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#d97706" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="optimisticGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#059669" stopOpacity={0.1} />
                      <stop offset="95%" stopColor="#059669" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="conservativeGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#dc2626" stopOpacity={0.1} />
                      <stop offset="95%" stopColor="#dc2626" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<SimpleTooltip />} />
                  <Area type="monotone" dataKey="Optimistic" stroke="#059669" fill="url(#optimisticGrad)" strokeWidth={1.5} strokeDasharray="4 2" />
                  <Area type="monotone" dataKey="Projected" stroke="#d97706" fill="url(#projectedGrad)" strokeWidth={2} />
                  <Area type="monotone" dataKey="Conservative" stroke="#dc2626" fill="url(#conservativeGrad)" strokeWidth={1.5} strokeDasharray="4 2" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Activity Trend */}
          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-semibold">Activity Trend</CardTitle>
                  <CardDescription>Daily activity count (last 30 days)</CardDescription>
                </div>
                {activity && (
                  <Badge variant="secondary" className="text-xs font-normal bg-amber-50 text-amber-700 border-amber-200">
                    {activity.totalActivities} total
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={activity?.byDay ?? []} margin={{ left: -10, right: 10, top: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: '#9ca3af' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v: string) => v.slice(5)}
                  />
                  <YAxis tick={{ fontSize: 12, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null
                      return (
                        <div className="bg-white rounded-lg shadow-lg border border-gray-100 px-3 py-2 text-sm">
                          <p className="font-medium text-gray-700">{label}</p>
                          <p className="text-gray-900 font-semibold tabular-nums">{payload[0].value} activities</p>
                        </div>
                      )
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke="#d97706"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 2, fill: 'white', stroke: '#d97706' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Email Health Distribution */}
          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Email Health Distribution</CardTitle>
              <CardDescription>Contact email validation status</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-6">
                <ResponsiveContainer width="50%" height={220}>
                  <PieChart>
                    <Pie
                      data={emailHealthPie}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={90}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {emailHealthPie.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null
                        const d = payload[0].payload
                        return (
                          <div className="bg-white rounded-lg shadow-lg border border-gray-100 px-3 py-2 text-sm">
                            <div className="flex items-center gap-2">
                              <span className="inline-block size-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                              <span className="font-medium text-gray-900">{d.name}</span>
                            </div>
                            <p className="text-gray-500 tabular-nums ml-4">{d.value} contacts</p>
                          </div>
                        )
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-3">
                  {emailHealthPie.map(d => (
                    <div key={d.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="inline-block size-3 rounded-full" style={{ backgroundColor: d.color }} />
                        <span className="text-sm text-gray-700">{d.name}</span>
                      </div>
                      <span className="text-sm font-semibold text-gray-900 tabular-nums">{d.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Tables Section ───────────────────────────────────── */}
        <Tabs defaultValue="team" className="space-y-4">
          <TabsList className="bg-white border border-gray-200 p-1">
            <TabsTrigger value="team" className="gap-1.5 text-sm data-[state=active]:bg-amber-50 data-[state=active]:text-amber-700">
              <Users className="size-3.5" /> Team Performance
            </TabsTrigger>
            <TabsTrigger value="quality" className="gap-1.5 text-sm data-[state=active]:bg-amber-50 data-[state=active]:text-amber-700">
              <ShieldCheck className="size-3.5" /> Data Quality
            </TabsTrigger>
            <TabsTrigger value="deals" className="gap-1.5 text-sm data-[state=active]:bg-amber-50 data-[state=active]:text-amber-700">
              <Target className="size-3.5" /> Top Deals
            </TabsTrigger>
          </TabsList>

          {/* ── Team Performance Tab ─────────────────────────────── */}
          <TabsContent value="team">
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base font-semibold">Team Performance</CardTitle>
                    <CardDescription>Per-user activity and metrics</CardDescription>
                  </div>
                  {topPerformer && (
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200">
                      <Trophy className="size-4 text-amber-500" />
                      <span className="text-sm font-medium text-amber-700">Top: {topPerformer.name}</span>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto max-h-96 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="w-[160px]">
                          <Button variant="ghost" size="sm" className="h-auto p-0 font-semibold text-xs" onClick={() => toggleTeamSort('name')}>
                            User <ArrowUpDown className="size-3 ml-1" />
                          </Button>
                        </TableHead>
                        <TableHead>
                          <Button variant="ghost" size="sm" className="h-auto p-0 font-semibold text-xs" onClick={() => toggleTeamSort('companiesOwned')}>
                            Companies <ArrowUpDown className="size-3 ml-1" />
                          </Button>
                        </TableHead>
                        <TableHead>
                          <Button variant="ghost" size="sm" className="h-auto p-0 font-semibold text-xs" onClick={() => toggleTeamSort('contactsCreated')}>
                            Contacts <ArrowUpDown className="size-3 ml-1" />
                          </Button>
                        </TableHead>
                        <TableHead>
                          <Button variant="ghost" size="sm" className="h-auto p-0 font-semibold text-xs" onClick={() => toggleTeamSort('emailsGenerated')}>
                            Emails Gen <ArrowUpDown className="size-3 ml-1" />
                          </Button>
                        </TableHead>
                        <TableHead>
                          <Button variant="ghost" size="sm" className="h-auto p-0 font-semibold text-xs" onClick={() => toggleTeamSort('dealsWon')}>
                            Won <ArrowUpDown className="size-3 ml-1" />
                          </Button>
                        </TableHead>
                        <TableHead>
                          <Button variant="ghost" size="sm" className="h-auto p-0 font-semibold text-xs" onClick={() => toggleTeamSort('winRate')}>
                            Win Rate <ArrowUpDown className="size-3 ml-1" />
                          </Button>
                        </TableHead>
                        <TableHead>
                          <Button variant="ghost" size="sm" className="h-auto p-0 font-semibold text-xs" onClick={() => toggleTeamSort('activities')}>
                            Activities <ArrowUpDown className="size-3 ml-1" />
                          </Button>
                        </TableHead>
                        <TableHead className="text-xs font-semibold">Last Active</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedTeam.map((user, i) => (
                        <TableRow key={user.userId} className={cn(i === 0 && 'bg-amber-50/50')}>
                          <TableCell className="font-medium text-sm">
                            <div className="flex items-center gap-2">
                              {i === 0 && <Trophy className="size-3.5 text-amber-500" />}
                              {user.name}
                            </div>
                          </TableCell>
                          <TableCell className="tabular-nums text-sm">{user.companiesOwned}</TableCell>
                          <TableCell className="tabular-nums text-sm">{user.contactsCreated}</TableCell>
                          <TableCell className="tabular-nums text-sm">{user.emailsGenerated}</TableCell>
                          <TableCell className="tabular-nums text-sm text-emerald-600 font-medium">{user.dealsWon}</TableCell>
                          <TableCell className="tabular-nums text-sm">{user.winRate}%</TableCell>
                          <TableCell className="tabular-nums text-sm font-medium">{user.activities}</TableCell>
                          <TableCell className="text-xs text-gray-500">
                            {user.lastActive && user.lastActive > '1970-01-01'
                              ? formatDistanceToNow(new Date(user.lastActive), { addSuffix: true })
                              : '—'}
                          </TableCell>
                        </TableRow>
                      ))}
                      {sortedTeam.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center text-sm text-gray-400 py-8">
                            No team data available
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Data Quality Tab ─────────────────────────────────── */}
          <TabsContent value="quality">
            <div className="grid md:grid-cols-2 gap-6">
              {/* Field Completeness */}
              <Card className="shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold">Field Completeness</CardTitle>
                  <CardDescription>How well populated your data is</CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Companies ({dq?.companies.total ?? 0})</h4>
                    <div className="space-y-2.5">
                      {dq && Object.entries(dq.companies.completenessByField).map(([field, pct]) => (
                        <div key={field} className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-700">{field}</span>
                            <span className={cn('tabular-nums font-medium', pct >= 80 ? 'text-emerald-600' : pct >= 50 ? 'text-amber-600' : 'text-red-600')}>
                              {pct}%
                            </span>
                          </div>
                          <Progress value={pct} className="h-2" />
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Contacts ({dq?.contacts.total ?? 0})</h4>
                    <div className="space-y-2.5">
                      {dq && Object.entries(dq.contacts.completenessByField).map(([field, pct]) => (
                        <div key={field} className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-700">{field}</span>
                            <span className={cn('tabular-nums font-medium', pct >= 80 ? 'text-emerald-600' : pct >= 50 ? 'text-amber-600' : 'text-red-600')}>
                              {pct}%
                            </span>
                          </div>
                          <Progress value={pct} className="h-2" />
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Recommendations */}
              <Card className="shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold">Recommendations</CardTitle>
                  <CardDescription>Suggestions to improve your data quality</CardDescription>
                </CardHeader>
                <CardContent>
                  {dq && dq.recommendations.length > 0 ? (
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {dq.recommendations.map((rec, i) => (
                        <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-amber-50/60 border border-amber-100">
                          <Lightbulb className="size-4 text-amber-500 mt-0.5 shrink-0" />
                          <p className="text-sm text-gray-700">{rec}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12 text-gray-400">
                      <ShieldCheck className="size-8 mx-auto mb-2 text-emerald-600" />
                      <p className="text-sm">Your data looks great! No recommendations.</p>
                    </div>
                  )}

                  {/* Overall stats */}
                  {dq && (
                    <div className="mt-6 pt-6 border-t border-gray-100">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="text-center p-3 rounded-lg bg-gray-50">
                          <p className="text-2xl font-bold text-emerald-600 tabular-nums">{dq.overall.complete}</p>
                          <p className="text-xs text-gray-500 mt-1">Complete Records</p>
                        </div>
                        <div className="text-center p-3 rounded-lg bg-gray-50">
                          <p className="text-2xl font-bold text-amber-600 tabular-nums">{dq.overall.partial}</p>
                          <p className="text-xs text-gray-500 mt-1">Partial Records</p>
                        </div>
                        <div className="text-center p-3 rounded-lg bg-gray-50">
                          <p className="text-2xl font-bold text-red-600 tabular-nums">{dq.overall.empty}</p>
                          <p className="text-xs text-gray-500 mt-1">Empty Records</p>
                        </div>
                        <div className="text-center p-3 rounded-lg bg-gray-50">
                          <p className="text-2xl font-bold text-gray-900 tabular-nums">{dq.overall.score}%</p>
                          <p className="text-xs text-gray-500 mt-1">Overall Score</p>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ── Top Deals Tab ─────────────────────────────────────── */}
          <TabsContent value="deals">
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold">Top Pipeline Deals</CardTitle>
                <CardDescription>Highest probability deals in the pipeline</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto max-h-96 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="text-xs font-semibold">Deal</TableHead>
                        <TableHead className="text-xs font-semibold">Company</TableHead>
                        <TableHead className="text-xs font-semibold">Stage</TableHead>
                        <TableHead className="text-xs font-semibold">Probability</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {revenue?.topDeals.map((deal, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium text-sm">{deal.title}</TableCell>
                          <TableCell className="text-sm text-gray-600">{deal.company}</TableCell>
                          <TableCell>
                            <Badge
                              variant="secondary"
                              className={cn(
                                'text-xs capitalize',
                                deal.stage === 'negotiation' && 'bg-emerald-50 text-emerald-700 border-emerald-200',
                                deal.stage === 'proposal' && 'bg-blue-50 text-blue-700 border-blue-200',
                                deal.stage === 'qualified' && 'bg-violet-50 text-violet-700 border-violet-200',
                                deal.stage === 'researching' && 'bg-amber-50 text-amber-700 border-amber-200',
                              )}
                            >
                              {deal.stage}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Progress value={deal.probability} className="h-2 w-20" />
                              <span className="text-sm tabular-nums font-medium text-gray-700">{deal.probability}%</span>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      {(!revenue?.topDeals || revenue.topDeals.length === 0) && (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-sm text-gray-400 py-8">
                            No deals in pipeline
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}