/**
 * @vitest-environment node
 * Zustand App Store — Unit Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore, type ViewId } from '@/lib/store';

describe('useAppStore', () => {
  beforeEach(() => {
    // Reset store to initial state
    useAppStore.setState({
      activeView: 'dashboard',
      sidebarCollapsed: false,
      selectedContactId: null,
      selectedCompanyId: null,
      selectedDraftId: null,
      companyStatusFilter: 'all',
      intelligenceActivated: false,
    });
  });

  // ── Initial State ────────────────────────────────────────────────

  describe('initial state', () => {
    it('has dashboard as default activeView', () => {
      expect(useAppStore.getState().activeView).toBe('dashboard');
    });

    it('has sidebarCollapsed as false', () => {
      expect(useAppStore.getState().sidebarCollapsed).toBe(false);
    });

    it('has null selectedContactId', () => {
      expect(useAppStore.getState().selectedContactId).toBeNull();
    });

    it('has null selectedCompanyId', () => {
      expect(useAppStore.getState().selectedCompanyId).toBeNull();
    });

    it('has null selectedDraftId', () => {
      expect(useAppStore.getState().selectedDraftId).toBeNull();
    });

    it('has companyStatusFilter as "all"', () => {
      expect(useAppStore.getState().companyStatusFilter).toBe('all');
    });

    it('has intelligenceActivated as false', () => {
      expect(useAppStore.getState().intelligenceActivated).toBe(false);
    });
  });

  // ── setActiveView ────────────────────────────────────────────────

  describe('setActiveView', () => {
    it('changes activeView to a valid ViewId', () => {
      useAppStore.getState().setActiveView('command-center');
      expect(useAppStore.getState().activeView).toBe('command-center');
    });

    it('changes to intelligence-operations view', () => {
      useAppStore.getState().setActiveView('intelligence-operations');
      expect(useAppStore.getState().activeView).toBe('intelligence-operations');
    });

    it('changes to company-workspace view', () => {
      useAppStore.getState().setActiveView('company-workspace');
      expect(useAppStore.getState().activeView).toBe('company-workspace');
    });

    it('changes to settings view', () => {
      useAppStore.getState().setActiveView('settings');
      expect(useAppStore.getState().activeView).toBe('settings');
    });

    it('changes to S11 UX views (e.g., main-dashboard)', () => {
      useAppStore.getState().setActiveView('main-dashboard');
      expect(useAppStore.getState().activeView).toBe('main-dashboard');
    });

    it('changes to legacy views (e.g., pipeline)', () => {
      useAppStore.getState().setActiveView('pipeline');
      expect(useAppStore.getState().activeView).toBe('pipeline');
    });

    it('changes to detail views (e.g., company-detail)', () => {
      useAppStore.getState().setActiveView('company-detail');
      expect(useAppStore.getState().activeView).toBe('company-detail');
    });

    it('changes to onboarding-wizard view', () => {
      useAppStore.getState().setActiveView('onboarding-wizard');
      expect(useAppStore.getState().activeView).toBe('onboarding-wizard');
    });
  });

  // ── setSidebarCollapsed / toggleSidebar ──────────────────────────

  describe('setSidebarCollapsed', () => {
    it('collapses the sidebar', () => {
      useAppStore.getState().setSidebarCollapsed(true);
      expect(useAppStore.getState().sidebarCollapsed).toBe(true);
    });

    it('expands the sidebar', () => {
      useAppStore.getState().setSidebarCollapsed(true);
      useAppStore.getState().setSidebarCollapsed(false);
      expect(useAppStore.getState().sidebarCollapsed).toBe(false);
    });
  });

  describe('toggleSidebar', () => {
    it('toggles from expanded to collapsed', () => {
      useAppStore.getState().toggleSidebar();
      expect(useAppStore.getState().sidebarCollapsed).toBe(true);
    });

    it('toggles from collapsed to expanded', () => {
      useAppStore.getState().setSidebarCollapsed(true);
      useAppStore.getState().toggleSidebar();
      expect(useAppStore.getState().sidebarCollapsed).toBe(false);
    });
  });

  // ── Selection setters ────────────────────────────────────────────

  describe('setSelectedContactId', () => {
    it('sets contact ID', () => {
      useAppStore.getState().setSelectedContactId('c-1');
      expect(useAppStore.getState().selectedContactId).toBe('c-1');
    });

    it('clears contact ID by setting null', () => {
      useAppStore.getState().setSelectedContactId('c-1');
      useAppStore.getState().setSelectedContactId(null);
      expect(useAppStore.getState().selectedContactId).toBeNull();
    });
  });

  describe('setSelectedCompanyId', () => {
    it('sets company ID', () => {
      useAppStore.getState().setSelectedCompanyId('org-1');
      expect(useAppStore.getState().selectedCompanyId).toBe('org-1');
    });

    it('clears company ID', () => {
      useAppStore.getState().setSelectedCompanyId('org-1');
      useAppStore.getState().setSelectedCompanyId(null);
      expect(useAppStore.getState().selectedCompanyId).toBeNull();
    });
  });

  describe('setSelectedDraftId', () => {
    it('sets draft ID', () => {
      useAppStore.getState().setSelectedDraftId('d-1');
      expect(useAppStore.getState().selectedDraftId).toBe('d-1');
    });

    it('clears draft ID', () => {
      useAppStore.getState().setSelectedDraftId('d-1');
      useAppStore.getState().setSelectedDraftId(null);
      expect(useAppStore.getState().selectedDraftId).toBeNull();
    });
  });

  // ── setCompanyStatusFilter ───────────────────────────────────────

  describe('setCompanyStatusFilter', () => {
    it('sets a filter value', () => {
      useAppStore.getState().setCompanyStatusFilter('active');
      expect(useAppStore.getState().companyStatusFilter).toBe('active');
    });

    it('resets to all', () => {
      useAppStore.getState().setCompanyStatusFilter('active');
      useAppStore.getState().setCompanyStatusFilter('all');
      expect(useAppStore.getState().companyStatusFilter).toBe('all');
    });
  });

  // ── setIntelligenceActivated ─────────────────────────────────────

  describe('setIntelligenceActivated', () => {
    it('activates intelligence', () => {
      useAppStore.getState().setIntelligenceActivated(true);
      expect(useAppStore.getState().intelligenceActivated).toBe(true);
    });

    it('deactivates intelligence', () => {
      useAppStore.getState().setIntelligenceActivated(true);
      useAppStore.getState().setIntelligenceActivated(false);
      expect(useAppStore.getState().intelligenceActivated).toBe(false);
    });
  });

  // ── State combinations ────────────────────────────────────────

  describe('state combinations', () => {
    it('maintains multiple state changes independently', () => {
      useAppStore.getState().setActiveView('command-center');
      useAppStore.getState().setSidebarCollapsed(true);
      useAppStore.getState().setSelectedContactId('c-1');
      useAppStore.getState().setSelectedCompanyId('org-1');
      useAppStore.getState().setSelectedDraftId('d-1');
      useAppStore.getState().setCompanyStatusFilter('active');
      useAppStore.getState().setIntelligenceActivated(true);

      const state = useAppStore.getState();
      expect(state.activeView).toBe('command-center');
      expect(state.sidebarCollapsed).toBe(true);
      expect(state.selectedContactId).toBe('c-1');
      expect(state.selectedCompanyId).toBe('org-1');
      expect(state.selectedDraftId).toBe('d-1');
      expect(state.companyStatusFilter).toBe('active');
      expect(state.intelligenceActivated).toBe(true);
    });

    it('setState can update multiple fields at once', () => {
      useAppStore.setState({
        activeView: 'analytics',
        sidebarCollapsed: true,
        selectedContactId: 'c-99',
        selectedCompanyId: 'org-99',
        selectedDraftId: 'd-99',
        companyStatusFilter: 'inactive',
        intelligenceActivated: true,
      });

      const state = useAppStore.getState();
      expect(state.activeView).toBe('analytics');
      expect(state.sidebarCollapsed).toBe(true);
      expect(state.selectedContactId).toBe('c-99');
    });

    it('toggleSidebar toggles correctly from any starting state', () => {
      useAppStore.getState().setSidebarCollapsed(true);
      useAppStore.getState().toggleSidebar();
      expect(useAppStore.getState().sidebarCollapsed).toBe(false);
      useAppStore.getState().toggleSidebar();
      expect(useAppStore.getState().sidebarCollapsed).toBe(true);
      useAppStore.getState().toggleSidebar();
      expect(useAppStore.getState().sidebarCollapsed).toBe(false);
    });

    it('can switch between multiple views in sequence', () => {
      useAppStore.getState().setActiveView('dashboard');
      expect(useAppStore.getState().activeView).toBe('dashboard');

      useAppStore.getState().setActiveView('command-center');
      expect(useAppStore.getState().activeView).toBe('command-center');

      useAppStore.getState().setActiveView('company-workspace');
      expect(useAppStore.getState().activeView).toBe('company-workspace');

      useAppStore.getState().setActiveView('settings');
      expect(useAppStore.getState().activeView).toBe('settings');

      useAppStore.getState().setActiveView('dashboard');
      expect(useAppStore.getState().activeView).toBe('dashboard');
    });

    it('changing one selection does not affect others', () => {
      useAppStore.getState().setSelectedContactId('c-1');
      useAppStore.getState().setSelectedCompanyId('org-1');

      useAppStore.getState().setSelectedContactId('c-2');
      expect(useAppStore.getState().selectedCompanyId).toBe('org-1');

      useAppStore.getState().setSelectedCompanyId('org-2');
      expect(useAppStore.getState().selectedContactId).toBe('c-2');
    });

    it('can set all IDs to null independently', () => {
      useAppStore.getState().setSelectedContactId('c-1');
      useAppStore.getState().setSelectedCompanyId('org-1');
      useAppStore.getState().setSelectedDraftId('d-1');

      useAppStore.getState().setSelectedContactId(null);
      expect(useAppStore.getState().selectedCompanyId).toBe('org-1');
      expect(useAppStore.getState().selectedDraftId).toBe('d-1');

      useAppStore.getState().setSelectedCompanyId(null);
      expect(useAppStore.getState().selectedContactId).toBeNull();
      expect(useAppStore.getState().selectedDraftId).toBe('d-1');

      useAppStore.getState().setSelectedDraftId(null);
      expect(useAppStore.getState().selectedContactId).toBeNull();
      expect(useAppStore.getState().selectedCompanyId).toBeNull();
      expect(useAppStore.getState().selectedDraftId).toBeNull();
    });
  });
});
