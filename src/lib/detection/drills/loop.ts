import type { DetectionConfig } from '../types';

/**
 * Loop: camera sits inside the loop, low and close (~8m) to the track,
 * pointed out at one straight — unlike Circle (camera outside, whole circle
 * in frame, bike small and far), the bike fills much more of the frame here
 * and only ever passes this one point once per lap, always in the same
 * screen direction while the rider keeps circulating one way.
 *
 * detectionsPerLap is set on the seed.ts Drill entry (1, not Circle's 2) —
 * this camera only watches one point on the track, not the whole loop, so a
 * single confirmed crossing is a full lap.
 *
 * duplicateDirectionWindowMs is left at the shared default (0, disabled):
 * Circle's alternation-suppression assumes a lap crosses each direction once
 * — Loop's laps cross the same direction every time by design, so that
 * assumption doesn't apply here.
 *
 * directionReversalStartsNewSegment is Loop-specific: the rider can turn
 * around and circuit the loop the other way without stopping the recording
 * (confirmed in the July 3rd 2026 ground-truth clip: 4 reversals across the
 * session). Each reversal starts a fresh warmup/cooldown segment instead of
 * being folded into the lap in progress.
 *
 * breakDetectionEnabled mirrors Circle's reasoning: a continuous ridden
 * session where the rider could plausibly pause without stopping the camera.
 *
 * zoneWidthRatio/sampleWidth/sampleHeight/minActiveMs below were validated
 * against the July 3rd 2026 ground-truth clip (Loop camera timer data.txt):
 * all 49 real laps across all 5 direction segments (19/8/6/11/5) detected
 * with no missed or duplicate crossings, all 4 reversals landing at the
 * right point, and every lap timestamp within ~0.3s of the hand-read
 * reference. Not inherited from Circle's tuned numbers (that skill's
 * explicit warning): Circle's bike is small and far, Loop's is close and
 * fills more of the frame — these happened to work on the first try, but
 * were chosen for that reason, not copied from Circle.
 */
export const loopDetectionConfig: Partial<DetectionConfig> = {
  zoneWidthRatio: 0.18,
  sampleWidth: 64,
  sampleHeight: 120,
  minActiveMs: 50,
  duplicateDirectionWindowMs: 0,
  breakDetectionEnabled: true,
  directionReversalStartsNewSegment: true,
};
