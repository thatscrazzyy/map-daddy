import type React from 'react';
import type { MappingSurface, ProjectState } from '../../lib/projects/types';
import { ProjectorRenderer } from '../projector/ProjectorRenderer';

function svgPoint(svg: SVGSVGElement, event: { clientX: number; clientY: number }) {
  const point = svg.createSVGPoint();
  point.x = event.clientX;
  point.y = event.clientY;
  return point.matrixTransform(svg.getScreenCTM()!.inverse());
}

function pathFor(surface: MappingSurface) {
  return `M ${surface.destinationQuad.map((point) => `${point.x},${point.y}`).join(' L ')} Z`;
}

function boundsFor(surface: MappingSurface) {
  const xs = surface.destinationQuad.map((point) => point.x);
  const ys = surface.destinationQuad.map((point) => point.y);
  const left = Math.min(...xs);
  const right = Math.max(...xs);
  const top = Math.min(...ys);
  const bottom = Math.max(...ys);
  return {
    left,
    right,
    top,
    bottom,
    width: Math.round(right - left),
    height: Math.round(bottom - top)
  };
}

export function EditorCanvas({
  project,
  selectedSurfaceId,
  onSelectSurface,
  onMoveCorner,
  onMoveSurface,
  showGrid = false
}: {
  project: ProjectState;
  selectedSurfaceId: string;
  onSelectSurface: (surfaceId: string) => void;
  onMoveCorner: (surfaceId: string, cornerIndex: number, point: { x: number; y: number }) => void;
  onMoveSurface: (surfaceId: string, quad: MappingSurface['destinationQuad']) => void;
  showGrid?: boolean;
}) {
  const beginDrag = (surfaceId: string, cornerIndex: number, event: React.PointerEvent<SVGRectElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const svg = event.currentTarget.ownerSVGElement;
    if (!svg) return;
    event.currentTarget.setPointerCapture(event.pointerId);

    const move = (moveEvent: PointerEvent) => {
      const point = svgPoint(svg, moveEvent);
      onMoveCorner(surfaceId, cornerIndex, {
        x: Math.max(0, Math.min(project.canvas.width, Math.round(point.x))),
        y: Math.max(0, Math.min(project.canvas.height, Math.round(point.y)))
      });
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const beginSurfaceDrag = (surface: MappingSurface, event: React.PointerEvent<SVGPathElement>) => {
    event.preventDefault();
    event.stopPropagation();
    onSelectSurface(surface.id);
    const svg = event.currentTarget.ownerSVGElement;
    if (!svg) return;
    event.currentTarget.setPointerCapture(event.pointerId);

    const start = svgPoint(svg, event);
    const startQuad = surface.destinationQuad.map((point) => ({ ...point })) as MappingSurface['destinationQuad'];
    const minX = Math.min(...startQuad.map((point) => point.x));
    const maxX = Math.max(...startQuad.map((point) => point.x));
    const minY = Math.min(...startQuad.map((point) => point.y));
    const maxY = Math.max(...startQuad.map((point) => point.y));

    const move = (moveEvent: PointerEvent) => {
      const point = svgPoint(svg, moveEvent);
      const rawDx = Math.round(point.x - start.x);
      const rawDy = Math.round(point.y - start.y);
      const dx = Math.max(-minX, Math.min(project.canvas.width - maxX, rawDx));
      const dy = Math.max(-minY, Math.min(project.canvas.height - maxY, rawDy));
      onMoveSurface(surface.id, startQuad.map((corner) => ({
        x: corner.x + dx,
        y: corner.y + dy
      })) as MappingSurface['destinationQuad']);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  return (
    <section className="flex min-h-0 flex-1 flex-col bg-[#080807]">
      <div className="flex h-8 items-center justify-between border-b border-[#111009] px-3">
        <div>
          <h2 className="md-section-label">Editor Canvas</h2>
        </div>
        <p className="mono text-[10px] uppercase tracking-[0.12em] text-[#7a6a4a]">{project.canvas.width} x {project.canvas.height}</p>
      </div>
      <div className="grid-bg relative min-h-[360px] flex-1 overflow-hidden bg-[#030303]">
        <div className="absolute inset-0">
          <ProjectorRenderer project={project} showGrid={showGrid} />
        </div>
        <div className="canvas-vignette pointer-events-none absolute inset-0" />
        <svg
          className="absolute inset-0 h-full w-full touch-none"
          viewBox={`0 0 ${project.canvas.width} ${project.canvas.height}`}
          preserveAspectRatio="xMidYMid meet"
        >
          {project.surfaces.map((surface, surfaceIndex) => {
            const selected = surface.id === selectedSurfaceId;
            const bounds = boundsFor(surface);
            return (
              <g key={surface.id}>
                <path
                  d={pathFor(surface)}
                  fill={selected ? '#e8a02008' : 'rgba(200,184,154,0.025)'}
                  stroke={selected ? '#e8a02055' : '#1e1c14'}
                  strokeWidth={selected ? 1.5 : 1}
                  vectorEffect="non-scaling-stroke"
                  className="cursor-move"
                  onPointerDown={(event) => beginSurfaceDrag(surface, event)}
                />
                {selected && (
                  <>
                    <text
                      x={bounds.left + 6}
                      y={Math.max(14, bounds.top - 8)}
                      fill="#e8a020"
                      fontFamily="IBM Plex Mono, ui-monospace, monospace"
                      fontSize="12"
                      letterSpacing="1"
                      pointerEvents="none"
                    >
                      S-{String(surfaceIndex + 1).padStart(2, '0')}
                    </text>
                    <text
                      x={bounds.right - 6}
                      y={Math.min(project.canvas.height - 8, bounds.bottom + 18)}
                      fill="#7a6a4a"
                      fontFamily="IBM Plex Mono, ui-monospace, monospace"
                      fontSize="10"
                      letterSpacing="1"
                      textAnchor="end"
                      pointerEvents="none"
                    >
                      {bounds.width} x {bounds.height}
                    </text>
                  </>
                )}
                {surface.destinationQuad.map((point, index) => (
                  <rect
                    key={index}
                    x={point.x - 3}
                    y={point.y - 3}
                    width={6}
                    height={6}
                    rx={1}
                    fill="#080807"
                    stroke={selected ? '#e8a020' : '#7a6a4a'}
                    strokeWidth={1.5}
                    vectorEffect="non-scaling-stroke"
                    className="cursor-move"
                    onPointerDown={(event) => beginDrag(surface.id, index, event)}
                  />
                ))}
              </g>
            );
          })}
        </svg>
      </div>
    </section>
  );
}
