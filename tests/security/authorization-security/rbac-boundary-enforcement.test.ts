import { describe, it, expect } from 'vitest'
import { hasPermission, authorizeRoute, hasAnyPermission } from '@/lib/rbac'
import type { Permission } from '@/lib/rbac'

describe('RBAC Boundary — Viewer Restrictions', () => {
  it('viewer denied all data access', () => {
    const perms: Permission[] = ['companies:read','contacts:read','ai:read','settings:read','email:read','import:read','export:read','knowledge:read','research:read']
    for (const p of perms) expect(hasPermission('viewer', p)).toBe(false)
  })
  it('viewer only dashboard, analytics, reports', () => {
    expect(hasPermission('viewer', 'dashboard:read')).toBe(true)
    expect(hasPermission('viewer', 'analytics:read')).toBe(true)
    expect(hasPermission('viewer', 'reports:read')).toBe(true)
  })
})

describe('RBAC Boundary — User Write Restrictions', () => {
  it('user denied all write permissions', () => {
    const perms: Permission[] = ['companies:write','companies:delete','contacts:write','ai:write','ai:configure','settings:write','email:send','import:write','export:write','knowledge:write']
    for (const p of perms) expect(hasPermission('user', p)).toBe(false)
  })
})

describe('RBAC Boundary — Operator System Restrictions', () => {
  it('operator denied user management', () => expect(hasPermission('operator', 'users:manage')).toBe(false))
  it('operator denied settings write', () => expect(hasPermission('operator', 'settings:write')).toBe(false))
  it('operator denied AI configure', () => expect(hasPermission('operator', 'ai:configure')).toBe(false))
  it('operator can read data', () => expect(hasPermission('operator', 'companies:read')).toBe(true))
  it('operator can use AI', () => expect(hasPermission('operator', 'ai:read')).toBe(true))
})

describe('RBAC Boundary — Route Authorization', () => {
  it('viewer denied GET /api/companies', () => expect(authorizeRoute('/api/companies','GET','viewer').authorized).toBe(false))
  it('user denied POST /api/companies', () => expect(authorizeRoute('/api/companies','POST','user').authorized).toBe(false))
  it('operator denied DELETE /api/companies', () => expect(authorizeRoute('/api/companies','DELETE','operator').authorized).toBe(false))
  it('admin full CRUD /api/companies', () => {
    expect(authorizeRoute('/api/companies','GET','admin').authorized).toBe(true)
    expect(authorizeRoute('/api/companies','POST','admin').authorized).toBe(true)
    expect(authorizeRoute('/api/companies','PUT','admin').authorized).toBe(true)
    expect(authorizeRoute('/api/companies','DELETE','admin').authorized).toBe(true)
  })
  it('public routes accessible to all', () => {
    expect(authorizeRoute('/api/health','GET','viewer').authorized).toBe(true)
    expect(authorizeRoute('/api/ping','GET','user').authorized).toBe(true)
  })
})

describe('hasAnyPermission', () => {
  it('true if ANY match', () => expect(hasAnyPermission('admin', ['companies:read', 'nonexistent:perm'])).toBe(true))
  it('false if NONE match', () => expect(hasAnyPermission('viewer', ['companies:write', 'ai:configure'])).toBe(false))
  it('false for empty array', () => expect(hasAnyPermission('admin', [])).toBe(false))
})
