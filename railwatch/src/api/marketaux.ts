import type { NewsArticle, MarketauxCache, ApiErrorType } from '../types/index';

// ─── Constants ────────────────────────────────────────────────────────────────

export const MARKETAUX_CACHE_KEY = 'railwatch_marketaux_news';
export const MARKETAUX_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
export const MARKETAUX_MONTHLY_LIMIT = 90;             // conservative cap below 100/month free tier
const MARKETAUX_FETCH_TIMEOUT_MS = 5000;

const MARKETAUX_API_TOKEN = import.meta.env.VITE_MARKETAUX_API_TOKEN || '';

// ─── CORS Proxy Configuration (DEMO MODE ONLY) ───────────────────────────────
//
// NOTE: This CORS proxy is used ONLY for browser-based demo purposes.
//
// PRODUCTION IMPLEMENTATION:
// In production, API calls to Marketaux would be made from a backend server (not the browser).
// The backend would:
//   1. Receive requests from the React frontend
//   2. Make the Marketaux API call server-side (no CORS restrictions)
//   3. Implement request counter persistence in database to enforce monthly limits
//   4. Cache responses with 30-minute TTL to reduce API usage
//   5. Return formatted data to the frontend
//
// This eliminates CORS issues and provides better security (API tokens stay server-side),
// persistent rate limit tracking across sessions, and proper caching.
//
// For demo purposes, we use corsproxy.io to bypass browser CORS restrictions.
// ──────────────────────────────────────────────────────────────────────────────

const USE_CORS_PROXY = true; // Set to false when running through a backend proxy

const MARKETAUX_BASE_ENDPOINT =
  'https://api.marketaux.com/v1/news/all' +
  `?api_token=${MARKETAUX_API_TOKEN}` +
  '&search=FedNow OR RTP OR "instant payments" OR ACH OR "payment rails"' +
  '&language=en' +
  '&limit=5' +
  '&sort=published_at';

const MARKETAUX_ENDPOINT = USE_CORS_PROXY
  ? `https://corsproxy.io/?${encodeURIComponent(MARKETAUX_BASE_ENDPOINT)}`
  : MARKETAUX_BASE_ENDPOINT;

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
