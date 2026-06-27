import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ViewStyle,
} from 'react-native';
import { DrillDiagram } from './src/components/DrillDiagram';
import { LineChart } from './src/components/LineChart';
import { HomeScreenV2 } from './src/screens/HomeScreenV2';
import { bikes, drills, sessions } from './src/data/seed';
import {
  averageLap,
  bestLap,
  contextKey,
  formatDate,
  formatLap,
  getSetupName,
  lapSpread,
  latestSession,
  sessionsForContext,
} from './src/lib/metrics';
import { detectLapsFromVideo, type LapDetectionDiagnostics } from './src/lib/lapDetector';
import { getDetectionConfigForDrill } from './src/lib/detection';
import { computeCropRectRatio } from './src/lib/detection/geometry';
import {
  CAMERA_MEDIA_CONSTRAINTS,
  formatFileSize,
  getMediaRecorderOptions,
  MAX_RECORDING_DURATION_MS,
} from './src/lib/recording';
import { shareOrDownloadVideo } from './src/lib/localVideo';
import { deleteSavedSession, isSupabaseConfigured, loadSavedSessions, saveSessionDraft, uploadDebugReport } from './src/lib/supabase';
import { colors, fonts, radius, spacing } from './src/theme';
import type { Bike, DetectionEvent, Drill, Lap, ProgressContext, Session, SessionDraft, SetupVariant } from './src/types';

type ReturnRoute =
  | { name: 'home' }
  | { name: 'drills' }
  | { name: 'drill'; drillId: string }
  | { name: 'sessions' }
  | { name: 'session'; sessionId: string; session?: Session }
  | { name: 'progress' }
  | { name: 'drillProgress'; context: ProgressContext };

type Route =
  | { name: 'home' }
  | { name: 'drills' }
  | { name: 'drill'; drillId: string; returnTo?: ReturnRoute }
  | { name: 'camera'; drillId: string; returnTo?: ReturnRoute }
  | { name: 'summary'; drillId: string; draft?: SessionDraft; returnTo?: ReturnRoute }
  | { name: 'sessions' }
  | { name: 'session'; sessionId: string; session?: Session; returnTo?: ReturnRoute }
  | { name: 'progress' }
  | { name: 'drillProgress'; context: ProgressContext; returnTo?: ReturnRoute };

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


function isDebugReprocessMode() {
  return typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('debug') === 'reprocess';
}

export default function App() {
  const [route, setRoute] = useState<Route>({ name: 'home' });
  const [currentBikeId] = useState(bikes.find((bike) => bike.isCurrent)?.id ?? bikes[0].id);
  const currentBike = bikes.find((bike) => bike.id === currentBikeId) ?? bikes[0];

  function go(next: Route) {
    setRoute(next);
  }

  function back() {
    if (route.name === 'home') return;
    if ('returnTo' in route && route.returnTo) return setRoute(route.returnTo);
    setRoute(parentRoute(route));
  }

  if (isDebugReprocessMode()) {
    return (
      <SafeAreaView style={styles.screen}>
        <StatusBar style="dark" />
        <DebugReprocessScreen />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="dark" />
      {route.name !== 'home' && (
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
        />
      )}
      {route.name === 'drills' && <DrillsScreen currentBikeId={currentBikeId} go={go} />}
      {route.name === 'drill' && <DrillDetailScreen drillId={route.drillId} go={go} />}
      {route.name === 'camera' && <CameraScreen drillId={route.drillId} currentBike={currentBike} go={go} />}
      {route.name === 'summary' && <SessionSummaryScreen drillId={route.drillId} currentBike={currentBike} draft={route.draft} go={go} />}
      {route.name === 'sessions' && <SessionsScreen go={go} />}
      {route.name === 'session' && <SessionDetailScreen sessionId={route.sessionId} cloudSession={route.session} go={go} />}
      {route.name === 'progress' && <ProgressScreen currentBikeId={currentBikeId} go={go} />}
      {route.name === 'drillProgress' && <DrillProgressScreen context={route.context} go={go} />}
    </SafeAreaView>
  );
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



function DrillsScreen({ currentBikeId, go }: { currentBikeId: string; go: (route: Route) => void }) {
  return (
    <Page title="Drills" subtitle="Choose the setup you want to practice.">
      <View style={styles.drillGrid}>
        {drills.map((drill) => {
          const setup = drill.setupVariants.find((variant) => variant.id === drill.defaultSetupVariantId);
          const contextSessions = sessionsForContext(sessions, {
            bikeId: currentBikeId,
            drillId: drill.id,
            setupVariantId: drill.defaultSetupVariantId,
          });
          const latest = latestSession(contextSessions);
          const best = contextSessions.length ? Math.min(...contextSessions.map(bestLap)) : undefined;
          return (
            <Pressable key={drill.id} style={styles.drillLibraryCard} onPress={() => go({ name: 'drill', drillId: drill.id, returnTo: { name: 'drills' } })}>
              <Text style={styles.drillCardTitle}>{drill.name}</Text>
              <DrillDiagram type={drill.diagramKey} compact />
              <View style={styles.cardBottomRow}>
                <Text style={styles.metricText}>Best: {formatLap(best)}s</Text>
                <Text style={styles.metricText}>Last: {latest ? formatDate(latest.date, true) : 'Not yet'}</Text>
              </View>
              <Text style={styles.cardSub}>{setup?.name}</Text>
            </Pressable>
          );
        })}
      </View>
    </Page>
  );
}

function DrillDetailScreen({ drillId, go }: { drillId: string; go: (route: Route) => void }) {
  const drill = drills.find((item) => item.id === drillId) ?? drills[0];
  const setup = drill.setupVariants.find((variant) => variant.id === drill.defaultSetupVariantId) ?? drill.setupVariants[0];

  return (
    <Page title={drill.name} subtitle={drill.shortDescription}>
      <View style={styles.contextPill}>
        <Text style={styles.contextPillText}>{setup.name}</Text>
      </View>

      <Section label="What This Trains">
        <Text style={styles.bodyText}>{drill.whyItMatters}</Text>
        <BulletList items={drill.whatThisTrains} />
      </Section>

      <Section label="Setup">
        <View style={styles.drillSetupDiagram}>
          <DrillDiagram type={drill.diagramKey} variant="detail" />
        </View>
      </Section>

      <Section label="How To Ride It">
        <NumberedList items={drill.howToRideSteps} />
      </Section>

      <Section label="Coach Notes">
        <BulletList items={drill.coachingCues} accent />
      </Section>

      <Section label="Common Mistakes">
        <BulletList items={drill.commonMistakes} />
      </Section>

      <Section label="Progression">
        {drill.progressions.map((progression) => (
          <View key={progression.title} style={styles.progressionBlock}>
            <Text style={styles.progressionTitle}>{progression.title}</Text>
            <Text style={styles.bodyText}>{progression.description}</Text>
            <Text style={styles.smallLabel}>
              {progression.comparisonType === 'newSetupVariant' ? 'New setup variant' : 'Same timing context'}
            </Text>
          </View>
        ))}
      </Section>

      <PrimaryButton label="Start Recording" onPress={() => go({ name: 'camera', drillId, returnTo: { name: 'drill', drillId } })} />
    </Page>
  );
}

function CameraScreen({ drillId, currentBike, go }: { drillId: string; currentBike: Bike; go: (route: Route) => void }) {
  const drill = drills.find((item) => item.id === drillId) ?? drills[0];
  const setup = drill.setupVariants.find((variant) => variant.id === drill.defaultSetupVariantId) ?? drill.setupVariants[0];

  if (Platform.OS !== 'web') {
    return (
      <Page title="Camera Timer" subtitle={`${drill.name} · ${setup.name}`}>
        <View style={styles.cameraShell}>
          <View style={styles.cameraView}>
            <Text style={styles.cameraOverlay}>Web Only V1</Text>
          </View>
          <Text style={styles.cameraTip}>Camera timer v1 is built for iPhone Safari. Open the HTTPS web URL on your phone to test recording and lap detection.</Text>
        </View>
        <PrimaryButton label="Back To Drill" onPress={() => go({ name: 'drill', drillId })} />
      </Page>
    );
  }

  return <WebCameraTimer drill={drill} setup={setup} currentBike={currentBike} go={go} />;
}

function WebCameraTimer({
  drill,
  setup,
  currentBike,
  go,
}: {
  drill: Drill;
  setup: SetupVariant;
  currentBike: Bike;
  go: (route: Route) => void;
}) {
  const detection = getDetectionConfigForDrill(drill.id);
  const cropRatio = computeCropRectRatio(detection);
  const toPercent = (value: number) => `${(value * 100).toFixed(2)}%` as `${number}%`;
  const zoneBoxStyle: ViewStyle = {
    left: toPercent(cropRatio.left),
    top: toPercent(cropRatio.top),
    width: toPercent(cropRatio.width),
    height: toPercent(cropRatio.height),
  };
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const maxDurationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingStartedAtRef = useRef<string>(new Date().toISOString());
  const recordingStartPerformanceRef = useRef(0);
  const recordingStopReasonRef = useRef<'user' | 'maxDuration'>('user');
  const wakeLockRef = useRef<{ release: () => Promise<void> } | null>(null);
  const shouldRouteOnStopRef = useRef(false);

  const [cameraState, setCameraState] = useState<'loading' | 'ready' | 'recording' | 'error'>('loading');
  const [cameraMessage, setCameraMessage] = useState('Requesting camera permission...');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  function clearMaxDurationTimer() {
    if (maxDurationTimerRef.current) {
      clearTimeout(maxDurationTimerRef.current);
      maxDurationTimerRef.current = null;
    }
  }

  function stopElapsedTimer() {
    if (elapsedTimerRef.current) {
      clearInterval(elapsedTimerRef.current);
      elapsedTimerRef.current = null;
    }
  }

  async function releaseWakeLock() {
    const wakeLock = wakeLockRef.current;
    wakeLockRef.current = null;
    if (wakeLock) {
      try {
        await wakeLock.release();
      } catch {
        // The browser may already have revoked it.
      }
    }
  }

  function stopCameraTracks() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }

  function cleanupCamera() {
    stopElapsedTimer();
    clearMaxDurationTimer();
    void releaseWakeLock();
    stopCameraTracks();
  }

  async function startCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraState('error');
      setCameraMessage('This browser does not support camera access.');
      return;
    }

    try {
      setCameraState('loading');
      setCameraMessage('Requesting camera permission...');
      const stream = await navigator.mediaDevices.getUserMedia(CAMERA_MEDIA_CONSTRAINTS);
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraState('ready');
      setCameraMessage(drill.cameraPlacement.detectionZoneSuggestion);
    } catch (error) {
      setCameraState('error');
      setCameraMessage(error instanceof Error ? error.message : 'Camera permission was not granted.');
    }
  }

  async function requestWakeLock() {
    const webNavigator = navigator as Navigator & { wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> } };
    if (!webNavigator.wakeLock) return;
    try {
      wakeLockRef.current = await webNavigator.wakeLock.request('screen');
    } catch {
      wakeLockRef.current = null;
    }
  }

  function buildDraft(reason: 'user' | 'maxDuration', videoBlob?: Blob): SessionDraft {
    const videoUri = videoBlob && videoBlob.size > 0 ? URL.createObjectURL(videoBlob) : undefined;
    const videoDurationSeconds = recordingStartPerformanceRef.current
      ? Math.max(0, (performance.now() - recordingStartPerformanceRef.current) / 1000)
      : 0;
    return {
      drillId: drill.id,
      setupVariantId: setup.id,
      bikeId: currentBike.id,
      laps: [],
      videoUri,
      videoSaved: Boolean(videoUri),
      videoSizeBytes: videoBlob?.size,
      videoDurationSeconds,
      recordingStopReason: reason,
      startedAt: recordingStartedAtRef.current,
      endedAt: new Date().toISOString(),
      detectionEvents: [],
      needsProcessing: Boolean(videoUri),
    };
  }

  function startMediaRecorder() {
    recordingStartedAtRef.current = new Date().toISOString();
    recordingStartPerformanceRef.current = performance.now();
    chunksRef.current = [];
    recordingStopReasonRef.current = 'user';
    setElapsedSeconds(0);
    elapsedTimerRef.current = setInterval(() => {
      setElapsedSeconds(Math.floor((performance.now() - recordingStartPerformanceRef.current) / 1000));
    }, 250);

    if (!streamRef.current || !('MediaRecorder' in window)) {
      setCameraState('recording');
      setCameraMessage('Recording without video support — laps cannot be detected for this run.');
      return;
    }

    try {
      const recorder = new MediaRecorder(streamRef.current, getMediaRecorderOptions());
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        clearMaxDurationTimer();
        const blobType = recorder.mimeType || chunksRef.current[0]?.type || 'video/mp4';
        const videoBlob = new Blob(chunksRef.current, { type: blobType });
        const draft = buildDraft(recordingStopReasonRef.current, videoBlob);
        cleanupCamera();
        recorderRef.current = null;
        if (shouldRouteOnStopRef.current) {
          shouldRouteOnStopRef.current = false;
          go({ name: 'summary', drillId: drill.id, draft, returnTo: { name: 'drill', drillId: drill.id } });
        }
      };
      recorder.start(1000);
      maxDurationTimerRef.current = setTimeout(() => endRecording('maxDuration'), MAX_RECORDING_DURATION_MS);
      setCameraState('recording');
      setCameraMessage('Recording. Ride your laps, then End Session.');
    } catch (error) {
      recorderRef.current = null;
      setCameraState('recording');
      setCameraMessage(error instanceof Error ? `Recording without video: ${error.message}` : 'Recording without video.');
    }
  }

  async function startRecording() {
    if (!streamRef.current) {
      await startCamera();
      if (!streamRef.current) return;
    }
    void requestWakeLock();
    startMediaRecorder();
  }

  function endRecording(reason: 'user' | 'maxDuration' = 'user') {
    recordingStopReasonRef.current = reason;
    shouldRouteOnStopRef.current = true;
    stopElapsedTimer();
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
      return;
    }
    const draft = buildDraft(reason);
    cleanupCamera();
    go({ name: 'summary', drillId: drill.id, draft, returnTo: { name: 'drill', drillId: drill.id } });
  }

  useEffect(() => {
    void startCamera();
    return () => {
      shouldRouteOnStopRef.current = false;
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        recorderRef.current.onstop = null;
        recorderRef.current.stop();
      }
      cleanupCamera();
    };
  }, []);

  const elapsedLabel = `${Math.floor(elapsedSeconds / 60)
    .toString()
    .padStart(2, '0')}:${(elapsedSeconds % 60).toString().padStart(2, '0')}`;

  return (
    <Page title="Camera Timer" subtitle={`${drill.name} · ${setup.name}`}>
      <View style={styles.cameraShell}>
        <View style={styles.recRow}>
          <Text style={styles.recText}>{cameraState === 'recording' ? 'REC' : 'Aim Camera'}</Text>
          <Text style={styles.recText}>{cameraState === 'recording' ? elapsedLabel : ''}</Text>
        </View>
        <View style={styles.cameraView}>
          {React.createElement('video', {
            ref: videoRef,
            autoPlay: true,
            muted: true,
            playsInline: true,
            style: {
              height: '100%',
              left: 0,
              objectFit: 'cover',
              position: 'absolute',
              top: 0,
              width: '100%',
            },
          })}
          <View style={[styles.timingZoneBox, zoneBoxStyle]}>
            <View style={detection.orientation === 'vertical' ? styles.timingLineVertical : styles.timingLineHorizontal} />
          </View>
          {cameraState !== 'ready' && cameraState !== 'recording' && <Text style={styles.cameraOverlay}>{cameraState === 'error' ? 'Camera Error' : 'Loading'}</Text>}
        </View>
        <Text style={styles.cameraTip}>{cameraMessage}</Text>
      </View>
      {cameraState === 'error' && <SecondaryButton label="Retry Camera" onPress={() => void startCamera()} />}
      {cameraState === 'recording' ? (
        <PrimaryButton label="End Session" onPress={() => endRecording('user')} />
      ) : (
        <PrimaryButton label="Start Recording" onPress={() => void startRecording()} />
      )}
    </Page>
  );
}

function SessionSummaryScreen({
  drillId,
  currentBike,
  draft,
  go,
}: {
  drillId: string;
  currentBike: Bike;
  draft?: SessionDraft;
  go: (route: Route) => void;
}) {
  const drill = drills.find((item) => item.id === drillId) ?? drills[0];
  const setupId = draft?.setupVariantId ?? drill.defaultSetupVariantId;
  const setup = drill.setupVariants.find((variant) => variant.id === setupId) ?? drill.setupVariants[0];
  const mockLaps: Lap[] = [15.62, 15.1, 14.82, 15.02, 14.94].map((time, index) => ({ lapNumber: index + 1, time }));
  const [notes, setNotes] = useState('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [localVideoStatus, setLocalVideoStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [localVideoMessage, setLocalVideoMessage] = useState<string | null>(null);
  const [processingStatus, setProcessingStatus] = useState<'idle' | 'processing' | 'done' | 'error'>(
    draft?.needsProcessing ? 'processing' : 'idle',
  );
  const [resolvedLaps, setResolvedLaps] = useState<Lap[]>(draft?.laps ?? []);
  const [resolvedEvents, setResolvedEvents] = useState<DetectionEvent[]>(draft?.detectionEvents ?? []);
  const [diagnostics, setDiagnostics] = useState<LapDetectionDiagnostics | null>(null);
  const [debugUploadStatus, setDebugUploadStatus] = useState<'idle' | 'uploading' | 'uploaded' | 'error'>('idle');
  const [debugUploadError, setDebugUploadError] = useState<string | null>(null);
  const previewVideoRef = useRef<HTMLVideoElement | null>(null);

  const isProcessing = processingStatus === 'processing';
  const summaryLaps = draft ? resolvedLaps : mockLaps;
  const times = summaryLaps.map((lap) => lap.time);
  const best = times.length ? Math.min(...times) : undefined;
  const avg = times.length ? times.reduce((sum, lap) => sum + lap, 0) / times.length : undefined;
  const spread = times.length ? Math.max(...times) - Math.min(...times) : undefined;
  const firstPassTime = resolvedEvents.find((event) => event.eventType === 'sessionStart')?.videoTimestamp;

  useEffect(() => {
    return () => {
      if (draft?.videoUri) URL.revokeObjectURL(draft.videoUri);
    };
  }, [draft?.videoUri]);

  useEffect(() => {
    if (!draft?.needsProcessing || !draft.videoUri) return;
    let cancelled = false;
    setProcessingStatus('processing');
    detectLapsFromVideo(draft.videoUri, {
      detection: getDetectionConfigForDrill(drill.id),
      detectionsPerLap: drill.timingRule.detectionsPerLap ?? 1,
      recordingStartedAt: draft.startedAt,
    })
      .then((result) => {
        if (cancelled) return;
        setResolvedLaps(result.laps);
        setResolvedEvents(result.detectionEvents);
        setDiagnostics(result.diagnostics);
        setProcessingStatus('done');
        setDebugUploadStatus('uploading');
        uploadDebugReport({
          drillId: draft.drillId,
          startedAt: draft.startedAt,
          payload: { laps: result.laps, detectionEvents: result.detectionEvents, diagnostics: result.diagnostics },
        }).then((uploadResult) => {
          if (cancelled) return;
          setDebugUploadStatus(uploadResult.ok ? 'uploaded' : 'error');
          setDebugUploadError(uploadResult.ok ? null : uploadResult.error ?? 'Unknown error.');
        });
      })
      .catch(() => {
        if (cancelled) return;
        setProcessingStatus('error');
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft?.videoUri]);

  useEffect(() => {
    if (processingStatus === 'done' && firstPassTime !== undefined && previewVideoRef.current) {
      previewVideoRef.current.currentTime = Math.max(0, firstPassTime - 5);
    }
  }, [processingStatus, firstPassTime]);

  async function saveVideoToDevice() {
    if (!draft?.videoUri) return;
    try {
      setLocalVideoStatus('saving');
      setLocalVideoMessage(null);
      const response = await fetch(draft.videoUri);
      const blob = await response.blob();
      const extension = blob.type.includes('webm') ? 'webm' : 'mp4';
      const filename = `apex-lab-${drill.id}-${draft.startedAt.replace(/[:.]/g, '-')}.${extension}`;
      const result = await shareOrDownloadVideo(blob, filename);
      if (result === 'shared' || result === 'downloaded') {
        setLocalVideoStatus('saved');
        setLocalVideoMessage(result === 'shared' ? 'Video shared to your device.' : 'Video downloaded to your device.');
      } else if (result === 'cancelled') {
        setLocalVideoStatus('idle');
        setLocalVideoMessage(null);
      } else {
        setLocalVideoStatus('error');
        setLocalVideoMessage('Your browser does not support saving video to this device.');
      }
    } catch (error) {
      setLocalVideoStatus('error');
      setLocalVideoMessage(error instanceof Error ? error.message : 'Could not save the video.');
    }
  }

  function downloadDebugReport() {
    if (!diagnostics || !draft) return;
    const payload = {
      drillId: draft.drillId,
      startedAt: draft.startedAt,
      laps: resolvedLaps,
      detectionEvents: resolvedEvents,
      diagnostics,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `apex-lab-debug-${draft.drillId}-${draft.startedAt.replace(/[:.]/g, '-')}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function saveRecordedSession() {
    if (saveStatus === 'saved') {
      go({ name: 'sessions' });
      return;
    }
    if (!draft) {
      go({ name: 'sessions' });
      return;
    }
    if (isProcessing) return;
    if (!isSupabaseConfigured) {
      setSaveStatus('error');
      setSaveMessage('Supabase is not configured for this build.');
      return;
    }
    try {
      setSaveStatus('saving');
      setSaveMessage('Saving session...');
      const result = await saveSessionDraft(
        { ...draft, laps: resolvedLaps, detectionEvents: resolvedEvents },
        notes,
        localVideoStatus === 'saved',
      );
      setSaveStatus('saved');
      setSaveMessage(result.videoSaved ? 'Session and laps saved. Video kept on your device.' : 'Session and laps saved.');
    } catch (error) {
      setSaveStatus('error');
      setSaveMessage(error instanceof Error ? error.message : 'Could not save the session.');
    }
  }

  return (
    <Page title="Session Complete" subtitle={`${drill.name} · ${setup.name} · ${currentBike.name}`}>
      <View style={styles.resultHero}>
        <Text style={styles.resultLabel}>{draft ? 'Recorded Session' : 'New Best'}</Text>
        <Text style={styles.resultValue}>{isProcessing ? '--' : best ? `${formatLap(best)}s` : '--'}</Text>
        <Text style={styles.resultSub}>
          {isProcessing
            ? 'Finding your laps...'
            : summaryLaps.length
              ? `${summaryLaps.length} timed lap${summaryLaps.length === 1 ? '' : 's'}`
              : 'No complete laps were detected for this run.'}
        </Text>
      </View>

      {(isProcessing || summaryLaps.length > 0) && (
        <Section label="Lap Flow">
          {isProcessing ? <Text style={styles.bodyText}>Analyzing the recording for laps...</Text> : <LineChart values={times} height={130} />}
        </Section>
      )}

      <StatGrid
        items={[
          ['Average', isProcessing ? '...' : avg ? `${formatLap(avg)}s` : '--'],
          ['Laps', isProcessing ? '...' : String(summaryLaps.length)],
          ['Spread', isProcessing ? '...' : spread ? `${formatLap(spread)}s` : '--'],
        ]}
      />

      <Section label="Lap Times">
        {isProcessing ? (
          <Text style={styles.bodyText}>Finding your laps...</Text>
        ) : summaryLaps.length ? (
          <LapList laps={summaryLaps} />
        ) : (
          <EmptyState title="No laps yet" body="Try another pass through the timing line after the timer starts." />
        )}
      </Section>

      <Section label="Video">
        {processingStatus === 'error' && (
          <Text style={[styles.bodyText, styles.saveMessageError]}>Could not analyze this recording for laps. The video is still available below.</Text>
        )}
        {draft?.videoUri && Platform.OS === 'web' ? (
          React.createElement('video', {
            ref: previewVideoRef,
            src: draft.videoUri,
            controls: true,
            playsInline: true,
            style: {
              backgroundColor: colors.black,
              borderRadius: radius.md,
              display: 'block',
              width: '100%',
            },
          })
        ) : (
          <Text style={styles.bodyText}>{draft ? 'Video was not recorded for this run.' : 'Saved · placeholder recording attached to this mock session.'}</Text>
        )}
        {draft?.videoUri && (
          <>
            <View style={styles.videoSaveRow}>
              <View style={styles.videoSaveCopy}>
                <Text style={styles.cardTitle}>{localVideoStatus === 'saved' ? 'Saved to your device' : 'This app does not store video'}</Text>
                <Text style={styles.cardSub}>
                  {draft.videoSizeBytes !== undefined ? formatFileSize(draft.videoSizeBytes) : 'Size unavailable'}
                  {draft.videoDurationSeconds !== undefined ? ` · ${Math.round(draft.videoDurationSeconds)}s` : ''}
                </Text>
              </View>
              <SecondaryButton
                label={localVideoStatus === 'saving' ? 'Saving...' : localVideoStatus === 'saved' ? 'Saved' : 'Save Video to Device'}
                onPress={() => void saveVideoToDevice()}
              />
            </View>
            {localVideoMessage && (
              <Text style={[styles.saveMessage, localVideoStatus === 'error' && styles.saveMessageError]}>{localVideoMessage}</Text>
            )}
            {draft.recordingStopReason === 'maxDuration' && <Text style={styles.cameraTip}>Recording stopped at the 8-minute limit.</Text>}
          </>
        )}
        {diagnostics && (
          <>
            <View style={styles.videoSaveRow}>
              <View style={styles.videoSaveCopy}>
                <Text style={styles.cardTitle}>Debug Data</Text>
                <Text style={styles.cardSub}>
                  {diagnostics.frameCount} frames · max ratio {diagnostics.maxPrimaryRatio.toFixed(3)} / {diagnostics.maxSecondaryRatio.toFixed(3)} (threshold {diagnostics.config.changedRatioThreshold})
                </Text>
              </View>
              <SecondaryButton label="Export Debug Data" onPress={downloadDebugReport} />
            </View>
            <Text style={[styles.saveMessage, debugUploadStatus === 'error' && styles.saveMessageError]}>
              {debugUploadStatus === 'uploading'
                ? 'Uploading debug report to Supabase...'
                : debugUploadStatus === 'uploaded'
                  ? 'Debug report uploaded to Supabase.'
                  : debugUploadStatus === 'error'
                    ? `Debug report upload failed: ${debugUploadError}`
                    : ''}
            </Text>
          </>
        )}
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

      {saveMessage && <Text style={[styles.saveMessage, saveStatus === 'error' && styles.saveMessageError]}>{saveMessage}</Text>}

      <PrimaryButton
        label={isProcessing ? 'Finding laps...' : saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'View Sessions' : 'Save Session'}
        onPress={() => void saveRecordedSession()}
      />
      <Pressable style={styles.discardButton} onPress={() => go({ name: 'drill', drillId })}>
        <Text style={styles.discardText}>Discard</Text>
      </Pressable>
    </Page>
  );
}

/**
 * Dev-only tool (visit ?debug=reprocess): runs detectLapsFromVideo against a
 * video file picked from disk instead of a fresh recording, so the detector
 * can be iterated on against the same real clip without re-riding each time.
 */
function DebugReprocessScreen() {
  const [selectedDrillId, setSelectedDrillId] = useState(drills[0]?.id ?? 'circle');
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'processing' | 'done' | 'error'>('idle');
  const [laps, setLaps] = useState<Lap[]>([]);
  const [events, setEvents] = useState<DetectionEvent[]>([]);
  const [diagnostics, setDiagnostics] = useState<LapDetectionDiagnostics | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'uploaded' | 'error'>('idle');
  const [uploadError, setUploadError] = useState<string | null>(null);

  const drill = drills.find((item) => item.id === selectedDrillId) ?? drills[0];
  const times = laps.map((lap) => lap.time);
  const best = times.length ? Math.min(...times) : undefined;

  // Lets a headless/automated run load a video by URL instead of through the
  // file picker, e.g. ?debug=reprocess&videoUrl=http://localhost:PORT/clip.mp4&drill=circle&autorun=1
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const videoUrlParam = params.get('videoUrl');
    const drillParam = params.get('drill');
    const autorun = params.get('autorun') === '1';
    if (drillParam) setSelectedDrillId(drillParam);
    if (!videoUrlParam) return;

    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(videoUrlParam);
        const blob = await response.blob();
        if (cancelled) return;
        const uri = URL.createObjectURL(blob);
        setVideoUri(uri);
        setFileName(videoUrlParam.split('/').pop() ?? 'video');
        if (autorun) await runDetection(uri, drillParam ?? undefined);
      } catch (error) {
        if (cancelled) return;
        setStatus('error');
        setErrorMessage(error instanceof Error ? error.message : 'Could not load video from URL.');
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleFileChange(event: { target: { files?: FileList | null } }) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (videoUri) URL.revokeObjectURL(videoUri);
    setVideoUri(URL.createObjectURL(file));
    setFileName(file.name);
    setStatus('idle');
    setLaps([]);
    setEvents([]);
    setDiagnostics(null);
    setErrorMessage(null);
    setUploadStatus('idle');
  }

  async function runDetection(overrideUri?: string, overrideDrillId?: string) {
    const uri = overrideUri ?? videoUri;
    if (!uri) return;
    const targetDrill = drills.find((item) => item.id === (overrideDrillId ?? selectedDrillId)) ?? drills[0];
    setStatus('processing');
    setErrorMessage(null);
    try {
      const result = await detectLapsFromVideo(uri, {
        detection: getDetectionConfigForDrill(targetDrill.id),
        detectionsPerLap: targetDrill.timingRule.detectionsPerLap ?? 1,
        recordingStartedAt: new Date().toISOString(),
      });
      setLaps(result.laps);
      setEvents(result.detectionEvents);
      setDiagnostics(result.diagnostics);
      setStatus('done');
      setUploadStatus('uploading');
      const uploadResult = await uploadDebugReport({
        drillId: targetDrill.id,
        startedAt: new Date().toISOString(),
        payload: { source: 'manual-reprocess', fileName, laps: result.laps, detectionEvents: result.detectionEvents, diagnostics: result.diagnostics },
      });
      setUploadStatus(uploadResult.ok ? 'uploaded' : 'error');
      setUploadError(uploadResult.ok ? null : uploadResult.error ?? 'Unknown error.');
    } catch (error) {
      setStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Could not process this video.');
    }
  }

  function downloadReport() {
    if (!diagnostics) return;
    const payload = { drillId: drill.id, fileName, laps, detectionEvents: events, diagnostics };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `apex-lab-reprocess-${drill.id}-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <Page title="Debug: Reprocess Video" subtitle="Re-run the detector against a saved clip without re-recording.">
      <Section label="Drill">
        <View style={styles.drillGrid}>
          {drills.map((item) => (
            <Pressable key={item.id} style={styles.contextPill} onPress={() => setSelectedDrillId(item.id)}>
              <Text style={styles.contextPillText}>{item.name}{item.id === selectedDrillId ? ' (selected)' : ''}</Text>
            </Pressable>
          ))}
        </View>
      </Section>

      <Section label="Video File">
        {Platform.OS === 'web' &&
          React.createElement('input', {
            type: 'file',
            accept: 'video/*',
            onChange: handleFileChange,
          })}
        {fileName && <Text style={styles.bodyText}>{fileName}</Text>}
        {videoUri && Platform.OS === 'web' && (
          React.createElement('video', {
            src: videoUri,
            controls: true,
            playsInline: true,
            style: { backgroundColor: colors.black, borderRadius: radius.md, display: 'block', marginTop: 12, width: '100%' },
          })
        )}
      </Section>

      <PrimaryButton label={status === 'processing' ? 'Processing...' : 'Run Detection'} onPress={() => void runDetection()} />
      {status === 'error' && <Text style={[styles.saveMessage, styles.saveMessageError]}>{errorMessage}</Text>}

      {status === 'done' && diagnostics && (
        <>
          <StatGrid
            items={[
              ['Best', best ? `${formatLap(best)}s` : '--'],
              ['Laps', String(laps.length)],
              ['Frames', String(diagnostics.frameCount)],
            ]}
          />
          <Section label="Lap Times">
            {laps.length ? <LapList laps={laps} /> : <EmptyState title="No laps detected" body="The detector found no confirmed crossings in this clip." />}
          </Section>
          <Section label="Debug Data">
            <Text style={styles.cardSub}>
              max ratio {diagnostics.maxPrimaryRatio.toFixed(3)} / {diagnostics.maxSecondaryRatio.toFixed(3)} (threshold {diagnostics.config.changedRatioThreshold}) ·{' '}
              {diagnostics.candidates.length} candidates
            </Text>
            <SecondaryButton label="Export Debug Data" onPress={downloadReport} />
            {uploadStatus !== 'idle' && (
              <Text style={[styles.saveMessage, uploadStatus === 'error' && styles.saveMessageError]}>
                {uploadStatus === 'uploading' ? 'Uploading debug report to Supabase...' : uploadStatus === 'uploaded' ? 'Debug report uploaded to Supabase.' : `Upload failed: ${uploadError}`}
              </Text>
            )}
          </Section>
        </>
      )}
    </Page>
  );
}

function SessionsScreen({ go }: { go: (route: Route) => void }) {
  const [cloudSessions, setCloudSessions] = useState<Session[] | null>(null);
  const [cloudError, setCloudError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!isSupabaseConfigured) {
      setCloudSessions([]);
      return () => {
        active = false;
      };
    }
    void loadSavedSessions()
      .then((saved) => {
        if (active) setCloudSessions(saved);
      })
      .catch((error) => {
        if (active) {
          setCloudSessions([]);
          setCloudError(error instanceof Error ? error.message : 'Could not load saved sessions.');
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const visibleSessions = isSupabaseConfigured ? cloudSessions ?? [] : sessions;
  const groups = useMemo(() => {
    const byDate: Record<string, Session[]> = {};
    for (const session of visibleSessions) {
      const key = new Date(session.date).toISOString().slice(0, 10);
      byDate[key] = [...(byDate[key] ?? []), session];
    }
    return Object.entries(byDate)
      .sort(([a], [b]) => new Date(b).getTime() - new Date(a).getTime())
      .map(([date, group]) => ({ date, sessions: group.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()) }));
  }, [visibleSessions]);

  return (
    <Page title="Sessions" subtitle="Review your practice history.">
      {cloudSessions === null && <Text style={styles.dateSummary}>Loading saved sessions...</Text>}
      {cloudError && <Text style={[styles.saveMessage, styles.saveMessageError]}>{cloudError}</Text>}
      {cloudSessions !== null && groups.length === 0 && <EmptyState title="No sessions yet" body="Record and save a drill session to start your training log." />}
      {groups.map((group) => {
        const lapCount = group.sessions.reduce((sum, session) => sum + session.laps.length, 0);
        return (
          <Section key={group.date} label={formatDate(group.date)}>
            <Text style={styles.dateSummary}>{group.sessions.length} session{group.sessions.length === 1 ? '' : 's'} · {lapCount} laps</Text>
            {group.sessions.map((session) => (
              <SessionCard key={session.id} session={session} onPress={() => go({ name: 'session', sessionId: session.id, session, returnTo: { name: 'sessions' } })} />
            ))}
          </Section>
        );
      })}
    </Page>
  );
}

function SessionDetailScreen({ sessionId, cloudSession, go }: { sessionId: string; cloudSession?: Session; go: (route: Route) => void }) {
  const session = cloudSession ?? sessions.find((item) => item.id === sessionId) ?? sessions[0];
  const drill = drills.find((item) => item.id === session.drillId) ?? drills[0];
  const bike = bikes.find((item) => item.id === session.bikeId) ?? bikes[0];
  const setup = getSetupName(drill, session.setupVariantId);
  const best = bestLap(session);
  const avg = averageLap(session);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteState, setDeleteState] = useState<'idle' | 'deleting' | 'error'>('idle');
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function deleteSession() {
    try {
      setDeleteState('deleting');
      setDeleteError(null);
      await deleteSavedSession(session.id);
      go({ name: 'sessions' });
    } catch (error) {
      setDeleteState('error');
      setDeleteError(error instanceof Error ? error.message : 'Could not delete the session.');
    }
  }

  return (
    <Page title={drill.name} subtitle={`${setup} · ${bike.name} · ${formatDate(session.date)}`}>
      <StatGrid
        items={[
          ['Best', `${formatLap(best)}s`],
          ['Average', `${formatLap(avg)}s`],
          ['Laps', String(session.laps.length)],
          ['Spread', `${formatLap(lapSpread(session))}s`],
        ]}
      />
      <Section label="Video">
        <View style={styles.videoPlaceholder}>
          <Text style={styles.placeholderTitle}>{session.videoSaved ? 'Saved to your device' : 'No video saved'}</Text>
          <Text style={styles.placeholderText}>
            {session.videoSaved
              ? 'This app does not keep a copy — find the recording in your phone’s Photos or Files app.'
              : 'This session does not include a recording.'}
          </Text>
        </View>
      </Section>
      <Section label="Lap Times">
        <LapList laps={session.laps} />
      </Section>
      <Section label="Notes">
        <Text style={styles.bodyText}>{session.notes ?? 'No notes saved.'}</Text>
        {session.conditions && <Text style={styles.bodyText}>Conditions: {session.conditions}</Text>}
      </Section>
      <View style={styles.twoCol}>
        <SecondaryButton label="View Drill" onPress={() => go({ name: 'drill', drillId: drill.id, returnTo: { name: 'session', sessionId: session.id, session } })} />
        <SecondaryButton
          label="View Progress"
          onPress={() =>
            go({
              name: 'drillProgress',
              context: { bikeId: bike.id, drillId: drill.id, setupVariantId: session.setupVariantId },
              returnTo: { name: 'session', sessionId: session.id, session },
            })
          }
        />
      </View>
      {cloudSession && !confirmDelete && (
        <Pressable style={styles.sessionDeleteButton} onPress={() => setConfirmDelete(true)}>
          <Text style={styles.sessionDeleteText}>Delete Session</Text>
        </Pressable>
      )}
      {cloudSession && confirmDelete && (
        <View style={styles.deleteConfirm}>
          <Text style={styles.deleteConfirmTitle}>Delete this session?</Text>
          <Text style={styles.cardSub}>Its lap data, detection events, notes, and video will be permanently removed.</Text>
          {deleteError && <Text style={[styles.saveMessage, styles.saveMessageError]}>{deleteError}</Text>}
          <View style={styles.deleteActions}>
            <Pressable style={styles.deleteCancelButton} onPress={() => setConfirmDelete(false)}>
              <Text style={styles.secondaryButtonText}>Cancel</Text>
            </Pressable>
            <Pressable style={styles.deleteConfirmButton} onPress={() => void deleteSession()}>
              <Text style={styles.primaryButtonText}>{deleteState === 'deleting' ? 'Deleting...' : 'Delete Permanently'}</Text>
            </Pressable>
          </View>
        </View>
      )}
    </Page>
  );
}

function hasTimedLaps(session: Session) {
  return session.laps.some((lap) => Number.isFinite(lap.time) && lap.time > 0);
}

function timedSessionsForContext(sessionData: Session[], context: ProgressContext) {
  return sessionsForContext(sessionData, context).filter(hasTimedLaps);
}

function useTrainingSessions() {
  const [trainingSessions, setTrainingSessions] = useState<Session[] | null>(isSupabaseConfigured ? null : sessions);
  const [trainingError, setTrainingError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!isSupabaseConfigured) {
      setTrainingSessions(sessions);
      setTrainingError(null);
      return () => {
        active = false;
      };
    }
    void loadSavedSessions()
      .then((saved) => {
        if (active) {
          setTrainingSessions(saved);
          setTrainingError(null);
        }
      })
      .catch((error) => {
        if (active) {
          setTrainingSessions([]);
          setTrainingError(error instanceof Error ? error.message : 'Could not load saved sessions.');
        }
      });
    return () => {
      active = false;
    };
  }, []);

  return { trainingSessions, trainingError };
}

function ProgressScreen({
  currentBikeId,
  go,
}: {
  currentBikeId: string;
  go: (route: Route) => void;
}) {
  const { trainingSessions, trainingError } = useTrainingSessions();
  const sessionData = trainingSessions ?? [];
  const contexts = useMemo(() => {
    const seen = new Set<string>();
    const rows: ProgressContext[] = [];
    for (const session of sessionData.filter((item) => item.bikeId === currentBikeId && hasTimedLaps(item))) {
      const context = { bikeId: session.bikeId, drillId: session.drillId, setupVariantId: session.setupVariantId };
      const key = contextKey(context);
      if (!seen.has(key)) {
        seen.add(key);
        rows.push(context);
      }
    }
    return rows;
  }, [currentBikeId, sessionData]);

  return (
    <Page title="Progress" subtitle="Track improvement by drill.">
      {trainingSessions === null && <Text style={styles.dateSummary}>Loading saved sessions...</Text>}
      {trainingError && <Text style={[styles.saveMessage, styles.saveMessageError]}>{trainingError}</Text>}
      {trainingSessions !== null && contexts.length === 0 ? (
        <EmptyState title="No progress yet" body="Record a session on this bike to build a trend." />
      ) : (
        contexts.map((context) => <ProgressCard key={contextKey(context)} context={context} sessionData={sessionData} go={go} />)
      )}
    </Page>
  );
}

function DrillProgressScreen({ context, go }: { context: ProgressContext; go: (route: Route) => void }) {
  const { trainingSessions, trainingError } = useTrainingSessions();
  const sessionData = trainingSessions ?? [];
  const drill = drills.find((item) => item.id === context.drillId) ?? drills[0];
  const bike = bikes.find((item) => item.id === context.bikeId) ?? bikes[0];
  const setup = getSetupName(drill, context.setupVariantId);
  const contextSessions = timedSessionsForContext(sessionData, context);
  const bestBySession = contextSessions.map(bestLap);
  const totalLaps = contextSessions.reduce((sum, session) => sum + session.laps.length, 0);
  const best = bestBySession.length ? Math.min(...bestBySession) : undefined;
  const latest = latestSession(contextSessions);

  return (
    <Page title={`${drill.name} Progress`} subtitle={`${bike.name} · ${setup}`}>
      {trainingSessions === null && <Text style={styles.dateSummary}>Loading saved sessions...</Text>}
      {trainingError && <Text style={[styles.saveMessage, styles.saveMessageError]}>{trainingError}</Text>}
      <Section label="Lap Time Over Time">
        {bestBySession.length > 1 ? (
          <LineChart values={bestBySession} height={150} />
        ) : (
          <EmptyState title="Not enough sessions" body="Record another timed session in this setup to build a trend." />
        )}
      </Section>
      <StatGrid
        items={[
          ['Best', `${formatLap(best)}s`],
          ['Latest Best', latest ? `${formatLap(bestLap(latest))}s` : '--'],
          ['Sessions', String(contextSessions.length)],
          ['Total Laps', String(totalLaps)],
        ]}
      />
      <Section label="Session History">
        {contextSessions.length === 0 ? (
          <EmptyState title="No timed sessions" body="This timing context does not have completed laps yet." />
        ) : (
          contextSessions
            .slice()
            .reverse()
            .map((session) => (
              <SessionCard key={session.id} session={session} onPress={() => go({ name: 'session', sessionId: session.id, session, returnTo: { name: 'drillProgress', context } })} />
            ))
        )}
      </Section>
    </Page>
  );
}

function ProgressCard({ context, sessionData, go }: { context: ProgressContext; sessionData: Session[]; go: (route: Route) => void }) {
  const drill = drills.find((item) => item.id === context.drillId) ?? drills[0];
  const setup = getSetupName(drill, context.setupVariantId);
  const contextSessions = timedSessionsForContext(sessionData, context);
  const bestBySession = contextSessions.map(bestLap);
  const latest = latestSession(contextSessions);
  const best = bestBySession.length ? Math.min(...bestBySession) : undefined;

  return (
    <Pressable style={styles.progressCard} onPress={() => go({ name: 'drillProgress', context, returnTo: { name: 'progress' } })}>
      <Text style={styles.cardTitle}>{drill.name}</Text>
      <Text style={styles.cardSub}>{setup}</Text>
      {bestBySession.length > 1 ? (
        <LineChart values={bestBySession} height={112} />
      ) : (
        <Text style={styles.cardSub}>Not enough sessions for a trend yet.</Text>
      )}
      <View style={styles.cardBottomRow}>
        <Text style={styles.metricText}>Best: {formatLap(best)}s</Text>
        <Text style={styles.metricText}>Latest: {latest ? `${formatLap(bestLap(latest))}s` : '--'}</Text>
      </View>
      <View style={styles.cardBottomRow}>
        <Text style={styles.cardSub}>{contextSessions.length} session{contextSessions.length === 1 ? '' : 's'}</Text>
        <Text style={styles.cardSub}>Last: {latest ? formatDate(latest.date, true) : 'Not yet'}</Text>
      </View>
    </Pressable>
  );
}


function SessionCard({ session, onPress }: { session: Session; onPress: () => void }) {
  const drill = drills.find((item) => item.id === session.drillId);
  const bike = bikes.find((item) => item.id === session.bikeId);
  const setup = getSetupName(drill, session.setupVariantId);
  return (
    <Pressable style={styles.sessionCard} onPress={onPress}>
      <Text style={styles.cardTag}>{formatDate(session.date)}</Text>
      <Text style={styles.cardTitle}>{drill?.name ?? session.drillId}</Text>
      <Text style={styles.cardSub}>{setup} · {bike?.name ?? session.bikeId}</Text>
      <View style={styles.cardBottomRow}>
        <Text style={styles.metricText}>Best {formatLap(bestLap(session))}s</Text>
        <Text style={styles.metricText}>Avg {formatLap(averageLap(session))}s</Text>
        <Text style={styles.metricText}>{session.laps.length} laps</Text>
      </View>
      <Text style={styles.cardSub}>{session.videoSaved ? 'Video' : 'No video'}{session.notes ? ' · Notes' : ''}</Text>
    </Pressable>
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
  return (
    <View style={styles.statMini}>
      <Text style={styles.statMiniValue}>{value}</Text>
      <Text style={styles.statMiniLabel}>{label}</Text>
    </View>
  );
}

function LapList({ laps }: { laps: { lapNumber: number; time: number }[] }) {
  const best = Math.min(...laps.map((lap) => lap.time));
  return (
    <View style={styles.lapList}>
      {laps.map((lap) => (
        <View key={lap.lapNumber} style={[styles.lapRow, lap.time === best && styles.lapRowBest]}>
          <Text style={[styles.lapNum, lap.time === best && styles.lapTextBest]}>L{lap.lapNumber}</Text>
          <Text style={[styles.lapTime, lap.time === best && styles.lapTextBest]}>{formatLap(lap.time)}</Text>
          {lap.time === best && <Text style={styles.pbText}>PB</Text>}
        </View>
      ))}
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
    letterSpacing: 1.7,
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
    letterSpacing: -0.4,
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
    letterSpacing: 1.8,
    marginBottom: 12,
    paddingBottom: 8,
    textTransform: 'uppercase',
  },
  drillSetupDiagram: {
    marginHorizontal: -16,
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
    letterSpacing: 1.3,
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
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  twoCol: {
    flexDirection: 'row',
    gap: 10,
  },
  drillGrid: {
    gap: 14,
  },
  drillLibraryCard: {
    backgroundColor: colors.white,
    borderColor: colors.silverMid,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: 12,
    padding: 16,
  },
  drillCardTitle: {
    color: colors.charcoal,
    fontFamily: fonts.display,
    fontSize: 25,
    fontWeight: '800',
  },
  sessionCard: {
    backgroundColor: colors.white,
    borderColor: colors.silverMid,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: 8,
    marginBottom: 10,
    padding: 16,
  },
  progressCard: {
    backgroundColor: colors.white,
    borderColor: colors.silverMid,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: 12,
    marginBottom: 14,
    padding: 16,
  },
  cardTag: {
    color: colors.silverDark,
    fontFamily: fonts.display,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
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
    letterSpacing: 1,
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
    flexGrow: 1,
    minWidth: '45%',
    padding: 14,
  },
  statMiniValue: {
    color: colors.charcoal,
    fontFamily: fonts.mono,
    fontSize: 19,
    fontWeight: '800',
  },
  statMiniLabel: {
    color: colors.silverDark,
    fontFamily: fonts.display,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginTop: 5,
    textTransform: 'uppercase',
  },
  progressionBlock: {
    backgroundColor: colors.white,
    borderColor: colors.silverMid,
    borderRadius: radius.md,
    borderWidth: 1,
    marginBottom: 10,
    padding: 14,
  },
  progressionTitle: {
    color: colors.charcoal,
    fontFamily: fonts.display,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 6,
  },
  smallLabel: {
    color: colors.red,
    fontFamily: fonts.display,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.1,
    marginTop: 8,
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
    letterSpacing: 1.2,
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
    marginBottom: 20,
    padding: 22,
  },
  resultLabel: {
    color: colors.red,
    fontFamily: fonts.display,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  resultValue: {
    color: colors.white,
    fontFamily: fonts.mono,
    fontSize: 52,
    fontWeight: '800',
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
    letterSpacing: 1.2,
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
    letterSpacing: 1.2,
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
    fontWeight: '800',
  },
  lapTextBest: {
    color: colors.white,
  },
  pbText: {
    color: colors.red,
    fontFamily: fonts.display,
    fontSize: 11,
    fontWeight: '800',
  },
  filterRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 18,
  },
  filterChip: {
    borderColor: colors.silverMid,
    borderRadius: radius.pill,
    borderWidth: 1,
    color: colors.charcoal,
    fontFamily: fonts.display,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    textTransform: 'uppercase',
  },
  dateSummary: {
    color: colors.silverDark,
    fontFamily: fonts.body,
    fontSize: 13,
    marginBottom: 10,
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
