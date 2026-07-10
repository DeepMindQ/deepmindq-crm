import { create } from "zustand";
import type { ActiveView } from "./types";

interface AppState {
  activeView: ActiveView;
  selectedCompanyId: string | null;
  selectedContactId: string | null;
  sidebarCollapsed: boolean;
  companyStatusFilter: string;
  setActiveView: (view: ActiveView) => void;
  setSelectedCompanyId: (id: string | null) => void;
  setSelectedContactId: (id: string | null) => void;
  toggleSidebar: () => void;
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
  const match = hash.match(/^#\/([a-z-]+)(?:\/([\w-]+))?$/);
  if (!match) return null;
  const view = match[1].toLowerCase() as ActiveView;
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
  companyStatusFilter: "all",
  setActiveView: (view) => {
    set({ activeView: view });
    const { selectedCompanyId, selectedContactId } = get();
    safeHashUpdate(viewToHash(view, selectedCompanyId, selectedContactId).slice(1));
  },
  setSelectedCompanyId: (id) => {
    set({ selectedCompanyId: id });
    if (id) {
      safeHashUpdate(viewToHash('company-profile', id).slice(1));
    } else {
      safeHashUpdate('#/companies');
    }
  },
  setSelectedContactId: (id) => {
    set({ selectedContactId: id });
    if (id) {
      safeHashUpdate(viewToHash('contact-profile', id).slice(1));
    } else {
      safeHashUpdate('#/contacts');
    }
  },
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  setCompanyStatusFilter: (filter) => set({ companyStatusFilter: filter }),
}));

// Listen for browser back/forward — store cleanup for HMR
if (isBrowser) {
  const cleanup = () => {
    window.removeEventListener('hashchange', hashchangeHandler);
  };

  const hashchangeHandler = () => {
    const state = hashToState(window.location.hash);
    if (state && state.activeView) {
      useAppStore.setState({
        activeView: state.activeView,
        ...(state.selectedCompanyId !== undefined ? { selectedCompanyId: state.selectedCompanyId } : {}),
        ...(state.selectedContactId !== undefined ? { selectedContactId: state.selectedContactId } : {}),
      });
    }
  };

  window.addEventListener('hashchange', hashchangeHandler);

  // Cleanup on HMR
  if ((module as any).hot) {
    (module as any).hot.dispose(cleanup);
  }
}