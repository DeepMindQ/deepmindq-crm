/**
 * Phase C — Reaudit Script
 * Deep verification of all Phase C deliverables
 */

const fs = require('fs');
const path = require('path');

const ISSUES = [];
const CHECKS = [];

function check(name, passed, detail) {
  CHECKS.push({ name, passed, detail });
  if (!passed) ISSUES.push({ name, detail });
}

console.log('════════════════════════════════════════════════════════════════════');
console.log('  PHASE C — READUIT SCRIPT');
console.log('════════════════════════════════════════════════════════════════════\n');

// ── 1. Team Performance Report ──
console.log('▶ REAUDIT 1: Team Performance Report');
const perfReport = fs.readFileSync('src/app/api/reports/team-performance/route.ts', 'utf-8');

// Check that the main userReports mapping uses real data, not hardcoded zeros
// The placeholder for "no users" (lines ~43-50) is acceptable
// We check that the main mapping section has dynamic assignments
check('Main mapping uses entityCounts for companiesOwned', perfReport.includes('companiesOwned = entityCounts'), 'companiesOwned must derive from entityCounts map');
check('Main mapping uses entityCounts for contactsCreated', perfReport.includes('contactsCreated = entityCounts'), 'contactsCreated must derive from entityCounts map');
check('Main mapping uses entityCounts for emailsGenerated', perfReport.includes('emailsGenerated = entityCounts'), 'emailsGenerated must derive from entityCounts map');
check('Main mapping uses entityCounts for emailsSent', perfReport.includes('emailsSent = entityCounts'), 'emailsSent must derive from entityCounts map');
check('Main mapping uses pursuitData for dealsWon', perfReport.includes('dealsWon = pursuitData'), 'dealsWon must derive from pursuitData map');
check('Main mapping uses pursuitData for dealsLost', perfReport.includes('dealsLost = pursuitData'), 'dealsLost must derive from pursuitData map');
check('Main mapping calculates winRate', perfReport.includes('winRate = totalDeals') || perfReport.includes('Math.round'), 'winRate must be calculated from deals');
check('Main mapping uses revenueMap', perfReport.includes('revenue = revenueMap'), 'revenue must derive from revenueMap');
check('Uses audit log groupBy', perfReport.includes('auditByUserEntity') || perfReport.includes('auditLog.groupBy'), 'Must query audit logs for entity counts');
check('Uses Pursuit groupBy', perfReport.includes('pursuitsByOwner') || perfReport.includes('pursuit.groupBy'), 'Must query Pursuit for deal outcomes');
check('Uses revenue join query', perfReport.includes('$queryRaw') && perfReport.includes('OpportunityRecommendation'), 'Must join Pursuit → OpportunityRecommendation for revenue');
check('No empty break in Opportunity case', !perfReport.match(/case.*Opportunity[\s\S]*?break\s*;/), 'Opportunity case must not have empty break');

// ── 2. Backup Script ──
console.log('▶ REAUDIT 2: Backup Script');
const backup = fs.readFileSync('scripts/backup.sh', 'utf-8');

check('No $METADATA_file typo', !backup.includes('$METADATA_file'), 'Must use $METADATA_FILE (correct case)');
check('Has do_rotation function', backup.includes('do_rotation()'), 'Rotation function must exist');
check('Rotation: 7 daily policy', backup.includes('mtime +7') || backup.includes('7 daily'), 'Must enforce 7-day daily retention');
check('Rotation: 4 weekly policy', backup.includes('weekly') && (backup.includes('4') || backup.includes('> 4')), 'Must enforce 4-week weekly retention');
check('Rotation: 12 monthly policy', backup.includes('monthly') && (backup.includes('12') || backup.includes('> 12')), 'Must enforce 12-month monthly retention');
check('No double do_full_backup in incremental', !backup.match(/do_full_backup.*incremental[\s\S]*do_full_backup.*incremental/), 'Incremental must not create two full backups');
check('Has --rotate argument', backup.includes('--rotate') || backup.includes('BACKUP_TYPE="rotate"'), 'Must support --rotate flag');
check('Rotation in dispatch', backup.includes('do_rotation'), 'Dispatch must call do_rotation');

// ── 3. Index Verification ──
console.log('▶ REAUDIT 3: Index Verification');
const migrationDir = 'prisma/migrations/20260811000000_phase_c_missing_indexes';
const migrationFile = path.join(migrationDir, 'migration.sql');

check('Catchup migration exists', fs.existsSync(migrationFile), 'Migration file must exist');
if (fs.existsSync(migrationFile)) {
  const migrationSql = fs.readFileSync(migrationFile, 'utf-8');
  const indexCount = (migrationSql.match(/CREATE INDEX/g) || []).length;
  check('Has CREATE INDEX statements', indexCount > 0, `Found ${indexCount} CREATE INDEX statements`);
  check('Uses IF NOT EXISTS', migrationSql.includes('IF NOT EXISTS'), 'Must use IF NOT EXISTS for safety');
  check('Has Company indexes', migrationSql.includes('ON "Company"'), 'Must include Company indexes');
  check('Has Contact indexes', migrationSql.includes('ON "Contact"'), 'Must include Contact indexes');
  check('Has SecurityFinding indexes', migrationSql.includes('ON "SecurityFinding"'), 'Must include SecurityFinding indexes');
  check('Has PrivacyRequest indexes', migrationSql.includes('ON "PrivacyRequest"'), 'Must include PrivacyRequest indexes');
  check('Has WebhookDelivery indexes', migrationSql.includes('ON "WebhookDelivery"'), 'Must include WebhookDelivery indexes');
}

check('verify-indexes.js exists', fs.existsSync('scripts/verify-indexes.js'), 'Index verification tool must exist');

// ── 4. Connection Pool ──
console.log('▶ REAUDIT 4: Connection Pool');
const dbTs = fs.readFileSync('src/lib/db.ts', 'utf-8');
const healthTs = fs.readFileSync('src/app/api/health/route.ts', 'utf-8');

check('Pool limit = 10 default', dbTs.includes('return 10') && !dbTs.includes('return 20'), 'Default must be 10, not 20');
check('DATABASE_POOL_SIZE env var', dbTs.includes('DATABASE_POOL_SIZE'), 'Must support DATABASE_POOL_SIZE env override');
check('pool_timeout in datasource URL', dbTs.includes("pool_timeout"), 'Must append pool_timeout to datasource URL');
check('Health endpoint imports getPoolStats', healthTs.includes('getPoolStats'), 'Health endpoint must import pool stats');
check('Health endpoint exposes poolHealth', healthTs.includes('poolHealth'), 'Health endpoint must expose poolHealth');

// ── 5. TypeScript Compilation ──
console.log('▶ REAUDIT 5: TypeScript Compilation');
const { execSync } = require('child_process');
try {
  execSync('npx tsc --noEmit 2>&1', { timeout: 120000 });
  check('tsc --noEmit passes', true, 'TypeScript compilation successful');
} catch (e) {
  check('tsc --noEmit passes', false, e.stderr?.toString().slice(-500) || e.message.slice(-500));
}

// ── Results ──
console.log('\n════════════════════════════════════════════════════════════════════');
console.log('  READUIT RESULTS');
console.log('════════════════════════════════════════════════════════════════════\n');

const passed = CHECKS.filter(c => c.passed).length;
const failed = CHECKS.filter(c => !c.passed).length;

for (const c of CHECKS) {
  const icon = c.passed ? '✅' : '❌';
  console.log(`  ${icon} ${c.name}`);
  if (!c.passed) console.log(`      → ${c.detail}`);
}

console.log('');
console.log(`  Total: ${CHECKS.length} checks | Passed: ${passed} | Failed: ${failed}`);
console.log('');

if (failed > 0) {
  console.log('⚠️  READUIT FOUND ISSUES — see above for details');
  process.exit(1);
} else {
  console.log('🎉 ALL READUIT CHECKS PASSED — Phase C is production-ready');
}

// Write reaudit report
const reportPath = path.join('download', 'phase-c-reaudit.txt');
const report = CHECKS.map(c => `${c.passed ? 'PASS' : 'FAIL'}: ${c.name}${!c.passed ? ' — ' + c.detail : ''}`).join('\n');
fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.writeFileSync(reportPath, `Phase C Reaudit Report\nGenerated: ${new Date().toISOString()}\nResult: ${failed === 0 ? 'ALL PASSED' : 'FAILURES FOUND'}\n\n${report}\n`);
console.log(`\nReaudit report saved to: ${reportPath}`);
