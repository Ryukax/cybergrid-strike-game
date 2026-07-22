---
name: Visual Refinement Evolution
description: The evolution system in cybergrid-strike-fitted — per-n visual refinement replacing the genetic algorithm.
---

## The Rule

Evolution is NOT a genetic algorithm. It is per-integer-value visual refinement:
- `refinement[n]` in `Float32Array(256)` grows as viruses with that value land hits (+0.18) or edge-escape (+0.04), clamped to [0,1].
- Refinement drives two things: spawn weight bias (1 + 4×r → refined forms up to 5× more likely) and VMES rendering detail.
- Row bias: `rowEscapes[0/1/2]` tracks successful lanes; `sampleSpawnRow()` uses 25% uniform + 75% historical once 5 escapes have accumulated.

## Rendering Tiers (virus-morphology.ts `drawVirus`)

- `refinement` parameter added after `green` (default 0, so all old call sites still work).
- Body radius scales by `1 + refinement * 0.20`.
- Archetype overlay alpha boosted by up to 1.5× at apex.
- Tier 1 (0→30%): outer structural ring.
- Tier 2 (30→65%): second ring + inner core glow.
- Tier 3 (65→100%): crown spines at each lobe peak + outer corona glow.

## Key Files

- `evolution.ts` — `createEvolutionState`, `recordDamage`, `recordEdgeEscape`, `sampleVirusValue`, `sampleSpawnRow`, `getRefinement`.
- `renderer.ts` — `draw()` accepts optional `refinementMap?: Float32Array`, passes `refinementMap?.[e.value ?? 6] ?? 0` to each `drawVirus` call.
- `Game.tsx` — `evolutionRef` holds state; `recordDamage` on enemy hit, `recordEdgeEscape` on edge exit; `evolutionRef.current.refinement` passed to `draw()`.

**Why:** The user rejected a complex genetic algorithm (fitness, weights, mutation, selection, counter-adaptation) in favor of a simple "more it lands, more refined its visual interpretation" concept. The n value is the lineage identity; rendering deepens as that lineage succeeds.

**How to apply:** Never re-add fitness functions, trait vectors, or population-level selection. Keep the three exported sample/record functions as the entire public API. Do not add `evolvePopulation`, `resetEvolutionaryPressures`, or similar batch operations.
