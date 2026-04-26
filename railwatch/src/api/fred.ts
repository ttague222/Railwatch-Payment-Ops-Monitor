import type { FredIndicatorData, ApiErrorType } from '../types/index';

// ─── Constants ────────────────────────────────────────────────────────────────

export const FRED_CACHE_KEY = 'railwatch_fred_fedfunds';
export const FRED_STALE_MS = 4 * 60 * 60 * 1000;   // 4 hours
export const FRED_TTL_MS   = 24 * 60 * 60 * 1000;  // 24 hours
const FRED_FETCH_TIMEOUT_MS = 5000;

const FRED_API_KEY = import.meta.env.VITE_FRED_API_KEY || 'DEMO_KEY';

// ─── Endpoint configuration ───────────────────────────────────────────────────
//
// In dev mode, Vite proxies /api/fred → https://api.stlouisfed.org/fred
// so no third-party CORS proxy is needed (see vite.config.ts server.proxy).
//
// In production, replace this with a call to your own backend route (e.g. /api/fred)
// so the API key stays server-side and caching is persistent across sessions.
// ──────────────────────────────────────────────────────────────────────────────

const FRED_ENDPOINT =
  '/api/fred/series/observations' +
  '?series_id=FEDFUNDS' +
  `&api_key=${FRED_API_KEY}` +
  '&limit=2' +
  '&sort_order=desc' +
  '&file_type=json';

// ─── Raw API shape ────────────────────────────────────────────────────────────

interface FredApiResponse {
  observations: Array<{
    date: string;   // "YYYY-MM-DD"
    value: string;  // numeric string, e.g. "5.33"; "." = FRED null sentinel
  }>;
}

// ─── Cache helpers ────────────────────────────────────────────────────────────

/**
 * Read the FRED cache from LocalStorage.
 * Returns null if absent, expired (> 24h), or unparseable.
 * Returns { data, isStale: true } when age is between 4h and 24h.
 */
export function readFredCache(): { data: FredIndicatorData; isStale: boolean } | null {
  try {
    const raw = localStorage.getItem(FRED_CACHE_KEY);
    if (!raw) return null;
    const cached: FredIndicatorData = JSON.parse(raw);
    const age = Date.now() - new Date(cached.fetchedAt).getTime();
    if (age > FRED_TTL_MS) return null;
    return { data: cached, isStale: age > FRED_STALE_MS };
  } catch {
    return null;
  }
}

/**
 * Write FRED data to LocalStorage. Silently swallows storage-full errors.
 */
export function writeFredCache(data: FredIndicatorData): void {
  try {
    localStorage.setItem(FRED_CACHE_KEY, JSON.stringify(data));
  } catch {
    // storage full — continue without caching
  }
}

// ─── Response mapping ─────────────────────────────────────────────────────────

/**
 * Map a raw FRED API response to the internal FredIndicatorData shape.
 * Throws if the response is malformed or contains FRED's null sentinel ".".
 */
export function mapFredResponse(raw: FredApiResponse): FredIndicatorData {
  const obs = raw?.observations;
  if (!Array.isArray(obs) || obs.length < 2) {
    throw new Error('malformed');
  }
  const [current, prior] = obs;
  if (current.value === '.' || prior.value === '.') {
    throw new Error('malformed');
  }
  const currentRate = parseFloat(current.value);
  const priorRate   = parseFloat(prior.value);
  if (isNaN(currentRate) || isNaN(priorRate)) {
    throw new Error('malformed');
  }
  return {
    currentRate,
    currentDate: current.date,
    priorRate,
    priorDate: prior.date,
    momChange: Math.round((currentRate - priorRate) * 100) / 100,
    fetchedAt: new Date().toISOString(),
  };
}

// ─── Fetch ────────────────────────────────────────────────────────────────────

/**
 * Fetch the FRED FEDFUNDS series with a 5-second AbortController timeout.
 * Resolves with FredIndicatorData on success.
 * Rejects with an Error whose message is one of: 'timeout' | 'network' | 'malformed'.
 */
export async function fetchFredRate(): Promise<FredIndicatorData> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FRED_FETCH_TIMEOUT_MS);

  try {
    let response: Response;
    try {
      response = await fetch(FRED_ENDPOINT, { signal: controller.signal });
    } catch (err) {
      // AbortError = timeout; TypeError = network failure
      const isAbort = err instanceof DOMException && err.name === 'AbortError';
      const errorType: ApiErrorType = isAbort ? 'timeout' : 'network';
      throw new Error(errorType);
    }

    if (!response.ok) {
      // Surface HTTP errors as malformed so callers can handle them uniformly
      throw new Error('malformed');
    }

    let json: FredApiResponse;
    try {
      json = await response.json();
    } catch {
      throw new Error('malformed');
    }

    return mapFredResponse(json);
  } finally {
    clearTimeout(timer);
  }
}
