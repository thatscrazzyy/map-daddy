import { Eye, EyeOff, Layers, Plus, Trash2 } from 'lucide-react';
import type { MappingSurface, ProjectMedia } from '../../lib/projects/types';

export function SurfaceControls({
  surfaces,
  media,
  selectedSurfaceId,
  onSelectSurface,
  onAddSurface,
  onDeleteSurface,
  onPatchSurface
}: {
  surfaces: MappingSurface[];
  media: ProjectMedia[];
  selectedSurfaceId: string;
  onSelectSurface: (surfaceId: string) => void;
  onAddSurface: () => void;
  onDeleteSurface: (surfaceId: string) => void;
  onPatchSurface: (surfaceId: string, patch: Partial<MappingSurface>) => void;
}) {
  const selected = surfaces.find((surface) => surface.id === selectedSurfaceId);

  return (
    <section className="rounded border border-white/10 bg-[#151821] p-3">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-100"><Layers size={16} /> Surfaces</h2>
        <button className="inline-flex h-8 items-center gap-2 rounded bg-cyan-100 px-3 text-xs font-semibold text-slate-950 hover:bg-cyan-200" onClick={onAddSurface}>
          <Plus size={14} /> Add
        </button>
      </div>

      <div className="space-y-2">
        {surfaces.map((surface) => (
          <button
            key={surface.id}
            onClick={() => onSelectSurface(surface.id)}
            className={`flex w-full items-center justify-between rounded border px-3 py-2 text-left ${selectedSurfaceId === surface.id ? 'border-cyan-300/60 bg-cyan-300/10' : 'border-white/10 bg-black/20 hover:bg-white/[0.05]'}`}
          >
            <span className="truncate text-sm text-slate-100">{surface.name}</span>
            {surface.visible ? <Eye size={15} className="text-lime-300" /> : <EyeOff size={15} className="text-slate-500" />}
          </button>
        ))}
        {surfaces.length === 0 && <div className="rounded border border-dashed border-white/10 p-4 text-sm text-slate-500">Create a surface to start mapping.</div>}
      </div>

      {selected && (
        <div className="mt-4 space-y-3 border-t border-white/10 pt-4">
          <label className="block">
            <span className="mb-1 block text-xs text-slate-400">Name</span>
            <input className="h-9 w-full rounded border border-white/10 bg-black/30 px-2 text-sm outline-none focus:border-cyan-300/50" value={selected.name} onChange={(event) => onPatchSurface(selected.id, { name: event.target.value })} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-slate-400">Media</span>
            <select className="h-9 w-full rounded border border-white/10 bg-black/30 px-2 text-sm outline-none focus:border-cyan-300/50" value={selected.mediaId} onChange={(event) => onPatchSurface(selected.id, { mediaId: event.target.value })}>
              <option value="">None</option>
              {media.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-slate-400">Opacity</span>
            <input className="range-cyan w-full" type="range" min="0" max="1" step="0.01" value={selected.opacity} onChange={(event) => onPatchSurface(selected.id, { opacity: Number(event.target.value) })} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-slate-400">Blend Mode</span>
            <select className="h-9 w-full rounded border border-white/10 bg-black/30 px-2 text-sm outline-none focus:border-cyan-300/50" value={selected.blendMode} onChange={(event) => onPatchSurface(selected.id, { blendMode: event.target.value })}>
              <option value="source-over">Normal</option>
              <option value="screen">Screen</option>
              <option value="multiply">Multiply</option>
              <option value="overlay">Overlay</option>
              <option value="lighten">Lighten</option>
              <option value="darken">Darken</option>
              <option value="hard-light">Hard Light</option>
              <option value="soft-light">Soft Light</option>
              <option value="color-dodge">Color Dodge</option>
              <option value="color-burn">Color Burn</option>
              <option value="difference">Difference</option>
              <option value="exclusion">Exclusion</option>
            </select>
          </label>
          <div className="flex gap-2">
            <button className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded border border-white/10 bg-white/[0.04] text-sm hover:bg-white/[0.08]" onClick={() => onPatchSurface(selected.id, { visible: !selected.visible })}>
              {selected.visible ? <EyeOff size={15} /> : <Eye size={15} />} {selected.visible ? 'Hide' : 'Show'}
            </button>
            <button className="inline-flex h-9 items-center justify-center rounded border border-red-300/25 bg-red-400/10 px-3 text-red-100 hover:bg-red-400/20" onClick={() => onDeleteSurface(selected.id)} title="Delete surface">
              <Trash2 size={15} />
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
