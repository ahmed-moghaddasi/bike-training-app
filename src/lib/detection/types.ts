/**
 * 'vertical' = a left/right split; the bike crosses the gate left-to-right or
 * right-to-left (camera looking across the rider's path).
 * 'horizontal' = a top/bottom split; the bike crosses top-to-bottom or
 * bottom-to-top (camera looking along the rider's path, e.g. head-on).
 */
export type CrossingOrientation = 'vertical' | 'horizontal';

export type DetectionConfig = {
  orientation: CrossingOrientation;
  /** Width (vertical orientation) or height (horizontal orientation) of the cropped detection strip, as a ratio of the matching frame dimension. Also drives the on-screen aim overlay. */
  zoneWidthRatio: number;
  sampleWidth: number;
  sampleHeight: number;
  /** Luminance delta (0-255) required for a sampled pixel to count as changed. */
  pixelDeltaThreshold: number;
  /** Fraction (0-1) of changed pixels required to activate either half of the zone. */
  changedRatioThreshold: number;
  /** How long a half must stay active before it's treated as a real crossing side, not a flicker. */
  minActiveMs: number;
  /** Minimum gap between two confirmed crossings — must be shorter than the fastest realistic gap between two passes on this drill. */
  cooldownMs: number;
  /** How long the second half has to confirm after the first activates before the candidate sequence is dropped. */
  sequenceTimeoutMs: number;
  /** How long after a confirmed crossing the signal has to fall back below threshold before it's accepted as a real pass, not sustained drift. */
  decayWindowMs: number;
  /** Number of luminance bins used when computing the clip-wide per-pixel background mode. */
  modeBinCount: number;
  /** Video playback speed used while decoding for analysis — higher finishes faster but can drop frames if the browser can't keep up. */
  playbackRate: number;
};

export const DEFAULT_DETECTION_CONFIG: DetectionConfig = {
  orientation: 'vertical',
  zoneWidthRatio: 0.18,
  sampleWidth: 64,
  sampleHeight: 120,
  pixelDeltaThreshold: 16,
  changedRatioThreshold: 0.02,
  minActiveMs: 100,
  cooldownMs: 800,
  sequenceTimeoutMs: 1_500,
  decayWindowMs: 1_000,
  modeBinCount: 32,
  playbackRate: 8,
};
