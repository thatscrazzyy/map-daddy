import { Crop } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { MappingSurface, ProjectMedia, SourceRect } from '../../lib/projects/types';
import { normalizeSourceRect, patchSourceRect, sourceRectPreset, type SourceCropPreset, type SourceSize } from '../../lib/projects/sourceRect';

function loadMediaSize(media?: ProjectMedia): Promise<SourceSize | null> {
  if (!media?.url) return Promise.resolve(null);

  if (media.type === 'video') {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = () => resolve({
        width: video.videoWidth || 1,
        height: video.videoHeight || 1
      });
      video.onerror = () => resolve(null);
      video.src = media.url;
    });
  }

  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve({
      width: image.naturalWidth || 1,
      height: image.naturalHeight || 1
    });
    image.onerror = () => resolve(null);
    image.src = media.url;
  });
}

function cropInputClass() {
  return 'h-8 w-full rounded border border-white/10 bg-black/30 px-2 text-sm outline-none focus:border-cyan-300/50';
}

export function SourceCropControls({
  surface,
  media,
  onChange
}: {
  surface: MappingSurface;
  media?: ProjectMedia;
  onChange: (sourceRect: SourceRect) => void;
}) {
  const [sourceSize, setSourceSize] = useState<SourceSize | null>(null);
  const [isLoadingSize, setIsLoadingSize] = useState(false);

  useEffect(() => {
    let active = true;
    setSourceSize(null);
    setIsLoadingSize(!!media?.url);

    loadMediaSize(media).then((size) => {
      if (!active) return;
      setSourceSize(size);
      setIsLoadingSize(false);
    });

    return () => {
      active = false;
    };
  }, [media?.id, media?.type, media?.url]);

  const sourceRect = useMemo(
    () => normalizeSourceRect(surface.sourceRect, sourceSize),
    [surface.sourceRect, sourceSize]
  );

  const patchCrop = (patch: Partial<SourceRect>) => {
    onChange(patchSourceRect(sourceRect, patch, sourceSize));
  };

  const applyPreset = (preset: SourceCropPreset) => {
    if (!sourceSize) {
      onChange(normalizeSourceRect(preset === 'full' ? { x: 0, y: 0, width: sourceRect.width, height: sourceRect.height } : sourceRect));
      return;
    }
    onChange(sourceRectPreset(preset, sourceSize, sourceRect));
  };

  return (
    <div className="space-y-3 rounded border border-white/10 bg-black/20 p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-300">
          <Crop size={14} /> Source Crop
        </h3>
        <span className="mono text-[10px] uppercase text-slate-500">
          {isLoadingSize ? 'Loading' : sourceSize ? `${sourceSize.width} x ${sourceSize.height}` : 'Unbounded'}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="mb-1 block text-[11px] text-slate-400">X</span>
          <input
            className={cropInputClass()}
            type="number"
            min="0"
            max={sourceSize ? Math.max(0, sourceSize.width - 1) : undefined}
            step="1"
            value={sourceRect.x}
            onChange={(event) => patchCrop({ x: Number(event.target.value) })}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] text-slate-400">Y</span>
          <input
            className={cropInputClass()}
            type="number"
            min="0"
            max={sourceSize ? Math.max(0, sourceSize.height - 1) : undefined}
            step="1"
            value={sourceRect.y}
            onChange={(event) => patchCrop({ y: Number(event.target.value) })}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] text-slate-400">Width</span>
          <input
            className={cropInputClass()}
            type="number"
            min="1"
            max={sourceSize ? Math.max(1, sourceSize.width - sourceRect.x) : undefined}
            step="1"
            value={sourceRect.width}
            onChange={(event) => patchCrop({ width: Number(event.target.value) })}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] text-slate-400">Height</span>
          <input
            className={cropInputClass()}
            type="number"
            min="1"
            max={sourceSize ? Math.max(1, sourceSize.height - sourceRect.y) : undefined}
            step="1"
            value={sourceRect.height}
            onChange={(event) => patchCrop({ height: Number(event.target.value) })}
          />
        </label>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <button className="h-8 rounded border border-white/10 bg-white/[0.04] text-xs hover:bg-white/[0.08]" onClick={() => applyPreset('full')}>
          Full
        </button>
        <button className="h-8 rounded border border-white/10 bg-white/[0.04] text-xs hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-40" onClick={() => applyPreset('center-half')} disabled={!sourceSize}>
          1/2
        </button>
        <button className="h-8 rounded border border-white/10 bg-white/[0.04] text-xs hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-40" onClick={() => applyPreset('center-quarter')} disabled={!sourceSize}>
          1/4
        </button>
      </div>
    </div>
  );
}
