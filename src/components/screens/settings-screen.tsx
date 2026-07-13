'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  Settings,
} from 'lucide-react';

// ── Timezone list ──────────────────────────────────────────────
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

// ── Default scoring rules ──────────────────────────────────────
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

export default function SettingsScreen({ navigateTo }: { navigateTo?: (screen: string) => void }) {
  // ── Toast state ─────────────────────────────────────────────
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  // ── Tab 1: Mailbox ──────────────────────────────────────────
  const [outlookEmail, setOutlookEmail] = useState('');
  const [graphConnected, setGraphConnected] = useState(false);
  const [dailyLimit, setDailyLimit] = useState(50);
  const [hourlyLimit, setHourlyLimit] = useState(10);

  // ── Tab 2: Working Hours ────────────────────────────────────
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('18:00');
  const [timezone, setTimezone] = useState(getUserTimezone());
  const [workDays, setWorkDays] = useState<boolean[]>([true, true, true, true, true, false, false]);
  const [enforceWorkingHours, setEnforceWorkingHours] = useState(true);
  const [pauseOutsideHours, setPauseOutsideHours] = useState(true);

  // ── Tab 3: Email Verification ───────────────────────────────
  const [autoVerify, setAutoVerify] = useState(true);
  const [blockDisposable, setBlockDisposable] = useState(true);
  const [blockRoleBased, setBlockRoleBased] = useState(false);
  const [flagFreeProviders, setFlagFreeProviders] = useState(true);
  const [requireMx, setRequireMx] = useState(true);
  const [minHealthScore, setMinHealthScore] = useState(0);

  // ── Tab 4: Lead Scoring ─────────────────────────────────────
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

  // ── Tab 5: Suppression ──────────────────────────────────────
  const [suppressBounce, setSuppressBounce] = useState(true);
  const [suppressUnsubscribe, setSuppressUnsubscribe] = useState(true);
  const [suppressNegative, setSuppressNegative] = useState(false);
  const [requireApproval, setRequireApproval] = useState(true);

  // ── Toggle day helper ───────────────────────────────────────
  const toggleDay = (idx: number) => {
    setWorkDays((prev) => prev.map((d, i) => (i === idx ? !d : d)));
  };

  return (
    <div className="max-h-[calc(100vh-200px)] overflow-y-auto space-y-6 pr-1">
      {/* ── Toast notification ─────────────────────────────────── */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-300 shadow-lg backdrop-blur-sm">
            <CheckCircle2 className="size-4" />
            {toastMessage}
          </div>
        </div>
      )}

      {/* ── Page header ───────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 border border-primary/20">
          <Settings className="size-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-foreground">Settings</h1>
          <p className="text-sm text-muted-foreground">
            Configure your DeepMindQ workspace preferences
          </p>
        </div>
      </div>

      <Separator />

      {/* ── Tabs ───────────────────────────────────────────────── */}
      <Tabs defaultValue="mailbox" className="w-full">
        <TabsList className="flex flex-wrap w-full h-auto gap-1 bg-card border border-border p-1">
          <TabsTrigger value="mailbox" className="gap-1.5 text-xs sm:text-sm">
            <Mail className="size-3.5 hidden sm:block" />
            Mailbox
          </TabsTrigger>
          <TabsTrigger value="hours" className="gap-1.5 text-xs sm:text-sm">
            <Clock className="size-3.5 hidden sm:block" />
            Working Hours
          </TabsTrigger>
          <TabsTrigger value="verification" className="gap-1.5 text-xs sm:text-sm">
            <ShieldCheck className="size-3.5 hidden sm:block" />
            Verification
          </TabsTrigger>
          <TabsTrigger value="scoring" className="gap-1.5 text-xs sm:text-sm">
            <Star className="size-3.5 hidden sm:block" />
            Lead Scoring
          </TabsTrigger>
          <TabsTrigger value="suppression" className="gap-1.5 text-xs sm:text-sm">
            <Ban className="size-3.5 hidden sm:block" />
            Suppression
          </TabsTrigger>
        </TabsList>

        {/* ═══════════════════════════════════════════════════════
            TAB 1 — Mailbox Configuration
           ═══════════════════════════════════════════════════════ */}
        <TabsContent value="mailbox" className="mt-4 space-y-4">
          <Card className="border-border bg-card">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <Mail className="size-4 text-primary" />
                Outlook Mailbox
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Email address */}
              <div className="space-y-2">
                <Label htmlFor="outlook-email" className="text-sm text-muted-foreground">
                  Outlook Email Address
                </Label>
                <Input
                  id="outlook-email"
                  type="email"
                  placeholder="you@company.com"
                  value={outlookEmail}
                  onChange={(e) => setOutlookEmail(e.target.value)}
                  className="bg-input/30 border-border max-w-md"
                />
              </div>

              {/* Connection status */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Microsoft Graph API:</span>
                  {graphConnected ? (
                    <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30">
                      <CheckCircle2 className="size-3 mr-1" />
                      Connected
                    </Badge>
                  ) : (
                    <Badge className="bg-red-500/15 text-red-300 border-red-500/30">
                      <XCircle className="size-3 mr-1" />
                      Not Connected
                    </Badge>
                  )}
                </div>
                {!graphConnected && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-primary/40 text-primary hover:bg-primary/10 w-fit"
                    onClick={() => {
                      setGraphConnected(true);
                      showToast('Microsoft Graph connected successfully');
                    }}
                  >
                    <Plug className="size-3.5 mr-1.5" />
                    Connect
                  </Button>
                )}
              </div>

              <Separator className="bg-border" />

              {/* Send limits */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 max-w-lg">
                <div className="space-y-2">
                  <Label htmlFor="daily-limit" className="text-sm text-muted-foreground">
                    Daily Send Limit
                  </Label>
                  <Input
                    id="daily-limit"
                    type="number"
                    min={1}
                    value={dailyLimit}
                    onChange={(e) => setDailyLimit(Number(e.target.value) || 0)}
                    className="bg-input/30 border-border"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="hourly-limit" className="text-sm text-muted-foreground">
                    Per-Hour Send Limit
                  </Label>
                  <Input
                    id="hourly-limit"
                    type="number"
                    min={1}
                    value={hourlyLimit}
                    onChange={(e) => setHourlyLimit(Number(e.target.value) || 0)}
                    className="bg-input/30 border-border"
                  />
                </div>
              </div>

              <Separator className="bg-border" />

              {/* Action buttons */}
              <div className="flex gap-3 pt-1">
                <Button
                  variant="outline"
                  className="border-border hover:bg-accent"
                  onClick={() => showToast('Connection test initiated')}
                >
                  Test Connection
                </Button>
                <Button
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                  onClick={() => showToast('Mailbox settings saved')}
                >
                  <Save className="size-3.5 mr-1.5" />
                  Save Settings
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════
            TAB 2 — Working Hours
           ═══════════════════════════════════════════════════════ */}
        <TabsContent value="hours" className="mt-4 space-y-4">
          <Card className="border-border bg-card">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock className="size-4 text-primary" />
                Working Hours Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Time selects */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 max-w-2xl">
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">Start Time</Label>
                  <Select value={startTime} onValueChange={setStartTime}>
                    <SelectTrigger className="w-full bg-input/30 border-border">
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
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">End Time</Label>
                  <Select value={endTime} onValueChange={setEndTime}>
                    <SelectTrigger className="w-full bg-input/30 border-border">
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
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">Timezone</Label>
                  <Select value={timezone} onValueChange={setTimezone}>
                    <SelectTrigger className="w-full bg-input/30 border-border">
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

              <Separator className="bg-border" />

              {/* Days of week */}
              <div className="space-y-3">
                <Label className="text-sm text-muted-foreground">Working Days</Label>
                <div className="flex flex-wrap gap-3">
                  {DAYS_OF_WEEK.map((day, idx) => (
                    <label
                      key={day}
                      className="flex items-center gap-2 cursor-pointer select-none"
                    >
                      <Checkbox
                        checked={workDays[idx]}
                        onCheckedChange={() => toggleDay(idx)}
                      />
                      <span className="text-sm text-foreground">{day}</span>
                    </label>
                  ))}
                </div>
              </div>

              <Separator className="bg-border" />

              {/* Toggles */}
              <div className="space-y-4">
                <div className="flex items-center justify-between max-w-md">
                  <Label className="text-sm text-foreground">Enforce working hours for sends</Label>
                  <Switch
                    checked={enforceWorkingHours}
                    onCheckedChange={setEnforceWorkingHours}
                  />
                </div>
                <div className="flex items-center justify-between max-w-md">
                  <Label className="text-sm text-foreground">Pause sends outside working hours</Label>
                  <Switch checked={pauseOutsideHours} onCheckedChange={setPauseOutsideHours} />
                </div>
              </div>

              <Separator className="bg-border" />

              <div className="pt-1">
                <Button
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                  onClick={() => showToast('Working hours saved')}
                >
                  <Save className="size-3.5 mr-1.5" />
                  Save Settings
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════
            TAB 3 — Email Verification
           ═══════════════════════════════════════════════════════ */}
        <TabsContent value="verification" className="mt-4 space-y-4">
          <Card className="border-border bg-card">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldCheck className="size-4 text-primary" />
                Email Verification Rules
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-4">
                {/* Auto-verify */}
                <div className="flex items-center justify-between max-w-lg">
                  <div className="space-y-0.5">
                    <Label className="text-sm text-foreground">Auto-verify emails on import</Label>
                    <p className="text-xs text-muted-foreground">
                      Automatically run verification checks when leads are imported
                    </p>
                  </div>
                  <Switch checked={autoVerify} onCheckedChange={setAutoVerify} />
                </div>

                <Separator className="bg-border" />

                {/* Block disposable */}
                <div className="flex items-center justify-between max-w-lg">
                  <div className="space-y-0.5">
                    <Label className="text-sm text-foreground">Block disposable domains</Label>
                    <p className="text-xs text-muted-foreground">
                      Reject emails from temporary/disposable email providers
                    </p>
                  </div>
                  <Switch checked={blockDisposable} onCheckedChange={setBlockDisposable} />
                </div>

                <Separator className="bg-border" />

                {/* Block role-based */}
                <div className="flex items-center justify-between max-w-lg">
                  <div className="space-y-0.5">
                    <Label className="text-sm text-foreground">
                      Block role-based emails (info@, sales@, etc.)
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Filter out generic role-based email addresses
                    </p>
                  </div>
                  <Switch checked={blockRoleBased} onCheckedChange={setBlockRoleBased} />
                </div>

                <Separator className="bg-border" />

                {/* Flag free providers */}
                <div className="flex items-center justify-between max-w-lg">
                  <div className="space-y-0.5">
                    <Label className="text-sm text-foreground">Flag free providers as risky</Label>
                    <p className="text-xs text-muted-foreground">
                      Mark Gmail, Yahoo, Outlook.com, etc. as lower quality leads
                    </p>
                  </div>
                  <Switch checked={flagFreeProviders} onCheckedChange={setFlagFreeProviders} />
                </div>

                <Separator className="bg-border" />

                {/* Require MX */}
                <div className="flex items-center justify-between max-w-lg">
                  <div className="space-y-0.5">
                    <Label className="text-sm text-foreground">Require MX record validation</Label>
                    <p className="text-xs text-muted-foreground">
                      Verify the domain has valid MX records before accepting
                    </p>
                  </div>
                  <Switch checked={requireMx} onCheckedChange={setRequireMx} />
                </div>
              </div>

              <Separator className="bg-border" />

              {/* Minimum health score */}
              <div className="max-w-xs space-y-2">
                <Label htmlFor="health-score" className="text-sm text-muted-foreground">
                  Minimum Email Health Score
                </Label>
                <Input
                  id="health-score"
                  type="number"
                  min={0}
                  max={100}
                  value={minHealthScore}
                  onChange={(e) => setMinHealthScore(Number(e.target.value) || 0)}
                  className="bg-input/30 border-border"
                />
                <p className="text-xs text-muted-foreground">
                  Emails scoring below this threshold will be flagged (0–100)
                </p>
              </div>

              <Separator className="bg-border" />

              <div className="pt-1">
                <Button
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                  onClick={() => showToast('Verification settings saved')}
                >
                  <Save className="size-3.5 mr-1.5" />
                  Save Settings
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════
            TAB 4 — Lead Scoring
           ═══════════════════════════════════════════════════════ */}
        <TabsContent value="scoring" className="mt-4 space-y-4">
          <Card className="border-border bg-card">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <Star className="size-4 text-primary" />
                Lead Scoring Rules
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Adjust point values for each scoring criterion. Leads are ranked by total score.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {scoringRules.map((rule, idx) => (
                <div key={rule.id}>
                  <div className="flex items-center justify-between gap-4 max-w-lg">
                    <Label className="text-sm text-foreground flex-1">{rule.label}</Label>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-muted-foreground">+</span>
                      <Input
                        type="number"
                        min={0}
                        value={rule.points}
                        onChange={(e) =>
                          updateRulePoints(rule.id, Number(e.target.value) || 0)
                        }
                        className="bg-input/30 border-border w-20 text-right"
                      />
                      <span className="text-xs text-muted-foreground w-6">pts</span>
                    </div>
                  </div>
                  {idx < scoringRules.length - 1 && (
                    <Separator className="bg-border/50 mt-3" />
                  )}
                </div>
              ))}

              <Separator className="bg-border" />

              {/* Total score display */}
              <div className="flex items-center gap-2 max-w-lg">
                <span className="text-sm text-muted-foreground">Maximum possible score:</span>
                <Badge className="bg-primary/15 text-primary border-primary/30 font-medium">
                  {scoringRules.reduce((sum, r) => sum + r.points, 0)} pts
                </Badge>
              </div>

              <Separator className="bg-border" />

              {/* Action buttons */}
              <div className="flex flex-wrap gap-3 pt-1">
                <Button
                  variant="outline"
                  className="border-border hover:bg-accent"
                  onClick={resetScoringRules}
                >
                  <RotateCcw className="size-3.5 mr-1.5" />
                  Reset to Defaults
                </Button>
                <Button
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                  onClick={saveScoringRules}
                >
                  <Save className="size-3.5 mr-1.5" />
                  Save Rules
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════
            TAB 5 — Suppression Rules
           ═══════════════════════════════════════════════════════ */}
        <TabsContent value="suppression" className="mt-4 space-y-4">
          <Card className="border-border bg-card">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <Ban className="size-4 text-primary" />
                Suppression Rules
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Control when contacts are automatically suppressed from future campaigns.
              </p>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Auto-suppress on hard bounce */}
              <div className="flex items-center justify-between max-w-lg">
                <div className="space-y-0.5">
                  <Label className="text-sm text-foreground">Auto-suppress on hard bounce</Label>
                  <p className="text-xs text-muted-foreground">
                    Permanently remove emails that return a hard bounce (5xx errors)
                  </p>
                </div>
                <Switch checked={suppressBounce} onCheckedChange={setSuppressBounce} />
              </div>

              <Separator className="bg-border" />

              {/* Auto-suppress on unsubscribe reply */}
              <div className="flex items-center justify-between max-w-lg">
                <div className="space-y-0.5">
                  <Label className="text-sm text-foreground">
                    Auto-suppress on unsubscribe reply
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Suppress contacts who reply asking to unsubscribe
                  </p>
                </div>
                <Switch
                  checked={suppressUnsubscribe}
                  onCheckedChange={setSuppressUnsubscribe}
                />
              </div>

              <Separator className="bg-border" />

              {/* Auto-suppress on negative reply */}
              <div className="flex items-center justify-between max-w-lg">
                <div className="space-y-0.5">
                  <Label className="text-sm text-foreground">
                    Auto-suppress on negative reply
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Suppress contacts who reply with negative sentiment or complaints
                  </p>
                </div>
                <Switch checked={suppressNegative} onCheckedChange={setSuppressNegative} />
              </div>

              <Separator className="bg-border" />

              {/* Require approval for removal */}
              <div className="flex items-center justify-between max-w-lg">
                <div className="space-y-0.5">
                  <Label className="text-sm text-foreground">
                    Suppression removal requires approval
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Team leads must approve before a suppressed contact can be re-activated
                  </p>
                </div>
                <Switch checked={requireApproval} onCheckedChange={setRequireApproval} />
              </div>

              <Separator className="bg-border" />

              <div className="pt-1">
                <Button
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                  onClick={() => showToast('Suppression rules saved')}
                >
                  <Save className="size-3.5 mr-1.5" />
                  Save Settings
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}