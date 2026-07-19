#!/usr/bin/env python3
"""
Phase 3 Freeze Report — AI Intelligence Architecture
DeepMindQ CRM — Enterprise AI Governance & Intelligence Foundation
"""

import os
import platform
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import inch, mm
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY, TA_RIGHT
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    KeepTogether, HRFlowable, CondPageBreak,
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase.pdfmetrics import registerFontFamily

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Font Registration
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
_IS_MAC = platform.system() == 'Darwin'
FONT_DIR = os.path.expanduser('~/.openclaw/workspace/fonts') if _IS_MAC else '/usr/share/fonts'

pdfmetrics.registerFont(TTFont('FreeSerif', f'{FONT_DIR}/truetype/freefont/FreeSerif.ttf'))
pdfmetrics.registerFont(TTFont('FreeSerif-Bold', f'{FONT_DIR}/truetype/freefont/FreeSerifBold.ttf'))
pdfmetrics.registerFont(TTFont('FreeSerif-Italic', f'{FONT_DIR}/truetype/freefont/FreeSerifItalic.ttf'))
pdfmetrics.registerFont(TTFont('FreeSerif-BoldItalic', f'{FONT_DIR}/truetype/freefont/FreeSerifBoldItalic.ttf'))
pdfmetrics.registerFont(TTFont('DejaVuSans', f'{FONT_DIR}/truetype/dejavu/DejaVuSansMono.ttf'))

registerFontFamily('FreeSerif', normal='FreeSerif', bold='FreeSerif-Bold',
                   italic='FreeSerif-Italic', boldItalic='FreeSerif-BoldItalic')
registerFontFamily('DejaVuSans', normal='DejaVuSans', bold='DejaVuSans')

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Cascade Palette (derived from #1e3a5f base hue)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
HEADER_FILL   = colors.HexColor('#1e3a5f')   # M tier: user-specified dark blue
HEADER_FILL_L = colors.HexColor('#2a5082')   # lighter variant for sub-headers
TABLE_STRIPE  = colors.HexColor('#eef2f7')   # L tier: very subtle blue-gray
BORDER        = colors.HexColor('#b0bec5')   # S tier
ACCENT        = colors.HexColor('#227eac')   # XS tier
TEXT_PRIMARY   = colors.HexColor('#1a1a2e')
TEXT_MUTED     = colors.HexColor('#6b7280')

TABLE_HEADER_COLOR = HEADER_FILL
TABLE_HEADER_TEXT  = colors.white
TABLE_ROW_EVEN     = colors.white
TABLE_ROW_ODD      = TABLE_STRIPE

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Style Definitions
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
page_w, page_h = A4
LEFT_M = 0.85 * inch
RIGHT_M = 0.85 * inch
TOP_M = 0.85 * inch
BOT_M = 0.75 * inch
AVAIL_W = page_w - LEFT_M - RIGHT_M

TITLE_STYLE = ParagraphStyle(
    name='DocTitle', fontName='FreeSerif-Bold', fontSize=20, leading=28,
    textColor=HEADER_FILL, alignment=TA_CENTER, spaceAfter=4,
)
SUBTITLE_STYLE = ParagraphStyle(
    name='DocSubtitle', fontName='FreeSerif', fontSize=12, leading=16,
    textColor=TEXT_MUTED, alignment=TA_CENTER, spaceAfter=4,
)
DATE_STYLE = ParagraphStyle(
    name='DocDate', fontName='FreeSerif-Italic', fontSize=10, leading=14,
    textColor=TEXT_MUTED, alignment=TA_CENTER, spaceAfter=6,
)
H1_STYLE = ParagraphStyle(
    name='H1', fontName='FreeSerif-Bold', fontSize=16, leading=22,
    textColor=HEADER_FILL, spaceBefore=18, spaceAfter=10,
    borderWidth=0, borderPadding=0,
)
H2_STYLE = ParagraphStyle(
    name='H2', fontName='FreeSerif-Bold', fontSize=13, leading=18,
    textColor=HEADER_FILL_L, spaceBefore=12, spaceAfter=6,
)
BODY_STYLE = ParagraphStyle(
    name='Body', fontName='FreeSerif', fontSize=10.5, leading=17,
    textColor=TEXT_PRIMARY, alignment=TA_JUSTIFY, spaceAfter=6,
)
BODY_LEFT = ParagraphStyle(
    name='BodyLeft', fontName='FreeSerif', fontSize=10.5, leading=17,
    textColor=TEXT_PRIMARY, alignment=TA_LEFT, spaceAfter=6,
)
BULLET_STYLE = ParagraphStyle(
    name='Bullet', fontName='FreeSerif', fontSize=10.5, leading=17,
    textColor=TEXT_PRIMARY, alignment=TA_LEFT, spaceAfter=3,
    leftIndent=18, bulletIndent=6,
)
CODE_STYLE = ParagraphStyle(
    name='Code', fontName='DejaVuSans', fontSize=9, leading=14,
    textColor=colors.HexColor('#374151'), alignment=TA_LEFT,
    leftIndent=12, spaceAfter=4,
    backColor=colors.HexColor('#f3f4f6'),
    borderPadding=(4, 6, 4, 6),
)
TABLE_HEADER_S = ParagraphStyle(
    name='TH', fontName='FreeSerif-Bold', fontSize=9.5, leading=13,
    textColor=TABLE_HEADER_TEXT, alignment=TA_CENTER,
)
TABLE_CELL_S = ParagraphStyle(
    name='TC', fontName='FreeSerif', fontSize=9, leading=13,
    textColor=TEXT_PRIMARY, alignment=TA_LEFT,
)
TABLE_CELL_C = ParagraphStyle(
    name='TCC', fontName='FreeSerif', fontSize=9, leading=13,
    textColor=TEXT_PRIMARY, alignment=TA_CENTER,
)

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Helper Functions
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
def h1(text):
    return Paragraph(f'<b>{text}</b>', H1_STYLE)

def h2(text):
    return Paragraph(f'<b>{text}</b>', H2_STYLE)

def body(text):
    return Paragraph(text, BODY_STYLE)

def body_l(text):
    return Paragraph(text, BODY_LEFT)

def bullet(text):
    return Paragraph(f'<bullet>&bull;</bullet> {text}', BULLET_STYLE)

def code(text):
    return Paragraph(text, CODE_STYLE)

def spacer(h=12):
    return Spacer(1, h)

def hr():
    return HRFlowable(width="100%", thickness=0.5, color=BORDER, spaceAfter=8, spaceBefore=8)

def make_table(headers, rows, col_ratios=None):
    """Build a styled table with alternating rows."""
    header_row = [Paragraph(f'<b>{h}</b>', TABLE_HEADER_S) for h in headers]
    data = [header_row]
    for row in rows:
        data.append([Paragraph(str(c), TABLE_CELL_S) for c in row])

    if col_ratios is None:
        n = len(headers)
        col_ratios = [1.0 / n] * n
    col_widths = [r * AVAIL_W for r in col_ratios]

    tbl = Table(data, colWidths=col_widths, hAlign='CENTER')
    style_cmds = [
        ('BACKGROUND', (0, 0), (-1, 0), TABLE_HEADER_COLOR),
        ('TEXTCOLOR', (0, 0), (-1, 0), TABLE_HEADER_TEXT),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('GRID', (0, 0), (-1, -1), 0.5, BORDER),
    ]
    for i in range(1, len(data)):
        bg = TABLE_ROW_ODD if i % 2 == 0 else TABLE_ROW_EVEN
        style_cmds.append(('BACKGROUND', (0, i), (-1, i), bg))
    tbl.setStyle(TableStyle(style_cmds))
    return tbl


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Page Template — dark blue header bar + page number footer
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
def on_page(canvas, doc):
    canvas.saveState()
    # Header bar
    canvas.setFillColor(HEADER_FILL)
    canvas.rect(0, page_h - 32, page_w, 32, fill=1, stroke=0)
    canvas.setFillColor(colors.white)
    canvas.setFont('FreeSerif-Bold', 8)
    canvas.drawString(LEFT_M, page_h - 22,
                      'Phase 3 Freeze Report  |  DeepMindQ CRM  |  AI Intelligence Architecture')
    canvas.drawRightString(page_w - RIGHT_M, page_h - 22, 'CONFIDENTIAL')
    # Footer — page number
    canvas.setFont('FreeSerif', 8)
    canvas.setFillColor(TEXT_MUTED)
    canvas.drawCentredString(page_w / 2, 20, f'Page {doc.page}')
    canvas.drawString(LEFT_M, 20, 'July 19, 2026')
    canvas.drawRightString(page_w - RIGHT_M, 20, 'DeepMindQ CRM')
    canvas.restoreState()


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Build Document
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OUTPUT = '/home/z/my-project/download/Phase3-Freeze-Report.pdf'
doc = SimpleDocTemplate(
    OUTPUT, pagesize=A4,
    leftMargin=LEFT_M, rightMargin=RIGHT_M,
    topMargin=TOP_M, bottomMargin=BOT_M,
    title='Phase 3 Freeze Report - AI Intelligence Architecture',
    author='DeepMindQ',
)

story = []

# ── Title Block ──
story.append(Spacer(1, 6))
story.append(Paragraph('<b>Phase 3 Freeze Report</b>', TITLE_STYLE))
story.append(Paragraph('AI Intelligence Architecture', SUBTITLE_STYLE))
story.append(Paragraph('DeepMindQ CRM -- Enterprise AI Governance &amp; Intelligence Foundation', SUBTITLE_STYLE))
story.append(Paragraph('July 19, 2026', DATE_STYLE))
story.append(hr())
story.append(spacer(6))

# ═══════════════════════════════════════════════════════════════
# SECTION 1: Final Architecture Diagram
# ═══════════════════════════════════════════════════════════════
story.append(h1('1. Final Architecture Diagram'))
story.append(body(
    'The DeepMindQ CRM Phase 3 architecture is a layered system with clear separation between '
    'the user-facing frontend, API routing layer, AI governance middleware, LLM primitives, '
    'research intelligence engine, and persistent storage. Each layer communicates through '
    'well-defined contracts, and all AI calls are forced through the governance gate.'
))
story.append(spacer(6))
story.append(h2('Layer Stack'))
story.append(bullet('<b>Frontend:</b> Next.js + Tailwind CSS + shadcn/ui component library. '
                     'Server-side rendering with React Server Components for data-heavy views.'))
story.append(bullet('<b>API Layer:</b> Next.js Route Handlers under <font name="DejaVuSans">src/app/api/</font>, '
                     'grouped by domain: <font name="DejaVuSans">g-ai</font>, <font name="DejaVuSans">g-crm</font>, '
                     '<font name="DejaVuSans">g-data</font>, <font name="DejaVuSans">g-strategy</font>, '
                     '<font name="DejaVuSans">g-outreach</font>, <font name="DejaVuSans">g-system</font>.'))
story.append(bullet('<b>AI Governance Layer:</b> <font name="DejaVuSans">ai-governance.ts</font> '
                     'exports <font name="DejaVuSans">governedAICall()</font> (company-scoped, 6 checks) and '
                     '<font name="DejaVuSans">governedAICallAggregate()</font> (non-company, hallucination prevention).'))
story.append(bullet('<b>LLM Primitives:</b> <font name="DejaVuSans">zai-helpers.ts</font> provides '
                     '<font name="DejaVuSans">callLLM()</font> and <font name="DejaVuSans">webSearch()</font>. '
                     'Direct import by API routes is forbidden; all calls go through governance.'))
story.append(bullet('<b>Research Engine:</b> 6-step pipeline -- search, evidence storage, LLM extraction '
                     'with governance, field validation, per-field confidence scoring, intelligence storage.'))
story.append(bullet('<b>Intelligence Contract:</b> <font name="DejaVuSans">intelligence-contract.ts</font> '
                     'implements freshness calculation (4 domain half-lives), confidence aggregation, '
                     'and context building for AI prompts.'))
story.append(bullet('<b>Database:</b> PostgreSQL (Neon) via Prisma ORM. Schema includes company, contact, '
                     'signal, evidence, capability, and audit tables.'))
story.append(spacer(6))

arch_headers = ['Layer', 'Module', 'Responsibility']
arch_rows = [
    ['Frontend', 'Next.js + Tailwind + shadcn/ui', 'User interface, server components'],
    ['API', 'src/app/api/g-*', 'Domain-grouped route handlers'],
    ['Governance', 'ai-governance.ts', 'governedAICall / governedAICallAggregate'],
    ['LLM', 'zai-helpers.ts', 'callLLM, webSearch primitives'],
    ['Research', 'research-engine/', '6-step intelligence pipeline'],
    ['Intelligence', 'intelligence-contract.ts', 'Freshness, confidence, context'],
    ['Database', 'PostgreSQL + Prisma', 'Persistent storage, ORM'],
]
story.append(spacer(6))
story.append(make_table(arch_headers, arch_rows, [0.15, 0.35, 0.50]))
story.append(spacer(18))

# ═══════════════════════════════════════════════════════════════
# SECTION 2: Complete Data Flow
# ═══════════════════════════════════════════════════════════════
story.append(h1('2. Complete Data Flow'))
story.append(body(
    'The intelligence chain describes the end-to-end journey from company creation through '
    'AI-generated deliverables. Every step is tracked, governed, and auditable.'
))
story.append(spacer(6))

flow_items = [
    ('<b>Step 1 -- Company Created via CRM:</b> User adds a company through the CRM interface. '
     'A database record is created and the company becomes eligible for research.'),
    ('<b>Step 2 -- Research Triggered (6-Step Pipeline):</b> Four parallel Tavily web searches '
     'execute (general news, funding, hiring, tech changes). Results flow through: '
     'evidence storage, LLM extraction with governance, field validation, per-field confidence '
     'scoring, and final intelligence storage.'),
    ('<b>Step 3 -- Evidence Collected:</b> Per-field evidence records are created, each tracking '
     'source URL, content snippet, and extraction timestamp. Multiple sources per field enable '
     'corroboration scoring.'),
    ('<b>Step 4 -- Confidence Scored Per Field:</b> Each intelligence field receives a confidence '
     'score (0.0 to 1.0) based on three factors: source quality, recency, and corroboration '
     'across multiple sources.'),
    ('<b>Step 5 -- Freshness Calculated (4 Domains):</b> Exponential decay model with domain-specific '
     'half-lives: profile (90 days), signals (14 days), contacts (45 days), technology (60 days). '
     'Each domain is independently scored and averaged.'),
    ('<b>Step 6 -- Signals Detected:</b> <font name="DejaVuSans">governedAICallAggregate()</font> '
     'analyzes evidence for 10 signal types (funding rounds, hiring sprees, product launches, etc.). '
     'Structured extraction produces typed, scored signals.'),
    ('<b>Step 7 -- RFP/RFI Fields Populated:</b> When signals indicate procurement activity, '
     'structured fields are populated: opportunityType, deadline, buyingArea, techRequirement, '
     'serviceRequirement, matchingCapability.'),
    ('<b>Step 8 -- Capability Matching:</b> SignalCapabilityMatch table links signals to capabilities '
     'using weighted scoring: category (30%), keyword (30%), business problem (20%), impact (5%), '
     'remaining 15% from reasoning quality.'),
    ('<b>Step 9 -- AI Outputs Generated:</b> Through governance gates, the system produces '
     'account briefs, email drafts, and conversation plans. Each generation creates an '
     'AIGenerationAudit record.'),
    ('<b>Step 10 -- Audit Trail:</b> Every AI generation creates an AIGenerationAudit record with '
     '15 fields including timestamps, governance results, model used, confidence/freshness at '
     'time of generation, and the full prompt sent.'),
]
for item in flow_items:
    story.append(bullet(item))
story.append(spacer(18))

# ═══════════════════════════════════════════════════════════════
# SECTION 3: AI Governance Architecture
# ═══════════════════════════════════════════════════════════════
story.append(h1('3. AI Governance Architecture'))
story.append(body(
    'AI governance is the central safety mechanism. Two gate functions enforce quality thresholds '
    'before any LLM call is permitted. This prevents hallucination, stale data usage, and '
    'low-confidence outputs from reaching users.'
))
story.append(spacer(6))

story.append(h2('3.1 Gate Functions'))
story.append(bullet('<b>governedAICall():</b> Company-specific gate. Requires a companyId and performs '
                     '6 governance checks before allowing the LLM call. Used for all company-scoped '
                     'AI generation (briefs, emails, plans, insights).'))
story.append(bullet('<b>governedAICallAggregate():</b> Non-company gate. Focuses on hallucination '
                     'prevention. Used for cross-company analysis, command-center queries, data health, '
                     'and research extraction where no single company context applies.'))
story.append(spacer(6))

story.append(h2('3.2 Six Governance Checks'))
checks_headers = ['Check', 'Description', 'Failure Action']
checks_rows = [
    ['research_exists', 'Company has completed research cycle', 'Block: require research'],
    ['research_confidence', 'Overall confidence meets type threshold', 'Block: insufficient data'],
    ['freshness_score', 'Composite freshness meets type threshold', 'Block: data too stale'],
    ['staleness', 'No single domain exceeds max staleness days', 'Warn: partial degradation'],
    ['capability_match', 'Capability score available for RFP types', 'Warn: no match data'],
    ['recent_intelligence', 'Intelligence updated within acceptable window', 'Block: trigger re-research'],
]
story.append(make_table(checks_headers, checks_rows, [0.22, 0.48, 0.30]))
story.append(spacer(10))

story.append(h2('3.3 Per-Type Thresholds'))
thresh_headers = ['Generation Type', 'Min Confidence', 'Min Freshness', 'Max Staleness (days)']
thresh_rows = [
    ['email_draft', '0.60', '25', '60'],
    ['account_brief', '0.50', '20', '90'],
    ['conversation_plan', '0.55', '20', '60'],
    ['signals', '0.40', '15', '30'],
    ['insights', '0.45', '20', '60'],
    ['recommendations', '0.50', '20', '60'],
    ['summarize', '0.30', '10', '120'],
    ['enrich', '0.35', '15', '90'],
]
story.append(make_table(thresh_headers, thresh_rows, [0.30, 0.22, 0.22, 0.26]))
story.append(spacer(10))

story.append(h2('3.4 Hallucination Prevention'))
story.append(body(
    '15 hallucination prevention rules are injected into every LLM prompt. These rules enforce:'
))
story.append(bullet('Never fabricate data not present in the provided context'))
story.append(bullet('Explicitly state "unknown" when information is missing'))
story.append(bullet('Distinguish between confirmed facts and inferences'))
story.append(bullet('Cite source URLs when available'))
story.append(bullet('Flag low-confidence claims with uncertainty markers'))
story.append(bullet('Never extrapolate financial figures or headcount estimates'))
story.append(bullet('Never invent product names, feature lists, or partnership details'))
story.append(bullet('Always ground analysis in provided evidence only'))
story.append(spacer(4))
story.append(body(
    '<b>Staleness-based confidence modifier:</b> For each stale domain, confidence is reduced '
    'by 5% to 15% depending on how far past the half-life the data has aged. This modifier is '
    'applied at generation time, after the base confidence check passes.'
))
story.append(spacer(4))
story.append(body(
    '<b>Build-time guard:</b> <font name="DejaVuSans">scripts/check-governance.sh</font> runs '
    '5 automated checks to ensure no API route imports <font name="DejaVuSans">callLLM</font> '
    'directly from <font name="DejaVuSans">zai-helpers.ts</font>. This is integrated into '
    '<font name="DejaVuSans">npm run lint</font> as a pre-commit hook.'
))
story.append(spacer(18))

# ═══════════════════════════════════════════════════════════════
# SECTION 4: All AI Entry Points
# ═══════════════════════════════════════════════════════════════
story.append(h1('4. All AI Entry Points'))
story.append(body(
    'The following table catalogs every AI generation site in the codebase. All 40 sites use '
    'one of the two governance gate functions -- there are zero direct <font name="DejaVuSans">'
    'callLLM()</font> calls from API routes.'
))
story.append(spacer(6))

story.append(h2('4.1 governedAICall Sites (23)'))
gac_headers = ['#', 'Site', 'Context']
gac_rows = [
    ['1', 'signals', 'Signal detection for a company'],
    ['2', 'opportunities', 'Opportunity analysis per company'],
    ['3', 'insights', 'Company insight generation'],
    ['4', 'suggested_contacts', 'Contact recommendation'],
    ['5', 'recommendations', 'Strategic recommendations'],
    ['6', 'conversation_plan', 'Meeting conversation plan'],
    ['7', 'enrich', 'Company data enrichment'],
    ['8', 'generate-pdf (call 1)', 'PDF executive summary'],
    ['9', 'generate-pdf (call 2)', 'PDF detailed analysis'],
    ['10', 'generate-pdf (call 3)', 'PDF recommendations'],
    ['11', 'account-brief', 'Account brief generation'],
    ['12', 'summarize (company)', 'Company summary'],
    ['13', 'summarize (contact)', 'Contact summary'],
    ['14', 'generate-ppt', 'Presentation generation'],
    ['15', 'command-center query', 'Command center AI query'],
    ['16', 'email draft', 'Outreach email drafting'],
    ['17', 'ab-test', 'A/B test variant generation'],
    ['18', 'strategy', 'Strategic analysis'],
    ['19-23', 'workflow email gen (x5)', 'Workflow-triggered email generation'],
]
story.append(make_table(gac_headers, gac_rows, [0.08, 0.32, 0.60]))
story.append(spacer(10))

story.append(h2('4.2 governedAICallAggregate Sites (17)'))
gaa_headers = ['#', 'Site', 'Context']
gaa_rows = [
    ['1', 'query_parsing', 'Natural language query parsing'],
    ['2', 'knowledge_enrichment', 'Cross-company knowledge enrichment'],
    ['3', 'research_agent_person', 'Person research agent'],
    ['4', 'relationship_memory (1/5)', 'Relationship context building'],
    ['5', 'relationship_memory (2/5)', 'Relationship strength analysis'],
    ['6', 'relationship_memory (3/5)', 'Interaction history synthesis'],
    ['7', 'relationship_memory (4/5)', 'Stakeholder mapping'],
    ['8', 'relationship_memory (5/5)', 'Relationship recommendation'],
    ['9', 'command-center query', 'Aggregate dashboard query'],
    ['10', 'data_health_analysis (1/3)', 'Data completeness check'],
    ['11', 'data_health_analysis (2/3)', 'Data quality scoring'],
    ['12', 'data_health_analysis (3/3)', 'Data freshness assessment'],
    ['13', 'playbook_generation', 'Sales playbook creation'],
    ['14', 'research_extraction (1/2)', 'Research field extraction'],
    ['15', 'research_extraction (2/2)', 'Research validation pass'],
    ['16', 'signal_detection', 'Cross-company signal scan'],
    ['17', 'generate-email (aggregate)', 'Template-based email generation'],
]
story.append(make_table(gaa_headers, gaa_rows, [0.08, 0.32, 0.60]))
story.append(spacer(18))

# ═══════════════════════════════════════════════════════════════
# SECTION 5: Database Schema Changes
# ═══════════════════════════════════════════════════════════════
story.append(h1('5. Database Schema Changes'))
story.append(body(
    'Phase 3 introduces significant schema additions to support AI governance, evidence tracking, '
    'RFP/RFI intelligence, and capability matching.'
))
story.append(spacer(6))

story.append(h2('5.1 CompanySignal -- 7 New RFP/RFI Fields'))
rfp_headers = ['Field', 'Type', 'Purpose']
rfp_rows = [
    ['opportunityType', 'String?', 'RFP, RFI, RFT, or contract type'],
    ['publicationDate', 'DateTime?', 'When the opportunity was published'],
    ['deadline', 'DateTime?', 'Submission deadline'],
    ['buyingArea', 'String?', 'Procurement category / buying organization'],
    ['techRequirement', 'String?', 'Required technology capabilities'],
    ['serviceRequirement', 'String?', 'Required service deliverables'],
    ['matchingCapability', 'String?', 'Best-matched internal capability'],
]
story.append(make_table(rfp_headers, rfp_rows, [0.22, 0.18, 0.60]))
story.append(spacer(10))

story.append(h2('5.2 AIGenerationAudit -- New Table (15 fields, 7 indexes)'))
story.append(body(
    'Tracks every AI generation for compliance, debugging, and quality analysis. '
    'Key fields include: id, companyId, generationType, inputContext (JSON), '
    'outputResult (JSON), promptSent (JSON), modelUsed, confidenceScore, freshnessScore, '
    'governanceResult (JSON), createdAt, processingTimeMs, userId, metadata (JSON). '
    'Seven indexes cover companyId, generationType, createdAt, and composite lookups.'
))
story.append(spacer(10))

story.append(h2('5.3 Evidence -- New Table (7 indexes)'))
story.append(body(
    'Per-field evidence tracking. Each record links a piece of evidence to a specific '
    'intelligence field on a company. Fields: id, companyId, fieldName, sourceUrl, '
    'content, extractedValue, confidence, extractedAt, researchBatchId. Seven indexes '
    'enable fast lookup by company, field, batch, and source.'
))
story.append(spacer(10))

story.append(h2('5.4 SignalCapabilityMatch -- New Table (6 indexes)'))
story.append(body(
    'Links detected signals to internal capabilities with reasoning. Fields: id, '
    'signalId, capabilityId, categoryScore, keywordScore, businessProblemScore, '
    'impactScore, totalScore, reasoning, createdAt. Six indexes cover signal, capability, '
    'and score-based queries.'
))
story.append(spacer(10))

story.append(h2('5.5 CompanyResearchCard -- 5 New Intelligence Fields'))
intel_headers = ['Field', 'Type', 'Purpose']
intel_rows = [
    ['strategicPriorities', 'Json?', 'Extracted strategic priorities list'],
    ['businessProblems', 'Json?', 'Identified business challenges'],
    ['transformationAreas', 'Json?', 'Digital transformation focus areas'],
    ['technologyThemes', 'Json?', 'Technology stack and themes'],
    ['structuredTechLandscape', 'Json?', 'Structured technology landscape map'],
]
story.append(make_table(intel_headers, intel_rows, [0.25, 0.12, 0.63]))
story.append(spacer(6))
story.append(body(
    '<b>4 Freshness Timestamp Fields:</b> '
    'profileLastResearched, signalsLastResearched, contactsLastResearched, '
    'technologyLastResearched -- each tracking when that intelligence domain was last updated.'
))
story.append(spacer(18))

# ═══════════════════════════════════════════════════════════════
# SECTION 6: API Contracts
# ═══════════════════════════════════════════════════════════════
story.append(h1('6. API Contracts'))
story.append(body(
    'Key API endpoints follow a consistent pattern: POST with JSON body, governed AI call '
    'in the handler, and structured JSON response. All AI endpoints return governance metadata '
    'alongside the generated content.'
))
story.append(spacer(6))

api_headers = ['Endpoint', 'Method', 'Gate Function', 'Notes']
api_rows = [
    ['/api/g-ai/ai__chat', 'POST', 'governedAICallAggregate', 'General AI chat, non-company-scoped'],
    ['/api/g-ai/ai__account-brief', 'POST', 'governedAICall', 'Requires companyId, confidence >= 0.50'],
    ['/api/g-ai/ai__conversation-plan', 'POST', 'governedAICall', 'Requires companyId, confidence >= 0.55'],
    ['/api/g-crm/contacts/:id/generate-email', 'POST', 'governedAICall', 'Generates draft, requires approval'],
    ['/api/g-outreach/drafts', 'POST', 'governedAICall', 'Human approval required before sending'],
]
story.append(make_table(api_headers, api_rows, [0.30, 0.10, 0.25, 0.35]))
story.append(spacer(6))
story.append(body(
    '<b>Human-in-the-loop enforcement:</b> Email drafts created via the outreach API are '
    'stored with status "draft" and cannot be sent without explicit user approval. The '
    'sequence processing system auto-approves drafts only when a cron job is configured '
    '(not active in current deployment).'
))
story.append(spacer(18))

# ═══════════════════════════════════════════════════════════════
# SECTION 7: Module Dependency Map
# ═══════════════════════════════════════════════════════════════
story.append(h1('7. Module Dependency Map'))
story.append(body(
    'The dependency map enforces the architectural rule that API routes may only call '
    '<font name="DejaVuSans">ai-governance.ts</font>, never <font name="DejaVuSans">'
    'zai-helpers.ts</font> directly. This ensures every LLM call passes through governance.'
))
story.append(spacer(6))

dep_headers = ['Module', 'Depends On', 'Allowed Import']
dep_rows = [
    ['ai-governance.ts', 'zai-helpers.ts', 'callLLM only'],
    ['research-engine/researcher.ts', 'ai-governance.ts, evidence.ts, signals.ts', 'Full governance gate'],
    ['research-engine/signals.ts', 'ai-governance.ts', 'governedAICallAggregate'],
    ['research-engine/evidence.ts', 'zai-helpers.ts', 'Types only (no LLM calls)'],
    ['intelligence-contract.ts', 'Prisma client', 'Database read/write'],
    ['email-generation.ts', 'ai-governance.ts, intelligence-contract.ts', 'Governed + context'],
    ['All API routes (g-ai/*)', 'ai-governance.ts', 'NEVER zai-helpers.ts for LLM'],
]
story.append(make_table(dep_headers, dep_rows, [0.30, 0.40, 0.30]))
story.append(spacer(6))
story.append(body(
    '<b>Build-time enforcement:</b> <font name="DejaVuSans">scripts/check-governance.sh</font> '
    'scans all API route files for direct imports of <font name="DejaVuSans">callLLM</font> from '
    '<font name="DejaVuSans">zai-helpers.ts</font>. Any violation causes the lint step to fail, '
    'blocking the CI/CD pipeline.'
))
story.append(spacer(18))

# ═══════════════════════════════════════════════════════════════
# SECTION 8: Capability Intelligence Model
# ═══════════════════════════════════════════════════════════════
story.append(h1('8. Capability Intelligence Model'))
story.append(spacer(6))

story.append(h2('8.1 SignalCapabilityMatch Scoring'))
cap_headers = ['Factor', 'Weight', 'Method']
cap_rows = [
    ['Category Match', '30%', 'Signal type mapped to capability category taxonomy'],
    ['Keyword Match', '30%', 'Signal text tokens matched against capability keywords'],
    ['Business Problem', '20%', 'Signal pain points aligned to capability problem space'],
    ['Impact Score', '5%', 'Estimated business impact of the match'],
    ['Reasoning Quality', '15%', 'LLM reasoning coherence and evidence citation'],
]
story.append(make_table(cap_headers, cap_rows, [0.25, 0.15, 0.60]))
story.append(spacer(10))

story.append(h2('8.2 Signal Type Mappings'))
sig_headers = ['Signal Type', 'Detection Trigger', 'Typical Capability Match']
sig_rows = [
    ['funding_round', 'Investment announcement', 'Growth advisory, scaling services'],
    ['hiring_spree', 'Rapid headcount growth', 'HR tech, onboarding solutions'],
    ['product_launch', 'New product announcement', 'Marketing, distribution, support'],
    ['leadership_change', 'C-suite appointment', 'Strategy consulting, integration'],
    ['partnership', 'Partnership or alliance', 'Integration, co-development'],
    ['acquisition', 'Acquisition activity', 'M&A advisory, integration services'],
    ['expansion', 'Geographic or market expansion', 'Localization, market entry'],
    ['tech_migration', 'Technology stack change', 'Migration services, new platform'],
    ['regulatory', 'Regulatory or compliance event', 'Compliance consulting, audit'],
    ['contract_award', 'Government or large contract', 'Delivery, staffing, fulfillment'],
]
story.append(make_table(sig_headers, sig_rows, [0.20, 0.35, 0.45]))
story.append(spacer(10))

story.append(h2('8.3 Composite Intelligence Score'))
story.append(body(
    'The composite intelligence score aggregates multiple dimensions into a single '
    '0-100 score used for company prioritization and tier assignment:'
))
comp_headers = ['Dimension', 'Weight', 'Source']
comp_rows = [
    ['Data Completeness', '25%', 'CompanyResearchCard field population ratio'],
    ['Evidence Quality', '20%', 'Average evidence confidence across all fields'],
    ['Freshness', '15%', 'Composite freshness from 4 domain half-lives'],
    ['Signal Activity', '20%', 'Recent signal count weighted by recency'],
    ['Contact Coverage', '10%', 'Number and quality of tracked contacts'],
    ['Engagement History', '10%', 'Email opens, meetings, interactions'],
]
story.append(make_table(comp_headers, comp_rows, [0.25, 0.12, 0.63]))
story.append(spacer(6))

story.append(h2('8.4 Tier Thresholds'))
tier_headers = ['Tier', 'Score Range', 'Action']
tier_rows = [
    ['Hot', '>= 70', 'Prioritize outreach, fast-track engagement'],
    ['Warm', '>= 40', 'Nurture with targeted content and monitoring'],
    ['Cold', '>= 15', 'Maintain passive monitoring, periodic re-research'],
    ['Dormant', '< 15', 'Archive or deprioritize; re-evaluate quarterly'],
]
story.append(make_table(tier_headers, tier_rows, [0.15, 0.20, 0.65]))
story.append(spacer(18))

# ═══════════════════════════════════════════════════════════════
# SECTION 9: Known Technical Debt
# ═══════════════════════════════════════════════════════════════
story.append(h1('9. Known Technical Debt'))
story.append(body(
    'The following items are documented technical debt from Phase 3. Each has been evaluated '
    'and a deliberate decision made to defer resolution.'
))
story.append(spacer(6))

story.append(h2('9.1 Sequence Processing Auto-Approval'))
story.append(body(
    '<font name="DejaVuSans">sequences__process.ts</font> auto-approves generated email drafts. '
    'No cron job is currently configured, so this code path is dormant. The design intentionally '
    'allows future automation when the team is ready to enable autonomous sending. '
    '<b>Risk:</b> If a cron is accidentally enabled without additional safeguards, drafts could '
    'be sent without human review.'
))
story.append(spacer(6))

story.append(h2('9.2 modelUsed Field Default'))
story.append(body(
    'The <font name="DejaVuSans">modelUsed</font> field in AIGenerationAudit defaults to '
    '"governance-tracked" rather than recording the actual LLM model name (e.g., "gpt-4o", '
    '"claude-3.5-sonnet"). <b>Impact:</b> Audit records cannot be used to compare model '
    'performance. <b>Resolution:</b> Pass model name through the governance gate in Phase 4.'
))
story.append(spacer(6))

story.append(h2('9.3 SignalCapabilityMatch Name Join Missing'))
story.append(body(
    '<font name="DejaVuSans">getSignalCapabilityMatches()</font> does not join signal names or '
    'capability names, returning empty strings for display fields. <b>Impact:</b> Frontend must '
    'perform additional lookups or display IDs. <b>Resolution:</b> Add Prisma include clauses '
    'for Signal and CapabilityAsset relations.'
))
story.append(spacer(6))

story.append(h2('9.4 callLLM Export from zai-helpers.ts'))
story.append(body(
    '<font name="DejaVuSans">callLLM</font> remains exported from <font name="DejaVuSans">'
    'zai-helpers.ts</font> because <font name="DejaVuSans">ai-governance.ts</font> needs to '
    'call it internally. The build-time governance check ensures no API route imports it '
    'directly. <b>Risk:</b> Low -- the guard script catches violations at build time.'
))
story.append(spacer(18))

# ═══════════════════════════════════════════════════════════════
# SECTION 10: Phase 4/5/6 Dependency Rules
# ═══════════════════════════════════════════════════════════════
story.append(h1('10. Phase 4/5/6 Dependency Rules'))
story.append(body(
    'Phase 3 establishes the foundation that all future phases depend on. The following '
    'rules ensure backward compatibility and architectural integrity.'
))
story.append(spacer(6))

story.append(h2('10.1 Phase 4 -- Opportunity Intelligence'))
story.append(body(
    'The RFP/RFI fields on CompanySignal (opportunityType, deadline, buyingArea, techRequirement, '
    'serviceRequirement, matchingCapability) are the foundation for the opportunity pipeline. '
    'Phase 4 builds an opportunity engine that reads signals where <font name="DejaVuSans">'
    'opportunityType IS NOT NULL</font> and creates structured opportunity records. '
    '<b>Rule:</b> Do not modify the signal detection prompt format -- Phase 4 queries depend '
    'on the current structured output schema.'
))
story.append(spacer(6))

story.append(h2('10.2 Phase 5 -- Predictive Scoring'))
story.append(body(
    'Uses the composite intelligence score from <font name="DejaVuSans">intelligence-contract.ts'
    '</font> as the base signal. Phase 5 adds time-series tracking of signal-to-opportunity '
    'conversion rates and predicts future opportunity likelihood. <b>Rule:</b> The composite '
    'score formula (data 25%, evidence 20%, freshness 15%, signals 20%, contacts 10%, '
    'engagement 10%) must remain stable -- changes require a versioned schema migration.'
))
story.append(spacer(6))

story.append(h2('10.3 Phase 6 -- Autonomous Recommendations'))
story.append(body(
    '<b>IRON RULE: Phase 6 MUST remain human-in-the-loop.</b> AI recommends, human decides. '
    'The system must never auto-send emails, auto-approve drafts, or auto-enroll companies '
    'in sequences without explicit human approval. This is a non-negotiable architectural '
    'constraint that supersedes all optimization goals.'
))
story.append(spacer(18))

# ═══════════════════════════════════════════════════════════════
# SECTION 11: RFP/RFI Intelligence Foundation
# ═══════════════════════════════════════════════════════════════
story.append(h1('11. RFP/RFI Intelligence Foundation'))
story.append(body(
    'Phase 3 lays the groundwork for automated RFP/RFI detection and matching. The current '
    'implementation uses web search as the primary intelligence source, with the architecture '
    'designed to incorporate additional sources in future phases.'
))
story.append(spacer(6))

story.append(h2('11.1 Monitored Sources'))
story.append(body('<b>Current (Tavily Web Search):</b>'))
story.append(bullet('General news and press releases'))
story.append(bullet('Funding announcements (Crunchbase, PitchBook coverage)'))
story.append(bullet('Hiring activity (LinkedIn, Indeed, company career pages)'))
story.append(bullet('Technology changes (blog posts, stack share updates)'))
story.append(bullet('Partnership and acquisition announcements'))
story.append(spacer(4))
story.append(body('<b>Future Sources (Phase 4+):</b>'))
story.append(bullet('Government procurement portals (SAM.gov, TED, Contracts Finder)'))
story.append(bullet('Industry-specific bid databases'))
story.append(bullet('State/local government procurement sites'))
story.append(bullet('Private sector RFP aggregators'))
story.append(spacer(6))

story.append(h2('11.2 Detection Method'))
story.append(body(
    'LLM-based signal analysis with a structured extraction prompt. When research evidence '
    'contains procurement-related language, the signal detection prompt extracts: '
    'opportunityType (RFP/RFI/RFT/contract), deadline, buyingArea, techRequirement, '
    'and serviceRequirement. Each extracted field is validated against the governance '
    'thresholds before storage.'
))
story.append(spacer(6))

story.append(h2('11.3 Capability Matching'))
story.append(body(
    'The SignalCapabilityMatch table links RFP-related signals to internal CapabilityAsset '
    'records. Each match includes: category score (30%), keyword score (30%), business problem '
    'score (20%), impact score (5%), and an LLM-generated reasoning field explaining why the '
    'capability is relevant. The total score is used to rank capabilities for user review.'
))
story.append(spacer(6))

story.append(h2('11.4 Phase 4 Readiness'))
story.append(body(
    'This RFP/RFI intelligence foundation is the direct prerequisite for the Phase 4 '
    'Opportunity Intelligence engine. Phase 4 will: (1) add dedicated RFP source connectors, '
    '(2) build an opportunity pipeline that converts detected RFP signals into trackable '
    'opportunity records, (3) implement deadline-based prioritization, and (4) provide '
    'automated capability-gap analysis when no strong match is found.'
))

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Build PDF
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
doc.build(story, onFirstPage=on_page, onLaterPages=on_page)
print(f'PDF generated successfully: {OUTPUT}')