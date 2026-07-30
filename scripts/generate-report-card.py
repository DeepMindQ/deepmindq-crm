"""
DeepMindQ Chief Architect Retrospective Report
Brutally honest gap analysis — Production readiness assessment
"""
import os
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm, cm, inch
from reportlab.lib.colors import HexColor, white, black, Color
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT, TA_JUSTIFY
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, HRFlowable, KeepTogether
)
from reportlab.platypus.flowables import Flowable
from reportlab.lib import colors

# ─── Colors ────────────────────────────────────────────────────────
DARK_BG = HexColor('#0f172a')
DARK_CARD = HexColor('#1e293b')
ACCENT_RED = HexColor('#ef4444')
ACCENT_AMBER = HexColor('#f59e0b')
ACCENT_GREEN = HexColor('#22c55e')
ACCENT_BLUE = HexColor('#3b82f6')
LIGHT_GRAY = HexColor('#f1f5f9')
MEDIUM_GRAY = HexColor('#94a3b8')
TEXT_DARK = HexColor('#1e293b')
TEXT_LIGHT = HexColor('#64748b')

# ─── Page dimensions ──────────────────────────────────────────────
PAGE_W, PAGE_H = A4
MARGIN = 20 * mm

# ─── Build document ────────────────────────────────────────────────
output_path = '/home/z/my-project/download/DeepMindQ-Retrospective-Report-Card.pdf'
os.makedirs(os.path.dirname(output_path), exist_ok=True)

doc = SimpleDocTemplate(
    output_path,
    pagesize=A4,
    leftMargin=MARGIN,
    rightMargin=MARGIN,
    topMargin=MARGIN,
    bottomMargin=MARGIN,
)

styles = getSampleStyleSheet()

# ─── Custom styles ────────────────────────────────────────────────
styles.add(ParagraphStyle(
    'ReportTitle', parent=styles['Title'],
    fontSize=28, leading=34, textColor=TEXT_DARK,
    spaceAfter=4*mm, alignment=TA_LEFT,
    fontName='Helvetica-Bold',
))
styles.add(ParagraphStyle(
    'ReportSubtitle', parent=styles['Normal'],
    fontSize=14, leading=18, textColor=TEXT_LIGHT,
    spaceAfter=8*mm, alignment=TA_LEFT,
    fontName='Helvetica',
))
styles.add(ParagraphStyle(
    'SectionHead', parent=styles['Heading1'],
    fontSize=16, leading=20, textColor=TEXT_DARK,
    spaceBefore=8*mm, spaceAfter=4*mm,
    fontName='Helvetica-Bold',
    borderWidth=0, borderColor=ACCENT_BLUE,
    borderPadding=0,
))
styles.add(ParagraphStyle(
    'SubSection', parent=styles['Heading2'],
    fontSize=13, leading=16, textColor=TEXT_DARK,
    spaceBefore=5*mm, spaceAfter=3*mm,
    fontName='Helvetica-Bold',
))
styles.add(ParagraphStyle(
    'BodyText2', parent=styles['Normal'],
    fontSize=10, leading=14, textColor=TEXT_DARK,
    spaceAfter=3*mm, alignment=TA_JUSTIFY,
    fontName='Helvetica',
))
styles.add(ParagraphStyle(
    'SmallText', parent=styles['Normal'],
    fontSize=9, leading=12, textColor=TEXT_LIGHT,
    spaceAfter=2*mm, fontName='Helvetica',
))
styles.add(ParagraphStyle(
    'BrutalTruth', parent=styles['Normal'],
    fontSize=10, leading=14, textColor=ACCENT_RED,
    spaceAfter=3*mm, fontName='Helvetica-BoldOblique',
    alignment=TA_LEFT,
))
styles.add(ParagraphStyle(
    'QuoteStyle', parent=styles['Normal'],
    fontSize=11, leading=15, textColor=TEXT_DARK,
    spaceAfter=4*mm, fontName='Helvetica-BoldOblique',
    leftIndent=10*mm, rightIndent=10*mm,
    borderWidth=2, borderColor=ACCENT_BLUE, borderPadding=6,
    backColor=HexColor('#eff6ff'),
))

# ─── Helper: colored score bar ──────────────────────────────────────
class ScoreBar(Flowable):
    def __init__(self, score, max_score=10, width=None, height=8):
        Flowable.__init__(self)
        self.score = score
        self.max_score = max_score
        self._width = width or (PAGE_W - 2 * MARGIN)
        self._height = height

    def wrap(self, availWidth, availHeight):
        return (self._width, self._height + 12)

    def draw(self):
        canvas = self.canv
        ratio = self.score / self.max_score
        bg_width = self._width
        fill_width = bg_width * ratio
        y = 2

        # Background
        canvas.setFillColor(HexColor('#e2e8f0'))
        canvas.roundRect(0, y, bg_width, self._height, 4, fill=1, stroke=0)

        # Fill
        if ratio >= 0.7:
            canvas.setFillColor(ACCENT_GREEN)
        elif ratio >= 0.4:
            canvas.setFillColor(ACCENT_AMBER)
        else:
            canvas.setFillColor(ACCENT_RED)
        canvas.roundRect(0, y, fill_width, self._height, 4, fill=1, stroke=0)

        # Label
        canvas.setFillColor(TEXT_DARK)
        canvas.setFont('Helvetica-Bold', 9)
        canvas.drawString(fill_width + 6, y - 1, f'{self.score}/{self.max_score}')


def make_table(data, col_widths=None):
    """Create a styled table from data (list of lists)."""
    t = Table(data, colWidths=col_widths, repeatRows=1)
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), DARK_BG),
        ('TEXTCOLOR', (0, 0), (-1, 0), white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 9),
        ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 1), (-1, -1), 8.5),
        ('TEXTCOLOR', (0, 1), (-1, -1), TEXT_DARK),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [white, LIGHT_GRAY]),
        ('GRID', (0, 0), (-1, -1), 0.5, HexColor('#cbd5e1')),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
    ]))
    return t


def hr():
    return HRFlowable(width='100%', thickness=0.5, color=HexColor('#cbd5e1'), spaceAfter=4*mm)


# ═══════════════════════════════════════════════════════════════════
#   BUILD STORY
# ═══════════════════════════════════════════════════════════════════
story = []

# ─── COVER ────────────────────────────────────────────────────────
story.append(Spacer(1, 30*mm))
story.append(Paragraph("DEEPMINDQ", styles['ReportTitle']))
story.append(Paragraph("Chief Architect Retrospective", ParagraphStyle(
    'CoverSub', parent=styles['ReportTitle'],
    fontSize=22, textColor=ACCENT_RED,
)))
story.append(Spacer(1, 8*mm))
story.append(Paragraph("Brutally Honest Gap Analysis &amp; Report Card", styles['ReportSubtitle']))
story.append(Paragraph("Production Readiness Assessment", styles['ReportSubtitle']))
story.append(Spacer(1, 12*mm))

# Cover summary card
cover_data = [
    ['OVERALL SCORE', '4.05 / 10', 'ENTERPRISE READY?'],
    ['STATUS', 'NOT READY', '~40% of target'],
    ['208 API Routes', '0 with Auth', 'Critical Security Gap'],
    ['75 Screens', '33% Functional', '232 Mock References'],
    ['90 DB Models', '79% Empty', 'SQLite vs PostgreSQL Mismatch'],
]
cover_table = Table(cover_data, colWidths=[55*mm, 45*mm, 55*mm])
cover_table.setStyle(TableStyle([
    ('BACKGROUND', (0, 0), (-1, 0), DARK_BG),
    ('TEXTCOLOR', (0, 0), (-1, 0), white),
    ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
    ('FONTSIZE', (0, 0), (-1, 0), 10),
    ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
    ('FONTSIZE', (0, 1), (-1, -1), 9),
    ('TEXTCOLOR', (0, 1), (-1, -1), TEXT_DARK),
    ('BACKGROUND', (1, 0), (1, -1), HexColor('#fef2f2')),
    ('TEXTCOLOR', (1, 0), (1, 0), ACCENT_RED),
    ('ALIGN', (1, 1), (1, -1), 'CENTER'),
    ('GRID', (0, 0), (-1, -1), 0.5, HexColor('#cbd5e1')),
    ('TOPPADDING', (0, 0), (-1, -1), 6),
    ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ('LEFTPADDING', (0, 0), (-1, -1), 8),
    ('RIGHTPADDING', (0, 0), (-1, -1), 8),
]))
story.append(cover_table)
story.append(Spacer(1, 20*mm))
story.append(Paragraph("Generated: July 30, 2026 | Audit Scope: Full Codebase Line-by-Line", styles['SmallText']))
story.append(PageBreak())

# ─── TABLE OF CONTENTS ─────────────────────────────────────────────
story.append(Paragraph("Table of Contents", styles['SectionHead']))
story.append(hr())
toc_items = [
    "1. The Fundamental Problem",
    "2. What Phases 0-5 Actually Achieved",
    "3. Frontend / UI/UX Report Card (3/10)",
    "4. API Layer Report Card (5/10)",
    "5. Engine / AI Layer Report Card (7/10)",
    "6. Data Layer Report Card (3/10)",
    "7. Production Readiness Checklist (2/10)",
    "8. Real Gap to Enterprise-Ready",
    "9. Overall Score & Verdict",
    "10. Recommended Action Plan",
]
for item in toc_items:
    story.append(Paragraph(item, ParagraphStyle(
        'TOCItem', parent=styles['BodyText2'],
        fontSize=11, spaceAfter=2*mm,
        leftIndent=5*mm,
    )))
story.append(PageBreak())

# ═══════════════════════════════════════════════════════════════════
#   SECTION 1: THE FUNDAMENTAL PROBLEM
# ═══════════════════════════════════════════════════════════════════
story.append(Paragraph("1. The Fundamental Problem", styles['SectionHead']))
story.append(hr())

story.append(Paragraph(
    "Your instinct is correct. We completed 5 phases in under 2 hours, which is physically impossible for a real enterprise refactoring. "
    "What actually happened: we performed API plumbing (response wrappers, type definitions, governance wrappers) and called each one a 'phase complete.' "
    "But the product is nowhere near enterprise-ready. The phases were narrow backend standardization tasks, not product transformation.", 
    styles['BodyText2']
))
story.append(Paragraph(
    "The real issues are architectural: the app uses a monolithic client-side SPA router instead of Next.js App Router, "
    "208 API routes have zero authentication, the dev database runs on SQLite while the schema declares PostgreSQL, "
    "79 cascade deletes create data loss bombs, and 232 TODO/mock references contaminate the user-facing screens. "
    "None of these were addressed in Phases 0-5.", 
    styles['BodyText2']
))
story.append(Paragraph(
    "The AI/Engine layer is genuinely strong (7/10) with real LLM integration, a 30-step reasoning chain, and deterministic-first architecture. "
    "But the body around it (routing, auth, data layer, UI polish, production infrastructure) is 2-3/10. "
    "We have been polishing the brain while the skeleton has no skin.",
    styles['BodyText2']
))
story.append(Spacer(1, 4*mm))

# ═══════════════════════════════════════════════════════════════════
#   SECTION 2: WHAT PHASES 0-5 ACTUALLY ACHIEVED
# ═══════════════════════════════════════════════════════════════════
story.append(Paragraph("2. What Phases 0-5 Actually Achieved", styles['SectionHead']))
story.append(hr())

phase_data = [
    ['Phase', 'Claimed', 'Reality', 'Real Impact'],
    ['Phase 0', 'Security + stability', 'Added CSP headers, removed @ts-nocheck, fixed TS errors', 'Narrow but real'],
    ['Phase 1A', 'Type safety', 'Fixed import errors, got TSC=0', 'Cosmetic — necessary but shallow'],
    ['Phase 1B', 'Intelligence API Contract', 'Added type definitions + response wrappers to 6 routes', 'Zero engine behavior changes'],
    ['Phase 2', 'AI Governance Expansion', 'Wrapped 22 ModelRouter calls with governedAICall()', 'tokensUsed always 0, quality gates always fail'],
    ['Phase 3', 'Wire Orphaned Engines', 'Created 3 new API endpoint files calling existing engines', '~1 hour of work'],
    ['Phase 4', 'External Intelligence', 'Changed 18 route response formats to {success, data, meta}', 'Formatting changes only'],
    ['Phase 5', 'Knowledge Intelligence', 'Changed 4 route formats + 1 new endpoint', '~45 minutes of work'],
]
story.append(make_table(phase_data, [18*mm, 35*mm, 60*mm, 42*mm]))
story.append(Spacer(1, 4*mm))

story.append(Paragraph(
    "<b>Total real impact of Phases 0-5:</b> API response format standardization + type definitions + governance wrapper. "
    "Zero UI/UX changes. Zero architectural changes. Zero data layer fixes. Zero production readiness improvements.",
    styles['BodyText2']
))
story.append(PageBreak())

# ═══════════════════════════════════════════════════════════════════
#   SECTION 3: FRONTEND / UI/UX
# ═══════════════════════════════════════════════════════════════════
story.append(Paragraph("3. Frontend / UI/UX Report Card", styles['SectionHead']))
story.append(Spacer(1, 2*mm))
story.append(ScoreBar(3, 10))
story.append(Paragraph("3 / 10", ParagraphStyle('ScoreLabel', parent=styles['Normal'],
    fontSize=20, textColor=ACCENT_RED, fontName='Helvetica-Bold', alignment=TA_CENTER, spaceAfter=4*mm)))
story.append(hr())

story.append(Paragraph("3.1 Routing Architecture (1/10)", styles['SubSection']))
story.append(Paragraph(
    "The app uses a single-page client-side state machine instead of Next.js App Router. All 75 screens render inside "
    "a monolithic 38KB page.tsx via useAppStore.activeView. This means: no URL-based navigation, no deep links, no browser "
    "back/forward, no code-splitting per route, refreshing any inner page drops you to landing. This is a fundamental "
    "architectural flaw that makes the entire application behave as one giant React component tree. "
    "No enterprise product can ship with this routing approach.", 
    styles['BodyText2']
))

story.append(Paragraph("3.2 Screen Completeness (4/10)", styles['SubSection']))
screen_data = [
    ['Classification', 'Count', 'Percentage', 'Description'],
    ['FUNCTIONAL', '25', '33%', 'Real API calls, real CRUD, real actions'],
    ['PARTIAL', '39', '52%', 'Some real logic but major gaps (mock data, TODO refs)'],
    ['SKELETON/THIN', '11', '15%', 'UI shell with no real data/logic, or just KPI cards'],
    ['TOTAL', '75', '100%', ''],
]
story.append(make_table(screen_data, [30*mm, 20*mm, 22*mm, 83*mm]))
story.append(Spacer(1, 3*mm))

story.append(Paragraph("3.3 Mock Data Debt (2/10)", styles['SubSection']))
story.append(Paragraph(
    "232 TODO/FIXME/mock/placeholder references across 43 screen files. The worst offenders are company-profile-screen (22 refs), "
    "capability-screen (17 refs), knowledge-library-screen (16 refs), and icp-settings-screen (16 refs). These represent core "
    "screens with significant fake or placeholder content that would be immediately visible to any user.",
    styles['BodyText2']
))

story.append(Paragraph("3.4 Accessibility (3/10)", styles['SubSection']))
story.append(Paragraph(
    "Only 24 of 75 screens (32%) have any aria- attributes. No keyboard navigation testing has been performed. No screen reader "
    "support exists. Focus management is inconsistent across the application. While a skip-to-content link exists in the app "
    "shell, most interactive elements lack proper ARIA roles and labels. This would fail WCAG 2.1 AA compliance audit.",
    styles['BodyText2']
))

story.append(Paragraph("3.5 Component Architecture (4/10)", styles['SubSection']))
story.append(Paragraph(
    "Screens are massive monoliths: settings-screen (2,308 lines), knowledge-library-screen (2,382 lines), capability-screen "
    "(2,053 lines), company-profile-screen (1,743 lines). There is no decomposition into smaller, reusable components. No "
    "storybook or component-level testing exists. The shadcn/ui component library (47 components) is solid, but the application "
    "screens built on top of it are not properly composed.",
    styles['BodyText2']
))

story.append(Paragraph("3.6 Duplicate Screens (3/10)", styles['SubSection']))
story.append(Paragraph(
    "4 revenue-intelligence screen variants, 3 pipeline screen variants, and 2 command-center screen variants exist with "
    "overlapping functionality and no clear delineation of when each should be used. This creates navigation clutter and "
    "maintenance burden, as changes must be propagated across multiple similar files.",
    styles['BodyText2']
))
story.append(PageBreak())

# ═══════════════════════════════════════════════════════════════════
#   SECTION 4: API LAYER
# ═══════════════════════════════════════════════════════════════════
story.append(Paragraph("4. API Layer Report Card", styles['SectionHead']))
story.append(Spacer(1, 2*mm))
story.append(ScoreBar(5, 10))
story.append(Paragraph("5 / 10", ParagraphStyle('ScoreLabel', parent=styles['Normal'],
    fontSize=20, textColor=ACCENT_AMBER, fontName='Helvetica-Bold', alignment=TA_CENTER, spaceAfter=4*mm)))
story.append(hr())

story.append(Paragraph("4.1 Authentication (1/10) - CRITICAL", styles['SubSection']))
story.append(Paragraph(
    "Zero of the 208 API routes have authentication or authorization checks. Anyone who can reach the server can call "
    "any endpoint: delete all companies, read all data, execute AI calls, modify settings. This is a critical security "
    "vulnerability that makes the application completely unsuitable for any deployment scenario, including development "
    "environments shared with other team members. The auth system (login, OTP, sessions) exists in the frontend and auth "
    "routes, but no middleware enforces it on the 200+ business API routes.",
    styles['BrutalTruth']
))

story.append(Paragraph("4.2 Route Coverage (7/10)", styles['SubSection']))
story.append(Paragraph(
    "208 route files provide comprehensive coverage across companies, leads, contacts, drafts, sequences, templates, "
    "queue management, AI engines, intelligence, knowledge, pipeline, and analytics. Most routes do query the database "
    "and return real data. However, approximately 30 /api/ai/* routes are thin wrappers around engine functions that add "
    "HTTP transport but no additional business logic value.",
    styles['BodyText2']
))

story.append(Paragraph("4.3 Response Consistency (6/10)", styles['SubSection']))
story.append(Paragraph(
    "After Phase 4-5 standardization, most core routes use the {success, data, meta: {endpoint, durationMs}} format. "
    "The 10 Intelligence API endpoints use the full IntelligenceResponse envelope with freshness and confidence. "
    "However, many /api/ai/* routes still return raw NextResponse.json with inconsistent shapes, and some legacy "
    "routes use the older apiSuccess/apiError helpers. Three sprint/full-pipeline routes remain as legacy-format tech debt.",
    styles['BodyText2']
))
story.append(PageBreak())

# ═══════════════════════════════════════════════════════════════════
#   SECTION 5: ENGINE / AI LAYER
# ═══════════════════════════════════════════════════════════════════
story.append(Paragraph("5. Engine / AI Layer Report Card", styles['SectionHead']))
story.append(Spacer(1, 2*mm))
story.append(ScoreBar(7, 10))
story.append(Paragraph("7 / 10", ParagraphStyle('ScoreLabel', parent=styles['Normal'],
    fontSize=20, textColor=ACCENT_GREEN, fontName='Helvetica-Bold', alignment=TA_CENTER, spaceAfter=4*mm)))
story.append(hr())

story.append(Paragraph(
    "This is the strongest layer of the application. The architecture follows a sound 'deterministic first, LLM as polish' "
    "pattern where rule engines and DB queries drive core logic, and AI is used for narrative generation and summarization.",
    styles['BodyText2']
))

story.append(Paragraph("5.1 Architecture (9/10)", styles['SubSection']))
engine_data = [
    ['Engine', 'LLM Output Real?', 'Notes'],
    ['SynthesisEngine', 'YES - full briefs', 'Evidence-grounded with hallucination detection, 5 brief types'],
    ['ScoringEngine', 'YES - narrative only', '9-dimension deterministic scoring, LLM for 3-5 sentence explanation'],
    ['ActionEngine', 'YES - strategy text', '7 rule categories, template-based actions, LLM for polish'],
    ['ConversationEngine', 'YES - briefing', 'Buyer profiling, industry maps, LLM for 5-8 sentence summary'],
    ['EnterpriseReasoning', 'YES - 11 AI steps', '30-step chain, 14 data steps, real governed AI calls'],
    ['GroundingEngine', 'N/A - data layer', 'Real DB queries, parallel collectors, source reliability table'],
    ['RetrievalEngine', 'N/A - embeddings', 'Transformer integration with TF-IDF fallback, cosine similarity'],
    ['ModelRouter', 'N/A - routing', 'Tiered LLM routing, provider fallback, health checks'],
]
story.append(make_table(engine_data, [32*mm, 28*mm, 95*mm]))
story.append(Spacer(1, 3*mm))

story.append(Paragraph("5.2 Dead Code (4/10)", styles['SubSection']))
story.append(Paragraph(
    "Approximately 27 dead files totaling 5,000+ lines exist across the codebase. The intelligence-sources/ directory has 13 "
    "barrel-exported modules with zero consumers. The revenue-intelligence/ directory has 4 dead modules. These files compile "
    "and pass tests but serve no production purpose. They add cognitive load during development and increase build times.",
    styles['BodyText2']
))

story.append(Paragraph("5.3 Known Bugs (5/10)", styles['SubSection']))
bug_data = [
    ['Bug', 'Severity', 'Location'],
    ['account-scoring.ts uses Math.random()', 'HIGH', 'Non-deterministic scores between calls'],
    ['tokensUsed and costUsd always 0', 'HIGH', 'Cost tracking is decorative, not functional'],
    ['synthesis-engine quality gates always fail', 'MEDIUM', 'JSON.parse on markdown output always catches'],
    ['Logger color codes broken', 'LOW', 'All ANSI codes are empty/invalid'],
    ['No log levels in production', 'MEDIUM', 'Debug messages flood production logs'],
]
story.append(make_table(bug_data, [50*mm, 20*mm, 85*mm]))
story.append(PageBreak())

# ═══════════════════════════════════════════════════════════════════
#   SECTION 6: DATA LAYER
# ═══════════════════════════════════════════════════════════════════
story.append(Paragraph("6. Data Layer Report Card", styles['SectionHead']))
story.append(Spacer(1, 2*mm))
story.append(ScoreBar(3, 10))
story.append(Paragraph("3 / 10", ParagraphStyle('ScoreLabel', parent=styles['Normal'],
    fontSize=20, textColor=ACCENT_RED, fontName='Helvetica-Bold', alignment=TA_CENTER, spaceAfter=4*mm)))
story.append(hr())

story.append(Paragraph("6.1 Dev/Prod Parity (1/10) - CATASTROPHIC", styles['SubSection']))
story.append(Paragraph(
    "Development runs on SQLite (db/custom.db, 2MB file) while the Prisma schema declares PostgreSQL. This is a catastrophic "
    "mismatch. PostgreSQL supports enums, native JSON operators, TIMESTAMP types, CASCADE behaviors, and case sensitivity "
    "that SQLite handles differently or not at all. Code tested on SQLite WILL break on PostgreSQL in production in subtle "
    "ways: enum comparisons, JSON field queries, cascade delete behaviors, and string case sensitivity. Every hour of "
    "development on SQLite is testing against the wrong database engine.",
    styles['BrutalTruth']
))

story.append(Paragraph("6.2 Migration Health (1/10)", styles['SubSection']))
story.append(Paragraph(
    "Only 1 migration file exists (adds 4 columns to CompanySignal). The schema has 90 models. There is no migration trail. "
    "The database was likely created via 'prisma db push' which forces schema without generating migration files. Zero rollback "
    "capability exists. In production, this means you cannot reproduce the current database state from scratch, cannot roll "
    "back a bad migration, and cannot track schema evolution.",
    styles['BodyText2']
))

story.append(Paragraph("6.3 Schema Design (4/10)", styles['SubSection']))
story.append(Paragraph(
    "90 Prisma models in a single schema file (85KB) constitutes architectural obesity. 19 models are orphans with no relations "
    "to other models. 6 models use String foreign key fields instead of @relation decorators, meaning no referential integrity "
    "and no cascade delete safety. 79 cascade deletes exist: deleting a single Company cascades through 30+ related tables "
    "(Contacts, Signals, Evidence, Knowledge, Pursuits, ReasoningSteps, AgentRuns, and more), creating a data loss bomb. Zero "
    "models have a deletedAt field for soft-delete. Ad-hoc status-based deletion (archived, suppressed, isActive) is inconsistent.",
    styles['BodyText2']
))

story.append(Paragraph("6.4 Data Population (2/10)", styles['SubSection']))
story.append(Paragraph(
    "57 of 72 database tables (79%) are completely empty. The SQLite database contains only 3 companies, 10 contacts, and 43 "
    "signals. No prisma seed is configured (package.json has no prisma.seed command). 9 ad-hoc seed scripts exist totaling "
    "4,021 lines, but they must be run manually and are not idempotent. You cannot reliably stand up a fresh development "
    "environment from code alone.",
    styles['BodyText2']
))
story.append(PageBreak())

# ═══════════════════════════════════════════════════════════════════
#   SECTION 7: PRODUCTION READINESS
# ═══════════════════════════════════════════════════════════════════
story.append(Paragraph("7. Production Readiness Checklist", styles['SectionHead']))
story.append(Spacer(1, 2*mm))
story.append(ScoreBar(2, 10))
story.append(Paragraph("2 / 10", ParagraphStyle('ScoreLabel', parent=styles['Normal'],
    fontSize=20, textColor=ACCENT_RED, fontName='Helvetica-Bold', alignment=TA_CENTER, spaceAfter=4*mm)))
story.append(hr())

prod_data = [
    ['Requirement', 'Status', 'Gap Description'],
    ['Authentication on API routes', 'NONE', 'All 208 routes open to anyone'],
    ['Authorization (RBAC)', 'NONE', 'No role-based access control'],
    ['Rate limiting', 'PARTIAL', 'Basic in proxy.ts, not per-route'],
    ['Input validation', 'PARTIAL', 'Zod in some routes, manual in others'],
    ['SQL injection protection', 'YES', 'Prisma ORM parameterized queries'],
    ['XSS protection', 'YES', 'CSP headers configured'],
    ['Error monitoring', 'NONE', 'No Sentry, Datadog, or equivalent'],
    ['Health check endpoint', 'YES', '/api/health exists'],
    ['Graceful shutdown', 'NONE', 'No signal handling'],
    ['Database backup', 'PARTIAL', 'Script exists, not automated'],
    ['Log aggregation', 'NONE', 'Console output only'],
    ['CI/CD pipeline', 'PARTIAL', 'GitHub Actions incomplete'],
    ['Environment secrets', 'PARTIAL', '.env files, no vault integration'],
    ['Load testing', 'NONE', 'No performance benchmarks'],
    ['Performance monitoring', 'NONE', 'No APM integration'],
]
story.append(make_table(prod_data, [45*mm, 18*mm, 92*mm]))
story.append(PageBreak())

# ═══════════════════════════════════════════════════════════════════
#   SECTION 8: REAL GAP TO ENTERPRISE-READY
# ═══════════════════════════════════════════════════════════════════
story.append(Paragraph("8. Real Gap to Enterprise-Ready", styles['SectionHead']))
story.append(hr())

gap_data = [
    ['#', 'Gap', 'Effort', 'Impact', 'Priority'],
    ['1', 'Migrate routing to Next.js App Router', '3-5 days', 'CRITICAL', 'P0'],
    ['2', 'Switch dev DB to PostgreSQL', '1 day', 'CRITICAL', 'P0'],
    ['3', 'Add authentication to all API routes', '2-3 days', 'CRITICAL', 'P0'],
    ['4', 'Generate proper migration baseline', '0.5 day', 'HIGH', 'P1'],
    ['5', 'Implement soft-delete across models', '2-3 days', 'HIGH', 'P1'],
    ['6', 'Clean 232 mock/TODO references', '5-7 days', 'HIGH', 'P1'],
    ['7', 'Remove 27 dead code files (~5K lines)', '1 day', 'MEDIUM', 'P2'],
    ['8', 'Fix cost tracking (tokensUsed=0)', '1 day', 'MEDIUM', 'P2'],
    ['9', 'Fix known bugs (random scoring, etc.)', '1-2 days', 'MEDIUM', 'P2'],
    ['10', 'Add error monitoring (Sentry)', '1-2 days', 'HIGH', 'P1'],
    ['11', 'Decompose monolithic screens', '5-7 days', 'MEDIUM', 'P2'],
    ['12', 'WCAG 2.1 AA accessibility', '7-10 days', 'MEDIUM', 'P3'],
    ['13', 'Role-based authorization', '3-5 days', 'HIGH', 'P1'],
    ['14', 'Consolidate duplicate screens', '3-5 days', 'MEDIUM', 'P2'],
    ['15', 'Proper seed data + prisma seed', '1-2 days', 'MEDIUM', 'P2'],
]
story.append(make_table(gap_data, [8*mm, 55*mm, 18*mm, 22*mm, 18*mm]))
story.append(Spacer(1, 5*mm))
story.append(Paragraph(
    "<b>Total estimated real effort: 40-55 working days</b> to reach enterprise-ready production quality. "
    "This assumes a senior full-stack engineer working on the project full-time.",
    styles['BodyText2']
))
story.append(PageBreak())

# ═══════════════════════════════════════════════════════════════════
#   SECTION 9: OVERALL SCORE
# ═══════════════════════════════════════════════════════════════════
story.append(Paragraph("9. Overall Score &amp; Verdict", styles['SectionHead']))
story.append(hr())
story.append(Spacer(1, 4*mm))

overall_data = [
    ['Layer', 'Score', 'Weight', 'Weighted'],
    ['Frontend / UI/UX', '3/10', '25%', '0.75'],
    ['API Layer', '5/10', '20%', '1.00'],
    ['Engine / AI Layer', '7/10', '20%', '1.40'],
    ['Data Layer', '3/10', '20%', '0.60'],
    ['Production Readiness', '2/10', '15%', '0.30'],
    ['OVERALL', '', '', '4.05/10'],
]
t = make_table(overall_data, [50*mm, 22*mm, 22*mm, 22*mm])
t.setStyle(TableStyle([
    ('BACKGROUND', (0, 0), (-1, 0), DARK_BG),
    ('TEXTCOLOR', (0, 0), (-1, 0), white),
    ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
    ('FONTSIZE', (0, 0), (-1, 0), 10),
    ('FONTNAME', (0, 1), (-1, -2), 'Helvetica'),
    ('FONTSIZE', (0, 1), (-1, -2), 10),
    ('TEXTCOLOR', (0, 1), (-1, -1), TEXT_DARK),
    ('BACKGROUND', (0, -1), (-1, -1), HexColor('#fef2f2')),
    ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
    ('FONTSIZE', (0, -1), (-1, -1), 12),
    ('TEXTCOLOR', (0, -1), (-1, -1), ACCENT_RED),
    ('ALIGN', (1, 0), (-1, -1), 'CENTER'),
    ('ROWBACKGROUNDS', (0, 1), (-1, -2), [white, LIGHT_GRAY]),
    ('GRID', (0, 0), (-1, -1), 0.5, HexColor('#cbd5e1')),
    ('TOPPADDING', (0, 0), (-1, -1), 6),
    ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ('LEFTPADDING', (0, 0), (-1, -1), 8),
    ('RIGHTPADDING', (0, 0), (-1, -1), 8),
]))
story.append(t)
story.append(Spacer(1, 8*mm))
story.append(ScoreBar(4.05, 10, height=14))
story.append(Spacer(1, 6*mm))
story.append(Paragraph(
    "The product is at approximately 40% of enterprise-ready. The AI/Engine layer (the 'brain') is genuinely strong at 7/10. "
    "But the infrastructure around it (routing, authentication, data layer, UI polish, production monitoring) is at 2-3/10. "
    "We have been polishing the brain while the skeleton has no skin.",
    styles['BodyText2']
))
story.append(PageBreak())

# ═══════════════════════════════════════════════════════════════════
#   SECTION 10: ACTION PLAN
# ═══════════════════════════════════════════════════════════════════
story.append(Paragraph("10. Recommended Action Plan", styles['SectionHead']))
story.append(hr())

story.append(Paragraph("10.1 Immediate (This Week)", styles['SubSection']))
story.append(Paragraph(
    "<b>1. Stop counting 'phases complete'</b> - it is giving false confidence and masking real gaps. "
    "Switch to a task-based approach where each task has a clear, verifiable definition of done that includes "
    "user-facing impact, not just code changes.",
    styles['BodyText2']
))
story.append(Paragraph(
    "<b>2. Fix the SQLite to PostgreSQL mismatch</b> - run docker compose up postgres, point .env at it, "
    "run prisma migrate dev to generate a proper baseline migration. Every hour spent on SQLite is wasted.",
    styles['BodyText2']
))
story.append(Paragraph(
    "<b>3. Add authentication middleware</b> - create a middleware.ts or helper that checks session tokens on "
    "all /api/* routes except auth and health. This is the most critical security vulnerability.",
    styles['BodyText2']
))

story.append(Paragraph("10.2 Short-term (Next 2 Weeks)", styles['SubSection']))
story.append(Paragraph(
    "<b>4. Migrate to Next.js App Router</b> - break the monolithic page.tsx into proper file-based routes. "
    "This is the single highest-impact architectural fix. Use /app/(dashboard)/companies/page.tsx pattern.",
    styles['BodyText2']
))
story.append(Paragraph(
    "<b>5. Clean mock data</b> - systematic sweep of all 232 TODO/mock references. Either wire to real APIs "
    "or remove dead content. Focus on the top 5 most-used screens first.",
    styles['BodyText2']
))
story.append(Paragraph(
    "<b>6. Implement soft-delete</b> - add deletedAt to Company, Contact, Signal, Draft, Pursuit, Opportunity. "
    "Implement Prisma middleware for global soft-delete. Remove cascade delete bombs.",
    styles['BodyText2']
))

story.append(Paragraph("10.3 Medium-term (Next Month)", styles['SubSection']))
story.append(Paragraph(
    "<b>7. Real UI/UX pass</b> - pick the 5 most-used screens (dashboard, companies, leads, company-detail, drafts) "
    "and make them genuinely excellent: proper loading states, error handling, responsive design, accessibility.",
    styles['BodyText2']
))
story.append(Paragraph(
    "<b>8. Add error monitoring and observability</b> - integrate Sentry for error tracking, add structured "
    "logging with levels, implement health check with dependency status.",
    styles['BodyText2']
))
story.append(Paragraph(
    "<b>9. Fix cost tracking and known bugs</b> - propagate tokensUsed from ModelRouter through governedAICall "
    "to engines. Fix Math.random() in account-scoring. Fix quality gates in synthesis-engine.",
    styles['BodyText2']
))

story.append(Spacer(1, 8*mm))
story.append(hr())
story.append(Paragraph(
    "This report was generated from a line-by-line audit of the entire DeepMindQ codebase: 208 API routes, "
    "75 screen components, 35+ engine files, 90 Prisma models, and all supporting infrastructure.",
    styles['SmallText']
))

# ─── BUILD PDF ─────────────────────────────────────────────────────
doc.build(story)
print(f"Report saved to: {output_path}")
