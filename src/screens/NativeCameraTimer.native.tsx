import * as MediaLibrary from 'expo-media-library';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  Camera,
  CommonResolutions,
  useCameraDevice,
  useCameraPermission,
  useVideoOutput,
} from 'react-native-vision-camera';
import type { Recorder } from 'react-native-vision-camera';
import { DEFAULT_STRAIGHT_LINE_CONFIG } from '../lib/straightLineDetector';
import { colors, fonts, radius } from '../theme';
import type { Bike, Drill, SessionDraft, SetupVariant } from '../types';

const ORANGE = '#F2A23A';
const MAX_RECORDING_SECONDS = 8 * 60;

export type NativeCameraTimerProps = {
  drill: Drill;
  setup: SetupVariant;
  currentBike: Bike;
  onSessionComplete: (draft: SessionDraft) => void;
  onCancel: () => void;
};

async function saveToAlbum(filePath: string) {
  try {
    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status !== 'granted') return;
    const asset = await MediaLibrary.createAssetAsync(`file://${filePath}`);
    const album = await MediaLibrary.getAlbumAsync('Bike Training');
    if (album == null) {
      await MediaLibrary.createAlbumAsync('Bike Training', asset, false);
    } else {
      await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
    }
  } catch (e) {
    console.warn('[NativeCameraTimer] auto-save failed', e);
  }
}

export function NativeCameraTimer({ drill, setup, currentBike, onSessionComplete, onCancel }: NativeCameraTimerProps) {
  const { hasPermission, requestPermission } = useCameraPermission();
  const isStraightLine = drill.timingRule.detectionMode === 'straight-line';
  const isWideAngle = isStraightLine || drill.id === 'loop';

  // Prefer ultra-wide for the wider FOV the detectors are calibrated against.
  const device = useCameraDevice('back', {
    physicalDevices: ['ultra-wide-angle', 'wide-angle'],
  });

  // 1080p MP4 output — same spec the server-side detector was tuned on.
  const videoOutput = useVideoOutput({
    targetResolution: CommonResolutions.FHD_16_9,
    enableAudio: false,
    fileType: 'mp4',
  });

  // Wide drills (straight-line, loop) use the device's minimum zoom for maximum
  // field of view. Circle and figure-eight use the natural 1x zoom.
  const targetZoom = isWideAngle ? (device?.minZoom ?? 1) : 1;

  const recorderRef = useRef<Recorder | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const startTimeRef = useRef(0);
  const startedAtRef = useRef('');
  const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!hasPermission) void requestPermission();
  }, [hasPermission, requestPermission]);

  useEffect(() => {
    return () => {
      if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
    };
  }, []);

  const stopRecording = useCallback(async () => {
    if (elapsedTimerRef.current) {
      clearInterval(elapsedTimerRef.current);
      elapsedTimerRef.current = null;
    }
    setIsRecording(false);
    try {
      await recorderRef.current?.stopRecording();
    } catch {
      // already stopped
    }
    recorderRef.current = null;
  }, []);

  async function startRecording() {
    if (isRecording) return;
    startedAtRef.current = new Date().toISOString();
    startTimeRef.current = Date.now();
    setElapsedSeconds(0);
    setIsRecording(true);

    elapsedTimerRef.current = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 250);

    try {
      const recorder = await videoOutput.createRecorder({
        maxDuration: MAX_RECORDING_SECONDS,
      });
      recorderRef.current = recorder;

      await recorder.startRecording(
        (filePath) => {
          // Auto-save to camera roll in the background — don't block the summary.
          void saveToAlbum(filePath);

          const draft: SessionDraft = {
            drillId: drill.id,
            setupVariantId: setup.id,
            bikeId: currentBike.id,
            laps: [],
            videoUri: `file://${filePath}`,
            videoSaved: true,
            videoSizeBytes: undefined,
            videoDurationSeconds: recorder.recordedDuration,
            recordingStopReason: 'user',
            startedAt: startedAtRef.current,
            endedAt: new Date().toISOString(),
            detectionEvents: [],
            needsProcessing: true,
          };
          onSessionComplete(draft);
        },
        (error) => {
          console.error('[NativeCameraTimer] recording error', error);
          if (elapsedTimerRef.current) {
            clearInterval(elapsedTimerRef.current);
            elapsedTimerRef.current = null;
          }
          setIsRecording(false);
          recorderRef.current = null;
        },
      );
    } catch (err) {
      console.error('[NativeCameraTimer] failed to create recorder', err);
      if (elapsedTimerRef.current) {
        clearInterval(elapsedTimerRef.current);
        elapsedTimerRef.current = null;
      }
      setIsRecording(false);
    }
  }

  const elapsed = elapsedSeconds;
  const elapsedLabel = `${Math.floor(elapsed / 60).toString().padStart(2, '0')}:${(elapsed % 60).toString().padStart(2, '0')}`;

  if (!hasPermission) {
    return (
      <View style={styles.shell}>
        <Text style={styles.message}>Camera permission is required to record sessions.</Text>
        <Pressable style={styles.primaryBtn} onPress={() => void requestPermission()}>
          <Text style={styles.btnText}>Grant Permission</Text>
        </Pressable>
        <Pressable style={styles.cancelBtn} onPress={onCancel}>
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
      </View>
    );
  }

  if (!device) {
    return (
      <View style={styles.shell}>
        <Text style={styles.message}>No camera found on this device.</Text>
        <Pressable style={styles.cancelBtn} onPress={onCancel}>
          <Text style={styles.cancelText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.shell}>
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        outputs={[videoOutput]}
        constraints={[{ fps: 60 }]}
        zoom={targetZoom}
        isActive={true}
      />

      {/* Status bar */}
      <View style={styles.statusBar} pointerEvents="none">
        <Text style={styles.statusText}>{isRecording ? '● REC' : 'Aim Camera'}</Text>
        {isRecording && <Text style={styles.statusText}>{elapsedLabel}</Text>}
      </View>

      {/* Setup overlay */}
      {isStraightLine ? <StraightLineOverlay /> : <LapZoneOverlay />}

      {/* Tip */}
      {!isRecording && (
        <View style={styles.tipBar} pointerEvents="none">
          <Text style={styles.tipText}>{drill.cameraPlacement.detectionZoneSuggestion}</Text>
        </View>
      )}

      {/* Controls */}
      <View style={styles.controls}>
        {isRecording ? (
          <Pressable style={styles.stopBtn} onPress={() => void stopRecording()}>
            <Text style={styles.btnText}>End Session</Text>
          </Pressable>
        ) : (
          <>
            <Pressable style={styles.primaryBtn} onPress={() => void startRecording()}>
              <Text style={styles.btnText}>Start Recording</Text>
            </Pressable>
            <Pressable style={styles.cancelBtn} onPress={onCancel}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

function LapZoneOverlay() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View style={overlayStyles.centerLine} />
    </View>
  );
}

function StraightLineOverlay() {
  const cfg = DEFAULT_STRAIGHT_LINE_CONFIG;
  const bandTopPct = ((cfg.bandCenterRatio - cfg.bandRatio / 2) * 100).toFixed(1);
  const bandHeightPct = (cfg.bandRatio * 100).toFixed(1);
  const frameWidthM = cfg.frameWidthMetersOverride
    ?? 2 * cfg.cameraDistanceMeters * Math.tan((cfg.estimatedHFOVDegrees / 2) * (Math.PI / 180));
  const halfM = Math.round(frameWidthM / 2);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View style={[overlayStyles.band, { top: `${bandTopPct}%` as `${number}%`, height: `${bandHeightPct}%` as `${number}%` }]} />
      <View style={overlayStyles.coneLine} />
      <Text style={[overlayStyles.distLabel, { left: 12, top: '20%' as `${number}%` }]}>{`← ${halfM} m`}</Text>
      <Text style={[overlayStyles.distLabel, { right: 12, top: '20%' as `${number}%` }]}>{`${halfM} m →`}</Text>
      <Text style={[overlayStyles.coneLabel]}>{`▲ cone · camera ${cfg.cameraDistanceMeters} m from line`}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    backgroundColor: colors.black,
  },
  statusBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 52,
    paddingBottom: 10,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  statusText: {
    color: colors.white,
    fontFamily: fonts.mono,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  tipBar: {
    position: 'absolute',
    bottom: 160,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  tipText: {
    color: 'rgba(255,255,255,0.75)',
    fontFamily: fonts.body,
    fontSize: 13,
    textAlign: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  controls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: 40,
    paddingHorizontal: 20,
    gap: 10,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingTop: 16,
  },
  primaryBtn: {
    backgroundColor: ORANGE,
    borderRadius: radius.md,
    paddingVertical: 16,
    alignItems: 'center',
  },
  stopBtn: {
    backgroundColor: colors.red,
    borderRadius: radius.md,
    paddingVertical: 16,
    alignItems: 'center',
  },
  btnText: {
    color: colors.white,
    fontFamily: fonts.body,
    fontSize: 16,
    fontWeight: '600',
  },
  cancelBtn: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  cancelText: {
    color: 'rgba(255,255,255,0.6)',
    fontFamily: fonts.body,
    fontSize: 15,
  },
  message: {
    color: colors.white,
    fontFamily: fonts.body,
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
    marginTop: 60,
    paddingHorizontal: 24,
  },
});

const overlayStyles = StyleSheet.create({
  centerLine: {
    position: 'absolute',
    left: '50%' as `${number}%`,
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: 'rgba(242,162,58,0.7)',
    marginLeft: -1,
  },
  band: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: 'rgba(242,162,58,0.12)',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(242,162,58,0.5)',
  },
  coneLine: {
    position: 'absolute',
    left: '50%' as `${number}%`,
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: 'rgba(242,162,58,0.7)',
    marginLeft: -1,
  },
  distLabel: {
    position: 'absolute',
    color: 'rgba(255,255,255,0.85)',
    fontFamily: fonts.mono,
    fontSize: 13,
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  coneLabel: {
    position: 'absolute',
    bottom: 170,
    alignSelf: 'center',
    color: 'rgba(255,255,255,0.7)',
    fontFamily: fonts.body,
    fontSize: 12,
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
});
