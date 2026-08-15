'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, ArrowLeft, Loader2 } from 'lucide-react';
import { fetchApi } from '@/lib/fetchApi';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

export default function LoginPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState<'credentials' | 'otp' | 'forgot'>('credentials');
  const [otp, setOtp] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState('');
  const [loginEmail, setLoginEmail] = useState('');
  const [resendMessage, setResendMessage] = useState('');
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState(false);

  const handleSubmitCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Please enter your email and password');
      return;
    }

    setLoading(true);
    try {
      const { error } = await fetchApi<{ success: boolean; message?: string; devCode?: string }>(
        '/api/auth/login',
        { method: 'POST', body: JSON.stringify({ email, password }) },
      );

      if (error) {
        setError(
          error.includes('Too many')
            ? 'Too many attempts. Please wait a moment and try again.'
            : error,
        );
        return;
      }

      // Password verified — move to OTP step
      setLoginEmail(email);
      setStep('otp');
    } catch {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setOtpError('');

    if (!otp) {
      setOtpError('Please enter the OTP code');
      return;
    }

    setOtpLoading(true);
    try {
      const { error } = await fetchApi('/api/auth/verify-otp', {
        method: 'POST',
        body: JSON.stringify({ email: loginEmail, code: otp.trim() }),
      });

      if (error) {
        setOtpError(
          error.includes('Too many')
            ? 'Too many attempts. Please wait a moment and try again.'
            : error,
        );
        return;
      }

      // Auth complete — redirect to dashboard
      router.push('/');
      router.refresh();
    } catch {
      setOtpError('An unexpected error occurred. Please try again.');
    } finally {
      setOtpLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError('');
    setForgotSuccess(false);

    if (!forgotEmail) {
      setForgotError('Please enter your email address');
      return;
    }

    setForgotLoading(true);
    try {
      const { error } = await fetchApi('/api/auth/request-otp', {
        method: 'POST',
        body: JSON.stringify({
          email: forgotEmail.trim().toLowerCase(),
          purpose: 'password_reset',
        }),
      });
      if (error) {
        setForgotError(error);
        return;
      }
      setForgotSuccess(true);
    } catch {
      setForgotError('An unexpected error occurred. Please try again.');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setResendMessage('');
    try {
      const { error } = await fetchApi('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: loginEmail, password }),
      });
      if (error) {
        setResendMessage(
          error.includes('Too many')
            ? 'Too many attempts. Please wait a moment and try again.'
            : error,
        );
        return;
      }
      setResendMessage('OTP resent');
    } catch {
      setResendMessage('Failed to resend OTP. Please try again.');
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* ── Left Panel (hidden on mobile) ── */}
      <div
        className="relative hidden w-1/2 lg:flex lg:items-center lg:justify-center"
        style={{ background: 'linear-gradient(135deg, #0a0c10 0%, #0f1219 40%, #141821 100%)' }}
      >
        {/* Decorative dot pattern */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full border border-blue-500/10" />
          <div className="absolute -bottom-32 -left-32 h-96 w-96 rounded-full border border-blue-500/8" />
          <div className="absolute right-1/4 bottom-1/3 h-48 w-48 rounded-full border border-purple-500/[0.06]" />
          <div className="absolute left-1/4 top-1/4 h-3 w-3 rounded-full bg-blue-500/20" />
          <div className="absolute right-1/3 top-1/3 h-2 w-2 rounded-full bg-purple-500/15" />
          <div className="absolute bottom-1/3 left-1/3 h-4 w-4 rounded-full bg-blue-400/8" />
        </div>

        {/* Subtle radial glow */}
        <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[500px] rounded-full bg-blue-600/[0.04] blur-[120px]" />

        <div className="relative z-10 flex flex-col items-center px-12 text-center">
          <Image src="/logo.png" alt="DeepMindQ" width={48} height={48} className="mb-8" />
          <h2 className="text-2xl font-bold tracking-tight text-[#e8ecf4] sm:text-3xl">
            Welcome back
          </h2>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-[#8892a8]">
            Sign in to access your Intelligence OS dashboard and continue monitoring your target
            accounts.
          </p>
        </div>
      </div>

      {/* ── Right Panel ── */}
      <div
        className="flex w-full items-center justify-center px-6 py-12 lg:w-1/2"
        style={{ backgroundColor: '#0a0c10' }}
      >
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="mb-10 flex items-center justify-center gap-2 lg:hidden">
            <Image src="/logo.png" alt="DeepMindQ" width={28} height={28} />
            <span className="text-lg font-semibold text-[#e8ecf4]">DeepMindQ</span>
          </div>

          {step === 'forgot' ? (
            <>
              <button
                type="button"
                onClick={() => setStep('credentials')}
                className="mb-6 flex items-center gap-1.5 text-sm text-[#8892a8] hover:text-[#e8ecf4] transition"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to sign in
              </button>

              <div>
                <h1 className="text-2xl font-bold tracking-tight text-[#e8ecf4]">Reset password</h1>
                <p className="mt-2 text-sm text-[#8892a8]">
                  Enter your email to receive a reset code.
                </p>
              </div>

              {forgotSuccess ? (
                <div className="mt-8 rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-400">
                  If an account exists for that email, a reset code has been sent. Please check your
                  inbox.
                </div>
              ) : (
                <form onSubmit={handleForgotPassword} className="mt-8 space-y-5">
                  {forgotError && (
                    <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                      {forgotError}
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="forgot-email" className="text-[#e8ecf4]">
                      Email address
                    </Label>
                    <Input
                      id="forgot-email"
                      type="email"
                      placeholder="you@company.com"
                      required
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      className="h-11 border-[#1e2535] bg-[#0f1219] text-[#e8ecf4] placeholder:text-[#5a6478] focus:border-blue-500/50 focus:ring-blue-500/20"
                      autoComplete="email"
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={forgotLoading}
                    className="h-11 w-full bg-[#2563EB] text-white hover:bg-[#1D4ED8] disabled:opacity-60"
                  >
                    {forgotLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      'Send Reset Code'
                    )}
                  </Button>
                </form>
              )}
            </>
          ) : step === 'credentials' ? (
            <>
              <button
                type="button"
                onClick={() => router.push('/signup')}
                className="mb-6 flex items-center gap-1.5 text-sm text-[#8892a8] hover:text-[#e8ecf4] transition"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to sign up
              </button>

              <div>
                <h1 className="text-2xl font-bold tracking-tight text-[#e8ecf4]">Sign in</h1>
                <p className="mt-2 text-sm text-[#8892a8]">
                  Enter your credentials to access DeepMindQ
                </p>
              </div>

              <form onSubmit={handleSubmitCredentials} className="mt-8 space-y-5">
                {error && (
                  <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                    {error}
                  </div>
                )}

                {/* Email */}
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-[#e8ecf4]">
                    Email address
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@company.com"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-11 border-[#1e2535] bg-[#0f1219] text-[#e8ecf4] placeholder:text-[#5a6478] focus:border-blue-500/50 focus:ring-blue-500/20"
                    autoComplete="email"
                  />
                </div>

                {/* Password */}
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-[#e8ecf4]">
                    Password
                  </Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Enter your password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="h-11 pr-10 border-[#1e2535] bg-[#0f1219] text-[#e8ecf4] placeholder:text-[#5a6478] focus:border-blue-500/50 focus:ring-blue-500/20"
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5a6478] hover:text-[#8892a8]"
                      tabIndex={-1}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Forgot password link */}
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setForgotEmail(email);
                      setStep('forgot');
                    }}
                    className="text-sm text-[#8892a8] hover:text-blue-400 transition"
                  >
                    Forgot password?
                  </button>
                </div>

                {/* Sign in button */}
                <Button
                  type="submit"
                  disabled={loading}
                  className="h-11 w-full bg-[#2563EB] text-white hover:bg-[#1D4ED8] disabled:opacity-60"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    'Continue'
                  )}
                </Button>
              </form>

              {/* Sign up link */}
              <p className="mt-8 text-center text-sm text-[#8892a8]">
                Don&apos;t have an account?{' '}
                <Link href="/signup" className="font-medium text-blue-500 hover:text-blue-400">
                  Create one
                </Link>
              </p>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setStep('credentials')}
                className="mb-6 flex items-center gap-1.5 text-sm text-[#8892a8] hover:text-[#e8ecf4] transition"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>

              <div>
                <h1 className="text-2xl font-bold tracking-tight text-[#e8ecf4]">
                  Verify your identity
                </h1>
                <p className="mt-2 text-sm text-[#8892a8]">
                  Enter the OTP code sent to your email to complete sign-in.
                </p>
              </div>

              <form onSubmit={handleOtpSubmit} className="mt-8 space-y-5">
                {otpError && (
                  <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                    {otpError}
                  </div>
                )}

                {/* OTP Input */}
                <div className="space-y-2">
                  <Label htmlFor="otp" className="text-[#e8ecf4]">
                    OTP Code
                  </Label>
                  <Input
                    id="otp"
                    type="text"
                    placeholder="Enter 6-digit code"
                    required
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    maxLength={6}
                    className="h-11 border-[#1e2535] bg-[#0f1219] text-[#e8ecf4] placeholder:text-[#5a6478] focus:border-blue-500/50 focus:ring-blue-500/20 text-center text-lg tracking-[0.5em]"
                    autoComplete="one-time-code"
                  />
                </div>

                {/* Verify button */}
                <Button
                  type="submit"
                  disabled={otpLoading}
                  className="h-11 w-full bg-[#2563EB] text-white hover:bg-[#1D4ED8] disabled:opacity-60"
                >
                  {otpLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    'Verify & Sign In'
                  )}
                </Button>

                {/* Resend OTP */}
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    className="w-full text-center text-sm text-[#8892a8] hover:text-blue-400 transition"
                  >
                    Didn&apos;t receive the code?{' '}
                    <span className="font-medium text-blue-500">Resend OTP</span>
                  </button>
                  {resendMessage && (
                    <p
                      className={`text-center text-xs ${resendMessage === 'OTP resent' ? 'text-green-400' : 'text-yellow-400'}`}
                    >
                      {resendMessage}
                    </p>
                  )}
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
