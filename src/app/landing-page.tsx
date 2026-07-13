'use client';

import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Eye, EyeOff, Brain, Briefcase, Users, TrendingUp, Globe,
  Search, Lightbulb, Cog, MessageSquare, BarChart3,
  Target, ShieldCheck, Linkedin, Mail, Phone,
  Crosshair, Handshake, BrainCircuit, Cloud, Database,
  Code2, Layers, Bot,
} from 'lucide-react';

/* ═══════════════════════════════════════════════════
   Intersection Observer Hook for Scroll Animations
   ═══════════════════════════════════════════════════ */
function useScrollReveal(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return { ref, visible };
}

function RevealSection({ children, className = '', delay = 0 }: {
  children: React.ReactNode; className?: string; delay?: number;
}) {
  const { ref, visible } = useScrollReveal();
  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   Landing Page Component
   ═══════════════════════════════════════════════════ */
export default function LandingPage({ onLogin }: { onLogin: () => void }) {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please enter your email and password.');
      return;
    }
    setError('');
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      onLogin();
    }, 800);
  };

  const gold = '#D4AF37';
  const goldLight = '#E8C860';
  const bgDark = '#0A0E17';
  const bgCard = 'rgba(16, 20, 32, 0.7)';
  const textMuted = '#8892A4';
  const textLight = '#B0B8C1';

  return (
    <div className="min-h-screen" style={{ background: bgDark, color: '#fff', fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>
      {/* Background texture */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.03]"
        style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.4) 1px, transparent 0)', backgroundSize: '40px 40px' }} />

      {/* ══════ HEADER / NAV ══════ */}
      <header className="relative z-10 flex items-center justify-between px-6 md:px-12 lg:px-20 h-16 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center"
            style={{ background: `linear-gradient(135deg, ${gold}, ${goldLight})` }}>
            <Brain className="w-5 h-5 text-white" />
          </div>
          <span className="text-lg font-bold tracking-tight">
            DeepMind<span style={{ color: gold }}>Q</span>
          </span>
        </div>
        <div className="hidden md:flex items-center gap-6 text-sm" style={{ color: textMuted }}>
          <a href="mailto:contact@deepmindq.com" className="flex items-center gap-2 hover:text-white transition-colors">
            <Mail className="w-4 h-4" />
            <span className="hidden lg:inline">Email Me</span>
          </a>
          <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:text-white transition-colors">
            <Linkedin className="w-4 h-4" />
            <span className="hidden lg:inline">LinkedIn</span>
          </a>
          <span className="flex items-center gap-2">
            <Phone className="w-4 h-4" />
            <span className="hidden lg:inline">+91 9030858057</span>
          </span>
          <span className="flex items-center gap-2">
            <Globe className="w-4 h-4" />
            India | Saudi Arabia
          </span>
        </div>
        <button
          onClick={() => document.getElementById('login-section')?.scrollIntoView({ behavior: 'smooth' })}
          className="px-4 py-2 rounded-md text-sm font-semibold transition-all hover:opacity-90 press-scale"
          style={{ background: `linear-gradient(135deg, ${gold}, ${goldLight})`, color: bgDark }}
        >
          Access Workspace
        </button>
      </header>

      {/* ══════ HERO SECTION ══════ */}
      <section className="relative z-10 px-6 md:px-12 lg:px-20 py-16 md:py-24">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-12 lg:gap-16 items-start">

          {/* Left: Personal Branding */}
          <div className="space-y-8">
            <div className="space-y-4">
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1]">
                Ravi Shanker
                <span className="block h-1 w-24 mt-3 rounded-full" style={{ background: `linear-gradient(90deg, ${gold}, ${goldLight})` }} />
              </h1>
              <p className="text-xl md:text-2xl font-medium" style={{ color: textLight }}>
                Enterprise Growth Leader
              </p>
              <div className="flex flex-wrap gap-3">
                {['AI', 'Digital Transformation', 'Strategic Sales'].map(tag => (
                  <span key={tag} className="px-3 py-1 rounded-full text-sm font-medium border"
                    style={{ color: gold, borderColor: `${gold}40`, background: `${gold}10` }}>
                    {tag}
                  </span>
                ))}
              </div>
              <p className="text-base leading-relaxed max-w-xl mt-4" style={{ color: textMuted }}>
                Driving enterprise revenue through AI-powered intelligence, strategic CXO engagement,
                and technology-led transformation across global markets. Specialized in building
                high-value relationships that convert into sustainable business outcomes.
              </p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {[
                { icon: Briefcase, value: '15+', label: 'Years of Experience' },
                { icon: Users, value: '100+', label: 'CXO Relationships Built' },
                { icon: TrendingUp, value: '$5M+', label: 'Annual Revenue Generated' },
                { icon: Globe, value: 'Global', label: 'Markets' },
              ].map(stat => (
                <div key={stat.label} className="space-y-1">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: `${gold}15` }}>
                    <stat.icon className="w-5 h-5" style={{ color: gold }} />
                  </div>
                  <p className="text-2xl md:text-3xl font-bold tabular-nums" style={{ color: gold }}>{stat.value}</p>
                  <p className="text-xs" style={{ color: textMuted }}>{stat.label}</p>
                </div>
              ))}
            </div>

            {/* Headshot placeholder */}
            <div className="hidden lg:block w-48 h-48 rounded-2xl overflow-hidden border-2 mt-4"
              style={{ borderColor: `${gold}30` }}>
              <div className="w-full h-full flex items-center justify-center text-5xl font-bold"
                style={{ background: `linear-gradient(135deg, ${gold}20, ${gold}05)`, color: gold }}>
                RS
              </div>
            </div>
          </div>

          {/* Right: Login Form */}
          <div id="login-section" className="lg:sticky lg:top-24">
            <div className="rounded-xl p-6 md:p-8 border backdrop-blur-xl"
              style={{ background: bgCard, borderColor: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(24px)' }}>
              <div className="space-y-1 mb-6">
                <h2 className="text-lg font-bold text-white">Access My Workspace</h2>
                <p className="text-sm" style={{ color: textMuted }}>Enter your credentials to continue</p>
              </div>

              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-sm" style={{ color: textLight }}>Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={e => { setEmail(e.target.value); setError(''); }}
                    className="h-11 border-white/10 text-white placeholder:text-zinc-600 focus:border-[#D4AF37] focus:ring-[#D4AF37]/20"
                    style={{ background: 'rgba(255,255,255,0.04)' }}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="password" className="text-sm" style={{ color: textLight }}>Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Enter your password"
                      value={password}
                      onChange={e => { setPassword(e.target.value); setError(''); }}
                      className="h-11 border-white/10 text-white placeholder:text-zinc-600 pr-10 focus:border-[#D4AF37] focus:ring-[#D4AF37]/20"
                      style={{ background: 'rgba(255,255,255,0.04)' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 hover:text-white transition-colors"
                      style={{ color: textMuted }}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Checkbox
                    id="remember"
                    checked={remember}
                    onCheckedChange={(v) => setRemember(v === true)}
                    className="border-zinc-600 data-[state=checked]:bg-[#D4AF37] data-[state=checked]:border-[#D4AF37]"
                  />
                  <Label htmlFor="remember" className="text-sm cursor-pointer" style={{ color: textMuted }}>Remember me</Label>
                </div>

                {error && (
                  <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-md px-3 py-2">{error}</p>
                )}

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-11 text-sm font-bold rounded-md transition-all press-scale"
                  style={{
                    background: loading ? '#9A8340' : `linear-gradient(135deg, ${gold}, ${goldLight})`,
                    color: bgDark,
                  }}
                >
                  {loading ? (
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  ) : 'LOGIN TO DEEPMINDQ'}
                </Button>

                <p className="text-[10px] text-center" style={{ color: textMuted }}>
                  Secured with enterprise-grade encryption. Your data stays private.
                </p>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* ══════ MISSION SECTION ══════ */}
      <section className="relative z-10 py-20 px-6 md:px-12 lg:px-20">
        <div className="max-w-4xl mx-auto text-center">
          <RevealSection>
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full mb-8"
              style={{ background: `${gold}12`, border: `2px solid ${gold}30` }}>
              <Target className="w-9 h-9" style={{ color: gold }} />
            </div>
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              My <span style={{ color: gold }}>Mission</span>
            </h2>
            <p className="text-lg leading-relaxed max-w-2xl mx-auto" style={{ color: textMuted }}>
              To bridge the gap between cutting-edge technology capabilities and enterprise business outcomes.
              I build deep, trust-based relationships with C-suite executives and translate complex AI &
              digital solutions into tangible revenue growth, operational efficiency, and strategic advantage
              for organizations across industries and geographies.
            </p>
          </RevealSection>
        </div>
      </section>

      {/* ══════ APPROACH SECTION ══════ */}
      <section className="relative z-10 py-20 px-6 md:px-12 lg:px-20" style={{ background: 'rgba(255,255,255,0.015)' }}>
        <div className="max-w-6xl mx-auto">
          <RevealSection>
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                My <span style={{ color: gold }}>Approach</span>
              </h2>
              <p className="text-base max-w-xl mx-auto" style={{ color: textMuted }}>
                A structured, intelligence-driven methodology for enterprise growth
              </p>
            </div>
          </RevealSection>

          <div className="grid md:grid-cols-5 gap-6">
            {[
              { icon: Search, title: 'Understand the Business', desc: 'Deep-dive into the company\'s operations, pain points, strategic goals, and competitive landscape to identify real opportunities.' },
              { icon: Lightbulb, title: 'Identify Strategic Opportunities', desc: 'Map technology capabilities to business challenges, uncovering high-impact areas where AI and digital solutions create measurable value.' },
              { icon: Cog, title: 'Align Technology Capabilities', desc: 'Match the right solutions — AI, cloud, analytics — to each opportunity, ensuring technical feasibility and business alignment.' },
              { icon: MessageSquare, title: 'Create Executive Conversations', desc: 'Craft compelling, value-driven narratives tailored for C-suite decision makers that resonate with their strategic priorities.' },
              { icon: TrendingUp, title: 'Drive Revenue Outcomes', desc: 'Convert relationships into closed deals through consultative selling, proof-of-value engagements, and long-term partnership building.' },
            ].map((step, i) => (
              <RevealSection key={step.title} delay={i * 100}>
                <div className="text-center space-y-3 p-4 rounded-xl border border-transparent hover:border-white/5 transition-colors"
                  style={{ background: 'rgba(255,255,255,0.02)' }}>
                  <div className="w-12 h-12 rounded-lg mx-auto flex items-center justify-center" style={{ background: `${gold}15` }}>
                    <step.icon className="w-6 h-6" style={{ color: gold }} />
                  </div>
                  <p className="text-xs font-bold mb-0" style={{ color: gold }}>STEP {i + 1}</p>
                  <h3 className="text-sm font-semibold text-white leading-tight">{step.title}</h3>
                  <p className="text-xs leading-relaxed" style={{ color: textMuted }}>{step.desc}</p>
                </div>
              </RevealSection>
            ))}
          </div>
        </div>
      </section>

      {/* ══════ WHAT I BRING SECTION ══════ */}
      <section className="relative z-10 py-20 px-6 md:px-12 lg:px-20">
        <div className="max-w-6xl mx-auto">
          <RevealSection>
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                What I <span style={{ color: gold }}>Bring</span>
              </h2>
              <p className="text-base max-w-xl mx-auto" style={{ color: textMuted }}>
                Core competencies that drive enterprise success
              </p>
            </div>
          </RevealSection>

          <div className="grid md:grid-cols-3 lg:grid-cols-5 gap-5">
            {[
              { icon: Users, title: 'Enterprise Sales Leadership', desc: 'Leading complex, multi-stakeholder sales cycles from qualification to close with strategic precision.' },
              { icon: MessageSquare, title: 'CXO Engagement', desc: 'Building trusted advisor relationships with C-level executives through insight-led conversations.' },
              { icon: BarChart3, title: 'Strategic Account Growth', desc: 'Expanding revenue within existing accounts through cross-sell, upsell, and deepening engagement.' },
              { icon: Handshake, title: 'Complex Deal Management', desc: 'Navigating procurement, legal, and technical evaluations to drive large enterprise deals to completion.' },
              { icon: BrainCircuit, title: 'AI & Digital Transformation', desc: 'Advising enterprises on AI adoption strategy, digital roadmaps, and technology-enabled transformation.' },
            ].map((item, i) => (
              <RevealSection key={item.title} delay={i * 80}>
                <div className="p-5 rounded-xl border transition-all hover:-translate-y-1 hover:border-white/10"
                  style={{ background: bgCard, borderColor: 'rgba(255,255,255,0.06)' }}>
                  <div className="w-11 h-11 rounded-lg flex items-center justify-center mb-4" style={{ background: `${gold}15` }}>
                    <item.icon className="w-5 h-5" style={{ color: gold }} />
                  </div>
                  <h3 className="text-sm font-semibold text-white mb-2">{item.title}</h3>
                  <p className="text-xs leading-relaxed" style={{ color: textMuted }}>{item.desc}</p>
                </div>
              </RevealSection>
            ))}
          </div>
        </div>
      </section>

      {/* ══════ DEEPMINDQ FRAMEWORK SECTION ══════ */}
      <section className="relative z-10 py-20 px-6 md:px-12 lg:px-20" style={{ background: 'rgba(255,255,255,0.015)' }}>
        <div className="max-w-5xl mx-auto">
          <RevealSection>
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                The DeepMind<span style={{ color: gold }}>Q</span> Framework
              </h2>
              <p className="text-base max-w-xl mx-auto" style={{ color: textMuted }}>
                An intelligence-driven system for enterprise sales acceleration
              </p>
            </div>
          </RevealSection>

          <RevealSection>
            <div className="relative flex items-center justify-center py-8">
              {/* Center brain icon */}
              <div className="w-24 h-24 rounded-full flex items-center justify-center z-10"
                style={{ background: `linear-gradient(135deg, ${gold}, ${goldLight})`, boxShadow: `0 0 60px ${gold}40` }}>
                <Brain className="w-12 h-12 text-white" />
              </div>

              {/* Orbiting nodes */}
              <div className="absolute w-[420px] h-[420px] md:w-[500px] md:h-[500px]">
                {[
                  { icon: Search, label: 'Research & Intelligence', angle: -60, color: '#3B82F6' },
                  { icon: Crosshair, label: 'Opportunity Mapping', angle: 0, color: '#8B5CF6' },
                  { icon: Users, label: 'Executive Engagement', angle: 60, color: '#10B981' },
                  { icon: MessageSquare, label: 'Value-Based Conversations', angle: 120, color: '#F59E0B' },
                  { icon: TrendingUp, label: 'Growth & Revenue Acceleration', angle: 180, color: '#EF4444' },
                ].map((node, i) => {
                  const rad = (node.angle * Math.PI) / 180;
                  const r = 210;
                  const x = 50 + (r * Math.cos(rad)) / 5;
                  const y = 50 - (r * Math.sin(rad)) / 5;
                  return (
                    <div
                      key={node.label}
                      className="absolute flex flex-col items-center gap-2 text-center"
                      style={{ left: `${x}%`, top: `${y}%`, transform: 'translate(-50%, -50%)' }}
                    >
                      <div className="w-14 h-14 rounded-full flex items-center justify-center border-2"
                        style={{ background: `${node.color}15`, borderColor: `${node.color}40` }}>
                        <node.icon className="w-6 h-6" style={{ color: node.color }} />
                      </div>
                      <span className="text-[11px] font-medium max-w-[100px] leading-tight" style={{ color: textLight }}>
                        {node.label}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Decorative ring */}
              <div className="absolute w-[340px] h-[340px] md:w-[420px] md:h-[420px] rounded-full border border-dashed opacity-20"
                style={{ borderColor: gold }} />
            </div>
          </RevealSection>
        </div>
      </section>

      {/* ══════ TECHNOLOGY & SOLUTION FOCUS ══════ */}
      <section className="relative z-10 py-20 px-6 md:px-12 lg:px-20">
        <div className="max-w-5xl mx-auto">
          <RevealSection>
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Technology & <span style={{ color: gold }}>Solution</span> Focus
              </h2>
              <p className="text-base max-w-xl mx-auto" style={{ color: textMuted }}>
                Enterprise-grade technologies I specialize in
              </p>
            </div>
          </RevealSection>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-5">
            {[
              { icon: Bot, title: 'AI & Automation', color: '#3B82F6' },
              { icon: Cloud, title: 'Cloud & Infrastructure', color: '#8B5CF6' },
              { icon: Database, title: 'Data & Analytics', color: '#6366F1' },
              { icon: Code2, title: 'Digital Engineering', color: '#A855F7' },
              { icon: Layers, title: 'Enterprise Applications', color: '#10B981' },
            ].map((item, i) => (
              <RevealSection key={item.title} delay={i * 80}>
                <div className="flex flex-col items-center gap-3 p-5 rounded-xl border transition-all hover:-translate-y-1"
                  style={{ background: bgCard, borderColor: 'rgba(255,255,255,0.06)' }}>
                  <div className="w-14 h-14 rounded-xl flex items-center justify-center"
                    style={{ background: `${item.color}18` }}>
                    <item.icon className="w-7 h-7" style={{ color: item.color }} />
                  </div>
                  <h3 className="text-sm font-semibold text-white text-center">{item.title}</h3>
                </div>
              </RevealSection>
            ))}
          </div>
        </div>
      </section>

      {/* ══════ QUOTE / TESTIMONIAL SECTION ══════ */}
      <section className="relative z-10 py-24 px-6 md:px-12 lg:px-20" style={{ background: 'rgba(255,255,255,0.015)' }}>
        <div className="max-w-3xl mx-auto text-center">
          <RevealSection>
            <div className="space-y-8">
              <div className="text-6xl font-serif leading-none" style={{ color: `${gold}40` }}>"</div>
              <blockquote className="text-xl md:text-2xl italic leading-relaxed" style={{ color: textLight }}>
                Every enterprise has untapped potential hidden in its data, processes, and people.
                My role is to find it, frame it, and deliver it as measurable business value through
                the right technology and the right conversations at the right time.
              </blockquote>
              <div className="space-y-1">
                <p className="text-xl font-bold" style={{ color: gold }}>Ravi Shanker</p>
                <p className="text-sm" style={{ color: textMuted }}>Enterprise Growth Leader</p>
              </div>
              <div className="flex items-center justify-center gap-2 pt-4">
                <ShieldCheck className="w-5 h-5" style={{ color: gold }} />
                <span className="text-sm font-medium" style={{ color: textMuted }}>
                  Private. Focused. Results Driven.
                </span>
              </div>
              <p className="text-xs mt-4 max-w-md mx-auto leading-relaxed" style={{ color: textMuted }}>
                DeepMindQ is my personal intelligence workspace — a proprietary system designed to
                research, engage, and convert enterprise opportunities with precision and scale.
              </p>
            </div>
          </RevealSection>
        </div>
      </section>

      {/* ══════ FOOTER ══════ */}
      <footer className="relative z-10 py-10 px-6 md:px-12 lg:px-20 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-md flex items-center justify-center"
              style={{ background: `linear-gradient(135deg, ${gold}, ${goldLight})` }}>
              <Brain className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-bold">
              DeepMind<span style={{ color: gold }}>Q</span>
            </span>
          </div>
          <p className="text-xs" style={{ color: textMuted }}>
            &copy; 2026 DeepMindQ. All rights reserved. Built with intelligence. Driven by purpose.
          </p>
          <p className="text-xs" style={{ color: textMuted }}>
            Let&apos;s connect and create impact.
          </p>
        </div>
      </footer>
    </div>
  );
}