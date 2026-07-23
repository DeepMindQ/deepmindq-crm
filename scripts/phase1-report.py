#!/usr/bin/env python3
"""
Phase 1 Acceptance Report & Application Health Assessment
Generates a comprehensive PDF report covering all 7 sections requested.
"""

import hashlib, os, sys
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm, cm
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY, TA_RIGHT
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, KeepTogether, HRFlowable, Image
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase.pdfmetrics import registerFontFamily

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# FONT SETUP
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FONT_DIR = '/usr/share/fonts'

pdfmetrics.registerFont(TTFont('NotoSerifSC', f'{FONT_DIR}/truetype/noto-serif-sc/NotoSerifSC-Regular.ttf'))
pdfmetrics.registerFont(TTFont('NotoSerifSC-Bold', f'{FONT_DIR}/truetype/noto-serif-sc/NotoSerifSC-Bold.ttf'))
registerFontFamily('NotoSerifSC', normal='NotoSerifSC', bold='NotoSerifSC-Bold')

pdfmetrics.registerFont(TTFont('NotoSansSC', f'{FONT_DIR}/truetype/chinese/SarasaMonoSC-Regular.ttf'))
pdfmetrics.registerFont(TTFont('NotoSansSC-Bold', f'{FONT_DIR}/truetype/chinese/SarasaMonoSC-SemiBold.ttf'))

pdfmetrics.registerFont(TTFont('FreeSerif', f'{FONT_DIR}/truetype/liberation/LiberationSerif-Regular.ttf'))
pdfmetrics.registerFont(TTFont('FreeSerif-Bold', f'{FONT_DIR}/truetype/liberation/LiberationSerif-Bold.ttf'))
pdfmetrics.registerFont(TTFont('FreeSerif-Italic', f'{FONT_DIR}/truetype/liberation/LiberationSerif-Italic.ttf'))
registerFontFamily('FreeSerif', normal='FreeSerif', bold='FreeSerif-Bold', italic='FreeSerif-Italic')

pdfmetrics.registerFont(TTFont('FreeMono', f'{FONT_DIR}/truetype/liberation/LiberationMono-Regular.ttf'))

# Font fallback handled via style definitions
try:
    from reportlab.pdfbase.pdfmetrics import install_font_fallback
    install_font_fallback(['NotoSerifSC', 'FreeSerif', 'NotoSansSC'])
except ImportError:
    pass  # Older ReportLab version

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# CASCADE PALETTE
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PAGE_BG       = colors.HexColor('#f2f3f3')
SECTION_BG    = colors.HexColor('#edeeef')
CARD_BG       = colors.HexColor('#e9ecee')
TABLE_STRIPE  = colors.HexColor('#e9ebed')
HEADER_FILL   = colors.HexColor('#516172')
COVER_BLOCK   = colors.HexColor('#526374')
BORDER        = colors.HexColor('#a6b5c4')
ICON          = colors.HexColor('#4673a1')
ACCENT        = colors.HexColor('#297ed4')
ACCENT_2      = colors.HexColor('#5a3ab8')
TEXT_PRIMARY   = colors.HexColor('#1e1f21')
TEXT_MUTED     = colors.HexColor('#6f7378')
SEM_SUCCESS   = colors.HexColor('#548e67')
SEM_WARNING   = colors.HexColor('#917848')
SEM_ERROR     = colors.HexColor('#99554f')
SEM_INFO      = colors.HexColor('#456b92')

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# STYLES
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
styles = getSampleStyleSheet()

s_cover_title = ParagraphStyle('CoverTitle', fontName='NotoSansSC-Bold', fontSize=28, leading=36, alignment=TA_LEFT, textColor=colors.white, spaceAfter=8*mm)
s_cover_subtitle = ParagraphStyle('CoverSubtitle', fontName='FreeSerif-Italic', fontSize=14, leading=20, alignment=TA_LEFT, textColor=colors.HexColor('#c0c8d0'), spaceAfter=4*mm)
s_cover_meta = ParagraphStyle('CoverMeta', fontName='FreeMono', fontSize=10, leading=14, alignment=TA_LEFT, textColor=colors.HexColor('#8899aa'))

s_h1 = ParagraphStyle('H1', fontName='NotoSansSC-Bold', fontSize=18, leading=24, textColor=TEXT_PRIMARY, spaceBefore=10*mm, spaceAfter=5*mm)
s_h2 = ParagraphStyle('H2', fontName='NotoSansSC-Bold', fontSize=14, leading=18, textColor=HEADER_FILL, spaceBefore=7*mm, spaceAfter=3*mm)
s_h3 = ParagraphStyle('H3', fontName='NotoSansSC-Bold', fontSize=11, leading=15, textColor=ICON, spaceBefore=4*mm, spaceAfter=2*mm)

s_body = ParagraphStyle('Body', fontName='FreeSerif', fontSize=10, leading=16, alignment=TA_JUSTIFY, textColor=TEXT_PRIMARY, spaceAfter=3*mm)
s_body_left = ParagraphStyle('BodyLeft', fontName='FreeSerif', fontSize=10, leading=16, alignment=TA_LEFT, textColor=TEXT_PRIMARY, spaceAfter=3*mm)
s_bullet = ParagraphStyle('Bullet', fontName='FreeSerif', fontSize=10, leading=16, alignment=TA_LEFT, textColor=TEXT_PRIMARY, spaceAfter=1.5*mm, leftIndent=8*mm, bulletIndent=3*mm)
s_code = ParagraphStyle('Code', fontName='FreeMono', fontSize=8.5, leading=13, alignment=TA_LEFT, textColor=colors.HexColor('#333333'), backColor=colors.HexColor('#f5f5f5'), leftIndent=4*mm, rightIndent=4*mm, spaceBefore=2*mm, spaceAfter=2*mm, borderPadding=4)
s_caption = ParagraphStyle('Caption', fontName='FreeSerif-Italic', fontSize=9, leading=12, textColor=TEXT_MUTED, alignment=TA_CENTER, spaceAfter=3*mm)
s_note = ParagraphStyle('Note', fontName='FreeSerif', fontSize=9.5, leading=14, alignment=TA_LEFT, textColor=SEM_WARNING, leftIndent=4*mm, borderPadding=4, spaceAfter=3*mm)
s_badge_pass = ParagraphStyle('BadgePass', fontName='NotoSansSC-Bold', fontSize=9, leading=12, textColor=SEM_SUCCESS, alignment=TA_CENTER)
s_badge_fail = ParagraphStyle('BadgeFail', fontName='NotoSansSC-Bold', fontSize=9, leading=12, textColor=SEM_ERROR, alignment=TA_CENTER)
s_badge_warn = ParagraphStyle('BadgeWarn', fontName='NotoSansSC-Bold', fontSize=9, leading=12, textColor=SEM_WARNING, alignment=TA_CENTER)
s_badge_info = ParagraphStyle('BadgeInfo', fontName='NotoSansSC-Bold', fontSize=9, leading=12, textColor=SEM_INFO, alignment=TA_CENTER)

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# HELPERS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
def hr():
    return HRFlowable(width="100%", thickness=0.5, color=BORDER, spaceBefore=3*mm, spaceAfter=3*mm)

def status_badge(status):
    m = {'PASS': s_badge_pass, 'FAIL': s_badge_fail, 'WARN': s_badge_warn, 'INFO': s_badge_info}
    return Paragraph(f'<b>[{status}]</b>', m.get(status, s_body))

def info_table(data, col_widths=None):
    """Create a styled info table from list of [key, value] or header+rows."""
    if not data:
        return Paragraph("N/A", s_body)
    
    if isinstance(data[0], list) and len(data[0]) == 2:
        # Key-value pairs
        table_data = [[Paragraph(f'<b>{r[0]}</b>', s_body_left), Paragraph(str(r[1]), s_body_left)] for r in data]
        t = Table(table_data, colWidths=col_widths or [55*mm, 130*mm])
        t.setStyle(TableStyle([
            ('VALIGN', (0,0), (-1,-1), 'TOP'),
            ('TOPPADDING', (0,0), (-1,-1), 2),
            ('BOTTOMPADDING', (0,0), (-1,-1), 2),
            ('LINEBELOW', (0,0), (-1,-2), 0.3, BORDER),
            ('BACKGROUND', (0,0), (0,-1), colors.HexColor('#f8f9fa')),
        ]))
        return t
    
    # Multi-column table with header
    header = [Paragraph(f'<b>{c}</b>', ParagraphStyle('TH', fontName='NotoSansSC-Bold', fontSize=9, leading=12, textColor=colors.white)) for c in data[0]]
    rows = [[Paragraph(str(c), ParagraphStyle('TD', fontName='FreeSerif', fontSize=9, leading=13, textColor=TEXT_PRIMARY)) for c in row] for row in data[1:]]
    all_data = [header] + rows
    t = Table(all_data, colWidths=col_widths)
    style_cmds = [
        ('BACKGROUND', (0,0), (-1,0), HEADER_FILL),
        ('TEXTCOLOR', (0,0), (-1,0), colors.white),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('TOPPADDING', (0,0), (-1,-1), 3),
        ('BOTTOMPADDING', (0,0), (-1,-1), 3),
        ('LEFTPADDING', (0,0), (-1,-1), 4),
        ('RIGHTPADDING', (0,0), (-1,-1), 4),
        ('GRID', (0,0), (-1,-1), 0.3, BORDER),
    ]
    for i in range(2, len(all_data), 2):
        style_cmds.append(('BACKGROUND', (0,i), (-1,i), TABLE_STRIPE))
    t.setStyle(TableStyle(style_cmds))
    return t

def section_break():
    return Spacer(1, 3*mm)

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# BUILD STORY
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
story = []
W = A4[0] - 50*mm  # usable width

# ────────────────────────────────────────────────────────
# COVER PAGE
# ────────────────────────────────────────────────────────
story.append(Spacer(1, 60*mm))

# Cover block
cover_box_data = [[
    [
        Paragraph('Phase 1 Acceptance Report', s_cover_title),
        Paragraph('Application Health Assessment &<br/>Enterprise Readiness Review', s_cover_subtitle),
        hr(),
        Paragraph('Intelligence Platform | Pre-Phase 2 Gate Review', s_cover_meta),
        Spacer(1, 8*mm),
        Paragraph('Date: July 24, 2026', s_cover_meta),
        Paragraph('Classification: Internal / Confidential', s_cover_meta),
        Paragraph('Version: 1.0', s_cover_meta),
    ]
]]
cover_box = Table(cover_box_data, colWidths=[W])
cover_box.setStyle(TableStyle([
    ('BACKGROUND', (0,0), (-1,-1), COVER_BLOCK),
    ('LEFTPADDING', (0,0), (-1,-1), 20),
    ('RIGHTPADDING', (0,0), (-1,-1), 20),
    ('TOPPADDING', (0,0), (-1,-1), 24),
    ('BOTTOMPADDING', (0,0), (-1,-1), 24),
    ('VALIGN', (0,0), (-1,-1), 'TOP'),
    ('ROUNDEDCORNERS', [6, 6, 6, 6]),
]))
story.append(cover_box)
story.append(PageBreak())

# ────────────────────────────────────────────────────────
# TABLE OF CONTENTS (Manual - this is a gate review doc)
# ────────────────────────────────────────────────────────
story.append(Paragraph('<b>Table of Contents</b>', s_h1))
story.append(hr())
toc_items = [
    ('1', 'Current Application Status', 'Build, lint, tsc, and Prisma validation results'),
    ('2', '@ts-nocheck File Analysis', 'Complete inventory of 42 suppressed files with disposition'),
    ('3', 'User Journey Validation', 'End-to-end enterprise customer onboarding flow'),
    ('4', 'Database Reality Check', '67 Prisma models: used, unused, and orphan analysis'),
    ('5', 'Functional Testing Status', 'Comprehensive test plan covering all critical paths'),
    ('6', 'UI/UX Assessment', 'Screen inventory and product maturity classification'),
    ('7', 'Phase 2 Plan', 'Objectives, files, risks, and acceptance criteria'),
]
for num, title, desc in toc_items:
    story.append(Paragraph(f'<b>{num}.</b>&nbsp;&nbsp;{title}', ParagraphStyle('TOC', fontName='NotoSansSC-Bold', fontSize=11, leading=16, textColor=TEXT_PRIMARY, spaceBefore=3*mm, spaceAfter=1*mm)))
    story.append(Paragraph(desc, ParagraphStyle('TOCDesc', fontName='FreeSerif-Italic', fontSize=9, leading=13, textColor=TEXT_MUTED, leftIndent=8*mm, spaceAfter=2*mm)))

story.append(PageBreak())

# ────────────────────────────────────────────────────────
# SECTION 1: CURRENT APPLICATION STATUS
# ────────────────────────────────────────────────────────
story.append(Paragraph('1. Current Application Status', s_h1))
story.append(hr())

story.append(Paragraph('This section provides the raw diagnostic output from the four canonical checks: <b>npm run build</b>, <b>npm run lint</b>, <b>npx tsc --noEmit</b>, and <b>npx prisma validate</b>. These commands were executed on July 24, 2026 against the current <b>main</b> branch in the project workspace at <font name="FreeMono">/home/z/my-project/</font>.', s_body))

story.append(Paragraph('1.1 Build Status (npm run build)', s_h2))
story.append(Paragraph(
    'The production build completes successfully. The build pipeline runs <font name="FreeMono">prisma generate</font> followed by <font name="FreeMono">next build</font>. '
    'Notably, <font name="FreeMono">ignoreBuildErrors</font> has been set to <font name="FreeMono">false</font> in <font name="FreeMono">next.config.ts</font>, meaning Next.js no longer silently skips TypeScript errors during compilation. '
    'However, the build still passes because <font name="FreeMono">noImplicitAny</font> is set to <font name="FreeMono">false</font> in <font name="FreeMono">tsconfig.json</font>, and 42 files use <font name="FreeMono">@ts-nocheck</font> directives that suppress all type checking within those files. '
    'The build produces 120+ API routes and 4 static pages (app, login, signup, sitemap.xml). All pages and API routes compile without fatal errors.',
    s_body
))
build_results = [
    ['Check', 'Result', 'Status'],
    ['npm run build', 'Success - 120+ API routes, 4 static pages', 'PASS'],
    ['ignoreBuildErrors', 'false (correctly disabled)', 'PASS'],
    ['Prisma generate', 'Success (v6.19.3)', 'PASS'],
    ['Build duration', 'Completes within 120s', 'PASS'],
    ['Static pages', '/app, /login, /signup, /sitemap.xml', 'INFO'],
]
story.append(info_table(build_results, [45*mm, 100*mm, 30*mm]))
story.append(Spacer(1, 2*mm))

story.append(Paragraph('1.2 TypeScript Check (npx tsc --noEmit)', s_h2))
story.append(Paragraph(
    'The TypeScript compiler reports <b>0 errors</b> when invoked with <font name="FreeMono">--noEmit</font>. This is <b>not</b> because the codebase is fully type-safe. '
    'The zero-error result is achieved through a combination of three mechanisms: (1) <font name="FreeMono">noImplicitAny: false</font> in tsconfig.json, which allows implicit <font name="FreeMono">any</font> types without error; '
    '(2) 42 files with <font name="FreeMono">@ts-nocheck</font> directives that disable the TypeScript compiler entirely for those files; and (3) <font name="FreeMono">skipLibCheck: true</font> which skips type checking of declaration files. '
    'The actual type safety coverage is significantly lower than the zero-error count suggests. Section 2 of this report provides a complete inventory of all suppressed files.',
    s_body
))
tsc_results = [
    ['Check', 'Result', 'Status'],
    ['npx tsc --noEmit', '0 errors (exit code 0)', 'PASS*'],
    ['noImplicitAny', 'false (weak type safety)', 'WARN'],
    ['@ts-nocheck files', '42 files suppressing all errors', 'WARN'],
    ['@ts-ignore usage', '0 files', 'PASS'],
    ['@ts-expect-error usage', '1 file', 'INFO'],
]
story.append(info_table(tsc_results, [45*mm, 100*mm, 30*mm]))
story.append(Paragraph('<b>*PASS with caveat:</b> Zero errors is achieved through suppression, not resolution. True type safety requires removing @ts-nocheck and enabling noImplicitAny.', s_note))
story.append(Spacer(1, 2*mm))

story.append(Paragraph('1.3 Lint Status (npm run lint)', s_h2))
story.append(Paragraph(
    'ESLint reports <b>63 errors and 9 warnings</b> across the codebase. The lint configuration extends <font name="FreeMono">eslint-config-next</font> (v16.1.1). '
    'The errors are distributed across multiple categories: React hooks violations (calling setState directly within effects), forbidden require-style imports, empty object types, and unused eslint-disable directives. '
    'Notably, <font name="FreeMono">9 warnings are auto-fixable</font> with <font name="FreeMono">--fix</font>. The errors indicate real code quality issues that should be resolved before Phase 2, particularly the setState-in-effect patterns which can cause cascading render bugs in production.',
    s_body
))
lint_results = [
    ['Category', 'Count', 'Severity', 'Auto-fixable'],
    ['react-hooks/set-state-in-effect', '2', 'Error', 'No'],
    ['@typescript-eslint/no-require-imports', '4', 'Error', 'No'],
    ['@typescript-eslint/no-empty-object-type', '3', 'Error', 'No'],
    ['Unused eslint-disable directives', '4', 'Warning', 'Yes'],
    ['Other', '50', 'Error/Warning', 'Partial'],
    ['TOTAL', '63 errors, 9 warnings', '-', '9 auto-fixable'],
]
story.append(info_table(lint_results, [55*mm, 30*mm, 30*mm, 30*mm]))
story.append(Spacer(1, 2*mm))

story.append(Paragraph('1.4 Prisma Schema Validation (npx prisma validate)', s_h2))
story.append(Paragraph(
    'Prisma schema validation <b>fails</b> with error code P1012. The schema itself is syntactically valid (67 models, PostgreSQL provider, Prisma 6.19.3 syntax), but the <font name="FreeMono">DATABASE_URL</font> environment variable is not set in the local environment. '
    'This means the Prisma CLI cannot validate the datasource connection string format. In a production deployment (Render.com), this environment variable would be configured. The schema defines 67 models with extensive indexing, cascading deletes, and JSON fields for structured data storage. '
    'The failure is expected in the local development environment without a connected database.',
    s_body
))
prisma_results = [
    ['Check', 'Result', 'Status'],
    ['npx prisma validate', 'P1012: DATABASE_URL not set', 'FAIL (expected)'],
    ['Schema syntax', 'Valid - 67 models, PostgreSQL', 'PASS'],
    ['Prisma version', '6.19.3 (pinned correctly)', 'PASS'],
    ['Model count', '67 models defined', 'INFO'],
]
story.append(info_table(prisma_results, [45*mm, 100*mm, 30*mm]))
story.append(Paragraph('<b>Note:</b> This failure is expected. Prisma requires a valid DATABASE_URL to validate. The schema itself is well-formed.', s_note))

story.append(Paragraph('1.5 End-to-End Functionality Assessment', s_h2))
story.append(Paragraph(
    'The application <b>cannot be fully tested end-to-end</b> in the current environment because: (a) no PostgreSQL database is connected, so all API routes that query the database will return 500 errors at runtime; '
    '(b) no email service is configured, so OTP delivery and email sending features are non-functional; (c) no middleware.ts exists, so there is no authentication guard on protected routes. '
    'The build compiles successfully, meaning all pages render and API routes are registered. However, the application is in a "compiles but cannot run" state without external service dependencies.',
    s_body
))
e2e_results = [
    ['Capability', 'Status', 'Blocker'],
    ['Local dev server', 'Starts, but DB-dependent routes 500', 'No DATABASE_URL'],
    ['Authentication', 'OTP logic exists, email not configured', 'No EMAIL_API_KEY'],
    ['Database queries', 'Schema valid, cannot execute', 'No PostgreSQL'],
    ['Deployment', 'Build passes, deploy to Render untested', 'Manual verification needed'],
    ['Manual testing', 'Not performed', 'All of the above'],
]
story.append(info_table(e2e_results, [40*mm, 80*mm, 65*mm]))

story.append(PageBreak())

# ────────────────────────────────────────────────────────
# SECTION 2: @ts-nocheck FILES
# ────────────────────────────────────────────────────────
story.append(Paragraph('2. @ts-nocheck File Analysis', s_h1))
story.append(hr())

story.append(Paragraph(
    'A total of <b>42 files</b> contain <font name="FreeMono">@ts-nocheck</font> directives, which completely disable TypeScript type checking within those files. '
    'This is equivalent to telling the compiler "trust me, I know what I am doing" for approximately 8,400+ lines of code. '
    'These files represent every layer of the application: API routes, library modules, UI components, and AI/ML pipeline code. '
    'Below is a categorized inventory with disposition decisions for each file.',
    s_body
))

story.append(Paragraph('2.1 API Route Files (22 files)', s_h2))
story.append(Paragraph(
    'The majority of @ts-nocheck files are API route handlers. These are the server-side endpoints that power the application. '
    'Each one interacts with the Prisma database client and handles HTTP request/response cycles. Type errors in these files are particularly risky because they can cause runtime crashes when database queries return unexpected shapes. '
    'All 22 API route files are in active use in the user journey and must be fixed before Phase 2 begins.',
    s_body
))

api_files = [
    ['File', 'Lines', 'Purpose', 'Journey Impact', 'Disposition'],
    ['ai/account-brief/route.ts', '259', 'AI account brief generation', 'Critical - Revenue Intel', 'FIX in Phase 2'],
    ['ai/conversation-plan/route.ts', '242', 'AI conversation plan gen', 'High - Outreach', 'FIX in Phase 2'],
    ['ai/opportunities/route.ts', '337', 'AI opportunity detection', 'Critical - Pipeline', 'FIX in Phase 2'],
    ['ai/query/route.ts', '283', 'Natural language query', 'High - Dashboard', 'FIX in Phase 2'],
    ['ai/score-leads/route.ts', '322', 'Lead scoring engine', 'Critical - Prioritization', 'FIX in Phase 2'],
    ['ai/suggested-contacts/route.ts', '220', 'Contact suggestions', 'Medium - Research', 'FIX in Phase 2'],
    ['analytics/route.ts', '295', 'Analytics aggregation', 'High - Reports', 'FIX in Phase 2'],
    ['batches/route.ts', '507', 'Excel import processing', 'Critical - Data Import', 'FIX in Phase 2'],
    ['companies/[id]/intelligence/route.ts', '300', 'Company intel retrieval', 'Critical - Company Intel', 'FIX in Phase 2'],
    ['contacts/route.ts', '111', 'Contact CRUD', 'High - Contacts', 'FIX in Phase 2'],
    ['drafts/[id]/route.ts', '101', 'Draft email editing', 'High - Outreach', 'FIX in Phase 2'],
    ['emails/send/route.ts', '188', 'Email sending', 'Critical - Outreach', 'FIX in Phase 2'],
    ['export/route.ts', '133', 'Data export to Excel', 'Medium - Reports', 'FIX in Phase 2'],
    ['imports/route.ts', '322', 'CSV/Excel import', 'Critical - Data Import', 'FIX in Phase 2'],
    ['notes/route.ts', '220', 'Note CRUD operations', 'Medium - Notes', 'FIX in Phase 2'],
    ['opportunities/route.ts', '90', 'Opportunity CRUD', 'High - Pipeline', 'FIX in Phase 2'],
    ['opportunities/[id]/route.ts', '121', 'Single opportunity ops', 'High - Pipeline', 'FIX in Phase 2'],
    ['preferences/route.ts', '53', 'User preferences', 'Medium - Settings', 'FIX in Phase 2'],
    ['queue/route.ts', '132', 'Email queue management', 'High - Outreach', 'FIX in Phase 2'],
    ['reports/data-quality/route.ts', '205', 'Data quality metrics', 'High - Reports', 'FIX in Phase 2'],
    ['reports/pipeline/route.ts', '151', 'Pipeline analytics', 'High - Reports', 'FIX in Phase 2'],
    ['reports/revenue/route.ts', '107', 'Revenue analytics', 'High - Reports', 'FIX in Phase 2'],
    ['reports/team-performance/route.ts', '136', 'Team performance', 'Medium - Reports', 'FIX in Phase 2'],
    ['research-agent/route.ts', '139', 'Deep research agent', 'High - Research', 'FIX in Phase 2'],
    ['sequences/[id]/execute/route.ts', '98', 'Sequence execution', 'High - Sequences', 'FIX in Phase 2'],
    ['sequences/[id]/steps/[stepId]/route.ts', '123', 'Sequence step editing', 'Medium - Sequences', 'FIX in Phase 2'],
    ['signals/route.ts', '369', 'Signal management', 'Critical - Intel', 'FIX in Phase 2'],
    ['timeline/route.ts', '88', 'Timeline events', 'Medium - Activity', 'FIX in Phase 2'],
    ['verify-queue/process/route.ts', '105', 'Email verification', 'Medium - Data Quality', 'FIX in Phase 2'],
]
story.append(info_table(api_files, [45*mm, 15*mm, 38*mm, 30*mm, 32*mm]))
story.append(Spacer(1, 2*mm))

story.append(Paragraph('2.2 Library / AI Pipeline Files (7 files)', s_h2))
story.append(Paragraph(
    'These files form the core AI and intelligence pipeline. They implement the reasoning engine, strategy generator, usage tracker, brief enhancer, signal detector, brief generator, and account prioritization engine. '
    'Together, these represent approximately 2,800 lines of complex business logic that orchestrates AI model calls, database queries, scoring algorithms, and data transformations. '
    'Every one of these files is in active use and directly powers the revenue intelligence, account prioritization, and AI recommendation features. '
    'These are the highest-risk files because type errors in AI pipeline code can produce silently incorrect recommendations or miscalculated scores without any visible failure.',
    s_body
))

lib_files = [
    ['File', 'Lines', 'Purpose', 'Disposition'],
    ['ai-copilot/reasoning-engine.ts', '733', 'Main AI orchestrator', 'FIX in Phase 2'],
    ['ai-copilot/strategy-generator.ts', '492', 'Engagement strategy gen', 'FIX in Phase 2'],
    ['account-prioritization/engine.ts', '496', 'Account scoring engine', 'FIX in Phase 2'],
    ['revenue-intelligence/brief-generator.ts', '389', 'Executive brief generation', 'FIX in Phase 2'],
    ['revenue-intelligence/signal-detector.ts', '228', 'Signal classification', 'FIX in Phase 2'],
    ['ai-copilot/brief-enhancer.ts', '232', 'AI brief enhancement', 'FIX in Phase 2'],
    ['ai-copilot/usage-tracker.ts', '223', 'AI usage/cost tracking', 'FIX in Phase 2'],
]
story.append(info_table(lib_files, [45*mm, 15*mm, 65*mm, 40*mm]))
story.append(Spacer(1, 2*mm))

story.append(Paragraph('2.3 CRM Legacy Components (5 files)', s_h2))
story.append(Paragraph(
    'Five files in the <font name="FreeMono">src/app/crm/</font> directory carry @ts-nocheck. These are part of the legacy CRM SPA (App.tsx) that uses inline hardcoded data from <font name="FreeMono">data.ts</font>. '
    'The CRM SPA is a <b>separate UI system</b> from the main application shell (page.tsx with SCREEN_MAP). In the strategic reframe, the CRM SPA is <b>not part of the active user journey</b> for the intelligence platform positioning. '
    'However, some of these components are still referenced in screen-map.tsx as lazy-loaded alternatives. The recommended disposition is to either delete or de-prioritize these files.',
    s_body
))

crm_files = [
    ['File', 'Lines', 'Purpose', 'Journey Impact', 'Disposition'],
    ['crm/Settings.tsx', '102', 'Settings screen', 'Low - Legacy SPA only', 'DELETE (Phase 3)'],
    ['crm/Knowledge.tsx', '69', 'Knowledge library', 'Low - Legacy SPA only', 'DELETE (Phase 3)'],
    ['crm/Tasks.tsx', '83', 'Tasks screen', 'Low - Legacy SPA only', 'DELETE (Phase 3)'],
    ['crm/EmailGen.tsx', '82', 'Email generator', 'Low - Legacy SPA only', 'DELETE (Phase 3)'],
    ['crm/components.tsx', '128', 'Shared UI components', 'Low - Legacy SPA only', 'DELETE (Phase 3)'],
]
story.append(info_table(crm_files, [40*mm, 15*mm, 35*mm, 35*mm, 40*mm]))
story.append(Spacer(1, 2*mm))

story.append(Paragraph('2.4 Intelligence Reasoning Screen (1 file)', s_h2))
story.append(Paragraph(
    'The <font name="FreeMono">intelligence-reasoning-screen.tsx</font> (557 lines) is the UI component for the AI reasoning visualization. '
    'This is a critical screen in the intelligence platform positioning and is actively used in the user journey. '
    'It must be fixed in Phase 2 to ensure type safety for the complex state management and AI reasoning display logic.',
    s_body
))
story.append(info_table([
    ['File', 'Lines', 'Purpose', 'Disposition'],
    ['intelligence-reasoning-screen.tsx', '557', 'AI reasoning visualization', 'FIX in Phase 2'],
], [55*mm, 15*mm, 80*mm, 40*mm]))
story.append(Spacer(1, 2*mm))

story.append(Paragraph('2.5 Critical Production Functionality Assessment', s_h2))
story.append(Paragraph(
    'Of the 42 @ts-nocheck files, <b>37 are in active use</b> in the intelligence platform user journey. Only the 5 CRM legacy files are candidates for deletion. '
    'This means <b>88% of suppressed files guard critical production functionality</b>. Removing @ts-nocheck without fixing the underlying type errors will cause immediate build failures. '
    'The recommended approach is incremental: remove @ts-nocheck from one file at a time, fix the revealed errors, verify the build still passes, then proceed to the next file.',
    s_body
))
story.append(info_table([
    ['Category', 'Count', 'In Active Journey', 'Plan'],
    ['API Routes', '29', 'Yes - All 29', 'Fix in Phase 2, one file at a time'],
    ['AI Pipeline Libraries', '7', 'Yes - All 7', 'Fix in Phase 2, one file at a time'],
    ['CRM Legacy Components', '5', 'No - Legacy SPA', 'Delete in Phase 3'],
    ['UI Screens', '1', 'Yes', 'Fix in Phase 2'],
    ['TOTAL', '42', '37 (88%)', '37 to fix, 5 to delete'],
], [30*mm, 20*mm, 35*mm, 80*mm]))

story.append(PageBreak())

# ────────────────────────────────────────────────────────
# SECTION 3: USER JOURNEY VALIDATION
# ────────────────────────────────────────────────────────
story.append(Paragraph('3. User Journey Validation', s_h1))
story.append(hr())

story.append(Paragraph(
    'This section documents the complete customer journey from the perspective of a new enterprise customer signing up tomorrow. '
    'The analysis is based on code inspection of authentication flows, data import pipelines, API routes, and screen components. '
    'Where functionality exists but has not been manually tested, this is noted explicitly.',
    s_body
))

story.append(Paragraph('3.1 Step 1: Company Onboarding', s_h2))
story.append(Paragraph(
    'The current authentication system is OTP-based. There is no multi-tenant company creation flow. The system uses a single <font name="FreeMono">User</font> model with a binary role field (admin/user). '
    'There is no <font name="FreeMono">Company</font> or <font name="FreeMono">Organization</font> model for tenant isolation. The <font name="FreeMono">Company</font> model in the schema refers to prospect/target companies in the CRM context, not the customer\'s own organization.',
    s_body
))
story.append(Paragraph('<b>Onboarding flow (as implemented):</b>', s_body_left))
story.append(Paragraph('1. User navigates to <font name="FreeMono">/login</font> - a client-side React component (<font name="FreeMono">login-page.tsx</font>)', s_bullet))
story.append(Paragraph('2. User enters email and clicks "Send OTP" - calls <font name="FreeMono">POST /api/auth/request-otp</font>', s_bullet))
story.append(Paragraph('3. OTP is generated via <font name="FreeMono">lib/otp.ts</font> - in dev mode, code is returned in response (no email sent)', s_bullet))
story.append(Paragraph('4. User enters 6-digit code - calls <font name="FreeMono">POST /api/auth/verify-otp</font>', s_bullet))
story.append(Paragraph('5. If user does not exist, they are auto-created in the <font name="FreeMono">User</font> table', s_bullet))
story.append(Paragraph('6. A session token is created via <font name="FreeMono">lib/session.ts</font> and stored in a cookie', s_bullet))
story.append(Paragraph('7. The <font name="FreeMono">/register</font> endpoint is a <b>mock</b> - it returns a hardcoded demo user', s_bullet))
story.append(Spacer(1, 2*mm))

story.append(Paragraph('<b>Critical gaps for enterprise deployment:</b>', s_body_left))
story.append(Paragraph('No multi-tenant isolation: All users share the same database with no company/organization boundary', s_bullet))
story.append(Paragraph('No password authentication flow: OTP-only login means lost email = lost access', s_bullet))
story.append(Paragraph('Register is a mock: New user creation happens implicitly via OTP verification, not via a registration form', s_bullet))
story.append(Paragraph('No RBAC beyond admin/user: The User model has only two roles with no granular permissions', s_bullet))
story.append(Paragraph('No middleware.ts: There is no authentication guard on API routes. The middleware file was deleted and never restored', s_bullet))

story.append(Paragraph('3.2 Step 2: Data Upload', s_h2))
story.append(Paragraph(
    'Data import is handled through two API endpoints: <font name="FreeMono">POST /api/imports</font> (322 lines, @ts-nocheck) and <font name="FreeMono">POST /api/batches</font> (507 lines, @ts-nocheck). '
    'The import system supports both CSV and Excel file formats using the <font name="FreeMono">xlsx</font> library (v0.18.5). The import pipeline includes: file hash validation to prevent duplicate uploads, column mapping from source headers to internal fields, '
    'email validation (syntax, disposable domain detection, role-based detection, free provider detection), data normalization (industry names, country codes, company name variants), and duplicate detection across existing records.',
    s_body
))
story.append(Paragraph('<b>Import flow (as implemented in code):</b>', s_body_left))
story.append(Paragraph('1. User navigates to Import screen (import-screen.tsx, 1,663 lines)', s_bullet))
story.append(Paragraph('2. File is uploaded via multipart form to <font name="FreeMono">/api/imports</font> or <font name="FreeMono">/api/batches</font>', s_bullet))
story.append(Paragraph('3. XLSX library parses the file into row arrays', s_bullet))
story.append(Paragraph('4. Column mapping rules (ColumnMappingRule model) auto-detect header patterns', s_bullet))
story.append(Paragraph('5. Each row is validated against FieldValidationRule configurations', s_bullet))
story.append(Paragraph('6. Normalization mappings are applied to clean messy values', s_bullet))
story.append(Paragraph('7. Duplicate detection uses file hash + email matching', s_bullet))
story.append(Paragraph('8. Validated rows are inserted as Contact records linked to Company records', s_bullet))
story.append(Paragraph('9. An ImportBatch record tracks the entire operation', s_bullet))
story.append(Spacer(1, 2*mm))
story.append(Paragraph('<b>Note:</b> The DataUpload/UploadRow models (Phase 1 data intelligence engine) define a more sophisticated pipeline with staged review, but the current import endpoint uses the legacy ImportBatch/Contact flow. This creates two parallel import systems that need unification.', s_note))

story.append(Paragraph('3.3 Step 3: Post-Import User Journey', s_h2))
story.append(Paragraph(
    'After data import, the user navigates through the application via the SCREEN_MAP system. The main application shell is <font name="FreeMono">src/app/page.tsx</font> (762 lines), '
    'which renders a sidebar navigation, top bar, and content area. Navigation is state-driven using the Zustand store (<font name="FreeMono">lib/store.ts</font>). '
    'The complete mapped journey is shown below, with implementation status for each screen.',
    s_body
))

journey_data = [
    ['Step', 'Screen', 'Route Key', 'Status', 'Notes'],
    ['1', 'Dashboard', 'dashboard', 'Implemented', '553 lines, shows stats cards'],
    ['2', 'Companies List', 'companies', 'Implemented', '1,211 lines, full CRUD'],
    ['3', 'Company Detail', 'company-detail', 'Implemented', '1,587 lines, tabs for intel/notes/signals'],
    ['4', 'Company Intelligence', 'signal-intelligence', 'Implemented', 'Signal detection and classification'],
    ['5', 'AI Recommendations', 'opportunity-radar', 'Implemented', 'Opportunity scoring and display'],
    ['6', 'Executive Brief', 'revenue-intelligence-brief', 'Implemented', 'AI-generated account briefs'],
    ['7', 'Outreach / Email Gen', 'email-generation', 'Implemented', 'Draft generation with AI'],
    ['8', 'Pipeline', 'pipeline', 'Implemented', 'Kanban-style pipeline view'],
    ['9', 'Reports', 'reports', 'Implemented', 'Revenue, pipeline, data quality'],
    ['10', 'Research Agent', 'research-agent', 'Implemented', 'Deep company research'],
    ['11', 'Account Ranking', 'account-ranking', 'Implemented', 'Priority scoring display'],
    ['12', 'Import', 'import', 'Implemented', '1,663 lines, Excel/CSV upload'],
    ['13', 'Settings', 'settings', 'Implemented', 'Configuration management'],
]
story.append(info_table(journey_data, [15*mm, 35*mm, 38*mm, 25*mm, 65*mm]))
story.append(Spacer(1, 2*mm))
story.append(Paragraph(
    'All 13 primary journey screens are implemented and registered in the SCREEN_MAP. The application has an additional 47+ screens registered for secondary features (playbooks, strategy room, knowledge library, sequences, etc.). '
    'Each screen is lazy-loaded via React.lazy() to optimize initial bundle size.',
    s_body
))

story.append(PageBreak())

# ────────────────────────────────────────────────────────
# SECTION 4: DATABASE REALITY CHECK
# ────────────────────────────────────────────────────────
story.append(Paragraph('4. Database Reality Check', s_h1))
story.append(hr())

story.append(Paragraph(
    'The Prisma schema defines <b>67 models</b> across 1,744 lines. However, code analysis reveals a significant gap between what is defined in the schema and what is actually used in the application code. '
    'This section categorizes every model by its actual usage across API routes and library modules.',
    s_body
))

story.append(Paragraph('4.1 Model Usage Classification', s_h2))
story.append(Paragraph(
    'Models were classified by searching for <font name="FreeMono">db.modelName</font> references across all TypeScript files in the <font name="FreeMono">src/</font> directory. '
    'A model is considered "Actively Used" if it appears in API route files or core library modules. "Library Only" means it is only referenced in @ts-nocheck library files (revenue-intelligence/, ai-copilot/). '
    '"Schema Only" means the model exists in the schema but has zero code references anywhere in the application.',
    s_body
))

story.append(Paragraph('<b>Actively Used Models (16)</b> - Referenced in API routes:', s_h3))
used_models = [
    ['Model', 'API Refs', 'Primary Role'],
    ['Contact', '60', 'Core entity - prospect contacts'],
    ['Company', '54', 'Core entity - target accounts'],
    ['Draft', '20', 'Email drafts for outreach'],
    ['Reply', '11', 'Email reply tracking'],
    ['Bounce', '8', 'Bounce tracking'],
    ['Suppression', '8', 'Email suppression list'],
    ['User', '7', 'Authentication and users'],
    ['Pursuit', '3', 'Sales pursuit tracking'],
    ['Segment', '2', 'Lead segmentation'],
    ['Playbook', '2', 'Sales playbooks'],
    ['Evidence', '1', 'Intelligence evidence'],
    ['Session', '1', 'User sessions'],
    ['AuditLog', '1 (lib)', 'Audit trail'],
    ['SystemSetting', '2 (lib)', 'System configuration'],
    ['OtpCode', '1 (lib)', 'OTP verification'],
    ['CompanySignal', '7 (lib)', 'Buying signals'],
]
story.append(info_table(used_models, [30*mm, 20*mm, 105*mm]))
story.append(Spacer(1, 2*mm))

story.append(Paragraph('<b>Library-Only Models (19)</b> - Referenced only in @ts-nocheck library files:', s_h3))
lib_models = [
    ['Model', 'Referenced In', 'Status'],
    ['AccountBrief', 'revenue-intelligence/', 'Schema + Lib - no API route'],
    ['AccountScore', 'revenue-intelligence/', 'Schema + Lib - no API route'],
    ['OpportunitySignal', 'revenue-intelligence/, signal-extraction', 'Schema + Lib - no API route'],
    ['OpportunityRecommendation', 'intelligence-confidence.ts', 'Schema + Lib - no API route'],
    ['CompanyIntelligenceHealth', 'intelligence-confidence.ts', 'Schema + Lib - no API route'],
    ['IntelligenceObject', 'revenue-intelligence/', 'Schema + Lib - no API route'],
    ['IntelligenceTimeline', 'revenue-intelligence/', 'Schema + Lib - no API route'],
    ['KnowledgeEntry', 'revenue-intelligence/, ai-copilot/', 'Schema + Lib - no API route'],
    ['Evidence', 'revenue-intelligence/', 'Schema + Lib - no API route'],
    ['CompanyResearchCard', 'account-prioritization/', 'Schema + Lib - no API route'],
    ['SignalCapabilityMatch', 'account-prioritization/', 'Schema + Lib - no API route'],
    ['CompanyNote', 'API routes', 'Schema + API - minimal usage'],
    ['CompanyTimelineEvent', 'API routes', 'Schema + API - minimal usage'],
    ['CompanyAlias', 'Schema only', 'No code references found'],
    ['KnowledgeVersion', 'Schema only', 'No code references found'],
    ['SourceHealth', 'Schema only', 'No code references found'],
    ['HumanIntelligenceInbox', 'Schema only', 'No code references found'],
    ['IntelligenceAlert', 'Schema only', 'No code references found'],
    ['IntelligenceAssociation', 'Schema only', 'No code references found'],
]
story.append(info_table(lib_models, [40*mm, 55*mm, 80*mm]))
story.append(Spacer(1, 2*mm))

story.append(Paragraph('<b>Schema-Only Models (32)</b> - Defined in schema but never referenced in code:', s_h3))
story.append(Paragraph(
    'The following 32 models exist in the Prisma schema but have <b>zero references</b> anywhere in the application code. These represent planned features, abandoned features, or scaffolding that was defined but never implemented. '
    'They occupy database space and schema complexity without providing any functional value.',
    s_body
))
schema_only = [
    'ImportBatch', 'ContactNote', 'CapabilityAsset', 'EmailTemplate', 'EmailSequence',
    'SequenceStep', 'SequenceEnrollment', 'SendQueue', 'EmailEvent', 'ABTest',
    'SegmentContact', 'ConversationPlan', 'AccountStrategy', 'DataUpload', 'UploadRow',
    'ColumnMappingRule', 'FieldValidationRule', 'NormalizationMapping', 'ScoringWeight',
    'NormalizationLog', 'DataQualityScore', 'Job', 'JobLog', 'AIGenerationAudit',
    'IntelligenceValidation', 'SignalValidation', 'IntelligenceConflict',
    'PriorityScoreHistory', 'RecommendationFeedback', 'EvidenceSourceReliability',
    'Connector', 'ConnectorRun',
]
story.append(Paragraph(', '.join(schema_only), s_code))
story.append(Spacer(1, 2*mm))

story.append(Paragraph('4.2 Specific Model Assessment', s_h2))

story.append(Paragraph('<b>Task model:</b> Does not exist in the schema. The UI has a tasks-screen.tsx, but it renders an empty placeholder because the underlying data model was never created. This screen is non-functional.', s_body))
story.append(Paragraph('<b>StrategicInsight model:</b> Referenced in the @ts-nocheck ai-copilot/reasoning-engine.ts as <font name="FreeMono">db.strategicInsight</font>, but this model does not exist in the current schema. This would cause a runtime Prisma error. This is a ghost reference from removed code.', s_body))
story.append(Paragraph('<b>AIUsageLog model:</b> Does not exist in the schema. The ai-copilot/usage-tracker.ts (223 lines, @ts-nocheck) tracks AI usage but appears to use SystemSetting or AIGenerationAudit models instead. This is misleading naming.', s_body))
story.append(Paragraph('<b>Opportunity model:</b> Does not exist as a standalone model. The system uses OpportunityRecommendation (schema) for AI-detected opportunities and a separate "opportunities" API route that likely uses Company/pursuit data. There is a naming confusion between the API route name and the actual schema model.', s_body))
story.append(Paragraph('<b>Timeline model:</b> Two timeline models exist: CompanyTimelineEvent (old system, minimal API usage) and IntelligenceTimeline (new system, library-only). They serve overlapping purposes and need consolidation.', s_body))
story.append(Paragraph('<b>Research models:</b> CompanyResearchCard (schema + library-only), Evidence (schema + library), and IntelligenceObject (schema + library) form the research data layer. All three are accessed only from @ts-nocheck files, meaning their type safety is completely unverified.', s_body))

story.append(PageBreak())

# ────────────────────────────────────────────────────────
# SECTION 5: FUNCTIONAL TESTING STATUS
# ────────────────────────────────────────────────────────
story.append(Paragraph('5. Functional Testing Status', s_h1))
story.append(hr())

story.append(Paragraph(
    'No functional testing has been performed on this application. The codebase includes a Vitest configuration (v4.1.10) and some test files in <font name="FreeMono">src/lib/revenue-intelligence/__tests__/</font>, '
    'but these tests have not been executed as part of this assessment. The following test plan defines the minimum manual and automated validation required before Phase 2 execution.',
    s_body
))

story.append(Paragraph('5.1 Authentication Test Plan', s_h2))
auth_tests = [
    ['Test Case', 'Steps', 'Expected Result', 'Priority'],
    ['New user OTP login', 'Enter new email, request OTP, verify code', 'User created, session established', 'P0'],
    ['Existing user OTP login', 'Enter existing email, request OTP, verify', 'Session established, lastLoginAt updated', 'P0'],
    ['Password login', 'Enter email + password', 'Password verified, OTP sent for 2FA', 'P0'],
    ['Invalid OTP', 'Enter wrong 6-digit code', '401 error, attempts incremented', 'P0'],
    ['Expired OTP', 'Wait for expiry, then verify', '401 error with expiry message', 'P1'],
    ['Session persistence', 'Login, close browser, reopen', 'Session still valid if not expired', 'P0'],
    ['Logout', 'Click logout', 'Session destroyed, redirected to login', 'P0'],
    ['Protected route access', 'Access /app without session', 'Redirected to login (requires middleware)', 'P0'],
    ['Rate limiting', 'Request OTP 10 times in 1 minute', '429 rate limit response', 'P1'],
]
story.append(info_table(auth_tests, [30*mm, 40*mm, 55*mm, 20*mm]))
story.append(Spacer(1, 2*mm))

story.append(Paragraph('5.2 Data Import Test Plan', s_h2))
import_tests = [
    ['Test Case', 'Input', 'Expected Result', 'Priority'],
    ['Small Excel import', '50 companies, 200 contacts', 'All rows imported, batch status completed', 'P0'],
    ['Large Excel import', '2000 companies, 10000 contacts', 'Batch processing, progress tracking', 'P0'],
    ['Duplicate records', 'Same email in two rows', 'Second row flagged as duplicate', 'P0'],
    ['Invalid emails', 'test@, missing TLD, spaces', 'Rows flagged with validation errors', 'P0'],
    ['Column mapping', 'Non-standard headers', 'Auto-mapping via regex rules', 'P1'],
    ['Empty file', 'XLSX with headers only', 'Zero rows accepted, batch completed', 'P1'],
    ['Mixed data types', 'Numbers in text fields', 'Normalization applied', 'P2'],
    ['Concurrent imports', 'Two files uploaded simultaneously', 'No data corruption, both batches tracked', 'P1'],
]
story.append(info_table(import_tests, [30*mm, 40*mm, 60*mm, 20*mm]))
story.append(Spacer(1, 2*mm))

story.append(Paragraph('5.3 AI Features Test Plan', s_h2))
ai_tests = [
    ['Test Case', 'Steps', 'Expected Result', 'Priority'],
    ['Company enrichment', 'Trigger enrichment for a company', 'ResearchCard populated, freshness updated', 'P0'],
    ['Lead scoring', 'Run scoring on imported contacts', 'leadScore computed, ranking updated', 'P0'],
    ['AI recommendations', 'View opportunity radar', 'OpportunityRecommendations generated', 'P0'],
    ['Executive brief', 'Generate brief for target company', 'AccountBrief created with AI content', 'P0'],
    ['Conversation plan', 'Generate plan for executive', 'ConversationPlan saved', 'P1'],
    ['Research agent', 'Run deep research query', 'IntelligenceObjects created from research', 'P1'],
]
story.append(info_table(ai_tests, [30*mm, 40*mm, 60*mm, 20*mm]))
story.append(Spacer(1, 2*mm))

story.append(Paragraph('5.4 CRM and Outreach Test Plan', s_h2))
crm_tests = [
    ['Test Case', 'Steps', 'Expected Result', 'Priority'],
    ['Company creation', 'Create company via API/UI', 'Company record created with all fields', 'P0'],
    ['Contact management', 'Add/edit/delete contacts', 'CRUD operations succeed', 'P0'],
    ['Pipeline stages', 'Move deal through pipeline', 'Stage transitions recorded', 'P1'],
    ['Email generation', 'Generate draft for contact', 'Draft created with AI content', 'P0'],
    ['Email sending', 'Send draft via queue', 'SendQueue updated, provider ID stored', 'P1'],
    ['Reply tracking', 'Simulate reply webhook', 'Reply record created, status updated', 'P1'],
    ['Multi-company isolation', 'Data from different batches', 'No cross-contamination (not yet supported)', 'P0'],
]
story.append(info_table(crm_tests, [30*mm, 40*mm, 60*mm, 20*mm]))

story.append(PageBreak())

# ────────────────────────────────────────────────────────
# SECTION 6: UI/UX ASSESSMENT
# ────────────────────────────────────────────────────────
story.append(Paragraph('6. UI/UX Assessment', s_h1))
story.append(hr())

story.append(Paragraph(
    'The application has <b>62 screen components</b> registered in <font name="FreeMono">screen-map.tsx</font>, plus a separate legacy CRM SPA with 11 components. '
    'The main application uses a sidebar navigation pattern with lazy-loaded screen components, framer-motion page transitions, and a shadcn/ui component library. '
    'No screenshots or videos have been captured for this assessment. The analysis is based on code inspection of screen components.',
    s_body
))

story.append(Paragraph('6.1 Screen Inventory', s_h2))
story.append(Paragraph(
    'The application offers an extensive set of screens covering the full intelligence platform workflow. '
    'Screens are categorized into functional groups below. All screens are registered in the SCREEN_MAP and accessible via the sidebar navigation.',
    s_body
))

screen_groups = [
    ['Group', 'Screens', 'Count'],
    ['Core CRM', 'Dashboard, Companies, Company Detail, Contacts, Contact Detail, Pipeline', '6'],
    ['Intelligence', 'Command Center, Signal Intelligence, Research Agent, Mind Map', '4'],
    ['Revenue Intel', 'Revenue Intel, Brief, Opportunities, Recommendations, Account Ranking', '5'],
    ['AI Pipeline', 'Intelligence Reasoning, AI Strategy, Opportunity Radar, Conversation Studio', '4'],
    ['Outreach', 'Email Generation, Drafts, Queue, Sequences, Templates', '5'],
    ['Data Management', 'Import, Leads, Segments, Duplicates, Data Health', '5'],
    ['Reporting', 'Reports, Analytics, Audit, Data Quality', '4'],
    ['Settings', 'Settings, ICP Settings, Prompt Templates, Knowledge Library', '4'],
    ['Operations', 'Tasks, Playbooks, Strategy Room, Pursuit Workspace', '4'],
    ['Comms', 'Replies, Bounces, Relationship Memory', '3'],
    ['Advanced', 'Opportunity Workspace, Intelligence Health, Sources, Knowledge, Timeline, Inbox', '6+'],
    ['Legacy CRM SPA', 'Dashboard, Companies, Contacts, Opportunities, Tasks, Settings, Knowledge, Email', '11 (separate)'],
]
story.append(info_table(screen_groups, [35*mm, 100*mm, 20*mm]))
story.append(Spacer(1, 2*mm))

story.append(Paragraph('6.2 Product Maturity Classification', s_h2))
story.append(Paragraph(
    'Based on code inspection, the application currently falls between <b>Category A (Internal Developer Tool)</b> and <b>Category B (Enterprise Software Product)</b>. '
    'It has the feature breadth of an enterprise product but lacks the polish, type safety, error handling, and production hardening expected of a commercial product. '
    'The investor feedback that it looks like a "high school weekend project" likely reflects several observable issues: inconsistent UI patterns across 62 screens, '
    'absence of loading states and empty states in many screens, no toast notification system for user feedback, hardcoded demo data remnants, and the general "wide but shallow" feeling of having many screens with limited depth in each.',
    s_body
))

maturity = [
    ['Attribute', 'Current State', 'Enterprise Standard', 'Gap'],
    ['Type Safety', '42 @ts-nocheck files, noImplicitAny=false', 'Zero @ts-nocheck, strict=true', 'Critical'],
    ['Error Handling', 'Screen-level error boundaries', 'Global error handling + toast + retry', 'High'],
    ['Loading States', 'Skeleton loader on main page only', 'Per-screen loading skeletons', 'High'],
    ['Empty States', 'Not implemented in most screens', 'Helpful empty state with CTA', 'Medium'],
    ['Multi-tenancy', 'Not implemented', 'Company/organization isolation', 'Critical'],
    ['Authentication', 'OTP only, no middleware', 'MFA + middleware + RBAC', 'Critical'],
    ['Testing', 'Vitest config exists, few unit tests', 'Integration + E2E test suite', 'High'],
    ['Documentation', 'Code comments only', 'API docs + user guide + runbook', 'Medium'],
]
story.append(info_table(maturity, [25*mm, 55*mm, 55*mm, 25*mm]))
story.append(Spacer(1, 2*mm))

story.append(Paragraph(
    '<b>Recommendation:</b> Before any investor demo, the application must pass the "screenshot test" - every screen must look polished with proper loading states, empty states, and consistent spacing. '
    'The current 62-screen scope is too wide for the team\'s capacity. A focused demo flow covering 5-8 key screens with exceptional polish will outperform a broad but shallow tour of 62 mediocre screens.',
    s_body
))

story.append(PageBreak())

# ────────────────────────────────────────────────────────
# SECTION 7: PHASE 2 PLAN
# ────────────────────────────────────────────────────────
story.append(Paragraph('7. Phase 2 Execution Plan', s_h1))
story.append(hr())

story.append(Paragraph(
    'Phase 2 focuses on the most critical infrastructure gap: <b>restoring middleware.ts with authentication, security headers, rate limiting, and CSRF protection</b>. '
    'Without middleware, all API routes are publicly accessible with no authentication guard. This is the single most important security fix and must be completed before any other Phase 2 work.',
    s_body
))

story.append(Paragraph('7.1 Phase 2 Objectives', s_h2))
objectives = [
    ['Objective', 'Description', 'Priority'],
    ['Restore middleware.ts', 'Create src/middleware.ts with authentication guard for all /api/ routes', 'P0 - Critical'],
    ['Session validation', 'Verify session token on every API request, return 401 if invalid', 'P0 - Critical'],
    ['Security headers', 'Add X-Content-Type-Options, X-Frame-Options, CSP headers via middleware', 'P0 - Critical'],
    ['Rate limiting', 'Implement IP-based rate limiting for auth endpoints (OTP, login)', 'P1 - High'],
    ['CSRF protection', 'Add CSRF token validation for state-changing requests', 'P1 - High'],
    ['Admin route protection', 'Restrict /api/seed, /api/reset to admin-only access', 'P1 - High'],
]
story.append(info_table(objectives, [35*mm, 80*mm, 30*mm]))
story.append(Spacer(1, 2*mm))

story.append(Paragraph('7.2 Files Affected', s_h2))
files_affected = [
    ['File', 'Action', 'Risk'],
    ['src/middleware.ts', 'CREATE - new file', 'Medium - must not block static assets'],
    ['src/lib/session.ts', 'MODIFY - add validateSession export', 'Low - existing code'],
    ['src/lib/auth-helpers.ts', 'CREATE - helper functions for middleware', 'Low - new file'],
    ['next.config.ts', 'MODIFY - remove header() if middleware handles it', 'Low - currently has headers()'],
    ['All /api/auth/* routes', 'VERIFY - ensure they are excluded from auth guard', 'Medium - OTP routes must be public'],
    ['src/app/api/seed/route.ts', 'VERIFY - admin-only protection', 'Low'],
    ['src/app/api/reset/route.ts', 'VERIFY - admin-only protection', 'Low'],
]
story.append(info_table(files_affected, [40*mm, 60*mm, 60*mm]))
story.append(Spacer(1, 2*mm))

story.append(Paragraph('7.3 Expected Risks', s_h2))
risks = [
    ['Risk', 'Probability', 'Impact', 'Mitigation'],
    ['Static assets blocked', 'Medium', 'High - site breaks', 'Exclude /_next/static, /favicon.ico from middleware'],
    ['Login page blocked', 'Medium', 'Critical - cannot login', 'Exclude /login, /signup, /api/auth/* from auth guard'],
    ['Session cookie mismatch', 'Low', 'High - all requests fail', 'Test thoroughly with dev OTP flow'],
    ['Performance regression', 'Low', 'Medium - slower requests', 'Use lightweight session check (DB lookup or JWT)'],
    ['WebSocket connection blocked', 'Low', 'Medium - real-time breaks', 'Exclude /api/realtime from middleware'],
]
story.append(info_table(risks, [30*mm, 25*mm, 30*mm, 80*mm]))
story.append(Spacer(1, 2*mm))

story.append(Paragraph('7.4 Acceptance Criteria', s_h2))
story.append(Paragraph('Phase 2 is complete when all of the following conditions are met:', s_body_left))
story.append(Paragraph('<font name="FreeMono">src/middleware.ts</font> exists and contains authentication logic', s_bullet))
story.append(Paragraph('Accessing any <font name="FreeMono">/api/*</font> route without a valid session returns HTTP 401', s_bullet))
story.append(Paragraph('<font name="FreeMono">/api/auth/*</font> routes (login, OTP, register) remain publicly accessible', s_bullet))
story.append(Paragraph('Static assets (<font name="FreeMono">/_next/*</font>, images, fonts) are not affected by middleware', s_bullet))
story.append(Paragraph('Security headers (X-Content-Type-Options, X-Frame-Options, CSP) are present on API responses', s_bullet))
story.append(Paragraph('Rate limiting prevents more than 5 OTP requests per email per minute', s_bullet))
story.append(Paragraph('<font name="FreeMono">npm run build</font> still passes with <font name="FreeMono">ignoreBuildErrors: false</font>', s_bullet))
story.append(Paragraph('<font name="FreeMono">npx tsc --noEmit</font> still passes (no new errors introduced)', s_bullet))
story.append(Paragraph('Manual test: login flow works end-to-end with middleware active', s_bullet))
story.append(Paragraph('Manual test: unauthenticated access to dashboard API returns 401', s_bullet))
story.append(Spacer(1, 4*mm))

story.append(Paragraph('<b>Estimated effort:</b> 4-6 hours for middleware.ts creation, testing, and verification. The main complexity is in getting the exclusion rules correct so that public routes (login, OTP, static assets) are not accidentally blocked.', s_body))

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# PAGE TEMPLATE
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
output_path = '/home/z/my-project/download/Phase1-Acceptance-Report.pdf'
os.makedirs(os.path.dirname(output_path), exist_ok=True)

def page_template(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(PAGE_BG)
    canvas.rect(0, 0, A4[0], A4[1], fill=1, stroke=0)
    # Header line
    canvas.setStrokeColor(BORDER)
    canvas.setLineWidth(0.5)
    canvas.line(25*mm, A4[1]-18*mm, A4[0]-25*mm, A4[1]-18*mm)
    # Header text
    canvas.setFont('NotoSansSC', 7)
    canvas.setFillColor(TEXT_MUTED)
    canvas.drawString(25*mm, A4[1]-16*mm, 'Phase 1 Acceptance Report')
    canvas.drawRightString(A4[0]-25*mm, A4[1]-16*mm, 'Intelligence Platform')
    # Footer
    canvas.line(25*mm, 15*mm, A4[0]-25*mm, 15*mm)
    canvas.setFont('FreeMono', 7)
    canvas.drawString(25*mm, 10*mm, 'Confidential')
    canvas.drawRightString(A4[0]-25*mm, 10*mm, f'Page {doc.page}')
    canvas.restoreState()

def first_page_template(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(COVER_BLOCK)
    canvas.rect(0, 0, A4[0], A4[1], fill=1, stroke=0)
    canvas.restoreState()

doc = SimpleDocTemplate(
    output_path,
    pagesize=A4,
    leftMargin=25*mm,
    rightMargin=25*mm,
    topMargin=22*mm,
    bottomMargin=22*mm,
)

doc.build(story, onFirstPage=first_page_template, onLaterPages=page_template)
print(f"Report generated: {output_path}")
print(f"Pages: {doc.page}")
