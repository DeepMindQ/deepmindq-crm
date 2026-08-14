#!/usr/bin/env python3
"""Generate DeepMindQ Intelligence OS - Comprehensive Audit Report PDF."""

import os
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import inch, mm
from reportlab.lib.colors import HexColor
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak,
    KeepTogether, HRFlowable
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase.pdfmetrics import registerFontFamily

# ── Font Registration ──
FONT_DIR = '/usr/share/fonts'
pdfmetrics.registerFont(TTFont('NotoSerif', f'{FONT_DIR}/truetype/noto-serif-sc/NotoSerifSC-Regular.ttf'))
pdfmetrics.registerFont(TTFont('NotoSerifBold', f'{FONT_DIR}/truetype/noto-serif-sc/NotoSerifSC-Bold.ttf'))
registerFontFamily('NotoSerif', normal='NotoSerif', bold='NotoSerifBold')

# ── Color Palette (Dark Intelligence OS Theme) ──
C = {
    'page_bg': HexColor('#0f0e0d'),
    'section_bg': HexColor('#201f1c'),
    'card_bg': HexColor('#2b2923'),
    'header_fill': HexColor('#47402e'),
    'border': HexColor('#5f5843'),
    'accent': HexColor('#dcc786'),
    'accent_blue': HexColor('#3B82F6'),
    'text_primary': HexColor('#efefee'),
    'text_muted': HexColor('#8c8982'),
    'success': HexColor('#6fb185'),
    'warning': HexColor('#b99e68'),
    'error': HexColor('#b96d66'),
    'critical_red': HexColor('#EF4444'),
    'critical_bg': HexColor('#3b1818'),
    'high_amber': HexColor('#F59E0B'),
    'high_bg': HexColor('#3b2f10'),
    'medium_blue': HexColor('#3B82F6'),
    'medium_bg': HexColor('#1a2332'),
    'low_green': HexColor('#10B981'),
    'low_bg': HexColor('#0f2b1f'),
    'white': HexColor('#ffffff'),
}

# ── Styles ──
styles = getSampleStyleSheet()

s_title = ParagraphStyle('Title', parent=styles['Title'], fontName='NotoSerifBold',
    fontSize=28, leading=34, textColor=C['text_primary'], spaceAfter=6)
s_subtitle = ParagraphStyle('Subtitle', parent=styles['Normal'], fontName='NotoSerif',
    fontSize=14, leading=20, textColor=C['text_muted'], spaceAfter=20)
s_h1 = ParagraphStyle('H1', fontName='NotoSerifBold', fontSize=20, leading=26,
    textColor=C['accent'], spaceBefore=24, spaceAfter=10)
s_h2 = ParagraphStyle('H2', fontName='NotoSerifBold', fontSize=15, leading=20,
    textColor=C['text_primary'], spaceBefore=18, spaceAfter=8)
s_h3 = ParagraphStyle('H3', fontName='NotoSerifBold', fontSize=12, leading=16,
    textColor=C['accent_blue'], spaceBefore=12, spaceAfter=6)
s_body = ParagraphStyle('Body', fontName='NotoSerif', fontSize=10, leading=15,
    textColor=C['text_primary'], alignment=TA_JUSTIFY, spaceAfter=8)
s_body_sm = ParagraphStyle('BodySm', fontName='NotoSerif', fontSize=9, leading=13,
    textColor=C['text_primary'], alignment=TA_JUSTIFY, spaceAfter=6)
s_bullet = ParagraphStyle('Bullet', fontName='NotoSerif', fontSize=10, leading=14,
    textColor=C['text_primary'], leftIndent=18, bulletIndent=6, spaceAfter=4)
s_muted = ParagraphStyle('Muted', fontName='NotoSerif', fontSize=9, leading=13,
    textColor=C['text_muted'], spaceAfter=4)
s_table_header = ParagraphStyle('TH', fontName='NotoSerifBold', fontSize=8,
    leading=11, textColor=C['text_primary'])
s_table_cell = ParagraphStyle('TC', fontName='NotoSerif', fontSize=8,
    leading=11, textColor=C['text_primary'])
s_table_cell_muted = ParagraphStyle('TCM', fontName='NotoSerif', fontSize=8,
    leading=11, textColor=C['text_muted'])
s_kpi = ParagraphStyle('KPI', fontName='NotoSerifBold', fontSize=24, leading=28,
    textColor=C['accent'], alignment=TA_CENTER)
s_kpi_label = ParagraphStyle('KPILabel', fontName='NotoSerif', fontSize=9,
    leading=12, textColor=C['text_muted'], alignment=TA_CENTER)

# ── Helper Functions ──
def heading(text, style=s_h1):
    return Paragraph(text, style)

def body(text):
    return Paragraph(text, s_body)

def body_sm(text):
    return Paragraph(text, s_body_sm)

def bullet(text):
    return Paragraph(f'\xe2\x80\xa2 {text}', s_bullet)

def muted(text):
    return Paragraph(text, s_muted)

def spacer(h=6):
    return Spacer(1, h)

def hr():
    return HRFlowable(width="100%", thickness=1, color=C['border'], spaceBefore=8, spaceAfter=8)

def severity_badge(text, color, bg):
    return Paragraph(
        f'<font color="{color.hexval()}" backColor="{bg.hexval()}">'
        f'<b>&nbsp;{text}&nbsp;</b></font>', s_table_cell
    )

def stat_row(label, value, note=''):
    data = [[Paragraph(f'<b>{label}</b>', s_table_cell_muted),
             Paragraph(f'<b>{value}</b>', ParagraphStyle('StatVal', fontName='NotoSerifBold',
                 fontSize=14, leading=18, textColor=C['accent'])),
             Paragraph(note, s_table_cell_muted)]]
    t = Table(data, colWidths=[150, 80, 260])
    t.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('LINEBELOW', (0,0), (-1,-1), 0.5, C['border']),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
    ]))
    return t

def make_table(headers, rows, col_widths=None):
    header_row = [Paragraph(h, s_table_header) for h in headers]
    data = [header_row]
    for row in rows:
        data.append([Paragraph(str(c), s_table_cell) for c in row])
    
    if not col_widths:
        col_widths = [490 / len(headers)] * len(headers)
    
    t = Table(data, colWidths=col_widths, repeatRows=1)
    t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), C['header_fill']),
        ('TEXTCOLOR', (0,0), (-1,0), C['text_primary']),
        ('GRID', (0,0), (-1,-1), 0.5, C['border']),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('LEFTPADDING', (0,0), (-1,-1), 4),
        ('RIGHTPADDING', (0,0), (-1,-1), 4),
        ('TOPPADDING', (0,0), (-1,-1), 3),
        ('BOTTOMPADDING', (0,0), (-1,-1), 3),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [C['section_bg'], C['card_bg']]),
    ]))
    return t

def severity_table(items):
    """Items: list of (priority, title, description, impact) tuples."""
    headers = ['#', 'Severity', 'Finding', 'Impact']
    rows = []
    for i, (sev, title, desc, impact) in enumerate(items, 1):
        rows.append([str(i), sev, f'<b>{title}</b><br/>{desc}', impact])
    t = make_table(headers, rows, [20, 55, 260, 155])
    return t


# ── Build Document ──
OUTPUT = '/home/z/my-project/download/deepmindq-audit-report.pdf'
os.makedirs(os.path.dirname(OUTPUT), exist_ok=True)

doc = SimpleDocTemplate(
    OUTPUT, pagesize=A4,
    leftMargin=50, rightMargin=50, topMargin=50, bottomMargin=50,
    title='DeepMindQ Intelligence OS - Comprehensive Audit Report',
    author='Z.ai',
    subject='Actual vs Planned Gap Analysis'
)

story = []

# ═══════════════════════════════════════════════════════
# COVER PAGE
# ═══════════════════════════════════════════════════════
story.append(Spacer(1, 120))
story.append(Paragraph('DeepMindQ Intelligence OS', s_title))
story.append(Spacer(1, 8))
story.append(Paragraph('Comprehensive Audit Report', ParagraphStyle('CoverSub',
    fontName='NotoSerifBold', fontSize=22, leading=28, textColor=C['accent'])))
story.append(Spacer(1, 24))
story.append(Paragraph('Actual vs. Planned Gap Analysis', s_subtitle))
story.append(Spacer(1, 40))
story.append(hr())
story.append(Spacer(1, 12))

meta_data = [
    ['Audit Date', 'August 14, 2026'],
    ['Scope', '97 screens, 41 API routes, infrastructure, DX'],
    ['Type', 'Full application audit'],
    ['Platform', 'Next.js 16 + Tailwind v4 + Prisma + Redis'],
]
meta_table = Table(
    [[Paragraph(f'<b>{r[0]}</b>', s_table_cell_muted), Paragraph(r[1], s_table_cell)] for r in meta_data],
    colWidths=[120, 370]
)
meta_table.setStyle(TableStyle([
    ('LINEBELOW', (0,0), (-1,-1), 0.5, C['border']),
    ('LEFTPADDING', (0,0), (-1,-1), 6),
    ('TOPPADDING', (0,0), (-1,-1), 5),
    ('BOTTOMPADDING', (0,0), (-1,-1), 5),
    ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
]))
story.append(meta_table)

story.append(PageBreak())

# ═══════════════════════════════════════════════════════
# EXECUTIVE SUMMARY
# ═══════════════════════════════════════════════════════
story.append(heading('1. Executive Summary'))
story.append(body(
    'This audit provides a comprehensive assessment of the DeepMindQ Intelligence OS platform, '
    'examining 97 screen components, 41 API routes, the full infrastructure stack, and developer experience. '
    'The analysis compares the actual implementation against the planned architecture to identify gaps, '
    'risks, and prioritized remediation paths. The platform demonstrates strong foundational architecture '
    'with a well-designed 7-engine AI pipeline, robust authentication, and a comprehensive Prisma schema. '
    'However, significant gaps exist in data connectivity, with 94% of screens relying on hardcoded mock '
    'data rather than real API endpoints, and critical infrastructure issues including a dead Tailwind v3 '
    'configuration, 330 lines of unused CSS tokens, and 6 stub cron routes that return hardcoded zeros.'
))
story.append(spacer(12))

# KPI Summary
kpi_data = [
    [Paragraph('<b>97</b>', s_kpi), Paragraph('<b>8</b>', s_kpi),
     Paragraph('<b>94%</b>', s_kpi), Paragraph('<b>41</b>', s_kpi),
     Paragraph('<b>6</b>', s_kpi)],
    [Paragraph('Total Screens', s_kpi_label), Paragraph('Production Screens', s_kpi_label),
     Paragraph('Mock Data Screens', s_kpi_label), Paragraph('API Routes', s_kpi_label),
     Paragraph('Stub Cron Routes', s_kpi_label)],
]
kpi_table = Table(kpi_data, colWidths=[98]*5)
kpi_table.setStyle(TableStyle([
    ('BACKGROUND', (0,0), (-1,-1), C['section_bg']),
    ('BOX', (0,0), (-1,-1), 1, C['border']),
    ('INNERGRID', (0,0), (-1,-1), 0.5, C['border']),
    ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ('TOPPADDING', (0,0), (-1,0), 10),
    ('BOTTOMPADDING', (0,1), (-1,1), 10),
    ('ALIGN', (0,0), (-1,-1), 'CENTER'),
]))
story.append(kpi_table)
story.append(spacer(12))

# Severity Distribution
story.append(heading('Severity Distribution'))
sev_data = [
    [Paragraph('<b>CRITICAL</b>', ParagraphStyle('SC', fontName='NotoSerifBold', fontSize=10, textColor=C['critical_red'])),
     Paragraph('<b>HIGH</b>', ParagraphStyle('SH', fontName='NotoSerifBold', fontSize=10, textColor=C['high_amber'])),
     Paragraph('<b>MEDIUM</b>', ParagraphStyle('SM', fontName='NotoSerifBold', fontSize=10, textColor=C['medium_blue'])),
     Paragraph('<b>LOW</b>', ParagraphStyle('SL', fontName='NotoSerifBold', fontSize=10, textColor=C['low_green']))],
    [Paragraph('7', s_kpi), Paragraph('8', s_kpi), Paragraph('9', s_kpi), Paragraph('8', s_kpi)],
]
sev_table = Table(sev_data, colWidths=[122.5]*4)
sev_table.setStyle(TableStyle([
    ('BACKGROUND', (0,0), (0,-1), C['critical_bg']),
    ('BACKGROUND', (1,0), (1,-1), C['high_bg']),
    ('BACKGROUND', (2,0), (2,-1), C['medium_bg']),
    ('BACKGROUND', (3,0), (3,-1), C['low_bg']),
    ('BOX', (0,0), (-1,-1), 1, C['border']),
    ('INNERGRID', (0,0), (-1,-1), 0.5, C['border']),
    ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ('TOPPADDING', (0,0), (-1,0), 6),
    ('BOTTOMPADDING', (0,1), (-1,1), 6),
    ('ALIGN', (0,0), (-1,-1), 'CENTER'),
]))
story.append(sev_table)

story.append(PageBreak())

# ═══════════════════════════════════════════════════════
# SECTION 2: SCREEN AUDIT
# ═══════════════════════════════════════════════════════
story.append(heading('2. Screen Component Audit'))
story.append(body(
    'The platform contains 97 screen components across two directories: 85 legacy screens in '
    '<font face="NotoSerif" color="#3B82F6">/components/screens/</font> and 8 Intelligence OS screens in '
    '<font face="NotoSerif" color="#3B82F6">/components/intelligence-os/</font>. '
    'Each screen was evaluated across 8 dimensions: API connectivity, design token usage, animations, '
    'interactivity, loading states, error handling, responsive design, and overall quality. The results '
    'reveal a significant disparity between the polished appearance and the actual data infrastructure.'
))
story.append(spacer(8))

story.append(heading('2.1 Quality Distribution', s_h2))
quality_data = [
    ['PRODUCTION', '8', '9%', 'Real API data + loading + error handling + responsive + interactive'],
    ['DECENT', '29', '34%', 'Interactive, good tokens use, some loading; but mock data'],
    ['MVP', '31', '36%', 'Has interactivity and/or loading, but all mock data, no error handling'],
    ['STUB', '17', '20%', 'Read-only display of hardcoded data, minimal/no interaction'],
]
story.append(make_table(['Rating', 'Count', '%', 'Description'], quality_data, [80, 50, 40, 320]))
story.append(spacer(8))

story.append(heading('2.2 API Connectivity Gap', s_h2))
story.append(body(
    'Only 8 screens connect to real backend APIs. The remaining 89 screens define their data as const arrays '
    'at the top of the file and render static content. This means that while the UI appears fully functional '
    'with rich data displays, interactive filters, and animated transitions, the actual data flow is entirely '
    'simulated. The screens that do connect to APIs are: settings-screen, data-import-screen, '
    'intelligence-hub-screen, companies-screen, contacts-screen, users-screen, ai-health-screen, and '
    'templates-screen. Notably, the 8 newly built Intelligence OS screens all use mock data with no '
    'API integration, making them visually impressive but operationally non-functional.'
))
story.append(spacer(8))

story.append(heading('2.3 Design Token Usage', s_h2))
story.append(body(
    '92% of screens (89/97) properly reference the design token system via tokens.* or var(--ios-*) CSS '
    'custom properties. However, 46 screen files contain at least one hardcoded hex color value, primarily '
    'in conditional color logic for severity levels and score thresholds. One screen, '
    'company-profile/intelligence-briefing.tsx, entirely bypasses the design token system and uses '
    'hardcoded Tailwind classes (text-gray-200, bg-white/[0.03], text-violet-400) that are incompatible '
    'with the dark theme. This file also uses raw fetch() instead of the project\'s fetchApi() utility, '
    'breaking the established error handling and authentication patterns.'
))
story.append(spacer(8))

story.append(heading('2.4 Animation & Interaction Coverage', s_h2))
anim_data = [
    ['Animations (Framer Motion)', '12', '12%', 'Only Intelligence OS + pipeline screens use motion'],
    ['Interactive State Management', '65', '67%', 'Most screens have filters, tabs, or click handlers'],
    ['Loading States', '56', '58%', 'ScreenSkeleton or Spinner on data fetch'],
    ['Error Handling (try/catch)', '12', '12%', 'Majority will silently fail on API errors'],
    ['Responsive (mobile breakpoints)', '72', '74%', 'Most use grid-cols responsive patterns'],
]
story.append(make_table(['Dimension', 'Screens', '%', 'Notes'], anim_data, [140, 50, 35, 265]))

story.append(PageBreak())

# ═══════════════════════════════════════════════════════
# SECTION 3: API ROUTE AUDIT
# ═══════════════════════════════════════════════════════
story.append(heading('3. API Route Audit'))
story.append(body(
    'The backend consists of 41 API routes organized into 6 categories: authentication (9 routes), '
    'business data (10 routes), knowledge graph (7 routes), AI/advisor (1 route), health monitoring '
    '(8 routes), and cron jobs (6 routes). The authentication system is exceptionally well-built with '
    'proper Zod validation, rate limiting, CSRF protection, timing-safe OTP comparison, and anti-enumeration '
    'measures. Health routes are also production-grade. However, all 6 cron routes are stubs, and several '
    'significant security gaps exist in the data routes.'
))
story.append(spacer(8))

story.append(heading('3.1 Route Quality Distribution', s_h2))
route_quality = [
    ['PRODUCTION', '13', 'Auth core (login, register, OTP, passwords) + Health routes'],
    ['DECENT', '22', 'Business data, Knowledge Graph, Advisor - have auth+validation+DB'],
    ['STUB', '6', 'All cron routes - return hardcoded zeros, no real work'],
]
story.append(make_table(['Rating', 'Count', 'Description'], route_quality, [80, 50, 360]))
story.append(spacer(8))

story.append(heading('3.2 Security Posture', s_h2))
story.append(body(
    'The authentication layer demonstrates strong security practices including centralized RBAC via '
    'checkApiAuth(), CSRF protection via withCsrf() on state-changing endpoints, timing-safe OTP comparison '
    'via timingSafeCompare(), anti-enumeration on login with generic error messages and fixed 1-second delay, '
    'and security headers applied at the proxy level. However, several gaps exist: the cron secret validation '
    'uses simple string equality (===) instead of crypto.timingSafeEqual(), making it vulnerable to timing '
    'side-channel attacks. Twenty authenticated data routes lack per-route rate limiting, relying solely on '
    'proxy-level edge limiting. The /api/knowledge-graph/discover endpoint uses Zod\'s .passthrough() which '
    'allows arbitrary fields to reach downstream library code without validation.'
))
story.append(spacer(8))

story.append(heading('3.3 Critical Finding: Profile Update Crash', s_h2))
story.append(body(
    'The /api/auth/update-profile route has a critical bug: its Zod schema allows phone, company, and '
    'designation fields, but the Prisma User model does not define these columns. Any profile update attempt '
    'that includes these fields will cause a Prisma runtime 500 error. The User model only has: id, email, '
    'name, role, passwordHash, otpCode, and otpExpiresAt. Either these fields must be added to the Prisma '
    'schema and a migration run, or they must be removed from the route\'s Zod validation schema.'
))

story.append(PageBreak())

# ═══════════════════════════════════════════════════════
# SECTION 4: INFRASTRUCTURE AUDIT
# ═══════════════════════════════════════════════════════
story.append(heading('4. Infrastructure & Configuration Audit'))
story.append(body(
    'The infrastructure layer reveals several significant configuration issues that affect maintainability, '
    'bundle size, and developer experience. While the core runtime is functional (TypeScript compiles cleanly, '
    'dev server starts in 9.4 seconds, zero build errors), the configuration debt creates confusion and '
    'wasted resources across the development lifecycle.'
))
story.append(spacer(8))

story.append(heading('4.1 Design System: Five Competing Token Systems', s_h2))
story.append(body(
    'The globals.css file (1,467 lines) contains five overlapping CSS custom property systems that create '
    'significant confusion and maintenance burden. The shadcn/Tailwind system (--background, --primary, --card) '
    'is canonical for UI primitives. The IOS system (--ios-bg-*, --ios-border-*) is the most widely adopted '
    'by screen components (40 files). However, the DMQ system (~250 properties defined, ZERO used), the Gold '
    'legacy system (~40 properties, ZERO used), and the MS6 Locked token system (~80 properties, near-zero '
    'usage) are entirely dead weight. Additionally, confidence colors conflict between systems: '
    '--confidence-high is #059669 in one system but #10b981 in another, despite representing the same '
    'semantic concept. Approximately 330 lines of CSS define tokens that no component references.'
))

token_systems = [
    ['shadcn/Tailwind (--primary, --card)', '~60', 'Active', 'UI primitives (Button, Card, etc.)'],
    ['IOS (--ios-bg-*, --ios-text-*)', '~40', 'Active', '40 screen components'],
    ['Gold Legacy (--color-gold-*)', '~40', 'DEAD', 'Zero component references'],
    ['MS6 Locked (--signal-blue-*)', '~80', 'DEAD', 'Near-zero usage'],
    ['DMQ Bridge (--dmq-amber-*)', '~250', 'DEAD', 'Zero component references'],
]
story.append(make_table(['System', 'Props', 'Status', 'Used By'], token_systems,
    [150, 45, 45, 250]))
story.append(spacer(8))

story.append(heading('4.2 Tailwind v3/v4 Conflict', s_h2))
story.append(body(
    'The project uses Tailwind CSS v4 (via @tailwindcss/postcss in postcss.config.mjs and @import "tailwindcss" '
    'in globals.css), but retains a v3-style tailwind.config.ts file. This v3 config is completely dead -- '
    'Tailwind v4 ignores it unless explicitly imported via @config. The dead config wraps all colors in '
    'hsl() functions, but the actual CSS variables use hex values, which would produce invalid CSS (hsl(#2563eb)). '
    'Additionally, tailwindcss-animate (a v3 plugin) is installed as a dependency but unused; the project '
    'actually uses tw-animate-css (v4 compatible). The tsconfig.json targets ES2017, unusually low for a '
    'Next.js 16 project which defaults to ES2022+, forcing unnecessary downleveling of modern JavaScript features.'
))
story.append(spacer(8))

story.append(heading('4.3 Bundle Size & Unused Dependencies', s_h2))
unused_deps = [
    ['@xenova/transformers', '~50MB', 'CRITICAL', 'Never imported anywhere in src/'],
    ['pdfkit', '~2MB', 'MEDIUM', 'Never imported in src/'],
    ['mammoth', '~1MB', 'MEDIUM', 'Never imported in src/'],
    ['next-themes', '~50KB', 'LOW', 'Never imported in src/'],
    ['tailwindcss-animate', '~20KB', 'LOW', 'V3 plugin, project uses v4'],
    ['9 unused shadcn wrappers', '~200KB', 'LOW', 'drawer, navigation-menu, collapsible, etc.'],
]
story.append(make_table(['Package', 'Size', 'Severity', 'Evidence'], unused_deps,
    [130, 60, 60, 240]))
story.append(spacer(6))
story.append(body(
    'The optimizePackageImports configuration for recharts, framer-motion, and lucide-react is only active '
    'when ANALYZE=true, meaning tree-shaking for these major bundle contributors is OFF in normal builds. '
    'The images.unoptimized: true setting in next.config.ts disables all Next.js image optimization, which '
    'is a footgun for future development if any next/image usage is added.'
))

story.append(PageBreak())

# ═══════════════════════════════════════════════════════
# SECTION 5: TESTING AUDIT
# ═══════════════════════════════════════════════════════
story.append(heading('5. Testing Coverage Audit'))
story.append(body(
    'The project has 30 test files covering 4 categories: end-to-end tests (4 Playwright tests for health, '
    'screens, navigation, and auth), API tests (4 tests for settings, organizations, people, and signals), '
    'unit tests (8 tests for auth, RBAC, CSRF, validation, and screen smoke tests), intelligence tests (4 tests '
    'for knowledge graph, signals reasoning, and ingestion), and AI tests (8 tests for governance, model '
    'router, LLM streaming, Redis cache, prompt registry, AI cache layer, and quality gates). While the '
    'test infrastructure is comprehensive for backend and AI components, the frontend coverage is critically '
    'inadequate.'
))
story.append(spacer(8))

testing_gaps = [
    ['Intelligence OS Screens', '0/8', 'CRITICAL', 'No tests exist for any of the 8 new Intel OS screens'],
    ['Screen Behavior Tests', '0', 'CRITICAL', 'Smoke tests only verify render, no interaction testing'],
    ['Integration Tests', '0', 'HIGH', 'No tests verify data flow between screens and APIs'],
    ['Component Unit Tests', '0', 'MEDIUM', 'No tests for shared components (DataTable, StatCard, etc.)'],
    ['Screens Smoke Coverage', '~60/85', 'LOW', 'Covers legacy screens but misses Intel OS directory'],
]
story.append(make_table(['Gap Area', 'Coverage', 'Severity', 'Details'], testing_gaps,
    [120, 60, 55, 255]))
story.append(spacer(6))
story.append(body(
    'The primary screen test (screens-smoke.test.ts) only verifies that components render without crashing '
    'using renderToString and checking html.length > 0. It makes zero behavioral assertions about user '
    'interactions, data flow, state changes, or error handling. This means a screen could render its initial '
    'state correctly but fail completely when a user clicks a button, changes a filter, or submits a form, '
    'and no test would catch it. The 8 Intelligence OS screens are completely absent from all test files, '
    'representing a significant quality gap for the platform\'s primary navigation items.'
))

story.append(PageBreak())

# ═══════════════════════════════════════════════════════
# SECTION 6: PRIORITY ACTION ITEMS
# ═══════════════════════════════════════════════════════
story.append(heading('6. Prioritized Action Items'))
story.append(body(
    'The following 32 findings are organized by severity and estimated remediation effort. Each item includes '
    'the specific gap, its impact on the platform, and a concrete remediation step. Items are ordered by '
    'business impact: critical items that affect data integrity and security come first, followed by high-priority '
    'items that affect functionality, then medium and low items that affect maintainability and developer experience.'
))
story.append(spacer(8))

story.append(heading('6.1 Critical Priority (P0)', s_h2))
story.append(body(
    'These items represent immediate risks to data integrity, security, or core functionality. They should be '
    'addressed before any production deployment.'
))

p0_items = [
    ('CRITICAL', 'Profile update writes non-existent DB fields',
     '/api/auth/update-profile allows phone/company/designation but User model lacks these columns. '
     'Any update attempt returns Prisma 500 error.',
     'Add fields to Prisma schema + migration, or remove from Zod schema'),
    ('CRITICAL', '94% of screens use mock data',
     '89 of 97 screens define const arrays and never call real APIs. The UI appears functional but all '
     'data is hardcoded. Business users see realistic but fake information.',
     'Wire screens to existing API routes; start with highest-traffic: sequences, opportunities, pipeline, '
     'leads, tasks'),
    ('CRITICAL', '6 cron routes are stubs returning zeros',
     'data-retention, persistence-evidence, persistence-performance, calibration-runner, backup-verify, '
     'and job-processor all have TODO comments and return hardcoded values.',
     'Implement actual cron logic or remove routes and document as unimplemented'),
    ('CRITICAL', 'Tailwind v3 config is dead, creating confusion',
     'tailwind.config.ts is completely ignored by Tailwind v4. It contains invalid hsl(hex) color '
     'definitions that would break if the config were ever activated.',
     'Delete tailwind.config.ts, remove tailwindcss-animate dependency'),
]
story.append(severity_table(p0_items))
story.append(spacer(12))

story.append(heading('6.2 High Priority (P1)', s_h2))
story.append(body(
    'These items affect security boundaries, data consistency, or significant functionality gaps.'
))

p1_items = [
    ('HIGH', 'Cron secret comparison not timing-safe',
     'All 5 cron routes use === for secret comparison, vulnerable to timing side-channel attacks. '
     'An attacker could infer the secret character-by-character.',
     'Replace === with crypto.timingSafeEqual() in validateCronSecret()'),
    ('HIGH', 'No per-route rate limiting on 20+ data routes',
     'Only auth routes have rate limiting. Data routes (organizations, signals, knowledge-graph, '
     'advisor/pipeline) have no per-endpoint throttling.',
     'Add rate limits to expensive routes, especially /api/advisor/pipeline'),
    ('HIGH', '.passthrough() on discover endpoint allows unvalidated input',
     '/api/knowledge-graph/discover uses Zod .passthrough() allowing arbitrary fields to reach '
     'downstream discoverRelationships() function.',
     'Remove .passthrough(), explicitly define all allowed fields'),
    ('HIGH', '330+ lines of dead CSS tokens in globals.css',
     '~250 --dmq-* tokens, ~40 gold tokens, ~80 MS6 tokens are defined but never referenced by '
     'any component. They add 330+ lines of noise.',
     'Delete all --dmq-*, gold, and unused MS6 token blocks'),
    ('HIGH', 'Zero tests for 8 Intelligence OS screens',
     'The 8 newly built primary navigation screens (Intelligence Ops, Command Center, etc.) have no '
     'test coverage whatsoever.',
     'Add smoke tests + basic behavioral tests for all 8 screens'),
    ('HIGH', 'company-profile/intelligence-briefing.tsx has broken theming',
     'Uses text-gray-200, bg-white/[0.03], text-violet-400 instead of design tokens. Also uses '
     'raw fetch() instead of fetchApi().',
     'Replace all hardcoded Tailwind classes with design token references'),
    ('HIGH', '@xenova/transformers (~50MB) installed but never used',
     'This enormous package is a renamed/deprecated dependency. It bloats node_modules and CI/CD '
     'caches significantly.',
     'Remove from package.json'),
    ('HIGH', 'update-profile uses non-existent Prisma fields',
     'The Zod schema allows phone, company, designation fields that do not exist on the User model. '
     'Writing these fields causes a Prisma runtime error.',
     'Add fields to schema.prisma User model + run migration'),
]
story.append(severity_table(p1_items))

story.append(PageBreak())

story.append(heading('6.3 Medium Priority (P2)', s_h2))

p2_items = [
    ('MEDIUM', 'Only 12% of screens have error handling',
     '85 screens lack try/catch or error states. If API calls were added without error handling, '
     'runtime errors would crash the screen or show no feedback.',
     'Add error boundary fallbacks and try/catch to all screens being wired to APIs'),
    ('MEDIUM', 'SCREEN_MAP uses string keys instead of ViewId type',
     'Record<string, ScreenComponent> allows typos in screen keys to silently pass. Should be '
     'Record<ViewId, ScreenComponent> for compile-time validation.',
     'Type SCREEN_MAP as Record<ViewId, ScreenComponent>'),
    ('MEDIUM', 'optimizePackageImports off by default',
     'Tree-shaking for recharts, framer-motion, lucide-react only active when ANALYZE=true. '
     'These are major bundle contributors.',
     'Enable optimizePackageImports unconditionally in next.config.ts'),
    ('MEDIUM', 'require() in screen-map.tsx ESM context',
     'ContactDetailBridge uses require(@/lib/store) and require(react) in a use client module. '
     'Breaks tree-shaking and static analysis.',
     'Convert to ES import statements'),
    ('MEDIUM', 'Conflicting confidence color values across token systems',
     '--confidence-high is #059669 in one system but #10b981 in another. Same semantic concept, '
     'different visual representation.',
     'Consolidate to single canonical value per semantic token'),
    ('MEDIUM', 'No CORS configuration on any API route',
     'Zero Access-Control-Allow-Origin headers. Blocks legitimate cross-origin consumers (mobile apps, '
     'third-party integrations).',
     'Add CORS headers or document same-origin assumption'),
    ('MEDIUM', '20+ files with explicit any types',
     'Screen map, LLM client, Redis client, DB client, and 7 screen files use untyped any.',
     'Progressive typing of function signatures and data shapes'),
    ('MEDIUM', 'images.unoptimized disables Next.js image optimization',
     'next.config.ts has images: { unoptimized: true }, removing all <Image> optimization benefits.',
     'Remove unless Docker-specific requirement exists'),
    ('MEDIUM', 'tsconfig targets ES2017, too low for Next.js 16',
     'Forces downleveling of modern JS features that Next.js 16 assumes are available.',
     'Update target to ES2022 or remove to use Next.js default'),
]
story.append(severity_table(p2_items))
story.append(spacer(12))

story.append(heading('6.4 Low Priority (P3)', s_h2))

p3_items = [
    ('LOW', 'No page-level authentication gate on main page.tsx',
     'The app shell renders the full dashboard without checking if a user is authenticated. Any '
     'visitor sees the Intelligence OS interface.',
     'Add auth check before rendering AppSidebar + AppHeader'),
    ('LOW', '9 unused shadcn UI component wrappers',
     'drawer, navigation-menu, collapsible, context-menu, hover-card, menubar, toggle, toggle-group, '
     'carousel are installed but never imported by any screen.',
     'Remove dead components and their Radix dependencies'),
    ('LOW', 'Duplicate screen mappings in screen-map.tsx',
     'company-workspace, company-detail, company-profile all map to CompanyProfileScreen. '
     'accounts and companies both map to CompaniesScreen.',
     'Document intentional aliases or consolidate to canonical mappings'),
    ('LOW', 'setSidebarCollapsed implemented but not in AppState interface',
     'The function exists in the store implementation but is not declared in the TypeScript interface.',
     'Add setSidebarCollapsed and sidebarCollapsed to AppState interface'),
    ('LOW', 'Demo and signup pages were recently fixed to dark theme',
     'Both pages now match the Intelligence OS palette, but the signup page still uses a split-screen '
     'layout with a light-panel history that may confuse some users.',
     'Consider full-page dark layout for consistency'),
    ('LOW', 'Pipeline screen Kanban has no mobile breakpoint handling',
     'The drag-and-drop Kanban board is desktop-only and would be unusable on mobile devices.',
     'Add a list-view fallback for mobile viewports'),
    ('LOW', 'Intelligence OS screens lack memoization',
     'Only 1 of 8 Intelligence OS screens uses useMemo/useCallback. These are large components '
     'with complex state that could benefit from memoization.',
     'Add useMemo/useCallback to expensive computations in Intel OS screens'),
    ('LOW', 'next-themes installed but never used',
     'The theming library is a dependency but the app is hardcoded to dark theme only.',
     'Remove or implement light/dark theme toggle'),
]
story.append(severity_table(p3_items))

story.append(PageBreak())

# ═══════════════════════════════════════════════════════
# SECTION 7: GAP ANALYSIS MATRIX
# ═══════════════════════════════════════════════════════
story.append(heading('7. Actual vs. Planned Gap Analysis Matrix'))
story.append(body(
    'This matrix maps the planned platform capabilities against actual implementation status, providing '
    'a clear view of where the platform meets its design intent and where significant gaps remain. '
    'Each capability area is assessed on a maturity scale from Not Started to Production.'
))
story.append(spacer(8))

gap_data = [
    ['Signal Detection & Monitoring', 'Production', '85%', 'Real API, filters, DataTable, pagination. Needs more signal types.'],
    ['AI-Powered Scoring', 'MVP', '30%', 'Scoring config screen exists but no real AI scoring pipeline connected to UI.'],
    ['Revenue Intelligence', 'MVP', '25%', 'Screens built with mock data. No real revenue data pipeline.'],
    ['Pipeline Management', 'Decent', '60%', 'DnD Kanban works with mock data. Real pipeline API exists but not wired.'],
    ['Knowledge Management', 'MVP', '35%', 'Knowledge library and workspace built. No real knowledge graph queries.'],
    ['Sequence Automation', 'Decent', '55%', 'Full sequence builder UI. Uses mock sequence data, no send integration.'],
    ['AI Command Center', 'MVP', '40%', 'Monitoring dashboard with mock metrics. Real AI health API exists.'],
    ['Intelligence Search', 'Decent', '50%', 'Search UI recently built. No real search backend (no Elasticsearch).'],
    ['Intelligence Briefing', 'Decent', '45%', 'Briefing viewer built. Generate button is cosmetic only.'],
    ['Authentication & RBAC', 'Production', '95%', 'Full OTP flow, CSRF, rate limiting, RBAC matrix.'],
    ['Health Monitoring', 'Production', '90%', '7 health endpoints, liveness, readiness, Prometheus metrics.'],
    ['Cron Operations', 'Stub', '5%', '6 routes exist but all return hardcoded zeros.'],
    ['Data Import', 'Production', '75%', 'File upload, validation, history. Connected to real ingestion API.'],
    ['Settings Management', 'Production', '80%', 'Full CRUD with real API. Env-based config.'],
]
story.append(make_table(
    ['Capability Area', 'Status', 'Complete', 'Gap Description'],
    gap_data, [120, 55, 50, 265]
))

story.append(PageBreak())

# ═══════════════════════════════════════════════════════
# SECTION 8: RECOMMENDED ROADMAP
# ═══════════════════════════════════════════════════════
story.append(heading('8. Recommended Remediation Roadmap'))
story.append(body(
    'Based on the findings, the following phased roadmap prioritizes the highest-impact items first. '
    'Phase 1 addresses critical security and data integrity issues. Phase 2 connects the UI to real data. '
    'Phase 3 cleans up technical debt. Phase 4 enhances quality and coverage.'
))
story.append(spacer(8))

story.append(heading('Phase 1: Security & Integrity (Week 1-2)', s_h2))
story.append(bullet('Fix update-profile Prisma schema mismatch (P0) -- add User fields or remove from Zod'))
story.append(bullet('Replace === with crypto.timingSafeEqual() in cron secret validation (P1)'))
story.append(bullet('Remove .passthrough() from /api/knowledge-graph/discover endpoint (P1)'))
story.append(bullet('Add per-route rate limiting to data endpoints (P1)'))
story.append(bullet('Add authentication gate to main page.tsx (P3)'))
story.append(spacer(6))

story.append(heading('Phase 2: Data Connectivity (Week 3-6)', s_h2))
story.append(bullet('Wire top 10 screens to real APIs: sequences, opportunities, pipeline, leads, tasks, intelligence ops, command center, activation workspace, knowledge workspace, capability workspace'))
story.append(bullet('Implement real search backend (Elasticsearch or PostgreSQL full-text) for Intelligence Search'))
story.append(bullet('Connect Intelligence Briefing to real /api/briefings endpoint with generation'))
story.append(bullet('Add error handling (try/catch + fallback UI) to all newly wired screens'))
story.append(bullet('Replace mock data generation (Math.random(), getMockSignals) with real data fetching'))
story.append(spacer(6))

story.append(heading('Phase 3: Technical Debt Cleanup (Week 7-8)', s_h2))
story.append(bullet('Delete dead Tailwind v3 config and tailwindcss-animate dependency'))
story.append(bullet('Remove 330+ lines of unused CSS tokens (--dmq-*, gold, unused MS6)'))
story.append(bullet('Remove unused dependencies: @xenova/transformers, pdfkit, mammoth, next-themes'))
story.append(bullet('Consolidate design token systems to 2 (shadcn + ios), deprecate the rest'))
story.append(bullet('Fix conflicting confidence color values across token systems'))
story.append(bullet('Convert require() to import in screen-map.tsx'))
story.append(bullet('Type SCREEN_MAP as Record<ViewId, ScreenComponent>'))
story.append(bullet('Update tsconfig target to ES2022'))
story.append(spacer(6))

story.append(heading('Phase 4: Quality & Coverage (Week 9-12)', s_h2))
story.append(bullet('Add tests for all 8 Intelligence OS screens (smoke + behavioral)'))
story.append(bullet('Add integration tests for screen-to-API data flow'))
story.append(bullet('Fix company-profile/intelligence-briefing.tsx theming'))
story.append(bullet('Add memoization to Intelligence OS screens'))
story.append(bullet('Add responsive fallbacks for pipeline Kanban on mobile'))
story.append(bullet('Enable optimizePackageImports for recharts, framer-motion, lucide'))
story.append(bullet('Implement real cron job logic or remove stub routes'))
story.append(bullet('Add CORS configuration if cross-origin access is needed'))

# ── Build ──
doc.build(story)
print(f'PDF generated: {OUTPUT}')
