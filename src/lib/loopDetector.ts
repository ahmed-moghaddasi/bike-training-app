import { getDetectionConfigForDrill } from './detection';
import { detectLapsFromVideo, extractFrames, type FrameExtractor, type LapDetectionResult } from './lapDetector';
import {
  DEFAULT_LOOP_SPEED_CONFIG,
  detectLoopSpeeds,
  toFrameExtractionConfig,
  type LoopSpeedConfig,
  type LoopSpeedDiagnostics,
  type LoopSpeedMeasurement,
} from './loopSpeedEstimator';

export type LoopDetectionConfig = {
  /** ISO timestamp the recording began — passed straight through to detectLapsFromVideo. */
  recordingStartedAt: string;
  speedConfig?: LoopSpeedConfig;
};

export type LoopLapDetectionResult = LapDetectionResult & {
  speedDiagnostics: LoopSpeedDiagnostics;
};

/**
 * Top-level entry point for the Loop drill — the Loop equivalent of
 * straightLineDetector.ts's detectBrakingReps. Runs two independent frame
 * extractions over the same video (the narrow zone lapDetector needs for
 * reliable crossing/lap timing, and a separate wide zone loopSpeedEstimator
 * needs for clean centroid/speed tracking) and merges each lap with the
 * speed pass closest to the crossing that completed it.
 */
export async function detectLoopLaps(
  videoUri: string,
  config: LoopDetectionConfig,
  frameExtractor: FrameExtractor = extractFrames,
): Promise<LoopLapDetectionResult> {
  const speedConfig = config.speedConfig ?? DEFAULT_LOOP_SPEED_CONFIG;

  const lapResult = await detectLapsFromVideo(
    videoUri,
    {
      detection: getDetectionConfigForDrill('loop'),
      detectionsPerLap: 1,
      recordingStartedAt: config.recordingStartedAt,
    },
    frameExtractor,
  );

  const speedFrames = await frameExtractor(videoUri, toFrameExtractionConfig(speedConfig));
  const speedResult = detectLoopSpeeds(speedFrames, speedConfig);

  if (lapResult.laps.length === 0 || speedResult.passes.length === 0) {
    return { ...lapResult, speedDiagnostics: speedResult.diagnostics };
  }

  const laps = lapResult.laps.map((lap) => {
    if (lap.timestampInVideo === undefined) return lap;
    const match = closestPass(lap.timestampInVideo * 1000, speedResult.passes);
    if (!match || match.avgSpeedKph === null) return lap;
    return { ...lap, entrySpeedKph: match.avgSpeedKph, speedMethod: 'direct' as const };
  });

  return { ...lapResult, laps, speedDiagnostics: speedResult.diagnostics };
}

/**
 * Finds the speed pass whose window best matches a lap's completing crossing.
 * The narrow-zone crossing point (e.g. a cone) sits somewhere inside the wide
 * zone's visible-pass window, not necessarily at its start or end, so a lap
 * timestamp falling inside a pass's window is a distance-0 (exact) match;
 * otherwise distance is measured to the nearer edge. Anything farther than
 * maxMatchDistanceMs away is treated as no match rather than a bad guess.
 */
function closestPass(
  lapTimeMs: number,
  passes: LoopSpeedMeasurement[],
  maxMatchDistanceMs = 2_000,
): LoopSpeedMeasurement | null {
  let best: LoopSpeedMeasurement | null = null;
  let bestDistance = Infinity;
  for (const pass of passes) {
    const distance =
      lapTimeMs >= pass.startTimeMs && lapTimeMs <= pass.endTimeMs
        ? 0
        : lapTimeMs < pass.startTimeMs
          ? pass.startTimeMs - lapTimeMs
          : lapTimeMs - pass.endTimeMs;
    if (distance < bestDistance) {
      best = pass;
      bestDistance = distance;
    }
  }
  return best && bestDistance <= maxMatchDistanceMs ? best : null;
}
