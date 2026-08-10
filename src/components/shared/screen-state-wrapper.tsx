'use client'

import React, { type ElementType } from 'react'
import { Loader2, AlertCircle, Inbox } from 'lucide-react'
import { LucideIcon } from 'lucide-react'
import { EnterpriseErrorState } from '@/components/enterprise/EnterpriseErrorState'
import { EnterpriseEmptyState } from '@/components/enterprise/EnterpriseEmptyState'
import { EnterpriseLoading } from '@/components/enterprise/EnterpriseLoading'
import { Button } from '@/components/ui/button'
import { tokens } from '@/components/intelligence-os/design-tokens'

/* ═══════════════════════════════════════════════════
   Screen State Wrapper — Standard error/empty/loading states
   Phase 3 Task 3.5: Reusable state pattern for all screens
   ═══════════════════════════════════════════════════ */

interface ScreenStateWrapperProps {
  loading?: boolean
  error?: string | null
  empty?: boolean
  loadingMessage?: string
  errorMessage?: string
  emptyTitle?: string
  emptyDescription?: string
  emptyIcon?: LucideIcon;
  emptyActionLabel?: string
  onEmptyAction?: () => void
  onRetry?: () => void
  children: React.ReactNode
}

export function ScreenStateWrapper({
  loading = false,
  error = null,
  empty = false,
  loadingMessage = 'Loading data...',
  errorMessage = 'Failed to load data',
  emptyTitle = 'No data found',
  emptyDescription,
  emptyIcon: EmptyIcon = Inbox,
  emptyActionLabel,
  onEmptyAction,
  onRetry,
  children,
}: ScreenStateWrapperProps) {
  if (error) {
    return (
      <EnterpriseErrorState
        title={errorMessage}
        message={error}
        onRetry={onRetry}
      />
    )
  }

  if (loading) {
    return <EnterpriseLoading message={loadingMessage} size="lg" />
  }

  if (empty) {
    return (
      <EnterpriseEmptyState
        icon={EmptyIcon}
        title={emptyTitle}
        description={emptyDescription}
        actionLabel={emptyActionLabel}
        onAction={onEmptyAction}
      />
    )
  }

  return <>{children}</>
}

/* ── Hook version for screens that manage their own state ── */
export function useScreenState<T>({
  queryFn,
  enabled = true,
  emptyCheck,
}: {
  queryFn: () => Promise<T>
  enabled?: boolean
  emptyCheck?: (data: T) => boolean
}) {
  const [data, setData] = React.useState<T | null>(null)
  const [loading, setLoading] = React.useState(enabled)
  const [error, setError] = React.useState<string | null>(null)

  const refetch = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await queryFn()
      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [queryFn])

  React.useEffect(() => {
    if (enabled) {
      refetch()
    }
  }, [enabled, refetch])

  const isEmpty = data !== null && (emptyCheck ? emptyCheck(data) : false)

  return {
    data,
    loading,
    error,
    empty: isEmpty,
    refetch,
    setData,
    setError,
  }
}
