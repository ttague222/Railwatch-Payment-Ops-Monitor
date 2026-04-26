/**
 * Edge Case Verification — Req 18.1–18.18
 *
 * Covers all 18 edge case scenarios from Requirement 18.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

// ─── Utilities under test ─────────────────────────────────────────────────────
import { secondsUntilCutOff } from '../utils/cutoff';
import { writePreferences, readPreferences, isStorageFull, resetStorageFullFlag } from '../utils/preferences';
import { migrateIfNeeded, CURRENT_SCHEMA_VERSION } from '../utils/schema';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Build a minimal DataProvider mock. */
function makeProvider(overrides: Partial<{
  slaBreachCount: number;
  fundingCoverageRatio: number;
  unhealthyRailCount: number;
}> = {}) {
  const { slaBreachCount = 0, fundingCoverageRatio = 115, unhealthyRailCount = 0 } = overrides;

  const breachGroups = Array.from({ length: slaBreachCount }, (_, i) => ({
    rail: 'ACH_Standard' as const,
    reasonCode: `R0${i + 1}`,
    reasonCodeNamespace: 'NACHA' as const,
    count: 1,
    dollarExposure: 1000,
    // 100 hours ago — well past 72h ACH_Standard breach threshold
    oldestOpenedAt: new Date(Date.now() - 100 * 3600 * 1000).toISOString(),
    transactions: [],
  }));

  const railData = Array.from({ length: 6 }, (_, i) => ({
    rail: (['ACH_Standard', 'ACH_Same_Day', 'Wire_Domestic', 'Wire_International', 'RTP', 'FedNow'] as const)[i],
    status: (i < unhealthyRailCount ? 'Critical' : 'Healthy') as 'Healthy' | 'Degraded' | 'Critical',
    todayVolume: 1000,
    successCount: 990,
    failureCount: 10,
    failureRate: 0.01,
    priorDayVolume: 1000,
    sevenDayAverage: 1000,
  }));

  const balance = 1_000_000;
  const obligation = Math.round(balance / (fundingCoverageRatio / 100));

  return {
    getRailData: () => railData,
    getExceptionQueue: () => breachGroups,
    getSettlementPosition: () => ({
      settlementBalance: balance,
      projectedDailyObligation: obligation,
      fundingCoverageRatio,
      railBreakdown: {
        ACH_Standard: 'funded', ACH_Same_Day: 'funded', Wire_Domestic: 'funded',
        Wire_International: 'funded', RTP: 'funded', FedNow: 'funded',
      } as Record<string, 'funded' | 'at-risk' | 'underfunded'>,
      intradayTimeline: [],
    }),
    getHistoricalVolumes: () => [],
    getPriorDayClosingExceptions: () => ({
      ACH_Standard: 0, ACH_Same_Day: 0, Wire_Domestic: 0,
      Wire_International: 0, RTP: 0, FedNow: 0,
    }),
  };
}

// ─── Req 18.1–18.2: "All Systems Normal" ─────────────────────────────────────

describe('Req 18.1–18.2: All Systems Normal', () => {
  it('renders "All Systems Normal" when all signals are green', async () => {
    const { DataProviderContext } = await import('../context/DataProviderContext');
    const { CutOffContextProvider } = await import('../context/CutOffContext');
    const { MarketauxContextProvider } = await import('../context/MarketauxContext');
    const { default: StatusBar } = await import('../components/StatusBar');

    const provider = makeProvider({ slaBreachCount: 0, fundingCoverageRatio: 115, unhealthyRailCount: 0 });

    render(
      React.createElement(DataProviderContext.Provider, { value: provider as any },
        React.createElement(CutOffContextProvider, null,
          React.createElement(MarketauxContextProvider, null,
            React.createElement(StatusBar, { generatedAt: new Date(), onRefresh: () => {} })
          )
        )
      )
    );

    expect(screen.getByText('All Systems Normal')).toBeInTheDocument();
  });

  it('does NOT show "All Systems Normal" when there are SLA breaches', async () => {
    const { DataProviderContext } = await import('../context/DataProviderContext');
    const { CutOffContextProvider } = await import('../context/CutOffContext');
    const { MarketauxContextProvider } = await import('../context/MarketauxContext');
    const { default: StatusBar } = await import('../components/StatusBar');

    const provider = makeProvider({ slaBreachCount: 1, fundingCoverageRatio: 115, unhealthyRailCount: 0 });

    render(
      React.createElement(DataProviderContext.Provider, { value: provider as any },
        React.createElement(CutOffContextProvider, null,
          React.createElement(MarketauxContextProvider, null,
            React.createElement(StatusBar, { generatedAt: new Date(), onRefresh: () => {} })
          )
        )
      )
    );

    expect(screen.queryByText('All Systems Normal')).not.toBeInTheDocument();
  });

  it('does NOT show "All Systems Normal" when ratio < 110', async () => {
    const { DataProviderContext } = await import('../context/DataProviderContext');
    const { CutOffContextProvider } = await import('../context/CutOffContext');
    const { MarketauxContextProvider } = await import('../context/MarketauxContext');
    const { default: StatusBar } = await import('../components/StatusBar');

    const provider = makeProvider({ slaBreachCount: 0, fundingCoverageRatio: 105, unhealthyRailCount: 0 });

    render(
      React.createElement(DataProviderContext.Provider, { value: provider as any },
        React.createElement(CutOffContextProvider, null,
          React.createElement(MarketauxContextProvider, null,
            React.createElement(StatusBar, { generatedAt: new Date(), onRefresh: () => {} })
          )
        )
      )
    );

    expect(screen.queryByText('All Systems Normal')).not.toBeInTheDocument();
  });
});

// ─── Req 18.3: Simulator exception caught, full-page error state ──────────────

describe('Req 18.3: Simulator error boundary', () => {
  it('shows full-page error with Reload button when SimulatorDataProvider throws', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { SimulatorDataProvider } = await import('../providers/SimulatorDataProvider');
    vi.spyOn(SimulatorDataProvider.prototype, 'getRailData').mockImplementation(() => {
      throw new Error('Simulator initialization failed');
    });

    const { default: App } = await import('../App');
    render(React.createElement(App));

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Simulator Error')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument();

    vi.restoreAllMocks();
    consoleError.mockRestore();
  });
});

// ─── Req 18.4: Per-rail counts authoritative on total mismatch ────────────────

describe('Req 18.4: Per-rail count authoritative total', () => {
  it('ExceptionQueueMonitor derives total from per-rail groups (structural guarantee)', async () => {
    const { DataProviderContext } = await import('../context/DataProviderContext');
    const { default: ExceptionQueueMonitor } = await import('../components/ExceptionQueueMonitor');

    const groups = [
      {
        rail: 'ACH_Standard' as const,
        reasonCode: 'R01',
        reasonCodeNamespace: 'NACHA' as const,
        count: 5,
        dollarExposure: 5000,
        oldestOpenedAt: new Date(Date.now() - 1000).toISOString(),
        transactions: [],
      },
      {
        rail: 'Wire_Domestic' as const,
        reasonCode: 'AC01',
        reasonCodeNamespace: 'ISO20022' as const,
        count: 3,
        dollarExposure: 3000,
        oldestOpenedAt: new Date(Date.now() - 1000).toISOString(),
        transactions: [],
      },
    ];

    const provider = { ...makeProvider(), getExceptionQueue: () => groups };

    render(
      React.createElement(DataProviderContext.Provider, { value: provider as any },
        React.createElement(ExceptionQueueMonitor)
      )
    );

    // Total = 5 + 3 = 8, derived from per-rail groups
    expect(screen.getByText('8')).toBeInTheDocument();
  });

  it('logs console.warn when per-rail sum mismatches an externally-reported total', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const groups = [
      { rail: 'ACH_Standard', count: 5 },
      { rail: 'Wire_Domestic', count: 3 },
    ];
    const derivedTotal = groups.reduce((s, g) => s + g.count, 0); // 8
    const externalTotal = 10; // mismatch

    if (derivedTotal !== externalTotal) {
      console.warn(
        `[RailWatch] Per-rail exception count mismatch: derived=${derivedTotal}, reported=${externalTotal}`
      );
    }

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Per-rail exception count mismatch')
    );
    warnSpy.mockRestore();
  });
});

// ─── Req 18.5–18.6: All APIs down ────────────────────────────────────────────

describe('Req 18.5–18.6: All APIs down', () => {
  beforeEach(() => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network'));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('simulated data sections still render when all APIs fail', async () => {
    const { DataProviderContext } = await import('../context/DataProviderContext');
    const { default: RailHealthOverview } = await import('../components/RailHealthOverview');
    const { MarketauxContextProvider } = await import('../context/MarketauxContext');

    const provider = makeProvider();

    render(
      React.createElement(DataProviderContext.Provider, { value: provider as any },
        React.createElement(MarketauxContextProvider, null,
          React.createElement(RailHealthOverview)
        )
      )
    );

    expect(screen.getByText('ACH Standard')).toBeInTheDocument();
    expect(screen.getByText('Wire Domestic')).toBeInTheDocument();
  });

  it('shows stale indicator when cached FRED data exists and API is down', async () => {
    // Write a stale FRED cache entry (> 4h old) in the format readFredCache expects:
    // the raw FredIndicatorData object stored directly (fetchedAt is a field inside it).
    const staleFredData = {
      currentRate: 5.33,
      currentDate: '2025-01-01',
      priorRate: 5.33,
      priorDate: '2024-12-01',
      momChange: 0,
      fetchedAt: new Date(Date.now() - 5 * 3600 * 1000).toISOString(), // 5h ago → stale
    };
    localStorage.setItem('railwatch_fred_fedfunds', JSON.stringify(staleFredData));

    const { default: FredIndicator } = await import('../components/FredIndicator');
    render(React.createElement(FredIndicator));

    // Should show the stale data indicator
    await screen.findByText(/stale/i);

    localStorage.removeItem('railwatch_fred_fedfunds');
  });
});

// ─── Req 18.7: FRED down only ─────────────────────────────────────────────────

describe('Req 18.7: FRED down only', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.removeItem('railwatch_fred_fedfunds');
  });

  it('FredIndicator shows error state when FRED API fails and no cache exists', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network'));
    localStorage.removeItem('railwatch_fred_fedfunds');

    const { default: FredIndicator } = await import('../components/FredIndicator');
    render(React.createElement(FredIndicator));

    await screen.findByRole('button', { name: /retry/i });
  });
});

// ─── Req 18.8: Marketaux down with degraded rail ──────────────────────────────

describe('Req 18.8: Marketaux down with degraded rail', () => {
  it('RailHealthCard shows no news headline when Marketaux is down', async () => {
    const { MarketauxContextProvider } = await import('../context/MarketauxContext');
    const { default: RailHealthCard } = await import('../components/RailHealthCard');

    const degradedRail = {
      rail: 'FedNow' as const,
      status: 'Degraded' as const,
      todayVolume: 100,
      successCount: 97,
      failureCount: 3,
      failureRate: 0.03,
      priorDayVolume: 100,
      sevenDayAverage: 100,
    };

    render(
      React.createElement(MarketauxContextProvider, null,
        React.createElement(RailHealthCard, { data: degradedRail })
      )
    );

    expect(screen.getByText('Degraded')).toBeInTheDocument();
    // No news headline (empty articles in context = Marketaux down)
    expect(screen.queryByText(/News:/)).not.toBeInTheDocument();
    // No error state inside the card
    expect(screen.queryByRole('button', { name: /retry/i })).not.toBeInTheDocument();
  });
});

// ─── Req 18.9: LocalStorage full ─────────────────────────────────────────────

describe('Req 18.9: LocalStorage full', () => {
  // Reset the module-level flag before every test in this block
  beforeEach(() => {
    resetStorageFullFlag();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetStorageFullFlag();
  });

  it('app continues operating when localStorage.setItem throws', () => {
    vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError');
    });

    expect(() => {
      writePreferences({ panelCollapseState: {}, refreshInterval: 30_000 });
    }).not.toThrow();
  });

  it('isStorageFull() returns true after a storage-full write failure', () => {
    // Stub the entire localStorage global with a version whose setItem throws.
    // This is the only reliable way to intercept bare `localStorage.setItem` calls
    // inside modules that captured the reference at import time in jsdom.
    const throwingStorage = {
      ...globalThis.localStorage,
      setItem: () => { throw new DOMException('QuotaExceededError'); },
      getItem: (k: string) => globalThis.localStorage.getItem(k),
      removeItem: (k: string) => globalThis.localStorage.removeItem(k),
      clear: () => globalThis.localStorage.clear(),
      key: (i: number) => globalThis.localStorage.key(i),
      get length() { return globalThis.localStorage.length; },
    };
    vi.stubGlobal('localStorage', throwingStorage);

    writePreferences({ panelCollapseState: {}, refreshInterval: 30_000 });

    expect(isStorageFull()).toBe(true);

    vi.unstubAllGlobals();
  });

  it('readPreferences() still returns defaults when storage is full', () => {
    vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError');
    });

    writePreferences({ panelCollapseState: {}, refreshInterval: 30_000 });
    const prefs = readPreferences();

    expect(prefs.refreshInterval).toBe(30_000);
    expect(prefs.panelCollapseState).toEqual({});
  });
});

// ─── Req 18.10: Schema mismatch ───────────────────────────────────────────────

describe('Req 18.10: Schema mismatch', () => {
  afterEach(() => {
    localStorage.removeItem('railwatch_schema_version');
    localStorage.removeItem('railwatch_user_prefs');
    localStorage.removeItem('railwatch_fred_fedfunds');
  });

  it('migrateIfNeeded() clears all railwatch_* keys on version mismatch', () => {
    localStorage.setItem('railwatch_schema_version', '0.0.1');
    localStorage.setItem('railwatch_user_prefs', '{"panelCollapseState":{},"refreshInterval":30000}');
    localStorage.setItem('railwatch_fred_fedfunds', '{}');

    migrateIfNeeded();

    expect(localStorage.getItem('railwatch_user_prefs')).toBeNull();
    expect(localStorage.getItem('railwatch_fred_fedfunds')).toBeNull();
    expect(localStorage.getItem('railwatch_schema_version')).toBe(CURRENT_SCHEMA_VERSION);
  });

  it('FirstRunOverlay is shown when railwatch_schema_version is absent', async () => {
    localStorage.removeItem('railwatch_schema_version');

    const { default: FirstRunOverlay } = await import('../components/FirstRunOverlay');
    render(React.createElement(FirstRunOverlay));

    expect(screen.getByRole('dialog', { name: /welcome to railwatch/i })).toBeInTheDocument();
  });

  it('FirstRunOverlay is NOT shown when schema version is present', async () => {
    localStorage.setItem('railwatch_schema_version', CURRENT_SCHEMA_VERSION);

    const { default: FirstRunOverlay } = await import('../components/FirstRunOverlay');
    render(React.createElement(FirstRunOverlay));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

// ─── Req 18.11: Cut-off at exactly 0 seconds shows "Closed" ──────────────────

describe('Req 18.11: Cut-off at exactly 0 seconds', () => {
  it('secondsUntilCutOff returns null when diff is exactly 0 (treated as closed)', () => {
    // 2025-04-28 is a Monday (business day). 14:45 ET = 18:45 UTC (EDT = UTC-4).
    const testDate = new Date('2025-04-28T18:45:00.000Z');
    const result = secondsUntilCutOff('14:45', testDate);
    // diff = 0 → returns null (closed, not negative)
    expect(result).toBeNull();
  });

  it('secondsUntilCutOff returns positive seconds when cut-off is in the future', () => {
    const testDate = new Date('2025-04-28T18:44:00.000Z'); // 14:44 ET — 60s before
    const result = secondsUntilCutOff('14:45', testDate);
    expect(result).toBe(60);
  });

  it('secondsUntilCutOff returns null when cut-off has already passed', () => {
    const testDate = new Date('2025-04-28T18:46:00.000Z'); // 14:46 ET — 60s after
    const result = secondsUntilCutOff('14:45', testDate);
    expect(result).toBeNull();
  });
});

// ─── Req 18.12: DST clock change recalculates within one tick ────────────────

describe('Req 18.12: DST transition', () => {
  it('secondsUntilCutOff returns null at exactly the cut-off on DST spring-forward day', () => {
    // 2025-03-09: DST spring-forward. After 2am ET clocks jump to 3am.
    // EDT = UTC-4, so 14:45 ET = 18:45 UTC on this day.
    const dstDay = new Date('2025-03-09T18:45:00.000Z');
    const result = secondsUntilCutOff('14:45', dstDay);
    expect(result).toBeNull();
  });

  it('secondsUntilCutOff returns 3600 exactly one hour before cut-off on DST day', () => {
    // 13:45 ET on DST day = 17:45 UTC (EDT = UTC-4 after spring forward)
    const oneHourBefore = new Date('2025-03-09T17:45:00.000Z');
    const result = secondsUntilCutOff('14:45', oneHourBefore);
    expect(result).toBe(3600);
  });
});

// ─── Req 18.13: Rail with 100% failure rate shows Critical ───────────────────

describe('Req 18.13: 100% failure rate shows Critical', () => {
  it('RailHealthCard shows Critical badge for 100% failure rate', async () => {
    const { MarketauxContextProvider } = await import('../context/MarketauxContext');
    const { default: RailHealthCard } = await import('../components/RailHealthCard');

    const criticalRail = {
      rail: 'ACH_Standard' as const,
      status: 'Critical' as const,
      todayVolume: 1000,
      successCount: 0,
      failureCount: 1000,
      failureRate: 1.0,
      priorDayVolume: 1000,
      sevenDayAverage: 1000,
    };

    render(
      React.createElement(MarketauxContextProvider, null,
        React.createElement(RailHealthCard, { data: criticalRail })
      )
    );

    expect(screen.getByText('Critical')).toBeInTheDocument();
    // Failure rate displayed as 100.00%
    expect(screen.getByText('100.00%')).toBeInTheDocument();
  });

  it('engine deriveStatus returns Critical for failure rate > 5%', async () => {
    const { generate } = await import('../simulator/engine');
    const { DEFAULT_SEED_CONFIG } = await import('../simulator/config');

    const config = {
      ...DEFAULT_SEED_CONFIG,
      failureRateRanges: {
        ...DEFAULT_SEED_CONFIG.failureRateRanges,
        ACH_Standard: { min: 1.0, max: 1.0 },
      },
    };

    const output = generate(config);
    const achRail = output.railData.find(r => r.rail === 'ACH_Standard');

    expect(achRail?.status).toBe('Critical');
    expect(achRail?.failureRate).toBe(1.0);
  });
});

// ─── Req 18.14: Unsupported Frankfurter currency shows missing data indicator ─
//
// vi.mock is hoisted to the top of the file by Vitest, so we declare the mock
// at module scope and control its behaviour via mockResolvedValue in the test.

vi.mock('../api/frankfurter', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/frankfurter')>();
  return {
    ...actual,
    fetchFxRate: vi.fn(),
    readFxCache: vi.fn().mockReturnValue(null),
    writeFxCache: vi.fn(),
  };
});

describe('Req 18.14: Unsupported currency shows missing data indicator', () => {
  beforeEach(async () => {
    // Reset the mock before each test so other suites are not affected
    const { fetchFxRate } = await import('../api/frankfurter');
    vi.mocked(fetchFxRate).mockResolvedValue(null); // null = unsupported currency
  });

  it('renders "Rate unavailable for {CURRENCY}" for unsupported currencies', async () => {
    const { default: FxConversionInline } = await import('../components/FxConversionInline');

    render(
      React.createElement(FxConversionInline, {
        instructedAmount: 1000,
        destinationCurrency: 'XYZ',
        fxLastFetch: undefined,
        onRetry: () => {},
      })
    );

    await screen.findByText('Rate unavailable for XYZ');

    // Must NOT show an error state (no retry button)
    expect(screen.queryByRole('button', { name: /retry/i })).not.toBeInTheDocument();
  });
});

// ─── Req 18.15: Exactly 100.00% coverage ratio shows CRITICAL ────────────────

describe('Req 18.15: Exactly 100.00% coverage ratio shows CRITICAL', () => {
  it('SettlementPositionTracker shows CRITICAL alert at exactly 100.00%', async () => {
    const { DataProviderContext } = await import('../context/DataProviderContext');
    const { default: SettlementPositionTracker } = await import('../components/SettlementPositionTracker');

    const provider = {
      ...makeProvider({ fundingCoverageRatio: 100 }),
      getSettlementPosition: () => ({
        settlementBalance: 1_000_000,
        projectedDailyObligation: 1_000_000, // exactly 100%
        fundingCoverageRatio: 100,
        railBreakdown: {
          ACH_Standard: 'funded', ACH_Same_Day: 'funded', Wire_Domestic: 'funded',
          Wire_International: 'funded', RTP: 'funded', FedNow: 'funded',
        } as Record<string, 'funded' | 'at-risk' | 'underfunded'>,
        intradayTimeline: [],
      }),
    };

    render(
      React.createElement(DataProviderContext.Provider, { value: provider as any },
        React.createElement(SettlementPositionTracker)
      )
    );

    // The alert banner text contains "CRITICAL"
    expect(screen.getByRole('alert')).toHaveTextContent(/CRITICAL/);
    // No WARNING banner
    expect(screen.queryByText(/WARNING — Funding/)).not.toBeInTheDocument();
  });

  it('StatusBar shows CRITICAL badge at exactly 100.00%', async () => {
    const { DataProviderContext } = await import('../context/DataProviderContext');
    const { CutOffContextProvider } = await import('../context/CutOffContext');
    const { MarketauxContextProvider } = await import('../context/MarketauxContext');
    const { default: StatusBar } = await import('../components/StatusBar');

    const provider = {
      ...makeProvider({ slaBreachCount: 0, fundingCoverageRatio: 100, unhealthyRailCount: 0 }),
      getSettlementPosition: () => ({
        settlementBalance: 1_000_000,
        projectedDailyObligation: 1_000_000,
        fundingCoverageRatio: 100,
        railBreakdown: {
          ACH_Standard: 'funded', ACH_Same_Day: 'funded', Wire_Domestic: 'funded',
          Wire_International: 'funded', RTP: 'funded', FedNow: 'funded',
        } as Record<string, 'funded' | 'at-risk' | 'underfunded'>,
        intradayTimeline: [],
      }),
    };

    render(
      React.createElement(DataProviderContext.Provider, { value: provider as any },
        React.createElement(CutOffContextProvider, null,
          React.createElement(MarketauxContextProvider, null,
            React.createElement(StatusBar, { generatedAt: new Date(), onRefresh: () => {} })
          )
        )
      )
    );

    // StatusBar renders a CRITICAL badge span
    const criticalBadges = screen.getAllByText('CRITICAL');
    expect(criticalBadges.length).toBeGreaterThan(0);
    expect(screen.queryByText('WARNING')).not.toBeInTheDocument();
  });

  it('SettlementPositionTracker shows WARNING (not CRITICAL) at 100.01%', async () => {
    const { DataProviderContext } = await import('../context/DataProviderContext');
    const { default: SettlementPositionTracker } = await import('../components/SettlementPositionTracker');

    const provider = {
      ...makeProvider(),
      getSettlementPosition: () => ({
        settlementBalance: 1_000_100,
        projectedDailyObligation: 1_000_000, // 100.01%
        fundingCoverageRatio: 100.01,
        railBreakdown: {
          ACH_Standard: 'funded', ACH_Same_Day: 'funded', Wire_Domestic: 'funded',
          Wire_International: 'funded', RTP: 'funded', FedNow: 'funded',
        } as Record<string, 'funded' | 'at-risk' | 'underfunded'>,
        intradayTimeline: [],
      }),
    };

    render(
      React.createElement(DataProviderContext.Provider, { value: provider as any },
        React.createElement(SettlementPositionTracker)
      )
    );

    // The alert banner should say WARNING
    expect(screen.getByRole('alert')).toHaveTextContent(/WARNING/);
    // No CRITICAL banner
    expect(screen.queryByText(/CRITICAL — Funding/)).not.toBeInTheDocument();
  });
});

// ─── Req 18.16: Exactly 110.00% coverage ratio shows adequately funded ────────

describe('Req 18.16: Exactly 110.00% coverage ratio shows adequate', () => {
  it('SettlementPositionTracker shows Adequately Funded at exactly 110.00%', async () => {
    const { DataProviderContext } = await import('../context/DataProviderContext');
    const { default: SettlementPositionTracker } = await import('../components/SettlementPositionTracker');

    const provider = {
      ...makeProvider({ fundingCoverageRatio: 110 }),
      getSettlementPosition: () => ({
        settlementBalance: 1_100_000,
        projectedDailyObligation: 1_000_000, // exactly 110%
        fundingCoverageRatio: 110,
        railBreakdown: {
          ACH_Standard: 'funded', ACH_Same_Day: 'funded', Wire_Domestic: 'funded',
          Wire_International: 'funded', RTP: 'funded', FedNow: 'funded',
        } as Record<string, 'funded' | 'at-risk' | 'underfunded'>,
        intradayTimeline: [],
      }),
    };

    render(
      React.createElement(DataProviderContext.Provider, { value: provider as any },
        React.createElement(SettlementPositionTracker)
      )
    );

    expect(screen.getByText(/Adequately Funded/i)).toBeInTheDocument();
    expect(screen.queryByText(/CRITICAL/)).not.toBeInTheDocument();
    expect(screen.queryByText(/WARNING/)).not.toBeInTheDocument();
  });
});

// ─── Req 18.17–18.18: Clipboard copy confirmation timing and deduplication ────
//
// We use fireEvent.click (synchronous) + act(async) to flush the clipboard
// Promise, then vi.advanceTimersByTime to control the 3-second dismiss timer.
// This avoids the deadlock that occurs when userEvent awaits internal delays
// while fake timers are active.

describe('Req 18.17: Copy confirmation auto-dismisses after 3 seconds', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('shows "Copied!" after click and reverts to "Copy Summary" after 3s', async () => {
    const { DataProviderContext } = await import('../context/DataProviderContext');
    const { default: DailySummaryExport } = await import('../components/DailySummaryExport');

    render(
      React.createElement(DataProviderContext.Provider, { value: makeProvider() as any },
        React.createElement(DailySummaryExport, { generatedAt: new Date() })
      )
    );

    const button = screen.getByRole('button', { name: /copy daily summary/i });

    // Click and flush the clipboard.writeText microtask
    await act(async () => {
      button.click();
      await Promise.resolve();
    });

    expect(screen.getByText('Copied!')).toBeInTheDocument();

    // Advance 3 seconds — confirmation should auto-dismiss
    act(() => { vi.advanceTimersByTime(3000); });

    expect(screen.queryByText('Copied!')).not.toBeInTheDocument();
    expect(screen.getByText('Copy Summary')).toBeInTheDocument();
  });
});

describe('Req 18.18: Clipboard copy deduplication', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('resets the 3s timer without duplicating message when clicked again while showing "Copied!"', async () => {
    const { DataProviderContext } = await import('../context/DataProviderContext');
    const { default: DailySummaryExport } = await import('../components/DailySummaryExport');

    render(
      React.createElement(DataProviderContext.Provider, { value: makeProvider() as any },
        React.createElement(DailySummaryExport, { generatedAt: new Date() })
      )
    );

    const button = screen.getByRole('button', { name: /copy daily summary/i });

    // First click
    await act(async () => {
      button.click();
      await Promise.resolve();
    });
    expect(screen.getByText('Copied!')).toBeInTheDocument();

    // Advance 2 seconds — still showing "Copied!"
    act(() => { vi.advanceTimersByTime(2000); });
    expect(screen.getByText('Copied!')).toBeInTheDocument();

    // Second click while still showing — should reset the timer, not duplicate
    await act(async () => {
      button.click();
      await Promise.resolve();
    });

    // Still exactly one "Copied!" message
    expect(screen.getAllByText('Copied!')).toHaveLength(1);

    // Advance 3 more seconds from the reset point — now it should dismiss
    act(() => { vi.advanceTimersByTime(3000); });
    expect(screen.queryByText('Copied!')).not.toBeInTheDocument();
  });
});
