---
name: Chassis Architecture v7
description: v7 paradigm — authored polygon sprites replace all procedural geometry; visual scale 1.4×R independent of collision radius; variable aspect ratios per chassis; no central-core motif.
---

## The paradigm shift (why v3–v6 all failed)

v3, v4, v5, v6 each rewrote the chassis algorithm but kept the same rendering paradigm:
`code generates shape → shape is interpreted as anatomy`

At gameplay scale (R≈14–18px, sprite dia≈28–36px), ANY combination of arcs/ellipses/
bezier paths collapses into an abstract glyph. More rewrites of the same renderer
produce the same perceptual output.

v7 rule: `anatomy is explicitly designed → code assembles and transforms anatomy`

## What v7 does

All chassis shapes are **authored polygon point arrays** — explicit vertex coordinates
placed intentionally, NOT computed from traits. The shapes are designed at ~32px grid
scale and verified at gameplay R=15px before shipping.

## Visual scale

`su = R * 1.4` (sprite-unit, pixels per unit-grid step)
- At R=14 (typical gameplay): su = 19.6px
- At R=20 (boss): su = 28.0px

Visual dimensions are 2–4× larger than collision radius R.
Collision boxes remain at R; sprites extend freely.

## Variable aspect ratios (critical — do NOT normalize)

| Chassis      | Units W×H    | At R=14 (px) |
|---|---|---|
| interceptor  | 2.4 × 1.96   | 47 × 38      |
| striker      | 2.0 × 1.24   | 39 × 24      |
| artillery    | 2.96 × 1.04  | 58 × 20      |
| tank         | 1.52 × 1.44  | 30 × 28      |
| rammer       | 1.82 × 1.96  | 36 × 38      |
| turret       | 1.80 × 1.80  | 35 × 35      |
| carrier      | 2.20 × 2.00  | 43 × 39      |
| swarm        | 1.26 × 0.88  | 25 × 17      |
| controller   | 2.20 × 2.24  | 43 × 44      |
| adaptive     | 1.88 × 1.36  | 37 × 27      |

## Primary shape vocabulary (NO central-core motif)

- **interceptor**: narrow fuselage polygon (11 vertices) + swept wing plates + nose spike
- **striker**: weapon wedge triangle dominates; compact hull + engine block behind
- **artillery**: long thin barrel bar (>40% total width) + rear support block; NO circle
- **tank**: wide rect hull + WIDER armor plates top/bottom + inner detail + short stub
- **rammer**: single continuous forward triangle (hull IS weapon) + rear drive pods
- **turret**: octagonal base + small hub + 4 rectangular gun bars at N/S/E/W
- **carrier**: wide rectangular hull + 4 bay detail panels + 3 pods + 2 engine circles
- **swarm**: teardrop polygon (9 vertices) + rear nub; no separate spike needed
- **controller**: Y-shape bars (fwd arm longer) + hub + 3 emitter nodes; arms define silhouette
- **adaptive**: armored hull rect + wider armor plates + medium barrel (between tank/artillery)

## Low-level sprite ops in virus-morphology.ts

```
spPoly(ctx, pts, cx, cy, su, fill, glow, flash, debug, alpha?)
spRect(ctx, ux0, uy0, ux1, uy1, cx, cy, su, fill, glow, flash, debug, alpha?)
spCirc(ctx, ucx, ucy, ur, cx, cy, su, fill, glow, flash, debug, alpha?)
spBar(ctx, ux1, uy1, ux2, uy2, uhw, cx, cy, su, fill, glow, flash, debug, alpha?)
```
All coords are unit-grid. `su` converts to canvas pixels.
`alpha < 1.0` = engine/secondary layers drawn behind primary.

## Draw pipeline in drawVirus (v7)

1. `getVirusPhenotype(n)` — derives chassis + all traits
2. `drawChassis(...)` — renders complete authored sprite; returns BodyGeometry
3. Class decorations: only concentric rings for square/power-of-two (no spokes)
4. Refinement tiers: tier-1/2 rings; tier-3 corona glow only (no radial spines)
Collision R unchanged; visual sprites are larger.

## Acceptance test

Enable `MORPHOLOGY_SILHOUETTE_DEBUG = true`, screenshot at R=15px (gameplay scale).
The debug grid renders with ACTUAL game colors + glow (not white-on-black), making
it the true acceptance test.

Pass criteria (from user brief):
1. No two units confusable as solid silhouettes → distinct polygon vocabulary
2. <25% resemble stars/flowers/crosses/blobs → no radial motifs
3. Most units do NOT share a circular central mass → no central-core assumption
4. Bounding boxes show varied aspect ratios → see table above
5. Front identifiable in <1 second → all directional units have clear -X feature
6. Largest feature corresponds to gameplay behavior → barrel, wedge, prow, fuselage

## How to apply when modifying

- Only use spPoly/spRect/spCirc/spBar for chassis rendering
- Never add computed lobe-path, arc-blob, or radial-spoke geometry
- If adding a new chassis, author the polygon vertices by hand at ~32px grid scale
- Verify at R=15px (gameplay scale) BEFORE declaring success — not at R=60px
