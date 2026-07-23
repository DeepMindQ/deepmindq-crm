/* ═══════════════════════════════════════════════════
   Screen Map — Unified Registry
   
   Extracted from page.tsx to reduce monolith size.
   Maps screen keys to their lazy-loaded components.
   ═══════════════════════════════════════════════════ */

import { lazy } from 'react';

type ScreenComponent = React.LazyExoticComponent<React.ComponentType<any>> | React.FC<any>;

// — Originally active screens —
const DashboardScreen = lazy(() => import('@/components/screens/dashboard-screen'));
const CommandCenterScreen = lazy(() => import('@/components/screens/command-center-screen'));
const MindMapScreen = lazy(() => import('@/components/screens/mind-map-screen'));
const ImportScreen = lazy(() => import('@/components/screens/import-screen'));
const LeadsScreen = lazy(() => import('@/components/screens/leads-screen'));
const CompaniesScreen = lazy(() => import('@/components/screens/companies-screen'));
const CompanyDetailScreen = lazy(() => import('@/components/screens/company-detail-screen'));
const SegmentsScreen = lazy(() => import('@/components/screens/segments-screen'));
const DraftsScreen = lazy(() => import('@/components/screens/drafts-screen'));
const QueueScreen = lazy(() => import('@/components/screens/queue-screen'));
const CapabilityScreen = lazy(() => import('@/components/screens/capability-screen'));
const KnowledgeLibraryScreen = lazy(() => import('@/components/screens/knowledge-library-screen'));
const RepliesScreen = lazy(() => import('@/components/screens/replies-screen'));
const BouncesScreen = lazy(() => import('@/components/screens/bounces-screen'));
const PipelineScreen = lazy(() => import('@/components/screens/pipeline-screen'));
const AnalyticsScreen = lazy(() => import('@/components/screens/analytics-screen'));
const AuditScreen = lazy(() => import('@/components/screens/audit-screen'));
const SettingsScreen = lazy(() => import('@/components/screens/settings-screen'));
const TemplatesScreen = lazy(() => import('@/components/screens/templates-screen'));
const SequencesScreen = lazy(() => import('@/components/screens/sequences-screen'));

// — Previously dormant screens —
const ContactsScreen = lazy(() => import('@/components/screens/contacts-screen'));
const ContactDetailScreen = lazy(() => import('@/components/screens/contact-detail-screen'));
const TasksScreen = lazy(() => import('@/components/screens/tasks-screen'));
const OpportunitiesScreen = lazy(() => import('@/components/screens/opportunities-screen'));
const ReportsScreen = lazy(() => import('@/components/screens/reports-screen'));
const EmailGenerationScreen = lazy(() => import('@/components/screens/email-generation-screen'));
const PromptTemplatesScreen = lazy(() => import('@/components/screens/prompt-templates-screen'));
const DuplicatesScreen = lazy(() => import('@/components/screens/duplicates-screen'));

// — Intelligence Platform screens —
const SignalIntelligenceScreen = lazy(() => import('@/components/screens/signal-intelligence-screen'));
const ConversationStudioScreen = lazy(() => import('@/components/screens/conversation-studio-screen'));
const RelationshipMemoryScreen = lazy(() => import('@/components/screens/relationship-memory-screen'));
const OpportunityRadarScreen = lazy(() => import('@/components/screens/opportunity-radar-screen'));
const DataHealthScreen = lazy(() => import('@/components/screens/data-health-screen'));

// — Phase 4 screens —
const PlaybooksScreen = lazy(() => import('@/components/screens/playbooks-screen'));
const ResearchAgentScreen = lazy(() => import('@/components/screens/research-agent-screen'));
const StrategyRoomScreen = lazy(() => import('@/components/screens/strategy-room-screen'));

// — Phase 6: Intelligence Governance —
const IntelligenceHealthScreen = lazy(() => import('@/components/screens/intelligence-health-screen'));

// — Phase 7: Revenue Intelligence —
const RevenueIntelligenceScreen = lazy(() => import('@/components/screens/revenue-intelligence-screen'));
const RevenueIntelligenceOpportunitiesScreen = lazy(() => import('@/components/screens/revenue-intelligence-opportunities-screen'));
const RevenueIntelligenceRecommendationsScreen = lazy(() => import('@/components/screens/revenue-intelligence-recommendations-screen'));

// — Phase 7.5: Intelligence Acquisition & Fabric —
const IntelligenceSourcesScreen = lazy(() => import('@/components/screens/intelligence-sources-screen'));
const IntelligenceKnowledgeScreen = lazy(() => import('@/components/screens/intelligence-knowledge-screen'));
const RevenueIntelligenceBriefScreen = lazy(() => import('@/components/screens/revenue-intelligence-brief-screen'));
const IntelligenceReasoningScreen = lazy(() => import('@/components/screens/intelligence-reasoning-screen'));
const IntelligenceReportScreen = lazy(() => import('@/components/screens/intelligence-report-screen'));

// — Phase 5/7: Revenue Intelligence screens —
const AccountRankingScreen = lazy(() => import('@/components/screens/account-ranking-screen'));
const OpportunityWorkspaceScreen = lazy(() => import('@/components/screens/opportunity-workspace-screen'));
const PursuitWorkspaceScreen = lazy(() => import('@/components/screens/pursuit-workspace-screen'));
const ICPSettingsScreen = lazy(() => import('@/components/screens/icp-settings-screen'));

/* ── Bridge wrappers for dormant screens ── */

function ContactsBridge() {
  return <ContactsScreen />;
}

export function ContactDetailBridge({ contactId }: { contactId: string }) {
  // contact-detail-screen reads selectedContactId from store
  const { useAppStore } = require('@/lib/store');
  const { useEffect } = require('react');
  useEffect(() => { useAppStore.getState().setSelectedContactId(contactId); }, [contactId]);
  return <ContactDetailScreen />;
}

function TasksBridge() {
  return <TasksScreen />;
}

function OpportunitiesBridge() {
  return <OpportunitiesScreen />;
}

function ReportsBridge() {
  return <ReportsScreen />;
}

function EmailGenBridge() {
  return <EmailGenerationScreen />;
}

function PromptTemplatesBridge() {
  return <PromptTemplatesScreen />;
}

function DuplicatesBridge() {
  return <DuplicatesScreen />;
}

/* ═══════════════════════════════════════════════════
   Screen Map — unified registry
   ═══════════════════════════════════════════════════ */

export const SCREEN_MAP: Record<string, ScreenComponent> = {
  // Phase 7: Revenue Intelligence Experience Layer
  'revenue-intelligence': RevenueIntelligenceScreen,
  'revenue-intelligence-brief': RevenueIntelligenceBriefScreen,
  'revenue-intelligence-opportunities': RevenueIntelligenceOpportunitiesScreen,
  'revenue-intelligence-recommendations': RevenueIntelligenceRecommendationsScreen,
  'intelligence-reasoning': IntelligenceReasoningScreen,
  'intelligence-report': IntelligenceReportScreen,
  // Revenue Intelligence (Phase 5/7)
  'account-ranking': AccountRankingScreen,
  'opportunity-workspace': OpportunityWorkspaceScreen,
  'pursuit-workspace': PursuitWorkspaceScreen,
  'intelligence-health': IntelligenceHealthScreen,
  'icp-settings': ICPSettingsScreen,
  // Intelligence
  'command-center': CommandCenterScreen,
  'signal-intelligence': SignalIntelligenceScreen,
  'research-agent': ResearchAgentScreen,
  'playbooks': PlaybooksScreen,
  'opportunity-radar': OpportunityRadarScreen,
  'conversation-studio': ConversationStudioScreen,
  'strategy-room': StrategyRoomScreen,
  'relationship-memory': RelationshipMemoryScreen,
  'data-health': DataHealthScreen,
  'mind-map': MindMapScreen,
  dashboard: DashboardScreen,
  pipeline: PipelineScreen,
  analytics: AnalyticsScreen,
  contacts: ContactsBridge,
  companies: CompaniesScreen,
  opportunities: OpportunitiesBridge,
  import: ImportScreen,
  leads: LeadsScreen,
  segments: SegmentsScreen,
  duplicates: DuplicatesBridge,
  capabilities: CapabilityScreen,
  knowledge: KnowledgeLibraryScreen,
  'email-generation': EmailGenBridge,
  drafts: DraftsScreen,
  queue: QueueScreen,
  templates: TemplatesScreen,
  sequences: SequencesScreen,
  replies: RepliesScreen,
  bounces: BouncesScreen,
  reports: ReportsBridge,
  tasks: TasksBridge,
  'prompt-templates': PromptTemplatesBridge,
  audit: AuditScreen,
  settings: SettingsScreen,
  templates_screen: TemplatesScreen,
  'company-detail': CompanyDetailScreen,
  'contact-detail': ContactDetailBridge,
};
