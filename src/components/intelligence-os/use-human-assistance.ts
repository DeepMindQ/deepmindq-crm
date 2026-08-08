'use client';

/* ═══════════════════════════════════════════════════════════════
   MS9 §7 — useHumanAssistance Hook
   
   Manages human assistance escalation state for the AI Advisor.
   Controls banner visibility, dialog state, and escalation submission.
   
   This is NOT a generic notification hook. It manages the
   intelligence escalation lifecycle — from detection of low
   confidence to expert review submission.
   
   Tokens: N/A (logic only — components handle rendering)
   ═══════════════════════════════════════════════════════════════ */

import { useState, useCallback, useMemo } from 'react';
import type {
  HumanAssistanceEntry,
  PriorityLevel,
  AdvisorMessage,
} from '@/types/ms9-advisor';

// ── Hook Options ──────────────────────────────────────────

export interface UseHumanAssistanceOptions {
  /** Callback to submit escalation to backend */
  submitEscalation?: (request: {
    conversationId: string;
    messageId: string;
    reason: HumanAssistanceEntry['reason'];
    priority: PriorityLevel;
    description: string;
    contextSnapshot: HumanAssistanceEntry['contextSnapshot'];
  }) => Promise<void>;
  
  /** Confidence threshold below which escalation is suggested (default: 40) */
  confidenceThreshold?: number;
  
  /** Whether auto-detection of low confidence is enabled (default: true) */
  autoDetect?: boolean;
}

// ── Hook Return Type ──────────────────────────────────────

export interface UseHumanAssistanceReturn {
  /** Active human assistance entry (null if none active) */
  activeEntry: HumanAssistanceEntry | null;
  
  /** Whether the escalation dialog is open */
  dialogOpen: boolean;
  
  /** Whether any escalation has been submitted in this session */
  hasSubmitted: boolean;
  
  /** Dismissed entry IDs (to prevent re-showing) */
  dismissedIds: Set<string>;
  
  // ── Actions ──
  
  /** Open the escalation dialog */
  openDialog: () => void;
  
  /** Close the escalation dialog */
  closeDialog: () => void;
  
  /** Submit an escalation request */
  submitEscalationRequest: (request: {
    reason: HumanAssistanceEntry['reason'];
    priority: PriorityLevel;
    description: string;
  }) => Promise<void>;
  
  /** Dismiss the active escalation banner */
  dismissBanner: () => void;
  
  /** Manually trigger escalation for a specific reason */
  triggerEscalation: (params: {
    conversationId: string;
    messageId: string;
    reason: HumanAssistanceEntry['reason'];
    priority: PriorityLevel;
    accountName: string | null;
    confidenceScore: number;
    evidenceCount: number;
    signalCount: number;
  }) => void;
  
  /** Evaluate a message for potential escalation triggers */
  evaluateMessage: (message: AdvisorMessage) => HumanAssistanceEntry | null;
  
  /** Clear all escalation state */
  reset: () => void;
}

// ── Helper: Generate unique IDs ──────────────────────────

function generateId(): string {
  return `esc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ── Hook Implementation ──────────────────────────────────

export function useHumanAssistance({
  submitEscalation: submitEscalationCb,
  confidenceThreshold = 40,
  autoDetect = true,
}: UseHumanAssistanceOptions = {}): UseHumanAssistanceReturn {
  const [activeEntry, setActiveEntry] = useState<HumanAssistanceEntry | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [lastMessageRef, setLastMessageRef] = useState<{
    conversationId: string;
    messageId: string;
  }>({ conversationId: '', messageId: '' });

  // ── Open/Close Dialog ──────────────────────────────────

  const openDialog = useCallback(() => {
    setDialogOpen(true);
  }, []);

  const closeDialog = useCallback(() => {
    setDialogOpen(false);
  }, []);

  // ── Dismiss Banner ──────────────────────────────────────

  const dismissBanner = useCallback(() => {
    if (activeEntry) {
      setDismissedIds((prev) => new Set(prev).add(activeEntry.id));
      setActiveEntry(null);
    }
  }, [activeEntry]);

  // ── Submit Escalation ──────────────────────────────────

  const submitEscalationRequest = useCallback(
    async (request: {
      reason: HumanAssistanceEntry['reason'];
      priority: PriorityLevel;
      description: string;
    }) => {
      if (!activeEntry || !submitEscalationCb) return;

      try {
        await submitEscalationCb({
          conversationId: lastMessageRef.conversationId,
          messageId: lastMessageRef.messageId,
          reason: request.reason,
          priority: request.priority,
          description: request.description,
          contextSnapshot: activeEntry.contextSnapshot,
        });

        setHasSubmitted(true);
        setActiveEntry(null);
        setDialogOpen(false);
      } catch (error) {
        console.error('[MS9] Escalation submission failed:', error);
      }
    },
    [activeEntry, submitEscalationCb, lastMessageRef],
  );

  // ── Trigger Escalation ─────────────────────────────────

  const triggerEscalation = useCallback((params: {
    conversationId: string;
    messageId: string;
    reason: HumanAssistanceEntry['reason'];
    priority: PriorityLevel;
    accountName: string | null;
    confidenceScore: number;
    evidenceCount: number;
    signalCount: number;
  }) => {
    setLastMessageRef({
      conversationId: params.conversationId,
      messageId: params.messageId,
    });

    const entry: HumanAssistanceEntry = {
      id: generateId(),
      conversationId: params.conversationId,
      messageId: params.messageId,
      reason: params.reason,
      priority: params.priority,
      description: '',
      status: 'requested',
      requestedAt: new Date().toISOString(),
      contextSnapshot: {
        accountName: params.accountName,
        confidenceScore: params.confidenceScore,
        evidenceCount: params.evidenceCount,
        signalCount: params.signalCount,
      },
    };

    setActiveEntry(entry);
  }, []);

  // ── Evaluate Message for Escalation Triggers ──────────

  const evaluateMessage = useCallback(
    (message: AdvisorMessage): HumanAssistanceEntry | null => {
      if (!autoDetect) return null;
      if (message.role !== 'assistant') return null;
      if (!message.briefing) return null;

      const { briefing } = message;
      const confidence = briefing.confidence.score;

      // Check for low confidence
      if (confidence < confidenceThreshold) {
        return {
          id: generateId(),
          conversationId: message.conversationId,
          messageId: message.id,
          reason: 'low_confidence',
          priority: confidence < 25 ? 'critical' : 'high',
          description: `AI confidence (${confidence}%) is below the ${confidenceThreshold}% threshold.`,
          status: 'requested',
          requestedAt: new Date().toISOString(),
          contextSnapshot: {
            accountName: briefing.accountContext.primaryAccount?.companyName ?? null,
            confidenceScore: confidence,
            evidenceCount: briefing.trustFooter.totalEvidenceCount,
            signalCount: briefing.accountContext.activeSignalCount,
          },
        };
      }

      // Check for conflicting evidence (multiple sources with wide confidence spread)
      const sourceConfidences = briefing.trustFooter.sources.map((s) => {
        // Derive a rough confidence proxy from trust tier
        const tierScores: Record<string, number> = {
          verified: 95,
          high: 80,
          medium: 55,
          low: 35,
          unverified: 15,
        };
        return tierScores[s.trustTier] ?? 50;
      });

      if (sourceConfidences.length >= 3) {
        const max = Math.max(...sourceConfidences);
        const min = Math.min(...sourceConfidences);
        if (max - min > 50) {
          return {
            id: generateId(),
            conversationId: message.conversationId,
            messageId: message.id,
            reason: 'conflicting_evidence',
            priority: 'high',
            description: 'Sources show significant disagreement in trust levels.',
            status: 'requested',
            requestedAt: new Date().toISOString(),
            contextSnapshot: {
              accountName: briefing.accountContext.primaryAccount?.companyName ?? null,
              confidenceScore: confidence,
              evidenceCount: briefing.trustFooter.totalEvidenceCount,
              signalCount: briefing.accountContext.activeSignalCount,
            },
          };
        }
      }

      return null;
    },
    [autoDetect, confidenceThreshold],
  );

  // ── Reset ──────────────────────────────────────────────

  const reset = useCallback(() => {
    setActiveEntry(null);
    setDialogOpen(false);
    setHasSubmitted(false);
    setDismissedIds(new Set());
  }, []);

  return {
    activeEntry: activeEntry && !dismissedIds.has(activeEntry.id) ? activeEntry : null,
    dialogOpen,
    hasSubmitted,
    dismissedIds,
    openDialog,
    closeDialog,
    submitEscalationRequest,
    dismissBanner,
    triggerEscalation,
    evaluateMessage,
    reset,
  };
}
