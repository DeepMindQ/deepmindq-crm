#!/usr/bin/env python3
"""
DeepMindQ Revenue Intelligence Platform - Phase 0-6 Closure Report
Generates a comprehensive validation review PDF via ReportLab.
"""
import os, sys, subprocess
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm, cm
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY, TA_RIGHT
from reportlab.lib import colors
from reportlab.platypus import (
    Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether,
    SimpleDocTemplate, HRFlowable
)
from reportlab.platypus.tableofcontents import TableOfContents
from reportlab.platypus.doctemplate import PageTemplate, BaseDocTemplate, Frame
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase.pdfmetrics import registerFontFamily

# ━━ Cascade Palette ━━
PAGE_BG       = colors.HexColor('#f0f0ef')
SECTION_BG    = colors.HexColor('#eaeae8')
CARD_BG       = colors.HexColor('#f0eeeb')
TABLE_STRIPE  = colors.HexColor('#f1f0ed')
HEADER_FILL   = colors.HexColor('#786d4d')
COVER_BLOCK   = colors.HexColor('#635a41')
BORDER        = colors.HexColor('#c8c3b3')
ICON          = colors.HexColor('#847546')
ACCENT        = colors.HexColor('#8b7226')
ACCENT_2      = colors.HexColor('#6745cd')
TEXT_PRIMARY   = colors.HexColor('#242320')
TEXT_MUTED     = colors.HexColor('#8e8c85')
SEM_SUCCESS   = colors.HexColor('#3f7651')
SEM_WARNING   = colors.HexColor('#9f8147')
SEM_ERROR     = colors.HexColor('#a15149')
SEM_INFO      = colors.HexColor('#4978a7')

# ━━ Font Setup ━━
FONT_DIR = '/usr/share/fonts'
pdfmetrics.registerFont(TTFont('NotoSerifSC', f'{FONT_DIR}/truetype/noto-serif-sc/NotoSerifSC-Regular.ttf'))
pdfmetrics.registerFont(TTFont('NotoSerifSC-Bold', f'{FONT_DIR}/truetype/noto-serif-sc/NotoSerifSC-Bold.ttf'))
registerFontFamily('NotoSerifSC', normal='NotoSerifSC', bold='NotoSerifSC-Bold')
pdfmetrics.registerFont(TTFont('FreeSerif', f'{FONT_DIR}/truetype/freefont/FreeSerif.ttf'))
pdfmetrics.registerFont(TTFont('FreeSerifBold', f'{FONT_DIR}/truetype/freefont/FreeSerifBold.ttf'))
pdfmetrics.registerFont(TTFont('FreeSerifItalic', f'{FONT_DIR}/truetype/freefont/FreeSerifItalic.ttf'))
pdfmetrics.registerFont(TTFont('DejaVuSans', f'{FONT_DIR}/truetype/dejavu/DejaVuSans.ttf'))
pdfmetrics.registerFont(TTFont('DejaVuSansBold', f'{FONT_DIR}/truetype/dejavu/DejaVuSans-Bold.ttf'))
registerFontFamily('FreeSerif', normal='FreeSerif', bold='FreeSerifBold', italic='FreeSerifItalic')

# ━━ Font Fallback ━━
from reportlab.pdfbase.ttfonts import TTFont as _TTFont
from reportlab.platypus.paragraph import Paragraph as _Para
_orig_init = _Para.__init__

def _patched_init(self, text, style=None, **kw):
    _orig_init(self, text, style, **kw)

_Para.__init__ = _patched_init

# ━━ Output paths ━━
OUTPUT_DIR = '/home/z/my-project/download'
BODY_PDF = os.path.join(OUTPUT_DIR, '_phase_closure_body.pdf')
COVER_HTML = os.path.join(OUTPUT_DIR, '_phase_closure_cover.html')
COVER_PDF = os.path.join(OUTPUT_DIR, '_phase_closure_cover.pdf')
FINAL_PDF = os.path.join(OUTPUT_DIR, 'DeepMindQ_Phase_0-6_Closure_Report.pdf')

# ━━ Styles ━━
sH1 = ParagraphStyle('H1', fontName='FreeSerifBold', fontSize=20, leading=26,
    spaceBefore=18, spaceAfter=10, textColor=HEADER_FILL)
sH2 = ParagraphStyle('H2', fontName='FreeSerifBold', fontSize=14, leading=19,
    spaceBefore=14, spaceAfter=6, textColor=TEXT_PRIMARY)
sH3 = ParagraphStyle('H3', fontName='FreeSerifBold', fontSize=11.5, leading=16,
    spaceBefore=10, spaceAfter=4, textColor=ICON)
sBody = ParagraphStyle('Body', fontName='FreeSerif', fontSize=10.5, leading=17,
    spaceBefore=0, spaceAfter=6, alignment=TA_JUSTIFY, textColor=TEXT_PRIMARY)
sBodyLeft = ParagraphStyle('BodyLeft', parent=sBody, alignment=TA_LEFT)
sBullet = ParagraphStyle('Bullet', parent=sBody, leftIndent=18, bulletIndent=6,
    spaceBefore=1, spaceAfter=2)
sSmall = ParagraphStyle('Small', fontName='FreeSerif', fontSize=9, leading=13,
    textColor=TEXT_MUTED, spaceBefore=0, spaceAfter=3)
sTableHeader = ParagraphStyle('TH', fontName='FreeSerifBold', fontSize=9.5,
    leading=13, textColor=colors.white, alignment=TA_CENTER)
sTableCell = ParagraphStyle('TC', fontName='FreeSerif', fontSize=9,
    leading=13, textColor=TEXT_PRIMARY, alignment=TA_LEFT)
sTableCellC = ParagraphStyle('TCC', parent=sTableCell, alignment=TA_CENTER)
sCaption = ParagraphStyle('Caption', fontName='FreeSerifItalic', fontSize=9,
    leading=12, textColor=TEXT_MUTED, alignment=TA_CENTER, spaceBefore=3, spaceAfter=6)

# TOC styles
toc_level0 = ParagraphStyle('TOC0', fontName='FreeSerifBold', fontSize=12, leading=20,
    leftIndent=0, spaceBefore=6, spaceAfter=2, textColor=TEXT_PRIMARY)
toc_level1 = ParagraphStyle('TOC1', fontName='FreeSerif', fontSize=10.5, leading=17,
    leftIndent=20, spaceBefore=1, spaceAfter=1, textColor=TEXT_MUTED)

# ━━ Helpers ━━
def h1(text):
    p = Paragraph(f'<b>{text}</b>', sH1)
    p.bookmark_name = text; p.bookmark_level = 0; p.bookmark_text = text
    return p

def h2(text):
    p = Paragraph(f'<b>{text}</b>', sH2)
    p.bookmark_name = text; p.bookmark_level = 1; p.bookmark_text = text
    return p

def h3(text):
    return Paragraph(f'<b>{text}</b>', sH3)

def body(text):
    return Paragraph(text, sBody)

def bullet(text):
    return Paragraph(f'<bullet>&bull;</bullet> {text}', sBullet)

def small(text):
    return Paragraph(text, sSmall)

def make_table(headers, rows, col_widths=None, caption=None):
    """Create a styled table with Paragraph cells."""
    avail = 455
    n = len(headers)
    if col_widths is None:
        col_widths = [avail / n] * n
    else:
        scale = 1
        if sum(col_widths) > avail:
            scale = avail / sum(col_widths)
        col_widths = [w * scale for w in col_widths]

    data = [[Paragraph(f'<b>{h}</b>', sTableHeader) for h in headers]]
    for row in rows:
        data.append([Paragraph(str(c), sTableCell) if i == 0 else Paragraph(str(c), sTableCellC) for i, c in enumerate(row)])

    t = Table(data, colWidths=col_widths, hAlign='CENTER')
    style_cmds = [
        ('BACKGROUND', (0, 0), (-1, 0), HEADER_FILL),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('GRID', (0, 0), (-1, -1), 0.4, BORDER),
    ]
    for i in range(1, len(data)):
        bg = colors.white if i % 2 == 1 else TABLE_STRIPE
        style_cmds.append(('BACKGROUND', (0, i), (-1, i), bg))
    t.setStyle(TableStyle(style_cmds))

    elements = [Spacer(1, 8), t]
    if caption:
        elements.append(Paragraph(caption, sCaption))
    elements.append(Spacer(1, 8))
    return elements

def status_table(status, deferred=None, limitations=None, debt=None):
    """Build a compact status table for each phase."""
    rows = [['Status', status]]
    if deferred:
        rows.append(['Deferred', deferred])
    if limitations:
        rows.append(['Known Limitations', limitations])
    if debt:
        rows.append(['Technical Debt', debt])
    return make_table(['Item', 'Detail'], rows, col_widths=[120, 340], caption=None)

# ━━ TocDocTemplate ━━
class TocDocTemplate(SimpleDocTemplate):
    def afterFlowable(self, flowable):
        if hasattr(flowable, 'bookmark_name'):
            level = getattr(flowable, 'bookmark_level', 0)
            text = getattr(flowable, 'bookmark_text', '')
            key = getattr(flowable, 'bookmark_key', '')
            self.notify('TOCEntry', (level, text, self.page, key))

# ━━ Page number footer ━━
def page_footer(canvas, doc):
    canvas.saveState()
    canvas.setFont('FreeSerif', 8)
    canvas.setFillColor(TEXT_MUTED)
    canvas.drawRightString(A4[0] - 40*mm, 15*mm, f'{doc.page}')
    canvas.setFont('FreeSerif', 7)
    canvas.drawString(40*mm, 15*mm, 'DeepMindQ Revenue Intelligence Platform')
    canvas.restoreState()

# ━━ BUILD DOCUMENT ━━
def build_body():
    story = []

    # ── TOC ──
    toc = TableOfContents()
    toc.levelStyles = [toc_level0, toc_level1]
    story.append(toc)
    story.append(PageBreak())

    # ══════════════════════════════════════════════════════════════
    # CHAPTER 1: PHASE 0 - FOUNDATION & DATA MODEL
    # ══════════════════════════════════════════════════════════════
    story.append(h1('Chapter 1: Phase 0 - Foundation and Data Model'))

    story.append(h2('1.1 Phase Objective'))
    story.append(body(
        'Phase 0 establishes the foundational data model, authentication system, and application shell that every subsequent phase builds upon. '
        'Without a robust schema and identity layer, no intelligence engine, scoring algorithm, or outreach workflow can function reliably. '
        'This phase solves the fundamental business problem of <b>trustworthy data custody</b>: ensuring that every company record, contact profile, '
        'and interaction event is stored with referential integrity, auditability, and secure access control. In an IT Services and Consulting context, '
        'where data sensitivity is paramount and regulatory compliance (GDPR, CAN-SPAM) is non-negotiable, the foundation must be rock-solid before '
        'any intelligence is layered on top.'
    ))
    story.append(body(
        'The capability is required because every downstream feature depends on the schema. Phase 1 needs DataUpload and UploadRow models to persist '
        'import pipelines. Phase 2 needs Job and JobLog models for workflow orchestration. Phase 3 needs Evidence, CompanySignal, and CompanyResearchCard '
        'for research intelligence. Phase 4 needs OpportunityRecommendation and Pursuit models. Phase 5 needs SystemSetting for ICP persistence. '
        'Phase 6 needs IntelligenceValidation. The entire platform is a stack of interdependent data structures, and Phase 0 defines the base of that stack.'
    ))

    story.append(h2('1.2 Implementation Evidence'))

    story.append(h3('Files Created'))
    story.append(bullet('<b>prisma/schema.prisma</b> - 1,239 lines, 32 models, PostgreSQL datasource'))
    story.append(bullet('<b>src/lib/db.ts</b> - Prisma client singleton with Neon serverless adapter'))
    story.append(bullet('<b>src/app/layout.tsx</b> - Root layout with auth provider, theme provider, toast system'))
    story.append(bullet('<b>src/app/page.tsx</b> - Landing page and authenticated dashboard routing'))
    story.append(bullet('<b>src/app/landing-page.tsx</b> - Public marketing landing page'))
    story.append(bullet('<b>src/components/login-page.tsx</b> - Authentication UI with OTP flow'))
    story.append(bullet('<b>src/components/app-shell.tsx</b> - Main application shell with sidebar navigation'))
    story.append(bullet('<b>src/providers/auth-provider.tsx</b> - Session-based authentication context'))
    story.append(bullet('<b>src/lib/session.ts</b> - Session management with token validation'))
    story.append(bullet('<b>src/lib/rbac.ts</b> - Role-based access control (admin/user roles)'))
    story.append(bullet('<b>src/middleware.ts</b> - Route protection middleware'))

    story.append(h3('Database Schema (Core Models)'))
    story.extend(make_table(
        ['Model', 'Purpose', 'Key Fields'],
        [
            ['Company', 'Target account entity', 'industry, sizeRange, country, intelligenceScore, accountPriorityScore, priorityTier'],
            ['Contact', 'Individual prospect', 'email, title, role, leadScore, consentStatus, emailHealth, enrichmentData'],
            ['ImportBatch', 'Legacy bulk import tracking', 'fileName, totalRows, acceptedRows, status'],
            ['CompanyResearchCard', 'Enriched intelligence store', 'revenue, employeeCount, techStack, keyPeople, fieldConfidence, strategicPriorities'],
            ['CompanySignal', 'Buying signal detection', 'signalType, severity, impact, meaningCategory, status, evidenceIds'],
            ['Evidence', 'Source-backed fact tracking', 'sourceUrl, extractedField, confidence, sourceQualityTier, status'],
            ['CapabilityAsset', 'Service/solution knowledge base', 'category, serviceLine, businessProblem, keywords, caseStudyRef'],
            ['User / Session / OtpCode', 'Auth system', 'email, role, passwordHash, token, expiresAt'],
        ],
        col_widths=[90, 130, 240]
    ))

    story.append(h2('1.3 Functional Validation'))
    story.append(body(
        'The end-to-end flow begins when a new user visits the platform. The middleware intercepts unauthenticated requests and redirects to the login page, '
        'where an OTP is sent to the user\'s email via the Resend integration. Upon verification, a Session record is created with an opaque token stored '
        'as an HTTP-only cookie. The auth provider makes the session available throughout the React component tree, and the app shell renders the appropriate '
        'navigation sidebar with role-gated menu items. An admin sees all screens including settings and audit logs; a standard user sees a restricted view.'
    ))
    story.append(body(
        'Company and contact data enters the system through CSV/Excel import (Phase 1) or manual creation. Every record is immediately queryable through '
        'the API layer, which uses Prisma\'s type-safe query builder. The schema enforces referential integrity: deleting a Company cascades to its Contacts, '
        'Signals, Evidence, and Notes. Indexes on frequently queried fields (domain, industry, status, email, priorityTier) ensure sub-100ms query response '
        'times even at scale. In a real scenario, an SDR imports a list of 500 contacts from a conference, the system normalizes company names, deduplicates '
        'against existing records, and creates the full Company + Contact graph ready for enrichment.'
    ))

    story.append(h2('1.4 Business Intelligence Validation'))
    story.append(body(
        'Phase 0 enables the critical decision of <b>"which accounts and contacts should we invest time in?"</b> by providing a structured, queryable data '
        'foundation. Without normalized company records with industry, size, and geography fields, no scoring model can differentiate a $50M fintech from a '
        '$5M retail shop. Without contact records with email health status and consent tracking, no outreach can happen legally. The audit log model '
        'means every data change is traceable, answering the compliance question "who changed this record and when?" This is not merely a technical feature; '
        'it is the data custody backbone that makes the entire concept of revenue intelligence trustworthy and defensible.'
    ))

    story.append(h2('1.5 Current Status'))
    story.extend(status_table(
        'Completed',
        deferred='Multi-tenant isolation (single-instance by design)',
        limitations='No role-permission matrix beyond admin/user; no field-level permissions',
        debt='Some early components use mock data in development mode; production uses live DB'
    ))

    story.append(h2('1.6 Production Readiness'))
    story.append(body(
        'Build succeeds on Vercel via <b>vercel-build</b> script which runs <b>prisma db push --accept-data-loss</b> followed by <b>next build</b>. '
        'Database migrations are handled via Prisma\'s schema push (no migration files needed for this dedicated-instance architecture). '
        'The PostgreSQL database is hosted on Neon with serverless driver for cold-start efficiency. Security considerations include: HTTP-only session '
        'cookies, OTP-based authentication (no password reuse risk), rate limiting on auth endpoints, and CSP headers. The ESLint configuration includes '
        'a custom <b>no-ungoverned-llm</b> rule that prevents any file except <b>ai-governance.ts</b> from importing <b>callLLM</b> directly.'
    ))

    # ══════════════════════════════════════════════════════════════
    # CHAPTER 2: PHASE 1 - DATA INTELLIGENCE ENGINE
    # ══════════════════════════════════════════════════════════════
    story.append(PageBreak())
    story.append(h1('Chapter 2: Phase 1 - Data Intelligence Engine'))

    story.append(h2('2.1 Phase Objective'))
    story.append(body(
        'Phase 1 solves the business problem of <b>garbage in, garbage out</b> at the data ingestion layer. In IT Services consulting, prospect data '
        'arrives in inconsistent formats: spreadsheets from conferences, CRM exports, LinkedIn Sales Navigator downloads, and purchased lists. Each source '
        'has different column names, value formats, and quality levels. Without an intelligent ingestion pipeline, the platform would be populated with '
        'duplicate companies, malformed emails, inconsistent industry labels (e.g., "FinTech" vs "Financial Technology" vs "fintech"), and unreliable '
        'size ranges. Phase 1 transforms raw, messy data into clean, normalized, scored, and deduplicated records that every downstream intelligence '
        'engine can trust.'
    ))
    story.append(body(
        'The capability is required because the quality of intelligence output is directly proportional to the quality of input data. A company enrichment '
        'engine (Phase 3) searching for "Acme Corp" will fail if the database has three variations: "ACME Corporation", "acme corp", and "Acme Corp." '
        'A lead scoring model (Phase 2) will produce meaningless scores if industry values are not normalized. An account prioritization engine (Phase 5) '
        'cannot match against the ICP if company size ranges are inconsistent. Data intelligence is the foundation upon which all intelligence is built.'
    ))

    story.append(h2('2.2 Implementation Evidence'))

    story.append(h3('Core Engine Files'))
    story.append(bullet('<b>src/lib/data-intelligence/engine.ts</b> (744 lines) - Main orchestrator: analyze, processChunk, commit'))
    story.append(bullet('<b>src/lib/data-intelligence/column-detector.ts</b> - Regex-based column header to field mapping'))
    story.append(bullet('<b>src/lib/data-intelligence/validator.ts</b> - DB-driven validation rule engine'))
    story.append(bullet('<b>src/lib/data-intelligence/normalizer.ts</b> - Configurable value normalization'))
    story.append(bullet('<b>src/lib/data-intelligence/deduplicator.ts</b> - Cross-batch and within-batch dedup'))
    story.append(bullet('<b>src/lib/data-intelligence/quality-scorer.ts</b> - 3-dimension quality scoring (completeness, validity, richness)'))
    story.append(bullet('<b>src/lib/data-intelligence/correction-suggester.ts</b> - AI-assisted correction suggestions'))
    story.append(bullet('<b>src/lib/data-intelligence/config-store.ts</b> - Runtime config cache for validation/normalization rules'))

    story.append(h3('Schema Models Added'))
    story.extend(make_table(
        ['Model', 'Purpose', 'Key Fields'],
        [
            ['DataUpload', 'Upload session tracker', 'status (7 states), columnMapping, dataQualityScore'],
            ['UploadRow', 'Per-row processing record', 'rawData, mappedData, normalizedData, validationIssues, qualityScore'],
            ['ColumnMappingRule', 'Configurable column detection', 'pattern (regex), targetField, priority'],
            ['FieldValidationRule', 'Configurable field validation', 'ruleType (6 types), config, severity'],
            ['NormalizationMapping', 'Configurable value normalization', 'category (6 categories), sourceValue, normalizedValue'],
            ['ScoringWeight', 'Configurable lead scoring', 'dimension, field, key, weight, maxScore'],
            ['NormalizationLog', 'Audit trail for transformations', 'originalValue, normalizedValue, ruleApplied'],
            ['DataQualityScore', 'Per-row quality persistence', 'totalScore, completenessScore, validityScore, richnessScore'],
        ],
        col_widths=[110, 120, 230]
    ))

    story.append(h2('2.3 Functional Validation'))
    story.append(body(
        'The end-to-end flow follows a 5-stage pipeline. <b>Stage 1 (Analyze):</b> The user uploads a CSV/Excel file. The engine reads headers, '
        'runs regex patterns from ColumnMappingRule to auto-detect field mappings (e.g., "Company Name" maps to "company", "E-mail" maps to "email"), '
        'and presents a confidence score with suggested mapping. <b>Stage 2 (Process):</b> Each chunk of rows flows through validate (check against '
        'FieldValidationRule), normalize (apply NormalizationMapping), deduplicate (fuzzy match against existing records and within batch), and score '
        '(3-dimension quality: completeness 40%, validity 35%, richness 25%). <b>Stage 3 (Review):</b> The user sees a paginated table with color-coded '
        'quality scores, validation warnings, and AI-suggested corrections. <b>Stage 4 (Correct):</b> User approves or modifies corrections. '
        '<b>Stage 5 (Commit):</b> Accepted rows are atomically committed as Company + Contact records with ImportBatch linkage.'
    ))
    story.append(body(
        'A real-world scenario: An SDR uploads a 2,000-row Excel file from a SaaS conference. The engine detects columns like "Org" (company), '
        '"Work Email" (email), "Job Title" (title), and "Company Size" (employee count). It normalizes "CFO" to "Chief Financial Officer", '
        '"US" to "United States", "1000-5000" to "1001-5000", flags 47 emails as risky based on validation rules, identifies 12 duplicates against '
        'existing records, and assigns quality scores ranging from 32 to 98. The SDR reviews the 12 flagged duplicates, accepts 10, rejects 2, '
        'and commits 1,988 clean records into the platform.'
    ))

    story.append(h2('2.4 Business Intelligence Validation'))
    story.append(body(
        'Phase 1 enables the decision: <b>"Is our prospect data clean enough to trust with AI-powered outreach?"</b> Data quality scores provide an '
        'objective, quantitative answer. A sales leader can see "our latest import has an average quality score of 72" and know that approximately '
        '28% of records need attention before outreach begins. The normalization audit trail answers compliance questions: "What was the original value '
        'and what rule transformed it?" The configurable rule system means the data team can add new industry mappings or validation patterns without '
        'developer intervention, reducing the feedback loop from "days" to "minutes." This transforms data management from a reactive firefighting '
        'exercise into a proactive quality assurance process, which directly impacts outbound conversion rates and reduces bounce rates.'
    ))

    story.append(h2('2.5 Current Status'))
    story.extend(status_table(
        'Completed',
        limitations='Chunked processing relies on client-side file splitting; very large files (>10MB) may need server-side streaming',
        debt='Column detection uses regex patterns that require periodic updates for new file formats'
    ))

    story.append(h2('2.6 Production Readiness'))
    story.append(body(
        'The data intelligence engine is fully deployed and functional on Vercel. All business rules are stored in database tables (ColumnMappingRule, '
        'FieldValidationRule, NormalizationMapping, ScoringWeight), meaning rule changes take effect immediately without code deployment. The pipeline '
        'handles the full lifecycle from upload to committed records with comprehensive audit logging via the NormalizationLog and AuditLog models. '
        'Security: file uploads are processed server-side with no client-side data exposure. All validation and normalization rules are configurable '
        'through the Settings UI under Data Rules, with admin-only access controls.'
    ))

    # ══════════════════════════════════════════════════════════════
    # CHAPTER 3: PHASE 2 - WORKFLOW AUTOMATION & AI GOVERNANCE
    # ══════════════════════════════════════════════════════════════
    story.append(PageBreak())
    story.append(h1('Chapter 3: Phase 2 - Workflow Automation and AI Governance'))

    story.append(h2('3.1 Phase Objective'))
    story.append(body(
        'Phase 2 solves two interconnected problems: <b>reliable async processing</b> and <b>AI output quality control</b>. The workflow automation '
        'engine provides a job queue system that handles long-running tasks (enrichment, research, scoring, signal detection, email generation) with '
        'progress tracking, retry logic, and failure classification. Without this, a 30-second LLM call would timeout HTTP requests, and a failed web '
        'search would leave no recovery path. The AI governance layer ensures that every LLM-generated output passes through confidence gates before '
        'reaching a human, with hallucination prevention rules, evidence grounding requirements, and a complete audit trail. In a consulting context '
        'where an AI-generated email claiming "Acme Corp raised $50M" could damage credibility if wrong, governance is not optional, it is existential.'
    ))

    story.append(h2('3.2 Implementation Evidence'))

    story.append(h3('Workflow Engine'))
    story.append(bullet('<b>src/lib/workflow-engine/queue.ts</b> - Job CRUD, priority sorting, status transitions'))
    story.append(bullet('<b>src/lib/workflow-engine/processor.ts</b> (536 lines) - Type-specific processing pipelines'))
    story.append(bullet('<b>src/lib/workflow-engine/retry.ts</b> - Error classification (rate_limit, auth, timeout, validation, network, unknown)'))
    story.append(bullet('<b>src/lib/workflow-engine/index.ts</b> - Public API for job management'))

    story.append(h3('AI Governance Layer'))
    story.append(bullet('<b>src/lib/ai-governance.ts</b> (1,093 lines) - Confidence gates, hallucination prevention, evidence grounding, audit trail'))
    story.append(bullet('<b>src/lib/intelligence-contract.ts</b> - Research context structure for governed AI calls'))
    story.append(bullet('<b>eslint-rules/no-ungoverned-llm.js</b> - ESLint rule preventing ungoverned LLM calls'))
    story.append(bullet('<b>src/app/api/cron/job-processor/route.ts</b> - Cron endpoint for background job processing'))

    story.append(h3('Schema Models'))
    story.extend(make_table(
        ['Model', 'Purpose', 'Key Fields'],
        [
            ['Job', 'Async task tracking', 'type, status (6 states), priority, progress, payload, result, attemptCount, nextRetryAt'],
            ['JobLog', 'Per-job step logging', 'level, step, message, metadata (JSON)'],
            ['AIGenerationAudit', 'AI output traceability', 'generationType, evidenceIdsUsed, signalIdsUsed, researchConfidence, governancePassed'],
        ],
        col_widths=[110, 120, 230]
    ))

    story.append(h2('3.3 Functional Validation'))
    story.append(body(
        'The workflow engine processes jobs through a typed pipeline. When a user triggers company research, a Job record is created with type "research", '
        'status "pending", and the company ID as payload. The processor picks up the job, transitions to "running", and executes the 6-step research '
        'pipeline (search, evidence collection, LLM extraction, field validation, confidence scoring, storage), updating progress from 0-100% at each '
        'step. If a step fails, the retry classifier examines the error: a rate_limit error schedules a retry in 60 seconds; a validation error marks '
        'the job as permanently failed. JobLog records capture every step with timing and metadata for debugging.'
    ))
    story.append(body(
        'The AI governance layer intercepts every LLM call. Before generation, it checks: minimum research confidence (varies by type: emails require '
        '0.6, enrichment requires 0.4), minimum freshness score (must be above "stale"), and evidence grounding (at least one evidence source must '
        'exist for email generation). During generation, hallucination prevention rules are injected into the prompt: "Never fabricate financial data," '
        '"Only reference information present in the provided evidence." After generation, the output is recorded in AIGenerationAudit with the full '
        'context snapshot (evidence IDs, signal IDs, confidence scores, model used), enabling complete traceability of any AI output.'
    ))

    story.append(h2('3.4 Business Intelligence Validation'))
    story.append(body(
        'Phase 2 enables the decision: <b>"Can we trust this AI-generated insight enough to act on it?"</b> The governance check result includes '
        'a pass/fail for each dimension (research confidence, freshness, capability match, staleness), allowing sales reps to see at a glance why an '
        'email was or was not generated. The audit trail answers the question: "What evidence backed this recommendation when it was created?" This is '
        'critical in consulting where a wrong claim about a prospect\'s technology stack can destroy credibility in seconds. The governance layer transforms '
        'AI from a black box into a transparent, auditable system where every output can be traced back to its source evidence.'
    ))

    story.append(h2('3.5 Current Status'))
    story.extend(status_table(
        'Completed',
        limitations='Cron-based job processor (Vercel Cron) has 1-minute minimum interval; real-time job processing would need a persistent worker',
        debt='Retry logic handles 6 error categories; additional categories (e.g., upstream API deprecation) could be added'
    ))

    story.append(h2('3.6 Production Readiness'))
    story.append(body(
        'The governance layer is enforced at the code level via an ESLint custom rule: any file that imports <b>callLLM</b> directly (bypassing the '
        'governance wrapper) will fail to compile. This architectural guardrail ensures governance cannot be accidentally circumvented. The cron endpoint '
        'is secured and processes jobs at Vercel Cron intervals. The AIGenerationAudit model is indexed on companyId, generationType, and createdAt for '
        'efficient querying. All AI outputs across the platform (email drafts, conversation plans, account briefs, signal analyses, opportunity '
        'recommendations) flow through this single governance layer.'
    ))

    # ══════════════════════════════════════════════════════════════
    # CHAPTER 4: PHASE 3 - RESEARCH INTELLIGENCE ENGINE
    # ══════════════════════════════════════════════════════════════
    story.append(PageBreak())
    story.append(h1('Chapter 4: Phase 3 - Research Intelligence Engine'))

    story.append(h2('4.1 Phase Objective'))
    story.append(body(
        'Phase 3 transforms DeepMindQ from a data management tool into an <b>intelligence platform</b>. The business problem it solves is: '
        '"We have hundreds of target accounts but no timely, evidence-backed understanding of what is happening inside them." Manual research is '
        'slow (30-60 minutes per company), inconsistent (different analysts produce different quality), and not scalable. Phase 3 automates company '
        'research through a 6-step pipeline: web search, evidence collection, LLM extraction, field validation, confidence scoring, and storage. '
        'The critical innovation is <b>per-field evidence linkage</b>: every extracted data point (revenue, employee count, tech stack) links back '
        'to the specific web source that provided it, with a confidence score. This means a sales rep can see not just "Acme Corp has $50M revenue" '
        'but "Acme Corp has $50M revenue (90% confidence, sourced from Crunchbase, 3 days ago)."'
    ))
    story.append(body(
        'Phase 3 also introduces <b>buying signal detection</b> (8 signal types: funding, hiring, leadership change, tech change, news, mention, '
        'partnership, expansion), <b>signal-to-capability matching</b> (linking detected signals to the firm\'s service offerings), and '
        '<b>freshness indicators</b> (4-domain lifecycle: profile, signals, contacts, technology). These capabilities are required because revenue '
        'intelligence is fundamentally about timing: knowing <i>what</i> a company does is insufficient; knowing <i>what they are doing right now</i> '
        'is what creates pipeline.'
    ))

    story.append(h2('4.2 Implementation Evidence'))

    story.append(h3('Research Engine'))
    story.append(bullet('<b>src/lib/research-engine/researcher.ts</b> (609 lines) - 6-step research pipeline'))
    story.append(bullet('<b>src/lib/research-engine/evidence.ts</b> - Evidence collection, storage, and field linkage'))
    story.append(bullet('<b>src/lib/research-engine/signals.ts</b> - 8-type signal detection with severity/impact scoring'))
    story.append(bullet('<b>src/lib/research-engine/signal-capability-matching.ts</b> (384 lines) - Category + keyword + business problem matching'))
    story.append(bullet('<b>src/lib/research-engine/freshness-indicators.ts</b> (174 lines) - 4-domain freshness scoring (fresh/aging/stale/expired)'))
    story.append(bullet('<b>src/lib/research-engine/index.ts</b> - Public API barrel export'))
    story.append(bullet('<b>src/lib/research-engine/signal-lifecycle.ts</b> (79 lines) - Signal state machine (detected/validated/active/aging/expired/archived)'))

    story.append(h3('API Routes (g-ai)'))
    story.extend(make_table(
        ['Route', 'Method', 'Purpose'],
        [
            ['g-ai/research-agent', 'POST', 'Trigger full 6-step research for a company'],
            ['g-ai/ai__enrich', 'POST', 'Legacy enrichment (wraps research pipeline)'],
            ['g-ai/ai__signals', 'POST', 'Detect buying signals for a company'],
            ['g-ai/ai__insights', 'POST', 'Generate strategic insights from research data'],
            ['g-ai/ai__account-brief', 'POST', 'Generate account brief with governance'],
            ['g-ai/knowledge', 'GET/POST', 'Knowledge base management'],
            ['g-ai/capabilities', 'GET/POST', 'Capability asset CRUD'],
        ],
        col_widths=[140, 50, 270]
    ))

    story.append(h2('4.3 Functional Validation'))
    story.append(body(
        'The research pipeline flow: (1) <b>Search</b> - 4 parallel Tavily web queries (business, tech, people, news) produce raw search results. '
        '(2) <b>Evidence Collection</b> - Each result is stored as an Evidence record with source URL, title, snippet, relevance score, and extracted '
        'field mapping. (3) <b>LLM Extraction</b> - A governed AI call processes all evidence and extracts structured fields (revenue, employeeCount, '
        'techStack, industry, keyPeople, recentNews) with grounding rules that prevent fabrication. (4) <b>Field Validation</b> - Cross-reference '
        'extracted values against multiple evidence sources; flag contradictions. (5) <b>Confidence Scoring</b> - Per-field confidence (high/medium/low) '
        'based on evidence count, source quality, and corroboration. (6) <b>Storage</b> - ResearchCard updated, Evidence records linked to fields, '
        'CompanySignals created from detected events, intelligenceScore recomputed.'
    ))
    story.append(body(
        'A real scenario: A company "DataVault Inc." is researched. The engine finds 23 evidence sources across 4 query categories. Revenue is extracted '
        'as "$45M" with 0.92 confidence (corroborated by 3 sources including Crunchbase and a press release). Tech stack includes "AWS, Kubernetes, '
        'Python, dbt" with 0.85 confidence. Three signals are detected: a Series B funding round (high severity, high impact), a hiring spree for '
        'data engineers (medium severity), and a partnership with Snowflake (medium severity). Each signal is automatically matched to capabilities: '
        'the funding signal maps to "Cloud Migration" and "Data Platform" with match scores of 0.82 and 0.79 respectively.'
    ))

    story.append(h2('4.4 Business Intelligence Validation'))
    story.append(body(
        'Phase 3 enables the strategic decision: <b>"Which accounts have active buying signals that match our capabilities?"</b> This is the core '
        'question of revenue intelligence. Before Phase 3, the answer was "ask the SDRs" (subjective, slow, incomplete). After Phase 3, the answer '
        'is a ranked, evidence-backed list. The signal-to-capability matching answers: "This hiring signal at DataVault maps to our Data Platform '
        'practice with 82% relevance." The freshness indicators answer: "Our intelligence on DataVault is 5 days old (fresh) across all domains." '
        'Per-field confidence scoring means a sales rep can distinguish between a reliable data point and a tentative one, avoiding the embarrassment '
        'of leading a conversation with wrong information.'
    ))

    story.append(h2('4.5 Current Status'))
    story.extend(status_table(
        'Completed',
        limitations='Web search depends on Tavily API availability; research quality is bounded by web source quality',
        debt='Signal detection rules could be expanded beyond 8 types; LLM extraction prompt could be version-controlled'
    ))

    story.append(h2('4.6 Production Readiness'))
    story.append(body(
        'All research engine functions use <b>governedAICall</b> or <b>governedAICallAggregate</b> from the AI governance layer. The signal lifecycle '
        'manager runs via the cron job processor, transitioning signal states based on age and confidence. Evidence records are indexed on companyId, '
        'extractedField, status, and confidence for efficient querying. The CompanyResearchCard model stores per-field confidence as JSON, enabling '
        'downstream consumers (email generation, opportunity scoring) to make confidence-aware decisions. The structured tech landscape and strategic '
        'priorities fields on ResearchCard provide enriched inputs for capability matching and opportunity recommendation.'
    ))

    # ══════════════════════════════════════════════════════════════
    # CHAPTER 5: PHASE 4 - OPPORTUNITY INTELLIGENCE (TRACK C)
    # ══════════════════════════════════════════════════════════════
    story.append(PageBreak())
    story.append(h1('Chapter 5: Phase 4 - Opportunity Intelligence (Track C)'))

    story.append(h2('5.1 Phase Objective'))
    story.append(body(
        'Phase 4 addresses the critical gap between <b>detecting intelligence</b> and <b>acting on it</b>. Phases 0-3 produce signals, evidence, and '
        'capability matches, but they do not answer the sales question: "So what should I do about it?" Phase 4 closes this gap through a read-only '
        'intelligence pipeline: Signal > Meaning > Capability Fit > Opportunity Recommendation > Human Decision > Pursuit Intelligence. Each stage '
        'adds a layer of interpretation and strategic context, culminating in an actionable opportunity recommendation that a salesperson can accept '
        'or reject. The explicit human decision gate is fundamental: the system recommends, the human decides. This preserves sales judgment while '
        'dramatically reducing the time from signal detection to qualified opportunity.'
    ))
    story.append(body(
        'Phase 4 is required because without it, signals exist in isolation. A funding round signal and a capability match score are individually '
        'useful but strategically inert until combined into a narrative: "DataVault just raised Series B (signal), they are hiring data engineers '
        '(signal), this maps to our Data Platform capability (match), so we should approach their CTO with a data scaling conversation (recommendation)." '
        'Phase 4 also adds evidence quality scoring, signal-driven sequence generation, pursuit tracking, and playbooks, creating a complete intelligence-to-action '
        'pipeline.'
    ))

    story.append(h2('5.2 Implementation Evidence'))

    story.append(h3('Track C Pipeline Engines'))
    story.append(bullet('<b>src/lib/research-engine/signal-meaning.ts</b> (337 lines) - 7 meaning categories, rule-based, zero LLM'))
    story.append(bullet('<b>src/lib/research-engine/opportunity-recommendation-engine.ts</b> (456 lines) - Composite scoring: Signal 30%, Capability 25%, Freshness 20%, Evidence 15%, Impact 10%'))
    story.append(bullet('<b>src/lib/research-engine/evidence-quality.ts</b> (121 lines) - 5-dimension quality: Coverage 25%, Freshness 25%, Source Quality 20%, Corroboration 15%, Volume 15%'))
    story.append(bullet('<b>src/lib/research-engine/signal-sequence-engine.ts</b> (681 lines) - 3-step signal-driven email sequence generation'))
    story.append(bullet('<b>src/lib/research-engine/freshness-indicators.ts</b> - Per-domain freshness lifecycle'))
    story.append(bullet('<b>src/lib/research-engine/signal-lifecycle.ts</b> - Signal state machine'))

    story.append(h3('Schema Models Added'))
    story.extend(make_table(
        ['Model', 'Purpose', 'Key Fields'],
        [
            ['OpportunityRecommendation', 'Strategic opportunity record', 'whyNow, businessProblem, opportunityScore, status (4 states), rejectionReason'],
            ['Pursuit', 'Human-accepted opportunity tracking', 'owner, status (4 states), nextAction, outcomeStage'],
            ['Playbook', 'Sales engagement playbooks', 'category (8 types), targetIndustry, targetRole, steps (JSON)'],
            ['AccountStrategy', 'Account-level strategy room', 'swotAnalysis, keyInitiatives, stakeholderMap, competitivePosition'],
            ['SignalCapabilityMatch', 'Signal-to-capability linkage', 'matchScore, reason, businessProblem, salesAngle'],
        ],
        col_widths=[120, 120, 220]
    ))

    story.append(h2('5.3 Functional Validation'))
    story.append(body(
        'The Track C pipeline flow: (1) <b>Signal Meaning Inference</b> - A detected signal\'s type, severity, and impact are matched against 14+ '
        'deterministic rules to infer a meaning category (budget_available, leadership_openness, tech_dissatisfaction, growth_pressure, '
        'compliance_requirement, vendor_evaluation). This requires zero LLM calls and produces a confidence score. (2) <b>Capability Fit</b> - '
        'The signal is matched against CapabilityAsset records using category alignment (30%), keyword overlap (30%), business problem relevance '
        '(20%), and impact bonus (5%). (3) <b>Opportunity Recommendation</b> - A governed LLM call combines signal context, evidence, capability match, '
        'and freshness into a structured recommendation with: opportunity title, business trigger, whyNow rationale, business problem, suggested '
        'conversation topics, and recommended stakeholders. The composite opportunity score is computed from 5 weighted dimensions.'
    ))
    story.append(body(
        '(4) <b>Human Decision</b> - The recommendation is presented with status "pending_review." The salesperson reviews and either accepts '
        '(creating a Pursuit record) or rejects (with a structured reason: WRONG_TIMING, EXISTING_RELATIONSHIP, NOT_RELEVANT, LOW_CONFIDENCE, '
        'NO_BUDGET, OTHER, plus free-text feedback). (5) <b>Pursuit Intelligence</b> - Accepted pursuits track owner, priority, next action, outcome '
        'stage, and last activity timestamp. Stale pursuit detection highlights opportunities at risk of falling through the cracks.'
    ))
    story.append(body(
        'A real scenario: DataVault\'s Series B signal (meaning: budget_available, confidence 0.9) matches the Data Platform capability (score 0.82). '
        'The opportunity recommendation engine generates: "Data Scaling Opportunity - DataVault\'s $30M Series B creates budget for data infrastructure '
        'investments. Their hiring of 8 data engineers signals urgency. Approach the CTO with a conversation about building a scalable data platform '
        'to support their growth trajectory." The recommendation scores 78/100 (signal confidence 0.85 * 30 + capability match 0.82 * 25 + freshness '
        '92 * 0.20 + evidence quality 71 * 0.15 + impact high * 0.10). The SDR reviews, accepts, and a Pursuit is created.'
    ))

    story.append(h2('5.4 Business Intelligence Validation'))
    story.append(body(
        'Phase 4 enables the decision: <b>"What specific conversation should I have with this prospect, and why now?"</b> This is the most valuable '
        'question in B2B sales. The "whyNow" field provides a time-sensitive rationale: not "you should talk to DataVault" but "you should talk to '
        'DataVault <i>this week</i> because they just raised Series B and are actively hiring data engineers." The rejection reasons provide a '
        'feedback loop: if 40% of opportunities are rejected for "LOW_CONFIDENCE," the system has a data quality problem, not a sales problem. '
        'The pursuit tracking answers: "How many accepted opportunities are actually being pursued vs. going stale?" This transforms the platform '
        'from an intelligence repository into an active pipeline generation engine.'
    ))

    story.append(h2('5.5 Current Status'))
    story.extend(status_table(
        'Completed',
        limitations='Opportunity sequence generation requires LLM (via governance); pursuit tracking is manual (no automated follow-up reminders)',
        debt='Rejection feedback loop data exists but no automated analysis/dashboard yet'
    ))

    story.append(h2('5.6 Production Readiness'))
    story.append(body(
        'All Phase 4 engines use governedAICallAggregate for LLM calls. The OpportunityRecommendation model is indexed on companyId, status, priority, '
        'opportunityScore, and createdAt for efficient filtering. The Pursuit model tracks lastActivityAt for stale detection. EmailSequence records '
        'link to opportunityId for traceability. The signal-driven sequence engine stores triggerReason, triggerSignalId, and triggerCapabilityMatchId '
        'on each sequence, maintaining full intelligence provenance. The system is fully deployed and operational on Vercel with Neon PostgreSQL.'
    ))

    # ══════════════════════════════════════════════════════════════
    # CHAPTER 6: PHASE 5 - ACCOUNT PRIORITIZATION ENGINE
    # ══════════════════════════════════════════════════════════════
    story.append(PageBreak())
    story.append(h1('Chapter 6: Phase 5 - Account Prioritization Engine'))

    story.append(h2('6.1 Phase Objective'))
    story.append(body(
        'Phase 5 solves the portfolio management problem: <b>"Given 500 target accounts with varying intelligence depth, which ones should our '
        'limited sales capacity focus on this quarter?"</b> This is fundamentally different from the intelligence question (Phase 3) or the opportunity '
        'question (Phase 4). A company might have excellent intelligence (high intelligenceScore) but be a poor ICP fit (wrong industry, too small). '
        'Conversely, a company might be a perfect ICP fit but have no recent signals (low urgency). Phase 5 combines these dimensions into a single '
        'composite score that answers: "Which accounts deserve our attention, ranked by sales priority?"'
    ))
    story.append(body(
        'The capability is required because without it, sales teams either (a) focus on accounts they already know (confirmation bias), (b) focus '
        'on the loudest accounts (recency bias), or (c) try to work all accounts equally (capacity dilution). A data-driven prioritization score '
        'eliminates these biases and provides an objective, explainable ranking. The three-dimension formula (Static Fit 40%, Dynamic Intelligence '
        '40%, Timing/Urgency 20%) reflects the consulting sales reality: who they are matters as much as what is happening, and timing is the tiebreaker.'
    ))

    story.append(h2('6.2 Implementation Evidence'))

    story.append(h3('Core Engine'))
    story.append(bullet('<b>src/lib/account-prioritization.ts</b> (1,117 lines) - Complete scoring engine'))
    story.append(bullet('<b>src/lib/icp-config.ts</b> (235 lines) - DB-persisted ICP profile with lazy-load'))
    story.append(bullet('<b>src/app/api/g-strategy/account-rankings.ts</b> - GET (paginated rankings) + POST (batch compute)'))
    story.append(bullet('<b>src/app/api/g-strategy/companies/:id/priority.ts</b> - GET (single lookup) + POST (compute/recompute)'))
    story.append(bullet('<b>src/app/api/g-strategy/icp-profile.ts</b> - GET (ICP config) + PUT (partial update with weight validation)'))

    story.append(h3('Formula (Frozen)'))
    story.extend(make_table(
        ['Dimension', 'Weight', 'Sub-scores', 'Data Source'],
        [
            ['Static Fit', '40%', 'Industry (30%), Size (25%), Geography (15%), Revenue (15%), Tech (15%)', 'Company + ResearchCard + ICP config'],
            ['Dynamic Intelligence', '40%', 'Intelligence Score (35%), Research Depth (25%), Signal Quality (25%), Contact Coverage (15%)', 'Company.intelligenceScore, evidence/signal/contact counts'],
            ['Timing / Urgency', '20%', 'Signal Recency (40%), Engagement Recency (35%), Growth Indicator (25%)', '30-day signal window, engagementScore, lifecycleStage'],
        ],
        col_widths=[90, 50, 200, 120]
    ))

    story.append(h3('Schema Changes'))
    story.append(bullet('Company.accountPriorityScore (Float?) - Nullable, only set when computed'))
    story.append(bullet('Company.priorityTier (String?) - HOT / ACTIVE / NURTURE / LOW'))
    story.append(bullet('Company.priorityComputedAt (DateTime?) - Last computation timestamp'))
    story.append(bullet('SystemSetting model - id @default(cuid()) + key @unique (ICP persistence)'))
    story.append(bullet('@@index([priorityTier]) on Company model'))

    story.append(h2('6.3 Functional Validation'))
    story.append(body(
        'The scoring flow: <b>Input</b> - Company ID (single) or filter parameters (batch: tier, industry, size, status). <b>Processing</b> - '
        'fetchCompanyScoringData() executes a single optimized DB query with includes for researchCard, signal/contact/note/timeline counts, and '
        '3 parallel signal count queries (all-time, 30-day, 7-day). The ICP profile is loaded from SystemSetting (or default if not configured). '
        'Each dimension is computed independently, producing sub-scores that sum to the dimension total via ICP-configured weights. '
        '<b>Output</b> - accountPriorityScore (0-100), priorityTier, plus gap closure fields: whyNowReasons (up to 8), topSignals (top 5 ranked by '
        'severity x recency), recommendedFocus (up to 5 capability matches with reasons).'
    ))
    story.append(body(
        'Tier classification: HOT (>=90), ACTIVE (70-89), NURTURE (50-69), LOW (<50). No gaps, no overlaps. The clamp(round(...), 0, 100) '
        'prevents floating-point drift. A company scoring 89.9999 rounds to 90 and classifies as HOT. The formula is frozen and will not change '
        'unless learning-loop recommendations from Phase 6 validation data justify it.'
    ))

    story.append(h2('6.4 Business Intelligence Validation'))
    story.append(body(
        'Phase 5 enables the portfolio decision: <b>"Here are the 25 HOT accounts we should focus on this quarter, and here is exactly why each '
        'one earned that ranking."</b> The whyNowReasons provide human-readable explanations like "High-growth company raised Series B funding '
        '12 days ago" or "3 active signals detected in the last 30 days including a leadership change." The recommendedFocus tells the sales team '
        'which capability to lead with: "Cloud Migration (match score 85): Company uses AWS and recently posted 5 cloud-related job openings." '
        'This transforms account planning from opinion-based to evidence-based, and makes it actionable: each ranked account comes with a clear '
        'suggested next step, not just a number.'
    ))

    story.append(h2('6.5 Current Status'))
    story.extend(status_table(
        'Completed',
        deferred='Learning loop (formula weight optimization based on validation feedback)',
        limitations='No A/B testing of scoring weights; no historical win/loss data to calibrate formula',
        debt='None - zero hardcoded data, zero mock values, 100% data-driven from DB'
    ))

    story.append(h2('6.6 Production Readiness'))
    story.append(body(
        'Deployed and live on Vercel. The ICP profile persists to SystemSetting (survives restarts, deployments, environment changes). '
        'Weight sum validation on update prevents broken configurations (must sum to 1.0). Reset to defaults is available via { reset: true }. '
        'The engine is read-only compute: no outbound automation, no auto-email, no CRM pipeline modifications. accountPriorityScore is a separate '
        'nullable Float from intelligenceScore, preventing any confusion. The @@index([priorityTier]) enables efficient filtered ranking queries. '
        'Batch compute supports filtering by tier, industry, size range, and status for targeted recomputation.'
    ))

    # ══════════════════════════════════════════════════════════════
    # CHAPTER 7: PHASE 6 - INTELLIGENCE VALIDATION LAYER
    # ══════════════════════════════════════════════════════════════
    story.append(PageBreak())
    story.append(h1('Chapter 7: Phase 6 - Intelligence Validation Layer'))

    story.append(h2('7.1 Phase Objective'))
    story.append(body(
        'Phase 6 solves the meta-problem: <b>"Is our intelligence actually accurate and useful?"</b> All previous phases produce intelligence '
        '(signals, meanings, matches, recommendations, priorities), but none measure whether that intelligence is correct. A signal meaning classified '
        'as "budget_available" might be wrong. A capability match scored 0.85 might be commercially irrelevant. An opportunity recommendation might '
        'suggest the wrong stakeholders. Without human validation, these errors compound silently, and the platform\'s credibility degrades over time. '
        'Phase 6 introduces a structured human judgment capture system that measures intelligence quality across 5 artifact types without changing '
        'any frozen scoring formulas.'
    ))
    story.append(body(
        'This capability is required for enterprise positioning because enterprise buyers demand evidence of AI quality, not just AI capability. '
        'A quality report showing "signal meanings are 78% accurate and improving" is far more compelling than a feature list. The validation data '
        'also feeds the future learning loop: once sufficient validation data exists, formula weights can be calibrated from real outcomes rather '
        'than expert judgment, transforming the platform from rules-based to data-driven.'
    ))

    story.append(h2('7.2 Implementation Evidence'))

    story.append(h3('Core Engine'))
    story.append(bullet('<b>src/lib/intelligence-validation.ts</b> (663 lines) - Complete validation engine'))
    story.append(bullet('<b>src/app/api/g-crm/companies/:id/validations.ts</b> - POST (submit validation) + GET (list validations)'))
    story.append(bullet('<b>src/app/api/g-crm/validations/quality-report.ts</b> - GET (aggregated quality metrics)'))

    story.append(h3('Schema Model'))
    story.extend(make_table(
        ['Field', 'Type', 'Purpose'],
        [
            ['artifactType', 'String', 'signal_meaning | capability_match | opportunity_recommendation | pursuit_intelligence | evidence_quality'],
            ['artifactId', 'String', 'FK to the source record being validated'],
            ['artifactSnapshot', 'Json?', 'Immutable snapshot at validation time'],
            ['rating', 'Int', '1-5 scale (1=wrong, 3=partially useful, 5=highly accurate)'],
            ['accuracy', 'String?', 'accurate | partially_accurate | inaccurate | cannot_judge'],
            ['relevance', 'String?', 'highly_relevant | somewhat_relevant | not_relevant'],
            ['actionability', 'String?', 'actionable_now | actionable_with_research | not_actionable'],
            ['feedback', 'String?', 'Free-text correction or nuance'],
            ['validatorContext', 'Json?', 'e.g., {validatorRole: "SDR", dealStage: "discovery"}'],
        ],
        col_widths=[100, 80, 280]
    ))

    story.append(h2('7.3 Functional Validation'))
    story.append(body(
        'The validation flow: (1) A sales rep reviews a signal meaning on the company profile and clicks "Validate." (2) A modal presents the '
        'artifact snapshot, a 1-5 rating scale, and three categorical judgments (accuracy, relevance, actionability) plus optional free-text feedback. '
        '(3) On submit, the IntelligenceValidation record is created with the artifact snapshot (immutable) and validator context. (4) The quality '
        'report endpoint aggregates all validations across the system, producing per-artifact-type metrics: average rating, accuracy distribution, '
        'relevance distribution, actionability distribution, and trend over time. Zero LLM calls are made during validation or reporting; the engine '
        'is pure aggregation from stored records.'
    ))

    story.append(h2('7.4 Business Intelligence Validation'))
    story.append(body(
        'Phase 6 enables the platform quality decision: <b>"How reliable is our intelligence, and is it getting better?"</b> This is essential for '
        'enterprise positioning and internal trust building. If signal meanings average 4.2/5 accuracy but capability matches average 3.1/5 relevance, '
        'the platform team knows exactly where to invest improvement effort. The validatorContext field enables segment analysis: "SDRs rate signal '
        'meanings at 4.5/5 but account executives rate them at 3.8/5" reveals that the same intelligence has different value for different roles. '
        'This is not just a quality metric; it is a product direction compass.'
    ))

    story.append(h2('7.5 Current Status'))
    story.extend(status_table(
        'Completed',
        deferred='Automated validation trend analysis, threshold-based alerts for quality degradation, learning loop integration',
        limitations='Quality depends on human validation volume; low validation counts produce unreliable aggregates',
        debt='None - zero LLM calls, zero formula changes, zero pipeline modifications'
    ))

    story.append(h2('7.6 Production Readiness'))
    story.append(body(
        'Deployed and live. The IntelligenceValidation model is indexed on artifactType+artifactId, companyId, validatedAt, and accuracy for efficient '
        'querying. The quality report endpoint supports filtering by artifact type, company, and date range. The design is explicitly non-invasive: '
        'no existing scoring formulas were modified, no existing APIs were changed, no existing data structures were altered. Phase 6 is purely '
        'additive: a new model, a new engine file, and 2 new API routes.'
    ))

    # ══════════════════════════════════════════════════════════════
    # CHAPTER 8: PLATFORM ARCHITECTURE FLOW
    # ══════════════════════════════════════════════════════════════
    story.append(PageBreak())
    story.append(h1('Chapter 8: Complete Platform Architecture Flow'))

    story.append(body(
        'The DeepMindQ Revenue Intelligence Platform implements a linear intelligence pipeline with an explicit human decision gate. Data enters '
        'through multiple sources, is enriched and analyzed through automated engines, and is transformed into actionable recommendations that '
        'require human approval before any pursuit activity begins. The following table maps each stage to its implementation phase and core files.'
    ))

    story.extend(make_table(
        ['Stage', 'Phase', 'Implementation', 'Output'],
        [
            ['Data Sources (Import, CRM, Web)', 'Phase 0-1', 'data-intelligence/engine.ts, CSV upload, manual entry', 'Normalized Company + Contact records'],
            ['Intelligence Engine (Research)', 'Phase 3', 'research-engine/researcher.ts (6-step pipeline)', 'Evidence + ResearchCard + Signals'],
            ['Signals (Detection + Lifecycle)', 'Phase 3-4', 'signals.ts, signal-lifecycle.ts, freshness-indicators.ts', '8 signal types with severity/impact/status'],
            ['Meaning (Buying Stage Inference)', 'Phase 4 (Track C-6)', 'signal-meaning.ts (7 categories, 14+ rules)', 'meaningCategory + confidence + implication'],
            ['Capability Match', 'Phase 3-4', 'signal-capability-matching.ts (4-dimension scoring)', 'SignalCapabilityMatch records with reasons'],
            ['Opportunity Recommendation', 'Phase 4 (Track C-1)', 'opportunity-recommendation-engine.ts (5-dimension composite)', 'OpportunityRecommendation with whyNow + score'],
            ['Human Decision', 'Phase 4 (Track C-4)', 'API: opportunities/:id/review (accept/reject)', 'Pursuit record (if accepted) or rejection feedback'],
            ['Pursuit Intelligence', 'Phase 4 (Track C-4)', 'Pursuit model + API', 'Owner, status, nextAction, outcomeStage tracking'],
            ['Learning Loop', 'Phase 6 (future)', 'IntelligenceValidation + quality-report', 'Quality metrics, accuracy trends, formula calibration data'],
        ],
        col_widths=[100, 65, 170, 125]
    ))

    story.append(body(
        'The architecture enforces several critical invariants: (1) <b>Read-only intelligence</b> - No phase sends outbound communications '
        'automatically. The email generation and sequence engines produce drafts, but sending requires explicit human approval. (2) <b>Evidence '
        'grounding</b> - Every AI-generated output links to its source evidence via AIGenerationAudit.evidenceIdsUsed. (3) <b>Governance '
        'enforcement</b> - The ESLint no-ungoverned-llm rule and the governedAICall wrapper ensure no LLM call bypasses quality gates. '
        '(4) <b>Separation of concerns</b> - intelligenceScore (research quality) and accountPriorityScore (sales priority) are distinct, '
        'stored in separate nullable fields, computed by separate engines, and serve different purposes.'
    ))

    # ══════════════════════════════════════════════════════════════
    # CHAPTER 9: FINAL CAPABILITY MATRIX
    # ══════════════════════════════════════════════════════════════
    story.append(PageBreak())
    story.append(h1('Chapter 9: Final Capability Matrix'))

    story.extend(make_table(
        ['Capability', 'Phase', 'Status', 'Business Value'],
        [
            ['Company/Contact Data Model', '0', 'Completed', 'Structured data foundation for all intelligence'],
            ['Authentication (OTP + Session)', '0', 'Completed', 'Secure access control with audit trail'],
            ['Data Import + Quality Pipeline', '1', 'Completed', 'Clean, normalized, scored, deduplicated prospect data'],
            ['Configurable Business Rules', '1', 'Completed', 'Admin-managed validation/normalization/scoring rules'],
            ['Job Queue + Workflow Engine', '2', 'Completed', 'Reliable async processing with retry and progress tracking'],
            ['AI Governance Layer', '2', 'Completed', 'Confidence gates, hallucination prevention, evidence grounding, audit'],
            ['6-Step Research Pipeline', '3', 'Completed', 'Automated company research with per-field evidence linkage'],
            ['Buying Signal Detection (8 types)', '3', 'Completed', 'Real-time awareness of target account events'],
            ['Signal-to-Capability Matching', '3', 'Completed', 'Automated mapping of signals to service offerings'],
            ['Freshness Indicators (4 domains)', '3', 'Completed', 'Intelligence currency monitoring and staleness detection'],
            ['Signal Meaning Inference', '4', 'Completed', 'Buying stage classification from signal attributes'],
            ['Opportunity Recommendation', '4', 'Completed', 'Evidence-backed "why this account, why now, what to position"'],
            ['Evidence Quality Scoring', '4', 'Completed', '5-dimension quality assessment of intelligence sources'],
            ['Signal-Driven Sequence Generation', '4', 'Completed', '3-step personalized outreach based on intelligence'],
            ['Pursuit Tracking', '4', 'Completed', 'Human-accepted opportunity lifecycle management'],
            ['Account Prioritization (3-dimension)', '5', 'Completed', 'Objective, explainable account ranking with ICP alignment'],
            ['ICP Configuration (DB-persisted)', '5', 'Completed', 'Admin-managed ideal customer profile with weight validation'],
            ['Intelligence Validation (5 artifact types)', '6', 'Completed', 'Human judgment capture for quality measurement'],
            ['Quality Report + Aggregation', '6', 'Completed', 'Per-artifact-type accuracy, relevance, actionability metrics'],
            ['Email Generation + Templates', '2-3', 'Completed', 'Governed AI email drafts with evidence grounding'],
            ['Lead Scoring (6-dimension)', '1-2', 'Completed', 'Role, email health, company fit, completeness, engagement, enrichment'],
            ['Capability Knowledge Base', '0-3', 'Completed', 'Structured service/solution/accelerator library with feedback'],
            ['Playbooks + Strategy Room', '4', 'Completed', 'Sales playbooks and account-level strategy documentation'],
        ],
        col_widths=[145, 45, 65, 205]
    ))

    # ══════════════════════════════════════════════════════════════
    # CHAPTER 10: REMAINING GAPS
    # ══════════════════════════════════════════════════════════════
    story.append(PageBreak())
    story.append(h1('Chapter 10: Remaining Gaps and Enterprise Readiness'))

    story.append(h2('10.1 Current Platform Positioning'))
    story.append(body(
        'DeepMindQ is currently a <b>dedicated-instance AI Revenue Intelligence Platform</b> purpose-built for IT Services and Consulting firms. '
        'It combines data management, automated research, signal detection, capability matching, opportunity recommendation, account prioritization, '
        'and intelligence validation into a single platform. The architecture is sound, the intelligence pipeline is complete through Phase 6, and '
        'the system is deployed and operational on Vercel with Neon PostgreSQL. However, positioning this as an <b>enterprise</b> Revenue Intelligence '
        'Platform requires closing several gaps across security, scale, integration, and analytics dimensions.'
    ))

    story.append(h2('10.2 Gap Analysis'))

    story.extend(make_table(
        ['Category', 'Gap', 'Current State', 'Enterprise Requirement', 'Priority'],
        [
            ['Learning Loop', 'Formula weight calibration from validation data', 'Validation data collected but not analyzed for formula optimization', 'Automated weight tuning based on win/loss outcomes', 'High'],
            ['Multi-tenant', 'Single-instance architecture', 'Dedicated instance with no tenant isolation', 'Tenant-scoped data, config, and access control', 'Medium'],
            ['Integrations', 'No CRM/ERP bi-directional sync', 'Manual data import/export only', 'Salesforce, HubSpot, or MS Dynamics integration', 'High'],
            ['Real-time Processing', 'Cron-based job processing (1-min interval)', 'Vercel Cron triggers job processor', 'WebSocket or persistent worker for sub-second processing', 'Medium'],
            ['Analytics Dashboard', 'Basic stats and metrics', 'Aggregate counts, quality scores available via API', 'Executive dashboard with pipeline velocity, conversion, and ROI', 'High'],
            ['Compliance', 'GDPR consent tracking exists', 'Consent status, source, date tracked on Contact model', 'Full GDPR/CCPA compliance with data subject access requests', 'Medium'],
            ['Mobile', 'Responsive web only', 'Tailwind CSS responsive design', 'Native mobile app or PWA for field sales', 'Low'],
            ['API Marketplace', 'Internal API only', 'REST APIs for all platform functions', 'Public API with OAuth, rate limiting, webhooks', 'Medium'],
            ['Collaboration', 'Single-user workflows', 'One user per session', 'Team workflows: @mentions, shared notes, assignment routing', 'Medium'],
            ['Historical Calibration', 'No win/loss tracking against scores', 'Pursuit model tracks outcomeStage', 'Correlate priority scores with actual closed-won/lost outcomes', 'High'],
        ],
        col_widths=[75, 90, 105, 110, 50]
    ))

    story.append(h2('10.3 Recommendations for Enterprise Positioning'))
    story.append(body(
        'The highest-impact next steps for enterprise readiness are: (1) <b>CRM Integration</b> - Bi-directional sync with Salesforce or HubSpot would '
        'make DeepMindQ an intelligence <i>layer</i> rather than a standalone tool, dramatically increasing adoption in enterprise sales organizations. '
        '(2) <b>Learning Loop Activation</b> - Using Phase 6 validation data plus Pursuit outcomeStage (won/lost) to calibrate Phase 5 scoring weights '
        'would transform the platform from rules-based to evidence-based, which is the single most compelling enterprise differentiator. '
        '(3) <b>Executive Analytics Dashboard</b> - A dashboard showing intelligence coverage, signal velocity, recommendation acceptance rates, and '
        'pipeline conversion would give revenue leaders the visibility they need to trust and fund the platform.'
    ))
    story.append(body(
        'The platform\'s current architecture is well-suited for these extensions. The modular engine design (each phase is an independent module '
        'with clear interfaces), the DB-backed configuration (ICP, validation rules, scoring weights), and the governance layer (which can be extended '
        'to new generation types) provide a solid foundation. The dedicated-instance model is actually an advantage for early enterprise adoption: '
        'it eliminates data commingling concerns and simplifies compliance. Multi-tenancy can be added later as a scaling strategy rather than an '
        'architectural prerequisite.'
    ))

    return story

# ━━ COVER HTML ━━
def write_cover_html():
    html = '''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;900&family=Playfair+Display:wght@400;700;900&display=swap" rel="stylesheet">
<style>
  @page { size: 794px 1123px; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 794px; height: 1123px; overflow: hidden; background: #ffffff; font-family: 'Inter', sans-serif; }

  .cover-layer-1 { position: absolute; inset: 0; overflow: hidden; z-index: 1; }
  .cover-layer-2 { position: absolute; inset: 0; z-index: 2; }
  .cover-layer-3 { position: absolute; inset: 0; z-index: 3; }

  /* Layer 1: Geometric accent */
  .block-accent {
    position: absolute; top: 0; right: 0; width: 340px; height: 1123px;
    background: #786d4d; opacity: 0.06;
  }
  .block-accent-2 {
    position: absolute; bottom: 0; left: 0; width: 500px; height: 6px;
    background: #8b7226; opacity: 0.4;
  }
  .line-vertical {
    position: absolute; top: 80px; left: 56px; width: 1px; height: 960px;
    background: #c8c3b3; opacity: 0.3;
  }

  /* Layer 2: Structure */
  .label-top {
    position: absolute; top: 100px; left: 80px;
    font-size: 11pt; font-weight: 500; letter-spacing: 3pt; text-transform: uppercase;
    color: #8e8c85; opacity: 0.7;
  }

  /* Layer 3: Content */
  .title-group {
    position: absolute; top: 200px; left: 80px; max-width: 500px;
  }
  .title-main {
    font-family: 'Playfair Display', serif; font-weight: 900; font-size: 42pt;
    line-height: 1.1; color: #242320; margin-bottom: 20px;
  }
  .title-sub {
    font-family: 'Inter', sans-serif; font-weight: 400; font-size: 16pt;
    line-height: 1.5; color: #8e8c85; max-width: 440px;
  }

  .meta-block {
    position: absolute; bottom: 120px; left: 80px;
  }
  .meta-line {
    font-size: 10pt; font-weight: 400; color: #8e8c85; margin-bottom: 6pt;
    letter-spacing: 1pt;
  }
  .meta-line strong {
    color: #242320; font-weight: 600;
  }

  .footer-line {
    position: absolute; bottom: 60px; left: 80px;
    font-size: 9pt; font-weight: 300; letter-spacing: 2pt; text-transform: uppercase;
    color: #8e8c85; opacity: 0.5;
  }
</style>
</head>
<body>
  <div class="cover-layer-1">
    <div class="block-accent"></div>
    <div class="block-accent-2"></div>
  </div>
  <div class="cover-layer-2">
    <div class="line-vertical"></div>
  </div>
  <div class="cover-layer-3">
    <div class="label-top">Validation Review</div>
    <div class="title-group">
      <div class="title-main">DeepMindQ<br>Revenue Intelligence<br>Platform</div>
      <div class="title-sub">Phase 0 through Phase 6 Closure Report: Complete validation review of implementation evidence, functional correctness, business intelligence value, and production readiness.</div>
    </div>
    <div class="meta-block">
      <div class="meta-line"><strong>Platform:</strong> Dedicated-Instance AI Revenue Intelligence</div>
      <div class="meta-line"><strong>Scope:</strong> IT Services and Consulting</div>
      <div class="meta-line"><strong>Date:</strong> July 2026</div>
      <div class="meta-line"><strong>Phases:</strong> 0 (Foundation) through 6 (Validation)</div>
    </div>
    <div class="footer-line">Confidential</div>
  </div>
</body>
</html>'''
    with open(COVER_HTML, 'w', encoding='utf-8') as f:
        f.write(html)

# ━━ MAIN ━━
def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    # 1. Generate body PDF
    print('Building body PDF...')
    doc = TocDocTemplate(BODY_PDF, pagesize=A4,
        leftMargin=40*mm, rightMargin=40*mm, topMargin=35*mm, bottomMargin=30*mm,
        title='DeepMindQ Phase 0-6 Closure Report', author='Z.ai')
    doc.onLaterPages = page_footer
    doc.onFirstPage = page_footer
    story = build_body()
    doc.multiBuild(story)
    print(f'Body PDF: {BODY_PDF}')

    # 2. Generate cover HTML + PDF
    print('Generating cover...')
    write_cover_html()
    PDF_SKILL_DIR = '/home/z/my-project/skills/pdf'
    subprocess.run([
        'node', os.path.join(PDF_SKILL_DIR, 'scripts', 'html2poster.js'),
        COVER_HTML, '--output', COVER_PDF, '--width', '794px'
    ], check=True, capture_output=True)
    print(f'Cover PDF: {COVER_PDF}')

    # 3. Merge cover + body
    print('Merging...')
    from pypdf import PdfReader, PdfWriter
    A4_W, A4_H = 595.28, 841.89
    writer = PdfWriter()
    cover_page = PdfReader(COVER_PDF).pages[0]
    w, h = float(cover_page.mediabox.width), float(cover_page.mediabox.height)
    if abs(w - A4_W) > 2 or abs(h - A4_H) > 2:
        cover_page.scale_to(A4_W, A4_H)
    writer.add_page(cover_page)
    for page in PdfReader(BODY_PDF).pages:
        pw, ph = float(page.mediabox.width), float(page.mediabox.height)
        if abs(pw - A4_W) > 2 or abs(ph - A4_H) > 2:
            page.scale_to(A4_W, A4_H)
        writer.add_page(page)
    writer.add_metadata({
        '/Title': 'DeepMindQ Revenue Intelligence Platform - Phase 0-6 Closure Report',
        '/Author': 'Z.ai',
        '/Creator': 'Z.ai',
        '/Subject': 'Comprehensive validation review of DeepMindQ Phases 0-6'
    })
    with open(FINAL_PDF, 'wb') as f:
        writer.write(f)
    print(f'Final PDF: {FINAL_PDF}')

    # Cleanup temp files
    for f in [BODY_PDF, COVER_HTML, COVER_PDF]:
        if os.path.exists(f):
            os.remove(f)

if __name__ == '__main__':
    main()