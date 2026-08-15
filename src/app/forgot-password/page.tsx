'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, Mail, CheckCircle2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { fetchApi } from '@/lib/fetchApi';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email address');
      return;
    }

    setLoading(true);

    const { error } = await fetchApi('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.toLowerCase().trim() }),
    });

    setLoading(false);

    if (error) {
      setError(error);
      return;
    }

    setSent(true);
  };

  if (sent) {
    return (
      <div
        className="flex min-h-screen items-center justify-center px-6"
        style={{ backgroundColor: '#0a0c10' }}
      >
        <div className="w-full max-w-sm text-center">
          <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10">
            <CheckCircle2 className="h-8 w-8 text-emerald-400" />
          </div>
          <h1 className="text-2xl font-bold text-[#e8ecf4]">Check your email</h1>
          <p className="mt-3 text-sm text-[#8892a8]">
            If an account exists for <span className="font-medium text-[#e8ecf4]">{email}</span>,
            you will receive a password reset OTP.
          </p>
          <Link
            href="/login"
            className="mt-8 inline-flex items-center gap-1.5 text-sm text-[#8892a8] hover:text-[#e8ecf4] transition"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex min-h-screen items-center justify-center px-6"
      style={{ backgroundColor: '#0a0c10' }}
    >
      <div className="w-full max-w-sm">
        <button
          type="button"
          onClick={() => router.push('/login')}
          className="mb-6 flex items-center gap-1.5 text-sm text-[#8892a8] hover:text-[#e8ecf4] transition"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to sign in
        </button>

        <div className="mb-8">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-blue-500/10">
            <Mail className="h-8 w-8 text-blue-400" />
          </div>
          <h1 className="text-2xl font-bold text-[#e8ecf4]">Forgot your password?</h1>
          <p className="mt-2 text-sm text-[#8892a8]">
            Enter your email and we'll send you an OTP to reset your password.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email" className="text-[#e8ecf4]">
              Email address
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-11 border-[#1e2535] bg-[#0f1219] text-[#e8ecf4] placeholder:text-[#5a6478] focus:border-blue-500/50 focus:ring-blue-500/20"
              autoFocus
            />
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="h-11 w-full bg-[#2563EB] text-white hover:bg-[#1D4ED8] disabled:opacity-60"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              'Send Reset OTP'
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
