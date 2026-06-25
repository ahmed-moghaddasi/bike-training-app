import type { DetectionConfig } from '../types';

/**
 * Circle: camera looks across the loop, bike crosses the gate left-to-right
 * and right-to-left twice per circle (see the drill's detectionsPerLap).
 * Real lot data (2026-06-25): a full circle took ~5s, i.e. ~2.5s between the
 * two crossings — cooldownMs must stay comfortably under that even for a
 * faster rider. Tune here as more real sessions come in.
 */
export const circleDetectionConfig: Partial<DetectionConfig> = {};
