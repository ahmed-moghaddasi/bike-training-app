import { downsampleLuminance } from './frameSampling';
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

export type CandidateOutcome = 'confirmed' | 'sequence-timeout' | 'decay-failed' | 'suppressed-by-cooldown';

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
  series: Array<{ timeSeconds: number; primaryRatio: number; secondaryRatio: number }>;
};

type CapturedFrame = { time: number; grid: Float32Array };
type RatioSample = { time: number; primaryRatio: number; secondaryRatio: number };
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
  const baseline = computeModeBaseline(frames.map((frame) => frame.grid), pixelCount, detection.modeBinCount);
  const series = computeChangedRatioSeries(frames, baseline, detection);
  const { crossings, candidates } = detectCrossings(series, detection);
  const result = reduceCrossingsToLaps(crossings, Math.max(1, config.detectionsPerLap), config.recordingStartedAt);

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
      // Stored in ms (video time * 1000) so they compare directly against the *Ms thresholds below.
      frames.push({ time: mediaTime * 1000, grid: downsampleLuminance(imageData, detection.sampleWidth, detection.sampleHeight) });
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

/** Per-pixel mode luminance across the whole clip — robust to the rider already being in frame at t=0. */
function computeModeBaseline(grids: Float32Array[], pixelCount: number, modeBinCount: number): Float32Array {
  const binWidth = 256 / modeBinCount;
  const histogram = new Uint32Array(pixelCount * modeBinCount);
  for (const grid of grids) {
    for (let index = 0; index < pixelCount; index += 1) {
      const bin = Math.min(modeBinCount - 1, Math.floor(grid[index] / binWidth));
      histogram[index * modeBinCount + bin] += 1;
    }
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
 * Walks frames in time order, diffing each against the baseline and then
 * nudging the baseline toward each unchanged pixel (mutates `baseline` in
 * place). Starting from the clip-wide mode handles the rider already being
 * in frame at t=0; continuing to adapt forward handles real lighting drift
 * over a multi-minute session, which a single fixed baseline cannot — a
 * fixed reference left an entire 5-minute lot test reading as "always
 * changed" once the light had drifted far enough from the clip's average.
 * Changed pixels are excluded from the blend so the bike itself never gets
 * absorbed into the background. Splits each frame's grid into primary/
 * secondary halves along the configured orientation's axis.
 */
function computeChangedRatioSeries(frames: CapturedFrame[], baseline: Float32Array, detection: DetectionConfig): RatioSample[] {
  const { sampleWidth, sampleHeight, pixelDeltaThreshold, orientation, baselineTimeConstantSeconds } = detection;
  const halfWidth = Math.floor(sampleWidth / 2);
  const halfHeight = Math.floor(sampleHeight / 2);
  let previousTimeMs: number | null = null;

  return frames.map(({ time, grid }) => {
    // Time-based (not a flat per-frame rate) so adaptation speed doesn't
    // depend on capture fps, which varies a lot by browser/device — e.g. a
    // headless Chrome decode here ran at ~7fps, vs. ~20fps for the original
    // live detector; a flat per-frame rate tuned for one is ~3x too slow
    // for the other.
    const dtSeconds = previousTimeMs !== null ? Math.max(0, (time - previousTimeMs) / 1000) : 0;
    previousTimeMs = time;
    const alpha = baselineTimeConstantSeconds > 0 ? 1 - Math.exp(-dtSeconds / baselineTimeConstantSeconds) : 0;

    let primaryChanged = 0;
    let secondaryChanged = 0;
    let primaryPixels = 0;
    let secondaryPixels = 0;
    for (let index = 0; index < grid.length; index += 1) {
      const changed = Math.abs(grid[index] - baseline[index]) >= pixelDeltaThreshold;
      const isPrimary =
        orientation === 'vertical' ? index % sampleWidth < halfWidth : Math.floor(index / sampleWidth) < halfHeight;
      if (isPrimary) {
        primaryPixels += 1;
        if (changed) primaryChanged += 1;
      } else {
        secondaryPixels += 1;
        if (changed) secondaryChanged += 1;
      }
      if (!changed && alpha > 0) {
        baseline[index] += (grid[index] - baseline[index]) * alpha;
      }
    }
    return {
      time,
      primaryRatio: primaryPixels ? primaryChanged / primaryPixels : 0,
      secondaryRatio: secondaryPixels ? secondaryChanged / secondaryPixels : 0,
    };
  });
}

type RawCandidate = {
  half: 'primary' | 'secondary' | 'both';
  startTime: number;
  outcome: CandidateOutcome;
  confirmedAt?: number;
};

/** Asymmetric crossing sequence (one half activates, then the other), same idea as the old live detector, evaluated over the whole series. */
function detectCrossings(series: RatioSample[], detection: DetectionConfig): { crossings: Crossing[]; candidates: RawCandidate[] } {
  const { changedRatioThreshold, minActiveMs, cooldownMs, sequenceTimeoutMs, decayWindowMs } = detection;
  const crossings: Crossing[] = [];
  const candidates: RawCandidate[] = [];
  let primaryActiveSince: number | null = null;
  let secondaryActiveSince: number | null = null;
  let pendingHalf: 'primary' | 'secondary' | null = null;
  let pendingSince = 0;
  let lastCrossingAt = Number.NEGATIVE_INFINITY;
  let cooldownActivityStart: number | null = null;
  let cooldownActivityHalf: 'primary' | 'secondary' | 'both' | null = null;

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

    if (direction && decaysWithinWindow(series, i, changedRatioThreshold, decayWindowMs)) {
      crossings.push({ time, direction, score: Math.max(primaryRatio, secondaryRatio) / changedRatioThreshold });
      candidates.push({ half: pendingHalf!, startTime: pendingSince, outcome: 'confirmed', confirmedAt: time });
      lastCrossingAt = time;
      pendingHalf = null;
      primaryActiveSince = null;
      secondaryActiveSince = null;
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
