'use client';

interface ScreenSkeletonProps {
  rows?: number;
  className?: string;
}

export function ScreenSkeleton({ rows = 6, className = '' }: ScreenSkeletonProps) {
  return (
    <div className={`animate-pulse space-y-3 ${className}`}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center space-x-3">
          <div
            className="h-4 bg-zinc-800 rounded w-3/4"
            style={{ width: `${75 - ((i * 5) % 25)}%` }}
          />
          <div className="flex-1" />
          <div className="h-4 bg-zinc-800 rounded w-1/4" />
        </div>
      ))}
    </div>
  );
}

export function CardSkeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={`rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-6 animate-pulse ${className}`}
    >
      <div className="h-5 bg-zinc-800 rounded w-1/3 mb-4" />
      <div className="space-y-2">
        <div className="h-3 bg-zinc-800 rounded w-full" />
        <div className="h-3 bg-zinc-800 rounded w-5/6" />
        <div className="h-3 bg-zinc-800 rounded w-4/6" />
      </div>
    </div>
  );
}
