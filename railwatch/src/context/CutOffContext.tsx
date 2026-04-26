import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import type { CutOffSummary } from '../types';

interface CutOffContextValue {
  summary: CutOffSummary;
  setSummary: (s: CutOffSummary) => void;
}

const CutOffContext = createContext<CutOffContextValue | null>(null);

const DEFAULT_SUMMARY: CutOffSummary = {
  nextRail: null,
  nextWindowLabel: null,
  secondsRemaining: null,
};

export function CutOffContextProvider({ children }: { children: ReactNode }) {
  const [summary, setSummary] = useState<CutOffSummary>(DEFAULT_SUMMARY);
  return (
    <CutOffContext.Provider value={{ summary, setSummary }}>
      {children}
    </CutOffContext.Provider>
  );
}

/** Read the current cut-off summary (used by StatusBar). */
export function useCutOffSummary(): CutOffSummary {
  const ctx = useContext(CutOffContext);
  if (!ctx) throw new Error('useCutOffSummary must be used within CutOffContextProvider');
  return ctx.summary;
}

/** Write a new cut-off summary (used by CutOffTimeMonitor on each tick). */
export function useSetCutOffSummary(): (s: CutOffSummary) => void {
  const ctx = useContext(CutOffContext);
  if (!ctx) throw new Error('useSetCutOffSummary must be used within CutOffContextProvider');
  return ctx.setSummary;
}
