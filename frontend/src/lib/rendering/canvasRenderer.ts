import type { ProjectState } from '../projects/types';
import { drawImageToQuad } from './quadWarp';

type Drawable = HTMLImageElement | HTMLVideoElement | HTMLCanvasElement;

function drawableReady(media: Drawable) {
  if (media instanceof HTMLImageElement) return media.complete && media.naturalWidth > 0;
  if (media instanceof HTMLVideoElement) return media.readyState >= 2;
  return true;
}

export function renderProjectToCanvas(
  ctx: CanvasRenderingContext2D,
  project: ProjectState,
  mediaElements: Map<string, Drawable>,
  liveCanvases?: Map<string, HTMLCanvasElement>
) {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, project.canvas.width, project.canvas.height);
  ctx.fillStyle = project.canvas.backgroundColor || '#000000';
  ctx.fillRect(0, 0, project.canvas.width, project.canvas.height);
  ctx.restore();

  for (const surface of project.surfaces) {
    if (!surface.visible) continue;

    // Live layers render through a shared offscreen canvas (per surface window),
    // then warp through the exact same quad path as images/video.
    if (surface.contentType === 'live') {
      const liveCanvas = liveCanvases?.get(surface.id);
      if (!liveCanvas || liveCanvas.width === 0 || liveCanvas.height === 0) continue;
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, (surface.opacity ?? 1) * (surface.liveConfig?.opacity ?? 1)));
      ctx.globalCompositeOperation = (surface.blendMode || 'source-over') as GlobalCompositeOperation;
      drawImageToQuad(
        ctx,
        liveCanvas,
        { x: 0, y: 0, width: liveCanvas.width, height: liveCanvas.height },
        surface.destinationQuad,
        surface.edgeFeather ?? 0
      );
      ctx.restore();
      continue;
    }

    if (!surface.mediaId) continue;
    const media = mediaElements.get(surface.mediaId);
    if (!media || !drawableReady(media)) continue;

    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, surface.opacity ?? 1));
    ctx.globalCompositeOperation = surface.blendMode || 'source-over';
    drawImageToQuad(ctx, media, surface.sourceRect, surface.destinationQuad, surface.edgeFeather ?? 0);
    ctx.restore();
  }
}

/**
 * Setup aid drawn over the output: a percentage grid, outer border, and a bold
 * vertical centre line + crosshair to mark where a wall corner falls in the
 * projector frame. Rendered in canvas (project) coordinates so it matches the
 * editor preview and the projector exactly.
 */
export function drawCalibrationGrid(ctx: CanvasRenderingContext2D, width: number, height: number) {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(232,160,32,0.22)';
  ctx.beginPath();
  for (let i = 1; i < 10; i += 1) {
    const x = (width * i) / 10;
    const y = (height * i) / 10;
    ctx.moveTo(x, 0); ctx.lineTo(x, height);
    ctx.moveTo(0, y); ctx.lineTo(width, y);
  }
  ctx.stroke();

  ctx.strokeStyle = 'rgba(232,160,32,0.55)';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, width - 2, height - 2);

  // bold centre line = corner marker
  ctx.strokeStyle = 'rgba(232,160,32,0.9)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(width / 2, 0); ctx.lineTo(width / 2, height);
  ctx.stroke();

  const cx = width / 2;
  const cy = height / 2;
  const r = Math.min(width, height) * 0.04;
  ctx.beginPath();
  ctx.moveTo(cx - r, cy); ctx.lineTo(cx + r, cy);
  ctx.moveTo(cx, cy - r); ctx.lineTo(cx, cy + r);
  ctx.stroke();
  ctx.restore();
}
