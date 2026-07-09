'use client'

import { useQuery } from '@tanstack/react-query'
import { Building2, Users, ShieldCheck, ShieldAlert, TrendingUp, Sparkles, Activity } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
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

  const metrics = data ? [
    { label: 'Total Companies', value: data.totalCompanies, icon: Building2, color: 'text-slate-600 dark:text-slate-300', bg: 'bg-slate-100 dark:bg-slate-800' },
    { label: 'Total Contacts', value: data.totalContacts, icon: Users, color: 'text-slate-600 dark:text-slate-300', bg: 'bg-slate-100 dark:bg-slate-800' },
    { label: 'Healthy Emails', value: data.healthyEmails, icon: ShieldCheck, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/30' },
    { label: 'Invalid Emails', value: data.invalidEmails, icon: ShieldAlert, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-950/30' },
    { label: 'New This Week', value: data.newThisWeek, icon: TrendingUp, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/30' },
    { label: 'AI Drafts Generated', value: data.draftsGenerated, icon: Sparkles, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/30' },
  ] : []

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-72 rounded-xl" />
          <Skeleton className="h-72 rounded-xl" />
        </div>
      </div>
    )
  }

  const validCount = data?.healthyEmails || 0
  const riskyCount = data?.riskyEmails || 0
  const invalidCount = data?.invalidEmails || 0
  const total = validCount + riskyCount + invalidCount || 1

  return (
    <div className="space-y-6">
      {/* Primary metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.slice(0, 4).map((m) => {
          const Icon = m.icon
          return (
            <Card key={m.label} className="border-border/50 hover:-translate-y-0.5 transition-transform duration-200">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{m.label}</p>
                    <p className="text-2xl font-bold tracking-tight">{m.value.toLocaleString()}</p>
                  </div>
                  <div className={`rounded-xl p-2.5 ${m.bg}`}>
                    <Icon className={`size-5 ${m.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Secondary metric cards */}
      <div className="grid grid-cols-2 gap-4">
        {metrics.slice(4).map((m) => {
          const Icon = m.icon
          return (
            <Card key={m.label} className="border-border/50 hover:-translate-y-0.5 transition-transform duration-200">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{m.label}</p>
                    <p className="text-2xl font-bold tracking-tight">{m.value.toLocaleString()}</p>
                  </div>
                  <div className={`rounded-xl p-2.5 ${m.bg}`}>
                    <Icon className={`size-5 ${m.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Bottom panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Email Health Distribution */}
        <Card className="border-border/50">
          <CardContent className="p-6">
            <h3 className="text-sm font-semibold mb-4">Email Health Distribution</h3>
            <div className="flex items-center gap-6">
              <div className="relative w-32 h-32">
                <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke="currentColor" className="text-muted/30" strokeWidth="3" />
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke="currentColor" className="text-emerald-500" strokeWidth="3" strokeDasharray={`${(validCount/total)*100} ${100-(validCount/total)*100}`} strokeDashoffset="0" strokeLinecap="round" />
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke="currentColor" className="text-amber-500" strokeWidth="3" strokeDasharray={`${(riskyCount/total)*100} ${100-(riskyCount/total)*100}`} strokeDashoffset={`${-(validCount/total)*100}`} strokeLinecap="round" />
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke="currentColor" className="text-red-500" strokeWidth="3" strokeDasharray={`${(invalidCount/total)*100} ${100-(invalidCount/total)*100}`} strokeDashoffset={`${-((validCount+riskyCount)/total)*100}`} strokeLinecap="round" />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-lg font-bold">{total}</span>
                </div>
              </div>
              <div className="flex-1 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    <span className="text-sm text-muted-foreground">Valid</span>
                  </div>
                  <span className="text-sm font-semibold">{validCount} <span className="text-muted-foreground font-normal">({Math.round((validCount/total)*100)}%)</span></span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                    <span className="text-sm text-muted-foreground">Risky</span>
                  </div>
                  <span className="text-sm font-semibold">{riskyCount} <span className="text-muted-foreground font-normal">({Math.round((riskyCount/total)*100)}%)</span></span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                    <span className="text-sm text-muted-foreground">Invalid</span>
                  </div>
                  <span className="text-sm font-semibold">{invalidCount} <span className="text-muted-foreground font-normal">({Math.round((invalidCount/total)*100)}%)</span></span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="border-border/50">
          <CardContent className="p-6">
            <h3 className="text-sm font-semibold mb-4">Recent Activity</h3>
            <ScrollArea className="h-64">
              {data?.recentActivity && data.recentActivity.length > 0 ? (
                <div className="space-y-3">
                  {data.recentActivity.map((item) => (
                    <div key={item.id} className="flex items-start gap-3 pb-3 border-b border-border/30 last:border-0">
                      <Activity className="size-4 mt-0.5 text-emerald-500 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{item.action}</p>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{item.details}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
                  <Activity className="size-8 mb-2 opacity-30" />
                  <p className="text-sm">No recent activity</p>
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}