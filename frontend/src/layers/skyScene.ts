import type { LiveLayerConfig, MappingSurface, SurfaceCalibration } from '../lib/projects/types';
import { classifyGlyph, drawAircraftGlyph, GLYPH_SCALE, type GlyphKind } from './aircraftGlyph';
import { drawAurora } from './auroraLayer';
import { CONSTELLATION_LINES } from './starCatalog';
import { computeMoon, computeStars, type MoonInfo, type SkyPoint } from './skyData';
import { flightLookAngle, liveSkyService, type Flight, type LookAngle } from './liveSkyService';
import {
  azAltToPanorama,
  calibrationToSourceRect,
  DEFAULT_PANORAMA,
  PANORAMA_ALT_MIN,
  type PanoramaSize
} from './skyProjection';

/**
 * Renders the Bedroom Sky live layer. The whole scene (aurora → stars →
 * constellations → moon → ISS → flight trails) is composited once per frame into
 * a single wide panorama canvas keyed by liveLayerId. Each surface then copies
 * its own azimuth slice (with horizontal wrap at the 0/360 seam) into a window
 * canvas that the projector quad-warps onto the wall — so two corner surfaces
 * sharing a layer read from one render and stay seamless.
 */

const AMBER = '#e8a020';
const TRAIL_MAX = 24;
const TRAIL_TTL_MS = 20_000;
const SNAPSHOT_INTERVAL_MS = 750;

type FlightSample = { flight: Flight; look: LookAngle };

type SkySnapshot = {
  stars: SkyPoint[];
  starsById: Map<string, SkyPoint>;
  moon: MoonInfo;
  iss: LookAngle | null;
  flights: FlightSample[];
  computedAt: number;
};

type Trail = {
  points: Array<{ azDeg: number; altDeg: number }>;
  lastSeen: number;
  callsign: string;
  kind: GlyphKind;
  seed: number;
  angle: number; // last known screen-space heading (radians), -y = travel dir
};

function hashSeed(text: string): number {
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) hash = (hash * 31 + text.charCodeAt(i)) % 1000;
  return hash / 1000 * Math.PI * 2;
}

function makeCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  return canvas;
}

function magToRadius(mag: number, starSize: number): number {
  return Math.max(0.5, (1.7 - mag * 0.26) * starSize);
}

function magToAlpha(mag: number): number {
  return Math.max(0.35, Math.min(1, 1.15 - mag * 0.16));
}

// ---- panorama drawing ------------------------------------------------------

function drawNightBackground(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, '#02030a');
  gradient.addColorStop(0.7, '#05081a');
  gradient.addColorStop(1, '#0a1230');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

function drawConstellations(
  ctx: CanvasRenderingContext2D,
  starsById: Map<string, SkyPoint>,
  pano: PanoramaSize
) {
  ctx.save();
  ctx.strokeStyle = 'rgba(150,175,220,0.18)';
  ctx.lineWidth = pano.width / 1600;
  for (const [a, b] of CONSTELLATION_LINES) {
    const sa = starsById.get(a);
    const sb = starsById.get(b);
    if (!sa || !sb || sa.altDeg < 0 || sb.altDeg < 0) continue;
    const pa = azAltToPanorama(sa.azDeg, sa.altDeg, pano);
    const pb = azAltToPanorama(sb.azDeg, sb.altDeg, pano);
    // skip lines that wrap the seam to avoid a streak across the panorama
    if (Math.abs(pa.x - pb.x) > pano.width / 2) continue;
    ctx.beginPath();
    ctx.moveTo(pa.x, pa.y);
    ctx.lineTo(pb.x, pb.y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawStars(
  ctx: CanvasRenderingContext2D,
  stars: SkyPoint[],
  config: LiveLayerConfig,
  pano: PanoramaSize,
  timeMs: number
) {
  ctx.save();
  ctx.fillStyle = '#eef3ff';
  for (const star of stars) {
    if (star.altDeg < 0) continue;
    const { x, y } = azAltToPanorama(star.azDeg, star.altDeg, pano);
    const twinkle = 0.72 + 0.28 * Math.sin(timeMs / 700 + star.azDeg * 1.7 + star.altDeg);
    const radius = magToRadius(star.mag, config.starSize) * (pano.width / 1440);
    ctx.globalAlpha = magToAlpha(star.mag) * twinkle;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    if (star.mag < 1.2) {
      ctx.globalAlpha *= 0.4;
      ctx.beginPath();
      ctx.arc(x, y, radius * 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function drawMoonGlyph(ctx: CanvasRenderingContext2D, moon: MoonInfo, pano: PanoramaSize) {
  if (moon.altDeg < 0) return;
  const { x, y } = azAltToPanorama(moon.azDeg, moon.altDeg, pano);
  const r = pano.width / 90;
  const k = Math.max(0, Math.min(1, moon.illumFraction));
  const waxing = moon.phaseAngleDeg < 180;

  ctx.save();
  ctx.translate(x, y);
  // soft halo
  const halo = ctx.createRadialGradient(0, 0, r, 0, 0, r * 3);
  halo.addColorStop(0, 'rgba(220,225,210,0.18)');
  halo.addColorStop(1, 'rgba(220,225,210,0)');
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(0, 0, r * 3, 0, Math.PI * 2);
  ctx.fill();

  if (!waxing) ctx.scale(-1, 1); // draw as waxing (lit on right), mirror for waning
  // unlit base
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fillStyle = '#1b1d2a';
  ctx.fill();
  // lit region: right limb + terminator ellipse
  const rx = r * (1 - 2 * k);
  ctx.beginPath();
  ctx.arc(0, 0, r, -Math.PI / 2, Math.PI / 2, false);
  ctx.ellipse(0, 0, Math.abs(rx), r, 0, Math.PI / 2, -Math.PI / 2, rx <= 0);
  ctx.closePath();
  ctx.fillStyle = '#e9e6d4';
  ctx.fill();
  ctx.restore();
}

function drawIss(ctx: CanvasRenderingContext2D, iss: LookAngle, pano: PanoramaSize, timeMs: number) {
  if (iss.altDeg < 0) return;
  const { x, y } = azAltToPanorama(iss.azDeg, iss.altDeg, pano);
  const pulse = 0.7 + 0.3 * Math.sin(timeMs / 220);
  const r = (pano.width / 520) * pulse;
  ctx.save();
  const glow = ctx.createRadialGradient(x, y, 0, x, y, r * 4);
  glow.addColorStop(0, 'rgba(190,225,255,0.9)');
  glow.addColorStop(1, 'rgba(190,225,255,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y, r * 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#dff0ff';
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(220,240,255,0.8)';
  ctx.font = `${Math.round(pano.width / 150)}px IBM Plex Mono, ui-monospace, monospace`;
  ctx.fillText('ISS', x + r * 2, y - r);
  ctx.restore();
}

const AMBER_RGB: [number, number, number] = [232, 160, 32];

function drawFlights(
  ctx: CanvasRenderingContext2D,
  trails: Map<string, Trail>,
  pano: PanoramaSize,
  now: number,
  timeSec: number
) {
  const labelSize = Math.round(pano.width / 170);
  const glyphSize = pano.width / 150;

  for (const trail of trails.values()) {
    const points = trail.points;
    if (points.length === 0) continue;

    ctx.save();
    // fading trail
    for (let i = 1; i < points.length; i += 1) {
      const a = azAltToPanorama(points[i - 1].azDeg, points[i - 1].altDeg, pano);
      const b = azAltToPanorama(points[i].azDeg, points[i].altDeg, pano);
      if (Math.abs(a.x - b.x) > pano.width / 2) continue; // seam wrap
      ctx.strokeStyle = `rgba(232,160,32,${(i / points.length) * 0.55})`;
      ctx.lineWidth = pano.width / 1400;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }

    const head = points[points.length - 1];
    if (head.altDeg < PANORAMA_ALT_MIN) {
      ctx.restore();
      continue;
    }
    const p = azAltToPanorama(head.azDeg, head.altDeg, pano);

    // orient the glyph along its on-screen travel direction (-y = nose)
    if (points.length >= 2) {
      const prev = azAltToPanorama(points[points.length - 2].azDeg, points[points.length - 2].altDeg, pano);
      const dx = p.x - prev.x;
      const dy = p.y - prev.y;
      if (Math.abs(dx) < pano.width / 2 && (dx || dy)) {
        trail.angle = Math.atan2(dy, dx) + Math.PI / 2;
      }
    }

    const fade = Math.max(0.3, 1 - (now - trail.lastSeen) / TRAIL_TTL_MS);
    const s = glyphSize * GLYPH_SCALE[trail.kind];

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(trail.angle);
    drawAircraftGlyph(ctx, trail.kind, s, AMBER_RGB, fade, timeSec, trail.seed);
    ctx.restore();

    // call sign label (unrotated)
    ctx.globalAlpha = fade;
    ctx.shadowBlur = 0;
    ctx.font = `${labelSize}px IBM Plex Mono, ui-monospace, monospace`;
    ctx.fillStyle = 'rgba(245,200,120,0.95)';
    ctx.fillText(trail.callsign, p.x + s * 1.4, p.y - s * 1.2);
    ctx.restore();
  }
}

function drawFlash(
  ctx: CanvasRenderingContext2D,
  star: SkyPoint,
  pano: PanoramaSize,
  timeMs: number
) {
  const { x, y } = azAltToPanorama(star.azDeg, star.altDeg, pano);
  const pulse = 0.5 + 0.5 * Math.sin(timeMs / 160);
  const r = (pano.width / 70) * (0.7 + 0.5 * pulse);
  ctx.save();
  const glow = ctx.createRadialGradient(x, y, 0, x, y, r);
  glow.addColorStop(0, `rgba(232,160,32,${0.9 * pulse + 0.1})`);
  glow.addColorStop(0.5, 'rgba(232,160,32,0.45)');
  glow.addColorStop(1, 'rgba(232,160,32,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = AMBER;
  ctx.lineWidth = pano.width / 900;
  ctx.beginPath();
  ctx.arc(x, y, r * 0.45, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

/** Copy a (possibly seam-wrapping, vertically clamped) slice of the panorama into target. */
function copyWindow(
  panorama: HTMLCanvasElement,
  sourceX: number,
  sourceY: number,
  sourceW: number,
  sourceH: number,
  target: HTMLCanvasElement
) {
  const ctx = target.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, target.width, target.height);
  const W = panorama.width;
  // Normalise the start into [0, W) and draw in horizontal tiles so wrapping works.
  let startX = ((sourceX % W) + W) % W;
  let drawnW = 0;
  while (drawnW < sourceW) {
    const sliceW = Math.min(W - startX, sourceW - drawnW);
    const dx = (drawnW / sourceW) * target.width;
    const dw = (sliceW / sourceW) * target.width;
    ctx.drawImage(panorama, startX, sourceY, sliceW, sourceH, dx, 0, dw, target.height);
    drawnW += sliceW;
    startX = 0;
  }
}

function wallAspect(surface: MappingSurface): number {
  const xs = surface.destinationQuad.map((p) => p.x);
  const ys = surface.destinationQuad.map((p) => p.y);
  const w = Math.max(...xs) - Math.min(...xs);
  const h = Math.max(...ys) - Math.min(...ys);
  return h > 0 ? w / h : 1.6;
}

function activeFlashName(surface: MappingSurface, now: number): string | null {
  const flash = surface.flashTarget;
  return flash && flash.until > now ? flash.name : null;
}

// ---- manager ---------------------------------------------------------------

export class LiveSkyManager {
  private panoramas = new Map<string, HTMLCanvasElement>();
  private windows = new Map<string, HTMLCanvasElement>();
  private trails = new Map<string, Trail>();
  private snapshot: SkySnapshot | null = null;
  private flightUnsub: (() => void) | null = null;
  private flightLoc = '';

  /** Render every live surface for this frame. Returns the per-surface canvases. */
  update(surfaces: MappingSurface[], now: Date): Map<string, HTMLCanvasElement> {
    const live = surfaces.filter((s) => s.contentType === 'live' && s.liveConfig && s.calibration);
    const output = new Map<string, HTMLCanvasElement>();
    if (live.length === 0) {
      this.releaseFlights();
      return output;
    }

    const timeMs = now.getTime();
    const config = live[0].liveConfig as LiveLayerConfig;
    this.ensureFlights(config);
    const snapshot = this.refreshSnapshot(now, config);

    // group by liveLayerId so surfaces sharing a layer share one panorama render
    const byLayer = new Map<string, MappingSurface[]>();
    for (const surface of live) {
      const key = surface.liveLayerId || 'bedroom-sky';
      const list = byLayer.get(key) || [];
      list.push(surface);
      byLayer.set(key, list);
    }

    for (const [layerId, layerSurfaces] of byLayer) {
      const panorama = this.renderPanorama(layerId, config, snapshot, layerSurfaces, timeMs);
      for (const surface of layerSurfaces) {
        const target = this.renderSurfaceWindow(surface, panorama);
        output.set(surface.id, target);
      }
    }

    return output;
  }

  private renderPanorama(
    layerId: string,
    config: LiveLayerConfig,
    snapshot: SkySnapshot,
    surfaces: MappingSurface[],
    timeMs: number
  ): HTMLCanvasElement {
    let panorama = this.panoramas.get(layerId);
    if (!panorama) {
      panorama = makeCanvas(DEFAULT_PANORAMA.width, DEFAULT_PANORAMA.height);
      this.panoramas.set(layerId, panorama);
    }
    const ctx = panorama.getContext('2d');
    if (!ctx) return panorama;
    const pano = { width: panorama.width, height: panorama.height };

    drawNightBackground(ctx, pano.width, pano.height);
    if (config.showAurora) drawAurora(ctx, pano.width, pano.height, timeMs);
    if (config.showStars) {
      drawConstellations(ctx, snapshot.starsById, pano);
      drawStars(ctx, snapshot.stars, config, pano, timeMs);
    }
    drawMoonGlyph(ctx, snapshot.moon, pano);
    if (config.showISS && snapshot.iss) drawIss(ctx, snapshot.iss, pano, timeMs);
    if (config.showFlights) drawFlights(ctx, this.trails, pano, timeMs, timeMs / 1000);

    // flash reference star (physically positioned, shows on whichever wall sees it)
    for (const surface of surfaces) {
      const name = activeFlashName(surface, timeMs);
      if (!name) continue;
      const star = snapshot.stars.find((s) => s.name === name);
      if (star && star.altDeg > -2) drawFlash(ctx, star, pano, timeMs);
    }

    return panorama;
  }

  private renderSurfaceWindow(surface: MappingSurface, panorama: HTMLCanvasElement): HTMLCanvasElement {
    const calibration = surface.calibration as SurfaceCalibration;
    const aspect = wallAspect(surface);
    const rect = calibrationToSourceRect(calibration, aspect, { width: panorama.width, height: panorama.height });

    const targetW = Math.min(1600, Math.max(2, Math.round(rect.width)));
    const targetH = Math.max(2, Math.round(targetW / aspect));
    let target = this.windows.get(surface.id);
    if (!target || target.width !== targetW || target.height !== targetH) {
      target = makeCanvas(targetW, targetH);
      this.windows.set(surface.id, target);
    }

    // clamp the vertical window into the panorama
    const sourceY = Math.max(0, Math.min(panorama.height - 1, rect.y));
    const sourceH = Math.max(1, Math.min(panorama.height - sourceY, rect.height));
    copyWindow(panorama, rect.x, sourceY, rect.width, sourceH, target);
    return target;
  }

  private refreshSnapshot(now: Date, config: LiveLayerConfig): SkySnapshot {
    const timeMs = now.getTime();
    if (this.snapshot && timeMs - this.snapshot.computedAt < SNAPSHOT_INTERVAL_MS) {
      this.updateTrails(now, config);
      return this.snapshot;
    }
    const stars = computeStars(now, config.lat, config.lon);
    const starsById = new Map(stars.map((s) => [s.id, s]));
    const moon = computeMoon(now, config.lat, config.lon);
    const iss = config.showISS ? liveSkyService.getIssLookAngle(now, config.lat, config.lon) : null;
    if (config.showISS) liveSkyService.ensureTle();

    const flights: FlightSample[] = config.showFlights
      ? liveSkyService.getFlights().map((flight) => ({ flight, look: flightLookAngle(config.lat, config.lon, flight) }))
      : [];

    this.snapshot = { stars, starsById, moon, iss, flights, computedAt: timeMs };
    this.updateTrails(now, config);
    return this.snapshot;
  }

  private updateTrails(now: Date, config: LiveLayerConfig) {
    const timeMs = now.getTime();
    if (config.showFlights && this.snapshot) {
      for (const { flight, look } of this.snapshot.flights) {
        if (look.altDeg < PANORAMA_ALT_MIN) continue;
        const trail = this.trails.get(flight.icao) || {
          points: [],
          lastSeen: 0,
          callsign: flight.callsign,
          kind: classifyGlyph({ typeCode: flight.typeCode, category: flight.category }),
          seed: hashSeed(flight.icao),
          angle: 0
        };
        trail.callsign = flight.callsign;
        trail.kind = classifyGlyph({ typeCode: flight.typeCode, category: flight.category });
        const last = trail.points[trail.points.length - 1];
        if (!last || Math.abs(last.azDeg - look.azDeg) > 0.02 || Math.abs(last.altDeg - look.altDeg) > 0.02) {
          trail.points.push({ azDeg: look.azDeg, altDeg: look.altDeg });
          if (trail.points.length > TRAIL_MAX) trail.points.shift();
        }
        trail.lastSeen = timeMs;
        this.trails.set(flight.icao, trail);
      }
    }
    for (const [icao, trail] of this.trails) {
      if (timeMs - trail.lastSeen > TRAIL_TTL_MS) this.trails.delete(icao);
    }
  }

  private ensureFlights(config: LiveLayerConfig) {
    if (!config.showFlights) {
      this.releaseFlights();
      return;
    }
    const loc = `${config.lat.toFixed(2)},${config.lon.toFixed(2)}`;
    if (this.flightUnsub && loc === this.flightLoc) return;
    this.releaseFlights();
    this.flightLoc = loc;
    this.flightUnsub = liveSkyService.subscribeFlights(config.lat, config.lon);
  }

  private releaseFlights() {
    if (this.flightUnsub) {
      this.flightUnsub();
      this.flightUnsub = null;
      this.flightLoc = '';
    }
  }

  dispose() {
    this.releaseFlights();
    this.panoramas.clear();
    this.windows.clear();
    this.trails.clear();
    this.snapshot = null;
  }
}
