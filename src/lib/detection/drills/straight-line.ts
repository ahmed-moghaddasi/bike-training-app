import type { DetectionConfig } from '../types';

/**
 * Straight Line: detection is handled by straightLineDetector.ts (detectBrakingReps),
 * not the lap-crossing pipeline. This config is a no-op placeholder that keeps the
 * drill registered in the detection index for consistency.
 */
export const straightLineDetectionConfig: Partial<DetectionConfig> = {};
