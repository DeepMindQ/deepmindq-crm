import { create } from 'zustand';

export type ViewId =
  | 'dashboard'
  | 'account-ranking'
  | 'opportunity-workspace'
  | 'pursuit-workspace'
  | 'leads'
  | 'companies'
  | 'import'
  | 'drafts'
  | 'queue'
  | 'capabilities'
  | 'replies'
  | 'duplicates'
  | 'audit'
  | 'settings'
  | 'contacts'
  | 'tasks'
  | 'opportunities'
  | 'email-generation'
  | 'reports'
  | 'prompt-templates'
  | 'knowledge'
  | 'sequences'
  | 'templates'
  | 'analytics'
  | 'pipeline'
  | 'segments'
  | 'bounces'
  | 'mind-map'
  | 'command-center'
  | 'signal-intelligence'
  | 'research-agent'
  | 'playbooks'
  | 'strategy-room'
  | 'conversation-studio'
  | 'opportunity-radar'
  | 'relationship-memory'
  | 'data-health'
  | 'icp-settings';

interface AppState {
  activeView: ViewId;
  sidebarCollapsed: boolean;
  selectedContactId: string | null;
  selectedCompanyId: string | null;
  selectedDraftId: string | null;
  setActiveView: (view: ViewId) => void;
  toggleSidebar: () => void;
  setSelectedContactId: (id: string | null) => void;
  setSelectedCompanyId: (id: string | null) => void;
  setSelectedDraftId: (id: string | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  activeView: 'dashboard',
  sidebarCollapsed: false,
  selectedContactId: null,
  selectedCompanyId: null,
  selectedDraftId: null,
  setActiveView: (view) => set({ activeView: view }),
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setSelectedContactId: (id) => set({ selectedContactId: id }),
  setSelectedCompanyId: (id) => set({ selectedCompanyId: id }),
  setSelectedDraftId: (id) => set({ selectedDraftId: id }),
}));