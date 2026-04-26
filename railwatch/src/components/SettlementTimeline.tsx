import React from 'react';
import {
  ComposedChart,
  Bar,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts';
import type { IntradayTimelineEntry } from '../types';

interface Props {
  data: IntradayTimelineEntry[];
}

function fmtYAxis(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value}`;
}

function fmtHour(hour: number): string {
  if (hour === 12) return '12pm';
  if (hour > 12) return `${hour - 12}pm`;
  return `${hour}am`;
}

const SettlementTimeline = React.memo(function SettlementTimeline({ data }: Props) {
  const currentHour = new Date().getHours();

  return (
    <div className="mt-4">
      <div className="text-xs text-gray-500 mb-2 font-medium">Intraday Settlement Timeline (8am–6pm ET)</div>
      <ResponsiveContainer width="100%" height={200}>
        <ComposedChart data={data} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="hour"
            tickFormatter={fmtHour}
            tick={{ fontSize: 11 }}
          />
          <YAxis
            tickFormatter={fmtYAxis}
            tick={{ fontSize: 11 }}
            width={56}
          />
          <Tooltip
            formatter={(value: number, name: string) => [
              `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
              name === 'projectedObligation' ? 'Projected Obligation' : 'Settled to Date',
            ]}
            labelFormatter={(label: number) => `Hour: ${fmtHour(label)}`}
          />
          <Legend
            formatter={(value: string) =>
              value === 'projectedObligation' ? 'Projected Obligation' : 'Settled to Date'
            }
          />
          <Bar
            dataKey="projectedObligation"
            fill="#93c5fd"
            opacity={0.8}
            isAnimationActive={false}
          />
          <Area
            dataKey="settledToDate"
            stroke="#2563eb"
            fill="#dbeafe"
            strokeWidth={2}
            isAnimationActive={false}
          />
          {currentHour >= 8 && currentHour <= 18 && (
            <ReferenceLine
              x={currentHour}
              stroke="#ef4444"
              strokeDasharray="4 2"
              label={{ value: 'Now', position: 'top', fontSize: 10, fill: '#ef4444' }}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
});

export default SettlementTimeline;
