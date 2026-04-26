import { memo } from 'react';

/**
 * Persistent, non-dismissible banner indicating Demo Mode.
 * Max height 48px per Req 1.2.
 */
const DemoModeBanner = memo(function DemoModeBanner() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Demo mode notice"
      className="w-full bg-nymbus-navy border-b border-nymbus-teal/30 text-nymbus-teal/80 text-center text-xs font-medium py-1 px-4 tracking-widest uppercase"
      style={{ maxHeight: '48px' }}
    >
      Demo Mode — Simulated Data
    </div>
  );
});

export default DemoModeBanner;
