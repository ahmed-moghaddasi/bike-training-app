import { ImageBackground, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius, tracking } from '../theme';

export type SessionCardStat = {
  label: string;
  value: string;
};

interface SessionCardProps {
  time: string;
  orderLabel: string;
  drillName: string;
  note?: string;
  stats: SessionCardStat[];
  imageUri?: string;
  onPress: () => void;
}

/** Compact card: time + order pill, drill name, note, and a 3-stat row. Used in session log day groups. */
export function SessionCard({ time, orderLabel, drillName, note, stats, imageUri, onPress }: SessionCardProps) {
  return (
    <Pressable
      onPress={onPress}
      style={styles.card}
      accessibilityRole="button"
      accessibilityLabel={`${drillName} at ${time}`}
    >
      {imageUri ? (
        <ImageBackground source={{ uri: imageUri }} style={StyleSheet.absoluteFill}>
          <View style={styles.scrim} />
        </ImageBackground>
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.imageFallback]} />
      )}

      <View style={styles.top}>
        <Text style={styles.time}>{time}</Text>
        <View style={styles.pill}>
          <Text style={styles.pillText}>{orderLabel}</Text>
        </View>
      </View>
      <View>
        <Text style={styles.name} numberOfLines={1}>
          {drillName}
        </Text>
        {note ? (
          <Text style={styles.note} numberOfLines={2}>
            {note}
          </Text>
        ) : null}
        <View style={styles.statsRow}>
          {stats.map((stat) => (
            <View key={stat.label} style={styles.stat}>
              <Text style={styles.statLabel} numberOfLines={1}>
                {stat.label}
              </Text>
              <Text style={styles.statValue} numberOfLines={1}>
                {stat.value}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 252,
    minHeight: 168,
    justifyContent: 'space-between',
    padding: 15,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(242,241,240,0.17)',
    overflow: 'hidden',
    backgroundColor: colors.graphite800,
  },
  imageFallback: {
    backgroundColor: colors.graphite800,
  },
  scrim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(5,6,6,0.42)',
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  time: {
    color: 'rgba(242,241,240,0.72)',
    fontFamily: fonts.number,
    fontSize: 13,
  },
  pill: {
    paddingVertical: 7,
    paddingHorizontal: 9,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(244,58,47,0.82)',
  },
  pillText: {
    color: colors.mist100,
    fontFamily: fonts.title,
    fontSize: 7,
    letterSpacing: tracking.wide,
    textTransform: 'uppercase',
  },
  name: {
    color: colors.mist100,
    fontFamily: fonts.title,
    fontSize: 18,
    lineHeight: 20,
    textTransform: 'uppercase',
  },
  note: {
    marginTop: 8,
    color: 'rgba(242,241,240,0.74)',
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 16,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  stat: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 8,
    paddingHorizontal: 7,
    borderRadius: 9,
    backgroundColor: 'rgba(5,6,6,0.42)',
  },
  statLabel: {
    color: 'rgba(242,241,240,0.58)',
    fontFamily: fonts.title,
    fontSize: 6,
    textTransform: 'uppercase',
  },
  statValue: {
    marginTop: 6,
    color: colors.mist100,
    fontFamily: fonts.number,
    fontSize: 15,
  },
});
