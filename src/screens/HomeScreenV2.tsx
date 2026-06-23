import { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { bikes, drills, sessions } from '../data/seed';
import {
  averageLap,
  bestLap,
  formatDate,
  formatLap,
  getSetupName,
  latestSession,
  sessionsForContext,
} from '../lib/metrics';
import { isSupabaseConfigured, loadSavedSessions } from '../lib/supabase';
import { colors, fonts, radius, spacing } from '../theme';
import type { Drill, Session } from '../types';

const NAV_CARD_H = 132;

interface HomeScreenV2Props {
  currentBikeId: string;
  onOpenDrills: () => void;
  onOpenDrill: (drillId: string) => void;
  onOpenSession: (session: Session) => void;
  onOpenSessions: () => void;
  onOpenProgress: () => void;
}

export function HomeScreenV2({
  currentBikeId,
  onOpenDrills,
  onOpenDrill,
  onOpenSession,
  onOpenSessions,
  onOpenProgress,
}: HomeScreenV2Props) {
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
          setCloudError(error instanceof Error ? error.message : 'Could not load training data.');
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const actualSessions = cloudSessions ?? [];

  // ── Derived data ──────────────────────────────────────────────────────────

  const recent = useMemo(
    () =>
      [...actualSessions]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 1),
    [actualSessions],
  );

  const workingDrills = useMemo(
    () => {
      const recentDrillIds = [...actualSessions]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .map((session) => session.drillId)
        .filter((id, index, all) => all.indexOf(id) === index)
        .slice(0, 1);
      return recentDrillIds.map((id) => drills.find((drill) => drill.id === id)).filter(Boolean) as Drill[];
    },
    [actualSessions],
  );

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <View style={styles.wrapper}>
      <ScrollView
        contentContainerStyle={styles.page}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Brand header ─────────────────────────────────────────── */}
        <View style={styles.brandHeader}>
          <View style={styles.brandRow}>
            <Text style={styles.brandMark}>
              Apex<Text style={styles.brandAccent}>Lab</Text>
            </Text>
          </View>

          <Text style={styles.tagline}>Parking-lot drills for track pace.</Text>
        </View>

        {/* ── Working On ───────────────────────────────────────────── */}
        {cloudError && <Text style={styles.homeStatusError}>{cloudError}</Text>}
        <RuleLabel text="Working On" />
        <View style={styles.cardList}>
          {cloudSessions === null && <Text style={styles.homeStatus}>Loading training data...</Text>}
          {cloudSessions !== null && workingDrills.length === 0 && <Text style={styles.homeStatus}>No practiced drills yet.</Text>}
          {workingDrills.map((drill) => (
            <WorkingDrillCard
              key={drill.id}
              drill={drill}
              currentBikeId={currentBikeId}
              sessionData={actualSessions}
              onPress={() => onOpenDrill(drill.id)}
            />
          ))}
        </View>

        {/* ── Recent Sessions ──────────────────────────────────────── */}
        <RuleLabel text="Recent Sessions" />
        <View style={styles.cardList}>
          {cloudSessions !== null && recent.length === 0 && <Text style={styles.homeStatus}>No saved sessions yet.</Text>}
          {recent.map((session) => (
            <RecentSessionCard
              key={session.id}
              session={session}
              onPress={() => onOpenSession(session)}
            />
          ))}
        </View>

        {/* ── Go To ────────────────────────────────────────────────── */}
        <RuleLabel text="Go To" />
        <View style={styles.navList}>
          <NavCard
            title="Drills"
            onPress={onOpenDrills}
          />
          <NavCard
            title="Sessions"
            onPress={onOpenSessions}
          />
          <NavCard
            title="Progress"
            onPress={onOpenProgress}
          />
        </View>
      </ScrollView>

    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

/** Moodboard .section-label: small uppercase text with a rule line to the right */
function RuleLabel({ text }: { text: string }) {
  return (
    <View style={styles.ruleLabel}>
      <Text style={styles.ruleLabelText}>{text}</Text>
      <View style={styles.ruleLabelLine} />
    </View>
  );
}

/** Working-On card: moodboard drill-card style — white with red left border */
function WorkingDrillCard({
  drill,
  currentBikeId,
  sessionData,
  onPress,
}: {
  drill: Drill;
  currentBikeId: string;
  sessionData: Session[];
  onPress: () => void;
}) {
  const ctxSessions = sessionsForContext(sessionData, {
    bikeId: currentBikeId,
    drillId: drill.id,
    setupVariantId: drill.defaultSetupVariantId,
  });
  const latest = latestSession(ctxSessions);
  const best   = ctxSessions.length ? Math.min(...ctxSessions.map(bestLap)) : undefined;

  return (
    <Pressable style={styles.workingCard} onPress={onPress}>
      <View style={styles.workingCardLeft}>
        <Text style={styles.workingCardTitle}>{drill.name}</Text>
        <Text style={styles.workingCardSub} numberOfLines={2}>
          {drill.shortDescription}
        </Text>
      </View>
      <View style={styles.workingCardRight}>
        <View style={styles.workingStat}>
          <Text style={styles.workingStatValue}>{formatLap(best)}s</Text>
          <Text style={styles.workingStatLabel}>Best</Text>
        </View>
        <View style={[styles.workingStat, styles.workingStatDivided]}>
          <Text style={styles.workingStatValue}>
            {latest ? formatDate(latest.date, true) : '—'}
          </Text>
          <Text style={styles.workingStatLabel}>Last</Text>
        </View>
      </View>
    </Pressable>
  );
}

/** Session card: moodboard light-card style */
function RecentSessionCard({ session, onPress }: { session: Session; onPress: () => void }) {
  const drill = drills.find((d) => d.id === session.drillId);
  const bike  = bikes.find((b) => b.id === session.bikeId);
  const setup = getSetupName(drill, session.setupVariantId);
  const hasLaps = session.laps.length > 0;

  return (
    <Pressable style={styles.sessionCard} onPress={onPress}>
      <View style={styles.sessionTag}>
        <Text style={styles.sessionTagText}>{formatDate(session.date, true)}</Text>
        <Text style={styles.sessionTagArrow}>↗</Text>
      </View>

      <Text style={styles.sessionTitle}>{drill?.name ?? session.drillId}</Text>
      <Text style={styles.sessionSub}>
        {bike?.name ?? session.bikeId} · {setup} · {session.laps.length} laps
      </Text>

      <View style={styles.sessionStats}>
        <Stat value={hasLaps ? formatLap(bestLap(session)) : '--'} label="Best lap" highlight />
        <Stat value={hasLaps ? formatLap(averageLap(session)) : '--'} label="Average" />
        {session.videoSaved && <Stat value="●" label="Video" />}
      </View>
    </Pressable>
  );
}

function Stat({
  value,
  label,
  highlight,
}: {
  value: string;
  label: string;
  highlight?: boolean;
}) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, highlight && styles.statValueBest]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

/** Large red nav card */
function NavCard({
  title,
  onPress,
}: {
  title: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={styles.navCard}
      onPress={onPress}
    >
      <View style={styles.navDiagonalWrap} pointerEvents="none">
        <DiagonalStripe style={[styles.navDiagonalStripe, styles.navDiagonalSilver]} />
        <DiagonalStripe style={[styles.navDiagonalStripe, styles.navDiagonalRed]} />
        <DiagonalStripe style={[styles.navDiagonalStripe, styles.navDiagonalCharcoal]} />
      </View>
      <View style={styles.navCardContent}>
        <Text style={styles.navCardTitle}>{title}</Text>
      </View>
    </Pressable>
  );
}

function DiagonalStripe({ style }: { style: StyleProp<ViewStyle> }) {
  return (
    <View style={style}>
      <View style={styles.navStripeShadeTop} />
      <View style={styles.navStripeShadeBottom} />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const SILVER_DARK_MB = '#B3AFAF'; // moodboard value (lighter than theme default)

const styles = StyleSheet.create({

  // ── Root wrapper ─────────────────────────────────────────────────
  wrapper: {
    flex: 1,
  },

  // ── Page scroll ──────────────────────────────────────────────────
  page: {
    paddingHorizontal: spacing.pageX,
    paddingBottom: spacing.pageBottom + 24,
    paddingTop: 0,
  },

  // ── Brand header ─────────────────────────────────────────────────
  brandHeader: {
    backgroundColor: colors.charcoal,
    marginHorizontal: -spacing.pageX,
    paddingBottom: 28,
    paddingHorizontal: spacing.pageX,
    paddingTop: 32,
    marginBottom: 24,
  },
  brandRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  brandMark: {
    color: colors.white,
    fontFamily: fonts.display,
    fontSize: 42,
    fontWeight: '800',
    letterSpacing: -0.5,
    lineHeight: 46,
    textTransform: 'uppercase',
  },
  brandAccent: {
    color: colors.red,
  },
  tagline: {
    color: SILVER_DARK_MB,
    fontFamily: fonts.body,
    fontWeight: '300',
    fontSize: 14,
    letterSpacing: 0.3,
    lineHeight: 20,
  },

  // ── Section rule label ────────────────────────────────────────────
  ruleLabel: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  ruleLabelText: {
    color: SILVER_DARK_MB,
    fontFamily: fonts.display,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2.2,
    textTransform: 'uppercase',
  },
  ruleLabelLine: {
    backgroundColor: colors.silverMid,
    flex: 1,
    height: 1,
  },

  // ── Card list ─────────────────────────────────────────────────────
  cardList: {
    gap: 14,
    marginBottom: 30,
  },
  homeStatus: {
    color: colors.silverDark,
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
  },
  homeStatusError: {
    color: colors.red,
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 14,
  },

  // ── Working On card ───────────────────────────────────────────────
  workingCard: {
    alignItems: 'center',
    backgroundColor: colors.white,
    borderColor: colors.silverMid,
    borderLeftColor: colors.red,
    borderLeftWidth: 3,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 16,
    padding: 20,
  },
  workingCardLeft: {
    flex: 1,
    gap: 5,
  },
  workingCardTitle: {
    color: colors.charcoal,
    fontFamily: fonts.display,
    fontSize: 20,
    fontWeight: '700',
  },
  workingCardSub: {
    color: SILVER_DARK_MB,
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 19,
  },
  workingCardRight: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  workingStat: {
    alignItems: 'flex-end',
    paddingHorizontal: 12,
  },
  workingStatDivided: {
    borderLeftColor: colors.silverMid,
    borderLeftWidth: 1,
  },
  workingStatValue: {
    color: colors.charcoal,
    fontFamily: fonts.mono,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  workingStatLabel: {
    color: SILVER_DARK_MB,
    fontFamily: fonts.display,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginTop: 3,
    textTransform: 'uppercase',
  },

  // ── Session card ──────────────────────────────────────────────────
  sessionCard: {
    backgroundColor: colors.white,
    borderColor: colors.silverMid,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: 20,
  },
  sessionTag: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  sessionTagText: {
    color: SILVER_DARK_MB,
    fontFamily: fonts.display,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  sessionTagArrow: {
    color: colors.red,
    fontSize: 16,
    fontWeight: '800',
  },
  sessionTitle: {
    color: colors.charcoal,
    fontFamily: fonts.display,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 6,
  },
  sessionSub: {
    color: SILVER_DARK_MB,
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 18,
  },
  sessionStats: {
    borderTopColor: colors.silverMid,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 20,
    paddingTop: 16,
  },
  stat: {
    flex: 1,
  },
  statValue: {
    color: colors.charcoal,
    fontFamily: fonts.mono,
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: 0.4,
    lineHeight: 26,
  },
  statValueBest: {
    color: colors.red,
  },
  statLabel: {
    color: SILVER_DARK_MB,
    fontFamily: fonts.display,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginTop: 4,
    textTransform: 'uppercase',
  },

  // ── Nav cards ────────────────────────────────────────────────────
  navList: {
    gap: 14,
  },
  navCard: {
    backgroundColor: colors.charcoal,
    borderRadius: radius.md,
    minHeight: NAV_CARD_H,
    overflow: 'hidden',
  },
  navDiagonalWrap: {
    bottom: -26,
    height: NAV_CARD_H + 56,
    position: 'absolute',
    right: -26,
    top: -26,
    width: 176,
  },
  navDiagonalStripe: {
    borderRadius: 3,
    height: 230,
    overflow: 'hidden',
    position: 'absolute',
    shadowColor: colors.black,
    shadowOffset: { width: -8, height: 10 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
    transform: [{ rotate: '24deg' }],
    width: 32,
  },
  navDiagonalSilver: {
    backgroundColor: colors.silverMid,
    right: 112,
    top: -24,
  },
  navDiagonalRed: {
    backgroundColor: colors.red,
    right: 64,
    top: -12,
  },
  navDiagonalCharcoal: {
    backgroundColor: colors.black,
    right: 16,
    top: 0,
  },
  navStripeShadeTop: {
    backgroundColor: 'rgba(255,255,255,0.26)',
    bottom: 0,
    left: 0,
    position: 'absolute',
    top: 0,
    width: 8,
  },
  navStripeShadeBottom: {
    backgroundColor: 'rgba(0,0,0,0.22)',
    bottom: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    width: 10,
  },
  navCardContent: {
    justifyContent: 'center',
    minHeight: NAV_CARD_H,
    paddingHorizontal: 24,
    paddingVertical: 24,
  },
  navCardTitle: {
    color: colors.white,
    fontFamily: fonts.display,
    fontSize: 38,
    fontWeight: '800',
    lineHeight: 40,
    textTransform: 'uppercase',
  },
});
