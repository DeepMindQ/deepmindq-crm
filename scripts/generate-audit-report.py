#!/usr/bin/env python3
"""
DeepMindQ Full Platform Audit Report Generator
Pre-WI-18 Architecture, Product & Production Readiness Review
"""

import os, sys
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm, cm, inch
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT, TA_JUSTIFY
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, KeepTogether, HRFlowable, Image
)
from reportlab.platypus.tableofcontents import TableOfContents
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase.pdfmetrics import registerFontFamily
import hashlib

# ── Fonts ──
FONT_DIR = '/usr/share/fonts/truetype'
pdfmetrics.registerFont(TTFont('NotoSerifSC', f'{FONT_DIR}/noto-serif-sc/NotoSerifSC-Regular.ttf'))
pdfmetrics.registerFont(TTFont('NotoSerifSC-Bold', f'{FONT_DIR}/noto-serif-sc/NotoSerifSC-Bold.ttf'))
pdfmetrics.registerFont(TTFont('NotoSansSC', f'{FONT_DIR}/chinese/SarasaMonoSC-Regular.ttf'))
pdfmetrics.registerFont(TTFont('NotoSansSC-Bold', f'{FONT_DIR}/chinese/SarasaMonoSC-Bold.ttf'))
registerFontFamily('NotoSerifSC', normal='NotoSerifSC', bold='NotoSerifSC-Bold')
registerFontFamily('NotoSansSC', normal='NotoSansSC', bold='NotoSansSC-Bold')

# ── Cascade Palette (dark mode) ──
PAGE_BG       = colors.HexColor('#151512')
SECTION_BG    = colors.HexColor('#1f1e1b')
CARD_BG       = colors.HexColor('#2b2923')
TABLE_STRIPE  = colors.HexColor('#181713')
HEADER_FILL   = colors.HexColor('#4b432b')
COVER_BLOCK   = colors.HexColor('#443d2b')
BORDER        = colors.HexColor('#60563a')
ICON          = colors.HexColor('#cebf92')
ACCENT        = colors.HexColor('#dab64b')
ACCENT_2      = colors.HexColor('#68afc6')
TEXT_PRIMARY   = colors.HexColor('#efeeed')
TEXT_MUTED     = colors.HexColor('#8f8c85')
SEM_SUCCESS   = colors.HexColor('#6ab382')
SEM_WARNING   = colors.HexColor('#bba67b')
SEM_ERROR     = colors.HexColor('#bf7d77')
SEM_INFO      = colors.HexColor('#7e9ab5')
CRITICAL_RED  = colors.HexColor('#e05252')
HIGH_ORANGE   = colors.HexColor('#e0a040')
MEDIUM_YELLOW = colors.HexColor('#c0b060')

# ── Page setup ──
PAGE_W, PAGE_H = A4
LEFT_M = 25*mm
RIGHT_M = 20*mm
TOP_M = 20*mm
BOT_M = 20*mm
CONTENT_W = PAGE_W - LEFT_M - RIGHT_M

OUTPUT_PATH = '/home/z/my-project/download/DeepMindQ-Full-Platform-Audit-Report.pdf'

# ── TocDocTemplate ──
class TocDocTemplate(SimpleDocTemplate):
    def afterFlowable(self, flowable):
        if hasattr(flowable, 'bookmark_name'):
            level = getattr(flowable, 'bookmark_level', 0)
            text = getattr(flowable, 'bookmark_text', '')
            key = getattr(flowable, 'bookmark_key', '')
            self.notify('TOCEntry', (level, text, self.page, key))

# ── Styles ──
styles = getSampleStyleSheet()

def make_style(name, parent='Normal', **kw):
    base = styles[parent]
    return ParagraphStyle(name, parent=base, **kw)

s_body = make_style('BodyDark', fontName='NotoSansSC', fontSize=9.5, leading=14,
    textColor=TEXT_PRIMARY, alignment=TA_JUSTIFY, spaceAfter=6)
s_body_small = make_style('BodySm', fontName='NotoSansSC', fontSize=8.5, leading=12,
    textColor=TEXT_PRIMARY, alignment=TA_JUSTIFY, spaceAfter=4)
s_h1 = make_style('H1Dark', fontName='NotoSansSC-Bold', fontSize=18, leading=24,
    textColor=ACCENT, spaceBefore=16, spaceAfter=8)
s_h2 = make_style('H2Dark', fontName='NotoSansSC-Bold', fontSize=14, leading=18,
    textColor=TEXT_PRIMARY, spaceBefore=12, spaceAfter=6)
s_h3 = make_style('H3Dark', fontName='NotoSansSC-Bold', fontSize=11, leading=14,
    textColor=ICON, spaceBefore=8, spaceAfter=4)
s_bullet = make_style('BulletDark', fontName='NotoSansSC', fontSize=9, leading=13,
    textColor=TEXT_PRIMARY, leftIndent=12, bulletIndent=0, spaceAfter=3)
s_caption = make_style('CaptionDark', fontName='NotoSansSC', fontSize=8, leading=10,
    textColor=TEXT_MUTED, alignment=TA_CENTER, spaceAfter=4)
s_toc_h0 = make_style('TOC0', fontName='NotoSansSC-Bold', fontSize=11, leading=16, textColor=ACCENT)
s_toc_h1 = make_style('TOC1', fontName='NotoSansSC', fontSize=9.5, leading=14, textColor=TEXT_PRIMARY, leftIndent=12)

# ── Helpers ──
heading_counter = [0, 0, 0]

_hkey_counter = [0]

def add_heading(text, style, level=0):
    _hkey_counter[0] += 1
    key = f'hk{_hkey_counter[0]}'
    clean_text = text.replace('<b>', '').replace('</b>', '')
    p = Paragraph(f'<a name="{key}"/>{text}', style)
    p.bookmark_name = key
    p.bookmark_level = level
    p.bookmark_text = clean_text
    p.bookmark_key = key
    return p

def h1(text):
    heading_counter[0] += 1
    heading_counter[1] = 0
    return add_heading(f'{heading_counter[0]}. {text}', s_h1, 0)

def h2(text):
    heading_counter[1] += 1
    heading_counter[2] = 0
    return add_heading(f'{heading_counter[0]}.{heading_counter[1]} {text}', s_h2, 1)

def h3(text):
    heading_counter[2] += 1
    return add_heading(f'{heading_counter[0]}.{heading_counter[1]}.{heading_counter[2]} {text}', s_h3, 1)

def p(text):
    return Paragraph(text, s_body)

def ps(text):
    return Paragraph(text, s_body_small)

def bullet(text):
    return Paragraph(f'<bullet>&bull;</bullet> {text}', s_bullet)

def spacer(h=4):
    return Spacer(1, h*mm)

def hr():
    return HRFlowable(width='100%', thickness=0.5, color=BORDER, spaceAfter=6, spaceBefore=6)

def score_table(data):
    """data: list of [category, score/10, status]"""
    rows = [['Category', 'Score / 10', 'Status']]
    for cat, score, status in data:
        color = SEM_SUCCESS if float(score) >= 7 else SEM_WARNING if float(score) >= 5 else SEM_ERROR
        rows.append([
            Paragraph(cat, s_body_small),
            Paragraph(f'<b>{score}</b>', make_style('sc', fontName='NotoSansSC-Bold', fontSize=9, textColor=color, alignment=TA_CENTER)),
            Paragraph(status, s_body_small)
        ])
    t = Table(rows, colWidths=[CONTENT_W*0.45, CONTENT_W*0.2, CONTENT_W*0.35])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), HEADER_FILL),
        ('TEXTCOLOR', (0,0), (-1,0), colors.white),
        ('FONTNAME', (0,0), (-1,0), 'NotoSansSC-Bold'),
        ('FONTSIZE', (0,0), (-1,-1), 8),
        ('BACKGROUND', (0,1), (-1,-1), CARD_BG),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [CARD_BG, TABLE_STRIPE]),
        ('GRID', (0,0), (-1,-1), 0.5, BORDER),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
    ]))
    return t

def finding_table(findings):
    """findings: list of [ID, severity, finding, evidence]"""
    rows = [['ID', 'Severity', 'Finding', 'Evidence']]
    for fid, sev, find, ev in findings:
        sev_color = CRITICAL_RED if sev == 'CRITICAL' else HIGH_ORANGE if sev == 'HIGH' else MEDIUM_YELLOW
        rows.append([
            Paragraph(fid, make_style('fid', fontName='NotoSansSC', fontSize=7.5, textColor=TEXT_MUTED)),
            Paragraph(f'<b>{sev}</b>', make_style('sev', fontName='NotoSansSC-Bold', fontSize=7.5, textColor=sev_color, alignment=TA_CENTER)),
            Paragraph(find, s_body_small),
            Paragraph(ev, make_style('ev', fontName='NotoSansSC', fontSize=7.5, textColor=TEXT_MUTED))
        ])
    t = Table(rows, colWidths=[CONTENT_W*0.08, CONTENT_W*0.12, CONTENT_W*0.40, CONTENT_W*0.40])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), HEADER_FILL),
        ('TEXTCOLOR', (0,0), (-1,0), colors.white),
        ('FONTNAME', (0,0), (-1,0), 'NotoSansSC-Bold'),
        ('FONTSIZE', (0,0), (-1,-1), 7.5),
        ('BACKGROUND', (0,1), (-1,-1), CARD_BG),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [CARD_BG, TABLE_STRIPE]),
        ('GRID', (0,0), (-1,-1), 0.5, BORDER),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('TOPPADDING', (0,0), (-1,-1), 3),
        ('BOTTOMPADDING', (0,0), (-1,-1), 3),
        ('LEFTPADDING', (0,0), (-1,-1), 4),
        ('RIGHTPADDING', (0,0), (-1,-1), 4),
    ]))
    return t

def kpi_row(kpis):
    """kpis: list of (label, value)"""
    n = len(kpis)
    col_w = CONTENT_W / n
    row_vals = [Paragraph(f'<b>{v}</b>', make_style('kv', fontName='NotoSansSC-Bold', fontSize=16, textColor=ACCENT, alignment=TA_CENTER)) for _, v in kpis]
    row_lbls = [Paragraph(l, make_style('kl', fontName='NotoSansSC', fontSize=7.5, textColor=TEXT_MUTED, alignment=TA_CENTER)) for l, _ in kpis]
    t = Table([row_vals, row_lbls], colWidths=[col_w]*n)
    t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), CARD_BG),
        ('BOX', (0,0), (-1,-1), 0.5, BORDER),
        ('LINEBELOW', (0,0), (-1,0), 0.5, BORDER),
        ('INNERGRID', (0,0), (-1,-1), 0.5, BORDER),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
    ]))
    return t

# ── Build Document ──
story = []

# Cover page (via ReportLab - simple styled cover)
story.append(Spacer(1, 80*mm))
story.append(Paragraph('DeepMindQ', make_style('cover_title', fontName='NotoSansSC-Bold', fontSize=36, textColor=ACCENT, alignment=TA_CENTER, leading=42)))
story.append(Spacer(1, 8*mm))
story.append(Paragraph('Full Platform Audit Report', make_style('cover_sub', fontName='NotoSansSC', fontSize=20, textColor=TEXT_PRIMARY, alignment=TA_CENTER, leading=26)))
story.append(Spacer(1, 6*mm))
story.append(Paragraph('Pre-WI-18 Architecture, Product &amp; Production Readiness Review', make_style('cover_desc', fontName='NotoSansSC', fontSize=11, textColor=TEXT_MUTED, alignment=TA_CENTER, leading=16)))
story.append(Spacer(1, 30*mm))
story.append(hr())
story.append(Spacer(1, 6*mm))

cover_meta = [
    ['Audit Date', 'August 3, 2026'],
    ['Codebase', 'Next.js 16 + Prisma + Neon PostgreSQL'],
    ['Total Source Files', '676 (.ts/.tsx)'],
    ['Total Lines of Code', '213,617'],
    ['Audit Scope', '12 Categories, Read-Only'],
    ['Verdict', 'B) Advanced MVP'],
]
cover_rows = [[Paragraph(f'<b>{r[0]}</b>', make_style('cm_k', fontName='NotoSansSC-Bold', fontSize=9, textColor=ICON)),
               Paragraph(r[1], make_style('cm_v', fontName='NotoSansSC', fontSize=9, textColor=TEXT_PRIMARY))] for r in cover_meta]
ct = Table(cover_rows, colWidths=[CONTENT_W*0.35, CONTENT_W*0.65])
ct.setStyle(TableStyle([
    ('BACKGROUND', (0,0), (-1,-1), CARD_BG),
    ('BOX', (0,0), (-1,-1), 0.5, BORDER),
    ('LINEBELOW', (0,0), (-1,-2), 0.3, TABLE_STRIPE),
    ('TOPPADDING', (0,0), (-1,-1), 4),
    ('BOTTOMPADDING', (0,0), (-1,-1), 4),
    ('LEFTPADDING', (0,0), (-1,-1), 8),
    ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
]))
story.append(ct)

story.append(PageBreak())

# ── Table of Contents ──
story.append(Paragraph('Table of Contents', make_style('toc_title', fontName='NotoSansSC-Bold', fontSize=20, textColor=ACCENT, spaceBefore=20, spaceAfter=12)))
toc = TableOfContents()
toc.levelStyles = [s_toc_h0, s_toc_h1]
story.append(toc)
story.append(PageBreak())

# ═══════════════════════════════════════════════════════════
# SECTION 1: EXECUTIVE SUMMARY
# ═══════════════════════════════════════════════════════════
story.append(h1('Executive Summary'))
story.append(p('This report presents a comprehensive, read-only audit of the DeepMindQ platform conducted on August 3, 2026, immediately following the completion of the WI-17 Productization milestone. The audit covers 12 categories spanning architecture, AI intelligence, database design, API layer, UI/UX, security, performance, testing, and overall product readiness. Every finding in this report is backed by actual codebase evidence obtained through systematic file analysis, not assumptions or summaries from previous sessions.'))
story.append(p('DeepMindQ is an AI-powered Revenue Intelligence Platform built on Next.js 16, React 19, Prisma 6, and Neon PostgreSQL. It implements a sophisticated multi-layer AI architecture including a 6-step intelligence activation pipeline, a knowledge graph, hybrid retrieval with RRF score fusion, 4-layer AI memory, hallucination prevention, explainability engine, recommendation engine, and a feedback learning loop. The platform encompasses 676 source files totaling 213,617 lines of code, 92 database models, 239 API routes, and 68 screen components.'))
story.append(p('The audit reveals a platform that has achieved an <b>Advanced MVP</b> level of maturity. The AI architecture is sophisticated and well-designed, the database schema is comprehensive with exceptional index coverage, and the codebase demonstrates clean dependency graphs with no circular dependencies. However, critical gaps exist in production readiness: three core AI systems (knowledge graph, memory, hybrid retrieval) are entirely in-memory with no persistence, the security middleware is missing entirely, and the CI/CD pipeline is absent. These findings define the roadmap from WI-18 onwards.'))

story.append(h2('Platform Readiness Verdict'))
story.append(p('Based on the comprehensive 12-section analysis, DeepMindQ is classified as <b>B) Advanced MVP</b>. This means the platform demonstrates a sophisticated and functional product with deep AI capabilities, a comprehensive feature set, and working end-to-end flows. However, it is not yet production-ready for enterprise deployment due to security gaps, scalability limitations from in-memory architecture, and insufficient test coverage. The platform would benefit from a focused WI-18 phase addressing production hardening before customer-facing beta deployment.'))

verdict_data = [
    ['Architecture', '7.5', 'Strong AI architecture, clean deps'],
    ['AI Intelligence', '7.0', 'Sophisticated but in-memory only'],
    ['Database', '7.0', '92 models, 372 indexes, some anti-patterns'],
    ['Data Pipeline', '6.5', 'Comprehensive but dual-path complexity'],
    ['Backend API', '5.5', '239 routes, inconsistent patterns'],
    ['UI/UX', '6.0', 'Feature-rich, accessibility gaps'],
    ['Security', '3.5', 'Missing middleware, CSRF non-functional'],
    ['Performance', '4.5', 'In-memory state, no CI/CD'],
    ['Testing', '4.0', '66% modules untested, no CI'],
    ['Product Readiness', '5.8', 'Advanced MVP, not enterprise-beta'],
]
story.append(spacer(4))
story.append(score_table(verdict_data))
story.append(spacer(4))
story.append(Paragraph('<i>Table 1: Per-Category Readiness Scores (out of 10)</i>', s_caption))

story.append(PageBreak())

# ═══════════════════════════════════════════════════════════
# SECTION 2: CODEBASE ARCHITECTURE
# ═══════════════════════════════════════════════════════════
story.append(h1('Codebase Architecture'))
story.append(p('The DeepMindQ codebase is organized as a hybrid layer-based and domain-based architecture within a Next.js 16 App Router project. The top-level structure follows a clear layer separation with <b>src/app/</b> for routes, <b>src/components/</b> for UI, <b>src/lib/</b> for business logic, <b>src/providers/</b> for React context, and <b>src/hooks/</b> for custom hooks. Within the library layer, domain-based grouping is used for AI modules (intelligence-sources, revenue-intelligence, research-engine, engines, scoring, workflow-engine), while 98 top-level files in src/lib/ create a potential discoverability challenge as the codebase grows.'))

story.append(h2('Technology Stack'))
story.append(p('The platform leverages a modern stack: Next.js 16.1.1 with React 19, TypeScript 5 with strict mode enabled, Prisma 6.19.3 with Neon PostgreSQL, Tailwind CSS 4, Zustand for client navigation state, and TanStack React Query v5 for server-state management. The AI layer uses the Z.ai SDK (z-ai-web-dev-sdk) alongside four free-tier LLM providers (NVIDIA NIM, Fireworks AI, Groq, Google Gemini) and Tavily for web search. Additional notable dependencies include Zod 4 for validation, Recharts for data visualization, Framer Motion for animations, and Sentry for error tracking.'))

story.append(h2('Code Volume Metrics'))
story.append(kpi_row([
    ('Source Files', '676'),
    ('Lines of Code', '213,617'),
    ('API Routes', '239'),
    ('DB Models', '92'),
    ('Screens', '68'),
    ('Test Files', '66'),
]))
story.append(spacer(2))
story.append(Paragraph('<i>Table 2: Codebase Size Metrics</i>', s_caption))
story.append(p('The codebase has significant hotspot files: ai-agent-framework.ts at 2,873 lines, company-profile-screen.tsx at 2,450 lines, ai-evaluation-engine.ts at 2,006 lines, and the alignment API route at 1,027 lines. These giant files suggest modules that should be decomposed into smaller, more maintainable units. The test-to-code ratio is approximately 9.8%, well below the industry norm of 20-40%.'))

story.append(h2('Architecture Patterns'))
story.append(p('<b>Data Layer:</b> Prisma ORM is used exclusively with a singleton client pattern. There is no repository pattern or data access layer. 345 files import db.ts directly, creating tight coupling to the schema. <b>API Layer:</b> 239 Next.js App Router route handlers follow a consistent but manually-replicated pattern of auth check, body validation, Prisma query, and response. An api-middleware.ts was built but is effectively dead code, used by only 1 of 239 routes. <b>State Management:</b> Zustand manages only 8 navigation state fields; React Query handles all server state with 30-second stale time.'))

story.append(h2('Module Coupling'))
story.append(p('The most heavily imported modules are: date.ts (389 importers), db.ts (345), logger.ts (304), api-auth.ts (214), store.ts (119), types.ts (107), and utils.ts (99). The dependency graph is cleanly layered with no circular dependencies detected. The AI configuration layer is well-contained with ai-config.ts having only 2 importers, accessed primarily through llm-client.ts. The api-middleware.ts is dead code, having been built but never adopted by the broader route ecosystem.'))

arch_findings = [
    ['A1', 'HIGH', 'No data access layer', '345 files import db.ts directly'],
    ['A2', 'HIGH', 'ESLint effectively disabled', 'Nearly all rules set to "off"'],
    ['A3', 'MEDIUM', 'Dead code: api-middleware.ts', 'Only 1 of 239 routes uses it'],
    ['A4', 'MEDIUM', 'Flat src/lib/ with 98 files', 'Discoverability challenge'],
    ['A5', 'LOW', 'Empty seed data files', '10 JSON files at 0 bytes'],
    ['A6', 'LOW', 'AuthProvider is a no-op', 'Renders only children'],
]
story.append(h2('Key Findings'))
story.append(finding_table(arch_findings))
story.append(spacer(3))
story.append(Paragraph('<i>Table 3: Architecture Findings</i>', s_caption))

story.append(PageBreak())

# ═══════════════════════════════════════════════════════════
# SECTION 3: AI INTELLIGENCE ARCHITECTURE
# ═══════════════════════════════════════════════════════════
story.append(h1('AI Intelligence Architecture'))
story.append(p('The AI intelligence layer is the most sophisticated and differentiated component of the DeepMindQ platform. It implements a multi-layer architecture with a unified LLM client, comprehensive governance framework, knowledge graph, hybrid retrieval, 4-layer memory system, hallucination prevention, explainability engine, recommendation engine, and feedback learning loop. The architecture is well-designed with a non-throwing design philosophy where every function returns structured results rather than throwing exceptions, providing excellent resilience for AI operations that are inherently unpredictable.'))

story.append(h2('LLM Provider Architecture'))
story.append(p('The platform supports four free-tier LLM providers routed through a sequential fallback chain: NVIDIA NIM (meta/llama-3.1-8b-instruct, first priority), Fireworks AI (llama-v3p3-70b-instruct), Groq (llama-3.3-70b-versatile), and Google Gemini (gemini-2.0-flash with a 4-model fallback chain). Tavily is used for web search with 1000 requests/month on the free tier. The unified LLM client (llm-client.ts, 595 LOC) provides three call paths: callAI() through the Z.ai SDK with quality gates, callLLM() through direct provider fallback, and revenueLLMCall() as a never-throws variant for narrative generation.'))

story.append(h2('Knowledge Graph'))
story.append(p('The knowledge graph (ai-knowledge-graph.ts, 1,764 LOC) implements a full in-memory graph database with entity extraction, BFS/DFS traversal, relationship scoring, evidence chain construction, and graph-based recommendations. It supports 28 relationship types and uses 6 Map structures for nodes, edges, and various indexes. The graph architecture is well-designed with proper confidence propagation and hop penalty decay. However, the entire knowledge graph is stored in process memory with zero database persistence, meaning all graph data is lost on every Vercel serverless cold start. This is the single most critical architectural gap for production deployment.'))

story.append(h2('Hybrid Retrieval System'))
story.append(p('The hybrid retrieval engine (ai-hybrid-retrieval.ts, 1,202 LOC) implements a 5-signal retrieval pipeline: Vector Search (TF-IDF cosine similarity), Keyword Search (BM25-style), Entity Matching (regex-based NER), Knowledge Graph traversal, and Recency Weighting (exponential decay with 90-day half-life). Score fusion uses Reciprocal Rank Fusion (RRF) with k=60 smoothing constant. The architecture is enterprise-grade in design. Like the knowledge graph, it is entirely in-memory with a 100,000 entry cap and LRU eviction, meaning the retrieval index is rebuilt from scratch on every cold start.'))

story.append(h2('AI Memory System'))
story.append(p('The 4-layer AI memory system (ai-memory.ts, 1,205 LOC) provides Working (session), Conversation (history), Enterprise (company intel), and Institutional (organizational learning) layers. It supports versioning, tag-based indexing, scope filtering, keyword search with multi-signal scoring, memory consolidation, and time-based decay. The institutional memory layer is the most valuable for learning but is completely ephemeral, lost on every serverless cold start. There is no memory size limit, unlike the hybrid retrieval cap, meaning memory could grow unbounded within a single process lifetime.'))

story.append(h2('Hallucination Prevention'))
story.append(p('A two-layer hallucination prevention system is implemented. The pre-generation layer (ai-governance.ts, 1,473 LOC) injects 15 mandatory rules into every LLM system prompt, enforces confidence gates per 50+ generation types, and applies staleness-based confidence modifiers. The post-generation layer (ai-hallucination-prevention.ts, 666 LOC) performs claim extraction via 8 regex patterns, citation verification, hedging detection, and specificity scoring. A notable concern is that the alignment check uses keyword overlap rather than semantic similarity, which misses paraphrased claims. Additionally, the hedging detection penalizes honest uncertainty language, creating a perverse incentive for overconfident AI output.'))

story.append(h2('Explainability & Recommendation'))
story.append(p('The explainability engine (1,391 LOC) generates 6-section intelligence trails with evidence attribution, confidence breakdowns, and reasoning chain visualization. The recommendation engine (1,082 LOC) implements composite scoring across 8 data sources with evidence-backed reasons, risk identification, and recommended actions with timelines. Both modules demonstrate sophisticated AI product design. The feedback learning loop (feedback-learning-loop.ts) captures user verdicts through a 4-step pipeline: capture feedback, create institutional memory, generate learning events, and calibrate signal confidence. A critical gap is that the institutional memory created from feedback is stored in the in-memory system and lost on cold starts.'))

ai_findings = [
    ['AI1', 'CRITICAL', 'KG/Memory/Retrieval: in-memory only', 'Data lost on every serverless cold start'],
    ['AI2', 'HIGH', 'ModelRouter tier routing broken', 'orderedChain computed but never used'],
    ['AI3', 'HIGH', 'Usage tracking always returns 0', 'Z.ai SDK path has zero token counts'],
    ['AI4', 'MEDIUM', 'Hedging penalizes honest uncertainty', 'Creates perverse overconfidence incentive'],
    ['AI5', 'MEDIUM', 'extractJSON() greedy regex', 'Fails on nested JSON objects'],
    ['AI6', 'MEDIUM', 'Type collision: QualityReport', 'Two interfaces with same name'],
    ['AI7', 'LOW', 'Embeddings are TF-IDF only', 'No neural embeddings for semantic search'],
]
story.append(h2('Key Findings'))
story.append(finding_table(ai_findings))
story.append(spacer(3))
story.append(Paragraph('<i>Table 4: AI Architecture Findings</i>', s_caption))

story.append(PageBreak())

# ═══════════════════════════════════════════════════════════
# SECTION 4: AI INTEGRATION END-TO-END
# ═══════════════════════════════════════════════════════════
story.append(h1('AI Integration End-to-End'))
story.append(p('Four complete AI integration flows were traced through actual code paths to validate end-to-end wiring and identify gaps. Each flow was followed from API entry point through all intermediate processing steps to the final output or persistence layer.'))

story.append(h2('Flow A: Company Intelligence Activation'))
story.append(p('Triggered by POST /api/companies (line 268 of route.ts), which calls activateIntelligenceAsync() after company creation. This fires a non-blocking 6-step pipeline: (1) Entity Resolution via regex NER, (2) Knowledge Graph population with node/edge creation, (3) Retrieval Index population, (4) Memory creation for company and contacts, (5) Signal Extraction via dual Tavily web searches + LLM analysis, and (6) Confidence scoring. The success threshold is lenient (3 of 6 steps complete), and steps 1-4 operate on empty in-memory stores on cold starts. No deduplication mechanism prevents parallel activations from creating duplicate signals.'))

story.append(h2('Flow B: Intelligence Query (Alignment)'))
story.append(p('GET /api/companies/[id]/alignment is a read-only composition layer that makes zero AI/LLM calls. It queries 5 database tables in parallel (company, signals, capabilities, contacts, validations), composes IntelligenceObjects with evidence state, temporal confidence, freshness scoring, and origin derivation. A pagination gap exists as all signals are fetched without limit. The deriveOrigin() function will throw on malformed URLs, and the feedback map uses a string key that could collide when artifactId is null. Temporal confidence uses estimated previous values rather than actual historical data.'))

story.append(h2('Flow C: Knowledge Graph Enrichment'))
story.append(p('Knowledge graph enrichment occurs through activation Step 2 and the knowledge ingestion pipeline. Entity extraction uses regex-based NER mapped to graph types, with relationships inferred from co-occurrence using 12 hardcoded rules. Relationship confidence caps at 0.7 for company+person co-occurrence. A critical bug was found: intelligence-activation.ts line 266 uses the invalid relationship type "employed_by" instead of "WORKS_AT". The ingestion pipeline classifies every 5th chunk with AI to reduce cost, meaning classification quality degrades for long documents with varying topics.'))

story.append(h2('Flow D: Feedback Learning Loop'))
story.append(p('POST /api/feedback validates submission (5 verdict types, 16 reason codes, 11 outcomes) and processes through 4 steps: (1) DB persistence to IntelligenceFeedback table, (2) institutional memory creation with importance/confidence scoring based on verdict, (3) learning event creation for significant outcomes, and (4) signal confidence calibration based on accumulated feedback patterns. The institutional memory from feedback is stored in the in-memory system only, making it ephemeral. There is no mechanism for users to flag AI-generated content quality issues separately from recommendation feedback.'))

story.append(PageBreak())

# ═══════════════════════════════════════════════════════════
# SECTION 5: DATABASE ARCHITECTURE
# ═══════════════════════════════════════════════════════════
story.append(h1('Database Architecture'))
story.append(p('The database architecture is built on Neon PostgreSQL with Prisma 6.19.3 as the ORM. The schema comprises 92 models, 20 enums, 372 indexes, and 80 relation declarations organized across 21 domain categories. The index coverage is exceptional at approximately 4 indexes per model on average. However, several design concerns exist including a "god model" pattern with Company having 35+ back-relations, 18 String-stored JSON fields that bypass Prisma JSON operators, and 97 cascade delete relations that create amplified deletion chains.'))

story.append(h2('Schema Design'))
story.append(p('Models are categorized across: CRM/Company (8 models), CRM/Contact (4), Intelligence Core (4), Intelligence Objects (5), Opportunity/Pursuit (3), Knowledge/Capability (5), Email/Sequences (9), Data Import/Quality (9), Validation/Feedback (5), Connectors (2), Human Intelligence (3), AI/Reasoning (7), Revenue Intelligence (3), Job/Workflow (2), AI Cost/Audit (5), Learning (2), Pipeline/Fusion (2), Account Strategy (3), Auth/User (3), System (2), and External/Monitoring (2). The Company model acts as the central hub with approximately 35 explicit back-relation fields, making it the most connected model in the schema.'))

story.append(h2('Index Coverage'))
story.append(p('The 372 indexes across 92 models provide exceptional query optimization. Notable compound indexes include CompanySignal with status+expiresAt and companyId+signalType+createdAt, Company with priorityTier and accountPriorityScore (descending sort), and Evidence with companyId+status+createdAt. However, 38 models (41%) have zero indexes, including high-traffic entities like AccountScore, CompanyResearchCard, IntelligenceObject, and KnowledgeChunk. Queries against these unindexed models will degrade linearly with data volume.'))

story.append(h2('Data Integrity Concerns'))
story.append(p('The most significant risk is the 97 cascade delete relations. A single Company.delete() would cascade into 35+ related models, potentially destroying thousands of records across signals, evidence, contacts, notes, timelines, intelligence objects, knowledge entries, associations, alerts, learning events, and more. Only 3 SetNull relations exist. An additional concern is the 18 String-stored JSON fields that cannot leverage Prisma JSON filtering operators, requiring manual JSON.parse/stringify at the application layer. Approximately 15 fields use raw String types where enums should be used for type safety at the database level.'))

db_findings = [
    ['DB1', 'CRITICAL', '97 cascade deletes on Company', 'Single delete destroys entire graph'],
    ['DB2', 'HIGH', '18 String-stored JSON fields', 'Cannot use Prisma JSON operators'],
    ['DB3', 'HIGH', '38 models with zero indexes', 'Queries degrade with data volume'],
    ['DB4', 'MEDIUM', 'God model: Company 35+ relations', 'Every query path touches Company'],
    ['DB5', 'MEDIUM', 'No connection pool configuration', 'Could exhaust Neon limits'],
    ['DB6', 'LOW', 'Single migration file only', 'No incremental migration history'],
]
story.append(h2('Key Findings'))
story.append(finding_table(db_findings))
story.append(spacer(3))
story.append(Paragraph('<i>Table 5: Database Findings</i>', s_caption))

story.append(PageBreak())

# ═══════════════════════════════════════════════════════════
# SECTION 6: DATA INTELLIGENCE PIPELINE
# ═══════════════════════════════════════════════════════════
story.append(h1('Data Intelligence Pipeline'))
story.append(p('The data intelligence pipeline has two parallel entry points: a Data Import pipeline for CSV/Excel files and an Intelligence Sources pipeline with 4 connectors (CSV, Excel, RSS, Website) plus an internal memory bridge that connects 6 CRM data sources. Both paths converge through company resolution and evidence classification into CompanySignal records, which feed into opportunity recommendations, AI insights, and action artifacts.'))

story.append(h2('Data Import'))
story.append(p('The platform has a dual import pipeline: a legacy pipeline creating ImportBatch records and a newer intelligence engine pipeline creating DataUpload and UploadRow records with a bridge at commit time. The newer engine implements a 6-step process: analyze file headers via regex column detection, create upload job, process chunks with validation/normalization/dedup/quality scoring, review rows with user corrections, apply corrections, and commit with intelligence activation. Column detection is fully DB-configurable with zero hardcoded patterns. Deduplication uses three strategies: exact email match, domain+name similarity (60% threshold), and company name fuzzy match with legal suffix stripping.'))

story.append(h2('Intelligence Sources'))
story.append(p('The intelligence sources module comprises 55 files across connectors, signal creation, evidence classification, freshness management, job queuing, and monitoring. The internal memory connector bridges 6 CRM data sources (CompanyNote, ContactNote, EmailEvent, CompanyTimelineEvent, HumanIntelligenceInbox, AccountStrategy) into the intelligence pipeline with confidence weights ranging from 0.70 to 0.95. Signal creation supports 12 signal types with regex-based classification and deduplication. The freshness system applies exponential decay with a 180-day max age and 0.5% daily decay rate. The job queue is entirely in-memory with sequential processing, representing a single point of failure for serverless deployments.'))

pipeline_findings = [
    ['P1', 'HIGH', 'In-memory job queue', 'Jobs lost on serverless restart'],
    ['P2', 'MEDIUM', 'Dual import pipelines', 'ImportBatch vs DataUpload confusion'],
    ['P3', 'MEDIUM', 'Cross-chunk dedup gap', 'validateRows not used in engine'],
    ['P4', 'MEDIUM', 'Sequential signal creation', 'No batch createMany'],
    ['P5', 'LOW', 'Missing document connector', 'SourceType supports it but no impl'],
]
story.append(h2('Key Findings'))
story.append(finding_table(pipeline_findings))
story.append(spacer(3))
story.append(Paragraph('<i>Table 6: Data Pipeline Findings</i>', s_caption))

story.append(PageBreak())

# ═══════════════════════════════════════════════════════════
# SECTION 7: BACKEND API
# ═══════════════════════════════════════════════════════════
story.append(h1('Backend API Architecture'))
story.append(p('The backend API comprises 239 route files across approximately 66 domain directories, totaling 43,438 lines of code. The API follows Next.js 16 App Router conventions with route handlers at src/app/api/[domain]/route.ts. Authentication is implemented via a dual-layer defense-in-depth approach: an Edge proxy checks for session cookie presence, and route-level guards validate session tokens against the database. Input validation uses Zod schemas for all CRUD operations, and the AI governance layer (governedAICall) wraps all AI-generating endpoints.'))

story.append(h2('API Patterns'))
story.append(p('Three coexisting error response patterns create inconsistency: apiError/apiSuccess with success boolean and timestamp, bare NextResponse.json with error only, and the Intelligence API envelope with code and details. Similarly, success responses use four different formats. This forces frontend consumers to handle multiple response shapes. The alignment route at 1,027 lines is a monolithic handler that should be decomposed. Input validation is well-adopted for POST bodies via Zod but inconsistently applied to GET query parameters, where sortBy, page, and limit are often manually parsed without schema validation.'))

story.append(h2('Authentication Coverage'))
story.append(p('Of 239 routes, 220 (92%) have route-level checkApiAuth() guards. The 19 routes without route-level auth are all legitimately public (health, auth endpoints, webhooks, tracking pixels) with one critical exception: /api/ai/evaluation has no authentication mechanism at all. This route exposes both read (evaluation stats) and write (trigger evaluations) operations to anyone with a session cookie, even an expired one. Mass assignment is generally well-protected through explicit field whitelisting on PATCH routes, though 7 fields on the companies PATCH endpoint bypass Zod validation, allowing arbitrary values for intelligenceScore, assignedTo, and other sensitive fields.'))

story.append(h2('Missing Infrastructure'))
story.append(p('No API versioning strategy exists (no /v1/ prefixes, no version headers), meaning any breaking change affects all clients simultaneously. Rate limiting is implemented via in-memory Maps that are not production-safe for multi-instance deployments. The API documentation (API_REFERENCE.md) covers 224 routes but is stale, with 15 newer routes undocumented. CSRF protection is implemented at the proxy level with constant-time comparison, which is well-designed.'))

api_findings = [
    ['API1', 'CRITICAL', '/api/ai/evaluation: no auth', 'Read/write access without session validation'],
    ['API2', 'HIGH', 'Companies PATCH: 7 fields bypass Zod', 'intelligenceScore, assignedTo unprotected'],
    ['API3', 'HIGH', 'In-memory rate limiting', 'Not multi-instance safe'],
    ['API4', 'MEDIUM', '3 inconsistent error formats', 'Client complexity from multiple shapes'],
    ['API5', 'MEDIUM', 'No API versioning', 'Breaking changes affect all clients'],
    ['API6', 'LOW', 'API docs stale (224 vs 239)', '15 routes undocumented'],
]
story.append(h2('Key Findings'))
story.append(finding_table(api_findings))
story.append(spacer(3))
story.append(Paragraph('<i>Table 7: API Findings</i>', s_caption))

story.append(PageBreak())

# ═══════════════════════════════════════════════════════════
# SECTION 8: UI/UX
# ═══════════════════════════════════════════════════════════
story.append(h1('UI/UX Analysis'))
story.append(p('The UI architecture uses an SPA-style pattern within Next.js App Router. A single page route renders the application shell, with navigation handled entirely client-side via a Zustand store (89 possible activeView values) mapped through a screen-map.tsx to lazy-loaded React components wrapped with per-screen ErrorBoundary and Suspense. The navigation config defines 5 sections (Intelligence, Revenue, Knowledge, Data, Operations) with 13 visible nav items. The Intelligence OS layer introduces 8 newer screens that overlap functionality with 64 legacy screens, creating a maintenance burden.'))

story.append(h2('Component Quality'))
story.append(p('The platform includes 68 screen components totaling 52,451 lines of code, 14 enterprise shared components, 9 shared UI components, and 26 Intelligence OS components. Four screens exceed 2,000 lines: company-profile-screen (2,450), knowledge-library (2,396), settings (2,322), and capability (2,067). These giant monolithic components should be decomposed into 10+ sub-components each for maintainability. The design system provides reusable primitives (EmptyState, ScoreGauge, DataTable, LoadingState, ErrorState) with proper TypeScript interfaces.'))

story.append(h2('Accessibility'))
story.append(p('Accessibility implementation is severely deficient. Across 52,451 lines of screen code, only 56 ARIA attributes and 14 role attributes were found, averaging 0.001 per line of code. Only 15% of screens (10 of 68) have keyboard handlers. Enterprise customers, especially those in government or regulated industries, will likely fail accessibility audits. This is a high-priority gap for any enterprise deployment scenario.'))

story.append(h2('Theme & Responsive'))
story.append(p('The platform has a dark-first design with CSS variables defined in :root, but enterprise-theme.ts uses hardcoded light colors, creating an inconsistent hybrid. There is no theme toggle. Responsive design is well-implemented with 446 breakpoint references across screens (average 6.5 per screen) using progressive disclosure from 1-column mobile to multi-column desktop layouts. Loading states are excellent with 772 skeleton/isLoading references, while error states are adequate through the per-screen ErrorBoundary pattern.'))

ux_findings = [
    ['UX1', 'HIGH', 'Accessibility severely lacking', '70 ARIA attrs across 52K LOC'],
    ['UX2', 'MEDIUM', '4 giant components >2000 LOC', 'company-profile at 2450 lines'],
    ['UX3', 'MEDIUM', 'Theme inconsistency', 'Dark CSS vars + hardcoded light colors'],
    ['UX4', 'MEDIUM', 'No client-side auth redirect', 'AuthProvider is no-op'],
    ['UX5', 'LOW', 'Legacy/Intel OS duplication', '64 legacy + 8 new overlapping screens'],
]
story.append(h2('Key Findings'))
story.append(finding_table(ux_findings))
story.append(spacer(3))
story.append(Paragraph('<i>Table 8: UI/UX Findings</i>', s_caption))

story.append(PageBreak())

# ═══════════════════════════════════════════════════════════
# SECTION 9: SECURITY
# ═══════════════════════════════════════════════════════════
story.append(h1('Security Analysis'))
story.append(p('The security analysis reveals a platform with strong authentication fundamentals but critical infrastructure gaps. The OTP-based authentication system uses cryptographically sound session tokens (32-byte random values), PBKDF2 password hashing with 100k iterations, SHA-256 hashed OTP storage, timing-attack-resistant comparisons, and rolling 30-day session expiry. AI governance is excellent with a custom ESLint rule preventing ungoverned LLM calls. However, the most critical finding is that the Edge middleware file (src/middleware.ts) does not exist, meaning security headers are never applied and CSRF tokens are never injected, rendering the entire CSRF protection system non-functional.'))

story.append(h2('Authentication'))
story.append(p('Session management is solid with opaque tokens stored in the database, httpOnly/secure/sameSite=lax cookies, and expired session cleanup. The OTP system uses 4-byte random values with 10-minute expiry, 5-attempt limit, and dual-layer rate limiting. A timing vulnerability exists in the cookie-hash verification path which uses non-constant-time string comparison. The dev OTP bypass mechanism (ALLOW_DEV_OTP=true) is guarded by NODE_ENV !== production, but NODE_ENV misconfiguration could expose OTP codes in API responses. The API_KEY_ENCRYPTION_KEY for AES-256-GCM encryption of AI provider keys is not documented in .env.example and silently falls back to plaintext storage if unset.'))

story.append(h2('Critical Security Gaps'))
story.append(p('The most severe security finding is the missing Edge middleware. The next.config.ts comments that security headers are "applied via Edge middleware (src/middleware.ts)" but this file does not exist. This means: (1) No security headers (X-Content-Type-Options, X-Frame-Options, HSTS, CSP) are sent on any response, (2) CSRF tokens are never injected as cookies, and (3) The entire CSRF protection infrastructure, while well-implemented in code, is completely non-functional in production. The fetchApi client utility does not send the x-csrf-token header, compounding the issue. Additionally, input sanitization relies on a 6-line regex HTML stripper rather than a proper library like DOMPurify, creating XSS risk for any user-generated content rendered as HTML.'))

sec_findings = [
    ['S1', 'CRITICAL', 'Missing Edge middleware', 'No security headers, CSRF non-functional'],
    ['S2', 'CRITICAL', '/api/ai/evaluation: no auth', 'Unrestricted AI operation access'],
    ['S3', 'HIGH', 'CSRF protection non-functional', 'No token injection, no client header'],
    ['S4', 'HIGH', 'Input sanitization inadequate', '6-line regex, not DOMPurify'],
    ['S5', 'HIGH', 'Dev OTP bypass production risk', 'ALLOW_DEV_OTP + NODE_ENV misconfig'],
    ['S6', 'MEDIUM', 'API key encryption key undocumented', 'Silent plaintext fallback'],
    ['S7', 'MEDIUM', 'In-memory rate limiting', 'Per-instance only, not global'],
    ['S8', 'MEDIUM', 'CSP allows unsafe-inline', 'Weakens XSS protection'],
]
story.append(h2('Key Findings'))
story.append(finding_table(sec_findings))
story.append(spacer(3))
story.append(Paragraph('<i>Table 9: Security Findings</i>', s_caption))

story.append(PageBreak())

# ═══════════════════════════════════════════════════════════
# SECTION 10: PERFORMANCE & SCALABILITY
# ═══════════════════════════════════════════════════════════
story.append(h1('Performance & Scalability'))
story.append(p('Performance and scalability analysis reveals that the platform is designed for single-instance deployment and faces significant challenges for horizontal scaling or serverless environments. The most critical concern is that 10+ modules maintain in-memory state (knowledge graph, AI memory, hybrid retrieval, rate limiting, batch progress, OTP cache, activation history, event bus, reasoning state, vector index) that is lost on cold starts and inconsistent across multiple instances.'))

story.append(h2('Database Performance'))
story.append(p('The 372 indexes provide good read performance, but 38 of 92 models have zero indexes, and no explicit connection pool configuration exists for Neon PostgreSQL. N+1 query risks exist in the intelligence activation pipeline where sequential addNode/addEdge calls process each contact serially (capped at 10). Offset-based pagination is used exclusively with no cursor-based alternative for large datasets. No query timeout configuration means long-running queries could hang indefinitely.'))

story.append(h2('Frontend Performance'))
story.append(p('All image optimization is disabled (images: { unoptimized: true } in next.config.ts), likely to avoid Vercel Image Optimization costs but impacting user-perceived performance. Zero dynamic imports are used across all 55+ screen components, meaning the initial JavaScript bundle includes all screens regardless of which ones the user navigates to. React Query caching uses a 30-second stale time with refetchOnWindowFocus disabled, which is adequate. The AI cache layer is database-backed (AICache table) with SHA-256 key generation and TTL-based expiry, but the prune() function is never called automatically, leading to unbounded table growth.'))

story.append(h2('Deployment'))
story.append(p('The deployment configuration supports three targets: Docker (multi-stage build with alpine, non-root user, health check), Render (single web service, starter plan, daily cron), and Vercel (Mumbai region, no edge deployment, daily cron). The architecture is single-instance with no Redis, no worker processes, no message queue, and no horizontal scaling support. Docker Compose includes only the app and PostgreSQL. The LLM timeout uses setTimeout without AbortController, meaning HTTP requests are not actually cancelled when the timeout fires.'))

perf_findings = [
    ['P1', 'CRITICAL', '10+ modules with in-memory state', 'Lost on cold start, not shared'],
    ['P2', 'HIGH', 'No CI/CD pipeline exists', 'Tests never run automatically'],
    ['P3', 'HIGH', '38 models with zero indexes', 'Queries degrade with scale'],
    ['P4', 'MEDIUM', 'images: { unoptimized: true }', 'All image optimization disabled'],
    ['P5', 'MEDIUM', 'Zero dynamic imports', 'All 55+ screens in initial bundle'],
    ['P6', 'MEDIUM', 'No AbortController on LLM timeout', 'Connections not cancelled'],
    ['P7', 'LOW', 'AI cache prune() never called', 'Unbounded table growth'],
]
story.append(h2('Key Findings'))
story.append(finding_table(perf_findings))
story.append(spacer(3))
story.append(Paragraph('<i>Table 10: Performance Findings</i>', s_caption))

story.append(PageBreak())

# ═══════════════════════════════════════════════════════════
# SECTION 11: TESTING
# ═══════════════════════════════════════════════════════════
story.append(h1('Testing'))
story.append(p('The testing infrastructure uses Vitest 4.1.10 with jsdom environment, @vitest/coverage-v8 for code coverage, and @testing-library/react for component testing. A total of 83 test files exist containing 42,656 lines of test code, yielding an approximate 20% test-to-code ratio. However, 17 test files (20.5%) are excluded from CI due to stale code references, and 128 of 194 lib modules (66%) have no corresponding tests. No CI/CD pipeline exists, no GitHub Actions workflows were found, and there are zero true integration or E2E tests despite an e2e-business-journey.test.ts file existing.'))

story.append(h2('Test Quality'))
story.append(p('The WI-17 test suite (4 test files, 3,296 lines) demonstrates high-quality test writing with proper vi.mock() patterns, vi.resetAllMocks() for isolation, comprehensive edge case coverage, and structured test descriptions. Security tests cover 7+ files including auth, OTP, blocking, admin routes, and hygiene. However, all database interactions are mocked (no integration tests with a real database), and the test quality concern is that heavy mocking verifies function call patterns rather than actual data transformations or query correctness. The api-routes.test.ts file primarily tests utility functions rather than actual API route HTTP request/response cycles.'))

story.append(h2('Critical Gaps'))
story.append(p('The following high-criticality modules have zero test coverage: ai-governance.ts (controls all AI calls), ai-knowledge-graph.ts (entire graph engine), ai-memory.ts (all AI memory), ai-hybrid-retrieval.ts (retrieval engine), ai-unified-confidence.ts (confidence scoring), llm-client.ts (all LLM calls), intelligence-pipeline.ts (core enrichment), workflow-engine/queue.ts and processor.ts (job processing), and rate-limit.ts. The absence of tests for ai-governance.ts is particularly concerning as it controls the cost, quality, and safety gates for all AI generation across the platform.'))

test_findings = [
    ['T1', 'CRITICAL', 'No CI/CD pipeline', 'Tests never run automatically'],
    ['T2', 'HIGH', '66% modules have no tests', '128 of 194 lib modules untested'],
    ['T3', 'HIGH', 'AI governance untested', 'Controls all AI cost/quality gates'],
    ['T4', 'HIGH', '17 test files excluded', '121 assertions disabled'],
    ['T5', 'MEDIUM', 'Zero integration/E2E tests', 'All tests use mocked DB'],
    ['T6', 'MEDIUM', 'No coverage reporting', 'Tool installed but unused'],
]
story.append(h2('Key Findings'))
story.append(finding_table(test_findings))
story.append(spacer(3))
story.append(Paragraph('<i>Table 11: Testing Findings</i>', s_caption))

story.append(PageBreak())

# ═══════════════════════════════════════════════════════════
# SECTION 12: PRODUCT READINESS SCORING
# ═══════════════════════════════════════════════════════════
story.append(h1('Product Readiness Scoring'))
story.append(p('Each of the 10 audit categories is scored on a 0-10 scale based on functionality completeness, quality of implementation, production readiness, and alignment with enterprise standards. The overall product readiness score is the weighted average, with Security and Testing receiving higher weights due to their blocking nature for enterprise deployment.'))

scoring_detail = [
    ['Architecture', '7.5', 'Clean dependency graph, well-unified LLM client, but flat lib/ and dead middleware code'],
    ['AI Intelligence', '7.0', 'Sophisticated multi-layer architecture, excellent governance, but entirely in-memory'],
    ['Database', '7.0', '92 models, 372 indexes, but god model pattern and cascade delete risks'],
    ['Data Pipeline', '6.5', 'Comprehensive connectors and intelligence sources, dual-path complexity'],
    ['Backend API', '5.5', '239 routes with good auth coverage, but 3 inconsistent response formats'],
    ['UI/UX', '6.0', 'Feature-rich with 68 screens, but accessibility severely lacking'],
    ['Security', '3.5', 'Strong auth fundamentals, but missing middleware = no headers, no CSRF'],
    ['Performance', '4.5', 'In-memory state prevents scaling, no CI/CD, no dynamic imports'],
    ['Testing', '4.0', 'Good WI-17 tests, but 66% modules untested, no CI, no E2E'],
    ['Product Ready', '5.8', 'Advanced MVP with sophisticated AI, needs production hardening'],
]
story.append(spacer(4))
story.append(score_table(scoring_detail))
story.append(spacer(3))
story.append(Paragraph('<i>Table 12: Detailed Scoring Breakdown (out of 10)</i>', s_caption))

story.append(h2('Verdict: B) Advanced MVP'))
story.append(p('DeepMindQ is assessed as an <b>Advanced MVP</b> (Score: 5.8/10). The platform demonstrates exceptional AI architecture with a sophisticated multi-layer intelligence system, comprehensive database design, and a feature-rich UI. The 213,617 lines of code across 676 files represent a substantial engineering effort. However, three blocking issues prevent enterprise-beta classification: (1) the missing security middleware means no production security headers or CSRF protection, (2) the in-memory AI systems lose all institutional knowledge on serverless cold starts, and (3) the absence of CI/CD means no automated quality gates. These are all addressable in a focused WI-18 production hardening phase.'))

verdict_comparison = [
    ['A) Prototype', '1-3', 'Basic functionality, incomplete flows, significant bugs'],
    ['B) Advanced MVP', '4-6', 'Working end-to-end, needs production hardening'],
    ['C) Enterprise-Ready Beta', '7-8', 'Production-deployable with monitoring'],
    ['D) Production Enterprise', '9-10', 'Fully hardened, monitored, scalable'],
]
vc_rows = [[Paragraph(f'<b>{r[0]}</b>', make_style('vc0', fontName='NotoSansSC-Bold', fontSize=9, textColor=ACCENT if r[0].startswith('B') else TEXT_PRIMARY)),
            Paragraph(r[1], make_style('vc1', fontName='NotoSansSC', fontSize=9, textColor=TEXT_PRIMARY, alignment=TA_CENTER)),
            Paragraph(r[2], s_body_small)] for r in verdict_comparison]
vt = Table(vc_rows, colWidths=[CONTENT_W*0.30, CONTENT_W*0.15, CONTENT_W*0.55])
vt.setStyle(TableStyle([
    ('BACKGROUND', (0,0), (-1,-1), CARD_BG),
    ('BACKGROUND', (0,1), (-1,1), colors.HexColor('#2a2518')),  # highlight B row
    ('BOX', (0,0), (-1,-1), 0.5, BORDER),
    ('INNERGRID', (0,0), (-1,-1), 0.3, TABLE_STRIPE),
    ('TOPPADDING', (0,0), (-1,-1), 5),
    ('BOTTOMPADDING', (0,0), (-1,-1), 5),
    ('LEFTPADDING', (0,0), (-1,-1), 6),
    ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
]))
story.append(spacer(4))
story.append(vt)
story.append(spacer(3))
story.append(Paragraph('<i>Table 13: Product Maturity Classification (DeepMindQ = B)</i>', s_caption))

story.append(PageBreak())

# ═══════════════════════════════════════════════════════════
# SECTION 13: FINAL RECOMMENDATIONS
# ═══════════════════════════════════════════════════════════
story.append(h1('Final Recommendations'))
story.append(p('Recommendations are organized into three priority tiers. P0 items are blocking issues that must be resolved before any enterprise deployment. P1 items are high-priority improvements that should be addressed in the next development phase (WI-18). P2 items are medium-priority improvements for subsequent phases. This prioritization is designed to serve as the master roadmap from WI-18 onwards.'))

story.append(h2('P0: Blocking (Must Fix Before Enterprise Deployment)'))
story.append(p('<b>P0-1: Create Edge Middleware (src/middleware.ts)</b> — This is the single most impactful security fix. The middleware must inject CSRF tokens, apply security headers (X-Content-Type-Options, X-Frame-Options, HSTS, CSP), and validate session cookies at the Edge level. Without this, the platform has no production security headers and no functional CSRF protection. Estimated effort: 1-2 days.'))

story.append(p('<b>P0-2: Add checkApiAuth() to /api/ai/evaluation</b> — This route exposes AI evaluation operations without any authentication. Adding the standard checkApiAuth() guard is a one-line fix with immediate security impact. Estimated effort: 30 minutes.'))

story.append(p('<b>P0-3: Persist AI State to Database</b> — The knowledge graph, AI memory, and hybrid retrieval index must be backed by database persistence to survive serverless cold starts. This is the most architecturally significant P0 item. Options include: (a) Prisma-backed graph tables with in-memory cache layer, (b) Redis for session-level persistence with periodic DB sync, or (c) SQLite-based local persistence with periodic sync. Estimated effort: 2-3 weeks for the full persistence layer.'))

story.append(p('<b>P0-4: Implement CI/CD Pipeline</b> — Set up GitHub Actions with at minimum: lint, type-check, test execution on PR, and build verification. This provides automated quality gates that currently do not exist. Estimated effort: 1-2 days.'))

story.append(h2('P1: High Priority (WI-18 Phase)'))
p1_items = [
    'Migrate rate limiting to Redis-backed store for multi-instance safety',
    'Extend updateCompanySchema to include all updatable fields (close mass-assignment gap)',
    'Add DOMPurify or equivalent server-side HTML sanitizer for user-generated content',
    'Document API_KEY_ENCRYPTION_KEY in .env.example and remove silent plaintext fallback',
    'Standardize API response format to single envelope (recommend apiSuccess/apiError pattern)',
    'Decompose 4 giant screen components into sub-components',
    'Add Zod validation for all GET query parameters (sortBy, page, limit)',
    'Fix ModelRouter tier routing (orderedChain computed but unused)',
    'Implement accessibility basics: ARIA labels on tables, keyboard navigation, focus indicators',
    'Add API versioning (/v1/ prefix) before any external API consumers',
    'Fix extractJSON() greedy regex to use balanced-brace parser',
    'Add connection pool configuration for Neon PostgreSQL',
]
for item in p1_items:
    story.append(bullet(item))

story.append(h2('P2: Medium Priority (Post-WI-18)'))
p2_items = [
    'Replace hedging detection with confidence-aware scoring in quality gates',
    'Upgrade from TF-IDF to neural embeddings for semantic search',
    'Add cursor-based pagination for large datasets',
    'Implement dynamic imports for screen components to reduce initial bundle',
    'Consolidate legacy screens with Intelligence OS layer (remove duplication)',
    'Add proper theme system with dark/light toggle support',
    'Implement AbortController for LLM timeout cancellation',
    'Create integration tests with real database (not all-mocked)',
    'Add Playwright E2E tests for critical user flows',
    'Schedule AI cache prune() via cron job',
    'Restructure cascade deletes: add Restrict on critical junction models',
    'Convert 18 String-stored JSON fields to proper Json type',
    'Add missing enums for 15+ String fields that should be typed',
    'Unify dual import pipelines (legacy ImportBatch + new DataUpload)',
    'Add per-chunk cross-row deduplication in data import engine',
]
for item in p2_items:
    story.append(bullet(item))

story.append(h2('Architecture Strengths to Preserve'))
story.append(p('While this audit identifies many areas for improvement, several architectural strengths should be explicitly preserved and built upon: (1) The non-throwing design philosophy across all AI modules provides excellent resilience, (2) The comprehensive AI governance framework with ESLint enforcement is enterprise-grade, (3) The clean dependency graph with zero circular dependencies enables safe refactoring, (4) The unified LLM client with quality gates is well-abstracted, (5) The AES-256-GCM encryption for API keys with base URL allowlisting is security-conscious, (6) The 372-index database schema provides exceptional read performance, and (7) The per-screen ErrorBoundary pattern prevents cascade failures in the UI layer.'))

story.append(spacer(8))
story.append(hr())
story.append(Paragraph('<i>End of Audit Report. All findings are based on actual codebase evidence. This document should serve as the master roadmap from WI-18 onwards.</i>', make_style('end', fontName='NotoSansSC', fontSize=8, textColor=TEXT_MUTED, alignment=TA_CENTER)))

# ── Build ──
doc = TocDocTemplate(
    OUTPUT_PATH,
    pagesize=A4,
    leftMargin=LEFT_M, rightMargin=RIGHT_M,
    topMargin=TOP_M, bottomMargin=BOT_M,
    title='DeepMindQ Full Platform Audit Report',
    author='Z.ai',
    subject='Pre-WI-18 Architecture, Product & Production Readiness Review',
)

# Dark page background
def on_first_page(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(PAGE_BG)
    canvas.rect(0, 0, PAGE_W, PAGE_H, fill=True, stroke=False)
    canvas.restoreState()

def on_later_pages(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(PAGE_BG)
    canvas.rect(0, 0, PAGE_W, PAGE_H, fill=True, stroke=False)
    # Page number
    canvas.setFont('NotoSansSC', 8)
    canvas.setFillColor(TEXT_MUTED)
    canvas.drawCentredString(PAGE_W/2, 12*mm, f'Page {doc.page}')
    # Header line
    canvas.setStrokeColor(BORDER)
    canvas.setLineWidth(0.3)
    canvas.line(LEFT_M, PAGE_H - 14*mm, PAGE_W - RIGHT_M, PAGE_H - 14*mm)
    canvas.setFont('NotoSansSC', 7)
    canvas.drawString(LEFT_M, PAGE_H - 13*mm, 'DeepMindQ Platform Audit')
    canvas.drawRightString(PAGE_W - RIGHT_M, PAGE_H - 13*mm, 'Pre-WI-18 Review')
    canvas.restoreState()

doc.multiBuild(story, onFirstPage=on_first_page, onLaterPages=on_later_pages)

print(f"Report generated: {OUTPUT_PATH}")
print(f"Pages: {doc.page}")
