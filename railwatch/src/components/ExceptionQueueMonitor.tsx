import { memo, useState, useMemo } from 'react';
import type { PaymentRail, ExceptionGroup } from '../types';
import { useDataProvider } from '../context/DataProviderContext';
import ExceptionGroupRow from './ExceptionGroupRow';
import { formatUSD } from '../utils/format';

// ─── SLA helpers ─────────────────────────────────────────────────────────────

const BREACH_HOURS: Record<PaymentRail, number> = {
  FedNow: 8, RTP: 8, ACH_Same_Day: 8,
  Wire_Domestic: 48, Wire_International: 48,
  ACH_Standard: 72,
};

function secondsToBreach(rail: PaymentRail, openedAt: string): number {
  const breachMs = BREACH_HOURS[rail] * 60 * 60 * 1000;
  const openedMs = new Date(openedAt).getTime();
  return (openedMs + breachMs - Date.now()) / 1000;
}

// ─── Sort logic ───────────────────────────────────────────────────────────────

type SortMode = 'sla' | 'exposure';

function sortGroups(groups: ExceptionGroup[], mode: SortMode): ExceptionGroup[] {
  const copy = [...groups];
  if (mode === 'sla') {
    copy.sort((a, b) => {
      const diff = secondsToBreach(a.rail, a.oldestOpenedAt) - secondsToBreach(b.rail, b.oldestOpenedAt);
      if (diff !== 0) return diff; // ascending: most urgent first
      return b.dollarExposure - a.dollarExposure; // tie-break: higher exposure first
    });
  } else {
    copy.sort((a, b) => b.dollarExposure - a.dollarExposure);
  }
  return copy;
}

// ─── Component ────────────────────────────────────────────────────────────────

const ExceptionQueueMonitor = memo(function ExceptionQueueMonitor() {
  const dp = useDataProvider();
  const groups = dp.getExceptionQueue();
  const priorDay = dp.getPriorDayClosingExceptions();

  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [sortMode, setSortMode] = useState<SortMode>('sla');

  function groupKey(g: ExceptionGroup) {
    return `${g.rail}_${g.reasonCode}`;
  }

  function toggleGroup(key: string) {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  const sortedGroups = useMemo(() => sortGroups(groups, sortMode), [groups, sortMode]);

  // ── Summary stats ──────────────────────────────────────────────────────────

  const totalCount = groups.reduce((s, g) => s + g.count, 0);

  const priorDayTotal = Object.values(priorDay).reduce((s, v) => s + v, 0);
  const queueGrowthAlert = priorDayTotal > 0 && totalCount > priorDayTotal * 1.25;

  // Per-rail count and exposure
  const railStats = useMemo(() => {
    const map = new Map<PaymentRail, { count: number; exposure: number }>();
    for (const g of groups) {
      const existing = map.get(g.rail) ?? { count: 0, exposure: 0 };
      map.set(g.rail, {
        count: existing.count + g.count,
        exposure: existing.exposure + g.dollarExposure,
      });
    }
    return map;
  }, [groups]);

  // Top 5 reason codes by count
  const topReasonCodes = useMemo(() => {
    const map = new Map<string, number>();
    for (const g of groups) {
      map.set(g.reasonCode, (map.get(g.reasonCode) ?? 0) + g.count);
    }
    return [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [groups]);

  return (
    <section aria-label="Exception Queue Monitor">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold uppercase tracking-widest text-nymbus-teal">Exception Queue</h2>
        <button
          onClick={() => setSortMode(m => m === 'sla' ? 'exposure' : 'sla')}
          className="text-xs px-3 py-1.5 rounded border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 font-medium"
          aria-label={`Sort by ${sortMode === 'sla' ? 'Dollar Exposure' : 'SLA Urgency'}`}
        >
          Sort: {sortMode === 'sla' ? 'SLA Urgency' : 'Dollar Exposure'}
        </button>
      </div>

      {/* Queue growth alert (Req 6.13) */}
      {queueGrowthAlert && (
        <div className="mb-3 border-l-4 border-amber-400 bg-amber-400/5 text-amber-700 text-sm font-medium px-4 py-2 rounded-r">
          ⚠ Queue growth alert — current exceptions ({totalCount}) exceed 125% of prior-day closing count ({priorDayTotal})
        </div>
      )}

      {/* All-clear (Req 6.14) */}
      {totalCount === 0 && (
        <div className="mb-3 border-l-4 border-emerald-500 bg-emerald-500/5 text-emerald-700 text-sm font-medium px-4 py-2 rounded-r">
          ✓ All clear — no open exceptions
        </div>
      )}

      {/* Summary cards */}
      {totalCount > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          {/* Total count */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-md">
            <div className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-1">Total Exceptions</div>
            <div className="text-2xl font-bold tabular-nums text-gray-900">{totalCount}</div>
          </div>

          {/* Per-rail breakdown */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-md">
            <div className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">By Rail</div>
            <div className="space-y-1">
              {[...railStats.entries()].map(([rail, stats]) => (
                <div key={rail} className="flex justify-between text-xs">
                  <span className="text-gray-700">{rail.replace(/_/g, ' ')}</span>
                  <span className="font-medium tabular-nums text-gray-900">{stats.count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Top 5 reason codes */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-md">
            <div className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">Top Reason Codes</div>
            <div className="space-y-1">
              {topReasonCodes.map(([code, count], i) => (
                <div key={code} className="flex justify-between text-xs">
                  <span className="text-gray-700 font-mono">
                    {i + 1}. {code}
                  </span>
                  <span className="font-medium tabular-nums text-gray-900">{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Dollar exposure per rail */}
      {totalCount > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-md mb-4">
          <div className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">Dollar Exposure by Rail</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {[...railStats.entries()].map(([rail, stats]) => (
              <div key={rail} className="text-xs">
                <div className="text-gray-500">{rail.replace(/_/g, ' ')}</div>
                <div className="font-semibold tabular-nums text-gray-900">{formatUSD(stats.exposure)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Exception group rows */}
      <div className="space-y-2">
        {sortedGroups.map(group => {
          const key = groupKey(group);
          return (
            <ExceptionGroupRow
              key={key}
              group={group}
              isExpanded={expandedGroups.has(key)}
              onToggle={() => toggleGroup(key)}
            />
          );
        })}
      </div>
    </section>
  );
});

export default ExceptionQueueMonitor;
