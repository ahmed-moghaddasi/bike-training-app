import { downsampleLuminance } from './frameSampling';
import type { DetectionEvent, Lap } from '../types';

export type LapDetectionConfig = {
  /** Same center-crop ratio used for the on-screen timing zone overlay, so detection matches framing. */
  detectionZoneWidthRatio: number;
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

export type CandidateLog = {
  /** Seconds into the clip where the candidate strip first activated. */
  startTimeSeconds: number;
  strip: 'left' | 'right' | 'both';
  outcome: CandidateOutcome;
  /** Seconds into the clip where the opposite strip confirmed, if it did. */
  confirmedAtSeconds?: number;
};

export type LapDetectionDiagnostics = {
  frameCount: number;
  clipDurationSeconds: number;
  /** The strongest left/right changed-pixel ratio seen anywhere in the clip — compare against changedRatioThreshold. */
  maxLeftRatio: number;
  maxRightRatio: number;
  config: {
    pixelDeltaThreshold: number;
    changedRatioThreshold: number;
    minActiveMs: number;
    cooldownMs: number;
    sequenceTimeoutMs: number;
    decayWindowMs: number;
  };
  /** Every candidate sequence the detector noticed, and why it was kept or dropped. */
  candidates: CandidateLog[];
  /** Full per-frame signal, downsampled to at most ~500 points so the export stays small. */
  series: Array<{ timeSeconds: number; leftRatio: number; rightRatio: number }>;
};

const SAMPLE_WIDTH = 64;
const SAMPLE_HEIGHT = 120;
const PIXEL_DELTA_THRESHOLD = 16;
const CHANGED_RATIO_THRESHOLD = 0.02;
const MIN_ACTIVE_MS = 100;
const COOLDOWN_MS = 3_000;
const SEQUENCE_TIMEOUT_MS = 1_500;
const DECAY_WINDOW_MS = 1_000;
const MODE_BIN_COUNT = 32;
const MODE_BIN_WIDTH = 256 / MODE_BIN_COUNT;
const PLAYBACK_RATE = 8;

type CapturedFrame = { time: number; grid: Float32Array };
type RatioSample = { time: number; leftRatio: number; rightRatio: number };
type Crossing = { time: number; direction: 'left-to-right' | 'right-to-left'; score: number };

type VideoWithFrameCallback = HTMLVideoElement & {
  requestVideoFrameCallback?: (callback: (now: number, metadata: { mediaTime: number }) => void) => number;
};

/**
 * Runs lap detection over an already-recorded clip instead of live, frame-by-frame
 * during the ride. One full decode pass captures every frame's luminance grid; the
 * rest of the analysis (baseline, ratios, crossing detection) runs on that in-memory
 * data, which is what lets this look both forward and backward in time per candidate
 * event — something a live, causal detector structurally cannot do.
 */
export async function detectLapsFromVideo(videoUri: string, config: LapDetectionConfig): Promise<LapDetectionResult> {
  const emptyDiagnostics: LapDetectionDiagnostics = {
    frameCount: 0,
    clipDurationSeconds: 0,
    maxLeftRatio: 0,
    maxRightRatio: 0,
    config: detectorConfigSnapshot(),
    candidates: [],
    series: [],
  };

  const frames = await extractFrames(videoUri, {
    zoneWidthRatio: config.detectionZoneWidthRatio,
    sampleWidth: SAMPLE_WIDTH,
    sampleHeight: SAMPLE_HEIGHT,
    playbackRate: PLAYBACK_RATE,
  });

  if (frames.length === 0) return { laps: [], detectionEvents: [], diagnostics: emptyDiagnostics };

  const baseline = computeModeBaseline(frames.map((frame) => frame.grid), SAMPLE_WIDTH * SAMPLE_HEIGHT);
  const series = computeChangedRatioSeries(frames, baseline);
  const { crossings, candidates } = detectCrossings(series);
  const result = reduceCrossingsToLaps(crossings, Math.max(1, config.detectionsPerLap), config.recordingStartedAt);

  const diagnostics: LapDetectionDiagnostics = {
    frameCount: frames.length,
    clipDurationSeconds: series.length ? series[series.length - 1].time / 1000 : 0,
    maxLeftRatio: series.reduce((max, sample) => Math.max(max, sample.leftRatio), 0),
    maxRightRatio: series.reduce((max, sample) => Math.max(max, sample.rightRatio), 0),
    config: detectorConfigSnapshot(),
    candidates: candidates.map((candidate) => ({
      startTimeSeconds: candidate.startTime / 1000,
      strip: candidate.strip,
      outcome: candidate.outcome,
      confirmedAtSeconds: candidate.confirmedAt !== undefined ? candidate.confirmedAt / 1000 : undefined,
    })),
    series: downsampleSeriesForExport(series).map((sample) => ({
      timeSeconds: sample.time / 1000,
      leftRatio: sample.leftRatio,
      rightRatio: sample.rightRatio,
    })),
  };

  return { ...result, diagnostics };
}

function detectorConfigSnapshot() {
  return {
    pixelDeltaThreshold: PIXEL_DELTA_THRESHOLD,
    changedRatioThreshold: CHANGED_RATIO_THRESHOLD,
    minActiveMs: MIN_ACTIVE_MS,
    cooldownMs: COOLDOWN_MS,
    sequenceTimeoutMs: SEQUENCE_TIMEOUT_MS,
    decayWindowMs: DECAY_WINDOW_MS,
  };
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

function extractFrames(
  videoUri: string,
  options: { zoneWidthRatio: number; sampleWidth: number; sampleHeight: number; playbackRate: number },
): Promise<CapturedFrame[]> {
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

      const sourceWidth = Math.max(64, Math.floor(video.videoWidth * options.zoneWidthRatio));
      const sourceX = Math.max(0, Math.floor((video.videoWidth - sourceWidth) / 2));
      canvas.width = options.sampleWidth;
      canvas.height = options.sampleHeight;
      context.drawImage(video, sourceX, 0, sourceWidth, video.videoHeight, 0, 0, options.sampleWidth, options.sampleHeight);
      const imageData = context.getImageData(0, 0, options.sampleWidth, options.sampleHeight);
      // Stored in ms (video time * 1000) so they compare directly against the *_MS thresholds below.
      frames.push({ time: mediaTime * 1000, grid: downsampleLuminance(imageData, options.sampleWidth, options.sampleHeight) });
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
      video.playbackRate = options.playbackRate;

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
function computeModeBaseline(grids: Float32Array[], pixelCount: number): Float32Array {
  const histogram = new Uint32Array(pixelCount * MODE_BIN_COUNT);
  for (const grid of grids) {
    for (let index = 0; index < pixelCount; index += 1) {
      const bin = Math.min(MODE_BIN_COUNT - 1, Math.floor(grid[index] / MODE_BIN_WIDTH));
      histogram[index * MODE_BIN_COUNT + bin] += 1;
    }
  }

  const baseline = new Float32Array(pixelCount);
  for (let index = 0; index < pixelCount; index += 1) {
    let bestBin = 0;
    let bestCount = -1;
    for (let bin = 0; bin < MODE_BIN_COUNT; bin += 1) {
      const count = histogram[index * MODE_BIN_COUNT + bin];
      if (count > bestCount) {
        bestCount = count;
        bestBin = bin;
      }
    }
    baseline[index] = (bestBin + 0.5) * MODE_BIN_WIDTH;
  }
  return baseline;
}

function computeChangedRatioSeries(frames: CapturedFrame[], baseline: Float32Array): RatioSample[] {
  const halfWidth = Math.floor(SAMPLE_WIDTH / 2);
  return frames.map(({ time, grid }) => {
    let leftChanged = 0;
    let rightChanged = 0;
    let leftPixels = 0;
    let rightPixels = 0;
    for (let index = 0; index < grid.length; index += 1) {
      const x = index % SAMPLE_WIDTH;
      const changed = Math.abs(grid[index] - baseline[index]) >= PIXEL_DELTA_THRESHOLD;
      if (x < halfWidth) {
        leftPixels += 1;
        if (changed) leftChanged += 1;
      } else {
        rightPixels += 1;
        if (changed) rightChanged += 1;
      }
    }
    return {
      time,
      leftRatio: leftPixels ? leftChanged / leftPixels : 0,
      rightRatio: rightPixels ? rightChanged / rightPixels : 0,
    };
  });
}

type RawCandidate = {
  strip: 'left' | 'right' | 'both';
  startTime: number;
  outcome: CandidateOutcome;
  confirmedAt?: number;
};

/** Asymmetric left/right crossing sequence, same idea as the old live detector, evaluated over the whole series. */
function detectCrossings(series: RatioSample[]): { crossings: Crossing[]; candidates: RawCandidate[] } {
  const crossings: Crossing[] = [];
  const candidates: RawCandidate[] = [];
  let leftActiveSince: number | null = null;
  let rightActiveSince: number | null = null;
  let pendingStrip: 'left' | 'right' | null = null;
  let pendingSince = 0;
  let lastCrossingAt = Number.NEGATIVE_INFINITY;
  let cooldownActivityStart: number | null = null;
  let cooldownActivityStrip: 'left' | 'right' | 'both' | null = null;

  function flushCooldownActivity() {
    if (cooldownActivityStart === null) return;
    candidates.push({ strip: cooldownActivityStrip ?? 'both', startTime: cooldownActivityStart, outcome: 'suppressed-by-cooldown' });
    cooldownActivityStart = null;
    cooldownActivityStrip = null;
  }

  for (let i = 0; i < series.length; i += 1) {
    const { time, leftRatio, rightRatio } = series[i];
    const leftActive = leftRatio >= CHANGED_RATIO_THRESHOLD;
    const rightActive = rightRatio >= CHANGED_RATIO_THRESHOLD;

    leftActiveSince = leftActive ? leftActiveSince ?? time : null;
    rightActiveSince = rightActive ? rightActiveSince ?? time : null;

    if (pendingStrip && time - pendingSince > SEQUENCE_TIMEOUT_MS) {
      candidates.push({ strip: pendingStrip, startTime: pendingSince, outcome: 'sequence-timeout' });
      pendingStrip = null;
    }

    if (time - lastCrossingAt < COOLDOWN_MS) {
      pendingStrip = null;
      // A real pass attempted before cooldown clears would otherwise vanish with no trace at all.
      if (leftActive || rightActive) {
        if (cooldownActivityStart === null) {
          cooldownActivityStart = time;
          cooldownActivityStrip = leftActive && rightActive ? 'both' : leftActive ? 'left' : 'right';
        }
      } else {
        flushCooldownActivity();
      }
      continue;
    }
    flushCooldownActivity();

    const leftConfirmed = leftActiveSince !== null && time - leftActiveSince >= MIN_ACTIVE_MS;
    const rightConfirmed = rightActiveSince !== null && time - rightActiveSince >= MIN_ACTIVE_MS;

    // Whole-zone changes (camera shake, a hand near the lens) cannot begin a sequence.
    if (!pendingStrip && leftConfirmed !== rightConfirmed) {
      pendingStrip = leftConfirmed ? 'left' : 'right';
      pendingSince = time;
    }

    let direction: Crossing['direction'] | undefined;
    if (pendingStrip === 'left' && rightConfirmed) direction = 'left-to-right';
    if (pendingStrip === 'right' && leftConfirmed) direction = 'right-to-left';

    if (direction && decaysWithinWindow(series, i)) {
      crossings.push({ time, direction, score: Math.max(leftRatio, rightRatio) / CHANGED_RATIO_THRESHOLD });
      candidates.push({ strip: pendingStrip!, startTime: pendingSince, outcome: 'confirmed', confirmedAt: time });
      lastCrossingAt = time;
      pendingStrip = null;
      leftActiveSince = null;
      rightActiveSince = null;
    } else if (direction) {
      // Confirmed sequence but motion never decayed — likely sustained drift, not a real pass.
      candidates.push({ strip: pendingStrip!, startTime: pendingSince, outcome: 'decay-failed', confirmedAt: time });
      pendingStrip = null;
    }
  }

  // Clip ended mid-sequence — log it rather than silently dropping the candidate.
  if (pendingStrip) {
    candidates.push({ strip: pendingStrip, startTime: pendingSince, outcome: 'sequence-timeout' });
  }
  flushCooldownActivity();

  return { crossings, candidates };
}

/**
 * Non-causal confirmation only possible because future frames are already available:
 * a genuine pass rises then falls back toward baseline; sustained motion (a shadow
 * drifting, someone lingering in frame) never decays and gets rejected here.
 */
function decaysWithinWindow(series: RatioSample[], index: number): boolean {
  const startTime = series[index].time;
  for (let j = index + 1; j < series.length; j += 1) {
    const elapsed = series[j].time - startTime;
    if (elapsed > DECAY_WINDOW_MS) return false;
    if (series[j].leftRatio < CHANGED_RATIO_THRESHOLD && series[j].rightRatio < CHANGED_RATIO_THRESHOLD) return true;
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

  // Crossing times are in ms (to compare against the *_MS thresholds above);
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
