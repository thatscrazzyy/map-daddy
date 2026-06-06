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
  return 'md-input h-7 text-[11px]';
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
    <div className="space-y-2 border-t border-[#111009] pt-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="md-section-label flex items-center gap-2">
          <Crop size={13} /> Source Crop
        </h3>
        <span className="mono text-[9px] uppercase tracking-[0.12em] text-[#7a6a4a]">
          {isLoadingSize ? 'Loading' : sourceSize ? `${sourceSize.width} x ${sourceSize.height}` : 'Unbounded'}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="mb-1 block text-[9px] text-[#7a6a4a]">X</span>
          <input className={cropInputClass()} type="number" min="0" step="1" value={sourceRect.x} onChange={(event) => patchCrop({ x: Number(event.target.value) })} />
        </label>
        <label className="block">
          <span className="mb-1 block text-[9px] text-[#7a6a4a]">Y</span>
          <input className={cropInputClass()} type="number" min="0" step="1" value={sourceRect.y} onChange={(event) => patchCrop({ y: Number(event.target.value) })} />
        </label>
        <label className="block">
          <span className="mb-1 block text-[9px] text-[#7a6a4a]">Width</span>
          <input className={cropInputClass()} type="number" min="1" step="1" value={sourceRect.width} onChange={(event) => patchCrop({ width: Number(event.target.value) })} />
        </label>
        <label className="block">
          <span className="mb-1 block text-[9px] text-[#7a6a4a]">Height</span>
          <input className={cropInputClass()} type="number" min="1" step="1" value={sourceRect.height} onChange={(event) => patchCrop({ height: Number(event.target.value) })} />
        </label>
      </div>

      <div className="grid grid-cols-3 gap-1">
        <button className="md-button h-7 text-[11px]" onClick={() => applyPreset('full')} type="button">
          Full
        </button>
        <button className="md-button h-7 text-[11px]" onClick={() => applyPreset('center-half')} disabled={!sourceSize} type="button">
          1/2
        </button>
        <button className="md-button h-7 text-[11px]" onClick={() => applyPreset('center-quarter')} disabled={!sourceSize} type="button">
          1/4
        </button>
      </div>
    </div>
  );
}
