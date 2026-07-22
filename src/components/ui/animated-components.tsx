'use client';

import { motion, useInView, useMotionValue, useTransform, animate } from 'framer-motion';
import { useRef, useState, useEffect, type ReactNode } from 'react';

/* ═══════════════════════════════════════════════════
   Animated Counter - counts up from 0 to target
   ═══════════════════════════════════════════════════ */
export function AnimatedCounter({ value, className = '', prefix = '', suffix = '' }: {
  value: number; className?: string; prefix?: string; suffix?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const motionVal = useMotionValue(0);
  const rounded = useTransform(motionVal, v => Math.round(v).toLocaleString());

  useEffect(() => {
    if (inView) {
      const controls = animate(motionVal, value, { duration: 1.2, ease: [0.25, 0.46, 0.45, 0.94] });
      return () => controls.stop();
    }
  }, [inView, value, motionVal]);

  return (
    <span ref={ref} className={`tabular-nums ${className}`}>
      {prefix}<motion.span>{rounded}</motion.span>{suffix}
    </span>
  );
}

/* ═══════════════════════════════════════════════════
   Page Transition Wrapper - DRAMATIC entrance
   ═══════════════════════════════════════════════════ */
export function PageTransition({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.99 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.99 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════
   Glowing Card - gradient border + glow on hover
   ═══════════════════════════════════════════════════ */
export function AnimatedCard({ children, className = '', delay = 0, hover = true, glow = '' }: {
  children: ReactNode; className?: string; delay?: number; hover?: boolean; glow?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-20px' });
  const [hovered, setHovered] = useState(false);

  const glowColor = glow || 'rgba(212, 175, 55, 0.08)';

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 24 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="relative group"
    >
      {/* Glow effect */}
      <div
        className="absolute -inset-[1px] rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-sm"
        style={{ background: hovered ? glowColor : 'transparent' }}
      />
      <div
        className={`relative rounded-xl border bg-card/80 backdrop-blur-md transition-all duration-300 ${
          hovered && hover ? 'border-primary/30 shadow-lg shadow-primary/5' : 'border-border'
        } ${hover ? 'cursor-default' : ''} ${className}`}
      >
        {children}
      </div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════
   Stat Card - premium gradient border stat display
   ═══════════════════════════════════════════════════ */
export function StatCard({ label, value, icon: Icon, color = 'var(--color-gold)', trend, delay = 0 }: {
  label: string; value: number | string; icon?: React.ComponentType<{ className?: string }>;
  color?: string; trend?: { value: string; up: boolean }; delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={inView ? { opacity: 1, y: 0, scale: 1 } : {}}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className="relative"
    >
      {/* Gradient border wrapper */}
      <div
        className="rounded-xl p-[1px] transition-all duration-300"
        style={{
          background: `linear-gradient(135deg, ${color}40, ${color}10, transparent 60%)`,
        }}
      >
        <div className="rounded-xl bg-card p-5">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">{label}</p>
              <p className="text-3xl font-bold tabular-nums" style={{ color }}>
                {typeof value === 'number' ? (
                  <AnimatedCounter value={value} />
                ) : value}
              </p>
              {trend && (
                <div className={`flex items-center gap-1 text-xs font-medium ${trend.up ? 'text-emerald-400' : 'text-red-400'}`}>
                  <span>{trend.up ? '+' : '-'}</span>
                  <span>{trend.value}</span>
                </div>
              )}
            </div>
            {Icon && (
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center"
                style={{ background: `${color}15` }}
              >
                <div style={{ color }}><Icon className="w-5 h-5" /></div>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════
   Stagger Grid - children animate in sequence
   ═══════════════════════════════════════════════════ */
export function StaggerGrid({ children, className = '', stagger = 0.07, delay = 0 }: {
  children: ReactNode; className?: string; stagger?: number; delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-30px' });

  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={inView ? 'show' : 'hidden'}
      variants={{
        hidden: {},
        show: { transition: { staggerChildren: stagger, delayChildren: delay } },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════
   Stagger Item - use inside StaggerGrid
   ═══════════════════════════════════════════════════ */
export function StaggerItem({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 20, scale: 0.97 },
        show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════
   Section Header - dramatic gold accent
   ═══════════════════════════════════════════════════ */
export function SectionHeader({ title, subtitle, className = '' }: {
  title: string; subtitle?: string; className?: string;
}) {
  return (
    <div className={`mb-6 ${className}`}>
      <div className="flex items-center gap-3 mb-1">
        <div
          className="h-6 w-1.5 rounded-full shadow-lg"
          style={{ background: 'linear-gradient(180deg, #E8C860, #D4AF37, #9A8340)', boxShadow: '0 0 12px rgba(212, 175, 55, 0.3)' }}
        />
        <h2 className="text-lg font-bold text-foreground tracking-tight">{title}</h2>
      </div>
      {subtitle && <p className="text-sm text-muted-foreground ml-5">{subtitle}</p>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   Animated Progress Bar - with glow effect
   ═══════════════════════════════════════════════════ */
export function AnimatedBar({ value, max, color = 'var(--color-gold)', className = '', delay = 0 }: {
  value: number; max: number; color?: string; className?: string; delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true });
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;

  return (
    <div ref={ref} className={`h-2.5 rounded-full overflow-hidden bg-gray-200 ${className}`}>
      <motion.div
        className="h-full rounded-full relative"
        style={{ background: `linear-gradient(90deg, ${color}, ${color}DD)` }}
        initial={{ width: 0 }}
        animate={inView ? { width: `${pct}%` } : { width: 0 }}
        transition={{ duration: 1, delay, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="absolute inset-0 rounded-full" style={{ boxShadow: `0 0 8px ${color}60` }} />
      </motion.div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   Stat Value (kept for backwards compat)
   ═══════════════════════════════════════════════════ */
export function StatValue({ value, className = '' }: { value: string | number; className?: string }) {
  return (
    <span className={`text-2xl font-bold tabular-nums text-foreground ${className}`}>{value}</span>
  );
}

/* ═══════════════════════════════════════════════════
   Pulse Dot - for alerts/notifications
   ═══════════════════════════════════════════════════ */
export function PulseDot({ color = 'var(--color-gold)' }: { color?: string }) {
  return (
    <span className="relative flex h-2.5 w-2.5">
      <span
        className="absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping"
        style={{ background: color, boxShadow: `0 0 8px ${color}80` }}
      />
      <span
        className="relative inline-flex rounded-full h-2.5 w-2.5"
        style={{ background: color, boxShadow: `0 0 6px ${color}60` }}
      />
    </span>
  );
}

/* ═══════════════════════════════════════════════════
   Animated Tab Indicator
   ═══════════════════════════════════════════════════ */
export function TabBar({ tabs, active, onChange }: {
  tabs: { key: string; label: string; count?: number }[];
  active: string;
  onChange: (key: string) => void;
}) {
  return (
    <div className="flex items-center gap-1 p-1.5 rounded-xl bg-gray-100 border border-gray-200 backdrop-blur-sm overflow-x-auto scrollbar-hide">
      {tabs.map(tab => {
        const isActive = tab.key === active;
        return (
          <motion.button
            key={tab.key}
            onClick={() => onChange(tab.key)}
            className={`relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground/70'
            }`}
            whileTap={{ scale: 0.96 }}
          >
            {isActive && (
              <motion.div
                layoutId="tab-indicator"
                className="absolute inset-0 rounded-lg"
                style={{
                  background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.12), rgba(212, 175, 55, 0.06))',
                  border: '1px solid rgba(212, 175, 55, 0.25)',
                  boxShadow: '0 0 12px rgba(212, 175, 55, 0.08)',
                }}
                transition={{ type: 'spring', stiffness: 350, damping: 30 }}
              />
            )}
            <span className="relative z-10">{tab.label}</span>
            {tab.count !== undefined && (
              <span className={`relative z-10 text-xs px-1.5 py-0.5 rounded-full ${
                isActive ? 'bg-primary/20 text-primary font-semibold' : 'bg-gray-200 text-muted-foreground'
              }`}>
                {tab.count}
              </span>
            )}
          </motion.button>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   Gradient Border Card
   ═══════════════════════════════════════════════════ */
export function GradientCard({ children, className = '', gradient = 'gold' }: {
  children: ReactNode; className?: string; gradient?: 'gold' | 'blue' | 'green' | 'red' | 'purple';
}) {
  const colors: Record<string, { from: string; to: string }> = {
    gold:   { from: 'rgba(212, 175, 55, 0.25)', to: 'rgba(212, 175, 55, 0.05)' },
    blue:   { from: 'rgba(59, 130, 246, 0.25)', to: 'rgba(59, 130, 246, 0.05)' },
    green:  { from: 'rgba(16, 185, 129, 0.25)', to: 'rgba(16, 185, 129, 0.05)' },
    red:    { from: 'rgba(239, 68, 68, 0.25)', to: 'rgba(239, 68, 68, 0.05)' },
    purple: { from: 'rgba(139, 92, 246, 0.25)', to: 'rgba(139, 92, 246, 0.05)' },
  };

  const c = colors[gradient] || colors.gold;

  return (
    <div
      className={`rounded-xl p-[1px] ${className}`}
      style={{ background: `linear-gradient(135deg, ${c.from}, ${c.to}, transparent 70%)` }}
    >
      <div className="rounded-xl bg-card p-4">
        {children}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   Shimmer Text - animated gradient text effect
   ═══════════════════════════════════════════════════ */
export function ShimmerText({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={`inline-block bg-clip-text text-transparent bg-gradient-to-r from-foreground via-primary to-foreground animate-[shimmer_3s_ease-in-out_infinite] ${className}`}
      style={{
        backgroundSize: '200% 100%',
      }}
    >
      {children}
    </span>
  );
}

/* ═══════════════════════════════════════════════════
   Glass Panel - frosted glass container
   ═══════════════════════════════════════════════════ */
export function GlassPanel({ children, className = '', style }: { children: ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={`rounded-xl border border-gray-200 bg-white backdrop-blur-xl ${className}`}
      style={{ boxShadow: '0 1px 3px rgba(0, 0, 0, 0.06), 0 1px 2px rgba(0, 0, 0, 0.04)', ...style }}
    >
      {children}
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   Empty State - beautiful empty state component
   ═══════════════════════════════════════════════════ */
export function EmptyState({ icon: Icon, title, description, action, className = '' }: {
  icon?: React.ComponentType<{ className?: string }>;
  title: string; description?: string; action?: ReactNode; className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
      className={`flex flex-col items-center justify-center py-16 text-center ${className}`}
    >
      {Icon && (
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
          <Icon className="w-8 h-8 text-primary/60" />
        </div>
      )}
      <p className="text-sm font-medium text-foreground mb-1">{title}</p>
      {description && <p className="text-xs text-muted-foreground max-w-sm">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </motion.div>
  );
}