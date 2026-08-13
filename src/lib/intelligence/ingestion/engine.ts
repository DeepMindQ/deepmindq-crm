// ═══════════════════════════════════════════════════════════════════════════
// DeepMindQ Intelligence OS — Data Ingestion Engine
//
// Takes raw business data (CSV, Excel, JSON) and converts it into
// structured intelligence entities (Organization, Person, Signal).
//
// Pipeline: Upload → Parse → Detect Columns → Extract Entities → Store
// ═══════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { parseCSV, parseExcelRow, type ParsedRow } from './parsers';
import { detectColumns } from './column-detector';
import { extractEntities } from './entity-extractor';
import type { IngestionFileType } from '@prisma/client';

export interface IngestionResult {
  ingestionId: string;
  totalRows: number;
  processedRows: number;
  failedRows: number;
  organizationsCreated: number;
  peopleCreated: number;
  errors: Array<{ row: number; error: string }>;
}

export interface IngestionOptions {
  userId?: string;
  deduplicate?: boolean;
  skipRows?: number;
  maxRows?: number;
}

/**
 * Main ingestion pipeline.
 * Takes a file buffer, parses it, detects columns, extracts entities, stores them.
 */
export async function ingestFile(
  fileBuffer: Buffer,
  fileName: string,
  fileType: IngestionFileType,
  options: IngestionOptions = {}
): Promise<IngestionResult> {
  const {
    userId,
    deduplicate = true,
    skipRows = 0,
    maxRows = 10000,
  } = options;

  logger.info('[INGEST] Starting file ingestion', { fileName, fileType, userId });

  // 1. Create ingestion record
  const ingestion = await db.dataIngestion.create({
    data: {
      fileName,
      fileSize: fileBuffer.length,
      fileType,
      status: 'processing',
      uploadedBy: userId,
    },
  });

  const result: IngestionResult = {
    ingestionId: ingestion.id,
    totalRows: 0,
    processedRows: 0,
    failedRows: 0,
    organizationsCreated: 0,
    peopleCreated: 0,
    errors: [],
  };

  try {
    // 2. Parse the file into rows
    const rows: ParsedRow[] = fileType === 'csv'
      ? await parseCSV(fileBuffer.toString('utf-8'))
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      : await parseExcelRow(fileBuffer as any);

    result.totalRows = rows.length;
    logger.info('[INGEST] File parsed', { totalRows: rows.length });

    // 3. Detect column mapping
    const columnMapping = detectColumns(rows[0]);
    logger.info('[INGEST] Columns detected', { mapping: columnMapping });

    // 4. Process each row
    const processStart = skipRows;
    const processEnd = Math.min(rows.length, skipRows + maxRows);

    for (let i = processStart; i < processEnd; i++) {
      const row = rows[i];
      try {
        // Extract entities from this row
        const entities = extractEntities(row, columnMapping);

        // Create or find Organization
        let orgId: string | undefined;

        if (entities.organization) {
          const existingOrg = deduplicate && entities.organization.domain
            ? await db.organization.findFirst({
                where: { domain: entities.organization.domain },
              })
            : null;

          if (existingOrg) {
            orgId = existingOrg.id;
          } else {
            const org = await db.organization.create({
              data: {
                name: entities.organization.name,
                domain: entities.organization.domain,
                industry: entities.organization.industry,
                description: entities.organization.description,
                website: entities.organization.domain
                  ? `https://${entities.organization.domain}`
                  : null,
                employeeCount: entities.organization.employeeCount,
                revenue: entities.organization.revenue,
                headquarters: entities.organization.headquarters,
                source: 'upload',
              },
            });
            orgId = org.id;
            result.organizationsCreated++;
          }
        }

        // Create Person if extracted
        let personId: string | undefined;

        if (entities.person) {
          const existingPerson = deduplicate && entities.person.email
            ? await db.person.findFirst({
                where: { email: entities.person.email },
              })
            : null;

          if (existingPerson) {
            personId = existingPerson.id;
          } else {
            const person = await db.person.create({
              data: {
                fullName: entities.person.fullName,
                email: entities.person.email,
                title: entities.person.title,
                department: entities.person.department,
                organizationId: orgId,
                source: 'upload',
              },
            });
            personId = person.id;
            result.peopleCreated++;
          }
        }

        // Store the ingestion row
        await db.dataIngestionRow.create({
          data: {
            ingestionId: ingestion.id,
            rawData: JSON.stringify(row),
            rowNumber: i + 1,
            organizationId: orgId,
            personId,
            status: 'extracted',
          },
        });

        result.processedRows++;
      } catch (rowError) {
        const errorMsg = rowError instanceof Error ? rowError.message : 'Unknown extraction error';
        result.failedRows++;
        result.errors.push({ row: i + 1, error: errorMsg });

        // Store failed row
        await db.dataIngestionRow.create({
          data: {
            ingestionId: ingestion.id,
            rawData: JSON.stringify(row),
            rowNumber: i + 1,
            status: 'failed',
            error: errorMsg,
          },
        });
      }
    }

    // 5. Update ingestion record with results
    await db.dataIngestion.update({
      where: { id: ingestion.id },
      data: {
        status: result.failedRows === 0 ? 'completed'
          : result.processedRows > 0 ? 'partial'
          : 'failed',
        totalRows: result.totalRows,
        processedRows: result.processedRows,
        failedRows: result.failedRows,
        organizationsCreated: result.organizationsCreated,
        peopleCreated: result.peopleCreated,
        errorDetails: result.errors.length > 0 ? JSON.stringify(result.errors.slice(0, 100)) : null,
        completedAt: new Date(),
        columnMap: JSON.stringify(columnMapping),
      },
    });

    logger.info('[INGEST] File ingestion complete', {
      ingestionId: ingestion.id,
      totalRows: result.totalRows,
      processedRows: result.processedRows,
      failedRows: result.failedRows,
      organizationsCreated: result.organizationsCreated,
      peopleCreated: result.peopleCreated,
    });

    // 6. Auto-discover relationships in the knowledge graph
    if (result.organizationsCreated > 0) {
      try {
        const { discoverRelationships } = await import('@/lib/intelligence/knowledge-graph');
        const relsCreated = await discoverRelationships();
        logger.info('[INGEST] Knowledge graph relationships discovered', { relsCreated });
      } catch (kgError) {
        logger.warn('[INGEST] Knowledge graph discovery failed (non-blocking)', {
          error: kgError instanceof Error ? kgError.message : 'Unknown',
        });
      }
    }

  } catch (error) {
    // Pipeline-level failure
    const errorMsg = error instanceof Error ? error.message : 'Unknown pipeline error';
    await db.dataIngestion.update({
      where: { id: ingestion.id },
      data: {
        status: 'failed',
        errorMessage: errorMsg,
        completedAt: new Date(),
      },
    });

    logger.error('[INGEST] Pipeline failure', { ingestionId: ingestion.id, error: errorMsg });
    throw error;
  }

  return result;
}
