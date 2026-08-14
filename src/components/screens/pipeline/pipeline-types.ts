'use client';

import {
  TrendingUp,
  Users,
  Zap,
  Globe,
  AlertTriangle,
  Shield,
  FileText,
  Activity,
  Sparkles,
  CheckCircle2,
  XCircle,
  Search,
  Target,
} from 'lucide-react';
import { type LucideIcon } from 'lucide-react';

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export type StageKey =
  'prospecting' | 'qualification' | 'proposal' | 'negotiation' | 'closed_won' | 'closed_lost';

export interface IntelligenceSignal {
  id: string;
  type: 'opportunity' | 'risk' | 'enrichment' | 'action';
  icon: LucideIcon;
  label: string;
  description: string;
  detectedAt: string;
  confidence: number;
}

export interface Deal {
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

export interface StageConfig {
  key: StageKey;
  label: string;
  color: string;
  bg: string;
  border: string;
  icon: LucideIcon;
  probability: number;
}

export const STAGES: StageConfig[] = [
  {
    key: 'prospecting',
    label: 'Prospecting',
    color: '#8B5CF6',
    bg: 'rgba(139,92,246,0.08)',
    border: 'rgba(139,92,246,0.25)',
    icon: Search,
    probability: 0.1,
  },
  {
    key: 'qualification',
    label: 'Qualification',
    color: '#3B82F6',
    bg: 'rgba(59,130,246,0.08)',
    border: 'rgba(59,130,246,0.25)',
    icon: Target,
    probability: 0.25,
  },
  {
    key: 'proposal',
    label: 'Proposal',
    color: '#F59E0B',
    bg: 'rgba(245,158,11,0.08)',
    border: 'rgba(245,158,11,0.25)',
    icon: FileText,
    probability: 0.5,
  },
  {
    key: 'negotiation',
    label: 'Negotiation',
    color: '#F97316',
    bg: 'rgba(249,115,22,0.08)',
    border: 'rgba(249,115,22,0.25)',
    icon: Activity,
    probability: 0.75,
  },
  {
    key: 'closed_won',
    label: 'Closed Won',
    color: '#10B981',
    bg: 'rgba(16,185,129,0.08)',
    border: 'rgba(16,185,129,0.25)',
    icon: CheckCircle2,
    probability: 1.0,
  },
  {
    key: 'closed_lost',
    label: 'Closed Lost',
    color: '#EF4444',
    bg: 'rgba(239,68,68,0.08)',
    border: 'rgba(239,68,68,0.25)',
    icon: XCircle,
    probability: 0,
  },
];

export const SIGNAL_TYPE_STYLES: Record<string, { color: string; bg: string; border: string }> = {
  opportunity: {
    color: 'var(--ios-domain-opportunity, #059669)',
    bg: 'rgba(5,150,105,0.08)',
    border: 'rgba(5,150,105,0.2)',
  },
  risk: {
    color: 'var(--ios-domain-risk, #DC2626)',
    bg: 'rgba(220,38,38,0.08)',
    border: 'rgba(220,38,38,0.2)',
  },
  enrichment: {
    color: 'var(--ios-domain-enrichment, #D97706)',
    bg: 'rgba(217,119,6,0.08)',
    border: 'rgba(217,119,6,0.2)',
  },
  action: {
    color: 'var(--ios-domain-action, #2563EB)',
    bg: 'rgba(37,99,235,0.08)',
    border: 'rgba(37,99,235,0.2)',
  },
};

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

export function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toLocaleString()}`;
}

export function formatCurrencyFull(value: number): string {
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function getStageConfig(stageKey: StageKey) {
  return STAGES.find((s) => s.key === stageKey) ?? STAGES[0];
}

export function getScoreColor(score: number): { color: string; bg: string } {
  if (score >= 80)
    return {
      color: 'var(--ios-confidence-high, #10B981)',
      bg: 'var(--ios-confidence-high-bg, rgba(16,185,129,0.1))',
    };
  if (score >= 60)
    return {
      color: 'var(--ios-confidence-medium, #F59E0B)',
      bg: 'var(--ios-confidence-medium-bg, rgba(245,158,11,0.1))',
    };
  return {
    color: 'var(--ios-confidence-low, #EF4444)',
    bg: 'var(--ios-confidence-low-bg, rgba(239,68,68,0.1))',
  };
}

// ═══════════════════════════════════════════════════════════════
// MOCK DATA
// ═══════════════════════════════════════════════════════════════

export const MOCK_DEALS: Deal[] = [
  {
    id: 'd-001',
    company: 'Meridian Technologies',
    companyLogo: 'MT',
    contact: 'Sarah Chen',
    contactTitle: 'VP of Engineering',
    contactEmail: 'sarah.chen@meridiantech.io',
    value: 285000,
    stage: 'negotiation',
    daysInStage: 8,
    intelligenceScore: 92,
    industry: 'Enterprise SaaS',
    employees: '500-1,000',
    createdAt: '2024-11-15',
    lastActivity: '2 hours ago',
    nextStep: 'Final pricing review with CFO',
    owner: 'Alex Rivera',
    source: 'Outbound',
    probability: 0.75,
    signals: [
      {
        id: 's1',
        type: 'opportunity',
        icon: TrendingUp,
        label: 'Series C Funding',
        description: 'Raised $45M Series C led by Sequoia Capital. Expansion budget likely.',
        detectedAt: '3 days ago',
        confidence: 95,
      },
      {
        id: 's2',
        type: 'enrichment',
        icon: Users,
        label: 'Hiring Surge',
        description: '12 new engineering roles posted in last 2 weeks. Scaling infrastructure.',
        detectedAt: '1 week ago',
        confidence: 88,
      },
      {
        id: 's3',
        type: 'action',
        icon: Zap,
        label: 'Contract Renewal',
        description: 'Current vendor contract expires in 45 days. Decision window open.',
        detectedAt: '5 days ago',
        confidence: 91,
      },
    ],
    notes:
      'Strong champion in Sarah. CFO approval is the remaining gate. Competitive deal from incumbent vendor.',
  },
  {
    id: 'd-002',
    company: 'Apex Financial Group',
    companyLogo: 'AF',
    contact: 'Michael Torres',
    contactTitle: 'CTO',
    contactEmail: 'm.torres@apexfin.com',
    value: 520000,
    stage: 'proposal',
    daysInStage: 14,
    intelligenceScore: 87,
    industry: 'Financial Services',
    employees: '2,000-5,000',
    createdAt: '2024-10-28',
    lastActivity: '1 day ago',
    nextStep: 'Present technical architecture to security team',
    owner: 'Jordan Kim',
    source: 'Referral',
    probability: 0.5,
    signals: [
      {
        id: 's4',
        type: 'opportunity',
        icon: Globe,
        label: 'Global Expansion',
        description: 'Opening offices in London and Singapore. Need unified platform.',
        detectedAt: '1 week ago',
        confidence: 82,
      },
      {
        id: 's5',
        type: 'risk',
        icon: AlertTriangle,
        label: 'Security Audit',
        description: 'Upcoming SOC 2 audit may delay procurement. Engage early.',
        detectedAt: '4 days ago',
        confidence: 76,
      },
    ],
    notes:
      'Long sales cycle expected due to compliance. Michael is technical buyer. Need to involve security team early.',
  },
  {
    id: 'd-003',
    company: 'NovaCare Health',
    companyLogo: 'NC',
    contact: 'Dr. Priya Sharma',
    contactTitle: 'Chief Innovation Officer',
    contactEmail: 'p.sharma@novacare.health',
    value: 178000,
    stage: 'qualification',
    daysInStage: 21,
    intelligenceScore: 74,
    industry: 'Healthcare',
    employees: '1,000-2,000',
    createdAt: '2024-11-02',
    lastActivity: '3 days ago',
    nextStep: 'Schedule demo with clinical team',
    owner: 'Alex Rivera',
    source: 'Inbound',
    probability: 0.25,
    signals: [
      {
        id: 's6',
        type: 'opportunity',
        icon: FileText,
        label: 'Regulatory Change',
        description: 'New CMS interoperability mandate requires platform upgrade.',
        detectedAt: '2 weeks ago',
        confidence: 90,
      },
      {
        id: 's7',
        type: 'enrichment',
        icon: Shield,
        label: 'HIPAA Compliance',
        description: 'Recently achieved HITRUST certification. Serious about security posture.',
        detectedAt: '3 weeks ago',
        confidence: 85,
      },
    ],
    notes:
      'Healthcare vertical with strict compliance requirements. Long evaluation cycle but high LTV.',
  },
  {
    id: 'd-004',
    company: 'Stratos Cloud',
    companyLogo: 'SC',
    contact: 'James Mitchell',
    contactTitle: 'Head of Infrastructure',
    contactEmail: 'j.mitchell@stratoscloud.dev',
    value: 340000,
    stage: 'negotiation',
    daysInStage: 5,
    intelligenceScore: 89,
    industry: 'Cloud Infrastructure',
    employees: '200-500',
    createdAt: '2024-11-20',
    lastActivity: '6 hours ago',
    nextStep: 'Legal review of MSA terms',
    owner: 'Morgan Lee',
    source: 'Partner',
    probability: 0.75,
    signals: [
      {
        id: 's8',
        type: 'opportunity',
        icon: TrendingUp,
        label: 'Revenue Growth',
        description: 'Q3 revenue up 67% YoY. Investing heavily in platform reliability.',
        detectedAt: '1 week ago',
        confidence: 93,
      },
      {
        id: 's9',
        type: 'action',
        icon: Zap,
        label: 'Tech Stack Migration',
        description: 'Moving from legacy monitoring. Decision expected by month end.',
        detectedAt: '2 days ago',
        confidence: 88,
      },
    ],
    notes:
      'Fast-moving team. James has budget authority. Partner intro from AWS gave us credibility.',
  },
  {
    id: 'd-005',
    company: 'Pinnacle Retail',
    companyLogo: 'PR',
    contact: 'Lisa Wang',
    contactTitle: 'SVP Digital',
    contactEmail: 'l.wang@pinnacleretail.com',
    value: 195000,
    stage: 'prospecting',
    daysInStage: 3,
    intelligenceScore: 68,
    industry: 'Retail & E-commerce',
    employees: '5,000-10,000',
    createdAt: '2024-12-01',
    lastActivity: '1 day ago',
    nextStep: 'Send personalized outreach with industry case study',
    owner: 'Jordan Kim',
    source: 'Outbound',
    probability: 0.1,
    signals: [
      {
        id: 's10',
        type: 'enrichment',
        icon: Globe,
        label: 'Omnichannel Push',
        description: 'Announced $20M investment in unified commerce platform.',
        detectedAt: '5 days ago',
        confidence: 79,
      },
    ],
    notes: 'Early stage. Large company with complex buying committee. Need to map stakeholders.',
  },
  {
    id: 'd-006',
    company: 'Quantum Dynamics',
    companyLogo: 'QD',
    contact: 'Robert Blake',
    contactTitle: 'CEO',
    contactEmail: 'r.blake@quantumdynamics.ai',
    value: 420000,
    stage: 'closed_won',
    daysInStage: 0,
    intelligenceScore: 95,
    industry: 'AI / Machine Learning',
    employees: '50-200',
    createdAt: '2024-09-10',
    lastActivity: '2 days ago',
    nextStep: 'Onboarding kickoff - Jan 6',
    owner: 'Morgan Lee',
    source: 'Conference',
    probability: 1.0,
    signals: [
      {
        id: 's11',
        type: 'opportunity',
        icon: Sparkles,
        label: 'AI Adoption Leader',
        description: 'Recognized as top 50 AI companies by Forbes. Fast-growing.',
        detectedAt: '1 month ago',
        confidence: 97,
      },
      {
        id: 's12',
        type: 'opportunity',
        icon: Users,
        label: 'Team Expansion',
        description: 'Doubled engineering team in 6 months. Need scalable tooling.',
        detectedAt: '2 weeks ago',
        confidence: 92,
      },
    ],
    notes:
      'Signed 2-year enterprise deal. Robert was champion from day one. Strong reference potential.',
  },
  {
    id: 'd-007',
    company: 'Ironclad Security',
    companyLogo: 'IS',
    contact: 'Amanda Foster',
    contactTitle: 'Director of Product',
    contactEmail: 'a.foster@ironcladsec.io',
    value: 156000,
    stage: 'proposal',
    daysInStage: 10,
    intelligenceScore: 81,
    industry: 'Cybersecurity',
    employees: '100-250',
    createdAt: '2024-11-08',
    lastActivity: '4 days ago',
    nextStep: 'Technical POC with engineering team',
    owner: 'Alex Rivera',
    source: 'Inbound',
    probability: 0.5,
    signals: [
      {
        id: 's13',
        type: 'opportunity',
        icon: Shield,
        label: 'SOC 2 Certification',
        description: 'Pursuing SOC 2 Type II. Needs audit-ready documentation.',
        detectedAt: '1 week ago',
        confidence: 86,
      },
      {
        id: 's14',
        type: 'action',
        icon: Zap,
        label: 'Product Launch',
        description: 'New enterprise tier launching Q1. Needs integration testing.',
        detectedAt: '3 days ago',
        confidence: 80,
      },
    ],
    notes:
      'Technical evaluation in progress. Amanda is the decision maker. POC scheduled for next week.',
  },
  {
    id: 'd-008',
    company: 'Vertex Logistics',
    companyLogo: 'VL',
    contact: 'David Park',
    contactTitle: 'VP Operations',
    contactEmail: 'd.park@vertexlogistics.com',
    value: 310000,
    stage: 'qualification',
    daysInStage: 16,
    intelligenceScore: 72,
    industry: 'Logistics & Supply Chain',
    employees: '2,000-5,000',
    createdAt: '2024-11-12',
    lastActivity: '5 days ago',
    nextStep: 'Discovery call with IT leadership',
    owner: 'Jordan Kim',
    source: 'Outbound',
    probability: 0.25,
    signals: [
      {
        id: 's15',
        type: 'risk',
        icon: AlertTriangle,
        label: 'Budget Freeze',
        description: 'Q4 budget freeze may delay decision to Q1. Nurture relationship.',
        detectedAt: '6 days ago',
        confidence: 72,
      },
      {
        id: 's16',
        type: 'enrichment',
        icon: Globe,
        label: 'Acquisition Target',
        description: 'Rumored acquisition by larger logistics firm. May accelerate or kill deal.',
        detectedAt: '1 week ago',
        confidence: 55,
      },
    ],
    notes:
      "Large opportunity but high uncertainty due to potential acquisition. Keep warm but don't over-invest.",
  },
  {
    id: 'd-009',
    company: 'BrightPath Education',
    companyLogo: 'BE',
    contact: 'Karen Nguyen',
    contactTitle: 'CTO',
    contactEmail: 'k.nguyen@brightpath.edu',
    value: 98000,
    stage: 'prospecting',
    daysInStage: 7,
    intelligenceScore: 63,
    industry: 'EdTech',
    employees: '200-500',
    createdAt: '2024-11-28',
    lastActivity: '2 days ago',
    nextStep: 'Follow up on initial interest email',
    owner: 'Morgan Lee',
    source: 'Content',
    probability: 0.1,
    signals: [
      {
        id: 's17',
        type: 'opportunity',
        icon: TrendingUp,
        label: 'Enrollment Growth',
        description: 'Student enrollment up 40% YoY. Platform strain likely.',
        detectedAt: '4 days ago',
        confidence: 74,
      },
    ],
    notes: 'Smaller deal size but good expansion potential. Karen engaged with our blog content.',
  },
  {
    id: 'd-010',
    company: 'Atlas Manufacturing',
    companyLogo: 'AM',
    contact: 'Frank Rodriguez',
    contactTitle: 'Director of IT',
    contactEmail: 'f.rodriguez@atlasmfg.com',
    value: 265000,
    stage: 'closed_lost',
    daysInStage: 0,
    intelligenceScore: 58,
    industry: 'Manufacturing',
    employees: '5,000-10,000',
    createdAt: '2024-08-15',
    lastActivity: '3 weeks ago',
    nextStep: 'Re-engage in Q2 after vendor evaluation',
    owner: 'Alex Rivera',
    source: 'Trade Show',
    probability: 0,
    signals: [
      {
        id: 's18',
        type: 'risk',
        icon: XCircle,
        label: 'Competitor Win',
        description: 'Selected incumbent vendor for renewal. Cited pricing concerns.',
        detectedAt: '3 weeks ago',
        confidence: 90,
      },
    ],
    notes:
      'Lost to incumbent on price. Frank expressed interest in re-evaluating after current contract. Set reminder for Q2.',
  },
  {
    id: 'd-011',
    company: 'Cipher Analytics',
    companyLogo: 'CA',
    contact: 'Nina Patel',
    contactTitle: 'Head of Data',
    contactEmail: 'n.patel@cipheranalytics.io',
    value: 385000,
    stage: 'proposal',
    daysInStage: 6,
    intelligenceScore: 86,
    industry: 'Data & Analytics',
    employees: '100-250',
    createdAt: '2024-11-22',
    lastActivity: '12 hours ago',
    nextStep: 'Custom demo with data engineering team',
    owner: 'Morgan Lee',
    source: 'Partner',
    probability: 0.5,
    signals: [
      {
        id: 's19',
        type: 'opportunity',
        icon: TrendingUp,
        label: 'Data Platform Rebuild',
        description: 'Publicly stated they are rebuilding data infrastructure from scratch.',
        detectedAt: '1 week ago',
        confidence: 91,
      },
      {
        id: 's20',
        type: 'opportunity',
        icon: Users,
        label: 'Senior Hire',
        description: 'Hired former Databricks architect as Principal Engineer. Signal of intent.',
        detectedAt: '4 days ago',
        confidence: 84,
      },
    ],
    notes: 'High-intent buyer. Nina has clear requirements and budget. Strong technical fit.',
  },
  {
    id: 'd-012',
    company: 'Greenfield Energy',
    companyLogo: 'GE',
    contact: 'Thomas Wright',
    contactTitle: 'VP Technology',
    contactEmail: 't.wright@greenfieldenergy.com',
    value: 445000,
    stage: 'negotiation',
    daysInStage: 12,
    intelligenceScore: 83,
    industry: 'Clean Energy',
    employees: '500-1,000',
    createdAt: '2024-10-15',
    lastActivity: '1 day ago',
    nextStep: 'Executive sponsorship meeting with CEO',
    owner: 'Jordan Kim',
    source: 'Referral',
    probability: 0.75,
    signals: [
      {
        id: 's21',
        type: 'opportunity',
        icon: Globe,
        label: 'Government Contracts',
        description:
          'Won 3 federal clean energy contracts. Compliance requirements driving platform needs.',
        detectedAt: '2 weeks ago',
        confidence: 87,
      },
      {
        id: 's22',
        type: 'enrichment',
        icon: Shield,
        label: 'FedRAMP Pursuit',
        description: 'Beginning FedRAMP authorization process. Security platform critical path.',
        detectedAt: '1 week ago',
        confidence: 80,
      },
      {
        id: 's23',
        type: 'action',
        icon: Zap,
        label: 'Board Meeting',
        description: 'Board meeting Dec 15 to approve technology spend. Timing sensitive.',
        detectedAt: '3 days ago',
        confidence: 93,
      },
    ],
    notes:
      'High-value deal with regulatory tailwinds. Thomas is our champion. CEO meeting is the key milestone.',
  },
  {
    id: 'd-013',
    company: 'Nomad Digital',
    companyLogo: 'ND',
    contact: 'Sophia Martinez',
    contactTitle: 'COO',
    contactEmail: 's.martinez@nomaddigital.co',
    value: 142000,
    stage: 'prospecting',
    daysInStage: 5,
    intelligenceScore: 65,
    industry: 'Digital Agency',
    employees: '50-200',
    createdAt: '2024-12-03',
    lastActivity: '1 day ago',
    nextStep: 'Intro call scheduled for next Tuesday',
    owner: 'Alex Rivera',
    source: 'LinkedIn',
    probability: 0.1,
    signals: [
      {
        id: 's24',
        type: 'enrichment',
        icon: Users,
        label: 'Client Growth',
        description: 'Onboarded 8 new enterprise clients in Q3. Outgrowing current tools.',
        detectedAt: '6 days ago',
        confidence: 71,
      },
    ],
    notes:
      'Agency model - may need multi-tenant approach. Sophia seems engaged. Good referral potential.',
  },
];
