/**
 * 'vertical' = a left/right split; the bike crosses the gate left-to-right or
 * right-to-left (camera looking across the rider's path).
 * 'horizontal' = a top/bottom split; the bike crosses top-to-bottom or
 * bottom-to-top (camera looking along the rider's path, e.g. head-on).
 */
export type CrossingOrientation = 'vertical' | 'horizontal';

export type DetectionConfig = {
  orientation: CrossingOrientation;
  /** Size of the crop along the crossing axis (width for vertical orientation, height for horizontal), as a ratio of the matching frame dimension. Narrower concentrates analysis right at the line. */
  zoneWidthRatio: number;
  /** Size of the crop along the OTHER axis (height for vertical orientation, width for horizontal), as a ratio of the matching frame dimension. 1 = full frame (no constraint); narrower excludes background the rider's path never crosses (e.g. sky above a wide circle shot). */
  bandRatio: number;
  /** Where the band above is centered along that axis, 0 (top/left edge) to 1 (bottom/right edge). 0.5 = centered. Only matters when bandRatio < 1. */
  bandCenterRatio: number;
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
  /** Number of luminance bins used when computing each window's per-pixel background mode. */
  modeBinCount: number;
  /**
   * The baseline is recomputed fresh from real nearby frames every this many
   * seconds (non-causal — the whole clip is already in memory), instead of
   * one fixed baseline for the whole session. A single clip-wide baseline
   * can't track real lighting drift (sun, clouds) over a multi-minute
   * session; incrementally blending one baseline forward has a deadlock
   * (a pixel only updates if it's currently classified "unchanged," so a
   * pixel that started off far enough from baseline can never recover).
   * Recomputing fresh per window sidesteps both problems. Must stay long
   * enough that the bike's brief presence at any given pixel stays a small
   * minority of the window, or the mode could lock onto the bike instead of
   * the background.
   */
  baselineWindowSeconds: number;
  /** Video playback speed used while decoding for analysis — higher finishes faster but can drop frames if the browser can't keep up. */
  playbackRate: number;
};

export const DEFAULT_DETECTION_CONFIG: DetectionConfig = {
  orientation: 'vertical',
  zoneWidthRatio: 0.18,
  bandRatio: 1,
  bandCenterRatio: 0.5,
  sampleWidth: 64,
  sampleHeight: 120,
  pixelDeltaThreshold: 16,
  changedRatioThreshold: 0.02,
  minActiveMs: 100,
  cooldownMs: 800,
  sequenceTimeoutMs: 1_500,
  decayWindowMs: 1_000,
  modeBinCount: 32,
  baselineWindowSeconds: 30,
  playbackRate: 8,
};
