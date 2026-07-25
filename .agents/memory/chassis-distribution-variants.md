---
name: Chassis distribution + variant system
description: 12-slot weighted sequence replacing n%8; variant selector for intra-chassis diversity; which chassis have variant branches.
---

## Distribution table
`CHASSIS_SEQ = [0, 4, 1, 5, 2, 7, 4, 3, 1, 6, 5, 7]` (12 slots)

- Y-shapes (3 ARTILLERY + 6 SPECTER): 2/12 = 17% (was 25% with n%8)
- Segmented/crescent/bilateral/serial get 2 slots each = 17% each (up from 13%)
- WEDGE (0), TANK (2): 1 slot each = 8% each
- Sequence ordered so no two adjacent slots share the same chassis OR family

## Variant selector
`getChassisVariant(n) = (floor(n/12) + floor((n%12)/4)) % 3`

**Why:** The two appearances of the same chassis within the 12-slot cycle fall at different 4-slot thirds (positions differ by ~5 slots), so they usually get different variants. Cycle count adds 1 each full cycle so the "starting" variant rotates.

**How to apply:** Compute `v = getChassisVariant(n)` at top of each secondary case that branches on variant; pass it as a derived constant, not a parameter.

## Which chassis have variant branches

| Chassis | Variants | What varies |
|---------|----------|-------------|
| 0 WEDGE | 1 (no branch) | Low-freq; single strong design |
| 1 STRIKER | 3 | V0: tall fin + head lobe + thorn · V1: wide swept crest + compact snout + 2 spines · V2: split dorsal (2 lobes with gap) + wide head mass |
| 2 TANK | 1 (no branch) | Low-freq; single strong design |
| 3 ARTILLERY | 3 | V0: Y-triskelion · V1: T/+ cross · V2: L-shape (long forward + steep lateral + short stub) |
| 4 CRAWLER | 3 | V0: asymmetric claws (upper dominant) · V1: equal bilateral claws · V2: mega-claw upper + lower horn stub only |
| 5 BRUISER | 3 | V0: abdomen + tail (3-seg) · V1: single wide abdomen (2-seg) · V2: 4-segment cascade |
| 6 SPECTER | 3 | V0: 3 asymmetric arms (non-120°) · V1: bifurcating trunk → 2 sub-arms + short upper · V2: 4-arm unequal cross (0°/90°/180°/270°) |
| 7 STALKER | 3 | V0: jaw + 3-spine diminuendo + bilateral fan · V1: enlarged jaw + 2 taller spines + upper-only fan · V2: 4-spine crescendo + no jaw + tail cross |

## Key rule
Chassis 0 (WEDGE) and 2 (TANK) intentionally have no variant branching because they appear at 8% frequency — single strong designs are sufficient. Forcing variants onto low-frequency chassis just adds code noise.
