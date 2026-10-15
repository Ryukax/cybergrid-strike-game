import type { VersusBossCounterpart } from './versus-boss-counterpart';
import {
  advanceLordAlphaEquipLatency,
  beginLordAlphaEquipLatency,
  createChronaNpcSignatureState,
  createEchoNpcSignatureState,
  createLordAlphaEquipLatencyState,
  executeChronaNpcCommand,
  executeEchoNpcChannelEvent,
  executeEchoNpcCommand,
  recordChronaNpcPosition,
  resolveAssemblyNpcSignature,
  resolveExactRivalSignatureCommand,
  resolveLordAlphaNpcAction,
  type BossSignatureCell,
  type BossSignatureCommandIndex,
  type ChronaNpcSignatureEffect,
  type ChronaNpcSignatureState,
  type EchoNpcCommandEffect,
  type EchoNpcChannelEffect,
  type EchoNpcChannelEvent,
  type EchoNpcSignatureState,
  type ExactRivalSignatureCommand,
  type LordAlphaNpcAction,
  type LordAlphaEquipLatencyState,
  type ShadowCloneSignatureCommand,
} from './versus-boss-signature';

/**
 * Opponent-owned state for exact signature mechanics. Keeping this separate
 * from the NPC strategy state prevents Chrona/Echo history, clone protection,
 * and Lord Alpha's action cursor from aliasing the player's runtime.
 */
export interface VersusBossSignatureRuntimeState {
  readonly chrona: ChronaNpcSignatureState | null;
  readonly echo: EchoNpcSignatureState | null;
  readonly shadowCloneCharges: number;
  readonly lordAlphaActionIndex: number;
  readonly lordAlphaEquip: LordAlphaEquipLatencyState;
}

export type VersusBossSignatureDispatch =
  | {
      readonly kind: 'rival-command';
      readonly state: VersusBossSignatureRuntimeState;
      readonly command: ExactRivalSignatureCommand;
      readonly authoredEffect?: ChronaNpcSignatureEffect | EchoNpcCommandEffect;
    }
  | {
      readonly kind: 'shadow-clone';
      readonly state: VersusBossSignatureRuntimeState;
      readonly command: ShadowCloneSignatureCommand;
      readonly grantedCharges: 2;
    }
  | {
      readonly kind: 'canonical-ability';
      readonly state: VersusBossSignatureRuntimeState;
      readonly action: Extract<LordAlphaNpcAction, { kind: 'canonical-ability' }>;
    }
  | {
      readonly kind: 'equip-latency';
      readonly state: VersusBossSignatureRuntimeState;
      readonly action: Extract<LordAlphaNpcAction, { kind: 'equip-latency' }>;
      readonly effect: LordAlphaEquipLatencyState;
    }
  | {
      /** @deprecated Compatibility shape for integrations predating real equip state. */
      readonly kind: 'presentation-only';
      readonly state: VersusBossSignatureRuntimeState;
      readonly action: Extract<LordAlphaNpcAction, { kind: 'equip-latency' }>;
    }
  | {
      readonly kind: 'echo-channel';
      readonly state: VersusBossSignatureRuntimeState;
      readonly ownerSkinId: 'echo' | 'assembly';
      readonly actionId: 'brink' | 'drain';
      readonly effect: EchoNpcChannelEffect;
    }
  | {
      readonly kind: 'unavailable';
      readonly state: VersusBossSignatureRuntimeState;
      readonly reason: string;
    };

export interface DispatchVersusBossSignatureOptions {
  readonly counterpart: VersusBossCounterpart;
  readonly state: VersusBossSignatureRuntimeState;
  readonly commandIndex: BossSignatureCommandIndex;
  readonly currentPosition: BossSignatureCell;
  readonly rewindHeld?: boolean;
  /** Explicit Brink/Drain lifecycle input; valid only for Echo signatures. */
  readonly echoEvent?: EchoNpcChannelEvent;
  /** Advances presentation/state clocks without delaying any NPC control. */
  readonly elapsedMs?: number;
}

export function createVersusBossSignatureRuntimeState(
  counterpart: VersusBossCounterpart,
  origin: BossSignatureCell,
): VersusBossSignatureRuntimeState {
  const skillId = counterpart.signature.kind === 'boss-skill'
    ? counterpart.signature.id
    : null;
  return {
    chrona: skillId === 'chrono' ? createChronaNpcSignatureState(origin) : null,
    echo: skillId === 'echo' ? createEchoNpcSignatureState() : null,
    shadowCloneCharges: 0,
    lordAlphaActionIndex: 0,
    lordAlphaEquip: createLordAlphaEquipLatencyState(),
  };
}

export function advanceVersusBossSignatureTime(
  state: VersusBossSignatureRuntimeState,
  elapsedMs: number,
): VersusBossSignatureRuntimeState {
  const lordAlphaEquip = advanceLordAlphaEquipLatency(state.lordAlphaEquip, elapsedMs);
  return lordAlphaEquip === state.lordAlphaEquip ? state : { ...state, lordAlphaEquip };
}

/** Record only the NPC Chrona timeline. Other personas return the same state. */
export function recordVersusBossSignaturePosition(
  state: VersusBossSignatureRuntimeState,
  position: BossSignatureCell,
): VersusBossSignatureRuntimeState {
  if (!state.chrona) return state;
  const chrona = recordChronaNpcPosition(state.chrona, position);
  return chrona === state.chrona ? state : { ...state, chrona };
}

function assemblyOwned(
  command: ExactRivalSignatureCommand,
  counterpart: VersusBossCounterpart,
): ExactRivalSignatureCommand {
  return counterpart.skinId === 'assembly'
    ? { ...command, ownerSkinId: 'assembly' }
    : command;
}

function grantShadowClones(
  state: VersusBossSignatureRuntimeState,
  command: ShadowCloneSignatureCommand,
): VersusBossSignatureDispatch {
  // The playable Shadow Clone creates the north/south pair. The NPC-side
  // equivalent represents those two bodies as two verified hit interceptions.
  const grantedCharges = 2 as const;
  return {
    kind: 'shadow-clone',
    command,
    grantedCharges,
    state: { ...state, shadowCloneCharges: grantedCharges },
  };
}

/**
 * Resolve the selected persona's exact signature. This function deliberately
 * has no generic signature or unrelated-card fallback.
 */
export function dispatchVersusBossSignature(
  options: DispatchVersusBossSignatureOptions,
): VersusBossSignatureDispatch {
  const { counterpart, commandIndex, currentPosition } = options;
  const signature = counterpart.signature;
  const runtimeState = advanceVersusBossSignatureTime(
    options.state,
    options.elapsedMs ?? 0,
  );

  if (options.echoEvent
    && !(signature.kind === 'boss-skill' && signature.id === 'echo')) {
    return {
      kind: 'unavailable',
      state: runtimeState,
      reason: 'Brink and Drain belong only to the Echo signature.',
    };
  }

  if (signature.kind === 'none') {
    return { kind: 'unavailable', state: runtimeState, reason: 'This NPC has no signature.' };
  }
  if (signature.kind === 'unsupported') {
    return {
      kind: 'unavailable',
      state: runtimeState,
      reason: `Unsupported NPC signature selection: ${signature.id}`,
    };
  }
  if (signature.kind === 'assembly-shadow') {
    const command = resolveAssemblyNpcSignature(signature.id, commandIndex);
    if (command.kind !== 'shadow-clone') {
      return { kind: 'unavailable', state: runtimeState, reason: 'Assembly signature mismatch.' };
    }
    return grantShadowClones(runtimeState, command);
  }
  if (signature.kind === 'lord-alpha') {
    if (signature.actionIds.length === 0) {
      return { kind: 'unavailable', state: runtimeState, reason: 'Lord Alpha has no actions.' };
    }
    const actionIndex = runtimeState.lordAlphaActionIndex % signature.actionIds.length;
    const action = resolveLordAlphaNpcAction(signature.actionIds[actionIndex]);
    let state = {
      ...runtimeState,
      lordAlphaActionIndex: (actionIndex + 1) % signature.actionIds.length,
    };
    if (action.kind === 'shadow-clone') return grantShadowClones(state, action);
    if (action.kind === 'canonical-ability') {
      return { kind: 'canonical-ability', state, action };
    }
    const telegraphedActionId = signature.actionIds[state.lordAlphaActionIndex];
    const lordAlphaEquip = beginLordAlphaEquipLatency(
      state.lordAlphaEquip,
      action.durationMs,
      telegraphedActionId,
    );
    state = { ...state, lordAlphaEquip };
    return { kind: 'equip-latency', state, action, effect: lordAlphaEquip };
  }

  if (signature.id === 'chrono') {
    const currentState = runtimeState.chrona
      ?? createChronaNpcSignatureState(currentPosition);
    const result = executeChronaNpcCommand(
      currentState,
      commandIndex,
      currentPosition,
      options.rewindHeld ?? true,
    );
    return {
      kind: 'rival-command',
      state: { ...runtimeState, chrona: result.state },
      command: assemblyOwned(result.command, counterpart),
      authoredEffect: result.effect,
    };
  }

  if (signature.id === 'echo') {
    const currentState = runtimeState.echo ?? createEchoNpcSignatureState();
    if (options.echoEvent) {
      const result = executeEchoNpcChannelEvent(currentState, options.echoEvent);
      const actionId = options.echoEvent.kind.includes('brink') ? 'brink' : 'drain';
      return {
        kind: 'echo-channel',
        state: { ...runtimeState, echo: result.state },
        ownerSkinId: counterpart.skinId === 'assembly' ? 'assembly' : 'echo',
        actionId,
        effect: result.effect,
      };
    }
    if (currentState.channel !== 'idle') {
      const heldChannel = currentState.channel === 'brink' ? 'Brink' : 'Drain';
      return {
        kind: 'unavailable',
        state: runtimeState,
        reason: `Echo ${heldChannel} is held; release it before TRACE, REPLAY, or DISPLACE.`,
      };
    }
    const result = executeEchoNpcCommand(currentState, commandIndex, currentPosition);
    return {
      kind: 'rival-command',
      state: { ...runtimeState, echo: result.state },
      command: assemblyOwned(result.command, counterpart),
      authoredEffect: result.effect,
    };
  }

  const command = counterpart.skinId === 'assembly'
    ? resolveAssemblyNpcSignature(signature.id, commandIndex)
    : resolveExactRivalSignatureCommand(signature.id, commandIndex);
  if (command.kind !== 'rival-command') {
    return { kind: 'unavailable', state: runtimeState, reason: 'NPC signature mismatch.' };
  }
  return { kind: 'rival-command', state: runtimeState, command };
}

export function consumeVersusBossShadowClone(
  state: VersusBossSignatureRuntimeState,
): VersusBossSignatureRuntimeState {
  return state.shadowCloneCharges <= 0
    ? state
    : { ...state, shadowCloneCharges: state.shadowCloneCharges - 1 };
}
