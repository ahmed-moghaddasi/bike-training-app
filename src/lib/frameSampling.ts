/** Maps a downsampled (x, y) coordinate back to the source frame's RGBA byte index. Shared so luminance and marker-color sampling read the exact same source pixel. */
function sourceByteIndex(x: number, y: number, sampleWidth: number, sampleHeight: number, frame: ImageData): number {
  const sourceY = Math.min(frame.height - 1, Math.floor(((y + 0.5) * frame.height) / sampleHeight));
  const sourceX = Math.min(frame.width - 1, Math.floor(((x + 0.5) * frame.width) / sampleWidth));
  return (sourceY * frame.width + sourceX) * 4;
}

/**
 * Downsamples an RGBA frame to a small luminance grid (rec.601 luma weights).
 * Shared by the offline lap detector; used to keep one frame-math implementation
 * instead of duplicating it between a live detector and a post-processing one.
 */
export function downsampleLuminance(frame: ImageData, sampleWidth: number, sampleHeight: number): Float32Array {
  if (frame.width < 1 || frame.height < 1 || frame.data.length < frame.width * frame.height * 4) {
    throw new Error('downsampleLuminance requires non-empty RGBA ImageData.');
  }

  const output = new Float32Array(sampleWidth * sampleHeight);
  for (let y = 0; y < sampleHeight; y += 1) {
    for (let x = 0; x < sampleWidth; x += 1) {
      const sourceIndex = sourceByteIndex(x, y, sampleWidth, sampleHeight, frame);
      output[y * sampleWidth + x] =
        frame.data[sourceIndex] * 0.299 +
        frame.data[sourceIndex + 1] * 0.587 +
        frame.data[sourceIndex + 2] * 0.114;
    }
  }
  return output;
}

/** Hue (degrees, 0-360) and saturation (0-1) from 8-bit RGB — only what marker matching needs, skips value/lightness entirely. */
function rgbToHueSaturation(r: number, g: number, b: number): { hue: number; saturation: number } {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  const saturation = max === 0 ? 0 : delta / max;
  if (delta === 0) return { hue: 0, saturation };
  let hue: number;
  if (max === r) hue = ((g - b) / delta) % 6;
  else if (max === g) hue = (b - r) / delta + 2;
  else hue = (r - g) / delta + 4;
  hue *= 60;
  if (hue < 0) hue += 360;
  return { hue, saturation };
}

export type MarkerColor = { hue: number; hueToleranceDegrees: number; minSaturation: number };

/**
 * Downsamples an RGBA frame to a boolean grid of "matches the marker
 * sticker's color" — a high-contrast color signal that, unlike luminance,
 * mostly ignores ambient lighting changes (shadows, glare). Only meaningful
 * once a real marker color is configured; see DetectionConfig.markerColor.
 */
export function downsampleMarkerMatch(frame: ImageData, sampleWidth: number, sampleHeight: number, markerColor: MarkerColor): Uint8Array {
  const output = new Uint8Array(sampleWidth * sampleHeight);
  for (let y = 0; y < sampleHeight; y += 1) {
    for (let x = 0; x < sampleWidth; x += 1) {
      const sourceIndex = sourceByteIndex(x, y, sampleWidth, sampleHeight, frame);
      const { hue, saturation } = rgbToHueSaturation(frame.data[sourceIndex], frame.data[sourceIndex + 1], frame.data[sourceIndex + 2]);
      if (saturation < markerColor.minSaturation) continue;
      const hueDiff = Math.min(Math.abs(hue - markerColor.hue), 360 - Math.abs(hue - markerColor.hue));
      if (hueDiff <= markerColor.hueToleranceDegrees) output[y * sampleWidth + x] = 1;
    }
  }
  return output;
}
