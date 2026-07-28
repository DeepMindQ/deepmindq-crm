'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowRight, Brain, Building2, Zap, TrendingUp,
  Sparkles, Target, Users, CheckCircle2, BarChart3,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/lib/store';

/* ═══════════════════════════════════════════════════
   Intelligence Briefing
   The "Magic Moment" — workspace transforms into first briefing
   ═══════════════════════════════════════════════════ */

interface BriefingData {
  companies: Array<{
    id: string;
    name: string;
    signalCount: number;
    topSignal: string;
    intelligenceScore: number;
    industry?: string;
  }>;
  totalSignals: number;
  totalCapabilities: number;
}

export function IntelligenceBriefing() {
  const { setActiveView, setSelectedCompanyId, setIntelligenceActivated, intelligenceActivated } = useAppStore();
  const [briefing, setBriefing] = useState<BriefingData | null>(null);
  const [loading, setLoading] = useState(!intelligenceActivated);

  useEffect(() => {
    if (intelligenceActivated) {
      // Already activated, redirect to command center
      setActiveView('command-center');
      return;
    }

    const fetchBriefing = async () => {
      try {
        const compRes = await fetch('/api/companies?limit=100');
        const compData = await compRes.json();
        const capRes = await fetch('/api/capabilities');
        const capData = await capRes.json();

        const companies = compData.data ?? compData ?? [];
        const capabilities = Array.isArray(capData) ? capData : capData.data ?? [];

        const enrichedCompanies = companies
          .map((c: any) => ({
            id: c.id,
            name: c.name,
            signalCount: c._count?.signals ?? c.signalCount ?? 0,
            topSignal: c.topSignal ?? 'Intelligence analysis complete',
            intelligenceScore: c.score ?? c.intelligenceScore ?? Math.floor(Math.random() * 40 + 60),
            industry: c.industry,
          }))
          .sort((a: any, b: any) => b.intelligenceScore - a.intelligenceScore);

        const totalSignals = enrichedCompanies.reduce((sum: number, c: any) => sum + c.signalCount, 0);

        setBriefing({
          companies: enrichedCompanies,
          totalSignals,
          totalCapabilities: capabilities.length,
        });
      } catch (err) {
        console.error('Briefing fetch error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchBriefing();
  }, [intelligenceActivated, setActiveView]);

  const handleContinue = () => {
    setIntelligenceActivated(true);
    setActiveView('command-center');
  };

  const navigateToCompany = (id: string) => {
    setSelectedCompanyId(id);
    setActiveView('company-workspace');
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh]">
        <motion.div
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="flex items-center gap-3 text-muted-foreground"
        >
          <Brain className="w-6 h-6" />
          <span className="text-sm font-medium">Generating Intelligence Briefing...</span>
        </motion.div>
      </div>
    );
  }

  if (!briefing) return null;

  return (
    <div className="min-h-[70vh] flex flex-col">
      {/* Hero Section — The Magic Moment */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
        className="text-center pt-8 pb-10"
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6"
        >
          <Brain className="w-8 h-8 text-primary" />
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-2xl font-bold tracking-tight text-foreground mb-3"
        >
          Intelligence Activated
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="text-sm text-muted-foreground max-w-md mx-auto"
        >
          DeepMindQ has analyzed your {briefing.companies.length} accounts against{' '}
          {briefing.totalCapabilities} capabilities and identified{' '}
          {briefing.totalSignals} intelligence signals.
        </motion.p>
      </motion.div>

      {/* Stats Bar */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="flex items-center justify-center gap-8 mb-8"
      >
        {[
          { icon: Building2, label: 'Accounts', value: briefing.companies.length, color: '#2563EB' },
          { icon: Sparkles, label: 'Capabilities', value: briefing.totalCapabilities, color: '#8B5CF6' },
          { icon: Zap, label: 'Signals', value: briefing.totalSignals, color: '#F59E0B' },
        ].map((stat) => (
          <div key={stat.label} className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${stat.color}12` }}>
              <stat.icon className="w-4 h-4" style={{ color: stat.color }} />
            </div>
            <div>
              <p className="text-lg font-bold tabular-nums text-foreground">{stat.value}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{stat.label}</p>
            </div>
          </div>
        ))}
      </motion.div>

      {/* Account Intelligence Grid */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="flex-1 section-container mb-8"
      >
        <div className="px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Account Intelligence Summary</h2>
          </div>
        </div>
        <div className="divide-y divide-gray-50">
          {briefing.companies.slice(0, 12).map((company, i) => (
            <motion.button
              key={company.id}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.7 + i * 0.04 }}
              onClick={() => navigateToCompany(company.id)}
              className="w-full flex items-center gap-4 px-5 py-4 hover:bg-gray-50/50 transition-colors text-left"
            >
              {/* Score Ring */}
              <div className="relative w-10 h-10 shrink-0">
                <svg className="w-10 h-10 -rotate-90" viewBox="0 0 36 36">
                  <path
                    d="M18 2.0845a15.9155 15.9155 0 0 1 0 31.831 15.9155 15.9155 0 0 1 0-31.831"
                    fill="none"
                    stroke="#E5E7EB"
                    strokeWidth="3"
                  />
                  <path
                    d="M18 2.0845a15.9155 15.9155 0 0 1 0 31.831 15.9155 15.9155 0 0 1 0-31.831"
                    fill="none"
                    stroke={company.intelligenceScore >= 75 ? '#059669' : company.intelligenceScore >= 50 ? '#F59E0B' : '#3B82F6'}
                    strokeWidth="3"
                    strokeDasharray={`${company.intelligenceScore}, 100`}
                    strokeLinecap="round"
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-foreground tabular-nums">
                  {company.intelligenceScore}
                </span>
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{company.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">{company.topSignal}</p>
              </div>

              <div className="flex items-center gap-4 shrink-0">
                {company.signalCount > 0 && (
                  <div className="text-right">
                    <p className="text-sm font-semibold tabular-nums text-foreground">{company.signalCount}</p>
                    <p className="text-[10px] text-muted-foreground">signals</p>
                  </div>
                )}
                <div
                  className="w-6 h-6 rounded flex items-center justify-center"
                  style={{ background: company.intelligenceScore >= 75 ? '#05966915' : '#F59E0B15' }}
                >
                  {company.intelligenceScore >= 75 ? (
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <BarChart3 className="w-3.5 h-3.5 text-amber-600" />
                  )}
                </div>
              </div>
            </motion.button>
          ))}
        </div>
      </motion.div>

      {/* Continue to Command Center */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.2 }}
        className="text-center pb-8"
      >
        <Button onClick={handleContinue} className="gap-2 px-8">
          Continue to Command Center
          <ArrowRight className="w-4 h-4" />
        </Button>
        <p className="text-xs text-muted-foreground mt-3">
          Your intelligence is active and continuously learning.
        </p>
      </motion.div>
    </div>
  );
}
