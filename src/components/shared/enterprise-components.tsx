/* ═══════════════════════════════════════════════════
   Enterprise Screen Components
   
   Shared building blocks for ALL CRM screens.
   Uses enterprise-theme.ts design tokens.
   ═══════════════════════════════════════════════════ */

'use client';

import { useState, useEffect, useRef, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X, Search, RefreshCw, Loader2, Plus } from 'lucide-react';
import {
  gold, goldLight, card, border, glassPanel,
  animations, goldButton, colors, cls,
} from '@/components/design-system';
import { cn } from '@/lib/utils';

/* ═══════════════════════════════════════════════════
   KPICard — Animated stat card with icon, value, trend
   ═══════════════════════════════════════════════════ */
function useCounter(target: number, dur = 1200) {
  const [v, setV] = useState(0);
  const raf = useRef(0);
  useEffect(() => {
    const t0 = performance.now();
    const step = (now: number) => {
      const p = Math.min((now - t0) / dur, 1);
      setV(Math.round((1 - Math.pow(1 - p, 3)) * target));
      if (p < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [target, dur]);
  return v;
}

interface KPICardProps {
  icon: React.ElementType;
  label: string;
  value: number | string;
  suffix?: string;
  trend?: { value: number; up: boolean };
  accentColor?: string;
  delay?: number;
  loading?: boolean;
}

export function KPICard({
  icon: Icon, label, value, suffix, trend, accentColor = gold,
  delay = 0, loading = false,
}: KPICardProps) {
  const num = typeof value === 'number' ? value : 0;
  const anim = useCounter(num);
  const display = loading ? '—' : typeof value === 'number' ? anim.toLocaleString() : value;

  return (
    <motion.div
      {...animations.fadeIn}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
      className="relative rounded-xl overflow-hidden group cursor-default"
      style={{
        background: card,
        backdropFilter: 'blur(20px)',
        border: `1px solid ${border}`,
        borderLeft: `3px solid ${accentColor}`,
      }}>
      <div className="p-4 space-y-2">
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: `${accentColor}18` }}>
            <Icon className="w-4 h-4" style={{ color: accentColor }} />
          </div>
          <span className="text-xs font-medium text-muted-foreground">{label}</span>
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl font-bold tabular-nums text-foreground">
            {display}{suffix || ''}
          </span>
          {trend && (
            <span
              className={cn(
                'flex items-center gap-0.5 text-xs font-semibold',
                trend.up ? 'text-emerald-600' : 'text-red-600',
              )}>
              {trend.up ? '↑' : '↓'}{Math.abs(trend.value)}%
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════
   SectionHeader — Consistent section title with optional action
   ═══════════════════════════════════════════════════ */
interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  badge?: string;
  gold?: boolean;
}

export function SectionHeader({ title, subtitle, action, badge, gold: goldBorder }: SectionHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h2 className={cls.sectionTitle}>{title}</h2>
        {subtitle && <p className={cls.sectionSubtitle}>{subtitle}</p>}
      </div>
      <div className="flex items-center gap-2">
        {badge && (
          <span
            className="text-[11px] font-medium px-2 py-1 rounded-md"
            style={{ background: 'rgba(212,175,55,0.1)', color: gold }}>
            {badge}
          </span>
        )}
        {action}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   GlassPanel — Wraps content in a glass card
   ═══════════════════════════════════════════════════ */
interface GlassPanelProps {
  children: ReactNode;
  className?: string;
  gold?: boolean;
  animate?: boolean;
  delay?: number;
}

export function GlassPanel({ children, className, gold: goldBorder, animate = true, delay = 0 }: GlassPanelProps) {
  const style = goldBorder
    ? { ...glassPanel, border: `1px solid rgba(212,175,55,0.3)`, borderLeft: '3px solid #D4AF37' }
    : glassPanel;

  if (!animate) {
    return (
      <div className={cn('rounded-xl overflow-hidden', className)} style={style}>
        {children}
      </div>
    );
  }

  return (
    <motion.div
      {...animations.fadeIn}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
      className={cn('rounded-xl overflow-hidden', className)}
      style={style}>
      {children}
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════
   QuickAction — CTA button card for dashboard
   ═══════════════════════════════════════════════════ */
interface QuickActionProps {
  icon: React.ElementType;
  label: string;
  color?: string;
  onClick: () => void;
  delay?: number;
}

export function QuickAction({ icon: Icon, label, color = gold, onClick, delay = 0 }: QuickActionProps) {
  return (
    <motion.button
      {...animations.stagger(delay / 0.04)}
      {...animations.hoverLift}
      onClick={onClick}
      className="flex flex-col items-center gap-2 p-4 rounded-xl text-center transition-shadow hover:shadow-md"
      style={{ background: card, border: `1px solid ${border}` }}>
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center"
        style={{ background: `${color}14` }}>
        <Icon className="w-4 h-4" style={{ color }} aria-hidden="true" />
      </div>
      <span className="text-xs font-medium text-foreground leading-tight">{label}</span>
    </motion.button>
  );
}

/* ═══════════════════════════════════════════════════
   SearchBar — Unified search with clear button
   ═══════════════════════════════════════════════════ */
interface SearchBarProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  width?: string;
}

export function SearchBar({ value, onChange, placeholder = 'Search...', className, width = 'w-48' }: SearchBarProps) {
  return (
    <div className={cn('relative', className)}>
      <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(cls.searchInput, width)}
        style={{ background: card, border: `1px solid ${border}` }}
      />
      {value && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => onChange('')}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        >
          <X className="w-3 h-3" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   ActionHeader — Standard page header with search + actions
   ═══════════════════════════════════════════════════ */
interface ActionHeaderProps {
  title: string;
  subtitle?: string;
  search?: string;
  onSearchChange?: (v: string) => void;
  searchPlaceholder?: string;
  actions?: ReactNode;
}

export function ActionHeader({
  title, subtitle, search = '', onSearchChange, searchPlaceholder, actions,
}: ActionHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h2 className={cls.sectionTitle}>{title}</h2>
        {subtitle && <p className={cls.sectionSubtitle}>{subtitle}</p>}
      </div>
      <div className="flex items-center gap-2">
        {onSearchChange && (
          <SearchBar
            value={search}
            onChange={onSearchChange}
            placeholder={searchPlaceholder}
          />
        )}
        {actions}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   GoldButton — Primary action button
   ═══════════════════════════════════════════════════ */
interface GoldButtonProps {
  label: string;
  icon?: React.ElementType;
  onClick: () => void;
  loading?: boolean;
  className?: string;
  size?: 'sm' | 'md';
}

export function GoldButton({ label, icon: Icon, onClick, loading, className, size = 'sm' }: GoldButtonProps) {
  const sizeClass = size === 'sm' ? 'h-8 gap-1.5 text-xs font-medium px-3' : 'h-9 gap-2 text-sm font-medium px-4';
  return (
    <Button
      onClick={onClick}
      disabled={loading}
      className={cn(sizeClass, className)}
      style={goldButton}>
      {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : Icon ? <Icon className="w-3.5 h-3.5" /> : null}
      {label}
    </Button>
  );
}

/* ═══════════════════════════════════════════════════
   IconAction — Small icon button for row actions
   ═══════════════════════════════════════════════════ */
interface IconActionProps {
  icon: React.ElementType;
  onClick: (e: React.MouseEvent) => void;
  tooltip?: string;
  danger?: boolean;
  color?: string;
}

export function IconAction({ icon: Icon, onClick, danger, color, tooltip }: IconActionProps) {
  return (
    <motion.button
      whileTap={{ scale: 0.9 }}
      onClick={onClick}
      aria-label={tooltip || 'Action'}
      title={tooltip}
      className={cn(
        'w-7 h-7 rounded-lg flex items-center justify-center transition-colors',
        danger
          ? 'text-muted-foreground hover:text-red-600 hover:bg-red-50'
          : 'text-muted-foreground hover:text-foreground hover:bg-black/[0.03]',
      )}
      style={color ? { color } : undefined}>
      <Icon className="w-3 h-3" aria-hidden="true" />
    </motion.button>
  );
}

/* ═══════════════════════════════════════════════════
   ProgressBar — Inline animated bar
   ═══════════════════════════════════════════════════ */
interface ProgressBarProps {
  value: number;
  max: number;
  color?: string;
  height?: number;
  delay?: number;
  showLabel?: boolean;
}

export function ProgressBar({
  value, max, color = gold, height = 6, delay = 0, showLabel = true,
}: ProgressBarProps) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="flex items-center gap-2">
      <div
        className="flex-1 rounded-full overflow-hidden"
        style={{ background: 'rgba(0,0,0,0.04)', height }}>
        <motion.div
          className="h-full rounded-full"
          style={{ background: `linear-gradient(90deg, ${color}CC, ${color})` }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, delay, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
      {showLabel && (
        <span className="text-[11px] font-bold tabular-nums text-foreground w-8 text-right shrink-0">
          {value}
        </span>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   EmptyState — Empty content placeholder
   ═══════════════════════════════════════════════════ */
interface EmptyScreenStateProps {
  icon: React.ElementType;
  title: string;
  description: string;
  action?: ReactNode;
  gold?: boolean;
}

export function EmptyScreenState({ icon: Icon, title, description, action, gold: goldIcon }: EmptyScreenStateProps) {
  return (
    <motion.div
      {...animations.fadeIn}
      className="flex flex-col items-center justify-center py-16 text-center rounded-xl"
      style={{ background: card, border: `1px solid ${border}` }}>
      <div
        className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3"
        style={goldIcon
          ? { background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.2)' }
          : { background: 'rgba(0,0,0,0.04)' }
        }>
        <Icon className="w-6 h-6" style={goldIcon ? { color: gold } : { color: '#9CA3AF' }} />
      </div>
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="text-xs text-muted-foreground mt-1 max-w-xs">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════
   ScreenSkeleton — Premium loading state
   ═══════════════════════════════════════════════════ */
interface ScreenSkeletonProps {
  kpiCount?: number;
  panels?: number;
  variant?: 'kpi+panels' | 'table' | 'grid';
}

export function ScreenSkeleton({ kpiCount = 5, panels = 3, variant = 'kpi+panels' }: ScreenSkeletonProps) {
  if (variant === 'table') {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 rounded-lg" />
        {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
      </div>
    );
  }
  if (variant === 'grid') {
    return (
      <div className="space-y-5">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[...Array(panels)].map((_, i) => <Skeleton key={i} className="h-56 rounded-xl" />)}
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-5">
      <div className={cls.kpiGrid}>
        {[...Array(kpiCount)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
      </div>
      <Skeleton className="h-48 rounded-xl" />
      <div className={cls.splitView}>
        <Skeleton className="h-72 rounded-xl lg:col-span-3" />
        <Skeleton className="h-72 rounded-xl lg:col-span-2" />
      </div>
      <div className={cls.splitView2}>
        <Skeleton className="h-72 rounded-xl" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   FilterTabs — Horizontal filter tabs
   ═══════════════════════════════════════════════════ */
interface FilterTab {
  key: string;
  label: string;
  count?: number;
}

interface FilterTabsProps {
  tabs: FilterTab[];
  active: string;
  onChange: (key: string) => void;
}

export function FilterTabs({ tabs, active, onChange }: FilterTabsProps) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {tabs.map(tab => (
        <button
          key={tab.key}
          className={cn(
            'text-[11px] px-3 py-1.5 rounded-lg font-medium transition-all duration-200',
            active === tab.key ? 'text-black' : 'text-muted-foreground hover:text-foreground',
          )}
          style={active === tab.key
            ? { background: 'linear-gradient(135deg, #D4AF37, #E8C860)' }
            : { background: 'rgba(0,0,0,0.03)', border: `1px solid ${border}` }
          }
          onClick={() => onChange(tab.key)}>
          {tab.label}
          {tab.count !== undefined && (
            <span className={cn(
              'ml-1.5 tabular-nums',
              active === tab.key ? 'text-black/70' : 'text-muted-foreground/50',
            )}>
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   TimeAgo — Relative time formatting
   ═══════════════════════════════════════════════════ */
export function timeAgo(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export function formatDateShort(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric',
  });
}
