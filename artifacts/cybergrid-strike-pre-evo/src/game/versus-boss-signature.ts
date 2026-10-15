import { COMPETITIVE_RULESET } from './competitive-balance';
import {
  LORD_ALPHA_SKILL_PREVIEW_ACTIONS,
  resolveLordAlphaSkillAction,
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

export type BossSignatureCommandIndex = 0 | 1 | 2;
export type BossSignatureCommandAction = 'primary' | 'alternate' | 'defend';
export type AssemblyNpcSkillId = 'shadow' | BossSkillId;

export interface BossSignatureCell {
  readonly col: number;
  readonly row: number;
}

export interface BossSignatureTarget {
  readonly id: string;
  readonly col: number;
  readonly row: number;
}

export interface ExactRivalSignatureCommand {
  readonly kind: 'rival-command';
  /** The skin performing the command. Assembly remains the owner when it delegates. */
  readonly ownerSkinId: BossSkillId | 'assembly';
  /** The exact authored signature being executed; never a doctrine-based substitute. */
  readonly skillId: BossSkillId;
  readonly commandIndex: BossSignatureCommandIndex;
  readonly action: BossSignatureCommandAction;
  readonly label: string;
}

export interface ShadowCloneSignatureCommand {
  readonly kind: 'shadow-clone';
  readonly ownerSkinId: 'lord-alpha' | 'assembly';
  readonly actionId: 'shadow-clone';
  readonly label: 'Shadow Clone';
}

export type LordAlphaNpcAction =
  | {
      readonly kind: 'canonical-ability';
      readonly ownerSkinId: 'lord-alpha';
      readonly actionId: LordAlphaSkillActionId;
      readonly label: string;
      readonly abilityId: VersusAbilityId;
    }
  | ShadowCloneSignatureCommand
  | {
      readonly kind: 'equip-latency';
      readonly ownerSkinId: 'lord-alpha';
      readonly actionId: 'equip';
      readonly label: 'Equip Latency';
      readonly durationMs: number;
      /** Equip remains a telegraphed form change, never an input lock. */
      readonly controlsLive: true;
    };

const COMMAND_ACTIONS = ['primary', 'alternate', 'defend'] as const;
const BOSS_SKILL_IDS = new Set<string>(Object.keys(BOSS_SIGNATURE_COMMANDS));

function boundedCell(cell: BossSignatureCell): BossSignatureCell {
  return {
    col: Math.max(0, Math.min(2, Math.round(cell.col))),
    row: Math.max(0, Math.min(2, Math.round(cell.row))),
  };
}

function sameCell(left: BossSignatureCell, right: BossSignatureCell): boolean {
  return left.col === right.col && left.row === right.row;
}

function assertCommandIndex(value: number): asserts value is BossSignatureCommandIndex {
  if (!Number.isInteger(value) || value < 0 || value > 2) {
    throw new Error(`Invalid boss signature command index: ${value}`);
  }
}

export function isBossSkillId(value: string): value is BossSkillId {
  return BOSS_SKILL_IDS.has(value);
}

/**
 * Resolve the exact named command belonging to a boss skin. This deliberately
 * has no adaptive/generic fallback: a bad identity is an integration error.
 */
export function resolveExactRivalSignatureCommand(
  skillId: string,
  commandIndex: number,
  ownerSkinId: BossSkillId | 'assembly' = skillId as BossSkillId,
): ExactRivalSignatureCommand {
  if (!isBossSkillId(skillId)) {
    throw new Error(`No NPC signature counterpart registered for skin: ${skillId}`);
  }
  assertCommandIndex(commandIndex);
  if (ownerSkinId !== 'assembly' && ownerSkinId !== skillId) {
    throw new Error(`${ownerSkinId} cannot execute ${skillId}'s signature`);
  }
  return {
    kind: 'rival-command',
    ownerSkinId,
    skillId,
    commandIndex,
    action: COMMAND_ACTIONS[commandIndex],
    label: BOSS_SIGNATURE_COMMANDS[skillId][commandIndex],
  };
}

/**
 * Assembly retains the exact saved selection. `shadow` invokes Shadow Clone;
 * every other supported value delegates to that specific skin signature.
 */
export function resolveAssemblyNpcSignature(
  selectedSkillId: string,
  commandIndex = 0,
): ExactRivalSignatureCommand | ShadowCloneSignatureCommand {
  if (selectedSkillId === 'shadow') {
    return {
      kind: 'shadow-clone',
      ownerSkinId: 'assembly',
      actionId: 'shadow-clone',
      label: 'Shadow Clone',
    };
  }
  if (!isBossSkillId(selectedSkillId)) {
    throw new Error(`Assembly has no selected NPC signature counterpart: ${selectedSkillId}`);
  }
  return resolveExactRivalSignatureCommand(selectedSkillId, commandIndex, 'assembly');
}

/** Resolve one of Lord Alpha's nine canonical actions without substituting it. */
export function resolveLordAlphaNpcAction(actionId: string): LordAlphaNpcAction {
  const action = LORD_ALPHA_SKILL_PREVIEW_ACTIONS.find(({ id }) => id === actionId);
  if (!action) {
    throw new Error(`No Lord Alpha NPC counterpart registered for action: ${actionId}`);
  }
  if (action.id === 'shadow-clone') {
    return {
      kind: 'shadow-clone',
      ownerSkinId: 'lord-alpha',
      actionId: 'shadow-clone',
      label: 'Shadow Clone',
    };
  }
  if (action.id === 'equip') {
    return {
      kind: 'equip-latency',
      ownerSkinId: 'lord-alpha',
      actionId: 'equip',
      label: 'Equip Latency',
      durationMs: action.presentation.durationMs,
      controlsLive: true,
    };
  }
  if (!action.mechanicId || !isVersusAbilityId(action.mechanicId)) {
    throw new Error(`Lord Alpha action ${action.id} has no canonical versus mechanic`);
  }
  return {
    kind: 'canonical-ability',
    ownerSkinId: 'lord-alpha',
    actionId: action.id,
    label: action.label,
    abilityId: action.mechanicId,
  };
}

export function resolveLordAlphaNpcBankSlot(
  bankIndex: number,
  slotIndex: number,
): LordAlphaNpcAction {
  const action = resolveLordAlphaSkillAction(bankIndex, slotIndex);
  if (!action) {
    throw new Error(`Invalid Lord Alpha NPC skill slot: ${slotIndex}`);
  }
  return resolveLordAlphaNpcAction(action.id);
}

export type LordAlphaEquipPhase = 'ready' | 'equipping' | 'equipped';

/**
 * Equip Latency is real opponent-owned state, but never a hidden stat change.
 * Its tactical value is readable commitment: while geometry assembles the
 * following signature is exposed, while movement and attacks remain live.
 */
export interface LordAlphaEquipLatencyState {
  readonly phase: LordAlphaEquipPhase;
  readonly elapsedMs: number;
  readonly durationMs: number;
  readonly telegraphedActionId: LordAlphaSkillActionId | null;
  readonly controlsLive: true;
  readonly movementLocked: false;
  readonly attacksLocked: false;
  readonly damageMultiplier: 1;
  readonly defenseMultiplier: 1;
  readonly hitboxMultiplier: 1;
}

export function createLordAlphaEquipLatencyState(): LordAlphaEquipLatencyState {
  return {
    phase: 'ready',
    elapsedMs: 0,
    durationMs: 0,
    telegraphedActionId: null,
    controlsLive: true,
    movementLocked: false,
    attacksLocked: false,
    damageMultiplier: 1,
    defenseMultiplier: 1,
    hitboxMultiplier: 1,
  };
}

export function beginLordAlphaEquipLatency(
  state: LordAlphaEquipLatencyState,
  durationMs: number,
  telegraphedActionId: LordAlphaSkillActionId,
): LordAlphaEquipLatencyState {
  const boundedDuration = Number.isFinite(durationMs)
    ? Math.max(1, Math.floor(durationMs))
    : 1;
  return {
    ...state,
    phase: 'equipping',
    elapsedMs: 0,
    durationMs: boundedDuration,
    telegraphedActionId,
  };
}

export function advanceLordAlphaEquipLatency(
  state: LordAlphaEquipLatencyState,
  elapsedMs: number,
): LordAlphaEquipLatencyState {
  if (state.phase !== 'equipping') return state;
  const step = Number.isFinite(elapsedMs) ? Math.max(0, elapsedMs) : 0;
  if (step === 0) return state;
  const elapsed = Math.min(state.durationMs, state.elapsedMs + step);
  if (elapsed < state.durationMs) return { ...state, elapsedMs: elapsed };
  return {
    ...state,
    phase: 'equipped',
    elapsedMs: state.durationMs,
    telegraphedActionId: null,
  };
}

export interface ChronaNpcSignatureState {
  readonly queueOrigins: readonly BossSignatureCell[];
  readonly recordedPositions: readonly BossSignatureCell[];
  readonly positionIndex: number;
  readonly rewinding: boolean;
}

export type ChronaNpcSignatureEffect =
  | { readonly kind: 'queue'; readonly origin: BossSignatureCell }
  | { readonly kind: 'step'; readonly destination: BossSignatureCell }
  | { readonly kind: 'rewind'; readonly phase: 'begin' | 'release' }
  | { readonly kind: 'unavailable'; readonly reason: string };

export interface ChronaNpcSignatureResult {
  readonly state: ChronaNpcSignatureState;
  readonly command: ExactRivalSignatureCommand;
  readonly effect: ChronaNpcSignatureEffect;
}

export function createChronaNpcSignatureState(
  origin: BossSignatureCell,
): ChronaNpcSignatureState {
  return {
    queueOrigins: [],
    recordedPositions: [boundedCell(origin)],
    positionIndex: 0,
    rewinding: false,
  };
}

/** Record Chrona's own movement history; the opponent timeline is not reused. */
export function recordChronaNpcPosition(
  state: ChronaNpcSignatureState,
  position: BossSignatureCell,
): ChronaNpcSignatureState {
  const next = boundedCell(position);
  const previous = state.recordedPositions.at(-1);
  if (previous && sameCell(previous, next)) return state;
  const recordedPositions = [...state.recordedPositions, next]
    .slice(-COMPETITIVE_RULESET.signatureMaxPlacements);
  return {
    ...state,
    recordedPositions,
    positionIndex: recordedPositions.length - 1,
  };
}

export function executeChronaNpcCommand(
  state: ChronaNpcSignatureState,
  commandIndex: BossSignatureCommandIndex,
  currentPosition: BossSignatureCell,
  rewindHeld = true,
): ChronaNpcSignatureResult {
  const command = resolveExactRivalSignatureCommand('chrono', commandIndex);
  if (commandIndex === 0) {
    const origin = boundedCell(currentPosition);
    return {
      command,
      state: {
        ...state,
        queueOrigins: [...state.queueOrigins, origin]
          .slice(-COMPETITIVE_RULESET.signatureMaxPlacements),
      },
      effect: { kind: 'queue', origin },
    };
  }
  if (commandIndex === 1) {
    if (state.recordedPositions.length < 2) {
      return {
        state,
        command,
        effect: { kind: 'unavailable', reason: 'Chrona must record another position first.' },
      };
    }
    const positionIndex = (state.positionIndex + 1) % state.recordedPositions.length;
    const destination = state.recordedPositions[positionIndex];
    return {
      command,
      state: { ...state, positionIndex },
      effect: { kind: 'step', destination },
    };
  }
  return {
    command,
    state: { ...state, rewinding: rewindHeld },
    effect: { kind: 'rewind', phase: rewindHeld ? 'begin' : 'release' },
  };
}

export type EchoNpcChannel = 'idle' | 'brink' | 'drain';

export interface EchoNpcSignatureState {
  readonly traces: readonly BossSignatureCell[];
  readonly channel: EchoNpcChannel;
  readonly lockedTargets: readonly BossSignatureTarget[];
}

export type EchoNpcCommandEffect =
  | { readonly kind: 'trace'; readonly origin: BossSignatureCell }
  | { readonly kind: 'replay'; readonly origins: readonly BossSignatureCell[] }
  | { readonly kind: 'displace'; readonly destination: BossSignatureCell }
  | { readonly kind: 'unavailable'; readonly reason: string };

export interface EchoNpcCommandResult {
  readonly state: EchoNpcSignatureState;
  readonly command: ExactRivalSignatureCommand;
  readonly effect: EchoNpcCommandEffect;
}

export const ECHO_BRINK_PARTITION_FRAMES = [2, 3, 5] as const;

export function createEchoNpcSignatureState(): EchoNpcSignatureState {
  return { traces: [], channel: 'idle', lockedTargets: [] };
}

export function executeEchoNpcCommand(
  state: EchoNpcSignatureState,
  commandIndex: BossSignatureCommandIndex,
  currentPosition: BossSignatureCell,
): EchoNpcCommandResult {
  const command = resolveExactRivalSignatureCommand('echo', commandIndex);
  const current = boundedCell(currentPosition);
  if (commandIndex === 0) {
    const traces = [
      ...state.traces.filter((saved) => !sameCell(saved, current)),
      current,
    ].slice(-COMPETITIVE_RULESET.signatureMaxPlacements);
    return {
      command,
      state: { ...state, traces },
      effect: { kind: 'trace', origin: current },
    };
  }
  if (commandIndex === 1) {
    const origins = state.traces.length > 0 ? state.traces : [current];
    return { state, command, effect: { kind: 'replay', origins } };
  }
  const destination = state.traces.at(-1);
  if (!destination) {
    return {
      state,
      command,
      effect: { kind: 'unavailable', reason: 'Echo must trace an origin first.' },
    };
  }
  return { state, command, effect: { kind: 'displace', destination } };
}

export interface EchoNpcChannelPresentation {
  readonly movementLocked: true;
  readonly attacksHeld: true;
  readonly bracing: true;
  readonly jitter: boolean;
  readonly holdFinalAttackFrame: boolean;
}

export function beginEchoNpcChannel(
  state: EchoNpcSignatureState,
  channel: Exclude<EchoNpcChannel, 'idle'>,
): EchoNpcSignatureState {
  return {
    ...state,
    channel,
    // A channel switch is a new hold. Brink locks can never leak into Drain.
    lockedTargets: [],
  };
}

export function echoNpcChannelPresentation(
  state: EchoNpcSignatureState,
): EchoNpcChannelPresentation | null {
  if (state.channel === 'idle') return null;
  return {
    movementLocked: true,
    attacksHeld: true,
    bracing: true,
    jitter: state.channel === 'brink',
    holdFinalAttackFrame: state.channel === 'drain',
  };
}

export interface EchoNpcBrinkLockResult {
  readonly state: EchoNpcSignatureState;
  readonly hpAfter: number;
  readonly hpCost: 0 | 1;
  readonly accepted: boolean;
  readonly reason?: string;
}

/** Brink spends one NPC HP per unique lock and can never reduce it below one. */
export function lockEchoNpcBrinkTarget(
  state: EchoNpcSignatureState,
  target: BossSignatureTarget,
  currentHp: number,
): EchoNpcBrinkLockResult {
  if (state.channel !== 'brink') {
    return { state, hpAfter: currentHp, hpCost: 0, accepted: false, reason: 'Brink is not held.' };
  }
  if (state.lockedTargets.some(({ id }) => id === target.id)) {
    return { state, hpAfter: currentHp, hpCost: 0, accepted: false, reason: 'Target already locked.' };
  }
  if (currentHp <= 1) {
    return { state, hpAfter: 1, hpCost: 0, accepted: false, reason: 'Brink HP floor reached.' };
  }
  return {
    state: { ...state, lockedTargets: [...state.lockedTargets, { ...target }] },
    hpAfter: Math.max(1, currentHp - 1),
    hpCost: 1,
    accepted: true,
  };
}

export interface EchoNpcBrinkStrike {
  readonly target: BossSignatureTarget;
  readonly fixedIntercept: true;
  readonly simultaneous: true;
  readonly frames: typeof ECHO_BRINK_PARTITION_FRAMES;
}

export interface EchoNpcBrinkReleaseResult {
  readonly state: EchoNpcSignatureState;
  readonly strikes: readonly EchoNpcBrinkStrike[];
}

/** Release manifests one stationary 2 -> 3 -> 5 partition swing per lock. */
export function releaseEchoNpcBrink(
  state: EchoNpcSignatureState,
): EchoNpcBrinkReleaseResult {
  if (state.channel !== 'brink') return { state, strikes: [] };
  return {
    state: { ...state, channel: 'idle', lockedTargets: [] },
    strikes: state.lockedTargets.map((target) => ({
      target,
      fixedIntercept: true,
      simultaneous: true,
      frames: ECHO_BRINK_PARTITION_FRAMES,
    })),
  };
}

export interface EchoNpcDrainCollisionResult {
  readonly state: EchoNpcSignatureState;
  readonly collisionAccepted: boolean;
  readonly damageDealt: number;
  readonly requestedHealing: number;
  readonly appliedHealing: number;
  readonly hpAfter: number;
}

/** Drain heals only from a verified collision, for the damage actually dealt. */
export function resolveEchoNpcDrainCollision(
  state: EchoNpcSignatureState,
  damageDealt: number,
  currentHp: number,
  maxHp: number,
): EchoNpcDrainCollisionResult {
  const verifiedDamage = Number.isFinite(damageDealt)
    ? Math.max(0, Math.floor(damageDealt))
    : 0;
  const accepted = state.channel === 'drain' && verifiedDamage > 0;
  const requestedHealing = accepted ? verifiedDamage : 0;
  const boundedMaxHp = Number.isFinite(maxHp) ? Math.max(1, Math.floor(maxHp)) : 1;
  const hpBefore = Number.isFinite(currentHp)
    ? Math.max(0, Math.min(boundedMaxHp, Math.floor(currentHp)))
    : 0;
  const hpAfter = Math.min(boundedMaxHp, hpBefore + requestedHealing);
  return {
    state,
    collisionAccepted: accepted,
    damageDealt: verifiedDamage,
    requestedHealing,
    appliedHealing: hpAfter - hpBefore,
    hpAfter,
  };
}

export function releaseEchoNpcDrain(
  state: EchoNpcSignatureState,
): EchoNpcSignatureState {
  return state.channel === 'drain' ? { ...state, channel: 'idle' } : state;
}

/** Events deliberately separated from Echo's TRACE / REPLAY / DISPLACE bank. */
export type EchoNpcChannelEvent =
  | { readonly kind: 'begin-brink' }
  | {
      readonly kind: 'lock-brink-target';
      readonly target: BossSignatureTarget;
      readonly currentHp: number;
    }
  | { readonly kind: 'release-brink' }
  | { readonly kind: 'begin-drain' }
  | {
      readonly kind: 'drain-collision';
      readonly damageDealt: number;
      readonly currentHp: number;
      readonly maxHp: number;
    }
  | { readonly kind: 'release-drain' };

export type EchoNpcChannelEffect =
  | {
      readonly kind: 'brink-hold';
      readonly presentation: EchoNpcChannelPresentation;
    }
  | ({ readonly kind: 'brink-lock' } & Omit<EchoNpcBrinkLockResult, 'state'>)
  | {
      readonly kind: 'brink-release';
      readonly strikes: readonly EchoNpcBrinkStrike[];
    }
  | {
      readonly kind: 'drain-hold';
      readonly presentation: EchoNpcChannelPresentation;
    }
  | ({ readonly kind: 'drain-collision' } & Omit<EchoNpcDrainCollisionResult, 'state'>)
  | { readonly kind: 'drain-release' };

export interface EchoNpcChannelEventResult {
  readonly state: EchoNpcSignatureState;
  readonly effect: EchoNpcChannelEffect;
}

/**
 * Dispatch one complete Brink/Drain lifecycle event. Callers cannot accidentally
 * substitute a normal ability card, and Drain healing retains collision authority.
 */
export function executeEchoNpcChannelEvent(
  state: EchoNpcSignatureState,
  event: EchoNpcChannelEvent,
): EchoNpcChannelEventResult {
  if (event.kind === 'begin-brink') {
    const next = beginEchoNpcChannel(state, 'brink');
    return {
      state: next,
      effect: {
        kind: 'brink-hold',
        presentation: echoNpcChannelPresentation(next)!,
      },
    };
  }
  if (event.kind === 'lock-brink-target') {
    const result = lockEchoNpcBrinkTarget(state, event.target, event.currentHp);
    const { state: next, ...effect } = result;
    return { state: next, effect: { kind: 'brink-lock', ...effect } };
  }
  if (event.kind === 'release-brink') {
    const result = releaseEchoNpcBrink(state);
    return {
      state: result.state,
      effect: { kind: 'brink-release', strikes: result.strikes },
    };
  }
  if (event.kind === 'begin-drain') {
    const next = beginEchoNpcChannel(state, 'drain');
    return {
      state: next,
      effect: {
        kind: 'drain-hold',
        presentation: echoNpcChannelPresentation(next)!,
      },
    };
  }
  if (event.kind === 'drain-collision') {
    const result = resolveEchoNpcDrainCollision(
      state,
      event.damageDealt,
      event.currentHp,
      event.maxHp,
    );
    const { state: next, ...effect } = result;
    return { state: next, effect: { kind: 'drain-collision', ...effect } };
  }
  const next = releaseEchoNpcDrain(state);
  return { state: next, effect: { kind: 'drain-release' } };
}
