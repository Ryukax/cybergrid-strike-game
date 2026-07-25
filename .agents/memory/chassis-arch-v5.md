---
name: Chassis Architecture v9
description: v9 paradigm — hard angular geometry only, no arcs/circles, extreme aspect ratios, front/middle/rear zones, overlays stripped. Replaces v7 artwork entirely.
---

## Why v7 artwork still read as flowers

v7 polygon vertices were designed around a central mass with appendages radiating from it.
Even as explicit authored polygons, the underlying *design vocabulary* was:
`central blob + symmetrically distributed protrusions` = flower at 14–18px scale.

The fix was not another coordinate rewrite — it was destroying the design vocabulary entirely.

## v9 rules (non-negotiable)

1. **No arc(), ellipse(), bezierCurveTo(), quadraticCurveTo() — ever.**
   No spCirc. Only spPoly, spRect, spBar.
2. **No central circle / ring / orb.** Not as hub, not as core, not as junction.
3. **No radial or evenly-spaced appendages.** No symmetric wings. No petal distribution.
4. **Extreme aspect ratios.** Most chassis ≥ 1.8:1 or ≤ 0.55:1. Only tank is near-square and it must be the squarest by a large margin.
5. **Front / Middle / Rear zones explicit.** ≥60% mass on dominant axis.
6. **Dominant feature = gameplay function.** Barrel visible on artillery. Prow dominates rammer. Mast makes controller taller than wide.
7. **All overlays stripped from drawVirus.** Sections 3 (class rings) and 4 (refinement tiers) removed. Only chassis + glow.

## Chassis designs (v9, unit-grid space, FRONT = −X)

| Chassis | Approx px @ R=15 | Primary shape | Key rule |
|---|---|---|---|
| interceptor | 60×20 | Tapered hexagon fuselage + delta fins swept rearward | Fins NOT radial — both angle back |
| striker | 44×26 | Large forward triangle + rear hull block | Triangle is dominant shape |
| artillery | 70×18 | Rear block + mount + long spBar barrel (54% of width) | Barrel tip wider cap |
| tank | 40×36 | Outer armor plates + hull body + inner detail + short stub | Most square chassis |
| rammer | 50×30 | Single large triangle (prow IS weapon) + rear block | No circles at all |
| turret | 36+barrel × 30 | Rear base block + side cheeks + ONE directional barrel | NOT 4-way — directional only |
| carrier | 62×38 | Wide rect hull + 4 bay panels (alpha 0.45) + front armor + rear | Bays visually obvious |
| swarm | 22×10 | 5-vertex dart/arrowhead | Smallest by far |
| controller | 34×52 | Vertical mast + mast crossbar + horizontal body + forward arm | TALL: height > width |
| adaptive | 48×28 | Armor plates + hull + inner detail + medium spBar barrel | Barrel between tank and artillery |

## Acceptance test

Enable `MORPHOLOGY_SILHOUETTE_DEBUG = true`, screenshot at R=15px.
Pass criteria from v9 brief:
- No flower or starfish shapes
- Zero central circles on any chassis
- ≤1 unit near 1:1 aspect ratio (tank is the exception by design)
- No radial symmetry
- Artillery barrel visible and long (>50% width)
- Rammer front dominant (triangle takes >60% mass)
- Tank visibly boxier than interceptor

## How to apply when modifying

- Only spPoly, spRect, spBar — never spCirc
- If tempted to add a circle "just for detail" — don't. Use a small rect or diamond polygon.
- If adding a new chassis, verify it cannot be mistaken for any existing one as a solid silhouette
- Verify at R=15px (gameplay scale) using the debug grid — not R=60px

## Visual scale

`su = R * 1.4` (unchanged from v7)
- At R=14 gameplay: su ≈ 19.6px
- At R=20 boss: su ≈ 28.0px
Collision R unchanged; visual sprites extend beyond it.
