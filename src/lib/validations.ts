import { z } from 'zod'
import {
  EMPLOYEE_SIZES,
  OPPORTUNITY_STATUSES,
  NOTE_TYPES,
  TIMELINE_ACTIONS,
  CTA_STYLES,
  EMAIL_LENGTHS,
  TONES,
  DOC_TYPES,
  COMPANY_STATUSES,
  DRAFT_STATUSES,
  ROLE_BUCKETS,
  AI_PROVIDERS,
} from './constants'

// ── Company ─────────────────────────────────────────────────────────
export const createCompanySchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200, 'Name is too long'),
  domain: z.string().url('Invalid URL').optional().or(z.literal('')),
  website: z.string().url('Invalid URL').optional().or(z.literal('')),
  linkedinUrl: z.string().url('Invalid URL').optional().or(z.literal('')),
  industry: z.string().optional(),
  employeeSize: z.enum(EMPLOYEE_SIZES).optional(),
  country: z.string().optional(),
  location: z.string().optional(),
  status: z.enum(COMPANY_STATUSES).default('new'),
})

export const updateCompanySchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  domain: z.string().url().optional().or(z.literal('')).optional(),
  website: z.string().url().optional().or(z.literal('')).optional(),
  linkedinUrl: z.string().url().optional().or(z.literal('')).optional(),
  industry: z.string().optional(),
  employeeSize: z.enum(EMPLOYEE_SIZES).optional(),
  country: z.string().optional(),
  location: z.string().optional(),
  status: z.enum(COMPANY_STATUSES).optional(),
})

// ── Contact ─────────────────────────────────────────────────────────
export const createContactSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200, 'Name is too long'),
  companyId: z.string().min(1, 'Company ID is required'),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  jobTitle: z.string().optional(),
  roleBucket: z.enum(ROLE_BUCKETS).optional(),
  linkedinUrl: z.string().url('Invalid URL').optional().or(z.literal('')),
  phone: z.string().optional(),
  location: z.string().optional(),
  status: z.enum(['new', 'active', 'inactive', 'archived'] as const).default('new'),
})

export const updateContactSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  companyId: z.string().min(1).optional(),
  email: z.string().email().optional().or(z.literal('')).optional(),
  jobTitle: z.string().optional(),
  roleBucket: z.enum(ROLE_BUCKETS).optional(),
  linkedinUrl: z.string().url().optional().or(z.literal('')).optional(),
  phone: z.string().optional(),
  location: z.string().optional(),
  status: z.enum(['new', 'active', 'inactive', 'archived'] as const).optional(),
})

// ── Opportunity ─────────────────────────────────────────────────────
export const createOpportunitySchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(300, 'Title is too long'),
  companyId: z.string().min(1, 'Company ID is required'),
  description: z.string().max(5000, 'Description is too long').optional(),
  targetContactId: z.string().optional(),
  status: z.enum(OPPORTUNITY_STATUSES).default('researching'),
  nextAction: z.string().max(500, 'Next action is too long').optional(),
})

export const updateOpportunitySchema = z.object({
  title: z.string().trim().min(1).max(300).optional(),
  companyId: z.string().min(1).optional(),
  description: z.string().max(5000).optional(),
  targetContactId: z.string().nullable().optional(),
  status: z.enum(OPPORTUNITY_STATUSES).optional(),
  nextAction: z.string().max(500).optional(),
})

// ── Notes ───────────────────────────────────────────────────────────
export const createNoteSchema = z
  .object({
    body: z.string().trim().min(1, 'Note body is required').max(10000, 'Note is too long'),
    companyId: z.string().optional(),
    contactId: z.string().optional(),
    noteType: z.enum(NOTE_TYPES).optional(),
  })
  .refine((data) => data.companyId || data.contactId, {
    message: 'Either companyId or contactId is required',
  })

// ── Timeline ────────────────────────────────────────────────────────
export const createTimelineSchema = z.object({
  action: z.enum(TIMELINE_ACTIONS),
  companyId: z.string().optional(),
  contactId: z.string().optional(),
  details: z.string().max(2000, 'Details are too long').optional(),
})

// ── Drafts ──────────────────────────────────────────────────────────
export const createDraftSchema = z.object({
  contactId: z.string().min(1, 'Contact ID is required'),
  subject: z.string().trim().min(1, 'Subject is required').max(500, 'Subject is too long'),
  body: z.string().trim().min(1, 'Body is required').max(50000, 'Body is too long'),
  cta: z.string().optional(),
  serviceAngle: z.string().optional(),
})

export const updateDraftSchema = z.object({
  subject: z.string().trim().min(1).max(500).optional(),
  body: z.string().trim().min(1).max(50000).optional(),
  cta: z.string().optional(),
  serviceAngle: z.string().optional(),
  status: z.enum(DRAFT_STATUSES).optional(),
})

// ── User Preferences ────────────────────────────────────────────────
export const updatePreferencesSchema = z.object({
  tone: z.enum(TONES).optional(),
  emailLength: z.enum(EMAIL_LENGTHS).optional(),
  ctaStyle: z.enum(CTA_STYLES).optional(),
  aiProvider: z.enum(AI_PROVIDERS).optional(),
  aiModel: z.string().optional(),
  signOff: z.string().optional(),
  avoidPhrases: z.string().optional(),
  exampleEmail: z.string().optional(),
  scoringWeights: z.string().optional(),
})

// ── Knowledge Library ───────────────────────────────────────────────
export const createKnowledgeDocSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(300, 'Title is too long'),
  docType: z.enum(DOC_TYPES, { message: 'Invalid document type' }),
  description: z.string().optional(),
})

// ── Import ──────────────────────────────────────────────────────────
export const importExecuteSchema = z.object({
  importBatchId: z.string().min(1, 'Import batch ID is required'),
  mapping: z.record(z.string(), z.string()),
  rows: z.array(z.record(z.string(), z.any())).max(1000, 'Maximum 1000 rows per import'),
})

// ── Inferred types ──────────────────────────────────────────────────
export type CreateCompanyInput = z.infer<typeof createCompanySchema>
export type UpdateCompanyInput = z.infer<typeof updateCompanySchema>
export type CreateContactInput = z.infer<typeof createContactSchema>
export type UpdateContactInput = z.infer<typeof updateContactSchema>
export type CreateOpportunityInput = z.infer<typeof createOpportunitySchema>
export type UpdateOpportunityInput = z.infer<typeof updateOpportunitySchema>
export type CreateNoteInput = z.infer<typeof createNoteSchema>
export type CreateTimelineInput = z.infer<typeof createTimelineSchema>
export type CreateDraftInput = z.infer<typeof createDraftSchema>
export type UpdateDraftInput = z.infer<typeof updateDraftSchema>
export type UpdatePreferencesInput = z.infer<typeof updatePreferencesSchema>
export type CreateKnowledgeDocInput = z.infer<typeof createKnowledgeDocSchema>
export type ImportExecuteInput = z.infer<typeof importExecuteSchema>