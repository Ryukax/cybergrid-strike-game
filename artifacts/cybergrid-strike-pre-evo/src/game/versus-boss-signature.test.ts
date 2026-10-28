import { deepStrictEqual, equal, match, ok, throws } from 'node:assert/strict';
import { test } from 'node:test';

import {
  LORD_ALPHA_SKILL_PREVIEW_ACTIONS,
} from './lord-alpha';
import { BOSS_SIGNATURE_COMMANDS } from './npc-skill-presentation';
import {
  ECHO_BRINK_PARTITION_FRAMES,
  advanceLordAlphaEquipLatency,
  beginLordAlphaEquipLatency,
  beginEchoNpcChannel,
  createChronaNpcSignatureState,
  createEchoNpcSignatureState,
  createLordAlphaEquipLatencyState,
  echoNpcChannelPresentation,
  executeChronaNpcCommand,
  executeEchoNpcCommand,
  lockEchoNpcBrinkTarget,
  recordChronaNpcPosition,
  releaseEchoNpcBrink,
  releaseEchoNpcDrain,
  resolveAssemblyNpcSignature,
  resolveEchoNpcDrainCollision,
  resolveExactRivalSignatureCommand,
  resolveLordAlphaNpcAction,
  resolveLordAlphaNpcBankSlot,
} from './versus-boss-signature';

test('exact rival signatures retain their skin command instead of falling back', () => {
  for (const [skillId, labels] of Object.entries(BOSS_SIGNATURE_COMMANDS)) {
    labels.forEach((label, commandIndex) => {
      const resolved = resolveExactRivalSignatureCommand(skillId, commandIndex);
      equal(resolved.kind, 'rival-command');
      equal(resolved.ownerSkinId, skillId);
      equal(resolved.skillId, skillId);
      equal(resolved.commandIndex, commandIndex);
      equal(resolved.label, label);
    });
  }

  throws(
    () => resolveExactRivalSignatureCommand('adaptive', 0),
    /No NPC signature counterpart registered/,
  );
  throws(
    () => resolveExactRivalSignatureCommand('chrono', 3),
    /Invalid boss signature command index/,
  );
});

test('Assembly invokes its exact saved selection or Shadow Clone', () => {
  deepStrictEqual(resolveAssemblyNpcSignature('shadow'), {
    kind: 'shadow-clone',
    ownerSkinId: 'assembly',
    actionId: 'shadow-clone',
    label: 'Shadow Clone',
  });

  const chrono = resolveAssemblyNpcSignature('chrono', 2);
  equal(chrono.kind, 'rival-command');
  if (chrono.kind === 'rival-command') {
    equal(chrono.ownerSkinId, 'assembly');
    equal(chrono.skillId, 'chrono');
    equal(chrono.label, 'REWIND');
  }

  throws(
    () => resolveAssemblyNpcSignature('missing-selection'),
    /Assembly has no selected NPC signature counterpart/,
  );
});

test('Lord Alpha exposes exactly the canonical nine actions and no substitute action', () => {
  const resolved = LORD_ALPHA_SKILL_PREVIEW_ACTIONS.map(({ id }) =>
    resolveLordAlphaNpcAction(id));

  deepStrictEqual(
    resolved.map((action) => action.actionId),
    [
      'web-shot', 'grapple', 'roc-stun', 'dimensional-net', 'afterimage-step',
      'shadow-clone', 'tharthareon', 'millennium-dragon', 'equip',
    ],
  );
  deepStrictEqual(
    resolved.map((action) => action.kind),
    [
      'canonical-ability', 'canonical-ability', 'canonical-ability',
      'canonical-ability', 'canonical-ability', 'shadow-clone',
      'canonical-ability', 'canonical-ability', 'equip-latency',
    ],
  );
  deepStrictEqual(
    resolved.map((action) => action.kind === 'canonical-ability' ? action.abilityId : null),
    ['arcweb', 'gravity', 'freeze', 'stasisgate', 'backdash', null, 'nuke', 'megabomb', null],
  );
  equal(resolveLordAlphaNpcBankSlot(2, 2).actionId, 'equip');
  throws(
    () => resolveLordAlphaNpcAction('generic-laser'),
    /No Lord Alpha NPC counterpart registered/,
  );
});

test('Lord Alpha Equip Latency telegraphs without modifying balance or locking controls', () => {
  const equip = resolveLordAlphaNpcAction('equip');
  equal(equip.kind, 'equip-latency');
  if (equip.kind !== 'equip-latency') return;

  let state = beginLordAlphaEquipLatency(
    createLordAlphaEquipLatencyState(),
    equip.durationMs,
    'web-shot',
  );
  deepStrictEqual(
    {
      phase: state.phase,
      telegraph: state.telegraphedActionId,
      controlsLive: state.controlsLive,
      movementLocked: state.movementLocked,
      attacksLocked: state.attacksLocked,
      damageMultiplier: state.damageMultiplier,
      defenseMultiplier: state.defenseMultiplier,
      hitboxMultiplier: state.hitboxMultiplier,
    },
    {
      phase: 'equipping',
      telegraph: 'web-shot',
      controlsLive: true,
      movementLocked: false,
      attacksLocked: false,
      damageMultiplier: 1,
      defenseMultiplier: 1,
      hitboxMultiplier: 1,
    },
  );

  state = advanceLordAlphaEquipLatency(state, equip.durationMs / 2);
  equal(state.phase, 'equipping');
  equal(state.telegraphedActionId, 'web-shot');
  state = advanceLordAlphaEquipLatency(state, equip.durationMs);
  equal(state.phase, 'equipped');
  equal(state.telegraphedActionId, null);
});

test('Chrona owns an independent queue, movement history, and held rewind state', () => {
  let state = createChronaNpcSignatureState({ col: 2, row: 1 });
  const queued = executeChronaNpcCommand(state, 0, { col: 2, row: 1 });
  state = queued.state;
  equal(queued.command.label, 'QUEUE');
  deepStrictEqual(queued.effect, { kind: 'queue', origin: { col: 2, row: 1 } });
  deepStrictEqual(state.queueOrigins, [{ col: 2, row: 1 }]);

  const unavailableStep = executeChronaNpcCommand(state, 1, { col: 2, row: 1 });
  equal(unavailableStep.effect.kind, 'unavailable');

  state = recordChronaNpcPosition(state, { col: 1, row: 0 });
  const stepped = executeChronaNpcCommand(state, 1, { col: 1, row: 0 });
  equal(stepped.command.label, 'STEP');
  equal(stepped.effect.kind, 'step');
  if (stepped.effect.kind === 'step') {
    deepStrictEqual(stepped.effect.destination, { col: 2, row: 1 });
  }

  const rewindBegin = executeChronaNpcCommand(stepped.state, 2, { col: 2, row: 1 }, true);
  equal(rewindBegin.command.label, 'REWIND');
  equal(rewindBegin.state.rewinding, true);
  deepStrictEqual(rewindBegin.effect, { kind: 'rewind', phase: 'begin' });
  const rewindRelease = executeChronaNpcCommand(rewindBegin.state, 2, { col: 2, row: 1 }, false);
  equal(rewindRelease.state.rewinding, false);
  deepStrictEqual(rewindRelease.effect, { kind: 'rewind', phase: 'release' });
});

test('Echo TRACE, REPLAY, and DISPLACE retain their authored state chain', () => {
  let state = createEchoNpcSignatureState();
  const missingDisplace = executeEchoNpcCommand(state, 2, { col: 2, row: 1 });
  equal(missingDisplace.effect.kind, 'unavailable');

  const traced = executeEchoNpcCommand(state, 0, { col: 2, row: 0 });
  state = traced.state;
  equal(traced.command.label, 'TRACE');
  deepStrictEqual(traced.effect, { kind: 'trace', origin: { col: 2, row: 0 } });

  const replayed = executeEchoNpcCommand(state, 1, { col: 1, row: 1 });
  equal(replayed.command.label, 'REPLAY');
  deepStrictEqual(replayed.effect, { kind: 'replay', origins: [{ col: 2, row: 0 }] });

  const displaced = executeEchoNpcCommand(state, 2, { col: 1, row: 1 });
  equal(displaced.command.label, 'DISPLACE');
  deepStrictEqual(displaced.effect, { kind: 'displace', destination: { col: 2, row: 0 } });
});

test('Echo Brink locks movement and attacks, spends to an HP floor, and releases only 2-3-5 partitions', () => {
  let state = beginEchoNpcChannel(createEchoNpcSignatureState(), 'brink');
  deepStrictEqual(echoNpcChannelPresentation(state), {
    movementLocked: true,
    attacksHeld: true,
    bracing: true,
    jitter: true,
    holdFinalAttackFrame: false,
  });

  const first = lockEchoNpcBrinkTarget(state, { id: 'player', col: 1, row: 2 }, 2);
  ok(first.accepted);
  equal(first.hpAfter, 1);
  equal(first.hpCost, 1);
  state = first.state;

  const duplicate = lockEchoNpcBrinkTarget(state, { id: 'player', col: 0, row: 0 }, 1);
  equal(duplicate.accepted, false);
  match(duplicate.reason ?? '', /already locked/);

  const atFloor = lockEchoNpcBrinkTarget(state, { id: 'clone', col: 1, row: 1 }, 1);
  equal(atFloor.accepted, false);
  equal(atFloor.hpAfter, 1);

  const released = releaseEchoNpcBrink(state);
  equal(released.state.channel, 'idle');
  equal(released.strikes.length, 1);
  deepStrictEqual(released.strikes[0].frames, ECHO_BRINK_PARTITION_FRAMES);
  equal(released.strikes[0].fixedIntercept, true);
  equal(released.strikes[0].simultaneous, true);
  equal('abilityId' in released.strikes[0], false, 'Brink cannot degrade into clonebreak or another card');
});

test('Echo Drain holds the final frame and heals only after verified collision damage', () => {
  let state = beginEchoNpcChannel(createEchoNpcSignatureState(), 'drain');
  deepStrictEqual(echoNpcChannelPresentation(state), {
    movementLocked: true,
    attacksHeld: true,
    bracing: true,
    jitter: false,
    holdFinalAttackFrame: true,
  });

  const noCollision = resolveEchoNpcDrainCollision(state, 0, 3, 10);
  equal(noCollision.collisionAccepted, false);
  equal(noCollision.appliedHealing, 0);
  equal(noCollision.hpAfter, 3);

  const collision = resolveEchoNpcDrainCollision(state, 4, 3, 10);
  equal(collision.collisionAccepted, true);
  equal(collision.damageDealt, 4);
  equal(collision.requestedHealing, 4);
  equal(collision.appliedHealing, 4);
  equal(collision.hpAfter, 7);

  state = releaseEchoNpcDrain(state);
  equal(state.channel, 'idle');
  const afterRelease = resolveEchoNpcDrainCollision(state, 4, 7, 10);
  equal(afterRelease.collisionAccepted, false);
  equal(afterRelease.appliedHealing, 0);
});
