import { useState, useCallback } from 'react';
import type { DataProvider } from './types';
import { DataProviderContext } from './context/DataProviderContext';
import { CutOffContextProvider } from './context/CutOffContext';
import { MarketauxContextProvider } from './context/MarketauxContext';
import { SimulatorDataProvider } from './providers/SimulatorDataProvider';
import DemoModeBanner from './components/DemoModeBanner';
import FirstRunOverlay from './components/FirstRunOverlay';
import RailHealthOverview from './components/RailHealthOverview';
import ExceptionQueueMonitor from './components/ExceptionQueueMonitor';
import SettlementPositionTracker from './components/SettlementPositionTracker';
import CutOffTimeMonitor from './components/CutOffTimeMonitor';
import MarketContextPanel from './components/MarketContextPanel';

function App() {
  const [provider, setProvider] = useState<DataProvider>(
    () => new SimulatorDataProvider()
  );
  const [generatedAt, setGeneratedAt] = useState<Date>(() => new Date());

  const refresh = useCallback(() => {
    setProvider(new SimulatorDataProvider());
    setGeneratedAt(new Date());
  }, []);

  return (
    <DataProviderContext.Provider value={provider}>
      <CutOffContextProvider>
        <MarketauxContextProvider>
          <DemoModeBanner />
          {/* StatusBar placeholder — wired in task 28 */}
          <div id="status-bar-placeholder" className="px-4 py-1 text-xs text-gray-400 bg-gray-50 border-b border-gray-200">
            Last generated: {generatedAt.toLocaleTimeString()}
            <button
              onClick={refresh}
              className="ml-4 px-2 py-0.5 rounded bg-blue-100 text-blue-700 hover:bg-blue-200 text-xs"
            >
              Refresh Data
            </button>
          </div>
          <FirstRunOverlay />
          <main className="p-4 space-y-6">
            <RailHealthOverview />
            <ExceptionQueueMonitor />
            <SettlementPositionTracker />
            <CutOffTimeMonitor />
            <section className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
              <MarketContextPanel />
            </section>
            {/* DailySummaryExport — task 27 */}
            <section id="daily-summary-placeholder" />
          </main>
        </MarketauxContextProvider>
      </CutOffContextProvider>
    </DataProviderContext.Provider>
  );
}

export default App;
