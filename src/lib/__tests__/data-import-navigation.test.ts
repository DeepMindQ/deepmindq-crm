/**
 * Ticket 11 — Data Import Navigation Wiring Tests
 *
 * Verifies the three-layer routing:
 * 1. store.ts: 'data-import' in ViewId union
 * 2. screen-map.tsx: lazy import + SCREEN_MAP entry
 * 3. nav-config.ts: sidebar entry in ADMINISTRATION section
 */

import { describe, it, expect } from 'vitest'

describe('Data Import — Navigation Wiring', () => {
  it('store.ts includes data-import in ViewId', async () => {
    const storeModule = await import('@/lib/store')
    const store = storeModule.useAppStore.getState()

    expect(typeof store.setActiveView).toBe('function')

    const viewId = 'data-import' as storeModule.ViewId
    expect(() => store.setActiveView(viewId)).not.toThrow()
  })

  it('screen-map.tsx has data-import entry', async () => {
    const { SCREEN_MAP } = await import('@/lib/screen-map')

    expect('data-import' in SCREEN_MAP).toBe(true)
    expect(typeof SCREEN_MAP['data-import']).toBe('function')
  })

  it('nav-config.ts has data-import in ADMINISTRATION section', async () => {
    const { NAV_SECTIONS } = await import('@/lib/nav-config')

    const adminSection = NAV_SECTIONS.find(s => s.heading === 'ADMINISTRATION')
    expect(adminSection).toBeDefined()

    const importItem = adminSection!.items.find(i => i.key === 'data-import')
    expect(importItem).toBeDefined()
    expect(importItem!.label).toBe('Intelligence Import')
    expect(importItem!.icon).toBeTruthy()
    expect(importItem!.isNew).toBe(true)
  })
})
