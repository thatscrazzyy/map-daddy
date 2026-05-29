import { Monitor, Wifi, WifiOff } from 'lucide-react';

export function ProjectorStatus({ status, projectorCount }: { status: string; projectorCount: number }) {
  const connected = status === 'connected';
  return (
    <div className="inline-flex items-center gap-2 rounded border border-white/10 bg-white/[0.04] px-3 py-2 text-sm">
      <Monitor size={16} className={projectorCount > 0 ? 'text-lime-300' : 'text-slate-400'} />
      {connected ? <Wifi size={16} className="text-cyan-200" /> : <WifiOff size={16} className="text-yellow-200" />}
      <span className="mono text-xs uppercase tracking-wider text-slate-300">
        {projectorCount} projector{projectorCount === 1 ? '' : 's'}
      </span>
    </div>
  );
}
