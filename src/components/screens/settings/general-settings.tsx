'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  StaggerGrid, StaggerItem, GlassPanel, ShimmerText, GradientCard,
} from '@/components/ui/animated-components';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Mail, Clock, Plug, Save, CheckCircle2, XCircle,
} from 'lucide-react';
import { INPUT_CLS, TIMEZONES, HOURS, DAYS_OF_WEEK, getUserTimezone } from './settings-constants';

const goldAlpha = (a: number) => `rgba(212,175,55,${a})`;
const blueAlpha = (a: number) => `rgba(59,130,246,${a})`;

// ── Toggle row inside a GradientCard ──────────────────────
function ToggleRow({
  icon: Icon, title, description, checked, onChange,
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
            <div className="mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${goldAlpha(0.08)}` }}>
              <Icon className="size-4 text-[var(--color-gold-dim)]" />
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

// Need to import Switch after ToggleRow uses it
import { Switch } from '@/components/ui/switch';

export function MailboxTab({ showToast }: { showToast: (msg: string) => void }) {
  const [outlookEmail, setOutlookEmail] = useState('');
  const [graphConnected, setGraphConnected] = useState(false);
  const [dailyLimit, setDailyLimit] = useState(50);
  const [hourlyLimit, setHourlyLimit] = useState(10);

  return (
    <StaggerGrid stagger={0.1} className="space-y-6">
      <StaggerItem>
        <GlassPanel className="p-0 overflow-hidden">
          <div className="px-6 py-4 flex items-center gap-3" style={{ background: `linear-gradient(135deg, ${goldAlpha(0.06)}, transparent)`, borderBottom: `1px solid ${goldAlpha(0.1)}` }}>
            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${goldAlpha(0.2)}, ${goldAlpha(0.06)})` }}>
              <Mail className="size-4.5" style={{ color: 'var(--color-gold)' }} />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground tracking-tight"><ShimmerText>Outlook Mailbox</ShimmerText></h3>
              <p className="text-xs text-muted-foreground">Connect and configure your sending mailbox</p>
            </div>
          </div>
          <div className="p-6 space-y-6">
            <div className="space-y-2.5">
              <Label htmlFor="outlook-email" className="text-sm font-medium text-muted-foreground">Outlook Email Address</Label>
              <Input id="outlook-email" type="email" placeholder="you@company.com" value={outlookEmail} onChange={(e) => setOutlookEmail(e.target.value)} className={`${INPUT_CLS} max-w-md`} />
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex items-center gap-2.5">
                <span className="text-sm text-muted-foreground">Microsoft Graph API:</span>
                {graphConnected ? (
                  <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-500/30 font-medium"><CheckCircle2 className="size-3 mr-1.5" />Connected</Badge>
                ) : (
                  <Badge className="bg-red-500/15 text-red-600 border-red-500/30 font-medium"><XCircle className="size-3 mr-1.5" />Not Connected</Badge>
                )}
              </div>
              {!graphConnected && (
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Button size="sm" variant="outline" className="border-[var(--color-gold-dim)]/40 text-[var(--color-gold-dim)] hover:bg-[var(--color-gold-dim)]/10 w-fit transition-all duration-300" onClick={() => { setGraphConnected(true); showToast('Microsoft Graph connected successfully'); }}>
                    <Plug className="size-3.5 mr-1.5" />Connect
                  </Button>
                </motion.div>
              )}
            </div>
            <Separator className="bg-border/60" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-lg">
              <div className="space-y-2.5">
                <Label htmlFor="daily-limit" className="text-sm font-medium text-muted-foreground">Daily Send Limit</Label>
                <Input id="daily-limit" type="number" min={1} value={dailyLimit} onChange={(e) => setDailyLimit(Number(e.target.value) || 0)} className={INPUT_CLS} />
              </div>
              <div className="space-y-2.5">
                <Label htmlFor="hourly-limit" className="text-sm font-medium text-muted-foreground">Per-Hour Send Limit</Label>
                <Input id="hourly-limit" type="number" min={1} value={hourlyLimit} onChange={(e) => setHourlyLimit(Number(e.target.value) || 0)} className={INPUT_CLS} />
              </div>
            </div>
            <Separator className="bg-border/60" />
            <div className="flex gap-3 pt-1">
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button variant="outline" className="border-border hover:bg-accent transition-all duration-200" onClick={() => showToast('Connection test initiated')}>Test Connection</Button>
              </motion.div>
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button className="text-primary-foreground hover:opacity-90 transition-all duration-200" style={{ background: 'linear-gradient(135deg, var(--color-gold-dim), var(--ios-gold-mid))', boxShadow: `0 0 20px ${goldAlpha(0.15)}` }} onClick={() => showToast('Mailbox settings saved')}>
                  <Save className="size-3.5 mr-1.5" />Save Settings
                </Button>
              </motion.div>
            </div>
          </div>
        </GlassPanel>
      </StaggerItem>
    </StaggerGrid>
  );
}

export function WorkingHoursTab({ showToast }: { showToast: (msg: string) => void }) {
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('18:00');
  const [timezone, setTimezone] = useState(getUserTimezone());
  const [workDays, setWorkDays] = useState<boolean[]>([true, true, true, true, true, false, false]);
  const [enforceWorkingHours, setEnforceWorkingHours] = useState(true);
  const [pauseOutsideHours, setPauseOutsideHours] = useState(true);

  const toggleDay = (idx: number) => {
    setWorkDays((prev) => prev.map((d, i) => (i === idx ? !d : d)));
  };

  return (
    <StaggerGrid stagger={0.1} className="space-y-6">
      <StaggerItem>
        <GlassPanel className="p-0 overflow-hidden">
          <div className="px-6 py-4 flex items-center gap-3" style={{ background: `linear-gradient(135deg, ${blueAlpha(0.06)}, transparent)`, borderBottom: `1px solid ${blueAlpha(0.1)}` }}>
            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${blueAlpha(0.2)}, ${blueAlpha(0.06)})` }}>
              <Clock className="size-4.5 text-blue-600" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground tracking-tight"><ShimmerText>Schedule Configuration</ShimmerText></h3>
              <p className="text-xs text-muted-foreground">Define when your campaigns are allowed to send</p>
            </div>
          </div>
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-2xl">
              <div className="space-y-2.5">
                <Label className="text-sm font-medium text-muted-foreground">Start Time</Label>
                <Select value={startTime} onValueChange={setStartTime}>
                  <SelectTrigger className={`w-full ${INPUT_CLS}`}><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    {HOURS.filter((h) => parseInt(h.value, 10) < parseInt(endTime, 10)).map((h) => (<SelectItem key={h.value} value={h.value}>{h.label}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2.5">
                <Label className="text-sm font-medium text-muted-foreground">End Time</Label>
                <Select value={endTime} onValueChange={setEndTime}>
                  <SelectTrigger className={`w-full ${INPUT_CLS}`}><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    {HOURS.filter((h) => parseInt(h.value, 10) > parseInt(startTime, 10)).map((h) => (<SelectItem key={h.value} value={h.value}>{h.label}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2.5">
                <Label className="text-sm font-medium text-muted-foreground">Timezone</Label>
                <Select value={timezone} onValueChange={setTimezone}>
                  <SelectTrigger className={`w-full ${INPUT_CLS}`}><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    {TIMEZONES.map((tz) => (<SelectItem key={tz} value={tz}>{tz}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Separator className="bg-border/60" />
            <div className="space-y-3">
              <Label className="text-sm font-medium text-muted-foreground">Working Days</Label>
              <div className="flex flex-wrap gap-3">
                {DAYS_OF_WEEK.map((day, idx) => (
                  <motion.label key={day} className="flex items-center gap-2 cursor-pointer select-none" whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
                    <Checkbox checked={workDays[idx]} onCheckedChange={() => toggleDay(idx)} />
                    <span className="text-sm text-foreground font-medium">{day}</span>
                  </motion.label>
                ))}
              </div>
            </div>
          </div>
        </GlassPanel>
      </StaggerItem>
      <StaggerItem>
        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-foreground flex items-center gap-2 px-1">
            <div className="w-1 h-4 rounded-full" style={{ background: 'linear-gradient(180deg, var(--color-gold-dim), var(--ios-gold-dark))' }} />
            Enforcement Rules
          </h4>
          <div className="space-y-3">
            <ToggleRow title="Enforce working hours for sends" description="Campaigns will only deliver emails during your configured working window" checked={enforceWorkingHours} onChange={setEnforceWorkingHours} />
            <ToggleRow title="Pause sends outside working hours" description="Automatically queue and pause outgoing emails outside of working hours" checked={pauseOutsideHours} onChange={setPauseOutsideHours} />
          </div>
        </div>
      </StaggerItem>
      <StaggerItem>
        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="pt-1">
          <Button className="text-primary-foreground hover:opacity-90 transition-all duration-200" style={{ background: 'linear-gradient(135deg, var(--color-gold-dim), var(--ios-gold-mid))', boxShadow: `0 0 20px ${goldAlpha(0.15)}` }} onClick={() => showToast('Working hours saved')}>
            <Save className="size-3.5 mr-1.5" />Save Settings
          </Button>
        </motion.div>
      </StaggerItem>
    </StaggerGrid>
  );
}
