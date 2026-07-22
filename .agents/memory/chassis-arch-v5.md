---
name: Chassis Architecture v5
description: v5 paradigm shift — functional chassis replace body architectures in virus-morphology.ts; each chassis is a combat role with anatomy built-in.
---

## Rule
`ChassisType` replaces `BodyArchitecture`. Each chassis function renders ALL anatomy
(weapon + propulsion + armor + core) in one call. §7 structural grammar and §8
phenotype renderer were deleted — anatomy is no longer assembled from separate layers.

**Why:** Prior iterations (v3 sinusoidal lobes, v4 named architectures) still produced
blobs because silhouette diversity came from perimeter deformation. The v5 brief demanded
functional chassis construction: every visible structure must have a combat reason, and
the role must be readable from silhouette alone.

## The 10 chassis types
- `interceptor` — torpedo fuselage + swept fins + engine nozzle + nose spike
- `striker` — large forward wedge (the melee weapon) + compact body + rear nub
- `artillery` — large rear mass + small core + dominant long barrel (left = FRONT)
- `tank` — thick armor annulus (even-odd fill) + inner core + short gun stub
- `rammer` — massive arrowhead (left = FRONT) + compact rear body; mass-forward
- `turret` — hub + 3–6 rectangular gun barrels radiating outward
- `carrier` — large body + pod ports at perimeter (4 or 6 based on regen)
- `swarm` — tiny circle + small spike + rear nub; minimal anatomy by design
- `controller` — hub + 3 structural arms at 120° + emitter nodes at tips
- `adaptive` — offset core + one dominant arm biased toward FRONT

## Derivation priority (deriveChassis)
1. Radial symmetry → turret (aggression) or controller (ranged)
2. attackRange > 0.66 → artillery
3. armor > 0.60 + speed < 0.48 → tank
4. mass > 0.56 + aggression > 0.54 → rammer
5. speed > 0.60 + mass < 0.40 → swarm
6. regen > 0.56 + mass > 0.38 + speed < 0.55 → carrier
7. speed > 0.52 + evasion > 0.26 → interceptor
8. aggression > 0.58 + melee → striker
9. asymmetric → adaptive; bilateral fallbacks by dominant trait

## Engineering variables
- Artillery: `barrelLen = R * (0.80 + p.attackRange * 1.00)` — scales with trait
- Tank shell: outer R vs inner R (even-odd fill — must use `ctx.fill('evenodd')`)
- Turret: `gunCount = max(3, min(6, 3 + floor(aggression * 4)))`
- Controller arms use `REAR` angle (π) as the base; 3 arms at 120° spacing

## Draw pipeline in drawVirus (v5)
1. `getVirusPhenotype(n)` — derives chassis + all traits
2. `drawChassis(...)` — renders complete anatomy; returns BodyGeometry
3. Class decorations (ring for squares/powers, spokes for primes) — kept
4. Refinement tiers (outer ring, second ring, center glow) — kept; additive only
No `drawPhenotypeStructures` call — it was removed.

## Debug grid
`MORPHOLOGY_SILHOUETTE_DEBUG = true` renders the chassis grid instead of game.
Each chassis uses representative trait values from `CHASSIS_PREVIEW_TRAITS`.
Verified: all 10 chassis are identifiable by silhouette (monochrome) alone.

## How to apply
When adding a new chassis or modifying anatomy, fold ALL of that chassis's
weapon/propulsion/armor into the chassis function itself. Do NOT re-add a
separate structural grammar pass — that is what caused prior iterations to fail.
