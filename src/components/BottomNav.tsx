import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, fonts, radius } from '../theme';

export type BottomNavItem = {
  key: string;
  glyph: string;
  label: string;
  onPress: () => void;
};

interface BottomNavProps {
  items: BottomNavItem[];
  activeKey: string;
  style?: StyleProp<ViewStyle>;
}

/** Floating pill nav — geometric glyphs match the redesign's timing-tower iconography (◆ □ △ ○). */
export function BottomNav({ items, activeKey, style }: BottomNavProps) {
  return (
    <View style={[styles.bar, style]}>
      {items.map((item) => {
        const active = item.key === activeKey;
        return (
          <Pressable
            key={item.key}
            onPress={item.onPress}
            style={[styles.item, active && styles.itemActive]}
            accessibilityRole="button"
            accessibilityLabel={item.label}
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.glyph, active && styles.glyphActive]}>{item.glyph}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignSelf: 'center',
    gap: 4,
    padding: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(242,241,240,0.14)',
    backgroundColor: 'rgba(242,241,240,0.08)',
  },
  item: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
  },
  itemActive: {
    backgroundColor: 'rgba(242,241,240,0.12)',
  },
  glyph: {
    fontSize: 16,
    lineHeight: 16,
    color: 'rgba(242,241,240,0.72)',
    fontFamily: fonts.body,
  },
  glyphActive: {
    color: colors.mist100,
  },
});
