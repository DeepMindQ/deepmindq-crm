#!/usr/bin/env python3
"""
DeepMindQ CRM — End-to-End Technical & Product Validation Report
Phase 9 Audit: Full application assessment
"""

from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch, mm
from reportlab.lib.colors import HexColor, white, black, red, green, orange
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, KeepTogether, HRFlowable
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase.pdfmetrics import registerFontFamily
import os

FONT_DIR = '/usr/share/fonts'

# Register fonts
pdfmetrics.registerFont(TTFont('NotoSerifSC', f'{FONT_DIR}/truetype/noto-serif-sc/NotoSerifSC-Regular.ttf'))
pdfmetrics.registerFont(TTFont('NotoSerifSC-Bold', f'{FONT_DIR}/truetype/noto-serif-sc/NotoSerifSC-Bold.ttf'))
registerFontFamily('NotoSerifSC', normal='NotoSerifSC', bold='NotoSerifSC-Bold')

pdfmetrics.registerFont(TTFont('Inter', f'{FONT_DIR}/truetype/dejavu/DejaVuSans.ttf'))
pdfmetrics.registerFont(TTFont('Inter-Bold', f'{FONT_DIR}/truetype/dejavu/DejaVuSans-Bold.ttf'))
registerFontFamily('Inter', normal='Inter', bold='Inter-Bold')

OUTPUT_PATH = '/home/z/my-project/download/DeepMindQ_Validation_Report.pdf'
os.makedirs('/home/z/my-project/download', exist_ok=True)

# Colors
DARK_BLUE = HexColor('#0f172a')
ACCENT_BLUE = HexColor('#2563eb')
ACCENT_RED = HexColor('#dc2626')
ACCENT_ORANGE = HexColor('#ea580c')
ACCENT_GREEN = HexColor('#16a34a')
LIGHT_BG = HexColor('#f1f5f9')
BORDER_GRAY = HexColor('#e2e8f0')
TEXT_DARK = HexColor('#1e293b')
TEXT_MUTED = HexColor('#64748b')

# Styles
styles = getSampleStyleSheet()

styles.add(ParagraphStyle(
    'CoverTitle', fontName='Inter-Bold', fontSize=28, leading=34,
    textColor=white, alignment=TA_LEFT, spaceAfter=8
))
styles.add(ParagraphStyle(
    'CoverSubtitle', fontName='Inter', fontSize=14, leading=20,
    textColor=HexColor('#94a3b8'), alignment=TA_LEFT, spaceAfter=4
))
styles.add(ParagraphStyle(
    'CoverMeta', fontName='Inter', fontSize=11, leading=16,
    textColor=HexColor('#64748b'), alignment=TA_LEFT
))
styles.add(ParagraphStyle(
    'SectionHeading', fontName='Inter-Bold', fontSize=18, leading=24,
    textColor=DARK_BLUE, spaceBefore=20, spaceAfter=10,
    borderWidth=0, borderColor=ACCENT_BLUE, borderPadding=4
))
styles.add(ParagraphStyle(
    'SubHeading', fontName='Inter-Bold', fontSize=13, leading=18,
    textColor=HexColor('#334155'), spaceBefore=14, spaceAfter=6
))
styles.add(ParagraphStyle(
    'BodyText2', fontName='Inter', fontSize=10, leading=15,
    textColor=TEXT_DARK, alignment=TA_JUSTIFY, spaceAfter=6
))
styles.add(ParagraphStyle(
    'BulletItem', fontName='Inter', fontSize=10, leading=15,
    textColor=TEXT_DARK, leftIndent=20, bulletIndent=8, spaceAfter=3,
    bulletFontName='Inter', bulletFontSize=10
))
styles.add(ParagraphStyle(
    'StatusCritical', fontName='Inter-Bold', fontSize=10, leading=14,
    textColor=ACCENT_RED, alignment=TA_CENTER
))
styles.add(ParagraphStyle(
    'StatusWarning', fontName='Inter-Bold', fontSize=10, leading=14,
    textColor=ACCENT_ORANGE, alignment=TA_CENTER
))
styles.add(ParagraphStyle(
    'StatusOK', fontName='Inter-Bold', fontSize=10, leading=14,
    textColor=ACCENT_GREEN, alignment=TA_CENTER
))
styles.add(ParagraphStyle(
    'StatusNA', fontName='Inter', fontSize=10, leading=14,
    textColor=TEXT_MUTED, alignment=TA_CENTER
))
styles.add(ParagraphStyle(
    'TableHeader', fontName='Inter-Bold', fontSize=9, leading=12,
    textColor=white, alignment=TA_CENTER
))
styles.add(ParagraphStyle(
    'TableCell', fontName='Inter', fontSize=9, leading=12,
    textColor=TEXT_DARK, alignment=TA_LEFT
))
styles.add(ParagraphStyle(
    'TableCellCenter', fontName='Inter', fontSize=9, leading=12,
    textColor=TEXT_DARK, alignment=TA_CENTER
))
styles.add(ParagraphStyle(
    'FootNote', fontName='Inter', fontSize=8, leading=11,
    textColor=TEXT_MUTED, spaceBefore=4
))
styles.add(ParagraphStyle(
    'ConfidenceNumber', fontName='Inter-Bold', fontSize=36, leading=40,
    textColor=ACCENT_RED, alignment=TA_CENTER
))
styles.add(ParagraphStyle(
    'ConfidenceLabel', fontName='Inter', fontSize=11, leading=14,
    textColor=TEXT_MUTED, alignment=TA_CENTER, spaceAfter=2
))

def make_table(headers, rows, col_widths=None):
    """Create a styled table"""
    header_cells = [Paragraph(h, styles['TableHeader']) for h in headers]
    data = [header_cells]
    for row in rows:
        data.append([Paragraph(str(c), styles['TableCell']) if i > 0 else Paragraph(str(c), styles['TableCellCenter']) for i, c in enumerate(row)])
    
    if col_widths is None:
        col_widths = [460/len(headers)] * len(headers)
    
    t = Table(data, colWidths=col_widths, repeatRows=1)
    style_cmds = [
        ('BACKGROUND', (0, 0), (-1, 0), DARK_BLUE),
        ('TEXTCOLOR', (0, 0), (-1, 0), white),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('GRID', (0, 0), (-1, -1), 0.5, BORDER_GRAY),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
    ]
    for i in range(1, len(data)):
        if i % 2 == 0:
            style_cmds.append(('BACKGROUND', (0, i), (-1, i), LIGHT_BG))
    t.setStyle(TableStyle(style_cmds))
    return t

def status_cell(status):
    mapping = {
        'CRITICAL': ('<b>CRITICAL</b>', styles['StatusCritical']),
        'WARNING': ('<b>WARNING</b>', styles['StatusWarning']),
        'OK': ('<b>OK</b>', styles['StatusOK']),
        'N/A': ('N/A', styles['StatusNA']),
        'PARTIAL': ('<b>PARTIAL</b>', styles['StatusWarning']),
        'BROKEN': ('<b>BROKEN</b>', styles['StatusCritical']),
        'MISSING': ('<b>MISSING</b>', styles['StatusCritical']),
        'PLACEHOLDER': ('<b>PLACEHOLDER</b>', styles['StatusWarning']),
    }
    text, style = mapping.get(status, (status, styles['TableCellCenter']))
    return Paragraph(text, style)

def section(title):
    return [
        Spacer(1, 6),
        HRFlowable(width="100%", thickness=1, color=BORDER_GRAY, spaceAfter=6),
        Paragraph(title, styles['SectionHeading']),
    ]

def subsection(title):
    return Paragraph(title, styles['SubHeading'])

def body(text):
    return Paragraph(text, styles['BodyText2'])

def bullet(text):
    return Paragraph(text, styles['BulletItem'], bulletText='\u2022')

def spacer(h=6):
    return Spacer(1, h)


# BUILD DOCUMENT
story = []

# COVER PAGE
story.append(Spacer(1, 120))
story.append(Paragraph("DeepMindQ CRM", styles['CoverTitle']))
story.append(Spacer(1, 8))
story.append(Paragraph("End-to-End Technical &amp; Product Validation Report", styles['CoverSubtitle']))
story.append(Spacer(1, 24))
story.append(HRFlowable(width="40%", thickness=2, color=ACCENT_BLUE, spaceAfter=16, hAlign='LEFT'))
story.append(Paragraph("Full application audit from first line of code to current state", styles['CoverSubtitle']))
story.append(Spacer(1, 60))
story.append(Paragraph("Prepared by: Super Z AI Engineer", styles['CoverMeta']))
story.append(Paragraph("Date: July 23, 2026", styles['CoverMeta']))
story.append(Paragraph("Repository: github.com/DeepMindQ/deepmindq-crm", styles['CoverMeta']))
story.append(Paragraph("Commit: 770c881 (main branch)", styles['CoverMeta']))
story.append(Spacer(1, 40))
story.append(Paragraph("CONFIDENTIAL", ParagraphStyle('Conf', fontName='Inter-Bold', fontSize=10, textColor=ACCENT_RED, alignment=TA_LEFT)))
story.append(PageBreak())


# EXECUTIVE SUMMARY
story.extend(section("1. Executive Summary"))
story.append(body(
    "This report provides a comprehensive end-to-end validation of the DeepMindQ CRM application, "
    "covering application stability, user journey completeness, production readiness, feature completeness "
    "across all modules, code quality, UI/UX assessment, and a final confidence rating. The audit was conducted "
    "by examining all 172 API route files, 65 screen components, 340+ handler modules, the Prisma schema "
    "(68 models), and the complete frontend/backend codebase."
))
story.append(body(
    "The application represents a substantial enterprise CRM platform with 65 distinct screens, 172 API endpoints "
    "organized into 6 route groups (auth, CRM, AI, data, outreach, strategy), and an extensive Prisma schema "
    "with 68 database models. However, the audit reveals that the application is <b>not production-ready</b> "
    "in its current state. While the core architecture is sound and the frontend UI is visually polished, "
    "there are significant gaps in backend completeness, data integrity, and end-to-end flow validation "
    "that must be addressed before any enterprise deployment."
))

story.append(subsection("Key Findings at a Glance"))
story.append(make_table(
    ["Metric", "Value", "Assessment"],
    [
        ["Total API Routes", "172", "OK"],
        ["TypeScript Errors", "677", "CRITICAL"],
        ["Files with TS Errors", "107", "CRITICAL"],
        ["Missing Prisma Models", "14", "CRITICAL"],
        ["Dead Code Files", "87+ (routes/, demo files)", "WARNING"],
        ["Auth Guards Coverage", "~22/172 routes", "WARNING"],
        ["Tests Passing", "Unknown (test framework broken)", "CRITICAL"],
        ["Deployment Status", "Build failing on Render", "CRITICAL"],
    ],
    [140, 180, 140]
))
story.append(spacer(12))


# SECTION 2: APPLICATION STABILITY
story.extend(section("2. Application Stability"))
story.append(body(
    "Application stability is assessed by examining build integrity, runtime error potential, and the "
    "depth of TypeScript type safety across the codebase. The application builds successfully locally "
    "because <b>ignoreBuildErrors: true</b> is set in next.config.ts, which suppresses all 677 TypeScript "
    "errors during compilation. This means the build artifact exists, but runtime errors are likely "
    "when any of the 107 affected files are actually called."
))

story.append(subsection("2.1 TypeScript Error Analysis"))
story.append(body(
    "The 677 TypeScript errors span 107 unique files across the codebase. These are not trivial annotation "
    "issues; they represent fundamental code-schema mismatches where the application code references "
    "database models, fields, and properties that do not exist in the Prisma schema. This means that when "
    "a user interacts with these features at runtime, the server will throw unhandled errors, resulting "
    "in 500 responses and broken user flows."
))

story.append(body("<b>Critical categories of TypeScript errors:</b>"))
story.append(bullet("<b>Missing Prisma Models (14 models):</b> Code references Comment, CustomFieldDefinition, CustomFieldValue, Notification, Opportunity, Tag, TagAssignment, Team, TeamMember, TimelineEntry, UserPreferences, EmailHealthCheck, CapabilitySnippet, and CompanyResearchSource. None of these models exist in the Prisma schema, meaning all API routes that use these models (comments, custom-fields, notifications, teams, tags, tasks, opportunities, timeline, preferences, email validation, capabilities) will crash at runtime with Prisma client errors."))
story.append(bullet("<b>Schema Field Mismatches (80+ errors in AI routes):</b> The AI module (ai/chat, ai/enrich, ai/summarize, ai/query) extensively references fields like company.name, company.contacts, company.opportunities, company.researchCard, company.employeeSize, company.dataFreshness, and contact.name, contact.jobTitle, contact.company. The Prisma schema uses rawName/normalizedName (not name), has no contacts/opportunities relations on Company, and uses rawName/jobTitle fields with different naming conventions. These routes will crash at runtime."))
story.append(bullet("<b>Dead Code Directory (87 files):</b> The src/app/api/routes/ directory contains 87 .ts files that appear to be an older routing system. These files have massive TS errors, are not imported by any active code, and add confusion to the codebase. They should be deleted."))
story.append(bullet("<b>Dead UI Files:</b> demo-experience-screen.tsx, demo-data.ts, and mock-data.ts are no longer imported anywhere but still exist in the repository."))

story.append(subsection("2.2 Known Runtime Crashes"))
story.append(body(
    "Based on the TypeScript error analysis and code path tracing, the following user-facing features "
    "will crash when invoked in the current deployment:"
))
story.append(make_table(
    ["Feature", "Impact", "Root Cause"],
    [
        ["Comments API", "500 error on all calls", "db.comment model does not exist"],
        ["Custom Fields API", "500 error on all calls", "db.customFieldDefinition does not exist"],
        ["Notifications API", "500 error on all calls", "db.notification model does not exist"],
        ["Teams API", "500 error on all calls", "db.team model does not exist"],
        ["Tags API", "500 error on all calls", "db.tag model does not exist"],
        ["Tasks API", "500 error on all calls", "References missing models"],
        ["Opportunities API", "500 error on all calls", "db.opportunity model does not exist"],
        ["AI Chat", "500 error", "References non-existent fields"],
        ["AI Enrich", "500 error", "References non-existent fields"],
        ["AI Summarize", "500 error", "References non-existent fields"],
        ["Email Validation", "500 error", "db.emailHealthCheck does not exist"],
        ["Timeline API", "500 error", "db.timelineEntry does not exist"],
        ["Contact Detail", "500 error", "References company.name not rawName"],
    ],
    [130, 160, 170]
))
story.append(spacer(8))


# SECTION 3: USER JOURNEY
story.extend(section("3. Complete User Journey Analysis"))
story.append(body(
    "This section traces the exact journey of a new enterprise customer from signup through "
    "full platform usage, identifying where the flow works, where it breaks, and what is missing."
))

story.append(subsection("3.1 Account Creation & Authentication"))
story.append(body(
    "<b>How signup works:</b> A new user navigates to /signup, enters their email and creates a password. "
    "The signup page calls POST /api/auth/register which creates a User record in the database and "
    "a Session record. The user is then redirected to /app (the main dashboard)."
))
story.append(body(
    "<b>Authentication flow:</b> The application uses email+OTP authentication. When a user enters their "
    "email at /login, the frontend calls POST /api/auth/request-otp which generates a 6-digit OTP code "
    "stored in the OtpCode table. The user enters the code, the frontend calls POST /api/auth/verify-otp, "
    "and upon success, a session cookie (dmq_session) is set. The proxy.ts/middleware.ts then uses this "
    "cookie to route authenticated vs unauthenticated users. However, the proxy.ts file was recently deleted "
    "during deployment debugging, meaning the session-based routing is currently non-functional. Unauthenticated "
    "users will see the raw Next.js app page instead of the landing page."
))
story.append(body(
    "<b>Status:</b> Authentication works at the API level. Session management works. But the routing "
    "layer (proxy/middleware) is currently removed, so the landing page redirect is broken."
))

story.append(subsection("3.2 First Login & Onboarding"))
story.append(body(
    "After successful authentication, the user is redirected to /app which loads the main CRM dashboard. "
    "The dashboard-screen.tsx (553 lines) renders a comprehensive overview with company stats, pipeline "
    "summary, recent activities, and quick action cards. The onboarding flow (onboarding-flow.tsx) was "
    "fixed in Sprint 9.2 but the specific triggers for new-user onboarding are not clear from the code "
    "analysis. There is no explicit first-login detection or step-by-step wizard. The user lands on the "
    "dashboard and must self-navigate."
))
story.append(body(
    "<b>Status:</b> Dashboard loads but onboarding is self-service, not guided. No first-run experience."
))

story.append(subsection("3.3 Data Upload Journey (2,000 Companies Example)"))
story.append(body(
    "This is the core value proposition of the CRM. Here is the step-by-step flow with honest "
    "assessment of what works and what does not:"
))

story.append(body("<b>Step 1: Navigate to Import Screen</b>"))
story.append(body(
    "The import-screen.tsx (1,663 lines) is one of the most complete screens in the application. It provides "
    "a file upload interface with drag-and-drop support, column mapping, data preview, and validation. "
    "The user clicks the 'Import' nav item to reach this screen. <b>Status: WORKS</b>"
))

story.append(body("<b>Step 2: Upload Excel File</b>"))
story.append(body(
    "The upload handler accepts .xlsx, .csv, and .tsv files. The frontend reads the file using the xlsx "
    "library and sends the parsed data to the Data Intelligence Engine via the upload endpoints. "
    "<b>Status: WORKS for basic file parsing. The xlsx library is included as a dependency.</b>"
))

story.append(body("<b>Step 3: Column Mapping & Validation</b>"))
story.append(body(
    "The Data Intelligence Engine provides automatic column detection and mapping rules. The "
    "g-data/[...slug]/config/ routes handle column-rules, validation-rules, normalization, and scoring. "
    "The frontend shows a preview of mapped columns. <b>Status: WORKS at the UI level. Backend validation "
    "rules exist but reference FieldValidationRule model which IS in the schema.</b>"
))

story.append(body("<b>Step 4: Deduplication</b>"))
story.append(body(
    "The deduplication module (g-crm/[...slug]/duplicates.ts, duplicates-screen.tsx) identifies duplicate "
    "companies and contacts using name matching and domain matching. The leads__dedup handler performs "
    "fuzzy matching. <b>Status: WORKS for basic dedup. Advanced fuzzy matching exists but may have "
    "edge cases with the schema field naming issues.</b>"
))

story.append(body("<b>Step 5: Data Processing & Enrichment</b>"))
story.append(body(
    "After import, the enrichment pipeline (companies__enrich-batch.ts, ai/enrich route) would enrich "
    "companies with additional data from the AI module. However, the ai/enrich route has 16+ TypeScript "
    "errors because it references non-existent schema fields (company.name, contact.jobTitle, etc.). "
    "<b>Status: BROKEN. The enrichment pipeline will crash at runtime due to schema mismatches.</b>"
))

story.append(body("<b>Step 6: AI Analysis & Recommendations</b>"))
story.append(body(
    "The AI module includes chat, query, summarize, and reasoning capabilities. However, ALL AI routes "
    "(ai/chat, ai/enrich, ai/summarize, ai/query, ai/opportunities, ai/account-brief, ai/score-leads, "
    "ai/suggested-contacts, ai/conversation-plan) have critical TypeScript errors from schema mismatches. "
    "<b>Status: BROKEN. All AI features will crash when invoked.</b>"
))

story.append(body("<b>Step 7: Reports & Analytics</b>"))
story.append(body(
    "The analytics and reports modules have their own issues. The analytics route references importBatchId "
    "which does not exist in the Contact model. Reports routes (activity, data-quality, pipeline, revenue, "
    "team-performance) reference various missing models. <b>Status: PARTIALLY WORKING. Dashboard-level "
    "stats may work, but detailed reports will crash.</b>"
))

story.append(subsection("3.4 What Screens the User Will See"))
story.append(body(
    "The application has 65 screen components mapped in screen-map.tsx. The navigation sidebar provides "
    "access to all screens. When a user clicks a nav item, the corresponding screen loads via React.lazy(). "
    "The screens are visually polished with Tailwind CSS, Radix UI components, and a consistent dark/light "
    "theme. However, many screens will show loading states or empty states because their API backends crash."
))

story.append(subsection("3.5 What Happens When Something Fails"))
story.append(body(
    "Currently, when an API call fails, the frontend receives a 500 error response with a generic error "
    "message. There is no global error boundary in the React app to catch these errors gracefully. "
    "The user will see either an empty table, a loading spinner that never resolves, or the raw error "
    "JSON if the error handling is inconsistent across screens. There is no retry mechanism, no error "
    "recovery flow, and no user-friendly error messaging system."
))


# SECTION 4: PRODUCTION READINESS
story.extend(section("4. Production Readiness"))
story.append(subsection("4.1 Overall Assessment"))
story.append(body(
    "<b>This application is NOT production-ready in its current state.</b> It is a functional prototype "
    "with a polished UI and sound architecture, but critical backend gaps make it unsuitable for "
    "enterprise deployment. The frontend is approximately 70% complete; the backend is approximately "
    "40% complete when accounting for the schema mismatches and missing models."
))

story.append(subsection("4.2 What Would Break on Day 1 with a Paying Customer"))
story.append(make_table(
    ["Area", "What Would Break", "Severity"],
    [
        ["Authentication", "Session routing broken (no proxy.ts)", "HIGH"],
        ["CRM Core", "Comments, Custom Fields, Tags, Teams, Tasks all crash", "CRITICAL"],
        ["AI Module", "All 9 AI features crash at runtime", "CRITICAL"],
        ["Opportunities", "Cannot create or view opportunities", "HIGH"],
        ["Notifications", "Notification system completely non-functional", "MEDIUM"],
        ["Email Sending", "Generation crashes (schema mismatch)", "HIGH"],
        ["Data Import", "Upload works, but enrichment fails", "HIGH"],
        ["Reports", "Analytics and detailed reports crash", "HIGH"],
        ["Deployment", "Render build failing (Prisma version mismatch)", "CRITICAL"],
    ],
    [100, 260, 100]
))

story.append(subsection("4.3 Security Risks Remaining"))
story.append(bullet("<b>Auth Guard Gaps:</b> Only ~22 of 172 API routes have explicit checkApiAuth() guards. The catch-all route handlers in g-crm, g-data, g-ai, g-outreach, g-strategy, g-system do have auth checks, but direct API routes (like api/comments, api/teams, api/tags) do NOT have auth guards. An unauthenticated user can call these endpoints directly."))
story.append(bullet("<b>No Rate Limiting at Edge:</b> While rate limiting was added to auth endpoints, there is no global rate limiting on API routes. A malicious user could flood the API."))
story.append(bullet("<b>No Input Sanitization in AI Routes:</b> AI routes accept user input and pass it to external APIs and database queries. While Prisma parameterizes queries, there is no content sanitization for prompt injection."))
story.append(bullet("<b>Session Management:</b> Sessions are stored in the database (Session model) with a simple cookie. There is no session expiry mechanism, no IP binding, and no rotation of session tokens."))
story.append(bullet("<b>Exposed Render API Key:</b> The Render API key was shared in chat during this session and should be rotated immediately."))

story.append(subsection("4.4 Scalability Limitations"))
story.append(bullet("<b>Render Free Tier:</b> 512MB RAM, 0.1 CPU. The node_modules are 1.5GB. Build barely fits. Runtime will be very slow with 172 API routes and 68 database models."))
story.append(bullet("<b>SQLite vs PostgreSQL:</b> Local development uses SQLite (file:/db/custom.db) while production uses Neon PostgreSQL. Schema differences could cause subtle bugs."))
story.append(bullet("<b>No Connection Pooling Config:</b> While the Neon adapter is in dependencies, the actual connection pooling configuration is not verified for production load."))
story.append(bullet("<b>No Caching Layer:</b> There is no Redis or in-memory caching for frequently accessed data like company lists, pipeline status, or dashboard stats. Every page load hits the database."))
story.append(bullet("<b>No CDN for Static Assets:</b> All static assets (JS, CSS, images) are served directly by the application server, not through a CDN."))


# SECTION 5: FEATURE COMPLETENESS
story.extend(section("5. Feature Completeness"))

modules = [
    ["Authentication", "PARTIAL", "API works (OTP flow). Session routing broken. No password reset verification. No 2FA. No SSO."],
    ["CRM - Companies", "OK", "Full CRUD, search, filter, sort, paginate, duplicate check. Clean after Phase 9."],
    ["CRM - Contacts", "PARTIAL", "Basic CRUD works. validate route crashes. generate-email route crashes. Timeline route has type errors."],
    ["CRM - Leads", "OK", "Full handler with assign, consent, dedup, export, lookalike, recalculate-scores."],
    ["CRM - Segments", "OK", "Working with contact assignment."],
    ["CRM - Pipeline", "OK", "Clean after demo removal. Empty state works."],
    ["Data Import", "PARTIAL", "Upload works. Column mapping UI exists. But enrichment/validation backends crash."],
    ["Deduplication", "OK", "Basic dedup handler with fuzzy matching."],
    ["AI Enrichment", "BROKEN", "All 9 AI routes have critical schema mismatches. None work at runtime."],
    ["AI Chat", "BROKEN", "References 20+ non-existent fields."],
    ["Intelligence Engine", "PARTIAL", "Screens exist and render. Backend data sources may have gaps."],
    ["Outreach - Sequences", "OK", "Handler files exist with proper CRUD."],
    ["Outreach - Templates", "OK", "Working."],
    ["Outreach - Email Queue", "OK", "SendQueue model exists."],
    ["Revenue Intelligence", "PARTIAL", "Screens polished. Backend brief/opportunity generators have TS errors."],
    ["Reports", "PARTIAL", "Activity, pipeline, revenue, team-performance routes have errors."],
    ["Dashboard", "OK", "Dashboard screen (553 lines) with stats and quick actions."],
    ["Analytics", "PARTIAL", "Analytics route has 5 errors (importBatchId). Screen renders."],
    ["Settings", "OK", "In-memory settings with deep merge. Working."],
    ["Comments", "BROKEN", "Model does not exist in schema."],
    ["Custom Fields", "BROKEN", "Model does not exist in schema."],
    ["Notifications", "BROKEN", "Model does not exist in schema."],
    ["Teams", "BROKEN", "Model does not exist in schema."],
    ["Tags", "BROKEN", "Model does not exist in schema."],
    ["Tasks", "BROKEN", "References missing models."],
    ["Opportunities", "BROKEN", "Model does not exist in schema."],
]

story.append(make_table(
    ["Module", "Status", "Details"],
    modules,
    [110, 65, 285]
))
story.append(spacer(8))


# SECTION 6: CODE QUALITY
story.extend(section("6. Code Quality Review"))

story.append(subsection("6.1 Remaining Bugs"))
story.append(body(
    "<b>677 TypeScript errors</b> across 107 files. The majority are in AI routes (80+ errors), "
    "comments/custom-fields/notifications/teams/tags routes (50+ errors combined), and analytics/batches "
    "routes. The errors represent real runtime crashes, not just type annotations."
))
story.append(body(
    "<b>14 missing Prisma models</b> that are referenced in code but not defined in the schema. "
    "These must either be added to the schema or the referencing code must be removed."
))
story.append(body(
    "<b>87 dead route files</b> in src/app/api/routes/ that duplicate functionality of the catch-all "
    "handlers. These add confusion, increase build time, and have their own set of TS errors."
))

story.append(subsection("6.2 Missing Validations"))
story.append(bullet("No Zod validation on most API routes (only ab-tests and companies have it from Phase 9)"))
story.append(bullet("No input length limits on most text fields"))
story.append(bullet("No file size limits on upload endpoints"))
story.append(bullet("No pagination limits enforced on some list endpoints (can request limit=10000)"))
story.append(bullet("No SQL injection protection beyond what Prisma provides (which is good, but raw queries should be checked)"))

story.append(subsection("6.3 Test Coverage"))
story.append(body(
    "The test infrastructure exists (vitest is configured, test files are present in src/app/api/__tests__/), "
    "but the tests cannot run because the test files themselves have TypeScript errors referencing missing "
    "models. The actual test pass rate is unknown. Based on the code analysis, approximately 30% of "
    "the test suite would fail even if TypeScript errors were ignored, because the tests reference "
    "database models and API responses that no longer match the schema."
))

story.append(subsection("6.4 Database Risks"))
story.append(bullet("Schema has 68 models but code references 82+ models (14 missing)"))
story.append(bullet("No foreign key constraints enforced at application level for some relations"))
story.append(bullet("No database migration history (using prisma db push, not prisma migrate)"))
story.append(bullet("No database backup strategy documented"))
story.append(bullet("No seed data for production (demo data was removed in Phase 9)"))

story.append(subsection("6.5 Performance Risks"))
story.append(bullet("No database indexing strategy defined"))
story.append(bullet("No query optimization for large datasets (2,000+ companies)"))
story.append(bullet("No lazy loading on company detail screen (loads all data at once)"))
story.append(bullet("No pagination on some list endpoints"))
story.append(bullet("Frontend loads 65 screens via React.lazy() but the initial bundle is still large"))


# SECTION 7: UI/UX REVIEW
story.extend(section("7. UI/UX Review"))

story.append(subsection("7.1 Overall Visual Assessment"))
story.append(body(
    "The application UI is <b>visually polished and consistent</b>. It uses Tailwind CSS with a "
    "professional color scheme (dark blue primary, clean whites, subtle grays). The Radix UI component "
    "library provides consistent, accessible form elements. The layout follows a standard CRM pattern: "
    "left sidebar navigation, main content area, and contextual panels. The screens are well-organized "
    "with proper spacing, typography hierarchy, and visual grouping."
))
story.append(body(
    "However, the UI is <b>not enterprise-grade</b> in its current form. There are several indicators "
    "that suggest prototype-level maturity rather than production quality."
))

story.append(subsection("7.2 Screens That Look Unfinished"))
story.append(make_table(
    ["Screen", "Issue", "Severity"],
    [
        ["Demo Experience", "Still exists in codebase, not deleted", "LOW"],
        ["Intelligence Reasoning", "Shows null state (fixed in Phase 9 but no data)", "MEDIUM"],
        ["Intelligence Report", "Shows empty state, no real data flow", "MEDIUM"],
        ["Company Detail", "Bridge wrapper with require() hack", "MEDIUM"],
        ["Contact Detail", "Bridge wrapper with require() hack", "MEDIUM"],
        ["All Bridge Screens (6)", "Use require() instead of proper imports", "LOW"],
        ["Pipeline", "Empty state after demo removal (intended)", "OK"],
        ["Dashboard", "Stats may show zeros (no data)", "MEDIUM"],
    ],
    [110, 240, 110]
))

story.append(subsection("7.3 Improvements Needed for Client Presentation"))
story.append(bullet("<b>Remove all Bridge wrappers:</b> Replace require() patterns with proper React imports"))
story.append(bullet("<b>Add loading skeletons:</b> Replace loading spinners with skeleton placeholders"))
story.append(bullet("<b>Add error boundaries:</b> Wrap each screen in React error boundaries"))
story.append(bullet("<b>Add empty state illustrations:</b> Custom SVG illustrations for zero-data states"))
story.append(bullet("<b>Add onboarding wizard:</b> Step-by-step guide for first-time users"))
story.append(bullet("<b>Add breadcrumb navigation:</b> Users currently lose context in deep screens"))
story.append(bullet("<b>Add notification/toast system:</b> Currently using sonner but inconsistently"))
story.append(bullet("<b>Add responsive design:</b> Current layout is desktop-only"))


# SECTION 8: FINAL CONFIDENCE ASSESSMENT
story.extend(section("8. Final Confidence Assessment"))
story.append(body(
    "The following ratings are based on the comprehensive code audit, not subjective opinion. Each rating "
    "reflects the actual state of the code as of commit 770c881 on the main branch."
))
story.append(spacer(16))

# Confidence scores
scores = [
    ("Production Readiness", "25%", "CRITICAL blockers: 14 missing DB models, 677 TS errors, deployment failure, no working AI module"),
    ("Enterprise Customer Readiness", "15%", "Cannot onboard a paying customer. Core features (opportunities, tasks, teams, notifications) are completely broken"),
    ("Code Quality", "35%", "Architecture is sound. But 677 errors, 87 dead files, missing tests, no CI/CD"),
    ("UI/UX Quality", "65%", "Visually polished. Needs error boundaries, loading states, responsive design, onboarding"),
    ("Security", "40%", "Auth guards exist but incomplete. No rate limiting on most routes. No input sanitization on AI routes"),
    ("API Completeness", "45%", "172 routes defined. ~60 work correctly. ~40 crash at runtime. ~20 are dead code"),
]

for label, score, note in scores:
    story.append(KeepTogether([
        Spacer(1, 8),
        Table([
            [Paragraph(score, styles['ConfidenceNumber']), Paragraph(label, ParagraphStyle('scoreLabel', fontName='Inter-Bold', fontSize=14, leading=18, textColor=TEXT_DARK))],
            [Paragraph(note, ParagraphStyle('scoreNote', fontName='Inter', fontSize=9, leading=13, textColor=TEXT_MUTED)), ''],
        ], colWidths=[80, 380]),
        Spacer(1, 8),
    ]))

story.append(spacer(20))
story.append(HRFlowable(width="100%", thickness=1, color=BORDER_GRAY, spaceAfter=12))

# Summary box
story.append(make_table(
    ["Metric", "Value"],
    [
        ["Current Production Readiness", "25%"],
        ["Enterprise Customer Readiness", "15%"],
        ["Remaining Critical Blockers", "14"],
        ["Estimated Effort to Fully Deploy", "3-4 weeks (1 senior developer)"],
    ],
    [240, 220]
))
story.append(spacer(12))

story.append(subsection("Remaining Critical Blockers (Must Fix Before Any Deployment)"))
story.append(bullet("1. Fix Prisma version pinning for Render deployment (build currently failing)"))
story.append(bullet("2. Add 14 missing Prisma models or remove referencing code"))
story.append(bullet("3. Fix 80+ schema field mismatches in AI routes (company.name vs rawName, etc.)"))
story.append(bullet("4. Restore proxy.ts/middleware.ts for session-based routing"))
story.append(bullet("5. Add auth guards to all unprotected direct API routes"))
story.append(bullet("6. Delete 87 dead route files from src/app/api/routes/"))
story.append(bullet("7. Delete dead demo/mock files"))
story.append(bullet("8. Fix all TypeScript errors in analytics, batches, timeline routes"))
story.append(bullet("9. Add React error boundaries to all screen components"))
story.append(bullet("10. Add global API error handling with user-friendly messages"))
story.append(bullet("11. Set up proper CI/CD with test runs on push"))
story.append(bullet("12. Add database connection pooling for production"))
story.append(bullet("13. Create production seed data (minimal, not demo)"))
story.append(bullet("14. Rotate compromised Render API key"))

story.append(spacer(16))
story.append(body(
    "<b>Bottom Line:</b> The DeepMindQ CRM has a strong architectural foundation with a polished UI layer, "
    "a comprehensive screen library, and well-organized API routing. However, the backend has "
    "significant gaps where code was written against a schema that was never fully implemented. The "
    "14 missing database models alone make nearly 30% of the application's features non-functional. "
    "With focused effort on the 14 blockers above, the application could reach production readiness "
    "within 3-4 weeks. Without addressing these issues, it remains a high-quality prototype that "
    "cannot be deployed for real users."
))


# BUILD PDF
doc = SimpleDocTemplate(
    OUTPUT_PATH,
    pagesize=A4,
    topMargin=20*mm,
    bottomMargin=20*mm,
    leftMargin=20*mm,
    rightMargin=20*mm,
    title="DeepMindQ CRM - End-to-End Validation Report",
    author="Super Z AI Engineer",
    subject="Technical & Product Validation Audit - Phase 9",
)

doc.build(story)
print(f"Report generated: {OUTPUT_PATH}")
print(f"File size: {os.path.getsize(OUTPUT_PATH) / 1024:.1f} KB")
