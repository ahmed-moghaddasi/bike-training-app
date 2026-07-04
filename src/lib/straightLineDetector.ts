import { DEFAULT_DETECTION_CONFIG } from './detection/types';
import type { DetectionConfig } from './detection/types';
import type { CapturedFrame } from './lapDetector';

// ─── Public config ────────────────────────────────────────────────────────────

export type StraightLineConfig = {
  // Frame geometry — must match the values passed to the frame extractor.
  /** Number of horizontal strips across the full frame width (= sampleWidth). */
  numStrips: number;
  /** Rows per frame used for per-strip averaging. */
  sampleHeight: number;
  /** Vertical center of the crop band (0 = top, 1 = bottom). */
  bandCenterRatio: number;
  /** Crop height as a fraction of the full frame. */
  bandRatio: number;

  // Pixel-level motion.
  /** Luminance delta (0–255) for a pixel to count as "changed". */
  pixelDeltaThreshold: number;
  /** Fraction of a strip's pixels that must change to call that strip active. */
  minStripActivityRatio: number;

  // Baseline estimation.
  /** Recompute background baseline every N seconds. */
  baselineWindowSeconds: number;
  /** Histogram bins for mode computation. */
  modeBinCount: number;

  // Pass detection (grouping active frames into candidate reps).
  /** Minimum active strips in a frame for the bike to be considered visible. */
  minActiveStrips: number;
  /** Gap between active frames (ms) that splits one pass into two. */
  passGapMs: number;
  /** Minimum duration (ms) for a pass to qualify as a candidate. */
  minPassDurationMs: number;

  // Velocity / braking marker.
  /** Moving-average window (frames) for smoothing the centroid series. */
  velocitySmoothingFrames: number;
  /**
   * Per-frame centroid velocity (strips/ms) above which a frame is considered
   * part of the entry spike rather than genuine approach motion. Approach speed
   * at 80 km/h ≈ 0.022 strips/ms; set well above that.
   */
  spikeVelocityThreshold: number;
  /**
   * Minimum number of clean (post-spike, pre-brake-marker) approach frames
   * required to use direct linear-regression speed measurement. Below this
   * threshold the algorithm falls back to the kinematic estimate.
   */
  minApproachFrames: number;
  /**
   * Assumed constant deceleration (m/s²) used as a fallback when there are not
   * enough clean approach frames for direct speed measurement. Entry speed is
   * then derived from v₀ = √(2·a·D) where D is the measured stopping distance.
   * Typical panic-braking on a dirt bike is 7–10 m/s² (0.7–1.0g).
   */
  assumedDecelerationMps2: number;

  // Stop classification.
  /**
   * If the pass ends with its centroid within this fraction of the far edge of
   * the frame (in the direction of travel), the bike likely exited the frame
   * rather than stopping — classify as loop-back, unless the end-velocity check
   * overrides (see endVelocityThresholdStripsPerMs).
   */
  farEdgeExitFraction: number;
  /**
   * When a pass ends near the far edge, measure the average centroid velocity
   * over the final endVelocityWindowFrames frames. If it is below this threshold
   * (strips/ms ≈ 0.004 = ~15 km/h at 1.03 m/strip), the bike was decelerating
   * to a stop at the edge rather than exiting — classify as a braking run.
   * A genuine loop-back at 20+ km/h will always be above this threshold.
   */
  endVelocityThresholdStripsPerMs: number;
  /** Number of frames to average over when computing the end-of-pass velocity. */
  endVelocityWindowFrames: number;
  /**
   * Minimum entry speed (km/h) to count a pass as a valid rep. Filters out
   * setup motion, walking, and very slow passes that sneak through stop detection.
   */
  minEntrySpeedKph: number;

  // Camera geometry (strips → metres).
  /** Camera distance from the riding line in metres. */
  cameraDistanceMeters: number;
  /** Estimated horizontal field of view in degrees. 108° = iPhone ultra-wide (0.5×). */
  estimatedHFOVDegrees: number;
  /**
   * Directly calibrated frame width (metres) at the riding line — takes priority
   * over cameraDistanceMeters/estimatedHFOVDegrees when set. Derived by measuring
   * a real object of known size in the actual footage (e.g. the bike's wheelbase
   * of 1170mm): frameWidthMeters = 1.170 × (source_frame_width_px / wheelbase_px).
   * Eliminates compounded errors from imprecise camera distance and lens FOV guesses.
   */
  frameWidthMetersOverride?: number;
  /**
   * Centroid fraction threshold for flagging a stop as off-screen. Only set to
   * true when the centroid is at ≥99% of frame width — meaning the bike physically
   * exited the frame. Distinct from farEdgeExitFraction (used for pass classification)
   * which is intentionally lower to trigger the end-velocity check.
   */
  offScreenFraction: number;
};

export const DEFAULT_STRAIGHT_LINE_CONFIG: StraightLineConfig = {
  numStrips: 40,
  sampleHeight: 20,
  bandCenterRatio: 0.5,
  bandRatio: 0.18,
  pixelDeltaThreshold: 16,
  minStripActivityRatio: 0.08,
  baselineWindowSeconds: 12,
  modeBinCount: 32,
  minActiveStrips: 2,
  passGapMs: 300,
  minPassDurationMs: 400,
  velocitySmoothingFrames: 5,
  spikeVelocityThreshold: 0.05,
  minApproachFrames: 8,
  assumedDecelerationMps2: 8.0,
  farEdgeExitFraction: 0.90,
  endVelocityThresholdStripsPerMs: 0.004,
  endVelocityWindowFrames: 10,
  minEntrySpeedKph: 10,
  cameraDistanceMeters: 15,
  estimatedHFOVDegrees: 108,
  offScreenFraction: 0.99,
};

// ─── Public output types ──────────────────────────────────────────────────────

export type StraightLineMeasurement = {
  repNumber: number;
  /** Speed at the braking marker (km/h). Null if velocity profile was too short to analyse. */
  entrySpeedKph: number | null;
  /** Distance from braking marker to full stop (metres). Null if onset could not be found. */
  stoppingDistanceMeters: number | null;
  /** Time from braking marker to full stop (ms). */
  brakingDurationMs: number | null;
  /** Video timestamp (ms) at the detected deceleration onset — the braking marker moment. */
  timestampInVideo: number;
  /**
   * How entry speed was computed. 'direct' = linear regression on clean pre-deceleration
   * approach frames (accurate). 'kinematic' = fallback v₀=√(2aD) using assumed deceleration
   * (less accurate; improves automatically once camera captures more approach).
   */
  speedMethod: 'direct' | 'kinematic';
  /** Number of clean approach frames available for speed measurement after the entry spike. */
  approachFramesUsable: number;
  /**
   * True when the bike stopped at or past the far edge of the frame and the
   * centroid at rest is the last visible position rather than the true stop point.
   * stoppingDistanceMeters is a lower bound in this case (display as "> X m").
   */
  stopOffScreen: boolean;
  /**
   * Effective deceleration expressed as a g-factor: v₀² / (2 × D × 9.81).
   * Normalises stopping distance by entry speed so reps with different approach
   * speeds can be compared fairly. Higher = harder braking. Null if either
   * entry speed or stopping distance could not be measured.
   */
  brakingScoreG: number | null;
};

export type PassDiagnostic = {
  startTimeMs: number;
  endTimeMs: number;
  direction: 'left-to-right' | 'right-to-left' | null;
  outcome: 'braking-run' | 'loop-back' | 'too-short' | 'unclear';
  /** Strip position of the inferred braking marker for this rep. */
  decelerationOnsetStrip: number | null;
  entrySpeedKph: number | null;
  stoppingDistanceMeters: number | null;
  /** Number of frames in this pass that had a valid centroid. */
  centroidFrameCount: number;
  /** Centroid at the start and end of the pass (for diagnosing stop classification). */
  firstCentroid: number | null;
  lastCentroid: number | null;
  /** Approach slope (strips/ms) when direct speed measurement was used; null for kinematic. */
  approachSlopeStripsPerMs: number | null;
  /** How speed was computed for this pass. */
  speedMethod: 'direct' | 'kinematic' | null;
  /** Clean approach frames available after the entry spike ended. */
  approachFramesUsable: number;
};

export type StraightLineDiagnostics = {
  frameCount: number;
  clipDurationSeconds: number;
  /** Estimated real-world width of the frame at the riding line. */
  frameWidthMeters: number;
  /** Metres per strip (= frameWidthMeters / numStrips). */
  metersPerStrip: number;
  /**
   * Running average of braking-marker strip positions across all detected reps.
   * Converges to the actual cone position once 2+ reps are detected — useful for
   * verifying that the inferred marker is consistent across reps.
   */
  calibratedBrakeMarkerStrip: number | null;
  passes: PassDiagnostic[];
};

export type StraightLineResult = {
  reps: StraightLineMeasurement[];
  diagnostics: StraightLineDiagnostics;
};

// ─── Internal types ───────────────────────────────────────────────────────────

type FrameDatum = {
  timeMs: number;
  centroid: number | null;
  activeStripCount: number;
};

type Pass = {
  startMs: number;
  endMs: number;
  durationMs: number;
  frameData: FrameDatum[];
};

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Converts a StraightLineConfig into the DetectionConfig shape expected by
 * FrameExtractors (e.g. extractFramesWithFfmpeg). The key difference from other
 * drills: zoneWidthRatio = 1.0 captures the full frame width so the whole lane
 * is visible, and sampleWidth = numStrips spreads samples horizontally rather
 * than packing them into a narrow crossing zone.
 */
export function toFrameExtractionConfig(config: StraightLineConfig): DetectionConfig {
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

/**
 * Analyses a sequence of captured frames from a straight-line braking drill
 * session and returns per-rep entry speed and stopping distance.
 *
 * The caller is responsible for frame extraction — use toFrameExtractionConfig()
 * to get the right DetectionConfig to pass to extractFramesWithFfmpeg (or any
 * FrameExtractor). The returned frames feed directly into this function.
 *
 * Classification logic:
 * - A "braking run" is a pass that ends with the centroid stopping short of the
 *   far edge of the frame (the bike stopped in view).
 * - A "loop-back" is a pass where the centroid sweeps all the way to the far
 *   edge (the bike exited the frame). Once the braking direction is established
 *   from the first confirmed braking run, passes in the opposite direction are
 *   immediately classified as loop-backs without needing stop detection.
 */
export function detectBrakingReps(frames: CapturedFrame[], config: StraightLineConfig): StraightLineResult {
  const { numStrips } = config;
  const frameWidthMeters =
    config.frameWidthMetersOverride ??
    2 * config.cameraDistanceMeters * Math.tan((config.estimatedHFOVDegrees / 2) * (Math.PI / 180));
  const metersPerStrip = frameWidthMeters / numStrips;

  const emptyResult: StraightLineResult = {
    reps: [],
    diagnostics: {
      frameCount: frames.length,
      clipDurationSeconds: 0,
      frameWidthMeters,
      metersPerStrip,
      calibratedBrakeMarkerStrip: null,
      passes: [],
    },
  };
  if (frames.length < 4) return emptyResult;

  const pixelCount = numStrips * config.sampleHeight;
  const { baselines, windowOf } = computeBaselines(frames, pixelCount, config);
  const frameData = computeFrameData(frames, baselines, windowOf, config);
  const passes = findPasses(frameData, config);

  const reps: StraightLineMeasurement[] = [];
  const passDiagnostics: PassDiagnostic[] = [];
  const brakeMarkerSamples: number[] = [];
  let brakingDirection: 'left-to-right' | 'right-to-left' | null = null;
  let repNumber = 1;

  for (const pass of passes) {
    const firstCentroid = pass.frameData[0].centroid;
    const lastCentroid = pass.frameData[pass.frameData.length - 1].centroid;

    const nullDiag = {
      decelerationOnsetStrip: null, entrySpeedKph: null, stoppingDistanceMeters: null,
      centroidFrameCount: pass.frameData.length, firstCentroid, lastCentroid,
      approachSlopeStripsPerMs: null, speedMethod: null as null, approachFramesUsable: 0,
    };

    if (pass.durationMs < config.minPassDurationMs) {
      passDiagnostics.push({
        startTimeMs: pass.startMs, endTimeMs: pass.endMs, direction: null, outcome: 'too-short',
        ...nullDiag,
      });
      continue;
    }

    const dir = passDirection(pass, config);
    if (!dir) {
      passDiagnostics.push({
        startTimeMs: pass.startMs, endTimeMs: pass.endMs, direction: null, outcome: 'unclear',
        ...nullDiag,
      });
      continue;
    }

    // Stop detection: did the bike come to a stop inside the frame?
    // passEndsWithStop checks the far-edge exit fraction first; if the centroid
    // landed near the edge it additionally checks end-of-pass velocity — a
    // decelerating-to-a-stop bike has near-zero velocity at the edge, while a
    // loop-back exits at speed. This handles the case where the rider stops at
    // the very edge of frame (common when braking from the far side).
    if (!passEndsWithStop(pass, dir, config)) {
      passDiagnostics.push({
        startTimeMs: pass.startMs, endTimeMs: pass.endMs, direction: dir, outcome: 'loop-back',
        ...nullDiag,
      });
      continue;
    }

    if (brakingDirection === null) brakingDirection = dir;

    const currentCalibratedStrip =
      brakeMarkerSamples.length > 0
        ? brakeMarkerSamples.reduce((sum, s) => sum + s, 0) / brakeMarkerSamples.length
        : null;
    const metrics = analyseBrakingRun(pass, dir, config, metersPerStrip, currentCalibratedStrip);

    // Minimum speed filter: discard setup/walking passes.
    if (metrics.entrySpeedKph === null || metrics.entrySpeedKph < config.minEntrySpeedKph) {
      passDiagnostics.push({
        startTimeMs: pass.startMs, endTimeMs: pass.endMs, direction: dir, outcome: 'too-short',
        decelerationOnsetStrip: metrics.brakeStrip, entrySpeedKph: metrics.entrySpeedKph,
        stoppingDistanceMeters: metrics.stoppingDistanceMeters,
        centroidFrameCount: pass.frameData.length, firstCentroid, lastCentroid,
        approachSlopeStripsPerMs: metrics.approachSlopeStripsPerMs,
        speedMethod: metrics.speedMethod,
        approachFramesUsable: metrics.approachFramesUsable,
      });
      continue;
    }

    if (metrics.brakeStrip !== null) {
      brakeMarkerSamples.push(metrics.brakeStrip);
      if (brakeMarkerSamples.length > 5) brakeMarkerSamples.shift();
    }

    reps.push({
      repNumber,
      entrySpeedKph: metrics.entrySpeedKph,
      stoppingDistanceMeters: metrics.stoppingDistanceMeters,
      brakingDurationMs: metrics.brakingDurationMs,
      timestampInVideo: metrics.timestampInVideo,
      speedMethod: metrics.speedMethod,
      approachFramesUsable: metrics.approachFramesUsable,
      stopOffScreen: metrics.stopOffScreen,
      brakingScoreG: metrics.brakingScoreG,
    });

    passDiagnostics.push({
      startTimeMs: pass.startMs, endTimeMs: pass.endMs, direction: dir, outcome: 'braking-run',
      decelerationOnsetStrip: metrics.brakeStrip, entrySpeedKph: metrics.entrySpeedKph,
      stoppingDistanceMeters: metrics.stoppingDistanceMeters,
      centroidFrameCount: pass.frameData.length, firstCentroid, lastCentroid,
      approachSlopeStripsPerMs: metrics.approachSlopeStripsPerMs,
      speedMethod: metrics.speedMethod,
      approachFramesUsable: metrics.approachFramesUsable,
    });

    repNumber++;
  }

  const calibratedBrakeMarkerStrip =
    brakeMarkerSamples.length > 0
      ? brakeMarkerSamples.reduce((sum, s) => sum + s, 0) / brakeMarkerSamples.length
      : null;

  return {
    reps,
    diagnostics: {
      frameCount: frames.length,
      clipDurationSeconds:
        frames.length > 1 ? (frames[frames.length - 1].time - frames[0].time) / 1000 : 0,
      frameWidthMeters,
      metersPerStrip,
      calibratedBrakeMarkerStrip,
      passes: passDiagnostics,
    },
  };
}

// ─── Frame analysis ───────────────────────────────────────────────────────────

function computeBaselines(
  frames: CapturedFrame[],
  pixelCount: number,
  config: StraightLineConfig,
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
  config: StraightLineConfig,
): FrameDatum[] {
  const { numStrips, sampleHeight, pixelDeltaThreshold, minActiveStrips } = config;
  const centroidBandRows = 4; // half-width of the narrow y-band used for x-centroid

  return frames.map(({ time, grid }) => {
    const baseline = baselines[windowOf(time)];

    // Pass 1: find the luminance-delta y-centroid — where is the bike vertically?
    let yWeightSum = 0;
    let yPosSum = 0;
    for (let y = 0; y < sampleHeight; y++) {
      let rowDelta = 0;
      for (let x = 0; x < numStrips; x++) {
        const d = Math.abs(grid[y * numStrips + x] - baseline[y * numStrips + x]);
        if (d >= pixelDeltaThreshold) rowDelta += d;
      }
      yPosSum += y * rowDelta;
      yWeightSum += rowDelta;
    }

    if (yWeightSum === 0) return { timeMs: time, centroid: null, activeStripCount: 0 };

    const yCentroid = yPosSum / yWeightSum;
    const yLow = Math.max(0, Math.round(yCentroid) - centroidBandRows);
    const yHigh = Math.min(sampleHeight - 1, Math.round(yCentroid) + centroidBandRows);

    // Pass 2: x-centroid within the narrow y-band, weighted by delta magnitude.
    // Continuous magnitude (not binary activity fraction) gives a sharper peak at
    // the brightest horizontal feature on the bike rather than the whole silhouette.
    let weightSum = 0;
    let posSum = 0;
    let activeCount = 0;

    for (let x = 0; x < numStrips; x++) {
      let delta = 0;
      for (let y = yLow; y <= yHigh; y++) {
        const d = Math.abs(grid[y * numStrips + x] - baseline[y * numStrips + x]);
        if (d >= pixelDeltaThreshold) delta += d;
      }
      if (delta > 0) {
        weightSum += delta;
        posSum += x * delta;
        activeCount++;
      }
    }

    return {
      timeMs: time,
      centroid: activeCount >= minActiveStrips && weightSum > 0 ? posSum / weightSum : null,
      activeStripCount: activeCount,
    };
  });
}

// ─── Pass detection ───────────────────────────────────────────────────────────

function findPasses(frameData: FrameDatum[], config: StraightLineConfig): Pass[] {
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

function passDirection(
  pass: Pass,
  config: StraightLineConfig,
): 'left-to-right' | 'right-to-left' | null {
  const centroids = pass.frameData.map((d) => d.centroid!);
  const smoothed = movingAverage(centroids, config.velocitySmoothingFrames);
  const delta = smoothed[smoothed.length - 1] - smoothed[0];
  // Require at least 3 strips of net displacement to have a clear direction.
  if (Math.abs(delta) < 3) return null;
  return delta > 0 ? 'left-to-right' : 'right-to-left';
}

/**
 * Returns true if the pass ends with the bike stopped in frame rather than
 * exiting (which indicates a loop-back).
 *
 * Two-stage check:
 * 1. If the last centroid is clearly short of the far edge → stopped, return true.
 * 2. If it IS near the far edge, measure end-of-pass centroid velocity. A bike
 *    decelerating to a stop at the edge has near-zero velocity; a loop-back
 *    exits at speed. This handles the common case where the stop position is
 *    right at the edge of frame due to camera placement.
 */
function passEndsWithStop(
  pass: Pass,
  direction: 'left-to-right' | 'right-to-left',
  config: StraightLineConfig,
): boolean {
  const centroids = pass.frameData.map((d) => d.centroid!);
  const times = pass.frameData.map((d) => d.timeMs);
  const last = centroids[centroids.length - 1];
  const { numStrips, farEdgeExitFraction } = config;
  const nearFarEdge =
    direction === 'left-to-right'
      ? last >= numStrips * farEdgeExitFraction
      : last <= numStrips * (1 - farEdgeExitFraction);

  if (!nearFarEdge) return true;

  // Near the far edge — check whether the bike was still moving fast (exit)
  // or had decelerated to near-zero (stop at edge).
  const endIdx = centroids.length - 1;
  const startIdx = Math.max(0, endIdx - config.endVelocityWindowFrames);
  if (endIdx <= startIdx) return false;
  const dt = Math.max(1, times[endIdx] - times[startIdx]);
  const endVelocity = Math.abs(centroids[endIdx] - centroids[startIdx]) / dt;
  return endVelocity < config.endVelocityThresholdStripsPerMs;
}

// ─── Braking-run analysis ─────────────────────────────────────────────────────

type BrakingMetrics = {
  entrySpeedKph: number | null;
  stoppingDistanceMeters: number | null;
  brakingDurationMs: number | null;
  timestampInVideo: number;
  brakeStrip: number | null;
  approachSlopeStripsPerMs: number | null;
  speedMethod: 'direct' | 'kinematic';
  approachFramesUsable: number;
  stopOffScreen: boolean;
  brakingScoreG: number | null;
};

function analyseBrakingRun(
  pass: Pass,
  direction: 'left-to-right' | 'right-to-left',
  config: StraightLineConfig,
  metersPerStrip: number,
  calibratedBrakeStrip: number | null,
): BrakingMetrics {
  const centroids = pass.frameData.map((d) => d.centroid!);
  const times = pass.frameData.map((d) => d.timeMs);
  const fallback: BrakingMetrics = {
    entrySpeedKph: null,
    stoppingDistanceMeters: null,
    brakingDurationMs: null,
    timestampInVideo: pass.startMs,
    brakeStrip: null,
    approachSlopeStripsPerMs: null,
    speedMethod: 'kinematic',
    approachFramesUsable: 0,
    stopOffScreen: false,
    brakingScoreG: null,
  };

  if (centroids.length < 4) return fallback;

  // Resolve brake strip for this rep.
  const brakeStrip =
    calibratedBrakeStrip ?? (centroids[0] + centroids[centroids.length - 1]) / 2;

  // Smooth centroids once — reused for both brakeFrameIdx and findStopFrame.
  const smoothed = movingAverage(centroids, config.velocitySmoothingFrames);

  // Braking start time: first frame where smoothed centroid crosses the brake strip.
  const brakeFrameIdx = smoothed.findIndex(
    (c) => (direction === 'left-to-right' ? c >= brakeStrip : c <= brakeStrip),
  );
  const brakeTimeMs = brakeFrameIdx >= 0 ? times[brakeFrameIdx] : times[0];

  // Stop position: minimum-velocity frame after the braking onset. Finds the true
  // stop even when the rider continues forward after stopping — the velocity dips
  // to near-zero at the stop then rises again during re-acceleration, so the
  // global minimum of |v| after the onset is the stop frame.
  const stopFrameIdx = findStopFrame(smoothed, times, Math.max(0, brakeFrameIdx));
  const stopStrip = smoothed[stopFrameIdx];
  const stoppingDistanceMeters = Math.abs(stopStrip - brakeStrip) * metersPerStrip;

  // ── Approach phase extraction ──────────────────────────────────────────────
  //
  // The entry spike: when the bike first enters the frame from the edge, only
  // part of it is visible, so the centroid (weighted center of all active strips)
  // jumps rapidly — much faster than actual bike motion. We detect the spike end
  // as the first run of STABLE_WINDOW consecutive frames where the per-frame
  // centroid velocity drops below spikeVelocityThreshold.
  //
  // After the spike, if the centroid is still before the brake strip, those frames
  // are clean approach data. This happens when the brake marker is far enough into
  // the frame (≥ ~50%) that the spike ends before the centroid crosses it.

  const STABLE_WINDOW = 3;
  let spikeEndIdx = 0;
  outer: for (let i = 1; i + STABLE_WINDOW <= centroids.length; i++) {
    for (let j = 0; j < STABLE_WINDOW; j++) {
      const dt = Math.max(1, times[i + j] - times[i + j - 1]);
      if (Math.abs(centroids[i + j] - centroids[i + j - 1]) / dt >= config.spikeVelocityThreshold) {
        continue outer;
      }
    }
    spikeEndIdx = i;
    break;
  }

  const isBeforeBrake = (c: number) =>
    direction === 'left-to-right' ? c < brakeStrip : c > brakeStrip;

  const approachIdxs: number[] = [];
  for (let i = spikeEndIdx; i < centroids.length; i++) {
    if (isBeforeBrake(centroids[i])) approachIdxs.push(i);
    else break;
  }

  // ── Speed measurement ──────────────────────────────────────────────────────
  //
  // Direct: linear regression on clean approach frames → slope in strips/ms.
  // Requires minApproachFrames; with the current camera setup (brake marker at
  // ~31% of frame) the spike covers all approach frames so this falls back to
  // kinematic. Once the camera is repositioned to center the brake cone (~50%),
  // post-spike approach frames appear and direct measurement activates.
  //
  // Kinematic fallback: v₀ = √(2·a·D) — consistent for relative comparison
  // even when absolute accuracy is limited by the deceleration assumption.

  let entrySpeedKph: number;
  let approachSlopeStripsPerMs: number | null = null;
  let speedMethod: 'direct' | 'kinematic';

  if (approachIdxs.length >= config.minApproachFrames) {
    const appCentroids = approachIdxs.map((i) => centroids[i]);
    const appTimes = approachIdxs.map((i) => times[i]);
    approachSlopeStripsPerMs = Math.abs(linearSlope(appCentroids, appTimes));
    entrySpeedKph = approachSlopeStripsPerMs * 1000 * metersPerStrip * 3.6;
    speedMethod = 'direct';
  } else {
    entrySpeedKph = Math.sqrt(2 * config.assumedDecelerationMps2 * stoppingDistanceMeters) * 3.6;
    speedMethod = 'kinematic';
  }

  const brakingDurationMs = Math.max(0, times[stopFrameIdx] - brakeTimeMs);

  // Flag only when the centroid reached the very edge of frame (≥99%), meaning
  // the bike genuinely exited. Stops at 95–98% are physically inside the frame.
  const stopOffScreen =
    direction === 'left-to-right'
      ? stopStrip >= config.numStrips * config.offScreenFraction
      : stopStrip <= config.numStrips * (1 - config.offScreenFraction);

  const v0Mps = (entrySpeedKph ?? 0) / 3.6;
  const brakingScoreG =
    entrySpeedKph !== null && stoppingDistanceMeters > 0
      ? (v0Mps * v0Mps) / (2 * stoppingDistanceMeters * 9.81)
      : null;

  return {
    entrySpeedKph,
    stoppingDistanceMeters,
    brakingDurationMs,
    timestampInVideo: brakeTimeMs,
    brakeStrip,
    approachSlopeStripsPerMs,
    speedMethod,
    approachFramesUsable: approachIdxs.length,
    stopOffScreen,
    brakingScoreG,
  };
}

// ─── Signal utilities ─────────────────────────────────────────────────────────

function findStopFrame(smoothed: number[], times: number[], onsetIdx: number): number {
  let minAbsVel = Infinity;
  let stopIdx = smoothed.length - 1;
  for (let i = onsetIdx + 1; i < smoothed.length - 1; i++) {
    const dt = Math.max(1, times[i + 1] - times[i - 1]);
    const vel = Math.abs((smoothed[i + 1] - smoothed[i - 1]) / dt);
    if (vel < minAbsVel) {
      minAbsVel = vel;
      stopIdx = i;
    }
  }
  return stopIdx;
}

function movingAverage(values: number[], window: number): number[] {
  if (window <= 1 || values.length === 0) return [...values];
  const half = Math.floor(window / 2);
  return values.map((_, i) => {
    const lo = Math.max(0, i - half);
    const hi = Math.min(values.length - 1, i + half);
    let sum = 0;
    for (let j = lo; j <= hi; j++) sum += values[j];
    return sum / (hi - lo + 1);
  });
}

/** Ordinary-least-squares slope of values vs times (units: values-unit / time-unit).
 *  Centers times to avoid catastrophic cancellation when timestamps are large (e.g. ms since epoch).
 */
function linearSlope(values: number[], times: number[]): number {
  const n = values.length;
  if (n < 2) return 0;
  const meanT = times.reduce((s, t) => s + t, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) {
    const dt = times[i] - meanT;
    num += dt * values[i];
    den += dt * dt;
  }
  if (Math.abs(den) < 1e-12) return 0;
  return num / den;
}
