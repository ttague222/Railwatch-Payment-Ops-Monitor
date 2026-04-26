import { memo, useMemo } from 'react';
import type { RailData, RailHealthStatus } from '../types';
import { useMarketauxArticles } from '../context/MarketauxContext';
import { formatPercent } from '../utils/format';

interface Props {
  data: RailData;
}

const STATUS_STYLES: Record<RailHealthStatus, { accentBg: string; accentBar: string; badge: string; label: string }> = {
  Healthy:  { accentBg: 'bg-emerald-500', accentBar: '', badge: 'bg-emerald-500/10 text-emerald-700 ring-1 ring-emerald-500/30', label: 'Healthy'  },
  Degraded: { accentBg: 'bg-amber-400',   accentBar: '', badge: 'bg-amber-400/10  text-amber-700  ring-1 ring-amber-400/30',   label: 'Degraded' },
  Critical: { accentBg: 'bg-red-500',     accentBar: '', badge: 'bg-red-500/10    text-red-700    ring-1 ring-red-500/30',     label: 'Critical'  },
};

function fmt(n: number) {
  return n.toLocaleString('en-US');
}

function pct(n: number) {
  return formatPercent(n * 100);
}

const RailHealthCard = memo(function RailHealthCard({ data }: Props) {
  const articles = useMarketauxArticles();

  const statusStyle = STATUS_STYLES[data.status];

  // Volume anomaly: current < 80% of 7-day average (Req 5.8)
  const volumeAnomaly =
    data.sevenDayAverage > 0 &&
    data.todayVolume < data.sevenDayAverage * 0.8;

  // Conditionally surface a relevant news headline when rail is Degraded or Critical (Req 5.11)
  const relevantArticle = useMemo(() => {
    if (data.status !== 'Degraded' && data.status !== 'Critical') return null;
    const keyword = data.rail === 'FedNow' ? 'fednow' : data.rail === 'RTP' ? 'rtp' : null;
    if (!keyword) return null;
    return articles.find(a => a.headline.toLowerCase().includes(keyword)) ?? null;
  }, [data.status, data.rail, articles]);

  const priorDayDiff = data.todayVolume - data.priorDayVolume;
  const priorDaySign = priorDayDiff >= 0 ? '+' : '';

  const avgDiff = data.todayVolume - data.sevenDayAverage;
  const avgSign = avgDiff >= 0 ? '+' : '';

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-md overflow-hidden">
      {/* Colored accent bar across the top */}
      <div className={`h-1 w-full ${statusStyle.accentBg}`} aria-hidden="true" />
      <div className="p-4">
        {/* Rail name + status badge */}
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-900 text-sm">
            {data.rail.replace(/_/g, ' ')}
          </h3>
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusStyle.badge}`}
            aria-label={`Status: ${statusStyle.label}`}
          >
            {statusStyle.label}
          </span>
        </div>

        {/* Volume */}
        <div className="space-y-1 text-sm text-gray-700">
          <div className="flex justify-between">
            <span>Today volume</span>
            <span className="font-medium tabular-nums">{fmt(data.todayVolume)}</span>
          </div>
          <div className="flex justify-between">
            <span>Success rate</span>
            <span className="font-medium tabular-nums text-emerald-700">{pct(data.failureRate === 0 ? 1 : 1 - data.failureRate)}</span>
          </div>
          <div className="flex justify-between">
            <span>Failure rate</span>
            <span className={`font-medium tabular-nums ${data.status !== 'Healthy' ? 'text-red-700' : 'text-gray-700'}`}>
              {pct(data.failureRate)}
            </span>
          </div>
        </div>

        {/* Comparisons */}
        <div className="mt-3 pt-3 border-t border-gray-100 space-y-1 text-xs text-gray-500">
          <div className="flex justify-between">
            <span>vs prior day</span>
            <span className={`tabular-nums ${priorDayDiff >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {priorDaySign}{fmt(priorDayDiff)}
            </span>
          </div>
          <div className="flex justify-between">
            <span>vs 7-day avg</span>
            <span className={`tabular-nums ${avgDiff >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {avgSign}{fmt(avgDiff)}
            </span>
          </div>
        </div>

        {/* Volume anomaly indicator (Req 5.8) */}
        {volumeAnomaly && (
          <div className="mt-2 text-xs text-amber-700 bg-amber-400/5 border-l-2 border-amber-400 rounded-r px-2 py-1">
            ⚠ Volume anomaly — more than 20% below 7-day average
          </div>
        )}

        {/* Conditional news headline for Degraded/Critical rails (Req 5.11) */}
        {relevantArticle && (
          <div className="mt-2 text-xs text-gray-600 bg-gray-50 rounded px-2 py-1 border-l-2 border-amber-400">
            <span className="font-medium">News: </span>{relevantArticle.headline}
          </div>
        )}
      </div>
    </div>
  );
});

export default RailHealthCard;
