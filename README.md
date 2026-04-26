# RailWatch — Payment Operations Monitor

A real-time payment operations dashboard for community banks and credit unions. Built as a take-home assessment for the AI-First Product Owner role at Nymbus.

---

## The Problem

Payments operations managers at community banks and credit unions start every morning the same way: toggling between 3–4 disconnected systems to piece together what happened overnight across ACH, wire, and instant payment rails (FedNow/RTP). Exceptions pile up undetected. Settlement positions are unclear until it's too late. There's no unified view.

RailWatch eliminates that fragmentation. It's the dashboard a VP of Payments opens at 8am instead of opening four systems.

## The User

**Primary:** VP of Payments / Director of Operations at a $1B–$10B community bank or credit union — someone who needs to know within 60 seconds of opening their laptop whether anything is on fire.

**Secondary:** CFO/CEO — consumers of the Daily Summary export, not the tool itself.

---

## What It Does

RailWatch provides a unified morning ops view across six payment rails: ACH Standard, ACH Same Day, Wire Domestic, Wire International, RTP, and FedNow.

**Rail Health Overview** — Volume, success/failure rates, and health status (Healthy / Degraded / Critical) for each rail. Volume anomaly detection when current-day volume drops more than 20% below the 7-day rolling average.

**Exception Queue Monitor** — All open exceptions grouped by rail and reason code, sorted by SLA urgency by default. Dollar exposure per group. Queue growth alerts when the queue exceeds 125% of the prior-day closing count. Expandable drill-down to individual transaction records.

**Settlement Position Tracker** — Current settlement balance vs. projected daily obligation, with a Funding Coverage Ratio and intraday timeline chart. CRITICAL alert below 100%, WARNING between 100–110%.

**Cut-Off Time Monitor** — Live countdowns to each rail's settlement cut-off window. ACH Same Day shows all three windows simultaneously. Pulse indicator when any cut-off is under 30 minutes away.

**Market Context Panel** — Live Federal Funds Rate (FRED API), inline FX conversions on Wire International exceptions (Frankfurter API), and payments industry news with sentiment scoring (Marketaux API). Each section fails independently — one API being down doesn't affect the others.

**Status Bar** — Four persistent signals at the top of every page: SLA breach count, Funding Coverage Ratio, degraded rail count, and next cut-off countdown. "All Systems Normal" when everything is green.

**Daily Summary Export** — One-click plain-text export formatted for a morning standup or leadership email. Includes all key metrics, top aging exceptions, active alerts, and live market context if available.

---

## Demo Mode

All payment data is realistically simulated for a fictional $3B credit union (Lakeside Community Credit Union) using Federal Reserve published payment volume benchmarks. A persistent banner identifies the demo state. Live market context (Fed rate, FX, news) is fetched from real public APIs.

> ⚠️ **Production Deployment Notice:** RailWatch Demo operates without authentication or authorization controls. It **MUST NOT** be connected to real member financial data or deployed in a production environment without implementing role-based access controls, audit logging, and appropriate security hardening per NCUA and applicable regulatory requirements. In a production environment, the Simulator module would be replaced by a DataProvider client connected to the Nymbus Connect API — no changes to any consuming dashboard component would be required.

---

## API Integrations

| API | Role | Auth |
|-----|------|------|
| [FRED](https://fred.stlouisfed.org/docs/api/fred/) | Live Federal Funds Rate — contextualizes settlement cost and liquidity pressure. When rates are elevated, an uncovered settlement position is more expensive. This gives the FRED indicator operational meaning at 8am, not just market decoration. | Free API key |
| [Frankfurter](https://frankfurter.dev/) | On-demand FX rates for Wire International exceptions — shows USD → destination currency conversion inline in the exception drill-down. Fetched per currency pair on demand, cached for the session. | None required |
| [Marketaux](https://www.marketaux.com/) | Payments industry news filtered by FedNow, RTP, ACH, and instant payments keywords, with sentiment scoring. Relevant headlines surface directly on Degraded/Critical rail cards. | Free API key |

**CORS note:** FRED and Marketaux do not allow direct browser requests. In demo mode, requests are proxied through [corsproxy.io](https://corsproxy.io). In production, these calls would be made server-side with API keys stored securely in the backend.

---

## Running Locally

**Prerequisites:** Node.js 18+

```bash
# 1. Clone the repo
git clone https://github.com/ttague222/railwatch-payment-ops-monitor.git
cd railwatch-payment-ops-monitor/railwatch

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env.local
# Edit .env.local and add your API keys (see below)

# 4. Start the dev server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

### API Keys

The app runs in demo mode without any API keys — all payment data is simulated. The Market Context Panel (Fed rate, FX, news) requires keys to show live data.

| Variable | Where to get it |
|----------|----------------|
| `VITE_FRED_API_KEY` | [fred.stlouisfed.org/docs/api/api_key.html](https://fred.stlouisfed.org/docs/api/api_key.html) — free, instant approval |
| `VITE_MARKETAUX_API_TOKEN` | [app.marketaux.com/register](https://app.marketaux.com/register) — free tier, 100 req/month |

Frankfurter requires no key.

### Running Tests

```bash
npm test
```

84 tests across smoke tests, edge case verification (all 18 Req 18 scenarios), and Marketaux integration verification.

---

## Architecture

Built with React 19 + TypeScript + Vite + Tailwind CSS v4 + Recharts. Runs entirely client-side — no backend, no build server.

**Key pattern — DataProvider interface:** All dashboard components consume payment data through a `DataProvider` interface. The `SimulatorDataProvider` implements it in demo mode. In production, a `NymbusConnectDataProvider` would implement the same interface against the Nymbus Connect API — zero changes to any consuming component. The transaction schema mirrors Nymbus Connect conventions by design.

**State management:** React context for cross-component concerns (cut-off countdown, Marketaux articles). LocalStorage for API response caching and user preferences. No external state library.

**API resilience:** Each API section is independently wrapped in an `ApiErrorBoundary`. Stale cache is served with a visual indicator rather than showing an error. All fetches use a 5-second `AbortController` timeout.

---

## Product Decisions

**Why a daily ops monitor instead of a readiness assessment?**
The first concept (PayPath — an instant payments readiness tracker) was cut after one question: "Would a VP of Payments open this every day?" A readiness assessment has no recurring value — you fill it out once and you're done. A daily ops monitor is opened every morning. Retention value beats acquisition value.

**Why simulate data instead of connecting to a real core?**
The goal was to demonstrate what the product *would* show with a live Nymbus Connect integration, not to build the integration itself. The DataProvider pattern makes the swap straightforward. Simulating data also means the demo works for anyone without needing access to a real institution's systems.

**Why three APIs instead of the required two?**
FRED adds operational meaning (settlement cost context), Frankfurter adds transaction-level detail (FX exposure on Wire International), and Marketaux adds situational awareness (industry news). Each serves a distinct user need. Using three shows initiative without overcomplicating the build.

**Scope cut: readiness assessment**
The original concept included a payment modernization readiness tracker. It was cut entirely and moved to "Phase 2" in the context file. Knowing what to cut is a product skill.

---

## What I'd Change or Add With More Time

**Live core connection** — Replace the Simulator with a read-only Nymbus Connect API client. The DataProvider interface and transaction schema are already structured for this swap.

**Proactive alerting** — The dashboard requires the ops manager to open it to see problems. Phase 2 adds push notifications: email or SMS when an exception breaches SLA, when coverage ratio drops below a threshold, or when a rail goes Critical.

**Multi-institution support** — Nymbus serves hundreds of community banks. A multi-tenant version would let a Nymbus client services team monitor payment health across their entire customer portfolio — turning a single-institution tool into a platform.

**Historical trend analysis** — 7-day rolling averages are currently simulated. A production version would store and surface 30/60/90-day trend data for seasonal pattern identification and peer benchmarking.

**Remove the CORS proxy** — Move FRED and Marketaux calls to a lightweight backend (Next.js API routes or a simple Express server). API keys stay server-side, caching becomes persistent across sessions, and rate limit tracking is reliable.

---

## Repo Structure

```
.kiro/
  specs/railwatch-payment-ops-monitor/
    requirements.md     # 18 requirements across 6 review rounds
    design.md           # 8-section technical design
    tasks.md            # 35 implementation tasks
ai-collaboration-context.md   # Full decision log and iteration history
railwatch/
  src/
    api/                # FRED, Frankfurter, Marketaux integrations
    components/         # All dashboard components
    context/            # CutOffContext, DataProviderContext, MarketauxContext
    providers/          # SimulatorDataProvider
    simulator/          # Simulation engine, PRNG, config, holidays
    types/              # TypeScript interfaces
    utils/              # Formatting, cut-off logic, preferences, schema
```

---

## Built With

- [Kiro](https://kiro.dev) — spec-driven AI IDE used for the entire build
- React 19 + TypeScript
- Vite 8
- Tailwind CSS v4
- Recharts
- Vitest + Testing Library
