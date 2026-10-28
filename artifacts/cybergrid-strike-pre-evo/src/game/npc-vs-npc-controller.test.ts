import { deepStrictEqual, equal, ok } from 'node:assert/strict';
import { test } from 'node:test';

import {
  delayNpcVersusAbilityCooldown,
  decideLeftNpcVersusAction,
  leftColumnToStrategyColumn,
  npcVersusAbilityProgress,
  npcVersusCooldownFromCardTimer,
  normalizeNpcVersusAbilityUseCounts,
  orientVersusPlanForLeft,
  recordNpcVersusAbilityUse,
  strategyColumnToLeftColumn,
  type LeftNpcVersusControllerInput,
} from './npc-vs-npc-controller';
import type { VersusSignaturePlan } from './npc-strategy';

test('NPC card pressure delays the countdown clock without exceeding its interval', () => {
  equal(delayNpcVersusAbilityCooldown(4, 1.5, 12), 5.5);
  equal(delayNpcVersusAbilityCooldown(11.5, 3, 12), 12);
  equal(delayNpcVersusAbilityCooldown(4, -2, 12), 4);
  equal(npcVersusAbilityProgress(9, 12), 0.25);
  equal(npcVersusCooldownFromCardTimer(3, 12), 9);
});

function input(
  overrides: Partial<LeftNpcVersusControllerInput> = {},
): LeftNpcVersusControllerInput {
  return {
    active: true,
    running: true,
    paused: false,
    selfDead: false,
    opponentDead: false,
    skillId: 'override',
    selfHp: 80,
    opponentHp: 72,
    maxHp: 100,
    selfShields: 0,
    maxShields: 3,
    selfRow: 1,
    opponentRow: 1,
    selfCol: 1,
    selfFireCooldown: 0,
    selfMoveCooldown: 0,
    selfCardCooldown: 0,
    opponentFireCooldown: 0,
    opponentMoveCooldown: 0,
    incomingByRow: [0, 0, 0],
    step: 0,
    seed: 17,
    cardCount: 3,
    abilityUseCounts: [0, 0, 0],
    cardsReady: true,
    cardProgress: 0.5,
    ...overrides,
  };
}

test('inactive, stopped, paused, or dead duels produce no left-side actions', () => {
  const disabled: Partial<LeftNpcVersusControllerInput>[] = [
    { active: false },
    { running: false },
    { paused: true },
    { selfDead: true },
    { opponentDead: true },
    { selfHp: 0 },
    { opponentHp: 0 },
  ];
  for (const state of disabled) {
    deepStrictEqual(decideLeftNpcVersusAction(input(state)), {
      enabled: false,
      move: null,
      aim: null,
      fire: false,
      cardSlot: null,
      ability: null,
    });
  }
});

test('left depth columns mirror the authored right-side strategy orientation', () => {
  deepStrictEqual(
    [0, 1, 2].map(leftColumnToStrategyColumn),
    [2, 1, 0],
  );
  deepStrictEqual(
    [0, 1, 2].map(strategyColumnToLeftColumn),
    [2, 1, 0],
  );

  const decision = decideLeftNpcVersusAction(input({
    skillId: 'override',
    selfCol: 1,
    step: 0,
  }));
  equal(decision.move?.col, 2, 'pursuit must advance the left NPC toward center');
});

test('left-side signature plans mirror depth resources without altering rows', () => {
  const plan = {
    abilityId: 'chrono',
    doctrine: 'control',
    targetRow: 2,
    shotPattern: 'none',
    salvo: 1,
    power: 1,
    big: false,
    leechOnHit: 0,
    recovery: 0,
    shields: 0,
    fireDisruption: 0,
    moveDisruption: 0,
    cardPressure: 0,
    reason: 'test',
    commandIndex: 1,
    intent: 'control',
    columnDelta: -1,
    nextMode: 2,
    nextCharges: 3,
    nextPlacements: [0, 5, 7],
    nextOriginRow: 2,
    nextOriginCol: 0,
  } satisfies VersusSignaturePlan;

  deepStrictEqual(orientVersusPlanForLeft(plan), {
    ...plan,
    columnDelta: 1,
    nextPlacements: [6, 5, 1],
    nextOriginCol: 2,
  });
  deepStrictEqual(plan.nextPlacements, [0, 5, 7], 'source plan remains immutable');
});

test('movement stays adjacent on both axes even when strategy requests a distant lane', () => {
  const decision = decideLeftNpcVersusAction(input({
    skillId: 'override',
    selfRow: 0,
    opponentRow: 2,
    selfCol: 0,
    step: 0,
  }));

  deepStrictEqual(decision.move, { row: 1, col: 1 });
  equal(decideLeftNpcVersusAction(input({
    selfRow: 0,
    opponentRow: 2,
    selfMoveCooldown: 0.01,
  })).move, null);
});

test('basic fire waits for live lane alignment and exposes the intermediate aim step', () => {
  const acquiring = decideLeftNpcVersusAction(input({
    selfRow: 0,
    opponentRow: 2,
  }));
  deepStrictEqual(acquiring.aim, { targetRow: 2, nextRow: 1, aligned: false });
  equal(acquiring.fire, false);

  const aligned = decideLeftNpcVersusAction(input({
    selfRow: 2,
    opponentRow: 2,
  }));
  deepStrictEqual(aligned.aim, { targetRow: 2, nextRow: 2, aligned: true });
  equal(aligned.fire, true);
  equal(decideLeftNpcVersusAction(input({
    selfRow: 2,
    opponentRow: 2,
    selfFireCooldown: 0.01,
  })).fire, false);
});

test('card decisions are bounded to available authored slots and readiness', () => {
  const fullHand = decideLeftNpcVersusAction(input({
    skillId: 'arsenal',
    selfHp: 22,
    cardCount: 3,
  }));
  ok(fullHand.cardSlot !== null);
  ok(fullHand.cardSlot >= 0 && fullHand.cardSlot <= 2);
  ok(fullHand.ability);

  const oneCard = decideLeftNpcVersusAction(input({
    skillId: 'arsenal',
    cardCount: 1,
  }));
  equal(oneCard.cardSlot, 0);
  equal(oneCard.ability?.abilityId, 'barrage');

  for (const gated of [
    { cardsReady: false },
    { selfCardCooldown: 0.1 },
    { cardCount: 0 },
  ]) {
    const decision = decideLeftNpcVersusAction(input(gated));
    equal(decision.cardSlot, null);
    equal(decision.ability, null);
  }
});

test('ability usage helpers sanitize, rebase, record, and remain immutable', () => {
  const source = [4.9, 3, Number.POSITIVE_INFINITY, 99];
  deepStrictEqual(normalizeNpcVersusAbilityUseCounts(source, 3), [4, 3, 0]);
  deepStrictEqual(source, [4.9, 3, Number.POSITIVE_INFINITY, 99]);

  const first = recordNpcVersusAbilityUse([0, 0, 0], 1, 3);
  deepStrictEqual(first, [0, 1, 0]);
  deepStrictEqual(recordNpcVersusAbilityUse([1, 1, 0], 2, 3), [0, 0, 0]);
  deepStrictEqual(recordNpcVersusAbilityUse([2, 1], 8, 2), [1, 0]);
});

test('least-used practical authored slots surface before a tactical repeat', () => {
  const first = decideLeftNpcVersusAction(input({
    skillId: 'arsenal',
    abilityUseCounts: [0, 0, 0],
  }));
  equal(first.cardSlot, 0, 'opening tactics may choose Barrage from an unused tie');
  equal(first.ability?.abilityId, 'barrage');

  const afterFirst = recordNpcVersusAbilityUse([0, 0, 0], first.cardSlot!, 3);
  const second = decideLeftNpcVersusAction(input({
    skillId: 'arsenal',
    abilityUseCounts: afterFirst,
  }));
  ok(second.cardSlot === 1 || second.cardSlot === 2);
  ok(second.ability?.abilityId === 'shotgun' || second.ability?.abilityId === 'overclock');

  const afterSecond = recordNpcVersusAbilityUse(afterFirst, second.cardSlot!, 3);
  const third = decideLeftNpcVersusAction(input({
    skillId: 'arsenal',
    abilityUseCounts: afterSecond,
  }));
  const visited = new Set([first.cardSlot, second.cardSlot, third.cardSlot]);
  deepStrictEqual([...visited].sort(), [0, 1, 2]);
});

test('explicit owned ability pools support more than three components', () => {
  const abilityIds = [
    'arcweb',
    'gravity',
    'freeze',
    'stasisgate',
    'backdash',
    'nuke',
    'megabomb',
  ] as const;
  let useCounts: readonly number[] = Array(abilityIds.length).fill(0);
  const visited = new Set<number>();

  for (let step = 0; step < abilityIds.length; step++) {
    const decision = decideLeftNpcVersusAction(input({
      skillId: 'lord-alpha',
      abilityIds,
      abilityUseCounts: useCounts,
      step,
      incomingByRow: [1, 1, 1],
      selfHp: 70,
      selfRow: 0,
      opponentRow: 2,
    }));
    ok(decision.cardSlot !== null);
    visited.add(decision.cardSlot);
    useCounts = recordNpcVersusAbilityUse(
      useCounts,
      decision.cardSlot,
      abilityIds.length,
    );
  }

  deepStrictEqual([...visited].sort((a, b) => a - b), [0, 1, 2, 3, 4, 5, 6]);
});

test('the same fixed-step snapshot always produces the same immutable decision', () => {
  const snapshot = input({
    skillId: 'hijack',
    selfRow: 1,
    opponentRow: 0,
    selfCol: 2,
    incomingByRow: [0, 1, 0],
    step: 7,
    seed: 923,
  });
  const before = structuredClone(snapshot);
  const first = decideLeftNpcVersusAction(snapshot);
  const repeated = decideLeftNpcVersusAction(snapshot);

  deepStrictEqual(repeated, first);
  deepStrictEqual(snapshot, before);
});
