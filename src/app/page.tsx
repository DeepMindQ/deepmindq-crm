'use client'

import { useEffect, useRef } from 'react'
import { motion, useInView } from 'framer-motion'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import {
  ArrowRight, Brain, Mail, ShieldCheck, BarChart3, CheckCircle2,
  Zap, ChevronDown,
} from 'lucide-react'

function FadeIn({ children, className, delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-80px' })
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

const features = [
  { icon: Brain, title: 'AI-Powered Research', desc: 'Automatically enrich company profiles with business intelligence, tech landscape analysis, and opportunity signals that your team can act on instantly.' },
  { icon: Mail, title: 'Smart Email Generation', desc: 'Generate hyper-personalized outreach emails that sound human. Tone, length, and CTA all adapt to your target prospect.' },
  { icon: ShieldCheck, title: 'Real-Time Email Verification', desc: 'Validate every email address before you hit send. Know deliverability, catch disposable domains, and protect your sender reputation.' },
  { icon: BarChart3, title: 'Pipeline Intelligence', desc: 'Track every company from first touch to closed-won. Visual pipeline, status automation, and conversion analytics.' },
]

const steps = [
  { num: '01', title: 'Import Your Leads', desc: 'Upload a CSV with your target accounts and contacts. We handle deduplication and enrichment automatically.' },
  { num: '02', title: 'AI Enriches Everything', desc: 'Research cards, email validation, intelligence scoring, and opportunity detection — all powered by AI.' },
  { num: '03', title: 'Close Deals Faster', desc: 'Generate personalized outreach, track engagement, and convert cold leads into warm opportunities.' },
]

const stats = [
  { value: '10,000+', label: 'Companies Enriched' },
  { value: '85%', label: 'Email Accuracy' },
  { value: '3x', label: 'Faster Outreach' },
  { value: '50+', label: 'AI Drafts / Hour' },
]

const trustedBy = ['TechCorp', 'GlobalMfg', 'Acme Corp', 'FinEdge', 'DataFlow', 'CloudBase']

export default function LandingPage() {
  const router = useRouter()
  const featuresRef = useRef(null)
  const stepsRef = useRef(null)
  const statsRef = useRef(null)
  const ctaRef = useRef(null)
  const isStepsInView = useInView(stepsRef, { once: true, margin: '-60px' })

  useEffect(() => { document.body.style.background = '#0a0a0f' }, [])

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      {/* ── Navbar ── */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-[#0a0a0f]/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-6xl mx-auto flex items-center justify-between h-16 px-6">
          <div className="flex items-center gap-2.5">
            <Image src="/logo.png" alt="DeepMindQ" width={28} height={28} className="rounded" />
            <span className="text-[15px] font-semibold tracking-tight">Deep<span className="text-amber-400">MindQ</span></span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm text-gray-400">
            {['Features', 'Pricing', 'About'].map(s => (
              <a key={s} href={`#${s.toLowerCase()}`} className="hover:text-white transition-colors">{s}</a>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => router.push('/login')} className="text-sm text-gray-400 hover:text-white transition-colors hidden sm:block">
              Login
            </button>
            <button onClick={() => router.push('/login')} className="bg-amber-500 hover:bg-amber-400 text-black font-semibold text-sm px-4 py-2 rounded-lg transition-colors press-scale">
              Get Started <ArrowRight className="size-4 ml-1 inline" />
            </button>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <FadeIn>
            <div className="inline-flex items-center gap-2 rounded-full bg-amber-500/10 px-4 py-1.5 mb-6">
              <Zap className="size-4 text-amber-400" />
              <span className="text-sm font-medium text-amber-300">AI-Powered Sales Intelligence</span>
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1] mb-6">
              Turn Cold Leads Into
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-orange-300 to-amber-500">Closed Deals</span>
              {' '}— With AI That Thinks
              <br />
              Like Your Best Rep
            </h1>
            <p className="text-lg text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
              Discover companies, enrich contacts, generate personalized outreach, and close deals — all from one intelligent platform.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button onClick={() => router.push('/login')} className="bg-amber-500 hover:bg-amber-400 text-black font-semibold text-base px-8 py-3.5 rounded-xl transition-all duration-200 hover:shadow-lg hover:shadow-amber-500/20 press-scale">
                Start Free <ArrowRight className="size-5 ml-1 inline" />
              </button>
              <button className="border border-white/20 text-white font-medium text-base px-8 py-3.5 rounded-xl hover:bg-white/5 transition-all duration-200">
                Watch Demo
              </button>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ── Trusted By ── */}
      <section className="py-12 px-6 border-y border-white/5">
        <FadeIn>
          <p className="text-center text-xs uppercase tracking-widest text-gray-500 mb-8">Trusted by forward-thinking teams</p>
          <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-3">
            {trustedBy.map(name => (
              <span key={name} className="text-sm font-medium text-gray-500/60 whitespace-nowrap">{name}</span>
            ))}
          </div>
        </FadeIn>
      </section>

      {/* ── Features ── */}
      <section className="py-20 px-6" id="features">
        <div className="max-w-6xl mx-auto">
          <FadeIn>
            <p className="text-center text-xs uppercase tracking-widest text-amber-500 font-medium mb-3">Features</p>
            <h2 className="text-3xl font-bold text-center tracking-tight mb-12">Everything you need to close more deals</h2>
          </FadeIn>
          <div ref={featuresRef} className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {features.map((f, i) => {
              const Icon = f.icon
              return (
                <FadeIn key={f.title} delay={i * 100}>
                  <div className="group rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6 hover:bg-white/[0.06] transition-all duration-300">
                    <div className="size-12 rounded-xl bg-amber-500/10 flex items-center justify-center mb-4 group-hover:bg-amber-500/20 transition-colors duration-300">
                      <Icon className="size-6 text-amber-400" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">{f.title}</h3>
                    <p className="text-sm text-gray-400 leading-relaxed">{f.desc}</p>
                  </div>
                </FadeIn>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <FadeIn>
            <p className="text-center text-xs uppercase tracking-widest text-amber-500 font-medium mb-3">How It Works</p>
            <h2 className="text-3xl font-bold text-center tracking-tight mb-12">Three steps to intelligent outreach</h2>
          </FadeIn>
          <div ref={stepsRef} className="space-y-0">
            {steps.map((step, i) => (
              <FadeIn key={step.num} delay={i * 120}>
                <div className="flex items-start gap-6">
                  <div className="flex flex-col items-center shrink-0">
                    <div className={`size-10 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all duration-500 ${isStepsInView ? 'bg-amber-500 border-amber-500 text-black' : 'border-white/20 text-gray-500'}`}>
                      {step.num}
                    </div>
                    {i < 2 && <div className="w-px h-12 border-l border-dashed border-white/10 mt-3" />}
                  </div>
                  <div className="pt-1">
                    <h4 className="text-base font-semibold mb-1">{step.title}</h4>
                    <p className="text-sm text-gray-400 leading-relaxed">{step.desc}</p>
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── Stats ── */}
      <section className="py-16 px-6">
        <FadeIn ref={statsRef}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto">
            {stats.map((s, i) => (
              <div key={s.label} className="text-center">
                <p className="text-4xl font-bold text-amber-400 tracking-tight">{s.value}</p>
                <p className="text-sm text-gray-500 mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        </FadeIn>
      </section>

      {/* ── CTA ── */}
      <section className="py-20 px-6">
        <FadeIn ref={ctaRef}>
          <div className="max-w-2xl mx-auto text-center rounded-2xl bg-gradient-to-br from-amber-600/10 to-amber-600/5 border border-amber-500/20 p-12">
            <h2 className="text-2xl font-bold tracking-tight mb-3">Ready to Transform Your Sales?</h2>
            <p className="text-gray-400 mb-6">Join thousands of sales teams using AI to close more deals, faster.</p>
            <button onClick={() => router.push('/login')} className="bg-amber-500 hover:bg-amber-400 text-black font-semibold text-base px-8 py-3.5 rounded-xl transition-all duration-200 hover:shadow-lg hover:shadow-amber-500/20 press-scale">
              Get Started Free <ArrowRight className="size-5 ml-1 inline" />
            </button>
          </div>
        </FadeIn>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-white/5 py-12 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
            <div>
              <h4 className="text-sm font-semibold mb-4">Product</h4>
              <ul className="space-y-2.5 text-sm text-gray-500">
                <li><a href="#features" className="hover:text-gray-300 transition-colors">Features</a></li>
                <li><a href="#" className="hover:text-gray-300 transition-colors">Pricing</a></li>
                <li><a href="#" className="hover:text-gray-300 transition-colors">Integrations</a></li>
                <li><a href="#" className="hover:text-gray-300 transition-colors">API Docs</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold mb-4">Company</h4>
              <ul className="space-y-2.5 text-sm text-gray-500">
                <li><a href="#" className="hover:text-gray-300 transition-colors">About</a></li>
                <li><a href="#" className="hover:text-gray-300 transition-colors">Blog</a></li>
                <li><a href="#" className="hover:text-gray-300 transition-colors">Careers</a></li>
                <li><a href="#" className="hover:text-gray-300 transition-colors">Contact</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold mb-4">Legal</h4>
              <ul className="space-y-2.5 text-sm text-gray-500">
                <li><a href="#" className="hover:text-gray-300 transition-colors">Privacy</a></li>
                <li><a href="#" className="hover:text-gray-300 transition-colors">Terms</a></li>
                <li><a href="#" className="hover:text-gray-300 transition-colors">Security</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold mb-4">Connect</h4>
              <ul className="space-y-2.5 text-sm text-gray-500">
                <li><a href="#" className="hover:text-gray-300 transition-colors">Twitter</a></li>
                <li><a href="#" className="hover:text-gray-300 transition-colors">LinkedIn</a></li>
                <li><a href="#" className="hover:text-gray-300 transition-colors">GitHub</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-white/5 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <Image src="/logo.png" alt="DeepMindQ" width={22} height={22} className="rounded" />
              <span className="text-sm font-semibold text-gray-400">DeepMindQ</span>
            </div>
            <p className="text-xs text-gray-600">© 2025 DeepMindQ. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}