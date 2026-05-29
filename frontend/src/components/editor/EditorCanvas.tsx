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

export function EditorCanvas({
  project,
  selectedSurfaceId,
  onSelectSurface,
  onMoveCorner,
  onMoveSurface
}: {
  project: ProjectState;
  selectedSurfaceId: string;
  onSelectSurface: (surfaceId: string) => void;
  onMoveCorner: (surfaceId: string, cornerIndex: number, point: { x: number; y: number }) => void;
  onMoveSurface: (surfaceId: string, quad: MappingSurface['destinationQuad']) => void;
}) {
  const beginDrag = (surfaceId: string, cornerIndex: number, event: React.PointerEvent<SVGCircleElement>) => {
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
    <section className="flex min-h-0 flex-1 flex-col rounded border border-white/10 bg-[#11141c]">
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-100">Editor Canvas</h2>
          <p className="mono text-[10px] uppercase tracking-wider text-slate-500">{project.canvas.width} x {project.canvas.height}</p>
        </div>
      </div>
      <div className="grid-bg relative min-h-[360px] flex-1 overflow-hidden bg-black">
        <div className="absolute inset-0">
          <ProjectorRenderer project={project} />
        </div>
        <svg
          className="absolute inset-0 h-full w-full touch-none"
          viewBox={`0 0 ${project.canvas.width} ${project.canvas.height}`}
          preserveAspectRatio="xMidYMid meet"
        >
          {project.surfaces.map((surface) => {
            const selected = surface.id === selectedSurfaceId;
            return (
              <g key={surface.id}>
                <path
                  d={pathFor(surface)}
                  fill={selected ? 'rgba(0,240,255,0.10)' : 'rgba(255,255,255,0.04)'}
                  stroke={selected ? '#7df4ff' : 'rgba(255,255,255,0.45)'}
                  strokeWidth={selected ? 5 : 3}
                  vectorEffect="non-scaling-stroke"
                  className="cursor-move"
                  onPointerDown={(event) => beginSurfaceDrag(surface, event)}
                />
                {surface.destinationQuad.map((point, index) => (
                  <circle
                    key={index}
                    cx={point.x}
                    cy={point.y}
                    r={selected ? 12 : 8}
                    fill="#0a0b10"
                    stroke={selected ? '#e3e1e9' : '#9aa9aa'}
                    strokeWidth={4}
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
