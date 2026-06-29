---
name: camera-lap-timer
description: Use when building or debugging camera-based lap/rep timing for a drill in this app (e.g. wiring up detection for Figure Eight, Hairpin, L-Turn, or retuning Circle) — figuring out a drill's timing model, configuring src/lib/detection, testing against real footage, and diagnosing why a crossing/rep wasn't detected correctly.
---

# Camera lap/rep timer

This skill distills what actually worked building Circle's camera lap timer — the process and tooling, not Circle's specific answers. Circle's timing model (a single line, crossed twice per lap, in alternating directions) is *one drill's* answer to "where's the line and what's one lap." The next drill may have a completely different answer — a single crossing, a gate-to-gate interval, something else. Don't carry over Circle's geometry, its idea of what a lap is, or any of its tuned numbers. Carry over the *process* below.

## Step 0: decide the timing model before touching any config

Read the target drill's setup, camera-placement, and timing-rule sections in `../ideation/drill-library.md` (one level up from this repo, in `app-development/ideation/`) — don't assume. Figure out, from that drill's actual physical layout, two things:

1. **What single, camera-visible event marks progress** (a line crossing? entering/leaving a gate? something else?), and **what physically constitutes one complete rep** in terms of that event (one crossing? two? an interval between two distinct gates?).
2. **Whether the existing shared pipeline's shape actually fits.** `src/lib/lapDetector.ts`'s `detectCrossings` was built and validated around one specific topology: a single zone split into two halves (`primary`/`secondary`), with a confirmed event being one half activating then the other (`primary-to-secondary` or `secondary-to-primary`). That shape fit Circle. It is **not guaranteed to fit every drill** — a drill with two physically separate timing gates (rather than one line's two sides) may not be expressible as a config change to this same model at all, and could need new detection logic rather than a new `drills/<id>.ts` override. Decide this honestly before assuming "just configure it."

Once decided, set `detectionsPerLap` in `src/data/seed.ts` for that drill from its own physical definition of one rep — never assumed to match another drill's.

## Architecture map (shared, reusable as-is regardless of timing model)

- `src/lib/lapDetector.ts` — core algorithm: frame extraction (browser canvas path and the ffmpeg path in `server/ffmpegFrames.ts` both produce the same `CapturedFrame[]` shape), windowed luminance baseline, crossing/event detection, blob-size sanity filter, mid-session break detection, lap reduction.
- `src/lib/detection/types.ts` — the full `DetectionConfig` shape and shared defaults. Read every field's comment before touching it; several encode hard-won, non-obvious reasoning (see Step 3/4 below for why).
- `src/lib/detection/drills/<drillId>.ts` — per-drill config overrides. Figure Eight/Hairpin/L-Turn currently sit as empty `{}` — this is where a new drill's tuning goes, once the timing model (Step 0) is confirmed to fit.
- `src/lib/frameSampling.ts`, `src/lib/detection/geometry.ts` — pure helpers (luminance/marker-color downsampling, crop-rect math). Reusable regardless of drill.
- `server/` — the server-side processing path (ffmpeg-based extraction, the GitHub Actions worker). Already generic across all drills via `getDetectionConfigForDrill(drillId)`. A new drill needs a config override and test footage, **not** new infrastructure.

## Step 1: get real ground-truth footage before tuning anything

Get at least 2 real clips of the drill being performed, each with a hand-timed reference (stopwatch or by-eye), saved as plain text. Mirror the existing convention: a folder named `<Drill Name> Drill Test/` containing the clip(s) plus a `<clip name> lap times.txt` per clip, living in `app-development/backend/` (a sibling of this repo, not inside it — see `Circle Drill Test/` there for the existing example). Don't trust synthetic intuition about what the signal should look like — every real fix this session came from looking at real footage's actual diagnostics, not from reasoning about it in the abstract.

## Step 2: iterate fast, locally

Use `server/test-local.ts` (run via `npx tsx test-local.ts <videoPath> [drillId]` from `server/`) — it runs the real ffmpeg-based extraction + full detection pipeline against a local file in a few seconds, no browser, no Supabase. This replaced an earlier browser/puppeteer-based debug-reprocess loop that took roughly 3 minutes per run; always reach for the fast local harness first; only use the in-app `?debug=reprocess` tool if you specifically need to verify browser-path behavior (e.g. the live camera screen's own detection path) rather than the algorithm itself.

Loop: run → compare reported laps/reps against the hand-timed reference → if it doesn't match, diagnose (Step 3) → make one targeted, justified change → re-run → repeat.

## Step 3: diagnose by reading diagnostics, not by guessing

`detectLapsFromVideo`'s result includes `diagnostics.candidates` (every event sequence it noticed and why it was kept or dropped — outcomes like `confirmed`, `sequence-timeout`, `decay-failed`, `suppressed-by-cooldown`, `duplicate-direction`, `blob-too-small`) and `diagnostics.series` (the raw per-frame signal). Before changing any config number, find the *specific* candidate(s) around the timestamp that's wrong and read its outcome — that tells you which mechanism failed, which tells you which parameter actually addresses it. Every real bug fixed this session (frame drops, a noise double-trigger, a too-strict activation window, false breaks) was found this way, not by adjusting numbers and hoping.

## Step 4: failure modes, by mechanism

| Symptom | Likely mechanism | Where to look |
|---|---|---|
| Few/no reps detected; frame count varies between identical runs | Frames are being dropped during extraction (e.g. video decode pacing too aggressive) | `diagnostics.frameCount` vs. clip duration — should be a stable, plausible fps every run. If it varies run-to-run on the same clip, that's the signal, not a config value. |
| Reps come out merged into anomalously long readings | A real crossing/event wasn't confirmed — either it timed out waiting for its pair, or the signal was too weak/brief to register as active | Find the candidate(s) in that time window; `sequence-timeout` or `decay-failed` near there means the relevant timing window is too tight for *this* drill's actual rep cadence — reconsider it from this drill's real footage, not by copying another drill's value. |
| Impossible short readings (much shorter than physically plausible) | A noise double-trigger got counted as a second real event right after a genuine one | Look for two same-kind confirmed events abnormally close together with no real recovery in between. Whether "same direction twice in a row" is even a valid impossibility for *this* drill's timing model is itself a judgment call (see Step 5) — don't assume it generalizes. |
| False events from glare/shadow/camera shake | The activation signal is too easily satisfied by non-subject motion | Check the blob-size filter is actually contributing signal for this drill's framing (subject size, camera distance) — it self-calibrates from the session's own early confirmed events, but only once it has a few to calibrate against. |
| Works on test clips, unreliable in real conditions | Test footage doesn't represent real lighting/distance/speed variation | Get more real footage across conditions before trusting a tuned config — this is a data problem, not a parameter problem. |

## Step 5: judgment calls to re-make per drill, never inherited

- **Direction-alternation logic** (`duplicateDirectionWindowMs`-style reasoning): only meaningful if this drill's timing model genuinely requires alternating directions every event (true for a single line crossed back and forth; not necessarily true for a drill that crosses the same way every rep). Decide fresh.
- **Mid-session break detection** (`breakDetectionEnabled`-style reasoning): only meaningful for a continuous take where a rider could plausibly pause without stopping the recording. A drill that naturally resets to a start position every single rep may not need this at all, and enabling it could misfire constantly.
- **An anomalously long reading is never, on its own, evidence of what happened.** It could be a missed event, a real pause, or something else. Corroborate with the actual diagnostic evidence (e.g. a genuine quiet gap with zero candidate activity of any kind, versus some candidate trace suggesting the subject was still there) before concluding anything — this generalizes to any drill, any timing model.

## Before shipping

- Re-run both ground-truth clips one final time and confirm the reported laps/reps match the hand-timed reference closely (exact match isn't the bar — close count and matching pace pattern is).
- `npm run check` clean.
- Commit and push per this repo's `AGENTS.md` (the rider tests against the deployed build, not local).
