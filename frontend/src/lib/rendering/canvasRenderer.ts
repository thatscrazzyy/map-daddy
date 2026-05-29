import type { ProjectState } from '../projects/types';
import { drawImageToQuad } from './quadWarp';

type Drawable = HTMLImageElement | HTMLVideoElement | HTMLCanvasElement;

function drawableReady(media: Drawable) {
  if (media instanceof HTMLImageElement) return media.complete && media.naturalWidth > 0;
  if (media instanceof HTMLVideoElement) return media.readyState >= 2;
  return true;
}

export function renderProjectToCanvas(ctx: CanvasRenderingContext2D, project: ProjectState, mediaElements: Map<string, Drawable>) {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, project.canvas.width, project.canvas.height);
  ctx.fillStyle = project.canvas.backgroundColor || '#000000';
  ctx.fillRect(0, 0, project.canvas.width, project.canvas.height);
  ctx.restore();

  for (const surface of project.surfaces) {
    if (!surface.visible || !surface.mediaId) continue;
    const media = mediaElements.get(surface.mediaId);
    if (!media || !drawableReady(media)) continue;

    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, surface.opacity ?? 1));
    ctx.globalCompositeOperation = surface.blendMode || 'source-over';
    drawImageToQuad(ctx, media, surface.sourceRect, surface.destinationQuad);
    ctx.restore();
  }
}
