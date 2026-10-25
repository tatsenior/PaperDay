export const MAX_BACKGROUND_BYTES = 10 * 1024 * 1024;
export function cropRectangle(width, height, aspect, zoom = 1, x = 50, y = 50) {
  if (![width, height, aspect].every(n => Number.isFinite(n) && n > 0)) throw new Error('图片尺寸无效。');
  const clamp = (n, min, max, fallback) => Math.min(max, Math.max(min, Number.isFinite(n) ? n : fallback));
  const scale = clamp(zoom, 1, 4, 1);
  const cropWidth = Math.min(width, height * aspect) / scale;
  const cropHeight = cropWidth / aspect;
  return { x: (width - cropWidth) * clamp(x, 0, 100, 50) / 100, y: (height - cropHeight) * clamp(y, 0, 100, 50) / 100, width: cropWidth, height: cropHeight };
}
