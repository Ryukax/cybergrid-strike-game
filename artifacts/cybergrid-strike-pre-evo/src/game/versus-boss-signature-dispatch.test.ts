import { deepStrictEqual, equal, match } from 'node:assert/strict';
import { test } from 'node:test';

import { LORD_ALPHA_SKILL_PREVIEW_ACTIONS, LORD_ALPHA_SKIN_ID } from './lord-alpha';
import { BOSS_SIGNATURE_COMMANDS } from './npc-skill-presentation';
import { createVersusBossCounterpart } from './versus-boss-counterpart';
import {
  advanceVersusBossSignatureTime,
  consumeVersusBossShadowClone,
  createVersusBossSignatureRuntimeState,
  dispatchVersusBossSignature,
  recordVersusBossSignaturePosition,
} from './versus-boss-signature-dispatch';

const ORIGIN = { col: 2, row: 1 } as const;

test('dispatcher retains all 32 boss identities and all three authored commands', () => {
  for (const [skinId, labels] of Object.entries(BOSS_SIGNATURE_COMMANDS)) {
    const counterpart = createVersusBossCounterpart({
      skinId,
      playableAbilityPreset: [],
    });
    let state = createVersusBossSignatureRuntimeState(counterpart, ORIGIN);
    labels.forEach((label, commandIndex) => {
      const result = dispatchVersusBossSignature({
        counterpart,
        state,
        commandIndex: commandIndex as 0 | 1 | 2,
        currentPosition: ORIGIN,
      });
      state = result.state;
      equal(result.kind, 'rival-command', `${skinId} command ${commandIndex}`);
      if (result.kind !== 'rival-command') return;
      equal(result.command.ownerSkinId, skinId);
      equal(result.command.skillId, skinId);
      equal(result.command.label, label);
    });
  }
});

test('Assembly Shadow Clone grants the exact two-body interception counterpart', () => {
  const counterpart = createVersusBossCounterpart({
    skinId: 'assembly',
    playableAbilityPreset: [],
    assemblySkillId: 'shadow',
  });
  const state = createVersusBossSignatureRuntimeState(counterpart, ORIGIN);
  const result = dispatchVersusBossSignature({
    counterpart,
    state,
    commandIndex: 0,
    currentPosition: ORIGIN,
  });
  equal(result.kind, 'shadow-clone');
  if (result.kind !== 'shadow-clone') return;
  equal(result.command.ownerSkinId, 'assembly');
  equal(result.grantedCharges, 2);
  equal(result.state.shadowCloneCharges, 2);
  equal(consumeVersusBossShadowClone(result.state).shadowCloneCharges, 1);
});

test('Lord Alpha cycles all nine canonical actions without a generic substitute', () => {
  const counterpart = createVersusBossCounterpart({
    skinId: LORD_ALPHA_SKIN_ID,
    playableAbilityPreset: [],
  });
  let state = createVersusBossSignatureRuntimeState(counterpart, ORIGIN);
  const actions: string[] = [];
  const kinds: string[] = [];
  for (let index = 0; index < LORD_ALPHA_SKILL_PREVIEW_ACTIONS.length; index++) {
    const result = dispatchVersusBossSignature({
      counterpart,
      state,
      commandIndex: 0,
      currentPosition: ORIGIN,
    });
    state = result.state;
    kinds.push(result.kind);
    if (result.kind === 'canonical-ability' || result.kind === 'equip-latency') {
      actions.push(result.action.actionId);
    } else if (result.kind === 'shadow-clone') {
      actions.push(result.command.actionId);
    }
  }
  deepStrictEqual(actions, LORD_ALPHA_SKILL_PREVIEW_ACTIONS.map(({ id }) => id));
  deepStrictEqual(kinds, [
    'canonical-ability', 'canonical-ability', 'canonical-ability',
    'canonical-ability', 'canonical-ability', 'shadow-clone',
    'canonical-ability', 'canonical-ability', 'equip-latency',
  ]);
  equal(state.lordAlphaActionIndex, 0, 'the authored bank wraps only after all nine actions');
  equal(state.lordAlphaEquip.phase, 'equipping');
  equal(state.lordAlphaEquip.telegraphedActionId, 'web-shot');
  equal(state.lordAlphaEquip.controlsLive, true);
  equal(state.lordAlphaEquip.damageMultiplier, 1);
  equal(state.lordAlphaEquip.defenseMultiplier, 1);
  equal(state.lordAlphaEquip.hitboxMultiplier, 1);

  state = advanceVersusBossSignatureTime(state, state.lordAlphaEquip.durationMs);
  equal(state.lordAlphaEquip.phase, 'equipped');
  equal(state.lordAlphaEquip.telegraphedActionId, null);
});

test('Chrona uses an NPC-owned history and Assembly retains ownership when delegating it', () => {
  const counterpart = createVersusBossCounterpart({
    skinId: 'assembly',
    playableAbilityPreset: [],
    assemblySkillId: 'chrono',
  });
  let state = createVersusBossSignatureRuntimeState(counterpart, ORIGIN);
  state = recordVersusBossSignaturePosition(state, { col: 1, row: 0 });
  const result = dispatchVersusBossSignature({
    counterpart,
    state,
    commandIndex: 1,
    currentPosition: { col: 1, row: 0 },
  });
  equal(result.kind, 'rival-command');
  if (result.kind !== 'rival-command') return;
  equal(result.command.ownerSkinId, 'assembly');
  equal(result.command.skillId, 'chrono');
  deepStrictEqual(result.authoredEffect, { kind: 'step', destination: ORIGIN });
});

test('Echo TRACE then DISPLACE resolves the authored destination', () => {
  const counterpart = createVersusBossCounterpart({
    skinId: 'echo',
    playableAbilityPreset: [],
  });
  let state = createVersusBossSignatureRuntimeState(counterpart, ORIGIN);
  const trace = dispatchVersusBossSignature({
    counterpart,
    state,
    commandIndex: 0,
    currentPosition: ORIGIN,
  });
  equal(trace.kind, 'rival-command');
  state = trace.state;
  const displace = dispatchVersusBossSignature({
    counterpart,
    state,
    commandIndex: 2,
    currentPosition: { col: 0, row: 2 },
  });
  equal(displace.kind, 'rival-command');
  if (displace.kind !== 'rival-command') return;
  deepStrictEqual(displace.authoredEffect, { kind: 'displace', destination: ORIGIN });
});

test('Echo Brink is dispatchable as a held lock-and-release signature lifecycle', () => {
  const counterpart = createVersusBossCounterpart({
    skinId: 'echo',
    playableAbilityPreset: [],
  });
  let state = createVersusBossSignatureRuntimeState(counterpart, ORIGIN);
  const begin = dispatchVersusBossSignature({
    counterpart,
    state,
    commandIndex: 0,
    currentPosition: ORIGIN,
    echoEvent: { kind: 'begin-brink' },
  });
  equal(begin.kind, 'echo-channel');
  if (begin.kind !== 'echo-channel') return;
  equal(begin.actionId, 'brink');
  equal(begin.effect.kind, 'brink-hold');
  if (begin.effect.kind === 'brink-hold') {
    equal(begin.effect.presentation.movementLocked, true);
    equal(begin.effect.presentation.jitter, true);
    equal(begin.effect.presentation.holdFinalAttackFrame, false);
  }

  state = begin.state;
  const lock = dispatchVersusBossSignature({
    counterpart,
    state,
    commandIndex: 0,
    currentPosition: ORIGIN,
    echoEvent: {
      kind: 'lock-brink-target',
      target: { id: 'player', col: 0, row: 2 },
      currentHp: 3,
    },
  });
  equal(lock.kind, 'echo-channel');
  if (lock.kind !== 'echo-channel') return;
  equal(lock.effect.kind, 'brink-lock');
  if (lock.effect.kind === 'brink-lock') {
    equal(lock.effect.accepted, true);
    equal(lock.effect.hpAfter, 2);
    equal(lock.effect.hpCost, 1);
  }

  const release = dispatchVersusBossSignature({
    counterpart,
    state: lock.state,
    commandIndex: 0,
    currentPosition: ORIGIN,
    echoEvent: { kind: 'release-brink' },
  });
  equal(release.kind, 'echo-channel');
  if (release.kind !== 'echo-channel') return;
  equal(release.effect.kind, 'brink-release');
  if (release.effect.kind === 'brink-release') {
    equal(release.effect.strikes.length, 1);
    deepStrictEqual(release.effect.strikes[0].frames, [2, 3, 5]);
    equal(release.effect.strikes[0].fixedIntercept, true);
    equal(release.effect.strikes[0].simultaneous, true);
  }
  equal(release.state.echo?.channel, 'idle');
});

test('Echo Drain dispatch holds its final frame and heals only verified collision damage', () => {
  const counterpart = createVersusBossCounterpart({
    skinId: 'assembly',
    playableAbilityPreset: [],
    assemblySkillId: 'echo',
  });
  let state = createVersusBossSignatureRuntimeState(counterpart, ORIGIN);
  const begin = dispatchVersusBossSignature({
    counterpart,
    state,
    commandIndex: 0,
    currentPosition: ORIGIN,
    echoEvent: { kind: 'begin-drain' },
  });
  equal(begin.kind, 'echo-channel');
  if (begin.kind !== 'echo-channel') return;
  equal(begin.ownerSkinId, 'assembly');
  equal(begin.actionId, 'drain');
  equal(begin.effect.kind, 'drain-hold');
  if (begin.effect.kind === 'drain-hold') {
    equal(begin.effect.presentation.holdFinalAttackFrame, true);
    equal(begin.effect.presentation.attacksHeld, true);
  }

  state = begin.state;
  const miss = dispatchVersusBossSignature({
    counterpart,
    state,
    commandIndex: 0,
    currentPosition: ORIGIN,
    echoEvent: { kind: 'drain-collision', damageDealt: 0, currentHp: 3, maxHp: 10 },
  });
  equal(miss.kind, 'echo-channel');
  if (miss.kind !== 'echo-channel') return;
  equal(miss.effect.kind, 'drain-collision');
  if (miss.effect.kind === 'drain-collision') equal(miss.effect.appliedHealing, 0);

  const hit = dispatchVersusBossSignature({
    counterpart,
    state: miss.state,
    commandIndex: 0,
    currentPosition: ORIGIN,
    echoEvent: { kind: 'drain-collision', damageDealt: 4, currentHp: 3, maxHp: 10 },
  });
  equal(hit.kind, 'echo-channel');
  if (hit.kind !== 'echo-channel') return;
  equal(hit.effect.kind, 'drain-collision');
  if (hit.effect.kind === 'drain-collision') {
    equal(hit.effect.collisionAccepted, true);
    equal(hit.effect.appliedHealing, 4);
    equal(hit.effect.hpAfter, 7);
  }

  const release = dispatchVersusBossSignature({
    counterpart,
    state: hit.state,
    commandIndex: 0,
    currentPosition: ORIGIN,
    echoEvent: { kind: 'release-drain' },
  });
  equal(release.kind, 'echo-channel');
  equal(release.state.echo?.channel, 'idle');
});

test('Echo TRACE, REPLAY, and DISPLACE stay held while Brink or Drain is active', () => {
  const counterpart = createVersusBossCounterpart({
    skinId: 'echo',
    playableAbilityPreset: [],
  });

  for (const channel of ['brink', 'drain'] as const) {
    const initial = createVersusBossSignatureRuntimeState(counterpart, ORIGIN);
    const begin = dispatchVersusBossSignature({
      counterpart,
      state: initial,
      commandIndex: 0,
      currentPosition: ORIGIN,
      echoEvent: { kind: channel === 'brink' ? 'begin-brink' : 'begin-drain' },
    });
    equal(begin.kind, 'echo-channel');
    if (begin.kind !== 'echo-channel') continue;
    const heldState = begin.state;

    for (const commandIndex of [0, 1, 2] as const) {
      const result = dispatchVersusBossSignature({
        counterpart,
        state: heldState,
        commandIndex,
        currentPosition: { col: 0, row: 2 },
      });

      equal(result.kind, 'unavailable', `${channel} allowed command ${commandIndex}`);
      equal(result.state, heldState, `${channel} command ${commandIndex} replaced held state`);
      deepStrictEqual(result.state.echo, heldState.echo, `${channel} command ${commandIndex} mutated Echo state`);
      if (result.kind === 'unavailable') match(result.reason, new RegExp(channel, 'i'));
    }
  }
});

test('non-Echo signatures cannot dispatch Brink or Drain', () => {
  const counterpart = createVersusBossCounterpart({
    skinId: 'chrono',
    playableAbilityPreset: [],
  });
  const result = dispatchVersusBossSignature({
    counterpart,
    state: createVersusBossSignatureRuntimeState(counterpart, ORIGIN),
    commandIndex: 0,
    currentPosition: ORIGIN,
    echoEvent: { kind: 'begin-brink' },
  });
  equal(result.kind, 'unavailable');
  if (result.kind === 'unavailable') match(result.reason, /only to the Echo/i);
});

test('unsupported and absent signatures stay unavailable instead of falling back', () => {
  const unsupported = createVersusBossCounterpart({
    skinId: 'assembly',
    playableAbilityPreset: [],
    assemblySkillId: 'missing',
  });
  const missing = dispatchVersusBossSignature({
    counterpart: unsupported,
    state: createVersusBossSignatureRuntimeState(unsupported, ORIGIN),
    commandIndex: 0,
    currentPosition: ORIGIN,
  });
  equal(missing.kind, 'unavailable');
  if (missing.kind === 'unavailable') match(missing.reason, /Unsupported/);

  const ordinary = createVersusBossCounterpart({
    skinId: 'default',
    playableAbilityPreset: [],
  });
  const none = dispatchVersusBossSignature({
    counterpart: ordinary,
    state: createVersusBossSignatureRuntimeState(ordinary, ORIGIN),
    commandIndex: 0,
    currentPosition: ORIGIN,
  });
  equal(none.kind, 'unavailable');
  if (none.kind === 'unavailable') match(none.reason, /no signature/i);
});
