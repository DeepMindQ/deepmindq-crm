import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, PageNumber, NumberFormat,
  AlignmentType, HeadingLevel, WidthType, BorderStyle, ShadingType,
  PageOrientation, TableLayoutType,
} from "docx";
import * as fs from "fs";

// ── Palette: GO-1 Graphite Orange (Tech plan) ──
const P = {
  bg: "1A2330",
  primary: "000000",
  body: "1A2330",
  secondary: "607080",
  accent: "D4875A",
  surface: "F8F0EB",
  headerBg: "D4875A",
  headerText: "FFFFFF",
  accentLine: "D4875A",
  innerLine: "DDD0C8",
  tableSurface: "F8F0EB",
  coverTitle: "FFFFFF",
  coverSubtitle: "B0B8C0",
  coverMeta: "90989F",
  coverFooter: "687078",
};

const noBorders = {
  top: { style: BorderStyle.NONE, size: 0 },
  bottom: { style: BorderStyle.NONE, size: 0 },
  left: { style: BorderStyle.NONE, size: 0 },
  right: { style: BorderStyle.NONE, size: 0 },
};
const allNoBorders = { top: noBorders.top, bottom: noBorders.bottom, left: noBorders.left, right: noBorders.right, insideHorizontal: noBorders.top, insideVertical: noBorders.left };

// ── Helpers ──
function h1(text: string) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 480, after: 200, line: 312 },
    children: [new TextRun({ text, bold: true, size: 32, font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" }, color: P.primary })],
  });
}
function h2(text: string) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 360, after: 160, line: 312 },
    children: [new TextRun({ text, bold: true, size: 28, font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" }, color: P.body })],
  });
}
function h3(text: string) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 240, after: 120, line: 312 },
    children: [new TextRun({ text, bold: true, size: 26, font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" }, color: P.body })],
  });
}
function bodyP(text: string) {
  return new Paragraph({
    spacing: { after: 120, line: 312 },
    children: [new TextRun({ text, size: 22, font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" }, color: P.body })],
  });
}
function boldBodyP(boldText: string, normalText: string) {
  return new Paragraph({
    spacing: { after: 120, line: 312 },
    children: [
      new TextRun({ text: boldText, bold: true, size: 22, font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" }, color: P.body }),
      new TextRun({ text: normalText, size: 22, font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" }, color: P.body }),
    ],
  });
}
function spacer(h = 200) {
  return new Paragraph({ spacing: { before: h } });
}

// ── Table helper ──
function makeTable(headers: string[], rows: string[][], colWidths?: number[]) {
  const totalWidth = colWidths ? colWidths.reduce((a, b) => a + b, 0) : 100;
  return new Table({
    width: { size: totalWidth, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    margins: { top: 60, bottom: 60, left: 80, right: 80 },
    rows: [
      new TableRow({
        tableHeader: true,
        cantSplit: true,
        children: headers.map((h, i) => new TableCell({
          width: colWidths ? { size: colWidths[i], type: WidthType.PERCENTAGE } : undefined,
          shading: { type: ShadingType.CLEAR, fill: P.headerBg },
          borders: { top: { style: BorderStyle.SINGLE, size: 1, color: P.accentLine }, bottom: { style: BorderStyle.SINGLE, size: 1, color: P.accentLine }, left: noBorders.left, right: noBorders.right },
          children: [new Paragraph({ spacing: { before: 40, after: 40 }, children: [new TextRun({ text: h, bold: true, size: 20, font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" }, color: P.headerText })] })],
        })),
      }),
      ...rows.map((row, ri) => new TableRow({
        cantSplit: true,
        children: row.map((cell, ci) => new TableCell({
          width: colWidths ? { size: colWidths[ci], type: WidthType.PERCENTAGE } : undefined,
          shading: { type: ShadingType.CLEAR, fill: ri % 2 === 0 ? "FFFFFF" : P.tableSurface },
          borders: { top: { style: BorderStyle.SINGLE, size: 1, color: P.innerLine }, bottom: { style: BorderStyle.SINGLE, size: 1, color: P.innerLine }, left: noBorders.left, right: noBorders.right },
          children: [new Paragraph({ spacing: { before: 40, after: 40 }, children: [new TextRun({ text: cell, size: 20, font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" }, color: P.body })] })],
        })),
      })),
    ],
  });
}

// ── Cover (R4 Top Color Block adaptation) ──
function buildCover() {
  const padL = 1200;
  const children: Paragraph[] = [
    new Paragraph({ spacing: { before: 3600 } }),
    new Paragraph({
      indent: { left: padL },
      spacing: { after: 600 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: P.accent, space: 12 } },
      children: [new TextRun({ text: "P H A S E   3", size: 18, color: P.accent, font: { ascii: "Calibri" }, characterSpacing: 60 })],
    }),
    new Paragraph({
      indent: { left: padL },
      spacing: { after: 200, line: 480, lineRule: "atLeast" },
      children: [new TextRun({ text: "Phase 3 Detailed", size: 56, bold: true, color: P.coverTitle, font: { ascii: "Calibri", eastAsia: "SimHei" } })],
    }),
    new Paragraph({
      indent: { left: padL },
      spacing: { after: 600, line: 480, lineRule: "atLeast" },
      children: [new TextRun({ text: "Execution Plan", size: 56, bold: true, color: P.coverTitle, font: { ascii: "Calibri", eastAsia: "SimHei" } })],
    }),
    new Paragraph({
      indent: { left: padL },
      spacing: { after: 400 },
      children: [new TextRun({ text: "DeepMindQ AI-Native Sales Intelligence Platform", size: 24, color: P.coverSubtitle, font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" } })],
    }),
    new Paragraph({
      indent: { left: padL },
      spacing: { after: 100 },
      border: { left: { style: BorderStyle.SINGLE, size: 8, color: P.accent, space: 12 } },
      children: [new TextRun({ text: "Pre-Phase-3 Clarification  |  Architecture Audit  |  Acceptance Criteria", size: 20, color: P.coverMeta, font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" } })],
    }),
    new Paragraph({
      indent: { left: padL },
      spacing: { after: 100 },
      border: { left: { style: BorderStyle.SINGLE, size: 8, color: P.accent, space: 12 } },
      children: [new TextRun({ text: "Date: 2026-07-24  |  Status: Awaiting Approval", size: 20, color: P.coverMeta, font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" } })],
    }),
    new Paragraph({ spacing: { before: 2000 } }),
    new Paragraph({
      indent: { left: padL, right: 800 },
      border: { top: { style: BorderStyle.SINGLE, size: 2, color: P.accent, space: 8 } },
      spacing: { before: 200 },
      children: [new TextRun({ text: "DeepMindQ  |  Confidential", size: 16, color: P.coverFooter, font: { ascii: "Calibri" } })],
    }),
  ];
  return [new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: allNoBorders,
    rows: [new TableRow({
      height: { value: 16838, rule: "exact" },
      children: [new TableCell({
        shading: { type: ShadingType.CLEAR, fill: P.bg },
        borders: noBorders,
        children,
      })],
    })],
  })];
}

// ── Main document assembly ──
const doc = new Document({
  styles: {
    default: {
      document: {
        run: { font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" }, size: 22, color: P.body },
        paragraph: { spacing: { line: 312 } },
      },
    },
  },
  sections: [
    // Cover
    {
      properties: { page: { margin: { top: 0, bottom: 0, left: 0, right: 0 } } },
      children: buildCover(),
    },
    // Body
    {
      properties: {
        page: { size: { width: 11906, height: 16838 }, margin: { top: 1440, bottom: 1440, left: 1701, right: 1417 } },
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: "DeepMindQ  |  Phase 3 Execution Plan  |  Page ", size: 16, color: P.secondary, font: { ascii: "Calibri" } }), new TextRun({ children: [PageNumber.CURRENT], size: 16, color: P.secondary, font: { ascii: "Calibri" } })],
          })],
        }),
      },
      children: [
        // ── TABLE OF CONTENTS (manual) ──
        h1("Table of Contents"),
        bodyP("1. Complete Customer Onboarding Flow"),
        bodyP("2. Core Product Workflow Validation"),
        bodyP("3. End-to-End Test Scenario"),
        bodyP("4. Architecture Audit: Final Decisions"),
        bodyP("5. UI/UX Maturity Review"),
        bodyP("6. Phase 3 Acceptance Criteria"),
        spacer(300),

        // ═══════════════════════════════════════════════════════
        // SECTION 1: Customer Onboarding Flow
        // ═══════════════════════════════════════════════════════
        h1("1. Complete Customer Onboarding Flow"),
        bodyP("This section maps every step in the customer onboarding journey, from company signup through first dashboard access. Each step identifies the frontend screen, API endpoint, database tables involved, current implementation status, and any fixes required before the flow can be demonstrated to customers or investors."),
        spacer(100),

        makeTable(
          ["Step", "Frontend Screen", "API Endpoint", "DB Tables", "Status", "Fix Required"],
          [
            ["1. Company Signup", "/signup", "POST /api/auth/register", "User", "WORKING", "Type-safe. Zod validated. First user = admin."],
            ["2. User Creation", "/signup (same flow)", "POST /api/auth/register", "User", "WORKING", "PBKDF2 hashing. Email uniqueness enforced."],
            ["3. OTP Request", "/login (step 1)", "POST /api/auth/request-otp", "OtpCode", "WORKING", "Rate-limited 5/min. Zod validated."],
            ["4. OTP Verification", "/login (step 2)", "POST /api/auth/verify-otp", "OtpCode, Session", "WORKING", "6-digit verify. Session cookie set on success."],
            ["5. Session Creation", "(automatic)", "Cookie: dmq_session", "Session", "WORKING", "HttpOnly, Secure, SameSite=Lax, 7-day TTL."],
            ["6. Middleware Check", "(automatic)", "src/middleware.ts", "Session (via DB)", "WORKING", "Edge runtime. Token presence + full DB validation."],
            ["7. Workspace Isolation", "/dashboard", "(none)", "User.role field", "MISSING", "No multi-tenancy. Single workspace. ALL users share all data."],
            ["8. First Login / Me", "/dashboard", "GET /api/auth/me", "User, Session", "WORKING", "Returns current user from session token."],
            ["9. Dashboard Load", "/dashboard", "GET /api/dashboard", "Company, Contact, Draft, SendQueue", "WORKING", "Aggregates counts. Uses correct schema fields."],
            ["10. Import Entry", "/import", "GET /api/imports", "ImportBatch", "WORKING (@ts-nocheck)", "Lists batches. Needs ts-nocheck removal."],
          ],
          [12, 14, 20, 16, 14, 24]
        ),
        spacer(100),

        h2("1.1 Critical Gap: Multi-Tenancy / Workspace Isolation"),
        bodyP("The current architecture has NO workspace isolation. Every user who registers can see ALL companies, contacts, leads, drafts, and intelligence data across the entire system. This is a fundamental architectural gap for enterprise deployment."),
        bodyP("The User model has a `role` field (admin/user) but no `workspaceId`, `organizationId`, or `tenantId`. All Prisma queries across 53 API route files query the database without any tenant filter. This means Company A's sales rep can see Company B's prospect list."),
        boldBodyP("Impact: ", "This is NOT a Phase 3 fix. Multi-tenancy is a Phase 4+ architectural decision that affects the entire data layer. For Phase 3, the system operates as a single-tenant deployment (one company = one instance). This is acceptable for demos and early pilot customers."),
        boldBodyP("Phase 3 Mitigation: ", "Document this limitation clearly. Add a note in the UI. The first user is automatically admin. For pilot deployments, each customer gets their own database/instance."),

        spacer(200),

        // ═══════════════════════════════════════════════════════
        // SECTION 2: Core Product Workflow Validation
        // ═══════════════════════════════════════════════════════
        h1("2. Core Product Workflow Validation"),
        bodyP("This section audits every step of the core product workflow: data upload, column mapping, import processing, deduplication, AI enrichment, intelligence viewing, and executive brief generation. For each step, the analysis identifies whether the API endpoint exists, whether it uses type-safe code or @ts-nocheck, the current functional status, and specific fixes required."),
        spacer(100),

        h2("2.1 Upload Pipeline"),
        makeTable(
          ["Step", "Frontend", "API Endpoint", "Status", "@ts-nocheck?", "Fix"],
          [
            ["Upload CSV/Excel", "Import Screen", "POST /api/imports (FormData)", "WORKING", "YES", "CSV only. No .xlsx support. Remove ts-nocheck."],
            ["Column Auto-Analysis", "Import Screen", "(client-side XLSX lib)", "WORKING", "N/A", "XLSX parsed client-side. Auto-mapping heuristic."],
            ["Column Mapping UI", "Import Screen", "(client-side)", "WORKING", "N/A", "Drag-drop column mapping. Confidence scoring."],
            ["Execute Import", "Import Screen", "POST /api/imports (JSON action=execute)", "WORKING", "YES", "Batch lookup, dedup check, transactional."],
            ["Import Status", "Import Screen", "GET /api/imports", "WORKING", "YES", "Returns all batches with row counts."],
            ["Excel Upload (.xlsx)", "Import Screen", "N/A", "NOT SUPPORTED", "N/A", "Import route rejects .xlsx with 400 error."],
          ],
          [16, 14, 28, 12, 12, 18]
        ),
        spacer(100),

        bodyP("Key Finding: The upload pipeline DOES exist and works for CSV files. The /api/imports endpoint handles both staging (CSV upload + preview) and execution (mapped row import with dedup). However, it uses @ts-nocheck and has a schema mismatch."),
        boldBodyP("Schema Mismatch Bug: ", "The imports/route.ts queries `db.company.findMany({ where: { name: ... } })` and `db.company.create({ data: { name: companyName } })`. However, the Prisma schema has NO `name` field on Company. The correct field is `rawName`. This route will FAIL at runtime against PostgreSQL."),
        boldBodyP("Fix (Phase 3, Priority 1): ", "Replace all `name` references in imports/route.ts with `rawName`. Add `normalizedName` computation. This is the FIRST work item per user's approval condition."),

        spacer(100),
        h2("2.2 Post-Import Pipeline"),
        makeTable(
          ["Step", "Frontend", "API Endpoint", "Status", "@ts-nocheck?", "Fix"],
          [
            ["Deduplication", "Duplicates Screen", "GET /api/leads/dedup", "EXISTS, UNTESTED", "NO", "Jaccard similarity on rawName. Uses correct schema."],
            ["Merge Duplicates", "Duplicates Screen", "POST /api/leads/dedup", "EXISTS, UNTESTED", "NO", "Merges secondary into primary contact."],
            ["AI Enrichment", "Company Detail", "POST /api/ai/enrich", "EXISTS, UNTESTED", "NO", "Web search + LLM extraction. Uses correct schema."],
            ["Lead Scoring", "Leads Screen", "POST /api/ai/score-leads", "EXISTS, UNTESTED", "YES", "Remove ts-nocheck. Test with real data."],
            ["Intelligence View", "Company Detail", "GET /api/companies/[id]/intelligence", "EXISTS, UNTESTED", "YES", "Web search + AI analysis. Remove ts-nocheck."],
            ["Exec Brief", "Revenue Intel", "POST /api/ai/account-brief", "EXISTS, UNTESTED", "YES", "Multi-source research + LLM brief. Remove ts-nocheck."],
            ["Company Research", "Company Detail", "POST /api/companies/enrich", "EXISTS, UNTESTED", "NO", "Fetches website + AI extraction."],
          ],
          [16, 14, 28, 14, 12, 16]
        ),
        spacer(100),

        bodyP("All post-import endpoints EXIST in the codebase with complete implementations. None are missing. However, all remain untested against a real PostgreSQL database. The AI-dependent endpoints (enrich, intelligence, account-brief) require the Z-AI SDK and proper configuration to function."),

        spacer(200),

        // ═══════════════════════════════════════════════════════
        // SECTION 3: E2E Test Scenario
        // ═══════════════════════════════════════════════════════
        h1("3. End-to-End Test Scenario"),
        bodyP("The following test scenario traces a complete customer journey from initial signup through data import, AI enrichment, and executive brief generation. Every step identifies the frontend screen, API endpoint, database tables, current status, and any blocking issues."),
        spacer(100),

        h2("Scenario: Acme Corp Signs Up and Imports 100 Companies"),
        spacer(100),

        makeTable(
          ["#", "Step Description", "Frontend Screen", "API Endpoint", "DB Tables", "Status"],
          [
            ["1", "Navigate to deployment URL", "Landing Page", "(static)", "N/A", "WORKING"],
            ["2", "Create account (name, email, password)", "/signup", "POST /api/auth/register", "User, OtpCode", "WORKING"],
            ["3", "OTP sent to email (dev: console log)", "/login", "POST /api/auth/request-otp", "OtpCode", "WORKING"],
            ["4", "Enter 6-digit OTP, session created", "/login", "POST /api/auth/verify-otp", "OtpCode, Session", "WORKING"],
            ["5", "Redirect to dashboard", "/dashboard", "GET /api/dashboard", "Company, Contact", "WORKING"],
            ["6", "Navigate to Import screen", "/import", "GET /api/imports", "ImportBatch", "WORKING"],
            ["7", "Upload CSV with 100 companies", "Import Screen", "POST /api/imports (FormData)", "ImportBatch", "BLOCKED: schema mismatch"],
            ["8", "Review auto-mapped columns", "Import Screen", "(client-side)", "N/A", "WORKING"],
            ["9", "Adjust mapping, confirm", "Import Screen", "(client-side)", "N/A", "WORKING"],
            ["10", "Execute import (action=execute)", "Import Screen", "POST /api/imports (JSON)", "ImportBatch, Company, Contact, TimelineEntry", "BLOCKED: schema mismatch"],
            ["11", "View import results (accept/dup/invalid)", "Import Screen", "GET /api/imports", "ImportBatch", "WORKING"],
            ["12", "Navigate to Companies screen", "/companies", "GET /api/companies", "Company", "WORKING"],
            ["13", "Click company, view detail", "Company Detail", "GET /api/companies/[id]", "Company, ResearchCard", "WORKING"],
            ["14", "Run AI enrichment on company", "Company Detail", "POST /api/ai/enrich", "Company, ResearchCard", "UNTESTED: needs DB"],
            ["15", "View intelligence report", "Company Detail", "GET /api/companies/[id]/intelligence", "Company, Signal, Evidence", "UNTESTED: needs DB"],
            ["16", "Generate executive brief", "Revenue Intel", "POST /api/ai/account-brief", "Company, AccountBrief, OpportunitySignal", "UNTESTED: needs DB"],
            ["17", "View AI recommendations", "Revenue Intel", "POST /api/ai/recommendations", "OpportunityRecommendation", "UNTESTED: needs DB"],
            ["18", "Review dashboard with live data", "/dashboard", "GET /api/dashboard", "Company, Contact, Draft, SendQueue", "WORKING"],
          ],
          [4, 26, 14, 26, 20, 10]
        ),
        spacer(100),

        h2("3.1 Blocking Issues"),
        boldBodyP("Blocker 1 - Schema Mismatch (Steps 7, 10): ", "The /api/imports route references `company.name` which does not exist in the Prisma schema. The correct field is `company.rawName`. This causes a Prisma runtime error. Fix: Replace all `name` references with `rawName` in imports/route.ts and compute `normalizedName`. This is Priority 1 in Phase 3."),
        boldBodyP("Blocker 2 - No Database (Steps 14-17): ", "Steps 14 through 17 require a running PostgreSQL database with imported data. The sandbox environment has no DATABASE_URL. Fix: Connect to a Neon/Render PostgreSQL instance within the first 48 hours of Phase 3 (per user's approval condition)."),
        boldBodyP("Blocker 3 - .xlsx Not Supported (Step 7): ", "The import route only accepts .csv files. Enterprise customers commonly use .xlsx. Fix: Add xlsx parsing support using the 'xlsx' npm package (already in devDependencies) in the imports route."),

        spacer(200),

        // ═══════════════════════════════════════════════════════
        // SECTION 4: Architecture Audit
        // ═══════════════════════════════════════════════════════
        h1("4. Architecture Audit: Final Decisions"),
        spacer(100),

        h2("4.1 Production-Ready Routes (Type-Safe, Complete Implementation)"),
        bodyP("The following routes are implemented with proper Zod validation, type-safe Prisma queries, and correct schema field usage. They are ready for production deployment with database connection:"),
        spacer(60),

        makeTable(
          ["Route", "Methods", "Description"],
          [
            ["POST /api/auth/register", "POST", "User registration with Zod, PBKDF2, OTP"],
            ["POST /api/auth/request-otp", "POST", "OTP generation with rate limiting"],
            ["POST /api/auth/verify-otp", "POST", "OTP verification + session creation"],
            ["POST /api/auth/logout", "POST", "Session destruction"],
            ["GET /api/auth/me", "GET", "Current user from session"],
            ["POST /api/auth/change-password", "POST", "Password change with OTP confirmation"],
            ["POST /api/auth/update-profile", "POST", "Profile update with OTP confirmation"],
            ["POST /api/auth/set-password", "POST", "First-time password set via OTP"],
            ["POST /api/auth/reset-password", "POST", "Password reset request"],
            ["POST /api/auth/reset-password/confirm", "POST", "Password reset confirmation"],
            ["POST /api/auth/login", "POST", "Password-based login (legacy, still functional)"],
            ["src/middleware.ts", "ALL", "Edge middleware: auth, CSRF, rate limit, security headers"],
          ],
          [30, 10, 60]
        ),

        spacer(100),
        h2("4.2 Routes That Exist But Need Fixes (@ts-nocheck or Schema Issues)"),
        bodyP("These routes have complete implementations but carry @ts-nocheck or have known schema mismatches. They must be fixed during Phase 3:"),
        spacer(60),

        makeTable(
          ["Route", "Issue", "Priority", "Fix Phase"],
          [
            ["POST /api/imports", "@ts-nocheck + schema mismatch (uses `name` not `rawName`)", "CRITICAL", "Phase 3 (first)"],
            ["GET /api/leads/dedup", "Untested but type-safe. Verify at runtime.", "HIGH", "Phase 3 (DB test)"],
            ["POST /api/leads/dedup", "Untested but type-safe. Verify at runtime.", "HIGH", "Phase 3 (DB test)"],
            ["POST /api/ai/enrich", "Untested but type-safe. Needs real DB.", "HIGH", "Phase 3 (DB test)"],
            ["GET /api/companies/[id]/intelligence", "@ts-nocheck. Type-safe conversion needed.", "HIGH", "Phase 3"],
            ["POST /api/ai/account-brief", "@ts-nocheck. Type-safe conversion needed.", "HIGH", "Phase 3"],
            ["POST /api/ai/score-leads", "@ts-nocheck. Type-safe conversion needed.", "MEDIUM", "Phase 3"],
            ["POST /api/ai/query", "Untested but type-safe.", "MEDIUM", "Phase 3"],
            ["POST /api/ai/recommendations", "Untested but type-safe.", "MEDIUM", "Phase 3"],
            ["GET /api/analytics", "@ts-nocheck. Untested.", "MEDIUM", "Phase 3"],
            ["GET /api/reports/* (4 routes)", "@ts-nocheck. Untested.", "MEDIUM", "Phase 3"],
            ["POST /api/emails/send", "@ts-nocheck. Email delivery untested.", "LOW", "Phase 3"],
          ],
          [30, 40, 12, 18]
        ),

        spacer(100),
        h2("4.3 Dead Code Routes (Legacy, Demo, Unreferenced)"),
        bodyP("These routes exist in the codebase but serve no functional purpose in the current product direction. They should be deleted in Phase 3 to reduce attack surface and maintenance burden:"),
        spacer(60),

        makeTable(
          ["Category", "Count", "Examples", "Action"],
          [
            ["Demo/Seed routes", "2", "/api/seed, /api/reset", "DELETE in Phase 3"],
            ["Legacy NextAuth route", "1", "/api/auth/[...nextauth]", "DELETE in Phase 3 (replaced by custom OTP auth)"],
            ["Demo data screen", "1", "demo-experience-screen.tsx", "DELETE in Phase 3"],
            ["Backup file", "1", "route.ts.bak (ai/chat)", "DELETE in Phase 3"],
            ["Unreferenced capabilities routes", "5", "/api/capabilities/import, enrich, export, dedup-check, [id]/children", "REVIEW - may have product value"],
            ["Unused UI screens (legacy CRM)", "4", "Settings.tsx, Knowledge.tsx, Tasks.tsx, EmailGen.tsx in /app/crm/", "DELETE - replaced by component screens"],
          ],
          [22, 8, 42, 28]
        ),

        spacer(100),
        h2("4.4 @ts-nocheck Classification"),
        bodyP("Of the 42 files with @ts-nocheck, here is the classification by criticality:"),
        spacer(60),

        makeTable(
          ["Category", "Count", "Action", "Phase"],
          [
            ["CRITICAL: Core product flow (imports, intelligence, account-brief)", "3", "Must fix before customer deployment", "Phase 3"],
            ["HIGH: AI endpoints (scoring, recommendations, query)", "5", "Fix in Phase 3 after DB connection", "Phase 3"],
            ["MEDIUM: Reports, analytics, batches, sequences", "10", "Fix in Phase 3 where possible", "Phase 3"],
            ["LOW: Library code (revenue-intelligence, ai-copilot, account-prioritization)", "7", "Acceptable temporarily. Fix in Phase 4.", "Phase 4"],
            ["LOW: Legacy CRM screens (Settings, Knowledge, Tasks, EmailGen, components)", "5", "DELETE in Phase 3 (replaced by new screens)", "Phase 3"],
            ["LOW: Standalone screens (intelligence-reasoning)", "1", "Fix in Phase 4", "Phase 4"],
            ["ACCEPTABLE: Utility/shared code in non-critical paths", "11", "Monitor. No immediate fix needed.", "Phase 4+"],
          ],
          [40, 8, 34, 18]
        ),

        spacer(100),
        h2("4.5 Multi-Company Enterprise Deployment"),
        makeTable(
          ["Question", "Answer"],
          [
            ["Does the schema support multi-tenancy?", "NO. No workspaceId, tenantId, or organizationId on any model."],
            ["Can multiple companies use the same instance?", "Only as separate data sets, not isolated. All users see all data."],
            ["What is the recommended deployment model?", "One database per customer (single-tenant)."],
            ["When will multi-tenancy be added?", "Phase 4+ after product-market fit validation."],
          ],
          [30, 70]
        ),

        spacer(200),

        // ═══════════════════════════════════════════════════════
        // SECTION 5: UI/UX Maturity Review
        // ═══════════════════════════════════════════════════════
        h1("5. UI/UX Maturity Review"),
        bodyP("This section reviews every customer-facing screen for enterprise readiness, professional B2B quality, missing states, and redesign priority."),
        spacer(100),

        h2("5.1 Screen Inventory and Assessment"),
        makeTable(
          ["Screen", "File", "Enterprise-Grade?", "Missing States", "Redesign Priority"],
          [
            ["Landing Page", "page.tsx", "YES - Modern, animated", "None", "LOW"],
            ["Login", "login/page.tsx", "YES - Two-step OTP flow", "Loading state", "LOW"],
            ["Signup", "signup/page.tsx", "YES - Clean form", "Loading state", "LOW"],
            ["Dashboard", "dashboard-screen.tsx", "PARTIAL - Good charts, hardcoded badges", "Error, empty, loading", "MEDIUM"],
            ["Import", "import-screen.tsx", "PARTIAL - Full flow, no .xlsx", "Error, progress %", "MEDIUM"],
            ["Companies", "companies-screen.tsx", "PARTIAL - Good list, missing filters", "Empty, loading", "MEDIUM"],
            ["Company Detail", "company-detail-screen.tsx", "PARTIAL - Rich but untested", "Error, empty", "MEDIUM"],
            ["Leads", "leads-screen.tsx", "PARTIAL - Table view functional", "Error, empty, loading", "MEDIUM"],
            ["Draft Review", "drafts-screen.tsx", "BASIC - Functional", "Error, empty, loading", "HIGH"],
            ["Send Queue", "queue-screen.tsx", "BASIC - Functional", "Error, empty", "HIGH"],
            ["Duplicates", "duplicates-screen.tsx", "BASIC - Functional", "Error, empty", "MEDIUM"],
            ["Settings", "settings-screen.tsx", "BASIC - Multiple tabs", "Error, save feedback", "HIGH"],
            ["Revenue Intel", "revenue-intelligence-screen.tsx", "ADVANCED - Rich AI output", "Error, loading", "LOW"],
            ["Intelligence Brief", "revenue-intelligence-brief-screen.tsx", "ADVANCED - Professional layout", "Error, loading", "LOW"],
            ["Demo Experience", "demo-experience-screen.tsx", "N/A - DELETE", "N/A", "DELETE"],
          ],
          [14, 26, 18, 18, 14]
        ),

        spacer(100),
        h2("5.2 Global Missing States"),
        bodyP("Most screens share common UX gaps that must be addressed for enterprise readiness:"),
        makeTable(
          ["Missing State", "Affected Screens", "Impact", "Fix"],
          [
            ["Error Boundary (per-screen)", "All 15+ screens", "Uncaught errors crash entire app", "ScreenErrorBoundary exists but needs testing"],
            ["Empty State", "Dashboard, Companies, Leads, Drafts, Queue", "Shows blank page when no data", "Add EmptyState component with CTA"],
            ["Loading Skeleton", "Dashboard, Companies, Leads, Import", "No visual feedback during fetch", "Add Skeleton components (already in UI lib)"],
            ["Success Feedback", "Import, Settings, all forms", "No toast/confirmation after action", "Sonner toast exists - wire up to all mutations"],
            ["Error Feedback", "All API-calling screens", "No error display on API failure", "Add error toast + retry button"],
            ["Offline State", "All screens", "No indication when API unreachable", "Add network status indicator"],
          ],
          [18, 28, 28, 26]
        ),

        spacer(100),
        h2("5.3 Professional B2B Quality Assessment"),
        boldBodyP("Is this enterprise-grade? ", "Getting close. The landing page, login, and signup are modern and professional. The dashboard has real charts (Recharts), animated counters, and activity feeds. However, several screens feel like internal tools rather than customer-facing products. The drafts screen, send queue, and settings lack polish."),
        boldBodyP("What screens need redesign before showing customers? ", "The following screens must be polished before any investor demo or pilot customer deployment: (1) Import screen - add .xlsx support and progress indicators, (2) Settings screen - consolidate tabs and add clear save feedback, (3) Draft Review screen - add approval/rejection workflow UI, (4) Leads screen - add bulk actions and advanced filters."),
        boldBodyP("Overall UI Maturity Score: 6.5/10. ", "The foundation is solid with shadcn/ui components, Framer Motion animations, and a consistent design system. Phase 3 focuses on error handling and missing states. Phase 4 will address micro-interactions and visual polish."),

        spacer(200),

        // ═══════════════════════════════════════════════════════
        // SECTION 6: Phase 3 Acceptance Criteria
        // ═══════════════════════════════════════════════════════
        h1("6. Phase 3 Acceptance Criteria"),
        bodyP("Phase 3 is the hardening phase. Its success is measured by the following measurable completion criteria. Each criterion has a specific measurement method and target threshold. Phase 3 will be considered COMPLETE only when ALL criteria pass."),
        spacer(100),

        h2("6.1 Phase 3 Objective"),
        bodyP("Transform the codebase from a working prototype into a production-ready application by: (1) fixing the upload/import pipeline as the first work item, (2) connecting to a real PostgreSQL database and running E2E tests, (3) removing @ts-nocheck from all critical-path files, (4) deleting dead code and demo routes, (5) adding error boundaries and missing UI states, and (6) verifying security controls (auth, CSRF, rate limiting) work at runtime."),
        spacer(100),

        h2("6.2 Measurable Completion Criteria"),
        makeTable(
          ["Criteria", "How to Measure", "Target", "Priority"],
          [
            ["E2E Customer Journey", "Manual test: signup -> login -> import -> dedup -> enrich -> brief", "All 18 steps pass", "CRITICAL"],
            ["Upload Pipeline Working", "Test with 100-company CSV + 2000-company CSV", "Both pass. 2000 rows < 30s", "CRITICAL"],
            ["Schema Mismatch Fixed", "grep -r 'company\\.name' in imports route", "0 occurrences", "CRITICAL"],
            ["No Critical @ts-nocheck", "grep '@ts-nocheck' in auth, import, ai/* routes", "0 in critical paths", "HIGH"],
            ["Production DB Connected", "npx prisma db push succeeds", "Schema applied without errors", "CRITICAL"],
            ["Dead Code Deleted", "Count of deleted files", "6+ files removed (seed, reset, demo, bak, nextauth)", "HIGH"],
            ["Error Boundaries Tested", "Trigger error on each screen", "ScreenErrorBoundary catches, shows recovery UI", "HIGH"],
            ["Empty States Added", "Visit each screen with empty DB", "All screens show EmptyState, not blank page", "MEDIUM"],
            ["Security Verified", "Test auth, CSRF, rate limiting", "Unauthenticated requests blocked. CSRF validated.", "CRITICAL"],
            ["Deployment Working", "Deploy to Render/Cloudflare Pages", "Live URL accessible. All routes respond.", "HIGH"],
            ["AI Endpoints Tested", "Call enrich + account-brief with real data", "Returns structured intelligence data", "HIGH"],
            ["No New Lint Errors", "npx next lint", "0 new errors (existing 63 pre-existing)", "MEDIUM"],
          ],
          [20, 34, 30, 16]
        ),

        spacer(100),
        h2("6.3 Phase 3 Scope: Files Affected"),
        makeTable(
          ["Category", "Files", "Action"],
          [
            ["Import Pipeline Fix", "src/app/api/imports/route.ts", "Fix schema mismatch. Remove @ts-nocheck. Add .xlsx support."],
            ["@ts-nocheck Removal (Critical)", "imports, companies/[id]/intelligence, ai/account-brief, ai/score-leads, ai/query, ai/recommendations, analytics, 4x reports, emails/send, batches, sequences", "Remove @ts-nocheck. Fix type errors."],
            ["Dead Code Deletion", "src/app/api/seed/route.ts, /api/reset/route.ts, /api/auth/[...nextauth]/, /app/crm/*.tsx (5 files), demo-experience-screen.tsx, route.ts.bak", "Delete files."],
            ["Error Boundaries", "All component/screens/*.tsx files", "Test existing ScreenErrorBoundary. Add per-screen error display."],
            ["Empty States", "dashboard, companies, leads, drafts, queue, import screens", "Add EmptyState components with appropriate CTAs."],
            ["Loading States", "dashboard, companies, leads, import screens", "Add Skeleton loading indicators during API fetch."],
            ["Database Connection", ".env (DATABASE_URL), prisma/schema.prisma", "Connect to Neon/Render PostgreSQL. Run db push."],
            ["Middleware Hardening", "src/middleware.ts", "Verify all routes properly protected. Test CSRF + rate limit."],
          ],
          [18, 52, 30]
        ),

        spacer(100),
        h2("6.4 Expected Outcomes"),
        bodyP("Upon completion of Phase 3, the DeepMindQ platform will be in a state suitable for pilot customer deployment and investor demonstrations. Specifically:"),
        bodyP("1. A complete working flow from signup through data import, AI enrichment, and executive brief generation, all tested against a real PostgreSQL database."),
        bodyP("2. Zero @ts-nocheck files in the critical auth, import, and AI pipeline paths, giving confidence in type safety and reducing runtime surprise errors."),
        bodyP("3. All dead code and demo artifacts removed, reducing the attack surface and making the codebase easier to navigate and maintain."),
        bodyP("4. Every customer-facing screen handling error, empty, and loading states gracefully, with clear user feedback via toast notifications."),
        bodyP("5. Security controls (authentication, CSRF protection, rate limiting, security headers) verified working at runtime against the production database."),
        bodyP("6. The application deployable to Render or Cloudflare Pages with a live, accessible URL for external testing."),
        spacer(100),

        h2("6.5 Phase 3 Execution Order (Priority Sequence)"),
        bodyP("Phase 3 work items are executed in this strict priority order, based on the user's approval conditions:"),
        spacer(60),

        makeTable(
          ["Priority", "Work Item", "Rationale", "Est. Effort"],
          [
            ["1 (CRITICAL)", "Fix imports/route.ts schema mismatch", "Blocks the entire upload pipeline. User's approval condition.", "2 hours"],
            ["2 (CRITICAL)", "Connect to PostgreSQL database", "Blocks ALL runtime E2E tests. User's approval condition.", "1 hour"],
            ["3 (CRITICAL)", "Run E2E customer journey test (18 steps)", "Validates entire product flow end-to-end.", "3 hours"],
            ["4 (CRITICAL)", "Test upload with 100 + 2000 companies", "Validates import pipeline performance and correctness.", "2 hours"],
            ["5 (HIGH)", "Remove @ts-nocheck from critical paths (3 files)", "intelligence, account-brief, imports", "3 hours"],
            ["6 (HIGH)", "Delete dead code (7+ files)", "Reduce attack surface and maintenance burden.", "1 hour"],
            ["7 (HIGH)", "Add error boundaries + empty states", "Enterprise-grade UX requirement.", "4 hours"],
            ["8 (HIGH)", "Verify security controls at runtime", "Auth, CSRF, rate limiting against real DB.", "2 hours"],
            ["9 (MEDIUM)", "Remove @ts-nocheck from medium-priority files", "Reports, analytics, batches, sequences.", "3 hours"],
            ["10 (MEDIUM)", "Add loading skeletons to all screens", "UX polish for loading states.", "2 hours"],
            ["11 (MEDIUM)", "Deploy to Render/Cloudflare Pages", "Live URL for external testing.", "1 hour"],
            ["12 (LOW)", "Final lint check + documentation", "Zero new errors. Update worklog.", "1 hour"],
          ],
          [14, 40, 30, 16]
        ),

        spacer(100),
        bodyP("Total estimated Phase 3 effort: approximately 25 hours of focused development work. The first 4 items (approximately 8 hours) must be completed within the first 48 hours per the user's Phase 2 approval conditions."),
        spacer(200),

        h2("6.6 Approval Gate"),
        bodyP("This execution plan is submitted for review and approval. Once approved, Phase 3 execution begins immediately with Priority 1 (imports/route.ts schema fix). The 48-hour clock for database connection and E2E testing starts upon plan approval."),
        spacer(60),
        boldBodyP("Awaiting: ", "User approval to proceed with Phase 3 execution."),
      ],
    },
  ],
});

// ── Generate ──
const OUTPUT = "/home/z/my-project/download/Phase3-Detailed-Execution-Plan.docx";
Packer.toBuffer(doc).then((buffer) => {
  fs.writeFileSync(OUTPUT, buffer);
  console.log("Generated:", OUTPUT);
});
