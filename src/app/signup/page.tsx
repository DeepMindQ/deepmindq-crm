"use client"

import { useState, useMemo } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Eye, EyeOff, ArrowLeft, Loader2, Check } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"

interface PasswordStrength {
  score: number
  label: string
  color: string
  checks: { label: string; pass: boolean }[]
}

function getPasswordStrength(password: string): PasswordStrength {
  const checks = [
    { label: "At least 8 characters", pass: password.length >= 8 },
    { label: "Uppercase letter", pass: /[A-Z]/.test(password) },
    { label: "Number", pass: /[0-9]/.test(password) },
    { label: "Lowercase letter", pass: /[a-z]/.test(password) },
  ]
  const score = checks.filter((c) => c.pass).length

  if (score <= 1) return { score, label: "Weak", color: "bg-red-500", checks }
  if (score <= 2) return { score, label: "Fair", color: "bg-orange-500", checks }
  if (score <= 3) return { score, label: "Good", color: "bg-amber-500", checks }
  return { score, label: "Strong", color: "bg-green-500", checks }
}

export default function SignupPage() {
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const strength = useMemo(() => getPasswordStrength(password), [password])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (password !== confirmPassword) {
      setError("Passwords do not match")
      return
    }

    setLoading(true)

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, confirmPassword }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "Registration failed")
        return
      }

      // Mock sign-in: redirect to dashboard after successful registration
      router.push("/")
      router.refresh()
    } catch {
      setError("An unexpected error occurred. Please try again.")
    } finally {
      setLoading(false)
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
            Get started with DeepMindQ
          </h2>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-gray-400">
            Join thousands of sales professionals using AI-powered insights to close more deals.
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

          <button
            type="button"
            onClick={() => router.push("/login")}
            className="mb-6 flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to sign in
          </button>

          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">Create your account</h1>
            <p className="mt-2 text-sm text-gray-500">Start your free trial of DeepMindQ</p>
          </div>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="name">Full name</Label>
              <Input
                id="name"
                type="text"
                placeholder="John Doe"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-11"
                autoComplete="name"
              />
            </div>

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
                  placeholder="Create a strong password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-11 pr-10"
                  autoComplete="new-password"
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

              {/* Password strength indicator */}
              {password.length > 0 && (
                <div className="space-y-2 pt-1">
                  <div className="flex items-center gap-2">
                    <div className="flex flex-1 gap-1">
                      {[0, 1, 2, 3].map((i) => (
                        <div
                          key={i}
                          className={`h-1 flex-1 rounded-full transition-colors duration-200 ${
                            i < strength.score ? strength.color : "bg-gray-200"
                          }`}
                        />
                      ))}
                    </div>
                    <span className="text-xs font-medium text-gray-500">{strength.label}</span>
                  </div>
                  <ul className="space-y-1">
                    {strength.checks.map((check) => (
                      <li key={check.label} className="flex items-center gap-2 text-xs">
                        <Check
                          className={`h-3 w-3 transition-colors ${
                            check.pass ? "text-green-500" : "text-gray-300"
                          }`}
                        />
                        <span className={check.pass ? "text-green-700" : "text-gray-400"}>
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
              <Label htmlFor="confirm-password">Confirm password</Label>
              <Input
                id="confirm-password"
                type={showPassword ? "text" : "password"}
                placeholder="Confirm your password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="h-11"
                autoComplete="new-password"
              />
              {confirmPassword.length > 0 && password !== confirmPassword && (
                <p className="text-xs text-red-500">Passwords do not match</p>
              )}
            </div>

            {/* Sign up button */}
            <Button
              type="submit"
              disabled={loading}
              className="h-11 w-full bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-60"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating account...
                </>
              ) : (
                "Create account"
              )}
            </Button>
          </form>

          {/* Sign in link */}
          <p className="mt-8 text-center text-sm text-gray-500">
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-amber-600 hover:text-amber-500">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}