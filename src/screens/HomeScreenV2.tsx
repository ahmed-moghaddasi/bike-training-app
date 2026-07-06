import { useEffect, useMemo, useState } from 'react';
import { ImageBackground, Pressable, StyleSheet, Text, View } from 'react-native';
import { BikeSelector } from '../components/BikeSelector';
import { buildNavItems, Page } from '../components/ScreenKit';
import { DrillCard } from '../components/DrillCard';
import { LineChart } from '../components/LineChart';
import { bikes, drills, sessions } from '../data/seed';
import {
  averageLap,
  bestLap,
  formatLap,
  lapSpread,
  latestSession,
  sessionsForContext,
} from '../lib/metrics';
import { DRILL_PHOTOS, SHORTCUT_PHOTOS } from '../lib/photos';
import { isSupabaseConfigured, loadSavedSessions } from '../lib/supabase';
import { colors, fonts, radius } from '../theme';
import type { GoFn, Session } from '../types';

interface HomeScreenV2Props {
  currentBikeId: string;
  onOpenDrills: () => void;
  onOpenDrill: (drillId: string) => void;
  onOpenSession: (session: Session) => void;
  onOpenSessions: () => void;
  onOpenProgress: () => void;
  go: GoFn;
}

/** First word(s) of whatThisTrains reads like a skill tag on the carousel card. */
function skillTag(drill: { whatThisTrains: string[] }): string {
  const first = drill.whatThisTrains[0] ?? 'Skill';
  return first.split(' ').slice(0, 2).join(' ');
}

export function HomeScreenV2({
  currentBikeId,
  onOpenDrills,
  onOpenDrill,
  onOpenSession,
  onOpenSessions,
  onOpenProgress,
  go,
}: HomeScreenV2Props) {
  const bike = bikes.find((b) => b.id === currentBikeId) ?? bikes[0];
  const [cloudSessions, setCloudSessions] = useState<Session[] | null>(null);

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
      .catch(() => {
        if (active) setCloudSessions([]);
      });
    return () => {
      active = false;
    };
  }, []);

  const actualSessions = cloudSessions ?? [];
  const bikeSessions = useMemo(
    () => actualSessions.filter((session) => session.bikeId === currentBikeId),
    [actualSessions, currentBikeId],
  );

  const previousSession = latestSession(bikeSessions);
  const previousDrill = previousSession ? drills.find((d) => d.id === previousSession.drillId) : undefined;

  // "Today's Focus": the drill practiced least recently among the ready foundations, so the
  // rider is nudged toward the thing they haven't touched — falls back to the first ready drill.
  const focusDrill = useMemo(() => {
    const readyDrills = drills.filter((d) => d.isReady);
    if (readyDrills.length === 0) return undefined;
    const lastPracticedAt = (drillId: string) => {
      const ctx = bikeSessions.filter((s) => s.drillId === drillId);
      const latest = latestSession(ctx);
      return latest ? new Date(latest.date).getTime() : 0;
    };
    return [...readyDrills].sort((a, b) => lastPracticedAt(a.id) - lastPracticedAt(b.id))[0];
  }, [bikeSessions]);

  const contextSessions = previousDrill
    ? sessionsForContext(bikeSessions, {
        bikeId: currentBikeId,
        drillId: previousDrill.id,
        setupVariantId: previousSession?.setupVariantId ?? previousDrill.defaultSetupVariantId,
      })
    : [];
  const lapTrend = contextSessions.length > 1 ? contextSessions.map(bestLap) : previousSession ? previousSession.laps.map((l) => l.time) : [];

  const foundationsDrills = drills.filter((d) => d.group === 'foundations' && d.isReady);

  // Rider growth: % change between the oldest and newest best-lap in the same
  // context, so "Progression" reflects real trend data instead of a static mock value.
  const growthPct = contextSessions.length > 1
    ? Math.round(((bestLap(contextSessions[0]) - bestLap(contextSessions[contextSessions.length - 1])) / bestLap(contextSessions[0])) * 100)
    : undefined;

  return (
    <Page navItems={buildNavItems(go)} activeNavKey="drills">
      <View style={styles.topRow}>
        <BikeSelector bike={bike} onPress={() => {}} />
        <Pressable style={styles.avatar} accessibilityRole="button" accessibilityLabel="Account">
          <Text style={styles.avatarText}>AH</Text>
        </Pressable>
      </View>

      <View style={styles.greetingBlock}>
        <Text style={styles.greeting}>Welcome back</Text>
      </View>

      {focusDrill && (
        <Pressable onPress={() => onOpenDrill(focusDrill.id)}>
          <ImageBackground
            source={DRILL_PHOTOS[focusDrill.id]}
            style={styles.mediaBanner}
            imageStyle={styles.mediaBannerImage}
          >
            <View style={styles.mediaScrim} />
            <Text style={styles.mediaEyebrow}>Today's Focus</Text>
            <Text style={styles.mediaTitle}>{focusDrill.name}</Text>
            <Text style={styles.mediaMeta}>{focusDrill.shortDescription}</Text>
          </ImageBackground>
        </Pressable>
      )}

      {previousSession && previousDrill && (
        <View style={styles.analyticsCard}>
          <View style={styles.analyticsHead}>
            <View>
              <Text style={styles.label}>Previous Drill</Text>
              <Text style={styles.analyticsTitle}>{previousDrill.name}</Text>
            </View>
            <View style={styles.lapCount}>
              <Text style={styles.lapCountText}>{previousSession.laps.length}L</Text>
            </View>
          </View>
          <View style={styles.chartWrap}>
            <LineChart values={lapTrend} height={150} dark />
          </View>
          <View style={styles.statsRow}>
            <View style={[styles.statBox, styles.statBoxBest]}>
              <Text style={styles.statLabel}>Best Lap</Text>
              <Text style={[styles.statValue, styles.statValueAccent]}>{formatLap(bestLap(previousSession))}</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Average</Text>
              <Text style={styles.statValue}>{formatLap(averageLap(previousSession))}</Text>
            </View>
            <View style={[styles.statBox, styles.statBoxDelta]}>
              <Text style={styles.statLabel}>Spread</Text>
              <Text style={[styles.statValue, styles.statValueAccent]}>{formatLap(lapSpread(previousSession))}</Text>
            </View>
          </View>
        </View>
      )}

      {foundationsDrills.length > 0 && (
        <View style={styles.drillsSection}>
          <View style={styles.sectionHead}>
            <View>
              <Text style={styles.label}>Drill Group</Text>
              <Text style={styles.sectionTitle}>The Foundations</Text>
            </View>
            <Pressable onPress={onOpenDrills}>
              <Text style={styles.sectionAction}>See all</Text>
            </Pressable>
          </View>
          <View style={styles.carousel}>
            {foundationsDrills.map((drill, index) => (
              <DrillCard
                key={drill.id}
                index={index + 1}
                name={drill.name}
                skillTag={skillTag(drill)}
                meta={drill.whatThisTrains[1] ?? ''}
                imageSource={DRILL_PHOTOS[drill.id]}
                onPress={() => onOpenDrill(drill.id)}
              />
            ))}
          </View>
        </View>
      )}

      <View style={styles.shortcutGrid}>
        <View style={styles.shortcutUnit}>
          <Text style={styles.shortcutHeading}>Progression</Text>
          <Pressable onPress={onOpenProgress}>
            <ImageBackground source={SHORTCUT_PHOTOS.progression} style={styles.shortcutCard} imageStyle={styles.shortcutCardImage}>
              <View style={styles.shortcutScrim} />
              <Text style={styles.shortcutEyebrow}>Rider Growth</Text>
              <Text style={styles.shortcutTitle}>{growthPct != null ? `${growthPct > 0 ? '+' : ''}${growthPct}%` : '--'}</Text>
              <Text style={styles.shortcutMeta}>{previousDrill ? `${previousDrill.name} consistency` : 'Record a session to start'}</Text>
            </ImageBackground>
          </Pressable>
        </View>
        <View style={styles.shortcutUnit}>
          <Text style={styles.shortcutHeading}>Session Log</Text>
          <Pressable onPress={onOpenSessions}>
            <ImageBackground source={SHORTCUT_PHOTOS.sessionLog} style={styles.shortcutCard} imageStyle={styles.shortcutCardImage}>
              <View style={styles.shortcutScrim} />
              <Text style={styles.shortcutEyebrow}>Last Ride</Text>
              <Text style={styles.shortcutTitle}>{previousSession ? `${previousSession.laps.length} Laps` : '--'}</Text>
              <Text style={styles.shortcutMeta}>{previousSession ? `Best ${formatLap(bestLap(previousSession))}` : 'No sessions yet'}</Text>
            </ImageBackground>
          </Pressable>
        </View>
      </View>
    </Page>
  );
}

const HAIRLINE = 'rgba(242,241,240,0.14)';

const styles = StyleSheet.create({
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.mist100,
  },
  avatarText: {
    color: colors.ink950,
    fontFamily: fonts.title,
    fontSize: 12,
  },
  greetingBlock: {
    marginTop: 24,
  },
  greeting: {
    color: colors.mist100,
    fontFamily: fonts.title,
    fontSize: 21,
    lineHeight: 24,
    textTransform: 'uppercase',
  },
  mediaBanner: {
    overflow: 'hidden',
    minHeight: 168,
    justifyContent: 'flex-end',
    marginTop: 32,
    padding: 16,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: HAIRLINE,
    backgroundColor: colors.graphite800,
  },
  mediaBannerImage: {
    borderRadius: radius.xl,
  },
  mediaScrim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(5,6,6,0.4)',
  },
  mediaEyebrow: {
    color: 'rgba(242,241,240,0.72)',
    fontFamily: fonts.title,
    fontSize: 8,
    textTransform: 'uppercase',
  },
  mediaTitle: {
    marginTop: 7,
    color: colors.mist100,
    fontFamily: fonts.title,
    fontSize: 18,
    textTransform: 'uppercase',
  },
  mediaMeta: {
    marginTop: 10,
    color: 'rgba(242,241,240,0.76)',
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 16,
  },
  analyticsCard: {
    overflow: 'hidden',
    marginTop: 20,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(21,24,23,0.82)',
  },
  analyticsHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    padding: 16,
    paddingBottom: 0,
  },
  label: {
    color: colors.mist500,
    fontFamily: fonts.title,
    fontSize: 10,
    textTransform: 'uppercase',
  },
  analyticsTitle: {
    marginTop: 6,
    color: colors.mist100,
    fontFamily: fonts.title,
    fontSize: 17,
    textTransform: 'uppercase',
  },
  lapCount: {
    minWidth: 56,
    paddingHorizontal: 9,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.mist100,
    alignItems: 'center',
  },
  lapCountText: {
    color: colors.ink950,
    fontFamily: fonts.number,
    fontSize: 13,
  },
  chartWrap: {
    marginTop: 8,
    paddingHorizontal: 8,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    padding: 16,
    paddingTop: 12,
  },
  statBox: {
    flex: 1,
    minWidth: 0,
    padding: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(5,6,6,0.36)',
  },
  statBoxBest: {},
  statBoxDelta: {},
  statLabel: {
    color: colors.mist500,
    fontFamily: fonts.title,
    fontSize: 8,
    textTransform: 'uppercase',
  },
  statValue: {
    marginTop: 7,
    color: colors.mist100,
    fontFamily: fonts.number,
    fontSize: 21,
  },
  statValueAccent: {
    color: colors.red500,
  },
  drillsSection: {
    marginTop: 18,
    marginBottom: 18,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 12,
  },
  sectionTitle: {
    color: colors.mist100,
    fontFamily: fonts.title,
    fontSize: 16,
    textTransform: 'uppercase',
  },
  sectionAction: {
    color: 'rgba(242,241,240,0.64)',
    fontFamily: fonts.title,
    fontSize: 9,
    textTransform: 'uppercase',
  },
  carousel: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  shortcutGrid: {
    gap: 16,
    marginTop: 6,
  },
  shortcutUnit: {
    gap: 9,
  },
  shortcutHeading: {
    color: colors.mist100,
    fontFamily: fonts.title,
    fontSize: 15,
    textTransform: 'uppercase',
  },
  shortcutCard: {
    minHeight: 148,
    justifyContent: 'flex-end',
    padding: 16,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(242,241,240,0.16)',
    backgroundColor: colors.graphite700,
    overflow: 'hidden',
  },
  shortcutCardImage: {
    borderRadius: radius.xl,
  },
  shortcutScrim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(5,6,6,0.5)',
  },
  shortcutEyebrow: {
    color: 'rgba(242,241,240,0.7)',
    fontFamily: fonts.title,
    fontSize: 7,
    textTransform: 'uppercase',
  },
  shortcutTitle: {
    marginTop: 7,
    color: colors.mist100,
    fontFamily: fonts.title,
    fontSize: 18,
    textTransform: 'uppercase',
  },
  shortcutMeta: {
    marginTop: 4,
    color: 'rgba(242,241,240,0.76)',
    fontFamily: fonts.body,
    fontSize: 12,
  },
});
