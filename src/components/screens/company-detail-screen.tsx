'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  PageTransition, AnimatedCard, StatCard, GlassPanel,
  EmptyState, StaggerGrid, StaggerItem, SectionHeader, AnimatedCounter,
} from '@/components/ui/animated-components';
import { AIInsightCard } from '@/components/enterprise/AIInsightCard';
import { ConfidenceBar } from '@/components/enterprise/ConfidenceBar';
import { EvidenceBadge } from '@/components/enterprise/EvidenceBadge';
import { ErrorState } from '@/components/enterprise/ErrorState';
import { CompanyMindMap } from '@/components/company-mind-map';
import {
  ArrowLeft, Globe, MapPin, Users, Building2, ExternalLink, Edit3, Save,
  X, Sparkles, Loader2, Trash2, Plus, FileText, Mail,
  Target, Brain, Activity, TrendingUp, Award, UserCircle, Eye,
  AlertTriangle, CheckCircle2, Clock, MessageSquare,
  Send, MailOpen, DollarSign, Layers, BookOpen,
  Lightbulb, Bell, ChevronRight, Briefcase, Link2, Network, Database,
  ShieldCheck, Zap, BarChart3, ChevronDown, ChevronUp, Radar,
  RefreshCw, Gauge, Search,
} from 'lucide-react';
import { useAppStore } from '@/lib/store';

/* ═══════════════════════════════════════════════════
   Constants & Colors
   ═══════════════════════════════════════════════════ */
const INTEL = '#2563eb';
const GOLD = '#D4AF37';
const INTEL_GRADIENT = 'linear-gradient(135deg, #1e40af, #2563eb, #3b82f6)';

const STATUS_COLORS: Record<string, string> = {
  prospect: 'bg-blue-500/20 text-blue-600 border-blue-500/30',
  researching: 'bg-amber-500/20 text-amber-600 border-amber-500/30',
  active: 'bg-emerald-500/20 text-emerald-600 border-emerald-500/30',
  engaged: 'bg-purple-500/20 text-purple-600 border-purple-500/30',
  paused: 'bg-gray-500/20 text-gray-600 border-gray-500/30',
  closed_won: 'bg-green-500/20 text-green-400 border-green-500/30',
  closed_lost: 'bg-red-500/20 text-red-600 border-red-500/30',
};

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'bg-red-500/20 text-red-600 border-red-500/30',
  high: 'bg-orange-500/20 text-orange-600 border-orange-500/30',
  medium: 'bg-yellow-500/20 text-yellow-600 border-yellow-500/30',
  low: 'bg-green-500/20 text-green-400 border-green-500/30',
};

/* ═══════════════════════════════════════════════════
   Score Ring — SVG circular score indicator
   ═══════════════════════════════════════════════════ */
function ScoreRing({ score, size = 72, strokeWidth = 5, label, color }: {
  score: number; size?: number; strokeWidth?: number; label?: string; color?: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const c = color || (score >= 80 ? '#059669' : score >= 60 ? '#D97706' : score >= 40 ? '#ea580c' : '#DC2626');

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke="#F3F4F6" strokeWidth={strokeWidth} />
          <motion.circle
            cx={size/2} cy={size/2} r={radius}
            fill="none" stroke={c} strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1], delay: 0.3 }}
            style={{ filter: `drop-shadow(0 0 6px ${c}40)` }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-black tabular-nums" style={{ color: c }}>{Math.round(score)}</span>
        </div>
      </div>
      {label && <span className="text-[10px] text-muted-foreground font-medium">{label}</span>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   Mini Score Bar
   ═══════════════════════════════════════════════════ */
function MiniBar({ label, value, max = 100, color = INTEL }: { label: string; value: number; max?: number; color?: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] text-muted-foreground w-[90px] shrink-0 text-right truncate">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ background: color }}
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(pct, 100)}%` }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
      <span className="text-[11px] font-semibold tabular-nums w-8 text-right">{pct}%</span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   Intelligence Pulse Dot
   ═══════════════════════════════════════════════════ */
function PulseDot({ color = INTEL, size = 8 }: { color?: string; size?: number }) {
  return (
    <span className="relative flex h-2.5 w-2.5">
      <span className="absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping" style={{ backgroundColor: color }} />
      <span className="relative inline-flex rounded-full h-2.5 w-2.5" style={{ backgroundColor: color }} />
    </span>
  );
}

/* ═══════════════════════════════════════════════════
   Intelligence Summary Card (Hero)
   ═══════════════════════════════════════════════════ */
function IntelligenceHero({
  company, aiScore, aiActions, signalCount, contactCount, oppCount,
  loadingScore, onRefreshScore, onRefreshActions, onNavigateActions,
}: {
  company: any; aiScore: any; aiActions: any;
  signalCount: number; contactCount: number; oppCount: number;
  loadingScore: boolean; onRefreshScore: () => void; onRefreshActions: () => void;
  onNavigateActions: () => void;
}) {
  const score = aiScore?.score ?? company?.intelligenceScore ?? 0;
  const grade = aiScore?.grade ?? '-';
  const priority = aiScore?.priorityTier ?? 'LOW';
  const confidence = aiScore?.confidence ?? 0;
  const salesMotion = aiActions?.detectedSalesMotion ?? 'unknown';

  return (
    <AnimatedCard delay={0} glow="rgba(37, 99, 235, 0.12)">
      <div className="overflow-hidden">
        {/* Gradient top accent */}
        <div className="h-1" style={{ background: INTEL_GRADIENT }} />
        <div className="p-5">
          {/* Top row: Company name + Score */}
          <div className="flex items-start gap-5">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Building2 size={18} style={{ color: INTEL }} />
                <h1 className="text-xl font-black text-foreground truncate">{company?.rawName || company?.name || 'Unknown'}</h1>
                <Badge className={`text-[10px] px-1.5 py-0 ${STATUS_COLORS[company?.status || 'prospect'] || ''}`}>
                  {(company?.status || 'prospect').replace(/_/g, ' ')}
                </Badge>
              </div>
              {company?.domain && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3">
                  <Globe size={11} /> <span>{company.domain}</span>
                  {company?.industry && <><span className="mx-1">·</span><span>{company.industry}</span></>}
                  {company?.sizeRange && <><span className="mx-1">·</span><span>{company.sizeRange}</span></>}
                </div>
              )}

              {/* KPI strip */}
              <div className="grid grid-cols-4 gap-3">
                <KPIChip icon={Target} label="Score" value={score} color={score >= 80 ? '#059669' : score >= 60 ? '#D97706' : '#DC2626'} />
                <KPIChip icon={Bell} label="Signals" value={signalCount} color={INTEL} />
                <KPIChip icon={Users} label="Contacts" value={contactCount} color="#7c3aed" />
                <KPIChip icon={Zap} label="Opps" value={oppCount} color="#d97706" />
              </div>
            </div>

            {/* Score Ring */}
            <div className="flex flex-col items-center gap-1">
              <ScoreRing score={score} size={96} strokeWidth={6} />
              {grade !== '-' && (
                <Badge className={`text-xs font-black px-2.5 py-0.5 ${
                  grade === 'A' ? 'bg-emerald-500/15 text-emerald-600 border-emerald-200' :
                  grade === 'B' ? 'bg-amber-500/15 text-amber-600 border-amber-200' :
                  grade === 'C' ? 'bg-orange-500/15 text-orange-600 border-orange-200' :
                  'bg-red-500/15 text-red-600 border-red-200'
                }`}>Grade {grade}</Badge>
              )}
            </div>
          </div>

          {/* Sub-scores row */}
          {aiScore && (
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Account Fit', value: aiScore.accountFit, color: INTEL },
                { label: 'Contact Influence', value: aiScore.contactInfluence, color: '#059669' },
                { label: 'Opp. Strength', value: aiScore.opportunityStrength, color: '#d97706' },
                { label: 'Buying Intent', value: aiScore.buyingIntent, color: '#7c3aed' },
              ].map((sub, i) => (
                <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50/80 border border-gray-100">
                  <div className="flex-1">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{sub.label}</p>
                    <div className="w-full h-1.5 bg-gray-200 rounded-full mt-1.5 overflow-hidden">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ background: sub.color }}
                        initial={{ width: 0 }}
                        animate={{ width: `${sub.value}%` }}
                        transition={{ duration: 1, delay: 0.5 + i * 0.1 }}
                      />
                    </div>
                  </div>
                  <span className="text-sm font-black tabular-nums" style={{ color: sub.color }}>{sub.value}</span>
                </div>
              ))}
            </div>
          )}

          {/* AI Actions summary row */}
          {aiActions && (
            <div className="mt-4 flex items-center gap-3 px-3 py-2.5 rounded-lg bg-amber-50/60 border border-amber-200/60">
              <Lightbulb size={16} className="text-amber-600 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-amber-800">
                  {aiActions.detectedSalesMotion?.replace(/_/g, ' ').toUpperCase()} Motion Detected
                </p>
                <p className="text-[11px] text-amber-700/80 truncate">
                  {aiActions.actions?.slice(0, 2).map((a: any) => a.title || a.action).join(' → ')}
                </p>
              </div>
              <Badge className="text-[10px] bg-purple-500/15 text-purple-600 border-purple-200 shrink-0">
                {aiActions.actions?.length || 0} Actions
              </Badge>
              <Button size="sm" variant="ghost" className="h-7 text-[10px] text-amber-700 hover:text-amber-900 shrink-0" onClick={onNavigateActions}>
                View All <ChevronRight size={12} />
              </Button>
            </div>
          )}

          {/* Action buttons */}
          <div className="mt-4 flex items-center gap-2">
            <Button
              size="sm"
              onClick={loadingScore ? undefined : onRefreshScore}
              disabled={loadingScore}
              className="gap-1.5 h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white"
            >
              {loadingScore ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
              {loadingScore ? 'Scoring...' : 'Run Intelligence'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={onRefreshActions}
              className="gap-1.5 h-8 text-xs border-gray-200"
            >
              <Lightbulb size={13} className="text-amber-500" /> Generate Actions
            </Button>
            <div className="ml-auto flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <PulseDot color={confidence >= 60 ? '#059669' : '#d97706'} />
              {confidence}% confidence
              {aiScore?.evidenceCount > 0 && <><span className="mx-1">·</span>{aiScore.evidenceCount} evidence sources</>}
            </div>
          </div>
        </div>
      </div>
    </AnimatedCard>
  );
}

/* ═══════════════════════════════════════════════════
   KPI Chip
   ═══════════════════════════════════════════════════ */
function KPIChip({ icon: Icon, label, value, color }: { icon: any; label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50/80 border border-gray-100">
      <Icon size={14} style={{ color }} />
      <div>
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
        <p className="text-base font-black tabular-nums" style={{ color }}>{value}</p>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   Signal Card
   ═══════════════════════════════════════════════════ */
function SignalCard({ signal, onToggleRead }: { signal: any; onToggleRead: () => void }) {
  const severity = signal.severity || 'low';
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`p-3 rounded-lg border cursor-pointer hover:shadow-sm transition-all ${SEVERITY_COLORS[severity] || SEVERITY_COLORS.low}`}
      onClick={onToggleRead}
    >
      <div className="flex items-start gap-2">
        <Bell size={13} className="mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold truncate">{signal.title || signal.signalType}</p>
          <p className="text-[11px] opacity-80 line-clamp-2 mt-0.5">{signal.description || signal.impact || ''}</p>
          {signal.detectedAt && (
            <p className="text-[10px] opacity-60 mt-1">{new Date(signal.detectedAt).toLocaleDateString()}</p>
          )}
        </div>
        <Badge className="text-[9px] px-1 py-0 uppercase font-bold shrink-0">{severity}</Badge>
      </div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════
   Contact Mini Card
   ═══════════════════════════════════════════════════ */
function ContactMiniCard({ contact, onSelect }: { contact: any; onSelect: () => void }) {
  const roleColor = contact.roleBucket === 'Executive' ? '#7c3aed' : contact.roleBucket === 'Manager' ? '#2563eb' : '#059669';
  return (
    <motion.div
      whileHover={{ y: -1 }}
      onClick={onSelect}
      className="p-3 rounded-lg border border-gray-200 bg-white hover:border-blue-200 hover:shadow-sm cursor-pointer transition-all group"
    >
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-full flex items-center justify-center bg-gray-100 text-xs font-bold text-gray-500 shrink-0">
          {contact.name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold truncate group-hover:text-blue-600 transition-colors">{contact.name}</p>
          <p className="text-[10px] text-muted-foreground truncate">{contact.jobTitle || 'No title'}</p>
        </div>
        {contact.roleBucket && (
          <Badge className="text-[9px] px-1.5 py-0 border font-medium" style={{ borderColor: roleColor + '40', color: roleColor, backgroundColor: roleColor + '10' }}>
            {contact.roleBucket}
          </Badge>
        )}
      </div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════
   AI Insight Card (inline)
   ═══════════════════════════════════════════════════ */
function IntelInsightItem({ insight, index }: { insight: any; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08 }}
      className="rounded-xl border border-blue-100/60 bg-gradient-to-br from-white to-blue-50/30 p-4 hover:shadow-md transition-all"
    >
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-blue-100 shrink-0">
          <Sparkles size={14} className="text-blue-600" />
        </div>
        <div className="flex-1 min-w-0 space-y-2">
          <h4 className="text-xs font-bold text-foreground">{insight.title || 'AI Insight'}</h4>
          <ConfidenceBar value={insight.confidence || 65} label="Confidence" size="sm" />
          <p className="text-[11px] text-muted-foreground leading-relaxed">{insight.evidence || insight.description || ''}</p>
          {insight.source && <EvidenceBadge source={insight.source} />}
          {insight.recommendedAction && (
            <div className="flex items-start gap-1.5 px-2.5 py-2 rounded-lg bg-blue-50/60 border border-blue-100">
              <Lightbulb size={12} className="text-blue-600 mt-0.5 shrink-0" />
              <p className="text-[11px] text-blue-800 font-medium">{insight.recommendedAction}</p>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════
   Evidence Row
   ═══════════════════════════════════════════════════ */
function EvidenceRow({ evidence }: { evidence: any }) {
  return (
    <a
      href={evidence.sourceUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-start gap-2.5 p-2.5 rounded-lg hover:bg-gray-50 transition-colors group"
    >
      <div className="w-6 h-6 rounded flex items-center justify-center bg-gray-100 shrink-0 mt-0.5">
        <FileText size={11} className="text-gray-500" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] text-foreground/80 line-clamp-1 group-hover:text-blue-600 transition-colors">{evidence.sourceTitle || evidence.snippet || 'Evidence'}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <EvidenceBadge source={evidence.sourceType || 'web'} />
          {evidence.confidence > 0 && <span className="text-[10px] text-muted-foreground tabular-nums">{Math.round(evidence.confidence * 100)}%</span>}
        </div>
      </div>
      <ExternalLink size={11} className="text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-1" />
    </a>
  );
}

/* ═══════════════════════════════════════════════════
   Action Card
   ═══════════════════════════════════════════════════ */
function ActionCard({ action, index }: { action: any; index: number }) {
  const priorityColor = action.priority === 'critical' ? '#dc2626' : action.priority === 'high' ? '#ea580c' : action.priority === 'medium' ? '#d97706' : '#059669';
  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.06 }}
      className="p-4 rounded-xl border border-gray-200 bg-white hover:shadow-md hover:border-blue-200 transition-all group"
    >
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: priorityColor + '15' }}>
          <Zap size={14} style={{ color: priorityColor }} />
        </div>
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-center gap-2">
            <h4 className="text-xs font-bold text-foreground truncate">{action.title || action.action || 'Recommended Action'}</h4>
            <Badge className="text-[9px] px-1 py-0 uppercase font-bold shrink-0" style={{ color: priorityColor, backgroundColor: priorityColor + '15', borderColor: priorityColor + '30' }}>
              {action.priority || 'medium'}
            </Badge>
          </div>
          {action.description && <p className="text-[11px] text-muted-foreground leading-relaxed">{action.description}</p>}
          {action.talkingPoints && (
            <div className="space-y-1">
              {action.talkingPoints.slice(0, 3).map((tp: string, i: number) => (
                <div key={i} className="flex items-start gap-1.5 text-[10px] text-muted-foreground">
                  <ChevronRight size={10} className="mt-0.5 text-blue-500 shrink-0" />
                  <span>{tp}</span>
                </div>
              ))}
            </div>
          )}
          <ConfidenceBar value={action.confidence || 70} label="Confidence" size="sm" />
        </div>
      </div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════
   Timeline Entry
   ═══════════════════════════════════════════════════ */
function TimelineItem({ entry }: { entry: any }) {
  const icons: Record<string, any> = {
    email_sent: <Send size={13} className="text-blue-600" />,
    email_opened: <MailOpen size={13} className="text-emerald-600" />,
    email_replied: <MessageSquare size={13} className="text-purple-600" />,
    note_added: <FileText size={13} className="text-blue-500" />,
    signal: <Bell size={13} className="text-orange-600" />,
    enrichment: <Sparkles size={13} className="text-blue-500" />,
    contact_added: <UserCircle size={13} className="text-cyan-600" />,
  };
  const icon = icons[entry.action] || <Activity size={13} className="text-gray-500" />;
  return (
    <div className="flex items-start gap-3">
      <div className="w-6 h-6 rounded-full flex items-center justify-center bg-gray-100 shrink-0 mt-0.5">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] text-foreground/80">{entry.details || entry.action?.replace(/_/g, ' ')}</p>
        <p className="text-[10px] text-muted-foreground">{new Date(entry.createdAt).toLocaleDateString()}</p>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   Section Panel (reusable)
   ═══════════════════════════════════════════════════ */
function SectionPanel({ title, icon, accent, count, children, collapsible, defaultOpen = true, onRefresh }: {
  title: string; icon: any; accent?: string; count?: number; children: React.ReactNode;
  collapsible?: boolean; defaultOpen?: boolean; onRefresh?: () => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border border-gray-200/80 bg-white overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 bg-gray-50/50">
        <div className="h-4 w-1 rounded-full" style={{ background: accent || INTEL }} />
        {React.createElement(icon, { size: 14, style: { color: accent || INTEL } })}
        <h3 className="text-xs font-bold text-foreground flex-1">{title}</h3>
        {count !== undefined && (
          <Badge className="text-[10px] px-1.5 py-0 bg-gray-100 text-muted-foreground font-medium">{count}</Badge>
        )}
        {onRefresh && (
          <button onClick={onRefresh} className="text-muted-foreground hover:text-foreground transition-colors">
            <RefreshCw size={12} />
          </button>
        )}
        {collapsible && (
          <button onClick={() => setOpen(!open)} className="text-muted-foreground hover:text-foreground transition-colors">
            {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        )}
      </div>
      {open && <div className="p-3">{children}</div>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   Main Component — AI Account Intelligence Workspace
   ═══════════════════════════════════════════════════ */
export default function CompanyDetailScreen({ companyId, navigateTo, onBack }: any) {
  const store = useAppStore;
  const setSelectedContactId = useAppStore((s: any) => s.setSelectedContactId);
  const setSelectedCompanyId = useAppStore((s: any) => s.setSelectedCompanyId);

  // Data state
  const [company, setCompany] = useState<any>(null);
  const [contacts, setContacts] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [signals, setSignals] = useState<any[]>([]);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [evidence, setEvidence] = useState<any[]>([]);
  const [aiScore, setAiScore] = useState<any>(null);
  const [aiActions, setAiActions] = useState<any>(null);
  const [aiInsights, setAiInsights] = useState<any[]>([]);
  const [aiIntelligence, setAiIntelligence] = useState<any>(null);
  const [suggestedContacts, setSuggestedContacts] = useState<any[]>([]);
  const [brief, setBrief] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadingScore, setLoadingScore] = useState(false);
  const [loadingActions, setLoadingActions] = useState(false);
  const [loadingIntel, setLoadingIntel] = useState(false);
  const [loadingSuggested, setLoadingSuggested] = useState(false);
  const [loadingBrief, setLoadingBrief] = useState(false);
  const [enriching, setEnriching] = useState(false);

  // Edit state
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [noteForm, setNoteForm] = useState({ title: '', body: '', category: 'general' });
  const [savingNote, setSavingNote] = useState(false);

  // View state
  const [activeView, setActiveView] = useState<'intelligence' | 'profile' | 'mindmap' | 'timeline' | 'evidence'>('intelligence');

  /* ── Fetch Company ── */
  const fetchCompany = useCallback(async () => {
    try {
      const res = await fetch(`/api/companies/${companyId}`);
      if (res.ok) {
        const data = await res.json();
        setCompany(data);
        setEditForm({ name: data.rawName || data.name, industry: data.industry || '', sizeRange: data.sizeRange || '', location: data.location || '', country: data.country || '', website: data.website || '', status: data.status || 'prospect', lifecycleStage: data.lifecycleStage || 'discovery', assignedTo: data.assignedTo || '', internalSummary: data.internalSummary || '' });
      }
    } catch (err) { console.error('[AIWorkspace] fetch company failed:', err); }
  }, [companyId]);

  /* ── Fetch Contacts ── */
  const fetchContacts = useCallback(async () => {
    try {
      const res = await fetch(`/api/companies/${companyId}/contacts`);
      if (res.ok) { const data = await res.json(); setContacts(data.contacts || data || []); }
    } catch (err) { console.error('[AIWorkspace] fetch contacts failed:', err); }
  }, [companyId]);

  /* ── Fetch Notes ── */
  const fetchNotes = useCallback(async () => {
    try {
      const res = await fetch(`/api/companies/${companyId}/notes`);
      if (res.ok) { const data = await res.json(); setNotes(data.notes || data || []); }
    } catch (err) { console.error('[AIWorkspace] fetch notes failed:', err); }
  }, [companyId]);

  /* ── Fetch Signals ── */
  const fetchSignals = useCallback(async () => {
    try {
      const res = await fetch(`/api/companies/${companyId}/signals`);
      if (res.ok) { const data = await res.json(); setSignals(data.signals || data || []); }
    } catch (err) { console.error('[AIWorkspace] fetch signals failed:', err); }
  }, [companyId]);

  /* ── Fetch Timeline ── */
  const fetchTimeline = useCallback(async () => {
    try {
      const res = await fetch(`/api/companies/${companyId}/timeline?limit=50`);
      if (res.ok) { const data = await res.json(); setTimeline(data.events || data || []); }
    } catch (err) { console.error('[AIWorkspace] fetch timeline failed:', err); }
  }, [companyId]);

  /* ── Fetch Evidence ── */
  const fetchEvidence = useCallback(async () => {
    try {
      const res = await fetch(`/api/g-crm/companies/${companyId}/evidence?limit=20`);
      if (res.ok) { const data = await res.json(); setEvidence(data.evidence || []); }
    } catch (err) { /* silent */ }
  }, [companyId]);

  /* ── Fetch AI Intelligence ── */
  const fetchIntelligence = useCallback(async () => {
    setLoadingIntel(true);
    try {
      const res = await fetch(`/api/companies/${companyId}/intelligence`);
      if (res.ok) {
        const data = await res.json();
        setAiInsights(data.aiInsights || []);
        setAiIntelligence(data);
      }
    } catch (err) { console.error('[AIWorkspace] fetch intelligence failed:', err); }
    finally { setLoadingIntel(false); }
  }, [companyId]);

  /* ── Fetch AI Score ── */
  const fetchAIScore = useCallback(async () => {
    setLoadingScore(true);
    try {
      const res = await fetch(`/api/companies/${companyId}/score`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ skipNarrative: true }) });
      if (res.ok) { const data = await res.json(); setAiScore(data); }
    } catch (err) { console.error('[AIWorkspace] fetch score failed:', err); }
    finally { setLoadingScore(false); }
  }, [companyId]);

  /* ── Fetch AI Actions ── */
  const fetchAIActions = useCallback(async () => {
    setLoadingActions(true);
    try {
      const res = await fetch(`/api/companies/${companyId}/actions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ skipNarrative: true }) });
      if (res.ok) { const data = await res.json(); setAiActions(data); }
    } catch (err) { console.error('[AIWorkspace] fetch actions failed:', err); }
    finally { setLoadingActions(false); }
  }, [companyId]);

  /* ── Enrich Company ── */
  const handleEnrich = async () => {
    setEnriching(true);
    try {
      const res = await fetch('/api/g-data/jobs/actions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'enqueue-research', companyIds: [companyId], force: true }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Research job queued');
        const pollInterval = setInterval(async () => {
          try {
            const jobRes = await fetch(`/api/g-data/jobs?companyId=${companyId}&type=research&page=1&pageSize=1`);
            const jobData = await jobRes.json();
            const job = (jobData.jobs || [])[0];
            if (job && (job.status === 'completed' || job.status === 'failed')) {
              clearInterval(pollInterval);
              setEnriching(false);
              if (job.status === 'completed') { toast.success('Research completed'); fetchCompany(); }
              else toast.error('Research job failed');
            }
          } catch { /* continue polling */ }
        }, 5000);
      } else { toast.error('Failed to queue research'); setEnriching(false); }
    } catch { toast.error('Failed to queue research'); setEnriching(false); }
  };

  /* ── Save Company Edit ── */
  const saveCompany = async () => {
    try {
      const res = await fetch(`/api/companies/${companyId}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editForm) });
      if (res.ok) { setIsEditing(false); toast.success('Company updated'); fetchCompany(); }
    } catch { toast.error('Failed to update company'); }
  };

  /* ── Save Note ── */
  const saveNote = async () => {
    if (!noteForm.body.trim()) return;
    setSavingNote(true);
    try {
      const res = await fetch(`/api/companies/${companyId}/notes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(noteForm) });
      if (res.ok) toast.success('Note created');
      setNoteDialogOpen(false);
      setNoteForm({ title: '', body: '', category: 'general' });
      fetchNotes();
    } catch { toast.error('Failed to save note'); }
    setSavingNote(false);
  };

  /* ── Initial Load ── */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      await Promise.all([fetchCompany(), fetchContacts(), fetchNotes(), fetchSignals(), fetchTimeline(), fetchEvidence()]);
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [fetchCompany, fetchContacts, fetchNotes, fetchSignals, fetchTimeline, fetchEvidence]);

  /* ── Auto-trigger Intelligence on mount ── */
  useEffect(() => {
    if (!loading && !aiInsights.length && !loadingIntel) fetchIntelligence();
  }, [loading]); // eslint-disable-line

  /* ── Auto-trigger Score ── */
  useEffect(() => {
    if (!loading && !aiScore && !loadingScore) fetchAIScore();
  }, [loading]); // eslint-disable-line

  /* ── Auto-trigger Actions ── */
  useEffect(() => {
    if (!loading && !aiActions && !loadingActions) fetchAIActions();
  }, [loading]); // eslint-disable-line

  /* ── Parse helpers ── */
  const parseTags = (t: string | null) => { if (!t) return []; try { return JSON.parse(t); } catch { return []; } };
  const parseTechStack = (t: string | null) => { if (!t) return []; try { const p = JSON.parse(t); return Array.isArray(p) ? p : String(t).split(',').map(s => s.trim()).filter(Boolean); } catch { return String(t || '').split(',').map(s => s.trim()).filter(Boolean); } };
  const tags = parseTags(company?.tags);
  const techStack = parseTechStack(company?.researchCard?.techStack);
  const researchCard = company?.researchCard;

  /* ═══════════════════════════════════════════════════
     Loading State
     ═══════════════════════════════════════════════════ */
  if (loading) {
    return (
      <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
        <div className="flex items-center gap-4"><Skeleton className="w-8 h-8 rounded-lg" /><Skeleton className="h-8 w-64" /></div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="h-80 rounded-xl" /><Skeleton className="h-80 rounded-xl col-span-2" />
        </div>
      </div>
    );
  }

  const companyName = company?.rawName || company?.name || 'Unknown';

  /* ═══════════════════════════════════════════════════
     Render — AI Account Intelligence Workspace
     ═══════════════════════════════════════════════════ */
  return (
    <div className="min-h-screen bg-gray-50">
      <PageTransition>
        {/* ── Top Navigation Bar ── */}
        <div className="sticky top-0 z-30 border-b border-gray-200" style={{ background: 'rgba(6,9,15,0.88)', backdropFilter: 'blur(20px)' }}>
          <div className="flex items-center justify-between max-w-[1600px] mx-auto px-5 py-3">
            <div className="flex items-center gap-3">
              <motion.button whileHover={{ x: -2 }} whileTap={{ scale: 0.95 }} onClick={onBack}
                className="w-8 h-8 rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center hover:border-blue-500/30 transition-colors">
                <ArrowLeft size={15} className="text-muted-foreground" />
              </motion.button>
              <div className="flex items-center gap-2">
                <Building2 size={18} style={{ color: INTEL }} />
                <span className="text-sm font-bold text-white">{companyName}</span>
                <Badge className="text-[10px] px-1.5 py-0">{(company?.status || 'prospect').replace(/_/g, ' ')}</Badge>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={handleEnrich} disabled={enriching}
                className="gap-1.5 h-8 text-[11px] bg-blue-600 hover:bg-blue-700 text-white">
                {enriching ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                {enriching ? 'Enriching...' : 'AI Enrich'}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setIsEditing(!isEditing)}
                className="gap-1.5 h-8 text-[11px] border-gray-600 text-gray-300 hover:text-white">
                {isEditing ? <X size={12} /> : <Edit3 size={12} />}
                {isEditing ? 'Cancel' : 'Edit'}
              </Button>
              {isEditing && (
                <Button size="sm" onClick={saveCompany} className="gap-1.5 h-8 text-[11px]" style={{ background: GOLD, color: '#060910' }}>
                  <Save size={12} /> Save
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="max-w-[1600px] mx-auto px-5 py-5">
          {/* ── Intelligence Hero ── */}
          <IntelligenceHero
            company={company}
            aiScore={aiScore}
            aiActions={aiActions}
            signalCount={signals.length}
            contactCount={contacts.length}
            oppCount={company?._count?.opportunities || company?.opportunities?.length || 0}
            loadingScore={loadingScore}
            onRefreshScore={fetchAIScore}
            onRefreshActions={fetchAIActions}
            onNavigateActions={() => setActiveView('intelligence')}
          />

          {/* ── View Switcher ── */}
          <div className="mt-5 flex items-center gap-1 p-1 bg-gray-100 rounded-xl border border-gray-200 w-fit">
            {[
              { key: 'intelligence' as const, label: 'AI Intelligence', icon: Brain },
              { key: 'profile' as const, label: 'Company Profile', icon: Building2 },
              { key: 'mindmap' as const, label: 'Mind Map', icon: Network },
              { key: 'timeline' as const, label: 'Activity Timeline', icon: Clock },
              { key: 'evidence' as const, label: 'Evidence Sources', icon: Database },
            ].map(v => (
              <button key={v.key}
                onClick={() => setActiveView(v.key)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium transition-all ${
                  activeView === v.key
                    ? 'bg-white text-blue-600 shadow-sm border border-gray-200'
                    : 'text-muted-foreground hover:text-foreground hover:bg-gray-50 border border-transparent'
                }`}
              >
                <v.icon size={13} /> {v.label}
              </button>
            ))}
          </div>

          {/* ═════════════════════════════════════════════
              VIEW: AI Intelligence (Default)
              ═════════════════════════════════════════════ */}
          {activeView === 'intelligence' && (
            <div className="mt-5 grid grid-cols-1 lg:grid-cols-3 gap-5">
              {/* LEFT COLUMN — Signals + Contacts */}
              <div className="space-y-5">
                {/* AI Signals */}
                <SectionPanel title="Active Signals" icon={Bell} accent="#ea580c" count={signals.length} onRefresh={fetchSignals}>
                  {signals.length === 0 ? (
                    <div className="text-center py-6 text-muted-foreground">
                      <Bell size={24} className="mx-auto mb-2 opacity-30" />
                      <p className="text-xs">No active signals detected</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {signals.slice(0, 8).map((s: any) => (
                        <SignalCard key={s.id} signal={s} onToggleRead={() => {
                          setSignals(prev => prev.map(sig => sig.id === s.id ? { ...sig, isRead: !sig.isRead } : sig));
                        }} />
                      ))}
                    </div>
                  )}
                </SectionPanel>

                {/* Key Contacts */}
                <SectionPanel title="Key Contacts" icon={Users} accent="#7c3aed" count={contacts.length} onRefresh={fetchContacts}>
                  {contacts.length === 0 ? (
                    <div className="text-center py-6 text-muted-foreground">
                      <Users size={24} className="mx-auto mb-2 opacity-30" />
                      <p className="text-xs">No contacts added yet</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {contacts.slice(0, 10).map((c: any) => (
                        <ContactMiniCard key={c.id} contact={c} onSelect={() => {
                          setSelectedContactId(c.id);
                          navigateTo?.('contact-detail');
                        }} />
                      ))}
                    </div>
                  )}
                </SectionPanel>

                {/* Add Note */}
                <Button variant="outline" className="w-full gap-2 h-9 text-xs border-dashed" onClick={() => setNoteDialogOpen(true)}>
                  <Plus size={13} /> Add Research Note
                </Button>
              </div>

              {/* CENTER COLUMN — AI Insights + Actions */}
              <div className="space-y-5">
                {/* AI Intelligence Insights */}
                <SectionPanel title="AI Intelligence Insights" icon={Brain} accent={INTEL} onRefresh={fetchIntelligence}>
                  {loadingIntel ? (
                    <div className="flex flex-col items-center py-8 gap-3">
                      <Loader2 size={24} className="animate-spin text-blue-500" />
                      <p className="text-xs text-muted-foreground">Analyzing intelligence...</p>
                    </div>
                  ) : aiInsights.length > 0 ? (
                    <div className="space-y-3">
                      {aiInsights.slice(0, 6).map((insight: any, i: number) => (
                        <IntelInsightItem key={i} insight={insight} index={i} />
                      ))}
                    </div>
                  ) : aiIntelligence ? (
                    <div className="text-center py-6 text-muted-foreground">
                      <Brain size={24} className="mx-auto mb-2 opacity-30" />
                      <p className="text-xs">No AI insights available. Run Intelligence to generate.</p>
                    </div>
                  ) : (
                    <div className="text-center py-6 text-muted-foreground">
                      <Sparkles size={24} className="mx-auto mb-2 opacity-30" />
                      <p className="text-xs">Click "Run Intelligence" to generate AI insights</p>
                    </div>
                  )}
                </SectionPanel>

                {/* AI Action Recommendations */}
                <SectionPanel title="AI Action Recommendations" icon={Zap} accent="#d97706" onRefresh={fetchAIActions}>
                  {loadingActions ? (
                    <div className="flex flex-col items-center py-8 gap-3">
                      <Loader2 size={24} className="animate-spin text-amber-500" />
                      <p className="text-xs text-muted-foreground">Generating actions...</p>
                    </div>
                  ) : aiActions?.actions?.length > 0 ? (
                    <div className="space-y-3">
                      {aiActions.actions.slice(0, 5).map((action: any, i: number) => (
                        <ActionCard key={i} action={action} index={i} />
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6 text-muted-foreground">
                      <Zap size={24} className="mx-auto mb-2 opacity-30" />
                      <p className="text-xs">No actions generated. Click "Generate Actions" to start.</p>
                    </div>
                  )}
                </SectionPanel>
              </div>

              {/* RIGHT COLUMN — Score Breakdown + Evidence + Notes */}
              <div className="space-y-5">
                {/* Score Breakdown */}
                {aiScore && (
                  <SectionPanel title="Score Breakdown" icon={Target} accent="#059669">
                    <div className="space-y-2.5">
                      {aiScore.factors?.sort((a: any, b: any) => b.points - a.points).slice(0, 8).map((factor: any, i: number) => (
                        <div key={i} className="flex items-center gap-2">
                          <div className={`w-8 text-center text-xs font-bold ${factor.points > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                            {factor.points > 0 ? '+' : ''}{factor.points}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-0.5">
                              <span className="text-[11px] font-medium">{factor.label}</span>
                              <span className="text-[10px] text-muted-foreground">{factor.maxPoints} max</span>
                            </div>
                            <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <motion.div
                                className={`h-full rounded-full ${factor.points > 0 ? 'bg-emerald-500' : 'bg-red-400'}`}
                                initial={{ width: 0 }}
                                animate={{ width: `${Math.min(100, Math.abs(factor.points) / factor.maxPoints * 100)}%` }}
                                transition={{ duration: 0.8 }}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    {aiScore.narrative && (
                      <div className="mt-3 p-3 rounded-lg bg-blue-50/50 border border-blue-100">
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <Sparkles size={11} className="text-blue-600" />
                          <span className="text-[10px] font-semibold text-blue-600 uppercase tracking-wider">AI Analysis</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground leading-relaxed">{aiScore.narrative}</p>
                      </div>
                    )}
                  </SectionPanel>
                )}

                {/* Evidence Sources */}
                <SectionPanel title="Evidence Sources" icon={Database} accent="#7c3aed" count={evidence.length} onRefresh={fetchEvidence} collapsible>
                  {evidence.length === 0 ? (
                    <div className="text-center py-4 text-muted-foreground">
                      <Database size={20} className="mx-auto mb-2 opacity-30" />
                      <p className="text-[11px]">No evidence sources yet</p>
                    </div>
                  ) : (
                    <div className="space-y-0.5 max-h-64 overflow-y-auto">
                      {evidence.slice(0, 10).map((e: any) => <EvidenceRow key={e.id} evidence={e} />)}
                    </div>
                  )}
                </SectionPanel>

                {/* Recent Notes */}
                <SectionPanel title="Research Notes" icon={FileText} accent="#3b82f6" count={notes.length} onRefresh={fetchNotes} collapsible>
                  {notes.length === 0 ? (
                    <div className="text-center py-4 text-muted-foreground">
                      <FileText size={20} className="mx-auto mb-2 opacity-30" />
                      <p className="text-[11px]">No notes yet</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {notes.slice(0, 5).map((note: any) => (
                        <div key={note.id} className="p-2.5 rounded-lg bg-gray-50 border border-gray-100">
                          <p className="text-[11px] text-foreground/80 line-clamp-3">{note.body}</p>
                          <div className="flex items-center gap-2 mt-1.5">
                            <Badge className="text-[9px] px-1 py-0 bg-gray-100 text-muted-foreground">{note.noteType || 'note'}</Badge>
                            <span className="text-[10px] text-muted-foreground">{new Date(note.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </SectionPanel>
              </div>
            </div>
          )}

          {/* ═════════════════════════════════════════════
              VIEW: Company Profile
              ═════════════════════════════════════════════ */}
          {activeView === 'profile' && (
            <div className="mt-5 grid grid-cols-1 lg:grid-cols-3 gap-5">
              <div className="space-y-5">
                <SectionPanel title="Company Profile" icon={Building2} accent={INTEL}>
                  {isEditing ? (
                    <div className="space-y-3">
                      {['name', 'industry', 'sizeRange', 'location', 'country', 'website'].map(field => (
                        <div key={field}>
                          <label className="text-[10px] text-muted-foreground uppercase tracking-wider">{field.replace(/([A-Z])/g, ' $1')}</label>
                          <Input value={editForm[field] || ''} onChange={e => setEditForm(p => ({ ...p, [field]: e.target.value }))} className="mt-1 h-8 text-xs bg-gray-50 border-gray-200" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {[
                        { icon: Briefcase, label: 'Industry', value: company?.industry },
                        { icon: Users, label: 'Size', value: company?.sizeRange },
                        { icon: MapPin, label: 'Location', value: [company?.location, company?.country].filter(Boolean).join(', ') || null },
                        { icon: Globe, label: 'Website', value: company?.website, link: true },
                        { icon: Activity, label: 'Lifecycle', value: company?.lifecycleStage },
                        { icon: UserCircle, label: 'Assigned', value: company?.assignedTo },
                      ].map(item => item.value ? (
                        <div key={item.label} className="flex items-center gap-2 text-xs">
                          <item.icon size={12} className="text-muted-foreground shrink-0" />
                          <span className="text-muted-foreground">{item.label}:</span>
                          {item.link ? (
                            <a href={item.value.startsWith('http') ? item.value : `https://${item.value}`} target="_blank" rel="noopener noreferrer" className="font-medium hover:underline" style={{ color: INTEL }}>{item.value}</a>
                          ) : (
                            <span className="text-foreground font-medium">{item.value}</span>
                          )}
                        </div>
                      ) : null)}
                      {tags.length > 0 && (
                        <div className="pt-2 flex flex-wrap gap-1.5">
                          {tags.map((tag: string, i: number) => (
                            <Badge key={i} variant="outline" className="text-[10px] px-2 py-0">{tag}</Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </SectionPanel>
              </div>
              <div className="lg:col-span-2">
                <SectionPanel title="Research Intelligence" icon={BookOpen} accent="#059669">
                  {!researchCard ? (
                    <div className="text-center py-10">
                      <BookOpen size={32} className="mx-auto mb-3 text-muted-foreground/30" />
                      <p className="text-sm text-muted-foreground mb-3">No research data available</p>
                      <Button size="sm" onClick={handleEnrich} disabled={enriching} className="gap-2 text-xs bg-blue-600 text-white">
                        {enriching ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                        Enrich Now
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {researchCard.businessOverview && (
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Business Overview</p>
                          <p className="text-xs text-foreground/70 leading-relaxed bg-gray-50 rounded-lg p-3 border border-gray-100">{researchCard.businessOverview}</p>
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-4">
                        {researchCard.techLandscape && (
                          <div>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Tech Landscape</p>
                            <p className="text-xs text-foreground/70 leading-relaxed bg-gray-50 rounded-lg p-3 border border-gray-100">{researchCard.techLandscape}</p>
                          </div>
                        )}
                        {researchCard.potentialChallenges && (
                          <div>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Challenges</p>
                            <p className="text-xs text-foreground/70 leading-relaxed bg-gray-50 rounded-lg p-3 border border-gray-100">{researchCard.potentialChallenges}</p>
                          </div>
                        )}
                        {researchCard.possibleOpportunities && (
                          <div>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Opportunities</p>
                            <p className="text-xs text-foreground/70 leading-relaxed bg-gray-50 rounded-lg p-3 border border-gray-100">{researchCard.possibleOpportunities}</p>
                          </div>
                        )}
                        {researchCard.relevantServices && (
                          <div>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Relevant Services</p>
                            <p className="text-xs text-foreground/70 leading-relaxed bg-gray-50 rounded-lg p-3 border border-gray-100">{researchCard.relevantServices}</p>
                          </div>
                        )}
                      </div>
                      {researchCard.keyDecisionMakers && (
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Key Decision Makers</p>
                          <p className="text-xs text-foreground/70 leading-relaxed bg-gray-50 rounded-lg p-3 border border-gray-100">{researchCard.keyDecisionMakers}</p>
                        </div>
                      )}
                      {techStack.length > 0 && (
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">Tech Stack</p>
                          <div className="flex flex-wrap gap-1.5">
                            {techStack.map((tech: string, i: number) => (
                              <Badge key={i} variant="outline" className="text-[10px] px-2 py-0 border-blue-200 text-blue-600">{tech}</Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </SectionPanel>
              </div>
            </div>
          )}

          {/* ═════════════════════════════════════════════
              VIEW: Mind Map
              ═════════════════════════════════════════════ */}
          {activeView === 'mindmap' && (
            <div className="mt-5">
              <SectionPanel title="Relationship Mind Map" icon={Network} accent={INTEL}>
                <CompanyMindMap company={company} contacts={contacts} notes={notes} signals={signals} researchCard={company?.researchCard} />
              </SectionPanel>
            </div>
          )}

          {/* ═════════════════════════════════════════════
              VIEW: Activity Timeline
              ═════════════════════════════════════════════ */}
          {activeView === 'timeline' && (
            <div className="mt-5">
              <SectionPanel title="Activity Timeline" icon={Clock} accent="#3b82f6" count={timeline.length} onRefresh={fetchTimeline}>
                {timeline.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground">
                    <Clock size={32} className="mx-auto mb-3 opacity-30" />
                    <p className="text-xs">No activity recorded yet</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[500px] overflow-y-auto">
                    {timeline.map((entry: any) => <TimelineItem key={entry.id} entry={entry} />)}
                  </div>
                )}
              </SectionPanel>
            </div>
          )}

          {/* ═════════════════════════════════════════════
              VIEW: Evidence Sources
              ═════════════════════════════════════════════ */}
          {activeView === 'evidence' && (
            <div className="mt-5">
              <SectionPanel title="Evidence Sources" icon={Database} accent="#7c3aed" count={evidence.length} onRefresh={fetchEvidence}>
                {evidence.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground">
                    <Database size={32} className="mx-auto mb-3 opacity-30" />
                    <p className="text-sm">No evidence sources collected</p>
                    <p className="text-xs mt-1">Run AI Enrich to gather evidence from web sources</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {evidence.map((e: any) => (
                      <a key={e.id} href={e.sourceUrl} target="_blank" rel="noopener noreferrer"
                        className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors group">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-gray-100 shrink-0">
                          <FileText size={13} className="text-gray-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-foreground/80 group-hover:text-blue-600 transition-colors truncate">{e.sourceTitle || e.snippet || 'Evidence'}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <EvidenceBadge source={e.sourceType || 'web'} />
                            {e.confidence > 0 && <span className="text-[10px] text-muted-foreground tabular-nums">{Math.round(e.confidence * 100)}%</span>}
                            <span className="text-[10px] text-muted-foreground">{e.sourceName || ''}</span>
                          </div>
                          {e.snippet && (
                            <p className="text-[11px] text-muted-foreground line-clamp-2 mt-1">{e.snippet}</p>
                          )}
                        </div>
                        <ExternalLink size={12} className="text-gray-400 opacity-0 group-hover:opacity-100 shrink-0 mt-1" />
                      </a>
                    ))}
                  </div>
                )}
              </SectionPanel>
            </div>
          )}
        </div>
      </PageTransition>

      {/* ── Note Dialog ── */}
      <Dialog open={noteDialogOpen} onOpenChange={setNoteDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold">Add Research Note</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Note title (optional)"
              value={noteForm.title}
              onChange={e => setNoteForm(p => ({ ...p, title: e.target.value }))}
              className="h-9 text-xs"
            />
            <Textarea
              placeholder="Research notes, observations, findings..."
              value={noteForm.body}
              onChange={e => setNoteForm(p => ({ ...p, body: e.target.value }))}
              className="text-xs min-h-[120px]"
            />
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={saveNote} disabled={savingNote || !noteForm.body.trim()}
                className="gap-1.5 h-8 text-xs bg-blue-600 text-white">
                {savingNote ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                Save Note
              </Button>
              <Button size="sm" variant="outline" onClick={() => setNoteDialogOpen(false)} className="h-8 text-xs">Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
