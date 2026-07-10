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

export const useAppStore = create<AppState>((set) => ({
  activeView: "dashboard",
  selectedCompanyId: null,
  selectedContactId: null,
  sidebarCollapsed: false,
  searchQuery: "",
  showNotifications: true,
  companyStatusFilter: "all",
  setActiveView: (view) => set({ activeView: view }),
  setSelectedCompanyId: (id) => set({ selectedCompanyId: id }),
  setSelectedContactId: (id) => set({ selectedContactId: id }),
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setCompanyStatusFilter: (filter) => set({ companyStatusFilter: filter }),
}));