import type { Enemy } from './types';

export type CombatSide = 'player' | 'enemy' | 'npc' | 'neutral';

/** Stable enough for one simulation tick; adapters may use a richer id later. */
export interface CombatantRef {
  side: CombatSide;
  id: string;
}

export interface EffectEnvelope {
  source?: CombatantRef;
  target: CombatantRef;
  abilityId?: string;
  tags?: readonly string[];
}

export interface DamageEffect extends EffectEnvelope {
  kind: 'damage';
  amount: number;
  damageType?: 'physical' | 'energy' | 'true';
  bypassShield?: boolean;
  armorPiercing?: number;
  minimumDamage?: number;
  /** Useful for non-lethal effects such as Echo Brink. */
  minimumHp?: number;
}

export interface HealEffect extends EffectEnvelope {
  kind: 'heal';
  amount: number;
  allowOverheal?: boolean;
}

export interface ShieldEffect extends EffectEnvelope {
  kind: 'shield';
  amount: number;
  cap?: number;
}

export interface ArmorEffect extends EffectEnvelope {
  kind: 'armor';
  amount: number;
  cap?: number;
}

export interface RepositionEffect extends EffectEnvelope {
  kind: 'reposition' | 'phase';
  row?: number;
  column?: number;
  rowDelta?: number;
  columnDelta?: number;
  phaseDuration?: number;
}

export const COMBAT_STATUS = {
  SLOW: 'slow',
  STUN: 'stun',
  ROOT: 'root',
  SILENCE: 'silence',
  VULNERABLE: 'vulnerable',
  GUARDED: 'guarded',
  PHASED: 'phased',
  MARKED: 'marked',
  REGENERATION: 'regeneration',
  BURN: 'burn',
  FREEZE: 'freeze',
} as const;

export type StandardCombatStatusId = typeof COMBAT_STATUS[keyof typeof COMBAT_STATUS];
export type CombatStatusId = StandardCombatStatusId | `custom:${string}`;

export interface CombatStatus {
  id: CombatStatusId;
  remaining: number;
  stacks: number;
  source?: CombatantRef;
}

export interface StatusEffect extends EffectEnvelope {
  kind: 'status';
  status: CombatStatusId;
  duration: number;
  stacks?: number;
  merge?: 'refresh' | 'extend' | 'replace';
  maxStacks?: number;
}

export interface DefeatEvent extends EffectEnvelope {
  kind: 'defeat';
  overkill: number;
}

export type CombatEffect =
  | DamageEffect
  | HealEffect
  | ShieldEffect
  | ArmorEffect
  | RepositionEffect
  | StatusEffect;

/**
 * Normalized durability used by the pure resolvers. Existing player/NPC
 * shieldCharges map to shield with shieldMode='charges'.
 */
export interface CombatVitals {
  hp: number;
  maxHp: number;
  shield?: number;
  armor?: number;
  shieldMode?: 'points' | 'charges';
}

export interface DamageResolution {
  vitals: CombatVitals;
  attempted: number;
  hpDamage: number;
  shieldDamage: number;
  armorPrevented: number;
  overkill: number;
  defeated: boolean;
  defeatEvent?: DefeatEvent;
}

export interface HealResolution {
  vitals: CombatVitals;
  attempted: number;
  healed: number;
  overheal: number;
}

export interface PositionState {
  row: number;
  column: number;
}

export interface PositionBounds {
  minRow: number;
  maxRow: number;
  minColumn: number;
  maxColumn: number;
}

export interface RepositionResolution {
  position: PositionState;
  moved: boolean;
  phased: boolean;
  phaseDuration: number;
}

const finiteNonNegative = (value: number): number =>
  Number.isFinite(value) ? Math.max(0, value) : 0;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export function normalizeVitals(vitals: CombatVitals): CombatVitals {
  const maxHp = Math.max(0, finiteNonNegative(vitals.maxHp));
  return {
    hp: clamp(finiteNonNegative(vitals.hp), 0, maxHp),
    maxHp,
    shield: finiteNonNegative(vitals.shield ?? 0),
    armor: finiteNonNegative(vitals.armor ?? 0),
    shieldMode: vitals.shieldMode ?? 'points',
  };
}

export function resolveDamage(
  current: CombatVitals,
  effect: DamageEffect,
): DamageResolution {
  const before = normalizeVitals(current);
  const attempted = finiteNonNegative(effect.amount);
  let remaining = attempted;
  let shield = before.shield ?? 0;
  let shieldDamage = 0;

  if (!effect.bypassShield && shield > 0 && remaining > 0) {
    if (before.shieldMode === 'charges') {
      shieldDamage = 1;
      shield -= 1;
      remaining = 0;
    } else {
      shieldDamage = Math.min(shield, remaining);
      shield -= shieldDamage;
      remaining -= shieldDamage;
    }
  }

  const armor = effect.damageType === 'true'
    ? 0
    : Math.max(0, (before.armor ?? 0) - finiteNonNegative(effect.armorPiercing ?? 0));
  const armorPrevented = Math.min(remaining, armor);
  remaining -= armorPrevented;
  if (remaining > 0) remaining = Math.max(remaining, finiteNonNegative(effect.minimumDamage ?? 0));

  const floor = clamp(finiteNonNegative(effect.minimumHp ?? 0), 0, before.maxHp);
  const hpDamage = Math.min(remaining, Math.max(0, before.hp - floor));
  const rawHpAfter = before.hp - remaining;
  const hp = Math.max(floor, before.hp - hpDamage);
  const defeated = before.hp > 0 && hp <= 0;
  const overkill = Math.max(0, -rawHpAfter);
  const vitals = { ...before, hp, shield };

  return {
    vitals,
    attempted,
    hpDamage,
    shieldDamage,
    armorPrevented,
    overkill,
    defeated,
    defeatEvent: defeated ? {
      kind: 'defeat',
      source: effect.source,
      target: effect.target,
      abilityId: effect.abilityId,
      tags: effect.tags,
      overkill,
    } : undefined,
  };
}

export function resolveHeal(current: CombatVitals, effect: HealEffect): HealResolution {
  const before = normalizeVitals(current);
  const attempted = finiteNonNegative(effect.amount);
  const naturalCapacity = Math.max(0, before.maxHp - before.hp);
  const healed = effect.allowOverheal ? attempted : Math.min(attempted, naturalCapacity);
  const hp = before.hp + healed;
  return {
    vitals: { ...before, hp, maxHp: effect.allowOverheal ? Math.max(before.maxHp, hp) : before.maxHp },
    attempted,
    healed,
    overheal: Math.max(0, attempted - naturalCapacity),
  };
}

export function resolveShield(current: CombatVitals, effect: ShieldEffect): CombatVitals {
  const before = normalizeVitals(current);
  const cap = Math.max(0, effect.cap ?? Number.POSITIVE_INFINITY);
  return { ...before, shield: Math.min(cap, (before.shield ?? 0) + finiteNonNegative(effect.amount)) };
}

export function resolveArmor(current: CombatVitals, effect: ArmorEffect): CombatVitals {
  const before = normalizeVitals(current);
  const cap = Math.max(0, effect.cap ?? Number.POSITIVE_INFINITY);
  return { ...before, armor: Math.min(cap, (before.armor ?? 0) + finiteNonNegative(effect.amount)) };
}

export function resolveReposition(
  current: PositionState,
  effect: RepositionEffect,
  bounds: PositionBounds,
): RepositionResolution {
  const row = clamp(effect.row ?? current.row + (effect.rowDelta ?? 0), bounds.minRow, bounds.maxRow);
  const column = clamp(
    effect.column ?? current.column + (effect.columnDelta ?? 0),
    bounds.minColumn,
    bounds.maxColumn,
  );
  return {
    position: { row, column },
    moved: row !== current.row || column !== current.column,
    phased: effect.kind === 'phase',
    phaseDuration: effect.kind === 'phase' ? finiteNonNegative(effect.phaseDuration ?? 0) : 0,
  };
}

export function applyStatus(
  statuses: readonly CombatStatus[],
  effect: StatusEffect,
): CombatStatus[] {
  const index = statuses.findIndex((status) => status.id === effect.status);
  const incomingStacks = Math.max(1, Math.floor(finiteNonNegative(effect.stacks ?? 1)));
  const maxStacks = Math.max(1, Math.floor(effect.maxStacks ?? Number.POSITIVE_INFINITY));
  const duration = finiteNonNegative(effect.duration);
  const next = statuses.slice();

  if (index < 0) {
    next.push({
      id: effect.status,
      remaining: duration,
      stacks: Math.min(maxStacks, incomingStacks),
      source: effect.source,
    });
    return next;
  }

  const previous = statuses[index];
  const merge = effect.merge ?? 'refresh';
  next[index] = {
    id: previous.id,
    source: effect.source ?? previous.source,
    remaining: merge === 'extend'
      ? previous.remaining + duration
      : merge === 'replace' ? duration : Math.max(previous.remaining, duration),
    stacks: merge === 'replace'
      ? Math.min(maxStacks, incomingStacks)
      : Math.min(maxStacks, previous.stacks + incomingStacks),
  };
  return next;
}

export function tickStatuses(statuses: readonly CombatStatus[], deltaSeconds: number): CombatStatus[] {
  const delta = finiteNonNegative(deltaSeconds);
  return statuses
    .map((status) => ({ ...status, remaining: Math.max(0, status.remaining - delta) }))
    .filter((status) => status.remaining > 0 && status.stacks > 0);
}

export function removeStatus(
  statuses: readonly CombatStatus[],
  id: CombatStatusId,
): CombatStatus[] {
  return statuses.filter((status) => status.id !== id);
}

export function enemyVitals(enemy: Pick<Enemy, 'hp' | 'maxHp'>): CombatVitals {
  return { hp: enemy.hp, maxHp: Math.max(enemy.hp, enemy.maxHp ?? enemy.hp) };
}

export function withEnemyVitals<T extends Enemy>(enemy: T, vitals: CombatVitals): T {
  const normalized = normalizeVitals(vitals);
  return { ...enemy, hp: normalized.hp, maxHp: normalized.maxHp };
}

export interface WoundedAllyOptions {
  sourceIndex?: number;
  includeSource?: boolean;
  sameRow?: boolean;
  sameFormation?: boolean;
  maxColumnDistance?: number;
  minimumMissingHp?: number;
  predicate?: (enemy: Enemy, index: number) => boolean;
}

/** Returns an array index so the caller can update the selected ally immutably. */
export function selectMostWoundedAlly(
  enemies: readonly Enemy[],
  options: WoundedAllyOptions = {},
): number | undefined {
  const source = options.sourceIndex === undefined ? undefined : enemies[options.sourceIndex];
  let bestIndex: number | undefined;
  let bestScore = Number.NEGATIVE_INFINITY;

  enemies.forEach((enemy, index) => {
    if (enemy.hp <= 0) return;
    if (!options.includeSource && index === options.sourceIndex) return;
    if (options.sameRow && source && enemy.row !== source.row) return;
    if (options.sameFormation && source && enemy.formationId !== source.formationId) return;
    if (options.maxColumnDistance !== undefined && source
      && Math.abs(enemy.colPos - source.colPos) > options.maxColumnDistance) return;
    if (options.predicate && !options.predicate(enemy, index)) return;

    const maxHp = Math.max(enemy.hp, enemy.maxHp ?? enemy.hp);
    const missing = Math.max(0, maxHp - enemy.hp);
    if (missing < (options.minimumMissingHp ?? Number.EPSILON)) return;
    const ratio = maxHp > 0 ? missing / maxHp : 0;
    const distance = source ? Math.abs(enemy.colPos - source.colPos) : 0;
    const score = ratio * 1_000 + missing * 10 - distance - index * 0.0001;
    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  });

  return bestIndex;
}

export interface LanePressureOptions {
  laneCount?: number;
  minColumn?: number;
  maxColumn?: number;
  /** Set false when measuring crowding rather than threat to the player edge. */
  weightProximity?: boolean;
  predicate?: (enemy: Enemy, index: number) => boolean;
}

/** Measures living strength and proximity without mutating GameState.lanePressure. */
export function measureLanePressure(
  enemies: readonly Enemy[],
  options: LanePressureOptions = {},
): number[] {
  const laneCount = Math.max(1, Math.floor(options.laneCount ?? 3));
  const minColumn = options.minColumn ?? 0;
  const maxColumn = Math.max(minColumn + Number.EPSILON, options.maxColumn ?? 6);
  const pressure = Array.from({ length: laneCount }, () => 0);

  enemies.forEach((enemy, index) => {
    if (enemy.hp <= 0 || enemy.row < 0 || enemy.row >= laneCount) return;
    if (options.predicate && !options.predicate(enemy, index)) return;
    const maxHp = Math.max(enemy.hp, enemy.maxHp ?? enemy.hp);
    const healthWeight = maxHp > 0 ? clamp(enemy.hp / maxHp, 0.2, 1) : 0;
    const proximity = options.weightProximity === false
      ? 1
      : 1 + (1 - clamp((enemy.colPos - minColumn) / (maxColumn - minColumn), 0, 1));
    const speedWeight = 1 + clamp(enemy.speed, 0, 3) * 0.08;
    pressure[enemy.row] += healthWeight * proximity * speedWeight;
  });

  return pressure;
}

export interface LaneSelectionOptions {
  exclude?: readonly number[];
  preferredLane?: number;
}

export function selectLeastPressureLane(
  pressure: readonly number[],
  options: LaneSelectionOptions = {},
): number | undefined {
  return selectPressureLane(pressure, 'least', options);
}

export function selectMostThreatenedLane(
  pressure: readonly number[],
  options: LaneSelectionOptions = {},
): number | undefined {
  return selectPressureLane(pressure, 'most', options);
}

function selectPressureLane(
  pressure: readonly number[],
  mode: 'least' | 'most',
  options: LaneSelectionOptions,
): number | undefined {
  const excluded = new Set(options.exclude ?? []);
  let bestLane: number | undefined;
  let bestValue = mode === 'least' ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;

  pressure.forEach((rawValue, lane) => {
    if (excluded.has(lane)) return;
    const value = Number.isFinite(rawValue) ? rawValue : 0;
    const isBetter = mode === 'least' ? value < bestValue : value > bestValue;
    const isPreferredTie = value === bestValue && lane === options.preferredLane;
    if (isBetter || isPreferredTie) {
      bestValue = value;
      bestLane = lane;
    }
  });

  return bestLane;
}
