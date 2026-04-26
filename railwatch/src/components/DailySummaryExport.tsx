import { memo, useState, useRef, useCallback } from 'react';
import { useDataProvider } from '../context/DataProviderContext';
import { readFredCache } from '../api/fred';
import { readMarketauxCache } from '../api/marketaux';
import { fxSessionCache } from '../api/frankfurter';
import type { ExceptionGroup, PaymentRail } from '../types';

// ─── Constants ────────────────────────────────────────────────────────────────

const DISCLAIMER =
  '⚠ SIMULATED DATA — FOR DEMONSTRATION PURPOSES ONLY. NOT FOR USE IN REGULATORY REPORTING, BOARD PRESENTATIONS, OR ANY COMPLIANCE PURPOSE.';

const COPY_CONFIRM_MS = 3000;

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

/** SLA breach threshold in milliseconds per rail. */
function getSlaBreachMs(rail: PaymentRail): number {
  switch (rail) {
    case 'FedNow':
    case 'RTP':
    case 'ACH_Same_Day':
      return 8 * 60 * 60 * 1000;
    case 'Wire_Domestic':
    case 'Wire_International':
      return 48 * 60 * 60 * 1000;
    case 'ACH_Standard':
    default:
      return 72 * 60 * 60 * 1000;
  }
}

function getSlaLabel(group: ExceptionGroup, now: Date): string {
  const ageMs = now.getTime() - new Date(group.oldestOpenedAt).getTime();
  const breachMs = getSlaBreachMs(group.rail);
  const warningMs = breachMs / 2;
  if (ageMs >= breachMs) return 'BREACH';
  if (ageMs >= warningMs) return 'WARNING';
  return 'OK';
}

function ageLabel(isoDate: string, now: Date): string {
  const ms = now.getTime() - new Date(isoDate).getTime();
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface DailySummaryExportProps {
  generatedAt: Date;
}

// ─── Component ────────────────────────────────────────────────────────────────

const DailySummaryExport = memo(function DailySummaryExport({ generatedAt }: DailySummaryExportProps) {
  const dp = useDataProvider();

  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'fallback'>('idle');
  const [fallbackText, setFallbackText] = useState<string>('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Build the plain-text summary ──────────────────────────────────────────

  const buildSummary = useCallback((): string => {
    const now = new Date();
    const lines: string[] = [];

    // Mandatory disclaimer — first line (Req 13.5)
    lines.push(DISCLAIMER);
    lines.push('');

    // Date / time header
    lines.push(`RailWatch Daily Summary — ${now.toLocaleString()}`);
    lines.push(`Simulation generated at: ${generatedAt.toLocaleString()}`);
    lines.push('');

    // ── Rail Health ──────────────────────────────────────────────────────────
    lines.push('=== RAIL HEALTH ===');
    const railData = dp.getRailData();
    for (const r of railData) {
      lines.push(
        `  ${r.rail.replace(/_/g, ' ')}: ${r.status}` +
          `  |  Volume: ${r.todayVolume.toLocaleString()}` +
          `  |  Failure Rate: ${formatPct(r.failureRate * 100)}`,
      );
    }
    lines.push('');

    // ── Exception Queue ──────────────────────────────────────────────────────
    const exceptions = dp.getExceptionQueue();
    const totalExceptions = exceptions.reduce((s, g) => s + g.count, 0);
    lines.push('=== EXCEPTION QUEUE ===');
    lines.push(`  Total open exceptions: ${totalExceptions}`);

    // Top 3 aging exceptions by SLA urgency (oldest relative to breach threshold first)
    const sorted = [...exceptions].sort((a, b) => {
      const ageA = now.getTime() - new Date(a.oldestOpenedAt).getTime();
      const ageB = now.getTime() - new Date(b.oldestOpenedAt).getTime();
      const ratioA = ageA / getSlaBreachMs(a.rail);
      const ratioB = ageB / getSlaBreachMs(b.rail);
      return ratioB - ratioA;
    });

    lines.push('  Top 3 aging exceptions by SLA:');
    for (const g of sorted.slice(0, 3)) {
      const sla = getSlaLabel(g, now);
      lines.push(
        `    [${sla}] ${g.rail.replace(/_/g, ' ')} — ${g.reasonCode} (${g.reasonCodeNamespace})` +
          `  Count: ${g.count}  |  Exposure: ${formatUSD(g.dollarExposure)}` +
          `  |  Oldest: ${ageLabel(g.oldestOpenedAt, now)} ago`,
      );
    }
    lines.push('');

    // ── Settlement Position ──────────────────────────────────────────────────
    const pos = dp.getSettlementPosition();
    const hasObligation = pos.projectedDailyObligation > 0;
    // Req 13.8: ratio in export must match displayed ratio
    const displayRatio = hasObligation
      ? Math.round((pos.settlementBalance / pos.projectedDailyObligation) * 100 * 100) / 100
      : pos.fundingCoverageRatio;

    lines.push('=== SETTLEMENT POSITION ===');
    lines.push(`  Settlement Balance:        ${formatUSD(pos.settlementBalance)}`);
    lines.push(`  Projected Daily Obligation: ${formatUSD(pos.projectedDailyObligation)}`);

    if (!hasObligation) {
      lines.push('  Funding Coverage Ratio:    Data unavailable');
    } else {
      lines.push(`  Funding Coverage Ratio:    ${formatPct(displayRatio)}`);

      // Active liquidity alerts
      if (displayRatio < 100) {
        lines.push('  ⚠ ACTIVE ALERT: CRITICAL — Settlement position is underfunded');
      } else if (displayRatio < 110) {
        lines.push('  ⚠ ACTIVE ALERT: WARNING — Funding coverage below 110%');
      }
    }
    lines.push('');

    // ── Market Context (Req 13.3 / 13.4) ────────────────────────────────────
    const fredCache = readFredCache();
    const marketauxCache = readMarketauxCache();
    const fxEntries = Array.from(fxSessionCache.values()).slice(0, 2);

    const hasMarketData = fredCache !== null || marketauxCache !== null || fxEntries.length > 0;

    lines.push('=== MARKET CONTEXT ===');

    if (!hasMarketData) {
      lines.push('  Market data was unavailable at time of export.');
    } else {
      // Fed Funds Rate
      if (fredCache) {
        const { data } = fredCache;
        const changeSign = data.momChange >= 0 ? '+' : '';
        lines.push(
          `  Fed Funds Rate: ${data.currentRate.toFixed(2)}%` +
            `  (as of ${data.currentDate}` +
            `  MoM change: ${changeSign}${data.momChange.toFixed(2)}%)`,
        );
      } else {
        lines.push('  Fed Funds Rate: unavailable');
      }

      // Top news headline
      if (marketauxCache && marketauxCache.articles.length > 0) {
        const top = marketauxCache.articles[0];
        lines.push(
          `  Top News: "${top.headline}"` +
            `  [${top.sentimentLabel}]  — ${top.source}`,
        );
      } else {
        lines.push('  News: unavailable');
      }

      // FX rates (up to 2 from session cache — omit section entirely if none fetched)
      if (fxEntries.length > 0) {
        lines.push('  FX Rates (session):');
        for (const entry of fxEntries) {
          lines.push(
            `    1 USD = ${entry.rate.rate.toFixed(4)} ${entry.rate.toCurrency}` +
              `  (as of ${entry.rate.date})`,
          );
        }
      }
    }
    lines.push('');

    // Mandatory disclaimer — last line (Req 13.5)
    lines.push(DISCLAIMER);

    return lines.join('\n');
  }, [dp, generatedAt]);

  // ── Copy handler ──────────────────────────────────────────────────────────

  const handleCopy = useCallback(() => {
    const text = buildSummary();

    // Req 18.18: if confirmation already showing, reset timer without duplicating
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (typeof navigator?.clipboard?.writeText === 'function') {
      navigator.clipboard.writeText(text).then(
        () => {
          setCopyState('copied');
          timerRef.current = setTimeout(() => {
            setCopyState('idle');
            timerRef.current = null;
          }, COPY_CONFIRM_MS);
        },
        () => {
          // Clipboard write failed — fall back to modal
          setFallbackText(text);
          setCopyState('fallback');
        },
      );
    } else {
      // Clipboard API unavailable (Req 13.7)
      setFallbackText(text);
      setCopyState('fallback');
    }
  }, [buildSummary]);

  const closeFallback = useCallback(() => {
    setCopyState('idle');
    setFallbackText('');
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <section
        aria-label="Daily Summary Export"
        className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm"
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Daily Summary Export</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Copy a plain-text ops summary for standup or leadership email.
            </p>
          </div>

          <button
            onClick={handleCopy}
            aria-label="Copy daily summary to clipboard"
            className={`
              inline-flex items-center gap-2 px-4 py-2 rounded text-sm font-medium transition-colors
              ${copyState === 'copied'
                ? 'bg-green-100 text-green-800 border border-green-300'
                : 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800'}
            `}
          >
            {copyState === 'copied' ? (
              <>
                <span aria-hidden="true">✓</span>
                Copied!
              </>
            ) : (
              <>
                <span aria-hidden="true">📋</span>
                Copy Summary
              </>
            )}
          </button>
        </div>

        {/* Inline disclaimer notice */}
        <p className="mt-3 text-xs text-orange-700 bg-orange-50 border border-orange-200 rounded px-3 py-2">
          {DISCLAIMER}
        </p>
      </section>

      {/* Modal fallback (Req 13.7) */}
      {copyState === 'fallback' && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Daily Summary — Manual Copy"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={closeFallback}
        >
          <div
            className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 p-6 flex flex-col gap-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-gray-900">
                Daily Summary — Copy Manually
              </h3>
              <button
                onClick={closeFallback}
                aria-label="Close"
                className="text-gray-400 hover:text-gray-600 text-xl leading-none"
              >
                ×
              </button>
            </div>
            <p className="text-xs text-gray-500">
              Clipboard access is unavailable. Select all text below and copy manually (Ctrl+A, Ctrl+C).
            </p>
            <textarea
              readOnly
              value={fallbackText}
              rows={16}
              className="w-full text-xs font-mono border border-gray-200 rounded p-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-400"
              onFocus={e => e.target.select()}
              aria-label="Summary text for manual copy"
            />
            <div className="flex justify-end">
              <button
                onClick={closeFallback}
                className="px-4 py-2 rounded bg-gray-100 text-gray-700 hover:bg-gray-200 text-sm font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
});

export default DailySummaryExport;
