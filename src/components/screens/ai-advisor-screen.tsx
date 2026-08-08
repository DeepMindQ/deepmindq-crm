/**
 * MS9 Integration Layer — AI Advisor Screen
 * ===========================================
 *
 * The "live" screen wrapper that wires the completed MS9 AIAdvisorExperience
 * component with real API connections. This is the bridge between the
 * MS9 UI architecture and the MS9 Integration Layer backend.
 *
 * This component:
 *   1. Creates real account context from Context Builders
 *   2. Connects useAdvisorConversation.sendQuery → POST /api/ai/advisor
 *   3. Connects useAdvisorWorkspace.persistWorkspace → POST /api/ai/advisor/workspace
 *   4. Connects useHumanAssistance.submitEscalation → POST /api/ai/advisor/escalation
 *   5. Provides real context sidebar data from Context Builders
 *
 * NO changes to existing MS9 UI components are required.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { AIAdvisorExperience } from '@/components/intelligence-os/ai-advisor-experience';
import { useAdvisorConversation } from '@/components/intelligence-os/use-advisor-conversation';
import { useAdvisorWorkspace } from '@/components/intelligence-os/use-advisor-workspace';
import { useHumanAssistance } from '@/components/intelligence-os/use-human-assistance';
import { buildAdvisorAccountContext, buildContextSidebarData } from '@/lib/advisor/context-builders';
import type {
  AdvisorAccountContext,
  ContextSidebarData,
  AdvisorQueryRequest,
  AdvisorQueryResponse,
  AdvisorWorkspace,
  WorkspaceItem,
  PriorityLevel,
} from '@/types/ms9-advisor';
import { useAppStore } from '@/lib/store';
import { FeedbackForm } from '@/components/feedback/feedback-form';
import { ErrorBoundary } from '@/components/error-boundary';

export default function AIAdvisorScreen() {
  const selectedCompanyId = useAppStore((s: any) => s.selectedCompanyId);
  const [accountContext, setAccountContext] = useState<AdvisorAccountContext>({
    primaryAccount: null,
    activeSignals: [],
    activeSignalCount: 0,
    relatedAccounts: [],
    dataFreshness: [],
    sourceStatus: { activeSourceCount: 0, sources: [], connectionStatus: 'connected' },
  });
  const [sidebarData, setSidebarData] = useState<ContextSidebarData>({
    currentContext: {
      companyId: '',
      companyName: 'Loading...',
      fields: [],
      trustScore: { score: 0, tier: 'unverified', maxScore: 100 },
    },
    relatedAccounts: [],
    dataFreshness: [],
    activeSignalsSummary: { total: 0, critical: 0, high: 0, medium: 0, low: 0 },
  });

  // ── Load account context when company is selected ──
  useEffect(() => {
    if (!selectedCompanyId) return;

    let cancelled = false;

    (async () => {
      try {
        const [ctx, sidebar] = await Promise.all([
          buildAdvisorAccountContext({ companyId: selectedCompanyId }),
          buildContextSidebarData({ companyId: selectedCompanyId }),
        ]);

        if (!cancelled) {
          setAccountContext(ctx);
          setSidebarData(sidebar);
        }
      } catch (err) {
        console.error('[AIAdvisor] Failed to load context:', err);
      }
    })();

    return () => { cancelled = true; };
  }, [selectedCompanyId]);

  // ── Real API: sendQuery callback ──
  const sendQuery = useCallback(async (
    request: AdvisorQueryRequest,
  ): Promise<AdvisorQueryResponse> => {
    const response = await fetch('/api/ai/advisor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || `Advisor API error: ${response.status}`);
    }

    return response.json();
  }, []);

  // ── Real API: persistWorkspace callback ──
  const persistWorkspace = useCallback(async (workspace: AdvisorWorkspace) => {
    if (!selectedCompanyId) return;

    try {
      await fetch('/api/ai/advisor/workspace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: `company-${selectedCompanyId}`,
          workspace,
        }),
      });
    } catch (err) {
      console.error('[AIAdvisor] Failed to persist workspace:', err);
    }
  }, [selectedCompanyId]);

  // ── Real API: submitEscalation callback ──
  const submitEscalation = useCallback(async (request: {
    conversationId: string;
    messageId: string;
    reason: 'low_confidence' | 'conflicting_evidence' | 'complex_analysis' | 'data_gap' | 'user_request';
    priority: 'critical' | 'high' | 'medium' | 'low';
    description: string;
    contextSnapshot: any;
  }) => {
    await fetch('/api/ai/advisor/escalation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...request,
        contextSnapshot: JSON.stringify(request.contextSnapshot),
      }),
    });
  }, []);

  // ── Initialize hooks with real API callbacks ──
  const conversationState = useAdvisorConversation({
    accountContext,
    scope: selectedCompanyId ? 'account_intelligence' : 'general_intelligence',
    sendQuery,
  });

  const workspaceState = useAdvisorWorkspace({
    persistWorkspace,
  });

  const humanAssistanceState = useHumanAssistance({
    submitEscalation,
    confidenceThreshold: 40,
    autoDetect: true,
  });

  // ── Event handlers matching AIAdvisorExperience contract ──
  const handleQuerySubmit = (query: string) => conversationState.submitQuery(query);

  const handleEscalate = (
    _entryId: string,
    request: {
      reason: 'low_confidence' | 'conflicting_evidence' | 'complex_analysis' | 'data_gap' | 'user_request';
      priority: PriorityLevel;
      description: string;
    },
  ) => {
    humanAssistanceState.submitEscalationRequest({
      reason: request.reason,
      priority: request.priority,
      description: request.description,
    });
  };

  const handleDismissAssistance = () => humanAssistanceState.dismissBanner();

  const handleWorkspaceItemSelect = () => { /* Future */ };

  return (
    <ErrorBoundary>
      <div className="relative">
        <AIAdvisorExperience
          // Conversation state
          messages={conversationState.messages}
          isProcessing={conversationState.isProcessing}
          processingState={conversationState.processingState}
          connectionStatus={conversationState.connectionStatus}
          activeAccountName={conversationState.activeAccountName}
          activeSourceCount={conversationState.activeSourceCount}
          scope={selectedCompanyId ? 'account_intelligence' : 'general_intelligence'}

          // Context sidebar
          contextSidebarData={sidebarData}

          // Workspace
          workspace={workspaceState.workspace}

          // Human assistance
          humanAssistanceEntry={humanAssistanceState.activeEntry}

          // Callbacks — matching AIAdvisorExperienceProps interface
          onQuerySubmit={handleQuerySubmit}
          onNewBriefing={conversationState.startNewBriefing}
          onEscalate={handleEscalate}
          onDismissAssistance={handleDismissAssistance}
          onWorkspaceItemSelect={handleWorkspaceItemSelect}
          onAccountClick={(companyId: string) => {
            useAppStore.getState().setSelectedCompanyId?.(companyId);
          }}
        />
        {/* Feedback trigger — floating bottom-right */}
        <div className="absolute bottom-4 right-4 z-10">
          <FeedbackForm
            context="ai-advisor"
            type="thumbs"
            title="Advisor Feedback"
            description="How was this AI advisory session?"
            trigger={
              <button className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-card border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:border-border-hover transition-colors shadow-sm">
                💬 Feedback
              </button>
            }
          />
        </div>
      </div>
    </ErrorBoundary>
  );
}
