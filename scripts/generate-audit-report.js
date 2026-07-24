const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, PageNumber, AlignmentType, HeadingLevel, WidthType,
  BorderStyle, ShadingType, TableLayoutType, PageBreak, TableOfContents,
  LevelFormat, TabStopType, TabStopPosition,
} = require("docx");
const fs = require("fs");

// ── Palette: Deep Sea Tech (Cool + Heavy + Calm) ──
const P = {
  primary: "0F2027", body: "000000", secondary: "4A6575",
  accent: "0EA5E9", surface: "F0F6FA", bg: "0F2027",
  titleColor: "FFFFFF", subtitleColor: "B0C4D8", metaColor: "8BA4B8", footerColor: "607888",
};
const c = (hex) => hex;

// ── Helper: all no borders ──
const allNoBorders = {
  top: { style: BorderStyle.NONE, size: 0 },
  bottom: { style: BorderStyle.NONE, size: 0 },
  left: { style: BorderStyle.NONE, size: 0 },
  right: { style: BorderStyle.NONE, size: 0 },
  insideHorizontal: { style: BorderStyle.NONE, size: 0 },
  insideVertical: { style: BorderStyle.NONE, size: 0 },
};
const noBorders = {
  top: { style: BorderStyle.NONE, size: 0 },
  bottom: { style: BorderStyle.NONE, size: 0 },
  left: { style: BorderStyle.NONE, size: 0 },
  right: { style: BorderStyle.NONE, size: 0 },
};

// ── Helpers ──
function heading(text, level = HeadingLevel.HEADING_1) {
  return new Paragraph({
    heading: level,
    spacing: { before: level === HeadingLevel.HEADING_1 ? 400 : 280, after: 140 },
    children: [new TextRun({
      text, bold: true, color: c(P.primary),
      font: { ascii: "Calibri", eastAsia: "SimHei" },
      size: level === HeadingLevel.HEADING_1 ? 32 : level === HeadingLevel.HEADING_2 ? 28 : 26,
    })],
  });
}

function h3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 220, after: 100 },
    children: [new TextRun({
      text, bold: true, color: c(P.secondary),
      font: { ascii: "Calibri", eastAsia: "SimHei" }, size: 24,
    })],
  });
}

function body(text) {
  return new Paragraph({
    alignment: AlignmentType.LEFT,
    spacing: { line: 312, after: 80 },
    children: [new TextRun({
      text, size: 22, color: c(P.body),
      font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" },
    })],
  });
}

function bullet(text) {
  return new Paragraph({
    spacing: { line: 312, after: 60 },
    indent: { left: 480, hanging: 240 },
    children: [
      new TextRun({ text: "\u2022 ", size: 22, color: c(P.accent) }),
      new TextRun({ text, size: 22, color: c(P.body),
        font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" } }),
    ],
  });
}

function statusBadge(status) {
  const colors = {
    "PASS": "16A34A", "WARN": "D97706", "FAIL": "DC2626",
    "CRITICAL": "DC2626", "OK": "16A34A", "N/A": "6B7280",
  };
  const bgs = {
    "PASS": "DCFCE7", "WARN": "FEF3C7", "FAIL": "FEE2E2",
    "CRITICAL": "FEE2E2", "OK": "DCFCE7", "N/A": "F3F4F6",
  };
  const col = colors[status] || "6B7280";
  const bg = bgs[status] || "F3F4F6";
  return new TextRun({
    text: ` [${status}] `, size: 18, bold: true,
    color: col, font: { ascii: "Calibri" },
    shading: { type: ShadingType.CLEAR, fill: bg },
  });
}

function bodyWithStatus(text, status) {
  return new Paragraph({
    spacing: { line: 312, after: 60 },
    children: [
      statusBadge(status),
      new TextRun({ text, size: 22, color: c(P.body),
        font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" } }),
    ],
  });
}

function spacer(h = 120) {
  return new Paragraph({ spacing: { before: h } });
}

function metricRow(label, value, status) {
  return new TableRow({
    children: [
      new TableCell({
        width: { size: 50, type: WidthType.PERCENTAGE },
        borders: { ...noBorders, bottom: { style: BorderStyle.SINGLE, size: 1, color: "E0E7EE" } },
        margins: { top: 60, bottom: 60, left: 120, right: 80 },
        children: [new Paragraph({
          children: [new TextRun({ text: label, size: 21, color: c(P.secondary),
            font: { ascii: "Calibri" } })],
        })],
      }),
      new TableCell({
        width: { size: 25, type: WidthType.PERCENTAGE },
        borders: { ...noBorders, bottom: { style: BorderStyle.SINGLE, size: 1, color: "E0E7EE" } },
        margins: { top: 60, bottom: 60, left: 80, right: 80 },
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: String(value), size: 21, bold: true, color: c(P.body),
            font: { ascii: "Calibri" } })],
        })],
      }),
      new TableCell({
        width: { size: 25, type: WidthType.PERCENTAGE },
        borders: { ...noBorders, bottom: { style: BorderStyle.SINGLE, size: 1, color: "E0E7EE" } },
        margins: { top: 60, bottom: 60, left: 80, right: 120 },
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [statusBadge(status)],
        })],
      }),
    ],
  });
}

function metricTable(rows) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: { ...allNoBorders, top: { style: BorderStyle.SINGLE, size: 2, color: c(P.accent) } },
    rows: [
      new TableRow({
        children: ["Metric", "Value", "Status"].map((h, i) =>
          new TableCell({
            width: { size: i === 0 ? 50 : 25, type: WidthType.PERCENTAGE },
            borders: { ...noBorders, bottom: { style: BorderStyle.SINGLE, size: 2, color: c(P.accent) } },
            margins: { top: 80, bottom: 80, left: 120, right: 120 },
            children: [new Paragraph({
              children: [new TextRun({ text: h, size: 20, bold: true, color: c(P.accent),
                font: { ascii: "Calibri" } })],
            })],
          })
        ),
      }),
      ...rows.map(r => metricRow(r[0], r[1], r[2])),
    ],
  });
}

// ── Cover R1: Pure Paragraph Left ──
function buildCover() {
  const padL = 1200;
  const accentLeft = { style: BorderStyle.SINGLE, size: 8, color: c(P.accent), space: 12 };
  const children = [
    new Paragraph({ spacing: { before: 4800 } }),
    new Paragraph({
      indent: { left: padL }, spacing: { after: 200 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: c(P.accent), space: 8 } },
      children: [new TextRun({
        text: "D E E P M I N D Q   C R M",
        size: 16, color: c(P.accent), font: { ascii: "Calibri" }, characterSpacing: 60,
      })],
    }),
    new Paragraph({ spacing: { before: 300 } }),
    new Paragraph({
      indent: { left: padL }, spacing: { after: 100 },
      children: [new TextRun({
        text: "End-to-End Technical &", size: 44, bold: true,
        color: c(P.titleColor), font: { ascii: "Calibri", eastAsia: "Arial" },
      })],
    }),
    new Paragraph({
      indent: { left: padL }, spacing: { after: 300 },
      children: [new TextRun({
        text: "Product Validation Report", size: 44, bold: true,
        color: c(P.titleColor), font: { ascii: "Calibri", eastAsia: "Arial" },
      })],
    }),
    new Paragraph({
      indent: { left: padL }, spacing: { after: 600 },
      children: [new TextRun({
        text: "Comprehensive Audit Across Security, Architecture, UI/UX, Performance & User Journey",
        size: 22, color: c(P.subtitleColor), font: { ascii: "Calibri" },
      })],
    }),
    ...[
      "Date: July 23, 2026",
      "Sprint: Phase 9.2 Post-Fix Audit",
      "Environment: Render.com (Free Tier)",
      "Stack: Next.js 16 / Prisma 6 / PostgreSQL / TypeScript",
    ].map(line =>
      new Paragraph({
        indent: { left: padL + 200 }, spacing: { after: 60 },
        border: { left: accentLeft },
        children: [new TextRun({
          text: line, size: 20, color: c(P.metaColor), font: { ascii: "Calibri" },
        })],
      })
    ),
    new Paragraph({ spacing: { before: 3200 } }),
    new Paragraph({
      indent: { left: padL }, spacing: { before: 200 },
      border: { top: { style: BorderStyle.SINGLE, size: 2, color: c(P.accent), space: 8 } },
      children: [
        new TextRun({ text: "DeepMindQ CRM", size: 16, color: c(P.footerColor), font: { ascii: "Calibri" } }),
        new TextRun({ text: "                                        ", size: 16 }),
        new TextRun({ text: "Confidential", size: 16, color: c(P.footerColor), font: { ascii: "Calibri" } }),
      ],
    }),
  ];

  return [new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: allNoBorders,
    rows: [new TableRow({
      height: { value: 16838, rule: "exact" },
      children: [new TableCell({
        shading: { type: ShadingType.CLEAR, fill: c(P.bg) }, borders: noBorders,
        children,
      })],
    })],
  })];
}

// ── Executive Summary Section ──
function execSummary() {
  return [
    heading("1. Executive Summary"),
    body("This report presents a comprehensive end-to-end technical and product validation of the DeepMindQ CRM application. The audit was conducted after the completion of Sprint 9.2, which addressed 72 issues across six critical domains: Security, Database, API Architecture, UI/UX, Performance, and User Journey. The objective is to provide a complete picture of the application's current state, identifying remaining risks, strengths, and the confidence level for production readiness."),
    body("DeepMindQ CRM is a full-featured customer relationship management platform built on a modern technology stack including Next.js 16, Prisma ORM 6.19.3, PostgreSQL, and TypeScript. The application encompasses 172 API routes, 66 database models, 65 UI screens, 130 reusable components, and a sophisticated AI integration layer supporting OpenAI, Gemini, and Groq providers. The architecture follows a modular design with distinct modules for CRM operations, intelligence gathering, AI-powered insights, outreach automation, and revenue intelligence."),
    body("The audit reveals a mixed picture. On the positive side, the application demonstrates ambitious feature coverage with a well-structured database schema, comprehensive AI integration capabilities, and a modern component library. However, critical concerns remain: 672 TypeScript compilation errors suppressed by build configuration, missing middleware for authentication enforcement, duplicated route definitions consuming deployment resources, and demo data files still present in production code. The application successfully builds on Render.com after the Prisma version fix but has not been confirmed live in production at the time of this audit."),
    spacer(),
    heading("Key Findings at a Glance", HeadingLevel.HEADING_2),
    metricTable([
      ["API Routes", "172", "WARN"],
      ["Database Models", "66", "PASS"],
      ["UI Screens", "65", "PASS"],
      ["Reusable Components", "130", "PASS"],
      ["TypeScript Errors", "672", "FAIL"],
      ["Middleware / Proxy", "MISSING", "CRITICAL"],
      ["Demo Data Files", "3 present", "WARN"],
      ["Duplicate Routes", "~100+ overlaps", "CRITICAL"],
      ["Rate Limiting", "Partial (11 routes)", "WARN"],
      ["Error Boundaries", "0 app-level", "FAIL"],
      ["Form Validation", "No Zod in screens", "WARN"],
      ["Responsive Design", "Inline CSS only", "WARN"],
      ["Prisma Version", "6.19.3 (pinned)", "PASS"],
      ["Environment Validation", "Zod schema present", "PASS"],
      ["Build Status", "Compiles (ignoreBuildErrors)", "WARN"],
    ]),
  ];
}

// ── Section 2: Application Stability ──
function appStability() {
  return [
    heading("2. Application Stability"),
    heading("2.1 API Route Architecture", HeadingLevel.HEADING_2),
    body("The application exposes 172 API routes organized across 73 top-level directories under src/app/api/. This represents a very large API surface area for a CRM application. The route organization follows Next.js App Router conventions with directory-based routing. Each API module typically contains one or more route.ts files implementing standard HTTP methods (GET, POST, PUT, DELETE, PATCH)."),
    body("A significant architectural concern is the presence of a legacy routes directory at src/app/api/routes/ containing 128 files. These files use a double-underscore naming convention (e.g., auth__login.ts, companies__mind-map.ts) to simulate nested URL paths. Nearly all of these legacy routes have corresponding modern route directories with proper Next.js file-system routing. This duplication means the application effectively ships every API endpoint twice, doubling the deployment footprint and serverless function count. This was the root cause of the Vercel Hobby plan deployment failure (12 serverless function limit)."),
    body("Among the 172 routes, approximately 18 routes lack proper try/catch error handling, particularly those in the legacy routes directory and catch-all slug routes (g-intelligence, g-intel-acquisition, g-auth, g-revenue-intelligence). These unprotected routes can cause unhandled promise rejections that crash the serverless function and return opaque 500 errors to clients. Modern routes in directories like contacts, companies, and pipeline generally follow better error handling patterns."),
    heading("2.2 Database Layer", HeadingLevel.HEADING_2),
    body("The Prisma schema defines 66 models covering the complete CRM domain: contacts, companies, opportunities, sequences, AI generation audit trails, intelligence validation, knowledge management, and more. The schema uses PostgreSQL as the provider with environment-variable-based connection strings, which is the correct approach. Prisma has been pinned to version 6.19.3 to prevent the breaking change in Prisma 7.x that removed the url property from datasource declarations."),
    body("No raw SQL queries ($queryRaw or $executeRaw) were found in the API code, which is a positive security indicator. All database access goes through Prisma's type-safe query builder, reducing SQL injection risk. However, the absence of database migration files in the repository suggests that schema changes may not be properly versioned, which could cause issues during deployments to fresh environments."),
    heading("2.3 Authentication & Session Management", HeadingLevel.HEADING_2),
    body("Authentication is implemented via NextAuth.js with a comprehensive set of auth endpoints: login, logout, register, change-password, reset-password, me (current user), update-profile, request-otp, verify-otp, and set-password. The application supports OTP-based authentication in addition to standard email/password flows. An environment validation module (src/lib/validate-env.ts) uses Zod schemas to ensure all required configuration variables are present at startup, including DATABASE_URL, NEXTAUTH_URL, and NEXTAUTH_SECRET."),
    body("The critical gap is the complete absence of middleware.ts or proxy.ts files. These were deleted during deployment debugging and never restored. Without middleware, there is no server-side enforcement of authentication on protected routes. Any user can directly access API endpoints or UI screens without being logged in. The application relies solely on client-side auth checks (useSession hooks in React components), which can be bypassed by direct API calls. This represents a CRITICAL security vulnerability that must be addressed before any production deployment."),
    heading("2.4 Error Handling Patterns", HeadingLevel.HEADING_2),
    body("The application implements error handling inconsistently across its API routes. Modern routes in structured directories (contacts, companies, pipeline, settings) generally include try/catch blocks with proper HTTP status codes and JSON error responses. However, legacy routes in the flat routes/ directory and several catch-all slug routes (g-*) lack this protection. Additionally, there are zero application-level error boundary components (error.tsx files) in the app directory, meaning React rendering errors will propagate unhandled to the user as white screens."),
    body("Console.log statements have been cleaned up well - none were found in the codebase. The environment validation module provides fail-fast behavior for missing configuration, which is good practice. CSRF protection is implemented via src/lib/csrf.ts, though it needs verification that all state-changing endpoints actually use it."),
  ];
}

// ── Section 3: Complete User Journey ──
function userJourney() {
  return [
    heading("3. Complete User Journey"),
    heading("3.1 Application Entry Points", HeadingLevel.HEADING_2),
    body("The application has four entry points through Next.js pages: the landing page (src/app/page.tsx), the login page (src/app/login/page.tsx), the signup page (src/app/signup/page.tsx), and the main application page (src/app/app/page.tsx). The landing page is a substantial 1,825-line component implementing a full marketing website with animated transitions, feature showcases, pricing sections, and a command palette. This single-file complexity is a maintainability concern."),
    body("The CRM application itself lives at src/app/crm/App.tsx, which implements a complete single-page application (SPA) within a single component using React state for navigation. This component includes an inline sidebar, 8 navigation items, and conditionally renders Dashboard, Companies, CompanyProfile, Contacts, ContactProfile, Tasks, Opportunities, EmailGen, Knowledge, and Settings screens. This architecture means URL-based navigation and browser back/forward do not work within the CRM - users cannot bookmark specific screens or share direct links."),
    heading("3.2 Authentication Flow", HeadingLevel.HEADING_2),
    body("The auth flow supports two paths: standard email/password registration and OTP-based authentication. Registration requires email and password, creates a User record in PostgreSQL, and establishes a NextAuth session. The OTP flow allows passwordless login via email verification codes. Password reset follows a two-step confirm process. Session management uses NextAuth's default JWT-based sessions. However, without middleware, the auth flow is enforced only on the client side, making it trivially bypassable via API tools like curl or Postman."),
    heading("3.3 Core CRM Workflow", HeadingLevel.HEADING_2),
    body("After login, users enter a dashboard showing pipeline metrics and activity feeds. The sidebar provides access to 8 main sections: Dashboard (pipeline overview and KPIs), Companies (list and detail views with intelligence, notes, signals, and timeline), Contacts (list and detail views with validation and email generation), Opportunities (deal tracking with pipeline stages), Tasks (task management), Email AI (AI-powered email composition), Knowledge (knowledge base management), and Settings (application configuration). Each module has corresponding API routes for CRUD operations."),
    body("The navigation is entirely state-driven within the SPA component, meaning the browser URL does not change when switching between screens. This creates a poor user experience for users who expect URL-based navigation in a web application. Additionally, the CRM application at /crm is separate from the main application shell at /app, suggesting either an incomplete migration or a parallel UI system that should be consolidated."),
    heading("3.4 AI-Powered Features", HeadingLevel.HEADING_2),
    body("The application integrates AI across multiple touchpoints: AI chat for conversational assistance, email generation for personalized outreach, lead scoring using AI models, signal detection and intelligence gathering, relationship memory for tracking interactions, conversation planning, account briefs, and strategy recommendations. The AI layer supports multiple providers (OpenAI, Gemini, Groq) with graceful fallback when API keys are not configured. This multi-provider architecture is well-designed for resilience and cost optimization."),
    heading("3.5 Journey Gaps", HeadingLevel.HEADING_2),
    bodyWithStatus("No onboarding flow for new users after signup", "WARN"),
    bodyWithStatus("No notification/toast system for async operations", "WARN"),
    bodyWithStatus("No search functionality across contacts/companies", "WARN"),
    bodyWithStatus("URL does not change between CRM screens (no deep linking)", "FAIL"),
    bodyWithStatus("No user permissions/role-based access control", "WARN"),
    bodyWithStatus("Landing page is a 1,825-line monolith component", "WARN"),
    bodyWithStatus("CRM App and main App are separate entry points (confusing)", "WARN"),
  ];
}

// ── Section 4: Production Readiness ──
function prodReadiness() {
  return [
    heading("4. Production Readiness"),
    heading("4.1 Deployment Configuration", HeadingLevel.HEADING_2),
    body("The application is configured for deployment on Render.com's free tier (512MB RAM, $0/month) after Vercel deployment was ruled out due to the 12 serverless function limit on the Hobby plan. The build process runs 'npx prisma generate && npx next build', and the start command uses 'npx next start -p $PORT' to respect Render's dynamic port assignment. Node.js version is pinned to 20 via environment variable, and memory is constrained with NODE_OPTIONS=--max-old-space-size=384 to prevent OOM kills on the 512MB limit."),
    body("The .npmrc file limits concurrent socket connections to 3 and caps the npm cache at 500MB, both optimizations for the memory-constrained environment. The output: 'standalone' option was removed from next.config.ts because it caused asset copying issues on Render. The critical build fix was pinning Prisma to exactly version 6.19.3 to prevent auto-resolution to Prisma 7.9.0, which introduced a breaking schema change."),
    heading("4.2 Security Assessment", HeadingLevel.HEADING_2),
    body("The security posture presents several concerns alongside some positive practices. On the positive side: no raw SQL queries (SQL injection risk is minimal), no dangerouslySetInnerHTML usage (XSS risk is minimal), environment variables validated via Zod at startup, CSRF protection module exists, and Prisma provides type-safe database queries. The next.config.ts includes CORS headers configuration."),
    body("Critical security gaps include: the missing middleware/proxy means no server-side auth enforcement, no rate limiting on most API routes (only 11 of 172 routes have rate limiting), no security headers (X-Frame-Options, X-Content-Type-Options, CSP), and three potential hardcoded secret patterns found in signal-related routes that need investigation. The application has no webhook signature verification mentioned in the webhook routes, which could allow request forgery."),
    heading("4.3 Error Handling & Resilience", HeadingLevel.HEADING_2),
    body("Production error handling is insufficient. There are no error.tsx files in the app directory (no React error boundaries), meaning component errors will crash the entire application. There is one loading.tsx at the app root level, providing a basic loading state, but no nested loading states for individual routes. The application does not appear to implement retry logic for failed API calls, circuit breakers for external AI service calls, or graceful degradation when AI providers are unavailable. The Sentry integration files exist (sentry.client.config.ts, sentry.server.config.ts, sentry.edge.config.ts) but need verification that they are properly initialized."),
    heading("4.4 Production Readiness Checklist", HeadingLevel.HEADING_2),
    metricTable([
      ["Environment variable validation", "Zod schema", "PASS"],
      ["Prisma version pinned", "6.19.3 exact", "PASS"],
      ["Build compiles successfully", "Yes (with ignoreBuildErrors)", "WARN"],
      ["Middleware / Auth enforcement", "MISSING", "CRITICAL"],
      ["Error boundaries", "None", "FAIL"],
      ["Rate limiting (API-wide)", "11/172 routes only", "WARN"],
      ["Security headers", "Not configured", "FAIL"],
      ["CSRF protection", "Module exists", "PASS"],
      ["SQL injection prevention", "Prisma only", "PASS"],
      ["XSS prevention", "No dangerouslySetInnerHTML", "PASS"],
      ["Webhook verification", "Not verified", "WARN"],
      ["Console.log cleanup", "Clean", "PASS"],
      ["Hardcoded secrets scan", "3 files flagged", "WARN"],
      ["Memory optimization", "NODE_OPTIONS set", "PASS"],
      ["Deployment platform", "Render.com free tier", "WARN"],
    ]),
  ];
}

// ── Section 5: Feature Completeness ──
function featureCompleteness() {
  return [
    heading("5. Feature Completeness"),
    heading("5.1 Module Coverage Matrix", HeadingLevel.HEADING_2),
    body("The application covers a comprehensive set of CRM and intelligence-gathering features. Each major module has both frontend screens and corresponding API routes. The following table summarizes the feature coverage across all major modules, indicating whether both frontend and backend implementations exist and whether full CRUD operations are supported."),
    metricTable([
      ["Dashboard & Analytics", "UI + API", "PASS"],
      ["Companies (CRUD + Intel)", "UI + API", "PASS"],
      ["Contacts (CRUD + Validate)", "UI + API", "PASS"],
      ["Opportunities / Pipeline", "UI + API", "PASS"],
      ["Tasks Management", "UI + API", "PASS"],
      ["AI Chat & Copilot", "UI + API", "PASS"],
      ["Email Generation (AI)", "UI + API", "PASS"],
      ["Email Sequences", "API only", "WARN"],
      ["Knowledge Base", "UI + API", "PASS"],
      ["Settings & Preferences", "UI + API", "PASS"],
      ["Lead Scoring & Enrichment", "API only", "WARN"],
      ["Intelligence Gathering", "API only", "WARN"],
      ["AB Testing", "API only", "WARN"],
      ["Custom Fields", "API only", "WARN"],
      ["Comments / Notes", "API only", "WARN"],
      ["Segments & Lists", "API only", "WARN"],
      ["Audit Logging", "API only", "PASS"],
      ["Reports & Export", "API only", "WARN"],
      ["Webhooks (Email/Bounce)", "API only", "PASS"],
      ["Team Management", "API only", "WARN"],
      ["Tags", "API only", "WARN"],
      ["Notifications", "API only", "WARN"],
      ["Playbooks", "API only", "WARN"],
      ["Conversation Plans", "API only", "WARN"],
      ["Research Agent", "API only", "WARN"],
    ]),
    heading("5.2 Backend-Only Modules", HeadingLevel.HEADING_2),
    body("A significant portion of the application's API surface (approximately 60% of modules) has no corresponding frontend implementation. Modules like email sequences, lead scoring, intelligence gathering, AB testing, custom fields, segments, reports, and team management have complete or near-complete API routes but no UI screens for users to interact with them. These backend-only modules represent either incomplete features or an API-first design where the frontend was planned for future development."),
    body("The CRM App component at src/app/crm/App.tsx provides UI for 8 core modules (Dashboard, Companies, Contacts, Opportunities, Tasks, Email AI, Knowledge, Settings). An additional 65 screen components exist in src/components/screens/ that are not directly referenced by the CRM App navigation, suggesting they may be accessible through other routes or are orphaned code. The main application page at src/app/page.tsx implements a completely different navigation system using NAV_SECTIONS and SCREEN_MAP configuration, indicating two parallel UI systems that need consolidation."),
    heading("5.3 AI Integration Completeness", HeadingLevel.HEADING_2),
    body("The AI module is one of the most comprehensive parts of the application. It includes: AI chat with multi-turn conversation support, email generation with personalization, lead scoring algorithms, signal detection and analysis, intelligence validation with confidence scoring, contradiction detection in data sources, account brief generation, relationship memory tracking, conversation planning, strategy recommendations, and an AI governance module for monitoring AI usage. The multi-provider support (OpenAI, Gemini, Groq) with fallback handling is production-quality architecture."),
  ];
}

// ── Section 6: Code Quality ──
function codeQuality() {
  return [
    heading("6. Code Quality"),
    heading("6.1 TypeScript Health", HeadingLevel.HEADING_2),
    body("The most significant code quality issue is the presence of 672 TypeScript compilation errors across the codebase. These errors are suppressed by the ignoreBuildErrors: true flag in next.config.ts, which allows the application to build and deploy despite type violations. This is a dangerous practice because it means type safety - one of the primary benefits of using TypeScript - is completely undermined. The errors are not evenly distributed; they concentrate heavily in specific files."),
    body("The top error-producing files include: ai__summarize.ts (34 errors in both legacy and modern versions), companies__mind-map.ts (23 errors), ai__chat.ts (22 errors), intelligence-report-screen.tsx (21 errors), research/route.ts (18 errors), and ai__enrich.ts (16 errors). These error clusters suggest that certain modules were written without proper type definitions or were migrated between API patterns without updating type annotations. The errors range from missing property access on potentially null objects to incorrect type assertions and missing return type annotations."),
    heading("6.2 Architecture & Duplication", HeadingLevel.HEADING_2),
    body("The most pressing architectural issue is the route duplication. The application has two parallel API routing systems: a modern Next.js App Router structure with 151 route.ts files in nested directories, and a legacy flat routing structure with 128 files in src/app/api/routes/ using double-underscore path encoding. Nearly all legacy routes have corresponding modern equivalents, meaning every API endpoint is defined twice. This doubles the serverless function count and increases maintenance burden - any change to an API must be made in both files."),
    body("The CRM UI also suffers from duplication. There are two separate application shells: src/app/crm/App.tsx (an SPA with inline state navigation) and src/app/page.tsx (a larger application with a different navigation system using SCREEN_MAP and NAV_SECTIONS). The 65 screen components in src/components/screens/ appear to support the second navigation system. This split creates confusion about which UI is the primary interface and makes it unclear which components are actually in use."),
    heading("6.3 Code Organization", HeadingLevel.HEADING_2),
    body("The codebase follows a reasonable organizational structure with clear separation between API routes (src/app/api/), UI components (src/components/), and shared utilities (src/lib/). The component library includes 130 components, of which a substantial set are shadcn/ui primitives (accordion, alert, avatar, badge, button, card, dialog, drawer, dropdown, etc.). The landing page at 1,825 lines is a notable violation of single-responsibility principle and should be decomposed into smaller, testable components."),
    body("State management uses a Zustand store (src/lib/store.ts) for client-side state, which is appropriate for the application's complexity. React Query is available through a provider (src/providers/query-provider.tsx) for server state management. Auth is provided through a dedicated provider (src/providers/auth-provider.tsx). The Prisma client is centralized in src/lib/db.ts for consistent database access."),
    heading("6.4 Code Quality Metrics", HeadingLevel.HEADING_2),
    metricTable([
      ["Total TypeScript errors", "672", "FAIL"],
      ["ignoreBuildErrors enabled", "true", "FAIL"],
      ["Top error file (ai__summarize)", "34 errors", "FAIL"],
      ["Duplicate route definitions", "~128 files", "CRITICAL"],
      ["Dual UI systems (CRM vs App)", "2 separate", "WARN"],
      ["Landing page size", "1,825 lines", "WARN"],
      ["Components library", "130 components", "PASS"],
      ["Provider architecture", "3 providers", "PASS"],
      ["No TODO/FIXME comments", "0 found", "PASS"],
      ["No console.log statements", "0 found", "PASS"],
    ]),
  ];
}

// ── Section 7: UI/UX Review ──
function uiUxReview() {
  return [
    heading("7. UI/UX Review"),
    heading("7.1 Design System & Components", HeadingLevel.HEADING_2),
    body("The application uses shadcn/ui as its component library foundation, which is an excellent choice for consistency and accessibility. The shadcn/ui components in src/components/ui/ include 30+ primitives covering all common UI patterns: buttons, cards, dialogs, drawers, dropdowns, forms, tables, charts, navigation, and more. Custom components like animated-components.tsx, command-palette.tsx, and error-boundary.tsx extend the library with application-specific functionality."),
    body("The CRM application (src/app/crm/App.tsx) uses an inline CSS styling approach rather than Tailwind CSS utility classes or the shadcn/ui component system. This means the CRM screens have a different visual language than the rest of the application. The sidebar uses hardcoded pixel values, custom color objects from a data.ts file, and manual CSS-in-JS styling. This inconsistency creates a disjointed user experience when navigating between different parts of the application."),
    heading("7.2 Responsive Design", HeadingLevel.HEADING_2),
    body("Responsive design is a significant weakness. The CRM application uses fixed pixel-width sidebars (240px), hardcoded padding values, and no responsive breakpoint classes. The screen components in src/components/screens/ also appear to lack responsive utility classes (no md:, sm:, lg:, xl: Tailwind prefixes were found in any screen file). This means the application is likely only usable on desktop screens and will have layout issues on tablets or mobile devices."),
    body("The landing page at src/app/page.tsx includes some responsive considerations through CSS media queries, but the CRM workspace - where users spend most of their time - is entirely desktop-focused. For a CRM application that sales teams may need to access from mobile devices in the field, this is a significant usability limitation."),
    heading("7.3 Form Validation & Input Handling", HeadingLevel.HEADING_2),
    body("Form validation in the UI screens does not use Zod schemas or other structured validation libraries. No Zod integration was found in any screen component. The API layer uses Zod for environment validation (src/lib/validate-env.ts), but this pattern has not been extended to user-facing forms. This means form validation is likely either missing entirely or implemented ad-hoc with manual JavaScript validation, which is error-prone and inconsistent."),
    heading("7.4 Loading States & Feedback", HeadingLevel.HEADING_2),
    body("The application has one global loading.tsx file at the app root, providing a basic loading state. However, there are no nested loading.tsx files for individual routes or screens, and no skeleton loader components were found in the codebase. This means users see either a full-page loading spinner or nothing during data fetching operations, rather than progressive loading with placeholder content. For an application making frequent API calls for CRM data, this creates a perception of slowness even if the underlying API is fast."),
    body("There is no global toast/notification system visible in the CRM App component for success/error feedback after operations like saving a contact or deleting a company. The main application page.tsx includes a Toaster from sonner, but this is not connected to the CRM SPA interface. Users performing CRUD operations in the CRM have no visual confirmation that their actions succeeded or failed."),
  ];
}

// ── Section 8: Final Confidence Assessment ──
function confidenceAssessment() {
  return [
    heading("8. Final Confidence Assessment"),
    heading("8.1 Confidence Score", HeadingLevel.HEADING_2),
    body("Based on the comprehensive audit across all seven dimensions, the overall production readiness confidence score is assessed below. Each dimension is weighted according to its impact on user experience, security, and maintainability. The scores reflect the current state of the application as of July 23, 2026, and assume that the middleware gap and route duplication are the most critical issues to resolve."),
    spacer(),
    metricTable([
      ["Application Stability", "5/10", "WARN"],
      ["User Journey Completeness", "6/10", "WARN"],
      ["Production Readiness", "3/10", "FAIL"],
      ["Feature Completeness", "7/10", "PASS"],
      ["Code Quality", "4/10", "FAIL"],
      ["UI/UX Design", "5/10", "WARN"],
      ["Overall Confidence", "4.3/10", "FAIL"],
    ]),
    spacer(),
    heading("8.2 Critical Blockers (Must Fix Before Production)", HeadingLevel.HEADING_2),
    bodyWithStatus("Restore middleware.ts or proxy.ts for server-side auth enforcement", "CRITICAL"),
    bodyWithStatus("Remove 128 duplicate legacy route files to reduce deployment size", "CRITICAL"),
    bodyWithStatus("Add error boundary components (error.tsx) in all route segments", "FAIL"),
    bodyWithStatus("Implement API-wide rate limiting (currently 11/172 routes)", "WARN"),
    bodyWithStatus("Add security headers (CSP, X-Frame-Options, X-Content-Type-Options)", "WARN"),
    heading("8.3 High-Priority Improvements", HeadingLevel.HEADING_2),
    bodyWithStatus("Fix 672 TypeScript errors - remove ignoreBuildErrors flag", "FAIL"),
    bodyWithStatus("Consolidate dual UI systems (CRM SPA vs App navigation)", "WARN"),
    bodyWithStatus("Add responsive breakpoints for mobile/tablet support", "WARN"),
    bodyWithStatus("Implement Zod form validation on all user-facing forms", "WARN"),
    bodyWithStatus("Delete 3 demo data files (demo-experience-screen, demo-data, mock-data)", "WARN"),
    bodyWithStatus("Implement webhook signature verification", "WARN"),
    heading("8.4 Strengths", HeadingLevel.HEADING_2),
    body("Despite the critical issues, the application demonstrates several notable strengths. The database schema is well-designed with 66 models covering a comprehensive CRM domain. The AI integration layer is sophisticated, supporting multiple providers with graceful fallbacks. The component library is extensive (130 components) and built on shadcn/ui. Environment validation via Zod provides fail-fast startup behavior. No SQL injection or XSS vectors were found. The Prisma version is correctly pinned. Console.log cleanup and TODO removal are complete. The application architecture shows clear intent toward a modular, extensible design."),
    heading("8.5 Recommended Path Forward", HeadingLevel.HEADING_2),
    body("The recommended immediate actions are: (1) Restore middleware with authentication enforcement - this is the single most critical security fix. (2) Remove the legacy routes/ directory containing 128 duplicate files, reducing the API surface to 151 modern routes. (3) Add error boundary components. (4) Begin systematic resolution of TypeScript errors starting with the highest-error files. (5) Consolidate the dual UI systems into a single coherent interface using Next.js App Router properly. These five steps would raise the confidence score from 4.3/10 to approximately 7/10, making the application suitable for a beta production deployment."),
  ];
}

// ── Assemble Document ──
const doc = new Document({
  styles: {
    default: {
      document: {
        run: {
          font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" },
          size: 22, color: c(P.body),
        },
        paragraph: { spacing: { line: 312 } },
      },
      heading1: {
        run: { font: { ascii: "Calibri", eastAsia: "SimHei" }, size: 32, bold: true, color: c(P.primary) },
        paragraph: { spacing: { before: 400, after: 140 } },
      },
      heading2: {
        run: { font: { ascii: "Calibri", eastAsia: "SimHei" }, size: 28, bold: true, color: c(P.primary) },
        paragraph: { spacing: { before: 280, after: 120 } },
      },
      heading3: {
        run: { font: { ascii: "Calibri", eastAsia: "SimHei" }, size: 24, bold: true, color: c(P.secondary) },
        paragraph: { spacing: { before: 220, after: 100 } },
      },
    },
  },
  numbering: {
    config: [{
      reference: "ordered-list",
      levels: [{
        level: 0, format: LevelFormat.DECIMAL,
        text: "%1.", alignment: AlignmentType.START,
        style: { paragraph: { indent: { left: 720, hanging: 360 } } },
      }],
    }],
  },
  sections: [
    // Cover
    {
      properties: {
        page: { margin: { top: 0, bottom: 0, left: 0, right: 0 },
          size: { width: 11906, height: 16838 } },
      },
      children: buildCover(),
    },
    // TOC
    {
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 1440, bottom: 1440, left: 1701, right: 1417 },
        },
      },
      children: [
        new Paragraph({
          spacing: { after: 200 },
          children: [new TextRun({ text: "Table of Contents", size: 32, bold: true, color: c(P.primary),
            font: { ascii: "Calibri", eastAsia: "SimHei" } })],
        }),
        new TableOfContents("Table of Contents", {
          hyperlink: true, headingStyleRange: "1-3",
        }),
        new Paragraph({
          spacing: { before: 200, after: 100 },
          children: [new TextRun({
            text: "Note: Right-click the Table of Contents above and select 'Update Field' to refresh page numbers in Word/WPS.",
            size: 18, color: "888888", italics: true, font: { ascii: "Calibri" },
          })],
        }),
        new Paragraph({ children: [new PageBreak()] }),
      ],
    },
    // Body
    {
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 1440, bottom: 1440, left: 1701, right: 1417 },
          pageNumbers: { start: 1 },
        },
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: "DeepMindQ CRM \u2014 Technical Validation Report", size: 16, color: c(P.secondary),
                font: { ascii: "Calibri" } }),
              new TextRun({ text: "                              Page ", size: 16, color: c(P.secondary),
                font: { ascii: "Calibri" } }),
              new TextRun({ children: [PageNumber.CURRENT], size: 16, color: c(P.secondary),
                font: { ascii: "Calibri" } }),
            ],
          })],
        }),
      },
      children: [
        ...execSummary(),
        ...appStability(),
        ...userJourney(),
        ...prodReadiness(),
        ...featureCompleteness(),
        ...codeQuality(),
        ...uiUxReview(),
        ...confidenceAssessment(),
      ],
    },
  ],
});

Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync("/home/z/my-project/download/DeepMindQ-CRM-Validation-Report.docx", buf);
  console.log("Report generated: DeepMindQ-CRM-Validation-Report.docx");
  console.log("Size: " + (buf.length / 1024).toFixed(1) + " KB");
});
