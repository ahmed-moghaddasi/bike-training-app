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
  videoUri?: string;
  notes?: string;
  laps: Lap[];
};

type SavedSessionRow = {
  id: string;
  date: string;
  bike_id: string;
  drill_id: string;
  setup_variant_id: string;
  video_path: string | null;
  video_saved: boolean;
  notes: string | null;
  laps: Array<{
    lap_number: number;
    time: number;
    timestamp_in_video: number | null;
  }>;
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
      upsert: true,
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

export async function loadSavedSessions(): Promise<SavedSession[]> {
  if (!supabase) throw new Error('Supabase is not configured.');
  const clientId = getClientId();
  const { data, error } = await supabase
    .from('sessions')
    .select('id,date,bike_id,drill_id,setup_variant_id,video_path,video_saved,notes,laps(lap_number,time,timestamp_in_video)')
    .eq('client_id', clientId)
    .order('date', { ascending: false });

  if (error) throw error;

  return Promise.all(
    ((data ?? []) as SavedSessionRow[]).map(async (session) => {
      let videoUri: string | undefined;
      if (session.video_path) {
        const { data: signedVideo, error: signedVideoError } = await supabase.storage
          .from('session-videos')
          .createSignedUrl(session.video_path, 60 * 60);
        if (!signedVideoError) videoUri = signedVideo.signedUrl;
      }

      return {
        id: session.id,
        date: session.date,
        bikeId: session.bike_id,
        drillId: session.drill_id,
        setupVariantId: session.setup_variant_id,
        videoPath: session.video_path ?? undefined,
        videoSaved: session.video_saved,
        videoUri,
        notes: session.notes ?? undefined,
        laps: session.laps
          .slice()
          .sort((a, b) => a.lap_number - b.lap_number)
          .map((lap) => ({
            lapNumber: lap.lap_number,
            time: Number(lap.time),
            timestampInVideo: lap.timestamp_in_video === null ? undefined : Number(lap.timestamp_in_video),
          })),
      };
    })
  );
}
