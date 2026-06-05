import { uid } from './defaultProject';
import type { MappingSurface, ProjectState } from './types';

const DEFAULT_DUPLICATE_OFFSET = 24;
const DEFAULT_GRID_SIZE = 10;

type CanvasSize = ProjectState['canvas'];
type SurfaceQuad = MappingSurface['destinationQuad'];

function quadBounds(quad: SurfaceQuad) {
  const xs = quad.map((point) => point.x);
  const ys = quad.map((point) => point.y);
  return {
    left: Math.min(...xs),
    right: Math.max(...xs),
    top: Math.min(...ys),
    bottom: Math.max(...ys)
  };
}

function rectQuad(left: number, top: number, width: number, height: number): SurfaceQuad {
  return [
    { x: left, y: top },
    { x: left + width, y: top },
    { x: left + width, y: top + height },
    { x: left, y: top + height }
  ];
}

function offsetQuad(quad: SurfaceQuad, dx: number, dy: number): SurfaceQuad {
  return quad.map((point) => ({ x: point.x + dx, y: point.y + dy })) as SurfaceQuad;
}

export function centerSurfaceOnCanvas(surface: MappingSurface, canvas: CanvasSize): MappingSurface {
  const bounds = quadBounds(surface.destinationQuad);
  const surfaceCenterX = bounds.left + (bounds.right - bounds.left) / 2;
  const surfaceCenterY = bounds.top + (bounds.bottom - bounds.top) / 2;
  const canvasCenterX = canvas.width / 2;
  const canvasCenterY = canvas.height / 2;

  return {
    ...surface,
    destinationQuad: offsetQuad(
      surface.destinationQuad,
      Math.round(canvasCenterX - surfaceCenterX),
      Math.round(canvasCenterY - surfaceCenterY)
    )
  };
}

export function fitSurfaceToCanvas(surface: MappingSurface, canvas: CanvasSize): MappingSurface {
  return {
    ...surface,
    destinationQuad: rectQuad(0, 0, canvas.width, canvas.height)
  };
}

export function resetSurfaceRectangle(surface: MappingSurface, canvas: CanvasSize): MappingSurface {
  const sourceWidth = Number(surface.sourceRect?.width) || canvas.width;
  const sourceHeight = Number(surface.sourceRect?.height) || canvas.height;
  const scale = Math.min(1, canvas.width / sourceWidth, canvas.height / sourceHeight);
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));
  const left = Math.round((canvas.width - width) / 2);
  const top = Math.round((canvas.height - height) / 2);

  return {
    ...surface,
    destinationQuad: rectQuad(left, top, width, height)
  };
}

export function snapSurfaceToGrid(surface: MappingSurface, gridSize = DEFAULT_GRID_SIZE): MappingSurface {
  return {
    ...surface,
    destinationQuad: surface.destinationQuad.map((point) => ({
      x: Math.round(point.x / gridSize) * gridSize,
      y: Math.round(point.y / gridSize) * gridSize
    })) as SurfaceQuad
  };
}

export function duplicateSurface(surface: MappingSurface, surfaces: MappingSurface[], canvas: CanvasSize): MappingSurface {
  const bounds = quadBounds(surface.destinationQuad);
  const fitsRight = bounds.right + DEFAULT_DUPLICATE_OFFSET <= canvas.width;
  const fitsDown = bounds.bottom + DEFAULT_DUPLICATE_OFFSET <= canvas.height;
  const dx = fitsRight ? DEFAULT_DUPLICATE_OFFSET : -DEFAULT_DUPLICATE_OFFSET;
  const dy = fitsDown ? DEFAULT_DUPLICATE_OFFSET : -DEFAULT_DUPLICATE_OFFSET;
  const copyBaseName = `${surface.name} Copy`;
  const existingNames = new Set(surfaces.map((item) => item.name));
  let name = copyBaseName;
  let suffix = 2;
  while (existingNames.has(name)) {
    name = `${copyBaseName} ${suffix}`;
    suffix += 1;
  }

  return {
    ...surface,
    id: uid('surface'),
    name,
    destinationQuad: offsetQuad(surface.destinationQuad, dx, dy)
  };
}

export function moveSurfaceForward(surfaces: MappingSurface[], surfaceId: string) {
  const index = surfaces.findIndex((surface) => surface.id === surfaceId);
  if (index < 0 || index >= surfaces.length - 1) return surfaces;

  const next = [...surfaces];
  [next[index], next[index + 1]] = [next[index + 1], next[index]];
  return next;
}

export function moveSurfaceBackward(surfaces: MappingSurface[], surfaceId: string) {
  const index = surfaces.findIndex((surface) => surface.id === surfaceId);
  if (index <= 0) return surfaces;

  const next = [...surfaces];
  [next[index - 1], next[index]] = [next[index], next[index - 1]];
  return next;
}
