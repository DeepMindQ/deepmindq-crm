/* ═══════════════════════════════════════════════════
   Shared prompt template store
   
   Extracted from route.ts to avoid Next.js 16 route export restrictions.
   ═══════════════════════════════════════════════════ */

export interface PromptTemplate {
  id: string;
  name: string;
  category: string;
  description: string | null;
  systemPrompt: string;
  userPromptTemplate: string;
  variables: string[];
  isBuiltIn: boolean;
  createdAt: string;
  updatedAt: string;
}

const now = () => new Date().toISOString();

export const templates: PromptTemplate[] = [
  {
    id: 'builtin-cold-intro',
    name: 'Cold Introduction',
    category: 'email',
    description: 'For first-time outreach to new prospects',
    systemPrompt: 'You are a professional B2B sales writer. Write concise, personalized cold outreach emails.',
    userPromptTemplate: 'Write a cold introduction email to {{contactName}} at {{companyName}} ({{industry}}).',
    variables: ['contactName', 'companyName', 'industry', 'employeeSize', 'location'],
    isBuiltIn: true,
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: 'builtin-follow-up-meeting',
    name: 'Follow-Up After Meeting',
    category: 'email',
    description: 'Post-meeting follow-up to keep momentum going',
    systemPrompt: 'You are a professional B2B sales writer. Write warm, concise follow-up emails.',
    userPromptTemplate: 'Write a follow-up email to {{contactName}} at {{companyName}} after a meeting.',
    variables: ['contactName', 'companyName', 'researchContext'],
    isBuiltIn: true,
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: 'builtin-case-study-share',
    name: 'Case Study Share',
    category: 'email',
    description: 'Sharing relevant case studies with prospects',
    systemPrompt: 'You are a professional B2B sales writer. Write emails that share case studies.',
    userPromptTemplate: 'Write an email to {{contactName}} at {{companyName}} sharing a relevant case study.',
    variables: ['contactName', 'companyName', 'industry', 'researchContext'],
    isBuiltIn: true,
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: 'builtin-re-engagement',
    name: 'Re-Engagement',
    category: 'email',
    description: 'Re-engaging cold prospects who went silent',
    systemPrompt: 'You are a professional B2B sales writer. Write re-engagement emails.',
    userPromptTemplate: 'Write a re-engagement email to {{contactName}} at {{companyName}}.',
    variables: ['contactName', 'companyName', 'industry', 'researchContext'],
    isBuiltIn: true,
    createdAt: now(),
    updatedAt: now(),
  },
];

export function generateId(): string {
  return `tmpl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
