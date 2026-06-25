import type { DetectionConfig } from '../types';

/**
 * L-Turn: camera outside exit, diagonal back toward entry. Like Hairpin,
 * timing runs approach-line-to-exit-gate per rep rather than a repeated lap
 * through one point.
 */
export const lTurnDetectionConfig: Partial<DetectionConfig> = {};
