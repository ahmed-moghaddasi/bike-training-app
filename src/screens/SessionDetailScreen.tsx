import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { buildNavItems, LapList, Page, SecondaryButton, Section, StatGrid } from '../components/ScreenKit';
import { bikes, drills, sessions } from '../data/seed';
import { averageLap, bestLap, formatDate, getSetupName, lapSpread } from '../lib/metrics';
import { deleteSavedSession } from '../lib/supabase';
import { colors, fonts, radius, tracking } from '../theme';
import type { GoFn, Session } from '../types';

export function SessionDetailScreen({
  sessionId,
  cloudSession,
  currentBikeId,
  onBack,
  go,
}: {
  sessionId: string;
  cloudSession?: Session;
  currentBikeId: string;
  onBack: () => void;
  go: GoFn;
}) {
  const session = cloudSession ?? sessions.find((item) => item.id === sessionId) ?? sessions[0];
  const drill = drills.find((item) => item.id === session.drillId) ?? drills[0];
  const bike = bikes.find((item) => item.id === session.bikeId) ?? bikes[0];
  const currentBike = bikes.find((item) => item.id === currentBikeId) ?? bike;
  const setup = getSetupName(drill, session.setupVariantId);
  const isStraightLine = drill.timingRule.detectionMode === 'straight-line';
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

  const straightLineStats: [string, string][] = (() => {
    const reps = session.laps;
    const stops = reps.filter((r) => !r.stopOffScreen && r.stoppingDistanceMeters != null).map((r) => r.stoppingDistanceMeters as number);
    const speeds = reps.map((r) => r.entrySpeedKph).filter((v): v is number => v != null);
    const scores = reps.map((r) => r.brakingScoreG).filter((v): v is number => v != null);
    const bestStop = stops.length ? Math.min(...stops) : null;
    const avgSpeed = speeds.length ? speeds.reduce((s, v) => s + v, 0) / speeds.length : null;
    const bestScore = scores.length ? Math.max(...scores) : null;
    return [
      ['Best Stop', bestStop != null ? `${bestStop.toFixed(1)} m` : '--'],
      ['Avg Speed', avgSpeed != null ? `${avgSpeed.toFixed(0)} km/h` : '--'],
      ['Reps', String(reps.length)],
      ['Best Score', bestScore != null ? `${bestScore.toFixed(2)}g` : '--'],
    ];
  })();

  return (
    <Page bike={currentBike} onBack={onBack} navItems={buildNavItems(go)} activeNavKey="sessions">
      <View style={styles.header}>
        <Text style={styles.title}>{drill.name}</Text>
        <Text style={styles.subtitle}>{`${setup} · ${bike.name} · ${formatDate(session.date)}`}</Text>
      </View>

      <StatGrid
        items={isStraightLine
          ? straightLineStats
          : [
              ['Best', `${best.toFixed(2)}s`],
              ['Average', `${avg.toFixed(2)}s`],
              ['Laps', String(session.laps.length)],
              ['Spread', `${lapSpread(session).toFixed(2)}s`],
            ]}
      />

      <Section label="Video">
        <View style={styles.videoPlaceholder}>
          <Text style={styles.placeholderTitle}>{session.videoSaved ? 'Saved to your device' : 'No video saved'}</Text>
          <Text style={styles.placeholderText}>
            {session.videoSaved
              ? "This app does not keep a copy — find the recording in your phone's Photos or Files app."
              : 'This session does not include a recording.'}
          </Text>
        </View>
      </Section>

      <Section label={isStraightLine ? 'Braking Reps' : 'Lap Times'}>
        <LapList laps={session.laps} isStraightLine={isStraightLine} />
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
        <Pressable style={styles.deleteButton} onPress={() => setConfirmDelete(true)}>
          <Text style={styles.deleteText}>Delete Session</Text>
        </Pressable>
      )}
      {cloudSession && confirmDelete && (
        <View style={styles.deleteConfirm}>
          <Text style={styles.deleteConfirmTitle}>Delete this session?</Text>
          <Text style={styles.bodyTextMuted}>Its lap data, detection events, notes, and video will be permanently removed.</Text>
          {deleteError && <Text style={styles.deleteError}>{deleteError}</Text>}
          <View style={styles.deleteActions}>
            <Pressable style={styles.deleteCancelButton} onPress={() => setConfirmDelete(false)}>
              <Text style={styles.deleteCancelText}>Cancel</Text>
            </Pressable>
            <Pressable style={styles.deleteConfirmButton} onPress={() => void deleteSession()}>
              <Text style={styles.deleteConfirmButtonText}>{deleteState === 'deleting' ? 'Deleting...' : 'Delete Permanently'}</Text>
            </Pressable>
          </View>
        </View>
      )}
    </Page>
  );
}

const HAIRLINE = 'rgba(242,241,240,0.14)';

const styles = StyleSheet.create({
  header: {
    marginBottom: 18,
  },
  title: {
    color: colors.mist100,
    fontFamily: fonts.title,
    fontSize: 28,
    letterSpacing: tracking.hero,
    textTransform: 'uppercase',
  },
  subtitle: {
    color: colors.mist300,
    fontFamily: fonts.body,
    fontSize: 14,
    marginTop: 8,
  },
  videoPlaceholder: {
    alignItems: 'center',
    backgroundColor: colors.graphite800,
    borderRadius: radius.md,
    minHeight: 150,
    justifyContent: 'center',
    padding: 18,
  },
  placeholderTitle: {
    color: colors.mist100,
    fontFamily: fonts.title,
    fontSize: 16,
    textTransform: 'uppercase',
  },
  placeholderText: {
    color: colors.mist300,
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 8,
    textAlign: 'center',
  },
  bodyText: {
    color: colors.mist300,
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 22,
  },
  bodyTextMuted: {
    color: colors.mist500,
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 19,
  },
  twoCol: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
  },
  deleteButton: {
    alignItems: 'center',
    marginTop: 18,
    padding: 16,
  },
  deleteText: {
    color: colors.red500,
    fontFamily: fonts.title,
    fontSize: 12,
    letterSpacing: tracking.wide,
    textTransform: 'uppercase',
  },
  deleteConfirm: {
    borderColor: colors.red500,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: 10,
    marginTop: 18,
    padding: 16,
  },
  deleteConfirmTitle: {
    color: colors.mist100,
    fontFamily: fonts.title,
    fontSize: 16,
  },
  deleteError: {
    color: colors.red500,
    fontFamily: fonts.body,
    fontSize: 13,
  },
  deleteActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  deleteCancelButton: {
    alignItems: 'center',
    borderColor: HAIRLINE,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    flex: 1,
    justifyContent: 'center',
    minHeight: 50,
    paddingHorizontal: 12,
  },
  deleteCancelText: {
    color: colors.mist100,
    fontFamily: fonts.title,
    fontSize: 11,
    letterSpacing: tracking.wide,
    textTransform: 'uppercase',
  },
  deleteConfirmButton: {
    alignItems: 'center',
    backgroundColor: colors.red500,
    borderRadius: radius.pill,
    flex: 1.4,
    justifyContent: 'center',
    minHeight: 50,
    paddingHorizontal: 12,
  },
  deleteConfirmButtonText: {
    color: colors.mist100,
    fontFamily: fonts.title,
    fontSize: 11,
    letterSpacing: tracking.wide,
    textTransform: 'uppercase',
  },
});
