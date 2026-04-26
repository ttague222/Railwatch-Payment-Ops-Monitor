import { memo } from 'react';
import type { PaymentRail } from '../types';
import { useDataProvider } from '../context/DataProviderContext';
import SettlementTimeline from './SettlementTimeline';
import { formatUSD, formatPercent } from '../utils/format';

// ─── Rail breakdown styles ────────────────────────────────────────────────────

const RAIL_STATUS_STYLES: Record<'funded' | 'at-risk' | 'underfunded', { accentBg: string; badge: string; label: string }> = {
  funded:      { accentBg: 'bg-emerald-500', badge: 'bg-emerald-500/10 text-emerald-700 ring-1 ring-emerald-500/30', label: 'Funded'      },
  'at-risk':   { accentBg: 'bg-amber-400',   badge: 'bg-amber-400/10  text-amber-700  ring-1 ring-amber-400/30',   label: 'At Risk'     },
  underfunded: { accentBg: 'bg-red-500',     badge: 'bg-red-500/10    text-red-700    ring-1 ring-red-500/30',     label: 'Underfunded' },
};

// ─── Alert level ──────────────────────────────────────────────────────────────

type AlertLevel = 'adequate' | 'WARNING' | 'CRITICAL';

function getAlertLevel(ratio: number): AlertLevel {
  if (ratio >= 110) return 'adequate';
  if (ratio > 100) return 'WARNING'; // strictly > 100; exactly 100 falls through to CRITICAL (Req 18.15)
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
    <section aria-label="Settlement Position Tracker" className="bg-white rounded-xl border border-gray-200 p-4 shadow-md">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold uppercase tracking-widest text-nymbus-teal">Settlement Position</h2>
        {/* Non-dismissible SIMULATED DATA label (Req 7.11) */}
        {showSimulatedLabel && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-800 border border-orange-300">
            SIMULATED DATA
          </span>
        )}
      </div>

      {/* Alert banner */}
      {alertLevel === 'CRITICAL' && (
        <div
          role="alert"
          className="mb-3 border-l-4 border-red-500 bg-red-500/5 text-red-700 text-sm font-medium px-4 py-2 rounded-r"
        >
          🔴 CRITICAL — Funding coverage ratio is below 100%
        </div>
      )}
      {alertLevel === 'WARNING' && (
        <div
          role="alert"
          className="mb-3 border-l-4 border-amber-400 bg-amber-400/5 text-amber-700 text-sm font-medium px-4 py-2 rounded-r"
        >
          ⚠ WARNING — Funding coverage ratio is below 110%
        </div>
      )}
      {alertLevel === 'adequate' && hasObligation && (
        <div className="mb-3 border-l-4 border-emerald-500 bg-emerald-500/5 text-emerald-700 text-sm font-medium px-4 py-2 rounded-r">
          ✓ Adequately Funded
        </div>
      )}

      {/* Key metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
        {/* Settlement Balance (Req 7.1) */}
        <div className="bg-nymbus-mist rounded-lg p-3">
          <div className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-1">Settlement Balance</div>
          <div className="text-lg font-bold tabular-nums text-gray-900">{formatUSD(settlementBalance)}</div>
        </div>

        {/* Projected Daily Obligation (Req 7.2) */}
        <div className="bg-nymbus-mist rounded-lg p-3">
          <div className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-1">Projected Daily Obligation</div>
          <div className="text-lg font-bold tabular-nums text-gray-900">{formatUSD(projectedDailyObligation)}</div>
        </div>

        {/* Funding Coverage Ratio (Req 7.3) */}
        <div className="bg-nymbus-mist rounded-lg p-3">
          <div className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-1">Funding Coverage Ratio</div>
          {!hasObligation ? (
            <div className="text-sm text-gray-400 italic">Data unavailable</div>
          ) : (
            <div
              className={`text-lg font-bold tabular-nums ${
                alertLevel === 'CRITICAL'
                  ? 'text-red-700'
                  : alertLevel === 'WARNING'
                  ? 'text-amber-700'
                  : 'text-emerald-700'
              }`}
            >
              {formatPercent(displayRatio)}
              <span className="ml-2 text-xs font-medium">
                {alertLevel === 'CRITICAL' ? '(CRITICAL)' : alertLevel === 'WARNING' ? '(WARNING)' : '(Adequate)'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Per-rail breakdown (Req 7.6) */}
      <div className="mb-4">
        <div className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">Per-Rail Settlement Status</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {rails.map(rail => {
            const status = railBreakdown[rail];
            const style = RAIL_STATUS_STYLES[status];
            return (
              <div key={rail} className="flex items-center justify-between bg-nymbus-mist rounded overflow-hidden">
                <div className={`w-1 self-stretch ${style.accentBg}`} aria-hidden="true" />
                <span className="text-xs text-gray-700 flex-1 px-2 py-1.5">{rail.replace(/_/g, ' ')}</span>
                <span
                  className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium mr-2 ${style.badge}`}
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
