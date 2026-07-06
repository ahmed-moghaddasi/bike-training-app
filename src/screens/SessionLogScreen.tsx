import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { buildNavItems, EmptyState, Page } from '../components/ScreenKit';
import { SessionCard } from '../components/SessionCard';
import { bikes, drills, sessions } from '../data/seed';
import { averageLap, bestLap, formatDate, getSetupName } from '../lib/metrics';
import { DRILL_PHOTOS } from '../lib/photos';
import { isSupabaseConfigured, loadSavedSessions } from '../lib/supabase';
import { colors, fonts, tracking } from '../theme';
import type { GoFn, Session } from '../types';

function timeOfDay(dateIso: string) {
  return new Date(dateIso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
}

const ORDER_LABELS = ['First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth'];

export function SessionLogScreen({ currentBikeId, go }: { currentBikeId: string; go: GoFn }) {
  const bike = bikes.find((b) => b.id === currentBikeId) ?? bikes[0];
  const [cloudSessions, setCloudSessions] = useState<Session[] | null>(null);
  const [cloudError, setCloudError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!isSupabaseConfigured) {
      setCloudSessions(sessions);
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

  const visibleSessions = cloudSessions ?? [];
  const groups = useMemo(() => {
    const byDate: Record<string, Session[]> = {};
    for (const session of visibleSessions) {
      const key = new Date(session.date).toISOString().slice(0, 10);
      byDate[key] = [...(byDate[key] ?? []), session];
    }
    return Object.entries(byDate)
      .sort(([a], [b]) => new Date(b).getTime() - new Date(a).getTime())
      .map(([date, group]) => ({
        date,
        sessions: group.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
      }));
  }, [visibleSessions]);

  return (
    <Page bike={bike} navItems={buildNavItems(go)} activeNavKey="sessions">
      <View style={styles.header}>
        <Text style={styles.title}>Session Log</Text>
      </View>

      {cloudSessions === null && <Text style={styles.status}>Loading saved sessions...</Text>}
      {cloudError && <Text style={styles.statusError}>{cloudError}</Text>}
      {cloudSessions !== null && groups.length === 0 && (
        <EmptyState title="No sessions yet" body="Record and save a drill session to start your training log." />
      )}

      {groups.map((group) => (
        <View key={group.date} style={styles.daySection}>
          <View style={styles.dayHead}>
            <Text style={styles.dayTitle}>{formatDate(group.date)}</Text>
            <Text style={styles.dayCount}>{group.sessions.length} session{group.sessions.length === 1 ? '' : 's'}</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.carousel}>
            {group.sessions.map((session, index) => {
              const drill = drills.find((d) => d.id === session.drillId);
              const setup = getSetupName(drill, session.setupVariantId);
              const hasLaps = session.laps.length > 0;
              const isStraightLine = drill?.timingRule.detectionMode === 'straight-line';
              return (
                <SessionCard
                  key={session.id}
                  time={timeOfDay(session.date)}
                  orderLabel={ORDER_LABELS[index] ?? `#${index + 1}`}
                  drillName={drill?.name ?? session.drillId}
                  note={setup}
                  stats={
                    hasLaps
                      ? isStraightLine
                        ? [
                            { label: 'Runs', value: String(session.laps.length) },
                            { label: 'Best', value: bestLap(session).toFixed(1) },
                          ]
                        : [
                            { label: 'Laps', value: String(session.laps.length) },
                            { label: 'Best', value: bestLap(session).toFixed(2) },
                            { label: 'Avg', value: averageLap(session).toFixed(2) },
                          ]
                      : [{ label: 'Status', value: session.status ?? 'Pending' }]
                  }
                  imageSource={DRILL_PHOTOS[session.drillId]}
                  onPress={() => go({ name: 'session', sessionId: session.id, session, returnTo: { name: 'sessions' } })}
                />
              );
            })}
          </ScrollView>
        </View>
      ))}
    </Page>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: 20,
  },
  title: {
    color: colors.mist100,
    fontFamily: fonts.title,
    fontSize: 28,
    letterSpacing: tracking.hero,
    textTransform: 'uppercase',
  },
  status: {
    color: colors.mist300,
    fontFamily: fonts.body,
    fontSize: 13,
    marginBottom: 12,
  },
  statusError: {
    color: colors.red500,
    fontFamily: fonts.body,
    fontSize: 13,
    marginBottom: 12,
  },
  daySection: {
    marginBottom: 22,
  },
  dayHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  dayTitle: {
    color: colors.mist100,
    fontFamily: fonts.title,
    fontSize: 15,
    textTransform: 'uppercase',
  },
  dayCount: {
    color: colors.mist500,
    fontFamily: fonts.body,
    fontSize: 12,
  },
  carousel: {
    gap: 12,
    paddingRight: 4,
  },
});
