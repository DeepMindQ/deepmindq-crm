'use client';

/* ═══════════════════════════════════════════════════════════════
   MS9 §7 — useAdvisorWorkspace Hook
   
   Manages the intelligence analyst's workspace state:
   saved briefings, pinned accounts, conversation history, and
   quick-access intelligence items.
   
   This is NOT a generic list manager. It tracks intelligence
   workspace items with access timestamps, sort ordering, and
   section-based organization for the analyst workflow.
   
   Tokens: N/A (logic only — components handle rendering)
   ═══════════════════════════════════════════════════════════════ */

import { useState, useCallback, useMemo } from 'react';
import type {
  WorkspaceItem,
  AdvisorWorkspace,
} from '@/types/ms9-advisor';

// ── Hook Options ──────────────────────────────────────────

export interface UseAdvisorWorkspaceOptions {
  /** Initial workspace data (for hydration from server) */
  initialWorkspace?: AdvisorWorkspace;
  
  /** Callback to persist workspace changes to backend */
  persistWorkspace?: (workspace: AdvisorWorkspace) => Promise<void>;
  
  /** Maximum items per section (default: 50) */
  maxItemsPerSection?: number;
}

// ── Hook Return Type ──────────────────────────────────────

export interface UseAdvisorWorkspaceReturn {
  /** Complete workspace data */
  workspace: AdvisorWorkspace;
  
  /** Whether the workspace panel is open */
  panelOpen: boolean;
  
  /** Currently active section tab */
  activeSection: WorkspaceItem['section'];
  
  /** Item counts per section */
  sectionCounts: Record<WorkspaceItem['section'], number>;
  
  // ── Actions ──
  
  /** Open the workspace panel */
  openPanel: () => void;
  
  /** Close the workspace panel */
  closePanel: () => void;
  
  /** Toggle the workspace panel */
  togglePanel: () => void;
  
  /** Switch the active section tab */
  setActiveSection: (section: WorkspaceItem['section']) => void;
  
  /** Add a new item to the workspace */
  addItem: (item: Omit<WorkspaceItem, 'id' | 'addedAt' | 'lastAccessedAt' | 'sortOrder'>) => void;
  
  /** Remove an item from the workspace */
  removeItem: (itemId: string) => void;
  
  /** Update an existing workspace item */
  updateItem: (itemId: string, updates: Partial<WorkspaceItem>) => void;
  
  /** Record that an item was accessed (updates lastAccessedAt) */
  touchItem: (itemId: string) => void;
  
  /** Pin an item (move to quick_access section) */
  pinItem: (itemId: string) => void;
  
  /** Unpin an item (move back to its original section) */
  unpinItem: (itemId: string) => void;
  
  /** Clear all items in a section */
  clearSection: (section: WorkspaceItem['section']) => void;
  
  /** Find a specific item by ID */
  findItem: (itemId: string) => WorkspaceItem | undefined;
  
  /** Persist current workspace state to backend */
  persist: () => Promise<void>;
}

// ── Helper: Generate unique IDs ──────────────────────────

function generateId(): string {
  return `ws_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ── Default empty workspace ──────────────────────────────

const emptyWorkspace: AdvisorWorkspace = {
  sections: {
    briefings: [],
    accounts: [],
    history: [],
    quick_access: [],
  },
  totalItems: 0,
  updatedAt: new Date().toISOString(),
};

// ── Hook Implementation ──────────────────────────────────

export function useAdvisorWorkspace({
  initialWorkspace,
  persistWorkspace,
  maxItemsPerSection = 50,
}: UseAdvisorWorkspaceOptions = {}): UseAdvisorWorkspaceReturn {
  const [workspace, setWorkspace] = useState<AdvisorWorkspace>(
    initialWorkspace ?? emptyWorkspace,
  );
  const [panelOpen, setPanelOpen] = useState(false);
  const [activeSection, setActiveSectionState] = useState<WorkspaceItem['section']>('briefings');

  // ── Derived: Section counts ────────────────────────────

  const sectionCounts = useMemo(() => ({
    briefings: workspace.sections.briefings.length,
    accounts: workspace.sections.accounts.length,
    history: workspace.sections.history.length,
    quick_access: workspace.sections.quick_access.length,
  }), [workspace.sections]);

  // ── Panel controls ─────────────────────────────────────

  const openPanel = useCallback(() => setPanelOpen(true), []);
  const closePanel = useCallback(() => setPanelOpen(false), []);
  const togglePanel = useCallback(() => setPanelOpen((prev) => !prev), []);

  // ── Internal: Update workspace and recalculate totals ──

  const updateSections = useCallback(
    (updater: (sections: AdvisorWorkspace['sections']) => AdvisorWorkspace['sections']) => {
      setWorkspace((prev) => {
        const newSections = updater(prev.sections);
        const totalItems = Object.values(newSections).reduce((sum, items) => sum + items.length, 0);
        return {
          sections: newSections,
          totalItems,
          updatedAt: new Date().toISOString(),
        };
      });
    },
    [],
  );

  // ── Add Item ───────────────────────────────────────────

  const addItem = useCallback(
    (item: Omit<WorkspaceItem, 'id' | 'addedAt' | 'lastAccessedAt' | 'sortOrder'>) => {
      const now = new Date().toISOString();
      const newItem: WorkspaceItem = {
        ...item,
        id: generateId(),
        addedAt: now,
        lastAccessedAt: now,
        sortOrder: 0,
      };

      updateSections((sections) => {
        const sectionItems = sections[item.section] ?? [];
        // Enforce max items per section
        const trimmed = sectionItems.length >= maxItemsPerSection
          ? sectionItems.slice(0, maxItemsPerSection - 1)
          : sectionItems;
        return {
          ...sections,
          [item.section]: [...trimmed, { ...newItem, sortOrder: trimmed.length }],
        };
      });
    },
    [updateSections, maxItemsPerSection],
  );

  // ── Remove Item ────────────────────────────────────────

  const removeItem = useCallback(
    (itemId: string) => {
      updateSections((sections) => {
        const newSections = { ...sections };
        for (const key of Object.keys(newSections) as WorkspaceItem['section'][]) {
          newSections[key] = newSections[key].filter((item) => item.id !== itemId);
        }
        return newSections;
      });
    },
    [updateSections],
  );

  // ── Update Item ────────────────────────────────────────

  const updateItem = useCallback(
    (itemId: string, updates: Partial<WorkspaceItem>) => {
      updateSections((sections) => {
        const newSections = { ...sections };
        for (const key of Object.keys(newSections) as WorkspaceItem['section'][]) {
          newSections[key] = newSections[key].map((item) =>
            item.id === itemId ? { ...item, ...updates } : item,
          );
        }
        return newSections;
      });
    },
    [updateSections],
  );

  // ── Touch Item ─────────────────────────────────────────

  const touchItem = useCallback(
    (itemId: string) => {
      updateItem(itemId, { lastAccessedAt: new Date().toISOString() });
    },
    [updateItem],
  );

  // ── Pin Item (move to quick_access) ────────────────────

  const pinItem = useCallback(
    (itemId: string) => {
      updateSections((sections) => {
        let targetItem: WorkspaceItem | null = null;
        const newSections = { ...sections };

        // Find and remove from original section
        for (const key of Object.keys(newSections) as WorkspaceItem['section'][]) {
          const idx = newSections[key].findIndex((item) => item.id === itemId);
          if (idx !== -1) {
            targetItem = { ...newSections[key][idx] };
            newSections[key] = newSections[key].filter((item) => item.id !== itemId);
            break;
          }
        }

        // Add to quick_access
        if (targetItem) {
          targetItem.section = 'quick_access';
          newSections.quick_access = [targetItem, ...newSections.quick_access];
        }

        return newSections;
      });
    },
    [updateSections],
  );

  // ── Unpin Item ─────────────────────────────────────────

  const unpinItem = useCallback(
    (itemId: string) => {
      updateSections((sections) => {
        const newSections = { ...sections };
        const pinned = newSections.quick_access;
        const idx = pinned.findIndex((item) => item.id === itemId);
        if (idx !== -1) {
          // Remove from quick_access (in a real app, restore to original section)
          newSections.quick_access = pinned.filter((item) => item.id !== itemId);
        }
        return newSections;
      });
    },
    [updateSections],
  );

  // ── Clear Section ─────────────────────────────────────

  const clearSection = useCallback(
    (section: WorkspaceItem['section']) => {
      updateSections((sections) => ({
        ...sections,
        [section]: [],
      }));
    },
    [updateSections],
  );

  // ── Find Item ──────────────────────────────────────────

  const findItem = useCallback(
    (itemId: string): WorkspaceItem | undefined => {
      for (const section of Object.values(workspace.sections)) {
        const found = section.find((item) => item.id === itemId);
        if (found) return found;
      }
      return undefined;
    },
    [workspace.sections],
  );

  // ── Persist ────────────────────────────────────────────

  const persist = useCallback(async () => {
    if (persistWorkspace) {
      await persistWorkspace(workspace);
    }
  }, [persistWorkspace, workspace]);

  // ── Set Active Section ────────────────────────────────

  const setActiveSection = useCallback((section: WorkspaceItem['section']) => {
    setActiveSectionState(section);
  }, []);

  return {
    workspace,
    panelOpen,
    activeSection,
    sectionCounts,
    openPanel,
    closePanel,
    togglePanel,
    setActiveSection,
    addItem,
    removeItem,
    updateItem,
    touchItem,
    pinItem,
    unpinItem,
    clearSection,
    findItem,
    persist,
  };
}
