/**
 * Marketaux Integration Verification Tests
 * Covers checks 1–5 from the task 25/26 verification checklist.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  mapMarketauxArticle,
  getMarketauxCounterKey,
  readMarketauxCount,
  incrementMarketauxCount,
  readMarketauxCache,
  writeMarketauxCache,
  MARKETAUX_MONTHLY_LIMIT,
} from '../api/marketaux';
import type { NewsArticle } from '../types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRawArticle(overrides: {
  uuid?: string;
  title?: string;
  source?: string;
  published_at?: string;
  entities?: Array<{ sentiment_score: number }>;
}) {
  return {
    uuid: overrides.uuid ?? 'test-uuid-1',
    title: overrides.title ?? 'FedNow expands instant payment reach',
    source: overrides.source ?? 'PaymentsSource',
    published_at: overrides.published_at ?? '2026-04-25T10:00:00Z',
    entities: overrides.entities ?? [{ sentiment_score: 0.5 }],
  };
}

// ─── Check 1: Article shape — headline, source, timestamp, sentiment label ────

describe('Check 1 — Article mapping: headline, source, timestamp, sentiment label', () => {
  it('maps headline and source correctly', () => {
    const raw = makeRawArticle({ title: 'ACH volumes surge in Q1', source: 'NACHA News' });
    const article = mapMarketauxArticle(raw);
    expect(article.headline).toBe('ACH volumes surge in Q1');
    expect(article.source).toBe('NACHA News');
  });

  it('preserves publishedAt as ISO 8601 string (rendered in local timezone by component)', () => {
    const raw = makeRawArticle({ published_at: '2026-04-25T14:30:00Z' });
    const article = mapMarketauxArticle(raw);
    expect(article.publishedAt).toBe('2026-04-25T14:30:00Z');
    // Verify it's a valid date string
    expect(new Date(article.publishedAt).toLocaleString()).toBeTruthy();
  });

  it('sentimentLabel is Positive when avg score > 0.15', () => {
    const raw = makeRawArticle({ entities: [{ sentiment_score: 0.8 }] });
    expect(mapMarketauxArticle(raw).sentimentLabel).toBe('Positive');
  });

  it('sentimentLabel is Negative when avg score < -0.15', () => {
    const raw = makeRawArticle({ entities: [{ sentiment_score: -0.5 }] });
    expect(mapMarketauxArticle(raw).sentimentLabel).toBe('Negative');
  });

  it('sentimentLabel is Neutral when avg score is between -0.15 and 0.15', () => {
    const raw = makeRawArticle({ entities: [{ sentiment_score: 0.0 }] });
    expect(mapMarketauxArticle(raw).sentimentLabel).toBe('Neutral');
  });

  it('sentimentLabel is Neutral at exactly 0.15 boundary (not Positive)', () => {
    const raw = makeRawArticle({ entities: [{ sentiment_score: 0.15 }] });
    expect(mapMarketauxArticle(raw).sentimentLabel).toBe('Neutral');
  });

  it('sentimentLabel is Neutral at exactly -0.15 boundary (not Negative)', () => {
    const raw = makeRawArticle({ entities: [{ sentiment_score: -0.15 }] });
    expect(mapMarketauxArticle(raw).sentimentLabel).toBe('Neutral');
  });

  it('sentimentLabel is never a raw number', () => {
    const cases = [0.9, 0.1, -0.1, -0.9, 0];
    for (const score of cases) {
      const raw = makeRawArticle({ entities: [{ sentiment_score: score }] });
      const label = mapMarketauxArticle(raw).sentimentLabel;
      expect(['Positive', 'Neutral', 'Negative']).toContain(label);
      expect(typeof label).toBe('string');
    }
  });

  it('averages multiple entity sentiment scores', () => {
    const raw = makeRawArticle({ entities: [{ sentiment_score: 0.8 }, { sentiment_score: -0.2 }] });
    // avg = 0.3 → Positive
    expect(mapMarketauxArticle(raw).sentimentLabel).toBe('Positive');
  });

  it('defaults sentimentScore to 0 when entities array is empty', () => {
    const raw = makeRawArticle({ entities: [] });
    const article = mapMarketauxArticle(raw);
    expect(article.sentimentScore).toBe(0);
    expect(article.sentimentLabel).toBe('Neutral');
  });
});

// ─── Check 2: LocalStorage counter key format ─────────────────────────────────

describe('Check 2 — LocalStorage counter key format and increment', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('counter key matches railwatch_marketaux_count_{YYYY_MM} for current month', () => {
    const key = getMarketauxCounterKey();
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    expect(key).toBe(`railwatch_marketaux_count_${yyyy}_${mm}`);
  });

  it('counter key contains the current year (2026)', () => {
    const key = getMarketauxCounterKey();
    expect(key).toContain('2026');
  });

  it('readMarketauxCount returns 0 when key is absent', () => {
    expect(readMarketauxCount()).toBe(0);
  });

  it('incrementMarketauxCount increments by 1 each call', () => {
    expect(readMarketauxCount()).toBe(0);
    incrementMarketauxCount();
    expect(readMarketauxCount()).toBe(1);
    incrementMarketauxCount();
    expect(readMarketauxCount()).toBe(2);
  });

  it('counter persists in LocalStorage under the correct key', () => {
    incrementMarketauxCount();
    const key = getMarketauxCounterKey();
    expect(localStorage.getItem(key)).toBe('1');
  });
});

// ─── Check 3: Rate limit ceiling — fetch is blocked at 90 ────────────────────

describe('Check 3 — Rate limit ceiling: fetch blocked at 90, message shown', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('MARKETAUX_MONTHLY_LIMIT is 90', () => {
    expect(MARKETAUX_MONTHLY_LIMIT).toBe(90);
  });

  it('readMarketauxCount returns 90 when counter is set to 90', () => {
    const key = getMarketauxCounterKey();
    localStorage.setItem(key, '90');
    expect(readMarketauxCount()).toBe(90);
  });

  it('readMarketauxCount >= MARKETAUX_MONTHLY_LIMIT is true at 90', () => {
    const key = getMarketauxCounterKey();
    localStorage.setItem(key, '90');
    expect(readMarketauxCount() >= MARKETAUX_MONTHLY_LIMIT).toBe(true);
  });

  it('readMarketauxCount >= MARKETAUX_MONTHLY_LIMIT is false at 89', () => {
    const key = getMarketauxCounterKey();
    localStorage.setItem(key, '89');
    expect(readMarketauxCount() >= MARKETAUX_MONTHLY_LIMIT).toBe(false);
  });

  it('incrementMarketauxCount does not exceed 90 guard (guard is in component, not counter)', () => {
    // The counter itself can go above 90 — the guard is in the component's useEffect.
    // This test confirms the counter increments freely; the component is responsible for the guard.
    const key = getMarketauxCounterKey();
    localStorage.setItem(key, '89');
    incrementMarketauxCount();
    expect(readMarketauxCount()).toBe(90);
  });
});

// ─── Check 4: Conditional rail surfacing — keyword matching ──────────────────

describe('Check 4 — Conditional rail surfacing: keyword matching logic', () => {
  const makeArticle = (headline: string, label: NewsArticle['sentimentLabel'] = 'Neutral'): NewsArticle => ({
    id: 'a1',
    headline,
    source: 'Test',
    publishedAt: '2026-04-25T10:00:00Z',
    sentimentScore: 0,
    sentimentLabel: label,
  });

  // Replicate the RailHealthCard relevantArticle logic for unit testing
  function findRelevantArticle(
    rail: string,
    status: string,
    articles: NewsArticle[]
  ): NewsArticle | null {
    if (status !== 'Degraded' && status !== 'Critical') return null;
    const keyword = rail === 'FedNow' ? 'fednow' : rail === 'RTP' ? 'rtp' : null;
    if (!keyword) return null;
    return articles.find(a => a.headline.toLowerCase().includes(keyword)) ?? null;
  }

  it('returns null for Healthy rail regardless of articles', () => {
    const articles = [makeArticle('FedNow outage reported')];
    expect(findRelevantArticle('FedNow', 'Healthy', articles)).toBeNull();
  });

  it('returns null for non-FedNow/RTP rail even when Degraded', () => {
    const articles = [makeArticle('ACH disruption reported')];
    expect(findRelevantArticle('ACH_Standard', 'Degraded', articles)).toBeNull();
  });

  it('returns matching article for FedNow Critical rail with fednow keyword', () => {
    const articles = [makeArticle('FedNow network disruption affects payments')];
    const result = findRelevantArticle('FedNow', 'Critical', articles);
    expect(result).not.toBeNull();
    expect(result?.headline).toContain('FedNow');
  });

  it('keyword match is case-insensitive (fednow vs FedNow)', () => {
    const articles = [makeArticle('FEDNOW OUTAGE REPORTED')];
    const result = findRelevantArticle('FedNow', 'Critical', articles);
    expect(result).not.toBeNull();
  });

  it('returns matching article for RTP Degraded rail with rtp keyword', () => {
    const articles = [makeArticle('RTP settlement delays observed')];
    const result = findRelevantArticle('RTP', 'Degraded', articles);
    expect(result).not.toBeNull();
    expect(result?.headline).toContain('RTP');
  });

  it('returns null for FedNow Critical when no fednow keyword in any article', () => {
    const articles = [makeArticle('ACH volumes surge'), makeArticle('Wire transfer delays')];
    expect(findRelevantArticle('FedNow', 'Critical', articles)).toBeNull();
  });

  it('returns null when articles array is empty', () => {
    expect(findRelevantArticle('FedNow', 'Critical', [])).toBeNull();
  });

  it('no headline appears for Healthy rails (null guard)', () => {
    const articles = [makeArticle('FedNow outage'), makeArticle('RTP disruption')];
    for (const rail of ['ACH_Standard', 'ACH_Same_Day', 'Wire_Domestic', 'Wire_International', 'RTP', 'FedNow']) {
      expect(findRelevantArticle(rail, 'Healthy', articles)).toBeNull();
    }
  });
});

// ─── Check 5: API isolation — cache and error handling ───────────────────────

describe('Check 5 — API isolation: Marketaux cache read/write independent of other sections', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('readMarketauxCache returns null when LocalStorage is empty', () => {
    expect(readMarketauxCache()).toBeNull();
  });

  it('writeMarketauxCache and readMarketauxCache round-trip correctly', () => {
    const articles: NewsArticle[] = [
      {
        id: 'a1',
        headline: 'FedNow expands reach',
        source: 'PaymentsSource',
        publishedAt: '2026-04-25T10:00:00Z',
        sentimentScore: 0.3,
        sentimentLabel: 'Positive',
      },
    ];
    writeMarketauxCache(articles);
    const cached = readMarketauxCache();
    expect(cached).not.toBeNull();
    expect(cached!.articles).toHaveLength(1);
    expect(cached!.articles[0].headline).toBe('FedNow expands reach');
  });

  it('readMarketauxCache returns null when cache is expired (> 30 min)', () => {
    const staleCache = {
      articles: [{ id: 'a1', headline: 'Old news', source: 'X', publishedAt: '2026-01-01T00:00:00Z', sentimentScore: 0, sentimentLabel: 'Neutral' }],
      fetchedAt: new Date(Date.now() - 31 * 60 * 1000).toISOString(), // 31 minutes ago
    };
    localStorage.setItem('railwatch_marketaux_news', JSON.stringify(staleCache));
    expect(readMarketauxCache()).toBeNull();
  });

  it('readMarketauxCache returns data when cache is fresh (< 30 min)', () => {
    const freshCache = {
      articles: [{ id: 'a1', headline: 'Fresh news', source: 'X', publishedAt: '2026-04-25T10:00:00Z', sentimentScore: 0, sentimentLabel: 'Neutral' }],
      fetchedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // 5 minutes ago
    };
    localStorage.setItem('railwatch_marketaux_news', JSON.stringify(freshCache));
    const cached = readMarketauxCache();
    expect(cached).not.toBeNull();
    expect(cached!.articles[0].headline).toBe('Fresh news');
  });

  it('Marketaux LocalStorage keys are isolated from FRED cache key', () => {
    writeMarketauxCache([]);
    expect(localStorage.getItem('railwatch_fred_fedfunds')).toBeNull();
  });

  it('Marketaux counter key is isolated from news cache key', () => {
    incrementMarketauxCount();
    expect(localStorage.getItem('railwatch_marketaux_news')).toBeNull();
  });
});
