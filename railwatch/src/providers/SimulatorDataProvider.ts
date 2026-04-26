import type {
  DataProvider,
  RailData,
  ExceptionGroup,
  SettlementPosition,
  HistoricalVolumeEntry,
  PaymentRail,
  SimulatorSeedConfig,
  SimulatorOutput,
} from '../types';
import { DEFAULT_SEED_CONFIG } from '../simulator/config';
import { generate } from '../simulator/engine';

/**
 * Demo Mode implementation of DataProvider.
 * Wraps the Simulator's generate() function and exposes the result
 * through the DataProvider interface.
 *
 * No component other than SimulatorDataProvider may import from src/simulator/.
 */
export class SimulatorDataProvider implements DataProvider {
  private data: SimulatorOutput;

  constructor(seedConfig: SimulatorSeedConfig = DEFAULT_SEED_CONFIG) {
    this.data = generate(seedConfig);
  }

  getRailData(): RailData[] {
    return this.data.railData;
  }

  getExceptionQueue(): ExceptionGroup[] {
    return this.data.exceptionQueue;
  }

  getSettlementPosition(): SettlementPosition {
    return this.data.settlementPosition;
  }

  getHistoricalVolumes(days: number): HistoricalVolumeEntry[] {
    return this.data.historicalVolumes.slice(-days);
  }

  getPriorDayClosingExceptions(): Record<PaymentRail, number> {
    return this.data.priorDayClosingExceptions;
  }
}
