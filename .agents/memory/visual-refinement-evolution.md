---
name: Visual Refinement Evolution + Morphology System
description: Per-n refinement system, spawn bias mechanics, and all morphology architecture versions.
---

## Refinement System

`refinement[n]` (Float32Array, length 256) in `evolution.ts`:
- Increments +0.18 when virus `n` deals damage, +0.04 on edge escape
- Drives spawn weight: `1 + 4 × refinement[n]` (up to 5× more likely)
- Drives rendering detail via `drawVirus(..., refinement)` — tiers unlock at 0.30, 0.65

Three rendering tiers (purely additive over the body):
- Tier 1 (0→30%): outer structural ring
- Tier 2 (30→65%): second ring + luminous inner core
- Tier 3 (65→100%): apex crown spines + corona glow

Row bias: 25% uniform + 75% historical escape distribution after 5 total escapes.

---

## Phenotype Grammar (v4 morphology — architecture-first)

**Design hierarchy:** Functional Traits → Body Architecture → Mass Layout → Body Topology → Attachment Anchors → Functional Structures → Refinement

### Body Architectures (10 types, all derived deterministically from traits)

**v5 topology-first rewrite** (confirmed visually distinct in silhouette debug grid):

| Architecture | Derives from | Topology | Structural ratio |
|---|---|---|---|
| `compact` | Default / armored+slow | 1 circle | R×0.90 — baseline reference |
| `elongated` | speed > 0.50 | 1 wide ellipse | 5:1 width:height (rX=1.55R, rY=0.30R) |
| `forwardWeighted` | speed>0.62 + aggression>0.50 | 2 circles + bridge | Front R×0.78, rear R×0.32 (2.4× ratio) |
| `rearWeighted` | attackRange>0.62 + mass>0.52 | 2 circles + bridge | Front R×0.32, rear R×0.78 (mirror) |
| `segmented` | regen>0.58 + speed<0.56 | 3 circles + 2 bridges | Spacing 1.04R ensures visible gaps |
| `ring` | radial + armor>0.55 | 1 annulus, evenodd | Inner = 0.58R (hole 61% of outer) |
| `radialCore` | radial (default) | Hub + 3 rectangular arms | Hub R×0.42, arms extend 0.60R at 0°/120°/240° |
| `splitCore` | asymmetric + regen>0.56 | 2 circles + bridge | Vertical sep 0.60R, lobe R×0.52, bridge W×0.28R |
| `winged` | evasion>0.56 + speed>0.46 | Thin ellipse + 2 swept triangles | Wing span R×1.10 vs body height R×0.18 (6:1) |
| `shielded` | armor>0.60 + speed<0.42 | Rect shield + circle core | Shield H×0.95R, core R×0.44 (shield is 2× taller) |

**Critical rule: multi-mass bodies are drawn as separate shapes with visible gaps, NOT as single bezier paths.**
No universal outer hull. Allow gaps, bridges, negative space.

**FRONT orientation:** FRONT = left (π direction). forwardWeighted large mass is LEFT, rearWeighted large mass is RIGHT.

Symmetry class assignment:
- `perfect-square`, `power-of-two` → radial → usually `ring` or `radialCore`
- `prime` → bilateral → usually `forwardWeighted`, `elongated`, `compact`
- composites → mixed via `h(19)` hash

### BodyGeometry Interface (new in v4)

Each body-drawing function returns `{ frontReach, rearReach, sideReach, R }`:
- `frontReach`: distance from center to body surface toward FRONT (left)
- `rearReach`: distance from center to body surface toward REAR (right)
- `sideReach`: distance from center to body surface toward UP/DOWN
- `R`: nominal cell radius for appendage sizing (lineWidth etc.)

All structural grammar functions accept `geo: BodyGeometry` instead of a bare `R`. Positioning uses `geo.frontReach` / `geo.rearReach` / `geo.sideReach`; sizing still uses `geo.R`.

### Critical orientation fact
Viruses move LEFT. `FRONT = Math.PI` (left = attack direction). `REAR = 0` (right = trailing). Body functions must place the wide/attack mass at LEFT and propulsion at RIGHT. The `forwardWeighted` wide end is at `cx - frontReach` (left).

### Structural grammar (anchor-driven)

Three exclusive rendering paths (bilateral / radial / asymmetric). Same layer order in all paths:
1. **Locomotion** (rear): fins, jets, or passive (no appendage)
2. **Weapons** (front/perimeter): claws, barrels, pulse emitters, radial spines, radial barrels
3. **Armor** (perimeter, unlocks at refinement 0.08+): arc, flank plates, radial shell, asymmetric patch
4. **Sensors** (forward-top, unlocks at refinement 0.28+): bilateral antennae, radial sensor nodes, asymmetric antenna

### Refinement crown (unchanged from v3)
Apex spines placed using `effectiveR = (frontReach + rearReach + sideReach) / 3`.

### Key identifiers (v4)

- **`drawVirus(ctx, cx, cy, n, cell, flash, green, refinement)`** — unchanged public signature
- **`getVirusPhenotype(n)`** — now includes `architecture: BodyArchitecture` field
- **`drawPrimaryBody(ctx, cx, cy, R, p, fill, glow, flash) → BodyGeometry`** — dispatches to architecture-specific body fn
- **`drawPhenotypeStructures(ctx, cx, cy, geo, p, refinement)`** — uses BodyGeometry for anchors
- **`deriveArchitecture(symmetry, traits) → BodyArchitecture`** — deterministic, no randomness

## Phenotype Grammar (v3 morphology — superseded)

**Design hierarchy:** Functional Traits → Body Plan → Symmetry → Anatomy → Surface Detail

Symmetry is determined once and drives ALL structural placement. Three exclusive rendering paths in `drawPhenotypeStructures`:

- **BILATERAL** (primes): Paired structures mirrored about FRONT-REAR axis.
- **RADIAL** (powers-of-two, perfect-squares): N-fold rotational structures.
- **ASYMMETRIC** (some composites): Single dominant structures, deliberately offset.

Base body was a sinusoidal lobe polar path (`virusRadius()`) — this produced flower/star convergence and was replaced in v4.

## Phenotype Grammar (v2 morphology — superseded)

Pre-v3 system: symmetry was chosen in phenotype but ignored during rendering. All viruses used same 8-pass grammar. Removed.
