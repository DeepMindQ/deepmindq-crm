'use client'

import { Settings } from 'lucide-react'

export function SettingsScreen() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-emerald-50">
        <Settings className="size-8 text-emerald-500" />
      </div>
      <div className="space-y-1.5">
        <h2 className="text-lg font-semibold tracking-tight">Settings</h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          Configure AI providers, email tone preferences, scoring weights, and API integrations.
        </p>
      </div>
    </div>
  )
}