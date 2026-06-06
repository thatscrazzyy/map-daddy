import type { Point, SourceRect } from '../projects/types';

type Drawable = HTMLImageElement | HTMLVideoElement | HTMLCanvasElement;

function triangleTransform(source: Point[], destination: Point[]) {
  const [s0, s1, s2] = source;
  const [d0, d1, d2] = destination;
  const denominator = s0.x * (s1.y - s2.y) + s1.x * (s2.y - s0.y) + s2.x * (s0.y - s1.y);
  if (Math.abs(denominator) < 0.0001) return null;

  return {
    a: (d0.x * (s1.y - s2.y) + d1.x * (s2.y - s0.y) + d2.x * (s0.y - s1.y)) / denominator,
    b: (d0.y * (s1.y - s2.y) + d1.y * (s2.y - s0.y) + d2.y * (s0.y - s1.y)) / denominator,
    c: (d0.x * (s2.x - s1.x) + d1.x * (s0.x - s2.x) + d2.x * (s1.x - s0.x)) / denominator,
    d: (d0.y * (s2.x - s1.x) + d1.y * (s0.x - s2.x) + d2.y * (s1.x - s0.x)) / denominator,
    e: (d0.x * (s1.x * s2.y - s2.x * s1.y) + d1.x * (s2.x * s0.y - s0.x * s2.y) + d2.x * (s0.x * s1.y - s1.x * s0.y)) / denominator,
    f: (d0.y * (s1.x * s2.y - s2.x * s1.y) + d1.y * (s2.x * s0.y - s0.x * s2.y) + d2.y * (s0.x * s1.y - s1.x * s0.y)) / denominator
  };
}

function drawTriangle(ctx: CanvasRenderingContext2D, image: Drawable, source: Point[], destination: Point[]) {
  const matrix = triangleTransform(source, destination);
  if (!matrix) return;

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(destination[0].x, destination[0].y);
  ctx.lineTo(destination[1].x, destination[1].y);
  ctx.lineTo(destination[2].x, destination[2].y);
  ctx.closePath();
  ctx.clip();
  ctx.transform(matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f);
  ctx.drawImage(image, 0, 0);
  ctx.restore();
}

/**
 * Fade the alpha of a canvas towards its four edges. `fraction` is the feather
 * width as a share of each dimension (0 = none). Used to soft-blend abutting
 * surfaces at a projection seam — give the two surfaces a small overlap and
 * feather their touching edges so the overlap cross-fades instead of showing a
 * hard line. Uses destination-out so only the edges are affected.
 */
function applyEdgeFeather(ctx: CanvasRenderingContext2D, width: number, height: number, fraction: number) {
  const fx = Math.max(1, Math.round(width * fraction));
  const fy = Math.max(1, Math.round(height * fraction));
  const edges: Array<[number, number, number, number, number, number, number, number]> = [
    [0, 0, fx, 0, 0, 0, fx, height], // left
    [width, 0, width - fx, 0, width - fx, 0, fx, height], // right
    [0, 0, 0, fy, 0, 0, width, fy], // top
    [0, height, 0, height - fy, 0, height - fy, width, fy] // bottom
  ];
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  for (const [gx0, gy0, gx1, gy1, rx, ry, rw, rh] of edges) {
    const gradient = ctx.createLinearGradient(gx0, gy0, gx1, gy1);
    gradient.addColorStop(0, 'rgba(0,0,0,1)');
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(rx, ry, rw, rh);
  }
  ctx.restore();
}

export function drawImageToQuad(ctx: CanvasRenderingContext2D, image: Drawable, sourceRect: SourceRect, destinationQuad: [Point, Point, Point, Point], edgeFeather = 0) {
  const sourceCanvas = document.createElement('canvas');
  sourceCanvas.width = Math.max(1, Math.round(sourceRect.width));
  sourceCanvas.height = Math.max(1, Math.round(sourceRect.height));
  const sourceCtx = sourceCanvas.getContext('2d');
  if (!sourceCtx) return;
  sourceCtx.drawImage(image, sourceRect.x, sourceRect.y, sourceRect.width, sourceRect.height, 0, 0, sourceCanvas.width, sourceCanvas.height);
  if (edgeFeather > 0) applyEdgeFeather(sourceCtx, sourceCanvas.width, sourceCanvas.height, Math.min(0.49, edgeFeather));

  const sourceQuad: [Point, Point, Point, Point] = [
    { x: 0, y: 0 },
    { x: sourceCanvas.width, y: 0 },
    { x: sourceCanvas.width, y: sourceCanvas.height },
    { x: 0, y: sourceCanvas.height }
  ];

  // A canvas transform is affine, so a quad is rendered as two clipped triangles.
  // This is stable and lightweight for MVP; a WebGL shader can replace this later for true perspective correction.
  drawTriangle(ctx, sourceCanvas, [sourceQuad[0], sourceQuad[1], sourceQuad[2]], [destinationQuad[0], destinationQuad[1], destinationQuad[2]]);
  drawTriangle(ctx, sourceCanvas, [sourceQuad[0], sourceQuad[2], sourceQuad[3]], [destinationQuad[0], destinationQuad[2], destinationQuad[3]]);
}
