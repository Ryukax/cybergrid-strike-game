import { deepStrictEqual, equal, ok } from 'node:assert/strict';
import { test } from 'node:test';

import { ABILITY_POOL } from './constants';
import {
  ABILITY_DEFINITIONS,
  CANONICAL_ABILITY_IDS,
  abilityDefinition,
  canonicalAbilityRegistryIsComplete,
  composePracticalAbilityHand,
  evaluateAbility,
  type AbilityBoardContext,
  type AbilityEnemySnapshot,
} from './ability-system';

function context(
  enemies: readonly AbilityEnemySnapshot[] = [],
  overrides: Partial<AbilityBoardContext> = {},
): AbilityBoardContext {
  return {
    mode: 'classic',
    enemies,
    playerHp: 5,
    playerMaxHp: 5,
    shieldCharges: 0,
    maxShieldCharges: 3,
    pendingThreats: 0,
    canRefreshHand: true,
    ...overrides,
  };
}

test('canonical registry covers every authored ability exactly once', () => {
  equal(CANONICAL_ABILITY_IDS.length, 80);
  equal(new Set(CANONICAL_ABILITY_IDS).size, 80);
  deepStrictEqual(
    new Set(CANONICAL_ABILITY_IDS),
    new Set(ABILITY_POOL.map(({ id }) => id)),
  );
  deepStrictEqual(
    new Set(Object.keys(ABILITY_DEFINITIONS)),
    new Set(CANONICAL_ABILITY_IDS),
  );
  ok(canonicalAbilityRegistryIsComplete());

  for (const id of CANONICAL_ABILITY_IDS) {
    const definition = abilityDefinition(id);
    ok(definition, `${id} needs an explicit definition`);
    ok(definition.roles.length > 0, `${id} needs a tactical role`);
    ok(definition.priority > 0, `${id} needs a positive priority`);
    ok(definition.applicability, `${id} needs explicit applicability`);
  }
});

test('specialist cards are withheld without their target and become useful on contact', () => {
  const empty = context([{ tags: ['grounded', 'mobile'], distance: 0.6 }]);
  equal(evaluateAbility('flak', empty).valid, false);
  equal(evaluateAbility('depthcharge', empty).valid, false);
  equal(evaluateAbility('tailclamp', empty).valid, false);

  const counterBoard = context([
    { tags: ['airborne', 'spectral'], distance: 0.7 },
    { tags: ['burrower'], distance: 0.5 },
    { tags: ['serpentine', 'aquatic'], distance: 0.3 },
  ]);
  equal(evaluateAbility('flak', counterBoard).valid, true);
  equal(evaluateAbility('depthcharge', counterBoard).valid, true);
  equal(evaluateAbility('tailclamp', counterBoard).valid, true);
});

test('practical composer is deterministic, unique, valid, and includes a live counter', () => {
  const board = context([
    {
      tags: ['airborne', 'cyber', 'armored', 'fast'],
      distance: 0.5,
      hp: 4,
      maxHp: 4,
    },
  ]);
  const options = {
    availableAbilityIds: ['flak', 'groundwire', 'heal', 'overclock', 'shotgun', 'emp', 'shattershot'],
    context: board,
    seed: 4919,
  } as const;

  const first = composePracticalAbilityHand(options);
  const second = composePracticalAbilityHand(options);
  deepStrictEqual(first.map(({ id }) => id), second.map(({ id }) => id));
  equal(first.length, 3);
  equal(new Set(first.map(({ id }) => id)).size, 3);
  ok(first.some(({ id }) => ABILITY_DEFINITIONS[id as keyof typeof ABILITY_DEFINITIONS].specialist));
  for (const ability of first) {
    ok(evaluateAbility(ability.id, board).valid, `${ability.id} must be useful now`);
  }
  ok(!first.some(({ id }) => id === 'heal'), 'full-health hands must withhold RECOVER');
  ok(!first.some(({ id }) => id === 'groundwire'), 'unmatched specialists must be withheld');
});

test('composer never deals outside the learned pool or explicit fallbacks', () => {
  const board = context();
  const withheld = composePracticalAbilityHand({
    availableAbilityIds: ['flak', 'depthcharge', 'tailclamp'],
    context: board,
    seed: 7,
  });
  deepStrictEqual(withheld, []);

  const explicitFallbacks = ['overclock', 'pierce'] as const;
  const repaired = composePracticalAbilityHand({
    availableAbilityIds: ['flak', 'depthcharge', 'tailclamp'],
    fallbackAbilityIds: explicitFallbacks,
    context: board,
    seed: 7,
  });
  equal(repaired.length, 2);
  ok(repaired.every(({ id }) => explicitFallbacks.includes(id as typeof explicitFallbacks[number])));
  ok(repaired.every(({ id }) => evaluateAbility(id, board).valid));
});

test('composer respects empty, one-card, and two-card candidate pools', () => {
  const board = context();
  deepStrictEqual(composePracticalAbilityHand({
    availableAbilityIds: [],
    context: board,
    seed: 1,
  }), []);

  deepStrictEqual(composePracticalAbilityHand({
    availableAbilityIds: ['overclock'],
    context: board,
    seed: 2,
  }).map(({ id }) => id), ['overclock']);

  const two = composePracticalAbilityHand({
    availableAbilityIds: ['overclock', 'pierce'],
    context: board,
    seed: 3,
  });
  equal(two.length, 2);
  deepStrictEqual(new Set(two.map(({ id }) => id)), new Set(['overclock', 'pierce']));
});

test('sustain and defense cards respond to actual resource capacity', () => {
  const healthy = context([], { playerHp: 5, shieldCharges: 3 });
  equal(evaluateAbility('heal', healthy).valid, false);
  equal(evaluateAbility('regen', healthy).valid, false);
  equal(evaluateAbility('shield', healthy).valid, false);
  equal(evaluateAbility('armor', healthy).valid, false);

  const injured = context([], { playerHp: 2, shieldCharges: 0 });
  equal(evaluateAbility('heal', injured).valid, true);
  equal(evaluateAbility('regen', injured).valid, true);
  equal(evaluateAbility('shield', injured).valid, true);
  equal(evaluateAbility('armor', injured).valid, true);
});

test('every authored ability has a bounded VS interpretation while live counters still score higher', () => {
  const versus = context([], {
    mode: 'vs',
    playerHp: 72,
    playerMaxHp: 100,
    opponent: { present: true, hp: 80, maxHp: 100, tags: ['cyber'] },
  });

  equal(evaluateAbility('shotgun', versus).valid, true);
  equal(evaluateAbility('snipe', versus).valid, true);
  equal(evaluateAbility('emp', versus).valid, true);
  const unmatchedSpecialist = evaluateAbility('depthcharge', versus);
  equal(unmatchedSpecialist.valid, true);
  equal(unmatchedSpecialist.matchingEnemyCount, 0);
  deepStrictEqual(unmatchedSpecialist.reasons, ['bounded competitive fallback']);
  equal(evaluateAbility('not-an-ability', versus).valid, false);
});

test('VS fallback preserves caster resource and hand gates', () => {
  const gated = context([], {
    mode: 'vs',
    playerHp: 100,
    playerMaxHp: 100,
    shieldCharges: 3,
    maxShieldCharges: 3,
    pendingThreats: 0,
    canRefreshHand: false,
    opponent: { present: true, hp: 80, maxHp: 100, tags: [] },
  });

  equal(evaluateAbility('heal', gated).valid, false);
  equal(evaluateAbility('regen', gated).valid, false);
  equal(evaluateAbility('shield', gated).valid, false);
  equal(evaluateAbility('armor', gated).valid, false);
  equal(evaluateAbility('cardflood', gated).valid, false);
  equal(evaluateAbility('drain', gated).valid, false);
  equal(evaluateAbility('nuke', gated).valid, true, 'opponent-count gates may use the bounded duel interpretation');
  equal(evaluateAbility('devolve', gated).valid, true, 'opponent evolution metadata may use the bounded duel interpretation');
});

test('seeded top-band selection varies repeated hands without losing live counters', () => {
  const board = context([
    { tags: ['airborne', 'cyber'], distance: 0.5 },
  ]);
  const availableAbilityIds = [
    'flak', 'emp', 'shield', 'overclock', 'pierce', 'crit', 'turret', 'echo', 'double', 'multishot',
  ] as const;
  const hands = Array.from({ length: 12 }, (_, seed) => (
    composePracticalAbilityHand({ availableAbilityIds, context: board, seed })
      .map(({ id }) => id)
  ));

  ok(hands.every((hand) => hand.length === 3));
  ok(hands.every((hand) => hand.some((id) => id === 'flak' || id === 'emp')));
  ok(hands.every((hand) => hand.every((id) => availableAbilityIds.includes(id as typeof availableAbilityIds[number]))));
  ok(new Set(hands.map((hand) => hand.join(','))).size > 1, 'different seeds should rotate near-best practical hands');
  deepStrictEqual(
    composePracticalAbilityHand({ availableAbilityIds, context: board, seed: 5 }).map(({ id }) => id),
    composePracticalAbilityHand({ availableAbilityIds, context: board, seed: 5 }).map(({ id }) => id),
  );
});

test('specialist readiness matches the effect that will actually execute', () => {
  equal(evaluateAbility('purge', context([
    { tags: ['mutated'], mutationCount: 1 },
  ])).valid, false);
  equal(evaluateAbility('purge', context([
    { tags: ['mutated'], mutationCount: 4 },
  ])).valid, true);

  equal(evaluateAbility('groundwire', context([{ tags: ['heavy'] }])).valid, false);
  equal(evaluateAbility('groundwire', context([{ tags: ['grounded'] }])).valid, true);
  equal(evaluateAbility('rootsnare', context([{ tags: ['mobile', 'airborne'] }])).valid, false);
  equal(evaluateAbility('rootsnare', context([{ tags: ['mobile', 'grounded'] }])).valid, true);
  equal(evaluateAbility('signaljam', context([{ tags: ['phase'] }])).valid, false);
  equal(evaluateAbility('signaljam', context([{ tags: ['cyber', 'phase'] }])).valid, true);
});

test('evolution counters require actual evolution state', () => {
  const ordinary = context([{ tags: ['grounded'], generation: 1, fusionLevel: 0, mutationCount: 0 }]);
  equal(evaluateAbility('devolve', ordinary).valid, false);
  equal(evaluateAbility('separate', ordinary).valid, false);
  equal(evaluateAbility('traittheft', ordinary).valid, false);

  const evolved = context([
    {
      tags: ['fused', 'mutated'],
      generation: 4,
      fusionLevel: 2,
      mutationCount: 3,
    },
  ]);
  equal(evaluateAbility('devolve', evolved).valid, true);
  equal(evaluateAbility('separate', evolved).valid, true);
  equal(evaluateAbility('traittheft', evolved).valid, true);
  equal(evaluateAbility('catalyst', evolved).valid, true);
});

test('every canonical ability can be evaluated without a generic fallback', () => {
  const maximalEnemy: AbilityEnemySnapshot = {
    tags: [
      'airborne', 'aquatic', 'armored', 'botanical', 'burrower', 'colony',
      'converging', 'cryo', 'cyber', 'fast', 'fluidic', 'fused', 'grounded',
      'heavy', 'inside-center', 'light', 'machine', 'mobile', 'mutated',
      'phase', 'regenerator', 'resilient', 'rooted', 'serpentine', 'spectral',
      'tentacled', 'thermal', 'vehicle', 'voltaic', 'void', 'weakened', 'wheel',
    ],
    distance: 0.7,
    species: 'test-species',
    generation: 4,
    fusionLevel: 3,
    mutationCount: 3,
  };
  const board = context([
    maximalEnemy,
    { ...maximalEnemy },
    { ...maximalEnemy },
    { ...maximalEnemy },
  ], {
    playerHp: 1,
    shieldCharges: 0,
    pendingThreats: 2,
  });

  for (const id of CANONICAL_ABILITY_IDS) {
    const result = evaluateAbility(id, board);
    equal(result.id, id);
    ok(Number.isFinite(result.score), `${id} should be practical in the exhaustive fixture`);
    ok(result.valid, `${id} should have a concrete satisfying context`);
  }
});
