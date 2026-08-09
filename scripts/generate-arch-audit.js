const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, HeadingLevel, WidthType, BorderStyle, ShadingType,
  PageBreak, Header, Footer, PageNumber, NumberFormat,
  TableOfContents, SectionType, ImageRun,
} = require("docx");
const fs = require("fs");

// ─── Palette: GO-1 (Government/Operations) ───
const P = {
  primary: "101820",
  body: "182030",
  secondary: "506070",
  accent: "2D7D46",
  surface: "F0F4F8",
  cover: {
    bg: "101820",
    titleColor: "FFFFFF",
    subtitleColor: "A0B0C0",
    metaColor: "708090",
    accentBar: "2D7D46",
    footerColor: "506070",
  },
  tableHeader: "1A2332",
  tableHeaderText: "FFFFFF",
  tableStripe: "F5F7FA",
  tableBorder: "D0D8E0",
  warn: "C0392B",
  caution: "D4A017",
};
const c = (hex) => hex.replace("#", "");

const allNoBorders = {
  top: { style: BorderStyle.NONE, size: 0 },
  bottom: { style: BorderStyle.NONE, size: 0 },
  left: { style: BorderStyle.NONE, size: 0 },
  right: { style: BorderStyle.NONE, size: 0 },
  insideHorizontal: { style: BorderStyle.NONE, size: 0 },
  insideVertical: { style: BorderStyle.NONE, size: 0 },
};

const thinBorderTable = {
  top: { style: BorderStyle.SINGLE, size: 1, color: P.tableBorder },
  bottom: { style: BorderStyle.SINGLE, size: 1, color: P.tableBorder },
  left: { style: BorderStyle.NONE },
  right: { style: BorderStyle.NONE },
  insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: P.tableBorder },
  insideVertical: { style: BorderStyle.NONE },
};

// ─── Helpers ───
function h1(text) {
  return new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 360, after: 160, line: 312 },
    children: [new TextRun({ text, bold: true, size: 32, color: c(P.primary), font: { ascii: "Calibri", eastAsia: "SimHei" } })] });
}
function h2(text) {
  return new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 280, after: 120, line: 312 },
    children: [new TextRun({ text, bold: true, size: 28, color: c(P.primary), font: { ascii: "Calibri", eastAsia: "SimHei" } })] });
}
function h3(text) {
  return new Paragraph({ heading: HeadingLevel.HEADING_3, spacing: { before: 200, after: 100, line: 312 },
    children: [new TextRun({ text, bold: true, size: 24, color: c(P.secondary), font: { ascii: "Calibri", eastAsia: "SimHei" } })] });
}
function body(text) {
  return new Paragraph({ alignment: AlignmentType.JUSTIFIED, indent: { firstLine: 480 }, spacing: { after: 80, line: 312 },
    children: [new TextRun({ text, size: 24, color: c(P.body), font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" } })] });
}
function bodyNI(text) {
  return new Paragraph({ alignment: AlignmentType.LEFT, spacing: { after: 80, line: 312 },
    children: [new TextRun({ text, size: 24, color: c(P.body), font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" } })] });
}
function emptyP() { return new Paragraph({ spacing: { after: 40 }, children: [] }); }

function statusCell(text, pass) {
  return new TableCell({
    children: [new Paragraph({ alignment: AlignmentType.CENTER,
      children: [new TextRun({ text, bold: true, size: 21, color: pass ? c(P.accent) : c(P.warn), font: { ascii: "Calibri" } })] })],
    margins: { top: 40, bottom: 40, left: 80, right: 80 }, width: { size: 12, type: WidthType.PERCENTAGE },
  });
}
function dataCell(text, w) {
  return new TableCell({
    children: [new Paragraph({ children: [new TextRun({ text, size: 21, color: c(P.body), font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" } })] })],
    margins: { top: 40, bottom: 40, left: 80, right: 80 }, width: { size: w || 20, type: WidthType.PERCENTAGE },
  });
}
function hdrCell(text, w) {
  return new TableCell({
    children: [new Paragraph({ alignment: AlignmentType.CENTER,
      children: [new TextRun({ text, bold: true, size: 21, color: c(P.tableHeaderText), font: { ascii: "Calibri" } })] })],
    shading: { type: ShadingType.CLEAR, fill: P.tableHeader },
    margins: { top: 40, bottom: 40, left: 80, right: 80 }, width: { size: w || 20, type: WidthType.PERCENTAGE },
  });
}
function caption(text) {
  return new Paragraph({ keepNext: true, spacing: { before: 200, after: 80, line: 312 },
    children: [new TextRun({ text, bold: true, size: 21, color: c(P.secondary), font: { ascii: "Calibri", eastAsia: "SimHei" } })] });
}

function buildTableRow(cells, isHeader) {
  return new TableRow({
    tableHeader: !!isHeader, cantSplit: true,
    children: cells,
  });
}

// ─── Cover R1 ───
function buildCoverR1() {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE }, borders: allNoBorders,
    rows: [new TableRow({
      height: { value: 16838, rule: "exact" },
      children: [new TableCell({
        width: { size: 100, type: WidthType.PERCENTAGE }, borders: allNoBorders,
        shading: { type: ShadingType.CLEAR, fill: P.cover.bg }, verticalAlign: "top",
        children: [
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE }, borders: allNoBorders,
            rows: [new TableRow({ height: { value: 120, rule: "exact" }, children: [
              new TableCell({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: allNoBorders,
                shading: { type: ShadingType.CLEAR, fill: P.cover.accentBar },
                children: [new Paragraph({ spacing: { before: 0, after: 0 }, children: [] })] })
            ]})],
          }),
          new Paragraph({ spacing: { before: 2200, after: 0 }, children: [] }),
          new Paragraph({ alignment: AlignmentType.LEFT, spacing: { before: 0, after: 120, line: 480 },
            children: [new TextRun({ text: "M4 Phase 3", bold: true, size: 56, color: c(P.cover.titleColor), font: { ascii: "Calibri", eastAsia: "SimHei" } })] }),
          new Paragraph({ alignment: AlignmentType.LEFT, spacing: { before: 0, after: 80, line: 400 },
            children: [new TextRun({ text: "Deployment Pipeline Foundation", bold: true, size: 40, color: c(P.cover.titleColor), font: { ascii: "Calibri", eastAsia: "SimHei" } })] }),
          new Paragraph({ alignment: AlignmentType.LEFT, spacing: { before: 0, after: 60, line: 360 },
            children: [new TextRun({ text: "Architecture Audit & Proposed Design", size: 30, color: c(P.cover.subtitleColor), font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" } })] }),
          new Table({
            width: { size: 30, type: WidthType.PERCENTAGE }, borders: allNoBorders,
            rows: [new TableRow({ height: { value: 60, rule: "exact" }, children: [
              new TableCell({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: allNoBorders,
                shading: { type: ShadingType.CLEAR, fill: P.cover.accentBar },
                children: [new Paragraph({ spacing: { before: 0, after: 0 }, children: [] })] })
            ]})],
          }),
          new Paragraph({ spacing: { before: 500, after: 0 }, children: [] }),
          new Paragraph({ alignment: AlignmentType.LEFT, spacing: { before: 0, after: 60, line: 300 },
            children: [new TextRun({ text: "DeepMindQ CRM \u2014 Deployment Infrastructure", size: 22, color: c(P.cover.metaColor), font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" } })] }),
          new Paragraph({ alignment: AlignmentType.LEFT, spacing: { before: 0, after: 60, line: 300 },
            children: [new TextRun({ text: "Repository: DeepMindQ/deepmindq-crm", size: 20, color: c(P.cover.metaColor), font: { ascii: "Calibri" } })] }),
          new Paragraph({ alignment: AlignmentType.LEFT, spacing: { before: 0, after: 60, line: 300 },
            children: [new TextRun({ text: "Date: 2026-08-05", size: 20, color: c(P.cover.metaColor), font: { ascii: "Calibri" } })] }),
          new Paragraph({ alignment: AlignmentType.LEFT, spacing: { before: 0, after: 60, line: 300 },
            children: [new TextRun({ text: "Classification: Internal Engineering Document", size: 20, color: c(P.cover.metaColor), font: { ascii: "Calibri" } })] }),
        ],
      })],
    })],
  });
}

function footer(fmt) {
  return new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER,
    children: [new TextRun({ children: [PageNumber.CURRENT], size: 18, color: "808080" })] })] });
}

// ─── Build Document ───
const doc = new Document({
  styles: {
    default: {
      document: { run: { font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" }, size: 24, color: c(P.body) },
        paragraph: { spacing: { line: 312 } } },
      heading1: { run: { font: { ascii: "Calibri", eastAsia: "SimHei" }, size: 32, bold: true, color: c(P.primary) },
        paragraph: { spacing: { before: 360, after: 160, line: 312 } } },
      heading2: { run: { font: { ascii: "Calibri", eastAsia: "SimHei" }, size: 28, bold: true, color: c(P.primary) },
        paragraph: { spacing: { before: 280, after: 120, line: 312 } } },
      heading3: { run: { font: { ascii: "Calibri", eastAsia: "SimHei" }, size: 24, bold: true, color: c(P.secondary) },
        paragraph: { spacing: { before: 200, after: 100, line: 312 } } },
    },
  },
  sections: [
    // Cover
    { properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 0, bottom: 0, left: 0, right: 0 } } },
      children: [buildCoverR1()] },
    // TOC
    { properties: { type: SectionType.NEXT_PAGE, page: { size: { width: 11906, height: 16838 }, margin: { top: 1440, bottom: 1440, left: 1701, right: 1417 }, pageNumbers: { start: 1, formatType: NumberFormat.UPPER_ROMAN } } },
      footers: { default: footer("roman") },
      children: [
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 480, after: 360 },
          children: [new TextRun({ text: "Table of Contents", bold: true, size: 32, font: { ascii: "Calibri", eastAsia: "SimHei" }, color: c(P.primary) })] }),
        new TableOfContents("Table of Contents", { hyperlink: true, headingStyleRange: "1-3" }),
        new Paragraph({ spacing: { before: 200 },
          children: [new TextRun({ text: "Note: Right-click the Table of Contents and select \"Update Field\" to refresh page numbers.", italics: true, size: 18, color: "888888" })] }),
        new Paragraph({ children: [new PageBreak()] }),
      ],
    },
    // Body
    { properties: { type: SectionType.NEXT_PAGE, page: { size: { width: 11906, height: 16838 }, margin: { top: 1440, bottom: 1440, left: 1701, right: 1417 }, pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL } } },
      headers: { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT,
        children: [new TextRun({ text: "M4 Phase 3 \u2014 Deployment Pipeline Architecture Audit", size: 18, color: "808080", font: { ascii: "Calibri" } })] })] }) },
      footers: { default: footer("arabic") },
      children: [
        // ═══════════════════════════════════════════════
        // 1. EXECUTIVE SUMMARY
        // ═══════════════════════════════════════════════
        h1("1. Executive Summary"),
        body("This architecture audit provides a comprehensive assessment of the current deployment infrastructure for the DeepMindQ CRM project and proposes the deployment pipeline foundation for M4 Phase 3. The audit examines existing hosting configurations, workflow files, build processes, environment strategies, database deployment approaches, and identifies the gaps that must be addressed to achieve automated, safe, and repeatable deployments."),
        body("The current deployment state is functional but manual: the application deploys to Vercel on push to `main` with GitHub auto-deploy enabled, Docker configurations exist for self-hosted deployment, and a Render.com blueprint is available as an alternative platform. However, there is no automated staging-to-production promotion pipeline, no smoke test automation, no deployment health checks, and no documented rollback procedures. The nightly regression suite provides some post-deployment validation but is not integrated into the deployment flow."),
        body("The proposed deployment architecture introduces a structured promotion pipeline: feature branch validation through CI, pull request merging to `develop` with automated staging deployment, smoke test execution against staging, approval gate for production promotion, merge to `main` with automated production deployment, and post-deployment health validation. This pipeline ensures that every production deployment is preceded by a validated staging deployment and explicit human approval."),

        // ═══════════════════════════════════════════════
        // 2. CURRENT DEPLOYMENT ARCHITECTURE
        // ═══════════════════════════════════════════════
        h1("2. Current Deployment Architecture"),

        h2("2.1 Hosting Configuration"),
        body("The DeepMindQ CRM currently supports three deployment targets: Vercel as the primary hosting platform, Docker for self-hosted deployments, and Render.com as an alternative PaaS option. Each platform has specific configuration and build requirements that affect deployment strategy."),

        h3("2.1.1 Vercel Configuration"),
        body("The `vercel.json` configuration specifies a Next.js framework build with the Mumbai region (`bom1`), a custom build command (`npm run build:vercel`), and GitHub auto-deploy integration. The build command deliberately omits `prisma migrate deploy`, executing only `prisma generate` followed by `next build`. This design decision means database migrations are not part of the Vercel build process, which avoids build-time database access but requires migrations to be executed separately."),
        body("A cron job is configured at the path `/api/cron/job-processor` with a daily schedule at 06:00 UTC. This handles background processing tasks such as AI job queue management and scheduled analytics computations. The GitHub integration is configured with `autoAlias: true` and `silent: true`, meaning Vercel automatically creates deployment aliases for PR previews without posting deployment comments to the PR."),

        h3("2.1.2 Docker Configuration"),
        body("The Dockerfile implements a three-stage multi-stage build optimized for production deployment. Stage 1 (deps) installs production dependencies only. Stage 2 (builder) generates the Prisma client, executes database migrations, and builds the Next.js application with standalone output mode. Stage 3 (runner) creates a minimal runtime image running as a non-root user (UID 1001) with a health check targeting `/api/health` on port 3000."),
        body("The docker-compose.yml orchestrates three services: a PostgreSQL 16 database with automatic health checks and data volume persistence, the application container with full environment variable passthrough and database dependency ordering, and a backup service that performs compressed PostgreSQL dumps with a 30-backup rotation policy. The Caddyfile provides reverse proxy functionality on port 81, routing requests to the Next.js application on port 3000."),

        h3("2.1.3 Render.com Blueprint"),
        body("The `render.yaml` file provides a Render.com service definition that uses the same `build:vercel` command as Vercel, deliberately avoiding database access at build time. The blueprint auto-generates the `NEXTAUTH_SECRET` environment variable and configures a post-deploy database initialization step via `POST /api/setup-db`. This configuration demonstrates platform portability but has not been tested in a live Render environment."),

        h2("2.2 GitHub Workflow Infrastructure"),
        body("The project maintains three GitHub Actions workflow files that collectively define the CI/CD infrastructure. Understanding these workflows is essential for designing the deployment pipeline because the deployment jobs must integrate with the existing CI architecture."),

        caption("Table 1: GitHub Actions Workflow Inventory"),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE }, borders: thinBorderTable,
          rows: [
            buildTableRow([hdrCell("Workflow File", 25), hdrCell("Triggers", 25), hdrCell("Jobs", 25), hdrCell("Deployment Role", 25)], true),
            buildTableRow([dataCell("ci.yml (691 lines)", 25), dataCell("push, PR, merge_group, weekly cron", 25), dataCell("20 (10 blocking + 9 info + 1 scheduled)", 25), dataCell("None \u2014 CI validation only", 25)]),
            buildTableRow([dataCell("nightly-regression.yml (165 lines)", 25), dataCell("Daily 02:00 UTC, manual", 25), dataCell("3 (regression, performance, memory)", 25), dataCell("None \u2014 post-hoc validation", 25)]),
            buildTableRow([dataCell("(deploy-staging.yml)", 25), dataCell("N/A", 25), dataCell("N/A", 25), dataCell("DOES NOT EXIST \u2014 to be created", 25)]),
            buildTableRow([dataCell("(deploy-production.yml)", 25), dataCell("N/A", 25), dataCell("N/A", 25), dataCell("DOES NOT EXIST \u2014 to be created", 25)]),
          ],
        }),
        emptyP(),
        body("The CI workflow (ci.yml) operates with 10 blocking jobs and 9 non-blocking informational jobs. Blocking jobs include security gate, dependency audit, API security contract, path check, lint and typecheck, unit tests, security tests, API tests (with database), database tests (with database), integration tests, and build verification. The concurrency group `ci-${{ github.ref }}` with `cancel-in-progress: true` prevents resource waste from redundant CI runs."),

        h2("2.3 Current Build Process"),
        body("The build process varies by deployment target. The `build:vercel` script (`npx prisma generate && npx next build`) is used for Vercel deployments and omits migration execution. The `build` script (`npx prisma generate && npx prisma migrate deploy --skip-generate && npx next build`) is used for Docker/self-hosted deployments and includes migration execution. The `vercel-build` script is identical to `build:vercel` and serves as the Vercel platform build hook."),
        body("The Next.js configuration (`next.config.ts`) conditionally sets the output mode based on the `VERCEL` environment variable. When deployed to Vercel, it uses the default output mode; for all other platforms, it uses `standalone` output for Docker compatibility. The configuration enables compression, React strict mode, and disables the `poweredByHeader` for security. TypeScript build errors are intentionally ignored (`ignoreBuildErrors: true`) to avoid OOM crashes from 80 known Prisma JsonValue type errors, with `tsc --noEmit` running as a separate CI validation step."),

        h2("2.4 Current Deployment Flow"),
        body("The current deployment flow is entirely Vercel-managed with GitHub auto-deploy. When code is pushed to the `main` branch, Vercel automatically triggers a build and deployment. There is no staging environment, no automated smoke testing, no approval gates, and no rollback mechanism beyond Vercel's built-in deployment reversion capability. This flow is functional for a single-developer project but introduces significant risk for production deployments."),
        body("The branch strategy uses a dual-trunk model: `main` represents production and `develop` represents staging/integration. However, this branching strategy exists only in documentation. In practice, Vercel deploys only from `main`, and there is no automated deployment from `develop` to a staging environment. Pull requests to `main` trigger CI validation but not deployment preview (despite the `autoAlias` configuration, deployment previews require Vercel team-level configuration)."),

        // ═══════════════════════════════════════════════
        // 3. ENVIRONMENT STRATEGY AUDIT
        // ═══════════════════════════════════════════════
        h1("3. Environment Strategy Audit"),

        h2("3.1 Current Environment Landscape"),
        body("The project currently operates with an implicit single-environment model. The development environment uses a local SQLite database (`file:/home/z/my-project/db/custom.db`) while production uses PostgreSQL. There is no explicitly configured staging environment. The `.env.example` file documents 137 lines of environment variables, but the separation between environments is managed informally through different `.env` files rather than a structured environment management system."),

        caption("Table 2: Environment Inventory"),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE }, borders: thinBorderTable,
          rows: [
            buildTableRow([hdrCell("Environment", 20), hdrCell("Database", 20), hdrCell("Hosting", 20), hdrCell("Status", 20), hdrCell("Gap", 20)], true),
            buildTableRow([dataCell("Development", 20), dataCell("SQLite (local file)", 20), dataCell("localhost:3000", 20), statusCell("ACTIVE", true), dataCell("Schema drift risk with PG", 20)]),
            buildTableRow([dataCell("Staging", 20), dataCell("Not configured", 20), dataCell("Not configured", 20), statusCell("MISSING", false), dataCell("No staging deployment exists", 20)]),
            buildTableRow([dataCell("Production", 20), dataCell("PostgreSQL 16", 20), dataCell("Vercel (bom1)", 20), statusCell("ACTIVE", true), dataCell("No automated smoke tests", 20)]),
            buildTableRow([dataCell("CI/CD", 20), dataCell("PostgreSQL 16-alpine", 20), dataCell("GitHub Actions runner", 20), statusCell("ACTIVE", true), dataCell("Ephemeral, per-job setup", 20)]),
          ],
        }),
        emptyP(),

        h2("3.2 Environment Variables"),
        body("The environment variable landscape is documented across three files: `.env.example` (137 lines), `docs/ENVIRONMENT_CONFIGURATION.md` (207 lines), and `.github/workflows/ci-environment.md` (CI-specific matrix). The variables fall into several categories: database connection strings, authentication secrets (NEXTAUTH_SECRET, SESSION_TOKEN_HMAC_SECRET), authorization configuration (AUTHORIZED_EMAIL), API key encryption, AI provider keys (NVIDIA, Fireworks, Groq, Gemini with graceful degradation), persistence engine flags, and analytics/tracking configuration."),
        body("A critical finding is that the development environment uses SQLite while all other environments use PostgreSQL. This creates a schema drift risk where SQLite-specific behaviors (such as flexible typing and different date handling) might mask issues that only appear with PostgreSQL. The `build:vercel` command deliberately skips `prisma migrate deploy`, which means Vercel deployments assume the database schema is already current. This assumption must be validated by the deployment pipeline."),

        h2("3.3 Secrets Management"),
        body("Secrets management currently relies on Vercel environment variables for production and local `.env` files for development. There is no centralized secrets management system (such as HashiCorp Vault or AWS Secrets Manager). The docker-compose.yml enforces required secrets through shell parameter expansion (`${VAR:?message}`), which prevents startup with missing variables but does not provide encrypted storage or rotation capabilities."),
        body("The CI environment uses GitHub Actions secrets for sensitive values. The nightly regression workflow and CI workflow both reference secrets through the GitHub Actions secrets API. For the proposed staging environment, secrets management will require either Vercel environment variables scoped to a staging project or a separate secrets store accessible by the deployment workflow."),

        h2("3.4 Database Separation Strategy"),
        body("The project's architecture mandates dedicated single-tenant deployment per customer, meaning each customer receives a completely isolated instance with its own database. This is documented in the architecture documentation as a fundamental design principle: no multi-tenancy, no shared tenant IDs, no cross-customer database access. This deployment model affects the pipeline design because each production deployment targets a specific customer instance rather than a shared infrastructure."),
        body("For the deployment pipeline, this means the production deployment workflow must accept a target customer identifier and deploy to that customer's specific Vercel project or infrastructure. The staging environment serves as a shared pre-production validation target, but production deployments are per-customer. This distinction must be reflected in the deployment workflow parameterization."),

        // ═══════════════════════════════════════════════
        // 4. DATABASE DEPLOYMENT STRATEGY
        // ═══════════════════════════════════════════════
        h1("4. Database Deployment Strategy Assessment"),

        h2("4.1 Prisma Migration Process"),
        body("The Prisma schema (`prisma/schema.prisma`, 3,362 lines) defines 93 models and 30+ enums with a single baseline migration (`20260701000000_init_baseline`, 3,666 lines of SQL). The migration strategy distinguishes between development and production workflows: `prisma migrate dev` for development (creates, applies, and potentially resets migrations) and `prisma migrate deploy` for production (applies pending migrations without creating new ones)."),
        body("The current state represents a baseline snapshot, meaning no incremental migrations have been applied since the initial schema was established. Future schema changes will require careful migration management to ensure forward-only, backward-compatible migrations that can be applied to production without downtime. The deployment pipeline must integrate migration execution as a distinct step with its own validation and rollback capability."),

        h2("4.2 Migration Safety Analysis"),
        body("Several migration safety concerns must be addressed in the deployment pipeline. First, the `build:vercel` command does not execute migrations, which means the pipeline must include an explicit migration step before or after deployment. Second, the Dockerfile includes `prisma migrate deploy` in the build stage, meaning Docker deployments apply migrations at container build time rather than runtime, which can lead to issues if the database is not accessible during the build."),
        body("Third, the database backup strategy in docker-compose.yml (pg_dump with gzip and 30-backup rotation) provides recovery capability but does not integrate with the deployment pipeline. A migration failure during deployment should trigger an automatic backup before attempting the migration, and the rollback procedure should restore from this backup rather than requiring manual intervention."),

        h2("4.3 Proposed Migration Workflow"),
        body("The deployment pipeline should implement the following migration workflow: (1) Pre-migration backup of the target database, (2) Dry-run migration to validate SQL compatibility, (3) Execute migration with a timeout, (4) Post-migration health check to verify schema validity, (5) Automatic rollback to the pre-migration backup if the health check fails. This workflow ensures that every schema change is applied safely with automatic recovery capability."),

        caption("Table 3: Migration Risk Assessment"),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE }, borders: thinBorderTable,
          rows: [
            buildTableRow([hdrCell("Risk", 25), hdrCell("Severity", 15), hdrCell("Mitigation", 35), hdrCell("Pipeline Phase", 25)], true),
            buildTableRow([dataCell("Migration failure mid-execution", 25), dataCell("High", 15), dataCell("Pre-migration backup + automatic restore", 35), dataCell("Phase 3.2-3.4", 25)]),
            buildTableRow([dataCell("Schema drift (dev SQLite vs prod PG)", 25), dataCell("Medium", 15), dataCell("Staging uses PostgreSQL matching production", 35), dataCell("Phase 3.2", 25)]),
            buildTableRow([dataCell("Data loss during migration", 25), dataCell("High", 15), dataCell("Backup before + column-level validation", 35), dataCell("Phase 3.4", 25)]),
            buildTableRow([dataCell("Migration timeout on large tables", 25), dataCell("Medium", 15), dataCell("Explicit timeout + lock wait configuration", 35), dataCell("Phase 3.3-3.4", 25)]),
            buildTableRow([dataCell("Missing migration in pipeline", 25), dataCell("High", 15), dataCell("Pipeline validates pending migration count", 35), dataCell("Phase 3.2-3.4", 25)]),
          ],
        }),

        // ═══════════════════════════════════════════════
        // 5. PROPOSED DEPLOYMENT ARCHITECTURE
        // ═══════════════════════════════════════════════
        h1("5. Proposed Deployment Architecture"),

        h2("5.1 Pipeline Overview"),
        body("The proposed deployment pipeline implements a structured promotion model with automated validation at each stage and explicit approval gates between environments. The pipeline is designed to integrate with the existing CI infrastructure, extending the ten-job blocking CI validation with deployment-specific stages including staging deployment, smoke testing, approval, and production deployment with health validation."),

        caption("Table 4: Deployment Pipeline Flow"),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE }, borders: thinBorderTable,
          rows: [
            buildTableRow([hdrCell("Stage", 5), hdrCell("Trigger", 20), hdrCell("Action", 25), hdrCell("Validation", 25), hdrCell("Gate", 25)], true),
            ...[
              ["1", "Push to feature branch", "CI validation (10 blocking jobs)", "All jobs pass", "Automatic"],
              ["2", "PR created to develop", "CI validation + code review", "All jobs pass + 1 approval", "Manual approval"],
              ["3", "Merge to develop", "Staging deployment to Vercel staging", "Deploy succeeds", "Automatic"],
              ["4", "Post staging deploy", "Smoke test suite execution", "All smoke tests pass", "Automatic"],
              ["5", "Smoke tests pass", "Notification to deployment channel", "Ready for production", "Manual approval"],
              ["6", "Merge to main", "Production deployment to Vercel", "Deploy succeeds", "Automatic"],
              ["7", "Post production deploy", "Health endpoint validation", "/api/health returns 200", "Automatic"],
              ["8", "Health check fails", "Automatic rollback to previous deploy", "Health restored", "Automatic"],
            ].map(([n, trigger, action, validation, gate]) =>
              buildTableRow([dataCell(n, 5), dataCell(trigger, 20), dataCell(action, 25), dataCell(validation, 25), dataCell(gate, 25)])
            ),
          ],
        }),
        emptyP(),

        h2("5.2 Branch Strategy Alignment"),
        body("The pipeline aligns with the existing dual-trunk branch strategy: `main` for production and `develop` for staging. Feature branches merge into `develop` via pull requests with CI validation. The `develop` branch triggers automated staging deployment. After smoke tests pass and approval is granted, `develop` merges into `main`, triggering production deployment. This ensures that every production deployment has been validated in staging first."),
        body("The merge_group trigger in the existing CI workflow provides additional protection by running CI validation on the merge commit before it is created. This prevents the scenario where fast-forward merges introduce unvalidated code. The deployment pipeline leverages this existing mechanism and adds deployment-specific stages on top of it."),

        h2("5.3 Staging Environment Design"),
        body("The staging environment will be a separate Vercel project configured with its own environment variables, database, and domain. The staging database will use PostgreSQL to match the production environment and eliminate the SQLite schema drift risk identified in the environment audit. The staging deployment will be triggered automatically on every push to the `develop` branch."),
        body("The staging environment must be a faithful replica of production in terms of schema, configuration, and runtime environment. The only differences should be the data volume and the domain name. AI provider keys in staging should use the same providers as production but with separate API keys or rate limits to avoid consuming production quotas. The cron job should be disabled in staging to prevent background processing from interfering with smoke tests."),

        h2("5.4 Production Deployment Design"),
        body("Production deployment will be triggered by merge to the `main` branch. The deployment workflow will execute the following steps: (1) Verify that the commit has passed through staging (by checking for a successful staging deployment of the same commit), (2) Execute database migration with pre-migration backup, (3) Trigger Vercel production deployment, (4) Wait for deployment to complete, (5) Execute health endpoint validation, (6) If health check fails, automatically rollback to the previous deployment."),
        body("The production deployment workflow must include explicit timeout protections at each step. The Vercel deployment timeout should be set to 10 minutes, the health check should have a 5-minute timeout with retry logic, and the overall workflow should have a 30-minute maximum execution time. These timeouts prevent resource waste and ensure that deployment failures are detected and reported promptly."),

        h2("5.5 Smoke Test Design"),
        body("The smoke test suite will validate that the deployed application is functional after deployment. Tests will cover: (1) Health endpoint returns 200 with expected schema, (2) Authentication endpoint responds without errors, (3) Database connectivity is established, (4) Key API endpoints (contacts, companies, deals) return valid responses, (5) Static asset serving is functional, (6) CSP headers are present. The suite should execute in under 60 seconds to provide rapid feedback."),
        body("Smoke tests will be implemented as a dedicated Vitest configuration (`vitest.smoke.config.ts`) that executes against the deployed staging or production URL. The tests will use environment variables to determine the target URL and authentication credentials. The smoke test job will run as part of the deployment workflow, not the CI workflow, to keep CI execution time within acceptable limits."),

        h2("5.6 Health Endpoint"),
        body("The health endpoint (`/api/health`) already exists and is used by the Docker health check. For the deployment pipeline, this endpoint must be enhanced to provide a structured response that includes database connectivity status, authentication system status, and application version. The enhanced health endpoint will return HTTP 200 with a JSON body when all systems are operational and HTTP 503 when any system is degraded."),
        body("The health endpoint validation in the deployment pipeline will verify three conditions: (1) HTTP response code is 200, (2) Response time is under 5 seconds, (3) Response body contains status \"ok\" for all subsystems. If any condition fails, the deployment pipeline will trigger an automatic rollback. The health check will retry three times with 30-second intervals before declaring a deployment failure."),

        h2("5.7 Rollback Procedure"),
        body("The rollback procedure will operate at two levels: automatic and manual. Automatic rollback is triggered by health check failure after production deployment. The workflow will use the Vercel API to promote the previous successful deployment, effectively reverting the application to its pre-deployment state. This operation typically completes in under 60 seconds."),
        body("Manual rollback is available through the Vercel dashboard or the Vercel CLI. The deployment pipeline will output the previous deployment ID and rollback command in the workflow summary, enabling operators to execute a manual rollback if the automatic rollback fails or if issues are detected after the health check window. The rollback procedure will be documented with step-by-step instructions in the deployment guide."),

        // ═══════════════════════════════════════════════
        // 6. IMPLEMENTATION PLAN
        // ═══════════════════════════════════════════════
        h1("6. Implementation Plan"),
        body("The implementation follows a phased approach, with each phase building on the previous one. The phases are ordered to deliver incremental value: documentation first, then environment setup, then automation. Each phase has clear deliverables and completion criteria."),

        caption("Table 5: Implementation Phases"),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE }, borders: thinBorderTable,
          rows: [
            buildTableRow([hdrCell("Phase", 15), hdrCell("Deliverable", 25), hdrCell("Key Tasks", 35), hdrCell("Completion Criteria", 25)], true),
            ...[
              ["3.1", "Deployment Documentation", "Update DEPLOYMENT_GUIDE.md with pipeline architecture, rollback procedures, environment configuration", "Document reviewed and committed"],
              ["3.2", "Environment Separation", "Create staging Vercel project, configure staging environment variables, provision staging PostgreSQL database", "Staging deploys from develop branch"],
              ["3.3", "Staging Pipeline", "Create deploy-staging.yml workflow, integrate staging deployment on develop push", "Push to develop auto-deploys to staging"],
              ["3.4", "Production Pipeline", "Create deploy-production.yml workflow, integrate production deployment on main merge with health check", "Merge to main auto-deploys to production"],
              ["3.5", "Smoke Testing", "Create vitest.smoke.config.ts, implement health/auth/db/connectivity/static tests", "Smoke suite passes on staging and production"],
              ["3.6", "Health Endpoint", "Enhance /api/health with database and auth status, structured JSON response", "Health endpoint returns subsystem status"],
              ["3.7", "Rollback Procedure", "Implement automatic rollback on health failure, document manual rollback, test rollback flow", "Rollback restores previous deployment within 60s"],
            ].map(([phase, deliverable, tasks, criteria]) =>
              buildTableRow([dataCell(phase, 15), dataCell(deliverable, 25), dataCell(tasks, 35), dataCell(criteria, 25)])
            ),
          ],
        }),
        emptyP(),

        h2("6.1 Phase Dependencies"),
        body("The phases have strict sequential dependencies. Phase 3.1 (Documentation) must be completed first because it defines the architecture and procedures that subsequent phases implement. Phase 3.2 (Environment Separation) must precede Phase 3.3 (Staging Pipeline) because the staging pipeline requires a staging environment to deploy to. Phase 3.4 (Production Pipeline) depends on Phase 3.3 because the production pipeline should mirror the staging pipeline structure. Phase 3.5 (Smoke Testing) and Phase 3.6 (Health Endpoint) can proceed in parallel after Phase 3.3. Phase 3.7 (Rollback) depends on both Phase 3.4 and Phase 3.6."),
        body("Each phase will be implemented as a separate PR to the `develop` branch, following the existing PR workflow with CI validation and code review. The CI reliability foundation implemented in M4 Phase 2 ensures that each PR is validated locally before push, preventing the CI failures that characterized earlier phases of the project."),

        // ═══════════════════════════════════════════════
        // 7. TECHNICAL DEBT AND RISK REGISTER
        // ═══════════════════════════════════════════════
        h1("7. Technical Debt and Risk Register"),

        h2("7.1 Existing Technical Debt"),
        body("The architecture audit identified several items of technical debt that are relevant to the deployment pipeline but should not block Phase 3 implementation. These items should be tracked and addressed in subsequent maintenance cycles."),

        caption("Table 6: Technical Debt Register"),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE }, borders: thinBorderTable,
          rows: [
            buildTableRow([hdrCell("Item", 30), hdrCell("Impact", 20), hdrCell("Priority", 15), hdrCell("Mitigation", 35)], true),
            ...[
              ["TypeScript errors bypassed in build (ignoreBuildErrors: true)", "Hidden type bugs may reach production", "Medium", "Fix Prisma JsonValue types incrementally"],
              ["Local dev uses SQLite, production uses PostgreSQL", "Schema drift risk", "High", "Migrate dev to PostgreSQL (Phase 3.2)"],
              ["ESLint rules mostly disabled (25+ off)", "Code quality issues accumulate", "Low", "Re-enable rules incrementally post-M4"],
              ["Hardcoded paths in .zscripts/ and some scripts/", "Path protection gaps", "Medium", "Scope expansion of path protection layer"],
              ["Single Vercel region (bom1)", "No geographic failover", "Low", "Multi-region configuration post-M4"],
              ["No vercel.project.json", "Project config only via dashboard", "Low", "Create vercel.project.json for IaC"],
            ].map(([item, impact, priority, mitigation]) =>
              buildTableRow([dataCell(item, 30), dataCell(impact, 20), dataCell(priority, 15), dataCell(mitigation, 35)])
            ),
          ],
        }),
        emptyP(),

        h2("7.2 Deployment Pipeline Risks"),
        caption("Table 7: Risk Register"),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE }, borders: thinBorderTable,
          rows: [
            buildTableRow([hdrCell("Risk", 25), hdrCell("Likelihood", 15), hdrCell("Impact", 15), hdrCell("Mitigation Strategy", 45)], true),
            ...[
              ["Staging deployment fails silently", "Low", "High", "Deploy job must verify deployment URL returns 200"],
              ["Health check gives false positive", "Medium", "Medium", "Health check validates all subsystems, not just HTTP 200"],
              ["Automatic rollback fails", "Low", "Critical", "Manual rollback documented as fallback; Vercel API verified"],
              ["Migration locks production database", "Low", "High", "Pre-migration backup + timeout + lock wait config"],
              ["Smoke tests flake on staging", "Medium", "Medium", "Retry logic + clear pass/fail criteria + dedicated config"],
              ["Environment secrets leak in logs", "Low", "Critical", "GitHub Actions secrets are masked; no echo of secrets"],
            ].map(([risk, likelihood, impact, mitigation]) =>
              buildTableRow([dataCell(risk, 25), dataCell(likelihood, 15), dataCell(impact, 15), dataCell(mitigation, 45)])
            ),
          ],
        }),

        // ═══════════════════════════════════════════════
        // 8. COMPLETION CRITERIA
        // ═══════════════════════════════════════════════
        h1("8. M4 Phase 3 Completion Criteria"),
        body("Phase 3 will be considered complete when all of the following criteria are met. Each criterion has a concrete, verifiable deliverable that can be confirmed through automated validation or manual review."),

        caption("Table 8: Phase 3 Completion Checklist"),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE }, borders: thinBorderTable,
          rows: [
            buildTableRow([hdrCell("#", 5), hdrCell("Criterion", 45), hdrCell("Verification Method", 30), hdrCell("Status", 20)], true),
            ...[
              ["1", "Deployment architecture documented", "Audit document reviewed and approved", "Pending"],
              ["2", "Staging deployment automated", "Push to develop triggers staging deploy", "Pending"],
              ["3", "Production deployment automated", "Merge to main triggers production deploy", "Pending"],
              ["4", "Smoke tests implemented", "Smoke suite passes on staging and production", "Pending"],
              ["5", "Health checks implemented", "Enhanced /api/health returns subsystem status", "Pending"],
              ["6", "Rollback procedure documented", "Automatic and manual rollback tested", "Pending"],
              ["7", "Deployment workflows validated", "End-to-end deployment flow verified via GitHub Actions", "Pending"],
            ].map(([n, criterion, method, status]) =>
              buildTableRow([dataCell(n, 5), dataCell(criterion, 45), dataCell(method, 30), statusCell("PENDING", false)])
            ),
          ],
        }),
        emptyP(),
        body("The completion criteria will be verified through a structured end-to-end deployment test: create a feature branch, implement a visible change, merge to develop, verify staging deployment, run smoke tests, approve production promotion, merge to main, verify production deployment, validate health endpoint, and test rollback by intentionally introducing a health check failure. This end-to-end test provides concrete evidence that the entire pipeline is functional before declaring Phase 3 complete."),
      ],
    },
  ],
});

Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync("/home/z/my-project/download/M4_PHASE3_DEPLOYMENT_ARCHITECTURE_AUDIT.docx", buf);
  console.log("Architecture audit document generated successfully.");
});
