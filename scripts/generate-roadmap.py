#!/usr/bin/env python3
"""DeepMindQ Intelligence Engine Roadmap — Phase 2A / 2B / 2C"""

import os
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import (
    Paragraph, Spacer, Table, TableStyle, PageBreak, HRFlowable,
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase.pdfmetrics import registerFontFamily
from reportlab.platypus.doctemplate import SimpleDocTemplate, PageTemplate, Frame

FONT_DIR = '/usr/share/fonts'
pdfmetrics.registerFont(TTFont('FreeSerif', f'{FONT_DIR}/truetype/freefont/FreeSerif.ttf'))
pdfmetrics.registerFont(TTFont('FreeSerif-Bold', f'{FONT_DIR}/truetype/freefont/FreeSerifBold.ttf'))
pdfmetrics.registerFont(TTFont('FreeSerif-Italic', f'{FONT_DIR}/truetype/freefont/FreeSerifItalic.ttf'))
pdfmetrics.registerFont(TTFont('FreeSerif-BoldItalic', f'{FONT_DIR}/truetype/freefont/FreeSerifBoldItalic.ttf'))
pdfmetrics.registerFont(TTFont('DejaVuSans', f'{FONT_DIR}/truetype/dejavu/DejaVuSansMono.ttf'))
registerFontFamily('FreeSerif', normal='FreeSerif', bold='FreeSerif-Bold',
                    italic='FreeSerif-Italic', boldItalic='FreeSerif-BoldItalic')

# Cascade Palette
PAGE_BG       = colors.HexColor('#f6f6f5')
CARD_BG       = colors.HexColor('#eeedeb')
TABLE_STRIPE  = colors.HexColor('#f4f4f2')
HEADER_FILL   = colors.HexColor('#6b5f3c')
BORDER        = colors.HexColor('#d0cdc4')
ICON          = colors.HexColor('#87743b')
ACCENT        = colors.HexColor('#96771c')
ACCENT_2      = colors.HexColor('#7357c7')
TEXT_PRIMARY   = colors.HexColor('#1e1d1b')
TEXT_MUTED     = colors.HexColor('#7e7c74')
SEM_SUCCESS   = colors.HexColor('#4d8460')

PAGE_W, PAGE_H = A4
MARGIN = 60

S = {
    'body': ParagraphStyle('body', fontName='FreeSerif', fontSize=10.5, leading=17,
                           alignment=TA_JUSTIFY, textColor=TEXT_PRIMARY, spaceAfter=8),
    'h1': ParagraphStyle('h1', fontName='FreeSerif-Bold', fontSize=22, leading=28,
                         textColor=HEADER_FILL, spaceAfter=12, spaceBefore=24),
    'h2': ParagraphStyle('h2', fontName='FreeSerif-Bold', fontSize=15, leading=20,
                         textColor=ACCENT, spaceAfter=8, spaceBefore=18),
    'h3': ParagraphStyle('h3', fontName='FreeSerif-Bold', fontSize=12, leading=16,
                         textColor=ICON, spaceAfter=6, spaceBefore=12),
    'kicker': ParagraphStyle('kicker', fontName='FreeSerif', fontSize=9, leading=12,
                             textColor=TEXT_MUTED, spaceAfter=4),
    'caption': ParagraphStyle('caption', fontName='FreeSerif-Italic', fontSize=9, leading=13,
                              textColor=TEXT_MUTED, spaceAfter=6),
    'quote': ParagraphStyle('quote', fontName='FreeSerif-Italic', fontSize=11, leading=17,
                            textColor=ACCENT, leftIndent=24, rightIndent=12,
                            borderColor=ACCENT, borderWidth=2, borderPadding=8,
                            spaceAfter=10, spaceBefore=10),
    'bullet': ParagraphStyle('bullet', fontName='FreeSerif', fontSize=10.5, leading=17,
                             textColor=TEXT_PRIMARY, leftIndent=18, bulletIndent=6, spaceAfter=4),
    'th': ParagraphStyle('th', fontName='FreeSerif-Bold', fontSize=9.5, leading=13,
                          textColor=colors.white),
    'tc': ParagraphStyle('tc', fontName='FreeSerif', fontSize=9.5, leading=14,
                          textColor=TEXT_PRIMARY),
}

def body(text): return Paragraph(text, S['body'])
def heading(text, level='h1'): return Paragraph(text, S[level])
def h2(text): return Paragraph(text, S['h2'])
def h3(text): return Paragraph(text, S['h3'])
def quote(text): return Paragraph(text, S['quote'])
def kicker(text): return Paragraph(text, S['kicker'])
def hr(): return HRFlowable(width='100%', thickness=0.5, color=BORDER, spaceAfter=8, spaceBefore=8)
def divider(): return HRFlowable(width='100%', thickness=1.5, color=ACCENT, spaceAfter=12, spaceBefore=6)

def table(headers, rows, widths=None):
    usable = PAGE_W - 2 * MARGIN
    if not widths:
        widths = [usable / len(headers)] * len(headers)
    hdr = [Paragraph(h, S['th']) for h in headers]
    data = [hdr] + [[Paragraph(str(c), S['tc']) for c in r] for r in rows]
    t = Table(data, colWidths=widths, repeatRows=1)
    cmds = [
        ('BACKGROUND', (0, 0), (-1, 0), HEADER_FILL),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ('GRID', (0, 0), (-1, -1), 0.5, BORDER),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ]
    for i in range(2, len(data), 2):
        cmds.append(('BACKGROUND', (0, i), (-1, i), TABLE_STRIPE))
    t.setStyle(TableStyle(cmds))
    return t

story = []

# ═══ CHAPTER 1 ═══
story.append(heading('1. Executive Summary'))
story.append(divider())
story.append(body(
    'DeepMindQ is not evolving as a collection of features. It is evolving as an <b>intelligence maturity model</b>, '
    'where each phase answers a fundamentally different question about the relationship between external business '
    'events and sales opportunity. This roadmap defines three phases of intelligence evolution, each building on '
    'the previous, with clear boundaries and validation gates that prevent premature complexity.'
))
story.append(body(
    'The core product principle: sales tools provide accounts and contacts. DeepMindQ provides something '
    'radically different. It answers five questions for every intelligence item: <b>What changed? Why does it matter? '
    'Why are we relevant? Who should act? What should we do next?</b> The ultimate differentiation is not more data '
    'but better sales decisions, backed by evidence that a salesperson can trust and act on immediately.'
))
story.append(body(
    'Phase 2A proves the intelligence loop. Phase 2B proves deep understanding through knowledge graphs and entity '
    'resolution. Phase 2C proves prediction and autonomous learning. The cockpit is already built, the intelligence '
    'objects are the frozen contract, and every future engine plugs behind them without requiring redesign.'
))
story.append(quote(
    '"The goal is not more data. The goal is better sales decisions. The product wins when the majority of surfaced '
    'intelligence makes a salesperson say: I did not know this, and it changes how I approach this account."'
))

# ═══ CHAPTER 2 ═══
story.append(heading('2. Phase 2A: Intelligence Loop Foundation'))
story.append(divider())
story.append(kicker('Current Phase'))
story.append(body(
    'Phase 2A has a single, non-negotiable objective: prove that DeepMindQ can discover real external business '
    'changes, convert those changes into evidence-backed intelligence, and guide sales action. This is not about '
    'building the complete intelligence engine. It is about proving the loop works end to end. The validation '
    'question is: <b>"Did DeepMindQ find something new, explain why it matters, connect it to our capabilities, '
    'and recommend action?"</b> If the answer is yes, the foundation is proven.'
))

story.append(h2('2.1 Architecture'))
story.append(body(
    'The Phase 2A architecture follows a linear intelligence pipeline from external information sources through '
    'evidence collection, signal detection, freshness ranking, deterministic reasoning, and finally intelligence '
    'object generation. The Intelligence Object contract remains frozen throughout. The experience layer never '
    'knows whether intelligence came from a customer upload, enrichment, news, LinkedIn, job postings, technology '
    'discovery, government sources, or AI reasoning. Everything becomes an evidence-backed Intelligence Object.'
))
story.append(table(
    ['Layer', 'Component', 'Description'],
    [
        ['Collection', 'External Intelligence Collector', 'Multi-sensor: business signals, hiring, people/leadership'],
        ['Evidence', 'Evidence Engine (Foundation)', 'Raw preservation: source, URL, date, quality, confidence'],
        ['Classification', 'Replaceable Classifier', 'Rule-based keyword matching (Phase 2A); AI replacement (Phase B)'],
        ['Signal', 'Signal Generator', 'CompanySignal with full Wave 8A fields'],
        ['Ranking', 'Freshness Ranking Engine', '5-dimension composite: confidence, freshness, source, business, capability'],
        ['Reasoning', 'Deterministic Reasoning Chain', 'What happened, why it matters, why relevant, who acts, what to do'],
        ['Output', 'Intelligence Objects', 'Frozen contract: evidence state, confidence, origin, ranking score'],
    ],
    [65, 140, 255],
))

story.append(h2('2.2 Three Intelligence Sensors'))
story.append(body(
    'Phase 2A deploys three intelligence sensors. Critically, these are not features but sensors. The architecture '
    'always thinks: Company, then Multiple Sensors, then Evidence, Signals, Reasoning, and Action. Today the '
    'sensors are external intelligence, hiring, and people/leadership. Future sensors include technology '
    'intelligence, website intelligence, industry intelligence, and competitive intelligence.'
))

story.append(h3('2.2.1 Sensor 1: External Business Intelligence'))
story.append(body(
    'The primary sensor detects strategic business changes through public announcements, partnerships, strategic '
    'news, and public disclosures. For enterprise companies, this is the richest signal source. When Microsoft '
    'announces an AI infrastructure expansion, that is a highly visible, easily detectable strategic signal '
    'with high confidence and clear business implications. The sensor uses targeted web search queries focused '
    'on company announcements, partnerships, acquisitions, transformation initiatives, and regulatory events.'
))

story.append(h3('2.2.2 Sensor 2: Hiring Intelligence'))
story.append(body(
    'Hiring intelligence is the most important sensor for mid-market companies (200-2,000 employees). These '
    'companies may have almost zero media coverage, yet their hiring patterns reveal strategic direction. When '
    'a 500-person company hires five Azure engineers, a data architect, an AI engineer, and a cybersecurity '
    'specialist, DeepMindQ infers a possible cloud modernization initiative. This is a stronger buying signal '
    'than any news article they might publish. The sensor targets public job postings, careers pages, and '
    'hiring announcements. Phase 2A starts with individual signal detection, but the data structure allows '
    'future aggregation: ten cloud-related openings in one department means something different from one.'
))

story.append(h3('2.2.3 Sensor 3: People and Leadership Intelligence'))
story.append(body(
    'The people sensor detects organizational capability changes through new appointments of CIOs, CTOs, VPs of '
    'Engineering, Digital Transformation leaders, and other senior technology roles. New technology leaders often '
    'create vendor evaluation opportunities during their first 90 days, making leadership change one of the '
    'highest-value signals for sales engagement. The sensor uses public biographical information, indexed public '
    'information, and company announcements. It deliberately avoids LinkedIn API dependency, treating LinkedIn '
    'as a possible evidence source rather than the core engine.'
))

story.append(h2('2.3 Company-Size Adaptive Intelligence Strategy'))
story.append(body(
    'DeepMindQ cannot treat Microsoft and a 300-person company identically. The intelligence strategy must '
    'change based on company maturity, using the existing sizeRange field on the Company model. Enterprise '
    'companies generate many public signals, so the system prioritizes strategic announcements, acquisitions, '
    'partnerships, investor information, and leadership changes. Mid-market companies may have almost zero media '
    'coverage, so the system prioritizes hiring patterns, leadership appointments, technology role openings, '
    'new capabilities being built, partnerships, and growth signals. Same intelligence engine, different '
    'collection strategy.'
))
story.append(table(
    ['Dimension', 'Enterprise (10,000+)', 'Mid-Market (200-2,000)'],
    [
        ['Primary Signals', 'Announcements, acquisitions, partnerships', 'Hiring, technology adoption, leadership'],
        ['Query Strategy', 'News-focused', 'Hiring-focused: careers + job postings + people'],
        ['Signal Density', 'High: many public signals', 'Low: limited public data, hiring is primary'],
        ['Confidence Model', 'Source quality driven', 'Pattern driven (aggregate signals)'],
        ['Key Test', 'Handle information-rich companies', 'Find intelligence when data is sparse'],
    ],
    [85, 185, 190],
))

story.append(h2('2.4 Freshness Engine'))
story.append(body(
    'The freshness engine makes intelligence behave like a living system. All signals no longer look equal. '
    'Recent intelligence wins. The engine uses a half-life exponential decay model where the decay rate is '
    'specific to each signal type. News decays fast (14-day half-life). Structural changes like regulatory '
    'events decay slowly (90-day half-life). The composite intelligence ranking score combines five dimensions: '
    'Confidence (25%), Freshness/Recency (30%), Source Quality (15%), Business Relevance (15%), and '
    'Capability Fit (15%). A fresh 85% confidence signal (3 days old, freshness approximately 82) receives '
    'a significantly higher ranking than an old 95% confidence signal (8 months old, freshness near zero).'
))

story.append(h2('2.5 Evidence Engine Foundation'))
story.append(body(
    'Every intelligence item must answer the fundamental trust question: "How do you know this?" The evidence '
    'structure follows a clear chain: Claim, then Evidence (source, URL, date, quality, confidence), then '
    'Reasoning (why this matters for this company), then Recommended Action. Raw evidence is stored in the '
    'existing Evidence table with original headline, snippet, source URL, published date, collection date, '
    'and source reliability score. This becomes the Phase B Evidence Engine foundation.'
))

story.append(h2('2.6 Signal Taxonomy'))
story.append(body(
    'The classifier supports ten signal types, each producing a distinct reasoning chain. Leadership change '
    'triggers "new decision-maker window." Technology adoption triggers "capability gap or transformation '
    'opportunity detected." Hiring triggers "investment pattern detected." The classification layer is isolated '
    'and replaceable: Phase 2A uses rule-based keyword matching, Phase B will replace it with an AI Evidence '
    'Engine and Knowledge Graph. The downstream Intelligence Object never changes.'
))
story.append(table(
    ['Signal Type', 'Implication', 'Half-Life'],
    [
        ['funding', 'Available budget, active investment phase', '30 days'],
        ['hiring', 'Growth trajectory, resource gaps', '21 days'],
        ['leadership_change', 'Strategic inflection, vendor re-evaluation', '45 days'],
        ['expansion', 'Infrastructure and service needs', '60 days'],
        ['tech_change', 'Modernization, current solution dissatisfaction', '30 days'],
        ['partnership', 'Ecosystem building, integration requirements', '45 days'],
        ['acquisition', 'Technology consolidation, budget restructuring', '30 days'],
        ['news', 'Strategic priorities, market positioning', '14 days'],
        ['people_change', 'Team capability expansion', '30 days'],
        ['technology_adoption', 'Tool/platform alignment opportunity', '45 days'],
    ],
    [100, 300, 80],
))

story.append(h2('2.7 Intelligence Origin Tracking'))
story.append(body(
    'Every intelligence item knows where it came from. This is the foundation of enterprise trust. Origin types: '
    'customer_uploaded, enrichment, external_discovery, human_validation, ai_reasoning. Each origin includes source '
    'name and collection timestamp. A salesperson should understand: "DeepMindQ knew this because..." This '
    'transparency will become a major enterprise differentiator and is preserved across all phases.'
))

story.append(h2('2.8 Validation Framework'))
story.append(body(
    'Validation is measured from a salesperson\'s perspective. The core question: "Can a salesperson prepare '
    'for an executive meeting in 10 minutes using DeepMindQ intelligence?" Each intelligence item is evaluated '
    'on four dimensions: Discovery (did DeepMindQ find something new?), Trust (can every recommendation be '
    'traced to evidence?), Relevance (does capability matching make commercial sense?), and Action (does the '
    'salesperson know who to contact, why now, what conversation, and what capability to position?).'
))

story.append(h2('2.9 Intelligence Surprise Score'))
story.append(body(
    'Every intelligence item is rated on a 1-5 scale. Score 1: salesperson already knows this. Score 2: '
    'findable in 5 minutes. Score 3: findable eventually. Score 4: would likely miss without DeepMindQ. '
    'Score 5: genuinely surprised. The product wins when the majority scores 4 or 5. Information availability '
    'is not the value. Discovering business moments is the value.'
))
story.append(table(
    ['Score', 'Definition', 'Example'],
    [
        ['1', 'Already known', 'Company has Azure on their website'],
        ['2', 'Findable in 5 minutes', 'Google: "Company X hires engineer"'],
        ['3', 'Findable eventually', 'Buried in careers page'],
        ['4', 'Would likely miss', 'Pattern across multiple signals'],
        ['5', 'Genuinely surprised', 'Cross-signal inference'],
    ],
    [40, 165, 255],
))

# ═══ CHAPTER 3 ═══
story.append(heading('3. Phase 2B: Intelligence Depth Engine'))
story.append(divider())
story.append(kicker('After Phase 2A proves the loop'))
story.append(body(
    'Phase 2B moves from "detected signals" to "understood business intelligence." This is where the moat '
    'starts. The question changes from "What happened?" to "What does this mean in context?" Phase 2B adds '
    'depth through knowledge graphs, entity resolution, advanced evidence reasoning, competitive '
    'intelligence, and deeper technology discovery. It does not add new sensors; it deepens the '
    'understanding of signals already flowing through the Phase 2A pipeline.'
))

story.append(h2('3.1 Knowledge Graph'))
story.append(body(
    'The knowledge graph enables deep reasoning across relationships. The system understands that Company '
    '(Microsoft), Technology (Azure), Signal (AI investment), Capability (AI modernization), People '
    '(VP AI), Case Study (similar customer success), and Recommendation (engage VP AI) are all connected. '
    'The system understands relationships, not records. Current models already preserve many of these '
    'relationships through existing tables. Phase 2B adds a formal graph layer for cross-entity '
    'traversal and inference.'
))

story.append(h2('3.2 Entity Resolution'))
story.append(body(
    'The system must understand that "Microsoft Corporation," "Microsoft Azure," and "Microsoft AI" are connected '
    'entities, while "ABC Technologies Saudi" is not "ABC Technologies India." Entity resolution is critical for '
    'enterprise deployments where the CRM may contain dozens of name variants, merged entities, and subsidiary '
    'relationships. Without it, intelligence attributed to the wrong entity creates noise, destroys trust, and '
    'makes the entire pipeline unreliable.'
))

story.append(h2('3.3 Advanced Evidence Engine'))
story.append(body(
    'Phase 2B moves from evidence storage to evidence understanding. Capabilities include source reliability '
    'scoring, conflicting evidence detection, multiple source confirmation, and evidence clustering. When three '
    'independent sources confirm "cloud migration underway," confidence increases. The critical test: a '
    'salesperson can defend every recommendation by pointing to specific, auditable evidence.'
))

story.append(h2('3.4 Competitive Intelligence'))
story.append(body(
    'Phase 2B adds the ability to understand competitive dynamics. When a customer uses AWS, DeepMindQ '
    'detects rising Azure hiring and cloud migration signals, it identifies a possible cloud strategy shift '
    'and recommends positioning multi-cloud optimization. This requires competitor knowledge, a technology '
    'graph, and market intelligence, but requires no architectural changes because the evidence pipeline '
    'and reasoning chain already exist.'
))

story.append(h2('3.5 Deeper Technology Intelligence'))
story.append(body(
    'Beyond Phase 2A\'s web search-based detection, Phase 2B adds technology fingerprinting through '
    'website analysis, GitHub repositories, architecture indicators, and infrastructure detection. The system builds '
    'a comprehensive technology profile across multiple channels, creating a data platform and cloud modernization '
    'opportunity map that goes far beyond what job posting keywords can reveal.'
))

# ═══ CHAPTER 4 ═══
story.append(heading('4. Phase 2C: Autonomous Intelligence Platform'))
story.append(divider())
story.append(kicker('Long-term vision'))
story.append(body(
    'Phase 2C transforms DeepMindQ from a reactive intelligence system into a continuously learning sales '
    'intelligence platform. The question changes from "What happened?" to "What will happen next?" The '
    'salesperson does not search for intelligence. DeepMindQ alerts: "Three important changes happened this '
    'week. Recommended action: schedule executive conversation."'
))

story.append(h2('4.1 Continuous Intelligence Loop'))
story.append(body(
    'The continuous loop operates in seven stages: Observe (monitor signals), Understand (classify and '
    'contextualize), Recommend (generate prioritized actions), Act (salesperson takes action), Measure (track '
    'outcome), Learn (update models based on results), and Improve (refine future recommendations). The system '
    'learns which recommendations worked, which messages converted, which stakeholders responded, which signals '
    'predicted opportunities, creating a flywheel effect.'
))

story.append(h2('4.2 Predictive Opportunity Intelligence'))
story.append(body(
    'The system evolves from detecting current patterns to predicting future opportunities. "Companies with this '
    'hiring pattern usually purchase AI consulting within 90 days." Prediction includes opportunity probability: '
    '82%. This requires a large dataset of historical signal-to-outcome mappings, which Phase 2A and 2B '
    'are building the foundation for. Each signal collected, each recommendation made, and each outcome '
    'tracked feeds the prediction model.'
))

story.append(h2('4.3 AI Reasoning Engine'))
story.append(body(
    'At this stage, LLM reasoning operates over validated evidence, knowledge graph, history, and outcomes. '
    'Critically, the AI never invents. It reasons over validated evidence to produce strategic analysis. '
    'The AI becomes a strategic analyst that understands context, not a content generator that produces '
    'plausible-sounding text. This distinction is the difference between a product that salespeople trust '
    'and one they ignore.'
))

story.append(h2('4.4 Cross-Account Intelligence'))
story.append(body(
    'The system identifies patterns across the entire account portfolio. "Across 500 accounts, 15 manufacturing '
    'companies are showing identical AI modernization patterns. Recommendation: create industry campaign." '
    'Cross-account intelligence transforms DeepMindQ from a single-account tool into a portfolio intelligence '
    'platform, enabling sales leaders to see industry trends, regional patterns, and competitive movements.'
))

# ═══ CHAPTER 5 ═══
story.append(heading('5. Architecture Principles'))
story.append(divider())

story.append(h2('5.1 The Frozen Contract'))
story.append(body(
    'The Intelligence Object is the frozen UI/API contract. The cockpit is already built. Every future '
    'engine plugs behind the intelligence objects without requiring experience layer changes. This principle '
    'is non-negotiable. The UI should never know whether intelligence came from a customer upload, enrichment, '
    'news, LinkedIn, job postings, technology discovery, government sources, or AI reasoning. Everything '
    'becomes an evidence-backed Intelligence Object. This single architectural decision enables the entire '
    'three-phase evolution without redesign.'
))

story.append(h2('5.2 Source-Agnostic Collector'))
story.append(body(
    'The external intelligence collector is an interface, not an implementation. Today it uses a search API. '
    'Tomorrow it could use APIs, crawlers, or enterprise connectors. The source can change. The intelligence '
    'pipeline should not. The current collector proves the loop. It should not become the foundation '
    'limitation. Every sensor feeds through the same evidence-signal-reasoning-output pipeline.'
))

story.append(h2('5.3 Replaceable Classification'))
story.append(body(
    'The classification layer is isolated. Today: raw evidence through rule-based classifier. Tomorrow: '
    'raw evidence through AI Evidence Engine and Knowledge Graph. The downstream Intelligence Object does '
    'not know or care how classification happened. This keeps Phase B clean and prevents classification '
    'improvements from requiring changes to the reasoning chain, ranking engine, or experience layer.'
))

story.append(h2('5.4 Multi-Sensor Model'))
story.append(body(
    'No single source should become a dependency. The architecture treats every source as a sensor, with '
    'the company at the center and multiple sensors (News, Website, People, Technology, Industry, Competitive) '
    'feeding into the Evidence Engine. Each source provides evidence. The system combines multiple evidence '
    'sources to produce intelligence. News is only one sensor. Hiring is only one sensor. The intelligence '
    'engine must support different intelligence patterns depending on company size and maturity.'
))

# ═══ CHAPTER 6 ═══
story.append(heading('6. Validation and Success Criteria'))
story.append(divider())

story.append(h2('6.1 Phase 2A Validation Gate'))
story.append(body(
    'Phase 2A is validated when four criteria are met across both enterprise and mid-market test companies: '
    'Discovery (DeepMindQ finds something new), Trust (every recommendation traceable to evidence), Relevance '
    '(capability matching makes commercial sense), and Action (salesperson knows who to contact, why now, what '
    'conversation). The dataset must include enterprise companies like Microsoft and 2-3 mid-market companies '
    '(200-2,000 employees, limited news coverage, active hiring pages, different industries).'
))
story.append(table(
    ['Dimension', 'Enterprise Test', 'Mid-Market Test'],
    [
        ['Discovery', 'Rich signals: announcements, partnerships', 'Sparse signals: hiring, people, technology'],
        ['Trust', 'Multiple premium sources confirm', 'Limited sources but clear chain'],
        ['Relevance', 'Strong alignment with large capabilities', 'Targeted alignment with specific needs'],
        ['Action', 'Clear executive narrative', 'Specific hiring/technology-driven actions'],
        ['Surprise Score', 'Target >= 3.0', 'Target >= 4.0'],
    ],
    [70, 175, 175],
))

story.append(h2('6.2 Explicitly Excluded from Phase 2A'))
story.append(body(
    'The following items are deferred to Phase 2B to maintain focus: LinkedIn API dependency (authentication '
    'limitations, commercial risk), Knowledge Graph (requires validated evidence volume), AI Reasoning Engine '
    '(requires knowledge graph), Full Technology Scanning (requires different architecture), Website Content Diff '
    'Engine (requires content snapshot storage), and Competitive Intelligence (requires technology graph). '
    'Building them prematurely would create complexity without validation.'
))
story.append(table(
    ['Deferred Item', 'Reason for Deferral'],
    [
        ['LinkedIn API dependency', 'Authentication limitations, commercial risk, blocking potential'],
        ['Knowledge Graph', 'Requires validated evidence volume from Phase 2A'],
        ['AI Reasoning Engine', 'Requires knowledge graph and evidence depth'],
        ['Full Technology Scanning', 'Requires website diff + deep scanning architecture'],
        ['Website Content Diff Engine', 'Requires content snapshot storage and comparison'],
        ['Competitive Intelligence', 'Requires technology graph and market data'],
    ],
    [140, 330],
))

# ═══ CHAPTER 7 ═══
story.append(heading('7. Roadmap Summary'))
story.append(divider())
story.append(body(
    'The DeepMindQ intelligence evolution follows three clear phases, each with a distinct question and '
    'validation gate. Phase 2A proves the system can <b>discover</b>. Phase 2B proves the system can '
    '<b>understand</b>. Phase 2C proves the system can <b>predict and continuously improve</b>. '
    'The cockpit is already built, the intelligence objects are the contract, and every future engine plugs '
    'behind them. The roadmap is frozen. Execution proceeds phase by phase.'
))
story.append(table(
    ['Phase', 'Question', 'Key Components'],
    [
        ['2A', 'Can DeepMindQ discover?', 'Sensors, Freshness, Evidence, Reasoning'],
        ['2B', 'Can DeepMindQ understand?', 'Knowledge Graph, Entity Resolution, AI Reasoning'],
        ['2C', 'Can DeepMindQ predict?', 'Learning Loop, Prediction, Cross-Account'],
    ],
    [40, 150, 275],
))
story.append(Spacer(1, 12))
story.append(quote(
    '"Phase 2A proves DeepMindQ can discover. Phase 2B proves DeepMindQ can understand. Phase 2C proves '
    'DeepMindQ can predict and continuously improve. The ultimate differentiation: not finding information, '
    'but understanding relationships between information."'
))

# ═══ BUILD ═══
OUTPUT = '/home/z/my-project/download/DeepMindQ_Intelligence_Engine_Roadmap.pdf'
os.makedirs(os.path.dirname(OUTPUT), exist_ok=True)

def add_page_number(canvas, doc):
    canvas.saveState()
    canvas.setFont('FreeSerif', 8)
    canvas.setFillColor(TEXT_MUTED)
    canvas.drawCentredString(PAGE_W / 2, 25, f'Page {doc.page}')
    canvas.restoreState()

frame = Frame(MARGIN, MARGIN, PAGE_W - 2*MARGIN, PAGE_H - 2*MARGIN, id='normal')
template = PageTemplate(id='body', frames=frame, onPage=add_page_number)
doc = SimpleDocTemplate(
    OUTPUT, pagesize=A4,
    leftMargin=MARGIN, rightMargin=MARGIN,
    topMargin=MARGIN, bottomMargin=MARGIN,
)
doc.addPageTemplates([template])
doc.build(story)
print(f'PDF generated: {OUTPUT}')
