'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, useScroll, useTransform, useInView, AnimatePresence } from 'framer-motion';
import {
  ArrowRight, ArrowUpRight, Lock,
  Network, Brain, Target, Users, BarChart3,
  MessageSquare, Layers, Zap, Shield, Sparkles,
} from 'lucide-react';
import LoginPage from '@/components/login-page';

/* ═══════════════════════════════════════════════════════════
   DESIGN TOKENS
   Deep black + warm gold. No generic purple.
   Palantir darkness × Linear precision × Apple confidence
   ═══════════════════════════════════════════════════════════ */
const C = {
  bg:           '#030304',
  bgSurface:    'rgba(255,255,255,0.03)',
  bgSurface2:   'rgba(255,255,255,0.05)',
  border:       'rgba(255,255,255,0.07)',
  borderLight:  'rgba(255,255,255,0.12)',
  text:         '#ededf0',
  textSub:      '#8b8b9e',
  textDim:      '#5a5a6e',
  gold:         '#c9a84c',
  goldBright:   '#e2c565',
  goldDim:      'rgba(201,168,76,0.12)',
  goldGlow:     'rgba(201,168,76,0.06)',
  white:        '#ffffff',
};

/* ═══════════════════════════════════════════════════════════
   CANVAS NETWORK VISUALIZATION
   Real animated particle network — not dots on a line
   ═══════════════════════════════════════════════════════════ */
interface NetNode {
  x: number; y: number;
  vx: number; vy: number;
  r: number;
  label: string;
  pinned: boolean;
  phase: number;
}

function useNetworkViz(canvasRef: React.RefObject<HTMLCanvasElement | null>) {
  const nodesRef = useRef<NetNode[]>([]);
  const mouseRef = useRef({ x: -1000, y: -1000 });
  const rafRef = useRef(0);

  const init = useCallback((w: number, h: number) => {
    const cx = w / 2, cy = h / 2;
    const labels = ['Companies', 'Business Signals', 'People', 'Opportunities', 'Executive Conversations'];
    const spread = Math.min(w, h) * 0.32;
    const pinned: NetNode[] = labels.map((label, i) => {
      const angle = -Math.PI * 0.35 + (i / (labels.length - 1)) * Math.PI * 0.7;
      const dist = spread * (0.7 + Math.sin(i * 1.3) * 0.3);
      return {
        x: cx + Math.cos(angle) * dist,
        y: cy + Math.sin(angle) * dist,
        vx: 0, vy: 0, r: 4 + (labels.length - i) * 1.2,
        label, pinned: true, phase: Math.random() * Math.PI * 2,
      };
    });
    const floaters: NetNode[] = Array.from({ length: 40 }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      r: 1 + Math.random() * 1.5,
      label: '', pinned: false,
      phase: Math.random() * Math.PI * 2,
    }));
    nodesRef.current = [...pinned, ...floaters];
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const resize = () => {
      const rect = canvas.parentElement!.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = rect.width + 'px';
      canvas.style.height = rect.height + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (nodesRef.current.length === 0) init(rect.width, rect.height);
    };
    resize();
    window.addEventListener('resize', resize);

    const handleMouse = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    canvas.addEventListener('mousemove', handleMouse);
    canvas.addEventListener('mouseleave', () => { mouseRef.current = { x: -1000, y: -1000 }; });

    let time = 0;
    const draw = () => {
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;
      ctx.clearRect(0, 0, w, h);
      time += 0.004;

      const nodes = nodesRef.current;
      const pinned = nodes.filter(n => n.pinned);
      const all = nodes;

      // Gentle float for pinned nodes
      pinned.forEach((n, i) => {
        if (!n.pinned) return;
        n.x += Math.sin(time + n.phase) * 0.15;
        n.y += Math.cos(time * 0.7 + n.phase) * 0.1;
      });

      // Move floaters
      all.forEach(n => {
        if (n.pinned) return;
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < 0 || n.x > w) n.vx *= -1;
        if (n.y < 0 || n.y > h) n.vy *= -1;
        n.x = Math.max(0, Math.min(w, n.x));
        n.y = Math.max(0, Math.min(h, n.y));
      });

      // Draw connections between pinned nodes
      for (let i = 0; i < pinned.length - 1; i++) {
        const a = pinned[i], b = pinned[i + 1];
        const grad = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
        grad.addColorStop(0, 'rgba(201,168,76,0.25)');
        grad.addColorStop(1, 'rgba(201,168,76,0.06)');
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        // Curved connection
        const mx = (a.x + b.x) / 2 + Math.sin(time + i) * 15;
        const my = (a.y + b.y) / 2 + Math.cos(time * 0.8 + i) * 10;
        ctx.quadraticCurveTo(mx, my, b.x, b.y);
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Draw floaters connections to nearby pinned
      const connDist = 180;
      all.forEach(n => {
        if (n.pinned) return;
        pinned.forEach(p => {
          const dx = n.x - p.x, dy = n.y - p.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < connDist) {
            const alpha = (1 - dist / connDist) * 0.08;
            ctx.beginPath();
            ctx.moveTo(n.x, n.y);
            ctx.lineTo(p.x, p.y);
            ctx.strokeStyle = `rgba(201,168,76,${alpha})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        });
      });

      // Draw floater nodes
      all.forEach(n => {
        if (n.pinned) return;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        ctx.fill();
      });

      // Draw pinned nodes (main nodes)
      pinned.forEach((n, i) => {
        // Outer glow
        const glow = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r * 6);
        glow.addColorStop(0, 'rgba(201,168,76,0.12)');
        glow.addColorStop(1, 'rgba(201,168,76,0)');
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r * 6, 0, Math.PI * 2);
        ctx.fillStyle = glow;
        ctx.fill();

        // Pulsing ring
        const pulse = Math.sin(time * 2 + i) * 0.5 + 0.5;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r * (1.8 + pulse * 0.8), 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(201,168,76,${0.1 - pulse * 0.07})`;
        ctx.lineWidth = 0.5;
        ctx.stroke();

        // Core dot
        const coreGrad = ctx.createRadialGradient(n.x - n.r * 0.3, n.y - n.r * 0.3, 0, n.x, n.y, n.r);
        coreGrad.addColorStop(0, C.goldBright);
        coreGrad.addColorStop(1, C.gold);
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fillStyle = coreGrad;
        ctx.fill();

        // Label
        ctx.font = '500 11px Inter, system-ui, -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = i === 0 ? C.white : C.textSub;
        ctx.fillText(n.label, n.x, n.y + n.r + 18);
      });

      // Mouse interaction: attract nearby floaters
      const mx = mouseRef.current.x, my = mouseRef.current.y;
      if (mx > 0 && my > 0) {
        const mouseGlow = ctx.createRadialGradient(mx, my, 0, mx, my, 100);
        mouseGlow.addColorStop(0, 'rgba(201,168,76,0.04)');
        mouseGlow.addColorStop(1, 'rgba(201,168,76,0)');
        ctx.beginPath();
        ctx.arc(mx, my, 100, 0, Math.PI * 2);
        ctx.fillStyle = mouseGlow;
        ctx.fill();
      }

      rafRef.current = requestAnimationFrame(draw);
    };
    rafRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('mousemove', handleMouse);
    };
  }, [init]);
}

/* ═══════════════════════════════════════════════════════════
   HERO
   ═══════════════════════════════════════════════════════════ */
function HeroSection({ onExplore, onLogin }: { onExplore: () => void; onLogin: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const netRef = useRef<HTMLDivElement>(null);
  const netInView = useInView(netRef, { once: true, margin: '-50px' });
  useNetworkViz(canvasRef);

  const { scrollYProgress } = useScroll();
  const heroOpacity = useTransform(scrollYProgress, [0, 0.12], [1, 0]);
  const heroY = useTransform(scrollYProgress, [0, 0.12], [0, -40]);

  return (
    <motion.section
      className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden"
      style={{ opacity: heroOpacity, y: heroY }}
    >
      {/* Top nav */}
      <nav className="fixed top-0 left-0 right-0 z-50">
        <div className="mx-auto max-w-[1200px] flex items-center justify-between px-6 sm:px-8 py-5">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md flex items-center justify-center"
              style={{ background: C.goldDim, border: `1px solid rgba(201,168,76,0.2)` }}>
              <Sparkles className="w-3.5 h-3.5" style={{ color: C.gold }} />
            </div>
            <span className="text-[13px] font-semibold tracking-[-0.01em]" style={{ color: C.white }}>
              DeepMindQ
            </span>
          </div>
          <button onClick={onLogin}
            className="text-[13px] font-medium px-4 py-2 rounded-lg transition-all duration-300"
            style={{ color: C.textSub, border: `1px solid ${C.border}` }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = C.borderLight; e.currentTarget.style.color = C.white; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.textSub; }}>
            Sign In
          </button>
        </div>
      </nav>

      {/* Hero text */}
      <div className="relative z-10 text-center px-6 pt-28 pb-4 max-w-[720px] mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
        >
          <h1 className="text-[clamp(2.8rem,7vw,5.5rem)] font-semibold leading-[1.05] tracking-[-0.035em]"
            style={{ color: C.white }}>
            Understand<br />Before You Sell
          </h1>
        </motion.div>

        <motion.p
          className="mt-6 text-base sm:text-lg leading-relaxed max-w-[480px] mx-auto"
          style={{ color: C.textSub }}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
        >
          AI-powered enterprise growth intelligence that transforms
          market signals, account research, and stakeholder mapping
          into decisive action.
        </motion.p>

        <motion.div
          className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
        >
          <button onClick={onExplore}
            className="group flex items-center gap-2 px-6 py-3 rounded-xl text-[14px] font-medium transition-all duration-300"
            style={{ background: C.white, color: C.bg }}
            onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 0 40px rgba(201,168,76,0.15)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'translateY(0)'; }}>
            Explore DeepMindQ
            <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-0.5" />
          </button>
          <button onClick={onLogin}
            className="group flex items-center gap-2 px-6 py-3 rounded-xl text-[14px] font-medium transition-all duration-300"
            style={{ color: C.textSub, border: `1px solid ${C.border}`, background: 'transparent' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(201,168,76,0.3)'; e.currentTarget.style.color = C.white; e.currentTarget.style.transform = 'translateY(-1px)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.textSub; e.currentTarget.style.transform = 'translateY(0)'; }}>
            <Lock className="w-3.5 h-3.5" />
            Private Workspace
          </button>
        </motion.div>
      </div>

      {/* Network Canvas */}
      <motion.div
        ref={netRef}
        className="relative z-10 w-full max-w-[1000px] mx-auto flex-1 min-h-[320px] sm:min-h-[400px]"
        initial={{ opacity: 0 }}
        animate={netInView ? { opacity: 1 } : {}}
        transition={{ duration: 1.2, delay: 0.3 }}
      >
        <canvas ref={canvasRef} className="w-full h-full" />
      </motion.div>

      {/* Bottom fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 pointer-events-none"
        style={{ background: 'linear-gradient(to top, #030304 0%, transparent 100%)' }} />

      {/* Scroll hint */}
      <motion.div
        className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20"
        animate={{ y: [0, 6, 0] }}
        transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}>
        <div className="w-5 h-8 rounded-full border flex items-start justify-center pt-1.5"
          style={{ borderColor: C.border }}>
          <div className="w-1 h-1.5 rounded-full" style={{ background: C.textDim }} />
        </div>
      </motion.div>
    </motion.section>
  );
}

/* ═══════════════════════════════════════════════════════════
   MANIFESTO — Apple-style big statement
   ═══════════════════════════════════════════════════════════ */
function ManifestoSection() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });

  return (
    <section ref={ref} className="py-28 sm:py-40 px-6">
      <div className="max-w-[860px] mx-auto">
        <motion.p className="text-[11px] font-medium tracking-[0.3em] uppercase mb-10"
          style={{ color: C.gold }}
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ duration: 0.7 }}>
          Why DeepMindQ
        </motion.p>

        <motion.h2
          className="text-[clamp(1.6rem,3.5vw,2.8rem)] sm:text-[2.6rem] lg:text-[3rem] leading-[1.25] tracking-[-0.025em] font-light"
          style={{ color: C.text }}
          initial={{ opacity: 0, y: 24 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.9, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
        >
          The best sales conversations don&apos;t feel like selling.{' '}
          <span style={{ color: C.textDim }}>They feel like</span>{' '}
          <span className="italic" style={{ color: C.gold }}>understanding.</span>
        </motion.h2>

        <motion.div
          className="mt-8 grid sm:grid-cols-2 gap-6"
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
        >
          <p className="text-[15px] leading-[1.75]" style={{ color: C.textSub }}>
            Most sales teams operate on assumptions — guessing who to call, what to say,
            and when to engage. DeepMindQ replaces guesswork with intelligence.
            Every account, every stakeholder, every conversation informed by
            deep understanding of your prospect&apos;s world.
          </p>
          <p className="text-[15px] leading-[1.75]" style={{ color: C.textSub }}>
            We built DeepMindQ for a fundamental reason: the gap between knowing
            about a company and truly understanding it is where deals are won or lost.
            This platform closes that gap — continuously, automatically, intelligently.
          </p>
        </motion.div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════
   FEATURES — Asymmetric bento grid, not uniform rectangles
   ═══════════════════════════════════════════════════════════ */
const FEATURES = [
  {
    icon: Network,
    title: 'Account Intelligence',
    description: 'Map company ecosystems, technology stacks, funding signals, and strategic relationships. See the full picture before you dial.',
    accent: true,
  },
  {
    icon: Brain,
    title: 'AI Conversation Studio',
    description: 'Generate hyper-personalized outreach informed by deep account research and precise capability alignment.',
    accent: false,
  },
  {
    icon: Target,
    title: 'Opportunity Radar',
    description: 'Detect buying signals, trigger events, and executive movements across your entire target market in real-time.',
    wide: true,
    accent: false,
  },
  {
    icon: Users,
    title: 'Stakeholder Mapping',
    description: 'Identify decision-makers, influencers, and champions. Understand power dynamics before the first meeting.',
    accent: false,
  },
  {
    icon: BarChart3,
    title: 'Pipeline Intelligence',
    description: 'AI-driven deal scoring, stage progression analytics, and conversion forecasting you can act on.',
    accent: true,
  },
  {
    icon: MessageSquare,
    title: 'Relationship Memory',
    description: 'Every interaction, preference, and context remembered. Build on history instead of starting from zero.',
    wide: true,
    accent: false,
  },
  {
    icon: Layers,
    title: 'Solution Intelligence',
    description: 'Align capabilities to pain points with evidence-based positioning.',
    accent: false,
  },
  {
    icon: Zap,
    title: 'Signal Intelligence',
    description: 'Aggregate market signals, competitor moves, and industry shifts into actionable insights.',
    accent: false,
  },
  {
    icon: Shield,
    title: 'Enterprise Security',
    description: 'End-to-end encryption, role-based access, and complete audit trails. Built for enterprise trust.',
    accent: true,
  },
];

function FeatureCard({ icon: Icon, title, description, index, accent, wide }: {
  icon: React.ElementType; title: string; description: string;
  index: number; accent?: boolean; wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-40px' });

  return (
    <motion.div
      ref={ref}
      className={`group relative rounded-2xl p-7 sm:p-8 transition-colors duration-500 ${wide ? 'sm:col-span-2' : ''}`}
      style={{
        background: accent ? C.bgSurface2 : C.bgSurface,
        border: `1px solid ${accent ? 'rgba(201,168,76,0.12)' : C.border}`,
      }}
      initial={{ opacity: 0, y: 24 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay: index * 0.06, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ borderColor: accent ? 'rgba(201,168,76,0.25)' : C.borderLight }}
    >
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-5 transition-colors duration-500`}
        style={{ background: accent ? C.goldDim : 'rgba(255,255,255,0.06)' }}>
        <Icon className="w-[18px] h-[18px]" style={{ color: accent ? C.gold : C.textSub }} />
      </div>
      <h3 className="text-[15px] font-semibold mb-2.5 tracking-[-0.01em]" style={{ color: C.white }}>
        {title}
      </h3>
      <p className="text-[13.5px] leading-[1.7]" style={{ color: C.textSub }}>
        {description}
      </p>
      {accent && (
        <div className="absolute top-0 right-0 w-32 h-32 pointer-events-none"
          style={{ background: `radial-gradient(circle at top right, ${C.goldGlow}, transparent 70%)` }} />
      )}
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════
   STATS — McKinsey authority
   ═══════════════════════════════════════════════════════════ */
function StatsSection() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true });

  const stats = [
    { value: '10x', label: 'Faster Account Research' },
    { value: '73%', label: 'Higher Email Engagement' },
    { value: '3.2x', label: 'Pipeline Velocity' },
    { value: '<2 min', label: 'Signal to Action' },
  ];

  return (
    <section ref={ref} className="py-20 sm:py-28 px-6">
      <div className="mx-auto max-w-[960px]">
        {/* Divider */}
        <div className="w-full h-px mb-20" style={{ background: `linear-gradient(90deg, transparent, ${C.border}, transparent)` }} />

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-10 sm:gap-6">
          {stats.map((stat, i) => (
            <motion.div key={stat.label}
              className="text-center"
              initial={{ opacity: 0, y: 16 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}>
              <div className="text-[clamp(2rem,4vw,3rem)] font-semibold tracking-[-0.03em] leading-none mb-2"
                style={{ color: C.gold }}>
                {stat.value}
              </div>
              <div className="text-[13px] font-medium" style={{ color: C.textDim }}>
                {stat.label}
              </div>
            </motion.div>
          ))}
        </div>

        <div className="w-full h-px mt-20" style={{ background: `linear-gradient(90deg, transparent, ${C.border}, transparent)` }} />
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════
   HOW IT WORKS — Three clear steps
   ═══════════════════════════════════════════════════════════ */
function HowItWorks() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });

  const steps = [
    {
      num: '01',
      title: 'Connect your accounts',
      description: 'Import your target accounts. DeepMindQ begins mapping company ecosystems, technology stacks, and strategic relationships automatically.',
    },
    {
      num: '02',
      title: 'AI discovers intelligence',
      description: 'Signals, stakeholder dynamics, buying triggers, and competitive movements are continuously analyzed and surfaced to your Command Center.',
    },
    {
      num: '03',
      title: 'Engage with precision',
      description: 'Generate research-informed conversations, track relationship memory, and convert understanding into pipeline — all from one workspace.',
    },
  ];

  return (
    <section ref={ref} className="py-24 sm:py-32 px-6">
      <div className="mx-auto max-w-[960px]">
        <motion.p className="text-[11px] font-medium tracking-[0.3em] uppercase mb-4"
          style={{ color: C.gold }}
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ duration: 0.6 }}>
          How it works
        </motion.p>
        <motion.h2 className="text-[clamp(1.4rem,3vw,2.2rem)] font-semibold tracking-[-0.02em] mb-16 sm:mb-20"
          style={{ color: C.white }}
          initial={{ opacity: 0, y: 16 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}>
          From signal to pipeline in three steps
        </motion.h2>

        <div className="space-y-0">
          {steps.map((step, i) => (
            <motion.div
              key={step.num}
              className="grid sm:grid-cols-[60px_1fr] gap-4 sm:gap-8 py-8 sm:py-10"
              style={{ borderBottom: `1px solid ${C.border}` }}
              initial={{ opacity: 0, y: 16 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.15 + i * 0.1, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="text-[32px] font-light tracking-[-0.03em] leading-none pt-1"
                style={{ color: C.gold }}>
                {step.num}
              </div>
              <div>
                <h3 className="text-[17px] font-semibold mb-2.5 tracking-[-0.01em]" style={{ color: C.white }}>
                  {step.title}
                </h3>
                <p className="text-[14px] leading-[1.75] max-w-[560px]" style={{ color: C.textSub }}>
                  {step.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════
   CLOSING CTA
   ═══════════════════════════════════════════════════════════ */
function ClosingCta({ onLogin }: { onLogin: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });

  return (
    <section ref={ref} className="py-28 sm:py-40 px-6">
      <div className="mx-auto max-w-[640px] text-center">
        <motion.h2
          className="text-[clamp(1.6rem,3.5vw,2.6rem)] font-semibold tracking-[-0.025em] leading-[1.2] mb-5"
          style={{ color: C.white }}
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        >
          Ready to sell with intelligence?
        </motion.h2>
        <motion.p
          className="text-[15px] leading-[1.7] mb-10 max-w-[440px] mx-auto"
          style={{ color: C.textSub }}
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ duration: 0.7, delay: 0.1 }}
        >
          A personal AI-powered enterprise growth intelligence system.
          Built for enterprise sales leaders who refuse to guess.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
        >
          <button onClick={onLogin}
            className="group inline-flex items-center gap-2.5 px-7 py-3.5 rounded-xl text-[14px] font-medium transition-all duration-300"
            style={{ background: C.white, color: C.bg }}
            onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 0 50px rgba(201,168,76,0.15)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'translateY(0)'; }}>
            Enter Your Workspace
            <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-0.5" />
          </button>
        </motion.div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════
   FOOTER
   ═══════════════════════════════════════════════════════════ */
function Footer({ onLogin }: { onLogin: () => void }) {
  return (
    <footer className="py-12 px-6" style={{ borderTop: `1px solid ${C.border}` }}>
      <div className="mx-auto max-w-[1200px] flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <Sparkles className="w-3.5 h-3.5" style={{ color: C.textDim }} />
          <span className="text-[12px] font-medium" style={{ color: C.textDim }}>DeepMindQ</span>
        </div>
        <div className="flex items-center gap-6">
          <button onClick={onLogin} className="text-[12px] transition-colors duration-300 hover:text-white"
            style={{ color: C.textDim }}>Private Workspace</button>
          <span className="text-[11px]" style={{ color: C.textDim }}>
            &copy; {new Date().getFullYear()} DeepMindQ
          </span>
        </div>
      </div>
    </footer>
  );
}

/* ═══════════════════════════════════════════════════════════
   MAIN EXPORT
   ═══════════════════════════════════════════════════════════ */
interface LandingPageProps {
  onLogin: () => void;
}

export default function LandingPage({ onLogin }: LandingPageProps) {
  const [showLogin, setShowLogin] = useState(false);

  if (showLogin) {
    return <LoginPage onLogin={onLogin} />;
  }

  const handleExplore = () => {
    const el = document.getElementById('features');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen" style={{ background: C.bg, color: C.text }}>
      {/* Subtle noise texture overlay */}
      <div className="fixed inset-0 pointer-events-none z-0 opacity-[0.015]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'repeat',
          backgroundSize: '256px 256px',
        }}
      />

      {/* Ambient background glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-20%] left-[20%] w-[600px] h-[600px] rounded-full"
          style={{ background: 'radial-gradient(ellipse, rgba(201,168,76,0.04) 0%, transparent 65%)', filter: 'blur(80px)' }} />
        <div className="absolute bottom-[-10%] right-[10%] w-[500px] h-[500px] rounded-full"
          style={{ background: 'radial-gradient(ellipse, rgba(100,120,200,0.02) 0%, transparent 65%)', filter: 'blur(60px)' }} />
      </div>

      <div className="relative z-10">
        <HeroSection onExplore={handleExplore} onLogin={() => setShowLogin(true)} />

        <ManifestoSection />

        <section id="features" className="py-16 sm:py-24 px-6">
          <div className="mx-auto max-w-[960px]">
            <motion.p className="text-[11px] font-medium tracking-[0.3em] uppercase mb-4"
              style={{ color: C.gold }}
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}>
              Capabilities
            </motion.p>
            <motion.h2 className="text-[clamp(1.4rem,3vw,2.2rem)] font-semibold tracking-[-0.02em] mb-4"
              style={{ color: C.white }}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1, ease: [0.16, 1, 0.3, 1] }}>
              Intelligence at every layer
            </motion.h2>
            <motion.p className="text-[14px] mb-14 sm:mb-16 max-w-[480px]"
              style={{ color: C.textSub }}
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.15 }}>
              Nine integrated modules working as a unified intelligence system — not disconnected tools.
            </motion.p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {FEATURES.map((f, i) => (
                <FeatureCard
                  key={f.title}
                  icon={f.icon}
                  title={f.title}
                  description={f.description}
                  index={i}
                  accent={f.accent}
                  wide={f.wide}
                />
              ))}
            </div>
          </div>
        </section>

        <HowItWorks />
        <StatsSection />
        <ClosingCta onLogin={() => setShowLogin(true)} />
        <Footer onLogin={() => setShowLogin(true)} />
      </div>
    </div>
  );
}