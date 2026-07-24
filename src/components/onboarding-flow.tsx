'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Building2, UserCheck, Rocket, ChevronRight, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

/* ── Constants ── */
const STORAGE_KEY = 'dmq_onboarding_complete';

const INDUSTRIES = [
  'Technology / SaaS',
  'Finance & Banking',
  'Healthcare & Pharma',
  'Manufacturing',
  'Retail & E-Commerce',
  'Education',
  'Media & Advertising',
  'Real Estate',
  'Professional Services',
  'Telecommunications',
  'Energy & Utilities',
  'Other',
];

const DESIGNATIONS = [
  'CEO',
  'CTO',
  'VP Sales',
  'Sales Manager',
  'Sales Rep',
  'Marketing Manager',
];

/* ── Types ── */
interface OnboardingData {
  companyName: string;
  industry: string;
  fullName: string;
  designation: string;
}

/* ── Animation variants ── */
const slideVariants = {
  enter: { opacity: 0, x: 60, scale: 0.97 },
  center: { opacity: 1, x: 0, scale: 1 },
  exit: { opacity: 0, x: -60, scale: 0.95 },
};

const backdropVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

/* ── Step indicator ── */
function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-2"
        >
          <motion.div
            className="h-2 rounded-full transition-all duration-300"
            style={{
              width: i + 1 === total ? '2rem' : '2rem',
              background:
                i <= current
                  ? 'linear-gradient(90deg, var(--color-gold), var(--color-gold-bright))'
                  : 'rgba(255,255,255,0.12)',
              boxShadow:
                i === current
                  ? '0 0 12px color-mix(in oklch, var(--color-gold) 40%, transparent)'
                  : 'none',
            }}
            animate={i === current ? { scale: [1, 1.08, 1] } : {}}
            transition={{ duration: 2, repeat: Infinity }}
          />
          {i < total - 1 && (
            <ChevronRight
              className="w-3 h-3"
              style={{ color: i < current ? 'var(--color-gold)' : 'rgba(255,255,255,0.2)' }}
            />
          )}
        </div>
      ))}
    </div>
  );
}

/* ── Gold button ── */
function GoldButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <Button
      onClick={onClick}
      disabled={disabled}
      className="w-full h-11 rounded-xl text-sm font-semibold transition-all duration-200"
      style={{
        background: 'linear-gradient(135deg, var(--color-gold), var(--color-gold-bright))',
        color: '#fff',
        boxShadow: '0 4px 20px color-mix(in oklch, var(--color-gold) 30%, transparent)',
      }}
    >
      {children}
    </Button>
  );
}

/* ── Field wrapper ── */
function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label
        htmlFor={htmlFor}
        className="block text-xs font-medium uppercase tracking-widest"
        style={{ color: 'var(--color-gold)' }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

/* ── Step 1: Company Info ── */
function StepCompany({
  data,
  onChange,
  onNext,
}: {
  data: OnboardingData;
  onChange: (field: keyof OnboardingData, value: string) => void;
  onNext: () => void;
}) {
  const canProceed = data.companyName.trim().length > 0 && data.industry.length > 0;

  return (
    <motion.div
      key="step-1"
      variants={slideVariants}
      initial="enter"
      animate="center"
      exit="exit"
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="space-y-6"
    >
      <div className="flex flex-col items-center gap-3 mb-2">
        <motion.div
          className="w-14 h-14 rounded-2xl flex items-center justify-center"
          style={{
            background: 'color-mix(in oklch, var(--color-gold) 15%, transparent)',
            border: '1px solid color-mix(in oklch, var(--color-gold) 25%, transparent)',
          }}
          animate={{ boxShadow: ['0 0 0px transparent', '0 0 20px color-mix(in oklch, var(--color-gold) 20%, transparent)', '0 0 0px transparent'] }}
          transition={{ duration: 3, repeat: Infinity }}
        >
          <Building2 className="w-7 h-7" style={{ color: 'var(--color-gold)' }} />
        </motion.div>
        <div className="text-center">
          <h2 className="text-xl font-bold text-white">Tell us about your company</h2>
          <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.5)' }}>
            Help us personalize DeepMindQ for your business
          </p>
        </div>
      </div>

      <Field label="Company Name" htmlFor="company-name">
        <Input
          id="company-name"
          placeholder="e.g. Acme Corp"
          value={data.companyName}
          onChange={(e) => onChange('companyName', e.target.value)}
          className="h-11 rounded-xl bg-white/5 border-white/10 text-white placeholder:text-white/30 focus-visible:border-[var(--color-gold)]/50 focus-visible:ring-[var(--color-gold)]/20"
          autoFocus
        />
      </Field>

      <Field label="Industry" htmlFor="industry">
        <Select value={data.industry} onValueChange={(v) => onChange('industry', v)}>
          <SelectTrigger
            id="industry"
            className="h-11 w-full rounded-xl bg-white/5 border-white/10 text-white data-[placeholder]:text-white/30 focus:ring-[var(--color-gold)]/20"
          >
            <SelectValue placeholder="Select your industry" />
          </SelectTrigger>
          <SelectContent portal={false} className="rounded-xl bg-[#1a1a2e] border-white/10 text-white">
            {INDUSTRIES.map((ind) => (
              <SelectItem key={ind} value={ind} className="rounded-lg focus:bg-white/10 focus:text-[var(--color-gold)]">
                {ind}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <GoldButton onClick={onNext} disabled={!canProceed}>
        Continue <ChevronRight className="w-4 h-4 ml-1" />
      </GoldButton>
    </motion.div>
  );
}

/* ── Step 2: Role Setup ── */
function StepRole({
  data,
  onChange,
  onNext,
  onBack,
}: {
  data: OnboardingData;
  onChange: (field: keyof OnboardingData, value: string) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const canProceed = data.fullName.trim().length > 0 && data.designation.length > 0;

  return (
    <motion.div
      key="step-2"
      variants={slideVariants}
      initial="enter"
      animate="center"
      exit="exit"
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="space-y-6"
    >
      <div className="flex flex-col items-center gap-3 mb-2">
        <motion.div
          className="w-14 h-14 rounded-2xl flex items-center justify-center"
          style={{
            background: 'color-mix(in oklch, var(--color-gold) 15%, transparent)',
            border: '1px solid color-mix(in oklch, var(--color-gold) 25%, transparent)',
          }}
          animate={{ boxShadow: ['0 0 0px transparent', '0 0 20px color-mix(in oklch, var(--color-gold) 20%, transparent)', '0 0 0px transparent'] }}
          transition={{ duration: 3, repeat: Infinity }}
        >
          <UserCheck className="w-7 h-7" style={{ color: 'var(--color-gold)' }} />
        </motion.div>
        <div className="text-center">
          <h2 className="text-xl font-bold text-white">Set your role</h2>
          <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.5)' }}>
            We&apos;ll tailor the experience to your responsibilities
          </p>
        </div>
      </div>

      <Field label="Full Name" htmlFor="full-name">
        <Input
          id="full-name"
          placeholder="e.g. Jane Smith"
          value={data.fullName}
          onChange={(e) => onChange('fullName', e.target.value)}
          className="h-11 rounded-xl bg-white/5 border-white/10 text-white placeholder:text-white/30 focus-visible:border-[var(--color-gold)]/50 focus-visible:ring-[var(--color-gold)]/20"
          autoFocus
        />
      </Field>

      <Field label="Designation" htmlFor="designation">
        <Select value={data.designation} onValueChange={(v) => onChange('designation', v)}>
          <SelectTrigger
            id="designation"
            className="h-11 w-full rounded-xl bg-white/5 border-white/10 text-white data-[placeholder]:text-white/30 focus:ring-[var(--color-gold)]/20"
          >
            <SelectValue placeholder="Select your role" />
          </SelectTrigger>
          <SelectContent portal={false} className="rounded-xl bg-[#1a1a2e] border-white/10 text-white">
            {DESIGNATIONS.map((d) => (
              <SelectItem key={d} value={d} className="rounded-lg focus:bg-white/10 focus:text-[var(--color-gold)]">
                {d}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <div className="flex gap-3">
        <Button
          onClick={onBack}
          variant="ghost"
          className="flex-1 h-11 rounded-xl text-white/60 hover:text-white hover:bg-white/5"
        >
          Back
        </Button>
        <div className="flex-[2]">
          <GoldButton onClick={onNext} disabled={!canProceed}>
            Continue <ChevronRight className="w-4 h-4 ml-1" />
          </GoldButton>
        </div>
      </div>
    </motion.div>
  );
}

/* ── Step 3: Summary ── */
function StepComplete({
  data,
  onComplete,
  onBack,
}: {
  data: OnboardingData;
  onComplete: () => void;
  onBack: () => void;
}) {
  return (
    <motion.div
      key="step-3"
      variants={slideVariants}
      initial="enter"
      animate="center"
      exit="exit"
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="space-y-6"
    >
      <div className="flex flex-col items-center gap-3 mb-2">
        <motion.div
          className="w-14 h-14 rounded-2xl flex items-center justify-center"
          style={{
            background: 'linear-gradient(135deg, var(--color-gold), var(--color-gold-bright))',
            boxShadow: '0 0 30px color-mix(in oklch, var(--color-gold) 35%, transparent)',
          }}
          animate={{ rotate: [0, 10, -10, 0] }}
          transition={{ duration: 1.5, ease: 'easeInOut', delay: 0.2 }}
        >
          <Rocket className="w-7 h-7 text-white" />
        </motion.div>
        <div className="text-center">
          <h2 className="text-xl font-bold text-white">You&apos;re all set!</h2>
          <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.5)' }}>
            Here&apos;s what we have for you
          </p>
        </div>
      </div>

      {/* Summary card */}
      <div
        className="rounded-xl p-5 space-y-4"
        style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <SummaryRow icon={<Building2 className="w-4 h-4" />} label="Company" value={data.companyName} />
        <SummaryRow icon={<Building2 className="w-4 h-4" />} label="Industry" value={data.industry} />
        <SummaryRow icon={<UserCheck className="w-4 h-4" />} label="Name" value={data.fullName} />
        <SummaryRow icon={<UserCheck className="w-4 h-4" />} label="Role" value={data.designation} />
      </div>

      <div className="flex gap-3">
        <Button
          onClick={onBack}
          variant="ghost"
          className="flex-1 h-11 rounded-xl text-white/60 hover:text-white hover:bg-white/5"
        >
          Back
        </Button>
        <div className="flex-[2]">
          <GoldButton onClick={onComplete}>
            <Check className="w-4 h-4 mr-1" /> Go to Dashboard
          </GoldButton>
        </div>
      </div>
    </motion.div>
  );
}

function SummaryRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="shrink-0" style={{ color: 'var(--color-gold)' }}>{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.4)' }}>
          {label}
        </p>
        <p className="text-sm font-medium text-white truncate">{value}</p>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   Main OnboardingFlow component
   ═══════════════════════════════════════════════════ */
export function OnboardingFlow() {
  const [visible, setVisible] = useState(() => {
    if (typeof window !== 'undefined') {
      return !localStorage.getItem(STORAGE_KEY);
    }
    return false;
  });
  const [step, setStep] = useState(0);
  const [data, setData] = useState<OnboardingData>({
    companyName: '',
    industry: '',
    fullName: '',
    designation: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const updateField = (field: keyof OnboardingData, value: string) => {
    setData((prev) => ({ ...prev, [field]: value }));
  };

  const handleComplete = async () => {
    setSubmitting(true);
    try {
      await fetch('/api/g-auth/update-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
    } catch {
      // Best-effort — don't block the user
    }
    localStorage.setItem(STORAGE_KEY, 'true');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <AnimatePresence onExitComplete={() => setStep(0)}>
      {visible && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          variants={backdropVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          transition={{ duration: 0.3 }}
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(12px) saturate(1.5)' }}
        >
          {/* Close backdrop click area — stops propagation so dropdown clicks work */}
          <div className="absolute inset-0" onClick={(e) => e.stopPropagation()} />

          {/* Card */}
          <motion.div
            className="relative w-full max-w-md rounded-2xl p-6 sm:p-8"
            style={{
              background: 'linear-gradient(165deg, #12121e 0%, #0f0f1a 100%)',
              border: '1px solid rgba(255,255,255,0.08)',
              boxShadow: '0 25px 60px rgba(0,0,0,0.5), 0 0 40px color-mix(in oklch, var(--color-gold) 8%, transparent)',
            }}
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: 'spring', stiffness: 350, damping: 30 }}
          >
            <StepIndicator current={step} total={3} />

            <AnimatePresence mode="wait">
              {step === 0 && (
                <StepCompany data={data} onChange={updateField} onNext={() => setStep(1)} />
              )}
              {step === 1 && (
                <StepRole
                  data={data}
                  onChange={updateField}
                  onNext={() => setStep(2)}
                  onBack={() => setStep(0)}
                />
              )}
              {step === 2 && (
                <StepComplete data={data} onComplete={handleComplete} onBack={() => setStep(1)} />
              )}
            </AnimatePresence>

            {submitting && (
              <motion.div
                className="absolute inset-0 rounded-2xl flex items-center justify-center"
                style={{ background: 'rgba(15,15,26,0.85)', backdropFilter: 'blur(4px)' }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <div className="flex flex-col items-center gap-3">
                  <motion.div
                    className="w-8 h-8 border-2 border-t-transparent rounded-full"
                    style={{ borderColor: 'var(--color-gold)', borderTopColor: 'transparent' }}
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  />
                  <span className="text-xs text-white/60">Setting things up...</span>
                </div>
              </motion.div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
