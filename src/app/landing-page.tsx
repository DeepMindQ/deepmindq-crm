'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, useScroll, useTransform, useInView, AnimatePresence } from 'framer-motion';
import {
  Network, ArrowRight, ChevronDown, Shield, Brain,
  Target, Users, BarChart3, MessageSquare, Layers,
  Zap, Eye, Globe, TrendingUp, Lock,
} from 'lucide-react';
import LoginPage from '@/components/login-page';

/* ═══════════════════════════════════════════════════
   Design System
   Palantir + Linear + Apple — Dark Premium
   ═══════════════════════════════════════════════════ */
const COLORS = {
  bg: '#06060a',
  bgElevated: '#0c0c14',
  bgCard: '#10101a',
  border: 'rgba(255,255,255,0.06)',
  borderHover: 'rgba(255,255,255,0.12)',
  text: '#f0f0f5',
  textSecondary: '#8a8a9a',
  textTertiary: '#55556a',
  accent: '#a78bfa',
  accentDim: 'rgba(167,139,250,0.15)',
  accentGlow: 'rgba(167,139,250,0.08)',
  white: '#ffffff',
};

/* ═══════════════════════════════════════════════════
   Intelligence Network Visualization
   Animated SVG node graph
   ═══════════════════════════════════════════════════ */
function IntelligenceNetwork() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-100px' });

  const nodes = [
    { id: 'companies', label: 'Companies', x: 50, y: 20, icon: BuildingIcon },
    { id: 'signals', label: 'Business Signals', x: 50, y: 40, icon: SignalIcon },
    { id: 'people', label: 'People', x: 50, y: 60, icon: PeopleIcon },
    { id: 'opportunities', label: 'Opportunities', x: 50, y: 80, icon: OpportunityIcon },
    { id: 'conversations', label: 'Executive Conversations', x: 50, y: 95, icon: ConversationIcon },
  ];

  return (
    <div ref={ref} className="relative w-full max-w-md mx-auto my-16 sm:my-20" style={{ height: 420 }}>
      {/* Connection lines */}
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        {[0, 1, 2, 3].map((i) => (
          <motion.line
            key={i}
            x1="50" y1={nodes[i].y}
            x2="50" y2={nodes[i + 1].y}
            stroke="url(#lineGrad)"
            strokeWidth="0.3"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={inView ? { pathLength: 1, opacity: 1 } : {}}
            transition={{ duration: 0.8, delay: 0.3 + i * 0.2, ease: 'easeOut' }}
          />
        ))}
        <defs>
          <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={COLORS.accent} stopOpacity="0.6" />
            <stop offset="100%" stopColor={COLORS.accent} stopOpacity="0.1" />
          </linearGradient>
        </defs>
      </svg>

      {/* Nodes */}
      {nodes.map((node, i) => (
        <motion.div
          key={node.id}
          className="absolute left-1/2 -translate-x-1/2 flex items-center gap-3 px-5 py-2.5 rounded-full cursor-default"
          style={{
            top: `${node.y}%`,
            transform: 'translate(-50%, -50%)',
            background: i === 0
              ? `linear-gradient(135deg, ${COLORS.accentDim}, rgba(167,139,250,0.05))`
              : 'rgba(255,255,255,0.03)',
            border: `1px solid ${i === 0 ? 'rgba(167,139,250,0.25)' : COLORS.border}`,
          }}
          initial={{ opacity: 0, y: 20, scale: 0.9 }}
          animate={inView ? { opacity: 1, y: 0, scale: 1 } : {}}
          transition={{ duration: 0.6, delay: 0.5 + i * 0.15, ease: [0.25, 0.46, 0.45, 0.94] }}
          whileHover={{
            borderColor: COLORS.borderHover,
            background: 'rgba(255,255,255,0.05)',
          }}
        >
          <div
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{
              background: i === 0 ? COLORS.accent : COLORS.textTertiary,
              boxShadow: i === 0 ? `0 0 8px ${COLORS.accent}` : 'none',
            }}
          />
          <span className="text-sm whitespace-nowrap" style={{ color: i === 0 ? COLORS.white : COLORS.textSecondary }}>
            {node.label}
          </span>
        </motion.div>
      ))}

      {/* Ambient glow */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 rounded-full pointer-events-none"
        style={{
          background: `radial-gradient(circle, ${COLORS.accentGlow} 0%, transparent 70%)`,
          filter: 'blur(40px)',
        }}
      />
    </div>
  );
}

/* Minimal node icons (inline SVG for zero dependencies) */
function BuildingIcon() { return null; }
function SignalIcon() { return null; }
function PeopleIcon() { return null; }
function OpportunityIcon() { return null; }
function ConversationIcon() { return null; }

/* ═══════════════════════════════════════════════════
   Feature Cards — Bento Grid
   ═══════════════════════════════════════════════════ */
const FEATURES = [
  {
    icon: Network,
    title: 'Account Intelligence',
    description: 'Map company ecosystems, technology stacks, funding signals, and strategic relationships in real-time.',
    span: 'col',
  },
  {
    icon: Brain,
    title: 'AI Conversation Studio',
    description: 'Generate hyper-personalized outreach informed by deep account research and capability alignment.',
    span: 'col',
  },
  {
    icon: Target,
    title: 'Opportunity Radar',
    description: 'Detect buying signals, trigger events, and executive movements across your target market.',
    span: 'full',
  },
  {
    icon: Users,
    title: 'Stakeholder Mapping',
    description: 'Identify decision-makers, influencers, and champions within target accounts.',
    span: 'col',
  },
  {
    icon: BarChart3,
    title: 'Pipeline Intelligence',
    description: 'AI-driven deal scoring, stage progression analytics, and conversion forecasting.',
    span: 'col',
  },
  {
    icon: MessageSquare,
    title: 'Relationship Memory',
    description: 'Every interaction, preference, and context remembered. Never start from zero again.',
    span: 'full',
  },
  {
    icon: Layers,
    title: 'Solution Intelligence',
    description: 'Align your capabilities to prospect pain points with evidence-based positioning.',
    span: 'col',
  },
  {
    icon: Zap,
    title: 'Signal Intelligence',
    description: 'Aggregate market signals, competitor moves, and industry shifts into actionable insights.',
    span: 'col',
  },
];

function FeatureCard({ icon: Icon, title, description, index }: {
  icon: React.ElementType;
  title: string;
  description: string;
  index: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });

  return (
    <motion.div
      ref={ref}
      className="group relative p-6 sm:p-8 rounded-2xl transition-colors duration-500"
      style={{
        background: COLORS.bgCard,
        border: `1px solid ${COLORS.border}`,
      }}
      initial={{ opacity: 0, y: 30 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay: index * 0.08, ease: [0.25, 0.46, 0.45, 0.94] }}
      whileHover={{ borderColor: COLORS.borderHover }}
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center mb-5 transition-colors duration-500"
        style={{ background: COLORS.accentDim }}
      >
        <Icon className="w-5 h-5" style={{ color: COLORS.accent }} />
      </div>
      <h3 className="text-base font-semibold mb-2 tracking-tight" style={{ color: COLORS.white }}>
        {title}
      </h3>
      <p className="text-sm leading-relaxed" style={{ color: COLORS.textSecondary }}>
        {description}
      </p>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════
   Philosophy Section — Apple-style storytelling
   ═══════════════════════════════════════════════════ */
function PhilosophySection() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-100px' });

  return (
    <section ref={ref} className="py-24 sm:py-32 px-6">
      <div className="max-w-3xl mx-auto text-center">
        <motion.p
          className="text-xs font-medium tracking-[0.25em] uppercase mb-8"
          style={{ color: COLORS.accent }}
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ duration: 0.6 }}
        >
          Philosophy
        </motion.p>

        <motion.blockquote
          className="text-2xl sm:text-3xl lg:text-4xl font-light leading-relaxed tracking-tight"
          style={{ color: COLORS.text }}
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, delay: 0.1 }}
        >
          &ldquo;The best sales conversations don&apos;t feel like selling.
          <br />
          <span className="font-normal" style={{ color: COLORS.textSecondary }}>
            They feel like{' '}
          </span>
          <span style={{ color: COLORS.accent }} className="font-normal italic">
            understanding.
          </span>
          &rdquo;
        </motion.blockquote>

        <motion.p
          className="mt-8 text-base leading-relaxed max-w-xl mx-auto"
          style={{ color: COLORS.textTertiary }}
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          DeepMindQ transforms your sales organization from reactive outreach
          to proactive intelligence. Every email, every call, every follow-up
          informed by deep understanding of your prospect&apos;s world.
        </motion.p>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════
   Stats Bar — McKinsey credibility
   ═══════════════════════════════════════════════════ */
function StatsBar() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true });

  const stats = [
    { value: '10x', label: 'Faster Account Research' },
    { value: '73%', label: 'Higher Email Engagement' },
    { value: '3.2x', label: 'Pipeline Velocity' },
    { value: '< 2min', label: 'From Signal to Action' },
  ];

  return (
    <div
      ref={ref}
      className="mx-6 sm:mx-auto max-w-4xl rounded-2xl p-8 sm:p-10"
      style={{
        background: `linear-gradient(135deg, ${COLORS.bgCard}, ${COLORS.bgElevated})`,
        border: `1px solid ${COLORS.border}`,
      }}
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 sm:gap-6">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.label}
            className="text-center"
            initial={{ opacity: 0, y: 20 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: i * 0.1 }}
          >
            <div
              className="text-3xl sm:text-4xl font-light tracking-tight mb-1"
              style={{ color: COLORS.accent }}
            >
              {stat.value}
            </div>
            <div className="text-xs sm:text-sm" style={{ color: COLORS.textTertiary }}>
              {stat.label}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   Footer
   ═══════════════════════════════════════════════════ */
function Footer({ onLogin }: { onLogin: () => void }) {
  return (
    <footer className="py-16 px-6" style={{ borderTop: `1px solid ${COLORS.border}` }}>
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: COLORS.accentDim }}
          >
            <Brain className="w-4 h-4" style={{ color: COLORS.accent }} />
          </div>
          <span className="text-sm font-medium" style={{ color: COLORS.textSecondary }}>
            DeepMindQ
          </span>
        </div>

        <div className="flex items-center gap-8">
          <button
            onClick={onLogin}
            className="text-sm transition-colors duration-300 hover:text-white"
            style={{ color: COLORS.textTertiary }}
          >
            Private Workspace
          </button>
          <span className="text-xs" style={{ color: COLORS.textTertiary }}>
            &copy; {new Date().getFullYear()} DeepMindQ
          </span>
        </div>
      </div>
    </footer>
  );
}

/* ═══════════════════════════════════════════════════
   Main Landing Page
   ═══════════════════════════════════════════════════ */
interface LandingPageProps {
  onLogin: () => void;
}

export default function LandingPage({ onLogin }: LandingPageProps) {
  const [showLogin, setShowLogin] = useState(false);
  const heroRef = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll();
  const heroOpacity = useTransform(scrollYProgress, [0, 0.15], [1, 0]);
  const heroScale = useTransform(scrollYProgress, [0, 0.15], [1, 0.97]);

  if (showLogin) {
    return <LoginPage onLogin={onLogin} />;
  }

  const handleExplore = () => {
    // Scroll to features or go to login
    const featuresEl = document.getElementById('features');
    if (featuresEl) {
      featuresEl.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen" style={{ background: COLORS.bg, color: COLORS.text }}>
      {/* ── Ambient Background ── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] rounded-full"
          style={{
            background: `radial-gradient(ellipse, ${COLORS.accentGlow} 0%, transparent 60%)`,
            filter: 'blur(80px)',
          }}
        />
        <div
          className="absolute bottom-0 right-0 w-[500px] h-[400px] rounded-full"
          style={{
            background: 'radial-gradient(ellipse, rgba(167,139,250,0.03) 0%, transparent 60%)',
            filter: 'blur(60px)',
          }}
        />
      </div>

      {/* ── Navigation ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: COLORS.accentDim, border: `1px solid rgba(167,139,250,0.2)` }}
            >
              <Brain className="w-4 h-4" style={{ color: COLORS.accent }} />
            </div>
            <span className="text-sm font-semibold tracking-tight" style={{ color: COLORS.white }}>
              DeepMindQ
            </span>
          </div>

          <button
            onClick={() => setShowLogin(true)}
            className="text-sm font-medium px-4 py-2 rounded-lg transition-all duration-300"
            style={{
              color: COLORS.textSecondary,
              border: `1px solid ${COLORS.border}`,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = COLORS.borderHover;
              e.currentTarget.style.color = COLORS.white;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = COLORS.border;
              e.currentTarget.style.color = COLORS.textSecondary;
            }}
          >
            Sign In
          </button>
        </div>
      </nav>

      {/* ── Hero Section ── */}
      <motion.section
        ref={heroRef}
        className="relative min-h-screen flex flex-col items-center justify-center px-6 pt-20"
        style={{ opacity: heroOpacity, scale: heroScale }}
      >
        <motion.div
          className="text-center max-w-2xl mx-auto"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
        >
          {/* Brand */}
          <div className="mb-8">
            <h1
              className="text-4xl sm:text-5xl lg:text-6xl font-light tracking-tight"
              style={{ color: COLORS.white }}
            >
              DeepMindQ
            </h1>
          </div>

          {/* Tagline */}
          <motion.p
            className="text-lg sm:text-xl lg:text-2xl font-light tracking-tight mb-5"
            style={{ color: COLORS.text }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            Understand Before You Sell
          </motion.p>

          {/* Description */}
          <motion.p
            className="text-sm sm:text-base leading-relaxed max-w-lg mx-auto mb-12"
            style={{ color: COLORS.textTertiary }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.35 }}
          >
            AI-powered enterprise growth intelligence combining market signals,
            account research, stakeholder mapping and solution alignment.
          </motion.p>

          {/* CTAs */}
          <motion.div
            className="flex flex-col sm:flex-row items-center justify-center gap-3"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
          >
            <button
              onClick={handleExplore}
              className="group flex items-center gap-2.5 px-7 py-3 rounded-xl text-sm font-medium transition-all duration-300"
              style={{
                background: COLORS.white,
                color: COLORS.bg,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0 0 30px rgba(255,255,255,0.1)';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = 'none';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              Explore DeepMindQ
              <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-0.5" />
            </button>

            <button
              onClick={() => setShowLogin(true)}
              className="group flex items-center gap-2.5 px-7 py-3 rounded-xl text-sm font-medium transition-all duration-300"
              style={{
                background: 'transparent',
                color: COLORS.textSecondary,
                border: `1px solid ${COLORS.border}`,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'rgba(167,139,250,0.3)';
                e.currentTarget.style.color = COLORS.white;
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = COLORS.border;
                e.currentTarget.style.color = COLORS.textSecondary;
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <Lock className="w-3.5 h-3.5" />
              Private Workspace
            </button>
          </motion.div>
        </motion.div>

        {/* Intelligence Network */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.7 }}
        >
          <IntelligenceNetwork />
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        >
          <ChevronDown className="w-5 h-5" style={{ color: COLORS.textTertiary }} />
        </motion.div>
      </motion.section>

      {/* ── Philosophy ── */}
      <PhilosophySection />

      {/* ── Features Grid ── */}
      <section id="features" className="py-16 sm:py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14 sm:mb-20">
            <motion.p
              className="text-xs font-medium tracking-[0.25em] uppercase mb-4"
              style={{ color: COLORS.accent }}
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
            >
              Capabilities
            </motion.p>
            <motion.h2
              className="text-2xl sm:text-3xl lg:text-4xl font-light tracking-tight"
              style={{ color: COLORS.white }}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
            >
              Intelligence at every layer
            </motion.h2>
            <motion.p
              className="mt-4 text-sm sm:text-base max-w-lg mx-auto"
              style={{ color: COLORS.textTertiary }}
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
            >
              Eight integrated modules working as a unified intelligence system,
              not disconnected tools.
            </motion.p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {FEATURES.map((feature, i) => (
              <FeatureCard
                key={feature.title}
                icon={feature.icon}
                title={feature.title}
                description={feature.description}
                index={i}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ── Stats ── */}
      <div className="px-6 pb-16 sm:pb-24">
        <StatsBar />
      </div>

      {/* ── CTA Section ── */}
      <section className="py-24 sm:py-32 px-6">
        <div className="max-w-2xl mx-auto text-center">
          <motion.h2
            className="text-2xl sm:text-3xl font-light tracking-tight mb-5"
            style={{ color: COLORS.white }}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            Ready to sell with intelligence?
          </motion.h2>
          <motion.p
            className="text-sm sm:text-base mb-10"
            style={{ color: COLORS.textTertiary }}
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
          >
            A personal AI-powered enterprise growth intelligence system
            built by an enterprise technology leader.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
          >
            <button
              onClick={() => setShowLogin(true)}
              className="group inline-flex items-center gap-2.5 px-8 py-3.5 rounded-xl text-sm font-medium transition-all duration-300"
              style={{
                background: COLORS.white,
                color: COLORS.bg,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0 0 40px rgba(255,255,255,0.12)';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = 'none';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              Enter Your Workspace
              <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-0.5" />
            </button>
          </motion.div>
        </div>
      </section>

      {/* ── Footer ── */}
      <Footer onLogin={() => setShowLogin(true)} />
    </div>
  );
}