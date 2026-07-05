import type { DetectionConfig } from '../types';

/**
 * Figure Eight: camera sits near the crossover cone, offset just outside the
 * riding path, aimed at the timing line through the center. The rider crosses
 * that line twice per full figure-eight cycle — once going each direction —
 * exactly like Circle's left/right split, so detectionsPerLap stays at 2.
 *
 * Starting values are copied from Circle's tuned config because the camera
 * geometry is similar (bike is small and far, crossing a narrow vertical zone
 * once per direction). Every parameter here should be re-validated against
 * real figure-eight footage and updated with observed crossing counts and any
 * false-fire or missed-lap incidents before trusting the numbers in production.
 *
 * Differences from Circle to watch for once footage is available:
 * - zoneWidthRatio: crossover is a single point, not a full lap line, so the
 *   active zone may need to be wider or narrower depending on camera distance.
 * - sequenceTimeoutMs: half-lap duration on a figure-eight is longer than a
 *   circle half because the rider completes an entire circle before returning
 *   to the crossover — expect longer gaps between crossings.
 * - duplicateDirectionWindowMs: same logic as Circle; tune once fastest real
 *   half-lap gap is known.
 * - breakDetectionEnabled: true for the same reason as Circle — continuous
 *   riding where the rider can pause without stopping the recording.
 */
export const figureEightDetectionConfig: Partial<DetectionConfig> = {
  zoneWidthRatio: 0.09,
  sampleWidth: 96,
  sampleHeight: 160,
  sequenceTimeoutMs: 2_500,
  minActiveMs: 50,
  duplicateDirectionWindowMs: 1_900,
  breakDetectionEnabled: true,
};
