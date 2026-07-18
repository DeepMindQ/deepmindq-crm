import { NextResponse } from 'next/server';

/**
 * POST /api/g-data/config/seed
 *
 * Seeds default Data Intelligence configuration rules.
 * Safe to run multiple times (uses upsert).
 * Can be triggered from Settings UI or called on first deploy.
 */
export async function POST() {
  try {
    // Dynamic import to avoid circular deps and keep this handler thin
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();

    // Check if already seeded
    const existingRules = await prisma.columnMappingRule.count();
    if (existingRules > 0) {
      await prisma.$disconnect();
      return NextResponse.json({
        success: true,
        message: 'Already seeded — rules exist. Delete all rules first to re-seed.',
        existingRules,
      });
    }

    // Import seed data
    const seedModule = await import('../../../../../../scripts/seed-data-intelligence');

    // Run the seed functions directly
    // Since the seed script uses PrismaClient directly, we'll run the SQL via prisma
    const results: Record<string, number> = {};

    // Column Mapping Rules (16 rules)
    const cmRules = [
      { id: 'seed-cm-name', name: 'Name variants', pattern: '^(name|fullname|contact.?name|person.?name|first.?name.?last.?name)$', targetField: 'name', priority: 10 },
      { id: 'seed-cm-email', name: 'Email variants', pattern: '^(email|e-?mail.?addr|mailto|email.?address)$', targetField: 'email', priority: 10 },
      { id: 'seed-cm-title', name: 'Title variants', pattern: '^(title|job.?title|role|position|designation|job.?role)$', targetField: 'title', priority: 10 },
      { id: 'seed-cm-phone', name: 'Phone variants', pattern: '^(phone|telephone|tel|mobile|phone.?number|contact.?number)$', targetField: 'phone', priority: 10 },
      { id: 'seed-cm-linkedin', name: 'LinkedIn variants', pattern: '^(linkedin|linkedin.?url|li.?url|linkedin.?profile)$', targetField: 'linkedin', priority: 10 },
      { id: 'seed-cm-company', name: 'Company name variants', pattern: '^(company|company.?name|organization|org|account|firm|employer|business.?name)$', targetField: 'company', priority: 10 },
      { id: 'seed-cm-industry', name: 'Industry variants', pattern: '^(industry|sector|vertical|business.?sector|industry.?vertical)$', targetField: 'industry', priority: 10 },
      { id: 'seed-cm-size', name: 'Size variants', pattern: '^(size|employees|employee.?count|staff|headcount|company.?size|no.?of.?employees|head.?count|num.?employees|total.?employees)$', targetField: 'size', priority: 10 },
      { id: 'seed-cm-website', name: 'Website variants', pattern: '^(website|url|web|site|homepage|company.?url|company.?website)$', targetField: 'website', priority: 10 },
      { id: 'seed-cm-domain', name: 'Domain variants', pattern: '^(domain|company.?domain|website.?domain|email.?domain)$', targetField: 'domain', priority: 10 },
      { id: 'seed-cm-revenue', name: 'Revenue variants', pattern: '^(revenue|annual.?revenue|company.?revenue|turnover|arr)$', targetField: 'revenue', priority: 10 },
      { id: 'seed-cm-funding', name: 'Funding variants', pattern: '^(funding|funding.?stage|investment.?stage|series|stage)$', targetField: 'funding', priority: 10 },
      { id: 'seed-cm-location', name: 'Location variants', pattern: '^(location|city|address|headquarters|hq)$', targetField: 'location', priority: 8 },
      { id: 'seed-cm-country', name: 'Country variants', pattern: '^(country|region|nation)$', targetField: 'country', priority: 8 },
      { id: 'seed-cm-state', name: 'State variants', pattern: '^(state|province|territory)$', targetField: 'state', priority: 5 },
      { id: 'seed-cm-zip', name: 'ZIP variants', pattern: '^(zip|zip.?code|postal|postal.?code)$', targetField: 'zip', priority: 5 },
    ];

    for (const rule of cmRules) {
      await prisma.columnMappingRule.upsert({
        where: { id: rule.id },
        update: rule,
        create: rule,
      });
    }
    results.columnRules = cmRules.length;

    // Validation Rules (12 rules)
    const vRules = [
      { id: 'seed-vr-email-when-no-name', name: 'Email required when no name', targetField: 'email', ruleType: 'required', config: '{"whenFields":["name"]}', severity: 'error', message: 'Email is required when name is empty', priority: 10 },
      { id: 'seed-vr-name-when-no-email', name: 'Name required when no email', targetField: 'name', ruleType: 'required', config: '{"whenFields":["email"]}', severity: 'error', message: 'Name is required when email is empty', priority: 10 },
      { id: 'seed-vr-email-format', name: 'Email format', targetField: 'email', ruleType: 'format', config: '{"format":"email"}', severity: 'error', message: 'Invalid email format', priority: 10 },
      { id: 'seed-vr-domain-format', name: 'Domain format', targetField: 'domain', ruleType: 'format', config: '{"format":"domain"}', severity: 'warning', message: 'Invalid domain format', priority: 5 },
      { id: 'seed-vr-website-format', name: 'URL format for website', targetField: 'website', ruleType: 'format', config: '{"format":"url"}', severity: 'warning', message: 'Website URL appears invalid', priority: 5 },
      { id: 'seed-vr-name-special', name: 'Name not only special chars', targetField: 'name', ruleType: 'custom', config: '{"customType":"no_special_chars_only"}', severity: 'warning', message: 'Name contains only special characters', priority: 8 },
      { id: 'seed-vr-name-words', name: 'Name minimum word count', targetField: 'name', ruleType: 'custom', config: '{"customType":"min_word_count","minWords":1}', severity: 'warning', message: 'Name may be incomplete (single word)', priority: 3 },
      { id: 'seed-vr-company-missing', name: 'Company name missing', targetField: 'company', ruleType: 'required', config: '{"whenFields":[]}', severity: 'warning', message: 'Company name is missing', priority: 5 },
      { id: 'seed-vr-size-range', name: 'Employee size range check', targetField: 'size', ruleType: 'regex', config: '{"pattern":"^(\\\\d{1,3}(,\\\\d{3})*\\\\+?|\\\\d+-\\\\d+(,\\\\d{3})*|\\\\d+)$"}', severity: 'warning', message: 'Employee size may need normalization', priority: 5 },
      { id: 'seed-vr-email-unique', name: 'Email uniqueness', targetField: 'email', ruleType: 'uniqueness', config: '{}', severity: 'error', message: 'Duplicate email address', priority: 10 },
      { id: 'seed-vr-domain-unique', name: 'Domain uniqueness', targetField: 'domain', ruleType: 'uniqueness', config: '{}', severity: 'warning', message: 'Duplicate domain in batch', priority: 5 },
      { id: 'seed-vr-phone-format', name: 'Phone format basic check', targetField: 'phone', ruleType: 'regex', config: '{"pattern":"^[+\\\\d\\\\s\\\\-().]{7,20}$"}', severity: 'warning', message: 'Phone number format looks unusual', priority: 3 },
    ];

    for (const rule of vRules) {
      await prisma.fieldValidationRule.upsert({
        where: { id: rule.id },
        update: rule,
        create: rule,
      });
    }
    results.validationRules = vRules.length;

    // Normalization Mappings - sample (full set in seed script)
    const normMappings = [
      // Industries
      { category: 'industry', sourceValue: 'banking', normalizedValue: 'Financial Services' },
      { category: 'industry', sourceValue: 'fintech', normalizedValue: 'Financial Technology' },
      { category: 'industry', sourceValue: 'health care', normalizedValue: 'Healthcare' },
      { category: 'industry', sourceValue: 'it', normalizedValue: 'Information Technology' },
      { category: 'industry', sourceValue: 'ecommerce', normalizedValue: 'E-Commerce' },
      { category: 'industry', sourceValue: 'biotech', normalizedValue: 'Biotechnology' },
      { category: 'industry', sourceValue: 'ai', normalizedValue: 'Artificial Intelligence' },
      { category: 'industry', sourceValue: 'cybersecurity', normalizedValue: 'Cybersecurity' },
      { category: 'industry', sourceValue: 'consulting', normalizedValue: 'Consulting' },
      { category: 'industry', sourceValue: 'real estate', normalizedValue: 'Real Estate' },
      // Countries
      { category: 'country', sourceValue: 'us', normalizedValue: 'United States' },
      { category: 'country', sourceValue: 'usa', normalizedValue: 'United States' },
      { category: 'country', sourceValue: 'uk', normalizedValue: 'United Kingdom' },
      { category: 'country', sourceValue: 'india', normalizedValue: 'India' },
      { category: 'country', sourceValue: 'uae', normalizedValue: 'United Arab Emirates' },
      // Sizes
      { category: 'employee_size', sourceValue: 'self-employed', normalizedValue: '1-10' },
      { category: 'employee_size', sourceValue: 'startup', normalizedValue: '1-10' },
      { category: 'employee_size', sourceValue: 'smb', normalizedValue: '11-50' },
      { category: 'employee_size', sourceValue: 'enterprise', normalizedValue: '1,001-5,000' },
    ];

    for (const m of normMappings) {
      await prisma.normalizationMapping.upsert({
        where: { category_sourceValue: { category: m.category, sourceValue: m.sourceValue } },
        update: { normalizedValue: m.normalizedValue },
        create: m,
      });
    }
    results.normalizationMappings = normMappings.length;

    // Scoring Weights
    const scoringWeights = [
      { dimension: 'data_quality', field: '', key: 'completeness', weight: 40, maxScore: 100, description: 'Fields filled' },
      { dimension: 'data_quality', field: '', key: 'validity', weight: 30, maxScore: 100, description: 'No errors' },
      { dimension: 'data_quality', field: '', key: 'richness', weight: 30, maxScore: 100, description: 'Data quality' },
      { dimension: 'role', field: '', key: 'c_level', weight: 25, maxScore: 25, description: 'C-level' },
      { dimension: 'role', field: '', key: 'vp', weight: 20, maxScore: 25, description: 'VP' },
      { dimension: 'role', field: '', key: 'director', weight: 20, maxScore: 25, description: 'Director' },
      { dimension: 'company_fit', field: 'industry', key: 'Technology', weight: 10, maxScore: 20, description: 'Tech industry' },
      { dimension: 'company_fit', field: 'industry', key: 'Financial Services', weight: 10, maxScore: 20, description: 'Finance' },
      { dimension: 'company_fit', field: 'industry', key: 'Healthcare', weight: 8, maxScore: 20, description: 'Healthcare' },
      { dimension: 'email_health', field: '', key: 'valid', weight: 15, maxScore: 15, description: 'Valid email' },
      { dimension: 'email_health', field: '', key: 'risky', weight: 8, maxScore: 15, description: 'Risky email' },
    ];

    for (const w of scoringWeights) {
      await prisma.scoringWeight.upsert({
        where: { dimension_field_key: { dimension: w.dimension, field: w.field, key: w.key } },
        update: { weight: w.weight, maxScore: w.maxScore, description: w.description },
        create: w,
      });
    }
    results.scoringWeights = scoringWeights.length;

    await prisma.$disconnect();

    return NextResponse.json({
      success: true,
      message: 'Data Intelligence configuration seeded',
      results,
    });
  } catch (error: any) {
    console.error('[config/seed]', error);
    return NextResponse.json({ error: 'Seed failed', detail: error.message }, { status: 500 });
  }
}