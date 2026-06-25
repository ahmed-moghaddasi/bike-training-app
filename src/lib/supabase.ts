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
  videoSaved: boolean;
  notes?: string;
  laps: Lap[];
};

type SavedSessionRow = {
  id: string;
  date: string;
  bike_id: string;
  drill_id: string;
  setup_variant_id: string;
  video_saved: boolean;
  notes: string | null;
  laps: Array<{
    lap_number: number;
    time: number;
    timestamp_in_video: number | null;
  }>;
};

export type SaveSessionResult = {
  sessionId: string;
  videoSaved: boolean;
};

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

export async function saveSessionDraft(draft: SessionDraft, notes: string, videoSavedLocally: boolean) {
  if (!supabase) throw new Error('Supabase is not configured.');
  const clientId = getClientId();

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
      video_path: null,
      video_saved: videoSavedLocally,
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

  const sessionId = session.id as string;
  return { sessionId, videoSaved: videoSavedLocally } satisfies SaveSessionResult;
}

export async function loadSavedSessions(): Promise<SavedSession[]> {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase
    .from('sessions')
    .select('id,date,bike_id,drill_id,setup_variant_id,video_saved,notes,laps(lap_number,time,timestamp_in_video)')
    .order('date', { ascending: false });

  if (error) throw error;

  return ((data ?? []) as SavedSessionRow[]).map((session) => ({
    id: session.id,
    date: session.date,
    bikeId: session.bike_id,
    drillId: session.drill_id,
    setupVariantId: session.setup_variant_id,
    videoSaved: session.video_saved,
    notes: session.notes ?? undefined,
    laps: session.laps
      .slice()
      .sort((a, b) => a.lap_number - b.lap_number)
      .map((lap) => ({
        lapNumber: lap.lap_number,
        time: Number(lap.time),
        timestampInVideo: lap.timestamp_in_video === null ? undefined : Number(lap.timestamp_in_video),
      })),
  }));
}

export async function deleteSavedSession(sessionId: string) {
  if (!supabase) throw new Error('Supabase is not configured.');

  const { error } = await supabase
    .from('sessions')
    .delete()
    .eq('id', sessionId);

  if (error) throw error;
}

/**
 * Dev-only: uploads lapDetector diagnostics so they can be queried directly
 * instead of pasted by hand after every test recording. Best-effort — a failed
 * upload should never block saving the actual session.
 */
export async function uploadDebugReport(report: { drillId: string; startedAt: string; payload: unknown }): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: false, error: 'Supabase is not configured for this build.' };
  try {
    const { error } = await supabase.from('debug_reports').insert({
      client_id: getClientId(),
      drill_id: report.drillId,
      started_at: report.startedAt,
      payload: report.payload,
    });
    if (error) {
      const message = [error.message, error.details, error.hint].filter(Boolean).join(' | ');
      console.warn('Could not upload debug report:', message);
      return { ok: false, error: message };
    }
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error uploading debug report.';
    console.warn('Could not upload debug report:', message);
    return { ok: false, error: message };
  }
}
