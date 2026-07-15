import { create } from 'zustand';

export type ViewId =
  | 'dashboard'
  | 'leads'
  | 'companies'
  | 'import'
  | 'drafts'
  | 'queue'
  | 'capability-library'
  | 'replies'
  | 'duplicates'
  | 'audit'
  | 'settings'
  | 'contacts'
  | 'contact-profile'
  | 'company-profile'
  | 'tasks'
  | 'opportunities'
  | 'email-generation'
  | 'reports'
  | 'prompt-templates'
  | 'knowledge-library'
  | 'sequences'
  | 'templates'
  | 'analytics'
  | 'pipeline'
  | 'segments'
  | 'bounces'
  | 'mind-map'
  | 'command-center';

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