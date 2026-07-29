# DEEPMINDQ DESIGN BIBLE
## The Definitive UI/UX Reference

This document is the permanent design authority for DeepMindQ.
Every pixel, every interaction, every state transition must be evaluated against this document.
If a design decision is not addressed here, it does not exist in DeepMindQ.

Version: 1.0
Date: 2026-07-30
Status: LOCKED

---

# PART I: DESIGN PHILOSOPHY — THE SOUL

## 1.1 The Core Belief

DeepMindQ is not a product that displays intelligence.
DeepMindQ is a product that makes the user FEEL intelligent.

The difference is not cosmetic. It is architectural.

A product that displays intelligence shows you data, tables, scores, and charts.
A product that makes you feel intelligent understands your cognitive journey —
from confusion to clarity, from signal to strategy, from data to decision.

Every design decision in DeepMindQ must pass this test:

> "Does this make the user feel like they have an AI analyst working for them?"

If the answer is no, the design is wrong. Full stop.

---

## 1.2 The Feel Standard

Design is not just what you see. It is what you FEEL.

This document defines metrics, tokens, and specifications.
But no specification can capture the feeling of:
- A card that is perfectly weighted
- Spacing that breathes at exactly the right pace
- A transition that feels inevitable, not animated
- A loading state that builds trust instead of anxiety
- An error that feels honest instead of broken
- A number that communicates urgency without shouting

The Feel Standard means every person who touches this codebase —
designer, developer, reviewer — must develop design intuition.
Not just design literacy. Design intuition.

**Design literacy** means you can follow a spec.
**Design intuition** means you can FEEL when a card looks slightly off-brand.
You can FEEL when spacing feels wrong — even if the spec says it's correct.
You can FEEL when an interaction is accessible — not because a checklist says so,
but because navigating it feels natural, respectful, and complete.

**This document teaches the rules. The Feel Standard demands you internalize them.**

---

## 1.3 Sales Psychology — The User's Mental Model

DeepMindQ's users are not developers browsing data.
They are:
- Enterprise sales leaders deciding where to focus their team
- CEOs understanding market shifts before competitors
- Strategy teams building competitive advantage
- Business development professionals turning intelligence into relationships

### How They Think

They do NOT think in database records. They think in narratives:

```
"I heard something changed at Acme Corp."
    → "What happened?"           (Signal detection)
    → "Why does it matter?"       (Impact assessment)
    → "Who should I talk to?"     (Stakeholder mapping)
    → "What should I say?"        (Conversation preparation)
    → "What should I do?"         (Action planning)
```

This is not a UI flow. This is how the human brain processes intelligence.

The 5-Question Workspace is not a design pattern we chose.
It is a direct mapping of sales psychology.
It mirrors the cognitive journey from awareness to action.

### Design Implication

Every screen, every component, every micro-interaction
must respect this cognitive journey:

| Stage | User's Emotional State | Design Response |
|-------|----------------------|----------------|
| **Awareness** | Curiosity. "What's new?" | Fresh signals with urgency cues. Not overload. |
| **Understanding** | Analysis. "Why should I care?" | Reasoning with evidence trail. Not raw data. |
| **Targeting** | Strategy. "Who matters?" | Buying committee with roles. Not a contact list. |
| **Preparation** | Confidence. "What do I say?" | Grounded AI draft with evidence. Not a template. |
| **Action** | Momentum. "Let's do this." | Clear next steps with one-tap CTAs. Not a to-do list. |

The UI is not a dashboard. It is a cognitive companion.
It walks beside the user through each stage of their intelligence journey.

---

## 1.4 Emotional Trust — The Invisible Layer

Trust is not built by displaying confidence scores.
Trust is built by a thousand micro-decisions that communicate honesty,
transparency, and competence.

### The Trust Architecture

```
LAYER 1: VISUAL TRUST
    The UI looks like it belongs in a boardroom.
    Dark, premium, considered.
    No playful colors. No startup aesthetics.
    Every element earns its place.

LAYER 2: DATA TRUST
    Every AI claim shows its evidence.
    Every confidence score shows its sources.
    Every recommendation shows its reasoning.
    Nothing appears from nowhere.
    Nothing is presented as certain when it is tentative.

LAYER 3: HONESTY TRUST
    The system tells you what it DOES NOT know.
    "What we don't know" is not hidden — it is displayed.
    Limitations are not buried — they are prominent.
    The AI admits uncertainty. This makes the user trust the certainty.

LAYER 4: BEHAVIORAL TRUST
    Loading states are honest about what is happening.
    Errors explain what went wrong, not just that something failed.
    Empty states guide the user forward, not just inform them.
    The system never pretends to be faster or smarter than it is.

LAYER 5: RELATIONSHIP TRUST
    The system learns from feedback.
    Actions the user takes improve future recommendations.
    The user feels like the system is getting smarter.
    This is the deepest trust — the system earns it over time.
```

### Design Rules for Trust

**Rule: Never display AI output without a confidence indicator.**
A number without context is either meaningless or misleading.
Every AI-generated insight must carry:
- Confidence level (with color coding)
- Source count
- Recency
- Model that generated it
- Processing time

**Rule: Every card must answer "Why should I trust this?"**
If the user looks at any card and cannot answer that question
within 2 seconds, the card has failed its primary purpose.

**Rule: The system's limitations must be visible, not hidden.**
"We don't have enough data to analyze this" is better than
a low-confidence analysis that looks certain.
An honest empty state builds more trust than a weak recommendation.

**Rule: Evidence trails must be one click away.**
Every AI claim should have a "View Evidence" path.
The user should never feel locked out of the reasoning.
Transparency is the foundation of trust.

**Rule: Governance status is always visible.**
Every AI-powered element must indicate:
- Verified (green check)
- Needs Review (amber warning)
- Failed (red indicator)
The user must know the system's own assessment of its output.

---

## 1.5 Design for Narrative, Not Screens

DeepMindQ is not a collection of screens.
DeepMindQ is a narrative experience with screens as its medium.

### The Narrative Principle

When a user opens a company in the workspace,
they are not "viewing a company page."
They are reading a story.

```
Chapter 1: What Changed?
    "TechCorp's CTO left yesterday."
    → The user FEELS: Alert. Curious. Urgency.

Narrative Transition: WHY THIS MATTERS
    → The user FEELS: Anticipation. "Tell me why I should care."

Chapter 2: Why Does It Matter?
    "The new CTO will reassess all vendor relationships.
     Combined with their Q2 revenue miss, there is a 60-90 day
     buying window for cloud infrastructure solutions."
    → The user FEELS: Understanding. Strategy forming. Confidence.

Narrative Transition: WHO TO APPROACH
    → The user FEELS: Readiness. "Who do I talk to?"

Chapter 3: Who Should I Talk To?
    "The new CTO is the decision maker. The VP Engineering
     is the influencer. Contact the CTO first."
    → The user FEELS: Clarity. Empowered. "I know who to call."

Narrative Transition: WHAT TO SAY
    → The user FEELS: Preparation. "Help me say the right thing."

Chapter 4: What Should We Say?
    "Here's a drafted email referencing their cloud migration,
     grounded in verified data, with no fabricated claims."
    → The user FEELS: Equipped. "This is good. I can use this."

Narrative Transition: WHAT TO DO
    → The user FEELS: Momentum. "Let's take action."

Chapter 5: What Should We Do?
    "Contact the CTO today. Prepare a technical brief
     for the VP Engineering by Friday."
    → The user FEELS: Direction. Confidence. Ready to act.
```

### Design Implication

The narrative dividers between sections are not decorative.
They are structural — they are chapter breaks in an intelligence story.

The `WHY THIS MATTERS` divider is not a label.
It is the moment the user transitions from awareness to understanding.

The progressive disclosure of information is not UX optimization.
It is narrative pacing — you don't reveal the ending in chapter 1.

Every animation timing, every stagger delay, every content density decision
serves the narrative, not the layout.

**Rule: The workspace must feel like reading a briefing, not browsing a database.**
If the user feels like they are "navigating a dashboard,"
the design has failed the narrative principle.

---

## 1.6 Anticipate Every Edge Case

A premium product handles edge cases gracefully.
An exceptional product makes edge cases feel intentional.

### State Transition Map

Every component must handle these states:

```
IDEAL STATE
  → Component has all data, renders perfectly

LOADING STATE
  → Component shows progress indicator
  → Message tells user WHAT is happening
  → If slow (>3s), shows estimated time
  → If very slow (>10s), shows partial data with "Still loading..."
  → NEVER shows a spinner with no context

PARTIAL STATE
  → Some data available, some still loading
  → Shows what it has, skeletons for what it doesn't
  → Never blocks on complete data if partial is useful

EMPTY STATE
  → Component has no data
  → Contextual message (NOT "No data found")
  → Tells user WHY it's empty
  → Provides clear next action
  → The CTA button is always visible and specific

ERROR STATE
  → Component failed to load
  → Specific error message (NOT "An error occurred")
  → Retry button
  → Contact support link
  → If partial data exists, shows it with error notice

DEGRADED STATE
  → AI engine is down or slow
  → Shows cached/stale data with clear freshness indicator
  → "Showing data from 2 hours ago. AI analysis temporarily unavailable."
  → Does NOT pretend real-time data is available

STALE STATE
  → Data exists but is old
  → Freshness badge shows amber/red
  → Text gets opacity treatment (Getting Old: 70%, Stale: 50%)
  → Outdated text gets line-through
  → Re-enrich CTA is prominent

TENTATIVE STATE
  → Data exists but confidence is low
  → Border becomes dashed (not solid)
  → Badge says "Unverified" or "Tentative"
  → User understands this is a lead, not a conclusion

CONFLICT STATE
  → Multiple signals contradict each other
  → Shows both with "Conflicting signals" indicator
  → Links to reasoning trail that explains the conflict
  → Does NOT hide the conflict behind a single score

ZERO-CATEGORY STATE
  → User has no accounts, no signals, nothing
  → Hero empty state with illustration
  → Clear onboarding path: Import data → Enrich → Analyze
  → Does NOT show a blank dashboard
```

### Micro-State Rules

**Card hover:**
- Interactive cards lift (translateY(-1px)) and show elevated shadow
- Non-interactive cards do NOT respond to hover
- Hover feedback must be immediate (< 150ms)
- Cards must have a pressed state (scale(0.97)) for mouse interaction

**Button states:**
- Default → Hover (background change) → Active (scale(0.97)) → Disabled (opacity 0.5, no pointer)
- Loading state: show spinner inside button, text changes to "Processing..."
- Success state: brief scale pulse (1.0 → 1.02 → 1.0), color change to success, checkmark appears
- Error state: shake animation, color change to destructive, error message appears below

**Input focus:**
- Focus ring appears immediately (2px solid accent, 4px offset shadow)
- Focus ring must be visible on ANY background surface
- Focus must follow keyboard navigation order
- Focus must be managed when modals/drawers open/close (trap focus, return focus)

**Skeleton loading:**
- Must match the exact shape of the expected content
- Shimmer animation: subtle, not flashy
- Must not suggest content shape inaccurately
- Must disappear with a fade, not an instant swap

**Toast notifications:**
- Success: green left border, auto-dismiss after 5s
- Error: red left border, requires manual dismiss
- Warning: amber left border, auto-dismiss after 8s
- Info: blue left border, auto-dismiss after 5s
- Must stack if multiple (max 3 visible, oldest dismissed)

---

## 1.7 Accessibility Is Not a Checklist

WCAG 2.2 AA compliance is a baseline, not a goal.
The goal is that every interaction FEELS accessible.

### The Accessibility Feel

A keyboard user should NEVER feel like a second-class citizen.

```
BAD: A card that looks clickable but is only clickable with a mouse.
     A keyboard user tabs to it, presses Enter, nothing happens.
     They feel broken.

GOOD: A card has tabindex="0", role="button", onKeyDown for Enter/Space.
      A keyboard user tabs to it, presses Enter, it opens.
      They feel empowered.
```

```
BAD: A modal opens and focus stays on the trigger button.
     A keyboard user presses Tab, focus jumps to the page behind the modal.
     They feel lost.

GOOD: A modal opens and focus moves to the first interactive element.
     Focus is trapped within the modal until it closes.
     When it closes, focus returns to the trigger button.
     They feel guided.
```

```
BAD: A screen reader announces "87" for a confidence score.
     The user has no idea what 87 means.

GOOD: A screen reader announces:
     "87 percent confidence, medium confidence, based on 4 sources,
      most recent 2 days ago, 3 CRM records and 1 news article"
     The user understands the full context.
```

### Focus Management Rules

**Page load:**
- Focus moves to the main content area
- Skip-to-content link is the first Tab stop

**Navigation:**
- Tab order follows visual layout (top-to-bottom, left-to-right)
- Active nav item gets aria-current="true"
- Arrow keys navigate within nav groups

**Modal open:**
- Focus moves to first interactive element inside modal
- Focus trapped within modal
- Escape closes modal and returns focus to trigger

**Modal close:**
- Focus returns to the element that opened the modal
- If the element no longer exists, focus moves to nearest focusable ancestor

**Dynamic content:**
- New content areas get aria-live="polite" (status updates)
- Critical errors get aria-live="assertive" (immediate attention)
- Loading indicators get role="status"

**Interactive cards:**
- MUST be `<button>` elements, not `<div onClick>`
- If `<div>` is unavoidable, MUST have: role="button", tabIndex=0, onKeyDown for Enter/Space
- aria-expanded on cards that expand/collapse
- aria-label on icon-only buttons

---

## 1.8 The Precision Standard

DeepMindQ is built on a 6-surface depth system.
The difference between Surface 2 (Card: #121822) and Surface 3 (Elevated: #1a2230) is just 16 units of lightness.

This is not an accident. This is precision.

Every color, every spacing value, every animation duration
has been chosen for a specific reason.

**The 4px grid:**
All spacing values are multiples of 4px.
4px, 8px, 12px, 16px, 20px, 24px, 32px, 40px, 48px, 64px.

**Why 4px?**
Because the human eye can perceive differences of ~4px at 13px font size.
Anything smaller is invisible. Anything larger feels coarse.
4px is the atomic unit of visual rhythm.

**The 8px component spacing rule:**
Components within a card are spaced 8px apart.
Cards within a section are spaced 16px apart.
Sections within a page are spaced 24px apart.
Major page sections are spaced 32px apart.

**The 12px radius rule:**
All cards have border-radius: 12px.
All inputs have border-radius: 8px.
All badges have border-radius: 9999px (pill).
All buttons have border-radius: 8px.

**Rule: No magic numbers.**
Every spacing, radius, and size value must be traceable to this system.
If you need a value not in the system, propose adding it — don't invent it ad hoc.

---

# PART II: VISUAL DESIGN SYSTEM — THE BODY

## 2.1 Surface & Depth System

### 6-Surface Hierarchy

```
Surface 5 (Float):    #2a3650  — Tooltips, dragged elements, toasts, command palette dropdowns
Surface 4 (Overlay):  #222c3c  — Modals, full-screen overlays, command palette backdrop
Surface 3 (Elevated): #1a2230  — Popovers, dropdowns, card hover states, combobox
Surface 2 (Card):     #121822  — Primary content containers, cards, panels, input fields
Surface 1 (Base):     #0c1018  — Page background, sidebar background, header background
Surface 0 (Sunken):   #06080c  — Inactive wells, disabled areas, empty states background
```

Delta L* between each surface is approximately 3-4.
A modal (Surface 4) ALWAYS feels above a card (Surface 2).
A tooltip (Surface 5) ALWAYS feels above a modal (Surface 4).
No ambiguity. No exceptions.

### Surface Assignment

| Element | Surface | Token |
|---|---|---|
| Page background | 1 (Base) | --ios-bg-primary |
| Sidebar | 1 (Base) | --ios-bg-primary |
| Header | 1 (Base) + glass | --ios-bg-primary + backdrop-blur |
| Card (rest) | 2 (Card) | --ios-bg-card |
| Card (hover) | 3 (Elevated) | --ios-bg-card-hover |
| Input fields | 2 (Card) | --ios-bg-card |
| Dropdown | 3 (Elevated) | --ios-bg-elevated |
| Popover | 3 (Elevated) | --ios-bg-elevated |
| Modal | 4 (Overlay) | --ios-bg-overlay |
| Command palette | 4 (Overlay) | --ios-bg-overlay |
| Tooltip | 5 (Float) | --ios-bg-float |
| Toast | 5 (Float) | --ios-bg-float |
| Disabled wells | 0 (Sunken) | --ios-bg-sunken |
| Empty states | 0 (Sunken) | --ios-bg-sunken |

---

## 2.2 Typography System

### Scale

| Element | Size | Weight | Tracking | Line-Height | Usage |
|---|---|---|---|---|---|
| Display | 28px | 700 | -0.025em | 1.15 | Hero numbers, intelligence scores, KPIs |
| Heading | 18px | 600 | -0.02em | 1.2 | Section titles, card titles |
| Subheading | 14px | 600 | -0.01em | 1.3 | Card headers, nav labels |
| Body | 13px | 400 | 0 | 1.6 | Primary content, AI output |
| Caption | 11px | 500 | 0 | 1.4 | Timestamps, source labels, metadata |
| Micro | 10px | 600 | 0.08em | 1.3 | DECORATIVE ONLY: dividers, watermarks |

**Rule: No human-readable information below 11px. Period.**
If a user needs to read it, it is 11px minimum.
10px is reserved exclusively for decorative elements.

### Font Stack

```
Primary: Inter (--font-inter)
Mono:    Geist Mono (--font-geist-mono)
```

### Typographic Color on Card Surface

| Context | Color | Contrast |
|---|---|---|
| Heading on card | --ios-text-primary (#e8ecf4) | 12.8:1 |
| Body on card | --ios-text-primary (#e8ecf4) | 12.8:1 |
| Muted on card | --ios-text-muted (#707088) | 4.7:1 |
| Display number on card | --ios-text-primary (#e8ecf4) | 12.8:1 |
| Accent on card | --ios-accent (#3b82f6) | 4.6:1 |

---

## 2.3 Color Semantics — Maximum 3 Per Card

### Priority System

```
Critical:  #EF4444    — Immediate action required
High:      #F59E0B    — Time-sensitive
Medium:    #3B82F6    — Important, review when ready
Low:       #6B7280    — Informational
```

### Confidence System

```
High (>=75%):    #10B981    — Verified, trusted
Medium (50-74%):  #F59E0B    — Tentative
Low (<50%):      #EF4444    — Unverified
```

### Freshness System

```
Just In (0-7d):       #10B981 — bright green, 10s pulse on appear
Recent (8-30d):       #10B981 — standard green, static
Getting Old (31-60d):  #F59E0B — amber-yellow, static
Stale (61-90d):       #F97316 — orange, static
Outdated (91+d):      #EF4444 — red, parent text opacity:0.5 + line-through
```

### Intelligence Category System

```
Signal:       #3B82F6 (blue)
Opportunity:  #8B5CF6 (purple)
Risk:         #EF4444 (red)
Competitive:  #F59E0B (amber)
Technology:   #06B6D4 (cyan)
Leadership:   #EC4899 (pink)
Financial:    #10B981 (emerald)
```

### Card Color Rule

```
Priority 1: Card border/accent → DETERMINES ACTION (always visible)
Priority 2: Top-right badge    → CONFIDENCE (if notable)
Priority 3: Bottom-left        → FRESHNESS (if not Just In/Recent)

MAXIMUM 3 COLORS PER CARD. NO EXCEPTIONS.
```

### Tension State Matrix

| Confidence \ Urgency | Low | Medium | High |
|---|---|---|---|
| **High (>=75%)** | Solid border, Gray "Informational" | Solid border, Blue "Notable" | Solid border, Red "Critical - Confirmed" |
| **Medium (50-74%)** | Dotted border, Gray "Unverified" | Solid border, Amber "Tentative" | Solid border, Amber "Critical - Tentative" |
| **Low (<50%)** | Dotted border, Gray "Unverified" | Dashed border, Gray "Unverified" | Dashed border, Amber "Critical - Tentative" |

### Confidence Display — Always 3-Part

```
Compact:  "73% · 4 sources · 2d ago"

Expanded: "73% — Based on 4 sources
            3 CRM records · 1 news article
            Most recent: 2 days ago
            Limited cross-referencing"
```

---

## 2.4 Motion Design

### Animation Rules

| Context | Animation | Duration | Easing | Reduced Motion |
|---|---|---|---|---|
| Page transition | Fade + slide up | 300ms | ease-out | Instant |
| Card appear | intelReveal | 600ms | cubic-bezier(0.16, 1, 0.3, 1) | Instant |
| Section stagger | intelReveal + 100ms delay | 600ms/section | cubic-bezier(0.16, 1, 0.3, 1) | Instant |
| Card hover | translateY(-1px) + shadow | 200ms | ease-out | Shadow only |
| Card press | scale(0.97) | 100ms | ease-out | None |
| Action complete | scale(1.0 → 1.02 → 1.0) | 300ms | ease-in-out | Checkmark only |
| Just In pulse | opacity 0.4 → 1.0 | 10s | ease-in-out | Static |
| Confidence count-up | 0 → value | 800ms | ease-out | Static value |
| Skeleton shimmer | gradient sweep | 1.5s/cycle | ease-in-out | Static gray |
| Modal open | fade + scale(0.95→1.0) | 200ms | cubic-bezier(0.16,1,0.3,1) | Instant |
| Toast appear | slide from top + fade | 300ms | ease-out | Instant |
| Tooltip | fade + translateY(4px) | 150ms | ease-out | Instant |
| Sidebar collapse | width transition | 300ms | cubic-bezier(0.4,0,0.2,1) | Instant |

### Motion Philosophy

Motion in DeepMindQ serves THREE purposes:
1. **Feedback** — Confirms the user's action was received
2. **Orientation** — Guides the eye to what changed
3. **Narrative** — Paces the intelligence story

Motion must NEVER be decorative.
If an animation does not serve one of these three purposes, remove it.

---

## 2.5 Spacing System (4px Grid)

```
4px  — Micro spacing (icon to label)
8px  — Component internal (badge padding, icon button padding)
12px — Tight component (input padding, small card padding)
16px — Standard (card padding, section internal spacing)
20px — Comfortable (section header padding)
24px — Section separation (between groups)
32px — Major separation (between page sections)
40px — Generous (hero spacing, header padding)
48px — Page margins on desktop
64px — Maximum (command center gaps)
```

---

# PART III: COMPONENT SPECIFICATIONS — THE HANDS

## 3.1 Card System

### Base Card (.ios-card)

```
Background:    var(--ios-bg-card)    — #121822
Border:         1px solid var(--ios-border)  — #1e2535
Border-radius:  12px
Padding:        16px 20px
Shadow:         var(--shadow-xs) — 0 1px 2px 0 rgb(0 0 0 / 0.08)
Transition:     border-color 0.2s, background 0.2s

Hover state:
  Background:    var(--ios-bg-card-hover)  — #1a2230
  Border:        var(--ios-border-hover)   — #334058
  Shadow:        var(--shadow-raised)
```

### Interactive Card (.ios-card-interactive)

```
All properties of base card, plus:
  Cursor:        pointer
  Transition:   border-color 0.2s, background 0.2s, transform 0.15s

Hover state:
  Transform:    translateY(-1px)
  Border:       var(--ios-accent)

Active state:
  Transform:    scale(0.97)
  Transition:   100ms ease-out
```

### Intelligence Card (.intel-card)

```
All properties of base card, plus:
  Left accent stripe: 3px wide, full height
  Stripe color: var(--stripe-signal, #3B82F6) by default
  Accent variants: [data-accent="opportunity"] [data-accent="risk"] [data-accent="enrichment"]

  CRITICAL FIX NEEDED:
  Current code uses bg-white border-slate-200 (LIGHT MODE).
  MUST BE: bg-[var(--ios-bg-card)] border-[var(--ios-border)]
```

### Card Border by Tension State

```
Confirmed:         solid border, full opacity
Tentative:         solid border, full opacity (amber)
Informational:     solid border, full opacity (gray)
Unverified:        dotted border, var(--ios-border)
Critical-Tentative: dashed border, var(--ios-border) (amber)
```

---

## 3.2 Badge System

### Intelligence Badge (.intel-badge)

```
Padding:        2px 8px
Border-radius:  9999px (pill)
Font:           11px/500 (Caption)
Background:     Color-specific with oklch values
Text:           Matching high-contrast color

CRITICAL FIX NEEDED:
  Current code uses bg-emerald-50 text-emerald-700 (LIGHT MODE).
  MUST BE dark-mode equivalents using oklch.

  High:    bg-[oklch(0.25 0.08 160)] text-[oklch(0.75 0.15 160)]
  Medium:  bg-[oklch(0.25 0.08 85)]  text-[oklch(0.75 0.15 85)]
  Low:     bg-[oklch(0.25 0.08 25)]  text-[oklch(0.75 0.15 25)]
```

### Priority Badge

```
Critical:  bg-red-500/15 text-red-400 border border-red-500/20
High:      bg-amber-500/15 text-amber-400 border border-amber-500/20
Medium:    bg-blue-500/15 text-blue-400 border border-blue-500/20
Low:       bg-gray-500/15 text-gray-400 border border-gray-500/20
```

### Freshness Badge (5 levels)

```
Just In:      Green, 10s pulse animation on mount
              text-[11px]/500 text-emerald-400
              Animation: intelPulse (opacity 0.4 → 1.0 over 2s, 5 cycles)

Recent:       text-[11px]/500 text-emerald-400 (static)

Getting Old:  text-[11px]/500 text-amber-400 (static)

Stale:        text-[11px]/500 text-orange-400 (static)

Outdated:     text-[11px]/500 text-red-400 (static)
              Parent text gets opacity: 0.5 + text-decoration: line-through
```

---

## 3.3 Empty State Design System

| Context | Icon | Title | Description | CTA |
|---|---|---|---|---|
| Never enriched | Search | "No intelligence yet" | "Enrich this account to unlock signals, evidence, and AI analysis." | [Enrich Account] |
| Enriched, no signals | Radar | "Monitoring active" | "Enriched {X} days ago. No significant signals detected yet. We'll continue monitoring." | [Force Re-enrich] |
| Expired intelligence | AlertTriangle | "Intelligence expired" | "Data is {X} days old and unreliable. Re-enrich for fresh insights." | [Re-enrich Now] |
| Processing | Loader2 (spinning) | "Analyzing {Company}..." | "Building intelligence from {N} sources. Estimated {X}s remaining." | None |
| Error | AlertTriangle | "Analysis failed" | "{Specific error message}" | [Retry] [Contact Support] |
| No contacts | Users | "No contacts found" | "Add contacts to this account to unlock stakeholder analysis." | [Add Contact] |
| No accounts (zero state) | Building2 | "Bring your intelligence" | "Import your first accounts to start discovering opportunities." | [Import Accounts] |
| AI engine down | Cpu | "AI analysis unavailable" | "The intelligence engine is temporarily unavailable. Showing cached data from {time}." | [Retry] |
| Governance failed | ShieldAlert | "Governance check failed" | "AI output could not be verified. Review with caution." | [View Anyway] |

**Rule: Empty states are contextual, never generic.**
"Loading..." is not an empty state message.
"Building intelligence from 14 sources" IS an empty state message.

---

## 3.4 AI Explanation Panel

### Structure

```
┌─ AI Analysis Panel ─────────────────────────────────────────┐
│                                                               │
│  [Analysis summary — why this matters]                        │
│  [Impact assessment with sub-items]                          │
│                                                               │
│  ── Reasoning Trail (collapsed by default) ──────────────    │
│  ▶ Enterprise Reasoning: 30 steps analyzed                  │
│  ▶ Key findings: 4 | Opportunities: 2 | Risks: 1             │
│  ▶ Confidence: 87%                                          │
│                                                               │
│  ── What would improve this? (collapsed) ───────────────    │
│  ▶ "Add more recent news sources"                            │
│  ▶ "Verify the CTO departure through a second source"       │
│                                                               │
│  ── What we don't know (collapsed) ─────────────────────    │
│  ⚠ "Budget allocation for the new CTO is unknown"           │
│  ⚠ "Incumbent vendor contract terms are not available"       │
│  ⚠ "Internal stakeholder preferences are not captured"       │
│                                                               │
│  ───────────────────────────────────────────────────────    │
│  Generated by DeepMindQ · GPT-4o · 2.1s                      │
│                                                               │
└───────────────────────────────────────────────────────────┘
```

### Trust Architecture in the Panel

The AI Explanation Panel embodies Layer 3 (Honesty Trust).
By showing "What we don't know," the system demonstrates:
- It understands its own limitations
- It is not trying to appear omniscient
- It wants the user to make informed decisions

This is the most important component in DeepMindQ.
It is the component that makes the user FEEL intelligent
rather than feeling marketed to.

**Rule: "What we don't know" must NEVER be empty.**
If the AI has no limitations to report, say:
"Based on available data, no significant knowledge gaps identified."
Do not leave this section out.

---

# PART IV: INFORMATION ARCHITECTURE — THE STRUCTURE

## 4.1 Navigation — 5 Segments

```
COMMAND CENTER    — Executive intelligence cockpit
ACCOUNTS          — Company intelligence workspace
INTELLIGENCE      — Signals, reasoning, fusion
WORKSPACES        — Mind map, knowledge, conversation
ACTIONS           — Recommendations, execution
─────────────────
[Settings gear]   — System, data, admin (not a primary segment)
```

### Rationale for 5 Segments (Not 7)

1. 5 mirrors the 5-question workspace — conceptual consistency
2. Role-based hiding adds complexity without user value
3. Admin features are infrequent — they don't earn primary nav space
4. Bloomberg doesn't hide features — everything is accessible
5. Simpler navigation = faster time to value

### Segment → Screen Map

```
COMMAND CENTER
  /app                              — Main dashboard
  /app/command-center/analytics     — Deep-dive charts
  /app/command-center/health        — System health, AI usage

ACCOUNTS
  /app/accounts                     — Intelligence-ranked account grid
  /app/accounts/[id]                — Company Workspace (5Q hero)
  /app/accounts/import              — "Bring Your Intelligence"

INTELLIGENCE
  /app/intelligence/signals         — Cross-account signal feed
  /app/intelligence/reasoning       — Enterprise reasoning (30 steps)
  /app/intelligence/fusion          — Fusion intelligence
  /app/intelligence/associations   — Cross-account patterns
  /app/intelligence/scheduler       — Source scheduling

WORKSPACES
  /app/workspaces/mindmap           — Interactive knowledge graph
  /app/workspaces/knowledge         — Capabilities library
  /app/workspaces/conversation      — Conversation studio
  /app/workspaces/revenue           — Revenue intelligence

ACTIONS
  /app/actions                      — Action queue
  /app/actions/sequences            — Outreach sequences
  /app/actions/email                — Email generation

SETTINGS (gear icon)
  /app/settings                     — User preferences
  /app/settings/data-health         — Data quality
  /app/settings/ai-workbench        — AI cost, governance
  /app/settings/integrations         — Connectors
  /app/settings/audit               — Audit log
  /app/settings/admin               — User management
```

---

## 4.2 The 5-Question Workspace — The Core Product

### Loading Strategy: One-Shot, Progressive Render

```
GET /api/intelligence/company/{id}

Returns FULL IntelligenceCompanyContext.

Rendering happens client-side in stages:

IMMEDIATE (< 500ms):
  Company header, 3 scores, quality bar
  Skeleton placeholders for all 5 sections

FAST (< 2s):
  Signals (Section 1), Stakeholders (Section 3)
  Skeletons replaced with content

FULL (< 5s):
  Reasoning (Section 2), Outreach (Section 4), Actions (Section 5)
  Full content rendered

ENHANCED (background):
  Knowledge matching, mindmap data
  Available when user navigates to those areas
```

### Why One-Shot, Not Per-Section API Calls

The workspace is a NARRATIVE.
Narratives have pacing.
If Section 2 loads 5 seconds after Section 1,
the user reads signals, scrolls to analysis, and waits.
That breaks the narrative flow.

One-shot means the server composes everything.
The frontend splits and reveals progressively.
The story unfolds naturally.

---

## 4.3 Screen Design Principles

### Every Screen Must Answer:

1. "Where am I?" — Clear header with breadcrumb or back navigation
2. "What am I looking at?" — Page title that describes the content's purpose
3. "What should I do?" — Primary CTA visible within 1 second
4. "What's the trust level?" — Quality bar or confidence indicator if AI-powered
5. "What if something goes wrong?" — Error state with retry, empty state with CTA

### Command Center Philosophy

The Command Center is NOT a data dump.
It is an executive briefing.

```
TOP:    System health (trust bar)
ROW 1:  4 KPIs (numbers that matter)
ROW 2:  Signal feed (60%) + Opportunity radar (40%)
ROW 3:  Action queue (highest-priority actions)
```

Information density: HIGH.
Visual noise: LOW.
Every element earns its place.

### Accounts List Philosophy

The accounts list is NOT a CRM table.
It is an intelligence ranking.

Cards, not rows.
3 scores visible (ICP, Intelligence, Opportunity).
Latest signal preview.
Priority border color.
Click opens Company Workspace.

Sort by intelligence priority. Filter by tier. That's it.

### Mind Map Philosophy

The mind map is NOT a tree diagram.
It is an interactive knowledge graph.

Force-directed layout. Physics-based clustering.
Company → Signal → Capability → Contact → Action connections.
Click to select. Double-click to drill. Hover to preview.
Pan and zoom. Filter by node type.

---

# PART V: INTERACTION DESIGN — THE NERVES

## 5.1 Keyboard Shortcuts

| Shortcut | Action | Context |
|---|---|---|
| Cmd+K | Command palette | Global |
| Cmd+B | Toggle sidebar | Global |
| 1-5 | Jump to question section | Company Workspace |
| J/K | Next/previous item | Lists |
| Enter | Open/drill into | Lists |
| Esc | Close/return | Modals |
| Cmd+E | Trigger enrichment | Company Workspace |
| R | Refresh intelligence | Company Workspace |

## 5.2 Responsive Breakpoints

```
Desktop XL:  >= 1440px (primary design target)
Desktop:     >= 1024px (standard)
Tablet:      >= 768px  (sidebar becomes overlay)
Mobile:      < 768px   (companion only — simplified view)
```

## 5.3 Responsive Adaptation Rules

| Element | Desktop XL | Desktop | Tablet | Mobile |
|---|---|---|---|---|
| Sidebar | 260px expanded | 72px collapsed | Overlay | Hidden |
| KPI cards | 4 across | 4 across | 2x2 | Stacked |
| Signal + Opportunity | 60/40 columns | 60/40 | Stacked | Stacked |
| Company scores | 3 across | 3 across | 3 across | Horizontal scroll |
| 5Q workspace | Full narrative | Full narrative | Full-width sections | Signals + Actions only |
| Mind map | Graph + detail panel | Graph + detail | Touch graph | "Open on desktop" |
| Buying committee | 3 across | 3 across | 3 across | Horizontal scroll |

---

# PART VI: TRUST & GOVERNANCE VISUAL LANGUAGE — THE SHIELD

## 6.1 Trust Indicator

Every AI-powered screen header shows:

```
Intelligence Quality: 87% · 14 sources · Fresh · Verified
```

Compact bar. Not prominent. Always visible.
Uses IntelligenceQualityBar component.

## 6.2 Governance Status Indicators

```
Verified:       Green checkmark + "Verified" badge
Needs Review:   Amber warning + "Needs Review" badge
Failed:         Red X + "Governance Failed" badge
Not Evaluated:  Gray dash + "Not Evaluated" badge (default for new records)
```

## 6.3 Evidence Grounding Bar

On AI-generated content (outreach drafts, analysis):

```
[Checkmark] Evidence grounded — no fabricated metrics
```

or

```
[Warning] Contains unverified claims — review recommended
```

This bar is ALWAYS visible on AI-generated text.
It is the single most important trust element.

## 6.4 AI Footer

Every AI-generated panel shows:

```
Generated by DeepMindQ · {model} · {time}s
```

Transparency about what generated the content.
Not hidden in settings. Front and center.

---

# PART VII: CONTEXT-AWARE INTELLIGENCE WORKFLOW

## 7.1 The Principle

DeepMindQ does not show the same UI regardless of context.

The workspace adapts based on:
- **Company maturity:** New account (no data) vs. enriched account (full data)
- **Signal density:** Company with 0 signals vs. 15 signals
- **Intelligence age:** Fresh intelligence (today) vs. stale (90 days)
- **User action history:** First visit vs. returning user
- **Opportunity stage:** Discovery vs. Proposal

### Context Adaptation Examples

**New account (no intelligence):**
```
Instead of: 5 empty sections with "No data"
Show:       Single hero empty state:
            "This account has no intelligence yet.
             [Enrich Now] to discover signals, build analysis,
             and get AI-powered recommendations."
```

**Account with only signals, no actions:**
```
Section 5 (What To Do):
  Instead of: Empty state
  Show: "Intelligence detected {N} signals but has not yet
         generated actionable recommendations.
         This typically requires 5+ signals with evidence.
         [Force Analysis]"
```

**Stale intelligence (>60 days):**
```
Header shows:
  "Intelligence Quality: STALE · Last enriched 67 days ago"
  Background: subtle red tint on quality bar
  All sections show amber freshness indicators
  Prominent [Re-enrich] CTA
```

**User returning to a company they visited before:**
```
Subtle indicator: "3 new signals since your last visit"
Sections they've already viewed show a "Viewed" checkmark
New content highlighted with Just In treatment
```

## 7.2 Design for Decision Velocity

The primary purpose of DeepMindQ is to accelerate decisions.
Every design choice must serve decision velocity.

**The 3-Second Rule:**
Within 3 seconds of opening any screen, the user must understand:
1. What they're looking at
2. What's most important
3. What to do next

If any screen fails this test, it needs redesign.

**The One-Action Rule:**
Every screen must have ONE primary action.
Not five. Not three. ONE.
The user should never wonder "What am I supposed to do here?"

Command Center: "Review [highest-priority action]"
Accounts: "Open [highest-priority account]"
Company Workspace: [Re-enrich] or [Take Action] on the highest-priority item
Signals: "Open [most urgent signal]"
Actions: "Execute [highest-priority action]"

---

# PART VIII: THE INTELLIGENCE API CONTRACT

## 8.1 Response Shape: GET /api/intelligence/company/{id}

This is the single most important API contract.
The Company Workspace consumes it entirely.

```
IntelligenceCompanyContext {
  company: { id, name, industry, geography, website, description, logo,
             employeeCount, revenue, foundedYear, stage, icpFit }

  scores: {
    accountPriority: { score, tier, breakdown, trend, trendDelta }
    intelligenceScore: { score, grade, breakdown, trend, trendDelta }
    opportunityScore: { score, probability, estimatedValue, stage,
                        breakdown, trend, trendDelta }
  }

  signals: Signal[]
  reasoning: { summary, impactAssessment, steps, keyFindings,
               opportunityWindows, riskSignals }
  stakeholders: Stakeholder[]
  outreach: { conversationPrep, draft }
  actions: RecommendedAction[]
  knowledge: { matchedCapabilities, caseStudies, battleCards, smeRecommendations }
  mindmap: { nodes: GraphNode[], edges: GraphEdge[] }

  metadata: GovernedAIResponseMetadata
}
```

## 8.2 Sub-Types

```
Signal {
  id, type, title, summary,
  priority: critical|high|medium|low,
  confidence: number,
  freshness: { status, days },
  detectedAt, source: { type, label, url },
  evidenceCount, evidenceIds, reasoningChain,
  tensionState: confirmed|tentative|informational|unverified,
  companyContext
}

Stakeholder {
  id, name, title, role,
  buyingRole: decision_maker|influencer|champion|blocker|budget_holder,
  influence: number, relevanceScore: number,
  engagementSignals: string[], lastContact,
  recommendedApproach
}

RecommendedAction {
  id, action, rationale, evidenceIds,
  priority: critical|high|medium|low,
  confidence: number,
  urgency: immediate|this_week|this_month|when_ready,
  owner, timingWindow,
  status: pending|in_progress|completed|dismissed|snoozed,
  tensionState
}

GovernedAIResponseMetadata {
  confidence, classification,
  evidenceIds, reasoningChain,
  governanceStatus, governanceChecks,
  freshnessStatus, lastVerified,
  limitations, processingTimeMs
}
```

## 8.3 All Intelligence API Endpoints

```
GET /api/intelligence/company/{id}         — Full company context
GET /api/intelligence/company/{id}?include=  — Partial (signals,actions,etc.)
GET /api/intelligence/reasoning/{id}        — Detailed 30-step reasoning
GET /api/intelligence/opportunity/{id}      — Opportunity intelligence
GET /api/intelligence/action/{id}            — Action recommendations
GET /api/intelligence/conversation/{id}      — Conversation preparation
GET /api/intelligence/mindmap/{id}           — Knowledge graph data
GET /api/intelligence/companies              — Account list with scores
GET /api/intelligence/signals                — Cross-account signals
GET /api/intelligence/stats                  — System-wide statistics
```

---

# PART IX: DESIGN FEEL PRINCIPLES — THE INSTINCT

## 9.1 When It Feels Right

These are the feelings that confirm good design.
You cannot test for these with a spec.
You develop the instinct through practice and attention.

**"This card feels important."**
The priority border color, the confidence badge, the freshness indicator,
the evidence count — they work together to create a sense of urgency
without shouting. The card communicates its importance through hierarchy,
not through size or noise.

**"I trust this number."**
The confidence indicator shows 87%, 4 sources, 2 days ago.
Below it, a subtle link says "View Evidence."
The number is grounded. The user doesn't have to take it on faith.
Trust is built through transparency, not through authority.

**"The system is honest with me."**
An analysis says "We don't know the budget allocation."
A signal says "Unverified — 22% confidence."
An empty state says "Not enough data to analyze."
The system never pretends to know more than it does.
Honesty is the foundation of emotional trust.

**"This page has a rhythm."**
Cards are spaced 16px apart. Sections are separated by 24px.
Major areas by 32px. The page breathes at a steady pace.
Nothing feels cramped. Nothing feels wasted.
The 4px grid creates visual harmony that the user FEELS even if they cannot name it.

**"I know what to do next."**
Every screen has one primary action.
Every section has a clear purpose.
The workspace guides the user through 5 questions in order.
The narrative flows naturally from awareness to action.
The user never feels lost or overwhelmed.

**"This was designed for me."**
A sales leader opens DeepMindQ and sees signals, not spreadsheets.
They see recommendations, not reports.
They see intelligence, not data.
They see their job, reflected back at them by an AI that understands their world.

## 9.2 When It Feels Wrong

**"This card feels off-brand."**
A card uses a border-radius of 16px instead of 12px.
It uses padding of 24px instead of 20px.
The shadow is too heavy. The border color is too bright.
These are small deviations that create a feeling of inconsistency.
The user may not know WHY it feels wrong.
But it feels wrong.

**"This spacing feels wrong."**
Two cards are 10px apart instead of 16px.
A section header has 8px padding instead of 20px.
The breathing is off. The page feels claustrophobic.
The user scrolls faster, trying to escape the density.

**"This interaction feels inaccessible."**
A card is clickable but has no focus indicator.
A modal doesn't trap focus.
A loading spinner has no aria-label.
The keyboard user feels invisible.
Accessibility is not an afterthought — it is the foundation.

**"This error feels broken."**
An error says "Something went wrong" with no explanation.
A retry button doesn't work.
A loading state spins forever with no progress indication.
The user feels abandoned by the system.

**"This data feels untrustworthy."**
An AI insight has no confidence score.
A number has no source attribution.
A recommendation has no reasoning trail.
The user feels like they're being asked to take it on faith.
Trust cannot be demanded. It must be earned.

---

# PART X: EXECUTION CHECKLISTS — THE MEASURE

## 10.1 Before Any Component Ships

```
VISUAL
[ ] Uses --ios-* tokens (no hardcoded hex except in globals.css)
[ ] Correct surface level (card on Surface 2, not Surface 3)
[ ] Correct border-radius (cards: 12px, inputs: 8px, badges: pill)
[ ] Correct spacing (4px grid multiples)
[ ] Maximum 3 colors per card
[ ] All text >= 11px (unless decorative micro)
[ ] Contrast passes 4.5:1 for body text, 3:1 for large text
[ ] Dark mode only (no light mode classes)

TRUST
[ ] AI output shows confidence indicator
[ ] Evidence trail is one click away
[ ] Governance status is visible
[ ] "What we don't know" section exists (if AI-generated)
[ ] AI footer shows model and processing time
[ ] Evidence grounding bar on AI-generated text

INTERACTION
[ ] Hover state defined (or intentionally absent)
[ ] Press state defined
[ ] Focus indicator visible (2px accent ring + 4px offset)
[ ] Focus order matches visual order
[ ] Keyboard accessible (Tab, Enter, Escape work)
[ ] aria-label on icon-only buttons
[ ] aria-expanded on collapsible elements
[ ] aria-live on dynamic content

STATE
[ ] Loading state with progress indication
[ ] Empty state with contextual message + CTA
[ ] Error state with specific message + retry
[ ] Partial state handles gracefully (shows what it has)
[ ] Stale state shows freshness indicator
[ ] Tentative state shows dashed border + "Unverified"

NARRATIVE
[ ] Answers "Where am I?"
[ ] Answers "What am I looking at?"
[ ] Answers "What should I do?"
[ ] Answers "Can I trust this?"
[ ] Answers "What if something goes wrong?"

PERFORMANCE
[ ] Animation respects prefers-reduced-motion
[ ] No layout shift on content load
[ ] Image/icon lazy loading if below fold
[ ] No unnecessary re-renders
```

---

# END OF DESIGN BIBLE

This document is the permanent design authority for DeepMindQ.
When in doubt, return to this document.
When a new pattern is needed, propose an addition to this document.
When a pattern violates this document, it is wrong until the document is changed.

The Feel Standard is not a section — it is the lens through which every section is read.

DeepMindQ makes the user FEEL intelligent.
That is the product.
That is the standard.
That is the bible.
