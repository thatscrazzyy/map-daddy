import type { SourceRect } from './types';

export type SourceSize = {
  width: number;
  height: number;
};

export type SourceCropPreset = 'full' | 'center-half' | 'center-quarter';

function finitePixel(value: unknown, fallback: number) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? Math.round(numberValue) : fallback;
}

function usableSourceSize(sourceSize?: SourceSize | null): SourceSize | null {
  if (!sourceSize) return null;
  const width = finitePixel(sourceSize.width, 0);
  const height = finitePixel(sourceSize.height, 0);
  if (width < 1 || height < 1) return null;
  return { width, height };
}

export function normalizeSourceRect(rect: Partial<SourceRect> | null | undefined, sourceSize?: SourceSize | null): SourceRect {
  const size = usableSourceSize(sourceSize);
  const defaultWidth = size?.width ?? 1;
  const defaultHeight = size?.height ?? 1;

  let x = Math.max(0, finitePixel(rect?.x, 0));
  let y = Math.max(0, finitePixel(rect?.y, 0));
  let width = Math.max(1, finitePixel(rect?.width, defaultWidth));
  let height = Math.max(1, finitePixel(rect?.height, defaultHeight));

  if (size) {
    x = Math.min(x, size.width - 1);
    y = Math.min(y, size.height - 1);
    width = Math.min(width, size.width - x);
    height = Math.min(height, size.height - y);
  }

  return { x, y, width, height };
}

export function patchSourceRect(current: SourceRect, patch: Partial<SourceRect>, sourceSize?: SourceSize | null): SourceRect {
  return normalizeSourceRect({ ...current, ...patch }, sourceSize);
}

export function sourceRectPreset(preset: SourceCropPreset, sourceSize: SourceSize, fallback?: SourceRect): SourceRect {
  const size = usableSourceSize(sourceSize);
  if (!size) return normalizeSourceRect(fallback);

  if (preset === 'full') {
    return { x: 0, y: 0, width: size.width, height: size.height };
  }

  const scale = preset === 'center-half' ? 0.5 : 0.25;
  const width = Math.max(1, Math.round(size.width * scale));
  const height = Math.max(1, Math.round(size.height * scale));

  return normalizeSourceRect({
    x: Math.round((size.width - width) / 2),
    y: Math.round((size.height - height) / 2),
    width,
    height
  }, size);
}
