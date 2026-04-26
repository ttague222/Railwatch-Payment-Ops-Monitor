import type { PaymentRail } from '../types';
import { isBusinessDay } from '../simulator/holidays';

// ─── Cut-Off Schedule ─────────────────────────────────────────────────────────

export type CutOffScheduleEntry =
  | { type: 'single'; timeET: string }   // HH:MM
  | { type: 'multi';  timesET: string[] } // HH:MM[]
  | { type: 'none' };                    // 24/7 rail

/**
 * Authoritative cut-off schedule for all payment rails.
 * Times are in Eastern Time (America/New_York). No UTC offsets stored here —
 * the Intl API handles all timezone math including DST.
 */
export const CUTOFF_SCHEDULE: Record<PaymentRail, CutOffScheduleEntry> = {
  ACH_Standard:       { type: 'single', timeET: '14:45' },
  ACH_Same_Day:       { type: 'multi',  timesET: ['10:30', '14:45', '16:45'] },
  Wire_Domestic:      { type: 'single', timeET: '18:00' },
  Wire_International: { type: 'single', timeET: '17:00' },
  RTP:                { type: 'none' },
  FedNow:             { type: 'none' },
};

// ─── Countdown Calculation ────────────────────────────────────────────────────

/**
 * Returns the number of seconds until the given HH:MM cut-off time
 * in America/New_York on the current calendar day.
 * Returns null if the cut-off has already passed (negative would be returned).
 * Uses Intl.DateTimeFormat — no manual UTC offset arithmetic.
 */
export function secondsUntilCutOff(windowTimeET: string, now: Date): number | null {
  const [cutHour, cutMinute] = windowTimeET.split(':').map(Number);

  const etFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = etFormatter.formatToParts(now);
  const get = (type: string) =>
    parseInt(parts.find(p => p.type === type)!.value, 10);

  const etHour   = get('hour');
  const etMinute = get('minute');
  const etSecond = get('second');

  const nowSecondsET = etHour * 3600 + etMinute * 60 + etSecond;
  const cutSecondsET = cutHour * 3600 + cutMinute * 60;
  const diff = cutSecondsET - nowSecondsET;

  return diff > 0 ? diff : null;
}

// ─── Next Business Day ────────────────────────────────────────────────────────

/**
 * Returns a human-readable label for the next business day after `from`.
 * e.g. "Mon, Apr 28"
 */
export function getNextBusinessDay(from: Date): string {
  const cursor = new Date(from);
  cursor.setDate(cursor.getDate() + 1);

  while (!isBusinessDay(cursor)) {
    cursor.setDate(cursor.getDate() + 1);
  }

  return cursor.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}
