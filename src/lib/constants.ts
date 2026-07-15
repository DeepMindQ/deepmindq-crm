import type {
  CompanyStatus,
  ContactStatus,
  OpportunityStatus,
  DraftStatus,
  EmailHealthStatus,
  DataFreshness,
  NoteType,
  ImportStatus,
  TimelineAction,
  EmployeeSize,
  RoleBucket,
  AiProvider,
  CtaStyle,
  EmailLength,
  Tone,
  DocType,
  SnippetType,
} from './types'

// ── Valid views ─────────────────────────────────────────────────────
export const VALID_VIEWS = [
  'dashboard',
  'companies',
  'company-profile',
  'contacts',
  'contact-profile',
  'tasks',
  'opportunities',
  'import',
  'email-generation',
  'knowledge-library',
  'settings',
  'audit-logs',
  'sequences',
  'prompt-templates',
  'reports',
] as const

// ── Status option arrays ────────────────────────────────────────────
export const COMPANY_STATUSES: CompanyStatus[] = ['new', 'active', 'inactive', 'archived']
export const CONTACT_STATUSES: ContactStatus[] = ['new', 'active', 'inactive', 'archived']
export const OPPORTUNITY_STATUSES: OpportunityStatus[] = ['researching', 'qualified', 'proposal', 'negotiation', 'won', 'lost', 'archived']
export const DRAFT_STATUSES: DraftStatus[] = ['draft', 'approved', 'sent', 'rejected', 'archived']
export const IMPORT_STATUSES: ImportStatus[] = ['staged', 'processing', 'completed', 'failed']
export const EMAIL_HEALTH_STATUSES: EmailHealthStatus[] = ['valid', 'risky', 'invalid', 'unknown']
export const DATA_FRESHNESS_VALUES: DataFreshness[] = ['fresh', 'stale', 'old', 'unknown']
export const NOTE_TYPES = ['call', 'meeting', 'email', 'note', 'research'] as const
export const ROLE_BUCKETS: RoleBucket[] = ['Executive', 'Manager', 'Technical', 'Operations', 'Sales', 'Other']
export const EMPLOYEE_SIZES: EmployeeSize[] = ['1-10', '11-50', '51-200', '201-500', '501-1000', '1001-5000', '5001+']
export const AI_PROVIDERS: AiProvider[] = ['openai', 'gemini', 'groq']
export const CTA_STYLES: CtaStyle[] = ['soft', 'direct', 'consultative', 'urgent']
export const EMAIL_LENGTHS: EmailLength[] = ['short', 'medium', 'long']
export const TONES: Tone[] = ['professional-casual', 'formal', 'friendly', 'concise']
export const DOC_TYPES: DocType[] = ['case-study', 'whitepaper', 'blog', 'presentation', 'documentation', 'other']
export const SNIPPET_TYPES: SnippetType[] = ['capability', 'outcome', 'process', 'testimonial', 'other']

export const TIMELINE_ACTIONS: TimelineAction[] = [
  'company_created',
  'contact_added',
  'email_generated',
  'research_generated',
  'note_added',
  'email_validated',
  'import_completed',
  'deleted',
  'status_changed',
  'opportunity_created',
  'opportunity_updated',
  'draft_created',
  'draft_updated',
]

// ── Default industries ──────────────────────────────────────────────
export const DEFAULT_INDUSTRIES = [
  'Technology',
  'SaaS',
  'FinTech',
  'Healthcare',
  'E-commerce',
  'Manufacturing',
  'Education',
  'Real Estate',
  'Logistics',
  'Consulting',
  'Media',
  'Retail',
  'Energy',
  'Telecommunications',
  'Aerospace',
  'Biotech',
  'Agriculture',
  'Legal',
  'Government',
  'Non-Profit',
  'Automotive',
  'Travel',
  'Insurance',
  'Other',
] as const

// ── Status style helpers ────────────────────────────────────────────
const FALLBACK = 'bg-gray-50 text-gray-600 border-gray-200'

export function getCompanyStatusVariant(status: string): string {
  const map: Record<string, string> = {
    new: 'bg-blue-50 text-blue-700 border-blue-200',
    active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    inactive: 'bg-gray-50 text-gray-600 border-gray-200',
    archived: 'bg-red-50 text-red-600 border-red-200',
  }
  return map[status] || FALLBACK
}

export function getOppStatusVariant(status: string): string {
  const map: Record<string, string> = {
    researching: 'bg-sky-50 text-sky-700 border-sky-200',
    qualified: 'bg-blue-50 text-blue-700 border-blue-200',
    proposal: 'bg-violet-50 text-violet-700 border-violet-200',
    negotiation: 'bg-amber-50 text-amber-700 border-amber-200',
    won: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    lost: 'bg-red-50 text-red-600 border-red-200',
    archived: 'bg-gray-50 text-gray-500 border-gray-200',
  }
  return map[status] || FALLBACK
}

export function getDraftStatusVariant(status: string): string {
  const map: Record<string, string> = {
    draft: 'bg-gray-50 text-gray-600 border-gray-200',
    approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    sent: 'bg-blue-50 text-blue-700 border-blue-200',
    rejected: 'bg-red-50 text-red-600 border-red-200',
    archived: 'bg-gray-50 text-gray-500 border-gray-200',
  }
  return map[status] || FALLBACK
}

export function getHealthVariant(health: string): string {
  const map: Record<string, string> = {
    valid: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    risky: 'bg-amber-50 text-amber-700 border-amber-200',
    invalid: 'bg-red-50 text-red-600 border-red-200',
    unknown: 'bg-gray-50 text-gray-500 border-gray-200',
  }
  return map[health] || 'bg-gray-50 text-gray-500 border-gray-200'
}

export function getStatusBorder(status: string): string {
  const map: Record<string, string> = {
    researching: 'border-l-sky-400',
    qualified: 'border-l-blue-500',
    proposal: 'border-l-violet-500',
    negotiation: 'border-l-amber-500',
    won: 'border-l-emerald-500',
    lost: 'border-l-red-400',
  }
  return map[status] || 'border-l-gray-300'
}

export function mapDataFreshness(raw: string | null): DataFreshness {
  if (!raw) return 'unknown'
  const lower = raw.toLowerCase()
  if (lower.includes('fresh') || lower.includes('< 7') || lower.includes('<7')) return 'fresh'
  if (lower.includes('stale') || lower.includes('7-30') || lower.includes('> 7')) return 'stale'
  if (lower.includes('old') || lower.includes('> 30') || lower.includes('30+')) return 'old'
  return 'unknown'
}