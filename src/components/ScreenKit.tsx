import { Pressable, ScrollView, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { colors, fonts, radius, shadows, spacing, tracking } from '../theme';
import type { Bike, GoFn, Lap } from '../types';
import { BikeSelector } from './BikeSelector';
import { BottomNav, type BottomNavItem } from './BottomNav';

/** Shared 4-item nav used by every redesigned screen — glyphs match the mock's timing-tower iconography. */
export function buildNavItems(go: GoFn): BottomNavItem[] {
  return [
    { key: 'drills', glyph: '◆', label: 'Drills', onPress: () => go({ name: 'drills' }) },
    { key: 'sessions', glyph: '□', label: 'Session Log', onPress: () => go({ name: 'sessions' }) },
    { key: 'progress', glyph: '△', label: 'Progression', onPress: () => go({ name: 'progress' }) },
    { key: 'home', glyph: '○', label: 'Home', onPress: () => go({ name: 'home' }) },
  ];
}

/** Dark-theme screen primitives shared by the redesigned Drills/Detail/Session/Progression screens. */

export function Page({
  children,
  title,
  subtitle,
  bike,
  onSwitchBike,
  onBack,
  navItems,
  activeNavKey,
}: {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  bike?: Bike;
  onSwitchBike?: () => void;
  /** Shows a small back chevron next to the bike pill — the redesign's static comps don't model back navigation, but this app's routing is a stack, not flat tabs, so screens reached from more than one place need a way out. */
  onBack?: () => void;
  navItems?: BottomNavItem[];
  activeNavKey?: string;
}) {
  return (
    <View style={styles.wrapper}>
      <ScrollView contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>
        {(bike || onBack) && (
          <View style={styles.topRow}>
            {onBack && (
              <Pressable onPress={onBack} style={styles.backButton} accessibilityRole="button" accessibilityLabel="Back">
                <Text style={styles.backButtonText}>←</Text>
              </Pressable>
            )}
            {bike && <BikeSelector bike={bike} onPress={onSwitchBike ?? (() => {})} />}
          </View>
        )}
        {title && (
          <View style={styles.pageHeader}>
            <Text style={styles.pageTitle}>{title}</Text>
            {subtitle && <Text style={styles.pageSubtitle}>{subtitle}</Text>}
          </View>
        )}
        {children}
      </ScrollView>
      {navItems && activeNavKey && (
        <BottomNav items={navItems} activeKey={activeNavKey} style={styles.floatingNav} />
      )}
    </View>
  );
}

export function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{label}</Text>
      {children}
    </View>
  );
}

export function PrimaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.primaryButton}>
      <Text style={styles.primaryButtonText}>{label}</Text>
    </Pressable>
  );
}

export function SecondaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.secondaryButton}>
      <Text style={styles.secondaryButtonText}>{label}</Text>
    </Pressable>
  );
}

export function BulletList({ items, accent }: { items: string[]; accent?: boolean }) {
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

export function NumberedList({ items }: { items: string[] }) {
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

export function StatGrid({ items }: { items: [string, string][] }) {
  return (
    <View style={styles.statGrid}>
      {items.map(([label, value]) => (
        <MetricMini key={label} label={label} value={value} />
      ))}
    </View>
  );
}

export function MetricMini({ label, value }: { label: string; value: string }) {
  const isBest = label === 'Best' || label === 'Best Stop' || label === 'Best Score' || label === 'Latest Best';
  return (
    <View style={styles.statMini}>
      <Text style={[styles.statMiniValue, isBest && styles.statMiniValueBest]}>{value}</Text>
      <Text style={styles.statMiniLabel}>{label}</Text>
    </View>
  );
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.cardSub}>{body}</Text>
    </View>
  );
}

const lapTagLabels: Record<'warmup' | 'cooldown' | 'break', string> = {
  warmup: 'Warm-up',
  cooldown: 'Cool-down',
  break: 'Break',
};

export function LapList({ laps, isStraightLine }: { laps: Lap[]; isStraightLine?: boolean }) {
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
            <Text style={[styles.lapTime, accent]}>{lap.time.toFixed(2)}</Text>
            {lap.entrySpeedKph != null && <Text style={styles.lapSpeed}>{lap.entrySpeedKph.toFixed(0)} km/h</Text>}
            {isBest && <Text style={styles.pbText}>PB</Text>}
            {tag && <Text style={styles.lapTag}>{tag}</Text>}
          </View>
        );
      })}
    </View>
  );
}

const HAIRLINE = 'rgba(242,241,240,0.14)';

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: colors.ink950,
  },
  page: {
    paddingHorizontal: spacing.pageX,
    paddingBottom: spacing.pageBottom + 70,
    paddingTop: 18,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 20,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(242,241,240,0.08)',
    borderWidth: 1,
    borderColor: HAIRLINE,
  },
  backButtonText: {
    color: colors.mist100,
    fontSize: 16,
    fontFamily: fonts.body,
  },
  floatingNav: {
    position: 'absolute',
    bottom: 14,
    alignSelf: 'center',
  } satisfies ViewStyle,
  pageHeader: {
    marginBottom: 18,
  },
  pageTitle: {
    color: colors.mist100,
    fontFamily: fonts.title,
    fontSize: 32,
    letterSpacing: tracking.hero,
    lineHeight: 36,
    textTransform: 'uppercase',
  },
  pageSubtitle: {
    color: colors.mist300,
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
  },
  section: {
    marginBottom: 20,
  },
  sectionLabel: {
    borderBottomColor: HAIRLINE,
    borderBottomWidth: 1,
    color: colors.mist500,
    fontFamily: fonts.title,
    fontSize: 11,
    letterSpacing: tracking.wide,
    marginBottom: 12,
    paddingBottom: 8,
    textTransform: 'uppercase',
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: colors.red500,
    borderRadius: radius.pill,
    marginBottom: 20,
    minHeight: 54,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  primaryButtonText: {
    color: colors.mist100,
    fontFamily: fonts.title,
    fontSize: 12,
    letterSpacing: tracking.wide,
    textTransform: 'uppercase',
  },
  secondaryButton: {
    alignItems: 'center',
    borderColor: HAIRLINE,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    flex: 1,
    minHeight: 50,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  secondaryButtonText: {
    color: colors.mist100,
    fontFamily: fonts.title,
    fontSize: 11,
    letterSpacing: tracking.wide,
    textTransform: 'uppercase',
  },
  bodyText: {
    color: colors.mist300,
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
    color: colors.mist300,
    fontFamily: fonts.title,
    fontSize: 18,
    lineHeight: 23,
  },
  bulletAccent: {
    color: colors.red500,
  },
  number: {
    color: colors.red500,
    fontFamily: fonts.number,
    fontSize: 13,
    lineHeight: 23,
    minWidth: 18,
  },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 18,
  },
  statMini: {
    backgroundColor: colors.graphite800,
    borderColor: HAIRLINE,
    borderRadius: radius.md,
    borderWidth: 1,
    boxShadow: shadows.tight,
    flexGrow: 1,
    minWidth: '45%',
    padding: 14,
  },
  statMiniValue: {
    color: colors.mist100,
    fontFamily: fonts.number,
    fontSize: 19,
    letterSpacing: tracking.tightNum,
  },
  statMiniValueBest: {
    color: colors.pbBest,
  },
  statMiniLabel: {
    color: colors.mist500,
    fontFamily: fonts.title,
    fontSize: 10,
    letterSpacing: tracking.wide,
    marginTop: 5,
    textTransform: 'uppercase',
  },
  emptyState: {
    backgroundColor: colors.graphite800,
    borderColor: HAIRLINE,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: 8,
    padding: 18,
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
  lapList: {
    gap: 8,
  },
  lapRow: {
    alignItems: 'center',
    backgroundColor: colors.graphite800,
    borderRadius: radius.sm,
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  lapRowBest: {
    backgroundColor: 'rgba(139,92,246,0.16)',
  },
  lapNum: {
    color: colors.mist500,
    fontFamily: fonts.title,
    fontSize: 11,
    width: 34,
  },
  lapTime: {
    color: colors.mist100,
    flex: 1,
    fontFamily: fonts.number,
    fontSize: 16,
    letterSpacing: tracking.tightNum,
  },
  lapTextBest: {
    color: colors.pbBestOnDark,
  },
  lapTextImproving: {
    color: colors.improving,
  },
  lapTextCaution: {
    color: colors.caution,
  },
  pbText: {
    color: colors.pbBestOnDark,
    fontFamily: fonts.title,
    fontSize: 11,
  },
  lapTag: {
    color: colors.mist500,
    fontFamily: fonts.title,
    fontSize: 10,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  lapSpeed: {
    color: colors.mist500,
    fontFamily: fonts.number,
    fontSize: 13,
  },
});
