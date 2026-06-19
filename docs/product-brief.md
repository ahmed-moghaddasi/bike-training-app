# Apex Lab Product Brief

## Working Goal

Apex Lab is a mobile-first progressive web app for riders who want to improve track-riding technique without constant access to a coach.

The app helps a rider practice track skills in a parking lot using pitbike-style cone drills, camera-based lap timing, video review, and session analysis. The training model is inspired by Spanish track-riding schools that use small bikes, cones, repetition, and slower speeds to refine technique before applying it on track.

## Who It Is For

The app is being built for Ahmad first, but it should be useful to riders with a similar problem:

- They want to improve track riding.
- They do not always have access to a coach.
- They are willing to train deliberately in a parking lot.
- They need structure, measurement, and feedback rather than random practice.

The primary user is a motivated solo rider who brings a phone, tripod, cones, and bike to a practice area.

## Core Problem

Track riding is difficult to improve alone because the rider often lacks:

- A clear plan for what to practice.
- Reliable drills that map parking-lot practice to track skills.
- Feedback on whether they are improving.
- Objective timing and consistency data.
- Video evidence they can review after a session.

The app should act like a simple self-coaching system: it tells the rider what to set up, where to place the camera, what to focus on, records the attempt, times the laps, and tracks improvement over time.

## North Star

Help a rider train track technique alone with structured cone drills, automated camera lap timing, video capture, and progress analysis.

## App Name

The working app name is Apex Lab.

Why it fits:

- "Apex" connects directly to track-riding technique.
- "Lab" fits the deliberate practice, testing, timing, and analysis model.
- The name works for drills, camera timing, video review, and progress tracking.
- It does not lock the app to pitbikes only.

Possible tagline:

Parking-lot drills for track pace.

## Core Training Loop

1. Choose a drill.
2. Set up cones using clear measurements and diagrams.
3. Place the phone/camera in the recommended position.
4. Calibrate the timing point or detection zone.
5. Start a timed video session.
6. Ride laps while the app detects passes and records lap times.
7. Save the session with video, lap data, and notes.
8. Review progress and decide what to practice next.

## Main Feature: Camera Lap Timer

The camera lap timer is the center of the app.

The intended behavior:

- The phone records the rider doing the drill.
- The user defines a start/finish timing point or detection zone in the camera view.
- When the rider or bike passes through that point, the timer starts.
- Each later pass through the same point records a lap.
- The session stores lap times and keeps the video tied to the session.

Early versions can use a simpler calibration approach. The important product direction is that lap timing and video capture belong together.

## Supporting Feature: Drill Library

The drill library supports the camera lap timer by giving the rider structured practice.

Each drill should include:

- Skill goal: what track-riding skill the drill develops.
- Cone setup: measurements, cone count, and layout.
- Camera setup: where to place the phone and what the camera should see.
- How to ride it: step-by-step execution.
- Coaching cues: sharp, practical advice in the style of a serious Spanish MotoGP-style coach.
- Progressions: how to make the drill harder as the rider improves.
- Common mistakes: what to watch for in video review.
- Timing method: what counts as a lap or rep for that drill.

Example drill themes from the first attempt:

- Figure Eight: body transition through the crossover.
- Hairpin: hard braking, tight apex, and drive out.
- L-Turn: late apex technique.

## Supporting Feature: Session Log

The session log records practice history so training becomes measurable.

A session may include:

- Date and time.
- Drill name.
- Setup variant or layout measurements.
- Lap times.
- Best lap.
- Average lap.
- Consistency or spread between laps.
- Total laps or reps.
- Video reference.
- Notes from the rider.
- Conditions or setup notes.
- Focus for next time.

## Supporting Feature: Analysis

The analysis page should help the rider understand improvement over time.

Useful questions:

- Am I getting faster within this specific drill?
- Am I getting more consistent within this specific drill?
- Which drills am I actively working on?
- Which drill has gone stale or has not improved recently?
- Did a setup change improve or hurt my results within a drill?

Initial metrics can be simple:

- Best lap by drill.
- Average lap by session.
- Lap consistency.
- Number of sessions per drill.
- Improvement trend over time within each drill.

Drills should not be compared directly against each other because each drill has a different setup, timing path, and skill goal. Progress is drill-by-drill, not a universal ranking.

Setup changes within the same drill can also create a new timing context. For example, a 9 meter Figure Eight and a 6 meter Figure Eight should not share the same best-lap comparison because the path is different. If a progression changes the layout size, cone distance, route, or timing path, the app should treat that as a distinct setup variant for logging and analysis.

## Product Shape

This is a training tool used at the practice spot, not a marketing site or passive content app.

The app should prioritize:

- Fast use on a phone.
- Clear setup instructions.
- Large controls for outdoor use.
- Minimal friction before starting a session.
- Strong offline or unreliable-network behavior over time.
- Video and timing as first-class session data.

## Initial Navigation Hypothesis

The app should avoid a persistent bottom navigation bar in version 1. Phone screen space is more valuable for setup instructions, the camera view, lap timing, and session review.

The Start screen acts as the hub. Subpages use simple back navigation and task-specific actions.

Primary areas:

- Start: home hub with current bike, direct drill library access, drills the rider is currently working on, recent sessions, and links to Sessions and Progress.
- Drills: library of drill setups, coaching cues, and progressions.
- Sessions: saved practice history.
- Analysis: progress charts and drill-by-drill improvement.

Workflow screens:

- Drill Detail: one simple scrollable page with setup, camera placement, riding instructions, tips, and a prominent start recording action.
- Camera Timer: launched from a drill, not a standalone main page.
- Session Summary: appears after ending a timed session.
- Session Detail: opened from the session log.
- Drill Progress: opened from Progress or a drill.

Recommended app map:

```text
Start
├─ Drills
│  └─ Drill Detail
│     └─ Camera Timer
│        └─ Session Summary
├─ Sessions
│  └─ Session Detail
└─ Progress
   └─ Drill Progress
```

The camera timer should always be contextual to a selected drill. The rider should normally enter it from the drill detail page after reading setup and camera placement guidance.

The Start screen should not prescribe or recommend a drill. There is no formula for what the rider should practice next. The rider decides what they want to improve. Start should instead surface the drills the rider is actively working on and make it easy to continue them.

Drill pages should not use tabs in version 1. The rider may be in a parking lot wearing gloves, so the page should be simple, scrollable, and easy to operate. A single prominent start recording button is better than nested navigation.

There is no dedicated setup checklist in version 1. The setup instructions need to be clear enough on the drill detail page.

There is no Settings page in version 1.

## Home Hub Wireframe

The Home screen is the app hub. It should not be a chart dashboard and should not prescribe what the rider should practice next.

The Home screen should answer:

- Which bike am I logging under?
- How do I open the drill library?
- What drills am I currently working on?
- What did I do recently?
- Where do I go for sessions and progress?

Recommended layout:

```text
Apex Lab
Parking-lot drills for track pace.

Current Bike
Pitbike 160                         Change

[Open Drill Library]

Working On

[Figure Eight]
Best: 14.82s                        Last: Jun 8

[Hairpin]
Best: --                            Last: Not yet

Recent Sessions

Jun 8
Figure Eight · 9m circles · Pitbike 160
Best: 14.82s · 12 laps

Go To

[Sessions]                          [Progress]
```

The direct Drill Library action is important. Working On cards should be shortcuts, but they should not be the only way to access drills. A brand new user must be able to start by opening the full drill library.

First-time state:

```text
Apex Lab
Parking-lot drills for track pace.

Current Bike
No bike selected                    Add Bike

[Open Drill Library]

Working On
No drills yet. Choose a drill from the library to start your first session.

Recent Sessions
No sessions yet.

Go To

[Sessions]                          [Progress]
```

## Drills Library Wireframe

The Drills page is a visual drill picker, not the place where the rider learns every detail of the drill.

Because version 1 will likely have only 4-6 drills, the page should use large, simple, stacked cards rather than dense rows, filters, or categories.

The page should prioritize outdoor readability:

- Large text.
- High contrast.
- Large tap targets.
- Whole card is tappable.
- No small buttons inside drill cards.
- No difficulty labels on the card.
- No cone count, camera placement, or setup measurements on the card.

Each drill card should contain only:

- Drill title.
- Simple bold layout graphic.
- Best time for that drill.
- Last session date for that drill.

Example card structure:

```text
Figure Eight

[simple top-down drill layout graphic]

Best: 14.82s                  Last: Jun 8
```

If the rider has not practiced a drill yet:

```text
Hairpin

[simple top-down drill layout graphic]

Best: --                      Last: Not yet
```

The drill cards should use simple schematic graphics that communicate the shape of the drill quickly:

- Figure Eight: two loops with a crossover.
- Hairpin: straight entry into a tight U-turn.
- L-Turn: straight into a 90-degree corner.

The Drills page should not include detailed setup content. Cone counts, camera placement, track size, execution notes, and coaching tips belong on the Drill Detail page after the rider taps a drill.

## Drill Detail Wireframe

The Drill Detail page is where the rider learns and prepares the drill before starting the camera timer.

The page should be one simple scrollable page, optimized for use outdoors and possibly with gloves. It should not use tabs in version 1.

Recommended page order:

```text
Back

Drill Name

What This Trains
[short skill explanation]

Demo
[future video or animated/diagram placeholder]

Setup
[large visual cone layout diagram]
[key measurements]

Cone Placement
[short step-by-step placement instructions]

Camera Placement
[visual camera placement diagram]
[what the camera should see]
[timing point or detection zone]

How To Ride It
[short riding sequence and technique cues]

Common Mistakes
[what to watch for in video review]

Progression
[how to increase difficulty]

[Start Recording]
```

Required content sections:

- What This Trains: the skill goal and why it matters on track.
- Demo: future video of the drill being performed.
- Setup: visual layout, cone placement, and measurements.
- Camera Placement: phone position, camera angle, and timing point.
- How To Ride It: concise riding cues.
- Common Mistakes: self-coaching checks for video review.
- Progression: how to increase difficulty.
- Start Recording: large action that opens the camera timer for this drill.

Progressions must be careful with timing history. If a progression changes the measured layout, such as shrinking circle size or moving cone distances, the app should log it as a separate setup variant. Times should only be compared within the same drill and the same setup variant.

## Session Summary Wireframe

The Session Summary appears immediately after recording ends. It should give the rider a quick read on how that run went before saving or discarding it.

The page should be short, visual, and focused. Deeper trend analysis belongs on Progress.

Recommended page structure:

```text
Session Complete

Figure Eight
9m circles · Pitbike 160

New Best
14.82s
0.50s faster than previous best

Lap Flow
[small line graph of lap times in this session]

Stats
Average: 15.40s
Laps: 12
Spread: 1.20s

Lap Times
1     15.62s
2     15.10s
3     14.82s
...

Video
Saved

Notes
[What did you notice?]

[Save Session]

[Discard]
```

The main result area should show:

- New best if the session beat the previous best.
- Time off best if it did not beat the previous best.
- First saved run if there is no previous result for this timing context.

Previous-best comparisons are only valid within the same drill, setup variant, and bike.

Lap Flow is a small visual graph of lap times from the session, similar in spirit to a workout summary graph. It should help the rider see the session shape without reading every lap time.

Lap Flow should show:

- X-axis: lap number.
- Y-axis: lap time.
- Lower is better.
- Best lap highlighted if possible.
- Minimal labels so it stays readable at a glance.

The summary should also clearly confirm whether video was saved.

## Camera Timer Wireframe

The Camera Timer is the core tool screen. It should only be accessible from a Drill Detail page so it always has drill context.

When the camera opens, it already knows:

- Drill name.
- Setup variant.
- Current bike.
- Timing rule.
- Recommended camera placement.
- Expected timing point or detection zone.

The screen should feel like a tool, not a content page. The camera view should dominate.

The camera flow has two main states:

1. Aim and calibrate.
2. Recording and timing.

### Aim And Calibrate

Before recording, the rider places the phone, checks the camera framing, and positions the timing line or detection zone.

Recommended layout:

```text
Back

Figure Eight · 9m circles
Pitbike 160

[camera view]
[timing line or detection zone overlay]

Crossover cone should sit on the timing line.

[Start Recording]
```

The setup cue should be short and specific to the selected drill.

### Recording And Timing

Once recording starts, the UI should be sparse and readable from a distance.

Recommended layout:

```text
REC                                      Lap 4

[camera view]
[timing line or detection zone overlay]

Latest 15.10s                 Best 14.82s

[End Session]
```

During recording, the rider is on the bike and cannot interact with the phone. Do not include a manual tap-lap button in version 1.

### Detection Feedback

When the app detects a lap, it should give clear feedback that can be noticed from the corner of the rider's eye.

Preferred detection feedback:

- Brief camera torch pulse, if the browser/device supports it.
- Bright on-screen timing-line or border flash as a required fallback.
- Large temporary overlay with lap number and lap time.

Example detection state:

```text
REC                                      Lap 5

[camera view with bright flash border]

Lap 5 · 14.92s

Latest 14.92s                 Best 14.82s

[End Session]
```

The app should not depend only on torch/flashlight support because PWA camera torch support can vary by browser and device. The on-screen flash/border pulse is required even if torch works.

After the rider ends the recording, the app goes directly to Session Summary.

## Session Log Wireframe

The Session Log is a training diary. It should help the rider review practice history and notice practice rhythm over time.

Sessions should be grouped by date in reverse chronological order. Do not group by "This Week" or "Earlier" in version 1.

Recommended page structure:

```text
Sessions
Review your practice history.

[All Bikes]                  [All Drills]

Jun 8, 2026
2 sessions · 22 laps

[Figure Eight · 9m circles]
Pitbike 160
Best 14.82s     Avg 15.40s     12 laps
Video · Notes

[Hairpin · Standard]
Pitbike 160
Best 8.40s      Avg 8.91s      10 laps
Video

Jun 5, 2026
1 session · 8 laps

[L-Turn · Standard]
Pitbike 160
Best 11.20s     Avg 12.02s     8 laps
```

Each date group should show:

- Date.
- Number of sessions that day.
- Total laps that day.

Each session card should show:

- Drill name.
- Setup variant.
- Bike.
- Best lap.
- Average lap.
- Lap count.
- Optional video indicator.
- Optional notes indicator.

The whole session card should be tappable and open Session Detail.

Empty state:

```text
Sessions

No sessions yet.
Start from a drill and record your first timed run.

[Open Drill Library]
```

## Session Detail Wireframe

The Session Detail page is for reviewing one saved practice run.

Recommended page structure:

```text
Back

Figure Eight
9m circles · Pitbike 160
Jun 8, 2026

Summary
Best: 14.82s
Average: 15.40s
Laps: 12
Spread: 1.20s

Video
[video player or video placeholder]

Lap Times
1    15.62s
2    15.10s
3    14.82s
...

Notes
[rider notes]

Actions
[View Drill]                  [View Progress]
```

The setup variant and bike should be visible near the top so timing context is always clear. The detail page should not become the main analytics surface; deeper trend analysis belongs on Progress.

## Progress Wireframe

The Progress page is drill-first and bike-filtered. It should show whether the rider is getting faster within each drill setup on the selected bike.

The page should not create an overall score and should not compare unrelated drills. The main question is:

Am I getting faster at this drill setup on this bike?

Recommended page structure:

```text
Progress
Track improvement by drill.

Bike
[Pitbike 160 ▼]

[Figure Eight]
9m circles

[small line chart: lap times over time]

Best: 14.82s                  Latest: 15.10s
Sessions: 4                   Last: Jun 8

[Hairpin]
Standard setup

[small line chart: lap times over time]

Best: 8.40s                   Latest: 8.40s
Sessions: 1                   Last: Jun 5
```

The top bike selector controls the page context. By filtering the whole page to one bike, each progress card only needs to show drill and setup variant.

Default behavior:

- Use the current bike from the Home screen as the default Progress filter.
- Show separate cards for each drill + setup variant under that bike.
- Do not merge progress lines across bikes.
- Do not merge progress lines across setup variants.

Each progress card should show:

- Drill name.
- Setup variant.
- Lap-time-over-time graph.
- Best lap.
- Latest best lap or latest session best.
- Session count.
- Last practiced date.

The primary graph should be lap times over time. In version 1, the card graph can use best lap per session because it answers the most important question clearly: am I getting faster?

If there is not enough data for a trend:

```text
[Hairpin]
Standard setup

Not enough sessions for a trend yet.

Best: 8.40s                   Latest: 8.40s
Sessions: 1                   Last: Jun 5
```

## Drill Progress Detail Wireframe

Tapping a Progress card opens detail for one valid timing context:

```text
Back

Figure Eight Progress
Pitbike 160 · 9m circles

Lap Time Over Time
[larger line chart: best lap per session]

Summary
Best: 14.82s
Latest Best: 15.10s
Sessions: 4
Total Laps: 48

Session History
Jun 8      Best 14.82s     Avg 15.40s     12 laps
Jun 2      Best 15.32s     Avg 16.10s     10 laps
May 29     Best 16.02s     Avg 16.80s     14 laps
```

Later versions can add average lap trend, consistency trend, and all-lap scatter plots. Version 1 should prioritize the simple lap-time-over-time chart.

## Design Direction To Explore

Apex Lab should start with one primary visual theme that works both indoors and outdoors. Do not create separate review and field modes in version 1 unless real testing shows a readability problem.

The theme should be based on `design/moodboard.html`.

Locked visual direction:

- Warm silver/off-white main background.
- Charcoal primary text.
- White card surfaces.
- Audi-style red accent for primary actions, personal bests, and active states.
- Outfit for display/UI typography.
- Inter for body copy.
- Monospace numerals for lap times and timing data.
- Motorsport telemetry meets premium training tool.
- Sharp, compact, high-contrast cards and controls.

The design should still be built with outdoor readability in mind:

- Large text where the rider needs to read quickly.
- Strong contrast for timing data and action buttons.
- No tiny controls in practice-critical screens.
- No low-contrast text for important information.
- Camera and session screens should prioritize visibility over decoration.

If outdoor testing shows that sunlight readability is not good enough, a future high-visibility theme can be added later using the same layouts and components.

Possible direction:

- Serious motorsport training tool.
- Mobile-first and field-ready.
- High contrast for outdoor readability.
- Dense enough to be useful, but not cluttered.
- Practical, focused, and coach-like rather than playful.

The app should feel like something a rider would actually use beside a bike, cones, and tripod.

## Open Ideation Questions

- What is the first screen when the app opens at the practice spot?
- What is the simplest reliable v1 version of the camera lap timer?
- What should the session summary show immediately after riding?
- What is the right tone for coaching cues?
- Should the app include training plans, or stay drill/session focused at first?
- What data should be required versus optional when saving a session?
- How should video be stored or referenced in a PWA-friendly way?

## Version 1 Focus

The first usable version should prove the core loop:

Choose a drill, set up the camera, run a timed practice session, save lap times, and review progress.

The app does not need to be a complete coaching system immediately. It needs to make one solo practice session more structured, measurable, and useful than training without it.
