/**
 * Virus Adaptive Evolution System
 *
 * Each wave, the virus population undergoes selection, mutation, recombination,
 * and counter-adaptation based on player behavior. The result is a weighted
 * probability distribution over virus integers (1–255) that biases future
 * spawns toward phenotypes that performed well against the current player style.
 *
 * Population formula (per wave):
 *   Next = Selection(Previous) + Mutation + Recombination + CounterAdaptation + DifficultyPressure
 *
 * Morphology connection:
 *   Trait vectors are extracted directly from the VMES integer (n) via the same
 *   deterministic functions used for rendering. A virus's appearance therefore
 *   reflects its functional composition — no separate trait encoding is needed.
 */

import {
  getVirusModelProfile,
  getVirusLobes,
  getVirusClass,
  type VirusClass,
} from './virus-morphology';

// ═══════════════════════════════════════════════════════════════════════════════
// § 1  Trait model
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Continuous functional trait vector extracted from a virus integer n.
 * All values are in [0, 1]. The same n always produces the same vector —
 * no RNG, fully deterministic via VMES morphology functions.
 *
 * Visual connection (VMES → trait):
 *   armorLevel       → armor thickness / plate overlays
 *   structureLevel   → rigid geometry vs amorphous form
 *   energyLevel      → speed / metabolic rate
 *   organicLevel     → regeneration / redundant structures
 *   mechanicalLevel  → mechanical resilience
 *   symmetryLevel    → maneuverability (symmetric = more evasive)
 *   lobes (3–8)      → sensory range / detection radius
 *   popcount (0–8)   → bit density → surface density / mass
 *   class            → morphological rarity / complexity tier
 */
export interface VirusTrait {
  speed: number;      // tendency toward fast movement
  armor: number;      // structural resilience / effective HP weight
  sensory: number;    // detection radius / lobe complexity
  organic: number;    // regenerative / biological redundancy
  evasion: number;    // maneuverability / avoidance
  aggression: number; // offensive pressure tendency
  complexity: number; // class-based rarity (prime=1, even-composite=0.3)
}

/** Count set bits in the 8-bit representation of n */
function countBits(n: number): number {
  let c = 0;
  let v = n & 0xff;
  while (v) { c += v & 1; v >>>= 1; }
  return c;
}

/** Extract a deterministic trait vector from a virus integer 1–255. */
export function extractTraits(n: number): VirusTrait {
  const p     = getVirusModelProfile(n);
  const lobes = getVirusLobes(n);        // 3–8
  const pop   = countBits(n);             // 0–8
  const cls   = getVirusClass(n);

  // Speed: high energy + mechanical + lobe count
  const speed = p.energyLevel * 0.40 + p.mechanicalLevel * 0.30 + (lobes - 3) / 5 * 0.30;

  // Armor: armor level + structural rigidity + bit density (mass)
  const armor = p.armorLevel * 0.45 + p.structureLevel * 0.35 + pop / 8 * 0.20;

  // Sensory: directly from lobe count
  const sensory = (lobes - 3) / 5;

  // Organic: regeneration / biological redundancy
  const organic = p.organicLevel;

  // Evasion: amorphous (low structure) + high symmetry = more agile
  const evasion = (1 - p.structureLevel) * 0.50 + p.symmetryLevel * 0.50;

  // Aggression: energy + bit density
  const aggression = p.energyLevel * 0.50 + pop / 8 * 0.50;

  // Complexity: morphological rarity tier
  const complexity =
    cls === 'prime'          ? 1.0 :
    cls === 'power-of-two'   ? 0.8 :
    cls === 'perfect-square' ? 0.7 :
    cls === 'odd-composite'  ? 0.5 : 0.3;

  return { speed, armor, sensory, organic, evasion, aggression, complexity };
}

// ═══════════════════════════════════════════════════════════════════════════════
// § 2  Population state
// ═══════════════════════════════════════════════════════════════════════════════

/** Rolling aggregate of which traits are "winning" across the population. */
interface TraitFitness {
  speed:      number;
  armor:      number;
  sensory:    number;
  organic:    number;
  evasion:    number;
  aggression: number;
}

/** Tracks player combat patterns across the entire session. */
export interface PlayerProfile {
  /** How many game-frames the player spent on each row (0/1/2). */
  rowCounts: [number, number, number];
  /** Cumulative ability uses by id. */
  abilityCounts: Record<string, number>;
  /** Raw bullet-fired count. */
  bulletsFired: number;
  /** Bullets that connected with a virus. */
  bulletsHit: number;
  /** Sum of kill times (seconds from spawn → death). */
  totalKillTime: number;
  killCount: number;
}

/** Per-virus outcome recorded during a wave. */
interface KillEntry {
  n:            number;
  row:          number;
  survivalTime: number; // seconds alive
}

/** Virus that reached the left edge (escaped or hit player). */
interface EscapeEntry {
  n:            number;
  row:          number;
  survivalTime: number;
  dealtDamage:  boolean; // true = hit player; false = walked off edge
}

/**
 * Spawn archetype — what ecological role a given spawn fills.
 * Visible in the console for debugging; not surfaced to the player directly.
 */
export type EnemyArchetype =
  | 'dominant'      // top-fitness phenotype
  | 'specialist'    // high-fitness with niche trait emphasis
  | 'generalist'    // near-uniform sample, moderate stats
  | 'experimental'  // single-bit mutation of a successful parent
  | 'ancestral';    // drawn from simpler (low-n) phenotypes

/** What the spawner needs to know for each new enemy. */
export interface SpawnSpec {
  value:        number;         // 1–255 virus integer
  speedMod:     number;         // multiplier on base wave speed  (≥1.0)
  hpBonusChance: number;        // extra probability added to the 2-HP roll (0–0.5)
  preferredRow: number;         // 0/1/2 — row selected by evolved distribution
  archetype:    EnemyArchetype;
}

/** Full mutable evolution state — one instance per game session. */
export interface EvolutionState {
  /** Spawn probability weights, index 1–255. Higher = more likely to be selected. */
  weights: Float32Array; // length 256, index 0 always 0

  /** Rolling per-n fitness accumulator. Positive = recently successful. */
  fitness: Float32Array; // length 256, index 0 always 0

  /** Smoothed aggregate of which trait profiles produce successful viruses. */
  traitFitness: TraitFitness;

  /** Player combat history (cumulates across waves). */
  playerProfile: PlayerProfile;

  /** Row-preference probability for next-wave spawning [row0, row1, row2]. */
  rowBias: [number, number, number];

  /** Current-wave kill buffer — cleared each wave. */
  waveKills: KillEntry[];

  /** Current-wave escape buffer — cleared each wave. */
  waveEscapes: EscapeEntry[];

  /**
   * Population-level evolved stat pressures.
   * Grow gradually over waves; applied as modifiers to ALL spawned enemies.
   *   speedPressure: 0–1 → up to +35% speed bonus
   *   armorPressure: 0–1 → up to +50% extra HP-roll chance
   */
  speedPressure: number;
  armorPressure: number;

  /** How many wave-transitions have been processed (used for ramp-up curves). */
  wavesSeen: number;

  /**
   * BIOLOCK: while > 0, kills are not recorded into fitness scores.
   * Decrements by 1 on each recordKill() call.
   */
  biolockCount: number;

  /**
   * ANCESTRAL CALL: while > 0, sampleNextEnemy() forces ancestral archetype.
   * Decrements by 1 on each spawn.
   */
  forcedAncestralCount: number;
}

/** Create a fresh evolution state for a new game session. */
export function createEvolutionState(): EvolutionState {
  const weights = new Float32Array(256);
  const fitness = new Float32Array(256);
  // Start from uniform distribution — all n values equally likely
  for (let i = 1; i <= 255; i++) weights[i] = 1.0;
  return {
    weights,
    fitness,
    traitFitness: { speed: 0, armor: 0, sensory: 0, organic: 0, evasion: 0, aggression: 0 },
    playerProfile: {
      rowCounts: [0, 0, 0],
      abilityCounts: {},
      bulletsFired: 0,
      bulletsHit: 0,
      totalKillTime: 0,
      killCount: 0,
    },
    rowBias: [1 / 3, 1 / 3, 1 / 3],
    waveKills: [],
    waveEscapes: [],
    speedPressure: 0,
    armorPressure: 0,
    wavesSeen: 0,
    biolockCount: 0,
    forcedAncestralCount: 0,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// § 3  Event recording — called each frame / each event from Game.tsx
// ═══════════════════════════════════════════════════════════════════════════════

/** Record that a virus was destroyed by the player. */
export function recordKill(
  state: EvolutionState,
  n: number,
  row: number,
  survivalTime: number,
): void {
  // BIOLOCK: skip fitness recording but still track kill time for averages
  if (state.biolockCount > 0) {
    state.biolockCount--;
    // Still track aggregate timing so avg kill time remains accurate
    state.playerProfile.totalKillTime += survivalTime;
    state.playerProfile.killCount++;
    return;
  }
  state.waveKills.push({ n, row, survivalTime });
  state.playerProfile.totalKillTime += survivalTime;
  state.playerProfile.killCount++;
}

/**
 * Record that a virus escaped (hit player or walked off the left edge).
 * @param dealtDamage true = the virus dealt HP damage to the player
 */
export function recordEscape(
  state: EvolutionState,
  n: number,
  row: number,
  survivalTime: number,
  dealtDamage: boolean,
): void {
  state.waveEscapes.push({ n, row, survivalTime, dealtDamage });
}

/** Record that the player used an ability card. */
export function recordAbilityUse(state: EvolutionState, abilityId: string): void {
  state.playerProfile.abilityCounts[abilityId] =
    (state.playerProfile.abilityCounts[abilityId] ?? 0) + 1;
}

/** Record the player's current row (call once per update frame while playing). */
export function recordPlayerRow(state: EvolutionState, row: number): void {
  state.playerProfile.rowCounts[row]++;
}

/** Record a bullet being fired. */
export function recordBulletFired(state: EvolutionState): void {
  state.playerProfile.bulletsFired++;
}

/** Record a bullet–virus hit. */
export function recordBulletHit(state: EvolutionState): void {
  state.playerProfile.bulletsHit++;
}

// ═══════════════════════════════════════════════════════════════════════════════
// § 4  Core evolution step
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Run one evolution step at the end of a wave.
 *
 * Steps:
 *   1.  Evaluate per-phenotype performance from waveKills + waveEscapes
 *   2.  Update rolling fitness scores (with decay)
 *   3.  Derive aggregate trait fitness
 *   4.  Selection — bias weights toward high-fitness phenotypes
 *   5.  Counter-adaptation — detect player patterns, boost resistant traits
 *   6.  Mutation — exploration blur
 *   7.  Recombination — bitwise offspring of top parents
 *   8.  Anti-stagnation — diversity floor + occasional disruptive mutation
 *   9.  Normalize weights
 *  10.  Update population-level stat pressures
 *  11.  Update row spawn bias
 *  12.  Clear wave buffers
 */
export function evolvePopulation(state: EvolutionState, _currentWave: number): void {
  const { weights, fitness, waveKills, waveEscapes, playerProfile } = state;

  // ── 1. Score individual phenotype performance ────────────────────────────

  // Average kill time this wave (lower = player is efficiently handling viruses)
  const avgKillTime = playerProfile.killCount > 0
    ? playerProfile.totalKillTime / playerProfile.killCount
    : 2.5;

  for (const k of waveKills) {
    // Viruses that survived longer than average were harder to kill → partial success
    const ratio   = Math.min(4, k.survivalTime / Math.max(0.3, avgKillTime));
    const gain    = (ratio - 0.9) * 0.55; // positive if ≥ avg, negative if quick kill
    fitness[k.n]  = fitness[k.n] * 0.88 + Math.max(-0.6, Math.min(1.2, gain));
  }

  for (const esc of waveEscapes) {
    const baseGain   = esc.dealtDamage ? 1.8 : 1.0; // hitting player = extra reward
    fitness[esc.n]   = fitness[esc.n] * 0.88 + baseGain;
  }

  // Decay all fitness scores each wave — prevents stale data dominating
  const decayRate = 0.72;
  for (let i = 1; i <= 255; i++) {
    fitness[i] *= decayRate;
    // Clamp to prevent runaway accumulation
    if (fitness[i] > 8)  fitness[i] = 8;
    if (fitness[i] < -3) fitness[i] = -3;
  }

  // ── 2. Aggregate trait fitness ──────────────────────────────────────────

  let wSum = 0;
  const tf: TraitFitness = { speed: 0, armor: 0, sensory: 0, organic: 0, evasion: 0, aggression: 0 };
  for (let i = 1; i <= 255; i++) {
    if (fitness[i] > 0) {
      const t = extractTraits(i);
      tf.speed      += t.speed      * fitness[i];
      tf.armor      += t.armor      * fitness[i];
      tf.sensory    += t.sensory    * fitness[i];
      tf.organic    += t.organic    * fitness[i];
      tf.evasion    += t.evasion    * fitness[i];
      tf.aggression += t.aggression * fitness[i];
      wSum += fitness[i];
    }
  }
  if (wSum > 0) {
    const inv = 1 / wSum;
    tf.speed      *= inv;
    tf.armor      *= inv;
    tf.sensory    *= inv;
    tf.organic    *= inv;
    tf.evasion    *= inv;
    tf.aggression *= inv;
  }

  // Smooth with EMA (α = 0.30, so history has ~3-wave half-life)
  const α = 0.30;
  for (const k of (Object.keys(tf) as (keyof TraitFitness)[])) {
    state.traitFitness[k] = state.traitFitness[k] * (1 - α) + tf[k] * α;
  }

  // ── 3. Selection ──────────────────────────────────────────────────────────

  // Selection strength ramps up over waves (early waves = weak selection = more exploration)
  const waveScale       = Math.min(1, state.wavesSeen / 10);
  const selStrength     = 0.15 + waveScale * 0.25; // 0.15 → 0.40

  for (let i = 1; i <= 255; i++) {
    if (fitness[i] > 0) {
      weights[i] += fitness[i] * selStrength;
    } else if (fitness[i] < 0) {
      // Penalize failing phenotypes, but never eliminate entirely
      weights[i] = Math.max(0.05, weights[i] + fitness[i] * selStrength * 0.5);
    }
  }

  // ── 4. Counter-adaptation ────────────────────────────────────────────────

  applyCounterAdaptation(state, weights, waveScale);

  // ── 5. Mutation ───────────────────────────────────────────────────────────

  // Mutation rate decreases as population converges over waves
  const mutRate  = Math.max(0.06, 0.22 - state.wavesSeen * 0.012);
  const mutated  = weights.slice(); // copy
  for (let i = 1; i <= 255; i++) {
    if (Math.random() < mutRate) {
      const spread     = weights[i] * 0.18;
      mutated[i]      -= spread;
      const dir        = Math.random() < 0.5 ? -1 : 1;
      const target     = i + dir;
      if (target >= 1 && target <= 255) mutated[target] += spread;
    }
  }
  for (let i = 1; i <= 255; i++) weights[i] = Math.max(0.02, mutated[i]);

  // ── 6. Recombination ──────────────────────────────────────────────────────

  // Number of crossover offspring grows with wave count (0 early, up to 6 late)
  const recombCount = Math.min(6, Math.floor(state.wavesSeen / 2));

  if (recombCount > 0) {
    // Select top-8 parents by fitness
    const parents = Array.from({ length: 255 }, (_, i) => i + 1)
      .sort((a, b) => fitness[b] - fitness[a])
      .slice(0, 8);

    for (let r = 0; r < recombCount; r++) {
      const pA     = parents[Math.floor(Math.random() * Math.min(4, parents.length))];
      const pB     = parents[Math.floor(Math.random() * Math.min(8, parents.length))];
      // Single-point bit crossover
      const cross  = 1 + Math.floor(Math.random() * 6);
      const mask   = (1 << cross) - 1;
      const child  = ((pA & mask) | (pB & ~mask)) & 0xff;
      if (child >= 1 && child <= 255) {
        weights[child] += 0.35 * (1 + waveScale * 0.5);
      }
    }
  }

  // ── 7. Anti-stagnation ────────────────────────────────────────────────────

  // Enforce diversity floor: no weight below 3% of current maximum
  let maxW = 0;
  for (let i = 1; i <= 255; i++) maxW = Math.max(maxW, weights[i]);
  const floor = maxW * 0.03;
  for (let i = 1; i <= 255; i++) {
    if (weights[i] < floor) weights[i] = floor;
  }

  // Occasional disruptive mutation: inject weight into a random cluster
  // (15% chance per wave; keeps evolutionary search space open)
  if (Math.random() < 0.15) {
    const pivot = 1 + Math.floor(Math.random() * 255);
    for (let i = Math.max(1, pivot - 6); i <= Math.min(255, pivot + 6); i++) {
      weights[i] *= 1.35;
    }
  }

  // ── 8. Normalize ──────────────────────────────────────────────────────────

  // Keep average weight = 1 (so sampleNextEnemy complexity is stable)
  let total = 0;
  for (let i = 1; i <= 255; i++) total += weights[i];
  const norm = 255 / total;
  for (let i = 1; i <= 255; i++) weights[i] *= norm;

  // ── 9. Update population-level stat pressures ────────────────────────────

  // These grow slowly over the session and add global stat bonuses to ALL spawns
  const pα = 0.20;
  state.speedPressure = state.speedPressure * (1 - pα) + state.traitFitness.speed * pα;
  state.armorPressure = state.armorPressure * (1 - pα) + state.traitFitness.armor * pα;

  // ── 10. Update row spawn bias ─────────────────────────────────────────────

  updateRowBias(state, waveScale);

  // ── 11. Clear wave buffers ────────────────────────────────────────────────

  state.waveKills   = [];
  state.waveEscapes = [];
  state.wavesSeen++;
}

// ═══════════════════════════════════════════════════════════════════════════════
// § 5  Counter-adaptation
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Detect persistent player strategies and push weight toward resistant phenotypes.
 * Adaptation is gradual: waveScale < 0.25 produces negligible effect.
 */
function applyCounterAdaptation(
  state: EvolutionState,
  weights: Float32Array,
  waveScale: number,
): void {
  if (waveScale < 0.10) return; // no counter-adaptation in very first waves

  const { abilityCounts, bulletsFired, bulletsHit, rowCounts } = state.playerProfile;
  const totalAbilities = Object.values(abilityCounts).reduce((s, c) => s + c, 0);
  if (totalAbilities < 4) return;

  const boost = 0.20 * waveScale;

  // ── Detect ability usage patterns ─────────────────────────────────────────

  const ratio = (ids: string[]): number =>
    ids.reduce((s, id) => s + (abilityCounts[id] ?? 0), 0) / Math.max(1, totalAbilities);

  // Slowing abilities → favor high-speed viruses
  const slowRatio    = ratio(['time', 'freeze', 'blizzard', 'pulse', 'magnet']);

  // AoE / burst abilities → favor high-armor / high-HP viruses
  const aoeRatio     = ratio(['bomb', 'barrage', 'nuke', 'megabomb', 'surge', 'mirror', 'emp', 'shotgun']);

  // Piercing / ranged spam → favor evasive viruses
  const pierceRatio  = ratio(['pierce', 'voltage', 'snipe', 'barrage', 'surge']);

  // Healing ability usage → favor aggressive/fast viruses (punish passive play)
  const healRatio    = ratio(['heal', 'regen', 'drain']);

  // Crowd-control abilities → favor high-sensory (multi-lobe) viruses
  const ccRatio      = ratio(['gravity', 'rowshuffle', 'scramble', 'warpback', 'backdash']);

  // ── Boost phenotypes that counter each detected strategy ──────────────────

  for (let i = 1; i <= 255; i++) {
    const t = extractTraits(i);
    let adaptation = 0;

    if (slowRatio > 0.15)   adaptation += t.speed      * slowRatio   * boost * 2.5;
    if (aoeRatio > 0.12)    adaptation += t.armor      * aoeRatio    * boost * 2.5;
    if (pierceRatio > 0.12) adaptation += t.evasion    * pierceRatio * boost * 2.0;
    if (healRatio > 0.12)   adaptation += t.aggression * healRatio   * boost * 2.0;
    if (ccRatio > 0.10)     adaptation += t.sensory    * ccRatio     * boost * 1.5;

    weights[i] += adaptation;
  }

  // ── Accuracy pressure ──────────────────────────────────────────────────────

  // Very high bullet accuracy → player has good aim → favor evasive viruses
  if (bulletsFired > 30) {
    const accuracy = bulletsHit / bulletsFired;
    if (accuracy > 0.60) {
      const evasionBoost = (accuracy - 0.60) * waveScale * boost * 3;
      for (let i = 1; i <= 255; i++) {
        const t = extractTraits(i);
        weights[i] += t.evasion * evasionBoost;
      }
    }
  }

  // ── Row concentration ──────────────────────────────────────────────────────

  // Player stays on one row → favor aggressive (sensory/energy) viruses
  const totalRowFrames = rowCounts[0] + rowCounts[1] + rowCounts[2];
  if (totalRowFrames > 100) {
    const maxRowRatio   = Math.max(...rowCounts) / totalRowFrames;
    const concentration = Math.max(0, maxRowRatio - 1 / 3); // 0 = uniform, 0.67 = one row only
    if (concentration > 0.10) {
      const aggroBoost = concentration * waveScale * boost * 2.5;
      for (let i = 1; i <= 255; i++) {
        const t = extractTraits(i);
        weights[i] += t.aggression * aggroBoost;
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// § 6  Row spawn bias
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Update the row spawn probability based on:
 *  - Which rows produced escaping (successful) viruses this wave
 *  - The player's row preference (viruses learn to target the player's lane)
 */
function updateRowBias(state: EvolutionState, waveScale: number): void {
  const bias = state.rowBias;

  // Reward rows that produced escapes
  const escapeRowCounts: [number, number, number] = [0, 0, 0];
  for (const esc of state.waveEscapes) {
    escapeRowCounts[esc.row] += esc.dealtDamage ? 2 : 1;
  }
  const escTotal = escapeRowCounts[0] + escapeRowCounts[1] + escapeRowCounts[2];
  if (escTotal > 0) {
    for (let r = 0; r < 3; r++) {
      bias[r] = bias[r] * 0.80 + (escapeRowCounts[r] / escTotal) * 0.20;
    }
  }

  // Gradually mirror player's row preference (counter-adaptation: find the player)
  const { rowCounts } = state.playerProfile;
  const totalFrames = rowCounts[0] + rowCounts[1] + rowCounts[2];
  if (totalFrames > 200 && waveScale > 0.2) {
    const mirror = 0.10 * waveScale; // max 10% pull toward player's row per wave
    for (let r = 0; r < 3; r++) {
      const playerPref = rowCounts[r] / totalFrames;
      bias[r] = bias[r] * (1 - mirror) + playerPref * mirror;
    }
  }

  // Normalize
  const total = bias[0] + bias[1] + bias[2];
  if (total > 0) {
    bias[0] /= total;
    bias[1] /= total;
    bias[2] /= total;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// § 7  Sampling
// ═══════════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════════
// § 7a  Ability-triggered evolution interventions (exported)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * MEMORY WIPE — collapse accumulated evolutionary pressures by 65%.
 * Resets row bias to uniform. Viruses lose most of their learned adaptations.
 */
export function resetEvolutionaryPressures(state: EvolutionState): void {
  state.speedPressure   *= 0.35;
  state.armorPressure   *= 0.35;
  // Soften trait fitness memory
  for (const k of Object.keys(state.traitFitness) as (keyof TraitFitness)[]) {
    state.traitFitness[k] *= 0.40;
  }
  // Decay fitness scores (not zero — preserves phenotype identity, just weakens it)
  for (let i = 1; i <= 255; i++) state.fitness[i] *= 0.45;
  // Reset row-targeting adaptation to uniform
  state.rowBias = [1 / 3, 1 / 3, 1 / 3];
}

/**
 * DISRUPT EVOLUTION — inject 10 random disruptive cluster mutations into
 * the population weights, forcing erratic spawns next wave.
 */
export function injectEvolutionaryNoise(state: EvolutionState): void {
  const { weights } = state;
  for (let d = 0; d < 10; d++) {
    const pivot = 1 + Math.floor(Math.random() * 255);
    for (let i = Math.max(1, pivot - 10); i <= Math.min(255, pivot + 10); i++) {
      weights[i] *= 1.45;
    }
  }
  // Renormalize
  let total = 0;
  for (let i = 1; i <= 255; i++) total += weights[i];
  const norm = 255 / total;
  for (let i = 1; i <= 255; i++) weights[i] *= norm;
}

/**
 * PRESSURE SHIFT — swap speed and armor evolutionary pressures.
 * Viruses that evolved to be fast suddenly spawn with armor traits and vice versa.
 */
export function swapEvolutionaryPressures(state: EvolutionState): void {
  [state.speedPressure, state.armorPressure] = [state.armorPressure, state.speedPressure];
  [state.traitFitness.speed, state.traitFitness.armor] =
    [state.traitFitness.armor, state.traitFitness.speed];
}

/**
 * EXPLOIT WEAKNESS — return the virus class currently dominating the
 * population (by summed spawn weight). Used to set the exploit target.
 */
export function getDominantClass(state: EvolutionState): VirusClass {
  const totals: Record<VirusClass, number> = {
    'prime': 0, 'power-of-two': 0, 'perfect-square': 0,
    'even-composite': 0, 'odd-composite': 0,
  };
  for (let i = 1; i <= 255; i++) {
    totals[getVirusClass(i)] += state.weights[i];
  }
  let best: VirusClass = 'odd-composite';
  let bestVal = -Infinity;
  for (const [cls, val] of Object.entries(totals)) {
    if (val > bestVal) { bestVal = val; best = cls as VirusClass; }
  }
  return best;
}

/** Weighted random sample from the weights array. */
function weightedSample(weights: Float32Array, rand: () => number): number {
  let total = 0;
  for (let i = 1; i <= 255; i++) total += weights[i];
  let r = rand() * total;
  for (let i = 1; i <= 255; i++) {
    r -= weights[i];
    if (r <= 0) return i;
  }
  return 255;
}

/** Sample a row index from the evolved row bias distribution. */
function sampleRow(bias: [number, number, number], rand: () => number): number {
  let r = rand();
  r -= bias[0]; if (r <= 0) return 0;
  r -= bias[1]; if (r <= 0) return 1;
  return 2;
}

/**
 * Sample the next enemy spawn spec from the evolved population.
 *
 * Produces a mix of archetypes per the spec:
 *   40% dominant   — best-performing phenotypes
 *   20% specialist — niche high-fitness variants
 *   15% generalist — near-uniform sample
 *   15% experimental — single-bit mutation of a top parent
 *   10% ancestral  — simple early-form viruses (n ≤ 80)
 *
 * @param rand  Replaceable RNG (default: Math.random) — used for determinism in tests.
 */
export function sampleNextEnemy(
  state: EvolutionState,
  _wave: number,
  rand: () => number = Math.random,
): SpawnSpec {
  const { weights, fitness } = state;
  const waveScale = Math.min(1, state.wavesSeen / 10);

  // ── ANCESTRAL CALL override ────────────────────────────────────────────────
  if (state.forcedAncestralCount > 0) {
    state.forcedAncestralCount--;
    const value = 1 + Math.floor(rand() * 80);
    const preferredRow = sampleRow(state.rowBias, rand);
    // Ancestral forms are slower and weaker (no evolved pressure applied)
    return { value, speedMod: 1.0, hpBonusChance: 0, preferredRow, archetype: 'ancestral' };
  }

  // ── Choose archetype ───────────────────────────────────────────────────────
  const roll = rand();
  let archetype: EnemyArchetype;
  if      (roll < 0.40) archetype = 'dominant';
  else if (roll < 0.60) archetype = 'specialist';
  else if (roll < 0.75) archetype = 'generalist';
  else if (roll < 0.90) archetype = 'experimental';
  else                  archetype = 'ancestral';

  // ── Sample virus integer ───────────────────────────────────────────────────
  let value: number;

  switch (archetype) {
    case 'dominant':
    case 'specialist': {
      // Fully evolved distribution
      value = weightedSample(weights, rand);
      break;
    }
    case 'generalist': {
      // Blend 50/50 evolved + uniform (stays diverse)
      const blended = new Float32Array(256);
      for (let i = 1; i <= 255; i++) blended[i] = 0.5 + weights[i] * 0.5;
      value = weightedSample(blended, rand);
      break;
    }
    case 'experimental': {
      // Mutate a top-3 parent by flipping one random bit
      const top = Array.from({ length: 255 }, (_, i) => i + 1)
        .sort((a, b) => fitness[b] - fitness[a])
        .slice(0, 6);
      const parent    = top[Math.floor(rand() * top.length)] ?? 1;
      const bitToFlip = 1 << Math.floor(rand() * 8);
      value = Math.max(1, Math.min(255, (parent ^ bitToFlip)));
      break;
    }
    case 'ancestral': {
      // Simplest morphologies (n ≤ 80); uniform within that range
      value = 1 + Math.floor(rand() * 80);
      break;
    }
  }

  // ── Stat modifiers ────────────────────────────────────────────────────────

  // speedMod: the evolved population's speed pressure boosts ALL enemy speeds
  const speedMod = 1 + state.speedPressure * 0.35 * waveScale;

  // hpBonusChance: extra probability added to the 2-HP spawn roll
  const hpBonusChance = state.armorPressure * 0.5 * waveScale;

  // ── Row selection ─────────────────────────────────────────────────────────

  const preferredRow = sampleRow(state.rowBias, rand);

  return { value, speedMod, hpBonusChance, preferredRow, archetype };
}
