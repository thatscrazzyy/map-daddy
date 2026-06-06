const SAMPLE_WIDTH = 1280;
const SAMPLE_HEIGHT = 720;

function canvasToBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Could not create sample image'));
    }, type);
  });
}

function createSampleFile(blob: Blob): File {
  const name = `map-daddy-sample-${Date.now().toString(36)}.png`;
  try {
    return new File([blob], name, { type: blob.type || 'image/png' });
  } catch {
    const fallback = blob as Blob & { name: string; lastModified: number };
    fallback.name = name;
    fallback.lastModified = Date.now();
    return fallback as File;
  }
}

export async function generateSampleImage(): Promise<File> {
  const canvas = document.createElement('canvas');
  canvas.width = SAMPLE_WIDTH;
  canvas.height = SAMPLE_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not available in this browser');

  const gradient = ctx.createLinearGradient(0, 0, SAMPLE_WIDTH, SAMPLE_HEIGHT);
  gradient.addColorStop(0, '#08111f');
  gradient.addColorStop(0.5, '#172554');
  gradient.addColorStop(1, '#062c2f');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, SAMPLE_WIDTH, SAMPLE_HEIGHT);

  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.lineWidth = 2;
  for (let x = 0; x <= SAMPLE_WIDTH; x += 80) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, SAMPLE_HEIGHT);
    ctx.stroke();
  }
  for (let y = 0; y <= SAMPLE_HEIGHT; y += 80) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(SAMPLE_WIDTH, y);
    ctx.stroke();
  }

  ctx.strokeStyle = 'rgba(125,244,255,0.95)';
  ctx.lineWidth = 8;
  ctx.strokeRect(48, 48, SAMPLE_WIDTH - 96, SAMPLE_HEIGHT - 96);

  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.font = '700 72px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('MAP DADDY', SAMPLE_WIDTH / 2, SAMPLE_HEIGHT / 2 - 34);

  ctx.font = '500 28px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  ctx.fillStyle = 'rgba(207,250,254,0.9)';
  ctx.fillText('LOCAL SAMPLE GRID', SAMPLE_WIDTH / 2, SAMPLE_HEIGHT / 2 + 42);

  ctx.fillStyle = '#f8fafc';
  const markers = [
    [48, 48],
    [SAMPLE_WIDTH - 48, 48],
    [SAMPLE_WIDTH - 48, SAMPLE_HEIGHT - 48],
    [48, SAMPLE_HEIGHT - 48]
  ];
  for (const [x, y] of markers) {
    ctx.beginPath();
    ctx.arc(x, y, 14, 0, Math.PI * 2);
    ctx.fill();
  }

  return createSampleFile(await canvasToBlob(canvas, 'image/png'));
}
