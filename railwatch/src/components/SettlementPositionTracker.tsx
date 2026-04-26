import { memo } from 'react';
import type { PaymentRail } from '../types';
import { useDataProvider } from '../context/DataProviderContext';
import SettlementTimeline from './SettlementTimeline';

// ─── Formatters ───────────────────────────────────────────────────────────────

function formatUSD(n: number): string {
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatPct(n: number): string {
  return n.toFixed(2) + '%';
}

// ─── Rail breakdown styles ────────────────────────────────────────────────────

const RAIL_STATUS_STYLES: Record<'funded' | 'at-risk' | 'underfunded', { bg: string; text: string; label: string }> = {
  funded:      { bg: 'bg-green-100',  text: 'text-green-800',  label: 'Funded'      },
  'at-risk':   { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'At Risk'     },
  underfunded: { bg: 'bg-red-100',    text: 'text-red-800',    label: 'Underfunded' },
};

// ─── Alert level ──────────────────────────────────────────────────────────────

type AlertLevel = 'adequate' | 'WARNING' | 'CRITICAL';

function getAlertLevel(ratio: number): AlertLevel {
  if (ratio >= 110) return 'adequate';
  if (ratio >= 100) return 'WARNING';
  return 'CRITICAL';
}

// ─── Component ────────────────────────────────────────────────────────────────

const SettlementPositionTracker = memo(function SettlementPositionTracker() {
  const dp = useDataProvider();
  const position = dp.getSettlementPosition();

  const { settlementBalance, projectedDailyObligation, fundingCoverageRatio, railBreakdown, intradayTimeline } = position;

  // Req 7.8: ratio = (balance / obligation) × 100, rounded to 2dp
  // Use the provided fundingCoverageRatio but guard against division by zero (Req 7.10)
  const hasObligation = projectedDailyObligation > 0;

  // Compute ratio locally to 2dp for display/alert logic
  const displayRatio = hasObligation
    ? Math.round((settlementBalance / projectedDailyObligation) * 100 * 100) / 100
    : fundingCoverageRatio;

  const alertLevel: AlertLevel = hasObligation ? getAlertLevel(displayRatio) : 'adequate';
  const showSimulatedLabel = hasObligation && displayRatio < 110;

  const rails = Object.keys(railBreakdown) as PaymentRail[];

  return (
    <section aria-label="Settlement Position Tracker" className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-bold text-gray-900">Settlement Position</h2>
        {/* Non-dismissible SIMULATED DATA label (Req 7.11) */}
        {showSimulatedLabel && (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-orange-100 text-orange-800 border border-orange-300">
            SIMULATED DATA
          </span>
        )}
      </div>

      {/* Alert banner */}
      {alertLevel === 'CRITICAL' && (
        <div
          role="alert"
          className="mb-3 px-3 py-2 rounded bg-red-50 text-red-700 text-sm font-medium border border-red-200"
        >
          🔴 CRITICAL — Funding coverage ratio is below 100%
        </div>
      )}
      {alertLevel === 'WARNING' && (
        <div
          role="alert"
          className="mb-3 px-3 py-2 rounded bg-yellow-50 text-yellow-700 text-sm font-medium border border-yellow-200"
        >
          ⚠ WARNING — Funding coverage ratio is below 110%
        </div>
      )}
      {alertLevel === 'adequate' && hasObligation && (
        <div className="mb-3 px-3 py-2 rounded bg-green-50 text-green-700 text-sm font-medium border border-green-200">
          ✓ Adequately Funded
        </div>
      )}

      {/* Key metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
        {/* Settlement Balance (Req 7.1) */}
        <div className="bg-gray-50 rounded p-3">
          <div className="text-xs text-gray-500 mb-1">Settlement Balance</div>
          <div className="text-lg font-bold text-gray-900">{formatUSD(settlementBalance)}</div>
        </div>

        {/* Projected Daily Obligation (Req 7.2) */}
        <div className="bg-gray-50 rounded p-3">
          <div className="text-xs text-gray-500 mb-1">Projected Daily Obligation</div>
          <div className="text-lg font-bold text-gray-900">{formatUSD(projectedDailyObligation)}</div>
        </div>

        {/* Funding Coverage Ratio (Req 7.3) */}
        <div className="bg-gray-50 rounded p-3">
          <div className="text-xs text-gray-500 mb-1">Funding Coverage Ratio</div>
          {!hasObligation ? (
            <div className="text-sm text-gray-400 italic">Data unavailable</div>
          ) : (
            <div
              className={`text-lg font-bold ${
                alertLevel === 'CRITICAL'
                  ? 'text-red-700'
                  : alertLevel === 'WARNING'
                  ? 'text-yellow-700'
                  : 'text-green-700'
              }`}
            >
              {formatPct(displayRatio)}
              <span className="ml-2 text-xs font-medium">
                {alertLevel === 'CRITICAL' ? '(CRITICAL)' : alertLevel === 'WARNING' ? '(WARNING)' : '(Adequate)'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Per-rail breakdown (Req 7.6) */}
      <div className="mb-4">
        <div className="text-xs text-gray-500 mb-2 font-medium">Per-Rail Settlement Status</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {rails.map(rail => {
            const status = railBreakdown[rail];
            const style = RAIL_STATUS_STYLES[status];
            return (
              <div key={rail} className="flex items-center justify-between bg-gray-50 rounded px-2 py-1.5">
                <span className="text-xs text-gray-700">{rail.replace(/_/g, ' ')}</span>
                <span
                  className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${style.bg} ${style.text}`}
                  aria-label={`${rail}: ${style.label}`}
                >
                  {style.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Intraday timeline chart (Req 7.9) */}
      <SettlementTimeline data={intradayTimeline} />
    </section>
  );
});

export default SettlementPositionTracker;
