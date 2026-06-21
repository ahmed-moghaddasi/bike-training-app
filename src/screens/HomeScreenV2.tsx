import { useEffect, useMemo, useState } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
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

// ─── Nav card stack constants ────────────────────────────────────────────────

const NAV_CARD_H = 148;       // approximate rendered height of each nav card
const NAV_PEEK   = 48;        // px of back card visible below front card (stacked state)
const NAV_GAP    = 14;        // px gap between cards (expanded) — matches cardList gap
// Total travel of the back card from peeking → natural position
const NAV_TRAVEL = NAV_CARD_H - NAV_PEEK + NAV_GAP; // 114

// Scroll range over which the stack opens/closes.
// The nav section sits ~900px down the page. On a typical phone (~844px tall)
// it enters the viewport at scroll ≈ 60px and is fully in view by ~400px.
const STACK_SCROLL_START = 60;
const STACK_SCROLL_END   = 400;

// ─────────────────────────────────────────────────────────────────────────────

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
  const scrollY = useMemo(() => new Animated.Value(0), []);
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
        .slice(0, 2),
    [actualSessions],
  );

  const workingDrills = useMemo(
    () => {
      const recentDrillIds = [...actualSessions]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .map((session) => session.drillId)
        .filter((id, index, all) => all.indexOf(id) === index)
        .slice(0, 2);
      return recentDrillIds.map((id) => drills.find((drill) => drill.id === id)).filter(Boolean) as Drill[];
    },
    [actualSessions],
  );

  // ── Nav card animation (scroll-driven, reversible) ────────────────────────
  //
  // Back card starts at translateY=0 (peeking NAV_PEEK px below front card).
  // As scrollY increases it slides down to translateY=NAV_TRAVEL (natural pos).
  // Scrolling back up reverses this automatically — no spring, no one-shot flag.

  const navBackTranslateY = scrollY.interpolate({
    inputRange: [STACK_SCROLL_START, STACK_SCROLL_END],
    outputRange: [0, NAV_TRAVEL],
    extrapolate: 'clamp',
  });

  const navBackScale = scrollY.interpolate({
    inputRange: [STACK_SCROLL_START, STACK_SCROLL_END],
    outputRange: [0.96, 1],
    extrapolate: 'clamp',
  });

  const navBackOpacity = scrollY.interpolate({
    inputRange: [STACK_SCROLL_START, STACK_SCROLL_END],
    outputRange: [0.75, 1],
    extrapolate: 'clamp',
  });

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <View style={styles.wrapper}>
      <Animated.ScrollView
        contentContainerStyle={styles.page}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true },
        )}
        scrollEventThrottle={16}
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

        {/* ── Drill Library CTA ────────────────────────────────────── */}
        <Pressable style={styles.libraryButton} onPress={onOpenDrills}>
          <Text style={styles.libraryButtonText}>Open Drill Library</Text>
        </Pressable>

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

        {/* ── Go To — stacked red nav cards ────────────────────────── */}
        <RuleLabel text="Go To" />
        <View>
          {/* Sessions card: FRONT — rendered first so it occupies y=0..NAV_CARD_H */}
          <View style={styles.navFrontSlot}>
            <NavCard
              title="Sessions"
              sub="Training diary"
              variant="front"
              onPress={onOpenSessions}
            />
          </View>

          {/*
            Progress card: BACK — rendered second with a negative marginTop so
            its layout top sits NAV_PEEK px below the front card's bottom edge,
            making exactly NAV_PEEK px of it visible in the stacked state.
            translateY animates 0 → NAV_TRAVEL to slide it to its natural position.
          */}
          <Animated.View
            style={[
              styles.navBackSlot,
              {
                marginTop: -(NAV_CARD_H - NAV_PEEK),
                opacity: navBackOpacity,
                transform: [
                  { translateY: navBackTranslateY },
                  { scale: navBackScale },
                ],
              },
            ]}
          >
            <NavCard
              title="Progress"
              sub="Lap trends by drill"
              variant="back"
              onPress={onOpenProgress}
            />
          </Animated.View>

          {/* Spacer: absorbs NAV_TRAVEL so nothing below collides with the back card */}
          <View style={{ height: NAV_TRAVEL + 16 }} />
        </View>
      </Animated.ScrollView>

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
  sub,
  variant,
  onPress,
}: {
  title: string;
  sub: string;
  variant: 'front' | 'back';
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.navCard, variant === 'back' && styles.navCardBack]}
      onPress={onPress}
    >
      <View style={[styles.navStripeRail, variant === 'back' && styles.navStripeRailBack]} pointerEvents="none">
        {[0, 1, 2, 3, 4, 5].map((stripe) => (
          <View key={stripe} style={[styles.navStripe, stripe % 2 === 1 && styles.navStripeDark]} />
        ))}
      </View>
      <View style={styles.navCardContent}>
        <Text style={styles.navEyebrow}>Go To</Text>
        <View style={styles.navCardInner}>
          <View style={{ flex: 1 }}>
            <Text style={styles.navCardTitle}>{title}</Text>
            <Text style={styles.navCardSub}>{sub}</Text>
          </View>
          <Text style={styles.navCardArrow}>↗</Text>
        </View>
      </View>
    </Pressable>
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

  // ── Library button ────────────────────────────────────────────────
  libraryButton: {
    alignItems: 'center',
    backgroundColor: colors.red,
    borderRadius: radius.pill,
    justifyContent: 'center',
    marginBottom: 30,
    minHeight: 54,
    paddingHorizontal: 24,
  },
  libraryButtonText: {
    color: colors.white,
    fontFamily: fonts.display,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.0,
    textTransform: 'uppercase',
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

  // ── Nav card stack ────────────────────────────────────────────────
  // Front card (Sessions) renders first in JSX and sits on top visually.
  // Back card (Progress) renders second with negative marginTop and sits behind.
  navFrontSlot: {
    zIndex: 2,
    elevation: 2,
  },
  navBackSlot: {
    zIndex: 1,
    elevation: 1,
  },

  navCard: {
    backgroundColor: colors.red,
    borderRadius: radius.md,
    minHeight: NAV_CARD_H,
    overflow: 'hidden',
  },
  navCardBack: {
    backgroundColor: '#D42600', // slightly deeper red for depth
  },
  navStripeRail: {
    backgroundColor: 'rgba(43,41,41,0.22)',
    bottom: 0,
    justifyContent: 'space-evenly',
    left: 0,
    paddingVertical: 8,
    position: 'absolute',
    top: 0,
    width: 48,
  },
  navStripeRailBack: {
    backgroundColor: 'rgba(43,41,41,0.34)',
  },
  navStripe: {
    backgroundColor: 'rgba(242,241,240,0.18)',
    height: 12,
    width: '100%',
  },
  navStripeDark: {
    backgroundColor: 'rgba(13,12,12,0.16)',
  },
  navCardContent: {
    minHeight: NAV_CARD_H,
    paddingBottom: 24,
    paddingLeft: 72,
    paddingRight: 24,
    paddingTop: 24,
  },
  navEyebrow: {
    color: 'rgba(255,255,255,0.6)',
    fontFamily: fonts.display,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2.0,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  navCardInner: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  navCardTitle: {
    color: colors.white,
    fontFamily: fonts.display,
    fontSize: 40,
    fontWeight: '800',
    letterSpacing: -0.5,
    lineHeight: 42,
    textTransform: 'uppercase',
  },
  navCardSub: {
    color: 'rgba(255,255,255,0.75)',
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
  },
  navCardArrow: {
    color: 'rgba(255,255,255,0.55)',
    fontFamily: fonts.display,
    fontSize: 28,
    fontWeight: '800',
    paddingBottom: 4,
  },
});
