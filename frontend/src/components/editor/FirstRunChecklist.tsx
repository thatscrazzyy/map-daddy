import { Check, Circle } from 'lucide-react';
import type { ProjectState } from '../../lib/projects/types';

export function FirstRunChecklist({ project, projectorCount }: { project: ProjectState; projectorCount: number }) {
  const hasMedia = project.media.length > 0;
  const hasSurface = project.surfaces.length > 0;

  // Only show if the project is substantially empty. Once they map their first thing, hide it.
  if (hasMedia && hasSurface) return null;

  return (
    <section className="rounded border border-cyan-400/30 bg-[#151821] p-4 shadow-xl">
      <h3 className="mb-3 text-sm font-semibold text-cyan-50">Getting Started</h3>
      <ul className="space-y-3 text-sm text-slate-300">
        <li className="flex items-center gap-3">
          {hasMedia ? <Check size={16} className="text-emerald-400 shrink-0" /> : <Circle size={16} className="text-slate-500 shrink-0" />}
          <span className={hasMedia ? "line-through opacity-50" : ""}>Upload media or add sample</span>
        </li>
        <li className="flex items-center gap-3">
          {hasSurface ? <Check size={16} className="text-emerald-400 shrink-0" /> : <Circle size={16} className="text-slate-500 shrink-0" />}
          <span className={hasSurface ? "line-through opacity-50" : ""}>Select or add a surface</span>
        </li>
        <li className="flex items-center gap-3 opacity-80">
          <Circle size={16} className="text-slate-500 shrink-0" />
          <span>Drag surface corners on canvas</span>
        </li>
        <li className="flex items-center gap-3">
          {projectorCount > 0 ? <Check size={16} className="text-emerald-400 shrink-0" /> : <Circle size={16} className="text-slate-500 shrink-0" />}
          <span className={projectorCount > 0 ? "line-through opacity-50" : ""}>Open projector in another tab</span>
        </li>
      </ul>
    </section>
  );
}
