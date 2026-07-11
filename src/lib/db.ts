// Mock-only database layer for Vercel deployment (no SQLite needed)

const MOCK_COMPANIES = [
  { id: 'comp-1', name: 'Acme Corp', domain: 'acmecorp.com', linkedinUrl: 'https://linkedin.com/company/acmecorp', website: 'https://acmecorp.com', industry: 'Technology', employeeSize: '500-1000', country: 'United States', location: 'San Francisco, CA', status: 'active', intelligenceScore: 87, dataFreshness: 'fresh', lastUpdatedAt: new Date().toISOString(), createdAt: new Date(Date.now() - 30*86400000).toISOString() },
  { id: 'comp-2', name: 'TechVentures Inc', domain: 'techventures.io', linkedinUrl: 'https://linkedin.com/company/techventures', website: 'https://techventures.io', industry: 'SaaS', employeeSize: '100-250', country: 'India', location: 'Bangalore, KA', status: 'new', intelligenceScore: 72, dataFreshness: 'fresh', lastUpdatedAt: new Date().toISOString(), createdAt: new Date(Date.now() - 15*86400000).toISOString() },
  { id: 'comp-3', name: 'Global Finance Solutions', domain: 'gfsolutions.com', linkedinUrl: null, website: 'https://gfsolutions.com', industry: 'Finance', employeeSize: '1000-5000', country: 'United Kingdom', location: 'London, UK', status: 'active', intelligenceScore: 91, dataFreshness: 'stale', lastUpdatedAt: new Date(Date.now() - 7*86400000).toISOString(), createdAt: new Date(Date.now() - 60*86400000).toISOString() },
  { id: 'comp-4', name: 'HealthTech Plus', domain: 'healthtechplus.com', linkedinUrl: 'https://linkedin.com/company/healthtechplus', website: 'https://healthtechplus.com', industry: 'Healthcare', employeeSize: '250-500', country: 'United States', location: 'Boston, MA', status: 'researching', intelligenceScore: 78, dataFreshness: 'fresh', lastUpdatedAt: new Date().toISOString(), createdAt: new Date(Date.now() - 10*86400000).toISOString() },
  { id: 'comp-5', name: 'GreenEnergy Corp', domain: 'greenenergy.co', linkedinUrl: null, website: 'https://greenenergy.co', industry: 'Energy', employeeSize: '50-100', country: 'Germany', location: 'Berlin, DE', status: 'new', intelligenceScore: 65, dataFreshness: 'unknown', lastUpdatedAt: new Date(Date.now() - 2*86400000).toISOString(), createdAt: new Date(Date.now() - 5*86400000).toISOString() },
  { id: 'comp-6', name: 'CloudScale Systems', domain: 'cloudscale.dev', linkedinUrl: 'https://linkedin.com/company/cloudscale', website: 'https://cloudscale.dev', industry: 'Cloud Computing', employeeSize: '1000-5000', country: 'United States', location: 'Seattle, WA', status: 'active', intelligenceScore: 93, dataFreshness: 'fresh', lastUpdatedAt: new Date().toISOString(), createdAt: new Date(Date.now() - 45*86400000).toISOString() },
]

const MOCK_CONTACTS = [
  { id: 'cont-1', companyId: 'comp-1', name: 'Sarah Johnson', email: 'sarah@acmecorp.com', jobTitle: 'VP of Engineering', roleBucket: 'decision-maker', linkedinUrl: 'https://linkedin.com/in/sarahjohnson', phone: '+1 415-555-0101', location: 'San Francisco, CA', status: 'active', emailHealth: 'valid', emailHealthScore: 95, lastContactedAt: new Date(Date.now() - 3*86400000).toISOString(), createdAt: new Date(Date.now() - 20*86400000).toISOString(), updatedAt: new Date().toISOString() },
  { id: 'cont-2', companyId: 'comp-1', name: 'Mike Chen', email: 'mike.chen@acmecorp.com', jobTitle: 'CTO', roleBucket: 'decision-maker', linkedinUrl: 'https://linkedin.com/in/mikechen', phone: '+1 415-555-0102', location: 'San Francisco, CA', status: 'active', emailHealth: 'valid', emailHealthScore: 92, lastContactedAt: null, createdAt: new Date(Date.now() - 25*86400000).toISOString(), updatedAt: new Date().toISOString() },
  { id: 'cont-3', companyId: 'comp-2', name: 'Priya Sharma', email: 'priya@techventures.io', jobTitle: 'Head of Product', roleBucket: 'influencer', linkedinUrl: 'https://linkedin.com/in/priyasharma', phone: '+91 80-555-0201', location: 'Bangalore, KA', status: 'new', emailHealth: 'valid', emailHealthScore: 88, lastContactedAt: null, createdAt: new Date(Date.now() - 12*86400000).toISOString(), updatedAt: new Date().toISOString() },
  { id: 'cont-4', companyId: 'comp-3', name: 'James Wilson', email: 'j.wilson@gfsolutions.com', jobTitle: 'CFO', roleBucket: 'decision-maker', linkedinUrl: null, phone: '+44 20-555-0301', location: 'London, UK', status: 'active', emailHealth: 'valid', emailHealthScore: 90, lastContactedAt: new Date(Date.now() - 7*86400000).toISOString(), createdAt: new Date(Date.now() - 50*86400000).toISOString(), updatedAt: new Date().toISOString() },
  { id: 'cont-5', companyId: 'comp-4', name: 'Dr. Emily Brown', email: 'emily.b@healthtechplus.com', jobTitle: 'Director of Innovation', roleBucket: 'champion', linkedinUrl: 'https://linkedin.com/in/emilybrown', phone: '+1 617-555-0401', location: 'Boston, MA', status: 'new', emailHealth: 'risky', emailHealthScore: 60, lastContactedAt: null, createdAt: new Date(Date.now() - 8*86400000).toISOString(), updatedAt: new Date().toISOString() },
  { id: 'cont-6', companyId: 'comp-6', name: 'David Park', email: 'david.park@cloudscale.dev', jobTitle: 'VP of Cloud Infrastructure', roleBucket: 'decision-maker', linkedinUrl: 'https://linkedin.com/in/davidpark', phone: '+1 206-555-0601', location: 'Seattle, WA', status: 'active', emailHealth: 'valid', emailHealthScore: 97, lastContactedAt: new Date(Date.now() - 86400000).toISOString(), createdAt: new Date(Date.now() - 40*86400000).toISOString(), updatedAt: new Date().toISOString() },
]

const MOCK_OPPORTUNITIES = [
  { id: 'opp-1', companyId: 'comp-1', title: 'Enterprise License Deal', description: 'Annual enterprise license for AI sales intelligence platform', targetContactId: 'cont-1', status: 'proposal-sent', nextAction: 'Follow up on proposal by Friday', createdAt: new Date(Date.now() - 14*86400000).toISOString(), updatedAt: new Date().toISOString() },
  { id: 'opp-2', companyId: 'comp-6', title: 'Cloud Integration Partnership', description: 'Strategic partnership for cloud-based CRM integration', targetContactId: 'cont-6', status: 'negotiation', nextAction: 'Schedule demo with engineering team', createdAt: new Date(Date.now() - 20*86400000).toISOString(), updatedAt: new Date().toISOString() },
  { id: 'opp-3', companyId: 'comp-3', title: 'Financial Analytics Module', description: 'Custom analytics module for financial services', targetContactId: 'cont-4', status: 'researching', nextAction: 'Prepare industry case study', createdAt: new Date(Date.now() - 7*86400000).toISOString(), updatedAt: new Date().toISOString() },
]

const MOCK_TASKS = [
  { id: 'task-1', title: 'Follow up with Acme Corp', description: 'Send revised proposal to Sarah Johnson', status: 'pending', priority: 'high', dueDate: new Date(Date.now() + 2*86400000).toISOString(), completedAt: null, companyId: 'comp-1', contactId: 'cont-1', assignedTo: 'demo-user-1', createdBy: 'demo-user-1', createdAt: new Date(Date.now() - 86400000).toISOString(), updatedAt: new Date().toISOString() },
  { id: 'task-2', title: 'Research HealthTech Plus', description: 'Deep dive into their current tech stack', status: 'in-progress', priority: 'medium', dueDate: new Date(Date.now() + 5*86400000).toISOString(), completedAt: null, companyId: 'comp-4', contactId: 'cont-5', assignedTo: 'demo-user-1', createdBy: 'demo-user-1', createdAt: new Date(Date.now() - 3*86400000).toISOString(), updatedAt: new Date().toISOString() },
  { id: 'task-3', title: 'Prepare quarterly report', description: 'Compile sales metrics for Q2 review', status: 'completed', priority: 'low', dueDate: new Date(Date.now() - 86400000).toISOString(), completedAt: new Date(Date.now() - 86400000).toISOString(), companyId: null, contactId: null, assignedTo: 'demo-user-1', createdBy: 'demo-user-1', createdAt: new Date(Date.now() - 7*86400000).toISOString(), updatedAt: new Date(Date.now() - 86400000).toISOString() },
]

const MOCK_DRAFTS = [
  { id: 'draft-1', contactId: 'cont-1', subject: 'Re: Enterprise License Proposal', body: 'Hi Sarah,\n\nThank you for reviewing our proposal...', cta: 'Would you be available for a 30-minute call this Thursday?', serviceAngle: 'AI-Powered Sales Intelligence', matchScore: 94, confidenceScore: 89, status: 'draft', rejectReason: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'draft-2', contactId: 'cont-6', subject: 'Cloud Integration Partnership', body: 'Hi David,\n\nFollowing our great conversation last week...', cta: 'Can we schedule a technical deep-dive for next week?', serviceAngle: 'Cloud CRM Integration', matchScore: 88, confidenceScore: 85, status: 'sent', rejectReason: null, createdAt: new Date(Date.now() - 2*86400000).toISOString(), updatedAt: new Date().toISOString() },
]

const MOCK_CAPS = [
  { id: 'cap-1', title: 'AI Sales Intelligence Overview', docType: 'case-study', description: 'How AI transforms enterprise sales', content: 'Our AI-powered platform enables sales teams...', fileName: 'ai-sales-intel.pdf', createdAt: new Date(Date.now() - 60*86400000).toISOString(), updatedAt: new Date().toISOString() },
  { id: 'cap-2', title: 'Email Deliverability Guide', docType: 'whitepaper', description: 'Achieving 95%+ email deliverability', content: 'Email deliverability requires SPF, DKIM, DMARC...', fileName: 'deliverability-guide.pdf', createdAt: new Date(Date.now() - 30*86400000).toISOString(), updatedAt: new Date().toISOString() },
  { id: 'cap-3', title: 'Enterprise Integration Guide', docType: 'documentation', description: 'Integration with Salesforce, HubSpot', content: 'Our REST API supports all major CRMs...', fileName: 'integration-guide.pdf', createdAt: new Date(Date.now() - 15*86400000).toISOString(), updatedAt: new Date().toISOString() },
]

const MOCK_PROMPTS = [
  { id: 'pt-1', name: 'Cold Outreach - Executive', category: 'outreach', description: 'Personalized cold email for C-suite', systemPrompt: 'You are an expert B2B copywriter.', userPromptTemplate: 'Write a cold email to {{name}}', variables: 'name,title,company,service', isBuiltIn: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'pt-2', name: 'Follow-Up - Post Demo', category: 'follow-up', description: 'Follow-up after a demo', systemPrompt: 'You are a helpful sales assistant.', userPromptTemplate: 'Write a follow-up to {{name}} after demo of {{product}}', variables: 'name,product,points', isBuiltIn: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
]

const MOCK_USER = { id: 'demo-1', name: 'Ravi Shanker', email: 'ravi@deepmindq.com', role: 'admin', image: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }

// ── Where clause matching ──
function matchWhere(item: any, where: any): boolean {
  if (!where) return false
  for (const [key, val] of Object.entries(where)) {
    if (val === null || val === undefined) continue
    if (typeof val === 'object') {
      if ('equals' in val) { if (item[key] !== val.equals) return false }
      else if ('contains' in val) { if (!(item[key] || '').toString().toLowerCase().includes((val.contains as string).toLowerCase())) return false }
      else if ('in' in val) { if (!(val.in as any[]).includes(item[key])) return false }
      else if ('not' in val) {
        if (typeof val.not === 'string' && item[key] === val.not) return false
        if (typeof val.not === 'object' && val.not !== null && 'equals' in val.not && item[key] === val.not.equals) return false
      }
      else if ('startsWith' in val) { if (!(item[key] || '').toString().toLowerCase().startsWith((val.startsWith as string).toLowerCase())) return false }
      else if ('gte' in val) { if (!(item[key] >= val.gte)) return false }
      else if ('lte' in val) { if (!(item[key] <= val.lte)) return false }
      else if ('gt' in val) { if (!(item[key] > val.gt)) return false }
      else if ('lt' in val) { if (!(item[key] < val.lt)) return false }
      else if ('notIn' in val) { if ((val.notIn as any[]).includes(item[key])) return false }
      else if ('AND' in val) { for (const sub of (val.AND as any[])) { if (!matchWhere(item, sub)) return false } }
      else if ('OR' in val) { if (!(val.OR as any[]).some((sub: any) => matchWhere(item, sub))) return false }
    } else {
      if (item[key] !== val) return false
    }
  }
  return true
}

function filterData(data: any[], where: any): any[] {
  if (!where) return data
  if (where.AND) { let r = data; for (const s of where.AND) r = r.filter((d: any) => matchWhere(d, s)); return r }
  if (where.OR) return data.filter((d: any) => (where.OR as any[]).some((s: any) => matchWhere(d, s)))
  return data.filter((d: any) => matchWhere(d, where))
}

function enrichItem(item: any, include: any): any {
  const result = { ...item }
  if (!include) return result
  for (const [key] of Object.entries(include)) {
    if (key === 'contacts') result.contacts = MOCK_CONTACTS.filter(c => c.companyId === item.id)
    else if (key === 'opportunities') result.opportunities = MOCK_OPPORTUNITIES.filter(o => o.companyId === item.id)
    else if (key === 'company') result.company = MOCK_COMPANIES.find(c => c.id === item.companyId) || null
    else if (key === 'targetContact') result.targetContact = MOCK_CONTACTS.find(c => c.id === item.targetContactId) || null
    else if (key === 'notes' || key === 'timeline' || key === 'snippets' || key === 'comments' || key === 'researchCard' || key === 'researchSources' || key === 'steps' || key === 'members' || key === 'accounts' || key === 'sessions' || key === 'auditLogs' || key === 'notifications' || key === 'preferences' || key === 'healthChecks' || key === 'targetedOpportunities' || key === 'customFieldValues' || key === 'tags' || key === 'teams') result[key] = []
    else result[key] = null
  }
  return result
}

function createModelProxy(data: any[]) {
  return new Proxy({} as any, {
    get(_target, prop: string) {
      const methods: Record<string, Function> = {
        findMany: (args?: any) => {
          let result = [...data]
          if (args?.where) result = filterData(result, args.where)
          if (args?.distinct) { const seen = new Set(); result = result.filter((r: any) => { const k = r[args.distinct]; if (seen.has(k)) return false; seen.add(k); return true }) }
          if (args?.orderBy) { const k = Object.keys(args.orderBy)[0]; const d = args.orderBy[k] === 'desc' ? -1 : 1; result.sort((a: any, b: any) => ((a[k] || '') > (b[k] || '') ? d : -d)) }
          if (args?.skip) result = result.slice(args.skip)
          if (args?.take) result = result.slice(0, args.take)
          if (args?.include) result = result.map((item: any) => enrichItem(item, args.include))
          if (args?.select) result = result.map((item: any) => { const p: any = {}; for (const k of Object.keys(args.select)) p[k] = item[k]; return p })
          return Promise.resolve(result)
        },
        findUnique: (args: any) => { const item = data.find((d: any) => matchWhere(d, args?.where)); return Promise.resolve(item ? (args?.include ? enrichItem(item, args.include) : item) : null) },
        findFirst: (args: any) => { let r = [...data]; if (args?.where) r = filterData(r, args.where); if (args?.orderBy) { const k = Object.keys(args.orderBy)[0]; const d = args.orderBy[k] === 'desc' ? -1 : 1; r.sort((a: any, b: any) => ((a[k] || '') > (b[k] || '') ? d : -d)) } const item = r[0] || null; return Promise.resolve(item ? (args?.include ? enrichItem(item, args.include) : item) : null) },
        count: (args?: any) => { let r = [...data]; if (args?.where) r = filterData(r, args.where); return Promise.resolve(r.length) },
        create: (args: any) => { const n = { id: `mock-${Date.now()}-${Math.random().toString(36).slice(2,6)}`, ...args?.data, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }; data.push(n); return Promise.resolve(n) },
        update: (args: any) => { const i = data.findIndex((d: any) => matchWhere(d, args?.where)); if (i >= 0) { data[i] = { ...data[i], ...args?.data, updatedAt: new Date().toISOString() }; return Promise.resolve(args?.include ? enrichItem(data[i], args.include) : data[i]) } return Promise.resolve(null) },
        delete: (args: any) => { const i = data.findIndex((d: any) => matchWhere(d, args?.where)); if (i >= 0) return Promise.resolve(data.splice(i, 1)[0]); return Promise.resolve(null) },
        deleteMany: (args?: any) => { if (args?.where) { const b = data.length; const f = data.filter((d: any) => !matchWhere(d, args.where)); data.length = 0; data.push(...f); return Promise.resolve({ count: b - data.length }) } const c = data.length; data.length = 0; return Promise.resolve({ count: c }) },
        upsert: (args: any) => { let i = data.findIndex((d: any) => matchWhere(d, args?.where)); if (i >= 0) { data[i] = { ...data[i], ...args?.update, updatedAt: new Date().toISOString() }; return Promise.resolve(data[i]) } const n = { id: `mock-${Date.now()}`, ...args?.create, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }; data.push(n); return Promise.resolve(n) },
        aggregate: (args?: any) => { let r = [...data]; if (args?.where) r = filterData(r, args.where); const a: any = { _count: r.length, _sum: {}, _avg: {}, _min: {}, _max: {} }; return Promise.resolve(a) },
        groupBy: (args: any) => { let r = [...data]; if (args?.where) r = filterData(r, args.where); const g: Record<string, any> = {}; for (const item of r) { const k = String(item[args.by[0]] || 'unknown'); if (!g[k]) g[k] = {}; g[k][args.by[0]] = k; g[k]._count = (g[k]._count || 0) + 1; if (args._count) { for (const ck of Object.keys(args._count)) { if (item[ck] != null) g[k][ck] = (g[k][ck] || 0) + 1 } } } return Promise.resolve(Object.values(g)) },
      }
      return methods[prop] || (() => Promise.resolve(null))
    }
  })
}

const models: Record<string, any> = {
  company: createModelProxy(MOCK_COMPANIES),
  contact: createModelProxy(MOCK_CONTACTS),
  opportunity: createModelProxy(MOCK_OPPORTUNITIES),
  task: createModelProxy(MOCK_TASKS),
  draft: createModelProxy(MOCK_DRAFTS),
  capabilityDocument: createModelProxy(MOCK_CAPS),
  promptTemplate: createModelProxy(MOCK_PROMPTS),
  user: createModelProxy([MOCK_USER]),
  account: createModelProxy([]),
  session: createModelProxy([]),
  verificationToken: createModelProxy([]),
  auditLog: createModelProxy([]),
  notification: createModelProxy([]),
  userPreferences: createModelProxy([]),
  customFieldDefinition: createModelProxy([]),
  customFieldValue: createModelProxy([]),
  tag: createModelProxy([]),
  tagAssignment: createModelProxy([]),
  emailSequence: createModelProxy([]),
  emailSequenceStep: createModelProxy([]),
  comment: createModelProxy([]),
  team: createModelProxy([]),
  teamMember: createModelProxy([]),
  companyNote: createModelProxy([]),
  contactNote: createModelProxy([]),
  companyResearchCard: createModelProxy([]),
  companyResearchSource: createModelProxy([]),
  timelineEntry: createModelProxy([]),
  capabilitySnippet: createModelProxy([]),
  emailHealthCheck: createModelProxy([]),
  importBatch: createModelProxy([]),
}

export const db = new Proxy(models, {
  get(target, prop) {
    if (prop in target) return target[prop as string]
    return createModelProxy([])
  }
})

export function isDbAvailable() { return false }