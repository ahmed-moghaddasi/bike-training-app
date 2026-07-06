import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { colors, fonts, radius } from '../theme';

type Props = { uri: string; drillName: string; durationSeconds?: number };

export function NativeVideoPreview({ uri, drillName, durationSeconds }: Props) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.play();
  });
  const mins = durationSeconds != null ? Math.floor(durationSeconds / 60) : null;
  const secs = durationSeconds != null ? Math.round(durationSeconds % 60) : null;
  const durationLabel =
    mins != null && secs != null ? (mins > 0 ? `${mins}m ${secs}s` : `${secs}s`) : null;

  return (
    <View style={styles.container}>
      <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="contain" />
      <View style={styles.topBar} pointerEvents="none">
        <Text style={styles.drillLabel}>{drillName}</Text>
        {durationLabel && <Text style={styles.durationLabel}>{durationLabel}</Text>}
      </View>
      <View style={styles.bottomBar} pointerEvents="none">
        <Text style={styles.processingLabel}>Processing laps on server...</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    aspectRatio: 9 / 16,
    backgroundColor: colors.ink950,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  drillLabel: {
    color: colors.mist100,
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: '600',
  },
  durationLabel: {
    color: colors.mist300,
    fontFamily: fonts.mono,
    fontSize: 12,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
  },
  processingLabel: {
    color: colors.mist500,
    fontFamily: fonts.body,
    fontSize: 12,
  },
});
