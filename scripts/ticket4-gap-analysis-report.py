"""
Ticket 4 Deep Gap Analysis Report — 3-Score Architecture Unification
Generates a comprehensive PDF with all identified gaps, fixtures, and remediation plan.
"""

import os, hashlib
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
from reportlab.lib.units import mm, cm
from reportlab.platypus import (
    Paragraph, Spacer, Table, TableStyle, PageBreak,
    KeepTogether, HRFlowable, SimpleDocTemplate
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase.pdfmetrics import registerFontFamily
import platform

# ━━ Font Setup ━━
_IS_MAC = platform.system() == 'Darwin'
FONT_DIR = os.path.expanduser('~/.openclaw/workspace/fonts') if _IS_MAC else '/usr/share/fonts'

pdfmetrics.registerFont(TTFont('NotoSerifSC', f'{FONT_DIR}/truetype/noto-serif-sc/NotoSerifSC-Regular.ttf'))
pdfmetrics.registerFont(TTFont('NotoSerifSC-Bold', f'{FONT_DIR}/truetype/noto-serif-sc/NotoSerifSC-Bold.ttf'))
pdfmetrics.registerFont(TTFont('FreeSerif', f'{FONT_DIR}/truetype/freefont/FreeSerif.ttf'))
pdfmetrics.registerFont(TTFont('FreeSerif-Bold', f'{FONT_DIR}/truetype/freefont/FreeSerifBold.ttf'))
pdfmetrics.registerFont(TTFont('FreeSerif-Italic', f'{FONT_DIR}/truetype/freefont/FreeSerifItalic.ttf'))
pdfmetrics.registerFont(TTFont('FreeSerif-BoldItalic', f'{FONT_DIR}/truetype/freefont/FreeSerifBoldItalic.ttf'))
pdfmetrics.registerFont(TTFont('DejaVuSans', f'{FONT_DIR}/truetype/dejavu/DejaVuSansMono.ttf'))
pdfmetrics.registerFont(TTFont('SarasaMonoSC', f'{FONT_DIR}/truetype/chinese/SarasaMonoSC-Regular.ttf'))

registerFontFamily('NotoSerifSC', normal='NotoSerifSC', bold='NotoSerifSC-Bold')
registerFontFamily('FreeSerif', normal='FreeSerif', bold='FreeSerif-Bold', italic='FreeSerif-Italic', boldItalic='FreeSerif-BoldItalic')

# ━━ Cascade Palette ━━
PAGE_BG       = colors.HexColor('#f1f1f0')
SECTION_BG    = colors.HexColor('#f2f1f0')
CARD_BG       = colors.HexColor('#e7e6e4')
TABLE_STRIPE  = colors.HexColor('#f0efed')
HEADER_FILL   = colors.HexColor('#4e4734')
COVER_BLOCK   = colors.HexColor('#857953')
BORDER_COLOR  = colors.HexColor('#ccc8bd')
ICON_COLOR    = colors.HexColor('#8a773f')
ACCENT        = colors.HexColor('#866f2b')
ACCENT_2      = colors.HexColor('#674db5')
TEXT_PRIMARY   = colors.HexColor('#262522')
TEXT_MUTED     = colors.HexColor('#8c8a83')
SEM_SUCCESS   = colors.HexColor('#388452')
SEM_WARNING   = colors.HexColor('#917b4d')
SEM_ERROR     = colors.HexColor('#9d4b43')
SEM_INFO      = colors.HexColor('#4d739a')

# ━━ Severity Colors ━━
SEV_COLORS = {
    'CRITICAL': colors.HexColor('#B91C1C'),
    'HIGH': colors.HexColor('#C2410C'),
    'MEDIUM': colors.HexColor('#A16207'),
    'LOW': colors.HexColor('#3B82F6'),
}

SEV_BG = {
    'CRITICAL': colors.HexColor('#FEE2E2'),
    'HIGH': colors.HexColor('#FFEDD5'),
    'MEDIUM': colors.HexColor('#FEF3C7'),
    'LOW': colors.HexColor('#DBEAFE'),
}

# ━━ Styles ━━
body_style = ParagraphStyle(
    name="Body", fontName="FreeSerif", fontSize=10, leading=16,
    alignment=TA_JUSTIFY, textColor=TEXT_PRIMARY, spaceAfter=6
)
h1_style = ParagraphStyle(
    name="H1", fontName="FreeSerif-Bold", fontSize=18, leading=24,
    textColor=HEADER_FILL, spaceAfter=10, spaceBefore=20
)
h2_style = ParagraphStyle(
    name="H2", fontName="FreeSerif-Bold", fontSize=14, leading=20,
    textColor=ACCENT, spaceAfter=8, spaceBefore=14
)
h3_style = ParagraphStyle(
    name="H3", fontName="FreeSerif-Bold", fontSize=11, leading=16,
    textColor=TEXT_PRIMARY, spaceAfter=6, spaceBefore=10
)
code_style = ParagraphStyle(
    name="Code", fontName="DejaVuSans", fontSize=8, leading=11,
    textColor=colors.HexColor('#374151'), backColor=colors.HexColor('#F3F4F6'),
    leftIndent=8, rightIndent=8, spaceAfter=4, spaceBefore=2
)
caption_style = ParagraphStyle(
    name="Caption", fontName="FreeSerif-Italic", fontSize=9, leading=13,
    textColor=TEXT_MUTED, spaceAfter=8
)

def make_sev_badge(sev):
    bg = SEV_BG.get(sev, colors.white)
    fg = SEV_COLORS.get(sev, TEXT_PRIMARY)
    return Paragraph(
        f'<font color="{fg.hexval()}">{sev}</font>',
        ParagraphStyle(name=f"badge-{sev}", fontName="FreeSerif-Bold", fontSize=8,
                       textColor=fg, backColor=bg, alignment=TA_CENTER,
                       leftIndent=2, rightIndent=2, spaceBefore=1, spaceAfter=1)
    )

def make_gap_table(gaps):
    """Create a styled table from a list of gap tuples."""
    header = [
        Paragraph('<b>ID</b>', ParagraphStyle(name='th', fontName='FreeSerif-Bold', fontSize=8, textColor=colors.white, alignment=TA_CENTER)),
        Paragraph('<b>Severity</b>', ParagraphStyle(name='th2', fontName='FreeSerif-Bold', fontSize=8, textColor=colors.white, alignment=TA_CENTER)),
        Paragraph('<b>File / Area</b>', ParagraphStyle(name='th3', fontName='FreeSerif-Bold', fontSize=8, textColor=colors.white)),
        Paragraph('<b>Gap Description</b>', ParagraphStyle(name='th4', fontName='FreeSerif-Bold', fontSize=8, textColor=colors.white)),
        Paragraph('<b>Fixture / Fix</b>', ParagraphStyle(name='th5', fontName='FreeSerif-Bold', fontSize=8, textColor=colors.white)),
    ]
    rows = [header]
    for gid, sev, area, desc, fix in gaps:
        rows.append([
            Paragraph(gid, ParagraphStyle(name=f'c1-{gid}', fontName='DejaVuSans', fontSize=7.5, textColor=TEXT_MUTED, alignment=TA_CENTER)),
            make_sev_badge(sev),
            Paragraph(area, ParagraphStyle(name=f'c2-{gid}', fontName='DejaVuSans', fontSize=7.5, textColor=TEXT_PRIMARY)),
            Paragraph(desc, ParagraphStyle(name=f'c3-{gid}', fontName='FreeSerif', fontSize=8, leading=11, textColor=TEXT_PRIMARY)),
            Paragraph(fix, ParagraphStyle(name=f'c4-{gid}', fontName='FreeSerif', fontSize=8, leading=11, textColor=SEM_INFO)),
        ])
    col_widths = [1.8*cm, 1.8*cm, 3.2*cm, 6.5*cm, 5.5*cm]
    t = Table(rows, colWidths=col_widths, repeatRows=1)
    style_cmds = [
        ('BACKGROUND', (0, 0), (-1, 0), HEADER_FILL),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTSIZE', (0, 0), (-1, -1), 8),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('GRID', (0, 0), (-1, -1), 0.5, BORDER_COLOR),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
        ('RIGHTPADDING', (0, 0), (-1, -1), 4),
    ]
    # Alternate row colors
    for i in range(1, len(rows)):
        if i % 2 == 0:
            style_cmds.append(('BACKGROUND', (0, i), (-1, i), TABLE_STRIPE))
    t.setStyle(TableStyle(style_cmds))
    return t

def make_summary_table():
    """Summary counts by severity."""
    header = [
        Paragraph('<b>Severity</b>', ParagraphStyle(name='sh', fontName='FreeSerif-Bold', fontSize=9, textColor=colors.white, alignment=TA_CENTER)),
        Paragraph('<b>Count</b>', ParagraphStyle(name='sh2', fontName='FreeSerif-Bold', fontSize=9, textColor=colors.white, alignment=TA_CENTER)),
        Paragraph('<b>Status</b>', ParagraphStyle(name='sh3', fontName='FreeSerif-Bold', fontSize=9, textColor=colors.white, alignment=TA_CENTER)),
    ]
    data = [
        ('CRITICAL', '4', 'Must fix before merge'),
        ('HIGH', '14', 'Fix in current ticket'),
        ('MEDIUM', '18', 'Fix in current or next ticket'),
        ('LOW', '16', 'Backlog / tech debt'),
        ('TOTAL', '52', ''),
    ]
    rows = [header]
    for sev, count, status in data:
        rows.append([
            make_sev_badge(sev),
            Paragraph(f'<b>{count}</b>', ParagraphStyle(name=f'sc-{sev}', fontName='FreeSerif-Bold', fontSize=10, alignment=TA_CENTER, textColor=TEXT_PRIMARY)),
            Paragraph(status, ParagraphStyle(name=f'ss-{sev}', fontName='FreeSerif', fontSize=9, textColor=TEXT_MUTED)),
        ])
    t = Table(rows, colWidths=[4*cm, 2.5*cm, 6*cm], repeatRows=1)
    style_cmds = [
        ('BACKGROUND', (0, 0), (-1, 0), HEADER_FILL),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('GRID', (0, 0), (-1, -1), 0.5, BORDER_COLOR),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('BACKGROUND', (0, -1), (-1, -1), CARD_BG),
    ]
    t.setStyle(TableStyle(style_cmds))
    return t


# ━━ Build Document ━━
OUTPUT = '/home/z/my-project/download/Ticket4_Deep_Gap_Analysis.pdf'
os.makedirs(os.path.dirname(OUTPUT), exist_ok=True)

doc = SimpleDocTemplate(
    OUTPUT, pagesize=A4,
    leftMargin=2*cm, rightMargin=2*cm, topMargin=2.5*cm, bottomMargin=2.5*cm,
)

story = []

# ═══════════════════════════════════════════════════
# COVER PAGE
# ═══════════════════════════════════════════════════
story.append(Spacer(1, 4*cm))
story.append(Paragraph('TICKET 4', ParagraphStyle(
    name='cover-kicker', fontName='FreeSerif-Bold', fontSize=13,
    textColor=ACCENT, alignment=TA_CENTER, spaceAfter=4, tracking=4
)))
story.append(Paragraph('Deep Gap Analysis Report', ParagraphStyle(
    name='cover-title', fontName='FreeSerif-Bold', fontSize=28,
    textColor=HEADER_FILL, alignment=TA_CENTER, leading=34, spaceAfter=12
)))
story.append(HRFlowable(width='40%', thickness=1.5, color=ACCENT, spaceAfter=12, hAlign='CENTER'))
story.append(Paragraph('3-Score Architecture Unification', ParagraphStyle(
    name='cover-sub', fontName='FreeSerif', fontSize=14,
    textColor=TEXT_MUTED, alignment=TA_CENTER, spaceAfter=8
)))
story.append(Paragraph('Intelligence API Layer Refactoring', ParagraphStyle(
    name='cover-sub2', fontName='FreeSerif-Italic', fontSize=11,
    textColor=TEXT_MUTED, alignment=TA_CENTER, spaceAfter=20
)))
story.append(Spacer(1, 3*cm))

meta_data = [
    ['Project', 'DeepMindQ Intelligence API'],
    ['Document Type', 'Gap Analysis + Fixture Report'],
    ['Scope', 'Ticket 4: 3-Score Architecture'],
    ['Audit Depth', 'Line-by-line, cross-file'],
    ['Total Findings', '52 gaps (4 CRITICAL, 14 HIGH, 18 MEDIUM, 16 LOW)'],
    ['Date', '2026-07-31'],
]
meta_table = Table(meta_data, colWidths=[4*cm, 9*cm])
meta_table.setStyle(TableStyle([
    ('FONTNAME', (0, 0), (0, -1), 'FreeSerif-Bold'),
    ('FONTNAME', (1, 0), (1, -1), 'FreeSerif'),
    ('FONTSIZE', (0, 0), (-1, -1), 9),
    ('TEXTCOLOR', (0, 0), (0, -1), ACCENT),
    ('TEXTCOLOR', (1, 0), (1, -1), TEXT_PRIMARY),
    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ('TOPPADDING', (0, 0), (-1, -1), 3),
    ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
    ('LINEBELOW', (0, 0), (-1, -1), 0.3, BORDER_COLOR),
]))
story.append(meta_table)

story.append(PageBreak())

# ═══════════════════════════════════════════════════
# EXECUTIVE SUMMARY
# ═══════════════════════════════════════════════════
story.append(Paragraph('1. Executive Summary', h1_style))
story.append(Paragraph(
    'This report presents the findings of a line-by-line, cross-file audit of Ticket 4 (3-Score Architecture '
    'Unification) for the DeepMindQ Intelligence API Layer. The audit examined every source file related to '
    'scoring: three scoring engines, two API routes, the unified types contract, the frontend ScoreTriple '
    'component, the Prisma schema, and all existing tests. A total of 52 gaps were identified across four '
    'severity levels. Four of these are CRITICAL and must be resolved before the ticket can be considered complete.',
    body_style
))
story.append(Paragraph(
    'The most significant systemic issue is that the new unified scores endpoint (GET /api/companies/{id}/scores) '
    'lives outside the Intelligence API Layer. It bypasses the established guard middleware (intelligenceGuard), '
    'meaning it has no rate limiting, no Zod validation, no correlation-id tracking, no scrubError protection, '
    'and does not use the standard IntelligenceResponse envelope. This violates the core architectural principle '
    'that all intelligence flows through the Intelligence API Layer. The tests for this endpoint are also '
    'tautological placeholder tests that validate hardcoded mock objects rather than calling the actual route handler.',
    body_style
))
story.append(Paragraph(
    'A second systemic problem is the tier classification inconsistency across all three scoring systems. '
    'Intelligence Score uses lowercase tiers (hot, warm, cold), Account Priority uses uppercase (HOT, ACTIVE, '
    'NURTURE, LOW), and Revenue Opportunity uses uppercase snake_case (HOT_ACCOUNT, WARM_ACCOUNT, NURTURE, '
    'AT_RISK). The frontend ScoreTriple component renders these raw tier strings directly as badges, resulting '
    'in a jarring visual inconsistency where one gauge shows "hot" and the next shows "WARM_ACCOUNT".',
    body_style
))
story.append(Spacer(1, 8))
story.append(Paragraph('Finding Summary', h3_style))
story.append(make_summary_table())
story.append(Spacer(1, 12))

# ═══════════════════════════════════════════════════
# 2. CRITICAL GAPS
# ═══════════════════════════════════════════════════
story.append(Paragraph('2. Critical Gaps (Must Fix Before Merge)', h1_style))
story.append(Paragraph(
    'These four issues represent fundamental defects that either violate the architecture spec, expose security '
    'risks, or make the test suite meaningless. Each one must be resolved before Ticket 4 can be considered complete.',
    body_style
))

critical_gaps = [
    ('C-1', 'CRITICAL',
     'scores/route.ts (L92-243)',
     'No rate limiting, no validation, no guard middleware on GET /api/companies/{id}/scores. The route uses bare NextRequest, does not call intelligenceGuard or utilityGuard, has no Zod schema for the companyId param, no correlation-id, no scrubError, and no response headers. This endpoint can be hammered unlimitedly and leaks the URL in error logs (line 240 logs _request.url instead of extracted id).',
     'Rewrite GET handler to accept NextRequest. Call utilityGuard(request, "scores") at the top. Import scrubError and use it for the 500 catch. Use Response.json() instead of NextResponse.json() for consistency with all other intelligence routes. Fix logger to use extracted companyId.'),
    ('C-2', 'CRITICAL',
     'ticket4-score-unification.test.ts (L1-236)',
     'All 14 tests in this file are tautological placeholder tests that validate hardcoded mock objects. None of them call any actual scoring function or API route handler. For example, the "Intelligence Score is always 0-100" test checks that the literal array [0, 25, 50, 75, 100] contains values in range 0-100, which is trivially true. The "scores endpoint returns correct shape" test creates a hardcoded object and checks it has the expected keys.',
     'Replace all tests with actual integration tests that: (1) Mock db module, (2) Call GET handler from scores/route.ts with a mock Request, (3) Assert response shape from actual handler output, (4) Test edge cases: company not found, AccountScore missing, scoreBreakdown parse failure, PriorityScoreHistory empty.'),
    ('C-3', 'CRITICAL',
     'account-scoring.ts (L200-212)',
     'classifyCategory() never returns AT_RISK. The AccountCategory type includes "AT_RISK" but this function only returns "HOT_ACCOUNT" (>=70), "WARM_ACCOUNT" (>=40), or "NURTURE" (everything below 40). The deprecated account-scorer.ts correctly handles AT_RISK (< 40), but the new scorer silently assigns NURTURE to the lowest scores. This means companies that should be flagged as AT_RISK are instead classified as NURTURE, losing critical negative-signal information.',
     'Add AT_RISK return: if score < ACCOUNT_CATEGORY_THRESHOLDS.AT_RISK (currently -1, change to 20), return "AT_RISK". Update signal-patterns.ts: AT_RISK threshold from -1 to 20. Add tests for the AT_RISK boundary.'),
    ('C-4', 'CRITICAL',
     'revenue-score route.ts (L72)',
     'GET /api/ai/revenue-score leaks raw error.message to the client on 500 responses. Line 72: "const message = error instanceof Error ? error.message : \'Unknown error\'" then returns { error: message } with status 500. This violates the security principle established in Ticket 1 (scrubError for all error responses) and could expose database connection strings, file paths, or internal stack traces.',
     'Import scrubError from @/lib/intelligence-api/handler. Replace raw error.message with scrubError(error.message). Also add utilityGuard for rate limiting and correlation-id.'),
]

story.append(make_gap_table(critical_gaps))
story.append(Spacer(1, 6))
story.append(Paragraph(
    '<b>C-1 Fixture Code:</b> The following shows the corrected route handler skeleton that applies the guard:',
    caption_style
))
story.append(Paragraph(
    "import { NextRequest } from 'next/server';<br/>"
    "import { utilityGuard, utilityCatchError, utilitySuccess } from '@/lib/intelligence-api/guard';<br/><br/>"
    "export async function GET(request: NextRequest, { params }: ...) {<br/>"
    "&nbsp;&nbsp;const ctx = utilityGuard(request, 'scores');<br/>"
    "&nbsp;&nbsp;try {<br/>"
    "&nbsp;&nbsp;&nbsp;&nbsp;const { id } = await params;<br/>"
    "&nbsp;&nbsp;&nbsp;&nbsp;// ... rest of handler ...<br/>"
    "&nbsp;&nbsp;&nbsp;&nbsp;return utilitySuccess(ctx, responseData, 'scores');<br/>"
    "&nbsp;&nbsp;} catch (err) {<br/>"
    "&nbsp;&nbsp;&nbsp;&nbsp;return utilityCatchError(ctx, err, 502, 'INTELLIGENCE_UNAVAILABLE', 'Scores fetch failed');<br/>"
    "&nbsp;&nbsp;}<br/>"
    "}",
    code_style
))
story.append(PageBreak())

# ═══════════════════════════════════════════════════
# 3. HIGH SEVERITY GAPS
# ═══════════════════════════════════════════════════
story.append(Paragraph('3. High Severity Gaps', h1_style))
story.append(Paragraph(
    'These 14 issues represent significant architectural violations, data integrity risks, or missing '
    'implementations that weaken the 3-Score Architecture. They should all be fixed within the current ticket.',
    body_style
))

high_gaps = [
    ('H-1', 'HIGH',
     'Cross-file: Tier system',
     'Three different tier classification systems use incompatible naming: Intelligence Score (hot/warm/cold/unknown), Account Priority (HOT/ACTIVE/NURTURE/LOW), Revenue Opportunity (HOT_ACCOUNT/WARM_ACCOUNT/NURTURE/AT_RISK). ScoreTriple renders these raw values as badges. The fallback tier in company/[id]/route.ts line 469 is "medium" which matches none of the AccountPriorityTier enum values (HOT/ACTIVE/NURTURE/LOW).',
     'Create a canonical tier normalizer: normalizeTier(rawTier, scoreSystem) that maps all variants to a unified display set: { critical, high, medium, low }. Apply in ScoreTriple before rendering. Fix the "medium" fallback to "NURTURE" (a valid enum value).'),
    ('H-2', 'HIGH',
     'scores/route.ts (U8)',
     'The scores route defines local interfaces (IntelligenceScoreDetail, AccountPriorityDetail, etc.) that duplicate but diverge from the canonical types in types.ts. The IntelligenceCompanyContext.scores in types.ts has different field names and shapes. This means the frontend must handle two incompatible response shapes depending on which endpoint it calls.',
     'Import types from types.ts or create a shared scores-response-types.ts. Ensure both /api/companies/{id}/scores and /api/intelligence/company/{id}?include=scores use the same exported types. Delete the local interface definitions.'),
    ('H-3', 'HIGH',
     'account-scorer.ts (deprecated)',
     'The deprecated account-scorer.ts still exists and writes a DIFFERENT scoreBreakdown format: { signalStrength, engagement, opportunityFit, timing } vs the new format: { intelligenceCoverage, signalStrength, freshness, strategicFit, engagementHistory }. If the deprecated scorer was the last to write, the scores endpoint will parse ALL ZEROS for the 5 expected keys.',
     'Add a migration check: in scores/route.ts, detect legacy format (presence of "engagement" or "opportunityFit" keys) and return a warning field. Run a one-time migration script to recalculate all AccountScore records using the new scorer.'),
    ('H-4', 'HIGH',
     'company/[id]/route.ts (L469)',
     'The accountPriority tier fallback is "medium" which is not a valid CompanyPriorityTier value. The enum only allows HOT, ACTIVE, NURTURE, LOW. If a company has accountPriorityScore set but priorityTier is null (race condition during first computation), the API returns an invalid tier.',
     'Change fallback from "medium" to "NURTURE": company.priorityTier ?? "NURTURE". Add a unit test for this edge case.'),
    ('H-5', 'HIGH',
     'scores/route.ts (U10)',
     'Revenue Opportunity breakdown parsing assumes the new 5-key format. If AccountScore.scoreBreakdown contains the legacy 4-key format from account-scorer.ts, all 5 parsed values will be 0. The route silently returns { intelligenceCoverage: 0, signalStrength: 0, ... } without indicating the data is stale.',
     'Add format detection: check for presence of "intelligenceCoverage" key. If absent, set a "stale: true" flag in the response and attempt to map legacy keys: engagement -> engagementHistory, timing -> freshness.'),
    ('H-6', 'HIGH',
     'engine.test.ts (X1-X2)',
     'No unit tests for scoreStaticFit(), scoreDynamicIntelligence(), or scoreTimingUrgency(). These are the three core sub-dimension scoring functions. The existing tests only exercise computeAccountPriority() at the integration level with all-zero mocks, meaning the composite score is always driven by StaticFit alone with zero Dynamic and Timing components.',
     'Add dedicated test describe blocks for each sub-function: scoreStaticFit (test excludeIndustries, partial keyword match, null fields, empty ICP), scoreDynamicIntelligence (test null aggregates, high signal counts, zero evidence), scoreTimingUrgency (test day-0 signals, very old signals, multiple opportunities).'),
    ('H-7', 'HIGH',
     'ticket2-integration.test.ts (X10)',
     'No test for include=scores on the intelligence company endpoint. The ticket2 integration tests cover all 10 intelligence endpoints but never verify the scores section of IntelligenceCompanyContext when include=scores is requested.',
     'Add a test case: call GET /api/intelligence/company/{id}?include=scores with mocked DB data, verify response.data.scores contains intelligence, accountPriority, and revenueOpportunity fields with correct types.'),
    ('H-8', 'HIGH',
     'revenue-opportunity-engine.ts (O1)',
     'The revenue-opportunity-engine.ts produces a completely separate "fourth score" (opportunityScore with grade A-F) that is NOT connected to the 3-Score Architecture. Its output is stored only in AIInsight, not in AccountScore, and is not returned by either scores endpoint. It is called by POST /api/ai/revenue-score but its results are invisible to the ScoreTriple display.',
     'Either: (a) connect revenue-opportunity-engine output to AccountScore table via upsert, (b) add it as a fourth optional field in the scores response, or (c) explicitly document it as a separate "deep scoring" feature outside the 3-Score Architecture with a deprecation plan.'),
    ('H-9', 'HIGH',
     'Prisma schema (PG1)',
     'PriorityScoreHistory.priorityTier is String not CompanyPriorityTier enum. This allows invalid tier values like "medium" or "warm" to be stored in the history table. The Company model uses the enum correctly, but the history table bypasses type safety.',
     'Change PriorityScoreHistory.priorityTier to CompanyPriorityTier enum. Add a migration: ALTER TABLE PriorityScoreHistory ALTER COLUMN priorityTier TYPE CompanyPriorityTier USING priorityTier::CompanyPriorityTier. Handle NULL values by defaulting to LOW.'),
    ('H-10', 'HIGH',
     'Prisma schema (PG2)',
     'AccountScore.category is a free-form String with default "NURTURE". Valid values should be HOT_ACCOUNT, WARM_ACCOUNT, NURTURE, AT_RISK. A Prisma enum would prevent invalid values like "hot" or "WARM" (wrong case).',
     'Create an AccountCategory enum in Prisma schema: enum AccountCategory { HOT_ACCOUNT, WARM_ACCOUNT, NURTURE, AT_RISK }. Change AccountScore.category to use the enum. Add migration.'),
    ('H-11', 'HIGH',
     'company-profile-screen.tsx (F1)',
     'ScoreTriple is hidden on mobile (hidden lg:block at line 832). Mobile users never see the 3-score unified display. There is no mobile fallback or alternative view.',
     'Add a mobile fallback: show a compact horizontal score bar or stacked score cards visible below lg breakpoint. Use a responsive grid: lg:grid-cols-3 grid-cols-1 with compact layout for small screens.'),
    ('H-12', 'HIGH',
     'company-profile-screen.tsx (F2)',
     'Revenue score item maps category (e.g., "WARM_ACCOUNT") directly as tier in ScoreTriple (line 611: tier: scoresData.revenueOpportunity.category). "WARM_ACCOUNT" is a category label, not a tier name. The ScoreTriple badge displays this raw value, which looks wrong to users.',
     'Map category to display tier before passing to ScoreTriple: const tierMap = { HOT_ACCOUNT: "High", WARM_ACCOUNT: "Medium", NURTURE: "Low", AT_RISK: "At Risk" }. Apply in the revenueScoreItem construction.'),
    ('H-13', 'HIGH',
     'types.ts (T1)',
     'The scores type has both revenue: RevenueScore and revenueOpportunity: {...} as separate fields. RevenueScore has { score, grade, confidence, priorityTier } while revenueOpportunity has { score, category, breakdown }. Two different revenue score shapes in the same interface with no documentation explaining the relationship.',
     'Document the distinction clearly in types.ts with JSDoc: revenue is from ScoringEngine (real-time AI scoring), revenueOpportunity is from AccountScore table (deterministic historical scoring). Consider renaming for clarity: revenueAi vs revenueDeterministic.'),
    ('H-14', 'HIGH',
     'scores/route.ts (U4-U7)',
     'The scores route does not use scrubError(), has no correlation-id, no response headers, and uses NextResponse.json() instead of Response.json(). This makes it inconsistent with every other intelligence API route and harder to debug in production.',
     'Adopt utilityGuard + utilitySuccess + utilityCatchError pattern. This single change fixes rate limiting, correlation-id, response headers, error scrubbing, and response format consistency.'),
]

story.append(make_gap_table(high_gaps))
story.append(PageBreak())

# ═══════════════════════════════════════════════════
# 4. MEDIUM SEVERITY GAPS
# ═══════════════════════════════════════════════════
story.append(Paragraph('4. Medium Severity Gaps', h1_style))
story.append(Paragraph(
    'These 18 issues represent design inconsistencies, missing test coverage, and moderate code quality problems. '
    'They should be addressed in the current ticket or the next immediate ticket.',
    body_style
))

medium_gaps = [
    ('M-1', 'MEDIUM',
     'design-system.tsx (D1)',
     'ScoreGauge.getColor() and scoreGaugeColor() use different color scales for the same score ranges. ScoreGauge: >=80 green, >=60 amber, >=40 yellow, <40 red. scoreGaugeColor (used by ScoreTriple): >=80 green, >=60 blue, >=40 amber, <40 red. A score of 65 renders amber in ScoreGauge but blue in ScoreTriple.',
     'Unify the color function: delete scoreGaugeColor() and use the same getColor logic from ScoreGauge across both components. Export a shared getColor(score) function.'),
    ('M-2', 'MEDIUM',
     'company/[id]/route.ts (I2, I3)',
     'Revenue breakdown parsing logic is duplicated between scores/route.ts (lines 193-206) and company/[id]/route.ts (lines 444-458). If one is fixed, the other must be updated too. Two different "revenue" shapes also exist: revenue (ScoringEngine output) and revenueOpportunity (AccountScore).',
     'Extract revenue breakdown parsing into a shared utility function: parseRevenueBreakdown(scoreBreakdown: unknown). Import in both routes.'),
    ('M-3', 'MEDIUM',
     'engine.ts (E1)',
     'getPrioritizedCompanies() uses Record<string, unknown> for where and orderBy, defeating Prisma type safety. This could lead to runtime query errors that TypeScript cannot catch at compile time.',
     'Use Prisma.CompanyWhereInput and Prisma.CompanyOrderByWithRelationInput types. Import from @prisma/client.'),
    ('M-4', 'MEDIUM',
     'Prisma schema (PG3, PG4)',
     'PriorityScoreHistory has duplicate field pairs: staticFitTotal (Int) + staticFitScore (Float) store the same value. accountPriorityScore is Int while previousScore/newScore are Float. Type inconsistency for the same conceptual value.',
     'Deprecate the Total fields (mark with @deprecated in Prisma comments). Use only the Score fields. In a future migration, remove the Total fields. Change accountPriorityScore to Float for consistency.'),
    ('M-5', 'MEDIUM',
     'account-scoring.ts (S3)',
     'Two different "freshness" scores exist in the system: intelligence-contract.ts measures freshness by category-based half-lives (profile/signal/contact/technology), while account-scoring.ts measures it by most recent IntelligenceObject.capturedAt. Both are called "freshness" but measure fundamentally different things.',
     'Rename one: intelligence-contract.ts keeps "freshnessScore", account-scoring.ts renames to "dataRecency" or "signalRecency". Update the scoreBreakdown keys accordingly.'),
    ('M-6', 'MEDIUM',
     'engine.test.ts (X3-X5)',
     'Missing tests for: scoreTimingUrgency edge cases (day-0, very old signals), getPrioritizedCompanies with sortBy/search/tier filter, computeAllAccountPriorities with partial failures (Promise.allSettled rejection handling).',
     'Add: timing edge case tests (latestSignalDaysAgo=0, =365), sort/filter tests for getPrioritizedCompanies, rejection handling test for batch compute.'),
    ('M-7', 'MEDIUM',
     'scores/route.ts (U9)',
     'getAccountIntelligence() failure degrades silently. If the research engine throws, the response falls back to stored Company.intelligenceScore without any indication that the score is stale. The caller cannot distinguish between a fresh live-computed score and a days-old stored fallback.',
     'Add staleness indicator: include a "freshness" field in the intelligence response. If fallback was used, set freshness.status = "stale" with a lastComputedAt timestamp from Company.lastEnrichedAt.'),
    ('M-8', 'MEDIUM',
     'account-scoring.ts (S1)',
     'computeStrategicFit() uses hardcoded industry keyword lists (TECH_INDUSTRY_KEYWORDS, FINANCE_INDUSTRY_KEYWORDS) that are not configurable via the ICP profile. This means the "strategic fit" dimension is vendor-defined rather than customer-defined, contradicting the ICP-driven architecture.',
     'Accept ICP profile as parameter to computeStrategicFit(). Use ICP.targetIndustries for primary matching, fall back to hardcoded lists only when ICP is empty.'),
    ('M-9', 'MEDIUM',
     'account-scorer.ts (R3)',
     'Deprecated calculateAndPersistScore() uses db.accountScore.create() (not upsert). Calling it twice for the same company throws a unique constraint violation. The new account-scoring.ts correctly uses upsert.',
     'No fix needed (file is deprecated), but add a comment warning: "Will throw on duplicate companyId. Use account-scoring.ts persistAccountScore() instead."'),
    ('M-10', 'MEDIUM',
     'types.ts (T1, CI-5)',
     'IntelligenceCompanyContext.scores.revenue is typed as RevenueScore (from scoring-engine) while scores.revenueOpportunity has a custom inline type. The relationship between these two fields is undocumented.',
     'Add JSDoc comments: "@field revenue - Real-time AI revenue score from ScoringEngine. @field revenueOpportunity - Deterministic revenue score from AccountScore table."'),
    ('M-11', 'MEDIUM',
     'Prisma schema (PG5)',
     'No @@index([triggerType]) on PriorityScoreHistory. Filtering by trigger type in analytics queries would require a full table scan.',
     'Add @@index([triggerType]) to PriorityScoreHistory model.'),
    ('M-12', 'MEDIUM',
     'company-profile-screen.tsx (F4)',
     'ScoreGauge segments (line 616-620) use synthetic approximations: (score * 0.4) + 20. These are NOT the actual sub-dimension scores from the intelligence contract. They are fake derived values that mislead users.',
     'Fetch actual breakdown from scoresData.intelligence.breakdown (6 components) when available. Use real values for segments. Fall back to synthetic only when breakdown is null.'),
    ('M-13', 'MEDIUM',
     'ARCHITECTURE.md (A1)',
     'Ticket 4 spec references "account-scorer.ts" for Opportunity Score unification, but the actual implementation uses "account-scoring.ts" (the new 5-dimension scorer). The spec is stale and references the deprecated file.',
     'Update ARCHITECTURE.md to reference account-scoring.ts. Add note about deprecated account-scorer.ts.'),
    ('M-14', 'MEDIUM',
     'types.ts (CI-6)',
     'IntelligenceCompanyContext.company.intelligenceScore is number (not nullable) while accountPriorityScore is number | null. This is correct per Prisma defaults but the inconsistency is undocumented.',
     'Add JSDoc: "intelligenceScore defaults to 0 (never null), accountPriorityScore is null until first computation."'),
    ('M-15', 'MEDIUM',
     'ticket2-integration.test.ts (X11)',
     'Tests mock db.accountScore.findUnique but do not verify the revenueOpportunity sub-shape is correctly constructed from the AccountScore record in the include=scores path.',
     'Add assertion: expect(response.data.scores.revenueOpportunity.breakdown.intelligenceCoverage).toBeDefined()'),
    ('M-16', 'MEDIUM',
     'intelligence-contract.ts (C1)',
     'AccountIntelligence.tier uses hot/warm/cold/unknown while AccountPriorityBreakdown.tier uses HOT/ACTIVE/NURTURE/LOW. Case-sensitive tier names mixed across the system.',
     'See H-1 (tier normalization). Part of the same systemic issue.'),
    ('M-17', 'MEDIUM',
     'account-scoring.ts (S4)',
     'recalculateAllScores() is sequential (one persistAccountScore per company in a for loop). For large datasets (1000+ companies), this will be very slow.',
     'Batch in groups of 10 using Promise.all with concurrency limit. Add progress logging.'),
    ('M-18', 'MEDIUM',
     'engine.ts (E5-E6)',
     'parseEmployeeRange() is untested (edge cases: "10K+", "1,000-5,000", empty string). Tech stack JSON parse errors are silently swallowed without logging.',
     'Add parseEmployeeRange tests. Add logger.warn for tech stack parse failures.'),
]

story.append(make_gap_table(medium_gaps))
story.append(PageBreak())

# ═══════════════════════════════════════════════════
# 5. LOW SEVERITY GAPS
# ═══════════════════════════════════════════════════
story.append(Paragraph('5. Low Severity Gaps (Backlog)', h1_style))
story.append(Paragraph(
    'These 16 items are minor code quality improvements, documentation gaps, and minor accessibility issues. '
    'They can be deferred to a tech-debt backlog but should not be forgotten.',
    body_style
))

low_gaps = [
    ('L-1', 'LOW', 'design-system.tsx (D3)', 'No aria-label on ScoreTriple component for screen readers.', 'Add aria-label="Score summary" to the outer div.'),
    ('L-2', 'LOW', 'company-profile-screen.tsx (F3)', 'Intelligence score fallback (line 589) always constructs a ScoreItem even when score is 0. A company with no intelligence shows "0 - unknown" instead of nothing.', 'Return null when score is 0 and no live computation exists.'),
    ('L-3', 'LOW', 'Prisma schema (PG6)', 'AccountScore has no updatedAt field. No way to distinguish creation vs modification time.', 'Add updatedAt DateTime @updatedAt to AccountScore.'),
    ('L-4', 'LOW', 'Prisma schema (PG7)', 'No composite index [companyId, priorityTier] on Company for tier-filtered queries.', 'Add @@index([companyId, priorityTier]) to Company model.'),
    ('L-5', 'LOW', 'Prisma schema (S6)', 'PriorityScoreHistory.priorityTier is String not CompanyPriorityTier enum.', 'Covered by H-9. Duplicate.'),
    ('L-6', 'LOW', 'intelligence-contract.ts (C2)', 'getAccountIntelligence() name is overloaded: computes intelligence SCORE, not general intelligence.', 'Consider renaming to computeIntelligenceScore(). Low priority.'),
    ('L-7', 'LOW', 'scores/route.ts (U11)', 'Line 240 logs companyId as _request.url (full URL) instead of extracted id.', 'Fix to: companyId: id.'),
    ('L-8', 'LOW', 'company/[id]/route.ts (I4)', 'Line 463: const intelScore = (company.intelligenceScore as number) ?? 0. The "as number" cast is misleading since the field is already number | null.', 'Change to: (company.intelligenceScore ?? 0).'),
    ('L-9', 'LOW', 'engine.test.ts (X6)', 'No test for computeAllAccountPriorities() when some companies fail (Promise.allSettled rejection handling).', 'Add test with one company throwing, verify others still process.'),
    ('L-10', 'LOW', 'ARCHITECTURE.md (A3)', 'Ticket 4 exit criteria checkboxes show [ ] (unchecked) but PROJECT_STATUS.md says COMPLETE.', 'Update ARCHITECTURE.md checkboxes to [x].'),
    ('L-11', 'LOW', 'PROJECT_STATUS.md (P1)', 'Test count "1453/1453" but only 28 new tests for a 3-score unification seems low.', 'After fixing tests (C-2), update count.'),
    ('L-12', 'LOW', 'design-system.tsx', 'ScoreTriple strokeDashoffset calculation does not clamp to 0. If score > 100, offset goes negative causing rendering artifacts.', 'Add Math.max(0, ...) to the offset calculation.'),
    ('L-13', 'LOW', 'account-scoring.ts (S2)', 'computeStrategicFit() is not configurable via ICP profile. (Covered by M-8.)', 'See M-8.'),
    ('L-14', 'LOW', 'engine.ts (E3)', 'parseEmployeeRange() returns max: Infinity for "10000+". Would serialize to null in JSON, but no JSON path exists.', 'No fix needed currently.'),
    ('L-15', 'LOW', 'revenue-opportunity-engine.ts (O2)', 'scoreRevenueOpportunity() calls createInsight() which has side effects. Scoring is not idempotent.', 'Add idempotency key or check for existing insight before creating.'),
    ('L-16', 'LOW', 'All', 'No concurrent score computation tests. Race condition on Company.update is possible.', 'Add test: two simultaneous computeAccountPriority calls for same company.'),
]

story.append(make_gap_table(low_gaps))
story.append(PageBreak())

# ═══════════════════════════════════════════════════
# 6. TEST COVERAGE FIXTURE
# ═══════════════════════════════════════════════════
story.append(Paragraph('6. Test Coverage Fixtures', h1_style))
story.append(Paragraph(
    'The following test fixture code addresses the most critical test gaps identified above. These fixtures '
    'should be added to the existing test files to provide meaningful coverage for the scoring functions.',
    body_style
))

story.append(Paragraph('6.1 Scores Route Integration Test Fixture', h2_style))
story.append(Paragraph(
    'This fixture replaces the tautological tests in ticket4-score-unification.test.ts with actual route '
    'handler tests that mock the database and call the real GET handler:',
    caption_style
))
story.append(Paragraph(
    "// ticket4-score-unification.test.ts - REPLACEMENT FIXTURE<br/>"
    "import { describe, it, expect, vi, beforeEach } from 'vitest'<br/>"
    "import { GET } from '@/app/api/companies/[id]/scores/route'<br/><br/>"
    "const mockDbFindUnique = vi.fn()<br/>"
    "const mockDbFindMany = vi.fn()<br/>"
    "vi.mock('@/lib/db', () => ({<br/>"
    "&nbsp;&nbsp;db: {<br/>"
    "&nbsp;&nbsp;&nbsp;&nbsp;company: { findUnique: (...a: unknown[]) => mockDbFindUnique(...a) },<br/>"
    "&nbsp;&nbsp;&nbsp;&nbsp;accountScore: { findUnique: (...a: unknown[]) => mockDbFindUnique(...a) },<br/>"
    "&nbsp;&nbsp;&nbsp;&nbsp;priorityScoreHistory: { findMany: (...a: unknown[]) => mockDbFindMany(...a) },<br/>"
    "&nbsp;&nbsp;}<br/>"
    "}))<br/><br/>"
    "vi.mock('@/lib/intelligence-contract', () => ({<br/>"
    "&nbsp;&nbsp;getAccountIntelligence: vi.fn().mockResolvedValue({<br/>"
    "&nbsp;&nbsp;&nbsp;&nbsp;intelligenceScore: 72, tier: 'hot', computedAt: '2026-01-01',<br/>"
    "&nbsp;&nbsp;&nbsp;&nbsp;components: { dataCompleteness: 80, evidenceQuality: 70 }<br/>"
    "&nbsp;&nbsp;})<br/>"
    "}))<br/><br/>"
    "describe('GET /api/companies/{id}/scores', () => {<br/>"
    "&nbsp;&nbsp;it('returns 404 for non-existent company', async () => {<br/>"
    "&nbsp;&nbsp;&nbsp;&nbsp;mockDbFindUnique.mockResolvedValueOnce(null)<br/>"
    "&nbsp;&nbsp;&nbsp;&nbsp;const res = await GET(new Request('http://x/api/companies/nope/scores'),<br/>"
    "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{ params: Promise.resolve({ id: 'nope' }) })<br/>"
    "&nbsp;&nbsp;&nbsp;&nbsp;expect(res.status).toBe(404)<br/>"
    "&nbsp;&nbsp;})<br/>"
    "&nbsp;&nbsp;it('returns all 3 scores with correct shape', async () => {<br/>"
    "&nbsp;&nbsp;&nbsp;&nbsp;mockDbFindUnique.mockResolvedValueOnce({<br/>"
    "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;id: 'c1', rawName: 'Test', intelligenceScore: 72,<br/>"
    "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;accountPriorityScore: 85, priorityTier: 'ACTIVE',<br/>"
    "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;priorityComputedAt: new Date(), lastEnrichedAt: new Date()<br/>"
    "&nbsp;&nbsp;&nbsp;&nbsp;})<br/>"
    "&nbsp;&nbsp;&nbsp;&nbsp;mockDbFindUnique.mockResolvedValueOnce({<br/>"
    "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;companyId: 'c1', score: 68, category: 'WARM_ACCOUNT',<br/>"
    "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;scoreBreakdown: JSON.stringify({<br/>"
    "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;intelligenceCoverage: 70, signalStrength: 65,<br/>"
    "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;freshness: 80, strategicFit: 55, engagementHistory: 40<br/>"
    "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;})<br/>"
    "&nbsp;&nbsp;&nbsp;&nbsp;})<br/>"
    "&nbsp;&nbsp;&nbsp;&nbsp;mockDbFindMany.mockResolvedValue([])<br/>"
    "&nbsp;&nbsp;&nbsp;&nbsp;const res = await GET(new Request('http://x/api/companies/c1/scores'),<br/>"
    "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{ params: Promise.resolve({ id: 'c1' }) })<br/>"
    "&nbsp;&nbsp;&nbsp;&nbsp;const data = await res.json()<br/>"
    "&nbsp;&nbsp;&nbsp;&nbsp;expect(data.intelligence.score).toBe(72)<br/>"
    "&nbsp;&nbsp;&nbsp;&nbsp;expect(data.accountPriority.score).toBe(85)<br/>"
    "&nbsp;&nbsp;&nbsp;&nbsp;expect(data.revenueOpportunity.score).toBe(68)<br/>"
    "&nbsp;&nbsp;&nbsp;&nbsp;expect(data.revenueOpportunity.breakdown.intelligenceCoverage).toBe(70)<br/>"
    "&nbsp;&nbsp;&nbsp;&nbsp;expect(data.history).toEqual([])<br/>"
    "&nbsp;&nbsp;})<br/>"
    "})",
    code_style
))

story.append(Paragraph('6.2 Engine Sub-Function Test Fixture', h2_style))
story.append(Paragraph(
    'These tests cover the untested sub-dimension scoring functions in engine.ts:',
    caption_style
))
story.append(Paragraph(
    "// engine.test.ts - ADDITIONAL SUB-FUNCTION TESTS<br/>"
    "describe('scoreStaticFit edge cases', () => {<br/>"
    "&nbsp;&nbsp;it('returns 0 industry when company is in excludeIndustries', async () => {<br/>"
    "&nbsp;&nbsp;&nbsp;&nbsp;mockSystemSettingFindUnique.mockResolvedValueOnce({<br/>"
    "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;value: JSON.stringify({ targetIndustries: ['SaaS'],<br/>"
    "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;excludeIndustries: ['Healthcare'] })<br/>"
    "&nbsp;&nbsp;&nbsp;&nbsp;})<br/>"
    "&nbsp;&nbsp;&nbsp;&nbsp;mockDbFindUnique.mockResolvedValueOnce({<br/>"
    "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;id: 'c1', industry: 'Healthcare', sizeRange: null, country: null,<br/>"
    "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;accountPriorityScore: null, priorityTier: null<br/>"
    "&nbsp;&nbsp;&nbsp;&nbsp;})<br/>"
    "&nbsp;&nbsp;&nbsp;&nbsp;const result = await computeAccountPriority('c1')<br/>"
    "&nbsp;&nbsp;&nbsp;&nbsp;expect(result.priority.staticFit.industry).toBe(0)<br/>"
    "&nbsp;&nbsp;})<br/>"
    "&nbsp;&nbsp;it('handles partial keyword overlap (20 points)', async () => {<br/>"
    "&nbsp;&nbsp;&nbsp;&nbsp;mockSystemSettingFindUnique.mockResolvedValueOnce({<br/>"
    "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;value: JSON.stringify({ targetIndustries: ['Financial Services'] })<br/>"
    "&nbsp;&nbsp;&nbsp;&nbsp;})<br/>"
    "&nbsp;&nbsp;&nbsp;&nbsp;mockDbFindUnique.mockResolvedValueOnce({<br/>"
    "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;id: 'c2', industry: 'Finance', sizeRange: null, country: null,<br/>"
    "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;accountPriorityScore: null, priorityTier: null<br/>"
    "&nbsp;&nbsp;&nbsp;&nbsp;})<br/>"
    "&nbsp;&nbsp;&nbsp;&nbsp;const result = await computeAccountPriority('c2')<br/>"
    "&nbsp;&nbsp;&nbsp;&nbsp;expect(result.priority.staticFit.industry).toBe(20)<br/>"
    "&nbsp;&nbsp;})<br/>"
    "&nbsp;&nbsp;it('returns neutral score (15) when ICP has no target industries', async () => {<br/>"
    "&nbsp;&nbsp;&nbsp;&nbsp;mockSystemSettingFindUnique.mockResolvedValueOnce({<br/>"
    "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;value: JSON.stringify({ targetIndustries: [] })<br/>"
    "&nbsp;&nbsp;&nbsp;&nbsp;})<br/>"
    "&nbsp;&nbsp;&nbsp;&nbsp;mockDbFindUnique.mockResolvedValueOnce({<br/>"
    "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;id: 'c3', industry: 'Unknown', sizeRange: null, country: null,<br/>"
    "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;accountPriorityScore: null, priorityTier: null<br/>"
    "&nbsp;&nbsp;&nbsp;&nbsp;})<br/>"
    "&nbsp;&nbsp;&nbsp;&nbsp;const result = await computeAccountPriority('c3')<br/>"
    "&nbsp;&nbsp;&nbsp;&nbsp;expect(result.priority.staticFit.industry).toBe(15)<br/>"
    "&nbsp;&nbsp;})<br/>"
    "})<br/><br/>"
    "describe('scoreTimingUrgency edge cases', () => {<br/>"
    "&nbsp;&nbsp;it('returns max signalRecency (40) for same-day signals', async () => {<br/>"
    "&nbsp;&nbsp;&nbsp;&nbsp;mockCompanySignalFindMany.mockResolvedValueOnce([{<br/>"
    "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;impact: 'high', signalDate: new Date().toISOString(), createdAt: new Date()<br/>"
    "&nbsp;&nbsp;&nbsp;&nbsp;}])<br/>"
    "&nbsp;&nbsp;&nbsp;&nbsp;const result = await computeAccountPriority('c1')<br/>"
    "&nbsp;&nbsp;&nbsp;&nbsp;expect(result.priority.timingUrgency.signalRecency).toBe(40)<br/>"
    "&nbsp;&nbsp;})<br/>"
    "&nbsp;&nbsp;it('returns min signalRecency (3) for very old signals (365+ days)', async () => {<br/>"
    "&nbsp;&nbsp;&nbsp;&nbsp;const oldDate = new Date(Date.now() - 400 * 86400000)<br/>"
    "&nbsp;&nbsp;&nbsp;&nbsp;mockCompanySignalFindMany.mockResolvedValueOnce([{<br/>"
    "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;impact: 'low', signalDate: oldDate.toISOString(), createdAt: oldDate<br/>"
    "&nbsp;&nbsp;&nbsp;&nbsp;}])<br/>"
    "&nbsp;&nbsp;&nbsp;&nbsp;const result = await computeAccountPriority('c1')<br/>"
    "&nbsp;&nbsp;&nbsp;&nbsp;expect(result.priority.timingUrgency.signalRecency).toBe(3)<br/>"
    "&nbsp;&nbsp;})<br/>"
    "})",
    code_style
))
story.append(PageBreak())

# ═══════════════════════════════════════════════════
# 7. REMEDIATION PRIORITY PLAN
# ═══════════════════════════════════════════════════
story.append(Paragraph('7. Remediation Priority Plan', h1_style))
story.append(Paragraph(
    'The following table outlines the recommended order for fixing all identified gaps. Items are grouped into '
    'three phases: Phase 1 (must complete before Ticket 4 can close), Phase 2 (should complete in the current sprint), '
    'and Phase 3 (backlog for future tickets).',
    body_style
))

phase_data = [
    [Paragraph('<b>Phase</b>', ParagraphStyle(name='ph', fontName='FreeSerif-Bold', fontSize=8, textColor=colors.white)),
     Paragraph('<b>Gap IDs</b>', ParagraphStyle(name='ph2', fontName='FreeSerif-Bold', fontSize=8, textColor=colors.white)),
     Paragraph('<b>Action</b>', ParagraphStyle(name='ph3', fontName='FreeSerif-Bold', fontSize=8, textColor=colors.white)),
     Paragraph('<b>Est. Effort</b>', ParagraphStyle(name='ph4', fontName='FreeSerif-Bold', fontSize=8, textColor=colors.white))],
    [Paragraph('1 - Must', ParagraphStyle(name='p1', fontName='FreeSerif-Bold', fontSize=8, textColor=SEM_ERROR)),
     Paragraph('C-1, H-14', ParagraphStyle(name='p1a', fontName='DejaVuSans', fontSize=7.5)),
     Paragraph('Rewrite scores/route.ts with utilityGuard + scrubError + Response.json', ParagraphStyle(name='p1b', fontName='FreeSerif', fontSize=8, leading=11)),
     Paragraph('2h', ParagraphStyle(name='p1c', fontName='FreeSerif', fontSize=8, alignment=TA_CENTER))],
    [Paragraph('1 - Must', ParagraphStyle(name='p2', fontName='FreeSerif-Bold', fontSize=8, textColor=SEM_ERROR)),
     Paragraph('C-2, H-6', ParagraphStyle(name='p2a', fontName='DejaVuSans', fontSize=7.5)),
     Paragraph('Replace tautological tests with actual route + engine integration tests', ParagraphStyle(name='p2b', fontName='FreeSerif', fontSize=8, leading=11)),
     Paragraph('3h', ParagraphStyle(name='p2c', fontName='FreeSerif', fontSize=8, alignment=TA_CENTER))],
    [Paragraph('1 - Must', ParagraphStyle(name='p3', fontName='FreeSerif-Bold', fontSize=8, textColor=SEM_ERROR)),
     Paragraph('C-3, C-4', ParagraphStyle(name='p3a', fontName='DejaVuSans', fontSize=7.5)),
     Paragraph('Fix AT_RISK classification + scrubError in revenue-score route', ParagraphStyle(name='p3b', fontName='FreeSerif', fontSize=8, leading=11)),
     Paragraph('1h', ParagraphStyle(name='p3c', fontName='FreeSerif', fontSize=8, alignment=TA_CENTER))],
    [Paragraph('1 - Must', ParagraphStyle(name='p4', fontName='FreeSerif-Bold', fontSize=8, textColor=SEM_ERROR)),
     Paragraph('H-1, H-4, H-12', ParagraphStyle(name='p4a', fontName='DejaVuSans', fontSize=7.5)),
     Paragraph('Tier normalization + fix "medium" fallback + category-to-tier mapping', ParagraphStyle(name='p4b', fontName='FreeSerif', fontSize=8, leading=11)),
     Paragraph('2h', ParagraphStyle(name='p4c', fontName='FreeSerif', fontSize=8, alignment=TA_CENTER))],
    [Paragraph('2 - Should', ParagraphStyle(name='p5', fontName='FreeSerif-Bold', fontSize=8, textColor=SEM_WARNING)),
     Paragraph('H-2, H-5, M-2', ParagraphStyle(name='p5a', fontName='DejaVuSans', fontSize=7.5)),
     Paragraph('Unify response types + extract shared breakdown parser + detect legacy format', ParagraphStyle(name='p5b', fontName='FreeSerif', fontSize=8, leading=11)),
     Paragraph('2h', ParagraphStyle(name='p5c', fontName='FreeSerif', fontSize=8, alignment=TA_CENTER))],
    [Paragraph('2 - Should', ParagraphStyle(name='p6', fontName='FreeSerif-Bold', fontSize=8, textColor=SEM_WARNING)),
     Paragraph('H-3, M-13', ParagraphStyle(name='p6a', fontName='DejaVuSans', fontSize=7.5)),
     Paragraph('Add legacy format detection + migration script + update ARCHITECTURE.md', ParagraphStyle(name='p6b', fontName='FreeSerif', fontSize=8, leading=11)),
     Paragraph('1.5h', ParagraphStyle(name='p6c', fontName='FreeSerif', fontSize=8, alignment=TA_CENTER))],
    [Paragraph('2 - Should', ParagraphStyle(name='p7', fontName='FreeSerif-Bold', fontSize=8, textColor=SEM_WARNING)),
     Paragraph('H-9, H-10', ParagraphStyle(name='p7a', fontName='DejaVuSans', fontSize=7.5)),
     Paragraph('Add Prisma enums for PriorityScoreHistory.priorityTier and AccountScore.category', ParagraphStyle(name='p7b', fontName='FreeSerif', fontSize=8, leading=11)),
     Paragraph('1h', ParagraphStyle(name='p7c', fontName='FreeSerif', fontSize=8, alignment=TA_CENTER))],
    [Paragraph('2 - Should', ParagraphStyle(name='p8', fontName='FreeSerif-Bold', fontSize=8, textColor=SEM_WARNING)),
     Paragraph('H-7, M-6, M-15', ParagraphStyle(name='p8a', fontName='DejaVuSans', fontSize=7.5)),
     Paragraph('Add include=scores integration tests + edge case tests', ParagraphStyle(name='p8b', fontName='FreeSerif', fontSize=8, leading=11)),
     Paragraph('1.5h', ParagraphStyle(name='p8c', fontName='FreeSerif', fontSize=8, alignment=TA_CENTER))],
    [Paragraph('2 - Should', ParagraphStyle(name='p9', fontName='FreeSerif-Bold', fontSize=8, textColor=SEM_WARNING)),
     Paragraph('H-11, H-12', ParagraphStyle(name='p9a', fontName='DejaVuSans', fontSize=7.5)),
     Paragraph('Add mobile ScoreTriple fallback + fix category display mapping', ParagraphStyle(name='p9b', fontName='FreeSerif', fontSize=8, leading=11)),
     Paragraph('1.5h', ParagraphStyle(name='p9c', fontName='FreeSerif', fontSize=8, alignment=TA_CENTER))],
    [Paragraph('3 - Later', ParagraphStyle(name='p10', fontName='FreeSerif-Bold', fontSize=8, textColor=SEM_INFO)),
     Paragraph('M-4, M-5, M-8', ParagraphStyle(name='p10a', fontName='DejaVuSans', fontSize=7.5)),
     Paragraph('Schema cleanup (deprecate Total fields, rename freshness, ICP-driven strategicFit)', ParagraphStyle(name='p10b', fontName='FreeSerif', fontSize=8, leading=11)),
     Paragraph('3h', ParagraphStyle(name='p10c', fontName='FreeSerif', fontSize=8, alignment=TA_CENTER))],
    [Paragraph('3 - Later', ParagraphStyle(name='p11', fontName='FreeSerif-Bold', fontSize=8, textColor=SEM_INFO)),
     Paragraph('H-8, H-13', ParagraphStyle(name='p11a', fontName='DejaVuSans', fontSize=7.5)),
     Paragraph('Decide revenue-opportunity-engine integration + document revenue types', ParagraphStyle(name='p11b', fontName='FreeSerif', fontSize=8, leading=11)),
     Paragraph('2h', ParagraphStyle(name='p11c', fontName='FreeSerif', fontSize=8, alignment=TA_CENTER))],
    [Paragraph('3 - Later', ParagraphStyle(name='p12', fontName='FreeSerif-Bold', fontSize=8, textColor=SEM_INFO)),
     Paragraph('M-1, L-1 through L-16', ParagraphStyle(name='p12a', fontName='DejaVuSans', fontSize=7.5)),
     Paragraph('All LOW + remaining MEDIUM gaps (color unification, aria labels, indexes)', ParagraphStyle(name='p12b', fontName='FreeSerif', fontSize=8, leading=11)),
     Paragraph('4h', ParagraphStyle(name='p12c', fontName='FreeSerif', fontSize=8, alignment=TA_CENTER))],
]

phase_table = Table(phase_data, colWidths=[2.2*cm, 3.5*cm, 7.5*cm, 2*cm], repeatRows=1)
phase_style_cmds = [
    ('BACKGROUND', (0, 0), (-1, 0), HEADER_FILL),
    ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
    ('GRID', (0, 0), (-1, -1), 0.5, BORDER_COLOR),
    ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ('TOPPADDING', (0, 0), (-1, -1), 4),
    ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ('LEFTPADDING', (0, 0), (-1, -1), 4),
    ('RIGHTPADDING', (0, 0), (-1, -1), 4),
]
for i in range(1, len(phase_data)):
    if i % 2 == 0:
        phase_style_cmds.append(('BACKGROUND', (0, i), (-1, i), TABLE_STRIPE))
phase_table.setStyle(TableStyle(phase_style_cmds))
story.append(phase_table)

story.append(Spacer(1, 16))
story.append(Paragraph('Total Estimated Effort: 24.5 hours across 3 phases', ParagraphStyle(
    name='effort', fontName='FreeSerif-Bold', fontSize=10, textColor=ACCENT, alignment=TA_CENTER
)))
story.append(Spacer(1, 8))
story.append(Paragraph(
    'Phase 1 (8 hours) is the minimum required to close Ticket 4. Phases 2 and 3 should be scheduled '
    'in the following sprint cycles but are not blockers for the Ticket 4 completion gate.',
    ParagraphStyle(name='effort-note', fontName='FreeSerif-Italic', fontSize=9, textColor=TEXT_MUTED, alignment=TA_CENTER)
))

# ═══════════════════════════════════════════════════
# 8. CROSS-FILE REFERENCE MAP
# ═══════════════════════════════════════════════════
story.append(Paragraph('8. Cross-File Reference Map', h1_style))
story.append(Paragraph(
    'This map shows how the three scoring systems connect (or fail to connect) across the codebase. '
    'Understanding these data flows is essential for fixing the architectural gaps identified above.',
    body_style
))

ref_data = [
    [Paragraph('<b>Score System</b>', ParagraphStyle(name='rh', fontName='FreeSerif-Bold', fontSize=8, textColor=colors.white)),
     Paragraph('<b>Engine</b>', ParagraphStyle(name='rh2', fontName='FreeSerif-Bold', fontSize=8, textColor=colors.white)),
     Paragraph('<b>Storage</b>', ParagraphStyle(name='rh3', fontName='FreeSerif-Bold', fontSize=8, textColor=colors.white)),
     Paragraph('<b>API Endpoint</b>', ParagraphStyle(name='rh4', fontName='FreeSerif-Bold', fontSize=8, textColor=colors.white)),
     Paragraph('<b>Frontend</b>', ParagraphStyle(name='rh5', fontName='FreeSerif-Bold', fontSize=8, textColor=colors.white))],
    [Paragraph('Intelligence', ParagraphStyle(name='r1', fontName='FreeSerif-Bold', fontSize=8)),
     Paragraph('intelligence-contract.ts', ParagraphStyle(name='r1a', fontName='DejaVuSans', fontSize=7)),
     Paragraph('Company.intelligenceScore', ParagraphStyle(name='r1b', fontName='DejaVuSans', fontSize=7)),
     Paragraph('/api/intelligence/company/{id}?include=scores', ParagraphStyle(name='r1c', fontName='DejaVuSans', fontSize=7)),
     Paragraph('ScoreTriple + ScoreGauge', ParagraphStyle(name='r1d', fontName='DejaVuSans', fontSize=7))],
    [Paragraph('Account Priority', ParagraphStyle(name='r2', fontName='FreeSerif-Bold', fontSize=8)),
     Paragraph('engine.ts', ParagraphStyle(name='r2a', fontName='DejaVuSans', fontSize=7)),
     Paragraph('Company.accountPriorityScore + PriorityScoreHistory', ParagraphStyle(name='r2b', fontName='DejaVuSans', fontSize=7)),
     Paragraph('/api/companies/{id}/scores', ParagraphStyle(name='r2c', fontName='DejaVuSans', fontSize=7)),
     Paragraph('ScoreTriple', ParagraphStyle(name='r2d', fontName='DejaVuSans', fontSize=7))],
    [Paragraph('Revenue (Active)', ParagraphStyle(name='r3', fontName='FreeSerif-Bold', fontSize=8)),
     Paragraph('account-scoring.ts', ParagraphStyle(name='r3a', fontName='DejaVuSans', fontSize=7)),
     Paragraph('AccountScore table', ParagraphStyle(name='r3b', fontName='DejaVuSans', fontSize=7)),
     Paragraph('/api/companies/{id}/scores', ParagraphStyle(name='r3c', fontName='DejaVuSans', fontSize=7)),
     Paragraph('ScoreTriple', ParagraphStyle(name='r3d', fontName='DejaVuSans', fontSize=7))],
    [Paragraph('Revenue (Legacy)', ParagraphStyle(name='r4', fontName='FreeSerif-Bold', fontSize=8, textColor=SEM_ERROR)),
     Paragraph('account-scorer.ts (DEPRECATED)', ParagraphStyle(name='r4a', fontName='DejaVuSans', fontSize=7)),
     Paragraph('AccountScore table (WRONG FORMAT)', ParagraphStyle(name='r4b', fontName='DejaVuSans', fontSize=7, textColor=SEM_ERROR)),
     Paragraph('None (orphaned)', ParagraphStyle(name='r4c', fontName='DejaVuSans', fontSize=7, textColor=SEM_ERROR)),
     Paragraph('None', ParagraphStyle(name='r4d', fontName='DejaVuSans', fontSize=7, textColor=SEM_ERROR))],
    [Paragraph('Revenue (AI Deep)', ParagraphStyle(name='r5', fontName='FreeSerif-Bold', fontSize=8, textColor=SEM_WARNING)),
     Paragraph('revenue-opportunity-engine.ts', ParagraphStyle(name='r5a', fontName='DejaVuSans', fontSize=7)),
     Paragraph('AIInsight only', ParagraphStyle(name='r5b', fontName='DejaVuSans', fontSize=7)),
     Paragraph('/api/ai/revenue-score', ParagraphStyle(name='r5c', fontName='DejaVuSans', fontSize=7)),
     Paragraph('None (not in ScoreTriple)', ParagraphStyle(name='r5d', fontName='DejaVuSans', fontSize=7, textColor=SEM_WARNING))],
]

ref_table = Table(ref_data, colWidths=[2.8*cm, 3.5*cm, 3.5*cm, 4.2*cm, 3*cm], repeatRows=1)
ref_style_cmds = [
    ('BACKGROUND', (0, 0), (-1, 0), HEADER_FILL),
    ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
    ('GRID', (0, 0), (-1, -1), 0.5, BORDER_COLOR),
    ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ('TOPPADDING', (0, 0), (-1, -1), 4),
    ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ('LEFTPADDING', (0, 0), (-1, -1), 4),
    ('RIGHTPADDING', (0, 0), (-1, -1), 4),
    ('BACKGROUND', (0, 4), (-1, 4), colors.HexColor('#FEE2E2')),
    ('BACKGROUND', (0, 5), (-1, 5), colors.HexColor('#FEF3C7')),
]
ref_table.setStyle(TableStyle(ref_style_cmds))
story.append(ref_table)

# ═══════════════════════════════════════════════════
# BUILD
# ═══════════════════════════════════════════════════
doc.build(story)
print(f'PDF generated: {OUTPUT}')
print(f'Pages: check manually')
