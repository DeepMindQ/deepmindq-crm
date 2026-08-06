'use client';

/* ═══════════════════════════════════════════════════════════════
   MS9 §3 — Advisor Conversation Panel (Organism)
   
   The complete left-panel AI Advisor conversation experience.
   Composes: AdvisorHeader + ConversationHistory + AdvisorInputArea
   
   This is NOT a generic chat panel. Every interaction produces
   structured intelligence briefings with evidence grounding,
   confidence scoring, and TRUST integration.
   
   CORE PRINCIPLE: Intelligence briefing interface, not chatbot.
   
   MS6 Reference: .conversation-panel in reference_ai_advisor.html
   Tokens: surface.base, border.default, text hierarchy
   ═══════════════════════════════════════════════════════════════ */

import { useCallback, useState } from 'react';
import { cn } from '@/lib/utils';
import { AdvisorHeader } from './molecules/advisor-header';
import { ConversationHistory } from './molecules/conversation-history';
import { AdvisorInputArea } from './molecules/advisor-input-area';
import type {
  AdvisorMessage,
  AdvisorProcessingState,
  AdvisorConnectionStatus,
  ConversationScope,
} from '@/types/ms9-advisor';

export interface AdvisorConversationPanelProps {
  /** Current conversation messages */
  messages: AdvisorMessage[];
  
  /** Whether the advisor is currently processing a response */
  isProcessing?: boolean;
  
  /** Current processing state */
  processingState?: AdvisorProcessingState;
  
  /** Connection status of the advisor */
  connectionStatus?: AdvisorConnectionStatus;
  
  /** Active account name (null if no account context) */
  activeAccountName?: string | null;
  
  /** Number of active intelligence sources */
  activeSourceCount?: number;
  
  /** Callback when user submits a query */
  onQuerySubmit: (query: string) => void;
  
  /** Callback when user requests a new briefing */
  onNewBriefing?: () => void;
  
  /** Callback when user opens history */
  onHistory?: () => void;
  
  /** Callback when "Explore further" is clicked */
  onExploreFurther?: (explorationId?: string) => void;
  
  /** Callback when a signal pill is clicked */
  onSignalClick?: (signalId: string) => void;
  
  /** Conversation scope — for future context-aware placeholder text */
  scope?: ConversationScope;
  
  /** Optional additional CSS classes */
  className?: string;
}

/** Scope → placeholder text mapping */
const scopePlaceholders: Record<ConversationScope, string> = {
  account_intelligence: 'Ask about this account\'s intelligence, signals, or risk...',
  market_intelligence: 'Ask about market trends, segments, or dynamics...',
  competitive_analysis: 'Ask about competitive positioning, moves, or threats...',
  signal_investigation: 'Dig deeper into a specific signal or evidence chain...',
  general_intelligence: 'Ask about any account, market, or intelligence signal...',
};

export function AdvisorConversationPanel({
  messages,
  isProcessing = false,
  processingState = 'analyzing',
  connectionStatus = 'connected',
  activeAccountName = null,
  activeSourceCount = 0,
  onQuerySubmit,
  onNewBriefing,
  onHistory,
  onExploreFurther,
  onSignalClick,
  scope = 'general_intelligence',
  className,
}: AdvisorConversationPanelProps) {
  const [localProcessingState, setLocalProcessingState] = useState<AdvisorProcessingState>(processingState);

  // Update local processing state when prop changes
  useState(() => {
    setLocalProcessingState(processingState);
  });

  const handleSubmit = useCallback(
    (query: string) => {
      onQuerySubmit(query);
    },
    [onQuerySubmit],
  );

  return (
    <div
      className={cn(
        'flex flex-col h-full',
        className,
      )}
      style={{
        backgroundColor: 'var(--surface-base, var(--bg))',
        borderRight: '1px solid var(--border-default, var(--border))',
      }}
    >
      {/* Header — advisor identity, status, context chips */}
      <AdvisorHeader
        activeAccountName={activeAccountName}
        connectionStatus={connectionStatus}
        activeSourceCount={activeSourceCount}
        onNewBriefing={onNewBriefing}
        onHistory={onHistory}
      />

      {/* Conversation history — scrollable message list */}
      <ConversationHistory
        messages={messages}
        isProcessing={isProcessing}
        processingState={localProcessingState}
        onExploreFurther={onExploreFurther}
        onSignalClick={onSignalClick}
      />

      {/* Input area — intelligence query entry */}
      <AdvisorInputArea
        onSubmit={handleSubmit}
        isProcessing={isProcessing}
        placeholder={scopePlaceholders[scope]}
      />
    </div>
  );
}
