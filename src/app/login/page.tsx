"use client"

import { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { signIn } from "next-auth/react"
import { Eye, EyeOff, ArrowLeft, Loader2, Mail, Lock, ShieldCheck } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"

type View = "login" | "forgot-password" | "forgot-verify"

export default function LoginPage() {
  const router = useRouter()
  const [view, setView] = useState<View>("login")
  const [showPassword, setShowPassword] = useState(false)

  // Login state
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  // Forgot password state
  const [resetEmail, setResetEmail] = useState("")
  const [resetCode, setResetCode] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [resetStep, setResetStep] = useState<"request" | "verify">("request")
  const [resetLoading, setResetLoading] = useState(false)
  const [resetError, setResetError] = useState("")
  const [resetSuccess, setResetSuccess] = useState("")

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      })

      if (result?.error) {
        setError("Invalid email or password. Please try again.")
      } else {
        router.push("/")
        router.refresh()
      }
    } catch {
      setError("An unexpected error occurred. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const handleResetRequest = async (e: React.FormEvent) => {
    e.preventDefault()
    setResetError("")
    setResetSuccess("")
    setResetLoading(true)

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: resetEmail }),
      })
      const data = await res.json()
      if (res.ok) {
        setResetSuccess(data.message || "Reset code generated. Check the server logs.")
        setResetStep("verify")
      } else {
        setResetError(data.error || "Failed to generate reset code.")
      }
    } catch {
      setResetError("Network error. Please try again.")
    } finally {
      setResetLoading(false)
    }
  }

  const handleResetConfirm = async (e: React.FormEvent) => {
    e.preventDefault()
    setResetError("")
    setResetLoading(true)

    try {
      const res = await fetch("/api/auth/reset-password/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: resetEmail,
          code: resetCode,
          newPassword,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setResetSuccess("Password reset successfully! You can now sign in.")
        setView("login")
        setPassword("")
      } else {
        setResetError(data.error || "Failed to reset password.")
      }
    } catch {
      setResetError("Network error. Please try again.")
    } finally {
      setResetLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen">
      {/* ── Left Panel (hidden on mobile) ── */}
      <div className="relative hidden w-1/2 bg-gradient-to-br from-gray-900 to-gray-950 lg:flex lg:items-center lg:justify-center">
        {/* Decorative dot pattern */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full border border-white/5" />
          <div className="absolute -bottom-32 -left-32 h-96 w-96 rounded-full border border-white/5" />
          <div className="absolute right-1/4 bottom-1/3 h-48 w-48 rounded-full border border-white/[0.03]" />
          <div className="absolute left-1/4 top-1/4 h-3 w-3 rounded-full bg-amber-500/20" />
          <div className="absolute right-1/3 top-1/3 h-2 w-2 rounded-full bg-amber-500/10" />
          <div className="absolute bottom-1/3 left-1/3 h-4 w-4 rounded-full bg-white/5" />
          <div className="absolute right-1/4 bottom-1/4 h-2 w-2 rounded-full bg-white/5" />
          <div className="absolute left-1/2 top-1/2 h-3 w-3 rounded-full bg-white/[0.03]" />
          <div className="absolute right-1/2 top-1/5 h-2 w-2 rounded-full bg-amber-500/10" />
          <div className="absolute left-1/5 bottom-1/5 h-2 w-2 rounded-full bg-white/[0.04]" />
          <div className="absolute right-2/3 bottom-2/5 h-3 w-3 rounded-full bg-white/[0.03]" />
        </div>

        <div className="relative z-10 flex flex-col items-center px-12 text-center">
          <Image src="/logo.png" alt="DeepMindQ" width={48} height={48} className="mb-8" />
          <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Intelligence. Insight. Impact.
          </h2>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-gray-400">
            The AI-powered sales intelligence platform that helps your team close more deals, faster.
          </p>
        </div>
      </div>

      {/* ── Right Panel ── */}
      <div className="flex w-full items-center justify-center bg-white px-6 py-12 lg:w-1/2">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="mb-10 flex items-center justify-center gap-2 lg:hidden">
            <Image src="/logo.png" alt="DeepMindQ" width={28} height={28} />
            <span className="text-lg font-semibold text-gray-900">DeepMindQ</span>
          </div>

          {/* ── LOGIN VIEW ── */}
          {view === "login" && (
            <>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-gray-900">Welcome back</h1>
                <p className="mt-2 text-sm text-gray-500">Sign in to your DeepMindQ account</p>
              </div>

              <form onSubmit={handleLogin} className="mt-8 space-y-5">
                {error && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {error}
                  </div>
                )}

                {/* Email */}
                <div className="space-y-2">
                  <Label htmlFor="email">Email address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@company.com"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-11"
                    autoComplete="email"
                  />
                </div>

                {/* Password */}
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="h-11 pr-10"
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      tabIndex={-1}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Forgot password */}
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setView("forgot-password")
                      setResetError("")
                      setResetSuccess("")
                      setResetStep("request")
                    }}
                    className="text-sm font-medium text-amber-600 hover:text-amber-500"
                  >
                    Forgot password?
                  </button>
                </div>

                {/* Sign in button */}
                <Button
                  type="submit"
                  disabled={loading}
                  className="h-11 w-full bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-60"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    "Sign in"
                  )}
                </Button>
              </form>

              {/* Divider */}
              <div className="relative my-8">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-3 text-gray-400">or continue with</span>
                </div>
              </div>

              {/* OAuth Buttons */}
              <div className="grid grid-cols-2 gap-3">
                <button className="flex h-11 items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-700 transition hover:bg-gray-50">
                  <svg className="h-4 w-4" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 001 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                  </svg>
                  Google
                </button>
                <button className="flex h-11 items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-700 transition hover:bg-gray-50">
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                  </svg>
                  GitHub
                </button>
              </div>

              {/* Sign up link */}
              <p className="mt-8 text-center text-sm text-gray-500">
                Don&apos;t have an account?{" "}
                <Link href="/signup" className="font-medium text-amber-600 hover:text-amber-500">
                  Sign up
                </Link>
              </p>
            </>
          )}

          {/* ── FORGOT PASSWORD VIEW ── */}
          {view === "forgot-password" && (
            <>
              <button
                type="button"
                onClick={() => setView("login")}
                className="mb-6 flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to sign in
              </button>

              <div>
                <div className="flex items-center gap-3 mb-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100">
                    <ShieldCheck className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    {resetStep === "request" ? (
                      <>
                        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Forgot password?</h1>
                        <p className="text-sm text-gray-500">Enter your email to get a reset code</p>
                      </>
                    ) : (
                      <>
                        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Verify reset code</h1>
                        <p className="text-sm text-gray-500">Enter the 6-digit code sent to your email</p>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {resetStep === "request" ? (
                <form onSubmit={handleResetRequest} className="mt-8 space-y-5">
                  {(resetError || resetSuccess) && (
                    <div className={`rounded-lg border px-4 py-3 text-sm ${resetError ? "border-red-200 bg-red-50 text-red-700" : "border-green-200 bg-green-50 text-green-700"}`}>
                      {resetError || resetSuccess}
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="reset-email">Email address</Label>
                    <Input
                      id="reset-email"
                      type="email"
                      placeholder="you@company.com"
                      required
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      className="h-11"
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={resetLoading}
                    className="h-11 w-full bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-60"
                  >
                    {resetLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Mail className="mr-2 h-4 w-4" />
                        Send reset code
                      </>
                    )}
                  </Button>
                </form>
              ) : (
                <form onSubmit={handleResetConfirm} className="mt-8 space-y-5">
                  {(resetError || resetSuccess) && (
                    <div className={`rounded-lg border px-4 py-3 text-sm ${resetError ? "border-red-200 bg-red-50 text-red-700" : "border-green-200 bg-green-50 text-green-700"}`}>
                      {resetError || resetSuccess}
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="reset-code">6-digit code</Label>
                    <Input
                      id="reset-code"
                      type="text"
                      placeholder="123456"
                      required
                      maxLength={6}
                      value={resetCode}
                      onChange={(e) => setResetCode(e.target.value.replace(/\D/g, ""))}
                      className="h-11 text-center text-lg tracking-[0.5em] font-mono"
                    />
                    <p className="text-xs text-gray-400">
                      Check the server console for the code (demo mode)
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="new-password">New password</Label>
                    <div className="relative">
                      <Input
                        id="new-password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Min 8 chars, uppercase + number"
                        required
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="h-11 pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        tabIndex={-1}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={resetLoading}
                    className="h-11 w-full bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-60"
                  >
                    {resetLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Resetting...
                      </>
                    ) : (
                      <>
                        <Lock className="mr-2 h-4 w-4" />
                        Reset password
                      </>
                    )}
                  </Button>
                </form>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}