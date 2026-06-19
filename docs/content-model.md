# Apex Lab Content Model

This document defines the content and data structures Apex Lab needs. It does not contain the final drill content yet; it defines what the app needs to know, store, calculate, and compare.

## Core Rule

Lap times and progress are only comparable within the same timing context:

```text
bike + drill + setup variant
```

Examples:

- `Pitbike 160 + Figure Eight + 9m circles`
- `Pitbike 160 + Figure Eight + 6m circles`
- `Ninja 400 + Figure Eight + 9m circles`

These are three different timing contexts. They should have separate best times, trends, and progress charts.

## Bike

A bike is the machine used for a session. The app should support user-owned bike profiles rather than only generic bike categories.

Common training bike examples:

- Pitbike 110-190.
- MiniGP / Ohvale-style bike.
- Ninja 400.
- Yamaha R3.
- KTM RC 390.
- Lightweight track bike.
- Full-size track bike.

Fields:

```text
id
name
category
engineSize optional
notes optional
isCurrent
createdAt
updatedAt
```

Example:

```text
id: bike_pitbike_160
name: Pitbike 160
category: pitbike
engineSize: 160cc
notes: Parking-lot training bike
isCurrent: true
```

## Drill

A drill is a reusable training exercise. It explains what skill is being trained, how to set up the cones and camera, how to ride the drill, and how to progress.

Fields:

```text
id
name
shortDescription
whatThisTrains
whyItMattersOnTrack
layoutGraphicKey
demoVideoUri optional
defaultSetupVariantId
setupVariants
conePlacementSteps
cameraPlacement
howToRideSteps
commonMistakes
progressions
timingRule
createdAt
updatedAt
```

Example drill themes:

- Figure Eight: body transition through the crossover.
- Hairpin: brake release, tight apex, and drive out.
- L-Turn: late apex technique.

## Setup Variant

A setup variant is a specific measurable version of a drill layout.

Setup variants matter because changing the layout can change lap times. For example, a 9m Figure Eight and a 6m Figure Eight should not share the same best time.

Fields:

```text
id
drillId
name
description optional
coneCount
measurements
layoutNotes optional
isDefault
createdAt
updatedAt
```

Example:

```text
id: figure_8_9m
drillId: figure_8
name: 9m circles
coneCount: 9
measurements:
  - Circle diameter: 9m each
  - Cone placement: 4 cones at 4.5m radius per circle
  - Crossover cone: center join between circles
isDefault: true
```

## Camera Placement

Camera placement can live on the drill or setup variant depending on whether the camera position changes by layout. The first version can keep it on the drill unless a drill needs variant-specific camera guidance.

Fields:

```text
positionDescription
heightRecommendation optional
whatCameraShouldSee
timingPoint
detectionZoneSuggestion
framingTip optional
```

Example:

```text
positionDescription: Place the phone at the crossover cone, facing down the join between both circles.
heightRecommendation: Waist height on a tripod.
whatCameraShouldSee: Both circles and the crossover line.
timingPoint: Bike crosses the crossover cone.
detectionZoneSuggestion: Vertical timing line through the crossover cone.
```

## Timing Rule

The timing rule defines what starts a session and what counts as a lap.

Fields:

```text
startRule
lapRule
endRule optional
validComparisonContext
```

Example:

```text
startRule: Timer starts on first detected pass through the timing line.
lapRule: Each later detected pass through the timing line records one lap.
validComparisonContext: same bike + same drill + same setup variant
```

## Progression

A progression explains how to make a drill harder or more specific once the rider is consistent.

Progressions need a comparison type:

```text
sameTimingContext
newSetupVariant
```

Examples:

- Same timing context: focus on smoother body transition, later eyes, or more consistent throttle.
- New setup variant: shrink circles from 9m to 7m, move an apex cone, shorten the distance between transitions.

Fields:

```text
id
drillId
title
description
comparisonType
targetSetupVariantId optional
```

## Session

A session is one saved practice run.

Fields:

```text
id
date
bikeId
drillId
setupVariantId
lapTimes
bestLap
averageLap
spread
lapCount
videoUri optional
notes optional
conditions optional
focus optional
createdAt
updatedAt
```

Example:

```text
id: session_2026_06_08_figure_8
date: 2026-06-08T18:30:00
bikeId: bike_pitbike_160
drillId: figure_8
setupVariantId: figure_8_9m
lapTimes: [15.62, 15.10, 14.82]
bestLap: 14.82
averageLap: 15.18
spread: 0.80
lapCount: 3
videoUri: local/session-video-uri
notes: Felt smoother once I looked through the crossover.
```

## Lap

Laps can be stored as simple values in version 1, but the richer model is useful for video review.

Fields:

```text
lapNumber
time
timestampInVideo optional
isBest optional
detectionEventId optional
```

## Conditions

Conditions explain why a session may have been faster, slower, or inconsistent.

Fields:

```text
surfaceCondition optional
weather optional
temperature optional
tireNotes optional
setupNotes optional
```

Examples:

- Dusty lot.
- Cold tires.
- Cones moved slightly wider.
- Rough pavement near apex.

## Rider Notes

Rider notes support self-coaching.

Fields:

```text
focusForSession optional
whatFeltGood optional
whatWentWrong optional
whatToTryNext optional
freeformNotes optional
```

Version 1 can use a single notes field and expand later.

## Detection Event

Detection events come from the camera timer. They are useful for debugging, video alignment, and future correction tools.

Fields:

```text
id
sessionId
lapNumber
detectedAt
videoTimestamp
confidence optional
eventType
```

Event types:

```text
sessionStart
lapDetected
falsePositive optional
manualCorrection optional
```

## Progress Summary

Progress summaries can be calculated rather than stored.

A progress summary is calculated for one timing context:

```text
bikeId + drillId + setupVariantId
```

Calculated fields:

```text
bestLap
latestBestLap
latestAverageLap
sessionCount
totalLaps
lastPracticedAt
lapTimeTrend
```

Version 1 primary graph:

```text
best lap per session over time
```

Future graph options:

```text
average lap per session over time
consistency or spread over time
all laps scatter plot
```

## User Preferences

Fields:

```text
currentBikeId
lastOpenedDrillId optional
```

Version 1 does not need a full Settings page.

## Data Relationships

```text
Bike
└─ Session

Drill
├─ Setup Variant
├─ Camera Placement
├─ Timing Rule
├─ Progression
└─ Session

Session
├─ Bike
├─ Drill
├─ Setup Variant
├─ Laps
├─ Conditions
└─ Detection Events
```

## Version 1 Priorities

Required for version 1:

- Bike.
- Drill.
- Setup Variant.
- Camera Placement.
- Timing Rule.
- Session.
- Lap times.
- Notes.
- Calculated Progress Summary.

Can be simplified in version 1:

- Conditions can start as freeform setup/session notes.
- Rider Notes can start as one notes field.
- Detection Events can be internal/debug-only at first.
- Demo videos can be placeholders until actual drill videos exist.
