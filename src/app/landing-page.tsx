'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, useScroll, useTransform, useInView, AnimatePresence } from 'framer-motion';
import {
  ArrowRight, ArrowUpRight, Lock, ExternalLink,
  Building2, BarChart3, Brain, MessageSquare, Users, Target,
  Search, Lightbulb, Rocket, TrendingUp, Zap, Shield,
  Layers, Network, Sparkles, ChevronRight, Eye, Database,
  Linkedin, Mail, BookOpen,
} from 'lucide-react';
import LoginPage from '@/components/login-page';

/* ═══════════════════════════════════════════════════════════
   DESIGN TOKENS
   Dark navy + warm gold — distinctive, not generic blue
   ═══════════════════════════════════════════════════════════ */
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

/* Easing */
const ease = [0.16, 1, 0.3, 1] as const;

/* ═══════════════════════════════════════════════════════════
   HERO INTELLIGENCE ENGINE — Canvas radial network
   ═══════════════════════════════════════════════════════════ */
const HUB_NODES = [
  { label: 'Companies',    icon: 'building',    angle: -90 },
  { label: 'Signals',      icon: 'chart',       angle: -30 },
  { label: 'Solutions',    icon: 'puzzle',      angle: 30  },
  { label: 'People',       icon: 'users',       angle: 90  },
  { label: 'Opportunities', icon: 'target',      angle: 150 },
  { label: 'Conversations', icon: 'message',    angle: 210 },
];

function useHeroCanvas(canvasRef: React.RefObject<HTMLCanvasElement | null>) {
  const rafRef = useRef(0);
  const particlesRef = useRef<Array<{x:number;y:number;vx:number;vy:number;r:number;a:number}>>([]);

  const init = useCallback((w: number, h: number) => {
    const cx = w / 2, cy = h / 2;
    const orbitR = Math.min(w, h) * 0.3;
    // Initialize orbit particles
    const particles: typeof particlesRef.current = [];
    for (let i = 0; i < 50; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = orbitR * (0.3 + Math.random() * 0.9);
      particles.push({
        x: cx + Math.cos(angle) * dist,
        y: cy + Math.sin(angle) * dist,
        vx: (Math.random() - 0.5) * 0.2,
        vy: (Math.random() - 0.5) * 0.2,
        r: 0.8 + Math.random() * 1.2,
        a: 0.1 + Math.random() * 0.2,
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

    let time = 0;
    const draw = () => {
      const w = canvas.width / dpr, h = canvas.height / dpr;
      ctx.clearRect(0, 0, w, h);
      time += 0.003;

      const cx = w / 2, cy = h / 2;
      const orbitR = Math.min(w, h) * 0.3;
      const nodeR = Math.min(w, h) * 0.045;

      // Draw grid
      ctx.strokeStyle = C.gridLine;
      ctx.lineWidth = 0.5;
      const gridSize = 40;
      for (let x = gridSize; x < w; x += gridSize) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
      }
      for (let y = gridSize; y < h; y += gridSize) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
      }

      // Center glow
      const cGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, orbitR * 1.2);
      cGlow.addColorStop(0, 'rgba(201,168,76,0.06)');
      cGlow.addColorStop(0.5, 'rgba(201,168,76,0.02)');
      cGlow.addColorStop(1, 'transparent');
      ctx.fillStyle = cGlow;
      ctx.fillRect(0, 0, w, h);

      // Orbit ring
      ctx.beginPath();
      ctx.arc(cx, cy, orbitR, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(201,168,76,0.08)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 6]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Inner orbit ring
      ctx.beginPath();
      ctx.arc(cx, cy, orbitR * 0.55, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(201,168,76,0.04)';
      ctx.lineWidth = 0.5;
      ctx.stroke();

      // Compute node positions
      const nodePositions = HUB_NODES.map((n, i) => {
        const a = (n.angle * Math.PI) / 180 + Math.sin(time + i) * 0.03;
        return {
          x: cx + Math.cos(a) * orbitR,
          y: cy + Math.sin(a) * orbitR,
          label: n.label,
        };
      });

      // Draw connections to center
      nodePositions.forEach((pos, i) => {
        const grad = ctx.createLinearGradient(cx, cy, pos.x, pos.y);
        grad.addColorStop(0, 'rgba(201,168,76,0.2)');
        grad.addColorStop(1, 'rgba(201,168,76,0.05)');
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(pos.x, pos.y);
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1;
        ctx.stroke();

        // Animated pulse along connection
        const pulseT = ((time * 0.5 + i * 0.17) % 1);
        const px = cx + (pos.x - cx) * pulseT;
        const py = cy + (pos.y - cy) * pulseT;
        ctx.beginPath();
        ctx.arc(px, py, 1.5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(201,168,76,${0.6 * (1 - pulseT)})`;
        ctx.fill();
      });

      // Draw inter-node connections
      for (let i = 0; i < nodePositions.length; i++) {
        const next = nodePositions[(i + 1) % nodePositions.length];
        const cur = nodePositions[i];
        ctx.beginPath();
        ctx.moveTo(cur.x, cur.y);
        ctx.lineTo(next.x, next.y);
        ctx.strokeStyle = 'rgba(201,168,76,0.04)';
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }

      // Floating particles
      particlesRef.current.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        // Gentle attraction to center
        const dx = cx - p.x, dy = cy - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > orbitR * 1.1) {
          p.vx += dx * 0.0001;
          p.vy += dy * 0.0001;
        }
        p.vx *= 0.999;
        p.vy *= 0.999;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(201,168,76,${p.a * 0.5})`;
        ctx.fill();
      });

      // Center hub
      const hubGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, nodeR * 2.5);
      hubGlow.addColorStop(0, 'rgba(201,168,76,0.15)');
      hubGlow.addColorStop(1, 'transparent');
      ctx.beginPath();
      ctx.arc(cx, cy, nodeR * 2.5, 0, Math.PI * 2);
      ctx.fillStyle = hubGlow;
      ctx.fill();

      // Center icon (sparkle/brain)
      ctx.beginPath();
      ctx.arc(cx, cy, nodeR * 0.9, 0, Math.PI * 2);
      const coreGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, nodeR * 0.9);
      coreGrad.addColorStop(0, C.goldBright);
      coreGrad.addColorStop(1, C.gold);
      ctx.fillStyle = coreGrad;
      ctx.fill();

      // Pulse ring
      const pulse = (Math.sin(time * 2.5) + 1) * 0.5;
      ctx.beginPath();
      ctx.arc(cx, cy, nodeR * (1.1 + pulse * 0.4), 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(201,168,76,${0.15 - pulse * 0.1})`;
      ctx.lineWidth = 0.5;
      ctx.stroke();

      // Outer nodes
      nodePositions.forEach((pos, i) => {
        // Node glow
        const nGlow = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, nodeR * 1.8);
        nGlow.addColorStop(0, 'rgba(201,168,76,0.08)');
        nGlow.addColorStop(1, 'transparent');
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, nodeR * 1.8, 0, Math.PI * 2);
        ctx.fillStyle = nGlow;
        ctx.fill();

        // Node circle
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, nodeR * 0.65, 0, Math.PI * 2);
        ctx.fillStyle = C.bgCard;
        ctx.fill();
        ctx.strokeStyle = 'rgba(201,168,76,0.3)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Inner dot
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 3, 0, Math.PI * 2);
        ctx.fillStyle = C.gold;
        ctx.fill();

        // Label
        ctx.font = '500 10px Inter, system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = C.textSub;
        ctx.fillText(pos.label, pos.x, pos.y + nodeR * 0.65 + 16);
      });

      // "Intelligence Engine" label at center bottom
      ctx.font = '600 10px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(201,168,76,0.5)';
      ctx.letterSpacing = '1px';
      ctx.fillText('INTELLIGENCE ENGINE', cx, cy + nodeR * 2.5);

      rafRef.current = requestAnimationFrame(draw);
    };
    rafRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [init]);
}

/* ═══════════════════════════════════════════════════════════
   HEADER / NAV
   ═══════════════════════════════════════════════════════════ */
function Header({ onLogin }: { onLogin: () => void }) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    setMobileMenu(false);
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
        background: scrolled ? 'rgba(10,14,26,0.85)' : 'transparent',
        backdropFilter: scrolled ? 'blur(16px)' : 'none',
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

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-1">
          {links.map(link => (
            <button key={link.id} onClick={() => scrollTo(link.id)}
              className="px-3.5 py-2 text-[13px] font-medium rounded-lg transition-colors duration-200"
              style={{ color: C.textSub }}
              onMouseEnter={e => { e.currentTarget.style.color = C.white; e.currentTarget.style.background = C.bgCard; }}
              onMouseLeave={e => { e.currentTarget.style.color = C.textSub; e.currentTarget.style.background = 'transparent'; }}>
              {link.label}
            </button>
          ))}
        </nav>

        {/* CTA */}
        <div className="flex items-center gap-3">
          <button onClick={onLogin}
            className="hidden sm:inline-flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-semibold transition-all duration-200"
            style={{ background: C.gold, color: '#0A0E1A' }}
            onMouseEnter={e => { e.currentTarget.style.background = C.goldBright; e.currentTarget.style.boxShadow = '0 0 20px rgba(201,168,76,0.2)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = C.gold; e.currentTarget.style.boxShadow = 'none'; }}>
            <Lock className="w-3.5 h-3.5" />
            Private Workspace
          </button>
          {/* Mobile burger */}
          <button className="md:hidden p-2 rounded-lg" style={{ color: C.textSub }}
            onClick={() => setMobileMenu(!mobileMenu)}>
            <div className="space-y-1.5">
              <div className="w-5 h-px rounded" style={{ background: C.textSub }} />
              <div className="w-5 h-px rounded" style={{ background: C.textSub }} />
            </div>
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileMenu && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden overflow-hidden"
            style={{ background: 'rgba(10,14,26,0.95)', backdropFilter: 'blur(16px)' }}>
            <div className="px-6 py-4 space-y-1">
              {links.map(link => (
                <button key={link.id} onClick={() => scrollTo(link.id)}
                  className="block w-full text-left px-3 py-2.5 text-[14px] font-medium rounded-lg"
                  style={{ color: C.textSub }}
                  onClickCapture={() => setMobileMenu(false)}>
                  {link.label}
                </button>
              ))}
              <button onClick={() => { setMobileMenu(false); onLogin(); }}
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

/* ═══════════════════════════════════════════════════════════
   HERO — Two-column layout
   ═══════════════════════════════════════════════════════════ */
function HeroSection({ onLogin }: { onLogin: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const inView = useInView(heroRef, { once: true });
  useHeroCanvas(canvasRef);

  const scrollToFramework = () => {
    document.getElementById('framework')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section ref={heroRef} className="relative min-h-screen flex items-center overflow-hidden pt-16">
      {/* Subtle radial bg */}
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 70% 50% at 60% 50%, rgba(201,168,76,0.03) 0%, transparent 70%)' }} />

      <div className="relative z-10 mx-auto max-w-[1360px] w-full px-6 lg:px-10 py-12 lg:py-0">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-8 items-center">
          {/* Left — Text */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
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
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <button onClick={scrollToFramework}
                className="group inline-flex items-center gap-2 px-5 py-3 rounded-lg text-[14px] font-semibold transition-all duration-200"
                style={{ background: C.gold, color: '#0A0E1A' }}
                onMouseEnter={e => { e.currentTarget.style.background = C.goldBright; e.currentTarget.style.boxShadow = '0 0 24px rgba(201,168,76,0.2)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = C.gold; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'translateY(0)'; }}>
                Explore DeepMindQ
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
              </button>
              <button onClick={scrollToFramework}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-lg text-[14px] font-medium transition-all duration-200"
                style={{ color: C.gold, border: `1px solid ${C.goldBorder}` }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = C.gold; e.currentTarget.style.background = C.goldDim; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = C.goldBorder; e.currentTarget.style.background = 'transparent'; }}>
                <Eye className="w-4 h-4" />
                See How It Works
              </button>
            </div>
          </motion.div>

          {/* Right — Intelligence Engine Canvas */}
          <motion.div
            className="relative w-full aspect-square max-w-[520px] mx-auto lg:mx-0 lg:ml-auto"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={inView ? { opacity: 1, scale: 1 } : {}}
            transition={{ duration: 1, delay: 0.2, ease }}>
            <canvas ref={canvasRef} className="w-full h-full" />
          </motion.div>
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════
   PHILOSOPHY / BRAND STORY — "About Ravi" (no headshot)
   ═══════════════════════════════════════════════════════════ */
function PhilosophySection() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });

  return (
    <section id="philosophy" ref={ref} className="py-24 sm:py-32"
      style={{ background: C.bgAlt, borderTop: `1px solid ${C.border}` }}>
      <div className="mx-auto max-w-[1360px] px-6 lg:px-10">
        <div className="grid lg:grid-cols-2 gap-16 items-start">
          {/* Left — Brand Story */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
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

          {/* Right — Three "Understand" pillars */}
          <div className="space-y-10 lg:pt-12">
            {[
              {
                icon: Search,
                title: 'Understand.',
                sub: 'Before you approach.',
                desc: 'Deep research into company ecosystems, technology landscapes, funding events, and strategic priorities — automated and continuous.',
              },
              {
                icon: Target,
                title: 'Understand.',
                sub: 'Before you propose.',
                desc: 'Stakeholder mapping, power dynamics analysis, and capability-to-pain alignment ensure your solution speaks directly to their reality.',
              },
              {
                icon: MessageSquare,
                title: 'Understand.',
                sub: 'Before you sell.',
                desc: 'Every outreach informed by intelligence. Every conversation builds on context. Relationship memory that compounds over time.',
              },
            ].map((item, i) => (
              <motion.div key={i}
                className="flex gap-5"
                initial={{ opacity: 0, y: 20 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.6, delay: 0.2 + i * 0.12, ease }}>
                <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: C.goldDim, border: `1px solid ${C.goldBorder}` }}>
                  <item.icon className="w-[18px] h-[18px]" style={{ color: C.gold }} />
                </div>
                <div>
                  <p className="text-[17px] font-semibold" style={{ color: C.white }}>
                    {item.title}{' '}
                    <span className="font-normal" style={{ color: C.textSub }}>{item.sub}</span>
                  </p>
                  <p className="mt-1.5 text-[14px] leading-[1.7]" style={{ color: C.textDim }}>
                    {item.desc}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════
   INTELLIGENCE FRAMEWORK — 5 capability cards (3+2 grid)
   ═══════════════════════════════════════════════════════════ */
const FRAMEWORK = [
  {
    icon: BarChart3,
    title: 'Market Signal Intelligence',
    sub: 'Detect business changes before engagement begins.',
    bullets: ['Funding rounds & M&A activity', 'Technology stack changes', 'Leadership movements', 'Competitor positioning shifts'],
  },
  {
    icon: Building2,
    title: 'Account Intelligence',
    sub: 'Map the full company ecosystem.',
    bullets: ['Company profiles & ecosystems', 'Technology landscape analysis', 'Strategic relationships', 'Growth trajectory scoring'],
  },
  {
    icon: Users,
    title: 'Stakeholder Intelligence',
    sub: 'Know who matters and why.',
    bullets: ['Decision-maker identification', 'Influence mapping', 'Champion detection', 'Org chart intelligence'],
  },
  {
    icon: Layers,
    title: 'Solution Intelligence',
    sub: 'Align capabilities to real pain points.',
    bullets: ['Capability-to-need matching', 'Evidence-based positioning', 'Competitive differentiation', 'Value articulation'],
  },
  {
    icon: MessageSquare,
    title: 'Conversation Intelligence',
    sub: 'Every outreach is research-informed.',
    bullets: ['AI-generated personalization', 'Relationship memory', 'Conversation planning', 'Engagement timing'],
  },
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

        {/* 3 + 2 grid */}
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
    <motion.div
      className="group rounded-xl p-6 sm:p-7 transition-all duration-300"
      style={{ background: C.bgCard, border: `1px solid ${C.border}` }}
      initial={{ opacity: 0, y: 20 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, delay: index * 0.07, ease }}
      whileHover={{ borderColor: C.borderLight, background: C.bgCardHover }}>
      <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-4"
        style={{ background: C.goldDim }}>
        <Icon className="w-[18px] h-[18px]" style={{ color: C.gold }} />
      </div>
      <h3 className="text-[15px] font-semibold mb-1 tracking-[-0.01em]" style={{ color: C.white }}>{title}</h3>
      <p className="text-[13px] mb-4" style={{ color: C.textDim }}>{sub}</p>
      <ul className="space-y-2">
        {bullets.map((b, i) => (
          <li key={i} className="flex items-start gap-2.5 text-[13px]" style={{ color: C.textSub }}>
            <span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: C.gold }} />
            {b}
          </li>
        ))}
      </ul>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════
   INSIDE DEEPMINDQ — 4 product modules with UI mockups
   ═══════════════════════════════════════════════════════════ */
const MODULES = [
  {
    icon: Sparkles,
    title: 'AI Command Center',
    desc: 'Unified view of accounts, signals, opportunities, and priorities — your operational nerve center.',
    mockup: 'command-center',
  },
  {
    icon: Network,
    title: 'Stakeholder Mind Map',
    desc: 'Visualize decision-makers, influencers, and power dynamics within target accounts.',
    mockup: 'mindmap',
  },
  {
    icon: Database,
    title: 'Knowledge Engine',
    desc: 'Your solution intelligence library — capabilities, use cases, and competitive positioning.',
    mockup: 'knowledge',
  },
  {
    icon: Zap,
    title: 'Conversation Studio',
    desc: 'AI-generated, research-informed outreach that speaks directly to each stakeholder.',
    mockup: 'studio',
  },
];

/* Mini UI mockups — pure CSS, no images needed */
function MiniMockup({ type }: { type: string }) {
  const bars = [65, 45, 80, 55, 70, 40, 90, 60, 75, 50, 85, 65];

  if (type === 'command-center') {
    return (
      <div className="w-full h-full rounded-lg p-3 space-y-2"
        style={{ background: '#080c16', border: `1px solid ${C.border}` }}>
        {/* Header */}
        <div className="flex items-center justify-between mb-1">
          <div className="flex gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ background: '#ef4444' }} />
            <div className="w-2 h-2 rounded-full" style={{ background: '#eab308' }} />
            <div className="w-2 h-2 rounded-full" style={{ background: '#22c55e' }} />
          </div>
          <div className="h-2 w-16 rounded" style={{ background: 'rgba(255,255,255,0.06)' }} />
        </div>
        {/* Stat cards */}
        <div className="grid grid-cols-3 gap-1.5">
          {[
            { v: '156', l: 'Accounts' },
            { v: '48', l: 'Signals' },
            { v: '23', l: 'Pipeline' },
          ].map((s, i) => (
            <div key={i} className="rounded p-2 text-center"
              style={{ background: 'rgba(255,255,255,0.03)' }}>
              <div className="text-[14px] font-bold" style={{ color: C.gold }}>{s.v}</div>
              <div className="text-[8px]" style={{ color: C.textDim }}>{s.l}</div>
            </div>
          ))}
        </div>
        {/* Chart bars */}
        <div className="flex items-end gap-1 h-12 pt-1">
          {bars.slice(0, 8).map((h, i) => (
            <div key={i} className="flex-1 rounded-t-sm transition-all"
              style={{ height: `${h}%`, background: `rgba(201,168,76,${0.2 + (h/100)*0.4})`, minHeight: 4 }} />
          ))}
        </div>
      </div>
    );
  }

  if (type === 'mindmap') {
    return (
      <div className="w-full h-full rounded-lg p-3 flex items-center justify-center"
        style={{ background: '#080c16', border: `1px solid ${C.border}` }}>
        <svg viewBox="0 0 200 140" className="w-full h-full">
          {/* Center */}
          <circle cx="100" cy="70" r="12" fill="rgba(201,168,76,0.3)" stroke="rgba(201,168,76,0.5)" strokeWidth="1" />
          <circle cx="100" cy="70" r="4" fill={C.gold} />
          {/* Orbiting nodes */}
          {[
            { x: 40, y: 35 }, { x: 160, y: 30 }, { x: 50, y: 110 },
            { x: 155, y: 105 }, { x: 100, y: 15 },
          ].map((n, i) => (
            <g key={i}>
              <line x1="100" y1="70" x2={n.x} y2={n.y}
                stroke="rgba(201,168,76,0.15)" strokeWidth="0.8" />
              <circle cx={n.x} cy={n.y} r="8" fill="rgba(255,255,255,0.04)"
                stroke="rgba(255,255,255,0.1)" strokeWidth="0.8" />
              <circle cx={n.x} cy={n.y} r="2.5" fill="rgba(201,168,76,0.6)" />
            </g>
          ))}
        </svg>
      </div>
    );
  }

  if (type === 'knowledge') {
    return (
      <div className="w-full h-full rounded-lg p-3 space-y-1.5"
        style={{ background: '#080c16', border: `1px solid ${C.border}` }}>
        <div className="flex items-center gap-2 mb-1">
          <div className="h-2.5 w-20 rounded" style={{ background: 'rgba(255,255,255,0.08)' }} />
          <div className="h-2.5 w-12 rounded ml-auto" style={{ background: C.goldDim }} />
        </div>
        {['AI Automation', 'Cloud Migration', 'Data Analytics', 'Security', 'Integration'].map((item, i) => (
          <div key={i} className="flex items-center gap-2 rounded px-2 py-1.5"
            style={{ background: 'rgba(255,255,255,0.02)' }}>
            <div className="w-3 h-3 rounded-sm shrink-0" style={{ background: C.goldDim, border: `0.5px solid ${C.goldBorder}` }} />
            <span className="text-[9px]" style={{ color: C.textSub }}>{item}</span>
            <span className="ml-auto text-[8px]" style={{ color: C.textDim }}>{12 - i * 2}</span>
          </div>
        ))}
      </div>
    );
  }

  // studio
  return (
    <div className="w-full h-full rounded-lg p-3 space-y-2"
      style={{ background: '#080c16', border: `1px solid ${C.border}` }}>
      <div className="flex items-center gap-2 mb-1">
        <div className="w-3 h-3 rounded-sm" style={{ background: C.goldDim }} />
        <div className="h-2 w-24 rounded" style={{ background: 'rgba(255,255,255,0.08)' }} />
      </div>
      <div className="space-y-1.5">
        <div className="h-2 rounded" style={{ background: 'rgba(255,255,255,0.06)', width: '100%' }} />
        <div className="h-2 rounded" style={{ background: 'rgba(255,255,255,0.04)', width: '85%' }} />
        <div className="h-2 rounded" style={{ background: 'rgba(255,255,255,0.04)', width: '92%' }} />
        <div className="h-2 rounded" style={{ background: 'rgba(255,255,255,0.03)', width: '60%' }} />
      </div>
      <div className="flex gap-2 pt-1">
        <div className="h-5 w-14 rounded" style={{ background: C.goldDim }} />
        <div className="h-5 w-10 rounded" style={{ background: 'rgba(255,255,255,0.04)' }} />
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

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {MODULES.map((m, i) => (
            <motion.div key={m.title}
              className="group rounded-xl overflow-hidden transition-all duration-300"
              style={{ background: C.bgCard, border: `1px solid ${C.border}` }}
              initial={{ opacity: 0, y: 20 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: i * 0.08, ease }}
              whileHover={{ borderColor: C.borderLight }}>
              {/* Mockup area */}
              <div className="h-40 p-3">
                <MiniMockup type={m.mockup} />
              </div>
              {/* Text */}
              <div className="p-5 pt-3" style={{ borderTop: `1px solid ${C.border}` }}>
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

/* ═══════════════════════════════════════════════════════════
   VALUE PROPOSITION — "From Data to Understanding"
   ═══════════════════════════════════════════════════════════ */
function ValueSection({ onLogin }: { onLogin: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });

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
          {/* Left — Statement */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
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

            {/* Process flow */}
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

          {/* Right — CTA + Stats */}
          <motion.div
            className="text-center lg:text-left"
            initial={{ opacity: 0, y: 20 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.7, delay: 0.15, ease }}>
            <div className="grid grid-cols-2 gap-6 mb-10">
              {[
                { value: '10x', label: 'Faster Account Research' },
                { value: '73%', label: 'Higher Email Engagement' },
                { value: '3.2x', label: 'Pipeline Velocity' },
                { value: '<2 min', label: 'Signal to Action' },
              ].map((s, i) => (
                <div key={i}>
                  <div className="text-[clamp(1.6rem,3vw,2.2rem)] font-bold tracking-[-0.03em] leading-none mb-1"
                    style={{ color: C.gold }}>{s.value}</div>
                  <div className="text-[12px] font-medium" style={{ color: C.textDim }}>{s.label}</div>
                </div>
              ))}
            </div>
            <button onClick={onLogin}
              className="group inline-flex items-center gap-2.5 px-7 py-3.5 rounded-lg text-[15px] font-semibold transition-all duration-200"
              style={{ background: C.gold, color: '#0A0E1A' }}
              onMouseEnter={e => { e.currentTarget.style.background = C.goldBright; e.currentTarget.style.boxShadow = '0 0 30px rgba(201,168,76,0.2)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = C.gold; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'translateY(0)'; }}>
              <Lock className="w-4 h-4" />
              Enter Private Workspace
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
            </button>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════
   FOOTER
   ═══════════════════════════════════════════════════════════ */
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
        <div className="flex items-center gap-4">
          <button onClick={onLogin} className="text-[12px] font-medium transition-colors hover:text-white"
            style={{ color: C.textDim }}>Workspace</button>
          <span className="text-[11px]" style={{ color: C.textDim }}>
            &copy; {new Date().getFullYear()} DeepMindQ
          </span>
        </div>
      </div>
    </footer>
  );
}

/* ═══════════════════════════════════════════════════════════
   MAIN
   ═══════════════════════════════════════════════════════════ */
interface LandingPageProps { onLogin: () => void; }

export default function LandingPage({ onLogin }: LandingPageProps) {
  const [showLogin, setShowLogin] = useState(false);

  if (showLogin) return <LoginPage onLogin={onLogin} />;

  return (
    <div className="min-h-screen" style={{ background: C.bg, color: C.text }}>
      <Header onLogin={() => setShowLogin(true)} />
      <HeroSection onLogin={() => setShowLogin(true)} />
      <PhilosophySection />
      <FrameworkSection />
      <PlatformSection />
      <ValueSection onLogin={() => setShowLogin(true)} />
      <Footer onLogin={() => setShowLogin(true)} />
    </div>
  );
}