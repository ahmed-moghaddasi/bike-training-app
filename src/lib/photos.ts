import type { ImageSourcePropType } from 'react-native';

/** Card background photos, bundled locally — Metro requires static literal paths, so this is a lookup table rather than a dynamic path. */
export const DRILL_PHOTOS: Record<string, ImageSourcePropType> = {
  circle: require('../../assets/photos/drill-circle.jpg'),
  'straight-line': require('../../assets/photos/drill-straight-line.jpg'),
  loop: require('../../assets/photos/drill-loop.jpg'),
  'figure-eight': require('../../assets/photos/drill-figure-eight.jpg'),
};

export const SHORTCUT_PHOTOS = {
  progression: require('../../assets/photos/shortcut-progression.jpg') as ImageSourcePropType,
  sessionLog: require('../../assets/photos/shortcut-session-log.jpg') as ImageSourcePropType,
};
