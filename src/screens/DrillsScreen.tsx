import { StyleSheet, Text, View } from 'react-native';
import { DrillCard } from '../components/DrillCard';
import { buildNavItems, Page } from '../components/ScreenKit';
import { bikes, drills } from '../data/seed';
import { colors, fonts, tracking } from '../theme';
import type { DrillGroup, GoFn } from '../types';

const DRILL_GROUP_ORDER: { key: DrillGroup; label: string; copy: string }[] = [
  {
    key: 'foundations',
    label: 'The Foundations',
    copy: 'Foundation drills build comfort with the individual skills you use on track. Repeat them cleanly until they become muscle memory.',
  },
  {
    key: 'race-craft',
    label: 'Race Craft',
    copy: 'Advanced mechanics used on a real track: apex selection, racing lines, and trail braking. Assumes solid Foundations habits.',
  },
];

/** First word of whatThisTrains reads like a skill tag on the card (e.g. "Constant-radius cornering" → "Constant-radius"). */
function skillTag(drill: { whatThisTrains: string[] }): string {
  const first = drill.whatThisTrains[0] ?? 'Skill';
  return first.split(' ').slice(0, 2).join(' ');
}

export function DrillsScreen({ currentBikeId, go }: { currentBikeId: string; go: GoFn }) {
  const bike = bikes.find((b) => b.id === currentBikeId) ?? bikes[0];

  return (
    <Page bike={bike} navItems={buildNavItems(go)} activeNavKey="drills">
      <View style={styles.header}>
        <Text style={styles.title}>Drills</Text>
        <Text style={styles.subtitle}>Choose the setup you want to practice.</Text>
      </View>
      {DRILL_GROUP_ORDER.map(({ key, label, copy }) => {
        const groupDrills = drills.filter((drill) => drill.group === key);
        if (groupDrills.length === 0) return null;
        return (
          <View key={key} style={styles.section}>
            <Text style={styles.sectionTitle}>{label}</Text>
            <Text style={styles.sectionCopy}>{copy}</Text>
            <View style={styles.list}>
              {groupDrills.map((drill, index) => (
                <DrillCard
                  key={drill.id}
                  index={index + 1}
                  name={drill.name}
                  skillTag={drill.isReady ? skillTag(drill) : 'Coming soon'}
                  meta={drill.shortDescription}
                  isReady={drill.isReady}
                  onPress={() => go({ name: 'drill', drillId: drill.id, returnTo: { name: 'drills' } })}
                  style={styles.card}
                />
              ))}
            </View>
          </View>
        );
      })}
    </Page>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: 24,
  },
  title: {
    color: colors.mist100,
    fontFamily: fonts.title,
    fontSize: 32,
    letterSpacing: tracking.hero,
    lineHeight: 36,
    textTransform: 'uppercase',
  },
  subtitle: {
    color: colors.mist300,
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
  },
  section: {
    marginBottom: 28,
  },
  sectionTitle: {
    color: colors.mist100,
    fontFamily: fonts.title,
    fontSize: 18,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  sectionCopy: {
    color: colors.mist300,
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 16,
  },
  list: {
    gap: 14,
  },
  card: {
    width: '100%',
  },
});
