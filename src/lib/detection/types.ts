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
  /**
   * Which background-modeling strategy computeLapsFromVideo uses to decide
   * "changed" per pixel. 'windowed-mode' (the default, and every shipped
   * drill's validated behavior) is the mechanism baselineWindowSeconds
   * documents above. 'adaptive' is a lightweight per-pixel running mean/
   * variance tracker (a single-Gaussian approximation of the same idea behind
   * OpenCV's MOG2 background subtractor) that updates a little every frame
   * instead of snapping between fixed windows — in principle more graceful
   * under continuous lighting drift (e.g. a session shot through dusk), but
   * it has not been validated against any real ground-truth clip yet. Opt-in
   * and defaulted to 'windowed-mode' so no existing drill's behavior changes;
   * follow the camera-lap-timer skill's tuning process against real footage
   * before switching any drill to 'adaptive'.
   */
  baselineMode: 'windowed-mode' | 'adaptive';
  /** 'adaptive' baselineMode only: how fast each pixel's running mean/variance drifts toward new values per frame (0-1; higher adapts faster but risks absorbing a slow-moving subject into the background). */
  adaptiveLearningRate: number;
  /** 'adaptive' baselineMode only: a pixel counts as changed when it deviates from its running mean by more than this many standard deviations. */
  adaptiveThresholdK: number;
  /** 'adaptive' baselineMode only: floor on a pixel's standard deviation (luminance units) so a perfectly static pixel with near-zero variance doesn't become hypersensitive to the slightest noise. */
  adaptiveMinStdDev: number;
  /** Video playback speed used while decoding for analysis — higher finishes faster but can drop frames if the browser can't keep up. */
  playbackRate: number;
  /**
   * A real lap alternates crossing direction every time (out one way, back
   * the other) — a rider physically cannot cross the same direction twice
   * in a row while circling continuously. If a confirmed crossing repeats
   * the previous confirmed crossing's direction within this window, it's
   * almost certainly a double-trigger from noise (shadow flicker, glare),
   * not a genuine pass, and gets dropped instead of corrupting lap pairing
   * for everything after it.
   *
   * Only meaningful for drills where a continuous loop genuinely must
   * alternate sides every pass (Circle) — defaults to 0 (disabled) because
   * a point-to-point drill (Hairpin, L-Turn) can legitimately cross the
   * same direction every single rep by design, and treating that as noise
   * would silently eat real reps.
   *
   * Must be well below the fastest plausible half-lap gap, not above it:
   * tested on a real outdoor Circle session (2026-06-28) where the actual
   * bug fired noise-duplicates under ~1.6s after the prior crossing, while
   * legitimate next-lap crossings that followed a *silently missed* (no
   * candidate at all, not even decay-failed/sequence-timeout) middle
   * crossing landed 5s+ later, a full lap's length away. A window set above
   * that gap would reject those legitimate-but-following-a-miss crossings
   * too, compounding the original miss instead of recovering from it.
   */
  duplicateDirectionWindowMs: number;
  /**
   * Absolute floor (in downsampled pixels) for the largest connected blob of
   * changed pixels in whichever half just confirmed a crossing — rejects a
   * single-pixel flicker or scattered noise that happens to add up to enough
   * *total* changed pixels without ever forming one bike-sized region. 0
   * disables this floor entirely (no real-footage value derived yet for a
   * given drill — see drills/circle.ts for how this gets set once derived).
   */
  minBlobAreaPixels: number;
  /**
   * Once a few crossings are already confirmed this session, a new
   * candidate's peak blob area must be at least this fraction of the
   * rolling median of those prior confirmed crossings' peak blob areas.
   * This is the actual self-calibration: it judges new passes against what
   * a real pass looked like earlier in *this* footage (whatever the bike
   * size, camera distance, or speed happens to be), not a fixed global
   * number that would break the moment any of those things change.
   *
   * Tested at 0.35 against the ground-truth clips (2026-06-28): caused real
   * regressions, because the earliest confirmed crossings (still within the
   * excluded warm-up lap, where the rider is still settling into their line
   * and pace) can have larger-than-steady-state blobs, biasing the rolling
   * median high and then unfairly rejecting genuinely smaller (but real)
   * crossings once the rider speeds up. 0.2 gives enough margin for normal
   * pace variation across a session without losing the "obviously not the
   * bike" rejection this exists for.
   */
  minBlobAreaFraction: number;
  /** How many confirmed crossings to keep in the rolling-median window. */
  blobCalibrationWindowSize: number;
  /**
   * How many crossings must already be confirmed before the relative
   * (minBlobAreaFraction) check kicks in — before that there's no session
   * baseline yet, so only the absolute floor applies. The warm-up lap
   * (see lapDetector.ts's markWarmupAndCooldownLaps) means this naturally
   * lines up with "laps that don't count anyway."
   */
  blobCalibrationBootstrapCount: number;
  /**
   * A high-contrast sticker/marker on the bike, tracked by color instead of
   * generic brightness change — much less sensitive to ambient lighting
   * (shadows, glare) than luminance diffing alone. A pixel counts as
   * "changed" if it matches this color OR the luminance check fires (an OR,
   * not a replacement) — so if the marker gets briefly blocked by the
   * rider's body, the brightness signal still covers that pass; the marker
   * only has to help, never hurt.
   *
   * null disables this entirely (the default everywhere, including Circle)
   * until a real sticker is bought and its color measured — TODO once you
   * have one: open the debug reprocess tool (?debug=reprocess) on a clip
   * that clearly shows the marker, note roughly where in the zone it
   * crosses, and sample that pixel's color (e.g. via your OS's color
   * picker on a paused video frame, or a quick script) to get hue/
   * saturation. Start with a generous hueToleranceDegrees (~20-30) and
   * tighten only if it's matching things it shouldn't.
   */
  markerColor: { hue: number; hueToleranceDegrees: number; minSaturation: number } | null;
  /**
   * Lets a continuous recording contain more than one riding segment — the
   * rider can ride out, pause (switch direction, take a break), and ride
   * back in without stopping the recording. The lap spanning that pause
   * comes out of detection as one lap with an enormous, meaningless time
   * (ride time + pause time mixed together); when enabled, that lap is
   * relabeled 'break' and excluded, and the laps immediately before/after
   * it become that segment's cooldown/the next segment's warmup — the same
   * exclusion markWarmupAndCooldownLaps already applies once per session,
   * just repeated at every break boundary instead of only at the very start
   * and end.
   *
   * Defaults to false: this is new, Circle-specific behavior. Point-to-point
   * drills (Hairpin, L-Turn) likely reset between every single rep by
   * design, so a "gap between laps means a break" heuristic tuned for a
   * continuous-loop drill like Circle could misfire constantly there.
   */
  breakDetectionEnabled: boolean;
  /**
   * A lap counts as a break once its time is at least this many times the
   * rolling median of recent normal lap times. Tuned against two real data
   * points (2026-06-28/29): Circle Drill Test's natural mid-session pace
   * slowdown (clip 1, laps ~10-14) peaked around 1.35x its surrounding
   * baseline and must never be flagged; a real outdoor break (rider stepped
   * away ~20s) showed up as a lap roughly 3.5x baseline and must always be
   * flagged. 1.8x sits in the middle with margin on both sides. Deliberately
   * not requiring the very next lap to instantly snap back to baseline
   * before confirming a break — that same real session took a few laps to
   * fully resettle afterward, so a strict immediate-recovery rule would
   * have missed it.
   */
  breakMultiplier: number;
  /** How many recent normal lap times to keep in the rolling-median baseline. */
  breakRollingWindowSize: number;
  /** How many normal laps must already be seen before a lap can be judged a break — no baseline yet before that. */
  breakBootstrapCount: number;
  /**
   * Treats a confirmed crossing whose direction differs from the session's
   * established direction as the start of a brand-new segment (fresh
   * warmup/cooldown pair), instead of counting it toward the in-progress lap.
   *
   * Only meaningful for a drill where every lap is expected to cross the
   * *same* direction every time (e.g. Loop: the camera watches one point on
   * a continuous loop, so the rider passes it going the same way lap after
   * lap — a direction change means they turned around and are now circuiting
   * the other way). Enabling this for a drill that alternates direction *by
   * design* every lap (Circle: one full lap crosses the screen's line once
   * each way) would treat every single lap as a reversal and never let a
   * segment grow past one lap — defaults to false for exactly that reason.
   */
  directionReversalStartsNewSegment: boolean;
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
  baselineWindowSeconds: 12,
  baselineMode: 'windowed-mode',
  adaptiveLearningRate: 0.02,
  adaptiveThresholdK: 4,
  adaptiveMinStdDev: 3,
  duplicateDirectionWindowMs: 0,
  minBlobAreaPixels: 0,
  minBlobAreaFraction: 0.2,
  blobCalibrationWindowSize: 8,
  blobCalibrationBootstrapCount: 2,
  markerColor: null,
  breakDetectionEnabled: false,
  breakMultiplier: 1.8,
  breakRollingWindowSize: 6,
  breakBootstrapCount: 2,
  directionReversalStartsNewSegment: false,
  // 8x caused the browser to drop the vast majority of decoded frames during
  // requestVideoFrameCallback (verified: re-running the same clip at 8x
  // produced a different frame count each time — 577 vs 1149 frames over the
  // same ~150s clip — with multi-second gaps between captured frames). A
  // crossing lasts well under a second, so those gaps made most real passes
  // invisible. 1x trades processing speed for not dropping frames.
  // Tried 2x as a speed-up (2026-06-28): frame count already dropped 21%
  // (4239 -> 3356 on the same clip) and lap count regressed 23 -> 20 with
  // the same merged-lap signature as the original 8x bug (two real laps
  // collapsing into one ~8-10s reading). Even 2x isn't safe here — don't
  // raise this without re-verifying against Circle Drill Test's ground
  // truth clips first.
  playbackRate: 1,
};
