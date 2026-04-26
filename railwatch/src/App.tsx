import { useState, useCallback, Component } from 'react';
import type { ReactNode } from 'react';
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

// ─── Simulator Error Boundary (Req 18.3) ─────────────────────────────────────

interface SimulatorErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

class SimulatorErrorBoundary extends Component<
  { children: ReactNode },
  SimulatorErrorBoundaryState
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: unknown): SimulatorErrorBoundaryState {
    const msg = error instanceof Error ? error.message : String(error);
    return { hasError: true, errorMessage: msg };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          className="fixed inset-0 flex flex-col items-center justify-center bg-gray-950 text-white p-8"
        >
          <h1 className="text-2xl font-bold mb-4">Simulator Error</h1>
          <p className="text-gray-300 mb-6 text-center max-w-md">
            The data simulator failed to initialize. This is a demo environment error.
          </p>
          {this.state.errorMessage && (
            <pre className="text-xs text-red-400 bg-gray-900 rounded p-3 mb-6 max-w-lg overflow-auto">
              {this.state.errorMessage}
            </pre>
          )}
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-500 rounded font-semibold"
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ─── App ──────────────────────────────────────────────────────────────────────

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
    <SimulatorErrorBoundary>
      <DataProviderContext.Provider value={provider}>
        <CutOffContextProvider>
          <MarketauxContextProvider>
            {/* Branded product header */}
            <div className="bg-nymbus-navy px-4 py-1.5 flex items-center gap-2 border-b border-nymbus-teal/20">
              <span className="text-nymbus-teal font-bold text-sm tracking-widest uppercase">RailWatch</span>
              <span className="text-gray-500 text-xs">Payment Operations Monitor</span>
            </div>
            <DemoModeBanner />
            <StatusBar generatedAt={generatedAt} onRefresh={refresh} />
            <FirstRunOverlay />
            <main className="p-4 space-y-6 bg-nymbus-mist min-h-screen">
              <RailHealthOverview />
              <ExceptionQueueMonitor />
              <SettlementPositionTracker />
              <CutOffTimeMonitor />
              <section className="bg-white rounded-xl border border-gray-200 p-4 shadow-md">
                <MarketContextPanel />
              </section>
              <DailySummaryExport generatedAt={generatedAt} />
            </main>
          </MarketauxContextProvider>
        </CutOffContextProvider>
      </DataProviderContext.Provider>
    </SimulatorErrorBoundary>
  );
}

export default App;
