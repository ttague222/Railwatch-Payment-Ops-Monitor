import { memo, useEffect, useState } from 'react';
import { useDataProvider } from '../context/DataProviderContext';
import ApiErrorBoundary from './ApiErrorBoundary';
import FredIndicator from './FredIndicator';
import MarketauxNewsFeed from './MarketauxNewsFeed';

/**
 * MarketContextPanel — composes the three market context sections:
 *   1. FredIndicator (FRED API — Fed Funds Rate)
 *   2. Wire International FX summary (Frankfurter API — rendered inside ExceptionDrillDown)
 *   3. MarketauxNewsFeed (Marketaux API — payments industry news)
 *
 * Each section is independently wrapped in an ApiErrorBoundary so a failure
 * in one does not affect the others (Req 12.1–12.6, Req 18.5–18.7).
 *
 * All API fetches are deferred until after the initial simulated data render
 * via a `mounted` gate controlled by useEffect (Req 12.5, Req 18.5).
 */
function MarketContextPanel() {
  // Defer rendering of API sections until after first paint (Req 12.5)
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const dp = useDataProvider();
  const wireIntlGroups = dp
    .getExceptionQueue()
    .filter(g => g.rail === 'Wire_International');

  const wireIntlCurrencies = [
    ...new Set(
      wireIntlGroups
        .flatMap(g => g.transactions)
        .map(tx => tx.destinationCurrency)
        .filter((c): c is string => Boolean(c))
    ),
  ];

  return (
    <section aria-label="Market Context Panel">
      <h2 className="text-sm font-bold uppercase tracking-widest text-nymbus-teal mb-4">Market Context</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* ── Section 1: Fed Funds Rate ──────────────────────────────────── */}
        <div>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">
            Economic Indicator
          </h3>
          <ApiErrorBoundary source="fred">
            {mounted ? <FredIndicator /> : <SectionPlaceholder />}
          </ApiErrorBoundary>
        </div>

        {/* ── Section 2: Wire International FX ──────────────────────────── */}
        <div>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">
            Wire International FX
          </h3>
          <ApiErrorBoundary source="frankfurter">
            {mounted ? (
              <WireIntlFxSummary currencies={wireIntlCurrencies} />
            ) : (
              <SectionPlaceholder />
            )}
          </ApiErrorBoundary>
        </div>

        {/* ── Section 3: Industry News ───────────────────────────────────── */}
        <div>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">
            Industry News
          </h3>
          <ApiErrorBoundary source="marketaux">
            {mounted ? <MarketauxNewsFeed /> : <SectionPlaceholder />}
          </ApiErrorBoundary>
        </div>

      </div>
    </section>
  );
}

// ─── Wire International FX Summary ───────────────────────────────────────────

/**
 * Displays a summary of active Wire_International destination currencies
 * from the exception queue. FX conversion is handled inline within
 * ExceptionDrillDown per transaction; this section surfaces the currencies
 * present so ops teams know which FX exposures exist at a glance.
 *
 * FxConversionInline is intentionally rendered inside ExceptionDrillDown
 * (task 17/18) where fxLastFetch and retryFx state are scoped correctly.
 * This panel shows a currency presence summary only.
 */
function WireIntlFxSummary({ currencies }: { currencies: string[] }) {
  if (currencies.length === 0) {
    return (
      <div className="rounded-md border border-gray-200 bg-white p-3 text-sm text-gray-500">
        No Wire International exceptions — FX rates will appear here when
        Wire International transactions are expanded in the Exception Queue.
      </div>
    );
  }

  return (
    <div className="rounded-md border border-gray-200 bg-white p-3 text-sm" aria-label="Wire International FX currencies">
      <p className="text-xs text-gray-500 mb-2">
        Active destination currencies in exception queue:
      </p>
      <ul className="flex flex-wrap gap-2" role="list">
        {currencies.map(currency => (
          <li
            key={currency}
            className="inline-flex items-center rounded-full bg-nymbus-teal/10 px-2 py-1 text-xs font-semibold text-nymbus-teal-dim ring-1 ring-nymbus-teal/30"
          >
            USD → {currency}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-gray-400">
        Expand a Wire International exception in the queue above to see live FX conversions.
      </p>
    </div>
  );
}

// ─── Loading placeholder ──────────────────────────────────────────────────────

function SectionPlaceholder() {
  return (
    <div className="rounded-md border border-gray-100 bg-gray-50 p-3 animate-pulse h-20" aria-hidden="true" />
  );
}

export default memo(MarketContextPanel);
