# AI Collaboration Context

This file documents the thought process, decisions, research, and iterations made throughout this project. It is intentionally maintained from the start to show how the product idea evolved — not just the final result.

---

## How I Collaborated with AI

The AI's first pass at problem discovery produced five consumer-facing pain points — member financial anxiety, loan friction, emergency savings gaps. All technically valid fintech problems, but wrong. I stopped the process and redirected: the real customer here is the institution, not the end member, and the problem worth solving is operational, not consumer-facing. That redirect wasn't a prompt tweak — it was a judgment call about who actually has budget, who has daily pain, and what Nymbus actually sells. The AI generated good research once I pointed it at the right user. It couldn't have made that call on its own.

The bigger redirect came mid-project. After a full requirements pass on PayPath — an instant payments readiness tracker — I recognized the product had a fundamental flaw: a user fills it out once and never comes back. It has no recurring value. I cut the entire spec, scrapped the work, and reframed around a daily ops monitor. The AI did not surface this problem. I did, by asking one question: "Would a VP of Payments open this every day?" The answer for PayPath was no. That question, and the willingness to throw away completed work to answer it correctly, is the judgment the AI cannot provide.

Rather than asking the AI to review requirements generically, I directed it to simulate six distinct roles simultaneously — QA Engineer, Software Engineer, Payments Operations Manager, Solutions Architect, Product Manager, and a Skeptic persona specifically tasked with finding logical contradictions. I then ran additional passes with a UX Designer, CRO, and Sales Engineer. This produced 14 concrete spec changes that a single review pass would have missed entirely: the missing dollar exposure field in the exception queue (the Ops Manager called count-without-value useless), the ACH Same Day SLA threshold error (it had been lumped with ACH Standard at 72 hours instead of the correct 8), and the DataProvider interface framing that makes the Nymbus Connect integration story concrete for a sales conversation. Each of those changes came from directing the AI to inhabit a specific perspective, not from asking it to "review the requirements."

There were also moments where I explicitly overrode what the AI produced or suggested. The FRED and Frankfurter APIs were initially scoped as standalone market context panels — I cut them down to single contextual indicators after the Ops Manager persona correctly identified them as noise for a daily ops workflow. I rejected the cross-border payments problem despite the AI generating strong research on it, because the transaction frequency is wrong for a community credit union's daily use case — high drama, low volume, not a morning dashboard problem. And when the Sales Engineer persona suggested softening or removing the Demo Mode label to improve credibility in a demo, I kept it. Compliance and honesty with the reviewer mattered more than polish. The AI surfaces options; I decide which ones are right.

---

## Assignment

**Source:** AI-First Product Owner — Take-Home Assessment  
**Goal:** Build something useful in the personal finance or fintech space. Identify a real problem, define requirements, design a system, and implement a working application using Kiro's spec-driven workflow.

**Constraints:**
- Domain: personal finance, banking, or fintech
- Must integrate at least 2 public APIs
- Must be built using Kiro's spec-driven workflow
- Must be published to a public GitHub repo (including `.kiro/` directory)

---

## Session 1 — Problem Discovery

### Starting Point

The assignment was intentionally open-ended. Rather than jumping straight to a solution, the decision was made to ground the product in a real, researched problem — specifically looking at pain points that **Nymbus** customers (community banks and credit unions) are experiencing today.

### Initial Research Direction

First pass of research explored general community bank/credit union member pain points:
- 60%+ of credit union members are financially struggling
- 27% of Americans have zero emergency savings
- 69% worry they couldn't cover expenses if they lost their job
- Members are leaving for neobanks that offer proactive financial tools

### First Problem Set (Consumer-Facing — Discarded)

An initial set of 5 problems was generated focused on the **end member** (consumer):

1. Members have no idea where they stand financially until something goes wrong
2. Loan anxiety is killing the member relationship before it starts
3. Members are quietly leaving for neobanks — and credit unions don't see it coming
4. Members treat their checking account like a "paycheck motel"
5. Emergency savings is a crisis hiding in plain sight

**Why discarded:** The user correctly redirected — we are solutioning for **banks and credit unions** as the customer, not the end member. The product needs to solve an operational or institutional problem, not a consumer UX problem.

### Reframe: B2B Focus on Payments and Core Banking

The user clarified: focus on problems related to **payments and core banking** that banks and credit unions face in serving their members.

### Second Research Direction

Researched operational pain points in:
- Real-time payments (FedNow, RTP) adoption
- ACH fraud and monitoring
- Payment reconciliation
- Cross-border wire transfers
- Core banking data silos

### Second Problem Set (Payments & Core Banking — Active)

5 real, research-backed problems identified for banks and credit unions:

1. **Real-time payments gap** — Most credit unions can receive FedNow/RTP but can't send. Members expect instant; they get 1–3 business days. ($480B through RTP in Q2 2025 alone.)

2. **Manual payment reconciliation** — 84% of payment firms still rely on spreadsheets. Month-end is a manual grind. Costs scale linearly with volume — no leverage.

3. **Cross-border wire transfers are opaque and expensive** — Fees can reach 6–10% of transfer value. Multi-day settlement. Zero visibility. Wise and Remitly are eating this relationship.

4. **ACH fraud monitoring gap** — 80% of organizations were fraud targets in 2023. Nacha now mandates monitoring, but most community banks lack the tooling. Manual review queues can't keep up.

5. **Core banking data silos** — Payments, lending, and deposits don't talk to each other. Ops teams toggle between 3–4 systems to resolve a single member issue. Compliance gaps, slow dispute resolution, eroded trust.

---

## Key Decisions Made

| Decision | Rationale |
|----------|-----------|
| Deleted initial `requirements.md` | It was built on a consumer-facing product idea before the problem was properly defined. Starting over with the right foundation. |
| Reframed user from "member" to "bank/credit union" | The assignment asks to solve a real problem for a real user. The real user here is the institution, not the end consumer. |
| Grounded research in Nymbus's actual customer base | Nymbus serves community banks and credit unions ($1B–$10B asset size). Solving for their pain points makes the submission directly relevant to the role. |
| Created this context file before writing any spec | The assignment explicitly evaluates AI collaboration. Capturing thought process from the start, not retrofitting it at the end. |
| Explicitly positioned RailWatch as a layer on top of a modern core, not a replacement | Nymbus sells core infrastructure. Building something that competes with their product would be a fundamental misread of the role. RailWatch is the intelligence and ops visibility layer that a modern core like Nymbus enables but doesn't itself provide. This positioning should appear in the README, the requirements Introduction, and the debrief. |

---

## Problem Selection — Decision Log

### Evaluated: Cross-Border Payments vs. Real-Time Payments

**Cross-Border — Rejected.** High drama, low frequency for a typical community CU. Wise/Remitly have commoditized the consumer side. Too hard to solve meaningfully in a 4–6 hour build.

**Real-Time Payments — Selected.** $853B processed through FedNow in 2025 (2,134% YoY increase). 45% of FIs still in evaluation. Most CUs are receive-only. This is a daily operational problem, not a niche one.

**Refined angle:** Not "build instant payments infrastructure" (too hard) — but a **Payments Modernization Readiness Tracker**. The real gap is that CU payments leaders have no structured, self-service way to assess where they stand, what's blocking them, and how urgent the window is.

### Scope Decision

Two-layer vision (Readiness Tracker + Live Ops Monitor) is too much for 4–6 hours. Scoped to:
- **Core product:** Instant Payments Readiness Tracker
- **Future state (README):** Live payment operations monitor

This demonstrates scope judgment — a key evaluation criterion.

### API Selection

| API | Role in product |
|-----|----------------|
| **Marketaux** | Live fintech/payments news feed — shows market momentum and urgency around instant payments adoption |
| **Frankfurter** | Real-time FX rates — market context panel showing how fast money is moving globally while the CU evaluates |

ExchangeRate-API and Alpha Vantage deprioritized — redundant or weak fit for this specific product.

### User Definition

- **Primary user:** VP of Payments / Director of Operations at a $1B–$10B community bank or credit union
- **Secondary user:** CFO/CEO/Board — consumers of the readiness score output, not the tool itself
- **Design principle:** Solve the operational problem for the VP; make the output shareable upward to leadership

### Locked Problem Statement

> Community banks and credit unions are losing members to neobanks and fintechs that offer what their members now expect as a baseline: instant payments.
>
> FedNow processed $853 billion in 2025 — a 2,134% increase year-over-year. The Clearing House's RTP network now reaches 70% of U.S. deposit accounts. Yet 45% of financial institutions are still in the evaluation phase, and most that have connected can only receive — not send. Meanwhile, 14% of members who switch financial institutions cite poor digital experience as the primary reason. Instant payments isn't a future capability anymore. It's a retention problem happening right now.
>
> The payments and operations leaders at $1B–$10B credit unions know they need to move. What they lack is clarity: Where exactly do we stand? What's blocking us? What will it actually take to get to send-capable? And how does our pace compare to what's happening in the market?
>
> There is no lightweight, self-service tool that gives a credit union's VP of Payments a structured readiness assessment across the dimensions that actually matter — core integration, fraud controls, liquidity management, reconciliation maturity, and rail connectivity — with a clear gap analysis, effort estimate, and live market context showing how fast the window is closing.

---

---

## Major Pivot — PayPath → RailWatch

### Why PayPath was cut

After generating the requirements for PayPath (Instant Payments Readiness Tracker), a critical product question surfaced: **this isn't a product — it's a sales tool.**

A readiness assessment has no recurring value. A user fills it out once, gets a score, and is done. There's no reason to come back tomorrow. A real product solves a daily problem.

- PayPath is a one-time assessment — a user completes it once and has no reason to return. It has no recurring utility.
- The readiness tracker produces a score but doesn't connect to daily operations. It tells a payments leader where they stand but gives them nothing to act on tomorrow morning.
- A sales tool helps Nymbus sell to prospects. A daily ops tool helps Nymbus retain customers by being embedded in their morning workflow. Retention value is higher than acquisition value.
- The pivot to RailWatch was driven by one question: "Would a VP of Payments open this every day?" PayPath: no. RailWatch: yes.

### The real daily problem

A credit union's payments operations team opens 3–4 different systems every morning to piece together what's happening across ACH, wire, and instant payment rails. There's no unified view. Exceptions pile up. Settlement positions are unclear. They're flying blind.

### RailWatch — Payment Operations Monitor

**Product:** A dashboard that a credit union's payments team opens every morning. Unified view of payment rail health across ACH, wire, and FedNow/RTP.

**What it shows:**
- Payment volume trends by rail (ACH, wire, RTP/FedNow)
- Failure and exception rates by rail and reason code
- Exception queue aging — open items, SLA status
- Settlement position — funded vs. at-risk
- Rail health status — network degradation signals
- Live market context — economic indicators, FX rates, industry news

**Demo mode:** Runs on realistic simulated data for a fictional $3B credit union. Transparent banner indicates demo mode. Standard practice for fintech demos.

**The readiness assessment** was cut entirely. It becomes a "future state" item in the README — demonstrating scope judgment.

### Final API Selection (3 APIs)

| API | Role | Auth |
|-----|------|------|
| **FRED** (Federal Reserve Economic Data) | Live Federal Funds Rate indicator — contextualizes intraday settlement cost and liquidity pressure for the ops manager. When rates are elevated, the cost of an uncovered settlement position is higher. This gives the single FRED indicator operational meaning at 8am, not just market decoration. | Free API key |
| **Frankfurter** | Live FX rates — global payment velocity context | None required |
| **Marketaux** | Live fintech/payments news with sentiment scoring | Free API key |

Using 3 APIs (assignment requires minimum 2) shows initiative without overcomplicating the build.

### Product Name

**RailWatch** — monitors the payment rails. Clear, direct, B2B appropriate.

### Spec Directory

`.kiro/specs/railwatch-payment-ops-monitor/`

---

## Requirements Iteration Log

### Round 1 — Initial Requirements Generated

First pass of `requirements.md` created covering 12 requirements: dashboard initialization, rail health overview, exception queue monitor, settlement position tracker, FRED/Frankfurter/Marketaux API integrations, market context panel, daily summary export, performance, simulation integrity, and accessibility.

### Round 2 — Five-Persona Review

Requirements were reviewed simultaneously by five AI personas: QA Engineer, Software Engineer, Payment Operations Manager, Solutions Architect, and Product Manager.

**Key findings that changed the spec:**

| Finding | Source | Action Taken |
|---------|--------|--------------|
| Req 11.8/11.9 math contradiction — independent sampling can't guarantee ratio range | QA + Engineer | Fixed with correlated sampling strategy |
| Marketaux free tier is 100 req/month — exhausted in ~50 days | Engineer | Added request counter + throttle in Req 7 |
| ACH Same Day SLA threshold wrong — lumped with ACH Standard at 48h/72h | Ops Manager | Split to 4h/8h matching instant rail urgency |
| Cut-off time countdowns completely absent | Ops Manager | Added as new Requirement 13 |
| Dollar exposure missing from exception queue — count without value is useless | Ops Manager | Added Dollar_Exposure to Req 3 |
| FRED/Frankfurter standalone panels are noise for daily ops | Ops Manager + PM | Scoped down: FRED → single Fed Rate indicator; Frankfurter → inline Wire_International conversion only |
| Exception queue is read-only — no drill-down | PM | Added Exception Detail Drill-Down requirement |
| No transaction data model defined | Architect | Added Transaction to Glossary with full schema |
| LocalStorage synchronous writes conflict with 50ms main thread budget | Architect | Acknowledged as known constraint |
| `limit=2` on FRED API returns oldest observations, not newest | Skeptic | Fixed to `limit=2&sort_order=desc` |
| "Same time prior day" comparison requires intraday snapshots never defined | Skeptic | Simplified to prior-day closing count |
| Two sequential 500ms budgets can't both be satisfied | Skeptic | Split: 300ms generation + 500ms total to render |
| Req 9.3 referenced USD/EUR and USD/GBP with no guaranteed fetch source | Skeptic | Removed hardcoded FX pairs from Daily Summary |
| Req 11.10 "48+ hours" breach threshold wrong for all rails | Skeptic | Fixed to per-rail breach thresholds with explicit injection |

### Round 3 — UX Designer Review

UX review identified structural and interaction gaps:

**Changes applied:**
- Added **Status Bar** (Req 2) — persistent top-of-page signal showing SLA breach count, coverage ratio, degraded rail count, next cut-off
- Added **global alert severity hierarchy** — CRITICAL → WARNING → INFO, applied consistently across all alert types
- Added **First-Run Experience** (Req 3) — lightweight overlay on first load explaining the five panels
- Added **Exception Detail Drill-Down** (Req 4) — expandable inline transaction list per exception group
- Added **Standard Error State Pattern** (Req 11) — single consistent component for all API failures
- Fixed **exception queue default sort** — changed from Dollar_Exposure to SLA urgency ascending
- Added **manual refresh button** and "Last generated" timestamp to simulated data
- Specified **ACH Same Day window strip** — all three windows displayed simultaneously
- Added **Demo Mode banner height constraint** — max 48px, must not push content below fold

### Round 4 — Happy/Unhappy Path Gap Analysis

Added **Requirement 18: Edge Cases and Boundary Conditions** covering:
- Happy path: all systems normal state
- Simulation failures: JS exception handling, consistency invariant violation
- All APIs down: with and without cached data
- Partial API availability: FRED down only, Marketaux down with degraded rail
- LocalStorage: full/unavailable, schema version mismatch
- Cut-off time edge cases: exactly at cut-off, DST transition
- Exception queue: zero-volume rail, unsupported destination currency
- Settlement: exact boundary values at 100.00% and 110.00%
- Daily Summary: confirmation timer behavior, duplicate click handling

### Round 5 — CRO Review

A Chief Revenue Officer persona reviewed the requirements with a focus on whether the product could be positioned as a Nymbus revenue driver, not just a demo artifact.

**Key findings that changed the spec:**

| Finding | Source | Action Taken |
|---------|--------|--------------|
| No mention of how RailWatch connects to Nymbus's sales motion | CRO | Added explicit DataProvider positioning language to Req 1.12 and the Introduction — "replacing the Simulator with a Nymbus Connect API client requires no changes to any consuming component" makes the upsell path concrete |
| Daily Summary export has no branding or attribution | CRO | Confirmed the mandatory disclaimer (Req 13.5) serves dual purpose: compliance signal and implicit Nymbus attribution in any screenshot shared upward |
| "Demo Mode" framing undersells the product | CRO | Kept Demo_Mode label (required for compliance) but ensured the README and Introduction frame RailWatch as production-ready architecture, not a prototype |
| No multi-institution angle documented | CRO | Added multi-institution support as Phase 2 item #3 — positions RailWatch as a platform play for Nymbus's client services team |

### Round 6 — Sales Engineer Review

A Sales Engineer persona reviewed the requirements with a focus on whether a Nymbus SE could demo this product to a prospect in a 30-minute discovery call.

**Key findings that changed the spec:**

| Finding | Source | Action Taken |
|---------|--------|--------------|
| No "wow moment" in the first 10 seconds | Sales Engineer | Confirmed Status Bar (Req 2) as the immediate hook — SLA breach count and coverage ratio are visible before any scrolling |
| Exception drill-down is the most compelling live demo feature | Sales Engineer | Ensured Req 4 drill-down includes Dollar_Exposure, SLA status, and reason code namespace — the three things a prospect's ops manager would immediately recognize as their daily pain |
| SIMULATED DATA labels could undermine credibility in a demo | Sales Engineer | Confirmed labels are required (Req 7.11, Req 2.8) but scoped to specific signals — the overall dashboard reads as real ops data, not a toy |
| No clear "this is what it looks like connected to your core" narrative | Sales Engineer | Added explicit Nymbus Connect positioning to Req 1.12 and README — the DataProvider interface makes the live integration story concrete and credible |

### Final Requirements Structure

18 requirements across 6 review rounds, sequentially numbered:

| # | Requirement | Key Additions vs. Initial |
|---|-------------|--------------------------|
| 1 | Dashboard Initialization & Demo Mode | Manual refresh, last-generated timestamp |
| 2 | Dashboard Status Bar | NEW — global alert hierarchy, 48px constraint |
| 3 | First-Run Experience | NEW — LocalStorage dismissal, demo explanation |
| 4 | Exception Detail Drill-Down | NEW — inline transaction list, drill-down invariant |
| 5 | Payment Rail Health Overview | Boundary conditions on failure rate thresholds |
| 6 | Exception Queue Monitor | Dollar_Exposure, SLA urgency sort, ACH Same Day split |
| 7 | Settlement Position Tracker | Boundary conditions at 100% and 110% |
| 8 | Economic Context Indicator (FRED) | Scoped to single Fed Rate indicator, sort_order=desc fix |
| 9 | Wire International FX Conversion (Frankfurter) | On-demand only, no standalone panel |
| 10 | Marketaux News Integration | Rate limit counter, sentiment thresholds defined |
| 11 | Standard Error State Pattern | NEW — consistent error component spec |
| 12 | Market Context Panel Aggregate Behavior | Updated for scoped-down API roles |
| 13 | Daily Summary Export | FX rates conditional on session cache |
| 14 | Performance & Responsiveness | HTTPS requirement, Page_Load_Start defined |
| 15 | Data Simulation Integrity | Correlated sampling, 7-day history, explicit breach injection |
| 16 | Accessibility & Usability | Unchanged |
| 17 | Payment Cut-Off Time Monitor | NEW — ACH Same Day window strip, DST handling |
| 18 | Edge Cases & Boundary Conditions | NEW — 18 happy/unhappy path scenarios |

---

## Session 2 — API Setup and CORS Resolution (April 25, 2026)

See: Infrastructure Setup, CORS Proxy Implementation, and Bug 7 in the Bug Log below.

---

## Session 3 — Implementation (Tasks 1–28)

See: Implementation Task Log below.

---

## Session 4 — Tasks 29–33 and Final Verification (April 26, 2026)

See: Session 4 entry in the Implementation Task Log below.

---

## Session 5 — Nymbus UX Alignment (Post-Implementation)

### Context

After all 35 implementation tasks were complete and committed, a visual design pass was performed to align RailWatch's UI with Nymbus's brand colors and UX patterns. The goal: make the dashboard feel like a native Nymbus product rather than a generic Tailwind app.

### Research

Nymbus's public-facing site (nymbus.com), product screenshots, and Dribbble portfolio were reviewed to extract their design language:
- Deep navy/near-black backgrounds (`#0A0F1E`) for chrome elements
- Teal/cyan accent color (`#00C2B2`) for CTAs, active states, and brand anchors
- Clean white card surfaces on a light mist background (`#F0F4F8`)
- Uppercase tracking-widest labels for section headers
- Pill-style status badges with ring outlines instead of solid fills
- Left-border or top-bar accent strips for status-coded cards (avoids Tailwind border color conflicts)
- Subdued informational banners instead of loud alert colors

### Key Technical Issue Encountered

The project uses **Tailwind v4** (`tailwindcss@^4.2.4`), which does not read custom color tokens from `tailwind.config.ts`. In v4, custom tokens must be declared as CSS variables inside an `@theme {}` block in the CSS entry file. The initial implementation added colors to `tailwind.config.ts` (v3 pattern), which caused all `nymbus-*` utility classes to silently produce no output. Fixed by moving all token definitions to `src/index.css` under `@theme`.

A secondary issue: Tailwind v4 requires kebab-case CSS variable names. `nymbus-tealDim` was renamed to `nymbus-teal-dim` and all references updated.

A third issue: combining `border border-gray-200` with `border-l-4 border-emerald-500` on the same element causes Tailwind to apply only one border color (the last one wins). Fixed by switching all status-coded cards and rows to use a **top accent bar** (`<div className="h-1 w-full bg-emerald-500" />`) as a separate child element inside an `overflow-hidden` wrapper — this avoids the border color conflict entirely.

### Changes Made

| File | Change |
|------|--------|
| `src/index.css` | Added `@theme` block with 6 Nymbus color tokens |
| `tailwind.config.ts` | Removed redundant v3-style color extensions |
| `src/App.tsx` | Added branded product header strip; `bg-nymbus-mist` page background |
| `src/components/DemoModeBanner.tsx` | Replaced loud yellow banner with subtle dark navy strip + teal text |
| `src/components/StatusBar.tsx` | Navy background, teal left-border accent, teal Refresh button |
| `src/components/RailHealthOverview.tsx` | Teal uppercase tracking section header |
| `src/components/RailHealthCard.tsx` | Top accent bar for status color; `rounded-xl shadow-md`; pill badges; `tabular-nums` on financials |
| `src/components/ExceptionQueueMonitor.tsx` | Teal section header; left-border alert banners; `rounded-xl shadow-md` cards |
| `src/components/ExceptionGroupRow.tsx` | Top accent bar for SLA status color; pill badges; `hover:bg-nymbus-mist` |
| `src/components/SettlementPositionTracker.tsx` | Teal section header; `rounded-xl shadow-md`; `bg-nymbus-mist` metric tiles; left-border alerts; per-rail accent bars |
| `src/components/CutOffTimeMonitor.tsx` | Teal section header; `rounded-xl shadow-md`; updated countdown badge colors |
| `src/components/MarketContextPanel.tsx` | Teal section header and sub-labels; teal currency pills |
| `src/components/DailySummaryExport.tsx` | Teal section header; teal Copy Summary button |

---

## Phase 2 — What Would Be Built Next

If RailWatch were a real product moving toward production, the following capabilities would be prioritized in order:

1. **Live core connection** — Replace the Simulator with a read-only connection to a Nymbus Connect API endpoint. The Transaction schema is already structured to mirror Nymbus Connect conventions, making this a data source swap rather than a rebuild.
2. **Alerting and push notifications** — The dashboard currently requires the ops manager to open it to see problems. Phase 2 adds proactive alerts: email or SMS when an exception breaches SLA, when Funding_Coverage_Ratio drops below a threshold, or when a rail status changes to Critical.
3. **Multi-institution support** — Nymbus serves hundreds of community banks. A multi-tenant version of RailWatch would let a Nymbus client services team monitor payment health across their entire customer portfolio — turning a single-institution tool into a platform.
4. **Historical trend analysis** — 7-day rolling averages are currently simulated. A real version would store and surface 30/60/90-day trend data, letting ops managers identify seasonal patterns and benchmark against prior periods.
5. **Anomaly detection** — Volume drops, failure rate spikes, and settlement shortfalls currently trigger static threshold alerts. Phase 2 replaces static thresholds with ML-based anomaly detection that learns each institution's normal operating range.

---

## Infrastructure Setup

### Git Repository
- Initialized locally with initial commit
- `.gitignore` added to exclude `.kiro/settings/` (contains API keys)
- Pushed to GitHub: https://github.com/ttague222/RailWatch-Payment-Operations-Monitor

### GitHub MCP
- Configured at `.kiro/settings/mcp.json` (excluded from git)
- Connection verified

### Data Strategy
- All payment data: simulated client-side using NACHA/ISO 20022 conventions
- Simulation calibrated to Federal Reserve published payment volume statistics
- Seed data structured to mirror what a Nymbus Connect API response would return
- README will document: "schema mirrors Nymbus Connect conventions — straightforward to connect to live core when ready"

---

## Design Phase Log

### design.md — Completed

The design document was built section by section with explicit approval gates between sections. All 8 sections are complete.

| Section | Content |
|---------|---------|
| 1. Component Architecture | Full React component tree, DataProvider interface, SimulatorDataProvider implementation, useDataProvider hook, data flow boundary diagram |
| 2. Data Models | TypeScript interfaces for all Glossary types: Transaction (ISO 20022), ExceptionGroup, RailData, SettlementPosition, CutOffTime, HistoricalVolumeEntry. SimulatorSeedConfig + DEFAULT_SEED_CONFIG. FEDERAL_HOLIDAYS constant (2025–2026, OPM sourced). Reason code reference table. |
| 3. API Integration Patterns | FRED endpoint + response mapping + 24h/4h cache strategy. Frankfurter on-demand per-currency session cache. Marketaux monthly counter key pattern + conditional rail surfacing. Error message matrix (3 APIs × 3 error types = 9 messages). |
| 4. State Management | React state inventory (17 state variables). Complete LocalStorage key inventory. Schema version + migration strategy. First-run overlay trigger logic. UserPreferences interface. Marketaux counter flow. React state vs LocalStorage boundary table. |
| 5. Simulation Engine | SimulatorOutput interface. isBusinessDay() using FEDERAL_HOLIDAYS. Correlated settlement sampling (ratio-first, no rejection sampling). Deterministic 7-day history via mulberry32 seeded PRNG. Exception aging distribution with guaranteed bucket coverage. Per-rail SLA breach injection (additive, rail-specific thresholds). Non-business-day handling. Top-level generate() orchestration. |
| 6. Cut-Off Time Logic | CUTOFF_SCHEDULE constant. secondsUntilCutOff() via Intl.DateTimeFormat (no manual UTC offsets). DST handling documented. ACH Same Day 3-window state machine. CutOffContext for StatusBar decoupling. Non-business-day display. |
| 7. Performance Strategy | 300ms simulation budget via useState lazy initializer. 500ms render budget via useEffect-deferred API fetches. 50ms tick budget analysis + DevTools verification steps. React.memo list for timer isolation. Recharts animation disabled. Memory footprint estimate (~15–20MB, well within 50MB). |
| 8. Error State Architecture | ErrorStateProps interface. MESSAGE_MAP (9 messages). Stale data display pattern. Loading skeleton dimensions for all 3 API sections. ApiErrorBoundary class component with per-source isolation. |

### Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Synchronous simulation in useState lazy initializer | Avoids loading states for simulated data; completes in 5–15ms; safe because it's pure in-memory computation |
| Frankfurter cache in session memory (Map), not LocalStorage | FX rates are transient; clearing on reload is correct behavior; avoids stale rate risk |
| Marketaux monthly counter key includes YYYY_MM | Automatic monthly reset with no explicit reset logic — new key = new counter |
| CutOffContext created before CutOffTimeMonitor and StatusBar | Prevents circular dependency; both components consume the same context |
| Seeded PRNG (mulberry32) for 7-day history | Math.random() is not seedable; deterministic history requires explicit seeding by date string |
| FxConversionInline state scope resolved at ExceptionDrillDown level | fxLastFetch and retryFx live in ExceptionDrillDown, passed as props to FxConversionInline and ApiErrorBoundary |

---

## Current Status

| Artifact | Status |
|----------|--------|
| `requirements.md` | ✅ Complete — 18 requirements, 6 review rounds (Round 2: QA, Engineer, Ops Manager, Architect, PM, Skeptic; Round 3: UX Designer; Round 4: Happy/Unhappy Path; Round 5: CRO; Round 6: Sales Engineer) |
| `design.md` | ✅ Complete — 8 sections, approved |
| `tasks.md` | ✅ Complete — all 35 tasks complete (33 + tasks 1a and 25a) |
| Application code | ✅ Complete — all tasks 1–33 implemented and verified |
| Nymbus UX alignment | ✅ Complete — full visual redesign applied post-implementation (see Session 5 below) |
| `README.md` | ✅ Complete — at repo root, renders on GitHub homepage |
| GitHub repo | ✅ Live at github.com/ttague222/RailWatch-Payment-Operations-Monitor |

---

## Implementation Task Log

### Completed Tasks

| Task | Description | Key Files |
|------|-------------|-----------|
| 1 | Project scaffolding — Vite + React + TypeScript, Tailwind, Recharts | `railwatch/` root, `vite.config.ts`, `tailwind.config.ts`, `postcss.config.js`, `index.css` |
| 1a | Vitest test runner configured | `vite.config.ts` (test block), `src/test/setup.ts`, `src/test/smoke.test.ts` |
| 2 | Core TypeScript type definitions | `src/types/index.ts` |
| 3 | FEDERAL_HOLIDAYS + isBusinessDay() | `src/simulator/holidays.ts` |
| 4 | SimulatorSeedConfig + DEFAULT_SEED_CONFIG | `src/simulator/config.ts` |
| 5 | [RISK] Seeded PRNG — mulberry32 | `src/simulator/prng.ts` |
| 6 | Simulation engine — generate() | `src/simulator/engine.ts` |
| 7 | SimulatorDataProvider | `src/providers/SimulatorDataProvider.ts` |
| 8 | DataProviderContext + useDataProvider hook | `src/context/DataProviderContext.tsx` |
| 9 | [RISK] CutOffContext — provider + consumer hooks | `src/context/CutOffContext.tsx` |
| 10 | CUTOFF_SCHEDULE + secondsUntilCutOff() + getNextBusinessDay() | `src/utils/cutoff.ts` |
| 11 | App shell — DemoModeBanner, layout, refresh logic | `src/App.tsx`, `src/components/DemoModeBanner.tsx` |
| 12 | Schema versioning — migrateIfNeeded() | `src/utils/schema.ts`, `src/main.tsx` |
| 13 | FirstRunOverlay component | `src/components/FirstRunOverlay.tsx` |
| 14 | UserPreferences read/write utilities | `src/utils/preferences.ts` |
| 15 | RailHealthOverview + RailHealthCard | `src/components/RailHealthOverview.tsx`, `src/components/RailHealthCard.tsx` |
| 16 | ExceptionQueueMonitor + ExceptionGroupRow | `src/components/ExceptionQueueMonitor.tsx`, `src/components/ExceptionGroupRow.tsx` |
| 17 | [RISK] FxConversionInline state scope resolved | `src/components/ExceptionDrillDown.tsx` (scaffolded) |
| 18 | ExceptionDrillDown component | `src/components/ExceptionDrillDown.tsx` |
| 19 | SettlementPositionTracker + SettlementTimeline | `src/components/SettlementPositionTracker.tsx`, `src/components/SettlementTimeline.tsx` |
| 20 | CutOffTimeMonitor + AchSameDayWindowStrip | `src/components/CutOffTimeMonitor.tsx`, `src/components/AchSameDayWindowStrip.tsx` |
| 21 | ErrorState + ApiErrorBoundary | `src/components/ErrorState.tsx`, `src/components/ApiErrorBoundary.tsx` |
| 22 | Loading skeleton components | `src/components/skeletons/FredSkeleton.tsx`, `FxSkeleton.tsx`, `NewsSkeleton.tsx` |
| 23 | FredIndicator — FRED API fetch, 4h/24h cache, stale indicator, error handling | `src/api/fred.ts`, `src/components/FredIndicator.tsx` |
| 24 | FxConversionInline — Frankfurter on-demand fetch, session cache, unsupported currency fallback | `src/api/frankfurter.ts`, `src/components/FxConversionInline.tsx` |

### Completed Tasks (continued)

| Task | Description | Key Files |
|------|-------------|-----------|
| 25a | [RISK] MarketauxContext — provider + consumer hooks | `src/context/MarketauxContext.tsx` |
| 25 | MarketauxNewsFeed — fetch, monthly counter, sentiment labels, rail surfacing via context | `src/api/marketaux.ts`, `src/components/MarketauxNewsFeed.tsx` |
| 26 | MarketContextPanel — composes FredIndicator + FxConversionInline + MarketauxNewsFeed with ApiErrorBoundary isolation | `src/components/MarketContextPanel.tsx` |
| 27 | DailySummaryExport — plain-text clipboard export with modal fallback, 3s confirmation, deduplication | `src/components/DailySummaryExport.tsx` |
| 28 | StatusBar — all four signals wired via CutOffContext, refresh button with loading indicator | `src/components/StatusBar.tsx`, `src/App.tsx` |

### Completed Tasks (continued)

| Task | Description | Key Files |
|------|-------------|-----------|
| 29 | Checkpoint — full component wiring in App.tsx, all context providers verified | `src/App.tsx` |
| 30 | Performance pass — React.memo audit, Recharts `isAnimationActive={false}` confirmed | All component files |
| 31 | Accessibility pass — keyboard nav, color+label indicators, monetary/percentage formatting | All component files |
| 32 | Edge case verification — all 18 Req 18 scenarios | `src/test/edge-cases.test.ts` |

### Remaining Tasks

None — all 35 tasks complete.

### Bug Log

Bugs discovered and fixed during implementation, in chronological order.

---

**Bug 1 — Tailwind PostCSS plugin name wrong (commit `494d409`)**

- **Symptom:** Tailwind styles not applying; PostCSS threw a plugin resolution error on dev server start.
- **Root cause:** Vite's `npm create` scaffold generated `postcss.config.js` with `tailwindcss: {}` as the plugin key. Tailwind v4 changed the PostCSS plugin to a separate package (`@tailwindcss/postcss`) with a different key.
- **Fix:** Changed `postcss.config.js` plugin key from `tailwindcss: {}` to `'@tailwindcss/postcss': {}`.
- **Files changed:** `railwatch/postcss.config.js`

---

**Bug 2 — TypeScript JSX transform missing + `@types/react` not installed (commit `494d409`)**

- **Symptom:** TypeScript compiler errors on all `.tsx` files — JSX not recognized, React types missing.
- **Root cause:** The scaffold's `tsconfig.json` was missing `"jsx": "react-jsx"` and `@types/react` was not in `devDependencies`. Also, `noUnusedLocals` and `noUnusedParameters` were `true`, causing spurious errors during incremental development.
- **Fix:** Added `"jsx": "react-jsx"` to `tsconfig.json` compiler options. Installed `@types/react`. Set `noUnusedLocals` and `noUnusedParameters` to `false` to avoid noise during active development.
- **Files changed:** `railwatch/tsconfig.json`, `railwatch/package.json`

---

**Bug 3 — Tailwind v4 CSS import syntax wrong (commit `412393c`)**

- **Symptom:** Tailwind utility classes not generating; no styles in output.
- **Root cause:** Tailwind v4 replaced the three-directive pattern (`@tailwind base; @tailwind components; @tailwind utilities`) with a single `@import "tailwindcss"` statement. The scaffold generated the old v3 syntax.
- **Fix:** Replaced the three `@tailwind` directives in `index.css` with `@import "tailwindcss"`.
- **Files changed:** `railwatch/src/index.css`

---

**Bug 4 — Req 5.9 invariant violated in non-business-day simulator output (commit `2f09233`)**

- **Symptom:** `successCount + failureCount !== todayVolume` for rails on non-business days, breaking the completeness invariant.
- **Root cause:** In `generateNonBusinessDayData()`, `todayVolume` and `successCount` were each independently sampled via separate `Math.random()` calls. Since they were drawn independently, they could diverge — e.g. `todayVolume = 120`, `successCount = 95`, `failureCount = 0` → sum is 95, not 120.
- **Fix:** Derived `successCount = todayVolume - failureCount` instead of sampling it independently. On non-business days `failureCount` is 0, so `successCount = todayVolume` exactly.
- **Files changed:** `railwatch/src/simulator/engine.ts`

---

**Bug 5 — Zero volumes and empty exception queue on weekends (discovered during task 24 verification)**

- **Symptom:** Dashboard showed all rail volumes as 0 and "All clear — no open exceptions" when opened on a Saturday. Looked broken but was actually correct behavior per Req 1.4 (non-business-day state).
- **Root cause:** Not a bug — the simulator correctly detects weekends and returns reduced/zero volumes. The issue was that this made it impossible to visually verify FRED and Frankfurter integrations during weekend development sessions.
- **Fix:** Added a `forceBusinessDay` dev override in `engine.ts` gated on `import.meta.env.DEV`. This forces full business-day data generation during local development regardless of the calendar day. Must be removed before production deployment.
- **Files changed:** `railwatch/src/simulator/engine.ts`

---

**Bug 6 — Completed components (tasks 20–23) not wired into App.tsx (discovered during task 24 verification)**

- **Symptom:** `SettlementPositionTracker`, `CutOffTimeMonitor`, and `FredIndicator` were all fully implemented but not imported or rendered in `App.tsx`. The dashboard showed only Rail Health Overview and Exception Queue — all other sections were empty `<section>` placeholders.
- **Root cause:** `App.tsx` was scaffolded in task 11 with placeholder `<section>` elements for components not yet built. As tasks 19–23 completed those components, `App.tsx` was never updated to import and render them.
- **Fix:** Updated `App.tsx` to import and render `SettlementPositionTracker`, `CutOffTimeMonitor`, and `FredIndicator`. Added a temporary inline Market Context section wrapping `FredIndicator` until `MarketContextPanel` is built in task 26. Added a visible refresh button and last-generated timestamp to the status bar placeholder.
- **Files changed:** `railwatch/src/App.tsx`

---

### Implementation Notes

- All three flagged risk tasks (5, 9, 17) are complete — downstream dependencies are unblocked
- `SettlementPositionTracker` uses `React.memo` and correctly handles the 100.00% = CRITICAL / 110.00% = Adequate boundary conditions (Req 18.15, 18.16)
- `SettlementTimeline` uses Recharts `ComposedChart` (Bar + Area) with `isAnimationActive={false}` on all series and a `ReferenceLine` at the current hour
- `CutOffTimeMonitor` owns the single `setInterval` at 1000ms and writes to `CutOffContext` on each tick — `StatusBar` will read from context without owning a timer
- `FredIndicator` uses a `useRef` guard (`fetchingRef`) to prevent duplicate in-flight fetches when background stale re-fetch and manual retry overlap
- `FxConversionInline` uses `fxLastFetch` prop (a `Date.now()` timestamp bumped by the retry handler in `ExceptionDrillDown`) as a `useEffect` dependency to trigger re-fetch on retry without needing an imperative ref
- `fxSessionCache` is a module-level `Map` — it persists for the browser session and is cleared on page reload, which is the correct behavior for FX rates (no stale rate risk across sessions)
- No component below `App` imports from `src/simulator/` — DataProvider boundary is intact
- All monetary values use `$X,XXX,XXX.XX` format; all percentages use `XX.XX%` format throughout
- **Dev-mode override intentionally retained:** `engine.ts` forces business-day data unconditionally (`forceBusinessDay = true`). This is a deliberate demo choice — without it, the dashboard shows zero volumes on weekends and holidays, which looks broken to an evaluator. In a production integration, this flag would be removed as the DataProvider would supply real data regardless of calendar day.

---

### Session 4 — Tasks 29–32 (April 26, 2026)

- Tasks 29–31 (wiring checkpoint, performance pass, accessibility pass) were completed in a prior session
- Task 32 (edge case verification — all 18 Req 18 scenarios) required fixing a pre-existing `edge-cases.test.ts` that had 7 failing tests before any new work was done

**Root causes fixed in Task 32:**

| Failure | Root Cause | Fix |
|---------|-----------|-----|
| Missing `@testing-library/user-event` | Package not installed | `npm install --save-dev @testing-library/user-event` |
| Stale FRED cache test | Test wrote `{ data: {...}, fetchedAt: ... }` but `readFredCache()` stores raw `FredIndicatorData` directly (with `fetchedAt` inside it) | Corrected cache shape in test to match actual `fred.ts` format |
| `isStorageFull()` always false | `vi.spyOn(localStorage, 'setItem')` doesn't intercept bare `localStorage.setItem` calls inside modules in jsdom | Replaced with `vi.stubGlobal('localStorage', throwingStorage)` to swap the entire global |
| Req 18.14 FX unsupported currency | `vi.mock` inside a `describe` block is hoisted to file scope, so the mock applied globally and `fetchFxRate` was throwing instead of returning `null` | Moved `vi.mock('../api/frankfurter', ...)` to module scope; used `vi.mocked(fetchFxRate).mockResolvedValue(null)` in `beforeEach` |
| Req 18.15/18.16 multiple element matches | `getByText(/CRITICAL/)` and `getByText(/WARNING/)` matched both the alert banner and the inline ratio label | Switched to `getByRole('alert')` + `toHaveTextContent()` for banner assertions; `getAllByText()` where multiple matches are expected |
| Req 18.17/18.18 clipboard tests timing out | `userEvent.click` with `vi.useFakeTimers()` deadlocks — userEvent's internal async delays never resolve under fake timers | Replaced `userEvent.click` with `button.click()` + `act(async () => { await Promise.resolve(); })` to flush the clipboard microtask |

- **65/65 tests passing** after all fixes
- `vi.mock` for `../api/frankfurter` is now correctly declared at module scope — this is the only module-level mock in the test file; all other tests use `vi.spyOn` or `vi.stubGlobal` scoped to individual tests

---

- `MarketauxContext` follows the same provider/consumer hook pattern as `CutOffContext` — `useMarketauxArticles()` for reading, `useSetMarketauxArticles()` for writing
- `MarketauxNewsFeed` writes fetched articles to `MarketauxContext` so `RailHealthCard` can surface relevant headlines for Degraded/Critical rails without prop drilling
- `MarketContextPanel` wraps each of the three API sub-components (`FredIndicator`, `FxConversionInline`, `MarketauxNewsFeed`) in an `ApiErrorBoundary` — failure in one section does not affect the others
- `DailySummaryExport` reads from three sources: `useDataProvider()` for live sim data, `readFredCache()` / `readMarketauxCache()` from LocalStorage for API data, and `fxSessionCache` (module-level Map) for FX rates fetched this session
- The export's FX section is omitted entirely (no error shown) when no FX rates have been fetched this session — correct per Req 13.4
- `DailySummaryExport` uses a `timerRef` to track the 3-second confirmation timeout — a second click while the timer is running clears and resets it rather than duplicating the message (Req 18.18)
- `StatusBar` is `React.memo`-wrapped and reads from `CutOffContext` (updated by `CutOffTimeMonitor`'s 1-second interval) — the timer tick does not cause `StatusBar` to re-render unless the cut-off summary actually changes
- All four StatusBar signals use both color and text labels — no color-only indicators (Req 16.1)
- The "All Systems Normal" state requires: 0 SLA breaches + coverage ratio ≥ 110% + all rails Healthy + no cut-off within 2 hours. In normal simulator output this state will not appear because `injectBreachExceptions()` guarantees at least one breach per rail (6 total). This is correct behavior — the indicator is reserved for genuinely clean operational states.
- 35/35 tests passing after all task 25–28 changes

---

**Bug 7 — API Keys Hardcoded + CORS Policy Blocking Browser Requests (Session 2 — April 25, 2026)**

- **Symptom:** FRED and Marketaux API integrations showed persistent error states: "Unable to reach the Federal Reserve data service" even after refreshing. Browser console showed CORS policy errors blocking requests to external APIs.
- **Root cause:** Two issues:
  1. API keys were hardcoded in `fred.ts` and `marketaux.ts` instead of reading from environment variables
  2. FRED and Marketaux APIs do not send CORS headers allowing direct browser requests — they expect server-side calls
- **Fix:**
  1. Created `.env.example` template and `.env.local` for local environment variables
  2. Updated API files to read from `import.meta.env.VITE_FRED_API_KEY` and `VITE_MARKETAUX_API_TOKEN`
  3. Added `.gitignore` pattern `*.local` to exclude `.env.local` from version control
  4. Implemented CORS proxy (corsproxy.io) with `USE_CORS_PROXY` flag and extensive production implementation notes
- **Production notes added:** Inline comments in both `fred.ts` and `marketaux.ts` explain:
  - CORS proxy is DEMO MODE ONLY
  - Production implementation would use backend server proxy
  - Backend would handle caching, rate limiting, and secure API key storage
  - `USE_CORS_PROXY` flag can be toggled to `false` when backend is available
- **Files changed:**
  - `railwatch/.env.example` (created)
  - `railwatch/.env.local` (created, git-ignored)
  - `railwatch/src/api/fred.ts` (env vars + CORS proxy)
  - `railwatch/src/api/marketaux.ts` (env vars + CORS proxy)
- **Result:** Both FRED and Marketaux API integrations now working in browser with real API keys

---

**Bug 8 — Funding Coverage Ratio inconsistency between StatusBar, SettlementPositionTracker, and DailySummaryExport (discovered during task 28 verification)**

- **Symptom:** The coverage ratio displayed in `StatusBar` could differ from the ratio shown in `SettlementPositionTracker` and included in the `DailySummaryExport` by a small rounding artifact, violating Req 13.8 (export ratio must match displayed ratio).
- **Root cause:** The simulator engine computes `fundingCoverageRatio = Math.round(ratio * 10000) / 100` from the unrounded floating-point `ratio`, then separately rounds `settlementBalance` and `projectedDailyObligation` to integers. `SettlementPositionTracker` and `DailySummaryExport` both recompute the ratio from the rounded integers using `Math.round((balance / obligation) * 100 * 100) / 100`, which can produce a slightly different value than the engine's pre-computed field. `StatusBar` was reading the engine's pre-computed `fundingCoverageRatio` directly, so it could show a different value than the other two components.
- **Fix:** Updated `StatusBar` to recompute the ratio from `settlementBalance` and `projectedDailyObligation` using the same formula as `SettlementPositionTracker` and `DailySummaryExport`. All three components now use identical logic: `Math.round((balance / obligation) * 10000) / 100`.
- **Files changed:** `railwatch/src/components/StatusBar.tsx`

---

### Setup (Completed — Session 2)

**Files:**
- `.env.example` — Template with instructions for obtaining API keys (committed to git)
- `.env.local` — Local environment file with actual keys (git-ignored via `*.local` pattern)

**Environment Variables:**
```bash
VITE_FRED_API_KEY=<your_fred_api_key>
VITE_MARKETAUX_API_TOKEN=<your_marketaux_token>
```

**API Key Sources:**
- FRED: https://fred.stlouisfed.org/docs/api/api_key.html (free, instant approval, 120 req/day)
- Marketaux: https://app.marketaux.com/register (free tier 100 req/month)
- Frankfurter: No key required (fully open API)

**Usage:**
- Vite automatically loads `.env.local` at startup
- Variables prefixed with `VITE_` are exposed to client code via `import.meta.env`
- Dev server must be restarted after changing `.env.local` for changes to take effect

---

## CORS Proxy Implementation (Demo Mode)

### Context

FRED and Marketaux APIs do not allow direct browser requests due to CORS (Cross-Origin Resource Sharing) policy. In production, these APIs would be called from a backend server. For demo purposes, we use a CORS proxy.

### Implementation

**CORS Proxy:** https://corsproxy.io (free, no registration required)

**Pattern used in both `fred.ts` and `marketaux.ts`:**

```typescript
const USE_CORS_PROXY = true; // Toggle for backend integration

const BASE_ENDPOINT = 'https://api.example.com/endpoint?params...';

const FINAL_ENDPOINT = USE_CORS_PROXY
  ? `https://corsproxy.io/?${encodeURIComponent(BASE_ENDPOINT)}`
  : BASE_ENDPOINT;
```

### Production Implementation Notes (Documented in Code)

Both API files contain extensive inline comments explaining the production architecture:

**Backend Server Approach:**
1. React frontend sends request to backend API route
2. Backend makes API call server-side (no CORS restrictions)
3. Backend caches response in database (Redis/PostgreSQL) with TTL
4. Backend returns formatted data to frontend

**Benefits:**
- No CORS issues
- API keys remain server-side (better security)
- Persistent caching across user sessions
- Better rate limit management
- Request counter persists in database (not just LocalStorage)

**Migration Path:**
Set `USE_CORS_PROXY = false` and point `BASE_ENDPOINT` to backend proxy route (e.g., `/api/fred`, `/api/marketaux`)

---

## Open Questions for Design Phase

These are known open questions being deliberately deferred to design.md. Capturing them here ensures they are not lost.

1. **Correlated simulation sampling** — Req 15 requires that Settlement_Position and Projected_Daily_Obligation produce a Funding_Coverage_Ratio in the 85–140% range. How does the Simulator generate these two values as correlated rather than independent random draws? Design doc must specify the sampling strategy.
2. **DST handling for cut-off times** — Req 17 requires cut-off time countdowns that handle Daylight Saving Time transitions correctly. Design doc must define whether cut-off times are stored in UTC or local time and how the countdown logic handles the 23-hour and 25-hour days at DST boundaries.
3. **Marketaux rate limit persistence** — Req 10 adds a request counter to avoid exhausting the 100 req/month free tier. Design doc must specify where this counter is stored (likely LocalStorage), how it resets at month boundaries, and what happens when the counter reaches the limit mid-session.
4. **Exception drill-down transaction generation** — Req 4 adds an inline transaction list per exception group. Design doc must define how many transactions are generated per exception group, what fields each transaction displays, and whether transactions are generated at load time or on demand when the user expands a group.
5. **Daily Summary clipboard fallback** — Req 13 specifies a modal fallback when the Clipboard API is unavailable. Design doc must define the modal's behavior — specifically whether the text area is pre-selected for one-click copy and how the modal is dismissed.

---

*This file will be updated continuously as decisions are made and the product evolves.*
