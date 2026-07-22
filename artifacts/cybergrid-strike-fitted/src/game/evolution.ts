/**
 * Visual Refinement Evolution
 *
 * Each virus integer n (1–255) carries a refinement level that accumulates
 * as viruses with that value successfully land hits on the player or walk
 * off the edge of the board.
 *
 * The refinement level drives two things:
 *   1. VMES rendering detail — passed to drawVirus so the same morphological
 *      template renders progressively more elaborate as the lineage matures.
 *   2. Spawn weight — refined lineages are more likely to be selected for the
 *      next spawn, so the population drifts toward proven forms organically.
 *
 * Row bias accumulates from historical escape data so viruses gradually favour
 * the lanes they have escaped through most.
 *
 * There is no genetic algorithm, no fitness function, no trait vector.
 * The system is deliberately simple: success → more presence → more detail.
 */

// ═══════════════════════════════════════════════════════════════════════════════
// § 1  State
// ═══════════════════════════════════════════════════════════════════════════════

export interface EvolutionState {
  /**
   * Per-n visual refinement level clamped to [0, 1].
   * Index 1–255 (index 0 unused).
   * Grows as viruses with that integer successfully damage the player or escape.
   * Drives both spawn weight and rendering detail in drawVirus().
   */
  refinement: Float32Array; // length 256

  /**
   * How many times each row has produced a successful virus (hit or edge escape).
   * Used to gradually bias spawns toward lanes that have worked.
   */
  rowEscapes: [number, number, number];

  /** Total successful escape events across all rows (denominator for row bias). */
  totalEscapes: number;
}

/** Create a fresh evolution state for a new game session. */
export function createEvolutionState(): EvolutionState {
  return {
    refinement:   new Float32Array(256),
    rowEscapes:   [0, 0, 0],
    totalEscapes: 0,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// § 2  Event recording
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * A virus dealt damage to the player — maximum refinement gain.
 * This is the primary signal: the lineage proved it can reach the player.
 */
export function recordDamage(
  state: EvolutionState,
  n:     number,
  row:   number,
): void {
  state.refinement[n]   = Math.min(1, state.refinement[n] + 0.18);
  state.rowEscapes[row]++;
  state.totalEscapes++;
}

/**
 * A virus walked off the left edge without hitting the player.
 * Partial refinement gain — the lineage survived but didn't land.
 */
export function recordEdgeEscape(
  state: EvolutionState,
  n:     number,
  row:   number,
): void {
  state.refinement[n]   = Math.min(1, state.refinement[n] + 0.04);
  state.rowEscapes[row]++;
  state.totalEscapes++;
}

// ═══════════════════════════════════════════════════════════════════════════════
// § 3  Sampling
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Sample a virus integer biased toward lineages with higher refinement.
 *
 * Spawn weight = 1 + 4 × refinement[n]
 *   → Unrefined forms:  weight 1.0  (baseline probability)
 *   → Fully refined:    weight 5.0  (5× more likely than a fresh form)
 *
 * Early game all weights are 1 — pure uniform sampling.
 * As successful forms accumulate refinement they crowd out naïve variants.
 */
export function sampleVirusValue(state: EvolutionState): number {
  let total = 0;
  for (let i = 1; i <= 255; i++) total += 1 + 4 * state.refinement[i];
  let r = Math.random() * total;
  for (let i = 1; i <= 255; i++) {
    r -= 1 + 4 * state.refinement[i];
    if (r <= 0) return i;
  }
  return 255;
}

/**
 * Sample a spawn row from the evolved row bias.
 *
 * Before 5 escape events: pure uniform (equal chance across rows).
 * Afterwards: 25% uniform floor + 75% historical escape distribution.
 * This means a row with no escapes keeps a 25/3 ≈ 8% baseline chance.
 */
export function sampleSpawnRow(state: EvolutionState): number {
  const { rowEscapes, totalEscapes } = state;
  if (totalEscapes < 5) return Math.floor(Math.random() * 3);
  const uniform = 1 / 3;
  const bias = [
    0.25 * uniform + 0.75 * rowEscapes[0] / totalEscapes,
    0.25 * uniform + 0.75 * rowEscapes[1] / totalEscapes,
    0.25 * uniform + 0.75 * rowEscapes[2] / totalEscapes,
  ];
  // bias entries sum to ~1 but floating point may drift; normalise inline
  let r = Math.random() * (bias[0] + bias[1] + bias[2]);
  r -= bias[0]; if (r <= 0) return 0;
  r -= bias[1]; if (r <= 0) return 1;
  return 2;
}

/** Return the current refinement level [0, 1] for a specific virus integer. */
export function getRefinement(state: EvolutionState, n: number): number {
  return state.refinement[n];
}
