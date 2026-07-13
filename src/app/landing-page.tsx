'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { motion, useScroll, useTransform, useSpring, AnimatePresence, useInView, useMotionValue } from 'framer-motion';
import {
  Eye, EyeOff, Brain, Briefcase, Users, TrendingUp, Globe,
  Search, Lightbulb, Cog, MessageSquare, ArrowRight,
  Target, ShieldCheck, Linkedin, Mail, Phone, BarChart3,
  Crosshair, Handshake, BrainCircuit, Cloud, Database,
  Code2, Layers, Bot, ChevronDown, Menu, X, Zap, Award, MapPin,
} from 'lucide-react';

/* ═══════════════════════════════════════════════════
   Color & Design Tokens
   ═══════════════════════════════════════════════════ */
const C = {
  bg: '#06090F',
  bgAlt: '#080C14',
  gold: '#D4AF37',
  goldLight: '#E8C860',
  goldDim: '#9A8340',
  goldFaint: '#D4AF3715',
  text: '#E8ECF1',
  textMuted: '#7A8699',
  textDim: '#3A4555',
  card: 'rgba(12, 18, 30, 0.6)',
  border: 'rgba(255,255,255,0.06)',
  borderGold: 'rgba(212, 175, 55, 0.25)',
};

const FF = {
  sans: "var(--font-inter), 'Inter', system-ui, sans-serif",
  serif: "var(--font-playfair), 'Playfair Display', Georgia, serif",
  mono: "ui-monospace, 'Cascadia Code', 'Fira Code', monospace",
};

/* ═══════════════════════════════════════════════════
   Page Loader
   ═══════════════════════════════════════════════════ */
function PageLoader({ onComplete }: { onComplete: () => void }) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress(p => {
        if (p >= 100) { clearInterval(interval); return 100; }
        return p + Math.random() * 15 + 5;
      });
    }, 80);
    const timeout = setTimeout(onComplete, 1800);
    return () => { clearInterval(interval); clearTimeout(timeout); };
  }, [onComplete]);

  return (
    <motion.div
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center"
      style={{ background: C.bg }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.6, ease: [0.76, 0, 0.24, 1] }}
    >
      <div className="flex items-center gap-3 mb-10">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center"
          style={{ background: `linear-gradient(135deg, ${C.gold}, ${C.goldLight})` }}>
          <Brain className="w-6 h-6 text-white" />
        </div>
        <span className="text-2xl font-bold tracking-tight" style={{ fontFamily: FF.sans }}>
          DeepMind<span style={{ color: C.gold }}>Q</span>
        </span>
      </div>
      <div className="w-48 h-[2px] rounded-full overflow-hidden" style={{ background: C.border }}>
        <motion.div
          className="h-full rounded-full"
          style={{ background: `linear-gradient(90deg, ${C.gold}, ${C.goldLight})` }}
          animate={{ width: `${Math.min(progress, 100)}%` }}
          transition={{ duration: 0.2 }}
        />
      </div>
      <p
        className="text-xs mt-4 tracking-[0.2em] uppercase"
        style={{ color: C.textDim }}
      >
        Loading intelligence...
      </p>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════
   Scroll Progress Bar
   ═══════════════════════════════════════════════════ */
function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useTransform(scrollYProgress, [0, 0.95], [0, 1]);

  return (
    <motion.div
      className="fixed top-0 left-0 right-0 h-[2px] z-[60] origin-left"
      style={{ scaleX, background: `linear-gradient(90deg, ${C.gold}, ${C.goldLight})` }}
    />
  );
}

/* ═══════════════════════════════════════════════════
   Cursor Glow
   ═══════════════════════════════════════════════════ */
function CursorGlow() {
  const glowRef = useRef<HTMLDivElement>(null);
  const mouseX = useMotionValue(-500);
  const mouseY = useMotionValue(-500);

  useEffect(() => {
    const move = (e: MouseEvent) => {
      mouseX.set(e.clientX);
      mouseY.set(e.clientY);
    };
    window.addEventListener('mousemove', move);
    return () => window.removeEventListener('mousemove', move);
  }, [mouseX, mouseY]);

  return (
    <motion.div
      ref={glowRef}
      className="pointer-events-none fixed top-0 left-0 z-[9999] w-[600px] h-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-[0.04] hidden lg:block"
      style={{
        background: `radial-gradient(circle, ${C.gold} 0%, transparent 70%)`,
        x: mouseX,
        y: mouseY,
        translateX: '-50%',
        translateY: '-50%',
      }}
    />
  );
}

/* ═══════════════════════════════════════════════════
   Grain Overlay
   ═══════════════════════════════════════════════════ */
function GrainOverlay() {
  return (
    <div
      className="pointer-events-none fixed inset-0 z-[100] opacity-[0.025] mix-blend-overlay"
      style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        backgroundRepeat: 'repeat',
        backgroundSize: '200px 200px',
      }}
    />
  );
}

/* ═══════════════════════════════════════════════════
   Animated Gradient Mesh Background
   ═══════════════════════════════════════════════════ */
function GradientMesh() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <motion.div
        className="absolute w-[800px] h-[800px] rounded-full opacity-[0.04] blur-[150px]"
        style={{ background: C.gold, top: '10%', left: '-10%' }}
        animate={{
          x: [0, 80, -40, 0],
          y: [0, -60, 40, 0],
        }}
        transition={{ duration: 25, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute w-[600px] h-[600px] rounded-full opacity-[0.03] blur-[120px]"
        style={{ background: '#3B82F6', bottom: '10%', right: '-5%' }}
        animate={{
          x: [0, -60, 40, 0],
          y: [0, 50, -30, 0],
        }}
        transition={{ duration: 30, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute w-[500px] h-[500px] rounded-full opacity-[0.025] blur-[100px]"
        style={{ background: '#8B5CF6', top: '50%', left: '40%' }}
        animate={{
          x: [0, 40, -50, 0],
          y: [0, -40, 30, 0],
        }}
        transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
      />
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   Shimmer Text
   ═══════════════════════════════════════════════════ */
function ShimmerText({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`relative inline-block ${className}`}>
      <span className="relative z-10">{children}</span>
      <span
        className="absolute inset-0 z-0 animate-[shimmer_3s_ease-in-out_infinite]"
        style={{
          background: `linear-gradient(110deg, ${C.gold} 0%, ${C.goldLight} 40%, #FFF 50%, ${C.goldLight} 60%, ${C.gold} 100%)`,
          backgroundSize: '200% 100%',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}
      >
        {children}
      </span>
    </span>
  );
}

/* ═══════════════════════════════════════════════════
   Split Text Reveal
   ═══════════════════════════════════════════════════ */
function SplitReveal({ text, className = '', delay = 0, stagger = 0.04 }: {
  text: string; className?: string; delay?: number; stagger?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });
  const words = text.split(' ');

  return (
    <div ref={ref} className={`flex flex-wrap ${className}`}>
      {words.map((word, i) => (
        <span key={i} className="overflow-hidden mr-[0.25em]">
          <motion.span
            className="inline-block"
            initial={{ y: '110%' }}
            animate={inView ? { y: 0 } : {}}
            transition={{ duration: 0.6, delay: delay + i * stagger, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            {word}
          </motion.span>
        </span>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   Section Number Watermark
   ═══════════════════════════════════════════════════ */
function SectionNumber({ num }: { num: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-50px' });

  return (
    <motion.div
      ref={ref}
      className="absolute -top-8 -left-4 md:top-0 md:-left-8 select-none pointer-events-none"
      initial={{ opacity: 0, scale: 0.5 }}
      animate={inView ? { opacity: 1, scale: 1 } : {}}
      transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      <span
        className="text-[120px] md:text-[180px] lg:text-[220px] font-black leading-none"
        style={{
          fontFamily: FF.serif,
          color: 'transparent',
          WebkitTextStroke: `1px ${C.borderGold}`,
        }}
      >
        {num}
      </span>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════
   Horizontal Marquee
   ═══════════════════════════════════════════════════ */
function Marquee({ items, speed = 30, reverse = false }: { items: string[]; speed?: number; reverse?: boolean }) {
  const doubled = [...items, ...items];
  return (
    <div className="relative overflow-hidden whitespace-nowrap py-5">
      <div className="absolute left-0 top-0 bottom-0 w-32 z-10" style={{ background: `linear-gradient(90deg, ${C.bg}, transparent)` }} />
      <div className="absolute right-0 top-0 bottom-0 w-32 z-10" style={{ background: `linear-gradient(-90deg, ${C.bg}, transparent)` }} />
      <motion.div
        className="inline-flex gap-16"
        animate={{ x: reverse ? ['0%', '50%'] : ['0%', '-50%'] }}
        transition={{ duration: speed, repeat: Infinity, ease: 'linear' }}
      >
        {doubled.map((item, i) => (
          <span key={i} className="flex items-center gap-16">
            <span className="text-sm font-medium tracking-[0.25em] uppercase" style={{ color: C.textDim }}>
              {item}
            </span>
            <span style={{ color: C.goldDim }}>✦</span>
          </span>
        ))}
      </motion.div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   3D Tilt Card
   ═══════════════════════════════════════════════════ */
function TiltCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotateX = useSpring(0, { stiffness: 200, damping: 20 });
  const rotateY = useSpring(0, { stiffness: 200, damping: 20 });

  const handleMouse = (e: React.MouseEvent) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    rotateX.set(((e.clientY - rect.top - cy) / cy) * -6);
    rotateY.set(((e.clientX - rect.left - cx) / cx) * 6);
    x.set((e.clientX - rect.left - cx) / cx);
    y.set((e.clientY - rect.top - cy) / cy);
  };

  const handleLeave = () => {
    rotateX.set(0);
    rotateY.set(0);
    x.set(0);
    y.set(0);
  };

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouse}
      onMouseLeave={handleLeave}
      style={{ rotateX, rotateY, transformPerspective: 800 }}
      className={className}
    >
      {/* Moving highlight */}
      <motion.div
        className="absolute inset-0 rounded-xl opacity-0 hover:opacity-100 transition-opacity duration-300 pointer-events-none"
        style={{
          background: `radial-gradient(circle at ${50 + x.get() * 30}% ${50 + y.get() * 30}%, ${C.goldFaint}, transparent 60%)`,
        }}
      />
      {children}
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════
   Magnetic Button
   ═══════════════════════════════════════════════════ */
function MagneticButton({ children, onClick, className = '' }: {
  children: React.ReactNode; onClick?: () => void; className?: string;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const x = useSpring(0, { stiffness: 150, damping: 15 });
  const y = useSpring(0, { stiffness: 150, damping: 15 });

  const handleMouse = (e: React.MouseEvent) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    x.set((e.clientX - rect.left - rect.width / 2) * 0.25);
    y.set((e.clientY - rect.top - rect.height / 2) * 0.25);
  };

  return (
    <motion.button
      ref={ref} onClick={onClick} onMouseMove={handleMouse} onMouseLeave={() => { x.set(0); y.set(0); }}
      style={{ x, y }} className={`group relative overflow-hidden ${className}`}
    >
      {children}
    </motion.button>
  );
}

/* ═══════════════════════════════════════════════════
   Animated Stat Counter
   ═══════════════════════════════════════════════════ */
function AnimatedCounter({ target, suffix = '' }: { target: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!inView) return;
    let start = 0;
    const duration = 2000;
    const startTime = Date.now();
    const tick = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      start = Math.round(eased * target);
      setCount(start);
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [inView, target]);

  return <span ref={ref}>{count}{suffix}</span>;
}

function StatCard({ icon: Icon, value, label, countTarget, delay = 0 }: {
  icon: React.ElementType; value: string; label: string; countTarget?: number; delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-50px' });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.7, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="group relative p-5 rounded-xl border transition-all duration-300 hover:border-white/10"
      style={{ background: C.card, borderColor: C.border }}
    >
      <div className="w-12 h-12 rounded-lg flex items-center justify-center mb-4 transition-colors duration-300"
        style={{ background: `${C.gold}12` }}>
        <Icon className="w-5 h-5 transition-colors duration-300" style={{ color: C.gold }} />
      </div>
      <p className="text-3xl md:text-4xl font-bold tabular-nums mb-1" style={{ color: C.gold, fontFamily: FF.sans }}>
        {countTarget !== undefined ? <AnimatedCounter target={countTarget} /> : value}
      </p>
      <p className="text-xs font-medium tracking-wide" style={{ color: C.textMuted }}>{label}</p>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════
   Floating Particles
   ═══════════════════════════════════════════════════ */
function FloatingParticles() {
  const particles = useRef(
    Array.from({ length: 25 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 2.5 + 0.8,
      duration: Math.random() * 25 + 15,
      delay: Math.random() * 10,
      opacity: Math.random() * 0.25 + 0.05,
    }))
  ).current;

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map(p => (
        <motion.div
          key={p.id}
          className="absolute rounded-full"
          style={{ left: `${p.x}%`, top: `${p.y}%`, width: p.size, height: p.size, background: C.gold, opacity: p.opacity }}
          animate={{ y: [0, -50, 0], x: [0, Math.random() * 30 - 15, 0], opacity: [p.opacity, p.opacity * 2.5, p.opacity] }}
          transition={{ duration: p.duration, repeat: Infinity, delay: p.delay, ease: 'easeInOut' }}
        />
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   Section Reveal
   ═══════════════════════════════════════════════════ */
function SectionReveal({ children, delay = 0, className = '' }: {
  children: React.ReactNode; delay?: number; className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });
  return (
    <motion.div ref={ref}
      initial={{ opacity: 0, y: 50 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.9, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════
   MAIN LANDING PAGE
   ═══════════════════════════════════════════════════ */
export default function LandingPage({ onLogin }: { onLogin: () => void }) {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mobileMenu, setMobileMenu] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { setError('Please enter your email and password.'); return; }
    setError(''); setLoading(true);
    setTimeout(() => { setLoading(false); onLogin(); }, 800);
  };

  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress: heroProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] });
  const heroOpacity = useTransform(heroProgress, [0, 0.5], [1, 0]);
  const heroScale = useTransform(heroProgress, [0, 0.5], [1, 0.97]);
  const heroY = useTransform(heroProgress, [0, 0.5], [0, 60]);

  const [showScrollInd, setShowScrollInd] = useState(true);
  useEffect(() => {
    const h = () => setShowScrollInd(window.scrollY < 80);
    window.addEventListener('scroll', h, { passive: true });
    return () => window.removeEventListener('scroll', h);
  }, []);

  return (
    <>
      <AnimatePresence mode="wait">
        {!loaded && <PageLoader onComplete={() => setLoaded(true)} />}
      </AnimatePresence>

      {loaded && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="relative" style={{ background: C.bg, color: C.text, fontFamily: FF.sans }}
        >
          <CursorGlow />
          <GrainOverlay />
          <ScrollProgress />

          {/* ══════ STICKY NAV ══════ */}
          <motion.nav
            initial={{ y: -100 }}
            animate={{ y: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="fixed top-0 left-0 right-0 z-50 border-b"
            style={{ background: 'rgba(6, 9, 15, 0.75)', backdropFilter: 'blur(24px) saturate(1.8)', borderColor: C.border }}
          >
            <div className="max-w-7xl mx-auto flex items-center justify-between px-6 md:px-10 h-16">
              <motion.div className="flex items-center gap-3" whileHover={{ scale: 1.02 }}>
                <div className="w-9 h-9 rounded-lg flex items-center justify-center"
                  style={{ background: `linear-gradient(135deg, ${C.gold}, ${C.goldLight})` }}>
                  <Brain className="w-5 h-5 text-white" />
                </div>
                <span className="text-lg font-bold tracking-tight">
                  DeepMind<span style={{ color: C.gold }}>Q</span>
                </span>
              </motion.div>

              <div className="hidden lg:flex items-center gap-8">
                {['Mission', 'Approach', 'Expertise', 'Framework', 'Technology'].map(item => (
                  <a key={item} href={`#${item.toLowerCase()}`}
                    className="text-[13px] tracking-wide transition-colors duration-200 hover:text-white"
                    style={{ color: C.textMuted }}>
                    {item}
                  </a>
                ))}
              </div>

              <div className="flex items-center gap-4">
                <MagneticButton onClick={() => document.getElementById('login-section')?.scrollIntoView({ behavior: 'smooth' })}>
                  <span className="relative z-10 inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold"
                    style={{ background: `linear-gradient(135deg, ${C.gold}, ${C.goldLight})`, color: C.bg }}>
                    Access Workspace <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </MagneticButton>
                <button className="lg:hidden text-white" onClick={() => setMobileMenu(!mobileMenu)}>
                  {mobileMenu ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <AnimatePresence>
              {mobileMenu && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3 }}
                  className="lg:hidden overflow-hidden border-t" style={{ background: 'rgba(6, 9, 15, 0.95)', borderColor: C.border }}>
                  <div className="px-6 py-4 space-y-3">
                    {['Mission', 'Approach', 'Expertise', 'Framework', 'Technology'].map(item => (
                      <a key={item} href={`#${item.toLowerCase()}`} onClick={() => setMobileMenu(false)}
                        className="block text-sm py-2 transition-colors hover:text-white" style={{ color: C.textMuted }}>{item}</a>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.nav>

          {/* ══════ HERO ══════ */}
          <motion.div ref={heroRef} className="relative min-h-screen flex items-center justify-center overflow-hidden"
            style={{ opacity: heroOpacity, scale: heroScale }}>
            <GradientMesh />
            <FloatingParticles />

            <div className="relative z-10 max-w-7xl mx-auto px-6 md:px-10 pt-24 pb-16 w-full">
              <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-16 lg:gap-20 items-center">

                {/* Left */}
                <div>
                  <motion.p
                    initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.3 }}
                    className="text-sm tracking-[0.35em] uppercase mb-8 font-medium" style={{ color: C.gold }}
                  >
                    Enterprise Growth Leader
                  </motion.p>

                  {/* Large Name - Serif */}
                  <div className="overflow-hidden mb-2">
                    <motion.h1
                      initial={{ y: '120%' }} animate={{ y: 0 }}
                      transition={{ duration: 1, delay: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
                      className="text-[3.5rem] md:text-[5.5rem] lg:text-[7rem] font-bold tracking-tight leading-[0.9]"
                      style={{ fontFamily: FF.serif }}
                    >
                      Ravi
                    </motion.h1>
                  </div>
                  <div className="overflow-hidden mb-8">
                    <motion.h1
                      initial={{ y: '120%' }} animate={{ y: 0 }}
                      transition={{ duration: 1, delay: 0.55, ease: [0.25, 0.46, 0.45, 0.94] }}
                      className="text-[3.5rem] md:text-[5.5rem] lg:text-[7rem] font-bold tracking-tight leading-[0.9]"
                      style={{ fontFamily: FF.serif, color: C.gold }}
                    >
                      <ShimmerText>Shanker</ShimmerText>
                    </motion.h1>
                  </div>

                  <motion.div initial={{ scaleX: 0 }} animate={{ scaleX: 1 }}
                    transition={{ duration: 1, delay: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
                    className="h-px w-36 mb-8 origin-left"
                    style={{ background: `linear-gradient(90deg, ${C.gold}, transparent)` }} />

                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    transition={{ duration: 0.8, delay: 0.9 }} className="flex flex-wrap gap-3 mb-8">
                    {['AI', 'Digital Transformation', 'Strategic Sales'].map((tag, i) => (
                      <motion.span key={tag} initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5, delay: 0.9 + i * 0.1 }}
                        className="px-4 py-2 rounded-full text-sm font-medium border"
                        style={{ color: C.gold, borderColor: C.borderGold, background: `${C.gold}08` }}>
                        {tag}
                      </motion.span>
                    ))}
                  </motion.div>

                  <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 1.0 }}
                    className="text-base md:text-lg leading-[1.8] max-w-lg mb-12" style={{ color: C.textMuted }}>
                    Driving enterprise revenue through AI-powered intelligence, strategic CXO engagement,
                    and technology-led transformation across global markets.
                  </motion.p>

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-4">
                    <StatCard icon={Briefcase} value="15+" label="Years Experience" countTarget={15} delay={1.1} />
                    <StatCard icon={Users} value="100+" label="CXO Relationships" countTarget={100} delay={1.2} />
                    <StatCard icon={TrendingUp} value="$5M+" label="Revenue Generated" countTarget={5} delay={1.3} />
                    <StatCard icon={Globe} value="Global" label="India • Middle East" delay={1.4} />
                  </div>
                </div>

                {/* Right: Login */}
                <motion.div
                  id="login-section"
                  initial={{ opacity: 0, x: 80, rotateY: -8 }}
                  animate={{ opacity: 1, x: 0, rotateY: 0 }}
                  transition={{ duration: 1.2, delay: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
                  className="lg:sticky lg:top-24"
                >
                  <div className="rounded-2xl p-8 md:p-10 border relative overflow-hidden"
                    style={{ background: 'rgba(10, 15, 24, 0.6)', backdropFilter: 'blur(30px) saturate(1.5)', borderColor: C.border }}>
                    <div className="absolute -top-20 -right-20 w-40 h-40 rounded-full opacity-10 blur-[60px]" style={{ background: C.gold }} />
                    <div className="absolute -bottom-16 -left-16 w-32 h-32 rounded-full opacity-[0.05] blur-[50px]" style={{ background: '#3B82F6' }} />

                    <div className="relative z-10">
                      <p className="text-xs tracking-[0.3em] uppercase mb-3" style={{ color: C.gold }}>Secure Access</p>
                      <h2 className="text-2xl font-bold text-white mb-1">My Workspace</h2>
                      <p className="text-sm mb-8" style={{ color: C.textMuted }}>Enter credentials to continue</p>

                      <div className="h-px w-full mb-8" style={{ background: `linear-gradient(90deg, ${C.gold}30, transparent)` }} />

                      <form onSubmit={handleLogin} className="space-y-5">
                        <div className="space-y-2">
                          <Label htmlFor="email" className="text-xs tracking-[0.2em] uppercase font-medium" style={{ color: C.textMuted }}>Email</Label>
                          <Input id="email" type="email" placeholder="your@email.com"
                            value={email} onChange={e => { setEmail(e.target.value); setError(''); }}
                            className="h-12 border-white/[0.08] text-white placeholder:text-zinc-700 focus:border-[#D4AF37] focus:ring-[#D4AF37]/20 rounded-lg text-sm"
                            style={{ background: 'rgba(255,255,255,0.03)' }} />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="password" className="text-xs tracking-[0.2em] uppercase font-medium" style={{ color: C.textMuted }}>Password</Label>
                          <div className="relative">
                            <Input id="password" type={showPassword ? 'text' : 'password'} placeholder="Enter password"
                              value={password} onChange={e => { setPassword(e.target.value); setError(''); }}
                              className="h-12 border-white/[0.08] text-white placeholder:text-zinc-700 pr-12 focus:border-[#D4AF37] focus:ring-[#D4AF37]/20 rounded-lg text-sm"
                              style={{ background: 'rgba(255,255,255,0.03)' }} />
                            <button type="button" onClick={() => setShowPassword(!showPassword)}
                              className="absolute right-4 top-1/2 -translate-y-1/2 transition-colors hover:text-white" style={{ color: C.textDim }}>
                              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Checkbox id="remember" checked={remember} onCheckedChange={(v) => setRemember(v === true)}
                            className="border-zinc-700 data-[state=checked]:bg-[#D4AF37] data-[state=checked]:border-[#D4AF37]" />
                          <Label htmlFor="remember" className="text-xs cursor-pointer" style={{ color: C.textMuted }}>Remember me</Label>
                        </div>
                        {error && (
                          <motion.p initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }}
                            className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">{error}</motion.p>
                        )}
                        <MagneticButton className="w-full">
                          <button type="submit" disabled={loading}
                            className="w-full h-12 text-sm font-bold rounded-lg transition-all relative overflow-hidden"
                            style={{ background: loading ? C.goldDim : `linear-gradient(135deg, ${C.gold}, ${C.goldLight})`, color: C.bg }}>
                            {loading ? <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" /> : 'LOGIN TO DEEPMINDQ'}
                          </button>
                        </MagneticButton>
                        <p className="text-[10px] text-center" style={{ color: C.textDim }}>
                          Secured with enterprise-grade encryption
                        </p>
                      </form>
                    </div>
                  </div>
                </motion.div>
              </div>
            </div>

            {/* Scroll Indicator */}
            <AnimatePresence>
              {showScrollInd && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ delay: 2 }}
                  className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3 cursor-pointer"
                  onClick={() => document.getElementById('mission')?.scrollIntoView({ behavior: 'smooth' })}>
                  <span className="text-[10px] tracking-[0.3em] uppercase" style={{ color: C.textDim }}>Scroll to explore</span>
                  <motion.div animate={{ y: [0, 8, 0] }} transition={{ duration: 1.5, repeat: Infinity }}>
                    <ChevronDown className="w-4 h-4" style={{ color: C.gold }} />
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* ══════ MARQUEE 1 ══════ */}
          <div className="relative py-1 border-y" style={{ borderColor: C.border, background: C.bg }}>
            <Marquee items={['Enterprise Sales', 'AI Strategy', 'CXO Engagement', 'Digital Transformation', 'Revenue Growth', 'Cloud Solutions', 'Data Analytics', 'Strategic Consulting']} speed={40} />
          </div>

          {/* ══════ MISSION ══════ */}
          <section id="mission" className="relative min-h-screen flex items-center py-32 md:py-40 px-6 md:px-10 overflow-hidden" style={{ background: C.bgAlt }}>
            <SectionNumber num="01" />
            <div className="max-w-6xl mx-auto w-full relative z-10">
              <div className="grid lg:grid-cols-2 gap-16 lg:gap-24 items-center">
                <SectionReveal>
                  <div className="space-y-6">
                    <p className="text-sm tracking-[0.35em] uppercase font-medium" style={{ color: C.gold }}>Mission</p>
                    <div className="overflow-hidden">
                      <h2 className="text-4xl md:text-5xl lg:text-[3.5rem] font-bold tracking-tight leading-[1.1]" style={{ fontFamily: FF.serif }}>
                        Bridging Technology
                      </h2>
                    </div>
                    <div className="overflow-hidden">
                      <h2 className="text-4xl md:text-5xl lg:text-[3.5rem] font-bold tracking-tight leading-[1.1]" style={{ fontFamily: FF.serif, color: C.gold }}>
                        &amp; Business
                      </h2>
                    </div>
                    <motion.div initial={{ scaleX: 0 }} whileInView={{ scaleX: 1 }} viewport={{ once: true }}
                      transition={{ duration: 0.8 }} className="h-px w-24 origin-left"
                      style={{ background: `linear-gradient(90deg, ${C.gold}, transparent)` }} />
                  </div>
                </SectionReveal>

                <SectionReveal delay={0.2}>
                  <div className="space-y-6">
                    <p className="text-lg leading-[1.8]" style={{ color: C.textMuted }}>
                      To bridge the gap between cutting-edge technology capabilities and enterprise business
                      outcomes. I build deep, trust-based relationships with C-suite executives and translate
                      complex AI &amp; digital solutions into tangible revenue growth, operational efficiency,
                      and strategic advantage for organizations across industries and geographies.
                    </p>
                    <p className="text-lg leading-[1.8]" style={{ color: C.textMuted }}>
                      Every enterprise has untapped potential hidden in its data, processes, and people.
                      My role is to find it, frame it, and deliver it as measurable business value through
                      the right technology and the right conversations at the right time.
                    </p>
                    <div className="flex items-center gap-5 pt-6">
                      <div className="w-14 h-14 rounded-full flex items-center justify-center border-2" style={{ borderColor: C.borderGold, background: `${C.gold}08` }}>
                        <Target className="w-6 h-6" style={{ color: C.gold }} />
                      </div>
                      <div>
                        <p className="font-semibold text-white text-lg">Results-Driven</p>
                        <p className="text-sm" style={{ color: C.textMuted }}>Every engagement tied to measurable outcomes</p>
                      </div>
                    </div>
                  </div>
                </SectionReveal>
              </div>
            </div>
          </section>

          {/* ══════ MARQUEE 2 ══════ */}
          <div className="py-1 border-y" style={{ borderColor: C.border, background: C.bg }}>
            <Marquee items={['$5M+ Revenue', '15+ Years', '100+ CXOs', 'Global Markets', 'AI-Powered', 'Enterprise Grade', 'Trust-Based', 'Outcome Focused']} speed={28} reverse />
          </div>

          {/* ══════ APPROACH ══════ */}
          <section id="approach" className="relative py-32 md:py-40 px-6 md:px-10 overflow-hidden">
            <SectionNumber num="02" />
            <div className="max-w-6xl mx-auto w-full relative z-10">
              <SectionReveal>
                <div className="text-center mb-24">
                  <p className="text-sm tracking-[0.35em] uppercase font-medium mb-4" style={{ color: C.gold }}>Approach</p>
                  <SplitReveal text="Intelligence-Driven Methodology" className="justify-center text-4xl md:text-5xl lg:text-[3.5rem] font-bold tracking-tight" />
                </div>
              </SectionReveal>

              <div className="relative">
                <div className="absolute left-5 md:left-1/2 top-0 bottom-0 w-px md:-translate-x-px"
                  style={{ background: `linear-gradient(180deg, transparent, ${C.borderGold}, ${C.borderGold}, transparent)` }} />

                {[
                  { icon: Search, step: '01', title: 'Understand the Business', desc: 'Deep-dive into operations, pain points, strategic goals, and competitive landscape to identify real opportunities that others miss.' },
                  { icon: Lightbulb, step: '02', title: 'Identify Strategic Opportunities', desc: 'Map technology capabilities to business challenges, uncovering high-impact areas where AI creates measurable value.' },
                  { icon: Cog, step: '03', title: 'Align Technology Capabilities', desc: 'Match the right solutions — AI, cloud, analytics — to each opportunity, ensuring technical feasibility and business alignment.' },
                  { icon: MessageSquare, step: '04', title: 'Create Executive Conversations', desc: 'Craft compelling, value-driven narratives tailored for C-suite decision makers that resonate with their strategic priorities.' },
                  { icon: TrendingUp, step: '05', title: 'Drive Revenue Outcomes', desc: 'Convert relationships into closed deals through consultative selling, proof-of-value engagements, and long-term partnerships.' },
                ].map((item, i) => (
                  <TimelineCard key={item.step} item={item} index={i} />
                ))}
              </div>
            </div>
          </section>

          {/* ══════ EXPERTISE (Horizontal Scroll) ══════ */}
          <section id="expertise" className="relative py-32 md:py-40 overflow-hidden" style={{ background: C.bgAlt }}>
            <SectionNumber num="03" />
            <div className="max-w-6xl mx-auto px-6 md:px-10 relative z-10 mb-16">
              <SectionReveal>
                <p className="text-sm tracking-[0.35em] uppercase font-medium mb-4" style={{ color: C.gold }}>Expertise</p>
                <SplitReveal text="What I Bring" className="text-4xl md:text-5xl lg:text-[3.5rem] font-bold tracking-tight" />
              </SectionReveal>
            </div>

            <div className="relative">
              <div className="absolute left-0 top-0 bottom-0 w-20 z-10" style={{ background: `linear-gradient(90deg, ${C.bgAlt}, transparent)` }} />
              <div className="absolute right-0 top-0 bottom-0 w-20 z-10" style={{ background: `linear-gradient(-90deg, ${C.bgAlt}, transparent)` }} />

              <div className="flex gap-6 overflow-x-auto px-6 md:px-10 pb-6 snap-x snap-mandatory scrollbar-hide"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                {[
                  { icon: Users, title: 'Enterprise Sales Leadership', desc: 'Leading complex, multi-stakeholder sales cycles from qualification to close with strategic precision and executive alignment.' },
                  { icon: MessageSquare, title: 'CXO Engagement', desc: 'Building trusted advisor relationships with C-level executives through insight-led conversations that demonstrate deep understanding of their world.' },
                  { icon: BarChart3, title: 'Strategic Account Growth', desc: 'Expanding revenue within existing accounts through cross-sell, upsell, and deepening multi-threaded engagement across the C-suite.' },
                  { icon: Handshake, title: 'Complex Deal Management', desc: 'Navigating procurement, legal, and technical evaluations to drive large enterprise deals from initial proposal to final signature.' },
                  { icon: BrainCircuit, title: 'AI & Digital Transformation', desc: 'Advising enterprises on AI adoption strategy, digital roadmaps, and technology-enabled business transformation at scale.' },
                  { icon: Globe, title: 'Global Market Expansion', desc: 'Extending enterprise reach across India, Middle East, and beyond with culturally aware go-to-market strategies and local partnerships.' },
                  { icon: Zap, title: 'Revenue Operations', desc: 'Designing repeatable, scalable revenue processes that align marketing, sales, and customer success for predictable growth.' },
                  { icon: Award, title: 'Thought Leadership', desc: 'Creating executive positioning through insights, whitepapers, and strategic content that establishes credibility before the first meeting.' },
                ].map((item, i) => (
                  <TiltCard key={item.title} className="shrink-0 w-[340px] md:w-[380px] snap-start">
                    <div className="p-7 rounded-xl border h-full relative overflow-hidden"
                      style={{ background: C.card, borderColor: C.border }}>
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-5" style={{ background: `${C.gold}12` }}>
                        <item.icon className="w-6 h-6" style={{ color: C.gold }} />
                      </div>
                      <h3 className="text-lg font-semibold text-white mb-3 leading-tight">{item.title}</h3>
                      <p className="text-sm leading-[1.7]" style={{ color: C.textMuted }}>{item.desc}</p>
                      <div className="absolute bottom-0 left-0 right-0 h-px"
                        style={{ background: `linear-gradient(90deg, transparent, ${C.borderGold}, transparent)` }} />
                    </div>
                  </TiltCard>
                ))}
              </div>
            </div>
          </section>

          {/* ══════ FRAMEWORK ══════ */}
          <section id="framework" className="relative py-32 md:py-40 px-6 md:px-10 overflow-hidden">
            <SectionNumber num="04" />
            <div className="max-w-5xl mx-auto w-full relative z-10">
              <SectionReveal>
                <div className="text-center mb-24">
                  <p className="text-sm tracking-[0.35em] uppercase font-medium mb-4" style={{ color: C.gold }}>Framework</p>
                  <div className="overflow-hidden">
                    <h2 className="text-4xl md:text-5xl lg:text-[3.5rem] font-bold tracking-tight" style={{ fontFamily: FF.serif }}>
                      The DeepMind<span style={{ color: C.gold }}>Q</span> System
                    </h2>
                  </div>
                  <p className="text-base mt-5 max-w-lg mx-auto leading-relaxed" style={{ color: C.textMuted }}>
                    An intelligence-driven engine for enterprise sales acceleration
                  </p>
                </div>
              </SectionReveal>

              <FrameworkVisual />
            </div>
          </section>

          {/* ══════ TECHNOLOGY ══════ */}
          <section id="technology" className="relative py-32 md:py-40 px-6 md:px-10 overflow-hidden" style={{ background: C.bgAlt }}>
            <SectionNumber num="05" />
            <div className="max-w-6xl mx-auto w-full relative z-10">
              <SectionReveal>
                <div className="text-center mb-20">
                  <p className="text-sm tracking-[0.35em] uppercase font-medium mb-4" style={{ color: C.gold }}>Technology</p>
                  <SplitReveal text="Solution Focus" className="justify-center text-4xl md:text-5xl lg:text-[3.5rem] font-bold tracking-tight" />
                </div>
              </SectionReveal>

              <div className="grid grid-cols-2 md:grid-cols-5 gap-5">
                {[
                  { icon: Bot, title: 'AI & Automation', desc: 'ML, NLP, Computer Vision', color: '#3B82F6' },
                  { icon: Cloud, title: 'Cloud & Infrastructure', desc: 'AWS, Azure, GCP', color: '#8B5CF6' },
                  { icon: Database, title: 'Data & Analytics', desc: 'BI, Data Lakes, Real-time', color: '#6366F1' },
                  { icon: Code2, title: 'Digital Engineering', desc: 'Full-stack, APIs, Microservices', color: '#A855F7' },
                  { icon: Layers, title: 'Enterprise Applications', desc: 'ERP, CRM, HCM', color: '#10B981' },
                ].map((item, i) => (
                  <SectionReveal key={item.title} delay={i * 0.08}>
                    <TiltCard>
                      <div className="p-6 rounded-xl border text-center relative overflow-hidden h-full"
                        style={{ background: C.card, borderColor: C.border }}>
                        <div className="w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-5"
                          style={{ background: `${item.color}12` }}>
                          <item.icon className="w-7 h-7" style={{ color: item.color }} />
                        </div>
                        <h3 className="text-sm font-semibold text-white mb-1">{item.title}</h3>
                        <p className="text-xs" style={{ color: C.textDim }}>{item.desc}</p>
                      </div>
                    </TiltCard>
                  </SectionReveal>
                ))}
              </div>
            </div>
          </section>

          {/* ══════ QUOTE / CTA ══════ */}
          <section className="relative min-h-[80vh] flex items-center py-32 md:py-40 px-6 md:px-10 overflow-hidden">
            <GradientMesh />
            <div className="max-w-3xl mx-auto text-center w-full relative z-10">
              <SectionReveal>
                <div className="space-y-10">
                  <motion.div className="text-7xl md:text-8xl leading-none" style={{ color: `${C.gold}20`, fontFamily: FF.serif }}
                    initial={{ opacity: 0, scale: 0.5, rotate: -10 }} whileInView={{ opacity: 1, scale: 1, rotate: 0 }}
                    viewport={{ once: true }} transition={{ duration: 0.8 }}>
                    &ldquo;
                  </motion.div>

                  <blockquote className="text-xl md:text-2xl lg:text-3xl leading-[1.6] font-light" style={{ fontFamily: FF.serif, color: C.text }}>
                    Every enterprise has untapped potential. My role is to find it, frame it,
                    and deliver it as{' '}
                    <span className="font-medium" style={{ color: C.gold }}>measurable business value</span>.
                  </blockquote>

                  <div className="space-y-2">
                    <p className="text-2xl font-bold" style={{ color: C.gold, fontFamily: FF.serif }}>Ravi Shanker</p>
                    <p className="text-sm tracking-wide" style={{ color: C.textMuted }}>Enterprise Growth Leader</p>
                  </div>

                  <div className="flex items-center justify-center gap-3 pt-4">
                    <ShieldCheck className="w-5 h-5" style={{ color: C.gold }} />
                    <span className="text-sm font-medium tracking-[0.2em]" style={{ color: C.textMuted }}>
                      PRIVATE &middot; FOCUSED &middot; RESULTS DRIVEN
                    </span>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-8">
                    <MagneticButton onClick={() => document.getElementById('login-section')?.scrollIntoView({ behavior: 'smooth' })}>
                      <div className="flex items-center gap-2 px-8 py-4 rounded-lg text-sm font-bold"
                        style={{ background: `linear-gradient(135deg, ${C.gold}, ${C.goldLight})`, color: C.bg }}>
                        Access Workspace <ArrowRight className="w-4 h-4" />
                      </div>
                    </MagneticButton>
                    <a href="mailto:contact@deepmindq.com"
                      className="flex items-center gap-2 px-8 py-4 rounded-lg text-sm font-medium border transition-all duration-300 hover:bg-white/5"
                      style={{ borderColor: C.border, color: C.textMuted }}>
                      <Mail className="w-4 h-4" /> Get in Touch
                    </a>
                  </div>
                </div>
              </SectionReveal>
            </div>
          </section>

          {/* ══════ FOOTER ══════ */}
          <footer className="py-12 px-6 md:px-10 border-t" style={{ borderColor: C.border, background: C.bg }}>
            <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background: `linear-gradient(135deg, ${C.gold}, ${C.goldLight})` }}>
                  <Brain className="w-4 h-4 text-white" />
                </div>
                <span className="text-sm font-bold" style={{ fontFamily: FF.sans }}>DeepMind<span style={{ color: C.gold }}>Q</span></span>
              </div>

              <div className="flex items-center gap-8">
                {[
                  { icon: Mail, label: 'contact@deepmindq.com', href: 'mailto:contact@deepmindq.com' },
                  { icon: Linkedin, label: 'LinkedIn', href: 'https://linkedin.com' },
                  { icon: Phone, label: '+91 9030858057', href: 'tel:+919030858057' },
                  { icon: MapPin, label: 'India • Saudi Arabia', href: '#' },
                ].map(link => (
                  <a key={link.label} href={link.href} target={link.href.startsWith('http') ? '_blank' : undefined}
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-xs transition-colors duration-200 hover:text-white group"
                    style={{ color: C.textDim }}>
                    <link.icon className="w-3.5 h-3.5 group-hover:text-[#D4AF37] transition-colors duration-200" />
                    <span className="hidden md:inline">{link.label}</span>
                  </a>
                ))}
              </div>

              <p className="text-xs" style={{ color: C.textDim }}>
                &copy; 2026 DeepMindQ. Built with intelligence.
              </p>
            </div>
          </footer>
        </motion.div>
      )}
    </>
  );
}

/* ═══════════════════════════════════════════════════
   Timeline Card
   ═══════════════════════════════════════════════════ */
function TimelineCard({ item, index }: { item: { icon: React.ElementType; step: string; title: string; desc: string }; index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });
  const isLeft = index % 2 === 0;
  const Icon = item.icon;

  return (
    <motion.div ref={ref}
      initial={{ opacity: 0, x: isLeft ? -50 : 50 }}
      animate={inView ? { opacity: 1, x: 0 } : {}}
      transition={{ duration: 0.7, delay: index * 0.1, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={`relative flex items-start gap-8 mb-20 pl-14 md:pl-0 ${isLeft ? 'md:flex-row' : 'md:flex-row-reverse'}`}
    >
      <div className="absolute left-3 md:left-1/2 top-1 w-8 h-8 rounded-full flex items-center justify-center z-10 md:-translate-x-1/2"
        style={{ background: C.bg, border: `2px solid ${C.gold}`, boxShadow: `0 0 25px ${C.gold}30` }}>
        <div className="w-2.5 h-2.5 rounded-full" style={{ background: C.gold }} />
      </div>

      <div className={`flex-1 md:w-[calc(50%-48px)] ${isLeft ? 'md:pr-16 md:text-right' : 'md:pl-16'}`}>
        <TiltCard>
          <div className={`p-7 rounded-xl border transition-all duration-300 hover:border-white/10 ${
            isLeft ? 'md:ml-auto' : 'md:mr-auto'}`} style={{ background: C.card, borderColor: C.border, maxWidth: '460px' }}>
            <div className={`flex items-center gap-3 mb-4 ${isLeft ? 'md:justify-end' : ''}`}>
              <div className="w-11 h-11 rounded-lg flex items-center justify-center" style={{ background: `${C.gold}12` }}>
                <Icon className="w-5 h-5" style={{ color: C.gold }} />
              </div>
              <span className="text-xs font-bold tracking-[0.2em]" style={{ color: C.goldDim, fontFamily: FF.mono }}>{item.step}</span>
            </div>
            <h3 className="text-lg font-semibold text-white mb-3">{item.title}</h3>
            <p className="text-sm leading-[1.7]" style={{ color: C.textMuted }}>{item.desc}</p>
          </div>
        </TiltCard>
      </div>
      <div className="hidden md:block flex-1" />
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════
   Framework Visual
   ═══════════════════════════════════════════════════ */
function FrameworkVisual() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });
  const [hoveredNode, setHoveredNode] = useState<number | null>(null);

  const nodes = [
    { icon: Search, label: 'Research & Intelligence', angle: -90, color: '#3B82F6' },
    { icon: Crosshair, label: 'Opportunity Mapping', angle: -18, color: '#8B5CF6' },
    { icon: Users, label: 'Executive Engagement', angle: 54, color: '#10B981' },
    { icon: MessageSquare, label: 'Value Conversations', angle: 126, color: '#F59E0B' },
    { icon: TrendingUp, label: 'Revenue Acceleration', angle: 198, color: '#EF4444' },
  ];

  return (
    <motion.div ref={ref} initial={{ opacity: 0, scale: 0.85 }} animate={inView ? { opacity: 1, scale: 1 } : {}}
      transition={{ duration: 1, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="relative flex items-center justify-center py-16">
      <svg className="absolute w-[300px] h-[300px] md:w-[450px] md:h-[450px]" viewBox="0 0 450 450">
        <circle cx="225" cy="225" r="195" fill="none" stroke={C.border} strokeWidth="1" strokeDasharray="8 6" />
        <motion.circle cx="225" cy="225" r="195" fill="none" stroke={C.gold} strokeWidth="1.5"
          strokeDasharray="40 300" strokeLinecap="round"
          initial={{ rotate: 0 }} animate={{ rotate: 360 }}
          transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
          style={{ transformOrigin: '225px 225px' }} />
        {/* Connection lines to nodes */}
        {nodes.map((node, i) => {
          const rad = (node.angle * Math.PI) / 180;
          const r = 195;
          return (
            <motion.line key={i} x1="225" y1="225"
              x2={225 + r * Math.cos(rad)} y2={225 + r * Math.sin(rad)}
              stroke={hoveredNode === i ? node.color : C.border}
              strokeWidth={hoveredNode === i ? 1.5 : 0.5}
              strokeDasharray="4 4"
              initial={{ pathLength: 0 }} animate={inView ? { pathLength: 1 } : {}}
              transition={{ duration: 0.8, delay: 0.3 + i * 0.12 }} />
          );
        })}
      </svg>

      <motion.div
        className="relative z-10 w-28 h-28 md:w-32 md:h-32 rounded-full flex items-center justify-center"
        style={{ background: `linear-gradient(135deg, ${C.gold}, ${C.goldLight})`, boxShadow: `0 0 80px ${C.gold}30` }}
        whileHover={{ scale: 1.1 }}
        animate={{ boxShadow: [`0 0 60px ${C.gold}25`, `0 0 100px ${C.gold}40`, `0 0 60px ${C.gold}25`] }}
        transition={{ boxShadow: { duration: 3, repeat: Infinity } }}>
        <Brain className="w-14 h-14 md:w-16 md:h-16 text-white" />
      </motion.div>

      {nodes.map((node, i) => {
        const rad = (node.angle * Math.PI) / 180;
        const r = 195;
        const cx = 225 + r * Math.cos(rad);
        const cy = 225 + r * Math.sin(rad);
        const Icon = node.icon;
        return (
          <motion.div key={node.label}
            className="absolute flex flex-col items-center gap-2 text-center z-10"
            style={{ left: `${(cx / 450) * 100}%`, top: `${(cy / 450) * 100}%` }}
            initial={{ opacity: 0, scale: 0 }} animate={inView ? { opacity: 1, scale: 1 } : {}}
            transition={{ duration: 0.6, delay: 0.3 + i * 0.12 }}
            onMouseEnter={() => setHoveredNode(i)} onMouseLeave={() => setHoveredNode(null)}>
            <motion.div
              className="w-14 h-14 md:w-16 md:h-16 rounded-full flex items-center justify-center border-2 cursor-pointer transition-shadow duration-300"
              style={{
                background: hoveredNode === i ? `${node.color}25` : `${node.color}10`,
                borderColor: hoveredNode === i ? node.color : `${node.color}50`,
                boxShadow: hoveredNode === i ? `0 0 30px ${node.color}40` : 'none',
              }}
              whileHover={{ scale: 1.15 }}>
              <Icon className="w-6 h-6" style={{ color: node.color }} />
            </motion.div>
            <span className="text-[10px] md:text-[11px] font-medium max-w-[90px] leading-tight"
              style={{ color: hoveredNode === i ? C.text : C.textMuted }}>
              {node.label}
            </span>
          </motion.div>
        );
      })}
    </motion.div>
  );
}