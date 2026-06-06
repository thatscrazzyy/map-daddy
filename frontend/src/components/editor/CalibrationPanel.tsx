import type React from 'react';
import { useMemo, useRef, useState } from 'react';
import { Sparkles, X } from 'lucide-react';
import { normalizeCalibration } from '../../lib/projects/defaultProject';
import type { MappingSurface, SurfaceCalibration } from '../../lib/projects/types';
import { LiveLayerCanvas } from '../../layers/LiveLayerCanvas';
import { projectAltAzToWall } from '../../layers/skyProjection';
import { useAstronomyEngine } from '../../layers/useAstronomyEngine';
import { useISSPosition } from '../../layers/useISSPosition';

const PREVIEW_WIDTH = 480;

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <span className="mono mb-1 block text-[9px] uppercase tracking-[0.14em] text-[#7a6a4a]">{children}</span>;
}

function directionGlyph(fx: number, fy: number): string {
  const col = fx < 0.34 ? 0 : fx > 0.66 ? 2 : 1;
  const row = fy < 0.34 ? 0 : fy > 0.66 ? 2 : 1;
  const grid = [
    ['↖ top-left', '↑ top', '↗ top-right'],
    ['← left', '· centre', '→ right'],
    ['↙ bottom-left', '↓ bottom', '↘ bottom-right']
  ];
  return grid[row][col];
}

function CompassDial({
  bearingDeg,
  onChange,
  onCommit
}: {
  bearingDeg: number;
  onChange: (deg: number) => void;
  onCommit: (deg: number) => void;
}) {
  const ref = useRef<SVGSVGElement | null>(null);
  const size = 150;
  const c = size / 2;
  const r = c - 18;
  const rad = (bearingDeg * Math.PI) / 180;
  const tip = { x: c + r * Math.sin(rad), y: c - r * Math.cos(rad) };

  const bearingFromEvent = (event: { clientX: number; clientY: number }) => {
    const svg = ref.current;
    if (!svg) return bearingDeg;
    const rect = svg.getBoundingClientRect();
    const dx = event.clientX - (rect.left + rect.width / 2);
    const dy = event.clientY - (rect.top + rect.height / 2);
    let deg = (Math.atan2(dx, -dy) * 180) / Math.PI;
    return (Math.round(deg) % 360 + 360) % 360;
  };

  const handleDown = (event: React.PointerEvent<SVGSVGElement>) => {
    event.preventDefault();
    (event.target as Element).setPointerCapture?.(event.pointerId);
    onChange(bearingFromEvent(event));
    const move = (moveEvent: PointerEvent) => onChange(bearingFromEvent(moveEvent));
    const up = (upEvent: PointerEvent) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      onCommit(bearingFromEvent(upEvent));
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  return (
    <svg
      ref={ref}
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="touch-none cursor-pointer select-none"
      onPointerDown={handleDown}
      role="slider"
      aria-label="Wall bearing"
      aria-valuenow={Math.round(bearingDeg)}
    >
      <circle cx={c} cy={c} r={r} fill="#0a0908" stroke="#1e1c14" strokeWidth={1.5} />
      <circle cx={c} cy={c} r={r * 0.7} fill="none" stroke="#141209" strokeWidth={1} />
      {[
        ['N', c, 12],
        ['E', size - 9, c + 3],
        ['S', c, size - 6],
        ['W', 9, c + 3]
      ].map(([label, x, y]) => (
        <text key={String(label)} x={x as number} y={y as number} fill="#7a6a4a" fontSize={10} textAnchor="middle" className="mono">
          {label}
        </text>
      ))}
      <line x1={c} y1={c} x2={tip.x} y2={tip.y} stroke="#e8a020" strokeWidth={2} />
      <circle cx={tip.x} cy={tip.y} r={5} fill="#e8a020" />
      <circle cx={c} cy={c} r={3} fill="#c8b89a" />
    </svg>
  );
}

function NudgeRow({
  label,
  value,
  unit = '°',
  coarse,
  fine,
  onNudge
}: {
  label: string;
  value: number;
  unit?: string;
  coarse: [string, string];
  fine: [string, string];
  onNudge: (delta: number) => void;
}) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <div className="flex items-center gap-1">
        <button className="md-button h-7 w-8 text-[12px]" type="button" onClick={() => onNudge(-1)}>{coarse[0]}</button>
        <span className="mono flex h-7 min-w-14 flex-1 items-center justify-center rounded-[3px] border border-[#1e1c14] bg-[#0a0908] text-[11px] text-[#c8b89a]">
          {value.toFixed(1)}{unit}
        </span>
        <button className="md-button h-7 w-8 text-[12px]" type="button" onClick={() => onNudge(1)}>{coarse[1]}</button>
      </div>
      <div className="mt-1 flex items-center gap-1">
        <button className="md-button h-6 flex-1 text-[10px]" type="button" onClick={() => onNudge(-0.1)}>{fine[0]} 0.1</button>
        <button className="md-button h-6 flex-1 text-[10px]" type="button" onClick={() => onNudge(0.1)}>0.1 {fine[1]}</button>
      </div>
    </div>
  );
}

export function CalibrationPanel({
  surface,
  onChangeCalibration,
  onFlash,
  onClose
}: {
  surface: MappingSurface;
  onChangeCalibration: (calibration: SurfaceCalibration) => void;
  onFlash: (starName: string) => void;
  onClose: () => void;
}) {
  const original = useRef(normalizeCalibration(surface.calibration));
  const [draft, setDraft] = useState<SurfaceCalibration>(() => normalizeCalibration(surface.calibration));
  const [referenceStar, setReferenceStar] = useState('');

  const config = surface.liveConfig;
  const lat = config?.lat ?? 32.7;
  const lon = config?.lon ?? -97.3;
  const previewHeight = Math.round(PREVIEW_WIDTH * 0.62);

  const { visibleStars } = useAstronomyEngine(lat, lon);
  const iss = useISSPosition(lat, lon);

  // local-only live preview; commit to the project (→ projector) on release/discrete change
  const update = (patch: Partial<SurfaceCalibration>) => setDraft((prev) => normalizeCalibration({ ...prev, ...patch }));
  const commit = (next: SurfaceCalibration) => onChangeCalibration(normalizeCalibration(next));
  const updateAndCommit = (patch: Partial<SurfaceCalibration>) => {
    setDraft((prev) => {
      const next = normalizeCalibration({ ...prev, ...patch });
      commit(next);
      return next;
    });
  };

  const referenceHint = useMemo(() => {
    const star = visibleStars.find((s) => s.name === referenceStar);
    if (!star) return '';
    const projected = projectAltAzToWall(star.azDeg, star.altDeg, draft, PREVIEW_WIDTH, previewHeight);
    if (!projected) return 'below the horizon';
    return `should appear at ${directionGlyph(projected.x / PREVIEW_WIDTH, projected.y / previewHeight)}`;
  }, [referenceStar, visibleStars, draft, previewHeight]);

  const tonight = useMemo(() => {
    const items = visibleStars.slice(0, 4).map((star) => ({
      label: star.name,
      detail: `bearing ${Math.round(star.azDeg)}°, alt ${Math.round(star.altDeg)}°`
    }));
    return items;
  }, [visibleStars]);

  const issLine = useMemo(() => {
    if (iss.visible && iss.look) return `overhead now, bearing ${Math.round(iss.look.azDeg)}°, alt ${Math.round(iss.look.altDeg)}°`;
    if (iss.nextPass) {
      const minutes = Math.max(0, Math.round((iss.nextPass.startMs - Date.now()) / 60_000));
      return `next pass ${minutes} min, bearing ${Math.round(iss.nextPass.startAzDeg)}° → ${Math.round(iss.nextPass.endAzDeg)}°`;
    }
    return 'no visible pass soon';
  }, [iss]);

  const flashFor = (name: string) => {
    if (name) onFlash(name);
  };

  const cancel = () => {
    commit(original.current);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-[860px] flex-col overflow-hidden rounded-[6px] border border-[#1e1c14] bg-[#0c0c0a] shadow-2xl">
        <header className="flex items-center justify-between border-b border-[#111009] px-4 py-2.5">
          <h2 className="md-section-label flex items-center gap-2"><Sparkles size={14} className="text-[#e8a020]" /> Calibrate · {surface.name}</h2>
          <button className="md-button h-7 w-7" type="button" onClick={cancel} aria-label="Close"><X size={14} /></button>
        </header>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 md:flex-row">
          {/* Left: live calibration preview */}
          <div className="shrink-0">
            <FieldLabel>Live preview</FieldLabel>
            <div className="overflow-hidden rounded-[4px] border border-[#1e1c14]" style={{ width: PREVIEW_WIDTH, maxWidth: '100%' }}>
              <LiveLayerCanvas
                width={PREVIEW_WIDTH}
                height={previewHeight}
                config={config ?? { lat, lon, showStars: true, showISS: true, showFlights: true, showAurora: true, starSize: 1.4, opacity: 1 }}
                calibration={draft}
                layerId={surface.liveLayerId ?? 'bedroom-sky'}
                flashName={surface.flashTarget && surface.flashTarget.until > Date.now() ? surface.flashTarget.name : null}
                flashUntil={surface.flashTarget?.until ?? 0}
                className="block h-auto w-full"
              />
            </div>
            <p className="mono mt-2 text-[10px] text-[#7a6a4a]">
              {lat.toFixed(2)}°, {lon.toFixed(2)}° · matches projector output
            </p>
          </div>

          {/* Right: controls */}
          <div className="flex min-w-0 flex-1 flex-col gap-4">
            <div className="flex gap-4">
              <div>
                <FieldLabel>Wall bearing</FieldLabel>
                <CompassDial
                  bearingDeg={draft.wallBearingDeg}
                  onChange={(deg) => update({ wallBearingDeg: deg })}
                  onCommit={(deg) => updateAndCommit({ wallBearingDeg: deg })}
                />
                <input
                  className="md-input mt-1 h-7 text-center text-[11px]"
                  type="number"
                  min={0}
                  max={359}
                  value={Math.round(draft.wallBearingDeg)}
                  onChange={(event) => updateAndCommit({ wallBearingDeg: Number(event.target.value) })}
                  aria-label="Wall bearing degrees"
                />
              </div>
              <div className="flex-1 space-y-3">
                <div>
                  <FieldLabel>Field of view · {Math.round(draft.fovDeg)}°</FieldLabel>
                  <input
                    className="range-amber w-full"
                    type="range"
                    min={40}
                    max={120}
                    step={1}
                    value={draft.fovDeg}
                    onChange={(event) => update({ fovDeg: Number(event.target.value) })}
                    onPointerUp={() => commit(draft)}
                    aria-label="Field of view"
                  />
                </div>
                <NudgeRow
                  label="Rotation offset"
                  value={draft.rotationOffsetDeg}
                  coarse={['←', '→']}
                  fine={['←', '→']}
                  onNudge={(delta) => updateAndCommit({ rotationOffsetDeg: Number((draft.rotationOffsetDeg + delta).toFixed(2)) })}
                />
                <NudgeRow
                  label="Elevation offset"
                  value={draft.elevationOffsetDeg}
                  coarse={['↓', '↑']}
                  fine={['↓', '↑']}
                  onNudge={(delta) => updateAndCommit({ elevationOffsetDeg: Number((draft.elevationOffsetDeg + delta).toFixed(2)) })}
                />
              </div>
            </div>

            {/* Reference star assist */}
            <div className="space-y-2 border-t border-[#111009] pt-3">
              <FieldLabel>Reference star assist</FieldLabel>
              <div className="flex gap-1">
                <select
                  className="md-input h-8 flex-1 text-left text-[11px]"
                  value={referenceStar}
                  onChange={(event) => setReferenceStar(event.target.value)}
                  aria-label="Reference star"
                >
                  <option value="">Pick a bright star tonight…</option>
                  {visibleStars.slice(0, 12).map((star) => (
                    <option key={star.id} value={star.name}>{star.name}</option>
                  ))}
                </select>
                <button
                  className="md-button md-button-amber h-8 gap-1 px-3 text-[11px] font-semibold"
                  type="button"
                  disabled={!referenceStar}
                  onClick={() => flashFor(referenceStar)}
                >
                  Flash
                </button>
              </div>
              {referenceStar && <p className="mono text-[10px] text-[#e8a020]">{referenceStar} — {referenceHint}</p>}
              <p className="mono text-[9px] leading-relaxed text-[#7a6a4a]">
                Flashes the star amber on the projector for 3s. Compare its wall position to the real sky, then nudge the offsets until they match.
              </p>
            </div>

            {/* Tonight's sky */}
            <div className="space-y-1.5 border-t border-[#111009] pt-3">
              <FieldLabel>Tonight's sky at your location</FieldLabel>
              <ul className="space-y-1">
                {tonight.map((item) => (
                  <li key={item.label} className="mono flex justify-between text-[10px] text-[#c8b89a]">
                    <span>{item.label}</span>
                    <span className="text-[#7a6a4a]">{item.detail}</span>
                  </li>
                ))}
                <li className="mono flex justify-between text-[10px] text-[#c8b89a]">
                  <span>ISS</span>
                  <span className="text-[#7a6a4a]">{issLine}</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-[#111009] px-4 py-2.5">
          <button className="md-button h-8 px-4 text-xs" type="button" onClick={cancel}>Cancel</button>
          <button className="md-button md-button-amber h-8 px-4 text-xs font-semibold" type="button" onClick={() => { commit(draft); onClose(); }}>Save calibration</button>
        </footer>
      </div>
    </div>
  );
}
