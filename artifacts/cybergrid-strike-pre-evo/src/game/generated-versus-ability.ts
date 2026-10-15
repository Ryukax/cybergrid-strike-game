import type { AbilityBoardContext } from './ability-system';
import { COMPETITIVE_RULESET } from './competitive-balance';
import type {
  VersusBossAbilityCombatantState,
  VersusBossAbilityMetadata,
  VersusBossAbilityProjectile,
  VersusBossAbilityRuntimeState,
} from './versus-boss-ability-runtime';
import {
  VERSUS_ABILITY_LIMITS,
  type VersusAbilityContext,
  type VersusAbilityOutcome,
  type VersusAbilityTargeting,
  type VersusStatusIntent,
} from './versus-ability-resolver';
import { applyVersusStatusIntents } from './versus-status-runtime';

export const GENERATED_ABILITY_DELIVERIES = [
  'projector',
  'field',
  'shell',
  'weave',
  'aperture',
  'pulse',
] as const;

export const GENERATED_ABILITY_FUNCTIONS = [
  'rupture',
  'inhibit',
  'impulse',
  'ward',
  'restore',
  'reveal',
  'adapt',
] as const;

export const GENERATED_ABILITY_MEDIA = [
  'signal',
  'thermal',
  'phase',
  'fluid',
  'organic',
  'kinetic',
] as const;

export type GeneratedAbilityDelivery = (typeof GENERATED_ABILITY_DELIVERIES)[number];
export type GeneratedAbilityFunction = (typeof GENERATED_ABILITY_FUNCTIONS)[number];
export type GeneratedAbilityMedium = (typeof GENERATED_ABILITY_MEDIA)[number];
export type GeneratedAbilityId = `manifest-${string}`;
export type GeneratedPlaystyleSignal =
  | 'manualFire'
  | 'autoOffFire'
  | 'movement'
  | 'abilityUse'
  | 'rotation'
  | 'cloneDefense'
  | 'cloneAutofire';

/**
 * Persisted constitution/playstyle card accepted by the Boss counterpart.
 *
 * All three behavior components are required. An ID alone is deliberately not
 * enough to manufacture an NPC card: callers must provide the same definition
 * that was stored for the player manifestation.
 */
export interface GeneratedVersusAbilityCard {
  readonly id: GeneratedAbilityId;
  readonly abilityId: GeneratedAbilityId;
  readonly name: string;
  readonly desc: string;
  readonly cooldown: number;
  readonly delivery: GeneratedAbilityDelivery;
  readonly function: GeneratedAbilityFunction;
  readonly medium: GeneratedAbilityMedium;
  readonly constitutionSignature: string;
  readonly manifestedAt: number;
}

export interface GeneratedVersusAbilityComponents {
  readonly delivery: GeneratedAbilityDelivery;
  readonly function: GeneratedAbilityFunction;
  readonly medium: GeneratedAbilityMedium;
}

/**
 * Authoritative persisted component tuples for the seven playstyle cards.
 *
 * Both the table and its tuple records are frozen so validation cannot drift
 * during an encounter. A style ID not present here is not a supported card.
 */
export const GENERATED_PLAYSTYLE_COMPONENTS = Object.freeze({
  manualFire: Object.freeze({ delivery: 'projector', function: 'rupture', medium: 'kinetic' }),
  autoOffFire: Object.freeze({ delivery: 'projector', function: 'rupture', medium: 'kinetic' }),
  movement: Object.freeze({ delivery: 'field', function: 'impulse', medium: 'kinetic' }),
  abilityUse: Object.freeze({ delivery: 'projector', function: 'ward', medium: 'signal' }),
  rotation: Object.freeze({ delivery: 'pulse', function: 'reveal', medium: 'kinetic' }),
  cloneDefense: Object.freeze({ delivery: 'shell', function: 'ward', medium: 'kinetic' }),
  cloneAutofire: Object.freeze({ delivery: 'projector', function: 'adapt', medium: 'kinetic' }),
} as const satisfies Readonly<Record<GeneratedPlaystyleSignal, GeneratedVersusAbilityComponents>>);

export interface GeneratedVersusAbilityOutcome
  extends Omit<VersusAbilityOutcome, 'abilityId'> {
  readonly abilityId: GeneratedAbilityId;
  readonly components: GeneratedVersusAbilityComponents;
  /** Whether the stored medium matched the opponent before fallback targeting. */
  readonly affinityMatched: boolean;
}

export interface GeneratedVersusBossAbilityExecution {
  readonly state: VersusBossAbilityRuntimeState;
  readonly outcome: GeneratedVersusAbilityOutcome;
  readonly projectiles: readonly VersusBossAbilityProjectile[];
}

const DELIVERY_SET = new Set<string>(GENERATED_ABILITY_DELIVERIES);
const FUNCTION_SET = new Set<string>(GENERATED_ABILITY_FUNCTIONS);
const MEDIUM_SET = new Set<string>(GENERATED_ABILITY_MEDIA);

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.max(minimum, Math.min(maximum, Number.isFinite(value) ? value : minimum));

const lane = (value: number) => Math.round(clamp(value, 0, 2));

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

/** Strict reader for persisted manifestations. Invalid component data is rejected. */
export function readGeneratedVersusAbilityCard(
  value: unknown,
): GeneratedVersusAbilityCard | null {
  if (!isRecord(value)) return null;
  const id = value.id;
  if (typeof id !== 'string' || !id.startsWith('manifest-')) return null;
  if (value.abilityId !== id) return null;
  if (typeof value.name !== 'string' || value.name.trim().length === 0) return null;
  if (typeof value.desc !== 'string' || value.desc.trim().length === 0) return null;
  if (typeof value.cooldown !== 'number' || !Number.isFinite(value.cooldown) || value.cooldown < 0) {
    return null;
  }
  if (typeof value.delivery !== 'string' || !DELIVERY_SET.has(value.delivery)) return null;
  if (typeof value.function !== 'string' || !FUNCTION_SET.has(value.function)) return null;
  if (typeof value.medium !== 'string' || !MEDIUM_SET.has(value.medium)) return null;
  if (id.startsWith('manifest-style-')) {
    const signal = id.slice('manifest-style-'.length);
    if (!Object.prototype.hasOwnProperty.call(GENERATED_PLAYSTYLE_COMPONENTS, signal)) return null;
    const expected = GENERATED_PLAYSTYLE_COMPONENTS[signal as GeneratedPlaystyleSignal];
    if (value.delivery !== expected.delivery
      || value.function !== expected.function
      || value.medium !== expected.medium
      || value.constitutionSignature !== `playstyle:${signal}`) {
      return null;
    }
  } else {
    const expectedId = `manifest-${value.medium}-${value.function}-${value.delivery}`;
    if (id !== expectedId) return null;
    const expectedSignature = `${value.medium}:${value.function}:${value.delivery}`;
    if (value.constitutionSignature !== expectedSignature) return null;
  }
  if (typeof value.manifestedAt !== 'number' || !Number.isFinite(value.manifestedAt)) return null;

  return {
    id: id as GeneratedAbilityId,
    abilityId: id as GeneratedAbilityId,
    name: value.name,
    desc: value.desc,
    cooldown: value.cooldown,
    delivery: value.delivery as GeneratedAbilityDelivery,
    function: value.function as GeneratedAbilityFunction,
    medium: value.medium as GeneratedAbilityMedium,
    constitutionSignature: value.constitutionSignature,
    manifestedAt: value.manifestedAt,
  };
}

export function isGeneratedVersusAbilityCard(
  value: unknown,
): value is GeneratedVersusAbilityCard {
  return readGeneratedVersusAbilityCard(value) !== null;
}

/**
 * Select one stored manifestation for a specific encounter.
 *
 * IDs are sorted before indexing so storage order cannot change the result.
 * Any repeated persisted ID is excluded entirely: even one valid record is
 * not authoritative when another record claims the same identity.
 */
export function selectGeneratedVersusEncounterCard(
  values: readonly unknown[],
  encounterOrdinal: number,
): GeneratedVersusAbilityCard | null {
  const idCounts = new Map<string, number>();
  const validById = new Map<string, GeneratedVersusAbilityCard>();

  for (const value of values) {
    if (isRecord(value)
      && typeof value.id === 'string'
      && value.id.startsWith('manifest-')) {
      idCounts.set(value.id, (idCounts.get(value.id) ?? 0) + 1);
    }
    const card = readGeneratedVersusAbilityCard(value);
    if (card) validById.set(card.id, card);
  }

  const candidates = [...validById.values()]
    .filter((card) => idCounts.get(card.id) === 1)
    .sort((left, right) => left.id < right.id ? -1 : left.id > right.id ? 1 : 0);
  if (candidates.length === 0) return null;

  const ordinal = Number.isFinite(encounterOrdinal)
    ? Math.trunc(encounterOrdinal)
    : 0;
  const index = ((ordinal % candidates.length) + candidates.length) % candidates.length;
  return candidates[index] ?? null;
}

export function generatedVersusAbilityIsPractical(
  card: GeneratedVersusAbilityCard,
  context: AbilityBoardContext,
): boolean {
  if (card.function === 'ward') {
    return (context.shieldCharges ?? 0) < (context.maxShieldCharges ?? 3);
  }
  if (card.function === 'restore') return context.playerHp < context.playerMaxHp;
  return context.mode === 'vs'
    ? Boolean(context.opponent?.present)
    : context.enemies.length > 0;
}

function generatedPriority(
  card: GeneratedVersusAbilityCard,
  context: AbilityBoardContext,
): number {
  const functionPriority: Record<GeneratedAbilityFunction, number> = {
    restore: 82,
    ward: 78,
    reveal: 74,
    inhibit: 72,
    rupture: 70,
    impulse: 66,
    adapt: 62,
  };
  const missingHp = Math.max(0, context.playerMaxHp - context.playerHp);
  const pressure = Math.max(0, context.pendingThreats ?? 0);
  const boardPressure = context.mode === 'vs'
    ? Number(Boolean(context.opponent?.present))
    : context.enemies.length;
  return functionPriority[card.function]
    + (card.function === 'restore' ? missingHp * 5 : 0)
    + (card.function === 'ward' ? pressure * 3 : 0)
    + (card.delivery === 'field' ? Math.min(6, boardPressure * 2) : 0);
}

function seededCardTieBreak(id: string, seed: number): number {
  let hash = (seed | 0) ^ 0x85ebca6b;
  for (let index = 0; index < id.length; index += 1) {
    hash = Math.imul(hash ^ id.charCodeAt(index), 0xc2b2ae35);
    hash ^= hash >>> 13;
  }
  return hash >>> 0;
}

/** Deterministic practical selection for explicit generated cards. */
export function selectGeneratedVersusAbilities(
  cards: readonly GeneratedVersusAbilityCard[],
  context: AbilityBoardContext,
  seed: number,
  size: number,
): GeneratedVersusAbilityCard[] {
  const limit = Math.max(0, Math.trunc(size));
  if (limit === 0) return [];
  return cards
    .filter((card) => generatedVersusAbilityIsPractical(card, context))
    .sort((left, right) => {
      const priority = generatedPriority(right, context) - generatedPriority(left, context);
      if (priority !== 0) return priority;
      return seededCardTieBreak(left.id, seed) - seededCardTieBreak(right.id, seed);
    })
    .slice(0, limit);
}

function mediumMatches(
  medium: GeneratedAbilityMedium,
  context: VersusAbilityContext,
): boolean {
  if (medium === 'kinetic') return true;
  const traits = new Set((context.opponentTraits ?? []).map((trait) => trait.toLowerCase()));
  const movement = context.opponentMovement?.toLowerCase() ?? '';
  const element = context.opponentElement?.toLowerCase() ?? '';
  const entity = context.opponentEntityType?.toLowerCase() ?? '';
  if (medium === 'signal') {
    return traits.has('cyber') || traits.has('machine')
      || entity === 'synthetic' || entity === 'mechanical' || element === 'voltaic';
  }
  if (medium === 'thermal') return element === 'thermal' || element === 'cryo';
  if (medium === 'phase') {
    return traits.has('phase') || traits.has('spectral')
      || movement === 'spectral' || element === 'void' || element === 'radiant';
  }
  if (medium === 'fluid') {
    return traits.has('aquatic') || entity === 'fluidic'
      || movement === 'aquatic' || element === 'corrosive';
  }
  return traits.has('botanical') || entity === 'organic'
    || entity === 'botanical' || element === 'bloom';
}

const DELIVERY_TARGETING: Record<GeneratedAbilityDelivery, VersusAbilityTargeting> = {
  projector: 'target-lane',
  field: 'all-lanes',
  shell: 'opponent',
  weave: 'opponent',
  aperture: 'target-lane',
  pulse: 'opponent',
};

function generatedStatus(
  id: VersusStatusIntent['id'],
  duration: number,
  magnitude = 1,
): VersusStatusIntent {
  return {
    id,
    target: 'opponent',
    duration: clamp(duration, 0, VERSUS_ABILITY_LIMITS.maxStatusDuration),
    magnitude,
  };
}

/**
 * Resolves the actual stored delivery/function/medium tuple.
 *
 * The function supplies the gameplay operation, delivery supplies its target
 * geometry, and medium records whether the opponent matched the preferred
 * affinity. Generated cards intentionally fall back to the opponent when an
 * affinity is absent, matching their player-side "if none, target any" rule.
 */
export function resolveGeneratedVersusAbilityEffect(
  card: GeneratedVersusAbilityCard,
  context: VersusAbilityContext,
  rank = 1,
): GeneratedVersusAbilityOutcome {
  const exact = readGeneratedVersusAbilityCard(card);
  if (!exact) {
    throw new Error('Invalid generated versus ability definition; no fallback is permitted.');
  }
  const boundedRank = Math.round(clamp(rank, 1, 5));
  const affinityMatched = mediumMatches(exact.medium, context);
  const targeting = exact.function === 'ward' || exact.function === 'restore'
    ? 'self'
    : DELIVERY_TARGETING[exact.delivery];
  const base: GeneratedVersusAbilityOutcome = {
    abilityId: exact.id,
    components: {
      delivery: exact.delivery,
      function: exact.function,
      medium: exact.medium,
    },
    affinityMatched,
    targeting,
    summary: `${exact.medium} ${exact.function} via ${exact.delivery}${affinityMatched ? ' (affinity)' : ' (fallback target)'}`,
    casterHpDelta: 0,
    opponentHpDelta: 0,
    casterShieldDelta: 0,
    opponentShieldDelta: 0,
    opponentFireDelay: 0,
    opponentMoveDelay: 0,
    opponentCardDelay: 0,
    casterColumnDelta: 0,
    opponentColumnDelta: 0,
    projectiles: [],
    statuses: [],
    integrityMultiplier: 1,
    refreshHand: false,
  };

  switch (exact.function) {
    case 'rupture':
      return {
        ...base,
        opponentHpDelta: -Math.min(
          VERSUS_ABILITY_LIMITS.maxDirectDamage,
          1 + boundedRank,
        ),
      };
    case 'inhibit':
      return {
        ...base,
        opponentFireDelay: clamp(0.35 + boundedRank * 0.08, 0, VERSUS_ABILITY_LIMITS.maxFireDelay),
        opponentMoveDelay: clamp(0.3 + boundedRank * 0.08, 0, VERSUS_ABILITY_LIMITS.maxMoveDelay),
        opponentCardDelay: clamp(0.2 + boundedRank * 0.06, 0, VERSUS_ABILITY_LIMITS.maxCardDelay),
        statuses: [generatedStatus('time-slow', 2 + boundedRank, 0.72 - boundedRank * 0.06)],
      };
    case 'impulse':
      return {
        ...base,
        opponentColumnDelta: Math.min(
          VERSUS_ABILITY_LIMITS.maxColumnDelta,
          Math.max(1, Math.ceil((0.65 + boundedRank * 0.28) / 1.2)),
        ),
        opponentMoveDelay: clamp(0.25 + boundedRank * 0.05, 0, VERSUS_ABILITY_LIMITS.maxMoveDelay),
        statuses: [generatedStatus('staggered', 0.5 + boundedRank * 0.15)],
      };
    case 'ward': {
      const room = Math.max(0, context.caster.maxShields - context.caster.shields);
      return {
        ...base,
        casterShieldDelta: Math.min(
          room,
          VERSUS_ABILITY_LIMITS.maxShieldDelta,
          1 + Math.floor(boundedRank / 2),
        ),
      };
    }
    case 'restore': {
      const missing = Math.max(0, context.caster.maxHp - context.caster.hp);
      return {
        ...base,
        casterHpDelta: Math.min(
          missing,
          VERSUS_ABILITY_LIMITS.maxRecovery,
          1 + Math.ceil(boundedRank / 2),
        ),
      };
    }
    case 'reveal':
      return {
        ...base,
        opponentColumnDelta: Math.min(
          VERSUS_ABILITY_LIMITS.maxColumnDelta,
          Math.max(0, Math.round(0.35 * boundedRank)),
        ),
        opponentFireDelay: clamp(0.25 + boundedRank * 0.08, 0, VERSUS_ABILITY_LIMITS.maxFireDelay),
        opponentCardDelay: clamp(0.3 + boundedRank * 0.08, 0, VERSUS_ABILITY_LIMITS.maxCardDelay),
        statuses: [generatedStatus('revealed', 2 + boundedRank)],
      };
    case 'adapt':
      return {
        ...base,
        opponentRow: (lane(context.opponent.row) + 1) % 3,
        opponentMoveDelay: clamp(0.25 + boundedRank * 0.04, 0, VERSUS_ABILITY_LIMITS.maxMoveDelay),
        statuses: [generatedStatus('lane-scrambled', 1 + boundedRank * 0.4)],
      };
  }
}

function cloneCombatant(
  combatant: VersusBossAbilityCombatantState,
): VersusBossAbilityCombatantState {
  return { ...combatant };
}

function cloneRuntimeState(
  current: VersusBossAbilityRuntimeState,
): VersusBossAbilityRuntimeState {
  return {
    npc: cloneCombatant(current.npc),
    player: cloneCombatant(current.player),
    npcStatusRuntime: {
      timers: { ...current.npcStatusRuntime.timers },
      caster: {
        windows: { ...current.npcStatusRuntime.caster.windows },
        barrierCharges: current.npcStatusRuntime.caster.barrierCharges,
        pierceCharges: current.npcStatusRuntime.caster.pierceCharges,
        refreshHand: current.npcStatusRuntime.caster.refreshHand,
      },
      opponent: {
        windows: { ...current.npcStatusRuntime.opponent.windows },
        traits: { ...current.npcStatusRuntime.opponent.traits },
      },
      appliedStatusIds: [...current.npcStatusRuntime.appliedStatusIds],
    },
    npcHandRefreshRequested: current.npcHandRefreshRequested,
    npcIntegrityMultiplier: current.npcIntegrityMultiplier,
  };
}

function generatedResolverContext(
  state: VersusBossAbilityRuntimeState,
  metadata: VersusBossAbilityMetadata,
): VersusAbilityContext {
  return {
    caster: {
      hp: state.npc.hp,
      maxHp: state.npc.maxHp,
      shields: state.npc.shields,
      maxShields: state.npc.maxShields,
      row: state.npc.row,
      column: 3 + state.npc.column,
    },
    opponent: {
      hp: state.player.hp,
      maxHp: state.player.maxHp,
      shields: state.player.shields,
      maxShields: state.player.maxShields,
      row: state.player.row,
      column: state.player.column,
    },
    ...(metadata.playerTraits === undefined ? {} : { opponentTraits: metadata.playerTraits }),
    ...(metadata.playerMovement === undefined ? {} : { opponentMovement: metadata.playerMovement }),
    ...(metadata.playerElement === undefined ? {} : { opponentElement: metadata.playerElement }),
    ...(metadata.playerEntityType === undefined ? {} : { opponentEntityType: metadata.playerEntityType }),
    ...(metadata.playerFusionLevel === undefined ? {} : { opponentFusionLevel: metadata.playerFusionLevel }),
    ...(metadata.playerMutationCount === undefined ? {} : { opponentMutationCount: metadata.playerMutationCount }),
    distance: metadata.distance
      ?? Math.abs(3 + state.npc.column - state.player.column),
  };
}

/** Apply one generated card with the NPC in the caster role. */
export function executeGeneratedVersusBossAbility(
  card: GeneratedVersusAbilityCard,
  current: VersusBossAbilityRuntimeState,
  metadata: VersusBossAbilityMetadata = {},
  rank = 1,
): GeneratedVersusBossAbilityExecution {
  const outcome = resolveGeneratedVersusAbilityEffect(
    card,
    generatedResolverContext(current, metadata),
    rank,
  );
  const state = cloneRuntimeState(current);

  state.npc.hp += outcome.casterHpDelta;
  state.npc.shields += outcome.casterShieldDelta;
  state.player.shields = clamp(
    state.player.shields + outcome.opponentShieldDelta,
    0,
    state.player.maxShields,
  );

  const vulnerability = state.npcStatusRuntime.opponent.windows.vulnerability?.magnitude ?? 1;
  const directDamage = Math.min(
    VERSUS_ABILITY_LIMITS.maxDirectDamage,
    Math.ceil(Math.max(0, -outcome.opponentHpDelta) * Math.max(1, vulnerability)),
  );
  if (directDamage > 0) {
    if (state.player.shields > 0) state.player.shields -= 1;
    else state.player.hp -= directDamage;
  } else if (outcome.opponentHpDelta > 0) {
    state.player.hp += outcome.opponentHpDelta;
  }

  state.player.fireCooldown = Math.max(state.player.fireCooldown, outcome.opponentFireDelay);
  state.player.moveCooldown = Math.max(state.player.moveCooldown, outcome.opponentMoveDelay);
  state.player.cardCooldown = Math.max(state.player.cardCooldown, outcome.opponentCardDelay);
  state.npc.column -= outcome.casterColumnDelta;
  state.player.column -= outcome.opponentColumnDelta;
  if (outcome.casterRow !== undefined) state.npc.row = outcome.casterRow;
  if (outcome.opponentRow !== undefined) state.player.row = outcome.opponentRow;

  const mergedStatus = applyVersusStatusIntents(outcome.statuses, state.npcStatusRuntime);
  state.npcStatusRuntime = {
    ...mergedStatus,
    caster: {
      ...mergedStatus.caster,
      barrierCharges: 0,
      refreshHand: false,
    },
  };
  state.npcHandRefreshRequested = state.npcHandRefreshRequested || outcome.refreshHand;
  state.npcIntegrityMultiplier = Math.max(state.npcIntegrityMultiplier, outcome.integrityMultiplier);

  state.npc.hp = clamp(state.npc.hp, 0, state.npc.maxHp);
  state.npc.shields = clamp(state.npc.shields, 0, state.npc.maxShields);
  state.player.hp = clamp(state.player.hp, 0, state.player.maxHp);
  state.player.shields = clamp(state.player.shields, 0, state.player.maxShields);
  state.npc.row = lane(state.npc.row);
  state.npc.column = lane(state.npc.column);
  state.player.row = lane(state.player.row);
  state.player.column = lane(state.player.column);

  return { state, outcome, projectiles: [] };
}

/** Competitive hard ceiling retained for generated rupture resolution. */
export const GENERATED_VERSUS_DAMAGE_CEILING = COMPETITIVE_RULESET.maxAbilityDamage;
