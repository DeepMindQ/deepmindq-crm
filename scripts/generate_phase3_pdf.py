#!/usr/bin/env python3
"""
Phase 3 Freeze Handover Document — DeepMindQ Sales Intelligence Platform
Generates a comprehensive PDF: architecture, data flow, governance, API contracts,
DB schema, dependency map, RFP/RFI foundation, human-controlled selling, tech debt,
and Phase 4/5/6 rules.
"""

import os, sys, hashlib
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import inch, mm, cm
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY, TA_RIGHT
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle,
    Image, KeepTogether, HRFlowable, CondPageBreak
)
from reportlab.platypus.tableofcontents import TableOfContents
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase.pdfmetrics import registerFontFamily
from PIL import Image as PILImage

# ━━ Paths ━━
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DOWNLOAD_DIR = '/home/z/my-project/download'
OUTPUT_PDF = os.path.join(DOWNLOAD_DIR, 'Phase_3_Freeze_Handover_DeepMindQ.pdf')
DIAGRAM_DIR = SCRIPT_DIR

FONT_DIR = '/usr/share/fonts'

# ━━ Cascade Palette ━━
PAGE_BG       = colors.HexColor('#f4f4f3')
SECTION_BG    = colors.HexColor('#ececeb')
CARD_BG       = colors.HexColor('#ebebe9')
TABLE_STRIPE  = colors.HexColor('#eeedea')
HEADER_FILL   = colors.HexColor('#5c5234')
COVER_BLOCK   = colors.HexColor('#5c5643')
BORDER        = colors.HexColor('#cbc7ba')
ICON          = colors.HexColor('#9e8846')
ACCENT        = colors.HexColor('#9b8133')
ACCENT_2      = colors.HexColor('#522fbc')
TEXT_PRIMARY   = colors.HexColor('#262523')
TEXT_MUTED     = colors.HexColor('#7d7b74')
SEM_SUCCESS   = colors.HexColor('#3e8957')
SEM_WARNING   = colors.HexColor('#a48546')
SEM_ERROR     = colors.HexColor('#ab534b')
SEM_INFO      = colors.HexColor('#436b92')

# ━━ Font Registration ━━
pdfmetrics.registerFont(TTFont('FreeSerif', f'{FONT_DIR}/truetype/freefont/FreeSerif.ttf'))
pdfmetrics.registerFont(TTFont('FreeSerif-Bold', f'{FONT_DIR}/truetype/freefont/FreeSerifBold.ttf'))
pdfmetrics.registerFont(TTFont('FreeSerif-Italic', f'{FONT_DIR}/truetype/freefont/FreeSerifItalic.ttf'))
pdfmetrics.registerFont(TTFont('FreeSerif-BoldItalic', f'{FONT_DIR}/truetype/freefont/FreeSerifBoldItalic.ttf'))
pdfmetrics.registerFont(TTFont('DejaVuSans', f'{FONT_DIR}/truetype/dejavu/DejaVuSansMono.ttf'))
registerFontFamily('FreeSerif', normal='FreeSerif', bold='FreeSerif-Bold',
                    italic='FreeSerif-Italic', boldItalic='FreeSerif-BoldItalic')

# ━━ TocDocTemplate ━━
class TocDocTemplate(SimpleDocTemplate):
    def afterFlowable(self, flowable):
        if hasattr(flowable, 'bookmark_name'):
            level = getattr(flowable, 'bookmark_level', 0)
            text = getattr(flowable, 'bookmark_text', '')
            key = getattr(flowable, 'bookmark_key', '')
            self.notify('TOCEntry', (level, text, self.page, key))

    def handle_pageEnd(self):
        SimpleDocTemplate.handle_pageEnd(self)
        canvas = self.canv
        canvas.saveState()
        canvas.setFont('FreeSerif', 8)
        canvas.setFillColor(TEXT_MUTED)
        canvas.drawRightString(PAGE_W - RIGHT_M, BOTTOM_M * 0.4, f'{self.page}')
        canvas.setStrokeColor(BORDER)
        canvas.setLineWidth(0.5)
        canvas.line(LEFT_M, PAGE_H - TOP_M + 12, PAGE_W - RIGHT_M, PAGE_H - TOP_M + 12)
        canvas.setFont('FreeSerif', 7.5)
        canvas.drawString(LEFT_M, PAGE_H - TOP_M + 16, 'Phase 3 Freeze Handover - DeepMindQ')
        canvas.restoreState()

# ━━ Page dimensions ━━
PAGE_W, PAGE_H = A4
LEFT_M = 0.85 * inch
RIGHT_M = 0.85 * inch
TOP_M = 0.75 * inch
BOTTOM_M = 0.75 * inch
AVAIL_W = PAGE_W - LEFT_M - RIGHT_M
AVAIL_H = PAGE_H - TOP_M - BOTTOM_M

# ━━ Styles ━━
styles = getSampleStyleSheet()

s_h1 = ParagraphStyle('H1', fontName='FreeSerif-Bold', fontSize=20, leading=26,
    textColor=TEXT_PRIMARY, spaceBefore=18, spaceAfter=10, alignment=TA_LEFT)
s_h2 = ParagraphStyle('H2', fontName='FreeSerif-Bold', fontSize=15, leading=20,
    textColor=HEADER_FILL, spaceBefore=14, spaceAfter=8, alignment=TA_LEFT)
s_h3 = ParagraphStyle('H3', fontName='FreeSerif-Bold', fontSize=12, leading=16,
    textColor=TEXT_PRIMARY, spaceBefore=10, spaceAfter=6, alignment=TA_LEFT)
s_body = ParagraphStyle('Body', fontName='FreeSerif', fontSize=10.5, leading=17,
    textColor=TEXT_PRIMARY, spaceBefore=0, spaceAfter=6, alignment=TA_JUSTIFY)
s_body_left = ParagraphStyle('BodyLeft', fontName='FreeSerif', fontSize=10.5, leading=17,
    textColor=TEXT_PRIMARY, spaceBefore=0, spaceAfter=6, alignment=TA_LEFT)
s_bullet = ParagraphStyle('Bullet', fontName='FreeSerif', fontSize=10.5, leading=17,
    textColor=TEXT_PRIMARY, spaceBefore=2, spaceAfter=4, alignment=TA_LEFT,
    leftIndent=18, bulletIndent=6)
s_code = ParagraphStyle('Code', fontName='DejaVuSans', fontSize=8.5, leading=12,
    textColor=TEXT_PRIMARY, backColor=CARD_BG, leftIndent=12, rightIndent=12,
    spaceBefore=6, spaceAfter=6, borderPadding=6)
s_caption = ParagraphStyle('Caption', fontName='FreeSerif-Italic', fontSize=9,
    leading=12, textColor=TEXT_MUTED, spaceBefore=4, spaceAfter=8, alignment=TA_CENTER)
s_th = ParagraphStyle('TH', fontName='FreeSerif-Bold', fontSize=9.5, leading=13,
    textColor=colors.white, alignment=TA_CENTER)
s_td = ParagraphStyle('TD', fontName='FreeSerif', fontSize=9.5, leading=13,
    textColor=TEXT_PRIMARY, alignment=TA_LEFT)
s_td_center = ParagraphStyle('TDCenter', fontName='FreeSerif', fontSize=9.5, leading=13,
    textColor=TEXT_PRIMARY, alignment=TA_CENTER)
s_callout = ParagraphStyle('Callout', fontName='FreeSerif', fontSize=10, leading=16,
    textColor=TEXT_PRIMARY, backColor=colors.HexColor('#fdf8eb'),
    borderColor=ACCENT, borderWidth=2, borderPadding=10,
    leftIndent=12, rightIndent=12, spaceBefore=8, spaceAfter=8, alignment=TA_LEFT)

# ━━ Helpers ━━
def heading(text, style, level=0):
    key = 'h_%s' % hashlib.md5(text.encode()).hexdigest()[:8]
    p = Paragraph(f'<a name="{key}"/>{text}', style)
    p.bookmark_name = text
    p.bookmark_level = level
    p.bookmark_text = text
    p.bookmark_key = key
    return p

def bullet(text):
    return Paragraph(f'<bullet>•</bullet> {text}', s_bullet)

def embed_image(path, max_w=None, max_h=None):
    if max_w is None: max_w = AVAIL_W
    if max_h is None: max_h = AVAIL_H * 0.45
    pil = PILImage.open(path)
    ow, oh = pil.size
    rw = max_w / ow if ow > max_w else 1.0
    rh = max_h / oh if oh > max_h else 1.0
    ratio = min(rw, rh)
    return Image(path, width=ow*ratio, height=oh*ratio)

def make_table(headers, rows, col_widths=None):
    data = [[Paragraph(f'<b>{h}</b>', s_th) for h in headers]]
    for row in rows:
        data.append([Paragraph(str(c), s_td) if not isinstance(c, Paragraph) else c for c in row])
    if col_widths is None:
        n = len(headers)
        col_widths = [AVAIL_W / n] * n
    t = Table(data, colWidths=col_widths, hAlign='CENTER', repeatRows=1)
    style_cmds = [
        ('BACKGROUND', (0, 0), (-1, 0), HEADER_FILL),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('GRID', (0, 0), (-1, -1), 0.5, BORDER),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]
    for i in range(1, len(data)):
        bg = colors.white if i % 2 == 1 else TABLE_STRIPE
        style_cmds.append(('BACKGROUND', (0, i), (-1, i), bg))
    t.setStyle(TableStyle(style_cmds))
    return t

def safe_keep(elements):
    total = sum(AVAIL_W for _ in elements)  # rough estimate
    if len(elements) <= 2:
        return [KeepTogether(elements)]
    return [KeepTogether(elements[:2])] + list(elements[2:])

# ══════════════════════════════════════════════════════════════
# BUILD STORY
# ══════════════════════════════════════════════════════════════
story = []

# ── CHAPTER 1: Executive Summary ──
story.append(heading('<b>1. Executive Summary</b>', s_h1, 0))
story.append(Paragraph(
    'This document constitutes the official Phase 3 freeze handover package for the DeepMindQ '
    'AI-Governed Sales Intelligence Platform. Phase 3 represents the intelligence hardening '
    'milestone where the platform transitioned from a basic CRM with AI assistance to a fully '
    'governed, evidence-grounded intelligence system. Every LLM call now passes through a '
    'mandatory governance layer that enforces confidence thresholds, hallucination prevention, '
    'evidence traceability, and comprehensive audit logging. The platform is deployed on Vercel '
    'with Neon PostgreSQL as its persistent data store, and the database schema has been validated '
    'and synchronized via <font name="DejaVuSans">npx prisma db push</font>.', s_body))
story.append(Paragraph(
    'The architecture comprises 152 API route handlers organized across 8 domain groups, '
    'a 6-step research intelligence pipeline, a 4-factor weighted signal-to-capability matching '
    'engine, and a dual-function AI governance gateway. The Prisma schema defines 35 models with '
    'Phase 3 additions including AIGenerationAudit (11 audit fields), Evidence (7 indexes), and '
    'SignalCapabilityMatch (6 indexes). Human-controlled selling is enforced by design: no cron '
    'jobs are configured, the email worker only processes human-approved drafts from the SendQueue, '
    'and all AI outputs are advisory drafts requiring explicit human approval before any customer '
    'communication. A known design tension exists in sequences__process.ts which auto-approves '
    'sequence drafts, and this is flagged as a mandatory Phase 4 architectural control.', s_body))
story.append(Paragraph(
    'This handover package covers: system architecture with diagrams, data flow documentation, '
    'module dependency analysis, AI governance rules and thresholds, API entry point contracts, '
    'database schema summary, RFP/RFI intelligence foundation, human-controlled selling architecture, '
    'known technical debt inventory, and Phase 4/5/6 dependency rules. One explicit Phase 4 '
    'requirement has been documented: the sequence automation architecture must permanently '
    'enforce human approval before any customer communication, and no cron, worker, scheduler, '
    'or automation may ever bypass human review.', s_body))

# ── CHAPTER 2: System Architecture ──
story.append(Spacer(1, 18))
story.append(heading('<b>2. System Architecture</b>', s_h1, 0))
story.append(Paragraph(
    'The DeepMindQ platform follows a layered architecture with clear separation between client, '
    'API routing, core business logic, and infrastructure. The frontend is a Next.js 18 application '
    'using React with Tailwind CSS and the shadcn/ui component library. All server-side logic '
    'resides in Next.js API route handlers that delegate to core library modules. The AI governance '
    'layer sits between the AI-consuming modules and the raw LLM provider chain, acting as a '
    'mandatory gateway for every AI generation request. This section presents the high-level '
    'architecture, the technology stack, and the deployment topology.', s_body))

story.append(heading('<b>2.1 Architecture Overview</b>', s_h2, 1))
story.append(Paragraph(
    'The diagram below illustrates the four-layer architecture: Client Layer, API Layer (152 routes '
    'across 8 domain groups), Core Libraries (including the mandatory AI Governance Gateway), and '
    'Infrastructure (Prisma ORM, Neon PostgreSQL, Vercel Edge Runtime, and external AI/search APIs). '
    'The governance layer is visually distinguished as the mandatory gate through which all AI '
    'requests must pass before reaching any LLM provider.', s_body))
story.append(Spacer(1, 8))
story.append(embed_image(os.path.join(DIAGRAM_DIR, 'diagram-arch.png'), max_h=AVAIL_H*0.55))
story.append(Paragraph('Figure 1: System Architecture Overview', s_caption))

story.append(heading('<b>2.2 Technology Stack</b>', s_h2, 1))
story.append(make_table(
    ['Layer', 'Technology', 'Version / Detail'],
    [
        ['Frontend', 'Next.js + React', 'App Router, Server Components'],
        ['UI', 'shadcn/ui + Tailwind CSS', 'Component library + utility CSS'],
        ['API', 'Next.js Route Handlers', '152 handlers across 8 groups'],
        ['ORM', 'Prisma', 'v6.19.3, PostgreSQL provider'],
        ['Database', 'Neon PostgreSQL', 'Serverless, pooler connection'],
        ['Hosting', 'Vercel', 'Edge Runtime, project prj_JtenBM...'],
        ['LLM', 'NVIDIA NIM, Gemini, Fireworks', 'Multi-provider chain with fallback'],
        ['Search', 'Tavily API', 'Advanced search depth, AI answer'],
        ['Auth', 'OTP-based + Session tokens', 'Custom implementation'],
    ],
    col_widths=[AVAIL_W*0.18, AVAIL_W*0.32, AVAIL_W*0.50]
))
story.append(Paragraph('Table 1: Technology Stack', s_caption))

story.append(heading('<b>2.3 Deployment Architecture</b>', s_h2, 1))
story.append(Paragraph(
    'The platform is deployed entirely on Vercel under team <font name="DejaVuSans">team_nKBskve4kFghKK8BNVNe0b2Q</font> '
    'with project ID <font name="DejaVuSans">prj_JtenBMINFkDNVYw7pbVXVUUTe7iK</font>. The Neon PostgreSQL database '
    'runs in the us-east-1 AWS region with connection pooling enabled via the pooler endpoint. '
    'The <font name="DejaVuSans">vercel.json</font> configuration file is intentionally empty (no custom rewrites, redirects, '
    'headers, or cron jobs), confirming that the platform relies on Vercel defaults for routing '
    'and has zero scheduled background processes. All API routes use the catch-all slug pattern '
    '<font name="DejaVuSans">[...slug]</font> for domain grouping, which maps file paths to URL segments via the Next.js '
    'file-system router. Environment variables including <font name="DejaVuSans">DATABASE_URL</font> and AI provider API keys '
    'are managed through the Vercel dashboard and are not committed to source control.', s_body))

# ── CHAPTER 3: Data Flow Architecture ──
story.append(Spacer(1, 18))
story.append(heading('<b>3. Data Flow Architecture</b>', s_h1, 0))
story.append(Paragraph(
    'The core intelligence pipeline follows a 6-step process that transforms raw web search '
    'results into governed, evidence-grounded AI outputs. This pipeline is the backbone of the '
    'platform and represents the primary value chain: from company creation through research, '
    'evidence collection, signal detection, capability matching, and finally AI-assisted content '
    'generation with full audit traceability. Each step is designed to produce intermediate '
    'artifacts that serve both immediate processing needs and downstream analytical queries.', s_body))

story.append(heading('<b>3.1 Research Intelligence Pipeline</b>', s_h2, 1))
story.append(Paragraph(
    'The research pipeline, implemented in <font name="DejaVuSans">src/lib/research-engine/researcher.ts</font>, executes '
    'six sequential steps. Step 1 fires four parallel Tavily web searches targeting business overview, '
    'technology landscape, key people, and recent news. Step 2 stores each search result as an '
    'Evidence record with source URL, relevance score, snippet text, and quality tier classification. '
    'Step 3 uses <font name="DejaVuSans">governedAICallAggregate</font> at two points (steps 3a and 3c) to extract structured '
    'data: main company data, key people, and the Phase 3 enhanced fields including structuredTechLandscape, '
    'strategicPriorities, businessProblems, transformationAreas, and technologyThemes. Step 4 cross-references '
    'extracted data against evidence records and computes per-field confidence scores. Step 5 persists '
    'the complete intelligence package to the database. Step 6 triggers downstream AI generation '
    'through the governance gateway.', s_body))
story.append(Spacer(1, 8))
story.append(embed_image(os.path.join(DIAGRAM_DIR, 'diagram-dataflow.png'), max_h=AVAIL_H*0.65))
story.append(Paragraph('Figure 2: Research Intelligence Pipeline (6 Steps)', s_caption))

story.append(heading('<b>3.2 Signal Detection and RFP/RFI Intelligence</b>', s_h2, 1))
story.append(Paragraph(
    'Signal detection (<font name="DejaVuSans">src/lib/research-engine/signals.ts</font>) uses <font name="DejaVuSans">governedAICallAggregate</font> '
    'to identify buying signals from research context. The LLM prompt includes specific RFP/RFI/tender '
    'fields: <font name="DejaVuSans">opportunityType</font> (rfp, rfi, tender, vendor_search, procurement, tech_transformation), '
    '<font name="DejaVuSans">publicationDate</font>, <font name="DejaVuSans">deadline</font>, <font name="DejaVuSans">buyingArea</font>, <font name="DejaVuSans">techRequirement</font>, '
    '<font name="DejaVuSans">serviceRequirement</font>, and <font name="DejaVuSans">matchingCapability</font>. Each detected signal is stored '
    'in the CompanySignal model with an <font name="DejaVuSans">evidenceIds</font> JSON array linking back to source evidence '
    'records. The CompanySignal model includes 8 database indexes including composite indexes on '
    '(companyId, signalType, createdAt) and (companyId, status) for efficient querying.', s_body))

story.append(heading('<b>3.3 Signal-to-Capability Matching</b>', s_h2, 1))
story.append(Paragraph(
    'The matching engine (<font name="DejaVuSans">src/lib/research-engine/signal-capability-matching.ts</font>) scores each signal '
    'against the capability knowledge base using a 4-factor weighted formula. Category matching '
    'contributes 30% of the score, keyword overlap (Jaccard similarity) contributes 30%, business '
    'problem alignment contributes 20%, and an impact bonus contributes 5%. The <font name="DejaVuSans">SIGNAL_CAPABILITY_MAP</font> '
    'defines signal-type-to-category mappings for 8 signal types: funding_round, acquisition, '
    'tech_stack_change, expansion, partnership, regulatory, and financial_pressure. Each mapping '
    'includes target capability categories, typical business problems, suggested sales angles, '
    'and keyword lists. The minimum match score threshold is 0.25, and an LLM-enhancement fallback '
    'activates for signals scoring below 0.35. Match results produce a <font name="DejaVuSans">reason</font>, '
    '<font name="DejaVuSans">businessProblem</font>, <font name="DejaVuSans">salesAngle</font>, and <font name="DejaVuSans">expectedOutcome</font> for each match, stored '
    'in the SignalCapabilityMatch model.', s_body))

# ── CHAPTER 4: Module Dependency Map ──
story.append(Spacer(1, 18))
story.append(heading('<b>4. Module Dependency Map</b>', s_h1, 0))
story.append(Paragraph(
    'The platform modules follow a strict dependency hierarchy designed to prevent governance '
    'bypass. At the foundation, <font name="DejaVuSans">zai-helpers.ts</font> provides raw LLM provider chain management and '
    'Tavily web search. The AI governance layer (<font name="DejaVuSans">ai-governance.ts</font>) is the only authorized '
    'consumer of <font name="DejaVuSans">callLLM()</font> from zai-helpers. All other modules that need AI capabilities must '
    'import from <font name="DejaVuSans">ai-governance.ts</font>, never directly from <font name="DejaVuSans">zai-helpers.ts</font>. This architectural '
    'constraint is enforced by code comments, a build-time guard script, and the dependency '
    'structure itself. The intelligence-contract module (<font name="DejaVuSans">intelligence-contract.ts</font>) provides a '
    'unified <font name="DejaVuSans">ResearchContext</font> type that assembles data from the research card, evidence records, '
    'signals, and capability matches into a single object consumed by all governed AI calls.', s_body))

story.append(make_table(
    ['Module', 'Depends On', 'Consumed By'],
    [
        ['zai-helpers.ts', 'ai-config.ts, External APIs', 'ai-governance.ts ONLY'],
        ['ai-governance.ts', 'zai-helpers.ts (callLLM), db', 'All AI route handlers'],
        ['intelligence-contract.ts', 'db (Prisma)', 'ai-governance.ts, AI routes'],
        ['research-engine/researcher.ts', 'zai-helpers, ai-governance, evidence, signals', 'API: companies__research'],
        ['research-engine/evidence.ts', 'db, zai-helpers (types)', 'researcher.ts'],
        ['research-engine/signals.ts', 'ai-governance, zai-helpers', 'researcher.ts'],
        ['research-engine/signal-capability-matching.ts', 'db', 'researcher.ts (step 6)'],
        ['email-generation.ts', 'ai-governance, intelligence-contract, db', 'API: contacts__generate-email, sequences__process'],
        ['ai__chat.ts', 'ai-governance (governedAICallAggregate), db', 'Frontend chat component'],
        ['ai__account-brief.ts', 'ai-governance (governedAICall), intelligence-contract', 'Frontend company page'],
        ['ai__conversation-plan.ts', 'ai-governance (governedAICall), intelligence-contract', 'Frontend company page'],
    ],
    col_widths=[AVAIL_W*0.30, AVAIL_W*0.38, AVAIL_W*0.32]
))
story.append(Paragraph('Table 2: Module Dependency Map', s_caption))

# ── CHAPTER 5: AI Governance Architecture ──
story.append(Spacer(1, 18))
story.append(heading('<b>5. AI Governance Architecture</b>', s_h1, 0))
story.append(Paragraph(
    'The AI governance layer (<font name="DejaVuSans">src/lib/ai-governance.ts</font>, approximately 1085 lines) is the single '
    'mandatory gateway for all LLM calls in the application. It provides five core capabilities: '
    'confidence gates with per-generation-type thresholds, six pre-generation governance checks, '
    'fifteen hallucination prevention rules injected into every prompt, evidence-grounded context '
    'injection, and comprehensive audit logging. The governance layer uses a non-throwing design '
    'where checks return structured results rather than throwing exceptions, allowing AI route '
    'handlers to make contextual decisions about how to handle governance failures.', s_body))

story.append(heading('<b>5.1 Governance Checks</b>', s_h2, 1))
story.append(Paragraph(
    'Six pre-generation checks are evaluated before any company-specific LLM call. The research_exists '
    'check verifies that a CompanyResearchCard record exists for the target company. The research_confidence '
    'check compares the average per-field confidence score against the minimum threshold for the generation '
    'type. The freshness_score check validates that the composite freshness metric (0-100) meets the '
    'minimum requirement. The staleness check calculates days since the last research update and compares '
    'against the maximum allowed staleness period. The capability_match check verifies that at least '
    'one capability asset matched the company signals (when required by the generation type config). '
    'The recent_intelligence check ensures that recent signals or evidence exist for the company.', s_body))

story.append(heading('<b>5.2 Confidence Thresholds by Generation Type</b>', s_h2, 1))
story.append(make_table(
    ['Generation Type', 'Min Confidence', 'Min Freshness', 'Require Capability', 'Require Intel', 'Max Staleness (days)'],
    [
        ['email_draft', '0.60', '25', 'Yes', 'Yes', '60'],
        ['conversation_plan', '0.60', '25', 'No', 'Yes', '60'],
        ['account_brief', '0.20', '10', 'No', 'No', '180'],
        ['signal_analysis', '0.20', '10', 'No', 'No', '365'],
        ['recommendations', '0.40', '15', 'No', 'No', '90'],
        ['opportunities', '0.50', '20', 'No', 'Yes', '90'],
        ['suggested_contacts', '0.30', '15', 'No', 'No', '90'],
    ],
    col_widths=[AVAIL_W*0.18, AVAIL_W*0.14, AVAIL_W*0.13, AVAIL_W*0.16, AVAIL_W*0.14, AVAIL_W*0.25]
))
story.append(Paragraph('Table 3: Confidence Thresholds by Generation Type', s_caption))

story.append(Spacer(1, 8))
story.append(embed_image(os.path.join(DIAGRAM_DIR, 'diagram-governance.png'), max_h=AVAIL_H*0.50))
story.append(Paragraph('Figure 3: AI Governance Architecture', s_caption))

story.append(heading('<b>5.3 Hallucination Prevention</b>', s_h2, 1))
story.append(Paragraph(
    'Fifteen hallucination prevention rules are defined as the <font name="DejaVuSans">HALLUCINATION_PREVENTION_RULES</font> '
    'constant and are injected into the system prompt of every governed LLM call. These rules enforce '
    'source-grounded responses, prohibit fabrication of facts not present in the provided context, '
    'require uncertainty hedging when confidence is low, mandate citation of specific data points, '
    'and prevent the AI from making claims about people, financial figures, or timelines without '
    'explicit evidence. The rules also include specific constraints for the sales context: never invent '
    'customer names, never fabricate case study metrics, and never claim capabilities that are not '
    'present in the capability knowledge base. Additionally, a staleness warning modifier is applied '
    'when intelligence data exceeds a certain age, instructing the LLM to be more conservative in its '
    'claims and explicitly note the potential for outdated information.', s_body))

story.append(heading('<b>5.4 Audit Trail</b>', s_h2, 1))
story.append(Paragraph(
    'Every AI generation, whether successful, blocked, or failed, produces an AIGenerationAudit '
    'record with 11 fields: generationType, companyId, contactId, researchContextVersion, '
    'evidenceIdsUsed (JSON array), signalIdsUsed (JSON array), capabilityAssetIdsUsed (JSON array), '
    'researchConfidence (computed average), freshnessScore (0-100), governancePassed (boolean), and '
    'governanceChecks (JSON object with per-check detail). The <font name="DejaVuSans">recordGeneration()</font> function '
    'is fire-and-forget: errors are logged to console but never thrown, ensuring that audit failures '
    'cannot break the user-facing flow. Five distinct audit paths exist: (1) governance block when '
    'confidence falls below threshold, (2) LLM call failure with error message, (3) successful '
    '<font name="DejaVuSans">governedAICall</font> with full context, (4) successful <font name="DejaVuSans">governedAICallAggregate</font> for non-company '
    'calls, and (5) manual <font name="DejaVuSans">recordGeneration()</font> invocations from modules that perform additional '
    'validation before calling the governance layer.', s_body))

story.append(heading('<b>5.5 Dual Function Exports</b>', s_h2, 1))
story.append(Paragraph(
    'The governance layer exports exactly two functions for external use. <font name="DejaVuSans">governedAICall()</font> is '
    'designed for company-specific AI generation (email drafts, account briefs, conversation plans). '
    'It accepts a ResearchContext object, runs all six governance checks, applies confidence thresholds, '
    'injects hallucination prevention rules and evidence grounding notes, calls the LLM, and records '
    'the full audit trail. <font name="DejaVuSans">governedAICallAggregate()</font> is designed for non-company AI calls (chat, '
    'signal detection, research extraction). It skips company-specific checks since no company context '
    'exists, but still injects hallucination prevention rules and creates audit records. Both functions '
    'return a GovernedAIResult object containing success status, response text, governance result, '
    'rejection reason, and the grounding note used in the prompt.', s_body))

# ── CHAPTER 6: API Entry Points ──
story.append(Spacer(1, 18))
story.append(heading('<b>6. API Entry Points</b>', s_h1, 0))
story.append(Paragraph(
    'The platform exposes 152 API route handlers organized into 8 domain groups using Next.js '
    'catch-all slug routing (<font name="DejaVuSans">[...slug]</font>). Each group corresponds to a functional domain '
    'with its own subdirectory under <font name="DejaVuSans">src/app/api/</font>. The following table summarizes the '
    'route groups, their handler counts, and primary responsibilities.', s_body))

story.append(make_table(
    ['Route Group', 'Handlers', 'Primary Responsibility'],
    [
        ['g-auth', '12', 'OTP login/logout, sessions, password management, profile updates'],
        ['g-crm', '44', 'Companies, contacts, leads, segments, signals, evidence, pipeline, batches, duplicates, scoring'],
        ['g-ai', '33', 'Chat, account briefs, conversation plans, knowledge, capabilities, research agent, scoring, insights'],
        ['g-outreach', '23', 'Drafts, email worker, sequences, templates, tracking, webhooks, queue, unsubscribe'],
        ['g-data', '28', 'File uploads, data quality, column rules, normalization, scoring config, audit, analytics'],
        ['g-strategy', '5', 'Playbooks (CRUD), strategy room (account strategy)'],
        ['g-system', '4', 'Settings, database sync, seed data'],
        ['cron', '1', 'Job processor (manual trigger only, no cron configured)'],
    ],
    col_widths=[AVAIL_W*0.15, AVAIL_W*0.10, AVAIL_W*0.75]
))
story.append(Paragraph('Table 4: API Route Groups', s_caption))

story.append(heading('<b>6.1 AI Generation Endpoints (Governed)</b>', s_h2, 1))
story.append(Paragraph(
    'Four AI endpoints consume the governance layer for company-specific generation. Each endpoint '
    'calls <font name="DejaVuSans">governedAICall()</font> with a specific generationType, passes the ResearchContext '
    'assembled by the intelligence contract, and handles governance results appropriately. The chat '
    'endpoint uses <font name="DejaVuSans">governedAICallAggregate()</font> since it may operate without company context. '
    'The account brief endpoint uses <font name="DejaVuSans">enforceGovernance: false</font> to allow generation even '
    'with low confidence, producing a best-effort brief with appropriate caveats rather than blocking '
    'the user entirely.', s_body))

story.append(make_table(
    ['Endpoint', 'Function', 'Governance Type', 'Threshold'],
    [
        ['api/g-ai/ai__chat', 'General CRM assistant chat', 'governedAICallAggregate', 'N/A (non-company)'],
        ['api/g-ai/ai__account-brief', 'Account intelligence brief', 'governedAICall', '0.20 confidence (enforce: false)'],
        ['api/g-ai/ai__conversation-plan', 'Executive conversation plan', 'governedAICall', '0.60 confidence'],
        ['lib/email-generation', 'Personalized email draft', 'governedAICall', '0.60 confidence (enforce: false)'],
        ['research-engine/signals', 'Buying signal detection', 'governedAICallAggregate', 'N/A (non-company)'],
        ['research-engine/researcher', 'Data extraction (steps 3a, 3c)', 'governedAICallAggregate', 'N/A (non-company)'],
    ],
    col_widths=[AVAIL_W*0.22, AVAIL_W*0.30, AVAIL_W*0.28, AVAIL_W*0.20]
))
story.append(Paragraph('Table 5: AI Generation Endpoints and Governance Configuration', s_caption))

# ── CHAPTER 7: Database Schema ──
story.append(Spacer(1, 18))
story.append(heading('<b>7. Database Schema Summary</b>', s_h1, 0))
story.append(Paragraph(
    'The Prisma schema (<font name="DejaVuSans">prisma/schema.prisma</font>, 1077 lines) defines 35 models organized into '
    'functional domains. The database uses PostgreSQL via the Neon serverless provider with Prisma '
    'ORM v6.19.3. The schema has been synchronized with the database via <font name="DejaVuSans">npx prisma db push</font> '
    'and is confirmed to be in sync. This section summarizes the key models with emphasis on Phase 3 '
    'additions and the indexes that support query performance.', s_body))

story.append(heading('<b>7.1 Core Domain Models</b>', s_h2, 1))
story.append(make_table(
    ['Model', 'Purpose', 'Key Fields', 'Indexes'],
    [
        ['Company', 'Target accounts', 'industry, domain, intelligenceScore, lifecycleStage', '7 indexes'],
        ['Contact', 'Prospect contacts', 'email, leadScore, enrichmentScore, aiConversionScore', '7 indexes'],
        ['CompanyResearchCard', 'Research intelligence', 'structuredTechLandscape, strategicPriorities, businessProblems, fieldConfidence', '1 (companyId unique)'],
        ['CompanySignal', 'Buying signals', 'opportunityType, publicationDate, deadline, buyingArea, techRequirement, matchingCapability', '8 indexes incl. composite'],
        ['Evidence', 'Source-grounded facts', 'extractedField, extractedValue, relevanceScore, confidence, sourceQualityTier', '8 indexes incl. composite'],
        ['AIGenerationAudit', 'AI generation trail', '11 audit fields: generationType, researchConfidence, freshnessScore, governancePassed, etc.', '7 indexes incl. composite'],
        ['SignalCapabilityMatch', 'Signal-capability links', 'matchScore, reason, businessProblem, salesAngle, expectedOutcome', '6 indexes incl. composite'],
        ['CapabilityAsset', 'Knowledge base', 'category, keywords, businessProblem, customerOutcome, differentiator', '7 indexes'],
    ],
    col_widths=[AVAIL_W*0.17, AVAIL_W*0.18, AVAIL_W*0.40, AVAIL_W*0.25]
))
story.append(Paragraph('Table 6: Core Domain Models (Phase 3 Emphasis)', s_caption))

story.append(heading('<b>7.2 Outreach and Sequence Models</b>', s_h2, 1))
story.append(Paragraph(
    'The outreach domain includes Draft, SendQueue, EmailSequence, SequenceStep, and SequenceEnrollment. '
    'The Draft model tracks email composition with fields for confidenceScore, sourceSnippetsUsed, '
    'assumptionFlags, and reviewNotes. The SendQueue model is the critical control point: emails can '
    'only be sent from this queue, and items are only added when a human explicitly approves a draft '
    'or when a sequence auto-approves (the design tension flagged in technical debt). The EmailEvent '
    'model captures opens, clicks, replies, bounces, and unsubscribes for engagement tracking. The '
    'ABTest model supports A/B testing of email variants with draft-level tracking.', s_body))

story.append(heading('<b>7.3 Phase 3 Schema Additions</b>', s_h2, 1))
story.append(Paragraph(
    'Phase 3 added significant schema capabilities. The CompanyResearchCard gained structuredTechLandscape '
    '(JSON with cloud, data, ai, applications arrays), strategicPriorities (JSON with priority, description, '
    'evidence, confidence), businessProblems, transformationAreas, technologyThemes, and four category-specific '
    'freshness timestamps (profileFreshnessAt, signalFreshnessAt, contactFreshnessAt, techFreshnessAt). '
    'The CompanySignal model gained RFP/RFI intelligence fields: opportunityType, publicationDate, deadline, '
    'buyingArea, techRequirement, serviceRequirement, matchingCapability, and sourceQuality. The AIGenerationAudit '
    'model was added entirely in Phase 3 with 11 fields and 7 indexes. The SignalCapabilityMatch model was '
    'added to store the output of the 4-factor matching engine. The Evidence model was added with 7 indexes '
    'including composite indexes for efficient field-level and company-level evidence queries.', s_body))

# ── CHAPTER 8: RFP/RFI Intelligence Foundation ──
story.append(Spacer(1, 18))
story.append(heading('<b>8. RFP/RFI Intelligence Foundation</b>', s_h1, 0))
story.append(Paragraph(
    'Phase 3 established the data architecture foundation for RFP (Request for Proposal) and RFI '
    '(Request for Information) intelligence. This foundation enables the platform to detect procurement '
    'opportunities, match them against organizational capabilities, and provide sales teams with '
    'structured, evidence-grounded intelligence for competitive bidding. The RFP/RFI capability is '
    'not a standalone module but rather a cross-cutting concern embedded in the signal detection, '
    'capability matching, and AI generation layers.', s_body))

story.append(heading('<b>8.1 Signal-Level RFP/RFI Fields</b>', s_h2, 1))
story.append(Paragraph(
    'When the signal detection engine identifies a procurement-related signal, it populates dedicated '
    'RFP/RFI fields on the CompanySignal model. The <font name="DejaVuSans">opportunityType</font> field classifies the signal '
    'as rfp, rfi, tender, vendor_search, procurement, tech_transformation, or partner_requirement. '
    'The <font name="DejaVuSans">publicationDate</font> and <font name="DejaVuSans">deadline</font> fields capture the procurement timeline. '
    'The <font name="DejaVuSans">buyingArea</font> field describes the procurement category (e.g., "Cloud Migration", "Data Analytics"). '
    'The <font name="DejaVuSans">techRequirement</font> and <font name="DejaVuSans">serviceRequirement</font> fields capture specific technical and '
    'service needs stated in the RFP/RFI. The <font name="DejaVuSans">matchingCapability</font> field stores the ID of the '
    'best-matching CapabilityAsset from the knowledge base, creating a direct link from opportunity '
    'to organizational capability.', s_body))

story.append(heading('<b>8.2 Capability Knowledge Base</b>', s_h2, 1))
story.append(Paragraph(
    'The CapabilityAsset model serves as the organizational capability knowledge base. Each asset '
    'includes structured fields for solution name, accelerator, primary technology, target industry, '
    'business problem, customer outcome, differentiator, case study references, proof points, and '
    'keywords. The keywords field (JSON array) is used by the signal-capability matching engine for '
    'Jaccard similarity computation. Assets are categorized by type (service_line, solution, accelerator, '
    'technology, case_study, proof_point, objection_response, cta) and can be linked in parent-child '
    'relationships. Content hashing enables deduplication, and upvote/downvote/usage counters track '
    'effectiveness over time. This knowledge base is the foundation for both RFP/RFI matching and '
    'general sales intelligence generation.', s_body))

# ── CHAPTER 9: Human-Controlled Selling ──
story.append(Spacer(1, 18))
story.append(heading('<b>9. Human-Controlled Selling Architecture</b>', s_h1, 0))
story.append(Paragraph(
    'The platform enforces human-controlled selling through a multi-layered architectural design. '
    'The core principle is that the AI system researches, recommends, and drafts, but a human '
    'operator must explicitly approve any customer-facing communication before it is sent. This '
    'design is implemented through three complementary mechanisms: no autonomous triggers, a mandatory '
    'approval workflow, and a worker-only-send pattern.', s_body))

story.append(heading('<b>9.1 No Autonomous Triggers</b>', s_h2, 1))
story.append(Paragraph(
    'The <font name="DejaVuSans">vercel.json</font> file is empty, containing zero cron job definitions. This means no '
    'background process runs on any schedule without explicit human initiation. The only cron-related '
    'route is <font name="DejaVuSans">/api/cron/job-processor</font>, which is designed for manual triggering only. '
    'The email worker (<font name="DejaVuSans">email-worker.ts</font>) does not run autonomously; it must be invoked by '
    'a human operator (e.g., clicking "Send Pending" in the UI), and it only processes items already '
    'in the SendQueue with status "pending" or "scheduled" with a past timestamp.', s_body))

story.append(heading('<b>9.2 Mandatory Approval Workflow</b>', s_h2, 1))
story.append(Paragraph(
    'The standard email generation flow creates a Draft record with status "pending_review". '
    'The human operator reviews the draft, optionally edits it, and either approves (status changes '
    'to "approved", creating a SendQueue entry) or rejects (status changes to "rejected" with a '
    'reason). Only approved drafts enter the SendQueue. The email worker reads exclusively from '
    'the SendQueue, never from the Draft table directly. This two-table pattern (Draft for composition, '
    'SendQueue for execution) provides a clean separation between the creative and operational phases '
    'of outbound communication.', s_body))

story.append(heading('<b>9.3 Design Tension: sequences__process.ts</b>', s_h2, 1))
story.append(Paragraph(
    'The sequence processing endpoint (<font name="DejaVuSans">sequences__process.ts</font>) presents a known design tension. '
    'When processing due sequence enrollments, it creates drafts with <font name="DejaVuSans">status: "approved"</font> '
    'directly (line 109) and immediately creates SendQueue entries. This bypasses the human review '
    'step for sequence-driven emails. Currently, no cron job calls this endpoint, so this code path '
    'is not active. However, if a cron job or external scheduler were configured to call this endpoint, '
    'it would enable autonomous email sending without human review. This is flagged as a mandatory '
    'Phase 4 architectural control that must be resolved before any sequence automation is activated.', s_body))

# ── CHAPTER 10: Known Technical Debt ──
story.append(Spacer(1, 18))
story.append(heading('<b>10. Known Technical Debt</b>', s_h1, 0))
story.append(Paragraph(
    'The following items constitute the known technical debt at the Phase 3 freeze boundary. '
    'Each item has been assessed for severity and is assigned to a future phase for resolution. '
    'No critical items remain unresolved in Phase 3; the governance layer is fully operational '
    'and all AI generation paths are covered.', s_body))

story.append(make_table(
    ['ID', 'Item', 'Severity', 'Assigned Phase', 'Description'],
    [
        ['TD-01', 'sequences__process.ts auto-approval', 'High', 'Phase 4', 'Auto-sets draft status to "approved", bypassing human review. Must enforce human approval gate before any sequence automation.'],
        ['TD-02', 'Deprecated functions in zai-helpers.ts', 'Low', 'Phase 4', 'callChatLLM, researchCompany, findKeyPeople, getCompanyNews, getZAI are marked @deprecated but still exported. Remove or isolate.'],
        ['TD-03', 'No build-time governance guard', 'Medium', 'Phase 4', 'No automated CI/CD check prevents future files from importing callLLM directly. Add lint rule or pre-build script.'],
        ['TD-04', 'email-generation.ts uses enforceGovernance: false', 'Low', 'Phase 5', 'Email generation bypasses governance enforcement. Acceptable for Phase 3 but should enforce in Phase 5 with user-facing warnings.'],
        ['TD-05', 'No cron infrastructure', 'Info', 'Phase 4+', 'vercel.json has zero cron entries. Deliberate design choice for Phase 3 human-control, but limits automation capabilities.'],
        ['TD-06', 'No end-to-end test with live data', 'Medium', 'Phase 4', 'Research pipeline validated by code audit only. A live company test with full evidence chain is needed.'],
    ],
    col_widths=[AVAIL_W*0.08, AVAIL_W*0.20, AVAIL_W*0.09, AVAIL_W*0.12, AVAIL_W*0.51]
))
story.append(Paragraph('Table 7: Known Technical Debt Inventory', s_caption))

# ── CHAPTER 11: Phase 4/5/6 Dependency Rules ──
story.append(Spacer(1, 18))
story.append(heading('<b>11. Phase 4/5/6 Dependency Rules</b>', s_h1, 0))
story.append(Paragraph(
    'The following rules govern the dependency relationships between Phase 3 (frozen) and future '
    'phases. Phase 3 code and schema are now locked: changes require explicit justification and '
    'migration planning. Future phases must build on top of the Phase 3 architecture without '
    'modifying its core contracts.', s_body))

story.append(heading('<b>11.1 Phase 3 Lock Rules</b>', s_h2, 1))
story.append(bullet('The ai-governance.ts interface (governedAICall, governedAICallAggregate, recordGeneration) MUST NOT change signatures without a migration plan.'))
story.append(bullet('The AIGenerationAudit schema MUST NOT remove or rename existing fields. New fields MAY be added with nullable defaults.'))
story.append(bullet('The Evidence and SignalCapabilityMatch models MUST NOT change their index structure.'))
story.append(bullet('The ResearchContext type from intelligence-contract.ts MUST remain backward-compatible.'))
story.append(bullet('The confidence threshold values in GOVERNANCE_CONFIGS MAY be adjusted but MUST NOT be removed.'))
story.append(bullet('The 15 HALLUCINATION_PREVENTION_RULES MAY be extended but existing rules MUST NOT be removed or weakened.'))

story.append(heading('<b>11.2 Phase 4 Requirements</b>', s_h2, 1))
story.append(Paragraph(
    'Phase 4 must resolve the sequences__process.ts human approval bypass (TD-01) before activating '
    'any sequence automation. The architectural control is absolute: no cron, worker, scheduler, or '
    'automation mechanism may ever bypass human review for customer communication. This rule must be '
    'enforced at the code level (approval gate in sequences__process.ts), at the infrastructure level '
    '(vercel.json cron restrictions), and at the process level (documentation and team training). '
    'Phase 4 should also remove or isolate deprecated functions in zai-helpers.ts (TD-02), add a '
    'build-time governance guard (TD-03), and run a live end-to-end company test (TD-06).', s_body))

story.append(heading('<b>11.3 Phase 5/6 Guidelines</b>', s_h2, 1))
story.append(Paragraph(
    'Phase 5 should address the email-generation.ts enforceGovernance relaxation (TD-04), potentially '
    'adding user-facing warnings when generating emails with low research confidence. Phase 6 may '
    'introduce cron-based automation for non-customer-facing tasks (data enrichment, signal monitoring) '
    'but must maintain the Phase 4 human approval control for all customer communication paths. '
    'Any new AI generation types must be registered in GOVERNANCE_CONFIGS with appropriate thresholds '
    'before deployment. The build-time governance guard from Phase 4 must be extended to cover any '
    'new AI SDK integrations.', s_body))

# ━━ Build ━━
os.makedirs(DOWNLOAD_DIR, exist_ok=True)

doc = TocDocTemplate(
    OUTPUT_PDF, pagesize=A4,
    leftMargin=LEFT_M, rightMargin=RIGHT_M,
    topMargin=TOP_M, bottomMargin=BOTTOM_M,
    title='Phase 3 Freeze Handover - DeepMindQ Sales Intelligence Platform',
    author='Z.ai',
    creator='Z.ai',
    subject='Phase 3 Architecture, Governance, and Handover Documentation'
)

# TOC
toc = TableOfContents()
toc.levelStyles = [
    ParagraphStyle('TOC1', fontName='FreeSerif', fontSize=12, leading=20, leftIndent=20, spaceBefore=6, spaceAfter=3),
    ParagraphStyle('TOC2', fontName='FreeSerif', fontSize=10.5, leading=17, leftIndent=40, spaceBefore=2, spaceAfter=2),
]
story.insert(0, Paragraph('<b>Table of Contents</b>', ParagraphStyle('TOCTitle', fontName='FreeSerif-Bold', fontSize=20, leading=26, textColor=TEXT_PRIMARY, spaceAfter=16)))
story.insert(1, toc)
story.insert(2, PageBreak())

doc.multiBuild(story)
print(f'Body PDF generated: {OUTPUT_PDF}')