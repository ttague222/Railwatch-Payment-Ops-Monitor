import { memo } from 'react';
import type { ExceptionGroup, PaymentRail } from '../types';
import ExceptionDrillDown from './ExceptionDrillDown';
import { formatUSD } from '../utils/format';

interface ExceptionGroupRowProps {
  group: ExceptionGroup;
  isExpanded: boolean;
  onToggle: () => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function ageHours(openedAt: string): number {
  return (Date.now() - new Date(openedAt).getTime()) / (1000 * 60 * 60);
}

type SlaStatus = 'ok' | 'warning' | 'breach';

const WARNING_HOURS: Record<PaymentRail, number> = {
  FedNow: 4, RTP: 4, ACH_Same_Day: 4,
  Wire_Domestic: 24, Wire_International: 24,
  ACH_Standard: 48,
};

const BREACH_HOURS: Record<PaymentRail, number> = {
  FedNow: 8, RTP: 8, ACH_Same_Day: 8,
  Wire_Domestic: 48, Wire_International: 48,
  ACH_Standard: 72,
};

function getSlaStatus(rail: PaymentRail, openedAt: string): SlaStatus {
  const age = ageHours(openedAt);
  if (age >= BREACH_HOURS[rail]) return 'breach';
  if (age >= WARNING_HOURS[rail]) return 'warning';
  return 'ok';
}

const SLA_STYLES: Record<SlaStatus, { accentBg: string; badge: string; label: string }> = {
  ok:      { accentBg: 'bg-emerald-500', badge: 'bg-emerald-500/10 text-emerald-700 ring-1 ring-emerald-500/30', label: 'OK'      },
  warning: { accentBg: 'bg-amber-400',   badge: 'bg-amber-400/10  text-amber-700  ring-1 ring-amber-400/30',   label: 'Warning' },
  breach:  { accentBg: 'bg-red-500',     badge: 'bg-red-500/10    text-red-700    ring-1 ring-red-500/30',     label: 'Breach'  },
};

const NAMESPACE_STYLES: Record<string, string> = {
  NACHA:    'bg-blue-100 text-blue-800',
  ISO20022: 'bg-purple-100 text-purple-800',
  SWIFT:    'bg-indigo-100 text-indigo-800',
};

// ─── Component ────────────────────────────────────────────────────────────────

const ExceptionGroupRow = memo(function ExceptionGroupRow({
  group,
  isExpanded,
  onToggle,
}: ExceptionGroupRowProps) {
  const slaStatus = getSlaStatus(group.rail, group.oldestOpenedAt);
  const slaStyle = SLA_STYLES[slaStatus];
  const nsStyle = NAMESPACE_STYLES[group.reasonCodeNamespace] ?? 'bg-gray-100 text-gray-700';

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onToggle();
    }
  }

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden shadow-md">
      {/* Colored accent bar across the top */}
      <div className={`h-1 w-full ${slaStyle.accentBg}`} aria-hidden="true" />
      {/* Row header — clickable */}
      <div
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
        onClick={onToggle}
        onKeyDown={handleKeyDown}
        className="flex items-center justify-between px-4 py-3 bg-white hover:bg-nymbus-mist cursor-pointer select-none"
      >
        {/* Left: rail + reason code */}
        <div className="flex items-center gap-3 min-w-0">
          {/* Chevron */}
          <span
            className={`text-gray-400 transition-transform duration-150 ${isExpanded ? 'rotate-90' : ''}`}
            aria-hidden="true"
          >
            ▶
          </span>

          <div className="min-w-0">
            <span className="font-medium text-gray-900 text-sm">
              {group.rail.replace(/_/g, ' ')}
            </span>
            <span className="mx-2 text-gray-400 text-sm">·</span>
            <span className="text-sm text-gray-700 font-mono">{group.reasonCode}</span>
          </div>

          {/* Namespace badge */}
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${nsStyle}`}
          >
            {group.reasonCodeNamespace}
          </span>
        </div>

        {/* Right: count, exposure, SLA */}
        <div className="flex items-center gap-4 shrink-0 ml-4">
          <div className="text-right">
            <div className="text-xs text-gray-500">Count</div>
            <div className="text-sm font-semibold tabular-nums text-gray-900">{group.count}</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-gray-500">Exposure</div>
            <div className="text-sm font-semibold tabular-nums text-gray-900">{formatUSD(group.dollarExposure)}</div>
          </div>
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${slaStyle.badge}`}
            aria-label={`SLA status: ${slaStyle.label}`}
          >
            {slaStyle.label}
          </span>
        </div>
      </div>

      {/* Drill-down area */}
      {isExpanded && <ExceptionDrillDown group={group} />}
    </div>
  );
});

export default ExceptionGroupRow;
