'use client';

import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Building2,
  CheckCircle2,
  Globe,
  Briefcase,
  MapPin,
  Loader2,
  Plus,
} from 'lucide-react';
import type { CompanyResolutionCandidate, ResolutionConfidence } from '@/lib/intelligence-sources/types';

// ─── Props ──────────────────────────────────────────────────────
interface CompanyResolutionModalProps {
  open: boolean;
  onClose: () => void;
  companyName: string;
  candidates: CompanyResolutionCandidate[];
  onConfirm: (companyId: string) => void;
  onCreateNew: (companyName: string) => void;
  loading?: boolean;
}

// ─── Match Type Badge Config ───────────────────────────────────
const MATCH_TYPE_CONFIG: Record<
  ResolutionConfidence,
  { label: string; className: string }
> = {
  domain_match: {
    label: 'Domain',
    className: 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10',
  },
  exact_name: {
    label: 'Exact',
    className: 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10',
  },
  alias_match: {
    label: 'Alias',
    className: 'border-sky-500/30 text-sky-400 bg-sky-500/10',
  },
  partial_name: {
    label: 'Partial',
    className: 'border-amber-500/30 text-amber-400 bg-amber-500/10',
  },
  no_match: {
    label: 'None',
    className: 'border-red-400/30 text-red-400 bg-red-400/10',
  },
};

// ─── Confidence Color Helpers ───────────────────────────────────
function getConfidenceColor(confidence: number) {
  if (confidence >= 0.85) return 'bg-emerald-500';
  if (confidence >= 0.75) return 'bg-sky-500';
  return 'bg-amber-500';
}

function getConfidenceTextColor(confidence: number) {
  if (confidence >= 0.85) return 'text-emerald-400';
  if (confidence >= 0.75) return 'text-sky-400';
  return 'text-amber-400';
}

// ─── Animation Variants ─────────────────────────────────────────
const listVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.04 },
  },
  exit: {
    opacity: 0,
    transition: { staggerChildren: 0.02, staggerDirection: -1 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 8, scale: 0.97 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: 'spring', stiffness: 400, damping: 25 },
  },
  exit: {
    opacity: 0,
    y: -4,
    scale: 0.97,
    transition: { duration: 0.15 },
  },
};

// ─── Component ──────────────────────────────────────────────────
export default function CompanyResolutionModal({
  open,
  onClose,
  companyName,
  candidates,
  onConfirm,
  onCreateNew,
  loading = false,
}: CompanyResolutionModalProps) {
  const sortedCandidates = useMemo(
    () => [...candidates].sort((a, b) => b.confidence - a.confidence),
    [candidates],
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen && !loading) onClose();
      }}
    >
      <DialogContent className="max-w-lg border-border/50"
        style={{ background: 'oklch(0.11 0.01 260)' }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <div className="w-7 h-7 rounded-md flex items-center justify-center"
              style={{ background: 'oklch(0.16 0.02 160)' }}
            >
              <Building2 className="w-4 h-4 text-emerald-400" />
            </div>
            Resolve Company
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Multiple matches found for{' '}
            <span className="text-foreground font-medium">
              &ldquo;{companyName}&rdquo;
            </span>
            . Select the correct company or create a new one.
          </DialogDescription>
        </DialogHeader>

        {/* Candidate list */}
        <div className="max-h-72 overflow-y-auto pr-1 custom-scrollbar">
          {sortedCandidates.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center justify-center py-10 space-y-3"
            >
              <div className="w-12 h-12 rounded-full flex items-center justify-center"
                style={{ background: 'oklch(0.16 0.01 260)' }}
              >
                <Building2 className="w-6 h-6 text-muted-foreground" />
              </div>
              <div className="text-center space-y-1">
                <p className="text-sm font-medium text-muted-foreground">
                  No candidates found
                </p>
                <p className="text-xs text-muted-foreground/70">
                  Create a new company entry below
                </p>
              </div>
            </motion.div>
          ) : (
            <AnimatePresence mode="popLayout">
              <motion.div
                key="candidate-list"
                variants={listVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="space-y-2"
              >
                {sortedCandidates.map((candidate) => (
                  <motion.div
                    key={candidate.companyId}
                    variants={cardVariants as any}
                    layout
                    className={
                      'flex items-center justify-between p-3 rounded-lg ' +
                      'border border-border/60 group transition-colors ' +
                      'hover:border-border'
                    }
                    style={{ background: 'oklch(0.14 0.015 260)' }}
                  >
                    {/* Left: icon + info */}
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div
                        className="w-9 h-9 rounded-md flex items-center justify-center shrink-0"
                        style={{ background: 'oklch(0.18 0.015 260)' }}
                      >
                        <Building2 className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground truncate">
                          {candidate.name}
                        </p>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          {candidate.domain && (
                            <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground">
                              <Globe className="w-3 h-3" />
                              {candidate.domain}
                            </span>
                          )}
                          {candidate.industry && (
                            <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground">
                              <Briefcase className="w-3 h-3" />
                              {candidate.industry}
                            </span>
                          )}
                          {candidate.country && (
                            <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground">
                              <MapPin className="w-3 h-3" />
                              {candidate.country}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right: badges + select button */}
                    <div className="flex items-center gap-2.5 shrink-0 ml-3">
                      {/* Match type badge */}
                      <Badge
                        variant="outline"
                        className={MATCH_TYPE_CONFIG[candidate.matchType].className}
                      >
                        {MATCH_TYPE_CONFIG[candidate.matchType].label}
                      </Badge>

                      {/* Confidence bar + percentage */}
                      <div className="flex items-center gap-1.5">
                        <div
                          className="w-14 h-1.5 rounded-full overflow-hidden"
                          style={{ background: 'oklch(0.20 0.01 260)' }}
                        >
                          <motion.div
                            className={`h-full rounded-full ${getConfidenceColor(candidate.confidence)}`}
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.round(candidate.confidence * 100)}%` }}
                            transition={{ duration: 0.5, delay: 0.15 }}
                          />
                        </div>
                        <span
                          className={`text-xs font-semibold tabular-nums min-w-[34px] text-right ${getConfidenceTextColor(candidate.confidence)}`}
                        >
                          {Math.round(candidate.confidence * 100)}%
                        </span>
                      </div>

                      {/* Select button */}
                      <Button
                        size="sm"
                        className="h-7 px-2.5 text-xs gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{
                          background:
                            'linear-gradient(135deg, oklch(0.75 0.18 160), oklch(0.70 0.15 180))',
                          color: '#000',
                        }}
                        onClick={() => onConfirm(candidate.companyId)}
                        disabled={loading}
                      >
                        {loading ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-3 h-3" />
                        )}
                        Select
                      </Button>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            </AnimatePresence>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="secondary"
            className="gap-2"
            onClick={() => onCreateNew(companyName)}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
            Create New Company
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
