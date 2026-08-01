/* ═══════════════════════════════════════════════════
   Screen Map — Unified Registry
   
   Maps screen keys to their lazy-loaded components.
   Intelligence OS screens are registered first.
   Legacy screens remain accessible via internal navigation.
   ═══════════════════════════════════════════════════ */

import { lazy, Suspense } from 'react';
import { ErrorBoundary } from '@/components/error-boundary';

type ScreenComponent = React.LazyExoticComponent<React.ComponentType<any>> | React.FC<any>;

/* ── Per-screen ErrorBoundary wrapper ──
 *  Wraps each lazy screen so that an unhandled error in one screen
 *  only crashes THAT screen — not the entire app.
 *  Ticket 1 spec: "Add error boundaries to all 76 screens"
 */
function withScreenErrorBoundary(
  LazyComponent: ScreenComponent,
  screenName: string,
): React.FC<{ fallback?: React.ReactNode }> {
  return function ScreenWithErrorBoundary({ fallback }: { fallback?: React.ReactNode } = {}) {
    return (
      <ErrorBoundary fallback={fallback}>
        <Suspense fallback={<ScreenLoadingFallback name={screenName} />}>
          <LazyComponent />
        </Suspense>
      </ErrorBoundary>
    );
  };
}

/** Shared loading indicator for lazy screens */
function ScreenLoadingFallback({ name }: { name: string }) {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin mx-auto mb-3" />
        <p className="text-xs text-gray-500">Loading {name.replace(/-/g, ' ')}…</p>
      </div>
    </div>
  );
}

/* ── Intelligence OS Screens (new layer) ── */
const CommandCenterScreen = lazy(() => import('@/components/intelligence-os/command-center').then(m => ({ default: m.CommandCenter })));
const ActivationWorkspaceScreen = lazy(() => import('@/components/intelligence-os/activation-workspace').then(m => ({ default: m.ActivationWorkspace })));
const CompanyWorkspaceScreen = lazy(() => import('@/components/intelligence-os/company-workspace').then(m => ({ default: m.CompanyWorkspace })));
const KnowledgeWorkspaceScreen = lazy(() => import('@/components/intelligence-os/knowledge-workspace').then(m => ({ default: m.KnowledgeWorkspace })));
const CapabilityWorkspaceScreen = lazy(() => import('@/components/intelligence-os/capability-workspace').then(m => ({ default: m.CapabilityWorkspace })));
const IntelligenceBriefingScreen = lazy(() => import('@/components/intelligence-os/intelligence-briefing').then(m => ({ default: m.IntelligenceBriefing })));
const IntelligenceSearchScreen = lazy(() => import('@/components/intelligence-os/intelligence-search').then(m => ({ default: m.IntelligenceSearch })));

/* ── Primary nav screens (legacy, accessible) ── */
const DashboardScreen = lazy(() => import('@/components/screens/dashboard-screen'));
const AICommandCenterScreen = lazy(() => import('@/components/screens/ai-command-center-screen'));
const RevenueIntelligenceScreen = lazy(() => import('@/components/screens/revenue-intelligence-screen'));
const SignalIntelligenceScreen = lazy(() => import('@/components/screens/signal-intelligence-screen'));
const AccountIntelligenceScreen = lazy(() => import('@/components/screens/account-intelligence-screen'));
const ConversationPlannerScreen = lazy(() => import('@/components/screens/conversation-planner-screen'));
const CompaniesScreen = lazy(() => import('@/components/screens/companies-screen'));
const ContactsScreen = lazy(() => import('@/components/screens/contacts-screen'));
const OpportunitiesScreen = lazy(() => import('@/components/screens/opportunities-screen'));
const SegmentsScreen = lazy(() => import('@/components/screens/segments-screen'));
const PipelineScreen = lazy(() => import('@/components/screens/pipeline-screen'));
const SequencesScreen = lazy(() => import('@/components/screens/sequences-screen'));
const DraftsScreen = lazy(() => import('@/components/screens/drafts-screen'));
const RepliesScreen = lazy(() => import('@/components/screens/replies-screen'));
const ImportScreen = lazy(() => import('@/components/screens/import-screen'));
const AnalyticsScreen = lazy(() => import('@/components/screens/analytics-screen'));
const KnowledgeLibraryScreen = lazy(() => import('@/components/screens/knowledge-library-screen'));
const AIHealthScreen = lazy(() => import('@/components/screens/ai-health-screen'));
const SettingsScreen = lazy(() => import('@/components/screens/settings-screen'));
const AuditScreen = lazy(() => import('@/components/screens/audit-screen'));
const DataHealthScreen = lazy(() => import('@/components/screens/data-health-screen'));
const DuplicatesScreen = lazy(() => import('@/components/screens/duplicates-screen'));
const CapabilityScreen = lazy(() => import('@/components/screens/capability-screen'));
const InternalIntelligenceScreen = lazy(() => import('@/components/screens/internal-intelligence-screen'));

/* ── Detail views ── */
const CompanyDetailScreen = lazy(() => import('@/components/screens/company-detail-screen'));
const CompanyProfileScreen = lazy(() => import('@/components/screens/company-profile-screen'));
const ContactDetailScreen = lazy(() => import('@/components/screens/contact-detail-screen'));
const EmailGenerationScreen = lazy(() => import('@/components/screens/email-generation-screen'));

/* ── Legacy screens (accessible via internal navigation, not in nav) ── */
const LeadsScreen = lazy(() => import('@/components/screens/leads-screen'));
const QueueScreen = lazy(() => import('@/components/screens/queue-screen'));
const TemplatesScreen = lazy(() => import('@/components/screens/templates-screen'));
const BouncesScreen = lazy(() => import('@/components/screens/bounces-screen'));
const MindMapScreen = lazy(() => import('@/components/screens/mind-map-screen'));
const PromptTemplatesScreen = lazy(() => import('@/components/screens/prompt-templates-screen'));
const PlaybooksScreen = lazy(() => import('@/components/screens/playbooks-screen'));
const OpportunityRadarScreen = lazy(() => import('@/components/screens/opportunity-radar-screen'));
const ConversationStudioScreen = lazy(() => import('@/components/screens/conversation-studio-screen'));
const StrategyRoomScreen = lazy(() => import('@/components/screens/strategy-room-screen'));
const RelationshipMemoryScreen = lazy(() => import('@/components/screens/relationship-memory-screen'));
const IntelligenceReasoningScreen = lazy(() => import('@/components/screens/intelligence-reasoning-screen'));
const IntelligenceReportScreen = lazy(() => import('@/components/screens/intelligence-report-screen'));
const IntelligenceHealthScreen = lazy(() => import('@/components/screens/intelligence-health-screen'));
const PipelineHealthScreen = lazy(() => import('@/components/screens/pipeline-health-screen'));
const DealCoachingScreen = lazy(() => import('@/components/screens/deal-coaching-screen'));
const PipelineForecastScreen = lazy(() => import('@/components/screens/pipeline-forecast-screen'));
const ContactIntelligenceScreen = lazy(() => import('@/components/screens/contact-intelligence-screen'));
const SalesExecutionScreen = lazy(() => import('@/components/screens/sales-execution-screen'));
const RevOpsScreen = lazy(() => import('@/components/screens/revops-screen'));
const EnterpriseScreen = lazy(() => import('@/components/screens/enterprise-screen'));
const ReportsScreen = lazy(() => import('@/components/screens/reports-screen'));
const TasksScreen = lazy(() => import('@/components/screens/tasks-screen'));
const IntelligenceSourcesScreen = lazy(() => import('@/components/screens/intelligence-sources-screen'));
const IntelligenceInboxScreen = lazy(() => import('@/components/screens/intelligence-inbox-screen'));
const IntelligenceKnowledgeScreen = lazy(() => import('@/components/screens/intelligence-knowledge-screen'));
const AIStrategyScreen = lazy(() => import('@/components/screens/ai-strategy-screen'));
const DemoExperienceScreen = lazy(() => import('@/components/screens/demo-experience-screen'));
const DataImportScreen = lazy(() => import('@/components/screens/data-import-screen'));
const RevenueIntelligenceBriefScreen = lazy(() => import('@/components/screens/revenue-intelligence-brief-screen'));
const RevenueIntelligenceOpportunitiesScreen = lazy(() => import('@/components/screens/revenue-intelligence-opportunities-screen'));
const RevenueIntelligenceRecommendationsScreen = lazy(() => import('@/components/screens/revenue-intelligence-recommendations-screen'));
const AccountRankingScreen = lazy(() => import('@/components/screens/account-ranking-screen'));
const OpportunityWorkspaceScreen = lazy(() => import('@/components/screens/opportunity-workspace-screen'));
const PursuitWorkspaceScreen = lazy(() => import('@/components/screens/pursuit-workspace-screen'));
const ICPSettingsScreen = lazy(() => import('@/components/screens/icp-settings-screen'));

/* ── Bridge wrappers ── */

export function ContactDetailBridge({ contactId }: { contactId: string }) {
  const { useAppStore } = require('@/lib/store');
  const { useEffect } = require('react');
  useEffect(() => { useAppStore.getState().setSelectedContactId(contactId); }, [contactId]);
  return <ContactDetailScreen />;
}

/* ═══════════════════════════════════════════════════
   Screen Map — unified registry
   ═══════════════════════════════════════════════════ */

export const SCREEN_MAP: Record<string, ScreenComponent> = {
  // ── Intelligence OS (new) — each wrapped with per-screen ErrorBoundary ──
  'command-center': withScreenErrorBoundary(CommandCenterScreen, 'command-center'),
  'activation-workspace': withScreenErrorBoundary(ActivationWorkspaceScreen, 'activation-workspace'),
  'company-workspace': withScreenErrorBoundary(CompanyWorkspaceScreen, 'company-workspace'),
  'knowledge-workspace': withScreenErrorBoundary(KnowledgeWorkspaceScreen, 'knowledge-workspace'),
  'capability-workspace': withScreenErrorBoundary(CapabilityWorkspaceScreen, 'capability-workspace'),
  'intelligence-briefing': withScreenErrorBoundary(IntelligenceBriefingScreen, 'intelligence-briefing'),
  'intelligence-search': withScreenErrorBoundary(IntelligenceSearchScreen, 'intelligence-search'),

  // ── INTELLIGENCE nav ──
  accounts: withScreenErrorBoundary(CompaniesScreen, 'accounts'),
  // ── ADMINISTRATION nav ──
  import: withScreenErrorBoundary(ImportScreen, 'import'),
  'data-import': withScreenErrorBoundary(DataImportScreen, 'data-import'),
  analytics: withScreenErrorBoundary(AnalyticsScreen, 'analytics'),
  settings: withScreenErrorBoundary(SettingsScreen, 'settings'),
  'data-health': withScreenErrorBoundary(DataHealthScreen, 'data-health'),
  'ai-health': withScreenErrorBoundary(AIHealthScreen, 'ai-health'),
  audit: withScreenErrorBoundary(AuditScreen, 'audit'),

  // ── Detail views ──
  'company-detail': withScreenErrorBoundary(CompanyDetailScreen, 'company-detail'),
  'contact-detail': withScreenErrorBoundary(ContactDetailBridge, 'contact-detail'),

  // ── Legacy screens (backward compat via internal navigation) ──
  dashboard: withScreenErrorBoundary(DashboardScreen, 'dashboard'),
  'ai-command-center': withScreenErrorBoundary(AICommandCenterScreen, 'ai-command-center'),
  'revenue-intelligence': withScreenErrorBoundary(RevenueIntelligenceScreen, 'revenue-intelligence'),
  'signal-intelligence': withScreenErrorBoundary(SignalIntelligenceScreen, 'signal-intelligence'),
  'account-intelligence': withScreenErrorBoundary(AccountIntelligenceScreen, 'account-intelligence'),
  'internal-intelligence': withScreenErrorBoundary(InternalIntelligenceScreen, 'internal-intelligence'),
  'conversation-planner': withScreenErrorBoundary(ConversationPlannerScreen, 'conversation-planner'),
  companies: withScreenErrorBoundary(CompaniesScreen, 'companies'),
  contacts: withScreenErrorBoundary(ContactsScreen, 'contacts'),
  opportunities: withScreenErrorBoundary(OpportunitiesScreen, 'opportunities'),
  segments: withScreenErrorBoundary(SegmentsScreen, 'segments'),
  pipeline: withScreenErrorBoundary(PipelineScreen, 'pipeline'),
  sequences: withScreenErrorBoundary(SequencesScreen, 'sequences'),
  'email-studio': withScreenErrorBoundary(DraftsScreen, 'email-studio'),
  inbox: withScreenErrorBoundary(RepliesScreen, 'inbox'),
  knowledge: withScreenErrorBoundary(KnowledgeLibraryScreen, 'knowledge'),
  leads: withScreenErrorBoundary(LeadsScreen, 'leads'),
  'email-generation': withScreenErrorBoundary(EmailGenerationScreen, 'email-generation'),
  'contact-profile': withScreenErrorBoundary(ContactDetailScreen, 'contact-profile'),
  'company-profile': withScreenErrorBoundary(CompanyProfileScreen, 'company-profile'),
  drafts: withScreenErrorBoundary(DraftsScreen, 'drafts'),
  queue: withScreenErrorBoundary(QueueScreen, 'queue'),
  templates: withScreenErrorBoundary(TemplatesScreen, 'templates'),
  bounces: withScreenErrorBoundary(BouncesScreen, 'bounces'),
  replies: withScreenErrorBoundary(RepliesScreen, 'replies'),
  capabilities: withScreenErrorBoundary(CapabilityScreen, 'capabilities'),
  'capability-library': withScreenErrorBoundary(CapabilityScreen, 'capability-library'),
  'mind-map': withScreenErrorBoundary(MindMapScreen, 'mind-map'),
  'prompt-templates': withScreenErrorBoundary(PromptTemplatesScreen, 'prompt-templates'),
  playbooks: withScreenErrorBoundary(PlaybooksScreen, 'playbooks'),
  'opportunity-radar': withScreenErrorBoundary(OpportunityRadarScreen, 'opportunity-radar'),
  'conversation-studio': withScreenErrorBoundary(ConversationStudioScreen, 'conversation-studio'),
  'strategy-room': withScreenErrorBoundary(StrategyRoomScreen, 'strategy-room'),
  'relationship-memory': withScreenErrorBoundary(RelationshipMemoryScreen, 'relationship-memory'),
  'revenue-intelligence-brief': withScreenErrorBoundary(RevenueIntelligenceBriefScreen, 'revenue-intelligence-brief'),
  'revenue-intelligence-opportunities': withScreenErrorBoundary(RevenueIntelligenceOpportunitiesScreen, 'revenue-intelligence-opportunities'),
  'revenue-intelligence-recommendations': withScreenErrorBoundary(RevenueIntelligenceRecommendationsScreen, 'revenue-intelligence-recommendations'),
  'intelligence-reasoning': withScreenErrorBoundary(IntelligenceReasoningScreen, 'intelligence-reasoning'),
  'intelligence-report': withScreenErrorBoundary(IntelligenceReportScreen, 'intelligence-report'),
  'account-ranking': withScreenErrorBoundary(AccountRankingScreen, 'account-ranking'),
  'opportunity-workspace': withScreenErrorBoundary(OpportunityWorkspaceScreen, 'opportunity-workspace'),
  'pursuit-workspace': withScreenErrorBoundary(PursuitWorkspaceScreen, 'pursuit-workspace'),
  'intelligence-health': withScreenErrorBoundary(IntelligenceHealthScreen, 'intelligence-health'),
  'icp-settings': withScreenErrorBoundary(ICPSettingsScreen, 'icp-settings'),
  'pipeline-health': withScreenErrorBoundary(PipelineHealthScreen, 'pipeline-health'),
  'deal-coaching': withScreenErrorBoundary(DealCoachingScreen, 'deal-coaching'),
  'pipeline-forecast': withScreenErrorBoundary(PipelineForecastScreen, 'pipeline-forecast'),
  'contact-intelligence': withScreenErrorBoundary(ContactIntelligenceScreen, 'contact-intelligence'),
  'sales-execution': withScreenErrorBoundary(SalesExecutionScreen, 'sales-execution'),
  revops: withScreenErrorBoundary(RevOpsScreen, 'revops'),
  enterprise: withScreenErrorBoundary(EnterpriseScreen, 'enterprise'),
  reports: withScreenErrorBoundary(ReportsScreen, 'reports'),
  tasks: withScreenErrorBoundary(TasksScreen, 'tasks'),
  'intelligence-sources': withScreenErrorBoundary(IntelligenceSourcesScreen, 'intelligence-sources'),
  'intelligence-inbox': withScreenErrorBoundary(IntelligenceInboxScreen, 'intelligence-inbox'),
  'intelligence-knowledge': withScreenErrorBoundary(IntelligenceKnowledgeScreen, 'intelligence-knowledge'),
  'ai-strategy': withScreenErrorBoundary(AIStrategyScreen, 'ai-strategy'),
  'demo-experience': withScreenErrorBoundary(DemoExperienceScreen, 'demo-experience'),
  duplicates: withScreenErrorBoundary(DuplicatesScreen, 'duplicates'),
  builder: withScreenErrorBoundary(IntelligenceReportScreen, 'builder'),
};
