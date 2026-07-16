'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Radar, AlertTriangle, Eye, TrendingUp, RefreshCw,
  Crown, DollarSign, Cpu, Globe, Clock,
  Lightbulb, Zap, ChevronRight,
  Briefcase, Building2, Target,
} from 'lucide-react';
import { PageTransition, AnimatedCounter, EmptyState } from '@/components/ui/animated-components';

/* ═══════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════ */
type SignalType = 'Hiring' | 'Leadership' | 'Investment' | 'Technology' | 'Expansion';
type Priority = 'High' | 'Medium' | 'Low';

interface Signal {
  id: string;
  companyId: string;
  companyName: string;
  type: SignalType;
  priority: Priority;
  title: string;
  description: string;
  whyItMatters: string;
  recommendedAction: string;
  timestamp: string;
  source: string;
}

/* ═══════════════════════════════════════════════════
   Config: colors & icons per signal type
   ═══════════════════════════════════════════════════ */
const typeConfig: Record<SignalType, { color: string; bg: string; icon: React.ComponentType<{ className?: string }> }> = {
  Hiring:     { color: '#2563EB', bg: 'rgba(37,99,235,0.08)',  icon: Briefcase },
  Leadership: { color: '#7C3AED', bg: 'rgba(124,58,237,0.08)', icon: Crown },
  Investment: { color: '#D4AF37', bg: 'rgba(212,175,55,0.08)',  icon: DollarSign },
  Technology: { color: '#0891B2', bg: 'rgba(8,145,178,0.08)',  icon: Cpu },
  Expansion:  { color: '#059669', bg: 'rgba(5,150,105,0.08)',  icon: Globe },
};

const priorityConfig: Record<Priority, { color: string; bg: string; label: string }> = {
  High:   { color: '#DC2626', bg: 'rgba(220,38,38,0.08)',  label: 'High Priority' },
  Medium: { color: '#D97706', bg: 'rgba(217,119,6,0.08)',  label: 'Medium' },
  Low:    { color: '#6B7280', bg: 'rgba(107,114,128,0.08)', label: 'Low' },
};

const filterPills: { key: 'All' | SignalType; label: string }[] = [
  { key: 'All', label: 'All Signals' },
  { key: 'Hiring', label: 'Hiring' },
  { key: 'Leadership', label: 'Leadership' },
  { key: 'Investment', label: 'Investment' },
  { key: 'Technology', label: 'Technology' },
  { key: 'Expansion', label: 'Expansion' },
];

/* ═══════════════════════════════════════════════════
   Demo Data
   ═══════════════════════════════════════════════════ */
const demoSignals: Signal[] = [
  {
    id: 'sig-001', companyId: 'comp-abc', companyName: 'ABC Manufacturing',
    type: 'Leadership', priority: 'High',
    title: 'New Chief Digital Officer Appointed',
    description: 'ABC Manufacturing announced the appointment of Dr. Sarah Chen as their first-ever Chief Digital Officer, reporting directly to the CEO. Dr. Chen joins from Siemens Digital Industries where she led a $200M transformation program.',
    whyItMatters: 'The creation of a CDO role signals a strategic pivot toward digital transformation. Companies in this phase typically allocate significant budget to new technology vendors and consulting engagements within 6–12 months.',
    recommendedAction: 'Reach out to the CDO office to introduce digital transformation capabilities. Reference the Siemens engagement to establish credibility. Target Q2 budgeting discussions.',
    timestamp: '2 hours ago', source: 'LinkedIn',
  },
  {
    id: 'sig-002', companyId: 'comp-xyz', companyName: 'XYZ Financial Services',
    type: 'Hiring', priority: 'High',
    title: '12 AI/ML Engineering Positions Posted',
    description: 'XYZ Financial Services has posted 12 new positions for AI and Machine Learning engineers across their New York and London offices. Roles include Senior ML Engineer, AI Platform Architect, and Data Science Lead.',
    whyItMatters: 'A sudden surge in AI/ML hiring indicates a major initiative — likely building an internal AI platform or deploying ML at scale. The dual-office posting suggests enterprise-wide adoption, not a pilot program.',
    recommendedAction: 'Prepare a tailored outreach highlighting AI infrastructure and platform engineering expertise. Connect with the hiring managers on LinkedIn. Consider sending a thought leadership piece on enterprise AI deployment.',
    timestamp: '3 hours ago', source: 'LinkedIn Jobs',
  },
  {
    id: 'sig-003', companyId: 'comp-def', companyName: 'DEF Energy',
    type: 'Investment', priority: 'High',
    title: '$500M Digital Modernization Program Announced',
    description: 'DEF Energy\'s board approved a $500M digital modernization program spanning 2025–2028. The program covers cloud migration, IoT infrastructure, and AI-powered predictive maintenance for their 47 facilities across North America.',
    whyItMatters: 'This is one of the largest energy sector digital investments this year. The program scope — cloud, IoT, and AI — aligns perfectly with our core service offerings. Procurement will begin vendor selection in Q1 2026.',
    recommendedAction: 'Immediately escalate to the strategic accounts team. Prepare a comprehensive capabilities deck for the energy sector. Identify mutual connections to the CIO and VP of Digital. Schedule a strategy call within 48 hours.',
    timestamp: '5 hours ago', source: 'Press Release',
  },
  {
    id: 'sig-004', companyId: 'comp-ghi', companyName: 'GHI Tech',
    type: 'Expansion', priority: 'Medium',
    title: 'New Singapore Office for Southeast Asia Operations',
    description: 'GHI Tech announced the opening of a new regional headquarters in Singapore to drive Southeast Asian expansion. The office will house 200+ employees across engineering, sales, and customer success teams.',
    whyItMatters: 'Southeast Asia expansion creates demand for regional technology infrastructure, localized solutions, and partners familiar with APAC compliance and data residency requirements. This is a land-and-expand opportunity.',
    recommendedAction: 'Research our APAC capabilities and case studies. Identify if we have local partnerships or resources in Singapore. Prepare a market-entry technology advisory proposal.',
    timestamp: 'Yesterday', source: 'Company Website',
  },
  {
    id: 'sig-005', companyId: 'comp-jkl', companyName: 'JKL Logistics',
    type: 'Technology', priority: 'Medium',
    title: 'ERP Migration from Oracle to SAP S/4HANA',
    description: 'JKL Logistics initiated a full ERP migration from Oracle E-Business Suite to SAP S/4HANA. The 18-month project is being led by their Global CTO and includes supply chain, finance, and procurement modules.',
    whyItMatters: 'Large ERP migrations create cascading needs for integration services, data migration, change management, and custom development. Companies in this phase often exceed initial budgets by 40–60%, opening opportunities for complementary services.',
    recommendedAction: 'Connect with the CTO\'s office to position SAP implementation expertise. Offer a complimentary ERP migration risk assessment. Highlight relevant logistics sector SAP case studies.',
    timestamp: 'Yesterday', source: 'Job Postings',
  },
  {
    id: 'sig-006', companyId: 'comp-mno', companyName: 'MNO Healthcare',
    type: 'Investment', priority: 'High',
    title: 'Acquired AI Diagnostics Startup MedVision AI',
    description: 'MNO Healthcare completed the acquisition of MedVision AI, a Series B healthcare diagnostics startup, for an undisclosed amount. The acquisition is expected to close by end of Q4 2025 and will form the core of MNO\'s new AI Diagnostics Division.',
    whyItMatters: 'Post-acquisition integration creates urgent demand for technology consulting, system integration, and compliance support. Healthcare AI integrations require HIPAA-compliant infrastructure that we specialize in.',
    recommendedAction: 'Prepare a post-acquisition technology integration playbook for healthcare. Reach out to the CTO and the newly appointed AI Diagnostics Division head. Offer a technology stack assessment.',
    timestamp: '2 days ago', source: 'News',
  },
  {
    id: 'sig-007', companyId: 'comp-pqr', companyName: 'PQR Consulting',
    type: 'Expansion', priority: 'Low',
    title: 'Launched New Cloud Practice Division',
    description: 'PQR Consulting announced the formation of a dedicated Cloud Practice division, targeting $30M in annual revenue by 2027. The division will focus on multi-cloud strategy, cloud-native development, and cloud security services.',
    whyItMatters: 'While this is an internal organizational change, it indicates PQR is investing in cloud capabilities. They may become a potential partner for co-delivery or a competitor in adjacent cloud services markets.',
    recommendedAction: 'Monitor PQR\'s cloud hiring and client announcements. Evaluate potential partnership opportunities for complementary services. Update competitive intelligence brief.',
    timestamp: '3 days ago', source: 'Company Website',
  },
  {
    id: 'sig-008', companyId: 'comp-stu', companyName: 'STU Retail Group',
    type: 'Technology', priority: 'Medium',
    title: 'Deploying Computer Vision for Inventory Management',
    description: 'STU Retail Group is deploying computer vision technology across 350+ store locations for real-time inventory tracking and loss prevention. The initiative is part of their $75M "Smart Store" digital initiative.',
    whyItMatters: 'Computer vision at this scale requires significant edge computing infrastructure, cloud pipelines, and integration with existing POS and ERP systems. STU is evaluating multiple vendors for the implementation phase.',
    recommendedAction: 'Position edge computing and IoT integration expertise. Prepare a retail-specific computer vision architecture reference. Identify STU\'s current technology vendors to find co-sell opportunities.',
    timestamp: '3 days ago', source: 'Press Release',
  },
];

/* ═══════════════════════════════════════════════════
   Summary card data
   ═══════════════════════════════════════════════════ */
const summaryCards = [
  { label: 'Active Signals', value: 47, icon: Radar, color: '#2563EB', bg: 'rgba(37,99,235,0.08)' },
  { label: 'High Priority', value: 12, icon: AlertTriangle, color: '#DC2626', bg: 'rgba(220,38,38,0.08)' },
  { label: 'Companies Monitored', value: 184, icon: Eye, color: '#D4AF37', bg: 'rgba(212,175,55,0.08)' },
  { label: 'Signals This Week', value: 23, icon: TrendingUp, color: '#059669', bg: 'rgba(5,150,105,0.08)' },
];

/* ═══════════════════════════════════════════════════
   Component
   ═══════════════════════════════════════════════════ */
export default function SignalIntelligenceScreen({ navigateTo }: { navigateTo?: (screen: string, id?: string) => void }) {
  const [activeFilter, setActiveFilter] = useState<'All' | SignalType>('All');
  const [scanning, setScanning] = useState(false);

  const filteredSignals = useMemo(() => {
    if (activeFilter === 'All') return demoSignals;
    return demoSignals.filter(s => s.type === activeFilter);
  }, [activeFilter]);

  const handleScan = () => {
    setScanning(true);
    setTimeout(() => setScanning(false), 2000);
  };

  return (
    <PageTransition className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

        {/* ─── Page Header ─── */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <motion.h1
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight"
            >
              Signal Intelligence
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
              className="text-sm text-muted-foreground mt-1"
            >
              AI-powered change detection across your accounts
            </motion.p>
          </div>
          <motion.button
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={handleScan}
            disabled={scanning}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white transition-all duration-200 disabled:opacity-60 cursor-pointer"
            style={{
              background: 'linear-gradient(135deg, #D4AF37, #C5A030)',
              boxShadow: scanning
                ? '0 0 20px rgba(212,175,55,0.3)'
                : '0 2px 8px rgba(212,175,55,0.25)',
            }}
          >
            <motion.span
              animate={scanning ? { rotate: 360 } : { rotate: 0 }}
              transition={scanning ? { duration: 1, repeat: Infinity, ease: 'linear' } : { duration: 0 }}
            >
              <RefreshCw className="w-4 h-4" />
            </motion.span>
            {scanning ? 'Scanning…' : 'Scan Now'}
          </motion.button>
        </div>

        {/* ─── Summary Cards ─── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {summaryCards.map((card, i) => (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.15 + i * 0.07, ease: [0.22, 1, 0.36, 1] }}
              whileHover={{ y: -3, transition: { duration: 0.2 } }}
              className="bg-white border border-gray-200 rounded-xl shadow-sm p-5"
            >
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                    {card.label}
                  </p>
                  <p className="text-3xl font-bold tabular-nums" style={{ color: card.color }}>
                    <AnimatedCounter value={card.value} />
                  </p>
                </div>
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: card.bg }}
                >
                  <card.icon className="w-5 h-5" style={{ color: card.color }} />
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* ─── Filters + Signal Feed ─── */}
        <div className="space-y-5">
          {/* Section heading */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
          >
            <div className="flex items-center gap-3">
              <div
                className="h-6 w-1.5 rounded-full"
                style={{
                  background: 'linear-gradient(180deg, #E8C860, #D4AF37, #9A8340)',
                  boxShadow: '0 0 12px rgba(212,175,55,0.3)',
                }}
              />
              <h2 className="text-lg font-bold text-foreground tracking-tight">Live Signal Feed</h2>
              <span className="text-xs text-muted-foreground bg-gray-100 px-2 py-0.5 rounded-full">
                {filteredSignals.length} signal{filteredSignals.length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Filter pills */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {filterPills.map(pill => {
                const isActive = activeFilter === pill.key;
                const count = pill.key === 'All'
                  ? demoSignals.length
                  : demoSignals.filter(s => s.type === pill.key).length;

                return (
                  <motion.button
                    key={pill.key}
                    onClick={() => setActiveFilter(pill.key)}
                    whileTap={{ scale: 0.95 }}
                    className={`relative inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                      isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground/80'
                    }`}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="signal-filter-pill"
                        className="absolute inset-0 rounded-full"
                        style={{
                          background: 'linear-gradient(135deg, rgba(212,175,55,0.12), rgba(212,175,55,0.06))',
                          border: '1px solid rgba(212,175,55,0.25)',
                        }}
                        transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                      />
                    )}
                    <span className="relative z-10">{pill.label}</span>
                    <span
                      className={`relative z-10 text-[10px] px-1.5 py-0.5 rounded-full ${
                        isActive
                          ? 'bg-[#D4AF37]/20 text-[#D4AF37] font-semibold'
                          : 'bg-gray-100 text-muted-foreground'
                      }`}
                    >
                      {count}
                    </span>
                  </motion.button>
                );
              })}
            </div>
          </motion.div>

          {/* Signal Cards */}
          <AnimatePresence mode="popLayout">
            {filteredSignals.length === 0 ? (
              <motion.div key="empty" exit={{ opacity: 0 }}>
                <EmptyState
                  icon={Radar}
                  title="No signals found"
                  description={`No ${activeFilter} signals detected in the current time range.`}
                />
              </motion.div>
            ) : (
              <div className="space-y-4">
                {filteredSignals.map((signal, index) => {
                  const tCfg = typeConfig[signal.type];
                  const pCfg = priorityConfig[signal.priority];
                  const TypeIcon = tCfg.icon;

                  return (
                    <motion.div
                      key={signal.id}
                      layout
                      initial={{ opacity: 0, y: 16, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.25 } }}
                      transition={{
                        duration: 0.4,
                        delay: index * 0.05,
                        ease: [0.22, 1, 0.36, 1],
                      }}
                      className="relative bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-shadow duration-300 overflow-hidden group"
                    >
                      <div className="p-5 sm:p-6">
                        {/* Top row: type badge, company, priority, timestamp */}
                        <div className="flex flex-wrap items-center gap-2.5 mb-3">
                          {/* Type badge */}
                          <span
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold"
                            style={{ background: tCfg.bg, color: tCfg.color }}
                          >
                            <TypeIcon className="w-3.5 h-3.5" />
                            {signal.type}
                          </span>

                          {/* Company name (clickable) */}
                          <button
                            onClick={() => navigateTo?.('company-detail', signal.companyId)}
                            className="text-sm font-semibold text-foreground hover:text-[#D4AF37] transition-colors cursor-pointer inline-flex items-center gap-1"
                          >
                            {signal.companyName}
                            <ChevronRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </button>

                          {/* Priority indicator */}
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold"
                            style={{ background: pCfg.bg, color: pCfg.color }}
                          >
                            {signal.priority === 'High' && <Zap className="w-3 h-3" />}
                            {pCfg.label}
                          </span>

                          {/* Source + timestamp */}
                          <span className="ml-auto text-xs text-muted-foreground hidden sm:inline-flex items-center gap-1.5">
                            <span className="inline-flex items-center gap-1 text-[11px] text-gray-400">
                              <Building2 className="w-3 h-3" />
                              {signal.source}
                            </span>
                            <span className="text-gray-300">·</span>
                            <Clock className="w-3 h-3" />
                            {signal.timestamp}
                          </span>
                        </div>

                        {/* Mobile timestamp */}
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3 sm:hidden">
                          <Building2 className="w-3 h-3" />
                          {signal.source}
                          <span className="text-gray-300">·</span>
                          <Clock className="w-3 h-3" />
                          {signal.timestamp}
                        </div>

                        {/* Title */}
                        <h3 className="text-[15px] font-semibold text-foreground mb-2 leading-snug">
                          {signal.title}
                        </h3>

                        {/* Description */}
                        <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                          {signal.description}
                        </p>

                        {/* Why it matters */}
                        <div className="rounded-lg bg-gray-50 border border-gray-100 p-4 mb-4">
                          <div className="flex items-center gap-2 mb-1.5">
                            <Lightbulb className="w-4 h-4 text-[#D4AF37]" />
                            <span className="text-xs font-semibold uppercase tracking-wider text-[#D4AF37]">
                              Why It Matters
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground leading-relaxed">
                            {signal.whyItMatters}
                          </p>
                        </div>

                        {/* Recommended Action */}
                        <div className="rounded-lg border border-gray-100 p-4" style={{ background: 'linear-gradient(135deg, rgba(212,175,55,0.03), transparent)' }}>
                          <div className="flex items-center gap-2 mb-1.5">
                            <Target className="w-4 h-4 text-foreground" />
                            <span className="text-xs font-semibold uppercase tracking-wider text-foreground">
                              Recommended Action
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground leading-relaxed">
                            {signal.recommendedAction}
                          </p>
                        </div>
                      </div>

                      {/* Left accent stripe */}
                      <div
                        className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                        style={{ background: `linear-gradient(180deg, ${tCfg.color}, ${tCfg.color}60)` }}
                      />
                    </motion.div>
                  );
                })}
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </PageTransition>
  );
}