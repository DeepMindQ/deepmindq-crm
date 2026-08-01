#!/usr/bin/env python3
"""
DeepMindQ Production Foundation v1.0 Starting Point
Frozen baseline checkpoint document — ReportLab pipeline
"""
import os, sys, hashlib
from datetime import datetime

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT, TA_JUSTIFY
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, KeepTogether, HRFlowable
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase.pdfmetrics import registerFontFamily

# ━━ Fonts ━━
FONT_DIR = '/usr/share/fonts'
pdfmetrics.registerFont(TTFont('NotoSerifSC', f'{FONT_DIR}/truetype/noto-serif-sc/NotoSerifSC-Regular.ttf'))
pdfmetrics.registerFont(TTFont('NotoSerifSC-Bold', f'{FONT_DIR}/truetype/noto-serif-sc/NotoSerifSC-Bold.ttf'))
registerFontFamily('NotoSerifSC', normal='NotoSerifSC', bold='NotoSerifSC-Bold')
pdfmetrics.registerFont(TTFont('NotoSansSC', f'{FONT_DIR}/truetype/chinese/LiberationSans-Regular.ttf'))
pdfmetrics.registerFont(TTFont('NotoSansSC-Bold', f'{FONT_DIR}/truetype/chinese/LiberationSans-Regular.ttf'))
pdfmetrics.registerFont(TTFont('DejaVuMono', f'{FONT_DIR}/truetype/dejavu/DejaVuSansMono.ttf'))
pdfmetrics.registerFont(TTFont('DejaVuSans', f'{FONT_DIR}/truetype/dejavu/DejaVuSans.ttf'))

# ━━ Cascade Palette ━━
PAGE_BG       = colors.HexColor('#f3f2f1')
SECTION_BG    = colors.HexColor('#f1f0ef')
CARD_BG       = colors.HexColor('#e8e7e3')
TABLE_STRIPE  = colors.HexColor('#f4f4f3')
HEADER_FILL   = colors.HexColor('#706545')
COVER_BLOCK   = colors.HexColor('#655d48')
BORDER        = colors.HexColor('#c9c3b1')
ICON          = colors.HexColor('#9c853f')
ACCENT        = colors.HexColor('#93761f')
ACCENT_2      = colors.HexColor('#6649bc')
TEXT_PRIMARY   = colors.HexColor('#171715')
TEXT_MUTED     = colors.HexColor('#827f78')
SEM_SUCCESS   = colors.HexColor('#45825a')
SEM_WARNING   = colors.HexColor('#91743b')
SEM_ERROR     = colors.HexColor('#934f49')
SEM_INFO      = colors.HexColor('#4878a7')

# ━━ Styles ━━
styles = getSampleStyleSheet()

s_h1 = ParagraphStyle('H1', parent=styles['Heading1'],
    fontName='NotoSerifSC-Bold', fontSize=22, leading=28,
    textColor=HEADER_FILL, spaceAfter=12, spaceBefore=24)
s_h2 = ParagraphStyle('H2', parent=styles['Heading2'],
    fontName='NotoSerifSC-Bold', fontSize=16, leading=22,
    textColor=TEXT_PRIMARY, spaceAfter=8, spaceBefore=16)
s_h3 = ParagraphStyle('H3', parent=styles['Heading3'],
    fontName='NotoSerifSC-Bold', fontSize=13, leading=18,
    textColor=ACCENT, spaceAfter=6, spaceBefore=12)
s_body = ParagraphStyle('Body', parent=styles['Normal'],
    fontName='NotoSerifSC', fontSize=10, leading=15,
    textColor=TEXT_PRIMARY, alignment=TA_JUSTIFY, spaceAfter=6)
s_body_mono = ParagraphStyle('BodyMono', parent=s_body,
    fontName='DejaVuMono', fontSize=9, leading=13)
s_bullet = ParagraphStyle('Bullet', parent=s_body,
    leftIndent=20, bulletIndent=8, spaceBefore=2, spaceAfter=2)
s_meta = ParagraphStyle('Meta', parent=s_body,
    fontName='DejaVuMono', fontSize=9, textColor=TEXT_MUTED)
s_table_header = ParagraphStyle('TableHeader',
    fontName='NotoSansSC-Bold', fontSize=9, leading=12,
    textColor=colors.white, alignment=TA_CENTER)
s_table_cell = ParagraphStyle('TableCell',
    fontName='NotoSansSC', fontSize=9, leading=12,
    textColor=TEXT_PRIMARY)
s_table_cell_mono = ParagraphStyle('TableCellMono',
    fontName='DejaVuMono', fontSize=8, leading=11,
    textColor=TEXT_PRIMARY)
s_table_cell_center = ParagraphStyle('TableCellCenter', parent=s_table_cell,
    alignment=TA_CENTER)
s_score_high = ParagraphStyle('ScoreHigh', parent=s_table_cell_center,
    fontName='NotoSansSC-Bold', textColor=SEM_ERROR)
s_score_med = ParagraphStyle('ScoreMed', parent=s_table_cell_center,
    fontName='NotoSansSC-Bold', textColor=SEM_WARNING)
s_score_low = ParagraphStyle('ScoreLow', parent=s_table_cell_center,
    fontName='NotoSansSC-Bold', textColor=SEM_SUCCESS)
s_rule_title = ParagraphStyle('RuleTitle',
    fontName='NotoSansSC-Bold', fontSize=10, leading=14,
    textColor=ACCENT_2, spaceAfter=4, spaceBefore=10)

# ━━ TOC Template ━━
class TocDocTemplate(SimpleDocTemplate):
    def afterFlowable(self, flowable):
        if hasattr(flowable, 'bookmark_name'):
            level = getattr(flowable, 'bookmark_level', 0)
            text = getattr(flowable, 'bookmark_text', '')
            key = getattr(flowable, 'bookmark_key', '')
            self.notify('TOCEntry', (level, text, self.page, key))

def add_page_number(canvas, doc):
    canvas.saveState()
    canvas.setFont('DejaVuMono', 8)
    canvas.setFillColor(TEXT_MUTED)
    canvas.drawCentredString(A4[0] / 2, 30, f"Page {doc.page}")
    canvas.restoreState()

from reportlab.platypus.tableofcontents import TableOfContents
toc_h0 = ParagraphStyle('TOC0', fontName='NotoSansSC-Bold', fontSize=12, leading=20,
    leftIndent=0, textColor=HEADER_FILL)
toc_h1 = ParagraphStyle('TOC1', fontName='NotoSansSC', fontSize=10, leading=18,
    leftIndent=20, textColor=TEXT_PRIMARY)

def add_heading(text, style, level=0):
    key = f'h_{hashlib.md5(text.encode()).hexdigest()[:8]}'
    p = Paragraph(f'<a name="{key}"/>{text}', style)
    p.bookmark_name = key
    p.bookmark_level = level
    p.bookmark_text = text
    p.bookmark_key = key
    return p

def make_table(headers, rows, col_widths=None, page_width=460):
    """Build a styled table with alternating rows."""
    header_row = [Paragraph(h, s_table_header) for h in headers]
    data = [header_row]
    for row in rows:
        data.append([Paragraph(str(c), s_table_cell) if not isinstance(c, Paragraph) else c for c in row])
    if col_widths is None:
        n = len(headers)
        col_widths = [page_width / n] * n
    t = Table(data, colWidths=col_widths, repeatRows=1)
    style_cmds = [
        ('BACKGROUND', (0, 0), (-1, 0), HEADER_FILL),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'NotoSansSC-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('LEADING', (0, 0), (-1, -1), 12),
        ('GRID', (0, 0), (-1, -1), 0.5, BORDER),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
    ]
    for i in range(1, len(data)):
        if i % 2 == 0:
            style_cmds.append(('BACKGROUND', (0, i), (-1, i), TABLE_STRIPE))
    t.setStyle(TableStyle(style_cmds))
    return t

def score_cell(score, max_score=10):
    """Return a colored score paragraph."""
    pct = score / max_score
    if pct <= 0.3:
        return Paragraph(str(score), s_score_low)
    elif pct <= 0.6:
        return Paragraph(str(score), s_score_med)
    else:
        return Paragraph(str(score), s_score_high)

def hr():
    return HRFlowable(width="100%", thickness=0.5, color=BORDER, spaceAfter=8, spaceBefore=8)

# ━━ Build document ━━
OUTPUT_PATH = '/home/z/my-project/download/DeepMindQ_v1.0_Starting_Point.pdf'
os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)

doc = TocDocTemplate(
    OUTPUT_PATH, pagesize=A4,
    leftMargin=55, rightMargin=55, topMargin=50, bottomMargin=50,
    title='DeepMindQ Production Foundation v1.0 Starting Point',
    author='DeepMindQ Engineering Audit',
    subject='Baseline Checkpoint Report'
)

# Override the default onPage handler to add page numbers
def on_later_pages(canvas, doc):
    canvas.saveState()
    canvas.setFont('DejaVuMono', 8)
    canvas.setFillColor(TEXT_MUTED)
    canvas.drawCentredString(A4[0] / 2, 25, f"Page {doc.page}")
    canvas.restoreState()

# Monkey-patch to inject page numbers on all pages after first
def patched_handle_pageBegin(self):
    super(self.__class__, self).handle_pageBegin()
    if self.page > 1:
        on_later_pages(self.canv, self)

import types
original_handle = TocDocTemplate.handle_pageBegin
doc.handle_pageBegin = types.MethodType(patched_handle_pageBegin, doc)

story = []

# ══════════════════════════════════════════════════
# COVER PAGE (built inline with ReportLab for reports)
# ══════════════════════════════════════════════════
story.append(Spacer(1, 120))
story.append(Paragraph('PRODUCTION READINESS AUDIT', ParagraphStyle('CoverKicker',
    fontName='NotoSansSC-Bold', fontSize=11, leading=14, textColor=TEXT_MUTED,
    letterSpacing=3)))
story.append(Spacer(1, 20))
story.append(HRFlowable(width="60%", thickness=3, color=HEADER_FILL, spaceAfter=20))
story.append(Paragraph('DeepMindQ<br/>Production Foundation v1.0', ParagraphStyle('CoverTitle',
    fontName='NotoSerifSC-Bold', fontSize=38, leading=46, textColor=TEXT_PRIMARY)))
story.append(Spacer(1, 10))
story.append(Paragraph('Starting Point', ParagraphStyle('CoverSubtitle',
    fontName='NotoSerifSC', fontSize=22, leading=28, textColor=ACCENT)))
story.append(Spacer(1, 20))
story.append(HRFlowable(width="40%", thickness=1, color=BORDER, spaceAfter=20))
story.append(Paragraph(
    'Frozen baseline snapshot captured before implementation of the Production Foundation v1.0 recovery plan. '
    'This document records the exact state of the DeepMindQ platform: code metrics, test results, runtime configuration, '
    'database state, and production readiness scores. No code modifications were made during the creation of this checkpoint.',
    ParagraphStyle('CoverSummary', fontName='NotoSerifSC', fontSize=11, leading=17,
        textColor=TEXT_MUTED, alignment=TA_JUSTIFY)))
story.append(Spacer(1, 60))
story.append(Paragraph('Commit: f2a971a  |  Branch: main  |  Date: 2026-08-01',
    ParagraphStyle('CoverMeta', fontName='DejaVuMono', fontSize=9, textColor=TEXT_MUTED)))
story.append(PageBreak())

# ══════════════════════════════════════════════════
# TABLE OF CONTENTS
# ══════════════════════════════════════════════════
story.append(Paragraph('Table of Contents', s_h1))
story.append(Spacer(1, 12))
toc = TableOfContents()
toc.levelStyles = [toc_h0, toc_h1]
story.append(toc)
story.append(PageBreak())

# ══════════════════════════════════════════════════
# 1. CODE BASELINE
# ══════════════════════════════════════════════════
story.append(add_heading('1. Code Baseline', s_h1, level=0))
story.append(Paragraph(
    'The code baseline captures the essential structural metrics of the DeepMindQ platform at the moment '
    'this checkpoint was recorded. These numbers represent the frozen state before any v1.0 remediation '
    'work begins. All values were obtained through direct filesystem inspection and git operations on commit '
    'f2a971af5b15050c44a180184ea972477cb61753. No uncommitted changes exist in the working tree. '
    'The platform consists of 626 TypeScript/TSX source files totaling 182,513 lines of code, 223 API route handlers, '
    '77 screen components, 96 Prisma models, and a 2,909-line schema definition.', s_body))

story.append(add_heading('1.1 Repository State', s_h2, level=1))
story.append(make_table(
    ['Metric', 'Value'],
    [
        ['Git Commit Hash', 'f2a971af5b15050c44a180184ea972477cb61753'],
        ['Branch', 'main'],
        ['Uncommitted Changes', 'None (clean working tree)'],
        ['Package Version', '0.2.0'],
        ['Next.js Version', '16.1.1'],
        ['Prisma Client', '6.19.3'],
        ['TypeScript', '5.x'],
        ['Vitest', '4.1.10'],
    ],
    [180, 280]
))
story.append(Spacer(1, 8))

story.append(add_heading('1.2 Code Metrics', s_h2, level=1))
story.append(make_table(
    ['Metric', 'Value'],
    [
        ['Total TypeScript Files', '626'],
        ['Total Lines of Code (src/)', '182,513'],
        ['API Route Handlers', '223'],
        ['Screen Components', '77'],
        ['Prisma Models', '96'],
        ['Prisma Enums', '20'],
        ['Prisma Schema Lines', '2,909'],
        ['Proxy Middleware Lines', '221'],
        ['Database Size', '2.0 MB (SQLite)'],
    ],
    [180, 280]
))
story.append(Spacer(1, 8))

story.append(add_heading('1.3 API Route Authentication Coverage', s_h2, level=1))
story.append(Paragraph(
    'Of the 223 total API route handlers in the codebase, only <b>1 route</b> imports any form of authentication '
    'middleware (<font face="DejaVuMono">withApiMiddleware</font>). The proxy middleware at <font face="DejaVuMono">src/proxy.ts:95</font> '
    'checks only for the <font face="DejaVuMono">dmq_session</font> cookie presence, not its validity against '
    'the database. This means that <b>222 of 223 API routes</b> are effectively unprotected. The '
    '<font face="DejaVuMono">checkApiAuth()</font> and <font face="DejaVuMono">requireAdminRole()</font> functions '
    'exist in <font face="DejaVuMono">src/lib/api-auth.ts</font> and are fully exported, but they are not imported '
    'by any route handler. Additionally, 105 routes use the <font face="DejaVuMono">apiSuccess</font> or '
    '<font face="DejaVuMono">utilitySuccess</font> response envelope patterns, while the remaining 118 routes return '
    'raw JSON without consistent envelope formatting.', s_body))

story.append(make_table(
    ['Category', 'Count', 'Details'],
    [
        ['Total API Routes', '223', 'All route.ts files under src/app/api/'],
        [Paragraph('Protected (auth middleware)', s_score_high), '1', Paragraph('engines/brief/route.ts uses withApiMiddleware', s_table_cell_mono)],
        [Paragraph('Unprotected', s_score_high), '222', Paragraph('No checkApiAuth, requireAdminRole, or withApiMiddleware import', s_table_cell_mono)],
        ['Envelope-Compliant', '105', Paragraph('Use apiSuccess or utilitySuccess wrappers', s_table_cell_mono)],
        ['Non-Envelope', '118', Paragraph('Return raw JSON without standardized wrapper', s_table_cell_mono)],
    ],
    [140, 50, 270]
))
story.append(Spacer(1, 8))

# ══════════════════════════════════════════════════
# 2. TEST BASELINE
# ══════════════════════════════════════════════════
story.append(add_heading('2. Test Baseline', s_h1, level=0))
story.append(Paragraph(
    'The test baseline records the exact state of the test suite at this checkpoint. Tests were executed '
    'using <font face="DejaVuMono">npx vitest run</font> with no filters, capturing the full 48-file suite '
    'of 1,791 tests. The test run completed in 39.25 seconds. Six test files failed with a total of 73 individual '
    'test failures. Fourteen tests are skipped. The remaining 1,704 tests pass. These numbers represent the floor '
    'that the v1.0 implementation must not regress below. Additionally, <font face="DejaVuMono">tsc --noEmit</font> '
    'passes with zero type errors, and <font face="DejaVuMono">next build</font> compiles successfully in 49 seconds '
    'with all 180 static pages generated.', s_body))

story.append(add_heading('2.1 Test Summary', s_h2, level=1))
story.append(make_table(
    ['Metric', 'Value'],
    [
        ['Test Files Total', '48'],
        ['Test Files Passed', '42'],
        [Paragraph('Test Files Failed', s_score_high), '6'],
        ['Total Tests', '1,791'],
        ['Tests Passed', '1,704'],
        [Paragraph('Tests Failed', s_score_high), '73'],
        ['Tests Skipped', '14'],
        ['Pass Rate', '95.1%'],
        ['Duration', '39.25s'],
        ['TypeScript (tsc --noEmit)', 'PASS (zero errors)'],
        ['Next.js Build', 'PASS (compiled in 49s, 180 pages)'],
    ],
    [200, 260]
))
story.append(Spacer(1, 8))

story.append(add_heading('2.2 Failing Test Files', s_h2, level=1))
story.append(Paragraph(
    'The six failing test files cluster into two distinct root causes. The first cluster involves the Intelligence API '
    'middleware and envelope contract tests (tickets 1, 2, and deep coverage), where the <font face="DejaVuMono">VALID_INCLUDES</font> '
    'set has a count mismatch, envelope responses are not consistently structured, and the '
    '<font face="DejaVuMono">intelligenceGuard</font> middleware does not reject invalid include parameters as expected. '
    'The second cluster involves the Account Prioritization Engine tests (ticket 4), where '
    '<font face="DejaVuMono">parseRevenueBreakdown</font> is not exported from the engine module, causing all '
    'score unification and integration tests to fail with <font face="DejaVuMono">TypeError: parseRevenueBreakdown is not a function</font>. '
    'Additionally, the <font face="DejaVuMono">getICPProfile()</font> helper does not correctly parse JSON values from '
    'SystemSetting records, leading to cascading failures in static fit scoring.', s_body))

story.append(make_table(
    ['Test File', 'Failed', 'Root Cause'],
    [
        [Paragraph('tests/ticket-deep-coverage.test.ts', s_table_cell_mono), '3', Paragraph('VALID_INCLUDES count mismatch (22 vs actual); computeFreshness stale logic; intelligenceGuard reject behavior', s_table_cell)],
        [Paragraph('tests/ticket1-intelligence-validation.test.ts', s_table_cell_mono), '7', Paragraph('Schema validation: includeSchema rejects invalid values not enforced; companyIdSchema rejects empty string not enforced', s_table_cell)],
        [Paragraph('tests/ticket1-intelligence-integration.test.ts', s_table_cell_mono), '1', Paragraph('Non-existent company returns wrong error format', s_table_cell)],
        [Paragraph('tests/ticket2-integration.test.ts', s_table_cell_mono), '16', Paragraph('Intelligence API envelope contract: 10 endpoints missing utilitySuccess wrapper; freshness not in meta; include selective loading broken', s_table_cell)],
        [Paragraph('src/lib/account-prioritization/__tests__/engine.test.ts', s_table_cell_mono), '21', Paragraph('parseRevenueBreakdown not exported; getICPProfile JSON parse error; scoreStaticFit edge cases; scoreTimingUrgency signal recency', s_table_cell)],
        [Paragraph('src/lib/account-prioritization/__tests__/ticket4-score-unification.test.ts', s_table_cell_mono), '25', Paragraph('Same parseRevenueBreakdown missing export; normalizeRevenueCategory mapping wrong; tier classification boundary values; null handling', s_table_cell)],
    ],
    [170, 40, 250]
))
story.append(Spacer(1, 8))

story.append(add_heading('2.3 Failure Breakdown by Root Cause', s_h2, level=1))
story.append(make_table(
    ['Root Cause Category', 'Tests Affected', 'Files', 'Severity'],
    [
        ['parseRevenueBreakdown not exported', '46', '2 (engine, ticket4)', Paragraph('P1 - Blocking', s_score_high)],
        ['Intelligence API envelope inconsistency', '16', '1 (ticket2)', Paragraph('P1 - Contract violation', s_score_high)],
        ['VALID_INCLUDES count mismatch', '3', '1 (deep-coverage)', Paragraph('P2 - Validation gap', s_score_med)],
        ['getICPProfile JSON parse error', '21', '2 (engine, ticket4)', Paragraph('P1 - Scoring broken', s_score_high)],
        ['Schema validation not enforced', '7', '1 (ticket1-validation)', Paragraph('P2 - Input validation gap', s_score_med)],
        ['Tier boundary classification', '8', '1 (ticket4)', Paragraph('P2 - Business logic', s_score_med)],
    ],
    [150, 60, 120, 130]
))
story.append(Spacer(1, 8))

# ══════════════════════════════════════════════════
# 3. RUNTIME BASELINE
# ══════════════════════════════════════════════════
story.append(add_heading('3. Runtime Baseline', s_h1, level=0))
story.append(Paragraph(
    'The runtime baseline documents the operational state of the DeepMindQ platform at checkpoint time. '
    'The database is a local SQLite file at <font face="DejaVuMono">db/custom.db</font> (2.0 MB) with 72 tables created '
    'by Prisma but containing minimal data. The environment is configured with a single <font face="DejaVuMono">.env</font> '
    'variable (<font face="DejaVuMono">DATABASE_URL</font>). No registered users exist in the system, no active sessions, '
    'and no seed data beyond what appears to be development test records. The authentication system is technically functional '
    '(login, OTP, password reset routes exist) but operates in an empty-user environment.', s_body))

story.append(add_heading('3.1 Database State', s_h2, level=1))
story.append(make_table(
    ['Metric', 'Value'],
    [
        ['Database Engine', 'SQLite 3.x (version 3.46.0)'],
        ['Database File', 'db/custom.db (2.0 MB)'],
        ['Total Tables', '72'],
        ['Prisma Migrations', '1 (20260724_wave8a_intelligence_object.sql)'],
        ['Registered Users', '0'],
        ['Active Sessions', '0'],
        ['OtpCode Records', '0'],
        ['Total Data Rows (all tables)', '87'],
    ],
    [200, 260]
))
story.append(Spacer(1, 8))

story.append(add_heading('3.2 Tables With Data', s_h2, level=1))
story.append(Paragraph(
    'Of the 72 database tables, only 15 contain any data. The largest tables are CompanySignal (43 rows) and '
    'CompanyNote (10 rows), which appear to be development test data. Most business-critical tables (User, '
    'Session, AIGenerationAudit, EmailSequence, Playbook, KnowledgeEntry, Embedding) are completely empty. '
    'This confirms the platform has never been seeded with production or gold-standard data.', s_body))

story.append(make_table(
    ['Table', 'Rows', 'Likely Source'],
    [
        ['CompanySignal', '43', Paragraph('Dev test data — AI-generated signal records', s_table_cell)],
        ['CompanyNote', '10', Paragraph('Dev test data — manual company notes', s_table_cell)],
        ['Contact', '10', Paragraph('Dev test data — sample contact records', s_table_cell)],
        ['ImportBatch', '9', Paragraph('Dev test data — data import history', s_table_cell)],
        ['Company', '3', Paragraph('Dev test data — sample company records', s_table_cell)],
        ['Reply', '10', Paragraph('Dev test data — email reply records', s_table_cell)],
        ['CompanyTimelineEvent', '2', Paragraph('Dev test data — timeline events', s_table_cell)],
        ['ContactNote', '3', Paragraph('Dev test data — contact notes', s_table_cell)],
        ['OpportunityRecommendation', '2', Paragraph('Dev test data — AI recommendations', s_table_cell)],
        ['AccountStrategy', '1', Paragraph('Dev test data — account strategy', s_table_cell)],
        ['CapabilityAsset', '1', Paragraph('Dev test data — capability library', s_table_cell)],
        ['CompanyResearchCard', '1', Paragraph('Dev test data — research card', s_table_cell)],
        ['SignalCapabilityMatch', '1', Paragraph('Dev test data — signal matching', s_table_cell)],
        ['SystemSetting', '1', Paragraph('user_preferences = {"tone":"formal"}', s_table_cell)],
        ['All Other Tables (57)', '0', Paragraph('Completely empty', s_table_cell)],
    ],
    [130, 40, 290]
))
story.append(Spacer(1, 8))

story.append(add_heading('3.3 Environment Configuration', s_h2, level=1))
story.append(Paragraph(
    'The environment configuration is minimal. The <font face="DejaVuMono">.env</font> file contains exactly one variable: '
    'the database connection URL. No external service credentials (API keys for LLM providers, email service, etc.) '
    'are configured. The platform relies on the ZAI SDK for LLM operations, which is available in the deployment '
    'environment but requires no local API key configuration. This minimal configuration confirms the platform '
    'is in a pre-production state with no production secrets or external integrations configured.', s_body))

story.append(make_table(
    ['Variable', 'Value', 'Notes'],
    [
        ['DATABASE_URL', 'file:/home/z/my-project/db/custom.db', Paragraph('Local SQLite — no remote DB', s_table_cell)],
        ['LLM Provider Keys', Paragraph('Not configured', s_score_high), Paragraph('Relies on ZAI SDK runtime injection', s_table_cell)],
        ['Session Secret', Paragraph('Not configured', s_score_high), Paragraph('No JWT_SECRET or session secret in .env', s_table_cell)],
        ['Email Service', Paragraph('Not configured', s_score_high), Paragraph('No SMTP or email API credentials', s_table_cell)],
        ['Redis / Cache', Paragraph('Not configured', s_score_high), Paragraph('No external cache layer', s_table_cell)],
    ],
    [100, 180, 180]
))
story.append(Spacer(1, 8))

story.append(add_heading('3.4 Authentication Flow', s_h2, level=1))
story.append(Paragraph(
    'The authentication system has a complete surface of routes (login, register, logout, OTP verification, '
    'password reset, session management via <font face="DejaVuMono">/api/auth/me</font>). However, the actual security '
    'posture is severely compromised by two critical issues. First, the proxy middleware at '
    '<font face="DejaVuMono">src/proxy.ts:95</font> only checks for the <font face="DejaVuMono">dmq_session</font> '
    'cookie presence without validating it against the database. Any client that sets a '
    '<font face="DejaVuMono">dmq_session</font> cookie (even a fabricated one) will pass the proxy and reach all '
    'API routes. Second, the <font face="DejaVuMono">/api/auth/me</font> endpoint at line 38-52 contains a catch '
    'block that, upon any database failure, returns a hardcoded admin identity '
    '(<font face="DejaVuMono">shanker001@gmail.com</font> with role <font face="DejaVuMono">admin</font>). '
    'This means any error condition in the authentication flow grants full admin access. Combined with the fact that '
    'no API routes (except one) import any authentication middleware, the platform is effectively open access.', s_body))

story.append(make_table(
    ['Component', 'File', 'Status', 'Risk'],
    [
        ['Proxy Cookie Check', Paragraph('src/proxy.ts:95', s_table_cell_mono), Paragraph('Presence-only check', s_score_high), Paragraph('P0 — Fabricated cookie bypasses all auth', s_score_high)],
        ['Auth /me Fallback', Paragraph('src/app/api/auth/me/route.ts:38-52', s_table_cell_mono), Paragraph('Hardcoded admin on DB error', s_score_high), Paragraph('P0 — Error grants admin access', s_score_high)],
        ['checkApiAuth()', Paragraph('src/lib/api-auth.ts', s_table_cell_mono), Paragraph('Exported but never imported', s_score_high), Paragraph('P1 — Dead code, 0 routes protected', s_score_high)],
        ['requireAdminRole()', Paragraph('src/lib/api-auth.ts', s_table_cell_mono), Paragraph('Exported but never imported', s_score_high), Paragraph('P1 — Dead code, no admin enforcement', s_score_high)],
        ['Seed Routes', Paragraph('src/app/api/seed/route.ts', s_table_cell_mono), Paragraph('No authentication', s_score_high), Paragraph('P0 — Destructive DB ops publicly accessible', s_score_high)],
        ['Export Route', Paragraph('src/app/api/export/route.ts', s_table_cell_mono), Paragraph('No auth, no limits', s_score_high), Paragraph('P0 — Mass data exfiltration', s_score_high)],
    ],
    [90, 120, 100, 150]
))
story.append(Spacer(1, 8))

# ══════════════════════════════════════════════════
# 4. CRITICAL FINDINGS REFERENCE
# ══════════════════════════════════════════════════
story.append(add_heading('4. Critical Findings Reference (Pre-Existing)', s_h1, level=0))
story.append(Paragraph(
    'These findings were documented in the previous Reality Verification Matrix and remain unresolved at this checkpoint. '
    'They are included here as a reference so that progress can be tracked against the v1.0 remediation plan. Each finding '
    'has been independently verified with direct file:line evidence and confirmed as genuine, not false positives. '
    'None of the 15 findings from the verification audit have been addressed.', s_body))

story.append(make_table(
    ['ID', 'Severity', 'Finding', 'File', 'Status'],
    [
        ['F01', Paragraph('P0', s_score_high), 'Proxy auth: cookie presence only, no DB validation', Paragraph('src/proxy.ts:95', s_table_cell_mono), Paragraph('Open', s_score_high)],
        ['F02', Paragraph('P0', s_score_high), '/auth/me hardcoded admin fallback on DB error', Paragraph('src/app/api/auth/me/route.ts:38-52', s_table_cell_mono), Paragraph('Open', s_score_high)],
        ['F03', Paragraph('P0', s_score_high), '222/223 API routes without authentication', Paragraph('src/app/api/**', s_table_cell_mono), Paragraph('Open', s_score_high)],
        ['F04', Paragraph('P0', s_score_high), 'Seed routes: destructive DB ops, zero auth', Paragraph('src/app/api/seed/route.ts', s_table_cell_mono), Paragraph('Open', s_score_high)],
        ['F05', Paragraph('P0', s_score_high), 'Export route: no auth, no row limits, no audit', Paragraph('src/app/api/export/route.ts', s_table_cell_mono), Paragraph('Open', s_score_high)],
        ['F06', Paragraph('P1', s_score_med), 'Reasoning engine risk filter always true (operator precedence)', Paragraph('src/lib/enterprise-reasoning-engine.ts:250', s_table_cell_mono), Paragraph('Open', s_score_high)],
        ['F07', Paragraph('P1', s_score_med), 'LLM client system prompt role wrong (assistant vs system)', Paragraph('src/lib/llm-client.ts:145', s_table_cell_mono), Paragraph('Open', s_score_high)],
        ['F08', Paragraph('P1', s_score_med), 'AI token/cost tracking hardcoded to 0', Paragraph('src/lib/llm-client.ts:584-588', s_table_cell_mono), Paragraph('Open', s_score_high)],
        ['F09', Paragraph('P1', s_score_med), 'usage-tracker writes to wrong table (AIGenerationAudit not AIUsageLog)', Paragraph('src/lib/ai-copilot/usage-tracker.ts:87-99', s_table_cell_mono), Paragraph('Open', s_score_high)],
        ['F10', Paragraph('P1', s_score_med), 'Intelligence API VALID_INCLUDES count mismatch', Paragraph('src/lib/intelligence-api/middleware.ts:64', s_table_cell_mono), Paragraph('Open', s_score_high)],
        ['F11', Paragraph('P1', s_score_med), 'Intelligence API envelope inconsistency (5/6 endpoints)', Paragraph('src/app/api/intelligence/**', s_table_cell_mono), Paragraph('Open', s_score_high)],
        ['F12', Paragraph('P1', s_score_med), 'parseRevenueBreakdown not exported from engine', Paragraph('src/lib/account-prioritization/engine.ts', s_table_cell_mono), Paragraph('Open', s_score_high)],
        ['F13', Paragraph('P2', s_score_low), 'requireAdminRole defined but never imported', Paragraph('src/lib/api-auth.ts:47-55', s_table_cell_mono), Paragraph('Open', s_score_high)],
        ['F14', Paragraph('P2', s_score_low), '/api/seed has no auth guard (documented as non-public)', Paragraph('src/lib/auth-helpers.ts:19', s_table_cell_mono), Paragraph('Open', s_score_high)],
        ['F15', Paragraph('P2', s_score_low), 'AIUsageLog model exists but never written to', Paragraph('prisma/schema.prisma:2785', s_table_cell_mono), Paragraph('Open', s_score_high)],
    ],
    [30, 40, 160, 120, 110]
))
story.append(Spacer(1, 8))

# ══════════════════════════════════════════════════
# 5. PRODUCTION READINESS SCORES
# ══════════════════════════════════════════════════
story.append(add_heading('5. Production Readiness Scores (Pre-Fix)', s_h1, level=0))
story.append(Paragraph(
    'The following scores assess the platform across six critical dimensions, each scored on a 1-10 scale where '
    '10 represents full production readiness. These scores are based on the evidence gathered in this checkpoint '
    'and the 15 verified findings from the Reality Verification Matrix. They represent the starting line for the '
    'v1.0 remediation effort. The composite score of 2.8 out of 10 reflects a platform that compiles and builds '
    'successfully but has critical security gaps, broken business logic, and insufficient test coverage for '
    'its claimed-completed features.', s_body))

story.append(add_heading('5.1 Scoring Matrix', s_h2, level=1))
story.append(make_table(
    ['Dimension', 'Score', 'Rating', 'Justification'],
    [
        [Paragraph('<b>Security</b>', s_table_cell), score_cell(1, 10), Paragraph('Critical', s_score_high),
         Paragraph('P0: Proxy checks cookie presence only. /auth/me returns hardcoded admin on error. 222/223 routes unprotected. Seed and export routes have zero auth.', s_table_cell)],
        [Paragraph('<b>Reliability</b>', s_table_cell), score_cell(4, 10), Paragraph('Marginal', s_score_med),
         Paragraph('Build and TSC pass. 73 tests fail across 6 files. Reasoning engine filter bug lets all signals through. Auth fallback masks failures.', s_table_cell)],
        [Paragraph('<b>AI Quality</b>', s_table_cell), score_cell(2, 10), Paragraph('Critical', s_score_high),
         Paragraph('LLM system prompt role is wrong (assistant vs system). Token/cost tracking hardcoded to 0. Usage tracker writes to wrong table. Reasoning engine filter broken.', s_table_cell)],
        [Paragraph('<b>Data Integrity</b>', s_table_cell), score_cell(3, 10), Paragraph('Poor', s_score_high),
         Paragraph('Schema is sound (96 models). But AIUsageLog never written to. Export route has no limits. Seed routes can destroy data. No row-level security.', s_table_cell)],
        [Paragraph('<b>Testing</b>', s_table_cell), score_cell(5, 10), Paragraph('Marginal', s_score_med),
         Paragraph('1,704/1,791 tests pass (95.1%). But failures expose real bugs: missing exports, wrong envelope contracts, validation gaps. No E2E or integration tests for auth.', s_table_cell)],
        [Paragraph('<b>Deployment Readiness</b>', s_table_cell), score_cell(2, 10), Paragraph('Critical', s_score_high),
         Paragraph('No staging environment. No migration strategy beyond one file. No environment variables for production. No health checks for critical services. No rollback plan.', s_table_cell)],
    ],
    [80, 35, 50, 295]
))
story.append(Spacer(1, 12))

# Composite score
story.append(make_table(
    ['Composite Score', 'Rating', 'Assessment'],
    [
        [Paragraph('<b>2.8 / 10</b>', ParagraphStyle('BigScore', fontName='NotoSansSC-Bold', fontSize=18, alignment=TA_CENTER, textColor=SEM_ERROR)),
         Paragraph('<b>NOT PRODUCTION READY</b>', ParagraphStyle('BigRating', fontName='NotoSansSC-Bold', fontSize=14, alignment=TA_CENTER, textColor=SEM_ERROR)),
         Paragraph('Platform compiles and serves pages but has critical security vulnerabilities, broken business logic in AI engines, '
                   'unreliable authentication, and no operational safeguards. Requires significant remediation before any production deployment.', s_table_cell)],
    ],
    [100, 140, 220]
))
story.append(Spacer(1, 8))

# ══════════════════════════════════════════════════
# 6. V1.0 IMPLEMENTATION RULES
# ══════════════════════════════════════════════════
story.append(add_heading('6. Production Foundation v1.0 Implementation Rules', s_h1, level=0))
story.append(Paragraph(
    'The following rules are binding for the entire v1.0 implementation effort. They are designed to prevent '
    'the most common failure patterns observed in the current codebase: masking bugs with permissive tests, '
    'introducing regressions in unrelated subsystems, and making uncoordinated changes to shared contracts. '
    'Every implementation decision must be evaluated against these rules before, during, and after code changes.', s_body))

story.append(add_heading('6.1 Test Modification Rules', s_h2, level=1))
story.append(Paragraph(
    '<b>Primary Rule: Never modify tests just to make them pass.</b> The default action when a test fails is to fix '
    'the production code that causes the failure. Only modify a test when you can prove with evidence from the '
    'ARCHITECTURE.md specification or documented business requirements that the test expectation is incorrect. '
    'Every test change requires a documented justification explaining: (1) why the original test was wrong, '
    '(2) the evidence from code or specification that proves it, and (3) why the new expectation is correct.', s_body))

story.append(Spacer(1, 6))
story.append(Paragraph('Required documentation for every test change:', s_rule_title))
story.append(Paragraph('1. <b>Why the test was wrong:</b> Specific reference to the ARCHITECTURE.md section or business requirement that the original test violated.', s_bullet))
story.append(Paragraph('2. <b>Code/spec evidence:</b> The exact file:line in ARCHITECTURE.md or the code contract that proves the original expectation was incorrect.', s_bullet))
story.append(Paragraph('3. <b>Why the new expectation is correct:</b> How the updated test aligns with the documented specification and does not simply mask a production bug.', s_bullet))

story.append(add_heading('6.2 Regression Prevention', s_h2, level=1))
story.append(Paragraph('Every code change must be validated against the frozen baseline recorded in this document. '
    'The following gates must pass before any change is committed:', s_body))
story.append(Paragraph('1. All 1,704 currently passing tests must continue to pass. Any regression in a previously passing test blocks the change.', s_bullet))
story.append(Paragraph('2. TypeScript compilation must remain at zero errors (<font face="DejaVuMono">tsc --noEmit</font>).', s_bullet))
story.append(Paragraph('3. The Next.js build must continue to succeed without errors.', s_bullet))
story.append(Paragraph('4. No new P0 or P1 findings may be introduced by any change.', s_bullet))

story.append(add_heading('6.3 Change Scope Rules', s_h2, level=1))
story.append(Paragraph('Changes must be scoped to the specific ticket or fix they address. Cross-cutting changes '
    '(especially to shared middleware, Prisma schema, or response envelope patterns) require explicit impact '
    'analysis documented in the worklog before implementation. Changes to the proxy middleware '
    '(<font face="DejaVuMono">src/proxy.ts</font>) affect all 223 API routes simultaneously and must be treated '
    'as high-risk changes requiring full test suite validation.', s_body))

story.append(add_heading('6.4 Authentication Remediation Order', s_h2, level=1))
story.append(Paragraph(
    'Given that 222 routes currently lack authentication, enforcing auth must be done in a staged approach '
    'to prevent breaking the entire platform. The recommended order is: (1) fix the proxy middleware to validate '
    'sessions against the database, (2) add public route whitelist for login, register, health, and static assets, '
    '(3) import <font face="DejaVuMono">checkApiAuth</font> into high-risk routes (seed, export, admin, user management), '
    '(4) progressively add auth to remaining routes by domain area, (5) add <font face="DejaVuMono">requireAdminRole</font> '
    'to admin-only endpoints. Each stage must be a separate commit with its own test validation.', s_body))

# ══════════════════════════════════════════════════
# 7. KNOWN CRITICAL FILES
# ══════════════════════════════════════════════════
story.append(add_heading('7. Known Critical Files', s_h1, level=0))
story.append(Paragraph(
    'These files contain verified bugs, security vulnerabilities, or business logic errors that must be addressed '
    'during the v1.0 remediation. They are listed with their line counts to indicate the scope of changes needed. '
    'The total is 2,074 lines across 6 files, representing the core of the remediation effort.', s_body))

story.append(make_table(
    ['File', 'Lines', 'Critical Issue'],
    [
        [Paragraph('src/lib/enterprise-reasoning-engine.ts', s_table_cell_mono), '667', Paragraph('Line 250: Risk filter always true (operator precedence bug). All risk signals pass through unfiltered.', s_table_cell)],
        [Paragraph('src/lib/llm-client.ts', s_table_cell_mono), '594', Paragraph('Line 145: System prompt role wrong. Lines 584-588: Token/cost tracking hardcoded to 0.', s_table_cell)],
        [Paragraph('src/lib/intelligence-api/middleware.ts', s_table_cell_mono), '321', Paragraph('Line 64: VALID_INCLUDES count mismatch. Inconsistent createResponse() usage.', s_table_cell)],
        [Paragraph('src/lib/ai-copilot/usage-tracker.ts', s_table_cell_mono), '214', Paragraph('Lines 87-99: Writes to AIGenerationAudit instead of AIUsageLog. Line 128: Queries wrong table.', s_table_cell)],
        [Paragraph('src/proxy.ts', s_table_cell_mono), '221', Paragraph('Line 95: Cookie presence-only check, no DB validation. Single point of auth failure.', s_table_cell)],
        [Paragraph('src/app/api/auth/me/route.ts', s_table_cell_mono), '57', Paragraph('Lines 38-52: Hardcoded admin identity on database error. P0 security hole.', s_table_cell)],
    ],
    [160, 35, 265]
))
story.append(Spacer(1, 8))

# ══════════════════════════════════════════════════
# BUILD
# ══════════════════════════════════════════════════
doc.multiBuild(story)
print(f"PDF generated: {OUTPUT_PATH}")
