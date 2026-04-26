import { useState } from 'react';
import type { ExceptionGroup } from '../types';

// ─── Prop Types ───────────────────────────────────────────────────────────────

export interface FxConversionInlineProps {
  instructedAmount: number;
  destinationCurrency: string;
  /** Timestamp (Date.now()) of the last successful FX fetch for this currency */
  fxLastFetch: number | undefined;
  onRetry: () => void;
}

export interface ApiErrorBoundaryFxProps {
  /** Retry callbacks keyed by currency code, passed down from ExceptionDrillDown */
  retryFx: Record<string, () => void>;
}

export interface ExceptionDrillDownProps {
  group: ExceptionGroup;
}

// ─── Component ────────────────────────────────────────────────────────────────

function ExceptionDrillDown({ group }: ExceptionDrillDownProps) {
  // FX fetch state is scoped to ExceptionDrillDown to avoid stale closures across multiple drill-down instances
  const [fxLastFetch, setFxLastFetch] = useState<Record<string, number>>({});
  const [retryFx, setRetryFx] = useState<Record<string, () => void>>({});

  // Register a retry callback for a given currency code.
  // Called by FxConversionInline instances when they mount or when a retry is triggered.
  function registerRetryFx(currency: string, retryFn: () => void) {
    setRetryFx(prev => ({ ...prev, [currency]: retryFn }));
  }

  // Record a successful FX fetch timestamp for a given currency code.
  // Called by FxConversionInline instances after a successful fetch.
  function recordFxFetch(currency: string) {
    setFxLastFetch(prev => ({ ...prev, [currency]: Date.now() }));
  }

  // Full implementation in task 18.
  // group, fxLastFetch, retryFx, registerRetryFx, and recordFxFetch are all
  // available here for wiring into FxConversionInline and ApiErrorBoundary.
  void group;
  void fxLastFetch;
  void retryFx;
  void registerRetryFx;
  void recordFxFetch;

  return (
    <div className="border-t border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-500">
      {/* Full drill-down implementation in task 18 */}
      Drill-down coming in task 18
    </div>
  );
}

export default ExceptionDrillDown;
