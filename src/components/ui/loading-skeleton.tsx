'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/* ═══════════════════════════════════════════════════
   LoadingSkeleton — Reusable loading state component
   
   Provides typed skeleton layouts for different screen patterns.
   All variants use the design system's Skeleton primitive and
   semantic tokens (bg-card, border-border, bg-elevated).
   
   Usage:
     <LoadingSkeleton variant="dashboard" />
     <LoadingSkeleton variant="table" rows={10} />
     <LoadingSkeleton variant="detail" />
     <LoadingSkeleton variant="cards" count={6} />
     <LoadingSkeleton variant="list" />
     <LoadingSkeleton variant="form" />
   
   ═══════════════════════════════════════════════════ */

export type SkeletonVariant =
  'dashboard' | 'table' | 'detail' | 'cards' | 'list' | 'form' | 'chat' | 'kanban' | 'stats';

interface LoadingSkeletonProps {
  variant?: SkeletonVariant;
  /** Number of rows (table/list), cards, or stat items */
  count?: number;
  /** Number of columns (table only) */
  columns?: number;
  /** Additional class names */
  className?: string;
  /** Optional label for screen reader */
  label?: string;
}

/**
 * Unified loading skeleton component.
 * Renders a typed skeleton matching the expected content layout of each screen.
 */
export function LoadingSkeleton({
  variant = 'dashboard',
  count = 5,
  columns = 4,
  className,
  label,
}: LoadingSkeletonProps) {
  return (
    <div
      className={cn('space-y-6 animate-in fade-in duration-300', className)}
      role="status"
      aria-label={label || 'Loading content'}
    >
      {variant === 'dashboard' && <DashboardSkeleton />}
      {variant === 'table' && <TableSkeleton rows={count} columns={columns} />}
      {variant === 'detail' && <DetailSkeleton />}
      {variant === 'cards' && <CardsSkeleton count={count} />}
      {variant === 'list' && <ListSkeleton count={count} />}
      {variant === 'form' && <FormSkeleton />}
      {variant === 'chat' && <ChatSkeleton />}
      {variant === 'kanban' && <KanbanSkeleton />}
      {variant === 'stats' && <StatsSkeleton count={count} />}
      <span className="sr-only">Loading...</span>
    </div>
  );
}

/* ── Dashboard: KPI cards + chart + sidebar list ── */
function DashboardSkeleton() {
  return (
    <>
      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-4 sm:p-5 space-y-3">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-7 sm:h-8 w-16" />
            <Skeleton className="h-3 w-24" />
          </div>
        ))}
      </div>
      {/* Main content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-xl border border-border bg-card p-5 space-y-3">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="w-full h-48 rounded-lg" />
        </div>
        <div className="rounded-xl border border-border bg-card p-5 space-y-3">
          <Skeleton className="h-4 w-32" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-8 w-8 rounded-full shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3 w-3/4" />
                <Skeleton className="h-2.5 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

/* ── Table: Header + N rows × M columns ── */
function TableSkeleton({ rows = 5, columns = 4 }: { rows: number; columns: number }) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <Skeleton className="h-4 w-32" />
        <div className="flex gap-2">
          <Skeleton className="h-8 w-24 rounded-lg" />
          <Skeleton className="h-8 w-8 rounded-lg" />
        </div>
      </div>
      {/* Column headers */}
      <div className="flex items-center gap-4 px-4 py-2.5 border-b border-border bg-elevated/50">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={`h-${i}`} className="h-3 flex-1" />
        ))}
      </div>
      {/* Rows */}
      <div className="divide-y divide-border">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={`r-${r}`} className="flex items-center gap-4 px-4 py-3">
            <Skeleton className="h-4 w-4 rounded shrink-0" />
            {Array.from({ length: columns }).map((_, c) => (
              <Skeleton key={`c-${c}`} className={cn('h-3 flex-1', c === 0 && 'w-1/3')} />
            ))}
          </div>
        ))}
      </div>
      {/* Footer pagination */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-border">
        <Skeleton className="h-3 w-24" />
        <div className="flex gap-1">
          <Skeleton className="h-7 w-7 rounded" />
          <Skeleton className="h-7 w-7 rounded" />
          <Skeleton className="h-7 w-7 rounded" />
        </div>
      </div>
    </div>
  );
}

/* ── Detail: Entity header + two-column body ── */
function DetailSkeleton() {
  return (
    <>
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start gap-4">
        <Skeleton className="h-14 w-14 rounded-xl shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-6 w-48 max-w-full" />
          <Skeleton className="h-3 w-32" />
          <div className="flex flex-wrap gap-2 pt-1">
            <Skeleton className="h-6 w-16 rounded-full" />
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-6 w-14 rounded-full" />
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <Skeleton className="h-8 w-24 rounded-lg" />
          <Skeleton className="h-8 w-8 rounded-lg" />
        </div>
      </div>
      {/* Tab bar */}
      <div className="flex gap-1 border-b border-border pb-px">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className={cn('h-8 rounded-t-lg', i === 0 ? 'w-24' : 'w-16')} />
        ))}
      </div>
      {/* Content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-xl border border-border bg-card p-5 space-y-3">
            <Skeleton className="h-4 w-32" />
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-3 w-full" />
            ))}
          </div>
          <div className="rounded-xl border border-border bg-card p-5 space-y-3">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="w-full h-32 rounded-lg" />
          </div>
        </div>
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-5 space-y-3">
            <Skeleton className="h-4 w-24" />
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex justify-between items-center">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-3 w-14" />
              </div>
            ))}
          </div>
          <div className="rounded-xl border border-border bg-card p-5 space-y-3">
            <Skeleton className="h-4 w-20" />
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-2">
                <Skeleton className="h-6 w-6 rounded-full shrink-0" />
                <Skeleton className="h-3 flex-1" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

/* ── Cards: Grid of N cards ── */
function CardsSkeleton({ count = 6 }: { count: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl border border-border bg-card p-5 space-y-3">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-lg shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
          {Array.from({ length: 3 }).map((_, j) => (
            <Skeleton key={j} className={cn('h-3', j === 2 ? 'w-2/3' : 'w-full')} />
          ))}
          <div className="flex gap-2 pt-1">
            <Skeleton className="h-7 w-16 rounded-lg" />
            <Skeleton className="h-7 w-16 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── List: Vertical list of items ── */
function ListSkeleton({ count = 8 }: { count: number }) {
  return (
    <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-3.5">
          <Skeleton className="h-9 w-9 rounded-full shrink-0" />
          <div className="flex-1 min-w-0 space-y-1.5">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
          </div>
          <Skeleton className="h-6 w-16 rounded-full shrink-0" />
          <Skeleton className="h-5 w-5 shrink-0" />
        </div>
      ))}
    </div>
  );
}

/* ── Form: Settings/config form ── */
function FormSkeleton() {
  return (
    <div className="max-w-2xl space-y-6">
      {/* Section header */}
      <Skeleton className="h-5 w-40" />
      <Skeleton className="h-3 w-64" />
      {/* Fields */}
      <div className="space-y-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="h-10 w-full rounded-lg" />
            {i === 2 && <Skeleton className="h-3 w-48" />}
          </div>
        ))}
      </div>
      {/* Action buttons */}
      <div className="flex gap-3 pt-2">
        <Skeleton className="h-10 w-28 rounded-lg" />
        <Skeleton className="h-10 w-20 rounded-lg" />
      </div>
    </div>
  );
}

/* ── Chat: Conversation thread ── */
function ChatSkeleton() {
  return (
    <div className="flex flex-col h-full">
      {/* Chat header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
        <Skeleton className="h-8 w-8 rounded-full" />
        <Skeleton className="h-4 w-32" />
      </div>
      {/* Messages */}
      <div className="flex-1 space-y-4 p-4 overflow-hidden">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className={cn('flex gap-3 max-w-[80%]', i % 2 === 0 ? '' : 'ml-auto flex-row-reverse')}
          >
            <Skeleton className="h-7 w-7 rounded-full shrink-0" />
            <div className="space-y-1.5">
              <Skeleton className={cn('h-4 w-48', i % 2 === 0 ? '' : 'w-40')} />
              <Skeleton className={cn('h-3 w-64', i % 2 === 0 ? '' : 'w-56')} />
              <Skeleton className={cn('h-3 w-24', i % 2 === 0 ? '' : 'w-20')} />
            </div>
          </div>
        ))}
      </div>
      {/* Input */}
      <div className="flex items-center gap-2 px-4 py-3 border-t border-border">
        <Skeleton className="flex-1 h-10 rounded-lg" />
        <Skeleton className="h-10 w-10 rounded-lg" />
      </div>
    </div>
  );
}

/* ── Kanban: Board columns ── */
function KanbanSkeleton() {
  const cols = 4;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: cols }).map((_, c) => (
        <div key={c} className="rounded-xl border border-border bg-card">
          {/* Column header */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
            <Skeleton className="h-3 w-4 rounded-full" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-5 w-6 rounded-full ml-auto" />
          </div>
          {/* Cards */}
          <div className="p-3 space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-lg border border-border p-3 space-y-2">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-2/3" />
                <div className="flex items-center justify-between pt-1">
                  <Skeleton className="h-5 w-5 rounded-full" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Stats: Just stat cards row ── */
function StatsSkeleton({ count = 4 }: { count: number }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl border border-border bg-card p-4 sm:p-5 space-y-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-8 w-14" />
          <div className="flex items-center gap-1">
            <Skeleton className="h-3 w-3 rounded-full" />
            <Skeleton className="h-3 w-12" />
          </div>
        </div>
      ))}
    </div>
  );
}
