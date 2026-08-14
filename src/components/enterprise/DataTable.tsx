'use client';

import { useState, useMemo, useCallback, type ReactNode } from 'react';
import { tokens } from '@/components/intelligence-os/design-tokens';
import {
  ArrowUp,
  ArrowDown,
  ChevronsUpDown,
  Inbox,
  Search,
  Download,
  ChevronLeft,
  ChevronRight,
  Columns3,
  Check,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export interface Column {
  key: string;
  label: string;
  sortable?: boolean;
  render?: (value: unknown, row: Record<string, unknown>) => ReactNode;
}

interface DataTableProps {
  columns: Column[];
  data: Record<string, unknown>[];
  onRowClick?: (row: Record<string, unknown>) => void;
  onSort?: (key: string) => void;
  sortKey?: string;
  sortDir?: 'asc' | 'desc';
  loading?: boolean;
  emptyMessage?: string;
  className?: string;
  // Pagination
  pageSize?: number;
  totalCount?: number;
  pageIndex?: number;
  onPageChange?: (page: number) => void;
  // Filtering
  filterable?: boolean;
  filterPlaceholder?: string;
  // Export
  exportable?: boolean;
  exportFilename?: string;
  // Title
  title?: string;
}

export function DataTable({
  columns,
  data,
  onRowClick,
  onSort,
  sortKey,
  sortDir,
  loading = false,
  emptyMessage = 'No data available',
  className,
  pageSize,
  totalCount,
  pageIndex,
  onPageChange,
  filterable = false,
  filterPlaceholder = 'Filter rows…',
  exportable = false,
  exportFilename = 'data-export',
  title,
}: DataTableProps) {
  // ── Column visibility state ──
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());
  const visibleColumns = useMemo(
    () => columns.filter((c) => !hiddenColumns.has(c.key)),
    [columns, hiddenColumns]
  );

  const toggleColumn = useCallback((key: string) => {
    setHiddenColumns((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  // ── Client-side filter state ──
  const [filterText, setFilterText] = useState('');

  const filteredData = useMemo(() => {
    if (!filterable || !filterText.trim()) return data;
    const q = filterText.toLowerCase();
    return data.filter((row) =>
      columns.some((col) => {
        const val = row[col.key];
        if (val == null) return false;
        return String(val).toLowerCase().includes(q);
      })
    );
  }, [data, filterable, filterText, columns]);

  // ── Pagination logic ──
  const hasServerPagination = !!(pageSize != null && totalCount != null && pageIndex != null && onPageChange);
  const effectivePageSize = pageSize ?? 20;

  // Local page state for client-side pagination
  const [localPage, setLocalPage] = useState(1);

  const totalPages = hasServerPagination
    ? Math.max(1, Math.ceil(totalCount! / effectivePageSize))
    : Math.max(1, Math.ceil(filteredData.length / effectivePageSize));

  const currentPage = hasServerPagination
    ? pageIndex!
    : Math.min(localPage, totalPages);

  const displayData = hasServerPagination
    ? data
    : filteredData.slice((currentPage - 1) * effectivePageSize, currentPage * effectivePageSize);

  const displayTotal = hasServerPagination ? totalCount! : filteredData.length;
  const showingFrom = displayTotal === 0 ? 0 : (currentPage - 1) * effectivePageSize + 1;
  const showingTo = Math.min(currentPage * effectivePageSize, displayTotal);

  const showPagination = hasServerPagination
    ? totalPages > 1
    : filteredData.length > effectivePageSize;

  const handlePageChange = useCallback((p: number) => {
    if (hasServerPagination) {
      onPageChange!(p);
    } else {
      setLocalPage(p);
    }
  }, [hasServerPagination, onPageChange]);

  // Reset local page when filter text changes
  const handleFilterChange = useCallback((val: string) => {
    setFilterText(val);
    if (!hasServerPagination) setLocalPage(1);
  }, [hasServerPagination]);

  // ── CSV Export ──
  const handleExport = useCallback(() => {
    const exportRows = hasServerPagination ? data : filteredData;
    if (exportRows.length === 0) return;

    const headers = visibleColumns.map((c) => c.label);
    const rows = exportRows.map((row) =>
      visibleColumns.map((col) => {
        const val = row[col.key];
        if (val == null) return '';
        return String(val).replace(/"/g, '""');
      })
    );
    const csv = [headers, ...rows]
      .map((r) => r.map((cell) => `"${cell}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${exportFilename}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [data, filteredData, hasServerPagination, visibleColumns, exportFilename]);

  // ── Enterprise color tokens ──
  const bg = tokens.surface.card;
  const border = tokens.border.default;
  const textColor = tokens.text.primary;
  const muted = tokens.text.secondary;
  const primary = tokens.accent.dim;

  const showToolbar = title || filterable || exportable || columns.length > 2;

  return (
    <div className={cn('section-container', className)} style={{ background: bg, border: `1px solid ${border}`, borderRadius: '12px' }}>
      {/* ── Title + Toolbar ── */}
      {showToolbar && (
        <div className="flex items-center justify-between gap-3 px-4 py-3" style={{ borderBottom: `1px solid ${border}` }}>
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {title && (
              <h3 className="text-sm font-semibold shrink-0" style={{ color: textColor }}>{title}</h3>
            )}
            {filterable && (
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5" style={{ color: muted }} />
                <Input
                  placeholder={filterPlaceholder}
                  value={filterText}
                  onChange={(e) => handleFilterChange(e.target.value)}
                  className="h-8 pl-8 text-xs"
                  style={{
                    background: '#0d1117',
                    border: `1px solid ${border}`,
                    color: textColor,
                  }}
                />
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {exportable && (
              <button
                onClick={handleExport}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors hover:opacity-90"
                style={{ background: primary, color: tokens.flat.white }}
              >
                <Download className="h-3.5 w-3.5" />
                Download CSV
              </button>
            )}
            {columns.length > 2 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors hover:opacity-80"
                    style={{ border: `1px solid ${border}`, color: muted }}
                  >
                    <Columns3 className="h-3.5 w-3.5" />
                    Columns
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" style={{ background: bg, border: `1px solid ${border}` }}>
                  {columns.map((col) => (
                    <DropdownMenuItem
                      key={col.key}
                      onClick={() => toggleColumn(col.key)}
                      className="flex items-center gap-2 text-xs cursor-pointer"
                      style={{ color: hiddenColumns.has(col.key) ? muted : textColor }}
                    >
                      <div
                        className="w-4 h-4 rounded border flex items-center justify-center shrink-0"
                        style={{
                          borderColor: border,
                          background: hiddenColumns.has(col.key) ? 'transparent' : primary,
                        }}
                      >
                        {!hiddenColumns.has(col.key) && <Check className="h-3 w-3" style={{ color: tokens.flat.white }} />}
                      </div>
                      {col.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      )}

      {/* ── Table ── */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr style={{ borderBottom: `1px solid ${border}` }}>
              {visibleColumns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    'px-4 py-3 text-left whitespace-nowrap text-xs font-medium',
                    col.sortable && 'cursor-pointer select-none',
                  )}
                  style={{ color: muted }}
                  onClick={col.sortable && onSort ? () => onSort(col.key) : undefined}
                >
                  <div className="flex items-center gap-1.5">
                    {col.label}
                    {col.sortable && (
                      <span>
                        {sortKey === col.key ? (
                          sortDir === 'asc' ? (
                            <ArrowUp className="h-3.5 w-3.5" style={{ color: primary }} />
                          ) : (
                            <ArrowDown className="h-3.5 w-3.5" style={{ color: primary }} />
                          )
                        ) : (
                          <ChevronsUpDown className="h-3.5 w-3.5" style={{ color: tokens.text.muted }} />
                        )}
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, rowIdx) => (
                <tr key={`skeleton-${rowIdx}`}>
                  {visibleColumns.map((col) => (
                    <td key={col.key} className="px-4 py-3">
                      <Skeleton className="h-4 w-3/4 rounded" style={{ background: tokens.border.default }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : filteredData.length === 0 && filterable && filterText ? (
              <tr>
                <td colSpan={visibleColumns.length} className="px-4 py-12 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <Search className="h-8 w-8" style={{ color: tokens.text.muted }} />
                    <p className="text-sm" style={{ color: muted }}>No results match your filter</p>
                    <button
                      onClick={() => handleFilterChange('')}
                      className="text-xs font-medium"
                      style={{ color: primary }}
                    >
                      Clear filter
                    </button>
                  </div>
                </td>
              </tr>
            ) : displayData.length === 0 ? (
              <tr>
                <td colSpan={visibleColumns.length} className="px-4 py-12 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <Inbox className="h-8 w-8" style={{ color: tokens.text.muted }} />
                    <p className="text-sm" style={{ color: muted }}>{emptyMessage}</p>
                  </div>
                </td>
              </tr>
            ) : (
              displayData.map((row, rowIdx) => (
                <tr
                  key={rowIdx}
                  className={cn(
                    'transition-colors',
                    onRowClick && 'cursor-pointer',
                  )}
                  style={{ borderBottom: `1px solid ${border}` }}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  tabIndex={onRowClick ? 0 : undefined}
                  onKeyDown={
                    onRowClick
                      ? (e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            onRowClick(row);
                          }
                        }
                      : undefined
                  }
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.background = tokens.accent.ghost;
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background = 'transparent';
                  }}
                >
                  {visibleColumns.map((col) => (
                    <td key={col.key} className="px-4 py-3" style={{ color: textColor, fontSize: '13px' }}>
                      {col.render
                        ? col.render(row[col.key], row)
                        : (row[col.key] as ReactNode)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ── Pagination ── */}
      {showPagination && (
        <div
          className="flex items-center justify-between px-4 py-3"
          style={{ borderTop: `1px solid ${border}` }}
        >
          <span className="text-xs" style={{ color: muted }}>
            Showing {showingFrom}–{showingTo} of {displayTotal}
          </span>
          <div className="flex items-center gap-1">
            <button
              className="inline-flex items-center justify-center w-8 h-8 rounded-lg transition-colors"
              style={{
                border: `1px solid ${border}`,
                color: currentPage <= 1 ? tokens.text.muted : textColor,
                opacity: currentPage <= 1 ? 0.5 : 1,
              }}
              disabled={currentPage <= 1}
              onClick={() => handlePageChange(currentPage - 1)}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let p: number;
              if (totalPages <= 5) p = i + 1;
              else if (currentPage <= 3) p = i + 1;
              else if (currentPage >= totalPages - 2) p = totalPages - 4 + i;
              else p = currentPage - 2 + i;
              return (
                <button
                  key={p}
                  className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-xs font-medium transition-colors"
                  style={{
                    background: p === currentPage ? primary : 'transparent',
                    color: p === currentPage ? tokens.flat.white : muted,
                    border: p === currentPage ? 'none' : `1px solid ${border}`,
                  }}
                  onClick={() => handlePageChange(p)}
                >
                  {p}
                </button>
              );
            })}
            <button
              className="inline-flex items-center justify-center w-8 h-8 rounded-lg transition-colors"
              style={{
                border: `1px solid ${border}`,
                color: currentPage >= totalPages ? tokens.text.muted : textColor,
                opacity: currentPage >= totalPages ? 0.5 : 1,
              }}
              disabled={currentPage >= totalPages}
              onClick={() => handlePageChange(currentPage + 1)}
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
