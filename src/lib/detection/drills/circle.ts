import type { DetectionConfig } from '../types';

/**
 * Circle: camera sits across from the circle at shoulder height, far enough
 * back to fit the whole circle in frame — so the bike is small on screen.
 * The rider crosses the screen's centerline twice per lap (once each
 * direction), which is the default vertical left/right split.
 *
 * Real lot data (2026-06-25): a full circle took ~5s, i.e. ~2.5s between the
 * two crossings — cooldownMs (shared default, 800ms) already accounts for
 * this with room to spare for a faster rider.
 *
 * Because the bike is small and the camera is wide to fit the whole circle:
 * - zoneWidthRatio is narrowed from the 0.18 default so the small bike makes
 *   up more of the analyzed strip while crossing, instead of mostly empty
 *   background on either side of it. Tried widening to 0.13 on the theory
 *   that 0.09 was clipping some passes due to natural path variance
 *   (2026-06-27) — that theory was wrong: widening dropped confirmed
 *   crossings from 49 to 44 and roughly halved the peak signal (0.20 ->
 *   0.11), since a wider zone dilutes the ratio with more background more
 *   than it gains in path tolerance. Reverted to 0.09, the best result so
 *   far (24 laps, several clean ~5s laps, zero decay-failed). The
 *   remaining missed-crossing cases are still unexplained; don't assume
 *   "narrower is always better" or "wider is always better" without
 *   re-testing — this parameter doesn't move monotonically with miss rate.
 * - bandRatio is left at the full-height default (1) for now: a band crop
 *   risks cutting the bike out of frame entirely if its actual vertical
 *   position doesn't match the guessed bandCenterRatio, which is worse than
 *   the dilution problem it was meant to fix. Revisit once we've seen where
 *   the bike actually sits on screen from a real test.
 * - sampleWidth/sampleHeight are bumped up so a small subject survives the
 *   downsample with more of its signal intact.
 */
export const circleDetectionConfig: Partial<DetectionConfig> = {
  zoneWidthRatio: 0.09,
  sampleWidth: 96,
  sampleHeight: 160,
};
