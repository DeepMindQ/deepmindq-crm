/**
 * Ticket 11 — Data Intelligence Import Pipeline
 *
 * Six-phase import pipeline for CSV/Excel data:
 *   1. Create DataUpload record
 *   2. Auto-map columns via ColumnMappingRule regex patterns
 *   3. Validate rows via FieldValidationRule
 *   4. Normalize values via NormalizationMapping
 *   5. Compute per-row DataQualityScore
 *   6. Commit — create Company & Contact records
 *
 * Part of the DeepMindQ Intelligence Platform.
 */

import { db } from '@/lib/db';
import { activateIntelligenceBatch } from '@/lib/intelligence-activation';

// ─── Exported Interfaces ──────────────────────────────────────────

export interface ValidationIssue {
  field: string;
  ruleId: string;
  severity: string;
  message: string;
}

export interface SuggestedCorrection {
  field: string;
  original: string;
  suggested: string;
  ruleId: string;
}

export interface AppliedCorrection {
  field: string;
  original: string;
  applied: string;
}

export interface ValidationResult {
  rowIndex: number;
  issues: ValidationIssue[];
  suggestedCorrections: SuggestedCorrection[];
  status: 'pending' | 'warning' | 'failed';
}

export interface NormalizationResult {
  rowIndex: number;
  normalizedData: Record<string, string>;
  appliedCorrections: AppliedCorrection[];
}

export interface CommitResult {
  companiesCreated: number;
  contactsCreated: number;
  duplicatesSkipped: number;
  failedRows: number;
}

// ─── Phase 1: Create Upload Record ───────────────────────────────

/**
 * Create a new DataUpload record with the given file metadata.
 *
 * @param input - File name, total row count, and optional consent/lead source.
 * @returns The created DataUpload record.
 */
export async function createDataUpload(input: {
  fileName: string;
  totalRows: number;
  consentSource?: string;
  leadSource?: string;
}): Promise<import('@prisma/client').DataUpload> {
  return db.dataUpload.create({
    data: {
      fileName: input.fileName,
      totalRows: input.totalRows,
      columnMapping: '{}',
      consentSource: input.consentSource ?? 'manual_upload',
      leadSource: input.leadSource ?? 'manual',
      status: 'created',
    },
  });
}

// ─── Phase 2: Auto-Map Columns ───────────────────────────────────

/**
 * Auto-map CSV column headers to internal target fields using
 * ColumnMappingRule regex patterns from the database.
 *
 * Rules are sorted by priority (descending) and checked in order.
 * First match wins per header. Case-insensitive matching.
 *
 * @param uploadId - The DataUpload id (used for logging context).
 * @param headers - Array of column header strings from the file.
 * @returns A mapping of { sourceHeader: targetField }.
 */
export async function autoMapColumns(
  uploadId: string,
  headers: string[],
): Promise<Record<string, string>> {
  const rules = await db.columnMappingRule.findMany({
    where: { isActive: true },
    orderBy: { priority: 'desc' },
  });

  const mapping: Record<string, string> = {};
  const usedTargets = new Set<string>();

  for (const header of headers) {
    for (const rule of rules) {
      // Skip if this target field is already mapped to another header
      if (usedTargets.has(rule.targetField)) continue;

      try {
        const regex = new RegExp(rule.pattern, 'i');
        if (regex.test(header)) {
          mapping[header] = rule.targetField;
          usedTargets.add(rule.targetField);
          break;
        }
      } catch {
        // Invalid regex pattern — skip this rule
        continue;
      }
    }
  }

  // Persist mapping on the DataUpload record
  await db.dataUpload.update({
    where: { id: uploadId },
    data: { columnMapping: JSON.stringify(mapping) },
  });

  return mapping;
}

// ─── Phase 3: Validate Rows ──────────────────────────────────────

/**
 * Validate mapped rows using FieldValidationRule from the database.
 *
 * Rule types:
 *   - required: field must be non-empty
 *   - regex: field must match a regex pattern from config
 *   - format: field must match a known format (email, url, phone)
 *   - range: numeric value must be within min/max from config
 *   - uniqueness: field value must be unique across all rows
 *
 * @param uploadId - The DataUpload id.
 * @param mappedRows - Array of mapped row objects (targetField → value).
 * @returns Array of validation results per row.
 */
export async function validateRows(
  uploadId: string,
  mappedRows: Record<string, string>[],
): Promise<ValidationResult[]> {
  const rules = await db.fieldValidationRule.findMany({
    where: { isActive: true },
    orderBy: { priority: 'desc' },
  });

  // Build uniqueness trackers
  const uniquenessTrackers: Record<string, Map<string, number[]>> = {};
  for (const rule of rules) {
    if (rule.ruleType === 'uniqueness') {
      uniquenessTrackers[rule.targetField] = new Map();
    }
  }

  // First pass: build uniqueness index
  for (let i = 0; i < mappedRows.length; i++) {
    for (const field of Object.keys(uniquenessTrackers)) {
      const val = (mappedRows[i][field] ?? '').trim();
      if (val) {
        if (!uniquenessTrackers[field].has(val)) {
          uniquenessTrackers[field].set(val, []);
        }
        uniquenessTrackers[field].get(val)!.push(i);
      }
    }
  }

  const results: ValidationResult[] = [];

  for (let rowIndex = 0; rowIndex < mappedRows.length; rowIndex++) {
    const row = mappedRows[rowIndex];
    const issues: ValidationIssue[] = [];
    const suggestedCorrections: SuggestedCorrection[] = [];

    for (const rule of rules) {
      const value = (row[rule.targetField] ?? '').trim();
      let config: Record<string, unknown> = {};
      try {
        config = JSON.parse(rule.config);
      } catch {
        // keep default empty config
      }

      switch (rule.ruleType) {
        case 'required': {
          if (!value) {
            issues.push({
              field: rule.targetField,
              ruleId: rule.id,
              severity: rule.severity,
              message: rule.message,
            });
          }
          break;
        }

        case 'regex': {
          if (value && config.pattern) {
            try {
              const regex = new RegExp(config.pattern as string, 'i');
              if (!regex.test(value)) {
                issues.push({
                  field: rule.targetField,
                  ruleId: rule.id,
                  severity: rule.severity,
                  message: rule.message,
                });
              }
            } catch {
              // Invalid regex in config — skip
            }
          }
          break;
        }

        case 'format': {
          if (value && config.format) {
            const format = config.format as string;
            let isValid = true;
            if (format === 'email') {
              isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
            } else if (format === 'url') {
              try { new URL(value); } catch { isValid = false; }
            } else if (format === 'phone') {
              isValid = /^[+]?[\d\s()-]{7,20}$/.test(value);
            }
            if (!isValid) {
              issues.push({
                field: rule.targetField,
                ruleId: rule.id,
                severity: rule.severity,
                message: rule.message,
              });
            }
          }
          break;
        }

        case 'range': {
          if (value) {
            const num = parseFloat(value);
            if (Number.isFinite(num)) {
              const min = config.min as number | undefined;
              const max = config.max as number | undefined;
              if (min !== undefined && num < min) {
                issues.push({
                  field: rule.targetField,
                  ruleId: rule.id,
                  severity: rule.severity,
                  message: rule.message,
                });
              }
              if (max !== undefined && num > max) {
                issues.push({
                  field: rule.targetField,
                  ruleId: rule.id,
                  severity: rule.severity,
                  message: rule.message,
                });
              }
            }
          }
          break;
        }

        case 'uniqueness': {
          if (value) {
            const tracker = uniquenessTrackers[rule.targetField];
            if (tracker && tracker.get(value) && tracker.get(value)!.length > 1) {
              issues.push({
                field: rule.targetField,
                ruleId: rule.id,
                severity: rule.severity,
                message: rule.message,
              });
            }
          }
          break;
        }
      }
    }

    const hasErrors = issues.some((i) => i.severity === 'error');
    const hasWarnings = issues.some((i) => i.severity === 'warning');

    results.push({
      rowIndex,
      issues,
      suggestedCorrections,
      status: hasErrors ? 'failed' : hasWarnings ? 'warning' : 'pending',
    });
  }

  // Update UploadRow records with validation results
  for (const result of results) {
    await db.uploadRow.updateMany({
      where: { uploadId, rowIndex: result.rowIndex },
      data: {
        validationIssues: JSON.stringify(result.issues),
        suggestedCorrections: JSON.stringify(result.suggestedCorrections),
        status: result.status,
      },
    });
  }

  // Update DataUpload counts
  const failedCount = results.filter((r) => r.status === 'failed').length;
  const warningCount = results.filter((r) => r.status === 'warning').length;
  await db.dataUpload.update({
    where: { id: uploadId },
    data: {
      failedRows: failedCount,
      warningRows: warningCount,
    },
  });

  return results;
}

// ─── Phase 4: Normalize Values ──────────────────────────────────

/**
 * Normalize row values using NormalizationMapping from the database.
 *
 * Categories: industry, country, employee_size, title.
 * For each field in a row, looks up the source value in the
 * NormalizationMapping table (by category + sourceValue).
 *
 * @param uploadId - The DataUpload id.
 * @param mappedRows - Array of mapped row objects.
 * @returns Array of normalization results per row.
 */
export async function normalizeRows(
  uploadId: string,
  mappedRows: Record<string, string>[],
): Promise<NormalizationResult[]> {
  // Determine which categories we need
  const fieldToCategory: Record<string, string> = {
    industry: 'industry',
    country: 'country',
    employee_size: 'employee_size',
    sizeRange: 'employee_size',
    title: 'title',
    role: 'title',
  };

  const neededCategories = new Set<string>();
  for (const row of mappedRows) {
    for (const field of Object.keys(row)) {
      const cat = fieldToCategory[field];
      if (cat) neededCategories.add(cat);
    }
  }

  // Fetch all normalization mappings for needed categories
  const mappings = await db.normalizationMapping.findMany({
    where: {
      category: { in: Array.from(neededCategories) },
      isActive: true,
    },
  });

  // Build lookup: category → sourceValue → normalizedValue
  const lookup: Record<string, Record<string, string>> = {};
  for (const m of mappings) {
    if (!lookup[m.category]) lookup[m.category] = {};
    lookup[m.category][m.sourceValue] = m.normalizedValue;
  }

  const results: NormalizationResult[] = [];

  for (let rowIndex = 0; rowIndex < mappedRows.length; rowIndex++) {
    const row = mappedRows[rowIndex];
    const normalizedData: Record<string, string> = { ...row };
    const appliedCorrections: AppliedCorrection[] = [];

    for (const [field, value] of Object.entries(row)) {
      const cat = fieldToCategory[field];
      if (!cat || !value) continue;

      // Try exact match first
      const trimmedVal = value.trim();
      const catLookup = lookup[cat];
      if (catLookup && catLookup[trimmedVal]) {
        const normalized = catLookup[trimmedVal];
        if (normalized !== trimmedVal) {
          appliedCorrections.push({
            field,
            original: trimmedVal,
            applied: normalized,
          });
          normalizedData[field] = normalized;
        }
      }
      // Try case-insensitive match
      else if (catLookup) {
        const key = Object.keys(catLookup).find(
          (k) => k.toLowerCase() === trimmedVal.toLowerCase(),
        );
        if (key && catLookup[key] !== trimmedVal) {
          const normalized = catLookup[key];
          appliedCorrections.push({
            field,
            original: trimmedVal,
            applied: normalized,
          });
          normalizedData[field] = normalized;
        }
      }
    }

    results.push({ rowIndex, normalizedData, appliedCorrections });

    // Create NormalizationLog entries for every transformation
    for (const corr of appliedCorrections) {
      await db.normalizationLog.create({
        data: {
          uploadId,
          rowIndex,
          category: fieldToCategory[corr.field] ?? corr.field,
          field: corr.field,
          originalValue: corr.original,
          normalizedValue: corr.applied,
          ruleApplied: 'NormalizationMapping',
        },
      });
    }

    // Update the UploadRow record
    await db.uploadRow.updateMany({
      where: { uploadId, rowIndex },
      data: {
        normalizedData: JSON.stringify(normalizedData),
        appliedCorrections: JSON.stringify(appliedCorrections),
      },
    });
  }

  return results;
}

// ─── Phase 5: Compute Quality Scores ─────────────────────────────

/**
 * Compute per-row DataQualityScore based on three dimensions:
 *   - completenessScore: % of key fields that are non-empty
 *   - validityScore: 100 if no validation errors, reduced by error count
 *   - richnessScore: based on how many optional fields are populated
 *   - totalScore: weighted average (completeness 40%, validity 35%, richness 25%)
 *
 * Key fields: name, email, company
 * Optional fields: title, phone, location, industry, country, website
 *
 * @param uploadId - The DataUpload id.
 * @param rows - The UploadRow records (with parsed validationIssues).
 * @returns Array of created DataQualityScore records.
 */
export async function computeQualityScores(
  uploadId: string,
  rows: import('@prisma/client').UploadRow[],
): Promise<import('@prisma/client').DataQualityScore[]> {
  const KEY_FIELDS = ['name', 'email', 'company'];
  const OPTIONAL_FIELDS = ['title', 'phone', 'location', 'industry', 'country', 'website'];

  const scores: import('@prisma/client').DataQualityScore[] = [];

  for (const row of rows) {
    let mappedData: Record<string, string> = {};
    try {
      mappedData = row.mappedData
        ? JSON.parse(row.mappedData)
        : {};
    } catch {
      mappedData = {};
    }

    let issues: ValidationIssue[] = [];
    try {
      issues = row.validationIssues
        ? JSON.parse(row.validationIssues)
        : [];
    } catch {
      issues = [];
    }

    // Completeness: % of key fields populated
    const populatedKeyFields = KEY_FIELDS.filter(
      (f) => mappedData[f] && mappedData[f].trim(),
    ).length;
    const completenessScore = Math.round(
      (populatedKeyFields / KEY_FIELDS.length) * 100,
    );

    // Validity: 100 minus error penalties (10 per error, min 0)
    const errorCount = issues.filter((i) => i.severity === 'error').length;
    const validityScore = Math.max(0, 100 - errorCount * 10);

    // Richness: % of optional fields populated
    const populatedOptional = OPTIONAL_FIELDS.filter(
      (f) => mappedData[f] && mappedData[f].trim(),
    ).length;
    const richnessScore = Math.round(
      (populatedOptional / OPTIONAL_FIELDS.length) * 100,
    );

    // Total: weighted average
    const totalScore = Math.round(
      completenessScore * 0.4 + validityScore * 0.35 + richnessScore * 0.25,
    );

    const details = [
      `Completeness: ${completenessScore}/100 (${populatedKeyFields}/${KEY_FIELDS.length} key fields)`,
      `Validity: ${validityScore}/100 (${errorCount} errors)`,
      `Richness: ${richnessScore}/100 (${populatedOptional}/${OPTIONAL_FIELDS.length} optional fields)`,
    ];

    const scoreRecord = await db.dataQualityScore.create({
      data: {
        uploadId,
        uploadRowId: row.id,
        rowIndex: row.rowIndex,
        totalScore,
        completenessScore,
        validityScore,
        richnessScore,
        details: JSON.stringify(details),
      },
    });

    // Update the UploadRow qualityScore
    await db.uploadRow.update({
      where: { id: row.id },
      data: { qualityScore: totalScore },
    });

    scores.push(scoreRecord);
  }

  // Update DataUpload aggregate quality score
  if (scores.length > 0) {
    const avgScore =
      scores.reduce((sum, s) => sum + s.totalScore, 0) / scores.length;
    await db.dataUpload.update({
      where: { id: uploadId },
      data: { dataQualityScore: avgScore },
    });
  }

  return scores;
}

// ─── Phase 6: Commit Import ──────────────────────────────────────

/**
 * Commit the import by creating Company and Contact records from
 * accepted rows (status = 'accepted' or 'pending' with no errors).
 *
 * For each accepted row:
 *   1. Create or find existing Company (by normalizedName)
 *   2. Create a Contact linked to the Company
 *   3. Link the UploadRow to the created Company
 *
 * @param uploadId - The DataUpload id.
 * @returns Summary of created records.
 */
export async function commitImport(
  uploadId: string,
): Promise<CommitResult> {
  const upload = await db.dataUpload.findUnique({ where: { id: uploadId } });
  if (!upload) {
    throw new Error(`DataUpload with id "${uploadId}" not found.`);
  }
  if (upload.status !== 'review_ready' && upload.status !== 'processing') {
    throw new Error(
      `Cannot commit upload with status "${upload.status}". Must be review_ready or processing.`,
    );
  }

  // Update status to committing
  await db.dataUpload.update({
    where: { id: uploadId },
    data: { status: 'committing' },
  });

  // Get accepted rows
  const acceptedRows = await db.uploadRow.findMany({
    where: {
      uploadId,
      status: { in: ['accepted', 'pending'] },
    },
    orderBy: { rowIndex: 'asc' },
  });

  let companiesCreated = 0;
  let contactsCreated = 0;
  let duplicatesSkipped = 0;
  let failedRows = 0;

  // Create a synthetic ImportBatch for Contact batchId requirement
  const batch = await db.importBatch.create({
    data: {
      fileName: upload.fileName,
      fileHash: `t11-${uploadId}`,
      totalRows: acceptedRows.length,
      status: 'processing',
    },
  });

  const seenDomains = new Map<string, string>(); // domain → companyId
  const seenEmails = new Set<string>();
  const newCompanyIds = new Set<string>(); // WI-17A: Track new companies for intelligence activation

  for (const row of acceptedRows) {
    try {
      let data: Record<string, string> = {};
      try {
        data = row.normalizedData
          ? JSON.parse(row.normalizedData)
          : row.mappedData
            ? JSON.parse(row.mappedData)
            : {};
      } catch {
        data = {};
      }

      const companyName = (data.company || '').trim();
      const contactName = (data.name || '').trim();
      const email = (data.email || '').trim();

      if (!contactName || !email) {
        failedRows++;
        await db.uploadRow.update({
          where: { id: row.id },
          data: { status: 'failed' },
        });
        continue;
      }

      // Check email uniqueness within this import
      if (seenEmails.has(email.toLowerCase())) {
        duplicatesSkipped++;
        await db.uploadRow.update({
          where: { id: row.id },
          data: { status: 'duplicate' },
        });
        continue;
      }
      seenEmails.add(email.toLowerCase());

      // Determine company lookup info outside the transaction
      const domain = data.domain || (email.includes('@') ? email.split('@')[1] : '');
      let useCachedDomain = false;
      if (companyName && seenDomains.has(domain.toLowerCase())) {
        useCachedDomain = true;
      }

      // All DB writes for this row are wrapped in a single transaction
      // to ensure atomicity: company + contact + uploadRow status update
      const rowResult = await db.$transaction(async (tx) => {
        // Create or find Company
        let companyId: string;

        if (companyName && useCachedDomain) {
          companyId = seenDomains.get(domain.toLowerCase())!;
        } else if (companyName) {
          const normalizedName = companyName.toLowerCase();
          const existing = await tx.company.findFirst({
            where: { normalizedName },
            orderBy: { createdAt: 'desc' },
          });

          if (existing) {
            companyId = existing.id;
          } else {
            const company = await tx.company.create({
              data: {
                rawName: companyName,
                normalizedName,
                domain: domain || null,
                industry: data.industry || null,
                sizeRange: data.employee_size || data.sizeRange || null,
                location: data.location || null,
                country: data.country || null,
                website: data.website || null,
                status: 'prospect',
                source: 'import',
              },
            });
            companyId = company.id;
            companiesCreated++;
            newCompanyIds.add(company.id); // WI-17A: track for activation
          }
          if (domain) seenDomains.set(domain.toLowerCase(), companyId);
        } else {
          // No company name — find or create a placeholder
          const existing = await tx.company.findFirst({
            where: { domain: domain || undefined },
            orderBy: { createdAt: 'desc' },
          });
          if (existing) {
            companyId = existing.id;
          } else {
            const company = await tx.company.create({
              data: {
                rawName: companyName || 'Unknown Company',
                normalizedName: (companyName || 'unknown company').toLowerCase(),
                domain: domain || null,
                status: 'prospect',
                source: 'import',
              },
            });
            companyId = company.id;
            companiesCreated++;
            newCompanyIds.add(company.id); // WI-17A: track for activation
          }
          if (domain) seenDomains.set(domain.toLowerCase(), companyId);
        }

        // Create Contact
        const normalizedName = contactName.toLowerCase();
        await tx.contact.create({
          data: {
            rawName: contactName,
            normalizedName,
            email,
            title: data.title || data.role || null,
            phone: data.phone || null,
            location: data.location || null,
            companyId,
            batchId: batch.id,
            source: 'cold_list',
            consentStatus: 'unknown',
          },
        });
        contactsCreated++;

        // Link UploadRow to Company
        await tx.uploadRow.update({
          where: { id: row.id },
          data: { status: 'accepted', companyId },
        });

        return { companyId };
      }, { timeout: 15000 });

      // Cache the company ID for subsequent rows
      if (domain) {
        seenDomains.set(domain.toLowerCase(), rowResult.companyId);
      }
    } catch {
      failedRows++;
      try {
        await db.uploadRow.update({
          where: { id: row.id },
          data: { status: 'failed' },
        });
      } catch {
        // Row update also failed — skip silently
      }
    }
  }

  // Atomically mark both the import batch and upload as completed
  await db.$transaction(async (tx) => {
    await tx.importBatch.update({
      where: { id: batch.id },
      data: {
        acceptedRows: contactsCreated,
        duplicateRows: duplicatesSkipped,
        invalidRows: failedRows,
        status: 'completed',
      },
    });
    await tx.dataUpload.update({
      where: { id: uploadId },
      data: {
        status: 'completed',
        completedAt: new Date(),
        processedRows: acceptedRows.length,
        acceptedRows: contactsCreated,
        duplicateRows: duplicatesSkipped,
        failedRows,
      },
    });
  }, { timeout: 30000 });

  // WI-17A: Activate intelligence for all newly created companies (fire-and-forget)
  if (newCompanyIds.size > 0) {
    const activationRequests = Array.from(newCompanyIds).map(companyId => ({
      companyId,
      trigger: 'import_pipeline' as const,
      priority: 3,
    }));
    activateIntelligenceBatch(activationRequests, { skipExpensiveSteps: activationRequests.length > 10 }).catch(() => {
      // Non-blocking — intelligence activation failure must not break import
    });
  }

  return { companiesCreated, contactsCreated, duplicatesSkipped, failedRows };
}

// ─── Helper: Get Upload with Rows and Scores ────────────────────

/**
 * Fetch a DataUpload record with its rows and quality scores.
 *
 * @param id - The DataUpload id.
 * @returns The upload with rows (sorted by rowIndex) or throws if not found.
 */
export async function getUploadWithDetails(id: string) {
  const upload = await db.dataUpload.findUnique({
    where: { id },
    include: {
      rows: {
        orderBy: { rowIndex: 'asc' },
      },
    },
  });

  if (!upload) {
    throw new Error(`DataUpload with id "${id}" not found.`);
  }

  // Fetch quality scores separately (no direct relation on DataUpload)
  const qualityScores = await db.dataQualityScore.findMany({
    where: { uploadId: id },
    orderBy: { rowIndex: 'asc' },
  });

  return { upload, qualityScores };
}

// ─── Helper: List Uploads ────────────────────────────────────────

/**
 * List DataUpload records with pagination, ordered by newest first.
 *
 * @param page - Page number (1-based).
 * @param limit - Items per page.
 * @returns The uploads and total count.
 */
export async function listUploads(
  page = 1,
  limit = 20,
): Promise<{ items: import('@prisma/client').DataUpload[]; total: number }> {
  const [items, total] = await Promise.all([
    db.dataUpload.findMany({
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    db.dataUpload.count(),
  ]);

  return { items, total };
}
