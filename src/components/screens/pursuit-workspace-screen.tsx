'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Crosshair, Trophy, XCircle, Pause,
  Building2, ChevronRight, Clock, AlertTriangle,
  User, MessageSquare, Loader2, Plus, ArrowRight,
  StickyNote, Target, Lightbulb, RefreshCw,
} from 'lucide-react';
import {
  PageTransition, StatCard, AnimatedCounter, TabBar, StaggerGrid,
  StaggerItem, EmptyState, SectionHeader, GlassPanel,
} from '@/components/ui/animated-components';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useAppStore } from '@/lib/store';
import { toast } from 'sonner';

/* ═══════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════ */
interface PursuitCompany {
  id: string;
  rawName: string;
  domain: string | null;
  industry: string | null;
}

interface PursuitOpportunity {
  id: string;
  opportunityTitle: string;
  businessProblem: string;
  recommendedCapability: string;
  opportunityScore: number;
  company: PursuitCompany;
}

interface Pursuit {
  id: string;
  owner: string | null;
  priority: string;
  status: string;
  nextAction: string | null;
  nextActionAt: string | null;
  outcomeStage: string | null;
  outcome: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  opportunity: PursuitOpportunity;
}

interface APIResponse {
  pursuits: Pursuit[];
  total: number;
}

/* ═══════════════════════════════════════════════════
   Constants
   ═══════════════════════════════════════════════════ */
const STAGES = ['discovery', 'qualification', 'proposal', 'negotiation', 'closed'] as const;
const STAGE_LABELS: Record<string, string> = {
  discovery: 'Discovery',
  qualification: 'Qualification',
  proposal: 'Proposal',
  negotiation: 'Negotiation',
  closed_won: 'Closed Won',
  closed_lost: 'Closed Lost',
  closed: 'Closed',
};

const PRIORITY_STYLES: Record<string, { bg: string; text: string; border: string; label: string }> = {
  high: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', label: 'High' },
  medium: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', label: 'Medium' },
  low: { bg: 'bg-gray-50', text: 'text-gray-500', border: 'border-gray-200', label: 'Low' },
};

/* ═══════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════ */
function getStageIndex(stage: string | null): number {
  if (!stage) return -1;
  if (stage === 'closed_won' || stage === 'closed_lost') return STAGES.length - 1;
  const idx = STAGES.indexOf(stage as typeof STAGES[number]);
  return idx >= 0 ? idx : -1;
}

function isOverdue(dateStr: string | null): boolean {
  if (!dateStr) return false;
  return new Date(dateStr) < new Date();
}

function formatDueDate(dateStr: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays === -1) return 'Yesterday';
  if (diffDays > 0 && diffDays <= 7) return `In ${diffDays} days`;
  if (diffDays < 0) return `${Math.abs(diffDays)} days overdue`;

  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/* ═══════════════════════════════════════════════════
   Stage Pipeline — horizontal step indicator
   ═══════════════════════════════════════════════════ */
function StagePipeline({ stage, onAdvance }: { stage: string | null; onAdvance?: () => void }) {
  const currentIndex = getStageIndex(stage);
  const isClosedWon = stage === 'closed_won';
  const isClosedLost = stage === 'closed_lost';

  return (
    <div className="flex items-center gap-0.5">
      {STAGES.map((s, i) => {
        const isReached = currentIndex >= i;
        const isCurrent = currentIndex === i && !isClosedWon && !isClosedLost;
        const isLast = i === STAGES.length - 1;

        return (
          <div key={s} className="flex items-center">
            <div className="flex flex-col items-center">
              <motion.div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold transition-all duration-300 ${
                  isClosedWon
                    ? 'bg-emerald-500 text-white ring-2 ring-emerald-200'
                    : isClosedLost
                    ? 'bg-red-400 text-white ring-2 ring-red-200'
                    : isCurrent
                    ? 'text-white ring-2 ring-amber-200'
                    : isReached
                    ? 'text-white'
                    : 'bg-gray-100 text-gray-400 border border-gray-200'
                }`}
                style={
                  isCurrent && !isClosedWon && !isClosedLost
                    ? {
                        background: 'linear-gradient(135deg, #E8C860, #D4AF37)',
                        boxShadow: '0 0 10px rgba(212, 175, 55, 0.35)',
                      }
                    : isReached && !isClosedWon && !isClosedLost
                    ? { background: 'var(--color-gold)' }
                    : undefined
                }
                initial={false}
                animate={{ scale: isCurrent ? 1.15 : 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              >
                {isReached && !isClosedWon && !isClosedLost && !isCurrent ? (
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : isClosedWon && !isLast ? (
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : isCurrent || (isClosedWon && isLast) || (isClosedLost && isLast) ? (
                  <Target className="w-3 h-3" />
                ) : (
                  i + 1
                )}
              </motion.div>
              <span
                className={`text-[9px] mt-1 whitespace-nowrap ${
                  isCurrent
                    ? 'font-bold text-amber-700'
                    : isReached
                    ? 'text-amber-600'
                    : 'text-gray-400'
                }`}
              >
                {STAGE_LABELS[s]}
              </span>
            </div>
            {!isLast && (
              <div className="flex items-center mx-0.5 mb-3">
                <div
                  className={`h-[2px] w-4 sm:w-6 rounded-full transition-colors duration-300 ${
                    currentIndex > i
                      ? isClosedWon
                        ? 'bg-emerald-400'
                        : isClosedLost
                        ? 'bg-red-300'
                        : 'bg-amber-400'
                      : 'bg-gray-200'
                  }`}
                />
                {isCurrent && onAdvance && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onAdvance();
                    }}
                    className="ml-0.5 w-5 h-5 rounded-full bg-amber-100 hover:bg-amber-200 flex items-center justify-center transition-colors group/adv"
                    title="Advance stage"
                  >
                    <ChevronRight className="w-3 h-3 text-amber-600 group-hover/adv:translate-x-0.5 transition-transform" />
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   Pursuit Card
   ═══════════════════════════════════════════════════ */
function PursuitCard({
  pursuit,
  onCompanyClick,
  onAdvanceStage,
  onAddNote,
  isUpdating,
}: {
  pursuit: Pursuit;
  onCompanyClick: (companyId: string) => void;
  onAdvanceStage: (pursuit: Pursuit) => void;
  onAddNote: (pursuit: Pursuit) => void;
  isUpdating: boolean;
}) {
  const priority = PRIORITY_STYLES[pursuit.priority] || PRIORITY_STYLES.low;
  const overdue = isOverdue(pursuit.nextActionAt);
  const stageIdx = getStageIndex(pursuit.outcomeStage);
  const isClosedWon = pursuit.status === 'won';
  const isClosedLost = pursuit.status === 'lost';

  return (
    <GlassPanel className="p-5 hover:shadow-md transition-all duration-300 group">
      {/* Top row: company + priority */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <button
              onClick={() => onCompanyClick(pursuit.opportunity.company.id)}
              className="flex items-center gap-1.5 hover:opacity-80 transition-opacity"
            >
              <Building2 className="w-3.5 h-3.5 text-primary" />
              <span className="text-sm font-semibold text-foreground hover:underline truncate max-w-[200px]">
                {pursuit.opportunity.company.rawName}
              </span>
            </button>
            {pursuit.opportunity.company.industry && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-gray-200 text-muted-foreground font-normal">
                {pursuit.opportunity.company.industry}
              </Badge>
            )}
            <Badge className={`text-[10px] px-1.5 py-0 border font-medium ${priority.bg} ${priority.text} ${priority.border}`}>
              {priority.label}
            </Badge>
            {isClosedWon && (
              <Badge className="text-[10px] px-1.5 py-0 border border-emerald-200 bg-emerald-50 text-emerald-700 font-medium">
                Won
              </Badge>
            )}
            {isClosedLost && (
              <Badge className="text-[10px] px-1.5 py-0 border border-red-200 bg-red-50 text-red-600 font-medium">
                Lost
              </Badge>
            )}
          </div>
          <h3 className="text-base font-bold text-foreground leading-snug mb-1 group-hover:text-primary/80 transition-colors">
            {pursuit.opportunity.opportunityTitle}
          </h3>
          {pursuit.opportunity.businessProblem && (
            <div className="flex items-start gap-1.5 text-xs text-muted-foreground leading-relaxed">
              <Target className="w-3 h-3 mt-0.5 text-primary shrink-0" />
              <p className="line-clamp-2">{pursuit.opportunity.businessProblem}</p>
            </div>
          )}
        </div>
        {/* Opportunity score ring */}
        <div className="relative flex-shrink-0 w-14 h-14">
          <svg width={56} height={56} className="-rotate-90">
            <circle cx={28} cy={28} r={22} fill="none" stroke="#F3F4F6" strokeWidth={4} />
            <circle
              cx={28} cy={28} r={22}
              fill="none"
              stroke={pursuit.opportunity.opportunityScore >= 70 ? '#059669' : pursuit.opportunity.opportunityScore >= 40 ? '#D97706' : '#DC2626'}
              strokeWidth={4}
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 22}
              strokeDashoffset={2 * Math.PI * 22 - (pursuit.opportunity.opportunityScore / 100) * 2 * Math.PI * 22}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xs font-bold tabular-nums">
              {pursuit.opportunity.opportunityScore}
            </span>
          </div>
        </div>
      </div>

      {/* Stage pipeline */}
      <div className="mb-4 px-1 py-2.5 rounded-lg bg-gray-50/80 border border-gray-100 overflow-x-auto scrollbar-hide">
        <StagePipeline
          stage={pursuit.outcomeStage}
          onAdvance={
            pursuit.status === 'active' && stageIdx < STAGES.length - 1 && !isClosedWon && !isClosedLost
              ? () => onAdvanceStage(pursuit)
              : undefined
          }
        />
      </div>

      {/* Meta info: owner, next action, capability */}
      <div className="space-y-2 mb-4">
        <div className="flex items-center gap-4 flex-wrap">
          {/* Owner */}
          <div className="flex items-center gap-1.5">
            <User className="w-3 h-3 text-muted-foreground" />
            <span className="text-[11px] text-muted-foreground">
              <span className="font-medium text-foreground/70">Owner:</span>{' '}
              {pursuit.owner || (
                <span className="text-amber-600 font-medium">Unassigned</span>
              )}
            </span>
          </div>

          {/* Next action */}
          {pursuit.nextAction && (
            <div className={`flex items-center gap-1.5 ${overdue ? 'text-red-600' : ''}`}>
              <Clock className={`w-3 h-3 ${overdue ? 'text-red-500' : 'text-muted-foreground'}`} />
              <span className={`text-[11px] ${overdue ? 'text-red-600 font-medium' : 'text-muted-foreground'}`}>
                {pursuit.nextAction}
                {pursuit.nextActionAt && (
                  <span className={overdue ? ' text-red-500' : ' text-muted-foreground/70'}>
                    {' · '}
                    {overdue && <AlertTriangle className="w-2.5 h-2.5 inline mr-0.5" />}
                    {formatDueDate(pursuit.nextActionAt)}
                  </span>
                )}
              </span>
            </div>
          )}
        </div>

        {/* Recommended capability */}
        {pursuit.opportunity.recommendedCapability && (
          <div className="flex items-center gap-1.5">
            <Lightbulb className="w-3 h-3 text-primary/60 shrink-0" />
            <span className="text-[11px] text-muted-foreground">
              <span className="font-medium text-foreground/70">Capability:</span>{' '}
              {pursuit.opportunity.recommendedCapability}
            </span>
          </div>
        )}

        {/* Notes preview */}
        {pursuit.notes && (
          <div className="flex items-start gap-1.5 px-2.5 py-1.5 rounded-lg bg-gray-50 border border-gray-100 max-h-12 overflow-hidden">
            <StickyNote className="w-3 h-3 text-muted-foreground shrink-0 mt-0.5" />
            <p className="text-[11px] text-muted-foreground line-clamp-2">{pursuit.notes}</p>
          </div>
        )}
      </div>

      {/* Actions */}
      {pursuit.status === 'active' && (
        <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onAdvanceStage(pursuit)}
            disabled={isUpdating || stageIdx >= STAGES.length - 1}
            className="h-8 px-3 text-xs border-amber-200 text-amber-700 hover:bg-amber-50 hover:text-amber-800 gap-1.5"
          >
            {isUpdating ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <ArrowRight className="w-3 h-3" />
            )}
            Advance Stage
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onAddNote(pursuit)}
            disabled={isUpdating}
            className="h-8 px-3 text-xs border-gray-200 text-muted-foreground hover:bg-gray-50 hover:text-foreground gap-1.5"
          >
            <MessageSquare className="w-3 h-3" />
            Add Note
          </Button>
          <span className="ml-auto text-[10px] text-muted-foreground/60 tabular-nums">
            Updated {new Date(pursuit.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </span>
        </div>
      )}
    </GlassPanel>
  );
}

/* ═══════════════════════════════════════════════════
   Stage Advance Dialog
   ═══════════════════════════════════════════════════ */
function AdvanceStageDialogInner({
  pursuit,
  onClose,
  onSubmit,
  isSubmitting,
}: {
  pursuit: Pursuit;
  onClose: () => void;
  onSubmit: (id: string, stage: string, notes: string) => void;
  isSubmitting: boolean;
}) {
  const currentIdx = getStageIndex(pursuit.outcomeStage);
  const defaultStage = currentIdx >= 0 && currentIdx < STAGES.length - 1
    ? STAGES[currentIdx + 1]
    : 'closed';
  const availableStages = STAGES.filter((_, i) => i > currentIdx);
  const [selectedStage, setSelectedStage] = useState(defaultStage);
  const [notes, setNotes] = useState('');

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 text-foreground">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: 'rgba(212, 175, 55, 0.12)' }}
          >
            <ArrowRight className="w-4 h-4" style={{ color: 'var(--color-gold)' }} />
          </div>
          Advance Stage
        </DialogTitle>
        <DialogDescription>
          Move <span className="font-medium text-foreground">{pursuit.opportunity.company.rawName}</span> to the next stage
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 py-2">
        {/* Current stage display */}
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-gray-50 border border-gray-100">
          <span className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">Current</span>
          <Badge
            className="text-xs px-2 py-0.5 border"
            style={{
              background: 'rgba(212, 175, 55, 0.1)',
              borderColor: 'rgba(212, 175, 55, 0.25)',
              color: '#B8941F',
            }}
          >
            {STAGE_LABELS[pursuit.outcomeStage || 'discovery']}
          </Badge>
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
          <span className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">Next</span>
        </div>

        {/* Stage select */}
        <div className="space-y-2">
          <Label className="text-xs font-medium text-foreground">Select Next Stage</Label>
          <Select value={selectedStage} onValueChange={(v) => setSelectedStage(v as typeof selectedStage)}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Select stage" />
            </SelectTrigger>
            <SelectContent>
              {availableStages.map((s) => (
                <SelectItem key={s} value={s}>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ background: 'var(--color-gold)' }}
                    />
                    {STAGE_LABELS[s]}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Notes */}
        <div className="space-y-2">
          <Label className="text-xs font-medium text-foreground">Notes (optional)</Label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add context about this stage change..."
            className="min-h-[80px] text-sm resize-none"
          />
        </div>
      </div>

      <DialogFooter className="gap-2 sm:gap-0">
        <Button
          variant="outline"
          onClick={onClose}
          className="h-9 px-4 text-xs"
        >
          Cancel
        </Button>
        <Button
          onClick={() => {
            if (selectedStage) {
              onSubmit(pursuit.id, selectedStage, notes);
            }
          }}
          disabled={!selectedStage || isSubmitting}
          className="h-9 px-4 text-xs gap-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white shadow-sm"
        >
          {isSubmitting ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <ArrowRight className="w-3.5 h-3.5" />
          )}
          Advance
        </Button>
      </DialogFooter>
    </>
  );
}

function AdvanceStageDialog(props: {
  pursuit: Pursuit | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (id: string, stage: string, notes: string) => void;
  isSubmitting: boolean;
}) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {props.pursuit && (
          <AdvanceStageDialogInner
            key={props.pursuit.id}
            pursuit={props.pursuit}
            onClose={() => props.onOpenChange(false)}
            onSubmit={props.onSubmit}
            isSubmitting={props.isSubmitting}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ═══════════════════════════════════════════════════
   Add Note Dialog
   ═══════════════════════════════════════════════════ */
function AddNoteDialogInner({
  pursuit,
  onClose,
  onSubmit,
  isSubmitting,
}: {
  pursuit: Pursuit;
  onClose: () => void;
  onSubmit: (id: string, notes: string) => void;
  isSubmitting: boolean;
}) {
  const [noteText, setNoteText] = useState(pursuit.notes || '');

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 text-foreground">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: 'rgba(212, 175, 55, 0.12)' }}
          >
            <MessageSquare className="w-4 h-4" style={{ color: 'var(--color-gold)' }} />
          </div>
          Pursuit Notes
        </DialogTitle>
        <DialogDescription>
          <span className="font-medium text-foreground">{pursuit.opportunity.company.rawName}</span> — {pursuit.opportunity.opportunityTitle}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-3 py-2">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 border border-gray-100">
          <span className="text-[11px] text-muted-foreground">Stage:</span>
          <Badge
            className="text-[10px] px-1.5 py-0 border"
            style={{
              background: 'rgba(212, 175, 55, 0.1)',
              borderColor: 'rgba(212, 175, 55, 0.25)',
              color: '#B8941F',
            }}
          >
            {STAGE_LABELS[pursuit.outcomeStage || 'discovery']}
          </Badge>
        </div>

        <div className="space-y-2">
          <Label className="text-xs font-medium text-foreground">Notes</Label>
          <Textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Add your pursuit notes here..."
            className="min-h-[120px] text-sm resize-none"
          />
        </div>
      </div>

      <DialogFooter className="gap-2 sm:gap-0">
        <Button
          variant="outline"
          onClick={onClose}
          className="h-9 px-4 text-xs"
        >
          Cancel
        </Button>
        <Button
          onClick={() => {
            onSubmit(pursuit.id, noteText);
          }}
          disabled={isSubmitting}
          className="h-9 px-4 text-xs gap-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white shadow-sm"
        >
          {isSubmitting ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Plus className="w-3.5 h-3.5" />
          )}
          Save Note
        </Button>
      </DialogFooter>
    </>
  );
}

function AddNoteDialog(props: {
  pursuit: Pursuit | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (id: string, notes: string) => void;
  isSubmitting: boolean;
}) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {props.pursuit && (
          <AddNoteDialogInner
            key={props.pursuit.id}
            pursuit={props.pursuit}
            onClose={() => props.onOpenChange(false)}
            onSubmit={props.onSubmit}
            isSubmitting={props.isSubmitting}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ═══════════════════════════════════════════════════
   Loading Skeleton
   ═══════════════════════════════════════════════════ */
function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      {/* Stats skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-gray-200 bg-white p-5 space-y-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-8 w-12" />
          </div>
        ))}
      </div>
      {/* Tab bar skeleton */}
      <Skeleton className="h-10 w-full max-w-md rounded-xl" />
      {/* Card skeletons */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
            <div className="flex items-start justify-between">
              <div className="space-y-2 flex-1">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-5 w-14" />
                </div>
                <Skeleton className="h-5 w-64" />
                <Skeleton className="h-3 w-full max-w-xs" />
              </div>
              <Skeleton className="h-14 w-14 rounded-full" />
            </div>
            {/* Stage pipeline skeleton */}
            <div className="px-1 py-2.5 rounded-lg bg-gray-50">
              <div className="flex items-center gap-1">
                {Array.from({ length: 5 }).map((_, j) => (
                  <div key={j} className="flex items-center gap-1">
                    <Skeleton className="h-6 w-6 rounded-full" />
                    {j < 4 && <Skeleton className="h-[2px] w-6" />}
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Skeleton className="h-3 w-48" />
              <Skeleton className="h-3 w-64" />
            </div>
            <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
              <Skeleton className="h-8 w-24" />
              <Skeleton className="h-8 w-20" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   Main Screen
   ═══════════════════════════════════════════════════ */
export default function PursuitWorkspaceScreen() {
  const [pursuits, setPursuits] = useState<Pursuit[]>([]);
  const [allPursuits, setAllPursuits] = useState<Pursuit[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('ALL');
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set());

  // Dialog state
  const [advancePursuit, setAdvancePursuit] = useState<Pursuit | null>(null);
  const [advanceOpen, setAdvanceOpen] = useState(false);
  const [notePursuit, setNotePursuit] = useState<Pursuit | null>(null);
  const [noteOpen, setNoteOpen] = useState(false);

  const setSelectedCompanyId = useAppStore((s) => s.setSelectedCompanyId);

  // Fetch pursuits
  const fetchPursuits = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/g-outreach/pursuits?status=active&limit=50&offset=0');
      if (!res.ok) throw new Error('Failed to fetch pursuits');
      const data: APIResponse = await res.json();
      setAllPursuits(data.pursuits);
    } catch {
      toast.error('Failed to load pursuits');
    } finally {
      setLoading(false);
    }
  }, []);

  // Also fetch won/lost/paused pursuits for stats
  const fetchAllStatuses = useCallback(async () => {
    try {
      const statuses = ['active', 'won', 'lost', 'paused'];
      const results = await Promise.allSettled(
        statuses.map(async (status) => {
          const res = await fetch(`/api/g-outreach/pursuits?status=${status}&limit=50&offset=0`);
          if (!res.ok) throw new Error(`Failed to fetch ${status} pursuits`);
          return res.json();
        }),
      );

      const all: Pursuit[] = [];
      results.forEach((result) => {
        if (result.status === 'fulfilled') {
          all.push(...result.value.pursuits);
        }
      });

      setAllPursuits(all);
    } catch {
      toast.error('Failed to load all pursuits');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAllStatuses();
  }, [fetchAllStatuses]);

  // Filtered pursuits by tab
  const filtered = useMemo(() => {
    if (activeTab === 'ALL') return allPursuits;
    return allPursuits.filter((p) => p.status === activeTab);
  }, [allPursuits, activeTab]);

  // Set filtered state for rendering
  useEffect(() => {
    setPursuits(filtered);
  }, [filtered]);

  // Status counts
  const counts = useMemo(() => {
    const c = { active: 0, won: 0, lost: 0, paused: 0, total: 0 };
    allPursuits.forEach((p) => {
      if (p.status in c) c[p.status as keyof typeof c]++;
      c.total++;
    });
    return c;
  }, [allPursuits]);

  // Tab definitions
  const tabs = useMemo(() => [
    { key: 'ALL', label: 'All', count: counts.total },
    { key: 'active', label: 'Active', count: counts.active },
    { key: 'won', label: 'Won', count: counts.won },
    { key: 'lost', label: 'Lost', count: counts.lost },
    { key: 'paused', label: 'Paused', count: counts.paused },
  ], [counts]);

  // Handle advance stage
  const handleAdvanceStage = useCallback((p: Pursuit) => {
    setAdvancePursuit(p);
    setAdvanceOpen(true);
  }, []);

  const handleAdvanceSubmit = useCallback(async (id: string, stage: string, notes: string) => {
    setUpdatingIds((prev) => new Set(prev).add(id));
    try {
      const body: Record<string, string> = { outcomeStage: stage };
      if (notes) body.notes = notes;
      const res = await fetch(`/api/g-outreach/pursuits/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Failed to advance stage');

      // Update local state
      setAllPursuits((prev) =>
        prev.map((p) =>
          p.id === id
            ? {
                ...p,
                outcomeStage: stage,
                status: stage === 'closed_won' ? 'won' : stage === 'closed_lost' ? 'lost' : p.status,
                notes: notes || p.notes,
                updatedAt: new Date().toISOString(),
              }
            : p,
        ),
      );

      toast.success('Stage advanced', {
        description: `Moved to ${STAGE_LABELS[stage] || stage}`,
      });
      setAdvanceOpen(false);
      setAdvancePursuit(null);
    } catch {
      toast.error('Failed to advance stage');
    } finally {
      setUpdatingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }, []);

  // Handle add note
  const handleAddNote = useCallback((p: Pursuit) => {
    setNotePursuit(p);
    setNoteOpen(true);
  }, []);

  const handleNoteSubmit = useCallback(async (id: string, notes: string) => {
    setUpdatingIds((prev) => new Set(prev).add(id));
    try {
      const res = await fetch(`/api/g-outreach/pursuits/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
      });
      if (!res.ok) throw new Error('Failed to save note');

      setAllPursuits((prev) =>
        prev.map((p) => (p.id === id ? { ...p, notes, updatedAt: new Date().toISOString() } : p)),
      );

      toast.success('Note saved');
      setNoteOpen(false);
      setNotePursuit(null);
    } catch {
      toast.error('Failed to save note');
    } finally {
      setUpdatingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }, []);

  // Handle company click
  const handleCompanyClick = useCallback((companyId: string) => {
    setSelectedCompanyId(companyId);
  }, [setSelectedCompanyId]);

  // Handle refresh
  const handleRefresh = useCallback(() => {
    fetchAllStatuses();
    toast.info('Refreshing pursuits...');
  }, [fetchAllStatuses]);

  return (
    <PageTransition>
      <div className="space-y-6 p-4 md:p-6 max-w-[1600px] mx-auto">
        {/* ─── Header ─── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div
                className="h-7 w-1.5 rounded-full"
                style={{
                  background: 'linear-gradient(180deg, #E8C860, #D4AF37, #9A8340)',
                  boxShadow: '0 0 12px rgba(212, 175, 55, 0.3)',
                }}
              />
              <h1 className="text-2xl font-bold text-foreground tracking-tight">
                Pursuit Tracker
              </h1>
            </div>
            <p className="text-sm text-muted-foreground ml-5">
              Track active pursuit progress
            </p>
          </div>
          <Button
            onClick={handleRefresh}
            variant="outline"
            className="gap-2 border-gray-200 text-muted-foreground hover:bg-gray-50 hover:text-foreground"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* ─── Stat Cards ─── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Active"
            value={counts.active}
            icon={Crosshair}
            color="var(--color-gold)"
            delay={0}
          />
          <StatCard
            label="Won"
            value={counts.won}
            icon={Trophy}
            color="#059669"
            delay={0.08}
          />
          <StatCard
            label="Lost"
            value={counts.lost}
            icon={XCircle}
            color="#DC2626"
            delay={0.16}
          />
          <StatCard
            label="Paused"
            value={counts.paused}
            icon={Pause}
            color="#6B7280"
            delay={0.24}
          />
        </div>

        {/* ─── Tab Bar ─── */}
        <TabBar tabs={tabs} active={activeTab} onChange={setActiveTab} />

        {/* ─── Content ─── */}
        {loading ? (
          <LoadingSkeleton />
        ) : pursuits.length === 0 ? (
          <EmptyState
            icon={Crosshair}
            title={activeTab === 'ALL' ? 'No pursuits yet' : `No ${activeTab} pursuits`}
            description={
              activeTab === 'ALL'
                ? 'Accepted opportunities will appear here as active pursuits to track.'
                : `There are no ${activeTab} pursuits to display.`
            }
            action={
              <Button
                onClick={handleRefresh}
                variant="outline"
                className="gap-2 border-primary/30 text-primary hover:bg-primary/5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Refresh
              </Button>
            }
          />
        ) : (
          <StaggerGrid
            className="grid grid-cols-1 lg:grid-cols-2 gap-4"
            stagger={0.06}
          >
            <AnimatePresence mode="popLayout">
              {pursuits.map((pursuit) => (
                <StaggerItem key={pursuit.id}>
                  <PursuitCard
                    pursuit={pursuit}
                    onCompanyClick={handleCompanyClick}
                    onAdvanceStage={handleAdvanceStage}
                    onAddNote={handleAddNote}
                    isUpdating={updatingIds.has(pursuit.id)}
                  />
                </StaggerItem>
              ))}
            </AnimatePresence>
          </StaggerGrid>
        )}
      </div>

      {/* ─── Dialogs ─── */}
      <AdvanceStageDialog
        pursuit={advancePursuit}
        open={advanceOpen}
        onOpenChange={setAdvanceOpen}
        onSubmit={handleAdvanceSubmit}
        isSubmitting={advancePursuit ? updatingIds.has(advancePursuit.id) : false}
      />
      <AddNoteDialog
        pursuit={notePursuit}
        open={noteOpen}
        onOpenChange={setNoteOpen}
        onSubmit={handleNoteSubmit}
        isSubmitting={notePursuit ? updatingIds.has(notePursuit.id) : false}
      />
    </PageTransition>
  );
}