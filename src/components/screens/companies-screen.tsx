'use client'

import { Building2 } from 'lucide-react'

export function CompaniesScreen() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-emerald-500/10">
        <Building2 className="size-8 text-emerald-500" />
      </div>
      <div className="space-y-1.5">
        <h2 className="text-lg font-semibold tracking-tight">Companies</h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          Browse and manage your target companies. AI research cards and intelligence scores help you prioritize outreach.
        </p>
      </div>
    </div>
  )
}