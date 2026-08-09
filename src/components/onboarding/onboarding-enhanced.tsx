'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Building2,
  Users,
  Brain,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Check,
  Zap,
  Target,
  BarChart3,
  Shield,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

/* ═══════════════════════════════════════════════════
   Constants & Types
   ═══════════════════════════════════════════════════ */

const STEPS = ['welcome', 'company', 'preferences', 'team', 'complete'] as const
type Step = (typeof STEPS)[number]

const SIGNAL_OPTIONS = [
  { id: 'funding', label: 'Funding Rounds', description: 'Track investment and funding events', default: true },
  { id: 'hiring', label: 'Hiring Spikes', description: 'Monitor team growth and hiring trends', default: true },
  { id: 'tech_change', label: 'Technology Changes', description: 'New tech stack adoptions and migrations', default: true },
  { id: 'leadership', label: 'Leadership Changes', description: 'C-suite and VP level transitions', default: false },
  { id: 'partnership', label: 'Partnerships', description: 'Strategic partnerships and integrations', default: false },
  { id: 'expansion', label: 'Market Expansion', description: 'Geographic and market expansion signals', default: false },
]

const ROLE_OPTIONS = [
  { id: 'sales_leader', label: 'Sales Leader', description: 'VP Sales, CRO', icon: Target },
  { id: 'ae', label: 'Account Executive', description: 'Closer, quota-carrying', icon: Zap },
  { id: 'sdr', label: 'SDR / BDR', description: 'Pipeline generation', icon: BarChart3 },
  { id: 'revops', label: 'RevOps', description: 'Operations and analytics', icon: Shield },
  { id: 'analyst', label: 'Intelligence Analyst', description: 'Market and competitive intel', icon: Brain },
]

interface OnboardingData {
  companyName: string
  industry: string
  size: string
  website: string
  signalPreferences: string[]
  role: string
}

const STORAGE_KEY = 'dmq_onboarding_v2'

/* ═══════════════════════════════════════════════════
   Slide animation variants
   ═══════════════════════════════════════════════════ */

const slideVariants = {
  enter: (direction: number) => ({
    opacity: 0,
    x: direction > 0 ? 40 : -40,
  }),
  center: {
    opacity: 1,
    x: 0,
  },
  exit: (direction: number) => ({
    opacity: 0,
    x: direction > 0 ? -40 : 40,
  }),
}

/* ═══════════════════════════════════════════════════
   Main Component
   ═══════════════════════════════════════════════════ */

export function OnboardingEnhanced() {
  const [currentStep, setCurrentStep] = useState(0)
  const [direction, setDirection] = useState(1) // 1 = forward, -1 = backward
  const [data, setData] = useState<OnboardingData>({
    companyName: '',
    industry: '',
    size: '',
    website: '',
    signalPreferences: SIGNAL_OPTIONS.filter((s) => s.default).map((s) => s.id),
    role: '',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Check localStorage for completion on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        if (parsed.completed) {
          setData((prev) => ({ ...prev, ...parsed.data }))
          setCurrentStep(STEPS.length - 1)
        } else {
          setData((prev) => ({ ...prev, ...parsed.data }))
          setCurrentStep(parsed.step || 0)
        }
      } catch {
        /* ignore corrupt data */
      }
    }
  }, [])

  const saveProgress = useCallback(
    (step: number, completed = false) => {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ step, data, completed })
      )
    },
    [data]
  )

  const next = () => {
    if (currentStep < STEPS.length - 1) {
      setDirection(1)
      setCurrentStep(currentStep + 1)
      saveProgress(currentStep + 1)
    }
  }

  const prev = () => {
    if (currentStep > 0) {
      setDirection(-1)
      setCurrentStep(currentStep - 1)
    }
  }

  const skip = () => {
    setDirection(1)
    setCurrentStep(STEPS.length - 1)
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ step: STEPS.length - 1, data, completed: true })
    )
  }

  const handleComplete = async () => {
    setIsSubmitting(true)
    try {
      await fetch('/api/auth/update-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).catch(() => {
        /* best-effort — don't block the user */
      })
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ step: STEPS.length - 1, data, completed: true })
      )
      toast.success('Setup complete! Welcome to DeepMindQ.')
    } catch {
      toast.error('Failed to save preferences')
    } finally {
      setIsSubmitting(false)
    }
  }

  const progress = ((currentStep + 1) / STEPS.length) * 100

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-lg">
        {/* ── Step Indicator ── */}
        <div className="mb-8">
          <Progress value={progress} className="h-1" />
          <div className="flex justify-between mt-3">
            {STEPS.map((step, i) => (
              <button
                key={step}
                onClick={() => {
                  if (i < currentStep) {
                    setDirection(-1)
                    setCurrentStep(i)
                  }
                }}
                disabled={i >= currentStep}
                className={cn(
                  'flex items-center gap-1.5 text-[10px] font-medium transition-colors',
                  i <= currentStep
                    ? 'text-primary cursor-pointer'
                    : 'text-muted-foreground cursor-default'
                )}
                aria-label={`Step ${i + 1}: ${step}`}
              >
                <span
                  className={cn(
                    'w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold border transition-colors',
                    i < currentStep
                      ? 'bg-primary text-primary-foreground border-primary'
                      : i === currentStep
                        ? 'border-primary text-primary'
                        : 'border-border text-muted-foreground'
                  )}
                >
                  {i < currentStep ? (
                    <Check className="w-3 h-3" />
                  ) : (
                    i + 1
                  )}
                </span>
                <span className="hidden sm:inline capitalize">{step}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ── Step Content with AnimatePresence ── */}
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={currentStep}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            {currentStep === 0 && renderWelcome()}
            {currentStep === 1 && renderCompany()}
            {currentStep === 2 && renderPreferences()}
            {currentStep === 3 && renderTeam()}
            {currentStep === 4 && renderComplete()}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )

  /* ═══════════════════════════════════════════════════
     Step Renderers
     ═══════════════════════════════════════════════════ */

  function renderWelcome() {
    return (
      <div className="text-center space-y-6">
        {/* Logo / icon */}
        <motion.div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto bg-primary/10 border border-primary/20"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
        >
          <Brain className="w-8 h-8 text-primary" />
        </motion.div>

        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            Welcome to DeepMindQ
          </h2>
          <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
            AI-powered revenue intelligence that helps you identify, prioritize,
            and close more deals by combining 40+ signal types with real-time
            company data.
          </p>
        </div>

        {/* Value prop cards */}
        <div className="grid grid-cols-2 gap-3 text-left">
          {[
            {
              icon: Brain,
              title: 'AI Scoring',
              desc: '40/40/20 weighted scoring',
            },
            {
              icon: Sparkles,
              title: 'Real-time Signals',
              desc: '10 signal types tracked',
            },
            {
              icon: Users,
              title: 'Relationship Intel',
              desc: 'Contact engagement tracking',
            },
            {
              icon: Building2,
              title: 'Company Profiles',
              desc: 'Auto-enriched data',
            },
          ].map((item, i) => (
            <motion.div
              key={item.title}
              className="rounded-lg border border-border p-3 hover:border-primary/30 transition-colors"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 + i * 0.06 }}
            >
              <item.icon className="w-4 h-4 text-primary mb-1.5" />
              <p className="text-xs font-semibold">{item.title}</p>
              <p className="text-[10px] text-muted-foreground">{item.desc}</p>
            </motion.div>
          ))}
        </div>

        <Button onClick={next} className="gap-2" size="lg">
          Get Started <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    )
  }

  function renderCompany() {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold">Tell us about your company</h2>
          <p className="text-sm text-muted-foreground mt-1">
            This helps us calibrate intelligence scoring for your market.
          </p>
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="company-name">Company Name</Label>
            <Input
              id="company-name"
              placeholder="Acme Corp"
              value={data.companyName}
              onChange={(e) =>
                setData((d) => ({ ...d, companyName: e.target.value }))
              }
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="industry">Industry</Label>
              <Input
                id="industry"
                placeholder="SaaS"
                value={data.industry}
                onChange={(e) =>
                  setData((d) => ({ ...d, industry: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="size">Team Size</Label>
              <Input
                id="size"
                placeholder="50-200"
                value={data.size}
                onChange={(e) =>
                  setData((d) => ({ ...d, size: e.target.value }))
                }
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="website">Website</Label>
            <Input
              id="website"
              placeholder="https://acme.com"
              value={data.website}
              onChange={(e) =>
                setData((d) => ({ ...d, website: e.target.value }))
              }
            />
          </div>
        </div>

        <div className="flex justify-between">
          <Button variant="ghost" onClick={skip} className="text-muted-foreground">
            Skip setup
          </Button>
          <Button onClick={next} className="gap-2">
            Continue <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    )
  }

  function renderPreferences() {
    const toggleSignal = (signalId: string, checked: boolean | 'indeterminate') => {
      setData((d) => ({
        ...d,
        signalPreferences: checked
          ? [...d.signalPreferences, signalId]
          : d.signalPreferences.filter((id) => id !== signalId),
      }))
    }

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold">Intelligence Preferences</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Select signal types to track for your accounts.
          </p>
        </div>

        <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
          {SIGNAL_OPTIONS.map((opt) => (
            <label
              key={opt.id}
              className={cn(
                'flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors',
                data.signalPreferences.includes(opt.id)
                  ? 'border-primary/40 bg-primary/5'
                  : 'border-border hover:border-primary/20'
              )}
            >
              <Checkbox
                checked={data.signalPreferences.includes(opt.id)}
                onCheckedChange={(checked) => toggleSignal(opt.id, checked)}
                className="mt-0.5"
              />
              <div>
                <p className="text-sm font-medium">{opt.label}</p>
                <p className="text-xs text-muted-foreground">
                  {opt.description}
                </p>
              </div>
            </label>
          ))}
        </div>

        <div className="flex justify-between">
          <Button variant="ghost" onClick={prev}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Back
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={skip} className="text-muted-foreground">
              Skip
            </Button>
            <Button onClick={next} className="gap-2">
              Continue <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    )
  }

  function renderTeam() {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold">Your Role</h2>
          <p className="text-sm text-muted-foreground mt-1">
            We&apos;ll tailor the experience to your role.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-2">
          {ROLE_OPTIONS.map((opt) => {
            const Icon = opt.icon
            return (
              <button
                key={opt.id}
                onClick={() => setData((d) => ({ ...d, role: opt.id }))}
                className={cn(
                  'flex items-center gap-3 p-3 rounded-lg border text-left transition-colors',
                  data.role === opt.id
                    ? 'border-primary/40 bg-primary/5'
                    : 'border-border hover:border-primary/20'
                )}
              >
                <div
                  className={cn(
                    'w-10 h-10 rounded-lg flex items-center justify-center transition-colors',
                    data.role === opt.id ? 'bg-primary/15' : 'bg-muted'
                  )}
                >
                  <Icon
                    className={cn(
                      'w-5 h-5',
                      data.role === opt.id ? 'text-primary' : 'text-muted-foreground'
                    )}
                  />
                </div>
                <div>
                  <p className="text-sm font-medium">{opt.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {opt.description}
                  </p>
                </div>
              </button>
            )
          })}
        </div>

        <div className="flex justify-between">
          <Button variant="ghost" onClick={prev}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Back
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={skip} className="text-muted-foreground">
              Skip
            </Button>
            <Button onClick={next} className="gap-2">
              Continue <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    )
  }

  function renderComplete() {
    return (
      <div className="text-center space-y-6">
        <motion.div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto bg-emerald-500/15 border border-emerald-500/20"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15 }}
        >
          <Check className="w-8 h-8 text-emerald-400" />
        </motion.div>

        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            You&apos;re all set!
          </h2>
          <p className="text-sm text-muted-foreground mt-2">
            DeepMindQ is now configured for{' '}
            <span className="font-medium text-foreground">
              {data.companyName || 'your company'}
            </span>
            . Start exploring your intelligence dashboard.
          </p>
        </div>

        {/* Summary */}
        <div className="rounded-lg border border-border p-4 text-left space-y-3">
          {data.companyName && (
            <div className="flex items-center gap-2 text-sm">
              <Building2 className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">Company:</span>
              <span className="font-medium">{data.companyName}</span>
            </div>
          )}
          {data.industry && (
            <div className="flex items-center gap-2 text-sm">
              <Building2 className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">Industry:</span>
              <span className="font-medium">{data.industry}</span>
            </div>
          )}
          {data.role && (
            <div className="flex items-center gap-2 text-sm">
              <Users className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">Role:</span>
              <span className="font-medium">
                {ROLE_OPTIONS.find((r) => r.id === data.role)?.label}
              </span>
            </div>
          )}
          {data.signalPreferences.length > 0 && (
            <div className="flex items-center gap-2 text-sm">
              <Sparkles className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">Signals:</span>
              <span className="font-medium">
                {data.signalPreferences.length} types selected
              </span>
            </div>
          )}
        </div>

        <Button
          onClick={handleComplete}
          disabled={isSubmitting}
          className="gap-2"
          size="lg"
        >
          {isSubmitting ? (
            <>
              <motion.div
                className="w-4 h-4 border-2 border-current border-t-transparent rounded-full"
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              />
              Saving...
            </>
          ) : (
            <>
              Go to Dashboard <ArrowRight className="w-4 h-4" />
            </>
          )}
        </Button>
      </div>
    )
  }
}
