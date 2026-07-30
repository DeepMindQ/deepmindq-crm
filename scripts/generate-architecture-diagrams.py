#!/usr/bin/env python3
"""
DeepMindQ Architecture Diagrams Generator
Generates 5 standalone HTML files with interactive architecture diagrams.
Uses Playwright-free CSS-based diagrams for maximum compatibility.
"""

import os

OUTPUT_DIR = "/home/z/my-project/download"

# ─────────────────────────────────────────────────────────────────────────────
# COMMON STYLES
# ─────────────────────────────────────────────────────────────────────────────

COMMON_CSS = """
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif;
  background: #0a0c10;
  color: #e2e8f0;
  padding: 40px;
  min-height: 100vh;
}
h1 {
  font-size: 28px;
  font-weight: 700;
  color: #f8fafc;
  margin-bottom: 8px;
  letter-spacing: -0.5px;
}
h2 {
  font-size: 18px;
  font-weight: 600;
  color: #94a3b8;
  margin-bottom: 32px;
  font-weight: 400;
}
.subtitle {
  color: #64748b;
  font-size: 14px;
  margin-bottom: 40px;
}
.diagram-container {
  max-width: 1200px;
  margin: 0 auto;
}
.layer {
  border: 1px solid rgba(148, 163, 184, 0.15);
  border-radius: 12px;
  padding: 20px 24px;
  margin-bottom: 2px;
  position: relative;
  background: rgba(15, 18, 25, 0.8);
  transition: all 0.3s ease;
}
.layer:hover {
  border-color: rgba(148, 163, 184, 0.3);
  background: rgba(15, 18, 25, 1);
}
.layer-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}
.layer-badge {
  font-size: 11px;
  font-weight: 700;
  padding: 3px 10px;
  border-radius: 20px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.layer-title {
  font-size: 15px;
  font-weight: 600;
  color: #f1f5f9;
}
.layer-desc {
  font-size: 12px;
  color: #64748b;
  margin-left: auto;
}
.boxes {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.box {
  padding: 8px 14px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 500;
  border: 1px solid transparent;
}
.box-sm { padding: 6px 10px; font-size: 11px; }

/* Colors */
.c-blue { background: rgba(59, 130, 246, 0.12); border-color: rgba(59, 130, 246, 0.25); color: #93c5fd; }
.c-green { background: rgba(34, 197, 94, 0.12); border-color: rgba(34, 197, 94, 0.25); color: #86efac; }
.c-purple { background: rgba(168, 85, 247, 0.12); border-color: rgba(168, 85, 247, 0.25); color: #d8b4fe; }
.c-amber { background: rgba(245, 158, 11, 0.12); border-color: rgba(245, 158, 11, 0.25); color: #fcd34d; }
.c-red { background: rgba(239, 68, 68, 0.12); border-color: rgba(239, 68, 68, 0.25); color: #fca5a5; }
.c-cyan { background: rgba(6, 182, 212, 0.12); border-color: rgba(6, 182, 212, 0.25); color: #67e8f9; }
.c-pink { background: rgba(236, 72, 153, 0.12); border-color: rgba(236, 72, 153, 0.25); color: #f9a8d4; }
.c-indigo { background: rgba(99, 102, 241, 0.12); border-color: rgba(99, 102, 241, 0.25); color: #a5b4fc; }

/* Arrow between layers */
.arrow-down {
  text-align: center;
  color: #475569;
  font-size: 18px;
  padding: 4px 0;
  line-height: 1;
}
.flow-row {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.flow-arrow {
  color: #475569;
  font-size: 16px;
}
.connector {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px 0;
}
.connector-line {
  width: 2px;
  height: 24px;
  background: linear-gradient(to bottom, #334155, #475569);
}

/* Grid layout for data model */
.grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; }

.domain-card {
  border: 1px solid rgba(148, 163, 184, 0.12);
  border-radius: 12px;
  padding: 16px;
  background: rgba(15, 18, 25, 0.6);
}
.domain-title {
  font-size: 13px;
  font-weight: 700;
  margin-bottom: 10px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.domain-count {
  font-size: 10px;
  padding: 2px 7px;
  border-radius: 10px;
  background: rgba(148, 163, 184, 0.1);
  color: #94a3b8;
}
.model-tag {
  display: inline-block;
  font-size: 11px;
  padding: 3px 8px;
  border-radius: 4px;
  margin: 2px;
  background: rgba(148, 163, 184, 0.08);
  color: #94a3b8;
  border: 1px solid rgba(148, 163, 184, 0.06);
}

/* Timeline */
.timeline-item {
  position: relative;
  padding-left: 32px;
  padding-bottom: 24px;
  border-left: 2px solid rgba(148, 163, 184, 0.15);
  margin-left: 8px;
}
.timeline-item:last-child { border-left-color: transparent; }
.timeline-dot {
  position: absolute;
  left: -7px;
  top: 0;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 2px solid;
}
.timeline-title {
  font-size: 14px;
  font-weight: 600;
  color: #f1f5f9;
  margin-bottom: 4px;
}
.timeline-desc {
  font-size: 12px;
  color: #94a3b8;
  line-height: 1.5;
}
.timeline-meta {
  font-size: 11px;
  color: #64748b;
  margin-top: 4px;
}

/* Roadmap */
.ticket-row {
  display: grid;
  grid-template-columns: 50px 1fr 80px 80px 1fr;
  gap: 12px;
  align-items: center;
  padding: 12px 16px;
  border: 1px solid rgba(148, 163, 184, 0.08);
  border-radius: 8px;
  margin-bottom: 4px;
  background: rgba(15, 18, 25, 0.4);
  font-size: 12px;
}
.ticket-row:hover {
  background: rgba(15, 18, 25, 0.8);
  border-color: rgba(148, 163, 184, 0.15);
}
.ticket-num {
  font-weight: 700;
  font-size: 14px;
}
.ticket-deps {
  font-size: 11px;
  color: #64748b;
}
.ticket-priority {
  font-size: 10px;
  font-weight: 700;
  padding: 3px 8px;
  border-radius: 4px;
  text-align: center;
}
.p-p0 { background: rgba(239, 68, 68, 0.15); color: #fca5a5; }
.p-p1 { background: rgba(245, 158, 11, 0.15); color: #fcd34d; }
.p-p2 { background: rgba(59, 130, 246, 0.15); color: #93c5fd; }
.p-p3 { background: rgba(148, 163, 184, 0.15); color: #94a3b8; }

.footer {
  text-align: center;
  color: #334155;
  font-size: 11px;
  margin-top: 48px;
  padding-top: 24px;
  border-top: 1px solid rgba(148, 163, 184, 0.06);
}

/* Mindmap */
.center-node {
  width: 160px;
  height: 80px;
  border-radius: 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 14px;
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  z-index: 10;
}
.branch {
  position: absolute;
  padding: 10px 16px;
  border-radius: 10px;
  font-size: 12px;
  font-weight: 600;
  max-width: 140px;
  text-align: center;
  line-height: 1.3;
}

/* API table */
.api-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}
.api-table th {
  text-align: left;
  padding: 10px 12px;
  font-size: 11px;
  font-weight: 600;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.15);
}
.api-table td {
  padding: 10px 12px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.06);
  vertical-align: top;
}
.api-table tr:hover td {
  background: rgba(15, 18, 25, 0.6);
}
.method-badge {
  font-size: 10px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 4px;
  display: inline-block;
}
"""

# ─────────────────────────────────────────────────────────────────────────────
# DIAGRAM 1: SYSTEM ARCHITECTURE
# ─────────────────────────────────────────────────────────────────────────────

DIAGRAM_1 = f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>DeepMindQ — System Architecture</title>
<style>{COMMON_CSS}
.layer-l1 .layer-badge {{ background: rgba(59,130,246,0.2); color: #93c5fd; }}
.layer-l2 .layer-badge {{ background: rgba(34,197,94,0.2); color: #86efac; }}
.layer-l3 .layer-badge {{ background: rgba(168,85,247,0.2); color: #d8b4fe; }}
.layer-l4 .layer-badge {{ background: rgba(245,158,11,0.2); color: #fcd34d; }}
.layer-l5 .layer-badge {{ background: rgba(239,68,68,0.2); color: #fca5a5; }}
.layer-l6 .layer-badge {{ background: rgba(6,182,212,0.2); color: #67e8f9; }}
.rule-box {{
  border: 1px dashed rgba(239, 68, 68, 0.25);
  border-radius: 10px;
  padding: 16px 20px;
  margin-top: 32px;
  background: rgba(239, 68, 68, 0.04);
}}
.rule-title {{
  font-size: 13px;
  font-weight: 700;
  color: #fca5a5;
  margin-bottom: 12px;
}}
.rule-item {{
  font-size: 12px;
  color: #cbd5e1;
  padding: 4px 0;
  padding-left: 16px;
  position: relative;
}}
.rule-item::before {{
  content: '\\25B6';
  position: absolute;
  left: 0;
  color: #ef4444;
  font-size: 8px;
  top: 7px;
}}
.tech-row {{
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 8px;
  margin-top: 32px;
}}
.tech-card {{
  border: 1px solid rgba(148, 163, 184, 0.1);
  border-radius: 8px;
  padding: 12px;
  text-align: center;
  background: rgba(15, 18, 25, 0.4);
}}
.tech-name {{
  font-size: 12px;
  font-weight: 700;
  color: #f1f5f9;
  margin-bottom: 4px;
}}
.tech-detail {{
  font-size: 10px;
  color: #64748b;
}}
</style></head><body>
<div class="diagram-container">
  <h1>DeepMindQ — System Architecture</h1>
  <h2>6-Layer Intelligence Stack &mdash; 90 Models &middot; 14 Engines &middot; 208 API Routes &middot; 76 Screens</h2>

  <!-- LAYER 1: Frontend -->
  <div class="layer layer-l1">
    <div class="layer-header">
      <span class="layer-badge">Layer 1</span>
      <span class="layer-title">Frontend</span>
      <span class="layer-desc">76 Screens &middot; Next.js 16 App Router &middot; React 19</span>
    </div>
    <div class="boxes">
      <div class="box c-blue">Command Center</div>
      <div class="box c-blue">5Q Workspace</div>
      <div class="box c-blue">Opportunity Radar</div>
      <div class="box c-blue">Signal Intelligence</div>
      <div class="box c-blue">Intelligence Inbox</div>
      <div class="box c-blue">Knowledge Library</div>
      <div class="box c-blue">Account Ranking</div>
      <div class="box c-blue">Pipeline Forecast</div>
      <div class="box c-blue">Conversation Prep</div>
      <div class="box c-blue">+67 more screens</div>
      <div class="box c-indigo box-sm">Zustand</div>
      <div class="box c-indigo box-sm">React Query</div>
      <div class="box c-indigo box-sm">shadcn/ui</div>
      <div class="box c-indigo box-sm">Cmd+K Palette</div>
    </div>
  </div>

  <div class="arrow-down">&#9660;</div>

  <!-- LAYER 2: Intelligence API -->
  <div class="layer layer-l2">
    <div class="layer-header">
      <span class="layer-badge">Layer 2</span>
      <span class="layer-title">Intelligence API Layer</span>
      <span class="layer-desc">6 Product Endpoints &mdash; The ONLY frontend contract</span>
    </div>
    <div class="boxes">
      <div class="box c-green">GET /intelligence/company/{{id}}</div>
      <div class="box c-green">GET /intelligence/reasoning/{{id}}</div>
      <div class="box c-green">GET /intelligence/opportunity/{{id}}</div>
      <div class="box c-green">GET /intelligence/action/{{id}}</div>
      <div class="box c-green">GET /intelligence/conversation/{{id}}</div>
      <div class="box c-green">GET /intelligence/mindmap/{{id}}</div>
      <div class="box box-sm c-green" style="opacity:0.6">All support ?include= selective loading</div>
    </div>
  </div>

  <div class="arrow-down">&#9660;</div>

  <!-- LAYER 3: Orchestration -->
  <div class="layer layer-l3">
    <div class="layer-header">
      <span class="layer-badge">Layer 3</span>
      <span class="layer-title">Intelligence Orchestration</span>
      <span class="layer-desc">Reasoning &middot; Multi-Agent &middot; Fusion &middot; Learning</span>
    </div>
    <div class="boxes">
      <div class="box c-purple">Enterprise Reasoning (30-step)</div>
      <div class="box c-purple">Multi-Agent Orchestrator (10 specialists)</div>
      <div class="box c-purple">Fusion Engine (External + Internal)</div>
      <div class="box c-purple">Continuous Learning Loop</div>
      <div class="box c-purple">Knowledge Ingestion Pipeline</div>
    </div>
  </div>

  <div class="arrow-down">&#9660;</div>

  <!-- LAYER 4: Governed AI Engines -->
  <div class="layer layer-l4">
    <div class="layer-header">
      <span class="layer-badge">Layer 4</span>
      <span class="layer-title">Governed AI Engines (7 Composable)</span>
      <span class="layer-desc">Foundation + Composition pattern</span>
    </div>
    <div class="flow-row">
      <div style="display:flex;flex-direction:column;gap:6px;">
        <div class="box c-amber box-sm" style="width:120px;text-align:center;font-weight:700;">Foundation</div>
        <div class="box c-amber box-sm" style="width:120px">ModelRouter</div>
        <div class="box c-amber box-sm" style="width:120px">GroundingEngine</div>
        <div class="box c-amber box-sm" style="width:120px">RetrievalEngine</div>
      </div>
      <div class="flow-arrow">&#10132;</div>
      <div style="display:flex;flex-direction:column;gap:6px;">
        <div class="box c-amber box-sm" style="width:120px;text-align:center;font-weight:700;">Composition</div>
        <div class="box c-amber box-sm" style="width:120px">SynthesisEngine</div>
        <div class="box c-amber box-sm" style="width:120px">ScoringEngine</div>
        <div class="box c-amber box-sm" style="width:120px">ActionEngine</div>
        <div class="box c-amber box-sm" style="width:120px">ConversationEngine</div>
      </div>
    </div>
  </div>

  <div class="arrow-down">&#9660;</div>

  <!-- LAYER 5: AI Foundation -->
  <div class="layer layer-l5">
    <div class="layer-header">
      <span class="layer-badge">Layer 5</span>
      <span class="layer-title">AI Foundation</span>
      <span class="layer-desc">Model Routing &middot; Governance &middot; Evidence &middot; Cost</span>
    </div>
    <div class="boxes">
      <div class="box c-red">Model Router (Deep/Smart/Fast)</div>
      <div class="box c-red">AI Governance (governedAI wrapper)</div>
      <div class="box c-red">Evidence Framework</div>
      <div class="box c-red">Hallucination Detection</div>
      <div class="box c-red">AI Cost Tracking</div>
      <div class="box c-red">ESLint: no-ungoverned-llm</div>
    </div>
  </div>

  <div class="arrow-down">&#9660;</div>

  <!-- LAYER 6: Data Layer -->
  <div class="layer layer-l6">
    <div class="layer-header">
      <span class="layer-badge">Layer 6</span>
      <span class="layer-title">Data Layer</span>
      <span class="layer-desc">PostgreSQL + pgvector &middot; 90 Prisma Models &middot; @xenova/transformers</span>
    </div>
    <div class="boxes">
      <div class="box c-cyan">PostgreSQL + pgvector</div>
      <div class="box c-cyan">Prisma ORM (90 models)</div>
      <div class="box c-cyan">@xenova/transformers</div>
      <div class="box c-cyan">Embedding Index</div>
      <div class="box c-cyan">Job Queue (Prisma Jobs)</div>
      <div class="box c-cyan">Cron Processor</div>
    </div>
  </div>

  <!-- Strict Rules -->
  <div class="rule-box">
    <div class="rule-title">Strict Architecture Rules</div>
    <div class="rule-item">Frontend NEVER calls engines directly &mdash; all intelligence flows through Layer 2</div>
    <div class="rule-item">All LLM calls go through governedAI() &mdash; ESLint rule blocks ungoverned calls</div>
    <div class="rule-item">Every AI output includes evidence citations &mdash; no hallucinated claims</div>
    <div class="rule-item">Every generation is audited &mdash; AIGenerationAudit record for every AI output</div>
    <div class="rule-item">Model Router handles all LLM routing &mdash; tiered fallback (Deep &rarr; Smart &rarr; Fast)</div>
  </div>

  <!-- Tech Stack -->
  <div class="tech-row">
    <div class="tech-card"><div class="tech-name">Next.js 16</div><div class="tech-detail">App Router</div></div>
    <div class="tech-card"><div class="tech-name">React 19</div><div class="tech-detail">+ Tailwind 4</div></div>
    <div class="tech-card"><div class="tech-name">Prisma 6</div><div class="tech-detail">90 Models</div></div>
    <div class="tech-card"><div class="tech-name">PostgreSQL</div><div class="tech-detail">+ pgvector</div></div>
    <div class="tech-card"><div class="tech-name">Vitest</div><div class="tech-detail">Testing</div></div>
    <div class="tech-card"><div class="tech-name">Sentry</div><div class="tech-detail">Monitoring</div></div>
  </div>

  <div class="footer">DeepMindQ System Architecture &mdash; v2.0 Approved &mdash; Generated July 30, 2026</div>
</div>
</body></html>"""


# ─────────────────────────────────────────────────────────────────────────────
# DIAGRAM 2: INTELLIGENCE FLOW
# ─────────────────────────────────────────────────────────────────────────────

DIAGRAM_2 = f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>DeepMindQ — Intelligence Flow</title>
<style>{COMMON_CSS}
.stage-label {{
  display: inline-block;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 1px;
  text-transform: uppercase;
  color: #475569;
  margin-bottom: 12px;
}}
.flow-stage {{
  margin-bottom: 8px;
}}
.stage-row {{
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}}
.stage-box {{
  padding: 12px 18px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 600;
  min-width: 120px;
  text-align: center;
}}
.stage-arrow {{
  color: #334155;
  font-size: 20px;
}}
.feedback-loop {{
  margin-top: 32px;
  border: 2px dashed rgba(34, 197, 94, 0.3);
  border-radius: 16px;
  padding: 24px;
  background: rgba(34, 197, 94, 0.03);
}}
.feedback-title {{
  font-size: 14px;
  font-weight: 700;
  color: #86efac;
  margin-bottom: 20px;
}}
.feedback-flow {{
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: center;
}}
.fb-box {{
  padding: 10px 16px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  text-align: center;
}}
.fb-arrow {{
  color: #22c55e;
  font-size: 16px;
}}
.model-tiers {{
  margin-top: 32px;
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 16px;
}}
.tier-card {{
  border: 1px solid rgba(148, 163, 184, 0.12);
  border-radius: 12px;
  padding: 16px;
  background: rgba(15, 18, 25, 0.4);
}}
.tier-name {{
  font-size: 14px;
  font-weight: 700;
  margin-bottom: 10px;
}}
.tier-usage {{
  font-size: 11px;
  color: #64748b;
  margin-bottom: 8px;
}}
.tier-models {{
  font-size: 11px;
  line-height: 1.6;
  color: #94a3b8;
}}
</style></head><body>
<div class="diagram-container">
  <h1>DeepMindQ — Intelligence Flow</h1>
  <h2>From Raw Data to Actionable Intelligence &mdash; 7-Stage Pipeline</h2>

  <!-- Stage 1 -->
  <div class="flow-stage">
    <div class="stage-label">Stage 1 &mdash; Acquire</div>
    <div class="stage-row">
      <div class="stage-box c-cyan">CSV Upload</div>
      <div class="stage-box c-cyan">Excel Upload</div>
      <div class="stage-box c-cyan">Web Scraping</div>
      <div class="stage-box c-cyan">RSS Feeds</div>
      <div class="stage-box c-cyan">Human Intel</div>
      <div class="stage-arrow">&rarr;</div>
      <div class="stage-box c-green">IntelligenceObject</div>
    </div>
  </div>

  <div class="arrow-down">&#9660;</div>

  <!-- Stage 2 -->
  <div class="flow-stage">
    <div class="stage-label">Stage 2 &mdash; Enrich</div>
    <div class="stage-row">
      <div class="stage-box c-purple">Research Engine</div>
      <div class="stage-arrow">&rarr;</div>
      <div class="stage-box c-amber">Evidence</div>
      <div class="stage-box c-amber">CompanyResearchCard</div>
      <div class="stage-box c-amber">CompanySignal</div>
    </div>
  </div>

  <div class="arrow-down">&#9660;</div>

  <!-- Stage 3 -->
  <div class="flow-stage">
    <div class="stage-label">Stage 3 &mdash; Validate</div>
    <div class="stage-row">
      <div class="stage-box c-blue">SignalValidation</div>
      <div class="stage-box c-blue">IntelligenceValidation</div>
      <div class="stage-box c-blue">CompanyIntelligenceHealth</div>
      <div class="stage-box c-blue">Contradiction Detection</div>
    </div>
  </div>

  <div class="arrow-down">&#9660;</div>

  <!-- Stage 4 -->
  <div class="flow-stage">
    <div class="stage-label">Stage 4 &mdash; Reason</div>
    <div class="stage-row">
      <div class="stage-box c-purple">Enterprise Reasoning (30 steps)</div>
      <div class="stage-box c-purple">Multi-Agent Orchestrator (10 agents)</div>
      <div class="stage-arrow">&rarr;</div>
      <div class="stage-box c-green">ReasoningContext + ReasoningSteps</div>
    </div>
  </div>

  <div class="arrow-down">&#9660;</div>

  <!-- Stage 5 -->
  <div class="flow-stage">
    <div class="stage-label">Stage 5 &mdash; Score</div>
    <div class="stage-row">
      <div class="stage-box c-amber">ScoringEngine</div>
      <div class="stage-arrow">&rarr;</div>
      <div class="stage-box c-red" style="font-size:11px">ICP Fit (0-100)</div>
      <div class="stage-box c-red" style="font-size:11px">Evidence Quality (0-100)</div>
      <div class="stage-box c-red" style="font-size:11px">Win Rate (0-100)</div>
      <div style="font-size:11px;color:#64748b;padding:0 8px;">&mdash; 3 independent scores, never merged</div>
    </div>
  </div>

  <div class="arrow-down">&#9660;</div>

  <!-- Stage 6 -->
  <div class="flow-stage">
    <div class="stage-label">Stage 6 &mdash; Recommend</div>
    <div class="stage-row">
      <div class="stage-box c-purple">ActionEngine</div>
      <div class="stage-arrow">&rarr;</div>
      <div class="stage-box c-green">OpportunityRecommendation</div>
      <div class="stage-box c-green">StrategicInsights</div>
      <div class="stage-box c-green">Next Best Actions</div>
    </div>
  </div>

  <div class="arrow-down">&#9660;</div>

  <!-- Stage 7 -->
  <div class="flow-stage">
    <div class="stage-label">Stage 7 &mdash; Learn</div>
    <div class="stage-row">
      <div class="stage-box c-blue">Feedback Intelligence Layer</div>
      <div class="stage-arrow">&rarr;</div>
      <div class="stage-box c-green">LearningEvent</div>
      <div class="stage-box c-green">Confidence Calibration</div>
      <div class="stage-box c-green">Weight Adjustment</div>
    </div>
  </div>

  <!-- Feedback Loop -->
  <div class="feedback-loop">
    <div class="feedback-title">Closed-Loop Feedback Intelligence</div>
    <div class="feedback-flow">
      <div class="fb-box c-green">AI Recommends</div>
      <div class="fb-arrow">&rarr;</div>
      <div class="fb-box c-amber">User Decides</div>
      <div class="fb-arrow">&rarr;</div>
      <div class="fb-box c-purple">Execute Action</div>
      <div class="fb-arrow">&rarr;</div>
      <div class="fb-box c-blue">Measure Result</div>
      <div class="fb-arrow">&rarr;</div>
      <div class="fb-box c-red">Feedback Event</div>
      <div class="fb-arrow">&rarr;</div>
      <div class="fb-box c-cyan">Learning Event</div>
      <div class="fb-arrow">&rarr;</div>
      <div class="fb-box c-green">Calibrate</div>
    </div>
  </div>

  <!-- Model Tiers -->
  <div class="model-tiers">
    <div class="tier-card">
      <div class="tier-name" style="color:#93c5fd">TIER: DEEP</div>
      <div class="tier-usage">Long-form, complex reasoning</div>
      <div class="tier-models">
        Z.ai GLM-4.6<br>
        &rarr; Gemini 1.5 Pro<br>
        &rarr; Gemini 2.0 Flash<br>
        <b>MaxTokens: 8192</b>
      </div>
    </div>
    <div class="tier-card">
      <div class="tier-name" style="color:#86efac">TIER: SMART</div>
      <div class="tier-usage">Standard intelligence tasks</div>
      <div class="tier-models">
        Gemini 2.0 Flash<br>
        &rarr; Groq Llama 3.3 70B<br>
        &rarr; Z.ai GLM-4.6<br>
        <b>MaxTokens: 4096</b>
      </div>
    </div>
    <div class="tier-card">
      <div class="tier-name" style="color:#fcd34d">TIER: FAST</div>
      <div class="tier-usage">Classification, summarization</div>
      <div class="tier-models">
        Groq Llama 3.1 8B<br>
        &rarr; Gemini 2.0 Flash<br>
        <b>MaxTokens: 1500</b>
      </div>
    </div>
  </div>

  <div class="footer">DeepMindQ Intelligence Flow &mdash; v2.0 Approved &mdash; Generated July 30, 2026</div>
</div>
</body></html>"""


# ─────────────────────────────────────────────────────────────────────────────
# DIAGRAM 3: DATA MODEL
# ─────────────────────────────────────────────────────────────────────────────

DIAGRAM_3 = f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>DeepMindQ — Data Model</title>
<style>{COMMON_CSS}
.domain-card {{
  border: 1px solid rgba(148, 163, 184, 0.12);
  border-radius: 12px;
  padding: 16px;
  background: rgba(15, 18, 25, 0.6);
}}
.domain-title {{
  font-size: 13px;
  font-weight: 700;
  margin-bottom: 10px;
  display: flex;
  align-items: center;
  gap: 8px;
}}
.domain-count {{
  font-size: 10px;
  padding: 2px 7px;
  border-radius: 10px;
  background: rgba(148, 163, 184, 0.1);
  color: #94a3b8;
}}
.model-tag {{
  display: inline-block;
  font-size: 11px;
  padding: 3px 8px;
  border-radius: 4px;
  margin: 2px;
  background: rgba(148, 163, 184, 0.08);
  color: #94a3b8;
  border: 1px solid rgba(148, 163, 184, 0.06);
}}
.key-model {{
  background: rgba(59, 130, 246, 0.12);
  border-color: rgba(59, 130, 246, 0.2);
  color: #93c5fd;
}}
.summary-bar {{
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 32px;
}}
.stat-card {{
  border: 1px solid rgba(148, 163, 184, 0.1);
  border-radius: 10px;
  padding: 16px;
  text-align: center;
  background: rgba(15, 18, 25, 0.4);
}}
.stat-value {{
  font-size: 28px;
  font-weight: 800;
  color: #f8fafc;
}}
.stat-label {{
  font-size: 11px;
  color: #64748b;
  margin-top: 4px;
}}
.enum-section {{
  margin-top: 32px;
}}
.enum-title {{
  font-size: 14px;
  font-weight: 700;
  color: #f1f5f9;
  margin-bottom: 16px;
}}
.enum-grid {{
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}}
.enum-card {{
  border: 1px solid rgba(148, 163, 184, 0.08);
  border-radius: 8px;
  padding: 10px 12px;
  background: rgba(15, 18, 25, 0.3);
}}
.enum-name {{
  font-size: 11px;
  font-weight: 700;
  color: #cbd5e1;
  margin-bottom: 4px;
}}
.enum-values {{
  font-size: 10px;
  color: #64748b;
  line-height: 1.4;
}}
</style></head><body>
<div class="diagram-container">
  <h1>DeepMindQ — Data Model</h1>
  <h2>90 Prisma Models &middot; 10 Domains &middot; 18 Enums &middot; PostgreSQL + pgvector</h2>

  <div class="summary-bar">
    <div class="stat-card"><div class="stat-value">90</div><div class="stat-label">Prisma Models</div></div>
    <div class="stat-card"><div class="stat-value">10</div><div class="stat-label">Data Domains</div></div>
    <div class="stat-card"><div class="stat-value">18</div><div class="stat-label">Enums</div></div>
    <div class="stat-card"><div class="stat-value">90+</div><div class="stat-label">DB Indexes</div></div>
  </div>

  <div class="grid-2" style="margin-bottom:16px;">

    <!-- Core Entity (3) -->
    <div class="domain-card">
      <div class="domain-title" style="color:#93c5fd">
        Core Entity <span class="domain-count">3</span>
      </div>
      <div>
        <span class="model-tag key-model">Company</span>
        <span class="model-tag key-model">Contact</span>
        <span class="model-tag">ImportBatch</span>
      </div>
    </div>

    <!-- Research & Intelligence (6) -->
    <div class="domain-card">
      <div class="domain-title" style="color:#86efac">
        Research &amp; Intelligence <span class="domain-count">6</span>
      </div>
      <div>
        <span class="model-tag key-model">CompanyResearchCard</span>
        <span class="model-tag key-model">CompanySignal</span>
        <span class="model-tag key-model">Evidence</span>
        <span class="model-tag">CompanyTimelineEvent</span>
        <span class="model-tag">CompanyNote</span>
        <span class="model-tag">ContactNote</span>
      </div>
    </div>

    <!-- Knowledge (5) -->
    <div class="domain-card">
      <div class="domain-title" style="color:#d8b4fe">
        Knowledge <span class="domain-count">5</span>
      </div>
      <div>
        <span class="model-tag key-model">CapabilityAsset</span>
        <span class="model-tag">KnowledgeDocument</span>
        <span class="model-tag">KnowledgeChunk</span>
        <span class="model-tag">KnowledgeEntry</span>
        <span class="model-tag">KnowledgeVersion</span>
      </div>
    </div>

    <!-- Email & Outreach (14) -->
    <div class="domain-card">
      <div class="domain-title" style="color:#fcd34d">
        Email &amp; Outreach <span class="domain-count">14</span>
      </div>
      <div>
        <span class="model-tag">EmailTemplate</span>
        <span class="model-tag">CustomEmailTemplate</span>
        <span class="model-tag key-model">EmailSequence</span>
        <span class="model-tag">SequenceStep</span>
        <span class="model-tag">SequenceEnrollment</span>
        <span class="model-tag key-model">Draft</span>
        <span class="model-tag">SendQueue</span>
        <span class="model-tag">EmailEvent</span>
        <span class="model-tag">ABTest</span>
        <span class="model-tag">Reply</span>
        <span class="model-tag">Bounce</span>
        <span class="model-tag">Suppression</span>
        <span class="model-tag">ConversationPlan</span>
        <span class="model-tag">Playbook</span>
      </div>
    </div>

    <!-- Scoring & Prioritization (6) -->
    <div class="domain-card">
      <div class="domain-title" style="color:#fca5a5">
        Scoring &amp; Prioritization <span class="domain-count">6</span>
      </div>
      <div>
        <span class="model-tag key-model">ScoringWeight</span>
        <span class="model-tag">PriorityScoreHistory</span>
        <span class="model-tag key-model">AccountScore</span>
        <span class="model-tag">SignalValidation</span>
        <span class="model-tag">CompanyIntelligenceHealth</span>
        <span class="model-tag">IntelligenceConflict</span>
      </div>
    </div>

    <!-- Opportunity & Pursuit (6) -->
    <div class="domain-card">
      <div class="domain-title" style="color:#67e8f9">
        Opportunity &amp; Pursuit <span class="domain-count">6</span>
      </div>
      <div>
        <span class="model-tag key-model">SignalCapabilityMatch</span>
        <span class="model-tag key-model">OpportunityRecommendation</span>
        <span class="model-tag key-model">Pursuit</span>
        <span class="model-tag">OpportunitySignal</span>
        <span class="model-tag">ActionArtifact</span>
        <span class="model-tag">StrategicInsight</span>
      </div>
    </div>

    <!-- Intelligence Acquisition (6) -->
    <div class="domain-card">
      <div class="domain-title" style="color:#f9a8d4">
        Intelligence Acquisition <span class="domain-count">6</span>
      </div>
      <div>
        <span class="model-tag key-model">IntelligenceObject</span>
        <span class="model-tag">CompanyAlias</span>
        <span class="model-tag">IntelligenceAssociation</span>
        <span class="model-tag">IntelligenceTimeline</span>
        <span class="model-tag">IntelligenceAlert</span>
        <span class="model-tag">HumanIntelligenceInbox</span>
      </div>
    </div>

    <!-- AI & Governance (15) -->
    <div class="domain-card">
      <div class="domain-title" style="color:#ef4444">
        AI &amp; Governance <span class="domain-count">15</span>
      </div>
      <div>
        <span class="model-tag key-model">AIGenerationAudit</span>
        <span class="model-tag">AICallLog</span>
        <span class="model-tag">AIUsageLog</span>
        <span class="model-tag">AIInsight</span>
        <span class="model-tag">AIEngagementStrategy</span>
        <span class="model-tag">AICache</span>
        <span class="model-tag">EngineRun</span>
        <span class="model-tag">ReasoningContext</span>
        <span class="model-tag">ReasoningStep</span>
        <span class="model-tag">AgentOrchestration</span>
        <span class="model-tag">AgentRun</span>
        <span class="model-tag">LearningEvent</span>
        <span class="model-tag">IntelligenceValidation</span>
        <span class="model-tag">RecommendationFeedback</span>
        <span class="model-tag">IntelligenceActionHistory</span>
      </div>
    </div>

    <!-- Data Pipeline (8) -->
    <div class="domain-card">
      <div class="domain-title" style="color:#a5b4fc">
        Data Pipeline <span class="domain-count">8</span>
      </div>
      <div>
        <span class="model-tag">DataUpload</span>
        <span class="model-tag">UploadRow</span>
        <span class="model-tag">ColumnMappingRule</span>
        <span class="model-tag">FieldValidationRule</span>
        <span class="model-tag">NormalizationMapping</span>
        <span class="model-tag">NormalizationLog</span>
        <span class="model-tag">DataQualityScore</span>
        <span class="model-tag">EvidenceSourceReliability</span>
      </div>
    </div>

    <!-- System (15) -->
    <div class="domain-card">
      <div class="domain-title" style="color:#94a3b8">
        System <span class="domain-count">15</span>
      </div>
      <div>
        <span class="model-tag key-model">User</span>
        <span class="model-tag">OtpCode</span>
        <span class="model-tag">Session</span>
        <span class="model-tag">AuditLog</span>
        <span class="model-tag">SystemSetting</span>
        <span class="model-tag">Job</span>
        <span class="model-tag">JobLog</span>
        <span class="model-tag">Connector</span>
        <span class="model-tag">ConnectorRun</span>
        <span class="model-tag">SourceHealth</span>
        <span class="model-tag">PipelineRun</span>
        <span class="model-tag">FusionResult</span>
        <span class="model-tag">Segment</span>
        <span class="model-tag">SegmentContact</span>
        <span class="model-tag">AccountStrategy</span>
      </div>
    </div>

  </div>

  <!-- Key Enums -->
  <div class="enum-section">
    <div class="enum-title">18 Key Enums</div>
    <div class="enum-grid">
      <div class="enum-card"><div class="enum-name">CompanyStatus</div><div class="enum-values">new, prospect, researching, active, engaged, paused, archived, closed_won, closed_lost</div></div>
      <div class="enum-card"><div class="enum-name">CompanyLifecycleStage</div><div class="enum-values">discovery, qualification, proposal, negotiation, closed</div></div>
      <div class="enum-card"><div class="enum-name">CompanyPriorityTier</div><div class="enum-values">HOT, ACTIVE, NURTURE, LOW</div></div>
      <div class="enum-card"><div class="enum-name">ContactStatus</div><div class="enum-values">active, engaged, imported, cleaned, duplicate, drafted, queued, sent, replied, bounced, suppressed, archived</div></div>
      <div class="enum-card"><div class="enum-name">SignalType</div><div class="enum-values">funding, hiring, leadership_change, leadership, tech_change, technology, news, mention, partnership, expansion, people_change, internal_memory</div></div>
      <div class="enum-card"><div class="enum-name">SignalSeverity</div><div class="enum-values">low, medium, high, critical</div></div>
      <div class="enum-card"><div class="enum-name">SignalStatus</div><div class="enum-values">detected, validated, active, aging, expired, archived</div></div>
      <div class="enum-card"><div class="enum-name">SignalMeaningCategory</div><div class="enum-values">budget_available, leadership_openness, tech_dissatisfaction, growth_pressure, compliance_requirement, vendor_evaluation, unknown</div></div>
      <div class="enum-card"><div class="enum-name">JobType</div><div class="enum-values">enrichment, research, scoring, signal_detection, email_generation</div></div>
      <div class="enum-card"><div class="enum-name">JobStatus</div><div class="enum-values">pending, queued, running, completed, failed, cancelled</div></div>
      <div class="enum-card"><div class="enum-name">DraftStatus</div><div class="enum-values">draft, pending_review, approved, rejected, sent</div></div>
      <div class="enum-card"><div class="enum-name">ImportBatchStatus</div><div class="enum-values">staged, processing, completed, archived, cancelled, failed</div></div>
    </div>
  </div>

  <div class="footer">DeepMindQ Data Model &mdash; 90 Models across 10 Domains &mdash; v2.0 Approved</div>
</div>
</body></html>"""


# ─────────────────────────────────────────────────────────────────────────────
# DIAGRAM 4: API ARCHITECTURE
# ─────────────────────────────────────────────────────────────────────────────

DIAGRAM_4 = f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>DeepMindQ — API Architecture</title>
<style>{COMMON_CSS}
.api-section {{
  margin-bottom: 32px;
}}
.api-section-title {{
  font-size: 16px;
  font-weight: 700;
  color: #f1f5f9;
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  gap: 10px;
}}
.api-badge {{
  font-size: 10px;
  font-weight: 700;
  padding: 3px 8px;
  border-radius: 6px;
}}
.endpoint-card {{
  border: 1px solid rgba(148, 163, 184, 0.1);
  border-radius: 10px;
  padding: 14px 18px;
  margin-bottom: 6px;
  background: rgba(15, 18, 25, 0.4);
  display: grid;
  grid-template-columns: 280px 1fr 100px;
  gap: 16px;
  align-items: center;
}}
.endpoint-card:hover {{
  background: rgba(15, 18, 25, 0.8);
  border-color: rgba(148, 163, 184, 0.2);
}}
.ep-path {{
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-size: 12px;
  color: #93c5fd;
}}
.ep-desc {{
  font-size: 12px;
  color: #94a3b8;
}}
.ep-engine {{
  font-size: 11px;
  color: #64748b;
  text-align: right;
}}
.route-group {{
  margin-top: 24px;
}}
.route-group-title {{
  font-size: 13px;
  font-weight: 600;
  color: #cbd5e1;
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  gap: 8px;
}}
.route-count {{
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 8px;
  background: rgba(148, 163, 184, 0.08);
  color: #64748b;
}}
.middleware-flow {{
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  margin: 16px 0 32px 0;
  padding: 14px;
  border: 1px solid rgba(148, 163, 184, 0.1);
  border-radius: 10px;
  background: rgba(15, 18, 25, 0.4);
}}
.mw-box {{
  font-size: 11px;
  padding: 5px 10px;
  border-radius: 6px;
  background: rgba(148, 163, 184, 0.08);
  color: #94a3b8;
}}
.mw-arrow {{
  color: #334155;
  font-size: 12px;
}}
</style></head><body>
<div class="diagram-container">
  <h1>DeepMindQ &mdash; API Architecture</h1>
  <h2>6 Intelligence Endpoints &middot; 208 Internal Routes &middot; Full Middleware Stack</h2>

  <!-- Middleware -->
  <div class="middleware-flow">
    <span style="font-size:11px;color:#64748b;margin-right:4px;">Request Flow:</span>
    <div class="mw-box">Auth Check</div><div class="mw-arrow">&rarr;</div>
    <div class="mw-box">Rate Limit</div><div class="mw-arrow">&rarr;</div>
    <div class="mw-box">CSRF Protection</div><div class="mw-arrow">&rarr;</div>
    <div class="mw-box" style="color:#fcd34d;">Zod Validation</div><div class="mw-arrow">&rarr;</div>
    <div class="mw-box">Business Logic</div><div class="mw-arrow">&rarr;</div>
    <div class="mw-box">Response</div>
    <div style="margin-left:12px;"></div>
    <div class="mw-box" style="color:#fca5a5;">Audit Log</div>
    <div class="mw-box" style="color:#fca5a5;">AI Governance</div>
  </div>

  <!-- 6 Product Endpoints -->
  <div class="api-section">
    <div class="api-section-title">
      <span class="api-badge" style="background:rgba(34,197,94,0.2);color:#86efac;">PRODUCT</span>
      6 Intelligence API Endpoints &mdash; The ONLY frontend contract
    </div>

    <div class="endpoint-card">
      <div class="ep-path">GET /api/intelligence/company/<b>{{id}}</b></div>
      <div class="ep-desc">Company 360 intelligence view &mdash; signals, scores, contacts, timeline, brief, knowledge</div>
      <div class="ep-engine">All Engines</div>
    </div>
    <div class="endpoint-card">
      <div class="ep-path">GET /api/intelligence/reasoning/<b>{{id}}</b></div>
      <div class="ep-desc">Enterprise reasoning &mdash; 30-step chain, impact analysis, strategic recommendations</div>
      <div class="ep-engine">Reasoning</div>
    </div>
    <div class="endpoint-card">
      <div class="ep-path">GET /api/intelligence/opportunity/<b>{{id}}</b></div>
      <div class="ep-desc">Opportunity intelligence &mdash; scores, fusion data, win probability, capability matches</div>
      <div class="ep-engine">Fusion+Score</div>
    </div>
    <div class="endpoint-card">
      <div class="ep-path">GET /api/intelligence/action/<b>{{id}}</b></div>
      <div class="ep-desc">Next best actions &mdash; recommendations, sequences, learning insights, priorities</div>
      <div class="ep-engine">Action</div>
    </div>
    <div class="endpoint-card">
      <div class="ep-path">GET /api/intelligence/conversation/<b>{{id}}</b></div>
      <div class="ep-desc">Conversation preparation &mdash; talking points, objection handling, buyer profiles</div>
      <div class="ep-engine">Conversation</div>
    </div>
    <div class="endpoint-card">
      <div class="ep-path">GET /api/intelligence/mindmap/<b>{{id}}</b></div>
      <div class="ep-desc">Knowledge graph &mdash; org chart, knowledge connections, signal relationships</div>
      <div class="ep-engine">Retrieval</div>
    </div>
    <div style="font-size:11px;color:#64748b;padding:8px 0;">All endpoints support <code style="color:#93c5fd;">?include=signals,scores,contacts</code> for selective data loading</div>
  </div>

  <!-- Internal Routes -->
  <div class="api-section">
    <div class="api-section-title">
      <span class="api-badge" style="background:rgba(148,163,184,0.15);color:#94a3b8;">INTERNAL</span>
      208 API Routes &mdash; CRUD, Testing, Engine Access
    </div>

    <div class="route-group">
      <div class="route-group-title">Companies <span class="route-count">18 routes</span></div>
      <div style="font-size:11px;color:#64748b;line-height:1.6;">
        /api/companies &middot; /api/companies/[id] &middot; /api/companies/bulk &middot; /api/companies/enrich &middot;
        /api/companies/compare &middot; /api/companies/[id]/intelligence &middot; /api/companies/[id]/signals &middot;
        /api/companies/[id]/timeline &middot; /api/companies/[id]/brief &middot; /api/companies/[id]/score &middot;
        /api/companies/[id]/actions &middot; /api/companies/[id]/alignment &middot; /api/companies/[id]/contacts &middot;
        /api/companies/[id]/notes &middot; /api/companies/[id]/feedback &middot; /api/companies/stats &middot;
        /api/companies/meta &middot; /api/companies/mind-map
      </div>
    </div>

    <div class="route-group">
      <div class="route-group-title">Intelligence <span class="route-count">25 routes</span></div>
      <div style="font-size:11px;color:#64748b;line-height:1.6;">
        /api/intelligence/unified &middot; /api/intelligence/full-pipeline &middot; /api/intelligence/sprint3 &middot;
        /api/intelligence/enrich &middot; /api/intelligence/enrich-batch &middot; /api/intelligence/refresh &middot;
        /api/intelligence/stats &middot; /api/intelligence/monitor &middot; /api/intelligence/predictions &middot;
        /api/intelligence/cross-account &middot; /api/intelligence/competitive &middot;
        /api/intelligence/capability-pipeline &middot; /api/intelligence/correlations &middot;
        /api/intelligence/knowledge/[id] &middot; /api/intelligence/grounding/[id] &middot;
        /api/intelligence/retrieval/[id] &middot; /api/intelligence/collect-external &middot;
        /api/intelligence/website-monitor &middot; /api/intelligence/internal-memory &middot;
        /api/intelligence/action-history &middot; /api/intelligence/feedback &middot;
        /api/intelligence/people-enrich &middot; /api/intelligence/company/[id] &middot;
        /api/intelligence/reasoning/[id] &middot; /api/intelligence/opportunity/[id]
      </div>
    </div>

    <div class="route-group">
      <div class="route-group-title">AI <span class="route-count">22 routes</span></div>
      <div style="font-size:11px;color:#64748b;line-height:1.6;">
        /api/ai/insights &middot; /api/ai/chat &middot; /api/ai/generate &middot; /api/ai/health &middot;
        /api/ai/recommendations &middot; /api/ai/score-leads &middot; /api/ai/score-contacts &middot;
        /api/ai/score-opportunities &middot; /api/ai/enrich &middot; /api/ai/opportunities &middot;
        /api/ai/contact-intelligence &middot; /api/ai/signals &middot; /api/ai/buying-intent &middot;
        /api/ai/deal-coaching &middot; /api/ai/deal-risk &middot; /api/ai/revenue-score &middot;
        /api/ai/account-brief &middot; /api/ai/summarize &middot; /api/ai/usage &middot;
        /api/ai/conversation-plan &middot; /api/ai/relationship-memory &middot; /api/ai/reliability
      </div>
    </div>

    <div class="route-group">
      <div class="route-group-title">Auth <span class="route-count">10 routes</span></div>
      <div style="font-size:11px;color:#64748b;line-height:1.6;">
        /api/auth/login &middot; /api/auth/logout &middot; /api/auth/register &middot; /api/auth/request-otp &middot;
        /api/auth/verify-otp &middot; /api/auth/me &middot; /api/auth/update-profile &middot;
        /api/auth/set-password &middot; /api/auth/change-password &middot; /api/auth/reset-password
      </div>
    </div>

    <div style="margin-top:16px;">
      <div class="route-group-title">Other Route Groups</div>
      <div style="display:flex;flex-wrap:wrap;gap:8px;">
        <span class="box box-sm" style="background:rgba(148,163,184,0.06);color:#64748b;">Contacts (8)</span>
        <span class="box box-sm" style="background:rgba(148,163,184,0.06);color:#64748b;">Leads (10)</span>
        <span class="box box-sm" style="background:rgba(148,163,184,0.06);color:#64748b;">Drafts (2)</span>
        <span class="box box-sm" style="background:rgba(148,163,184,0.06);color:#64748b;">Sequences (5)</span>
        <span class="box box-sm" style="background:rgba(148,163,184,0.06);color:#64748b;">Emails (4)</span>
        <span class="box box-sm" style="background:rgba(148,163,184,0.06);color:#64748b;">Knowledge (4)</span>
        <span class="box box-sm" style="background:rgba(148,163,184,0.06);color:#64748b;">Capabilities (5)</span>
        <span class="box box-sm" style="background:rgba(148,163,184,0.06);color:#64748b;">Reports (4)</span>
        <span class="box box-sm" style="background:rgba(148,163,184,0.06);color:#64748b;">Engines (6)</span>
        <span class="box box-sm" style="background:rgba(148,163,184,0.06);color:#64748b;">Settings (1)</span>
        <span class="box box-sm" style="background:rgba(148,163,184,0.06);color:#64748b;">Segments (2)</span>
        <span class="box box-sm" style="background:rgba(148,163,184,0.06);color:#64748b;">+83 more</span>
      </div>
    </div>
  </div>

  <div class="footer">DeepMindQ API Architecture &mdash; 214 Total Routes &mdash; v2.0 Approved</div>
</div>
</body></html>"""


# ─────────────────────────────────────────────────────────────────────────────
# DIAGRAM 5: 20-TICKET ROADMAP
# ─────────────────────────────────────────────────────────────────────────────

DIAGRAM_5 = f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>DeepMindQ — 20 Ticket Roadmap</title>
<style>{COMMON_CSS}
.ticket-row {{
  display: grid;
  grid-template-columns: 44px 1fr 70px 70px 1fr;
  gap: 12px;
  align-items: center;
  padding: 10px 14px;
  border: 1px solid rgba(148, 163, 184, 0.06);
  border-radius: 8px;
  margin-bottom: 3px;
  background: rgba(15, 18, 25, 0.3);
  font-size: 12px;
  transition: all 0.2s ease;
}}
.ticket-row:hover {{
  background: rgba(15, 18, 25, 0.7);
  border-color: rgba(148, 163, 184, 0.12);
}}
.ticket-num {{
  font-weight: 800;
  font-size: 16px;
  color: #475569;
}}
.ticket-title {{
  font-weight: 600;
  color: #e2e8f0;
  font-size: 13px;
}}
.ticket-desc {{
  font-size: 11px;
  color: #64748b;
  margin-top: 2px;
}}
.ticket-est {{
  font-size: 11px;
  color: #64748b;
  text-align: center;
}}
.ticket-priority {{
  font-size: 10px;
  font-weight: 700;
  padding: 3px 8px;
  border-radius: 4px;
  text-align: center;
}}
.p-p0 {{ background: rgba(239, 68, 68, 0.15); color: #fca5a5; }}
.p-p1 {{ background: rgba(245, 158, 11, 0.15); color: #fcd34d; }}
.p-p2 {{ background: rgba(59, 130, 246, 0.15); color: #93c5fd; }}
.p-p3 {{ background: rgba(148, 163, 184, 0.15); color: #94a3b8; }}
.ticket-deps {{
  font-size: 10px;
  color: #475569;
}}
.phase-header {{
  display: grid;
  grid-template-columns: 44px 1fr 70px 70px 1fr;
  gap: 12px;
  padding: 12px 14px;
  margin-top: 20px;
  margin-bottom: 4px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #64748b;
  border-bottom: 1px solid rgba(148, 163, 184, 0.08);
}}
.gantt {{
  margin-top: 32px;
  border: 1px solid rgba(148, 163, 184, 0.08);
  border-radius: 12px;
  padding: 20px;
  background: rgba(15, 18, 25, 0.3);
}}
.gantt-title {{
  font-size: 14px;
  font-weight: 700;
  color: #f1f5f9;
  margin-bottom: 16px;
}}
.gantt-row {{
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}}
.gantt-label {{
  width: 180px;
  font-size: 11px;
  color: #94a3b8;
  text-align: right;
  flex-shrink: 0;
}}
.gantt-bar {{
  height: 20px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  padding: 0 8px;
  font-size: 9px;
  font-weight: 600;
  color: rgba(255,255,255,0.8);
}}
.gantt-bar-p0 {{ background: rgba(239, 68, 68, 0.3); }}
.gantt-bar-p1 {{ background: rgba(245, 158, 11, 0.3); }}
.gantt-bar-p2 {{ background: rgba(59, 130, 246, 0.3); }}
.gantt-bar-p3 {{ background: rgba(148, 163, 184, 0.3); }}
</style></head><body>
<div class="diagram-container">
  <h1>DeepMindQ &mdash; 20 Ticket Implementation Roadmap</h1>
  <h2>Vertical Slicing &middot; Backend First &middot; 38 Days Estimated</h2>

  <!-- Phase Header -->
  <div class="phase-header">
    <span>#</span>
    <span>Ticket</span>
    <span>Days</span>
    <span>Priority</span>
    <span>Dependencies</span>
  </div>

  <!-- P0 Tickets -->
  <div class="ticket-row">
    <div class="ticket-num">01</div>
    <div><div class="ticket-title">Foundation Hardening</div><div class="ticket-desc">TypeScript strict, Zod validation, error handling</div></div>
    <div class="ticket-est">3d</div>
    <div class="ticket-priority p-p0">P0</div>
    <div class="ticket-deps">None</div>
  </div>
  <div class="ticket-row">
    <div class="ticket-num">02</div>
    <div><div class="ticket-title">Intelligence API Refactor</div><div class="ticket-desc">6 endpoints, ?include=, middleware, caching</div></div>
    <div class="ticket-est">2d</div>
    <div class="ticket-priority p-p0">P0</div>
    <div class="ticket-deps">T1</div>
  </div>
  <div class="ticket-row">
    <div class="ticket-num">03</div>
    <div><div class="ticket-title">AI Governance Hardening</div><div class="ticket-desc">10/10 governed, ESLint enforcement, audit trail</div></div>
    <div class="ticket-est">2d</div>
    <div class="ticket-priority p-p0">P0</div>
    <div class="ticket-deps">T1</div>
  </div>
  <div class="ticket-row">
    <div class="ticket-num">04</div>
    <div><div class="ticket-title">3-Score Architecture</div><div class="ticket-desc">ICP + Evidence + Win Rate, ScoreTriple component</div></div>
    <div class="ticket-est">2d</div>
    <div class="ticket-priority p-p0">P0</div>
    <div class="ticket-deps">T2</div>
  </div>
  <div class="ticket-row">
    <div class="ticket-num">05</div>
    <div><div class="ticket-title">Command Center Screen</div><div class="ticket-desc">KPIs, signal feed, opportunities, health</div></div>
    <div class="ticket-est">2d</div>
    <div class="ticket-priority p-p0">P0</div>
    <div class="ticket-deps">T2, T4</div>
  </div>
  <div class="ticket-row">
    <div class="ticket-num">06</div>
    <div><div class="ticket-title">Company List + Priority</div><div class="ticket-desc">Tier badges, score sorting, pagination</div></div>
    <div class="ticket-est">2d</div>
    <div class="ticket-priority p-p0">P0</div>
    <div class="ticket-deps">T4</div>
  </div>
  <div class="ticket-row">
    <div class="ticket-num">07</div>
    <div><div class="ticket-title">Company Profile (5Q Workspace)</div><div class="ticket-desc">Progressive disclosure, lazy loading, all Qs</div></div>
    <div class="ticket-est">3d</div>
    <div class="ticket-priority p-p0">P0</div>
    <div class="ticket-deps">T2, T3, T4</div>
  </div>
  <div class="ticket-row">
    <div class="ticket-num">08</div>
    <div><div class="ticket-title">Signal Intelligence</div><div class="ticket-desc">Signal table, evidence detail, capability match</div></div>
    <div class="ticket-est">2d</div>
    <div class="ticket-priority p-p0">P0</div>
    <div class="ticket-deps">T2</div>
  </div>
  <div class="ticket-row">
    <div class="ticket-num">09</div>
    <div><div class="ticket-title">Opportunity Radar</div><div class="ticket-desc">Opp cards, accept/reject, feedback form</div></div>
    <div class="ticket-est">2d</div>
    <div class="ticket-priority p-p0">P0</div>
    <div class="ticket-deps">T2, T4</div>
  </div>
  <div class="ticket-row">
    <div class="ticket-num">10</div>
    <div><div class="ticket-title">Intelligence Inbox</div><div class="ticket-desc">New intel queue, human submission, quick actions</div></div>
    <div class="ticket-est">2d</div>
    <div class="ticket-priority p-p0">P0</div>
    <div class="ticket-deps">T8</div>
  </div>
  <div class="ticket-row">
    <div class="ticket-num">15</div>
    <div><div class="ticket-title">Knowledge &amp; Capability</div><div class="ticket-desc">Library, vector search, ingestion pipeline</div></div>
    <div class="ticket-est">2d</div>
    <div class="ticket-priority p-p0">P0</div>
    <div class="ticket-deps">T2, T7</div>
  </div>
  <div class="ticket-row">
    <div class="ticket-num">16</div>
    <div><div class="ticket-title">Intelligence Reasoning View</div><div class="ticket-desc">30-step chain, evidence citations, refresh</div></div>
    <div class="ticket-est">2d</div>
    <div class="ticket-priority p-p0">P0</div>
    <div class="ticket-deps">T2</div>
  </div>
  <div class="ticket-row">
    <div class="ticket-num">17</div>
    <div><div class="ticket-title">Conversation Intelligence</div><div class="ticket-desc">Talking points, objection handling, buyer profiles</div></div>
    <div class="ticket-est">2d</div>
    <div class="ticket-priority p-p0">P0</div>
    <div class="ticket-deps">T2, T7</div>
  </div>

  <!-- P1 Tickets -->
  <div class="ticket-row">
    <div class="ticket-num">11</div>
    <div><div class="ticket-title">Data Intelligence Import</div><div class="ticket-desc">Full pipeline: upload, map, validate, normalize, score</div></div>
    <div class="ticket-est">3d</div>
    <div class="ticket-priority p-p1">P1</div>
    <div class="ticket-deps">T1</div>
  </div>
  <div class="ticket-row">
    <div class="ticket-num">12</div>
    <div><div class="ticket-title">Contact Management</div><div class="ticket-desc">CRUD, enrichment, lead scoring, consent</div></div>
    <div class="ticket-est">2d</div>
    <div class="ticket-priority p-p1">P1</div>
    <div class="ticket-deps">T1</div>
  </div>

  <!-- P2 Tickets -->
  <div class="ticket-row">
    <div class="ticket-num">13</div>
    <div><div class="ticket-title">Email Draft Generation</div><div class="ticket-desc">AI drafts, governance, audit trail, approval</div></div>
    <div class="ticket-est">2d</div>
    <div class="ticket-priority p-p2">P2</div>
    <div class="ticket-deps">T3, T7</div>
  </div>
  <div class="ticket-row">
    <div class="ticket-num">14</div>
    <div><div class="ticket-title">Sequence Management</div><div class="ticket-desc">CRUD, signal-driven, enrollment, execution</div></div>
    <div class="ticket-est">2d</div>
    <div class="ticket-priority p-p2">P2</div>
    <div class="ticket-deps">T13</div>
  </div>

  <!-- P3 Tickets -->
  <div class="ticket-row">
    <div class="ticket-num">18</div>
    <div><div class="ticket-title">Analytics &amp; Reporting</div><div class="ticket-desc">Pipeline, revenue, team, data quality reports</div></div>
    <div class="ticket-est">2d</div>
    <div class="ticket-priority p-p3">P3</div>
    <div class="ticket-deps">T4, T5</div>
  </div>
  <div class="ticket-row">
    <div class="ticket-num">19</div>
    <div><div class="ticket-title">Settings &amp; Configuration</div><div class="ticket-desc">System settings, data rules, AI config, scoring</div></div>
    <div class="ticket-est">2d</div>
    <div class="ticket-priority p-p3">P3</div>
    <div class="ticket-deps">T1</div>
  </div>
  <div class="ticket-row">
    <div class="ticket-num">20</div>
    <div><div class="ticket-title">System Health &amp; Audit</div><div class="ticket-desc">Health dashboard, audit log, AI usage tracking</div></div>
    <div class="ticket-est">1d</div>
    <div class="ticket-priority p-p3">P3</div>
    <div class="ticket-deps">T3</div>
  </div>

  <!-- Gantt -->
  <div class="gantt">
    <div class="gantt-title">Execution Timeline (Parallel Tracks)</div>

    <div class="gantt-row">
      <div class="gantt-label">Week 1 (Days 1-5)</div>
      <div class="gantt-bar gantt-bar-p0" style="width:480px;margin-left:0px;">T1: Foundation (3d)</div>
    </div>
    <div class="gantt-row">
      <div class="gantt-label"></div>
      <div class="gantt-bar gantt-bar-p0" style="width:320px;margin-left:240px;">T2: Intel API (2d)</div>
    </div>
    <div class="gantt-row">
      <div class="gantt-label"></div>
      <div class="gantt-bar gantt-bar-p0" style="width:320px;margin-left:240px;">T3: Governance (2d)</div>
    </div>
    <div class="gantt-row">
      <div class="gantt-label"></div>
      <div class="gantt-bar gantt-bar-p0" style="width:320px;margin-left:320px;">T4: 3-Score (2d)</div>
    </div>
    <div class="gantt-row">
      <div class="gantt-label">Week 2 (Days 6-10)</div>
      <div class="gantt-bar gantt-bar-p0" style="width:320px;margin-left:480px;">T5: Command Center (2d)</div>
    </div>
    <div class="gantt-row">
      <div class="gantt-label"></div>
      <div class="gantt-bar gantt-bar-p0" style="width:320px;margin-left:560px;">T6: Company List (2d)</div>
    </div>
    <div class="gantt-row">
      <div class="gantt-label"></div>
      <div class="gantt-bar gantt-bar-p0" style="width:480px;margin-left:640px;">T7: 5Q Workspace (3d)</div>
    </div>
    <div class="gantt-row">
      <div class="gantt-label"></div>
      <div class="gantt-bar gantt-bar-p0" style="width:320px;margin-left:480px;">T8: Signals (2d)</div>
    </div>
    <div class="gantt-row">
      <div class="gantt-label"></div>
      <div class="gantt-bar gantt-bar-p0" style="width:320px;margin-left:640px;">T9: Opp Radar (2d)</div>
    </div>
    <div class="gantt-row">
      <div class="gantt-label"></div>
      <div class="gantt-bar gantt-bar-p0" style="width:320px;margin-left:720px;">T10: Inbox (2d)</div>
    </div>
    <div class="gantt-row">
      <div class="gantt-label">Week 3 (Days 11-17)</div>
      <div class="gantt-bar gantt-bar-p0" style="width:320px;margin-left:800px;">T16: Reasoning (2d)</div>
    </div>
    <div class="gantt-row">
      <div class="gantt-label"></div>
      <div class="gantt-bar gantt-bar-p0" style="width:320px;margin-left:880px;">T17: Conversation (2d)</div>
    </div>
    <div class="gantt-row">
      <div class="gantt-label"></div>
      <div class="gantt-bar gantt-bar-p0" style="width:320px;margin-left:800px;">T15: Knowledge (2d)</div>
    </div>
    <div class="gantt-row">
      <div class="gantt-label"></div>
      <div class="gantt-bar gantt-bar-p1" style="width:480px;margin-left:480px;">T11: Data Import (3d)</div>
    </div>
    <div class="gantt-row">
      <div class="gantt-label"></div>
      <div class="gantt-bar gantt-bar-p1" style="width:320px;margin-left:720px;">T12: Contacts (2d)</div>
    </div>
    <div class="gantt-row">
      <div class="gantt-label">Week 4+ (Days 18+)</div>
      <div class="gantt-bar gantt-bar-p2" style="width:320px;margin-left:1120px;">T13: Drafts (2d)</div>
    </div>
    <div class="gantt-row">
      <div class="gantt-label"></div>
      <div class="gantt-bar gantt-bar-p2" style="width:320px;margin-left:1280px;">T14: Sequences (2d)</div>
    </div>
    <div class="gantt-row">
      <div class="gantt-label"></div>
      <div class="gantt-bar gantt-bar-p3" style="width:320px;margin-left:1120px;">T18: Analytics (2d)</div>
    </div>
    <div class="gantt-row">
      <div class="gantt-label"></div>
      <div class="gantt-bar gantt-bar-p3" style="width:320px;margin-left:1120px;">T19: Settings (2d)</div>
    </div>
    <div class="gantt-row">
      <div class="gantt-label"></div>
      <div class="gantt-bar gantt-bar-p3" style="width:160px;margin-left:1440px;">T20: Health (1d)</div>
    </div>
  </div>

  <div class="footer">DeepMindQ Implementation Roadmap &mdash; 20 Tickets &middot; ~38 Days &middot; v2.0 Approved</div>
</div>
</body></html>"""


# ─────────────────────────────────────────────────────────────────────────────
# WRITE ALL DIAGRAMS
# ─────────────────────────────────────────────────────────────────────────────

diagrams = [
    ("DeepMindQ_System_Architecture.html", DIAGRAM_1),
    ("DeepMindQ_Intelligence_Flow.html", DIAGRAM_2),
    ("DeepMindQ_Data_Model.html", DIAGRAM_3),
    ("DeepMindQ_API_Architecture.html", DIAGRAM_4),
    ("DeepMindQ_20_Ticket_Roadmap.html", DIAGRAM_5),
]

for filename, content in diagrams:
    filepath = os.path.join(OUTPUT_DIR, filename)
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"  Written: {filepath} ({len(content):,} bytes)")

print("\nAll 5 architecture diagrams generated successfully.")
