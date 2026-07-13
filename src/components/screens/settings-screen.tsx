'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PageTransition,
  GlassPanel,
  GradientCard,
  StaggerGrid,
  StaggerItem,
  SectionHeader,
  TabBar,
  ShimmerText,
  PulseDot,
  AnimatedCard,
} from '@/components/ui/animated-components';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import {
  Mail,
  Clock,
  ShieldCheck,
  Star,
  Ban,
  Plug,
  Save,
  RotateCcw,
  CheckCircle2,
  XCircle,
} from 'lucide-react';

// ── Shared gold-focus input className ───────────────────────
const INPUT_CLS =
  'bg-input/30 border-border focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37]/30 transition-all duration-300';

// ── Timezone list ──────────────────────────────────────────
const TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Anchorage',
  'Pacific/Honolulu',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Asia/Singapore',
  'Asia/Kolkata',
  'Australia/Sydney',
  'UTC',
];

const HOURS = Array.from({ length: 24 }, (_, i) => {
  const h = i % 12 || 12;
  const suffix = i < 12 ? 'AM' : 'PM';
  return { value: String(i).padStart(2, '0') + ':00', label: `${h}:00 ${suffix}` };
});

const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

// ── Default scoring rules ──────────────────────────────────
interface ScoringRule {
  id: string;
  label: string;
  points: number;
}

const DEFAULT_SCORING_RULES: ScoringRule[] = [
  { id: 'corporate-domain', label: 'Corporate email domain', points: 15 },
  { id: 'email-verified', label: 'Email verified valid', points: 25 },
  { id: 'executive-role', label: 'Executive role (CTO, CIO, VP)', points: 20 },
  { id: 'director-role', label: 'Director role', points: 15 },
  { id: 'manager-role', label: 'Manager role', points: 10 },
  { id: 'target-industry', label: 'Company in target industry', points: 10 },
  { id: 'company-size', label: 'Company size 1000+', points: 10 },
];

function getUserTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return 'UTC';
  }
}

// ── Toggle row inside a GradientCard ──────────────────────
function ToggleRow({
  icon: Icon,
  title,
  description,
  checked,
  onChange,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <GradientCard>
      <div className="flex items-center justify-between gap-4 py-1">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          {Icon && (
            <div
              className="mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: 'rgba(212, 175, 55, 0.08)' }}
            >
              <Icon className="size-4 text-[#D4AF37]" />
            </div>
          )}
          <div className="space-y-0.5 min-w-0">
            <Label className="text-sm font-medium text-foreground leading-tight">{title}</Label>
            <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
          </div>
        </div>
        <Switch checked={checked} onCheckedChange={onChange} className="shrink-0" />
      </div>
    </GradientCard>
  );
}

export default function SettingsScreen({ navigateTo }: { navigateTo?: (screen: string) => void }) {
  // ── Active tab ───────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('mailbox');

  // ── Toast state ──────────────────────────────────────────
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  // ── Tab 1: Mailbox ──────────────────────────────────────
  const [outlookEmail, setOutlookEmail] = useState('');
  const [graphConnected, setGraphConnected] = useState(false);
  const [dailyLimit, setDailyLimit] = useState(50);
  const [hourlyLimit, setHourlyLimit] = useState(10);

  // ── Tab 2: Working Hours ─────────────────────────────────
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('18:00');
  const [timezone, setTimezone] = useState(getUserTimezone());
  const [workDays, setWorkDays] = useState<boolean[]>([true, true, true, true, true, false, false]);
  const [enforceWorkingHours, setEnforceWorkingHours] = useState(true);
  const [pauseOutsideHours, setPauseOutsideHours] = useState(true);

  // ── Tab 3: Email Verification ────────────────────────────
  const [autoVerify, setAutoVerify] = useState(true);
  const [blockDisposable, setBlockDisposable] = useState(true);
  const [blockRoleBased, setBlockRoleBased] = useState(false);
  const [flagFreeProviders, setFlagFreeProviders] = useState(true);
  const [requireMx, setRequireMx] = useState(true);
  const [minHealthScore, setMinHealthScore] = useState(0);

  // ── Tab 4: Lead Scoring ──────────────────────────────────
  const [scoringRules, setScoringRules] = useState<ScoringRule[]>(DEFAULT_SCORING_RULES);

  const updateRulePoints = (id: string, points: number) => {
    setScoringRules((prev) =>
      prev.map((r) => (r.id === id ? { ...r, points: Math.max(0, points) } : r)),
    );
  };

  const resetScoringRules = () => {
    setScoringRules(DEFAULT_SCORING_RULES);
    showToast('Scoring rules reset to defaults');
  };

  const saveScoringRules = () => {
    showToast('Scoring rules saved');
  };

  // ── Tab 5: Suppression ──────────────────────────────────
  const [suppressBounce, setSuppressBounce] = useState(true);
  const [suppressUnsubscribe, setSuppressUnsubscribe] = useState(true);
  const [suppressNegative, setSuppressNegative] = useState(false);
  const [requireApproval, setRequireApproval] = useState(true);

  // ── Toggle day helper ────────────────────────────────────
  const toggleDay = (idx: number) => {
    setWorkDays((prev) => prev.map((d, i) => (i === idx ? !d : d)));
  };

  // ── Tab items ────────────────────────────────────────────
  const SETTINGS_TABS = [
    { key: 'mailbox', label: 'Mailbox' },
    { key: 'hours', label: 'Working Hours' },
    { key: 'verification', label: 'Verification' },
    { key: 'scoring', label: 'Lead Scoring' },
    { key: 'suppression', label: 'Suppression' },
  ];

  // ── Tab icon map ─────────────────────────────────────────
  const TAB_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
    mailbox: Mail,
    hours: Clock,
    verification: ShieldCheck,
    scoring: Star,
    suppression: Ban,
  };

  return (
    <PageTransition>
      <div className="max-h-[calc(100vh-200px)] overflow-y-auto space-y-8 pr-1 pb-8">
        {/* ── Toast notification ─────────────────────────────── */}
        <AnimatePresence>
          {toastMessage && (
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="fixed top-6 right-6 z-50"
            >
              <div
                className="flex items-center gap-2.5 rounded-xl border border-emerald-500/30 px-5 py-3 text-sm text-emerald-300 backdrop-blur-xl"
                style={{
                  background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12), rgba(16, 185, 129, 0.04))',
                  boxShadow: '0 4px 30px rgba(0, 0, 0, 0.3), 0 0 20px rgba(16, 185, 129, 0.08)',
                }}
              >
                <CheckCircle2 className="size-4" />
                <span className="font-medium">{toastMessage}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Page header (dramatic) ─────────────────────────── */}
        <div className="space-y-2">
          <SectionHeader
            title="Settings"
            subtitle="Configure your DeepMindQ workspace preferences"
            className="mb-2"
          />
          <div className="flex items-center gap-2 ml-5">
            <PulseDot />
            <span className="text-xs text-muted-foreground">System active - 5 modules configured</span>
          </div>
        </div>

        {/* ── Tab bar (using enhanced TabBar) ────────────────── */}
        <div className="flex items-center gap-3">
          <TabBar tabs={SETTINGS_TABS} active={activeTab} onChange={setActiveTab} />
          {TAB_ICONS[activeTab] && (
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
              className="hidden sm:flex w-9 h-9 rounded-lg items-center justify-center shrink-0"
              style={{
                background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.15), rgba(212, 175, 55, 0.05))',
                border: '1px solid rgba(212, 175, 55, 0.2)',
              }}
            >
              {(() => {
                const Icon = TAB_ICONS[activeTab];
                return <Icon className="size-4 text-[#D4AF37]" />;
              })()}
            </motion.div>
          )}
        </div>

        {/* ── Tabs content ───────────────────────────────────── */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">

        {/* ═══════════════════════════════════════════════════════
            TAB 1 - Mailbox Configuration
           ═══════════════════════════════════════════════════════ */}
        <TabsContent value="mailbox" className="mt-6 space-y-6">
          <StaggerGrid stagger={0.1} className="space-y-6">
            <StaggerItem>
              <GlassPanel className="p-0 overflow-hidden">
                {/* Header stripe */}
                <div
                  className="px-6 py-4 flex items-center gap-3"
                  style={{
                    background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.06), transparent)',
                    borderBottom: '1px solid rgba(212, 175, 55, 0.1)',
                  }}
                >
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center"
                    style={{ background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.2), rgba(212, 175, 55, 0.06))' }}
                  >
                    <Mail className="size-4.5" style={{ color: '#D4AF37' }} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-foreground tracking-tight">
                      <ShimmerText>Outlook Mailbox</ShimmerText>
                    </h3>
                    <p className="text-xs text-muted-foreground">Connect and configure your sending mailbox</p>
                  </div>
                </div>

                <div className="p-6 space-y-6">
                  {/* Email address */}
                  <div className="space-y-2.5">
                    <Label htmlFor="outlook-email" className="text-sm font-medium text-muted-foreground">
                      Outlook Email Address
                    </Label>
                    <Input
                      id="outlook-email"
                      type="email"
                      placeholder="you@company.com"
                      value={outlookEmail}
                      onChange={(e) => setOutlookEmail(e.target.value)}
                      className={`${INPUT_CLS} max-w-md`}
                    />
                  </div>

                  {/* Connection status */}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="flex items-center gap-2.5">
                      <span className="text-sm text-muted-foreground">Microsoft Graph API:</span>
                      {graphConnected ? (
                        <Badge
                          className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30 font-medium"
                        >
                          <CheckCircle2 className="size-3 mr-1.5" />
                          Connected
                        </Badge>
                      ) : (
                        <Badge className="bg-red-500/15 text-red-300 border-red-500/30 font-medium">
                          <XCircle className="size-3 mr-1.5" />
                          Not Connected
                        </Badge>
                      )}
                    </div>
                    {!graphConnected && (
                      <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-[#D4AF37]/40 text-[#D4AF37] hover:bg-[#D4AF37]/10 w-fit transition-all duration-300"
                          onClick={() => {
                            setGraphConnected(true);
                            showToast('Microsoft Graph connected successfully');
                          }}
                        >
                          <Plug className="size-3.5 mr-1.5" />
                          Connect
                        </Button>
                      </motion.div>
                    )}
                  </div>

                  <Separator className="bg-border/60" />

                  {/* Send limits */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-lg">
                    <div className="space-y-2.5">
                      <Label htmlFor="daily-limit" className="text-sm font-medium text-muted-foreground">
                        Daily Send Limit
                      </Label>
                      <Input
                        id="daily-limit"
                        type="number"
                        min={1}
                        value={dailyLimit}
                        onChange={(e) => setDailyLimit(Number(e.target.value) || 0)}
                        className={INPUT_CLS}
                      />
                    </div>
                    <div className="space-y-2.5">
                      <Label htmlFor="hourly-limit" className="text-sm font-medium text-muted-foreground">
                        Per-Hour Send Limit
                      </Label>
                      <Input
                        id="hourly-limit"
                        type="number"
                        min={1}
                        value={hourlyLimit}
                        onChange={(e) => setHourlyLimit(Number(e.target.value) || 0)}
                        className={INPUT_CLS}
                      />
                    </div>
                  </div>

                  <Separator className="bg-border/60" />

                  {/* Action buttons */}
                  <div className="flex gap-3 pt-1">
                    <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                      <Button
                        variant="outline"
                        className="border-border hover:bg-accent transition-all duration-200"
                        onClick={() => showToast('Connection test initiated')}
                      >
                        Test Connection
                      </Button>
                    </motion.div>
                    <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                      <Button
                        className="text-primary-foreground hover:opacity-90 transition-all duration-200"
                        style={{
                          background: 'linear-gradient(135deg, #D4AF37, #B8941F)',
                          boxShadow: '0 0 20px rgba(212, 175, 55, 0.15)',
                        }}
                        onClick={() => showToast('Mailbox settings saved')}
                      >
                        <Save className="size-3.5 mr-1.5" />
                        Save Settings
                      </Button>
                    </motion.div>
                  </div>
                </div>
              </GlassPanel>
            </StaggerItem>
          </StaggerGrid>
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════
            TAB 2 - Working Hours
           ═══════════════════════════════════════════════════════ */}
        <TabsContent value="hours" className="mt-6 space-y-6">
          <StaggerGrid stagger={0.1} className="space-y-6">
            {/* Time and timezone section */}
            <StaggerItem>
              <GlassPanel className="p-0 overflow-hidden">
                <div
                  className="px-6 py-4 flex items-center gap-3"
                  style={{
                    background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.06), transparent)',
                    borderBottom: '1px solid rgba(59, 130, 246, 0.1)',
                  }}
                >
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center"
                    style={{ background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(59, 130, 246, 0.06))' }}
                  >
                    <Clock className="size-4.5 text-blue-400" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-foreground tracking-tight">
                      <ShimmerText>Schedule Configuration</ShimmerText>
                    </h3>
                    <p className="text-xs text-muted-foreground">Define when your campaigns are allowed to send</p>
                  </div>
                </div>

                <div className="p-6 space-y-6">
                  {/* Time selects */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-2xl">
                    <div className="space-y-2.5">
                      <Label className="text-sm font-medium text-muted-foreground">Start Time</Label>
                      <Select value={startTime} onValueChange={setStartTime}>
                        <SelectTrigger className={`w-full ${INPUT_CLS}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-popover border-border">
                          {HOURS.filter((h) => {
                            const endNum = parseInt(endTime, 10);
                            const startNum = parseInt(h.value, 10);
                            return startNum < endNum;
                          }).map((h) => (
                            <SelectItem key={h.value} value={h.value}>
                              {h.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2.5">
                      <Label className="text-sm font-medium text-muted-foreground">End Time</Label>
                      <Select value={endTime} onValueChange={setEndTime}>
                        <SelectTrigger className={`w-full ${INPUT_CLS}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-popover border-border">
                          {HOURS.filter((h) => {
                            const startNum = parseInt(startTime, 10);
                            const endNum = parseInt(h.value, 10);
                            return endNum > startNum;
                          }).map((h) => (
                            <SelectItem key={h.value} value={h.value}>
                              {h.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2.5">
                      <Label className="text-sm font-medium text-muted-foreground">Timezone</Label>
                      <Select value={timezone} onValueChange={setTimezone}>
                        <SelectTrigger className={`w-full ${INPUT_CLS}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-popover border-border">
                          {TIMEZONES.map((tz) => (
                            <SelectItem key={tz} value={tz}>
                              {tz}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <Separator className="bg-border/60" />

                  {/* Days of week */}
                  <div className="space-y-3">
                    <Label className="text-sm font-medium text-muted-foreground">Working Days</Label>
                    <div className="flex flex-wrap gap-3">
                      {DAYS_OF_WEEK.map((day, idx) => (
                        <motion.label
                          key={day}
                          className="flex items-center gap-2 cursor-pointer select-none"
                          whileHover={{ scale: 1.04 }}
                          whileTap={{ scale: 0.97 }}
                        >
                          <Checkbox
                            checked={workDays[idx]}
                            onCheckedChange={() => toggleDay(idx)}
                          />
                          <span className="text-sm text-foreground font-medium">{day}</span>
                        </motion.label>
                      ))}
                    </div>
                  </div>
                </div>
              </GlassPanel>
            </StaggerItem>

            {/* Toggle section with gradient borders */}
            <StaggerItem>
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-foreground flex items-center gap-2 px-1">
                  <div
                    className="w-1 h-4 rounded-full"
                    style={{ background: 'linear-gradient(180deg, #D4AF37, #9A8340)' }}
                  />
                  Enforcement Rules
                </h4>
                <div className="space-y-3">
                  <ToggleRow
                    title="Enforce working hours for sends"
                    description="Campaigns will only deliver emails during your configured working window"
                    checked={enforceWorkingHours}
                    onChange={setEnforceWorkingHours}
                  />
                  <ToggleRow
                    title="Pause sends outside working hours"
                    description="Automatically queue and pause outgoing emails outside of working hours"
                    checked={pauseOutsideHours}
                    onChange={setPauseOutsideHours}
                  />
                </div>
              </div>
            </StaggerItem>

            {/* Save button */}
            <StaggerItem>
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="pt-1">
                <Button
                  className="text-primary-foreground hover:opacity-90 transition-all duration-200"
                  style={{
                    background: 'linear-gradient(135deg, #D4AF37, #B8941F)',
                    boxShadow: '0 0 20px rgba(212, 175, 55, 0.15)',
                  }}
                  onClick={() => showToast('Working hours saved')}
                >
                  <Save className="size-3.5 mr-1.5" />
                  Save Settings
                </Button>
              </motion.div>
            </StaggerItem>
          </StaggerGrid>
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════
            TAB 3 - Email Verification
           ═══════════════════════════════════════════════════════ */}
        <TabsContent value="verification" className="mt-6 space-y-6">
          <StaggerGrid stagger={0.08} className="space-y-6">
            {/* Verification toggles */}
            <StaggerItem>
              <GlassPanel className="p-0 overflow-hidden">
                <div
                  className="px-6 py-4 flex items-center gap-3"
                  style={{
                    background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.06), transparent)',
                    borderBottom: '1px solid rgba(16, 185, 129, 0.1)',
                  }}
                >
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center"
                    style={{ background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(16, 185, 129, 0.06))' }}
                  >
                    <ShieldCheck className="size-4.5 text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-foreground tracking-tight">
                      <ShimmerText>Email Verification Rules</ShimmerText>
                    </h3>
                    <p className="text-xs text-muted-foreground">Quality filters and automated verification checks</p>
                  </div>
                </div>

                <div className="p-6 space-y-4">
                  <ToggleRow
                    icon={ShieldCheck}
                    title="Auto-verify emails on import"
                    description="Automatically run verification checks when leads are imported"
                    checked={autoVerify}
                    onChange={setAutoVerify}
                  />
                  <ToggleRow
                    icon={Ban}
                    title="Block disposable domains"
                    description="Reject emails from temporary/disposable email providers"
                    checked={blockDisposable}
                    onChange={setBlockDisposable}
                  />
                  <ToggleRow
                    icon={Ban}
                    title="Block role-based emails (info@, sales@, etc.)"
                    description="Filter out generic role-based email addresses"
                    checked={blockRoleBased}
                    onChange={setBlockRoleBased}
                  />
                  <ToggleRow
                    icon={Star}
                    title="Flag free providers as risky"
                    description="Mark Gmail, Yahoo, Outlook.com, etc. as lower quality leads"
                    checked={flagFreeProviders}
                    onChange={setFlagFreeProviders}
                  />
                  <ToggleRow
                    icon={ShieldCheck}
                    title="Require MX record validation"
                    description="Verify the domain has valid MX records before accepting"
                    checked={requireMx}
                    onChange={setRequireMx}
                  />
                </div>
              </GlassPanel>
            </StaggerItem>

            {/* Health score input */}
            <StaggerItem>
              <GlassPanel className="p-6 space-y-4">
                <div className="flex items-center gap-2.5 mb-1">
                  <div
                    className="w-1 h-5 rounded-full"
                    style={{ background: 'linear-gradient(180deg, #D4AF37, #9A8340)' }}
                  />
                  <h4 className="text-sm font-semibold text-foreground">Email Health Threshold</h4>
                </div>
                <p className="text-xs text-muted-foreground ml-4">
                  Emails scoring below this threshold will be flagged for review (0-100)
                </p>
                <div className="max-w-xs space-y-2.5 pt-1">
                  <Label htmlFor="health-score" className="text-sm font-medium text-muted-foreground">
                    Minimum Email Health Score
                  </Label>
                  <Input
                    id="health-score"
                    type="number"
                    min={0}
                    max={100}
                    value={minHealthScore}
                    onChange={(e) => setMinHealthScore(Number(e.target.value) || 0)}
                    className={INPUT_CLS}
                  />
                </div>

                <div className="pt-3">
                  <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                    <Button
                      className="text-primary-foreground hover:opacity-90 transition-all duration-200"
                      style={{
                        background: 'linear-gradient(135deg, #D4AF37, #B8941F)',
                        boxShadow: '0 0 20px rgba(212, 175, 55, 0.15)',
                      }}
                      onClick={() => showToast('Verification settings saved')}
                    >
                      <Save className="size-3.5 mr-1.5" />
                      Save Settings
                    </Button>
                  </motion.div>
                </div>
              </GlassPanel>
            </StaggerItem>
          </StaggerGrid>
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════
            TAB 4 - Lead Scoring
           ═══════════════════════════════════════════════════════ */}
        <TabsContent value="scoring" className="mt-6 space-y-6">
          <StaggerGrid stagger={0.08} className="space-y-6">
            <StaggerItem>
              <GlassPanel className="p-0 overflow-hidden">
                <div
                  className="px-6 py-4 flex items-center gap-3"
                  style={{
                    background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.06), transparent)',
                    borderBottom: '1px solid rgba(212, 175, 55, 0.1)',
                  }}
                >
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center"
                    style={{ background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.2), rgba(212, 175, 55, 0.06))' }}
                  >
                    <Star className="size-4.5" style={{ color: '#D4AF37' }} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-foreground tracking-tight">
                      <ShimmerText>Lead Scoring Rules</ShimmerText>
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Adjust point values for each scoring criterion. Leads are ranked by total score.
                    </p>
                  </div>
                </div>

                <div className="p-6 space-y-1">
                  {scoringRules.map((rule, idx) => (
                    <div key={rule.id}>
                      <div className="flex items-center justify-between gap-4 max-w-lg py-3">
                        <Label className="text-sm text-foreground flex-1 font-medium">{rule.label}</Label>
                        <div className="flex items-center gap-2">
                          <span
                            className="text-xs font-semibold"
                            style={{ color: '#D4AF37' }}
                          >
                            +
                          </span>
                          <Input
                            type="number"
                            min={0}
                            value={rule.points}
                            onChange={(e) =>
                              updateRulePoints(rule.id, Number(e.target.value) || 0)
                            }
                            className={`${INPUT_CLS} w-20 text-right font-semibold`}
                          />
                          <span className="text-xs text-muted-foreground w-7">pts</span>
                        </div>
                      </div>
                      {idx < scoringRules.length - 1 && (
                        <Separator className="bg-border/40" />
                      )}
                    </div>
                  ))}
                </div>

                {/* Total score bar */}
                <div
                  className="mx-6 mb-6 rounded-lg px-5 py-4 flex items-center justify-between"
                  style={{
                    background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.06), rgba(212, 175, 55, 0.02))',
                    border: '1px solid rgba(212, 175, 55, 0.1)',
                  }}
                >
                  <span className="text-sm text-muted-foreground font-medium">Maximum possible score:</span>
                  <Badge
                    className="font-bold text-sm px-3 py-1"
                    style={{
                      background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.15), rgba(212, 175, 55, 0.05))',
                      color: '#D4AF37',
                      border: '1px solid rgba(212, 175, 55, 0.3)',
                    }}
                  >
                    {scoringRules.reduce((sum, r) => sum + r.points, 0)} pts
                  </Badge>
                </div>

                {/* Action buttons */}
                <div
                  className="px-6 pb-6 flex flex-wrap gap-3 pt-1"
                >
                  <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                    <Button
                      variant="outline"
                      className="border-border hover:bg-accent transition-all duration-200"
                      onClick={resetScoringRules}
                    >
                      <RotateCcw className="size-3.5 mr-1.5" />
                      Reset to Defaults
                    </Button>
                  </motion.div>
                  <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                    <Button
                      className="text-primary-foreground hover:opacity-90 transition-all duration-200"
                      style={{
                        background: 'linear-gradient(135deg, #D4AF37, #B8941F)',
                        boxShadow: '0 0 20px rgba(212, 175, 55, 0.15)',
                      }}
                      onClick={saveScoringRules}
                    >
                      <Save className="size-3.5 mr-1.5" />
                      Save Rules
                    </Button>
                  </motion.div>
                </div>
              </GlassPanel>
            </StaggerItem>
          </StaggerGrid>
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════
            TAB 5 - Suppression Rules
           ═══════════════════════════════════════════════════════ */}
        <TabsContent value="suppression" className="mt-6 space-y-6">
          <StaggerGrid stagger={0.08} className="space-y-6">
            <StaggerItem>
              <GlassPanel className="p-0 overflow-hidden">
                <div
                  className="px-6 py-4 flex items-center gap-3"
                  style={{
                    background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.06), transparent)',
                    borderBottom: '1px solid rgba(239, 68, 68, 0.1)',
                  }}
                >
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center"
                    style={{ background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.2), rgba(239, 68, 68, 0.06))' }}
                  >
                    <Ban className="size-4.5 text-red-400" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-foreground tracking-tight">
                      <ShimmerText>Suppression Rules</ShimmerText>
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Control when contacts are automatically suppressed from future campaigns.
                    </p>
                  </div>
                </div>

                <div className="p-6 space-y-4">
                  <ToggleRow
                    icon={Ban}
                    title="Auto-suppress on hard bounce"
                    description="Permanently remove emails that return a hard bounce (5xx errors)"
                    checked={suppressBounce}
                    onChange={setSuppressBounce}
                  />
                  <ToggleRow
                    icon={Ban}
                    title="Auto-suppress on unsubscribe reply"
                    description="Suppress contacts who reply asking to unsubscribe"
                    checked={suppressUnsubscribe}
                    onChange={setSuppressUnsubscribe}
                  />
                  <ToggleRow
                    icon={Ban}
                    title="Auto-suppress on negative reply"
                    description="Suppress contacts who reply with negative sentiment or complaints"
                    checked={suppressNegative}
                    onChange={setSuppressNegative}
                  />
                  <ToggleRow
                    icon={ShieldCheck}
                    title="Suppression removal requires approval"
                    description="Team leads must approve before a suppressed contact can be re-activated"
                    checked={requireApproval}
                    onChange={setRequireApproval}
                  />
                </div>

                <div className="px-6 pb-6 pt-1">
                  <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                    <Button
                      className="text-primary-foreground hover:opacity-90 transition-all duration-200"
                      style={{
                        background: 'linear-gradient(135deg, #D4AF37, #B8941F)',
                        boxShadow: '0 0 20px rgba(212, 175, 55, 0.15)',
                      }}
                      onClick={() => showToast('Suppression rules saved')}
                    >
                      <Save className="size-3.5 mr-1.5" />
                      Save Settings
                    </Button>
                  </motion.div>
                </div>
              </GlassPanel>
            </StaggerItem>
          </StaggerGrid>
        </TabsContent>
      </Tabs>
    </div>
    </PageTransition>
  );
}