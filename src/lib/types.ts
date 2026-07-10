// ── Status union types ──────────────────────────────────────────────
export type CompanyStatus = 'new' | 'active' | 'inactive' | 'archived'
export type ContactStatus = 'new' | 'active' | 'inactive' | 'archived'
export type OpportunityStatus = 'researching' | 'qualified' | 'proposal' | 'negotiation' | 'won' | 'lost' | 'archived'
export type DraftStatus = 'draft' | 'approved' | 'sent' | 'rejected' | 'archived'
export type EmailHealthStatus = 'valid' | 'risky' | 'invalid' | 'unknown'
export type DataFreshness = 'fresh' | 'stale' | 'old' | 'unknown'
export type NoteType = 'call' | 'meeting' | 'email' | 'note' | 'research' | null
export type ImportStatus = 'staged' | 'processing' | 'completed' | 'failed'
export type TimelineAction =
  | 'company_created'
  | 'contact_added'
  | 'email_generated'
  | 'research_generated'
  | 'note_added'
  | 'email_validated'
  | 'import_completed'
  | 'deleted'
  | 'status_changed'
  | 'opportunity_created'
  | 'opportunity_updated'
  | 'draft_created'
  | 'draft_updated'
export type EmployeeSize = '1-10' | '11-50' | '51-200' | '201-500' | '501-1000' | '1001-5000' | '5001+'
export type RoleBucket = 'Executive' | 'Manager' | 'Technical' | 'Operations' | 'Sales' | 'Other'
export type AiProvider = 'openai' | 'gemini' | 'groq'
export type CtaStyle = 'soft' | 'direct' | 'consultative' | 'urgent'
export type EmailLength = 'short' | 'medium' | 'long'
export type Tone = 'professional-casual' | 'formal' | 'friendly' | 'concise'
export type OpenerStyle = string
export type DocType = 'case-study' | 'whitepaper' | 'blog' | 'presentation' | 'documentation' | 'other'
export type SnippetType = 'capability' | 'outcome' | 'process' | 'testimonial' | 'other'

// ── Active view ─────────────────────────────────────────────────────
export type ActiveView =
  | 'dashboard'
  | 'companies'
  | 'company-profile'
  | 'contacts'
  | 'contact-profile'
  | 'import'
  | 'email-generation'
  | 'knowledge-library'
  | 'settings'

// ── Interfaces ──────────────────────────────────────────────────────
export interface Company {
  id: string
  name: string
  domain: string | null
  linkedinUrl: string | null
  website: string | null
  industry: string | null
  employeeSize: EmployeeSize | null
  country: string | null
  location: string | null
  status: CompanyStatus
  intelligenceScore: number | null
  dataFreshness: DataFreshness | null
  lastUpdatedAt: string
  createdAt: string
  contacts?: Contact[]
  notes?: CompanyNote[]
  researchCard?: CompanyResearchCard | null
  opportunities?: Opportunity[]
  timeline?: TimelineEntry[]
  _count?: { contacts: number }
  _latestNote?: CompanyNote | null
}

export interface Contact {
  id: string
  companyId: string
  name: string
  email: string | null
  jobTitle: string | null
  roleBucket: RoleBucket | null
  linkedinUrl: string | null
  phone: string | null
  location: string | null
  status: ContactStatus
  emailHealth: EmailHealthStatus
  emailHealthScore: number | null
  lastContactedAt: string | null
  lastValidatedAt: string | null
  archivedAt: string | null
  createdAt: string
  updatedAt: string
  company?: Company
  notes?: ContactNote[]
  timeline?: TimelineEntry[]
  drafts?: Draft[]
  healthChecks?: EmailHealthCheck[]
}

export interface CompanyNote {
  id: string
  companyId: string
  body: string
  noteType: NoteType
  createdAt: string
  company?: Company
}

export interface ContactNote {
  id: string
  contactId: string
  body: string
  noteType: NoteType
  createdAt: string
  contact?: Contact
}

export interface CompanyResearchCard {
  id: string
  companyId: string
  businessOverview: string | null
  currentTechLandscape: string | null
  potentialChallenges: string | null
  possibleOpportunities: string | null
  relevantServices: string | null
  keyDecisionMakers: string | null
  lastInteraction: string | null
  nextAction: string | null
  confidenceScore: number | null
  lastResearchedAt: string
  createdAt: string
  company?: Company
}

export interface CompanyResearchSource {
  id: string
  companyId: string
  sourceType: string | null
  sourceUrl: string | null
  excerpt: string | null
  createdAt: string
}

export interface Opportunity {
  id: string
  companyId: string
  title: string
  description: string | null
  targetContactId: string | null
  status: OpportunityStatus
  nextAction: string | null
  createdAt: string
  updatedAt: string
  company?: Company
}

export interface TimelineEntry {
  id: string
  companyId: string | null
  contactId: string | null
  action: TimelineAction
  details: string | null
  createdAt: string
  company?: Company
  contact?: Contact
}

export interface CapabilityDocument {
  id: string
  title: string
  docType: DocType
  description: string | null
  content: string | null
  fileName: string | null
  createdAt: string
  updatedAt: string
  snippets?: CapabilitySnippet[]
}

export interface CapabilitySnippet {
  id: string
  documentId: string
  snippetType: SnippetType
  title: string
  content: string
  industries: string | null
  outcomes: string | null
  createdAt: string
  document?: CapabilityDocument
}

export interface Draft {
  id: string
  contactId: string
  subject: string
  body: string
  cta: string | null
  serviceAngle: string | null
  matchScore: number | null
  confidenceScore: number | null
  status: DraftStatus
  rejectReason: string | null
  createdAt: string
  updatedAt: string
  contact?: Contact
}

export interface EmailHealthCheck {
  id: string
  contactId: string
  status: EmailHealthStatus
  score: number
  actionRecommendation: string | null
  syntaxOk: boolean
  domainOk: boolean
  mxOk: boolean
  disposableOk: boolean
  checkedAt: string
  contact?: Contact
}

export interface ImportBatch {
  id: string
  fileName: string
  fileHash: string
  totalRows: number
  acceptedRows: number
  duplicateRows: number
  invalidRows: number
  status: ImportStatus
  createdAt: string
}

export interface UserPreferences {
  id: string
  tone: Tone
  emailLength: EmailLength
  openerStyle: OpenerStyle
  signOff: string
  avoidPhrases: string
  exampleEmail: string | null
  ctaStyle: CtaStyle
  aiProvider: AiProvider
  aiModel: string
  aiApiKey: string | null
  scoringWeights: string
}

export interface DashboardStats {
  totalCompanies: number
  totalContacts: number
  healthyEmails: number
  riskyEmails: number
  invalidEmails: number
  archivedContacts: number
  newThisWeek: number
  draftsGenerated: number
  recentActivity: TimelineEntry[]
}