'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronRight, ChevronLeft, Sparkles, Building2, Users, Target, Zap, ArrowRight, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { tokens } from '@/components/intelligence-os/design-tokens'

interface OnboardingStep {
  id: string
  title: string
  description: string
  icon: typeof Building2
  content: React.ReactNode
}

interface OnboardingWizardProps {
  onComplete: () => void
  onDismiss: () => void
  className?: string
  userName?: string
}

const DEFAULT_STEPS: OnboardingStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to DeepMindQ',
    description: 'AI-powered enterprise intelligence for revenue teams',
    icon: Sparkles,
    content: null,
  },
  {
    id: 'import',
    title: 'Import Your Data',
    description: 'Connect your CRM or upload a CSV to get started',
    icon: Building2,
    content: null,
  },
  {
    id: 'configure',
    title: 'Configure Scoring',
    description: 'Set up your ideal customer profile and scoring weights',
    icon: Target,
    content: null,
  },
  {
    id: 'activate',
    title: 'Activate Intelligence',
    description: 'Enable AI-powered scoring, signals, and recommendations',
    icon: Zap,
    content: null,
  },
]

function WelcomeContent() {
  return (
    <div className="text-center py-4">
      <motion.div animate={{ scale: [1, 1.05, 1] }} transition={{ duration: 2, repeat: Infinity }} className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: `${tokens.domain.reasoning}15` }}>
        <Sparkles className="w-8 h-8" style={{ color: tokens.domain.reasoning }} />
      </motion.div>
      <h3 className="text-lg font-bold mb-2" style={{ color: tokens.text.primary }}>Your AI Intelligence OS</h3>
      <p className="text-sm max-w-md mx-auto" style={{ color: tokens.text.secondary }}>
        DeepMindQ transforms your customer data into actionable intelligence.
        Track signals, score accounts, and get AI-powered recommendations — all in real-time.
      </p>
      <div className="flex items-center justify-center gap-6 mt-6">
        {[
          { label: 'AI Scoring', icon: Target, color: tokens.confidence.high.value },
          { label: 'Signal Detection', icon: Zap, color: tokens.domain.reasoning },
          { label: 'Smart Recommendations', icon: ArrowRight, color: tokens.domain.opportunity },
        ].map(feature => (
          <div key={feature.label} className="flex flex-col items-center gap-2">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${feature.color}12` }}>
              <feature.icon className="w-5 h-5" style={{ color: feature.color }} />
            </div>
            <span className="text-[11px] font-medium" style={{ color: tokens.text.primary }}>{feature.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function ImportContent() {
  const [method, setMethod] = useState<'crm' | 'csv' | null>(null)
  return (
    <div className="py-4 space-y-4">
      <p className="text-sm" style={{ color: tokens.text.secondary }}>Choose how to bring your data into DeepMindQ:</p>
      <div className="grid grid-cols-2 gap-3">
        {[
          { id: 'crm', label: 'Connect CRM', desc: 'Salesforce, HubSpot, or other CRM', icon: Building2, color: tokens.domain.signal },
          { id: 'csv', label: 'Upload CSV', desc: 'Import from a spreadsheet file', icon: Users, color: tokens.domain.enrichment },
        ].map(opt => (
          <button key={opt.id} onClick={() => setMethod(opt.id as 'crm' | 'csv')} className={cn('rounded-xl border p-4 text-left transition-all', method === opt.id && 'ring-1')} style={{ background: tokens.surface.secondary, borderColor: method === opt.id ? opt.color : tokens.border.default, ...(method === opt.id ? { ['--tw-ring-color' as string]: opt.color } as React.CSSProperties : {}) }}>
            <opt.icon className="w-5 h-5 mb-2" style={{ color: opt.color }} />
            <p className="text-xs font-semibold" style={{ color: tokens.text.primary }}>{opt.label}</p>
            <p className="text-[10px] mt-0.5" style={{ color: tokens.text.secondary }}>{opt.desc}</p>
          </button>
        ))}
      </div>
      <button onClick={() => setMethod(null)} className="text-[10px] underline" style={{ color: tokens.text.muted }}>Skip for now</button>
    </div>
  )
}

function ConfigureContent() {
  return (
    <div className="py-4 space-y-4">
      <p className="text-sm" style={{ color: tokens.text.secondary }}>Customize how DeepMindQ scores and prioritizes your accounts:</p>
      <div className="space-y-3">
        {[
          { label: 'Ideal Customer Profile', desc: 'Define your target company attributes', value: 'Not configured' },
          { label: 'Scoring Weights', desc: 'Adjust the importance of each scoring factor', value: 'Defaults' },
          { label: 'Tier Thresholds', desc: 'Set Hot/Warm/Nurture/Cold score boundaries', value: 'Defaults' },
        ].map(item => (
          <div key={item.label} className="flex items-center justify-between p-3 rounded-lg border" style={{ background: tokens.surface.secondary, borderColor: tokens.border.subtle }}>
            <div>
              <p className="text-xs font-semibold" style={{ color: tokens.text.primary }}>{item.label}</p>
              <p className="text-[10px]" style={{ color: tokens.text.secondary }}>{item.desc}</p>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: tokens.surface.base, color: tokens.text.muted }}>{item.value}</span>
          </div>
        ))}
      </div>
      <button className="text-[10px] underline" style={{ color: tokens.domain.signal }}>Configure later in Settings → Scoring Config</button>
    </div>
  )
}

function ActivateContent() {
  return (
    <div className="py-4 space-y-4">
      <p className="text-sm" style={{ color: tokens.text.secondary }}>Enable AI features to start getting intelligence:</p>
      <div className="space-y-2">
        {[
          { label: 'AI Account Scoring', desc: 'Automatically score all accounts based on ICP fit', enabled: true },
          { label: 'Signal Detection', desc: 'Monitor for buying signals and trigger alerts', enabled: true },
          { label: 'Recommendation Engine', desc: 'Get prioritized action recommendations', enabled: true },
          { label: 'Email Intelligence', desc: 'AI-powered email drafting and optimization', enabled: false },
        ].map(feature => (
          <label key={feature.label} className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer" style={{ background: tokens.surface.secondary, borderColor: tokens.border.subtle }}>
            <input type="checkbox" defaultChecked={feature.enabled} className="accent-[#3b82f6]" />
            <div className="flex-1">
              <p className="text-xs font-semibold" style={{ color: tokens.text.primary }}>{feature.label}</p>
              <p className="text-[10px]" style={{ color: tokens.text.secondary }}>{feature.desc}</p>
            </div>
          </label>
        ))}
      </div>
    </div>
  )
}

const STEP_CONTENT: Record<string, React.ReactNode> = {
  welcome: <WelcomeContent />,
  import: <ImportContent />,
  configure: <ConfigureContent />,
  activate: <ActivateContent />,
}

export function UserOnboardingWizard({ onComplete, onDismiss, className, userName }: OnboardingWizardProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const steps = DEFAULT_STEPS

  const isFirst = currentStep === 0
  const isLast = currentStep === steps.length - 1
  const progress = ((currentStep + 1) / steps.length) * 100

  const handleNext = () => {
    if (isLast) {
      onComplete()
    } else {
      setCurrentStep(s => s + 1)
    }
  }

  const handleBack = () => {
    if (currentStep > 0) setCurrentStep(s => s - 1)
  }

  const step = steps[currentStep]
  const StepIcon = step.icon

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={cn('fixed inset-0 z-[100] flex items-center justify-center', className)}
      style={{ background: tokens.surface.overlay, backdropFilter: 'blur(8px)' }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-lg mx-4 rounded-2xl border overflow-hidden"
        style={{ background: tokens.surface.card, borderColor: tokens.border.default }}
      >
        {/* Progress bar */}
        <div className="h-1" style={{ background: tokens.surface.secondary }}>
          <motion.div className="h-full" style={{ background: tokens.domain.signal }} initial={{ width: 0 }} animate={{ width: `${progress}%` }} transition={{ duration: 0.3 }} />
        </div>

        {/* Close button */}
        <button onClick={onDismiss} className="absolute top-4 right-4 p-1 rounded-lg hover:bg-white/5">
          <X className="w-4 h-4" style={{ color: tokens.text.secondary }} />
        </button>

        {/* Content */}
        <div className="p-6">
          <AnimatePresence mode="wait">
            <motion.div key={step.id} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
              {/* Step header */}
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${tokens.domain.signal}12` }}>
                  <StepIcon className="w-5 h-5" style={{ color: tokens.domain.signal }} />
                </div>
                <div>
                  <h3 className="text-base font-bold" style={{ color: tokens.text.primary }}>
                    {userName ? `Welcome, ${userName}` : step.title}
                  </h3>
                  <p className="text-[11px]" style={{ color: tokens.text.secondary }}>Step {currentStep + 1} of {steps.length}</p>
                </div>
              </div>

              {/* Step content */}
              {STEP_CONTENT[step.id] || step.content}

              {/* Navigation */}
              <div className="flex items-center justify-between mt-6 pt-4 border-t" style={{ borderColor: tokens.border.subtle }}>
                <button onClick={handleBack} disabled={isFirst} className={cn('flex items-center gap-1 text-xs font-medium px-3 py-2 rounded-lg transition-colors', isFirst ? 'opacity-30' : 'hover:bg-white/5')} style={{ color: tokens.text.secondary }}>
                  <ChevronLeft className="w-4 h-4" />Back
                </button>
                <div className="flex items-center gap-2">
                  {steps.map((s, i) => (
                    <div key={s.id} className={cn('w-2 h-2 rounded-full transition-colors', i > currentStep && 'opacity-30')} style={{ background: i <= currentStep ? tokens.domain.signal : tokens.text.muted }} />
                  ))}
                </div>
                <button onClick={handleNext} className="flex items-center gap-1 text-xs font-semibold px-4 py-2 rounded-lg transition-colors" style={{ background: tokens.domain.signal, color: '#fff' }}>
                  {isLast ? 'Get Started' : 'Next'}<ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  )
}
