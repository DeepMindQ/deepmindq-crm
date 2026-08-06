'use client';

import { Activity, Signal, RefreshCw, Building2, Sparkles } from 'lucide-react';
import { TrustIndicator } from '../atoms/trust-indicator';
import { FreshnessIndicator } from '../atoms/freshness-indicator';
import type { ActivityEvent } from '@/lib/intelligence-types';

interface ActivityFeedProps {
  events: ActivityEvent[];
  className?: string;
}

const typeIcons: Record<ActivityEvent['type'], React.ElementType> = {
  signal_detected: Signal,
  confidence_updated: Activity,
  account_changed: Building2,
  data_refreshed: RefreshCw,
  recommendation_generated: Sparkles,
};

const typeColors: Record<ActivityEvent['type'], string> = {
  signal_detected: 'var(--signal-blue)',
  confidence_updated: 'var(--success-green)',
  account_changed: 'var(--warning-amber)',
  data_refreshed: 'var(--enrichment-cyan)',
  recommendation_generated: 'var(--opportunity-purple)',
};

export function ActivityFeed({ events, className = '' }: ActivityFeedProps) {
  return (
    <div className={`space-y-1 ${className}`}>
      {events.map((event) => {
        const Icon = typeIcons[event.type];
        const color = typeColors[event.type];

        return (
          <div
            key={event.id}
            className="flex items-start gap-3 px-3 py-2.5 rounded-lg transition-colors hover:bg-[var(--bg-elevated)]"
          >
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
              style={{ backgroundColor: `${color}15` }}
            >
              <Icon className="w-3.5 h-3.5" style={{ color }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-medium text-[var(--primary)] leading-snug truncate">
                {event.headline}
              </p>
              <p className="text-[11px] text-[var(--primary-dim)] mt-0.5">
                {event.source}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {event.confidence !== undefined && (
                <TrustIndicator level={event.trustLevel || 'medium'} score={event.confidence} size="sm" showScore={false} />
              )}
              <FreshnessIndicator timestamp={event.timestamp} showIcon={false} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
