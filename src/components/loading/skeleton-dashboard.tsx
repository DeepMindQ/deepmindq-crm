'use client'
import { Skeleton } from '@/components/ui/skeleton'

export function SkeletonDashboard() {
  return (
    <div className="space-y-6" role="status" aria-label="Loading dashboard">
      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-5 space-y-3">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-3 w-24" />
          </div>
        ))}
      </div>
      {/* Main content area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-xl border border-border bg-card p-5 space-y-3">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="w-full h-48 rounded-lg" />
        </div>
        <div className="rounded-xl border border-border bg-card p-5 space-y-3">
          <Skeleton className="h-4 w-32" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-8 w-8 rounded-full" />
              <Skeleton className="h-3 flex-1" />
            </div>
          ))}
        </div>
      </div>
      <span className="sr-only">Loading dashboard data...</span>
    </div>
  )
}
