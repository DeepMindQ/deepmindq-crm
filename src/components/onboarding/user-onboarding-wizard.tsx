'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PageTransition } from '@/components/ui/animated-components';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CheckCircle2, User, Sparkles, Rocket, Loader2 } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { toast } from 'sonner';

/* ═══════════════════════════════════════════════════
   Onboarding Wizard — 3-Step Setup
   ═══════════════════════════════════════════════════ */

const ROLES = [
  'CEO',
  'CRO',
  'VP Sales',
  'Sales Director',
  'Account Executive',
  'Sales Development Rep',
  'Marketing Manager',
  'Other',
];

const INDUSTRIES = ['SaaS', 'FinTech', 'HealthTech', 'EdTech', 'E-Commerce', 'Consulting', 'Other'];

const INTELLIGENCE_SIGNALS = [
  {
    key: 'funding',
    label: 'Funding Signals',
    description:
      'Track funding rounds, valuations, and investor activity for your target accounts.',
    default: true,
  },
  {
    key: 'hiring',
    label: 'Hiring Changes',
    description:
      'Monitor key hires, team growth, and organizational changes that signal buying intent.',
    default: true,
  },
  {
    key: 'technology',
    label: 'Technology Changes',
    description: 'Detect tech stack changes, new tool adoption, and integration signals.',
    default: true,
  },
  {
    key: 'expansion',
    label: 'Market Expansion',
    description: 'Identify geographic expansion, new office openings, and market entry signals.',
    default: false,
  },
  {
    key: 'competitive',
    label: 'Competitive Moves',
    description: 'Track competitor partnerships, product launches, and strategic positioning.',
    default: false,
  },
  {
    key: 'leadership',
    label: 'Leadership Changes',
    description: 'Stay informed on C-suite changes, board appointments, and executive moves.',
    default: false,
  },
];

interface FormData {
  fullName: string;
  role: string;
  companyName: string;
  industry: string;
  signals: Record<string, boolean>;
}

const ONBOARDING_STORAGE_KEY = 'dmq_onboarding_progress';

interface StoredProgress {
  step: number;
  formData: FormData;
}

const stepVariants = {
  enter: { opacity: 0, x: 40 },
  center: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -40 },
};

export function UserOnboardingWizard() {
  // Try restoring progress from localStorage (FIX B8)
  const [step, setStep] = useState(() => {
    if (typeof window === 'undefined') return 0;
    try {
      const stored = localStorage.getItem(ONBOARDING_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as StoredProgress;
        if (parsed.step != null && parsed.formData) return parsed.step;
      }
    } catch {
      /* ignore parse errors */
    }
    return 0;
  });
  const [formData, setFormData] = useState<FormData>(() => {
    if (typeof window === 'undefined') {
      return {
        fullName: '',
        role: '',
        companyName: '',
        industry: '',
        signals: Object.fromEntries(INTELLIGENCE_SIGNALS.map((s) => [s.key, s.default])),
      };
    }
    try {
      const stored = localStorage.getItem(ONBOARDING_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as StoredProgress;
        if (parsed.formData) return parsed.formData;
      }
    } catch {
      /* ignore parse errors */
    }
    return {
      fullName: '',
      role: '',
      companyName: '',
      industry: '',
      signals: Object.fromEntries(INTELLIGENCE_SIGNALS.map((s) => [s.key, s.default])),
    };
  });

  // Persist onboarding progress to localStorage on step/form changes
  const persistProgress = useCallback((currentStep: number, currentFormData: FormData) => {
    try {
      localStorage.setItem(
        ONBOARDING_STORAGE_KEY,
        JSON.stringify({ step: currentStep, formData: currentFormData } as StoredProgress),
      );
    } catch {
      /* storage full or unavailable */
    }
  }, []);

  useEffect(() => {
    persistProgress(step, formData);
  }, [step, formData, persistProgress]);

  const setActiveView = useAppStore((s) => s.setActiveView);

  const updateField = <K extends keyof FormData>(key: K, value: FormData[K]) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const toggleSignal = (key: string) => {
    setFormData((prev) => ({
      ...prev,
      signals: { ...prev.signals, [key]: !prev.signals[key] },
    }));
  };

  const canProceedStep0 =
    formData.fullName.trim() !== '' &&
    formData.role !== '' &&
    formData.companyName.trim() !== '' &&
    formData.industry !== '';

  const enabledSignals = INTELLIGENCE_SIGNALS.filter((s) => formData.signals[s.key]);

  const goNext = () => {
    if (step < 2) setStep(step + 1);
  };
  const goBack = () => {
    if (step > 0) setStep(step - 1);
  };

  const clearPersistedProgress = useCallback(() => {
    try {
      localStorage.removeItem(ONBOARDING_STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, []);
  const [saving, setSaving] = useState(false);

  const goToDashboard = async () => {
    setSaving(true);
    let saved = false;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        await fetch('/api/onboarding/preferences', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(formData),
        });
        saved = true;
        break;
      } catch {
        // Retry once after 1 second
        if (attempt === 0) {
          await new Promise((r) => setTimeout(r, 1000));
        }
      }
    }
    if (!saved) {
      toast.error('Failed to save preferences. They will be lost.');
    }
    setSaving(false);
    clearPersistedProgress();
    setActiveView('dashboard');
  };

  const steps = [
    { label: 'Profile', icon: User },
    { label: 'Intelligence', icon: Sparkles },
    { label: 'Complete', icon: Rocket },
  ];

  return (
    <PageTransition className="flex flex-col items-center justify-center min-h-[80vh] px-4">
      {/* ── Progress Indicator ── */}
      <div className="flex items-center gap-2 mb-10">
        {steps.map((s, i) => {
          const Icon = s.icon;
          const isActive = i === step;
          const isDone = i < step;
          return (
            <div key={s.label} className="flex items-center gap-2">
              <div
                className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all duration-300 ${
                  isActive
                    ? 'border-[#3B82F6] bg-[#3B82F6]/15 shadow-[0_0_12px_rgba(59,130,246,0.25)]'
                    : isDone
                      ? 'border-emerald-500/60 bg-emerald-500/10'
                      : 'border-[var(--ios-border,#1e2330)] bg-[var(--ios-bg-card,#141821)]'
                }`}
              >
                {isDone ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                ) : (
                  <Icon
                    className={`w-4 h-4 ${isActive ? 'text-[#3B82F6]' : 'text-[var(--ios-text-secondary,#6b7280)]'}`}
                  />
                )}
              </div>
              {i < steps.length - 1 && (
                <div
                  className={`w-12 sm:w-20 h-[2px] rounded-full transition-colors duration-300 ${
                    i < step ? 'bg-emerald-500/50' : 'bg-[var(--ios-border,#1e2330)]'
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* ── Step Content ── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          variants={stepVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-lg"
        >
          {step === 0 && (
            <StepProfile
              formData={formData}
              updateField={updateField}
              canProceed={canProceedStep0}
              onNext={goNext}
            />
          )}
          {step === 1 && (
            <StepIntelligence
              formData={formData}
              toggleSignal={toggleSignal}
              onNext={goNext}
              onBack={goBack}
            />
          )}
          {step === 2 && (
            <StepComplete
              formData={formData}
              enabledSignals={enabledSignals}
              onGoToDashboard={goToDashboard}
              saving={saving}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </PageTransition>
  );
}

/* ═══════════════════════════════════════════════════
   Step 1: Profile Setup
   ═══════════════════════════════════════════════════ */

function StepProfile({
  formData,
  updateField,
  canProceed,
  onNext,
}: {
  formData: FormData;
  updateField: <K extends keyof FormData>(_key: K, _value: FormData[K]) => void;
  canProceed: boolean;
  onNext: () => void;
}) {
  return (
    <div
      className="rounded-2xl border border-[var(--ios-border,#1e2330)] p-6 sm:p-8"
      style={{ background: 'var(--ios-bg-card, #141821)', boxShadow: '0 4px 24px rgba(0,0,0,0.3)' }}
    >
      <div className="mb-6">
        <h2
          className="text-xl font-bold mb-1"
          style={{ color: 'var(--ios-text-primary, #e8ecf4)' }}
        >
          Set up your profile
        </h2>
        <p className="text-sm" style={{ color: 'var(--ios-text-secondary, #6b7280)' }}>
          Tell us about yourself to personalize your Intelligence OS experience.
        </p>
      </div>

      <div className="space-y-5">
        <div className="space-y-2">
          <Label
            htmlFor="fullName"
            className="text-sm font-medium"
            style={{ color: 'var(--ios-text-primary, #e8ecf4)' }}
          >
            Full Name
          </Label>
          <Input
            id="fullName"
            placeholder="Jane Smith"
            value={formData.fullName}
            onChange={(e) => updateField('fullName', e.target.value)}
            className="h-11 rounded-lg border-[var(--ios-border,#1e2330)] bg-[var(--ios-bg-primary,#0a0c10)] text-[var(--ios-text-primary,#e8ecf4)] placeholder:text-[var(--ios-text-secondary,#6b7280)] focus-visible:ring-[#3B82F6]/40"
          />
        </div>

        <div className="space-y-2">
          <Label
            className="text-sm font-medium"
            style={{ color: 'var(--ios-text-primary, #e8ecf4)' }}
          >
            Role / Title
          </Label>
          <Select value={formData.role} onValueChange={(v) => updateField('role', v)}>
            <SelectTrigger className="h-11 rounded-lg border-[var(--ios-border,#1e2330)] bg-[var(--ios-bg-primary,#0a0c10)] text-[var(--ios-text-primary,#e8ecf4)]">
              <SelectValue placeholder="Select your role" />
            </SelectTrigger>
            <SelectContent className="border-[var(--ios-border,#1e2330)] bg-[var(--ios-bg-card,#141821)]">
              {ROLES.map((role) => (
                <SelectItem
                  key={role}
                  value={role}
                  className="text-[var(--ios-text-primary,#e8ecf4)] focus:bg-[#3B82F6]/10 focus:text-[#3B82F6]"
                >
                  {role}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label
            htmlFor="companyName"
            className="text-sm font-medium"
            style={{ color: 'var(--ios-text-primary, #e8ecf4)' }}
          >
            Company Name
          </Label>
          <Input
            id="companyName"
            placeholder="Acme Corp"
            value={formData.companyName}
            onChange={(e) => updateField('companyName', e.target.value)}
            className="h-11 rounded-lg border-[var(--ios-border,#1e2330)] bg-[var(--ios-bg-primary,#0a0c10)] text-[var(--ios-text-primary,#e8ecf4)] placeholder:text-[var(--ios-text-secondary,#6b7280)] focus-visible:ring-[#3B82F6]/40"
          />
        </div>

        <div className="space-y-2">
          <Label
            className="text-sm font-medium"
            style={{ color: 'var(--ios-text-primary, #e8ecf4)' }}
          >
            Industry
          </Label>
          <Select value={formData.industry} onValueChange={(v) => updateField('industry', v)}>
            <SelectTrigger className="h-11 rounded-lg border-[var(--ios-border,#1e2330)] bg-[var(--ios-bg-primary,#0a0c10)] text-[var(--ios-text-primary,#e8ecf4)]">
              <SelectValue placeholder="Select your industry" />
            </SelectTrigger>
            <SelectContent className="border-[var(--ios-border,#1e2330)] bg-[var(--ios-bg-card,#141821)]">
              {INDUSTRIES.map((ind) => (
                <SelectItem
                  key={ind}
                  value={ind}
                  className="text-[var(--ios-text-primary,#e8ecf4)] focus:bg-[#3B82F6]/10 focus:text-[#3B82F6]"
                >
                  {ind}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mt-8 flex justify-end">
        <Button
          onClick={onNext}
          disabled={!canProceed}
          className="h-11 px-6 rounded-lg bg-[#3B82F6] hover:bg-[#2563EB] text-white font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(59,130,246,0.25)] hover:shadow-[0_0_24px_rgba(59,130,246,0.35)]"
        >
          Continue
        </Button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   Step 2: Intelligence Preferences
   ═══════════════════════════════════════════════════ */

function StepIntelligence({
  formData,
  toggleSignal,
  onNext,
  onBack,
}: {
  formData: FormData;
  toggleSignal: (_key: string) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  return (
    <div
      className="rounded-2xl border border-[var(--ios-border,#1e2330)] p-6 sm:p-8"
      style={{ background: 'var(--ios-bg-card, #141821)', boxShadow: '0 4px 24px rgba(0,0,0,0.3)' }}
    >
      <div className="mb-6">
        <h2
          className="text-xl font-bold mb-1"
          style={{ color: 'var(--ios-text-primary, #e8ecf4)' }}
        >
          Intelligence Preferences
        </h2>
        <p className="text-sm" style={{ color: 'var(--ios-text-secondary, #6b7280)' }}>
          Choose the signals you want Intelligence OS to monitor. You can change these anytime.
        </p>
      </div>

      <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1 custom-scrollbar">
        {INTELLIGENCE_SIGNALS.map((signal) => {
          const enabled = formData.signals[signal.key];
          return (
            <div
              key={signal.key}
              className={`flex items-start justify-between gap-4 p-4 rounded-xl border transition-all duration-200 ${
                enabled
                  ? 'border-[#3B82F6]/30 bg-[#3B82F6]/5'
                  : 'border-[var(--ios-border,#1e2330)] bg-[var(--ios-bg-primary,#0a0c10)]/50'
              }`}
            >
              <div className="flex-1 min-w-0">
                <p
                  className="text-sm font-medium mb-0.5"
                  style={{ color: 'var(--ios-text-primary, #e8ecf4)' }}
                >
                  {signal.label}
                </p>
                <p
                  className="text-xs leading-relaxed"
                  style={{ color: 'var(--ios-text-secondary, #6b7280)' }}
                >
                  {signal.description}
                </p>
              </div>
              <Switch
                checked={enabled}
                onCheckedChange={() => toggleSignal(signal.key)}
                className="shrink-0 mt-0.5 data-[state=checked]:bg-[#3B82F6] data-[state=unchecked]:bg-[var(--ios-border,#1e2330)]"
              />
            </div>
          );
        })}
      </div>

      <div className="mt-8 flex items-center justify-between">
        <Button
          variant="ghost"
          onClick={onBack}
          className="h-11 px-5 rounded-lg text-[var(--ios-text-secondary,#6b7280)] hover:text-[var(--ios-text-primary,#e8ecf4)] hover:bg-white/5"
        >
          Back
        </Button>
        <Button
          onClick={onNext}
          className="h-11 px-6 rounded-lg bg-[#3B82F6] hover:bg-[#2563EB] text-white font-medium transition-all shadow-[0_0_20px_rgba(59,130,246,0.25)] hover:shadow-[0_0_24px_rgba(59,130,246,0.35)]"
        >
          Continue
        </Button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   Step 3: Tour Complete
   ═══════════════════════════════════════════════════ */

function StepComplete({
  formData,
  enabledSignals,
  onGoToDashboard,
  saving,
}: {
  formData: FormData;
  enabledSignals: typeof INTELLIGENCE_SIGNALS;
  onGoToDashboard: () => void;
  saving: boolean;
}) {
  return (
    <div
      className="rounded-2xl border border-[var(--ios-border,#1e2330)] p-6 sm:p-8 text-center"
      style={{ background: 'var(--ios-bg-card, #141821)', boxShadow: '0 4px 24px rgba(0,0,0,0.3)' }}
    >
      {/* Success animation */}
      <motion.div
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.15 }}
        className="mx-auto mb-6 w-20 h-20 rounded-full flex items-center justify-center"
        style={{
          background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(16, 185, 129, 0.05))',
          border: '2px solid rgba(16, 185, 129, 0.3)',
          boxShadow: '0 0 30px rgba(16, 185, 129, 0.15)',
        }}
      >
        <CheckCircle2 className="w-10 h-10 text-emerald-400" />
      </motion.div>

      <motion.h2
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        className="text-xl font-bold mb-2"
        style={{ color: 'var(--ios-text-primary, #e8ecf4)' }}
      >
        You're all set!
      </motion.h2>
      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45 }}
        className="text-sm mb-6"
        style={{ color: 'var(--ios-text-secondary, #6b7280)' }}
      >
        Intelligence OS is configured and ready. Here's a summary of your setup.
      </motion.p>

      {/* Summary card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.55 }}
        className="text-left rounded-xl border border-[var(--ios-border,#1e2330)] p-5 space-y-4 mb-8"
        style={{ background: 'var(--ios-bg-primary, #0a0c10)' }}
      >
        <div>
          <p
            className="text-xs font-medium uppercase tracking-wider mb-2"
            style={{ color: 'var(--ios-text-secondary, #6b7280)' }}
          >
            Profile
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs" style={{ color: 'var(--ios-text-secondary, #6b7280)' }}>
                Name
              </p>
              <p
                className="text-sm font-medium"
                style={{ color: 'var(--ios-text-primary, #e8ecf4)' }}
              >
                {formData.fullName}
              </p>
            </div>
            <div>
              <p className="text-xs" style={{ color: 'var(--ios-text-secondary, #6b7280)' }}>
                Role
              </p>
              <p
                className="text-sm font-medium"
                style={{ color: 'var(--ios-text-primary, #e8ecf4)' }}
              >
                {formData.role}
              </p>
            </div>
            <div>
              <p className="text-xs" style={{ color: 'var(--ios-text-secondary, #6b7280)' }}>
                Company
              </p>
              <p
                className="text-sm font-medium"
                style={{ color: 'var(--ios-text-primary, #e8ecf4)' }}
              >
                {formData.companyName}
              </p>
            </div>
            <div>
              <p className="text-xs" style={{ color: 'var(--ios-text-secondary, #6b7280)' }}>
                Industry
              </p>
              <p
                className="text-sm font-medium"
                style={{ color: 'var(--ios-text-primary, #e8ecf4)' }}
              >
                {formData.industry}
              </p>
            </div>
          </div>
        </div>

        <div className="border-t border-[var(--ios-border,#1e2330)] pt-4">
          <p
            className="text-xs font-medium uppercase tracking-wider mb-2"
            style={{ color: 'var(--ios-text-secondary, #6b7280)' }}
          >
            Active Intelligence Signals ({enabledSignals.length})
          </p>
          <div className="flex flex-wrap gap-2">
            {enabledSignals.map((s) => (
              <span
                key={s.key}
                className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium"
                style={{
                  background: 'rgba(59, 130, 246, 0.1)',
                  color: '#60a5fa',
                  border: '1px solid rgba(59, 130, 246, 0.2)',
                }}
              >
                {s.label}
              </span>
            ))}
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.65 }}
      >
        <Button
          onClick={onGoToDashboard}
          disabled={saving}
          className="h-12 px-8 rounded-lg bg-[#3B82F6] hover:bg-[#2563EB] text-white font-semibold transition-all shadow-[0_0_24px_rgba(59,130,246,0.3)] hover:shadow-[0_0_32px_rgba(59,130,246,0.4)] disabled:opacity-60"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Rocket className="w-4 h-4 mr-2" />
          )}
          {saving ? 'Saving...' : 'Go to Dashboard'}
        </Button>
      </motion.div>
    </div>
  );
}
