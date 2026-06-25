import type { DetectionConfig } from '../types';

/**
 * Hairpin: camera outside the apex, angled back toward the brake cone and
 * forward to the exit gate. Timing is brake-cone-to-exit-gate rather than a
 * repeated lap through one point, so a single rep may need different
 * cooldown/sequence timing than a continuous-lap drill like Circle.
 */
export const hairpinDetectionConfig: Partial<DetectionConfig> = {};
