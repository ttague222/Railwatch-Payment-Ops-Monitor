import type { NewsArticle, MarketauxCache, ApiErrorType } from '../types/index';

// ─── Constants ────────────────────────────────────────────────────────────────

export const MARKETAUX_CACHE_KEY = 'railwatch_marketaux_news';
export const MARKETAUX_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
export const MARKETAUX_MONTHLY_LIMIT = 90;             // conservative cap below 100/month free tier
const MARKETAUX_FETCH_TIMEOUT_MS = 5000;

const MARKETAUX_API_TOKEN = import.meta.env.VITE_MARKETAUX_API_TOKEN || '';

// ─── Endpoint configuration ───────────────────────────────────────────────────
//
// In dev mode, Vite proxies /api/marketaux → https://api.marketaux.com
// so no third-party CORS proxy is needed (see vite.config.ts server.proxy).
//
// In production, replace this with a call to your own backend route (e.g. /api/marketaux)
// so the API token stays server-side and rate limit tracking is persistent.
// ──────────────────────────────────────────────────────────────────────────────

const MARKETAUX_ENDPOINT =
  '/api/marketaux/v1/news/all' +
  `?api_token=${MARKETAUX_API_TOKEN}` +
  '&search=FedNow OR RTP OR "instant payments" OR ACH OR "payment rails"' +
  '&language=en' +
  '&limit=5' +
  '&sort=published_at';

// ─── Raw API shapes ───────────────────────────────────────────────────────────

interface MarketauxRawArticle {
  uuid: string;
  title: string;
  source: string;
  published_at: string;
  entities: Array<{ sentiment_score: number }>;
}

interface MarketauxApiResponse {
  data: MarketauxRawArticle[];
}

// ─── Monthly counter helpers ──────────────────────────────────────────────────

/**
 * Returns the LocalStorage key for the current calendar month's request counter.
 * A new key each month provides automatic reset with no explicit reset logic.
 */
export function getMarketauxCounterKey(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  return `railwatch_marketaux_count_${yyyy}_${mm}`;
}

/** Read the current month's request count from LocalStorage. */
export function readMarketauxCount(): number {
  try {
    const key = getMarketauxCounterKey();
    return parseInt(localStorage.getItem(key) ?? '0', 10);
  } catch {
    return 0;
  }
}

/** Increment the current month's request counter in LocalStorage. */
export function incrementMarketauxCount(): void {
  try {
    const key = getMarketauxCounterKey();
    const current = readMarketauxCount();
    localStorage.setItem(key, String(current + 1));
  } catch {
    // storage full — continue without incrementing
  }
}

// ─── Cache helpers ────────────────────────────────────────────────────────────

/**
 * Read the Marketaux news cache from LocalStorage.
 * Returns null if absent, expired (> 30 min), or unparseable.
 */
export function readMarketauxCache(): MarketauxCache | null {
  try {
    const raw = localStorage.getItem(MARKETAUX_CACHE_KEY);
    if (!raw) return null;
    const cached: MarketauxCache = JSON.parse(raw);
    const age = Date.now() - new Date(cached.fetchedAt).getTime();
    if (age > MARKETAUX_CACHE_TTL_MS) return null;
    return cached;
  } catch {
    return null;
  }
}

/** Write Marketaux articles to LocalStorage. Silently swallows storage-full errors. */
export function writeMarketauxCache(articles: NewsArticle[]): void {
  try {
    const cache: MarketauxCache = {
      articles,
      fetchedAt: new Date().toISOString(),
    };
    localStorage.setItem(MARKETAUX_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // storage full — continue without caching
  }
}

// ─── Response mapping ─────────────────────────────────────────────────────────

/**
 * Map a raw Marketaux article to the internal NewsArticle shape.
 * Sentiment label thresholds: > 0.15 = Positive, < -0.15 = Negative, else Neutral.
 */
export function mapMarketauxArticle(raw: MarketauxRawArticle): NewsArticle {
  const scores = (raw.entities ?? []).map(e => e.sentiment_score);
  const avg =
    scores.length > 0
      ? scores.reduce((a, b) => a + b, 0) / scores.length
      : 0;
  return {
    id: raw.uuid,
    headline: raw.title,
    source: raw.source,
    publishedAt: raw.published_at,
    sentimentScore: avg,
    sentimentLabel: avg > 0.15 ? 'Positive' : avg < -0.15 ? 'Negative' : 'Neutral',
  };
}

// ─── Fetch ────────────────────────────────────────────────────────────────────

/**
 * Fetch the latest payments industry news from Marketaux with a 5-second timeout.
 * Resolves with an array of NewsArticle (3–5 items) on success.
 * Rejects with an Error whose message is one of: 'timeout' | 'network' | 'malformed'.
 *
 * Does NOT check the monthly counter — callers are responsible for that guard.
 * Does NOT increment the counter — callers must call incrementMarketauxCount() on success.
 */
export async function fetchMarketauxNews(): Promise<NewsArticle[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), MARKETAUX_FETCH_TIMEOUT_MS);

  try {
    let response: Response;
    try {
      response = await fetch(MARKETAUX_ENDPOINT, { signal: controller.signal });
    } catch (err) {
      const isAbort = err instanceof DOMException && err.name === 'AbortError';
      const errorType: ApiErrorType = isAbort ? 'timeout' : 'network';
      throw new Error(errorType);
    }

    if (!response.ok) {
      throw new Error('malformed');
    }

    let json: MarketauxApiResponse;
    try {
      json = await response.json();
    } catch {
      throw new Error('malformed');
    }

    if (!Array.isArray(json?.data)) {
      throw new Error('malformed');
    }

    return json.data.map(mapMarketauxArticle);
  } finally {
    clearTimeout(timer);
  }
}
