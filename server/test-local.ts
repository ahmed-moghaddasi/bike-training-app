// Throwaway local test harness — not part of the deployed worker. Run with:
//   npx tsx test-local.ts "<path to a Circle Drill Test clip>"
// Exercises the real ffmpeg-based extraction + full detection pipeline against
// a local file, without touching Supabase at all.
import { drills } from '../src/data/seed';
import { getDetectionConfigForDrill } from '../src/lib/detection';
import { detectLapsFromVideo } from '../src/lib/lapDetector';
import { extractFramesWithFfmpeg } from './ffmpegFrames';

async function main() {
  const videoPath = process.argv[2];
  if (!videoPath) {
    console.error('Usage: tsx test-local.ts <videoPath>');
    process.exit(1);
  }
  const drill = drills.find((item) => item.id === 'circle')!;
  const start = Date.now();
  const result = await detectLapsFromVideo(
    videoPath,
    {
      detection: getDetectionConfigForDrill('circle'),
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
