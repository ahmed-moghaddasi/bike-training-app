import { spawn } from 'node:child_process';
import { computeCropRectRatio } from '../src/lib/detection/geometry';
import { downsampleLuminance, downsampleMarkerMatch } from '../src/lib/frameSampling';
import type { CapturedFrame, FrameExtractor } from '../src/lib/lapDetector';

/**
 * Default forced output frame rate. Per-frame timestamps are exact integer
 * arithmetic (frameIndex / fps) instead of depending on parsing the source's
 * native — and possibly variable — frame rate.
 */
const DEFAULT_FPS = 30;

/**
 * Returns a FrameExtractor that uses ffmpeg for server-side frame extraction.
 * Crops and scales to the detection config's sample size directly in ffmpeg's
 * filter graph — same crop math (computeCropRectRatio) the browser path uses.
 *
 * @param fps Output frame rate. Default 30. Pass 60 for drills where
 *   finer temporal resolution matters (e.g. velocity profiling in the
 *   straight-line braking detector).
 */
export function createFfmpegExtractor(fps: number = DEFAULT_FPS): FrameExtractor {
  return (videoPath, detection) => {
    const ratio = computeCropRectRatio(detection);
    const filter = `crop=iw*${ratio.width}:ih*${ratio.height}:iw*${ratio.left}:ih*${ratio.top},scale=${detection.sampleWidth}:${detection.sampleHeight},fps=${fps}`;

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
          frames.push({ time: (frameIndex / fps) * 1000, grid, markerMatch });
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
}

/** Pre-built 30 fps extractor — default for all drills. Backward-compatible alias. */
export const extractFramesWithFfmpeg: FrameExtractor = createFfmpegExtractor(DEFAULT_FPS);
