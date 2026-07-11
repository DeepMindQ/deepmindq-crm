/**
 * DeepMindQ Demo Seed Script
 * Creates a default admin user + rich demo data for all entities
 * Run: bun run scripts/seed-demo.ts
 */
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const db = new PrismaClient()

const NOW = new Date()
const DAYS_AGO = (n: number) => { const d = new Date(NOW); d.setDate(d.getDate() - n); return d }
const HOURS_AGO = (n: number) => { const d = new Date(NOW); d.setHours(d.getHours() - n); return d }

const COMPANIES = [
  { name: 'Stripe', domain: 'stripe.com', industry: 'FinTech', employeeSize: '5001+', country: 'USA', location: 'San Francisco, CA', website: 'https://stripe.com', status: 'active', intelligenceScore: 92 },
  { name: 'Notion', domain: 'notion.so', industry: 'SaaS', employeeSize: '501-1000', country: 'USA', location: 'San Francisco, CA', website: 'https://notion.so', status: 'active', intelligenceScore: 87 },
  { name: 'Vercel', domain: 'vercel.com', industry: 'Technology', employeeSize: '201-500', country: 'USA', location: 'San Francisco, CA', website: 'https://vercel.com', status: 'active', intelligenceScore: 89 },
  { name: 'Linear', domain: 'linear.app', industry: 'SaaS', employeeSize: '51-200', country: 'USA', location: 'San Francisco, CA', website: 'https://linear.app', status: 'qualified', intelligenceScore: 78 },
  { name: 'Figma', domain: 'figma.com', industry: 'Technology', employeeSize: '1001-5000', country: 'USA', location: 'San Francisco, CA', website: 'https://figma.com', status: 'active', intelligenceScore: 94 },
  { name: 'Datadog', domain: 'datadoghq.com', industry: 'Technology', employeeSize: '5001+', country: 'USA', location: 'New York, NY', website: 'https://datadoghq.com', status: 'researching', intelligenceScore: 71 },
  { name: 'Shopify', domain: 'shopify.com', industry: 'E-commerce', employeeSize: '5001+', country: 'Canada', location: 'Ottawa, ON', website: 'https://shopify.com', status: 'active', intelligenceScore: 90 },
  { name: 'Twilio', domain: 'twilio.com', industry: 'Technology', employeeSize: '5001+', country: 'USA', location: 'San Francisco, CA', website: 'https://twilio.com', status: 'researching', intelligenceScore: 68 },
  { name: 'HubSpot', domain: 'hubspot.com', industry: 'SaaS', employeeSize: '5001+', country: 'USA', location: 'Cambridge, MA', website: 'https://hubspot.com', status: 'new', intelligenceScore: 55 },
  { name: 'Canva', domain: 'canva.com', industry: 'Technology', employeeSize: '5001+', country: 'Australia', location: 'Sydney, NSW', website: 'https://canva.com', status: 'active', intelligenceScore: 83 },
  { name: 'Wiz', domain: 'wiz.io', industry: 'Cybersecurity', employeeSize: '501-1000', country: 'USA', location: 'New York, NY', website: 'https://wiz.io', status: 'qualified', intelligenceScore: 76 },
  { name: 'Databricks', domain: 'databricks.com', industry: 'Technology', employeeSize: '5001+', country: 'USA', location: 'San Francisco, CA', website: 'https://databricks.com', status: 'active', intelligenceScore: 85 },
  { name: 'Plaid', domain: 'plaid.com', industry: 'FinTech', employeeSize: '501-1000', country: 'USA', location: 'San Francisco, CA', website: 'https://plaid.com', status: 'new', intelligenceScore: 62 },
  { name: 'Ramp', domain: 'ramp.com', industry: 'FinTech', employeeSize: '501-1000', country: 'USA', location: 'New York, NY', website: 'https://ramp.com', status: 'researching', intelligenceScore: 73 },
  { name: 'Loom', domain: 'loom.com', industry: 'SaaS', employeeSize: '201-500', country: 'USA', location: 'San Francisco, CA', website: 'https://loom.com', status: 'new', intelligenceScore: 48 },
  { name: 'Merge', domain: 'merge.dev', industry: 'Technology', employeeSize: '51-200', country: 'USA', location: 'San Francisco, CA', website: 'https://merge.dev', status: 'inactive', intelligenceScore: 42 },
  { name: 'Deel', domain: 'deel.com', industry: 'SaaS', employeeSize: '1001-5000', country: 'USA', location: 'San Francisco, CA', website: 'https://deel.com', status: 'active', intelligenceScore: 81 },
  { name: 'Airtable', domain: 'airtable.com', industry: 'SaaS', employeeSize: '501-1000', country: 'USA', location: 'San Francisco, CA', website: 'https://airtable.com', status: 'qualified', intelligenceScore: 77 },
  { name: 'Zapier', domain: 'zapier.com', industry: 'Technology', employeeSize: '501-1000', country: 'USA', location: 'San Francisco, CA', website: 'https://zapier.com', status: 'active', intelligenceScore: 86 },
  { name: 'Webflow', domain: 'webflow.com', industry: 'Technology', employeeSize: '201-500', country: 'USA', location: 'San Francisco, CA', website: 'https://webflow.com', status: 'new', intelligenceScore: 58 },
]

const CONTACTS: Array<{ name: string; email: string; jobTitle: string; roleBucket: string; phone?: string; companyId: number }> = [
  // Stripe
  { name: 'Patrick Collison', email: 'patrick@stripe.com', jobTitle: 'Co-Founder & CEO', roleBucket: 'Executive', companyId: 0, phone: '+1-415-555-0101' },
  { name: 'John Collison', email: 'john@stripe.com', jobTitle: 'Co-Founder & President', roleBucket: 'Executive', companyId: 0 },
  { name: 'Emily Chen', email: 'emily.chen@stripe.com', jobTitle: 'VP of Engineering', roleBucket: 'Manager', companyId: 0 },
  // Notion
  { name: 'Ivan Zhao', email: 'ivan@notion.so', jobTitle: 'Co-Founder & CEO', roleBucket: 'Executive', companyId: 1 },
  { name: 'Sarah Kim', email: 'sarah.kim@notion.so', jobTitle: 'Head of Partnerships', roleBucket: 'Manager', companyId: 1 },
  { name: 'Michael Park', email: 'michael.park@notion.so', jobTitle: 'Senior Engineer', roleBucket: 'Technical', companyId: 1 },
  // Vercel
  { name: 'Guillermo Rauch', email: 'guillermo@vercel.com', jobTitle: 'Founder & CEO', roleBucket: 'Executive', companyId: 2 },
  { name: 'Lee Robinson', email: 'lee@vercel.com', jobTitle: 'VP of Developer Experience', roleBucket: 'Manager', companyId: 2 },
  // Linear
  { name: 'Karri Saarinen', email: 'karri@linear.app', jobTitle: 'Co-Founder & CEO', roleBucket: 'Executive', companyId: 3 },
  { name: 'Jori Lallo', email: 'jori@linear.app', jobTitle: 'Co-Founder & CTO', roleBucket: 'Executive', companyId: 3 },
  // Figma
  { name: 'Dylan Field', email: 'dylan@figma.com', jobTitle: 'Co-Founder & CEO', roleBucket: 'Executive', companyId: 4 },
  { name: 'Evan Wallace', email: 'evan@figma.com', jobTitle: 'Co-Founder & CTO', roleBucket: 'Executive', companyId: 4 },
  { name: 'Amanda Liu', email: 'amanda.liu@figma.com', jobTitle: 'Director of Product', roleBucket: 'Manager', companyId: 4 },
  // Datadog
  { name: 'Olivier Pomel', email: 'olivier@datadoghq.com', jobTitle: 'Co-Founder & CEO', roleBucket: 'Executive', companyId: 5 },
  // Shopify
  { name: 'Tobi Lütke', email: 'tobi@shopify.com', jobTitle: 'Founder & CEO', roleBucket: 'Executive', companyId: 6 },
  { name: 'Amy Shapero', email: 'amy@shopify.com', jobTitle: 'CFO', roleBucket: 'Executive', companyId: 6 },
  { name: 'David Singh', email: 'david.singh@shopify.com', jobTitle: 'VP of Engineering', roleBucket: 'Manager', companyId: 6 },
  // Twilio
  { name: 'Jeff Lawson', email: 'jeff@twilio.com', jobTitle: 'Co-Founder & CEO', roleBucket: 'Executive', companyId: 7 },
  { name: 'Kathy Baxter', email: 'kathy.baxter@twilio.com', jobTitle: 'Principal Architect', roleBucket: 'Technical', companyId: 7 },
  // HubSpot
  { name: 'Yamini Rangan', email: 'yamini@hubspot.com', jobTitle: 'CEO', roleBucket: 'Executive', companyId: 8 },
  { name: 'Ryan Bonnici', email: 'ryan.b@hubspot.com', jobTitle: 'CMO', roleBucket: 'Manager', companyId: 8 },
  // Canva
  { name: 'Melanie Perkins', email: 'melanie@canva.com', jobTitle: 'Co-Founder & CEO', roleBucket: 'Executive', companyId: 9 },
  { name: 'Cliff Obrecht', email: 'cliff@canva.com', jobTitle: 'Co-Founder & COO', roleBucket: 'Executive', companyId: 9 },
  // Wiz
  { name: 'Ami Luttwak', email: 'ami@wiz.io', jobTitle: 'Co-Founder & CTO', roleBucket: 'Executive', companyId: 10 },
  { name: 'Assaf Rappaport', email: 'assaf@wiz.io', jobTitle: 'Co-Founder & CEO', roleBucket: 'Executive', companyId: 10 },
  // Databricks
  { name: 'Ali Ghodsi', email: 'ali@databricks.com', jobTitle: 'Co-Founder & CEO', roleBucket: 'Executive', companyId: 11 },
  // Plaid
  { name: 'Zach Perret', email: 'zach@plaid.com', jobTitle: 'Co-Founder & CEO', roleBucket: 'Executive', companyId: 12 },
  // Ramp
  { name: 'Eric Glyman', email: 'eric@ramp.com', jobTitle: 'Co-Founder & CEO', roleBucket: 'Executive', companyId: 13 },
  // Loom
  { name: 'Joe Thomas', email: 'joe@loom.com', jobTitle: 'Co-Founder & CEO', roleBucket: 'Executive', companyId: 14 },
  // Deel
  { name: 'Alex Bouaziz', email: 'alex@deel.com', jobTitle: 'Co-Founder & CEO', roleBucket: 'Executive', companyId: 16 },
  // Airtable
  { name: 'Howie Liu', email: 'howie@airtable.com', jobTitle: 'Co-Founder & CEO', roleBucket: 'Executive', companyId: 17 },
  // Zapier
  { name: 'Wade Foster', email: 'wade@zapier.com', jobTitle: 'Co-Founder & CEO', roleBucket: 'Executive', companyId: 18 },
  // Webflow
  { name: 'Vlad Magdalin', email: 'vlad@webflow.com', jobTitle: 'Co-Founder & CEO', roleBucket: 'Executive', companyId: 19 },
]

const OPPORTUNITIES = [
  { companyId: 0, title: 'Enterprise Payment Integration', value: 85000, status: 'proposal', contactIdx: 0 },
  { companyId: 1, title: 'Team Collaboration Suite', value: 45000, status: 'qualified', contactIdx: 3 },
  { companyId: 2, title: 'Frontend Platform Migration', value: 120000, status: 'negotiation', contactIdx: 6 },
  { companyId: 4, title: 'Design System Consulting', value: 60000, status: 'researching', contactIdx: 10 },
  { companyId: 6, title: 'E-commerce Analytics Dashboard', value: 95000, status: 'qualified', contactIdx: 14 },
  { companyId: 9, title: 'Visual Content Platform', value: 75000, status: 'proposal', contactIdx: 20 },
  { companyId: 10, title: 'Cloud Security Assessment', value: 150000, status: 'researching', contactIdx: 22 },
  { companyId: 11, title: 'Data Lake Modernization', value: 200000, status: 'negotiation', contactIdx: 24 },
  { companyId: 17, title: 'Workflow Automation', value: 55000, status: 'qualified', contactIdx: 28 },
  { companyId: 18, title: 'API Integration Platform', value: 40000, status: 'won', contactIdx: 30 },
  { companyId: 3, title: 'Project Management Tooling', value: 35000, status: 'proposal', contactIdx: 9 },
  { companyId: 13, title: 'Spend Management Platform', value: 70000, status: 'researching', contactIdx: 25 },
]

const TASKS = [
  { title: 'Follow up with Stripe on payment integration proposal', priority: 'high', status: 'in_progress', companyId: 0, dueDate: DAYS_AGO(2) },
  { title: 'Prepare demo for Vercel platform migration', priority: 'urgent', status: 'pending', companyId: 2, dueDate: DAYS_AGO(1) },
  { title: 'Send research card to Databricks team', priority: 'medium', status: 'pending', companyId: 11, dueDate: DAYS_AGO(5) },
  { title: 'Review Figma design system requirements', priority: 'medium', status: 'completed', companyId: 4, dueDate: DAYS_AGO(3) },
  { title: 'Schedule call with Wiz security team', priority: 'high', status: 'pending', companyId: 10, dueDate: DAYS_AGO(4) },
  { title: 'Update Canva opportunity notes', priority: 'low', status: 'completed', companyId: 9, dueDate: DAYS_AGO(7) },
  { title: 'Validate email addresses for Shopify contacts', priority: 'medium', status: 'in_progress', companyId: 6, dueDate: DAYS_AGO(1) },
  { title: 'Draft partnership proposal for Notion', priority: 'high', status: 'pending', companyId: 1, dueDate: DAYS_AGO(3) },
  { title: 'Complete HubSpot company research', priority: 'low', status: 'pending', companyId: 8, dueDate: DAYS_AGO(10) },
  { title: 'Send follow-up email to Linear CTO', priority: 'medium', status: 'overdue', companyId: 3, dueDate: DAYS_AGO(-2) },
  { title: 'Prepare quarterly pipeline review', priority: 'high', status: 'pending', companyId: 0, dueDate: DAYS_AGO(6) },
  { title: 'Generate AI email drafts for Plaid', priority: 'medium', status: 'pending', companyId: 12, dueDate: DAYS_AGO(4) },
]

const TIMELINE_ACTIONS = [
  { action: 'company_created', companyId: 0, details: 'Added Stripe to pipeline', hoursAgo: 120 },
  { action: 'company_created', companyId: 1, details: 'Added Notion to pipeline', hoursAgo: 115 },
  { action: 'company_created', companyId: 2, details: 'Added Vercel to pipeline', hoursAgo: 110 },
  { action: 'contact_added', companyId: 0, contactId: 0, details: 'Added Patrick Collison as contact', hoursAgo: 119 },
  { action: 'contact_added', companyId: 0, contactId: 1, details: 'Added John Collison as contact', hoursAgo: 118 },
  { action: 'contact_added', companyId: 1, contactId: 3, details: 'Added Ivan Zhao as contact', hoursAgo: 114 },
  { action: 'email_validated', companyId: 0, contactId: 0, details: 'patrick@stripe.com validated — valid', hoursAgo: 100 },
  { action: 'email_validated', companyId: 1, contactId: 3, details: 'ivan@notion.so validated — valid', hoursAgo: 99 },
  { action: 'research_generated', companyId: 2, details: 'AI research card generated for Vercel', hoursAgo: 90 },
  { action: 'email_generated', companyId: 0, contactId: 0, details: 'AI email draft generated for Patrick Collison', hoursAgo: 80 },
  { action: 'opportunity_created', companyId: 2, details: 'Created "Frontend Platform Migration" opportunity ($120K)', hoursAgo: 72 },
  { action: 'company_created', companyId: 4, details: 'Added Figma to pipeline', hoursAgo: 95 },
  { action: 'company_created', companyId: 6, details: 'Added Shopify to pipeline', hoursAgo: 88 },
  { action: 'contact_added', companyId: 4, contactId: 10, details: 'Added Dylan Field as contact', hoursAgo: 94 },
  { action: 'email_generated', companyId: 4, contactId: 10, details: 'AI email draft generated for Dylan Field', hoursAgo: 70 },
  { action: 'research_generated', companyId: 11, details: 'AI research card generated for Databricks', hoursAgo: 60 },
  { action: 'company_created', companyId: 10, details: 'Added Wiz to pipeline', hoursAgo: 55 },
  { action: 'opportunity_created', companyId: 11, details: 'Created "Data Lake Modernization" opportunity ($200K)', hoursAgo: 48 },
  { action: 'note_added', companyId: 0, details: 'Had initial discovery call — strong interest in payment integration', hoursAgo: 45 },
  { action: 'status_changed', companyId: 2, details: 'Pipeline status changed to "negotiation"', hoursAgo: 36 },
  { action: 'company_created', companyId: 18, details: 'Added Zapier to pipeline', hoursAgo: 30 },
  { action: 'opportunity_created', companyId: 18, details: 'Created "API Integration Platform" opportunity ($40K)', hoursAgo: 24 },
  { action: 'email_validated', companyId: 6, contactId: 14, details: 'tobi@shopify.com validated — valid', hoursAgo: 20 },
  { action: 'email_generated', companyId: 1, contactId: 4, details: 'AI email draft generated for Sarah Kim', hoursAgo: 18 },
  { action: 'company_created', companyId: 19, details: 'Added Webflow to pipeline', hoursAgo: 15 },
  { action: 'import_completed', details: 'Imported 20 companies from CSV', hoursAgo: 12 },
  { action: 'note_added', companyId: 11, details: 'Technical deep-dive completed with Databricks engineering', hoursAgo: 8 },
  { action: 'opportunity_created', companyId: 9, details: 'Created "Visual Content Platform" opportunity ($75K)', hoursAgo: 6 },
  { action: 'email_generated', companyId: 10, contactId: 22, details: 'AI email draft generated for Assaf Rappaport', hoursAgo: 4 },
  { action: 'contact_added', companyId: 3, contactId: 9, details: 'Added Karri Saarinen as contact', hoursAgo: 3 },
  { action: 'research_generated', companyId: 6, details: 'AI research card generated for Shopify', hoursAgo: 2 },
]

const EMAIL_HEALTH_MAP: Record<number, { health: string; score: number }> = {
  0: { health: 'valid', score: 95 }, 1: { health: 'valid', score: 92 }, 2: { health: 'valid', score: 88 },
  3: { health: 'valid', score: 97 }, 4: { health: 'valid', score: 91 }, 5: { health: 'risky', score: 55 },
  6: { health: 'valid', score: 94 }, 7: { health: 'valid', score: 89 }, 8: { health: 'invalid', score: 12 },
  9: { health: 'valid', score: 96 }, 10: { health: 'valid', score: 93 }, 11: { health: 'valid', score: 87 },
  12: { health: 'risky', score: 48 }, 13: { health: 'valid', score: 90 }, 14: { health: 'valid', score: 98 },
  15: { health: 'valid', score: 91 }, 16: { health: 'unknown', score: 0 }, 17: { health: 'valid', score: 85 },
  18: { health: 'valid', score: 94 }, 19: { health: 'risky', score: 52 }, 20: { health: 'valid', score: 96 },
  21: { health: 'valid', score: 93 }, 22: { health: 'valid', score: 90 }, 23: { health: 'valid', score: 88 },
  24: { health: 'valid', score: 95 }, 25: { health: 'risky', score: 45 }, 26: { health: 'valid', score: 91 },
  27: { health: 'invalid', score: 8 }, 28: { health: 'valid', score: 93 }, 29: { health: 'valid', score: 97 },
  30: { health: 'valid', score: 94 }, 31: { health: 'valid', score: 89 },
}

async function seed() {
  console.log('🌱 Seeding DeepMindQ demo data...')

  // ── 1. Create default admin user ──
  const existingAdmin = await db.user.findUnique({ where: { email: 'admin@deepmindq.com' } })
  let adminId: string
  if (existingAdmin) {
    adminId = existingAdmin.id
    console.log('  ✓ Admin user already exists')
  } else {
    const passwordHash = await bcrypt.hash('Admin1234', 10)
    const admin = await db.user.create({
      data: {
        name: 'Ravi Kumar',
        email: 'admin@deepmindq.com',
        passwordHash,
        role: 'admin',
        lastLoginAt: HOURS_AGO(1),
      },
    })
    adminId = admin.id
    console.log('  ✓ Created admin user (admin@deepmindq.com / Admin1234)')
  }

  // ── 2. Create default preferences ──
  const existingPrefs = await db.userPreferences.findFirst({ where: { userId: adminId } })
  if (!existingPrefs) {
    await db.userPreferences.create({
      data: {
        userId: adminId,
        tone: 'professional-casual',
        emailLength: 'medium',
        openerStyle: 'Hi [First Name]',
        signOff: 'Best regards, Ravi',
        avoidPhrases: '',
        ctaStyle: 'soft',
        aiProvider: 'openai',
        aiModel: 'gpt-4o-mini',
        scoringWeights: '{}',
      },
    })
    console.log('  ✓ Created default preferences')
  }

  // ── 3. Check if companies already exist ──
  const companyCount = await db.company.count()
  if (companyCount > 0) {
    console.log(`  ℹ ${companyCount} companies already exist — skipping seed`)
    console.log('  Run DELETE /api/reset with { "confirm": true } first, then re-seed')
    return
  }

  // ── 4. Create companies ──
  console.log(`  → Creating ${COMPANIES.length} companies...`)
  const createdCompanies: any[] = []
  for (const c of COMPANIES) {
    const fresh = Math.random() > 0.5 ? 'fresh' : Math.random() > 0.3 ? 'stale' : 'old'
    const company = await db.company.create({
      data: {
        ...c,
        dataFreshness: fresh,
        createdAt: DAYS_AGO(Math.floor(Math.random() * 30) + 5),
      },
    })
    createdCompanies.push(company)
  }
  console.log('  ✓ Companies created')

  // ── 5. Create contacts ──
  console.log(`  → Creating ${CONTACTS.length} contacts...`)
  const createdContacts: any[] = []
  for (let i = 0; i < CONTACTS.length; i++) {
    const c = CONTACTS[i]
    const eh = EMAIL_HEALTH_MAP[i] || { health: 'unknown', score: 0 }
    const contact = await db.contact.create({
      data: {
        name: c.name,
        email: c.email,
        jobTitle: c.jobTitle,
        roleBucket: c.roleBucket,
        phone: c.phone || null,
        companyId: createdCompanies[c.companyId].id,
        status: Math.random() > 0.3 ? 'active' : 'new',
        emailHealth: eh.health,
        emailHealthScore: eh.score,
        lastValidatedAt: eh.health !== 'unknown' ? HOURS_AGO(Math.floor(Math.random() * 72)) : null,
        createdAt: DAYS_AGO(Math.floor(Math.random() * 25) + 3),
      },
    })
    createdContacts.push(contact)
  }
  console.log('  ✓ Contacts created')

  // ── 6. Create opportunities ──
  console.log(`  → Creating ${OPPORTUNITIES.length} opportunities...`)
  for (const opp of OPPORTUNITIES) {
    const company = createdCompanies[opp.companyId]
    const contact = createdContacts[opp.contactIdx]
    const statuses = ['researching', 'qualified', 'proposal', 'negotiation', 'won', 'lost']
    const nextActions = [
      'Schedule discovery call',
      'Send proposal',
      'Follow up on technical requirements',
      'Prepare pricing sheet',
      'Schedule demo',
      'Send case study',
      'Review contract terms',
    ]
    await db.opportunity.create({
      data: {
        companyId: company.id,
        targetContactId: contact?.id || null,
        title: opp.title,
        description: `Pursuing ${opp.title} with ${company.name}. Estimated value: $${(opp.value / 1000).toFixed(0)}K.`,
        status: opp.status,
        nextAction: opp.status === 'won' || opp.status === 'lost' ? null : nextActions[Math.floor(Math.random() * nextActions.length)],
        createdAt: DAYS_AGO(Math.floor(Math.random() * 20) + 2),
      },
    })
  }
  console.log('  ✓ Opportunities created')

  // ── 7. Create tasks ──
  console.log(`  → Creating ${TASKS.length} tasks...`)
  for (const task of TASKS) {
    const company = createdCompanies[task.companyId]
    await db.task.create({
      data: {
        title: task.title,
        description: `Task related to ${company.name}`,
        status: task.status,
        priority: task.priority,
        dueDate: task.dueDate,
        completedAt: task.status === 'completed' ? HOURS_AGO(Math.floor(Math.random() * 48)) : null,
        companyId: company.id,
        createdBy: adminId,
        assignedTo: adminId,
        createdAt: DAYS_AGO(Math.floor(Math.random() * 10) + 1),
      },
    })
  }
  console.log('  ✓ Tasks created')

  // ── 8. Create research cards for top companies ──
  console.log('  → Creating research cards...')
  const researchCompanies = [0, 1, 2, 4, 6, 11]
  for (const idx of researchCompanies) {
    const company = createdCompanies[idx]
    await db.companyResearchCard.create({
      data: {
        companyId: company.id,
        businessOverview: `${company.name} is a leading ${company.industry} company${company.location ? ` based in ${company.location}` : ''}. They have established themselves as a key player in their market segment with ${company.employeeSize} employees.`,
        currentTechLandscape: `${company.name} leverages modern cloud infrastructure, microservices architecture, and data-driven decision making. Their tech stack includes React/Next.js for frontend, various backend services, and extensive API integrations.`,
        potentialChallenges: `Key challenges include scaling their engineering team, maintaining product quality during rapid growth, and staying competitive in the ${company.industry} market.`,
        possibleOpportunities: `Potential areas for collaboration include enterprise consulting, custom integrations, data analytics partnerships, and co-development of industry-specific solutions.`,
        relevantServices: 'Enterprise consulting, custom development, API integration, data analytics, cloud architecture review, team augmentation.',
        keyDecisionMakers: createdContacts.filter(c => c.companyId === company.id).map(c => c.name).join(', '),
        confidenceScore: company.intelligenceScore,
        lastResearchedAt: HOURS_AGO(Math.floor(Math.random() * 48) + 6),
      },
    })
  }
  console.log('  ✓ Research cards created')

  // ── 9. Create timeline entries ──
  console.log(`  → Creating ${TIMELINE_ACTIONS.length} timeline entries...`)
  for (const entry of TIMELINE_ACTIONS) {
    const companyId = entry.companyId !== undefined ? createdCompanies[entry.companyId]?.id : null
    const contactId = entry.contactId !== undefined ? createdContacts[entry.contactId]?.id : null
    await db.timelineEntry.create({
      data: {
        companyId,
        contactId,
        action: entry.action,
        details: entry.details,
        createdAt: HOURS_AGO(entry.hoursAgo),
      },
    })
  }
  console.log('  ✓ Timeline entries created')

  // ── 10. Create some drafts ──
  console.log('  → Creating email drafts...')
  const draftContacts = [0, 3, 6, 10, 14, 22]
  for (const idx of draftContacts) {
    const contact = createdContacts[idx]
    const company = createdCompanies.find(c => c.id === contact.companyId)
    await db.draft.create({
      data: {
        contactId: contact.id,
        subject: `Exploring partnership opportunities with ${company?.name || 'your company'}`,
        body: `Hi ${contact.name.split(' ')[0]},\n\nI came across ${company?.name}'s impressive work in the ${company?.industry || 'tech'} space and believe there could be strong synergies between our teams.\n\nI'd love to schedule a brief call to explore how we might collaborate on initiatives that align with your strategic goals.\n\nWould you have 15 minutes this week or next to connect?\n\nBest regards,\nRavi`,
        cta: 'Schedule a brief call to discuss partnership',
        serviceAngle: 'Strategic partnership and enterprise consulting',
        matchScore: Math.floor(Math.random() * 20) + 75,
        confidenceScore: Math.floor(Math.random() * 15) + 80,
        status: Math.random() > 0.5 ? 'draft' : 'sent',
        createdAt: HOURS_AGO(Math.floor(Math.random() * 48) + 4),
      },
    })
  }
  console.log('  ✓ Email drafts created')

  // ── 11. Create email health checks ──
  console.log('  → Creating email health checks...')
  for (let i = 0; i < createdContacts.length; i++) {
    const contact = createdContacts[i]
    const eh = EMAIL_HEALTH_MAP[i] || { health: 'unknown', score: 0 }
    if (eh.health !== 'unknown') {
      await db.emailHealthCheck.create({
        data: {
          contactId: contact.id,
          status: eh.health,
          score: eh.score,
          actionRecommendation: eh.health === 'valid' ? 'Email is safe to send' : eh.health === 'risky' ? 'Verify with alternative method' : 'Do not send — invalid email',
          syntaxOk: eh.score > 30,
          domainOk: eh.score > 20,
          mxOk: eh.score > 40,
          disposableOk: eh.score > 50,
          checkedAt: HOURS_AGO(Math.floor(Math.random() * 72) + 2),
        },
      })
    }
  }
  console.log('  ✓ Email health checks created')

  // ── 12. Create company notes ──
  console.log('  → Creating notes...')
  const notes = [
    { companyId: 0, body: 'Had an excellent discovery call with Patrick. They are actively looking for payment integration solutions for their enterprise clients. Budget approved for Q3.', noteType: 'call', hoursAgo: 45 },
    { companyId: 2, body: 'Technical deep-dive with Lee Robinson. Their frontend infrastructure is solid but they need help with migration strategy to their new architecture.', noteType: 'meeting', hoursAgo: 50 },
    { companyId: 11, body: 'Databricks engineering team completed a technical review. They are interested in our data lake modernization approach. Next step: present to their VP of Engineering.', noteType: 'research', hoursAgo: 8 },
    { companyId: 6, body: 'Tobi expressed strong interest in analytics capabilities. Their current dashboard needs a complete overhaul. This could be a $95K+ engagement.', noteType: 'note', hoursAgo: 30 },
    { companyId: 4, body: 'Design system audit completed for Figma. Identified 3 key areas for improvement: component library, design tokens, and accessibility compliance.', noteType: 'research', hoursAgo: 20 },
    { companyId: 18, body: 'Zapier deal closed! API integration platform project approved. Kick-off meeting scheduled for next Monday.', noteType: 'email', hoursAgo: 10 },
  ]
  for (const n of notes) {
    await db.companyNote.create({
      data: {
        companyId: createdCompanies[n.companyId].id,
        body: n.body,
        noteType: n.noteType,
        createdAt: HOURS_AGO(n.hoursAgo),
      },
    })
  }
  console.log('  ✓ Notes created')

  // ── 13. Create a sequence ──
  console.log('  → Creating email sequences...')
  const seq = await db.emailSequence.create({
    data: {
      name: 'Enterprise Outreach — 3-Step',
      description: 'Three-step cold outreach sequence for enterprise prospects',
      status: 'active',
      createdAt: DAYS_AGO(10),
    },
  })
  const steps = [
    { stepNumber: 1, subject: 'Quick question about {{company}}', body: 'Hi {{firstName}},\n\nI noticed {{company}} has been growing rapidly in the {{industry}} space. I have a few ideas that might help accelerate your next phase of growth.\n\nWould you be open to a brief conversation?\n\nBest,\nRavi', delayMinutes: 0, cta: 'Schedule a call' },
    { stepNumber: 2, subject: 'Following up — {{company}} + {{industry}}', body: 'Hi {{firstName}},\n\nI wanted to follow up on my previous message. I have a specific case study from a similar {{industry}} company that I think would resonate with your team.\n\nWorth a 10-minute share?\n\nBest,\nRavi', delayMinutes: 1440, cta: 'Review case study' },
    { stepNumber: 3, subject: 'Last try — value for {{company}}', body: 'Hi {{firstName}},\n\nI know you are busy, so this is my last message. If the timing is not right, I completely understand.\n\nBut if you are ever looking to explore new approaches for {{company}}, I would be happy to help.\n\nBest,\nRavi', delayMinutes: 4320, cta: 'Connect when ready' },
  ]
  for (const step of steps) {
    await db.emailSequenceStep.create({
      data: {
        sequenceId: seq.id,
        ...step,
      },
    })
  }
  console.log('  ✓ Sequences created')

  // ── Summary ──
  const finalCounts = await Promise.all([
    db.company.count(),
    db.contact.count(),
    db.opportunity.count(),
    db.task.count(),
    db.draft.count(),
    db.timelineEntry.count(),
    db.companyResearchCard.count(),
    db.companyNote.count(),
    db.emailHealthCheck.count(),
    db.emailSequence.count(),
  ])
  console.log('\n✅ Seeding complete!')
  console.log(`  Companies: ${finalCounts[0]}`)
  console.log(`  Contacts:  ${finalCounts[1]}`)
  console.log(`  Opportunities: ${finalCounts[2]}`)
  console.log(`  Tasks: ${finalCounts[3]}`)
  console.log(`  Drafts: ${finalCounts[4]}`)
  console.log(`  Timeline: ${finalCounts[5]}`)
  console.log(`  Research Cards: ${finalCounts[6]}`)
  console.log(`  Notes: ${finalCounts[7]}`)
  console.log(`  Health Checks: ${finalCounts[8]}`)
  console.log(`  Sequences: ${finalCounts[9]}`)
}

seed()
  .catch(console.error)
  .finally(() => db.$disconnect())