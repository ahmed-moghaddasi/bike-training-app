# Apex Lab Drill Diagram Method

This is the repeatable process for creating Apex Lab drill diagrams after finalizing the Figure Eight reference.

## Goal

Each drill diagram should be simple enough to read outdoors on a phone while still being accurate enough to set up cones and understand the riding line.

The diagram is not a decorative illustration. It is a practical riding map.

## Final Visual System

Use the approved diagrams in `design/diagrams/` as the visual reference. The Figure Eight diagram defines the route/arrow style, the Circle diagram defines the cone size and cone-to-riding-line gap, and the Hairpin diagram defines the current dimension text style.

Each drill diagram should use:

- Orange cone markers viewed from above, with a small center hole.
- A charcoal dotted riding line.
- Small charcoal arrows placed directly on the riding line.
- A light silver diagram surface.
- Setup dimensions only when they are needed to build the drill accurately.
- Dimension labels use red body text at a lighter weight, with no white outline.
- A camera icon only when the diagram is showing the full setup view.
- No extra grid or decorative visual noise.

Cone size and path-gap standard:

- Detail diagram cones use `r=10.625` with `r=4.1` center holes when the riding radius is around `112px`.
- Card diagram cones use `r=5.625` with `r=2.2` center holes when the riding radius is around `56px`.
- For circular paths, place cone centers slightly inside the riding line so the cone edge has a small visible gap from the dotted path.
- The approved Circle diagram defines the standard cone size and cone-to-riding-line gap for all future diagrams.
- If a future diagram uses a different scale, preserve the same visual proportion rather than copying the exact pixel values.

Use two diagram levels:

- Card diagram: cones, riding path, and arrows only.
- Detail setup diagram: cones, riding path, arrows, camera marker, and key measurements.

The app page can explain setup details outside the diagram, but the detail diagram should carry the most important setup geometry.

## What Went Wrong During The Figure Eight

1. The first diagrams were too literal and cluttered.
   They included too many elements and made the route harder to understand.

2. The riding line was inferred incorrectly.
   I treated the Figure Eight as two separate loops or a pinched shape instead of a continuous rider path.

3. The center cone placement was misunderstood.
   I initially placed multiple center cones and later placed the cone too close to the riding line. The correct approach is one center cone offset from the crossover.

4. The path geometry was hand-shaped too early.
   Bezier curves made the diagram look close but not precise. For drills based on circles, arcs, radii, and repeated spacing need to be built with exact SVG geometry.

5. The arrows were treated like icons.
   They looked bad when floating inside the route. They only started working when placed directly on the dotted riding line and rotated tangent to the rider's motion.

6. The camera field-of-view became clutter.
   The transparent triangle explained where the camera pointed, but it interrupted the drill. The cleaner answer was a simple camera icon plus a measurement bracket.

7. Measurement style was inconsistent at first.
   The camera distance worked better once it used the same bracket and dashed-guide style as the circle diameter.

8. I changed too much at once in some iterations.
   The useful loop was: adjust one thing, screenshot, compare, then adjust again.

## What Worked

1. Starting with only cones and riding path.
   Removing extra elements made the mistakes easier to see.

2. Using the rider's hand sketch as the source of intent.
   The sketch clarified the real movement better than text alone.

3. Separating drill knowledge from diagram geometry.
   First decide how the rider moves, then convert that into cones, path, and arrows.

4. Using exact geometry where the drill requires it.
   The final Figure Eight worked once both lobes were made from equal-radius SVG arcs.

5. Screenshot comparison.
   Looking at the rendered diagram, not just the code, caught spacing and direction problems quickly.

6. User correction on direction.
   Arrow direction is easy to get wrong from a static diagram. It should be checked visually against the intended riding motion.

7. Separating card and detail needs.
   The card diagram should stay quick to read. The detail diagram can zoom out and include camera placement and dimensions.

8. Using one measurement style.
   Red bracket lines, dashed guides, and lighter red body labels make dimensions readable without turning the diagram into a technical drawing.

## Repeatable Workflow

### 1. Explain The Drill First

Before drawing, write a short plain-language explanation:

- What skill the drill trains.
- How many cones it uses.
- The rider's start point.
- The riding direction.
- Whether the rider passes inside or outside each cone.
- Where the camera should be placed for timing.
- Which point the camera should be perpendicular to.
- Which dimensions matter for setup.
- Whether the drill repeats as a loop or has a start and finish.
- Any setup variants that change the timing comparison.

This explanation should be simple enough that the rider can sketch the route from it.

### 2. User Sketch

The user draws the drill by hand and uploads a photo.

The sketch should include:

- Cones.
- Riding line.
- Direction arrows.
- Camera position, if timing is part of the setup.
- Important dimensions, if known.
- Any important start/finish point.
- The intended relationship between cones and riding line.

The sketch does not need to be clean. It only needs to show intent.

### 3. Interpret Before Coding

Before editing SVG, identify:

- The base shape: circle, oval, line, hairpin, L, or compound shape.
- The key anchors: cone centers, turn centers, crossover points, start/finish.
- The rider path: the actual line the bike follows, not the cone centerline.
- The arrow direction: clockwise, counterclockwise, alternating, or point-to-point.
- The timing point: the line or cone the camera should watch.
- The camera location: perpendicular to the timing point when possible.
- The required dimensions: circle diameter, cone gap, camera distance, gate width, or approach length.
- Any symmetry: equal radius, mirrored layout, repeated cone spacing.

If the drawing and drill description disagree, ask or make a small test diagram before proceeding.

### 4. Build With Geometry

Use SVG primitives intentionally:

- Use `circle` or `A` arc commands for perfect circular turns.
- Use `path` with straight line commands for straights.
- Use Bezier curves only for organic transitions that are not strict circles.
- Keep cone positions mathematically aligned where the drill is symmetrical.
- Keep card and detail diagrams based on the same geometry, scaled proportionally.

For circular drills, define:

- Center point.
- Radius.
- Cone offset from the riding line.
- Arrow positions on the circumference.

For line-based drills, define:

- Start point.
- End point.
- Turn apex points.
- Cone offsets from the rider path.

### 5. Place Cones Second

After the riding path is correct, place cones.

Cone rules:

- Cones are references, not the riding line.
- The rider path should not run through cone centers.
- Matching cones should have matching distance from the route.
- Use the approved Circle cone size and cone-to-riding-line gap as the default visual standard.
- If cone spacing changes the drill, it becomes a setup variant and gets separate timing logs.

### 6. Place Arrows Last

Arrows should be added only after the path is correct.

Arrow rules:

- Arrows sit directly on the riding line.
- Arrows are tangent to the path at that point.
- Arrows point in the real riding direction.
- Use a few arrows, not many.
- Avoid placing arrows on top of cones or at visually crowded crossings.

For circular paths, arrow rotation should match the tangent direction at the arrow's location.

### 7. Add Camera And Dimensions For Detail Diagrams

Only add camera and dimensions after the path, cones, and arrows are approved.

Camera rules:

- Use a small charcoal camera icon.
- Place the camera where the rider would actually put the phone or tripod.
- Aim the camera at the timing point, but do not use a field-of-view triangle unless the diagram truly needs it.
- Prefer placing the camera perpendicular to the timing cone or timing line.
- Keep the camera outside the riding path with enough space to imply safety.
- If the camera distance is part of setup, show it with the same measurement style as other dimensions.

Dimension rules:

- Use red bracket lines with short end ticks.
- Use red dashed guide lines from the measured objects to the bracket.
- Use red body-text labels at a medium weight, without a white outline.
- Keep labels outside the riding path whenever possible.
- Use only the dimensions needed to recreate the drill.
- Make all dimensions match the actual SVG scale.

Avoid:

- Large transparent field-of-view overlays that interrupt the route.
- Multiple measurement styles in the same diagram.
- Labels covering cones, arrows, or the riding line.

### 8. Screenshot And Compare

After every meaningful edit:

1. Take a screenshot of `design/diagram-reference.html`.
2. Compare it to the uploaded sketch.
3. Check these in order:
   - Are the cone counts correct?
   - Is the path shape correct?
   - Is the path on the correct side of each cone?
   - Are repeated radii or distances consistent?
   - Are arrows on the line?
   - Are arrows pointing the correct direction?
   - Is the camera perpendicular to the intended timing point?
   - Are the dimensions to scale?
   - Do measurement labels stay out of the riding path?
   - Is the card version still readable?

Only move to the next diagram once the reference version is visually approved.

## Preferred Collaboration Pattern

For each new drill:

1. Codex explains the drill and likely layout.
2. User draws the route by hand and uploads it.
3. Codex recreates the diagram in `design/diagram-reference.html`.
4. Codex screenshots and compares against the sketch.
5. User corrects direction, spacing, or shape.
6. Codex iterates until approved.
7. Codex adds camera placement and dimensions to the detail setup version.
8. Codex screenshots and compares again.
9. Codex ports the approved diagram into the app's reusable SVG component.

## Figure Eight Reference Notes

The approved Figure Eight uses:

- Two equal-radius circular loops.
- One center cone offset beside the crossover.
- Three outside cones per loop at matching spacing.
- The same cone size and cone-to-riding-line gap standard as the approved Circle diagram.
- A dotted path that forms the complete figure-eight route.
- Direction arrows placed on the dotted line, not inside the open area.
- A small camera icon placed below the center cone, perpendicular to the center cone/timing point.
- An `8m dia.` bracket between the top and bottom cones of one circle.
- A `5m camera` bracket between the center cone and camera.
- No field-of-view triangle in the final approved version.

This should be used as the baseline quality bar for the remaining drill diagrams.
