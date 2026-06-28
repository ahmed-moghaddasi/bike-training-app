import { downsampleLuminance, downsampleMarkerMatch } from './frameSampling';
import { computeCropRectRatio } from './detection/geometry';
import type { CrossingOrientation, DetectionConfig } from './detection/types';
import type { DetectionEvent, Lap } from '../types';

export type LapDetectionConfig = {
  detection: DetectionConfig;
  detectionsPerLap: number;
  /** ISO timestamp the recording began — used to give detection events a real wall-clock time. */
  recordingStartedAt: string;
};

export type LapDetectionResult = {
  laps: Lap[];
  detectionEvents: DetectionEvent[];
  diagnostics: LapDetectionDiagnostics;
};

export type CandidateOutcome =
  | 'confirmed'
  | 'sequence-timeout'
  | 'decay-failed'
  | 'suppressed-by-cooldown'
  | 'duplicate-direction'
  | 'blob-too-small';

/**
 * 'primary'/'secondary' map to the two halves of whichever axis the drill's
 * orientation splits: vertical -> left/right, horizontal -> top/bottom.
 */
export type CandidateLog = {
  /** Seconds into the clip where the candidate half first activated. */
  startTimeSeconds: number;
  half: 'primary' | 'secondary' | 'both';
  outcome: CandidateOutcome;
  /** Seconds into the clip where the opposite half confirmed, if it did. */
  confirmedAtSeconds?: number;
};

export type LapDetectionDiagnostics = {
  frameCount: number;
  clipDurationSeconds: number;
  orientation: CrossingOrientation;
  /** The strongest changed-pixel ratio seen anywhere in the clip on each half — compare against changedRatioThreshold. */
  maxPrimaryRatio: number;
  maxSecondaryRatio: number;
  config: DetectionConfig;
  /** Every candidate sequence the detector noticed, and why it was kept or dropped. */
  candidates: CandidateLog[];
  /** Full per-frame signal, downsampled to at most ~500 points so the export stays small. */
  series: Array<{ timeSeconds: number; primaryRatio: number; secondaryRatio: number; primaryBlobArea: number; secondaryBlobArea: number }>;
};

type CapturedFrame = { time: number; grid: Float32Array; markerMatch?: Uint8Array };
type RatioSample = { time: number; primaryRatio: number; secondaryRatio: number; primaryBlobArea: number; secondaryBlobArea: number };
type Crossing = { time: number; direction: 'primary-to-secondary' | 'secondary-to-primary'; score: number };

type VideoWithFrameCallback = HTMLVideoElement & {
  requestVideoFrameCallback?: (callback: (now: number, metadata: { mediaTime: number }) => void) => number;
};

/**
 * Runs lap detection over an already-recorded clip instead of live, frame-by-frame
 * during the ride. One full decode pass captures every frame's luminance grid; the
 * rest of the analysis (baseline, ratios, crossing detection) runs on that in-memory
 * data, which is what lets this look both forward and backward in time per candidate
 * event — something a live, causal detector structurally cannot do.
 *
 * Detection parameters (thresholds, crossing orientation) come from the per-drill
 * config in src/lib/detection — see getDetectionConfigForDrill.
 */
export async function detectLapsFromVideo(videoUri: string, config: LapDetectionConfig): Promise<LapDetectionResult> {
  const { detection } = config;
  const emptyDiagnostics: LapDetectionDiagnostics = {
    frameCount: 0,
    clipDurationSeconds: 0,
    orientation: detection.orientation,
    maxPrimaryRatio: 0,
    maxSecondaryRatio: 0,
    config: detection,
    candidates: [],
    series: [],
  };

  const frames = await extractFrames(videoUri, detection);
  if (frames.length === 0) return { laps: [], detectionEvents: [], diagnostics: emptyDiagnostics };

  const pixelCount = detection.sampleWidth * detection.sampleHeight;
  const { baselines, windowOf } = await computeWindowedBaselines(frames, pixelCount, detection);
  const series = await computeChangedRatioSeries(frames, baselines, windowOf, detection);
  const { crossings, candidates } = detectCrossings(series, detection);
  const result = reduceCrossingsToLaps(crossings, Math.max(1, config.detectionsPerLap), config.recordingStartedAt);
  result.laps = markWarmupAndCooldownLaps(result.laps);

  const diagnostics: LapDetectionDiagnostics = {
    frameCount: frames.length,
    clipDurationSeconds: series.length ? series[series.length - 1].time / 1000 : 0,
    orientation: detection.orientation,
    maxPrimaryRatio: series.reduce((max, sample) => Math.max(max, sample.primaryRatio), 0),
    maxSecondaryRatio: series.reduce((max, sample) => Math.max(max, sample.secondaryRatio), 0),
    config: detection,
    candidates: candidates.map((candidate) => ({
      startTimeSeconds: candidate.startTime / 1000,
      half: candidate.half,
      outcome: candidate.outcome,
      confirmedAtSeconds: candidate.confirmedAt !== undefined ? candidate.confirmedAt / 1000 : undefined,
    })),
    series: downsampleSeriesForExport(series).map((sample) => ({
      timeSeconds: sample.time / 1000,
      primaryRatio: sample.primaryRatio,
      secondaryRatio: sample.secondaryRatio,
      primaryBlobArea: sample.primaryBlobArea,
      secondaryBlobArea: sample.secondaryBlobArea,
    })),
  };

  return { ...result, diagnostics };
}

/** Keeps the exported debug file readable/small even for an 8-minute clip. */
function downsampleSeriesForExport(series: RatioSample[], maxPoints = 500): RatioSample[] {
  if (series.length <= maxPoints) return series;
  const step = series.length / maxPoints;
  const sampled: RatioSample[] = [];
  for (let i = 0; i < maxPoints; i += 1) {
    sampled.push(series[Math.floor(i * step)]);
  }
  return sampled;
}

function extractFrames(videoUri: string, detection: DetectionConfig): Promise<CapturedFrame[]> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video') as VideoWithFrameCallback;
    video.src = videoUri;
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';

    const canvas = document.createElement('canvas');
    const frames: CapturedFrame[] = [];
    let settled = false;

    function captureFrame(mediaTime: number) {
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context || !video.videoWidth || !video.videoHeight) return;

      canvas.width = detection.sampleWidth;
      canvas.height = detection.sampleHeight;

      const ratio = computeCropRectRatio(detection);
      const sourceWidth = Math.max(64, Math.floor(video.videoWidth * ratio.width));
      const sourceHeight = Math.max(64, Math.floor(video.videoHeight * ratio.height));
      const sourceX = Math.max(0, Math.floor(video.videoWidth * ratio.left));
      const sourceY = Math.max(0, Math.floor(video.videoHeight * ratio.top));
      context.drawImage(video, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, detection.sampleWidth, detection.sampleHeight);

      const imageData = context.getImageData(0, 0, detection.sampleWidth, detection.sampleHeight);
      const markerMatch = detection.markerColor
        ? downsampleMarkerMatch(imageData, detection.sampleWidth, detection.sampleHeight, detection.markerColor)
        : undefined;
      // Stored in ms (video time * 1000) so they compare directly against the *Ms thresholds below.
      frames.push({
        time: mediaTime * 1000,
        grid: downsampleLuminance(imageData, detection.sampleWidth, detection.sampleHeight),
        markerMatch,
      });
    }

    function finish() {
      if (settled) return;
      settled = true;
      video.pause();
      video.removeAttribute('src');
      video.load();
      resolve(frames);
    }

    function fail(error: unknown) {
      if (settled) return;
      settled = true;
      video.pause();
      video.removeAttribute('src');
      video.load();
      reject(error instanceof Error ? error : new Error('Could not decode the recorded video.'));
    }

    video.addEventListener('error', () => fail(new Error('Could not decode the recorded video.')));
    video.addEventListener('ended', finish);

    video.addEventListener('loadedmetadata', () => {
      video.playbackRate = detection.playbackRate;

      if (typeof video.requestVideoFrameCallback === 'function') {
        const step = (_now: number, metadata: { mediaTime: number }) => {
          captureFrame(metadata.mediaTime);
          if (!video.ended && !settled) video.requestVideoFrameCallback?.(step);
        };
        video.requestVideoFrameCallback(step);
      } else {
        video.addEventListener('timeupdate', () => captureFrame(video.currentTime));
      }

      video.play().catch(fail);
    });
  });
}

/** Lets a long session's frame-by-frame analysis yield to the main thread instead of blocking it in one long synchronous pass. */
const YIELD_EVERY_N_FRAMES = 50;
function yieldToMainThread(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/** Per-pixel mode luminance across the whole clip — robust to the rider already being in frame at t=0. */
/** Per-pixel mode luminance over a set of frame grids. */
async function computeModeBaseline(grids: Float32Array[], pixelCount: number, modeBinCount: number): Promise<Float32Array> {
  const binWidth = 256 / modeBinCount;
  const histogram = new Uint32Array(pixelCount * modeBinCount);
  for (let g = 0; g < grids.length; g += 1) {
    const grid = grids[g];
    for (let index = 0; index < pixelCount; index += 1) {
      const bin = Math.min(modeBinCount - 1, Math.floor(grid[index] / binWidth));
      histogram[index * modeBinCount + bin] += 1;
    }
    if (g % YIELD_EVERY_N_FRAMES === 0) await yieldToMainThread();
  }

  const baseline = new Float32Array(pixelCount);
  for (let index = 0; index < pixelCount; index += 1) {
    let bestBin = 0;
    let bestCount = -1;
    for (let bin = 0; bin < modeBinCount; bin += 1) {
      const count = histogram[index * modeBinCount + bin];
      if (count > bestCount) {
        bestCount = count;
        bestBin = bin;
      }
    }
    baseline[index] = (bestBin + 0.5) * binWidth;
  }
  return baseline;
}

/**
 * Splits frames into fixed-length time windows and computes a fresh mode
 * baseline per window, instead of one baseline for the whole clip. A single
 * clip-wide baseline can't track real lighting drift over a multi-minute
 * session; incrementally blending one baseline forward has a deadlock (a
 * pixel only updates while it's currently "unchanged," so a pixel that
 * started off far enough from baseline can never recover). Recomputing
 * fresh per window — entirely from real nearby frames — avoids both.
 */
async function computeWindowedBaselines(
  frames: CapturedFrame[],
  pixelCount: number,
  detection: DetectionConfig,
): Promise<{ baselines: Float32Array[]; windowOf: (timeMs: number) => number }> {
  const windowMs = Math.max(1, detection.baselineWindowSeconds * 1000);
  const startTime = frames[0].time;
  const endTime = frames[frames.length - 1].time;
  const windowCount = Math.max(1, Math.ceil((endTime - startTime + 1) / windowMs));

  const windowOf = (timeMs: number) => Math.min(windowCount - 1, Math.max(0, Math.floor((timeMs - startTime) / windowMs)));

  const gridsPerWindow: Float32Array[][] = Array.from({ length: windowCount }, () => []);
  for (const frame of frames) {
    gridsPerWindow[windowOf(frame.time)].push(frame.grid);
  }

  const baselines: Float32Array[] = [];
  for (const grids of gridsPerWindow) {
    baselines.push(grids.length ? await computeModeBaseline(grids, pixelCount, detection.modeBinCount) : new Float32Array(pixelCount));
  }

  return { baselines, windowOf };
}

/**
 * Size (pixel count) of the largest 4-connected region of `mask` — used to
 * tell "one coherent bike-sized blob changed" from "scattered noise pixels
 * that happen to add up to the same total count." `mask`/`visited` are
 * reused across frames by the caller to avoid reallocating per frame.
 */
function largestBlobArea(mask: Uint8Array, visited: Uint8Array, width: number, height: number): number {
  visited.fill(0);
  let largest = 0;
  const stack: number[] = [];
  for (let start = 0; start < mask.length; start += 1) {
    if (!mask[start] || visited[start]) continue;
    stack.push(start);
    visited[start] = 1;
    let size = 0;
    while (stack.length) {
      const index = stack.pop()!;
      size += 1;
      const x = index % width;
      const y = (index - x) / width;
      if (x > 0 && mask[index - 1] && !visited[index - 1]) {
        visited[index - 1] = 1;
        stack.push(index - 1);
      }
      if (x < width - 1 && mask[index + 1] && !visited[index + 1]) {
        visited[index + 1] = 1;
        stack.push(index + 1);
      }
      if (y > 0 && mask[index - width] && !visited[index - width]) {
        visited[index - width] = 1;
        stack.push(index - width);
      }
      if (y < height - 1 && mask[index + width] && !visited[index + width]) {
        visited[index + width] = 1;
        stack.push(index + width);
      }
    }
    if (size > largest) largest = size;
  }
  return largest;
}

/** Diffs each frame against its own time window's baseline. Splits the grid into primary/secondary halves along the configured orientation's axis. */
async function computeChangedRatioSeries(
  frames: CapturedFrame[],
  baselines: Float32Array[],
  windowOf: (timeMs: number) => number,
  detection: DetectionConfig,
): Promise<RatioSample[]> {
  const { sampleWidth, sampleHeight, pixelDeltaThreshold, orientation } = detection;
  const halfWidth = Math.floor(sampleWidth / 2);
  const halfHeight = Math.floor(sampleHeight / 2);
  const pixelCount = sampleWidth * sampleHeight;
  const primaryMask = new Uint8Array(pixelCount);
  const secondaryMask = new Uint8Array(pixelCount);
  const visited = new Uint8Array(pixelCount);

  const results: RatioSample[] = [];
  for (let frameIndex = 0; frameIndex < frames.length; frameIndex += 1) {
    const { time, grid, markerMatch } = frames[frameIndex];
    const baseline = baselines[windowOf(time)];
    let primaryChanged = 0;
    let secondaryChanged = 0;
    let primaryPixels = 0;
    let secondaryPixels = 0;
    primaryMask.fill(0);
    secondaryMask.fill(0);
    for (let index = 0; index < grid.length; index += 1) {
      // OR, not replace: the marker (when configured) cleans up false positives
      // when visible, while luminance still catches a pass if the marker gets
      // briefly blocked by the rider's body — neither signal alone has to be perfect.
      const lumaChanged = Math.abs(grid[index] - baseline[index]) >= pixelDeltaThreshold;
      const changed = lumaChanged || (markerMatch ? markerMatch[index] === 1 : false);
      const isPrimary =
        orientation === 'vertical' ? index % sampleWidth < halfWidth : Math.floor(index / sampleWidth) < halfHeight;
      if (isPrimary) {
        primaryPixels += 1;
        if (changed) {
          primaryChanged += 1;
          primaryMask[index] = 1;
        }
      } else {
        secondaryPixels += 1;
        if (changed) {
          secondaryChanged += 1;
          secondaryMask[index] = 1;
        }
      }
    }
    results.push({
      time,
      primaryRatio: primaryPixels ? primaryChanged / primaryPixels : 0,
      secondaryRatio: secondaryPixels ? secondaryChanged / secondaryPixels : 0,
      primaryBlobArea: largestBlobArea(primaryMask, visited, sampleWidth, sampleHeight),
      secondaryBlobArea: largestBlobArea(secondaryMask, visited, sampleWidth, sampleHeight),
    });
    if (frameIndex % YIELD_EVERY_N_FRAMES === 0) await yieldToMainThread();
  }
  return results;
}

type RawCandidate = {
  half: 'primary' | 'secondary' | 'both';
  startTime: number;
  outcome: CandidateOutcome;
  confirmedAt?: number;
};

/** Asymmetric crossing sequence (one half activates, then the other), same idea as the old live detector, evaluated over the whole series. */
function detectCrossings(series: RatioSample[], detection: DetectionConfig): { crossings: Crossing[]; candidates: RawCandidate[] } {
  const {
    changedRatioThreshold,
    minActiveMs,
    cooldownMs,
    sequenceTimeoutMs,
    decayWindowMs,
    duplicateDirectionWindowMs,
    minBlobAreaPixels,
    minBlobAreaFraction,
    blobCalibrationWindowSize,
    blobCalibrationBootstrapCount,
  } = detection;
  const crossings: Crossing[] = [];
  const candidates: RawCandidate[] = [];
  let primaryActiveSince: number | null = null;
  let secondaryActiveSince: number | null = null;
  let pendingHalf: 'primary' | 'secondary' | null = null;
  let pendingSince = 0;
  let lastCrossingAt = Number.NEGATIVE_INFINITY;
  let lastConfirmedDirection: Crossing['direction'] | null = null;
  let cooldownActivityStart: number | null = null;
  let cooldownActivityHalf: 'primary' | 'secondary' | 'both' | null = null;
  // Self-calibration: judges a new crossing's blob size against what real
  // crossings looked like earlier in this same clip, not a fixed global
  // number — stays accurate regardless of bike size, camera distance, or
  // speed. See DetectionConfig.minBlobAreaFraction.
  const recentConfirmedBlobAreas: number[] = [];

  function isBlobLargeEnough(peakBlobArea: number): boolean {
    if (peakBlobArea < minBlobAreaPixels) return false;
    if (recentConfirmedBlobAreas.length < blobCalibrationBootstrapCount) return true;
    const sorted = [...recentConfirmedBlobAreas].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    return peakBlobArea >= median * minBlobAreaFraction;
  }

  function recordConfirmedBlobArea(peakBlobArea: number) {
    recentConfirmedBlobAreas.push(peakBlobArea);
    if (recentConfirmedBlobAreas.length > blobCalibrationWindowSize) recentConfirmedBlobAreas.shift();
  }

  function flushCooldownActivity() {
    if (cooldownActivityStart === null) return;
    candidates.push({ half: cooldownActivityHalf ?? 'both', startTime: cooldownActivityStart, outcome: 'suppressed-by-cooldown' });
    cooldownActivityStart = null;
    cooldownActivityHalf = null;
  }

  for (let i = 0; i < series.length; i += 1) {
    const { time, primaryRatio, secondaryRatio } = series[i];
    const primaryActive = primaryRatio >= changedRatioThreshold;
    const secondaryActive = secondaryRatio >= changedRatioThreshold;

    primaryActiveSince = primaryActive ? primaryActiveSince ?? time : null;
    secondaryActiveSince = secondaryActive ? secondaryActiveSince ?? time : null;

    if (pendingHalf && time - pendingSince > sequenceTimeoutMs) {
      candidates.push({ half: pendingHalf, startTime: pendingSince, outcome: 'sequence-timeout' });
      pendingHalf = null;
    }

    if (time - lastCrossingAt < cooldownMs) {
      pendingHalf = null;
      // A real pass attempted before cooldown clears would otherwise vanish with no trace at all.
      if (primaryActive || secondaryActive) {
        if (cooldownActivityStart === null) {
          cooldownActivityStart = time;
          cooldownActivityHalf = primaryActive && secondaryActive ? 'both' : primaryActive ? 'primary' : 'secondary';
        }
      } else {
        flushCooldownActivity();
      }
      continue;
    }
    flushCooldownActivity();

    const primaryConfirmed = primaryActiveSince !== null && time - primaryActiveSince >= minActiveMs;
    const secondaryConfirmed = secondaryActiveSince !== null && time - secondaryActiveSince >= minActiveMs;

    // Whole-zone changes (camera shake, a hand near the lens) cannot begin a sequence.
    if (!pendingHalf && primaryConfirmed !== secondaryConfirmed) {
      pendingHalf = primaryConfirmed ? 'primary' : 'secondary';
      pendingSince = time;
    }

    let direction: Crossing['direction'] | undefined;
    if (pendingHalf === 'primary' && secondaryConfirmed) direction = 'primary-to-secondary';
    if (pendingHalf === 'secondary' && primaryConfirmed) direction = 'secondary-to-primary';

    if (direction && direction === lastConfirmedDirection && time - lastCrossingAt <= duplicateDirectionWindowMs) {
      // A real lap alternates direction every pass — seeing the same direction
      // again this soon means the previous crossing's far side flickered back
      // on (shadow, glare), not that the rider crossed the same way twice in
      // a row. Drop it without disturbing lastCrossingAt/lastConfirmedDirection
      // so the next genuinely alternating crossing is still judged correctly.
      candidates.push({ half: pendingHalf!, startTime: pendingSince, outcome: 'duplicate-direction', confirmedAt: time });
      pendingHalf = null;
      primaryActiveSince = null;
      secondaryActiveSince = null;
    } else if (direction && decaysWithinWindow(series, i, changedRatioThreshold, decayWindowMs)) {
      const peakBlobArea = Math.max(series[i].primaryBlobArea, series[i].secondaryBlobArea);
      if (isBlobLargeEnough(peakBlobArea)) {
        crossings.push({ time, direction, score: Math.max(primaryRatio, secondaryRatio) / changedRatioThreshold });
        candidates.push({ half: pendingHalf!, startTime: pendingSince, outcome: 'confirmed', confirmedAt: time });
        lastCrossingAt = time;
        lastConfirmedDirection = direction;
        recordConfirmedBlobArea(peakBlobArea);
        pendingHalf = null;
        primaryActiveSince = null;
        secondaryActiveSince = null;
      } else {
        // Changed pixels never formed one bike-sized region — likely scattered
        // noise (dust, grass motion) rather than the bike itself.
        candidates.push({ half: pendingHalf!, startTime: pendingSince, outcome: 'blob-too-small', confirmedAt: time });
        pendingHalf = null;
      }
    } else if (direction) {
      // Confirmed sequence but motion never decayed — likely sustained drift, not a real pass.
      candidates.push({ half: pendingHalf!, startTime: pendingSince, outcome: 'decay-failed', confirmedAt: time });
      pendingHalf = null;
    }
  }

  // Clip ended mid-sequence — log it rather than silently dropping the candidate.
  if (pendingHalf) {
    candidates.push({ half: pendingHalf, startTime: pendingSince, outcome: 'sequence-timeout' });
  }
  flushCooldownActivity();

  return { crossings, candidates };
}

/**
 * Non-causal confirmation only possible because future frames are already available:
 * a genuine pass rises then falls back toward baseline; sustained motion (a shadow
 * drifting, someone lingering in frame) never decays and gets rejected here.
 */
function decaysWithinWindow(series: RatioSample[], index: number, changedRatioThreshold: number, decayWindowMs: number): boolean {
  const startTime = series[index].time;
  for (let j = index + 1; j < series.length; j += 1) {
    const elapsed = series[j].time - startTime;
    if (elapsed > decayWindowMs) return false;
    if (series[j].primaryRatio < changedRatioThreshold && series[j].secondaryRatio < changedRatioThreshold) return true;
  }
  // Ran out of clip before the decay window elapsed — don't penalize a pass near the very end.
  return true;
}

function reduceCrossingsToLaps(
  crossings: Crossing[],
  detectionsPerLap: number,
  recordingStartedAt: string,
): { laps: Lap[]; detectionEvents: DetectionEvent[] } {
  const laps: Lap[] = [];
  const detectionEvents: DetectionEvent[] = [];
  if (crossings.length === 0) return { laps, detectionEvents };

  // Crossing times are in ms (to compare against the *Ms thresholds above);
  // Lap/DetectionEvent timestamps are in seconds, matching the rest of the app.
  const startedAtMs = new Date(recordingStartedAt).getTime();
  const toSeconds = (timeMs: number) => timeMs / 1000;
  const toIso = (timeMs: number) => new Date(startedAtMs + timeMs).toISOString();

  const first = crossings[0];
  detectionEvents.push({
    eventType: 'sessionStart',
    detectedAt: toIso(first.time),
    videoTimestamp: toSeconds(first.time),
    score: first.score,
  });

  let lastLapAt = first.time;
  let passesSinceLap = 0;
  for (let i = 1; i < crossings.length; i += 1) {
    const crossing = crossings[i];
    passesSinceLap += 1;
    if (passesSinceLap < detectionsPerLap) continue;
    passesSinceLap = 0;

    const lapNumber = laps.length + 1;
    const lapTime = toSeconds(crossing.time - lastLapAt);
    laps.push({ lapNumber, time: lapTime, timestampInVideo: toSeconds(crossing.time) });
    detectionEvents.push({
      eventType: 'lapDetected',
      detectedAt: toIso(crossing.time),
      videoTimestamp: toSeconds(crossing.time),
      lapNumber,
      score: crossing.score,
    });
    lastLapAt = crossing.time;
  }

  return { laps, detectionEvents };
}

/**
 * The circle drill is ridden as fast as possible, with the first lap or two
 * spent getting up to speed and the last lap winding down — neither
 * represents a real effort, so they're flagged out of scoring (best/average/
 * spread) but kept visible in the lap list. Only applied when there are
 * enough laps that excluding both ends still leaves at least one scored lap.
 */
function markWarmupAndCooldownLaps(laps: Lap[]): Lap[] {
  if (laps.length <= 2) return laps;
  return laps.map((lap, index) => {
    if (index === 0 || index === laps.length - 1) return { ...lap, excludedFromScoring: true };
    return lap;
  });
}
