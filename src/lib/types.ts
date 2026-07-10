export type ActiveView =
  | "dashboard"
  | "companies"
  | "company-profile"
  | "contacts"
  | "contact-profile"
  | "import"
  | "email-generation"
  | "knowledge-library"
  | "settings";

export interface Company {
  id: string;
  name: string;
  domain: string | null;
  linkedinUrl: string | null;
  website: string | null;
  industry: string | null;
  employeeSize: string | null;
  country: string | null;
  location: string | null;
  status: string;
  intelligenceScore: number | null;
  dataFreshness: string | null;
  lastUpdatedAt: string;
  createdAt: string;
  contacts?: Contact[];
  notes?: CompanyNote[];
  researchCard?: CompanyResearchCard | null;
  opportunities?: Opportunity[];
  timeline?: TimelineEntry[];
  _count?: { contacts: number };
  _latestNote?: CompanyNote | null;
}

export interface Contact {
  id: string;
  companyId: string;
  name: string;
  email: string | null;
  jobTitle: string | null;
  roleBucket: string | null;
  linkedinUrl: string | null;
  phone: string | null;
  location: string | null;
  status: string;
  emailHealth: string;
  emailHealthScore: number | null;
  lastContactedAt: string | null;
  lastValidatedAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  company?: Company;
  notes?: ContactNote[];
  timeline?: TimelineEntry[];
  drafts?: Draft[];
  healthChecks?: EmailHealthCheck[];
}

export interface CompanyNote {
  id: string;
  companyId: string;
  body: string;
  noteType: string | null;
  createdAt: string;
  company?: Company;
}

export interface ContactNote {
  id: string;
  contactId: string;
  body: string;
  noteType: string | null;
  createdAt: string;
  contact?: Contact;
}

export interface CompanyResearchCard {
  id: string;
  companyId: string;
  businessOverview: string | null;
  currentTechLandscape: string | null;
  potentialChallenges: string | null;
  possibleOpportunities: string | null;
  relevantServices: string | null;
  keyDecisionMakers: string | null;
  lastInteraction: string | null;
  nextAction: string | null;
  confidenceScore: number | null;
  lastResearchedAt: string;
  createdAt: string;
  company?: Company;
}

export interface CompanyResearchSource {
  id: string;
  companyId: string;
  sourceType: string | null;
  sourceUrl: string | null;
  excerpt: string | null;
  createdAt: string;
}

export interface Opportunity {
  id: string;
  companyId: string;
  title: string;
  description: string | null;
  targetContactId: string | null;
  status: string;
  nextAction: string | null;
  createdAt: string;
  updatedAt: string;
  company?: Company;
}

export interface TimelineEntry {
  id: string;
  companyId: string | null;
  contactId: string | null;
  action: string;
  details: string | null;
  createdAt: string;
  company?: Company;
  contact?: Contact;
}

export interface CapabilityDocument {
  id: string;
  title: string;
  docType: string;
  description: string | null;
  content: string | null;
  fileName: string | null;
  createdAt: string;
  updatedAt: string;
  snippets?: CapabilitySnippet[];
}

export interface CapabilitySnippet {
  id: string;
  documentId: string;
  snippetType: string;
  title: string;
  content: string;
  industries: string | null;
  outcomes: string | null;
  createdAt: string;
  document?: CapabilityDocument;
}

export interface Draft {
  id: string;
  contactId: string;
  subject: string;
  body: string;
  cta: string | null;
  serviceAngle: string | null;
  matchScore: number | null;
  confidenceScore: number | null;
  status: string;
  rejectReason: string | null;
  createdAt: string;
  updatedAt: string;
  contact?: Contact;
}

export interface EmailHealthCheck {
  id: string;
  contactId: string;
  status: string;
  score: number;
  actionRecommendation: string | null;
  syntaxOk: boolean;
  domainOk: boolean;
  mxOk: boolean;
  disposableOk: boolean;
  checkedAt: string;
  contact?: Contact;
}

export interface ImportBatch {
  id: string;
  fileName: string;
  fileHash: string;
  totalRows: number;
  acceptedRows: number;
  duplicateRows: number;
  invalidRows: number;
  status: string;
  createdAt: string;
}

export interface UserPreferences {
  id: string;
  tone: string;
  emailLength: string;
  openerStyle: string;
  signOff: string;
  avoidPhrases: string;
  exampleEmail: string | null;
  ctaStyle: string;
  aiProvider: string;
  aiModel: string;
  aiApiKey: string | null;
  scoringWeights: string;
}

export interface DashboardStats {
  totalCompanies: number;
  totalContacts: number;
  healthyEmails: number;
  riskyEmails: number;
  invalidEmails: number;
  archivedContacts: number;
  newThisWeek: number;
  draftsGenerated: number;
  recentActivity: TimelineEntry[];
}