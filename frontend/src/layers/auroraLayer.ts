/**
 * Pure, dependency-free aurora base layer. Draws a set of slow drifting
 * elliptical blobs in the green band (hsla hue 120–180) that breathe over
 * seconds and migrate over hours, giving the sky a living backdrop beneath the
 * stars. Deterministic for a given time so editor preview and projector match.
 */

type Blob = {
  baseX: number; // 0..1 across width
  baseY: number; // 0..1 across height (biased low / near horizon)
  driftX: number;
  driftY: number;
  radius: number; // 0..1 of width
  aspect: number; // ellipse height / width
  hue: number; // 120..180
  speed: number; // hours per drift cycle
  phase: number;
};

// Hand-seeded so the band sits low and wide like a real aurora curtain.
const BLOBS: Blob[] = [
  { baseX: 0.18, baseY: 0.74, driftX: 0.10, driftY: 0.05, radius: 0.34, aspect: 0.5, hue: 145, speed: 6.0, phase: 0.0 },
  { baseX: 0.42, baseY: 0.66, driftX: 0.14, driftY: 0.06, radius: 0.40, aspect: 0.42, hue: 158, speed: 8.5, phase: 1.7 },
  { baseX: 0.66, baseY: 0.78, driftX: 0.11, driftY: 0.04, radius: 0.30, aspect: 0.55, hue: 132, speed: 5.0, phase: 3.1 },
  { baseX: 0.84, baseY: 0.70, driftX: 0.13, driftY: 0.05, radius: 0.36, aspect: 0.48, hue: 168, speed: 7.2, phase: 4.6 },
  { baseX: 0.30, baseY: 0.82, driftX: 0.09, driftY: 0.03, radius: 0.26, aspect: 0.6, hue: 150, speed: 9.4, phase: 2.2 },
  { baseX: 0.56, baseY: 0.88, driftX: 0.12, driftY: 0.03, radius: 0.28, aspect: 0.58, hue: 140, speed: 6.8, phase: 5.3 }
];

/**
 * @param ctx   target 2D context
 * @param width canvas width in px
 * @param height canvas height in px
 * @param timeMs current time in ms (Date.now()), drives drift + breathing
 */
export function drawAurora(ctx: CanvasRenderingContext2D, width: number, height: number, timeMs: number): void {
  const hours = timeMs / 3_600_000;
  const seconds = timeMs / 1000;

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';

  for (const blob of BLOBS) {
    const driftAngle = (hours / blob.speed) * Math.PI * 2 + blob.phase;
    const cx = (blob.baseX + Math.cos(driftAngle) * blob.driftX) * width;
    const cy = (blob.baseY + Math.sin(driftAngle * 0.7) * blob.driftY) * height;

    // Breathing brightness over ~20–40 s plus a slow hourly swell.
    const breathe = 0.55 + 0.45 * (0.5 + 0.5 * Math.sin(seconds / (18 + blob.speed) + blob.phase));
    const swell = 0.7 + 0.3 * Math.sin(driftAngle * 0.5);
    const alpha = 0.16 * breathe * swell;

    const rx = blob.radius * width;
    const ry = rx * blob.aspect;
    const hue = blob.hue + 8 * Math.sin(driftAngle);

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1, ry / rx);
    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
    gradient.addColorStop(0, `hsla(${hue}, 85%, 60%, ${alpha})`);
    gradient.addColorStop(0.55, `hsla(${hue + 12}, 80%, 45%, ${alpha * 0.5})`);
    gradient.addColorStop(1, 'hsla(150, 80%, 40%, 0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(0, 0, rx, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Faint vertical ray streaks for curtain texture.
  ctx.globalAlpha = 0.05;
  for (let i = 0; i < 10; i += 1) {
    const t = (hours / 12 + i / 10) % 1;
    const x = t * width;
    const sway = Math.sin(seconds / 12 + i) * width * 0.01;
    const grad = ctx.createLinearGradient(x, height, x + sway, height * 0.3);
    grad.addColorStop(0, 'hsla(150, 90%, 55%, 0)');
    grad.addColorStop(0.6, 'hsla(150, 90%, 55%, 0.5)');
    grad.addColorStop(1, 'hsla(150, 90%, 55%, 0)');
    ctx.strokeStyle = grad;
    ctx.lineWidth = width * 0.012;
    ctx.beginPath();
    ctx.moveTo(x, height);
    ctx.lineTo(x + sway, height * 0.32);
    ctx.stroke();
  }

  ctx.restore();
}
