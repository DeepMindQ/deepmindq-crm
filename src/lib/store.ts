import { create } from "zustand";
import type { ActiveView } from "./types";

// ── Saved Views ─────────────────────────────────────────────────
export interface SavedCompanyView {
  id: string;
  name: string;
  isBuiltIn?: boolean;
  filters: {
    search: string;
    industry: string;
    status: string;
    employeeSize: string;
    createdAfter: string;
    createdBefore: string;
  };
}

function loadSavedViews(): SavedCompanyView[] {
  if (typeof window === 'undefined') return getBuiltinViews();
  try {
    const raw = localStorage.getItem('deepmindq-saved-views');
    const stored: SavedCompanyView[] = raw ? JSON.parse(raw) : [];
    return [...getBuiltinViews(), ...stored];
  } catch {
    return getBuiltinViews();
  }
}

function getBuiltinViews(): SavedCompanyView[] {
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  return [
    {
      id: '__all__', name: 'All Companies', isBuiltIn: true,
      filters: { search: '', industry: 'all', status: 'all', employeeSize: 'all', createdAfter: '', createdBefore: '' },
    },
    {
      id: '__new_week__', name: 'New This Week', isBuiltIn: true,
      filters: { search: '', industry: 'all', status: 'new', employeeSize: 'all', createdAfter: weekAgo.toISOString().split('T')[0], createdBefore: '' },
    },
    {
      id: '__active__', name: 'Active Accounts', isBuiltIn: true,
      filters: { search: '', industry: 'all', status: 'active', employeeSize: 'all', createdAfter: '', createdBefore: '' },
    },
  ];
}

function persistViews(views: SavedCompanyView[]) {
  if (typeof window !== 'undefined') {
    const custom = views.filter(v => !v.isBuiltIn);
    localStorage.setItem('deepmindq-saved-views', JSON.stringify(custom));
  }
}

interface AppState {
  activeView: ActiveView;
  selectedCompanyId: string | null;
  selectedContactId: string | null;
  sidebarCollapsed: boolean;
  companyStatusFilter: string;
  taskCount: number;
  savedViews: SavedCompanyView[];
  setActiveView: (view: ActiveView) => void;
  setSelectedCompanyId: (id: string | null) => void;
  setSelectedContactId: (id: string | null) => void;
  toggleSidebar: () => void;
  setCompanyStatusFilter: (filter: string) => void;
  setTaskCount: (count: number) => void;
  addSavedView: (view: SavedCompanyView) => void;
  removeSavedView: (id: string) => void;
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
  if (['dashboard','companies','contacts','tasks','opportunities','import','email-generation','knowledge-library','settings','audit-logs','prompt-templates','reports'].includes(view)) {
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
  taskCount: 0,
  savedViews: loadSavedViews(),
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
  setTaskCount: (count) => set({ taskCount: count }),
  addSavedView: (view) => {
    const views = [...get().savedViews, view];
    set({ savedViews: views });
    persistViews(views);
  },
  removeSavedView: (id) => {
    const views = get().savedViews.filter(v => v.id !== id);
    set({ savedViews: views });
    persistViews(views);
  },
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