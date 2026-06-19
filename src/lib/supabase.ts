import { createClient } from '@supabase/supabase-js';
import type { DetectionEvent, Lap, SessionDraft } from '../types';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl as string, supabaseAnonKey as string)
  : undefined;

export type SavedSession = {
  id: string;
  date: string;
  bikeId: string;
  drillId: string;
  setupVariantId: string;
  videoPath?: string;
  videoSaved: boolean;
  notes?: string;
  laps: Lap[];
};

function getVideoExtension(videoUri: string) {
  if (videoUri.includes('webm')) return 'webm';
  return 'mp4';
}

function createId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `device-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getClientId() {
  if (typeof window === 'undefined') return createId();
  const key = 'apex-lab-client-id';
  const existing = window.localStorage.getItem(key);
  if (existing) return existing;
  const next = createId();
  window.localStorage.setItem(key, next);
  return next;
}

async function blobFromUri(videoUri: string) {
  const response = await fetch(videoUri);
  if (!response.ok) throw new Error('Could not read the recorded video.');
  return response.blob();
}

export async function saveSessionDraft(draft: SessionDraft, notes: string) {
  if (!supabase) throw new Error('Supabase is not configured.');
  const clientId = getClientId();

  let videoPath: string | undefined;
  if (draft.videoUri) {
    const blob = await blobFromUri(draft.videoUri);
    const extension = getVideoExtension(blob.type || draft.videoUri);
    videoPath = `anonymous/${clientId}/${draft.startedAt.replace(/[:.]/g, '-')}-${draft.drillId}.${extension}`;
    const { error: uploadError } = await supabase.storage.from('session-videos').upload(videoPath, blob, {
      contentType: blob.type || `video/${extension}`,
      upsert: false,
    });
    if (uploadError) throw uploadError;
  }

  const times = draft.laps.map((lap) => lap.time);
  const bestLap = times.length ? Math.min(...times) : null;
  const averageLap = times.length ? times.reduce((sum, time) => sum + time, 0) / times.length : null;
  const spread = times.length ? Math.max(...times) - Math.min(...times) : null;

  const { data: session, error: sessionError } = await supabase
    .from('sessions')
    .insert({
      client_id: clientId,
      date: draft.endedAt,
      bike_id: draft.bikeId,
      drill_id: draft.drillId,
      setup_variant_id: draft.setupVariantId,
      video_path: videoPath,
      video_saved: Boolean(videoPath),
      notes: notes.trim() || null,
      best_lap: bestLap,
      average_lap: averageLap,
      spread,
      lap_count: draft.laps.length,
    })
    .select('id')
    .single();

  if (sessionError) throw sessionError;

  if (draft.laps.length > 0) {
    const { error: lapsError } = await supabase.from('laps').insert(
      draft.laps.map((lap) => ({
        session_id: session.id,
        lap_number: lap.lapNumber,
        time: lap.time,
        timestamp_in_video: lap.timestampInVideo ?? null,
      }))
    );
    if (lapsError) throw lapsError;
  }

  if (draft.detectionEvents.length > 0) {
    const { error: detectionError } = await supabase.from('detection_events').insert(
      draft.detectionEvents.map((event: DetectionEvent) => ({
        session_id: session.id,
        event_type: event.eventType,
        detected_at: event.detectedAt,
        video_timestamp: event.videoTimestamp,
        lap_number: event.lapNumber ?? null,
        score: event.score ?? null,
      }))
    );
    if (detectionError) throw detectionError;
  }

  return session.id as string;
}
