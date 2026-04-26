import { useState, useCallback } from 'react';
import type { DataProvider } from './types';
import { DataProviderContext } from './context/DataProviderContext';
import { CutOffContextProvider } from './context/CutOffContext';
import { MarketauxContextProvider } from './context/MarketauxContext';
import { SimulatorDataProvider } from './providers/SimulatorDataProvider';
import DemoModeBanner from './components/DemoModeBanner';
import StatusBar from './components/StatusBar';
import FirstRunOverlay from './components/FirstRunOverlay';
import RailHealthOverview from './components/RailHealthOverview';
import ExceptionQueueMonitor from './components/ExceptionQueueMonitor';
import SettlementPositionTracker from './components/SettlementPositionTracker';
import CutOffTimeMonitor from './components/CutOffTimeMonitor';
import MarketContextPanel from './components/MarketContextPanel';
import DailySummaryExport from './components/DailySummaryExport';

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
          <StatusBar generatedAt={generatedAt} onRefresh={refresh} />
          <FirstRunOverlay />
          <main className="p-4 space-y-6">
            <RailHealthOverview />
            <ExceptionQueueMonitor />
            <SettlementPositionTracker />
            <CutOffTimeMonitor />
            <section className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
              <MarketContextPanel />
            </section>
            <DailySummaryExport generatedAt={generatedAt} />
          </main>
        </MarketauxContextProvider>
      </CutOffContextProvider>
    </DataProviderContext.Provider>
  );
}

export default App;
