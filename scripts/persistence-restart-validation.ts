/**
 * WI-18.2 Phase 3.5 — Restart Validation Script
 * =================================================
 *
 * Captures intelligence state before and after a staging restart.
 * Run BEFORE restart to capture baseline, then AFTER restart to compare.
 *
 * Usage:
 *   bun run scripts/persistence-restart-validation.ts before   # Capture baseline
 *   # ... perform staging restart ...
 *   bun run scripts/persistence-restart-validation.ts after    # Compare & report
 *
 * Captures:
 *   - KG node/edge counts
 *   - Memory entry counts
 *   - Retrieval index counts
 *   - Corpus stats
 *   - Sample queries for each store
 */

import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();
const SNAPSHOT_DIR = path.join(process.cwd(), '.persistence-snapshots');

function ensureSnapshotDir() {
  if (!fs.existsSync(SNAPSHOT_DIR)) {
    fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });
  }
}

async function captureBefore() {
  console.log('WI-18.2 Phase 3.5 — Restart Validation (BEFORE)');
  console.log('='.repeat(50));

  const snapshot: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    phase: 'before_restart',
    counts: {},
    samples: {},
  };

  // Count records in each persistence store
  const stores = [
    { name: 'knowledge_graph_nodes', model: 'knowledgeGraphNode' },
    { name: 'knowledge_graph_edges', model: 'knowledgeGraphEdge' },
    { name: 'ai_memory', model: 'aIMemoryEntry' },
    { name: 'retrieval_index', model: 'retrievalIndexEntry' },
  ] as const;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const store of stores) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const model = (prisma as any)[store.model];
      const count = await model.count();
      (snapshot.counts as any)[store.name] = count;
      console.log(`  ${store.name}: ${count} records`);
    } catch (err) {
      console.log(`  ${store.name}: ERROR - ${err}`);
    }
  }

  // Corpus stats
  try {
    const corpus = await prisma.retrievalCorpusStats.findUnique({
      where: { id: 'singleton_corpus' },
    });
    if (corpus) {
      (snapshot.counts as any).retrieval_corpus_stats = {
        totalDocuments: corpus.totalDocuments,
      };
      console.log(`  retrieval_corpus_stats: ${corpus.totalDocuments} documents`);
    }
  } catch (err) {
    console.log(`  retrieval_corpus_stats: ERROR - ${err}`);
  }

  // Sample queries
  try {
    const sampleNodes = await prisma.knowledgeGraphNode.findMany({ take: 5, orderBy: { updatedAtMs: 'desc' } });
    (snapshot.samples as any).kg_nodes = sampleNodes.map((n: any) => ({
      id: n.id,
      label: n.label,
      type: n.type,
      companyId: n.companyId,
    }));
    console.log(`  Sample KG nodes: ${sampleNodes.length}`);
  } catch { /* skip */ }

  try {
    const sampleMemories = await prisma.aIMemoryEntry.findMany({ take: 5, orderBy: { updatedAtMs: 'desc' } });
    (snapshot.samples as any).memories = sampleMemories.map((m: any) => ({
      id: m.id,
      layer: m.layer,
      category: m.category,
      companyId: m.companyId,
    }));
    console.log(`  Sample memories: ${sampleMemories.length}`);
  } catch { /* skip */ }

  // Save snapshot
  ensureSnapshotDir();
  const snapshotPath = path.join(SNAPSHOT_DIR, 'restart-before.json');
  fs.writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2));
  console.log(`\n  Snapshot saved to: ${snapshotPath}`);
  console.log('  Now perform the staging restart, then run with "after" argument.');
}

async function captureAfter() {
  console.log('WI-18.2 Phase 3.5 — Restart Validation (AFTER)');
  console.log('='.repeat(50));

  // Load before snapshot
  const beforePath = path.join(SNAPSHOT_DIR, 'restart-before.json');
  if (!fs.existsSync(beforePath)) {
    console.log('  ❌ No "before" snapshot found. Run with "before" first.');
    process.exit(1);
  }

  const before: Record<string, any> = JSON.parse(fs.readFileSync(beforePath, 'utf-8'));
  const after: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    phase: 'after_restart',
    counts: {},
    samples: {},
  };

  // Count records in each store
  const stores = [
    { name: 'knowledge_graph_nodes', model: 'knowledgeGraphNode' },
    { name: 'knowledge_graph_edges', model: 'knowledgeGraphEdge' },
    { name: 'ai_memory', model: 'aIMemoryEntry' },
    { name: 'retrieval_index', model: 'retrievalIndexEntry' },
  ] as const;

  const comparison: Array<{
    store: string;
    before: number;
    after: number;
    delta: number;
    status: string;
  }> = [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const store of stores) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const model = (prisma as any)[store.model];
      const count = await model.count();
      const beforeCount = (before.counts as any)[store.name] || 0;
      const delta = count - beforeCount;

      (after.counts as any)[store.name] = count;

      comparison.push({
        store: store.name,
        before: beforeCount,
        after: count,
        delta,
        status: Math.abs(delta) <= 1 ? 'MATCH' : delta > 0 ? 'GROWN' : 'SHRUNK',
      });

      console.log(`  ${store.name}: ${count} (was ${beforeCount}, delta ${delta > 0 ? '+' : ''}${delta})`);
    } catch (err) {
      console.log(`  ${store.name}: ERROR - ${err}`);
    }
  }

  // Validate samples still exist
  let samplesMatch = 0;
  let samplesTotal = 0;

  if (before.samples?.kg_nodes) {
    for (const node of before.samples.kg_nodes) {
      samplesTotal++;
      try {
        const found = await prisma.knowledgeGraphNode.findUnique({ where: { id: node.id } });
        if (found) samplesMatch++;
      } catch { /* skip */ }
    }
  }

  if (before.samples?.memories) {
    for (const mem of before.samples.memories) {
      samplesTotal++;
      try {
        const found = await prisma.aIMemoryEntry.findUnique({ where: { id: mem.id } });
        if (found) samplesMatch++;
      } catch { /* skip */ }
    }
  }

  console.log(`\n  Sample record survival: ${samplesMatch}/${samplesTotal}`);

  // Generate report
  const report = {
    generatedAt: new Date().toISOString(),
    beforeTimestamp: before.timestamp,
    afterTimestamp: after.timestamp,
    durationBetweenMs: new Date(after.timestamp as string).getTime() - new Date(before.timestamp).getTime(),
    comparison,
    sampleSurvival: { matched: samplesMatch, total: samplesTotal, rate: samplesTotal > 0 ? ((samplesMatch / samplesTotal) * 100).toFixed(1) + '%' : 'N/A' },
    acceptance: {
      noDataLoss: samplesMatch === samplesTotal,
      countsConsistent: comparison.every(c => c.status === 'MATCH' || c.status === 'GROWN'),
    },
  };

  // Save report
  ensureSnapshotDir();
  const reportPath = path.join(SNAPSHOT_DIR, 'restart-validation-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log(`\n  Report saved to: ${reportPath}`);
  console.log(`  Acceptance — No data loss: ${report.acceptance.noDataLoss ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`  Acceptance — Counts consistent: ${report.acceptance.countsConsistent ? '✅ PASS' : '❌ FAIL'}`);

  await prisma.$disconnect();
}

// Main
const mode = process.argv[2] || 'check';
if (mode === 'before') {
  captureBefore().then(() => prisma.$disconnect());
} else if (mode === 'after') {
  captureAfter();
} else {
  console.log('Usage: bun run scripts/persistence-restart-validation.ts [before|after]');
}
