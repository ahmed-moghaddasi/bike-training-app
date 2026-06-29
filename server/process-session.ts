import { createClient } from '@supabase/supabase-js';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { drills } from '../src/data/seed';
import { getDetectionConfigForDrill } from '../src/lib/detection';
import { detectLapsFromVideo } from '../src/lib/lapDetector';
import { extractFramesWithFfmpeg } from './ffmpegFrames';

async function run(sessionId: string, drillId: string, supabaseUrl: string, serviceRoleKey: string) {
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  async function markError(message: string): Promise<never> {
    console.error(message);
    await supabase.from('sessions').update({ status: 'error', error_message: message.slice(0, 2000) }).eq('id', sessionId);
    process.exit(1);
    throw new Error('unreachable');
  }

  await supabase.from('sessions').update({ status: 'processing' }).eq('id', sessionId);

  const { data: session, error: sessionError } = await supabase
    .from('sessions')
    .select('video_storage_path, started_at')
    .eq('id', sessionId)
    .single();
  if (sessionError || !session) {
    await markError(`Could not load session row: ${sessionError?.message ?? 'not found'}`);
    return;
  }
  if (!session.video_storage_path) {
    await markError('Session has no video_storage_path — upload may not have finished.');
    return;
  }

  const { data: videoBlob, error: downloadError } = await supabase.storage.from('session-videos').download(session.video_storage_path);
  if (downloadError || !videoBlob) {
    await markError(`Could not download video: ${downloadError?.message ?? 'unknown error'}`);
    return;
  }

  const extension = session.video_storage_path.split('.').pop() ?? 'mp4';
  const tempDir = await mkdtemp(path.join(tmpdir(), 'lap-detection-'));
  const videoPath = path.join(tempDir, `input.${extension}`);

  try {
    await writeFile(videoPath, Buffer.from(await videoBlob.arrayBuffer()));

    const drill = drills.find((item) => item.id === drillId) ?? drills[0];
    const result = await detectLapsFromVideo(
      videoPath,
      {
        detection: getDetectionConfigForDrill(drill.id),
        detectionsPerLap: drill.timingRule.detectionsPerLap ?? 1,
        recordingStartedAt: session.started_at ?? new Date().toISOString(),
      },
      extractFramesWithFfmpeg,
    );

    // best/average/spread reflect scored laps only (warm-up/cool-down excluded) —
    // mirrors the same rule the client used to apply in saveSessionDraft.
    const scoredTimes = result.laps.filter((lap) => !lap.excludedFromScoring).map((lap) => lap.time);
    const bestLap = scoredTimes.length ? Math.min(...scoredTimes) : null;
    const averageLap = scoredTimes.length ? scoredTimes.reduce((sum, time) => sum + time, 0) / scoredTimes.length : null;
    const spread = scoredTimes.length ? Math.max(...scoredTimes) - Math.min(...scoredTimes) : null;

    if (result.laps.length > 0) {
      const { error: lapsError } = await supabase.from('laps').insert(
        result.laps.map((lap) => ({
          session_id: sessionId,
          lap_number: lap.lapNumber,
          time: lap.time,
          timestamp_in_video: lap.timestampInVideo ?? null,
        })),
      );
      if (lapsError) await markError(`Could not save laps: ${lapsError.message}`);
    }

    if (result.detectionEvents.length > 0) {
      const { error: eventsError } = await supabase.from('detection_events').insert(
        result.detectionEvents.map((event) => ({
          session_id: sessionId,
          event_type: event.eventType,
          detected_at: event.detectedAt,
          video_timestamp: event.videoTimestamp,
          lap_number: event.lapNumber ?? null,
          score: event.score ?? null,
        })),
      );
      if (eventsError) await markError(`Could not save detection events: ${eventsError.message}`);
    }

    const { error: updateError } = await supabase
      .from('sessions')
      .update({ status: 'ready', lap_count: result.laps.length, best_lap: bestLap, average_lap: averageLap, spread })
      .eq('id', sessionId);
    if (updateError) await markError(`Could not finalize session: ${updateError.message}`);

    const { error: removeError } = await supabase.storage.from('session-videos').remove([session.video_storage_path]);
    if (removeError) console.warn(`Processed ok, but could not delete staged video: ${removeError.message}`);

    console.log(`Processed session ${sessionId}: ${result.laps.length} laps.`);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

const sessionId = process.env.SESSION_ID;
const drillId = process.env.DRILL_ID;
const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!sessionId || !drillId || !supabaseUrl || !serviceRoleKey) {
  console.error('Missing required environment variables: SESSION_ID, DRILL_ID, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
} else {
  run(sessionId, drillId, supabaseUrl, serviceRoleKey).catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
