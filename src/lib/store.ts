import { create } from 'zustand';

export type ViewId =
  // INTELLIGENCE
  | 'dashboard'
  | 'ai-command-center'
  | 'revenue-intelligence'
  | 'signal-intelligence'
  | 'internal-intelligence'
  // AI ENGINES
  | 'account-intelligence'
  | 'conversation-planner'
  // ACCOUNTS
  | 'companies'
  | 'contacts'
  | 'opportunities'
  | 'segments'
  // PIPELINE & ENGAGEMENT
  | 'pipeline'
  | 'sequences'
  | 'email-studio'
  | 'inbox'
  // OPERATIONS
  | 'import'
  | 'analytics'
  | 'knowledge'
  | 'ai-health'
  // SETTINGS
  | 'settings'
  | 'audit'
  | 'data-health'
  | 'duplicates'
  // Detail views
  | 'company-detail'
  | 'contact-detail'
  // ── Legacy aliases (mapped in screen-map, will be removed) ──
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
  | 'command-center'
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
  | 'intelligence-knowledge'
  | 'ai-strategy'
  | 'demo-experience'
  | 'builder';

interface AppState {
  activeView: ViewId;
  sidebarCollapsed: boolean;
  selectedContactId: string | null;
  selectedCompanyId: string | null;
  selectedDraftId: string | null;
  companyStatusFilter: string;
  setActiveView: (view: ViewId) => void;
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
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setSelectedContactId: (id) => set({ selectedContactId: id }),
  setSelectedCompanyId: (id) => set({ selectedCompanyId: id }),
  setSelectedDraftId: (id) => set({ selectedDraftId: id }),
  setCompanyStatusFilter: (filter) => set({ companyStatusFilter: filter }),
}));
