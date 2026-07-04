// Throwaway local test harness — not part of the deployed worker. Run with:
//   npx tsx test-local.ts "<path to a test clip>" [drillId]
// drillId defaults to 'circle'; pass any id from src/data/seed.ts's drills list
// (e.g. figure-eight, hairpin, l-turn, loop, straight-line) to test a different drill's config.
// Exercises the real ffmpeg-based extraction + full detection pipeline against
// a local file, without touching Supabase at all.
import { drills } from '../src/data/seed';
import { getDetectionConfigForDrill } from '../src/lib/detection';
import { detectLapsFromVideo } from '../src/lib/lapDetector';
import { detectLoopLaps } from '../src/lib/loopDetector';
import {
  DEFAULT_STRAIGHT_LINE_CONFIG,
  detectBrakingReps,
  toFrameExtractionConfig,
} from '../src/lib/straightLineDetector';
import { createFfmpegExtractor, extractFramesWithFfmpeg } from './ffmpegFrames';

/** mm:ss.ss, matching the format hand-timed ground-truth notes use for video timestamps. */
function formatTimestamp(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds - minutes * 60;
  return `${minutes}:${rest.toFixed(2).padStart(5, '0')}`;
}

async function main() {
  const videoPath = process.argv[2];
  const drillId = process.argv[3] ?? 'circle';
  if (!videoPath) {
    console.error('Usage: tsx test-local.ts <videoPath> [drillId]');
    process.exit(1);
  }

  const start = Date.now();

  if (drillId === 'straight-line') {
    const config = DEFAULT_STRAIGHT_LINE_CONFIG;
    const extractor = createFfmpegExtractor(60);
    const frames = await extractor(videoPath, toFrameExtractionConfig(config));
    const result = detectBrakingReps(frames, config);
    const elapsed = (Date.now() - start) / 1000;

    console.log(`Processed in ${elapsed.toFixed(1)}s (wall clock)`);
    console.log(
      `frameCount=${result.diagnostics.frameCount}  clipDuration=${result.diagnostics.clipDurationSeconds.toFixed(1)}s`,
    );
    console.log(
      `frameWidth=${result.diagnostics.frameWidthMeters.toFixed(1)}m  metersPerStrip=${result.diagnostics.metersPerStrip.toFixed(2)}m`,
    );
    console.log(
      `calibratedBrakeMarkerStrip=${result.diagnostics.calibratedBrakeMarkerStrip?.toFixed(1) ?? 'n/a'}`,
    );
    console.log(`\nPasses (${result.diagnostics.passes.length} total):`);
    for (const p of result.diagnostics.passes) {
      const dir = p.direction ?? '?';
      const dur = ((p.endTimeMs - p.startTimeMs) / 1000).toFixed(1);
      const method = p.speedMethod ? `${p.speedMethod}(${p.approachFramesUsable}fr)` : '-';
      console.log(
        `  [${(p.startTimeMs / 1000).toFixed(1)}s–${(p.endTimeMs / 1000).toFixed(1)}s] ${dur}s` +
        `  frames=${p.centroidFrameCount}` +
        `  centroid=${p.firstCentroid?.toFixed(1) ?? '?'}→${p.lastCentroid?.toFixed(1) ?? '?'}` +
        `  dir=${dir}  outcome=${p.outcome}` +
        `  method=${method}` +
        `  strip=${p.decelerationOnsetStrip?.toFixed(1) ?? '-'}` +
        `  speed=${p.entrySpeedKph?.toFixed(1) ?? '-'} km/h` +
        `  stop=${p.stoppingDistanceMeters?.toFixed(2) ?? '-'} m`,
      );
    }
    console.log(`\nReps (${result.reps.length} detected):`);
    for (const rep of result.reps) {
      console.log(
        `  Rep ${rep.repNumber}: speed=${rep.entrySpeedKph?.toFixed(1) ?? '-'} km/h  stop=${rep.stoppingDistanceMeters?.toFixed(2) ?? '-'} m  brakingDuration=${rep.brakingDurationMs ? (rep.brakingDurationMs / 1000).toFixed(2) : '-'}s  @${(rep.timestampInVideo / 1000).toFixed(1)}s`,
      );
    }
    return;
  }

  if (drillId === 'loop') {
    // 60fps (vs. the 30fps default) roughly doubles crossing-timestamp
    // precision — worthwhile here since a pass through the zone is only ~2s.
    const extractor = createFfmpegExtractor(60);
    const result = await detectLoopLaps(videoPath, { recordingStartedAt: new Date().toISOString() }, extractor);
    const elapsed = (Date.now() - start) / 1000;

    console.log(`Processed in ${elapsed.toFixed(1)}s (wall clock)`);
    console.log(
      `frameCount=${result.diagnostics.frameCount}  clipDuration=${result.diagnostics.clipDurationSeconds.toFixed(1)}s` +
      `  directionReversals=${result.diagnostics.directionReversals}`,
    );
    console.log(
      `speedFrameCount=${result.speedDiagnostics.frameCount}  frameWidth=${result.speedDiagnostics.frameWidthMeters.toFixed(1)}m` +
      `  metersPerStrip=${result.speedDiagnostics.metersPerStrip.toFixed(2)}m`,
    );
    console.log(`\nLaps (${result.laps.length} detected):`);
    for (const lap of result.laps) {
      const ts = lap.timestampInVideo !== undefined ? formatTimestamp(lap.timestampInVideo) : '?';
      const speed = lap.entrySpeedKph !== undefined ? `${lap.entrySpeedKph.toFixed(1)} km/h` : '-';
      console.log(
        `  L${lap.lapNumber}: ${lap.time.toFixed(2)}s${lap.lapLabel ? ` (${lap.lapLabel})` : ''}` +
        `  @${ts}  speed=${speed}`,
      );
    }
    return;
  }

  const drill = drills.find((item) => item.id === drillId);
  if (!drill) {
    console.error(`Unknown drillId "${drillId}". Known ids: straight-line, ${drills.map((item) => item.id).join(', ')}`);
    process.exit(1);
  }
  const result = await detectLapsFromVideo(
    videoPath,
    {
      detection: getDetectionConfigForDrill(drill.id),
      detectionsPerLap: drill.timingRule.detectionsPerLap ?? 1,
      recordingStartedAt: new Date().toISOString(),
    },
    extractFramesWithFfmpeg,
  );
  const elapsed = (Date.now() - start) / 1000;
  console.log(`Processed in ${elapsed.toFixed(1)}s (wall clock)`);
  console.log(`frameCount=${result.diagnostics.frameCount} clipDurationSeconds=${result.diagnostics.clipDurationSeconds.toFixed(1)}`);
  console.log(`laps=${result.laps.length}`);
  for (const lap of result.laps) {
    console.log(`  L${lap.lapNumber}: ${lap.time.toFixed(2)}s${lap.lapLabel ? ` (${lap.lapLabel})` : ''}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
