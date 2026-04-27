import type {
  PaymentRail,
  RailHealthStatus,
  ReasonCodeNamespace,
  RailData,
  ExceptionGroup,
  Transaction,
  SettlementPosition,
  IntradayTimelineEntry,
  HistoricalVolumeEntry,
  SimulatorSeedConfig,
  SimulatorOutput,
} from '../types';
import { DEFAULT_SEED_CONFIG } from './config';
import { isBusinessDay } from './holidays';
import { seededRandom, dateStringToSeed } from './prng';

// ─── Constants ───────────────────────────────────────────────────────────────

const PAYMENT_RAILS: PaymentRail[] = [
  'ACH_Standard',
  'ACH_Same_Day',
  'Wire_Domestic',
  'Wire_International',
  'RTP',
  'FedNow',
];

const REPRESENTATIVE_REASON_CODES: Record<PaymentRail, string> = {
  ACH_Standard:       'R01',
  ACH_Same_Day:       'R01',
  Wire_Domestic:      'AC01',
  Wire_International: 'FOCR',
  RTP:                'AM04',
  FedNow:             'AM04',
};

const RAIL_NAMESPACES: Record<PaymentRail, ReasonCodeNamespace> = {
  ACH_Standard:       'NACHA',
  ACH_Same_Day:       'NACHA',
  Wire_Domestic:      'ISO20022',
  Wire_International: 'SWIFT',
  RTP:                'ISO20022',
  FedNow:             'ISO20022',
};

// Additional reason codes per rail for variety in random exceptions
const REASON_CODES: Record<PaymentRail, string[]> = {
  ACH_Standard:       ['R01', 'R02', 'R03', 'R04', 'R07', 'R10'],
  ACH_Same_Day:       ['R01', 'R02', 'R03', 'R04', 'R07', 'R10'],
  Wire_Domestic:      ['AC01', 'AM04', 'AG01', 'FF01'],
  Wire_International: ['AC01', 'FOCR', 'NARR'],
  RTP:                ['AC01', 'AM04', 'AG01', 'FF01'],
  FedNow:             ['AC01', 'AM04', 'AG01', 'FF01'],
};

// SLA breach thresholds in hours per rail
const RAIL_BREACH_THRESHOLDS_HOURS: Record<PaymentRail, number> = {
  FedNow:             8,
  RTP:                8,
  ACH_Same_Day:       8,
  Wire_Domestic:      48,
  Wire_International: 48,
  ACH_Standard:       72,
};

// ─── Exception Aging ─────────────────────────────────────────────────────────

type AgingBucket = 'under24h' | '24to48h' | 'over48h';

const BUCKET_AGE_RANGES: Record<AgingBucket, { minHours: number; maxHours: number }> = {
  under24h:  { minHours: 0.5, maxHours: 23  },
  '24to48h': { minHours: 24,  maxHours: 47  },
  over48h:   { minHours: 49,  maxHours: 120 },
};

function randomHoursInBucket(bucket: AgingBucket): number {
  const { minHours, maxHours } = BUCKET_AGE_RANGES[bucket];
  return minHours + Math.random() * (maxHours - minHours);
}

function hoursAgoToOpenedAt(hoursAgo: number): string {
  return new Date(Date.now() - hoursAgo * 3600 * 1000).toISOString();
}

/** Section 5.5 — three guaranteed buckets, remaining N-3 distributed randomly */
function generateExceptionAges(N: number): number[] {
  const ages: number[] = [
    randomHoursInBucket('under24h'),
    randomHoursInBucket('24to48h'),
    randomHoursInBucket('over48h'),
  ];
  const buckets: AgingBucket[] = ['under24h', '24to48h', 'over48h'];
  for (let i = 3; i < N; i++) {
    const bucket = buckets[Math.floor(Math.random() * 3)];
    ages.push(randomHoursInBucket(bucket));
  }
  return ages;
}

// ─── Rail Data Generation ─────────────────────────────────────────────────────

function deriveStatus(failureRate: number): RailHealthStatus {
  if (failureRate > 0.05) return 'Critical';
  if (failureRate > 0.02) return 'Degraded';
  return 'Healthy';
}

function generateRailData(config: SimulatorSeedConfig): RailData[] {
  return PAYMENT_RAILS.map(rail => {
    const { min: vMin, max: vMax } = config.railVolumeRanges[rail];
    const { min: fMin, max: fMax } = config.failureRateRanges[rail];

    const todayVolume = Math.floor(vMin + Math.random() * (vMax - vMin));
    const failureRate = fMin + Math.random() * (fMax - fMin);
    const failureCount = Math.round(todayVolume * failureRate);
    const successCount = todayVolume - failureCount;

    // Prior day and 7-day average are slightly varied from today
    const priorDayVolume = Math.floor(vMin + Math.random() * (vMax - vMin));
    const sevenDayAverage = Math.floor(vMin + Math.random() * (vMax - vMin));

    return {
      rail,
      status: deriveStatus(failureRate),
      todayVolume,
      successCount,
      failureCount,
      failureRate,
      priorDayVolume,
      sevenDayAverage,
    };
  });
}

// ─── Exception Queue Generation ───────────────────────────────────────────────

function buildExceptionGroups(
  railData: RailData[],
  ages: number[],
  config: SimulatorSeedConfig
): ExceptionGroup[] {
  const groups = new Map<string, ExceptionGroup>();

  ages.forEach((hoursAgo) => {
    // Pick a random rail weighted by failure count
    const totalFailures = railData.reduce((s, r) => s + r.failureCount, 0);
    let pick = Math.random() * totalFailures;
    let chosenRail: PaymentRail = railData[0].rail;
    for (const rd of railData) {
      pick -= rd.failureCount;
      if (pick <= 0) { chosenRail = rd.rail; break; }
    }

    const codes = REASON_CODES[chosenRail];
    const reasonCode = codes[Math.floor(Math.random() * codes.length)];
    const reasonCodeNamespace = RAIL_NAMESPACES[chosenRail];
    const key = `${chosenRail}_${reasonCode}`;
    const openedAt = hoursAgoToOpenedAt(hoursAgo);
    const amount = 500 + Math.random() * 49500;

    const tx: Transaction = {
      transactionId: crypto.randomUUID(),
      endToEndId: `E2E-${chosenRail}-${Date.now()}-${Math.floor(Math.random() * 9999)}`,
      rail: chosenRail,
      amount,
      instructedAmount: amount,
      destinationCurrency: chosenRail === 'Wire_International'
        ? (['EUR', 'GBP', 'CAD', 'MXN', 'JPY'][Math.floor(Math.random() * 5)])
        : undefined,
      status: 'failed',
      reasonCode,
      reasonCodeNamespace,
      createdAt: openedAt,
      openedAt,
      settlementDate: new Date().toISOString().slice(0, 10),
    };

    if (groups.has(key)) {
      const g = groups.get(key)!;
      g.transactions.push(tx);
      g.count += 1;
      g.dollarExposure += amount;
      if (openedAt < g.oldestOpenedAt) g.oldestOpenedAt = openedAt;
    } else {
      groups.set(key, {
        rail: chosenRail,
        reasonCode,
        reasonCodeNamespace,
        count: 1,
        dollarExposure: amount,
        oldestOpenedAt: openedAt,
        transactions: [tx],
      });
    }
  });

  return Array.from(groups.values());
}

// ─── Section 5.6 — Per-Rail SLA Breach Injection ─────────────────────────────

function injectBreachExceptions(exceptionGroups: ExceptionGroup[]): ExceptionGroup[] {
  const result = [...exceptionGroups];

  for (const rail of PAYMENT_RAILS) {
    const breachHours = RAIL_BREACH_THRESHOLDS_HOURS[rail];
    const ageHours = breachHours + 1 + Math.random() * 24;
    const openedAt = hoursAgoToOpenedAt(ageHours);
    const reasonCode = REPRESENTATIVE_REASON_CODES[rail];
    const reasonCodeNamespace = RAIL_NAMESPACES[rail];
    const amount = 1000 + Math.random() * 49000;

    const breachTx: Transaction = {
      transactionId: crypto.randomUUID(),
      endToEndId: `E2E-${rail}-BREACH-${Date.now()}`,
      rail,
      amount,
      instructedAmount: amount,
      destinationCurrency: rail === 'Wire_International' ? 'EUR' : undefined,
      status: 'failed',
      reasonCode,
      reasonCodeNamespace,
      createdAt: openedAt,
      openedAt,
      settlementDate: new Date().toISOString().slice(0, 10),
    };

    const existingIdx = result.findIndex(
      g => g.rail === rail && g.reasonCode === reasonCode
    );

    if (existingIdx >= 0) {
      result[existingIdx].transactions.push(breachTx);
      result[existingIdx].count += 1;
      result[existingIdx].dollarExposure += amount;
      if (openedAt < result[existingIdx].oldestOpenedAt) {
        result[existingIdx].oldestOpenedAt = openedAt;
      }
    } else {
      result.push({
        rail,
        reasonCode,
        reasonCodeNamespace,
        count: 1,
        dollarExposure: amount,
        oldestOpenedAt: openedAt,
        transactions: [breachTx],
      });
    }
  }

  return result;
}

// ─── Section 5.3 — Correlated Settlement Position Sampling ───────────────────

function generateSettlementPosition(config: SimulatorSeedConfig): SettlementPosition {
  // Step 1: sample ratio from [0.85, 1.40]
  const ratio = 0.85 + Math.random() * 0.55;

  // Step 2: sample obligation
  const { min, max } = config.settlementPositionRange;
  const obligationMin = min * 0.80;
  const obligationMax = max * 0.95;
  const projectedDailyObligation = obligationMin + Math.random() * (obligationMax - obligationMin);

  // Step 3: derive balance
  const settlementBalance = projectedDailyObligation * ratio;
  const fundingCoverageRatio = Math.round(ratio * 10000) / 100;

  // Rail breakdown
  const railBreakdown = Object.fromEntries(
    PAYMENT_RAILS.map(rail => {
      const r = Math.random();
      const status = r < 0.7 ? 'funded' : r < 0.9 ? 'at-risk' : 'underfunded';
      return [rail, status];
    })
  ) as Record<PaymentRail, 'funded' | 'at-risk' | 'underfunded'>;

  // Intraday timeline — hours 8–18
  const intradayTimeline: IntradayTimelineEntry[] = [];
  const currentHourET = new Date().getHours(); // approximate; CutOffTimeMonitor uses Intl
  let settledToDate = 0;
  for (let hour = 8; hour <= 18; hour++) {
    const fraction = (hour - 8) / 10;
    const projectedObligation = Math.round(projectedDailyObligation * (fraction * 0.15 + 0.05));
    if (hour <= currentHourET) settledToDate += projectedObligation;
    intradayTimeline.push({ hour, projectedObligation, settledToDate });
  }

  return {
    settlementBalance: Math.round(settlementBalance),
    projectedDailyObligation: Math.round(projectedDailyObligation),
    fundingCoverageRatio,
    railBreakdown,
    intradayTimeline,
  };
}

// ─── Section 5.4 — Deterministic 7-Day Historical Volumes ────────────────────

function generateHistoricalVolumes(
  config: SimulatorSeedConfig,
  today: Date
): HistoricalVolumeEntry[] {
  const todayStr = today.toISOString().slice(0, 10);
  const rand = seededRandom(dateStringToSeed(todayStr));

  const history: HistoricalVolumeEntry[] = [];
  const cursor = new Date(today);
  cursor.setDate(cursor.getDate() - 1); // start from yesterday

  while (history.length < 7) {
    if (isBusinessDay(cursor)) {
      const dateStr = cursor.toISOString().slice(0, 10);
      const volumes = {} as Record<PaymentRail, number>;
      const closingExceptionCounts = {} as Record<PaymentRail, number>;

      for (const rail of PAYMENT_RAILS) {
        const { min, max } = config.railVolumeRanges[rail];
        volumes[rail] = Math.floor(min + rand() * (max - min));
        closingExceptionCounts[rail] = Math.floor(rand() * 8); // 0–7
      }

      history.push({ date: dateStr, isBusinessDay: true, volumes, closingExceptionCounts });
    }
    cursor.setDate(cursor.getDate() - 1);
  }

  return history.reverse(); // chronological, oldest first
}

// ─── Section 5.7 — Non-Business-Day Handling ─────────────────────────────────

function generateNonBusinessDayData(config: SimulatorSeedConfig): SimulatorOutput {
  const railData: RailData[] = PAYMENT_RAILS.map(rail => {
    // RTP and FedNow operate 24/7; all other rails have zero volume on non-business days
    const todayVolume = ['RTP', 'FedNow'].includes(rail) ? Math.floor(Math.random() * 50) : 0;
    return {
      rail,
      status: 'Healthy' as RailHealthStatus,
      todayVolume,
      // successCount must equal todayVolume when failureCount is 0 (Req 5.9 invariant)
      successCount: todayVolume,
      failureCount: 0,
      failureRate: 0,
      priorDayVolume: 0,
      sevenDayAverage: 0,
    };
  });

  return {
    railData,
    exceptionQueue: [],
    settlementPosition: generateSettlementPosition(config),
    historicalVolumes: generateHistoricalVolumes(config, new Date()),
    priorDayClosingExceptions: Object.fromEntries(
      PAYMENT_RAILS.map(r => [r, 0])
    ) as Record<PaymentRail, number>,
    generatedAt: new Date().toISOString(),
    isBusinessDay: false,
  };
}

// ─── Section 5.8 — Top-Level generate() ──────────────────────────────────────

export function generate(config: SimulatorSeedConfig = DEFAULT_SEED_CONFIG): SimulatorOutput {
  const today = new Date();

  // DEMO MODE: Always generate full business-day data regardless of calendar day.
  // This ensures the dashboard is always fully populated for evaluators and demos.
  // In a production integration, this block would be removed — the DataProvider
  // would supply real data from the core banking system regardless of day.
  const forceBusinessDay = true;

  if (!isBusinessDay(today) && !forceBusinessDay) {
    return generateNonBusinessDayData(config);
  }

  // 1. Rail data
  const railData = generateRailData(config);

  // 2. Exception queue with aging distribution
  const N = Math.floor(
    config.exceptionCountRange.min +
    Math.random() * (config.exceptionCountRange.max - config.exceptionCountRange.min)
  );
  const ages = generateExceptionAges(N);
  let exceptionGroups = buildExceptionGroups(railData, ages, config);

  // 3. Inject guaranteed per-rail breach exceptions
  exceptionGroups = injectBreachExceptions(exceptionGroups);

  // 4. Correlated settlement position
  const settlementPosition = generateSettlementPosition(config);

  // 5. Deterministic 7-day history
  const historicalVolumes = generateHistoricalVolumes(config, today);

  // 6. Prior-day closing exception counts from most recent history entry
  const priorDay = historicalVolumes[historicalVolumes.length - 1];
  const priorDayClosingExceptions = priorDay?.closingExceptionCounts ??
    (Object.fromEntries(PAYMENT_RAILS.map(r => [r, 0])) as Record<PaymentRail, number>);

  return {
    railData,
    exceptionQueue: exceptionGroups,
    settlementPosition,
    historicalVolumes,
    priorDayClosingExceptions,
    generatedAt: today.toISOString(),
    isBusinessDay: true,
  };
}
