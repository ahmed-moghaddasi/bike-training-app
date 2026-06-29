import { spawn } from 'node:child_process';
import { computeCropRectRatio } from '../src/lib/detection/geometry';
import { downsampleLuminance, downsampleMarkerMatch } from '../src/lib/frameSampling';
import type { CapturedFrame, FrameExtractor } from '../src/lib/lapDetector';

/**
 * Forced output frame rate, so per-frame timestamps are exact integer
 * arithmetic (frameIndex / FORCED_FPS) instead of depending on parsing the
 * source's native — and possibly variable — frame rate.
 */
const FORCED_FPS = 30;

/**
 * Server-side replacement for the browser's canvas-based extractFrames
 * (src/lib/lapDetector.ts). Crops and scales to the detection config's
 * sample size directly in ffmpeg's filter graph — same crop math
 * (computeCropRectRatio) the browser path uses — so the piped raw RGBA
 * stream stays small, then feeds each frame through the exact same
 * downsampleLuminance/downsampleMarkerMatch used client-side. Nothing about
 * the detection math itself changes between the two paths.
 */
export const extractFramesWithFfmpeg: FrameExtractor = (videoPath, detection) => {
  const ratio = computeCropRectRatio(detection);
  const filter = `crop=iw*${ratio.width}:ih*${ratio.height}:iw*${ratio.left}:ih*${ratio.top},scale=${detection.sampleWidth}:${detection.sampleHeight},fps=${FORCED_FPS}`;

  return new Promise<CapturedFrame[]>((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', [
      '-nostdin',
      '-loglevel', 'error',
      '-i', videoPath,
      '-vf', filter,
      '-pix_fmt', 'rgba',
      '-f', 'rawvideo',
      '-',
    ]);

    const frameByteSize = detection.sampleWidth * detection.sampleHeight * 4;
    const frames: CapturedFrame[] = [];
    let buffered = Buffer.alloc(0);
    let frameIndex = 0;
    let stderr = '';

    ffmpeg.stdout.on('data', (chunk: Buffer) => {
      buffered = Buffer.concat([buffered, chunk]);
      while (buffered.length >= frameByteSize) {
        const frameData = buffered.subarray(0, frameByteSize);
        buffered = buffered.subarray(frameByteSize);
        const frameLike = { width: detection.sampleWidth, height: detection.sampleHeight, data: frameData };
        const grid = downsampleLuminance(frameLike, detection.sampleWidth, detection.sampleHeight);
        const markerMatch = detection.markerColor
          ? downsampleMarkerMatch(frameLike, detection.sampleWidth, detection.sampleHeight, detection.markerColor)
          : undefined;
        frames.push({ time: (frameIndex / FORCED_FPS) * 1000, grid, markerMatch });
        frameIndex += 1;
      }
    });

    ffmpeg.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    ffmpeg.on('error', reject);
    ffmpeg.on('close', (code) => {
      if (code !== 0 && frames.length === 0) {
        reject(new Error(`ffmpeg exited with code ${code}: ${stderr.slice(-2000)}`));
        return;
      }
      resolve(frames);
    });
  });
};
