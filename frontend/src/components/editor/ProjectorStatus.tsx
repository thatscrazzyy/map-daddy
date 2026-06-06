import { Monitor, Wifi, WifiOff } from 'lucide-react';

export function ProjectorStatus({ status, projectorCount }: { status: string; projectorCount: number }) {
  const hasProjector = projectorCount > 0;
  const relayReady = status === 'connected';
  const statusLabel = hasProjector ? 'Synced' : 'No projector';
  const detail = hasProjector
    ? `${projectorCount} projector${projectorCount === 1 ? '' : 's'}`
    : relayReady ? 'Relay ready' : 'Local';

  return (
    <div className="md-button h-8 gap-2 px-2 text-xs" title={detail}>
      <Monitor size={14} className={hasProjector ? 'text-[#e8a020]' : 'text-[#7a6a4a]'} />
      {relayReady || hasProjector ? <Wifi size={14} className="text-[#e8a020]" /> : <WifiOff size={14} className="text-[#2a2820]" />}
      <span className="font-medium text-[#c8b89a]">{statusLabel}</span>
      <span className="mono text-[9px] uppercase tracking-[0.12em] text-[#7a6a4a]">{detail}</span>
    </div>
  );
}
