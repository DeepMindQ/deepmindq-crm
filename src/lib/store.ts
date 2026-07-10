import { create } from "zustand";
import type { ActiveView } from "./types";

interface AppState {
  activeView: ActiveView;
  selectedCompanyId: string | null;
  selectedContactId: string | null;
  sidebarCollapsed: boolean;
  searchQuery: string;
  showNotifications: boolean;
  companyStatusFilter: string;
  setActiveView: (view: ActiveView) => void;
  setSelectedCompanyId: (id: string | null) => void;
  setSelectedContactId: (id: string | null) => void;
  toggleSidebar: () => void;
  setSearchQuery: (query: string) => void;
  setCompanyStatusFilter: (filter: string) => void;
}

// Hash sync helpers
function viewToHash(view: ActiveView, companyId?: string | null, contactId?: string | null): string {
  let hash = `#/${view}`;
  if (view === 'company-profile' && companyId) hash += `/${companyId}`;
  if (view === 'contact-profile' && contactId) hash += `/${contactId}`;
  return hash;
}

function hashToState(hash: string): Partial<AppState> | null {
  const match = hash.match(/^#\/([a-z-]+)(?:\/([a-z0-9]+))?$/i);
  if (!match) return null;
  const view = match[1] as ActiveView;
  const id = match[2] || null;
  if (view === 'company-profile') return { activeView: view, selectedCompanyId: id };
  if (view === 'contact-profile') return { activeView: view, selectedContactId: id };
  if (['dashboard','companies','contacts','import','email-generation','knowledge-library','settings'].includes(view)) {
    return { activeView: view as ActiveView };
  }
  return null;
}

// Safe initial hash parse (SSR-safe)
const isBrowser = typeof window !== 'undefined';
const initialState = isBrowser ? hashToState(window.location.hash) : null;

const safeHashUpdate = (hash: string) => {
  if (typeof window !== 'undefined') {
    window.location.hash = hash;
  }
};

export const useAppStore = create<AppState>((set, get) => ({
  activeView: (initialState?.activeView as ActiveView) || "dashboard",
  selectedCompanyId: initialState?.selectedCompanyId || null,
  selectedContactId: initialState?.selectedContactId || null,
  sidebarCollapsed: false,
  searchQuery: "",
  showNotifications: true,
  companyStatusFilter: "all",
  setActiveView: (view) => {
    set({ activeView: view });
    const { selectedCompanyId, selectedContactId } = get();
    safeHashUpdate(viewToHash(view, selectedCompanyId, selectedContactId).slice(1));
  },
  setSelectedCompanyId: (id) => {
    set({ selectedCompanyId: id, activeView: id ? 'company-profile' : 'companies' });
    if (id) {
      safeHashUpdate(viewToHash('company-profile', id).slice(1));
    } else {
      safeHashUpdate('#/companies');
    }
  },
  setSelectedContactId: (id) => {
    set({ selectedContactId: id, activeView: id ? 'contact-profile' : 'contacts' });
    if (id) {
      safeHashUpdate(viewToHash('contact-profile', id).slice(1));
    } else {
      safeHashUpdate('#/contacts');
    }
  },
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setCompanyStatusFilter: (filter) => set({ companyStatusFilter: filter }),
}));

// Listen for browser back/forward
if (isBrowser) {
  window.addEventListener('hashchange', () => {
    const state = hashToState(window.location.hash);
    if (state && state.activeView) {
      useAppStore.setState({
        activeView: state.activeView,
        ...(state.selectedCompanyId !== undefined ? { selectedCompanyId: state.selectedCompanyId } : {}),
        ...(state.selectedContactId !== undefined ? { selectedContactId: state.selectedContactId } : {}),
      });
    }
  });
}