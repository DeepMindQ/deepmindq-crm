/**
 * Creates a mock Prisma db client with in-memory storage for API tests.
 * All models store records in Maps; operations simulate Prisma behavior.
 */
export function createMockDb() {
  const store = new Map<string, Map<string, any>>()

  function getCollection(model: string) {
    if (!store.has(model)) store.set(model, new Map())
    return store.get(model)!
  }

  function generateId(prefix: string) {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  }

  function matchesWhere(record: any, where: any): boolean {
    if (!where) return true
    for (const [key, value] of Object.entries(where)) {
      if (value === null || value === undefined) continue
      if (key === 'AND') {
        if (!Array.isArray(value).every((w: any) => matchesWhere(record, w))) return false
      } else if (key === 'OR') {
        if (!Array.isArray(value).some((w: any) => matchesWhere(record, w))) return false
      } else if (key === 'NOT') {
        if (matchesWhere(record, value)) return false
      } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        if ('in' in value) {
          if (!value.in.includes(record[key])) return false
        } else if ('notIn' in value) {
          if (value.notIn.includes(record[key])) return false
        } else if ('not' in value && typeof value.not !== 'object') {
          if (record[key] === value.not) return false
        } else if ('contains' in value) {
          const target = record[key]
          if (typeof target === 'string' && !target.includes(value.contains)) return false
        } else if ('mode' in value && 'contains' in value) {
          const target = record[key]
          if (typeof target === 'string' && !target.toLowerCase().includes(String(value.contains).toLowerCase())) return false
        } else if ('gt' in value) {
          if (!(record[key] > value.gt)) return false
        } else if ('gte' in value) {
          if (!(record[key] >= value.gte)) return false
        } else if ('lt' in value) {
          if (!(record[key] < value.lt)) return false
        } else if ('lte' in value) {
          if (!(record[key] <= value.lte)) return false
        } else {
          // Nested where
          if (!matchesWhere(record[key], value)) return false
        }
      } else {
        if (record[key] !== value) return false
      }
    }
    return true
  }

  function createModel(prefix: string) {
    return {
      findMany: async (args?: any) => {
        const collection = getCollection(prefix)
        let results = Array.from(collection.values())
        if (args?.where) results = results.filter(r => matchesWhere(r, args.where))
        if (args?.orderBy) {
          const [field, dir] = Object.entries(args.orderBy)[0] as [string, string]
          results.sort((a, b) => {
            const aVal = a[field]
            const bVal = b[field]
            if (aVal == null && bVal == null) return 0
            if (aVal == null) return 1
            if (bVal == null) return -1
            const cmp = String(aVal).localeCompare(String(bVal))
            return dir === 'desc' ? -cmp : cmp
          })
        }
        const skip = args?.skip || 0
        const take = args?.take || results.length
        return results.slice(skip, skip + take)
      },
      findFirst: async (args?: any) => {
        const collection = getCollection(prefix)
        let results = Array.from(collection.values())
        if (args?.where) results = results.filter(r => matchesWhere(r, args.where))
        if (args?.orderBy) {
          const [field, dir] = Object.entries(args.orderBy)[0] as [string, string]
          results.sort((a, b) => {
            const aVal = a[field]
            const bVal = b[field]
            if (aVal == null && bVal == null) return 0
            if (aVal == null) return 1
            if (bVal == null) return -1
            const cmp = String(aVal).localeCompare(String(bVal))
            return dir === 'desc' ? -cmp : cmp
          })
        }
        return results[0] || null
      },
      findUnique: async (args: any) => {
        const collection = getCollection(prefix)
        if (args?.where?.id) return collection.get(args.where.id) || null
        for (const record of collection.values()) {
          if (args?.where && matchesWhere(record, args.where)) return record
        }
        return null
      },
      create: async (args: any) => {
        const collection = getCollection(prefix)
        const id = args?.data?.id || generateId(prefix)
        const now = new Date().toISOString()
        const record = { ...args.data, id, createdAt: args.data.createdAt || now, updatedAt: args.data.updatedAt || now }
        collection.set(id, record)
        return record
      },
      update: async (args: any) => {
        const collection = getCollection(prefix)
        let record: any = null
        if (args?.where?.id) record = collection.get(args.where.id)
        if (!record) throw new Error(`Record not found in ${prefix}`)
        const updated = { ...record, ...args.data, updatedAt: new Date().toISOString() }
        collection.set(record.id, updated)
        return updated
      },
      upsert: async (args: any) => {
        const collection = getCollection(prefix)
        let record: any = null
        if (args?.where?.id) record = collection.get(args.where.id) || null
        if (record) {
          const updated = { ...record, ...args.update, updatedAt: new Date().toISOString() }
          collection.set(record.id, updated)
          return updated
        } else {
          const id = args?.create?.id || generateId(prefix)
          const now = new Date().toISOString()
          const newRecord = { ...args.create, id, createdAt: now, updatedAt: now }
          collection.set(id, newRecord)
          return newRecord
        }
      },
      deleteMany: async (args?: any) => {
        const collection = getCollection(prefix)
        if (!args?.where) {
          const count = collection.size
          collection.clear()
          return { count }
        }
        let count = 0
        for (const [id, record] of collection.entries()) {
          if (matchesWhere(record, args.where)) {
            collection.delete(id)
            count++
          }
        }
        return { count }
      },
      delete: async (args: any) => {
        const collection = getCollection(prefix)
        if (args?.where?.id) {
          const record = collection.get(args.where.id)
          if (record) collection.delete(args.where.id)
          return record || null
        }
        return null
      },
      count: async (args?: any) => {
        const collection = getCollection(prefix)
        let results = Array.from(collection.values())
        if (args?.where) results = results.filter(r => matchesWhere(r, args.where))
        return results.length
      },
      updateMany: async (args: any) => {
        const collection = getCollection(prefix)
        let count = 0
        for (const [id, record] of collection.entries()) {
          if (matchesWhere(record, args.where)) {
            const updated = { ...record, ...args.data, updatedAt: new Date().toISOString() }
            collection.set(id, updated)
            count++
          }
        }
        return { count }
      },
      createMany: async (args: any) => {
        const collection = getCollection(prefix)
        for (const data of args.data) {
          const id = data.id || generateId(prefix)
          const now = new Date().toISOString()
          collection.set(id, { ...data, id, createdAt: now, updatedAt: now })
        }
        return { count: args.data.length }
      },
      aggregate: async (args: any) => {
        const collection = getCollection(prefix)
        let results = Array.from(collection.values())
        if (args?.where) results = results.filter(r => matchesWhere(r, args.where))
        const aggResult: any = {}
        for (const item of (args?._count || [])) {
          aggResult[item] = results.length
        }
        for (const item of (args?._sum || [])) {
          aggResult[item] = results.reduce((sum: number, r: any) => sum + (r[item] || 0), 0)
        }
        return aggResult
      },
    }
  }

  // Seed deterministic test data
  const companies = [
    { id: 'co-test-1', name: 'TestCorp Alpha', domain: 'testcorp-alpha.com', website: 'https://testcorp-alpha.com', industry: 'Technology', status: 'new', rawName: 'TestCorp Alpha', description: 'A test company', size: 'mid-market', intelligenceScore: 0, createdAt: '2024-01-15T08:00:00.000Z', updatedAt: '2024-01-15T08:00:00.000Z' },
    { id: 'co-test-2', name: 'Beta Industries', domain: 'beta-industries.io', website: 'https://beta-industries.io', industry: 'Finance', status: 'active', rawName: 'Beta Industries', description: 'Another test company', size: 'enterprise', intelligenceScore: 0, createdAt: '2024-02-20T10:00:00.000Z', updatedAt: '2024-02-20T10:00:00.000Z' },
    { id: 'co-test-3', name: 'Gamma Services', domain: 'gamma-services.com', website: 'https://gamma-services.com', industry: 'Technology', status: 'archived', rawName: 'Gamma Services', description: 'Archived company', size: 'small', intelligenceScore: 0, createdAt: '2024-03-01T12:00:00.000Z', updatedAt: '2024-03-01T12:00:00.000Z' },
    { id: 'co-test-4', name: 'Delta Corp', domain: 'delta-corp.com', website: 'https://delta-corp.com', industry: 'Healthcare', status: 'active', rawName: 'Delta Corp', description: 'Health tech company', size: 'enterprise', intelligenceScore: 0, createdAt: '2024-04-01T09:00:00.000Z', updatedAt: '2024-04-01T09:00:00.000Z' },
    { id: 'co-test-5', name: 'Epsilon Labs', domain: 'epsilon-labs.io', website: 'https://epsilon-labs.io', industry: 'Technology', status: 'new', rawName: 'Epsilon Labs', description: 'AI startup', size: 'small', intelligenceScore: 0, createdAt: '2024-05-10T14:00:00.000Z', updatedAt: '2024-05-10T14:00:00.000Z' },
  ]

  const contacts = [
    { id: 'con-test-1', firstName: 'Alice', lastName: 'Smith', email: 'alice@testcorp-alpha.com', companyId: 'co-test-1', status: 'active', title: 'CEO', createdAt: '2024-01-16T08:00:00.000Z', updatedAt: '2024-01-16T08:00:00.000Z' },
    { id: 'con-test-2', firstName: 'Bob', lastName: 'Jones', email: 'bob@beta-industries.io', companyId: 'co-test-2', status: 'active', title: 'CTO', createdAt: '2024-02-21T10:00:00.000Z', updatedAt: '2024-02-21T10:00:00.000Z' },
    { id: 'con-test-3', firstName: 'Carol', lastName: 'Williams', email: 'carol@gamma-services.com', companyId: 'co-test-3', status: 'active', title: 'VP Sales', createdAt: '2024-03-02T12:00:00.000Z', updatedAt: '2024-03-02T12:00:00.000Z' },
  ]

  // Pre-populate
  for (const c of companies) getCollection('company').set(c.id, c)
  for (const c of contacts) getCollection('contact').set(c.id, c)

  return {
    company: createModel('company'),
    contact: createModel('contact'),
    companyNote: createModel('companyNote'),
    contactNote: createModel('contactNote'),
    companyTimelineEvent: createModel('companyTimelineEvent'),
    systemSetting: createModel('systemSetting'),
    importBatch: createModel('importBatch'),
    opportunityRecommendation: createModel('opportunityRecommendation'),
    companyResearchCard: createModel('companyResearchCard'),
    signal: createModel('signal'),
    lead: createModel('lead'),
    timelineEvent: createModel('timelineEvent'),
    uploadRow: createModel('uploadRow'),
    dataUpload: createModel('dataUpload'),
    timelineEntry: createModel('timelineEntry'),
  }
}
