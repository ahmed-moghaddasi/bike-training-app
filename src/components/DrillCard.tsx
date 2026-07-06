import { ImageBackground, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, fonts, radius, tracking } from '../theme';

interface DrillCardProps {
  index: number;
  name: string;
  skillTag: string;
  meta?: string;
  imageUri?: string;
  isReady?: boolean;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}

/** Full-bleed photo card with number badge + skill tag. Used in the dashboard carousel and drills library list — pass `style` to override the default fixed carousel width (e.g. `{ width: '100%' }` for a vertical list). */
export function DrillCard({ index, name, skillTag, meta, imageUri, isReady = true, onPress, style }: DrillCardProps) {
  return (
    <Pressable
      onPress={isReady ? onPress : undefined}
      style={[styles.card, !isReady && styles.cardMuted, style]}
      accessibilityRole="button"
      accessibilityLabel={isReady ? name : `${name}, coming soon`}
      accessibilityState={{ disabled: !isReady }}
    >
      {imageUri ? (
        <ImageBackground source={{ uri: imageUri }} style={StyleSheet.absoluteFill}>
          <View style={styles.scrim} />
        </ImageBackground>
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.imageFallback]} />
      )}

      <View style={styles.top}>
        <Text style={styles.index}>{String(index).padStart(2, '0')}</Text>
        <View style={[styles.badge, !isReady && styles.badgeMuted]}>
          <Text style={[styles.badgeText, !isReady && styles.badgeTextMuted]}>{skillTag}</Text>
        </View>
      </View>
      <View>
        <Text style={styles.name} numberOfLines={2}>
          {name}
        </Text>
        {meta ? (
          <Text style={styles.meta} numberOfLines={1}>
            {meta}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 262,
    minHeight: 174,
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(242,241,240,0.15)',
    overflow: 'hidden',
    backgroundColor: colors.graphite800,
  },
  cardMuted: {
    opacity: 0.55,
  },
  imageFallback: {
    backgroundColor: colors.graphite800,
  },
  scrim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(5,6,6,0.4)',
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  index: {
    color: 'rgba(242,241,240,0.68)',
    fontFamily: fonts.number,
    fontSize: 13,
  },
  badge: {
    paddingVertical: 7,
    paddingHorizontal: 9,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(244,58,47,0.86)',
  },
  badgeMuted: {
    backgroundColor: 'rgba(242,241,240,0.14)',
  },
  badgeText: {
    color: colors.mist100,
    fontFamily: fonts.title,
    fontSize: 8,
    letterSpacing: tracking.wide,
    textTransform: 'uppercase',
  },
  badgeTextMuted: {
    color: colors.mist300,
  },
  name: {
    maxWidth: 210,
    color: colors.mist100,
    fontFamily: fonts.title,
    fontSize: 18,
    lineHeight: 21,
    textTransform: 'uppercase',
  },
  meta: {
    marginTop: 14,
    color: 'rgba(242,241,240,0.7)',
    fontFamily: fonts.body,
    fontSize: 12,
  },
});
