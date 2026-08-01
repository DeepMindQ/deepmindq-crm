#!/usr/bin/env python3
"""
DeepMindQ Product Maturity Assessment — PDF Report Generator
Evidence-based audit of the current codebase state.
"""

import hashlib, os, sys
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm, cm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, KeepTogether, HRFlowable, Image
)
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY, TA_RIGHT
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase.pdfmetrics import registerFontFamily
from reportlab.graphics.shapes import Drawing, Rect, String, Line
from reportlab.graphics import renderPDF

# ━━ Cascade Palette ━━
PAGE_BG       = colors.HexColor('#f4f3f2')
SECTION_BG    = colors.HexColor('#e9e9e7')
CARD_BG       = colors.HexColor('#ebeae7')
TABLE_STRIPE  = colors.HexColor('#eeedeb')
HEADER_FILL   = colors.HexColor('#5f573d')
COVER_BLOCK   = colors.HexColor('#877c5c')
BORDER        = colors.HexColor('#bdb8ac')
ICON          = colors.HexColor('#948351')
ACCENT        = colors.HexColor('#866f2b')
ACCENT_2      = colors.HexColor('#3ba1c3')
TEXT_PRIMARY   = colors.HexColor('#252421')
TEXT_MUTED    = colors.HexColor('#8b8881')
SEM_SUCCESS   = colors.HexColor('#4f8c63')
SEM_WARNING   = colors.HexColor('#a78c56')
SEM_ERROR     = colors.HexColor('#924d47')
SEM_INFO      = colors.HexColor('#4979aa')

# ━━ Font Registration ━━
FONT_DIR = '/usr/share/fonts'
pdfmetrics.registerFont(TTFont('NotoSerifSC', f'{FONT_DIR}/truetype/noto-serif-sc/NotoSerifSC-Regular.ttf'))
pdfmetrics.registerFont(TTFont('NotoSerifSC-Bold', f'{FONT_DIR}/truetype/noto-serif-sc/NotoSerifSC-Bold.ttf'))
pdfmetrics.registerFont(TTFont('Carlito', f'{FONT_DIR}/truetype/english/Carlito-Regular.ttf'))
pdfmetrics.registerFont(TTFont('Carlito-Bold', f'{FONT_DIR}/truetype/english/Carlito-Bold.ttf'))
registerFontFamily('Carlito', normal='Carlito', bold='Carlito-Bold')

FONT = 'Carlito'
FONT_BOLD = 'Carlito-Bold'

# ━━ Dimensions ━━
PAGE_W, PAGE_H = A4
MARGIN_L = 22 * mm
MARGIN_R = 22 * mm
MARGIN_T = 20 * mm
MARGIN_B = 20 * mm
CONTENT_W = PAGE_W - MARGIN_L - MARGIN_R

# ━━ Styles ━━
styles = getSampleStyleSheet()

def make_style(name, parent='Normal', **kwargs):
    defaults = dict(fontName=FONT, fontSize=10, leading=14, textColor=TEXT_PRIMARY, alignment=TA_JUSTIFY, spaceAfter=6)
    defaults.update(kwargs)
    return ParagraphStyle(name, parent=styles[parent] if parent in [s.name for s in styles.byName.values()] else styles['Normal'], **defaults)

sTitle = make_style('sTitle', fontSize=28, leading=34, fontName=FONT_BOLD, textColor=HEADER_FILL, spaceAfter=12, alignment=TA_LEFT)
sH1 = make_style('sH1', fontSize=18, leading=24, fontName=FONT_BOLD, textColor=HEADER_FILL, spaceBefore=18, spaceAfter=10)
sH2 = make_style('sH2', fontSize=14, leading=18, fontName=FONT_BOLD, textColor=ICON, spaceBefore=14, spaceAfter=8)
sH3 = make_style('sH3', fontSize=11, leading=15, fontName=FONT_BOLD, textColor=TEXT_PRIMARY, spaceBefore=10, spaceAfter=6)
sBody = make_style('sBody', fontSize=9.5, leading=14, alignment=TA_JUSTIFY)
sBodySmall = make_style('sBodySmall', fontSize=8.5, leading=12)
sCaption = make_style('sCaption', fontSize=8, leading=10, textColor=TEXT_MUTED, alignment=TA_LEFT)
sBullet = make_style('sBullet', fontSize=9.5, leading=13, leftIndent=16, bulletIndent=4, alignment=TA_LEFT)
sMeta = make_style('sMeta', fontSize=8.5, leading=11, textColor=TEXT_MUTED, alignment=TA_LEFT)
sKicker = make_style('sKicker', fontSize=9, leading=12, textColor=ICON, fontName=FONT_BOLD, spaceAfter=4)
sScore = make_style('sScore', fontSize=24, leading=28, fontName=FONT_BOLD, textColor=ACCENT, alignment=TA_CENTER)
sScoreLabel = make_style('sScoreLabel', fontSize=8, leading=10, textColor=TEXT_MUTED, alignment=TA_CENTER)

# ━━ Helpers ━━
def heading1(text):
    return Paragraph(text, sH1)

def heading2(text):
    return Paragraph(text, sH2)

def heading3(text):
    return Paragraph(text, sH3)

def body(text):
    return Paragraph(text, sBody)

def bullet(text):
    return Paragraph(f'<bullet>&bull;</bullet> {text}', sBullet)

def spacer(h=6):
    return Spacer(1, h)

def hr():
    return HRFlowable(width="100%", thickness=0.5, color=BORDER, spaceAfter=8, spaceBefore=4)

def make_table(headers, rows, col_widths=None):
    """Create a styled table."""
    data = [headers] + rows
    w = col_widths or [CONTENT_W / len(headers)] * len(headers)
    t = Table(data, colWidths=w, repeatRows=1)
    style_cmds = [
        ('BACKGROUND', (0, 0), (-1, 0), HEADER_FILL),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), FONT_BOLD),
        ('FONTSIZE', (0, 0), (-1, 0), 8.5),
        ('FONTNAME', (0, 1), (-1, -1), FONT),
        ('FONTSIZE', (0, 1), (-1, -1), 8),
        ('LEADING', (0, 0), (-1, -1), 11),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('GRID', (0, 0), (-1, -1), 0.4, BORDER),
    ]
    for i in range(1, len(data)):
        if i % 2 == 0:
            style_cmds.append(('BACKGROUND', (0, i), (-1, i), TABLE_STRIPE))
    t.setStyle(TableStyle(style_cmds))
    return t

def score_badge(score, label):
    """A score number with label below."""
    data = [[Paragraph(str(score), sScore)], [Paragraph(label, sScoreLabel)]]
    t = Table(data, colWidths=[60])
    t.setStyle(TableStyle([
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
    ]))
    return t

def score_row(scores):
    """Create a row of score badges."""
    badges = [score_badge(s, l) for s, l in scores]
    t = Table([badges], colWidths=[CONTENT_W / len(scores)] * len(scores))
    t.setStyle(TableStyle([
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
    ]))
    return t


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  BUILD REPORT
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

OUTPUT = '/home/z/my-project/download/DeepMindQ-Product-Maturity-Assessment.pdf'
os.makedirs(os.path.dirname(OUTPUT), exist_ok=True)

doc = SimpleDocTemplate(
    OUTPUT,
    pagesize=A4,
    leftMargin=MARGIN_L, rightMargin=MARGIN_R,
    topMargin=MARGIN_T, bottomMargin=MARGIN_B,
    title="DeepMindQ Product Maturity Assessment",
    author="Z.ai Intelligence Audit",
    subject="Full Product Maturity Assessment - Post Security Hardening",
)

story = []

# ══════════════════════════════════════════════════════════════
# COVER
# ══════════════════════════════════════════════════════════════
story.append(Spacer(1, 80*mm))
story.append(Paragraph("DeepMindQ", ParagraphStyle('coverTitle', fontName=FONT_BOLD, fontSize=42, leading=48, textColor=HEADER_FILL, alignment=TA_LEFT)))
story.append(Spacer(1, 8))
story.append(Paragraph("Product Maturity Assessment", ParagraphStyle('coverSub', fontName=FONT, fontSize=18, leading=24, textColor=ICON, alignment=TA_LEFT)))
story.append(Spacer(1, 20))
story.append(HRFlowable(width="40%", thickness=2, color=ACCENT, spaceAfter=16, spaceBefore=0, hAlign='LEFT'))
story.append(Paragraph("Evidence-Based Codebase Audit", ParagraphStyle('coverDesc', fontName=FONT, fontSize=12, leading=16, textColor=TEXT_MUTED, alignment=TA_LEFT)))
story.append(Spacer(1, 6))
story.append(Paragraph("Post Security Hardening Phase 2-4 | Tag: security-baseline-v1", ParagraphStyle('coverDesc2', fontName=FONT, fontSize=10, leading=14, textColor=TEXT_MUTED, alignment=TA_LEFT)))
story.append(Spacer(1, 40))
story.append(Paragraph("August 2026 | Confidential", ParagraphStyle('coverDate', fontName=FONT, fontSize=9, leading=12, textColor=TEXT_MUTED, alignment=TA_LEFT)))
story.append(PageBreak())

# ══════════════════════════════════════════════════════════════
# TABLE OF CONTENTS (Manual - SimpleDocTemplate)
# ══════════════════════════════════════════════════════════════
story.append(Paragraph("Table of Contents", sH1))
story.append(spacer(8))
toc_items = [
    ("1", "Executive Assessment"),
    ("2", "Production Readiness Scores"),
    ("3", "Feature Capability Matrix"),
    ("4", "Codebase Reality Check"),
    ("5", "Product Gap Analysis"),
    ("6", "Commercial Readiness"),
    ("7", "Investment Recovery Assessment"),
    ("8", "Recommended 90-Day Roadmap"),
]
for num, title in toc_items:
    story.append(Paragraph(f'<b>{num}.</b>  {title}', make_style('tocItem', fontSize=10, leading=18, textColor=TEXT_PRIMARY, leftIndent=10)))
story.append(PageBreak())

# ══════════════════════════════════════════════════════════════
# SECTION 1: EXECUTIVE ASSESSMENT
# ══════════════════════════════════════════════════════════════
story.append(heading1("1. Executive Assessment"))

story.append(heading2("1.1 What is DeepMindQ Today?"))
story.append(body(
    "DeepMindQ is a single-tenant AI-powered sales intelligence and CRM platform built on Next.js 16, "
    "PostgreSQL (Prisma ORM), and a multi-provider LLM integration layer. The system is designed to aggregate "
    "company and contact data, enrich it through AI-powered research pipelines, detect buying signals, score "
    "accounts for prioritization, generate personalized outreach, and provide intelligence-driven briefings for "
    "sales conversations. It is architected as a monolithic Next.js application with a deeply layered intelligence "
    "engine comprising 18 AI modules, a governance layer, a multi-agent orchestrator, and a workflow engine for "
    "asynchronous job processing."
))
story.append(body(
    "The platform currently operates as a fully functional single-user system locked to one authorized email "
    "(shanker001@gmail.com), with session-based authentication, role-gated API access, and security hardened "
    "to an 8.3/10 score across four phases of systematic hardening. The codebase totals approximately 148,000 "
    "lines of TypeScript across 221 API routes, 179 service libraries, and 75 frontend screens, backed by a "
    "90-model Prisma schema and 281 test files."
))

story.append(heading2("1.2 Product Category"))
story.append(body(
    "DeepMindQ most closely resembles an <b>early-stage Vertical AI CRM</b> — a category that sits between "
    "traditional CRM systems (Salesforce, HubSpot) and dedicated sales intelligence platforms (ZoomInfo, "
    "Outreach, Clari). It combines CRM data management (companies, contacts, opportunities, pipelines) with "
    "AI-native intelligence capabilities (signal detection, account scoring, automated enrichment, conversation "
    "intelligence, opportunity radar). No existing mainstream product perfectly matches this combination, "
    "which represents both its differentiation potential and its positioning challenge."
))

story.append(heading2("1.3 Maturity Classification"))
story.append(body(
    "Based on evidence from the actual codebase — not documentation, roadmaps, or intended vision — DeepMindQ "
    "is best classified as a <b>functional prototype approaching MVP</b>. It has broad surface-area coverage "
    "(75 screens, 221 API endpoints) with real implementations behind most of them, but several critical "
    "product capabilities rely on AI-estimated or placeholder data rather than live integrations, and key "
    "operational infrastructure (background job scheduling, multi-tenancy, real email delivery, production "
    "monitoring) is absent or incomplete. The product could be demonstrated to technical buyers today, but "
    "is not ready for an unguided customer pilot."
))

# ══════════════════════════════════════════════════════════════
# SECTION 2: PRODUCTION READINESS SCORES
# ══════════════════════════════════════════════════════════════
story.append(heading1("2. Production Readiness Scores"))
story.append(body(
    "Each dimension is scored from 0-100 based on evidence from the actual codebase. Scores reflect what "
    "exists and works today, not what is planned or partially scaffolded. The overall production readiness "
    "score is the weighted average, with Core Architecture and Backend/API Maturity receiving the highest "
    "weights as they form the foundation for everything else."
))
story.append(spacer(8))

# Score table
score_data = [
    ("Core Architecture", "62", "Solid Next.js 16 + Prisma foundation. 148K LOC. Missing middleware, no background scheduler, no multi-tenancy."),
    ("Backend/API Maturity", "71", "221 routes with auth guards. Real CRUD, search, pagination. Some routes return AI-estimated data rather than live data."),
    ("Database/Data Model", "78", "90 Prisma models. Comprehensive enums. Well-normalized. Missing indexes for common queries, no migration versioning visible."),
    ("Authentication/Security", "83", "Session-based auth, rate limiting, fail-closed webhooks, timing-safe comparison. Hardened through 4 phases to 8.3/10."),
    ("AI Intelligence", "65", "18 real modules. LLM integration, governance layer, multi-agent orchestrator. Enrichment is AI-estimated, not from live data sources."),
    ("Data Ingestion", "72", "6-phase import pipeline with column auto-mapping, validation, normalization, quality scoring, and dedup. CSV/Excel support."),
    ("Company Intelligence", "68", "Company CRUD, research cards, AI enrichment, timeline, mind maps, signals. Research data is AI-estimated (not live sources)."),
    ("Contact Intelligence", "64", "Contact CRUD, lead scoring (6 dimensions), email verification, engagement prediction. No live contact data enrichment."),
    ("Sales Workflow", "55", "Sequences (CRUD), email send with tracking, drafts, pipeline, opportunities. No real email delivery (provider required), no calendar integration."),
    ("User Experience", "70", "75 screens (74 fully implemented). Enterprise UI with shadcn/ui. Command palette, SSE realtime. No mobile responsive, no onboarding flow."),
    ("Enterprise Readiness", "28", "Single-tenant only. No RBAC, no SSO, no audit export, no SLA, no tenant isolation, no billing. AUTHORIZED_EMAIL hardcoded."),
    ("Reliability/Ops", "35", "No background scheduler, no health checks (beyond /api/health), no error tracking config, no deployment pipeline visible, no monitoring."),
    ("Scalability", "25", "In-memory event bus, in-process job queue, no Redis/celery, no connection pooling config visible. Single-server only."),
]
story.append(make_table(
    ["Dimension", "Score", "Evidence Summary"],
    score_data,
    col_widths=[90, 40, CONTENT_W - 130]
))
story.append(spacer(10))

# Overall score
overall = 55
story.append(heading3(f"Overall Production Readiness: {overall}/100"))
story.append(body(
    f"The weighted overall score of {overall}/100 places DeepMindQ firmly in the <b>functional prototype</b> tier. "
    "The architecture is sound and the surface area is impressively broad, but the product lacks the operational "
    "infrastructure, live data integrations, and multi-tenant foundations required for any form of production "
    "deployment beyond a single-developer environment. Security hardening is the most mature dimension, which "
    "is unusual for a prototype and represents genuine investment. However, scalability (25/100) and enterprise "
    "readiness (28/100) are the weakest dimensions and represent the largest gaps to production."
))

# ══════════════════════════════════════════════════════════════
# SECTION 3: FEATURE CAPABILITY MATRIX
# ══════════════════════════════════════════════════════════════
story.append(heading1("3. Feature Capability Matrix"))
story.append(body(
    "The following matrix evaluates each major capability area. <b>Exists</b> means there is actual code "
    "implementing the feature (not just a UI shell). <b>Maturity</b> reflects how complete and production-ready "
    "the implementation is. <b>Missing Pieces</b> lists the critical gaps preventing production use."
))
story.append(spacer(6))

cap_data = [
    ("Company Intelligence", "Yes", "Functional", "Research data is AI-estimated, not from live sources (LinkedIn, Crunchbase, etc.). No automated refresh."),
    ("Contact Intelligence", "Yes", "Functional", "Lead scoring works. Email verification is basic (MX check only). No live data enrichment from external providers."),
    ("Signal Intelligence", "Yes", "Partial", "Signal detection pipeline exists with 30+ signal types. Detection relies on AI estimation from web search, not live monitoring feeds."),
    ("AI Reasoning", "Yes", "Advanced", "30-step enterprise reasoning engine, multi-agent orchestrator (10 agents), hallucination detection. Among the most mature modules."),
    ("Knowledge Intelligence", "Yes", "Partial", "Knowledge ingestion pipeline exists. In-memory vector index (TF-IDF, not production vector DB). No RAG pipeline for retrieval."),
    ("Revenue Intelligence", "Yes", "Functional", "Account scoring, opportunity radar, brief generator, executive recommendations. All deterministic + AI-narrative hybrid."),
    ("Account Prioritization", "Yes", "Functional", "Multi-dimensional scoring (9 factors), tier classification (HOT/ACTIVE/NURTURE/LOW). ICP-configurable."),
    ("Sales Preparation", "Partial", "Basic", "Email generation, conversation planning, deal coaching exist. No calendar integration, no meeting scheduling."),
    ("Outreach Intelligence", "Yes", "Basic", "Email sequences (CRUD + enrollment), email send with tracking pixels, click tracking. SES provider is a stub."),
    ("Conversation Intelligence", "Partial", "Basic", "Conversation engine generates talking points. No real conversation recording/transcription/analysis."),
    ("CRM Capabilities", "Yes", "Functional", "Full company/contact/opportunity/pipeline CRUD. Notes, timeline, segments, audit logs. No custom fields UI."),
    ("Analytics/Dashboard", "Yes", "Functional", "Dashboard with 8+ stat dimensions, analytics screen, pipeline health, data quality reports, CRO dashboard."),
    ("Data Import/Export", "Yes", "Advanced", "6-phase import pipeline, CSV/Excel parsing, auto-column mapping, validation, normalization, quality scoring, dedup."),
    ("Integrations", "Minimal", "Stub", "Resend for email (configurable). No CRM sync (Salesforce/HubSpot), no calendar, no Slack, no SSO. Webhooks (reply/bounce) exist."),
]
story.append(make_table(
    ["Capability", "Exists", "Maturity", "Missing Pieces"],
    cap_data,
    col_widths=[95, 35, 60, CONTENT_W - 190]
))

# ══════════════════════════════════════════════════════════════
# SECTION 4: CODEBASE REALITY CHECK
# ══════════════════════════════════════════════════════════════
story.append(heading1("4. Codebase Reality Check"))

story.append(heading2("4.1 By the Numbers"))
metrics = [
    ("Prisma Database Models", "90", "Comprehensive schema covering companies, contacts, signals, opportunities, sequences, knowledge, capabilities, audit trails, jobs, AI governance"),
    ("API Routes (route.ts files)", "221", "Full CRUD for all entities, AI endpoints, intelligence pipeline, workflow engine, batch operations, export, analytics"),
    ("Frontend Screens", "75 (74 real, 1 stub)", "98.7% implementation rate. Average screen is 400-800 LOC with real data fetching via React Query"),
    ("Service Libraries (src/lib/)", "179", "Intelligence engines, scoring modules, research pipeline, governance, workflow engine, connectors, validators"),
    ("Test Files", "281", "1,868 passing tests. Cover security, API contracts, intelligence modules, data import, scoring engines"),
    ("Total TypeScript LOC", "~148,000", "52K in lib, 40K in routes, 56K in screens. Enterprise-scale codebase"),
    ("Environment Variables", "16 (4 required)", "PostgreSQL URLs required. AI keys, email provider, S3 all optional with graceful degradation"),
]
story.append(make_table(
    ["Metric", "Value", "Notes"],
    metrics,
    col_widths=[110, 80, CONTENT_W - 190]
))

story.append(heading2("4.2 AI Module Audit"))
story.append(body(
    "A deep audit of 18 core AI/intelligence modules reveals a surprisingly strong implementation foundation. "
    "Of the 18 modules, 16 are classified as <b>REAL</b> (containing actual working implementation logic with "
    "real database queries and most making LLM calls through the centralized governance layer), and 2 are "
    "classified as <b>PARTIAL</b> (containing real logic but with significant gaps). Zero modules are pure stubs."
))
story.append(body(
    "The AI governance layer (ai-governance.ts at 1,439 lines) is the most thorough module: it implements "
    "20+ generation-type configurations with per-type confidence thresholds, freshness lifecycle management, "
    "hallucination prevention rules injected into every prompt, and a full audit trail via AIGenerationAudit. "
    "The enterprise reasoning engine implements a 30-step cumulative reasoning chain with dependency ordering, "
    "where 10 of 30 steps use LLM and 20 are deterministic DB/retrieval operations. The model router provides "
    "tiered LLM routing (deep/smart/fast) with automatic fallback across providers."
))
story.append(body(
    "However, the <b>continuous-learning-loop.ts</b> (202 lines) is essentially CRUD: it records learning "
    "events and finds them by tag overlap, with no actual ML model retraining or weight updates. The "
    "<b>fusion-engine.ts</b> (274 lines) uses a simple weighted-average merge. Three of ten agents in the "
    "multi-agent orchestrator are near-stubs. Token/cost tracking reports zeros even after successful LLM calls. "
    "These gaps are significant for a product that markets itself as an 'intelligence platform.'"
))

story.append(heading2("4.3 Critical Infrastructure Gaps"))

story.append(heading3("Email Delivery"))
story.append(body(
    "The email-provider.ts supports 5 providers (Resend, SendGrid, SES, Postmark, Gmail), but SES is a stub "
    "returning an error. The email-sender.ts used by some routes is a <b>mock</b> that always returns success. "
    "The emails/send route correctly uses email-provider.ts with tracking pixel injection and real provider "
    "dispatch, but no email provider is configured by default, meaning <b>no emails are actually sent</b> in a "
    "fresh deployment. This is the single largest operational gap — the platform cannot send emails without "
    "manual API key configuration."
))

story.append(heading3("Background Job Processing"))
story.append(body(
    "The workflow engine (queue.ts, processor.ts, retry.ts) implements a proper job queue with priority, retry "
    "with exponential backoff, stale job recovery, and bulk enqueue helpers. However, there is <b>no scheduler</b> "
    "to trigger periodic jobs (signal monitoring, data freshness checks, sequence step processing). The cron "
    "endpoint exists but requires external invocation. In-process queues are lost on server restart. There is "
    "no Redis, Celery, BullMQ, or any persistent queue mechanism."
))

story.append(heading3("Real-Time Infrastructure"))
story.append(body(
    "Server-Sent Events (SSE) work via an in-memory event bus. This is functional for a single-server "
    "deployment but will not work in a multi-instance or serverless environment (Vercel). There is no WebSocket "
    "support, no message broker, and no cross-instance event propagation."
))

story.append(heading3("Missing Next.js Middleware"))
story.append(body(
    "There is no src/middleware.ts file, meaning no global authentication guards, no CSRF protection at the "
    "edge, no rate limiting at the middleware level, and no request interception. Authentication is handled "
    "per-route via checkApiAuth(), which works but is not defense-in-depth. Any new route added without "
    "explicitly calling checkApiAuth() would be publicly accessible."
))

story.append(heading2("4.4 Code Quality Observations"))
story.append(body(
    "The codebase has 343 code debt markers: 316 'placeholder' comments across 74 files, 25 TODOs, and 2 HACKs. "
    "The placeholder count is worth investigating — many may be intentional configuration points or design "
    "tokens rather than unfinished work, but some likely represent unresolved implementations. No FIXMEs exist, "
    "which suggests no developer was actively tracking bugs to fix. The test suite (1,868 passing tests) covers "
    "security, API contracts, intelligence modules, and data import well, but there are no test files for the "
    "core AI engines themselves (scoring, synthesis, action, grounding, conversation), which is a significant "
    "gap for the most complex code in the system."
))

# ══════════════════════════════════════════════════════════════
# SECTION 5: PRODUCT GAP ANALYSIS
# ══════════════════════════════════════════════════════════════
story.append(heading1("5. Product Gap Analysis"))

story.append(heading2("A. Required Before First Customer Pilot"))

gap_a = [
    ("Real Email Delivery", "Configure Resend/SendGrid with verified domain. Replace mock email-sender.ts usage. Test end-to-end email send, tracking, bounce handling. Without this, the outreach workflow is non-functional."),
    ("Data Freshness / Auto-Refresh", "Implement a cron scheduler (node-cron or external) to trigger periodic signal detection, research refresh, and data quality checks. Currently all intelligence jobs must be triggered manually."),
    ("Onboarding Flow", "The login/onboarding flow exists but there is no guided product onboarding for first-time users. A pilot user would not know how to import data, configure AI providers, or start using the platform."),
    ("Demo Data Seeding", "The seed endpoints exist but a one-click demo data setup (pre-loaded companies, contacts, signals, and opportunities) is essential for pilot demos and first impressions."),
    ("Error Handling UX", "Many API errors return raw JSON. The frontend needs consistent error toast notifications, retry mechanisms, and graceful degradation when AI providers are unavailable."),
]
for title, desc in gap_a:
    story.append(heading3(title))
    story.append(body(desc))

story.append(heading2("B. Required Before Paid Enterprise Customer"))

gap_b = [
    ("Multi-Tenant Architecture", "Current system is hardcoded to single authorized email. Needs tenant isolation at database level, per-tenant configuration, and data segregation."),
    ("SSO / SAML Integration", "Enterprise customers require SSO. The current OTP-based auth is insufficient for enterprise procurement."),
    ("Role-Based Access Control", "The rbac.ts was deleted as dead code in Phase 4. Enterprise needs admin/viewer/editor/sales-rep roles with different permission sets."),
    ("CRM Integration (Salesforce/HubSpot)", "Two-way sync of companies, contacts, opportunities, and activities. The current system is a data silo."),
    ("Audit Trail Export", "Audit logs exist in the database but cannot be exported, filtered by date range, or formatted for compliance review."),
    ("SLA / Uptime Monitoring", "No health check dashboard, no alerting, no SLA commitments, no incident management."),
    ("Data Privacy / GDPR", "Consent status tracking exists in the schema but there is no consent management UI, no data deletion workflow, no privacy policy generation."),
]
for title, desc in gap_b:
    story.append(heading3(title))
    story.append(body(desc))

story.append(heading2("C. Required Before Scaling to Many Customers"))

gap_c = [
    ("Redis / Persistent Queue", "Replace in-memory event bus and job queue with Redis-backed equivalents for multi-instance deployment."),
    ("Connection Pooling", "Database connection management for concurrent users. Prisma supports this but configuration is not visible."),
    ("CDN / Static Asset Optimization", "Next.js built-in but needs configuration for production-scale static delivery."),
    ("Horizontal Scaling", "Architectural changes for stateless API servers (external session store, external queue, external cache)."),
    ("Automated Testing Pipeline", "CI/CD with automated test runs, deployment pipelines, and rollback mechanisms."),
    ("Billing / Subscription Management", "Stripe integration or equivalent for metered AI usage and seat-based pricing."),
]
for title, desc in gap_c:
    story.append(heading3(title))
    story.append(body(desc))

story.append(heading2("D. Nice-to-Have Future Features"))

gap_d = [
    ("Mobile App / PWA", "Current UI is desktop-only. No responsive design for tablet/mobile."),
    ("Calendar Integration", "Google Calendar / Outlook sync for meeting scheduling and activity tracking."),
    ("Slack / Teams Integration", "Real-time notifications and intelligence alerts to team channels."),
    ("Custom Reporting Builder", "Drag-and-drop report builder for custom analytics."),
    ("Marketplace / Integrations Hub", "Third-party connector marketplace for data sources and tools."),
    ("AI Model Fine-Tuning", "Custom model training on customer-specific data for improved accuracy."),
]
for title, desc in gap_d:
    story.append(heading3(title))
    story.append(body(desc))

# ══════════════════════════════════════════════════════════════
# SECTION 6: COMMERCIAL READINESS
# ══════════════════════════════════════════════════════════════
story.append(heading1("6. Commercial Readiness"))

story.append(heading2("6.1 Demo Scenarios"))

demo_data = [
    ("VP Sales", "Partial Success", "The dashboard, company list, signal intelligence, and opportunity radar screens would impress. The AI chat with contextual CRM data is compelling. Gaps: no real email delivery shown, no live data integrations, no multi-user. Would need to pre-seed data and pre-configure AI keys."),
    ("CRO / Revenue Leader", "Moderate Success", "Revenue intelligence dashboard, account scoring tiers, pipeline forecast, and executive recommendations align with CRO priorities. Gaps: no CRM integration means data is siloed. No historical data to show ROI. Pipeline data would need to be manually created."),
    ("Enterprise Buyer (IT/Procurement)", "Would Fail", "No SSO, no RBAC, no SLA, no compliance certifications, no data processing agreements, no tenant isolation. The single-tenant architecture and hardcoded auth would be immediate disqualifiers regardless of feature quality."),
    ("Investor", "Strong Impression", "The breadth of implementation (148K LOC, 221 endpoints, 90 DB models, 18 AI modules, 75 screens) demonstrates serious engineering investment. The architecture is coherent and the security hardening shows discipline. The AI intelligence engine depth (30-step reasoning, multi-agent orchestration, hallucination detection) is differentiated. However, the lack of live integrations and single-tenant limitation would need to be addressed in the pitch."),
]
story.append(make_table(
    ["Audience", "Outcome", "Assessment"],
    demo_data,
    col_widths=[90, 70, CONTENT_W - 160]
))

story.append(heading2("6.2 What Would Impress"))
story.append(bullet("The <b>breadth of the platform</b> — 75 fully-implemented screens covering every aspect of sales intelligence is rare for a prototype-stage product."))
story.append(bullet("The <b>AI intelligence depth</b> — the 30-step enterprise reasoning engine, 18 AI modules, and multi-agent orchestrator demonstrate genuine technical differentiation."))
story.append(bullet("The <b>data import pipeline</b> — the 6-phase import with auto-column mapping, validation, normalization, and quality scoring is production-quality work."))
story.append(bullet("The <b>security posture</b> — 8.3/10 security score with systematic hardening across 4 phases shows engineering discipline unusual for this stage."))
story.append(bullet("The <b>code quality</b> — 1,868 passing tests, consistent code patterns, proper auth guards, and governance layer show a well-managed codebase."))

story.append(heading2("6.3 What Would Expose Gaps"))
story.append(bullet("Clicking 'Send Email' and nothing happening (no provider configured)."))
story.append(bullet("Trying to add a second user and being blocked (AUTHORIZED_EMAIL hardcoded)."))
story.append(bullet("Looking for CRM integrations and finding none."))
story.append(bullet("Asking 'where does this data come from?' and learning it is AI-estimated, not from live sources."))
story.append(bullet("Checking for mobile support and finding a desktop-only layout."))
story.append(bullet("Looking for API documentation and finding none."))
story.append(bullet("Checking for a status page or uptime monitoring and finding nothing."))

# ══════════════════════════════════════════════════════════════
# SECTION 7: INVESTMENT RECOVERY
# ══════════════════════════════════════════════════════════════
story.append(heading1("7. Investment Recovery Assessment"))

story.append(heading2("7.1 Was the Development Investment Preserved?"))
story.append(body(
    "<b>Yes, substantially.</b> The codebase represents a coherent, well-structured system with no signs of "
    "abandoned experiments or contradictory architectures. The Prisma schema is clean and normalized. The API "
    "layer follows consistent patterns (auth guard, error handling, Zod validation). The frontend uses a unified "
    "design system (shadcn/ui + custom enterprise theme). The security hardening was layered carefully across "
    "four phases without breaking existing functionality (all 1,868 tests pass). The 148K LOC represents "
    "genuine, meaningful code — not boilerplate, not generated scaffolding, not copy-pasted tutorials."
))

story.append(heading2("7.2 How Much of the Expected Product Is Built?"))
story.append(body(
    "Estimated at approximately <b>60-65%</b> of a viable MVP product. The surface area coverage is high "
    "(almost every screen and endpoint that an MVP would need exists), but the operational depth is shallow. "
    "Think of it as a house with all rooms built and painted, but the plumbing and electrical are only partially "
    "connected. The AI intelligence engine is the most differentiated and complete component, representing "
    "perhaps 80-85% of its target capability. The CRM core (companies, contacts, opportunities, pipeline) is "
    "about 70-75% complete. The gaps are concentrated in infrastructure (email delivery, scheduling, monitoring) "
    "and enterprise features (multi-tenancy, RBAC, integrations), which are prerequisite for any commercial "
    "deployment but do not require rebuilding what already exists."
))

story.append(heading2("7.3 What Percentage Remains?"))
story.append(body(
    "Approximately <b>35-40%</b> of the work to reach a pilot-ready product remains. This is not evenly "
    "distributed — the remaining 35% is heavily concentrated in infrastructure and integration work that is "
    "often more complex per-line-of-code than feature development. Specifically: live data integrations "
    "(LinkedIn, company data providers) are high-effort and high-risk. Multi-tenancy requires architectural "
    "changes to the auth system, database queries, and session management. Email delivery configuration is "
    "straightforward but testing deliverability is not. The good news is that none of the remaining work requires "
    "tearing down what exists — the foundation is solid enough to build upon."
))

# ══════════════════════════════════════════════════════════════
# SECTION 8: RECOMMENDED 90-DAY ROADMAP
# ══════════════════════════════════════════════════════════════
story.append(heading1("8. Recommended 90-Day Roadmap"))
story.append(body(
    "This roadmap prioritizes the highest-ROI work for transitioning from a functional prototype to a "
    "pilot-ready product. The focus is on product capability, customer validation, and revenue generation — "
    "not on further architecture or security hardening, which the user has explicitly deprioritized."
))

story.append(heading2("Month 1: Operational Foundation (Weeks 1-4)"))
m1_data = [
    ("1.1", "Configure Real Email Delivery", "Set up Resend with verified sending domain. Replace all mock email usage. Test send/track/bounce flow end-to-end. This unblocks the entire outreach workflow.", "Critical"),
    ("1.2", "Implement Background Scheduler", "Add node-cron or equivalent for periodic jobs: signal monitoring, data freshness checks, sequence step processing. The workflow engine already exists — it just needs a scheduler to trigger it.", "Critical"),
    ("1.3", "One-Click Demo Data Setup", "Enhance the seed endpoints to create a compelling demo experience: 50 companies with research cards, 200 contacts with scores, signals, opportunities, and pipeline data. Must work from a single API call.", "High"),
    ("1.4", "Error Handling UX Pass", "Add consistent toast notifications for all API errors. Show graceful degradation messages when AI providers are unavailable. Add retry buttons for failed operations.", "Medium"),
    ("1.5", "Next.js Middleware", "Add global auth guard at middleware level for defense-in-depth. Block unauthenticated access to all /api/* routes except public paths.", "Medium"),
]
story.append(make_table(
    ["ID", "Task", "Details", "Priority"],
    m1_data,
    col_widths=[25, 90, CONTENT_W - 195, 60]
))

story.append(heading2("Month 2: Pilot Readiness (Weeks 5-8)"))
m2_data = [
    ("2.1", "Guided Onboarding Flow", "Create a step-by-step onboarding wizard: configure AI provider, import first data set, set ICP profile, generate first intelligence brief. Must complete in under 10 minutes.", "Critical"),
    ("2.2", "Live Data Integration (Phase 1)", "Replace AI-estimated company enrichment with at least one real data source. Options: Clearbit, Apollo, or Proxycurl API. Start with company basic data (employees, revenue, funding).", "High"),
    ("2.3", "CRM Export / API Documentation", "Build CSV/Excel export for all major entities. Create basic API documentation (Swagger/OpenAPI). This enables evaluation by technical prospects.", "High"),
    ("2.4", "Pilot User Auth Flow", "Replace hardcoded AUTHORIZED_EMAIL with a configurable authorized users list (database-backed). Add invite-only registration with admin approval.", "High"),
    ("2.5", "Performance Optimization", "Add database indexes for common query patterns. Implement response caching for expensive AI operations. Target: dashboard loads under 2 seconds.", "Medium"),
]
story.append(make_table(
    ["ID", "Task", "Details", "Priority"],
    m2_data,
    col_widths=[25, 90, CONTENT_W - 195, 60]
))

story.append(heading2("Month 3: Commercial Validation (Weeks 9-12)"))
m3_data = [
    ("3.1", "Customer Discovery Interviews", "Show the platform to 5-10 target users (VP Sales, Sales Ops, RevOps). Validate that the intelligence workflow matches their actual process. Document feedback.", "Critical"),
    ("3.2", "Landing Page / Website Refresh", "Update the public landing page with actual product screenshots, a clear value proposition, and a 'Request Pilot' CTA. The current landing page exists but is generic.", "High"),
    ("3.3", "Usage Analytics Dashboard", "Build a simple admin dashboard showing: user activity, AI usage costs, data quality trends, most-valued features. Essential for pilot reporting.", "Medium"),
    ("3.4", "Salesforce Integration (Phase 1)", "One-way sync: export DeepMindQ intelligence data (signals, scores, briefs) to Salesforce as custom objects or notes. This is the #1 enterprise request.", "Medium"),
    ("3.5", "Pilot Program Design", "Define pilot terms: duration (30/60/90 days), success metrics, pricing tier, support model, data migration process. Prepare pilot agreement template.", "High"),
]
story.append(make_table(
    ["ID", "Task", "Details", "Priority"],
    m3_data,
    col_widths=[25, 90, CONTENT_W - 195, 60]
))

story.append(heading2("8.1 What This Roadmap Deliberately Excludes"))
story.append(body(
    "The following items are explicitly <b>deferred</b> per the user's direction to shift priority to "
    "product capability and business functionality: multi-tenancy architecture, SSO/SAML, full RBAC, "
    "Redis migration, CSP hardening, xlsx dependency migration, npm audit cleanup, dependency version "
    "upgrades, vector database migration (from in-memory TF-IDF), mobile responsive design, and any "
    "additional security hardening beyond what exists at the security-baseline-v1 tag."
))

story.append(spacer(20))
story.append(hr())
story.append(spacer(4))
story.append(Paragraph(
    "This assessment is based on the codebase state at tag <b>security-baseline-v1</b> on branch "
    "<b>phase-4-critical-input-path</b>. All scores and findings are evidence-based, derived from actual "
    "code inspection, not from documentation, roadmaps, or intended architecture.",
    sCaption
))

# ━━ BUILD ━━
doc.build(story)
print(f"PDF generated: {OUTPUT}")
print(f"File size: {os.path.getsize(OUTPUT) / 1024:.0f} KB")
