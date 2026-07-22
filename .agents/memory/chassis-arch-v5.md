---
name: Chassis Architecture v6
description: v6 paradigm — mechanical part assemblies replace organic silhouettes; each chassis built from named discrete parts with explicit pixel-gaps; verified at gameplay scale R=15px.
---

## Rule
Every chassis is a **MECHANICAL PART ASSEMBLY**, not a continuous organic outline.
Each named part (hull, weapon, engine, armor, sensor) is drawn separately with an
explicit gap `G = Math.max(R * 0.20, 2.2)` between adjacent parts.
The silhouette emerges from part arrangement, never from perimeter deformation.

**Why:** v3–v5 all converged on flower/starfish silhouettes because the geometry was
continuous blob paths (lobes, spokes, ellipses). At gameplay scale (R≈14–18px) these
were indistinguishable. Part assemblies survive small scale because the gap between
parts reads as structural separation even at 14px.

**Critical lesson:** The debug grid acceptance test MUST use gameplay-scale R (≈15px),
NOT a large R (≈60px). A large-R grid is a dishonest test — it passes shapes that
collapse to blobs in the actual game.

## Three mechanical drawing primitives (v6)
- `drawRoundedRect(ctx, cx, cy, w, h, cornerR, ...)` — hull/plate/block shapes
- `drawBar(ctx, x1, y1, x2, y2, hw, ...)` — barrels, struts, arms
- `drawWedge(ctx, tipX, tipY, baseX, baseY, hw, ...)` — nose cones, prows, weapon wedges

Existing helper `compCircle` still used for engine pods, deployment bays, hub nodes.

## The 10 chassis (v6 anatomy)
- `interceptor` — elongated capsule hull (4:1) + 2 flat wing plates at rear + detached engine circle + nose wedge spike
- `striker` — compact hull (offset right) + large forward wedge weapon + taller engine block at rear
- `artillery` — very long thin barrel (bar) + small mount + large rear circle (recoil mass)
- `tank` — armor plates visibly WIDER than hull (clamping effect) + near-square hull + short gun stub
- `rammer` — large WIDE wedge prow (wider than striker) + compact hull + 2 drive circles at rear flanks
- `turret` — square base plate + hub circle + 4 rectangular gun bars at N/S/E/W (NOT lobes)
- `carrier` — large hull + 3 detached deployment pods (front/top/bottom) + 2 rear engine circles
- `swarm` — body circle + front spike bar + rear nub circle; 3 parts, clearly directional
- `controller` — hub + 3 bars in Y-shape (FRONT arm longer = facing indicator) + 3 emitter nodes
- `adaptive` — tank hull + armor plates + medium-length barrel (hybrid, shorter barrel than artillery)

## Removed flower generators
1. **Prime spokes** in `drawVirus`: radial lines for prime-class viruses → removed entirely.
   Now prime class gets no class decoration at gameplay scale.
2. **Tier-3 crown spines** in `drawVirus`: radial spine pairs at lobe peaks → removed.
   Tier-3 now renders only a subtle corona arc glow (no radial geometry).

## Draw pipeline in drawVirus (v6)
1. `getVirusPhenotype(n)` — derives chassis + all traits
2. `drawChassis(...)` — renders complete part assembly; returns BodyGeometry
3. Class decorations: only concentric rings for square/power-of-two; no spokes
4. Refinement tiers: tier-1/2 concentric rings; tier-3 corona glow only
No structural grammar pass — all anatomy is inside chassis functions.

## Debug grid acceptance test
`MORPHOLOGY_SILHOUETTE_DEBUG = true` renders at R=15px (gameplay scale) on black background.
`CHASSIS_PREVIEW_TRAITS` contains representative trait values per chassis.
Verified: all 10 chassis identifiable as mechanical units, no flowers, clear facing direction.

## How to apply
When modifying chassis anatomy, only use `drawRoundedRect`, `drawBar`, `drawWedge`,
`compCircle`. Do NOT add new lobe-path or radial-spoke geometry — that is what caused
v3–v5 to fail. Verify every change with the gameplay-scale debug grid (R≈15px).
