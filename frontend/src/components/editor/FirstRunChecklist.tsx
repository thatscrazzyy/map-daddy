import { Check, Circle } from 'lucide-react';
import type { ProjectState } from '../../lib/projects/types';

export function FirstRunChecklist({ project, projectorCount }: { project: ProjectState; projectorCount: number }) {
  const hasMedia = project.media.length > 0;
  const hasSurface = project.surfaces.length > 0;

  // Only show if the project is substantially empty. Once they map their first thing, hide it.
  if (hasMedia && hasSurface) return null;

  return (
    <section className="border-b border-[#111009] p-2">
      <h3 className="md-section-label mb-2">Getting Started</h3>
      <ul className="space-y-2 text-xs text-[#7a6a4a]">
        <li className="flex items-center gap-3">
          {hasMedia ? <Check size={14} className="shrink-0 text-[#e8a020]" /> : <Circle size={14} className="shrink-0 text-[#2a2820]" />}
          <span className={hasMedia ? "line-through opacity-50" : ""}>Upload media or add sample</span>
        </li>
        <li className="flex items-center gap-3">
          {hasSurface ? <Check size={14} className="shrink-0 text-[#e8a020]" /> : <Circle size={14} className="shrink-0 text-[#2a2820]" />}
          <span className={hasSurface ? "line-through opacity-50" : ""}>Select or add a surface</span>
        </li>
        <li className="flex items-center gap-3 opacity-80">
          <Circle size={14} className="shrink-0 text-[#2a2820]" />
          <span>Drag surface corners on canvas</span>
        </li>
        <li className="flex items-center gap-3">
          {projectorCount > 0 ? <Check size={14} className="shrink-0 text-[#e8a020]" /> : <Circle size={14} className="shrink-0 text-[#2a2820]" />}
          <span className={projectorCount > 0 ? "line-through opacity-50" : ""}>Open projector in another tab</span>
        </li>
      </ul>
    </section>
  );
}
