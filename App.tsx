import { StatusBar } from 'expo-status-bar';
import { useFonts, TitilliumWeb_700Bold } from '@expo-google-fonts/titillium-web';
import { ShareTechMono_400Regular } from '@expo-google-fonts/share-tech-mono';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect, useRef, useState } from 'react';
import {
  Dimensions,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LineChart } from './src/components/LineChart';
import { HomeScreenV2 } from './src/screens/HomeScreenV2';
import { NativeCameraTimer } from './src/screens/NativeCameraTimer';
import { DrillsScreen } from './src/screens/DrillsScreen';
import { DrillDetailScreen } from './src/screens/DrillDetailScreen';
import { SessionDetailScreen } from './src/screens/SessionDetailScreen';
import { SessionLogScreen } from './src/screens/SessionLogScreen';
import { ProgressionScreen, DrillProgressScreen } from './src/screens/ProgressionScreen';
import { bikes, drills } from './src/data/seed';
import { formatLap } from './src/lib/metrics';
import { NativeVideoPreview } from './src/components/NativeVideoPreview';
import {
  attachSessionNotes,
  attachVideoStoragePath,
  createId,
  createPendingSession,
  deleteSavedSession,
  isSupabaseConfigured,
  loadSavedSessions,
  markSessionError,
  triggerServerProcessing,
  uploadSessionVideo,
} from './src/lib/supabase';
import { colors, fonts, radius, shadows, spacing, tracking } from './src/theme';
import type { Bike, Drill, Lap, ProcessingJob, Route, Session, SessionDraft, SetupVariant } from './src/types';

const routeTitles: Record<Route['name'], string> = {
  home: 'Apex Lab',
  drills: 'Drills',
  drill: 'Drill',
  camera: 'Camera Timer',
  summary: 'Session Complete',
  sessions: 'Sessions',
  session: 'Session',
  progress: 'Progress',
  drillProgress: 'Drill Progress',
};


SplashScreen.preventAutoHideAsync().catch(() => {});

function createJobId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `job-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export default function App() {
  const [fontsLoaded] = useFonts({ TitilliumWeb_700Bold, ShareTechMono_400Regular });
  const [route, setRoute] = useState<Route>({ name: 'home' });
  const [currentBikeId] = useState(bikes.find((bike) => bike.isCurrent)?.id ?? bikes[0].id);
  const currentBike = bikes.find((bike) => bike.id === currentBikeId) ?? bikes[0];
  const [jobs, setJobs] = useState<ProcessingJob[]>([]);
  const [toast, setToast] = useState<{ message: string; isError: boolean } | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showToast(message: string, isError: boolean) {
    setToast({ message, isError });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 4500);
  }

  function updateJob(id: string, patch: Partial<ProcessingJob>) {
    setJobs((prev) => prev.map((job) => (job.id === id ? { ...job, ...patch } : job)));
  }

  function requestBackgroundSave(id: string, notes: string) {
    updateJob(id, { saveRequested: true, notes });
  }

  function discardJob(id: string) {
    setJobs((prev) => {
      const job = prev.find((item) => item.id === id);
      if (job?.draft.videoUri) URL.revokeObjectURL(job.draft.videoUri);
      return prev.filter((item) => item.id !== id);
    });
  }

  function go(next: Route) {
    if (next.name === 'summary' && next.draft?.needsProcessing && next.draft.videoUri) {
      const draft = next.draft;
      const alreadyTracked = jobs.some((job) => job.draft.startedAt === draft.startedAt);
      if (!alreadyTracked) {
        setJobs((prev) => [
          ...prev,
          {
            id: createJobId(),
            drillId: next.drillId,
            draft,
            status: 'uploading',
            notes: '',
            saveRequested: false,
            saveStatus: 'idle',
          },
        ]);
      }
    }
    setRoute(next);
  }

  function back() {
    if (route.name === 'home') return;
    if ('returnTo' in route && route.returnTo) return setRoute(route.returnTo);
    setRoute(parentRoute(route));
  }

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  const isLegacyScreen = route.name === 'camera' || route.name === 'summary';

  return (
    <SafeAreaView style={[styles.screen, !isLegacyScreen && styles.screenDark]}>
      <StatusBar style={isLegacyScreen ? 'dark' : 'light'} />
      {isLegacyScreen && (
        <View style={styles.topBar}>
          <Pressable onPress={back} style={styles.backButton}>
            <Text style={styles.backText}>←</Text>
          </Pressable>
          <Text style={styles.topBarTitle}>{routeTitles[route.name]}</Text>
        </View>
      )}

      {route.name === 'home' && (
        <HomeScreenV2
          currentBikeId={currentBikeId}
          onOpenDrills={() => go({ name: 'drills' })}
          onOpenDrill={(id) => go({ name: 'drill', drillId: id, returnTo: { name: 'home' } })}
          onOpenSession={(session) => go({ name: 'session', sessionId: session.id, session, returnTo: { name: 'home' } })}
          onOpenSessions={() => go({ name: 'sessions' })}
          onOpenProgress={() => go({ name: 'progress' })}
          go={go}
        />
      )}
      {route.name === 'drills' && <DrillsScreen currentBikeId={currentBikeId} go={go} />}
      {route.name === 'drill' && <DrillDetailScreen drillId={route.drillId} currentBikeId={currentBikeId} onBack={back} go={go} />}
      {route.name === 'camera' && <CameraScreen drillId={route.drillId} currentBike={currentBike} go={go} />}
      {route.name === 'summary' && (
        <SessionSummaryScreen
          drillId={route.drillId}
          currentBike={currentBike}
          draft={route.draft}
          job={route.draft ? jobs.find((job) => job.draft.startedAt === route.draft!.startedAt) : undefined}
          onRequestBackgroundSave={requestBackgroundSave}
          onDiscardJob={discardJob}
          go={go}
        />
      )}
      {route.name === 'sessions' && <SessionLogScreen currentBikeId={currentBikeId} go={go} />}
      {route.name === 'session' && (
        <SessionDetailScreen sessionId={route.sessionId} cloudSession={route.session} currentBikeId={currentBikeId} onBack={back} go={go} />
      )}
      {route.name === 'progress' && <ProgressionScreen currentBikeId={currentBikeId} go={go} />}
      {route.name === 'drillProgress' && (
        <DrillProgressScreen context={route.context} currentBikeId={currentBikeId} onBack={back} go={go} />
      )}

      {jobs.map((job) => (
        <JobRunner key={job.id} job={job} onUpdate={updateJob} onToast={showToast} />
      ))}
      {toast && (
        <View style={[styles.toast, toast.isError && styles.toastError]}>
          <Text style={styles.toastText}>{toast.message}</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

/**
 * Owns one recording's lap detection from start to (optionally) save,
 * mounted at the App level so it keeps running no matter which screen the
 * rider navigates to — only Discard tears it down (see discardJob in App).
 */
function JobRunner({
  job,
  onUpdate,
  onToast,
}: {
  job: ProcessingJob;
  onUpdate: (id: string, patch: Partial<ProcessingJob>) => void;
  onToast: (message: string, isError: boolean) => void;
}) {
  const startedRef = useRef(false);
  const drill = drills.find((item) => item.id === job.drillId) ?? drills[0];

  // Lap detection happens out-of-process now (server/, triggered via GitHub
  // Actions) — this just gets the video staged and the job triggered, then
  // hands off. Results show up later via loadSavedSessions() on Sessions.
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    if (!job.draft.videoUri) {
      onUpdate(job.id, { status: 'error', errorMessage: 'No video was recorded for this run.' });
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(job.draft.videoUri!);
        const blob = await response.blob();
        const sessionId = createId();
        await createPendingSession(sessionId, job.draft);
        if (cancelled) return;
        onUpdate(job.id, { sessionId });
        const storagePath = await uploadSessionVideo(sessionId, blob);
        if (cancelled) return;
        await attachVideoStoragePath(sessionId, storagePath);
        await triggerServerProcessing(sessionId, job.drillId);
        if (cancelled) return;
        onUpdate(job.id, { status: 'queued' });
      } catch (error) {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : 'Could not upload this recording.';
        onUpdate(job.id, { status: 'error', errorMessage: message });
        if (job.sessionId) void markSessionError(job.sessionId, message);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The rider may tap "Save Session" before the upload/trigger sequence above
  // finishes — attach notes once a session row actually exists to attach them to.
  useEffect(() => {
    if (!job.saveRequested || job.saveStatus !== 'idle') return;
    if (job.status === 'error') {
      onUpdate(job.id, { saveStatus: 'error', saveError: job.errorMessage });
      onToast(`Could not upload "${drill.name}" for processing.`, true);
      return;
    }
    if (!job.sessionId) return;
    onUpdate(job.id, { saveStatus: 'saving' });
    attachSessionNotes(job.sessionId, job.notes)
      .then(() => {
        onUpdate(job.id, { saveStatus: 'saved' });
        onToast(`${drill.name} saved — processing in the background.`, false);
      })
      .catch((error) => {
        onUpdate(job.id, {
          saveStatus: 'error',
          saveError: error instanceof Error ? error.message : 'Could not save the session.',
        });
        onToast(`Could not save "${drill.name}".`, true);
      });
  }, [job.status, job.saveRequested, job.saveStatus, job.sessionId]);

  return null;
}

function parentRoute(route: Route): Route {
  switch (route.name) {
    case 'drill':
      return { name: 'drills' };
    case 'camera':
    case 'summary':
      return { name: 'drill', drillId: route.drillId };
    case 'session':
      return { name: 'sessions' };
    case 'drillProgress':
      return { name: 'progress' };
    case 'drills':
    case 'sessions':
    case 'progress':
    default:
      return { name: 'home' };
  }
}

function CameraScreen({ drillId, currentBike, go }: { drillId: string; currentBike: Bike; go: (route: Route) => void }) {
  const drill = drills.find((item) => item.id === drillId) ?? drills[0];
  const setup = drill.setupVariants.find((variant) => variant.id === drill.defaultSetupVariantId) ?? drill.setupVariants[0];

  return (
    <NativeCameraTimer
      drill={drill}
      setup={setup}
      currentBike={currentBike}
      onSessionComplete={(draft) => go({ name: 'summary', drillId, draft, returnTo: { name: 'drill', drillId } })}
      onCancel={() => go({ name: 'drill', drillId })}
    />
  );
}

function SessionSummaryScreen({
  drillId,
  currentBike,
  draft,
  job,
  onRequestBackgroundSave,
  onDiscardJob,
  go,
}: {
  drillId: string;
  currentBike: Bike;
  draft?: SessionDraft;
  job?: ProcessingJob;
  onRequestBackgroundSave: (jobId: string, notes: string) => void;
  onDiscardJob: (jobId: string) => void;
  go: (route: Route) => void;
}) {
  const drill = drills.find((item) => item.id === drillId) ?? drills[0];
  const setupId = draft?.setupVariantId ?? drill.defaultSetupVariantId;
  const setup = drill.setupVariants.find((variant) => variant.id === setupId) ?? drill.setupVariants[0];
  const mockLaps: Lap[] = [15.62, 15.1, 14.82, 15.02, 14.94].map((time, index) => ({ lapNumber: index + 1, time }));
  const [notes, setNotes] = useState('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // Lap detection now happens server-side (see JobRunner in App.tsx) — this
  // screen no longer waits to show laps; it just confirms the upload and
  // hands off. Results show up later in the Sessions list.
  const isUploading = job?.status === 'uploading';
  const effectiveSaveStatus: 'idle' | 'saving' | 'saved' | 'error' = saveStatus !== 'idle' ? saveStatus : job?.saveStatus ?? 'idle';
  const effectiveSaveMessage =
    saveMessage ??
    (job?.saveStatus === 'saved'
      ? 'Saved — processing on the server. Check Sessions later for your laps.'
      : job?.saveStatus === 'error'
        ? job.saveError ?? 'Could not save the session.'
        : null);
  const mockTimes = mockLaps.map((lap) => lap.time);
  const mockBest = mockTimes.length ? Math.min(...mockTimes) : undefined;

  async function saveRecordedSession() {
    if (effectiveSaveStatus === 'saved') {
      go({ name: 'sessions' });
      return;
    }
    if (!draft || !job) {
      go({ name: 'sessions' });
      return;
    }
    if (!isSupabaseConfigured) {
      setSaveStatus('error');
      setSaveMessage('Supabase is not configured for this build.');
      return;
    }
    // The upload+trigger sequence (JobRunner) may still be in flight — hand
    // off notes and leave now; JobRunner attaches them once a session row exists.
    onRequestBackgroundSave(job.id, notes);
    go({ name: 'sessions' });
  }

  function discardAndLeave() {
    if (job) onDiscardJob(job.id);
    go({ name: 'drill', drillId });
  }

  return (
    <Page title="Session Complete" subtitle={`${drill.name} · ${setup.name} · ${currentBike.name}`}>
      {draft ? (
        <View style={styles.resultHero}>
          <Text style={styles.resultLabel}>Recorded Session</Text>
          <Text style={styles.resultValue}>{isUploading ? 'Uploading...' : job?.status === 'error' ? 'Upload failed' : 'Processing'}</Text>
          <Text style={styles.resultSub}>
            {isUploading
              ? 'Sending your video for processing...'
              : job?.status === 'error'
                ? job.errorMessage ?? 'Could not upload this recording.'
                : "Your laps are being found on the server — check Sessions later, you don't need to keep this open."}
          </Text>
        </View>
      ) : (
        <View style={styles.resultHero}>
          <Text style={styles.resultLabel}>New Best</Text>
          <Text style={styles.resultValue}>{mockBest ? `${formatLap(mockBest)}s` : '--'}</Text>
          <Text style={styles.resultSub}>{mockLaps.length} timed laps</Text>
        </View>
      )}

      {!draft && (
        <>
          <Section label="Lap Flow">
            <LineChart values={mockTimes} height={130} />
          </Section>
          <Section label="Lap Times">
            <LapList laps={mockLaps} />
          </Section>
        </>
      )}

      <Section label="Video">
        {job?.status === 'error' && (
          <Text style={[styles.bodyText, styles.saveMessageError]}>Could not upload this recording for processing. The video is still available below.</Text>
        )}
        {draft?.videoUri ? (
          <NativeVideoPreview
            uri={draft.videoUri}
            drillName={drill.name}
            durationSeconds={draft.videoDurationSeconds}
          />
        ) : (
          <Text style={styles.bodyText}>{'Saved · placeholder recording attached to this mock session.'}</Text>
        )}
        {draft?.videoUri && (
          <Text style={styles.bodyText}>
            {draft.videoSaved
              ? 'Auto-saved to the "Bike Training" album in your camera roll.'
              : 'Could not save to your camera roll — check camera roll permission in Settings.'}
          </Text>
        )}
        {draft?.recordingStopReason === 'maxDuration' && <Text style={styles.cameraTip}>Recording stopped at the 8-minute limit.</Text>}
      </Section>

      <Section label="Notes">
        <TextInput
          style={styles.noteInput}
          multiline
          placeholder="What did you notice?"
          placeholderTextColor={colors.silverDark}
          value={notes}
          onChangeText={setNotes}
        />
      </Section>

      {effectiveSaveMessage && (
        <Text style={[styles.saveMessage, effectiveSaveStatus === 'error' && styles.saveMessageError]}>{effectiveSaveMessage}</Text>
      )}

      <PrimaryButton
        label={
          effectiveSaveStatus === 'saving'
            ? 'Saving...'
            : effectiveSaveStatus === 'saved'
              ? 'View Sessions'
              : isUploading
                ? 'Save & Finish Uploading'
                : 'Save Session'
        }
        onPress={() => void saveRecordedSession()}
      />
      <Pressable style={styles.discardButton} onPress={discardAndLeave}>
        <Text style={styles.discardText}>Discard</Text>
      </Pressable>
    </Page>
  );
}

function Page({ children, title, subtitle }: { children: React.ReactNode; title?: string; subtitle?: string }) {
  return (
    <ScrollView contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>
      {title && (
        <View style={styles.pageHeader}>
          <Text style={styles.pageTitle}>{title}</Text>
          {subtitle && <Text style={styles.pageSubtitle}>{subtitle}</Text>}
        </View>
      )}
      {children}
    </ScrollView>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{label}</Text>
      {children}
    </View>
  );
}

function PrimaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.primaryButton}>
      <Text style={styles.primaryButtonText}>{label}</Text>
    </Pressable>
  );
}

function SecondaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.secondaryButton}>
      <Text style={styles.secondaryButtonText}>{label}</Text>
    </Pressable>
  );
}

function BulletList({ items, accent }: { items: string[]; accent?: boolean }) {
  return (
    <View style={styles.list}>
      {items.map((item) => (
        <View key={item} style={styles.listRow}>
          <Text style={[styles.bullet, accent && styles.bulletAccent]}>•</Text>
          <Text style={styles.bodyText}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

function NumberedList({ items }: { items: string[] }) {
  return (
    <View style={styles.list}>
      {items.map((item, index) => (
        <View key={item} style={styles.listRow}>
          <Text style={styles.number}>{index + 1}</Text>
          <Text style={styles.bodyText}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

function StatGrid({ items }: { items: [string, string][] }) {
  return (
    <View style={styles.statGrid}>
      {items.map(([label, value]) => (
        <MetricMini key={label} label={label} value={value} />
      ))}
    </View>
  );
}

function MetricMini({ label, value }: { label: string; value: string }) {
  const isBest = label === 'Best' || label === 'Best Stop' || label === 'Best Score' || label === 'Latest Best';
  return (
    <View style={styles.statMini}>
      <Text style={[styles.statMiniValue, isBest && styles.statMiniValueBest]}>{value}</Text>
      <Text style={styles.statMiniLabel}>{label}</Text>
    </View>
  );
}

const lapTagLabels: Record<'warmup' | 'cooldown' | 'break', string> = {
  warmup: 'Warm-up',
  cooldown: 'Cool-down',
  break: 'Break',
};

function LapList({ laps, isStraightLine }: { laps: Lap[]; isStraightLine?: boolean }) {
  const scoredTimes = laps.filter((lap) => !lap.excludedFromScoring).map((lap) => lap.time);
  const best = scoredTimes.length ? Math.min(...scoredTimes) : undefined;
  const avg = scoredTimes.length ? scoredTimes.reduce((sum, t) => sum + t, 0) / scoredTimes.length : undefined;

  if (isStraightLine) {
    const scores = laps.map((r) => r.brakingScoreG).filter((v): v is number => v != null);
    const bestScore = scores.length ? Math.max(...scores) : undefined;
    const avgScore = scores.length ? scores.reduce((sum, v) => sum + v, 0) / scores.length : undefined;
    return (
      <View style={styles.lapList}>
        {laps.map((rep) => {
          const isPB = rep.brakingScoreG != null && rep.brakingScoreG === bestScore;
          const isImproving = !isPB && !rep.stopOffScreen && rep.brakingScoreG != null && avgScore != null && rep.brakingScoreG > avgScore;
          const isCaution = !isPB && Boolean(rep.stopOffScreen);
          const accent = isPB ? styles.lapTextBest : isImproving ? styles.lapTextImproving : isCaution ? styles.lapTextCaution : undefined;
          const speedStr = rep.entrySpeedKph != null
            ? `${rep.speedMethod === 'kinematic' ? '~' : ''}${rep.entrySpeedKph.toFixed(0)} km/h`
            : '--';
          const stopStr = rep.stoppingDistanceMeters != null
            ? `${rep.stopOffScreen ? '>' : ''}${rep.stoppingDistanceMeters.toFixed(1)} m`
            : '--';
          const scoreStr = rep.brakingScoreG != null
            ? `${rep.stopOffScreen ? '<' : ''}${rep.brakingScoreG.toFixed(2)}g`
            : '--';
          return (
            <View key={rep.lapNumber} style={[styles.lapRow, isPB && styles.lapRowBest]}>
              <Text style={[styles.lapNum, isPB && styles.lapTextBest]}>R{rep.lapNumber}</Text>
              <Text style={[styles.lapTime, accent]}>{`↓ ${speedStr}`}</Text>
              <Text style={[styles.lapTime, accent]}>{`◀ ${stopStr}`}</Text>
              <Text style={[styles.lapTime, accent]}>{scoreStr}</Text>
              {isPB && <Text style={styles.pbText}>PB</Text>}
            </View>
          );
        })}
      </View>
    );
  }

  return (
    <View style={styles.lapList}>
      {laps.map((lap) => {
        const isBest = !lap.excludedFromScoring && lap.time === best;
        const isImproving = !isBest && !lap.excludedFromScoring && avg != null && lap.time < avg;
        const isCaution = !isBest && Boolean(lap.excludedFromScoring);
        const accent = isBest ? styles.lapTextBest : isImproving ? styles.lapTextImproving : isCaution ? styles.lapTextCaution : undefined;
        const tag = lap.lapLabel ? lapTagLabels[lap.lapLabel] : undefined;
        return (
          <View key={lap.lapNumber} style={[styles.lapRow, isBest && styles.lapRowBest]}>
            <Text style={[styles.lapNum, isBest && styles.lapTextBest]}>L{lap.lapNumber}</Text>
            <Text style={[styles.lapTime, accent]}>{formatLap(lap.time)}</Text>
            {lap.entrySpeedKph != null && <Text style={styles.lapSpeed}>{lap.entrySpeedKph.toFixed(0)} km/h</Text>}
            {isBest && <Text style={styles.pbText}>PB</Text>}
            {tag && <Text style={styles.lapTag}>{tag}</Text>}
          </View>
        );
      })}
    </View>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.cardSub}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.silver,
    flex: 1,
  },
  screenDark: {
    backgroundColor: colors.ink950,
  },
  toast: {
    backgroundColor: colors.charcoal,
    borderRadius: radius.md,
    bottom: 20,
    left: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    position: 'absolute',
    right: 16,
  },
  toastError: {
    backgroundColor: colors.red,
  },
  toastText: {
    color: colors.white,
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: '700',
  },
  videoPreviewWrapper: {
    position: 'relative',
  },
  lapFlashOverlay: {
    backgroundColor: colors.green,
    borderRadius: radius.pill,
    paddingHorizontal: 16,
    paddingVertical: 8,
    position: 'absolute',
    right: 12,
    top: 12,
  },
  lapFlashText: {
    color: colors.white,
    fontFamily: fonts.display,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: tracking.wide,
    textTransform: 'uppercase',
  },
  page: {
    paddingHorizontal: spacing.pageX,
    paddingBottom: spacing.pageBottom,
    paddingTop: 18,
  },
  topBar: {
    alignItems: 'center',
    backgroundColor: colors.white,
    borderBottomColor: colors.silverMid,
    borderBottomWidth: 1,
    flexDirection: 'row',
    minHeight: 54,
    paddingHorizontal: 12,
  },
  backButton: {
    alignItems: 'center',
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  backText: {
    color: colors.charcoal,
    fontFamily: fonts.display,
    fontSize: 24,
    fontWeight: '800',
  },
  topBarTitle: {
    color: colors.charcoal,
    fontFamily: fonts.display,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: tracking.wide,
    textTransform: 'uppercase',
  },
  pageHeader: {
    marginBottom: 18,
  },
  pageTitle: {
    color: colors.charcoal,
    fontFamily: fonts.display,
    fontSize: 40,
    fontWeight: '800',
    letterSpacing: tracking.hero,
    lineHeight: 42,
    textTransform: 'uppercase',
  },
  pageSubtitle: {
    color: colors.silverDark,
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 8,
  },
  section: {
    marginBottom: 20,
  },
  sectionLabel: {
    borderBottomColor: colors.silverMid,
    borderBottomWidth: 1,
    color: colors.silverDark,
    fontFamily: fonts.display,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: tracking.wide,
    marginBottom: 12,
    paddingBottom: 8,
    textTransform: 'uppercase',
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: colors.red,
    borderRadius: radius.pill,
    marginBottom: 20,
    minHeight: 54,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  primaryButtonText: {
    color: colors.white,
    fontFamily: fonts.display,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: tracking.wide,
    textTransform: 'uppercase',
  },
  secondaryButton: {
    alignItems: 'center',
    borderColor: colors.charcoal,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    flex: 1,
    minHeight: 50,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  secondaryButtonText: {
    color: colors.charcoal,
    fontFamily: fonts.display,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: tracking.wide,
    textTransform: 'uppercase',
  },
  twoCol: {
    flexDirection: 'row',
    gap: 10,
  },
  drillGrid: {
    gap: 14,
  },
  cardTitle: {
    color: colors.charcoal,
    fontFamily: fonts.display,
    fontSize: 20,
    fontWeight: '800',
  },
  cardSub: {
    color: colors.silverDark,
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 19,
  },
  cardBottomRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  metricText: {
    color: colors.charcoal,
    fontFamily: fonts.mono,
    fontSize: 13,
    fontVariant: ['tabular-nums'],
    fontWeight: '800',
  },
  contextPill: {
    alignSelf: 'flex-start',
    backgroundColor: colors.charcoal,
    borderRadius: radius.pill,
    marginBottom: 18,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  contextPillText: {
    color: colors.white,
    fontFamily: fonts.display,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: tracking.wide,
    textTransform: 'uppercase',
  },
  bodyText: {
    color: colors.charcoal,
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 23,
  },
  list: {
    gap: 10,
    marginTop: 10,
  },
  listRow: {
    flexDirection: 'row',
    gap: 10,
  },
  bullet: {
    color: colors.charcoal,
    fontFamily: fonts.display,
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 23,
  },
  bulletAccent: {
    color: colors.red,
  },
  number: {
    color: colors.red,
    fontFamily: fonts.mono,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 23,
    minWidth: 18,
  },
  videoPlaceholder: {
    alignItems: 'center',
    backgroundColor: colors.charcoal,
    borderRadius: radius.md,
    minHeight: 150,
    justifyContent: 'center',
    padding: 18,
  },
  placeholderTitle: {
    color: colors.white,
    fontFamily: fonts.display,
    fontSize: 18,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  placeholderText: {
    color: colors.silverMid,
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 8,
    textAlign: 'center',
  },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 18,
  },
  statMini: {
    backgroundColor: colors.white,
    borderColor: colors.silverMid,
    borderRadius: radius.md,
    borderWidth: 1,
    boxShadow: shadows.tight,
    flexGrow: 1,
    minWidth: '45%',
    padding: 14,
  },
  statMiniValue: {
    color: colors.charcoal,
    fontFamily: fonts.mono,
    fontSize: 19,
    fontVariant: ['tabular-nums'],
    fontWeight: '800',
  },
  statMiniValueBest: {
    color: colors.pbBest,
  },
  statMiniLabel: {
    color: colors.silverDark,
    fontFamily: fonts.display,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: tracking.wide,
    marginTop: 5,
    textTransform: 'uppercase',
  },
  cameraShell: {
    backgroundColor: colors.charcoal,
    borderRadius: radius.md,
    marginBottom: 18,
    padding: 12,
  },
  recRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  recText: {
    color: colors.red,
    fontFamily: fonts.display,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: tracking.wide,
    textTransform: 'uppercase',
  },
  cameraView: {
    backgroundColor: colors.black,
    borderColor: colors.silverDark,
    borderRadius: radius.sm,
    borderWidth: 1,
    height: 310,
    overflow: 'hidden',
    position: 'relative',
  },
  cameraViewWide: {
    height: Math.round(Dimensions.get('window').height * 0.62),
  },
  timingZoneBox: {
    backgroundColor: 'rgba(230, 51, 42, 0.12)',
    borderColor: 'rgba(255, 255, 255, 0.7)',
    borderWidth: 1,
    position: 'absolute',
  },
  timingLineVertical: {
    backgroundColor: colors.red,
    bottom: 0,
    left: '50%',
    opacity: 0.95,
    position: 'absolute',
    top: 0,
    width: 5,
  },
  timingLineHorizontal: {
    backgroundColor: colors.red,
    left: 0,
    opacity: 0.95,
    position: 'absolute',
    right: 0,
    top: '50%',
    height: 5,
  },
  slOverlay: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  slApproachZone: {
    backgroundColor: 'rgba(40, 120, 255, 0.10)',
    bottom: 0,
    left: 0,
    position: 'absolute',
    top: 0,
    width: '50%',
  },
  slStopZone: {
    backgroundColor: 'rgba(255, 90, 0, 0.10)',
    bottom: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    width: '50%',
  },
  slBand: {
    borderBottomWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    borderTopWidth: 1,
    left: 0,
    position: 'absolute',
    right: 0,
  },
  slConeLine: {
    backgroundColor: 'rgba(255, 200, 0, 0.90)',
    bottom: 0,
    left: '50%',
    marginLeft: -1,
    position: 'absolute',
    top: 0,
    width: 2,
  },
  slLabelWrap: {
    position: 'absolute',
  },
  slLabel: {
    color: 'rgba(255,255,255,0.95)',
    fontFamily: fonts.display,
    fontSize: 13,
    fontWeight: '700',
  },
  slLabelSub: {
    color: 'rgba(255,255,255,0.60)',
    fontFamily: fonts.body,
    fontSize: 10,
    marginTop: 1,
  },
  slConeLabel: {
    left: '50%',
    marginLeft: 6,
    position: 'absolute',
    top: '10%',
  },
  slConeLabelText: {
    color: 'rgba(255,200,0,0.95)',
    fontFamily: fonts.display,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  slNote: {
    backgroundColor: 'rgba(0,0,0,0.45)',
    bottom: 0,
    left: 0,
    paddingHorizontal: 8,
    paddingVertical: 4,
    position: 'absolute',
    right: 0,
  },
  slNoteText: {
    color: 'rgba(255,255,255,0.75)',
    fontFamily: fonts.body,
    fontSize: 10,
    textAlign: 'center',
  },
  cameraOverlay: {
    color: colors.white,
    fontFamily: fonts.display,
    fontSize: 26,
    fontWeight: '800',
    left: 18,
    position: 'absolute',
    textTransform: 'uppercase',
    top: 22,
  },
  cameraTip: {
    color: colors.silverMid,
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 12,
  },
  videoSaveRow: {
    alignItems: 'center',
    backgroundColor: colors.white,
    borderColor: colors.silverMid,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    marginTop: 12,
    padding: 14,
  },
  videoSaveCopy: {
    flex: 1,
    gap: 4,
    paddingRight: 12,
  },
  resultHero: {
    alignItems: 'center',
    backgroundColor: colors.charcoal,
    borderRadius: radius.md,
    boxShadow: shadows.panel,
    marginBottom: 20,
    padding: 22,
  },
  resultLabel: {
    color: colors.pbBest,
    fontFamily: fonts.display,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: tracking.wide,
    textTransform: 'uppercase',
  },
  resultValue: {
    color: colors.white,
    fontFamily: fonts.mono,
    fontSize: 52,
    fontVariant: ['tabular-nums'],
    fontWeight: '800',
    letterSpacing: tracking.tightNum,
    lineHeight: 62,
  },
  resultSub: {
    color: colors.silverMid,
    fontFamily: fonts.body,
    fontSize: 13,
  },
  noteInput: {
    backgroundColor: colors.white,
    borderColor: colors.silverMid,
    borderRadius: radius.md,
    borderWidth: 1,
    color: colors.charcoal,
    fontFamily: fonts.body,
    fontSize: 15,
    minHeight: 96,
    padding: 14,
    textAlignVertical: 'top',
  },
  singleLineInput: {
    backgroundColor: colors.white,
    borderColor: colors.silverMid,
    borderRadius: radius.md,
    borderWidth: 1,
    color: colors.charcoal,
    fontFamily: fonts.body,
    fontSize: 15,
    marginBottom: 12,
    marginTop: 12,
    minHeight: 48,
    paddingHorizontal: 14,
  },
  saveMessage: {
    color: colors.charcoal,
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 12,
  },
  saveMessageError: {
    color: colors.red,
    fontFamily: fonts.display,
    fontWeight: '800',
  },
  discardButton: {
    alignItems: 'center',
    padding: 16,
  },
  discardText: {
    color: colors.silverDark,
    fontFamily: fonts.display,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: tracking.wide,
    textTransform: 'uppercase',
  },
  sessionDeleteButton: {
    alignItems: 'center',
    marginTop: 18,
    padding: 16,
  },
  sessionDeleteText: {
    color: colors.red,
    fontFamily: fonts.display,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: tracking.wide,
    textTransform: 'uppercase',
  },
  deleteConfirm: {
    borderColor: colors.red,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: 10,
    marginTop: 18,
    padding: 16,
  },
  deleteConfirmTitle: {
    color: colors.charcoal,
    fontFamily: fonts.display,
    fontSize: 18,
    fontWeight: '800',
  },
  deleteActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  deleteCancelButton: {
    alignItems: 'center',
    borderColor: colors.charcoal,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    flex: 1,
    justifyContent: 'center',
    minHeight: 50,
    paddingHorizontal: 12,
  },
  deleteConfirmButton: {
    alignItems: 'center',
    backgroundColor: colors.red,
    borderRadius: radius.pill,
    flex: 1.4,
    justifyContent: 'center',
    minHeight: 50,
    paddingHorizontal: 12,
  },
  lapList: {
    gap: 8,
  },
  lapRow: {
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: radius.sm,
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  lapRowBest: {
    backgroundColor: colors.charcoal,
  },
  lapNum: {
    color: colors.silverDark,
    fontFamily: fonts.display,
    fontSize: 11,
    fontWeight: '800',
    width: 34,
  },
  lapTime: {
    color: colors.charcoal,
    flex: 1,
    fontFamily: fonts.mono,
    fontSize: 16,
    fontVariant: ['tabular-nums'],
    fontWeight: '800',
  },
  lapTextBest: {
    color: colors.white,
  },
  lapTextImproving: {
    color: colors.improving,
  },
  lapTextCaution: {
    color: colors.caution,
  },
  pbText: {
    color: colors.pbBest,
    fontFamily: fonts.display,
    fontSize: 11,
    fontWeight: '800',
  },
  lapTag: {
    color: colors.silverDark,
    fontFamily: fonts.display,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  lapSpeed: {
    color: colors.silverDark,
    fontFamily: fonts.mono,
    fontSize: 13,
    fontVariant: ['tabular-nums'],
    fontWeight: '600',
  },
  emptyState: {
    backgroundColor: colors.white,
    borderColor: colors.silverMid,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: 8,
    padding: 18,
  },
});
