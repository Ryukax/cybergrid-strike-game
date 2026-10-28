import {
  composePracticalAbilityHand,
  evaluateAbility,
  type AbilityBoardContext,
} from './ability-system';
import { ABILITY_LOOKUP } from './constants';
import {
  generatedVersusAbilityIsPractical,
  readGeneratedVersusAbilityCard,
  selectGeneratedVersusAbilities,
  type GeneratedAbilityId,
  type GeneratedVersusAbilityCard,
} from './generated-versus-ability';
import {
  LORD_ALPHA_SKILL_PREVIEW_ACTIONS,
  LORD_ALPHA_SKIN_ID,
  type LordAlphaSkillActionId,
} from './lord-alpha';
import {
  BOSS_SIGNATURE_COMMANDS,
  type BossSkillId,
} from './npc-skill-presentation';
import {
  isVersusAbilityId,
  type VersusAbilityId,
} from './versus-ability-resolver';

export const VERSUS_BOSS_ABILITY_HAND_SIZE = 3;

const BOSS_SKILL_IDS = new Set<string>(Object.keys(BOSS_SIGNATURE_COMMANDS));

export type AssemblyCounterpartSkillId = 'shadow' | BossSkillId;
export type VersusBossAbilityId = VersusAbilityId | GeneratedAbilityId;

export type VersusBossAbilityCard =
  | {
    readonly kind: 'canonical';
    readonly id: VersusAbilityId;
  }
  | {
    readonly kind: 'generated';
    readonly id: GeneratedAbilityId;
    readonly definition: GeneratedVersusAbilityCard;
  };

export type VersusBossSignature =
  | {
    readonly kind: 'none';
    readonly id: null;
    readonly actionIds: readonly [];
  }
  | {
    readonly kind: 'boss-skill';
    readonly id: BossSkillId;
    readonly actionIds: (typeof BOSS_SIGNATURE_COMMANDS)[BossSkillId];
  }
  | {
    readonly kind: 'assembly-shadow';
    readonly id: 'shadow';
    readonly actionIds: readonly ['shadow-clone'];
  }
  | {
    readonly kind: 'lord-alpha';
    readonly id: typeof LORD_ALPHA_SKIN_ID;
    readonly actionIds: readonly LordAlphaSkillActionId[];
  }
  | {
    /** Invalid persisted Assembly selections are exposed, never substituted. */
    readonly kind: 'unsupported';
    readonly id: string;
    readonly actionIds: readonly [];
  };

export interface VersusBossAbilityHandState {
  /** Exact subset of the selected preset; generated entries require definitions. */
  readonly pool: readonly VersusBossAbilityId[];
  /** Immutable definitions captured with this encounter's generated cards. */
  readonly generatedCards: Readonly<Partial<Record<GeneratedAbilityId, GeneratedVersusAbilityCard>>>;
  /** Unsupported persisted entries remain visible to the integration layer. */
  readonly unsupportedAbilityIds: readonly string[];
  readonly hand: readonly VersusBossAbilityId[];
  readonly previousHand: readonly VersusBossAbilityId[];
  /** Cards not yet surfaced during the current deal cycle. */
  readonly dealCycleRemainingAbilityIds: readonly VersusBossAbilityId[];
  /** Cards cast or explicitly retired from the current hand. */
  readonly usedAbilityIds: readonly VersusBossAbilityId[];
  readonly cooldowns: Readonly<Record<string, number>>;
  readonly dealIndex: number;
}

export interface VersusBossCounterpart {
  /** Visual/persona identity. It never selects or owns a hidden card loadout. */
  readonly skinId: string;
  readonly signature: VersusBossSignature;
  /** NPC-owned snapshot; later player preset edits cannot mutate this duel. */
  readonly abilities: VersusBossAbilityHandState;
}

export interface CreateVersusBossCounterpartOptions {
  readonly skinId: string;
  /** The actual playable preset selected for this opponent. */
  readonly playableAbilityPreset: readonly string[];
  /** Stored manifestations referenced by the preset. IDs without one stay unsupported. */
  readonly generatedAbilities?: readonly unknown[];
  /** Used only when skinId is `assembly`; omitted means Shadow Clone. */
  readonly assemblySkillId?: string | null;
}

export interface DealVersusBossAbilityHandOptions {
  readonly context: AbilityBoardContext;
  readonly seed: number;
  readonly size?: number;
}

export interface SelectVersusBossReadyAbilityOptions {
  readonly context: AbilityBoardContext;
  readonly seed: number;
}

export interface VersusBossAbilityUse {
  readonly counterpart: VersusBossCounterpart;
  readonly abilityId: VersusBossAbilityId;
  readonly card: VersusBossAbilityCard;
  readonly cooldown: number;
}

export function isBossSkillId(value: string): value is BossSkillId {
  return BOSS_SKILL_IDS.has(value);
}

function resolveSignature(
  skinId: string,
  assemblySkillId?: string | null,
): VersusBossSignature {
  if (skinId === 'assembly') {
    const selected = assemblySkillId ?? 'shadow';
    if (selected === 'shadow') {
      return {
        kind: 'assembly-shadow',
        id: 'shadow',
        actionIds: ['shadow-clone'],
      };
    }
    if (isBossSkillId(selected)) {
      return {
        kind: 'boss-skill',
        id: selected,
        actionIds: BOSS_SIGNATURE_COMMANDS[selected],
      };
    }
    return { kind: 'unsupported', id: selected, actionIds: [] };
  }

  if (skinId === LORD_ALPHA_SKIN_ID) {
    return {
      kind: 'lord-alpha',
      id: LORD_ALPHA_SKIN_ID,
      actionIds: LORD_ALPHA_SKILL_PREVIEW_ACTIONS.map(({ id }) => id),
    };
  }

  if (isBossSkillId(skinId)) {
    return {
      kind: 'boss-skill',
      id: skinId,
      actionIds: BOSS_SIGNATURE_COMMANDS[skinId],
    };
  }

  return { kind: 'none', id: null, actionIds: [] };
}

function snapshotPreset(
  playableAbilityPreset: readonly string[],
  generatedAbilities: readonly unknown[],
): {
  pool: VersusBossAbilityId[];
  generatedCards: Partial<Record<GeneratedAbilityId, GeneratedVersusAbilityCard>>;
  unsupportedAbilityIds: string[];
} {
  const pool: VersusBossAbilityId[] = [];
  const generatedCards: Partial<Record<GeneratedAbilityId, GeneratedVersusAbilityCard>> = {};
  const unsupportedAbilityIds: string[] = [];
  const seen = new Set<string>();
  const ambiguous = new Set<string>();

  for (const candidate of generatedAbilities) {
    const card = readGeneratedVersusAbilityCard(candidate);
    if (!card) continue;
    if (generatedCards[card.id]) {
      delete generatedCards[card.id];
      ambiguous.add(card.id);
      continue;
    }
    if (!ambiguous.has(card.id)) generatedCards[card.id] = card;
  }

  for (const abilityId of playableAbilityPreset) {
    if (seen.has(abilityId)) continue;
    seen.add(abilityId);
    if (isVersusAbilityId(abilityId)) pool.push(abilityId);
    else if (abilityId.startsWith('manifest-')
      && !ambiguous.has(abilityId)
      && generatedCards[abilityId as GeneratedAbilityId]) {
      pool.push(abilityId as GeneratedAbilityId);
    }
    else unsupportedAbilityIds.push(abilityId);
  }

  return { pool, generatedCards, unsupportedAbilityIds };
}

export function createVersusBossCounterpart(
  options: CreateVersusBossCounterpartOptions,
): VersusBossCounterpart {
  const { pool, generatedCards, unsupportedAbilityIds } = snapshotPreset(
    options.playableAbilityPreset,
    options.generatedAbilities ?? [],
  );
  return {
    skinId: options.skinId,
    signature: resolveSignature(options.skinId, options.assemblySkillId),
    abilities: {
      pool,
      generatedCards,
      unsupportedAbilityIds,
      hand: [],
      previousHand: [],
      dealCycleRemainingAbilityIds: [...pool],
      usedAbilityIds: [],
      cooldowns: Object.fromEntries(pool.map((abilityId) => [abilityId, 0])),
      dealIndex: 0,
    },
  };
}

function practicalReadyAbilityIds(
  counterpart: VersusBossCounterpart,
  context: AbilityBoardContext,
): VersusBossAbilityId[] {
  return counterpart.abilities.pool.filter((abilityId) => {
    if ((counterpart.abilities.cooldowns[abilityId] ?? 0) > 0) return false;
    if (isVersusAbilityId(abilityId)) {
      return evaluateAbility(abilityId, context).valid;
    }
    const card = counterpart.abilities.generatedCards[abilityId as GeneratedAbilityId];
    return Boolean(card && generatedVersusAbilityIsPractical(card, context));
  });
}

function preferOutsidePreviousHand(
  candidates: readonly VersusBossAbilityId[],
  previousHand: ReadonlySet<VersusBossAbilityId>,
  size: number,
): VersusBossAbilityId[] {
  const fresh = candidates.filter((abilityId) => !previousHand.has(abilityId));
  return fresh.length >= Math.min(size, candidates.length)
    ? fresh
    : [...candidates];
}

function selectPracticalHand(
  counterpart: VersusBossCounterpart,
  candidates: readonly VersusBossAbilityId[],
  context: AbilityBoardContext,
  seed: number,
  size: number,
): VersusBossAbilityId[] {
  const limit = Math.max(0, Math.min(VERSUS_BOSS_ABILITY_HAND_SIZE, Math.trunc(size)));
  if (limit === 0) return [];
  const canonicalCandidates = candidates.filter(isVersusAbilityId);
  const generatedCandidates = candidates
    .map((abilityId) => counterpart.abilities.generatedCards[abilityId as GeneratedAbilityId])
    .filter((card): card is GeneratedVersusAbilityCard => Boolean(card));

  if (limit === 1) {
    const canonical = composePracticalAbilityHand({
      availableAbilityIds: canonicalCandidates,
      context,
      seed,
      size: 1,
    }).map(({ id }) => id).find(isVersusAbilityId);
    const generated = selectGeneratedVersusAbilities(
      generatedCandidates,
      context,
      seed,
      1,
    )[0]?.id;
    // A one-card mixed hand must not be permanently owned by either class.
    // The seed makes the choice reproducible while allowing both the exact
    // generated definition and the practical canonical card to surface.
    const selected = canonical && generated
      ? ((seed & 1) === 0 ? generated : canonical)
      : (generated ?? canonical);
    return selected ? [selected] : [];
  }

  const firstGenerated = selectGeneratedVersusAbilities(
    generatedCandidates,
    context,
    seed,
    canonicalCandidates.length > 0 ? 1 : limit,
  );
  const canonicalHand = composePracticalAbilityHand({
    availableAbilityIds: canonicalCandidates,
    context,
    seed,
    size: Math.max(1, limit - firstGenerated.length),
  }).map(({ id }) => id).filter(isVersusAbilityId);
  const remainingGenerated = selectGeneratedVersusAbilities(
    generatedCandidates.filter((card) => !firstGenerated.some(({ id }) => id === card.id)),
    context,
    seed ^ 0x27d4eb2d,
    Math.max(0, limit - firstGenerated.length - canonicalHand.length),
  );
  return [
    ...firstGenerated.map(({ id }) => id),
    ...canonicalHand,
    ...remainingGenerated.map(({ id }) => id),
  ].slice(0, limit);
}

/**
 * Deals from only this opponent's selected preset. No boss profile, skin, or
 * fallback list may inject unrelated cards into the hand. Practical, ready
 * cards remaining in the current coverage cycle are always selected before
 * cards already surfaced during that cycle.
 */
export function dealVersusBossAbilityHand(
  counterpart: VersusBossCounterpart,
  options: DealVersusBossAbilityHandOptions,
): VersusBossCounterpart {
  const size = Math.max(
    1,
    Math.min(VERSUS_BOSS_ABILITY_HAND_SIZE, Math.trunc(options.size ?? VERSUS_BOSS_ABILITY_HAND_SIZE)),
  );
  const practicalReady = practicalReadyAbilityIds(counterpart, options.context);
  const pool = new Set(counterpart.abilities.pool);
  const storedRemaining = counterpart.abilities.dealCycleRemainingAbilityIds
    .filter((abilityId) => pool.has(abilityId));
  const cycleRemaining = storedRemaining.length > 0
    ? storedRemaining
    : [...counterpart.abilities.pool];
  const cycleRemainingSet = new Set(cycleRemaining);
  const previous = new Set(counterpart.abilities.hand);
  const pending = practicalReady.filter((abilityId) => cycleRemainingSet.has(abilityId));
  const priorityCandidates = preferOutsidePreviousHand(pending, previous, size);
  const priorityHand = selectPracticalHand(
    counterpart,
    priorityCandidates,
    options.context,
    options.seed,
    size,
  );
  const selected = new Set(priorityHand);
  const repeatCandidates = practicalReady.filter((abilityId) => (
    !cycleRemainingSet.has(abilityId) && !selected.has(abilityId)
  ));
  const repeatHand = selectPracticalHand(
    counterpart,
    preferOutsidePreviousHand(repeatCandidates, previous, size - priorityHand.length),
    options.context,
    options.seed ^ 0x5f3759df,
    size - priorityHand.length,
  );
  const hand: VersusBossAbilityId[] = [
    ...priorityHand,
    ...repeatHand,
  ].slice(0, size);
  const dealt = new Set(hand);

  return {
    ...counterpart,
    abilities: {
      ...counterpart.abilities,
      hand,
      previousHand: [...counterpart.abilities.hand],
      dealCycleRemainingAbilityIds: cycleRemaining.filter((abilityId) => !dealt.has(abilityId)),
      usedAbilityIds: [],
      dealIndex: counterpart.abilities.dealIndex + 1,
    },
  };
}

/**
 * Re-evaluate the dealt hand at cast time. Resource and counter conditions can
 * change after a deal; a Boss must not spend Heal at full integrity or fire a
 * reactive card after the triggering pressure has already passed.
 */
export function selectVersusBossReadyAbility(
  counterpart: VersusBossCounterpart,
  options: SelectVersusBossReadyAbilityOptions,
): VersusBossAbilityId | null {
  const ready = counterpart.abilities.hand.filter((abilityId) => (
    !counterpart.abilities.usedAbilityIds.includes(abilityId)
    && (counterpart.abilities.cooldowns[abilityId] ?? 0) <= 0
  ));
  const canonicalCandidate = composePracticalAbilityHand({
    availableAbilityIds: ready.filter(isVersusAbilityId),
    context: options.context,
    seed: options.seed,
    size: 1,
  })[0]?.id;
  const canonicalSelected = canonicalCandidate && isVersusAbilityId(canonicalCandidate)
    ? canonicalCandidate
    : undefined;
  const generatedSelected = selectGeneratedVersusAbilities(
    ready
      .map((abilityId) => counterpart.abilities.generatedCards[abilityId as GeneratedAbilityId])
      .filter((card): card is GeneratedVersusAbilityCard => Boolean(card)),
    options.context,
    options.seed,
    1,
  )[0]?.id;
  if (!canonicalSelected) return generatedSelected ?? null;
  if (!generatedSelected) return canonicalSelected;
  // Alternate deterministic ownership when both card classes are practical;
  // neither class silently replaces the other.
  return (options.seed & 1) === 0 ? generatedSelected : canonicalSelected;
}

export function versusBossAbilityCard(
  counterpart: VersusBossCounterpart,
  abilityId: string,
): VersusBossAbilityCard | null {
  if (isVersusAbilityId(abilityId)) return { kind: 'canonical', id: abilityId };
  const generated = abilityId.startsWith('manifest-')
    ? counterpart.abilities.generatedCards[abilityId as GeneratedAbilityId]
    : undefined;
  return generated
    ? { kind: 'generated', id: generated.id, definition: generated }
    : null;
}

/** Marks one actual card as used and starts that card's authored cooldown. */
export function useVersusBossAbility(
  counterpart: VersusBossCounterpart,
  abilityId: string,
): VersusBossAbilityUse | null {
  const card = versusBossAbilityCard(counterpart, abilityId);
  if (!card
    || !counterpart.abilities.hand.includes(card.id)
    || counterpart.abilities.usedAbilityIds.includes(card.id)
    || (counterpart.abilities.cooldowns[card.id] ?? 0) > 0) {
    return null;
  }

  const cooldown = card.kind === 'canonical'
    ? ABILITY_LOOKUP[card.id]?.cooldown
    : card.definition.cooldown;
  if (typeof cooldown !== 'number') return null;

  return {
    abilityId: card.id,
    card,
    cooldown,
    counterpart: {
      ...counterpart,
      abilities: {
        ...counterpart.abilities,
        usedAbilityIds: [...counterpart.abilities.usedAbilityIds, card.id],
        cooldowns: {
          ...counterpart.abilities.cooldowns,
          [card.id]: cooldown,
        },
      },
    },
  };
}

export function advanceVersusBossAbilityCooldowns(
  counterpart: VersusBossCounterpart,
  elapsedSeconds: number,
): VersusBossCounterpart {
  const elapsed = Math.max(0, Number.isFinite(elapsedSeconds) ? elapsedSeconds : 0);
  if (elapsed === 0) return counterpart;

  const cooldowns: Record<string, number> = {};
  for (const abilityId of counterpart.abilities.pool) {
    cooldowns[abilityId] = Math.max(
      0,
      (counterpart.abilities.cooldowns[abilityId] ?? 0) - elapsed,
    );
  }

  return {
    ...counterpart,
    abilities: { ...counterpart.abilities, cooldowns },
  };
}

/**
 * Retires every uncast card in the current hand without applying its effect or
 * cooldown. This is the pure escape hatch for a hand whose live conditions
 * have made every remaining card temporarily impractical. The exhausted hand
 * can then be redealt while deal-cycle coverage continues forward.
 */
export function retireVersusBossAbilityHand(
  counterpart: VersusBossCounterpart,
): VersusBossCounterpart {
  const used = new Set(counterpart.abilities.usedAbilityIds);
  const remaining = counterpart.abilities.hand.filter((abilityId) => !used.has(abilityId));
  if (remaining.length === 0) return counterpart;

  return {
    ...counterpart,
    abilities: {
      ...counterpart.abilities,
      usedAbilityIds: [...counterpart.abilities.usedAbilityIds, ...remaining],
    },
  };
}

export function versusBossAbilityHandIsExhausted(
  counterpart: VersusBossCounterpart,
): boolean {
  return counterpart.abilities.hand.length > 0
    && counterpart.abilities.hand.every((abilityId) => (
      counterpart.abilities.usedAbilityIds.includes(abilityId)
    ));
}
