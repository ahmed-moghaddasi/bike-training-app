import { DEFAULT_DETECTION_CONFIG, type DetectionConfig } from './types';
import { circleDetectionConfig } from './drills/circle';
import { figureEightDetectionConfig } from './drills/figure-eight';
import { hairpinDetectionConfig } from './drills/hairpin';
import { lTurnDetectionConfig } from './drills/l-turn';

const overridesByDrillId: Record<string, Partial<DetectionConfig>> = {
  circle: circleDetectionConfig,
  'figure-eight': figureEightDetectionConfig,
  hairpin: hairpinDetectionConfig,
  'l-turn': lTurnDetectionConfig,
};

/** Merges a drill's overrides (src/lib/detection/drills/<drillId>.ts) onto the shared defaults. */
export function getDetectionConfigForDrill(drillId: string): DetectionConfig {
  return { ...DEFAULT_DETECTION_CONFIG, ...(overridesByDrillId[drillId] ?? {}) };
}

export { DEFAULT_DETECTION_CONFIG };
export type { DetectionConfig, CrossingOrientation } from './types';
