import { memo } from 'react';
import { useDataProvider } from '../context/DataProviderContext';
import RailHealthCard from './RailHealthCard';

const RailHealthOverview = memo(function RailHealthOverview() {
  const railData = useDataProvider().getRailData();

  return (
    <section aria-label="Rail Health Overview">
      <h2 className="text-lg font-bold text-gray-900 mb-3">Rail Health Overview</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {railData.map(rd => (
          <RailHealthCard key={rd.rail} data={rd} />
        ))}
      </div>
    </section>
  );
});

export default RailHealthOverview;
