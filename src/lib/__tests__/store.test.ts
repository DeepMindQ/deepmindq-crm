import { describe, it, expect, beforeEach } from 'vitest'
import { useAppStore } from '../store'

describe('useAppStore', () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    useAppStore.setState({
      activeView: 'dashboard',
      selectedCompanyId: null,
      selectedContactId: null,
      sidebarCollapsed: false,
      companyStatusFilter: 'all',
    })
  })

  describe('initial state', () => {
    it('has activeView set to "dashboard"', () => {
      const state = useAppStore.getState()
      expect(state.activeView).toBe('dashboard')
    })

    it('has selectedCompanyId set to null', () => {
      const state = useAppStore.getState()
      expect(state.selectedCompanyId).toBeNull()
    })

    it('has selectedContactId set to null', () => {
      const state = useAppStore.getState()
      expect(state.selectedContactId).toBeNull()
    })

    it('has sidebarCollapsed set to false', () => {
      const state = useAppStore.getState()
      expect(state.sidebarCollapsed).toBe(false)
    })

    it('has companyStatusFilter set to "all"', () => {
      const state = useAppStore.getState()
      expect(state.companyStatusFilter).toBe('all')
    })
  })

  describe('setActiveView', () => {
    it('changes activeView to a new valid view', () => {
      useAppStore.getState().setActiveView('companies')
      expect(useAppStore.getState().activeView).toBe('companies')
    })

    it('can change activeView to contact-profile', () => {
      useAppStore.getState().setActiveView('contact-profile')
      expect(useAppStore.getState().activeView).toBe('contact-profile')
    })

    it('can change activeView to import', () => {
      useAppStore.getState().setActiveView('import')
      expect(useAppStore.getState().activeView).toBe('import')
    })

    it('can change activeView to settings', () => {
      useAppStore.getState().setActiveView('settings')
      expect(useAppStore.getState().activeView).toBe('settings')
    })

    it('does not affect other state fields', () => {
      useAppStore.getState().setActiveView('contacts')
      const state = useAppStore.getState()
      expect(state.selectedCompanyId).toBeNull()
      expect(state.selectedContactId).toBeNull()
    })
  })

  describe('setSelectedCompanyId', () => {
    it('changes selectedCompanyId to a string', () => {
      useAppStore.getState().setSelectedCompanyId('company-123')
      expect(useAppStore.getState().selectedCompanyId).toBe('company-123')
    })

    it('can set selectedCompanyId back to null', () => {
      useAppStore.getState().setSelectedCompanyId('company-123')
      useAppStore.getState().setSelectedCompanyId(null)
      expect(useAppStore.getState().selectedCompanyId).toBeNull()
    })

    it('does not affect selectedContactId', () => {
      useAppStore.getState().setSelectedCompanyId('company-123')
      expect(useAppStore.getState().selectedContactId).toBeNull()
    })

    it('does not auto-set activeView — callers must call setActiveView separately', () => {
      useAppStore.getState().setSelectedCompanyId('company-123')
      // activeView should remain as set by beforeEach, not change to 'company-profile'
      expect(useAppStore.getState().activeView).toBe('dashboard')
    })
  })

  describe('setSelectedContactId', () => {
    it('changes selectedContactId to a string', () => {
      useAppStore.getState().setSelectedContactId('contact-456')
      expect(useAppStore.getState().selectedContactId).toBe('contact-456')
    })

    it('can set selectedContactId back to null', () => {
      useAppStore.getState().setSelectedContactId('contact-456')
      useAppStore.getState().setSelectedContactId(null)
      expect(useAppStore.getState().selectedContactId).toBeNull()
    })

    it('does not affect selectedCompanyId', () => {
      useAppStore.getState().setSelectedContactId('contact-456')
      expect(useAppStore.getState().selectedCompanyId).toBeNull()
    })
  })

  describe('toggleSidebar', () => {
    it('toggles sidebarCollapsed from false to true', () => {
      expect(useAppStore.getState().sidebarCollapsed).toBe(false)
      useAppStore.getState().toggleSidebar()
      expect(useAppStore.getState().sidebarCollapsed).toBe(true)
    })

    it('toggles sidebarCollapsed from true back to false', () => {
      useAppStore.getState().toggleSidebar()
      useAppStore.getState().toggleSidebar()
      expect(useAppStore.getState().sidebarCollapsed).toBe(false)
    })
  })

  describe('setCompanyStatusFilter', () => {
    it('changes companyStatusFilter to a new value', () => {
      useAppStore.getState().setCompanyStatusFilter('active')
      expect(useAppStore.getState().companyStatusFilter).toBe('active')
    })

    it('can reset companyStatusFilter to "all"', () => {
      useAppStore.getState().setCompanyStatusFilter('active')
      useAppStore.getState().setCompanyStatusFilter('all')
      expect(useAppStore.getState().companyStatusFilter).toBe('all')
    })
  })
})