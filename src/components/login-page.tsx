'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
  InputOTPSeparator,
} from '@/components/ui/input-otp';
import {
  Brain, Eye, EyeOff, ArrowRight, Loader2, Mail,
  ShieldCheck, Lock, KeyRound, ArrowLeft, CheckCircle2, RefreshCw,
} from 'lucide-react';

/* ═══════════════════════════════════════════════════
   Design Tokens (matching landing page)
   ═══════════════════════════════════════════════════ */
const C = {
  gold: '#B8860B',
  goldLight: '#D4A843',
  text: '#111827',
  textMuted: '#6B7280',
};

type LoginStep = 'email' | 'password' | 'otp' | 'set_password' | 'success';
type LoginMode = 'otp' | 'password';

interface LoginPageProps {
  onLogin: () => void;
  initialEmail?: string;
}

export default function LoginPage({ onLogin, initialEmail }: LoginPageProps) {
  const [step, setStep] = useState<LoginStep>('email');
  const [mode, setMode] = useState<LoginMode>('otp');
  const [email, setEmail] = useState(initialEmail || '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [otpSentTo, setOtpSentTo] = useState('');
  const [needsPassword, setNeedsPassword] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const otpRef = useRef<HTMLInputElement | null>(null);

  // Countdown timer for resend
  useEffect(() => {
    if (countdown > 0) {
      timerRef.current = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => {
        if (timerRef.current) clearTimeout(timerRef.current);
      };
    }
  }, [countdown]);

  // Auto-focus OTP input
  useEffect(() => {
    if (step === 'otp') {
      setTimeout(() => {
        const firstSlot = document.querySelector('[data-slot="input-otp-slot"]');
        if (firstSlot) (firstSlot as HTMLElement).focus();
      }, 100);
    }
  }, [step]);

  const startCountdown = useCallback(() => {
    setCountdown(60);
  }, []);

  /* ── Step 1: Send OTP ── */
  const handleRequestOtp = async () => {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email address');
      return;
    }
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.toLowerCase().trim(), purpose: 'login' }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to send OTP');
        setLoading(false);
        return;
      }

      if (data.devCode) setDevCode(data.devCode);
      setOtpSentTo(email.toLowerCase().trim());
      setStep('otp');
      startCountdown();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  /* ── Step: Login with Password → sends OTP ── */
  const handlePasswordSubmit = async () => {
    if (!password) {
      setError('Please enter your password');
      return;
    }
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.toLowerCase().trim(), password }),
      });
      const data = await res.json();

      if (!res.ok) {
        if (data.needsOtpLogin) {
          // No password set yet — switch to OTP mode
          setError('');
          setMode('otp');
          handleRequestOtp();
          return;
        }
        setError(data.error || 'Invalid credentials');
        setLoading(false);
        return;
      }

      if (data.devCode) setDevCode(data.devCode);
      setOtpSentTo(email.toLowerCase().trim());
      setStep('otp');
      startCountdown();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  /* ── Step 2: Verify OTP ── */
  const handleVerifyOtp = async () => {
    if (otp.length !== 6) {
      setError('Please enter the complete 6-digit code');
      return;
    }
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: otpSentTo,
          code: otp,
          purpose: 'login',
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Verification failed');
        setLoading(false);
        return;
      }

      if (data.needsPassword) {
        setNeedsPassword(true);
        setStep('set_password');
        setLoading(false);
        return;
      }

      // Success — logged in
      setStep('success');
      setTimeout(() => onLogin(), 600);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  /* ── Step 3: Set Password (first time) ── */
  const handleSetPassword = async () => {
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/set-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: otpSentTo,
          otpCode: otp,
          password: newPassword,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to set password');
        setLoading(false);
        return;
      }

      setStep('success');
      setTimeout(() => onLogin(), 600);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  /* ── Resend OTP ── */
  const handleResend = async () => {
    if (countdown > 0) return;
    setDevCode(null);
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: otpSentTo, purpose: 'login' }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to resend OTP');
      } else {
        if (data.devCode) setDevCode(data.devCode);
        startCountdown();
      }
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  const backToEmail = () => {
    setStep('email');
    setOtp('');
    setError('');
    setDevCode(null);
    setPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto"
      style={{
        background: 'linear-gradient(135deg, #0a0c10 0%, #111827 50%, #0a0c10 100%)',
        fontFamily: "var(--font-inter), system-ui, sans-serif",
      }}
    >
      {/* Background decoration */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full opacity-[0.03]"
          style={{ background: `radial-gradient(circle, ${C.gold}, transparent 70%)` }}
        />
        <div
          className="absolute bottom-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full opacity-[0.03]"
          style={{ background: `radial-gradient(circle, ${C.goldLight}, transparent 70%)` }}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="relative w-full max-w-md"
      >
        {/* Logo & Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4"
            style={{ background: `linear-gradient(135deg, ${C.gold}, ${C.goldLight})` }}
          >
            <Brain className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Welcome to DeepMindQ</h1>
          <p className="text-sm mt-2" style={{ color: C.textMuted }}>
            {step === 'email' && 'Sign in with your email to continue'}
            {step === 'password' && 'Enter your password'}
            {step === 'otp' && `Enter the code sent to ${otpSentTo}`}
            {step === 'set_password' && 'Create your password to secure your account'}
            {step === 'success' && 'Login successful!'}
          </p>
        </div>

        {/* Card */}
        <div
          className="rounded-2xl p-8 shadow-2xl border"
          style={{
            background: 'rgba(17, 24, 39, 0.8)',
            borderColor: 'rgba(184, 134, 11, 0.15)',
            backdropFilter: 'blur(20px)',
          }}
        >
          <AnimatePresence mode="wait">
            {/* ── EMAIL STEP ── */}
            {step === 'email' && (
              <motion.div
                key="email"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.25 }}
              >
                <div className="space-y-5">
                  <div>
                    <Label htmlFor="email" className="text-gray-300 text-sm mb-1.5 block">Email Address</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                      <Input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && (mode === 'otp' ? handleRequestOtp() : handlePasswordSubmit())}
                        placeholder="you@example.com"
                        className="pl-10 h-12 bg-white/5 border-white/10 text-white placeholder:text-gray-600 focus:border-amber-500/50 focus:ring-amber-500/20 rounded-xl"
                        autoFocus
                      />
                    </div>
                  </div>

                  {/* Mode Toggle */}
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setMode('otp')}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${
                        mode === 'otp'
                          ? 'text-white shadow-lg'
                          : 'text-gray-400 hover:text-gray-300'
                      }`}
                      style={mode === 'otp' ? { background: `linear-gradient(135deg, ${C.gold}, ${C.goldLight})` } : { background: 'rgba(255,255,255,0.05)' }}
                    >
                      <div className="flex items-center justify-center gap-2">
                        <ShieldCheck className="w-4 h-4" />
                        Login with OTP
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setMode('password')}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${
                        mode === 'password'
                          ? 'text-white shadow-lg'
                          : 'text-gray-400 hover:text-gray-300'
                      }`}
                      style={mode === 'password' ? { background: `linear-gradient(135deg, ${C.gold}, ${C.goldLight})` } : { background: 'rgba(255,255,255,0.05)' }}
                    >
                      <div className="flex items-center justify-center gap-2">
                        <Lock className="w-4 h-4" />
                        Password + OTP
                      </div>
                    </button>
                  </div>

                  {/* Password field (conditional) */}
                  {mode === 'password' && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                    >
                      <Label htmlFor="password" className="text-gray-300 text-sm mb-1.5 block">Password</Label>
                      <div className="relative">
                        <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                        <Input
                          id="password"
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handlePasswordSubmit()}
                          placeholder="Enter your password"
                          className="pl-10 pr-10 h-12 bg-white/5 border-white/10 text-white placeholder:text-gray-600 focus:border-amber-500/50 focus:ring-amber-500/20 rounded-xl"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </motion.div>
                  )}

                  {error && (
                    <motion.p
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2"
                    >
                      {error}
                    </motion.p>
                  )}

                  <Button
                    onClick={mode === 'otp' ? handleRequestOtp : handlePasswordSubmit}
                    disabled={loading || !email}
                    className="w-full h-12 rounded-xl text-white font-semibold text-sm transition-all hover:shadow-lg hover:shadow-amber-500/20"
                    style={{ background: `linear-gradient(135deg, ${C.gold}, ${C.goldLight})` }}
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : mode === 'otp' ? (
                      <span className="flex items-center gap-2">
                        Send OTP Code <ArrowRight className="w-4 h-4" />
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        Verify Password <ArrowRight className="w-4 h-4" />
                      </span>
                    )}
                  </Button>
                </div>
              </motion.div>
            )}

            {/* ── OTP STEP ── */}
            {step === 'otp' && (
              <motion.div
                key="otp"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.25 }}
              >
                <div className="space-y-6">
                  <button
                    type="button"
                    onClick={backToEmail}
                    className="flex items-center gap-1 text-gray-400 hover:text-gray-300 text-sm transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4" /> Back
                  </button>

                  <div className="text-center">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-amber-500/10 mb-3">
                      <ShieldCheck className="w-6 h-6" style={{ color: C.goldLight }} />
                    </div>
                    <p className="text-gray-400 text-sm">
                      We sent a 6-digit code to
                    </p>
                    <p className="text-white font-medium text-sm mt-1">{otpSentTo}</p>
                  </div>

                  <div className="flex justify-center">
                    <InputOTP
                      maxLength={6}
                      value={otp}
                      onChange={(value) => {
                        setOtp(value);
                        setError('');
                        if (value.length === 6) {
                          setTimeout(() => handleVerifyOtp(), 300);
                        }
                      }}
                    >
                      <InputOTPGroup>
                        <InputOTPSlot index={0} className="w-12 h-14 text-xl bg-white/5 border-white/10 text-white rounded-lg data-[active=true]:border-amber-500/50 data-[active=true]:ring-amber-500/20" />
                        <InputOTPSlot index={1} className="w-12 h-14 text-xl bg-white/5 border-white/10 text-white rounded-lg data-[active=true]:border-amber-500/50 data-[active=true]:ring-amber-500/20" />
                        <InputOTPSlot index={2} className="w-12 h-14 text-xl bg-white/5 border-white/10 text-white rounded-lg data-[active=true]:border-amber-500/50 data-[active=true]:ring-amber-500/20" />
                      </InputOTPGroup>
                      <InputOTPSeparator className="text-gray-500 mx-2" />
                      <InputOTPGroup>
                        <InputOTPSlot index={3} className="w-12 h-14 text-xl bg-white/5 border-white/10 text-white rounded-lg data-[active=true]:border-amber-500/50 data-[active=true]:ring-amber-500/20" />
                        <InputOTPSlot index={4} className="w-12 h-14 text-xl bg-white/5 border-white/10 text-white rounded-lg data-[active=true]:border-amber-500/50 data-[active=true]:ring-amber-500/20" />
                        <InputOTPSlot index={5} className="w-12 h-14 text-xl bg-white/5 border-white/10 text-white rounded-lg data-[active=true]:border-amber-500/50 data-[active=true]:ring-amber-500/20" />
                      </InputOTPGroup>
                    </InputOTP>
                  </div>

                  {devCode && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="bg-gradient-to-br from-amber-500/15 to-amber-600/5 border border-amber-500/30 rounded-2xl p-5 text-center space-y-3"
                    >
                      <p className="text-amber-300/90 text-sm font-medium">
                        Your verification code:
                      </p>
                      <p className="font-mono font-bold text-3xl tracking-[0.3em]" style={{ color: C.goldLight }}>
                        {devCode}
                      </p>
                      <div className="flex items-center justify-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => { setOtp(devCode); setTimeout(() => handleVerifyOtp(), 300); }}
                          className="text-xs font-medium px-4 py-1.5 rounded-lg text-amber-950 transition-all hover:shadow-lg"
                          style={{ background: `linear-gradient(135deg, ${C.gold}, ${C.goldLight})` }}
                        >
                          Auto-fill & Verify
                        </button>
                      </div>
                      <p className="text-amber-500/50 text-[11px]">
                        Email delivery not configured yet — use this code to login
                      </p>
                    </motion.div>
                  )}

                  {error && (
                    <motion.p
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 text-center"
                    >
                      {error}
                    </motion.p>
                  )}

                  <div className="text-center">
                    <p className="text-gray-500 text-sm">
                      {countdown > 0 ? (
                        <>Resend in <span className="text-amber-400 font-mono">{countdown}s</span></>
                      ) : (
                        <button
                          type="button"
                          onClick={handleResend}
                          disabled={loading}
                          className="text-amber-400 hover:text-amber-300 font-medium inline-flex items-center gap-1 transition-colors"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                          Resend Code
                        </button>
                      )}
                    </p>
                  </div>

                  <Button
                    onClick={handleVerifyOtp}
                    disabled={loading || otp.length !== 6}
                    className="w-full h-12 rounded-xl text-white font-semibold text-sm"
                    style={{ background: `linear-gradient(135deg, ${C.gold}, ${C.goldLight})` }}
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <span className="flex items-center gap-2">
                        Verify Code <ArrowRight className="w-4 h-4" />
                      </span>
                    )}
                  </Button>
                </div>
              </motion.div>
            )}

            {/* ── SET PASSWORD STEP ── */}
            {step === 'set_password' && (
              <motion.div
                key="set_password"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.25 }}
              >
                <div className="space-y-5">
                  <div className="text-center">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-amber-500/10 mb-3">
                      <Lock className="w-6 h-6" style={{ color: C.goldLight }} />
                    </div>
                    <p className="text-gray-300 font-medium">First-time Setup</p>
                    <p className="text-gray-500 text-sm mt-1">Create a password for future logins</p>
                  </div>

                  <div>
                    <Label htmlFor="newPassword" className="text-gray-300 text-sm mb-1.5 block">New Password</Label>
                    <div className="relative">
                      <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                      <Input
                        id="newPassword"
                        type={showPassword ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Min. 8 characters"
                        className="pl-10 pr-10 h-12 bg-white/5 border-white/10 text-white placeholder:text-gray-600 focus:border-amber-500/50 focus:ring-amber-500/20 rounded-xl"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="confirmPassword" className="text-gray-300 text-sm mb-1.5 block">Confirm Password</Label>
                    <div className="relative">
                      <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                      <Input
                        id="confirmPassword"
                        type={showPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSetPassword()}
                        placeholder="Re-enter your password"
                        className="pl-10 h-12 bg-white/5 border-white/10 text-white placeholder:text-gray-600 focus:border-amber-500/50 focus:ring-amber-500/20 rounded-xl"
                      />
                    </div>
                  </div>

                  {error && (
                    <motion.p
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2"
                    >
                      {error}
                    </motion.p>
                  )}

                  <Button
                    onClick={handleSetPassword}
                    disabled={loading || !newPassword || !confirmPassword}
                    className="w-full h-12 rounded-xl text-white font-semibold text-sm"
                    style={{ background: `linear-gradient(135deg, ${C.gold}, ${C.goldLight})` }}
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <span className="flex items-center gap-2">
                        Set Password & Continue <ArrowRight className="w-4 h-4" />
                      </span>
                    )}
                  </Button>

                  <p className="text-gray-600 text-xs text-center">
                    You can always change your password later from Settings
                  </p>
                </div>
              </motion.div>
            )}

            {/* ── SUCCESS STEP ── */}
            {step === 'success' && (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
                className="text-center py-8"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
                >
                  <CheckCircle2 className="w-16 h-16 mx-auto mb-4 text-emerald-400" />
                </motion.div>
                <h2 className="text-xl font-bold text-white mb-2">Welcome!</h2>
                <p className="text-gray-400 text-sm">Redirecting to your dashboard...</p>
                <Loader2 className="w-5 h-5 mx-auto mt-4 text-amber-400 animate-spin" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <p className="text-center text-gray-600 text-xs mt-6">
          Protected by OTP-based authentication
        </p>
      </motion.div>
    </div>
  );
}