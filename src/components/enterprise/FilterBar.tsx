'use client';

import { Search, X, SlidersHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface FilterOption {
  key: string;
  label: string;
  options: string[];
}

interface FilterBarProps {
  searchPlaceholder?: string;
  filters: FilterOption[];
  activeFilters: Record<string, string>;
  onSearchChange: (value: string) => void;
  onFilterChange: (key: string, value: string) => void;
  onClearAll: () => void;
  className?: string;
}

export function FilterBar({
  searchPlaceholder = 'Search...',
  filters,
  activeFilters,
  onSearchChange,
  onFilterChange,
  onClearAll,
  className,
}: FilterBarProps) {
  const activeCount = Object.keys(activeFilters).filter(
    (k) => activeFilters[k] !== ''
  ).length;

  return (
    <div className={cn('filter-bar flex flex-col gap-3', className)}>
      {/* Search + Filter Controls Row */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
        {/* Search Input */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder={searchPlaceholder}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 h-9 text-sm bg-slate-50 border-slate-200"
          />
        </div>

        {/* Filter Dropdowns */}
        <div className="flex items-center gap-2 flex-wrap">
          <SlidersHorizontal className="h-4 w-4 text-slate-400 hidden sm:block" />
          {filters.map((filter) => (
            <select
              key={filter.key}
              value={activeFilters[filter.key] || ''}
              onChange={(e) =>
                onFilterChange(filter.key, e.target.value)
              }
              className="h-9 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-colors cursor-pointer appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2394a3b8%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[length:14px] bg-[right_8px_center] bg-no-repeat pr-7"
              aria-label={filter.label}
            >
              <option value="">{filter.label}</option>
              {filter.options.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          ))}

          {activeCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearAll}
              className="h-9 text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-100 gap-1.5"
            >
              <X className="h-3 w-3" />
              Clear all
            </Button>
          )}
        </div>
      </div>

      {/* Active Filter Chips */}
      {activeCount > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {Object.entries(activeFilters)
            .filter(([, v]) => v !== '')
            .map(([key, value]) => {
              const filterDef = filters.find((f) => f.key === key);
              return (
                <button
                  key={key}
                  onClick={() => onFilterChange(key, '')}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-medium border border-blue-200 hover:bg-blue-100 transition-colors cursor-pointer"
                >
                  <span className="text-blue-500">{filterDef?.label}:</span>
                  {value}
                  <X className="h-3 w-3 text-blue-400" />
                </button>
              );
            })}
        </div>
      )}
    </div>
  );
}
