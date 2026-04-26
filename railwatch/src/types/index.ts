// ─── Core Type Aliases ───────────────────────────────────────────────────────

export type PaymentRail =
  | 'ACH_Standard'
  | 'ACH_Same_Day'
  | 'Wire_Domestic'
  | 'Wire_International'
  | 'RTP'
  | 'FedNow';

export type RailHealthStatus = 'Healthy' | 'Degraded' | 'Critical';

export type ReasonCodeNamespace = 'NACHA' | 'ISO20022' | 'SWIFT';

export type TransactionStatus = 'pending' | 'completed' | 'failed' | 'returned';

export type AlertSeverity = 'CRITICAL' | 'WARNING' | 'INFO';

export type FetchState = 'idle' | 'loading' | 'success' | 'error';

export type ApiErrorType = 'timeout' | 'network' | 'malformed';

// ─── Transaction ─────────────────────────────────────────────────────────────

export interface Transaction {
  transactionId: string;           // UUID
  endToEndId: string;              // ISO 20022 pacs.008 end-to-end identifier
  rail: PaymentRail;
  amount: number;                  // USD decimal
  instructedAmount: number;        // original amount before FX
  destinationCurrency?: string;    // ISO 4217, required for Wire_International
  status: TransactionStatus;
  reasonCode: string | null;
  reasonCodeNamespace: ReasonCodeNamespace | null;
  createdAt: string;               // ISO 8601
  openedAt: string;                // ISO 8601, set when exception is created
  settlementDate: string;          // ISO 8601 date
}

// ─── ExceptionGroup ──────────────────────────────────────────────────────────

export interface ExceptionGroup {
  rail: PaymentRail;
  reasonCode: string;
  reasonCodeNamespace: ReasonCodeNamespace;
  count: number;
  dollarExposure: number;
  oldestOpenedAt: string;          // ISO 8601 — drives SLA calculation
  transactions: Transaction[];
}

// ─── RailData ────────────────────────────────────────────────────────────────

export interface RailData {
  rail: PaymentRail;
  status: RailHealthStatus;
  todayVolume: number;
  successCount: number;
  failureCount: number;
  failureRate: number;             // 0–1
  priorDayVolume: number;
  sevenDayAverage: number;
}

// ─── Settlement ──────────────────────────────────────────────────────────────

export interface IntradayTimelineEntry {
  hour: number;                    // 8–18 (8am–6pm ET)
  projectedObligation: number;
  settledToDate: number;
}

export interface SettlementPosition {
  settlementBalance: number;           // USD
  projectedDailyObligation: number;    // USD
  fundingCoverageRatio: number;        // percentage, e.g. 112.5
  railBreakdown: Record<PaymentRail, 'funded' | 'at-risk' | 'underfunded'>;
  intradayTimeline: IntradayTimelineEntry[];
}

// ─── Cut-Off Times ───────────────────────────────────────────────────────────

export interface CutOffWindow {
  label: string;
  timeET: string;                  // HH:MM 24-hour format, e.g. "14:45"
  status: 'upcoming' | 'active' | 'closed';
  secondsRemaining: number | null; // null when closed
}

export interface CutOffTime {
  rail: PaymentRail;
  windows: CutOffWindow[];
}

export interface CutOffSummary {
  nextRail: PaymentRail | null;
  nextWindowLabel: string | null;
  secondsRemaining: number | null; // null = all clear
}

// ─── Historical Volumes ──────────────────────────────────────────────────────

export interface HistoricalVolumeEntry {
  date: string;                    // ISO 8601 date
  isBusinessDay: boolean;
  volumes: Record<PaymentRail, number>;
  closingExceptionCounts: Record<PaymentRail, number>;
}

// ─── Simulator ───────────────────────────────────────────────────────────────

export interface SimulatorSeedConfig {
  institutionName: string;
  assetSizeUSD: number;
  railVolumeRanges: Record<PaymentRail, { min: number; max: number }>;
  failureRateRanges: Record<PaymentRail, { min: number; max: number }>;
  exceptionCountRange: { min: number; max: number };
  settlementPositionRange: { min: number; max: number };
}

export interface SimulatorOutput {
  railData: RailData[];
  exceptionQueue: ExceptionGroup[];
  settlementPosition: SettlementPosition;
  historicalVolumes: HistoricalVolumeEntry[];
  priorDayClosingExceptions: Record<PaymentRail, number>;
}

// ─── DataProvider Interface ───────────────────────────────────────────────────

export interface DataProvider {
  getRailData(): RailData[];
  getExceptionQueue(): ExceptionGroup[];
  getSettlementPosition(): SettlementPosition;
  getHistoricalVolumes(days: number): HistoricalVolumeEntry[];
  getPriorDayClosingExceptions(): Record<PaymentRail, number>;
}

// ─── FRED API ────────────────────────────────────────────────────────────────

export interface FredIndicatorData {
  currentRate: number;             // most recent observation value
  currentDate: string;             // ISO 8601 date of most recent observation
  priorRate: number;               // second most recent observation value
  priorDate: string;               // ISO 8601 date of prior observation
  momChange: number;               // currentRate - priorRate, rounded to 2dp
  fetchedAt: string;               // ISO 8601 timestamp of successful fetch
}

// ─── Frankfurter FX API ──────────────────────────────────────────────────────

export interface FxRate {
  fromCurrency: string;            // "USD"
  toCurrency: string;              // ISO 4217
  rate: number;                    // e.g. 0.9234
  date: string;                    // ISO 8601 date from API
  fetchedAt: string;               // ISO 8601 timestamp
}

export interface FxCacheEntry {
  rate: FxRate;
  fetchedAt: number;               // Date.now()
}

// ─── Marketaux News API ──────────────────────────────────────────────────────

export interface NewsArticle {
  id: string;
  headline: string;
  source: string;
  publishedAt: string;             // ISO 8601
  sentimentScore: number;          // average of entity sentiment scores, or 0 if none
  sentimentLabel: 'Positive' | 'Neutral' | 'Negative';
}

export interface MarketauxCache {
  articles: NewsArticle[];
  fetchedAt: string;               // ISO 8601
}
