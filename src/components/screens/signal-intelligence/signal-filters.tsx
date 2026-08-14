'use client';

import { tokens } from '@/components/intelligence-os/design-tokens';
import { XCircle } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SIGNAL_TYPE_LABELS, SEVERITY_CONFIG, STATUS_CONFIG } from './signal-types';

// ── Signal Filters Bar ──

export interface SignalFiltersProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  typeFilter: string;
  onTypeFilterChange: (v: string) => void;
  severityFilter: string;
  onSeverityFilterChange: (v: string) => void;
  statusFilter: string;
  onStatusFilterChange: (v: string) => void;
  onClearFilters: () => void;
}

export function SignalFilters({
  searchQuery,
  onSearchChange,
  typeFilter,
  onTypeFilterChange,
  severityFilter,
  onSeverityFilterChange,
  statusFilter,
  onStatusFilterChange,
  onClearFilters,
}: SignalFiltersProps) {
  const hasFilters = typeFilter !== 'all' || severityFilter !== 'all' || statusFilter !== 'all';

  return (
    <div
      className="flex flex-wrap items-center gap-3 rounded-xl p-3"
      style={{
        background: tokens.surface.card,
        border: `1px solid ${tokens.border.default}`,
      }}
    >
      <div className="relative flex-1 min-w-[200px] max-w-sm">
        <input
          type="text"
          placeholder="Search by title or organization…"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full h-8 pl-8 pr-3 rounded-lg text-xs outline-none transition-colors"
          style={{
            background: 'var(--ios-bg-card)',
            border: `1px solid ${tokens.border.default}`,
            color: tokens.text.primary,
          }}
        />
        <svg
          className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5"
          style={{ color: tokens.text.muted }}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z"
          />
        </svg>
        {searchQuery && (
          <button
            onClick={() => onSearchChange('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:opacity-70"
            style={{ color: tokens.text.muted }}
            aria-label="Clear search"
          >
            <XCircle className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <Select value={typeFilter} onValueChange={onTypeFilterChange}>
        <SelectTrigger
          size="sm"
          className="w-[170px]"
          style={{
            background: 'var(--ios-bg-card)',
            border: `1px solid ${tokens.border.default}`,
            color: tokens.text.primary,
          }}
        >
          <SelectValue placeholder="Signal Type" />
        </SelectTrigger>
        <SelectContent
          style={{ background: tokens.surface.card, border: `1px solid ${tokens.border.default}` }}
        >
          <SelectItem value="all">All Types</SelectItem>
          {Object.entries(SIGNAL_TYPE_LABELS).map(([val, label]) => (
            <SelectItem key={val} value={val} style={{ color: tokens.text.primary }}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={severityFilter} onValueChange={onSeverityFilterChange}>
        <SelectTrigger
          size="sm"
          className="w-[140px]"
          style={{
            background: 'var(--ios-bg-card)',
            border: `1px solid ${tokens.border.default}`,
            color: tokens.text.primary,
          }}
        >
          <SelectValue placeholder="Severity" />
        </SelectTrigger>
        <SelectContent
          style={{ background: tokens.surface.card, border: `1px solid ${tokens.border.default}` }}
        >
          <SelectItem value="all" style={{ color: tokens.text.primary }}>
            All Severity
          </SelectItem>
          {Object.entries(SEVERITY_CONFIG).map(([val, cfg]) => (
            <SelectItem key={val} value={val} style={{ color: cfg.color }}>
              {cfg.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={statusFilter} onValueChange={onStatusFilterChange}>
        <SelectTrigger
          size="sm"
          className="w-[150px]"
          style={{
            background: 'var(--ios-bg-card)',
            border: `1px solid ${tokens.border.default}`,
            color: tokens.text.primary,
          }}
        >
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent
          style={{ background: tokens.surface.card, border: `1px solid ${tokens.border.default}` }}
        >
          <SelectItem value="all" style={{ color: tokens.text.primary }}>
            All Status
          </SelectItem>
          {Object.entries(STATUS_CONFIG).map(([val, cfg]) => (
            <SelectItem key={val} value={val} style={{ color: cfg.color }}>
              {cfg.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {hasFilters && (
        <button
          onClick={onClearFilters}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors hover:opacity-80"
          style={{ background: `${tokens.text.muted}15`, color: tokens.text.secondary }}
        >
          Clear filters
        </button>
      )}
    </div>
  );
}
