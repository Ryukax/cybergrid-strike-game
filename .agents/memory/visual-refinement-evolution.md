---
name: Visual Refinement Evolution + Substrate Diversity
description: Per-n refinement system, substrate diversity v6, 5 body-plans per topology, spawn diversity gate wired into Game.tsx
---

## Morphology system: v6 (current)

File: `artifacts/cybergrid-strike-pre-evo/src/game/virus-morphology.ts`

### Evolutionary architecture

Three pathways per topology:
- **BP 0-2** — pure substrate variants with distinct construction grammars (not scale variants)
- **BP 3** — cross-lineage hybrid: primary substrate frame + secondary substrate features at anatomically plausible attachment points
- **BP 4** — de novo innovation: novel archetype that breaks the family's normal assumptions

`BP(n)` = `Math.floor(nh(n, 0xD00D) * 5)` → 0-4
`TV(n)` = `Math.floor(nh(n, 0xCAFE) * 3)` → fine variant 0-2

### Topology → Substrate domain map

| T# | Name | Domain | BP3 Hybrid | BP4 Innovation |
|----|------|--------|------------|----------------|
| T0 | MONOCOQUE | Mechanical | + Plant barnacle/vine hull | Recursive panel hull (nested Matryoshka) |
| T1 | CHASSIS_FRAME | Mechanical | + Biological (muscle-wrapped rails) | Tripod / H-frame / Spaceframe |
| T2 | CEPHALOPOD | Biological | + Energy (plasma mantle, energy tentacles) | Giant neuron (soma+dendrites+axon) |
| T3 | FUNGAL_COLONY | Colonial | + Mechanical (armature + organic caps) | Rhizomorphic neural mat (flat brain) |
| T4 | VERTEBRATE | Biological | + Mechanical (cyborg: skull+ribs+armor grafts) | Leviathan (massive whale body) |
| T5 | CRYSTAL_CLUSTER | Crystalline | + Energy (plasma-charged crystal) | Snowflake (6-fold lacy branches) |
| T6 | ARTHROPOD | Biological | + Crystal (mineral exoskeleton + crystal legs) | Mantis (raptorial forelegs, triangular head) |
| T7 | CRAWLER_BED | Mechanical | + Crystal (tracks + crystal superstructure) | Centipede (6 separate track units in chain) |
| T8 | ENERGY_FIELD | Energy | + Biological (energy rings around tissue core) | Energy lattice (nodes in geometric web) |
| T9 | PLANT_SIEGE | Plant/Siege | + Mechanical (organic trunk + mech cannon) | Carnivorous maw (snapping trap, no trunk) |
| T10 | SWARM_COLLECTIVE | Swarm | + Crystal (crystal shard units) | Needle filament (elongated narrow column) |
| T11 | BIOMECH_HYBRID | Biomech | + Crystal (crystal grafts replace metal plates) | Exo-brain (mechanical sphere, organic inside) |
| T12 | AVIAN_FLYER | Biological | + Energy (energy vein wings, beam weapon) | Stingray drifter (flat body, whip tail) |
| T13 | ALIEN_ARCH | Alien | + Colonial (alien form filled with colony units) | Disconnected orbitals (no center body) |

### Key shared component functions (new in v6)
- `graftGun(ctx, x, y, R, ...)` — mechanical gun attached at a specific point (for hybrids)
- `graftEnergyField(ctx, cx, cy, R, ...)` — energy halo overlaid on existing body
- `graftCrystalDorsal(ctx, cx, cy, R, ...)` — crystal spikes growing from dorsal surface
- `organicArm(ctx, x0,y0,x1,y1, w, curl, ...)` — bezier-curved organic limb/tendril
- `energyTendril(ctx, ...)` — chaotic plasma arc between two points
- `crystalShard(ctx, bx, by, angle, len, w, ...)` — faceted tapered shard
- `rootTendril(ctx, ...)` — bezier root/vine with curl variation
- `mechArmor(ctx, cx, cy, angle, R, ...)` — rectangular armor plate at angle

### Expanded MorphSig (v6)
Fields: `topology`, `bodyPlan`, `variant`, `cls`, `aspectGroup`, `massCenter`, `domain`, `hybrid`, `innovation`

`morphDistance()` weights: topology 0.40 · bodyPlan 0.22 · domain 0.16 · aspectGroup 0.10 · massCenter 0.06 · cls 0.04 · hybrid 0.02

### Spawn diversity gate (v6 — now WIRED into Game.tsx)
Window: 20 entities. Hard limits: max 3 same topology, max 5 same domain, max 2 same topology+bodyPlan combo.
Soft score: minMorphDistance × per-category decay factors. Hybrid/innovation bonus: +0.12/+0.10 to score.
`pickDiverseSeed()` tries 60 quasi-random candidates, returns best.

**Game.tsx wiring:**
- Line ~927 (normal mode spawn): `value = pickDiverseSeed(); registerSpawn(getMorphSig(value));`
- Line ~983 (VS NPC mode spawn): IIFE inlines the same calls
- Import added: `import { pickDiverseSeed, registerSpawn, getMorphSig } from '../game/virus-morphology';`

### Console validation
`validateDistribution(256)` — checks maxTopoFrac ≤14%, ≥4 unique body-plans
`runSilhouetteDiversityTest(ctx, w, h)` — visual grid of silhouettes with family+body-plan labels

**Why:** v5 achieved substrate variety but all 5 body-plans within each topology were effectively scale/color variants of the same construction grammar. v6 gives each topology 5 genuinely distinct anatomies (3 pure + 1 cross-lineage hybrid + 1 de novo innovation), and the spawn gate now actually runs in-game (v5 gate was dead code).
