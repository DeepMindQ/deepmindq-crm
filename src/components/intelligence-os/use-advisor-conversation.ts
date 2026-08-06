'use client';

/* ═══════════════════════════════════════════════════════════════
   MS9 §7 — useAdvisorConversation Hook
   
   Core state management hook for the AI Advisor conversation lifecycle.
   Manages messages, processing states, confidence tracking, and
   provides the API bridge between UI components and backend services.
   
   This is NOT a generic chat hook. Every state transition produces
   or consumes structured intelligence briefings with evidence
   grounding and confidence scoring.
   
   CORE PRINCIPLE: Intelligence briefing lifecycle, not chat.
   
   Tokens: N/A (logic only — components handle rendering)
   ═══════════════════════════════════════════════════════════════ */

import { useState, useCallback, useRef } from 'react';
import type {
  AdvisorMessage,
  AdvisorConversation,
  AdvisorProcessingState,
  AdvisorConnectionStatus,
  ConversationScope,
  AdvisorAccountContext,
  AdvisorMessageContent,
  StructuredBriefing,
  ConfidenceHistoryEntry,
  SignalPill,
  TrustFooter,
  ConfidenceFooter,
  InlineReasoning,
} from '@/types/ms9-advisor';
import {
  computeAverageConfidence,
  computeConfidenceDirection,
  validateBriefing,
  type AdvisorQueryRequest,
  type AdvisorQueryResponse,
} from '@/types/ms9-advisor';

// ── Hook Options ──────────────────────────────────────────

export interface UseAdvisorConversationOptions {
  /** Initial conversation data (for resuming) */
  initialConversation?: AdvisorConversation;
  
  /** Account context to bind briefings to */
  accountContext: AdvisorAccountContext;
  
  /** Conversation scope */
  scope?: ConversationScope;
  
  /** Callback to send query to backend API */
  sendQuery?: (request: AdvisorQueryRequest) => Promise<AdvisorQueryResponse>;
  
  /** Auto-scroll container ref ID (for message list auto-scroll) */
  autoScrollContainerId?: string;
}

// ── Hook Return Type ─────────────────────────────────────

export interface UseAdvisorConversationReturn {
  /** Current conversation messages */
  messages: AdvisorMessage[];
  
  /** Current processing state */
  processingState: AdvisorProcessingState;
  
  /** Connection status */
  connectionStatus: AdvisorConnectionStatus;
  
  /** Whether advisor is currently processing */
  isProcessing: boolean;
  
  /** Conversation scope */
  scope: ConversationScope;
  
  /** Account context */
  accountContext: AdvisorAccountContext;
  
  /** Conversation-level confidence history */
  confidenceHistory: ConfidenceHistoryEntry[];
  
  /** Active account name (or null) */
  activeAccountName: string | null;
  
  /** Active intelligence source count */
  activeSourceCount: number;
  
  /** Human-readable processing label */
  processingLabel: string;
  
  // ── Actions ──
  
  /** Submit an intelligence query */
  submitQuery: (query: string) => Promise<void>;
  
  /** Start a new briefing (clear conversation) */
  startNewBriefing: () => void;
  
  /** Provide feedback on a specific message */
  provideFeedback: (messageId: string, feedback: AdvisorMessage['feedback']) => void;
  
  /** Retry a failed message */
  retryLastMessage: () => Promise<void>;
  
  /** Update connection status */
  setConnectionStatus: (status: AdvisorConnectionStatus) => void;
  
  /** Update account context */
  setAccountContext: (context: Partial<AdvisorAccountContext>) => void;
}

// ── Processing State Labels ──────────────────────────────

const processingLabels: Record<AdvisorProcessingState, string> = {
  idle: 'Ready',
  retrieving: 'Retrieving intelligence data...',
  analyzing: 'Analyzing sources and evidence...',
  generating: 'Generating structured briefing...',
  grounding: 'Cross-referencing with evidence...',
  streaming: 'Delivering briefing...',
  waiting_input: 'Awaiting your question...',
};

// ── Helper: Generate unique IDs ──────────────────────────

function generateId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ── Helper: Build a user query message ────────────────────

function buildUserMessage(query: string, position: number): AdvisorMessage {
  return {
    id: generateId(),
    conversationId: '',
    role: 'user',
    status: 'delivered',
    position,
    createdAt: new Date().toISOString(),
    content: { type: 'user_query', text: query } as AdvisorMessageContent,
    queryText: query,
  };
}

// ── Helper: Build a typing indicator message ─────────────

function buildTypingIndicator(
  state: AdvisorProcessingState,
  position: number,
): AdvisorMessage {
  return {
    id: generateId(),
    conversationId: '',
    role: 'assistant',
    status: 'streaming',
    position,
    createdAt: new Date().toISOString(),
    content: { type: 'typing_indicator', state } as AdvisorMessageContent,
  };
}

// ── Helper: Build assistant message from API response ────

function buildAssistantMessage(
  briefing: StructuredBriefing,
  position: number,
  processingDurationMs: number,
): AdvisorMessage {
  return {
    id: generateId(),
    conversationId: '',
    role: 'assistant',
    status: 'delivered',
    position,
    createdAt: new Date().toISOString(),
    content: { type: 'structured_briefing', briefing } as AdvisorMessageContent,
    briefing,
    processing: {
      durationMs: processingDurationMs,
      sourcesConsulted: briefing.trustFooter.totalEvidenceCount,
      evidenceItemsReferenced: briefing.trustFooter.totalEvidenceCount,
    },
  };
}

// ── Hook Implementation ──────────────────────────────────

export function useAdvisorConversation({
  initialConversation,
  accountContext: initialAccountContext,
  scope: initialScope = 'general_intelligence',
  sendQuery,
}: UseAdvisorConversationOptions): UseAdvisorConversationReturn {
  // ── Core State ──
  const [messages, setMessages] = useState<AdvisorMessage[]>(
    initialConversation?.messages ?? [],
  );
  const [processingState, setProcessingState] = useState<AdvisorProcessingState>(
    initialConversation?.state.processingState ?? 'waiting_input',
  );
  const [connectionStatus, setConnectionStatus] = useState<AdvisorConnectionStatus>(
    initialConversation ? 'connected' : 'initializing',
  );
  const [scope, setScope] = useState<ConversationScope>(initialScope);
  const [accountContext, setAccountContextState] = useState<AdvisorAccountContext>(
    initialAccountContext,
  );
  const [confidenceHistory, setConfidenceHistory] = useState<ConfidenceHistoryEntry[]>(
    initialConversation?.confidenceHistory ?? [],
  );

  // Track last query for retry
  const lastQueryRef = useRef<string | null>(null);

  const isProcessing = processingState !== 'idle' && processingState !== 'waiting_input';
  const activeAccountName = accountContext.primaryAccount?.companyName ?? null;
  const activeSourceCount = accountContext.sourceStatus.activeSourceCount;
  const processingLabel = processingLabels[processingState];

  // ── Submit Query ───────────────────────────────────────

  const submitQuery = useCallback(
    async (query: string) => {
      if (!query.trim() || isProcessing) return;

      lastQueryRef.current = query;
      const position = messages.length + 1;

      // 1. Add user message
      const userMsg = buildUserMessage(query, position);
      setMessages((prev) => [...prev, userMsg]);

      // 2. Transition to processing states
      setProcessingState('retrieving');
      setTimeout(() => setProcessingState('analyzing'), 400);
      setTimeout(() => setProcessingState('generating'), 800);

      // 3. If sendQuery is provided, call the backend
      if (sendQuery) {
        try {
          setProcessingState('grounding');
          const request: AdvisorQueryRequest = {
            query: query.trim(),
            accountId: accountContext.primaryAccount?.companyId,
            depth: 'standard',
            includeReasoning: true,
          };

          const response = await sendQuery(request);
          const briefing = response.briefing;

          // Validate the briefing before rendering
          const validation = validateBriefing(briefing);
          if (!validation.valid) {
            console.warn('[MS9] Briefing validation failed:', validation.errors);
          }

          setProcessingState('streaming');

          // Build assistant message
          const assistantMsg = buildAssistantMessage(
            briefing,
            position + 1,
            response.processing.durationMs,
          );

          setMessages((prev) => [...prev, assistantMsg]);

          // Update confidence history
          setConfidenceHistory((prev) => {
            const lastEntry = prev[prev.length - 1];
            const newEntry: ConfidenceHistoryEntry = {
              messagePosition: assistantMsg.position,
              score: briefing.confidence.score,
              trustTier: briefing.confidence.trustTier,
              delta: computeConfidenceDirection(
                lastEntry?.score ?? null,
                briefing.confidence.score,
              ) === 'stable'
                ? 0
                : briefing.confidence.score - (lastEntry?.score ?? briefing.confidence.score),
              deltaExplanation: briefing.confidence.deltaExplanation ?? undefined,
            };
            return [...prev, newEntry];
          });

          setProcessingState('waiting_input');
        } catch (error) {
          // Build error message
          const errorMsg: AdvisorMessage = {
            id: generateId(),
            conversationId: '',
            role: 'assistant',
            status: 'error',
            position: position + 1,
            createdAt: new Date().toISOString(),
            content: {
              type: 'error',
              error: error instanceof Error ? error.message : 'Intelligence query failed',
              recoverable: true,
            } as AdvisorMessageContent,
          };
          setMessages((prev) => [...prev, errorMsg]);
          setProcessingState('waiting_input');
        }
      } else {
        // No backend — simulate with typing indicator then idle
        setTimeout(() => {
          setProcessingState('waiting_input');
          // Remove typing indicator after mock
        }, 1500);
      }
    },
    [messages.length, isProcessing, sendQuery, accountContext.primaryAccount, scope],
  );

  // ── Start New Briefing ────────────────────────────────

  const startNewBriefing = useCallback(() => {
    setMessages([]);
    setConfidenceHistory([]);
    setProcessingState('waiting_input');
    lastQueryRef.current = null;
  }, []);

  // ── Provide Feedback ───────────────────────────────────

  const provideFeedback = useCallback(
    (messageId: string, feedback: AdvisorMessage['feedback']) => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === messageId ? { ...msg, feedback } : msg,
        ),
      );
    },
    [],
  );

  // ── Retry Last Message ─────────────────────────────────

  const retryLastMessage = useCallback(async () => {
    const lastQuery = lastQueryRef.current;
    if (lastQuery) {
      // Remove the last error message and re-submit
      setMessages((prev) => {
        const withoutLastError = prev.filter(
          (msg) => !(msg.role === 'assistant' && msg.status === 'error'),
        );
        return withoutLastError;
      });
      await submitQuery(lastQuery);
    }
  }, [submitQuery]);

  // ── Set Account Context ────────────────────────────────

  const setAccountContext = useCallback((partial: Partial<AdvisorAccountContext>) => {
    setAccountContextState((prev) => ({ ...prev, ...partial }));
  }, []);

  return {
    messages,
    processingState,
    connectionStatus,
    isProcessing,
    scope,
    accountContext,
    confidenceHistory,
    activeAccountName,
    activeSourceCount,
    processingLabel,
    submitQuery,
    startNewBriefing,
    provideFeedback,
    retryLastMessage,
    setConnectionStatus,
    setAccountContext,
  };
}
