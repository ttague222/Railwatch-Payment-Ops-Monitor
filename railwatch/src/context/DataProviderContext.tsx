import { createContext, useContext } from 'react';
import type { DataProvider } from '../types';

export const DataProviderContext = createContext<DataProvider | null>(null);

/**
 * Hook for consuming the DataProvider. All dashboard components must use
 * this hook — direct context consumption is not permitted in leaf components.
 * Throws if used outside a DataProviderContext.Provider.
 */
export function useDataProvider(): DataProvider {
  const ctx = useContext(DataProviderContext);
  if (!ctx) throw new Error('useDataProvider must be used within DataProviderContext.Provider');
  return ctx;
}
