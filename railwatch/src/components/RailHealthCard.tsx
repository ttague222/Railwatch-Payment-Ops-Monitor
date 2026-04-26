import { memo, useMemo } from 'react';
import type { RailData, RailHealthStatus } from '../types';
import { useMarketauxArticles } from '../context/MarketauxContext';

interface Props {
  data: RailData;
}

const STATUS_STYLES: Record<RailHealthStatus, { bg: string; text: string; label: string }> = {
  Healthy:  { bg: 'bg-green-100',  text: 'text-green-800',  label: 'Healthy'  },
  Degraded: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Degraded' },
  Critical: { bg: 'bg-red-100',    text: 'text-red-800',    label: 'Critical'  },
};

function fmt(n: number) {
  return n.toLocaleString('en-US');
}

function pct(n: number) {
  return (n * 100).toFixed(2) + '%';
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
    <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
      {/* Rail name + status badge */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-900 text-sm">
          {data.rail.replace(/_/g, ' ')}
        </h3>
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${statusStyle.bg} ${statusStyle.text}`}
          aria-label={`Status: ${statusStyle.label}`}
        >
          {statusStyle.label}
        </span>
      </div>

      {/* Volume */}
      <div className="space-y-1 text-sm text-gray-700">
        <div className="flex justify-between">
          <span>Today volume</span>
          <span className="font-medium">{fmt(data.todayVolume)}</span>
        </div>
        <div className="flex justify-between">
          <span>Success rate</span>
          <span className="font-medium text-green-700">{pct(data.failureRate === 0 ? 1 : 1 - data.failureRate)}</span>
        </div>
        <div className="flex justify-between">
          <span>Failure rate</span>
          <span className={`font-medium ${data.status !== 'Healthy' ? 'text-red-700' : 'text-gray-700'}`}>
            {pct(data.failureRate)}
          </span>
        </div>
      </div>

      {/* Comparisons */}
      <div className="mt-3 pt-3 border-t border-gray-100 space-y-1 text-xs text-gray-500">
        <div className="flex justify-between">
          <span>vs prior day</span>
          <span className={priorDayDiff >= 0 ? 'text-green-600' : 'text-red-600'}>
            {priorDaySign}{fmt(priorDayDiff)}
          </span>
        </div>
        <div className="flex justify-between">
          <span>vs 7-day avg</span>
          <span className={avgDiff >= 0 ? 'text-green-600' : 'text-red-600'}>
            {avgSign}{fmt(avgDiff)}
          </span>
        </div>
      </div>

      {/* Volume anomaly indicator (Req 5.8) */}
      {volumeAnomaly && (
        <div className="mt-2 text-xs text-yellow-700 bg-yellow-50 rounded px-2 py-1">
          ⚠ Volume anomaly — more than 20% below 7-day average
        </div>
      )}

      {/* Conditional news headline for Degraded/Critical rails (Req 5.11) */}
      {relevantArticle && (
        <div className="mt-2 text-xs text-gray-600 bg-gray-50 rounded px-2 py-1 border-l-2 border-yellow-400">
          <span className="font-medium">News: </span>{relevantArticle.headline}
        </div>
      )}
    </div>
  );
});

export default RailHealthCard;
