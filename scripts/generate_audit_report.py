#!/usr/bin/env python3
"""
DeepMindQ Intelligence Architecture Maturity Audit Report Generator
Dedicated Enterprise Instance Architecture — Final Assessment
"""

import sys, os
sys.path.insert(0, '/home/z/my-project/skills/pdf/scripts')

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch, cm
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, KeepTogether, HRFlowable, Image
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase.pdfmetrics import registerFontFamily
from reportlab.platypus.tableofcontents import TableOfContents
from reportlab.platypus.doctemplate import PageTemplate, BaseDocTemplate, Frame
from reportlab.platypus import NextPageTemplate

# ── Font Registration ──────────────────────────────────────────
FONT_DIR = '/usr/share/fonts'
pdfmetrics.registerFont(TTFont('NotoSerifSC', f'{FONT_DIR}/truetype/noto-serif-sc/NotoSerifSC-Regular.ttf'))
pdfmetrics.registerFont(TTFont('NotoSerifSC-Bold', f'{FONT_DIR}/truetype/noto-serif-sc/NotoSerifSC-Bold.ttf'))
registerFontFamily('NotoSerifSC', normal='NotoSerifSC', bold='NotoSerifSC-Bold')

pdfmetrics.registerFont(TTFont('NotoSansSC', f'{FONT_DIR}/truetype/chinese/SarasaMonoSC-Bold.ttf'))
pdfmetrics.registerFont(TTFont('NotoSansSC-Bold', f'{FONT_DIR}/truetype/chinese/SarasaMonoSC-Bold.ttf'))

# ── Cascade Palette ────────────────────────────────────────────
PAGE_BG       = colors.HexColor('#f5f5f4')
SECTION_BG    = colors.HexColor('#edeceb')
CARD_BG       = colors.HexColor('#f0efed')
TABLE_STRIPE  = colors.HexColor('#eeeeeb')
HEADER_FILL   = colors.HexColor('#625a42')
COVER_BLOCK   = colors.HexColor('#766b47')
BORDER        = colors.HexColor('#d6d3cb')
ICON_COLOR    = colors.HexColor('#b3994a')
ACCENT        = colors.HexColor('#8a7127')
ACCENT_2      = colors.HexColor('#5635b8')
TEXT_PRIMARY   = colors.HexColor('#191816')
TEXT_MUTED     = colors.HexColor('#89877f')
SEM_SUCCESS   = colors.HexColor('#469962')
SEM_WARNING   = colors.HexColor('#a8894b')
SEM_ERROR     = colors.HexColor('#a7564e')
SEM_INFO      = colors.HexColor('#4e7093')

# ── Styles ─────────────────────────────────────────────────────
styles = getSampleStyleSheet()

sH1 = ParagraphStyle('H1', fontName='NotoSansSC-Bold', fontSize=28, leading=36,
                     textColor=HEADER_FILL, spaceAfter=12, spaceBefore=20)
sH2 = ParagraphStyle('H2', fontName='NotoSansSC-Bold', fontSize=20, leading=26,
                     textColor=HEADER_FILL, spaceAfter=8, spaceBefore=16)
sH3 = ParagraphStyle('H3', fontName='NotoSansSC-Bold', fontSize=15, leading=20,
                     textColor=ACCENT, spaceAfter=6, spaceBefore=12)
sBody = ParagraphStyle('Body', fontName='NotoSerifSC', fontSize=10, leading=16,
                       textColor=TEXT_PRIMARY, spaceAfter=6, alignment=TA_JUSTIFY,
                       firstLineIndent=0)
sBodyIndent = ParagraphStyle('BodyIndent', fontName='NotoSerifSC', fontSize=10, leading=16,
                             textColor=TEXT_PRIMARY, spaceAfter=6, alignment=TA_JUSTIFY,
                             leftIndent=18)
sBullet = ParagraphStyle('Bullet', fontName='NotoSerifSC', fontSize=10, leading=16,
                         textColor=TEXT_PRIMARY, spaceAfter=4, leftIndent=24,
                         bulletIndent=12, bulletFontName='NotoSerifSC')
sSmall = ParagraphStyle('Small', fontName='NotoSerifSC', fontSize=8, leading=12,
                        textColor=TEXT_MUTED)
sCaption = ParagraphStyle('Caption', fontName='NotoSerifSC', fontSize=9, leading=13,
                          textColor=TEXT_MUTED, alignment=TA_CENTER, spaceAfter=8)
sTableHead = ParagraphStyle('TH', fontName='NotoSansSC-Bold', fontSize=9, leading=13,
                            textColor=colors.white, alignment=TA_CENTER)
sTableCell = ParagraphStyle('TC', fontName='NotoSerifSC', fontSize=9, leading=13,
                            textColor=TEXT_PRIMARY, wordWrap='CJK')
sScoreCell = ParagraphStyle('SC', fontName='NotoSansSC-Bold', fontSize=11, leading=15,
                             alignment=TA_CENTER)

# ── Helpers ────────────────────────────────────────────────────
def h1(text):
    return Paragraph(text, sH1)

def h2(text):
    return Paragraph(text, sH2)

def h3(text):
    return Paragraph(text, sH3)

def body(text):
    return Paragraph(text, sBody)

def bullet(text):
    return Paragraph(text, sBullet, bulletText='\u2022')

def spacer(h=6):
    return Spacer(1, h)

def hr():
    return HRFlowable(width='100%', thickness=0.5, color=BORDER, spaceAfter=6, spaceBefore=6)

def build_table(data, col_widths, has_header=True):
    """Build a safe table with Paragraph-wrapped cells."""
    wrapped = []
    for ri, row in enumerate(data):
        wrow = []
        for ci, cell in enumerate(row):
            if ri == 0 and has_header:
                wrow.append(Paragraph(str(cell), sTableHead))
            else:
                wrow.append(Paragraph(str(cell), sTableCell))
        wrapped.append(wrow)
    t = Table(wrapped, colWidths=col_widths, repeatRows=1 if has_header else 0)
    style_cmds = [
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('GRID', (0, 0), (-1, -1), 0.4, BORDER),
    ]
    if has_header:
        style_cmds.append(('BACKGROUND', (0, 0), (-1, 0), HEADER_FILL))
        style_cmds.append(('TEXTCOLOR', (0, 0), (-1, 0), colors.white))
    # Alternating row colors
    for i in range(1, len(wrapped)):
        if i % 2 == 0:
            style_cmds.append(('BACKGROUND', (0, i), (-1, i), TABLE_STRIPE))
    t.setStyle(TableStyle(style_cmds))
    return t

def score_cell(score, max_score=100):
    """Create a colored score cell."""
    pct = score / max_score
    if pct >= 0.8:
        c = SEM_SUCCESS
    elif pct >= 0.6:
        c = SEM_WARNING
    else:
        c = SEM_ERROR
    return Paragraph(f'<font color="{c.hexval()}">{score}/{max_score}</font>', sScoreCell)

def section_break():
    return Spacer(1, 12)

# ── Build Document ────────────────────────────────────────────
OUTPUT_PATH = '/home/z/my-project/download/DeepMindQ_Intelligence_Architecture_Audit_v3.pdf'
PAGE_W, PAGE_H = A4
MARGIN = 1.0 * inch
AW = PAGE_W - 2 * MARGIN

doc = SimpleDocTemplate(
    OUTPUT_PATH,
    pagesize=A4,
    leftMargin=MARGIN, rightMargin=MARGIN,
    topMargin=MARGIN, bottomMargin=MARGIN,
    title='DeepMindQ Intelligence Architecture Maturity Audit',
    author='Z.ai',
    subject='Dedicated Enterprise Instance - Intelligence Lifecycle Assessment'
)

story = []

# ══════════════════════════════════════════════════════════════
# COVER PAGE
# ══════════════════════════════════════════════════════════════
story.append(Spacer(1, 120))

story.append(Paragraph('DeepMindQ', ParagraphStyle('CoverTitle',
    fontName='NotoSansSC-Bold', fontSize=42, leading=48,
    textColor=HEADER_FILL, alignment=TA_CENTER)))

story.append(Spacer(1, 8))

story.append(Paragraph('Intelligence Architecture Maturity Audit', ParagraphStyle('CoverSub',
    fontName='NotoSansSC', fontSize=22, leading=28,
    textColor=ACCENT, alignment=TA_CENTER)))

story.append(Spacer(1, 30))

# Decorative line
story.append(HRFlowable(width='60%', thickness=2, color=ACCENT, spaceAfter=20, spaceBefore=0))

story.append(Paragraph('Dedicated Enterprise Instance Architecture', ParagraphStyle('CoverTag',
    fontName='NotoSerifSC', fontSize=14, leading=18,
    textColor=TEXT_MUTED, alignment=TA_CENTER)))

story.append(Spacer(1, 12))

story.append(Paragraph('Intelligence Lifecycle Completeness & Enterprise Deployment Readiness', ParagraphStyle('CoverTag2',
    fontName='NotoSerifSC', fontSize=12, leading=16,
    textColor=TEXT_MUTED, alignment=TA_CENTER)))

story.append(Spacer(1, 80))

meta_data = [
    ['Assessment Model', 'Dedicated Enterprise Instance (Non-SaaS)'],
    ['Architecture', 'One Customer = One Instance + One Database'],
    ['Intelligence Lifecycle', '9-Stage: Company Data to AI Advisor'],
    ['Data Models', '105 Prisma Models / 36 Enums'],
    ['API Routes', '174 Routes (41 Intelligence, 38 AI)'],
    ['AI Governance Code', '~23,249 LOC across 45 files'],
    ['Total Intelligence Code', '~61,500+ LOC across 90+ files'],
    ['Test Coverage', '195 test files across 8 categories'],
]
meta_table = Table(meta_data, colWidths=[AW*0.4, AW*0.6])
meta_table.setStyle(TableStyle([
    ('FONTNAME', (0, 0), (0, -1), 'NotoSansSC-Bold'),
    ('FONTNAME', (1, 0), (1, -1), 'NotoSerifSC'),
    ('FONTSIZE', (0, 0), (-1, -1), 9),
    ('TEXTCOLOR', (0, 0), (0, -1), HEADER_FILL),
    ('TEXTCOLOR', (1, 0), (1, -1), TEXT_PRIMARY),
    ('TOPPADDING', (0, 0), (-1, -1), 4),
    ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ('LEFTPADDING', (0, 0), (-1, -1), 8),
    ('LINEBELOW', (0, 0), (-1, -2), 0.3, BORDER),
    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
]))
story.append(meta_table)

story.append(PageBreak())

# ══════════════════════════════════════════════════════════════
# TABLE OF CONTENTS
# ══════════════════════════════════════════════════════════════
story.append(Paragraph('Table of Contents', sH1))
story.append(spacer(12))

toc_items = [
    '1. Audit Scope & Architectural Constraints',
    '2. Intelligence Lifecycle Maturity Assessment',
    '3. MS0 Foundation & Data Layer',
    '4. MS1-MS2 Intelligence Pipeline & AI Engines',
    '5. MS3 Knowledge Graph',
    '6. MS4 Signal Detection & Evidence Framework',
    '7. MS5 Capability Understanding & Buyer Intelligence',
    '8. MS6 Revenue Intelligence & Sales Execution',
    '9. MS7 Trust Layer & AI Governance',
    '10. MS8 Intelligence Operations',
    '11. MS9 AI Advisor',
    '12. Intelligence Lifecycle Link Integrity',
    '13. Enterprise Deployment Readiness',
    '14. Gap Classification: A) Core Product vs B) Enterprise Deployment',
    '15. Weighted Maturity Score',
    '16. Priority Action Roadmap',
]
for item in toc_items:
    story.append(Paragraph(item, ParagraphStyle('TOC', fontName='NotoSerifSC',
        fontSize=11, leading=20, textColor=TEXT_PRIMARY, leftIndent=12)))

story.append(PageBreak())

# ══════════════════════════════════════════════════════════════
# CHAPTER 1: Audit Scope
# ══════════════════════════════════════════════════════════════
story.append(h1('1. Audit Scope & Architectural Constraints'))

story.append(body(
    'This audit evaluates DeepMindQ as an <b>Enterprise Intelligence Operating System</b> delivered '
    'under a <b>Dedicated Enterprise Instance</b> architecture. Each customer receives an isolated '
    'application instance with a dedicated PostgreSQL database, isolated knowledge graph, isolated '
    'AI memory, configurable intelligence models, and a private evidence layer. Multi-tenancy, '
    'tenant isolation, tenant management, and SaaS scalability patterns are <b>intentionally out of scope</b> '
    'and are not evaluated as gaps in this assessment. The product philosophy centers on enterprise '
    'intelligence infrastructure rather than a CRM subscription platform.'
))

story.append(spacer(8))
story.append(h3('1.1 Permanent Architectural Constraints'))

constraints_data = [
    ['Constraint', 'Implication'],
    ['One enterprise = one instance', 'No shared customer data, no tenant switching, no multi-tenant patterns'],
    ['One enterprise = one database', 'Full data isolation by default; no row-level security needed'],
    ['Isolated knowledge graph', 'KG per enterprise; cross-customer intelligence sharing is not a requirement'],
    ['Isolated AI memory', 'Memory consolidation and learning are enterprise-scoped'],
    ['Configurable models', 'Each enterprise tunes its own intelligence models and scoring weights'],
    ['CRM as data foundation only', 'Companies, Contacts, Leads, Pursuits are base objects; differentiation is the intelligence layer'],
]
story.append(build_table(constraints_data, [AW*0.3, AW*0.7]))
story.append(spacer(8))

story.append(h3('1.2 Evaluation Framework'))

story.append(body(
    'The audit uses a corrected 9-stage intelligence lifecycle as the evaluation backbone: '
    '<b>Company Data</b> through <b>Knowledge Weaving</b>, <b>Signal Detection</b>, '
    '<b>Evidence & Trust</b>, <b>Capability Understanding</b>, <b>Buyer Intelligence</b>, '
    '<b>Revenue Intelligence</b>, <b>Sales Execution Intelligence</b>, and finally '
    '<b>AI Advisor</b>. Each stage is evaluated for implementation completeness, data flow '
    'connections to adjacent stages, persistence maturity, and enterprise readiness. '
    'Gaps are classified into two categories: <b>Category A</b> represents core product '
    'intelligence capability gaps that directly impact the question "Can DeepMindQ understand '
    'an enterprise market and recommend the next best revenue action?" <b>Category B</b> represents '
    'enterprise deployment requirements that support production operations but do not define '
    'the core product differentiation. The weighted maturity score uses intelligence-centric '
    'weights favoring the differentiation layers (signals, evidence, buyer intelligence, '
    'revenue intelligence, AI advisor) over foundational infrastructure.'
))

story.append(PageBreak())

# ══════════════════════════════════════════════════════════════
# CHAPTER 2: Intelligence Lifecycle Maturity Overview
# ══════════════════════════════════════════════════════════════
story.append(h1('2. Intelligence Lifecycle Maturity Assessment'))

story.append(body(
    'The following table summarizes maturity scores across the complete intelligence lifecycle. '
    'Scores reflect both implementation depth (code maturity, test coverage, persistence) and '
    'intelligence completeness (end-to-end data flow, evidence grounding, feedback loops). '
    'The intelligence lifecycle weights emphasize the layers that differentiate DeepMindQ from '
    'conventional CRM platforms: signal detection, evidence-backed reasoning, buyer intelligence, '
    'revenue intelligence, and the AI advisor as the convergence point.'
))

story.append(spacer(8))

lifecycle_data = [
    ['Stage', 'LOC', 'Files', 'Maturity', 'Score', 'Weight', 'Weighted'],
    ['1. Company Data Layer', '~1,800', '~8', 'B+', '85/100', '8%', '6.8'],
    ['2. Knowledge Weaving (KG)', '~3,500', '~5', 'C-', '35/100', '12%', '4.2'],
    ['3. Signal Detection', '~4,300', '~14', 'B', '72/100', '14%', '10.1'],
    ['4. Evidence & Trust', '~4,600', '~14', 'A-', '88/100', '14%', '12.3'],
    ['5. Capability Understanding', '~2,000', '~4', 'B', '75/100', '8%', '6.0'],
    ['6. Buyer Intelligence', '~1,620', '~5', 'C+', '55/100', '12%', '6.6'],
    ['7. Revenue Intelligence', '~5,000', '~14', 'B-', '68/100', '14%', '9.5'],
    ['8. Sales Execution Intelligence', '~3,160', '~5', 'C+', '58/100', '10%', '5.8'],
    ['9. AI Advisor', '~13,500', '~16', 'B+', '82/100', '8%', '6.6'],
    ['TOTAL', '~39,480', '~85', '--', '--', '100%', '67.9'],
]
lc_table = build_table(lifecycle_data, [AW*0.22, AW*0.08, AW*0.08, AW*0.10, AW*0.10, AW*0.10, AW*0.12])
story.append(lc_table)
story.append(spacer(8))

story.append(Paragraph('<b>Weighted Total: 67.9 / 100</b> (Intelligence-Architecture Maturity)', 
    ParagraphStyle('TotalScore', fontName='NotoSansSC-Bold', fontSize=14, leading=18,
                   textColor=ACCENT, alignment=TA_CENTER, spaceBefore=8, spaceAfter=8)))

story.append(body(
    'The overall intelligence architecture maturity of 67.9/100 indicates a system that is '
    '<b>architecturally ambitious and structurally sound</b> in its differentiation layers '
    '(evidence framework, AI governance, AI advisor), but exhibits critical gaps in the '
    'intelligence data persistence layer (knowledge graph) and the intermediate intelligence '
    'stages (buyer intelligence, sales execution). The most impactful single deficit is the '
    'knowledge graph operating primarily in-memory, which creates a cascading weakness across '
    'all downstream intelligence layers that depend on persistent knowledge relationships.'
))

story.append(PageBreak())

# ══════════════════════════════════════════════════════════════
# CHAPTER 3: MS0 Foundation & Data Layer
# ══════════════════════════════════════════════════════════════
story.append(h1('3. MS0 Foundation & Data Layer'))

story.append(body(
    'DeepMindQ\'s foundation layer demonstrates production-grade engineering. The platform runs on '
    'Next.js 16 with React 19, PostgreSQL via Prisma ORM with 105 data models and 36 enums. '
    'The Docker-first deployment model includes a multi-stage Dockerfile (node:20-alpine), '
    'docker-compose with PostgreSQL 16, automated daily backups with 30-day rolling retention, '
    'and a HEALTHCHECK instruction. The application supports standalone output for self-hosted '
    'deployment on Docker, Render, Railway, Fly.io, or Kubernetes with readiness/liveness probes.'
))

story.append(h3('3.1 Authentication & Session Management'))

story.append(body(
    'The authentication system is comprehensive and well-hardened. Sessions use SHA-256 hashed tokens '
    '(256-bit entropy from crypto.getRandomValues) stored in PostgreSQL. PBKDF2-SHA256 handles password '
    'hashing with 100,000 iterations. The system enforces session rotation every 7 days, limits '
    'concurrent sessions to 5 per user, and implements suspicious login detection based on device '
    'fingerprinting, IP subnet changes, and rapid login patterns. OTP verification uses SHA-256 '
    'hashed storage with rate limiting (5/min per email). An AUTHORIZED_EMAIL environment variable '
    'enforces single-tenant access control at the configuration level, making the dedicated instance '
    'model a first-class architectural decision rather than a runtime check. CSRF protection uses '
    'double-submit pattern with constant-time comparison.'
))

story.append(h3('3.2 Authorization (RBAC)'))

story.append(body(
    'The RBAC system defines 4 roles (admin, operator, user, viewer) with 37 granular permissions '
    'across 6 categories: Data, AI, Email, Analytics, System, and DataOps. The authorization '
    'matrix covers 56+ route entries with deny-by-default enforcement and prefix-based wildcard '
    'matching. Currently, only admin and user roles are active in the UI; operator and viewer '
    'are defined but not exposed. RBAC enforcement is per-route via authorizeRoute() calls rather '
    'than at the proxy level, which means compliance depends on developer discipline per API route. '
    'For a dedicated enterprise instance with a small number of users, this per-route model is '
    'acceptable, though centralizing enforcement at the proxy level would reduce the risk of '
    'accidental authorization gaps in new routes.'
))

story.append(h3('3.3 Data Model Architecture'))

story.append(body(
    'The Prisma schema contains 105 models spanning 13+ product phases. The model architecture '
    'follows a clear layered design: CRM core entities (Company, Contact, Lead, Pursuit), '
    'intelligence objects (CompanySignal, Evidence, OpportunityRecommendation, StrategicInsight), '
    'trust and health tracking (CompanyIntelligenceHealth, EvidenceSourceReliability, IntelligenceSnapshot), '
    'knowledge persistence (KnowledgeGraphNode, KnowledgeGraphEdge, AIMemoryEntry), AI governance '
    '(AIGenerationAudit, AIUsageLog, AICallLog), and enterprise reasoning (ReasoningContext, '
    'ReasoningStep, AgentOrchestration, AgentRun). The enum system includes 36 enums covering signal '
    'types, severity levels, trust tiers, AI memory layers, persistence stores, and advisor scopes. '
    'The schema uses PostgreSQL with pgbouncer support via separate DATABASE_URL and DIRECT_DATABASE_URL '
    'connections. Soft delete is not implemented; records are hard-deleted. For an enterprise '
    'intelligence system where historical data drives learning loops, the absence of soft delete '
    'represents a minor data integrity risk.'
))

ms0_data = [
    ['Component', 'Status', 'Detail'],
    ['Authentication', 'Production-Ready', 'SHA-256 sessions, PBKDF2, OTP, suspicious login detection'],
    ['Authorization', 'Production-Ready', '4 roles, 37 permissions, deny-by-default'],
    ['Audit Trail', 'Production-Ready', 'Dual-path: DB + structured logger, 11 categories'],
    ['Data Model', 'Production-Ready', '105 models, 36 enums, PostgreSQL'],
    ['Docker Deployment', 'Production-Ready', 'Multi-stage, non-root, health checks, backups'],
    ['Environment Config', 'Production-Ready', '150-line .env.example, graceful degradation'],
    ['Soft Delete', 'Not Implemented', 'Hard delete only; risk for intelligence learning loops'],
    ['Session Middleware', 'Hybrid', 'Proxy validates token existence; DB validation per-route'],
]
story.append(spacer(8))
story.append(build_table(ms0_data, [AW*0.18, AW*0.18, AW*0.64]))

story.append(PageBreak())

# ══════════════════════════════════════════════════════════════
# CHAPTER 4: MS1-MS2 Intelligence Pipeline & AI Engines
# ══════════════════════════════════════════════════════════════
story.append(h1('4. MS1-MS2 Intelligence Pipeline & AI Engines'))

story.append(body(
    'The intelligence pipeline is the operational backbone of DeepMindQ, connecting data ingestion '
    'through signal extraction, enrichment, scoring, and knowledge construction. The pipeline consists '
    'of approximately 90+ library files totaling over 61,500 lines of code, supported by 174 API '
    'routes. The system employs 6 composition engines (ScoringEngine, GroundingEngine, RetrievalEngine, '
    'SynthesisEngine, ConversationEngine, ActionEngine) that can be composed into multi-step '
    'intelligence workflows. A model router (NVIDIA, Fireworks, Groq, Gemini) provides LLM provider '
    'failover with latency budgets and cost tracking.'
))

story.append(h3('4.1 Pipeline Architecture'))

story.append(body(
    'The end-to-end intelligence pipeline follows a staged architecture: raw data ingestion via '
    'connectors (CSV, Excel, Clearbit, RSS, website, internal memory) flows into the intelligence '
    'fabric, where signals are extracted through LLM-based analysis with rule-based fallbacks. '
    'Extracted signals feed into evidence collection, capability matching, opportunity generation, '
    'and win probability estimation. A job queue system with retry logic (exponential backoff) '
    'handles asynchronous processing. The pipeline produces scored companies, prioritized opportunities, '
    'evidence-grounded recommendations, and structured briefs for the AI advisor layer. '
    'Intelligence validation gates enforce output quality checks before downstream consumption.'
))

story.append(h3('4.2 AI Governance Layer'))

story.append(body(
    'The AI governance layer is the deepest and most mature component of the entire system, '
    'totaling approximately 23,249 lines of code across 45 files. This investment reflects '
    'DeepMindQ\'s core differentiation as an evidence-backed intelligence platform rather than '
    'a conventional CRM. The governance layer implements pre-generation hallucination prevention '
    '(15+ rules injected into every LLM prompt), post-generation hallucination detection (claim '
    'extraction, citation verification, factual consistency checking), multi-source Bayesian '
    'confidence aggregation (6 dimensions: data quality 20%, source reliability 20%, freshness 15%, '
    'cross-validation 15%, evidence coverage 15%, AI certainty 15%), evidence grounding with '
    'citation markers, an explainability engine that produces full reasoning chains with evidence '
    'mapping and confidence breakdown per claim, a centralized prompt registry with versioning, '
    'golden datasets with 50 enterprise companies, AI cost governance tracking per-generation costs, '
    'OpenTelemetry-compatible AI call tracing, and data lineage tracking from source through '
    'processing to output. This governance depth is a genuine competitive advantage and is rarely '
    'seen in platforms at this stage of maturity.'
))

story.append(h3('4.3 Key Gaps'))

pipeline_gaps = [
    ['Gap', 'Category', 'Impact', 'Effort'],
    ['Job retry queue has no priority scheduling', 'B (Enterprise)', 'Medium', 'Low'],
    ['No structured trace export (Prometheus/OTLP)', 'B (Enterprise)', 'Low', 'Medium'],
    ['AI cache is in-memory only', 'B (Enterprise)', 'Low', 'Low'],
    ['Intelligence validation not enforced on all outputs', 'A (Core)', 'High', 'Medium'],
    ['Learning loop defined but not connected to outcomes', 'A (Core)', 'Critical', 'High'],
]
story.append(spacer(4))
story.append(build_table(pipeline_gaps, [AW*0.32, AW*0.18, AW*0.12, AW*0.12]))

story.append(PageBreak())

# ══════════════════════════════════════════════════════════════
# CHAPTER 5: MS3 Knowledge Graph
# ══════════════════════════════════════════════════════════════
story.append(h1('5. MS3 Knowledge Graph'))

story.append(body(
    'The knowledge graph is architecturally the most ambitious component of DeepMindQ, with 1,781 '
    'lines of core graph logic, 679 lines of association engine, and 673 lines of knowledge '
    'intelligence reasoning. The graph data model supports 15 entity types (company, person, technology, '
    'industry, role, location, product, financial, event, capability, signal, opportunity, document, '
    'conversation, generic) and 28 relationship types (WORKS_AT, COMPETES_WITH, USES_TECHNOLOGY, '
    'HAS_SIGNAL, SUPPORTS_CLAIM, CONTRADICTS_CLAIM, etc.). Graph operations include BFS/DFS traversal, '
    'multi-hop path finding, shortest path algorithms, relationship scoring with confidence propagation, '
    'and entity resolution with fuzzy matching.'
))

story.append(h3('5.1 Critical Finding: Persistence Model'))

story.append(body(
    '<b>The knowledge graph operates primarily in-memory using 6 Map stores</b> (nodeStore, edgeStore, '
    'sourceEdgeIndex, targetEdgeIndex, labelIndex, typeIndex). A shadow persistence layer '
    '(WI-18.2) exists with 2,512 lines of code including a cold-start loader, shadow-mode '
    'comparator, failure queue, and health monitor. However, this persistence layer is disabled '
    'by default (USE_DB_PERSISTENCE=false) and the read path does not hydrate from the database '
    'on cold start. This means that <b>every server restart results in complete knowledge graph '
    'data loss</b>. The Prisma schema includes KnowledgeGraphNode and KnowledgeGraphEdge models '
    'designed for PostgreSQL persistence, and the persistWrite() function performs fire-and-forget '
    'writes to the database, but without a corresponding read-hydration path, the persisted data '
    'is effectively orphaned. For a dedicated enterprise instance, this is the single most critical '
    'intelligence infrastructure gap, as the knowledge graph is the connective tissue between all '
    'downstream intelligence layers.'
))

story.append(h3('5.2 Knowledge Fabric vs Knowledge Graph'))

story.append(body(
    'Two separate knowledge systems coexist: the Knowledge Graph (in-memory, graph-structured) and '
    'the Knowledge Fabric (DB-backed, relational via KnowledgeEntry model). The Knowledge Fabric '
    'provides reliable persistence with version history, category grouping, and keyword search. '
    'However, these two systems are architecturally disconnected: the graph cannot query Fabric '
    'entries, and the Fabric cannot leverage graph traversal for knowledge discovery. This '
    'fragmentation dilutes the value of both systems. A unified knowledge layer that persists '
    'graph topology to the KnowledgeGraphNode/Edge tables and hydrates on startup would resolve '
    'this architectural split.'
))

kg_gaps = [
    ['Component', 'Status', 'Score Impact'],
    ['Graph topology and traversal logic', 'Excellent (1,781 LOC)', '+25'],
    ['Entity resolution and fuzzy matching', 'Implemented', '+10'],
    ['Recommendation engine (6 types)', 'Implemented', '+10'],
    ['DB models for persistence', 'Defined in schema', '+5'],
    ['Shadow persistence layer', 'Written but disabled', '+5'],
    ['Cold-start hydration from DB', 'Missing (read path broken)', '-30'],
    ['Temporal graph queries', 'Not implemented', '-10'],
    ['Knowledge Fabric integration', 'Disconnected', '-10'],
    ['NET SCORE', '--', '35/100'],
]
story.append(spacer(4))
story.append(build_table(kg_gaps, [AW*0.35, AW*0.35, AW*0.20]))

story.append(PageBreak())

# ══════════════════════════════════════════════════════════════
# CHAPTER 6: MS4 Signal Detection & Evidence Framework
# ══════════════════════════════════════════════════════════════
story.append(h1('6. MS4 Signal Detection & Evidence Framework'))

story.append(h3('6.1 Signal Detection'))

story.append(body(
    'The signal detection system supports 10 canonical signal types: funding, hiring, leadership_change, '
    'people_change, expansion, tech_change, technology_adoption, partnership, acquisition, and news. '
    'Detection operates in dual mode: LLM-based extraction as the primary method (via governedAICallAggregate) '
    'with rule-based fallback. The signal lifecycle engine implements a 6-state machine '
    '(detected, validated, active, aging, expired, archived) with time-based transitions and cursor-based '
    'batch processing. Signal meaning inference uses a deterministic rule engine mapping signalType, '
    'severity, and impact to 6 buying stage categories: budget_available, leadership_openness, '
    'tech_dissatisfaction, growth_pressure, compliance_requirement, and vendor_evaluation. '
    'Signal-capability matching uses LLM-powered analysis to connect detected signals to internal '
    'capability assets, producing business problems, expected outcomes, and sales angles.'
))

story.append(body(
    'The signal detection system scores 72/100 based on strong implementation depth and the buying-stage '
    'meaning inference engine. However, several signal types that are critical for comprehensive '
    'market intelligence are missing: real-time monitoring via webhooks or RSS cron jobs, social media '
    'signal detection (LinkedIn public posts, Twitter/X mentions), competitive signal detection '
    '(competitor pricing changes, product launches mapped to our capabilities), and signal clustering '
    'that groups related signals into narratives. Additionally, the signal sequence engine (684 lines) '
    'exists as dead code not wired to any active API route.'
))

story.append(h3('6.2 Evidence & Trust Framework'))

story.append(body(
    'The evidence and trust framework is the <strong>most mature differentiation layer</strong> in '
    'DeepMindQ, scoring 88/100. The framework implements a TRUST metadata system '
    '(Transparency, Reliability, Understandability, Source, Traceability) with 4 mandatory dimensions '
    'per intelligence output, 6 source classifications, and composite TRUST scoring (0-100) mapped to '
    'A+ through F grades. Evidence quality is assessed across 5 levels: verified, corroborated, '
    'inferred, estimated, and speculative. Multi-factor confidence scoring combines source quality '
    'tier, relevance, recency decay (exponential with configurable half-life), and corroboration '
    '(unique domain count). Source reliability is tracked per domain via the EvidenceSourceReliability '
    'model, with premium sources (Bloomberg, Reuters, SEC) receiving higher trust baselines. '
    'Data lineage tracking follows every data point from origin through transformation to output '
    'using append-only Evidence records. The grounding engine collects evidence from 4 sources '
    '(CompanySignal, SignalCapabilityMatch, AIInsight, Evidence) into unified EvidenceChains with '
    'gap detection, coverage scoring, and markdown rendering with [En] citation markers. '
    'A contradiction detection engine identifies conflicting intelligence from multiple sources.'
))

evidence_gaps = [
    ['Evidence Feature', 'Status', 'Impact'],
    ['Multi-factor confidence scoring', 'Implemented (753 LOC)', 'Core strength'],
    ['TRUST metadata framework', 'Implemented (462 LOC)', 'Core strength'],
    ['Source reliability tracking', 'Implemented (DB-backed)', 'Core strength'],
    ['Data lineage tracking', 'Implemented (375 LOC)', 'Core strength'],
    ['Evidence re-verification (stale URL check)', 'Not implemented', 'Medium gap'],
    ['Cross-company evidence correlation', 'Not implemented', 'Low gap'],
    ['Confidence calibration from outcomes', 'Defined but not connected', 'High gap'],
]
story.append(spacer(4))
story.append(build_table(evidence_gaps, [AW*0.38, AW*0.30, AW*0.22]))

story.append(PageBreak())

# ══════════════════════════════════════════════════════════════
# CHAPTER 7: MS5 Capability & Buyer Intelligence
# ══════════════════════════════════════════════════════════════
story.append(h1('7. MS5 Capability Understanding & Buyer Intelligence'))

story.append(h3('7.1 Capability Intelligence'))

story.append(body(
    'The capability intelligence engine (1,246 lines) provides full lifecycle management of enterprise '
    'capabilities across 17 knowledge categories including service_line, solution, accelerator, '
    'case_study, proof_point, objection_response, and messaging. Capabilities are ingested with '
    'automatic embedding via the RetrievalEngine, enabling semantic search. Signal-capability '
    'matching uses LLM-powered analysis to produce business problems, expected outcomes, and sales '
    'angles for each signal-capability pair. A 5-factor win probability model (signal strength, '
    'capability fit, evidence strength, timing score, competitive position) produces 0-100 '
    'probability estimates. The system scores 75/100, with the primary gap being the absence '
    'of capability gap analysis (identifying what capabilities are missing for detected signals), '
    'competitive capability benchmarking, and win probability calibration against actual outcomes.'
))

story.append(h3('7.2 Buyer Intelligence'))

story.append(body(
    'Buyer intelligence represents one of the weaker stages in the lifecycle, scoring 55/100. '
    'The system implements a buying intent engine (252 lines) with 5 scoring categories: technology_trigger '
    '(30%), growth (20%), pain_point (25%), engagement (15%), and market_timing (10%). A contact '
    'influence engine (216 lines) scores 4 factors: seniority (40%), department relevance (25%), '
    'engagement (20%), and network (15%), producing buying role classification (economic_buyer, '
    'technical_buyer, champion, coach, user, blocker). Person-level intelligence (510 lines) enables '
    'individual contact enrichment and profile building, while a relationship mapping engine (312 lines) '
    'detects inter-contact relationships. An engagement prediction engine (329 lines) estimates contact '
    'engagement likelihood.'
))

story.append(body(
    'The critical gaps in buyer intelligence are the absence of buyer journey stage tracking '
    '(awareness through consideration, decision, purchase, expansion), buyer behavior analysis '
    '(content consumption patterns, website visit sequences), buyer persona clustering across '
    'accounts, and the fact that the engagement prediction engine relies on simple status checks '
    'rather than ML models. The contact influence scoring is purely heuristic, based on title-based '
    'seniority without real organizational chart analysis. For an enterprise intelligence system, '
    'these gaps mean the platform can identify signals and capabilities but cannot yet build '
    'a comprehensive understanding of individual buyer behavior and decision dynamics.'
))

buyer_gaps = [
    ['Buyer Intelligence Gap', 'Category', 'Priority'],
    ['No buyer journey stage tracking', 'A (Core)', 'High'],
    ['No buyer behavior analysis (web/content)', 'A (Core)', 'Medium'],
    ['No buyer persona clustering', 'A (Core)', 'Medium'],
    ['Engagement prediction is heuristic-only', 'A (Core)', 'Medium'],
    ['Contact influence lacks org chart data', 'A (Core)', 'Low'],
    ['No capability gap analysis', 'A (Core)', 'Medium'],
    ['Win probability not calibrated', 'A (Core)', 'High'],
]
story.append(spacer(4))
story.append(build_table(buyer_gaps, [AW*0.40, AW*0.22, AW*0.15]))

story.append(PageBreak())

# ══════════════════════════════════════════════════════════════
# CHAPTER 8: MS6 Revenue Intelligence & Sales Execution
# ══════════════════════════════════════════════════════════════
story.append(h1('8. MS6 Revenue Intelligence & Sales Execution'))

story.append(h3('8.1 Revenue Intelligence'))

story.append(body(
    'Revenue intelligence scores 68/100 with approximately 5,000 lines of code across 14 files. '
    'The ScoringEngine (815 lines) implements a 9-dimension explainable scoring model: Technology '
    'Trigger (+25), Growth Signal (+20), Executive Change (+15), Engagement (+12), Contact Influence '
    '(+10), Opportunity Strength (+10), Buying Intent (+10), Data Coverage (+8), Risk (-10), producing '
    'letter grades (A through F) with confidence levels and evidence-backed narrative explanations. '
    'The Opportunity Radar ranks accounts by composite signal strength with filtering and dominant '
    'signal type detection. Account scoring, brief generation, executive recommendations, signal '
    'pattern analysis, and financial intelligence extraction are all implemented.'
))

story.append(body(
    'The critical gaps in revenue intelligence are the absence of pipeline forecasting '
    '(no deal stage progression model or time-to-close prediction), expansion/cross-sell/upsell '
    'models for existing customer intelligence, churn prediction, and quota attainment tracking. '
    'The financial intelligence framework is heavily LLM-dependent with no verified financial '
    'data API integration. These gaps mean DeepMindQ can identify opportunities and score accounts '
    'but cannot yet predict revenue timing or model customer expansion potential.'
))

story.append(h3('8.2 Sales Execution Intelligence'))

story.append(body(
    'Sales execution intelligence scores 58/100 with approximately 3,160 lines across 5 files. '
    'The ActionEngine (694 lines) generates 6 action types (next_best_action, sales_motion, '
    'account_strategy, opportunity_accel, risk_mitigation, outreach) with 9 sales motions ranging '
    'from discovery through nurture. The ConversationEngine (833 lines) produces 4 briefing types '
    '(meeting_prep, executive_brief, conversation_plan, outreach_prepare) with buyer persona '
    'analysis, talking points with evidence, objection preparation, and topics to avoid. '
    'A conversation studio engine supports conversation planning and rehearsal.'
))

story.append(body(
    'The primary gaps include the absence of deal coaching (competitive battle cards, win/loss '
    'analysis, deal strategy), sequence optimization (A/B testing, send-time optimization), '
    'conversation analytics (transcript analysis from recorded calls), and the critical feedback '
    'loop: next-best-action recommendations are not learned from actual outcomes. The signal sequence '
    'engine (684 lines) exists as dead code not wired to any active API route. Additionally, '
    'the agent framework has 6 registered agent types with tool call infrastructure, but the '
    'tools are stubs without real integrations to email sending, calendar booking, or CRM write-back.'
))

story.append(PageBreak())

# ══════════════════════════════════════════════════════════════
# CHAPTER 9: MS7 Trust Layer & AI Governance
# ══════════════════════════════════════════════════════════════
story.append(h1('9. MS7 Trust Layer & AI Governance'))

story.append(body(
    'The trust layer and AI governance represent the deepest intellectual investment in the platform, '
    'scoring 85/100. With approximately 23,249 lines of governance code across 45 files, DeepMindQ '
    'implements one of the most comprehensive AI governance frameworks seen in enterprise intelligence '
    'platforms at this maturity stage. The governance layer touches every intelligence output '
    'through pre-generation hallucination prevention, post-generation claim verification, evidence '
    'grounding with citation markers, explainability with full reasoning chains, confidence scoring '
    'with multi-factor Bayesian aggregation, prompt versioning with a centralized registry, and '
    'complete audit trails via AIGenerationAudit records that capture evidence IDs used, signal '
    'IDs used, capability asset IDs used, research confidence, freshness score, governance '
    'check results, model used, and prompt version.'
))

story.append(h3('9.1 Trust Scoring Architecture'))

trust_data = [
    ['Trust Component', 'Implementation', 'Depth'],
    ['TRUST Metadata Framework', '4 mandatory dimensions, 6 source categories', '462 LOC'],
    ['Unified Confidence Engine', '6-dimension Bayesian, trust classification', '753 LOC'],
    ['Evidence Quality Levels', '5 levels: verified to speculative', '400 LOC'],
    ['Hallucination Prevention', 'Pre-gen (15+ rules) + Post-gen (claim extraction)', '1,132 LOC'],
    ['Explainability Engine', 'Reasoning chains, evidence mapping, confidence breakdown', '1,391 LOC'],
    ['Contradiction Detection', 'Cross-source conflict identification', '291 LOC'],
    ['Data Lineage Tracking', 'Source to processing to output', '375 LOC'],
    ['Prompt Registry', 'Centralized versioning and templates', '752 LOC'],
    ['AI Cost Governance', 'Per-generation cost tracking', '121 LOC'],
    ['Source Reliability', 'Per-domain reliability scoring', '432 LOC'],
]
story.append(spacer(4))
story.append(build_table(trust_data, [AW*0.30, AW*0.45, AW*0.15]))

story.append(h3('9.2 Dashboard Trust Evidence'))

story.append(body(
    'The default intelligence dashboard currently uses 100% simulated data for trust scores and '
    'intelligence metrics. This is a presentation gap, not an architectural gap: the backend APIs '
    '(trust/dashboard, trust/company/[id]) are fully implemented with real data, but the dashboard '
    'screen renders mock data. For a dedicated enterprise instance, connecting the dashboard to '
    'the real trust APIs is a straightforward integration task that does not require architectural '
    'changes. The dashboard should consume CompanyIntelligenceHealth records which already track '
    'data completeness, signal coverage, evidence coverage, and contact coverage per account.'
))

story.append(PageBreak())

# ══════════════════════════════════════════════════════════════
# CHAPTER 10: MS8 Intelligence Operations
# ══════════════════════════════════════════════════════════════
story.append(h1('10. MS8 Intelligence Operations'))

story.append(body(
    'Intelligence operations cover the health monitoring, alerting, persistence, and operational '
    'management of the intelligence layer. The system provides 6 health check endpoints '
    '(liveness, readiness, database, AI, persistence, dependencies) plus system-health and '
    'data-health dashboards. Intelligence health monitoring tracks engine performance, queue '
    'status, and data quality metrics. A comprehensive compliance scanner (303 lines) statically '
    'analyzes all 265 API routes for auth, validation, CSRF, rate-limit, audit, and observability '
    'compliance, generating a full route-permission mapping for enterprise compliance review.'
))

story.append(h3('10.1 Operational Gaps'))

ops_gaps = [
    ['Operational Capability', 'Status', 'Category'],
    ['Health check endpoints (6 total)', 'Implemented', 'B (Enterprise)'],
    ['Compliance scanner (265 routes)', 'Implemented', 'B (Enterprise)'],
    ['Intelligence health monitoring', 'Implemented', 'B (Enterprise)'],
    ['Database performance monitoring', 'Implemented', 'B (Enterprise)'],
    ['Push-based alerting (webhooks/SMS)', 'Not implemented', 'B (Enterprise)'],
    ['Prometheus/OpenMetrics endpoint', 'Not implemented', 'B (Enterprise)'],
    ['OTLP trace export', 'Not implemented', 'B (Enterprise)'],
    ['Audit log retention/TTL policy', 'Not implemented', 'B (Enterprise)'],
    ['Export: async job queue for large datasets', 'Not implemented', 'B (Enterprise)'],
    ['Connector scheduling (cron jobs)', 'Defined but not wired', 'B (Enterprise)'],
]
story.append(spacer(4))
story.append(build_table(ops_gaps, [AW*0.38, AW*0.25, AW*0.22]))

story.append(body(
    'All identified intelligence operations gaps are Category B (enterprise deployment requirements). '
    'None of these gaps affect the core intelligence lifecycle. For a dedicated enterprise instance, '
    'push-based alerting and Prometheus metrics are nice-to-have for enterprise monitoring integration, '
    'but the existing health check endpoints provide adequate operational visibility for Docker-based '
    'deployment. The absence of audit log retention policy is a minor data governance concern that can '
    'be addressed with a scheduled pruning job.'
))

story.append(PageBreak())

# ══════════════════════════════════════════════════════════════
# CHAPTER 11: MS9 AI Advisor
# ══════════════════════════════════════════════════════════════
story.append(h1('11. MS9 AI Advisor'))

story.append(body(
    'The AI Advisor is the convergence point of the entire intelligence lifecycle, scoring 82/100 '
    'with approximately 13,500 lines of code across 16 files. The advisor orchestrator implements a '
    '6-step pipeline: Load Context, Synthesis, Recommendations, Confidence, BriefingAdapter, and Persist, '
    'with graceful degradation per step. The recommendation engine (1,087 lines) aggregates 8+ data '
    'sources (AccountScore, OpportunityRecommendation, CompanySignal, SignalCapabilityMatch, '
    'StrategicInsight, AIEngagementStrategy, Knowledge Graph, AI Memory) to produce prioritized '
    'recommendations with reasons, risks, and tiering (HOT, WARM, NURTURE, AT_RISK). '
    'The synthesis engine produces long-form evidence-grounded briefs with citations. Context '
    'builders generate multi-signal account context for advisor queries. The AI agent framework '
    '(2,873 lines) provides a full agent architecture with task planning, tool usage, reasoning '
    'chains, self-validation, collaboration, human approval checkpoints, and 6 registered agent types.'
))

story.append(h3('11.1 Advisor Strengths'))

story.append(body(
    'The AI Advisor\'s primary strength is its architectural completeness. Every stage of the advisor '
    'pipeline is implemented, from context loading through recommendation generation to conversation '
    'persistence. The advisor supports 5 conversation scopes (account_intelligence, market_intelligence, '
    'competitive_analysis, signal_investigation, general_intelligence) with escalation handling '
    'for low confidence, conflicting evidence, complex analysis, data gaps, and user requests. '
    'The 4-layer AI memory system (working, conversation, enterprise, institutional) provides '
    'entity-scoped recall with consolidation and decay. The hybrid retrieval engine combines '
    'keyword, semantic (vector), and knowledge graph search for comprehensive context building. '
    'The explainability engine ensures every recommendation can trace its reasoning back through '
    'evidence chains to source data.'
))

story.append(h3('11.2 Advisor Gaps'))

advisor_gaps = [
    ['Advisor Gap', 'Category', 'Priority'],
    ['Multi-turn conversation state awareness', 'A (Core)', 'High'],
    ['Real tool integrations (email, calendar)', 'A (Core)', 'High'],
    ['Multi-account analysis (functional depth)', 'A (Core)', 'Medium'],
    ['Memory consolidation scheduling', 'B (Enterprise)', 'Medium'],
    ['Agent framework tool stubs', 'A (Core)', 'High'],
    ['Strategic reasoning templates', 'A (Core)', 'Low'],
]
story.append(spacer(4))
story.append(build_table(advisor_gaps, [AW*0.38, AW*0.22, AW*0.15]))

story.append(body(
    'The most significant advisor gap is the lack of multi-turn conversation state awareness: each '
    'query is independently orchestrated without building on previous conversation context. '
    'The agent framework is architecturally complete but agents have no real tools to call. '
    'Connecting the framework to email sending, calendar booking, and CRM write-back would '
    'transform the advisor from an intelligence analysis tool into an actionable intelligence '
    'operations center. The cross-account analysis route exists at /api/intelligence/cross-account/ '
    'but the implementation is minimal (141 lines) compared to the architectural ambition.'
))

story.append(PageBreak())

# ══════════════════════════════════════════════════════════════
# CHAPTER 12: Intelligence Lifecycle Link Integrity
# ══════════════════════════════════════════════════════════════
story.append(h1('12. Intelligence Lifecycle Link Integrity'))

story.append(body(
    'The intelligence lifecycle must maintain strong data flow connections between each stage to '
    'ensure that raw company data transforms progressively into actionable intelligence at the '
    'AI advisor layer. This section evaluates the integrity of links between adjacent lifecycle '
    'stages, identifying broken or weakened connections that impede intelligence flow.'
))

links_data = [
    ['Link', 'Direction', 'Status', 'Impact'],
    ['Company Data to Signal Detection', 'Forward', 'Strong', 'Enrichment pipeline triggers signal extraction'],
    ['Signal Detection to Evidence Layer', 'Bidirectional', 'Strong', 'Evidence collected per signal; signals validated by evidence'],
    ['Evidence Layer to Knowledge Graph', 'Forward', 'Broken', 'KG is in-memory; evidence cannot query graph topology'],
    ['Knowledge Graph to Capability Matching', 'Forward', 'Moderate', 'Graph reasoning exists but no persistent context'],
    ['Capability Matching to Buyer Intelligence', 'Forward', 'Weak', 'No capability-buyer persona mapping'],
    ['Buyer Intelligence to Revenue Intelligence', 'Bidirectional', 'Weak', 'Buying intent feeds scoring; no feedback from revenue outcomes'],
    ['Revenue Intelligence to Sales Execution', 'Forward', 'Strong', 'Prioritized accounts feed action engine'],
    ['Sales Execution to AI Advisor', 'Forward', 'Strong', 'Actions and briefs feed advisor context'],
    ['AI Advisor to Learning Loop', 'Feedback', 'Broken', 'Feedback collected but not connected to model recalibration'],
    ['Alert System to External Channels', 'Forward', 'Missing', 'Alerts are in-app only; no webhook/email/SMS integration'],
    ['Monitoring to Event-Driven Architecture', 'Forward', 'Missing', 'Polling-based health checks; no event subscription model'],
]
story.append(spacer(4))
story.append(build_table(links_data, [AW*0.20, AW*0.12, AW*0.12, AW*0.46]))

story.append(spacer(8))
story.append(body(
    'Three critical broken links require attention. First, the Evidence-to-Knowledge-Graph link '
    'is broken because the knowledge graph is in-memory and cannot be queried by the evidence '
    'framework\'s grounding engine for persistent graph topology. Second, the AI-Advisor-to-Learning-Loop '
    'link is broken because 1,862 lines of feedback and learning code exist but zero actual outcome '
    'data flows back to recalibrate confidence weights and scoring models. Third, the Alert-to-External-Channels '
    'link is missing entirely, with alerts confined to the application interface. For a dedicated '
    'enterprise instance, this means operations teams cannot receive intelligence alerts through '
    'Slack, email, or webhook integrations without building custom middleware.'
))

story.append(PageBreak())

# ══════════════════════════════════════════════════════════════
# CHAPTER 13: Enterprise Deployment Readiness
# ══════════════════════════════════════════════════════════════
story.append(h1('13. Enterprise Deployment Readiness'))

story.append(body(
    'Enterprise deployment readiness evaluates the platform\'s ability to operate as a production-grade '
    'dedicated instance for an enterprise customer. This assessment explicitly excludes SaaS-specific '
    'requirements (multi-tenancy, tenant isolation, tenant management, SaaS scalability) and focuses '
    'on the operational requirements of running a single-tenant enterprise intelligence platform.'
))

deploy_data = [
    ['Requirement', 'Status', 'Detail'],
    ['Docker deployment', 'Production-Ready', 'Multi-stage, non-root, health checks, automated backups'],
    ['PostgreSQL persistence', 'Production-Ready', '105 models, pgbouncer support, 30-day backup rotation'],
    ['Environment configuration', 'Production-Ready', '150-line .env.example, graceful AI degradation'],
    ['Security (auth + RBAC + audit)', 'Production-Ready', 'SHA-256 sessions, PBKDF2, 37 permissions, dual audit'],
    ['AI provider failover', 'Production-Ready', 'Model router: NVIDIA, Fireworks, Groq, Gemini'],
    ['Data import pipeline', 'Production-Ready', 'CSV, Excel, column detection, quality scoring, dedup'],
    ['Data export', 'Functional', 'CSV/JSON export for 5 entities; synchronous only'],
    ['Health monitoring', 'Functional', '6 health endpoints; no push-based alerting'],
    ['Error tracking', 'Configurable', 'Sentry integration (client + server + edge); optional'],
    ['TLS termination', 'Not included', 'Requires external reverse proxy (Caddyfile provided)'],
    ['Secrets management', 'Basic', 'Environment variables only; no Vault/KMS integration'],
    ['Horizontal scaling', 'Not designed', 'Single app instance; in-memory state is per-process'],
]
story.append(spacer(4))
story.append(build_table(deploy_data, [AW*0.20, AW*0.15, AW*0.55]))

story.append(body(
    'The deployment model is well-suited for the dedicated enterprise instance architecture. '
    'Docker Compose provides a complete self-contained deployment with PostgreSQL, application, '
    'and backup services. The in-memory rate limits, event bus, and AI cache are process-scoped, '
    'which is appropriate for a single-instance deployment. Horizontal scaling is not a requirement '
    'for dedicated instances; if an enterprise needs more capacity, vertical scaling of the single '
    'instance is the intended approach. The Caddyfile at the project root provides TLS termination '
    'configuration for production deployment. For enterprise environments with existing secret '
    'management infrastructure, the .env-based configuration could be extended to support Vault '
    'or KMS integration, but this is a deployment convenience rather than a product gap.'
))

story.append(PageBreak())

# ══════════════════════════════════════════════════════════════
# CHAPTER 14: Gap Classification
# ══════════════════════════════════════════════════════════════
story.append(h1('14. Gap Classification: A) Core Product vs B) Enterprise'))

story.append(body(
    'This chapter classifies all identified gaps into two categories. Category A gaps represent '
    'core product intelligence capability deficiencies that directly impact the central product '
    'question: "Can DeepMindQ understand an enterprise\'s market, accounts, buyers, capabilities, '
    'signals, and recommend the next best revenue action?" Category B gaps represent enterprise '
    'deployment requirements that support production operations but do not define the core product '
    'differentiation. This separation ensures that investment prioritization focuses on intelligence '
    'differentiation rather than enterprise commodity features.'
))

story.append(h3('14.1 Category A: Core Product Intelligence Gaps'))

cat_a_data = [
    ['Gap', 'Lifecycle Stage', 'Severity', 'Estimated Effort'],
    ['KG persistence: enable cold-start hydration', 'Knowledge Weaving', 'Critical', '2-3 weeks'],
    ['Feedback loop: connect outcomes to recalibration', 'All stages', 'Critical', '3-4 weeks'],
    ['Buyer journey stage tracking', 'Buyer Intelligence', 'High', '2-3 weeks'],
    ['Pipeline forecasting (time-to-close)', 'Revenue Intelligence', 'High', '2-3 weeks'],
    ['Agent framework: connect real tool integrations', 'AI Advisor', 'High', '3-4 weeks'],
    ['Multi-turn advisor conversation state', 'AI Advisor', 'High', '1-2 weeks'],
    ['Deal coaching / competitive battle cards', 'Sales Execution', 'High', '2-3 weeks'],
    ['Signal sequence engine activation', 'Signal Detection', 'Medium', '1 week'],
    ['Buyer persona clustering across accounts', 'Buyer Intelligence', 'Medium', '2 weeks'],
    ['Win probability calibration from outcomes', 'Revenue Intelligence', 'Medium', '1-2 weeks'],
    ['Dashboard: connect to real trust APIs', 'Trust Layer', 'Medium', '1 week'],
    ['Cross-account analysis functional depth', 'AI Advisor', 'Medium', '2-3 weeks'],
]
story.append(spacer(4))
story.append(build_table(cat_a_data, [AW*0.35, AW*0.20, AW*0.12, AW*0.18]))

story.append(h3('14.2 Category B: Enterprise Deployment Gaps'))

cat_b_data = [
    ['Gap', 'Area', 'Severity', 'Estimated Effort'],
    ['Push-based alerting (webhooks/email)', 'Operations', 'Medium', '1-2 weeks'],
    ['Prometheus/OpenMetrics endpoint', 'Monitoring', 'Low', '1 week'],
    ['Audit log retention/TTL policy', 'Governance', 'Low', '2-3 days'],
    ['Async export job queue', 'Data Portability', 'Low', '1 week'],
    ['Connector scheduling (cron activation)', 'Operations', 'Medium', '1-2 weeks'],
    ['RBAC enforcement at proxy level', 'Security', 'Low', '1-2 weeks'],
    ['OTLP trace export', 'Observability', 'Low', '1 week'],
    ['Secrets management (Vault/KMS)', 'Security', 'Low', '1-2 weeks'],
]
story.append(spacer(4))
story.append(build_table(cat_b_data, [AW*0.35, AW*0.20, AW*0.12, AW*0.18]))

story.append(body(
    'The Category A gaps total approximately 20-25 weeks of focused development effort. The most '
    'impactful single investment is enabling knowledge graph persistence with cold-start hydration, '
    'as this unblocks the entire downstream intelligence pipeline. The second most impactful investment '
    'is connecting the feedback learning loop, which enables the system to improve from actual '
    'outcomes rather than operating on static models. Together, these two investments would raise '
    'the weighted maturity score from 67.9 to approximately 78-82.'
))

story.append(PageBreak())

# ══════════════════════════════════════════════════════════════
# CHAPTER 15: Weighted Maturity Score
# ══════════════════════════════════════════════════════════════
story.append(h1('15. Weighted Maturity Score'))

story.append(body(
    'The following scorecard presents the final weighted maturity assessment. Weights are '
    'intelligence-centric, emphasizing the differentiation layers that define DeepMindQ\'s '
    'position as an Enterprise Intelligence OS. Foundation infrastructure (data layer, operations) '
    'receives lower weight because these are commodity requirements shared by all enterprise '
    'software. The intelligence differentiation layers (signals, evidence, buyer intelligence, '
    'revenue intelligence, AI advisor) receive higher weight because they answer the core product '
    'question.'
))

scorecard_data = [
    ['Lifecycle Stage', 'Raw Score', 'Weight', 'Weighted', 'Grade'],
    ['Company Data Layer', '85/100', '8%', '6.8', 'B+'],
    ['Knowledge Weaving (KG)', '35/100', '12%', '4.2', 'C-'],
    ['Signal Detection', '72/100', '14%', '10.1', 'B'],
    ['Evidence & Trust', '88/100', '14%', '12.3', 'A-'],
    ['Capability Understanding', '75/100', '8%', '6.0', 'B'],
    ['Buyer Intelligence', '55/100', '12%', '6.6', 'C+'],
    ['Revenue Intelligence', '68/100', '14%', '9.5', 'B-'],
    ['Sales Execution Intelligence', '58/100', '10%', '5.8', 'C+'],
    ['AI Advisor', '82/100', '8%', '6.6', 'B+'],
    ['TOTAL', '--', '100%', '67.9', 'B-'],
]
story.append(spacer(4))
story.append(build_table(scorecard_data, [AW*0.28, AW*0.14, AW*0.12, AW*0.14, AW*0.12]))

story.append(spacer(12))

# Scoring interpretation
story.append(Paragraph('<b>Score Interpretation</b>', sH3))
interpretation_data = [
    ['Score Range', 'Grade', 'Interpretation'],
    ['90-100', 'A / A+', 'Production-grade intelligence differentiation; minimal gaps'],
    ['80-89', 'B+ / A-', 'Strong intelligence maturity; minor refinements needed'],
    ['70-79', 'B', 'Solid intelligence foundation; key gaps in 1-2 stages'],
    ['60-69', 'B- / C+', 'Architecturally sound; significant gaps in multiple stages'],
    ['50-59', 'C', 'Intelligence pipeline incomplete; major differentiation gaps'],
    ['Below 50', 'D+ / F', 'Intelligence architecture not yet differentiated'],
]
story.append(build_table(interpretation_data, [AW*0.18, AW*0.15, AW*0.57]))

story.append(body(
    'DeepMindQ\'s score of 67.9 (B-) reflects a system with exceptional depth in evidence-based '
    'reasoning and AI governance (the deepest differentiation layers), strong architectural '
    'patterns across the intelligence pipeline, but critical persistence gaps in the knowledge '
    'graph and immaturity in the intermediate intelligence stages (buyer intelligence, sales '
    'execution). The system is architecturally sound and well-differentiated from conventional '
    'CRM platforms, but requires focused investment in knowledge persistence, feedback loops, '
    'and buyer journey modeling to reach production-grade intelligence completeness.'
))

story.append(PageBreak())

# ══════════════════════════════════════════════════════════════
# CHAPTER 16: Priority Action Roadmap
# ══════════════════════════════════════════════════════════════
story.append(h1('16. Priority Action Roadmap'))

story.append(body(
    'The following roadmap prioritizes actions by their impact on the weighted maturity score and '
    'the core product intelligence question. Actions are sequenced to maximize early value: '
    'persistence first (unblocks all downstream), feedback loop second (enables learning), then '
    'layer-specific enhancements.'
))

roadmap_data = [
    ['Phase', 'Action', 'Target Stage', 'Impact', 'Effort'],
    ['P1', 'Enable KG cold-start hydration from DB', 'Knowledge Weaving', '+8 points', '2-3 weeks'],
    ['P2', 'Connect feedback loop to outcome data', 'All stages', '+6 points', '3-4 weeks'],
    ['P3', 'Implement buyer journey stage tracking', 'Buyer Intelligence', '+4 points', '2-3 weeks'],
    ['P4', 'Wire agent framework to real tools', 'AI Advisor', '+3 points', '3-4 weeks'],
    ['P5', 'Add multi-turn conversation state', 'AI Advisor', '+2 points', '1-2 weeks'],
    ['P6', 'Implement pipeline forecasting', 'Revenue Intelligence', '+3 points', '2-3 weeks'],
    ['P7', 'Build deal coaching system', 'Sales Execution', '+2 points', '2-3 weeks'],
    ['P8', 'Connect dashboard to real trust APIs', 'Trust Layer', '+1 point', '1 week'],
    ['P9', 'Activate signal sequence engine', 'Signal Detection', '+2 points', '1 week'],
    ['P10', 'Calibrate win probability from outcomes', 'Revenue Intelligence', '+1 point', '1-2 weeks'],
]
story.append(spacer(4))
story.append(build_table(roadmap_data, [AW*0.06, AW*0.32, AW*0.20, AW*0.14, AW*0.14]))

story.append(spacer(12))

story.append(body(
    '<b>Estimated total effort for P1-P10: 18-28 weeks</b>. Completing P1 and P2 alone '
    '(5-7 weeks) would raise the weighted maturity score from 67.9 to approximately 78, '
    'moving the platform from B- to B+ territory. Completing P1 through P6 (13-19 weeks) '
    'would target a score of approximately 83, entering A- territory. The roadmap is designed '
    'so that each phase delivers independent value; there are no hard dependencies between phases '
    'beyond P1 (KG persistence) which unblocks P3 (buyer journey) and P9 (signal sequences) by '
    'providing a persistent knowledge substrate for these features to operate against.'
))

story.append(spacer(20))
story.append(hr())
story.append(spacer(8))

# ── Chinese Summary ─────────────────────────────────────────────
story.append(h2('Appendix: Chinese Executive Summary'))

story.append(spacer(4))

cn_body = ParagraphStyle('CNBody', fontName='NotoSansSC', fontSize=10, leading=16,
                         textColor=TEXT_PRIMARY, spaceAfter=6, alignment=TA_JUSTIFY)
cn_h3 = ParagraphStyle('CNH3', fontName='NotoSansSC-Bold', fontSize=14, leading=18,
                        textColor=ACCENT, spaceAfter=6, spaceBefore=10)

story.append(Paragraph('<b>DeepMindQ Intelligence Architecture Maturity Audit - Summary</b>', cn_h3))

story.append(Paragraph(
    'DeepMindQ Enterprise Intelligence OS Intelligence Architecture Maturity Audit Complete. '
    'The platform is evaluated under a Dedicated Enterprise Instance architecture (single tenant, '
    'not multi-tenant SaaS). The core evaluation dimension is: "Can DeepMindQ understand an '
    'enterprise\'s market, accounts, buyers, capabilities, signals, and recommend the next best '
    'revenue action?"', cn_body))

story.append(Paragraph(
    'Overall weighted score: 67.9/100 (B- grade). The system has exceptional depth in evidence-based '
    'reasoning and AI governance (88/100, approximately 23,249 lines of governance code), strong AI '
    'advisor architecture (82/100, approximately 13,500 lines), and solid data foundation (85/100). '
    'Critical gaps exist in knowledge graph persistence (35/100, in-memory only, complete data loss '
    'on restart), buyer intelligence (55/100), and sales execution (58/100).', cn_body))

story.append(Paragraph(
    'Most critical action items: (1) Enable knowledge graph cold-start hydration from database (2-3 '
    'weeks, +8 points), (2) Connect feedback learning loop to actual outcome data (3-4 weeks, +6 '
    'points). Completing these two actions will raise the score to approximately 78 (B+ grade). '
    'Total estimated effort for full roadmap (10 actions): 18-28 weeks, targeting 83 points (A- grade).', cn_body))

story.append(Paragraph(
    'All gaps are classified as Category A (core product intelligence gaps) or Category B (enterprise '
    'deployment requirements). Multi-tenancy, tenant isolation, SaaS scalability, and CRM comparison '
    'are all excluded from assessment scope. The audit confirms the dedicated instance architecture '
    'is the correct deployment model and does not list multi-tenancy as a missing capability.', cn_body))

# ── Build ────────────────────────────────────────────────────
doc.build(story)
print(f"Report generated: {OUTPUT_PATH}")
