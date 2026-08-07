/**
 * Centralized Technology Keyword Registry — Single Source of Truth
 *
 * Phase 1.7: Technology Detection Calibration
 *
 * All technology detection across the codebase MUST reference these
 * constants. Adding a new technology requires updating ONLY this file.
 *
 * Previously, 6+ files maintained independent keyword lists with
 * significant duplication. This module consolidates them.
 *
 * Categories:
 *   CLOUD       — Cloud platforms & providers
 *   DATA        — Data platforms, warehouses, lakes
 *   AI_ML       — Artificial intelligence & machine learning
 *   DEVOPS      — CI/CD, monitoring, infrastructure-as-code
 *   CRM_ERP     — CRM, ERP, HCM enterprise platforms
 *   DEV_STACK   — Programming languages, frameworks, runtimes
 *   SECURITY    — Security & compliance platforms
 *   COLLABORATION — Workplace & collaboration tools
 */

// ── Category-tagged keyword lists ──

export const TECH_KEYWORDS = {
  /** Cloud platforms and providers */
  CLOUD: [
    'aws', 'amazon web services', 'azure', 'microsoft azure', 'gcp', 'google cloud',
    'google cloud platform', 'oracle cloud', 'oci', 'digitalocean', 'linode',
    'cloud', 'cloud-native', 'cloud migration', 'multi-cloud', 'hybrid cloud',
    'serverless', 'paas', 'iaas', 'saas',
  ] as const,

  /** Data platforms, warehouses, lakes, and analytics */
  DATA: [
    'snowflake', 'databricks', 'redshift', 'bigquery', 'synapse', 'data lake',
    'data warehouse', 'data platform', 'data engineering', 'real-time analytics',
    'data analytics', 'etl', 'elt', 'data pipeline', 'dbt', 'looker', 'tableau', 'power bi',
    'spark', 'kafka', 'airflow', 'fivetran',
  ] as const,

  /** AI, ML, and GenAI */
  AI_ML: [
    'artificial intelligence', 'ai', 'machine learning', 'ml', 'deep learning',
    'natural language processing', 'nlp', 'computer vision', 'generative ai',
    'genai', 'llm', 'large language model', 'copilot', 'gpt', 'bert',
    'transformer', 'neural network', 'tensorflow', 'pytorch', 'openai',
    'anthropic', 'bedrock', 'azure ai', 'vertex ai',
  ] as const,

  /** DevOps, CI/CD, monitoring, infrastructure-as-code */
  DEVOPS: [
    'kubernetes', 'k8s', 'docker', 'docker swarm', 'terraform', 'pulumi',
    'ansible', 'jenkins', 'github actions', 'gitlab ci', 'circleci',
    'datadog', 'splunk', 'new relic', 'grafana', 'prometheus',
    'devops', 'microservices', 'infrastructure as code', 'iac',
    'helm', 'istio', 'service mesh', 'containerization',
  ] as const,

  /** CRM, ERP, HCM, and enterprise platforms */
  CRM_ERP: [
    'salesforce', 'salesforce crm', 'hubspot', 'hubspot crm', 'sap',
    'sap s/4hana', 'oracle', 'oracle erp', 'oracle cloud',
    'servicenow', 'workday', 'netsuite', 'microsoft dynamics',
    'zoho', 'sugarcrm', 'pipedrive',
  ] as const,

  /** Programming languages, frameworks, and runtimes */
  DEV_STACK: [
    'react', 'angular', 'vue', 'next.js', 'node', 'nodejs', 'node.js',
    'python', 'java', 'typescript', 'javascript', 'golang', 'go',
    'rust', 'ruby', 'rails', 'django', 'flask', 'spring boot',
    '.net', 'c#', 'php', 'laravel', 'swift', 'kotlin',
  ] as const,

  /** Security & compliance platforms */
  SECURITY: [
    'soc', 'sox', 'gdpr', 'hipaa', 'pci', 'pci-dss',
    'iso 27001', 'zerotrust', 'zero trust', 'siem', 'saml', 'oauth',
    'okta', 'crowdstrike', 'palo alto', 'cloudflare',
  ] as const,

  /** Workplace & collaboration */
  COLLABORATION: [
    'slack', 'microsoft teams', 'teams', 'zoom', 'jira', 'confluence',
    'notion', 'asana', 'monday.com', 'figma',
  ] as const,
} as const;

// ── Derived: All keywords as flat array ──

export const ALL_TECH_KEYWORDS: readonly string[] = Object.values(TECH_KEYWORDS).flat();

// ── Derived: Category lookup map ──

export type TechCategory = keyof typeof TECH_KEYWORDS;

export const TECH_KEYWORD_TO_CATEGORY: ReadonlyMap<string, TechCategory> = new Map(
  ALL_TECH_KEYWORDS.map(kw => [kw.toLowerCase(), categorizeKeyword(kw)])
);

function categorizeKeyword(keyword: string): TechCategory {
  const lower = keyword.toLowerCase();
  for (const [category, keywords] of Object.entries(TECH_KEYWORDS)) {
    if ((keywords as readonly string[]).some(kw => kw.toLowerCase() === lower)) {
      return category as TechCategory;
    }
  }
  return 'CLOUD'; // fallback
}

// ── Action verbs that indicate technology adoption/change ──

export const TECH_ACTION_VERBS = [
  'migrating', 'migrate', 'adopting', 'adopt', 'implementing', 'implement',
  'deploying', 'deploy', 'launching', 'launch',
  'standardizing on', 'standardize on', 'chooses', 'choose',
  'selects', 'select', 'partners with', 'partner with',
  'integrates', 'integrate',
  'migrates to', 'migrate to', 'transitioning to', 'transition to',
  'moving to', 'move to', 'upgrading', 'upgrade',
  'modernizing', 'modernize', 'consolidating', 'consolidate',
  'replacing', 'replace', 'switching to', 'switch to',
] as const;

// ── Regex pattern for rule-based tech signal detection ──

/** Matches "[verb] ... [technology]" patterns in text */
export const TECH_SIGNAL_REGEX = new RegExp(
  `(${TECH_ACTION_VERBS.map(v => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\s+(?:to\\s+)?(?:the\\s+)?(?:a\\s+)?(?:our\\s+)?` +
  `(cloud|ai|ml|data|platform|kubernetes|aws|azure|gcp|snowflake|databricks|salesforce|sap|servicenow|terraform|docker|hubspot|workday|oracle|jenkins|gitlab|ansible|palo alto|crowdstrike|datadog|new relic|grafana)`,
  'i'
);

// ── Simpler regex for broad tech mention detection ──

/** Matches any known technology keyword in text (case-insensitive) */
export const TECH_MENTION_REGEX = new RegExp(
  `\\b(${ALL_TECH_KEYWORDS.map(kw => kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`,
  'i'
);

// ── Platform competition groups for contradiction detection ──

export const COMPETING_PLATFORMS: Array<{ platforms: string[]; category: string }> = [
  { platforms: ['aws', 'amazon web services'], category: 'cloud' },
  { platforms: ['azure', 'microsoft azure'], category: 'cloud' },
  { platforms: ['gcp', 'google cloud', 'google cloud platform'], category: 'cloud' },
  { platforms: ['oracle cloud', 'oci'], category: 'cloud' },
  { platforms: ['salesforce', 'salesforce crm'], category: 'crm' },
  { platforms: ['hubspot', 'hubspot crm'], category: 'crm' },
  { platforms: ['sap', 'sap s/4hana'], category: 'erp' },
  { platforms: ['oracle', 'oracle erp'], category: 'erp' },
  { platforms: ['snowflake'], category: 'data' },
  { platforms: ['databricks'], category: 'data' },
  { platforms: ['kubernetes', 'k8s'], category: 'orchestration' },
  { platforms: ['docker', 'docker swarm'], category: 'orchestration' },
];

// ── Helper: Detect technology keywords in text ──

export interface TechDetectionResult {
  keywords: string[];
  categories: TechCategory[];
  hasActionVerb: boolean;
  matchedActionVerb: string | null;
  /** Combined confidence: higher when action verb + specific platform */
  confidence: number;
}

/**
 * Detect technology keywords and action verbs in text.
 * Returns structured result with categories and confidence score.
 */
export function detectTechInText(text: string): TechDetectionResult {
  const lower = text.toLowerCase();
  const keywords: string[] = [];
  const categories = new Set<TechCategory>();
  let matchedActionVerb: string | null = null;

  // Check action verbs first
  for (const verb of TECH_ACTION_VERBS) {
    if (lower.includes(verb.toLowerCase())) {
      matchedActionVerb = verb;
      break;
    }
  }

  // Check technology keywords
  for (const kw of ALL_TECH_KEYWORDS) {
    const kwLower = kw.toLowerCase();
    // Multi-word keywords need word boundary check
    if (kwLower.includes(' ')) {
      if (lower.includes(kwLower)) {
        keywords.push(kw);
        const cat = TECH_KEYWORD_TO_CATEGORY.get(kwLower);
        if (cat) categories.add(cat);
      }
    } else {
      // Single-word: use regex word boundary
      const regex = new RegExp(`\\b${kwLower}\\b`);
      if (regex.test(lower)) {
        keywords.push(kw);
        const cat = TECH_KEYWORD_TO_CATEGORY.get(kwLower);
        if (cat) categories.add(cat);
      }
    }
  }

  // Compute confidence
  let confidence = 0;
  if (keywords.length > 0) confidence += 0.3;
  if (keywords.length >= 3) confidence += 0.2;
  if (matchedActionVerb) confidence += 0.3;
  if (categories.size > 1) confidence += 0.1;
  if (keywords.some(k => ['snowflake', 'databricks', 'kubernetes', 'terraform', 'servicenow'].includes(k.toLowerCase()))) {
    confidence += 0.1; // Specific enterprise tech boost
  }

  return {
    keywords: [...new Set(keywords)],
    categories: [...categories],
    hasActionVerb: matchedActionVerb !== null,
    matchedActionVerb,
    confidence: Math.min(1, confidence),
  };
}
