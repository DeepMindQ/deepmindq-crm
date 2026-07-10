'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Building2, Users, ShieldCheck, ShieldAlert, TrendingUp, Sparkles,
  ArrowRight, Clock, CheckCircle2, Loader2,
} from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/lib/store'
import { EmptyState, TrendIndicator, Sparkline, getActivityIcon, SkeletonGrid } from '@/components/shared/design-system'

interface PipelineStage {
  label: string
  count: number
}

interface DashboardTask {
  id: string
  title: string | null
  company: string
  contact: string | null
  status: string
  opportunityId: string
}

interface DashboardData {
  totalCompanies: number
  totalContacts: number
  healthyEmails: number
  riskyEmails: number
  invalidEmails: number
  archivedContacts: number
  newThisWeek: number
  draftsGenerated: number
  recentActivity: Array<{
    id: string
    action: string
    details: string | null
    createdAt: string
    companyId?: string | null
    contactId?: string | null
    company?: { id: string; name: string } | null
    contact?: { id: string; name: string } | null
  }>
  pipeline: PipelineStage[]
  sparklines: {
    companies: number[]
    contacts: number[]
    healthy: number[]
    invalid: number[]
  }
  trends: {
    companies: number
    contacts: number
    healthy: number
    invalid: number
    newThisWeek: number
    drafts: number
  }
  tasks: DashboardTask[]
}

const pipelineColors: Record<string, { color: string; bg: string }> = {
  New: { color: '#6B7280', bg: '#F3F4F6' },
  Researching: { color: '#D97706', bg: '#FFFBEB' },
  Contacted: { color: '#2563EB', bg: '#EFF6FF' },
  Qualified: { color: '#7C3AED', bg: '#F5F3FF' },
  Ready: { color: '#059669', bg: '#ECFDF5' },
  Won: { color: '#16A34A', bg: '#F0FDF4' },
  Lost: { color: '#DC2626', bg: '#FEF2F2' },
}

const statusPriorityStyle: Record<string, string> = {
  researching: 'bg-amber-50 text-amber-700 border-amber-100',
  contacted: 'bg-blue-50 text-blue-700 border-blue-100',
  qualified: 'bg-violet-50 text-violet-700 border-violet-100',
  ready: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  new: 'bg-gray-100 text-gray-600 border-gray-200',
}

export function DashboardScreen() {
  const { setActiveView, setCompanyStatusFilter, setSelectedCompanyId, setSelectedContactId } = useAppStore()
  const qc = useQueryClient()

  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ['dashboard'],
    queryFn: () => fetch('/api/dashboard').then(r => r.json()),
  })

  const completeMutation = useMutation({
    mutationFn: (id: string) =>
      fetch('/api/opportunities', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: 'won' }),
      }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })

  if (isLoading) return <SkeletonGrid cols={4} panels={3} />

  const isEmpty = !data || (data.totalCompanies === 0 && data.totalContacts === 0)

  if (isEmpty) {
    return (
      <div className="space-y-8 max-w-lg mx-auto">
        <div className="text-center pt-8">
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Welcome to DeepMindQ</h2>
          <p className="text-gray-500 mt-2 text-sm leading-relaxed">
            Your AI-powered sales intelligence workspace. Start by importing your first list of companies and contacts.
          </p>
        </div>
        <EmptyState
          icon={Building2}
          title="No companies yet"
          description="Import a CSV with your target accounts, or add companies manually to get started with AI-powered research and outreach."
          actionLabel="Import CSV"
          onAction={() => setActiveView('import')}
          secondaryActionLabel="Add Company"
          onSecondaryAction={() => setActiveView('companies')}
        />
      </div>
    )
  }

  const total = (data.healthyEmails || 0) + (data.riskyEmails || 0) + (data.invalidEmails || 0) || 1
  const validPct = Math.round(((data.healthyEmails || 0) / total) * 100)
  const riskyPct = Math.round(((data.riskyEmails || 0) / total) * 100)
  const invalidPct = 100 - validPct - riskyPct

  const pipelineStages = data.pipeline || []
  const maxPipeline = Math.max(...pipelineStages.map(s => s.count), 1)

  const kpis = [
    {
      label: 'Companies',
      value: data.totalCompanies,
      icon: Building2,
      iconBg: 'bg-blue-50',
      iconColor: 'text-blue-600',
      trend: data.trends?.companies ?? 0,
      sparkData: data.sparklines?.companies,
      sparkColor: '#2563EB',
    },
    {
      label: 'Contacts',
      value: data.totalContacts,
      icon: Users,
      iconBg: 'bg-violet-50',
      iconColor: 'text-violet-600',
      trend: data.trends?.contacts ?? 0,
      sparkData: data.sparklines?.contacts,
      sparkColor: '#7C3AED',
    },
    {
      label: 'Healthy Emails',
      value: data.healthyEmails,
      icon: ShieldCheck,
      iconBg: 'bg-emerald-50',
      iconColor: 'text-emerald-600',
      trend: data.trends?.healthy ?? 0,
      sparkData: data.sparklines?.healthy,
      sparkColor: '#059669',
    },
    {
      label: 'Invalid Emails',
      value: data.invalidEmails,
      icon: ShieldAlert,
      iconBg: 'bg-red-50',
      iconColor: 'text-red-500',
      trend: data.trends?.invalid ?? 0,
      sparkData: data.sparklines?.invalid,
      sparkColor: '#EF4444',
    },
  ]

  const secondaryKpis = [
    {
      label: 'New This Week',
      value: data.newThisWeek,
      icon: TrendingUp,
      iconBg: 'bg-amber-50',
      iconColor: 'text-amber-600',
      trend: data.trends?.newThisWeek ?? 0,
      sparkData: data.sparklines?.companies,
      sparkColor: '#D97706',
    },
    {
      label: 'AI Drafts Generated',
      value: data.draftsGenerated,
      icon: Sparkles,
      iconBg: 'bg-indigo-50',
      iconColor: 'text-indigo-600',
      trend: data.trends?.drafts ?? 0,
      sparkData: data.sparklines?.contacts,
      sparkColor: '#6366F1',
    },
  ]

  const tasks = data.tasks || []

  return (
    <div className="space-y-6">
      {/* ── Primary KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((m, i) => {
          const Icon = m.icon
          return (
            <div
              key={m.label}
              className="card-interactive rounded-xl bg-white p-5 group slide-up"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <div className="flex items-start justify-between mb-3">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{m.label}</p>
                <div className={`rounded-xl p-2 ${m.iconBg} transition-transform duration-200 group-hover:scale-110`}>
                  <Icon className={`size-4 ${m.iconColor}`} />
                </div>
              </div>
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-2xl font-bold text-gray-900 tracking-tight tabular-nums">
                    {m.value.toLocaleString()}
                  </p>
                  <TrendIndicator value={m.trend} className="mt-1.5" />
                </div>
                {m.sparkData && <Sparkline data={m.sparkData} color={m.sparkColor} />}
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Secondary KPIs ── */}
      <div className="grid grid-cols-2 gap-4">
        {secondaryKpis.map((m, i) => {
          const Icon = m.icon
          return (
            <div key={m.label} className="card-interactive rounded-xl bg-white p-5 group slide-up" style={{ animationDelay: `${240 + i * 60}ms` }}>
              <div className="flex items-start justify-between mb-3">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{m.label}</p>
                <div className={`rounded-xl p-2 ${m.iconBg}`}>
                  <Icon className={`size-4 ${m.iconColor}`} />
                </div>
              </div>
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-2xl font-bold text-gray-900 tracking-tight tabular-nums">{m.value.toLocaleString()}</p>
                  <TrendIndicator value={m.trend} className="mt-1.5" />
                </div>
                {m.sparkData && <Sparkline data={m.sparkData} color={m.sparkColor} />}
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Bottom Panels ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Email Health Distribution */}
        <div className="rounded-xl bg-white p-4 md:p-6 card-rest slide-up" style={{ animationDelay: '300ms' }}>
          <h3 className="text-sm font-semibold text-gray-900 mb-5">Email Health</h3>
          <div className="flex items-center gap-6">
            <div className="relative w-28 h-28 shrink-0">
              <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="#F3F4F6" strokeWidth="3" />
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="#059669" strokeWidth="3" strokeDasharray={`${validPct} ${100-validPct}`} strokeDashoffset="0" strokeLinecap="round" className="transition-all duration-700" />
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="#D97706" strokeWidth="3" strokeDasharray={`${riskyPct} ${100-riskyPct}`} strokeDashoffset={`-${validPct}`} strokeLinecap="round" className="transition-all duration-700" />
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="#EF4444" strokeWidth="3" strokeDasharray={`${invalidPct} ${100-invalidPct}`} strokeDashoffset={`-${validPct+riskyPct}`} strokeLinecap="round" className="transition-all duration-700" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xl font-bold text-gray-900 tabular-nums">{total}</span>
                <span className="text-[10px] text-gray-400">Total</span>
              </div>
            </div>
            <div className="flex-1 space-y-3">
              {[
                { label: 'Valid', count: data.healthyEmails, pct: validPct, color: '#059669' },
                { label: 'Risky', count: data.riskyEmails, pct: riskyPct, color: '#D97706' },
                { label: 'Invalid', count: data.invalidEmails, pct: invalidPct, color: '#EF4444' },
              ].map(s => (
                <div key={s.label} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                    <span className="text-gray-600 font-medium">{s.label}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-gray-900 font-semibold tabular-nums">{s.count}</span>
                    <span className="text-gray-400 tabular-nums w-8 text-right">{s.pct}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Pipeline Funnel */}
        <div className="rounded-xl bg-white p-4 md:p-6 card-rest slide-up" style={{ animationDelay: '360ms' }}>
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-sm font-semibold text-gray-900">Pipeline</h3>
            <Button variant="ghost" size="sm" className="text-xs text-gray-500 hover:text-gray-900" onClick={() => { setCompanyStatusFilter('all'); setActiveView('companies') }}>
              View all <ArrowRight className="size-3 ml-1" />
            </Button>
          </div>
          <div className="space-y-3">
            {pipelineStages.map((stage) => {
              const colors = pipelineColors[stage.label] || { color: '#6B7280', bg: '#F3F4F6' }
              return (
                <div
                  key={stage.label}
                  className="group cursor-pointer"
                  onClick={() => {
                    setCompanyStatusFilter(stage.label.toLowerCase())
                    setActiveView('companies')
                  }}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-medium text-gray-600 group-hover:text-gray-900 transition-colors">{stage.label}</span>
                    <span className="text-xs font-bold text-gray-900 tabular-nums">{stage.count}</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700 ease-out group-hover:opacity-80"
                      style={{ width: `${(stage.count / maxPipeline) * 100}%`, backgroundColor: colors.color }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
          <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
            <span>Total companies</span>
            <span className="font-semibold text-gray-900">{data.totalCompanies}</span>
          </div>
        </div>

        {/* Next Actions / Tasks */}
        <div className="rounded-xl bg-white p-4 md:p-6 card-rest slide-up" style={{ animationDelay: '420ms' }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-900">Next Actions</h3>
            <Clock className="size-4 text-gray-400" />
          </div>
          {tasks.length > 0 ? (
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {tasks.map((task) => {
                const isCompleting = completeMutation.isPending && completeMutation.variables === task.opportunityId
                return (
                  <div key={task.id} className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-gray-50 transition-colors group">
                    <button
                      onClick={() => completeMutation.mutate(task.opportunityId)}
                      disabled={isCompleting}
                      className="mt-0.5 size-4 rounded border-2 border-gray-300 shrink-0 group-hover:border-amber-400 transition-colors flex items-center justify-center hover:bg-amber-50 disabled:opacity-50"
                    >
                      {isCompleting ? (
                        <Loader2 className="size-2.5 text-amber-600 animate-spin" />
                      ) : null}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-700 leading-snug">{task.title}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[11px] text-gray-400">{task.company}</span>
                        {task.contact && (
                          <>
                            <span className="text-[11px] text-gray-300">·</span>
                            <span className="text-[11px] text-gray-400">{task.contact}</span>
                          </>
                        )}
                        <span className="text-[11px] text-gray-300">·</span>
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${statusPriorityStyle[task.status] || statusPriorityStyle.new}`}>
                          {task.status}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <CheckCircle2 className="size-8 text-gray-300 mb-2" />
              <p className="text-sm text-gray-400">No pending actions</p>
              <p className="text-xs text-gray-300 mt-0.5">Create opportunities with next actions to see them here.</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Recent Activity ── */}
      <div className="rounded-xl bg-white p-4 md:p-6 card-rest slide-up" style={{ animationDelay: '480ms' }}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-sm font-semibold text-gray-900">Recent Activity</h3>
          <span className="text-xs text-gray-400">{data?.recentActivity?.length || 0} events</span>
        </div>
        <ScrollArea className="h-72">
          {data?.recentActivity && data.recentActivity.length > 0 ? (
            <div className="space-y-1">
              {data.recentActivity.slice(0, 10).map((item, idx) => {
                const iconData = getActivityIcon(item.action)
                const Icon = iconData.icon
                return (
                  <div
                    key={item.id}
                    className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer slide-up"
                    style={{ animationDelay: `${500 + idx * 40}ms` }}
                    onClick={() => {
                      if (item.companyId) {
                        setSelectedCompanyId(item.companyId)
                        setActiveView('company-profile')
                      } else if (item.contactId) {
                        setSelectedContactId(item.contactId)
                        setActiveView('contact-profile')
                      }
                    }}
                  >
                    <div className={`shrink-0 mt-0.5 rounded-lg p-1.5 ${iconData.bg}`}>
                      <Icon className={`size-3.5 ${iconData.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 leading-snug">{item.action}</p>
                      {item.details && (
                        <p className="text-xs text-gray-500 mt-0.5 truncate">{item.details}</p>
                      )}
                    </div>
                    <span className="text-[11px] text-gray-400 shrink-0 tabular-nums">
                      {new Date(item.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                )
              })}
            </div>
          ) : (
            <EmptyState
              icon={Clock}
              title="No activity yet"
              description="Activity will appear here as you add companies, contacts, and generate AI content."
              className="py-10"
            />
          )}
        </ScrollArea>
      </div>
    </div>
  )
}