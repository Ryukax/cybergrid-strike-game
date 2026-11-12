import { deepStrictEqual, equal, throws } from 'node:assert/strict';
import { test } from 'node:test';

import { chooseDiagonalCoopNpcDecision } from './diagonal-coop-npc';

test('separately spawned actors are valid and may hold opposite formation cells', () => {
  const decision = chooseDiagonalCoopNpcDecision({
    player: { col: 0, row: 0 },
    npc: { col: 2, row: 2 },
    threats: [],
    canMove: true,
    canFire: true,
  });

  deepStrictEqual(decision, {
    moveTo: null,
    shouldFire: false,
    targetRow: null,
  });
});

test('NPC independently steps toward its mirrored formation position', () => {
  const decision = chooseDiagonalCoopNpcDecision({
    player: { col: 0, row: 1 },
    npc: { col: 2, row: 2 },
    threats: [],
    canMove: true,
    canFire: true,
  });

  deepStrictEqual(decision, {
    moveTo: { col: 2, row: 1 },
    shouldFire: false,
    targetRow: null,
  });
});

test('NPC movement may deliberately co-locate with the player', () => {
  const decision = chooseDiagonalCoopNpcDecision({
    player: { col: 1, row: 1 },
    npc: { col: 2, row: 2 },
    threats: [],
    canMove: true,
    canFire: false,
  });

  deepStrictEqual(decision.moveTo, { col: 1, row: 1 });
});

test('the most urgent living threat supplies the NPC target lane', () => {
  const decision = chooseDiagonalCoopNpcDecision({
    player: { col: 0, row: 0 },
    npc: { col: 2, row: 2 },
    threats: [
      { col: 5, row: 2, hp: 2 },
      { col: 3, row: 0, hp: 2 },
    ],
    canMove: true,
    canFire: true,
  });

  equal(decision.targetRow, 0);
  deepStrictEqual(decision.moveTo, { col: 2, row: 1 });
  equal(decision.shouldFire, true);
});

test('NPC fires only when a living threat occupies its own current lane', () => {
  const decision = chooseDiagonalCoopNpcDecision({
    player: { col: 0, row: 0 },
    npc: { col: 2, row: 1 },
    threats: [
      { col: 4, row: 0, hp: 3 },
      { col: 5, row: 1, hp: 0 },
    ],
    canMove: false,
    canFire: true,
  });

  equal(decision.shouldFire, false);
  equal(decision.targetRow, 0);
});

test('movement lock does not prevent an independent fire decision', () => {
  const decision = chooseDiagonalCoopNpcDecision({
    player: { col: 0, row: 0 },
    npc: { col: 2, row: 2 },
    threats: [{ col: 3, row: 2, hp: 2 }],
    canMove: false,
    canFire: true,
  });

  deepStrictEqual(decision, {
    moveTo: null,
    shouldFire: true,
    targetRow: 2,
  });
});

test('co-located actor positions are accepted', () => {
  const decision = chooseDiagonalCoopNpcDecision({
    player: { col: 1, row: 1 },
    npc: { col: 1, row: 1 },
    threats: [],
    canMove: true,
    canFire: true,
  });

  equal(decision.moveTo, null);
});

test('invalid actor positions fail fast', () => {
  throws(() => chooseDiagonalCoopNpcDecision({
    player: { col: -1, row: 0 },
    npc: { col: 2, row: 2 },
    threats: [],
    canMove: true,
    canFire: true,
  }), RangeError);
});
