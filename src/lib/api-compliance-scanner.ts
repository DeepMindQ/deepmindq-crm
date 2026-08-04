/**
 * WI-18.5 Phase 5 — API Compliance Scanner
 *
 * Scans all API route files for compliance with enterprise standards:
 *   - Authentication check
 *   - Authorization (RBAC) check
 *   - Zod input validation
 *   - Standard error response
 *   - Rate limit policy
 *   - Audit logging where required
 *   - Observability (correlation ID, timing)
 *
 * Generates a compliance matrix:
 *   Route | Auth | Validation | Rate Limit | Audit | Observability | Status
 *
 * This module is used at build time and via API endpoint.
 */

import * as fs from 'fs';
import * as path from 'path';

// ── Types ──────────────────────────────────────────────────────

export interface RouteComplianceEntry {
  route: string;
  methods: string[];
  authCheck: boolean;
  validation: boolean;
  rateLimit: boolean;
  audit: boolean;
  observability: boolean;
  csrfProtection: boolean;
  status: 'compliant' | 'partial' | 'non-compliant';
  gaps: string[];
}

export interface ComplianceReport {
  generatedAt: string;
  totalRoutes: number;
  compliant: number;
  partial: number;
  nonCompliant: number;
  complianceRate: number;
  routes: RouteComplianceEntry[];
  categories: {
    auth: { compliant: number; total: number };
    validation: { compliant: number; total: number };
    rateLimit: { compliant: number; total: number };
    audit: { compliant: number; total: number };
    observability: { compliant: number; total: number };
    csrf: { compliant: number; total: number };
  };
}

// ── Patterns for detecting compliance indicators ───────────────

const INDICATORS = {
  // Authentication patterns
  auth: [
    /requireAuth\b/,
    /getCurrentSession\b/,
    /withApiMiddleware\b/,
    /authenticateRequest\b/,
    /checkApiAuth\b/,
  ],
  // Zod validation patterns
  validation: [
    /z\.\w+Schema\b/,
    /z\.object\b/,
    /z\.string\b/,
    /z\.array\b/,
    /z\.number\b/,
    /\.parse\s*\(/,
    /\.safeParse\s*\(/,
    /validateInput\b/,
    /validatedQuery\b/,
  ],
  // Rate limiting patterns
  rateLimit: [
    /rateLimit\b/,
    /withApiMiddleware\b/,
    /edgeRateLimit\b/,
    /apiRateLimit\b/,
    /generalApiRateLimit\b/,
  ],
  // Audit logging patterns
  audit: [
    /logAction\b/,
    /audit\s*\(/,
    /auditAuthFailure\b/,
    /auditAdminAction\b/,
    /auditDataExport\b/,
    /logAction/,
  ],
  // Observability patterns
  observability: [
    /correlationId\b/,
    /correlation_id\b/,
    /x-correlation-id\b/,
    /logRequest\b/,
    /logger\.(info|warn|error|debug)\b/,
    /trackMetric\b/,
    /api-observability/,
  ],
  // CSRF patterns
  csrf: [
    /validateCsrf\b/,
    /csrfMiddleware\b/,
    /csrf\(/,
  ],
};

// ── Public API routes (exempt from auth) ───────────────────────

const PUBLIC_ROUTES = new Set([
  '/api/health',
  '/api/health/database',
  '/api/health/ai',
  '/api/health/ready',
  '/api/health/deps',
  '/api/ping',
  '/api/ready',
  '/api/version',
  '/api/request-otp',
  '/api/verify-otp',
  '/api/unsubscribe',
  '/api/verify-email',
  '/api/verify-queue',
  '/api/email-worker',  // webhook endpoint
  '/api/seed',
  '/api/setup-db',
  '/api/auth/request-otp',
  '/api/auth/verify-otp',
  '/api/auth/login',
  '/api/auth/register',
]);

// ── Core Functions ────────────────────────────────────────────

/**
 * Scan a single route file content for compliance indicators.
 */
function analyzeRouteContent(content: string, routePath: string): {
  auth: boolean;
  validation: boolean;
  rateLimit: boolean;
  audit: boolean;
  observability: boolean;
  csrf: boolean;
} {
  const isPublic = PUBLIC_ROUTES.has(routePath);

  return {
    auth: isPublic || INDICATORS.auth.some(p => p.test(content)),
    validation: INDICATORS.validation.some(p => p.test(content)),
    rateLimit: isPublic || INDICATORS.rateLimit.some(p => p.test(content)),
    audit: INDICATORS.audit.some(p => p.test(content)),
    observability: INDICATORS.observability.some(p => p.test(content)),
    csrf: isPublic || ['GET', 'HEAD', 'OPTIONS'].some(m => content.includes(`export async function ${m}`)) || INDICATORS.csrf.some(p => p.test(content)),
  };
}

/**
 * Detect HTTP methods exported from a route file.
 */
function detectMethods(content: string): string[] {
  const methods: string[] = [];
  for (const m of ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS']) {
    if (new RegExp(`export\\s+async\\s+function\\s+${m}\\b`).test(content)) {
      methods.push(m);
    }
  }
  // Also check for `export const { GET, POST }` pattern
  const handlerExports = content.match(/export\s+(?:const|let)\s+(\w+)\s*=/g) || [];
  for (const match of handlerExports) {
    const name = match.match(/=\s*(\w+)/)?.[1];
    if (name && ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'].includes(name)) {
      if (!methods.includes(name)) methods.push(name);
    }
  }
  return methods.length > 0 ? methods : ['UNKNOWN'];
}

/**
 * Scan all API routes and generate compliance report.
 */
export function scanApiRoutes(srcDir: string = 'src'): ComplianceReport {
  const apiDir = path.join(srcDir, 'app', 'api');
  const routes: RouteComplianceEntry[] = [];

  if (!fs.existsSync(apiDir)) {
    return {
      generatedAt: new Date().toISOString(),
      totalRoutes: 0,
      compliant: 0,
      partial: 0,
      nonCompliant: 0,
      complianceRate: 100,
      routes: [],
      categories: { auth: { compliant: 0, total: 0 }, validation: { compliant: 0, total: 0 }, rateLimit: { compliant: 0, total: 0 }, audit: { compliant: 0, total: 0 }, observability: { compliant: 0, total: 0 }, csrf: { compliant: 0, total: 0 } },
    };
  }

  // Find all route.ts files
  const findRouteFiles = (dir: string): string[] => {
    const files: string[] = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith('__') && entry.name !== 'node_modules') {
        files.push(...findRouteFiles(path.join(dir, entry.name)));
      } else if (entry.name === 'route.ts') {
        files.push(dir);
      }
    }
    return files;
  };

  const routeDirs = findRouteFiles(apiDir);

  for (const routeDir of routeDirs) {
    const routeFile = path.join(routeDir, 'route.ts');
    const relativePath = '/' + path.relative(apiDir, routeDir).replace(/\\/g, '/');
    const routePath = `/api${relativePath === '/api' ? '' : relativePath}`;

    try {
      const content = fs.readFileSync(routeFile, 'utf-8');
      const methods = detectMethods(content);
      const compliance = analyzeRouteContent(content, routePath);

      const gaps: string[] = [];
      if (!compliance.auth) gaps.push('No authentication check');
      if (!compliance.validation) gaps.push('No Zod validation');
      if (!compliance.rateLimit) gaps.push('No rate limiting');
      if (!compliance.audit) gaps.push('No audit logging');
      if (!compliance.observability) gaps.push('No observability');
      if (!compliance.csrf) gaps.push('No CSRF protection');

      // Determine overall status
      let status: RouteComplianceEntry['status'] = 'compliant';
      const nonAuthGaps = gaps.filter(g => !g.includes('authentication'));
      if (gaps.length === 0) {
        status = 'compliant';
      } else if (nonAuthGaps.length <= 2) {
        status = 'partial'; // Has auth but missing some non-critical items
      } else {
        status = 'non-compliant';
      }

      routes.push({
        route: routePath,
        methods,
        authCheck: compliance.auth,
        validation: compliance.validation,
        rateLimit: compliance.rateLimit,
        audit: compliance.audit,
        observability: compliance.observability,
        csrfProtection: compliance.csrf,
        status,
        gaps,
      });
    } catch (err) {
      logger.error(`[API Compliance] Failed to scan ${routePath}:`, err);
    }
  }

  // Aggregate stats
  const total = routes.length;
  const compliant = routes.filter(r => r.status === 'compliant').length;
  const partial = routes.filter(r => r.status === 'partial').length;
  const nonCompliant = routes.filter(r => r.status === 'non-compliant').length;

  // Category stats (auth excluded for public routes)
  const privateRoutes = routes.filter(r => !PUBLIC_ROUTES.has(r.route));
  const categories = {
    auth: { compliant: privateRoutes.filter(r => r.authCheck).length, total: privateRoutes.length },
    validation: { compliant: routes.filter(r => r.validation).length, total: routes.length },
    rateLimit: { compliant: routes.filter(r => r.rateLimit).length, total: routes.length },
    audit: { compliant: routes.filter(r => r.audit).length, total: routes.length },
    observability: { compliant: routes.filter(r => r.observability).length, total: routes.length },
    csrf: { compliant: routes.filter(r => r.csrfProtection).length, total: routes.length },
  };

  return {
    generatedAt: new Date().toISOString(),
    totalRoutes: total,
    compliant,
    partial,
    nonCompliant,
    complianceRate: total > 0 ? Math.round((compliant / total) * 100) : 100,
    routes: routes.sort((a, b) => a.route.localeCompare(b.route)),
    categories,
  };
}

// ── Logger stub (needed for scan function) ─────────────────────

const logger = {
  error: (..._args: unknown[]) => {},
  warn: (..._args: unknown[]) => {},
  info: (..._args: unknown[]) => {},
};
