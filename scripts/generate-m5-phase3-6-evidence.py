#!/usr/bin/env python3
"""DeepMindQ M5 Phase 3-6 Final Evidence Package PDF Generator"""

from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib.colors import HexColor, white, black
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, HRFlowable
)
from reportlab.platypus.flowables import Flowable

# Colors
DARK_BLUE = HexColor("#1e3a5f")
MEDIUM_BLUE = HexColor("#2c5282")
LIGHT_BLUE = HexColor("#ebf4ff")
ACCENT_BLUE = HexColor("#3182ce")
DARK_GRAY = HexColor("#2d3748")
MEDIUM_GRAY = HexColor("#4a5568")
ALT_ROW = HexColor("#f0f5ff")
BORDER_GRAY = HexColor("#cbd5e0")
SUCCESS_GREEN = HexColor("#276749")
WARNING_ORANGE = HexColor("#c05621")
WHITE = white

OUTPUT = "/home/z/my-project/download/DeepMindQ_M5_Phase3-6_Final_Evidence_Package.pdf"

def make_styles():
    """Create all paragraph styles."""
    s = {}
    s['section_num'] = ParagraphStyle('sn', fontName='Helvetica-Bold', fontSize=11,
        leading=14, textColor=ACCENT_BLUE, spaceAfter=2)
    s['section_title'] = ParagraphStyle('st', fontName='Helvetica-Bold', fontSize=20,
        leading=26, textColor=DARK_BLUE, spaceAfter=4, spaceBefore=6)
    s['subsection'] = ParagraphStyle('ss', fontName='Helvetica-Bold', fontSize=14,
        leading=18, textColor=MEDIUM_BLUE, spaceAfter=6, spaceBefore=14)
    s['body'] = ParagraphStyle('bd', fontName='Helvetica', fontSize=10,
        leading=15, textColor=DARK_GRAY, alignment=TA_JUSTIFY, spaceAfter=6)
    s['body_bold'] = ParagraphStyle('bb', parent=s['body'], fontName='Helvetica-Bold')
    s['bullet'] = ParagraphStyle('bu', parent=s['body'], leftIndent=22,
        firstLineIndent=-12, spaceAfter=3, leading=14)
    s['bullet_sub'] = ParagraphStyle('bs', parent=s['bullet'], leftIndent=40,
        firstLineIndent=-12, fontSize=9.5, leading=13)
    s['th'] = ParagraphStyle('th', fontName='Helvetica-Bold', fontSize=9,
        leading=12, textColor=WHITE, alignment=TA_LEFT)
    s['tc'] = ParagraphStyle('tc', fontName='Helvetica', fontSize=9,
        leading=12, textColor=DARK_GRAY, alignment=TA_LEFT)
    s['tcc'] = ParagraphStyle('tcc', parent=s['tc'], alignment=TA_CENTER)
    s['tcb'] = ParagraphStyle('tcb', parent=s['tc'], fontName='Helvetica-Bold')
    return s

def styled_table(headers, rows, col_widths, s, alt=True):
    """Create a professionally styled table."""
    hdr = [Paragraph(h, s['th']) for h in headers]
    data = [hdr]
    for row in rows:
        data.append([Paragraph(str(c), s['tc']) for c in row])
    t = Table(data, colWidths=col_widths, splitByRow=True)
    cmds = [
        ('BACKGROUND', (0, 0), (-1, 0), DARK_BLUE),
        ('TEXTCOLOR', (0, 0), (-1, 0), WHITE),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
        ('TOPPADDING', (0, 0), (-1, 0), 8),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 6),
        ('TOPPADDING', (0, 1), (-1, -1), 6),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('GRID', (0, 0), (-1, -1), 0.5, BORDER_GRAY),
        ('LINEBELOW', (0, 0), (-1, 0), 1.5, DARK_BLUE),
    ]
    if alt:
        for i in range(1, len(data)):
            if i % 2 == 0:
                cmds.append(('BACKGROUND', (0, i), (-1, i), ALT_ROW))
    t.setStyle(TableStyle(cmds))
    return t

class Divider(Flowable):
    def __init__(self, w, h=3, color=DARK_BLUE):
        Flowable.__init__(self)
        self.width = w
        self.height = h
        self.color = color
    def draw(self):
        self.canv.setFillColor(self.color)
        self.canv.rect(0, 0, self.width, self.height, fill=1, stroke=0)

class MaturityBar(Flowable):
    def __init__(self, width, label, pre, post3, post6):
        Flowable.__init__(self)
        self.width = width
        self.label = label
        self.pre = pre
        self.post3 = post3
        self.post6 = post6
        self.height = 22
    def draw(self):
        c = self.canv
        bx = 1.8 * inch
        bw = self.width - 1.8 * inch
        by = 3
        bh = 14
        c.setFont("Helvetica", 8)
        c.setFillColor(DARK_GRAY)
        c.drawString(0, by + 3, self.label)
        c.setFillColor(HexColor("#edf2f7"))
        c.roundRect(bx, by, bw, bh, 3, fill=1, stroke=0)
        # Pre
        pw = bw * self.pre / 100
        c.setFillColor(HexColor("#fc8181"))
        c.rect(bx, by, pw, bh, fill=1, stroke=0)
        # P3
        p3w = bw * self.post3 / 100
        c.setFillColor(HexColor("#f6e05e"))
        if p3w > pw:
            c.rect(bx + pw, by, p3w - pw, bh, fill=1, stroke=0)
        # P6
        p6w = bw * self.post6 / 100
        c.setFillColor(HexColor("#68d391"))
        if p6w > p3w:
            c.rect(bx + p3w, by, p6w - p3w, bh, fill=1, stroke=0)
        # Labels
        c.setFont("Helvetica-Bold", 7)
        c.setFillColor(DARK_GRAY)
        c.drawString(bx + p3w + 3, by + 4, f"{self.post3}%")
        c.drawString(bx + p6w + 3, by + 4, f"{self.post6}%")

def draw_cover(c, doc):
    w, h = letter
    c.setFillColor(DARK_BLUE)
    c.rect(0, 0, w, h, fill=1, stroke=0)
    c.setStrokeColor(HexColor("#63b3ed"))
    c.setLineWidth(2)
    c.line(w*0.2, h*0.78, w*0.8, h*0.78)
    c.setFillColor(WHITE)
    c.setFont("Helvetica-Bold", 28)
    c.drawCentredString(w/2, h*0.66, "DeepMindQ Enterprise")
    c.drawCentredString(w/2, h*0.61, "Intelligence Operating System")
    c.setFillColor(HexColor("#bee3f8"))
    c.setFont("Helvetica", 16)
    c.drawCentredString(w/2, h*0.53, "M5 Build - Phase 3 through Phase 6")
    c.drawCentredString(w/2, h*0.50, "Evidence Package")
    c.setStrokeColor(HexColor("#63b3ed"))
    c.setLineWidth(1)
    c.line(w*0.3, h*0.45, w*0.7, h*0.45)
    c.setFillColor(HexColor("#90cdf4"))
    c.setFont("Helvetica", 11)
    c.drawCentredString(w/2, h*0.40, "August 6, 2026")
    c.drawCentredString(w/2, h*0.37, "Build ID: M5-Phase3-6-Final")
    c.setFont("Helvetica", 9)
    c.drawCentredString(w/2, h*0.28, "CONFIDENTIAL - Internal Engineering Evidence")
    c.setStrokeColor(HexColor("#63b3ed"))
    c.setLineWidth(2)
    c.line(w*0.2, h*0.22, w*0.8, h*0.22)

def later_pages(c, doc):
    pn = c.getPageNumber()
    if pn == 1:
        return
    c.saveState()
    c.setStrokeColor(BORDER_GRAY)
    c.setLineWidth(0.5)
    c.line(0.75*inch, 0.55*inch, 7.75*inch, 0.55*inch)
    c.setFont('Helvetica', 8)
    c.setFillColor(MEDIUM_GRAY)
    c.drawRightString(7.75*inch, 0.38*inch, f"Page {pn}")
    c.drawString(0.75*inch, 0.38*inch, "DeepMindQ M5 Phase 3-6 Evidence Package | M5-Phase3-6-Final")
    c.setFillColor(DARK_BLUE)
    c.rect(0, 10.3*inch, 8.5*inch, 0.18*inch, fill=1, stroke=0)
    c.restoreState()

def build():
    doc = SimpleDocTemplate(
        OUTPUT, pagesize=letter,
        topMargin=0.85*inch, bottomMargin=0.75*inch,
        leftMargin=0.75*inch, rightMargin=0.75*inch,
        title="DeepMindQ M5 Phase 3-6 Final Evidence Package",
        author="DeepMindQ Engineering",
    )
    S = make_styles()
    story = []
    W = 7.0 * inch

    # Cover
    story.append(Spacer(1, 1))
    story.append(PageBreak())

    # ===== SECTION 1: EXECUTIVE SUMMARY =====
    story.append(Divider(W))
    story.append(Spacer(1, 6))
    story.append(Paragraph("SECTION 1", S['section_num']))
    story.append(Paragraph("Executive Summary", S['section_title']))
    story.append(Spacer(1, 10))
    story.append(Paragraph(
        "The M5 build session focused on the <b>Composition + Trust + Enterprise Experience Layer</b> of the "
        "DeepMindQ Intelligence Operating System. Across four consecutive phases (Phase 3 through Phase 6), "
        "the engineering team delivered a comprehensive trust infrastructure, enterprise agent composition "
        "framework, decision learning system, and production readiness hardening.", S['body']))
    story.append(Spacer(1, 8))

    # Metrics row
    metrics = [["38 Files Created/Modified", "7,634 Lines Added",
                 "152 Unit Tests Passing", "0 TypeScript Errors", "0 Duplicate Engines"]]
    mt = Table(metrics, colWidths=[W/5]*5)
    mt.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), LIGHT_BLUE),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
        ('FONTNAME', (0, 0), (-1, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('TEXTCOLOR', (0, 0), (-1, -1), DARK_BLUE),
        ('LINEAFTER', (0, 0), (3, -1), 0.5, BORDER_GRAY),
        ('BOX', (0, 0), (-1, -1), 0.5, BORDER_GRAY),
    ]))
    story.append(mt)
    story.append(Spacer(1, 14))
    story.append(Paragraph("<b>Architecture Principle Enforced:</b>", S['body_bold']))
    story.append(Paragraph(
        "- All existing intelligence engines remain <b>untouched</b> (compose-only architecture)<br/>"
        "- Zero duplicate intelligence engines created across all 4 phases<br/>"
        "- New capabilities achieved exclusively through <b>composition</b> of existing engines", S['bullet']))
    story.append(PageBreak())

    # ===== SECTION 2: GIT EVIDENCE =====
    story.append(Divider(W))
    story.append(Spacer(1, 6))
    story.append(Paragraph("SECTION 2", S['section_num']))
    story.append(Paragraph("Git Evidence", S['section_title']))
    story.append(Spacer(1, 10))

    story.append(Paragraph("Phase 3 - Commit f827f49", S['subsection']))
    story.append(Paragraph("- <b>28 files changed</b>, <b>4,283 lines added</b>", S['bullet']))
    story.append(Spacer(1, 4))
    story.append(Paragraph("<b>New files created:</b>", S['body_bold']))
    for f in [
        "hallucination-prevention.ts",
        "trust-dashboard API route",
        "company trust detail API route",
        "3 trust UI components (confidence-indicator, trust-breakdown-chart, trust-score-badge)",
        "2 dashboard screens (trust-dashboard-screen, company-trust-detail-screen)",
        "8 test files (trust-metadata, financial-intelligence, clearbit-connector, hallucination-prevention, data-lineage, market-discovery, wow4-knowledge, halluc-minimal)",
        "vitest.m5.config.ts",
    ]:
        story.append(Paragraph(f"    - {f}", S['bullet_sub']))
    story.append(Spacer(1, 4))
    story.append(Paragraph("<b>Modified files:</b>", S['body_bold']))
    for f in [
        "enrich/route.ts - recordLineage() wired into enrichment API (5 fields tracked)",
        "executive-intelligence-brief.ts - brief generation tracked via lineage",
        "data-lineage-service.ts - bug fix (no-data fallback + timestamp guard)",
        "trust-metadata.ts - source reliability maps consolidated",
        "types.ts - trust type extensions",
        "market-discovery.ts - withTrust() decorator activated",
        "m5-wow4-knowledge-intelligence.ts - withTrust() decorator activated",
    ]:
        story.append(Paragraph(f"    - {f}", S['bullet_sub']))
    story.append(Spacer(1, 14))

    story.append(Paragraph("Phase 4-6 - Commit cc449b4", S['subsection']))
    story.append(Paragraph("- <b>10 files changed</b>, <b>3,351 lines added</b>", S['bullet']))
    story.append(Spacer(1, 4))
    story.append(Paragraph("<b>New files created:</b>", S['body_bold']))
    for f in [
        "enterprise-agents.ts - 5 enterprise agent definitions with engine composition",
        "decision-learning.ts - feedback-driven confidence adjustment system",
        "security-validation.ts - 10-point security audit framework",
        "audit-trail-service.ts - operational audit trail via Evidence model",
        "agents API route - POST/GET enterprise agent routing endpoint",
        "audit API route - audit trail query endpoint",
        "health API route - health check with DB connectivity test",
        "security-audit API route - security audit endpoint (admin)",
    ]:
        story.append(Paragraph(f"    - {f}", S['bullet_sub']))
    story.append(Spacer(1, 4))
    story.append(Paragraph("<b>Modified files:</b>", S['body_bold']))
    story.append(Paragraph("    - feedback API route - enhanced with decision learning integration", S['bullet_sub']))
    story.append(PageBreak())

    # ===== SECTION 3: ARCHITECTURE EVIDENCE =====
    story.append(Divider(W))
    story.append(Spacer(1, 6))
    story.append(Paragraph("SECTION 3", S['section_num']))
    story.append(Paragraph("Architecture Evidence", S['section_title']))
    story.append(Spacer(1, 10))

    story.append(Paragraph("Phase 3 - AI Trust Layer", S['subsection']))
    for item in [
        "<b>recordLineage()</b> wired into enrichment API - 5 fields tracked (companyId, source, dataType, recordCount, processingTimeMs)",
        "<b>recordLineage()</b> wired into executive brief - brief generation tracked with full metadata",
        "<b>getDataFreshnessStats()</b> bug fixed - no-data fallback prevents NaN, timestamp guard prevents future-dated freshness",
        "<b>Source reliability maps consolidated</b> - getReliabilityScore() serves as single source of truth for all reliability lookups",
        "<b>withTrust() decorator</b> activated in market-discovery.ts and m5-wow4-knowledge-intelligence.ts - all outputs carry TRUST metadata",
    ]:
        story.append(Paragraph(f"- {item}", S['bullet']))
    story.append(Spacer(1, 6))
    story.append(Paragraph("<b>Hallucination Prevention Module:</b>", S['body_bold']))
    for item in [
        "<b>extractClaims()</b> - Parses AI output into discrete, verifiable claim objects",
        "<b>verifyClaims()</b> - Cross-references claims against known data sources",
        "<b>scoreAnswerSafety()</b> - Assigns safety score (0-100) to each AI response",
        "<b>guardAgainstHallucination()</b> - Wrapper that intercepts and filters unsafe outputs",
    ]:
        story.append(Paragraph(f"    - {item}", S['bullet_sub']))
    story.append(Paragraph(
        "- <b>Integrated into WOW #4</b> as Phase 8.5 - safety report + risk level attached to every knowledge intelligence output",
        S['bullet']))
    story.append(Spacer(1, 14))

    story.append(Paragraph("Phase 4 - Enterprise Agents (5 Agents)", S['subsection']))
    story.append(Spacer(1, 6))
    story.append(styled_table(
        ["Agent", "Engines Composed"],
        [
            ["Account Intelligence", "executive-brief, financial-framework, engagement-prediction"],
            ["Research", "knowledge-intelligence, hallucination-prevention"],
            ["Sales Strategy", "account-scoring, buying-intent, ICP-config, executive-brief"],
            ["Meeting Preparation", "meeting-brief, executive-brief"],
            ["Executive Decision", "knowledge-intelligence, market-discovery, hallucination-prevention"],
        ],
        [1.6*inch, 5.4*inch], S
    ))
    story.append(Spacer(1, 14))

    story.append(Paragraph("Phase 5 - Decision Learning", S['subsection']))
    for item in [
        "<b>submitFeedback()</b> - Records user feedback on agent recommendations with effectiveness rating",
        "<b>getLearningStats()</b> - Aggregates per-agent effectiveness statistics over time",
        "<b>adjustConfidence()</b> - Dynamically adjusts agent confidence based on feedback history",
        "<b>getFeedbackSummary()</b> - Returns trend data for agent performance monitoring",
        "<b>Per-agent effectiveness scoring</b> - Individual accuracy tracking for each of the 5 enterprise agents",
        "<b>Trend detection</b> - Identifies improving or degrading agent performance over rolling windows",
        "<b>Confidence adjustment algorithm:</b> +10% for high effectiveness feedback, -15% for low effectiveness",
    ]:
        story.append(Paragraph(f"- {item}", S['bullet']))
    story.append(Spacer(1, 14))

    story.append(Paragraph("Phase 6 - Production Readiness", S['subsection']))
    for item in [
        "<b>10/10 security checks passing</b> - Full security validation framework implemented",
        "<b>Audit trail service</b> - All significant operations logged via Evidence model with full context",
        "<b>Health check endpoint</b> - Database connectivity verification with response time measurement",
        "<b>Security audit endpoint</b> - Admin-only endpoint exposing full security posture assessment",
    ]:
        story.append(Paragraph(f"- {item}", S['bullet']))
    story.append(Spacer(1, 10))

    # Green callout box
    nd = [[Paragraph(
        '<font color="#276749"><b>No Duplicate Engines Created</b></font><br/><br/>'
        '<font size="9">All modules compose existing engines via import. Zero new intelligence generation. '
        'The compose-only architecture principle was strictly enforced across all 4 phases.</font>',
        ParagraphStyle('nd', textColor=DARK_GRAY, leading=14))]]
    nt = Table(nd, colWidths=[W])
    nt.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), HexColor("#f0fff4")),
        ('BOX', (0, 0), (-1, -1), 1.5, SUCCESS_GREEN),
        ('TOPPADDING', (0, 0), (-1, -1), 12),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
        ('LEFTPADDING', (0, 0), (-1, -1), 14),
        ('RIGHTPADDING', (0, 0), (-1, -1), 14),
    ]))
    story.append(nt)
    story.append(PageBreak())

    # ===== SECTION 4: TESTING EVIDENCE =====
    story.append(Divider(W))
    story.append(Spacer(1, 6))
    story.append(Paragraph("SECTION 4", S['section_num']))
    story.append(Paragraph("Testing Evidence", S['section_title']))
    story.append(Spacer(1, 10))
    story.append(Paragraph(
        'A dedicated test configuration (<b>vitest.m5.config.ts</b>) was created for M5-specific tests. '
        'All 152 unit tests pass with zero TypeScript errors.', S['body']))
    story.append(Spacer(1, 8))

    # Test table with green status
    test_hdr = [Paragraph(h, S['th']) for h in ["Test File", "Tests", "Status"]]
    test_data = [test_hdr]
    gp_style = ParagraphStyle('gp', parent=S['tc'], textColor=SUCCESS_GREEN, fontName='Helvetica-Bold', alignment=TA_CENTER)
    for fname, cnt in [
        ("trust-metadata.test.ts", "31"),
        ("clearbit-connector.test.ts", "30"),
        ("financial-intelligence.test.ts", "25"),
        ("market-discovery.test.ts", "19"),
        ("hallucination-prevention.test.ts", "17"),
        ("wow4-knowledge.test.ts", "17"),
        ("data-lineage.test.ts", "12"),
        ("halluc-minimal.test.ts", "1"),
    ]:
        test_data.append([
            Paragraph(fname, S['tc']),
            Paragraph(cnt, S['tcc']),
            Paragraph("ALL PASS", gp_style),
        ])
    # Total row
    test_data.append([
        Paragraph("<b>Total</b>", S['tcb']),
        Paragraph("<b>152</b>", ParagraphStyle('tbc', parent=S['tcc'], fontName='Helvetica-Bold')),
        Paragraph("<b>ALL PASSING</b>", ParagraphStyle('gpb', parent=gp_style)),
    ])
    tt = Table(test_data, colWidths=[3.2*inch, 1.2*inch, 1.6*inch], splitByRow=True)
    tt.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), DARK_BLUE),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('GRID', (0, 0), (-1, -1), 0.5, BORDER_GRAY),
        ('BACKGROUND', (0, -1), (-1, -1), HexColor("#f0fff4")),
        ('LINEABOVE', (0, -1), (-1, -1), 1.5, DARK_BLUE),
        ('BOX', (0, -1), (-1, -1), 1, SUCCESS_GREEN),
    ]))
    story.append(tt)
    story.append(Spacer(1, 12))
    story.append(Paragraph(
        "- <b>0 TypeScript errors</b> - Full type safety across all new and modified files<br/>"
        "- <b>Pre-commit hooks passing</b> - ESLint + TypeScript check enforced on every commit", S['bullet']))
    story.append(PageBreak())

    # ===== SECTION 5: RUNTIME EVIDENCE =====
    story.append(Divider(W))
    story.append(Spacer(1, 6))
    story.append(Paragraph("SECTION 5", S['section_num']))
    story.append(Paragraph("Runtime Evidence - API Endpoints", S['section_title']))
    story.append(Spacer(1, 10))
    story.append(Paragraph(
        'Seven API endpoints were created or enhanced during the M5 build session. All endpoints are '
        'protected with authentication checks (checkApiAuth) and rate limiting.', S['body']))
    story.append(Spacer(1, 8))
    story.append(styled_table(
        ["Endpoint", "Method", "Purpose"],
        [
            ["/api/trust/dashboard", "GET", "Platform-wide TRUST statistics aggregation"],
            ["/api/trust/company/[id]", "GET", "Per-company TRUST breakdown with source details"],
            ["/api/agents", "POST / GET", "Enterprise agent routing and orchestration"],
            ["/api/intelligence/feedback", "POST / GET", "Feedback submission and learning stats"],
            ["/api/intelligence/health", "GET", "Health check with DB connectivity test"],
            ["/api/intelligence/security-audit", "GET", "Security audit (admin-only endpoint)"],
            ["/api/intelligence/audit", "GET", "Audit trail query with filtering"],
        ],
        [2.4*inch, 1.1*inch, 3.5*inch], S
    ))
    story.append(PageBreak())

    # ===== SECTION 6: PRODUCTION READINESS =====
    story.append(Divider(W))
    story.append(Spacer(1, 6))
    story.append(Paragraph("SECTION 6", S['section_num']))
    story.append(Paragraph("Production Readiness", S['section_title']))
    story.append(Spacer(1, 10))
    story.append(Paragraph(
        'Phase 6 established a comprehensive production readiness baseline. All security, reliability, '
        'and operational checks are passing.', S['body']))
    story.append(Spacer(1, 8))
    story.append(styled_table(
        ["Check", "Status", "Details"],
        [
            ["Security", "10/10 passing", "Full security validation framework"],
            ["Rate Limiting", "Active", "All M5 routes protected with rate limits"],
            ["Authentication", "Enforced", "checkApiAuth() on all endpoints"],
            ["SQL Injection", "Protected", "All Prisma ORM, zero raw queries"],
            ["Error Handling", "Safe", "No stack traces leaked to clients"],
            ["Hallucination Guard", "Active", "Active on WOW #4 knowledge intelligence"],
            ["TRUST Metadata", "Attached", "All intelligence outputs carry TRUST scores"],
            ["Tenant Isolation", "Enforced", "All queries companyId-scoped"],
            ["Audit Trail", "Operational", "Operational via Evidence model"],
            ["Health Check", "Passing", "DB connectivity verified per request"],
        ],
        [1.5*inch, 1.2*inch, 4.3*inch], S
    ))
    story.append(PageBreak())

    # ===== SECTION 7: MATURITY SCORES =====
    story.append(Divider(W))
    story.append(Spacer(1, 6))
    story.append(Paragraph("SECTION 7", S['section_num']))
    story.append(Paragraph("Maturity Scores - Progression Across Phases", S['section_title']))
    story.append(Spacer(1, 10))
    story.append(Paragraph(
        'The following table shows the maturity progression across five key dimensions, '
        'measured at three checkpoints: pre-M5 baseline, post-Phase 3, and post-Phase 6.', S['body']))
    story.append(Spacer(1, 8))

    # Maturity table
    mc = ParagraphStyle('mc', parent=S['tc'], alignment=TA_CENTER)
    mcb = ParagraphStyle('mcb', parent=S['tc'], alignment=TA_CENTER, fontName='Helvetica-Bold')
    mcl = ParagraphStyle('mcl', parent=S['tc'], fontName='Helvetica-Bold')
    delta_s = ParagraphStyle('ds', parent=S['tc'], alignment=TA_CENTER, textColor=SUCCESS_GREEN, fontName='Helvetica-Bold')

    mh = [Paragraph(h, S['th']) for h in ["Dimension", "Pre-M5", "Post-Phase 3", "Post-Phase 6", "Delta"]]
    mat_data = [mh]
    for dim, pre, p3, p6, delta in [
        ("Technical Completeness", "77%", "82%", "90%", "+13%"),
        ("Intelligence Quality", "65%", "80%", "88%", "+23%"),
        ("Enterprise Experience", "33%", "60%", "85%", "+52%"),
        ("Trust Transparency", "10%", "65%", "90%", "+80%"),
        ("Production Readiness", "50%", "60%", "88%", "+38%"),
    ]:
        mat_data.append([
            Paragraph(dim, mcl), Paragraph(pre, mc),
            Paragraph(p3, mc), Paragraph(p6, mc), Paragraph(delta, delta_s)])
    # Composite
    comp_dim = ParagraphStyle('cd', parent=mcl, fontSize=10, textColor=DARK_BLUE)
    comp_val = ParagraphStyle('cv', parent=mcb, textColor=SUCCESS_GREEN)
    mat_data.append([
        Paragraph("COMPOSITE", comp_dim),
        Paragraph("47%", mcb), Paragraph("69%", mcb),
        Paragraph("88%", comp_val), Paragraph("+41%", delta_s)])

    mat_t = Table(mat_data, colWidths=[1.8*inch, 1.1*inch, 1.2*inch, 1.2*inch, 0.9*inch], splitByRow=True)
    mat_cmds = [
        ('BACKGROUND', (0, 0), (-1, 0), DARK_BLUE),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
        ('TOPPADDING', (0, 0), (-1, 0), 8),
        ('BOTTOMPADDING', (0, 1), (-1, -2), 6),
        ('TOPPADDING', (0, 1), (-1, -2), 6),
        ('GRID', (0, 0), (-1, -1), 0.5, BORDER_GRAY),
        ('LINEABOVE', (0, -1), (-1, -1), 2, DARK_BLUE),
        ('BACKGROUND', (0, -1), (-1, -1), HexColor("#e2e8f0")),
        ('BOTTOMPADDING', (0, -1), (-1, -1), 8),
        ('TOPPADDING', (0, -1), (-1, -1), 8),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
    ]
    mat_t.setStyle(TableStyle(mat_cmds))
    story.append(mat_t)
    story.append(Spacer(1, 14))

    # Maturity bars
    story.append(Paragraph("<b>Maturity Progression Visualization:</b>", S['body_bold']))
    story.append(Spacer(1, 6))
    for label, pre, p3, p6 in [
        ("Technical Completeness", 77, 82, 90),
        ("Intelligence Quality", 65, 80, 88),
        ("Enterprise Experience", 33, 60, 85),
        ("Trust Transparency", 10, 65, 90),
        ("Production Readiness", 50, 60, 88),
        ("COMPOSITE", 47, 69, 88),
    ]:
        story.append(MaturityBar(W, label, pre, p3, p6))
        story.append(Spacer(1, 3))
    story.append(Spacer(1, 6))
    # Legend
    leg = [[
        Paragraph('<font color="#fc8181">Pre-M5</font>', ParagraphStyle('l1', fontSize=8, textColor=DARK_GRAY)),
        Paragraph('<font color="#f6e05e">Post-Phase 3</font>', ParagraphStyle('l2', fontSize=8, textColor=DARK_GRAY)),
        Paragraph('<font color="#68d391">Post-Phase 6</font>', ParagraphStyle('l3', fontSize=8, textColor=DARK_GRAY)),
    ]]
    lt = Table(leg, colWidths=[1.5*inch]*3)
    lt.setStyle(TableStyle([('ALIGN', (0,0), (-1,-1), 'CENTER')]))
    story.append(lt)
    story.append(PageBreak())

    # ===== SECTION 8: REMAINING RISKS =====
    story.append(Divider(W))
    story.append(Spacer(1, 6))
    story.append(Paragraph("SECTION 8", S['section_num']))
    story.append(Paragraph("Remaining Risks", S['section_title']))
    story.append(Spacer(1, 10))
    story.append(Paragraph(
        'The following risks have been identified and documented for post-M5 remediation. '
        'None are blockers for the current release, but each should be addressed in a subsequent build cycle.', S['body']))
    story.append(Spacer(1, 8))

    risks = [
        ("Clearbit API Rate Limit",
         "The rate limiter for the Clearbit connector is in-memory only. Rate limit counters reset on server restart, which could allow temporary overconsumption of API quota following a deployment."),
        ("Lineage Database Table",
         "Data lineage tracking currently uses the Evidence model as a workaround rather than a dedicated lineage database table. This limits query performance and filtering capabilities for lineage data at scale."),
        ("Decision Learning Cold Start",
         "The decision learning system requires an initial accumulation of user feedback before confidence adjustments become statistically meaningful. Early recommendations may not reflect learned preferences."),
        ("Static Security Analysis",
         "The security audit endpoint uses static code analysis only. It does not include runtime penetration testing, which means certain runtime-only vulnerabilities may not be detected."),
        ("Concurrent Agent Load Testing",
         "No load testing has been performed for concurrent enterprise agent execution. Performance under high concurrency has not been validated."),
        ("Health Check Scope",
         "The health check endpoint performs a basic DB ping and environment variable check. It does not monitor Redis availability, message queue depth, or other infrastructure dependencies."),
    ]

    rh = [Paragraph(h, S['th']) for h in ["#", "Risk", "Impact Description"]]
    rdata = [rh]
    num_s = ParagraphStyle('rn', parent=S['tc'], alignment=TA_CENTER, textColor=WARNING_ORANGE, fontName='Helvetica-Bold')
    rb_s = ParagraphStyle('rb', parent=S['tc'], fontName='Helvetica-Bold')
    for i, (title, desc) in enumerate(risks, 1):
        rdata.append([Paragraph(str(i), num_s), Paragraph(title, rb_s), Paragraph(desc, S['tc'])])

    # Split risk table into two halves to avoid page overflow
    half = len(rdata) // 2 + 1  # 4 rows (header + 3 data)
    rt1_data = rdata[:half]
    rt2_data = [rh] + rdata[half:]  # repeat header

    cw = [0.4*inch, 1.6*inch, 5.0*inch]
    rt1 = Table(rt1_data, colWidths=cw, splitByRow=True)
    rt1.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), DARK_BLUE),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('GRID', (0, 0), (-1, -1), 0.5, BORDER_GRAY),
        ('BACKGROUND', (0, 2), (-1, 2), ALT_ROW),
    ]))
    story.append(rt1)
    story.append(Spacer(1, 8))

    rt2 = Table(rt2_data, colWidths=cw, splitByRow=True)
    rt2.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), DARK_BLUE),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('GRID', (0, 0), (-1, -1), 0.5, BORDER_GRAY),
        ('BACKGROUND', (0, 2), (-1, 2), ALT_ROW),
    ]))
    story.append(rt2)

    story.append(Spacer(1, 20))
    story.append(Divider(W, 1, BORDER_GRAY))
    story.append(Spacer(1, 10))
    story.append(Paragraph(
        "<b>End of Evidence Package</b>",
        ParagraphStyle('end', parent=S['body'], alignment=TA_CENTER, textColor=DARK_BLUE, fontSize=11)))
    story.append(Spacer(1, 4))
    story.append(Paragraph(
        'DeepMindQ Enterprise Intelligence Operating System - M5 Build (Phase 3-6)<br/>'
        'Build ID: M5-Phase3-6-Final | Date: August 6, 2026<br/>'
        'This document constitutes the complete evidence record for the M5 Phase 3 through Phase 6 build cycle.',
        ParagraphStyle('em', parent=S['body'], alignment=TA_CENTER, textColor=MEDIUM_GRAY, fontSize=9)))

    doc.build(story, onFirstPage=draw_cover, onLaterPages=later_pages)
    print(f"PDF generated: {OUTPUT}")

if __name__ == "__main__":
    build()
