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
    const sourceY = Math.min(frame.height - 1, Math.floor(((y + 0.5) * frame.height) / sampleHeight));
    for (let x = 0; x < sampleWidth; x += 1) {
      const sourceX = Math.min(frame.width - 1, Math.floor(((x + 0.5) * frame.width) / sampleWidth));
      const sourceIndex = (sourceY * frame.width + sourceX) * 4;
      output[y * sampleWidth + x] =
        frame.data[sourceIndex] * 0.299 +
        frame.data[sourceIndex + 1] * 0.587 +
        frame.data[sourceIndex + 2] * 0.114;
    }
  }
  return output;
}
