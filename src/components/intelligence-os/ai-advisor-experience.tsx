'use client';

/* ═══════════════════════════════════════════════════════════════
   MS9 §6 — AI Advisor Experience (Page Organism)
   
   The complete AI Advisor page layout — the single entry point
   for the MS9 Intelligence Advisor experience.
   
   Composes:
   - AdvisorConversationPanel (left: conversation + briefings)
   - AdvisorContextSidebar (right: account context grounding)
   - HumanAssistanceBanner (overlay: escalation trigger)
   - HumanAssistanceDialog (modal: escalation submission)
   - AdvisorWorkspacePanel (slide-out: saved briefings workspace)
   
   This is NOT a chat page. This is an intelligence briefing
   command center where AI delivers structured, evidence-grounded
   briefings with confidence scores, trust integration, and
   human escalation paths.
   
   CORE PRINCIPLE: Intelligence briefing partner, not chatbot.
   
   MS6 Reference: .main-content layout in reference_ai_advisor.html
   Tokens: Full design token system — no hardcoded values
   ═══════════════════════════════════════════════════════════════ */

import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { AdvisorConversationPanel } from './advisor-conversation-panel';
import { AdvisorContextSidebar } from './advisor-context-sidebar';
import { AdvisorWorkspacePanel } from './advisor-workspace-panel';
import { HumanAssistanceBanner } from './molecules/human-assistance-banner';
import { HumanAssistanceDialog } from './molecules/human-assistance-dialog';
import type {
  AdvisorMessage,
  AdvisorProcessingState,
  AdvisorConnectionStatus,
  ConversationScope,
  ContextSidebarData,
  HumanAssistanceEntry,
  AdvisorWorkspace,
  WorkspaceItem,
  PriorityLevel,
} from '@/types/ms9-advisor';

export interface AIAdvisorExperienceProps {
  // ── Conversation State ──
  /** Current conversation messages */
  messages: AdvisorMessage[];
  
  /** Whether the advisor is currently processing */
  isProcessing?: boolean;
  
  /** Current processing state */
  processingState?: AdvisorProcessingState;
  
  /** Connection status */
  connectionStatus?: AdvisorConnectionStatus;
  
  /** Active account name (null if no context) */
  activeAccountName?: string | null;
  
  /** Active intelligence source count */
  activeSourceCount?: number;
  
  /** Conversation scope */
  scope?: ConversationScope;
  
  // ── Context Sidebar ──
  /** Context sidebar data */
  contextSidebarData: ContextSidebarData;
  
  // ── Workspace ──
  /** User workspace data */
  workspace: AdvisorWorkspace;
  
  // ── Human Assistance ──
  /** Active human assistance entry (null if none) */
  humanAssistanceEntry?: HumanAssistanceEntry | null;
  
  // ── Callbacks ──
  /** User submits an intelligence query */
  onQuerySubmit: (query: string) => void;
  
  /** User requests a new briefing */
  onNewBriefing?: () => void;
  
  /** User opens conversation history */
  onHistory?: () => void;
  
  /** User clicks "Explore further" on a trust footer */
  onExploreFurther?: (explorationId?: string) => void;
  
  /** User clicks a signal pill */
  onSignalClick?: (signalId: string) => void;
  
  /** User clicks the active account in the sidebar */
  onAccountClick?: (companyId: string) => void;
  
  /** User clicks a related account */
  onRelatedAccountClick?: (companyId: string) => void;
  
  /** User clicks a data freshness entry */
  onFreshnessClick?: (label: string) => void;
  
  /** User escalates to human assistance */
  onEscalate?: (entryId: string, request: {
    reason: HumanAssistanceEntry['reason'];
    priority: PriorityLevel;
    description: string;
  }) => void;
  
  /** User dismisses human assistance banner */
  onDismissAssistance?: (entryId: string) => void;
  
  /** User selects a workspace item */
  onWorkspaceItemSelect?: (item: WorkspaceItem) => void;
  
  /** Optional additional CSS classes */
  className?: string;
}

export function AIAdvisorExperience({
  messages,
  isProcessing = false,
  processingState = 'analyzing',
  connectionStatus = 'connected',
  activeAccountName = null,
  activeSourceCount = 0,
  scope = 'general_intelligence',
  contextSidebarData,
  workspace,
  humanAssistanceEntry = null,
  onQuerySubmit,
  onNewBriefing,
  onHistory,
  onExploreFurther,
  onSignalClick,
  onAccountClick,
  onRelatedAccountClick,
  onFreshnessClick,
  onEscalate,
  onDismissAssistance,
  onWorkspaceItemSelect,
  className,
}: AIAdvisorExperienceProps) {
  // ── Local UI State ──
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [assistanceDialogOpen, setAssistanceDialogOpen] = useState(false);

  // ── Handlers ──
  const handleWorkspaceToggle = useCallback(() => {
    setWorkspaceOpen((prev) => !prev);
  }, []);

  const handleEscalate = useCallback(
    (entryId: string) => {
      setAssistanceDialogOpen(true);
    },
    [],
  );

  const handleAssistanceSubmit = useCallback(
    (request: {
      reason: HumanAssistanceEntry['reason'];
      priority: PriorityLevel;
      description: string;
    }) => {
      if (humanAssistanceEntry && onEscalate) {
        onEscalate(humanAssistanceEntry.id, request);
      }
      setAssistanceDialogOpen(false);
    },
    [humanAssistanceEntry, onEscalate],
  );

  return (
    <div
      className={cn('flex flex-col w-full', className)}
      style={{ backgroundColor: 'var(--surface-base, #0a0c10)' }}
    >
      {/* ── Main Content: Two-Panel Layout ── */}
      <div className="flex flex-1 min-h-0">
        {/* Left Panel — Conversation & Briefings (65%) */}
        <div className="flex flex-col" style={{ flex: '0 0 65%' }}>
          <AdvisorConversationPanel
            messages={messages}
            isProcessing={isProcessing}
            processingState={processingState}
            connectionStatus={connectionStatus}
            activeAccountName={activeAccountName}
            activeSourceCount={activeSourceCount}
            scope={scope}
            onQuerySubmit={onQuerySubmit}
            onNewBriefing={onNewBriefing}
            onHistory={handleWorkspaceToggle}
            onExploreFurther={onExploreFurther}
            onSignalClick={onSignalClick}
          />

          {/* Human Assistance Banner — shown below conversation */}
          {humanAssistanceEntry && (
            <div className="px-8 pb-4">
              <HumanAssistanceBanner
                entry={humanAssistanceEntry}
                onEscalate={handleEscalate}
                onDismiss={onDismissAssistance}
              />
            </div>
          )}
        </div>

        {/* Right Panel — Context Sidebar (35%) */}
        <div style={{ flex: '0 0 35%' }}>
          <AdvisorContextSidebar
            data={contextSidebarData}
            onAccountClick={onAccountClick}
            onRelatedAccountClick={onRelatedAccountClick}
            onFreshnessClick={onFreshnessClick}
          />
        </div>
      </div>

      {/* ── Workspace Panel (Slide-out Overlay) ── */}
      <AdvisorWorkspacePanel
        workspace={workspace}
        open={workspaceOpen}
        onClose={() => setWorkspaceOpen(false)}
        onItemSelect={onWorkspaceItemSelect}
        onNewBriefing={onNewBriefing}
      />

      {/* ── Human Assistance Dialog (Modal Overlay) ── */}
      {humanAssistanceEntry && (
        <HumanAssistanceDialog
          open={assistanceDialogOpen}
          onClose={() => setAssistanceDialogOpen(false)}
          onSubmit={handleAssistanceSubmit}
          preselectedReason={humanAssistanceEntry.reason}
          preselectedPriority={humanAssistanceEntry.priority}
          accountName={humanAssistanceEntry.contextSnapshot.accountName}
          currentConfidence={humanAssistanceEntry.contextSnapshot.confidenceScore}
          evidenceCount={humanAssistanceEntry.contextSnapshot.evidenceCount}
          signalCount={humanAssistanceEntry.contextSnapshot.signalCount}
        />
      )}
    </div>
  );
}
