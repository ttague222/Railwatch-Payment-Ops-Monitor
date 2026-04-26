import { useEffect, useRef, useState } from 'react';
import type { CutOffWindow, PaymentRail } from '../types';
import { CUTOFF_SCHEDULE, secondsUntilCutOff, getNextBusinessDay } from '../utils/cutoff';
import { isBusinessDay } from '../simulator/holidays';
import { useSetCutOffSummary } from '../context/CutOffContext';
import AchSameDayWindowStrip from './AchSameDayWindowStrip';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const RAIL_LABELS: Record<PaymentRail, string> = {
  ACH_Standard:       'ACH Standard',
  ACH_Same_Day:       'ACH Same Day',
  Wire_Domestic:      'Wire Domestic',
  Wire_International: 'Wire International',
  RTP:                'RTP',
  FedNow:             'FedNow',
};

const WINDOW_LABELS: Record<string, string> = {
  '10:30': '10:30 ET',
  '14:45': '14:45 ET',
  '16:45': '16:45 ET',
  '17:00': '17:00 ET',
  '18:00': '18:00 ET',
};

function formatCountdown(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
  return `${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
}

type CountdownState = 'neutral' | 'warning' | 'critical' | 'closed';

function getCountdownState(seconds: number | null): CountdownState {
  if (seconds === null) return 'closed';
  if (seconds === 0) return 'closed';
  if (seconds < 1800) return 'critical';
  if (seconds < 7200) return 'warning';
  return 'neutral';
}

const STATE_STYLES: Record<CountdownState, string> = {
  neutral:  'text-gray-700',
  warning:  'text-yellow-700 font-semibold',
  critical: 'text-red-700 font-bold',
  closed:   'text-gray-400',
};

const STATE_BADGE: Record<CountdownState, string> = {
  neutral:  'bg-gray-100 text-gray-600',
  warning:  'bg-yellow-100 text-yellow-800',
  critical: 'bg-red-100 text-red-800',
  closed:   'bg-gray-100 text-gray-400',
};

// ─── Window computation ───────────────────────────────────────────────────────

function computeWindows(rail: PaymentRail, now: Date): CutOffWindow[] {
  const entry = CUTOFF_SCHEDULE[rail];

  if (entry.type === 'none') return [];

  const times = entry.type === 'single' ? [entry.timeET] : entry.timesET;

  return times.map(timeET => {
    const secs = secondsUntilCutOff(timeET, now);
    const label = WINDOW_LABELS[timeET] ?? `${timeET} ET`;
    return {
      label,
      timeET,
      status: secs !== null ? 'upcoming' : 'closed',
      secondsRemaining: secs,
    } satisfies CutOffWindow;
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CutOffTimeMonitor() {
  const [now, setNow] = useState<Date>(() => new Date());
  const setCutOffSummary = useSetCutOffSummary();
  // Ref to avoid stale closure in setInterval
  const setCutOffSummaryRef = useRef(setCutOffSummary);
  setCutOffSummaryRef.current = setCutOffSummary;

  // Single setInterval at 1000ms — owns the clock for the entire cut-off section
  useEffect(() => {
    const id = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const today = now;
  const businessDay = isBusinessDay(today);

  // On each tick: compute CutOffSummary and write to context (Req 17, Req 18.12)
  useEffect(() => {
    if (!businessDay) {
      setCutOffSummaryRef.current({ nextRail: null, nextWindowLabel: null, secondsRemaining: null });
      return;
    }

    // Find the soonest upcoming cut-off across all rails (excluding 24/7 rails)
    let bestSecs: number | null = null;
    let bestRail: PaymentRail | null = null;
    let bestLabel: string | null = null;

    const rails: PaymentRail[] = [
      'ACH_Standard', 'ACH_Same_Day', 'Wire_Domestic', 'Wire_International',
    ];

    for (const rail of rails) {
      const windows = computeWindows(rail, now);
      for (const w of windows) {
        if (w.secondsRemaining !== null) {
          if (bestSecs === null || w.secondsRemaining < bestSecs) {
            bestSecs = w.secondsRemaining;
            bestRail = rail;
            bestLabel = w.label;
          }
        }
      }
    }

    setCutOffSummaryRef.current({
      nextRail: bestRail,
      nextWindowLabel: bestLabel,
      secondsRemaining: bestSecs,
    });
  }, [now, businessDay]);

  // ── Non-business-day static state ──────────────────────────────────────────
  if (!businessDay) {
    const nextDay = getNextBusinessDay(today);
    return (
      <section aria-label="Cut-Off Time Monitor" className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Cut-Off Times</h2>
        <div className="text-sm text-gray-500 italic">
          Non-business day — cut-off countdowns resume on {nextDay}.
        </div>
      </section>
    );
  }

  // ── Business-day render ────────────────────────────────────────────────────
  const railOrder: PaymentRail[] = [
    'ACH_Standard', 'ACH_Same_Day', 'Wire_Domestic', 'Wire_International', 'RTP', 'FedNow',
  ];

  return (
    <section aria-label="Cut-Off Time Monitor" className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-gray-900 mb-3">Cut-Off Times</h2>

      <div className="space-y-3">
        {railOrder.map(rail => {
          const entry = CUTOFF_SCHEDULE[rail];

          // 24/7 rails — no cut-off
          if (entry.type === 'none') {
            return (
              <div key={rail} className="flex items-center justify-between text-sm">
                <span className="text-gray-700 font-medium">{RAIL_LABELS[rail]}</span>
                <span className="text-xs text-gray-400 italic">24/7 — No Cut-Off</span>
              </div>
            );
          }

          // ACH Same Day — multi-window strip
          if (rail === 'ACH_Same_Day') {
            const windows = computeWindows(rail, now);
            return (
              <div key={rail}>
                <div className="text-sm font-medium text-gray-700 mb-1.5">
                  {RAIL_LABELS[rail]}
                </div>
                <AchSameDayWindowStrip windows={windows} now={now} />
              </div>
            );
          }

          // Single-window rails
          const windows = computeWindows(rail, now);
          const w = windows[0];
          const secs = w?.secondsRemaining ?? null;
          const state = getCountdownState(secs);

          return (
            <div key={rail} className="flex items-center justify-between text-sm">
              <span className="text-gray-700 font-medium">{RAIL_LABELS[rail]}</span>
              <div className="flex items-center gap-2">
                {state === 'critical' && (
                  // Pulse indicator for < 30 min (Req 17.5, Req 18.11)
                  <span className="inline-block w-2 h-2 rounded-full bg-red-500 animate-pulse" aria-hidden="true" />
                )}
                <span
                  className={`text-xs px-2 py-0.5 rounded font-mono ${STATE_BADGE[state]}`}
                  aria-label={
                    state === 'closed'
                      ? `${RAIL_LABELS[rail]} cut-off: Closed`
                      : `${RAIL_LABELS[rail]} cut-off in ${secs !== null ? formatCountdown(secs) : 'Closed'}`
                  }
                >
                  {state === 'closed'
                    ? 'Closed'
                    : secs !== null
                      ? formatCountdown(secs)
                      : 'Closed'}
                </span>
                <span className={`text-xs ${STATE_STYLES[state]}`}>
                  {w?.label ?? ''}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
