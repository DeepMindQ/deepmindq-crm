'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Shield, Zap, Target, BarChart3, KeyRound, Loader2, CheckCircle2 } from 'lucide-react'

type AuthStep = 'email' | 'otp'

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectPath = searchParams.get('redirect') || '/'

  // Email state
  const [email, setEmail] = useState('')

  // OTP state
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', ''])

  // UI state
  const [step, setStep] = useState<AuthStep>('email')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [otpEmail, setOtpEmail] = useState('')
  const [otpSent, setOtpSent] = useState(false)

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/auth/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), purpose: 'login' }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Failed to send OTP')
        setLoading(false)
        return
      }

      setOtpEmail(email.trim())
      setOtpSent(true)
      setStep('otp')
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleOtpVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const code = otpDigits.join('')
    if (code.length !== 6) {
      setError('Please enter all 6 digits')
      setLoading(false)
      return
    }

    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: otpEmail, code, purpose: 'login' }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Verification failed')
        setLoading(false)
        return
      }

      // Session created — redirect to dashboard
      router.push(redirectPath)
      router.refresh()
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleOtpDigitChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return
    const newDigits = [...otpDigits]
    newDigits[index] = value.slice(-1)
    setOtpDigits(newDigits)

    if (value && index < 5) {
      document.getElementById(`otp-${index + 1}`)?.focus()
    }
  }

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      document.getElementById(`otp-${index - 1}`)?.focus()
    }
  }

  const handleBackToEmail = () => {
    setStep('email')
    setError('')
    setOtpDigits(['', '', '', '', '', ''])
    setOtpSent(false)
  }

  const handleResendOtp = async () => {
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: otpEmail, purpose: 'login' }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to resend OTP')
      } else {
        setOtpSent(true)
      }
    } catch {
      setError('Network error.')
    } finally {
      setLoading(false)
    }
  }

  const features = [
    { icon: Target, label: 'Company Intelligence', desc: '10K+ companies' },
    { icon: Zap, label: 'AI-Powered Insights', desc: 'Real-time analysis' },
    { icon: BarChart3, label: 'Smart Analytics', desc: 'Pipeline visibility' },
    { icon: Shield, label: 'Enterprise Security', desc: 'OTP authentication' },
  ]

  return (
    <div className="min-h-screen flex bg-[#0a0a0f]">
      {/* Left Panel — Branding */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="hidden lg:flex lg:w-[55%] relative overflow-hidden flex-col justify-between p-12 xl:p-16"
        style={{ background: 'linear-gradient(135deg, #0a0a1a 0%, #111128 40%, #0d0d20 100%)' }}
      >
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute w-[600px] h-[600px] rounded-full opacity-[0.07]" style={{ background: 'radial-gradient(circle, #d4af37 0%, transparent 70%)', top: '-10%', right: '-10%' }} />
          <div className="absolute w-[400px] h-[400px] rounded-full opacity-[0.04]" style={{ background: 'radial-gradient(circle, #d4af37 0%, transparent 70%)', bottom: '10%', left: '-5%' }} />
          <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(rgba(212,175,55,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(212,175,55,0.3) 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #d4af37, #b8941f)' }}>
              <span className="text-[#0a0a1a] font-bold text-lg">Q</span>
            </div>
            <div>
              <h1 className="text-white font-bold text-xl tracking-tight">DeepMind<span style={{ color: '#d4af37' }}>Q</span></h1>
            </div>
          </div>
        </div>

        <div className="relative z-10 space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium" style={{ background: 'rgba(212,175,55,0.12)', color: '#d4af37', border: '1px solid rgba(212,175,55,0.2)' }}>
            <div className="w-1.5 h-1.5 rounded-full bg-[#d4af37] animate-pulse" />
            Enterprise Intelligence Workspace
          </div>
          <h2 className="text-4xl xl:text-5xl font-bold text-white leading-tight" style={{ letterSpacing: '-0.025em' }}>
            Welcome back to
            <br />
            <span style={{ color: '#d4af37' }}>your workspace</span>
          </h2>
          <p className="text-gray-400 text-lg max-w-md leading-relaxed">
            AI-powered platform for enterprise sales intelligence. Discover companies, enrich contacts, and close deals faster.
          </p>
          <div className="grid grid-cols-2 gap-3 pt-4">
            {features.map((f, i) => (
              <motion.div key={f.label} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.3 + i * 0.1 }} className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
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

        <div className="relative z-10">
          <p className="text-gray-600 text-xs">DeepMindQ &mdash; Built for focus. Designed for results. Yours.</p>
        </div>
      </motion.div>

      {/* Right Panel — Auth Form */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5, delay: 0.1 }} className="w-full lg:w-[45%] flex items-center justify-center p-6 sm:p-10" style={{ background: '#fafaf9' }}>
        <div className="w-full max-w-[380px] space-y-8">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2.5 mb-2">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #d4af37, #b8941f)' }}>
              <span className="text-[#0a0a1a] font-bold text-base">Q</span>
            </div>
            <span className="text-gray-900 font-bold text-lg">DeepMind<span style={{ color: '#d4af37' }}>Q</span></span>
          </div>

          <AnimatePresence mode="wait">
            {/* ── EMAIL STEP ── */}
            {step === 'email' && (
              <motion.div key="email" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }}>
                <div>
                  <h3 className="text-2xl font-bold text-gray-900 tracking-tight">Access Your Workspace</h3>
                  <p className="text-gray-500 text-sm mt-1.5">Enter your email to receive a verification code</p>
                </div>

                <form onSubmit={handleRequestOtp} className="mt-6 space-y-4">
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
                      autoComplete="email"
                    />
                    <p className="text-xs text-gray-500">We&apos;ll send a 6-digit verification code to your email.</p>
                  </div>

                  <AnimatePresence>
                    {error && (
                      <motion.p initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</motion.p>
                    )}
                  </AnimatePresence>

                  <motion.button type="submit" disabled={loading} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }} className="w-full h-11 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-70" style={{ background: 'linear-gradient(135deg, #d4af37, #c49b2a)', color: '#0a0a1a' }}>
                    {loading ? <div className="w-5 h-5 border-2 border-[#0a0a1a]/20 border-t-[#0a0a1a] rounded-full animate-spin" /> : <><KeyRound className="w-4 h-4" /> SEND VERIFICATION CODE</>}
                  </motion.button>
                </form>
              </motion.div>
            )}

            {/* ── OTP VERIFICATION STEP ── */}
            {step === 'otp' && (
              <motion.div key="otp" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }}>
                <div>
                  <button type="button" onClick={handleBackToEmail} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors mb-4">
                    <ArrowLeft className="w-4 h-4" /> Back
                  </button>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'rgba(212,175,55,0.12)' }}>
                      <KeyRound className="w-5 h-5" style={{ color: '#d4af37' }} />
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 tracking-tight">Verify Code</h3>
                  </div>
                  <p className="text-gray-500 text-sm">
                    Enter the 6-digit code sent to <span className="font-medium text-gray-700">{otpEmail}</span>
                  </p>
                  {otpSent && (
                    <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Code sent successfully
                    </p>
                  )}
                </div>

                <form onSubmit={handleOtpVerify} className="mt-6 space-y-6">
                  <div className="flex justify-center gap-2">
                    {otpDigits.map((digit, index) => (
                      <input key={index} id={`otp-${index}`} type="text" inputMode="numeric" maxLength={1} value={digit} onChange={(e) => handleOtpDigitChange(index, e.target.value)} onKeyDown={(e) => handleOtpKeyDown(index, e)} className="w-12 h-14 text-center text-xl font-bold rounded-xl border-2 border-gray-200 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#d4af37]/30 focus:border-[#d4af37] transition-all" autoComplete="one-time-code" />
                    ))}
                  </div>

                  <AnimatePresence>
                    {error && (
                      <motion.p initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 text-center">{error}</motion.p>
                    )}
                  </AnimatePresence>

                  <motion.button type="submit" disabled={loading || otpDigits.join('').length !== 6} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }} className="w-full h-11 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-70" style={{ background: 'linear-gradient(135deg, #d4af37, #c49b2a)', color: '#0a0a1a' }}>
                    {loading ? <div className="w-5 h-5 border-2 border-[#0a0a1a]/20 border-t-[#0a0a1a] rounded-full animate-spin" /> : <><CheckCircle2 className="w-4 h-4" /> VERIFY & CONTINUE</>}
                  </motion.button>

                  <div className="text-center">
                    <button type="button" onClick={handleResendOtp} disabled={loading} className="text-sm text-amber-600 hover:text-amber-500 font-medium transition-colors disabled:opacity-50">
                      Didn&apos;t receive the code? Resend
                    </button>
                  </div>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  )
}
