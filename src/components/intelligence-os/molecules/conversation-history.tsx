'use client';

/* ═══════════════════════════════════════════════════════════════
   MS9 §3 — Conversation History (Molecule)
   
   Scrollable message list that renders the conversation turns.
   Handles AI messages, user messages, typing indicators, and
   system events. Uses discriminated union rendering based on
   AdvisorMessageContent type.
   
   MS6 Reference: .conversation-history in reference_ai_advisor.html
   Tokens: surface.base bg, auto-scroll behavior
   ═══════════════════════════════════════════════════════════════ */

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { AdvisorMessageBubble } from '../atoms/advisor-message-bubble';
import { UserMessageBubble } from './user-message-bubble';
import { TypingIndicator } from '../atoms/typing-indicator';
import { InlineReasoningBlock } from './inline-reasoning-block';
import { StructuredBriefingRenderer } from '../structured-briefing-renderer';
import type {
  AdvisorMessage,
  AdvisorProcessingState,
  SignalPill,
  TrustSourceReference,
  ConfidenceFooter as ConfidenceFooterType,
  InlineReasoning,
} from '@/types/ms9-advisor';
import {
  isStructuredBriefingContent,
  isUserQueryContent,
  isTypingIndicator,
} from '@/types/ms9-advisor';

export interface ConversationHistoryProps {
  /** Ordered list of advisor messages */
  messages: AdvisorMessage[];
  
  /** Whether the advisor is currently processing (shows typing indicator) */
  isProcessing?: boolean;
  
  /** Processing state for the typing indicator */
  processingState?: AdvisorProcessingState;
  
  /** Callback when "Explore further" is clicked */
  onExploreFurther?: (explorationId?: string) => void;
  
  /** Callback when a signal pill is clicked */
  onSignalClick?: (signalId: string) => void;
  
  /** Callback when reasoning expansion is toggled */
  onReasoningToggle?: (reasoningId: string) => void;
  
  /** Optional additional CSS classes */
  className?: string;
}

/** Format ISO timestamp to short display */
function formatTimestamp(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  } catch {
    return '';
  }
}

export function ConversationHistory({
  messages,
  isProcessing = false,
  processingState = 'analyzing',
  onExploreFurther,
  onSignalClick,
  className,
}: ConversationHistoryProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive or processing starts
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length, isProcessing]);

  return (
    <div
      ref={scrollRef}
      className={cn(
        'flex-1 overflow-y-auto px-8 flex flex-col gap-6',
        className,
      )}
      style={{
        /* Custom scrollbar */
        scrollbarWidth: 'thin',
        scrollbarColor: 'var(--border-default, var(--border)) transparent',
      }}
    >
      {messages.map((message) => {
        // User message
        if (isUserQueryContent(message.content)) {
          return (
            <UserMessageBubble
              key={message.id}
              text={message.content.text}
              timestamp={formatTimestamp(message.createdAt)}
            />
          );
        }

        // Typing indicator
        if (isTypingIndicator(message.content)) {
          return (
            <TypingIndicator
              key={message.id}
              state={message.content.state}
            />
          );
        }

        // System event — minimal rendering
        if (message.content.type === 'system_event') {
          return (
            <div
              key={message.id}
              className="text-center text-[11px] font-mono text-[var(--text-muted)] py-1"
            >
              {message.content.event}
            </div>
          );
        }

        // Error message
        if (message.content.type === 'error') {
          return (
            <div
              key={message.id}
              className="flex justify-center"
            >
              <div
                className="px-4 py-2 rounded-lg text-[12px] text-[var(--risk-red)]"
                style={{
                  backgroundColor: 'rgba(239, 68, 68, 0.08)',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                }}
              >
                {message.content.error}
                {message.content.recoverable && (
                  <span className="ml-1 text-[var(--text-muted)]">(Retry available)</span>
                )}
              </div>
            </div>
          );
        }

        // Structured briefing (AI assistant message)
        if (isStructuredBriefingContent(message.content)) {
          const briefing = message.content.briefing;

          // Extract sub-components from the structured briefing
          const signalPills: SignalPill[] = briefing.signalPills ?? [];
          const trustSources: TrustSourceReference[] = briefing.trustFooter.sources ?? [];
          const confidence: ConfidenceFooterType | undefined = briefing.confidence;
          const inlineReasoning: InlineReasoning | undefined = briefing.inlineReasoning;

          return (
            <div key={message.id} className="flex flex-col gap-3">
              <AdvisorMessageBubble
                signalPills={signalPills}
                trustSources={trustSources}
                confidence={confidence}
                timestamp={formatTimestamp(message.createdAt)}
                showBadge
              >
                {/* Structured briefing summary text */}
                <span>{briefing.summary}</span>
              </AdvisorMessageBubble>

              {/* Structured briefing blocks — the CORE MS9 rendering */}
              {briefing.blocks.length > 0 && (
                <div className="ml-11">
                  <StructuredBriefingRenderer
                    blocks={briefing.blocks}
                    onSignalClick={onSignalClick}
                  />
                </div>
              )}

              {/* Inline reasoning block (if present) */}
              {inlineReasoning && (
                <div className="ml-11">
                  <InlineReasoningBlock reasoning={inlineReasoning} />
                </div>
              )}

              {/* Explore further link */}
              {briefing.trustFooter.hasExplorationLink && (
                <div className="ml-11">
                  <button
                    type="button"
                    onClick={() => onExploreFurther?.(briefing.trustFooter.explorationId)}
                    className="inline-flex items-center gap-1 text-[12px] font-medium transition-colors duration-150"
                    style={{ color: 'var(--accent)' }}
                  >
                    Explore further
                    <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" width="12" height="12">
                      <path d="M4 2 L9 6 L4 10" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
          );
        }

        // Fallback — should never reach here if types are exhaustive
        return null;
      })}

      {/* Live typing indicator when processing */}
      {isProcessing && (
        <TypingIndicator state={processingState} />
      )}
    </div>
  );
}
