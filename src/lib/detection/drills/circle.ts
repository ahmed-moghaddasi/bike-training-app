import type { DetectionConfig } from '../types';

/**
 * Circle: camera sits across from the circle at shoulder height, far enough
 * back to fit the whole circle in frame — so the bike is small on screen.
 * The rider crosses the screen's centerline twice per lap (once each
 * direction), which is the default vertical left/right split.
 *
 * Earlier tuning notes for zoneWidthRatio (narrower vs wider) were measured
 * while playbackRate was 8, which we since found drops the large majority of
 * frames non-deterministically (see types.ts) — those candidate counts
 * aren't trustworthy and shouldn't be used to justify this value going
 * forward. 0.09 happens to still test well at playbackRate 1, so it's kept,
 * but treat it as re-validated from scratch rather than inherited reasoning.
 *
 * Ground-truth test clips (2026-06-27, 21:48 and 21:52, one CW one CCW)
 * at playbackRate 1: most crossings confirm cleanly, but a real lap that
 * runs slower than ~6-7s sometimes has its second crossing land just past
 * the shared 1500ms sequenceTimeoutMs default, dropping the candidate as
 * sequence-timeout and silently merging two real laps into one detected
 * lap. Lengthened to 2500ms for Circle specifically — still comfortably
 * under the ~2.5s+ minimum half-lap gap a fast lap leaves before the next
 * crossing, so it shouldn't introduce false merges of separate passes.
 *
 * - bandRatio is left at the full-height default (1): a band crop risks
 *   cutting the bike out of frame entirely if its actual vertical position
 *   doesn't match the guessed bandCenterRatio.
 * - sampleWidth/sampleHeight are bumped up so a small subject survives the
 *   downsample with more of its signal intact.
 */
export const circleDetectionConfig: Partial<DetectionConfig> = {
  zoneWidthRatio: 0.09,
  sampleWidth: 96,
  sampleHeight: 160,
  sequenceTimeoutMs: 2_500,
  // A fast, small-on-screen bike can cross a whole half in well under the
  // shared default's 100ms — at ~27fps (the real per-frame rate once
  // playbackRate stopped dropping frames) that's only ~3 consecutive active
  // frames required. Several real, ground-truth-confirmed crossings showed
  // a half never reaching "confirmed" before the bike moved on. Halved to
  // give a brief but real activation room to register.
  minActiveMs: 50,
  // Real outdoor session (2026-06-28) had shadow/glare flicker fire a
  // same-direction confirmed crossing ~0.9-1.6s after the previous one —
  // physically too fast to be a real next pass — which desynced lap
  // pairing into impossible ~2-3s and ~10s+ readings for several laps
  // after. The known-good ground-truth clips' fastest real half-lap gap is
  // ~2.1-2.4s, so 1900ms sits between the two with margin on both sides.
  duplicateDirectionWindowMs: 1_900,
  // Circle is the one drill ridden as a continuous loop where the rider can
  // plausibly pause mid-recording (switch direction, take a break) without
  // stopping the camera — point-to-point drills reset between every rep by
  // design, so this stays off for them (shared default: false). See the
  // breakMultiplier comment in detection/types.ts for the tuning behind 1.8.
  breakDetectionEnabled: true,
};
