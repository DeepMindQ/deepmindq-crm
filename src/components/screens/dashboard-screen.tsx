'use client'

import { useQuery } from '@tanstack/react-query'
import { Building2, Users, ShieldCheck, ShieldAlert, TrendingUp, Sparkles, Activity } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'

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
  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ['dashboard'],
    queryFn: () => fetch('/api/dashboard').then(r => r.json()),
  })

  const primaryMetrics = data ? [
    { label: 'Companies', value: data.totalCompanies, icon: Building2, iconBg: 'bg-blue-50', iconColor: 'text-blue-600' },
    { label: 'Contacts', value: data.totalContacts, icon: Users, iconBg: 'bg-violet-50', iconColor: 'text-violet-600' },
    { label: 'Healthy Emails', value: data.healthyEmails, icon: ShieldCheck, iconBg: 'bg-emerald-50', iconColor: 'text-emerald-600' },
    { label: 'Invalid Emails', value: data.invalidEmails, icon: ShieldAlert, iconBg: 'bg-red-50', iconColor: 'text-red-500' },
  ] : []

  const secondaryMetrics = data ? [
    { label: 'New This Week', value: data.newThisWeek, icon: TrendingUp, iconBg: 'bg-amber-50', iconColor: 'text-amber-600' },
    { label: 'AI Drafts Generated', value: data.draftsGenerated, icon: Sparkles, iconBg: 'bg-indigo-50', iconColor: 'text-indigo-600' },
  ] : []

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-gray-100 animate-pulse rounded-xl h-28" />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="bg-gray-100 animate-pulse rounded-xl h-28" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="bg-gray-100 animate-pulse rounded-xl h-72" />
          ))}
        </div>
      </div>
    )
  }

  const validCount = data?.healthyEmails || 0
  const riskyCount = data?.riskyEmails || 0
  const invalidCount = data?.invalidEmails || 0
  const total = validCount + riskyCount + invalidCount || 1

  const validPct = Math.round((validCount / total) * 100)
  const riskyPct = Math.round((riskyCount / total) * 100)
  const invalidPct = 100 - validPct - riskyPct

  return (
    <div className="space-y-6">
      {/* Primary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {primaryMetrics.map((m) => {
          const Icon = m.icon
          return (
            <div
              key={m.label}
              className="rounded-xl border border-gray-200/80 shadow-sm bg-white p-5 hover:shadow-md transition-shadow duration-200"
            >
              <div className="flex items-start justify-between">
                <div className="space-y-1.5">
                  <p className="text-sm font-medium text-gray-500">{m.label}</p>
                  <p className="text-3xl font-semibold text-gray-900 tracking-tight">
                    {m.value.toLocaleString()}
                  </p>
                </div>
                <div className={`rounded-xl p-2.5 ${m.iconBg}`}>
                  <Icon className={`size-5 ${m.iconColor}`} />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Secondary KPI Cards */}
      <div className="grid grid-cols-2 gap-4">
        {secondaryMetrics.map((m) => {
          const Icon = m.icon
          return (
            <div
              key={m.label}
              className="rounded-xl border border-gray-200/80 shadow-sm bg-white p-5 hover:shadow-md transition-shadow duration-200"
            >
              <div className="flex items-start justify-between">
                <div className="space-y-1.5">
                  <p className="text-sm font-medium text-gray-500">{m.label}</p>
                  <p className="text-3xl font-semibold text-gray-900 tracking-tight">
                    {m.value.toLocaleString()}
                  </p>
                </div>
                <div className={`rounded-xl p-2.5 ${m.iconBg}`}>
                  <Icon className={`size-5 ${m.iconColor}`} />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Bottom Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Email Health Distribution */}
        <div className="rounded-xl border border-gray-200/80 shadow-sm bg-white p-6">
          <h3 className="text-base font-semibold text-gray-900 mb-5">Email Health Distribution</h3>
          <div className="flex items-center gap-8">
            <div className="relative w-36 h-36 shrink-0">
              <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                {/* Background ring */}
                <circle
                  cx="18" cy="18" r="15.9"
                  fill="none"
                  className="text-gray-100"
                  stroke="currentColor"
                  strokeWidth="3"
                />
                {/* Valid (emerald) */}
                <circle
                  cx="18" cy="18" r="15.9"
                  fill="none"
                  stroke="#10B981"
                  strokeWidth="3"
                  strokeDasharray={`${validPct} ${100 - validPct}`}
                  strokeDashoffset="0"
                  strokeLinecap="round"
                />
                {/* Risky (amber) */}
                <circle
                  cx="18" cy="18" r="15.9"
                  fill="none"
                  stroke="#F59E0B"
                  strokeWidth="3"
                  strokeDasharray={`${riskyPct} ${100 - riskyPct}`}
                  strokeDashoffset={`-${validPct}`}
                  strokeLinecap="round"
                />
                {/* Invalid (red) */}
                <circle
                  cx="18" cy="18" r="15.9"
                  fill="none"
                  stroke="#EF4444"
                  strokeWidth="3"
                  strokeDasharray={`${invalidPct} ${100 - invalidPct}`}
                  strokeDashoffset={`-${validPct + riskyPct}`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-semibold text-gray-900">{total}</span>
                <span className="text-xs text-gray-400 mt-0.5">Total</span>
              </div>
            </div>
            <div className="flex-1 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#10B981]" />
                  <span className="text-sm text-gray-600">Valid</span>
                </div>
                <span className="text-sm font-semibold text-gray-900">
                  {validCount}{' '}
                  <span className="text-gray-400 font-normal">({validPct}%)</span>
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#F59E0B]" />
                  <span className="text-sm text-gray-600">Risky</span>
                </div>
                <span className="text-sm font-semibold text-gray-900">
                  {riskyCount}{' '}
                  <span className="text-gray-400 font-normal">({riskyPct}%)</span>
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#EF4444]" />
                  <span className="text-sm text-gray-600">Invalid</span>
                </div>
                <span className="text-sm font-semibold text-gray-900">
                  {invalidCount}{' '}
                  <span className="text-gray-400 font-normal">({invalidPct}%)</span>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="rounded-xl border border-gray-200/80 shadow-sm bg-white p-6">
          <h3 className="text-base font-semibold text-gray-900 mb-5">Recent Activity</h3>
          <ScrollArea className="h-64">
            {data?.recentActivity && data.recentActivity.length > 0 ? (
              <div className="space-y-0">
                {data.recentActivity.map((item) => (
                  <div
                    key={item.id}
                    className="border-l-2 border-amber-400 pl-4 py-3"
                  >
                    <p className="text-sm font-medium text-gray-900 leading-snug">
                      {item.action}
                    </p>
                    <p className="text-sm text-gray-500 mt-0.5 line-clamp-1">
                      {item.details}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(item.createdAt).toLocaleString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-48">
                <Activity className="size-8 text-gray-400 mb-2" />
                <p className="text-sm text-gray-500">No recent activity</p>
              </div>
            )}
          </ScrollArea>
        </div>
      </div>
    </div>
  )
}