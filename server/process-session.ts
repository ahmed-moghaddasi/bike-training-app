import { createClient } from '@supabase/supabase-js';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
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

    if (drill.timingRule.detectionMode === 'straight-line') {
      const config = DEFAULT_STRAIGHT_LINE_CONFIG;
      const extractor = createFfmpegExtractor(60);
      const frames = await extractor(videoPath, toFrameExtractionConfig(config));
      const slResult = detectBrakingReps(frames, config);

      const reps = slResult.reps;
      const stopDistances = reps.map((r) => r.stoppingDistanceMeters ?? Infinity);
      const bestStop = stopDistances.length ? Math.min(...stopDistances) : null;
      const avgSpeed = reps.length
        ? reps.reduce((sum, r) => sum + (r.entrySpeedKph ?? 0), 0) / reps.length
        : null;

      if (reps.length > 0) {
        const { error: lapsError } = await supabase.from('laps').insert(
          reps.map((rep) => ({
            session_id: sessionId,
            lap_number: rep.repNumber,
            time: (rep.brakingDurationMs ?? 0) / 1000,
            timestamp_in_video: rep.timestampInVideo ?? null,
            entry_speed_kph: rep.entrySpeedKph ?? null,
            stopping_distance_meters: rep.stoppingDistanceMeters ?? null,
            braking_duration_ms: rep.brakingDurationMs ?? null,
            speed_method: rep.speedMethod ?? null,
            stop_off_screen: rep.stopOffScreen ?? null,
            braking_score_g: rep.brakingScoreG ?? null,
          })),
        );
        if (lapsError) await markError(`Could not save laps: ${lapsError.message}`);
      }

      const { error: updateError } = await supabase
        .from('sessions')
        .update({ status: 'ready', lap_count: reps.length, best_lap: bestStop, average_lap: avgSpeed, spread: null })
        .eq('id', sessionId);
      if (updateError) await markError(`Could not finalize session: ${updateError.message}`);

      const { error: removeError } = await supabase.storage.from('session-videos').remove([session.video_storage_path]);
      if (removeError) console.warn(`Processed ok, but could not delete staged video: ${removeError.message}`);

      console.log(`Processed session ${sessionId}: ${reps.length} braking reps.`);
    } else if (drill.id === 'loop') {
      // 60fps (vs. the 30fps default) roughly doubles crossing-timestamp
      // precision — worthwhile since a Loop pass through the zone is only ~2s.
      const extractor = createFfmpegExtractor(60);
      const result = await detectLoopLaps(
        videoPath,
        { recordingStartedAt: session.started_at ?? new Date().toISOString() },
        extractor,
      );

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
            entry_speed_kph: lap.entrySpeedKph ?? null,
            speed_method: lap.speedMethod ?? null,
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
    } else {
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
    }
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
