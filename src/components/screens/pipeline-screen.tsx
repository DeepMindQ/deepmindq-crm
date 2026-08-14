'use client';

import { useState, useMemo, useCallback } from 'react';
import { tokens, spacing, radius, typography, elevation, getConfidenceTier } from '@/components/intelligence-os/design-tokens';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import {
  DollarSign,
  TrendingUp,
  BarChart3,
  CalendarDays,
  Search,
  X,
  Building2,
  User,
  Clock,
  BrainCircuit,
  ArrowRight,
  ChevronDown,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Target,
  Zap,
  Globe,
  Users,
  FileText,
  Shield,
  Activity,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { motion, AnimatePresence } from 'framer-motion';

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

type StageKey = 'prospecting' | 'qualification' | 'proposal' | 'negotiation' | 'closed_won' | 'closed_lost';

interface IntelligenceSignal {
  id: string;
  type: 'opportunity' | 'risk' | 'enrichment' | 'action';
  icon: LucideIcon;
  label: string;
  description: string;
 detectedAt: string;
  confidence: number;
}

interface Deal {
  id: string;
  company: string;
  companyLogo: string;
  contact: string;
  contactTitle: string;
  contactEmail: string;
  value: number;
  stage: StageKey;
  daysInStage: number;
  intelligenceScore: number;
  industry: string;
  employees: string;
  createdAt: string;
  lastActivity: string;
  nextStep: string;
  owner: string;
  source: string;
  probability: number;
  signals: IntelligenceSignal[];
  notes: string;
}

// ═══════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════

const STAGES: { key: StageKey; label: string; color: string; bg: string; border: string; icon: LucideIcon; probability: number }[] = [
  { key: 'prospecting', label: 'Prospecting', color: '#8B5CF6', bg: 'rgba(139,92,246,0.08)', border: 'rgba(139,92,246,0.25)', icon: Search, probability: 0.1 },
  { key: 'qualification', label: 'Qualification', color: '#3B82F6', bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.25)', icon: Target, probability: 0.25 },
  { key: 'proposal', label: 'Proposal', color: '#F59E0B', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.25)', icon: FileText, probability: 0.5 },
  { key: 'negotiation', label: 'Negotiation', color: '#F97316', bg: 'rgba(249,115,22,0.08)', border: 'rgba(249,115,22,0.25)', icon: Activity, probability: 0.75 },
  { key: 'closed_won', label: 'Closed Won', color: '#10B981', bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.25)', icon: CheckCircle2, probability: 1.0 },
  { key: 'closed_lost', label: 'Closed Lost', color: '#EF4444', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.25)', icon: XCircle, probability: 0 },
];

const SIGNAL_TYPE_STYLES: Record<string, { color: string; bg: string; border: string }> = {
  opportunity: { color: tokens.domain.opportunity, bg: 'rgba(5,150,105,0.08)', border: 'rgba(5,150,105,0.2)' },
  risk: { color: tokens.domain.risk, bg: 'rgba(220,38,38,0.08)', border: 'rgba(220,38,38,0.2)' },
  enrichment: { color: tokens.domain.enrichment, bg: 'rgba(217,119,6,0.08)', border: 'rgba(217,119,6,0.2)' },
  action: { color: tokens.domain.action, bg: 'rgba(37,99,235,0.08)', border: 'rgba(37,99,235,0.2)' },
};

// ═══════════════════════════════════════════════════════════════
// MOCK DATA
// ═══════════════════════════════════════════════════════════════

const MOCK_DEALS: Deal[] = [
  {
    id: 'd-001', company: 'Meridian Technologies', companyLogo: 'MT', contact: 'Sarah Chen', contactTitle: 'VP of Engineering', contactEmail: 'sarah.chen@meridiantech.io', value: 285000, stage: 'negotiation', daysInStage: 8, intelligenceScore: 92, industry: 'Enterprise SaaS', employees: '500-1,000', createdAt: '2024-11-15', lastActivity: '2 hours ago', nextStep: 'Final pricing review with CFO', owner: 'Alex Rivera', source: 'Outbound', probability: 0.75,
    signals: [
      { id: 's1', type: 'opportunity', icon: TrendingUp, label: 'Series C Funding', description: 'Raised $45M Series C led by Sequoia Capital. Expansion budget likely.', detectedAt: '3 days ago', confidence: 95 },
      { id: 's2', type: 'enrichment', icon: Users, label: 'Hiring Surge', description: '12 new engineering roles posted in last 2 weeks. Scaling infrastructure.', detectedAt: '1 week ago', confidence: 88 },
      { id: 's3', type: 'action', icon: Zap, label: 'Contract Renewal', description: 'Current vendor contract expires in 45 days. Decision window open.', detectedAt: '5 days ago', confidence: 91 },
    ],
    notes: 'Strong champion in Sarah. CFO approval is the remaining gate. Competitive deal from incumbent vendor.',
  },
  {
    id: 'd-002', company: 'Apex Financial Group', companyLogo: 'AF', contact: 'Michael Torres', contactTitle: 'CTO', contactEmail: 'm.torres@apexfin.com', value: 520000, stage: 'proposal', daysInStage: 14, intelligenceScore: 87, industry: 'Financial Services', employees: '2,000-5,000', createdAt: '2024-10-28', lastActivity: '1 day ago', nextStep: 'Present technical architecture to security team', owner: 'Jordan Kim', source: 'Referral', probability: 0.5,
    signals: [
      { id: 's4', type: 'opportunity', icon: Globe, label: 'Global Expansion', description: 'Opening offices in London and Singapore. Need unified platform.', detectedAt: '1 week ago', confidence: 82 },
      { id: 's5', type: 'risk', icon: AlertTriangle, label: 'Security Audit', description: 'Upcoming SOC 2 audit may delay procurement. Engage early.', detectedAt: '4 days ago', confidence: 76 },
    ],
    notes: 'Long sales cycle expected due to compliance. Michael is technical buyer. Need to involve security team early.',
  },
  {
    id: 'd-003', company: 'NovaCare Health', companyLogo: 'NC', contact: 'Dr. Priya Sharma', contactTitle: 'Chief Innovation Officer', contactEmail: 'p.sharma@novacare.health', value: 178000, stage: 'qualification', daysInStage: 21, intelligenceScore: 74, industry: 'Healthcare', employees: '1,000-2,000', createdAt: '2024-11-02', lastActivity: '3 days ago', nextStep: 'Schedule demo with clinical team', owner: 'Alex Rivera', source: 'Inbound', probability: 0.25,
    signals: [
      { id: 's6', type: 'opportunity', icon: FileText, label: 'Regulatory Change', description: 'New CMS interoperability mandate requires platform upgrade.', detectedAt: '2 weeks ago', confidence: 90 },
      { id: 's7', type: 'enrichment', icon: Shield, label: 'HIPAA Compliance', description: 'Recently achieved HITRUST certification. Serious about security posture.', detectedAt: '3 weeks ago', confidence: 85 },
    ],
    notes: 'Healthcare vertical with strict compliance requirements. Long evaluation cycle but high LTV.',
  },
  {
    id: 'd-004', company: 'Stratos Cloud', companyLogo: 'SC', contact: 'James Mitchell', contactTitle: 'Head of Infrastructure', contactEmail: 'j.mitchell@stratoscloud.dev', value: 340000, stage: 'negotiation', daysInStage: 5, intelligenceScore: 89, industry: 'Cloud Infrastructure', employees: '200-500', createdAt: '2024-11-20', lastActivity: '6 hours ago', nextStep: 'Legal review of MSA terms', owner: 'Morgan Lee', source: 'Partner', probability: 0.75,
    signals: [
      { id: 's8', type: 'opportunity', icon: TrendingUp, label: 'Revenue Growth', description: 'Q3 revenue up 67% YoY. Investing heavily in platform reliability.', detectedAt: '1 week ago', confidence: 93 },
      { id: 's9', type: 'action', icon: Zap, label: 'Tech Stack Migration', description: 'Moving from legacy monitoring. Decision expected by month end.', detectedAt: '2 days ago', confidence: 88 },
    ],
    notes: 'Fast-moving team. James has budget authority. Partner intro from AWS gave us credibility.',
  },
  {
    id: 'd-005', company: 'Pinnacle Retail', companyLogo: 'PR', contact: 'Lisa Wang', contactTitle: 'SVP Digital', contactEmail: 'l.wang@pinnacleretail.com', value: 195000, stage: 'prospecting', daysInStage: 3, intelligenceScore: 68, industry: 'Retail & E-commerce', employees: '5,000-10,000', createdAt: '2024-12-01', lastActivity: '1 day ago', nextStep: 'Send personalized outreach with industry case study', owner: 'Jordan Kim', source: 'Outbound', probability: 0.1,
    signals: [
      { id: 's10', type: 'enrichment', icon: Globe, label: 'Omnichannel Push', description: 'Announced $20M investment in unified commerce platform.', detectedAt: '5 days ago', confidence: 79 },
    ],
    notes: 'Early stage. Large company with complex buying committee. Need to map stakeholders.',
  },
  {
    id: 'd-006', company: 'Quantum Dynamics', companyLogo: 'QD', contact: 'Robert Blake', contactTitle: 'CEO', contactEmail: 'r.blake@quantumdynamics.ai', value: 420000, stage: 'closed_won', daysInStage: 0, intelligenceScore: 95, industry: 'AI / Machine Learning', employees: '50-200', createdAt: '2024-09-10', lastActivity: '2 days ago', nextStep: 'Onboarding kickoff - Jan 6', owner: 'Morgan Lee', source: 'Conference', probability: 1.0,
    signals: [
      { id: 's11', type: 'opportunity', icon: Sparkles, label: 'AI Adoption Leader', description: 'Recognized as top 50 AI companies by Forbes. Fast-growing.', detectedAt: '1 month ago', confidence: 97 },
      { id: 's12', type: 'opportunity', icon: Users, label: 'Team Expansion', description: 'Doubled engineering team in 6 months. Need scalable tooling.', detectedAt: '2 weeks ago', confidence: 92 },
    ],
    notes: 'Signed 2-year enterprise deal. Robert was champion from day one. Strong reference potential.',
  },
  {
    id: 'd-007', company: 'Ironclad Security', companyLogo: 'IS', contact: 'Amanda Foster', contactTitle: 'Director of Product', contactEmail: 'a.foster@ironcladsec.io', value: 156000, stage: 'proposal', daysInStage: 10, intelligenceScore: 81, industry: 'Cybersecurity', employees: '100-250', createdAt: '2024-11-08', lastActivity: '4 days ago', nextStep: 'Technical POC with engineering team', owner: 'Alex Rivera', source: 'Inbound', probability: 0.5,
    signals: [
      { id: 's13', type: 'opportunity', icon: Shield, label: 'SOC 2 Certification', description: 'Pursuing SOC 2 Type II. Needs audit-ready documentation.', detectedAt: '1 week ago', confidence: 86 },
      { id: 's14', type: 'action', icon: Zap, label: 'Product Launch', description: 'New enterprise tier launching Q1. Needs integration testing.', detectedAt: '3 days ago', confidence: 80 },
    ],
    notes: 'Technical evaluation in progress. Amanda is the decision maker. POC scheduled for next week.',
  },
  {
    id: 'd-008', company: 'Vertex Logistics', companyLogo: 'VL', contact: 'David Park', contactTitle: 'VP Operations', contactEmail: 'd.park@vertexlogistics.com', value: 310000, stage: 'qualification', daysInStage: 16, intelligenceScore: 72, industry: 'Logistics & Supply Chain', employees: '2,000-5,000', createdAt: '2024-11-12', lastActivity: '5 days ago', nextStep: 'Discovery call with IT leadership', owner: 'Jordan Kim', source: 'Outbound', probability: 0.25,
    signals: [
      { id: 's15', type: 'risk', icon: AlertTriangle, label: 'Budget Freeze', description: 'Q4 budget freeze may delay decision to Q1. Nurture relationship.', detectedAt: '6 days ago', confidence: 72 },
      { id: 's16', type: 'enrichment', icon: Globe, label: 'Acquisition Target', description: 'Rumored acquisition by larger logistics firm. May accelerate or kill deal.', detectedAt: '1 week ago', confidence: 55 },
    ],
    notes: 'Large opportunity but high uncertainty due to potential acquisition. Keep warm but don\'t over-invest.',
  },
  {
    id: 'd-009', company: 'BrightPath Education', companyLogo: 'BE', contact: 'Karen Nguyen', contactTitle: 'CTO', contactEmail: 'k.nguyen@brightpath.edu', value: 98000, stage: 'prospecting', daysInStage: 7, intelligenceScore: 63, industry: 'EdTech', employees: '200-500', createdAt: '2024-11-28', lastActivity: '2 days ago', nextStep: 'Follow up on initial interest email', owner: 'Morgan Lee', source: 'Content', probability: 0.1,
    signals: [
      { id: 's17', type: 'opportunity', icon: TrendingUp, label: 'Enrollment Growth', description: 'Student enrollment up 40% YoY. Platform strain likely.', detectedAt: '4 days ago', confidence: 74 },
    ],
    notes: 'Smaller deal size but good expansion potential. Karen engaged with our blog content.',
  },
  {
    id: 'd-010', company: 'Atlas Manufacturing', companyLogo: 'AM', contact: 'Frank Rodriguez', contactTitle: 'Director of IT', contactEmail: 'f.rodriguez@atlasmfg.com', value: 265000, stage: 'closed_lost', daysInStage: 0, intelligenceScore: 58, industry: 'Manufacturing', employees: '5,000-10,000', createdAt: '2024-08-15', lastActivity: '3 weeks ago', nextStep: 'Re-engage in Q2 after vendor evaluation', owner: 'Alex Rivera', source: 'Trade Show', probability: 0,
    signals: [
      { id: 's18', type: 'risk', icon: XCircle, label: 'Competitor Win', description: 'Selected incumbent vendor for renewal. Cited pricing concerns.', detectedAt: '3 weeks ago', confidence: 90 },
    ],
    notes: 'Lost to incumbent on price. Frank expressed interest in re-evaluating after current contract. Set reminder for Q2.',
  },
  {
    id: 'd-011', company: 'Cipher Analytics', companyLogo: 'CA', contact: 'Nina Patel', contactTitle: 'Head of Data', contactEmail: 'n.patel@cipheranalytics.io', value: 385000, stage: 'proposal', daysInStage: 6, intelligenceScore: 86, industry: 'Data & Analytics', employees: '100-250', createdAt: '2024-11-22', lastActivity: '12 hours ago', nextStep: 'Custom demo with data engineering team', owner: 'Morgan Lee', source: 'Partner', probability: 0.5,
    signals: [
      { id: 's19', type: 'opportunity', icon: TrendingUp, label: 'Data Platform Rebuild', description: 'Publicly stated they are rebuilding data infrastructure from scratch.', detectedAt: '1 week ago', confidence: 91 },
      { id: 's20', type: 'opportunity', icon: Users, label: 'Senior Hire', description: 'Hired former Databricks architect as Principal Engineer. Signal of intent.', detectedAt: '4 days ago', confidence: 84 },
    ],
    notes: 'High-intent buyer. Nina has clear requirements and budget. Strong technical fit.',
  },
  {
    id: 'd-012', company: 'Greenfield Energy', companyLogo: 'GE', contact: 'Thomas Wright', contactTitle: 'VP Technology', contactEmail: 't.wright@greenfieldenergy.com', value: 445000, stage: 'negotiation', daysInStage: 12, intelligenceScore: 83, industry: 'Clean Energy', employees: '500-1,000', createdAt: '2024-10-15', lastActivity: '1 day ago', nextStep: 'Executive sponsorship meeting with CEO', owner: 'Jordan Kim', source: 'Referral', probability: 0.75,
    signals: [
      { id: 's21', type: 'opportunity', icon: Globe, label: 'Government Contracts', description: 'Won 3 federal clean energy contracts. Compliance requirements driving platform needs.', detectedAt: '2 weeks ago', confidence: 87 },
      { id: 's22', type: 'enrichment', icon: Shield, label: 'FedRAMP Pursuit', description: 'Beginning FedRAMP authorization process. Security platform critical path.', detectedAt: '1 week ago', confidence: 80 },
      { id: 's23', type: 'action', icon: Zap, label: 'Board Meeting', description: 'Board meeting Dec 15 to approve technology spend. Timing sensitive.', detectedAt: '3 days ago', confidence: 93 },
    ],
    notes: 'High-value deal with regulatory tailwinds. Thomas is our champion. CEO meeting is the key milestone.',
  },
  {
    id: 'd-013', company: 'Nomad Digital', companyLogo: 'ND', contact: 'Sophia Martinez', contactTitle: 'COO', contactEmail: 's.martinez@nomaddigital.co', value: 142000, stage: 'prospecting', daysInStage: 5, intelligenceScore: 65, industry: 'Digital Agency', employees: '50-200', createdAt: '2024-12-03', lastActivity: '1 day ago', nextStep: 'Intro call scheduled for next Tuesday', owner: 'Alex Rivera', source: 'LinkedIn', probability: 0.1,
    signals: [
      { id: 's24', type: 'enrichment', icon: Users, label: 'Client Growth', description: 'Onboarded 8 new enterprise clients in Q3. Outgrowing current tools.', detectedAt: '6 days ago', confidence: 71 },
    ],
    notes: 'Agency model - may need multi-tenant approach. Sophia seems engaged. Good referral potential.',
  },
];

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toLocaleString()}`;
}

function formatCurrencyFull(value: number): string {
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function getStageConfig(stageKey: StageKey) {
  return STAGES.find(s => s.key === stageKey) ?? STAGES[0];
}

function getScoreColor(score: number): { color: string; bg: string } {
  if (score >= 80) return { color: tokens.confidence.high.value, bg: tokens.confidence.high.bg };
  if (score >= 60) return { color: tokens.confidence.medium.value, bg: tokens.confidence.medium.bg };
  return { color: tokens.confidence.low.value, bg: tokens.confidence.low.bg };
}

// ═══════════════════════════════════════════════════════════════
// DRAGGABLE CARD COMPONENT
// ═══════════════════════════════════════════════════════════════

function DealCard({ deal, onClick, isDragOverlay = false }: { deal: Deal; onClick: () => void; isDragOverlay?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: deal.id, data: { deal } });
  const stageConfig = getStageConfig(deal.stage);
  const scoreStyle = getScoreColor(deal.intelligenceScore);
  const style = isDragOverlay
    ? { transform: CSS.Translate.toString(transform), boxShadow: elevation.xl, opacity: 0.95 }
    : { transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.4 : 1 };

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, cursor: 'grab', borderRadius: radius.md, border: `1px solid ${tokens.border.default}`, background: tokens.surface.card }}
      {...listeners}
      {...attributes}
      onClick={onClick}
      className={cn(
        'p-3 transition-colors hover:border-opacity-60',
        !isDragging && 'hover:shadow-md',
      )}
      onMouseEnter={e => { if (!isDragging) (e.currentTarget as HTMLElement).style.borderColor = stageConfig.color; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = tokens.border.default; }}
    >
      {/* Header: Company + Value */}
      <div className="flex items-start justify-between gap-2 mb-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="w-8 h-8 rounded-md flex items-center justify-center shrink-0 text-[10px] font-bold"
            style={{ background: stageConfig.bg, color: stageConfig.color, border: `1px solid ${stageConfig.border}` }}
          >
            {deal.companyLogo}
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold truncate" style={{ color: tokens.text.primary }}>{deal.company}</p>
            <p className="text-[11px] truncate" style={{ color: tokens.text.secondary }}>{deal.contact}</p>
          </div>
        </div>
        <span className="text-[13px] font-bold shrink-0" style={{ color: tokens.text.primary }}>{formatCurrency(deal.value)}</span>
      </div>

      {/* Intelligence Score Bar */}
      <div className="mb-2.5">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-medium" style={{ color: tokens.text.secondary }}>Intelligence Score</span>
          <span className="text-[11px] font-bold" style={{ color: scoreStyle.color }}>{deal.intelligenceScore}</span>
        </div>
        <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: tokens.borderFaint }}>
          <motion.div
            className="h-full rounded-full"
            style={{ background: scoreStyle.color }}
            initial={{ width: 0 }}
            animate={{ width: `${deal.intelligenceScore}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
        </div>
      </div>

      {/* Footer: Days + Signals count */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1" style={{ color: tokens.text.muted }}>
          <Clock className="w-3 h-3" />
          <span className="text-[10px] font-medium">{deal.daysInStage}d in stage</span>
        </div>
        {deal.signals.length > 0 && (
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1 px-1.5 py-0.5 rounded" style={{ background: tokens.accent.ghost }}>
                  <BrainCircuit className="w-3 h-3" style={{ color: tokens.domain.reasoning }} />
                  <span className="text-[10px] font-semibold" style={{ color: tokens.domain.reasoning }}>{deal.signals.length}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs" style={{ background: tokens.surface.elevated, border: `1px solid ${tokens.border.default}` }}>
                {deal.signals.length} intelligence signal{deal.signals.length > 1 ? 's' : ''} detected
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// DROPPABLE COLUMN COMPONENT
// ═══════════════════════════════════════════════════════════════

function StageColumn({ stage, deals, onCardClick, isOver }: {
  stage: typeof STAGES[number];
  deals: Deal[];
  onCardClick: (deal: Deal) => void;
  isOver: boolean;
}) {
  const { setNodeRef } = useDroppable({ id: stage.key });
  const columnValue = deals.reduce((sum, d) => sum + d.value, 0);
  const StageIcon = stage.icon;

  return (
    <div
      ref={setNodeRef}
      className="flex flex-col min-w-[280px] max-w-[320px] flex-1"
      style={{ borderRadius: radius.lg }}
    >
      {/* Column Header */}
      <div
        className="px-3 py-2.5 mb-2 flex items-center justify-between"
        style={{
          borderRadius: radius.md,
          background: isOver ? stage.bg : 'transparent',
          border: `1px solid ${isOver ? stage.border : 'transparent'}`,
          transition: 'all 200ms ease',
        }}
      >
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded flex items-center justify-center" style={{ background: stage.bg }}>
            <StageIcon className="w-3.5 h-3.5" style={{ color: stage.color }} />
          </div>
          <span className="text-[12px] font-semibold" style={{ color: tokens.text.primary }}>{stage.label}</span>
          <span
            className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
            style={{ background: stage.bg, color: stage.color }}
          >
            {deals.length}
          </span>
        </div>
        <span className="text-[11px] font-semibold" style={{ color: tokens.text.secondary }}>{formatCurrency(columnValue)}</span>
      </div>

      {/* Cards Container */}
      <div className="flex flex-col gap-2.5 flex-1 overflow-y-auto max-h-[calc(100vh-320px)] pr-1" style={{ scrollbarWidth: 'thin', scrollbarColor: `${tokens.border.default} transparent` }}>
        {deals.length === 0 && (
          <div
            className="flex-1 flex items-center justify-center py-8 rounded-lg border border-dashed"
            style={{ borderColor: tokens.border.default, minHeight: '80px' }}
          >
            <p className="text-[11px]" style={{ color: tokens.text.muted }}>No deals</p>
          </div>
        )}
        {deals.map(deal => (
          <DealCard key={deal.id} deal={deal} onClick={() => onCardClick(deal)} />
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// DETAIL PANEL COMPONENT
// ═══════════════════════════════════════════════════════════════

function DealDetailPanel({ deal, onClose }: { deal: Deal; onClose: () => void }) {
  const stageConfig = getStageConfig(deal.stage);
  const scoreStyle = getScoreColor(deal.intelligenceScore);
  const weightedValue = deal.value * deal.probability;
  const StageIcon = stageConfig.icon;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ x: 480, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 480, opacity: 0 }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="fixed top-0 right-0 h-full w-[460px] z-50 flex flex-col"
        style={{
          background: tokens.surface.primary,
          borderLeft: `1px solid ${tokens.border.default}`,
          boxShadow: '-8px 0 30px rgba(0,0,0,0.12)',
        }}
      >
        {/* Panel Header */}
        <div className="px-5 py-4 flex items-center justify-between shrink-0" style={{ borderBottom: `1px solid ${tokens.border.default}` }}>
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold"
              style={{ background: stageConfig.bg, color: stageConfig.color, border: `1px solid ${stageConfig.border}` }}
            >
              {deal.companyLogo}
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold truncate" style={{ color: tokens.text.primary }}>{deal.company}</h3>
              <p className="text-[11px]" style={{ color: tokens.text.secondary }}>{deal.industry}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:opacity-80"
            style={{ background: tokens.surfaceExtended }}
          >
            <X className="w-4 h-4" style={{ color: tokens.text.secondary }} />
          </button>
        </div>

        {/* Panel Body - Scrollable */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5" style={{ scrollbarWidth: 'thin', scrollbarColor: `${tokens.border.default} transparent` }}>

          {/* Deal Value & Stage */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg" style={{ background: tokens.surface.secondary, border: `1px solid ${tokens.border.default}` }}>
              <p className="text-[10px] font-medium mb-1" style={{ color: tokens.text.muted }}>Deal Value</p>
              <p className="text-lg font-bold" style={{ color: tokens.text.primary }}>{formatCurrencyFull(deal.value)}</p>
            </div>
            <div className="p-3 rounded-lg" style={{ background: tokens.surface.secondary, border: `1px solid ${tokens.border.default}` }}>
              <p className="text-[10px] font-medium mb-1" style={{ color: tokens.text.muted }}>Weighted Value</p>
              <p className="text-lg font-bold" style={{ color: deal.probability >= 0.5 ? tokens.confidence.high.value : tokens.text.secondary }}>
                {formatCurrencyFull(weightedValue)}
              </p>
              <p className="text-[10px]" style={{ color: tokens.text.muted }}>{Math.round(deal.probability * 100)}% probability</p>
            </div>
          </div>

          {/* Stage Progress */}
          <div className="p-3 rounded-lg" style={{ background: tokens.surface.secondary, border: `1px solid ${tokens.border.default}` }}>
            <div className="flex items-center gap-2 mb-3">
              <StageIcon className="w-4 h-4" style={{ color: stageConfig.color }} />
              <span className="text-[12px] font-semibold" style={{ color: tokens.text.primary }}>Stage: {stageConfig.label}</span>
            </div>
            <div className="flex items-center gap-1.5 mb-2">
              {STAGES.filter(s => s.key !== 'closed_lost').map((s, i) => {
                const isActive = STAGES.filter(st => st.key !== 'closed_lost').findIndex(st => st.key === deal.stage) >= i;
                return (
                  <div key={s.key} className="flex-1 flex items-center gap-1.5">
                    <div
                      className="h-1.5 flex-1 rounded-full"
                      style={{ background: isActive ? s.color : tokens.border.default, transition: 'background 300ms' }}
                    />
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px]" style={{ color: tokens.text.muted }}>Days in stage</span>
              <span className="text-[11px] font-semibold" style={{ color: tokens.text.primary }}>{deal.daysInStage} days</span>
            </div>
          </div>

          {/* Intelligence Score */}
          <div className="p-3 rounded-lg" style={{ background: tokens.surface.secondary, border: `1px solid ${tokens.border.default}` }}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <BrainCircuit className="w-4 h-4" style={{ color: tokens.domain.reasoning }} />
                <span className="text-[12px] font-semibold" style={{ color: tokens.text.primary }}>Intelligence Score</span>
              </div>
              <span
                className="text-sm font-bold px-2 py-0.5 rounded-md"
                style={{ color: scoreStyle.color, background: scoreStyle.bg }}
              >
                {deal.intelligenceScore}/100
              </span>
            </div>
            <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: tokens.borderFaint }}>
              <motion.div
                className="h-full rounded-full"
                style={{ background: scoreStyle.color }}
                initial={{ width: 0 }}
                animate={{ width: `${deal.intelligenceScore}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
              />
            </div>
          </div>

          <Separator style={{ background: tokens.border.default }} />

          {/* Contact Info */}
          <div>
            <h4 className="text-[11px] font-semibold uppercase tracking-wider mb-3" style={{ color: tokens.text.muted }}>Contact</h4>
            <div className="p-3 rounded-lg space-y-2.5" style={{ background: tokens.surface.secondary, border: `1px solid ${tokens.border.default}` }}>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold" style={{ background: stageConfig.bg, color: stageConfig.color }}>
                  {deal.contact.split(' ').map(n => n[0]).join('')}
                </div>
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold" style={{ color: tokens.text.primary }}>{deal.contact}</p>
                  <p className="text-[11px]" style={{ color: tokens.text.secondary }}>{deal.contactTitle}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-[11px]" style={{ color: tokens.text.secondary }}>
                <span className="truncate">{deal.contactEmail}</span>
              </div>
            </div>
          </div>

          {/* Deal Details */}
          <div>
            <h4 className="text-[11px] font-semibold uppercase tracking-wider mb-3" style={{ color: tokens.text.muted }}>Deal Details</h4>
            <div className="rounded-lg overflow-hidden" style={{ border: `1px solid ${tokens.border.default}` }}>
              {[
                { label: 'Owner', value: deal.owner, icon: User },
                { label: 'Source', value: deal.source, icon: Sparkles },
                { label: 'Employees', value: deal.employees, icon: Building2 },
                { label: 'Created', value: deal.createdAt, icon: CalendarDays },
                { label: 'Last Activity', value: deal.lastActivity, icon: Clock },
              ].map((row, i) => (
                <div key={row.label} className="flex items-center justify-between px-3 py-2" style={{ background: i % 2 === 0 ? tokens.surface.secondary : tokens.surface.primary }}>
                  <div className="flex items-center gap-2">
                    <row.icon className="w-3.5 h-3.5" style={{ color: tokens.text.muted }} />
                    <span className="text-[11px]" style={{ color: tokens.text.secondary }}>{row.label}</span>
                  </div>
                  <span className="text-[11px] font-medium" style={{ color: tokens.text.primary }}>{row.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Next Step */}
          <div className="p-3 rounded-lg" style={{ background: tokens.accent.ghost, border: `1px solid ${tokens.accent.subtle}` }}>
            <div className="flex items-center gap-2 mb-1.5">
              <ArrowRight className="w-3.5 h-3.5" style={{ color: tokens.accent.primary }} />
              <span className="text-[11px] font-semibold" style={{ color: tokens.accent.primary }}>Next Step</span>
            </div>
            <p className="text-[12px]" style={{ color: tokens.text.primary }}>{deal.nextStep}</p>
          </div>

          {/* Notes */}
          <div>
            <h4 className="text-[11px] font-semibold uppercase tracking-wider mb-3" style={{ color: tokens.text.muted }}>Notes</h4>
            <p className="text-[12px] leading-relaxed" style={{ color: tokens.text.secondary }}>{deal.notes}</p>
          </div>

          {/* Intelligence Signals */}
          {deal.signals.length > 0 && (
            <div>
              <h4 className="text-[11px] font-semibold uppercase tracking-wider mb-3" style={{ color: tokens.text.muted }}>
                Intelligence Signals ({deal.signals.length})
              </h4>
              <div className="space-y-2">
                {deal.signals.map(signal => {
                  const typeStyle = SIGNAL_TYPE_STYLES[signal.type];
                  const SignalIcon = signal.icon;
                  return (
                    <div
                      key={signal.id}
                      className="p-3 rounded-lg"
                      style={{
                        background: typeStyle.bg,
                        border: `1px solid ${typeStyle.border}`,
                      }}
                    >
                      <div className="flex items-start gap-2.5">
                        <div
                          className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 mt-0.5"
                          style={{ background: 'rgba(255,255,255,0.6)' }}
                        >
                          <SignalIcon className="w-3.5 h-3.5" style={{ color: typeStyle.color }} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-[12px] font-semibold" style={{ color: typeStyle.color }}>{signal.label}</span>
                            <span
                              className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase"
                              style={{ background: 'rgba(255,255,255,0.7)', color: typeStyle.color }}
                            >
                              {signal.type}
                            </span>
                          </div>
                          <p className="text-[11px] leading-relaxed mb-1.5" style={{ color: tokens.text.secondary }}>{signal.description}</p>
                          <div className="flex items-center gap-3">
                            <span className="text-[10px]" style={{ color: tokens.text.muted }}>{signal.detectedAt}</span>
                            <span className="text-[10px] font-medium" style={{ color: typeStyle.color }}>{signal.confidence}% confidence</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

// ═══════════════════════════════════════════════════════════════
// STAT CARD COMPONENT
// ═══════════════════════════════════════════════════════════════

function StatCard({ icon: Icon, label, value, subValue, accentColor }: {
  icon: LucideIcon;
  label: string;
  value: string;
  subValue?: string;
  accentColor: string;
}) {
  return (
    <div
      className="flex items-center gap-3 px-4 py-3 rounded-lg"
      style={{
        background: tokens.surface.secondary,
        border: `1px solid ${tokens.border.default}`,
      }}
    >
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: `${accentColor}12` }}
      >
        <Icon className="w-[18px] h-[18px]" style={{ color: accentColor }} />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-medium" style={{ color: tokens.text.muted }}>{label}</p>
        <p className="text-[15px] font-bold" style={{ color: tokens.text.primary }}>{value}</p>
        {subValue && <p className="text-[10px]" style={{ color: tokens.text.secondary }}>{subValue}</p>}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN PIPELINE SCREEN
// ═══════════════════════════════════════════════════════════════

export default function Pipeline() {
  const [deals, setDeals] = useState<Deal[]>(MOCK_DEALS);
  const [searchQuery, setSearchQuery] = useState('');
  const [stageFilter, setStageFilter] = useState<StageKey | 'all'>('all');
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  // ── Filtered deals ──
  const filteredDeals = useMemo(() => {
    return deals.filter(d => {
      const matchesSearch = !searchQuery.trim() ||
        d.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.contact.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStage = stageFilter === 'all' || d.stage === stageFilter;
      return matchesSearch && matchesStage;
    });
  }, [deals, searchQuery, stageFilter]);

  // ── Stats ──
  const stats = useMemo(() => {
    const activeDeals = deals.filter(d => d.stage !== 'closed_won' && d.stage !== 'closed_lost');
    const totalValue = activeDeals.reduce((s, d) => s + d.value, 0);
    const weightedValue = activeDeals.reduce((s, d) => s + d.value * d.probability, 0);
    const avgDeal = activeDeals.length > 0 ? totalValue / activeDeals.length : 0;
    const dealsThisMonth = deals.filter(d => {
      const created = new Date(d.createdAt);
      const now = new Date();
      return created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear();
    }).length;
    return { totalValue, weightedValue, avgDeal, dealsThisMonth, activeCount: activeDeals.length };
  }, [deals]);

  // ── DnD handlers ──
  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragOver = useCallback((_event: DragOverEvent) => {
    // Could be used for visual feedback
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const dealId = active.id as string;
    const newStage = over.id as StageKey;

    // Validate it's a valid stage
    if (!STAGES.some(s => s.key === newStage)) return;

    setDeals(prev => prev.map(d => {
      if (d.id !== dealId) return d;
      const stageConfig = getStageConfig(newStage);
      return {
        ...d,
        stage: newStage,
        probability: stageConfig.probability,
        daysInStage: newStage === d.stage ? d.daysInStage : 0,
      };
    }));
  }, []);

  const activeDeal = useMemo(() => deals.find(d => d.id === activeId) ?? null, [deals, activeId]);

  // ── Grouped by stage ──
  const dealsByStage = useMemo(() => {
    const map: Record<StageKey, Deal[]> = {
      prospecting: [], qualification: [], proposal: [], negotiation: [], closed_won: [], closed_lost: [],
    };
    filteredDeals.forEach(d => map[d.stage].push(d));
    // Sort each stage by intelligence score descending
    Object.keys(map).forEach(k => {
      (map[k as StageKey] as Deal[]).sort((a, b) => b.intelligenceScore - a.intelligenceScore);
    });
    return map;
  }, [filteredDeals]);

  return (
    <div className="flex flex-col h-full" style={{ fontFamily: typography.fontFamily }}>
      {/* ── Header ── */}
      <div className="px-5 pt-4 pb-3 shrink-0" style={{ borderBottom: `1px solid ${tokens.border.default}` }}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-base font-bold" style={{ color: tokens.text.primary }}>Deal Pipeline</h1>
            <p className="text-[11px] mt-0.5" style={{ color: tokens.text.secondary }}>
              {stats.activeCount} active deals · Drag cards to update stages
            </p>
          </div>
        </div>

        {/* ── Stats Bar ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <StatCard
            icon={DollarSign}
            label="Total Pipeline Value"
            value={formatCurrency(stats.totalValue)}
            subValue={`${stats.activeCount} active deals`}
            accentColor={tokens.accent.primary}
          />
          <StatCard
            icon={TrendingUp}
            label="Weighted Pipeline"
            value={formatCurrency(stats.weightedValue)}
            subValue={`${Math.round((stats.weightedValue / stats.totalValue) * 100)}% of total`}
            accentColor={tokens.confidence.high.value}
          />
          <StatCard
            icon={BarChart3}
            label="Avg Deal Size"
            value={formatCurrency(stats.avgDeal)}
            accentColor={tokens.domain.enrichment}
          />
          <StatCard
            icon={CalendarDays}
            label="Deals This Month"
            value={String(stats.dealsThisMonth)}
            subValue="New pipeline entries"
            accentColor={tokens.domain.reasoning}
          />
        </div>

        {/* ── Filter Bar ── */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: tokens.text.muted }} />
            <input
              type="text"
              placeholder="Search by company or contact…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full h-8 pl-8 pr-8 rounded-lg text-[12px] outline-none transition-colors"
              style={{
                background: tokens.surface.secondary,
                border: `1px solid ${tokens.border.default}`,
                color: tokens.text.primary,
              }}
              onFocus={e => e.currentTarget.style.borderColor = tokens.accent.primary}
              onBlur={e => e.currentTarget.style.borderColor = tokens.border.default}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2"
              >
                <X className="w-3.5 h-3.5" style={{ color: tokens.text.muted }} />
              </button>
            )}
          </div>

          {/* Stage Filter Buttons */}
          <div className="flex items-center gap-1.5 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
            <button
              onClick={() => setStageFilter('all')}
              className="px-3 py-1.5 rounded-md text-[11px] font-semibold whitespace-nowrap transition-all"
              style={{
                background: stageFilter === 'all' ? tokens.accent.primary : 'transparent',
                color: stageFilter === 'all' ? tokens.flat.white : tokens.text.secondary,
                border: `1px solid ${stageFilter === 'all' ? tokens.accent.primary : tokens.border.default}`,
              }}
            >
              All Stages
            </button>
            {STAGES.map(stage => {
              const count = deals.filter(d => d.stage === stage.key).length;
              return (
                <button
                  key={stage.key}
                  onClick={() => setStageFilter(stage.key)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-semibold whitespace-nowrap transition-all"
                  style={{
                    background: stageFilter === stage.key ? stage.color : 'transparent',
                    color: stageFilter === stage.key ? tokens.flat.white : tokens.text.secondary,
                    border: `1px solid ${stageFilter === stage.key ? stage.color : tokens.border.default}`,
                  }}
                >
                  <stage.icon className="w-3 h-3" />
                  {stage.label}
                  <span
                    className="text-[9px] font-bold px-1 py-0.5 rounded-full"
                    style={{
                      background: stageFilter === stage.key ? 'rgba(255,255,255,0.25)' : stage.bg,
                      color: stageFilter === stage.key ? tokens.flat.white : stage.color,
                    }}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Kanban Board ── */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden px-5 py-4">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 h-full min-w-max">
            {STAGES.map(stage => (
              <StageColumn
                key={stage.key}
                stage={stage}
                deals={dealsByStage[stage.key]}
                onCardClick={setSelectedDeal}
                isOver={false}
              />
            ))}
          </div>

          {/* Drag Overlay */}
          <DragOverlay dropAnimation={{ duration: 200, easing: 'ease' }}>
            {activeDeal ? (
              <div style={{ width: '280px' }}>
                <DealCard deal={activeDeal} onClick={() => {}} isDragOverlay />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>

      {/* ── Detail Panel ── */}
      <AnimatePresence>
        {selectedDeal && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40"
              style={{ background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(2px)' }}
              onClick={() => setSelectedDeal(null)}
            />\            <DealDetailPanel deal={selectedDeal} onClose={() => setSelectedDeal(null)} />
          </>
        )}
      </AnimatePresence>
    </div>
  );
}