'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Eye, EyeOff, ArrowRight, Shield, Zap, Target, BarChart3 } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('ravi@deepmindq.com')
  const [password, setPassword] = useState('admin123')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      // Try real auth first
      const res = await fetch('/api/auth/callback/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ email, password, callbackUrl: '/' }),
      })

      if (res.ok) {
        router.push('/')
        router.refresh()
        return
      }
    } catch {
      // DB not available — use mock auth
    }

    // Mock auth fallback for demo
    if (email && password) {
      // Store mock session in localStorage
      const mockSession = {
        user: { id: 'demo-1', name: 'Ravi Shanker', email, role: 'admin', image: null },
        expires: new Date(Date.now() + 86400000).toISOString(),
      }
      localStorage.setItem('deepmindq-session', JSON.stringify(mockSession))
      // Set a cookie so next-auth doesn't redirect
      document.cookie = 'next-auth.session-token=mock-demo-session; path=/; max-age=86400'
      document.cookie = 'deepmindq-mock-auth=true; path=/; max-age=86400'
      router.push('/')
      router.refresh()
    } else {
      setError('Please enter email and password')
    }

    setLoading(false)
  }

  const features = [
    { icon: Target, label: 'Company Intelligence', desc: '250K+ companies' },
    { icon: Zap, label: 'AI Email Generation', desc: 'Personalized outreach' },
    { icon: BarChart3, label: 'Smart Analytics', desc: 'Real-time insights' },
    { icon: Shield, label: 'Enterprise Security', desc: 'SOC2 compliant' },
  ]

  return (
    <div className="min-h-screen flex bg-[#0a0a0f]">
      {/* Left Panel — Branding */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="hidden lg:flex lg:w-[55%] relative overflow-hidden flex-col justify-between p-12 xl:p-16"
        style={{
          background: 'linear-gradient(135deg, #0a0a1a 0%, #111128 40%, #0d0d20 100%)',
        }}
      >
        {/* Decorative elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div
            className="absolute w-[600px] h-[600px] rounded-full opacity-[0.07]"
            style={{
              background: 'radial-gradient(circle, #d4af37 0%, transparent 70%)',
              top: '-10%',
              right: '-10%',
            }}
          />
          <div
            className="absolute w-[400px] h-[400px] rounded-full opacity-[0.04]"
            style={{
              background: 'radial-gradient(circle, #d4af37 0%, transparent 70%)',
              bottom: '10%',
              left: '-5%',
            }}
          />
          {/* Grid pattern */}
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: 'linear-gradient(rgba(212,175,55,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(212,175,55,0.3) 1px, transparent 1px)',
              backgroundSize: '60px 60px',
            }}
          />
        </div>

        {/* Logo */}
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #d4af37, #b8941f)' }}
            >
              <span className="text-[#0a0a1a] font-bold text-lg">Q</span>
            </div>
            <div>
              <h1 className="text-white font-bold text-xl tracking-tight">
                DeepMind<span style={{ color: '#d4af37' }}>Q</span>
              </h1>
            </div>
          </div>
        </div>

        {/* Welcome message */}
        <div className="relative z-10 space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium" style={{ background: 'rgba(212,175,55,0.12)', color: '#d4af37', border: '1px solid rgba(212,175,55,0.2)' }}>
            <div className="w-1.5 h-1.5 rounded-full bg-[#d4af37] animate-pulse" />
            Enterprise Sales Intelligence
          </div>
          <h2 className="text-4xl xl:text-5xl font-bold text-white leading-tight" style={{ letterSpacing: '-0.025em' }}>
            Welcome back to
            <br />
            <span style={{ color: '#d4af37' }}>your workspace</span>
          </h2>
          <p className="text-gray-400 text-lg max-w-md leading-relaxed">
            AI-powered platform for enterprise sales intelligence. Discover companies, enrich contacts, and close deals faster.
          </p>

          {/* Feature grid */}
          <div className="grid grid-cols-2 gap-3 pt-4">
            {features.map((f, i) => (
              <motion.div
                key={f.label}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.3 + i * 0.1 }}
                className="flex items-center gap-3 px-4 py-3 rounded-xl"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
              >
                <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(212,175,55,0.12)' }}>
                  <f.icon className="w-4 h-4" style={{ color: '#d4af37' }} />
                </div>
                <div>
                  <div className="text-white text-sm font-medium">{f.label}</div>
                  <div className="text-gray-500 text-xs">{f.desc}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10">
          <p className="text-gray-600 text-xs">
            DeepMindQ &mdash; Built for focus. Designed for results. Yours.
          </p>
        </div>
      </motion.div>

      {/* Right Panel — Login Form */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="w-full lg:w-[45%] flex items-center justify-center p-6 sm:p-10"
        style={{ background: '#fafaf9' }}
      >
        <div className="w-full max-w-[380px] space-y-8">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2.5 mb-2">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #d4af37, #b8941f)' }}
            >
              <span className="text-[#0a0a1a] font-bold text-base">Q</span>
            </div>
            <span className="text-gray-900 font-bold text-lg">
              DeepMind<span style={{ color: '#d4af37' }}>Q</span>
            </span>
          </div>

          <div>
            <h3 className="text-2xl font-bold text-gray-900 tracking-tight">Access Your Workspace</h3>
            <p className="text-gray-500 text-sm mt-1.5">Enter your credentials to continue</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            {/* Email */}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700" htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-11 px-3.5 rounded-lg border border-gray-200 bg-white text-gray-900 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#d4af37]/30 focus:border-[#d4af37] transition-all"
                placeholder="you@company.com"
                required
              />
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700" htmlFor="password">Password</label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-11 px-3.5 pr-10 rounded-lg border border-gray-200 bg-white text-gray-900 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#d4af37]/30 focus:border-[#d4af37] transition-all"
                  placeholder="Enter your password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Remember + Forgot */}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" defaultChecked className="w-4 h-4 rounded border-gray-300 accent-[#d4af37]" />
                <span className="text-sm text-gray-600">Remember me</span>
              </label>
            </div>

            {/* Error */}
            <AnimatePresence>
              {error && (
                <motion.p
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2"
                >
                  {error}
                </motion.p>
              )}
            </AnimatePresence>

            {/* Submit */}
            <motion.button
              type="submit"
              disabled={loading}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              className="w-full h-11 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-70"
              style={{
                background: 'linear-gradient(135deg, #d4af37, #c49b2a)',
                color: '#0a0a1a',
              }}
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-[#0a0a1a]/20 border-t-[#0a0a1a] rounded-full animate-spin" />
              ) : (
                <>
                  LOGIN
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </motion.button>
          </form>

          {/* Demo credentials hint */}
          <div className="text-center">
            <p className="text-xs text-gray-400">
              Demo: Use any email &amp; password to explore
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  )
}