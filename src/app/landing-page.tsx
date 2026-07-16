'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, useScroll, useTransform, useInView, AnimatePresence, useMotionValue, useSpring } from 'framer-motion';
import {
  ArrowRight, ArrowUpRight, Lock, ExternalLink,
  Building2, BarChart3, Brain, MessageSquare, Users, Target,
  Search, Lightbulb, Rocket, TrendingUp, Zap, Shield,
  Layers, Network, Sparkles, ChevronRight, Eye, Database,
  Linkedin, Mail, BookOpen, Menu, X,
} from 'lucide-react';
import LoginPage from '@/components/login-page';

/* ═══════════════════════════════════════════════════════════════
   DESIGN TOKENS
   ═══════════════════════════════════════════════════════════════ */
const C = {
  bg:           '#0A0E1A',
  bgAlt:        '#0D1220',
  bgCard:       '#111827',
  bgCardHover:  '#1a2236',
  border:       'rgba(255,255,255,0.07)',
  borderLight:  'rgba(255,255,255,0.12)',
  text:         '#E5E7EB',
  textBright:   '#F9FAFB',
  textSub:      '#9CA3AF',
  textDim:      '#6B7280',
  gold:         '#c9a84c',
  goldBright:   '#e2c565',
  goldDim:      'rgba(201,168,76,0.12)',
  goldGlow:     'rgba(201,168,76,0.06)',
  goldBorder:   'rgba(201,168,76,0.2)',
  white:        '#FFFFFF',
  gridLine:     'rgba(255,255,255,0.03)',
};

const ease = [0.16, 1, 0.3, 1] as const;
const SECTION_IDS = ['philosophy', 'framework', 'platform', 'about'];

/* ═══════════════════════════════════════════════════════════════
   #1 + #13 — HERO INTELLIGENCE ENGINE — Premium canvas with
   glowing nodes, gradient connections, "Intelligence Engine" label,
   and smooth fade-in (no flash)
   ═══════════════════════════════════════════════════════════════ */
const HUB_NODES = [
  { label: 'Companies',     angle: -90 },
  { label: 'Signals',       angle: -30 },
  { label: 'Solutions',     angle: 30  },
  { label: 'People',        angle: 90  },
  { label: 'Opportunities', angle: 150 },
  { label: 'Conversations', angle: 210 },
];

function useHeroCanvas(canvasRef: React.RefObject<HTMLCanvasElement | null>) {
  const rafRef = useRef(0);
  const particlesRef = useRef<Array<{x:number;y:number;vx:number;vy:number;r:number;a:number}>>([]);
  const readyRef = useRef(false);

  const init = useCallback((w: number, h: number) => {
    const cx = w / 2, cy = h / 2;
    const orbitR = Math.min(w, h) * 0.3;
    const particles: typeof particlesRef.current = [];
    for (let i = 0; i < 60; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = orbitR * (0.2 + Math.random() * 1.0);
      particles.push({
        x: cx + Math.cos(angle) * dist,
        y: cy + Math.sin(angle) * dist,
        vx: (Math.random() - 0.5) * 0.15,
        vy: (Math.random() - 0.5) * 0.15,
        r: 0.6 + Math.random() * 1.4,
        a: 0.05 + Math.random() * 0.15,
      });
    }
    particlesRef.current = particles;
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
      if (particlesRef.current.length === 0) init(rect.width, rect.height);
    };
    resize();
    window.addEventListener('resize', resize);

    // #13 — fade in canvas smoothly
    let opacity = 0;
    canvas.style.opacity = '0';
    canvas.style.transition = 'opacity 1s ease';

    let time = 0;
    const draw = () => {
      const w = canvas.width / dpr, h = canvas.height / dpr;
      ctx.clearRect(0, 0, w, h);
      time += 0.003;

      // Fade in
      if (opacity < 1) {
        opacity = Math.min(1, opacity + 0.015);
        canvas.style.opacity = String(opacity);
        if (opacity >= 0.3 && !readyRef.current) {
          readyRef.current = true;
        }
      }

      const cx = w / 2, cy = h / 2;
      const orbitR = Math.min(w, h) * 0.3;
      const nodeR = Math.min(w, h) * 0.048;

      // Grid
      ctx.strokeStyle = C.gridLine;
      ctx.lineWidth = 0.5;
      const gridSize = 40;
      for (let x = gridSize; x < w; x += gridSize) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
      }
      for (let y = gridSize; y < h; y += gridSize) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
      }

      // Large center radial glow
      const cGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, orbitR * 1.4);
      cGlow.addColorStop(0, 'rgba(201,168,76,0.07)');
      cGlow.addColorStop(0.4, 'rgba(201,168,76,0.03)');
      cGlow.addColorStop(1, 'transparent');
      ctx.fillStyle = cGlow;
      ctx.fillRect(0, 0, w, h);

      // Orbit rings
      ctx.setLineDash([3, 5]);
      // Outer
      ctx.beginPath();
      ctx.arc(cx, cy, orbitR, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(201,168,76,0.1)';
      ctx.lineWidth = 1;
      ctx.stroke();
      // Inner
      ctx.beginPath();
      ctx.arc(cx, cy, orbitR * 0.55, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(201,168,76,0.05)';
      ctx.lineWidth = 0.5;
      ctx.stroke();
      // Outermost faint
      ctx.beginPath();
      ctx.arc(cx, cy, orbitR * 1.15, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(201,168,76,0.03)';
      ctx.lineWidth = 0.5;
      ctx.stroke();
      ctx.setLineDash([]);

      // Node positions with gentle orbit
      const nodePositions = HUB_NODES.map((n, i) => {
        const a = (n.angle * Math.PI) / 180 + Math.sin(time * 0.8 + i) * 0.025;
        return {
          x: cx + Math.cos(a) * orbitR,
          y: cy + Math.sin(a) * orbitR,
          label: n.label,
        };
      });

      // #1 — Glowing gradient connections to center
      nodePositions.forEach((pos, i) => {
        const grad = ctx.createLinearGradient(cx, cy, pos.x, pos.y);
        grad.addColorStop(0, 'rgba(201,168,76,0.3)');
        grad.addColorStop(0.6, 'rgba(201,168,76,0.08)');
        grad.addColorStop(1, 'rgba(201,168,76,0.02)');
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        // Slight curve
        const mx = (cx + pos.x) / 2 + Math.sin(time + i * 2) * 8;
        const my = (cy + pos.y) / 2 + Math.cos(time * 0.7 + i * 2) * 8;
        ctx.quadraticCurveTo(mx, my, pos.x, pos.y);
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.2;
        ctx.stroke();

        // Animated data pulse along each connection
        const pulseCount = 2;
        for (let p = 0; p < pulseCount; p++) {
          const pulseT = ((time * 0.4 + i * 0.17 + p * 0.5) % 1);
          const pt = pulseT * pulseT * (3 - 2 * pulseT); // smoothstep
          const px = cx + (pos.x - cx) * pt;
          const py = cy + (pos.y - cy) * pt;
          const pulseR = 2 - pulseT;
          const pulseGlow = ctx.createRadialGradient(px, py, 0, px, py, pulseR * 4);
          pulseGlow.addColorStop(0, `rgba(226,197,101,${0.7 * (1 - pulseT)})`);
          pulseGlow.addColorStop(1, 'transparent');
          ctx.beginPath();
          ctx.arc(px, py, pulseR * 4, 0, Math.PI * 2);
          ctx.fillStyle = pulseGlow;
          ctx.fill();
          ctx.beginPath();
          ctx.arc(px, py, pulseR, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(226,197,101,${0.8 * (1 - pulseT)})`;
          ctx.fill();
        }
      });

      // Inter-node connections (faint mesh)
      for (let i = 0; i < nodePositions.length; i++) {
        const next = nodePositions[(i + 1) % nodePositions.length];
        const cur = nodePositions[i];
        ctx.beginPath();
        ctx.moveTo(cur.x, cur.y);
        ctx.lineTo(next.x, next.y);
        ctx.strokeStyle = 'rgba(201,168,76,0.04)';
        ctx.lineWidth = 0.5;
        ctx.stroke();
        // Cross-connections for mesh feel
        if (i + 2 < nodePositions.length) {
          const cross = nodePositions[i + 2];
          ctx.beginPath(); ctx.moveTo(cur.x, cur.y); ctx.lineTo(cross.x, cross.y);
          ctx.strokeStyle = 'rgba(201,168,76,0.02)';
          ctx.stroke();
        }
      }

      // Floating particles
      particlesRef.current.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        const dx = cx - p.x, dy = cy - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > orbitR * 1.2) { p.vx += dx * 0.00008; p.vy += dy * 0.00008; }
        p.vx *= 0.9995; p.vy *= 0.9995;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(201,168,76,${p.a * 0.6})`;
        ctx.fill();
      });

      // Center hub — large glowing orb
      const hubOuterGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, nodeR * 3);
      hubOuterGlow.addColorStop(0, 'rgba(201,168,76,0.12)');
      hubOuterGlow.addColorStop(0.5, 'rgba(201,168,76,0.04)');
      hubOuterGlow.addColorStop(1, 'transparent');
      ctx.beginPath(); ctx.arc(cx, cy, nodeR * 3, 0, Math.PI * 2);
      ctx.fillStyle = hubOuterGlow; ctx.fill();

      // Hub ring
      ctx.beginPath(); ctx.arc(cx, cy, nodeR, 0, Math.PI * 2);
      const hubRingGrad = ctx.createRadialGradient(cx, cy, nodeR * 0.7, cx, cy, nodeR);
      hubRingGrad.addColorStop(0, 'rgba(201,168,76,0.3)');
      hubRingGrad.addColorStop(1, 'rgba(201,168,76,0.08)');
      ctx.strokeStyle = hubRingGrad;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Hub core gradient
      const coreGrad = ctx.createRadialGradient(cx - nodeR * 0.2, cy - nodeR * 0.2, 0, cx, cy, nodeR * 0.8);
      coreGrad.addColorStop(0, '#f0d878');
      coreGrad.addColorStop(0.5, C.goldBright);
      coreGrad.addColorStop(1, C.gold);
      ctx.beginPath(); ctx.arc(cx, cy, nodeR * 0.75, 0, Math.PI * 2);
      ctx.fillStyle = coreGrad; ctx.fill();

      // Hub pulse rings
      const pulse = (Math.sin(time * 2) + 1) * 0.5;
      ctx.beginPath(); ctx.arc(cx, cy, nodeR * (1.15 + pulse * 0.5), 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(201,168,76,${0.2 - pulse * 0.15})`;
      ctx.lineWidth = 0.8;
      ctx.stroke();

      const pulse2 = (Math.sin(time * 1.5 + 1) + 1) * 0.5;
      ctx.beginPath(); ctx.arc(cx, cy, nodeR * (1.3 + pulse2 * 0.6), 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(201,168,76,${0.1 - pulse2 * 0.08})`;
      ctx.lineWidth = 0.5;
      ctx.stroke();

      // Outer nodes — premium style with glow borders
      nodePositions.forEach((pos, i) => {
        // Outer glow
        const nGlow = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, nodeR * 2.2);
        nGlow.addColorStop(0, 'rgba(201,168,76,0.1)');
        nGlow.addColorStop(1, 'transparent');
        ctx.beginPath(); ctx.arc(pos.x, pos.y, nodeR * 2.2, 0, Math.PI * 2);
        ctx.fillStyle = nGlow; ctx.fill();

        // Node circle with gradient fill
        ctx.beginPath(); ctx.arc(pos.x, pos.y, nodeR * 0.65, 0, Math.PI * 2);
        const nodeGrad = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, nodeR * 0.65);
        nodeGrad.addColorStop(0, 'rgba(201,168,76,0.15)');
        nodeGrad.addColorStop(1, 'rgba(201,168,76,0.04)');
        ctx.fillStyle = nodeGrad; ctx.fill();

        // Glowing border
        ctx.beginPath(); ctx.arc(pos.x, pos.y, nodeR * 0.65, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(201,168,76,${0.35 + Math.sin(time * 1.5 + i) * 0.1})`;
        ctx.lineWidth = 1;
        ctx.stroke();

        // Inner bright dot
        const dotGlow = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, 5);
        dotGlow.addColorStop(0, C.goldBright);
        dotGlow.addColorStop(1, 'rgba(201,168,76,0.3)');
        ctx.beginPath(); ctx.arc(pos.x, pos.y, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = dotGlow; ctx.fill();
      });

      // #1 — "INTELLIGENCE ENGINE" label at center bottom
      ctx.font = '600 9px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(201,168,76,0.4)';
      ctx.fillText('D E E P M I N D Q   I N T E L L I G E N C E   E N G I N E', cx, cy + nodeR * 2.8);

      rafRef.current = requestAnimationFrame(draw);
    };
    rafRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [init]);
}

/* ═══════════════════════════════════════════════════════════════
   #10 — Active section tracker (IntersectionObserver)
   ═══════════════════════════════════════════════════════════════ */
function useActiveSection() {
  const [active, setActive] = useState('');

  useEffect(() => {
    const observers: IntersectionObserver[] = [];
    SECTION_IDS.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      const obs = new IntersectionObserver(
        ([entry]) => { if (entry.isIntersecting) setActive(id); },
        { rootMargin: '-30% 0px -60% 0px' }
      );
      obs.observe(el);
      observers.push(obs);
    });
    return () => observers.forEach(o => o.disconnect());
  }, []);

  return active;
}

/* ═══════════════════════════════════════════════════════════════
   #5 — Animated counter hook
   ═══════════════════════════════════════════════════════════════ */
function useAnimatedCounter(target: string, inView: boolean, duration = 1500) {
  const [display, setDisplay] = useState('0');

  useEffect(() => {
    if (!inView) return;
    const numeric = parseFloat(target.replace(/[^0-9.]/g, ''));
    if (isNaN(numeric)) { setDisplay(target); return; }
    const prefix = target.match(/^[^0-9]*/)?.[0] || '';
    const suffix = target.match(/[^0-9.]*$/)?.[0] || '';
    const hasDecimal = target.includes('.');
    const decimalPlaces = hasDecimal ? (target.split('.')[1]?.replace(/[^0-9]/g, '').length || 0) : 0;

    let start: number | null = null;
    const step = (timestamp: number) => {
      if (!start) start = timestamp;
      const progress = Math.min((timestamp - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
      const current = numeric * eased;
      setDisplay(prefix + (hasDecimal ? current.toFixed(decimalPlaces) : Math.round(current)) + suffix);
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [inView, target, duration]);

  return display;
}

/* ═══════════════════════════════════════════════════════════════
   #10, #12, #14 — HEADER with active nav, animated hamburger,
   pulsing workspace button
   ═══════════════════════════════════════════════════════════════ */
function Header({ onLogin }: { onLogin: () => void }) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const activeSection = useActiveSection();

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    setMobileOpen(false);
  };

  const links = [
    { label: 'Philosophy', id: 'philosophy' },
    { label: 'Framework', id: 'framework' },
    { label: 'Platform', id: 'platform' },
    { label: 'About', id: 'about' },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
      style={{
        background: scrolled ? 'rgba(10,14,26,0.88)' : 'transparent',
        backdropFilter: scrolled ? 'blur(20px) saturate(1.4)' : 'none',
        borderBottom: scrolled ? `1px solid ${C.border}` : '1px solid transparent',
      }}>
      <div className="mx-auto max-w-[1360px] flex items-center justify-between px-6 lg:px-10 h-16">
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-md flex items-center justify-center"
            style={{ background: C.goldDim, border: `1px solid ${C.goldBorder}` }}>
            <Sparkles className="w-3.5 h-3.5" style={{ color: C.gold }} />
          </div>
          <span className="text-[15px] font-semibold tracking-[-0.01em]" style={{ color: C.white }}>
            DeepMindQ
          </span>
        </div>

        {/* Desktop Nav — #10 active state */}
        <nav className="hidden md:flex items-center gap-1">
          {links.map(link => {
            const isActive = activeSection === link.id;
            return (
              <button key={link.id} onClick={() => scrollTo(link.id)}
                className="relative px-3.5 py-2 text-[13px] font-medium rounded-lg transition-colors duration-200"
                style={{ color: isActive ? C.gold : C.textSub }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.color = C.white; }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.color = C.textSub; }}>
                {link.label}
                {isActive && (
                  <motion.div layoutId="nav-indicator" className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full"
                    style={{ background: C.gold }}
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }} />
                )}
              </button>
            );
          })}
        </nav>

        {/* #14 — Pulsing workspace CTA */}
        <div className="flex items-center gap-3">
          <motion.button onClick={onLogin}
            className="hidden sm:inline-flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-semibold transition-all duration-200"
            style={{ background: C.gold, color: '#0A0E1A' }}
            whileHover={{ scale: 1.03, boxShadow: '0 0 24px rgba(201,168,76,0.25)' }}
            whileTap={{ scale: 0.98 }}>
            <Lock className="w-3.5 h-3.5" />
            Private Workspace
            {/* Subtle pulse ring */}
            <motion.span className="absolute inset-0 rounded-lg pointer-events-none"
              animate={{ boxShadow: ['0 0 0 0 rgba(201,168,76,0.15)', '0 0 0 6px rgba(201,168,76,0)', '0 0 0 0 rgba(201,168,76,0)'] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
              style={{ position: 'absolute', inset: -1, borderRadius: 'inherit' }} />
          </motion.button>

          {/* #12 — Animated hamburger */}
          <button className="md:hidden p-2 rounded-lg relative w-9 h-9 flex items-center justify-center"
            style={{ color: C.textSub }}
            onClick={() => setMobileOpen(!mobileOpen)}>
            <div className="flex flex-col gap-[5px]">
              <motion.span className="block w-5 h-[1.5px] rounded-full origin-center"
                style={{ background: C.textSub }}
                animate={mobileOpen ? { rotate: 45, y: 6.5 } : { rotate: 0, y: 0 }}
                transition={{ duration: 0.25 }} />
              <motion.span className="block w-5 h-[1.5px] rounded-full origin-center"
                style={{ background: C.textSub }}
                animate={mobileOpen ? { opacity: 0, scaleX: 0 } : { opacity: 1, scaleX: 1 }}
                transition={{ duration: 0.2 }} />
              <motion.span className="block w-5 h-[1.5px] rounded-full origin-center"
                style={{ background: C.textSub }}
                animate={mobileOpen ? { rotate: -45, y: -6.5 } : { rotate: 0, y: 0 }}
                transition={{ duration: 0.25 }} />
            </div>
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease }}
            className="md:hidden overflow-hidden"
            style={{ background: 'rgba(10,14,26,0.96)', backdropFilter: 'blur(20px)' }}>
            <div className="px-6 py-4 space-y-1">
              {links.map(link => (
                <button key={link.id} onClick={() => scrollTo(link.id)}
                  className="block w-full text-left px-3 py-2.5 text-[14px] font-medium rounded-lg transition-colors"
                  style={{ color: activeSection === link.id ? C.gold : C.textSub }}>
                  {link.label}
                </button>
              ))}
              <button onClick={() => { setMobileOpen(false); onLogin(); }}
                className="block w-full text-left px-3 py-2.5 text-[14px] font-semibold sm:hidden"
                style={{ color: C.gold }}>
                Private Workspace
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

/* ═══════════════════════════════════════════════════════════════
   HERO — Two-column
   ═══════════════════════════════════════════════════════════════ */
function HeroSection({ onLogin }: { onLogin: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const inView = useInView(heroRef, { once: true });
  useHeroCanvas(canvasRef);

  const scrollToFramework = () => document.getElementById('framework')?.scrollIntoView({ behavior: 'smooth' });

  return (
    <section ref={heroRef} className="relative min-h-screen flex items-center overflow-hidden pt-16">
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 70% 50% at 60% 50%, rgba(201,168,76,0.03) 0%, transparent 70%)' }} />

      <div className="relative z-10 mx-auto max-w-[1360px] w-full px-6 lg:px-10 py-12 lg:py-0">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-8 items-center">
          {/* Left */}
          <motion.div initial={{ opacity: 0, y: 30 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.9, ease }}>
            <h1 className="text-[clamp(2.4rem,5vw,3.5rem)] font-bold leading-[1.15] tracking-[-0.03em]"
              style={{ color: C.white }}>
              Understand Before<br />You Sell.
            </h1>
            <p className="mt-6 text-base sm:text-[17px] leading-[1.7] max-w-[540px]"
              style={{ color: C.textSub }}>
              An AI-powered enterprise growth intelligence platform that helps you understand
              companies, detect signals, map stakeholders, align solutions, and create
              meaningful executive conversations.
            </p>
            {/* #4 — Polished CTAs */}
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <motion.button onClick={scrollToFramework}
                className="group inline-flex items-center gap-2 px-5 py-3 rounded-lg text-[14px] font-semibold transition-all duration-200"
                style={{ background: C.gold, color: '#0A0E1A' }}
                whileHover={{ scale: 1.03, boxShadow: '0 0 28px rgba(201,168,76,0.25)' }}
                whileTap={{ scale: 0.98 }}>
                Explore DeepMindQ
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
              </motion.button>
              <motion.button onClick={scrollToFramework}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-lg text-[14px] font-medium transition-all duration-200"
                style={{ color: C.gold, border: `1px solid ${C.goldBorder}`, background: 'transparent' }}
                whileHover={{ background: C.goldDim, borderColor: C.gold, scale: 1.02 }}
                whileTap={{ scale: 0.98 }}>
                <Eye className="w-4 h-4" />
                See How It Works
              </motion.button>
            </div>
          </motion.div>

          {/* Right — Canvas */}
          <motion.div
            className="relative w-full aspect-square max-w-[520px] mx-auto lg:mx-0 lg:ml-auto"
            initial={{ opacity: 0, scale: 0.92 }}
            animate={inView ? { opacity: 1, scale: 1 } : {}}
            transition={{ duration: 1.1, delay: 0.2, ease }}>
            <canvas ref={canvasRef} className="w-full h-full" />
          </motion.div>
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════
   #3 — Section divider with gold gradient line
   ═══════════════════════════════════════════════════════════════ */
function SectionDivider() {
  return (
    <div className="flex items-center justify-center py-1">
      <div className="w-24 h-px" style={{ background: `linear-gradient(90deg, transparent, ${C.goldBorder}, transparent)` }} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   #7 — PHILOSOPHY with visual weight on "Understand." pillars
   ═══════════════════════════════════════════════════════════════ */
function PhilosophySection() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });

  return (
    <section id="philosophy" ref={ref} className="py-24 sm:py-32"
      style={{ background: C.bgAlt, borderTop: `1px solid ${C.border}` }}>
      <div className="mx-auto max-w-[1360px] px-6 lg:px-10">
        <div className="grid lg:grid-cols-2 gap-16 items-start">
          {/* Brand story */}
          <motion.div initial={{ opacity: 0, y: 24 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8, ease }}>
            <p className="text-[11px] font-semibold tracking-[0.25em] uppercase mb-4"
              style={{ color: C.gold }}>About</p>
            <h2 className="text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-[-0.02em] leading-tight mb-6"
              style={{ color: C.white }}>
              Built from experience.<br />Designed for intelligent growth.
            </h2>
            <p className="text-[15px] leading-[1.8] mb-4" style={{ color: C.textSub }}>
              After years of working with enterprise technology organizations, I created DeepMindQ
              as my personal intelligence framework to improve how I research markets, understand
              accounts, identify opportunities, and engage decision makers.
            </p>
            <p className="text-[15px] leading-[1.8]" style={{ color: C.textSub }}>
              Enterprise growth is not about sending more messages. It is about creating the
              <span style={{ color: C.gold }}> right conversation</span> with the
              <span style={{ color: C.gold }}> right people</span> at the
              <span style={{ color: C.gold }}> right time</span>.
            </p>
            <div className="mt-8 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-[13px] font-bold"
                style={{ background: `linear-gradient(135deg, ${C.gold}, ${C.goldBright})`, color: '#0A0E1A' }}>
                RS
              </div>
              <div>
                <p className="text-[14px] font-semibold" style={{ color: C.white }}>Ravi Shanker</p>
                <p className="text-[12px]" style={{ color: C.textDim }}>
                  Enterprise Growth Leader &middot; Technology Strategist &middot; AI Enthusiast
                </p>
              </div>
            </div>
          </motion.div>

          {/* #7 — "Understand" pillars with dramatic typography + vertical gold line */}
          <div className="relative lg:pt-4">
            {/* Vertical gold connector line */}
            <motion.div className="absolute left-[19px] top-8 bottom-8 hidden lg:block"
              style={{ width: '1px', background: `linear-gradient(to bottom, transparent, ${C.goldBorder} 15%, ${C.goldBorder} 85%, transparent)` }}
              initial={{ scaleY: 0 }} animate={inView ? { scaleY: 1 } : {}}
              transition={{ duration: 1, delay: 0.3, ease }} />

            <div className="space-y-10">
              {[
                {
                  icon: Search,
                  num: '01',
                  title: 'Understand.',
                  sub: 'Before you approach.',
                  desc: 'Deep research into company ecosystems, technology landscapes, funding events, and strategic priorities — automated and continuous.',
                },
                {
                  icon: Target,
                  num: '02',
                  title: 'Understand.',
                  sub: 'Before you propose.',
                  desc: 'Stakeholder mapping, power dynamics analysis, and capability-to-pain alignment ensure your solution speaks directly to their reality.',
                },
                {
                  icon: MessageSquare,
                  num: '03',
                  title: 'Understand.',
                  sub: 'Before you sell.',
                  desc: 'Every outreach informed by intelligence. Every conversation builds on context. Relationship memory that compounds over time.',
                },
              ].map((item, i) => (
                <motion.div key={i} className="flex gap-5 relative"
                  initial={{ opacity: 0, x: 20 }}
                  animate={inView ? { opacity: 1, x: 0 } : {}}
                  transition={{ duration: 0.6, delay: 0.2 + i * 0.12, ease }}>
                  {/* Number circle on the line */}
                  <div className="relative z-10 w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                    style={{ background: C.bgAlt, border: `1.5px solid ${C.gold}` }}>
                    <span className="text-[11px] font-bold" style={{ color: C.gold }}>{item.num}</span>
                  </div>
                  <div className="pt-0.5">
                    <p className="text-[22px] sm:text-[26px] font-bold leading-tight tracking-[-0.02em]"
                      style={{ color: C.white }}>
                      {item.title}
                    </p>
                    <p className="text-[16px] font-normal mt-0.5 mb-2"
                      style={{ color: C.gold }}>
                      {item.sub}
                    </p>
                    <p className="text-[14px] leading-[1.75]" style={{ color: C.textDim }}>
                      {item.desc}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════
   #6, #8 — INTELLIGENCE FRAMEWORK with hover depth + staggered
   ═══════════════════════════════════════════════════════════════ */
const FRAMEWORK = [
  { icon: BarChart3, title: 'Market Signal Intelligence', sub: 'Detect business changes before engagement begins.', bullets: ['Funding rounds & M&A activity', 'Technology stack changes', 'Leadership movements', 'Competitor positioning shifts'] },
  { icon: Building2, title: 'Account Intelligence', sub: 'Map the full company ecosystem.', bullets: ['Company profiles & ecosystems', 'Technology landscape analysis', 'Strategic relationships', 'Growth trajectory scoring'] },
  { icon: Users, title: 'Stakeholder Intelligence', sub: 'Know who matters and why.', bullets: ['Decision-maker identification', 'Influence mapping', 'Champion detection', 'Org chart intelligence'] },
  { icon: Layers, title: 'Solution Intelligence', sub: 'Align capabilities to real pain points.', bullets: ['Capability-to-need matching', 'Evidence-based positioning', 'Competitive differentiation', 'Value articulation'] },
  { icon: MessageSquare, title: 'Conversation Intelligence', sub: 'Every outreach is research-informed.', bullets: ['AI-generated personalization', 'Relationship memory', 'Conversation planning', 'Engagement timing'] },
];

function FrameworkSection() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });

  return (
    <section id="framework" ref={ref} className="py-24 sm:py-32">
      <div className="mx-auto max-w-[1360px] px-6 lg:px-10">
        <motion.div className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, ease }}>
          <p className="text-[11px] font-semibold tracking-[0.25em] uppercase mb-4"
            style={{ color: C.gold }}>Framework</p>
          <h2 className="text-[clamp(1.5rem,3vw,2.4rem)] font-bold tracking-[-0.02em]"
            style={{ color: C.white }}>
            The DeepMindQ Intelligence Framework
          </h2>
          <p className="mt-4 text-[15px] max-w-[500px] mx-auto" style={{ color: C.textDim }}>
            Five layers of intelligence working together — from market signals to executive conversations.
          </p>
        </motion.div>

        {/* #8 — Staggered entrance, #6 — hover depth */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
          {FRAMEWORK.slice(0, 3).map((f, i) => (
            <FrameworkCard key={f.title} {...f} index={i} inView={inView} />
          ))}
        </div>
        <div className="grid sm:grid-cols-2 gap-4 max-w-[900px] mx-auto">
          {FRAMEWORK.slice(3).map((f, i) => (
            <FrameworkCard key={f.title} {...f} index={i + 3} inView={inView} />
          ))}
        </div>
      </div>
    </section>
  );
}

function FrameworkCard({ icon: Icon, title, sub, bullets, index, inView }: {
  icon: React.ElementType; title: string; sub: string;
  bullets: string[]; index: number; inView: boolean;
}) {
  return (
    <motion.div className="group rounded-xl p-6 sm:p-7 transition-all duration-300 cursor-default"
      style={{ background: C.bgCard, border: `1px solid ${C.border}` }}
      // #8 — staggered bottom-to-top reveal
      initial={{ opacity: 0, y: 30 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.55, delay: index * 0.09, ease }}
      // #6 — hover: gold glow + lift + brighter border
      whileHover={{
        y: -3,
        borderColor: 'rgba(201,168,76,0.3)',
        background: C.bgCardHover,
        boxShadow: '0 8px 30px rgba(201,168,76,0.08), 0 0 0 1px rgba(201,168,76,0.15)',
        transition: { duration: 0.25 },
      }}>
      <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-4 transition-colors duration-300 group-hover:scale-110"
        style={{ background: C.goldDim }}>
        <Icon className="w-[18px] h-[18px] transition-colors duration-300" style={{ color: C.gold }} />
      </div>
      <h3 className="text-[15px] font-semibold mb-1 tracking-[-0.01em] transition-colors duration-300"
        style={{ color: C.white }}>{title}</h3>
      <p className="text-[13px] mb-4" style={{ color: C.textDim }}>{sub}</p>
      <ul className="space-y-2">
        {bullets.map((b, i) => (
          <li key={i} className="flex items-start gap-2.5 text-[13px]" style={{ color: C.textSub }}>
            <span className="mt-[7px] w-1.5 h-1.5 rounded-full shrink-0" style={{ background: C.gold }} />
            {b}
          </li>
        ))}
      </ul>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   #2 — INSIDE DEEPMINDQ with detailed UI mockups
   ═══════════════════════════════════════════════════════════════ */
const MODULES = [
  { icon: Sparkles, title: 'AI Command Center', desc: 'Unified view of accounts, signals, opportunities, and priorities — your operational nerve center.', mockup: 'command-center' },
  { icon: Network, title: 'Stakeholder Mind Map', desc: 'Visualize decision-makers, influencers, and power dynamics within target accounts.', mockup: 'mindmap' },
  { icon: Database, title: 'Knowledge Engine', desc: 'Your solution intelligence library — capabilities, use cases, and competitive positioning.', mockup: 'knowledge' },
  { icon: Zap, title: 'Conversation Studio', desc: 'AI-generated, research-informed outreach that speaks directly to each stakeholder.', mockup: 'studio' },
];

/* #2 — Richer, more realistic UI mockups */
function MiniMockup({ type }: { type: string }) {
  if (type === 'command-center') {
    return (
      <div className="w-full h-full rounded-lg overflow-hidden flex flex-col"
        style={{ background: '#070b14', border: `1px solid ${C.border}` }}>
        {/* Title bar */}
        <div className="flex items-center justify-between px-3 py-2 shrink-0" style={{ background: 'rgba(255,255,255,0.02)', borderBottom: `1px solid ${C.border}` }}>
          <div className="flex gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ background: '#ef4444' }} />
            <div className="w-2 h-2 rounded-full" style={{ background: '#eab308' }} />
            <div className="w-2 h-2 rounded-full" style={{ background: '#22c55e' }} />
          </div>
          <span className="text-[8px] font-medium" style={{ color: C.textDim }}>Command Center</span>
          <div className="flex gap-1">
            <div className="w-3 h-3 rounded" style={{ background: 'rgba(255,255,255,0.04)' }} />
          </div>
        </div>
        {/* Content */}
        <div className="flex-1 p-2.5 space-y-2">
          {/* Stats row */}
          <div className="grid grid-cols-4 gap-1.5">
            {[{ v: '156', l: 'Accounts', c: C.gold }, { v: '48', l: 'Signals', c: '#22c55e' }, { v: '23', l: 'Pipeline', c: '#60a5fa' }, { v: '12', l: 'Hot', c: '#ef4444' }].map((s, i) => (
              <div key={i} className="rounded p-1.5" style={{ background: 'rgba(255,255,255,0.02)' }}>
                <div className="text-[11px] font-bold" style={{ color: s.c }}>{s.v}</div>
                <div className="text-[7px]" style={{ color: C.textDim }}>{s.l}</div>
              </div>
            ))}
          </div>
          {/* Chart area */}
          <div className="rounded p-2 flex-1" style={{ background: 'rgba(255,255,255,0.015)' }}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[7px] font-medium" style={{ color: C.textDim }}>Pipeline Trend</span>
              <span className="text-[7px]" style={{ color: '#22c55e' }}>+24%</span>
            </div>
            <div className="flex items-end gap-[3px] h-14">
              {[40,55,45,65,50,75,60,80,70,85,78,90].map((h, i) => (
                <div key={i} className="flex-1 rounded-t-sm" style={{ height: `${h}%`, minHeight: 3,
                  background: `linear-gradient(to top, rgba(201,168,76,0.4), rgba(201,168,76,${0.15 + (h/100)*0.5}))` }} />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (type === 'mindmap') {
    return (
      <div className="w-full h-full rounded-lg overflow-hidden flex flex-col"
        style={{ background: '#070b14', border: `1px solid ${C.border}` }}>
        <div className="flex items-center justify-between px-3 py-2 shrink-0" style={{ background: 'rgba(255,255,255,0.02)', borderBottom: `1px solid ${C.border}` }}>
          <div className="flex gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ background: '#ef4444' }} />
            <div className="w-2 h-2 rounded-full" style={{ background: '#eab308' }} />
            <div className="w-2 h-2 rounded-full" style={{ background: '#22c55e' }} />
          </div>
          <span className="text-[8px] font-medium" style={{ color: C.textDim }}>Stakeholder Map</span>
          <div />
        </div>
        <div className="flex-1 flex items-center justify-center p-2">
          <svg viewBox="0 0 220 150" className="w-full h-full">
            {/* Center node */}
            <circle cx="110" cy="75" r="16" fill="rgba(201,168,76,0.15)" stroke="rgba(201,168,76,0.4)" strokeWidth="1" />
            <circle cx="110" cy="75" r="6" fill={C.gold} />
            <text x="110" y="75" textAnchor="middle" dominantBaseline="middle" fill="white" fontSize="6" fontWeight="600">CEO</text>
            {/* Surrounding nodes */}
            {[
              { x: 40, y: 30, label: 'VP Eng', r: 11 },
              { x: 180, y: 28, label: 'CTO', r: 11 },
              { x: 35, y: 120, label: 'CFO', r: 10 },
              { x: 185, y: 118, label: 'VP Sales', r: 10 },
              { x: 110, y: 12, label: 'Board', r: 9 },
              { x: 65, y: 75, label: 'VP Prod', r: 9 },
              { x: 155, y: 72, label: 'CISO', r: 9 },
            ].map((n, i) => (
              <g key={i}>
                <line x1="110" y1="75" x2={n.x} y2={n.y} stroke="rgba(201,168,76,0.12)" strokeWidth="0.6" strokeDasharray="2,2" />
                <circle cx={n.x} cy={n.y} r={n.r} fill="rgba(255,255,255,0.03)" stroke="rgba(201,168,76,0.2)" strokeWidth="0.6" />
                <text x={n.x} y={n.y} textAnchor="middle" dominantBaseline="middle" fill={C.textSub} fontSize="5">{n.label}</text>
              </g>
            ))}
          </svg>
        </div>
      </div>
    );
  }

  if (type === 'knowledge') {
    const items = [
      { name: 'AI Automation', count: 12, active: true },
      { name: 'Cloud Migration', count: 10, active: false },
      { name: 'Data Analytics', count: 8, active: false },
      { name: 'Security & Compliance', count: 7, active: false },
      { name: 'API Integration', count: 6, active: false },
      { name: 'DevOps', count: 5, active: false },
    ];
    return (
      <div className="w-full h-full rounded-lg overflow-hidden flex flex-col"
        style={{ background: '#070b14', border: `1px solid ${C.border}` }}>
        <div className="flex items-center justify-between px-3 py-2 shrink-0" style={{ background: 'rgba(255,255,255,0.02)', borderBottom: `1px solid ${C.border}` }}>
          <div className="flex gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ background: '#ef4444' }} />
            <div className="w-2 h-2 rounded-full" style={{ background: '#eab308' }} />
            <div className="w-2 h-2 rounded-full" style={{ background: '#22c55e' }} />
          </div>
          <span className="text-[8px] font-medium" style={{ color: C.textDim }}>Knowledge Engine</span>
          <div />
        </div>
        <div className="flex-1 flex flex-col p-2.5 gap-0">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-2 flex-1 rounded" style={{ background: 'rgba(255,255,255,0.04)' }} />
            <div className="h-5 w-10 rounded text-center leading-5 text-[7px] font-medium" style={{ background: C.goldDim, color: C.gold }}>
              {items.reduce((a, b) => a + b.count, 0)}
            </div>
          </div>
          {items.map((item, i) => (
            <div key={i} className="flex items-center gap-2 rounded px-2 py-1.5 transition-colors"
              style={{ background: item.active ? C.goldDim : 'rgba(255,255,255,0.015)', borderLeft: item.active ? `2px solid ${C.gold}` : '2px solid transparent' }}>
              <span className="text-[8px] flex-1 truncate" style={{ color: item.active ? C.white : C.textSub, fontWeight: item.active ? 600 : 400 }}>
                {item.name}
              </span>
              <span className="text-[7px] font-mono" style={{ color: C.textDim }}>{item.count}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // studio
  return (
    <div className="w-full h-full rounded-lg overflow-hidden flex flex-col"
      style={{ background: '#070b14', border: `1px solid ${C.border}` }}>
      <div className="flex items-center justify-between px-3 py-2 shrink-0" style={{ background: 'rgba(255,255,255,0.02)', borderBottom: `1px solid ${C.border}` }}>
        <div className="flex gap-1.5">
          <div className="w-2 h-2 rounded-full" style={{ background: '#ef4444' }} />
          <div className="w-2 h-2 rounded-full" style={{ background: '#eab308' }} />
          <div className="w-2 h-2 rounded-full" style={{ background: '#22c55e' }} />
        </div>
        <span className="text-[8px] font-medium" style={{ color: C.textDim }}>Conversation Studio</span>
        <div />
      </div>
      <div className="flex-1 flex flex-col p-2.5 gap-2">
        {/* To field */}
        <div className="flex items-center gap-2 rounded px-2 py-1.5" style={{ background: 'rgba(255,255,255,0.02)' }}>
          <span className="text-[7px]" style={{ color: C.textDim }}>To:</span>
          <div className="h-2 w-20 rounded" style={{ background: 'rgba(255,255,255,0.06)' }} />
        </div>
        {/* Subject */}
        <div className="flex items-center gap-2 rounded px-2 py-1.5" style={{ background: 'rgba(255,255,255,0.02)' }}>
          <span className="text-[7px]" style={{ color: C.textDim }}>Subject:</span>
          <div className="h-2 w-32 rounded" style={{ background: 'rgba(255,255,255,0.06)' }} />
        </div>
        {/* Body lines */}
        <div className="flex-1 rounded p-2 space-y-1.5" style={{ background: 'rgba(255,255,255,0.01)' }}>
          <div className="h-1.5 rounded" style={{ background: 'rgba(255,255,255,0.06)', width: '100%' }} />
          <div className="h-1.5 rounded" style={{ background: 'rgba(255,255,255,0.04)', width: '92%' }} />
          <div className="h-1.5 rounded" style={{ background: 'rgba(255,255,255,0.04)', width: '96%' }} />
          <div className="h-1.5 rounded" style={{ background: 'rgba(255,255,255,0.04)', width: '80%' }} />
          <div className="h-1.5 rounded" style={{ background: 'rgba(255,255,255,0.03)', width: '88%' }} />
          <div className="h-1.5 rounded" style={{ background: 'rgba(255,255,255,0.03)', width: '70%' }} />
          {/* AI sparkle indicator */}
          <div className="flex items-center gap-1 pt-1">
            <div className="w-2.5 h-2.5 rounded" style={{ background: C.goldDim }}>
              <div className="w-full h-full flex items-center justify-center">
                <Sparkles className="w-1.5 h-1.5" style={{ color: C.gold }} />
              </div>
            </div>
            <span className="text-[6px]" style={{ color: C.gold }}>AI-personalized</span>
          </div>
        </div>
        {/* Action buttons */}
        <div className="flex gap-1.5">
          <div className="h-5 flex-1 rounded flex items-center justify-center text-[7px] font-medium" style={{ background: C.goldDim, color: C.gold }}>Send</div>
          <div className="h-5 w-12 rounded flex items-center justify-center text-[7px]" style={{ background: 'rgba(255,255,255,0.04)', color: C.textDim }}>Save</div>
        </div>
      </div>
    </div>
  );
}

function PlatformSection() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });

  return (
    <section id="platform" ref={ref} className="py-24 sm:py-32"
      style={{ background: C.bgAlt, borderTop: `1px solid ${C.border}` }}>
      <div className="mx-auto max-w-[1360px] px-6 lg:px-10">
        <motion.div className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, ease }}>
          <p className="text-[11px] font-semibold tracking-[0.25em] uppercase mb-4"
            style={{ color: C.gold }}>Platform</p>
          <h2 className="text-[clamp(1.5rem,3vw,2.4rem)] font-bold tracking-[-0.02em]"
            style={{ color: C.white }}>
            Inside DeepMindQ
          </h2>
          <p className="mt-4 text-[15px] max-w-[500px] mx-auto" style={{ color: C.textDim }}>
            Four core modules that transform raw intelligence into pipeline.
          </p>
        </motion.div>

        {/* #8 — Staggered entrance for module cards */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {MODULES.map((m, i) => (
            <motion.div key={m.title}
              className="group rounded-xl overflow-hidden transition-all duration-300"
              style={{ background: C.bgCard, border: `1px solid ${C.border}` }}
              initial={{ opacity: 0, y: 25 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: i * 0.1, ease }}
              whileHover={{
                y: -4,
                borderColor: 'rgba(201,168,76,0.2)',
                boxShadow: '0 12px 40px rgba(0,0,0,0.3), 0 0 0 1px rgba(201,168,76,0.1)',
                transition: { duration: 0.25 },
              }}>
              <div className="h-44 p-2.5">
                <MiniMockup type={m.mockup} />
              </div>
              <div className="p-5 pt-3.5" style={{ borderTop: `1px solid ${C.border}` }}>
                <div className="flex items-center gap-2.5 mb-2">
                  <m.icon className="w-4 h-4" style={{ color: C.gold }} />
                  <h3 className="text-[14px] font-semibold" style={{ color: C.white }}>{m.title}</h3>
                </div>
                <p className="text-[12.5px] leading-[1.65]" style={{ color: C.textDim }}>{m.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════
   #5 — VALUE PROPOSITION with animated counters
   ═══════════════════════════════════════════════════════════════ */
function ValueSection({ onLogin }: { onLogin: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });

  const stats = [
    { value: '10x', label: 'Faster Account Research' },
    { value: '73%', label: 'Higher Email Engagement' },
    { value: '3.2x', label: 'Pipeline Velocity' },
    { value: '<2 min', label: 'Signal to Action' },
  ];

  const statDisplays = stats.map(s => useAnimatedCounter(s.value, inView));

  const steps = [
    { icon: Database, label: 'Data & Signals' },
    { icon: Brain, label: 'AI Analysis' },
    { icon: Lightbulb, label: 'Understanding' },
    { icon: Rocket, label: 'Action' },
    { icon: TrendingUp, label: 'Growth' },
  ];

  return (
    <section id="about" ref={ref} className="py-24 sm:py-32">
      <div className="mx-auto max-w-[1360px] px-6 lg:px-10">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left */}
          <motion.div initial={{ opacity: 0, y: 20 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.7, ease }}>
            <p className="text-[11px] font-semibold tracking-[0.25em] uppercase mb-4"
              style={{ color: C.gold }}>The Promise</p>
            <h2 className="text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-[-0.02em] leading-tight mb-6"
              style={{ color: C.white }}>
              From Data to Understanding.<br />
              From Understanding to Growth.
            </h2>
            <p className="text-[15px] leading-[1.8] mb-8" style={{ color: C.textSub }}>
              DeepMindQ doesn&apos;t give you more data. It gives you understanding — the kind
              that changes how you sell, who you talk to, and what you say when you get there.
            </p>

            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              {steps.map((step, i) => (
                <div key={i} className="flex items-center gap-2 sm:gap-3">
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg"
                    style={{ background: C.bgCard, border: `1px solid ${C.border}` }}>
                    <step.icon className="w-4 h-4" style={{ color: C.gold }} />
                    <span className="text-[12px] font-medium whitespace-nowrap" style={{ color: C.textSub }}>
                      {step.label}
                    </span>
                  </div>
                  {i < steps.length - 1 && (
                    <ChevronRight className="w-3.5 h-3.5 hidden sm:block" style={{ color: C.textDim }} />
                  )}
                </div>
              ))}
            </div>
          </motion.div>

          {/* Right — #5 animated stats */}
          <motion.div className="text-center lg:text-left"
            initial={{ opacity: 0, y: 20 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.7, delay: 0.15, ease }}>
            <div className="grid grid-cols-2 gap-6 mb-10">
              {stats.map((s, i) => (
                <div key={i}>
                  <div className="text-[clamp(1.6rem,3vw,2.2rem)] font-bold tracking-[-0.03em] leading-none mb-1"
                    style={{ color: C.gold }}>
                    {statDisplays[i]}
                  </div>
                  <div className="text-[12px] font-medium" style={{ color: C.textDim }}>{s.label}</div>
                </div>
              ))}
            </div>
            <motion.button onClick={onLogin}
              className="group inline-flex items-center gap-2.5 px-7 py-3.5 rounded-lg text-[15px] font-semibold transition-all duration-200"
              style={{ background: C.gold, color: '#0A0E1A' }}
              whileHover={{ scale: 1.03, boxShadow: '0 0 30px rgba(201,168,76,0.25)' }}
              whileTap={{ scale: 0.98 }}>
              <Lock className="w-4 h-4" />
              Enter Private Workspace
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
            </motion.button>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════
   #9 — FOOTER with social icons
   ═══════════════════════════════════════════════════════════════ */
function Footer({ onLogin }: { onLogin: () => void }) {
  return (
    <footer className="py-10 px-6" style={{ background: C.bgAlt, borderTop: `1px solid ${C.border}` }}>
      <div className="mx-auto max-w-[1360px] flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <Sparkles className="w-3.5 h-3.5" style={{ color: C.textDim }} />
          <span className="text-[13px] font-medium" style={{ color: C.textDim }}>
            DeepMindQ &mdash; Understand Before You Sell.
          </span>
        </div>
        <p className="text-[12px] text-center" style={{ color: C.textDim }}>
          Built by Ravi Shanker &middot; Enterprise Growth Leader &middot; Technology Strategist &middot; AI Enthusiast
        </p>
        {/* #9 — Social icons */}
        <div className="flex items-center gap-3">
          <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer"
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200"
            style={{ color: C.textDim, border: `1px solid ${C.border}` }}
            onMouseEnter={e => { e.currentTarget.style.color = C.gold; e.currentTarget.style.borderColor = C.goldBorder; e.currentTarget.style.background = C.goldDim; }}
            onMouseLeave={e => { e.currentTarget.style.color = C.textDim; e.currentTarget.style.borderColor = C.border; e.currentTarget.style.background = 'transparent'; }}>
            <Linkedin className="w-3.5 h-3.5" />
          </a>
          <a href="mailto:shanker001@gmail.com"
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200"
            style={{ color: C.textDim, border: `1px solid ${C.border}` }}
            onMouseEnter={e => { e.currentTarget.style.color = C.gold; e.currentTarget.style.borderColor = C.goldBorder; e.currentTarget.style.background = C.goldDim; }}
            onMouseLeave={e => { e.currentTarget.style.color = C.textDim; e.currentTarget.style.borderColor = C.border; e.currentTarget.style.background = 'transparent'; }}>
            <Mail className="w-3.5 h-3.5" />
          </a>
          <button onClick={onLogin} className="text-[12px] font-medium transition-colors hover:text-white px-2"
            style={{ color: C.textDim }}>Workspace</button>
        </div>
      </div>
    </footer>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN
   ═══════════════════════════════════════════════════════════════ */
interface LandingPageProps { onLogin: () => void; }

export default function LandingPage({ onLogin }: LandingPageProps) {
  const [showLogin, setShowLogin] = useState(false);

  if (showLogin) return <LoginPage onLogin={onLogin} />;

  return (
    <div className="min-h-screen" style={{ background: C.bg, color: C.text }}>
      <Header onLogin={() => setShowLogin(true)} />
      <HeroSection onLogin={() => setShowLogin(true)} />
      <PhilosophySection />
      <SectionDivider />
      <FrameworkSection />
      <SectionDivider />
      <PlatformSection />
      <SectionDivider />
      <ValueSection onLogin={() => setShowLogin(true)} />
      <Footer onLogin={() => setShowLogin(true)} />
    </div>
  );
}