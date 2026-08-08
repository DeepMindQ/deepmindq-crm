#!/usr/bin/env python3
"""
DeepMindQ Fortune 500 Enterprise Readiness Audit Report
Comprehensive enterprise-grade audit from multiple executive perspectives.
"""
import os, sys
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm, cm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.colors import HexColor
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY, TA_RIGHT
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak,
    KeepTogether, HRFlowable, Flowable
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase.pdfmetrics import registerFontFamily
from reportlab.lib import colors
import datetime

FONT_DIR = '/usr/share/fonts'
pdfmetrics.registerFont(TTFont('NotoSerifSC', f'{FONT_DIR}/truetype/noto-serif-sc/NotoSerifSC-Regular.ttf'))
pdfmetrics.registerFont(TTFont('NotoSerifSC-Bold', f'{FONT_DIR}/truetype/noto-serif-sc/NotoSerifSC-Bold.ttf'))
registerFontFamily('NotoSerifSC', normal='NotoSerifSC', bold='NotoSerifSC-Bold')
pdfmetrics.registerFont(TTFont('NotoSansSC', f'{FONT_DIR}/truetype/chinese/SarasaMonoSC-Regular.ttf'))
pdfmetrics.registerFont(TTFont('NotoSansSC-Bold', f'{FONT_DIR}/truetype/chinese/SarasaMonoSC-Bold.ttf'))
registerFontFamily('NotoSansSC', normal='NotoSansSC', bold='NotoSansSC-Bold')
pdfmetrics.registerFont(TTFont('DejaVuSans', f'{FONT_DIR}/truetype/dejavu/DejaVuSans.ttf'))
pdfmetrics.registerFont(TTFont('DejaVuSans-Bold', f'{FONT_DIR}/truetype/dejavu/DejaVuSans-Bold.ttf'))
registerFontFamily('DejaVuSans', normal='DejaVuSans', bold='DejaVuSans-Bold')

# Palette
PAGE_BG       = HexColor('#f5f4f4')
CARD_BG       = HexColor('#eae9e5')
TABLE_STRIPE  = HexColor('#edece9')
HEADER_FILL   = HexColor('#5f573f')
COVER_BLOCK   = HexColor('#7f7863')
BORDER        = HexColor('#c3bca8')
ACCENT        = HexColor('#97781a')
ACCENT_2      = HexColor('#448ea6')
TEXT_PRIMARY   = HexColor('#272624')
TEXT_MUTED     = HexColor('#8c8a83')
SEM_SUCCESS   = HexColor('#408356')
SEM_WARNING   = HexColor('#9f8654')
SEM_ERROR     = HexColor('#a84f47')
SEM_INFO      = HexColor('#4d6883')
WHITE          = colors.white

OUTPUT_PATH = '/home/z/my-project/download/DeepMindQ-Fortune500-Enterprise-Readiness-Audit.pdf'

styles = getSampleStyleSheet()
s_body = ParagraphStyle('Body', parent=styles['Normal'], fontName='NotoSansSC', fontSize=9,
    leading=13, textColor=TEXT_PRIMARY, alignment=TA_JUSTIFY, spaceAfter=5, spaceBefore=1)
s_body_sm = ParagraphStyle('BodySm', parent=s_body, fontSize=8, leading=11, spaceAfter=3)
s_h1 = ParagraphStyle('H1', fontName='NotoSansSC-Bold', fontSize=18, leading=24,
    textColor=TEXT_PRIMARY, spaceBefore=14, spaceAfter=8, keepWithNext=True)
s_h2 = ParagraphStyle('H2', fontName='NotoSansSC-Bold', fontSize=13, leading=17,
    textColor=HEADER_FILL, spaceBefore=10, spaceAfter=6, keepWithNext=True)
s_h3 = ParagraphStyle('H3', fontName='NotoSansSC-Bold', fontSize=10.5, leading=14,
    textColor=ACCENT, spaceBefore=8, spaceAfter=4, keepWithNext=True)
s_cap = ParagraphStyle('Cap', fontName='NotoSansSC', fontSize=8, leading=10, textColor=TEXT_MUTED, alignment=TA_CENTER)
s_footer = ParagraphStyle('Footer', fontName='NotoSansSC', fontSize=7, leading=9, textColor=TEXT_MUTED, alignment=TA_CENTER)
s_kick = ParagraphStyle('Kick', fontName='NotoSansSC-Bold', fontSize=8.5, leading=11, textColor=ACCENT, spaceBefore=2, spaceAfter=2)
s_verdict = ParagraphStyle('Verdict', fontName='NotoSansSC-Bold', fontSize=10, leading=14,
    textColor=SEM_SUCCESS, spaceBefore=6, spaceAfter=6)
s_verdict_warn = ParagraphStyle('VerdictW', parent=s_verdict, textColor=SEM_WARNING)
s_verdict_err = ParagraphStyle('VerdictE', parent=s_verdict, textColor=SEM_ERROR)
s_score_big = ParagraphStyle('ScoreBig', fontName='NotoSansSC-Bold', fontSize=22, leading=28,
    textColor=SEM_ERROR, alignment=TA_CENTER, spaceBefore=4, spaceAfter=4)
s_label = ParagraphStyle('Label', fontName='NotoSansSC', fontSize=8.5, leading=11, textColor=TEXT_MUTED)
s_cover_title = ParagraphStyle('CT', fontName='NotoSansSC-Bold', fontSize=26, leading=32,
    textColor=TEXT_PRIMARY, alignment=TA_LEFT, spaceAfter=8)
s_cover_sub = ParagraphStyle('CS', fontName='NotoSansSC', fontSize=12, leading=17, textColor=TEXT_MUTED, alignment=TA_LEFT)
s_toc = ParagraphStyle('TOC', fontName='NotoSansSC', fontSize=9.5, leading=16, textColor=TEXT_PRIMARY, leftIndent=16)

def h1(t): return Paragraph(t, s_h1)
def h2(t): return Paragraph(t, s_h2)
def h3(t): return Paragraph(t, s_h3)
def body(t): return Paragraph(t, s_body)
def body_sm(t): return Paragraph(t, s_body_sm)
def kick(t): return Paragraph(t, s_kick)
def cap(t): return Paragraph(t, s_cap)
def sp(h=4): return Spacer(1, h)
def hr(): return HRFlowable(width="100%", thickness=0.5, color=BORDER, spaceAfter=6, spaceBefore=3)

avail_w = A4[0] - 45*mm

def styled_table(data, col_widths=None, header_color=HEADER_FILL):
    if not col_widths:
        n = len(data[0])
        col_widths = [avail_w / n] * n
    tdata = []
    for i, row in enumerate(data):
        cells = []
        for c in row:
            style = ParagraphStyle('TH' if i == 0 else 'TD',
                fontName='NotoSansSC-Bold' if i == 0 else 'NotoSansSC',
                fontSize=7.5 if i == 0 else 7.5, leading=10, textColor=WHITE if i == 0 else TEXT_PRIMARY)
            cells.append(Paragraph(str(c), style))
        tdata.append(cells)
    t = Table(tdata, colWidths=col_widths, repeatRows=1)
    cmds = [
        ('BACKGROUND', (0,0), (-1,0), header_color),
        ('TEXTCOLOR', (0,0), (-1,0), WHITE),
        ('GRID', (0,0), (-1,-1), 0.25, BORDER),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 3),
        ('TOPPADDING', (0,0), (-1,-1), 3),
        ('LEFTPADDING', (0,0), (-1,-1), 4),
        ('RIGHTPADDING', (0,0), (-1,-1), 4),
    ]
    for i in range(1, len(tdata)):
        if i % 2 == 0:
            cmds.append(('BACKGROUND', (0,i), (-1,i), TABLE_STRIPE))
    t.setStyle(TableStyle(cmds))
    return t


class CoverPage(Flowable):
    def __init__(self, width, height):
        Flowable.__init__(self)
        self.width = width
        self.height = height
    def wrap(self, aW, aH):
        return min(aW, self.width), min(aH, self.height)
    def draw(self):
        c = self.canv; w, h = self.width, self.height
        c.setFillColor(PAGE_BG); c.rect(0, 0, w, h, fill=1, stroke=0)
        c.setFillColor(HEADER_FILL); c.rect(0, h - 8*mm, w, 8*mm, fill=1, stroke=0)
        c.setFillColor(ACCENT); c.rect(0, 0, 5*mm, h, fill=1, stroke=0)
        c.setFillColor(COVER_BLOCK); c.rect(22*mm, h - 110*mm, 3*mm, 70*mm, fill=1, stroke=0)
        c.setFillColor(BORDER); c.rect(22*mm, 35*mm, w - 44*mm, 0.5*mm, fill=1, stroke=0)


def build(story):
    # ─── COVER ───
    story.append(CoverPage(avail_w, A4[1] - 30*mm))
    story.append(sp(22*mm))
    story.append(Paragraph("FORTUNE 500", ParagraphStyle('ck', fontName='NotoSansSC-Bold', fontSize=10, leading=13, textColor=ACCENT)))
    story.append(Paragraph("Enterprise Readiness Audit", s_cover_title))
    story.append(sp(4*mm))
    story.append(Paragraph("DeepMindQ Platform", ParagraphStyle('cs2', fontName='NotoSansSC-Bold', fontSize=16, leading=22, textColor=TEXT_PRIMARY)))
    story.append(sp(3*mm))
    story.append(Paragraph(
        "Brutally honest assessment by a virtual team of Enterprise CTO, Chief Product Officer, CISO, "
        "Solution Architect, AI Governance Auditor, VP Revenue Operations, and Fortune 500 Procurement Reviewer. "
        "This audit evaluates whether the platform could be deployed at Microsoft, Siemens, JPMorgan, or Shell tomorrow.",
        ParagraphStyle('csd', fontName='NotoSansSC', fontSize=9, leading=13, textColor=TEXT_MUTED, spaceAfter=10, leftIndent=22*mm)))
    story.append(sp(8*mm))
    meta = [
        ["Audit Date", datetime.date.today().strftime("%B %d, %Y")],
        ["Audit Type", "Fortune 500 Enterprise Procurement Due Diligence"],
        ["Codebase Size", "263,363 lines | 314 API routes | 83 screens | 291 lib files"],
        ["Method", "Static analysis + live compilation + test execution + architectural review"],
        ["Perspectives", "CTO, CPO, CISO, Solution Architect, AI Auditor, VP RevOps, Procurement"],
    ]
    mt = Table([[Paragraph(r[0], ParagraphStyle('ml', fontName='NotoSansSC-Bold', fontSize=8, leading=11, textColor=TEXT_MUTED)),
                Paragraph(r[1], ParagraphStyle('mv', fontName='NotoSansSC', fontSize=8, leading=11, textColor=TEXT_PRIMARY))] for r in meta],
              colWidths=[avail_w*0.22, avail_w*0.78])
    mt.setStyle(TableStyle([('VALIGN', (0,0), (-1,-1), 'TOP'), ('LEFTPADDING', (0,0), (-1,-1), 3),
        ('BOTTOMPADDING', (0,0), (-1,-1), 3), ('LINEBELOW', (0,0), (-1,-2), 0.3, BORDER)]))
    story.append(mt)
    story.append(PageBreak())

    # ─── TABLE OF CONTENTS ───
    story.append(h1("Table of Contents"))
    story.append(hr())
    for s in [
        "1. Executive Summary and Final Verdict",
        "2. Enterprise Readiness Scorecard",
        "3. Product and Business Readiness",
        "4. Enterprise Architecture Audit",
        "5. Scalability and Performance",
        "6. Security and CISO Audit",
        "7. Multi-Tenant Enterprise Readiness",
        "8. AI System and Governance Audit",
        "9. Data Intelligence Platform Audit",
        "10. UX and Product Experience Audit",
        "11. User Workflow Audit",
        "12. Integration and API Readiness",
        "13. DevOps and Operations Readiness",
        "14. Support and Commercial Readiness",
        "15. Critical Gap Analysis (P0 / P1 / P2)",
        "16. 30/60/90 Day Enterprise Hardening Roadmap",
    ]:
        story.append(Paragraph(s, s_toc))
    story.append(PageBreak())

    # ─── 1. EXECUTIVE SUMMARY ───
    story.append(h1("1. Executive Summary and Final Verdict"))
    story.append(hr())

    story.append(Paragraph("OVERALL VERDICT", ParagraphStyle('bv', fontName='NotoSansSC-Bold', fontSize=14, leading=18,
        textColor=SEM_WARNING, spaceBefore=6, spaceAfter=4, alignment=TA_CENTER)))
    story.append(Paragraph("Beta -- Technically Impressive, Enterprise-Deployment Premature",
        ParagraphStyle('bvd', fontName='NotoSansSC-Bold', fontSize=11, leading=15, textColor=SEM_WARNING, alignment=TA_CENTER, spaceAfter=10)))

    story.append(body(
        "DeepMindQ is an architecturally ambitious Enterprise AI Intelligence Platform that aspires to create a new product "
        "category: an Intelligence Operating System that sits above CRMs and transforms raw data into actionable revenue "
        "intelligence. The codebase demonstrates genuine engineering sophistication across 263,363 lines, 314 API routes, "
        "83 screen components, and 14 AI engines. The AI capabilities are real -- the platform uses evidence-grounded "
        "reasoning, hallucination prevention, governance gates, and a continuous learning feedback loop. This is not a thin "
        "wrapper around ChatGPT."
    ))
    story.append(body(
        "However, when evaluated through the lens of a Fortune 500 procurement team, critical gaps emerge. The platform is "
        "fundamentally single-instance with 40+ in-memory state stores that will break in multi-instance deployment. There "
        "is no multi-tenant data isolation -- zero tenant models exist in the schema. The SSO implementation is a stub "
        "without actual SAML/OIDC protocol handling. SCIM provisioning is absent. SOC 2/ISO 27001 certification has not "
        "been initiated. The billing system does not exist. Internationalization is absent. Monitoring metrics are in-memory "
        "and lost on every restart. The backup script contains a bug. The admin settings panel displays placeholder data. "
        "These are not cosmetic issues -- they are blockers for enterprise deployment."
    ))
    story.append(body(
        "The product vision is strong and the AI differentiation is genuine. But a Fortune 500 CTO would not sign off on "
        "deployment knowing that security headers are defined but never applied, that 45 API routes lack authentication, "
        "that rate limiting is disabled in memory on every restart, and that there is no way to provision users from their "
        "enterprise identity provider. The platform needs 6-12 months and $2-5M of enterprise hardening before it can pass "
        "enterprise procurement due diligence."
    ))
    story.append(sp(6))

    score_summary = [
        ["Area", "Score /100", "Status"],
        ["Product Vision and Positioning", "78", "Strong vision, unclear category"],
        ["Architecture", "62", "Single-instance, 40+ in-memory stores"],
        ["Scalability", "35", "Breaks beyond single instance"],
        ["Security", "45", "Good foundations, critical gaps"],
        ["AI Governance", "72", "Real governance, no bias detection"],
        ["Data Intelligence", "68", "Strong pipeline, no multi-tenant"],
        ["UX / Product Experience", "55", "Functional, monoliths, no i18n"],
        ["Integrations", "58", "Good CRM adapters, stub connectors"],
        ["DevOps / Operations", "40", "CI good, monitoring dead code"],
        ["Enterprise Readiness (Overall)", "47", "Not deployable at Fortune 500"],
    ]
    story.append(styled_table(score_summary, col_widths=[avail_w*0.40, avail_w*0.15, avail_w*0.45]))
    story.append(PageBreak())

    # ─── 2. SCORECARD ───
    story.append(h1("2. Enterprise Readiness Scorecard"))
    story.append(hr())
    story.append(kick("Evaluated by: Virtual CTO + CPO + CISO + Solution Architect + AI Auditor + VP RevOps + Procurement"))

    card_data = [
        ["Dimension", "Score", "CTO View", "CPO View", "CISO View", "Procurement"],
        ["Product and Business", "78/100", "Strong architecture", "Clear 5Q framework", "N/A", "Needs ROI proof"],
        ["Enterprise Architecture", "62/100", "Monolith, single-inst", "Good engine design", "No middleware", "No K8s"],
        ["Scalability", "35/100", "Breaks at scale", "Works for demo", "N/A", "Won't handle 10K users"],
        ["Security", "45/100", "ignoreBuildErrors!", "Good UX patterns", "45 unauth routes", "No SOC 2"],
        ["AI Governance", "72/100", "Real algorithms", "Explainable AI", "No bias detection", "Unique differentiator"],
        ["Data Intelligence", "68/100", "Full table scans", "Real scoring", "Global learning", "Single-tenant only"],
        ["UX and Experience", "55/100", "1318-line monolith", "Good empty states", "Partial a11y", "No i18n"],
        ["Integrations", "58/100", "Good CRM adapters", "Stub connectors", "HMAC webhooks", "No SCIM"],
        ["Operations", "40/100", "In-memory monitoring", "Good CI/CD", "No distributed trace", "No SLA doc"],
        ["Commercial Readiness", "28/100", "No billing system", "No pricing page", "No DPA", "No contract infra"],
    ]
    story.append(styled_table(card_data, col_widths=[avail_w*0.16, avail_w*0.10, avail_w*0.18, avail_w*0.19, avail_w*0.19, avail_w*0.18]))
    story.append(sp(4))

    # Verdict table
    verdict_data = [
        ["Verdict Level", "Label", "Description"],
        ["Prototype", "FAIL", "Minimum viable demo -- not relevant here"],
        ["Beta", "CURRENT", "Architecturally ambitious, not enterprise-deployable"],
        ["Production Ready (SMB)", "NOT YET", "Needs multi-tenant, monitoring, billing, SSO"],
        ["Enterprise Ready", "NOT YET", "Needs SOC 2, SCIM, K8s, SLA, DPA"],
        ["Fortune 500 Ready", "NOT YET", "Needs 6-12 months hardening at $2-5M investment"],
    ]
    story.append(styled_table(verdict_data, col_widths=[avail_w*0.25, avail_w*0.15, avail_w*0.60], header_color=SEM_ERROR))
    story.append(PageBreak())

    # ─── 3. PRODUCT & BUSINESS ───
    story.append(h1("3. Product and Business Readiness"))
    story.append(hr())

    story.append(h2("3.1 Product Category and Positioning"))
    story.append(body(
        "DeepMindQ positions itself as an Enterprise Intelligence Operating System -- a category it is actively trying "
        "to create. The stated positioning is: 'The CRM stores information. DeepMindQ creates intelligence.' The product "
        "is built around a 5-Question Framework: What Changed? (signal detection), Why Does It Matter? (30-step enterprise "
        "reasoning), Who Should We Engage? (buying committee intelligence), What Should We Say? (conversation prep), and "
        "What Should We Do? (next best actions). This positioning is crystal clear and consistently communicated across "
        "all product documentation, marketing materials, and the codebase architecture."
    ))
    story.append(body(
        "The platform competes at the intersection of three established categories: Sales Intelligence (ZoomInfo, Apollo.io), "
        "Revenue Intelligence (Clari, Gong, 6sense), and AI Sales Copilot (Outreach, Salesloft, Einstein). The core "
        "differentiation claim is evidence-backed AI reasoning rather than simple data enrichment or conversation recording. "
        "This is a credible differentiation -- the 30-step reasoning engine, evidence grounding system, and hallucination "
        "prevention layer are genuine implementations, not marketing fluff. However, the 'Intelligence OS' category does "
        "not exist in buyer minds, creating a significant sales education burden that will lengthen enterprise sales cycles."
    ))

    story.append(h2("3.2 Enterprise Value Assessment"))
    story.append(body(
        "From a Fortune 500 value perspective, the platform addresses real enterprise problems: signal overload for sales "
        "teams managing 500+ accounts, intelligence that is not actionable, AI hallucination risks that erode trust, "
        "disconnected data silos between CRM and intelligence sources, and compliance requirements for AI audit trails. "
        "The estimated ROI for a $500M revenue organization with 200 sellers is $10M-$30M in incremental revenue through "
        "improved win rates (+5-15%), reduced sales cycles (10-20%), and increased pipeline coverage (+20-30%). The payback "
        "period at an estimated $400K ACV is 6-12 months."
    ))

    story.append(h2("3.3 Business Model Gaps"))
    story.append(body(
        "The business model is architecturally aligned with enterprise sales but commercially immature. There is zero "
        "billing, subscription, or payment processing code. The product relies on AUTHORIZED_EMAIL environment variable "
        "for access control -- not scalable for enterprise procurement. No pricing page, no trial mechanism, no product-led "
        "growth funnel, no marketplace, and no partnership revenue infrastructure exist. The PRODUCT_CONTEXT.md explicitly "
        "states 'Subscription billing: NOT a requirement,' indicating enterprise licensing is the intended model, but "
        "there is no contract infrastructure, no DPA template, and no SLA documentation to support enterprise deals."
    ))

    prod_gaps = [
        ["Gap", "Severity", "Impact"],
        ["No billing/subscription system", "P0", "Cannot charge customers or manage contracts"],
        ["No pricing page or tier model", "P1", "No way to communicate value proposition commercially"],
        ["No trial/onboarding mechanism", "P1", "Long sales cycles without self-service evaluation"],
        ["No customer success tooling", "P1", "No adoption tracking or value realization metrics"],
        ["No DPA or SOC 2 readiness", "P0", "Blocks enterprise procurement process"],
        ["Category creation burden", "P1", "'Intelligence OS' doesn't exist in buyer minds"],
    ]
    story.append(sp(4))
    story.append(styled_table(prod_gaps, col_widths=[avail_w*0.30, avail_w*0.12, avail_w*0.58]))
    story.append(PageBreak())

    # ─── 4. ARCHITECTURE ───
    story.append(h1("4. Enterprise Architecture Audit"))
    story.append(hr())

    story.append(h2("4.1 Architecture Overview"))
    story.append(body(
        "DeepMindQ is a Next.js 16 App Router application acting as a monolithic full-stack platform with 314 API routes "
        "serving 83 screen components. The frontend uses Zustand for client-side UI state, @tanstack/react-query for "
        "data fetching, and shadcn/ui as the component library. The backend is Prisma ORM with PostgreSQL, connecting "
        "to 75+ database models. AI features use a composable engine architecture with 14 engines (ModelRouter, Grounding, "
        "Retrieval, Synthesis, Scoring, Action, Conversation, plus 7 specialized scorers). While the engine architecture "
        "is well-designed with clear separation of concerns, the deployment model is fundamentally monolithic -- all "
        "314 API routes run in a single Next.js process."
    ))

    story.append(h2("4.2 Critical Architecture Findings"))
    arch_findings = [
        ["Finding", "Severity", "Evidence", "Enterprise Impact"],
        ["No Edge middleware", "CRITICAL", "middleware.ts does not exist", "Security headers never applied to responses"],
        ["ignoreBuildErrors: true", "CRITICAL", "next.config.ts line 7", "TypeScript errors silently bypassed in CI/CD"],
        ["45 API routes unauthenticated", "CRITICAL", "engines/, integrations/, incidents/", "Business logic accessible without auth"],
        ["40+ in-memory state stores", "CRITICAL", "Rate limits, caches, OTP, AI state", "Breaks in multi-instance deployment"],
        ["No Prisma middleware for multi-tenant", "CRITICAL", "schema.prisma has no tenantId", "Single-tenant only; cannot isolate customers"],
        ["File exports to local filesystem", "HIGH", "streaming-export.ts uses db/exports/", "Fails in containerized environments"],
        ["No read replica support", "HIGH", "db.ts -- all queries to primary", "Read-heavy workloads bottleneck at scale"],
        ["No WebSocket implementation", "MEDIUM", "realtime route uses polling only", "Limited real-time capability"],
    ]
    story.append(styled_table(arch_findings, col_widths=[avail_w*0.22, avail_w*0.10, avail_w*0.30, avail_w*0.38]))
    story.append(sp(4))

    story.append(body(
        "The most damning architecture finding is the pervasiveness of in-memory state. Over 40 modules maintain state "
        "in JavaScript Maps, variables, or singletons that reset on every server restart and are not shared across "
        "instances. This includes: rate limiting stores (auth-helpers.ts), all 5 cache instances (cache-manager.ts), "
        "OTP verification cache (otp-cache.ts), enrichment job queue (enrichment-queue.ts), webhook state (webhook-manager.ts), "
        "AI cost tracking (unified-ai-cost-tracking.ts), deduplication cache (deduplicator.ts), and scoring configuration "
        "(scoring-config.ts). Deploying more than one instance will cause each instance to have independent rate limiting, "
        "inconsistent caches, lost OTP codes, duplicated enrichment jobs, and divergent AI state. This is a fundamental "
        "architectural constraint that prevents horizontal scaling."
    ))
    story.append(PageBreak())

    # ─── 5. SCALABILITY ───
    story.append(h1("5. Scalability and Performance"))
    story.append(hr())

    story.append(h2("5.1 User Scale Assessment"))
    scale_data = [
        ["Scale", "Users", "Status", "Blocker"],
        ["Small Team", "100", "Works", "Single instance sufficient"],
        ["Mid-Market", "1,000", "Works (single-inst)", "In-memory state limits reliability"],
        ["Enterprise", "10,000", "Broken", "40+ in-memory stores fail; no Redis; no read replicas"],
        ["Fortune 500", "50,000+", "Broken", "No multi-tenant; no sharding; no K8s; no CDN"],
    ]
    story.append(styled_table(scale_data, col_widths=[avail_w*0.15, avail_w*0.10, avail_w*0.15, avail_w*0.60]))
    story.append(sp(4))

    story.append(h2("5.2 Performance Bottlenecks"))
    story.append(body(
        "The deduplication engine performs full table scans -- db.contact.findMany({ select: { email: true } }) loads "
        "ALL contacts into memory. This will not scale beyond approximately 10,000 records. The enrichment orchestrator "
        "uses a global singleton queue with no distributed locking. AI cost tracking and budget enforcement use in-memory "
        "counters that reset on server restart, potentially allowing budget overruns. The cache manager provides no "
        "Redis layer -- all 5 cache instances are per-process with no sharing across instances. Database connection pooling "
        "defaults to 10 (serverless) or 20 (standard) connections with no read replica offloading."
    ))
    story.append(body(
        "Background job processing relies on an HTTP endpoint triggered by external cron, not a persistent worker pool. "
        "This means jobs only run when cron fires, not continuously. The data export system writes to a local filesystem "
        "path (db/exports/) which will not work in containerized/serverless environments and will fail if a different "
        "instance handles the download request. There is no message queue (RabbitMQ, SQS, Kafka) for async processing."
    ))
    story.append(PageBreak())

    # ─── 6. SECURITY ───
    story.append(h1("6. Security and CISO Audit"))
    story.append(hr())

    story.append(h2("6.1 Security Strengths"))
    story.append(body(
        "The security foundation demonstrates strong intent: PBKDF2 password hashing with 100,000 iterations (OWASP 2023 "
        "compliant), SHA-256 hashed session tokens stored in database (never plaintext), AES-256-GCM encryption with HKDF "
        "key derivation and per-field versioning, HMAC-SHA256 webhook signature verification with timing-safe comparison, "
        "constant-time OTP comparison, CSRF double-submit pattern, DOMPurify-based HTML sanitization, Zod-validated "
        "environment variables with production fail-fast, comprehensive audit logging with immutable entries, and RBAC "
        "with deny-by-default for unknown routes. These are not trivial implementations -- they show genuine security "
        "engineering competence."
    ))

    story.append(h2("6.2 Critical Security Findings"))
    sec_data = [
        ["Finding", "Severity", "Evidence"],
        ["No Edge middleware -- security headers dead code", "CRITICAL", "getSecurityHeaders() defined but never applied (no middleware.ts)"],
        ["45 API routes without authentication", "CRITICAL", "engines/, integrations/, incidents/, monitoring/ have no checkApiAuth()"],
        ["checkApiAuth() without request param skips RBAC", "CRITICAL", "Multiple files call await checkApiAuth() without passing request"],
        ["Marketing page XSS via dangerouslySetInnerHTML", "HIGH", "marketing/page.tsx:130 -- unsanitized file content injected"],
        ["Encryption silently degrades without master key", "HIGH", "encryption.ts:77 -- returns null without error if key missing"],
        ["Error page leaks stack traces to users", "HIGH", "error.tsx:26 -- Copy button exposes internal architecture"],
        ["SSO is a stub (no SAML/OIDC protocol)", "HIGH", "sso-integration.ts:254 -- SAMLRequest hardcoded placeholder"],
        ["RATE_LIMIT_DISABLED=true env var", "MEDIUM", "distributed-rate-limit.ts:282 -- can globally disable rate limiting"],
        ["ioredis is devDependency", "MEDIUM", "package.json:146 -- distributed rate limiting fails in production"],
        ["30-day sessions with no idle timeout", "MEDIUM", "session.ts:29 -- long-lived sessions increase hijack risk"],
    ]
    story.append(styled_table(sec_data, col_widths=[avail_w*0.35, avail_w*0.10, avail_w*0.55]))
    story.append(sp(4))

    story.append(h2("6.3 Compliance Readiness"))
    compliance_data = [
        ["Standard", "Status", "Gaps"],
        ["SOC 2 Type II", "NOT STARTED", "No audit preparation, no trust service criteria mapping"],
        ["ISO 27001", "NOT STARTED", "No ISMS, no risk assessment, no Statement of Applicability"],
        ["GDPR", "PARTIAL", "All 6 rights implemented; incomplete erasure cascades"],
        ["CCPA", "PARTIAL", "Consent tracking exists; no automated data deletion"],
        ["OWASP Top 10", "PARTIAL", "CSRF, XSS (partial), injection (Prisma-safe), no CSP enforcement"],
        ["HIPAA", "NOT APPLICABLE", "No health data handling"],
        ["EU AI Act", "NOT COMPLIANT", "No bias detection, no risk classification, no transparency register"],
    ]
    story.append(styled_table(compliance_data, col_widths=[avail_w*0.18, avail_w*0.15, avail_w*0.67]))
    story.append(PageBreak())

    # ─── 7. MULTI-TENANT ───
    story.append(h1("7. Multi-Tenant Enterprise Readiness"))
    story.append(hr())

    story.append(Paragraph("VERDICT: NOT IMPLEMENTED -- Single-Tenant Application",
        ParagraphStyle('ve', fontName='NotoSansSC-Bold', fontSize=11, leading=15, textColor=SEM_ERROR, spaceBefore=4, spaceAfter=8, alignment=TA_CENTER)))

    story.append(body(
        "This is the single most critical gap for enterprise deployment. The Prisma schema contains 75+ models but "
        "zero Organization, Tenant, or Workspace models. No tenantId or organizationId column exists on any table. "
        "The User model has only id, email, name, role, and passwordHash -- no team or organization association. "
        "Every db.company.findMany(), db.contact.findMany(), and db.companySignal.findMany() query operates on the "
        "entire table with no row-level filtering. The RBAC system explicitly states: 'Single-user deployment: all "
        "routes currently share one tenant.' Converting this to multi-tenant would require schema changes to every "
        "model, Prisma middleware for automatic tenant filtering, tenant-aware caching, tenant-scoped AI learning loops, "
        "tenant-isolated enrichment queues, and tenant-specific source reliability scores."
    ))
    story.append(body(
        "The data isolation implications are severe. In a multi-tenant deployment without fixes, Tenant A's cached AI "
        "response could be served to Tenant B (cache keys lack tenant context). Feedback from Tenant A's users would "
        "influence AI confidence adjustments for Tenant B (learning loop is global). Deduplication cache mixes all "
        "tenant data. Source reliability scores are shared globally. The knowledge graph has optional companyId but "
        "no tenant boundary enforcement. An enterprise buyer requiring data isolation between business units or "
        "subsidiaries cannot deploy this platform in its current state."
    ))
    story.append(PageBreak())

    # ─── 8. AI GOVERNANCE ───
    story.append(h1("8. AI System and Governance Audit"))
    story.append(hr())

    story.append(body(
        "The AI governance layer is the platform's strongest differentiator and most enterprise-ready component. "
        "The governance framework (ai-governance.ts, 1611 lines) implements a mandatory centralized AI call function "
        "(governedAICall) that every AI route must use. It enforces a 6-step pre-generation check pipeline: research "
        "exists, research confidence, freshness score, staleness detection, capability match, and recent intelligence "
        "verification. 40+ generation types have tailored confidence thresholds. Hallucination prevention uses a dual-layer "
        "approach: 15 pre-generation rules injected into prompts plus post-generation claim extraction and keyword-based "
        "evidence verification. The evidence grounding engine (grounding-engine.ts, 580 lines) collects from 4 source "
        "types in parallel, computes weighted confidence, and enforces citation markers [E1], [E2] in LLM prompts."
    ))
    story.append(body(
        "However, several AI governance gaps exist that would concern enterprise buyers. First, hallucination checking "
        "is keyword-only -- semantic equivalents like 'raised $50M' and 'secured fifty million dollars' will not match. "
        "Second, hallucination detection is non-blocking -- even critical-risk hallucinated responses are still delivered "
        "to users (only logged). Third, there is zero bias detection or fairness measurement across the entire AI "
        "stack. Fourth, LLM prompt injection is not detected -- DOMPurify handles HTML/XSS but not adversarial instruction "
        "patterns in user-provided text. Fifth, AI cost tracking and budget enforcement are in-memory only, resetting "
        "on server restart. Sixth, aggregate AI calls (governedAICallAggregate) skip company-specific evidence and "
        "freshness checks entirely."
    ))

    ai_gaps = [
        ["AI Governance Aspect", "Grade", "Gap"],
        ["Confidence gating system", "A-", "Unknown generation types fall back to defaults"],
        ["Hallucination prevention", "B+", "Keyword-only detection; non-blocking"],
        ["Evidence grounding", "A-", "Multi-source, gap-aware, citation-enforced"],
        ["Cost tracking", "B-", "In-memory only; no per-tenant budgets"],
        ["Model routing / circuit breaker", "B+", "In-memory circuit state"],
        ["Explainability", "A-", "Confidence factors, scoring narratives, TRUST metadata"],
        ["Bias detection", "F", "Zero code references to bias or fairness"],
        ["Prompt injection prevention", "D", "HTML sanitization only; no LLM injection detection"],
        ["Continuous learning loop", "B", "Feedback-driven but global (not tenant-scoped)"],
    ]
    story.append(sp(4))
    story.append(styled_table(ai_gaps, col_widths=[avail_w*0.35, avail_w*0.10, avail_w*0.55]))
    story.append(PageBreak())

    # ─── 9-12 (condensed) ───
    story.append(h1("9. Data Intelligence Platform Audit"))
    story.append(hr())
    story.append(body(
        "The data intelligence pipeline is genuinely built with a full engine (analyze, process, apply corrections, commit), "
        "quality scoring across 3 dimensions (completeness, validity, richness), enrichment orchestration with provider "
        "abstraction (Clearbit, Apollo), Levenshtein-based deduplication with idempotent merge, freshness half-life "
        "decay curves, source reliability scoring via Bayesian-inspired Laplace smoothing, and a knowledge ingestion "
        "pipeline. However, deduplication performs full table scans that won't scale past 10K records. The enrichment "
        "queue is a global singleton. Learning loops are global, not tenant-scoped. Data retention is ad-hoc per-table "
        "with no unified policy engine or automated cleanup cron. Overall grade: B+ for genuine implementation, C for "
        "enterprise scalability."
    ))
    story.append(sp(4))

    story.append(h1("10. UX and Product Experience Audit"))
    story.append(hr())
    story.append(body(
        "The UX demonstrates thoughtful design: comprehensive skeleton loading system, enterprise error states, empty "
        "states, command palette (Cmd+K) for cross-screen navigation, role-based navigation filtering, and notification "
        "system. However, several enterprise readiness gaps exist. The company-detail-screen.tsx is a 1,318-line monolith "
        "combining 10+ concerns. The dashboard is a data dump without progressive disclosure or executive guidance. "
        "The admin settings panel displays PLACEHOLDER_API_KEYS and PLACEHOLDER_WEBHOOKS -- fake data, not wired to "
        "persistence. Internationalization is completely absent (zero i18n framework, all strings hardcoded English). "
        "No theme toggle exists despite design tokens. Onboarding wizard steps 2-4 have null content. Accessibility "
        "is partial: skip navigation exists but no aria-live regions, no focus trap documentation, no screen reader "
        "testing evidence. The marketing page is an iframe -- SEO is impossible and the architecture is fragile."
    ))
    story.append(sp(4))

    story.append(h1("11. User Workflow Audit"))
    story.append(hr())
    story.append(body(
        "Revenue workflow is the strongest path: Dashboard to Companies (filtered by tier) to Company Detail to "
        "Contacts to Generate Email to Send to Track Replies to Pipeline. Analyst workflow has deep capability with "
        "research agent, signal intelligence, knowledge library, and evidence chains. Executive workflow is possible "
        "but unguided -- no 'Morning Brief' or pre-computed executive summary exists. Admin workflow is broken in "
        "places: settings panel shows placeholder data and there is no role management UI for operator/viewer roles "
        "(RBAC is hardcoded to admin/user only). Workflow continuity is mixed: companies to detail to contacts is "
        "properly linked, but no breadcrumbs exist on detail screens and no recently-viewed persistence across sessions."
    ))
    story.append(sp(4))

    story.append(h1("12. Integration and API Readiness"))
    story.append(hr())
    story.append(body(
        "CRM adapters are well-architected: Salesforce (720 lines, OAuth2, SOQL, retry, rate limits) and HubSpot "
        "(689 lines, OAuth2, cursor pagination) both implement the CRMConnector interface properly. Email providers "
        "(Resend, SendGrid, Postmark, Gmail SMTP) are abstracted. HMAC-SHA256 webhook verification exists for "
        "bounce and reply handlers. The OpenAPI spec (2,114 lines) is comprehensive with 15+ tags and full "
        "schema definitions. However, Zapier and Automation connectors return mock data. No circuit breaker exists for "
        "external API calls. No per-user rate limits on CRM sync. Salesforce webhook falls back to return true when "
        "no HMAC secret is configured -- a security risk. No integration health dashboard exists."
    ))
    story.append(sp(4))

    story.append(h1("13. DevOps and Operations Readiness"))
    story.append(hr())
    story.append(body(
        "CI/CD is enterprise-grade: 15-job pipeline with blocking security gates, dependency audits, Playwright E2E, "
        "PostgreSQL service container, and coverage collection. Deployment uses blue-green Docker strategy with health "
        "checks. Terraform IaC defines VPC, RDS PostgreSQL 16, ECS Fargate, ALB, S3, CloudWatch, and auto-scaling. "
        "However, monitoring is in-memory only (10K-point cap, resets on restart) with NO integration to Prometheus, "
        "Grafana, or Datadog. No distributed tracing (no OpenTelemetry). The backup script contains a bug (runs "
        "pg_dump on restore). No Kubernetes manifests exist (only ECS). No CDN for static assets. No request "
        "correlation IDs propagated through request lifecycle. The incident response documentation (788 lines) is "
        "excellent but references tools (Grafana, PagerDuty) that are not actually wired up."
    ))
    story.append(sp(4))

    story.append(h1("14. Support and Commercial Readiness"))
    story.append(hr())
    story.append(body(
        "Documentation is extensive (20+ files in docs/) but primarily internal development artifacts. Enterprise-relevant "
        "docs exist (API Reference, Architecture, Deployment Guide, Troubleshooting, Onboarding) but customer-facing "
        "items are missing: no SLA document, no Data Processing Agreement (DPA), no SOC 2 evidence, no penetration "
        "test results, no customer Getting Started Guide. AI cost tracking exists but no billing system. No usage "
        "metering beyond AI calls. No feature tiers or subscription management. No white-labeling capability. "
        "No SCIM provisioning. The SSO orchestration layer exists but the actual SAML/OIDC protocol library is not "
        "integrated. Commercial readiness is approximately 28/100."
    ))
    story.append(PageBreak())

    # ─── 15. CRITICAL GAPS ───
    story.append(h1("15. Critical Gap Analysis"))
    story.append(hr())

    story.append(h2("15.1 P0: Must Fix Before Enterprise Deployment"))

    p0_data = [
        ["#", "Gap", "Area", "Effort", "Why P0"],
        ["1", "Zero multi-tenant isolation (no tenantId on any model)", "Architecture", "8-12 weeks", "Blocks any multi-customer deployment"],
        ["2", "No Edge middleware -- security headers never applied", "Security", "1 week", "All security headers are dead code"],
        ["3", "45 unauthenticated API routes (engines, integrations, incidents)", "Security", "2 weeks", "Business logic accessible without auth"],
        ["4", "ignoreBuildErrors: true bypasses TypeScript checks", "Architecture", "1 day + ongoing", "Type safety completely disabled in CI"],
        ["5", "40+ in-memory state stores break multi-instance deployment", "Scalability", "6-8 weeks", "Cannot horizontally scale beyond 1 instance"],
        ["6", "SSO is a stub (no SAML/OIDC protocol library)", "Security", "3-4 weeks", "Fortune 500 requires SSO for all apps"],
        ["7", "No SCIM user provisioning", "Security", "4-6 weeks", "Hard requirement for enterprise IdP integration"],
        ["8", "No SOC 2 / ISO 27001 certification started", "Compliance", "3-6 months", "Blocks enterprise procurement"],
        ["9", "No billing or contract infrastructure", "Commercial", "6-8 weeks", "Cannot charge customers or manage contracts"],
        ["10", "Monitoring is in-memory only (resets on restart)", "Operations", "2-3 weeks", "No production visibility; metrics are dead code"],
    ]
    story.append(styled_table(p0_data, col_widths=[avail_w*0.04, avail_w*0.40, avail_w*0.13, avail_w*0.10, avail_w*0.33], header_color=SEM_ERROR))
    story.append(sp(6))

    story.append(h2("15.2 P1: Should Fix Before Large Customers"))
    p1_data = [
        ["#", "Gap", "Area", "Effort"],
        ["1", "No bias detection or fairness measures in AI stack", "AI Governance", "4-6 weeks"],
        ["2", "No LLM prompt injection detection", "AI Security", "2-3 weeks"],
        ["3", "No distributed tracing (OpenTelemetry)", "Operations", "2-3 weeks"],
        ["4", "No Kubernetes manifests (ECS only)", "Deployment", "2-3 weeks"],
        ["5", "No internationalization (i18n)", "UX", "4-6 weeks"],
        ["6", "File exports to local filesystem (not S3)", "Architecture", "1 week"],
        ["7", "Deduplication does full table scans", "Performance", "2-3 weeks"],
        ["8", "AI hallucination check is non-blocking", "AI Safety", "1 week"],
        ["9", "Incomplete GDPR erasure (no cascade deletes)", "Compliance", "2-3 weeks"],
        ["10", "Admin settings shows placeholder/mock data", "UX", "1-2 weeks"],
        ["11", "No read replica support for database", "Scalability", "1 week"],
        ["12", "Company detail is 1,318-line monolith", "Maintainability", "2-3 weeks"],
    ]
    story.append(styled_table(p1_data, col_widths=[avail_w*0.04, avail_w*0.48, avail_w*0.18, avail_w*0.10], header_color=SEM_WARNING))
    story.append(sp(6))

    story.append(h2("15.3 P2: Future Improvements"))
    p2_data = [
        ["#", "Gap", "Area"],
        ["1", "No multi-region deployment or failover", "Infrastructure"],
        ["2", "No mobile-responsive experience", "UX"],
        ["3", "No marketplace or plugin architecture", "Business"],
        ["4", "Global AI learning loop (not tenant-scoped)", "AI Architecture"],
        ["5", "No CDN for static assets", "Performance"],
        ["6", "No message queue (RabbitMQ, SQS, Kafka)", "Architecture"],
        ["7", "No SLA documentation or automated breach alerting", "Operations"],
        ["8", "Encryption master key from env var (no KMS)", "Security"],
    ]
    story.append(styled_table(p2_data, col_widths=[avail_w*0.04, avail_w*0.62, avail_w*0.24], header_color=SEM_INFO))
    story.append(PageBreak())

    # ─── 16. ROADMAP ───
    story.append(h1("16. 30/60/90 Day Enterprise Hardening Roadmap"))
    story.append(hr())

    story.append(h2("Days 1-30: Foundation (Security and Infrastructure)"))
    roadmap_30 = [
        ["Priority", "Item", "Owner", "Effort"],
        ["P0", "Create middleware.ts -- apply all security headers, CSRF at edge", "Engineering", "1 week"],
        ["P0", "Remove ignoreBuildErrors: true -- fix or suppress individual errors", "Engineering", "1 day"],
        ["P0", "Audit and fix 45 unauthenticated API routes", "Security", "2 weeks"],
        ["P0", "Make encryption mandatory in production (fail startup without key)", "Security", "1 day"],
        ["P0", "Fix backup script bug (pg_dump on restore)", "DevOps", "1 hour"],
        ["P0", "Wire monitoring to external system (Prometheus/Grafana)", "DevOps", "1 week"],
        ["P1", "Move file exports to S3/cloud storage", "Engineering", "1 week"],
        ["P1", "Add OpenTelemetry distributed tracing", "Engineering", "2 weeks"],
    ]
    story.append(styled_table(roadmap_30, col_widths=[avail_w*0.08, avail_w*0.55, avail_w*0.17, avail_w*0.12]))
    story.append(sp(6))

    story.append(h2("Days 31-60: Enterprise Features (Identity and Multi-Tenancy)"))
    roadmap_60 = [
        ["Priority", "Item", "Owner", "Effort"],
        ["P0", "Begin SOC 2 Type II audit preparation", "Security+Legal", "4 weeks ongoing"],
        ["P0", "Integrate SAML/OIDC protocol library (Boxyhq Jackson)", "Engineering", "3 weeks"],
        ["P0", "Implement SCIM 2.0 user provisioning", "Engineering", "4 weeks"],
        ["P0", "Replace in-memory stores with Redis (rate limits, cache, OTP)", "Engineering", "3 weeks"],
        ["P0", "Build billing/contract infrastructure", "Engineering+Product", "4 weeks"],
        ["P1", "Add multi-tenant schema (tenantId to all models)", "Engineering", "4 weeks"],
        ["P1", "Implement bias detection in AI pipeline", "AI/ML", "3 weeks"],
        ["P1", "Add LLM prompt injection detection", "Security", "2 weeks"],
        ["P1", "Create Kubernetes Helm charts", "DevOps", "2 weeks"],
    ]
    story.append(styled_table(roadmap_60, col_widths=[avail_w*0.08, avail_w*0.55, avail_w*0.17, avail_w*0.12]))
    story.append(sp(6))

    story.append(h2("Days 61-90: Enterprise Hardening (Scale and Commercial)"))
    roadmap_90 = [
        ["Priority", "Item", "Owner", "Effort"],
        ["P0", "Complete SOC 2 Type II evidence collection", "Security+Legal", "4 weeks ongoing"],
        ["P0", "Add database read replicas", "DevOps", "1 week"],
        ["P0", "Implement tenant-scoped AI learning and enrichment", "Engineering", "3 weeks"],
        ["P1", "Add internationalization (i18n)", "UX+Engineering", "4 weeks"],
        ["P1", "Create SLA documentation and automated breach alerting", "Product+DevOps", "2 weeks"],
        ["P1", "Build customer success dashboard and onboarding", "Product+Engineering", "3 weeks"],
        ["P1", "Refactor company detail monolith into composable panels", "Engineering", "2 weeks"],
        ["P2", "Create DPA template and enterprise contract framework", "Legal", "2 weeks"],
        ["P2", "Plan multi-region deployment strategy", "Architecture", "1 week"],
    ]
    story.append(styled_table(roadmap_90, col_widths=[avail_w*0.08, avail_w*0.55, avail_w*0.17, avail_w*0.12]))
    story.append(sp(8))

    # Final statement
    story.append(hr())
    story.append(Paragraph(
        "This audit was conducted via automated code scanning, live TypeScript compilation, test execution, "
        "and deep architectural analysis across 263,363 lines of source code. All findings are evidence-based "
        "with specific file paths and line numbers. The assessment applies the standards that Microsoft, Siemens, "
        "JPMorgan, Shell, and equivalent Fortune 500 organizations apply during technical due diligence.",
        s_cap))
    story.append(sp(4))
    story.append(Paragraph(f"Audit Date: {datetime.date.today().strftime('%B %d, %Y')} | "
        "Confidential -- For Internal Use Only", s_cap))


def main():
    doc = SimpleDocTemplate(OUTPUT_PATH, pagesize=A4,
        leftMargin=22*mm, rightMargin=23*mm, topMargin=15*mm, bottomMargin=15*mm,
        title="DeepMindQ Fortune 500 Enterprise Readiness Audit",
        author="Enterprise Audit Team", subject="Comprehensive Enterprise Procurement Due Diligence")
    story = []
    build(story)
    doc.build(story)
    fsize = os.path.getsize(OUTPUT_PATH)
    print(f"PDF generated: {OUTPUT_PATH}")
    print(f"File size: {fsize:,} bytes ({fsize/1024:.1f} KB)")

if __name__ == '__main__':
    main()
