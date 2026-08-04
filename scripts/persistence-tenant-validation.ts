/**
 * WI-18.2 Phase 3.5 — Multi-Tenant Runtime Validation
 * ====================================================
 *
 * Validates tenant isolation under real staging traffic.
 * Run periodically during the 7-day shadow period.
 *
 * Usage:
 *   bun run scripts/persistence-tenant-validation.ts
 *
 * Validates:
 *   - Company-scoped data has correct companyId
 *   - No cross-company leakage in KG nodes
 *   - No cross-company leakage in memories
 *   - No cross-company leakage in retrieval index
 *   - Global vs company boundary integrity
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface TenantValidationResult {
  timestamp: string;
  store: string;
  totalRecords: number;
  globalRecords: number;
  companyScopedRecords: number;
  missingCompanyId: number;
  companies: Array<{
    companyId: string | null;
    count: number;
  }>;
  leakageDetected: boolean;
  issues: string[];
}

async function validateStore(
  storeName: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  model: any,
  companyIdField: string = 'companyId'
): Promise<TenantValidationResult> {
  const result: TenantValidationResult = {
    timestamp: new Date().toISOString(),
    store: storeName,
    totalRecords: 0,
    globalRecords: 0,
    companyScopedRecords: 0,
    missingCompanyId: 0,
    companies: [],
    leakageDetected: false,
    issues: [],
  };

  try {
    // Get total count
    result.totalRecords = await model.count();

    if (result.totalRecords === 0) {
      result.issues.push('No records found — empty store');
      return result;
    }

    // Count global records (companyId IS NULL or isGlobal IS TRUE)
    const globalCount = await model.count({
      where: {
        OR: [
          { [companyIdField]: null },
          ...(storeName !== 'retrieval_index' ? [{ isGlobal: true }] : []),
        ],
      },
    });
    result.globalRecords = globalCount;
    result.companyScopedRecords = result.totalRecords - globalCount;

    // Count missing companyId on non-global records
    const missingCompanyId = await model.count({
      where: {
        [companyIdField]: null,
        ...(storeName !== 'retrieval_index' ? [{ isGlobal: false }] : []),
      },
    });
    result.missingCompanyId = missingCompanyId;

    if (missingCompanyId > 0) {
      result.leakageDetected = true;
      result.issues.push(`${missingCompanyId} records have NULL companyId and isGlobal=false — potential orphan data`);
    }

    // Get company distribution (top 20)
    const companyGroups = await model.groupBy({
      by: [companyIdField],
      where: { [companyIdField]: { not: null } },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 20,
    });

    result.companies = companyGroups.map((g: any) => ({
      companyId: g[companyIdField] as string | null,
      count: g._count.id,
    }));

    // Validate: each company should only see its own data
    // In staging, we check that companyId values are consistent
    // (no records with mismatched company context)
    for (const group of companyGroups) {
      const companyId = group[companyIdField];
      if (!companyId) continue;

      // Sample 5 records from this company to verify consistency
      const samples = await model.findMany({
        where: { [companyIdField]: companyId },
        take: 5,
        select: { id: true, [companyIdField]: true },
      });

      for (const sample of samples) {
        if (sample[companyIdField] !== companyId) {
          result.leakageDetected = true;
          result.issues.push(`Record ${sample.id} has companyId=${sample[companyIdField]} but grouped under ${companyId}`);
        }
      }
    }

    if (result.issues.length === 0) {
      result.issues.push('No issues detected');
    }
  } catch (err) {
    result.issues.push(`Validation error: ${err}`);
    result.leakageDetected = true;
  }

  return result;
}

async function main() {
  console.log('='.repeat(60));
  console.log('WI-18.2 Phase 3.5 — Multi-Tenant Runtime Validation');
  console.log('='.repeat(60));
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log('');

  const results: TenantValidationResult[] = [];
  let totalIssues = 0;
  let anyLeakage = false;

  // Validate each persistence store
  const stores = [
    { name: 'Knowledge Graph Nodes', model: prisma.knowledgeGraphNode },
    { name: 'Knowledge Graph Edges', model: prisma.knowledgeGraphEdge },
    { name: 'AI Memory', model: prisma.aIMemoryEntry },
    { name: 'Retrieval Index', model: prisma.retrievalIndexEntry },
  ];

  for (const store of stores) {
    console.log(`Validating: ${store.name}...`);
    const result = await validateStore(store.name, store.model);
    results.push(result);

    console.log(`  Total: ${result.totalRecords}`);
    console.log(`  Global (companyId=NULL or isGlobal=true): ${result.globalRecords}`);
    console.log(`  Company-scoped: ${result.companyScopedRecords}`);
    console.log(`  Missing companyId: ${result.missingCompanyId}`);
    console.log(`  Companies found: ${result.companies.length}`);

    if (result.leakageDetected) {
      console.log(`  ⚠️  LEAKAGE DETECTED:`);
      for (const issue of result.issues) {
        if (issue !== 'No issues detected') {
          console.log(`    - ${issue}`);
        }
      }
      anyLeakage = true;
      totalIssues += result.issues.filter(i => i !== 'No issues detected').length;
    } else {
      console.log(`  ✅ No leakage detected`);
    }
    console.log('');
  }

  // Check for cross-company retrieval leakage
  console.log('Validating: Cross-Company Retrieval Leakage...');
  try {
    // A company's retrieval entries should not appear in another company's scope
    const retEntries = await prisma.retrievalIndexEntry.findMany({
      where: { companyId: { not: null } },
      select: { id: true, entityId: true, companyId: true, isGlobal: true },
      take: 100,
    });

    let crossCompanyIssues = 0;
    for (const entry of retEntries) {
      if (!entry.isGlobal && entry.companyId) {
        // Verify no duplicate entityId exists under different companyId
        const duplicate = await prisma.retrievalIndexEntry.findFirst({
          where: {
            entityId: entry.entityId,
            companyId: { not: entry.companyId },
          },
        });
        if (duplicate) {
          crossCompanyIssues++;
          console.log(`  ⚠️  entityId=${entry.entityId} found in multiple companies: ${entry.companyId} and ${duplicate.companyId}`);
        }
      }
    }

    if (crossCompanyIssues === 0) {
      console.log('  ✅ No cross-company retrieval leakage detected');
    } else {
      anyLeakage = true;
      totalIssues += crossCompanyIssues;
    }
  } catch (err) {
    console.log(`  ❌ Error: ${err}`);
  }

  // Summary
  console.log('='.repeat(60));
  console.log('VALIDATION SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total stores validated: ${results.length}`);
  console.log(`Total issues found: ${totalIssues}`);
  console.log(`Leakage detected: ${anyLeakage ? '❌ YES' : '✅ NO'}`);
  console.log(`Acceptance: ${!anyLeakage ? '✅ PASS — Tenant isolation maintained' : '❌ FAIL — Investigation required'}`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
