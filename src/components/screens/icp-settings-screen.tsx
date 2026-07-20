'use client';

import { useState, useEffect, useCallback, type KeyboardEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PageTransition, SectionHeader, GlassPanel } from '@/components/ui/animated-components';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import {
  Target,
  Building2,
  Globe,
  Cpu,
  Ban,
  DollarSign,
  Users,
  Loader2,
  Save,
  RotateCcw,
  Sparkles,
  Info,
  X,
} from 'lucide-react';

/* ═══════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════ */
interface ICPProfile {
  targetIndustries: string[];
  targetSizeRanges: string[];
  targetRegions: string[];
  preferredTechKeywords: string[];
  excludedIndustries: string[];
  minRevenue?: string;
  maxRevenue?: string;
  minEmployeeCount?: number;
  maxEmployeeCount?: number;
}

const DEFAULT_PROFILE: ICPProfile = {
  targetIndustries: [],
  targetSizeRanges: [],
  targetRegions: [],
  preferredTechKeywords: [],
  excludedIndustries: [],
  minRevenue: '',
  maxRevenue: '',
  minEmployeeCount: undefined,
  maxEmployeeCount: undefined,
};

/* ═══════════════════════════════════════════════════════════
   Reusable Tag Input Component
   ═══════════════════════════════════════════════════════════ */
interface TagInputProps {
  tags: string[];
  onAdd: (tag: string) => void;
  onRemove: (tag: string) => void;
  placeholder?: string;
  badgeVariant?: 'default' | 'outline' | 'destructive';
  badgeClass?: string;
}

function TagInput({
  tags,
  onAdd,
  onRemove,
  placeholder = 'Type and press Enter...',
  badgeVariant = 'outline',
  badgeClass,
}: TagInputProps) {
  const [inputValue, setInputValue] = useState('');

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        const trimmed = inputValue.replace(/,/g, '').trim();
        if (trimmed) {
          onAdd(trimmed);
          setInputValue('');
        }
      }
      // Allow Backspace to remove last tag when input is empty
      if (e.key === 'Backspace' && !inputValue && tags.length > 0) {
        onRemove(tags[tags.length - 1]);
      }
    },
    [inputValue, onAdd, onRemove, tags]
  );

  return (
    <div className="flex flex-wrap items-center gap-2 p-3 rounded-lg border border-gray-200 bg-white/70 backdrop-blur-sm min-h-[48px] focus-within:border-[#D4AF37]/40 focus-within:ring-2 focus-within:ring-[#D4AF37]/10 transition-all">
      <AnimatePresence mode="popLayout">
        {tags.map((tag) => (
          <motion.span
            key={tag}
            initial={{ opacity: 0, scale: 0.8, y: 4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: -4 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            layout
          >
            <Badge
              variant={badgeVariant}
              className={`group relative flex items-center gap-1.5 pr-1 cursor-default transition-all hover:shadow-sm ${badgeClass || ''}`}
            >
              <span>{tag}</span>
              <button
                type="button"
                onClick={() => onRemove(tag)}
                className="ml-0.5 rounded-full p-0.5 hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                aria-label={`Remove ${tag}`}
              >
                <X className="size-3" />
              </button>
            </Badge>
          </motion.span>
        ))}
      </AnimatePresence>
      <input
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={tags.length === 0 ? placeholder : ''}
        className="flex-1 min-w-[140px] h-7 text-sm bg-transparent outline-none placeholder:text-muted-foreground"
      />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Tag Section Card Wrapper
   ═══════════════════════════════════════════════════════════ */
function TagSectionCard({
  icon: Icon,
  title,
  subtitle,
  tags,
  onAdd,
  onRemove,
  placeholder,
  badgeVariant,
  badgeClass,
  delay = 0,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
  tags: string[];
  onAdd: (tag: string) => void;
  onRemove: (tag: string) => void;
  placeholder?: string;
  badgeVariant?: 'default' | 'outline' | 'destructive';
  badgeClass?: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      <GlassPanel className="p-6">
        <SectionHeader title={title} subtitle={subtitle} />
        <div className="flex items-center gap-3 mb-3">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: 'rgba(212, 175, 55, 0.1)' }}
          >
            <Icon className="w-4 h-4" style={{ color: '#D4AF37' }} />
          </div>
          <div className="text-xs text-muted-foreground">
            {tags.length === 0
              ? 'No items added yet'
              : `${tags.length} item${tags.length !== 1 ? 's' : ''} configured`}
          </div>
        </div>
        <TagInput
          tags={tags}
          onAdd={onAdd}
          onRemove={onRemove}
          placeholder={placeholder}
          badgeVariant={badgeVariant}
          badgeClass={badgeClass}
        />
      </GlassPanel>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Main ICP Settings Screen
   ═══════════════════════════════════════════════════════════ */
export default function ICPSettingsScreen() {
  const [profile, setProfile] = useState<ICPProfile>(DEFAULT_PROFILE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  /* ── Fetch ICP profile on mount ── */
  useEffect(() => {
    async function fetchProfile() {
      try {
        const res = await fetch('/api/g-system/icp-profile');
        if (!res.ok) throw new Error('Failed to load ICP profile');
        const data: any = await res.json();
        setProfile({
          targetIndustries: data.targetIndustries ?? [],
          targetSizeRanges: data.targetSizeRanges ?? [],
          targetRegions: data.targetRegions ?? data.targetCountries ?? [],
          preferredTechKeywords: data.preferredTechKeywords ?? data.preferredTechnologies ?? [],
          excludedIndustries: data.excludedIndustries ?? data.excludeIndustries ?? [],
          minRevenue: data.minRevenue ?? '',
          maxRevenue: data.maxRevenue ?? '',
          minEmployeeCount: data.minEmployeeCount ?? data.minEmployees ?? undefined,
          maxEmployeeCount: data.maxEmployeeCount ?? data.maxEmployees ?? undefined,
        });
      } catch (err) {
        console.error('Failed to fetch ICP profile:', err);
        toast.error('Failed to load ICP configuration');
      } finally {
        setLoading(false);
      }
    }
    fetchProfile();
  }, []);

  /* ── Tag helpers ── */
  const addTag = useCallback(
    (field: keyof ICPProfile, value: string) => {
      setProfile((prev) => {
        const arr = prev[field] as string[];
        if (arr.some((t) => t.toLowerCase() === value.toLowerCase())) {
          toast.warning(`"${value}" already exists`);
          return prev;
        }
        return { ...prev, [field]: [...arr, value] };
      });
    },
    []
  );

  const removeTag = useCallback(
    (field: keyof ICPProfile, value: string) => {
      setProfile((prev) => ({
        ...prev,
        [field]: (prev[field] as string[]).filter((t) => t !== value),
      }));
    },
    []
  );

  /* ── Save ── */
  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/g-system/icp-profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile),
      });
      if (!res.ok) throw new Error('Failed to save ICP profile');
      toast.success('ICP configuration saved successfully');
    } catch (err) {
      console.error('Failed to save ICP profile:', err);
      toast.error('Failed to save ICP configuration');
    } finally {
      setSaving(false);
    }
  };

  /* ── Reset ── */
  const [resetting, setResetting] = useState(false);
  const handleReset = async () => {
    setResetting(true);
    try {
      const res = await fetch('/api/g-strategy/icp-profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reset: true }),
      });
      if (!res.ok) throw new Error('Failed to reset ICP profile');
      setProfile(DEFAULT_PROFILE);
      toast.success('ICP configuration reset to defaults and persisted');
    } catch (err) {
      console.error('Failed to reset ICP profile:', err);
      toast.error('Failed to reset ICP configuration');
    } finally {
      setResetting(false);
    }
  };

  /* ── Loading state ── */
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#D4AF37' }} />
          <p className="text-sm text-muted-foreground">Loading ICP configuration...</p>
        </motion.div>
      </div>
    );
  }

  /* ── Main render ── */
  return (
    <PageTransition className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* ── Header ── */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.15), rgba(212, 175, 55, 0.05))',
              border: '1px solid rgba(212, 175, 55, 0.2)',
            }}
          >
            <Target className="w-5 h-5" style={{ color: '#D4AF37' }} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">
              ICP Configuration
            </h1>
            <p className="text-sm text-muted-foreground">
              Define your Ideal Customer Profile to power account prioritization
            </p>
          </div>
        </div>
      </div>

      {/* ── Description Card ── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
      >
        <GlassPanel className="p-5">
          <div className="flex items-start gap-4">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: 'rgba(212, 175, 55, 0.08)' }}
            >
              <Sparkles className="w-5 h-5" style={{ color: '#D4AF37' }} />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-foreground">
                How ICP Drives Account Prioritization
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Your Ideal Customer Profile (ICP) is the foundation of the DeepMindQ
                prioritization engine. Accounts are scored and ranked based on how closely
                they match your defined target industries, company sizes, geographies, and
                technology stacks. Excluded industries are automatically deprioritized.
                Revenue and employee thresholds set hard filters. The more precise your ICP,
                the more accurate your account rankings.
              </p>
            </div>
          </div>
        </GlassPanel>
      </motion.div>

      <Separator />

      {/* ── Tag Sections ── */}
      <div className="space-y-6">
        {/* a. Target Industries */}
        <TagSectionCard
          icon={Building2}
          title="Target Industries"
          subtitle="Industries that represent your best-fit customers"
          tags={profile.targetIndustries}
          onAdd={(v) => addTag('targetIndustries', v)}
          onRemove={(v) => removeTag('targetIndustries', v)}
          placeholder="e.g. Technology, Financial Services, Healthcare..."
          delay={0.15}
        />

        {/* b. Target Company Size */}
        <TagSectionCard
          icon={Users}
          title="Target Company Size"
          subtitle="Employee count ranges for your ideal accounts"
          tags={profile.targetSizeRanges}
          onAdd={(v) => addTag('targetSizeRanges', v)}
          onRemove={(v) => removeTag('targetSizeRanges', v)}
          placeholder="e.g. 500-1000, 1000-5000, 5000-10000..."
          delay={0.2}
        />

        {/* c. Target Geography */}
        <TagSectionCard
          icon={Globe}
          title="Target Geography"
          subtitle="Countries or regions you want to focus on"
          tags={profile.targetRegions}
          onAdd={(v) => addTag('targetRegions', v)}
          onRemove={(v) => removeTag('targetRegions', v)}
          placeholder="e.g. US, IN, GB, DE..."
          delay={0.25}
        />

        {/* d. Technology Preferences */}
        <TagSectionCard
          icon={Cpu}
          title="Technology Preferences"
          subtitle="Technologies your ideal customers are likely using"
          tags={profile.preferredTechKeywords}
          onAdd={(v) => addTag('preferredTechKeywords', v)}
          onRemove={(v) => removeTag('preferredTechKeywords', v)}
          placeholder="e.g. AWS, Azure, Snowflake, Python..."
          delay={0.3}
        />

        {/* e. Excluded Industries */}
        <TagSectionCard
          icon={Ban}
          title="Excluded Industries"
          subtitle="Industries to automatically deprioritize"
          tags={profile.excludedIndustries}
          onAdd={(v) => addTag('excludedIndustries', v)}
          onRemove={(v) => removeTag('excludedIndustries', v)}
          placeholder="e.g. Retail, Hospitality..."
          badgeVariant="destructive"
          badgeClass="bg-red-50 text-red-600 border-red-200 hover:bg-red-100"
          delay={0.35}
        />
      </div>

      <Separator />

      {/* ── Revenue & Employees Section ── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
      >
        <GlassPanel className="p-6">
          <SectionHeader
            title="Revenue & Employee Thresholds"
            subtitle="Set hard filters to narrow down your ideal accounts"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Min Revenue */}
            <div className="space-y-2">
              <Label
                htmlFor="min-revenue"
                className="text-xs font-medium text-muted-foreground flex items-center gap-1.5"
              >
                <DollarSign className="w-3.5 h-3.5" style={{ color: '#D4AF37' }} />
                Minimum Revenue
              </Label>
              <Input
                id="min-revenue"
                type="text"
                placeholder="e.g. $1M"
                value={profile.minRevenue || ''}
                onChange={(e) =>
                  setProfile((p) => ({ ...p, minRevenue: e.target.value }))
                }
                className="h-9"
              />
            </div>
            {/* Max Revenue */}
            <div className="space-y-2">
              <Label
                htmlFor="max-revenue"
                className="text-xs font-medium text-muted-foreground flex items-center gap-1.5"
              >
                <DollarSign className="w-3.5 h-3.5" style={{ color: '#D4AF37' }} />
                Maximum Revenue
              </Label>
              <Input
                id="max-revenue"
                type="text"
                placeholder="e.g. $100M"
                value={profile.maxRevenue || ''}
                onChange={(e) =>
                  setProfile((p) => ({ ...p, maxRevenue: e.target.value }))
                }
                className="h-9"
              />
            </div>
            {/* Min Employees */}
            <div className="space-y-2">
              <Label
                htmlFor="min-employees"
                className="text-xs font-medium text-muted-foreground flex items-center gap-1.5"
              >
                <Users className="w-3.5 h-3.5" style={{ color: '#D4AF37' }} />
                Minimum Employees
              </Label>
              <Input
                id="min-employees"
                type="number"
                placeholder="e.g. 100"
                value={profile.minEmployeeCount ?? ''}
                onChange={(e) =>
                  setProfile((p) => ({
                    ...p,
                    minEmployeeCount: e.target.value ? Number(e.target.value) : undefined,
                  }))
                }
                className="h-9"
              />
            </div>
            {/* Max Employees */}
            <div className="space-y-2">
              <Label
                htmlFor="max-employees"
                className="text-xs font-medium text-muted-foreground flex items-center gap-1.5"
              >
                <Users className="w-3.5 h-3.5" style={{ color: '#D4AF37' }} />
                Maximum Employees
              </Label>
              <Input
                id="max-employees"
                type="number"
                placeholder="e.g. 10000"
                value={profile.maxEmployeeCount ?? ''}
                onChange={(e) =>
                  setProfile((p) => ({
                    ...p,
                    maxEmployeeCount: e.target.value ? Number(e.target.value) : undefined,
                  }))
                }
                className="h-9"
              />
            </div>
          </div>
        </GlassPanel>
      </motion.div>

      <Separator />

      {/* ── Footer Actions ── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2"
      >
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5" />
          Changes will affect account prioritization scores across the platform.
        </p>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={handleReset}
            disabled={saving || resetting}
            className="gap-2 text-sm"
          >
            {resetting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RotateCcw className="w-4 h-4" />
            )}
            Reset to Defaults
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="gap-2 text-sm font-medium text-white shadow-lg transition-all hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]"
            style={{
              background: 'linear-gradient(135deg, #E8C860, #D4AF37, #B8962E)',
            }}
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Save Configuration
          </Button>
        </div>
      </motion.div>
    </PageTransition>
  );
}