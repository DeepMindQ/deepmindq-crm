'use client';

import { useState, useMemo } from 'react';
import {
  AlertTriangle,
  TrendingUp,
  Info,
  Zap,
  Building2,
  Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ConfidenceBar } from './ConfidenceBar';

interface FeedItem {
  id: string;
  type: string;
  title: string;
  description: string;
  confidence?: number;
  timestamp: Date;
  entityId?: string;
  entityName?: string;
}

interface IntelligenceFeedProps {
  items: FeedItem[];
  onItemClick?: (item: FeedItem) => void;
  filterTypes?: string[];
  className?: string;
}

const typeConfig: Record<string, { icon: typeof Info; color: string; bg: string; border: string; label: string }> = {
  signal: { icon: Zap, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200', label: 'Signal' },
  risk: { icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200', label: 'Risk' },
  opportunity: { icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', label: 'Opportunity' },
  info: { icon: Info, color: 'text-slate-600', bg: 'bg-slate-100', border: 'border-slate-200', label: 'Info' },
};

const defaultTypeConfig = { icon: Info, color: 'text-slate-600', bg: 'bg-slate-100', border: 'border-slate-200', label: 'Other' };

function formatTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - new Date(date).getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

export function IntelligenceFeed({
  items,
  onItemClick,
  filterTypes,
  className,
}: IntelligenceFeedProps) {
  const allTypes = useMemo(() => {
    const types = new Set(items.map((i) => i.type));
    return Array.from(types);
  }, [items]);

  const tabs = filterTypes ?? allTypes;
  const [activeTab, setActiveTab] = useState<string>('all');

  const filteredItems = useMemo(() => {
    if (activeTab === 'all') return items;
    return items.filter((i) => i.type === activeTab);
  }, [items, activeTab]);

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      {/* Type filter tabs */}
      {tabs.length > 0 && (
        <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-hide">
          <button
            onClick={() => setActiveTab('all')}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap',
              activeTab === 'all'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            )}
          >
            All
          </button>
          {tabs.map((type) => {
            const cfg = typeConfig[type] ?? defaultTypeConfig;
            return (
              <button
                key={type}
                onClick={() => setActiveTab(type)}
                className={cn(
                  'px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap capitalize',
                  activeTab === type
                    ? 'bg-slate-900 text-white'
                    : `${cfg.bg} ${cfg.color} hover:opacity-80`
                )}
              >
                {type}
              </button>
            );
          })}
        </div>
      )}

      {/* Feed list */}
      <div className="flex flex-col gap-2 max-h-[480px] overflow-y-auto pr-1">
        {filteredItems.length === 0 && (
          <div className="py-12 text-center">
            <p className="text-sm text-slate-400">No items to display</p>
          </div>
        )}
        {filteredItems.map((item) => {
          const cfg = typeConfig[item.type] ?? defaultTypeConfig;
          const Icon = cfg.icon;
          return (
            <button
              key={item.id}
              onClick={onItemClick ? () => onItemClick(item) : undefined}
              className={cn(
                'text-left w-full rounded-lg border p-3 sm:p-4 transition-all hover:shadow-sm',
                cfg.bg,
                cfg.border,
                onItemClick && 'cursor-pointer hover:border-slate-300'
              )}
            >
              <div className="flex items-start gap-3">
                <div className={cn('mt-0.5 shrink-0', cfg.color)}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={cn('text-[10px] font-semibold uppercase tracking-wider', cfg.color)}>
                      {cfg.label}
                    </span>
                    <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
                      <Clock className="h-2.5 w-2.5" />
                      {formatTime(item.timestamp)}
                    </span>
                  </div>
                  <h4 className="text-sm font-semibold text-slate-900 mt-1 leading-snug">
                    {item.title}
                  </h4>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed line-clamp-2">
                    {item.description}
                  </p>
                  {item.entityName && (
                    <div className="mt-2 flex items-center gap-1">
                      <Building2 className="h-3 w-3 text-slate-400" />
                      <span className="text-[11px] font-medium text-slate-500">
                        {item.entityName}
                      </span>
                    </div>
                  )}
                  {item.confidence !== undefined && (
                    <div className="mt-2">
                      <ConfidenceBar value={item.confidence} size="sm" showPercentage={false} />
                    </div>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
