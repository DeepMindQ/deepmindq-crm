#!/usr/bin/env python3
"""
DeepMindQ M5 Enterprise Readiness Audit - Updated 5-Lens Framework
Generates comprehensive audit PDF: Capability Matrix, Gap Matrix, Transformation Roadmap
"""

import os, sys, hashlib, json
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm, cm, inch
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY, TA_RIGHT
from reportlab.lib import colors
from reportlab.platypus import (
    Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether, HRFlowable
)
from reportlab.platypus.tableofcontents import TableOfContents
from reportlab.platypus import SimpleDocTemplate
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase.pdfmetrics import registerFontFamily

# ━━ PATHS ━━
PDF_SKILL_DIR = '/home/z/my-project/skills/pdf'
SCRIPTS_DIR = '/home/z/my-project/scripts'
DOWNLOAD_DIR = '/home/z/my-project/download'
FONT_DIR = '/usr/share/fonts'
OUTPUT_PDF = os.path.join(DOWNLOAD_DIR, 'DeepMindQ_M5_Enterprise_Readiness_Audit_5Lens.pdf')
COVER_HTML = os.path.join(SCRIPTS_DIR, 'm5-audit-cover.html')
COVER_PDF = os.path.join(SCRIPTS_DIR, 'm5-audit-cover.pdf')

# ━━ CASCADE PALETTE ━━
PAGE_BG       = colors.HexColor('#f5f5f4')
SECTION_BG    = colors.HexColor('#f2f2f0')
CARD_BG       = colors.HexColor('#eae9e6')
TABLE_STRIPE  = colors.HexColor('#f2f2ef')
HEADER_FILL   = colors.HexColor('#534a2f')
COVER_BLOCK   = colors.HexColor('#696046')
BORDER        = colors.HexColor('#c7bea3')
ICON          = colors.HexColor('#7d6c3b')
ACCENT        = colors.HexColor('#a9892b')
ACCENT_2      = colors.HexColor('#5b37c8')
TEXT_PRIMARY   = colors.HexColor('#21201e')
TEXT_MUTED     = colors.HexColor('#84827a')
SEM_SUCCESS   = colors.HexColor('#4a7d5b')
SEM_WARNING   = colors.HexColor('#a68646')
SEM_ERROR     = colors.HexColor('#9d4c44')
SEM_INFO      = colors.HexColor('#3f6891')

# ━━ FONT SETUP ━━
pdfmetrics.registerFont(TTFont('NotoSerifSC', f'{FONT_DIR}/truetype/noto-serif-sc/NotoSerifSC-Regular.ttf'))
pdfmetrics.registerFont(TTFont('NotoSerifSC-Bold', f'{FONT_DIR}/truetype/noto-serif-sc/NotoSerifSC-Bold.ttf'))
pdfmetrics.registerFont(TTFont('DejaVuSans', f'{FONT_DIR}/truetype/dejavu/DejaVuSans.ttf'))
pdfmetrics.registerFont(TTFont('DejaVuSans-Bold', f'{FONT_DIR}/truetype/dejavu/DejaVuSans-Bold.ttf'))
# No italic needed for DejaVuSans
registerFontFamily('NotoSerifSC', normal='NotoSerifSC', bold='NotoSerifSC-Bold')
registerFontFamily('DejaVuSans', normal='DejaVuSans', bold='DejaVuSans-Bold')

# ━━ FALLBACK FOR MIXED CJK/LATIN ━━
from reportlab.pdfbase.ttfonts import TTFont as _TTF
_originalParagraph = None

def install_font_fallback():
    """Monkey-patch Paragraph to wrap missing glyphs in <font> tags."""
    pass  # ReportLab handles this at a lower level with registered fonts

# ━━ STYLES ━━
def make_styles():
    s = {}
    s['cover_kicker'] = ParagraphStyle('cover_kicker', fontName='DejaVuSans', fontSize=11, leading=14,
        textColor=TEXT_MUTED, alignment=TA_LEFT, spaceAfter=4*mm)
    s['h1'] = ParagraphStyle('h1', fontName='NotoSerifSC-Bold', fontSize=22, leading=28,
        textColor=HEADER_FILL, alignment=TA_LEFT, spaceBefore=6*mm, spaceAfter=4*mm)
    s['h2'] = ParagraphStyle('h2', fontName='NotoSerifSC-Bold', fontSize=16, leading=22,
        textColor=HEADER_FILL, alignment=TA_LEFT, spaceBefore=5*mm, spaceAfter=3*mm)
    s['h3'] = ParagraphStyle('h3', fontName='NotoSerifSC-Bold', fontSize=13, leading=18,
        textColor=ICON, alignment=TA_LEFT, spaceBefore=4*mm, spaceAfter=2*mm)
    s['body'] = ParagraphStyle('body', fontName='DejaVuSans', fontSize=10.5, leading=17,
        textColor=TEXT_PRIMARY, alignment=TA_JUSTIFY, spaceBefore=2*mm, spaceAfter=2*mm)
    s['body_indent'] = ParagraphStyle('body_indent', fontName='DejaVuSans', fontSize=10.5, leading=17,
        textColor=TEXT_PRIMARY, alignment=TA_JUSTIFY, leftIndent=8*mm, spaceBefore=1*mm, spaceAfter=1*mm)
    s['bullet'] = ParagraphStyle('bullet', fontName='DejaVuSans', fontSize=10.5, leading=17,
        textColor=TEXT_PRIMARY, alignment=TA_LEFT, leftIndent=12*mm, bulletIndent=6*mm,
        spaceBefore=1*mm, spaceAfter=1*mm)
    s['callout'] = ParagraphStyle('callout', fontName='DejaVuSans-Bold', fontSize=11, leading=17,
        textColor=ACCENT, alignment=TA_LEFT, leftIndent=8*mm, borderPadding=4*mm,
        spaceBefore=3*mm, spaceAfter=3*mm)
    s['quote'] = ParagraphStyle('quote', fontName='DejaVuSans', fontSize=11.5, leading=18,
        textColor=ICON, alignment=TA_LEFT, leftIndent=12*mm, rightIndent=12*mm,
        spaceBefore=4*mm, spaceAfter=4*mm)
    s['meta'] = ParagraphStyle('meta', fontName='DejaVuSans', fontSize=9, leading=13,
        textColor=TEXT_MUTED, alignment=TA_LEFT, spaceBefore=1*mm, spaceAfter=1*mm)
    s['toc_h1'] = ParagraphStyle('toc_h1', fontName='NotoSerifSC-Bold', fontSize=13, leading=20,
        textColor=HEADER_FILL, leftIndent=0)
    s['toc_h2'] = ParagraphStyle('toc_h2', fontName='DejaVuSans', fontSize=11, leading=17,
        textColor=TEXT_PRIMARY, leftIndent=8*mm)
    s['table_header'] = ParagraphStyle('table_header', fontName='NotoSerifSC-Bold', fontSize=9, leading=12,
        textColor=colors.white, alignment=TA_CENTER)
    s['table_cell'] = ParagraphStyle('table_cell', fontName='DejaVuSans', fontSize=8.5, leading=12,
        textColor=TEXT_PRIMARY, alignment=TA_LEFT)
    s['table_cell_center'] = ParagraphStyle('table_cell_center', fontName='DejaVuSans', fontSize=8.5, leading=12,
        textColor=TEXT_PRIMARY, alignment=TA_CENTER)
    s['p0_badge'] = ParagraphStyle('p0_badge', fontName='DejaVuSans-Bold', fontSize=8.5, leading=12,
        textColor=SEM_ERROR, alignment=TA_CENTER)
    s['p1_badge'] = ParagraphStyle('p1_badge', fontName='DejaVuSans-Bold', fontSize=8.5, leading=12,
        textColor=SEM_WARNING, alignment=TA_CENTER)
    s['p2_badge'] = ParagraphStyle('p2_badge', fontName='DejaVuSans-Bold', fontSize=8.5, leading=12,
        textColor=SEM_INFO, alignment=TA_CENTER)
    s['cat_a'] = ParagraphStyle('cat_a', fontName='DejaVuSans-Bold', fontSize=8.5, leading=12,
        textColor=SEM_SUCCESS, alignment=TA_CENTER)
    s['cat_b'] = ParagraphStyle('cat_b', fontName='DejaVuSans-Bold', fontSize=8.5, leading=12,
        textColor=SEM_WARNING, alignment=TA_CENTER)
    s['cat_c'] = ParagraphStyle('cat_c', fontName='DejaVuSans-Bold', fontSize=8.5, leading=12,
        textColor=SEM_ERROR, alignment=TA_CENTER)
    s['wow_enabling'] = ParagraphStyle('wow_enabling', fontName='DejaVuSans-Bold', fontSize=8.5, leading=12,
        textColor=ACCENT, alignment=TA_CENTER)
    s['wow_supporting'] = ParagraphStyle('wow_supporting', fontName='DejaVuSans', fontSize=8.5, leading=12,
        textColor=SEM_INFO, alignment=TA_CENTER)
    s['wow_infra'] = ParagraphStyle('wow_infra', fontName='DejaVuSans', fontSize=8.5, leading=12,
        textColor=TEXT_MUTED, alignment=TA_CENTER)
    s['score_high'] = ParagraphStyle('score_high', fontName='DejaVuSans-Bold', fontSize=8.5, leading=12,
        textColor=SEM_SUCCESS, alignment=TA_CENTER)
    s['score_mid'] = ParagraphStyle('score_mid', fontName='DejaVuSans-Bold', fontSize=8.5, leading=12,
        textColor=SEM_WARNING, alignment=TA_CENTER)
    s['score_low'] = ParagraphStyle('score_low', fontName='DejaVuSans-Bold', fontSize=8.5, leading=12,
        textColor=SEM_ERROR, alignment=TA_CENTER)
    return s

# ━━ DATA: 72 CAPABILITIES WITH 5-LENS SCORES ━━
# Format: (name, tc, iq, ee, iv, pd, category, wow, gap_summary, priority)
# tc=Technical Completeness, iq=Intelligence Quality, ee=Enterprise Experience,
# iv=Investor Value, pd=Product Differentiation
# category: A=Engine Exists->Needs Experience, B=Engine Partial->Needs Completion, C=Engine Missing->Needs Build
# wow: Enabling/Supporting/Infrastructure
# priority: P0/P1/P2

DOMAINS = [
    ("Domain 1: Company Intelligence", "Can DeepMindQ deeply understand any company and explain why it matters?",
     [
         ("Company Understanding", 90, 85, 60, 70, 75, "A", "Supporting",
          "Data exists across 10+ tables but is not unified into a single intelligence profile experience. The intelligence-profile API (556 lines) aggregates 10 data sources but outputs a data dump, not an executive narrative.", "P0"),
         ("Company Intelligence Profile", 85, 80, 50, 80, 90, "A", "Enabling",
          "Dual-path brief generation exists (fast template 388L + premium LLM 452L). Missing: Industry Position, Growth Trajectory, Strategic Initiatives, Competitive Landscape composition into brief narrative. Executive format needed.", "P0"),
         ("Enrichment", 60, 40, 25, 50, 30, "B", "Supporting",
          "All enrichment is AI-estimated. No external data provider integration (Clearbit/Apollo). Connector framework is extensible (BaseConnector pattern) but only has file-based connectors (CSV, Excel, Website, RSS). The single largest credibility gap.", "P0"),
         ("ICP Intelligence", 85, 75, 55, 60, 70, "A", "Supporting",
          "9-dimension ICP configuration with 3-component composite scoring (Static 40%, Dynamic 40%, Timing 20%). No industry taxonomy (free-text with basic normalization). No ICP effectiveness measurement.", "P1"),
         ("Industry Intelligence", 50, 45, 30, 50, 30, "B", "Supporting",
          "Industry is free-text string with basic normalization. No classification taxonomy (SIC/NAICS). No industry-level insights (trends, market size). No industry hierarchy. Limits ICP precision and analytics.", "P1"),
         ("Technology Intelligence", 55, 50, 35, 55, 50, "B", "Supporting",
          "Structured storage (techStack JSON, 4 categories) exists. All tech detection is LLM-estimated from web search. No Wappalyzer/BuiltWith integration. No version tracking. No compatibility scoring.", "P2"),
         ("Financial Intelligence", 45, 35, 25, 60, 40, "B", "Enabling",
          "All financial data is AI-estimated strings ($10M-$50M), not from real sources. No numeric revenue fields. No confidence level on financial data. Violates the honest representation principle. Per mandate: never fabricate.", "P0"),
         ("Organization Intelligence", 60, 55, 40, 55, 60, "A", "Supporting",
          "Good stakeholder mapping with Power-Interest Grid, 6 buying roles, 14 departments. No org hierarchy (reports-to chains, org chart). No department-level intelligence (budgets, team sizes).", "P2"),
         ("Competitive Intelligence", 55, 50, 30, 55, 40, "B", "Supporting",
          "Event collection exists (237 lines): web search to LLM extraction to 8 event types. No competitor registry model. No persistent tracking. No landscape mapping. Ad-hoc string matching in JSON fields.", "P1"),
     ]),
    ("Domain 2: Contact Intelligence", "Can DeepMindQ identify the right people, understand their influence, and recommend engagement strategy?",
     [
         ("Identity Resolution", 65, 55, 30, 40, 20, "B", "Supporting",
          "Multi-strategy dedup detection (296 lines) exists. No merge workflow, no survivorship rules, no auto-merge API. Detection without resolution. Duplicates accumulate silently.", "P1"),
         ("Role Intelligence", 60, 55, 35, 40, 25, "B", "Infrastructure",
          "Dual inconsistent scoring: lead-scoring (0-25 scale) vs contact-influence-engine (0-100 scale). Influence engine is superior. Legacy system creates confusion. Needs consolidation.", "P1"),
         ("Influence Scoring", 75, 70, 50, 60, 65, "A", "Supporting",
          "4-dimension composite influence score (seniority 40%, department 25%, engagement 20%, network 15%). Network scoring is simplistic. Title-based: Director at 10-person startup = Director at 10,000-person enterprise.", "P2"),
         ("Buying Authority", 65, 60, 40, 55, 35, "A", "Supporting",
          "Title-based buying role classification (6 roles). Relationship mapping with Power-Interest Grid. Purely title-based. No budget authority assessment. No multi-threading detection.", "P2"),
         ("Relationship Intelligence & Buying Committee", 80, 75, 35, 85, 90, "A", "Enabling",
          "Relationship mapping engine (312 lines) produces exactly the right data. Gap is presentation: output is JSON API response, not a visual buying committee map. Would be a headline demo feature.", "P0"),
         ("Engagement Intelligence", 70, 30, 20, 70, 80, "B", "Enabling",
          "Engagement prediction engine (285 lines) exists but runs on fabricated data: totalOpens hardcoded to 0, avgResponseDays hardcoded to 3. Email tracking exists but is not wired to the engine. 3 days to fix.", "P0"),
         ("Communication Preferences", 50, 45, 30, 50, 55, "B", "Supporting",
          "Static role-based timing rules (CEO=8:30AM, CTO=10AM). No learning system. Rules are static heuristics, not learned from actual send/open/reply data.", "P2"),
     ]),
    ("Domain 3: Revenue Intelligence", "Can DeepMindQ explain where revenue opportunity exists, why now, and what action should happen?",
     [
         ("Account Scoring", 80, 75, 55, 60, 65, "A", "Supporting",
          "Multi-signal composite scoring (416 lines). Signal patterns (166 lines). Tier classification. Strategic fit uses hardcoded industry lists instead of ICP config. No deal-level revenue contribution.", "P2"),
         ("Buying Signals", 75, 70, 50, 60, 65, "A", "Supporting",
          "5-category signal scoring with evidence integration. No web behavior intent signals. Engagement dimension is thin. Functional but not differentiated.", "P2"),
         ("Evidence-Based Opportunity Intelligence", 80, 70, 55, 75, 85, "A", "Enabling",
          "Three-engine architecture: opportunity-radar (271L), probability-engine (208L), revenue-opportunity-engine (529L). No estimatedValue field on Pursuit model. Per mandate: Evidence-Reasoning-Opportunity Assessment, NOT fabricated forecasting.", "P0"),
         ("Deal Risk", 70, 65, 45, 55, 60, "A", "Supporting",
          "6-factor risk model with evidence. Duplicated across 3 routes (pipeline/health, pipeline/forecast, ai/deal-risk). No signal-based risk detection. Needs deduplication.", "P2"),
         ("Forecasting Framework", 70, 60, 40, 65, 70, "B", "Enabling",
          "14-step pipeline with stage distribution, conversion rates, velocity metrics. All projections are count-based. No dollar amounts. Per mandate: add user-provided estimatedValue + AI-calculated probability. Never fabricate revenue.", "P0"),
         ("Revenue Recommendations", 75, 70, 45, 60, 65, "A", "Supporting",
          "Dual-system: simple rules (166L) + sophisticated compound rules (337L). Evidence-backed. No feedback loop integration. No per-rep personalization.", "P1"),
     ]),
    ("Domain 4: Communication Intelligence", "Can DeepMindQ understand business conversations and improve decisions?",
     [
         ("Email Intelligence", 95, 90, 80, 85, 90, "A", "Enabling",
          "Dual-mode email generation (539L): AI + template fallback. Governance gates, hallucination prevention, multi-provider send with tracking. Rate-limited (50/hr/user). Production-hardened.", "-"),
         ("Conversation Intelligence", 90, 85, 40, 90, 95, "A", "Enabling",
          "Conversation engine (833 lines): 4 briefing types (meeting_prep, executive_brief, conversation_plan, outreach_prepare). Full buyer profile extraction. Evidence-grounded. The engine produces exactly the right output. Gap: productization into one-click meeting prep experience.", "P0"),
         ("Reply Understanding", 90, 85, 60, 80, 80, "A", "Supporting",
          "Multi-provider webhook (422L): HMAC-SHA256 verification. 4 reply categories with regex patterns. Thread matching. Auto-actions. Production-hardened.", "-"),
         ("Intent Extraction", 85, 80, 60, 75, 75, "A", "Supporting",
          "Multi-layer: buying-intent-engine (253L) + ai-hybrid-retrieval classifyIntent. Functional. Not directly visible to users.", "-"),
         ("Personalization", 85, 80, 65, 80, 85, "A", "Enabling",
          "Person intelligence engine + email generation with contact-aware personalization. Sequence processing (164L). Evidence-grounded personalization.", "-"),
         ("Next-Best-Action", 85, 80, 40, 85, 90, "A", "Enabling",
          "Action engine (694L): 6 action types, 9 sales motions, 5 urgency levels, full evidence chain. Recommendation engine (1,087L): multi-source with A+ to F grading. Gap: presentation as decision intelligence, not data list.", "P0"),
         ("Communication Learning", 55, 40, 25, 70, 80, "B", "Supporting",
          "Feedback learning loop (953L) captures 5 verdicts, 17 reason codes, 10 outcome types. But learning loop (202L) is mostly skeleton: promises weight adjustment but does not implement it.", "P1"),
         ("Sentiment Detection", 40, 35, 20, 30, 20, "C", "Infrastructure",
          "Basic keyword matching in association-engine. Returns positive/negative/neutral. No nuance. No dedicated sentiment engine.", "P2"),
     ]),
    ("Domain 5: Knowledge Intelligence", "Can DeepMindQ become the organization's intelligence memory?",
     [
         ("Document Ingestion", 90, 85, 55, 80, 80, "A", "Supporting",
          "8-step pipeline (274L): Extract, Chunk, Classify, Summarize, Embed, Link, Version, Search. SHA-256 dedup. Parses TXT, MD, PDF, DOCX. Production-hardened.", "-"),
         ("Semantic Chunking", 60, 65, 30, 55, 70, "B", "Supporting",
          "Fixed 800-word windows with 100-word overlap. No sentence-boundary awareness. No semantic boundary detection. Summary step not implemented. Degrades retrieval quality for structured documents.", "P1"),
         ("Hybrid Retrieval", 95, 90, 45, 90, 95, "A", "Enabling",
          "6-signal hybrid retrieval (1,233L): Vector, Keyword (BM25), Entity (NER), Knowledge Graph, Recency, Source Reliability. Score fusion via Reciprocal Rank Fusion. Genuinely enterprise-grade. Gap: not composed into unified search experience.", "P0"),
         ("Knowledge Graph", 95, 90, 40, 90, 95, "A", "Enabling",
          "16 entity types, 30+ relationship types (1,781L). BFS/DFS traversal, confidence propagation, provenance tracking. No CRM has this. Gap: no visual exploration experience.", "P0"),
         ("Memory System", 95, 85, 35, 90, 95, "A", "Enabling",
          "4-layer hierarchy (1,221L): Working, Conversation, Enterprise, Institutional. 12 categories, 5 priority levels, consolidation engine, forgetting/decay policies. Beyond any enterprise platform. Gap: not exposed as product differentiator.", "P0"),
         ("Enterprise Search", 75, 70, 25, 85, 90, "A", "Enabling",
          "Components exist (retrieval, KG, memory, reasoning) but are not composed into a single 'ask anything' experience. No unified endpoint. The key WOW #4 experience.", "P0"),
     ]),
    ("Domain 6: AI Reasoning Platform", "Can an enterprise trust DeepMindQ's AI decisions?",
     [
         ("AI Governance", 95, 95, 20, 95, 95, "A", "Enabling",
          "1,524 lines. 57 registered generation types with per-type confidence gates. 15 hallucination prevention rules. Full audit trail. ESLint rule blocks unregistered LLM calls. The single most impressive infrastructure piece. Currently invisible.", "P0"),
         ("Model Routing", 90, 85, 30, 80, 85, "A", "Infrastructure",
          "Model router (429L) + AI config (434L). Multi-provider routing with fallback chains, cost optimization, tier selection (fast/smart/deep). Production-grade.", "-"),
         ("Confidence Scoring", 90, 90, 30, 90, 95, "A", "Enabling",
          "Unified confidence engine (753L): 6 dimensions (data quality, evidence quantity, signal freshness, source reliability, historical accuracy, cross-validation). Dynamic weighting. Production-grade. Gap: not visible on every output.", "P0"),
         ("Hallucination Prevention", 90, 90, 25, 90, 95, "A", "Enabling",
          "Two-layer defense (665L): 15 pre-generation rules + post-generation verification. Claim extraction, evidence comparison. Effective but invisible to users. Must become visible trust signal.", "P0"),
         ("Explainability", 95, 90, 20, 95, 95, "A", "Enabling",
          "1,392 lines. 6-section intelligence trail: Reasoning, Evidence, Sources, Confidence Factors, Risk Factors, Recommended Action. Score decomposition, source provenance. Enterprise-grade API. Gap: not surfaced in UI.", "P0"),
         ("Agent Framework", 85, 75, 10, 85, 90, "A", "Enabling",
          "2,874 lines. 10 specializations, 4 approval modes, 11 task states, 8 tool types, reasoning chain, self-validation. Full REST API. Architecturally complete but produces zero customer-ready experiences.", "P1"),
         ("AI Evaluation", 80, 80, 20, 80, 90, "A", "Infrastructure",
          "2,006 lines. 6 evaluation dimensions, 14 engine types, regression detection. MLOps-level capability. CI-integrated quality gate not running. Important infrastructure.", "P1"),
         ("Prompt Management", 60, 60, 15, 60, 70, "B", "Infrastructure",
          "Registry (752L) with versioning, A/B testing, quality metrics. Only 4 of 85+ prompts migrated. Framework built but unused. 95% of prompts are scattered across codebases.", "P1"),
     ]),
    ("Domain 7: Autonomous Intelligence Agents", "Are these only frameworks, or are they customer-ready experiences?",
     [
         ("Account Intelligence Agent", 75, 60, 10, 85, 90, "A", "Enabling",
          "Framework ready + autonomous-monitor (472L) + signal detection. Trigger: manual via API. Output: alert JSON. Schedule: none. Needs: scheduling, trigger automation, output formatting, notification.", "P1"),
         ("Research Agent", 70, 65, 10, 85, 90, "A", "Enabling",
          "Framework ready + research-engine (610L) + brief-generator (452L). Trigger: manual. Output: brief JSON. Schedule: none. Needs: scheduled intelligence generation, formatted output.", "P1"),
         ("Meeting Intelligence Agent", 65, 60, 10, 80, 85, "A", "Enabling",
          "Framework ready + conversation-engine (833L). Trigger: none. Output: none. Schedule: none. Needs: trigger from calendar/event, formatted executive brief, notification.", "P1"),
         ("Opportunity Intelligence Agent", 60, 50, 10, 75, 80, "A", "Enabling",
          "Framework ready + opportunity-radar (271L). Logic: partial. Trigger: none. Output: none. Schedule: none. Needs: full opportunity scanning logic, scoring, notification.", "P2"),
         ("Knowledge Intelligence Agent", 65, 60, 10, 80, 85, "A", "Enabling",
          "Framework ready + hybrid-retrieval (1,233L) + knowledge-graph + memory. Trigger: none. Output: none. Needs: query interface, composed answer generation, citation formatting.", "P1"),
     ]),
    ("Domain 8: Recommendation Intelligence", "Does DeepMindQ help executives decide what to do next?",
     [
         ("Recommendation Engine", 85, 80, 35, 85, 90, "A", "Enabling",
          "1,087 lines. Multi-source aggregation with A+ to F confidence grading. Produces priority, opportunity score, evidence-backed reasons, risk factors, recommended action, confidence grade. Gap: framed as 'recommendations' not 'decisions'. Needs narrative reframing.", "P0"),
         ("Insight Generation", 50, 45, 25, 55, 60, "B", "Supporting",
          "AI insight service (217L): CRUD persistence layer. No pattern detection, no synthesis, no cross-signal reasoning. A repository, not a generation engine.", "P2"),
         ("Feedback Loops", 65, 50, 25, 70, 80, "B", "Supporting",
          "Feedback loop (953L): 5 verdicts, 17 reason codes, 10 outcome types. Well-designed capture. Not wired to recommendation acceptance tracking or scoring weight adjustment. Loop is open.", "P1"),
         ("Learning System", 30, 25, 10, 65, 75, "C", "Supporting",
          "Continuous learning loop (202L): skeleton. Promises scoring weight adjustment, email/meeting note extraction, signal validation. None implemented. 202 lines, mostly stubs.", "P1"),
     ]),
]

# ━━ WOW EXPERIENCES ━━
WOW_EXPERIENCES = [
    ("WOW #1: Target Account Intelligence", "Analyze Microsoft", 85,
     "full-pipeline (20-stage), intelligence-profile (556L), account-brief (452L), brief-generator (388L), relationship-mapping (312L), opportunity-radar (271L), action-engine (694L)",
     "Single unified API composing all engines into one call; Verified data integration; Executive narrative output format; Visual company intelligence profile experience",
     "P0"),
    ("WOW #2: Market Intelligence Discovery", "Find companies likely to buy AI modernization services in Europe", 70,
     "ICP alignment (1,027L), account scoring (416L), buying intent engine (253L), recommendation engine (1,087L), opportunity radar",
     "Natural language query parsing; Ranked results with composite reasoning; Contact recommendations per account; One-click create opportunity from discovery",
     "P0"),
    ("WOW #3: Executive Meeting Intelligence", "Prepare me for my meeting with Siemens CIO", 90,
     "Conversation engine (833L) with 4 briefing types, buyer profile extraction, evidence grounding via GroundingEngine + RetrievalEngine",
     "One-click meeting brief generation UI; Brief export/download (PDF); Share capability; Post-meeting intelligence capture",
     "P0"),
    ("WOW #4: Enterprise Knowledge Intelligence", "What do we know about healthcare AI adoption challenges?", 75,
     "Hybrid retrieval (1,233L, 6-signal), knowledge graph (1,781L), memory (1,221L), ingestion pipeline (274L)",
     "Unified ask-anything API endpoint; Composed answer: Answer + Reasoning + Evidence + Source + Confidence; Knowledge search UI; No-knowledge-found graceful handling",
     "P0"),
]

# ━━ POST-M5 TARGETS ━━
POST_M5_TARGETS = [
    ("Company Intelligence", 55, 30, 75, 85),
    ("Contact Intelligence", 65, 35, 80, 85),
    ("Revenue Intelligence", 78, 40, 85, 85),
    ("Communication Intelligence", 93, 55, 95, 95),
    ("Knowledge Intelligence", 96, 45, 95, 95),
    ("AI Reasoning Platform", 95, 25, 95, 95),
    ("Autonomous Agents", 70, 10, 85, 90),
    ("Recommendation Intelligence", 83, 40, 90, 90),
    ("OVERALL", 79, 35, 95, 95),
]

# ━━ HELPER FUNCTIONS ━━

def score_style(s, styles):
    if s >= 80: return styles['score_high']
    elif s >= 50: return styles['score_mid']
    else: return styles['score_low']

def priority_style(p, styles):
    if p == 'P0': return styles['p0_badge']
    elif p == 'P1': return styles['p1_badge']
    elif p == 'P2': return styles['p2_badge']
    else: return styles['table_cell_center']

def cat_style(c, styles):
    if c == 'A': return styles['cat_a']
    elif c == 'B': return styles['cat_b']
    else: return styles['cat_c']

def wow_style(w, styles):
    if w == 'Enabling': return styles['wow_enabling']
    elif w == 'Supporting': return styles['wow_supporting']
    else: return styles['wow_infra']

def P(text, style):
    return Paragraph(str(text), style)

def domain_avg(domain_data):
    if not domain_data: return 0, 0, 0, 0, 0
    n = len(domain_data)
    return (sum(d[1] for d in domain_data)/n, sum(d[2] for d in domain_data)/n,
            sum(d[3] for d in domain_data)/n, sum(d[4] for d in domain_data)/n,
            sum(d[5] for d in domain_data)/n)

def add_heading(text, style, level=0, story=None, styles=None):
    key = f'h_{hashlib.md5(text.encode()).hexdigest()[:8]}'
    p = Paragraph(f'<a name="{key}"/>{text}', style)
    p.bookmark_name = key
    p.bookmark_level = level
    p.bookmark_text = text
    p.bookmark_key = key
    story.append(p)
    return p

# ━━ TOC DOCUMENT TEMPLATE ━━
class TocDocTemplate(SimpleDocTemplate):
    def __init__(self, *args, **kwargs):
        SimpleDocTemplate.__init__(self, *args, **kwargs)
        self.page_count_offset = 0

    def afterFlowable(self, flowable):
        if hasattr(flowable, 'bookmark_name'):
            level = getattr(flowable, 'bookmark_level', 0)
            text = getattr(flowable, 'bookmark_text', '')
            key = getattr(flowable, 'bookmark_key', '')
            self.notify('TOCEntry', (level, text, self.page, key))

def add_page_number(canvas, doc):
    page_num = canvas.getPageNumber()
    text = f"DeepMindQ Enterprise Intelligence Platform | Phase 0 Audit"
    canvas.saveState()
    canvas.setFont('DejaVuSans', 8)
    canvas.setFillColor(TEXT_MUTED)
    canvas.drawString(doc.leftMargin, 15*mm, text)
    canvas.drawRightString(doc.pagesize[0] - doc.rightMargin, 15*mm, f"Page {page_num}")
    canvas.restoreState()

def first_page(canvas, doc):
    pass  # Cover is separate

# ━━ CAPABILITY TABLE BUILDER ━━
def build_domain_table(domain_name, domain_data, styles, show_all=True):
    """Build a compact capability assessment table for one domain."""
    # Header row
    header = [
        P("Capability", styles['table_header']),
        P("TC", styles['table_header']),
        P("IQ", styles['table_header']),
        P("EE", styles['table_header']),
        P("IV", styles['table_header']),
        P("PD", styles['table_header']),
        P("Cat", styles['table_header']),
        P("WOW", styles['table_header']),
        P("Priority", styles['table_header']),
    ]
    if show_all:
        header.append(P("Gap Summary", styles['table_header']))

    rows = [header]
    for cap in domain_data:
        name, tc, iq, ee, iv, pd, cat, wow, gap, priority = cap
        row = [
            P(name, styles['table_cell']),
            P(f"{tc}%", score_style(tc, styles)),
            P(f"{iq}%", score_style(iq, styles)),
            P(f"{ee}%", score_style(ee, styles)),
            P(f"{iv}%", score_style(iv, styles)),
            P(f"{pd}%", score_style(pd, styles)),
            P(cat, cat_style(cat, styles)),
            P(wow, wow_style(wow, styles)),
            P(priority, priority_style(priority, styles)),
        ]
        if show_all:
            row.append(P(gap[:120] + ('...' if len(gap) > 120 else ''), styles['table_cell']))
        rows.append(row)

    # Column widths (proportional, fitting within available width)
    avail = A4[0] - 40*mm  # 40mm total margins
    if show_all:
        col_widths = [avail*0.13, avail*0.04, avail*0.04, avail*0.04, avail*0.04,
                     avail*0.04, avail*0.04, avail*0.07, avail*0.06, avail*0.50]
    else:
        col_widths = [avail*0.20, avail*0.06, avail*0.06, avail*0.06, avail*0.06,
                     avail*0.06, avail*0.06, avail*0.10, avail*0.08]

    t = Table(rows, colWidths=col_widths, repeatRows=1)
    style_cmds = [
        ('BACKGROUND', (0, 0), (-1, 0), HEADER_FILL),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('ALIGN', (0, 0), (0, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('FONTSIZE', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 4*mm),
        ('TOPPADDING', (0, 0), (-1, 0), 3*mm),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 2*mm),
        ('TOPPADDING', (0, 1), (-1, -1), 2*mm),
        ('LEFTPADDING', (0, 0), (-1, -1), 2*mm),
        ('RIGHTPADDING', (0, 0), (-1, -1), 2*mm),
        ('GRID', (0, 0), (-1, -1), 0.5, BORDER),
        ('LINEBELOW', (0, 0), (-1, 0), 1, HEADER_FILL),
    ]
    # Alternating row colors
    for i in range(1, len(rows)):
        if i % 2 == 0:
            style_cmds.append(('BACKGROUND', (0, i), (-1, i), TABLE_STRIPE))
    t.setStyle(TableStyle(style_cmds))
    return t

def build_readiness_table(styles):
    """Build the Platform Readiness Score table."""
    header = [
        P("Domain", styles['table_header']),
        P("Technical<br/>Completeness", styles['table_header']),
        P("Intelligence<br/>Quality", styles['table_header']),
        P("Enterprise<br/>Experience", styles['table_header']),
        P("Investor<br/>Value", styles['table_header']),
        P("Product<br/>Differentiation", styles['table_header']),
        P("Gap<br/>(TC vs EE)", styles['table_header']),
    ]
    rows = [header]
    for domain_name, key_q, caps in DOMAINS:
        tc, iq, ee, iv, pd = domain_avg(caps)
        gap = f"{tc:.0f}% - {ee:.0f}% = {tc-ee:.0f}pp"
        rows.append([
            P(domain_name.replace("Domain ", "D").replace(": ", ":<br/>"), styles['table_cell']),
            P(f"{tc:.0f}%", score_style(tc, styles)),
            P(f"{iq:.0f}%", score_style(iq, styles)),
            P(f"{ee:.0f}%", score_style(ee, styles)),
            P(f"{iv:.0f}%", score_style(iv, styles)),
            P(f"{pd:.0f}%", score_style(pd, styles)),
            P(gap, styles['table_cell_center']),
        ])
    # Overall
    all_caps = [c for _, _, caps in DOMAINS for c in caps]
    tc, iq, ee, iv, pd = domain_avg(all_caps)
    rows.append([
        P("<b>OVERALL</b>", styles['table_cell']),
        P(f"<b>{tc:.0f}%</b>", score_style(tc, styles)),
        P(f"<b>{iq:.0f}%</b>", score_style(iq, styles)),
        P(f"<b>{ee:.0f}%</b>", score_style(ee, styles)),
        P(f"<b>{iv:.0f}%</b>", score_style(iv, styles)),
        P(f"<b>{pd:.0f}%</b>", score_style(pd, styles)),
        P(f"<b>{tc:.0f}% - {ee:.0f}% = {tc-ee:.0f}pp</b>", styles['table_cell_center']),
    ])

    avail = A4[0] - 40*mm
    col_widths = [avail*0.20, avail*0.13, avail*0.13, avail*0.14, avail*0.13, avail*0.14, avail*0.13]
    t = Table(rows, colWidths=col_widths, repeatRows=1)
    style_cmds = [
        ('BACKGROUND', (0, 0), (-1, 0), HEADER_FILL),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('FONTSIZE', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 4*mm),
        ('TOPPADDING', (0, 0), (-1, 0), 3*mm),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 2*mm),
        ('TOPPADDING', (0, 1), (-1, -1), 2*mm),
        ('LEFTPADDING', (0, 0), (-1, -1), 2*mm),
        ('RIGHTPADDING', (0, 0), (-1, -1), 2*mm),
        ('GRID', (0, 0), (-1, -1), 0.5, BORDER),
        ('BACKGROUND', (0, -1), (-1, -1), CARD_BG),
        ('LINEBELOW', (0, 0), (-1, 0), 1, HEADER_FILL),
    ]
    for i in range(1, len(rows)-1):
        if i % 2 == 0:
            style_cmds.append(('BACKGROUND', (0, i), (-1, i), TABLE_STRIPE))
    t.setStyle(TableStyle(style_cmds))
    return t

def build_wow_table(styles):
    """Build the WOW Experience Readiness table."""
    header = [
        P("WOW Experience", styles['table_header']),
        P("Input", styles['table_header']),
        P("Readiness", styles['table_header']),
        P("What Exists", styles['table_header']),
        P("What's Missing", styles['table_header']),
        P("Priority", styles['table_header']),
    ]
    rows = [header]
    for name, inp, readiness, exists, missing, priority in WOW_EXPERIENCES:
        rows.append([
            P(f"<b>{name}</b>", styles['table_cell']),
            P(f"<i>{inp}</i>", styles['table_cell']),
            P(f"{readiness}%", score_style(readiness, styles)),
            P(exists[:150] + ('...' if len(exists) > 150 else ''), styles['table_cell']),
            P(missing[:150] + ('...' if len(missing) > 150 else ''), styles['table_cell']),
            P(priority, priority_style(priority, styles)),
        ])
    avail = A4[0] - 40*mm
    col_widths = [avail*0.15, avail*0.14, avail*0.08, avail*0.27, avail*0.27, avail*0.09]
    t = Table(rows, colWidths=col_widths, repeatRows=1)
    style_cmds = [
        ('BACKGROUND', (0, 0), (-1, 0), HEADER_FILL),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('FONTSIZE', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 4*mm),
        ('TOPPADDING', (0, 0), (-1, 0), 3*mm),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 2*mm),
        ('TOPPADDING', (0, 1), (-1, -1), 2*mm),
        ('LEFTPADDING', (0, 0), (-1, -1), 2*mm),
        ('RIGHTPADDING', (0, 0), (-1, -1), 2*mm),
        ('GRID', (0, 0), (-1, -1), 0.5, BORDER),
        ('LINEBELOW', (0, 0), (-1, 0), 1, HEADER_FILL),
    ]
    for i in range(1, len(rows)):
        if i % 2 == 0:
            style_cmds.append(('BACKGROUND', (0, i), (-1, i), TABLE_STRIPE))
    t.setStyle(TableStyle(style_cmds))
    return t

def build_gap_matrix(styles):
    """Build the Enterprise Gap Matrix sorted by Enterprise Impact."""
    # Flatten all capabilities with composite score
    all_caps = []
    for domain_name, key_q, caps in DOMAINS:
        for cap in caps:
            name, tc, iq, ee, iv, pd, cat, wow, gap, priority = cap
            # Composite: Enterprise Impact = (EE * 0.4 + IV * 0.2 + PD * 0.2 + WOW_factor * 0.2)
            wow_factor = 100 if wow == 'Enabling' else (60 if wow == 'Supporting' else 20)
            enterprise_impact = (ee * 0.35 + iv * 0.2 + pd * 0.2 + wow_factor * 0.15 + (100 - tc) * 0.1)
            # Transformation effort: lower if Cat A (just experience layer), higher if Cat C (needs build)
            effort_map = {'A': 30, 'B': 60, 'C': 90}
            effort = effort_map.get(cat, 50)
            all_caps.append({
                'domain': domain_name.split(':')[0].strip(),
                'name': name, 'tc': tc, 'iq': iq, 'ee': ee, 'iv': iv, 'pd': pd,
                'cat': cat, 'wow': wow, 'gap': gap, 'priority': priority,
                'enterprise_impact': enterprise_impact, 'effort': effort
            })

    # Sort by enterprise impact descending, then by effort ascending
    all_caps.sort(key=lambda x: (-x['enterprise_impact'], x['effort']))

    header = [
        P("#", styles['table_header']),
        P("Capability", styles['table_header']),
        P("Domain", styles['table_header']),
        P("EE%", styles['table_header']),
        P("Cat", styles['table_header']),
        P("WOW", styles['table_header']),
        P("Impact", styles['table_header']),
        P("Effort", styles['table_header']),
        P("Priority", styles['table_header']),
    ]
    rows = [header]
    for i, cap in enumerate(all_caps[:30], 1):  # Top 30
        rows.append([
            P(str(i), styles['table_cell_center']),
            P(cap['name'], styles['table_cell']),
            P(cap['domain'], styles['table_cell']),
            P(f"{cap['ee']}%", score_style(cap['ee'], styles)),
            P(cap['cat'], cat_style(cap['cat'], styles)),
            P(cap['wow'][:3], wow_style(cap['wow'], styles)),
            P(f"{cap['enterprise_impact']:.0f}", styles['table_cell_center']),
            P(f"{cap['effort']}d", styles['table_cell_center']),
            P(cap['priority'], priority_style(cap['priority'], styles)),
        ])

    avail = A4[0] - 40*mm
    col_widths = [avail*0.04, avail*0.18, avail*0.10, avail*0.06, avail*0.05, avail*0.06,
                 avail*0.08, avail*0.07, avail*0.07]
    t = Table(rows, colWidths=col_widths, repeatRows=1)
    style_cmds = [
        ('BACKGROUND', (0, 0), (-1, 0), HEADER_FILL),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('FONTSIZE', (0, 0), (-1, -1), 7.5),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 3*mm),
        ('TOPPADDING', (0, 0), (-1, 0), 3*mm),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 1.5*mm),
        ('TOPPADDING', (0, 1), (-1, -1), 1.5*mm),
        ('LEFTPADDING', (0, 0), (-1, -1), 1.5*mm),
        ('RIGHTPADDING', (0, 0), (-1, -1), 1.5*mm),
        ('GRID', (0, 0), (-1, -1), 0.5, BORDER),
        ('LINEBELOW', (0, 0), (-1, 0), 1, HEADER_FILL),
    ]
    for i in range(1, len(rows)):
        if i % 2 == 0:
            style_cmds.append(('BACKGROUND', (0, i), (-1, i), TABLE_STRIPE))
    t.setStyle(TableStyle(style_cmds))
    return t

def build_post_m5_table(styles):
    """Build the Post-M5 Readiness Targets table."""
    header = [
        P("Domain", styles['table_header']),
        P("Current TC", styles['table_header']),
        P("Current EE", styles['table_header']),
        P("Target TC", styles['table_header']),
        P("Target EE", styles['table_header']),
        P("TC Delta", styles['table_header']),
        P("EE Delta", styles['table_header']),
    ]
    rows = [header]
    for domain, tc_cur, ee_cur, tc_tgt, ee_tgt in POST_M5_TARGETS:
        tc_delta = f"+{tc_tgt - tc_cur}pp" if tc_tgt > tc_cur else str(tc_tgt - tc_cur)
        ee_delta = f"+{ee_tgt - ee_cur}pp" if ee_tgt > ee_cur else str(ee_tgt - ee_cur)
        rows.append([
            P(f"<b>{domain}</b>" if domain == "OVERALL" else domain, styles['table_cell']),
            P(f"{tc_cur}%", score_style(tc_cur, styles)),
            P(f"{ee_cur}%", score_style(ee_cur, styles)),
            P(f"{tc_tgt}%", score_style(tc_tgt, styles)),
            P(f"{ee_tgt}%", score_style(ee_tgt, styles)),
            P(f"<b>{tc_delta}</b>", styles['table_cell_center']),
            P(f"<b>{ee_delta}</b>", styles['table_cell_center']),
        ])
    avail = A4[0] - 40*mm
    col_widths = [avail*0.22, avail*0.13, avail*0.13, avail*0.13, avail*0.13, avail*0.13, avail*0.13]
    t = Table(rows, colWidths=col_widths, repeatRows=1)
    style_cmds = [
        ('BACKGROUND', (0, 0), (-1, 0), HEADER_FILL),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('FONTSIZE', (0, 0), (-1, -1), 8.5),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 4*mm),
        ('TOPPADDING', (0, 0), (-1, 0), 3*mm),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 2*mm),
        ('TOPPADDING', (0, 1), (-1, -1), 2*mm),
        ('LEFTPADDING', (0, 0), (-1, -1), 2*mm),
        ('RIGHTPADDING', (0, 0), (-1, -1), 2*mm),
        ('GRID', (0, 0), (-1, -1), 0.5, BORDER),
        ('BACKGROUND', (0, -1), (-1, -1), CARD_BG),
        ('LINEBELOW', (0, 0), (-1, 0), 1, HEADER_FILL),
    ]
    for i in range(1, len(rows)-1):
        if i % 2 == 0:
            style_cmds.append(('BACKGROUND', (0, i), (-1, i), TABLE_STRIPE))
    t.setStyle(TableStyle(style_cmds))
    return t

def build_productization_summary(styles):
    """Build the Productization Classification Summary."""
    header = [
        P("Domain", styles['table_header']),
        P("Cat A<br/>(Experience Layer)", styles['table_header']),
        P("Cat B<br/>(Completion)", styles['table_header']),
        P("Cat C<br/>(Build)", styles['table_header']),
        P("WOW<br/>Enabling", styles['table_header']),
        P("WOW<br/>Supporting", styles['table_header']),
        P("WOW<br/>Infra", styles['table_header']),
    ]
    rows = [header]
    for domain_name, key_q, caps in DOMAINS:
        cat_a = sum(1 for c in caps if c[6] == 'A')
        cat_b = sum(1 for c in caps if c[6] == 'B')
        cat_c = sum(1 for c in caps if c[6] == 'C')
        wow_e = sum(1 for c in caps if c[7] == 'Enabling')
        wow_s = sum(1 for c in caps if c[7] == 'Supporting')
        wow_i = sum(1 for c in caps if c[7] == 'Infrastructure')
        rows.append([
            P(domain_name.split(":")[0].strip(), styles['table_cell']),
            P(str(cat_a), styles['table_cell_center']),
            P(str(cat_b), styles['table_cell_center']),
            P(str(cat_c), styles['table_cell_center']),
            P(str(wow_e), styles['table_cell_center']),
            P(str(wow_s), styles['table_cell_center']),
            P(str(wow_i), styles['table_cell_center']),
        ])
    # Totals
    all_caps_flat = [c for _, _, caps in DOMAINS for c in caps]
    rows.append([
        P("<b>TOTAL</b>", styles['table_cell']),
        P(f"<b>{sum(1 for c in all_caps_flat if c[6]=='A')}</b>", styles['table_cell_center']),
        P(f"<b>{sum(1 for c in all_caps_flat if c[6]=='B')}</b>", styles['table_cell_center']),
        P(f"<b>{sum(1 for c in all_caps_flat if c[6]=='C')}</b>", styles['table_cell_center']),
        P(f"<b>{sum(1 for c in all_caps_flat if c[7]=='Enabling')}</b>", styles['table_cell_center']),
        P(f"<b>{sum(1 for c in all_caps_flat if c[7]=='Supporting')}</b>", styles['table_cell_center']),
        P(f"<b>{sum(1 for c in all_caps_flat if c[7]=='Infrastructure')}</b>", styles['table_cell_center']),
    ])
    avail = A4[0] - 40*mm
    col_widths = [avail*0.18, avail*0.14, avail*0.14, avail*0.14, avail*0.14, avail*0.14, avail*0.12]
    t = Table(rows, colWidths=col_widths, repeatRows=1)
    style_cmds = [
        ('BACKGROUND', (0, 0), (-1, 0), HEADER_FILL),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('FONTSIZE', (0, 0), (-1, -1), 8.5),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 4*mm),
        ('TOPPADDING', (0, 0), (-1, 0), 3*mm),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 2*mm),
        ('TOPPADDING', (0, 1), (-1, -1), 2*mm),
        ('LEFTPADDING', (0, 0), (-1, -1), 2*mm),
        ('RIGHTPADDING', (0, 0), (-1, -1), 2*mm),
        ('GRID', (0, 0), (-1, -1), 0.5, BORDER),
        ('BACKGROUND', (0, -1), (-1, -1), CARD_BG),
        ('LINEBELOW', (0, 0), (-1, 0), 1, HEADER_FILL),
    ]
    for i in range(1, len(rows)-1):
        if i % 2 == 0:
            style_cmds.append(('BACKGROUND', (0, i), (-1, i), TABLE_STRIPE))
    t.setStyle(TableStyle(style_cmds))
    return t

# ━━ COVER HTML GENERATION ━━
def generate_cover_html():
    html = f'''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;900&family=Noto+Sans+SC:wght@300;400;500;700;900&family=Playfair+Display:ital,wght@0,400;0,700;0,900;1,400&display=swap" rel="stylesheet">
<style>
@page {{ size: 794px 1123px; margin: 0; }}
html, body {{ margin: 0; padding: 0; width: 794px; height: 1123px; background: #f5f5f4; font-family: 'Inter', 'Noto Sans SC', sans-serif; }}
.cover {{ position: relative; width: 794px; height: 1123px; overflow: hidden; }}
.bg {{ position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: linear-gradient(160deg, #534a2f 0%, #3d3520 40%, #2a2518 100%); }}
.accent-line {{ position: absolute; top: 38%; left: 8%; width: 120px; height: 3px; background: #a9892b; }}
.kicker {{ position: absolute; top: 15%; left: 8%; font-family: 'Inter', sans-serif; font-size: 11pt; font-weight: 500; letter-spacing: 4px; text-transform: uppercase; color: rgba(255,255,255,0.5); }}
.title {{ position: absolute; top: 40%; left: 8%; width: 80%; font-family: 'Playfair Display', serif; font-size: 52pt; font-weight: 900; color: white; line-height: 1.08; letter-spacing: -1px; }}
.subtitle {{ position: absolute; top: 57%; left: 8%; width: 70%; font-family: 'Inter', sans-serif; font-size: 15pt; font-weight: 300; color: rgba(255,255,255,0.75); line-height: 1.6; }}
.summary {{ position: absolute; top: 68%; left: 8%; width: 72%; font-family: 'Inter', sans-serif; font-size: 10.5pt; font-weight: 400; color: rgba(255,255,255,0.5); line-height: 1.7; }}
.meta {{ position: absolute; bottom: 8%; left: 8%; font-family: 'Inter', sans-serif; font-size: 10pt; font-weight: 400; color: rgba(255,255,255,0.35); }}
.tag {{ position: absolute; top: 8%; right: 8%; font-family: 'Inter', sans-serif; font-size: 9pt; font-weight: 600; letter-spacing: 2px; text-transform: uppercase; color: #a9892b; border: 1px solid rgba(169,137,43,0.4); padding: 6px 12px; }}
</style>
</head>
<body>
<div class="cover">
  <div class="bg"></div>
  <div class="tag">5-LENS FRAMEWORK</div>
  <div class="kicker">Phase 0: Enterprise Readiness Audit</div>
  <div class="accent-line"></div>
  <div class="title">DeepMindQ<br/>Enterprise Intelligence<br/>Operating System</div>
  <div class="subtitle">Productization & Enterprise Readiness Assessment<br/>72 Capabilities | 8 Domains | Target: 95/95</div>
  <div class="summary">This audit evaluates every capability through five lenses: Technical Completeness, Intelligence Quality, Enterprise Experience, Investor Value, and Product Differentiation. Each capability is classified by productization category (Experience Layer / Completion / Build) and WOW impact. The output is the transformation blueprint for achieving 95% technical maturity and 95% enterprise experience.</div>
  <div class="meta">August 2026 | Version 2.0 | Updated 5-Lens Framework</div>
</div>
</body>
</html>'''
    with open(COVER_HTML, 'w') as f:
        f.write(html)

# ━━ BODY PDF GENERATION ━━
def generate_body_pdf(styles, output_path):
    story = []

    # ── TABLE OF CONTENTS ──
    toc = TableOfContents()
    toc.levelStyles = [styles['toc_h1'], styles['toc_h2']]
    story.append(Paragraph("Table of Contents", styles['h1']))
    story.append(toc)
    story.append(PageBreak())

    # ── CHAPTER 1: AUDIT FRAMEWORK ──
    add_heading("Chapter 1: Audit Framework & Methodology", styles['h1'], 0, story, styles)

    story.append(Paragraph(
        "This audit evaluates DeepMindQ not as a collection of features, but as an <b>Enterprise Intelligence Operating System</b> "
        "that sits above CRM, communication platforms, documents, and enterprise data. The platform already contains significant "
        "intelligence infrastructure. The issue is not capability absence. The issue is <b>productization</b>.", styles['body']))

    story.append(Paragraph(
        "The current platform already includes: AI Governance (1,524 lines), Explainability (1,392 lines), Confidence Scoring "
        "(753 lines), Hallucination Prevention (665 lines), Knowledge Graph (1,781 lines), Hybrid Retrieval (1,233 lines), "
        "4-Layer Memory (1,221 lines), Agent Framework (2,874 lines), Evidence Framework, Recommendation Engine (1,087 lines), "
        "Intelligence Pipelines, Data Intelligence, Communication Intelligence, and Revenue Intelligence. These engines are "
        "production-grade. They form the foundation. M5's mission is to transform them into enterprise-grade experiences.", styles['body']))

    add_heading("1.1 The Five-Lens Evaluation Framework", styles['h2'], 1, story, styles)
    story.append(Paragraph(
        "Every capability is evaluated through five lenses. Each lens answers a critical enterprise question and produces a "
        "percentage score from 0% to 100%. The composite of these five scores determines the capability's readiness for "
        "enterprise deployment.", styles['body']))

    lenses = [
        ("Technical Completeness", "Does the underlying engine meet enterprise engineering standards?",
         "Evaluates: production readiness, scalability, security, reliability, test coverage, architecture quality, operational maturity."),
        ("Intelligence Quality", "Can the platform be trusted to produce intelligence?",
         "Evaluates: evidence grounding, reasoning quality, confidence scoring, explainability, hallucination prevention, data reliability, decision quality."),
        ("Enterprise Experience", "Would an enterprise buyer understand the value within 5 minutes?",
         "Evaluates: immediate value comprehension, executive-ready output, WOW moment creation, backend-to-visible-outcome transformation."),
        ("Investor Value", "Would this capability increase confidence in a $10M investment decision?",
         "Evaluates: Enterprise Intelligence category strengthening, defensible differentiation, investment thesis support, platform-beyond-CRM demonstration."),
        ("Product Differentiation", "Why does DeepMindQ deserve to exist as a new category?",
         "Evaluates: Salesforce comparison, HubSpot comparison, generic AI assistant comparison, unique intelligence capability identification."),
    ]
    for lens_name, question, details in lenses:
        story.append(Paragraph(f"<b>{lens_name}</b>", styles['h3']))
        story.append(Paragraph(f"<i>Core Question: {question}</i>", styles['meta']))
        story.append(Paragraph(details, styles['body_indent']))

    add_heading("1.2 Productization Lens", styles['h2'], 1, story, styles)
    story.append(Paragraph(
        "Every capability is classified into one of three productization categories. This classification determines the "
        "transformation approach: expose existing engines, complete partial implementations, or build genuinely missing capabilities.",
        styles['body']))

    prod_rows = [
        [P("<b>Category A: Engine Exists - Needs Experience Layer</b>", styles['table_cell']),
         P("The intelligence already exists technically but is hidden from users. Examples: AI Governance (95% TC, 20% EE), Explainability (95% TC, 20% EE), Knowledge Graph (95% TC, 40% EE). Priority: <b>Expose and productize.</b>", styles['table_cell'])],
        [P("<b>Category B: Engine Partial - Needs Completion</b>", styles['table_cell']),
         P("The foundation exists but requires enterprise maturity. Examples: Data enrichment (60% TC), Contact resolution (65% TC), Engagement intelligence (70% TC). Priority: <b>Complete the missing operational layer.</b>", styles['table_cell'])],
        [P("<b>Category C: Engine Missing - Needs Build</b>", styles['table_cell']),
         P("Capability genuinely does not exist. Examples: Learning System (30% TC), Sentiment Detection (40% TC). Priority: <b>Only build if it contributes significantly to 95/95 objective.</b>", styles['table_cell'])],
    ]
    t = Table(prod_rows, colWidths=[A4[0]-65*mm]*2)
    t.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3*mm),
        ('TOPPADDING', (0, 0), (-1, -1), 3*mm),
        ('LEFTPADDING', (0, 0), (-1, -1), 3*mm),
        ('RIGHTPADDING', (0, 0), (-1, -1), 3*mm),
        ('GRID', (0, 0), (-1, -1), 0.5, BORDER),
        ('BACKGROUND', (0, 0), (0, 0), colors.HexColor('#e8f5e9')),
        ('BACKGROUND', (0, 1), (0, 1), colors.HexColor('#fff3e0')),
        ('BACKGROUND', (0, 2), (0, 2), colors.HexColor('#fce4ec')),
    ]))
    story.append(t)

    add_heading("1.3 WOW Classification", styles['h2'], 1, story, styles)
    story.append(Paragraph(
        "Every capability receives a WOW classification that determines its contribution to enterprise buyer perception. "
        "This is the primary filter for M5 prioritization: capabilities that create WOW moments are prioritized above "
        "infrastructure improvements, regardless of technical complexity.", styles['body']))
    story.append(Paragraph(
        "<b>WOW Enabling:</b> Direct enterprise demo experience. Examples: 'Analyze Microsoft', 'Prepare executive meeting', "
        "'Find companies ready for AI modernization'. These capabilities define the product category.", styles['body_indent']))
    story.append(Paragraph(
        "<b>WOW Supporting:</b> Required infrastructure that enables WOW experiences. Examples: Data lineage, governance "
        "visibility, retrieval optimization. These capabilities make WOW experiences trustworthy.", styles['body_indent']))
    story.append(Paragraph(
        "<b>Infrastructure:</b> Important but not directly visible to enterprise buyers. Examples: Rate limiting, API documentation, "
        "internal optimization. Necessary for production but not for perception.", styles['body_indent']))

    add_heading("1.4 Trust Framework", styles['h2'], 1, story, styles)
    story.append(Paragraph(
        "Every intelligence output must eventually support four trust dimensions. This TRUST framework is DeepMindQ's core "
        "product differentiator. The platform's biggest advantage is not data volume. It is TRUST through transparency.", styles['body']))
    trust_dims = [
        "<b>Source:</b> Verified API, Customer Data, Internal Documents, Web Intelligence, AI Inference",
        "<b>Confidence:</b> High, Medium, Low (with 6-dimension breakdown)",
        "<b>Freshness:</b> Last verified date, data age, update history",
        "<b>Reasoning:</b> Why the platform reached this conclusion (evidence chain, alternatives considered)",
    ]
    for dim in trust_dims:
        story.append(Paragraph(dim, styles['bullet']))

    add_heading("1.5 Revenue Intelligence Rule", styles['h2'], 1, story, styles)
    story.append(Paragraph(
        "Per the M5 mandate: <b>NO fabricated revenue predictions.</b> The platform must never say 'Microsoft will buy $5M.' "
        "Instead, it must say 'Microsoft demonstrates 8 evidence-backed indicators suggesting strong AI modernization opportunity.' "
        "The intelligence flow remains: Evidence, Signal, Reasoning, Opportunity Assessment, Recommended Action. "
        "The platform predicts readiness and opportunity indicators, not imaginary revenue outcomes.", styles['body']))

    story.append(PageBreak())

    # ── CHAPTER 2: EXECUTIVE SUMMARY ──
    add_heading("Chapter 2: Executive Summary", styles['h1'], 0, story, styles)

    add_heading("2.1 Platform Readiness Assessment", styles['h2'], 1, story, styles)
    story.append(Paragraph(
        "The following table presents the current state of DeepMindQ across all 8 intelligence domains, evaluated through "
        "the five-lens framework. The gap column highlights the distance between Technical Completeness (what the engine "
        "can do) and Enterprise Experience (what the user can experience). The overall platform gap is 44 percentage points "
        "- the technology exists, but the product does not yet.", styles['body']))
    story.append(Spacer(1, 3*mm))
    story.append(build_readiness_table(styles))
    story.append(Spacer(1, 5*mm))

    add_heading("2.2 The Fundamental Insight", styles['h2'], 1, story, styles)
    story.append(Paragraph(
        "DeepMindQ possesses the deepest AI reasoning infrastructure of any platform at this stage. No CRM product has "
        "any of the following: 6-signal hybrid retrieval, 16-entity knowledge graph, 4-layer memory, 7 composable AI "
        "engines, evidence-backed explainability, hallucination prevention, or AI governance with 57 registered generation "
        "types. Most enterprise AI platforms have one or two of these. DeepMindQ has all of them.", styles['body']))
    story.append(Paragraph(
        "However, the platform currently presents itself as a sophisticated engineering system, not an enterprise "
        "intelligence product. The gap is not in capabilities - it is in <b>experience layer, data credibility, and "
        "product narrative</b>. The technology exists. The product does not yet.", styles['body']))

    add_heading("2.3 Productization Classification Summary", styles['h2'], 1, story, styles)
    story.append(Paragraph(
        "The table below summarizes the productization categories and WOW classifications across all 8 domains. "
        "The dominant pattern is clear: most capabilities fall into Category A (Engine Exists, Needs Experience Layer). "
        "This confirms the diagnosis: the platform needs productization, not new engineering.", styles['body']))
    story.append(Spacer(1, 3*mm))
    story.append(build_productization_summary(styles))
    story.append(Spacer(1, 5*mm))

    add_heading("2.4 Target State: 95/95", styles['h2'], 1, story, styles)
    story.append(Paragraph(
        "The M5 objective is non-negotiable: 95% Technical Maturity and 95% Enterprise Experience. This is not an "
        "incremental improvement from 79% to 85%. This is a product transformation. The table below shows the "
        "transformation required for each domain, from current state to the 95/95 target.", styles['body']))
    story.append(Spacer(1, 3*mm))
    story.append(build_post_m5_table(styles))

    story.append(PageBreak())

    # ── CHAPTERS 3-10: DOMAIN AUDITS ──
    for idx, (domain_name, key_q, caps) in enumerate(DOMAINS, start=3):
        ch_num = idx
        add_heading(f"Chapter {ch_num}: {domain_name}", styles['h1'], 0, story, styles)
        story.append(Paragraph(f"<i>Key Question: {key_q}</i>", styles['quote']))
        tc, iq, ee, iv, pd = domain_avg(caps)
        story.append(Paragraph(
            f"Domain Assessment: Technical Completeness <b>{tc:.0f}%</b> | Intelligence Quality <b>{iq:.0f}%</b> | "
            f"Enterprise Experience <b>{ee:.0f}%</b> | Investor Value <b>{iv:.0f}%</b> | "
            f"Product Differentiation <b>{pd:.0f}%</b>", styles['meta']))
        story.append(Spacer(1, 2*mm))
        story.append(build_domain_table(domain_name, caps, styles, show_all=True))
        story.append(Spacer(1, 3*mm))

        # Domain analysis narrative
        cat_a_count = sum(1 for c in caps if c[6] == 'A')
        cat_b_count = sum(1 for c in caps if c[6] == 'B')
        wow_enable = [c[0] for c in caps if c[7] == 'Enabling']
        p0_caps = [c[0] for c in caps if c[9] == 'P0']

        if wow_enable:
            story.append(Paragraph(
                f"<b>WOW-Enabling Capabilities:</b> {', '.join(wow_enable)}. These capabilities directly create enterprise demo "
                f"experiences and represent the highest-value productization targets for this domain.", styles['body']))
        if p0_caps:
            story.append(Paragraph(
                f"<b>P0 Priorities:</b> {', '.join(p0_caps)}. These capabilities must achieve 95% enterprise experience in M5 "
                f"for the platform to meet its target state.", styles['body']))
        if cat_a_count > cat_b_count:
            story.append(Paragraph(
                f"Productization Assessment: <b>{cat_a_count} of {len(caps)} capabilities</b> have production-grade engines "
                f"that need experience layer productization. Only {cat_b_count} require engineering completion. "
                f"This confirms the domain is primarily an experience gap, not an engineering gap.", styles['body']))

        story.append(PageBreak())

    # ── CHAPTER 11: WOW EXPERIENCE READINESS ──
    add_heading("Chapter 11: WOW Experience Readiness Assessment", styles['h1'], 0, story, styles)
    story.append(Paragraph(
        "These are not features. These are product demonstrations. Each WOW experience is designed to prove the intelligence "
        "value of the platform within 60 seconds. The table below assesses the readiness of each experience, what "
        "infrastructure already exists, and what productization work is required.", styles['body']))
    story.append(Spacer(1, 3*mm))
    story.append(build_wow_table(styles))
    story.append(Spacer(1, 5*mm))

    # WOW narratives
    for name, inp, readiness, exists, missing, priority in WOW_EXPERIENCES:
        story.append(Paragraph(f"<b>{name}</b>", styles['h3']))
        story.append(Paragraph(f"<i>Input: '{inp}'</i>", styles['meta']))
        story.append(Paragraph(f"<i>Current Readiness: {readiness}%</i>", styles['meta']))
        story.append(Paragraph(
            f"The infrastructure for this experience is largely complete. Key existing components include {exists[:200]}. "
            f"What remains is the productization layer: {missing[:200]}. "
            f"This experience is classified as {priority} priority.", styles['body']))

    story.append(PageBreak())

    # ── CHAPTER 12: ENTERPRISE GAP MATRIX ──
    add_heading("Chapter 12: Enterprise Gap Matrix", styles['h1'], 0, story, styles)
    story.append(Paragraph(
        "The Enterprise Gap Matrix ranks all capabilities by their enterprise impact potential. The Impact score "
        "combines Enterprise Experience weight (35%), Investor Value (20%), Product Differentiation (20%), WOW factor "
        "(15%), and transformation need (10%). Effort is estimated by productization category. The goal is not the longest "
        "feature list - it is maximum enterprise perception improvement with minimum transformation effort.", styles['body']))
    story.append(Spacer(1, 3*mm))
    story.append(build_gap_matrix(styles))
    story.append(Spacer(1, 5*mm))

    story.append(Paragraph(
        "The top of this matrix represents the highest-value transformation targets: capabilities where the gap between "
        "technical maturity and enterprise experience is largest, the WOW factor is highest, and the productization effort "
        "is lowest (Category A). These are the capabilities where existing engines can be exposed as product features with "
        "relatively small investment, producing maximum enterprise perception improvement.", styles['body']))

    story.append(PageBreak())

    # ── CHAPTER 13: TRANSFORMATION ROADMAP ──
    add_heading("Chapter 13: Transformation Roadmap", styles['h1'], 0, story, styles)
    story.append(Paragraph(
        "The transformation roadmap maps every initiative into the 9-layer DeepMindQ architecture. The architecture is "
        "fixed - M5 does not replace it. M5 productizes it. Each phase transforms a layer from hidden engineering into "
        "visible enterprise experience.", styles['body']))

    architecture_layers = [
        ("Layer 9: Executive Experience", "The visible product layer. Every WOW experience lives here. This is what the enterprise buyer sees, touches, and values. M5's primary transformation target.", "Phase 2"),
        ("Layer 8: Learning Loop", "Feedback capture exists (953 lines). Weight adjustment and pattern learning are skeleton-only (202 lines). Must close the loop: user action feeds back into scoring weights.", "Phase 5"),
        ("Layer 7: Autonomous Action", "Agent framework exists (2,874 lines). 5 enterprise agents need productization: purpose, trigger, reasoning, output, approval, learning.", "Phase 4"),
        ("Layer 6: Decision Intelligence", "Recommendation engine exists (1,087 lines). Must reframe from 'recommendations' to 'decisions': evidence, reasoning, opportunity, action, impact, confidence, feedback.", "Phase 5"),
        ("Layer 5: AI Reasoning", "7 engines, governance (1,524L), explainability (1,392L), confidence (753L), hallucination prevention (665L). All at 90%+ technical but 20-30% enterprise experience. Must expose as product.", "Phase 3"),
        ("Layer 4: Intelligence Generation", "Intelligence pipeline, revenue intelligence, research engine, scoring engines. Most at 75-85% technical. Need experience layer and data credibility improvements.", "Phase 2"),
        ("Layer 3: Knowledge Creation", "Document ingestion, semantic chunking, knowledge graph, memory, hybrid retrieval. 95%+ technical for most. Need search UX and visual exploration.", "Phase 2 + Phase 6"),
        ("Layer 2: Data Processing", "Data intelligence (column detection, dedup, normalization, quality scoring), contact merge, engagement data wiring. Foundation for trust.", "Phase 1"),
        ("Layer 1: Data Sources", "Connector framework (CSV, Excel, Website, RSS). Need API-based connectors (Clearbit/Apollo), data lineage, provenance tracking.", "Phase 1"),
    ]
    for layer_name, desc, phase in architecture_layers:
        story.append(Paragraph(f"<b>{layer_name}</b> <font color='#{SEM_INFO.hexval()[2:]}'>[{phase}]</font>", styles['h3']))
        story.append(Paragraph(desc, styles['body_indent']))

    story.append(Spacer(1, 5*mm))

    # Phase summary
    add_heading("13.1 Phase Summary", styles['h2'], 1, story, styles)
    phases = [
        ("Phase 1: Data Trust Foundation (Weeks 1-2)",
         "External data provider integration (Clearbit/Apollo), Financial intelligence framework (known vs estimated), "
         "Engagement data integration (wire actual tracking to engine), Contact identity resolution and merge, "
         "Data lineage and provenance. Close the single largest credibility gap."),
        ("Phase 2: WOW Experience Engine (Weeks 2-5)",
         "4 WOW experiences productized: Target Account Intelligence, Market Intelligence Discovery, Executive Meeting "
         "Intelligence, Enterprise Knowledge Intelligence. Plus Buying Committee Map and Decision Intelligence Narrative. "
         "Every experience must deliver evidence-backed output in under 60 seconds."),
        ("Phase 3: AI Trust Layer Exposed (Weeks 5-7)",
         "AI Governance Dashboard, Explainability UI (6-section intelligence trail), Confidence Scoring Visibility, "
         "Hallucination Prevention Indicator, AI Cost Enforcement, Prompt Migration Phase 1. "
         "Transform the single biggest differentiator from hidden engineering to visible product."),
        ("Phase 4: Agent Experiences (Weeks 7-9)",
         "5 enterprise agents productized: Account Intelligence, Research, Meeting Intelligence, Opportunity Intelligence, "
         "Knowledge Intelligence. Each agent: purpose, trigger, reasoning, output, approval, learning. "
         "Plus Agent Orchestration Framework."),
        ("Phase 5: Decision Intelligence System (Weeks 9-10)",
         "Decision Intelligence reframing, Feedback Loop wiring, Learning System implementation, Unified Role Scoring. "
         "Platform shifts from recommendations to decisions. System improves with usage."),
        ("Phase 6: Enterprise Certification (Weeks 10-11)",
         "Semantic Chunking enhancement, Industry Taxonomy, Security and Test Coverage, Performance and Monitoring. "
         "Platform meets enterprise deployment standards. Ready for investor due diligence."),
    ]
    for phase_name, desc in phases:
        story.append(Paragraph(f"<b>{phase_name}</b>", styles['h3']))
        story.append(Paragraph(desc, styles['body_indent']))

    story.append(PageBreak())

    # ── CHAPTER 14: M5 ACCEPTANCE CRITERIA ──
    add_heading("Chapter 14: M5 Acceptance Criteria", styles['h1'], 0, story, styles)
    story.append(Paragraph(
        "M5 closes only when the following criteria are met. There is no partial acceptance. The platform must deliver "
        "on all dimensions simultaneously: technical maturity, enterprise experience, WOW demonstrations, and trust.", styles['body']))

    story.append(Paragraph(
        "The final acceptance test remains: User enters <b>'Analyze Microsoft'</b>. The platform delivers a complete "
        "executive intelligence experience with: Company understanding, market signals, contact intelligence, opportunity "
        "indicators, evidence, reasoning, confidence, and recommended actions - all within seconds. "
        "If an investor, Fortune 500 executive, or enterprise buyer sees this and does not say 'WOW', M5 is not complete.", styles['body']))

    criteria = [
        ("<b>Technical Maturity:</b> 79% to 95%", "Production hardening, data credibility, AI reliability, security, testing, architecture maturity."),
        ("<b>Enterprise Experience:</b> 35% to 95%", "WOW intelligence experiences, executive workflows, agent experiences, decision intelligence, evidence-backed recommendations."),
        ("<b>WOW Demonstrations:</b> All 4 functional", "Each deliverable in under 60 seconds with evidence-backed, confidence-scored, executive-ready output."),
        ("<b>AI Trust Layer:</b> Visible on every output", "Governance dashboard, explainability trail, confidence breakdown, hallucination prevention status, audit history."),
        ("<b>Agent Experiences:</b> 5 deployable", "Account Intelligence, Research, Meeting, Opportunity, Knowledge - each with trigger, reasoning, output, approval, learning."),
        ("<b>Data Credibility:</b> Zero AI-estimated data as fact", "Every data point labeled with source, confidence, freshness. Known vs estimated distinction."),
        ("<b>Decision Intelligence:</b> Closed feedback loop", "Every decision includes evidence, confidence, expected impact, recommended action, and feedback mechanism."),
        ("<b>Enterprise Certification:</b> Security and reliability", "Rate limiting, test coverage, API documentation, performance benchmarks, monitoring dashboards."),
    ]
    for criterion, details in criteria:
        story.append(Paragraph(criterion, styles['h3']))
        story.append(Paragraph(details, styles['body_indent']))

    story.append(Spacer(1, 8*mm))
    story.append(HRFlowable(width="100%", thickness=1, color=BORDER))
    story.append(Spacer(1, 4*mm))
    story.append(Paragraph(
        "<b>Final Positioning:</b> DeepMindQ is the Enterprise Intelligence Operating System that sits above CRM, "
        "communication platforms, documents, and enterprise data - continuously understanding businesses, discovering "
        "opportunities, and recommending the next best actions. After M5, a Fortune 500 executive will see: not a CRM, "
        "but an Intelligence Platform with enterprise trust, evidence-backed reasoning, and category-defining "
        "differentiation that no CRM or sales intelligence platform possesses.", styles['body']))

    # ── BUILD PDF ──
    doc = TocDocTemplate(
        output_path,
        pagesize=A4,
        leftMargin=20*mm,
        rightMargin=20*mm,
        topMargin=25*mm,
        bottomMargin=25*mm,
        title="DeepMindQ Enterprise Intelligence Operating System - Phase 0 Enterprise Readiness Audit",
        author="DeepMindQ Intelligence Team",
        subject="Updated 5-Lens Framework Assessment - 72 Capabilities - 8 Domains - Target 95/95"
    )
    doc.multiBuild(story, onLaterPages=add_page_number, onFirstPage=first_page)
    print(f"Body PDF generated: {output_path}")

# ━━ MAIN ━━
def main():
    print("=" * 60)
    print("DeepMindQ M5 Enterprise Readiness Audit - 5-Lens Framework")
    print("=" * 60)

    styles = make_styles()
    os.makedirs(DOWNLOAD_DIR, exist_ok=True)
    os.makedirs(SCRIPTS_DIR, exist_ok=True)

    # Step 1: Generate cover HTML
    print("\n[1/4] Generating cover HTML...")
    generate_cover_html()
    print(f"  Cover HTML: {COVER_HTML}")

    # Step 2: Render cover to PDF
    print("\n[2/4] Rendering cover PDF...")
    os.system(f'python3 "{PDF_SKILL_DIR}/scripts/poster_validate.py" check-html "{COVER_HTML}" 2>/dev/null || true')
    ret = os.system(f'node "{PDF_SKILL_DIR}/scripts/html2poster.js" "{COVER_HTML}" --output "{COVER_PDF}" --width 794px 2>&1')
    if ret != 0:
        print(f"  Warning: Cover PDF generation returned {ret}")
    else:
        print(f"  Cover PDF: {COVER_PDF}")

    # Step 3: Generate body PDF
    print("\n[3/4] Generating body PDF...")
    body_path = os.path.join(SCRIPTS_DIR, 'm5-audit-body.pdf')
    generate_body_pdf(styles, body_path)
    print(f"  Body PDF: {body_path}")

    # Step 4: Merge cover + body
    print("\n[4/4] Merging cover and body...")
    try:
        from pypdf import PdfMerger, PdfReader
        merger = PdfMerger()
        if os.path.exists(COVER_PDF):
            merger.append(COVER_PDF)
        merger.append(body_path)
        merger.write(OUTPUT_PDF)
        merger.close()
        print(f"\nFinal PDF: {OUTPUT_PDF}")

        # Get page count
        reader = PdfReader(OUTPUT_PDF)
        page_count = len(reader.pages)
        file_size = os.path.getsize(OUTPUT_PDF) / (1024*1024)
        print(f"Pages: {page_count}")
        print(f"Size: {file_size:.1f} MB")
    except ImportError:
        # Fallback: just use body PDF
        import shutil
        shutil.copy(body_path, OUTPUT_PDF)
        print(f"\nFinal PDF (cover merge skipped - pypdf not available): {OUTPUT_PDF}")

    # Quality check
    print("\nRunning quality check...")
    os.system(f'python3 "{PDF_SKILL_DIR}/scripts/pdf_qa.py" "{OUTPUT_PDF}" 2>&1 | tail -20 || true')

    print("\n" + "=" * 60)
    print("Audit PDF generation complete.")
    print("=" * 60)

if __name__ == '__main__':
    main()
