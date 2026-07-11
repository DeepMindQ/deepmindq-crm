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
  | 'tasks'
  | 'opportunities'
  | 'import'
  | 'email-generation'
  | 'knowledge-library'
  | 'settings'
  | 'audit-logs'
  | 'sequences'
  | 'prompt-templates'
  | 'reports'

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

// ── Auth & User ──────────────────────────────────────────────────────
export interface User {
  id: string
  name: string
  email: string
  emailVerified: string | null
  image: string | null
  role: string
  lastLoginAt: string | null
  createdAt: string
  updatedAt: string
}

export interface AuditLogEntry {
  id: string
  userId: string
  action: string
  entity: string
  entityId: string | null
  details: string | null
  ipAddress: string | null
  userAgent: string | null
  createdAt: string
  user?: { id: string; name: string; email: string }
}

export interface NotificationItem {
  id: string
  userId: string
  title: string
  message: string | null
  type: string
  read: boolean
  link: string | null
  createdAt: string
}

export interface TaskItem {
  id: string
  title: string
  description: string | null
  status: 'pending' | 'in_progress' | 'completed' | 'overdue'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  dueDate: string | null
  completedAt: string | null
  companyId: string | null
  contactId: string | null
  assignedTo: string | null
  createdBy: string
  createdAt: string
  updatedAt: string
}

// ── Tags ────────────────────────────────────────────────────────────
export interface Tag {
  id: string
  name: string
  color: string
  createdAt: string
}

export interface TagAssignment {
  id: string
  tagId: string
  companyId: string | null
  contactId: string | null
  tag?: Tag
}

// ── Custom Fields ─────────────────────────────────────────────────────
export interface CustomFieldDefinition {
  id: string
  entityType: string
  sourceHeader: string
  internalKey: string
  displayName: string
  dataType: 'text' | 'number' | 'date' | 'dropdown' | 'checkbox'
  isSearchable: boolean
  isFilterable: boolean
  createdAt: string
}

export interface CustomFieldValue {
  id: string
  fieldId: string
  contactId: string | null
  companyId: string | null
  rawValue: string | null
  createdAt: string
  field?: CustomFieldDefinition
}

// ── Email Sequences ──────────────────────────────────────────────────
export interface EmailSequence {
  id: string
  name: string
  description: string | null
  status: 'draft' | 'active' | 'paused' | 'completed'
  contactId: string | null
  companyId: string | null
  steps?: EmailSequenceStep[]
  createdAt: string
  updatedAt: string
}

export interface EmailSequenceStep {
  id: string
  sequenceId: string
  stepNumber: number
  subject: string
  body: string
  delayMinutes: number
  cta: string | null
  status: 'pending' | 'sent' | 'opened' | 'replied' | 'failed'
  sentAt: string | null
  openedAt: string | null
  repliedAt: string | null
  createdAt: string
  updatedAt: string
}

// ── Email Templates ──────────────────────────────────────────────────
export interface EmailTemplate {
  id: string
  name: string
  subject: string
  body: string
  category: string
  description: string | null
  isBuiltIn: boolean
}

// ── Comments ────────────────────────────────────────────────────────
export interface Comment {
  id: string
  body: string
  userId: string
  companyId: string | null
  contactId: string | null
  opportunityId: string | null
  parentId: string | null
  createdAt: string
  updatedAt: string
  user?: { id: string; name: string; email: string; image?: string | null }
  replies?: Comment[]
  _count?: { replies: number }
}

// ── Teams ───────────────────────────────────────────────────────────
export interface Team {
  id: string
  name: string
  description: string | null
  createdAt: string
  updatedAt: string
  members?: TeamMember[]
  _count?: { members: number }
}

export interface TeamMember {
  id: string
  teamId: string
  userId: string
  role: string
  joinedAt: string
  user?: { id: string; name: string; email: string; role: string }
}

// ── Report Types ──────────────────────────────────────────────────
export interface PipelineStageReport {
  stage: string
  count: number
  value: number
  avgDaysInStage: number
  conversionRate: number
}

export interface PipelineReport {
  stages: PipelineStageReport[]
  totalPipelineValue: number
  weightedPipelineValue: number
  stageVelocity: number
  winRate: number
  avgDealSize: number
  dealCountByMonth: Array<{ month: string; count: number }>
}

export interface RevenueForecastMonth {
  month: string
  projected: number
  conservative: number
  optimistic: number
}

export interface RevenueForecast {
  currentMonth: { revenue: number; deals: number }
  forecast: RevenueForecastMonth[]
  pipelineByStage: Array<{ stage: string; value: number }>
  topDeals: Array<{ title: string; company: string; value: number; probability: number; stage: string }>
}

export interface ActivityReport {
  totalActivities: number
  byType: Array<{ action: string; count: number }>
  byDay: Array<{ date: string; count: number }>
  emailsGenerated: number
  emailsSent: number
  researchGenerated: number
  healthChecksRun: number
  notesCreated: number
  activityHeatmap: Array<{ hour: number; day: number; count: number }>
  topUsers: Array<{ name: string; activities: number }>
}

export interface TeamPerformanceUser {
  userId: string
  name: string
  companiesOwned: number
  contactsCreated: number
  emailsGenerated: number
  emailsSent: number
  dealsWon: number
  dealsLost: number
  winRate: number
  revenue: number
  activities: number
  lastActive: string
}

export interface TeamPerformanceReport {
  users: TeamPerformanceUser[]
  leaderboard: 'companies' | 'emails' | 'deals'
}

export interface DataQualityOverall {
  score: number
  total: number
  complete: number
  partial: number
  empty: number
}

export interface DataQualityEntity {
  total: number
  completenessByField: Record<string, number>
}

export interface DataQualityCompanies extends DataQualityEntity {
  withDomain: number
  withWebsite: number
  withIndustry: number
  withEmployeeSize: number
  withCountry: number
  withLocation: number
  withResearchCard: number
}

export interface DataQualityContacts extends DataQualityEntity {
  withEmail: number
  withJobTitle: number
  withPhone: number
  withLocation: number
  withLinkedin: number
  emailHealthBreakdown: { valid: number; risky: number; invalid: number; unknown: number }
}

export interface DataQualityReport {
  overall: DataQualityOverall
  companies: DataQualityCompanies
  contacts: DataQualityContacts
  recommendations: string[]
}