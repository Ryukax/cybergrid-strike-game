import {
  CAMPAIGN_ACTS,
  ENCOUNTERS_PER_OPERATION,
  OPERATIONS_PER_ACT,
} from './campaign-director.ts';

export type MilestoneEvolutionTrack = 'score' | 'wave' | 'integrity';

export interface MilestoneEvolution {
  id: string;
  name: string;
  desc: string;
  maxLevel: number;
  track: MilestoneEvolutionTrack;
  /** Zero-based campaign act in which this evolution first joins the offer pool. */
  unlockAct: number;
  /** Long-form lines are designed to remain useful throughout an entire province. */
  longForm?: boolean;
}

export interface MilestoneOfferContext {
  /** Monotonic campaign depth. Callers may include an Action Window route farther than wave. */
  worldDepth?: number;
}

export interface MilestoneProjectileContext {
  injured: boolean;
  evolved: boolean;
  big: boolean;
  piercing: boolean;
}

export interface MilestoneWorldStepReward {
  handChargeFraction: number;
  piercingProgress: number;
  overclockSeconds: number;
  shieldProgress: number;
  nodeRepair: number;
  sectorRepair: number;
  globalRepair: number;
}

export interface MilestoneWorldStepDelta {
  targetSteps: number;
  newSteps: number;
}

export interface MilestonePressureRecovery {
  nodeRepair: number;
  sectorRepair: number;
  globalRepair: number;
}

export interface MilestoneBossEvolutionProfile {
  mutationCount: number;
  fusionLevel: number;
}

export const MILESTONE_FIRST_WAVE = 5;
export const MILESTONE_INTERVAL_WAVES = 5;
export const LONG_FORM_MILESTONE_LEVELS = 24;
export const CAMPAIGN_WAVES_PER_ACT = ENCOUNTERS_PER_OPERATION * OPERATIONS_PER_ACT;

const legacy = (
  evolution: Omit<MilestoneEvolution, 'unlockAct'>,
): MilestoneEvolution => ({ ...evolution, unlockAct: 0 });

const horizon = (
  evolution: Omit<MilestoneEvolution, 'maxLevel' | 'longForm'>,
): MilestoneEvolution => ({
  ...evolution,
  maxLevel: LONG_FORM_MILESTONE_LEVELS,
  longForm: true,
});

/**
 * Run-scoped Milestone Evolutions.
 *
 * The original fifteen short-build choices remain intact. Eighteen horizon
 * lines add 432 ranks, distributed as one SCORE, WAVE and INTEGRITY line per
 * campaign act. Together the catalog supplies 158 ranks in every track: more
 * than the 144 five-wave awards available across the authored 720-wave story.
 */
export const MILESTONE_EVOLUTIONS: readonly MilestoneEvolution[] = [
  legacy({ id: 'capacitor', name: 'CAPACITOR', desc: 'Ability hands recharge 15% faster per level.', maxLevel: 3, track: 'wave' }),
  legacy({ id: 'rapidBuster', name: 'RAPID BUSTER', desc: 'Player fires 10% faster per level.', maxLevel: 3, track: 'score' }),
  legacy({ id: 'phaseRounds', name: 'PHASE ROUNDS', desc: 'Every fifth shot pierces; higher levels trigger sooner.', maxLevel: 3, track: 'score' }),
  legacy({ id: 'denseCharge', name: 'DENSE CHARGE', desc: 'Every fourth shot gains +1 damage per level.', maxLevel: 3, track: 'score' }),
  legacy({ id: 'repairWeave', name: 'REPAIR WEAVE', desc: 'Restore 2 HP now; pressure recovery restores 1 HP per level.', maxLevel: 2, track: 'integrity' }),
  legacy({ id: 'barrierArray', name: 'BARRIER ARRAY', desc: 'Gain 2 shield charges immediately.', maxLevel: 3, track: 'integrity' }),
  legacy({ id: 'shockVent', name: 'SHOCK VENT', desc: 'Entering critical pressure pushes every enemy backward.', maxLevel: 2, track: 'wave' }),
  legacy({ id: 'hybridHunter', name: 'HYBRID HUNTER', desc: 'Shots deal +1 damage to fused enemies per level.', maxLevel: 2, track: 'score' }),
  legacy({ id: 'vitalCache', name: 'VITAL CACHE', desc: 'Restore 4 player HP immediately.', maxLevel: 3, track: 'integrity' }),
  legacy({ id: 'shieldFoundry', name: 'SHIELD FOUNDRY', desc: 'Forge 4 shield charges immediately.', maxLevel: 3, track: 'integrity' }),
  legacy({ id: 'phaseReserve', name: 'PHASE RESERVE', desc: 'Load 10 guaranteed piercing shots.', maxLevel: 3, track: 'wave' }),
  legacy({ id: 'overclockSeed', name: 'OVERCLOCK SEED', desc: 'Add 8 seconds of accelerated fire control.', maxLevel: 3, track: 'wave' }),
  legacy({
    id: 'meritChain',
    name: 'MERIT CHAIN',
    desc: 'No-breach defeats stack +10 bonus Integrity Work per level, up to five stacks.',
    maxLevel: 3,
    track: 'score',
  }),
  legacy({
    id: 'vanguardCircuit',
    name: 'VANGUARD CIRCUIT',
    desc: 'Every 10 / 8 / 6 defeats advances a bonus wave without fabricating Integrity Work.',
    maxLevel: 3,
    track: 'wave',
  }),
  legacy({
    id: 'integrityLattice',
    name: 'INTEGRITY LATTICE',
    desc: 'System repair gains +20% and breach loss falls 15% per level.',
    maxLevel: 3,
    track: 'integrity',
  }),

  // ACT I · long-run foundations
  horizon({ id: 'kineticIndex', name: 'KINETIC INDEX', desc: 'Player projectile velocity gains 1.5% per rank, up to 36%.', track: 'score', unlockAct: 0 }),
  horizon({ id: 'marchCadence', name: 'MARCH CADENCE', desc: 'Fire cadence and ability-hand recharge gain 0.75% per rank.', track: 'wave', unlockAct: 0 }),
  horizon({ id: 'fieldWeave', name: 'FIELD WEAVE', desc: 'Verified Integrity Work repairs the construct 0.75% more per rank.', track: 'integrity', unlockAct: 0 }),

  // ACT II · the first route network
  horizon({ id: 'resonantBounty', name: 'RESONANT BOUNTY', desc: 'Every verified defeat awards +2 Integrity Work per rank.', track: 'score', unlockAct: 1 }),
  horizon({ id: 'routeCapacitor', name: 'ROUTE CAPACITOR', desc: 'Each traversed world step advances hand charge by 1% per rank.', track: 'wave', unlockAct: 1 }),
  horizon({ id: 'relayAegis', name: 'RELAY AEGIS', desc: 'Each traversed world step repairs node, sector, and global integrity.', track: 'integrity', unlockAct: 1 }),

  // ACT III · pressure and current
  horizon({ id: 'pressureCompiler', name: 'PRESSURE COMPILER', desc: 'Projectiles deal 1% more damage per rank to injured enemies.', track: 'score', unlockAct: 2 }),
  horizon({ id: 'currentReserve', name: 'CURRENT RESERVE', desc: 'World traversal synthesizes piercing ammunition; every rank accelerates production.', track: 'wave', unlockAct: 2 }),
  horizon({ id: 'tidalRecovery', name: 'TIDAL RECOVERY', desc: 'Leaving critical pressure repairs all three construct scopes per rank.', track: 'integrity', unlockAct: 2 }),

  // ACT IV · accumulated knowledge
  horizon({ id: 'archiveTargeting', name: 'ARCHIVE TARGETING', desc: 'Projectiles deal 1% more damage per rank to fused, mutated, or heavy enemies.', track: 'score', unlockAct: 3 }),
  horizon({ id: 'continuityDrive', name: 'CONTINUITY DRIVE', desc: 'Each traversed world step stores 0.1 seconds of Overclock per rank.', track: 'wave', unlockAct: 3 }),
  horizon({ id: 'memoryBulkhead', name: 'MEMORY BULKHEAD', desc: 'System breach severity falls 0.75% per rank, up to 18%.', track: 'integrity', unlockAct: 3 }),

  // ACT V · fabrication at campaign scale
  horizon({ id: 'foundryCaliber', name: 'FOUNDRY CALIBER', desc: 'Big and piercing carriers deal 1% more damage per rank.', track: 'score', unlockAct: 4 }),
  horizon({ id: 'fabricationCycle', name: 'FABRICATION CYCLE', desc: 'Every Vanguard bonus wave fabricates 0.25 seconds of Overclock per rank.', track: 'wave', unlockAct: 4 }),
  horizon({ id: 'forgePlating', name: 'FORGE PLATING', desc: 'World traversal contributes one-eighth shield charge per rank, banked between steps.', track: 'integrity', unlockAct: 4 }),

  // ACT VI · endgame pace without uncapped arithmetic
  horizon({ id: 'sovereignBounty', name: 'SOVEREIGN BOUNTY', desc: 'Verified campaign-Boss hits award 2% more Integrity Work per rank.', track: 'score', unlockAct: 5 }),
  horizon({ id: 'horizonEngine', name: 'HORIZON ENGINE', desc: 'Vanguard defeat progress gains 1/24 of normal pace per rank, up to double.', track: 'wave', unlockAct: 5 }),
  horizon({ id: 'nullLattice', name: 'NULL LATTICE', desc: 'Below 25% node integrity, repair rises and breach loss falls 1% per rank.', track: 'integrity', unlockAct: 5 }),
] as const;

const EVOLUTION_BY_ID = new Map(
  MILESTONE_EVOLUTIONS.map((evolution) => [evolution.id, evolution]),
);

export function getMilestoneEvolution(id: string): MilestoneEvolution | undefined {
  return EVOLUTION_BY_ID.get(id);
}

function stableHash(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function levelSignature(levels: Readonly<Record<string, number>>): string {
  return Object.entries(levels)
    .filter(([, level]) => Number.isFinite(level) && level > 0)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([id, level]) => `${id}:${Math.floor(level)}`)
    .join('|');
}

export function resolveMilestoneWorldAct(worldDepth: number): number {
  const act = Math.floor((Math.max(1, Math.floor(worldDepth)) - 1) / CAMPAIGN_WAVES_PER_ACT);
  return Math.max(0, Math.min(CAMPAIGN_ACTS.length - 1, act));
}

export function milestoneAwardsThroughWave(wave: number): number {
  const bounded = Math.max(0, Math.floor(wave));
  if (bounded < MILESTONE_FIRST_WAVE) return 0;
  return 1 + Math.floor((bounded - MILESTONE_FIRST_WAVE) / MILESTONE_INTERVAL_WAVES);
}

export function milestoneTrackCapacity(track: MilestoneEvolutionTrack): number {
  return MILESTONE_EVOLUTIONS
    .filter((evolution) => evolution.track === track)
    .reduce((total, evolution) => total + evolution.maxLevel, 0);
}

/**
 * Produces a reproducible offer for the same milestone/build/world position.
 * While possible, one SCORE, WAVE and INTEGRITY choice is guaranteed. Future
 * province lines remain locked until traversal reaches their campaign act.
 */
export function chooseMilestoneEvolutionOptions(
  levels: Readonly<Record<string, number>>,
  milestoneOrdinal: number,
  count = 3,
  context: MilestoneOfferContext = {},
): string[] {
  const requested = Math.max(0, Math.floor(count));
  if (requested === 0) return [];

  // The award ordinal controls deterministic rotation; worldDepth controls
  // province access. Route-enabled campaigns may intentionally advance those
  // two clocks at different rates.
  const worldDepth = context.worldDepth ?? milestoneOrdinal;
  const worldAct = resolveMilestoneWorldAct(worldDepth);
  const available = MILESTONE_EVOLUTIONS.filter(
    (evolution) => evolution.unlockAct <= worldAct
      && (levels[evolution.id] ?? 0) < evolution.maxLevel,
  );
  if (available.length === 0) return [];

  const offerSeed = `${Math.max(1, Math.floor(milestoneOrdinal))}|${worldAct}|${levelSignature(levels)}`;
  const ranked = [...available].sort((left, right) => {
    const leftRank = stableHash(`${offerSeed}|${left.id}`);
    const rightRank = stableHash(`${offerSeed}|${right.id}`);
    return leftRank - rightRank || left.id.localeCompare(right.id);
  });

  const result: string[] = [];
  const selected = new Set<string>();
  const tracks: readonly MilestoneEvolutionTrack[] = ['score', 'wave', 'integrity'];
  for (const track of tracks) {
    if (result.length >= requested) break;
    const candidate = ranked.find(
      (evolution) => evolution.track === track && !selected.has(evolution.id),
    );
    if (!candidate) continue;
    selected.add(candidate.id);
    result.push(candidate.id);
  }

  for (const evolution of ranked) {
    if (result.length >= requested) break;
    if (selected.has(evolution.id)) continue;
    selected.add(evolution.id);
    result.push(evolution.id);
  }
  return result;
}

function boundedLevel(levels: Readonly<Record<string, number>>, id: string): number {
  const maximum = getMilestoneEvolution(id)?.maxLevel ?? 0;
  return Math.max(0, Math.min(maximum, Math.floor(levels[id] ?? 0)));
}

export function milestoneProjectileSpeedMultiplier(
  levels: Readonly<Record<string, number>>,
): number {
  return 1 + boundedLevel(levels, 'kineticIndex') * 0.015;
}

export function milestoneFireRateMultiplier(
  levels: Readonly<Record<string, number>>,
): number {
  return 1 + boundedLevel(levels, 'marchCadence') * 0.0075;
}

export function milestoneCardRechargeMultiplier(
  levels: Readonly<Record<string, number>>,
): number {
  return 1 + boundedLevel(levels, 'marchCadence') * 0.0075;
}

export function milestoneProjectileDamageMultiplier(
  levels: Readonly<Record<string, number>>,
  context: MilestoneProjectileContext,
): number {
  let multiplier = 1;
  if (context.injured) multiplier *= 1 + boundedLevel(levels, 'pressureCompiler') * 0.01;
  if (context.evolved) multiplier *= 1 + boundedLevel(levels, 'archiveTargeting') * 0.01;
  if (context.big || context.piercing) multiplier *= 1 + boundedLevel(levels, 'foundryCaliber') * 0.01;
  return Math.min(1.9, multiplier);
}

export function milestoneBossWorkMultiplier(
  levels: Readonly<Record<string, number>>,
): number {
  return 1 + boundedLevel(levels, 'sovereignBounty') * 0.02;
}

export function resolveMilestoneWorldStepReward(
  levels: Readonly<Record<string, number>>,
): MilestoneWorldStepReward {
  const relay = boundedLevel(levels, 'relayAegis');
  return {
    handChargeFraction: Math.min(0.24, boundedLevel(levels, 'routeCapacitor') * 0.01),
    piercingProgress: boundedLevel(levels, 'currentReserve') / 8,
    overclockSeconds: boundedLevel(levels, 'continuityDrive') * 0.1,
    shieldProgress: boundedLevel(levels, 'forgePlating') / 8,
    nodeRepair: relay * 0.15,
    sectorRepair: relay * 0.06,
    globalRepair: relay * 0.02,
  };
}

/**
 * Resolve only newly reached campaign depth. Returning to an earlier segment,
 * revisiting the current frontier, or reconciling the same wave is idempotent.
 */
export function resolveMilestoneWorldStepDelta(
  appliedSteps: number,
  worldDepth: number,
): MilestoneWorldStepDelta {
  const applied = Math.max(0, Math.floor(appliedSteps));
  const requested = Math.max(0, Math.floor(worldDepth) - 1);
  const targetSteps = Math.max(applied, requested);
  return { targetSteps, newSteps: targetSteps - applied };
}

export function resolveMilestonePressureRecovery(
  levels: Readonly<Record<string, number>>,
): MilestonePressureRecovery {
  const level = boundedLevel(levels, 'tidalRecovery');
  return {
    nodeRepair: level * 0.25,
    sectorRepair: level * 0.1,
    globalRepair: level * 0.03,
  };
}

export interface MilestoneDefeatProgress {
  defeatStreak: number;
  vanguardDefeats: number;
  bonusIntegrityWork: number;
  bonusWaves: number;
  overclockSeconds: number;
}

/** Resolve one verified campaign defeat through the score and wave branches. */
export function resolveMilestoneDefeatProgress(
  levels: Readonly<Record<string, number>>,
  defeatStreak: number,
  vanguardDefeats: number,
): MilestoneDefeatProgress {
  const meritLevel = boundedLevel(levels, 'meritChain');
  const nextStreak = meritLevel > 0 ? Math.max(0, defeatStreak) + 1 : 0;
  const meritWork = meritLevel > 0
    ? Math.min(5, nextStreak) * 10 * meritLevel
    : 0;
  const bonusIntegrityWork = meritWork + boundedLevel(levels, 'resonantBounty') * 2;

  const vanguardLevel = boundedLevel(levels, 'vanguardCircuit');
  if (vanguardLevel <= 0) {
    return {
      defeatStreak: nextStreak,
      vanguardDefeats: 0,
      bonusIntegrityWork,
      bonusWaves: 0,
      overclockSeconds: 0,
    };
  }
  const threshold = 12 - vanguardLevel * 2;
  // Store fractional Horizon progress in exact 1/24 ticks while resolving it.
  // Repeated floating-point addition can otherwise leave a mathematically full
  // quota at 9.999999..., delaying a bonus wave by one verified defeat.
  const horizonLevel = boundedLevel(levels, 'horizonEngine');
  const thresholdTicks = threshold * LONG_FORM_MILESTONE_LEVELS;
  const accumulatedTicks = Math.round(
    Math.max(0, vanguardDefeats) * LONG_FORM_MILESTONE_LEVELS,
  ) + LONG_FORM_MILESTONE_LEVELS + horizonLevel;
  const bonusWaves = Math.floor(accumulatedTicks / thresholdTicks);
  return {
    defeatStreak: nextStreak,
    vanguardDefeats: (accumulatedTicks % thresholdTicks) / LONG_FORM_MILESTONE_LEVELS,
    bonusIntegrityWork,
    bonusWaves,
    overclockSeconds: bonusWaves * boundedLevel(levels, 'fabricationCycle') * 0.25,
  };
}

export function milestoneIntegrityRestorationMultiplier(
  levels: Readonly<Record<string, number>>,
  nodeIntegrity = 100,
): number {
  const base = 1
    + boundedLevel(levels, 'integrityLattice') * 0.2
    + boundedLevel(levels, 'fieldWeave') * 0.0075;
  const critical = nodeIntegrity < 25
    ? boundedLevel(levels, 'nullLattice') * 0.01
    : 0;
  return Math.min(2.5, base + critical);
}

export function milestoneIntegrityBreachMultiplier(
  levels: Readonly<Record<string, number>>,
  nodeIntegrity = 100,
): number {
  const lattice = 1 - boundedLevel(levels, 'integrityLattice') * 0.15;
  const bulkhead = 1 - boundedLevel(levels, 'memoryBulkhead') * 0.0075;
  const critical = nodeIntegrity < 25
    ? 1 - boundedLevel(levels, 'nullLattice') * 0.01
    : 1;
  return Math.max(0.3, lattice * bulkhead * critical);
}

/**
 * Boss cards need a bounded semantic summary, not the raw sum of hundreds of
 * long-form ranks. This retains adaptation without turning catalog size into
 * unbounded mutation/fusion damage.
 */
export function milestoneBossEvolutionProfile(
  levels: Readonly<Record<string, number>>,
): MilestoneBossEvolutionProfile {
  const installed = Object.entries(levels)
    .filter(([id, level]) => getMilestoneEvolution(id) && Number.isFinite(level) && level > 0);
  const totalRanks = installed.reduce(
    (total, [id]) => total + boundedLevel(levels, id),
    0,
  );
  return {
    // Preserve the original early-run semantics, then stop the much larger
    // catalog from inflating Boss-card magnitudes without limit.
    mutationCount: Math.min(8, totalRanks),
    fusionLevel: Math.min(3, Math.floor(installed.length / 2)),
  };
}
