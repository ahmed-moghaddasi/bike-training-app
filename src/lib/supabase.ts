import { createClient } from '@supabase/supabase-js';
import type { Lap, SessionDraft } from '../types';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl as string, supabaseAnonKey as string)
  : undefined;

export type SessionStatus = 'ready' | 'queued' | 'processing' | 'error';

export type SavedSession = {
  id: string;
  date: string;
  bikeId: string;
  drillId: string;
  setupVariantId: string;
  videoSaved: boolean;
  notes?: string;
  laps: Lap[];
  status: SessionStatus;
  errorMessage?: string;
};

type SavedSessionRow = {
  id: string;
  date: string;
  bike_id: string;
  drill_id: string;
  setup_variant_id: string;
  video_saved: boolean;
  notes: string | null;
  status: SessionStatus;
  error_message: string | null;
  laps: Array<{
    lap_number: number;
    time: number;
    timestamp_in_video: number | null;
  }>;
};

export function createId() {
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

/**
 * Creates the `sessions` row before any laps are known — lap detection now
 * happens out-of-process (see server/), so there's no longer a single
 * "insert everything at once" save. id is generated client-side (createId)
 * rather than left to the DB default so the row can exist while the video
 * upload (which can take a while for a long recording) is still in flight.
 */
export async function createPendingSession(sessionId: string, draft: SessionDraft): Promise<void> {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { error } = await supabase.from('sessions').insert({
    id: sessionId,
    client_id: getClientId(),
    date: draft.endedAt,
    started_at: draft.startedAt,
    bike_id: draft.bikeId,
    drill_id: draft.drillId,
    setup_variant_id: draft.setupVariantId,
    video_path: null,
    video_saved: false,
    status: 'queued',
    lap_count: 0,
  });
  if (error) throw error;
}

/**
 * Uploads the recorded video to temporary staging storage. The bucket's RLS
 * only permits an anon-key client to write under the literal 'anonymous/'
 * prefix (not a client_id-scoped path) — every device currently shares that
 * namespace for Storage purposes, fine for single-rider use.
 */
export async function uploadSessionVideo(sessionId: string, blob: Blob): Promise<string> {
  if (!supabase) throw new Error('Supabase is not configured.');
  const extension = blob.type.includes('webm') ? 'webm' : 'mp4';
  const path = `anonymous/${sessionId}.${extension}`;
  const { error } = await supabase.storage.from('session-videos').upload(path, blob, {
    contentType: blob.type || 'video/mp4',
    upsert: false,
  });
  if (error) throw error;
  return path;
}

export async function attachVideoStoragePath(sessionId: string, path: string): Promise<void> {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { error } = await supabase.from('sessions').update({ video_storage_path: path }).eq('id', sessionId);
  if (error) throw error;
}

/** Kicks off the GitHub Actions worker via a Supabase Edge Function that holds the GitHub credential server-side. */
export async function triggerServerProcessing(sessionId: string, drillId: string): Promise<void> {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { error } = await supabase.functions.invoke('trigger-lap-processing', { body: { sessionId, drillId } });
  if (error) throw error;
}

export async function attachSessionNotes(sessionId: string, notes: string): Promise<void> {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { error } = await supabase.from('sessions').update({ notes: notes.trim() || null }).eq('id', sessionId);
  if (error) throw error;
}

/**
 * Best-effort: marks a session row failed when the upload/trigger sequence
 * breaks on the client before the GitHub workflow (which owns this same
 * transition on success/failure server-side) ever starts. Without this, a
 * trigger call that fails before reaching GitHub would leave the row stuck
 * on 'queued' forever with nothing to ever flip it to 'error'.
 */
export async function markSessionError(sessionId: string, message: string): Promise<void> {
  if (!supabase) return;
  await supabase.from('sessions').update({ status: 'error', error_message: message }).eq('id', sessionId);
}

export async function loadSavedSessions(): Promise<SavedSession[]> {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase
    .from('sessions')
    .select('id,date,bike_id,drill_id,setup_variant_id,video_saved,notes,status,error_message,laps(lap_number,time,timestamp_in_video)')
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
    status: session.status,
    errorMessage: session.error_message ?? undefined,
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
