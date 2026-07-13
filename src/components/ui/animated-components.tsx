'use client';

import { motion, useInView } from 'framer-motion';
import { useRef, type ReactNode } from 'react';

/* ═══════════════════════════════════════════════════
   Page Transition Wrapper
   Wraps each screen with a fade+slide entrance
   ═══════════════════════════════════════════════════ */
export function PageTransition({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════
   Animated Card with hover lift + gold border glow
   ═══════════════════════════════════════════════════ */
export function AnimatedCard({ children, className = '', delay = 0, hover = true }: {
  children: ReactNode; className?: string; delay?: number; hover?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-30px' });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
      whileHover={hover ? { y: -2, borderColor: 'rgba(212, 175, 55, 0.25)' } : undefined}
      className={`rounded-xl border border-border bg-card/60 backdrop-blur-sm transition-colors duration-300 ${hover ? 'cursor-default' : ''} ${className}`}
    >
      {children}
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════
   Stagger Grid - children animate in sequence
   ═══════════════════════════════════════════════════ */
export function StaggerGrid({ children, className = '', stagger = 0.06, delay = 0 }: {
  children: ReactNode; className?: string; stagger?: number; delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-40px' });

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
        hidden: { opacity: 0, y: 16 },
        show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] } },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════
   Section Header with gold accent line
   ═══════════════════════════════════════════════════ */
export function SectionHeader({ title, subtitle, className = '' }: {
  title: string; subtitle?: string; className?: string;
}) {
  return (
    <div className={`mb-6 ${className}`}>
      <div className="flex items-center gap-3 mb-1">
        <div className="h-5 w-1 rounded-full" style={{ background: 'linear-gradient(180deg, #D4AF37, #9A8340)' }} />
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
      </div>
      {subtitle && <p className="text-sm text-muted-foreground ml-4">{subtitle}</p>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   Animated Progress Bar
   ═══════════════════════════════════════════════════ */
export function AnimatedBar({ value, max, color = '#D4AF37', className = '', delay = 0 }: {
  value: number; max: number; color?: string; className?: string; delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true });
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;

  return (
    <div ref={ref} className={`h-2 rounded-full overflow-hidden bg-white/5 ${className}`}>
      <motion.div
        className="h-full rounded-full"
        style={{ background: `linear-gradient(90deg, ${color}, ${color}CC)` }}
        initial={{ width: 0 }}
        animate={inView ? { width: `${pct}%` } : { width: 0 }}
        transition={{ duration: 0.8, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
      />
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   Stat Value with animated count-up
   ═══════════════════════════════════════════════════ */
export function StatValue({ value, className = '' }: { value: string | number; className?: string }) {
  return (
    <span className={`text-2xl font-bold tabular-nums text-foreground ${className}`}>{value}</span>
  );
}

/* ═══════════════════════════════════════════════════
   Pulse Dot - for alerts/notifications
   ═══════════════════════════════════════════════════ */
export function PulseDot({ color = '#D4AF37' }: { color?: string }) {
  return (
    <span className="relative flex h-2.5 w-2.5">
      <span
        className="absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping"
        style={{ background: color }}
      />
      <span
        className="relative inline-flex rounded-full h-2.5 w-2.5"
        style={{ background: color }}
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
    <div className="flex items-center gap-1 p-1 rounded-lg bg-white/[0.03] border border-border overflow-x-auto scrollbar-hide">
      {tabs.map(tab => {
        const isActive = tab.key === active;
        return (
          <motion.button
            key={tab.key}
            onClick={() => onChange(tab.key)}
            className={`relative flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${
              isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground/70'
            }`}
            whileTap={{ scale: 0.97 }}
          >
            {isActive && (
              <motion.div
                layoutId="tab-indicator"
                className="absolute inset-0 rounded-md"
                style={{ background: 'rgba(212, 175, 55, 0.1)', border: '1px solid rgba(212, 175, 55, 0.2)' }}
                transition={{ type: 'spring', stiffness: 350, damping: 30 }}
              />
            )}
            <span className="relative z-10">{tab.label}</span>
            {tab.count !== undefined && (
              <span className={`relative z-10 text-xs px-1.5 py-0.5 rounded-full ${
                isActive ? 'bg-primary/20 text-primary' : 'bg-white/5 text-muted-foreground'
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
  const colors: Record<string, string> = {
    gold: 'rgba(212, 175, 55, 0.15)',
    blue: 'rgba(59, 130, 246, 0.15)',
    green: 'rgba(16, 185, 129, 0.15)',
    red: 'rgba(239, 68, 68, 0.15)',
    purple: 'rgba(139, 92, 246, 0.15)',
  };

  return (
    <div
      className={`rounded-xl p-[1px] ${className}`}
      style={{ background: `linear-gradient(135deg, ${colors[gradient]}, transparent 60%)` }}
    >
      <div className="rounded-xl bg-card p-4">
        {children}
      </div>
    </div>
  );
}