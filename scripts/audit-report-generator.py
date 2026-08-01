#!/usr/bin/env python3
"""DeepMindQ Production Readiness Audit Report Generator"""
import hashlib, os, sys
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm, cm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, HRFlowable, KeepTogether
)
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY, TA_RIGHT

# ━━ Cascade Palette ━━
PAGE_BG       = colors.HexColor('#f7f6f6')
SECTION_BG    = colors.HexColor('#efeeec')
CARD_BG       = colors.HexColor('#eeede9')
TABLE_STRIPE  = colors.HexColor('#f4f4f3')
HEADER_FILL   = colors.HexColor('#554e37')
COVER_BLOCK   = colors.HexColor('#615942')
BORDER        = colors.HexColor('#d1cab7')
ICON          = colors.HexColor('#988449')
ACCENT        = colors.HexColor('#887129')
TEXT_PRIMARY   = colors.HexColor('#201f1d')
TEXT_MUTED     = colors.HexColor('#7c7972')
SEM_SUCCESS   = colors.HexColor('#418c5a')
SEM_WARNING   = colors.HexColor('#a38446')
SEM_ERROR     = colors.HexColor('#894e49')
SEM_INFO      = colors.HexColor('#4c6c8b')

FONT_DIR = '/usr/share/fonts'
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase.pdfmetrics import registerFontFamily

pdfmetrics.registerFont(TTFont('NotoSerifSC', f'{FONT_DIR}/truetype/noto-serif-sc/NotoSerifSC-Regular.ttf'))
pdfmetrics.registerFont(TTFont('NotoSerifSC-Bold', f'{FONT_DIR}/truetype/noto-serif-sc/NotoSerifSC-Bold.ttf'))
registerFontFamily('NotoSerifSC', normal='NotoSerifSC', bold='NotoSerifSC-Bold')
pdfmetrics.registerFont(TTFont('DejaVu', f'{FONT_DIR}/truetype/dejavu/DejaVuSans.ttf'))
pdfmetrics.registerFont(TTFont('DejaVuBold', f'{FONT_DIR}/truetype/dejavu/DejaVuSans-Bold.ttf'))

# ━━ Styles ━━
styles = getSampleStyleSheet()

TITLE_STYLE = ParagraphStyle('AuditTitle', parent=styles['Title'],
    fontName='DejaVuBold', fontSize=26, leading=32, textColor=HEADER_FILL,
    spaceAfter=6*mm, alignment=TA_LEFT)

H1_STYLE = ParagraphStyle('H1', parent=styles['Heading1'],
    fontName='DejaVuBold', fontSize=18, leading=24, textColor=HEADER_FILL,
    spaceBefore=8*mm, spaceAfter=4*mm, borderWidth=0,
    borderColor=BORDER, borderPadding=0)

H2_STYLE = ParagraphStyle('H2', parent=styles['Heading2'],
    fontName='DejaVuBold', fontSize=14, leading=18, textColor=COVER_BLOCK,
    spaceBefore=6*mm, spaceAfter=3*mm)

H3_STYLE = ParagraphStyle('H3', parent=styles['Heading3'],
    fontName='DejaVuBold', fontSize=11, leading=15, textColor=ICON,
    spaceBefore=4*mm, spaceAfter=2*mm)

BODY = ParagraphStyle('Body', parent=styles['Normal'],
    fontName='DejaVu', fontSize=9.5, leading=14, textColor=TEXT_PRIMARY,
    spaceAfter=2*mm, alignment=TA_JUSTIFY)

META_STYLE = ParagraphStyle('Meta', parent=styles['Normal'],
    fontName='DejaVu', fontSize=8, leading=12, textColor=TEXT_MUTED,
    spaceAfter=1*mm, alignment=TA_LEFT)

CRITICAL_STYLE = ParagraphStyle('Critical', parent=BODY,
    textColor=SEM_ERROR, fontName='DejaVuBold', fontSize=9.5)

CELL_STYLE = ParagraphStyle('Cell', parent=BODY,
    fontSize=8, leading=11, spaceAfter=0, spaceBefore=0)

CELL_HEADER = ParagraphStyle('CellH', parent=CELL_STYLE,
    fontName='DejaVuBold', textColor=colors.white, fontSize=8, leading=11)

STATUS_PARTIAL = ParagraphStyle('StatusPartial', parent=CELL_STYLE,
    textColor=SEM_WARNING, fontName='DejaVuBold')
STATUS_COMPLETE = ParagraphStyle('StatusComplete', parent=CELL_STYLE,
    textColor=SEM_SUCCESS, fontName='DejaVuBold')
STATUS_FAIL = ParagraphStyle('StatusFail', parent=CELL_STYLE,
    textColor=SEM_ERROR, fontName='DejaVuBold')

OUTPUT_PATH = '/home/z/my-project/download/DeepMindQ-Production-Readiness-Audit.pdf'

def hr():
    return HRFlowable(width='100%', thickness=0.5, color=BORDER, spaceAfter=3*mm, spaceBefore=2*mm)

def make_table(headers, rows, col_widths=None):
    """Create a styled table with alternating rows."""
    avail = A4[0] - 2*2*cm
    if col_widths is None:
        n = len(headers)
        col_widths = [avail / n] * n

    hrow = [Paragraph(h, CELL_HEADER) for h in headers]
    data = [hrow]
    for row in rows:
        data.append([Paragraph(str(c), CELL_STYLE) for c in row])

    t = Table(data, colWidths=col_widths, repeatRows=1)
    style_cmds = [
        ('BACKGROUND', (0, 0), (-1, 0), HEADER_FILL),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTSIZE', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
        ('RIGHTPADDING', (0, 0), (-1, -1), 4),
        ('GRID', (0, 0), (-1, -1), 0.4, BORDER),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ]
    for i in range(1, len(data)):
        if i % 2 == 0:
            style_cmds.append(('BACKGROUND', (0, i), (-1, i), TABLE_STRIPE))
        else:
            style_cmds.append(('BACKGROUND', (0, i), (-1, i), colors.white))
    t.setStyle(TableStyle(style_cmds))
    return t

def make_colored_table(headers, rows, col_widths, status_col=None):
    """Table with colored status column."""
    hrow = [Paragraph(h, CELL_HEADER) for h in headers]
    data = [hrow]
    for row in rows:
        cells = []
        for j, c in enumerate(row):
            if status_col is not None and j == status_col:
                txt = str(c)
                if 'COMPLETE' in txt.upper() and 'PARTIAL' not in txt.upper() and 'NOT' not in txt.upper():
                    cells.append(Paragraph(txt, STATUS_COMPLETE))
                elif 'PARTIAL' in txt.upper() and 'NOT' not in txt.upper():
                    cells.append(Paragraph(txt, STATUS_PARTIAL))
                else:
                    cells.append(Paragraph(txt, STATUS_FAIL))
            else:
                cells.append(Paragraph(str(c), CELL_STYLE))
        data.append(cells)

    t = Table(data, colWidths=col_widths, repeatRows=1)
    style_cmds = [
        ('BACKGROUND', (0, 0), (-1, 0), HEADER_FILL),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTSIZE', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
        ('RIGHTPADDING', (0, 0), (-1, -1), 4),
        ('GRID', (0, 0), (-1, -1), 0.4, BORDER),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ]
    for i in range(1, len(data)):
        if i % 2 == 0:
            style_cmds.append(('BACKGROUND', (0, i), (-1, i), TABLE_STRIPE))
        else:
            style_cmds.append(('BACKGROUND', (0, i), (-1, i), colors.white))
    t.setStyle(TableStyle(style_cmds))
    return t

def build_report():
    avail = A4[0] - 2*2*cm
    story = []

    # ── COVER PAGE ──
    story.append(Spacer(1, 60*mm))
    story.append(Paragraph('DeepMindQ', TITLE_STYLE))
    story.append(Paragraph('Production Readiness Audit', ParagraphStyle('SubTitle',
        parent=TITLE_STYLE, fontSize=20, leading=26, textColor=COVER_BLOCK)))
    story.append(Spacer(1, 8*mm))
    story.append(hr())
    story.append(Paragraph('Independent Principal Engineer Assessment', META_STYLE))
    story.append(Paragraph('Date: August 1, 2026', META_STYLE))
    story.append(Paragraph('Scope: Tickets 1-11 (20-Phase Roadmap)', META_STYLE))
    story.append(Paragraph('Method: Full codebase review, not status report', META_STYLE))
    story.append(Spacer(1, 15*mm))
    story.append(Paragraph(
        '<b>Overall Confidence: 62%</b> &mdash; Strong frontend shell, critical gaps in security, '
        'scoring engine, AI governance enforcement, and database integrity.',
        ParagraphStyle('Verdict', parent=BODY, fontSize=11, leading=16,
            textColor=SEM_ERROR, fontName='DejaVuBold', borderWidth=1,
            borderColor=SEM_ERROR, borderPadding=8, backColor=colors.HexColor('#fdf2f0'))))
    story.append(PageBreak())

    # ── BUILD BASELINE ──
    story.append(Paragraph('1. Build Baseline', H1_STYLE))
    story.append(hr())
    story.append(make_table(
        ['Check', 'Result', 'Details'],
        [
            ['TypeScript (tsc --noEmit)', 'PASS', 'Zero errors'],
            ['Tests (vitest run)', '1704 pass / 73 fail / 14 skip', '6 files failing'],
            ['Next.js Build', 'PASS', 'All routes compile, no warnings'],
        ],
        [avail*0.35, avail*0.25, avail*0.40]
    ))
    story.append(Spacer(1, 3*mm))
    story.append(Paragraph(
        'The project compiles and builds without errors. However, 73 tests fail consistently across '
        '6 test files. The most critical cluster is Ticket 4 (account-prioritization engine) with 40 '
        'failures caused by missing function exports. Ticket 2 (Intelligence API integration) contributes '
        '23 failures from response envelope contract violations. These are not transient failures but '
        'persistent, structural issues that indicate incomplete or broken implementations.',
        BODY))

    # ── COMPLETION EVIDENCE MATRIX ──
    story.append(Paragraph('2. Completion Evidence Matrix', H1_STYLE))
    story.append(hr())
    story.append(Paragraph(
        'This matrix evaluates each of the 11 claimed-complete tickets against actual code evidence. '
        'Status is determined by: (1) running tests, (2) reading implementation files, (3) verifying API '
        'integration, and (4) checking for TODOs, mocks, and placeholder patterns. No previous completion '
        'statements were assumed.',
        BODY))

    story.append(make_colored_table(
        ['Ticket', 'Objective', 'Evidence', 'Tests', 'Real Status'],
        [
            ['T1', 'Foundation Hardening', '185 tests, Zod schemas, error middleware, ESLint rule',
             '113/113', 'PARTIAL - 6 integration tests fail'],
            ['T2', 'Intelligence API', 'middleware.ts, selective loading, freshness',
             '80/103', 'PARTIAL - 23 integration tests fail'],
            ['T3', 'AI Governance', 'governedAI wrapper, 10 configs, ESLint rule',
             '~280 pass', 'PARTIAL - enforceGovernance:false everywhere'],
            ['T4', '3-Score Architecture', 'engine.ts rewrite, ScoreTriple, scores API',
             '0/57', 'NOT COMPLETE - ALL tests fail'],
            ['T5', 'Command Center', '855-line screen, KPIs, feeds',
             '20/20', 'PARTIAL - thin test coverage'],
            ['T6', 'Company List', '630-line screen, sort/filter/tier',
             '24/24', 'PARTIAL - no worklog entry'],
            ['T7', 'Company Profile 5Q', '2450-line screen, all 5Q sections',
             '59/59', 'COMPLETE'],
            ['T8', 'Signal Intelligence', '853-line screen, evidence panel',
             '43/43', 'COMPLETE'],
            ['T9', 'Opportunity Radar', '713-line screen, accept/reject',
             '47/47', 'COMPLETE'],
            ['T10', 'Intelligence Inbox', '565-line screen, batch ops, 4-field search',
             '56/56', 'COMPLETE'],
            ['T11', 'Data Import', '1099-line screen, pipeline.ts, config rules',
             '57/57', 'PARTIAL - no worklog entry'],
        ],
        [avail*0.06, avail*0.14, avail*0.32, avail*0.10, avail*0.38],
        status_col=4
    ))

    # ── REALITY CHECK ──
    story.append(PageBreak())
    story.append(Paragraph('3. Reality Check Categories', H1_STYLE))
    story.append(hr())

    story.append(Paragraph('Category A: Actually Complete (3 tickets)', H2_STYLE))
    story.append(Paragraph(
        'These tickets have full implementation, passing tests, verified API integration, and no '
        'outstanding issues. They represent the strongest work in the codebase.',
        BODY))
    story.append(make_colored_table(
        ['Ticket', 'Evidence Summary'],
        [
            ['T7 - Company Profile 5Q', '2450 LOC, progressive disclosure layout, all 5Q sections lazy-load from Intelligence API, ScoreTriple wired, 59/59 tests pass'],
            ['T8 - Signal Intelligence', '853 LOC, evidence detail panel, capability match display, severity badges, meaning category filters, 43/43 tests pass'],
            ['T9 - Opportunity Radar', '713 LOC, accept/reject with feedback form, status/priority filters, mutation API calls, 47/47 tests pass'],
        ],
        [avail*0.25, avail*0.75], status_col=0
    ))

    story.append(Paragraph('Category B: Partially Complete (6 tickets)', H2_STYLE))
    story.append(Paragraph(
        'These tickets have substantial implementation but with verifiable gaps. Code exists and '
        'most tests pass, but there are structural issues, incomplete integration, or unaudited '
        'formal completion processes.',
        BODY))
    story.append(make_colored_table(
        ['Ticket', 'Gap Description'],
        [
            ['T1 - Foundation', '6 integration tests fail: non-existent company returns wrong response shape. Zod validation works but envelope format inconsistent'],
            ['T2 - Intel API', '23 tests fail: IntelligenceResponse envelope contract violations, freshness shape mismatch, selective loading incomplete'],
            ['T3 - AI Governance', 'All engines use enforceGovernance:false. tokensUsed/costUsd always 0 in audit records. System prompt uses wrong role'],
            ['T5 - Command Center', 'Only 20 tests (vs avg 60/ticket). Functionally works but significantly under-tested'],
            ['T10 - Intel Inbox', 'Fully functional but batch approve uses N sequential HTTP calls. convertApprovedItem hardcodes confidence:0.85'],
            ['T11 - Data Import', '57 tests pass, full pipeline exists. No worklog entry found - formal completion process not verified'],
        ],
        [avail*0.20, avail*0.80], status_col=0
    ))

    story.append(Paragraph('Category C: Not Actually Complete (2 tickets)', H2_STYLE))
    story.append(make_colored_table(
        ['Ticket', 'Critical Evidence'],
        [
            ['T4 - 3-Score Architecture', 'ALL 57 tests FAIL. parseRevenueBreakdown is not exported from engine.ts. Score functions reference undefined properties. Core computation is broken. Tests never fixed after rewrite.'],
            ['T6 - Company List', '24 tests pass, screen functional. No worklog entry exists. Cannot verify formal completion process was followed.'],
        ],
        [avail*0.20, avail*0.80], status_col=0
    ))

    # ── ARCHITECTURE REVIEW ──
    story.append(PageBreak())
    story.append(Paragraph('4. Architecture-Level Review', H1_STYLE))
    story.append(hr())

    story.append(Paragraph('4.1 Database Schema', H2_STYLE))
    story.append(Paragraph(
        'The Prisma schema defines 90 models across 10 domains, matching the claimed count in '
        'ARCHITECTURE.md. However, 20 enums exist (documentation says 18), and 6 enums plus 5 '
        'models are undocumented. The most critical schema issue is the complete absence of pgvector '
        'configuration despite the architecture document explicitly claiming it. Vectors are stored '
        'as JSON strings in plain String columns, with cosine similarity computed in JavaScript '
        '(O(n) brute-force). This means no native Postgres vector indexing, no IVFFlat/HNSW '
        'acceleration, and increasing memory pressure as data grows.',
        BODY))

    story.append(make_colored_table(
        ['Issue', 'Severity', 'Count', 'Impact'],
        [
            ['pgvector NOT configured (doc contradicts reality)', 'CRITICAL', '1', 'No vector indexing, brute-force similarity search'],
            ['Models with loose FK columns (no @relation)', 'CRITICAL', '8', 'No referential integrity, no cascade deletes'],
            ['Models missing updatedAt timestamp', 'HIGH', '40+', 'No audit trail for modifications'],
            ['FK relations missing onDelete', 'HIGH', '5', 'Deleting parents will fail (RESTRICT)'],
            ['db.ts select constants reference wrong fields', 'HIGH', '3', 'JOB_SELECT, AI_CALL_LOG_SELECT have wrong field names'],
            ['Ghost models referenced in test code', 'MEDIUM', '3', 'Tests reference non-existent schema models'],
            ['String fields that should be enums', 'MEDIUM', '35+', 'No type safety or DB constraints'],
        ],
        [avail*0.35, avail*0.12, avail*0.06, avail*0.47], status_col=1
    ))

    story.append(Paragraph('4.2 Security Architecture', H2_STYLE))
    story.append(Paragraph(
        'This is the single most critical area of concern. Of the 223 API routes in the codebase, '
        'only 10 perform any authentication check. Every other route, including all CRUD operations '
        'on companies, contacts, leads, drafts, knowledge, capabilities, sequences, and settings, is '
        'completely open to anonymous access. An unauthenticated user can delete all companies, '
        'export lead data, send emails, and modify system settings. Additionally, the /auth/me route '
        'falls back to a hardcoded admin user (shanker001@gmail.com) when the database session '
        'check fails, providing a silent authentication bypass. Two auth routes (reset-password and '
        'confirm) are fully non-functional mocks that return success without any logic.',
        BODY))

    story.append(make_colored_table(
        ['Issue', 'Severity', 'Detail'],
        [
            ['213/223 routes unprotected', 'CRITICAL', 'Only auth/* (10) check authentication. All CRUD routes open'],
            ['Hardcoded admin fallback', 'CRITICAL', '/auth/me returns shanker001@gmail.com when DB fails'],
            ['Mock auth routes', 'HIGH', 'reset-password and confirm return {success:true} with zero logic'],
            ['Dev-mode OTP leakage', 'HIGH', 'OTP codes exposed if NODE_ENV misconfigured'],
            ['Error message leaking', 'MEDIUM', '30+ routes expose raw error.message to clients'],
            ['Missing Zod validation', 'MEDIUM', '185/223 routes (83%) have no input validation'],
            ['Inconsistent envelope', 'MEDIUM', '60 routes (27%) return raw JSON without standard envelope'],
        ],
        [avail*0.25, avail*0.12, avail*0.63], status_col=1
    ))

    # ── ENGINE AUDIT ──
    story.append(PageBreak())
    story.append(Paragraph('5. AI Engine Architecture Review', H1_STYLE))
    story.append(hr())
    story.append(Paragraph(
        'All 7 composable AI engines are real implementations that call actual LLM providers or '
        'perform deterministic computation. No engines are pure mocks. However, several critical '
        'bugs exist that undermine the quality and reliability of AI outputs. The most systemic '
        'issue is that tokensUsed and costUsd are always recorded as 0 in AIGenerationAudit records '
        'across all 4 composite engines (Synthesis, Scoring, Action, Conversation), making AI cost '
        'tracking completely non-functional. Additionally, all composite engines use '
        'enforceGovernance:false, meaning the governance layer audits but never blocks generation.',
        BODY))

    story.append(make_colored_table(
        ['Engine', 'Status', 'Uses governedAI', 'Writes Audit', 'Critical Issues'],
        [
            ['ModelRouter', 'REAL', 'N/A (base)', 'logAIUsage only', 'tokensUsed/costUsd always 0'],
            ['GroundingEngine', 'REAL', 'N/A (no LLM)', 'N/A', 'Clean, no issues'],
            ['RetrievalEngine', 'REAL', 'N/A (no LLM)', 'N/A', 'TF-IDF fallback is hash-to-index, not real TF-IDF'],
            ['SynthesisEngine', 'REAL', 'Yes', 'Yes', 'tokensUsed=0, modelUsed=governed'],
            ['ScoringEngine', 'PARTIAL', 'Narrative only', 'Yes', 'Dead code: revenueLLMCall unused'],
            ['ActionEngine', 'PARTIAL', 'Narrative only', 'Yes', 'contactName always null'],
            ['ConversationEngine', 'PARTIAL', 'Narrative only', 'Yes', 'RetrievalEngine.search() never called'],
            ['Enterprise Reasoning', 'REAL', 'Yes', 'Via governedAI', 'Risk filter === false bug (operator precedence)'],
            ['Multi-Agent Orchestrator', 'REAL', 'Yes', 'Via governedAI', 'proposal agent is no-op, learning agent is fake'],
            ['LLM Client', 'REAL', 'N/A (base)', 'logAIUsage', 'System prompt role=assistant (should be system)'],
        ],
        [avail*0.14, avail*0.08, avail*0.12, avail*0.10, avail*0.56], status_col=1
    ))

    # ── SCREEN AUDIT ──
    story.append(Paragraph('6. Screen Component Audit', H1_STYLE))
    story.append(hr())
    story.append(Paragraph(
        'All 77 screen components (ARCHITECTURE.md claims 76; actual count is 77) were audited. '
        'The navigation system is fully wired: store.ts defines 77 ViewId values, screen-map.tsx '
        'lazy-loads all 77, and nav-config.ts provides sidebar entries for 17 primary screens '
        '(remaining 60 accessed via command palette or programmatic navigation). Zero orphaned or '
        'dangling references exist across the three-layer routing system.',
        BODY))

    story.append(make_colored_table(
        ['Classification', 'Count', 'Screens'],
        [
            ['FULL (real API, real state)', '71 (93%)', 'All screens have real API calls and state management'],
            ['SKELETON (some mock data)', '5 (7%)', 'Intelligence Knowledge, Intelligence Reasoning, Intelligence Associations, Import, Demo Experience'],
            ['PLACEHOLDER', '0', 'None found'],
            ['STUB', '0', 'None found'],
        ],
        [avail*0.25, avail*0.10, avail*0.65], status_col=0
    ))

    story.append(Paragraph(
        'Five screens use hardcoded mock data for at least one major feature. The most concerning '
        'is Intelligence Reasoning, which displays a hardcoded MOCK_STEPS array as the 30-step '
        'reasoning chain rather than fetching real reasoning data from the API. Intelligence '
        'Knowledge similarly uses MOCK_KNOWLEDGE for its primary content list. The Demo Experience '
        'screen is intentionally mock-only. These should be addressed before claiming full '
        'implementation completeness.',
        BODY))

    # ── TEST AUDIT ──
    story.append(PageBreak())
    story.append(Paragraph('7. Test and Validation Audit', H1_STYLE))
    story.append(hr())
    story.append(Paragraph(
        'The test suite comprises 53 test files with approximately 2,090 test definitions (including '
        'data-driven it.each generators). 1,704 tests pass, 73 fail, and 14 are skipped. Zero tests '
        'use it.skip, it.todo, or it.only, indicating no abandoned or pending test cases. 52 of 53 '
        'test files use mocked dependencies; only api-routes.test.ts requires a live database. While '
        'the unit test coverage is broad, integration testing is extremely thin, and there are zero '
        'end-to-end tests that exercise the full request-to-render pipeline.',
        BODY))

    story.append(make_colored_table(
        ['File', 'Failures', 'Root Cause'],
        [
            ['account-prioritization/engine.test.ts', '21', 'parseEmployeeRange, scoreStaticFit, computeAccountPriority not found'],
            ['account-prioritization/ticket4-score-unification.test.ts', '19', 'parseRevenueBreakdown is not a function'],
            ['ticket-deep-coverage.test.ts', '3', 'Include set size mismatch, freshness edge case'],
            ['ticket1-intelligence-integration.test.ts', '1', 'Non-existent company returns wrong shape'],
            ['ticket1-intelligence-validation.test.ts', '6', 'Schema validation edge cases'],
            ['ticket2-integration.test.ts', '23', 'Envelope contract violations, freshness shape'],
        ],
        [avail*0.38, avail*0.10, avail*0.52], status_col=1
    ))

    # ── REMAINING WORK ──
    story.append(Paragraph('8. Remaining Work Assessment', H1_STYLE))
    story.append(hr())

    story.append(Paragraph('Priority Fixes Before Ticket 12', H2_STYLE))
    story.append(make_colored_table(
        ['Priority', 'Issue', 'Effort', 'Risk If Skipped'],
        [
            ['P0', 'Fix T4 3-Score engine - all 57 tests fail', '1-2 days', 'All score-dependent features use broken computation'],
            ['P0', 'Fix reasoning engine risk filter bug', '5 minutes', 'All signals incorrectly flagged as risk signals'],
            ['P0', 'Implement route-level auth middleware', '2-3 days', 'Entire API open to anonymous access'],
            ['P0', 'Remove hardcoded admin fallback in /auth/me', '15 minutes', 'Authentication bypass vulnerability'],
            ['P1', 'Fix T1/T2 test failures (envelope consistency)', '1 day', '73 failing tests undermine confidence'],
            ['P1', 'Fix tokensUsed/costUsd tracking in governedAI', '0.5 day', 'AI cost tracking completely broken'],
            ['P1', 'Fix system prompt role in llm-client.ts', '15 minutes', 'Reduced LLM instruction quality'],
            ['P1', 'Fix 8 loose FK columns in Prisma schema', '1 day', 'Data integrity issues'],
            ['P2', 'Add Zod validation to remaining 185 routes', '3-5 days', 'Input validation gaps'],
            ['P2', 'Standardize envelope format across all routes', '1-2 days', 'Client-side parsing errors'],
            ['P2', 'Replace mock data in 5 skeleton screens', '1 day', 'Intel Reasoning shows fake 30-step chain'],
            ['P2', 'Implement real proposal/learning agents', '1 day', 'Orchestrator has 2 fake agents'],
        ],
        [avail*0.08, avail*0.35, avail*0.10, avail*0.47], status_col=0
    ))

    # ── CONFIDENCE ASSESSMENT ──
    story.append(Spacer(1, 5*mm))
    story.append(Paragraph('Overall Confidence Assessment', H2_STYLE))
    story.append(make_colored_table(
        ['Component', 'Confidence', 'Evidence Basis'],
        [
            ['Frontend (screens)', '85%', '71/77 fully implemented, zero placeholders, all wired to routing'],
            ['API Routes', '55%', '223 routes, 72% use real DB, but near-zero auth protection'],
            ['AI Engines', '60%', 'All real implementations, but governance soft, cost tracking broken, bugs'],
            ['Database', '50%', '90 models correct, but 8 loose FKs, pgvector not configured'],
            ['Security', '15%', 'Only 10/223 routes protected, hardcoded admin fallback, mock auth'],
            ['Testing', '70%', '1704 pass, but 73 fail, near-zero integration tests'],
            ['OVERALL', '62%', 'Strong frontend shell wrapping critical security and engine gaps'],
        ],
        [avail*0.18, avail*0.12, avail*0.70], status_col=1
    ))

    story.append(Spacer(1, 8*mm))
    story.append(Paragraph(
        '<b>Recommendation:</b> Do NOT proceed to Ticket 12 until at minimum: (1) Ticket 4 scoring '
        'engine is fixed and all 57 tests pass, (2) route-level auth middleware is implemented, '
        '(3) the hardcoded admin fallback is removed, and (4) the reasoning engine risk filter bug '
        'is patched. These are blocking issues that compound risk with every additional ticket '
        'built on top of the current foundation.',
        ParagraphStyle('Recommendation', parent=BODY, fontSize=10, leading=15,
            textColor=SEM_ERROR, fontName='DejaVuBold', borderWidth=1,
            borderColor=SEM_ERROR, borderPadding=8, backColor=colors.HexColor('#fdf2f0'))))

    # ── BUILD ──
    doc = SimpleDocTemplate(
        OUTPUT_PATH,
        pagesize=A4,
        leftMargin=2*cm, rightMargin=2*cm,
        topMargin=2*cm, bottomMargin=2*cm,
        title='DeepMindQ Production Readiness Audit',
        author='Z.ai Principal Engineer Assessment',
        subject='Independent codebase audit of Tickets 1-11'
    )
    doc.build(story)
    print(f'PDF generated: {OUTPUT_PATH}')
    print(f'Size: {os.path.getsize(OUTPUT_PATH)} bytes')

if __name__ == '__main__':
    build_report()
