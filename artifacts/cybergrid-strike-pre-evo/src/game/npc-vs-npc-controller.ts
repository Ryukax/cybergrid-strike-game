import {
  bossStrategyProfile,
  chooseVersusBasicAttackAim,
  chooseVersusMovementPosition,
  chooseVersusNpcSignature,
  isVersusNpcAbilityPractical,
  rankVersusNpcAbilities,
  resolveVersusNpcAbility,
  shouldVersusAbilityPrepareSignature,
  type VersusAbilityPlan,
  type VersusBasicAttackAim,
  type VersusNpcContext,
  type VersusSignaturePlan,
} from './npc-strategy';

export interface LeftNpcVersusControllerInput {
  /** The spectator mode has been selected and this controller owns the left side. */
  active: boolean;
  /** The duel is in its running phase rather than a menu or terminal phase. */
  running: boolean;
  paused: boolean;
  selfDead: boolean;
  opponentDead: boolean;
  skillId: string;
  selfHp: number;
  opponentHp: number;
  maxHp: number;
  selfShields: number;
  maxShields: number;
  selfRow: number;
  opponentRow: number;
  /** Local left-half column: 0 is rear and 2 is nearest the center line. */
  selfCol: number;
  selfFireCooldown: number;
  selfMoveCooldown: number;
  selfCardCooldown: number;
  opponentFireCooldown: number;
  opponentMoveCooldown: number;
  incomingByRow: readonly [number, number, number];
  step: number;
  seed: number;
  /** Number of authored loadout slots currently available, clamped to 0..3. */
  cardCount: number;
  /**
   * Optional exact owned ability pool. When supplied, every entry is eligible
   * for selection and `cardCount` is used only by the profile fallback.
   */
  abilityIds?: readonly string[];
  /** One lifetime-relative use count for each owned ability slot. */
  abilityUseCounts: readonly number[];
  cardsReady: boolean;
  cardProgress: number;
  signatureMode?: number;
  signatureCharges?: number;
  signaturePlacements?: readonly number[];
  signatureOriginRow?: number;
  signatureOriginCol?: number;
  signatureLastCommand?: number;
  signatureObjectiveCommand?: number;
  signatureCommandUses?: readonly [number, number, number];
  signatureAvailable?: boolean;
  /** False for Lord Alpha, Shadow Clone, and other non-boss-skill signatures. */
  signaturePlanAvailable?: boolean;
  signatureCooldownReady?: boolean;
  signatureWindowActive?: boolean;
  signaturePrepConsumed?: boolean;
}

export interface LeftNpcVersusMoveDecision {
  row: number;
  col: number;
}

export interface LeftNpcVersusControllerDecision {
  enabled: boolean;
  move: LeftNpcVersusMoveDecision | null;
  aim: VersusBasicAttackAim | null;
  fire: boolean;
  /** Zero-based slot in `abilityIds`, or in the authored profile fallback. */
  cardSlot: number | null;
  ability: VersusAbilityPlan | null;
  /** Present only when this frame should open the authored signature window. */
  openSignature?: true;
  /** Present when the chosen card is the one allowed setup beat for this window. */
  preparesSignature?: true;
}

function clampBoardIndex(value: number): number {
  return Math.max(0, Math.min(2, Math.round(value)));
}

function moveOneCell(current: number, requested: number): number {
  const from = clampBoardIndex(current);
  const to = clampBoardIndex(requested);
  return clampBoardIndex(from + Math.sign(to - from));
}

function clampCooldown(value: number, interval: number): number {
  const safeInterval = Math.max(0, interval);
  return Math.max(0, Math.min(safeInterval, value));
}

/** Converts the left NPC's countdown into the fill-style progress used by strategy. */
export function npcVersusAbilityProgress(
  cooldown: number,
  interval: number,
): number {
  const safeInterval = Math.max(0, interval);
  if (safeInterval === 0) return 1;
  return 1 - clampCooldown(cooldown, safeInterval) / safeInterval;
}

/**
 * Applies card pressure to an NPC countdown. Human card timers fill upward,
 * whereas this cooldown counts down, so disruption must add remaining time.
 */
export function delayNpcVersusAbilityCooldown(
  cooldown: number,
  delay: number,
  interval: number,
): number {
  return clampCooldown(cooldown + Math.max(0, delay), interval);
}

/** Maps a combat-plan fill timer back into the left NPC's countdown clock. */
export function npcVersusCooldownFromCardTimer(
  cardTimer: number,
  interval: number,
): number {
  const safeInterval = Math.max(0, interval);
  return clampCooldown(safeInterval - cardTimer, safeInterval);
}

function normalizedSlotCount(slotCount: number): number {
  if (!Number.isFinite(slotCount)) return 0;
  return Math.max(0, Math.trunc(slotCount));
}

/**
 * Sanitizes and rebases per-slot usage without changing its ordering.
 * Rebasing the common minimum keeps a long-running NPC session bounded while
 * preserving which practical components have been used least often.
 */
export function normalizeNpcVersusAbilityUseCounts(
  counts: readonly number[],
  slotCount: number,
): number[] {
  const size = normalizedSlotCount(slotCount);
  const normalized = Array.from({ length: size }, (_, slot) => {
    const value = counts[slot] ?? 0;
    return Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
  });
  if (normalized.length === 0) return normalized;
  const minimum = Math.min(...normalized);
  return minimum > 0
    ? normalized.map((count) => count - minimum)
    : normalized;
}

/** Returns a new normalized usage array after one authored slot executes. */
export function recordNpcVersusAbilityUse(
  counts: readonly number[],
  slot: number,
  slotCount: number,
): number[] {
  const normalized = normalizeNpcVersusAbilityUseCounts(counts, slotCount);
  const selectedSlot = Math.trunc(slot);
  if (!Number.isFinite(slot) || selectedSlot < 0 || selectedSlot >= normalized.length) {
    return normalized;
  }
  const next = [...normalized];
  next[selectedSlot] = Math.min(Number.MAX_SAFE_INTEGER, next[selectedSlot] + 1);
  return normalizeNpcVersusAbilityUseCounts(next, next.length);
}

/**
 * The authored NPC strategy treats local column 0 as its forward/center-line
 * column. The left combatant uses the opposite local orientation, so only the
 * depth axis is mirrored. Rows are shared and must never be mirrored.
 */
export function leftColumnToStrategyColumn(column: number): number {
  return 2 - clampBoardIndex(column);
}

export function strategyColumnToLeftColumn(column: number): number {
  return 2 - clampBoardIndex(column);
}

function seededVariation(seed: number, step: number, skillId: string): number {
  let hash = (Math.trunc(seed) ^ Math.imul(Math.trunc(step), 0x45d9f3b)) >>> 0;
  for (const character of skillId) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash / 0x1_0000_0000;
}

export function createLeftNpcStrategyContext(
  input: LeftNpcVersusControllerInput,
): VersusNpcContext {
  return {
    skillId: input.skillId,
    npcHp: input.selfHp,
    playerHp: input.opponentHp,
    maxHp: Math.max(1, input.maxHp),
    npcShields: input.selfShields,
    maxShields: Math.max(0, input.maxShields),
    npcRow: clampBoardIndex(input.selfRow),
    playerRow: clampBoardIndex(input.opponentRow),
    npcCol: leftColumnToStrategyColumn(input.selfCol),
    incomingByRow: input.incomingByRow,
    playerFireCooldown: Math.max(0, input.opponentFireCooldown),
    playerMoveCooldown: Math.max(0, input.opponentMoveCooldown),
    cardProgress: Math.max(0, Math.min(1, input.cardProgress)),
    step: Math.trunc(input.step),
    signatureMode: input.signatureWindowActive === false ? 0 : input.signatureMode ?? 0,
    signatureCharges: input.signatureWindowActive === false ? 0 : input.signatureCharges ?? 0,
    signaturePlacements: input.signatureWindowActive === false
      ? []
      : input.signaturePlacements ?? [],
    signatureOriginRow: clampBoardIndex(input.signatureOriginRow ?? input.selfRow),
    signatureOriginCol: leftColumnToStrategyColumn(
      input.signatureOriginCol ?? input.selfCol,
    ),
    signatureLastCommand: input.signatureWindowActive === false
      ? -1
      : input.signatureLastCommand ?? -1,
    signatureObjectiveCommand: input.signatureWindowActive === false
      ? -1
      : input.signatureObjectiveCommand ?? -1,
    signatureCommandUses: input.signatureCommandUses,
  };
}

function mirrorPlacementForLeft(placement: number): number {
  const strategyColumn = Math.max(0, Math.min(2, Math.floor(placement / 3)));
  const row = clampBoardIndex(placement % 3);
  return strategyColumnToLeftColumn(strategyColumn) * 3 + row;
}

/**
 * Strategy plans are authored from the right-side NPC's local depth axis.
 * Mirror only column-bearing fields before applying the same plan to NPC A.
 */
export function orientVersusPlanForLeft<T extends VersusAbilityPlan | VersusSignaturePlan>(
  plan: T,
): T {
  if (!('commandIndex' in plan)) {
    return { ...plan };
  }
  return {
    ...plan,
    columnDelta: -plan.columnDelta,
    nextOriginCol: strategyColumnToLeftColumn(plan.nextOriginCol),
    nextPlacements: plan.nextPlacements.map(mirrorPlacementForLeft),
  };
}

function selectAvailableCard(
  input: LeftNpcVersusControllerInput,
  context: VersusNpcContext,
): { slot: number; plan: VersusAbilityPlan } | null {
  if (!input.cardsReady || input.selfCardCooldown > 0) return null;
  const profile = bossStrategyProfile(input.skillId);
  const cardCount = Math.max(0, Math.min(3, Math.trunc(input.cardCount)));
  const abilityIds = input.abilityIds === undefined
    ? profile.abilities.slice(0, cardCount)
    : [...input.abilityIds];
  if (abilityIds.length === 0) return null;

  const useCounts = normalizeNpcVersusAbilityUseCounts(
    input.abilityUseCounts,
    abilityIds.length,
  );
  const practical = abilityIds
    .map((abilityId, slot) => {
      const plan = resolveVersusNpcAbility(abilityId, context);
      return isVersusNpcAbilityPractical(abilityId, plan, context)
        ? { abilityId, slot, plan, useCount: useCounts[slot] ?? 0 }
        : null;
    })
    .filter((candidate): candidate is NonNullable<typeof candidate> => candidate !== null);
  if (practical.length === 0) return null;

  const rankedIds = rankVersusNpcAbilities(context).map(({ abilityId }) => abilityId);
  const scored = practical.map((candidate) => {
    const rank = rankedIds.indexOf(candidate.abilityId);
    const strategyScore = rank >= 0 ? (rankedIds.length - rank) * 3 : 0;
    return {
      ...candidate,
      // Diversity remains a soft pressure, never a veto against the card
      // that currently prepares this NPC's individual skill.
      score: strategyScore - candidate.useCount * 2.1,
    };
  });
  const bestScore = Math.max(...scored.map(({ score }) => score));
  const best = scored.filter(({ score }) => Math.abs(score - bestScore) < 0.0001);
  const offset = Math.abs(Math.trunc(input.seed) + Math.trunc(input.step)) % best.length;
  const selected = best[offset] ?? best[0];
  return selected ? { slot: selected.slot, plan: selected.plan } : null;
}

/**
 * Pure spectator-side controller for the left combatant in NPC-vs-NPC.
 * It never reads input devices or mutates the duel. The runtime may therefore
 * call it from a fixed simulation step and apply only the returned decisions.
 */
export function decideLeftNpcVersusAction(
  input: LeftNpcVersusControllerInput,
): LeftNpcVersusControllerDecision {
  const enabled = input.active
    && input.running
    && !input.paused
    && !input.selfDead
    && !input.opponentDead
    && input.selfHp > 0
    && input.opponentHp > 0;
  if (!enabled) {
    return {
      enabled: false,
      move: null,
      aim: null,
      fire: false,
      cardSlot: null,
      ability: null,
    };
  }

  const context = createLeftNpcStrategyContext(input);
  const aim = chooseVersusBasicAttackAim(context);
  const requested = chooseVersusMovementPosition(
    context,
    seededVariation(input.seed, input.step, input.skillId),
  );
  const currentRow = clampBoardIndex(input.selfRow);
  const currentCol = clampBoardIndex(input.selfCol);
  const requestedRow = moveOneCell(currentRow, requested.row);
  const requestedCol = strategyColumnToLeftColumn(requested.col);
  const nextCol = moveOneCell(currentCol, requestedCol);
  const move = input.selfMoveCooldown <= 0
    && (requestedRow !== currentRow || nextCol !== currentCol)
    ? { row: requestedRow, col: nextCol }
    : null;
  const selectedCard = selectAvailableCard(input, context);
  const signatureReady = Boolean(
    input.signatureAvailable
    && input.signatureCooldownReady
    && !input.signatureWindowActive,
  );
  const signaturePlan = (input.signaturePlanAvailable ?? input.signatureAvailable)
    ? chooseVersusNpcSignature(context)
    : null;
  const prepareSignature = Boolean(
    signatureReady
    && !input.signaturePrepConsumed
    && selectedCard
    && signaturePlan
    && shouldVersusAbilityPrepareSignature(selectedCard.plan, signaturePlan, context),
  );
  const openSignature = signatureReady && !prepareSignature;
  const ability = input.signatureWindowActive || openSignature
    ? null
    : selectedCard?.plan ?? null;

  return {
    enabled: true,
    move,
    aim,
    fire: input.selfFireCooldown <= 0 && aim.aligned,
    cardSlot: ability ? selectedCard?.slot ?? null : null,
    ability,
    ...(openSignature ? { openSignature: true as const } : {}),
    ...(prepareSignature ? { preparesSignature: true as const } : {}),
  };
}
