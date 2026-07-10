'use client'

import { LayoutDashboard } from 'lucide-react'

export function DashboardScreen() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-emerald-500/10">
        <LayoutDashboard className="size-8 text-emerald-500" />
      </div>
      <div className="space-y-1.5">
        <h2 className="text-lg font-semibold tracking-tight">Dashboard</h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          Your lead intelligence overview will appear here with key metrics, recent activity, and AI insights.
        </p>
      </div>
    </div>
  )
}