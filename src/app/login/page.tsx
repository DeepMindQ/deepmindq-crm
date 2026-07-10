"use client"

import { useState } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { Eye, EyeOff } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"

export default function LoginPage() {
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    router.push("/app")
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

          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">Welcome back</h1>
            <p className="mt-2 text-sm text-gray-500">Sign in to your DeepMindQ account</p>
          </div>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@company.com"
                required
                className="h-11"
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

            {/* Remember me / Forgot password */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Checkbox id="remember" className="h-4 w-4" />
                <Label htmlFor="remember" className="text-sm font-normal text-gray-600 cursor-pointer">
                  Remember me
                </Label>
              </div>
              <a href="#" className="text-sm font-medium text-amber-600 hover:text-amber-500">
                Forgot password?
              </a>
            </div>

            {/* Sign in button */}
            <Button
              type="submit"
              className="h-11 w-full bg-amber-600 text-white hover:bg-amber-700"
            >
              Sign in
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
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 001 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
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
            <a href="#" className="font-medium text-amber-600 hover:text-amber-500">
              Sign up
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}