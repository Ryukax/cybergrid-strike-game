import { deepStrictEqual, equal, match, ok, throws } from 'node:assert/strict';
import { test } from 'node:test';

import type { AbilityBoardContext } from './ability-system';
import {
  executeGeneratedVersusBossAbility,
  GENERATED_PLAYSTYLE_COMPONENTS,
  generatedVersusAbilityIsPractical,
  readGeneratedVersusAbilityCard,
  resolveGeneratedVersusAbilityEffect,
  selectGeneratedVersusEncounterCard,
  type GeneratedAbilityDelivery,
  type GeneratedAbilityFunction,
  type GeneratedAbilityMedium,
  type GeneratedPlaystyleSignal,
  type GeneratedVersusAbilityCard,
} from './generated-versus-ability';
import { createEmptyVersusBossAbilityRuntimeState } from './versus-boss-ability-runtime';
import {
  createVersusBossCounterpart,
  dealVersusBossAbilityHand,
  useVersusBossAbility,
} from './versus-boss-counterpart';
import type { VersusAbilityContext } from './versus-ability-resolver';

const card = (
  fn: GeneratedAbilityFunction = 'rupture',
  delivery: GeneratedAbilityDelivery = 'field',
  medium: GeneratedAbilityMedium = 'signal',
): GeneratedVersusAbilityCard => {
  const id = `manifest-${medium}-${fn}-${delivery}` as const;
  return {
    id,
    abilityId: id,
    name: `${medium} ${fn} ${delivery}`.toUpperCase(),
    desc: 'An exact stored manifestation.',
    cooldown: 11,
    delivery,
    function: fn,
    medium,
    constitutionSignature: `${medium}:${fn}:${delivery}`,
    manifestedAt: 1234,
  };
};

const styleCard = (signal: GeneratedPlaystyleSignal): GeneratedVersusAbilityCard => {
  const id = `manifest-style-${signal}` as const;
  return {
    id,
    abilityId: id,
    name: `STYLE ${signal}`,
    desc: 'An exact persisted playstyle manifestation.',
    cooldown: 9,
    ...GENERATED_PLAYSTYLE_COMPONENTS[signal],
    constitutionSignature: `playstyle:${signal}`,
    manifestedAt: 1234,
  };
};

const versusContext = (overrides: Partial<VersusAbilityContext> = {}): VersusAbilityContext => ({
  caster: { hp: 3, maxHp: 5, shields: 0, maxShields: 3, row: 1, column: 4 },
  opponent: { hp: 5, maxHp: 5, shields: 0, maxShields: 3, row: 2, column: 1 },
  opponentTraits: ['cyber', 'mobile'],
  opponentEntityType: 'synthetic',
  distance: 3,
  ...overrides,
});

const boardContext = (overrides: Partial<AbilityBoardContext> = {}): AbilityBoardContext => ({
  mode: 'vs',
  enemies: [],
  playerHp: 3,
  playerMaxHp: 5,
  shieldCharges: 0,
  maxShieldCharges: 3,
  pendingThreats: 1,
  opponent: { present: true, hp: 5, maxHp: 5 },
  ...overrides,
});

test('strict persisted-card reader rejects missing or invented components', () => {
  const exact = card();
  deepStrictEqual(readGeneratedVersusAbilityCard(exact), exact);
  equal(readGeneratedVersusAbilityCard({ ...exact, abilityId: 'manifest-other' }), null);
  equal(readGeneratedVersusAbilityCard({ ...exact, medium: 'generic' }), null);
  equal(readGeneratedVersusAbilityCard({ ...exact, function: 'attack' }), null);
  equal(readGeneratedVersusAbilityCard({ ...exact, delivery: 'fallback' }), null);
  throws(
    () => resolveGeneratedVersusAbilityEffect(
      { ...exact, medium: 'generic' } as unknown as GeneratedVersusAbilityCard,
      versusContext(),
    ),
    /no fallback is permitted/i,
  );
});

test('strict persisted-card reader binds ID and constitution signature to the exact tuple', () => {
  const exact = card('rupture', 'field', 'signal');
  equal(readGeneratedVersusAbilityCard({
    ...exact,
    id: 'manifest-signal-restore-field',
    abilityId: 'manifest-signal-restore-field',
  }), null, 'a valid-looking forged ID cannot relabel the stored tuple');
  equal(readGeneratedVersusAbilityCard({
    ...exact,
    function: 'restore',
  }), null, 'a valid component cannot be substituted without changing the ID');
  equal(readGeneratedVersusAbilityCard({
    ...exact,
    constitutionSignature: 'signal:restore:field',
  }), null, 'the constitution signature must attest to the same tuple');
  equal(readGeneratedVersusAbilityCard({
    ...exact,
    id: 'manifest-style-pressure',
    abilityId: 'manifest-style-pressure',
    constitutionSignature: 'playstyle:pressure',
  }), null, 'an unknown style signal cannot manufacture a card');
});

test('strict persisted-card reader accepts all seven authoritative playstyle records', () => {
  const signals = Object.keys(GENERATED_PLAYSTYLE_COMPONENTS) as GeneratedPlaystyleSignal[];
  deepStrictEqual(signals, [
    'manualFire',
    'autoOffFire',
    'movement',
    'abilityUse',
    'rotation',
    'cloneDefense',
    'cloneAutofire',
  ]);
  for (const signal of signals) {
    const exact = styleCard(signal);
    deepStrictEqual(readGeneratedVersusAbilityCard(exact), exact);
  }
});

test('strict persisted-card reader rejects forged playstyle tuples and signatures', () => {
  const exact = styleCard('movement');
  equal(readGeneratedVersusAbilityCard({
    ...exact,
    delivery: 'projector',
  }), null, 'a style card cannot substitute another valid delivery');
  equal(readGeneratedVersusAbilityCard({
    ...exact,
    function: 'rupture',
  }), null, 'a style card cannot substitute another valid function');
  equal(readGeneratedVersusAbilityCard({
    ...exact,
    medium: 'signal',
  }), null, 'a style card cannot substitute another valid medium');
  equal(readGeneratedVersusAbilityCard({
    ...exact,
    constitutionSignature: 'playstyle:manualFire',
  }), null, 'the style signature must name the exact ID signal');
  equal(readGeneratedVersusAbilityCard({
    ...exact,
    id: 'manifest-style-unknownSignal',
    abilityId: 'manifest-style-unknownSignal',
    constitutionSignature: 'playstyle:unknownSignal',
  }), null, 'unknown style signals are rejected');
});

test('encounter selection reaches every valid generated ID over one stable cycle', () => {
  const stored = [
    styleCard('movement'),
    card('restore', 'weave', 'organic'),
    card('rupture', 'field', 'signal'),
    styleCard('manualFire'),
  ];
  const expectedIds = stored.map(({ id }) => id).sort();
  const selectedIds = stored.map((_, ordinal) =>
    selectGeneratedVersusEncounterCard(stored, ordinal)?.id);

  deepStrictEqual(selectedIds, expectedIds);
  equal(
    selectGeneratedVersusEncounterCard([...stored].reverse(), 2)?.id,
    expectedIds[2],
    'persisted array order cannot alter encounter selection',
  );
  equal(
    selectGeneratedVersusEncounterCard(stored, stored.length)?.id,
    expectedIds[0],
    'the next encounter begins the same deterministic cycle',
  );
});

test('encounter selection excludes ambiguous and invalid stored definitions', () => {
  const ambiguous = card('rupture', 'field', 'signal');
  const valid = styleCard('rotation');
  const forged = {
    ...valid,
    function: 'rupture',
  };
  const selected = selectGeneratedVersusEncounterCard([
    ambiguous,
    { ...ambiguous, cooldown: ambiguous.cooldown + 1 },
    valid,
    forged,
    { id: 'manifest-invented', abilityId: 'manifest-invented' },
  ], 0);

  equal(selected, null, 'duplicate IDs and invalid definitions cannot enter an encounter');
  equal(
    selectGeneratedVersusEncounterCard([
      ambiguous,
      { id: valid.id, abilityId: valid.id, name: 'forged duplicate' },
    ], 0)?.id,
    ambiguous.id,
    'an unrelated unique valid ID remains selectable',
  );
});

test('generated resolver preserves delivery, function, and medium explicitly', () => {
  const exact = card('rupture', 'field', 'signal');
  const outcome = resolveGeneratedVersusAbilityEffect(exact, versusContext(), 3);
  deepStrictEqual(outcome.components, {
    delivery: 'field',
    function: 'rupture',
    medium: 'signal',
  });
  equal(outcome.targeting, 'all-lanes');
  equal(outcome.opponentHpDelta, -4);
  equal(outcome.affinityMatched, true);
  match(outcome.summary, /signal rupture via field \(affinity\)/);

  const fallbackTarget = resolveGeneratedVersusAbilityEffect(
    card('rupture', 'projector', 'organic'),
    versusContext({ opponentTraits: [], opponentEntityType: 'synthetic' }),
  );
  equal(fallbackTarget.targeting, 'target-lane');
  equal(fallbackTarget.affinityMatched, false);
  match(fallbackTarget.summary, /fallback target/);
});

test('every generated function resolves to its exact practical operation', () => {
  const rupture = resolveGeneratedVersusAbilityEffect(card('rupture'), versusContext(), 2);
  equal(rupture.opponentHpDelta, -3);

  const inhibit = resolveGeneratedVersusAbilityEffect(card('inhibit'), versusContext(), 2);
  ok(inhibit.opponentFireDelay > 0);
  ok(inhibit.opponentMoveDelay > 0);
  equal(inhibit.statuses[0]?.id, 'time-slow');

  const impulse = resolveGeneratedVersusAbilityEffect(card('impulse'), versusContext(), 2);
  ok(impulse.opponentColumnDelta > 0);
  equal(impulse.statuses[0]?.id, 'staggered');

  const ward = resolveGeneratedVersusAbilityEffect(card('ward', 'shell'), versusContext(), 3);
  equal(ward.targeting, 'self');
  equal(ward.casterShieldDelta, 2);

  const restore = resolveGeneratedVersusAbilityEffect(card('restore', 'weave'), versusContext(), 3);
  equal(restore.targeting, 'self');
  equal(restore.casterHpDelta, 2);

  const reveal = resolveGeneratedVersusAbilityEffect(card('reveal', 'aperture'), versusContext(), 2);
  equal(reveal.statuses[0]?.id, 'revealed');
  ok(reveal.opponentCardDelay > 0);

  const adapt = resolveGeneratedVersusAbilityEffect(card('adapt', 'pulse'), versusContext(), 2);
  equal(adapt.opponentRow, 0);
  equal(adapt.statuses[0]?.id, 'lane-scrambled');
});

test('generated resource cards remain practical only while their resource has room', () => {
  equal(generatedVersusAbilityIsPractical(card('restore', 'weave'), boardContext()), true);
  equal(generatedVersusAbilityIsPractical(
    card('restore', 'weave'),
    boardContext({ playerHp: 5, playerMaxHp: 5 }),
  ), false);
  equal(generatedVersusAbilityIsPractical(card('ward', 'shell'), boardContext()), true);
  equal(generatedVersusAbilityIsPractical(
    card('ward', 'shell'),
    boardContext({ shieldCharges: 3, maxShieldCharges: 3 }),
  ), false);
});

test('counterpart accepts a manifest ID only with its exact stored definition', () => {
  const exact = card('rupture', 'field', 'signal');
  const unsupported = createVersusBossCounterpart({
    skinId: 'chrono',
    playableAbilityPreset: [exact.id],
  });
  deepStrictEqual(unsupported.abilities.pool, []);
  deepStrictEqual(unsupported.abilities.unsupportedAbilityIds, [exact.id]);

  const explicit = createVersusBossCounterpart({
    skinId: 'chrono',
    playableAbilityPreset: [exact.id, 'heal'],
    generatedAbilities: [exact],
  });
  deepStrictEqual(explicit.abilities.pool, [exact.id, 'heal']);
  deepStrictEqual(explicit.abilities.generatedCards[exact.id], exact);
  deepStrictEqual(explicit.abilities.unsupportedAbilityIds, []);

  const dealt = dealVersusBossAbilityHand(explicit, {
    context: boardContext(),
    seed: 4,
  });
  ok(dealt.abilities.hand.includes(exact.id));
  const used = useVersusBossAbility(dealt, exact.id);
  ok(used);
  equal(used.card.kind, 'generated');
  equal(used.cooldown, exact.cooldown);
  equal(used.counterpart.abilities.cooldowns[exact.id], exact.cooldown);
});

test('one-card mixed hands deterministically allow canonical and generated cards', () => {
  const exact = card('rupture', 'field', 'signal');
  const counterpart = createVersusBossCounterpart({
    skinId: 'chrono',
    playableAbilityPreset: [exact.id, 'shotgun'],
    generatedAbilities: [exact],
  });
  const generatedDeal = dealVersusBossAbilityHand(counterpart, {
    context: boardContext(),
    seed: 4,
    size: 1,
  });
  const canonicalDeal = dealVersusBossAbilityHand(counterpart, {
    context: boardContext(),
    seed: 5,
    size: 1,
  });
  deepStrictEqual(generatedDeal.abilities.hand, [exact.id]);
  deepStrictEqual(canonicalDeal.abilities.hand, ['shotgun']);
  deepStrictEqual(
    dealVersusBossAbilityHand(counterpart, {
      context: boardContext(),
      seed: 4,
      size: 1,
    }).abilities.hand,
    generatedDeal.abilities.hand,
    'the class choice must remain deterministic for a given seed',
  );
});

test('one-card mixed dealing never substitutes an impractical or generic fallback', () => {
  const restore = card('restore', 'weave', 'organic');
  const counterpart = createVersusBossCounterpart({
    skinId: 'chrono',
    playableAbilityPreset: [restore.id, 'shotgun'],
    generatedAbilities: [restore],
  });
  const dealt = dealVersusBossAbilityHand(counterpart, {
    context: boardContext({ playerHp: 5, playerMaxHp: 5 }),
    seed: 4,
    size: 1,
  });
  deepStrictEqual(dealt.abilities.hand, ['shotgun']);
});

test('ambiguous duplicate generated definitions are exposed as unsupported', () => {
  const exact = card();
  const counterpart = createVersusBossCounterpart({
    skinId: 'chrono',
    playableAbilityPreset: [exact.id],
    generatedAbilities: [exact, { ...exact, cooldown: 12 }],
  });
  deepStrictEqual(counterpart.abilities.pool, []);
  deepStrictEqual(counterpart.abilities.unsupportedAbilityIds, [exact.id]);
});

test('NPC generated execution applies the resolved operation without a generic shot', () => {
  const runtime = createEmptyVersusBossAbilityRuntimeState(
    {
      hp: 3,
      maxHp: 5,
      shields: 0,
      maxShields: 3,
      row: 1,
      column: 1,
      fireCooldown: 0,
      moveCooldown: 0,
      cardCooldown: 0,
    },
    {
      hp: 5,
      maxHp: 5,
      shields: 0,
      maxShields: 3,
      row: 2,
      column: 1,
      fireCooldown: 0,
      moveCooldown: 0,
      cardCooldown: 0,
    },
  );
  const execution = executeGeneratedVersusBossAbility(
    card('rupture', 'field', 'signal'),
    runtime,
    { playerTraits: ['cyber'], playerEntityType: 'synthetic' },
    2,
  );
  equal(execution.state.player.hp, 2);
  equal(execution.outcome.opponentHpDelta, -3);
  deepStrictEqual(execution.projectiles, []);
  equal(runtime.player.hp, 5, 'execution must not mutate the caller snapshot');
});
