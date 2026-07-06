import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius, tracking } from '../theme';
import type { Bike } from '../types';

interface BikeSelectorProps {
  bike: Bike;
  photoUri?: string;
  onPress: () => void;
}

/** Top-bar pill: bike photo (or initials fallback) + name. Tap to open the bike-switch sheet. */
export function BikeSelector({ bike, photoUri, onPress }: BikeSelectorProps) {
  const initials = bike.name
    .split(' ')
    .map((word) => word[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <Pressable
      style={styles.pill}
      onPress={onPress}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={`Switch bike, current: ${bike.name}`}
    >
      <View style={styles.photo}>
        {photoUri ? (
          <Image source={{ uri: photoUri }} style={styles.photoImage} />
        ) : (
          <Text style={styles.photoInitials}>{initials}</Text>
        )}
      </View>
      <Text style={styles.name} numberOfLines={1}>
        {bike.name}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 44,
    paddingRight: 14,
    paddingLeft: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(242,241,240,0.14)',
    backgroundColor: 'rgba(242,241,240,0.08)',
  },
  photo: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: colors.graphite700,
    borderWidth: 1,
    borderColor: 'rgba(242,241,240,0.18)',
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  photoInitials: {
    color: colors.mist300,
    fontFamily: fonts.title,
    fontSize: 11,
  },
  name: {
    color: colors.mist100,
    fontFamily: fonts.title,
    fontSize: 12,
    letterSpacing: tracking.wide,
    textTransform: 'uppercase',
    maxWidth: 140,
  },
});
