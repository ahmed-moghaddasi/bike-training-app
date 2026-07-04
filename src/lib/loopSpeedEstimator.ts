import { DEFAULT_DETECTION_CONFIG } from './detection/types';
import type { DetectionConfig } from './detection/types';
import type { CapturedFrame } from './lapDetector';

/**
 * Standalone speed estimator for the Loop drill — deliberately not shared
 * with straightLineDetector.ts (that file is being actively edited for the
 * Straight Line drill elsewhere; duplicating the small amount of centroid/
 * velocity math needed here keeps Loop fully isolated). The approach mirrors
 * Straight Line's: a wide multi-strip crop, a per-frame weighted centroid,
 * and a linear-regression velocity converted to km/h via an assumed camera
 * distance/field-of-view — simplified relative to Straight Line by dropping
 * everything specific to braking-onset/stop classification, since Loop just
 * needs one average speed per pass, not a braking marker.
 */
export type LoopSpeedConfig = {
  /** Horizontal strips across the full frame width (= sampleWidth passed to frame extraction). */
  numStrips: number;
  /** Rows per frame used for per-strip averaging. */
  sampleHeight: number;
  /** Vertical center of the crop band (0 = top, 1 = bottom). */
  bandCenterRatio: number;
  /** Crop height as a fraction of the full frame. */
  bandRatio: number;
  /** Luminance delta (0-255) for a pixel to count as "changed". */
  pixelDeltaThreshold: number;
  /** Fraction of a strip's pixels that must change to call that strip active. */
  minStripActivityRatio: number;
  /** Recompute background baseline every N seconds. */
  baselineWindowSeconds: number;
  /** Histogram bins for mode computation. */
  modeBinCount: number;
  /** Minimum active strips in a frame for the bike to be considered visible. */
  minActiveStrips: number;
  /** Gap between active frames (ms) that splits one pass into two. */
  passGapMs: number;
  /** Minimum duration (ms) for a pass to qualify as measurable. */
  minPassDurationMs: number;
  /**
   * Fraction of frames trimmed off each end of a pass before measuring
   * velocity — the centroid is unreliable while the bike is only partially
   * visible entering/exiting the wide zone (the same partial-visibility
   * problem Straight Line's "entry spike" detection handles; simplified here
   * to a fixed trim since Loop has no braking marker to calibrate against).
   */
  edgeTrimFraction: number;
  /** Camera distance from the riding line in metres. Only used as a fallback when frameWidthMetersOverride isn't set. */
  cameraDistanceMeters: number;
  /** Estimated horizontal field of view in degrees. Only used as a fallback when frameWidthMetersOverride isn't set. */
  estimatedHFOVDegrees: number;
  /**
   * Directly calibrated frame width (metres) at the riding line, when known —
   * takes priority over cameraDistanceMeters/estimatedHFOVDegrees when set
   * (see detectLoopSpeeds). Derived by measuring a real object of known size
   * in the actual footage instead of assuming a camera distance and lens
   * angle and multiplying them together — every error in either of those two
   * guesses otherwise compounds directly into the speed number. Undefined
   * falls back to the distance/FOV guess below.
   */
  frameWidthMetersOverride?: number;
};

/**
 * cameraDistanceMeters (8) is as described by the rider; estimatedHFOVDegrees
 * (65, an iPhone main/1x lens guess) is now known to be wrong — see
 * frameWidthMetersOverride below — and is kept only as the fallback formula's
 * input for a future session with a different, uncalibrated setup.
 *
 * frameWidthMetersOverride (20.61m) is calibrated from the rider's own bike:
 * a 2024 YCF SM 190 Daytona's published wheelbase (1.170m) measured against
 * three real crossings in the July 3rd 2026 ground-truth clip (front/rear
 * wheel-center pixel spans of ~108.5px, ~109.3px, ~120px out of the 1920px-
 * wide source frame — averaged to ~109px from the two cleanest, least-
 * motion-blurred measurements). frameWidthMeters = wheelbase_m ×
 * (frame_width_px / measured_wheelbase_px) — this ratio is resolution-
 * independent (both sides scale together), so it doesn't matter that the
 * measurement was done on full-resolution frames while detection runs on a
 * downsampled copy.
 *
 * This came out to ~20.6m — roughly 2x the old guess-based 10.2m, implying
 * an actual horizontal field of view around 104° at 8m, not 65°. That's much
 * closer to an ultra-wide (0.5x) lens's typical FOV than the 1x lens
 * originally assumed, which the rider was already unsure about ("I don't
 * remember if I had the camera on 0.5 zoom or 1.0 zoom"). Net effect: every
 * previously reported Loop speed was very likely about half the real value.
 */
export const DEFAULT_LOOP_SPEED_CONFIG: LoopSpeedConfig = {
  numStrips: 40,
  sampleHeight: 10,
  bandCenterRatio: 0.55,
  bandRatio: 0.35,
  pixelDeltaThreshold: 16,
  minStripActivityRatio: 0.08,
  baselineWindowSeconds: 12,
  modeBinCount: 32,
  minActiveStrips: 2,
  passGapMs: 300,
  minPassDurationMs: 300,
  edgeTrimFraction: 0.15,
  cameraDistanceMeters: 8,
  estimatedHFOVDegrees: 65,
  frameWidthMetersOverride: 20.61,
};

export type LoopSpeedMeasurement = {
  startTimeMs: number;
  endTimeMs: number;
  direction: 'left-to-right' | 'right-to-left' | null;
  /** Average speed across the (edge-trimmed) pass, km/h. Null if too few clean frames to measure. */
  avgSpeedKph: number | null;
  centroidFrameCount: number;
};

export type LoopSpeedDiagnostics = {
  frameCount: number;
  clipDurationSeconds: number;
  frameWidthMeters: number;
  metersPerStrip: number;
};

export type LoopSpeedResult = {
  passes: LoopSpeedMeasurement[];
  diagnostics: LoopSpeedDiagnostics;
};

/** Converts a LoopSpeedConfig into the DetectionConfig shape FrameExtractors expect — a wide, full-width crop instead of the narrow crossing zone lapDetector uses. */
export function toFrameExtractionConfig(config: LoopSpeedConfig): DetectionConfig {
  return {
    ...DEFAULT_DETECTION_CONFIG,
    orientation: 'vertical',
    zoneWidthRatio: 1.0,
    bandRatio: config.bandRatio,
    bandCenterRatio: config.bandCenterRatio,
    sampleWidth: config.numStrips,
    sampleHeight: config.sampleHeight,
    pixelDeltaThreshold: config.pixelDeltaThreshold,
  };
}

type FrameDatum = { timeMs: number; centroid: number | null };
type Pass = { startMs: number; endMs: number; durationMs: number; frameData: FrameDatum[] };

export function detectLoopSpeeds(frames: CapturedFrame[], config: LoopSpeedConfig): LoopSpeedResult {
  const frameWidthMeters =
    config.frameWidthMetersOverride ??
    2 * config.cameraDistanceMeters * Math.tan((config.estimatedHFOVDegrees / 2) * (Math.PI / 180));
  const metersPerStrip = frameWidthMeters / config.numStrips;

  const empty: LoopSpeedResult = {
    passes: [],
    diagnostics: { frameCount: frames.length, clipDurationSeconds: 0, frameWidthMeters, metersPerStrip },
  };
  if (frames.length < 4) return empty;

  const pixelCount = config.numStrips * config.sampleHeight;
  const { baselines, windowOf } = computeBaselines(frames, pixelCount, config);
  const frameData = computeFrameData(frames, baselines, windowOf, config);
  const passes = findPasses(frameData, config)
    .filter((pass) => pass.durationMs >= config.minPassDurationMs)
    .map((pass) => analysePass(pass, config, metersPerStrip));

  return {
    passes,
    diagnostics: {
      frameCount: frames.length,
      clipDurationSeconds: frames.length > 1 ? (frames[frames.length - 1].time - frames[0].time) / 1000 : 0,
      frameWidthMeters,
      metersPerStrip,
    },
  };
}

function computeBaselines(
  frames: CapturedFrame[],
  pixelCount: number,
  config: LoopSpeedConfig,
): { baselines: Float32Array[]; windowOf: (timeMs: number) => number } {
  const windowMs = Math.max(1, config.baselineWindowSeconds * 1000);
  const startTime = frames[0].time;
  const endTime = frames[frames.length - 1].time;
  const windowCount = Math.max(1, Math.ceil((endTime - startTime + 1) / windowMs));
  const windowOf = (timeMs: number) =>
    Math.min(windowCount - 1, Math.max(0, Math.floor((timeMs - startTime) / windowMs)));

  const gridsPerWindow: Float32Array[][] = Array.from({ length: windowCount }, () => []);
  for (const frame of frames) gridsPerWindow[windowOf(frame.time)].push(frame.grid);

  const baselines = gridsPerWindow.map((grids) =>
    grids.length ? modeBaseline(grids, pixelCount, config.modeBinCount) : new Float32Array(pixelCount),
  );
  return { baselines, windowOf };
}

function modeBaseline(grids: Float32Array[], pixelCount: number, modeBinCount: number): Float32Array {
  const binWidth = 256 / modeBinCount;
  const histogram = new Uint32Array(pixelCount * modeBinCount);
  for (const grid of grids) {
    for (let i = 0; i < pixelCount; i++) {
      const bin = Math.min(modeBinCount - 1, Math.floor(grid[i] / binWidth));
      histogram[i * modeBinCount + bin] += 1;
    }
  }
  const baseline = new Float32Array(pixelCount);
  for (let i = 0; i < pixelCount; i++) {
    let bestBin = 0;
    let bestCount = -1;
    for (let b = 0; b < modeBinCount; b++) {
      const count = histogram[i * modeBinCount + b];
      if (count > bestCount) {
        bestCount = count;
        bestBin = b;
      }
    }
    baseline[i] = (bestBin + 0.5) * binWidth;
  }
  return baseline;
}

function computeFrameData(
  frames: CapturedFrame[],
  baselines: Float32Array[],
  windowOf: (timeMs: number) => number,
  config: LoopSpeedConfig,
): FrameDatum[] {
  const { numStrips, sampleHeight, pixelDeltaThreshold, minStripActivityRatio, minActiveStrips } = config;

  return frames.map(({ time, grid }) => {
    const baseline = baselines[windowOf(time)];
    let weightSum = 0;
    let posSum = 0;
    let activeCount = 0;

    for (let x = 0; x < numStrips; x++) {
      let changed = 0;
      for (let y = 0; y < sampleHeight; y++) {
        const idx = y * numStrips + x;
        if (Math.abs(grid[idx] - baseline[idx]) >= pixelDeltaThreshold) changed++;
      }
      const activity = changed / sampleHeight;
      if (activity >= minStripActivityRatio) {
        weightSum += activity;
        posSum += x * activity;
        activeCount++;
      }
    }

    return {
      timeMs: time,
      centroid: activeCount >= minActiveStrips && weightSum > 0 ? posSum / weightSum : null,
    };
  });
}

function findPasses(frameData: FrameDatum[], config: LoopSpeedConfig): Pass[] {
  const passes: Pass[] = [];
  let current: FrameDatum[] = [];
  let lastActiveMs = -Infinity;

  for (const datum of frameData) {
    if (datum.centroid !== null) {
      if (current.length > 0 && datum.timeMs - lastActiveMs > config.passGapMs) {
        commitPass(passes, current);
        current = [];
      }
      current.push(datum);
      lastActiveMs = datum.timeMs;
    } else if (current.length > 0 && datum.timeMs - lastActiveMs > config.passGapMs) {
      commitPass(passes, current);
      current = [];
      lastActiveMs = -Infinity;
    }
  }
  if (current.length > 0) commitPass(passes, current);
  return passes;
}

function commitPass(passes: Pass[], frameData: FrameDatum[]) {
  if (frameData.length === 0) return;
  passes.push({
    startMs: frameData[0].timeMs,
    endMs: frameData[frameData.length - 1].timeMs,
    durationMs: frameData[frameData.length - 1].timeMs - frameData[0].timeMs,
    frameData,
  });
}

function analysePass(pass: Pass, config: LoopSpeedConfig, metersPerStrip: number): LoopSpeedMeasurement {
  const centroids = pass.frameData.map((d) => d.centroid!);
  const times = pass.frameData.map((d) => d.timeMs);
  const base = { startTimeMs: pass.startMs, endTimeMs: pass.endMs, centroidFrameCount: pass.frameData.length };

  const trim = Math.floor(centroids.length * config.edgeTrimFraction);
  const cleanCentroids = centroids.slice(trim, centroids.length - trim);
  const cleanTimes = times.slice(trim, times.length - trim);

  if (cleanCentroids.length < 4) return { ...base, direction: null, avgSpeedKph: null };

  const delta = cleanCentroids[cleanCentroids.length - 1] - cleanCentroids[0];
  const direction: 'left-to-right' | 'right-to-left' | null =
    Math.abs(delta) < 1 ? null : delta > 0 ? 'left-to-right' : 'right-to-left';

  const slopeStripsPerMs = Math.abs(linearSlope(cleanCentroids, cleanTimes));
  const avgSpeedKph = slopeStripsPerMs * 1000 * metersPerStrip * 3.6;

  return { ...base, direction, avgSpeedKph };
}

/** Ordinary-least-squares slope of values vs times. Centers times to avoid catastrophic cancellation with large (ms-since-epoch-scale) timestamps. */
function linearSlope(values: number[], times: number[]): number {
  const n = values.length;
  if (n < 2) return 0;
  const meanT = times.reduce((s, t) => s + t, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    const dt = times[i] - meanT;
    num += dt * values[i];
    den += dt * dt;
  }
  if (Math.abs(den) < 1e-12) return 0;
  return num / den;
}
