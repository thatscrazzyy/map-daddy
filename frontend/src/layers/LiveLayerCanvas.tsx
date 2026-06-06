import { useEffect, useRef } from 'react';
import type { LiveLayerConfig, LiveLayerId, MappingSurface, SurfaceCalibration } from '../lib/projects/types';
import { LiveSkyManager } from './skyScene';

/**
 * Renders a single wall's live-sky view to a <canvas> at the given resolution,
 * using the exact same LiveSkyManager path the projector uses — so the editor's
 * calibration preview is pixel-faithful to the real output. Driven by its own
 * RAF loop; reads the latest props each frame via a ref so dragging the compass
 * updates the scene live without tearing down the animation.
 */
export function LiveLayerCanvas({
  width,
  height,
  config,
  calibration,
  layerId = 'bedroom-sky',
  flashName = null,
  flashUntil = 0,
  className = ''
}: {
  width: number;
  height: number;
  config: LiveLayerConfig;
  calibration: SurfaceCalibration;
  layerId?: LiveLayerId;
  flashName?: string | null;
  flashUntil?: number;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const propsRef = useRef({ width, height, config, calibration, layerId, flashName, flashUntil });
  propsRef.current = { width, height, config, calibration, layerId, flashName, flashUntil };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const manager = new LiveSkyManager();
    let frame = 0;

    const render = () => {
      const current = propsRef.current;
      if (canvas.width !== current.width) canvas.width = current.width;
      if (canvas.height !== current.height) canvas.height = current.height;

      const surface: MappingSurface = {
        id: 'calibration-preview',
        name: 'Calibration Preview',
        mediaId: '',
        visible: true,
        opacity: 1,
        blendMode: 'source-over',
        sourceRect: { x: 0, y: 0, width: current.width, height: current.height },
        destinationQuad: [
          { x: 0, y: 0 },
          { x: current.width, y: 0 },
          { x: current.width, y: current.height },
          { x: 0, y: current.height }
        ],
        contentType: 'live',
        liveLayerId: current.layerId,
        liveConfig: current.config,
        calibration: current.calibration,
        flashTarget: current.flashName ? { name: current.flashName, until: current.flashUntil } : null
      };

      const canvases = manager.update([surface], new Date());
      const windowCanvas = canvases.get(surface.id);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      if (windowCanvas) ctx.drawImage(windowCanvas, 0, 0, canvas.width, canvas.height);

      frame = requestAnimationFrame(render);
    };
    render();

    return () => {
      cancelAnimationFrame(frame);
      manager.dispose();
    };
  }, []);

  return <canvas ref={canvasRef} className={className} aria-label="Live layer calibration preview" />;
}
