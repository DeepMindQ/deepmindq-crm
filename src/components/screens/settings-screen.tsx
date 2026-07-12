'use client'

import { useState } from 'react'
import {
  Settings, Mail, Wifi, WifiOff, TestTube2, Plug, Zap,
  FileUp, Target, Users, ShieldCheck, Plus, Pencil, Trash2,
  Save, Loader2, UserPlus,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import { Separator } from '@/components/ui/separator'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  MOCK_IMPORT_PROFILES, MOCK_SCORING_RULES, MOCK_TEAM_MEMBERS,
  type ImportProfile, type ScoringRule, type TeamMemberSettings,
} from '@/lib/mock-data'
import { cn } from '@/lib/utils'

/* ═══════════════════════════════════════════════════════════════
   Section wrapper
   ═══════════════════════════════════════════════════════════════ */
function SectionCard({ title, icon: Icon, children, description }: {
  title: string
  icon: typeof Settings
  children: React.ReactNode
  description?: string
}) {
  return (
    <div className="rounded-xl bg-card border border-border overflow-hidden">
      <div className="px-5 py-4 border-b border-border bg-secondary/20">
        <div className="flex items-center gap-2.5">
          <Icon className="size-4 text-primary" />
          <div>
            <h2 className="text-sm font-semibold text-foreground">{title}</h2>
            {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
          </div>
        </div>
      </div>
      <div className="p-5 space-y-5">
        {children}
      </div>
    </div>
  )
}

function FieldRow({ label, description, children }: {
  label: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div className="flex-1 min-w-0">
        <Label className="text-sm font-medium text-foreground">{label}</Label>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 3600000) return `${Math.max(1, Math.round(diff / 60000))}m ago`
  if (diff < 86400000) return `${Math.round(diff / 3600000)}h ago`
  return `${Math.round(diff / 86400000)}d ago`
}

/* ═══════════════════════════════════════════════════════════════
   SettingsScreen
   ═══════════════════════════════════════════════════════════════ */
export function SettingsScreen() {
  // ── Outlook ──
  const [dailyLimit, setDailyLimit] = useState(200)
  const [hourlyLimit, setHourlyLimit] = useState(25)
  const [workStart, setWorkStart] = useState('09:00')
  const [workEnd, setWorkEnd] = useState('18:00')

  // ── Send Config ──
  const [followUpDelays, setFollowUpDelays] = useState([3, 7])
  const [dryRun, setDryRun] = useState(false)
  const [pauseAll, setPauseAll] = useState(false)

  // ── Import Profiles ──
  const [profiles] = useState<ImportProfile[]>(MOCK_IMPORT_PROFILES)

  // ── Scoring Rules ──
  const [rules, setRules] = useState<ScoringRule[]>(MOCK_SCORING_RULES)

  // ── Team ──
  const [team] = useState<TeamMemberSettings[]>(MOCK_TEAM_MEMBERS)

  // ── Suppression ──
  const [autoSuppressHardBounce, setAutoSuppressHardBounce] = useState(true)
  const [autoSuppressUnsub, setAutoSuppressUnsub] = useState(true)
  const [suppressionRequiresReason, setSuppressionRequiresReason] = useState(true)

  const toggleRule = (id: string) => {
    setRules(prev => prev.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r))
    toast.success('Scoring rule updated')
  }

  const updateRuleWeight = (id: string, weight: number) => {
    setRules(prev => prev.map(r => r.id === id ? { ...r, weight } : r))
  }

  const handleSave = () => {
    toast.success('Settings saved successfully')
  }

  const handleTestConnection = () => {
    toast.success('Connection test successful — Outlook API responding')
  }

  const roleColors: Record<string, string> = {
    Admin: 'bg-primary/15 text-primary border-primary/30',
    Reviewer: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    Sender: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
    Viewer: 'bg-gray-500/15 text-gray-400 border-gray-500/30',
  }

  return (
    <div className="space-y-6 fade-in max-w-4xl">
      {/* ═══ Header ═══ */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground tracking-tight flex items-center gap-2.5">
            <Settings className="size-5 text-primary" />
            Settings
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure Outlook, send limits, scoring, team, and suppression controls
          </p>
        </div>
        <Button className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg press-scale" onClick={handleSave}>
          <Save className="size-3.5 mr-1.5" />
          Save All
        </Button>
      </div>

      {/* ═══ Outlook Integration ═══ */}
      <SectionCard title="Outlook Integration" icon={Plug} description="Connected mailbox and send configuration">
        <FieldRow label="Connected Mailbox" description="Microsoft 365 account used for sending">
          <div className="flex items-center gap-2">
            <div className="size-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-sm font-mono text-foreground">sales@company.com</span>
            <Badge variant="outline" className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[10px] px-2 py-0.5 rounded-md">
              Connected
            </Badge>
          </div>
        </FieldRow>

        <Separator className="bg-border/50" />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FieldRow label="Daily Send Limit" description="Max emails per day">
            <Input
              type="number"
              value={dailyLimit}
              onChange={e => setDailyLimit(Number(e.target.value))}
              className="h-8 w-24 bg-secondary/50 border-border text-foreground text-sm rounded-lg text-center tabular-nums"
            />
          </FieldRow>
          <FieldRow label="Hourly Send Limit" description="Max emails per hour">
            <Input
              type="number"
              value={hourlyLimit}
              onChange={e => setHourlyLimit(Number(e.target.value))}
              className="h-8 w-24 bg-secondary/50 border-border text-foreground text-sm rounded-lg text-center tabular-nums"
            />
          </FieldRow>
        </div>

        <Separator className="bg-border/50" />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FieldRow label="Working Hours Start">
            <Input
              type="time"
              value={workStart}
              onChange={e => setWorkStart(e.target.value)}
              className="h-8 w-28 bg-secondary/50 border-border text-foreground text-sm rounded-lg"
            />
          </FieldRow>
          <FieldRow label="Working Hours End">
            <Input
              type="time"
              value={workEnd}
              onChange={e => setWorkEnd(e.target.value)}
              className="h-8 w-28 bg-secondary/50 border-border text-foreground text-sm rounded-lg"
            />
          </FieldRow>
        </div>

        <Separator className="bg-border/50" />

        <div className="flex items-center gap-3">
          <Button variant="outline" className="bg-secondary text-secondary-foreground hover:bg-secondary/80 border-border" onClick={handleTestConnection}>
            <TestTube2 className="size-3.5 mr-1.5" />
            Test Connection
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="text-red-400 hover:text-red-300 hover:bg-red-500/10 border-border">
                <WifiOff className="size-3.5 mr-1.5" />
                Disconnect
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="bg-card border-border">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-foreground">Disconnect Outlook?</AlertDialogTitle>
                <AlertDialogDescription className="text-muted-foreground">
                  This will disconnect your Outlook mailbox. All pending sends will be paused and no new emails can be sent until reconnected.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="bg-secondary text-secondary-foreground hover:bg-secondary/80 border-border">Cancel</AlertDialogCancel>
                <AlertDialogAction className="bg-red-600 hover:bg-red-700 text-white">Disconnect</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </SectionCard>

      {/* ═══ Send Configuration ═══ */}
      <SectionCard title="Send Configuration" icon={Zap} description="Follow-up sequences, delays, and send modes">
        <FieldRow label="Follow-up Sequence" description="Number of follow-ups after initial email">
          <Badge variant="outline" className="text-xs px-3 py-1 rounded-lg border-primary/30 bg-primary/10 text-primary font-mono">
            Initial + 2 follow-ups
          </Badge>
        </FieldRow>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FieldRow label="Follow-up 1 Delay" description="Days after initial email">
            <Input
              type="number"
              value={followUpDelays[0]}
              onChange={e => setFollowUpDelays([Number(e.target.value), followUpDelays[1]])}
              className="h-8 w-24 bg-secondary/50 border-border text-foreground text-sm rounded-lg text-center tabular-nums"
            />
          </FieldRow>
          <FieldRow label="Follow-up 2 Delay" description="Days after follow-up 1">
            <Input
              type="number"
              value={followUpDelays[1]}
              onChange={e => setFollowUpDelays([followUpDelays[0], Number(e.target.value)])}
              className="h-8 w-24 bg-secondary/50 border-border text-foreground text-sm rounded-lg text-center tabular-nums"
            />
          </FieldRow>
        </div>

        <Separator className="bg-border/50" />

        <FieldRow label="Dry Run Mode" description="Simulate sends without actually delivering emails">
          <Switch checked={dryRun} onCheckedChange={setDryRun} />
        </FieldRow>

        <FieldRow label="Pause All Sends" description="Emergency stop — no emails will be sent">
          <Switch checked={pauseAll} onCheckedChange={setPauseAll} />
        </FieldRow>
      </SectionCard>

      {/* ═══ Import Profiles ═══ */}
      <SectionCard title="Import Profiles" icon={FileUp} description="Saved CSV/Excel column mapping profiles">
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/20">
                {['Profile Name', 'Header Hash', 'Last Used', 'Mappings', 'Actions'].map(h => (
                  <th key={h} className="text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-2.5">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {profiles.map((profile, idx) => (
                <tr key={profile.id} className={cn('border-b border-border/50 hover:bg-primary/5', idx % 2 === 1 && 'bg-secondary/10')}>
                  <td className="px-4 py-2.5">
                    <p className="text-xs font-medium text-foreground">{profile.name}</p>
                  </td>
                  <td className="px-4 py-2.5">
                    <code className="text-[11px] font-mono text-muted-foreground">{profile.headerHash}</code>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="text-xs text-muted-foreground">{timeAgo(profile.lastUsed)}</span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="text-xs text-muted-foreground">{profile.mappings.length} fields</span>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-foreground">
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="size-7 text-red-400 hover:text-red-300">
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* ═══ Scoring Rules ═══ */}
      <SectionCard title="Scoring Rules" icon={Target} description="Configure how leads are scored and prioritized">
        <div className="space-y-4">
          {rules.map((rule, idx) => (
            <div key={rule.id} className="rounded-lg border border-border p-4 space-y-3 bg-secondary/10">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-foreground">{rule.name}</p>
                    <Badge variant="outline" className="text-[10px] px-2 py-0.5 rounded-md bg-primary/15 text-primary border-primary/30 font-mono">
                      +{rule.points} pts
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{rule.description}</p>
                </div>
                <Switch checked={rule.enabled} onCheckedChange={() => toggleRule(rule.id)} />
              </div>

              <div className="flex items-center gap-3">
                <span className="text-[11px] text-muted-foreground w-12 shrink-0">Weight</span>
                <Slider
                  value={[rule.weight]}
                  onValueChange={([v]) => updateRuleWeight(rule.id, v)}
                  max={100}
                  step={5}
                  className="flex-1 [&_[role=slider]]:bg-primary [&_[role=slider]]:border-primary"
                />
                <span className="text-xs font-mono text-primary tabular-nums w-8 text-right">{rule.weight}</span>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* ═══ Team & Roles ═══ */}
      <SectionCard title="Team & Roles" icon={Users} description="Manage team members and their access levels">
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/20">
                {['Name', 'Email', 'Role', 'Last Active', ''].map(h => (
                  <th key={h} className="text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-2.5">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {team.map((member, idx) => (
                <tr key={member.id} className={cn('border-b border-border/50 hover:bg-primary/5', idx % 2 === 1 && 'bg-secondary/10')}>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <div className="size-7 rounded-full bg-primary/15 flex items-center justify-center text-primary font-semibold text-[10px] shrink-0">
                        {member.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <p className="text-xs font-medium text-foreground">{member.name}</p>
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="text-xs text-muted-foreground">{member.email}</span>
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge variant="outline" className={cn('text-[10px] px-2 py-0.5 rounded-md border', roleColors[member.role])}>
                      {member.role}
                    </Badge>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="text-xs text-muted-foreground">{timeAgo(member.lastActive)}</span>
                  </td>
                  <td className="px-4 py-2.5">
                    <Select defaultValue={member.role}>
                      <SelectTrigger className="h-7 w-24 bg-transparent border-border text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(['Admin', 'Reviewer', 'Sender', 'Viewer'] as const).map(r => (
                          <SelectItem key={r} value={r} className="text-xs">{r}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Button variant="outline" className="bg-secondary text-secondary-foreground hover:bg-secondary/80 border-border w-full">
          <UserPlus className="size-3.5 mr-1.5" />
          Invite User
        </Button>
      </SectionCard>

      {/* ═══ Suppression Controls ═══ */}
      <SectionCard title="Suppression Controls" icon={ShieldCheck} description="Automated and manual suppression rules">
        <FieldRow
          label="Auto-suppress on hard bounce"
          description="Automatically add contacts to suppression list after a hard bounce"
        >
          <Switch checked={autoSuppressHardBounce} onCheckedChange={setAutoSuppressHardBounce} />
        </FieldRow>

        <Separator className="bg-border/50" />

        <FieldRow
          label="Auto-suppress on unsubscribe"
          description="Automatically add contacts to suppression list when they unsubscribe"
        >
          <Switch checked={autoSuppressUnsub} onCheckedChange={setAutoSuppressUnsub} />
        </FieldRow>

        <Separator className="bg-border/50" />

        <FieldRow
          label="Suppression removal requires reason"
          description="Require an auditable reason when removing a contact from the suppression list"
        >
          <Switch checked={suppressionRequiresReason} onCheckedChange={setSuppressionRequiresReason} />
        </FieldRow>
      </SectionCard>
    </div>
  )
}