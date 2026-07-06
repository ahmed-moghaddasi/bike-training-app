import { Pressable, StyleSheet, Text, View } from 'react-native';
import { DrillDiagram } from '../components/DrillDiagram';
import { buildNavItems, BulletList, NumberedList, Page, Section } from '../components/ScreenKit';
import { bikes, drills } from '../data/seed';
import { colors, fonts, radius, tracking } from '../theme';
import type { GoFn } from '../types';

export function DrillDetailScreen({ drillId, currentBikeId, onBack, go }: { drillId: string; currentBikeId: string; onBack: () => void; go: GoFn }) {
  const drill = drills.find((item) => item.id === drillId) ?? drills[0];
  const setup = drill.setupVariants.find((variant) => variant.id === drill.defaultSetupVariantId) ?? drill.setupVariants[0];
  const bike = bikes.find((b) => b.id === currentBikeId) ?? bikes[0];
  const navItems = [
    ...buildNavItems(go),
    { key: 'record', glyph: '●', label: 'Record', onPress: () => go({ name: 'camera', drillId, returnTo: { name: 'drill', drillId } }) },
  ];

  return (
    <Page bike={bike} onSwitchBike={() => {}} onBack={onBack} navItems={navItems} activeNavKey="drills">
      <View style={styles.titleBlock}>
        <Text style={styles.title}>{drill.name}</Text>
        <View style={styles.tagPill}>
          <Text style={styles.tagPillText}>{setup.name}</Text>
        </View>
      </View>
      <Text style={styles.subtitle}>{drill.shortDescription}</Text>

      <View style={styles.diagramCard}>
        <DrillDiagram type={drill.diagramKey} variant="detail" />
        <Text style={styles.rideHeading}>How to ride it</Text>
        <NumberedList items={drill.howToRideSteps} />
      </View>

      <Section label="Coaching Notes">
        <BulletList items={drill.coachingCues} accent />
      </Section>

      <Section label="Common Mistakes">
        <BulletList items={drill.commonMistakes} />
      </Section>

      <Section label="What This Trains">
        <Text style={styles.bodyText}>{drill.whyItMatters}</Text>
        <BulletList items={drill.whatThisTrains} />
      </Section>

      {drill.progressions.length > 0 && (
        <Section label="Progression">
          {drill.progressions.map((progression) => (
            <View key={progression.title} style={styles.progressionBlock}>
              <Text style={styles.progressionTitle}>{progression.title}</Text>
              <Text style={styles.bodyText}>{progression.description}</Text>
            </View>
          ))}
        </Section>
      )}

      <Pressable
        style={styles.recordButton}
        onPress={() => go({ name: 'camera', drillId, returnTo: { name: 'drill', drillId } })}
        accessibilityRole="button"
        accessibilityLabel="Record drill"
      >
        <View style={styles.recordDot} />
        <Text style={styles.recordButtonText}>Record Drill</Text>
      </Pressable>
    </Page>
  );
}

const styles = StyleSheet.create({
  titleBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 8,
  },
  title: {
    flex: 1,
    color: colors.mist100,
    fontFamily: fonts.title,
    fontSize: 24,
    letterSpacing: tracking.hero,
    textTransform: 'uppercase',
  },
  tagPill: {
    backgroundColor: 'rgba(244,58,47,0.16)',
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  tagPillText: {
    color: colors.red500,
    fontFamily: fonts.title,
    fontSize: 10,
    letterSpacing: tracking.wide,
    textTransform: 'uppercase',
  },
  subtitle: {
    color: colors.mist300,
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 22,
  },
  diagramCard: {
    marginBottom: 24,
    padding: 14,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(242,241,240,0.68)',
    backgroundColor: colors.silver100,
  },
  rideHeading: {
    marginTop: 14,
    color: 'rgba(5,6,6,0.56)',
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  bodyText: {
    color: colors.mist300,
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 22,
  },
  progressionBlock: {
    backgroundColor: colors.graphite800,
    borderColor: 'rgba(242,241,240,0.14)',
    borderRadius: radius.md,
    borderWidth: 1,
    marginBottom: 10,
    padding: 14,
  },
  progressionTitle: {
    color: colors.mist100,
    fontFamily: fonts.title,
    fontSize: 15,
    marginBottom: 6,
  },
  recordButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    height: 54,
    marginTop: 8,
    marginBottom: 20,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(242,241,240,0.14)',
    backgroundColor: 'rgba(244,58,47,0.86)',
  },
  recordDot: {
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: colors.mist100,
  },
  recordButtonText: {
    color: colors.mist100,
    fontFamily: fonts.title,
    fontSize: 12,
    letterSpacing: tracking.wide,
    textTransform: 'uppercase',
  },
});
