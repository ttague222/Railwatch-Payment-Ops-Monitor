import { describe, it, expect } from 'vitest';
import { generate } from '../simulator/engine';
import { DEFAULT_SEED_CONFIG } from '../simulator/config';

describe('Simulator smoke test', () => {
  it('generates data for all 6 payment rails', () => {
    const output = generate(DEFAULT_SEED_CONFIG);
    expect(output.railData).toHaveLength(6);
  });

  it('every rail has a valid health status', () => {
    const output = generate(DEFAULT_SEED_CONFIG);
    const validStatuses = ['Healthy', 'Degraded', 'Critical'];
    for (const rail of output.railData) {
      expect(validStatuses).toContain(rail.status);
    }
  });

  it('exception queue is non-empty and all groups have dollar exposure > 0', () => {
    const output = generate(DEFAULT_SEED_CONFIG);
    expect(output.exceptionQueue.length).toBeGreaterThan(0);
    for (const group of output.exceptionQueue) {
      expect(group.dollarExposure).toBeGreaterThan(0);
    }
  });

  it('settlement position has a positive balance and obligation', () => {
    const output = generate(DEFAULT_SEED_CONFIG);
    expect(output.settlementPosition.settlementBalance).toBeGreaterThan(0);
    expect(output.settlementPosition.projectedDailyObligation).toBeGreaterThan(0);
  });
});
