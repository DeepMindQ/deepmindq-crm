/**
 * Seed Data Intelligence Configuration
 *
 * Populates the database with default business rules:
 * - Column mapping patterns (14 rules)
 * - Field validation rules (12 rules)
 * - Normalization mappings (80+ rules for industry, country, size)
 * - Scoring weights (6 dimensions)
 *
 * Run via: node scripts/seed-data-intelligence.ts
 * Or call via API: POST /api/g-system/seed-data-intelligence
 *
 * These defaults make the system operational immediately.
 * Admin can modify, add, or remove any rule from Settings > Data Rules.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedColumnMappingRules() {
  const rules = [
    // Contact fields
    { name: 'Name variants', pattern: '^(name|fullname|contact.?name|person.?name|first.?name.?last.?name)$', targetField: 'name', priority: 10 },
    { name: 'Email variants', pattern: '^(email|e-?mail.?addr|mailto|email.?address)$', targetField: 'email', priority: 10 },
    { name: 'Title variants', pattern: '^(title|job.?title|role|position|designation|job.?role)$', targetField: 'title', priority: 10 },
    { name: 'Phone variants', pattern: '^(phone|telephone|tel|mobile|phone.?number|contact.?number)$', targetField: 'phone', priority: 10 },
    { name: 'LinkedIn variants', pattern: '^(linkedin|linkedin.?url|li.?url|linkedin.?profile)$', targetField: 'linkedin', priority: 10 },

    // Company fields
    { name: 'Company name variants', pattern: '^(company|company.?name|organization|org|account|firm|employer|business.?name)$', targetField: 'company', priority: 10 },
    { name: 'Industry variants', pattern: '^(industry|sector|vertical|business.?sector|industry.?vertical)$', targetField: 'industry', priority: 10 },
    { name: 'Size variants', pattern: '^(size|employees|employee.?count|staff|headcount|company.?size|no.?of.?employees|head.?count|num.?employees|total.?employees)$', targetField: 'size', priority: 10 },
    { name: 'Website variants', pattern: '^(website|url|web|site|homepage|company.?url|company.?website)$', targetField: 'website', priority: 10 },
    { name: 'Domain variants', pattern: '^(domain|company.?domain|website.?domain|email.?domain)$', targetField: 'domain', priority: 10 },
    { name: 'Revenue variants', pattern: '^(revenue|annual.?revenue|company.?revenue|turnover|arr)$', targetField: 'revenue', priority: 10 },
    { name: 'Funding variants', pattern: '^(funding|funding.?stage|investment.?stage|series|stage)$', targetField: 'funding', priority: 10 },

    // Location fields
    { name: 'Location variants', pattern: '^(location|city|address|headquarters|hq)$', targetField: 'location', priority: 8 },
    { name: 'Country variants', pattern: '^(country|region|nation)$', targetField: 'country', priority: 8 },
    { name: 'State variants', pattern: '^(state|province|region|territory)$', targetField: 'state', priority: 5 },
    { name: 'ZIP variants', pattern: '^(zip|zip.?code|postal|postal.?code)$', targetField: 'zip', priority: 5 },
  ];

  console.log(`Seeding ${rules.length} column mapping rules...`);

  for (const rule of rules) {
    await prisma.columnMappingRule.upsert({
      where: { id: `seed-cm-${rule.targetField}` },
      update: rule,
      create: { id: `seed-cm-${rule.targetField}`, ...rule },
    });
  }
}

async function seedValidationRules() {
  const rules = [
    {
      name: 'Email required when no name',
      targetField: 'email',
      ruleType: 'required',
      config: JSON.stringify({ whenFields: ['name'] }),
      severity: 'error',
      message: 'Email is required when name is empty',
      priority: 10,
    },
    {
      name: 'Name required when no email',
      targetField: 'name',
      ruleType: 'required',
      config: JSON.stringify({ whenFields: ['email'] }),
      severity: 'error',
      message: 'Name is required when email is empty',
      priority: 10,
    },
    {
      name: 'Email format',
      targetField: 'email',
      ruleType: 'format',
      config: JSON.stringify({ format: 'email' }),
      severity: 'error',
      message: 'Invalid email format',
      priority: 10,
    },
    {
      name: 'Domain format',
      targetField: 'domain',
      ruleType: 'format',
      config: JSON.stringify({ format: 'domain' }),
      severity: 'warning',
      message: 'Invalid domain format',
      priority: 5,
    },
    {
      name: 'URL format for website',
      targetField: 'website',
      ruleType: 'format',
      config: JSON.stringify({ format: 'url' }),
      severity: 'warning',
      message: 'Website URL appears invalid',
      priority: 5,
    },
    {
      name: 'Name not only special chars',
      targetField: 'name',
      ruleType: 'custom',
      config: JSON.stringify({ customType: 'no_special_chars_only' }),
      severity: 'warning',
      message: 'Name appears to contain only special characters',
      priority: 8,
    },
    {
      name: 'Name minimum word count',
      targetField: 'name',
      ruleType: 'custom',
      config: JSON.stringify({ customType: 'min_word_count', minWords: 1 }),
      severity: 'warning',
      message: 'Name may be incomplete (single word)',
      priority: 3,
    },
    {
      name: 'Company name not empty when available',
      targetField: 'company',
      ruleType: 'required',
      config: JSON.stringify({ whenFields: [] }),
      severity: 'warning',
      message: 'Company name is missing — contacts without companies have limited value',
      priority: 5,
    },
    {
      name: 'Employee size range check',
      targetField: 'size',
      ruleType: 'regex',
      config: JSON.stringify({ pattern: '^(\\d{1,3}(,\\d{3})*\\+?|\\d+-\\d+(,\\d{3})*|\\d+)$' }),
      severity: 'warning',
      message: 'Employee size value may need normalization (e.g., "45566" → range)',
      priority: 5,
    },
    {
      name: 'Email uniqueness',
      targetField: 'email',
      ruleType: 'uniqueness',
      config: JSON.stringify({}),
      severity: 'error',
      message: 'Duplicate email address',
      priority: 10,
    },
    {
      name: 'Domain uniqueness',
      targetField: 'domain',
      ruleType: 'uniqueness',
      config: JSON.stringify({}),
      severity: 'warning',
      message: 'Duplicate domain in batch',
      priority: 5,
    },
    {
      name: 'Phone format basic check',
      targetField: 'phone',
      ruleType: 'regex',
      config: JSON.stringify({ pattern: '^[+\\d\\s\\-().]{7,20}$' }),
      severity: 'warning',
      message: 'Phone number format looks unusual',
      priority: 3,
    },
  ];

  console.log(`Seeding ${rules.length} validation rules...`);

  for (const rule of rules) {
    await prisma.fieldValidationRule.upsert({
      where: { id: `seed-vr-${rule.targetField}-${rule.name.replace(/\s/g, '-').toLowerCase()}` },
      update: rule,
      create: { id: `seed-vr-${rule.targetField}-${rule.name.replace(/\s/g, '-').toLowerCase()}`, ...rule },
    });
  }
}

async function seedNormalizationMappings() {
  // Industry mappings
  const industries = [
    ['banking', 'Financial Services'],
    ['finance', 'Financial Services'],
    ['financial services', 'Financial Services'],
    ['fintech', 'Financial Technology'],
    ['fin tech', 'Financial Technology'],
    ['health care', 'Healthcare'],
    ['healthcare', 'Healthcare'],
    ['health', 'Healthcare'],
    ['medical', 'Healthcare'],
    ['pharma', 'Pharmaceuticals'],
    ['pharmaceutical', 'Pharmaceuticals'],
    ['biotech', 'Biotechnology'],
    ['biotechnology', 'Biotechnology'],
    ['it', 'Information Technology'],
    ['i.t.', 'Information Technology'],
    ['information technology', 'Information Technology'],
    ['tech', 'Technology'],
    ['technology', 'Technology'],
    ['software', 'Software'],
    ['saas', 'SaaS'],
    ['paas', 'PaaS'],
    ['iaas', 'IaaS'],
    ['ecommerce', 'E-Commerce'],
    ['e-commerce', 'E-Commerce'],
    ['e commerce', 'E-Commerce'],
    ['retail', 'Retail'],
    ['manufacturing', 'Manufacturing'],
    ['manufacturing', 'Manufacturing'],
    ['consulting', 'Consulting'],
    ['consultancy', 'Consulting'],
    ['real estate', 'Real Estate'],
    ['realestate', 'Real Estate'],
    ['construction', 'Construction'],
    ['education', 'Education'],
    ['edtech', 'Education Technology'],
    ['legal', 'Legal'],
    ['law', 'Legal'],
    ['logistics', 'Logistics'],
    ['supply chain', 'Supply Chain'],
    ['telecom', 'Telecommunications'],
    ['telecommunications', 'Telecommunications'],
    ['telecommunications', 'Telecommunications'],
    ['media', 'Media'],
    ['entertainment', 'Entertainment'],
    ['gaming', 'Gaming'],
    ['hospitality', 'Hospitality'],
    ['travel', 'Travel & Tourism'],
    ['tourism', 'Travel & Tourism'],
    ['automotive', 'Automotive'],
    ['automobile', 'Automotive'],
    ['energy', 'Energy'],
    ['oil & gas', 'Oil & Gas'],
    ['renewable energy', 'Renewable Energy'],
    ['solar', 'Renewable Energy'],
    ['agriculture', 'Agriculture'],
    ['aerospace', 'Aerospace & Defense'],
    ['defense', 'Aerospace & Defense'],
    ['government', 'Government'],
    ['nonprofit', 'Non-Profit'],
    ['non-profit', 'Non-Profit'],
    ['ngo', 'Non-Profit'],
    ['insurance', 'Insurance'],
    ['accounting', 'Accounting'],
    ['marketing', 'Marketing & Advertising'],
    ['advertising', 'Marketing & Advertising'],
    ['hr', 'Human Resources'],
    ['human resources', 'Human Resources'],
    ['recruiting', 'Recruiting & Staffing'],
    ['staffing', 'Recruiting & Staffing'],
    ['security', 'Security'],
    ['cybersecurity', 'Cybersecurity'],
    ['ai', 'Artificial Intelligence'],
    ['artificial intelligence', 'Artificial Intelligence'],
    ['machine learning', 'Artificial Intelligence'],
    ['ml', 'Artificial Intelligence'],
    ['blockchain', 'Blockchain'],
    ['crypto', 'Cryptocurrency'],
    ['cryptocurrency', 'Cryptocurrency'],
    ['web3', 'Web3'],
    ['data', 'Data & Analytics'],
    ['analytics', 'Data & Analytics'],
    ['design', 'Design'],
    ['architecture', 'Architecture'],
    ['engineering', 'Engineering'],
  ];

  // Country mappings
  const countries = [
    ['us', 'United States'],
    ['usa', 'United States'],
    ['u.s.a.', 'United States'],
    ['u.s.', 'United States'],
    ['united states of america', 'United States'],
    ['united states', 'United States'],
    ['uk', 'United Kingdom'],
    ['gb', 'United Kingdom'],
    ['great britain', 'United Kingdom'],
    ['england', 'United Kingdom'],
    ['united kingdom', 'United Kingdom'],
    ['india', 'India'],
    ['in', 'India'],
    ['canada', 'Canada'],
    ['ca', 'Canada'],
    ['australia', 'Australia'],
    ['au', 'Australia'],
    ['germany', 'Germany'],
    ['de', 'Germany'],
    ['deutschland', 'Germany'],
    ['france', 'France'],
    ['fr', 'France'],
    ['japan', 'Japan'],
    ['jp', 'Japan'],
    ['china', 'China'],
    ['cn', 'China'],
    ['singapore', 'Singapore'],
    ['sg', 'Singapore'],
    ['uae', 'United Arab Emirates'],
    ['dubai', 'United Arab Emirates'],
    ['united arab emirates', 'United Arab Emirates'],
    ['netherlands', 'Netherlands'],
    ['nl', 'Netherlands'],
    ['holland', 'Netherlands'],
    ['brazil', 'Brazil'],
    ['br', 'Brazil'],
    ['mexico', 'Mexico'],
    ['south korea', 'South Korea'],
    ['korea', 'South Korea'],
    ['italy', 'Italy'],
    ['spain', 'Spain'],
    ['sweden', 'Sweden'],
    ['norway', 'Norway'],
    ['denmark', 'Denmark'],
    ['finland', 'Finland'],
    ['ireland', 'Ireland'],
    ['switzerland', 'Switzerland'],
    ['israel', 'Israel'],
    ['south africa', 'South Africa'],
    ['nigeria', 'Nigeria'],
    ['kenya', 'Kenya'],
    ['philippines', 'Philippines'],
    ['vietnam', 'Vietnam'],
    ['thailand', 'Thailand'],
    ['indonesia', 'Indonesia'],
    ['malaysia', 'Malaysia'],
    ['poland', 'Poland'],
    ['czech republic', 'Czech Republic'],
    ['czechia', 'Czech Republic'],
    ['portugal', 'Portugal'],
    ['belgium', 'Belgium'],
    ['austria', 'Austria'],
    ['new zealand', 'New Zealand'],
    ['nz', 'New Zealand'],
  ];

  // Employee size mappings (for common raw formats)
  const sizes = [
    ['1-10', '1-10'],
    ['1 to 10', '1-10'],
    ['11-50', '11-50'],
    ['11 to 50', '11-50'],
    ['51-200', '51-200'],
    ['51 to 200', '51-200'],
    ['201-500', '201-500'],
    ['201 to 500', '201-500'],
    ['501-1000', '501-1,000'],
    ['501-1,000', '501-1,000'],
    ['501 to 1000', '501-1,000'],
    ['1001-5000', '1,001-5,000'],
    ['1,001-5,000', '1,001-5,000'],
    ['1001 to 5000', '1,001-5,000'],
    ['5001-10000', '5,001-10,000'],
    ['5,001-10,000', '5,001-10,000'],
    ['10001+', '10,001+'],
    ['10,001+', '10,001+'],
    ['10000+', '10,001+'],
    ['self-employed', '1-10'],
    ['sole proprietor', '1-10'],
    ['freelancer', '1-10'],
    ['startup', '1-10'],
    ['small business', '11-50'],
    ['smb', '11-50'],
    ['sme', '51-200'],
    ['mid-market', '201-500'],
    ['midmarket', '201-500'],
    ['enterprise', '1,001-5,000'],
    ['large enterprise', '5,001-10,000'],
    ['mega', '10,001+'],
  ];

  const allMappings: Array<{ category: string; sourceValue: string; normalizedValue: string }> = [
    ...industries.map(([s, n]) => ({ category: 'industry', sourceValue: s, normalizedValue: n })),
    ...countries.map(([s, n]) => ({ category: 'country', sourceValue: s, normalizedValue: n })),
    ...sizes.map(([s, n]) => ({ category: 'employee_size', sourceValue: s, normalizedValue: n })),
  ];

  console.log(`Seeding ${allMappings.length} normalization mappings...`);

  for (const m of allMappings) {
    await prisma.normalizationMapping.upsert({
      where: {
        category_sourceValue: {
          category: m.category,
          sourceValue: m.sourceValue,
        },
      },
      update: { normalizedValue: m.normalizedValue },
      create: m,
    });
  }
}

async function seedScoringWeights() {
  const weights = [
    // Data quality dimension weights
    { dimension: 'data_quality', field: null, key: 'completeness', weight: 40, maxScore: 100, description: 'How many fields are filled' },
    { dimension: 'data_quality', field: null, key: 'validity', weight: 30, maxScore: 100, description: 'No validation errors' },
    { dimension: 'data_quality', field: null, key: 'richness', weight: 30, maxScore: 100, description: 'Quality of available data' },

    // Lead scoring: Role dimension
    { dimension: 'role', field: null, key: 'c_level', weight: 25, maxScore: 25, description: 'C-level executives' },
    { dimension: 'role', field: null, key: 'vp', weight: 20, maxScore: 25, description: 'Vice Presidents' },
    { dimension: 'role', field: null, key: 'director', weight: 20, maxScore: 25, description: 'Directors' },
    { dimension: 'role', field: null, key: 'manager', weight: 15, maxScore: 25, description: 'Managers' },
    { dimension: 'role', field: null, key: 'senior', weight: 10, maxScore: 25, description: 'Senior individual contributors' },
    { dimension: 'role', field: null, key: 'other', weight: 5, maxScore: 25, description: 'Other roles' },

    // Lead scoring: Company Fit dimension
    { dimension: 'company_fit', field: 'industry', key: 'Technology', weight: 10, maxScore: 20, description: 'Technology industry match' },
    { dimension: 'company_fit', field: 'industry', key: 'Financial Services', weight: 10, maxScore: 20, description: 'Financial Services match' },
    { dimension: 'company_fit', field: 'industry', key: 'Healthcare', weight: 8, maxScore: 20, description: 'Healthcare match' },
    { dimension: 'company_fit', field: 'industry', key: 'SaaS', weight: 10, maxScore: 20, description: 'SaaS match' },
    { dimension: 'company_fit', field: 'industry', key: 'E-Commerce', weight: 8, maxScore: 20, description: 'E-Commerce match' },
    { dimension: 'company_fit', field: 'industry', key: 'any_known', weight: 5, maxScore: 20, description: 'Any known industry' },
    { dimension: 'company_fit', field: 'company_size', key: 'mid_market', weight: 5, maxScore: 20, description: 'Mid-market company' },
    { dimension: 'company_fit', field: 'company_size', key: 'enterprise', weight: 5, maxScore: 20, description: 'Enterprise company' },
    { dimension: 'company_fit', field: 'has_research', key: 'true', weight: 5, maxScore: 20, description: 'Has enrichment data' },

    // Lead scoring: Email Health
    { dimension: 'email_health', field: null, key: 'valid', weight: 15, maxScore: 15, description: 'Valid email' },
    { dimension: 'email_health', field: null, key: 'risky', weight: 8, maxScore: 15, description: 'Risky email' },
    { dimension: 'email_health', field: null, key: 'unknown', weight: 0, maxScore: 15, description: 'Unknown email health' },

    // Lead scoring: Data Completeness
    { dimension: 'data_completeness', field: null, key: 'title', weight: 3, maxScore: 15, description: 'Has job title' },
    { dimension: 'data_completeness', field: null, key: 'phone', weight: 3, maxScore: 15, description: 'Has phone' },
    { dimension: 'data_completeness', field: null, key: 'linkedin', weight: 3, maxScore: 15, description: 'Has LinkedIn' },
    { dimension: 'data_completeness', field: null, key: 'location', weight: 3, maxScore: 15, description: 'Has location' },
    { dimension: 'data_completeness', field: null, key: 'industry', weight: 3, maxScore: 15, description: 'Has industry' },

    // Engagement and Enrichment are event-driven, not configurable per-key
    { dimension: 'engagement', field: null, key: 'opened', weight: 5, maxScore: 15, description: 'Email opened' },
    { dimension: 'engagement', field: null, key: 'clicked', weight: 5, maxScore: 15, description: 'Link clicked' },
    { dimension: 'engagement', field: null, key: 'replied', weight: 5, maxScore: 15, description: 'Email replied' },

    { dimension: 'enrichment', field: null, key: 'has_enrichment', weight: 10, maxScore: 10, description: 'Has enrichment data' },
  ];

  console.log(`Seeding ${weights.length} scoring weights...`);

  for (const w of weights) {
    await prisma.scoringWeight.upsert({
      where: {
        dimension_field_key: {
          dimension: w.dimension,
          field: w.field ?? '',
          key: w.key ?? '',
        },
      },
      update: { weight: w.weight, maxScore: w.maxScore, description: w.description },
      create: w,
    });
  }
}

// ── Main ──

async function main() {
  console.log('=== Seeding Data Intelligence Configuration ===\n');

  try {
    await seedColumnMappingRules();
    console.log('  Column mapping rules: done\n');

    await seedValidationRules();
    console.log('  Validation rules: done\n');

    await seedNormalizationMappings();
    console.log('  Normalization mappings: done\n');

    await seedScoringWeights();
    console.log('  Scoring weights: done\n');

    console.log('=== Seed complete ===');
  } catch (error) {
    console.error('Seed failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();