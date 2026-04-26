# Implementation Plan: RailWatch — Payment Operations Monitor

## Overview

Implement the RailWatch single-page React/TypeScript application in dependency order. Each task builds directly on the previous ones. The three flagged implementation risks are addressed as early tasks to unblock downstream components. No task requires a dependency that hasn't been completed in a prior step.

## Tasks

- [x] 1. Project scaffolding — Vite + React + TypeScript, folder structure, Tailwind, Recharts
  - Scaffold with `npm create vite@latest railwatch -- --template react-ts`
  - Install dependencies: `recharts`, `tailwindcss`, `postcss`, `autoprefixer`
  - Create folder structure: `src/types/`, `src/simulator/`, `src/providers/`, `src/context/`, `src/components/`, `src/api/`, `src/utils/`
  - Configure Tailwind (`tailwind.config.ts`, `postcss.config.js`, import in `index.css`)
  - Verify dev server starts and renders default Vite page
  - _Requirements: Req 1, Req 14_

- [x] 1a. Configure Vitest as the test runner
  - Install `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `@vitest/ui`, `jsdom`
  - Add `test` config block to `vite.config.ts`: `environment: 'jsdom'`, `globals: true`, `setupFiles: ['./src/test/setup.ts']`
  - Create `src/test/setup.ts` importing `@testing-library/jest-dom`
  - Add `"test": "vitest --run"` and `"test:ui": "vitest --ui"` scripts to `package.json`
  - Verify test runner works by writing and passing a trivial smoke test
  - This task must be complete before tasks 29 and 33 reference "all tests pass"
  - _Requirements: Req 1, Req 14_

- [x] 2. Core TypeScript type definitions
  - Create `src/types/index.ts` with all type aliases and interfaces from design.md Section 2
  - Include: `PaymentRail`, `RailHealthStatus`, `ReasonCodeNamespace`, `TransactionStatus`, `AlertSeverity`
  - Include: `Transaction`, `ExceptionGroup`, `RailData`, `SettlementPosition`, `IntradayTimelineEntry`, `CutOffTime`, `CutOffWindow`, `HistoricalVolumeEntry`
  - Include: `SimulatorSeedConfig`, `SimulatorOutput`, `FetchState`, `ApiErrorType`, `CutOffSummary`
  - Include: `FredIndicatorData`, `FxRate`, `FxCacheEntry`, `NewsArticle`, `MarketauxCache`
  - Include: `DataProvider` interface with all five method signatures
  - _Requirements: Req 1.12, Req 5, Req 6, Req 7, Req 9, Req 15_

- [x] 3. FEDERAL_HOLIDAYS constant and isBusinessDay() utility
  - Create `src/simulator/holidays.ts` exporting `FEDERAL_HOLIDAYS: string[]` with 2025–2026 dates from design.md Section 2
  - Implement `isBusinessDay(date: Date): boolean` — returns false for Saturday, Sunday, and dates in `FEDERAL_HOLIDAYS`
  - _Requirements: Req 1.4, Req 15.12, Req 15.13, Req 17.7_

- [ ] 4. SimulatorSeedConfig and DEFAULT_SEED_CONFIG
  - Create `src/simulator/config.ts` exporting `DEFAULT_SEED_CONFIG: SimulatorSeedConfig` with all six rail volume ranges and failure rate ranges from design.md Section 2
  - Export `SimulatorSeedConfig` re-export for convenience
  - _Requirements: Req 15.1–15.8_

- [ ] 5. [RISK] Seeded PRNG utility (mulberry32) — required before 7-day history generation
  - Create `src/simulator/prng.ts`
  - Implement `seededRandom(seed: number): () => number` using the mulberry32 algorithm from design.md Section 5.4
  - Implement `dateStringToSeed(dateStr: string): number` — converts ISO date string to a numeric seed
  - Export both functions; `Math.random()` must NOT be used inside `seededRandom`
  - This module must be complete before task 6 (simulation engine) is started
  - _Requirements: Req 15.12_

- [ ] 6. Simulation engine — generate() function
  - Create `src/simulator/engine.ts`
  - Implement correlated settlement sampling per design.md Section 5.3: sample target ratio from [85%, 140%] first, then derive `settlementBalance` and `projectedDailyObligation`
  - Implement `generateHistoricalVolumes()` using `seededRandom` from task 5 — 7 days of `HistoricalVolumeEntry` with `isBusinessDay` flags and `closingExceptionCounts`
  - Implement exception aging distribution per design.md Section 5.5: three guaranteed buckets (under 24h, 24–48h, over 48h)
  - Implement per-rail SLA breach injection per design.md Section 5.6: additive guaranteed breach per rail at rail-specific thresholds
  - Implement non-business-day handling per design.md Section 5.7: reduced volumes, non-business-day indicator
  - Implement top-level `generate(config: SimulatorSeedConfig): SimulatorOutput` per design.md Section 5.8
  - _Requirements: Req 1.3, Req 1.4, Req 1.7, Req 15.1–15.13_

- [ ] 7. SimulatorDataProvider implementing DataProvider interface
  - Create `src/providers/SimulatorDataProvider.ts`
  - Implement `SimulatorDataProvider` class with `DataProvider` interface
  - Constructor calls `generate(seedConfig)` and stores result as `private data: SimulatorOutput`
  - Implement all five methods: `getRailData()`, `getExceptionQueue()`, `getSettlementPosition()`, `getHistoricalVolumes(days)`, `getPriorDayClosingExceptions()`
  - `getHistoricalVolumes(days)` uses `.slice(-days)` on `data.historicalVolumes`
  - No component other than `SimulatorDataProvider` may import from `src/simulator/`
  - _Requirements: Req 1.12_

- [ ] 8. DataProviderContext and useDataProvider hook
  - Create `src/context/DataProviderContext.tsx`
  - Create `DataProviderContext` with `createContext<DataProvider | null>(null)`
  - Implement `useDataProvider(): DataProvider` hook — throws if used outside provider
  - Export context and hook
  - _Requirements: Req 1.12_

- [ ] 9. [RISK] CutOffContext with provider and consumer pattern — required before CutOffTimeMonitor and StatusBar
  - Create `src/context/CutOffContext.tsx`
  - Define `CutOffSummary` interface: `{ nextRail: PaymentRail | null; nextWindowLabel: string | null; secondsRemaining: number | null }`
  - Create `CutOffContext` with `createContext<{ summary: CutOffSummary; setSummary: (s: CutOffSummary) => void } | null>(null)`
  - Implement `CutOffContextProvider` component wrapping children with `useState<CutOffSummary>`
  - Implement `useCutOffSummary(): CutOffSummary` consumer hook
  - Implement `useSetCutOffSummary(): (s: CutOffSummary) => void` writer hook
  - This context must exist before task 20 (CutOffTimeMonitor) and task 28 (StatusBar wiring)
  - _Requirements: Req 2.2, Req 2.5, Req 17_

- [ ] 10. CUTOFF_SCHEDULE constant and secondsUntilCutOff() utility
  - Create `src/utils/cutoff.ts`
  - Export `CUTOFF_SCHEDULE: Record<PaymentRail, CutOffWindow[]>` with all rail cut-off times from design.md Section 6.1 (ACH_Standard 14:45, ACH_Same_Day three windows, Wire_Domestic 18:00, Wire_International 17:00, RTP/FedNow no cut-off)
  - Implement `secondsUntilCutOff(windowTimeET: string, now: Date): number | null` using `Intl.DateTimeFormat` for Eastern Time — no manual UTC offset arithmetic
  - Implement `getNextBusinessDay(from: Date): Date` per design.md Section 6.4
  - _Requirements: Req 17.1, Req 17.9_

- [ ] 11. App shell — root component, DemoModeBanner, basic layout
  - Create `src/components/DemoModeBanner.tsx` — persistent non-dismissible banner, max 48px height, text "DEMO MODE — Simulated Data"
  - Update `src/App.tsx` with `DataProviderContext.Provider` wrapping `SimulatorDataProvider` instance
  - Add `useState<DataProvider>` with lazy initializer `() => new SimulatorDataProvider()`
  - Add `useState<Date>` for `generatedAt`
  - Add `useCallback` refresh handler that replaces provider and updates `generatedAt`
  - Wrap app in `CutOffContextProvider` (from task 9)
  - Render `DemoModeBanner`, `StatusBar` placeholder, `FirstRunOverlay` placeholder, and `<main>` with section placeholders
  - _Requirements: Req 1.2, Req 1.8, Req 1.9, Req 1.10, Req 2.1_

- [ ] 12. Schema versioning module
  - Create `src/utils/schema.ts`
  - Export `CURRENT_SCHEMA_VERSION = '1.0.0'`
  - Implement `migrateIfNeeded(): void` — reads `railwatch_schema_version` from LocalStorage; if absent or mismatched, clears all `railwatch_*` keys and writes current version
  - Call `migrateIfNeeded()` at app startup (in `main.tsx` before React render)
  - _Requirements: Req 3.3, Req 18.10_

- [ ] 13. FirstRunOverlay component
  - Create `src/components/FirstRunOverlay.tsx`
  - On mount, check `railwatch_schema_version` in LocalStorage; show overlay if key is absent
  - Render overlay listing five dashboard sections: Status Bar, Rail Health Overview, Exception Queue, Settlement Position, Market Context
  - Include one-sentence Demo Mode description
  - Dismiss on click or keypress (`Escape`, `Enter`, `Space`); write schema version to LocalStorage on dismiss
  - If LocalStorage is unavailable (try/catch), skip overlay entirely
  - _Requirements: Req 3.1–3.5_

- [ ] 14. UserPreferences read/write utilities
  - Create `src/utils/preferences.ts`
  - Define `UserPreferences` interface: `{ panelCollapseState: Record<string, boolean>; refreshInterval: number }`
  - Implement `readPreferences(): UserPreferences` — reads `railwatch_user_prefs` from LocalStorage; returns defaults if absent or parse fails
  - Implement `writePreferences(prefs: UserPreferences): void` — writes to LocalStorage; silently catches storage-full errors
  - _Requirements: Req 1.6, Req 14.8_

- [ ] 15. RailHealthOverview and RailHealthCard components
  - Create `src/components/RailHealthOverview.tsx` — calls `useDataProvider().getRailData()`, renders six `RailHealthCard` instances
  - Create `src/components/RailHealthCard.tsx`
  - Display: rail name, status badge (color + text label), today volume, success/failure rates as percentages (2dp), prior-day volume comparison, 7-day average comparison
  - Volume anomaly indicator when current volume < 80% of 7-day average
  - Status badge uses both color and text label (Healthy/Degraded/Critical) — no color-only indicators
  - Conditionally render Marketaux news headline when rail is Degraded or Critical (reads from MarketauxContext — placeholder until task 25)
  - Apply `React.memo` to `RailHealthCard`
  - _Requirements: Req 5.1–5.11, Req 16.1, Req 16.5, Req 16.6_

- [ ] 16. ExceptionQueueMonitor and ExceptionGroupRow components
  - Create `src/components/ExceptionQueueMonitor.tsx`
  - Calls `useDataProvider().getExceptionQueue()` and `getPriorDayClosingExceptions()`
  - Manages `expandedGroups: Set<string>` state (key = `{rail}_{reasonCode}`)
  - Manages `sortMode: 'sla' | 'exposure'` state, default `'sla'`
  - Sort by SLA urgency (time to breach ascending) by default; secondary sort by dollar exposure
  - Display total exception count, per-rail breakdown, top 5 reason codes by count, total dollar exposure per rail
  - Queue growth alert when size > 125% of prior-day closing count
  - All-clear indicator when queue is empty
  - Create `src/components/ExceptionGroupRow.tsx` — displays rail, reason code, namespace, count, dollar exposure, SLA status badge (color + text label); toggles drill-down on click
  - Apply `React.memo` to `ExceptionGroupRow`
  - _Requirements: Req 6.1–6.21, Req 16.2_

- [ ] 17. [RISK] Resolve FxConversionInline state scope — fxLastFetch and retryFx at ExceptionDrillDown level
  - In `src/components/ExceptionDrillDown.tsx`, define `fxLastFetch: Record<string, number>` and `retryFx: Record<string, () => void>` as component-level state (not module-level)
  - These are passed as props to `FxConversionInline` and `ApiErrorBoundary` — not stored in a separate context or module singleton
  - Document this decision with an inline comment: "FX fetch state is scoped to ExceptionDrillDown to avoid stale closures across multiple drill-down instances"
  - This structural decision must be made before implementing `ExceptionDrillDown` (task 18) and `FxConversionInline` (task 24)
  - _Requirements: Req 4, Req 9_

- [ ] 18. ExceptionDrillDown component
  - Complete `src/components/ExceptionDrillDown.tsx` (scaffolded in task 17)
  - Renders inline transaction list for an expanded exception group
  - Displays per transaction: `transactionId`, `amount` (USD, formatted), age since `openedAt`, SLA status indicator (color + label), `reasonCode`, `reasonCodeNamespace`
  - For `Wire_International` transactions: renders `FxConversionInline` placeholder (wired in task 24)
  - Shows first 10 transactions sorted by dollar exposure descending; displays remaining count if > 10
  - Displays "Demo Data" label on each transaction record
  - _Requirements: Req 4.1–4.7, Req 6.21, Req 16.5_

- [ ] 19. SettlementPositionTracker and SettlementTimeline components
  - Create `src/components/SettlementPositionTracker.tsx`
  - Calls `useDataProvider().getSettlementPosition()`
  - Displays `settlementBalance` and `projectedDailyObligation` in USD format ($X,XXX,XXX.XX)
  - Computes and displays `fundingCoverageRatio` as percentage (2dp); alert level: ≥ 110% = adequate, 100–110% = WARNING, < 100% = CRITICAL, exactly 100.00% = CRITICAL
  - Displays per-rail funded/at-risk/underfunded breakdown
  - Displays non-dismissible "SIMULATED DATA" label when ratio < 110%
  - If `projectedDailyObligation` is 0, shows data unavailable indicator instead of ratio
  - Create `src/components/SettlementTimeline.tsx` — Recharts bar/area chart, hours 8–18, marks current hour, `isAnimationActive={false}` on all Recharts series
  - Apply `React.memo` to `SettlementTimeline`
  - _Requirements: Req 7.1–7.12, Req 16.3, Req 16.5, Req 18.15, Req 18.16_

- [ ] 20. CutOffTimeMonitor and AchSameDayWindowStrip components
  - Create `src/components/CutOffTimeMonitor.tsx`
  - Owns single `setInterval` at 1000ms; maintains `now: Date` state updated each tick
  - On each tick: computes `secondsRemaining` per window using `secondsUntilCutOff()` from task 10; writes `CutOffSummary` to `CutOffContext` via `useSetCutOffSummary()`
  - When `isBusinessDay(today)` is false: renders static non-business-day state, skips countdown computation
  - Countdown states: > 7200s = neutral, 1800–7200s = WARNING, < 1800s = CRITICAL with pulse indicator, 0s = "Closed" (never negative)
  - RTP and FedNow display "24/7 — No Cut-Off"
  - Create `src/components/AchSameDayWindowStrip.tsx` — displays all three ACH Same Day windows; highlights next upcoming; shows "All windows closed — next business day: [date]" when all past
  - Apply `React.memo` to `AchSameDayWindowStrip`
  - _Requirements: Req 17.1–17.10, Req 18.11, Req 18.12_

- [ ] 21. ErrorState component and ApiErrorBoundary
  - Create `src/components/ErrorState.tsx`
  - Props: `source: string`, `errorType: ApiErrorType | null`, `lastFetchedAt: string | null`, `cachedDataAvailable: boolean`, `onRetry: () => void`
  - Displays: error icon, plain-language message (no raw HTTP codes or stack traces), last-fetch timestamp if available, Retry button
  - When retry in progress: replace Retry button with loading indicator, block duplicate retries
  - Create `src/components/ApiErrorBoundary.tsx` — React error boundary wrapping each API section; renders `ErrorState` on caught error
  - _Requirements: Req 11.1–11.5, Req 12.2_

- [ ] 22. Loading skeleton components — FredIndicator, FxConversionInline, Marketaux dimensions
  - Create `src/components/skeletons/FredSkeleton.tsx` — placeholder matching FredIndicator dimensions
  - Create `src/components/skeletons/FxSkeleton.tsx` — placeholder matching FxConversionInline dimensions
  - Create `src/components/skeletons/NewsSkeleton.tsx` — placeholder matching MarketauxNewsFeed dimensions
  - Each skeleton uses animated pulse styling (Tailwind `animate-pulse`)
  - Used by parent components while `fetchState === 'loading'`
  - _Requirements: Req 12.3_

- [ ] 23. FredIndicator component — FRED API fetch, cache, error handling
  - Create `src/api/fred.ts` — implements `readFredCache()`, `writeFredCache()`, `mapFredResponse()`, and `fetchFredRate()` with 5s `AbortController` timeout
  - Create `src/components/FredIndicator.tsx`
  - On mount: read `railwatch_fred_fedfunds` from LocalStorage; if fresh (< 4h) serve from cache; if stale (4–24h) serve from cache AND trigger background re-fetch; if absent or > 24h fetch immediately
  - State: `data: FredIndicatorData | null`, `fetchState: FetchState`, `errorType: ApiErrorType | null`, `isStale: boolean`
  - Displays: "Fed Rate: X.XX%", observation date, MoM change
  - Shows `Stale_Data_Indicator` when `isStale` is true
  - Error messages per design.md Section 3.4 error matrix
  - Renders `FredSkeleton` while loading, `ErrorState` on error with no cache
  - _Requirements: Req 8.1–8.8, Req 11, Req 12.4_

- [ ] 24. FxConversionInline component — Frankfurter on-demand fetch, session cache
  - Create `src/api/frankfurter.ts` — implements `fxSessionCache` module-level Map, `readFxCache()`, `writeFxCache()`, `mapFrankfurterResponse()`, `fetchFxRate()` with 5s `AbortController` timeout
  - Create `src/components/FxConversionInline.tsx`
  - Props: `instructedAmount: number`, `destinationCurrency: string`, `fxLastFetch: number | undefined`, `onRetry: () => void`
  - Fetches on demand when component mounts (not on page load)
  - Displays: `{instructedAmount} USD = {convertedAmount} {currency}` with rate rounded to 4dp
  - Unsupported currency: displays "Rate unavailable for {CURRENCY}" — not an error state
  - Error messages per design.md Section 3.4 error matrix
  - Wire into `ExceptionDrillDown` (task 18) for `Wire_International` transactions
  - _Requirements: Req 9.1–9.8, Req 18.14_

- [ ] 25a. [RISK] Create MarketauxContext — required before MarketauxNewsFeed writes to it
  - Create `src/context/MarketauxContext.tsx` following the same pattern as CutOffContext (task 9)
  - Export `MarketauxContextProvider` component wrapping children with `useState<NewsArticle[]>([])`
  - Export `useMarketauxArticles(): NewsArticle[]` consumer hook
  - Export `useSetMarketauxArticles(): (articles: NewsArticle[]) => void` writer hook
  - This context must exist before task 25 (MarketauxNewsFeed writes to it) and task 15 (RailHealthCard reads from it)
  - _Requirements: Req 10.10, Req 5.11_

- [ ] 25. MarketauxNewsFeed component — fetch, monthly counter, conditional rail surfacing
  - Create `src/api/marketaux.ts` — implements `getMarketauxCounterKey()`, `readMarketauxCount()`, `incrementMarketauxCount()`, `readMarketauxCache()`, `writeMarketauxCache()`, `mapMarketauxArticle()`, `fetchMarketauxNews()` with 5s `AbortController` timeout
  - Create `src/components/MarketauxNewsFeed.tsx`
  - State: `articles`, `fetchState`, `errorType`, `rateLimitReached`
  - Displays 3–5 articles with headline, source, publication timestamp (user local timezone), sentiment label (Positive/Neutral/Negative per ±0.15 thresholds)
  - Writes article list to `MarketauxContext` via `useSetMarketauxArticles()` so `RailHealthCard` can access it
  - Displays current request count and monthly limit (90)
  - Wire `useMarketauxArticles()` into `RailHealthCard` (task 15) to complete conditional headline surfacing
  - _Requirements: Req 10.1–10.13, Req 18.8_

- [ ] 26. MarketContextPanel — compose all three API sections with error boundaries
  - Create `src/components/MarketContextPanel.tsx`
  - Composes `FredIndicator`, `FxConversionInline` (for Wire_International exceptions from exception queue), and `MarketauxNewsFeed`
  - Each sub-component wrapped in `ApiErrorBoundary`
  - Each section independently isolated — failure in one does not affect others
  - Displays last-successful-fetch timestamp per section
  - Defers all API fetches until after initial simulated data render (use `useEffect` with no blocking)
  - _Requirements: Req 12.1–12.6, Req 18.5, Req 18.6, Req 18.7_

- [ ] 27. DailySummaryExport component
  - Create `src/components/DailySummaryExport.tsx`
  - Props: `generatedAt: Date`
  - Assembles plain-text summary from `useDataProvider()` and cached API state (reads LocalStorage for FRED and Marketaux caches; reads `fxSessionCache` for FX rates)
  - Summary includes: date/time, per-rail health status, total exception count + top 3 aging exceptions by SLA, settlement position + coverage ratio, active liquidity alerts
  - Includes Fed Funds Rate and top news headline when available; includes up to 2 FX rates if fetched this session; omits FX section without error if none fetched
  - First and last lines are the mandatory disclaimer from Req 13.5
  - On click: attempt `navigator.clipboard.writeText()`; on success show 3s confirmation then auto-dismiss; if Clipboard API unavailable show modal fallback
  - When clicked while confirmation is still showing: reset timer without duplicating message
  - State: `copyState: 'idle' | 'copied' | 'fallback'`
  - _Requirements: Req 13.1–13.8, Req 18.17, Req 18.18_

- [ ] 28. StatusBar completion — wire all four signals via CutOffContext
  - Complete `src/components/StatusBar.tsx`
  - Props: `generatedAt: Date`, `onRefresh: () => void`
  - Signal 1: total SLA breach count from `useDataProvider().getExceptionQueue()` — breach-level color + count label
  - Signal 2: `fundingCoverageRatio` from `useDataProvider().getSettlementPosition()` — alert level color + "Simulated Data" inline label
  - Signal 3: count of Degraded + Critical rails from `useDataProvider().getRailData()`
  - Signal 4: next cut-off countdown from `useCutOffSummary()` (CutOffContext, task 9) — "All Clear" when no cut-off within 2 hours
  - "All Systems Normal" indicator when: 0 SLA breaches, ratio ≥ 110%, all rails Healthy, no cut-off within 2 hours
  - Max height 48px; does not push content below fold at 1280px viewport
  - Refresh button with loading indicator; blocks duplicate requests
  - _Requirements: Req 2.1–2.8, Req 1.9, Req 1.10_

- [ ] 29. Checkpoint — wire all components into App, verify full render
  - Import and render all components in `App.tsx` in correct tree order per design.md Section 1
  - Verify `DataProviderContext.Provider` wraps all dashboard components
  - Verify `CutOffContextProvider` wraps `CutOffTimeMonitor` and `StatusBar`
  - Verify `MarketauxContext` provider wraps `MarketContextPanel` and `RailHealthOverview`
  - Verify no component below `App` imports from `src/simulator/` directly
  - Ensure all tests pass, ask the user if questions arise.
  - _Requirements: Req 1.12, Req 18.3_

- [ ] 30. Performance pass — React.memo and Recharts animation
  - Apply `React.memo` to all non-timer components not already memoized: `DemoModeBanner`, `RailHealthOverview`, `ExceptionQueueMonitor`, `SettlementPositionTracker`, `MarketContextPanel`, `DailySummaryExport`, `FredIndicator`, `MarketauxNewsFeed`, `ErrorState`
  - Confirm `CutOffTimeMonitor` is NOT memoized (it owns the timer and must re-render on tick)
  - Confirm `isAnimationActive={false}` on all Recharts `<Bar>`, `<Area>`, `<Line>` series in `SettlementTimeline`
  - Verify `setInterval` in `CutOffTimeMonitor` does not cause re-renders in sibling components (CutOffContext isolates updates)
  - _Requirements: Req 14.1, Req 14.5, Req 17.8_

- [ ] 31. Accessibility pass — keyboard navigation, color+label indicators, formatting
  - Verify all interactive elements reachable via Tab in logical order: export button, retry buttons, panel toggles, sort toggle, exception group rows
  - Verify all status indicators use both color and text/icon (no color-only signals): Rail_Health_Status badges, SLA breach badges, Intraday_Liquidity_Alert labels, cut-off countdown states
  - Verify all monetary values formatted as $X,XXX,XXX.XX (comma-separated thousands, 2dp)
  - Verify all percentage values formatted as XX.XX% (2dp + percent symbol)
  - Verify all timestamps rendered in user's local timezone
  - Verify data refresh updates values in place without full page re-render or scroll position loss
  - _Requirements: Req 16.1–16.8_

- [ ] 32. Edge case verification — all 18 scenarios in Req 18
  - Req 18.1–18.2: Verify "All Systems Normal" state renders correctly when all signals are green
  - Req 18.3: Verify Simulator exception is caught and full-page error state with Reload button is shown; no partial render
  - Req 18.4: Verify per-rail counts are used as authoritative when total mismatch is detected; console warning logged
  - Req 18.5–18.6: Verify all-APIs-down scenarios with and without cache
  - Req 18.7–18.8: Verify partial API availability (FRED down only; Marketaux down with degraded rail)
  - Req 18.9: Verify LocalStorage-full path — app continues, non-blocking notice shown
  - Req 18.10: Verify schema mismatch clears stale data and shows first-run overlay
  - Req 18.11: Verify cut-off at exactly 0 seconds shows "Closed", not negative
  - Req 18.12: Verify DST clock change recalculates within one tick
  - Req 18.13: Verify rail with 100% failure rate shows Critical and exceptions appear in queue
  - Req 18.14: Verify unsupported Frankfurter currency shows missing data indicator, not error state
  - Req 18.15: Verify exactly 100.00% coverage ratio shows CRITICAL alert
  - Req 18.16: Verify exactly 110.00% coverage ratio shows adequately funded, no alert
  - Req 18.17–18.18: Verify clipboard copy confirmation timing and deduplication
  - _Requirements: Req 18.1–18.18_

- [ ] 33. Final checkpoint — full test suite and integration review
  - Ensure all tests pass, ask the user if questions arise.
  - Verify Req 1.7 consistency invariant: sum of per-rail counts equals total transaction count
  - Verify Req 4.6 drill-down consistency: sum of individual transaction amounts equals group dollar exposure
  - Verify Req 5.9 completeness invariant: successCount + failureCount = todayVolume for each rail
  - Verify Req 6.20 dollar exposure invariant: sum of transaction amounts equals displayed group exposure
  - Verify Req 7.8 calculation invariant: displayed ratio equals (balance / obligation) × 100 rounded to 2dp
  - Verify Req 13.8 export consistency: ratio in export matches ratio displayed at time of export

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP (none in this plan — no property-based tests as design has no Correctness Properties section)
- Tasks 5, 9, and 17 are flagged implementation risks and must be completed before their downstream dependents
- Task 5 (mulberry32 PRNG) must precede task 6 (simulation engine)
- Task 9 (CutOffContext) must precede tasks 20 (CutOffTimeMonitor) and 28 (StatusBar wiring)
- Task 17 (FxConversionInline state scope) must precede tasks 18 (ExceptionDrillDown) and 24 (FxConversionInline)
- All monetary formatting uses `$X,XXX,XXX.XX`; all percentages use `XX.XX%` — no exceptions
- No component below `App` may import from `src/simulator/` — the DataProvider boundary is enforced at `SimulatorDataProvider`
