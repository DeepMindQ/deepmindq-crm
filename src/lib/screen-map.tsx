/* ═══════════════════════════════════════════════════
   Screen Map — Unified Registry
   
   Maps screen keys to their lazy-loaded components.
   Intelligence OS screens are registered first.
   Legacy screens remain accessible via internal navigation.
   ═══════════════════════════════════════════════════ */

import { lazy } from 'react';

type ScreenComponent = React.LazyExoticComponent<React.ComponentType<any>> | React.FC<any>;

/* ── Intelligence OS Screens (new layer) ── */
const CommandCenterScreen = lazy(() => import('@/components/intelligence-os/command-center'));
const ActivationWorkspaceScreen = lazy(() => import('@/components/intelligence-os/activation-workspace'));
const CompanyWorkspaceScreen = lazy(() => import('@/components/intelligence-os/company-workspace'));
const KnowledgeWorkspaceScreen = lazy(() => import('@/components/intelligence-os/knowledge-workspace'));
const CapabilityWorkspaceScreen = lazy(() => import('@/components/intelligence-os/capability-workspace'));
const IntelligenceBriefingScreen = lazy(() => import('@/components/intelligence-os/intelligence-briefing'));
const IntelligenceSearchScreen = lazy(() => import('@/components/intelligence-os/intelligence-search'));

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
const CommandCenterOldScreen = lazy(() => import('@/components/screens/command-center-screen'));
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
const IntelligenceKnowledgeScreen = lazy(() => import('@/components/screens/intelligence-knowledge-screen'));
const AIStrategyScreen = lazy(() => import('@/components/screens/ai-strategy-screen'));
const DemoExperienceScreen = lazy(() => import('@/components/screens/demo-experience-screen'));
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
  // ── Intelligence OS (new) ──
  'command-center': CommandCenterScreen,
  'activation-workspace': ActivationWorkspaceScreen,
  'company-workspace': CompanyWorkspaceScreen,
  'knowledge-workspace': KnowledgeWorkspaceScreen,
  'capability-workspace': CapabilityWorkspaceScreen,
  'intelligence-briefing': IntelligenceBriefingScreen,
  'intelligence-search': IntelligenceSearchScreen,

  // ── INTELLIGENCE nav ──
  accounts: CompaniesScreen,
  // ── ADMINISTRATION nav ──
  import: ImportScreen,
  analytics: AnalyticsScreen,
  settings: SettingsScreen,
  'data-health': DataHealthScreen,
  'ai-health': AIHealthScreen,
  audit: AuditScreen,

  // ── Detail views ──
  'company-detail': CompanyDetailScreen,
  'contact-detail': ContactDetailBridge,

  // ── Legacy screens (backward compat via internal navigation) ──
  dashboard: DashboardScreen,
  'ai-command-center': AICommandCenterScreen,
  'revenue-intelligence': RevenueIntelligenceScreen,
  'signal-intelligence': SignalIntelligenceScreen,
  'account-intelligence': AccountIntelligenceScreen,
  'internal-intelligence': InternalIntelligenceScreen,
  'conversation-planner': ConversationPlannerScreen,
  companies: CompaniesScreen,
  contacts: ContactsScreen,
  opportunities: OpportunitiesScreen,
  segments: SegmentsScreen,
  pipeline: PipelineScreen,
  sequences: SequencesScreen,
  'email-studio': DraftsScreen,
  inbox: RepliesScreen,
  knowledge: KnowledgeLibraryScreen,
  leads: LeadsScreen,
  'email-generation': EmailGenerationScreen,
  'contact-profile': ContactDetailScreen,
  'company-profile': CompanyProfileScreen,
  drafts: DraftsScreen,
  queue: QueueScreen,
  templates: TemplatesScreen,
  bounces: BouncesScreen,
  replies: RepliesScreen,
  capabilities: CapabilityScreen,
  'capability-library': CapabilityScreen,
  'mind-map': MindMapScreen,
  'prompt-templates': PromptTemplatesScreen,
  'command-center-old': CommandCenterOldScreen,
  playbooks: PlaybooksScreen,
  'opportunity-radar': OpportunityRadarScreen,
  'conversation-studio': ConversationStudioScreen,
  'strategy-room': StrategyRoomScreen,
  'relationship-memory': RelationshipMemoryScreen,
  'revenue-intelligence-brief': RevenueIntelligenceBriefScreen,
  'revenue-intelligence-opportunities': RevenueIntelligenceOpportunitiesScreen,
  'revenue-intelligence-recommendations': RevenueIntelligenceRecommendationsScreen,
  'intelligence-reasoning': IntelligenceReasoningScreen,
  'intelligence-report': IntelligenceReportScreen,
  'account-ranking': AccountRankingScreen,
  'opportunity-workspace': OpportunityWorkspaceScreen,
  'pursuit-workspace': PursuitWorkspaceScreen,
  'intelligence-health': IntelligenceHealthScreen,
  'icp-settings': ICPSettingsScreen,
  'pipeline-health': PipelineHealthScreen,
  'deal-coaching': DealCoachingScreen,
  'pipeline-forecast': PipelineForecastScreen,
  'contact-intelligence': ContactIntelligenceScreen,
  'sales-execution': SalesExecutionScreen,
  revops: RevOpsScreen,
  enterprise: EnterpriseScreen,
  reports: ReportsScreen,
  tasks: TasksScreen,
  'intelligence-sources': IntelligenceSourcesScreen,
  'intelligence-knowledge': IntelligenceKnowledgeScreen,
  'ai-strategy': AIStrategyScreen,
  'demo-experience': DemoExperienceScreen,
  duplicates: DuplicatesScreen,
  builder: IntelligenceReportScreen,
};
