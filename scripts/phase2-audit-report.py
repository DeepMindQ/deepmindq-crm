#!/usr/bin/env python3
"""
Phase 2 Pre-Approval Audit Report — 5-Section Comprehensive Analysis
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'skills', 'pdf', 'scripts'))
from pdf import install_font_fallback

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
from reportlab.lib.units import mm, inch
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, KeepTogether
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase.pdfmetrics import registerFontFamily
import platform, hashlib

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# FONT REGISTRATION
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FONT_DIR = '/usr/share/fonts'
pdfmetrics.registerFont(TTFont('NotoSerifSC', f'{FONT_DIR}/truetype/noto-serif-sc/NotoSerifSC-Regular.ttf'))
pdfmetrics.registerFont(TTFont('NotoSerifSC-Bold', f'{FONT_DIR}/truetype/noto-serif-sc/NotoSerifSC-Bold.ttf'))
# NotoSansSC variable font not supported by ReportLab TTFont, skip
pdfmetrics.registerFont(TTFont('FreeSerif', f'{FONT_DIR}/truetype/freefont/FreeSerif.ttf'))
pdfmetrics.registerFont(TTFont('FreeSerif-Bold', f'{FONT_DIR}/truetype/freefont/FreeSerifBold.ttf'))
pdfmetrics.registerFont(TTFont('FreeSerif-Italic', f'{FONT_DIR}/truetype/freefont/FreeSerifItalic.ttf'))
pdfmetrics.registerFont(TTFont('FreeSerif-BoldItalic', f'{FONT_DIR}/truetype/freefont/FreeSerifBoldItalic.ttf'))
pdfmetrics.registerFont(TTFont('DejaVuSans', f'{FONT_DIR}/truetype/dejavu/DejaVuSans.ttf'))
pdfmetrics.registerFont(TTFont('SarasaMonoSC', f'{FONT_DIR}/truetype/chinese/SarasaMonoSC-Regular.ttf'))

registerFontFamily('NotoSerifSC', normal='NotoSerifSC', bold='NotoSerifSC-Bold')
registerFontFamily('FreeSerif', normal='FreeSerif', bold='FreeSerif-Bold', italic='FreeSerif-Italic', boldItalic='FreeSerif-BoldItalic')
registerFontFamily('DejaVuSans', normal='DejaVuSans', bold='DejaVuSans')
install_font_fallback()

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# CASCADE PALETTE
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PAGE_BG       = colors.HexColor('#f1f0ef')
SECTION_BG    = colors.HexColor('#e9e9e7')
CARD_BG       = colors.HexColor('#f0efed')
TABLE_STRIPE  = colors.HexColor('#f4f3f1')
HEADER_FILL   = colors.HexColor('#6d654c')
COVER_BLOCK   = colors.HexColor('#746c54')
BORDER        = colors.HexColor('#d6d3c9')
ICON          = colors.HexColor('#877747')
ACCENT        = colors.HexColor('#907422')
ACCENT_2      = colors.HexColor('#785fc1')
TEXT_PRIMARY   = colors.HexColor('#161614')
TEXT_MUTED     = colors.HexColor('#838179')
SEM_SUCCESS   = colors.HexColor('#3f8e59')
SEM_WARNING   = colors.HexColor('#ab8740')
SEM_ERROR     = colors.HexColor('#9e4d45')
SEM_INFO      = colors.HexColor('#516c88')

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# STYLES
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
W = A4[0]
H = A4[1]
MARGIN = 50
AVAILABLE = W - 2 * MARGIN  # available content width

cover_title = ParagraphStyle('CoverTitle', fontName='FreeSerif-Bold', fontSize=32, leading=40, alignment=TA_LEFT, textColor=TEXT_PRIMARY, spaceAfter=12)
cover_sub = ParagraphStyle('CoverSub', fontName='FreeSerif', fontSize=14, leading=20, textColor=TEXT_MUTED, spaceAfter=6)
cover_meta = ParagraphStyle('CoverMeta', fontName='FreeSerif-Italic', fontSize=11, leading=16, textColor=TEXT_MUTED)
h1_style = ParagraphStyle('H1', fontName='FreeSerif-Bold', fontSize=20, leading=28, textColor=TEXT_PRIMARY, spaceBefore=18, spaceAfter=10)
h2_style = ParagraphStyle('H2', fontName='FreeSerif-Bold', fontSize=15, leading=22, textColor=HEADER_FILL, spaceBefore=14, spaceAfter=8)
h3_style = ParagraphStyle('H3', fontName='FreeSerif-Bold', fontSize=12, leading=18, textColor=ICON, spaceBefore=10, spaceAfter=6)
body_style = ParagraphStyle('Body', fontName='FreeSerif', fontSize=10.5, leading=18, alignment=TA_JUSTIFY, textColor=TEXT_PRIMARY)
body_left = ParagraphStyle('BodyLeft', fontName='FreeSerif', fontSize=10.5, leading=18, alignment=TA_LEFT, textColor=TEXT_PRIMARY)
code_style = ParagraphStyle('Code', fontName='SarasaMonoSC', fontSize=8.5, leading=13, textColor=TEXT_PRIMARY, backColor=CARD_BG)
caption_style = ParagraphStyle('Caption', fontName='FreeSerif-Italic', fontSize=9, leading=14, textColor=TEXT_MUTED, alignment=TA_CENTER)
callout_style = ParagraphStyle('Callout', fontName='FreeSerif', fontSize=10, leading=16, textColor=ACCENT, leftIndent=18, borderPadding=6, borderColor=ACCENT, borderWidth=2, borderRadius=4, backColor=colors.HexColor('#fdf8ef'))

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# HELPERS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def safe_keep(elements):
    """Keep heading + first element together, rest flows."""
    if len(elements) >= 2:
        return [KeepTogether(elements[:2])] + list(elements[2:])
    return elements

def section_heading(text):
    return Paragraph(text, h1_style)

def subsection_heading(text):
    return Paragraph(text, h2_style)

def sub3_heading(text):
    return Paragraph(text, h3_style)

def body(text):
    return Paragraph(text, body_style)

def body_l(text):
    return Paragraph(text, body_left)

def callout(text):
    return Paragraph(text, callout_style)

def spacer(h=12):
    return Spacer(1, h)

def make_table(headers, rows, col_widths=None):
    """Create a styled table."""
    available = AVAILABLE
    cw = col_widths or [available * r for r in [0.28, 0.10, 0.30, 0.32]]
    hdr = [Paragraph(f'<b>{h}</b>', ParagraphStyle('TH', fontName='FreeSerif-Bold', fontSize=9, leading=12, textColor=colors.white, alignment=TA_LEFT)) for h in headers]
    data = [hdr]
    for row in rows:
        data.append([Paragraph(str(c), ParagraphStyle('TD', fontName='FreeSerif', fontSize=8.5, leading=12, textColor=TEXT_PRIMARY)) for c in row])
    t = Table(data, colWidths=cw, repeatRows=1)
    style_cmds = [
        ('BACKGROUND', (0, 0), (-1, 0), HEADER_FILL),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'FreeSerif-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 9),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
        ('TOPPADDING', (0, 0), (-1, 0), 8),
        ('GRID', (0, 0), (-1, -1), 0.5, BORDER),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 1), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 5),
    ]
    for i in range(1, len(data)):
        bg = colors.white if i % 2 == 1 else TABLE_STRIPE
        style_cmds.append(('BACKGROUND', (0, i), (-1, i), bg))
    t.setStyle(TableStyle(style_cmds))
    return t

def verdict_table(title, items):
    """Status table for a section."""
    rows = []
    for label, status, note in items:
        color = SEM_SUCCESS if status == 'PASS' else SEM_ERROR if status == 'FAIL' else SEM_WARNING
        status_text = f'<font color="{color.hexval()}">{status}</font>'
        rows.append([label, status_text, note])
    t_data = [[Paragraph(f'<b>Item</b>', ParagraphStyle('TH2', fontName='FreeSerif-Bold', fontSize=9, textColor=colors.white)),
               Paragraph(f'<b>Status</b>', ParagraphStyle('TH3', fontName='FreeSerif-Bold', fontSize=9, textColor=colors.white, alignment=TA_CENTER)),
               Paragraph(f'<b>Notes</b>', ParagraphStyle('TH4', fontName='FreeSerif-Bold', fontSize=9, textColor=colors.white))]]
    for row in rows:
        t_data.append([Paragraph(str(row[0]), ParagraphStyle('TD2', fontName='FreeSerif', fontSize=9, leading=13, textColor=TEXT_PRIMARY)),
                       Paragraph(str(row[1]), ParagraphStyle('TD3', fontName='FreeSerif-Bold', fontSize=9, leading=13, textColor=TEXT_PRIMARY, alignment=TA_CENTER)),
                       Paragraph(str(row[2]), ParagraphStyle('TD4', fontName='FreeSerif', fontSize=9, leading=13, textColor=TEXT_MUTED))])
    t = Table(t_data, colWidths=[AVAILABLE*0.30, AVAILABLE*0.12, AVAILABLE*0.58], repeatRows=1)
    style_cmds = [
        ('BACKGROUND', (0, 0), (-1, 0), HEADER_FILL),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('GRID', (0, 0), (-1, -1), 0.5, BORDER),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]
    for i in range(1, len(t_data)):
        bg = colors.white if i % 2 == 1 else TABLE_STRIPE
        style_cmds.append(('BACKGROUND', (0, i), (-1, i), bg))
    t.setStyle(TableStyle(style_cmds))
    return t

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# PAGE TEMPLATE
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
def footer_and_header(canvas, doc):
    canvas.saveState()
    canvas.setFont('FreeSerif-Italic', 8)
    canvas.setFillColor(TEXT_MUTED)
    canvas.drawRightString(W - MARGIN, 25, f'Phase 2 Pre-Approval Audit Report')
    canvas.drawString(MARGIN, 25, f'Page {doc.page}')
    canvas.setStrokeColor(BORDER)
    canvas.setLineWidth(0.5)
    canvas.line(MARGIN, 38, W - MARGIN, 38)
    canvas.restoreState()

def first_page(canvas, doc):
    canvas.saveState()
    canvas.restoreState()

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# BUILD DOCUMENT
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
output_path = '/home/z/my-project/download/Phase2-Pre-Approval-Audit-Report.pdf'
os.makedirs(os.path.dirname(output_path), exist_ok=True)

doc = SimpleDocTemplate(
    output_path,
    pagesize=A4,
    leftMargin=MARGIN, rightMargin=MARGIN,
    topMargin=MARGIN, bottomMargin=50,
    title='Phase 2 Pre-Approval Audit Report',
    author='Z.ai',
    subject='Platform Security, Auth, and Production Readiness Audit'
)

story = []

# ══════════════════════════════════════════════
# COVER PAGE
# ══════════════════════════════════════════════
story.append(Spacer(1, H * 0.22))

# Decorative line
from reportlab.platypus.flowables import HRFlowable
story.append(HRFlowable(width='100%', thickness=3, color=ACCENT, spaceBefore=0, spaceAfter=16))

story.append(Paragraph('Phase 2', ParagraphStyle('Phase', fontName='FreeSerif-Bold', fontSize=14, leading=20, textColor=ACCENT, spaceAfter=4)))
story.append(Paragraph('Pre-Approval Audit Report', cover_title))
story.append(Spacer(1, 8))
story.append(Paragraph('Security Hardening, Auth Enforcement, and Production Readiness', cover_sub))
story.append(Spacer(1, 20))
story.append(HRFlowable(width='40%', thickness=1, color=BORDER, spaceBefore=0, spaceAfter=16))

meta_items = [
    'AI-Native Sales Intelligence Platform',
    'Target: $20M Funding Readiness',
    'Middleware + CSRF + Rate Limiting + Auth Flow',
    '42-File TypeScript Audit + E2E Assessment',
]
for m in meta_items:
    story.append(Paragraph(m, cover_meta))
story.append(Spacer(1, 40))
story.append(Paragraph('Prepared for Phase 3 Gate Review', ParagraphStyle('gate', fontName='FreeSerif-Bold', fontSize=11, textColor=SEM_INFO)))
story.append(Spacer(1, 8))
story.append(Paragraph('July 2026', ParagraphStyle('date', fontName='FreeSerif-Italic', fontSize=10, textColor=TEXT_MUTED)))

story.append(PageBreak())

# ══════════════════════════════════════════════
# SECTION 1: @ts-nocheck AUDIT
# ══════════════════════════════════════════════
story.extend(safe_keep([section_heading('Section 1: @ts-nocheck Complete Audit')]))
story.append(body(
    'This section provides the full inventory of all 42 files annotated with <b>@ts-nocheck</b>, '
    'classified by production criticality. Each file has been read, analyzed, and assigned a '
    'fix strategy. The ESLint configuration has <b>no-explicit-any: off</b> and <b>ban-ts-comment: off</b>, '
    'meaning these suppressions are not flagged by lint. However, they represent real risk: '
    'TypeScript cannot validate type safety in any of these files, meaning runtime errors from '
    'type mismatches will only surface at execution time.'
))
story.append(spacer(8))

story.append(subsection_heading('1.1 Classification Criteria'))
story.append(body(
    '<b>Production Critical = YES</b>: The file is actively imported and called by the main application '
    '(page.tsx or screen components). A runtime error here will break a user-facing feature. '
    '<b>Production Critical = NO</b>: The file is dead code (legacy CRM module with zero imports) or '
    'an AI feature library not yet wired to production routes. Removing @ts-nocheck from these is '
    'lower priority but should still be done for long-term maintainability.'
))
story.append(spacer(8))

story.append(subsection_heading('1.2 Common Root Causes'))
story.append(body(
    'After reading all 42 files, the root causes cluster into four categories: (1) <b>Complex Prisma query types</b> '
    'where include/join return shapes don\'t match declared interfaces (24 files); (2) <b>Dynamic imports of z-ai-web-dev-sdk</b> '
    'where the SDK has no TypeScript declarations (8 files); (3) <b>Legacy CRM module</b> using hardcoded demo data with '
    'inline React.CSSProperties typed as <b>any</b> (6 files); (4) <b>AI Copilot library</b> with complex generic types '
    'cross-referencing multiple schema models (4 files). The Prisma-related files are the most critical because they handle '
    'database operations that directly affect data integrity.'
))
story.append(spacer(12))

# --- LIBRARY FILES ---
story.append(subsection_heading('1.3 AI/Revenue Intelligence Libraries (7 files)'))
story.append(body(
    'These are core AI pipeline modules in the revenue intelligence system. They are exported via barrel files '
    '(ai-copilot/index.ts, revenue-intelligence/) and used by API routes for account brief generation, signal detection, '
    'and strategic reasoning. All use complex Prisma queries with deeply nested include clauses and custom type interfaces '
    'that don\'t perfectly align with generated Prisma types.'
))

lib_files = [
    ['signal-detector.ts', 'No', 'Complex Prisma include types, custom interfaces vs DB schema mismatch', 'Phase 4'],
    ['brief-generator.ts', 'No', 'Multi-table joins (CompanySignal, OpportunitySignal, etc.)', 'Phase 4'],
    ['account-prioritization/engine.ts', 'No', 'ICPProfile type not matching SystemSetting schema', 'Phase 4'],
    ['ai-copilot/reasoning-engine.ts', 'No', 'Complex generic types, cross-model DB queries', 'Phase 4'],
    ['ai-copilot/brief-enhancer.ts', 'No', 'z-ai-web-dev-sdk dynamic import, extractJSON untyped', 'Phase 4'],
    ['ai-copilot/strategy-generator.ts', 'No', 'z-ai-web-dev-sdk dynamic import, governedAICall types', 'Phase 4'],
    ['ai-copilot/usage-tracker.ts', 'No', 'AIUsageRecord type vs AIUsageLog Prisma model mismatch', 'Phase 4'],
]
story.append(spacer(8))
story.append(make_table(
    ['File Name', 'Prod Critical?', 'Reason for @ts-nocheck', 'Fix Phase'],
    lib_files,
    [AVAILABLE*0.24, AVAILABLE*0.10, AVAILABLE*0.42, AVAILABLE*0.08]
))
story.append(spacer(6))
story.append(Paragraph('Table 1: AI/Revenue Intelligence Libraries', caption_style))
story.append(spacer(12))

# --- PRODUCTION CRITICAL API ROUTES ---
story.append(subsection_heading('1.4 Production-Critical API Routes (29 files)'))
story.append(body(
    'These 29 API route files are actively called from the frontend screen components. Each has @ts-nocheck due to '
    'Prisma query types not matching the declared interfaces, or dynamic imports of z-ai-web-dev-sdk. '
    'They represent the highest risk group because a type error could cause data loss, authentication bypass, '
    'or API failure at runtime. The fix strategy involves adding explicit type annotations to all Prisma query '
    'results and replacing <b>any</b> with proper types from generated Prisma client.'
))

critical_api = [
    ['api/contacts/route.ts', 'Yes', 'Prisma ContactWhereInput, multi-field search', 'Phase 3'],
    ['api/signals/route.ts', 'Yes', 'Custom Signal interface vs Prisma types', 'Phase 3'],
    ['api/preferences/route.ts', 'Yes', 'SystemSetting singleton, destructuring omit', 'Phase 3'],
    ['api/timeline/route.ts', 'Yes', 'CompanyTimelineEvent includes with dynamic where', 'Phase 3'],
    ['api/notes/route.ts', 'Yes', 'CompanyNote + ContactNote union query types', 'Phase 3'],
    ['api/emails/send/route.ts', 'Yes', 'SendResult type from email-sender, zod union', 'Phase 3'],
    ['api/batches/route.ts', 'Yes', 'XLSX + crypto + Prisma, multi-model batch ops', 'Phase 3'],
    ['api/analytics/route.ts', 'Yes', 'Large Prisma aggregations, auto-seed side effect', 'Phase 3'],
    ['api/queue/route.ts', 'Yes', 'SendQueue include chain (draft > contact > company)', 'Phase 3'],
    ['api/opportunities/route.ts', 'Yes', 'OpportunityRecommendation pagination types', 'Phase 3'],
    ['api/opportunities/[id]/route.ts', 'Yes', 'OpportunityRecommendation update with Zod', 'Phase 3'],
    ['api/drafts/[id]/route.ts', 'Yes', 'Transaction with draft + sendQueue race guard', 'Phase 3'],
    ['api/verify-queue/process/route.ts', 'Yes', 'Node dns module, contact type as any', 'Phase 3'],
    ['api/sequences/[id]/execute/route.ts', 'Yes', 'Dynamic params Promise, EmailSequence steps', 'Phase 3'],
    ['api/sequences/[id]/steps/[stepId]/route.ts', 'Yes', 'Auto-assign step number, Zod validation', 'Phase 3'],
    ['api/companies/[id]/intelligence/route.ts', 'No', 'z-ai-web-dev-sdk dynamic import, web search', 'Phase 4'],
    ['api/research-agent/route.ts', 'No', 'z-ai-web-dev-sdk dynamic import only', 'Phase 4'],
    ['api/imports/route.ts', 'No', 'CSV parser + Prisma, not called by main UI', 'Phase 3'],
    ['api/export/route.ts', 'No', 'CSV export, not called by main UI', 'Phase 3'],
    ['api/reports/revenue/route.ts', 'No', 'OpportunityRecommendation pipeline calc', 'Phase 4'],
    ['api/reports/team-performance/route.ts', 'No', 'User + EmailSend aggregate queries', 'Phase 4'],
    ['api/reports/data-quality/route.ts', 'No', 'Company field completeness analysis', 'Phase 4'],
    ['api/reports/pipeline/route.ts', 'No', 'Opportunity stage ordering + date parsing', 'Phase 4'],
    ['api/ai/conversation-plan/route.ts', 'No', 'z-ai-web-dev-sdk + web search + LLM', 'Phase 4'],
    ['api/ai/suggested-contacts/route.ts', 'No', 'In-memory cache + z-ai-web-dev-sdk', 'Phase 4'],
    ['api/ai/query/route.ts', 'No', 'z-ai-web-dev-sdk LLM chat completions', 'Phase 4'],
    ['api/ai/opportunities/route.ts', 'No', 'Web search + LLM scoring + caching', 'Phase 4'],
    ['api/ai/score-leads/route.ts', 'No', 'Lead scoring with Zod schema + LLM', 'Phase 4'],
    ['api/ai/account-brief/route.ts', 'No', 'Account brief generation via LLM', 'Phase 4'],
]
story.append(spacer(8))
story.append(make_table(
    ['File Name', 'Prod Critical?', 'Reason for @ts-nocheck', 'Fix Phase'],
    critical_api,
    [AVAILABLE*0.24, AVAILABLE*0.10, AVAILABLE*0.42, AVAILABLE*0.08]
))
story.append(spacer(6))
story.append(Paragraph('Table 2: API Routes with @ts-nocheck (Production Criticality Assessment)', caption_style))
story.append(spacer(12))

# --- LEGACY CRM ---
story.append(subsection_heading('1.5 Legacy CRM Module (6 files) - Dead Code'))
story.append(body(
    'The <b>/src/app/crm/</b> directory contains 6 component files (Settings.tsx, Knowledge.tsx, Tasks.tsx, '
    'EmailGen.tsx, components.tsx, and data.ts) plus additional files (App.tsx, Dashboard.tsx, etc.) that form a '
    'completely separate CRM module using hardcoded demo data. Critically, <b>zero files in /src/app/crm/ are imported '
    'by any file outside that directory</b>. The main application (page.tsx) uses components from /src/components/screens/ '
    'exclusively. This entire module is dead code and should be deleted in Phase 3.'
))

legacy_crm = [
    ['crm/Settings.tsx', 'No', 'Dead code: zero imports outside crm/, hardcoded state', 'Phase 3 (DELETE)'],
    ['crm/Knowledge.tsx', 'No', 'Dead code: uses crm/data.ts static KNOWLEDGE array', 'Phase 3 (DELETE)'],
    ['crm/Tasks.tsx', 'No', 'Dead code: uses crm/data.ts static TASKS array', 'Phase 3 (DELETE)'],
    ['crm/EmailGen.tsx', 'No', 'Dead code: local state, no API calls', 'Phase 3 (DELETE)'],
    ['crm/components.tsx', 'No', 'Dead code: Badge, StatusBadge, etc. unused', 'Phase 3 (DELETE)'],
    ['intelligence-reasoning-screen.tsx', 'No', 'Active screen but orphaned: not in screen map', 'Phase 3 (REVIEW)'],
]
story.append(spacer(8))
story.append(make_table(
    ['File Name', 'Prod Critical?', 'Reason for @ts-nocheck', 'Fix Phase'],
    legacy_crm,
    [AVAILABLE*0.24, AVAILABLE*0.10, AVAILABLE*0.42, AVAILABLE*0.08]
))
story.append(spacer(6))
story.append(Paragraph('Table 3: Legacy CRM Module + Orphaned Screens', caption_style))
story.append(spacer(12))

# --- SUMMARY ---
story.append(subsection_heading('1.6 @ts-nocheck Summary Statistics'))
summary_verdict = [
    ['Total @ts-nocheck files', '42', 'Confirmed by grep scan of entire src/'],
    ['Production-critical (Yes)', '15', 'Routes actively called by frontend screens'],
    ['Non-critical (No)', '27', 'Dead code, AI libraries not wired to production'],
    ['Fix in Phase 3', '22', '15 critical APIs + 6 legacy deletes + 1 review'],
    ['Fix in Phase 4', '20', '7 AI lib files + 12 non-critical API + 1 orphan'],
    ['Zero @ts-nocheck files added in Phase 2', '0', 'middleware.ts, auth-helpers.ts, session.ts all clean'],
]
story.append(spacer(8))
story.append(verdict_table('@ts-nocheck Summary', summary_verdict))
story.append(spacer(18))

# ══════════════════════════════════════════════
# SECTION 2: REAL DATABASE E2E TEST
# ══════════════════════════════════════════════
story.extend(safe_keep([section_heading('Section 2: Real Database E2E Test Assessment')]))
story.append(body(
    'The user requested a full end-to-end authentication flow test against a real PostgreSQL/Neon database: '
    'register, login, OTP verification, session creation, and dashboard access. This section provides an honest '
    'assessment of feasibility and the exact steps needed to complete this test in a production environment.'
))
story.append(spacer(8))

story.append(subsection_heading('2.1 Current Environment Status'))
e2e_verdict = [
    ['DATABASE_URL set', 'YES (SQLite)', 'file:/home/z/my-project/db/custom.db'],
    ['Prisma provider', 'postgresql', 'Schema requires PostgreSQL, not SQLite'],
    ['Prisma validate', 'FAIL', 'URL must start with postgresql:// or postgres://'],
    ['npx next build', 'PASS', 'Compiled successfully in 32.7s, zero errors'],
    ['npx tsc --noEmit', 'PASS', 'Zero TypeScript errors'],
    ['Dev server runtime', 'BLOCKED', 'Cannot start without valid PostgreSQL connection'],
    ['curl auth tests', 'BLOCKED', 'No running server to test against'],
]
story.append(spacer(8))
story.append(verdict_table('Environment Readiness', e2e_verdict))
story.append(spacer(12))

story.append(subsection_heading('2.2 Blocker Analysis'))
story.append(body(
    'The sandbox environment has DATABASE_URL set to a SQLite path (file:/home/z/my-project/db/custom.db), '
    'but the Prisma schema declares <b>provider = "postgresql"</b>. This mismatch makes Prisma CLI commands '
    '(validate, db push, migrate, pull) and all runtime database operations fail. The database file exists '
    '(1.7MB at /home/z/my-project/db/custom.db) but is inaccessible to the PostgreSQL provider. There is no '
    'PostgreSQL server running in the sandbox, and installing one is outside the scope of this task.'
))
story.append(spacer(8))

story.append(body(
    'The Next.js build succeeds because build-time only checks TypeScript/imports, not database connectivity. '
    'The dev server would fail at first database request. This means we <b>cannot produce curl-based runtime '
    'evidence</b> in this sandbox. However, we can provide the exact curl commands and expected responses that '
    'will validate the auth flow once a real PostgreSQL database is connected.'
))
story.append(spacer(8))

story.append(subsection_heading('2.3 Exact E2E Test Commands (For Production)'))
story.append(body(
    'The following curl sequence should be executed against a running instance with a valid PostgreSQL database. '
    'Each command includes the expected HTTP status and response body to validate correctness.'
))
story.append(spacer(8))

test_cmds = [
    ['1. Register new user', 'POST /api/auth/register', '{"name":"Test User","email":"test@co.com","password":"Test1234!","confirmPassword":"Test1234!"}', '200 + devCode'],
    ['2. Request OTP', 'POST /api/auth/request-otp', '{"email":"test@co.com"}', '200'],
    ['3. Verify OTP', 'POST /api/auth/verify-otp', '{"email":"test@co.com","code":"<devCode>"}', '200 + Set-Cookie'],
    ['4. Access dashboard', 'GET / (with cookie)', 'Cookie: dmq_session=<token>', '200 + HTML'],
    ['5. Protected API', 'GET /api/preferences', 'Cookie: dmq_session=<token>', '200 + JSON'],
    ['6. API without session', 'GET /api/preferences', 'No cookie', '401 Unauthorized'],
    ['7. CSRF test (no token)', 'POST /api/preferences', 'Cookie only, no x-csrf-token', '403 Forbidden'],
    ['8. CSRF test (valid)', 'POST /api/preferences', 'Cookie + x-csrf-token header', '200 or 400 (valid)'],
]
story.append(spacer(8))
story.append(make_table(
    ['Step', 'Endpoint', 'Payload / Header', 'Expected'],
    test_cmds,
    [AVAILABLE*0.20, AVAILABLE*0.22, AVAILABLE*0.34, AVAILABLE*0.24]
))
story.append(spacer(6))
story.append(Paragraph('Table 4: E2E Auth Flow Test Sequence', caption_style))
story.append(spacer(12))

story.append(subsection_heading('2.4 Code-Level Proof of Correctness'))
story.append(body(
    'While runtime testing is blocked, the code-level correctness of the auth flow has been verified through '
    'static analysis. The register route (src/app/api/auth/register/route.ts) implements: Zod validation for '
    'name, email, password (min 8 chars), and confirmPassword match; email uniqueness check via Prisma; '
    'PBKDF2 password hashing via hashPassword(); OTP generation via requestOtp(); and session creation after '
    'verification. The middleware (src/middleware.ts) enforces session presence for all /api/* routes and redirects '
    'unauthenticated page requests to /login. The CSRF double-submit pattern validates that the x-csrf-token header '
    'matches the csrf-token cookie using timing-safe comparison. Rate limiting applies 5 OTP requests/minute and '
    '100 general API requests/minute per IP.'
))
story.append(spacer(18))

# ══════════════════════════════════════════════
# SECTION 3: FIRST CUSTOMER JOURNEY
# ══════════════════════════════════════════════
story.extend(safe_keep([section_heading('Section 3: First Customer Journey Documentation')]))
story.append(body(
    'This section documents the complete enterprise user journey from deployment to executive brief generation. '
    'Each step is mapped to the current codebase implementation, with a clear status of what is tested, what is '
    'partially implemented, and what is pending. This serves as both a product specification and a test plan for '
    'Phase 3 and beyond.'
))
story.append(spacer(8))

journey_steps = [
    ['1', 'Company receives deployment URL', 'Platform deployed to Render.com or Cloudflare Pages', 'Not tested', 'Needs real deployment'],
    ['2', 'Signup', '/signup page, register route with Zod validation + PBKDF2', 'Code verified', 'Blocked by no DB'],
    ['3', 'Login', '/login page, OTP-based two-step auth flow', 'Code verified', 'Blocked by no DB'],
    ['4', 'OTP Verification', '6-digit OTP input, auto-focus, timing-safe check', 'Code verified', 'Blocked by no DB'],
    ['5', 'Session Creation', 'dmq_session cookie set on OTP verify, DB validated', 'Code verified', 'Blocked by no DB'],
    ['6', 'Dashboard Access', '/ renders SPA with sidebar nav, 60+ screens', 'Build passes', 'Needs runtime check'],
    ['7', 'Upload Excel', '/api/upload/* endpoints (DO NOT EXIST)', 'NOT IMPLEMENTED', 'CRITICAL GAP'],
    ['8', 'Column Mapping', 'Import screen uses /api/upload/analyze', 'NOT IMPLEMENTED', 'CRITICAL GAP'],
    ['9', 'Import', '/api/upload/create + process-chunk + commit', 'NOT IMPLEMENTED', 'CRITICAL GAP'],
    ['10', 'Deduplication', '/api/leads/dedup endpoint exists', 'Route exists', 'Not tested'],
    ['11', 'AI Enrichment', '/api/ai/enrich + /api/companies/enrich', 'Routes exist', 'Not tested'],
    ['12', 'Account Intelligence', '/api/companies/[id]/intelligence', 'Route exists', 'Not tested'],
    ['13', 'Recommendations', '/api/ai/recommendations', 'Route exists', 'Not tested'],
    ['14', 'Executive Brief', '/api/ai/account-brief + brief-generator.ts', 'Route + lib exist', 'Not tested'],
]
story.append(spacer(8))
story.append(make_table(
    ['#', 'Step', 'Implementation', 'Status', 'Action Required'],
    journey_steps,
    [AVAILABLE*0.04, AVAILABLE*0.16, AVAILABLE*0.36, AVAILABLE*0.16, AVAILABLE*0.20]
))
story.append(spacer(6))
story.append(Paragraph('Table 5: Enterprise Customer Journey (14-Step End-to-End Flow)', caption_style))
story.append(spacer(12))

story.append(subsection_heading('3.1 Critical Gap Analysis: Upload/Import Flow'))
story.append(body(
    'The most significant finding is a <b>critical gap in the upload/import pipeline</b>. The frontend import screen '
    '(src/components/screens/import-screen.tsx) makes API calls to <b>/api/upload/*</b> endpoints including '
    '/api/upload/analyze, /api/upload/create, /api/upload/{uid}/progress, /api/upload/{uid}/process-chunk, '
    'and /api/upload/{uploadId}/commit. However, the <b>/api/upload/ directory does not exist</b> in the codebase. '
    'There are 130+ API route files, but none match the /api/upload/* pattern.'
))
story.append(spacer(8))
story.append(body(
    'Two legacy routes exist that partially overlap: /api/batches/route.ts (Excel upload with XLSX parsing, '
    'column mapping, deduplication, chunked processing) and /api/imports/route.ts (CSV staging + execution). '
    'However, the current frontend does not call either of these. The batches route is comprehensive (508 lines) '
    'with SHA256 deduplication, fuzzy company matching, email validation, and lead scoring. It could serve as the '
    'foundation for the /api/upload/* endpoints that the frontend expects.'
))
story.append(spacer(8))
story.append(callout(
    'CRITICAL: Steps 7-9 (Upload Excel, Column Mapping, Import) are completely non-functional because the '
    'frontend expects /api/upload/* endpoints that do not exist. This must be addressed in Phase 3 by either '
    'creating the missing endpoints or re-routing the frontend to use the existing /api/batches endpoints.'
))
story.append(spacer(18))

# ══════════════════════════════════════════════
# SECTION 4: DATA IMPORT VALIDATION
# ══════════════════════════════════════════════
story.extend(safe_keep([section_heading('Section 4: Data Import Validation Assessment')]))
story.append(body(
    'Data import is described as the "core value proposition" of the platform. This section assesses the feasibility '
    'of performance testing with 100 and 2000 company datasets, identifies the current implementation, and provides '
    'an honest assessment of what can and cannot be tested in the current environment.'
))
story.append(spacer(8))

story.append(subsection_heading('4.1 Current Import Implementation'))
story.append(body(
    'The codebase has two import implementations that are NOT connected to the frontend:'
))
story.append(spacer(6))

import_verdict = [
    ['Frontend import screen', 'references /api/upload/*', 'DOES NOT EXIST - 404 at runtime'],
    ['/api/batches/route.ts', 'XLSX upload + column mapping + dedup', '508 lines, comprehensive, @ts-nocheck'],
    ['/api/imports/route.ts', 'CSV staging + execution', '323 lines, separate from frontend'],
    ['Chunk size', 'CHUNK_SIZE = 100 rows', 'Configured in batches route'],
    ['Large file threshold', 'LARGE_FILE_THRESHOLD = 500', 'Triggers progress tracking above this'],
    ['Deduplication', 'SHA256 email hash + fuzzy company match', 'Company match score 0-100'],
    ['Email validation', 'Syntax + disposable + role-based + free provider', '4-stage scoring'],
    ['Lead scoring', 'calculateLeadScore() function', 'Composite multi-factor score'],
]
story.append(spacer(8))
story.append(verdict_table('Import Pipeline Components', import_verdict))
story.append(spacer(12))

story.append(subsection_heading('4.2 Performance Test Plan (For Production)'))
story.append(body(
    'Without a running server and database, actual performance metrics cannot be measured. The following test plan '
    'should be executed once the import pipeline is connected and the database is operational:'
))
story.append(spacer(8))

perf_plan = [
    ['100-company dataset', 'Upload time (network + parse)', '< 5 seconds expected', 'XLSX with 10 columns'],
    ['100-company dataset', 'Processing time (DB insert)', '< 10 seconds expected', 'With dedup + scoring'],
    ['100-company dataset', 'Duplicates detected', 'Variable (depends on data)', 'SHA256 + fuzzy match'],
    ['100-company dataset', 'DB records created', '50-100 (minus duplicates)', 'Company + Contact tables'],
    ['2000-company dataset', 'Upload time', '< 15 seconds expected', 'Large file, chunked'],
    ['2000-company dataset', 'Processing time', '< 60 seconds expected', '20 chunks of 100'],
    ['2000-company dataset', 'Memory usage', 'Monitor for OOM', 'In-memory progress map'],
    ['2000-company dataset', 'Error handling', 'Rollback on chunk failure', 'Transaction per chunk'],
]
story.append(spacer(8))
story.append(make_table(
    ['Dataset', 'Metric', 'Expected', 'Notes'],
    perf_plan,
    [AVAILABLE*0.22, AVAILABLE*0.28, AVAILABLE*0.22, AVAILABLE*0.28]
))
story.append(spacer(6))
story.append(Paragraph('Table 6: Data Import Performance Test Plan', caption_style))
story.append(spacer(12))

story.append(subsection_heading('4.3 Known Import System Risks'))
story.append(body(
    'Several risks have been identified in the import system that should be addressed before production testing: '
    'The batches route uses an <b>in-memory Map for progress tracking</b> that resets on server restart, which is '
    'unacceptable for production. The SHA256 deduplication only checks email hashes within the current batch, not '
    'against existing database records (requires a pre-query). The CHUNK_SIZE of 100 rows processes sequentially '
    'without parallelism, which will be slow for 2000+ row imports. Finally, the route has @ts-nocheck, meaning '
    'type errors in the dedup or scoring logic could silently corrupt data.'
))
story.append(spacer(18))

# ══════════════════════════════════════════════
# SECTION 5: PHASE 3 SCOPE DEFINITION
# ══════════════════════════════════════════════
story.extend(safe_keep([section_heading('Section 5: Phase 3 Scope Definition')]))
story.append(body(
    'Phase 3 is the cleanup and maturity phase that prepares the codebase for production deployment. '
    'It addresses the critical gaps identified in Sections 1-4, removes dead code, and connects the import pipeline. '
    'This section provides the complete specification including objective, affected files, expected outcomes, '
    'and acceptance criteria.'
))
story.append(spacer(8))

story.append(subsection_heading('5.1 Objective'))
story.append(body(
    '<b>Phase 3 Objective: Transform the codebase from "feature-complete prototype" to "production-deployable platform" '
    'by removing dead code, fixing @ts-nocheck in production-critical files, connecting the upload/import pipeline, '
    'adding error boundaries, and ensuring all core user journeys are functional end-to-end.</b>'
))
story.append(spacer(12))

story.append(subsection_heading('5.2 Scope Areas and Affected Files'))

scope_areas = [
    ['Legacy route removal', '~128 API routes', 'Remove unused routes, consolidate overlapping endpoints', 'Phase 3'],
    ['Demo data removal', 'crm/data.ts (83 lines)', 'Delete hardcoded COMPANIES, CONTACTS, KNOWLEDGE, TASKS arrays', 'Phase 3'],
    ['Legacy CRM deletion', '6 files in /src/app/crm/', 'Settings, Knowledge, Tasks, EmailGen, components + App/Dashboard/etc.', 'Phase 3'],
    ['@ts-nocheck fixes (critical)', '15 API route files', 'Add proper Prisma types, replace any with explicit types', 'Phase 3'],
    ['Upload pipeline creation', '/api/upload/* (5+ new files)', 'Create missing endpoints the import screen expects', 'Phase 3'],
    ['Error boundaries', 'page.tsx + screen components', 'Add React error boundaries for graceful failure', 'Phase 3'],
    ['Loading states', 'Screen components', 'Add skeleton loaders for data-fetching screens', 'Phase 3'],
    ['Orphaned screen cleanup', 'intelligence-reasoning-screen.tsx', 'Review: integrate or remove from navigation', 'Phase 3'],
    ['Build validation', 'next.config.ts', 'Remove ignoreBuildErrors: true', 'Phase 3'],
]
story.append(spacer(8))
story.append(make_table(
    ['Scope Area', 'Files Affected', 'Description', 'Phase'],
    scope_areas,
    [AVAILABLE*0.20, AVAILABLE*0.22, AVAILABLE*0.40, AVAILABLE*0.08]
))
story.append(spacer(6))
story.append(Paragraph('Table 7: Phase 3 Scope Areas', caption_style))
story.append(spacer(12))

story.append(subsection_heading('5.3 Detailed Work Breakdown'))

story.append(sub3_heading('5.3.1 Legacy Route Removal'))
story.append(body(
    'The codebase contains 130+ API route files, many of which are redundant or unused. The import screen calls '
    '/api/upload/* but the codebase has /api/batches and /api/imports instead. Multiple AI endpoints serve similar '
    'purposes (/api/ai/query vs /api/ai/enrich vs /api/ai/generate). A route audit should identify which endpoints '
    'are called by the frontend (found 82 fetch calls across 22 screen files), which are dead code, and which should '
    'be consolidated. Estimated: 80-100 route files can be removed or consolidated.'
))
story.append(spacer(8))

story.append(sub3_heading('5.3.2 @ts-nocheck Remediation (Critical)'))
story.append(body(
    'The 15 production-critical API routes identified in Section 1.4 must have @ts-nocheck removed. The fix involves: '
    '(1) running each file through tsc with @ts-nocheck removed to identify specific errors; (2) adding explicit type '
    'annotations to Prisma query results using Prisma.Result or generated types; (3) replacing <b>any</b> with proper '
    'interfaces; (4) adding type guards for dynamic data. The ESLint rules (no-explicit-any: off) should be tightened '
    'to "warn" after fixes are applied to prevent regression.'
))
story.append(spacer(8))

story.append(sub3_heading('5.3.3 Upload/Import Pipeline Connection'))
story.append(body(
    'This is the <b>highest priority work item</b> because steps 7-9 of the customer journey are completely broken. '
    'Two approaches: (A) Create /api/upload/* endpoints by refactoring the existing /api/batches/route.ts code, '
    'which already has Excel parsing, column mapping, deduplication, and lead scoring; or (B) Update the import '
    'screen to call the existing /api/batches endpoints. Option A is preferred because the import screen expects '
    'a specific API contract (analyze, create, progress, process-chunk, commit) that batches does not match.'
))
story.append(spacer(12))

story.append(subsection_heading('5.4 Expected Outcomes'))
story.append(body(
    'After Phase 3 completion, the platform should meet the following measurable outcomes:'
))
story.append(spacer(8))

outcomes = [
    ['API route count', '130+ reduced to 40-50 active routes', 'Remove dead and redundant endpoints'],
    ['@ts-nocheck count (critical)', '15 reduced to 0', 'All production-critical files type-safe'],
    ['@ts-nocheck count (total)', '42 reduced to ~20 (non-critical only)', 'AI libraries deferred to Phase 4'],
    ['Upload/import flow', 'Functional end-to-end', 'Excel upload through to DB import'],
    ['Customer journey (14 steps)', 'Steps 1-6 tested, 7-14 functional', 'Full flow from signup to brief'],
    ['Error boundaries', 'Present on all major screens', 'Graceful degradation on API failure'],
    ['Build warnings', 'ignoreBuildErrors: true removed', 'Zero build warnings'],
    ['Dead code', 'crm/ module + demo data deleted', '~13 files removed'],
]
story.append(spacer(8))
story.append(verdict_table('Phase 3 Expected Outcomes', outcomes))
story.append(spacer(12))

story.append(subsection_heading('5.5 Acceptance Criteria'))

acceptance = [
    ['AC-1: Clean build', 'npx next build passes with zero errors AND zero warnings', 'PASS / FAIL'],
    ['AC-2: Type safety', 'Zero @ts-nocheck in production-critical API routes', 'PASS / FAIL'],
    ['AC-3: No dead code', 'Grep confirms zero imports from /src/app/crm/', 'PASS / FAIL'],
    ['AC-4: Upload works', '100-company Excel upload completes with valid DB records', 'PASS / FAIL'],
    ['AC-5: Journey complete', 'All 14 customer journey steps are functional', 'PASS / FAIL'],
    ['AC-6: Error handling', 'Network error shows toast, not white screen', 'PASS / FAIL'],
    ['AC-7: Auth enforced', 'All /api/* routes return 401 without valid session', 'PASS / FAIL'],
    ['AC-8: No regressions', 'Phase 2 middleware, CSRF, rate limiting still functional', 'PASS / FAIL'],
]
story.append(spacer(8))
story.append(make_table(
    ['ID', 'Acceptance Criteria', 'Validation Method'],
    acceptance,
    [AVAILABLE*0.10, AVAILABLE*0.55, AVAILABLE*0.15]
))
story.append(spacer(6))
story.append(Paragraph('Table 8: Phase 3 Acceptance Criteria', caption_style))
story.append(spacer(12))

story.append(subsection_heading('5.6 Timeline Estimate'))
story.append(body(
    'Based on the scope defined above, Phase 3 is estimated at <b>7-10 working days</b>, broken down as follows: '
    'Legacy route audit and removal (2-3 days), @ts-nocheck remediation for 15 critical files (2-3 days), '
    'Upload/import pipeline creation (2-3 days), Error boundaries and loading states (1 day), '
    'Testing and acceptance validation (1 day). The upload pipeline is on the critical path and should be '
    'started first to unblock end-to-end testing.'
))
story.append(spacer(18))

# ══════════════════════════════════════════════
# FINAL GATE SUMMARY
# ══════════════════════════════════════════════
story.extend(safe_keep([section_heading('Final Gate: Phase 2 Approval Assessment')]))
story.append(body(
    'The following table summarizes the pass/fail status of each of the user\'s five clarification areas. '
    'This serves as the formal gate review for Phase 2 approval and Phase 3 authorization.'
))
story.append(spacer(12))

final_gate = [
    ['1. @ts-nocheck Audit', 'PASS', 'All 42 files read, classified, fix plans documented'],
    ['2. Real DB E2E Test', 'CONDITIONAL', 'Code verified; runtime blocked by SQLite/PostgreSQL mismatch'],
    ['3. Customer Journey', 'PASS', '14-step journey documented, critical gap in upload identified'],
    ['4. Data Import Validation', 'CONDITIONAL', 'Test plan ready; blocked by no running server'],
    ['5. Phase 3 Scope', 'PASS', 'Complete definition with files, outcomes, acceptance criteria'],
]
story.append(spacer(8))
story.append(verdict_table('Phase 2 Final Gate', final_gate))
story.append(spacer(12))

story.append(callout(
    'RECOMMENDATION: Approve Phase 2 with two conditions: (1) Real database E2E testing must be completed '
    'within the first 48 hours of Phase 3 using a PostgreSQL database; (2) The upload/import pipeline gap '
    'must be addressed as the first work item in Phase 3 before any other cleanup work.'
))

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# BUILD
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
doc.build(story, onFirstPage=first_page, onLaterPages=footer_and_header)
print(f'PDF generated: {output_path}')
