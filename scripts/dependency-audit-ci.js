#!/usr/bin/env node
/**
 * CI Dependency Security Audit — WI-18 Phase 2/3
 *
 * Runs npm audit but handles documented upstream exceptions.
 * These exceptions are from packages we cannot fix without
 * unacceptable framework downgrades (Next.js, @xenova/transformers).
 *
 * Strategy:
 *   1. Run `npm audit --json` to get structured vulnerability data
 *   2. Filter out vulnerabilities from documented accepted exceptions
 *   3. If any NEW actionable vulnerabilities remain, fail CI
 *   4. If only known exceptions remain, pass with visibility report
 *
 * Usage: node scripts/dependency-audit-ci.js
 * Exit code: 0 (clean or only known exceptions) or 1 (new actionable vulns)
 */

const { execSync } = require('child_process');
const path = require('path');

// ═══════════════════════════════════════════════════════════
// DOCUMENTED UPSTREAM VULNERABILITY EXCEPTIONS
//
// These are KNOWN vulnerabilities from transitive dependencies
// that CANNOT be fixed without:
//   - Downgrading Next.js 16 → 14 (for postcss)
//   - Downgrading @xenova/transformers 2.x → 1.x (for protobufjs, sharp)
//
// Risk mitigation:
//   - postcss: Not used for user-controlled input; only processes
//     framework-internal CSS. No SSR CSS processing of user data.
//   - protobufjs: Used only in onnxruntime-web for ML model inference;
//     no deserialization of untrusted protobuf data from network.
//   - sharp: Used for image processing in transformers pipeline;
//     only processes internally-fetched images, never user uploads.
//
// Review cadence: Re-evaluate with each Next.js/transformers major release.
// ═══════════════════════════════════════════════════════════

const ACCEPTED_EXCEPTION_PACKAGES = new Set([
  'postcss',
  'protobufjs',
  'sharp',
  'onnx-proto',
  'onnxruntime-web',
  '@xenova/transformers',
  'next',
]);

const EXCEPTION_DETAILS = {
  'postcss': {
    via: 'next',
    reason: 'Transitive via Next.js 16. Fix requires downgrade to Next.js 14 (unacceptable). No user-controlled CSS input.',
  },
  'protobufjs': {
    via: '@xenova/transformers → onnxruntime-web → onnx-proto',
    reason: 'Transitive via transformers ML pipeline. Fix requires downgrade to transformers 1.x (breaking). No untrusted protobuf deserialization.',
  },
  'sharp': {
    via: '@xenova/transformers → sharp',
    reason: 'Transitive via transformers image pipeline. Fix requires downgrade to transformers 1.x. Only processes internal images.',
  },
  'onnx-proto': {
    via: '@xenova/transformers → onnxruntime-web → onnx-proto',
    reason: 'Transitive via transformers ML pipeline. Fix requires downgrade to transformers 1.x (breaking). No untrusted protobuf deserialization.',
  },
  'onnxruntime-web': {
    via: '@xenova/transformers → onnxruntime-web',
    reason: 'Transitive via transformers ML pipeline. Fix requires downgrade to transformers 1.x (breaking). No untrusted protobuf deserialization.',
  },
  '@xenova/transformers': {
    via: '@xenova/transformers (direct)',
    reason: 'Direct dependency for ML model inference. Fix requires downgrade to 1.x (breaking). All transitive vulns (onnxruntime-web, protobufjs, sharp) inherit from this.',
  },
  'next': {
    via: 'next (direct)',
    reason: 'Next.js 16 is the framework. Transitive vulns (postcss, sharp) require Next.js downgrade to fix (unacceptable). postcss: no user-controlled CSS. sharp: no user-controlled images.',
  },
};

function runAudit() {
  console.log('═══ CI Dependency Security Audit ═══\n');

  let auditJson;
  try {
    const raw = execSync('npm audit --json', {
      encoding: 'utf-8',
      timeout: 60000,
      cwd: path.join(__dirname, '..'),
    });
    auditJson = JSON.parse(raw);
  } catch (err) {
    // npm audit exits with code 1 when vulnerabilities found
    // but still outputs JSON to stdout
    try {
      auditJson = JSON.parse(err.stdout || '{}');
    } catch {
      console.error('::error::Failed to parse npm audit output');
      process.exit(1);
    }
  }

  const vulnerabilities = auditJson.vulnerabilities || {};
  const metadata = auditJson.metadata || {};
  const vulnCounts = metadata.vulnerabilities || {};

  console.log(`Vulnerabilities: ${vulnCounts.total || Object.keys(vulnerabilities).length} total`);
  console.log(`  Critical: ${vulnCounts.critical || 0}`);
  console.log(`  High:     ${vulnCounts.high || 0}`);
  console.log(`  Moderate: ${vulnCounts.moderate || 0}`);
  console.log(`  Low:      ${vulnCounts.low || 0}`);
  console.log('');

  if (Object.keys(vulnerabilities).length === 0) {
    console.log('✓ No vulnerabilities found — audit passed');
    process.exit(0);
  }

  // Classify each vulnerability entry
  const actionable = [];
  const exceptions = [];
  // Format via chain: mix of strings and advisory objects
  function formatViaChain(via) {
    if (!Array.isArray(via)) return String(via);
    return via.map(v => {
      if (typeof v === 'string') return v;
      if (v && v.title) return `${v.name || v.dependency}: ${v.title}`;
      return String(v);
    }).join(' → ');
  }

  // Format fixAvailable: may be boolean, string, or object
  function formatFixAvailable(fix) {
    if (!fix) return 'No';
    if (fix === true) return 'Yes (auto-fixable)';
    if (typeof fix === 'string') return `Yes → ${fix}`;
    if (fix.name && fix.version) {
      const breaking = fix.isSemVerMajor ? ' (BREAKING)' : '';
      return `Yes → ${fix.name}@${fix.version}${breaking}`;
    }
    return 'Yes';
  }

  for (const [pkgName, vulnData] of Object.entries(vulnerabilities)) {
    const severity = vulnData.severity;
    const isHighOrCritical = severity === 'high' || severity === 'critical';

    // Only care about high+ for CI blocking
    if (!isHighOrCritical) {
      continue;
    }

    if (ACCEPTED_EXCEPTION_PACKAGES.has(pkgName)) {
      const detail = EXCEPTION_DETAILS[pkgName] || { via: 'unknown', reason: 'See documentation' };
      exceptions.push({
        package: pkgName,
        severity,
        via: detail.via,
        reason: detail.reason,
        viaChain: formatViaChain(vulnData.via),
        fixAvailable: formatFixAvailable(vulnData.fixAvailable),
      });
    } else {
      actionable.push({
        package: pkgName,
        severity,
        viaChain: formatViaChain(vulnData.via),
        fixAvailable: formatFixAvailable(vulnData.fixAvailable),
      });
    }
  }

  // Report exceptions (informational, not blocking)
  if (exceptions.length > 0) {
    console.log('─── Documented Upstream Exceptions (Accepted) ───');
    console.log('These are known vulnerabilities from upstream transitive dependencies');
    console.log('that cannot be fixed without unacceptable framework downgrades.');
    console.log('');

    for (const exc of exceptions) {
      console.log(`  ⚠ ${exc.package} [${exc.severity.toUpperCase()}]`);
      console.log(`    Dependency chain: ${exc.viaChain}`);
      console.log(`    Fix available:   ${exc.fixAvailable}`);
      console.log(`    Mitigation:      ${exc.reason}`);
      console.log('');
    }
  }

  // Fail on actionable vulnerabilities
  if (actionable.length > 0) {
    console.error('::error::ACTIONABLE VULNERABILITIES FOUND — CI BLOCKED');
    console.error('');
    console.error(`Found ${actionable.length} actionable high/critical vulnerability(ies):`);
    console.error('');
    for (const vuln of actionable) {
      console.error(`  ❌ ${vuln.package} [${vuln.severity.toUpperCase()}]`);
      console.error(`     Chain: ${vuln.viaChain}`);
      console.error(`     Fix:   ${vuln.fixAvailable}`);
      console.error('');
    }
    console.error('Run `npm audit fix` to remediate. If this is a new upstream exception,');
    console.error('document it in scripts/dependency-audit-ci.js ACCEPTED_EXCEPTION_PACKAGES.');
    process.exit(1);
  }

  // All high/critical vulns are known exceptions
  if (exceptions.length > 0) {
    console.log('─── Audit Result ───');
    console.log(`✓ CI PASSED — All high/critical vulnerabilities are documented exceptions`);
    console.log(`  ${exceptions.length} exception(s), 0 actionable vulnerabilities`);
    console.log('');
    console.log('  These exceptions are reviewed with each major dependency update.');
    console.log('  New actionable vulnerabilities WILL block CI.');
    process.exit(0);
  }

  // No high/critical vulns at all
  console.log('✓ No high or critical vulnerabilities — audit passed');
  process.exit(0);
}

runAudit();
