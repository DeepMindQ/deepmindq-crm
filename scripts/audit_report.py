#!/usr/bin/env python3
"""Phase 1-7 Product Readiness Audit PDF Generator"""
import sys, os
PDF_SKILL_DIR = "/home/z/my-project/skills/pdf"
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm, cm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY, TA_RIGHT
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, KeepTogether, HRFlowable, Image, Flowable
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.graphics.shapes import Drawing, Rect, String, Line, Circle
from reportlab.graphics import renderPDF

# ─── Font Registration ───
pdfmetrics.registerFont(TTFont('NotoSerif', '/usr/share/fonts/truetype/noto-serif-sc/NotoSerifSC-Regular.ttf'))
# NotoSans variable font not compatible with ReportLab TTFont
pdfmetrics.registerFont(TTFont('DejaVuSans', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'))
pdfmetrics.registerFont(TTFont('DejaVuSansBd', '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'))
pdfmetrics.registerFont(TTFont('NotoSerifBd', '/usr/share/fonts/truetype/noto-serif-sc/NotoSerifSC-Black.ttf'))
pdfmetrics.registerFontFamily('NotoSerif', normal='NotoSerif', bold='NotoSerifBd')
pdfmetrics.registerFontFamily('DejaVuSans', normal='DejaVuSans', bold='DejaVuSansBd')
FONT = 'DejaVuSans'
FONT_BD = 'DejaVuSansBd'

# ─── Palette (Cascade Minimal) ───
PAGE_BG       = colors.HexColor('#f2f2f0')
SECTION_BG    = colors.HexColor('#edecea')
CARD_BG       = colors.HexColor('#e8e7e3')
TABLE_STRIPE  = colors.HexColor('#f1f1ee')
HEADER_FILL   = colors.HexColor('#766b4b')
COVER_BLOCK   = colors.HexColor('#7a745f')
BORDER        = colors.HexColor('#d2ccbb')
ICON          = colors.HexColor('#9b8749')
ACCENT        = colors.HexColor('#a98826')
ACCENT_2      = colors.HexColor('#4a96af')
TEXT_PRIMARY   = colors.HexColor('#1e1d1b')
TEXT_MUTED     = colors.HexColor('#87847d')
SEM_SUCCESS   = colors.HexColor('#397c4f')
SEM_WARNING   = colors.HexColor('#9c7f45')
SEM_ERROR     = colors.HexColor('#94433b')
SEM_INFO      = colors.HexColor('#446b93')

PAGE_W, PAGE_H = A4
LEFT_M = 54
RIGHT_M = 54
TOP_M = 56
BOTTOM_M = 56
CONTENT_W = PAGE_W - LEFT_M - RIGHT_M

# ─── Styles ───
styles = getSampleStyleSheet()

sH1 = ParagraphStyle('H1', fontName='DejaVuSansBd', fontSize=22, leading=28, textColor=HEADER_FILL, spaceAfter=10, spaceBefore=18, alignment=TA_LEFT)
sH2 = ParagraphStyle('H2', fontName='DejaVuSansBd', fontSize=15, leading=20, textColor=ACCENT, spaceAfter=8, spaceBefore=14, alignment=TA_LEFT)
sH3 = ParagraphStyle('H3', fontName='DejaVuSansBd', fontSize=12, leading=16, textColor=TEXT_PRIMARY, spaceAfter=6, spaceBefore=10, alignment=TA_LEFT)
sBody = ParagraphStyle('Body', fontName='DejaVuSans', fontSize=9.5, leading=14.5, textColor=TEXT_PRIMARY, spaceAfter=6, alignment=TA_JUSTIFY, firstLineIndent=0)
sBodyIndent = ParagraphStyle('BodyIndent', parent=sBody, leftIndent=14)
sBullet = ParagraphStyle('Bullet', parent=sBody, leftIndent=22, firstLineIndent=-11, spaceAfter=3, spaceBefore=1)
sSmall = ParagraphStyle('Small', fontName='DejaVuSans', fontSize=8, leading=11, textColor=TEXT_MUTED, spaceAfter=3)
sCaption = ParagraphStyle('Caption', fontName='DejaVuSans', fontSize=8, leading=11, textColor=TEXT_MUTED, alignment=TA_CENTER, spaceAfter=8, spaceBefore=4)
sTableHead = ParagraphStyle('TH', fontName='DejaVuSansBd', fontSize=8.5, leading=12, textColor=colors.white, alignment=TA_LEFT)
sTableCell = ParagraphStyle('TC', fontName='DejaVuSans', fontSize=8.5, leading=12, textColor=TEXT_PRIMARY, alignment=TA_LEFT)
sTableCellWrap = ParagraphStyle('TCW', parent=sTableCell, leading=12.5)
sVerdict = ParagraphStyle('Verdict', fontName='DejaVuSansBd', fontSize=11, leading=16, textColor=SEM_ERROR, spaceAfter=6, spaceBefore=6)
sVerdictPass = ParagraphStyle('VerdictPass', fontName='DejaVuSansBd', fontSize=11, leading=16, textColor=SEM_SUCCESS, spaceAfter=6, spaceBefore=6)
sKPI = ParagraphStyle('KPI', fontName='DejaVuSansBd', fontSize=28, leading=34, textColor=ACCENT, alignment=TA_CENTER)
sKPILabel = ParagraphStyle('KPILabel', fontName='DejaVuSans', fontSize=8, leading=11, textColor=TEXT_MUTED, alignment=TA_CENTER)

# ─── Helper Flowables ───
class SectionBar(Flowable):
    """Colored section divider bar"""
    def __init__(self, text, width=CONTENT_W, height=22):
        Flowable.__init__(self)
        self.text = text
        self.width = width
        self.height = height
    def draw(self):
        self.canv.setFillColor(HEADER_FILL)
        self.canv.roundRect(0, 0, self.width, self.height, 3, fill=1, stroke=0)
        self.canv.setFillColor(colors.white)
        self.canv.setFont('DejaVuSansBd', 11)
        self.canv.drawString(12, 6, self.text)

class StatusBadge(Flowable):
    """Status badge: PASS / WARN / FAIL"""
    def __init__(self, status, width=52, height=16):
        Flowable.__init__(self)
        self.status = status
        self.width = width
        self.height = height
        self._color = SEM_SUCCESS if status=='PASS' else (SEM_WARNING if status=='WARN' else SEM_ERROR)
    def draw(self):
        self.canv.setFillColor(self._color)
        self.canv.roundRect(0, 0, self.width, self.height, 8, fill=1, stroke=0)
        self.canv.setFillColor(colors.white)
        self.canv.setFont('DejaVuSansBd', 7.5)
        self.canv.drawCentredString(self.width/2, 4.5, self.status)

def badge(status):
    return StatusBadge(status)

def hr():
    return HRFlowable(width="100%", thickness=0.5, color=BORDER, spaceAfter=8, spaceBefore=8)

def bullet(text):
    return Paragraph(f"\u2022  {text}", sBullet)

def sp(pts=6):
    return Spacer(1, pts)

# ─── Build Document ───
OUTPUT = "/home/z/my-project/download/PHASE_1_7_PRODUCT_READINESS_AUDIT.pdf"
os.makedirs(os.path.dirname(OUTPUT), exist_ok=True)

doc = SimpleDocTemplate(
    OUTPUT,
    pagesize=A4,
    leftMargin=LEFT_M, rightMargin=RIGHT_M,
    topMargin=TOP_M, bottomMargin=BOTTOM_M,
    title="Phase 1-7 Product Readiness Audit",
    author="Z.ai",
    subject="DeepMindQ Intelligence Platform - Product Readiness Assessment"
)

story = []

# ═══════════════════════════════════════════
# COVER PAGE
# ═══════════════════════════════════════════
story.append(Spacer(1, 80))

# Decorative top bar
story.append(HRFlowable(width="100%", thickness=3, color=ACCENT, spaceAfter=0, spaceBefore=0))

story.append(Spacer(1, 40))

story.append(Paragraph("PHASE 1-7", ParagraphStyle('CoverPhase', fontName='DejaVuSans', fontSize=14, leading=18, textColor=TEXT_MUTED, alignment=TA_CENTER, letterSpacing=4)))
story.append(Spacer(1, 8))
story.append(Paragraph("PRODUCT READINESS", ParagraphStyle('CoverTitle', fontName='DejaVuSansBd', fontSize=36, leading=42, textColor=HEADER_FILL, alignment=TA_CENTER)))
story.append(Paragraph("AUDIT", ParagraphStyle('CoverTitle2', fontName='DejaVuSansBd', fontSize=36, leading=42, textColor=HEADER_FILL, alignment=TA_CENTER)))
story.append(Spacer(1, 16))
story.append(Paragraph("DeepMindQ Intelligence Platform", ParagraphStyle('CoverSub', fontName='DejaVuSans', fontSize=14, leading=18, textColor=ACCENT, alignment=TA_CENTER)))
story.append(Spacer(1, 6))
story.append(Paragraph("Comprehensive Validation, Architecture & Stability Assessment", ParagraphStyle('CoverDesc', fontName='DejaVuSans', fontSize=10, leading=14, textColor=TEXT_MUTED, alignment=TA_CENTER)))

story.append(Spacer(1, 50))
story.append(HRFlowable(width="40%", thickness=0.5, color=BORDER, spaceAfter=0, spaceBefore=0))
story.append(Spacer(1, 20))

# Meta table on cover
cover_meta = [
    [Paragraph("AUDIT SCOPE", sSmall), Paragraph("13 Sections", sSmall)],
    [Paragraph("BOUNDARY", sSmall), Paragraph("No new features / No logic changes", sSmall)],
    [Paragraph("SCREENS REVIEWED", sSmall), Paragraph("5 Phase 7 Screens (2,862 lines)", sSmall)],
    [Paragraph("DATABASE MODELS", sSmall), Paragraph("35+ Prisma Models (1,398 lines)", sSmall)],
    [Paragraph("API ENDPOINTS", sSmall), Paragraph("150+ Routes across 7 API groups", sSmall)],
    [Paragraph("TEST FILES", sSmall), Paragraph("8 test suites (~180 tests)", sSmall)],
]
ct = Table(cover_meta, colWidths=[140, CONTENT_W - 140])
ct.setStyle(TableStyle([
    ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ('TOPPADDING', (0,0), (-1,-1), 3),
    ('BOTTOMPADDING', (0,0), (-1,-1), 3),
    ('LINEBELOW', (0,0), (-1,-2), 0.3, BORDER),
    ('TEXTCOLOR', (0,0), (0,-1), TEXT_MUTED),
]))
story.append(ct)

story.append(Spacer(1, 40))
story.append(HRFlowable(width="100%", thickness=3, color=ACCENT, spaceAfter=0, spaceBefore=0))

story.append(PageBreak())

# ═══════════════════════════════════════════
# TABLE OF CONTENTS
# ═══════════════════════════════════════════
story.append(Paragraph("TABLE OF CONTENTS", sH1))
story.append(hr())

toc_items = [
    ("1", "Executive Summary & Verdict", "3"),
    ("2", "End-to-End Product Flow Validation", "4"),
    ("3", "Information Architecture Review", "5"),
    ("4", "Data Consistency Audit (Phase 7 Screens)", "6"),
    ("5", "Architecture & Layer Separation Review", "8"),
    ("6", "Database & API Readiness", "9"),
    ("7", "Demo Data vs Real Data Separation", "11"),
    ("8", "Empty State & Error Handling Review", "12"),
    ("9", "Search & Discovery Readiness", "13"),
    ("10", "Testing & Quality Report", "14"),
    ("11", "Performance Baseline", "16"),
    ("12", "Security & Deployment Baseline", "17"),
    ("13", "Final Recommendation", "18"),
]
for num, title, pg in toc_items:
    row = Table(
        [[Paragraph(f"<b>Section {num}</b>", sBody), Paragraph(title, sBody), Paragraph(pg, ParagraphStyle('pg', parent=sBody, alignment=TA_RIGHT, textColor=TEXT_MUTED))]],
        colWidths=[80, CONTENT_W - 110, 30]
    )
    row.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('LINEBELOW', (0,0), (-1,-1), 0.3, BORDER),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
    ]))
    story.append(row)

story.append(PageBreak())

# ═══════════════════════════════════════════
# SECTION 1: EXECUTIVE SUMMARY
# ═══════════════════════════════════════════
story.append(SectionBar("SECTION 1: EXECUTIVE SUMMARY & VERDICT"))
story.append(sp(12))

story.append(Paragraph("This audit examines the DeepMindQ Intelligence Platform across all seven completed development phases. The platform implements a multi-layered intelligence pipeline that transforms raw company data into actionable revenue insights through signal detection, evidence aggregation, confidence scoring, and human-validated trust assessments. The system comprises 45 screen components, 35+ database models, 150+ API endpoints, and a comprehensive library of intelligence processing modules spanning data quality, workflow automation, research engines, and AI governance.", sBody))
story.append(sp(4))

# Verdict box
verdict_data = [
    [Paragraph("READINESS VERDICT", ParagraphStyle('vh', fontName='DejaVuSansBd', fontSize=9, textColor=colors.white)),
     Paragraph("CONDITIONAL PASS - Requires 5 Critical Fixes Before Phase 8", ParagraphStyle('vr', fontName='DejaVuSansBd', fontSize=9, textColor=colors.white))],
]
vt = Table(verdict_data, colWidths=[CONTENT_W * 0.3, CONTENT_W * 0.7])
vt.setStyle(TableStyle([
    ('BACKGROUND', (0,0), (0,0), SEM_WARNING),
    ('BACKGROUND', (1,0), (1,0), colors.HexColor('#3d3520')),
    ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ('TOPPADDING', (0,0), (-1,-1), 10),
    ('BOTTOMPADDING', (0,0), (-1,-1), 10),
    ('LEFTPADDING', (0,0), (-1,-1), 12),
    ('ROUNDEDCORNERS', [4, 4, 4, 4]),
]))
story.append(vt)
story.append(sp(10))

story.append(Paragraph("The platform demonstrates strong architectural foundations with a well-structured intelligence pipeline, mature data models, and comprehensive AI governance. However, five critical issues must be resolved before proceeding to Phase 8 (UI/UX refinement, testing, and demo readiness). These issues center around demo data navigation creating dead-end user experiences, suppressed type errors masking potential bugs, missing test coverage for critical intelligence modules, silent API error handling hiding failures from users, and exposed personal information in the application layout.", sBody))
story.append(sp(6))

# KPI Cards
kpi_data = [
    [Paragraph("45", sKPI), Paragraph("35+", sKPI), Paragraph("150+", sKPI), Paragraph("8", sKPI), Paragraph("~180", sKPI)],
    [Paragraph("Screen Components", sKPILabel), Paragraph("DB Models", sKPILabel), Paragraph("API Endpoints", sKPILabel), Paragraph("Test Suites", sKPILabel), Paragraph("Test Cases", sKPILabel)],
]
kt = Table(kpi_data, colWidths=[CONTENT_W/5]*5)
kt.setStyle(TableStyle([
    ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ('ALIGN', (0,0), (-1,-1), 'CENTER'),
    ('TOPPADDING', (0,0), (-1,0), 14),
    ('BOTTOMPADDING', (0,0), (-1,0), 2),
    ('TOPPADDING', (0,1), (-1,1), 0),
    ('BACKGROUND', (0,0), (-1,-1), CARD_BG),
    ('ROUNDEDCORNERS', [4, 4, 4, 4]),
    ('LINEAFTER', (0,0), (3,-1), 0.5, BORDER),
    ('BOX', (0,0), (-1,-1), 0.5, BORDER),
]))
story.append(kt)
story.append(sp(10))

# Critical issues summary table
story.append(Paragraph("<b>5 Critical Issues Requiring Resolution</b>", sH3))
crit_headers = [
    Paragraph("#", sTableHead),
    Paragraph("Issue", sTableHead),
    Paragraph("Severity", sTableHead),
    Paragraph("Impact", sTableHead),
    Paragraph("Fix Effort", sTableHead),
]
crit_rows = [
    [Paragraph("1", sTableCell), Paragraph("Demo navigation creates dead-end UX (fake company IDs lead to empty screens)", sTableCellWrap),
     Paragraph("CRITICAL", ParagraphStyle('red', parent=sTableCell, textColor=SEM_ERROR, fontName='DejaVuSansBd')),
     Paragraph("Users clicking demo companies see blank screens", sTableCellWrap), Paragraph("2h", sTableCell)],
    [Paragraph("2", sTableCell), Paragraph("368 TypeScript errors suppressed via ignoreBuildErrors: true", sTableCellWrap),
     Paragraph("CRITICAL", ParagraphStyle('red', parent=sTableCell, textColor=SEM_ERROR, fontName='DejaVuSansBd')),
     Paragraph("Hidden bugs can accumulate undetected", sTableCellWrap), Paragraph("1-2 days", sTableCell)],
    [Paragraph("3", sTableCell), Paragraph("Zero test coverage for intelligence-contract.ts (single source of truth), research engine, AI governance", sTableCellWrap),
     Paragraph("HIGH", ParagraphStyle('warn', parent=sTableCell, textColor=SEM_WARNING, fontName='DejaVuSansBd')),
     Paragraph("Core intelligence pipeline unverified", sTableCellWrap), Paragraph("2-3 days", sTableCell)],
    [Paragraph("4", sTableCell), Paragraph("Silent error catching in revenue-intelligence-screen (catch {})", sTableCellWrap),
     Paragraph("HIGH", ParagraphStyle('warn', parent=sTableCell, textColor=SEM_WARNING, fontName='DejaVuSansBd')),
     Paragraph("API failures invisible to users", sTableCellWrap), Paragraph("30min", sTableCell)],
    [Paragraph("5", sTableCell), Paragraph("Personal information (email, LinkedIn, name) exposed in JSON-LD structured data", sTableCellWrap),
     Paragraph("MEDIUM", ParagraphStyle('warn2', parent=sTableCell, textColor=SEM_WARNING, fontName='DejaVuSansBd')),
     Paragraph("Privacy and security risk", sTableCellWrap), Paragraph("15min", sTableCell)],
]
crit_table_data = [crit_headers] + crit_rows
ct2 = Table(crit_table_data, colWidths=[25, CONTENT_W*0.32, 60, CONTENT_W*0.36, 55])
ct2.setStyle(TableStyle([
    ('BACKGROUND', (0,0), (-1,0), HEADER_FILL),
    ('TEXTCOLOR', (0,0), (-1,0), colors.white),
    ('BACKGROUND', (0,1), (-1,1), colors.HexColor('#fdf2f2')),
    ('BACKGROUND', (0,2), (-1,2), colors.HexColor('#fef9ee')),
    ('BACKGROUND', (0,3), (-1,3), colors.HexColor('#fff8ee')),
    ('BACKGROUND', (0,4), (-1,4), colors.HexColor('#fdf8ee')),
    ('BACKGROUND', (0,5), (-1,5), colors.HexColor('#f8f8f5')),
    ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, TABLE_STRIPE]),
    ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ('GRID', (0,0), (-1,-1), 0.3, BORDER),
    ('TOPPADDING', (0,0), (-1,-1), 5),
    ('BOTTOMPADDING', (0,0), (-1,-1), 5),
    ('LEFTPADDING', (0,0), (-1,-1), 6),
    ('RIGHTPADDING', (0,0), (-1,-1), 6),
]))
story.append(ct2)

story.append(PageBreak())

# ═══════════════════════════════════════════
# SECTION 2: END-TO-END PRODUCT FLOW
# ═══════════════════════════════════════════
story.append(SectionBar("SECTION 2: END-TO-END PRODUCT FLOW VALIDATION"))
story.append(sp(12))

story.append(Paragraph("The intelligence pipeline implements a ten-stage processing chain: Company Ingestion, Signal Detection, Evidence Aggregation, Interpretation, Capability Matching, Recommendation Generation, Trust/Validation, Confidence Scoring, Revenue Intelligence Assembly, and Executive Report Generation. This section validates that data flows correctly through each stage without loss, transformation errors, or dead ends.", sBody))
story.append(sp(4))

story.append(Paragraph("2.1 Pipeline Flow Validation", sH2))
story.append(Paragraph("The pipeline begins when a company enters the system through the CRM module (g-crm API group). Raw company data is stored in the Company model with 20+ fields including normalized name, domain, industry, and intelligence score. The research engine (src/lib/research-engine/) then orchestrates signal detection through signal detection modules, which create CompanySignal records linked to the company. Each signal is classified using canonical type constants defined in signal-types.ts (funding, hiring, leadership_change, technology_adoption, etc.) with alias resolution for consistency.", sBody))
story.append(Paragraph("Evidence extraction follows signal detection, with the evidence.ts module creating Evidence records that track source URLs, snippets, relevance scores, and confidence ratings. The signal-meaning.ts module then infers buying stage from signal patterns, and signal-capability-matching.ts maps detected signals to the CapabilityAsset library. This produces SignalCapabilityMatch records with match scores and sales angles.", sBody))
story.append(Paragraph("The opportunity-recommendation-engine.ts assembles the final recommendation by combining signal data, capability matches, and confidence metrics. The output OpportunityRecommendation records include confidence breakdowns across four dimensions (Signal 30%, Evidence 30%, Capability 25%, Data 15%) and are presented through the Phase 7 revenue intelligence screens.", sBody))

story.append(Paragraph("2.2 Data Flow Integrity Assessment", sH2))
flow_headers = [Paragraph("Stage", sTableHead), Paragraph("Input", sTableHead), Paragraph("Output", sTableHead), Paragraph("Status", sTableHead)]
flow_rows = [
    [Paragraph("Company Ingestion", sTableCell), Paragraph("CRM Import / Manual", sTableCell), Paragraph("Company + ResearchCard", sTableCell), badge("PASS")],
    [Paragraph("Signal Detection", sTableCell), Paragraph("Company + ResearchCard", sTableCell), Paragraph("CompanySignal[]", sTableCell), badge("PASS")],
    [Paragraph("Evidence Aggregation", sTableCell), Paragraph("CompanySignal[]", sTableCell), Paragraph("Evidence[]", sTableCell), badge("PASS")],
    [Paragraph("Interpretation", sTableCell), Paragraph("CompanySignal[] + Evidence[]", sTableCell), Paragraph("SignalMeaning", sTableCell), badge("PASS")],
    [Paragraph("Capability Matching", sTableCell), Paragraph("SignalMeaning + CapabilityAsset", sTableCell), Paragraph("SignalCapabilityMatch[]", sTableCell), badge("PASS")],
    [Paragraph("Recommendation", sTableCell), Paragraph("SignalCapabilityMatch[] + Confidence", sTableCell), Paragraph("OpportunityRecommendation", sTableCell), badge("PASS")],
    [Paragraph("Trust/Validation", sTableCell), Paragraph("OpportunityRecommendation", sTableCell), Paragraph("IntelligenceValidation", sTableCell), badge("PASS")],
    [Paragraph("Confidence Scoring", sTableCell), Paragraph("All artifacts", sTableCell), Paragraph("4-dimension score", sTableCell), badge("PASS")],
    [Paragraph("Revenue Intelligence", sTableCell), Paragraph("All artifacts", sTableCell), Paragraph("Executive Dashboard", sTableCell), badge("WARN")],
    [Paragraph("Executive Report", sTableCell), Paragraph("Validation data", sTableCell), Paragraph("Exportable brief", sTableCell), badge("PASS")],
]
ft = Table([flow_headers] + flow_rows, colWidths=[95, 130, 130, 55])
ft.setStyle(TableStyle([
    ('BACKGROUND', (0,0), (-1,0), HEADER_FILL),
    ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, TABLE_STRIPE]),
    ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ('GRID', (0,0), (-1,-1), 0.3, BORDER),
    ('TOPPADDING', (0,0), (-1,-1), 4),
    ('BOTTOMPADDING', (0,0), (-1,-1), 4),
    ('LEFTPADDING', (0,0), (-1,-1), 5),
]))
story.append(ft)
story.append(sp(6))
story.append(Paragraph("Note: Revenue Intelligence stage marked WARN due to silent error handling in the dashboard screen (empty catch block on API failure). The pipeline itself functions correctly, but users may see stale demo data when the API fails without any notification.", sSmall))

story.append(Paragraph("2.3 Navigation Flow Validation", sH2))
story.append(Paragraph("The application implements a single-page architecture (SPA) where all 45 screens are lazy-loaded through a central page.tsx controller. Navigation is managed via a Zustand store with a single activeView field. The Phase 7 navigation flow follows this path: Demo Experience Screen (5 clickable companies) -> Revenue Intelligence Brief (drill-down) -> Intelligence Reasoning (trust analysis) -> Intelligence Report (validation detail). Each transition correctly passes the selectedCompanyId through the store, ensuring context is maintained between screens.", sBody))
story.append(Paragraph("However, a critical flow break was identified: the Demo Experience Screen uses fake company IDs (demo-aramco.com, demo-adnoc.ae, etc.) that do not exist in the database. When a user clicks 'Explore Intelligence' on a demo company, the Revenue Intelligence Brief screen receives this fake ID and attempts API calls that will return 404 or empty responses, resulting in an empty loading state. This creates a dead-end user experience that must be fixed before any demo or stakeholder presentation.", sBody))

story.append(PageBreak())

# ═══════════════════════════════════════════
# SECTION 3: INFORMATION ARCHITECTURE
# ═══════════════════════════════════════════
story.append(SectionBar("SECTION 3: INFORMATION ARCHITECTURE REVIEW"))
story.append(sp(12))

story.append(Paragraph("The information architecture organizes the platform into five functional layers: Core CRM (companies, contacts, leads, pipeline), Data Intelligence (import, quality, rules), Intelligence Engine (signals, evidence, confidence, health), Revenue Intelligence (dashboard, brief, reasoning, report), and System (settings, audit, auth). Each layer is represented as a distinct navigation section in the sidebar with 5-12 screens per section. The navigation supports collapsible sections and screen-level lazy loading for performance optimization.", sBody))

story.append(Paragraph("3.1 Navigation Taxonomy", sH2))
story.append(Paragraph("The sidebar navigation in page.tsx organizes 45 screens into 8 sections. The Phase 7 additions introduced a dedicated 'REVENUE INTELLIGENCE' section containing 5 new screens. The navigation uses a hierarchical structure where each section can be expanded/collapsed, and individual screens are identified by a ViewId string. The mapping between ViewId and screen component is maintained in a central switch statement in page.tsx, with React.lazy() used for code splitting. This approach ensures that only the active screen's code is loaded into the browser, reducing initial bundle size.", sBody))

nav_headers = [Paragraph("Section", sTableHead), Paragraph("Screens", sTableHead), Paragraph("Phase", sTableHead), Paragraph("Status", sTableHead)]
nav_rows = [
    [Paragraph("Overview", sTableCell), Paragraph("Dashboard, Command Center", sTableCell), Paragraph("Core", sTableCell), badge("PASS")],
    [Paragraph("Revenue Intelligence", sTableCell), Paragraph("5 screens (Dashboard, Brief, Reasoning, Report, Demo)", sTableCell), Paragraph("Phase 7", sTableCell), badge("PASS")],
    [Paragraph("Intelligence", sTableCell), Paragraph("Signal Intelligence, Intelligence Health, Account Ranking, Opportunity Radar/Workspace, Pursuit Workspace", sTableCell), Paragraph("Phase 3-6", sTableCell), badge("PASS")],
    [Paragraph("CRM", sTableCell), Paragraph("Companies, Contacts, Leads, Segments, Duplicates, Pipeline, Opportunities", sTableCell), Paragraph("Core", sTableCell), badge("PASS")],
    [Paragraph("Outreach", sTableCell), Paragraph("Sequences, Templates, Drafts, Queue, Replies, Bounces, Email Generation", sTableCell), Paragraph("Core", sTableCell), badge("PASS")],
    [Paragraph("Data", sTableCell), Paragraph("Import, Data Health, Analytics, Reports, Audit", sTableCell), Paragraph("Phase 1", sTableCell), badge("PASS")],
    [Paragraph("AI", sTableCell), Paragraph("Knowledge Library, Research Agent, Conversation Studio, Relationship Memory", sTableCell), Paragraph("Core", sTableCell), badge("PASS")],
    [Paragraph("Settings", sTableCell), Paragraph("Settings, Data Rules, ICP Settings, Tasks", sTableCell), Paragraph("Core/5", sTableCell), badge("PASS")],
]
nt = Table([nav_headers] + nav_rows, colWidths=[100, 225, 60, 55])
nt.setStyle(TableStyle([
    ('BACKGROUND', (0,0), (-1,0), HEADER_FILL),
    ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, TABLE_STRIPE]),
    ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ('GRID', (0,0), (-1,-1), 0.3, BORDER),
    ('TOPPADDING', (0,0), (-1,-1), 4),
    ('BOTTOMPADDING', (0,0), (-1,-1), 4),
    ('LEFTPADDING', (0,0), (-1,-1), 5),
]))
story.append(nt)

story.append(Paragraph("3.2 Screen Component Architecture", sH2))
story.append(Paragraph("All 45 screens follow a consistent architectural pattern: each screen is a standalone React component that manages its own data fetching via useEffect hooks, local state via useState, and renders using shadcn/ui components with Tailwind CSS styling. The screens do not share state through the Zustand store beyond the activeView and selectedCompanyId fields. This means each screen independently fetches its data from the API, resulting in no shared caching or data coherency between screens viewing the same entity. While this simplifies component development, it means that navigating between screens that display overlapping data (e.g., company detail and revenue intelligence brief for the same company) results in duplicate API calls.", sBody))

story.append(Paragraph("3.3 Intelligence Contract Pattern", sH2))
story.append(Paragraph("The intelligence-contract.ts file serves as the single source of truth for intelligence data consumption. It provides four canonical functions: getResearchContext() for assembling a company's complete research profile, getAccountIntelligence() for aggregated intelligence metrics, getResearchFreshness() for staleness detection, and getSignalMetrics() for signal statistics. All intelligence-consuming components and API routes are expected to use these functions rather than querying the database directly. This pattern ensures consistent data access and makes the intelligence layer maintainable. However, this critical module has zero test coverage, which is a significant risk given its role as the single source of truth.", sBody))

story.append(PageBreak())

# ═══════════════════════════════════════════
# SECTION 4: DATA CONSISTENCY AUDIT
# ═══════════════════════════════════════════
story.append(SectionBar("SECTION 4: DATA CONSISTENCY AUDIT (PHASE 7 SCREENS)"))
story.append(sp(12))

story.append(Paragraph("This section audits data consistency across all five Phase 7 screens, focusing on the five demo companies (Saudi Aramco, ADNOC, STC, Emirates NBD, NEOM) that serve as the primary data set for the Revenue Intelligence experience. The audit checks for consistent naming, matching scores, aligned confidence values, and coherent narratives across screens.", sBody))

story.append(Paragraph("4.1 Company Identity Consistency", sH2))
story.append(Paragraph("All five Phase 7 screens reference the same set of demo companies. The revenue-intelligence-screen.tsx and demo-experience-screen.tsx both define a DEMO_COMPANIES array containing identical company objects with consistent fields: id (domain-based), name, industry, score, confidence, and description. The revenue-intelligence-brief-screen.tsx has a separate DEMO_DATA constant with equivalent but independently defined data for its fallback state. This dual definition creates a maintenance risk: changes to company attributes in one screen will not automatically propagate to the other, potentially causing data inconsistencies.", sBody))

story.append(Paragraph("4.2 Score Consistency Analysis", sH2))
story.append(Paragraph("The demo data assigns intelligence scores and confidence values to each company. These values are used across multiple screens and must remain consistent. The current implementation uses hardcoded values that are consistent within each screen but defined independently across screens. The confidence scoring system (intelligence-confidence.ts) uses a weighted four-dimension model: Signal Quality (30%), Evidence Strength (30%), Capability Match (25%), and Data Completeness (15%). In the demo data, these individual dimension scores are not explicitly provided; only the aggregate score is shown, which means the breakdown displayed on the brief screen is computed at render time and may not match the aggregate if the calculation method differs.", sBody))

story.append(Paragraph("4.3 Screen-Level Data Audit", sH2))

scr_headers = [Paragraph("Screen", sTableHead), Paragraph("Lines", sTableHead), Paragraph("Data Source", sTableHead), Paragraph("Demo Fallback", sTableHead), Paragraph("Issues", sTableHead)]
scr_rows = [
    [Paragraph("Revenue Intelligence", sTableCell), Paragraph("417", sTableCell), Paragraph("API: /g-intelligence/dashboard", sTableCell), Paragraph("DEMO_COMPANIES[]", sTableCell), Paragraph("Silent catch {}", sTableCell)],
    [Paragraph("Revenue Intelligence Brief", sTableCell), Paragraph("697", sTableCell), Paragraph("API: /g-intelligence/companies/[id]/validation-report", sTableCell), Paragraph("DEMO_DATA (separate)", sTableCell), Paragraph("Independent demo data", sTableCell)],
    [Paragraph("Intelligence Reasoning", sTableCell), Paragraph("661", sTableCell), Paragraph("API: /g-intelligence/recommendations/[id]/trust-report", sTableCell), Paragraph("No fallback", sTableCell), Paragraph("No demo path", sTableCell)],
    [Paragraph("Intelligence Report", sTableCell), Paragraph("764", sTableCell), Paragraph("API: /g-intelligence/companies/[id]/validation-report", sTableCell), Paragraph("No fallback", sTableCell), Paragraph("Shares endpoint with Brief", sTableCell)],
    [Paragraph("Demo Experience", sTableCell), Paragraph("299", sTableCell), Paragraph("100% hardcoded", sTableCell), Paragraph("N/A (is demo)", sTableCell), Paragraph("Fake IDs cause dead-ends", sTableCell)],
]
st = Table([scr_headers] + scr_rows, colWidths=[90, 38, 115, 85, CONTENT_W-328])
st.setStyle(TableStyle([
    ('BACKGROUND', (0,0), (-1,0), HEADER_FILL),
    ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, TABLE_STRIPE]),
    ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ('GRID', (0,0), (-1,-1), 0.3, BORDER),
    ('TOPPADDING', (0,0), (-1,-1), 4),
    ('BOTTOMPADDING', (0,0), (-1,-1), 4),
    ('LEFTPADDING', (0,0), (-1,-1), 5),
]))
story.append(st)

story.append(Paragraph("4.4 CSS Custom Class Consistency", sH2))
story.append(Paragraph("A significant consistency issue was identified: the Phase 7 screens reference CSS classes bg-gold and text-gold that are not defined in the tailwind.config.ts configuration file. These classes would need to be defined in globals.css as custom CSS properties or utility classes. If they are not defined anywhere, the gold-colored elements (typically used for priority indicators and confidence badges) will render without their intended styling, appearing as plain text without background color. This was flagged as a potential visual inconsistency that could confuse users during demo presentations where the gold accent is intended to highlight high-priority accounts.", sBody))

story.append(PageBreak())

# ═══════════════════════════════════════════
# SECTION 5: ARCHITECTURE REVIEW
# ═══════════════════════════════════════════
story.append(SectionBar("SECTION 5: ARCHITECTURE & LAYER SEPARATION REVIEW"))
story.append(sp(12))

story.append(Paragraph("The platform follows a four-layer architecture: Data Foundation Layer (Prisma ORM, SQLite/PostgreSQL, database models), Intelligence Engine Layer (signal processing, evidence aggregation, confidence scoring, trust validation), Trust/Validation Layer (human feedback, source reliability, contradiction detection), and Revenue Intelligence Experience Layer (React components, API routes, state management). Each layer is intended to be independently testable and replaceable.", sBody))

story.append(Paragraph("5.1 Layer Separation Assessment", sH2))

arch_headers = [Paragraph("Layer", sTableHead), Paragraph("Components", sTableHead), Paragraph("Dependency Direction", sTableHead), Paragraph("Status", sTableHead)]
arch_rows = [
    [Paragraph("Data Foundation", sTableCell), Paragraph("Prisma, SQLite, 35+ models", sTableCell), Paragraph("One-way: upward only", sTableCell), badge("PASS")],
    [Paragraph("Intelligence Engine", sTableCell), Paragraph("12 modules (signals, evidence, confidence, health, research)", sTableCell), Paragraph("Reads DB, no UI dependency", sTableCell), badge("PASS")],
    [Paragraph("Trust/Validation", sTableCell), Paragraph("6 modules (validation, source reliability, contradiction, feedback)", sTableCell), Paragraph("Reads/writes intelligence artifacts", sTableCell), badge("PASS")],
    [Paragraph("Experience Layer", sTableCell), Paragraph("45 screens, 7 API groups, Zustand store", sTableCell), Paragraph("Consumes all lower layers", sTableCell), badge("WARN")],
]
at = Table([arch_headers] + arch_rows, colWidths=[95, 170, 135, 55])
at.setStyle(TableStyle([
    ('BACKGROUND', (0,0), (-1,0), HEADER_FILL),
    ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, TABLE_STRIPE]),
    ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ('GRID', (0,0), (-1,-1), 0.3, BORDER),
    ('TOPPADDING', (0,0), (-1,-1), 4),
    ('BOTTOMPADDING', (0,0), (-1,-1), 4),
    ('LEFTPADDING', (0,0), (-1,-1), 5),
]))
story.append(at)
story.append(sp(6))
story.append(Paragraph("The Experience Layer is marked WARN because the API route handlers (route.ts files) in each group contain both routing logic and business logic in the same file. This mixing of concerns makes the API layer harder to test and maintain. The recommended pattern would be to have route handlers delegate to pure business logic functions in the lib/ directory, with routes serving only as HTTP adapters.", sSmall))

story.append(Paragraph("5.2 API Dispatcher Pattern", sH2))
story.append(Paragraph("All API groups use a dynamic [...slug] route pattern where a single route.ts file contains a regex-based dispatcher (keyToRegex function) that maps URL slugs to handler functions. Each API group (g-crm, g-ai, g-data, g-outreach, g-strategy, g-intelligence, g-system, g-auth) has its own dispatcher with 4-50+ routes. This pattern reduces file count but creates large monolithic route files. The g-crm dispatcher alone handles 50+ routes in a single file. The intelligence API group (g-intelligence) is well-scoped with 10 focused routes.", sBody))

story.append(Paragraph("5.3 State Management Assessment", sH2))
story.append(Paragraph("The Zustand store (store.ts) is minimal with only six fields: activeView, sidebarCollapsed, selectedContactId, selectedCompanyId, selectedDraftId, and activeFilters. Server state (data from APIs) is managed entirely through local useState hooks within each screen component, with data fetching performed in useEffect. The application includes @tanstack/react-query as a dependency and has a QueryProvider wrapper, but the majority of screens do not use React Query for data fetching. This means there is no shared caching, no automatic background refetching, and no optimistic updates. Two screens viewing the same company will make independent API calls without sharing results.", sBody))

story.append(PageBreak())

# ═══════════════════════════════════════════
# SECTION 6: DATABASE & API READINESS
# ═══════════════════════════════════════════
story.append(SectionBar("SECTION 6: DATABASE & API READINESS"))
story.append(sp(12))

story.append(Paragraph("The database layer uses Prisma ORM with SQLite for development (file:/home/z/my-project/db/custom.db) and Neon PostgreSQL for production (via @prisma/adapter-neon). The schema contains 35+ models spanning 1,398 lines with comprehensive indexing, relations, and JSON fields for flexible data storage.", sBody))

story.append(Paragraph("6.1 Database Schema Completeness", sH2))
story.append(Paragraph("The schema covers all functional domains: core CRM (Company, Contact, ImportBatch), signals and evidence (CompanySignal, Evidence, CompanyTimelineEvent), email outreach (EmailTemplate, EmailSequence, SequenceStep, SequenceEnrollment, Draft, SendQueue, EmailEvent, ABTest, Reply, Bounce, Suppression, Segment), intelligence trust (SignalValidation, CompanyIntelligenceHealth, IntelligenceConflict, IntelligenceValidation, RecommendationFeedback, EvidenceSourceReliability), strategy and pursuit (CapabilityAsset, SignalCapabilityMatch, OpportunityRecommendation, Pursuit, Playbook, AccountStrategy), data intelligence (DataUpload, UploadRow, ColumnMappingRule, FieldValidationRule, NormalizationMapping, ScoringWeight, DataQualityScore), and workflow/auth (Job, JobLog, AIGenerationAudit, User, OtpCode, Session, SystemSetting, PriorityScoreHistory, ConversationPlan, AuditLog).", sBody))

story.append(Paragraph("6.2 API Endpoint Inventory", sH2))

api_headers = [Paragraph("API Group", sTableHead), Paragraph("Routes", sTableHead), Paragraph("Auth", sTableHead), Paragraph("Rate Limited", sTableHead), Paragraph("Audit Logged", sTableHead)]
api_rows = [
    [Paragraph("/api/g-intelligence/", sTableCell), Paragraph("10", sTableCell), Paragraph("Partial", sTableCell), Paragraph("No", sTableCell), Paragraph("No", sTableCell)],
    [Paragraph("/api/g-crm/", sTableCell), Paragraph("50+", sTableCell), Paragraph("Partial", sTableCell), Paragraph("No", sTableCell), Paragraph("Partial", sTableCell)],
    [Paragraph("/api/g-ai/", sTableCell), Paragraph("32", sTableCell), Paragraph("Partial", sTableCell), Paragraph("No", sTableCell), Paragraph("Partial", sTableCell)],
    [Paragraph("/api/g-data/", sTableCell), Paragraph("24", sTableCell), Paragraph("Partial", sTableCell), Paragraph("No", sTableCell), Paragraph("No", sTableCell)],
    [Paragraph("/api/g-outreach/", sTableCell), Paragraph("26", sTableCell), Paragraph("Partial", sTableCell), Paragraph("No", sTableCell), Paragraph("No", sTableCell)],
    [Paragraph("/api/g-strategy/", sTableCell), Paragraph("9", sTableCell), Paragraph("Partial", sTableCell), Paragraph("No", sTableCell), Paragraph("No", sTableCell)],
    [Paragraph("/api/g-auth/", sTableCell), Paragraph("10", sTableCell), Paragraph("Yes", sTableCell), Paragraph("Yes", sTableCell), Paragraph("Yes", sTableCell)],
    [Paragraph("/api/g-system/", sTableCell), Paragraph("4", sTableCell), Paragraph("Partial", sTableCell), Paragraph("No", sTableCell), Paragraph("No", sTableCell)],
]
apt = Table([api_headers] + api_rows, colWidths=[115, 55, 75, 80, 80])
apt.setStyle(TableStyle([
    ('BACKGROUND', (0,0), (-1,0), HEADER_FILL),
    ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, TABLE_STRIPE]),
    ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ('GRID', (0,0), (-1,-1), 0.3, BORDER),
    ('TOPPADDING', (0,0), (-1,-1), 4),
    ('BOTTOMPADDING', (0,0), (-1,-1), 4),
    ('LEFTPADDING', (0,0), (-1,-1), 5),
    ('ALIGN', (1,1), (-1,-1), 'CENTER'),
]))
story.append(apt)
story.append(sp(6))
story.append(Paragraph("Critical finding: The withApiMiddleware wrapper that combines auth checking, rate limiting, and audit logging exists but is NOT consistently applied across API groups. The auth/ group uses it properly, but most other groups implement their own ad-hoc auth checking. Rate limiting is only enforced at the auth endpoints. The remaining 155+ endpoints lack rate limiting and consistent audit logging, which is a deployment readiness concern.", sSmall))

story.append(Paragraph("6.3 Intelligence API Deep Dive", sH2))
story.append(Paragraph("The g-intelligence API group provides the backbone for the Phase 7 screens. All 10 routes are functional and correctly mapped to their respective lib functions. The dashboard route aggregates intelligence health scores across all companies. The confidence route returns the four-dimension weighted breakdown. The trust-report route assembles a comprehensive explainability report for a specific recommendation. The source-reliability route provides per-domain reliability scores using Bayesian-inspired Laplace smoothing. The feedback route supports both POST (submit feedback) and GET (retrieve feedback) operations. The conflicts route lists all detected contradictions across the system. The validate route triggers the full signal validation pipeline for a specific company. All routes correctly use the Prisma client through the centralized db.ts singleton.", sBody))

story.append(PageBreak())

# ═══════════════════════════════════════════
# SECTION 7: DEMO DATA VS REAL DATA
# ═══════════════════════════════════════════
story.append(SectionBar("SECTION 7: DEMO DATA VS REAL DATA SEPARATION"))
story.append(sp(12))

story.append(Paragraph("The platform uses a hybrid approach for demo data: the Demo Experience Screen is 100% hardcoded with no API calls, while the Revenue Intelligence Dashboard uses a fallback pattern that attempts real API calls first and falls back to demo data on failure. This section evaluates the separation between demo and production data paths.", sBody))

story.append(Paragraph("7.1 Demo Data Patterns", sH2))

demo_headers = [Paragraph("Pattern", sTableHead), Paragraph("Screens", sTableHead), Paragraph("Risk", sTableHead), Paragraph("Assessment", sTableHead)]
demo_rows = [
    [Paragraph("Fully Hardcoded", sTableCell), Paragraph("Demo Experience (299 lines)", sTableCell), Paragraph("Low - no data path conflicts", sTableCell), badge("PASS")],
    [Paragraph("Hybrid (API + Fallback)", sTableCell), Paragraph("Revenue Intelligence (417 lines)", sTableCell), Paragraph("Medium - stale data risk", sTableCell), badge("WARN")],
    [Paragraph("Hybrid (API + Fallback)", sTableCell), Paragraph("Revenue Intelligence Brief (697 lines)", sTableCell), Paragraph("Medium - separate fallback data", sTableCell), badge("WARN")],
    [Paragraph("API Only (No Fallback)", sTableCell), Paragraph("Intelligence Reasoning (661 lines)", sTableCell), Paragraph("High - no demo path", sTableCell), badge("WARN")],
    [Paragraph("API Only (No Fallback)", sTableCell), Paragraph("Intelligence Report (764 lines)", sTableCell), Paragraph("High - no demo path", sTableCell), badge("WARN")],
]
dt = Table([demo_headers] + demo_rows, colWidths=[110, 150, 130, 60])
dt.setStyle(TableStyle([
    ('BACKGROUND', (0,0), (-1,0), HEADER_FILL),
    ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, TABLE_STRIPE]),
    ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ('GRID', (0,0), (-1,-1), 0.3, BORDER),
    ('TOPPADDING', (0,0), (-1,-1), 4),
    ('BOTTOMPADDING', (0,0), (-1,-1), 4),
    ('LEFTPADDING', (0,0), (-1,-1), 5),
]))
story.append(dt)

story.append(Paragraph("7.2 Dead-End Navigation Issue (Critical)", sH2))
story.append(Paragraph("The most significant demo data issue is the navigation dead-end created by the Demo Experience Screen. When a user clicks 'Explore Intelligence' on a demo company, the screen calls navigateTo('revenue-intelligence-brief', companyId) where companyId is a fake identifier like 'demo-aramco.com'. The Revenue Intelligence Brief screen then attempts to fetch data from /api/g-intelligence/companies/demo-aramco.com/validation-report, which will return a 404 or empty response because no company with that ID exists in the database. The screen has a loading state but no explicit handling for this scenario, resulting in an indefinite loading spinner or empty content area. This must be fixed by either: (a) ensuring demo companies exist in the database via a seed script, or (b) adding explicit demo mode detection in the brief screen that recognizes demo IDs and renders the hardcoded demo data instead of making API calls.", sBody))

story.append(Paragraph("7.3 Mock Data Module", sH2))
story.append(Paragraph("The mock-data.ts file contains approximately 3,500 lines of comprehensive mock data covering contacts, companies, segments, signals, and other entities. This module is used during development and testing but is not imported by any of the Phase 7 screens. The Phase 7 screens define their own inline demo data constants rather than importing from the centralized mock-data module. This duplication means the demo data in Phase 7 screens may diverge from the canonical mock data over time, creating inconsistency risks.", sBody))

story.append(PageBreak())

# ═══════════════════════════════════════════
# SECTION 8: EMPTY STATE & ERROR HANDLING
# ═══════════════════════════════════════════
story.append(SectionBar("SECTION 8: EMPTY STATE & ERROR HANDLING REVIEW"))
story.append(sp(12))

story.append(Paragraph("Robust empty state and error handling is critical for user experience, especially in a demo context where the database may be empty or partially populated. This section reviews how each Phase 7 screen handles these scenarios.", sBody))

story.append(Paragraph("8.1 Empty State Coverage", sH2))
story.append(Paragraph("The Revenue Intelligence Dashboard screen handles the empty state well: when no accounts have been analyzed, it displays a descriptive message 'No accounts analyzed yet' with a TrendingUp icon, providing clear guidance to the user. The Revenue Intelligence Brief screen includes loading skeletons that display while data is being fetched, and an empty state for when no validation data exists. The Intelligence Reasoning and Intelligence Report screens follow similar patterns with loading states and conditional rendering for empty data arrays.", sBody))
story.append(Paragraph("The Demo Experience Screen does not need empty state handling since it is entirely self-contained with hardcoded data. However, the Demo screen explicitly includes a footer note: 'Demo data is simulated for demonstration purposes' which is a good practice for managing user expectations.", sBody))

story.append(Paragraph("8.2 Error Handling Assessment", sH2))
err_headers = [Paragraph("Screen", sTableHead), Paragraph("Loading State", sTableHead), Paragraph("Empty State", sTableHead), Paragraph("Error Handling", sTableHead), Paragraph("Status", sTableHead)]
err_rows = [
    [Paragraph("Revenue Intelligence", sTableCell), Paragraph("Yes (skeleton)", sTableCell), Paragraph("Yes", sTableCell), Paragraph("Silent catch {}", sTableCell), badge("FAIL")],
    [Paragraph("Revenue Intelligence Brief", sTableCell), Paragraph("Yes (skeleton)", sTableCell), Paragraph("Yes", sTableCell), Paragraph("try/catch with error state", sTableCell), badge("PASS")],
    [Paragraph("Intelligence Reasoning", sTableCell), Paragraph("Yes", sTableCell), Paragraph("Yes", sTableCell), Paragraph("try/catch with error state", sTableCell), badge("PASS")],
    [Paragraph("Intelligence Report", sTableCell), Paragraph("Yes", sTableCell), Paragraph("Yes", sTableCell), Paragraph("try/catch with error state", sTableCell), badge("PASS")],
    [Paragraph("Demo Experience", sTableCell), Paragraph("N/A", sTableCell), Paragraph("N/A", sTableCell), Paragraph("No API calls", sTableCell), badge("PASS")],
]
et = Table([err_headers] + err_rows, colWidths=[100, 75, 65, 130, 55])
et.setStyle(TableStyle([
    ('BACKGROUND', (0,0), (-1,0), HEADER_FILL),
    ('BACKGROUND', (0,1), (-1,1), colors.HexColor('#fdf2f2')),
    ('ROWBACKGROUNDS', (0,2), (-1,-1), [colors.white, TABLE_STRIPE]),
    ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ('GRID', (0,0), (-1,-1), 0.3, BORDER),
    ('TOPPADDING', (0,0), (-1,-1), 4),
    ('BOTTOMPADDING', (0,0), (-1,-1), 4),
    ('LEFTPADDING', (0,0), (-1,-1), 5),
]))
story.append(et)
story.append(sp(6))
story.append(Paragraph("The Revenue Intelligence Dashboard screen has a critical error handling flaw: its API fetch is wrapped in a try/catch block with an empty catch clause (catch {}). When the /api/g-intelligence/dashboard endpoint fails, the error is silently swallowed and the screen falls back to demo data without any user notification. This means API outages, network errors, or server crashes will be invisible to the user, who will see demo data without realizing it is not live data. The fix is straightforward: add user-facing error feedback (toast notification or inline message) in the catch block.", sSmall))

story.append(Paragraph("8.3 Global Error Boundary", sH2))
story.append(Paragraph("The application includes an ErrorBoundary component that wraps the main application shell. However, React strict mode is disabled (reactStrictMode: false in next.config.ts), which means certain concurrent rendering bugs and lifecycle issues may not be caught during development. Additionally, 368 TypeScript errors are suppressed via ignoreBuildErrors: true, which means type-related errors that could cause runtime exceptions are not caught at build time. The combination of disabled strict mode and suppressed type errors creates an elevated risk of unhandled runtime errors reaching the user.", sBody))

story.append(PageBreak())

# ═══════════════════════════════════════════
# SECTION 9: SEARCH & DISCOVERY READINESS
# ═══════════════════════════════════════════
story.append(SectionBar("SECTION 9: SEARCH & DISCOVERY READINESS"))
story.append(sp(12))

story.append(Paragraph("Search and discovery capabilities are essential for users to locate companies, signals, and intelligence artifacts across the platform. This section evaluates the current search infrastructure and its readiness for Phase 8.", sBody))

story.append(Paragraph("9.1 Existing Search Capabilities", sH2))
story.append(Paragraph("The platform includes a knowledge-search.tsx component and a knowledge library screen (knowledge-library-screen.tsx) that provide search functionality. The command-palette.tsx component offers keyboard-driven navigation (Cmd+K) for quick access to screens and actions. The CRM module provides list-based filtering on companies, contacts, and leads screens. The g-ai API group includes a /search endpoint for knowledge graph queries. However, there is no unified full-text search across all entity types (companies, signals, evidence, recommendations) that would allow a user to search for 'Saudi Aramco funding round' and get results from signals, evidence, and recommendations simultaneously.", sBody))

story.append(Paragraph("9.2 Vector Search Infrastructure", sH2))
story.append(Paragraph("The codebase includes vector-index.ts and embeddings.ts modules, indicating planned or partial vector search capability. These modules are part of the research engine but their integration with the Phase 7 intelligence screens is not yet established. For Phase 8 demo readiness, the existing CRM-level search and command palette should be sufficient, as the demo flow is guided (users click through predefined screens rather than performing open-ended searches).", sBody))

story.append(Paragraph("9.3 Discovery Readiness Assessment", sH2))
story.append(Paragraph("The current discovery mechanisms are adequate for the guided demo experience. Users navigate through the Demo Experience Screen, which presents five pre-selected companies, and then drill down through the intelligence screens via clearly labeled navigation elements. No free-form search is required for the demo flow. For post-Phase 8 production use, a unified search experience would be valuable but is not a blocker for demo readiness.", sBody))

story.append(PageBreak())

# ═══════════════════════════════════════════
# SECTION 10: TESTING & QUALITY REPORT
# ═══════════════════════════════════════════
story.append(SectionBar("SECTION 10: TESTING & QUALITY REPORT"))
story.append(sp(12))

story.append(Paragraph("The test suite uses Vitest with @testing-library/react for component tests. This section provides a comprehensive analysis of test coverage across the entire codebase, identifying gaps that pose risks for Phase 8.", sBody))

story.append(Paragraph("10.1 Test Coverage Summary", sH2))

test_headers = [Paragraph("Module", sTableHead), Paragraph("Test File", sTableHead), Paragraph("Tests", sTableHead), Paragraph("Coverage", sTableHead), Paragraph("Status", sTableHead)]
test_rows = [
    [Paragraph("Account Prioritization", sTableCell), Paragraph("account-prioritization.test.ts", sTableCell), Paragraph("40+", sTableCell), Paragraph("Comprehensive", sTableCell), badge("PASS")],
    [Paragraph("ICP Configuration", sTableCell), Paragraph("icp-config.test.ts", sTableCell), Paragraph("40+", sTableCell), Paragraph("Comprehensive", sTableCell), badge("PASS")],
    [Paragraph("API Routes (Email)", sTableCell), Paragraph("api-routes.test.ts", sTableCell), Paragraph("25", sTableCell), Paragraph("Good", sTableCell), badge("PASS")],
    [Paragraph("Scoring Edge Cases", sTableCell), Paragraph("scoring-edge-cases.test.ts", sTableCell), Paragraph("20", sTableCell), Paragraph("Good", sTableCell), badge("PASS")],
    [Paragraph("Intelligence Health", sTableCell), Paragraph("intelligence-health.test.ts", sTableCell), Paragraph("12", sTableCell), Paragraph("Basic", sTableCell), badge("WARN")],
    [Paragraph("API Priority Routes", sTableCell), Paragraph("api-priority-routes.test.ts", sTableCell), Paragraph("15", sTableCell), Paragraph("Good", sTableCell), badge("PASS")],
    [Paragraph("Utilities", sTableCell), Paragraph("utils.test.ts", sTableCell), Paragraph("20", sTableCell), Paragraph("Good", sTableCell), badge("PASS")],
    [Paragraph("Intelligence Contract", sTableCell), Paragraph("NONE", sTableCell), Paragraph("0", sTableCell), Paragraph("ZERO", sTableCell), badge("FAIL")],
    [Paragraph("Research Engine (12 modules)", sTableCell), Paragraph("NONE", sTableCell), Paragraph("0", sTableCell), Paragraph("ZERO", sTableCell), badge("FAIL")],
    [Paragraph("AI Governance", sTableCell), Paragraph("NONE", sTableCell), Paragraph("0", sTableCell), Paragraph("ZERO", sTableCell), badge("FAIL")],
    [Paragraph("Data Intelligence (8 modules)", sTableCell), Paragraph("NONE", sTableCell), Paragraph("0", sTableCell), Paragraph("ZERO", sTableCell), badge("FAIL")],
    [Paragraph("All 45 Screen Components", sTableCell), Paragraph("NONE", sTableCell), Paragraph("0", sTableCell), Paragraph("ZERO", sTableCell), badge("FAIL")],
]
tt = Table([test_headers] + test_rows, colWidths=[120, 130, 35, 80, 50])
tt.setStyle(TableStyle([
    ('BACKGROUND', (0,0), (-1,0), HEADER_FILL),
    ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, TABLE_STRIPE]),
    ('BACKGROUND', (0,8), (-1,8), colors.HexColor('#fdf2f2')),
    ('BACKGROUND', (0,9), (-1,9), colors.HexColor('#fdf2f2')),
    ('BACKGROUND', (0,10), (-1,10), colors.HexColor('#fdf2f2')),
    ('BACKGROUND', (0,11), (-1,11), colors.HexColor('#fdf2f2')),
    ('BACKGROUND', (0,12), (-1,12), colors.HexColor('#fdf2f2')),
    ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ('GRID', (0,0), (-1,-1), 0.3, BORDER),
    ('TOPPADDING', (0,0), (-1,-1), 3),
    ('BOTTOMPADDING', (0,0), (-1,-1), 3),
    ('LEFTPADDING', (0,0), (-1,-1), 4),
]))
story.append(tt)

story.append(Paragraph("10.2 Critical Test Gaps", sH2))
story.append(Paragraph("The most significant test coverage gaps are in the intelligence pipeline core. The intelligence-contract.ts module, which serves as the single source of truth for all intelligence data access, has zero test coverage. This is particularly concerning because any bug in this module would affect every intelligence-consuming component and API route. The research engine modules (signals.ts, evidence.ts, signal-capability-matching.ts, opportunity-recommendation-engine.ts) collectively implement the core intelligence pipeline but have no automated tests. The AI governance layer (ai-governance.ts), which acts as a gatekeeper preventing low-confidence or hallucinated output from reaching users, is also completely untested. A bug in the governance layer could allow unreliable intelligence to be presented as high-confidence recommendations.", sBody))

story.append(Paragraph("10.3 UI Test Coverage", sH2))
story.append(Paragraph("None of the 45 screen components have any test coverage. While UI testing is typically deferred to later phases, the Phase 7 screens (2,862 lines) implement complex business logic including score calculations, data transformations, and conditional rendering based on intelligence metrics. The intelligence-reasoning-screen.tsx, for example, computes confidence breakdowns and factor contributions at render time - this logic should be tested independently of the React component to ensure accuracy.", sBody))

story.append(PageBreak())

# ═══════════════════════════════════════════
# SECTION 11: PERFORMANCE BASELINE
# ═══════════════════════════════════════════
story.append(SectionBar("SECTION 11: PERFORMANCE BASELINE"))
story.append(sp(12))

story.append(Paragraph("Performance assessment focuses on bundle size, lazy loading effectiveness, API response patterns, and database query efficiency. No runtime benchmarks were executed as part of this audit (per the audit boundary of validation without modification).", sBody))

story.append(Paragraph("11.1 Bundle & Loading Performance", sH2))
story.append(Paragraph("All 45 screen components use React.lazy() for code splitting, which is a strong performance practice. The initial page load only includes the page.tsx controller, the Zustand store, and the app shell - individual screen code is loaded on demand when the user navigates to that screen. This means the initial JavaScript bundle is relatively small despite the application's large total codebase. The Phase 7 screens are loaded only when the user enters the Revenue Intelligence section, keeping the initial load fast.", sBody))

story.append(Paragraph("11.2 API Response Patterns", sH2))
story.append(Paragraph("The intelligence API routes query the database directly using Prisma's findMany, findFirst, and aggregate methods. There are no N+1 query protections visible in the code (no includes or select optimizations on queries that load related data). For the dashboard route, which aggregates health scores across all companies, the query loads all CompanyIntelligenceHealth records without pagination. In a production environment with thousands of companies, this could result in slow API responses. The intelligence API routes also lack response caching - each request hits the database directly.", sBody))

story.append(Paragraph("11.3 Database Performance Considerations", sH2))
story.append(Paragraph("The Prisma schema includes indexing on frequently queried fields (companyId, signalType, status). The SQLite database used in development handles the current data volume well but has limitations for concurrent writes and complex joins. The production configuration uses Neon PostgreSQL via the Prisma adapter, which addresses these limitations. The ScoreEventBus (events.ts) provides in-process event propagation for score updates, avoiding unnecessary database polling for real-time updates.", sBody))

perf_headers = [Paragraph("Area", sTableHead), Paragraph("Current State", sTableHead), Paragraph("Risk", sTableHead), Paragraph("Phase 8 Impact", sTableHead)]
perf_rows = [
    [Paragraph("Code Splitting", sTableCell), Paragraph("React.lazy() on all 45 screens", sTableCell), Paragraph("Low", sTableCell), Paragraph("None - well optimized", sTableCell)],
    [Paragraph("Initial Bundle", sTableCell), Paragraph("Small (controller + shell only)", sTableCell), Paragraph("Low", sTableCell), Paragraph("Fast first load", sTableCell)],
    [Paragraph("API Caching", sTableCell), Paragraph("None (react-query unused)", sTableCell), Paragraph("Medium", sTableCell), Paragraph("Duplicate API calls on navigation", sTableCell)],
    [Paragraph("DB Pagination", sTableCell), Paragraph("Not implemented on dashboard", sTableCell), Paragraph("Medium", sTableCell), Paragraph("Slow with 1000+ companies", sTableCell)],
    [Paragraph("N+1 Queries", sTableCell), Paragraph("No includes/select optimization", sTableCell), Paragraph("Medium", sTableCell), Paragraph("Slow related data loading", sTableCell)],
    [Paragraph("In-Memory State", sTableCell), Paragraph("Rate limiting, event bus", sTableCell), Paragraph("Low (dev)", sTableCell), Paragraph("Must migrate for production", sTableCell)],
]
pt = Table([perf_headers] + perf_rows, colWidths=[85, 145, 70, CONTENT_W-300])
pt.setStyle(TableStyle([
    ('BACKGROUND', (0,0), (-1,0), HEADER_FILL),
    ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, TABLE_STRIPE]),
    ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ('GRID', (0,0), (-1,-1), 0.3, BORDER),
    ('TOPPADDING', (0,0), (-1,-1), 4),
    ('BOTTOMPADDING', (0,0), (-1,-1), 4),
    ('LEFTPADDING', (0,0), (-1,-1), 5),
]))
story.append(pt)

story.append(PageBreak())

# ═══════════════════════════════════════════
# SECTION 12: SECURITY & DEPLOYMENT
# ═══════════════════════════════════════════
story.append(SectionBar("SECTION 12: SECURITY & DEPLOYMENT BASELINE"))
story.append(sp(12))

story.append(Paragraph("Security assessment covers authentication, authorization, input validation, data protection, and deployment configuration. The platform implements several security measures but has gaps that should be addressed before production deployment.", sBody))

story.append(Paragraph("12.1 Security Strengths", sH2))
story.append(bullet("Session-based authentication with opaque tokens (more secure than JWTs for token theft scenarios)"))
story.append(bullet("OTP-based login with 6-digit codes, expiration, and attempt limiting"))
story.append(bullet("RBAC system with 4 roles (admin, manager, sales_rep, viewer) and 8 resource types"))
story.append(bullet("AI governance layer with confidence gates preventing low-quality output"))
story.append(bullet("Input sanitization module (sanitize.ts) available for API input cleaning"))
story.append(bullet("GDPR consent tracking on contacts (consentSource, consentDate, consentIp)"))
story.append(bullet("AI Generation Audit model tracks all LLM outputs with evidence provenance"))
story.append(bullet("Password hashing and session management with expiration"))
story.append(bullet("Suppression/unsubscribe system with method tracking for email compliance"))

story.append(Paragraph("12.2 Security Concerns", sH2))
sec_headers = [Paragraph("Concern", sTableHead), Paragraph("Severity", sTableHead), Paragraph("Details", sTableHead)]
sec_rows = [
    [Paragraph("Personal info in JSON-LD", sTableCell), Paragraph("HIGH", ParagraphStyle('r', parent=sTableCell, textColor=SEM_ERROR, fontName='DejaVuSansBd')),
     Paragraph("layout.tsx JSON-LD exposes email, LinkedIn URL, full name of developer", sTableCellWrap)],
    [Paragraph("In-memory rate limiting", sTableCell), Paragraph("MEDIUM", ParagraphStyle('w', parent=sTableCell, textColor=SEM_WARNING, fontName='DejaVuSansBd')),
     Paragraph("Resets on server restart; ineffective in serverless/multi-instance deployments", sTableCellWrap)],
    [Paragraph("No CSRF protection", sTableCell), Paragraph("MEDIUM", ParagraphStyle('w', parent=sTableCell, textColor=SEM_WARNING, fontName='DejaVuSansBd')),
     Paragraph("No anti-CSRF tokens on state-changing endpoints", sTableCellWrap)],
    [Paragraph("Inconsistent auth enforcement", sTableCell), Paragraph("MEDIUM", ParagraphStyle('w', parent=sTableCell, textColor=SEM_WARNING, fontName='DejaVuSansBd')),
     Paragraph("withApiMiddleware not applied to 155+ endpoints", sTableCellWrap)],
    [Paragraph("No Content-Security-Policy", sTableCell), Paragraph("LOW", ParagraphStyle('i', parent=sTableCell, textColor=SEM_INFO, fontName='DejaVuSansBd')),
     Paragraph("Missing CSP headers in next.config.ts", sTableCellWrap)],
    [Paragraph("368 suppressed TS errors", sTableCell), Paragraph("MEDIUM", ParagraphStyle('w', parent=sTableCell, textColor=SEM_WARNING, fontName='DejaVuSansBd')),
     Paragraph("Type-related security issues may be hidden", sTableCellWrap)],
]
sct = Table([sec_headers] + sec_rows, colWidths=[130, 55, CONTENT_W-185])
sct.setStyle(TableStyle([
    ('BACKGROUND', (0,0), (-1,0), HEADER_FILL),
    ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, TABLE_STRIPE]),
    ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ('GRID', (0,0), (-1,-1), 0.3, BORDER),
    ('TOPPADDING', (0,0), (-1,-1), 4),
    ('BOTTOMPADDING', (0,0), (-1,-1), 4),
    ('LEFTPADDING', (0,0), (-1,-1), 5),
]))
story.append(sct)

story.append(Paragraph("12.3 Deployment Configuration", sH2))
story.append(Paragraph("The next.config.ts is configured for standalone output mode (output: 'standalone'), which is the correct setting for Docker/containerized deployments. URL rewrites map clean API paths (e.g., /api/companies/) to the internal g-crm dispatcher. The poweredByHeader is set to false, removing Next.js fingerprinting from HTTP responses. The .env file contains only the DATABASE_URL pointing to a local SQLite file for development. Production environment variables (AI API keys, email provider credentials, database connection strings) are expected to be configured through the hosting platform's environment variable management.", sBody))

story.append(PageBreak())

# ═══════════════════════════════════════════
# SECTION 13: FINAL RECOMMENDATION
# ═══════════════════════════════════════════
story.append(SectionBar("SECTION 13: FINAL RECOMMENDATION"))
story.append(sp(12))

# Big verdict box
verdict_final = [
    [Paragraph("VERDICT", ParagraphStyle('vf1', fontName='DejaVuSansBd', fontSize=10, textColor=colors.white)),
     Paragraph("CONDITIONAL PASS", ParagraphStyle('vf2', fontName='DejaVuSansBd', fontSize=10, textColor=colors.white)),
     Paragraph("Phase 8 can begin after resolving 5 critical items", ParagraphStyle('vf3', fontName='DejaVuSans', fontSize=9, textColor=colors.HexColor('#f0e6c8')))],
]
vft = Table(verdict_final, colWidths=[70, 120, CONTENT_W-190])
vft.setStyle(TableStyle([
    ('BACKGROUND', (0,0), (1,0), SEM_WARNING),
    ('BACKGROUND', (2,0), (2,0), colors.HexColor('#3d3520')),
    ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ('TOPPADDING', (0,0), (-1,-1), 12),
    ('BOTTOMPADDING', (0,0), (-1,-1), 12),
    ('LEFTPADDING', (0,0), (-1,-1), 14),
]))
story.append(vft)
story.append(sp(14))

story.append(Paragraph("The DeepMindQ Intelligence Platform has achieved a solid foundation across seven development phases. The intelligence pipeline architecture is sound, the data model is comprehensive, and the Phase 7 screens deliver a compelling revenue intelligence experience. The platform is architecturally ready for Phase 8, but five specific issues must be resolved to ensure a stable demo and development environment.", sBody))

story.append(Paragraph("13.1 Mandatory Fixes Before Phase 8", sH2))
story.append(sp(4))

fix_headers = [Paragraph("Priority", sTableHead), Paragraph("Fix", sTableHead), Paragraph("File", sTableHead), Paragraph("Effort", sTableHead)]
fix_rows = [
    [Paragraph("P0", ParagraphStyle('p0', parent=sTableCell, textColor=SEM_ERROR, fontName='DejaVuSansBd')),
     Paragraph("Fix demo navigation dead-end: add demo ID detection in brief screen, or seed demo companies in DB", sTableCellWrap),
     Paragraph("demo-experience-screen.tsx + revenue-intelligence-brief-screen.tsx", sTableCellWrap), Paragraph("2h", sTableCell)],
    [Paragraph("P0", ParagraphStyle('p0', parent=sTableCell, textColor=SEM_ERROR, fontName='DejaVuSansBd')),
     Paragraph("Add error notification in revenue-intelligence-screen catch block (replace silent catch {})", sTableCellWrap),
     Paragraph("revenue-intelligence-screen.tsx:287", sTableCellWrap), Paragraph("30min", sTableCell)],
    [Paragraph("P0", ParagraphStyle('p0', parent=sTableCell, textColor=SEM_ERROR, fontName='DejaVuSansBd')),
     Paragraph("Remove personal information from JSON-LD in layout.tsx", sTableCellWrap),
     Paragraph("src/app/layout.tsx", sTableCellWrap), Paragraph("15min", sTableCell)],
    [Paragraph("P1", ParagraphStyle('p1', parent=sTableCell, textColor=SEM_WARNING, fontName='DejaVuSansBd')),
     Paragraph("Begin reducing 368 TypeScript errors (target: fix top 50 type errors, enable strict checks)", sTableCellWrap),
     Paragraph("Multiple files", sTableCellWrap), Paragraph("1-2 days", sTableCell)],
    [Paragraph("P1", ParagraphStyle('p1', parent=sTableCell, textColor=SEM_WARNING, fontName='DejaVuSansBd')),
     Paragraph("Add test coverage for intelligence-contract.ts (single source of truth)", sTableCellWrap),
     Paragraph("New: tests/intelligence-contract.test.ts", sTableCellWrap), Paragraph("4h", sTableCell)],
]
fixt = Table([fix_headers] + fix_rows, colWidths=[42, CONTENT_W*0.38, CONTENT_W*0.38, 48])
fixt.setStyle(TableStyle([
    ('BACKGROUND', (0,0), (-1,0), HEADER_FILL),
    ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, TABLE_STRIPE]),
    ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ('GRID', (0,0), (-1,-1), 0.3, BORDER),
    ('TOPPADDING', (0,0), (-1,-1), 5),
    ('BOTTOMPADDING', (0,0), (-1,-1), 5),
    ('LEFTPADDING', (0,0), (-1,-1), 5),
]))
story.append(fixt)

story.append(Paragraph("13.2 Phase 8 Scope Recommendations", sH2))
story.append(Paragraph("Once the five mandatory fixes are completed, Phase 8 should prioritize the following areas in order: First, UI/UX refinement of the five Phase 7 screens to ensure visual consistency, proper spacing, and responsive behavior across screen sizes. Second, comprehensive test coverage for the intelligence pipeline modules (research engine, AI governance, intelligence contract). Third, demo data seeding to ensure the demo flow works end-to-end without API failures. Fourth, performance optimization including React Query integration for API caching, database query optimization with pagination and eager loading, and bundle size analysis. Fifth, security hardening including consistent middleware application across all API routes, CSRF protection, and Content-Security-Policy headers.", sBody))

story.append(Paragraph("13.3 Out-of-Scope Items (Explicitly Excluded)", sH2))
story.append(bullet("No new features will be added as part of this audit or the recommended fixes"))
story.append(bullet("No modifications to intelligence scoring algorithms or AI/LLM pipeline logic"))
story.append(bullet("No CRM, SaaS, RBAC enhancement, multi-tenancy, or billing system changes"))
story.append(bullet("No database schema migrations or model additions"))
story.append(bullet("No new API endpoints beyond those needed for demo data seeding"))

story.append(sp(10))

# Summary scores
story.append(Paragraph("13.4 Section Scores Summary", sH2))
score_headers = [Paragraph("Section", sTableHead), Paragraph("Score", sTableHead), Paragraph("Notes", sTableHead)]
score_rows = [
    [Paragraph("1. Executive Summary", sTableCell), Paragraph("7.0 / 10", sTableCell), Paragraph("Strong foundation with 5 critical issues", sTableCell)],
    [Paragraph("2. E2E Flow Validation", sTableCell), Paragraph("8.0 / 10", sTableCell), Paragraph("Pipeline complete, demo flow has dead-end", sTableCell)],
    [Paragraph("3. Information Architecture", sTableCell), Paragraph("8.5 / 10", sTableCell), Paragraph("Well-organized, consistent patterns", sTableCell)],
    [Paragraph("4. Data Consistency", sTableCell), Paragraph("6.5 / 10", sTableCell), Paragraph("Dual demo data definitions, CSS class gaps", sTableCell)],
    [Paragraph("5. Architecture Review", sTableCell), Paragraph("8.0 / 10", sTableCell), Paragraph("Clean layers, API routes mix concerns", sTableCell)],
    [Paragraph("6. DB & API Readiness", sTableCell), Paragraph("7.5 / 10", sTableCell), Paragraph("Comprehensive schema, inconsistent middleware", sTableCell)],
    [Paragraph("7. Demo vs Real Data", sTableCell), Paragraph("5.5 / 10", sTableCell), Paragraph("Navigation dead-end is critical blocker", sTableCell)],
    [Paragraph("8. Empty/Error Handling", sTableCell), Paragraph("6.0 / 10", sTableCell), Paragraph("Silent catch, suppressed TS errors", sTableCell)],
    [Paragraph("9. Search & Discovery", sTableCell), Paragraph("7.0 / 10", sTableCell), Paragraph("Adequate for demo, needs unification later", sTableCell)],
    [Paragraph("10. Testing & Quality", sTableCell), Paragraph("4.5 / 10", sTableCell), Paragraph("Core intelligence modules untested", sTableCell)],
    [Paragraph("11. Performance Baseline", sTableCell), Paragraph("7.5 / 10", sTableCell), Paragraph("Good code splitting, no caching/pagination", sTableCell)],
    [Paragraph("12. Security & Deployment", sTableCell), Paragraph("6.5 / 10", sTableCell), Paragraph("Strong auth, gaps in enforcement", sTableCell)],
]
sct2 = Table([score_headers] + score_rows, colWidths=[145, 65, CONTENT_W-210])
sct2.setStyle(TableStyle([
    ('BACKGROUND', (0,0), (-1,0), HEADER_FILL),
    ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, TABLE_STRIPE]),
    ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ('GRID', (0,0), (-1,-1), 0.3, BORDER),
    ('TOPPADDING', (0,0), (-1,-1), 3),
    ('BOTTOMPADDING', (0,0), (-1,-1), 3),
    ('LEFTPADDING', (0,0), (-1,-1), 5),
]))
story.append(sct2)
story.append(sp(10))

# Final line
story.append(Paragraph("Overall Platform Readiness: 6.9 / 10 - CONDITIONAL PASS for Phase 8", ParagraphStyle('final', fontName='DejaVuSansBd', fontSize=11, leading=16, textColor=SEM_WARNING, alignment=TA_CENTER, spaceBefore=10)))

# ─── Page number footer ───
def add_page_number(canvas, doc):
    canvas.saveState()
    canvas.setFont('DejaVuSans', 7.5)
    canvas.setFillColor(TEXT_MUTED)
    canvas.drawString(LEFT_M, BOTTOM_M - 20, "Phase 1-7 Product Readiness Audit  |  DeepMindQ Intelligence Platform")
    canvas.drawRightString(PAGE_W - RIGHT_M, BOTTOM_M - 20, f"Page {doc.page}")
    canvas.restoreState()

# ─── Build ───
doc.build(story, onFirstPage=add_page_number, onLaterPages=add_page_number)
print(f"PDF generated: {OUTPUT}")
print(f"Size: {os.path.getsize(OUTPUT) / 1024:.1f} KB")