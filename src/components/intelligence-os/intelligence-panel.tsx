'use client';

import { useState, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, ChevronLeft, Brain, Sparkles, Loader2,
  ArrowRight, ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { tokens } from './design-tokens';

/* ═══════════════════════════════════════════════════
   IntelligencePanel — Contextual Intelligence Surface
   
   A slide-over panel that provides deep intelligence
   context for any entity (company, contact, opportunity).
   Composes IntelligenceNarrative and EvidenceChain
   into a focused, exploratory view.
   
   Principles:
   - Compose Don't Monolith: Uses narrative + evidence primitives
   - Minimal Surface Maximum Depth: Panel reveals intelligence on demand
   - One Theme One Voice: Consistent intelligence language
   - Contextual Intelligence: Appears where needed
   ═══════════════════════════════════════════════════ */

export interface IntelligencePanelSection {
  id: string;
  title: string;
  content: ReactNode;
  icon?: typeof Brain;
}

export interface IntelligencePanelProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  entityName?: string;
  entityType?: 'company' | 'contact' | 'opportunity' | 'signal';
  intelligenceScore?: number;
  sections?: IntelligencePanelSection[];
  loading?: boolean;
  children?: ReactNode;
  className?: string;
}

export function IntelligencePanel({
  open,
  onClose,
  title,
  subtitle,
  entityName,
  entityType,
  intelligenceScore,
  sections = [],
  loading = false,
  children,
  className,
}: IntelligencePanelProps) {
  const [activeSection, setActiveSection] = useState<string | null>(
    sections[0]?.id || null
  );

  // Reset active section when sections change
  if (sections.length > 0 && !activeSection) {
    setActiveSection(sections[0].id);
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40"
            style={{ background: 'rgba(0, 0, 0, 0.5)', backdropFilter: 'blur(4px)' }}
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className={cn(
              'fixed right-0 top-0 bottom-0 z-50 w-full max-w-lg flex flex-col border-l',
              className
            )}
            style={{
              background: tokens.surface.secondary,
              borderColor: tokens.border.default,
            }}
          >
            {/* ── Panel Header ── */}
            <div
              className="px-5 py-4 shrink-0"
              style={{ borderBottom: `1px solid ${tokens.border.subtle}` }}
            >
              <div className="flex items-center justify-between mb-3">
                <button
                  onClick={onClose}
                  className="flex items-center gap-1.5 text-xs font-medium transition-colors"
                  style={{ color: tokens.text.secondary }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = tokens.text.primary; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = tokens.text.secondary; }}
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  Back
                </button>
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-lg transition-colors"
                  style={{ color: tokens.text.muted }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = tokens.surface.elevated; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Entity info */}
              <div className="flex items-start gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: tokens.accent.subtle }}
                >
                  <Sparkles className="w-5 h-5" style={{ color: tokens.accent.bright }} />
                </div>
                <div className="flex-1 min-w-0">
                  {title && (
                    <h2 className="text-base font-bold leading-tight" style={{ color: tokens.text.primary }}>
                      {title}
                    </h2>
                  )}
                  {subtitle && (
                    <p className="text-xs mt-0.5" style={{ color: tokens.text.secondary }}>{subtitle}</p>
                  )}
                  <div className="flex items-center gap-2 mt-1.5">
                    {entityName && (
                      <span className="text-[10px] font-medium" style={{ color: tokens.text.muted }}>
                        {entityName}
                      </span>
                    )}
                    {entityType && (
                      <span className="text-[10px]" style={{ color: tokens.text.muted }}>
                        · {entityType}
                      </span>
                    )}
                    {intelligenceScore !== undefined && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold" style={{ color: tokens.accent.bright }}>
                        <Brain className="w-2.5 h-2.5" />
                        {intelligenceScore}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* ── Section Navigation ── */}
            {sections.length > 0 && (
              <div
                className="px-5 py-2.5 shrink-0 flex items-center gap-1 overflow-x-auto scrollbar-hide"
                style={{ borderBottom: `1px solid ${tokens.border.subtle}` }}
              >
                {sections.map((section) => {
                  const isActive = activeSection === section.id;
                  return (
                    <button
                      key={section.id}
                      onClick={() => setActiveSection(section.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium whitespace-nowrap transition-colors"
                      style={{
                        background: isActive ? tokens.accent.subtle : 'transparent',
                        color: isActive ? tokens.accent.bright : tokens.text.muted,
                      }}
                    >
                      {section.title}
                    </button>
                  );
                })}
              </div>
            )}

            {/* ── Panel Content ── */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <Loader2 className="w-6 h-6 animate-spin" style={{ color: tokens.accent.DEFAULT }} />
                  <span className="text-xs" style={{ color: tokens.text.secondary }}>
                    Loading intelligence...
                  </span>
                </div>
              ) : children ? (
                children
              ) : (
                sections.map((section) => (
                  <div key={section.id} className={cn(activeSection === section.id ? 'block' : 'hidden')}>
                    {section.content}
                  </div>
                ))
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
