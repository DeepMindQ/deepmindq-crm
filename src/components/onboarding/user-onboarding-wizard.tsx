'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  ArrowRight,
  ArrowLeft,
  Check,
  Pencil,
  Shield,
  TrendingUp,
  BarChart3,
  Cpu,
  DollarSign,
  Rocket,
  Info,
  Loader2,
  User,
  Building2,
  Briefcase,
} from 'lucide-react';
import { tokens, typography } from '@/components/intelligence-os/design-tokens';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { fetchApi } from '@/lib/fetchApi';
import { useAppStore } from '@/lib/store';

// ═══════════════════════════════════════════════════════════════
// Constants & Types (B21)
// ═══════════════════════════════════════════════════════════════

const ROLES = [
  'Chief Executive Officer (CEO)',
  'Chief Revenue Officer (CRO)',
  'Vice President of Sales',
  'Sales Director',
  'Account Executive',
  'Business Development Representative',
  'Revenue Operations Manager',
  'Marketing Manager',
] as const;

type _Role = (typeof ROLES)[number] | 'Other';

const INDUSTRIES = [
  'Technology & SaaS',
  'Financial Services',
  'Healthcare & Life Sciences',
  'Manufacturing & Industrial',
  'Professional Services',
  'Retail & E-commerce',
  'Media & Entertainment',
] as const;

type _Industry = (typeof INDUSTRIES)[number] | 'Other';

interface SignalOption {
  id: string;
  label: string;
  description: string;
  tooltip: string;
  icon: React.ReactNode;
}

const SIGNAL_OPTIONS: SignalOption[] = [
  {
    id: 'risk',
    label: 'Risk Signals',
    description: 'Churn risk, financial instability, competitive threats',
    tooltip:
      'Alerts about potential risks to your accounts including churn indicators, financial distress signals, and competitive displacement warnings.',
    icon: <Shield className="size-4" />,
  },
  {
    id: 'opportunity',
    label: 'Opportunity Signals',
    description: 'Expansion potential, new buying intent, budget windows',
    tooltip:
      'Identifies buying signals such as budget allocation changes, expansion plans, and new project initiatives that indicate sales opportunities.',
    icon: <Rocket className="size-4" />,
  },
  {
    id: 'market',
    label: 'Market Signals',
    description: 'Industry trends, regulatory changes, market shifts',
    tooltip:
      'Tracks broader market movements including industry trends, regulatory changes, and macroeconomic shifts affecting your target accounts.',
    icon: <BarChart3 className="size-4" />,
  },
  {
    id: 'technology',
    label: 'Technology Signals',
    description: 'Tech stack changes, new tool adoption, vendor shifts',
    tooltip:
      'Monitors technology adoption patterns, tech stack migrations, and vendor evaluations that signal readiness or need for your solution.',
    icon: <Cpu className="size-4" />,
  },
  {
    id: 'financial',
    label: 'Financial Signals',
    description: 'Funding rounds, revenue changes, spending patterns',
    tooltip:
      'Captures financial events like funding rounds, IPO filings, M&A activity, and public financial disclosures impacting account health.',
    icon: <DollarSign className="size-4" />,
  },
  {
    id: 'growth',
    label: 'Growth Signals',
    description: 'Hiring surges, geographic expansion, product launches',
    tooltip:
      'Detects growth indicators such as rapid hiring, office expansions, new product launches, and market entry into new geographies.',
    icon: <TrendingUp className="size-4" />,
  },
];

// ═══════════════════════════════════════════════════════════════
// LocalStorage helpers (B8)
// ═══════════════════════════════════════════════════════════════

const ONBOARDING_KEY = 'dmq-onboarding';
const COMPLETED_KEY = 'onboarding-completed';

interface OnboardingData {
  step: number;
  fullName: string;
  email: string;
  role: string;
  customRole: string;
  company: string;
  industry: string;
  customIndustry: string;
  signals: string[];
}

function loadFromStorage(): OnboardingData | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(ONBOARDING_KEY);
    if (raw) return JSON.parse(raw) as OnboardingData;
  } catch {
    /* ignore */
  }
  return null;
}

function saveToStorage(data: OnboardingData) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(ONBOARDING_KEY, JSON.stringify(data));
  } catch {
    /* ignore */
  }
}

function isOnboardingCompleted(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(COMPLETED_KEY) === 'true';
}

function markOnboardingCompleted() {
  if (typeof window === 'undefined') return;
  localStorage.setItem(COMPLETED_KEY, 'true');
  localStorage.removeItem(ONBOARDING_KEY);
}

// ═══════════════════════════════════════════════════════════════
// Animation variants (B14)
// ═══════════════════════════════════════════════════════════════

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 80 : -80,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction > 0 ? -80 : 80,
    opacity: 0,
  }),
};

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

// ═══════════════════════════════════════════════════════════════
// Wizard Component
// ═══════════════════════════════════════════════════════════════

const DEFAULT_DATA: OnboardingData = {
  step: 1,
  fullName: '',
  email: '',
  role: '',
  customRole: '',
  company: '',
  industry: '',
  customIndustry: '',
  signals: [],
};

export function UserOnboardingWizard() {
  const [data, setData] = useState<OnboardingData>(DEFAULT_DATA);
  const [direction, setDirection] = useState(1);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [hydrated, setHydrated] = useState(false);
  const setActiveView = useAppStore((s) => s.setActiveView);

  // B1: Check if onboarding already completed
  useEffect(() => {
    if (isOnboardingCompleted()) {
      setActiveView('dashboard');
      return;
    }
    const stored = loadFromStorage();
    if (stored) {
      setData(stored);
    }
    setHydrated(true);
  }, [setActiveView]);

  // Fetch user info from session
  useEffect(() => {
    if (!hydrated) return;
    if (data.email) return; // already have email from storage
    (async () => {
      const { data: user } = await fetchApi<{ id: string; email: string; name: string | null }>(
        '/api/auth/me',
      );
      if (user) {
        setData((prev) => {
          const next = {
            ...prev,
            email: user.email ?? '',
            fullName: prev.fullName || user.name || '',
          };
          saveToStorage(next);
          return next;
        });
      }
    })();
  }, [hydrated, data.email]);

  const update = useCallback((patch: Partial<OnboardingData>) => {
    setData((prev) => {
      const next = { ...prev, ...patch };
      saveToStorage(next);
      return next;
    });
  }, []);

  const toggleSignal = useCallback((id: string) => {
    setData((prev) => {
      const signals = prev.signals.includes(id)
        ? prev.signals.filter((s) => s !== id)
        : [...prev.signals, id];
      const next = { ...prev, signals };
      saveToStorage(next);
      return next;
    });
    setErrors((prev) => {
      if (prev.signals) {
        const { signals: _, ...rest } = prev;
        return rest;
      }
      return prev;
    });
  }, []);

  // ── Validation ──
  const validateStep = useCallback(
    (step: number): boolean => {
      const next: Record<string, string> = {};
      if (step === 1) {
        if (!data.fullName.trim()) next.fullName = 'Full name is required';
      }
      if (step === 2) {
        if (data.signals.length === 0) next.signals = 'Select at least one signal type';
      }
      setErrors(next);
      return Object.keys(next).length === 0;
    },
    [data],
  );

  // ── Navigation ──
  const goNext = useCallback(() => {
    if (!validateStep(data.step)) return;
    setDirection(1);
    update({ step: data.step + 1 });
  }, [data.step, validateStep, update]);

  const goBack = useCallback(() => {
    setDirection(-1);
    update({ step: data.step - 1 });
  }, [data.step, update]);

  const goToStep = useCallback(
    (step: number) => {
      setDirection(step > data.step ? 1 : -1);
      update({ step });
    },
    [data.step, update],
  );

  // ── Save & Complete ──
  const handleComplete = useCallback(async () => {
    setSaving(true);
    try {
      const payload = {
        fullName: data.fullName,
        role: data.role === 'Other' ? data.customRole : data.role,
        company: data.company,
        industry: data.industry === 'Other' ? data.customIndustry : data.industry,
        signals: data.signals,
      };
      const { error } = await fetchApi('/api/onboarding/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (error) {
        toast.error('Failed to save preferences', { description: error });
        return;
      }
      markOnboardingCompleted();
      toast.success('Setup complete!', { description: 'Your preferences have been saved.' });
      setActiveView('dashboard');
    } catch {
      toast.error('Something went wrong');
    } finally {
      setSaving(false);
    }
  }, [data, setActiveView]);

  const handleSkip = useCallback(() => {
    markOnboardingCompleted();
    setActiveView('dashboard');
  }, [setActiveView]);

  // B20: Keyboard navigation — Enter to proceed
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Enter' && !e.shiftKey) {
        const tag = (e.target as HTMLElement).tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return; // let native submit work
        e.preventDefault();
        if (data.step < 3) goNext();
        else handleComplete();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [data.step, goNext, handleComplete]);

  if (!hydrated) {
    return (
      <div
        className="flex items-center justify-center h-full"
        style={{ background: tokens.surface.primary }}
      >
        <Loader2 className="size-6 animate-spin" style={{ color: tokens.text.secondary }} />
      </div>
    );
  }

  const progress = (data.step / 3) * 100;

  return (
    <div
      className="flex flex-col items-center min-h-screen px-4 py-8 md:py-12"
      style={{ background: tokens.surface.primary, fontFamily: typography.fontFamily }}
    >
      {/* Header & Progress */}
      <motion.div className="w-full max-w-xl mb-8" {...fadeUp} transition={{ duration: 0.3 }}>
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl md:text-2xl font-bold" style={{ color: tokens.text.primary }}>
            Welcome to Intelligence OS
          </h1>
          <span className="text-sm font-medium" style={{ color: tokens.text.secondary }}>
            Step {data.step} of 3
          </span>
        </div>
        <Progress value={progress} className="h-1.5" />
        <div className="flex justify-between mt-2">
          {['Profile Setup', 'Intelligence Preferences', 'Review & Complete'].map((label, i) => (
            <button
              key={label}
              type="button"
              onClick={() => i + 1 < data.step && goToStep(i + 1)}
              className={`text-xs transition-colors ${
                i + 1 <= data.step ? 'cursor-pointer' : 'cursor-default'
              }`}
              style={{
                color: i + 1 <= data.step ? tokens.accent.primary : tokens.text.muted,
              }}
              disabled={i + 1 >= data.step}
            >
              {i + 1}. {label}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Step Content */}
      <div className="w-full max-w-xl relative overflow-hidden" style={{ minHeight: 420 }}>
        <AnimatePresence mode="wait" custom={direction}>
          {data.step === 1 && (
            <StepProfile
              key="step-1"
              data={data}
              errors={errors}
              update={update}
              custom={direction}
            />
          )}
          {data.step === 2 && (
            <StepSignals
              key="step-2"
              data={data}
              errors={errors}
              toggleSignal={toggleSignal}
              custom={direction}
            />
          )}
          {data.step === 3 && (
            <StepReview key="step-3" data={data} goToStep={goToStep} custom={direction} />
          )}
        </AnimatePresence>
      </div>

      {/* Footer Navigation */}
      <motion.div
        className="w-full max-w-xl flex items-center justify-between mt-8"
        {...fadeUp}
        transition={{ duration: 0.3, delay: 0.1 }}
      >
        <div>
          {data.step > 1 && (
            <Button variant="ghost" onClick={goBack} disabled={saving}>
              <ArrowLeft className="size-4 mr-1" />
              Back
            </Button>
          )}
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            onClick={handleSkip}
            disabled={saving}
            className="text-sm"
            style={{ color: tokens.text.secondary }}
          >
            Skip for now
          </Button>
          {data.step < 3 ? (
            <Button onClick={goNext}>
              Continue
              <ArrowRight className="size-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={handleComplete} disabled={saving}>
              {saving && <Loader2 className="size-4 mr-2 animate-spin" />}
              Complete Setup
              <Check className="size-4 ml-1" />
            </Button>
          )}
        </div>
      </motion.div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Step 1 — Profile Setup
// ═══════════════════════════════════════════════════════════════

function StepProfile({
  data,
  errors,
  update,
  custom: direction,
}: {
  data: OnboardingData;
  errors: Record<string, string>;
  update: (_p: Partial<OnboardingData>) => void;
  custom: number;
}) {
  return (
    <motion.div
      className="space-y-6"
      custom={direction}
      variants={slideVariants}
      initial="enter"
      animate="center"
      exit="exit"
      transition={{ duration: 0.3, ease: 'easeInOut' }}
    >
      <div>
        <h2 className="text-lg font-semibold mb-1" style={{ color: tokens.text.primary }}>
          <User className="size-5 inline-block mr-2" style={{ color: tokens.accent.primary }} />
          Profile Setup
        </h2>
        <p className="text-sm" style={{ color: tokens.text.secondary }}>
          Tell us about yourself so we can personalize your experience.
        </p>
      </div>

      {/* Full Name */}
      <div className="space-y-2">
        <Label htmlFor="fullName" style={{ color: tokens.text.primary }}>
          Full Name <span style={{ color: '#ef4444' }}>*</span>
        </Label>
        <Input
          id="fullName"
          placeholder="Jane Doe"
          value={data.fullName}
          onChange={(e) => update({ fullName: e.target.value })}
          aria-invalid={!!errors.fullName}
          style={{
            background: tokens.surface.elevated,
            borderColor: errors.fullName ? '#ef4444' : tokens.borderFaint,
            color: tokens.text.primary,
          }}
        />
        {errors.fullName && (
          <p className="text-xs" style={{ color: '#ef4444' }}>
            {errors.fullName}
          </p>
        )}
      </div>

      {/* Email (read-only) */}
      <div className="space-y-2">
        <Label htmlFor="email" style={{ color: tokens.text.primary }}>
          Email
        </Label>
        <Input
          id="email"
          value={data.email}
          readOnly
          className="cursor-not-allowed opacity-60"
          style={{
            background: tokens.surface.secondary,
            borderColor: tokens.borderFaint,
            color: tokens.text.secondary,
          }}
        />
      </div>

      {/* Role / Title */}
      <div className="space-y-2">
        <Label style={{ color: tokens.text.primary }}>
          <Briefcase
            className="size-4 inline-block mr-1"
            style={{ color: tokens.accent.primary }}
          />
          Role / Title
        </Label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-52 overflow-y-auto pr-1">
          {ROLES.map((role) => (
            <button
              key={role}
              type="button"
              onClick={() => update({ role, customRole: '' })}
              className="text-left px-3 py-2.5 rounded-lg border text-sm transition-all"
              style={{
                background: data.role === role ? tokens.accent.ghost : tokens.surface.elevated,
                borderColor: data.role === role ? tokens.accent.primary : tokens.borderFaint,
                color: data.role === role ? tokens.accent.primary : tokens.text.secondary,
              }}
            >
              {role}
            </button>
          ))}
          <button
            type="button"
            onClick={() => update({ role: 'Other' })}
            className="text-left px-3 py-2.5 rounded-lg border text-sm transition-all"
            style={{
              background: data.role === 'Other' ? tokens.accent.ghost : tokens.surface.elevated,
              borderColor: data.role === 'Other' ? tokens.accent.primary : tokens.borderFaint,
              color: data.role === 'Other' ? tokens.accent.primary : tokens.text.secondary,
            }}
          >
            Other
          </button>
        </div>
        {data.role === 'Other' && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <Input
              placeholder="Enter your role..."
              value={data.customRole}
              onChange={(e) => update({ customRole: e.target.value })}
              className="mt-2"
              style={{
                background: tokens.surface.elevated,
                borderColor: tokens.borderFaint,
                color: tokens.text.primary,
              }}
            />
          </motion.div>
        )}
      </div>

      {/* Company Name */}
      <div className="space-y-2">
        <Label htmlFor="company" style={{ color: tokens.text.primary }}>
          <Building2
            className="size-4 inline-block mr-1"
            style={{ color: tokens.accent.primary }}
          />
          Company Name
        </Label>
        <Input
          id="company"
          placeholder="Acme Corp"
          value={data.company}
          onChange={(e) => update({ company: e.target.value })}
          style={{
            background: tokens.surface.elevated,
            borderColor: tokens.borderFaint,
            color: tokens.text.primary,
          }}
        />
      </div>

      {/* Industry */}
      <div className="space-y-2">
        <Label style={{ color: tokens.text.primary }}>Industry</Label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-52 overflow-y-auto pr-1">
          {INDUSTRIES.map((ind) => (
            <button
              key={ind}
              type="button"
              onClick={() => update({ industry: ind, customIndustry: '' })}
              className="text-left px-3 py-2.5 rounded-lg border text-sm transition-all"
              style={{
                background: data.industry === ind ? tokens.accent.ghost : tokens.surface.elevated,
                borderColor: data.industry === ind ? tokens.accent.primary : tokens.borderFaint,
                color: data.industry === ind ? tokens.accent.primary : tokens.text.secondary,
              }}
            >
              {ind}
            </button>
          ))}
          <button
            type="button"
            onClick={() => update({ industry: 'Other' })}
            className="text-left px-3 py-2.5 rounded-lg border text-sm transition-all"
            style={{
              background: data.industry === 'Other' ? tokens.accent.ghost : tokens.surface.elevated,
              borderColor: data.industry === 'Other' ? tokens.accent.primary : tokens.borderFaint,
              color: data.industry === 'Other' ? tokens.accent.primary : tokens.text.secondary,
            }}
          >
            Other
          </button>
        </div>
        {data.industry === 'Other' && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <Input
              placeholder="Enter your industry..."
              value={data.customIndustry}
              onChange={(e) => update({ customIndustry: e.target.value })}
              className="mt-2"
              style={{
                background: tokens.surface.elevated,
                borderColor: tokens.borderFaint,
                color: tokens.text.primary,
              }}
            />
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Step 2 — Intelligence Preferences
// ═══════════════════════════════════════════════════════════════

function StepSignals({
  data,
  errors,
  toggleSignal,
  custom: direction,
}: {
  data: OnboardingData;
  errors: Record<string, string>;
  toggleSignal: (_id: string) => void;
  custom: number;
}) {
  return (
    <motion.div
      className="space-y-6"
      custom={direction}
      variants={slideVariants}
      initial="enter"
      animate="center"
      exit="exit"
      transition={{ duration: 0.3, ease: 'easeInOut' }}
    >
      <div>
        <h2 className="text-lg font-semibold mb-1" style={{ color: tokens.text.primary }}>
          <Cpu className="size-5 inline-block mr-2" style={{ color: tokens.accent.primary }} />
          Intelligence Preferences
        </h2>
        <p className="text-sm" style={{ color: tokens.text.secondary }}>
          Choose which signal types matter most to your workflow.
        </p>
      </div>

      {/* B9: At least one signal required */}
      {errors.signals && (
        <motion.p
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-sm rounded-lg px-3 py-2"
          style={{ color: '#ef4444', background: 'rgba(239,68,68,0.1)' }}
        >
          {errors.signals}
        </motion.p>
      )}

      <div className="space-y-3">
        {SIGNAL_OPTIONS.map((signal) => {
          const active = data.signals.includes(signal.id);
          return (
            <motion.div
              key={signal.id}
              className="flex items-start justify-between gap-4 rounded-xl border p-4 transition-all"
              style={{
                background: active ? tokens.accent.ghost : tokens.surface.card,
                borderColor: active ? tokens.accent.primary : tokens.borderFaint,
              }}
              whileTap={{ scale: 0.995 }}
            >
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <div
                  className="mt-0.5 shrink-0"
                  style={{ color: active ? tokens.accent.primary : tokens.text.muted }}
                >
                  {signal.icon}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className="text-sm font-medium"
                      style={{ color: active ? tokens.text.primary : tokens.text.secondary }}
                    >
                      {signal.label}
                    </span>
                    {/* B18: Tooltips explaining each signal type */}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          className="shrink-0"
                          aria-label={`Learn more about ${signal.label}`}
                        >
                          <Info className="size-3.5" style={{ color: tokens.text.muted }} />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent
                        side="top"
                        className="max-w-xs"
                        style={{
                          background: tokens.surface.elevated,
                          color: tokens.text.primary,
                          border: `1px solid ${tokens.borderFaint}`,
                        }}
                      >
                        {signal.tooltip}
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <p className="text-xs mt-0.5" style={{ color: tokens.text.muted }}>
                    {signal.description}
                  </p>
                </div>
              </div>
              <Switch checked={active} onCheckedChange={() => toggleSignal(signal.id)} />
            </motion.div>
          );
        })}
      </div>

      <p className="text-xs" style={{ color: tokens.text.muted }}>
        You can change these preferences anytime in Settings.
      </p>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Step 3 — Review & Complete (B13)
// ═══════════════════════════════════════════════════════════════

function StepReview({
  data,
  goToStep,
  custom: direction,
}: {
  data: OnboardingData;
  goToStep: (_step: number) => void;
  custom: number;
}) {
  const displayRole = data.role === 'Other' ? data.customRole : data.role;
  const displayIndustry = data.industry === 'Other' ? data.customIndustry : data.industry;
  const activeSignals = SIGNAL_OPTIONS.filter((s) => data.signals.includes(s.id));

  return (
    <motion.div
      className="space-y-6"
      custom={direction}
      variants={slideVariants}
      initial="enter"
      animate="center"
      exit="exit"
      transition={{ duration: 0.3, ease: 'easeInOut' }}
    >
      <div>
        <h2 className="text-lg font-semibold mb-1" style={{ color: tokens.text.primary }}>
          <Check className="size-5 inline-block mr-2" style={{ color: '#10b981' }} />
          Review & Complete
        </h2>
        <p className="text-sm" style={{ color: tokens.text.secondary }}>
          Review your selections before completing setup.
        </p>
      </div>

      {/* Summary Card — Profile */}
      <section
        className="rounded-xl border p-5 space-y-4"
        style={{
          background: tokens.surface.card,
          borderColor: tokens.borderFaint,
        }}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold" style={{ color: tokens.text.primary }}>
            Profile
          </h3>
          {/* B13: Edit button */}
          <button
            type="button"
            onClick={() => goToStep(1)}
            className="flex items-center gap-1 text-xs font-medium transition-colors hover:opacity-80"
            style={{ color: tokens.accent.primary }}
          >
            <Pencil className="size-3" />
            Edit
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <ReviewRow label="Name" value={data.fullName || '—'} />
          <ReviewRow label="Email" value={data.email || '—'} />
          <ReviewRow label="Role" value={displayRole || '—'} />
          <ReviewRow label="Company" value={data.company || '—'} />
          <ReviewRow label="Industry" value={displayIndustry || '—'} />
        </div>
      </section>

      {/* Summary Card — Signals */}
      <section
        className="rounded-xl border p-5 space-y-4"
        style={{
          background: tokens.surface.card,
          borderColor: tokens.borderFaint,
        }}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold" style={{ color: tokens.text.primary }}>
            Signal Types
          </h3>
          <button
            type="button"
            onClick={() => goToStep(2)}
            className="flex items-center gap-1 text-xs font-medium transition-colors hover:opacity-80"
            style={{ color: tokens.accent.primary }}
          >
            <Pencil className="size-3" />
            Edit
          </button>
        </div>
        {activeSignals.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {activeSignals.map((s) => (
              <span
                key={s.id}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
                style={{
                  background: tokens.accent.ghost,
                  color: tokens.accent.primary,
                  border: `1px solid ${tokens.accent.primary}33`,
                }}
              >
                {s.icon}
                {s.label}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm" style={{ color: tokens.text.muted }}>
            No signal types selected.
          </p>
        )}
      </section>

      <p className="text-xs text-center" style={{ color: tokens.text.muted }}>
        Click &quot;Complete Setup&quot; to save your preferences and start using Intelligence OS.
      </p>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Shared sub-components
// ═══════════════════════════════════════════════════════════════

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs mb-0.5" style={{ color: tokens.text.muted }}>
        {label}
      </p>
      <p className="text-sm font-medium" style={{ color: tokens.text.primary }}>
        {value}
      </p>
    </div>
  );
}
