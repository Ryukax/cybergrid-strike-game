# System Integrity Economy and Procedural Genome Architecture

CyberGrid Strike is an ecosystem optimizer. Score, XP, direct kill rewards, and
client-authored enemy value are legacy concepts and must not be used for new
features.

## Sources of truth

- `lib/ecosystem/src/index.ts` owns deterministic genome derivation, computed
  organism value, integrity math, merit, inventory progression, and treasury
  weighting.
- `artifacts/api-server/src/routes/ecosystem.ts` owns encounters and validates
  all contribution-producing actions.
- External ownership is an adapter concern. A wallet or marketplace may expose
  ownership rights, but it cannot change genome identity or combat truth.

## Authoritative flow

1. The server issues an encounter with an ID, expiry, sector, node, and
   SHA-256-derived virus genomes.
2. The client renders the returned genome and submits player intent.
3. The server validates player, encounter, virus, action envelope, damage, and
   neutralization state.
4. Only the server creates Integrity Work, changes global/sector/node integrity,
   grants shards and research, records specimens, and advances merit.
5. Expired encounters apply corruption pressure for organisms that were
   ignored.
6. A future distribution job computes diminishing-return weights from verified
   work and distributes a bounded treasury. It never mints directly per kill.

## Determinism contract

Genome version 1 hashes `cybergrid:v1:<seed>` with SHA-256. Every downstream
field is derived from the digest: classification, morphology, locomotion,
constitution, weapon architecture, defense, animation, behavior, mutation,
rarity, entropy, corruption potential, restoration impact, and value.

The seed stays server-side. Clients receive the digest and derived phenotype.
Changing the algorithm requires a new genome version; version 1 must remain
stable so collected specimens never mutate retroactively.

## Integrity visualization contract

Renderers should consume node integrity first, then sector, then global:

- 80-100: synchronized motion, stable geometry, bright clean grid.
- 50-79: occasional noise, restrained flicker, minor stream desynchronization.
- 20-49: broken cells, fragmented motion, unstable lighting and noisy audio.
- 0-19: severe corruption, while preserving readable hit boxes and accessible
  controls.

Visual corruption is presentation only. It must never alter authoritative
collision or reward calculations.

## Persistence and scale

The current route uses an in-memory store as the first executable vertical
slice. Before production rewards are enabled, move encounters, work records,
integrity snapshots, inventories, and replay-protection IDs to PostgreSQL in a
transaction. Sign encounter envelopes, add idempotency keys, rate limits, and a
server simulation/replay worker. Treasury distribution should run as an audited
batch whose inputs are immutable verified-work records.

## Compatibility boundary

The existing CGRD contracts remain optional. The game must be complete with no
wallet or marketplace. If external ownership is enabled later, an adapter may
attach cosmetics, animations, sound packs, auras, effects, or weapon
expressions through Assist Tokens. It may never overwrite a specimen genome.
