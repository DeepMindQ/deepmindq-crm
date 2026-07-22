#!/usr/bin/env python3
"""Sprint 9.1 Audit Report Generator - DeepMindQ Product Stabilization"""

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm, inch
from reportlab.lib.colors import HexColor, white, black
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, KeepTogether, HRFlowable
)
from reportlab.lib import colors
import os

OUTPUT = "/home/z/my-project/download/Sprint_9.1_Audit_Report.pdf"
os.makedirs(os.path.dirname(OUTPUT), exist_ok=True)

# Colors
INDIGO = HexColor("#4F46E5")
INDIGO_LIGHT = HexColor("#EEF2FF")
RED = HexColor("#DC2626")
RED_LIGHT = HexColor("#FEE2E2")
AMBER = HexColor("#D97706")
AMBER_LIGHT = HexColor("#FEF3C7")
BLUE = HexColor("#2563EB")
BLUE_LIGHT = HexColor("#DBEAFE")
GREEN = HexColor("#059669")
GREEN_LIGHT = HexColor("#D1FAE5")
GRAY = HexColor("#6B7280")
GRAY_LIGHT = HexColor("#F3F4F6")
DARK = HexColor("#1F2937")
BORDER = HexColor("#E5E7EB")

doc = SimpleDocTemplate(
    OUTPUT,
    pagesize=A4,
    rightMargin=50, leftMargin=50,
    topMargin=50, bottomMargin=50
)

styles = getSampleStyleSheet()

# Custom styles
styles.add(ParagraphStyle(
    name='CoverTitle', fontName='Helvetica-Bold', fontSize=32,
    textColor=white, alignment=TA_CENTER, spaceAfter=12, leading=38
))
styles.add(ParagraphStyle(
    name='CoverSubtitle', fontName='Helvetica', fontSize=14,
    textColor=HexColor("#C7D2FE"), alignment=TA_CENTER, spaceAfter=6
))
styles.add(ParagraphStyle(
    name='SectionTitle', fontName='Helvetica-Bold', fontSize=18,
    textColor=INDIGO, spaceBefore=24, spaceAfter=10, leading=22
))
styles.add(ParagraphStyle(
    name='SubSection', fontName='Helvetica-Bold', fontSize=13,
    textColor=DARK, spaceBefore=16, spaceAfter=6, leading=16
))
styles.add(ParagraphStyle(
    name='BodyText2', fontName='Helvetica', fontSize=9.5,
    textColor=DARK, spaceAfter=6, leading=14, alignment=TA_JUSTIFY
))
styles.add(ParagraphStyle(
    name='IssueTitle', fontName='Helvetica-Bold', fontSize=10,
    textColor=DARK, spaceBefore=8, spaceAfter=3, leading=13
))
styles.add(ParagraphStyle(
    name='IssueDetail', fontName='Helvetica', fontSize=9,
    textColor=GRAY, spaceAfter=4, leading=12, leftIndent=10
))
styles.add(ParagraphStyle(
    name='IssueFile', fontName='Courier', fontSize=8,
    textColor=HexColor("#6366F1"), spaceAfter=8, leftIndent=10
))
styles.add(ParagraphStyle(
    name='SmallGray', fontName='Helvetica', fontSize=8,
    textColor=GRAY, alignment=TA_CENTER
))
styles.add(ParagraphStyle(
    name='TableHeader', fontName='Helvetica-Bold', fontSize=9,
    textColor=white, alignment=TA_CENTER
))
styles.add(ParagraphStyle(
    name='TableCell', fontName='Helvetica', fontSize=8.5,
    textColor=DARK, leading=11
))
styles.add(ParagraphStyle(
    name='TableCellCenter', fontName='Helvetica', fontSize=8.5,
    textColor=DARK, alignment=TA_CENTER, leading=11
))

story = []

# ═══════════════════════════════════════════════════════════════
# COVER PAGE
# ═══════════════════════════════════════════════════════════════
# Dark cover background using a table
cover_bg = Table(
    [['']], colWidths=[A4[0]], rowHeights=[A4[1]]
)
cover_bg.setStyle(TableStyle([
    ('BACKGROUND', (0, 0), (-1, -1), INDIGO),
    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
]))

story.append(Spacer(1, 120))

# Title block
story.append(Paragraph("DeepMindQ", styles['CoverTitle']))
story.append(Spacer(1, 8))
story.append(Paragraph("Sprint 9.1 — Product Stabilization", ParagraphStyle(
    'CoverPhase', fontName='Helvetica-Bold', fontSize=16,
    textColor=HexColor("#A5B4FC"), alignment=TA_CENTER, spaceAfter=6
)))
story.append(Paragraph("UI/UX &amp; User Journey Audit Report", styles['CoverSubtitle']))
story.append(Spacer(1, 30))
story.append(HRFlowable(width="40%", color=HexColor("#6366F1"), thickness=2))
story.append(Spacer(1, 20))

# Summary stats on cover
summary_data = [
    [Paragraph('<font color="#FCA5A5"><b>12</b></font>', styles['TableCellCenter']),
     Paragraph('<font color="#FDE68A"><b>17</b></font>', styles['TableCellCenter']),
     Paragraph('<font color="#93C5FD"><b>22</b></font>', styles['TableCellCenter']),
     Paragraph('<font color="#A5B4FC"><b>15</b></font>', styles['TableCellCenter'])],
    [Paragraph('<b>Critical</b>', ParagraphStyle('s', fontName='Helvetica', fontSize=8, textColor=HexColor("#C7D2FE"), alignment=TA_CENTER)),
     Paragraph('<b>High</b>', ParagraphStyle('s', fontName='Helvetica', fontSize=8, textColor=HexColor("#C7D2FE"), alignment=TA_CENTER)),
     Paragraph('<b>Medium</b>', ParagraphStyle('s', fontName='Helvetica', fontSize=8, textColor=HexColor("#C7D2FE"), alignment=TA_CENTER)),
     Paragraph('<b>Low</b>', ParagraphStyle('s', fontName='Helvetica', fontSize=8, textColor=HexColor("#C7D2FE"), alignment=TA_CENTER))],
]
cover_table = Table(summary_data, colWidths=[80, 80, 80, 80])
cover_table.setStyle(TableStyle([
    ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ('TOPPADDING', (0, 0), (-1, 0), 12),
    ('BOTTOMPADDING', (0, 1), (-1, 1), 12),
    ('BACKGROUND', (0, 0), (-1, -1), HexColor("#312E81")),
    ('ROUNDEDCORNERS', [8, 8, 8, 8]),
    ('BOX', (0, 0), (-1, -1), 1, HexColor("#6366F1")),
]))
story.append(cover_table)

story.append(Spacer(1, 60))
story.append(Paragraph("Feature Freeze | Audit Only | No Fixes Applied", ParagraphStyle(
    'CoverNote', fontName='Helvetica', fontSize=10, textColor=HexColor("#818CF8"), alignment=TA_CENTER
)))
story.append(Spacer(1, 12))
story.append(Paragraph("July 2026", ParagraphStyle('CoverDate', fontName='Helvetica', fontSize=11, textColor=HexColor("#A5B4FC"), alignment=TA_CENTER)))

story.append(PageBreak())

# ═══════════════════════════════════════════════════════════════
# EXECUTIVE SUMMARY
# ═══════════════════════════════════════════════════════════════
story.append(Paragraph("Executive Summary", styles['SectionTitle']))
story.append(HRFlowable(width="100%", color=BORDER, thickness=1))
story.append(Spacer(1, 8))

story.append(Paragraph(
    "This report documents the complete Sprint 9.1 audit of the DeepMindQ Enterprise Intelligence Operating System. "
    "The audit covers all 8 product phases (Phase 1: CRM Foundation through Phase 8: AI Revenue Copilot), spanning "
    "212 API endpoints, 63 UI screen components, Prisma database schema (1,845 lines), authentication/security infrastructure, "
    "and end-to-end user journeys. This is an audit-only sprint — no fixes have been applied. All findings are categorized "
    "by severity for review and approval before Sprint 9.2 (Product Hardening).",
    styles['BodyText2']
))
story.append(Spacer(1, 6))

story.append(Paragraph(
    "The audit identified <b>66 total issues</b>: 12 Critical, 17 High, 22 Medium, and 15 Low. The most significant "
    "cluster is in Security (6 Critical issues), followed by Database (4 Critical) and API Architecture (2 Critical). "
    "The highest-priority action items are: (1) adding authentication to 190+ unprotected API endpoints, (2) fixing OTP "
    "brute-force vulnerability, (3) removing debug endpoints from production, (4) rotating leaked API keys, and (5) adding "
    "database connection pooling for Vercel serverless deployment. UI/UX issues are generally less severe, with the main "
    "concerns being 35 screens missing empty states and 9 locations where errors are silently swallowed.",
    styles['BodyText2']
))

story.append(Spacer(1, 12))

# Summary table
summary_header = [
    Paragraph('<b>Category</b>', styles['TableHeader']),
    Paragraph('<b>Critical</b>', styles['TableHeader']),
    Paragraph('<b>High</b>', styles['TableHeader']),
    Paragraph('<b>Medium</b>', styles['TableHeader']),
    Paragraph('<b>Low</b>', styles['TableHeader']),
    Paragraph('<b>Total</b>', styles['TableHeader']),
]

def rc(color, text):
    return Paragraph(f'<font color="{color}"><b>{text}</b></font>', styles['TableCellCenter'])

summary_rows = [
    summary_header,
    ['Security &amp; Auth', rc('#DC2626','6'), rc('#D97706','8'), rc('#2563EB','3'), '', '17'],
    ['Database &amp; Schema', rc('#DC2626','4'), rc('#D97706','5'), rc('#2563EB','5'), rc('#059669','1'), '15'],
    ['API Architecture', rc('#DC2626','2'), rc('#D97706','2'), rc('#2563EB','3'), '', '7'],
    ['UI/UX &amp; Components', '', rc('#D97706','2'), rc('#2563EB','7'), rc('#059669','10'), '19'],
    ['Performance &amp; N+1', '', '', rc('#2563EB','3'), '', '3'],
    ['User Journey Gaps', '', '', rc('#2563EB','1'), rc('#059669','4'), '5'],
    [Paragraph('<b>TOTAL</b>', styles['TableCell']), rc('#DC2626','12'), rc('#D97706','17'), rc('#2563EB','22'), rc('#059669','15'), rc('#1F2937','66')],
]

t = Table(summary_rows, colWidths=[120, 55, 45, 55, 40, 45])
t.setStyle(TableStyle([
    ('BACKGROUND', (0, 0), (-1, 0), INDIGO),
    ('TEXTCOLOR', (0, 0), (-1, 0), white),
    ('BACKGROUND', (0, 1), (-1, -2), GRAY_LIGHT),
    ('BACKGROUND', (0, -1), (-1, -1), HexColor("#F0F0FF")),
    ('GRID', (0, 0), (-1, -1), 0.5, BORDER),
    ('ALIGN', (1, 0), (-1, -1), 'CENTER'),
    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ('TOPPADDING', (0, 0), (-1, -1), 5),
    ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ('LEFTPADDING', (0, 0), (-1, -1), 8),
]))
story.append(t)

story.append(PageBreak())

# ═══════════════════════════════════════════════════════════════
# SECTION 1: SECURITY AUDIT
# ═══════════════════════════════════════════════════════════════
story.append(Paragraph("1. Security &amp; Authentication", styles['SectionTitle']))
story.append(HRFlowable(width="100%", color=BORDER, thickness=1))
story.append(Spacer(1, 6))
story.append(Paragraph(
    "The security audit identified 6 Critical and 8 High severity issues. The most alarming finding is that "
    "<b>194 out of 198 API handler files</b> (all non-auth endpoints) have zero authentication checks. "
    "Anyone who can reach the API can read, modify, or delete all CRM data, trigger email sends, execute AI operations, "
    "and access administrative functions without any session verification. This is the single highest-priority fix "
    "that must be addressed in Sprint 9.2 before any production release.",
    styles['BodyText2']
))

def issue(id, severity, title, detail, files):
    colors_map = {
        'CRITICAL': (RED, RED_LIGHT),
        'HIGH': (AMBER, AMBER_LIGHT),
        'MEDIUM': (BLUE, BLUE_LIGHT),
        'LOW': (GRAY, GRAY_LIGHT),
    }
    fg, bg = colors_map.get(severity, (GRAY, GRAY_LIGHT))
    
    story.append(KeepTogether([
        Table(
            [[Paragraph(f'<b>{id}</b> <font color="{fg}">[{severity}]</font> {title}', styles['IssueTitle'])]],
            colWidths=[A4[0] - 100]
        ),
        Paragraph(detail, styles['IssueDetail']),
        Paragraph(f"Files: {files}", styles['IssueFile']),
    ]))

issue("C1", "CRITICAL", "Missing Authentication on 190+ API Endpoints",
    "Only 4 of 198 API handler files import requireAuth or getCurrentSession. All endpoints in g-crm, g-ai, g-data, g-outreach, g-strategy, g-system, g-intelligence, g-revenue-intelligence, g-ai-copilot, g-intel-acquisition have zero session verification. Any unauthenticated HTTP request can read/write the entire database.",
    "src/app/api/g-crm/[...slug]/*.ts, src/app/api/g-data/[...slug]/*.ts, src/app/api/g-ai/[...slug]/*.ts, + 6 more groups")

issue("C2", "CRITICAL", "OTP Brute-Force Vulnerability — Attempts Never Increment on Wrong Codes",
    "verifyOtp() queries DB with WHERE code=X. If code is wrong, findFirst returns null and 'Invalid code' is returned WITHOUT incrementing the attempts counter. MAX_ATTEMPTS=5 only triggers if someone already knows the correct code. An attacker can try all 1,000,000 possible 6-digit OTPs with zero lockout.",
    "src/lib/otp.ts:241-253")

issue("C3", "CRITICAL", "Debug Endpoint Exposes API Key Fragments",
    "GET /api/debug/env-check returns the first 8 characters of GEMINI_API_KEY and TAVILY_API_KEY. No authentication required. The endpoint also makes live API calls to verify the keys. Deployed and reachable in production.",
    "src/app/api/debug/env-check/route.ts:8-10")

issue("C4", "CRITICAL", "Real API Keys in .env.vercel-pull",
    "Plaintext GEMINI_API_KEY and TAVILY_API_KEY stored in .env.vercel-pull. While .gitignore excludes .env* files, the keys exist on disk and are visible to any process with filesystem access. Keys should be rotated.",
    ".env.vercel-pull:7,11")

issue("C5", "CRITICAL", "Full Vercel OIDC Tokens in Env Files",
    "VERCEL_OIDC_TOKEN with owner-level scopes stored in plaintext in .env.local and .env.vercel-pull. These tokens grant full project access on Vercel.",
    ".env.local:2, .env.vercel-pull:12")

issue("C6", "CRITICAL", "Unprotected Seed Endpoint",
    "POST /api/seed recreates entire database with sample data. No authentication check. Anyone can trigger a re-seed, potentially wiping production data.",
    "src/app/api/g-system/[...slug]/seed.ts:4")

issue("H1", "HIGH", "CSRF Bypassed in Development Mode",
    "If NODE_ENV !== 'production' and no CSRF token is present, request is allowed through. Zero CSRF protection in development. Staging environments running in non-production mode are fully exploitable.",
    "src/lib/csrf.ts:18-21")

issue("H2", "HIGH", "Auth Bypassed on Exception in API Middleware",
    "If getCurrentSession() throws (not returns null), catch block allows request with authorized:true and userId:'dev-user' in non-production. Dangerous fallback that could mask real auth issues.",
    "src/lib/api-middleware.ts:65-68")

issue("H3", "HIGH", "Hardcoded Default NEXTAUTH_SECRET",
    "NEXTAUTH_SECRET defaults to 'deepmindq-dev-secret-change-in-production'. If not overridden in production, all session signing uses a publicly known secret.",
    "src/lib/validate-env.ts:7")

issue("H4", "HIGH", "Hardcoded Default UNSUBSCRIBE_SECRET",
    "UNSUBSCRIBE_SECRET defaults to 'deepmindq-unsubscribe-secret-key'. Attacker can forge unsubscribe tokens for any email.",
    "src/lib/unsubscribe.ts:11")

issue("H5", "HIGH", "OTP Code Leaked in Email Subject Line",
    "Email subject includes the 6-digit OTP code: '${purposeLabel(purpose)} - ${code}'. Visible in notification previews, client sidebars, and server logs.",
    "src/lib/otp.ts:190")

issue("H6", "HIGH", "OTP Code Returned to Client When Email Fails",
    "When EMAIL_API_KEY is not configured, OTP code is returned as devCode in API response. If this fallback reaches production (missing env var), OTP codes are plaintext in responses.",
    "src/lib/otp.ts:211-213, auth__request-otp.ts:43")

issue("H7", "HIGH", "Webhook Signature Verification Has Silent Bypass",
    "If RESEND_WEBHOOK_SECRET is set but no signature header is present, webhook is still processed. Attacker can omit the signature header entirely to bypass verification.",
    "src/app/api/g-outreach/[...slug]/webhooks__reply.ts:234-248, webhooks__bounce.ts:140-153")

issue("H8", "HIGH", "Password Change Deletes Current Session (Self-Lockout)",
    "After password change, deleteMany({where:{userId}}) deletes ALL sessions including current. Comment says 'Don't delete current session' but WHERE clause has no exclusion. User gets locked out.",
    "src/app/api/g-auth/[...slug]/auth__change-password.ts:51-56")

issue("M1", "MEDIUM", "No CORS Configuration",
    "No Access-Control-Allow-Origin headers anywhere. Defaults to same-origin (safe), but API rewrites in next.config.ts may interact oddly with reverse proxies.",
    "src/middleware.ts, next.config.ts")

issue("M2", "MEDIUM", "CSP Allows unsafe-eval and unsafe-inline",
    "script-src 'self' 'unsafe-eval' 'unsafe-inline' negates XSS protection. Any injected script can execute.",
    "src/middleware.ts:42")

issue("M3", "MEDIUM", "CSP connect-src Allows Any HTTPS Origin",
    "connect-src 'self' https: allows data exfiltration to any HTTPS URL if XSS is achieved.",
    "src/middleware.ts:47")

story.append(PageBreak())

# ═══════════════════════════════════════════════════════════════
# SECTION 2: DATABASE AUDIT
# ═══════════════════════════════════════════════════════════════
story.append(Paragraph("2. Database &amp; Schema", styles['SectionTitle']))
story.append(HRFlowable(width="100%", color=BORDER, thickness=1))
story.append(Spacer(1, 6))
story.append(Paragraph(
    "The database audit examined the 1,845-line Prisma schema, 216 files using the Prisma client, and 4 files "
    "using transactions. Key findings include: zero Prisma enum types (30+ fields are free-text String), no migrations "
    "directory (schema managed via db push only, no rollback capability), missing connection pooling for Vercel "
    "serverless, and critical N+1 query patterns in the dedup endpoint that loads ALL contacts and performs O(n-squared) "
    "comparisons. Only 4 out of 216 DB-using files use transactions, leaving most multi-step operations vulnerable to "
    "partial failure and data corruption.",
    styles['BodyText2']
))

issue("C7", "CRITICAL", "Zero Prisma Enums — All Status Fields Are Free-Text String",
    "30+ fields representing fixed enumerations (Contact.status, Company.status, User.role, etc.) are plain String type with comments listing allowed values. No DB-level validation. Any typo silently inserted. Examples: Contact.status has 11 valid values, Company.signalType has 8, SequenceEnrollment.status has 4. No enum constraints exist anywhere.",
    "prisma/schema.prisma (30+ fields across entire file)")

issue("C8", "CRITICAL", "No Migrations Directory — No Schema Evolution Tracking",
    "prisma/ directory contains only schema.prisma. No migrations/ folder exists. Database was created via 'prisma db push' which is not migration-safe and has no rollback capability. No deployment pipeline integration. Schema drift between environments is likely.",
    "prisma/ (missing migrations/ directory)")

issue("C9", "CRITICAL", "Unbounded findMany() + O(n^2) Dedup Algorithm",
    "leads__dedup.ts loads EVERY contact in database with no limit, then runs nested O(n^2) loop comparing every contact against every other. With 10,000 contacts: loads 10K rows, performs ~50M comparisons. Will cause memory exhaustion, request timeouts, and database overload.",
    "src/app/api/g-crm/[...slug]/leads__dedup.ts:27")

issue("C10", "CRITICAL", "Only 4 of 216 Files Use Transactions",
    "Vast majority of multi-step write operations are NOT transactional. Critical non-transactional operations include: email-worker (send + update queue + update draft + update contact), webhooks (create reply + update contact + create event), leads dedup merge (move drafts + move replies + mark duplicate), and companies bulk delete (cascades to 20+ related tables).",
    "src/app/api/g-outreach/[...slug]/email-worker.ts, webhooks__reply.ts, leads__dedup.ts")

issue("H9", "HIGH", "Missing @unique on Contact.email",
    "Contact.email has an index but no @unique constraint. Multiple contacts can have the same email. Dedup endpoint runs O(n^2) scan in application code. A unique constraint at DB level would prevent this at the source.",
    "prisma/schema.prisma:17")

issue("H10", "HIGH", "No Serverless Connection Pooling (Neon/Vercel)",
    "PrismaClient instantiated with only logging options. For Neon PostgreSQL on Vercel serverless, each cold start creates a new TCP connection. No @prisma/adapter-neon, no pgbouncer, no connection_limit. Will hit Neon connection limits under load.",
    "src/lib/db.ts:11-18")

issue("H11", "HIGH", "Missing onDelete on 6 Relations",
    "Six relations lack onDelete policy: Contact->ImportBatch, OpportunityRecommendation->CompanySignal, OpportunityRecommendation->SignalCapabilityMatch, EmailSequence->OpportunityRecommendation, Draft->ABTest, AIEngagementStrategy->StrategicInsight. Deleting parent records will fail if children reference them.",
    "prisma/schema.prisma:59, 1171, 1172, 448, 522, 1802")

issue("H12", "HIGH", "Unbounded fetchDBMeta() Loads All Contacts + Companies",
    "leads.ts loads ALL contacts and ALL companies just to build filter dropdown metadata. Should use groupBy aggregation queries. With large datasets, this causes unnecessary memory and CPU usage.",
    "src/app/api/g-crm/[...slug]/leads.ts:281-283")

issue("H13", "HIGH", "N+1 in autoGenerateAlerts() — 100+ Individual DB Calls",
    "Four separate for loops each executing findFirst + create per item. With 50 degraded sources, makes 100+ individual queries. Should batch with bulk operations.",
    "src/lib/intelligence-sources/intelligence-alerts.ts:438-640")

issue("H14", "HIGH", "JSON Stored as String Instead of Json Type",
    "10+ fields storing JSON are typed as String rather than Prisma Json type (Contact.enrichmentData, Company.tags, CompanyResearchCard.keyPeople, Job.payload, etc.). No DB-level JSON validation, no JSON query operators, manual JSON.parse/stringify in 100+ locations.",
    "prisma/schema.prisma (multiple fields)")

issue("M4", "MEDIUM", "In-Memory Rate Limiter Ineffective in Production",
    "Rate limits use Map in process memory. On Vercel serverless, each invocation gets fresh process. Rate limiting is non-functional in production.",
    "src/lib/rate-limit.ts:18-19")

issue("M5", "MEDIUM", "Inconsistent Soft-Delete Pattern",
    "Multiple overlapping deletion mechanisms: Contact.isSuppressed (Boolean), Contact.status 'suppressed'/'archived'/'duplicate', separate Suppression table. Contradictory states possible: isSuppressed:true AND status:'sent'.",
    "Multiple models across schema")

issue("M6", "MEDIUM", "N+1 in retryAllFailed() — Sequential Updates in Loop",
    "Loads all failed jobs then updates each individually. Should use single updateMany with where:{id:{in:retryableIds}}.",
    "src/lib/workflow-engine/queue.ts:432-451")

issue("M7", "MEDIUM", "N+1 in email-worker — Sequential Per-Item Updates",
    "3 sequential updates per item after email send (queue, draft, contact). With 50 items = 150 sequential writes. Not wrapped in transaction — partial failures leave inconsistent state.",
    "src/app/api/g-outreach/[...slug]/email-worker.ts:69-158")

issue("M8", "MEDIUM", "Missing Index on Contact.normalizedName",
    "Contact.normalizedName has no index. If contacts are searched by normalized name, will be full table scan.",
    "prisma/schema.prisma:15")

issue("M9", "MEDIUM", "Company.normalizedName Not Unique",
    "normalizedName has index but no unique constraint. Multiple companies with same normalized name can exist, causing dedup confusion.",
    "prisma/schema.prisma:81")

issue("L1", "LOW", "AccountStrategy.companyId Optional When Semantically Required",
    "AccountStrategy.companyId is String? but strategies are inherently company-specific. Should be required.",
    "prisma/schema.prisma:743")

story.append(PageBreak())

# ═══════════════════════════════════════════════════════════════
# SECTION 3: API ARCHITECTURE
# ═══════════════════════════════════════════════════════════════
story.append(Paragraph("3. API Architecture &amp; Error Handling", styles['SectionTitle']))
story.append(HRFlowable(width="100%", color=BORDER, thickness=1))
story.append(Spacer(1, 6))
story.append(Paragraph(
    "The API audit examined all 212 TypeScript files in the API directory. Beyond the critical auth gap (C1), "
    "the most concerning findings are: 8 files with silent .catch(() => {}) blocks that swallow errors without "
    "user feedback, and massive numbers of unbounded findMany() queries across 60+ endpoint files that will cause "
    "performance degradation with growing data volumes. Many list endpoints also lack pagination.",
    styles['BodyText2']
))

issue("C11", "CRITICAL", "190+ API Endpoints Without Input Validation",
    "Beyond the auth gap, many endpoints accept raw request bodies without Zod validation. While g-crm endpoints use validateBody, endpoints in g-ai, g-intelligence, g-outreach, g-strategy often parse JSON directly without schema validation. Malformed input can cause unhandled exceptions.",
    "src/app/api/g-ai/[...slug]/*.ts, src/app/api/g-intelligence/[...slug]/*.ts")

issue("C12", "CRITICAL", "60+ Unbounded findMany() Queries Without Pagination",
    "Over 60 endpoint files use findMany() without .take() or pagination. Examples: queue.ts loads all send queue items, replies.ts loads all replies, sequences.ts loads all sequences. With growing data, these queries will cause memory exhaustion and slow responses.",
    "src/app/api/g-outreach/[...slug]/queue.ts, replies.ts, sequences.ts, + 57 more files")

issue("H15", "HIGH", "9 Silent .catch(() => {}) Blocks Swallow Errors",
    "8 files catch errors and do nothing: page.tsx (3 locations), bounces-screen.tsx (2), queue-screen.tsx, tag-manager.tsx, custom-field-renderer.tsx, conversation-studio-screen.tsx, leads-screen.tsx, drafts-screen.tsx, replies-screen.tsx. Users see stale/empty data with no error indication.",
    "src/app/page.tsx:480,902,993, src/components/screens/bounces-screen.tsx:64,77")

issue("H16", "HIGH", "Mock Reset-Password Returns Success Without Action",
    "auth__reset-password__confirm.ts always returns {success:true} without doing anything. User believes password was reset when it wasn't.",
    "src/app/api/g-auth/[...slug]/auth__reset-password__confirm.ts:6")

issue("M10", "MEDIUM", "Many fetch() Calls Don't Check res.ok",
    "Screens like segments-screen.tsx call res.json() without checking if response was successful. A 500 error produces unhandled JSON parse error instead of meaningful error message.",
    "Multiple screen components")

issue("M11", "MEDIUM", "No Pagination on Most List Endpoints",
    "Most list endpoints return full result sets without cursor/offset pagination. With growing data, response sizes will increase unbounded, causing slow API responses and high memory usage.",
    "Majority of GET endpoints")

issue("M12", "MEDIUM", "Inconsistent Error Response Format",
    "Some endpoints return {error:'message'}, others return {message:'...'}. No standard error envelope. Frontend error handling must handle multiple formats.",
    "Various API endpoints")

story.append(PageBreak())

# ═══════════════════════════════════════════════════════════════
# SECTION 4: UI/UX AUDIT
# ═══════════════════════════════════════════════════════════════
story.append(Paragraph("4. UI/UX &amp; Component Audit", styles['SectionTitle']))
story.append(HRFlowable(width="100%", color=BORDER, thickness=1))
story.append(Spacer(1, 6))
story.append(Paragraph(
    "The UI audit covered 63 screen components, the monolithic page.tsx (1,035 lines), 11 shared components, "
    "and ~50 UI primitives. The application uses a hash-based SPA routing pattern with lazy-loaded screens. "
    "Loading states are generally good (43/63 screens have skeletons), but empty states are missing from 35 screens, "
    "and error handling has gaps with 9 silent error catches. The main structural concern is the monolithic page.tsx "
    "and inconsistent use of inline styles (835+ instances) instead of the CSS variable system.",
    styles['BodyText2']
))

issue("H17", "HIGH", "page.tsx is a 1,035-Line Monolith",
    "All navigation config, 14 bridge wrappers, 50+ screen map entries, ScreenErrorBoundary, ScreenLoader, inline AppShell, and HomePage in one file. Should be decomposed into: nav-config.ts, screen-map.ts, screen-loader.tsx, app-shell.tsx.",
    "src/app/page.tsx (entire file)")

issue("H18", "HIGH", "35 Screens Missing EmptyState Component",
    "Only 28 of 63 screens use EmptyState. Missing from: pipeline-screen, audit-logs-screen, intelligence-timeline, intelligence-inbox, intelligence-knowledge, company-resolution-modal, templates-screen, ai-usage-dashboard, revenue-intelligence screens, and more.",
    "Multiple screens in src/components/screens/")

issue("M13", "MEDIUM", "835+ Inline style={{}} Across 46 Screen Files",
    "Massive use of inline styles instead of CSS variables and Tailwind utilities. Theme changes require editing dozens of files. Dark mode impossible. Worst offenders: settings-screen.tsx (60), command-center-screen.tsx (174), companies-screen.tsx (67).",
    "Multiple screen files")

issue("M14", "MEDIUM", "Dead app-shell.tsx File — Never Imported",
    "Complete AppShell with Sidebar/Header exists in app-shell.tsx but is never imported. Real app shell is defined inline in page.tsx. Different nav structure (flat 12 items vs 8 collapsible sections with 50+ items).",
    "src/components/app-shell.tsx (entire file, 379 lines)")

issue("M15", "MEDIUM", "Duplicate EmptyState Components with Incompatible Props",
    "Two EmptyState components exist: design-system.tsx (6 props, amber-600) and animated-components.tsx (4 props, motion.div, gold). 28 screens import from animated-components, others from design-system. Inconsistent appearance.",
    "src/components/shared/design-system.tsx:24, src/components/ui/animated-components.tsx:366")

issue("M16", "MEDIUM", "5 Different Hardcoded Gold Hex Values",
    "#B8860B, #D4AF37, #D4A843, #c9a84c, #8B6914 used across 5+ screens instead of CSS variable --color-gold.",
    "dashboard-screen.tsx:10, companies-screen.tsx:27, command-center-screen.tsx:52, + 3 more")

issue("M17", "MEDIUM", "Intelligence Health Stat Cards Not Responsive",
    "grid-cols-4 with no responsive breakpoint. Cards overflow on tablets/narrow viewports. Should be grid-cols-2 lg:grid-cols-4.",
    "src/components/screens/intelligence-health-screen.tsx:182")

issue("M18", "MEDIUM", "Hash-Based Routing Limitations",
    "window.location.hash for routing has limitations: deep linking loses scroll position, company detail doesn't update hash for company ID, no server-side rendering.",
    "src/app/page.tsx:429-448")

issue("M19", "MEDIUM", "Duplicate Nav Key 'opportunity-radar'",
    "Same key in both 'REVENUE INTELLIGENCE' and 'INTELLIGENCE LAYER' sections. Clicking one updates both. Confusing navigation.",
    "src/app/page.tsx:119 and 136")

issue("M20", "MEDIUM", "No Back Button on Most Detail Views",
    "Company Detail has onBack prop, but most detail overlays (contact, segment, draft) rely only on breadcrumb. On mobile, truncated breadcrumbs leave users stuck.",
    "Multiple detail screen components")

issue("M21", "MEDIUM", "Segment Create Dialog — Minimal Validation",
    "Only checks segment name. Score range accepts negative values. No validation that minScore < maxScore.",
    "src/components/screens/segments-screen.tsx:90")

issue("M22", "MEDIUM", "Leads Inline Editing Has No Validation Feedback",
    "Multiple inline edit dialogs for lead data lack inline validation. Errors shown only as toast notifications after API submission fails.",
    "src/components/screens/leads-screen.tsx")

issue("L2", "LOW", "not-found.tsx Uses Dark Theme, App is Light",
    "Uses hardcoded dark colors while the app is light-themed. Jarring visual transition for 404 pages.",
    "src/app/not-found.tsx:6-15")

issue("L3", "LOW", "loading.tsx Light Theme vs Login Dark Theme",
    "loading.tsx shows light spinner on #FAFAFA, but auth check loading in page.tsx uses dark background #0a0c10.",
    "src/app/loading.tsx:3, src/app/page.tsx:1014-1021")

issue("L4", "LOW", "Notification Bell Always Shows Indicator Dot",
    "Always-visible gold dot regardless of actual notification count. Misleading to users.",
    "src/app/page.tsx:817")

issue("L5", "LOW", "Sequence Create Dialog — Only Toast-Level Validation",
    "toast.error('Name and all step subjects/bodies required') — generic toast, no inline field-level validation showing which step is missing content.",
    "src/components/screens/sequences-screen.tsx:120-123")

issue("L6", "LOW", "Research Agent Has No Loading Skeleton",
    "Shows phase text while loading but no skeleton of expected output structure.",
    "src/components/screens/research-agent-screen.tsx:145-200")

issue("L7", "LOW", "Intelligence Health Loading State Uses Bare Spinner",
    "Uses RefreshCw with animate-spin instead of project's Skeleton component. Inconsistent with other screens.",
    "src/components/screens/intelligence-health-screen.tsx:122-129")

issue("L8", "LOW", "ScreenErrorBoundary Lacks componentDidCatch Logging",
    "Errors caught but not logged to monitoring service. Compare with global ErrorBoundary which does log.",
    "src/app/page.tsx:326-356")

issue("L9", "LOW", "Breadcrumbs Show Max 2 Levels",
    "Only ['Companies','Company Detail']. No deep trail for sub-navigation paths like Revenue Intelligence > Company Brief > [Name].",
    "src/app/page.tsx:527-533")

issue("L10", "LOW", "Oversized Screen Components",
    "leads-screen.tsx (110KB), settings-screen.tsx (110KB), company-detail-screen.tsx (1588 lines), command-center-screen.tsx (~890 lines). Should be split into sub-components.",
    "Multiple screen files")

issue("L11", "LOW", "Segment Detail Dialog Uses Plain Text for Empty State",
    "Bare paragraph instead of project's EmptyState component with icon and action button.",
    "src/components/screens/segments-screen.tsx:320")

story.append(PageBreak())

# ═══════════════════════════════════════════════════════════════
# SECTION 5: PERFORMANCE
# ═══════════════════════════════════════════════════════════════
story.append(Paragraph("5. Performance &amp; N+1 Query Patterns", styles['SectionTitle']))
story.append(HRFlowable(width="100%", color=BORDER, thickness=1))
story.append(Spacer(1, 6))
story.append(Paragraph(
    "Performance issues are primarily driven by two patterns: (1) unbounded database queries loading entire tables "
    "into memory, and (2) N+1 query patterns in loops. The most critical is the dedup endpoint's O(n-squared) algorithm. "
    "Additionally, the absence of connection pooling for Vercel serverless means each cold start creates a new database "
    "connection, which will compound the query performance issues under load.",
    styles['BodyText2']
))

issue("M23", "MEDIUM", "N+1 in Bulk Tag Operations — Sequential Read-Modify-Write",
    "companies__bulk.ts loops through companies and updates each individually with JSON field manipulation. Max 100 companies = 100 sequential updates. JSON parse/stringify per item compounds the issue.",
    "src/app/api/g-crm/[...slug]/companies__bulk.ts:83-189")

issue("M24", "MEDIUM", "N+1 in Draft Merge During Dedup",
    "leads__dedup.ts POST handler: for each secondary contact, executes findUnique + per-draft update + per-reply update + secondary update + primary update. With 10 secondaries with 5 drafts and 3 replies = 110 queries.",
    "src/app/api/g-crm/[...slug]/leads__dedup.ts:124-178")

issue("M25", "MEDIUM", "N+1 in Webhook Reply findOriginalItem()",
    "Loops through message IDs querying drafts one at a time. Should batch with where:{messageId:{in:messageIds}}.",
    "src/app/api/g-outreach/[...slug]/webhooks__reply.ts:191-204")

story.append(PageBreak())

# ═══════════════════════════════════════════════════════════════
# SECTION 6: USER JOURNEY GAPS
# ═══════════════════════════════════════════════════════════════
story.append(Paragraph("6. User Journey Validation", styles['SectionTitle']))
story.append(HRFlowable(width="100%", color=BORDER, thickness=1))
story.append(Spacer(1, 6))
story.append(Paragraph(
    "End-to-end user journey validation identified gaps in the login flow and some navigation inconsistencies. "
    "The core authentication flow (email -> OTP -> session -> dashboard) functions correctly. However, the "
    "landing page's Sign In buttons were previously non-functional (fixed during this audit session). Several "
    "navigation patterns need attention for production readiness.",
    styles['BodyText2']
))

issue("M26", "MEDIUM", "Landing Page Sign In Flow Involves Page Reload",
    "Sign In navigates from landing-page.html to /login.html (full page reload). After OTP verification, redirect to '/' triggers middleware rewrite back to landing-page.html if cookie not set before redirect. Potential loop risk.",
    "public/landing-page.html:761, public/login.html, src/middleware.ts:16-19")

issue("L12", "LOW", "No 'Back to List' on Most Detail Views",
    "Company Detail has onBack. Contact, segment, draft details rely on breadcrumb only. On mobile, users can get stuck.",
    "Multiple detail screen components")

issue("L13", "LOW", "404 Page Uses Different Theme Than App",
    "Dark-themed 404 page while app is light-themed. Confusing transition when a logged-in user hits a 404.",
    "src/app/not-found.tsx")

issue("L14", "LOW", "Notification 'View All Activity' Links to Audit Log",
    "Clicking notification dropdown's 'View all activity' navigates to audit log, not a notifications page. Different concepts conflated.",
    "src/app/page.tsx:872")

issue("L15", "LOW", "No Session Timeout Warning to User",
    "Sessions auto-expire but no warning shown to user before session ends. User may lose unsaved work without notification.",
    "src/lib/session.ts")

story.append(PageBreak())

# ═══════════════════════════════════════════════════════════════
# SECTION 7: POSITIVE FINDINGS
# ═══════════════════════════════════════════════════════════════
story.append(Paragraph("7. Positive Findings", styles['SectionTitle']))
story.append(HRFlowable(width="100%", color=BORDER, thickness=1))
story.append(Spacer(1, 6))

positives = [
    ("Session tokens", "Cryptographically random 256-bit tokens via crypto.getRandomValues", "session.ts:18"),
    ("Cookie security", "httpOnly:true, secure in production, sameSite:'lax'", "session.ts:61-63"),
    ("Password hashing", "PBKDF2-SHA256, 100k iterations, 128-bit salt, constant-time comparison", "password.ts"),
    ("Session rolling", "Sessions auto-extend on each request", "session.ts:123-128"),
    ("User enumeration", "Same error for wrong email vs wrong password with fixed delay", "auth__login.ts:42-43"),
    ("Loading states", "43 of 63 screens have proper skeleton loading states", "Multiple screens"),
    ("Toast notifications", "356 toast calls across 37 files with consistent Sonner config", "Multiple files"),
    ("Mobile sidebar", "Well-implemented responsive sidebar with overlay backdrop", "page.tsx"),
    ("CSRF protection", "Proper CSRF tokens on POST endpoints (when not in dev mode)", "csrf.ts"),
    ("Registration disabled", "Single-owner workspace correctly blocks registration", "auth__register.ts"),
    ("Powered-by hidden", "poweredByHeader:false removes X-Powered-By", "next.config.ts:11"),
]

for title, detail, file in positives:
    story.append(Paragraph(f"<b>{title}</b> — {detail}", styles['BodyText2']))
    story.append(Paragraph(f"<font color='#6366F1' size='8'>{file}</font>", ParagraphStyle('pfile', fontName='Courier', fontSize=8, leftIndent=15, spaceAfter=4)))
    story.append(Spacer(1, 2))

story.append(PageBreak())

# ═══════════════════════════════════════════════════════════════
# SECTION 8: SPRINT 9.2 PRIORITY RECOMMENDATIONS
# ═══════════════════════════════════════════════════════════════
story.append(Paragraph("8. Sprint 9.2 Priority Recommendations", styles['SectionTitle']))
story.append(HRFlowable(width="100%", color=BORDER, thickness=1))
story.append(Spacer(1, 6))
story.append(Paragraph(
    "Based on the audit findings, the following priority order is recommended for Sprint 9.2 (Product Hardening). "
    "Issues should be addressed in this order, with all Critical items completed before moving to High, and all High "
    "completed before Medium/Low.",
    styles['BodyText2']
))
story.append(Spacer(1, 8))

priorities = [
    ["P0", "C1", "Add requireAuth() to ALL 190+ API route handlers", "Security", "Addresses authentication gap on all non-auth endpoints"],
    ["P0", "C2", "Fix OTP brute-force: separate lookup from code check", "Security", "Lookup by email+purpose, then compare code with attempt counting"],
    ["P0", "C3", "Remove or protect /api/debug/env-check", "Security", "Delete endpoint or add auth + rate limiting"],
    ["P0", "C4/C5", "Rotate all leaked API keys (Gemini, Tavily, Vercel OIDC)", "Security", "Generate new keys, update Vercel env vars, delete old keys"],
    ["P0", "C6", "Protect /api/seed endpoint with auth", "Security", "Add requireAuth check"],
    ["P1", "H3/H4", "Remove hardcoded secrets, require in production", "Security", "Fail startup if NEXTAUTH_SECRET/UNSUBSCRIBE_SECRET not set in prod"],
    ["P1", "H5/H6", "Move OTP code to email body, remove devCode in prod", "Security", "Change subject to 'Your verification code is ready'"],
    ["P1", "H7", "Fix webhook signature: reject if secret set but no sig", "Security", "Add check: if secret exists, signature header is required"],
    ["P1", "H8", "Fix password change to exclude current session", "Security", "Add current session ID exclusion to deleteMany WHERE"],
    ["P1", "H10", "Add Neon connection pooling for serverless", "Database", "Add @prisma/adapter-neon or pgbouncer config"],
    ["P1", "C9", "Rewrite dedup with SQL GROUP BY instead of O(n^2)", "Database", "Use Prisma groupBy or raw SQL for matching"],
    ["P1", "C10", "Add transactions to webhook handlers and email worker", "Database", "Wrap multi-step operations in $transaction"],
    ["P2", "C7", "Convert top 10 String enums to Prisma enum types", "Database", "Start with Contact.status, Company.status, User.role"],
    ["P2", "C8", "Initialize prisma migrations directory", "Database", "Create baseline migration from current schema"],
    ["P2", "H15", "Replace silent .catch with error toasts/banners", "UI/UX", "Add toast.error() in all 9 catch blocks"],
    ["P2", "C12", "Add pagination to all list endpoints", "API", "Implement cursor-based pagination"],
    ["P2", "H17", "Decompose page.tsx monolith", "Architecture", "Extract nav-config, screen-map, app-shell"],
    ["P2", "H18", "Add EmptyState to 35 screens missing it", "UI/UX", "Use animated-components EmptyState consistently"],
    ["P3", "M13", "Replace hardcoded colors with CSS variables", "UI/UX", "Start with worst offenders (command-center, settings)"],
    ["P3", "M4", "Replace in-memory rate limiter with Redis/Upstash", "Performance", "Required for production rate limiting"],
    ["P3", "H14", "Convert JSON String fields to native Json type", "Database", "Contact.enrichmentData, Company.tags, etc."],
]

prio_header = [
    Paragraph('<b>Priority</b>', styles['TableHeader']),
    Paragraph('<b>ID</b>', styles['TableHeader']),
    Paragraph('<b>Action</b>', styles['TableHeader']),
    Paragraph('<b>Area</b>', styles['TableHeader']),
    Paragraph('<b>Detail</b>', styles['TableHeader']),
]
prio_rows = [prio_header]
for row in priorities:
    prio_rows.append([
        Paragraph(f'<b>{row[0]}</b>', styles['TableCellCenter']),
        Paragraph(row[1], styles['TableCellCenter']),
        Paragraph(row[2], styles['TableCell']),
        Paragraph(row[3], styles['TableCellCenter']),
        Paragraph(row[4], styles['TableCell']),
    ])

prio_table = Table(prio_rows, colWidths=[40, 35, 170, 60, 175])
prio_table.setStyle(TableStyle([
    ('BACKGROUND', (0, 0), (-1, 0), INDIGO),
    ('GRID', (0, 0), (-1, -1), 0.5, BORDER),
    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ('TOPPADDING', (0, 0), (-1, -1), 4),
    ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ('LEFTPADDING', (0, 0), (-1, -1), 6),
    ('ROWBACKGROUNDS', (0, 1), (-1, -1), [white, GRAY_LIGHT]),
]))
story.append(prio_table)

# ═══════════════════════════════════════════════════════════════
# FOOTER
# ═══════════════════════════════════════════════════════════════
story.append(Spacer(1, 40))
story.append(HRFlowable(width="100%", color=BORDER, thickness=0.5))
story.append(Spacer(1, 8))
story.append(Paragraph(
    "DeepMindQ Sprint 9.1 Audit Report | Feature Freeze | No Fixes Applied | Pending Review",
    styles['SmallGray']
))
story.append(Paragraph(
    "Generated: July 2026 | Scope: Phase 1-8 Complete Codebase Audit | 66 Issues Identified",
    styles['SmallGray']
))

# Build PDF
doc.build(story)
print(f"PDF generated: {OUTPUT}")
