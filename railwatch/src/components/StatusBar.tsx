import { memo, useState, useCallback, useMemo } from 'react';
import type { PaymentRail } from '../types';
import { useDataProvider } from '../context/DataProviderContext';
import { useCutOffSummary } from '../context/CutOffContext';
import { formatPercent } from '../utils/format';

// ─── SLA breach detection (mirrors ExceptionQueueMonitor logic) ───────────────

const BREACH_HOURS: Record<PaymentRail, number> = {
  FedNow: 8, RTP: 8, ACH_Same_Day: 8,
  Wire_Domestic: 48, Wire_International: 48,
  ACH_Standard: 72,
};

function isBreached(rail: PaymentRail, openedAt: string): boolean {
  const breachMs = BREACH_HOURS[rail] * 60 * 60 * 1000;
  return Date.now() - new Date(openedAt).getTime() > breachMs;
}

// ─── Countdown formatter ──────────────────────────────────────────────────────

function formatCountdown(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  return `${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface StatusBarProps {
  generatedAt: Date;
  onRefresh: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

const StatusBar = memo(function StatusBar({ generatedAt, onRefresh }: StatusBarProps) {
  const dp = useDataProvider();
  const cutOffSummary = useCutOffSummary();
  const [refreshing, setRefreshing] = useState(false);

  // ── Signal 1: SLA breach count ─────────────────────────────────────────────
  const slaBreachCount = useMemo(() => {
    const groups = dp.getExceptionQueue();
    return groups.filter(g => isBreached(g.rail, g.oldestOpenedAt)).length;
  }, [dp]);

  // ── Signal 2: Funding coverage ratio ──────────────────────────────────────
  // Recompute from balance/obligation (same formula as SettlementPositionTracker and
  // DailySummaryExport) so all three components display the identical value (Req 13.8).
  const { settlementBalance, projectedDailyObligation, fundingCoverageRatio: rawRatio } = dp.getSettlementPosition();
  const hasObligation = projectedDailyObligation > 0;
  const fundingCoverageRatio = hasObligation
    ? Math.round((settlementBalance / projectedDailyObligation) * 100 * 100) / 100
    : rawRatio;

  // ── Signal 3: Degraded + Critical rail count ───────────────────────────────
  const unhealthyRailCount = useMemo(() => {
    return dp.getRailData().filter(r => r.status !== 'Healthy').length;
  }, [dp]);

  // ── Signal 4: Cut-off countdown (from CutOffContext) ──────────────────────
  // "All Clear" when secondsRemaining is null OR > 7200s (2 hours)
  const cutOffWithin2h =
    cutOffSummary.secondsRemaining !== null &&
    cutOffSummary.secondsRemaining <= 7200;

  // ── "All Systems Normal" condition (Req 2.4) ───────────────────────────────
  const allNormal =
    slaBreachCount === 0 &&
    fundingCoverageRatio >= 110 &&
    unhealthyRailCount === 0 &&
    !cutOffWithin2h;

  // ── Refresh handler — blocks duplicate requests (Req 1.10) ────────────────
  const handleRefresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      onRefresh();
    } finally {
      // Brief delay so the loading indicator is visible
      setTimeout(() => setRefreshing(false), 350);
    }
  }, [refreshing, onRefresh]);

  // ── Coverage ratio display helpers ────────────────────────────────────────
  const ratioLabel = `${formatPercent(fundingCoverageRatio)}`;
  const ratioCritical = fundingCoverageRatio <= 100;  // <= 100 means critical (includes exactly 100, Req 18.15)
  const ratioWarning = fundingCoverageRatio > 100 && fundingCoverageRatio < 110;

  // ── Cut-off signal display ────────────────────────────────────────────────
  const cutOffLabel = (() => {
    if (!cutOffWithin2h) return 'All Clear';
    const secs = cutOffSummary.secondsRemaining!;
    const rail = cutOffSummary.nextRail ?? '';
    return `${rail.replace(/_/g, ' ')} ${formatCountdown(secs)}`;
  })();

  return (
    <div
      role="banner"
      aria-label="Dashboard Status Bar"
      className="flex items-center justify-between px-4 bg-nymbus-navy text-white border-b border-nymbus-teal/20 border-l-4 border-l-nymbus-teal"
      style={{ height: '48px', maxHeight: '48px', minHeight: '48px' }}
    >
      {/* Left: four signals */}
      <div className="flex items-center gap-4 text-xs overflow-hidden">

        {/* All Systems Normal (Req 2.4) */}
        {allNormal && (
          <span className="flex items-center gap-1 text-green-400 font-semibold shrink-0">
            <span aria-hidden="true">✓</span>
            All Systems Normal
          </span>
        )}

        {/* Signal 1 — SLA Breaches (Req 2.2a) */}
        <span
          className={`flex items-center gap-1 shrink-0 ${
            slaBreachCount > 0 ? 'text-red-400 font-semibold' : 'text-gray-400'
          }`}
          aria-label={`SLA breaches: ${slaBreachCount}`}
        >
          <span aria-hidden="true">⚠</span>
          <span>
            {slaBreachCount > 0
              ? `${slaBreachCount} SLA Breach${slaBreachCount !== 1 ? 'es' : ''}`
              : '0 SLA Breaches'}
          </span>
        </span>

        {/* Signal 2 — Funding Coverage Ratio (Req 2.2b) */}
        <span
          className={`flex items-center gap-1 shrink-0 ${
            ratioCritical
              ? 'text-red-400 font-semibold'
              : ratioWarning
              ? 'text-yellow-400 font-semibold'
              : 'text-green-400'
          }`}
          aria-label={`Funding coverage ratio: ${ratioLabel}`}
        >
          <span aria-hidden="true">$</span>
          <span>{ratioLabel}</span>
          {/* Inline "Simulated Data" label — always visible (Req 2.8) */}
          <span className="text-gray-500 font-normal ml-0.5">Simulated Data</span>
          {ratioCritical && (
            <span className="ml-1 px-1 rounded bg-red-900 text-red-300 text-xs font-bold">CRITICAL</span>
          )}
          {ratioWarning && (
            <span className="ml-1 px-1 rounded bg-yellow-900 text-yellow-300 text-xs font-bold">WARNING</span>
          )}
        </span>

        {/* Signal 3 — Rail Health (Req 2.2c) */}
        <span
          className={`flex items-center gap-1 shrink-0 ${
            unhealthyRailCount > 0 ? 'text-yellow-400 font-semibold' : 'text-gray-400'
          }`}
          aria-label={`${unhealthyRailCount} rail${unhealthyRailCount !== 1 ? 's' : ''} degraded or critical`}
        >
          <span aria-hidden="true">⬡</span>
          <span>
            {unhealthyRailCount > 0
              ? `${unhealthyRailCount} Rail${unhealthyRailCount !== 1 ? 's' : ''} Degraded`
              : 'All Rails Healthy'}
          </span>
        </span>

        {/* Signal 4 — Cut-Off Countdown (Req 2.2d) */}
        <span
          className={`flex items-center gap-1 shrink-0 ${
            cutOffWithin2h
              ? cutOffSummary.secondsRemaining! < 1800
                ? 'text-red-400 font-semibold'
                : 'text-yellow-400 font-semibold'
              : 'text-gray-400'
          }`}
          aria-label={`Next cut-off: ${cutOffLabel}`}
        >
          <span aria-hidden="true">⏱</span>
          <span>{cutOffLabel}</span>
        </span>
      </div>

      {/* Right: generated-at timestamp + refresh button */}
      <div className="flex items-center gap-3 text-xs shrink-0 ml-4">
        <span className="text-gray-400 hidden sm:inline">
          Generated {generatedAt.toLocaleString(undefined, {
            year: 'numeric', month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit', second: '2-digit',
          })}
        </span>

        {/* Refresh button (Req 1.9, 1.10) */}
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          aria-label={refreshing ? 'Refreshing data…' : 'Refresh Data'}
          className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-colors ${
            refreshing
              ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
              : 'bg-nymbus-teal hover:bg-nymbus-teal-dim text-nymbus-navy font-semibold cursor-pointer'
          }`}
        >
          {refreshing ? (
            <>
              {/* Loading spinner */}
              <svg
                className="animate-spin h-3 w-3"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Refreshing…
            </>
          ) : (
            'Refresh Data'
          )}
        </button>
      </div>
    </div>
  );
});

export default StatusBar;
