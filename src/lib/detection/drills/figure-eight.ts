import type { DetectionConfig } from '../types';

/**
 * Figure Eight: camera sits near the crossover cone, offset outside the
 * riding path, watching the rider cross that one line each lap. Vertical
 * crossing fits the described placement; revisit if camera angle changes.
 */
export const figureEightDetectionConfig: Partial<DetectionConfig> = {};
