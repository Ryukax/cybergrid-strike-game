---
name: Visual Refinement Evolution + Substrate Diversity
description: Per-n refinement system, substrate diversity v5, topology-to-domain mapping
---

## Morphology system: v5 (current)

File: `artifacts/cybergrid-strike-pre-evo/src/game/virus-morphology.ts`

### Topology → Substrate domain map

| T# | Name | Domain |
|----|------|--------|
| T0 | MONOCOQUE | Mechanical |
| T1 | CHASSIS_FRAME | Mechanical |
| T2 | CEPHALOPOD | Biological — mantle + tentacles, beak |
| T3 | FUNGAL_COLONY | Colonial — mycelium threads, caps, spore tube |
| T4 | VERTEBRATE | Biological — skull, spine, ribcage |
| T5 | CRYSTAL_CLUSTER | Crystalline — faceted shards, no curves |
| T6 | ARTHROPOD | Biological — thorax/abdomen, 6 legs, mandibles |
| T7 | CRAWLER_BED | Mechanical |
| T8 | ENERGY_FIELD | Energy — plasma rings, tendrils, no hull |
| T9 | PLANT_SIEGE | Plant/Siege — roots, trunk, leaves, spore cannon |
| T10 | SWARM_COLLECTIVE | Swarm — particle cloud, front-density weapon |
| T11 | BIOMECH_HYBRID | Biomech — organic blob + welded graft plates |
| T12 | AVIAN_FLYER | Biological — bat/pterodactyl membrane wings |
| T13 | ALIEN_ARCH | Alien — trefoil knot, nested incompatible polygons |

**Domain balance:** 3 mechanical · 4 biological · 1 crystalline · 1 colonial · 1 energy · 1 plant · 1 swarm · 1 biomech · 1 alien

### Key primitives added in v5
- `stinger(ctx, bx, by, len, baseW, ...)` — organic fang pointing LEFT, used by CEPH/VERT/AVIA instead of `gun()`
- `gun()` kept for machine/plant substrates only

### TOPO_META updated
aspectGroup: 0=round 1=vertical 2=horizontal 3=irregular 4=radial
massCenter: 0=front 1=center 2=rear 3=distributed

### Diversity gate (unchanged from v4)
- Rolling 12-entity history, max 3 of same topology: `pickDiverseSeed()` / `registerSpawn()` / `clearSpawnHistory()`
- `validateDistribution(256)` in console to verify max topo fraction ≤14%, ≥12 unique

**Why:** v4 achieved silhouette variety but all 14 topologies were machine-construction-grammar (rails, hulls, booms, tracks). v5 replaces 11 of 14 with different substrate families so mechanical entities are ~21% of the population.
