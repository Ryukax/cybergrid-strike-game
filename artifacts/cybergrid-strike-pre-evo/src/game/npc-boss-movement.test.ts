import { deepStrictEqual, equal, ok } from 'node:assert/strict';
import { test } from 'node:test';

import { applyVersusNpcCombatPlan } from './npc-combat-runtime';
import {
  BOSS_STRATEGY_PROFILES,
  chooseVersusMovementColumn,
  chooseVersusMovementPosition,
  chooseVersusMovementRow,
  chooseVersusBasicAttackAim,
  resolveVersusNpcAbility,
  type VersusNpcContext,
  type VersusSignaturePlan,
} from './npc-strategy';

function contextFor(
  skillId: string,
  overrides: Partial<VersusNpcContext> = {},
): VersusNpcContext {
  return {
    skillId,
    npcHp: 78,
    playerHp: 72,
    maxHp: 100,
    npcShields: 0,
    maxShields: 3,
    npcRow: 1,
    playerRow: 2,
    npcCol: 1,
    incomingByRow: [0, 0, 0],
    playerFireCooldown: 0,
    playerMoveCooldown: 0,
    cardProgress: 0.5,
    step: 0,
    signatureMode: 0,
    signatureCharges: 0,
    signaturePlacements: [],
    signatureOriginRow: 1,
    signatureOriginCol: 1,
    signatureLastCommand: -1,
    ...overrides,
  };
}

test('every boss movement style can leave the center column for a tactical reason', () => {
  const decisions = [
    // pursue: healthy assault advances
    chooseVersusMovementColumn(contextFor('override')),
    // flank: even strategy steps take the near-side angle
    chooseVersusMovementColumn(contextFor('rift')),
    // anchor: incoming fire yields one column of depth
    chooseVersusMovementColumn(contextFor('architect', { incomingByRow: [0, 2, 0] })),
    // evade: a trailing boss creates space
    chooseVersusMovementColumn(contextFor('chrono', { npcHp: 40, playerHp: 80 })),
    // cycle: even steps traverse toward the rear side
    chooseVersusMovementColumn(contextFor('hijack')),
  ];

  deepStrictEqual(decisions, [0, 0, 2, 2, 2]);
  for (const column of decisions) ok(column >= 0 && column <= 2);
});

test('combined movement changes columns without replacing authored row tactics', () => {
  const scenarios: ReadonlyArray<{
    context: VersusNpcContext;
    variation: number;
  }> = [
    { context: contextFor('override'), variation: 0.5 },
    { context: contextFor('rift', { step: 1 }), variation: 0.5 },
    {
      context: contextFor('architect', { npcRow: 0, incomingByRow: [3, 0, 1] }),
      variation: 0.5,
    },
    { context: contextFor('chrono', { playerRow: 0 }), variation: 0.5 },
    { context: contextFor('hijack'), variation: 0.25 },
  ];

  for (const { context, variation } of scenarios) {
    const position = chooseVersusMovementPosition(context, variation);
    equal(position.row, chooseVersusMovementRow(context, variation));
    equal(position.col, chooseVersusMovementColumn(context));
    ok(position.row >= 0 && position.row <= 2);
    ok(position.col >= 0 && position.col <= 2);
  }
});

test('lane pressure only permits an adjacent move into a materially safer lane', () => {
  equal(chooseVersusMovementRow(contextFor('chrono', {
    npcRow: 0,
    incomingByRow: [4, 2, 0],
  })), 1, 'an edge boss cannot teleport directly from row 0 to row 2');

  equal(chooseVersusMovementRow(contextFor('chrono', {
    npcRow: 1,
    incomingByRow: [2, 2, 2],
  })), 1, 'equal pressure should not produce random lane jitter');
});

test('deterministic movement sequences visit multiple columns and never leave the board', () => {
  const sequences: Record<string, number[]> = {};

  for (const skillId of ['override', 'rift', 'architect', 'chrono', 'hijack']) {
    let column = 1;
    const visited = new Set([column]);
    const sequence = [column];
    for (let step = 0; step < 6; step++) {
      const pressured = skillId === 'architect' && step % 2 === 0;
      const context = contextFor(skillId, {
        npcCol: column,
        npcHp: skillId === 'override' && step >= 2 ? 25 : 78,
        playerHp: skillId === 'chrono' && step < 3 ? 90 : 50,
        incomingByRow: pressured || (skillId === 'override' && step >= 2)
          ? [0, 2, 0]
          : [0, 0, 0],
        step,
      });
      column = chooseVersusMovementColumn(context);
      sequence.push(column);
      visited.add(column);
      ok(column >= 0 && column <= 2, `${skillId} left the board`);
    }
    ok(visited.size >= 2, `${skillId} remained in column ${column}`);
    sequences[skillId] = sequence;
  }

  deepStrictEqual(sequences.hijack, [1, 2, 1, 0, 1, 2, 1]);
});

test('basic fire visibly reacquires the live player lane before firing', () => {
  const first = chooseVersusBasicAttackAim({ npcRow: 0, playerRow: 2 });
  deepStrictEqual(first, { targetRow: 2, nextRow: 1, aligned: false });

  const second = chooseVersusBasicAttackAim({ npcRow: first.nextRow, playerRow: 2 });
  deepStrictEqual(second, { targetRow: 2, nextRow: 2, aligned: false });

  const acquired = chooseVersusBasicAttackAim({ npcRow: second.nextRow, playerRow: 2 });
  deepStrictEqual(acquired, { targetRow: 2, nextRow: 2, aligned: true });

  // If the player moves before release, the boss must reacquire rather than
  // firing down the stale lane.
  const changed = chooseVersusBasicAttackAim({ npcRow: 2, playerRow: 0 });
  deepStrictEqual(changed, { targetRow: 0, nextRow: 1, aligned: false });
});

test('all 32 boss profiles visibly traverse columns during an otherwise safe skill cycle', () => {
  for (const skillId of Object.keys(BOSS_STRATEGY_PROFILES)) {
    let column = 1;
    const visited = new Set([column]);
    for (let step = 0; step < 8; step++) {
      column = chooseVersusMovementColumn(contextFor(skillId, {
        npcCol: column,
        npcHp: 80,
        playerHp: 80,
        incomingByRow: [0, 0, 0],
        step,
      }));
      visited.add(column);
    }
    ok(visited.size >= 2, `${skillId} stayed in the center column`);
  }
});

test('sustained autofire pressure does not pin any boss profile in one depth column', () => {
  for (const skillId of Object.keys(BOSS_STRATEGY_PROFILES)) {
    let column = 1;
    const visited = new Set([column]);
    for (let step = 0; step < 10; step++) {
      column = chooseVersusMovementColumn(contextFor(skillId, {
        npcCol: column,
        npcHp: 25,
        playerHp: 80,
        incomingByRow: [0, 3, 0],
        step,
      }));
      visited.add(column);
    }
    ok(visited.size >= 2, `${skillId} was pinned in column ${column} under pressure`);
  }
});

test('signature column deltas still compose with independent row movement', () => {
  const baseContext = contextFor('phase');
  const runtime = {
    npc: {
      row: 0,
      col: 1,
      hp: 54,
      shieldCharges: 0,
      signatureMode: 0,
      signatureCharges: 0,
      signaturePlacements: [] as number[],
      signatureOriginRow: 0,
      signatureOriginCol: 1,
    },
    player: { fireCooldown: 0, moveCooldown: 0 },
    cardsReady: false,
    cardTimer: 6,
  };
  const forward: VersusSignaturePlan = {
    ...resolveVersusNpcAbility('shotgun', baseContext),
    commandIndex: 2,
    intent: 'maneuver',
    moveToRow: 2,
    columnDelta: 1,
    nextMode: 0,
    nextCharges: 0,
    nextPlacements: [],
    nextOriginRow: 0,
    nextOriginCol: 1,
  };
  const advanced = applyVersusNpcCombatPlan(forward, runtime);
  equal(advanced.npc.row, 2);
  equal(advanced.npc.col, 2);

  const retreat = { ...forward, moveToRow: 1, columnDelta: -1 };
  const returned = applyVersusNpcCombatPlan(retreat, advanced);
  equal(returned.npc.row, 1);
  equal(returned.npc.col, 1);
});
