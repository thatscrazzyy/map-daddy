import type React from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';

export function FullscreenButton({ target, isFullscreen, onChange }: { target: React.RefObject<HTMLElement>; isFullscreen: boolean; onChange: () => void }) {
  const toggleFullscreen = async () => {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await target.current?.requestFullscreen();
    }
    onChange();
  };

  return (
    <button className="inline-flex h-9 items-center gap-2 rounded border border-white/15 bg-white/10 px-3 text-sm text-slate-100 hover:border-cyan-300/60" onClick={toggleFullscreen}>
      {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
      {isFullscreen ? 'Exit' : 'Fullscreen'}
    </button>
  );
}
