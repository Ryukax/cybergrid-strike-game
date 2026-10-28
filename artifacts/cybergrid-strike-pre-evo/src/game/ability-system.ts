import { ABILITY_LOOKUP, ABILITY_POOL } from './constants';
import type { Ability, GameMode } from './types';

/**
 * Canonical authored ability ids. Keep this tuple exhaustive: it gives the
 * practical-selection layer a closed vocabulary instead of silently treating
 * an unknown id as a generic projectile.
 */
export const CANONICAL_ABILITY_IDS = [
  'shotgun', 'heal', 'time', 'pierce', 'bomb', 'shield', 'overclock', 'mirror', 'scramble',
  'nuke', 'barrage', 'warpback', 'purge', 'armor', 'surge', 'backdash', 'megabomb', 'cardflood',
  'freeze', 'blizzard', 'double', 'multishot', 'regen', 'drain', 'voltage',
  'emp', 'snipe', 'gravity', 'chain', 'cluster', 'rowshuffle',
  'ghost', 'turret', 'echo', 'overdrive', 'pulse', 'overload', 'magnet', 'berserk', 'crit',
  'flak', 'groundwire', 'signaljam', 'undertow', 'separate', 'interceptor', 'stasisgate', 'adaptive',
  'ricochet', 'rearguard', 'arcweb', 'splitter', 'seeker', 'shattershot', 'marksman', 'returnfire',
  'oilslick', 'rootsnare', 'sonicnet', 'depthcharge', 'anchorfield', 'tailclamp', 'tanglewire', 'trafficjam',
  'thermalshock', 'circuitarc', 'acidetch', 'bloombind', 'radiantmark', 'voidaperture', 'kineticram', 'elementswap',
  'devolve', 'mutationlock', 'traittheft', 'quarantine', 'clonebreak', 'hybridtax', 'forcedmolt', 'catalyst',
] as const;

export type AbilityId = (typeof CANONICAL_ABILITY_IDS)[number];

export type AbilityRole =
  | 'offense'
  | 'control'
  | 'defense'
  | 'sustain'
  | 'tempo'
  | 'economy'
  | 'counter'
  | 'risk';

export type AbilityTarget =
  | 'self'
  | 'hand'
  | 'projectiles'
  | 'hostile'
  | 'lane'
  | 'grid';

export type AbilityEnemyTag =
  | 'airborne'
  | 'aquatic'
  | 'armored'
  | 'botanical'
  | 'burrower'
  | 'colony'
  | 'converging'
  | 'cryo'
  | 'cyber'
  | 'fast'
  | 'fluidic'
  | 'fused'
  | 'grounded'
  | 'heavy'
  | 'inside-center'
  | 'light'
  | 'machine'
  | 'mobile'
  | 'mutated'
  | 'phase'
  | 'regenerator'
  | 'resilient'
  | 'rooted'
  | 'serpentine'
  | 'spectral'
  | 'tentacled'
  | 'thermal'
  | 'vehicle'
  | 'voltaic'
  | 'void'
  | 'weakened'
  | 'wheel';

export interface AbilityEnemySnapshot {
  tags: readonly AbilityEnemyTag[];
  hp?: number;
  maxHp?: number;
  row?: number;
  /** 0 is collision range; 1 is the far spawn edge. */
  distance?: number;
  species?: string;
  element?: string;
  fusionLevel?: number;
  mutationCount?: number;
  generation?: number;
}

export interface AbilityBoardContext {
  mode: GameMode;
  enemies: readonly AbilityEnemySnapshot[];
  playerHp: number;
  playerMaxHp: number;
  shieldCharges?: number;
  maxShieldCharges?: number;
  pendingThreats?: number;
  canRefreshHand?: boolean;
  opponent?: {
    present: boolean;
    hp?: number;
    maxHp?: number;
    tags?: readonly AbilityEnemyTag[];
    /** Live normalized duel distance; avoids duplicating the opponent in enemies. */
    distance?: number;
  };
}

export type AbilityRequirement =
  | { kind: 'hostiles'; min: number }
  | { kind: 'matching-hostiles'; tags: readonly AbilityEnemyTag[]; min: number; match?: 'any' | 'all' }
  | { kind: 'health-missing'; min: number }
  | { kind: 'shield-room'; min: number }
  | { kind: 'hand-refresh' }
  | { kind: 'pressure'; min: number }
  | { kind: 'fusion-level'; min: number }
  | { kind: 'mutation-count'; min: number }
  | { kind: 'generation'; min: number }
  | { kind: 'same-species'; min: number }
  | { kind: 'distance'; min?: number; max?: number };

export interface AbilityApplicability {
  /** Every requirement in this list must be satisfied. */
  all?: readonly AbilityRequirement[];
  /** At least one requirement in this list must be satisfied. */
  any?: readonly AbilityRequirement[];
  /** Valid before contact because it establishes a useful future window. */
  setup?: boolean;
}

export interface AbilityDefinition {
  roles: readonly [AbilityRole, ...AbilityRole[]];
  target: AbilityTarget;
  cadence: 'instant' | 'window' | 'setup';
  applicability: AbilityApplicability;
  /** True means a missing matching board state should withhold this card. */
  specialist?: boolean;
  /** Matching these tags raises priority without making the card mandatory. */
  counterTags?: readonly AbilityEnemyTag[];
  priority: number;
}

const hostiles = (min = 1): AbilityRequirement => ({ kind: 'hostiles', min });
const matching = (
  tags: readonly AbilityEnemyTag[],
  min = 1,
  match: 'any' | 'all' = 'any',
): AbilityRequirement => ({ kind: 'matching-hostiles', tags, min, match });
const missingHp = (min = 1): AbilityRequirement => ({ kind: 'health-missing', min });
const shieldRoom = (min = 1): AbilityRequirement => ({ kind: 'shield-room', min });
const pressure = (min = 1): AbilityRequirement => ({ kind: 'pressure', min });
const fusion = (min = 1): AbilityRequirement => ({ kind: 'fusion-level', min });
const mutations = (min = 1): AbilityRequirement => ({ kind: 'mutation-count', min });
const generation = (min = 2): AbilityRequirement => ({ kind: 'generation', min });
const distance = (min?: number, max?: number): AbilityRequirement => ({ kind: 'distance', min, max });

const H = { all: [hostiles()] } as const;
const SETUP = { setup: true } as const;

/**
 * Gameplay-facing intent for every authored ability. This registry does not
 * resolve effects; it answers whether a card is practical in the current
 * board state and what tactical role it supplies.
 */
export const ABILITY_DEFINITIONS = {
  shotgun: { roles: ['offense'], target: 'lane', cadence: 'instant', applicability: H, priority: 58 },
  heal: { roles: ['sustain'], target: 'self', cadence: 'instant', applicability: { all: [missingHp(2)] }, priority: 78 },
  time: { roles: ['control', 'tempo'], target: 'grid', cadence: 'window', applicability: H, counterTags: ['fast'], priority: 64 },
  pierce: { roles: ['offense', 'tempo'], target: 'projectiles', cadence: 'setup', applicability: SETUP, priority: 55 },
  bomb: { roles: ['offense'], target: 'lane', cadence: 'instant', applicability: H, priority: 61 },
  shield: { roles: ['defense'], target: 'self', cadence: 'setup', applicability: { all: [shieldRoom()] , setup: true }, priority: 68 },
  overclock: { roles: ['tempo', 'offense'], target: 'self', cadence: 'window', applicability: SETUP, priority: 57 },
  mirror: { roles: ['offense'], target: 'grid', cadence: 'instant', applicability: H, priority: 60 },
  scramble: { roles: ['control'], target: 'grid', cadence: 'instant', applicability: H, counterTags: ['light', 'airborne'], priority: 62 },

  nuke: { roles: ['offense'], target: 'grid', cadence: 'instant', applicability: { all: [hostiles(4)] }, priority: 88 },
  barrage: { roles: ['offense'], target: 'lane', cadence: 'instant', applicability: H, priority: 65 },
  warpback: { roles: ['control', 'defense'], target: 'grid', cadence: 'instant', applicability: H, priority: 76 },
  purge: { roles: ['counter', 'offense'], target: 'grid', cadence: 'instant', applicability: { any: [matching(['weakened', 'fused']), mutations(4)] }, specialist: true, counterTags: ['weakened', 'fused', 'mutated'], priority: 83 },
  armor: { roles: ['defense'], target: 'self', cadence: 'setup', applicability: { all: [shieldRoom(2)], setup: true }, priority: 74 },
  surge: { roles: ['offense'], target: 'grid', cadence: 'instant', applicability: H, priority: 67 },
  backdash: { roles: ['control', 'defense'], target: 'grid', cadence: 'instant', applicability: H, priority: 70 },
  megabomb: { roles: ['offense', 'economy'], target: 'grid', cadence: 'instant', applicability: { all: [hostiles(4)] }, priority: 94 },
  cardflood: { roles: ['tempo'], target: 'hand', cadence: 'instant', applicability: { all: [{ kind: 'hand-refresh' }] }, priority: 66 },

  freeze: { roles: ['control'], target: 'grid', cadence: 'window', applicability: H, counterTags: ['phase', 'regenerator', 'fast'], priority: 69 },
  blizzard: { roles: ['counter', 'control'], target: 'grid', cadence: 'window', applicability: { all: [matching(['airborne', 'aquatic', 'fluidic', 'burrower'])] }, specialist: true, counterTags: ['airborne', 'aquatic', 'fluidic', 'burrower'], priority: 82 },
  double: { roles: ['offense', 'tempo'], target: 'projectiles', cadence: 'window', applicability: SETUP, priority: 59 },
  multishot: { roles: ['offense', 'tempo'], target: 'projectiles', cadence: 'window', applicability: SETUP, priority: 60 },
  regen: { roles: ['sustain'], target: 'self', cadence: 'window', applicability: { all: [missingHp()] }, priority: 72 },
  drain: { roles: ['sustain', 'offense'], target: 'self', cadence: 'window', applicability: { all: [hostiles()], any: [missingHp(), pressure()] }, priority: 73 },
  voltage: { roles: ['offense', 'tempo'], target: 'projectiles', cadence: 'window', applicability: SETUP, priority: 64 },

  emp: { roles: ['counter', 'control', 'offense'], target: 'grid', cadence: 'instant', applicability: { all: [matching(['cyber'])] }, specialist: true, counterTags: ['cyber'], priority: 86 },
  snipe: { roles: ['offense'], target: 'hostile', cadence: 'instant', applicability: H, priority: 68 },
  gravity: { roles: ['control', 'counter'], target: 'grid', cadence: 'instant', applicability: H, counterTags: ['airborne'], priority: 70 },
  chain: { roles: ['offense'], target: 'grid', cadence: 'instant', applicability: { all: [hostiles(2)] }, priority: 72 },
  cluster: { roles: ['offense'], target: 'grid', cadence: 'instant', applicability: { all: [hostiles(2)] }, priority: 75 },
  rowshuffle: { roles: ['control'], target: 'grid', cadence: 'instant', applicability: { all: [matching(['mobile'])] }, specialist: true, counterTags: ['mobile'], priority: 68 },

  ghost: { roles: ['defense'], target: 'self', cadence: 'window', applicability: { any: [pressure(), hostiles()] }, priority: 75 },
  turret: { roles: ['offense', 'tempo'], target: 'grid', cadence: 'window', applicability: SETUP, priority: 63 },
  echo: { roles: ['offense', 'tempo'], target: 'projectiles', cadence: 'window', applicability: SETUP, priority: 61 },
  overdrive: { roles: ['risk', 'economy'], target: 'grid', cadence: 'window', applicability: { all: [hostiles()] }, priority: 50 },
  pulse: { roles: ['control'], target: 'grid', cadence: 'window', applicability: H, counterTags: ['light'], priority: 66 },
  overload: { roles: ['offense', 'tempo'], target: 'self', cadence: 'window', applicability: { all: [hostiles()] }, priority: 62 },
  magnet: { roles: ['counter', 'control'], target: 'grid', cadence: 'window', applicability: { all: [matching(['machine', 'cyber'])] }, specialist: true, counterTags: ['machine', 'cyber'], priority: 83 },
  berserk: { roles: ['offense', 'tempo'], target: 'self', cadence: 'window', applicability: SETUP, priority: 63 },
  crit: { roles: ['offense', 'tempo'], target: 'projectiles', cadence: 'window', applicability: SETUP, priority: 58 },

  flak: { roles: ['counter', 'offense', 'control'], target: 'grid', cadence: 'instant', applicability: { all: [matching(['airborne', 'spectral'])] }, specialist: true, counterTags: ['airborne', 'spectral'], priority: 87 },
  groundwire: { roles: ['counter', 'offense', 'control'], target: 'grid', cadence: 'instant', applicability: { all: [matching(['grounded'])] }, specialist: true, counterTags: ['grounded', 'heavy'], priority: 80 },
  signaljam: { roles: ['counter', 'control'], target: 'grid', cadence: 'window', applicability: { all: [matching(['cyber'])] }, specialist: true, counterTags: ['cyber', 'phase', 'regenerator', 'fused'], priority: 88 },
  undertow: { roles: ['counter', 'control'], target: 'grid', cadence: 'instant', applicability: { all: [matching(['fluidic', 'aquatic'])] }, specialist: true, counterTags: ['fluidic', 'aquatic'], priority: 84 },
  separate: { roles: ['counter', 'control', 'offense'], target: 'grid', cadence: 'instant', applicability: { all: [fusion()] }, specialist: true, counterTags: ['fused'], priority: 90 },
  interceptor: { roles: ['offense', 'counter'], target: 'hostile', cadence: 'instant', applicability: H, counterTags: ['fast', 'inside-center'], priority: 73 },
  stasisgate: { roles: ['counter', 'control'], target: 'grid', cadence: 'window', applicability: { all: [matching(['fast'])] }, specialist: true, counterTags: ['fast'], priority: 81 },
  adaptive: { roles: ['counter', 'offense'], target: 'projectiles', cadence: 'window', applicability: { all: [matching(['armored', 'resilient', 'spectral', 'colony', 'cyber'])] }, specialist: true, counterTags: ['armored', 'resilient', 'spectral', 'colony', 'cyber'], priority: 82 },

  ricochet: { roles: ['offense'], target: 'grid', cadence: 'instant', applicability: H, priority: 65 },
  rearguard: { roles: ['offense', 'defense'], target: 'grid', cadence: 'instant', applicability: H, priority: 64 },
  arcweb: { roles: ['offense'], target: 'grid', cadence: 'instant', applicability: { all: [hostiles(2)] }, priority: 72 },
  splitter: { roles: ['offense'], target: 'grid', cadence: 'instant', applicability: H, priority: 69 },
  seeker: { roles: ['offense'], target: 'hostile', cadence: 'instant', applicability: H, priority: 71 },
  shattershot: { roles: ['counter', 'offense'], target: 'hostile', cadence: 'instant', applicability: { all: [matching(['armored', 'resilient'])] }, specialist: true, counterTags: ['armored', 'resilient'], priority: 85 },
  marksman: { roles: ['offense'], target: 'hostile', cadence: 'instant', applicability: { all: [hostiles(), distance(0.5)] }, priority: 70 },
  returnfire: { roles: ['defense', 'offense'], target: 'grid', cadence: 'instant', applicability: { all: [matching(['inside-center'])] }, specialist: true, counterTags: ['inside-center'], priority: 84 },

  oilslick: { roles: ['counter', 'control'], target: 'grid', cadence: 'instant', applicability: { all: [matching(['wheel', 'vehicle'])] }, specialist: true, counterTags: ['wheel', 'vehicle'], priority: 84 },
  rootsnare: { roles: ['counter', 'control'], target: 'grid', cadence: 'window', applicability: { all: [matching(['grounded'])] }, specialist: true, counterTags: ['grounded', 'mobile'], priority: 82 },
  sonicnet: { roles: ['counter', 'offense', 'control'], target: 'grid', cadence: 'instant', applicability: { all: [matching(['airborne'])] }, specialist: true, counterTags: ['airborne'], priority: 86 },
  depthcharge: { roles: ['counter', 'offense'], target: 'grid', cadence: 'instant', applicability: { all: [matching(['burrower'])] }, specialist: true, counterTags: ['burrower'], priority: 87 },
  anchorfield: { roles: ['control', 'counter'], target: 'grid', cadence: 'window', applicability: H, counterTags: ['heavy', 'light'], priority: 70 },
  tailclamp: { roles: ['counter', 'control'], target: 'grid', cadence: 'window', applicability: { all: [matching(['serpentine', 'aquatic'])] }, specialist: true, counterTags: ['serpentine', 'aquatic'], priority: 85 },
  tanglewire: { roles: ['counter', 'offense', 'control'], target: 'grid', cadence: 'instant', applicability: { all: [matching(['rooted', 'tentacled'])] }, specialist: true, counterTags: ['rooted', 'tentacled'], priority: 85 },
  trafficjam: { roles: ['counter', 'control'], target: 'grid', cadence: 'instant', applicability: { all: [matching(['vehicle', 'machine'])] }, specialist: true, counterTags: ['vehicle', 'machine'], priority: 83 },

  thermalshock: { roles: ['counter', 'offense'], target: 'grid', cadence: 'instant', applicability: { all: [matching(['thermal', 'cryo'])] }, specialist: true, counterTags: ['thermal', 'cryo'], priority: 86 },
  circuitarc: { roles: ['counter', 'offense'], target: 'grid', cadence: 'instant', applicability: { all: [matching(['voltaic', 'machine', 'fluidic'])] }, specialist: true, counterTags: ['voltaic', 'machine', 'fluidic'], priority: 86 },
  acidetch: { roles: ['counter', 'offense'], target: 'grid', cadence: 'instant', applicability: { all: [matching(['armored'])] }, specialist: true, counterTags: ['armored'], priority: 84 },
  bloombind: { roles: ['counter', 'control', 'offense'], target: 'grid', cadence: 'window', applicability: { all: [matching(['botanical'])] }, specialist: true, counterTags: ['botanical'], priority: 85 },
  radiantmark: { roles: ['counter', 'offense'], target: 'grid', cadence: 'window', applicability: { all: [matching(['phase', 'void', 'spectral'])] }, specialist: true, counterTags: ['phase', 'void', 'spectral'], priority: 87 },
  voidaperture: { roles: ['control', 'offense'], target: 'hostile', cadence: 'instant', applicability: H, priority: 75 },
  kineticram: { roles: ['control', 'offense'], target: 'lane', cadence: 'instant', applicability: H, priority: 70 },
  elementswap: { roles: ['control', 'counter'], target: 'grid', cadence: 'instant', applicability: H, priority: 60 },

  devolve: { roles: ['counter', 'control'], target: 'grid', cadence: 'instant', applicability: { any: [fusion(), mutations(), generation()] }, specialist: true, counterTags: ['fused', 'mutated'], priority: 88 },
  mutationlock: { roles: ['counter', 'control'], target: 'grid', cadence: 'window', applicability: { all: [matching(['regenerator', 'phase', 'mutated'])] }, specialist: true, counterTags: ['regenerator', 'phase', 'mutated'], priority: 87 },
  traittheft: { roles: ['counter', 'sustain'], target: 'hostile', cadence: 'instant', applicability: { all: [mutations()] }, specialist: true, counterTags: ['mutated'], priority: 86 },
  quarantine: { roles: ['counter', 'control'], target: 'grid', cadence: 'window', applicability: { all: [matching(['converging', 'fused'])] }, specialist: true, counterTags: ['converging', 'fused'], priority: 86 },
  clonebreak: { roles: ['counter', 'offense'], target: 'grid', cadence: 'instant', applicability: { all: [{ kind: 'same-species', min: 2 }] }, specialist: true, counterTags: ['colony'], priority: 84 },
  hybridtax: { roles: ['counter', 'offense', 'control'], target: 'grid', cadence: 'instant', applicability: { all: [fusion()] }, specialist: true, counterTags: ['fused'], priority: 87 },
  forcedmolt: { roles: ['counter', 'control'], target: 'grid', cadence: 'instant', applicability: { all: [matching(['armored', 'mutated'])] }, specialist: true, counterTags: ['armored', 'mutated'], priority: 81 },
  catalyst: { roles: ['risk', 'economy'], target: 'grid', cadence: 'window', applicability: { all: [fusion()] }, specialist: true, counterTags: ['fused'], priority: 58 },
} as const satisfies Record<AbilityId, AbilityDefinition>;

export type AbilityReadiness = 'ready' | 'setup' | 'invalid';

export interface AbilityEvaluation {
  id: string;
  valid: boolean;
  readiness: AbilityReadiness;
  score: number;
  matchingEnemyCount: number;
  reasons: readonly string[];
}

interface RequirementResult {
  valid: boolean;
  count: number;
  reason: string;
}

function opponentSnapshot(context: AbilityBoardContext): AbilityEnemySnapshot | undefined {
  if (context.mode !== 'vs' || !context.opponent?.present) return undefined;
  return {
    tags: context.opponent.tags ?? [],
    hp: context.opponent.hp,
    maxHp: context.opponent.maxHp,
    distance: context.opponent.distance ?? 0.65,
  };
}

function allHostiles(context: AbilityBoardContext): readonly AbilityEnemySnapshot[] {
  const opponent = opponentSnapshot(context);
  return opponent ? [...context.enemies, opponent] : context.enemies;
}

function hasTags(
  enemy: AbilityEnemySnapshot,
  tags: readonly AbilityEnemyTag[],
  match: 'any' | 'all',
): boolean {
  const available = new Set(enemy.tags);
  return match === 'all'
    ? tags.every((tag) => available.has(tag))
    : tags.some((tag) => available.has(tag));
}

function requirementResult(
  requirement: AbilityRequirement,
  context: AbilityBoardContext,
): RequirementResult {
  const hostilesList = allHostiles(context);
  switch (requirement.kind) {
    case 'hostiles': {
      const count = hostilesList.length;
      return { valid: count >= requirement.min, count, reason: `${count}/${requirement.min} hostile targets` };
    }
    case 'matching-hostiles': {
      const count = hostilesList.filter((enemy) => hasTags(enemy, requirement.tags, requirement.match ?? 'any')).length;
      return { valid: count >= requirement.min, count, reason: `${count}/${requirement.min} matching targets` };
    }
    case 'health-missing': {
      const count = Math.max(0, context.playerMaxHp - context.playerHp);
      return { valid: count >= requirement.min, count, reason: `${count}/${requirement.min} HP missing` };
    }
    case 'shield-room': {
      const count = Math.max(0, (context.maxShieldCharges ?? 3) - (context.shieldCharges ?? 0));
      return { valid: count >= requirement.min, count, reason: `${count}/${requirement.min} shield capacity` };
    }
    case 'hand-refresh': {
      const count = context.canRefreshHand ? 1 : 0;
      return { valid: count === 1, count, reason: context.canRefreshHand ? 'hand can refresh' : 'hand is not refreshable' };
    }
    case 'pressure': {
      const close = context.enemies.filter((enemy) => (enemy.distance ?? 1) <= 0.35).length;
      const count = close + Math.max(0, context.pendingThreats ?? 0);
      return { valid: count >= requirement.min, count, reason: `${count}/${requirement.min} immediate threats` };
    }
    case 'fusion-level': {
      const count = hostilesList.filter((enemy) => (enemy.fusionLevel ?? 0) >= requirement.min || enemy.tags.includes('fused')).length;
      return { valid: count > 0, count, reason: `${count} fused targets at level ${requirement.min}+` };
    }
    case 'mutation-count': {
      const count = hostilesList.filter((enemy) => enemy.mutationCount !== undefined
        ? enemy.mutationCount >= requirement.min
        : requirement.min <= 1 && enemy.tags.includes('mutated')).length;
      return { valid: count > 0, count, reason: `${count} targets with ${requirement.min}+ mutations` };
    }
    case 'generation': {
      const count = hostilesList.filter((enemy) => (enemy.generation ?? 1) >= requirement.min).length;
      return { valid: count > 0, count, reason: `${count} generation-${requirement.min}+ targets` };
    }
    case 'same-species': {
      const speciesCounts = new Map<string, number>();
      for (const enemy of hostilesList) {
        if (!enemy.species) continue;
        speciesCounts.set(enemy.species, (speciesCounts.get(enemy.species) ?? 0) + 1);
      }
      const count = Math.max(0, ...speciesCounts.values());
      return { valid: count >= requirement.min, count, reason: `${count}/${requirement.min} same-species targets` };
    }
    case 'distance': {
      const count = hostilesList.filter((enemy) => {
        const value = enemy.distance ?? 0.5;
        return (requirement.min === undefined || value >= requirement.min)
          && (requirement.max === undefined || value <= requirement.max);
      }).length;
      return { valid: count > 0, count, reason: `${count} targets in distance window` };
    }
  }
}

export function isAbilityId(id: string): id is AbilityId {
  return Object.prototype.hasOwnProperty.call(ABILITY_DEFINITIONS, id);
}

export function abilityDefinition(id: string): AbilityDefinition | undefined {
  return isAbilityId(id) ? ABILITY_DEFINITIONS[id] : undefined;
}

export function evaluateAbility(id: string, context: AbilityBoardContext): AbilityEvaluation {
  if (!isAbilityId(id)) {
    return {
      id,
      valid: false,
      readiness: 'invalid',
      score: Number.NEGATIVE_INFINITY,
      matchingEnemyCount: 0,
      reasons: [`Unknown ability: ${id}`],
    };
  }

  const definition: AbilityDefinition = ABILITY_DEFINITIONS[id];
  const allRequirements = definition.applicability.all ?? [];
  const anyRequirements = definition.applicability.any ?? [];
  const allChecks = allRequirements.map((requirement) => ({
    requirement,
    result: requirementResult(requirement, context),
  }));
  const anyChecks = anyRequirements.map((requirement) => ({
    requirement,
    result: requirementResult(requirement, context),
  }));
  const allValid = allChecks.every(({ result }) => result.valid);
  const anyValid = anyChecks.length === 0 || anyChecks.some(({ result }) => result.valid);

  // A duel has only one rival, and that rival may not expose campaign-only
  // anatomy/evolution metadata. The bounded VS interpretation may bridge only
  // those target-side gaps. It must never invent missing HP, shield capacity,
  // a refreshable hand, or immediate pressure for the caster.
  const competitiveFallbackAvailable = context.mode === 'vs' && Boolean(context.opponent?.present);
  const competitiveRequirementCanFallback = (requirement: AbilityRequirement): boolean => {
    switch (requirement.kind) {
      case 'hostiles':
      case 'matching-hostiles':
      case 'fusion-level':
      case 'mutation-count':
      case 'generation':
      case 'same-species':
      case 'distance':
        return true;
      case 'health-missing':
      case 'shield-room':
      case 'hand-refresh':
      case 'pressure':
        return false;
    }
  };
  const competitiveAllValid = allChecks.every(({ requirement, result }) => (
    result.valid || competitiveRequirementCanFallback(requirement)
  ));
  const competitiveAnyValid = anyChecks.length === 0 || anyChecks.some(({ requirement, result }) => (
    result.valid || competitiveRequirementCanFallback(requirement)
  ));
  const normallyValid = allValid && anyValid;
  const usesCompetitiveFallback = !normallyValid
    && competitiveFallbackAvailable
    && competitiveAllValid
    && competitiveAnyValid;
  const valid = normallyValid || usesCompetitiveFallback;
  const hostilesList = allHostiles(context);
  const matchingEnemyCount = definition.counterTags
    ? hostilesList.filter((enemy) => hasTags(enemy, definition.counterTags ?? [], 'any')).length
    : 0;

  const missingRatio = context.playerMaxHp > 0
    ? Math.max(0, context.playerMaxHp - context.playerHp) / context.playerMaxHp
    : 0;
  const pressureCount = Math.max(0, context.pendingThreats ?? 0)
    + context.enemies.filter((enemy) => (enemy.distance ?? 1) <= 0.35).length;
  const tacticalBonus = Math.min(24, matchingEnemyCount * 8)
    + (definition.roles.includes('sustain') ? Math.round(missingRatio * 18) : 0)
    + (definition.roles.includes('defense') ? Math.min(12, pressureCount * 4) : 0)
    + (definition.roles.includes('offense') ? Math.min(9, hostilesList.length * 3) : 0);
  const specialistFallbackPenalty = competitiveFallbackAvailable
    && definition.specialist
    && matchingEnemyCount === 0
    ? 28
    : 0;
  const score = valid
    ? definition.priority + tacticalBonus - specialistFallbackPenalty
    : Number.NEGATIVE_INFINITY;
  const failed = [
    ...allChecks.map(({ result }) => result).filter((result) => !result.valid),
    ...(anyChecks.length > 0 && !anyValid
      ? anyChecks.map(({ result }) => result)
      : []),
  ];
  const readiness: AbilityReadiness = !valid
    ? 'invalid'
    : definition.applicability.setup && hostilesList.length === 0
      ? 'setup'
      : 'ready';

  return {
    id,
    valid,
    readiness,
    score,
    matchingEnemyCount,
    reasons: valid
      ? (usesCompetitiveFallback
        ? ['bounded competitive fallback']
        : [...allChecks, ...anyChecks]
          .map(({ result }) => result)
          .filter((result) => result.valid)
          .map((result) => result.reason))
      : failed.map((result) => result.reason),
  };
}

export interface PracticalHandOptions {
  availableAbilityIds: readonly string[];
  context: AbilityBoardContext;
  seed: number;
  size?: number;
  /** Safe authored cards used only when the supplied pool cannot fill a useful hand. */
  fallbackAbilityIds?: readonly AbilityId[];
}

function seededTieBreak(id: AbilityId, seed: number): number {
  let hash = (seed | 0) ^ 0x9e3779b9;
  for (let i = 0; i < id.length; i += 1) {
    hash = Math.imul(hash ^ id.charCodeAt(i), 0x45d9f3b);
    hash ^= hash >>> 16;
  }
  return hash >>> 0;
}

const PRACTICAL_TOP_SCORE_BAND = 10;

function chooseSeededFromTopBand(
  candidates: readonly RankedAbility[],
  seed: number,
  pickIndex: number,
): RankedAbility | undefined {
  if (candidates.length === 0) return undefined;
  const topScore = Math.max(...candidates.map(({ evaluation }) => evaluation.score));
  const inBand = candidates.filter(({ evaluation }) => (
    evaluation.score >= topScore - PRACTICAL_TOP_SCORE_BAND
  ));
  const pickSeed = (seed | 0) ^ Math.imul(pickIndex + 1, 0x6d2b79f5);
  return [...inBand].sort((a, b) => (
    seededTieBreak(a.id, pickSeed) - seededTieBreak(b.id, pickSeed)
  ))[0];
}

interface RankedAbility {
  id: AbilityId;
  evaluation: AbilityEvaluation;
  definition: AbilityDefinition;
}

function rankAbilities(
  ids: readonly AbilityId[],
  context: AbilityBoardContext,
  seed: number,
): RankedAbility[] {
  return ids
    .map((id) => ({ id, evaluation: evaluateAbility(id, context), definition: ABILITY_DEFINITIONS[id] }))
    .filter((entry) => entry.evaluation.valid)
    .sort((a, b) => {
      const score = b.evaluation.score - a.evaluation.score;
      if (score !== 0) return score;
      return seededTieBreak(a.id, seed) - seededTieBreak(b.id, seed);
    });
}

/**
 * Deterministically composes a practical hand. Invalid specialist cards are
 * withheld, one currently matched counter is preferred, and subsequent picks
 * diversify tactical roles. Selection varies deterministically inside a
 * near-best score band, but never deals outside the learned pool plus an
 * explicitly supplied fallback pool.
 */
export function composePracticalAbilityHand(options: PracticalHandOptions): Ability[] {
  const size = Math.max(1, Math.min(3, Math.floor(options.size ?? 3)));
  const uniqueAvailable = [...new Set(options.availableAbilityIds.filter(isAbilityId))];
  const primary = rankAbilities(uniqueAvailable, options.context, options.seed);
  const selected: RankedAbility[] = [];
  const selectedIds = new Set<AbilityId>();
  const selectedRoles = new Set<AbilityRole>();

  const add = (entry: RankedAbility | undefined): void => {
    if (!entry || selected.length >= size || selectedIds.has(entry.id)) return;
    selected.push(entry);
    selectedIds.add(entry.id);
    for (const role of entry.definition.roles) selectedRoles.add(role);
  };

  const liveCounters = primary.filter((entry) => (
    entry.definition.specialist && entry.evaluation.matchingEnemyCount > 0
  ));
  add(chooseSeededFromTopBand(liveCounters, options.seed ^ 0x243f6a88, selected.length));

  while (selected.length < size) {
    const remaining = primary.filter((entry) => !selectedIds.has(entry.id));
    if (remaining.length === 0) break;
    const roleDiverse = remaining.filter((entry) => (
      entry.definition.roles.some((role) => !selectedRoles.has(role))
    ));
    add(chooseSeededFromTopBand(
      roleDiverse.length > 0 ? roleDiverse : remaining,
      options.seed,
      selected.length,
    ));
  }

  if (selected.length < size) {
    const fallbackIds = [...new Set(options.fallbackAbilityIds ?? [])]
      .filter((id) => !selectedIds.has(id));
    const fallbacks = rankAbilities(fallbackIds, options.context, options.seed ^ 0x5f3759df);
    const fallbackCounters = fallbacks.filter((entry) => (
      entry.definition.specialist && entry.evaluation.matchingEnemyCount > 0
    ));
    add(chooseSeededFromTopBand(
      fallbackCounters,
      options.seed ^ 0x13198a2e,
      selected.length,
    ));
    while (selected.length < size) {
      const remaining = fallbacks.filter((entry) => !selectedIds.has(entry.id));
      if (remaining.length === 0) break;
      const roleDiverse = remaining.filter((entry) => (
        entry.definition.roles.some((role) => !selectedRoles.has(role))
      ));
      add(chooseSeededFromTopBand(
        roleDiverse.length > 0 ? roleDiverse : remaining,
        options.seed ^ 0x5f3759df,
        selected.length,
      ));
    }
  }

  return selected.map(({ id }) => ABILITY_LOOKUP[id]).filter((ability): ability is Ability => Boolean(ability));
}

/** Runtime assertion helper for tests and development diagnostics. */
export function canonicalAbilityRegistryIsComplete(): boolean {
  const pool = new Set(ABILITY_POOL.map(({ id }) => id));
  return pool.size === CANONICAL_ABILITY_IDS.length
    && CANONICAL_ABILITY_IDS.every((id) => pool.has(id) && Boolean(ABILITY_DEFINITIONS[id]));
}
