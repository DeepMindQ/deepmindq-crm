import { create } from 'zustand';

export type ViewId =
  // INTELLIGENCE
  | 'intelligence-operations'
  | 'command-center'
  | 'accounts'
  | 'intelligence-search'
  | 'ai-advisor'
  // WORKSPACES
  | 'company-workspace'
  | 'knowledge-workspace'
  | 'capability-workspace'
  // ADMINISTRATION
  | 'import'
  | 'analytics'
  | 'settings'
  | 'data-health'
  | 'ai-health'
  | 'audit'
  | 'ai-usage'
  | 'research-agent'
  | 'audit-logs'
  // Intelligence OS Screens
  | 'activation-workspace'
  | 'intelligence-briefing'
  // Detail views
  | 'company-detail'
  | 'contact-detail'
  // ── Legacy (mapped in screen-map for backward compat) ──
  | 'dashboard'
  | 'ai-command-center'
  | 'revenue-intelligence'
  | 'signal-intelligence'
  | 'internal-intelligence'
  | 'account-intelligence'
  | 'conversation-planner'
  | 'companies'
  | 'contacts'
  | 'opportunities'
  | 'segments'
  | 'pipeline'
  | 'sequences'
  | 'email-studio'
  | 'inbox'
  | 'knowledge'
  | 'leads'
  | 'email-generation'
  | 'contact-profile'
  | 'company-profile'
  | 'drafts'
  | 'queue'
  | 'templates'
  | 'bounces'
  | 'replies'
  | 'capabilities'
  | 'capability-library'
  | 'mind-map'
  | 'prompt-templates'
  | 'playbooks'
  | 'opportunity-radar'
  | 'conversation-studio'
  | 'strategy-room'
  | 'relationship-memory'
  | 'revenue-intelligence-brief'
  | 'revenue-intelligence-opportunities'
  | 'revenue-intelligence-recommendations'
  | 'intelligence-reasoning'
  | 'intelligence-report'
  | 'account-ranking'
  | 'opportunity-workspace'
  | 'pursuit-workspace'
  | 'intelligence-health'
  | 'icp-settings'
  | 'pipeline-health'
  | 'deal-coaching'
  | 'pipeline-forecast'
  | 'contact-intelligence'
  | 'sales-execution'
  | 'revops'
  | 'enterprise'
  | 'reports'
  | 'tasks'
  | 'intelligence-sources'
  | 'intelligence-inbox'
  | 'intelligence-knowledge'
  | 'ai-strategy'
  | 'duplicates'
  | 'data-import'
  | 'trust-dashboard'
  | 'company-trust-detail'
  | 'scoring-config'
  | 'users'
  | 'recommendation-queue'
  // ── S11 UX Screens ──
  | 'main-dashboard'
  | 'company-workspace-v2'
  | 'recommendation-queue-v2'
  | 'scoring-wizard'
  | 'batch-operations'
  | 'onboarding-wizard'
  | 'admin-settings'
  | 'builder';

interface AppState {
  activeView: ViewId;
  sidebarCollapsed: boolean;
  selectedContactId: string | null;
  selectedCompanyId: string | null;
  selectedDraftId: string | null;
  companyStatusFilter: string;
  setActiveView: (view: ViewId) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebar: () => void;
  setSelectedContactId: (id: string | null) => void;
  setSelectedCompanyId: (id: string | null) => void;
  setSelectedDraftId: (id: string | null) => void;
  setCompanyStatusFilter: (filter: string) => void;
}

export const useAppStore = create<AppState>((set) => ({
  activeView: 'dashboard',
  sidebarCollapsed: false,
  selectedContactId: null,
  selectedCompanyId: null,
  selectedDraftId: null,
  companyStatusFilter: 'all',
  setActiveView: (view) => set({ activeView: view }),
  setSidebarCollapsed: (collapsed: boolean) => set({ sidebarCollapsed: collapsed }),
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setSelectedContactId: (id) => set({ selectedContactId: id }),
  setSelectedCompanyId: (id) => set({ selectedCompanyId: id }),
  setSelectedDraftId: (id) => set({ selectedDraftId: id }),
  setCompanyStatusFilter: (filter) => set({ companyStatusFilter: filter }),
}));
