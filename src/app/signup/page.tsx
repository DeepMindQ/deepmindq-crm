'use client';

import { useState, useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, ArrowLeft, Loader2, Check } from 'lucide-react';
import { fetchApi } from '@/lib/fetchApi';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

interface PasswordStrength {
  score: number;
  label: string;
  color: string;
  checks: { label: string; pass: boolean }[];
}

function getPasswordStrength(password: string): PasswordStrength {
  const checks = [
    { label: 'At least 8 characters', pass: password.length >= 8 },
    { label: 'Uppercase letter', pass: /[A-Z]/.test(password) },
    { label: 'Number', pass: /[0-9]/.test(password) },
    { label: 'Lowercase letter', pass: /[a-z]/.test(password) },
  ];
  const score = checks.filter((c) => c.pass).length;

  if (score <= 1) return { score, label: 'Weak', color: 'bg-red-500', checks };
  if (score <= 2) return { score, label: 'Fair', color: 'bg-orange-500', checks };
  if (score <= 3) return { score, label: 'Good', color: 'bg-blue-400', checks };
  return { score, label: 'Strong', color: 'bg-blue-500', checks };
}

export default function SignupPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const strength = useMemo(() => getPasswordStrength(password), [password]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      const { error } = await fetchApi('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name, email, password, confirmPassword }),
      });

      if (error) {
        setError(
          error.includes('Too many')
            ? 'Too many attempts. Please wait a moment and try again.'
            : error,
        );
        return;
      }

      // Registration successful — show brief success message then redirect
      setSuccess('Account created successfully! Redirecting to login…');
      setTimeout(() => {
        router.push('/login');
        router.refresh();
      }, 1500);
    } catch {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
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
          <div className="absolute right-1/4 bottom-1/4 h-2 w-2 rounded-full bg-blue-400/10" />
          <div className="absolute left-1/2 top-1/2 h-3 w-3 rounded-full bg-purple-400/[0.06]" />
          <div className="absolute right-1/2 top-1/5 h-2 w-2 rounded-full bg-blue-500/12" />
          <div className="absolute left-1/5 bottom-1/5 h-2 w-2 rounded-full bg-blue-500/[0.08]" />
          <div className="absolute right-2/3 bottom-2/5 h-3 w-3 rounded-full bg-purple-500/[0.06]" />
        </div>

        {/* Subtle radial glow */}
        <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[500px] rounded-full bg-blue-600/[0.04] blur-[120px]" />

        <div className="relative z-10 flex flex-col items-center px-12 text-center">
          <Image src="/logo.png" alt="DeepMindQ" width={48} height={48} className="mb-8" />
          <h2 className="text-2xl font-bold tracking-tight text-[#e8ecf4] sm:text-3xl">
            Get started with DeepMindQ
          </h2>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-[#8892a8]">
            Join thousands of sales professionals using AI-powered insights to close more deals.
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

          <button
            type="button"
            onClick={() => router.push('/login')}
            className="mb-6 flex items-center gap-1.5 text-sm text-[#8892a8] hover:text-[#e8ecf4] transition"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to sign in
          </button>

          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[#e8ecf4]">
              Create your account
            </h1>
            <p className="mt-2 text-sm text-[#8892a8]">Start your free trial of DeepMindQ</p>
          </div>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            {error && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}
            {success && (
              <div className="rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-400">
                {success}
              </div>
            )}

            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="name" className="text-[#e8ecf4]">
                Full name
              </Label>
              <Input
                id="name"
                type="text"
                placeholder="John Doe"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-11 border-[#1e2535] bg-[#0f1219] text-[#e8ecf4] placeholder:text-[#5a6478] focus:border-blue-500/50 focus:ring-blue-500/20"
                autoComplete="name"
              />
            </div>

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
                  placeholder="Create a strong password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-11 pr-10 border-[#1e2535] bg-[#0f1219] text-[#e8ecf4] placeholder:text-[#5a6478] focus:border-blue-500/50 focus:ring-blue-500/20"
                  autoComplete="new-password"
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

              {/* Password strength indicator */}
              {password.length > 0 && (
                <div className="space-y-2 pt-1">
                  <div className="flex items-center gap-2">
                    <div className="flex flex-1 gap-1">
                      {[0, 1, 2, 3].map((i) => (
                        <div
                          key={i}
                          className={`h-1 flex-1 rounded-full transition-colors duration-200 ${
                            i < strength.score ? strength.color : 'bg-[#1e2535]'
                          }`}
                        />
                      ))}
                    </div>
                    <span className="text-xs font-medium text-[#8892a8]">{strength.label}</span>
                  </div>
                  <ul className="space-y-1">
                    {strength.checks.map((check) => (
                      <li key={check.label} className="flex items-center gap-2 text-xs">
                        <Check
                          className={`h-3 w-3 transition-colors ${
                            check.pass ? 'text-blue-500' : 'text-[#5a6478]'
                          }`}
                        />
                        <span className={check.pass ? 'text-[#e8ecf4]' : 'text-[#5a6478]'}>
                          {check.label}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div className="space-y-2">
              <Label htmlFor="confirm-password" className="text-[#e8ecf4]">
                Confirm password
              </Label>
              <Input
                id="confirm-password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Confirm your password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="h-11 border-[#1e2535] bg-[#0f1219] text-[#e8ecf4] placeholder:text-[#5a6478] focus:border-blue-500/50 focus:ring-blue-500/20"
                autoComplete="new-password"
              />
              {confirmPassword.length > 0 && password !== confirmPassword && (
                <p className="text-xs text-red-400">Passwords do not match</p>
              )}
            </div>

            {/* Sign up button */}
            <Button
              type="submit"
              disabled={loading}
              className="h-11 w-full bg-[#2563EB] text-white hover:bg-[#1D4ED8] disabled:opacity-60"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating account...
                </>
              ) : (
                'Create account'
              )}
            </Button>
          </form>

          {/* Sign in link */}
          <p className="mt-8 text-center text-sm text-[#8892a8]">
            Already have an account?{' '}
            <Link href="/login" className="font-medium text-blue-500 hover:text-blue-400">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
