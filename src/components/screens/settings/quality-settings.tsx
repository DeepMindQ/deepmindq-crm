'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  StaggerGrid, StaggerItem, GlassPanel, ShimmerText, GradientCard,
} from '@/components/ui/animated-components';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
  ShieldCheck, Star, Ban, Save, RotateCcw,
} from 'lucide-react';
import { INPUT_CLS, type ScoringRule, DEFAULT_SCORING_RULES } from './settings-constants';

const goldAlpha = (a: number) => `rgba(212,175,55,${a})`;
const greenAlpha = (a: number) => `rgba(16,185,129,${a})`;
const redAlpha = (a: number) => `rgba(239,68,68,${a})`;

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

export function VerificationTab({ showToast }: { showToast: (msg: string) => void }) {
  const [autoVerify, setAutoVerify] = useState(true);
  const [blockDisposable, setBlockDisposable] = useState(true);
  const [blockRoleBased, setBlockRoleBased] = useState(false);
  const [flagFreeProviders, setFlagFreeProviders] = useState(true);
  const [requireMx, setRequireMx] = useState(true);
  const [minHealthScore, setMinHealthScore] = useState(0);

  return (
    <StaggerGrid stagger={0.08} className="space-y-6">
      <StaggerItem>
        <GlassPanel className="p-0 overflow-hidden">
          <div className="px-6 py-4 flex items-center gap-3" style={{ background: `linear-gradient(135deg, ${greenAlpha(0.06)}, transparent)`, borderBottom: `1px solid ${greenAlpha(0.1)}` }}>
            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${greenAlpha(0.2)}, ${greenAlpha(0.06)})` }}>
              <ShieldCheck className="size-4.5 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground tracking-tight"><ShimmerText>Email Verification Rules</ShimmerText></h3>
              <p className="text-xs text-muted-foreground">Quality filters and automated verification checks</p>
            </div>
          </div>
          <div className="p-6 space-y-4">
            <ToggleRow icon={ShieldCheck} title="Auto-verify emails on import" description="Automatically run verification checks when leads are imported" checked={autoVerify} onChange={setAutoVerify} />
            <ToggleRow icon={Ban} title="Block disposable domains" description="Reject emails from temporary/disposable email providers" checked={blockDisposable} onChange={setBlockDisposable} />
            <ToggleRow icon={Ban} title="Block role-based emails (info@, sales@, etc.)" description="Filter out generic role-based email addresses" checked={blockRoleBased} onChange={setBlockRoleBased} />
            <ToggleRow icon={Star} title="Flag free providers as risky" description="Mark Gmail, Yahoo, Outlook.com, etc. as lower quality leads" checked={flagFreeProviders} onChange={setFlagFreeProviders} />
            <ToggleRow icon={ShieldCheck} title="Require MX record validation" description="Verify the domain has valid MX records before accepting" checked={requireMx} onChange={setRequireMx} />
          </div>
        </GlassPanel>
      </StaggerItem>
      <StaggerItem>
        <GlassPanel className="p-6 space-y-4">
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-1 h-5 rounded-full" style={{ background: 'linear-gradient(180deg, var(--color-gold-dim), var(--ios-gold-dark))' }} />
            <h4 className="text-sm font-semibold text-foreground">Email Health Threshold</h4>
          </div>
          <p className="text-xs text-muted-foreground ml-4">Emails scoring below this threshold will be flagged for review (0-100)</p>
          <div className="max-w-xs space-y-2.5 pt-1">
            <Label htmlFor="health-score" className="text-sm font-medium text-muted-foreground">Minimum Email Health Score</Label>
            <Input id="health-score" type="number" min={0} max={100} value={minHealthScore} onChange={(e) => setMinHealthScore(Number(e.target.value) || 0)} className={INPUT_CLS} />
          </div>
          <div className="pt-3">
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button className="text-primary-foreground hover:opacity-90 transition-all duration-200" style={{ background: 'linear-gradient(135deg, var(--color-gold-dim), var(--ios-gold-mid))', boxShadow: `0 0 20px ${goldAlpha(0.15)}` }} onClick={() => showToast('Verification settings saved')}>
                <Save className="size-3.5 mr-1.5" />Save Settings
              </Button>
            </motion.div>
          </div>
        </GlassPanel>
      </StaggerItem>
    </StaggerGrid>
  );
}

export function ScoringTab({ showToast }: { showToast: (msg: string) => void }) {
  const [scoringRules, setScoringRules] = useState<ScoringRule[]>(DEFAULT_SCORING_RULES);

  const updateRulePoints = (id: string, points: number) => {
    setScoringRules((prev) => prev.map((r) => (r.id === id ? { ...r, points: Math.max(0, points) } : r)));
  };
  const resetScoringRules = () => { setScoringRules(DEFAULT_SCORING_RULES); showToast('Scoring rules reset to defaults'); };
  const saveScoringRules = () => { showToast('Scoring rules saved'); };

  return (
    <StaggerGrid stagger={0.08} className="space-y-6">
      <StaggerItem>
        <GlassPanel className="p-0 overflow-hidden">
          <div className="px-6 py-4 flex items-center gap-3" style={{ background: `linear-gradient(135deg, ${goldAlpha(0.06)}, transparent)`, borderBottom: `1px solid ${goldAlpha(0.1)}` }}>
            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${goldAlpha(0.2)}, ${goldAlpha(0.06)})` }}>
              <Star className="size-4.5" style={{ color: 'var(--color-gold)' }} />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground tracking-tight"><ShimmerText>Lead Scoring Rules</ShimmerText></h3>
              <p className="text-xs text-muted-foreground">Adjust point values for each scoring criterion. Leads are ranked by total score.</p>
            </div>
          </div>
          <div className="p-6 space-y-1">
            {scoringRules.map((rule, idx) => (
              <div key={rule.id}>
                <div className="flex items-center justify-between gap-4 max-w-lg py-3">
                  <Label className="text-sm text-foreground flex-1 font-medium">{rule.label}</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold" style={{ color: 'var(--color-gold)' }}>+</span>
                    <Input type="number" min={0} value={rule.points} onChange={(e) => updateRulePoints(rule.id, Number(e.target.value) || 0)} className={`${INPUT_CLS} w-20 text-right font-semibold`} />
                    <span className="text-xs text-muted-foreground w-7">pts</span>
                  </div>
                </div>
                {idx < scoringRules.length - 1 && <Separator className="bg-border/40" />}
              </div>
            ))}
          </div>
          <div className="mx-6 mb-6 rounded-lg px-5 py-4 flex items-center justify-between" style={{ background: `linear-gradient(135deg, ${goldAlpha(0.06)}, ${goldAlpha(0.02)})`, border: `1px solid ${goldAlpha(0.1)}` }}>
            <span className="text-sm text-muted-foreground font-medium">Maximum possible score:</span>
            <Badge className="font-bold text-sm px-3 py-1" style={{ background: `linear-gradient(135deg, ${goldAlpha(0.15)}, ${goldAlpha(0.05)})`, color: 'var(--color-gold)', border: `1px solid ${goldAlpha(0.3)}` }}>
              {scoringRules.reduce((sum, r) => sum + r.points, 0)} pts
            </Badge>
          </div>
          <div className="px-6 pb-6 flex flex-wrap gap-3 pt-1">
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button variant="outline" className="border-border hover:bg-accent transition-all duration-200" onClick={resetScoringRules}>
                <RotateCcw className="size-3.5 mr-1.5" />Reset to Defaults
              </Button>
            </motion.div>
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button className="text-primary-foreground hover:opacity-90 transition-all duration-200" style={{ background: 'linear-gradient(135deg, var(--color-gold-dim), var(--ios-gold-mid))', boxShadow: `0 0 20px ${goldAlpha(0.15)}` }} onClick={saveScoringRules}>
                <Save className="size-3.5 mr-1.5" />Save Rules
              </Button>
            </motion.div>
          </div>
        </GlassPanel>
      </StaggerItem>
    </StaggerGrid>
  );
}

export function SuppressionTab({ showToast }: { showToast: (msg: string) => void }) {
  const [suppressBounce, setSuppressBounce] = useState(true);
  const [suppressUnsubscribe, setSuppressUnsubscribe] = useState(true);
  const [suppressNegative, setSuppressNegative] = useState(false);
  const [requireApproval, setRequireApproval] = useState(true);

  return (
    <StaggerGrid stagger={0.08} className="space-y-6">
      <StaggerItem>
        <GlassPanel className="p-0 overflow-hidden">
          <div className="px-6 py-4 flex items-center gap-3" style={{ background: `linear-gradient(135deg, ${redAlpha(0.06)}, transparent)`, borderBottom: `1px solid ${redAlpha(0.1)}` }}>
            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${redAlpha(0.2)}, ${redAlpha(0.06)})` }}>
              <Ban className="size-4.5 text-red-600" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground tracking-tight"><ShimmerText>Suppression Rules</ShimmerText></h3>
              <p className="text-xs text-muted-foreground">Control when contacts are automatically suppressed from future campaigns.</p>
            </div>
          </div>
          <div className="p-6 space-y-4">
            <ToggleRow icon={Ban} title="Auto-suppress on hard bounce" description="Permanently remove emails that return a hard bounce (5xx errors)" checked={suppressBounce} onChange={setSuppressBounce} />
            <ToggleRow icon={Ban} title="Auto-suppress on unsubscribe reply" description="Suppress contacts who reply asking to unsubscribe" checked={suppressUnsubscribe} onChange={setSuppressUnsubscribe} />
            <ToggleRow icon={Ban} title="Auto-suppress on negative reply" description="Suppress contacts who reply with negative sentiment or complaints" checked={suppressNegative} onChange={setSuppressNegative} />
            <ToggleRow icon={ShieldCheck} title="Suppression removal requires approval" description="Team leads must approve before a suppressed contact can be re-activated" checked={requireApproval} onChange={setRequireApproval} />
          </div>
          <div className="px-6 pb-6 pt-1">
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button className="text-primary-foreground hover:opacity-90 transition-all duration-200" style={{ background: 'linear-gradient(135deg, var(--color-gold-dim), var(--ios-gold-mid))', boxShadow: `0 0 20px ${goldAlpha(0.15)}` }} onClick={() => showToast('Suppression rules saved')}>
                <Save className="size-3.5 mr-1.5" />Save Settings
              </Button>
            </motion.div>
          </div>
        </GlassPanel>
      </StaggerItem>
    </StaggerGrid>
  );
}
