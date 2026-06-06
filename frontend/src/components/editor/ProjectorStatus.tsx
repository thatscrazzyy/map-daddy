import { Monitor, Wifi, WifiOff } from 'lucide-react';

export function ProjectorStatus({ status, projectorCount }: { status: string; projectorCount: number }) {
  const hasProjector = projectorCount > 0;
  const relayReady = status === 'connected';
  const statusLabel = hasProjector ? 'Synced' : 'No projector connected';
  const detail = hasProjector
    ? `${projectorCount} projector${projectorCount === 1 ? '' : 's'}`
    : relayReady ? 'Relay ready' : 'Local';

  return (
    <div className="inline-flex items-center gap-2 rounded border border-white/10 bg-white/[0.04] px-3 py-2 text-sm" title={detail}>
      <Monitor size={16} className={hasProjector ? 'text-lime-300' : 'text-slate-400'} />
      {relayReady || hasProjector ? <Wifi size={16} className="text-cyan-200" /> : <WifiOff size={16} className="text-slate-500" />}
      <span className="text-xs font-medium text-slate-200">{statusLabel}</span>
      <span className="mono text-[10px] uppercase tracking-wider text-slate-500">{detail}</span>
    </div>
  );
}
