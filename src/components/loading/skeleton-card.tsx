'use client'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

interface SkeletonCardProps {
  className?: string
  lines?: number
  hasAvatar?: boolean
  hasImage?: boolean
  hasActions?: boolean
}

export function SkeletonCard({ className, lines = 3, hasAvatar, hasImage, hasActions }: SkeletonCardProps) {
  return (
    <div className={cn('rounded-xl border border-border bg-card p-5 space-y-3', className)} role="status" aria-label="Loading content">
      {hasImage && <Skeleton className="w-full h-32 rounded-lg" />}
      <div className="flex items-center gap-3">
        {hasAvatar && <Skeleton className="h-10 w-10 rounded-full" />}
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={cn('h-3', i === lines - 1 ? 'w-2/3' : 'w-full')} />
      ))}
      {hasActions && (
        <div className="flex gap-2 pt-2">
          <Skeleton className="h-8 w-20 rounded-lg" />
          <Skeleton className="h-8 w-20 rounded-lg" />
        </div>
      )}
      <span className="sr-only">Loading...</span>
    </div>
  )
}
