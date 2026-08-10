'use client';

import { motion } from 'framer-motion';
import { tokens } from '@/components/intelligence-os/design-tokens';
import {
  Upload, Brain, Sparkles, Target, ArrowRight, CheckCircle2,
  Building2, Users, FileSpreadsheet
} from 'lucide-react';

interface FirstExperienceGuideProps {
  onNavigate: (screen: string) => void;
  hasCompanies: boolean;
  hasContacts: boolean;
  hasImported: boolean;
}

const STEPS = [
  {
    id: 'import',
    title: 'Import Your Data',
    description: 'Upload company and contact data to unlock AI intelligence. CSV, Excel, or CRM exports.',
    icon: Upload,
    action: 'data-import',
    cta: 'Import Data',
  },
  {
    id: 'analyze',
    title: 'AI Analyzes Everything',
    description: 'DeepMindQ runs 17-stage intelligence pipeline: company profiling, signal detection, contact enrichment.',
    icon: Brain,
    action: null,
    cta: null,
  },
  {
    id: 'intelligence',
    title: 'Intelligence Appears',
    description: 'AI insights, buying signals, relationship maps, and revenue scores \u2014 all auto-generated.',
    icon: Sparkles,
    action: 'signal-intelligence',
    cta: 'View AI Insights',
  },
  {
    id: 'action',
    title: 'Take Action',
    description: 'Win probability, conversation strategies, and executive briefs \u2014 ready for your next move.',
    icon: Target,
    action: 'opportunity-radar',
    cta: 'View Opportunities',
  },
];

export function FirstExperienceGuide({ onNavigate, hasCompanies, hasContacts, hasImported }: FirstExperienceGuideProps) {
  // Don't show if user already has data
  if (hasCompanies || hasContacts) return null;

  return (
    <div className="flex flex-col items-center justify-center py-16 px-6" style={{ minHeight: '60vh' }}>
      {/* Welcome header */}
      <motion.div
        className="text-center mb-12"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <div className="w-14 h-14 rounded-xl mx-auto mb-5 flex items-center justify-center"
          style={{ background: tokens.accent.subtle, border: '1.5px solid rgba(59,130,246,0.2)' }}>
          <Sparkles className="w-7 h-7" style={{ color: tokens.accent.DEFAULT }} />
        </div>
        <h1 className="text-2xl font-bold tracking-tight mb-3" style={{ color: tokens.text.primary }}>
          Welcome to DeepMindQ
        </h1>
        <p className="text-base" style={{ color: tokens.text.secondary, maxWidth: '480px' }}>
          Your Enterprise Intelligence OS is ready. Follow these steps to unlock AI-powered intelligence.
        </p>
      </motion.div>

      {/* Steps */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 w-full" style={{ maxWidth: '960px' }}>
        {STEPS.map((step, i) => {
          const Icon = step.icon;
          return (
            <motion.div
              key={step.id}
              className="relative flex flex-col p-5 rounded-xl"
              style={{
                background: tokens.surface.card,
                border: '1px solid {tokens.border.default}',
              }}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
            >
              {/* Step number */}
              <div className="absolute -top-3 -left-3 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                style={{ background: tokens.accent.dim, color: tokens.flat.white }}>
                {i + 1}
              </div>

              <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-4 mt-1"
                style={{ background: tokens.accent.subtle }}>
                <Icon className="w-5 h-5" style={{ color: tokens.accent.DEFAULT }} />
              </div>

              <h3 className="text-sm font-semibold mb-2" style={{ color: tokens.text.primary }}>{step.title}</h3>
              <p className="text-xs leading-relaxed flex-1" style={{ color: tokens.text.secondary }}>{step.description}</p>

              {step.cta && (
                <button
                  onClick={() => step.action && onNavigate(step.action)}
                  className="mt-4 flex items-center gap-1.5 text-xs font-semibold transition-colors"
                  style={{ color: tokens.accent.DEFAULT }}
                >
                  {step.cta}
                  <ArrowRight className="w-3 h-3" />
                </button>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Bottom CTA */}
      <motion.div
        className="mt-10 flex items-center gap-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        <button
          onClick={() => onNavigate('data-import')}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-semibold transition-all"
          style={{ background: 'linear-gradient(135deg, {tokens.accent.dim}, {tokens.accent.DEFAULT})', color: tokens.flat.white }}
        >
          <Upload className="w-4 h-4" />
          Start by Importing Data
        </button>
      </motion.div>
    </div>
  );
}