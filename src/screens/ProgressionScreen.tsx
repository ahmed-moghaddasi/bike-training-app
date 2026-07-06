import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LineChart } from '../components/LineChart';
import { buildNavItems, EmptyState, Page, Section, StatGrid } from '../components/ScreenKit';
import { bikes, drills, sessions } from '../data/seed';
import { bestLap, contextKey, formatDate, formatLap, getSetupName, lapSpread, latestSession, sessionsForContext } from '../lib/metrics';
import { isSupabaseConfigured, loadSavedSessions } from '../lib/supabase';
import { colors, fonts, radius, tracking } from '../theme';
import type { GoFn, ProgressContext, Session } from '../types';

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

export function ProgressionScreen({ currentBikeId, go }: { currentBikeId: string; go: GoFn }) {
  const bike = bikes.find((b) => b.id === currentBikeId) ?? bikes[0];
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
    <Page bike={bike} navItems={buildNavItems(go)} activeNavKey="progress">
      <View style={styles.header}>
        <Text style={styles.title}>Progression</Text>
      </View>

      {trainingSessions === null && <Text style={styles.status}>Loading saved sessions...</Text>}
      {trainingError && <Text style={styles.statusError}>{trainingError}</Text>}
      {trainingSessions !== null && contexts.length === 0 ? (
        <EmptyState title="No progress yet" body="Record a session on this bike to build a trend." />
      ) : (
        contexts.map((context) => <ProgressCard key={contextKey(context)} context={context} sessionData={sessionData} go={go} />)
      )}
    </Page>
  );
}

function ProgressCard({ context, sessionData, go }: { context: ProgressContext; sessionData: Session[]; go: GoFn }) {
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
      <LineChart values={bestBySession} height={100} dark />
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

export function DrillProgressScreen({ context, currentBikeId, onBack, go }: { context: ProgressContext; currentBikeId: string; onBack: () => void; go: GoFn }) {
  const bike = bikes.find((b) => b.id === currentBikeId) ?? bikes[0];
  const { trainingSessions, trainingError } = useTrainingSessions();
  const sessionData = trainingSessions ?? [];
  const drill = drills.find((item) => item.id === context.drillId) ?? drills[0];
  const contextBike = bikes.find((item) => item.id === context.bikeId) ?? bikes[0];
  const setup = getSetupName(drill, context.setupVariantId);
  const contextSessions = timedSessionsForContext(sessionData, context);
  const bestBySession = contextSessions.map(bestLap);
  const totalLaps = contextSessions.reduce((sum, session) => sum + session.laps.length, 0);
  const best = bestBySession.length ? Math.min(...bestBySession) : undefined;
  const latest = latestSession(contextSessions);

  const firstBest = bestBySession[0];
  const currentBest = bestBySession[bestBySession.length - 1];
  const firstSpread = contextSessions[0] ? lapSpread(contextSessions[0]) : undefined;
  const latestSpread = latest ? lapSpread(latest) : undefined;
  const consistencyPct = firstSpread != null && latestSpread != null && firstSpread > 0
    ? Math.round(((firstSpread - latestSpread) / firstSpread) * 100)
    : undefined;
  const nextTarget = best != null ? Math.max(0, best - 0.2) : undefined;

  return (
    <Page bike={bike} onBack={onBack} navItems={buildNavItems(go)} activeNavKey="progress">
      <View style={styles.header}>
        <Text style={styles.title}>{drill.name}</Text>
        <Text style={styles.subtitle}>{`${contextBike.name} · ${setup}`}</Text>
      </View>

      {trainingSessions === null && <Text style={styles.status}>Loading saved sessions...</Text>}
      {trainingError && <Text style={styles.statusError}>{trainingError}</Text>}

      <StatGrid
        items={[
          ['Best', `${formatLap(best)}s`],
          ['Latest Best', latest ? `${formatLap(bestLap(latest))}s` : '--'],
          ['Sessions', String(contextSessions.length)],
          ['Total Laps', String(totalLaps)],
        ]}
      />

      <Section label="Lap Time Over Time">
        <LineChart values={bestBySession} height={150} dark />
      </Section>

      {contextSessions.length > 1 && (
        <Section label="Ranking">
          <View style={styles.rankRow}>
            <Text style={styles.rankTag}>PB</Text>
            <View style={styles.rankBody}>
              <Text style={styles.rankTitle}>Personal Best</Text>
              <Text style={styles.rankSub}>Best lap so far in this setup.</Text>
            </View>
            <Text style={[styles.rankValue, styles.rankValuePurple]}>{formatLap(best)}s</Text>
          </View>
          {consistencyPct != null && (
            <View style={styles.rankRow}>
              <Text style={styles.rankTag}>CS</Text>
              <View style={styles.rankBody}>
                <Text style={styles.rankTitle}>Consistency</Text>
                <Text style={styles.rankSub}>
                  Lap spread went from {formatLap(firstSpread)}s to {formatLap(latestSpread)}s.
                </Text>
              </View>
              <Text style={styles.rankValue}>{consistencyPct > 0 ? '+' : ''}{consistencyPct}%</Text>
            </View>
          )}
          {nextTarget != null && (
            <View style={styles.rankRow}>
              <Text style={styles.rankTag}>NXT</Text>
              <View style={styles.rankBody}>
                <Text style={styles.rankTitle}>Next Target</Text>
                <Text style={styles.rankSub}>Chip away at your current best next session.</Text>
              </View>
              <Text style={styles.rankValue}>{nextTarget.toFixed(2)}s</Text>
            </View>
          )}
        </Section>
      )}

      <Section label="Session History">
        {contextSessions.length === 0 ? (
          <EmptyState title="No timed sessions" body="This timing context does not have completed laps yet." />
        ) : (
          contextSessions
            .slice()
            .reverse()
            .map((session) => (
              <Pressable
                key={session.id}
                style={styles.historyRow}
                onPress={() => go({ name: 'session', sessionId: session.id, session, returnTo: { name: 'drillProgress', context } })}
              >
                <Text style={styles.historyDate}>{formatDate(session.date, true)}</Text>
                <Text style={styles.historyValue}>{formatLap(bestLap(session))}s</Text>
                <Text style={styles.historyMeta}>{session.laps.length} laps</Text>
              </Pressable>
            ))
        )}
      </Section>
    </Page>
  );
}

const HAIRLINE = 'rgba(242,241,240,0.14)';

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
  subtitle: {
    color: colors.mist300,
    fontFamily: fonts.body,
    fontSize: 14,
    marginTop: 8,
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
  progressCard: {
    backgroundColor: colors.graphite800,
    borderColor: HAIRLINE,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: 12,
    marginBottom: 14,
    padding: 16,
  },
  cardTitle: {
    color: colors.mist100,
    fontFamily: fonts.title,
    fontSize: 18,
  },
  cardSub: {
    color: colors.mist300,
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
    color: colors.mist100,
    fontFamily: fonts.number,
    fontSize: 13,
  },
  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.graphite800,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: HAIRLINE,
    padding: 14,
    marginBottom: 8,
  },
  rankTag: {
    color: colors.mist500,
    fontFamily: fonts.number,
    fontSize: 11,
    width: 28,
  },
  rankBody: {
    flex: 1,
  },
  rankTitle: {
    color: colors.mist100,
    fontFamily: fonts.title,
    fontSize: 13,
  },
  rankSub: {
    color: colors.mist300,
    fontFamily: fonts.body,
    fontSize: 12,
    marginTop: 3,
  },
  rankValue: {
    color: colors.mist100,
    fontFamily: fonts.number,
    fontSize: 16,
  },
  rankValuePurple: {
    color: colors.purple300,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.graphite800,
    borderRadius: radius.sm,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
  },
  historyDate: {
    flex: 1,
    color: colors.mist300,
    fontFamily: fonts.body,
    fontSize: 13,
  },
  historyValue: {
    color: colors.mist100,
    fontFamily: fonts.number,
    fontSize: 15,
  },
  historyMeta: {
    color: colors.mist500,
    fontFamily: fonts.body,
    fontSize: 12,
  },
});
