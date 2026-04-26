import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import type { NewsArticle } from '../types';

interface MarketauxContextValue {
  articles: NewsArticle[];
  setArticles: (articles: NewsArticle[]) => void;
}

const MarketauxContext = createContext<MarketauxContextValue | null>(null);

export function MarketauxContextProvider({ children }: { children: ReactNode }) {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  return (
    <MarketauxContext.Provider value={{ articles, setArticles }}>
      {children}
    </MarketauxContext.Provider>
  );
}

/** Read the current article list (used by RailHealthCard). */
export function useMarketauxArticles(): NewsArticle[] {
  const ctx = useContext(MarketauxContext);
  if (!ctx) throw new Error('useMarketauxArticles must be used within MarketauxContextProvider');
  return ctx.articles;
}

/** Write a new article list (used by MarketauxNewsFeed after fetch). */
export function useSetMarketauxArticles(): (articles: NewsArticle[]) => void {
  const ctx = useContext(MarketauxContext);
  if (!ctx) throw new Error('useSetMarketauxArticles must be used within MarketauxContextProvider');
  return ctx.setArticles;
}
