'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { motion, useScroll, useTransform, useSpring, AnimatePresence, useInView } from 'framer-motion';
import {
  Eye, EyeOff, Brain, Briefcase, Users, TrendingUp, Globe,
  Search, Lightbulb, Cog, MessageSquare, ArrowRight, ArrowDown,
  Target, ShieldCheck, Linkedin, Mail, Phone, BarChart3,
  Crosshair, Handshake, BrainCircuit, Cloud, Database,
  Code2, Layers, Bot, ChevronDown, Menu, X,
} from 'lucide-react';

/* ═══════════════════════════════════════════════════
   Color & Design Tokens
   ═══════════════════════════════════════════════════ */
const C = {
  bg: '#06090F',
  bgAlt: '#0A0F18',
  gold: '#D4AF37',
  goldLight: '#E8C860',
  goldDim: '#9A8340',
  text: '#E8ECF1',
  textMuted: '#6B7A8D',
  textDim: '#3A4555',
  card: 'rgba(12, 18, 30, 0.6)',
  border: 'rgba(255,255,255,0.06)',
  borderGold: 'rgba(212, 175, 55, 0.2)',
};

/* ═══════════════════════════════════════════════════
   Custom Cursor Glow
   ═══════════════════════════════════════════════════ */
function CursorGlow() {
  const glowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const move = (e: MouseEvent) => {
      if (glowRef.current) {
        glowRef.current.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
      }
    };
    window.addEventListener('mousemove', move);
    return () => window.removeEventListener('mousemove', move);
  }, []);

  return (
    <div
      ref={glowRef}
      className="pointer-events-none fixed top-0 left-0 z-[9999] w-[500px] h-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-[0.035] hidden lg:block"
      style={{
        background: `radial-gradient(circle, ${C.gold} 0%, transparent 70%)`,
        transition: 'transform 0.15s ease-out',
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
      className="pointer-events-none fixed inset-0 z-[100] opacity-[0.03]"
      style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E")`,
        backgroundRepeat: 'repeat',
        backgroundSize: '180px 180px',
      }}
    />
  );
}

/* ═══════════════════════════════════════════════════
   Horizontal Marquee
   ═══════════════════════════════════════════════════ */
function Marquee({ items, speed = 30 }: { items: string[]; speed?: number }) {
  const doubled = [...items, ...items];
  return (
    <div className="relative overflow-hidden whitespace-nowrap py-4">
      {/* Fade edges */}
      <div className="absolute left-0 top-0 bottom-0 w-32 z-10" style={{ background: `linear-gradient(90deg, ${C.bg}, transparent)` }} />
      <div className="absolute right-0 top-0 bottom-0 w-32 z-10" style={{ background: `linear-gradient(-90deg, ${C.bg}, transparent)` }} />
      <motion.div
        className="inline-flex gap-12"
        animate={{ x: ['0%', '-50%'] }}
        transition={{ duration: speed, repeat: Infinity, ease: 'linear' }}
      >
        {doubled.map((item, i) => (
          <span key={i} className="text-sm font-medium tracking-widest uppercase" style={{ color: C.textMuted }}>
            {item}
            <span className="ml-12" style={{ color: C.goldDim }}>◆</span>
          </span>
        ))}
      </motion.div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   Parallax Section Wrapper
   ═══════════════════════════════════════════════════ */
function ParallaxSection({ children, className = '', offset = 0.15, id }: {
  children: React.ReactNode; className?: string; offset?: number; id?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const y = useTransform(scrollYProgress, [0, 1], [offset * 100, -offset * 100]);
  const opacity = useTransform(scrollYProgress, [0, 0.2, 0.8, 1], [0, 1, 1, 0]);

  return (
    <motion.section
      id={id}
      ref={ref}
      className={`relative ${className}`}
      style={{ opacity }}
    >
      <motion.div style={{ y }}>
        {children}
      </motion.div>
    </motion.section>
  );
}

/* ═══════════════════════════════════════════════════
   Animated Counter
   ═══════════════════════════════════════════════════ */
function AnimatedStat({ icon: Icon, value, label, delay = 0 }: {
  icon: React.ElementType; value: string; label: string; delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-50px' });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.7, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="flex items-center gap-4 p-4 rounded-xl border transition-colors hover:border-white/10"
      style={{ background: C.card, borderColor: C.border }}
    >
      <div className="w-12 h-12 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${C.gold}12` }}>
        <Icon className="w-5 h-5" style={{ color: C.gold }} />
      </div>
      <div>
        <p className="text-2xl md:text-3xl font-bold tabular-nums" style={{ color: C.gold }}>{value}</p>
        <p className="text-xs mt-0.5" style={{ color: C.textMuted }}>{label}</p>
      </div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════
   Floating Particles
   ═══════════════════════════════════════════════════ */
function FloatingParticles() {
  const particles = Array.from({ length: 30 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 3 + 1,
    duration: Math.random() * 20 + 15,
    delay: Math.random() * 10,
    opacity: Math.random() * 0.3 + 0.05,
  }));

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map(p => (
        <motion.div
          key={p.id}
          className="absolute rounded-full"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
            background: C.gold,
            opacity: p.opacity,
          }}
          animate={{
            y: [0, -40, 0],
            x: [0, Math.random() * 20 - 10, 0],
            opacity: [p.opacity, p.opacity * 2, p.opacity],
          }}
          transition={{
            duration: p.duration,
            repeat: Infinity,
            delay: p.delay,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
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
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    x.set((e.clientX - cx) * 0.2);
    y.set((e.clientY - cy) * 0.2);
  };

  const handleLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.button
      ref={ref}
      onClick={onClick}
      onMouseMove={handleMouse}
      onMouseLeave={handleLeave}
      style={{ x, y }}
      className={`group relative overflow-hidden ${className}`}
    >
      {children}
    </motion.button>
  );
}

/* ═══════════════════════════════════════════════════
   Main Landing Page
   ═══════════════════════════════════════════════════ */
export default function LandingPage({ onLogin }: { onLogin: () => void }) {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mobileMenu, setMobileMenu] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { setError('Please enter your email and password.'); return; }
    setError('');
    setLoading(true);
    setTimeout(() => { setLoading(false); onLogin(); }, 800);
  };

  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress: heroProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] });
  const heroOpacity = useTransform(heroProgress, [0, 0.5], [1, 0]);
  const heroScale = useTransform(heroProgress, [0, 0.5], [1, 0.95]);
  const heroY = useTransform(heroProgress, [0, 0.5], [0, 50]);

  const [showScrollIndicator, setShowScrollIndicator] = useState(true);

  useEffect(() => {
    const handler = () => setShowScrollIndicator(window.scrollY < 100);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  return (
    <div className="relative" style={{ background: C.bg, color: C.text }}>
      <CursorGlow />
      <GrainOverlay />

      {/* ══════ STICKY NAV ══════ */}
      <motion.nav
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="fixed top-0 left-0 right-0 z-50 border-b"
        style={{ background: 'rgba(6, 9, 15, 0.8)', backdropFilter: 'blur(20px) saturate(1.5)', borderColor: C.border }}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between px-6 md:px-10 h-16">
          <motion.div
            className="flex items-center gap-3"
            whileHover={{ scale: 1.02 }}
          >
            <div className="w-9 h-9 rounded-lg flex items-center justify-center"
              style={{ background: `linear-gradient(135deg, ${C.gold}, ${C.goldLight})` }}>
              <Brain className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-bold tracking-tight">
              DeepMind<span style={{ color: C.gold }}>Q</span>
            </span>
          </motion.div>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-8">
            {['Mission', 'Approach', 'Expertise', 'Framework', 'Technology'].map(item => (
              <a
                key={item}
                href={`#${item.toLowerCase()}`}
                className="text-sm transition-colors hover:text-white"
                style={{ color: C.textMuted }}
              >
                {item}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-4">
            <MagneticButton
              onClick={() => document.getElementById('login-section')?.scrollIntoView({ behavior: 'smooth' })}
              className="px-5 py-2.5 rounded-md text-sm font-semibold"
              style={{ background: `linear-gradient(135deg, ${C.gold}, ${C.goldLight})`, color: C.bg }}
            >
              <span className="relative z-10">Access Workspace</span>
            </MagneticButton>

            {/* Mobile hamburger */}
            <button className="md:hidden text-white" onClick={() => setMobileMenu(!mobileMenu)}>
              {mobileMenu ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {mobileMenu && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="md:hidden overflow-hidden border-t"
              style={{ background: 'rgba(6, 9, 15, 0.95)', borderColor: C.border }}
            >
              <div className="px-6 py-4 space-y-3">
                {['Mission', 'Approach', 'Expertise', 'Framework', 'Technology'].map(item => (
                  <a
                    key={item}
                    href={`#${item.toLowerCase()}`}
                    onClick={() => setMobileMenu(false)}
                    className="block text-sm py-2 transition-colors hover:text-white"
                    style={{ color: C.textMuted }}
                  >
                    {item}
                  </a>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.nav>

      {/* ══════ HERO SECTION (Full Viewport + Parallax) ══════ */}
      <motion.div
        ref={heroRef}
        className="relative min-h-screen flex items-center justify-center overflow-hidden"
        style={{ opacity: heroOpacity, scale: heroScale }}
      >
        <FloatingParticles />

        {/* Gradient Orbs */}
        <div className="absolute top-1/4 -left-32 w-96 h-96 rounded-full opacity-[0.07] blur-[120px]"
          style={{ background: C.gold }} />
        <div className="absolute bottom-1/4 -right-32 w-80 h-80 rounded-full opacity-[0.05] blur-[100px]"
          style={{ background: '#3B82F6' }} />

        <div className="relative z-10 max-w-7xl mx-auto px-6 md:px-10 pt-20 w-full">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">

            {/* Left: Branding */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 1 }}
            >
              <motion.div
                initial={{ opacity: 0, x: -40 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8, delay: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
              >
                <p className="text-sm tracking-[0.3em] uppercase mb-6" style={{ color: C.gold }}>
                  Enterprise Growth Leader
                </p>
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 60 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1, delay: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
                className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight leading-[0.95]"
              >
                Ravi
                <br />
                <span style={{ color: C.gold }}>Shanker</span>
              </motion.h1>

              <motion.div
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 0.8, delay: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
                className="h-px w-32 mt-8 mb-8 origin-left"
                style={{ background: `linear-gradient(90deg, ${C.gold}, transparent)` }}
              />

              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.7 }}
                className="flex flex-wrap gap-3 mb-8"
              >
                {['AI', 'Digital Transformation', 'Strategic Sales'].map((tag, i) => (
                  <motion.span
                    key={tag}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5, delay: 0.8 + i * 0.1 }}
                    className="px-4 py-1.5 rounded-full text-sm font-medium border"
                    style={{ color: C.gold, borderColor: C.borderGold, background: `${C.gold}08` }}
                  >
                    {tag}
                  </motion.span>
                ))}
              </motion.div>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.9 }}
                className="text-base md:text-lg leading-relaxed max-w-lg mb-10"
                style={{ color: C.textMuted }}
              >
                Driving enterprise revenue through AI-powered intelligence, strategic CXO
                engagement, and technology-led transformation across global markets.
              </motion.p>

              {/* Stats */}
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 1.0 }}
                className="grid grid-cols-2 md:grid-cols-4 gap-4"
              >
                <AnimatedStat icon={Briefcase} value="15+" label="Years Experience" delay={1.0} />
                <AnimatedStat icon={Users} value="100+" label="CXO Relationships" delay={1.1} />
                <AnimatedStat icon={TrendingUp} value="$5M+" label="Revenue Generated" delay={1.2} />
                <AnimatedStat icon={Globe} value="Global" label="Markets" delay={1.3} />
              </motion.div>
            </motion.div>

            {/* Right: Login Card */}
            <motion.div
              id="login-section"
              initial={{ opacity: 0, x: 60, rotateY: -5 }}
              animate={{ opacity: 1, x: 0, rotateY: 0 }}
              transition={{ duration: 1, delay: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="lg:sticky lg:top-24"
            >
              <div
                className="rounded-2xl p-8 md:p-10 border relative overflow-hidden"
                style={{
                  background: 'rgba(10, 15, 24, 0.7)',
                  backdropFilter: 'blur(30px) saturate(1.5)',
                  borderColor: C.border,
                }}
              >
                {/* Card glow */}
                <div className="absolute -top-20 -right-20 w-40 h-40 rounded-full opacity-10 blur-[60px]"
                  style={{ background: C.gold }} />

                <div className="relative z-10">
                  <div className="space-y-1 mb-2">
                    <h2 className="text-xl font-bold text-white">Access My Workspace</h2>
                    <p className="text-sm" style={{ color: C.textMuted }}>Enter credentials to continue</p>
                  </div>

                  {/* Divider */}
                  <div className="h-px w-full my-6" style={{ background: `linear-gradient(90deg, ${C.gold}40, transparent)` }} />

                  <form onSubmit={handleLogin} className="space-y-5">
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-xs tracking-wider uppercase" style={{ color: C.textMuted }}>Email</Label>
                      <Input
                        id="email" type="email" placeholder="your@email.com"
                        value={email} onChange={e => { setEmail(e.target.value); setError(''); }}
                        className="h-12 border-white/[0.08] text-white placeholder:text-zinc-700 focus:border-[#D4AF37] focus:ring-[#D4AF37]/20 rounded-lg text-sm"
                        style={{ background: 'rgba(255,255,255,0.03)' }}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="password" className="text-xs tracking-wider uppercase" style={{ color: C.textMuted }}>Password</Label>
                      <div className="relative">
                        <Input
                          id="password" type={showPassword ? 'text' : 'password'} placeholder="Enter password"
                          value={password} onChange={e => { setPassword(e.target.value); setError(''); }}
                          className="h-12 border-white/[0.08] text-white placeholder:text-zinc-700 pr-12 focus:border-[#D4AF37] focus:ring-[#D4AF37]/20 rounded-lg text-sm"
                          style={{ background: 'rgba(255,255,255,0.03)' }}
                        />
                        <button type="button" onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 transition-colors hover:text-white" style={{ color: C.textDim }}>
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Checkbox id="remember" checked={remember} onCheckedChange={(v) => setRemember(v === true)}
                          className="border-zinc-700 data-[state=checked]:bg-[#D4AF37] data-[state=checked]:border-[#D4AF37]" />
                        <Label htmlFor="remember" className="text-xs cursor-pointer" style={{ color: C.textMuted }}>Remember me</Label>
                      </div>
                    </div>

                    {error && (
                      <motion.p initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }}
                        className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">{error}</motion.p>
                    )}

                    <MagneticButton className="w-full">
                      <button
                        type="submit" disabled={loading}
                        className="w-full h-12 text-sm font-bold rounded-lg transition-all press-scale relative overflow-hidden"
                        style={{ background: loading ? C.goldDim : `linear-gradient(135deg, ${C.gold}, ${C.goldLight})`, color: C.bg }}
                      >
                        {loading ? (
                          <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        ) : 'LOGIN TO DEEPMINDQ'}
                      </button>
                    </MagneticButton>

                    <p className="text-[10px] text-center" style={{ color: C.textDim }}>
                      Secured with enterprise-grade encryption. Your data stays private.
                    </p>
                  </form>
                </div>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Scroll Indicator */}
        <AnimatePresence>
          {showScrollIndicator && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ delay: 1.5 }}
              className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 cursor-pointer"
              onClick={() => document.getElementById('mission')?.scrollIntoView({ behavior: 'smooth' })}
            >
              <span className="text-[10px] tracking-[0.3em] uppercase" style={{ color: C.textDim }}>Scroll</span>
              <motion.div animate={{ y: [0, 8, 0] }} transition={{ duration: 1.5, repeat: Infinity }}>
                <ChevronDown className="w-4 h-4" style={{ color: C.gold }} />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* ══════ MARQUEE DIVIDER ══════ */}
      <div className="relative py-2 border-y" style={{ borderColor: C.border, background: C.bg }}>
        <Marquee
          items={['Enterprise Sales', 'AI Strategy', 'CXO Engagement', 'Digital Transformation', 'Revenue Growth', 'Cloud Solutions', 'Data Analytics', 'Strategic Consulting']}
          speed={35}
        />
      </div>

      {/* ══════ MISSION SECTION ══════ */}
      <ParallaxSection id="mission" className="min-h-screen flex items-center py-32 px-6 md:px-10" style={{ background: C.bgAlt }}>
        <div className="max-w-6xl mx-auto w-full">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <SectionReveal>
              <div className="space-y-6">
                <p className="text-sm tracking-[0.3em] uppercase" style={{ color: C.gold }}>01 — Mission</p>
                <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.05]">
                  Bridging Technology
                  <br />
                  <span style={{ color: C.gold }}>& Business</span>
                </h2>
                <div className="h-px w-24" style={{ background: `linear-gradient(90deg, ${C.gold}, transparent)` }} />
              </div>
            </SectionReveal>

            <SectionReveal delay={0.2}>
              <div className="space-y-6">
                <p className="text-lg leading-relaxed" style={{ color: C.textMuted }}>
                  To bridge the gap between cutting-edge technology capabilities and enterprise
                  business outcomes. I build deep, trust-based relationships with C-suite executives
                  and translate complex AI &amp; digital solutions into tangible revenue growth,
                  operational efficiency, and strategic advantage.
                </p>
                <p className="text-lg leading-relaxed" style={{ color: C.textMuted }}>
                  Every enterprise has untapped potential hidden in its data, processes, and people.
                  My role is to find it, frame it, and deliver it as measurable business value.
                </p>
                <div className="flex items-center gap-4 pt-4">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center border-2" style={{ borderColor: C.borderGold }}>
                    <Target className="w-5 h-5" style={{ color: C.gold }} />
                  </div>
                  <div>
                    <p className="font-semibold text-white">Results-Driven</p>
                    <p className="text-sm" style={{ color: C.textMuted }}>Every engagement tied to measurable outcomes</p>
                  </div>
                </div>
              </div>
            </SectionReveal>
          </div>
        </div>
      </ParallaxSection>

      {/* ══════ APPROACH SECTION ══════ */}
      <ParallaxSection id="approach" className="py-32 px-6 md:px-10">
        <div className="max-w-6xl mx-auto w-full">
          <SectionReveal>
            <div className="text-center mb-20">
              <p className="text-sm tracking-[0.3em] uppercase mb-4" style={{ color: C.gold }}>02 — Approach</p>
              <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight">
                Intelligence-Driven <span style={{ color: C.gold }}>Methodology</span>
              </h2>
            </div>
          </SectionReveal>

          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-6 md:left-1/2 top-0 bottom-0 w-px md:-translate-x-px"
              style={{ background: `linear-gradient(180deg, transparent, ${C.borderGold}, transparent)` }} />

            {[
              { icon: Search, step: '01', title: 'Understand the Business', desc: 'Deep-dive into operations, pain points, strategic goals, and competitive landscape to identify real opportunities that others miss.' },
              { icon: Lightbulb, step: '02', title: 'Identify Strategic Opportunities', desc: 'Map technology capabilities to business challenges, uncovering high-impact areas where AI creates measurable value.' },
              { icon: Cog, step: '03', title: 'Align Technology', desc: 'Match the right solutions — AI, cloud, analytics — to each opportunity, ensuring technical feasibility and business alignment.' },
              { icon: MessageSquare, step: '04', title: 'Executive Conversations', desc: 'Craft compelling, value-driven narratives tailored for C-suite decision makers that resonate with their strategic priorities.' },
              { icon: TrendingUp, step: '05', title: 'Drive Revenue', desc: 'Convert relationships into closed deals through consultative selling, proof-of-value engagements, and long-term partnerships.' },
            ].map((item, i) => (
              <TimelineCard key={item.step} item={item} index={i} />
            ))}
          </div>
        </div>
      </ParallaxSection>

      {/* ══════ MARQUEE DIVIDER 2 ══════ */}
      <div className="py-2 border-y" style={{ borderColor: C.border, background: C.bgAlt }}>
        <Marquee
          items={['$5M+ Revenue', '15+ Years', '100+ CXOs', 'Global Markets', 'AI-Powered', 'Enterprise Grade', 'Trust-Based', 'Outcome Focused']}
          speed={25}
        />
      </div>

      {/* ══════ EXPERTISE SECTION ══════ */}
      <ParallaxSection id="expertise" className="py-32 px-6 md:px-10" style={{ background: C.bgAlt }}>
        <div className="max-w-6xl mx-auto w-full">
          <SectionReveal>
            <div className="mb-20">
              <p className="text-sm tracking-[0.3em] uppercase mb-4" style={{ color: C.gold }}>03 — Expertise</p>
              <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight">
                What I <span style={{ color: C.gold }}>Bring</span>
              </h2>
            </div>
          </SectionReveal>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { icon: Users, title: 'Enterprise Sales Leadership', desc: 'Leading complex, multi-stakeholder sales cycles from qualification to close with strategic precision and executive alignment.' },
              { icon: MessageSquare, title: 'CXO Engagement', desc: 'Building trusted advisor relationships with C-level executives through insight-led conversations that demonstrate deep understanding.' },
              { icon: BarChart3, title: 'Strategic Account Growth', desc: 'Expanding revenue within existing accounts through cross-sell, upsell, and deepening multi-threaded engagement.' },
              { icon: Handshake, title: 'Complex Deal Management', desc: 'Navigating procurement, legal, and technical evaluations to drive large enterprise deals from proposal to signature.' },
              { icon: BrainCircuit, title: 'AI & Digital Transformation', desc: 'Advising enterprises on AI adoption strategy, digital roadmaps, and technology-enabled business transformation.' },
              { icon: Globe, title: 'Global Market Expansion', desc: 'Extending enterprise reach across India, Middle East, and beyond with culturally aware go-to-market strategies.' },
            ].map((item, i) => (
              <HoverCard key={item.title} item={item} index={i} />
            ))}
          </div>
        </div>
      </ParallaxSection>

      {/* ══════ FRAMEWORK SECTION ══════ */}
      <ParallaxSection id="framework" className="py-32 px-6 md:px-10">
        <div className="max-w-5xl mx-auto w-full">
          <SectionReveal>
            <div className="text-center mb-20">
              <p className="text-sm tracking-[0.3em] uppercase mb-4" style={{ color: C.gold }}>04 — Framework</p>
              <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight">
                The DeepMind<span style={{ color: C.gold }}>Q</span> System
              </h2>
              <p className="text-base mt-4 max-w-lg mx-auto" style={{ color: C.textMuted }}>
                An intelligence-driven engine for enterprise sales acceleration
              </p>
            </div>
          </SectionReveal>

          <FrameworkVisual />
        </div>
      </ParallaxSection>

      {/* ══════ TECHNOLOGY SECTION ══════ */}
      <ParallaxSection id="technology" className="py-32 px-6 md:px-10" style={{ background: C.bgAlt }}>
        <div className="max-w-6xl mx-auto w-full">
          <SectionReveal>
            <div className="text-center mb-20">
              <p className="text-sm tracking-[0.3em] uppercase mb-4" style={{ color: C.gold }}>05 — Technology</p>
              <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight">
                Solution <span style={{ color: C.gold }}>Focus</span>
              </h2>
            </div>
          </SectionReveal>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-5">
            {[
              { icon: Bot, title: 'AI & Automation', color: '#3B82F6' },
              { icon: Cloud, title: 'Cloud & Infra', color: '#8B5CF6' },
              { icon: Database, title: 'Data & Analytics', color: '#6366F1' },
              { icon: Code2, title: 'Digital Engineering', color: '#A855F7' },
              { icon: Layers, title: 'Enterprise Apps', color: '#10B981' },
            ].map((item, i) => (
              <TechCard key={item.title} item={item} index={i} />
            ))}
          </div>
        </div>
      </ParallaxSection>

      {/* ══════ QUOTE / CTA SECTION ══════ */}
      <ParallaxSection className="min-h-[80vh] flex items-center py-32 px-6 md:px-10">
        <div className="max-w-3xl mx-auto text-center w-full">
          <SectionReveal>
            <div className="space-y-10">
              <motion.div
                className="text-7xl md:text-8xl font-serif leading-none"
                style={{ color: `${C.gold}25` }}
                initial={{ opacity: 0, scale: 0.5 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8 }}
              >
                &ldquo;
              </motion.div>

              <blockquote className="text-xl md:text-2xl lg:text-3xl italic leading-relaxed font-light" style={{ color: C.text }}>
                Every enterprise has untapped potential. My role is to find it, frame it, and
                deliver it as <span style={{ color: C.gold }}>measurable business value</span>.
              </blockquote>

              <div className="space-y-2">
                <p className="text-2xl font-bold" style={{ color: C.gold }}>Ravi Shanker</p>
                <p className="text-sm" style={{ color: C.textMuted }}>Enterprise Growth Leader</p>
              </div>

              <div className="flex items-center justify-center gap-3 pt-6">
                <ShieldCheck className="w-5 h-5" style={{ color: C.gold }} />
                <span className="text-sm font-medium tracking-wider" style={{ color: C.textMuted }}>
                  PRIVATE &middot; FOCUSED &middot; RESULTS DRIVEN
                </span>
              </div>

              <div className="flex items-center justify-center gap-4 pt-8">
                <MagneticButton onClick={() => document.getElementById('login-section')?.scrollIntoView({ behavior: 'smooth' })}>
                  <div className="flex items-center gap-2 px-8 py-4 rounded-lg text-sm font-bold"
                    style={{ background: `linear-gradient(135deg, ${C.gold}, ${C.goldLight})`, color: C.bg }}>
                    Access Workspace <ArrowRight className="w-4 h-4" />
                  </div>
                </MagneticButton>
                <a href="mailto:contact@deepmindq.com"
                  className="flex items-center gap-2 px-8 py-4 rounded-lg text-sm font-medium border transition-colors hover:bg-white/5"
                  style={{ borderColor: C.border, color: C.textMuted }}>
                  <Mail className="w-4 h-4" /> Get in Touch
                </a>
              </div>
            </div>
          </SectionReveal>
        </div>
      </ParallaxSection>

      {/* ══════ FOOTER ══════ */}
      <footer className="py-12 px-6 md:px-10 border-t" style={{ borderColor: C.border, background: C.bg }}>
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-md flex items-center justify-center"
              style={{ background: `linear-gradient(135deg, ${C.gold}, ${C.goldLight})` }}>
              <Brain className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-bold">DeepMind<span style={{ color: C.gold }}>Q</span></span>
          </div>
          <div className="flex items-center gap-6 text-sm" style={{ color: C.textMuted }}>
            <a href="mailto:contact@deepmindq.com" className="hover:text-white transition-colors flex items-center gap-2">
              <Mail className="w-4 h-4" /> contact@deepmindq.com
            </a>
            <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors flex items-center gap-2">
              <Linkedin className="w-4 h-4" /> LinkedIn
            </a>
            <span className="flex items-center gap-2"><Phone className="w-4 h-4" /> +91 9030858057</span>
          </div>
          <p className="text-xs" style={{ color: C.textDim }}>
            &copy; 2026 DeepMindQ. Built with intelligence. Driven by purpose.
          </p>
        </div>
      </footer>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   Sub-Components
   ═══════════════════════════════════════════════════ */

function SectionReveal({ children, delay = 0, className = '' }: {
  children: React.ReactNode; delay?: number; className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 50 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.9, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function TimelineCard({ item, index }: { item: { icon: React.ElementType; step: string; title: string; desc: string }; index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });
  const isLeft = index % 2 === 0;
  const Icon = item.icon;

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, x: isLeft ? -40 : 40 }}
      animate={inView ? { opacity: 1, x: 0 } : {}}
      transition={{ duration: 0.7, delay: index * 0.1, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={`relative flex items-start gap-8 mb-16 pl-14 md:pl-0 ${
        isLeft ? 'md:flex-row' : 'md:flex-row-reverse'
      }`}
    >
      {/* Timeline dot */}
      <div className="absolute left-3 md:left-1/2 top-1 w-7 h-7 rounded-full flex items-center justify-center z-10 md:-translate-x-1/2"
        style={{ background: C.bg, border: `2px solid ${C.gold}`, boxShadow: `0 0 20px ${C.gold}30` }}>
        <div className="w-2 h-2 rounded-full" style={{ background: C.gold }} />
      </div>

      {/* Content */}
      <div className={`flex-1 md:w-[calc(50%-40px)] ${isLeft ? 'md:pr-12 md:text-right' : 'md:pl-12'}`}>
        <div className={`p-6 rounded-xl border transition-all hover:-translate-y-1 hover:border-white/10 ${
          isLeft ? 'md:ml-auto' : 'md:mr-auto'
        }`} style={{ background: C.card, borderColor: C.border, maxWidth: '440px' }}>
          <div className={`flex items-center gap-3 mb-3 ${isLeft ? 'md:justify-end' : ''}`}>
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: `${C.gold}15` }}>
              <Icon className="w-5 h-5" style={{ color: C.gold }} />
            </div>
            <span className="text-xs font-bold tracking-widest" style={{ color: C.goldDim }}>{item.step}</span>
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">{item.title}</h3>
          <p className="text-sm leading-relaxed" style={{ color: C.textMuted }}>{item.desc}</p>
        </div>
      </div>

      {/* Spacer for opposite side */}
      <div className="hidden md:block flex-1" />
    </motion.div>
  );
}

function HoverCard({ item, index }: { item: { icon: React.ElementType; title: string; desc: string }; index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-40px' });
  const Icon = item.icon;
  const [hovered, setHovered] = useState(false);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 40 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.7, delay: index * 0.08, ease: [0.25, 0.46, 0.45, 0.94] }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="relative group cursor-default"
    >
      <motion.div
        whileHover={{ y: -6 }}
        transition={{ duration: 0.25 }}
        className="p-6 rounded-xl border h-full relative overflow-hidden"
        style={{ background: C.card, borderColor: hovered ? C.borderGold : C.border }}
      >
        {/* Hover glow */}
        <motion.div
          className="absolute -top-10 -right-10 w-32 h-32 rounded-full blur-[40px]"
          style={{ background: C.gold, opacity: hovered ? 0.08 : 0 }}
          animate={{ opacity: hovered ? 0.08 : 0 }}
          transition={{ duration: 0.3 }}
        />

        <div className="relative z-10">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4" style={{ background: `${C.gold}15` }}>
            <Icon className="w-6 h-6" style={{ color: C.gold }} />
          </div>
          <h3 className="text-base font-semibold text-white mb-2">{item.title}</h3>
          <p className="text-sm leading-relaxed" style={{ color: C.textMuted }}>{item.desc}</p>
        </div>

        {/* Bottom gold line on hover */}
        <motion.div
          className="absolute bottom-0 left-0 right-0 h-px"
          style={{ background: `linear-gradient(90deg, transparent, ${C.gold}, transparent)` }}
          initial={{ scaleX: 0, opacity: 0 }}
          animate={{ scaleX: hovered ? 1 : 0, opacity: hovered ? 1 : 0 }}
          transition={{ duration: 0.3 }}
        />
      </motion.div>
    </motion.div>
  );
}

function TechCard({ item, index }: { item: { icon: React.ElementType; title: string; color: string }; index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-40px' });
  const Icon = item.icon;

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30, scale: 0.9 }}
      animate={inView ? { opacity: 1, y: 0, scale: 1 } : {}}
      transition={{ duration: 0.6, delay: index * 0.08, ease: [0.25, 0.46, 0.45, 0.94] }}
      whileHover={{ y: -8, scale: 1.02 }}
      className="p-6 rounded-xl border text-center cursor-default transition-colors hover:border-white/10"
      style={{ background: C.card, borderColor: C.border }}
    >
      <div className="w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-4"
        style={{ background: `${item.color}15` }}>
        <Icon className="w-7 h-7" style={{ color: item.color }} />
      </div>
      <h3 className="text-sm font-semibold text-white">{item.title}</h3>
    </motion.div>
  );
}

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
    <motion.div
      ref={ref}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={inView ? { opacity: 1, scale: 1 } : {}}
      transition={{ duration: 1, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="relative flex items-center justify-center py-16"
    >
      {/* Outer ring */}
      <svg className="absolute w-[320px] h-[320px] md:w-[440px] md:h-[440px]" viewBox="0 0 440 440">
        <circle
          cx="220" cy="220" r="190"
          fill="none"
          stroke={C.border}
          strokeWidth="1"
          strokeDasharray="8 6"
        />
        {/* Animated accent ring */}
        <motion.circle
          cx="220" cy="220" r="190"
          fill="none"
          stroke={C.gold}
          strokeWidth="1.5"
          strokeDasharray="40 300"
          strokeLinecap="round"
          initial={{ rotate: 0 }}
          animate={{ rotate: 360 }}
          transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
          style={{ transformOrigin: '220px 220px' }}
        />
      </svg>

      {/* Center brain */}
      <motion.div
        className="relative z-10 w-24 h-24 md:w-28 md:h-28 rounded-full flex items-center justify-center"
        style={{
          background: `linear-gradient(135deg, ${C.gold}, ${C.goldLight})`,
          boxShadow: `0 0 80px ${C.gold}30, 0 0 40px ${C.gold}20`,
        }}
        whileHover={{ scale: 1.1, boxShadow: `0 0 100px ${C.gold}50` }}
        animate={{ boxShadow: [`0 0 60px ${C.gold}25`, `0 0 100px ${C.gold}40`, `0 0 60px ${C.gold}25`] }}
        transition={{ boxShadow: { duration: 3, repeat: Infinity } }}
      >
        <Brain className="w-12 h-12 md:w-14 md:h-14 text-white" />
      </motion.div>

      {/* Orbiting nodes */}
      {nodes.map((node, i) => {
        const rad = (node.angle * Math.PI) / 180;
        const r = 190;
        const cx = 220 + r * Math.cos(rad);
        const cy = 220 + r * Math.sin(rad);
        const Icon = node.icon;

        return (
          <motion.div
            key={node.label}
            className="absolute flex flex-col items-center gap-2 text-center z-10"
            style={{ left: `${(cx / 440) * 100}%`, top: `${(cy / 440) * 100}%` }}
            initial={{ opacity: 0, scale: 0 }}
            animate={inView ? { opacity: 1, scale: 1 } : {}}
            transition={{ duration: 0.6, delay: 0.3 + i * 0.12 }}
            onMouseEnter={() => setHoveredNode(i)}
            onMouseLeave={() => setHoveredNode(null)}
          >
            <motion.div
              className="w-14 h-14 md:w-16 md:h-16 rounded-full flex items-center justify-center border-2 cursor-pointer"
              style={{
                background: hoveredNode === i ? `${node.color}25` : `${node.color}10`,
                borderColor: hoveredNode === i ? node.color : `${node.color}50`,
                boxShadow: hoveredNode === i ? `0 0 30px ${node.color}30` : 'none',
              }}
              whileHover={{ scale: 1.15 }}
              animate={hoveredNode === i ? { scale: 1.1 } : { scale: 1 }}
            >
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