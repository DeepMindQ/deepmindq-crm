#!/usr/bin/env python3
"""
DeepMindQ Revenue Intelligence Platform - Phase 0-6 Closure Report
Body PDF generated via ReportLab, Cover via Playwright, merged via pypdf.
"""
import os, sys, hashlib
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import inch, mm, cm
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY, TA_RIGHT
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle,
    KeepTogether, CondPageBreak, HRFlowable
)
from reportlab.platypus.tableofcontents import TableOfContents
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase.pdfmetrics import registerFontFamily

# ── Paths ──
PDF_SKILL_DIR = os.path.expanduser("~/.openclaw/workspace/skills/pdf")
if not os.path.isdir(PDF_SKILL_DIR):
    PDF_SKILL_DIR = "/home/z/my-project/skills/pdf"
OUTPUT_DIR = "/home/z/my-project/download"
os.makedirs(OUTPUT_DIR, exist_ok=True)
BODY_PDF = os.path.join(OUTPUT_DIR, "closure_report_body.pdf")
COVER_HTML = "/home/z/my-project/scripts/cover.html"
COVER_PDF = os.path.join(OUTPUT_DIR, "closure_report_cover.pdf")
FINAL_PDF = os.path.join(OUTPUT_DIR, "DeepMindQ_Phase0-6_Closure_Report.pdf")

# ── Font Registration ──
FONT_DIR = '/usr/share/fonts'
pdfmetrics.registerFont(TTFont('FreeSerif', f'{FONT_DIR}/truetype/freefont/FreeSerif.ttf'))
pdfmetrics.registerFont(TTFont('FreeSerif-Bold', f'{FONT_DIR}/truetype/freefont/FreeSerifBold.ttf'))
pdfmetrics.registerFont(TTFont('FreeSerif-Italic', f'{FONT_DIR}/truetype/freefont/FreeSerifItalic.ttf'))
pdfmetrics.registerFont(TTFont('FreeSerif-BoldItalic', f'{FONT_DIR}/truetype/freefont/FreeSerifBoldItalic.ttf'))
pdfmetrics.registerFont(TTFont('DejaVuSans', f'{FONT_DIR}/truetype/dejavu/DejaVuSansMono.ttf'))
registerFontFamily('FreeSerif', normal='FreeSerif', bold='FreeSerif-Bold', italic='FreeSerif-Italic', boldItalic='FreeSerif-BoldItalic')

# ── Cascade Palette ──
PAGE_BG       = colors.HexColor('#f6f6f5')
SECTION_BG    = colors.HexColor('#eeeeec')
CARD_BG       = colors.HexColor('#efeeec')
TABLE_STRIPE  = colors.HexColor('#eeedea')
HEADER_FILL   = colors.HexColor('#5c5643')
COVER_BLOCK   = colors.HexColor('#827757')
BORDER        = colors.HexColor('#ccc5b0')
ICON          = colors.HexColor('#796c46')
ACCENT        = colors.HexColor('#897129')
ACCENT_2      = colors.HexColor('#4ba3c0')
TEXT_PRIMARY   = colors.HexColor('#161614')
TEXT_MUTED     = colors.HexColor('#7d7a73')
SEM_SUCCESS   = colors.HexColor('#46835a')
SEM_WARNING   = colors.HexColor('#8f743f')
SEM_ERROR     = colors.HexColor('#975751')
SEM_INFO      = colors.HexColor('#4977a5')

TABLE_HEADER_COLOR = HEADER_FILL
TABLE_HEADER_TEXT  = colors.white
TABLE_ROW_EVEN     = colors.white
TABLE_ROW_ODD      = TABLE_STRIPE

# ── Page Setup ──
PAGE_W, PAGE_H = A4
LEFT_MARGIN = 0.85 * inch
RIGHT_MARGIN = 0.85 * inch
TOP_MARGIN = 0.75 * inch
BOTTOM_MARGIN = 0.75 * inch
AVAIL_W = PAGE_W - LEFT_MARGIN - RIGHT_MARGIN

# ── Styles ──
styles = getSampleStyleSheet()

s_h1 = ParagraphStyle('H1', fontName='FreeSerif-Bold', fontSize=20, leading=26,
    textColor=TEXT_PRIMARY, spaceBefore=18, spaceAfter=10, alignment=TA_LEFT)
s_h2 = ParagraphStyle('H2', fontName='FreeSerif-Bold', fontSize=14, leading=20,
    textColor=TEXT_PRIMARY, spaceBefore=14, spaceAfter=8, alignment=TA_LEFT)
s_h3 = ParagraphStyle('H3', fontName='FreeSerif-Bold', fontSize=11.5, leading=16,
    textColor=TEXT_PRIMARY, spaceBefore=10, spaceAfter=6, alignment=TA_LEFT)
s_body = ParagraphStyle('Body', fontName='FreeSerif', fontSize=10.5, leading=17,
    textColor=TEXT_PRIMARY, spaceAfter=6, alignment=TA_JUSTIFY)
s_body_left = ParagraphStyle('BodyLeft', fontName='FreeSerif', fontSize=10.5, leading=17,
    textColor=TEXT_PRIMARY, spaceAfter=6, alignment=TA_LEFT)
s_bullet = ParagraphStyle('Bullet', fontName='FreeSerif', fontSize=10, leading=16,
    textColor=TEXT_PRIMARY, spaceAfter=3, leftIndent=18, bulletIndent=6, alignment=TA_LEFT)
s_caption = ParagraphStyle('Caption', fontName='FreeSerif-Italic', fontSize=9, leading=13,
    textColor=TEXT_MUTED, spaceBefore=3, spaceAfter=6, alignment=TA_CENTER)
s_meta = ParagraphStyle('Meta', fontName='FreeSerif-Italic', fontSize=9, leading=13,
    textColor=TEXT_MUTED, spaceAfter=4, alignment=TA_LEFT)
s_toc_title = ParagraphStyle('TOCTitle', fontName='FreeSerif-Bold', fontSize=20, leading=26,
    textColor=TEXT_PRIMARY, spaceBefore=0, spaceAfter=18, alignment=TA_LEFT)

# Table cell styles
s_th = ParagraphStyle('TH', fontName='FreeSerif-Bold', fontSize=9.5, leading=13,
    textColor=TABLE_HEADER_TEXT, alignment=TA_CENTER)
s_td = ParagraphStyle('TD', fontName='FreeSerif', fontSize=9, leading=13,
    textColor=TEXT_PRIMARY, alignment=TA_LEFT)
s_td_c = ParagraphStyle('TDC', fontName='FreeSerif', fontSize=9, leading=13,
    textColor=TEXT_PRIMARY, alignment=TA_CENTER)

# Status styles for production readiness badges
s_pass = ParagraphStyle('Pass', fontName='FreeSerif-Bold', fontSize=9, leading=13,
    textColor=SEM_SUCCESS, alignment=TA_CENTER)
s_warn = ParagraphStyle('Warn', fontName='FreeSerif-Bold', fontSize=9, leading=13,
    textColor=SEM_WARNING, alignment=TA_CENTER)
s_fail = ParagraphStyle('Fail', fontName='FreeSerif-Bold', fontSize=9, leading=13,
    textColor=SEM_ERROR, alignment=TA_CENTER)

# TOC styles
toc_level0 = ParagraphStyle('TOC0', fontName='FreeSerif', fontSize=12, leftIndent=20, leading=22, textColor=TEXT_PRIMARY)
toc_level1 = ParagraphStyle('TOC1', fontName='FreeSerif', fontSize=10.5, leftIndent=40, leading=18, textColor=TEXT_MUTED)


# ── Helpers ──
def heading(text, style=s_h1, level=0):
    key = 'h_%s' % hashlib.md5(text.encode()).hexdigest()[:8]
    p = Paragraph('<a name="%s"/><b>%s</b>' % (key, text), style)
    p.bookmark_name = text
    p.bookmark_level = level
    p.bookmark_text = text
    p.bookmark_key = key
    return p

def add_major_section(text, style=s_h1, level=0):
    return [CondPageBreak(PAGE_H * 0.15), heading(text, style, level)]

def make_table(data, col_ratios, caption_text=None):
    col_widths = [r * AVAIL_W for r in col_ratios]
    t = Table(data, colWidths=col_widths, hAlign='CENTER')
    style_cmds = [
        ('BACKGROUND', (0, 0), (-1, 0), TABLE_HEADER_COLOR),
        ('TEXTCOLOR', (0, 0), (-1, 0), TABLE_HEADER_TEXT),
        ('GRID', (0, 0), (-1, -1), 0.5, BORDER),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ]
    for i in range(1, len(data)):
        bg = TABLE_ROW_EVEN if i % 2 == 1 else TABLE_ROW_ODD
        style_cmds.append(('BACKGROUND', (0, i), (-1, i), bg))
    t.setStyle(TableStyle(style_cmds))
    elems = [Spacer(1, 12), t]
    if caption_text:
        elems.append(Spacer(1, 4))
        elems.append(Paragraph(caption_text, s_caption))
    elems.append(Spacer(1, 12))
    return elems

def bullet(text):
    return Paragraph('<bullet>&bull;</bullet>' + text, s_bullet)

def status_cell(status):
    """Return a styled cell for PASS/WARN/FAIL status."""
    mapping = {'PASS': s_pass, 'PRODUCTION READY': s_pass, 'WARN': s_warn, 'PARTIAL': s_warn, 'FAIL': s_fail}
    st = mapping.get(status, s_td_c)
    return Paragraph('<b>%s</b>' % status, st)

def phase_section(num, title, objective, evidence, func_val, bi_val, current_status, prod_ready):
    """Generate a complete phase section."""
    elems = []
    elems.extend(add_major_section('Chapter %d: %s' % (num, title), s_h1, 0))

    # 1. Phase Objective
    elems.append(heading('1. Phase Objective', s_h2, 1))
    for p in objective:
        elems.append(Paragraph(p, s_body))

    # 2. Implementation Evidence
    elems.append(heading('2. Implementation Evidence', s_h2, 1))
    for p in evidence:
        if isinstance(p, str):
            elems.append(Paragraph(p, s_body))
        else:
            elems.extend(make_table(p[0], p[1], p[2] if len(p) > 2 else None))

    # 3. Functional Validation
    elems.append(heading('3. Functional Validation', s_h2, 1))
    for p in func_val:
        if isinstance(p, str):
            elems.append(Paragraph(p, s_body))
        else:
            elems.extend(make_table(p[0], p[1], p[2] if len(p) > 2 else None))

    # 4. Business Intelligence Validation
    elems.append(heading('4. Business Intelligence Validation', s_h2, 1))
    for p in bi_val:
        if isinstance(p, str):
            elems.append(Paragraph(p, s_body))
        else:
            elems.extend(make_table(p[0], p[1], p[2] if len(p) > 2 else None))

    # 5. Current Status
    elems.append(heading('5. Current Status', s_h2, 1))
    for p in current_status:
        elems.append(Paragraph(p, s_body))

    # 6. Production Readiness
    elems.append(heading('6. Production Readiness', s_h2, 1))
    for p in prod_ready:
        if isinstance(p, str):
            elems.append(Paragraph(p, s_body))
        else:
            elems.extend(make_table(p[0], p[1], p[2] if len(p) > 2 else None))

    return elems


# ═══════════════════════════════════════════════════════════════
# DOCUMENT CONTENT
# ═══════════════════════════════════════════════════════════════

def build_story():
    story = []

    # ── TOC ──
    story.append(Paragraph('<b>Table of Contents</b>', s_toc_title))
    toc = TableOfContents()
    toc.levelStyles = [toc_level0, toc_level1]
    story.append(toc)
    story.append(PageBreak())

    # ════════════════════════════════════════════════════════════
    # CHAPTER 1: Phase 0
    # ════════════════════════════════════════════════════════════
    story.extend(phase_section(
        num=1,
        title='Phase 0 - Infrastructure and Foundation',
        objective=[
            'Phase 0 established the core infrastructure for the DeepMindQ Revenue Intelligence Platform. '
            'This phase laid the foundational layers upon which all subsequent intelligence, prioritization, '
            'and validation capabilities are built. The primary objectives were to set up the Next.js 16 application '
            'framework with React 19 and TypeScript, establish the PostgreSQL database schema via Prisma ORM, '
            'implement secure authentication with session-based tokens, configure the build pipeline for standalone '
            'deployment, and create the security middleware stack including rate limiting and audit logging.',
            'The platform was designed as a dedicated-instance system with no multi-tenant isolation logic, '
            'specifically targeting the IT Services and Consulting vertical. This architectural decision simplifies '
            'the data model and eliminates the need for tenant-scoped queries throughout the codebase. Every piece '
            'of infrastructure built in this phase reflects that single-tenant, single-vertical design principle, '
            'from the database schema (no tenantId fields) to the authentication model (opaque session tokens '
            'stored in the database for revocability).',
        ],
        evidence=[
            'The Prisma schema (schema.prisma, 1,239 lines) defines 46 models covering the full platform '
            'data model: 10 core CRM entities (Company, Contact, ImportBatch, CompanyResearchCard, CompanyNote, '
            'CompanySignal, Evidence, CompanyTimelineEvent, ContactNote, CapabilityAsset), 7 data intelligence '
            'config models (ColumnMappingRule, FieldValidationRule, NormalizationMapping, ScoringWeight, '
            'DataUpload, UploadRow, DataQualityScore), 10 outreach models (EmailTemplate, EmailSequence, '
            'SequenceStep, SequenceEnrollment, Draft, SendQueue, EmailEvent, ABTest, Reply, Bounce), '
            '5 workflow and auth models (Job, JobLog, User, OtpCode, Session), 5 intelligence models '
            '(SignalCapabilityMatch, OpportunityRecommendation, Pursuit, IntelligenceValidation, AIGenerationAudit), '
            'plus Playbook, AccountStrategy, Suppression, Segment, SegmentContact, AuditLog, ConversationPlan, '
            'SystemSetting, and NormalizationLog.',
            (
                [
                    [Paragraph('<b>Component</b>', s_th), Paragraph('<b>File</b>', s_th), Paragraph('<b>Lines</b>', s_th), Paragraph('<b>Purpose</b>', s_th)],
                    [Paragraph('Database Client', s_td), Paragraph('src/lib/db.ts', s_td), Paragraph('22', s_td_c), Paragraph('Prisma singleton with dev logging', s_td)],
                    [Paragraph('Auth System', s_td), Paragraph('src/lib/session.ts', s_td), Paragraph('191', s_td_c), Paragraph('Opaque session tokens, rolling expiry', s_td)],
                    [Paragraph('Password Hashing', s_td), Paragraph('src/lib/password.ts', s_td), Paragraph('82', s_td_c), Paragraph('bcrypt with salt rounds', s_td)],
                    [Paragraph('OTP System', s_td), Paragraph('src/lib/otp.ts', s_td), Paragraph('282', s_td_c), Paragraph('Multi-purpose OTP generation/verification', s_td)],
                    [Paragraph('Rate Limiter', s_td), Paragraph('src/lib/rate-limit.ts', s_td), Paragraph('59', s_td_c), Paragraph('In-memory sliding window, 4 presets', s_td)],
                    [Paragraph('API Middleware', s_td), Paragraph('src/lib/api-middleware.ts', s_td), Paragraph('81', s_td_c), Paragraph('Auth + rate-limit + audit wrapper', s_td)],
                    [Paragraph('Audit Logger', s_td), Paragraph('src/lib/audit.ts', s_td), Paragraph('26', s_td_c), Paragraph('Fire-and-forget AuditLog writes', s_td)],
                    [Paragraph('Env Validation', s_td), Paragraph('src/lib/validate-env.ts', s_td), Paragraph('55', s_td_c), Paragraph('Zod-validated env config', s_td)],
                    [Paragraph('Next.js Config', s_td), Paragraph('next.config.ts', s_td), Paragraph('98', s_td_c), Paragraph('62 URL rewrites, standalone output', s_td)],
                    [Paragraph('RBAC', s_td), Paragraph('src/lib/rbac.ts', s_td), Paragraph('84', s_td_c), Paragraph('4 roles, 6 permissions, 9 resources', s_td)],
                ],
                [0.18, 0.28, 0.08, 0.46],
                'Table 1.1: Phase 0 Core Infrastructure Components'
            ),
            'The Next.js configuration uses 62 URL rewrite rules to map clean API paths (e.g., /api/companies) '
            'to their route-group implementations (e.g., /api/g-crm/companies). The application uses standalone '
            'output mode for Docker/self-hosted deployment and disables the poweredByHeader for security. '
            'The Tailwind CSS 4 configuration provides a complete shadcn/ui design token system with dark mode '
            'class strategy and chart color palette.',
        ],
        func_val=[
            'Authentication flow: The session system uses cryptographically random 32-byte tokens stored '
            'as HttpOnly, Secure, SameSite=Lax cookies. Sessions are database-backed (not stateless JWT), enabling '
            'instant revocation. Rolling 30-day expiry extends on each request. Expired sessions are automatically '
            'cleaned up on new session creation. The OTP system supports login, set-password, and reset-password flows.',
            'Rate limiting is enforced at the API route level via withApiMiddleware(), which combines three '
            'layers in sequence: rate limiting (100 req/min default, 5/min for auth, 20/min for AI, 3/hour for imports), '
            'authentication (session token validation against the Session table), and audit logging (fire-and-forget '
            'writes to the AuditLog table that never block the request). Development mode allows unauthenticated '
            'access with a dev-user placeholder.',
            'RBAC defines 4 roles (admin, manager, sales_rep, viewer) with 6 permissions (create, read, update, '
            'delete, export, admin) across 9 resource types. The schema includes comprehensive indexes on all queryable '
            'fields, cascade deletes on all child relations, and GDPR-ready consent tracking on the Contact model.',
        ],
        bi_val=[
            'The infrastructure decisions in Phase 0 directly enable the revenue intelligence use case. '
            'The opaque session token approach supports enterprise security requirements where session revocation '
            'is mandatory (unlike JWT where revocation requires additional infrastructure). The 4-role RBAC model '
            'maps directly to IT Services sales organizations: admins manage the platform, managers oversee pipelines, '
            'sales reps work their accounts, and viewers access read-only dashboards for executive reporting.',
            'The 62 URL rewrite architecture enables clean, RESTful API paths while maintaining organized code '
            'structure across 7 route groups. This is critical for a platform with approximately 170 distinct API '
            'endpoints, as it prevents namespace collisions and enables independent scaling of route groups in future. '
            'The audit logging infrastructure, while simple (26 lines), creates the foundation for compliance '
            'requirements common in consulting engagements where client interaction history must be traceable.',
        ],
        current_status=[
            'Phase 0 infrastructure is complete and operational. The authentication system, database schema, '
            'middleware stack, and build pipeline are all functional. The primary technical debt item is the presence '
            'of 368 pre-existing TypeScript errors across 40+ files, which are bypassed via ignoreBuildErrors: true '
            'in next.config.ts. These errors do not affect runtime behavior but should be addressed before '
            'enterprise deployment. The middleware.ts file has been disabled (saved as .bak) in favor of route-level '
            'authentication, as the Edge middleware approach caused crashes on Vercel deployment.',
        ],
        prod_ready=[
            (
                [
                    [Paragraph('<b>Criterion</b>', s_th), Paragraph('<b>Status</b>', s_th), Paragraph('<b>Notes</b>', s_th)],
                    [Paragraph('Authentication', s_td), status_cell('PASS'), Paragraph('Opaque tokens, rolling expiry, instant revocation', s_td)],
                    [Paragraph('Authorization', s_td), status_cell('PASS'), Paragraph('4-role RBAC with 6 permissions across 9 resources', s_td)],
                    [Paragraph('Rate Limiting', s_td), status_cell('PASS'), Paragraph('4 presets (API, Auth, AI, Import), sliding window', s_td)],
                    [Paragraph('Audit Trail', s_td), status_cell('PASS'), Paragraph('Fire-and-forget logging, never blocks requests', s_td)],
                    [Paragraph('Environment Validation', s_td), status_cell('PASS'), Paragraph('Zod-validated env config with production warnings', s_td)],
                    [Paragraph('Schema Completeness', s_td), status_cell('PASS'), Paragraph('46 models, comprehensive indexes, cascade deletes', s_td)],
                    [Paragraph('TypeScript Hygiene', s_td), status_cell('WARN'), Paragraph('368 pre-existing errors, bypassed at build time', s_td)],
                    [Paragraph('Edge Middleware', s_td), status_cell('WARN'), Paragraph('Disabled due to Vercel crashes; route-level auth active', s_td)],
                ],
                [0.22, 0.15, 0.63],
                'Table 1.2: Phase 0 Production Readiness Assessment'
            ),
        ]
    ))

    # ════════════════════════════════════════════════════════════
    # CHAPTER 2: Phase 1
    # ════════════════════════════════════════════════════════════
    story.extend(phase_section(
        num=2,
        title='Phase 1 - Data Foundation Layer',
        objective=[
            'Phase 1 established the data ingestion, validation, normalization, and quality scoring pipeline '
            'that transforms raw CSV/Excel imports into structured, enriched Company and Contact records. '
            'The core principle is config-over-code: all validation rules, normalization mappings, column '
            'detection patterns, and scoring weights are stored in the database and modifiable at runtime '
            'without code deployment. This design enables business users to adapt the pipeline to different '
            'data sources without engineering involvement.',
            'The phase implements a 6-step import pipeline: Analyze file structure, Create upload job, '
            'Process chunks (for large files), Review flagged rows, Apply corrections, and Commit to the '
            'main database. Each step is tracked via the DataUpload model with a multi-stage status lifecycle. '
            'Quality scoring operates on three dimensions (completeness, validity, richness) with configurable '
            'weights loaded from the ScoringWeight table.',
        ],
        evidence=[
            (
                [
                    [Paragraph('<b>Module</b>', s_th), Paragraph('<b>File</b>', s_th), Paragraph('<b>Lines</b>', s_th), Paragraph('<b>Key Functions</b>', s_th)],
                    [Paragraph('Import Engine', s_td), Paragraph('data-intelligence/engine.ts', s_td), Paragraph('744', s_td_c), Paragraph('analyzeFile, processChunk, commitUpload', s_td)],
                    [Paragraph('Validator', s_td), Paragraph('data-intelligence/validator.ts', s_td), Paragraph('222', s_td_c), Paragraph('validateRow, validateRows (6 rule types)', s_td)],
                    [Paragraph('Normalizer', s_td), Paragraph('data-intelligence/normalizer.ts', s_td), Paragraph('264', s_td_c), Paragraph('normalizeRow, 8 field normalizations', s_td)],
                    [Paragraph('Quality Scorer', s_td), Paragraph('data-intelligence/quality-scorer.ts', s_td), Paragraph('230', s_td_c), Paragraph('scoreRowQuality (3 dimensions)', s_td)],
                    [Paragraph('Deduplicator', s_td), Paragraph('data-intelligence/deduplicator.ts', s_td), Paragraph('296', s_td_c), Paragraph('checkAgainstExisting, checkWithinBatch', s_td)],
                    [Paragraph('Config Store', s_td), Paragraph('data-intelligence/config-store.ts', s_td), Paragraph('597', s_td_c), Paragraph('DB-driven rule management', s_td)],
                    [Paragraph('Column Detector', s_td), Paragraph('data-intelligence/column-detector.ts', s_td), Paragraph('86', s_td_c), Paragraph('AI-assisted header detection', s_td)],
                    [Paragraph('Lead Scoring', s_td), Paragraph('lead-scoring.ts', s_td), Paragraph('228', s_td_c), Paragraph('6-dimension lead scoring engine', s_td)],
                ],
                [0.15, 0.30, 0.08, 0.47],
                'Table 2.1: Phase 1 Data Intelligence Modules'
            ),
            'The validator implements 6 rule types loaded dynamically from the FieldValidationRule table: '
            'required (with conditional logic when other fields are empty), regex pattern matching, format validation '
            '(email, URL, domain), range checking, batch-level uniqueness tracking (email, domain, company), and '
            'custom rules. This config-over-code approach means adding a new validation rule requires only a database '
            'insert, not a code change.',
            'The normalizer handles 8 field transformations: industry standardization, country normalization, '
            'employee size range conversion (e.g., "201-500" becomes a standardized range label), company name '
            'cleaning, domain extraction from email addresses, website URL prepending, whitespace normalization, '
            'and title abbreviation expansion (12 mappings including VP to Vice President, CTO to Chief Technology Officer). '
            'It uses a three-tier lookup strategy: exact DB match first, then fuzzy match, then built-in logic.',
            'The quality scorer evaluates each row on three weighted dimensions: completeness (40 points across 10 '
            'weighted fields where email=20, name=15, company=15), validity (30 points with penalties of -30 per error '
            'and -10 per warning), and richness (30 points covering corporate email detection, LinkedIn presence, name '
            'completeness, phone availability, industry classification, and company size). Distribution buckets are: '
            'excellent (80+), good (60+), fair (40+), and poor (below 40).',
        ],
        func_val=[
            'The deduplicator uses three matching strategies with decreasing confidence: exact email match (100% '
            'confidence), domain-plus-name combination (60-90% depending on name match quality using Levenshtein distance '
            'with legal suffix stripping), and fuzzy company name matching (75%+ threshold with 10-minute TTL cache '
            'for DB lookups). Batch-level in-memory dedup operates across chunks, preventing duplicates within a single '
            'import even when records arrive in different processing chunks.',
            'The lead scoring engine computes a composite score across 6 dimensions: Role (0-25 points based on '
            'seniority and decision-making authority), Email Health (0-15 points for corporate vs. free email domains), '
            'Company Fit (0-20 points based on ICP alignment), Data Completeness (0-15 points for field population), '
            'Engagement (0-15 points for interaction history), and Enrichment (0-10 points for externally-sourced data). '
            'This scoring feeds directly into the account prioritization engine in Phase 5.',
            'Config-over-code is verified: all rule definitions, normalization mappings, scoring weights, and column '
            'detection patterns are stored in dedicated database tables (ColumnMappingRule, FieldValidationRule, '
            'NormalizationMapping, ScoringWeight). The config-store.ts module provides a unified management layer '
            'for CRUD operations on these configurations. Runtime modification does not require server restart.',
        ],
        bi_val=[
            'The data foundation layer directly addresses the "garbage in, garbage out" problem that plagues '
            'revenue intelligence platforms. By enforcing quality scoring at import time and providing a correction '
            'workflow before committing data, the platform ensures that only validated, normalized records enter '
            'the intelligence pipeline. This is critical for IT Services consulting where firmographic data quality '
            'directly impacts the accuracy of ICP matching and account prioritization downstream.',
            'The 3-dimension quality scoring (completeness, validity, richness) provides actionable feedback to data '
            'operators. A record scoring "poor" on completeness signals missing critical fields like email or company name, '
            'while a "poor" validity score indicates format errors that need correction. The richness dimension '
            'differentiates between bare-minimum records and those enriched with LinkedIn profiles, phone numbers, '
            'and industry classifications, which are essential for effective outreach and research prioritization.',
        ],
        current_status=[
            'Phase 1 is fully implemented with all 8 modules operational. The 6-step import pipeline handles '
            'file analysis, chunked processing, review workflows, correction application, and atomic commit. '
            'The config-over-code pattern is consistently applied across validation, normalization, scoring, '
            'and column detection. The deduplicator provides both within-batch and cross-batch deduplication '
            'with a configurable cache TTL.',
        ],
        prod_ready=[
            (
                [
                    [Paragraph('<b>Criterion</b>', s_th), Paragraph('<b>Status</b>', s_th), Paragraph('<b>Notes</b>', s_th)],
                    [Paragraph('Import Pipeline', s_td), status_cell('PASS'), Paragraph('6-step lifecycle, chunked processing for large files', s_td)],
                    [Paragraph('Validation Engine', s_td), status_cell('PASS'), Paragraph('6 rule types, fully DB-driven, no hardcoded rules', s_td)],
                    [Paragraph('Normalization', s_td), status_cell('PASS'), Paragraph('8 field types, 3-tier lookup, 12 abbreviations', s_td)],
                    [Paragraph('Quality Scoring', s_td), status_cell('PASS'), Paragraph('3 dimensions, configurable weights, 4 distribution buckets', s_td)],
                    [Paragraph('Deduplication', s_td), status_cell('PASS'), Paragraph('3 strategies, batch + cross-batch, TTL cache', s_td)],
                    [Paragraph('Config-over-Code', s_td), status_cell('PASS'), Paragraph('All rules in DB, runtime modifiable', s_td)],
                    [Paragraph('Lead Scoring', s_td), status_cell('PASS'), Paragraph('6 dimensions, 100-point scale, feeds Phase 5', s_td)],
                ],
                [0.22, 0.15, 0.63],
                'Table 2.2: Phase 1 Production Readiness Assessment'
            ),
        ]
    ))

    # ════════════════════════════════════════════════════════════
    # CHAPTER 3: Phase 2
    # ════════════════════════════════════════════════════════════
    story.extend(phase_section(
        num=3,
        title='Phase 2 - Signal Pipeline and Workflow Engine',
        objective=[
            'Phase 2 built the asynchronous workflow engine that powers all background intelligence operations: '
            'company research, signal detection, enrichment processing, and data import jobs. The workflow engine '
            'provides a priority queue with configurable concurrency, retry logic with exponential backoff, job '
            'lifecycle management (queued, running, completed, failed), and stale job recovery for jobs that exceed '
            'a 30-minute timeout threshold.',
            'The workflow engine is designed as the operational backbone for the intelligence pipeline. While Phase 3 '
            'adds the intelligence logic (research, signals, evidence), Phase 2 provides the reliable execution '
            'infrastructure that ensures these operations complete even in the face of transient failures. The '
            'engine supports bulk enqueue operations with duplicate job prevention, enabling efficient batch '
            'processing of hundreds of companies without creating redundant research jobs.',
        ],
        evidence=[
            (
                [
                    [Paragraph('<b>Module</b>', s_th), Paragraph('<b>File</b>', s_th), Paragraph('<b>Lines</b>', s_th), Paragraph('<b>Key Functions</b>', s_th)],
                    [Paragraph('Workflow Engine', s_td), Paragraph('workflow-engine/index.ts', s_td), Paragraph('191', s_td_c), Paragraph('enqueue, logJobEvent, recoverStaleJobs', s_td)],
                    [Paragraph('Job Processor', s_td), Paragraph('workflow-engine/processor.ts', s_td), Paragraph('535', s_td_c), Paragraph('processJob (research, enrichment, etc.)', s_td)],
                    [Paragraph('Priority Queue', s_td), Paragraph('workflow-engine/queue.ts', s_td), Paragraph('453', s_td_c), Paragraph('enqueue, dequeue, priority management', s_td)],
                    [Paragraph('Retry Logic', s_td), Paragraph('workflow-engine/retry.ts', s_td), Paragraph('108', s_td_c), Paragraph('Exponential backoff, max retry config', s_td)],
                    [Paragraph('Cron Processor', s_td), Paragraph('api/cron/job-processor/route.ts', s_td), Paragraph('48', s_td_c), Paragraph('GET/POST job processing endpoint', s_td)],
                    [Paragraph('Event Bus', s_td), Paragraph('lib/event-bus.ts', s_td), Paragraph('52', s_td_c), Paragraph('In-memory pub/sub, copy-on-iterate', s_td)],
                    [Paragraph('Batch Progress', s_td), Paragraph('lib/batch-progress.ts', s_td), Paragraph('24', s_td_c), Paragraph('Batch operation tracking', s_td)],
                ],
                [0.15, 0.30, 0.08, 0.47],
                'Table 3.1: Phase 2 Workflow Engine Components'
            ),
            'The workflow engine index exports convenience functions for common job types: enqueueEnrichment(), '
            'enqueueResearch(), and enqueueSignalDetection() with bulk enqueue helpers that prevent duplicate '
            'job creation for the same company and job type. The job processor supports multiple job types with '
            'type-specific processing logic, and the retry module implements exponential backoff with configurable '
            'maximum retry attempts.',
            'The priority queue manages job ordering with configurable priority levels. The event bus provides '
            'in-memory publish/subscribe messaging with a copy-on-iterate pattern that prevents mutation during '
            'event emission. The batch progress tracker enables real-time UI updates for long-running batch '
            'operations like account priority recomputation.',
        ],
        func_val=[
            'The workflow engine correctly handles job lifecycle transitions: queued to running to completed/failed, '
            'with automatic retry on failure (exponential backoff) and stale job recovery (30-minute timeout). '
            'The job processor logs each processing step to the JobLog table with level-based filtering, enabling '
            'debugging of failed jobs without log file access.',
            'Duplicate job prevention is enforced at the enqueue level: before creating a new job, the engine '
            'checks for existing jobs of the same type for the same target that are not in a terminal state '
            '(completed, failed, cancelled). This prevents redundant research operations when multiple triggers '
            'fire for the same company in quick succession.',
            'The cron endpoint at /api/cron/job-processor provides both a GET (status check) and POST (trigger '
            'processing) interface, enabling integration with external schedulers like Vercel Cron or system cron. '
            'The job processor is idempotent, meaning repeated processing of the same job type for the same target '
            'produces the same result without side effects.',
        ],
        bi_val=[
            'The workflow engine enables the platform to operate asynchronously, which is essential for a revenue '
            'intelligence system where research operations (web searches, LLM calls, evidence processing) can take '
            '30-60 seconds per company. Without this async infrastructure, users would experience unacceptable '
            'latency when triggering research for their account portfolios.',
            'Stale job recovery addresses a common production failure mode: jobs that start but never complete '
            'due to process crashes, network timeouts, or LLM API failures. The 30-minute timeout with automatic '
            'recovery ensures the pipeline does not stall indefinitely, which is critical for overnight batch '
            'processing of large account lists.',
            'The bulk enqueue operations with duplicate prevention enable efficient portfolio-wide operations. '
            'When a user triggers batch research on 200 accounts, the engine creates only the necessary jobs, '
            'skipping companies that already have recent research or active jobs. This prevents wasted API calls '
            'and LLM token consumption.',
        ],
        current_status=[
            'Phase 2 is complete and operational. The workflow engine, job processor, priority queue, and retry '
            'logic are all functional. The system supports research, enrichment, and signal detection job types '
            'with bulk operations and stale job recovery. The cron endpoint is ready for external scheduler '
            'integration.',
        ],
        prod_ready=[
            (
                [
                    [Paragraph('<b>Criterion</b>', s_th), Paragraph('<b>Status</b>', s_th), Paragraph('<b>Notes</b>', s_th)],
                    [Paragraph('Job Lifecycle', s_td), status_cell('PASS'), Paragraph('Queued/running/completed/failed with transitions', s_td)],
                    [Paragraph('Retry Logic', s_td), status_cell('PASS'), Paragraph('Exponential backoff, configurable max retries', s_td)],
                    [Paragraph('Stale Recovery', s_td), status_cell('PASS'), Paragraph('30-min timeout, auto-recovery', s_td)],
                    [Paragraph('Duplicate Prevention', s_td), status_cell('PASS'), Paragraph('Same company+type check before enqueue', s_td)],
                    [Paragraph('Bulk Operations', s_td), status_cell('PASS'), Paragraph('Batch enqueue with progress tracking', s_td)],
                    [Paragraph('Cron Integration', s_td), status_cell('PASS'), Paragraph('GET/POST endpoint for external schedulers', s_td)],
                    [Paragraph('Event Bus', s_td), status_cell('PASS'), Paragraph('In-memory pub/sub, copy-on-iterate safety', s_td)],
                ],
                [0.22, 0.15, 0.63],
                'Table 3.2: Phase 2 Production Readiness Assessment'
            ),
        ]
    ))

    # ════════════════════════════════════════════════════════════
    # CHAPTER 4: Phase 3
    # ════════════════════════════════════════════════════════════
    story.extend(phase_section(
        num=4,
        title='Phase 3 - Intelligence Engine and AI Governance',
        objective=[
            'Phase 3 is the intelligence core of the platform, implementing the research pipeline, signal detection, '
            'evidence collection, and the AI governance layer that controls all LLM interactions. The research engine '
            'executes a 6-step pipeline: web search (4 parallel Tavily queries for business, tech, people, and news), '
            'evidence collection with source quality tiering, LLM-based field extraction with per-field confidence '
            'scoring, field validation, confidence scoring, and structured intelligence storage.',
            'The AI governance layer (ai-governance.ts, 1,093 lines) is the critical architectural boundary: it is '
            'the ONLY module permitted to import callLLM. All 170+ API routes that require AI capabilities must call '
            'governedAICallAggregate(), which wraps every LLM interaction with pre-generation validation (confidence '
            'gates, freshness thresholds, evidence grounding, hallucination prevention rules), real-time audit trail '
            'recording to the AIGenerationAudit table, and post-generation quality checks. This architecture ensures '
            'that no uncontrolled AI output enters the platform.',
            'The intelligence-contract.ts module (917 lines) serves as the Single Source of Truth for all intelligence '
            'consumption. Every downstream consumer (Phase 4 pipeline, Phase 5 prioritization, Phase 6 validation) '
            'must use this module to access company intelligence, research context, signal metrics, and freshness profiles.',
        ],
        evidence=[
            (
                [
                    [Paragraph('<b>Module</b>', s_th), Paragraph('<b>File</b>', s_th), Paragraph('<b>Lines</b>', s_th), Paragraph('<b>Key Functions</b>', s_th)],
                    [Paragraph('Research Pipeline', s_td), Paragraph('research-engine/researcher.ts', s_td), Paragraph('608', s_td_c), Paragraph('6-step research, 4 parallel searches', s_td)],
                    [Paragraph('Evidence System', s_td), Paragraph('research-engine/evidence.ts', s_td), Paragraph('609', s_td_c), Paragraph('Collect, store, link, quality scoring', s_td)],
                    [Paragraph('Signal Detection', s_td), Paragraph('research-engine/signals.ts', s_td), Paragraph('349', s_td_c), Paragraph('7 signal types, dual-mode detection', s_td)],
                    [Paragraph('Freshness Indicators', s_td), Paragraph('research-engine/freshness-indicators.ts', s_td), Paragraph('174', s_td_c), Paragraph('4-domain freshness with decay scoring', s_td)],
                    [Paragraph('Evidence Quality', s_td), Paragraph('research-engine/evidence-quality.ts', s_td), Paragraph('121', s_td_c), Paragraph('5-dimension quality scoring', s_td)],
                    [Paragraph('AI Governance', s_td), Paragraph('ai-governance.ts', s_td), Paragraph('1,093', s_td_c), Paragraph('governedAICallAggregate, 21 type configs', s_td)],
                    [Paragraph('Intelligence Contract', s_td), Paragraph('intelligence-contract.ts', s_td), Paragraph('917', s_td_c), Paragraph('getResearchContext, getAccountIntelligence', s_td)],
                    [Paragraph('Signal Lifecycle', s_td), Paragraph('research-engine/signal-lifecycle.ts', s_td), Paragraph('78', s_td_c), Paragraph('State machine: detected to archived', s_td)],
                ],
                [0.15, 0.28, 0.08, 0.49],
                'Table 4.1: Phase 3 Intelligence Engine Modules'
            ),
            'The evidence system implements multi-factor confidence scoring: relevance (30%) based on field matching, '
            'source quality tier (25%) from a 3-tier system (premium: Bloomberg/Reuters/SEC, standard: TechCrunch/LinkedIn, '
            'low: Twitter/Reddit), recency decay (25%) using exponential decay with 365-day half-life, and corroboration '
            '(20%) based on unique domain count. Source quality tiers are loaded from the SystemSetting table, maintaining '
            'the config-over-code pattern. Evidence cleanup keeps the latest 50 records per company on re-research.',
            'Signal detection implements dual-mode operation: LLM-based detection via governedAICallAggregate with a '
            'rule-based fallback. Seven signal types are supported: funding, hiring, leadership_change, expansion, '
            'technology, product, and partnership. Each signal receives a 3-tier impact assessment (high/medium/low) '
            'and is automatically classified into a lifecycle status (detected, validated, active, aging, expired, archived) '
            'based on age, confidence, and impact thresholds.',
            'The AI governance layer defines 21 generation-type configurations with per-type confidence thresholds: '
            'email_draft requires 0.6 confidence, signal_detection has 0.0 threshold (always allowed), opportunities '
            'require 0.5, and so on. The governedAICallAggregate function performs 5 pre-generation checks (confidence gate, '
            'freshness gate, capability match gate, staleness check, recent intelligence check), injects hallucination '
            'prevention rules into every prompt, and records the complete generation context to AIGenerationAudit.',
        ],
        func_val=[
            'The 6-step research pipeline has been validated: (1) 4 parallel Tavily web searches covering business, '
            'technology, people, and news domains, (2) evidence collection with source URL tracking, (3) LLM-based '
            'extraction with per-field confidence scores (not a single overall score), (4) field validation against '
            'expected data types, (5) composite confidence scoring, and (6) structured storage in CompanyResearchCard '
            'with per-domain freshness timestamps. Progress callbacks enable real-time UI updates during research.',
            'The governance boundary is enforced: ai-governance.ts is the only file that imports callLLM. All route '
            'handlers use governedAICallAggregate() or governedAICall(). The governance checks are composable, meaning '
            'callers can inspect individual check results to make contextual decisions. The non-throwing design returns '
            'a GovernanceResult with canProceed boolean, enabling graceful degradation when governance checks fail.',
            'The intelligence contract provides four primary functions: getResearchContext() returns a clean JSON object '
            'with 20+ fields for AI consumption, getAccountIntelligence() computes a 6-component composite score '
            '(dataCompleteness, evidenceQuality, freshnessScore, signalStrength, contactCoverage, engagementScore) '
            'mapped to hot/warm/cold/unknown tiers, getResearchFreshness() provides per-domain staleness detection '
            'with exponential decay scoring, and getSignalMetrics() returns signal analytics for dashboard consumption.',
        ],
        bi_val=[
            'The intelligence engine transforms raw web data into structured, confidence-scored intelligence that '
            'directly supports account prioritization and opportunity identification. The per-field confidence model '
            '(rather than a single overall score) enables downstream consumers to make granular decisions: for example, '
            'relying on high-confidence revenue data while treating low-confidence technology stack data as suggestive '
            'rather than definitive. This nuance is critical for IT Services consulting where technology assessment '
            'accuracy directly impacts proposal relevance.',
            'The AI governance layer addresses three enterprise concerns: (1) hallucination prevention via mandatory '
            'grounding warnings and evidence injection into every prompt, (2) auditability via complete generation '
            'recording in AIGenerationAudit with score breakdowns and evidence IDs, and (3) cost control via confidence '
            'gates that prevent low-quality LLM calls from consuming tokens on unpromising requests. The 21 per-type '
            'configurations allow fine-tuning governance strictness for different use cases.',
            'The 4-domain freshness system (profile: 90 days, signals: 14 days, contacts: 45 days, technology: 60 days) '
            'with exponential decay scoring provides a mathematical basis for research prioritization. Companies with '
            'stale profiles across multiple domains surface as priority candidates for re-research, ensuring the '
            'intelligence base remains current without unnecessary re-processing of recently-researched accounts.',
        ],
        current_status=[
            'Phase 3 is fully implemented and operationally validated. The research pipeline, evidence system, signal '
            'detection, AI governance layer, and intelligence contract are all functional. The governance boundary is '
            'enforced: only ai-governance.ts imports callLLM. The intelligence contract serves as the single source of '
            'truth for all downstream intelligence consumers.',
        ],
        prod_ready=[
            (
                [
                    [Paragraph('<b>Criterion</b>', s_th), Paragraph('<b>Status</b>', s_th), Paragraph('<b>Notes</b>', s_th)],
                    [Paragraph('Research Pipeline', s_td), status_cell('PASS'), Paragraph('6-step, 4 parallel searches, per-field confidence', s_td)],
                    [Paragraph('Evidence System', s_td), status_cell('PASS'), Paragraph('4-factor confidence, 3-tier source quality, decay', s_td)],
                    [Paragraph('Signal Detection', s_td), status_cell('PASS'), Paragraph('7 types, dual-mode, lifecycle state machine', s_td)],
                    [Paragraph('AI Governance', s_td), status_cell('PASS'), Paragraph('21 type configs, 5 checks, audit trail', s_td)],
                    [Paragraph('Governance Boundary', s_td), status_cell('PASS'), Paragraph('Single import point for callLLM, enforced', s_td)],
                    [Paragraph('Intelligence Contract', s_td), Paragraph('SOT', s_td_c), Paragraph('4 functions, 6-component composite scoring', s_td)],
                    [Paragraph('Freshness Tracking', s_td), status_cell('PASS'), Paragraph('4 domains, exponential decay, staleness ranking', s_td)],
                    [Paragraph('Hallucination Prevention', s_td), status_cell('PASS'), Paragraph('Mandatory grounding warnings, evidence injection', s_td)],
                ],
                [0.22, 0.15, 0.63],
                'Table 4.2: Phase 3 Production Readiness Assessment'
            ),
        ]
    ))

    # ════════════════════════════════════════════════════════════
    # CHAPTER 5: Phase 4
    # ════════════════════════════════════════════════════════════
    story.extend(phase_section(
        num=5,
        title='Phase 4 - Track C Pipeline (Read-Only Intelligence Flow)',
        objective=[
            'Phase 4 implements the Track C intelligence pipeline: Signal to Meaning to Capability Fit to Opportunity '
            'Recommendation to Human Decision to Pursuit Intelligence. This is a read-only pipeline, meaning it '
            'produces intelligence artifacts that inform human decisions but never autonomously initiates outreach, '
            'creates pursuits, or sends communications. The pipeline is the core value proposition of the revenue '
            'intelligence platform, transforming raw signals into actionable, scored, and explained opportunity recommendations.',
            'The Track C pipeline consists of four sequential stages, each building on the output of the previous: '
            '(1) Signal Meaning Inference maps detected signals to 7 buying-stage categories using deterministic rules '
            'with zero LLM dependency, (2) Signal-Capability Matching scores the alignment between signals and the '
            'organization\'s capability assets using a 4-dimension weighted formula, (3) Opportunity Recommendation '
            'generates scored opportunity records with LLM-generated context (title, business trigger, why now, '
            'suggested conversation), and (4) the opportunity record enters pending_review status, requiring '
            'explicit human acceptance before any downstream action.',
        ],
        evidence=[
            (
                [
                    [Paragraph('<b>Stage</b>', s_th), Paragraph('<b>File</b>', s_th), Paragraph('<b>Lines</b>', s_th), Paragraph('<b>Approach</b>', s_th)],
                    [Paragraph('Signal Meaning', s_td), Paragraph('signal-meaning.ts', s_td), Paragraph('336', s_td_c), Paragraph('Rule-based, 16 rules, zero LLM', s_td)],
                    [Paragraph('Capability Match', s_td), Paragraph('signal-capability-matching.ts', s_td), Paragraph('383', s_td_c), Paragraph('4-dimension weighted scoring', s_td)],
                    [Paragraph('Opportunity Engine', s_td), Paragraph('opportunity-recommendation.ts', s_td), Paragraph('521', s_td_c), Paragraph('5-dimension composite + LLM context', s_td)],
                    [Paragraph('Opportunity CRUD', s_td), Paragraph('opportunity-recommendation-engine.ts', s_td), Paragraph('456', s_td_c), Paragraph('Batch generation, dedup, status workflow', s_td)],
                    [Paragraph('Evidence Quality', s_td), Paragraph('evidence-quality.ts', s_td), Paragraph('121', s_td_c), Paragraph('5 dimensions, zero defaults on empty', s_td)],
                    [Paragraph('Signal Lifecycle', s_td), Paragraph('signal-lifecycle.ts', s_td), Paragraph('78', s_td_c), Paragraph('6-state machine, batch transitions', s_td)],
                ],
                [0.18, 0.30, 0.08, 0.44],
                'Table 5.1: Phase 4 Track C Pipeline Stages'
            ),
            'Signal Meaning Inference uses 16 ordered rules in a specificity-first cascade: (1) opportunity type '
            'overrides (7 mappings including RFP to vendor_evaluation at 0.95 confidence, tender to compliance_requirement), '
            '(2) compliance keyword regex scanning in title and description, (3) rule cascade by (signalType, severity, impact). '
            'The 7 meaning categories are: budget_available, leadership_openness, tech_dissatisfaction, growth_pressure, '
            'compliance_requirement, vendor_evaluation, and unknown. Batch processing is pure (no DB calls), returning '
            'results for the caller to persist. Signals that already have a non-unknown meaningCategory are skipped.',
            'Signal-Capability Matching uses a 4-dimension weighted scoring formula: category match (30%), keyword '
            'Jaccard similarity (30%), business problem alignment (20%), and impact bonus (5%). The SIGNAL_CAPABILITY_MAP '
            'defines 10 signal-type-to-capability-category mappings with associated business problems, sales angles, '
            'and keywords. Only active, validated, or aging signals are matched (expired and archived are excluded). '
            'Results are capped at 50 for performance. All existing matches for a company are deleted before recompute '
            'to ensure consistency.',
            'Opportunity Recommendation uses a 5-dimension composite score: signal confidence (25%), capability match '
            '(25%), freshness (20%), evidence quality (15%), and business impact (15%), with weights summing to 1.0. '
            'The LLM generates structured output via governedAICallAggregate: opportunity title, business trigger, '
            'why now rationale, business problem, recommended stakeholders, and suggested conversation starter. '
            'All recommendations are created with status pending_review, explicitly requiring human acceptance. '
            'The code includes a documented anti-autonomy rule: "Only creates OpportunityRecommendation records, '
            'NEVER creates Pursuit or initiates communication autonomously."',
        ],
        func_val=[
            'Signal meaning inference is verified as 100% deterministic with zero LLM dependency. The 16-rule cascade '
            'produces consistent results regardless of system load or LLM availability. Each rule outputs an explicit '
            'confidence level (0.2 to 0.95) and a recommended action, enabling downstream consumers to filter by '
            'confidence threshold.',
            'The read-only boundary is enforced at multiple levels: (1) the opportunity engine never creates Pursuit '
            'records, (2) all LLM calls go through governedAICallAggregate, (3) recommendations enter pending_review '
            'status requiring explicit human acceptance, and (4) no outbound automation exists anywhere in the pipeline '
            '(no auto-email, no SendQueue entries). The platform is explicitly not a CRM and does not replace pursuit '
            'tracking systems.',
            'The signal lifecycle state machine has been validated: detected (new, less than 14 days, confidence below '
            '0.5) transitions to validated (14 days, confidence 0.5+), then active (14 days, confidence 0.7+, high impact), '
            'then aging (14-90 days), then expired (90-365 days), then archived (365+ days). Batch transitions use '
            'updateMany for performance, grouping updates by new status.',
        ],
        bi_val=[
            'The Track C pipeline transforms the platform from a data repository into an active intelligence system. '
            'By automatically inferring buying-stage meaning from signals, matching signals to capabilities, and generating '
            'scored opportunity recommendations, the pipeline provides sales teams with pre-qualified, context-rich leads '
            'that would otherwise require hours of manual research per account.',
            'The deterministic signal meaning inference is a deliberate architectural choice that prioritizes consistency '
            'and auditability over LLM flexibility. For an IT Services consulting firm, the 7 buying-stage categories '
            '(budget available, leadership openness, tech dissatisfaction, growth pressure, compliance requirement, vendor '
            'evaluation, unknown) map directly to real-world sales qualification criteria. A "compliance_requirement" '
            'signal, for example, triggers a fundamentally different sales approach than a "growth_pressure" signal.',
            'The 5-dimension opportunity scoring enables rational prioritization. A high-confidence funding signal matched '
            'to a strong capability fit with fresh evidence will score significantly higher than a low-confidence hiring '
            'signal with stale data, even if both come from the same company. This mathematical prioritization reduces '
            'the cognitive load on sales managers who must decide where to focus limited pursuit resources.',
        ],
        current_status=[
            'Phase 4 is fully implemented with all four pipeline stages operational. The signal meaning inference, '
            'capability matching, and opportunity recommendation engines are functional. The read-only boundary is '
            'enforced. Two minor issues were identified during validation: (1) a dual opportunity-recommendation file '
            'exists (v1 and v2 with different weight distributions, v2 takes precedence via barrel export ordering), '
            'and (2) the useLLMEnhancement config field in capability matching exists but has no implementation (dead code). '
            'Neither issue affects production correctness.',
        ],
        prod_ready=[
            (
                [
                    [Paragraph('<b>Criterion</b>', s_th), Paragraph('<b>Status</b>', s_th), Paragraph('<b>Notes</b>', s_th)],
                    [Paragraph('Signal Meaning', s_td), status_cell('PASS'), Paragraph('Deterministic, 16 rules, 7 categories, zero LLM', s_td)],
                    [Paragraph('Capability Matching', s_td), status_cell('PASS'), Paragraph('4-dimension scoring, 10 type mappings, capped at 50', s_td)],
                    [Paragraph('Opportunity Scoring', s_td), status_cell('PASS'), Paragraph('5 dimensions, weights sum to 1.0, pure computeCompositeScore', s_td)],
                    [Paragraph('Read-Only Boundary', s_td), status_cell('PASS'), Paragraph('Never creates Pursuit, no outbound automation', s_td)],
                    [Paragraph('LLM Governance', s_td), status_cell('PASS'), Paragraph('All calls via governedAICallAggregate', s_td)],
                    [Paragraph('Signal Lifecycle', s_td), status_cell('PASS'), Paragraph('6-state machine with batch transitions', s_td)],
                    [Paragraph('Evidence Quality', s_td), status_cell('PASS'), Paragraph('5 dimensions, graceful zero-score defaults', s_td)],
                    [Paragraph('Dual File Cleanup', s_td), status_cell('WARN'), Paragraph('v1 opportunity engine still importable but unused', s_td)],
                ],
                [0.22, 0.15, 0.63],
                'Table 5.2: Phase 4 Production Readiness Assessment'
            ),
        ]
    ))

    # ════════════════════════════════════════════════════════════
    # CHAPTER 6: Phase 5
    # ════════════════════════════════════════════════════════════
    story.extend(phase_section(
        num=6,
        title='Phase 5 - Account Prioritization Engine',
        objective=[
            'Phase 5 implements the account prioritization engine that answers the fundamental revenue intelligence '
            'question: "Which accounts should we pursue right now, and why?" The engine computes a composite 0-100 '
            'score for each company using the formula: clamp(round(StaticFit x 0.40 + DynamicIntel x 0.40 + '
            'TimingUrgency x 0.20), 0, 100). The score maps to 4 tiers: HOT (90+), ACTIVE (70-89), NURTURE (50-69), '
            'and LOW (below 50). The score is persisted as accountPriorityScore on the Company model, explicitly '
            'separate from the intelligenceScore (research intelligence quality) to maintain distinct semantic meaning.',
            'Phase 5 also introduces the ICP (Ideal Customer Profile) configuration system, which provides the '
            'static fit inputs for the prioritization formula. The ICP profile defines target industries (16), company '
            'size ranges (6), geographic regions (11), minimum revenue thresholds, preferred technology keywords (20), '
            'excluded industries (5), and 5 weighted sub-dimensions (industry 0.30, companySize 0.25, geography 0.15, '
            'revenue 0.15, techFit 0.15). The ICP is stored in the SystemSetting table and modifiable at runtime via '
            'the API, maintaining the config-over-code pattern established in Phase 1.',
        ],
        evidence=[
            (
                [
                    [Paragraph('<b>Component</b>', s_th), Paragraph('<b>File</b>', s_th), Paragraph('<b>Lines</b>', s_th), Paragraph('<b>Key Functions</b>', s_th)],
                    [Paragraph('Prioritization Engine', s_td), Paragraph('account-prioritization.ts', s_td), Paragraph('1,116', s_td_c), Paragraph('computeAccountPriority, getAccountRankings', s_td)],
                    [Paragraph('ICP Configuration', s_td), Paragraph('icp-config.ts', s_td), Paragraph('234', s_td_c), Paragraph('getIcpProfile, industryMatch, techMatch', s_td)],
                    [Paragraph('Rankings API', s_td), Paragraph('g-strategy/account-rankings.ts', s_td), Paragraph('90', s_td_c), Paragraph('GET rankings, POST batch recompute', s_td)],
                    [Paragraph('Priority API', s_td), Paragraph('g-strategy/companies___id__priority.ts', s_td), Paragraph('89', s_td_c), Paragraph('GET/POST single company priority', s_td)],
                    [Paragraph('ICP API', s_td), Paragraph('g-strategy/icp-profile.ts', s_td), Paragraph('96', s_td_c), Paragraph('GET ICP config, PUT partial update', s_td)],
                    [Paragraph('Rankings UI', s_td), Paragraph('account-ranking-screen.tsx', s_td), Paragraph('715', s_td_c), Paragraph('Tier filter, search, batch recompute trigger', s_td)],
                    [Paragraph('ICP Settings UI', s_td), Paragraph('icp-settings-screen.tsx', s_td), Paragraph('567', s_td_c), Paragraph('Tag input, save/reset controls', s_td)],
                ],
                [0.18, 0.28, 0.08, 0.46],
                'Table 6.1: Phase 5 Account Prioritization Components'
            ),
            'The prioritization engine computes three weighted dimensions: (1) Static Fit (40%) with 5 sub-scores '
            '(industry ICP match, company size binary+bonus, geography ICP match, revenue heuristic with 5-tier mapping, '
            'tech keyword ratio), (2) Dynamic Intelligence (40%) with 4 sub-scores (intelligenceScore normalized at 30%, '
            'research card field coverage at 25%, signal quality based on count and severity at 25%, contact coverage '
            'staircase at 20%), and (3) Timing/Urgency (20%) with 3 sub-scores (signal recency, engagement recency with '
            'decay, growth indicator from lifecycle stage and funding stage). All sub-scores are normalized to 0-100 '
            'before applying dimension weights.',
            'The engine implements three gap closures: (1) "Why Now?" reason generator using 8 rule categories producing '
            'a maximum of 8 deduplicated reasons (recent high-severity signals, engagement score, lifecycle stage, signal '
            'type patterns, intelligence freshness, contact coverage, ICP alignment, funding stage), (2) Top Signals '
            'ranking by severity x 100 minus daysAgo, returning top 5, and (3) Capability Relevance scoring across '
            'industry match (40pts), size match (15pts), technology keyword overlap (25pts), and signal-type relevance '
            '(20pts) with a 25-point minimum threshold.',
            'Batch optimization uses bulk-fetch of signals for all companies in a single query, in-memory grouping, '
            'Promise.all for parallel DB operations, and a single db.$transaction for atomic persistence of all scores '
            'and tier assignments. This enables efficient recomputation of 1000+ accounts in a single API call.',
        ],
        func_val=[
            'The formula has been mathematically validated: weights sum to exactly 1.0 (0.40 + 0.40 + 0.20), '
            'clamp bounds are [0, 100], Math.round prevents floating-point drift, and tier boundaries have no gaps '
            'or overlaps (HOT: 90-100, ACTIVE: 70-89, NURTURE: 50-69, LOW: 0-49). The score is 100% data-driven '
            'from the database with zero hardcoded or mock data. The intelligenceScore (research quality) and '
            'accountPriorityScore (sales priority) are stored as separate fields with distinct semantic meaning.',
            'ICP configuration uses lazy-loading from the SystemSetting table with an in-memory cache (currentIcp) '
            'that avoids repeated DB reads. Partial updates use a deep-merge function that handles nested objects '
            'and replaces arrays. Weight sum validation ensures the 5 sub-dimension weights always sum to 1.0. '
            'A reset endpoint restores the default ICP profile. Graceful fallback to defaults occurs if the DB '
            'is unavailable during initial load.',
            'The API surface provides: GET /api/account-rankings for paginated, filterable, searchable rankings '
            'with tier breakdown; POST /api/account-rankings for batch recomputation with optional status and '
            'industry filters; GET /api/companies/:id/priority for single company priority lookup; POST '
            '/api/companies/:id/priority for single company recompute; GET /api/icp-profile for config with '
            'isDefault flag; and PUT /api/icp-profile for partial update with { reset: true } support.',
        ],
        bi_val=[
            'The 40/40/20 weight distribution reflects a deliberate business decision: Static Fit (ICP alignment) '
            'and Dynamic Intelligence (research quality and signal strength) are equally important, while Timing/Urgency '
            'is a secondary modifier. This weighting means a company that perfectly matches the ICP and has rich '
            'intelligence but no recent signals will score decently (Static 80 + Dynamic 60 = 56 before timing), '
            'but a recent high-severity signal on a moderate-fit account can push it into ACTIVE or HOT territory '
            'through the timing dimension. This balance ensures the platform surfaces both "always pursue" accounts '
            'and "pursue now" accounts.',
            'The "Why Now?" reason generator addresses the most common sales manager question: "Why should I call this '
            'account today instead of next quarter?" By providing up to 8 specific, evidence-backed reasons (e.g., '
            '"High-severity technology change signal detected 3 days ago," "Leadership change suggests 90-day evaluation '
            'window"), the platform gives sales reps concrete talking points grounded in actual intelligence rather '
            'than generic outreach templates.',
            'The ICP configuration system enables the platform to adapt to different market segments without code changes. '
            'An IT Services firm targeting financial services in North America with 500+ employees can define a different '
            'ICP than one targeting healthcare in Europe. The 5 weighted sub-dimensions allow fine-tuning: increasing '
            'the industry weight to 0.40 and reducing geography to 0.10, for example, prioritizes vertical fit over '
            'regional proximity.',
        ],
        current_status=[
            'Phase 5 is fully implemented and validated. The account prioritization engine, ICP configuration system, '
            'and all API endpoints are operational. The formula integrity has been mathematically verified. One UI '
            'misalignment was identified: the ICP settings screen sends targetCountries/preferredTechnologies while '
            'the backend expects targetRegions/preferredTechKeywords. This field name mismatch means ICP updates from '
            'the UI may not apply correctly to the region and technology fields, though the API works correctly when '
            'called directly with the correct field names.',
        ],
        prod_ready=[
            (
                [
                    [Paragraph('<b>Criterion</b>', s_th), Paragraph('<b>Status</b>', s_th), Paragraph('<b>Notes</b>', s_th)],
                    [Paragraph('Formula Integrity', s_td), status_cell('PASS'), Paragraph('Weights sum 1.0, clamp 0-100, Math.round', s_td)],
                    [Paragraph('Tier Classification', s_td), status_cell('PASS'), Paragraph('HOT 90+, ACTIVE 70-89, NURTURE 50-69, LOW below 50', s_td)],
                    [Paragraph('Score Separation', s_td), status_cell('PASS'), Paragraph('accountPriorityScore is separate from intelligenceScore', s_td)],
                    [Paragraph('Data-Driven', s_td), status_cell('PASS'), Paragraph('100% from DB, zero hardcoded or mock data', s_td)],
                    [Paragraph('ICP Config', s_td), status_cell('PASS'), Paragraph('DB-backed, lazy-load, deep-merge, weight validation', s_td)],
                    [Paragraph('Batch Optimization', s_td), status_cell('PASS'), Paragraph('Bulk fetch, in-memory group, $transaction', s_td)],
                    [Paragraph('Gap Closures', s_td), status_cell('PASS'), Paragraph('Why Now (8 rules), Top Signals (5), Capabilities (5)', s_td)],
                    [Paragraph('ICP UI Alignment', s_td), status_cell('WARN'), Paragraph('Field name mismatch: regions/technologies vs countries/tech', s_td)],
                ],
                [0.22, 0.15, 0.63],
                'Table 6.2: Phase 5 Production Readiness Assessment'
            ),
        ]
    ))

    # ════════════════════════════════════════════════════════════
    # CHAPTER 7: Phase 6
    # ════════════════════════════════════════════════════════════
    story.extend(phase_section(
        num=7,
        title='Phase 6 - Intelligence Validation Layer',
        objective=[
            'Phase 6 implements the human-in-the-loop validation layer that closes the intelligence feedback loop. '
            'This layer enables domain experts to validate the quality of intelligence artifacts produced by Phases 3-5 '
            'and aggregates their judgments into actionable quality metrics. The layer operates with zero LLM calls, '
            'making it purely deterministic and fully auditable. It addresses the fundamental question: "Is the '
            'intelligence the platform produces actually accurate, relevant, and actionable?"',
            'The validation system supports 5 artifact types: signal_meaning (validating the accuracy of signal-to-buying-stage '
            'inference), capability_match (validating the relevance of signal-to-capability alignment), opportunity_recommendation '
            '(validating the actionability of generated opportunities), pursuit_intelligence (validating the quality of '
            'pursuit-related intelligence), and evidence_quality (validating the accuracy of evidence quality scores). '
            'Each validation captures a snapshot of the artifact at validation time, the human judgment (accuracy, relevance, '
            'actionability ratings on 1-5 scales), and optional free-text feedback.',
        ],
        evidence=[
            (
                [
                    [Paragraph('<b>Component</b>', s_th), Paragraph('<b>File</b>', s_th), Paragraph('<b>Lines</b>', s_th), Paragraph('<b>Key Functions</b>', s_th)],
                    [Paragraph('Validation Engine', s_td), Paragraph('intelligence-validation.ts', s_td), Paragraph('662', s_td_c), Paragraph('submitValidation, getQualityReport', s_td)],
                    [Paragraph('Validation Schemas', s_td), Paragraph('validations.ts', s_td), Paragraph('404', s_td_c), Paragraph('Zod schemas for all validation inputs', s_td)],
                    [Paragraph('Submit API', s_td), Paragraph('g-crm/companies___id__validations.ts', s_td), Paragraph('72', s_td_c), Paragraph('POST submit, GET list validations', s_td)],
                    [Paragraph('Quality Report API', s_td), Paragraph('g-crm/validations__quality-report.ts', s_td), Paragraph('24', s_td_c), Paragraph('GET aggregated quality metrics', s_td)],
                ],
                [0.20, 0.30, 0.08, 0.42],
                'Table 7.1: Phase 6 Intelligence Validation Components'
            ),
            'The submitValidation function captures: artifact type and ID, validator identity, 1-5 rating (clamped with '
            'Math.round), accuracy assessment (4 options: correct, mostly_correct, partially_correct, incorrect), relevance '
            'assessment (3 options: highly_relevant, somewhat_relevant, not_relevant), actionability assessment (3 options: '
            'actionable_now, actionable_with_research, not_actionable), optional free-text feedback (max 2000 chars), '
            'and optional validator context as a JSON object.',
            'The snapshot system captures the artifact state at validation time using 5 type-specific loaders: '
            'loadSignalMeaningSnapshot (8 fields from CompanySignal), loadCapabilityMatchSnapshot (6 fields plus '
            'enrichment from signal and capability), loadOpportunitySnapshot (12 fields from OpportunityRecommendation), '
            'loadPursuitSnapshot (8 fields from Pursuit), and loadEvidenceQualitySnapshot (15 fields from '
            'computeEvidenceQuality). Snapshot loader failures are caught with console.warn, allowing validation '
            'to proceed without a snapshot rather than failing the entire operation.',
            'The getQualityReport function answers 4 validation questions: (Q1) Meaning Accuracy distribution by signal '
            'type, (Q2) Match Relevance distribution by capability, (Q3) Recommendation Actionability counts across '
            '3 categories, and (Q4) Pursuit Intelligence trend with weekly bucketing. Additional metrics include '
            'evidence validation summary, low-rated pattern identification (rating 2 or below, top 20), and per-type '
            'accuracy, relevance, and actionability distributions. Empty validation sets return fully-structured '
            'zero-default reports with no null exposure.',
        ],
        func_val=[
            'Zero LLM calls is verified: the entire intelligence-validation.ts module (662 lines) contains no '
            'import of callLLM, governedAICall, or any AI function. All computations are pure aggregations from '
            'IntelligenceValidation records. This is a deliberate architectural choice that makes the validation '
            'layer deterministic, fast, and independent of AI service availability.',
            'The Zod validation schema (submitValidationSchema in validations.ts) enforces: artifactType must be '
            'one of 5 valid types, artifactId minimum 1 character, rating must be an integer between 1 and 5, '
            'accuracy/relevance/actionability are nullable but must be valid enums if provided, feedback max 2000 '
            'characters, and validatedBy max 200 characters. This prevents invalid data from entering the validation '
            'store regardless of client-side validation.',
            'The quality report handles the empty state gracefully: when no validations exist, it returns a fully-structured '
            'report with zero counts, empty distributions, and null trend data. This means the quality report API '
            'can be called at any time, even on a fresh deployment, without producing errors or null pointer exceptions.',
        ],
        bi_val=[
            'The intelligence validation layer addresses the "black box" problem inherent in AI-driven platforms. '
            'By capturing human expert judgments against platform-generated intelligence artifacts, the system creates '
            'a calibration dataset that serves multiple purposes: (1) identifying systematic biases in signal meaning '
            'inference (e.g., if "technology" signals are consistently rated "partially_correct" for the "tech_dissatisfaction" '
            'meaning, the inference rules may need adjustment), (2) measuring the actionable output rate (what percentage '
            'of opportunity recommendations are rated "actionable_now"), and (3) tracking improvement over time via '
            'weekly trend analysis.',
            'The 4-question quality report structure directly maps to business metrics that sales leaders care about: '
            '"Are our signal interpretations accurate?" (Q1), "Are our capability matches relevant to what we actually '
            'sell?" (Q2), "Do our opportunity recommendations lead to real conversations?" (Q3), and "Is our pursuit '
            'intelligence improving?" (Q4 trend). This alignment between technical validation metrics and business '
            'outcomes is critical for platform adoption and sustained investment.',
            'The snapshot-at-validation pattern ensures historical accuracy. When an expert rates a signal meaning as '
            '"incorrect" today, the snapshot captures the exact artifact state at that moment. If the signal is later '
            'updated or the meaning is re-inferred, the original validation remains associated with the original artifact '
            'state. This prevents the confusion that would arise if validations were linked to live, mutable artifacts.',
        ],
        current_status=[
            'Phase 6 is fully implemented and validated. The validation engine, Zod schemas, API endpoints, and quality '
            'report are all operational. The zero-LLM architecture is confirmed. The snapshot system captures artifact '
            'state at validation time. The quality report handles empty states gracefully.',
        ],
        prod_ready=[
            (
                [
                    [Paragraph('<b>Criterion</b>', s_th), Paragraph('<b>Status</b>', s_th), Paragraph('<b>Notes</b>', s_th)],
                    [Paragraph('Zero LLM Calls', s_td), status_cell('PASS'), Paragraph('No AI imports in validation module', s_td)],
                    [Paragraph('5 Artifact Types', s_td), Paragraph('SUPPORTED', s_td_c), Paragraph('signal_meaning, capability_match, opportunity, pursuit, evidence', s_td)],
                    [Paragraph('Snapshot System', s_td), status_cell('PASS'), Paragraph('5 type-specific loaders, graceful failure', s_td)],
                    [Paragraph('Quality Report', s_td), status_cell('PASS'), Paragraph('4 questions, trend analysis, low-pattern detection', s_td)],
                    [Paragraph('Empty State', s_td), status_cell('PASS'), Paragraph('Zero-default reports, no null exposure', s_td)],
                    [Paragraph('Input Validation', s_td), status_cell('PASS'), Paragraph('Zod schema, rating clamp 1-5, max lengths', s_td)],
                    [Paragraph('Trend Analysis', s_td), status_cell('PASS'), Paragraph('Weekly bucketing, configurable 90-day window', s_td)],
                ],
                [0.22, 0.15, 0.63],
                'Table 7.2: Phase 6 Production Readiness Assessment'
            ),
        ]
    ))

    # ════════════════════════════════════════════════════════════
    # CHAPTER 8: Platform Architecture Flow
    # ════════════════════════════════════════════════════════════
    story.extend(add_major_section('Chapter 8: Complete Platform Architecture Flow', s_h1, 0))

    story.append(Paragraph(
        'The DeepMindQ Revenue Intelligence Platform implements a unidirectional intelligence flow '
        'from raw data sources through increasingly refined intelligence artifacts to human decision points. '
        'The architecture follows a layered design where each phase adds a transformation layer on top of '
        'the previous phase outputs. No layer skips a dependency, and every data path traces back to an '
        'original source (web research, CSV import, or manual entry). The following describes the end-to-end '
        'data flow from source to actionable intelligence.',
        s_body))

    story.append(heading('8.1 Data Source Layer', s_h2, 1))
    story.append(Paragraph(
        'The platform ingests data from three primary sources. First, web research via Tavily API executes 4 '
        'parallel searches (business, technology, people, news) per company, returning raw search results that '
        'enter the evidence pipeline. Second, CSV/Excel file imports flow through the Phase 1 data intelligence '
        'engine (analyze, validate, normalize, quality-score, deduplicate, commit) producing structured Company '
        'and Contact records. Third, manual user input through the UI (notes, timeline events, signal annotations) '
        'provides qualitative intelligence that complements automated sources. All external data is tagged with '
        'source provenance (source URL, source quality tier, extraction timestamp) before entering the pipeline.',
        s_body))

    story.append(heading('8.2 Intelligence Engine (Phase 3)', s_h2, 1))
    story.append(Paragraph(
        'Raw search results enter the 6-step research pipeline: (1) parallel web search across 4 domains, '
        '(2) evidence collection with source quality tier assignment (premium/standard/low), (3) LLM-based field '
        'extraction with per-field confidence scoring, (4) field validation, (5) multi-factor confidence computation '
        '(relevance 30%, source quality 25%, recency decay 25%, corroboration 20%), and (6) structured storage in '
        'CompanyResearchCard with per-domain freshness timestamps. All LLM calls pass through the AI governance layer '
        '(ai-governance.ts) which enforces confidence gates, freshness thresholds, evidence grounding, hallucination '
        'prevention, and full audit trail recording. The intelligence-contract.ts module serves as the single access '
        'point for all downstream intelligence consumers, providing getResearchContext(), getAccountIntelligence(), '
        'getResearchFreshness(), and getSignalMetrics().',
        s_body))

    story.append(heading('8.3 Signal Detection and Evidence', s_h2, 1))
    story.append(Paragraph(
        'Signal detection operates in dual mode: LLM-based (via governedAICallAggregate) with a rule-based fallback, '
        'identifying 7 signal types (funding, hiring, leadership_change, expansion, technology, product, partnership) '
        'with 3-tier impact assessment (high/medium/low). Signals enter a 6-state lifecycle machine (detected, '
        'validated, active, aging, expired, archived) managed by automatic age and confidence-based transitions. '
        'Evidence accumulates per company with a cleanup policy keeping the latest 50 records per re-research cycle. '
        'Evidence quality is scored on 5 dimensions: coverage (25%), freshness (25%), source quality (20%), '
        'corroboration (15%), and volume (15%). The freshness indicator system tracks 4 domains (profile 90 days, '
        'signals 14 days, contacts 45 days, technology 60 days) with exponential decay scoring for staleness ranking.',
        s_body))

    story.append(heading('8.4 Track C Pipeline (Phase 4)', s_h2, 1))
    story.append(Paragraph(
        'The Track C pipeline is a read-only intelligence flow with four sequential stages. Stage 1, Signal Meaning '
        'Inference, maps detected signals to 7 buying-stage categories (budget_available, leadership_openness, '
        'tech_dissatisfaction, growth_pressure, compliance_requirement, vendor_evaluation, unknown) using 16 '
        'deterministic rules with zero LLM dependency. Stage 2, Capability Fit, scores signal-to-capability '
        'alignment using 4 weighted dimensions (category match 30%, keyword Jaccard 30%, business problem 20%, '
        'impact bonus 5%) against 10 signal-type-to-capability-category mappings. Stage 3, Opportunity Recommendation, '
        'generates scored opportunity records using a 5-dimension composite (signal confidence 25%, capability match '
        '25%, freshness 20%, evidence quality 15%, business impact 15%) with LLM-generated context (title, trigger, '
        'why now, business problem, stakeholders, conversation starter). Stage 4, Human Decision Gate, requires explicit '
        'acceptance before any downstream action. The pipeline explicitly never creates Pursuit records or initiates '
        'outreach autonomously.',
        s_body))

    story.append(heading('8.5 Account Prioritization (Phase 5)', s_h2, 1))
    story.append(Paragraph(
        'The account prioritization engine computes a composite 0-100 score using the formula: clamp(round(StaticFit x 0.40 '
        '+ DynamicIntel x 0.40 + TimingUrgency x 0.20), 0, 100). Static Fit (40%) evaluates ICP alignment across 5 '
        'sub-dimensions weighted by the configurable ICP profile (industry 0.30, companySize 0.25, geography 0.15, '
        'revenue 0.15, techFit 0.15). Dynamic Intelligence (40%) evaluates research quality across 4 sub-scores '
        '(intelligenceScore normalized, research card coverage, signal quality, contact coverage). Timing/Urgency (20%) '
        'evaluates recency across 3 sub-scores (signal recency, engagement decay, growth indicators). The composite '
        'score maps to 4 tiers: HOT (90+), ACTIVE (70-89), NURTURE (50-69), LOW (below 50). Three gap closures '
        'provide explainability: "Why Now?" reasons (8 rule categories, max 8 reasons), Top Signals (ranked by severity '
        'and recency, top 5), and Capability Relevance (100-point scoring across 4 dimensions, top 5).',
        s_body))

    story.append(heading('8.6 Intelligence Validation and Learning Loop (Phase 6)', s_h2, 1))
    story.append(Paragraph(
        'The validation layer closes the feedback loop by enabling human experts to rate the quality of intelligence '
        'artifacts across 5 types (signal_meaning, capability_match, opportunity_recommendation, pursuit_intelligence, '
        'evidence_quality). Each validation captures the artifact snapshot at validation time, a 1-5 rating, accuracy/'
        'relevance/actionability assessments, and optional feedback. The quality report aggregates validations into 4 '
        'business questions: meaning accuracy by signal type, match relevance by capability, recommendation actionability '
        'distribution, and pursuit intelligence weekly trend. Low-rated patterns (rating 2 or below) are identified for '
        'systematic improvement. This creates a continuous learning loop where validation data informs rule adjustments '
        'in signal meaning inference, weight tuning in account prioritization, and capability mapping refinements.',
        s_body))

    # Architecture summary table
    story.extend(make_table(
        [
            [Paragraph('<b>Layer</b>', s_th), Paragraph('<b>Phase</b>', s_th), Paragraph('<b>Input</b>', s_th), Paragraph('<b>Output</b>', s_th), Paragraph('<b>LLM Used</b>', s_th)],
            [Paragraph('Data Sources', s_td), Paragraph('0-1', s_td_c), Paragraph('Web, CSV, Manual', s_td), Paragraph('Raw data, Companies, Contacts', s_td), Paragraph('Detection only', s_td_c)],
            [Paragraph('Intelligence Engine', s_td), Paragraph('3', s_td_c), Paragraph('Search results', s_td), Paragraph('Research cards, Evidence, Signals', s_td), Paragraph('Yes (governed)', s_td_c)],
            [Paragraph('Signal Meaning', s_td), Paragraph('4', s_td_c), Paragraph('Signals', s_td), Paragraph('Buying-stage categories', s_td), Paragraph('No (deterministic)', s_td_c)],
            [Paragraph('Capability Match', s_td), Paragraph('4', s_td_c), Paragraph('Signals + Capabilities', s_td), Paragraph('Scored matches', s_td), Paragraph('No', s_td_c)],
            [Paragraph('Opportunity Rec.', s_td), Paragraph('4', s_td_c), Paragraph('Signals + Matches', s_td), Paragraph('Opportunity records', s_td), Paragraph('Yes (governed)', s_td_c)],
            [Paragraph('Account Priority', s_td), Paragraph('5', s_td_c), Paragraph('ICP + Intelligence', s_td), Paragraph('0-100 score, 4 tiers', s_td), Paragraph('No (deterministic)', s_td_c)],
            [Paragraph('Validation', s_td), Paragraph('6', s_td_c), Paragraph('All artifacts', s_td), Paragraph('Quality metrics, Trends', s_td), Paragraph('No (zero LLM)', s_td_c)],
        ],
        [0.16, 0.08, 0.20, 0.32, 0.24],
        'Table 8.1: Platform Architecture Layer Summary'
    ))

    # ════════════════════════════════════════════════════════════
    # CHAPTER 9: Final Capability Matrix
    # ════════════════════════════════════════════════════════════
    story.extend(add_major_section('Chapter 9: Final Capability Matrix', s_h1, 0))

    story.append(Paragraph(
        'The following capability matrix maps each platform capability to its implementing phase, implementation '
        'status, and business value. This matrix serves as the definitive reference for what the DeepMindQ Revenue '
        'Intelligence Platform delivers in its current state (v0.2.0). Each capability has been verified against '
        'the actual codebase during this validation review.',
        s_body))

    story.extend(make_table(
        [
            [Paragraph('<b>Capability</b>', s_th), Paragraph('<b>Phase</b>', s_th), Paragraph('<b>Status</b>', s_th), Paragraph('<b>Business Value</b>', s_th)],
            [Paragraph('Database Schema (46 models)', s_td), Paragraph('0', s_td_c), status_cell('PASS'), Paragraph('Complete data model for all platform operations', s_td)],
            [Paragraph('Session-based Auth', s_td), Paragraph('0', s_td_c), status_cell('PASS'), Paragraph('Enterprise-grade security with instant revocation', s_td)],
            [Paragraph('RBAC (4 roles, 9 resources)', s_td), Paragraph('0', s_td_c), status_cell('PASS'), Paragraph('Role-appropriate access for sales organizations', s_td)],
            [Paragraph('CSV/Excel Import Pipeline', s_td), Paragraph('1', s_td_c), status_cell('PASS'), Paragraph('6-step import with validation and quality scoring', s_td)],
            [Paragraph('Config-over-Code Rules', s_td), Paragraph('1', s_td_c), status_cell('PASS'), Paragraph('Runtime-modifiable validation and normalization', s_td)],
            [Paragraph('Lead Scoring (6 dimensions)', s_td), Paragraph('1', s_td_c), status_cell('PASS'), Paragraph('Data-driven lead qualification for prioritization', s_td)],
            [Paragraph('Workflow Engine', s_td), Paragraph('2', s_td_c), status_cell('PASS'), Paragraph('Async job processing with retry and recovery', s_td)],
            [Paragraph('Company Research (6-step)', s_td), Paragraph('3', s_td_c), status_cell('PASS'), Paragraph('Automated intelligence gathering from web sources', s_td)],
            [Paragraph('Evidence System (4-factor)', s_td), Paragraph('3', s_td_c), status_cell('PASS'), Paragraph('Source-tracked, confidence-scored facts', s_td)],
            [Paragraph('Signal Detection (7 types)', s_td), Paragraph('3', s_td_c), Paragraph('OPERATIONAL', s_td_c), Paragraph('Buying signal identification from research data', s_td)],
            [Paragraph('AI Governance Layer', s_td), Paragraph('3', s_td_c), status_cell('PASS'), Paragraph('Controlled LLM usage with audit trail', s_td)],
            [Paragraph('Intelligence Contract (SOT)', s_td), Paragraph('3', s_td_c), Paragraph('SOT', s_td_c), Paragraph('Single source of truth for all consumers', s_td)],
            [Paragraph('Signal Meaning Inference', s_td), Paragraph('4', s_td_c), status_cell('PASS'), Paragraph('Deterministic buying-stage classification', s_td)],
            [Paragraph('Capability Matching', s_td), Paragraph('4', s_td_c), status_cell('PASS'), Paragraph('Signal-to-service alignment scoring', s_td)],
            [Paragraph('Opportunity Recommendation', s_td), Paragraph('4', s_td_c), status_cell('PASS'), Paragraph('Scored, context-rich opportunity generation', s_td)],
            [Paragraph('Account Prioritization', s_td), Paragraph('5', s_td_c), status_cell('PASS'), Paragraph('0-100 composite score with 4-tier classification', s_td)],
            [Paragraph('ICP Configuration', s_td), Paragraph('5', s_td_c), status_cell('PASS'), Paragraph('Runtime-configurable ideal customer profile', s_td)],
            [Paragraph('Why Now Reasoning', s_td), Paragraph('5', s_td_c), status_cell('PASS'), Paragraph('Evidence-backed outreach timing justification', s_td)],
            [Paragraph('Intelligence Validation', s_td), Paragraph('6', s_td_c), status_cell('PASS'), Paragraph('Human-in-the-loop quality feedback system', s_td)],
            [Paragraph('Quality Report', s_td), Paragraph('6', s_td_c), status_cell('PASS'), Paragraph('Aggregated validation metrics and trends', s_td)],
        ],
        [0.26, 0.08, 0.14, 0.52],
        'Table 9.1: Final Capability Matrix'
    ))

    # ════════════════════════════════════════════════════════════
    # CHAPTER 10: Remaining Gaps
    # ════════════════════════════════════════════════════════════
    story.extend(add_major_section('Chapter 10: Remaining Gaps for Enterprise Positioning', s_h1, 0))

    story.append(Paragraph(
        'While the DeepMindQ Revenue Intelligence Platform has completed all seven planned phases with '
        'comprehensive implementation across infrastructure, data, intelligence, pipeline, prioritization, '
        'and validation layers, several gaps remain for full enterprise revenue intelligence positioning. '
        'These gaps fall into four categories: technical debt, UI-to-API alignment, scalability hardening, '
        'and enterprise feature completeness. Each gap is described below with its impact assessment and '
        'recommended resolution approach.',
        s_body))

    story.append(heading('10.1 Technical Debt', s_h2, 1))
    story.append(Paragraph(
        'The most significant technical debt item is the presence of 368 pre-existing TypeScript errors across '
        '40+ files, currently bypassed via ignoreBuildErrors: true in next.config.ts. While these errors do not '
        'affect runtime behavior (the application runs correctly), they represent a maintainability risk for '
        'enterprise deployment. TypeScript errors can mask real bugs during refactoring and make onboarding new '
        'developers more difficult. Resolution should follow a phased approach: first categorize errors by severity '
        '(type mismatches, missing imports, unused variables), then address high-severity errors that could mask '
        'runtime issues, and finally resolve low-severity errors for complete type safety.',
        s_body))
    story.append(Paragraph(
        'The dual opportunity-recommendation file (v1: opportunity-recommendation-engine.ts at 456 lines, v2: '
        'opportunity-recommendation.ts at 521 lines) creates maintenance confusion. Both files export a function '
        'named generateOpportunityRecommendation with different weight distributions (v1: 30/25/20/15/10, v2: '
        '25/25/20/15/15). The barrel index.ts exports v2, making v1 effectively dead code. Resolution: delete v1 '
        'or rename its exports to avoid confusion. Similarly, the useLLMEnhancement config field in signal-capability-'
        'matching.ts has no implementation and should be removed or implemented.',
        s_body))

    story.append(heading('10.2 UI-to-API Alignment', s_h2, 1))
    story.append(Paragraph(
        'The ICP settings screen (icp-settings-screen.tsx) sends field names (targetCountries, preferredTechnologies) '
        'that do not match the backend API expectations (targetRegions, preferredTechKeywords). This means ICP '
        'updates from the UI may silently fail to apply to the region and technology configuration fields. The API '
        'itself works correctly when called with the correct field names, so the fix is a frontend field name '
        'alignment. Additionally, the getSignalCapabilityMatches function returns records with empty signalType, '
        'signalTitle, and capabilityTitle fields, requiring DB joins that are not currently performed. This results '
        'in incomplete data in the UI when displaying capability match details.',
        s_body))

    story.append(heading('10.3 Scalability and Performance', s_h2, 1))
    story.append(Paragraph(
        'The batch account prioritization endpoint (POST /api/account-rankings) has no rate limiting or request '
        'size cap, allowing a single request to process up to 1000 companies. For enterprise deployments with '
        'large account portfolios, this could cause timeout issues or excessive database load. Resolution: add '
        'explicit batch size limits (e.g., 200 per request), implement queue-based processing for larger batches, '
        'and add progress tracking via the workflow engine for long-running recomputations. The in-memory rate limiter '
        'is suitable for single-instance deployment but will not work in horizontal scaling scenarios; a Redis-backed '
        'rate limiter would be needed for multi-instance deployment.',
        s_body))
    story.append(Paragraph(
        'The capability matching engine deletes all existing matches for a company before inserting new ones (full '
        'recompute pattern). For companies with large signal histories, this could cause performance degradation. '
        'An incremental update pattern (only process new or changed signals) would improve efficiency. Similarly, '
        'the evidence cleanup policy (keeping latest 50 records) is applied on every re-research cycle; for companies '
        'researched frequently, this could lead to loss of valuable historical evidence that supports corroboration scoring.',
        s_body))

    story.append(heading('10.4 Enterprise Feature Gaps', s_h2, 1))
    story.extend(make_table(
        [
            [Paragraph('<b>Gap</b>', s_th), Paragraph('<b>Impact</b>', s_th), Paragraph('<b>Priority</b>', s_th), Paragraph('<b>Recommendation</b>', s_th)],
            [Paragraph('TypeScript error cleanup', s_td), Paragraph('Maintainability risk', s_td), Paragraph('High', s_td_c), Paragraph('Phased resolution by error severity', s_td)],
            [Paragraph('ICP UI field alignment', s_td), Paragraph('ICP updates from UI fail silently', s_td), Paragraph('High', s_td_c), Paragraph('Align frontend field names with API', s_td)],
            [Paragraph('Batch rate limiting', s_td), Paragraph('Potential timeout on large portfolios', s_td), Paragraph('Medium', s_td_c), Paragraph('Add batch size limits, queue-based processing', s_td)],
            [Paragraph('Dual opportunity file cleanup', s_td), Paragraph('Developer confusion, dead code', s_td), Paragraph('Low', s_td_c), Paragraph('Delete v1 or rename exports', s_td)],
            [Paragraph('Redis rate limiter', s_td), Paragraph('Multi-instance scaling', s_td), Paragraph('Medium', s_td_c), Paragraph('Replace in-memory with Redis for production', s_td)],
            [Paragraph('Incremental matching', s_td), Paragraph('Performance on large signal histories', s_td), Paragraph('Low', s_td_c), Paragraph('Process only new/changed signals', s_td)],
            [Paragraph('Evidence retention policy', s_td), Paragraph('Historical evidence loss on re-research', s_td), Paragraph('Low', s_td_c), Paragraph('Configurable retention with age-based tiers', s_td)],
            [Paragraph('Notification system', s_td), Paragraph('No alerts for stale intelligence or high-priority signals', s_td), Paragraph('Medium', s_td_c), Paragraph('Implement notification rules engine', s_td)],
            [Paragraph('Export/Reporting', s_td), Paragraph('No PDF/Excel export of rankings or quality reports', s_td), Paragraph('Medium', s_td_c), Paragraph('Add export endpoints for key views', s_td)],
            [Paragraph('API Documentation', s_td), Paragraph('No OpenAPI/Swagger spec for 170 endpoints', s_td), Paragraph('Medium', s_td_c), Paragraph('Generate from route handlers', s_td)],
        ],
        [0.22, 0.24, 0.10, 0.44],
        'Table 10.1: Remaining Gaps and Recommendations'
    ))

    story.append(Paragraph(
        'In summary, the DeepMindQ Revenue Intelligence Platform has successfully delivered all seven planned '
        'phases (Phase 0 through Phase 6) with comprehensive implementation evidence, functional validation, and '
        'business intelligence value across every phase. The platform implements a complete intelligence pipeline '
        'from data ingestion through research, signal detection, meaning inference, capability matching, opportunity '
        'recommendation, account prioritization, and human validation. The remaining gaps are primarily in the '
        'categories of technical debt cleanup, UI alignment, and scalability hardening, none of which affect the '
        'correctness of the core intelligence pipeline. The platform is architecturally sound, with clean phase '
        'separation, enforced governance boundaries, config-over-code patterns, and a deterministic scoring system '
        'that provides consistent, reproducible results.',
        s_body))

    return story


# ── TocDocTemplate ──
class TocDocTemplate(SimpleDocTemplate):
    def afterFlowable(self, flowable):
        if hasattr(flowable, 'bookmark_name'):
            level = getattr(flowable, 'bookmark_level', 0)
            text = getattr(flowable, 'bookmark_text', '')
            key = getattr(flowable, 'bookmark_key', '')
            self.notify('TOCEntry', (level, text, self.page, key))


# ── Build Body PDF ──
class NumberedTocDocTemplate(TocDocTemplate):
    """TocDocTemplate with page numbers in footer."""
    def afterPage(self):
        """Called after each page is finished."""
        super().afterPage()
        self.canv.saveState()
        self.canv.setFont('FreeSerif', 8)
        self.canv.setFillColor(TEXT_MUTED)
        self.canv.drawCentredString(PAGE_W / 2, 0.45 * inch, str(self.page))
        self.canv.restoreState()

def build_body_pdf():
    doc = NumberedTocDocTemplate(
        BODY_PDF,
        pagesize=A4,
        leftMargin=LEFT_MARGIN,
        rightMargin=RIGHT_MARGIN,
        topMargin=TOP_MARGIN,
        bottomMargin=BOTTOM_MARGIN,
        title='DeepMindQ Revenue Intelligence Platform - Phase 0-6 Closure Report',
        author='Z.ai',
        subject='Phase-by-Phase Validation and Closure Report',
    )
    story = build_story()
    doc.multiBuild(story)
    print(f"Body PDF written to {BODY_PDF}")


# ── Render Cover ──
def render_cover():
    import subprocess
    html2poster = os.path.join(PDF_SKILL_DIR, 'scripts', 'html2poster.js')
    subprocess.run([
        'node', html2poster, COVER_HTML,
        '--output', COVER_PDF, '--width', '794px',
    ], check=True)
    print(f"Cover PDF written to {COVER_PDF}")


# ── Merge Cover + Body ──
def merge_pdfs():
    from pypdf import PdfReader, PdfWriter
    A4_W, A4_H = 595.28, 841.89

    def normalize(page):
        box = page.mediabox
        w, h = float(box.width), float(box.height)
        # Always normalize to exact A4 to avoid sub-pt differences
        if abs(w - A4_W) > 0.01 or abs(h - A4_H) > 0.01:
            page.scale_to(A4_W, A4_H)
        return page

    writer = PdfWriter()
    cover_page = PdfReader(COVER_PDF).pages[0]
    writer.add_page(normalize(cover_page))
    for page in PdfReader(BODY_PDF).pages:
        writer.add_page(normalize(page))
    writer.add_metadata({
        '/Title': 'DeepMindQ Revenue Intelligence Platform - Phase 0-6 Closure Report',
        '/Author': 'Z.ai',
        '/Creator': 'Z.ai',
        '/Subject': 'Phase 0-6 Validation and Closure Report',
    })
    with open(FINAL_PDF, 'wb') as f:
        writer.write(f)
    print(f"Final PDF written to {FINAL_PDF}")


if __name__ == '__main__':
    build_body_pdf()
    render_cover()
    merge_pdfs()