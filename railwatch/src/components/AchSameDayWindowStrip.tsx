import { memo } from 'react';
import type { CutOffWindow } from '../types';
import { getNextBusinessDay } from '../utils/cutoff';

interface Props {
  windows: CutOffWindow[];
  now: Date;
}

function formatCountdown(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  return `${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
}

function windowUrgencyClass(w: CutOffWindow): string {
  if (w.status === 'closed') return 'bg-gray-100 text-gray-400 border-gray-200';
  if (w.secondsRemaining === null) return 'bg-gray-100 text-gray-400 border-gray-200';
  if (w.secondsRemaining < 1800) return 'bg-red-50 text-red-800 border-red-300';
  if (w.secondsRemaining < 7200) return 'bg-yellow-50 text-yellow-800 border-yellow-300';
  return 'bg-green-50 text-green-800 border-green-200';
}

const AchSameDayWindowStrip = memo(function AchSameDayWindowStrip({ windows, now }: Props) {
  const allClosed = windows.every(w => w.status === 'closed');

  if (allClosed) {
    const nextDay = getNextBusinessDay(now);
    return (
      <div className="text-xs text-gray-500 italic px-1">
        All windows closed — next business day: {nextDay}
      </div>
    );
  }

  return (
    <div className="flex gap-2 flex-wrap">
      {windows.map(w => {
        const isNext = w.status === 'upcoming' &&
          windows.filter(x => x.status === 'upcoming').indexOf(w) === 0;

        return (
          <div
            key={w.label}
            className={`flex-1 min-w-[90px] rounded border px-2 py-1.5 text-xs ${windowUrgencyClass(w)} ${isNext ? 'ring-1 ring-offset-1 ring-blue-400' : ''}`}
            aria-label={`ACH Same Day window ${w.label}`}
          >
            <div className="font-semibold">{w.label}</div>
            <div className="text-[11px] mt-0.5">
              {w.status === 'closed'
                ? 'Closed'
                : w.secondsRemaining !== null
                  ? formatCountdown(w.secondsRemaining)
                  : 'Closed'}
            </div>
            {isNext && (
              <div className="text-[10px] mt-0.5 font-medium text-blue-600">Next</div>
            )}
          </div>
        );
      })}
    </div>
  );
});

export default AchSameDayWindowStrip;
