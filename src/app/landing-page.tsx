'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, useScroll, useTransform, useInView, AnimatePresence, useMotionValue, useSpring, useScroll as useFramerScroll } from 'framer-motion';
import {
  ArrowRight, Lock, ChevronDown,
  Building2, BarChart3, Brain, MessageSquare, Users, Target,
  Search, Lightbulb, Rocket, TrendingUp, Zap, Shield,
  Layers, Network, Sparkles, ChevronRight, Eye, Database,
  Linkedin, Mail, ArrowUp, UserCircle, Briefcase, Globe,
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
  border:       'rgba(255,255,255,0.06)',
  borderLight:  'rgba(255,255,255,0.1)',
  text:         '#E5E7EB',
  textBright:   '#F9FAFB',
  textSub:      '#9CA3AF',
  textDim:      '#6B7280',
  gold:         '#c9a84c',
  goldBright:   '#e2c565',
  goldDim:      'rgba(201,168,76,0.1)',
  goldGlow:     'rgba(201,168,76,0.04)',
  goldBorder:   'rgba(201,168,76,0.18)',
  white:        '#FFFFFF',
};

const ease = [0.16, 1, 0.3, 1] as const;
const SECTION_IDS = ['philosophy', 'framework', 'platform', 'how-it-works', 'who-this-is-for', 'faq'];

/* ═══════════════════════════════════════════════════════════════
   HOOKS
   ═══════════════════════════════════════════════════════════════ */
function useScrollProgress() {
  const { scrollYProgress } = useFramerScroll();
  return scrollYProgress;
}

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
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = numeric * eased;
      setDisplay(prefix + (hasDecimal ? current.toFixed(decimalPlaces) : Math.round(current)) + suffix);
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [inView, target, duration]);
  return display;
}

/* ═══════════════════════════════════════════════════════════════
   PRELOADER — skips on revisit via sessionStorage  #14
   ═══════════════════════════════════════════════════════════════ */
function Preloader({ onComplete }: { onComplete: () => void }) {
  const [phase, setPhase] = useState(0);
  const [skip, setSkip] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem('dmq-visited')) {
      setSkip(true);
      onComplete();
      return;
    }
    const t1 = setTimeout(() => setPhase(1), 300);
    const t2 = setTimeout(() => setPhase(2), 1800);
    const t3 = setTimeout(() => {
      sessionStorage.setItem('dmq-visited', '1');
      onComplete();
    }, 2400);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [onComplete]);

  if (skip) return null;

  return (
    <motion.div
      className="fixed inset-0 z-[100] flex items-center justify-center preloader"
      style={{ background: C.bg }}
      initial={{ opacity: 1 }}
      animate={phase === 2 ? { opacity: 0, scale: 1.05 } : { opacity: 1 }}
      transition={{ duration: 0.6, ease }}>
      <div className="flex flex-col items-center gap-5">
        <motion.div
          className="w-14 h-14 rounded-xl flex items-center justify-center relative"
          style={{ background: C.goldDim, border: `1.5px solid ${C.goldBorder}` }}
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: phase >= 1 ? 1 : 0.8, rotate: 0 }}
          transition={{ duration: 0.7, ease }}>
          <motion.div animate={{ rotate: phase >= 1 ? 0 : 360 }} transition={{ duration: 1.5, ease: 'easeInOut' }}>
            <Sparkles className="w-7 h-7" style={{ color: C.gold }} />
          </motion.div>
          <motion.div
            className="absolute inset-0 rounded-xl"
            animate={{ boxShadow: phase >= 1
              ? ['0 0 20px rgba(201,168,76,0.3)', '0 0 40px rgba(201,168,76,0.1)', '0 0 20px rgba(201,168,76,0.3)']
              : '0 0 0px rgba(201,168,76,0)' }}
            transition={{ duration: 1.5, repeat: Infinity }} />
        </motion.div>
        <motion.div className="text-center"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: phase >= 1 ? 1 : 0, y: phase >= 1 ? 0 : 10 }}
          transition={{ duration: 0.5, delay: 0.3 }}>
          <p className="text-[18px] font-semibold tracking-[-0.02em]" style={{ color: C.white }}>DeepMindQ</p>
          <p className="text-[10px] tracking-[0.3em] uppercase mt-1" style={{ color: C.gold }}>Understand Before You Sell</p>
        </motion.div>
        <motion.div className="w-32 h-[1.5px] rounded-full overflow-hidden" style={{ background: C.border }}>
          <motion.div className="h-full rounded-full"
            style={{ background: `linear-gradient(90deg, ${C.gold}, ${C.goldBright})` }}
            initial={{ width: '0%' }}
            animate={{ width: phase >= 1 ? '100%' : '0%' }}
            transition={{ duration: 1.2, delay: 0.3, ease }} />
        </motion.div>
      </div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SCROLL PROGRESS BAR
   ═══════════════════════════════════════════════════════════════ */
function ScrollProgressBar() {
  const progress = useScrollProgress();
  return (
    <motion.div className="fixed top-0 left-0 right-0 z-[60] h-[2px] origin-left scroll-progress-bar"
      style={{ scaleX: progress, background: `linear-gradient(90deg, ${C.gold}, ${C.goldBright}, ${C.gold})` }} />
  );
}

/* ═══════════════════════════════════════════════════════════════
   BACK TO TOP — threshold raised to 1000px  #19
   ═══════════════════════════════════════════════════════════════ */
function BackToTop() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const handler = () => setVisible(window.scrollY > 1000);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-6 right-6 z-50 w-10 h-10 rounded-xl flex items-center justify-center back-to-top"
          style={{ background: C.bgCard, border: `1px solid ${C.goldBorder}`, color: C.gold }}
          initial={{ opacity: 0, y: 20, scale: 0.8 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.8 }}
          transition={{ duration: 0.3, ease }}
          whileHover={{ scale: 1.1, boxShadow: '0 0 20px rgba(201,168,76,0.2)' }}
          whileTap={{ scale: 0.95 }}
          aria-label="Back to top">
          <ArrowUp className="w-4 h-4" />
        </motion.button>
      )}
    </AnimatePresence>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SKIP TO CONTENT  #21
   ═══════════════════════════════════════════════════════════════ */
function SkipToContent() {
  return (
    <a href="#philosophy"
      className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[200] focus:px-4 focus:py-2 focus:rounded-lg focus:text-[14px] focus:font-medium"
      style={{ background: C.gold, color: '#0A0E1A' }}>
      Skip to main content
    </a>
  );
}

/* ═══════════════════════════════════════════════════════════════
   HERO INTELLIGENCE ENGINE — Canvas visualization  #13 visibility API
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
    for (let i = 0; i < 80; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = orbitR * (0.2 + Math.random() * 1.2);
      particles.push({
        x: cx + Math.cos(angle) * dist, y: cy + Math.sin(angle) * dist,
        vx: (Math.random() - 0.5) * 0.15, vy: (Math.random() - 0.5) * 0.15,
        r: 0.5 + Math.random() * 1.6, a: 0.04 + Math.random() * 0.14,
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

    let opacity = 0;
    canvas.style.opacity = '0';
    canvas.style.transition = 'opacity 1.2s ease';

    // #13 — Pause when tab is hidden
    const onVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(rafRef.current);
      } else {
        rafRef.current = requestAnimationFrame(draw);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    let time = 0;
    const draw = () => {
      if (document.hidden) return;

      const w = canvas.width / dpr, h = canvas.height / dpr;
      ctx.clearRect(0, 0, w, h);
      time += 0.003;

      if (opacity < 1) {
        opacity = Math.min(1, opacity + 0.012);
        canvas.style.opacity = String(opacity);
        if (opacity >= 0.3 && !readyRef.current) readyRef.current = true;
      }

      const cx = w / 2, cy = h / 2;
      const orbitR = Math.min(w, h) * 0.3;
      const nodeR = Math.min(w, h) * 0.048;

      // Grid
      ctx.strokeStyle = 'rgba(255,255,255,0.02)';
      ctx.lineWidth = 0.5;
      const gridSize = 40;
      for (let x = gridSize; x < w; x += gridSize) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
      for (let y = gridSize; y < h; y += gridSize) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }

      // Center glow
      const cGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, orbitR * 1.5);
      cGlow.addColorStop(0, 'rgba(201,168,76,0.08)');
      cGlow.addColorStop(0.35, 'rgba(201,168,76,0.03)');
      cGlow.addColorStop(1, 'transparent');
      ctx.fillStyle = cGlow; ctx.fillRect(0, 0, w, h);

      // Orbit rings
      ctx.setLineDash([3, 5]);
      ctx.beginPath(); ctx.arc(cx, cy, orbitR, 0, Math.PI * 2); ctx.strokeStyle = 'rgba(201,168,76,0.1)'; ctx.lineWidth = 1; ctx.stroke();
      ctx.beginPath(); ctx.arc(cx, cy, orbitR * 0.55, 0, Math.PI * 2); ctx.strokeStyle = 'rgba(201,168,76,0.05)'; ctx.lineWidth = 0.5; ctx.stroke();
      ctx.beginPath(); ctx.arc(cx, cy, orbitR * 1.15, 0, Math.PI * 2); ctx.strokeStyle = 'rgba(201,168,76,0.03)'; ctx.lineWidth = 0.5; ctx.stroke();
      ctx.setLineDash([]);

      const nodePositions = HUB_NODES.map((n, i) => {
        const a = (n.angle * Math.PI) / 180 + Math.sin(time * 0.8 + i) * 0.025;
        return { x: cx + Math.cos(a) * orbitR, y: cy + Math.sin(a) * orbitR, label: n.label };
      });

      // Connections with data pulses
      nodePositions.forEach((pos, i) => {
        const grad = ctx.createLinearGradient(cx, cy, pos.x, pos.y);
        grad.addColorStop(0, 'rgba(201,168,76,0.3)');
        grad.addColorStop(0.6, 'rgba(201,168,76,0.08)');
        grad.addColorStop(1, 'rgba(201,168,76,0.02)');
        ctx.beginPath(); ctx.moveTo(cx, cy);
        const mx = (cx + pos.x) / 2 + Math.sin(time + i * 2) * 8;
        const my = (cy + pos.y) / 2 + Math.cos(time * 0.7 + i * 2) * 8;
        ctx.quadraticCurveTo(mx, my, pos.x, pos.y);
        ctx.strokeStyle = grad; ctx.lineWidth = 1.2; ctx.stroke();

        for (let p = 0; p < 2; p++) {
          const pulseT = ((time * 0.4 + i * 0.17 + p * 0.5) % 1);
          const pt = pulseT * pulseT * (3 - 2 * pulseT);
          const px = cx + (pos.x - cx) * pt;
          const py = cy + (pos.y - cy) * pt;
          const pulseR = 2 - pulseT;
          const pulseGlow = ctx.createRadialGradient(px, py, 0, px, py, pulseR * 4);
          pulseGlow.addColorStop(0, `rgba(226,197,101,${0.7 * (1 - pulseT)})`);
          pulseGlow.addColorStop(1, 'transparent');
          ctx.beginPath(); ctx.arc(px, py, pulseR * 4, 0, Math.PI * 2); ctx.fillStyle = pulseGlow; ctx.fill();
          ctx.beginPath(); ctx.arc(px, py, pulseR, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(226,197,101,${0.8 * (1 - pulseT)})`; ctx.fill();
        }
      });

      // Inter-node mesh
      for (let i = 0; i < nodePositions.length; i++) {
        const next = nodePositions[(i + 1) % nodePositions.length];
        ctx.beginPath(); ctx.moveTo(nodePositions[i].x, nodePositions[i].y); ctx.lineTo(next.x, next.y);
        ctx.strokeStyle = 'rgba(201,168,76,0.04)'; ctx.lineWidth = 0.5; ctx.stroke();
        if (i + 2 < nodePositions.length) {
          const cross = nodePositions[i + 2];
          ctx.beginPath(); ctx.moveTo(nodePositions[i].x, nodePositions[i].y); ctx.lineTo(cross.x, cross.y);
          ctx.strokeStyle = 'rgba(201,168,76,0.02)'; ctx.stroke();
        }
      }

      // Particles
      particlesRef.current.forEach(p => {
        p.x += p.vx; p.y += p.vy;
        const dx = cx - p.x, dy = cy - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > orbitR * 1.3) { p.vx += dx * 0.00008; p.vy += dy * 0.00008; }
        p.vx *= 0.9995; p.vy *= 0.9995;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(201,168,76,${p.a * 0.6})`; ctx.fill();
      });

      // Hub
      const hubOuterGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, nodeR * 3);
      hubOuterGlow.addColorStop(0, 'rgba(201,168,76,0.12)'); hubOuterGlow.addColorStop(0.5, 'rgba(201,168,76,0.04)'); hubOuterGlow.addColorStop(1, 'transparent');
      ctx.beginPath(); ctx.arc(cx, cy, nodeR * 3, 0, Math.PI * 2); ctx.fillStyle = hubOuterGlow; ctx.fill();

      ctx.beginPath(); ctx.arc(cx, cy, nodeR, 0, Math.PI * 2);
      const hubRingGrad = ctx.createRadialGradient(cx, cy, nodeR * 0.7, cx, cy, nodeR);
      hubRingGrad.addColorStop(0, 'rgba(201,168,76,0.3)'); hubRingGrad.addColorStop(1, 'rgba(201,168,76,0.08)');
      ctx.strokeStyle = hubRingGrad; ctx.lineWidth = 1.5; ctx.stroke();

      const coreGrad = ctx.createRadialGradient(cx - nodeR * 0.2, cy - nodeR * 0.2, 0, cx, cy, nodeR * 0.8);
      coreGrad.addColorStop(0, '#f0d878'); coreGrad.addColorStop(0.5, C.goldBright); coreGrad.addColorStop(1, C.gold);
      ctx.beginPath(); ctx.arc(cx, cy, nodeR * 0.75, 0, Math.PI * 2); ctx.fillStyle = coreGrad; ctx.fill();

      const pulse = (Math.sin(time * 2) + 1) * 0.5;
      ctx.beginPath(); ctx.arc(cx, cy, nodeR * (1.15 + pulse * 0.5), 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(201,168,76,${0.2 - pulse * 0.15})`; ctx.lineWidth = 0.8; ctx.stroke();

      // Outer nodes
      nodePositions.forEach((pos, i) => {
        const nGlow = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, nodeR * 2.2);
        nGlow.addColorStop(0, 'rgba(201,168,76,0.1)'); nGlow.addColorStop(1, 'transparent');
        ctx.beginPath(); ctx.arc(pos.x, pos.y, nodeR * 2.2, 0, Math.PI * 2); ctx.fillStyle = nGlow; ctx.fill();

        ctx.beginPath(); ctx.arc(pos.x, pos.y, nodeR * 0.65, 0, Math.PI * 2);
        const nodeGrad = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, nodeR * 0.65);
        nodeGrad.addColorStop(0, 'rgba(201,168,76,0.15)'); nodeGrad.addColorStop(1, 'rgba(201,168,76,0.04)');
        ctx.fillStyle = nodeGrad; ctx.fill();

        ctx.beginPath(); ctx.arc(pos.x, pos.y, nodeR * 0.65, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(201,168,76,${0.35 + Math.sin(time * 1.5 + i) * 0.1})`; ctx.lineWidth = 1; ctx.stroke();

        const dotGlow = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, 5);
        dotGlow.addColorStop(0, C.goldBright); dotGlow.addColorStop(1, 'rgba(201,168,76,0.3)');
        ctx.beginPath(); ctx.arc(pos.x, pos.y, 3.5, 0, Math.PI * 2); ctx.fillStyle = dotGlow; ctx.fill();
      });

      ctx.font = '600 9px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(201,168,76,0.4)';
      ctx.fillText('D E E P M I N D Q   I N T E L L I G E N C E   E N G I N E', cx, cy + nodeR * 2.8);

      rafRef.current = requestAnimationFrame(draw);
    };
    rafRef.current = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(rafRef.current); window.removeEventListener('resize', resize); document.removeEventListener('visibilitychange', onVisibility); };
  }, [init]);
}

/* ═══════════════════════════════════════════════════════════════
   HEADER  #16 escape key, #24 focus trap, #22 ARIA, #34 nav consistency
   ═══════════════════════════════════════════════════════════════ */
function Header({ onLogin }: { onLogin: () => void }) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const mobileRef = useRef<HTMLDivElement>(null);
  const activeSection = useActiveSection();

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  // #16 — Close mobile menu on Escape
  useEffect(() => {
    if (!mobileOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [mobileOpen]);

  // #24 — Focus trap inside mobile menu
  useEffect(() => {
    if (!mobileOpen || !mobileRef.current) return;
    const menu = mobileRef.current;
    const focusable = menu.querySelectorAll<HTMLElement>('button, a, [tabindex]:not([tabindex="-1"])');
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    first.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    menu.addEventListener('keydown', handler);
    return () => menu.removeEventListener('keydown', handler);
  }, [mobileOpen]);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    setMobileOpen(false);
  };

  const links = [
    { label: 'Philosophy', id: 'philosophy' },
    { label: 'Framework', id: 'framework' },
    { label: 'Platform', id: 'platform' },
    { label: 'How It Works', id: 'how-it-works' },
    { label: 'FAQ', id: 'faq' },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
      style={{
        background: scrolled ? 'rgba(10,14,26,0.88)' : 'transparent',
        backdropFilter: scrolled ? 'blur(20px) saturate(1.4)' : 'none',
        borderBottom: scrolled ? `1px solid ${C.border}` : '1px solid transparent',
      }}>
      <div className="mx-auto max-w-[1200px] flex items-center justify-between px-6 lg:px-8 h-16">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-md flex items-center justify-center"
            style={{ background: C.goldDim, border: `1px solid ${C.goldBorder}` }}>
            <Sparkles className="w-3.5 h-3.5" style={{ color: C.gold }} />
          </div>
          <span className="text-[15px] font-semibold tracking-[-0.01em]" style={{ color: C.white }}>DeepMindQ</span>
        </div>

        <nav className="hidden md:flex items-center gap-1" aria-label="Main navigation">
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

        <div className="flex items-center gap-3">
          <motion.button onClick={onLogin}
            className="relative hidden sm:inline-flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-semibold"
            style={{ background: C.gold, color: '#0A0E1A' }}
            whileHover={{ scale: 1.03, boxShadow: '0 0 24px rgba(201,168,76,0.25)' }}
            whileTap={{ scale: 0.98 }}>
            <Lock className="w-3.5 h-3.5" />
            Private Workspace
            <motion.span className="absolute inset-0 rounded-lg pointer-events-none"
              animate={{ boxShadow: ['0 0 0 0 rgba(201,168,76,0.15)', '0 0 0 6px rgba(201,168,76,0)', '0 0 0 0 rgba(201,168,76,0)'] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
              style={{ position: 'absolute', inset: -1, borderRadius: 'inherit' }} />
          </motion.button>

          <button className="md:hidden p-2 rounded-lg relative w-9 h-9 flex items-center justify-center"
            style={{ color: C.textSub }}
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav"
            aria-label="Toggle navigation menu">
            <div className="flex flex-col gap-[5px]">
              <motion.span className="block w-5 h-[1.5px] rounded-full origin-center" style={{ background: C.textSub }}
                animate={mobileOpen ? { rotate: 45, y: 6.5 } : { rotate: 0, y: 0 }} transition={{ duration: 0.25 }} />
              <motion.span className="block w-5 h-[1.5px] rounded-full origin-center" style={{ background: C.textSub }}
                animate={mobileOpen ? { opacity: 0, scaleX: 0 } : { opacity: 1, scaleX: 1 }} transition={{ duration: 0.2 }} />
              <motion.span className="block w-5 h-[1.5px] rounded-full origin-center" style={{ background: C.textSub }}
                animate={mobileOpen ? { rotate: -45, y: -6.5 } : { rotate: 0, y: 0 }} transition={{ duration: 0.25 }} />
            </div>
          </button>
        </div>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div id="mobile-nav" ref={mobileRef} role="dialog" aria-modal="true" aria-label="Navigation menu"
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.25, ease }}
            className="md:hidden overflow-hidden"
            style={{ background: 'rgba(10,14,26,0.96)', backdropFilter: 'blur(20px)' }}>
            <div className="px-6 py-4 space-y-1">
              {links.map(link => (
                <button key={link.id} onClick={() => scrollTo(link.id)}
                  className="block w-full text-left px-3 py-2.5 text-[14px] font-medium rounded-lg transition-colors"
                  style={{ color: activeSection === link.id ? C.gold : C.textSub }}>{link.label}</button>
              ))}
              <button onClick={() => { setMobileOpen(false); onLogin(); }}
                className="block w-full text-left px-3 py-2.5 text-[14px] font-semibold sm:hidden"
                style={{ color: C.gold }}>Private Workspace</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

/* ═══════════════════════════════════════════════════════════════
   HERO  #8 hero badge, #18 hide scroll on mobile, #20 will-change, #23 canvas a11y
   ═══════════════════════════════════════════════════════════════ */
function HeroSection({ onLogin }: { onLogin: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const inView = useInView(heroRef, { once: true });
  useHeroCanvas(canvasRef);

  const { scrollY } = useScroll();
  const textY = useTransform(scrollY, [0, 600], [0, -120]);
  const textOpacity = useTransform(scrollY, [0, 500], [1, 0]);
  const canvasY = useTransform(scrollY, [0, 600], [0, -60]);

  const scrollToFramework = () => document.getElementById('framework')?.scrollIntoView({ behavior: 'smooth' });
  const heroWords = ['Understand', 'Before', 'You', 'Sell.'];

  return (
    <section ref={heroRef} className="relative min-h-screen flex items-center overflow-hidden pt-16">
      <div className="absolute inset-0 pointer-events-none z-0"
        style={{ background: 'radial-gradient(ellipse 70% 50% at 60% 50%, rgba(201,168,76,0.03) 0%, transparent 70%)' }} />

      <div className="relative z-10 mx-auto max-w-[1200px] w-full px-6 lg:px-8 py-20 lg:py-0">
        <div className="grid lg:grid-cols-2 gap-16 lg:gap-12 items-center">
          {/* Left — kinetic parallax text */}
          <motion.div style={{ y: textY, opacity: textOpacity, willChange: 'transform' }}>
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, ease, delay: 0.1 }}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full mb-8"
              style={{ background: C.goldDim, border: `1px solid ${C.goldBorder}` }}>
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: C.gold, boxShadow: '0 0 6px rgba(201,168,76,0.5)' }} />
              {/* #8 — varied badge text */}
              <span className="text-[12px] font-medium" style={{ color: C.gold }}>Account Intelligence Workspace</span>
            </motion.div>

            <h1 className="text-[clamp(2.6rem,5.5vw,3.8rem)] font-bold leading-[1.08] tracking-[-0.035em]"
              style={{ color: C.white }}>
              {heroWords.map((word, i) => (
                <motion.span key={i} className="inline-block mr-[0.3em]"
                  initial={{ opacity: 0, y: 30, filter: 'blur(8px)' }}
                  animate={inView ? { opacity: 1, y: 0, filter: 'blur(0px)' } : {}}
                  transition={{ duration: 0.7, delay: 0.2 + i * 0.12, ease }}
                  style={word === 'Sell.' ? { color: C.gold } : {}}>
                  {word}
                </motion.span>
              ))}
            </h1>

            <motion.p
              className="mt-8 text-[17px] sm:text-[18px] leading-[1.75] max-w-[480px] font-light"
              style={{ color: C.textSub }}
              initial={{ opacity: 0, y: 20 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.7, delay: 0.7, ease }}>
              An AI-powered workspace that helps you understand companies, detect signals,
              map stakeholders, align solutions, and create meaningful executive
              conversations — built from 15+ years of enterprise selling experience.
            </motion.p>

            <motion.div className="mt-10 flex flex-wrap items-center gap-3"
              initial={{ opacity: 0, y: 20 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.7, delay: 0.9, ease }}>
              <motion.button onClick={scrollToFramework}
                className="group inline-flex items-center gap-2 px-6 py-3.5 rounded-lg text-[14px] font-semibold"
                style={{ background: C.gold, color: '#0A0E1A' }}
                whileHover={{ scale: 1.03, boxShadow: '0 0 28px rgba(201,168,76,0.25)' }}
                whileTap={{ scale: 0.98 }}>
                Explore DeepMindQ
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
              </motion.button>
              <motion.button onClick={scrollToFramework}
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-lg text-[14px] font-medium"
                style={{ color: C.gold, border: `1px solid ${C.goldBorder}`, background: 'transparent' }}
                whileHover={{ background: C.goldDim, borderColor: C.gold, scale: 1.02 }}
                whileTap={{ scale: 0.98 }}>
                <Eye className="w-4 h-4" />
                See How It Works
              </motion.button>
            </motion.div>

            <motion.p className="mt-8 text-[12px] flex items-center gap-2"
              style={{ color: C.textDim }}
              initial={{ opacity: 0 }} animate={inView ? { opacity: 1 } : {}}
              transition={{ duration: 0.6, delay: 1.1 }}>
              <Shield className="w-3.5 h-3.5" style={{ color: C.gold }} />
              Private, secure, built for enterprise teams
            </motion.p>
          </motion.div>

          {/* Right — Canvas with parallax, #23 accessible description, #32 responsive aspect */}
          <motion.div
            className="relative w-full max-w-[520px] mx-auto lg:mx-0 lg:ml-auto"
            style={{ y: canvasY, willChange: 'transform' }}
            initial={{ opacity: 0, scale: 0.92 }}
            animate={inView ? { opacity: 1, scale: 1 } : {}}
            transition={{ duration: 1.1, delay: 0.3, ease }}>
            <canvas ref={canvasRef} className="w-full aspect-[4/3] sm:aspect-square" id="hero-canvas"
              role="img" aria-label="Interactive intelligence engine visualization showing how DeepMindQ connects companies, signals, solutions, people, opportunities, and conversations through an AI hub" />
            {/* Hidden accessible description */}
            <span className="sr-only">
              The DeepMindQ Intelligence Engine connects six data domains: Companies, Signals, Solutions,
              People, Opportunities, and Conversations. Data flows from each domain through AI analysis
              into actionable intelligence.
            </span>
          </motion.div>
        </div>
      </div>

      {/* #18 — Scroll indicator hidden on mobile */}
      <motion.div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex-col items-center gap-2 hidden md:flex"
        initial={{ opacity: 0 }} animate={inView ? { opacity: 1 } : {}}
        transition={{ duration: 0.6, delay: 1.5 }}>
        <span className="text-[10px] tracking-[0.2em] uppercase" style={{ color: C.textDim }}>Scroll</span>
        <div className="w-5 h-8 rounded-full flex justify-center pt-1.5" style={{ border: `1px solid ${C.border}` }}>
          <motion.div className="w-1 h-2 rounded-full" style={{ background: C.gold }}
            animate={{ y: [0, 8, 0] }} transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }} />
        </div>
      </motion.div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SECTION DIVIDER
   ═══════════════════════════════════════════════════════════════ */
function SectionDivider() {
  return (
    <div className="flex items-center justify-center py-2" aria-hidden="true">
      <div className="w-20 h-px" style={{ background: `linear-gradient(90deg, transparent, ${C.goldBorder})` }} />
      <div className="w-1.5 h-1.5 rounded-full mx-4" style={{ background: C.goldBorder }} />
      <div className="w-20 h-px" style={{ background: `linear-gradient(90deg, ${C.goldBorder}, transparent)` }} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PHILOSOPHY — #6 more specific personal story
   ═══════════════════════════════════════════════════════════════ */
function PhilosophySection() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });

  return (
    <section id="philosophy" ref={ref} className="py-32 sm:py-44"
      style={{ background: C.bgAlt, borderTop: `1px solid ${C.border}` }}>
      <div className="mx-auto max-w-[1200px] px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-20 items-start">
          {/* Brand story — more specific #6 */}
          <motion.div initial={{ opacity: 0, y: 24 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8, ease }}>
            <p className="text-[11px] font-semibold tracking-[0.3em] uppercase mb-5"
              style={{ color: C.gold }}>About</p>
            <h2 className="text-[clamp(1.6rem,3vw,2.2rem)] font-bold tracking-[-0.025em] leading-[1.15] mb-8"
              style={{ color: C.white }}>
              Built from experience.<br />Designed for intelligent growth.
            </h2>
            <p className="text-[15px] leading-[1.85] mb-5 font-light" style={{ color: C.textSub }}>
              After 15+ years working with enterprise technology organizations — across cloud
              infrastructure, AI/ML platforms, and SaaS — I noticed a pattern that never
              changed: the best deals never came from the best pitches. They came from the
              deepest understanding. I was spending 6+ hours per week on account research
              across LinkedIn, SEC filings, news alerts, and CRMs. So I built DeepMindQ as
              my personal intelligence framework — a tool that does the research heavy lifting
              so I can focus on what matters: having the right conversation with the right
              person at the right time.
            </p>
            <p className="text-[15px] leading-[1.85] mb-10 font-light" style={{ color: C.textSub }}>
              Enterprise growth is not about sending more messages. It is about creating the
              <span style={{ color: C.gold }}> right conversation</span> with the
              <span style={{ color: C.gold }}> right people</span> at the
              <span style={{ color: C.gold }}> right time</span>. This isn&apos;t a theory I read
              somewhere — it&apos;s what I&apos;ve lived through hundreds of enterprise deals.
            </p>
            <div className="flex items-center gap-3.5">
              <a href="https://www.linkedin.com/in/shankerpisupati/" target="_blank" rel="noopener noreferrer"
                className="w-11 h-11 rounded-full flex items-center justify-center text-[14px] font-bold transition-all duration-200"
                style={{ background: `linear-gradient(135deg, ${C.gold}, ${C.goldBright})`, color: '#0A0E1A' }}>
                RS
              </a>
              <div>
                <p className="text-[15px] font-semibold" style={{ color: C.white }}>Ravi Shanker</p>
                <p className="text-[12px]" style={{ color: C.textDim }}>
                  Enterprise Growth Leader &middot; Technology Strategist
                </p>
              </div>
            </div>
          </motion.div>

          {/* "Understand" pillars */}
          <div className="relative lg:pt-6">
            <motion.div className="absolute left-[19px] top-8 bottom-8 hidden lg:block"
              style={{ width: '1px', background: `linear-gradient(to bottom, transparent, ${C.goldBorder} 15%, ${C.goldBorder} 85%, transparent)` }}
              initial={{ scaleY: 0 }} animate={inView ? { scaleY: 1 } : {}}
              transition={{ duration: 1, delay: 0.3, ease }} />

            <div className="space-y-14">
              {[
                { icon: Search, num: '01', title: 'Understand.', sub: 'Before you approach.',
                  desc: 'Deep research into company ecosystems, technology landscapes, funding events, and strategic priorities — automated and continuous. Stop making assumptions. Start building conviction from data.' },
                { icon: Target, num: '02', title: 'Understand.', sub: 'Before you propose.',
                  desc: 'Stakeholder mapping, power dynamics analysis, and capability-to-pain alignment ensure your solution speaks directly to their reality, not your product deck.' },
                { icon: MessageSquare, num: '03', title: 'Understand.', sub: 'Before you sell.',
                  desc: 'Every outreach informed by intelligence. Every conversation builds on context. Relationship memory that compounds over time — turning cold outreach into warm conversations.' },
              ].map((item, i) => (
                <motion.div key={i} className="flex gap-6 relative"
                  initial={{ opacity: 0, x: 20 }}
                  animate={inView ? { opacity: 1, x: 0 } : {}}
                  transition={{ duration: 0.6, delay: 0.2 + i * 0.15, ease }}>
                  <div className="relative z-10 w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                    style={{ background: C.bgAlt, border: `1.5px solid ${C.gold}` }}>
                    <span className="text-[11px] font-bold" style={{ color: C.gold }}>{item.num}</span>
                  </div>
                  <div className="pt-0.5">
                    <p className="text-[24px] sm:text-[28px] font-bold leading-tight tracking-[-0.02em]"
                      style={{ color: C.white }}>{item.title}</p>
                    <p className="text-[16px] font-normal mt-1 mb-3" style={{ color: C.gold }}>{item.sub}</p>
                    <p className="text-[14px] leading-[1.8]" style={{ color: C.textDim }}>{item.desc}</p>
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
   FRAMEWORK — Interactive Visual Pipeline  #17 outside click, #22 ARIA, #28 keyboard
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
  const inView = useInView(ref, { once: true, margin: '-80px' });

  return (
    <section id="framework" ref={ref} className="py-32 sm:py-44">
      <div className="mx-auto max-w-[1200px] px-6 lg:px-8">
        <motion.div className="text-center mb-20"
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, ease }}>
          <p className="text-[11px] font-semibold tracking-[0.3em] uppercase mb-5"
            style={{ color: C.gold }}>Framework</p>
          <h2 className="text-[clamp(1.6rem,3vw,2.6rem)] font-bold tracking-[-0.025em]"
            style={{ color: C.white }}>
            The Intelligence Framework
          </h2>
          <p className="mt-5 text-[16px] max-w-[560px] mx-auto font-light leading-[1.75]" style={{ color: C.textDim }}>
            Five layers of intelligence working together — from market signals to executive conversations.
            Each layer feeds the next, creating a compounding intelligence advantage.
          </p>
        </motion.div>

        {/* Desktop: Horizontal interactive pipeline */}
        <div className="hidden lg:block relative">
          <div className="absolute top-[52px] left-[9%] right-[9%] h-[2px] rounded-full"
            style={{ background: `linear-gradient(90deg, transparent, ${C.goldBorder} 8%, ${C.goldBorder} 92%, transparent)` }}>
            {FRAMEWORK.map((_, i) => (
              <motion.div key={i} className="absolute top-[-2.5px] w-[5px] h-[5px] rounded-full"
                style={{ background: C.gold, boxShadow: '0 0 6px rgba(201,168,76,0.4)' }}
                animate={{ left: `${8 + i * 21}%`, opacity: [0, 1, 1, 0] }}
                transition={{ duration: 3, repeat: Infinity, delay: i * 0.6, ease: 'easeInOut' }} />
            ))}
          </div>

          <div className="flex justify-between">
            {FRAMEWORK.map((f, i) => (
              <PipelineNode key={f.title} {...f} index={i} inView={inView} />
            ))}
          </div>
        </div>

        {/* Mobile/Tablet: Vertical interactive list */}
        <div className="lg:hidden space-y-4">
          {FRAMEWORK.map((f, i) => (
            <MobileFrameworkCard key={f.title} {...f} index={i} inView={inView} />
          ))}
        </div>
      </div>
    </section>
  );
}

/* #17 — Outside click to close, #22 ARIA, #28 keyboard */
function PipelineNode({ icon: Icon, title, sub, bullets, index, inView }: {
  icon: React.ElementType; title: string; sub: string;
  bullets: string[]; index: number; inView: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const isEven = index % 2 === 0;
  const nodeRef = useRef<HTMLDivElement>(null);

  // #17 — Close on outside click
  useEffect(() => {
    if (!expanded) return;
    const handler = (e: MouseEvent) => {
      if (nodeRef.current && !nodeRef.current.contains(e.target as Node)) {
        setExpanded(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [expanded]);

  // #28 — Keyboard support
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setExpanded(!expanded);
    }
    if (e.key === 'Escape' && expanded) {
      setExpanded(false);
    }
  };

  return (
    <motion.div
      ref={nodeRef}
      className="relative flex flex-col items-center"
      style={{ width: '17%' }}
      initial={{ opacity: 0, y: 25 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, delay: 0.15 + index * 0.1, ease }}>

      <AnimatePresence>
        {expanded && (
          <motion.div
            className={`absolute left-1/2 -translate-x-1/2 w-[260px] p-5 rounded-xl z-20 ${
              isEven ? 'bottom-full mb-6' : 'top-full mt-6'
            }`}
            style={{
              background: C.bgCardHover,
              border: `1px solid ${C.goldBorder}`,
              boxShadow: '0 24px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(201,168,76,0.08)',
            }}
            initial={{ opacity: 0, y: isEven ? 12 : -12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: isEven ? 12 : -12, scale: 0.96 }}
            transition={{ duration: 0.25, ease }}
            id={`framework-detail-${index}`}
            role="region"
            aria-label={`${title} details`}>
            <p className="text-[12px] mb-3 font-medium" style={{ color: C.gold }}>{sub}</p>
            <ul className="space-y-2.5">
              {bullets.map((b, i) => (
                <li key={i} className="flex items-start gap-2.5 text-[13px] leading-[1.6]" style={{ color: C.textSub }}>
                  <span className="mt-[7px] w-1.5 h-1.5 rounded-full shrink-0" style={{ background: C.gold }} />
                  {b}
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        className="w-[104px] h-[104px] rounded-full flex flex-col items-center justify-center cursor-pointer relative"
        style={{
          background: expanded ? C.bgCardHover : C.bgCard,
          border: `2px solid ${expanded ? C.gold : C.goldBorder}`,
          boxShadow: expanded ? '0 0 30px rgba(201,168,76,0.1)' : 'none',
        }}
        onClick={() => setExpanded(!expanded)}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="button"
        aria-expanded={expanded}
        aria-controls={`framework-detail-${index}`}
        whileHover={{ scale: 1.06, borderColor: C.gold }}
        whileTap={{ scale: 0.97 }}>
        <motion.div
          className="absolute inset-[-6px] rounded-full pointer-events-none"
          style={{ border: `1px solid ${C.goldBorder}` }}
          animate={{ scale: [1, 1.18, 1], opacity: [0.4, 0, 0.4] }}
          transition={{ duration: 3, repeat: Infinity, delay: index * 0.5 }} />
        <Icon className="w-8 h-8 mb-1" style={{ color: C.gold }} />
        <span className="text-[9px] font-bold tracking-wider" style={{ color: C.textDim }}>
          {String(index + 1).padStart(2, '0')}
        </span>
      </motion.div>

      <p className="text-[12px] font-semibold text-center mt-5 max-w-[150px] leading-[1.5] tracking-[-0.01em]"
        style={{ color: expanded ? C.gold : C.white }}>
        {title}
      </p>
      <p className="text-[10px] mt-1.5 cursor-pointer transition-colors"
        style={{ color: C.textDim }}
        onClick={() => setExpanded(!expanded)}>
        {expanded ? 'Click to close' : 'Click to explore'}
      </p>
    </motion.div>
  );
}

/* Mobile framework card */
function MobileFrameworkCard({ icon: Icon, title, sub, bullets, index, inView }: {
  icon: React.ElementType; title: string; sub: string;
  bullets: string[]; index: number; inView: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <motion.div
      className="rounded-xl overflow-hidden"
      style={{ background: C.bgCard, border: `1px solid ${open ? C.goldBorder : C.border}` }}
      initial={{ opacity: 0, y: 20 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.4, delay: index * 0.08, ease }}>
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-4 p-5 text-left"
        aria-expanded={open}
        aria-controls={`mobile-framework-${index}`}>
        <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: C.goldDim, border: `1px solid ${C.goldBorder}` }}>
          <Icon className="w-5 h-5" style={{ color: C.gold }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-semibold truncate" style={{ color: C.white }}>{title}</p>
          <p className="text-[12px] mt-0.5" style={{ color: C.textDim }}>{sub}</p>
        </div>
        <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.25 }}>
          <ChevronDown className="w-4 h-4 shrink-0" style={{ color: open ? C.gold : C.textDim }} />
        </motion.div>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div id={`mobile-framework-${index}`} role="region" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3, ease }} className="overflow-hidden">
            <div className="px-5 pb-5 pt-1" style={{ borderTop: `1px solid ${C.border}` }}>
              <ul className="space-y-2.5 mt-3">
                {bullets.map((b, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-[13px] leading-[1.6]" style={{ color: C.textSub }}>
                    <span className="mt-[6px] w-1.5 h-1.5 rounded-full shrink-0" style={{ background: C.gold }} />
                    {b}
                  </li>
                ))}
              </ul>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   INSIDE DEEPMINDQ — Platform modules  #31 minimal window chrome
   ═══════════════════════════════════════════════════════════════ */
const MODULES = [
  { icon: Sparkles, title: 'AI Command Center', desc: 'Unified view of accounts, signals, opportunities, and priorities — your operational nerve center with AI-powered daily briefings.', mockup: 'command-center' },
  { icon: Network, title: 'Stakeholder Mind Map', desc: 'Visualize decision-makers, influencers, and power dynamics within target accounts. See who matters and why.', mockup: 'mindmap' },
  { icon: Database, title: 'Knowledge Engine', desc: 'Your solution intelligence library — capabilities, use cases, and competitive positioning, all AI-organized.', mockup: 'knowledge' },
  { icon: Zap, title: 'Conversation Studio', desc: 'AI-generated, research-informed outreach that speaks directly to each stakeholder\'s context and priorities.', mockup: 'studio' },
];

/* #31 — Minimal window chrome: only a thin title bar, no traffic lights */
function MiniMockup({ type }: { type: string }) {
  const titleBar = (label: string) => (
    <div className="flex items-center px-3 py-2 shrink-0" style={{ background: 'rgba(255,255,255,0.02)', borderBottom: `1px solid rgba(255,255,255,0.06)` }}>
      <div className="w-2.5 h-2.5 rounded-[3px]" style={{ background: C.goldDim, border: `1px solid ${C.goldBorder}` }} />
      <span className="text-[8px] font-medium ml-2" style={{ color: C.textDim }}>{label}</span>
    </div>
  );

  if (type === 'command-center') {
    return (
      <div className="w-full h-full rounded-lg overflow-hidden flex flex-col"
        style={{ background: '#070b14', border: `1px solid ${C.border}` }}>
        {titleBar('Command Center')}
        <div className="flex-1 p-2.5 space-y-2">
          <div className="grid grid-cols-4 gap-1.5">
            {[{ v: '156', l: 'Accounts', c: C.gold }, { v: '48', l: 'Signals', c: '#22c55e' }, { v: '23', l: 'Pipeline', c: '#60a5fa' }, { v: '12', l: 'Hot', c: '#ef4444' }].map((s, i) => (
              <div key={i} className="rounded p-1.5" style={{ background: 'rgba(255,255,255,0.02)' }}>
                <div className="text-[11px] font-bold" style={{ color: s.c }}>{s.v}</div>
                <div className="text-[7px]" style={{ color: C.textDim }}>{s.l}</div>
              </div>
            ))}
          </div>
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
        {titleBar('Stakeholder Map')}
        <div className="flex-1 flex items-center justify-center p-2">
          <svg viewBox="0 0 220 150" className="w-full h-full">
            <circle cx="110" cy="75" r="16" fill="rgba(201,168,76,0.15)" stroke="rgba(201,168,76,0.4)" strokeWidth="1" />
            <circle cx="110" cy="75" r="6" fill={C.gold} />
            <text x="110" y="75" textAnchor="middle" dominantBaseline="middle" fill="white" fontSize="6" fontWeight="600">CEO</text>
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
        {titleBar('Knowledge Engine')}
        <div className="flex-1 flex flex-col p-2.5 gap-0">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-2 flex-1 rounded" style={{ background: 'rgba(255,255,255,0.04)' }} />
            <div className="h-5 w-10 rounded text-center leading-5 text-[7px] font-medium" style={{ background: C.goldDim, color: C.gold }}>
              {items.reduce((a, b) => a + b.count, 0)}
            </div>
          </div>
          {items.map((item, i) => (
            <div key={i} className="flex items-center gap-2 rounded px-2 py-1.5"
              style={{ background: item.active ? C.goldDim : 'rgba(255,255,255,0.015)', borderLeft: item.active ? `2px solid ${C.gold}` : '2px solid transparent' }}>
              <span className="text-[8px] flex-1 truncate" style={{ color: item.active ? C.white : C.textSub, fontWeight: item.active ? 600 : 400 }}>{item.name}</span>
              <span className="text-[7px] font-mono" style={{ color: C.textDim }}>{item.count}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full rounded-lg overflow-hidden flex flex-col"
      style={{ background: '#070b14', border: `1px solid ${C.border}` }}>
      {titleBar('Conversation Studio')}
      <div className="flex-1 flex flex-col p-2.5 gap-2">
        <div className="flex items-center gap-2 rounded px-2 py-1.5" style={{ background: 'rgba(255,255,255,0.02)' }}>
          <span className="text-[7px]" style={{ color: C.textDim }}>To:</span>
          <div className="h-2 w-20 rounded" style={{ background: 'rgba(255,255,255,0.06)' }} />
        </div>
        <div className="flex items-center gap-2 rounded px-2 py-1.5" style={{ background: 'rgba(255,255,255,0.02)' }}>
          <span className="text-[7px]" style={{ color: C.textDim }}>Subject:</span>
          <div className="h-2 w-32 rounded" style={{ background: 'rgba(255,255,255,0.06)' }} />
        </div>
        <div className="flex-1 rounded p-2 space-y-1.5" style={{ background: 'rgba(255,255,255,0.01)' }}>
          <div className="h-1.5 rounded" style={{ background: 'rgba(255,255,255,0.06)', width: '100%' }} />
          <div className="h-1.5 rounded" style={{ background: 'rgba(255,255,255,0.04)', width: '92%' }} />
          <div className="h-1.5 rounded" style={{ background: 'rgba(255,255,255,0.04)', width: '96%' }} />
          <div className="h-1.5 rounded" style={{ background: 'rgba(255,255,255,0.04)', width: '80%' }} />
          <div className="h-1.5 rounded" style={{ background: 'rgba(255,255,255,0.03)', width: '88%' }} />
          <div className="h-1.5 rounded" style={{ background: 'rgba(255,255,255,0.03)', width: '70%' }} />
          <div className="flex items-center gap-1 pt-1">
            <div className="w-2.5 h-2.5 rounded" style={{ background: C.goldDim }}>
              <div className="w-full h-full flex items-center justify-center">
                <Sparkles className="w-1.5 h-1.5" style={{ color: C.gold }} />
              </div>
            </div>
            <span className="text-[6px]" style={{ color: C.gold }}>AI-personalized</span>
          </div>
        </div>
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
  const inView = useInView(ref, { once: true, margin: '-80px' });

  return (
    <section id="platform" ref={ref} className="py-32 sm:py-44"
      style={{ background: C.bgAlt, borderTop: `1px solid ${C.border}` }}>
      <div className="mx-auto max-w-[1200px] px-6 lg:px-8">
        <motion.div className="text-center mb-20"
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, ease }}>
          <p className="text-[11px] font-semibold tracking-[0.3em] uppercase mb-5"
            style={{ color: C.gold }}>Platform</p>
          <h2 className="text-[clamp(1.6rem,3vw,2.6rem)] font-bold tracking-[-0.025em]"
            style={{ color: C.white }}>Inside the Workspace</h2>
          <p className="mt-5 text-[16px] max-w-[540px] mx-auto font-light leading-[1.75]" style={{ color: C.textDim }}>
            Four core modules that transform raw intelligence into pipeline.
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {MODULES.map((m, i) => (
            <motion.div key={m.title}
              className="group rounded-xl overflow-hidden"
              style={{ background: C.bgCard, border: `1px solid ${C.border}` }}
              initial={{ opacity: 0, y: 25 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: i * 0.1, ease }}
              whileHover={{
                y: -5, borderColor: 'rgba(201,168,76,0.2)',
                boxShadow: '0 16px 48px rgba(0,0,0,0.3), 0 0 0 1px rgba(201,168,76,0.1)',
                transition: { duration: 0.25 },
              }}>
              <div className="h-48 p-3">
                <MiniMockup type={m.mockup} />
              </div>
              <div className="p-5 pt-4" style={{ borderTop: `1px solid ${C.border}` }}>
                <div className="flex items-center gap-2.5 mb-2.5">
                  <m.icon className="w-4 h-4" style={{ color: C.gold }} />
                  <h3 className="text-[14px] font-semibold" style={{ color: C.white }}>{m.title}</h3>
                </div>
                <p className="text-[13px] leading-[1.7]" style={{ color: C.textDim }}>{m.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════
   HOW IT WORKS  #10 personal language
   ═══════════════════════════════════════════════════════════════ */
const STEPS = [
  { num: '01', title: 'Add Your Accounts', desc: 'I import my target accounts or let DeepMindQ discover high-potential companies based on my ideal customer profile. The system begins continuous intelligence gathering immediately.', icon: Database },
  { num: '02', title: 'AI Discovers Signals', desc: 'The AI engine continuously monitors each account for funding events, leadership changes, technology shifts, and market movements — alerting me to opportunities before competitors notice.', icon: Zap },
  { num: '03', title: 'Map Stakeholders', desc: 'DeepMindQ identifies and maps decision-makers, influencers, and champions within each account. I understand power dynamics, reporting lines, and who actually drives purchasing decisions.', icon: Users },
  { num: '04', title: 'Craft Smart Outreach', desc: 'I generate research-informed, personalized conversation starters for each stakeholder. Every message is grounded in real intelligence — not generic templates.', icon: MessageSquare },
  { num: '05', title: 'Build Relationships', desc: 'Every interaction is tracked, context is remembered across conversations, and AI suggests the next best action. Relationship intelligence that compounds over time.', icon: TrendingUp },
];

/* ═══════════════════════════════════════════════════════════════
   #7 — PROOF OF WORK (replaces vague testimonials)
   ═══════════════════════════════════════════════════════════════ */
const PROOF_ITEMS = [
  {
    tag: 'Research Workflow',
    title: 'From 6 Hours/Week to Minutes',
    desc: 'Before DeepMindQ, I was spending 6+ hours weekly across LinkedIn Sales Navigator, SEC EDGAR filings, Google Alerts, news aggregators, and CRM notes just to stay current on 40 target accounts. Now the intelligence pipeline runs continuously — I review AI-synthesized briefings in minutes, not hours, and spend that recovered time actually having conversations.',
    detail: '6 intelligence layers working 24/7',
  },
  {
    tag: 'Signal Detection',
    title: 'Catching Signals Before Competitors',
    desc: 'Last quarter, the system flagged a Series B funding event at a target account 4 hours after the public announcement. By the time I reached out, most competitors were still reading about it in their morning newsletter. That timing advantage led to a discovery call and an active opportunity within 2 weeks.',
    detail: 'Continuous monitoring, not periodic checks',
  },
  {
    tag: 'Stakeholder Mapping',
    title: 'Knowing Who Matters Before the First Call',
    desc: 'For a $500K+ opportunity, I used the stakeholder intelligence to map the full buying committee — CEO, CTO, VP Engineering, and an internal champion — before the first discovery call. I knew each person\'s background, priorities, and likely concerns. The first call felt like our third.',
    detail: 'Org chart intelligence + influence mapping',
  },
];

function ProofOfWorkSection() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });

  return (
    <section ref={ref} className="py-32 sm:py-44">
      <div className="mx-auto max-w-[1200px] px-6 lg:px-8">
        <motion.div className="text-center mb-20"
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, ease }}>
          <p className="text-[11px] font-semibold tracking-[0.3em] uppercase mb-5"
            style={{ color: C.gold }}>Proof of Work</p>
          <h2 className="text-[clamp(1.6rem,3vw,2.6rem)] font-bold tracking-[-0.025em]"
            style={{ color: C.white }}>What This Approach Actually Delivers</h2>
          <p className="mt-5 text-[16px] max-w-[560px] mx-auto font-light leading-[1.75]" style={{ color: C.textDim }}>
            Real outcomes from using DeepMindQ daily — not fabricated metrics, just lived experience.
          </p>
        </motion.div>

        <div className="space-y-6">
          {PROOF_ITEMS.map((item, i) => (
            <motion.div key={i} className="rounded-xl p-7 sm:p-8"
              style={{ background: C.bgCard, border: `1px solid ${C.border}` }}
              initial={{ opacity: 0, y: 20 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.1 + i * 0.12, ease }}
              whileHover={{ borderColor: 'rgba(201,168,76,0.15)', boxShadow: '0 12px 40px rgba(0,0,0,0.2)', transition: { duration: 0.25 } }}>
              <div className="flex flex-col sm:flex-row sm:items-start gap-4 sm:gap-6">
                <div className="shrink-0">
                  <span className="inline-block px-3 py-1 rounded-full text-[11px] font-semibold tracking-wide"
                    style={{ background: C.goldDim, color: C.gold, border: `1px solid ${C.goldBorder}` }}>
                    {item.tag}
                  </span>
                </div>
                <div className="flex-1">
                  <h3 className="text-[18px] sm:text-[20px] font-semibold mb-3 tracking-[-0.01em]" style={{ color: C.white }}>{item.title}</h3>
                  <p className="text-[14px] leading-[1.85] font-light mb-3" style={{ color: C.textSub }}>{item.desc}</p>
                  <p className="text-[12px] font-medium" style={{ color: C.gold }}>{item.detail}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function HowItWorksSection() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });

  return (
    <section id="how-it-works" ref={ref} className="py-32 sm:py-44"
      style={{ borderTop: `1px solid ${C.border}` }}>
      <div className="mx-auto max-w-[960px] px-6 lg:px-8">
        <motion.div className="text-center mb-20"
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, ease }}>
          <p className="text-[11px] font-semibold tracking-[0.3em] uppercase mb-5"
            style={{ color: C.gold }}>Process</p>
          <h2 className="text-[clamp(1.6rem,3vw,2.6rem)] font-bold tracking-[-0.025em]"
            style={{ color: C.white }}>How I Use DeepMindQ</h2>
          <p className="mt-5 text-[16px] max-w-[480px] mx-auto font-light" style={{ color: C.textDim }}>
            From signal to conversation in five steps.
          </p>
        </motion.div>

        <div className="relative">
          <motion.div className="absolute left-6 lg:left-8 top-0 bottom-0 w-px hidden sm:block"
            style={{ background: `linear-gradient(to bottom, ${C.goldBorder}, ${C.goldBorder} 90%, transparent)` }}
            initial={{ scaleY: 0 }} animate={inView ? { scaleY: 1 } : {}}
            transition={{ duration: 1.2, delay: 0.2, ease }} />

          <div className="space-y-12 sm:space-y-16">
            {STEPS.map((step, i) => (
              <motion.div key={step.num} className="flex gap-6 sm:gap-8 items-start relative"
                initial={{ opacity: 0, x: -20 }}
                animate={inView ? { opacity: 1, x: 0 } : {}}
                transition={{ duration: 0.5, delay: 0.2 + i * 0.1, ease }}>
                <div className="relative z-10 w-12 h-12 lg:w-16 lg:h-16 rounded-2xl flex items-center justify-center shrink-0"
                  style={{ background: `linear-gradient(135deg, ${C.bgCard}, ${C.bgCardHover})`, border: `1.5px solid ${C.goldBorder}`, boxShadow: '0 0 20px rgba(201,168,76,0.04)' }}>
                  <step.icon className="w-5 h-5 lg:w-6 lg:h-6" style={{ color: C.gold }} />
                </div>
                <div className="pt-1 sm:pt-2 flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-[11px] font-bold tracking-wider" style={{ color: C.gold }}>{step.num}</span>
                    <h3 className="text-[18px] sm:text-[20px] font-semibold tracking-[-0.01em]" style={{ color: C.white }}>{step.title}</h3>
                  </div>
                  <p className="text-[15px] leading-[1.8] max-w-[560px] font-light" style={{ color: C.textSub }}>{step.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════
   #1 — WHO THIS IS FOR (replaces Testimonials)
   ═══════════════════════════════════════════════════════════════ */
const WHO_THIS_IS_FOR = [
  {
    icon: UserCircle,
    title: 'Solo Growth Leaders',
    desc: 'Individual contributors carrying a number — account executives, business development reps, or founders who need deep account intelligence but don\'t have a team of researchers. You need to do more with less time, and you need every conversation to count.',
    traits: ['Carrying a personal quota', 'Managing 50+ accounts', 'No dedicated research team'],
  },
  {
    icon: Briefcase,
    title: 'Strategic Account Teams',
    desc: 'Small teams of 2-5 people focused on named accounts. The challenge isn\'t data — it\'s shared understanding. DeepMindQ gives everyone the same intelligence foundation so every team member is operating from the same playbook.',
    traits: ['Named account lists', 'Multi-threaded engagement', 'Need shared intelligence'],
  },
  {
    icon: Globe,
    title: 'Consultants & Advisors',
    desc: 'External advisors helping enterprise clients navigate growth decisions. You need to quickly understand a company\'s landscape, identify stakeholders, and bring informed perspectives to every meeting — sometimes with just 24 hours of preparation.',
    traits: ['Multiple clients simultaneously', 'Time-sensitive research needs', 'Advisory, not transactional'],
  },
];

function WhoThisIsForSection() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });

  return (
    <section id="who-this-is-for" ref={ref} className="py-32 sm:py-44"
      style={{ background: C.bgAlt, borderTop: `1px solid ${C.border}` }}>
      <div className="mx-auto max-w-[1200px] px-6 lg:px-8">
        <motion.div className="text-center mb-20"
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, ease }}>
          <p className="text-[11px] font-semibold tracking-[0.3em] uppercase mb-5"
            style={{ color: C.gold }}>Who This Is For</p>
          <h2 className="text-[clamp(1.6rem,3vw,2.6rem)] font-bold tracking-[-0.025em]"
            style={{ color: C.white }}>Built for People Who Sell by Understanding</h2>
          <p className="mt-5 text-[16px] max-w-[540px] mx-auto font-light leading-[1.75]" style={{ color: C.textDim }}>
            DeepMindQ isn&apos;t for everyone. It&apos;s for people who believe the best deals start with the deepest understanding.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6">
          {WHO_THIS_IS_FOR.map((persona, i) => (
            <motion.div key={i} className="rounded-xl p-7 sm:p-8 flex flex-col"
              style={{ background: C.bgCard, border: `1px solid ${C.border}` }}
              initial={{ opacity: 0, y: 25 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: i * 0.12, ease }}
              whileHover={{ borderColor: 'rgba(201,168,76,0.15)', boxShadow: '0 12px 40px rgba(0,0,0,0.25)', transition: { duration: 0.25 } }}>
              <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-5"
                style={{ background: C.goldDim, border: `1px solid ${C.goldBorder}` }}>
                <persona.icon className="w-5 h-5" style={{ color: C.gold }} />
              </div>
              <h3 className="text-[16px] font-semibold mb-3" style={{ color: C.white }}>{persona.title}</h3>
              <p className="text-[14px] leading-[1.8] flex-1 mb-6 font-light" style={{ color: C.textSub }}>
                {persona.desc}
              </p>
              <div className="pt-5 space-y-2.5" style={{ borderTop: `1px solid ${C.border}` }}>
                {persona.traits.map((trait, j) => (
                  <div key={j} className="flex items-center gap-2.5 text-[13px]" style={{ color: C.textDim }}>
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: C.gold }} />
                    {trait}
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════
   FAQ  #3 personal tone, #22 ARIA, #25 focus management
   ═══════════════════════════════════════════════════════════════ */
const FAQ_ITEMS = [
  { q: 'What exactly is DeepMindQ?', a: 'DeepMindQ is my personal AI-powered workspace for enterprise growth. I built it to automate the research and intelligence work I used to do manually — understanding target companies, detecting market signals, mapping stakeholders, and crafting informed outreach. It\'s a living tool that I use every day and continue to improve.' },
  { q: 'Who built this and why?', a: 'I\'m Ravi Shanker — an enterprise growth leader with 15+ years in technology sales. I built DeepMindQ because I was tired of spending 6+ hours per week on manual account research across LinkedIn, SEC filings, news, and CRMs. I wanted a single place where all my target account intelligence lives and compounds over time.' },
  { q: 'Can I see it in action?', a: 'DeepMindQ is a private workspace — you need access to see the full platform. If you\'re curious about how it works, the "Framework" and "Platform" sections above walk through the intelligence layers and core modules. Or reach out to me directly — I\'m happy to show it to people who might benefit from the same approach.' },
  { q: 'Is my data secure?', a: 'Absolutely. Everything is built with enterprise-grade security from the ground up. All data is encrypted at rest and in transit. Your account intelligence, stakeholder maps, and conversation history are completely private and never shared. Authentication uses session-based httpOnly cookies.' },
  { q: 'What kind of companies does this work for?', a: 'DeepMindQ is optimized for B2B enterprise sales — particularly technology companies selling to mid-market and enterprise accounts. If your sales cycle involves multiple stakeholders, requires deep account understanding, and benefits from research-informed outreach, this approach will work for you.' },
  { q: 'How do I get access?', a: 'Click "Private Workspace" to request access. Since this is my personal workspace (not a commercial SaaS), access is limited. If you\'re a growth leader who believes in the "understand first" philosophy, I\'d love to hear from you.' },
];

function FAQSection() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const answerRefs = useRef<(HTMLDivElement | null)[]>([]);

  // #25 — Focus management: move focus to answer when it opens
  useEffect(() => {
    if (openIndex === null) return;
    const timer = setTimeout(() => {
      answerRefs.current[openIndex]?.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, [openIndex]);

  return (
    <section id="faq" ref={ref} className="py-32 sm:py-44" style={{ borderTop: `1px solid ${C.border}` }}>
      <div className="mx-auto max-w-[780px] px-6 lg:px-8">
        <motion.div className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, ease }}>
          <p className="text-[11px] font-semibold tracking-[0.3em] uppercase mb-5"
            style={{ color: C.gold }}>FAQ</p>
          <h2 className="text-[clamp(1.6rem,3vw,2.6rem)] font-bold tracking-[-0.025em]"
            style={{ color: C.white }}>Questions You Might Have</h2>
          <p className="mt-5 text-[16px] font-light" style={{ color: C.textDim }}>Straight answers about DeepMindQ.</p>
        </motion.div>

        <div className="space-y-3">
          {FAQ_ITEMS.map((item, i) => {
            const isOpen = openIndex === i;
            return (
              <motion.div key={i} className="rounded-xl overflow-hidden"
                style={{ background: C.bgCard, border: `1px solid ${isOpen ? C.goldBorder : C.border}` }}
                initial={{ opacity: 0, y: 15 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.4, delay: 0.1 + i * 0.06, ease }}>
                <button onClick={() => setOpenIndex(isOpen ? null : i)}
                  className="w-full flex items-center justify-between px-6 py-5 text-left"
                  aria-expanded={isOpen}
                  aria-controls={`faq-answer-${i}`}>
                  <span className="text-[15px] font-medium pr-4" style={{ color: isOpen ? C.gold : C.white }}>{item.q}</span>
                  <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.25 }}>
                    <ChevronDown className="w-4 h-4 shrink-0" style={{ color: isOpen ? C.gold : C.textDim }} />
                  </motion.div>
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div id={`faq-answer-${i}`} role="region" aria-label={item.q}
                      ref={el => { answerRefs.current[i] = el; }}
                      tabIndex={-1}
                      initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3, ease }} className="overflow-hidden">
                      <div className="px-6 pb-6">
                        <div className="h-px mb-4" style={{ background: C.border }} />
                        <p className="text-[15px] leading-[1.85] font-light" style={{ color: C.textSub }}>{item.a}</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════
   #2 — CAPABILITY METRICS (replaces SaaS stats)
   ═══════════════════════════════════════════════════════════════ */
function MiniSparkline({ data, color }: { data: number[]; color: string }) {
  const w = 80, h = 28, pad = 2;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const points = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * (w - pad * 2);
    const y = pad + (1 - (v - min) / range) * (h - pad * 2);
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-7 mt-2.5" preserveAspectRatio="none">
      <defs>
        <linearGradient id={`spark-fill-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.2" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon fill={`url(#spark-fill-${color.replace('#', '')})`} points={`0,${h} ${points} ${w},${h}`} />
      <polyline fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" points={points} />
    </svg>
  );
}

/* #5 — Reframed as "What This Delivers" + #2 capability stats + #9 CTA path */
function ValueSection({ onLogin }: { onLogin: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });

  // #2 — Capability-focused metrics (real, not fabricated SaaS claims)
  const stats = [
    { value: '5', label: 'Intelligence Layers', data: [1, 1, 2, 2, 3, 3, 4, 4, 5], color: C.gold },
    { value: '6', label: 'Signal Types Monitored', data: [1, 1, 2, 2, 3, 3, 4, 5, 6], color: '#22c55e' },
    { value: '4', label: 'Core Platform Modules', data: [1, 1, 2, 2, 3, 3, 3, 4, 4], color: '#60a5fa' },
    { value: '24/7', label: 'Continuous Monitoring', data: [4, 8, 12, 14, 16, 18, 20, 22, 24], color: '#f59e0b' },
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
    <section id="about" ref={ref} className="py-32 sm:py-44"
      style={{ background: C.bgAlt, borderTop: `1px solid ${C.border}` }}>
      <div className="mx-auto max-w-[1200px] px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-20 items-center">
          <motion.div initial={{ opacity: 0, y: 20 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.7, ease }}>
            {/* #5 — Reframed label */}
            <p className="text-[11px] font-semibold tracking-[0.3em] uppercase mb-5"
              style={{ color: C.gold }}>What This Delivers</p>
            <h2 className="text-[clamp(1.6rem,3vw,2.2rem)] font-bold tracking-[-0.025em] leading-[1.15] mb-8"
              style={{ color: C.white }}>
              From Data to Understanding.<br />From Understanding to Growth.
            </h2>
            <p className="text-[16px] leading-[1.85] mb-5 font-light" style={{ color: C.textSub }}>
              DeepMindQ doesn&apos;t give you more data. It gives you understanding — the kind
              that changes how you sell, who you talk to, and what you say when you get there.
              Every signal, every stakeholder, every conversation — connected and compounding.
            </p>
            <p className="text-[16px] leading-[1.85] mb-10 font-light" style={{ color: C.textSub }}>
              In a world where every sales team has access to the same data, the winners are the ones
              who understand it better. This is my unfair advantage — and it can be yours too.
            </p>

            <div className="flex flex-wrap items-center gap-3">
              {steps.map((step, i) => (
                <div key={i} className="flex items-center gap-3">
                  <motion.div className="flex items-center gap-2.5 px-4 py-2.5 rounded-lg"
                    style={{ background: C.bgCard, border: `1px solid ${C.border}` }}
                    initial={{ opacity: 0, y: 10 }}
                    animate={inView ? { opacity: 1, y: 0 } : {}}
                    transition={{ duration: 0.4, delay: 0.3 + i * 0.08 }}>
                    <step.icon className="w-4 h-4" style={{ color: C.gold }} />
                    <span className="text-[13px] font-medium whitespace-nowrap" style={{ color: C.textSub }}>{step.label}</span>
                  </motion.div>
                  {i < steps.length - 1 && (
                    <ChevronRight className="w-3.5 h-3.5 hidden sm:block" style={{ color: C.textDim }} />
                  )}
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div className="text-center lg:text-left"
            initial={{ opacity: 0, y: 20 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.7, delay: 0.15, ease }}>
            <div className="grid grid-cols-2 gap-5 mb-12">
              {stats.map((s, i) => (
                <motion.div key={i} className="p-5 rounded-xl"
                  style={{ background: C.bgCard, border: `1px solid ${C.border}` }}
                  initial={{ opacity: 0, y: 15 }}
                  animate={inView ? { opacity: 1, y: 0 } : {}}
                  transition={{ duration: 0.5, delay: 0.2 + i * 0.1 }}>
                  <div className="text-[clamp(1.8rem,3vw,2.4rem)] font-bold tracking-[-0.03em] leading-none mb-0.5"
                    style={{ color: s.color }}>{statDisplays[i]}</div>
                  <div className="text-[12px] font-medium" style={{ color: C.textDim }}>{s.label}</div>
                  <MiniSparkline data={s.data} color={s.color} />
                </motion.div>
              ))}
            </div>

            {/* #9 — Clear CTA path + #32 loading state */}
            <motion.button onClick={onLogin}
              className="group relative inline-flex items-center gap-2.5 px-8 py-4 rounded-lg text-[15px] font-semibold overflow-hidden"
              style={{ background: C.gold, color: '#0A0E1A' }}
              whileHover={{ scale: 1.03, boxShadow: '0 0 30px rgba(201,168,76,0.25)' }}
              whileTap={{ scale: 0.98 }}>
              {/* #32 — Subtle shimmer loading hint */}
              <motion.span
                className="absolute inset-0 pointer-events-none"
                style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent)', backgroundSize: '200% 100%' }}
                animate={{ backgroundPosition: ['-200% 0', '200% 0'] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'linear' }} />
              <Lock className="w-4 h-4 relative z-10" />
              <span className="relative z-10">Enter Private Workspace</span>
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5 relative z-10" />
            </motion.button>

            {/* #9 — Intermediate CTA for warm leads */}
            <div className="mt-4 flex items-center justify-center lg:justify-start gap-4 text-[13px]">
              <a href="https://www.linkedin.com/in/shankerpisupati/" target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 transition-colors duration-200"
                style={{ color: C.textDim }}
                onMouseEnter={e => { e.currentTarget.style.color = C.gold; }}
                onMouseLeave={e => { e.currentTarget.style.color = C.textDim; }}>
                <Linkedin className="w-3.5 h-3.5" />
                Connect on LinkedIn
              </a>
              <span style={{ color: C.border }}>|</span>
              <a href="mailto:shanker001@gmail.com"
                className="inline-flex items-center gap-1.5 transition-colors duration-200"
                style={{ color: C.textDim }}
                onMouseEnter={e => { e.currentTarget.style.color = C.gold; }}
                onMouseLeave={e => { e.currentTarget.style.color = C.textDim; }}>
                <Mail className="w-3.5 h-3.5" />
                Or email me
              </a>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════
   FOOTER  #35 cleaner workspace link, #50 varied footer copy
   ═══════════════════════════════════════════════════════════════ */
function Footer({ onLogin }: { onLogin: () => void }) {
  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });

  return (
    <footer className="pt-20 pb-10 px-6" style={{ background: C.bgAlt, borderTop: `1px solid ${C.border}` }}>
      <div className="mx-auto max-w-[1200px]">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-12 mb-14 pb-14" style={{ borderBottom: `1px solid ${C.border}` }}>
          <div className="sm:col-span-2 lg:col-span-1">
            <div className="flex items-center gap-2.5 mb-5">
              <div className="w-7 h-7 rounded-md flex items-center justify-center"
                style={{ background: C.goldDim, border: `1px solid ${C.goldBorder}` }}>
                <Sparkles className="w-3.5 h-3.5" style={{ color: C.gold }} />
              </div>
              <span className="text-[15px] font-semibold" style={{ color: C.white }}>DeepMindQ</span>
            </div>
            <p className="text-[13px] leading-[1.7] max-w-[260px] font-light" style={{ color: C.textDim }}>
              A personal intelligence workspace.<br />Understand before you sell.
            </p>
          </div>
          <div>
            <p className="text-[11px] font-semibold tracking-[0.2em] uppercase mb-5" style={{ color: C.textSub }}>Platform</p>
            <div className="space-y-3">
              {[{ label: 'Command Center', id: 'platform' }, { label: 'Stakeholder Maps', id: 'platform' },
               { label: 'Knowledge Engine', id: 'platform' }, { label: 'Conversation Studio', id: 'platform' }].map(item => (
                <button key={item.label} onClick={() => scrollTo(item.id)}
                  className="block text-[13px] font-light transition-colors duration-200"
                  style={{ color: C.textDim }}
                  onMouseEnter={e => { e.currentTarget.style.color = C.gold; }}
                  onMouseLeave={e => { e.currentTarget.style.color = C.textDim; }}>{item.label}</button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[11px] font-semibold tracking-[0.2em] uppercase mb-5" style={{ color: C.textSub }}>Intelligence</p>
            <div className="space-y-3">
              {[{ label: 'Market Signals', id: 'framework' }, { label: 'Account Research', id: 'framework' },
               { label: 'Stakeholder Intel', id: 'framework' }, { label: 'Solution Matching', id: 'framework' }].map(item => (
                <button key={item.label} onClick={() => scrollTo(item.id)}
                  className="block text-[13px] font-light transition-colors duration-200"
                  style={{ color: C.textDim }}
                  onMouseEnter={e => { e.currentTarget.style.color = C.gold; }}
                  onMouseLeave={e => { e.currentTarget.style.color = C.textDim; }}>{item.label}</button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[11px] font-semibold tracking-[0.2em] uppercase mb-5" style={{ color: C.textSub }}>Navigate</p>
            <div className="space-y-3">
              {[{ label: 'Philosophy', id: 'philosophy' }, { label: 'How It Works', id: 'how-it-works' },
               { label: 'Who This Is For', id: 'who-this-is-for' },
               { label: 'FAQ', id: 'faq' }].map(item => (
                <button key={item.label} onClick={() => scrollTo(item.id)}
                  className="block text-[13px] font-light transition-colors duration-200"
                  style={{ color: C.textDim }}
                  onMouseEnter={e => { e.currentTarget.style.color = C.gold; }}
                  onMouseLeave={e => { e.currentTarget.style.color = C.textDim; }}>{item.label}</button>
              ))}
              {/* #35 — Prominent Login in footer nav */}
              <button onClick={onLogin}
                className="block text-[13px] font-medium transition-colors duration-200 mt-2"
                style={{ color: C.gold }}
                onMouseEnter={e => { e.currentTarget.style.color = C.goldBright; }}
                onMouseLeave={e => { e.currentTarget.style.color = C.gold; }}>
                Login to Workspace
              </button>
            </div>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row items-center justify-between gap-5">
          {/* #50 — Varied footer copy, not repeated */}
          <p className="text-[12px] text-center font-light" style={{ color: C.textDim }}>
            &copy; {new Date().getFullYear()} DeepMindQ &middot; Built with conviction by Ravi Shanker
          </p>
          <div className="flex items-center gap-3">
            <a href="https://www.linkedin.com/in/shankerpisupati/" target="_blank" rel="noopener noreferrer"
              className="w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-200"
              style={{ color: C.textDim, border: `1px solid ${C.border}` }}
              onMouseEnter={e => { e.currentTarget.style.color = C.gold; e.currentTarget.style.borderColor = C.goldBorder; e.currentTarget.style.background = C.goldDim; }}
              onMouseLeave={e => { e.currentTarget.style.color = C.textDim; e.currentTarget.style.borderColor = C.border; e.currentTarget.style.background = 'transparent'; }}
              aria-label="LinkedIn profile">
              <Linkedin className="w-3.5 h-3.5" />
            </a>
            <a href="mailto:shanker001@gmail.com"
              className="w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-200"
              style={{ color: C.textDim, border: `1px solid ${C.border}` }}
              onMouseEnter={e => { e.currentTarget.style.color = C.gold; e.currentTarget.style.borderColor = C.goldBorder; e.currentTarget.style.background = C.goldDim; }}
              onMouseLeave={e => { e.currentTarget.style.color = C.textDim; e.currentTarget.style.borderColor = C.border; e.currentTarget.style.background = 'transparent'; }}
              aria-label="Send email">
              <Mail className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN  #30 consistent section dividers, #34 nav matches sections
   ═══════════════════════════════════════════════════════════════ */
interface LandingPageProps { onLogin: () => void; }

export default function LandingPage({ onLogin }: LandingPageProps) {
  const [showLogin, setShowLogin] = useState(false);
  const [preloaderDone, setPreloaderDone] = useState(false);
  const handleLogin = useCallback(() => setShowLogin(true), []);

  return (
    <>
      <AnimatePresence>
        {!preloaderDone && <Preloader onComplete={() => setPreloaderDone(true)} />}
      </AnimatePresence>

      {/* #21 — Skip to content */}
      <SkipToContent />

      <div className="min-h-screen" style={{ background: C.bg, color: C.text }}>
        <ScrollProgressBar />
        <BackToTop />
        <Header onLogin={handleLogin} />
        <HeroSection onLogin={handleLogin} />
        <SectionDivider />
        <PhilosophySection />
        <SectionDivider />
        <FrameworkSection />
        <SectionDivider />
        <PlatformSection />
        <SectionDivider />
        <HowItWorksSection />
        <SectionDivider />
        <ProofOfWorkSection />
        <SectionDivider />
        <WhoThisIsForSection />
        <SectionDivider />
        <FAQSection />
        <SectionDivider />
        <ValueSection onLogin={handleLogin} />
        <Footer onLogin={handleLogin} />
      </div>

      <AnimatePresence>
        {showLogin && <LoginPage onLogin={onLogin} />}
      </AnimatePresence>
    </>
  );
}