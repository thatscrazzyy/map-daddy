import type React from 'react';
import { AlignCenter, ArrowDown, ArrowUp, CopyPlus, Eye, EyeOff, Grid3x3, Layers, Maximize2, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { normalizeVideoPlaybackSettings } from '../../lib/projects/defaultProject';
import type { MappingSurface, ProjectMedia } from '../../lib/projects/types';
import { SourceCropControls } from './SourceCropControls';

function ToolButton({
  label,
  title,
  disabled,
  onClick,
  children
}: {
  label: string;
  title: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      className="inline-flex h-9 min-w-0 items-center justify-center gap-2 rounded border border-white/10 bg-white/[0.04] px-2 text-xs font-medium text-slate-100 hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-40"
      disabled={disabled}
      onClick={onClick}
      title={title}
      type="button"
    >
      {children}
      <span className="truncate">{label}</span>
    </button>
  );
}

export function SurfaceControls({
  surfaces,
  media,
  selectedSurfaceId,
  onSelectSurface,
  onAddSurface,
  onDeleteSurface,
  onPatchSurface,
  onPatchMedia,
  onCenterSurface,
  onFitSurface,
  onResetSurface,
  onDuplicateSurface,
  onBringForward,
  onSendBackward,
  onSnapToGrid
}: {
  surfaces: MappingSurface[];
  media: ProjectMedia[];
  selectedSurfaceId: string;
  onSelectSurface: (surfaceId: string) => void;
  onAddSurface: () => void;
  onDeleteSurface: (surfaceId: string) => void;
  onPatchSurface: (surfaceId: string, patch: Partial<MappingSurface>) => void;
  onPatchMedia: (mediaId: string, patch: Partial<ProjectMedia>) => void;
  onCenterSurface: (surfaceId: string) => void;
  onFitSurface: (surfaceId: string) => void;
  onResetSurface: (surfaceId: string) => void;
  onDuplicateSurface: (surfaceId: string) => void;
  onBringForward: (surfaceId: string) => void;
  onSendBackward: (surfaceId: string) => void;
  onSnapToGrid: (surfaceId: string) => void;
}) {
  const selected = surfaces.find((surface) => surface.id === selectedSurfaceId);
  const selectedIndex = surfaces.findIndex((surface) => surface.id === selectedSurfaceId);
  const selectedMedia = selected ? media.find((item) => item.id === selected.mediaId) : undefined;
  const selectedVideoSettings = selectedMedia?.type === 'video'
    ? normalizeVideoPlaybackSettings(selectedMedia.videoSettings)
    : null;

  const patchSelectedVideoSettings = (patch: Partial<NonNullable<ProjectMedia['videoSettings']>>) => {
    if (!selectedMedia || selectedMedia.type !== 'video' || !selectedVideoSettings) return;
    onPatchMedia(selectedMedia.id, {
      videoSettings: normalizeVideoPlaybackSettings({ ...selectedVideoSettings, ...patch })
    });
  };

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
          {selectedVideoSettings && (
            <div className="space-y-3 rounded border border-white/10 bg-black/20 p-3">
              <div className="text-xs font-semibold uppercase text-slate-300">Video Playback</div>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex h-9 items-center gap-2 rounded border border-white/10 bg-black/20 px-2 text-sm text-slate-200">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-cyan-300"
                    checked={selectedVideoSettings.loop}
                    onChange={(event) => patchSelectedVideoSettings({ loop: event.target.checked })}
                  />
                  Loop
                </label>
                <label className="flex h-9 items-center gap-2 rounded border border-white/10 bg-black/20 px-2 text-sm text-slate-200">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-cyan-300"
                    checked={selectedVideoSettings.muted}
                    onChange={(event) => patchSelectedVideoSettings({ muted: event.target.checked })}
                  />
                  Muted
                </label>
              </div>
              <label className="block">
                <span className="mb-1 block text-xs text-slate-400">Playback Speed</span>
                <input
                  className="h-9 w-full rounded border border-white/10 bg-black/30 px-2 text-sm outline-none focus:border-cyan-300/50"
                  type="number"
                  min="0.25"
                  max="4"
                  step="0.25"
                  value={selectedVideoSettings.playbackRate}
                  onChange={(event) => patchSelectedVideoSettings({ playbackRate: Number(event.target.value) })}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-slate-400">Start Time (seconds)</span>
                <input
                  className="h-9 w-full rounded border border-white/10 bg-black/30 px-2 text-sm outline-none focus:border-cyan-300/50"
                  type="number"
                  min="0"
                  step="0.1"
                  value={selectedVideoSettings.startTime}
                  onChange={(event) => patchSelectedVideoSettings({ startTime: Number(event.target.value) })}
                />
              </label>
            </div>
          )}
          <SourceCropControls
            surface={selected}
            media={selectedMedia}
            onChange={(sourceRect) => onPatchSurface(selected.id, { sourceRect })}
          />
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
          <div>
            <span className="mb-2 block text-xs text-slate-400">Tools</span>
            <div className="grid grid-cols-2 gap-2">
              <ToolButton label="Center" title="Center on canvas" onClick={() => onCenterSurface(selected.id)}><AlignCenter size={14} /></ToolButton>
              <ToolButton label="Fit" title="Fit to canvas" onClick={() => onFitSurface(selected.id)}><Maximize2 size={14} /></ToolButton>
              <ToolButton label="Reset" title="Reset to a centered rectangle" onClick={() => onResetSurface(selected.id)}><RotateCcw size={14} /></ToolButton>
              <ToolButton label="Copy" title="Duplicate surface" onClick={() => onDuplicateSurface(selected.id)}><CopyPlus size={14} /></ToolButton>
              <ToolButton label="Forward" title="Bring forward" disabled={selectedIndex >= surfaces.length - 1} onClick={() => onBringForward(selected.id)}><ArrowUp size={14} /></ToolButton>
              <ToolButton label="Backward" title="Send backward" disabled={selectedIndex <= 0} onClick={() => onSendBackward(selected.id)}><ArrowDown size={14} /></ToolButton>
              <ToolButton label="Snap" title="Snap corners to 10px grid" onClick={() => onSnapToGrid(selected.id)}><Grid3x3 size={14} /></ToolButton>
            </div>
          </div>
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
