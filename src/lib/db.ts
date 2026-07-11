import { PrismaClient } from '@prisma/client'
import { MOCK_COMPANIES, MOCK_CONTACTS, MOCK_OPPORTUNITIES, MOCK_TASKS, MOCK_DRAFTS, MOCK_CAPABILITY_DOCS, MOCK_PROMPT_TEMPLATES, MOCK_DASHBOARD_STATS, MOCK_USER } from './mock-data'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

let _db: PrismaClient | null = null
let _dbAvailable: boolean | null = null

function tryCreatePrisma() {
  try {
    const client = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    })
    // Quick connectivity check
    // We'll set dbAvailable on first actual query failure
    return client
  } catch {
    return null
  }
}

// Create a proxy that catches DB errors and falls back gracefully
function createDbProxy(client: PrismaClient | null) {
  if (!client) {
    return createMockProxy()
  }

  return new Proxy(client, {
    get(target, prop) {
      // If we know DB is dead, route to mock
      if (_dbAvailable === false) {
        return createMockProxy()[prop as string]
      }
      
      const value = Reflect.get(target, prop)
      if (typeof value !== 'function') return value
      
      return function(...args: any[]) {
        try {
          const result = value.apply(target, args)
          // Handle async results
          if (result && typeof result.then === 'function') {
            return result.catch((err: any) => {
              console.warn(`[DB] Query failed (${String(prop)}), using mock fallback:`, err?.message || err)
              _dbAvailable = false
              const mockProxy = createMockProxy()
              const mockFn = mockProxy[prop as string]
              if (typeof mockFn === 'function') {
                return mockFn.apply(mockProxy, args)
              }
              return Promise.resolve([])
            })
          }
          return result
        } catch (err) {
          console.warn(`[DB] Sync query failed (${String(prop)}), using mock fallback`)
          _dbAvailable = false
          const mockProxy = createMockProxy()
          const mockFn = mockProxy[prop as string]
          if (typeof mockFn === 'function') {
            return mockFn.apply(mockProxy, args)
          }
          return []
        }
      }
    }
  })
}

function createMockProxy() {
  const models: Record<string, any> = {}

  function createModelProxy(data: any[]) {
    return new Proxy({}, {
      get(_target, prop) {
        // findMany, findUnique, findFirst, create, update, delete, count, aggregate, groupBy
        const methods: Record<string, Function> = {
          findMany: (args?: any) => {
            let result = [...data]
            if (args?.where) {
              result = filterData(result, args.where)
            }
            if (args?.skip) result = result.slice(args.skip)
            if (args?.take) result = result.slice(0, args.take)
            if (args?.orderBy) {
              const key = Object.keys(args.orderBy)[0]
              const dir = args.orderBy[key] === 'desc' ? -1 : 1
              result.sort((a: any, b: any) => (a[key] > b[key] ? dir : -dir))
            }
            if (args?.include) {
              result = result.map((item: any) => enrichItem(item, args.include))
            }
            if (args?.select) {
              result = result.map((item: any) => {
                const picked: any = {}
                for (const k of Object.keys(args.select)) picked[k] = item[k]
                return picked
              })
            }
            return Promise.resolve(result)
          },
          findUnique: (args: any) => {
            if (!args?.where) return Promise.resolve(null)
            const item = data.find((d: any) => matchWhere(d, args.where))
            if (item && args?.include) return Promise.resolve(enrichItem(item, args.include))
            return Promise.resolve(item || null)
          },
          findFirst: (args: any) => {
            let result = [...data]
            if (args?.where) result = filterData(result, args.where)
            const item = result[0] || null
            if (item && args?.include) return Promise.resolve(enrichItem(item, args.include))
            return Promise.resolve(item)
          },
          count: (args?: any) => {
            let result = [...data]
            if (args?.where) result = filterData(result, args.where)
            return Promise.resolve(result.length)
          },
          create: (args: any) => {
            const newItem = { id: `mock-${Date.now()}`, ...args?.data, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
            data.push(newItem)
            return Promise.resolve(newItem)
          },
          update: (args: any) => {
            const idx = data.findIndex((d: any) => matchWhere(d, args?.where))
            if (idx >= 0) {
              data[idx] = { ...data[idx], ...args?.data, updatedAt: new Date().toISOString() }
              if (args?.include) return Promise.resolve(enrichItem(data[idx], args.include))
              return Promise.resolve(data[idx])
            }
            return Promise.resolve(null)
          },
          delete: (args: any) => {
            const idx = data.findIndex((d: any) => matchWhere(d, args?.where))
            if (idx >= 0) {
              const [removed] = data.splice(idx, 1)
              return Promise.resolve(removed)
            }
            return Promise.resolve(null)
          },
          deleteMany: (args?: any) => {
            if (args?.where) {
              const before = data.length
              const filtered = data.filter((d: any) => !matchWhere(d, args.where))
              data.length = 0
              data.push(...filtered)
              return Promise.resolve({ count: before - data.length })
            }
            data.length = 0
            return Promise.resolve({ count: data.length })
          },
          aggregate: (args?: any) => {
            let result = [...data]
            if (args?.where) result = filterData(result, args.where)
            const agg: any = { _count: result.length, _sum: {}, _avg: {}, _min: {}, _max: {} }
            if (args?._count) {
              for (const key of Object.keys(args._count)) {
                agg._count[key] = result.filter((d: any) => d[key] != null).length
              }
            }
            return Promise.resolve(agg)
          },
          groupBy: (args: any) => {
            let result = [...data]
            if (args?.where) result = filterData(result, args.where)
            const groups: Record<string, any> = {}
            for (const item of result) {
              const key = item[args.by[0]] || 'unknown'
              if (!groups[key]) groups[key] = { _count: 0 }
              groups[key]._count++
            }
            return Promise.resolve(Object.entries(groups).map(([k, v]) => ({ [args.by[0]]: k, _count: v._count })))
          },
        }
        return methods[prop] || (() => Promise.resolve(null))
      }
    })
  }

  models.company = createModelProxy(MOCK_COMPANIES)
  models.contact = createModelProxy(MOCK_CONTACTS)
  models.opportunity = createModelProxy(MOCK_OPPORTUNITIES)
  models.task = createModelProxy(MOCK_TASKS)
  models.draft = createModelProxy(MOCK_DRAFTS)
  models.capabilityDocument = createModelProxy(MOCK_CAPABILITY_DOCS)
  models.promptTemplate = createModelProxy(MOCK_PROMPT_TEMPLATES)
  models.user = createModelProxy([MOCK_USER])
  // Empty models for other entities
  const emptyModels = ['companyNote', 'contactNote', 'companyResearchCard', 'companyResearchSource', 'timelineEntry', 'capabilitySnippet', 'emailHealthCheck', 'importBatch', 'account', 'session', 'verificationToken', 'auditLog', 'notification', 'userPreferences', 'customFieldDefinition', 'customFieldValue', 'tag', 'tagAssignment', 'emailSequence', 'emailSequenceStep', 'comment', 'team', 'teamMember']
  for (const m of emptyModels) {
    models[m] = createModelProxy([])
  }

  return new Proxy(models, {
    get(target, prop) {
      if (prop in target) return target[prop as string]
      // Unknown model - return empty mock
      return createModelProxy([])
    }
  })
}

// Simple where clause matching
function matchWhere(item: any, where: any): boolean {
  if (!where) return false
  for (const [key, val] of Object.entries(where)) {
    if (val === null || val === undefined) continue
    if (typeof val === 'object') {
      if ('equals' in val) { if (item[key] !== val.equals) return false }
      else if ('contains' in val) { if (!(item[key] || '').includes(val.contains as string)) return false }
      else if ('in' in val) { if (!(val.in as any[]).includes(item[key])) return false }
      else if ('not' in val) {
        if (typeof val.not === 'string' && item[key] === val.not) return false
        if (typeof val.not === 'object' && 'equals' in val.not && item[key] === val.not.equals) return false
      }
      else if ('startsWith' in val) { if (!(item[key] || '').startsWith(val.startsWith as string)) return false }
      else if ('gte' in val) { if (!(item[key] >= val.gte)) return false }
      else if ('lte' in val) { if (!(item[key] <= val.lte)) return false }
      else if ('gt' in val) { if (!(item[key] > val.gt)) return false }
      else if ('lt' in val) { if (!(item[key] < val.lt)) return false }
      else if ('notIn' in val) { if ((val.notIn as any[]).includes(item[key])) return false }
      else if ('has' in val) { /* array contains - simplified */ }
      else if ('some' in val) { /* relation filter - simplified */ }
      else if ('AND' in val) { if (!matchWhere(item, val.AND)) return false }
      else if ('OR' in val) {
        if (!Array.isArray(val.OR) || !val.OR.some((sub: any) => matchWhere(item, sub))) return false
      }
      else if ('is' in val) { /* null check */ }
    } else {
      if (item[key] !== val) return false
    }
  }
  return true
}

function filterData(data: any[], where: any): any[] {
  if (!where) return data
  if (where.AND) {
    let result = data
    for (const sub of where.AND) {
      result = result.filter((d: any) => matchWhere(d, sub))
    }
    return result
  }
  if (where.OR) {
    return data.filter((d: any) => where.OR.some((sub: any) => matchWhere(d, sub)))
  }
  return data.filter((d: any) => matchWhere(d, where))
}

function enrichItem(item: any, include: any): any {
  const result = { ...item }
  for (const [key, val] of Object.entries(include)) {
    if (val === true) {
      if (key === 'contacts') result.contacts = MOCK_CONTACTS.filter(c => c.companyId === item.id)
      else if (key === 'opportunities') result.opportunities = MOCK_OPPORTUNITIES.filter(o => o.companyId === item.id)
      else if (key === 'company') result.company = MOCK_COMPANIES.find(c => c.id === item.companyId) || null
      else if (key === 'targetContact') result.targetContact = MOCK_CONTACTS.find(c => c.id === item.targetContactId) || null
      else if (key === 'notes') result.notes = []
      else if (key === 'timeline') result.timeline = []
      else result[key] = []
    }
  }
  return result
}

// Initialize
_db = tryCreatePrisma()
export const db = createDbProxy(_db)

export function isDbAvailable() {
  return _dbAvailable !== false && _db !== null
}