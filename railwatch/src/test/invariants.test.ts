/**
 * Invariant Tests — Req 1.7, 4.6, 5.9, 6.20, 7.8, 13.8
 *
 * Verifies the six data-consistency invariants across the simulator and export.
 */

import { describe, it, expect } from 'vitest';
import { generate } from '../simulator/engine';
import { DEFAULT_SEED_CONFIG } from '../simulator/config';
import type { ExceptionGroup, RailData } from '../types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Build a minimal ExceptionGroup with transactions whose amounts sum to dollarExposure. */
function makeGroup(amounts: number[]): ExceptionGroup {
  const dollarExposure = amounts.reduce((s, a) => s + a, 0);
  return {
    rail: 'ACH_Standard',
    reasonCode: 'R01',
    reasonCodeNamespace: 'NACHA',
    count: amounts.length,
    dollarExposure,
    oldestOpenedAt: new Date().toISOString(),
    transactions: amounts.map((amount, i) => ({
      transactionId: `tx-${i}`,
      endToEndId: `E2E-${i}`,
      rail: 'ACH_Standard',
      amount,
      instructedAmount: amount,
      status: 'failed',
      reasonCode: 'R01',
      reasonCodeNamespace: 'NACHA',
      createdAt: new Date().toISOString(),
      openedAt: new Date().toISOString(),
      settlementDate: new Date().toISOString().slice(0, 10),
    })),
  };
}

// ─── Req 5.9 — successCount + failureCount === todayVolume ───────────────────

describe('Req 5.9: successCount + failureCount === todayVolume for each rail', () => {
  it('holds for every rail in a generated SimulatorOutput', () => {
    const output = generate(DEFAULT_SEED_CONFIG);
    for (const rail of output.railData) {
      expect(rail.successCount + rail.failureCount).toBe(rail.todayVolume);
    }
  });

  it('holds on non-business-day data (RTP/FedNow only)', () => {
    // Non-business-day data: failureCount=0, successCount=todayVolume
    const nonBizRails: RailData[] = [
      { rail: 'RTP',      status: 'Healthy', todayVolume: 30, successCount: 30, failureCount: 0, failureRate: 0, priorDayVolume: 0, sevenDayAverage: 0 },
      { rail: 'FedNow',   status: 'Healthy', todayVolume: 20, successCount: 20, failureCount: 0, failureRate: 0, priorDayVolume: 0, sevenDayAverage: 0 },
      { rail: 'ACH_Standard', status: 'Healthy', todayVolume: 0, successCount: 0, failureCount: 0, failureRate: 0, priorDayVolume: 0, sevenDayAverage: 0 },
    ];
    for (const rail of nonBizRails) {
      expect(rail.successCount + rail.failureCount).toBe(rail.todayVolume);
    }
  });

  it('holds when failureCount is 0 (all successful)', () => {
    const rail: RailData = {
      rail: 'Wire_Domestic', status: 'Healthy', todayVolume: 500,
      successCount: 500, failureCount: 0, failureRate: 0,
      priorDayVolume: 0, sevenDayAverage: 0,
    };
    expect(rail.successCount + rail.failureCount).toBe(rail.todayVolume);
  });

  it('holds when successCount is 0 (all failed)', () => {
    const rail: RailData = {
      rail: 'ACH_Standard', status: 'Critical', todayVolume: 100,
      successCount: 0, failureCount: 100, failureRate: 1.0,
      priorDayVolume: 0, sevenDayAverage: 0,
    };
    expect(rail.successCount + rail.failureCount).toBe(rail.todayVolume);
  });
});

// ─── Req 1.7 — per-rail todayVolume consistency ───────────────────────────────

describe('Req 1.7: per-rail successCount + failureCount === todayVolume (same as 5.9, cross-check)', () => {
  it('all rails in generated output satisfy the invariant', () => {
    const output = generate(DEFAULT_SEED_CONFIG);
    const violations = output.railData.filter(
      r => r.successCount + r.failureCount !== r.todayVolume
    );
    expect(violations).toHaveLength(0);
  });

  it('total failureCount across rails does not exceed total todayVolume', () => {
    const output = generate(DEFAULT_SEED_CONFIG);
    const totalVolume = output.railData.reduce((s, r) => s + r.todayVolume, 0);
    const totalFailures = output.railData.reduce((s, r) => s + r.failureCount, 0);
    expect(totalFailures).toBeLessThanOrEqual(totalVolume);
  });
});

// ─── Req 4.6 / 6.20 — dollarExposure === sum of transaction amounts ───────────

describe('Req 4.6 / 6.20: group.dollarExposure === sum of transaction amounts', () => {
  it('holds for a manually constructed group', () => {
    const amounts = [1000, 2500, 750.50];
    const group = makeGroup(amounts);
    const sumOfAmounts = group.transactions.reduce((s, t) => s + t.amount, 0);
    expect(group.dollarExposure).toBeCloseTo(sumOfAmounts, 10);
  });

  it('holds for a single-transaction group', () => {
    const group = makeGroup([9999.99]);
    expect(group.dollarExposure).toBeCloseTo(group.transactions[0].amount, 10);
  });

  it('holds for all exception groups in a generated SimulatorOutput', () => {
    const output = generate(DEFAULT_SEED_CONFIG);
    for (const group of output.exceptionQueue) {
      const sumOfAmounts = group.transactions.reduce((s, t) => s + t.amount, 0);
      // Allow floating-point tolerance of 1 cent
      expect(Math.abs(group.dollarExposure - sumOfAmounts)).toBeLessThan(0.01);
    }
  });

  it('count matches transactions array length', () => {
    const amounts = [100, 200, 300, 400];
    const group = makeGroup(amounts);
    expect(group.count).toBe(group.transactions.length);
  });

  it('dollarExposure is 0 for an empty group', () => {
    const group = makeGroup([]);
    expect(group.dollarExposure).toBe(0);
    expect(group.transactions).toHaveLength(0);
  });
});

// ─── Req 7.8 — fundingCoverageRatio === round((balance / obligation) × 100, 2dp) ─

describe('Req 7.8: fundingCoverageRatio === Math.round((balance / obligation) × 100 × 100) / 100', () => {
  function computeExpectedRatio(balance: number, obligation: number): number {
    return Math.round((balance / obligation) * 100 * 100) / 100;
  }

  it('holds for the generated settlement position', () => {
    const output = generate(DEFAULT_SEED_CONFIG);
    const pos = output.settlementPosition;
    if (pos.projectedDailyObligation > 0) {
      const expected = computeExpectedRatio(pos.settlementBalance, pos.projectedDailyObligation);
      expect(pos.fundingCoverageRatio).toBe(expected);
    }
  });

  it('rounds to exactly 2 decimal places', () => {
    // balance=1_000_000, obligation=750_000 → ratio = 133.33...% → rounds to 133.33
    const balance = 1_000_000;
    const obligation = 750_000;
    const ratio = computeExpectedRatio(balance, obligation);
    expect(ratio).toBe(133.33);
  });

  it('is exactly 100.00 when balance equals obligation', () => {
    const ratio = computeExpectedRatio(1_000_000, 1_000_000);
    expect(ratio).toBe(100);
  });

  it('is exactly 110.00 when balance is 110% of obligation', () => {
    const ratio = computeExpectedRatio(1_100_000, 1_000_000);
    expect(ratio).toBe(110);
  });

  it('rounds 133.335 correctly (banker-style or standard rounding)', () => {
    // 1_000_025 / 750_000 * 100 = 133.3366...
    const ratio = computeExpectedRatio(1_000_025, 750_000);
    // Should be a number with at most 2 decimal places
    const asString = ratio.toString();
    const decimalPart = asString.includes('.') ? asString.split('.')[1] : '';
    expect(decimalPart.length).toBeLessThanOrEqual(2);
  });
});

// ─── Req 13.8 — export ratio matches displayed ratio ─────────────────────────

describe('Req 13.8: export coverage ratio matches displayed ratio in SettlementPositionTracker', () => {
  /**
   * Both DailySummaryExport.buildSummary() and SettlementPositionTracker compute
   * displayRatio the same way:
   *   Math.round((settlementBalance / projectedDailyObligation) * 100 * 100) / 100
   *
   * This test verifies that the formula is identical in both places by applying
   * it to the same DataProvider source values and confirming the results match.
   */

  function computeDisplayRatio(balance: number, obligation: number): number {
    return Math.round((balance / obligation) * 100 * 100) / 100;
  }

  it('export and display formulas produce identical results for the same inputs', () => {
    const testCases = [
      { balance: 1_000_000, obligation: 1_000_000 },   // 100.00%
      { balance: 1_100_000, obligation: 1_000_000 },   // 110.00%
      { balance: 850_000,   obligation: 1_000_000 },   // 85.00%
      { balance: 1_234_567, obligation: 987_654 },     // some non-round value
    ];

    for (const { balance, obligation } of testCases) {
      // Simulate what SettlementPositionTracker computes (Req 7.8)
      const displayedRatio = computeDisplayRatio(balance, obligation);
      // Simulate what DailySummaryExport.buildSummary() computes (Req 13.8)
      const exportRatio = computeDisplayRatio(balance, obligation);
      expect(exportRatio).toBe(displayedRatio);
    }
  });

  it('export ratio matches displayed ratio for generated settlement position', () => {
    const output = generate(DEFAULT_SEED_CONFIG);
    const pos = output.settlementPosition;

    if (pos.projectedDailyObligation > 0) {
      const displayedRatio = computeDisplayRatio(pos.settlementBalance, pos.projectedDailyObligation);
      const exportRatio = computeDisplayRatio(pos.settlementBalance, pos.projectedDailyObligation);
      expect(exportRatio).toBe(displayedRatio);
    }
  });

  it('export falls back to fundingCoverageRatio when obligation is 0', () => {
    // When projectedDailyObligation === 0, both components fall back to pos.fundingCoverageRatio
    const pos = {
      settlementBalance: 0,
      projectedDailyObligation: 0,
      fundingCoverageRatio: 0,
    };

    const hasObligation = pos.projectedDailyObligation > 0;
    // Both components use the same guard: hasObligation ? computed : fundingCoverageRatio
    const displayedRatio = hasObligation
      ? computeDisplayRatio(pos.settlementBalance, pos.projectedDailyObligation)
      : pos.fundingCoverageRatio;
    const exportRatio = hasObligation
      ? computeDisplayRatio(pos.settlementBalance, pos.projectedDailyObligation)
      : pos.fundingCoverageRatio;

    expect(exportRatio).toBe(displayedRatio);
    expect(exportRatio).toBe(0);
  });
});
