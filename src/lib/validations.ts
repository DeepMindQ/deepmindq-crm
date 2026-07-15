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

// ── Auth ────────────────────────────────────────────────────────────
export const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().email('Invalid email address'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain an uppercase letter')
    .regex(/[0-9]/, 'Password must contain a number'),
  confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
})

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
})

export const resetPasswordRequestSchema = z.object({
  email: z.string().email('Invalid email address'),
})

export const resetPasswordConfirmSchema = z.object({
  email: z.string().email('Invalid email address'),
  code: z.string().length(6, 'Code must be 6 digits'),
  newPassword: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain an uppercase letter')
    .regex(/[0-9]/, 'Password must contain a number'),
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
export type RegisterInput = z.infer<typeof registerSchema>
export type LoginInput = z.infer<typeof loginSchema>
export type ResetPasswordRequestInput = z.infer<typeof resetPasswordRequestSchema>
export type ResetPasswordConfirmInput = z.infer<typeof resetPasswordConfirmSchema>

// ── Task ────────────────────────────────────────────────────────────
export const TASK_STATUSES = ['pending', 'in_progress', 'completed', 'overdue'] as const
export const TASK_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const
export const NOTIFICATION_TYPES = ['info', 'success', 'warning', 'error'] as const

export const createTaskSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(300, 'Title is too long'),
  description: z.string().max(5000, 'Description is too long').optional(),
  status: z.enum(TASK_STATUSES).default('pending'),
  priority: z.enum(TASK_PRIORITIES).default('medium'),
  dueDate: z.string().datetime({ message: 'Invalid date format' }).optional().or(z.literal('')),
  companyId: z.string().optional(),
  contactId: z.string().optional(),
})

export const updateTaskSchema = z.object({
  title: z.string().trim().min(1).max(300).optional(),
  description: z.string().max(5000).optional(),
  status: z.enum(TASK_STATUSES).optional(),
  priority: z.enum(TASK_PRIORITIES).optional(),
  dueDate: z.string().datetime({ message: 'Invalid date format' }).optional().or(z.literal('')).nullable(),
  companyId: z.string().nullable().optional(),
  contactId: z.string().nullable().optional(),
})

export const createNotificationSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(300, 'Title is too long'),
  message: z.string().max(2000, 'Message is too long').optional(),
  type: z.enum(NOTIFICATION_TYPES).default('info'),
  link: z.string().optional(),
})

export const markNotificationReadSchema = z.object({
  read: z.boolean(),
})

// ── Inferred types ──────────────────────────────────────────────────
export type CreateTaskInput = z.infer<typeof createTaskSchema>
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>
export type CreateNotificationInput = z.infer<typeof createNotificationSchema>
export type MarkNotificationReadInput = z.infer<typeof markNotificationReadSchema>

// ── Tags ────────────────────────────────────────────────────────────
export const createTagSchema = z.object({
  name: z.string().trim().min(1, 'Tag name is required').max(50, 'Tag name too long'),
  color: z.string().optional(),
})

export const assignTagsSchema = z.object({
  tagIds: z.array(z.string().min(1)),
  entity: z.enum(['company', 'contact']),
  entityId: z.string().min(1, 'Entity ID is required'),
})

// ── Custom Fields ───────────────────────────────────────────────────
export const createCustomFieldSchema = z.object({
  entityType: z.enum(['Company', 'Contact']),
  sourceHeader: z.string().max(100),
  internalKey: z.string().max(100),
  displayName: z.string().min(1, 'Display name is required').max(100),
  dataType: z.enum(['text', 'number', 'date', 'dropdown', 'checkbox']).default('text'),
  isSearchable: z.boolean().default(false),
  isFilterable: z.boolean().default(false),
})

export const updateCustomFieldSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  dataType: z.enum(['text', 'number', 'date', 'dropdown', 'checkbox']).optional(),
  isSearchable: z.boolean().optional(),
  isFilterable: z.boolean().optional(),
})

export const upsertCustomFieldValuesSchema = z.object({
  entityType: z.enum(['Company', 'Contact']),
  entityId: z.string().min(1, 'Entity ID is required'),
  values: z.array(z.object({
    fieldId: z.string().min(1),
    value: z.union([z.string(), z.number(), z.boolean()]).nullable().optional(),
  })).max(100),
})

// ── Inferred types (Tags & Custom Fields) ──────────────────────────
export type CreateTagInput = z.infer<typeof createTagSchema>
export type AssignTagsInput = z.infer<typeof assignTagsSchema>
export type CreateCustomFieldInput = z.infer<typeof createCustomFieldSchema>
export type UpdateCustomFieldInput = z.infer<typeof updateCustomFieldSchema>
export type UpsertCustomFieldValuesInput = z.infer<typeof upsertCustomFieldValuesSchema>

// ── Email Sequences ─────────────────────────────────────────────────
export const SEQUENCE_STATUSES = ['draft', 'active', 'paused', 'completed'] as const

export const createSequenceSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
  description: z.string().max(1000).optional(),
  contactId: z.string().optional(),
  companyId: z.string().optional(),
})

export const updateSequenceSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  description: z.string().max(1000).nullable().optional(),
  status: z.enum(SEQUENCE_STATUSES).optional(),
  contactId: z.string().nullable().optional(),
  companyId: z.string().nullable().optional(),
})

export const createSequenceStepSchema = z.object({
  subject: z.string().trim().min(1, 'Subject is required').max(500),
  body: z.string().trim().min(1, 'Body is required').max(50000),
  delayMinutes: z.number().int().min(0).default(1440),
  cta: z.string().max(500).optional(),
})

export const updateSequenceStepSchema = z.object({
  subject: z.string().trim().min(1).max(500).optional(),
  body: z.string().trim().min(1).max(50000).optional(),
  delayMinutes: z.number().int().min(0).optional(),
  cta: z.string().max(500).nullable().optional(),
  stepNumber: z.number().int().min(1).optional(),
  status: z.enum(['pending', 'sent', 'opened', 'replied', 'failed'] as const).optional(),
  sentAt: z.string().datetime({ message: 'Invalid date format' }).optional().or(z.literal('')).nullable(),
  openedAt: z.string().datetime({ message: 'Invalid date format' }).optional().or(z.literal('')).nullable(),
  repliedAt: z.string().datetime({ message: 'Invalid date format' }).optional().or(z.literal('')).nullable(),
})

// ── Email Templates ─────────────────────────────────────────────────
export const createEmailTemplateSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
  subject: z.string().trim().min(1).max(500),
  body: z.string().trim().min(1).max(50000),
  category: z.string().max(50).optional(),
  description: z.string().max(500).optional(),
})

export const updateEmailTemplateSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  subject: z.string().trim().min(1).max(500).optional(),
  body: z.string().trim().min(1).max(50000).optional(),
  category: z.string().max(50).optional(),
  description: z.string().max(500).nullable().optional(),
})

// ── Inferred types (Sequences & Templates) ──────────────────────────
export type CreateSequenceInput = z.infer<typeof createSequenceSchema>
export type UpdateSequenceInput = z.infer<typeof updateSequenceSchema>
export type CreateSequenceStepInput = z.infer<typeof createSequenceStepSchema>
export type UpdateSequenceStepInput = z.infer<typeof updateSequenceStepSchema>
export type CreateEmailTemplateInput = z.infer<typeof createEmailTemplateSchema>
export type UpdateEmailTemplateInput = z.infer<typeof updateEmailTemplateSchema>

// ── Comments ────────────────────────────────────────────────────────
export const createCommentSchema = z
  .object({
    body: z.string().trim().min(1, 'Comment is required').max(5000),
    companyId: z.string().optional(),
    contactId: z.string().optional(),
    opportunityId: z.string().optional(),
    parentId: z.string().optional(),
  })
  .refine((d) => d.companyId || d.contactId || d.opportunityId, {
    message: 'Must be linked to a company, contact, or opportunity',
  })

// ── Teams ───────────────────────────────────────────────────────────
export const createTeamSchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().max(500).optional(),
})

export const addTeamMemberSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(['admin', 'member']).default('member'),
})

// ── Inferred types (Comments & Teams) ───────────────────────────────
export type CreateCommentInput = z.infer<typeof createCommentSchema>
export type CreateTeamInput = z.infer<typeof createTeamSchema>
export type AddTeamMemberInput = z.infer<typeof addTeamMemberSchema>