import type React from 'react';
import { AlignCenter, ArrowDown, ArrowUp, CopyPlus, Eye, EyeOff, Grid3x3, Layers, Link2, Maximize2, Plus, RotateCcw, SlidersHorizontal, Sparkles, Trash2 } from 'lucide-react';
import {
  DEFAULT_CALIBRATION,
  DEFAULT_LIVE_CONFIG,
  DEFAULT_LIVE_LAYER_ID,
  normalizeLiveConfig,
  normalizeVideoPlaybackSettings
} from '../../lib/projects/defaultProject';
import type { LiveLayerConfig, MappingSurface, ProjectMedia } from '../../lib/projects/types';
import { useAstronomyEngine } from '../../layers/useAstronomyEngine';
import { useFlightData } from '../../layers/useFlightData';
import { useISSPosition } from '../../layers/useISSPosition';
import { SourceCropControls } from './SourceCropControls';

function LiveStatusRow({ config }: { config: LiveLayerConfig }) {
  const { visibleStars } = useAstronomyEngine(config.lat, config.lon, 15_000);
  const iss = useISSPosition(config.lat, config.lon);
  const flights = useFlightData(config.lat, config.lon, 5000);

  const issText = iss.visible
    ? 'overhead'
    : iss.nextPass
      ? `${Math.max(0, Math.round((iss.nextPass.startMs - Date.now()) / 60_000))}min`
      : '—';

  return (
    <div className="mono flex items-center justify-between rounded-[3px] border border-[#1e1c14] bg-[#0a0908] px-2 py-1.5 text-[10px] text-[#c8b89a]">
      <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-[#eef3ff]" /> {config.showStars ? visibleStars.length : 0} stars</span>
      <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-[#dff0ff]" /> ISS {config.showISS ? issText : 'off'}</span>
      <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-[#e8a020]" /> {config.showFlights ? flights.length : 0} aircraft</span>
    </div>
  );
}

function LiveToggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="md-button h-7 justify-start gap-1 px-2 text-[11px]">
      <input type="checkbox" className="h-3 w-3 accent-[#e8a020]" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      {label}
    </label>
  );
}

function LiveLayerControls({
  surface,
  config,
  onPatchConfig,
  onCalibrate,
  onAlignSeam,
  canAlignSeam
}: {
  surface: MappingSurface;
  config: LiveLayerConfig;
  onPatchConfig: (patch: Partial<LiveLayerConfig>) => void;
  onCalibrate: () => void;
  onAlignSeam: () => void;
  canAlignSeam: boolean;
}) {
  return (
    <div className="space-y-2">
      <label className="block">
        <FieldLabel>Layer</FieldLabel>
        <select className="md-input text-left" value={surface.liveLayerId ?? DEFAULT_LIVE_LAYER_ID} disabled aria-label="Live layer">
          <option value="bedroom-sky">Bedroom Sky</option>
        </select>
      </label>

      <LiveStatusRow config={config} />

      <div className="grid grid-cols-2 gap-1">
        <LiveToggle label="Stars" checked={config.showStars} onChange={(v) => onPatchConfig({ showStars: v })} />
        <LiveToggle label="ISS" checked={config.showISS} onChange={(v) => onPatchConfig({ showISS: v })} />
        <LiveToggle label="Flights" checked={config.showFlights} onChange={(v) => onPatchConfig({ showFlights: v })} />
        <LiveToggle label="Aurora" checked={config.showAurora} onChange={(v) => onPatchConfig({ showAurora: v })} />
      </div>

      <div className="grid grid-cols-2 gap-1">
        <label className="block">
          <FieldLabel>Latitude</FieldLabel>
          <input className="md-input h-7 text-[11px]" type="number" step="0.1" value={config.lat} onChange={(event) => onPatchConfig({ lat: Number(event.target.value) })} aria-label="Latitude" />
        </label>
        <label className="block">
          <FieldLabel>Longitude</FieldLabel>
          <input className="md-input h-7 text-[11px]" type="number" step="0.1" value={config.lon} onChange={(event) => onPatchConfig({ lon: Number(event.target.value) })} aria-label="Longitude" />
        </label>
      </div>

      <label className="block">
        <FieldLabel>Star size · {config.starSize.toFixed(1)}</FieldLabel>
        <input className="range-amber w-full" type="range" min="0.5" max="3" step="0.1" value={config.starSize} onChange={(event) => onPatchConfig({ starSize: Number(event.target.value) })} aria-label="Star size" />
      </label>

      <button className="md-button md-button-amber h-8 w-full gap-2 text-[11px] font-semibold" type="button" onClick={onCalibrate}>
        <SlidersHorizontal size={13} /> Calibrate
      </button>
      {canAlignSeam && (
        <button className="md-button h-8 w-full gap-2 text-[11px]" type="button" onClick={onAlignSeam} title="Match this wall's bearing to the adjacent wall's edge">
          <Link2 size={13} /> Align seam
        </button>
      )}
    </div>
  );
}

function surfaceBounds(surface: MappingSurface) {
  const xs = surface.destinationQuad.map((point) => point.x);
  const ys = surface.destinationQuad.map((point) => point.y);
  const left = Math.round(Math.min(...xs));
  const top = Math.round(Math.min(...ys));
  const right = Math.round(Math.max(...xs));
  const bottom = Math.round(Math.max(...ys));
  return {
    x: left,
    y: top,
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top)
  };
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <span className="mono mb-1 block text-[9px] uppercase tracking-[0.12em] text-[#7a6a4a]">{children}</span>;
}

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
      className="md-button h-7 min-w-0 gap-1 px-1 text-[11px]"
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
  onSnapToGrid,
  onOpenCalibration,
  onAlignSeam
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
  onOpenCalibration: (surfaceId: string) => void;
  onAlignSeam: (surfaceId: string) => void;
}) {
  const selected = surfaces.find((surface) => surface.id === selectedSurfaceId);
  const selectedIndex = surfaces.findIndex((surface) => surface.id === selectedSurfaceId);
  const selectedMedia = selected ? media.find((item) => item.id === selected.mediaId) : undefined;
  const selectedVideoSettings = selectedMedia?.type === 'video'
    ? normalizeVideoPlaybackSettings(selectedMedia.videoSettings)
    : null;
  const bounds = selected ? surfaceBounds(selected) : null;
  const isLive = selected?.contentType === 'live';
  const liveConfig = isLive ? normalizeLiveConfig(selected?.liveConfig) : null;
  const canAlignSeam = !!selected && isLive && surfaces.some(
    (other) => other.id !== selected.id && other.contentType === 'live' && other.liveLayerId === selected.liveLayerId
  );

  const setContentType = (contentType: 'image' | 'live') => {
    if (!selected) return;
    if (contentType === 'live') {
      onPatchSurface(selected.id, {
        contentType: 'live',
        liveLayerId: selected.liveLayerId ?? DEFAULT_LIVE_LAYER_ID,
        liveConfig: normalizeLiveConfig(selected.liveConfig ?? DEFAULT_LIVE_CONFIG),
        calibration: selected.calibration ?? DEFAULT_CALIBRATION
      });
    } else {
      onPatchSurface(selected.id, { contentType: 'image' });
    }
  };

  const patchLiveConfig = (patch: Partial<LiveLayerConfig>) => {
    if (!selected || !liveConfig) return;
    onPatchSurface(selected.id, { liveConfig: normalizeLiveConfig({ ...liveConfig, ...patch }) });
  };

  const patchSelectedVideoSettings = (patch: Partial<NonNullable<ProjectMedia['videoSettings']>>) => {
    if (!selectedMedia || selectedMedia.type !== 'video' || !selectedVideoSettings) return;
    onPatchMedia(selectedMedia.id, {
      videoSettings: normalizeVideoPlaybackSettings({ ...selectedVideoSettings, ...patch })
    });
  };

  return (
    <section className="p-2">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="md-section-label flex items-center gap-2"><Layers size={13} /> Surfaces</h2>
        <button className="md-button md-button-amber h-7 gap-1 px-2 text-[11px] font-semibold" onClick={onAddSurface} type="button">
          <Plus size={13} /> Add
        </button>
      </div>

      <div className="space-y-1.5">
        {surfaces.map((surface, index) => (
          <button
            key={surface.id}
            onClick={() => onSelectSurface(surface.id)}
            className={`flex w-full items-center justify-between rounded-[3px] border px-2 py-1.5 text-left ${selectedSurfaceId === surface.id ? 'border-[#e8a02055] bg-[#e8a02008]' : 'border-[#1e1c14] bg-[#0e0d0a] hover:bg-[#0b0a08]'}`}
            type="button"
          >
            <span className="min-w-0">
              <span className="block truncate text-xs text-[#c8b89a]">{surface.name}</span>
              <span className="mono block text-[9px] uppercase tracking-[0.12em] text-[#7a6a4a]">S-{String(index + 1).padStart(2, '0')}</span>
            </span>
            {surface.visible ? <Eye size={14} className="shrink-0 text-[#e8a020]" /> : <EyeOff size={14} className="shrink-0 text-[#2a2820]" />}
          </button>
        ))}
        {surfaces.length === 0 && <div className="rounded-[3px] border border-dashed border-[#1e1c14] p-3 text-xs text-[#7a6a4a]">Create a surface to start mapping.</div>}
      </div>

      {selected && (
        <div className="mt-3 space-y-3 border-t border-[#111009] pt-3">
          <label className="block">
            <FieldLabel>Name</FieldLabel>
            <input aria-label="Name" className="md-input text-left" value={selected.name} onChange={(event) => onPatchSurface(selected.id, { name: event.target.value })} />
          </label>

          {bounds && (
            <div>
              <h3 className="md-section-label mb-2">Position</h3>
              <div className="grid grid-cols-3 gap-1">
                <label>
                  <FieldLabel>X</FieldLabel>
                  <input className="md-input h-7 px-1 text-[11px]" readOnly value={bounds.x} />
                </label>
                <label>
                  <FieldLabel>Y</FieldLabel>
                  <input className="md-input h-7 px-1 text-[11px]" readOnly value={bounds.y} />
                </label>
                <label>
                  <FieldLabel>ROT</FieldLabel>
                  <input className="md-input h-7 px-1 text-[11px]" readOnly value="0" />
                </label>
              </div>
            </div>
          )}

          <div>
            <h3 className="md-section-label mb-2">Properties</h3>
            <div className="space-y-2">
              <label className="block">
                <FieldLabel>Content type</FieldLabel>
                <select className="md-input text-left" value={selected.contentType ?? 'image'} onChange={(event) => setContentType(event.target.value === 'live' ? 'live' : 'image')} aria-label="Content type">
                  <option value="image">Image</option>
                  <option value="live">Live Layer</option>
                </select>
              </label>

              {isLive && liveConfig ? (
                <div className="rounded-[3px] border border-[#e8a02022] bg-[#e8a02006] p-2">
                  <div className="mb-2 flex items-center gap-1 text-[10px] text-[#e8a020]"><Sparkles size={11} /> <span className="mono uppercase tracking-[0.12em]">Live Layer</span></div>
                  <LiveLayerControls
                    surface={selected}
                    config={liveConfig}
                    onPatchConfig={patchLiveConfig}
                    onCalibrate={() => onOpenCalibration(selected.id)}
                    onAlignSeam={() => onAlignSeam(selected.id)}
                    canAlignSeam={canAlignSeam}
                  />
                </div>
              ) : (
                <label className="block">
                  <FieldLabel>Media</FieldLabel>
                  <select className="md-input text-left" value={selected.mediaId} onChange={(event) => onPatchSurface(selected.id, { mediaId: event.target.value })}>
                    <option value="">None</option>
                    {media.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </select>
                </label>
              )}

              <label className="block">
                <FieldLabel>Opacity</FieldLabel>
                <input className="range-amber w-full" type="range" min="0" max="1" step="0.01" value={selected.opacity} onChange={(event) => onPatchSurface(selected.id, { opacity: Number(event.target.value) })} />
              </label>
              <label className="block">
                <FieldLabel>Edge feather · {Math.round((selected.edgeFeather ?? 0) * 100)}%</FieldLabel>
                <input className="range-amber w-full" type="range" min="0" max="0.4" step="0.01" value={selected.edgeFeather ?? 0} onChange={(event) => onPatchSurface(selected.id, { edgeFeather: Number(event.target.value) })} aria-label="Edge feather" />
              </label>
              <div className="grid grid-cols-2 gap-1">
                <button className="md-button h-7 gap-1 text-[11px]" onClick={() => onPatchSurface(selected.id, { visible: !selected.visible })} type="button">
                  {selected.visible ? <EyeOff size={13} /> : <Eye size={13} />} {selected.visible ? 'Hide' : 'Show'}
                </button>
                <select className="md-input h-7 px-1 text-[11px]" value={selected.blendMode} onChange={(event) => onPatchSurface(selected.id, { blendMode: event.target.value })} aria-label="Blend Mode">
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
              </div>
            </div>
          </div>

          <div>
            <h3 className="md-section-label mb-2">Align</h3>
            <div className="grid grid-cols-2 gap-1">
              <ToolButton label="Center" title="Center on canvas" onClick={() => onCenterSurface(selected.id)}><AlignCenter size={13} /></ToolButton>
              <ToolButton label="Fit" title="Fit to canvas" onClick={() => onFitSurface(selected.id)}><Maximize2 size={13} /></ToolButton>
              <ToolButton label="Reset" title="Reset rectangle" onClick={() => onResetSurface(selected.id)}><RotateCcw size={13} /></ToolButton>
              <ToolButton label="Copy" title="Duplicate surface" onClick={() => onDuplicateSurface(selected.id)}><CopyPlus size={13} /></ToolButton>
              <ToolButton label="Forward" title="Bring forward" disabled={selectedIndex >= surfaces.length - 1} onClick={() => onBringForward(selected.id)}><ArrowUp size={13} /></ToolButton>
              <ToolButton label="Backward" title="Send backward" disabled={selectedIndex <= 0} onClick={() => onSendBackward(selected.id)}><ArrowDown size={13} /></ToolButton>
              <ToolButton label="Snap" title="Snap corners to 10px grid" onClick={() => onSnapToGrid(selected.id)}><Grid3x3 size={13} /></ToolButton>
              <button className="md-button h-7 text-[#7a6a4a]" onClick={() => onDeleteSurface(selected.id)} title="Delete surface" type="button">
                <Trash2 size={13} />
              </button>
            </div>
          </div>

          {selectedVideoSettings && (
            <div className="space-y-2 border-t border-[#111009] pt-3">
              <h3 className="md-section-label">Video Playback</h3>
              <div className="grid grid-cols-2 gap-1">
                <label className="md-button h-7 justify-start gap-1 px-2 text-[11px]">
                  <input type="checkbox" className="h-3 w-3 accent-[#e8a020]" checked={selectedVideoSettings.loop} onChange={(event) => patchSelectedVideoSettings({ loop: event.target.checked })} />
                  Loop
                </label>
                <label className="md-button h-7 justify-start gap-1 px-2 text-[11px]">
                  <input type="checkbox" className="h-3 w-3 accent-[#e8a020]" checked={selectedVideoSettings.muted} onChange={(event) => patchSelectedVideoSettings({ muted: event.target.checked })} />
                  Muted
                </label>
              </div>
              <label className="block">
                <FieldLabel>Playback Speed</FieldLabel>
                <input aria-label="Playback Speed" className="md-input h-7 text-[11px]" type="number" min="0.25" max="4" step="0.25" value={selectedVideoSettings.playbackRate} onChange={(event) => patchSelectedVideoSettings({ playbackRate: Number(event.target.value) })} />
              </label>
              <label className="block">
                <FieldLabel>Start Time (seconds)</FieldLabel>
                <input aria-label="Start Time (seconds)" className="md-input h-7 text-[11px]" type="number" min="0" step="0.1" value={selectedVideoSettings.startTime} onChange={(event) => patchSelectedVideoSettings({ startTime: Number(event.target.value) })} />
              </label>
            </div>
          )}

          {!isLive && (
            <SourceCropControls
              surface={selected}
              media={selectedMedia}
              onChange={(sourceRect) => onPatchSurface(selected.id, { sourceRect })}
            />
          )}
        </div>
      )}
    </section>
  );
}
