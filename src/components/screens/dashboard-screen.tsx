'use client'

import { useQuery } from '@tanstack/react-query'
import {
  Building2, Users, ShieldCheck, ShieldAlert, TrendingUp, Sparkles,
  ArrowRight, Mail, Target, Clock, CheckCircle2,
} from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/lib/store'
import { EmptyState, TrendIndicator, Sparkline, getActivityIcon, SkeletonGrid } from '@/components/shared/design-system'

interface DashboardData {
  totalCompanies: number
  totalContacts: number
  healthyEmails: number
  riskyEmails: number
  invalidEmails: number
  archivedContacts: number
  newThisWeek: number
  draftsGenerated: number
  recentActivity: Array<{ id: string; action: string; details: string; createdAt: string; companyId?: string }>
}

export function DashboardScreen() {
  const { setActiveView } = useAppStore()
  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ['dashboard'],
    queryFn: () => fetch('/api/dashboard').then(r => r.json()),
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

  const pipelineStages = [
    { label: 'New', count: Math.round((data.totalCompanies || 0) * 0.3), color: '#6B7280', bg: '#F3F4F6' },
    { label: 'Researching', count: Math.round((data.totalCompanies || 0) * 0.25), color: '#D97706', bg: '#FFFBEB' },
    { label: 'Contacted', count: Math.round((data.totalCompanies || 0) * 0.2), color: '#2563EB', bg: '#EFF6FF' },
    { label: 'Won', count: Math.round((data.totalCompanies || 0) * 0.15), color: '#059669', bg: '#ECFDF5' },
  ]

  const maxPipeline = Math.max(...pipelineStages.map(s => s.count), 1)

  const kpis = [
    { label: 'Companies', value: data.totalCompanies, icon: Building2, iconBg: 'bg-blue-50', iconColor: 'text-blue-600', trend: 12, sparkData: [3,5,4,7,8,12,15] },
    { label: 'Contacts', value: data.totalContacts, icon: Users, iconBg: 'bg-violet-50', iconColor: 'text-violet-600', trend: 8, sparkData: [10,15,18,22,25,30,35] },
    { label: 'Healthy Emails', value: data.healthyEmails, icon: ShieldCheck, iconBg: 'bg-emerald-50', iconColor: 'text-emerald-600', trend: 5, sparkData: [20,22,25,24,28,30,32] },
    { label: 'Invalid Emails', value: data.invalidEmails, icon: ShieldAlert, iconBg: 'bg-red-50', iconColor: 'text-red-500', trend: -3, sparkData: [8,7,9,6,5,5,4] },
  ]

  const secondaryKpis = [
    { label: 'New This Week', value: data.newThisWeek, icon: TrendingUp, iconBg: 'bg-amber-50', iconColor: 'text-amber-600', trend: 24 },
    { label: 'AI Drafts Generated', value: data.draftsGenerated, icon: Sparkles, iconBg: 'bg-indigo-50', iconColor: 'text-indigo-600', trend: 15 },
  ]

  const sampleTasks = [
    { id: '1', text: 'Follow up with Acme Corp — meeting scheduled', due: 'Today', priority: 'high' as const },
    { id: '2', text: 'Review research for TechStart Inc', due: 'Tomorrow', priority: 'medium' as const },
    { id: '3', text: 'Send intro emails to 5 new contacts at GlobalCo', due: 'In 2 days', priority: 'low' as const },
    { id: '4', text: 'Validate email batch for imported contacts', due: 'In 3 days', priority: 'medium' as const },
  ]

  const priorityStyles = {
    high: 'bg-red-50 text-red-700 border-red-100',
    medium: 'bg-amber-50 text-amber-700 border-amber-100',
    low: 'bg-gray-100 text-gray-600 border-gray-200',
  }

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
                {m.sparkData && <Sparkline data={m.sparkData} color={m.iconColor === 'text-red-500' ? '#EF4444' : '#D97706'} />}
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Secondary KPIs ── */}
      <div className="grid grid-cols-2 gap-4">
        {secondaryKpis.map((m) => {
          const Icon = m.icon
          return (
            <div key={m.label} className="card-interactive rounded-xl bg-white p-5 group slide-up" style={{ animationDelay: '240ms' }}>
              <div className="flex items-start justify-between mb-3">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{m.label}</p>
                <div className={`rounded-xl p-2 ${m.iconBg}`}>
                  <Icon className={`size-4 ${m.iconColor}`} />
                </div>
              </div>
              <p className="text-2xl font-bold text-gray-900 tracking-tight tabular-nums">{m.value.toLocaleString()}</p>
              <TrendIndicator value={m.trend} className="mt-1.5" />
            </div>
          )
        })}
      </div>

      {/* ── Bottom Panels ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Email Health Distribution */}
        <div className="rounded-xl bg-white p-6 card-rest slide-up" style={{ animationDelay: '300ms' }}>
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
        <div className="rounded-xl bg-white p-6 card-rest slide-up" style={{ animationDelay: '360ms' }}>
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-sm font-semibold text-gray-900">Pipeline</h3>
            <Button variant="ghost" size="sm" className="text-xs text-gray-500 hover:text-gray-900" onClick={() => setActiveView('companies')}>
              View all <ArrowRight className="size-3 ml-1" />
            </Button>
          </div>
          <div className="space-y-3">
            {pipelineStages.map((stage) => (
              <div key={stage.label} className="group">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-medium text-gray-600">{stage.label}</span>
                  <span className="text-xs font-bold text-gray-900 tabular-nums">{stage.count}</span>
                </div>
                <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700 ease-out group-hover:opacity-80"
                    style={{ width: `${(stage.count / maxPipeline) * 100}%`, backgroundColor: stage.color }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
            <span>Total companies</span>
            <span className="font-semibold text-gray-900">{data.totalCompanies}</span>
          </div>
        </div>

        {/* Next Actions / Tasks */}
        <div className="rounded-xl bg-white p-6 card-rest slide-up" style={{ animationDelay: '420ms' }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-900">Next Actions</h3>
            <Clock className="size-4 text-gray-400" />
          </div>
          <div className="space-y-2">
            {sampleTasks.map((task) => (
              <div key={task.id} className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer group">
                <div className="mt-0.5 size-4 rounded border-2 border-gray-300 shrink-0 group-hover:border-amber-400 transition-colors flex items-center justify-center">
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-700 leading-snug">{task.text}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[11px] text-gray-400">{task.due}</span>
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${priorityStyles[task.priority]}`}>
                      {task.priority}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Recent Activity ── */}
      <div className="rounded-xl bg-white p-6 card-rest slide-up" style={{ animationDelay: '480ms' }}>
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