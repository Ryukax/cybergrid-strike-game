import { deepStrictEqual, equal, ok, throws } from 'node:assert/strict';
import { test } from 'node:test';

import {
  VERSUS_ABILITY_IDS,
  resolveVersusAbilityEffect,
  type VersusAbilityContext,
  type VersusStatusIntent,
} from './versus-ability-resolver';
import {
  VERSUS_RUNTIME_STATUS_IDS,
  VERSUS_STATUS_RUNTIME_LIMITS,
  advanceVersusStatusRuntime,
  applyVersusStatusIntents,
  hasExecutableVersusStatusPatch,
  type VersusRuntimeWindow,
  type VersusStatusRuntimePatch,
} from './versus-status-runtime';

const context: VersusAbilityContext = {
  caster: { hp: 62, maxHp: 100, shields: 0, maxShields: 2, row: 1, column: 1 },
  opponent: { hp: 71, maxHp: 100, shields: 1, maxShields: 2, row: 2, column: 4 },
  opponentTraits: ['armored', 'accelerated'],
  opponentMovement: 'hover',
  opponentElement: 'voltaic',
  opponentEntityType: 'mechanical',
  opponentFusionLevel: 5,
  opponentMutationCount: 4,
  distance: 3,
};

const emittedIntents = VERSUS_ABILITY_IDS.flatMap((abilityId) =>
  resolveVersusAbilityEffect(abilityId, context).statuses,
);

function allWindows(patch: VersusStatusRuntimePatch): VersusRuntimeWindow[] {
  return [
    ...Object.values(patch.caster.windows),
    ...Object.values(patch.opponent.windows),
    ...Object.values(patch.opponent.traits),
  ].filter((window): window is VersusRuntimeWindow => window !== undefined);
}

test('runtime adapter exhaustively covers every status emitted by the canonical resolver', () => {
  const emittedIds = [...new Set(emittedIntents.map(({ id }) => id))].sort();
  const adapterIds = [...VERSUS_RUNTIME_STATUS_IDS].sort();
  deepStrictEqual(adapterIds, emittedIds);

  for (const intent of emittedIntents) {
    const patch = applyVersusStatusIntents([intent]);
    ok(hasExecutableVersusStatusPatch(patch), `${intent.id} became a runtime no-op`);
    deepStrictEqual(patch.appliedStatusIds, [intent.id]);
  }
});

test('caster setup maps to existing timers plus magnitude-aware runtime windows', () => {
  const abilityIds = [
    'adaptive', 'armor', 'crit', 'drain', 'echo', 'ghost', 'overclock', 'overdrive',
    'overload', 'pierce', 'regen', 'turret', 'voltage',
  ] as const;
  const patch = applyVersusStatusIntents(abilityIds.flatMap((abilityId) =>
    resolveVersusAbilityEffect(abilityId, context).statuses,
  ));

  equal(patch.timers.adaptiveAmmoTimer, 7);
  equal(patch.timers.critTimer, 5);
  equal(patch.timers.drainTimer, 8);
  equal(patch.timers.echoTimer, 5);
  equal(patch.timers.ghostTimer, 4);
  equal(patch.timers.overclockTimer, 6);
  equal(patch.timers.overdriveTimer, 4);
  equal(patch.timers.overloadTimer, 6);
  equal(patch.timers.regenTimer, 8);
  equal(patch.timers.turretTimer, 5);
  equal(patch.timers.voltageTimer, 5);
  equal(patch.caster.barrierCharges, 2);
  equal(patch.caster.pierceCharges, 1);
  equal(patch.caster.windows.damageMultiplier?.magnitude, 1.5);
  equal(patch.caster.windows.criticalChance?.magnitude, 0.4);
  equal(patch.caster.windows.integrityMultiplier?.magnitude, 3);
  equal(patch.caster.windows.regeneration?.stacks, 3);
});

test('opponent statuses retain specialist identity and create practical disruption/payoff windows', () => {
  const abilityIds = [
    'freeze', 'signaljam', 'rootsnare', 'radiantmark', 'elementswap', 'catalyst',
  ] as const;
  const patch = applyVersusStatusIntents(abilityIds.flatMap((abilityId) =>
    resolveVersusAbilityEffect(abilityId, context).statuses,
  ));

  ok((patch.opponent.windows.fireDisruption?.magnitude ?? 0) > 0);
  ok((patch.opponent.windows.moveDisruption?.magnitude ?? 0) > 0);
  ok((patch.opponent.windows.cardDisruption?.magnitude ?? 0) > 0);
  // Catalyst's 1.5 payoff correctly wins over the weaker 1.25 exposure mark.
  equal(patch.opponent.windows.vulnerability?.magnitude, 1.5);
  equal(patch.opponent.windows.rewardMultiplier?.magnitude, 3);
  ok(patch.opponent.traits['time-slow']);
  ok(patch.opponent.traits['signal-jammed']);
  ok(patch.opponent.traits.rooted);
  ok(patch.opponent.traits.revealed);
  ok(patch.opponent.traits['affinity-rotated']);
  ok(patch.opponent.traits['catalyst-mark']);
});

test('durations, magnitudes, stacks, and resource charges remain bounded', () => {
  const extreme: VersusStatusIntent[] = [
    { id: 'adaptive-damage', target: 'caster', duration: 999, magnitude: 999, stacks: 999 },
    { id: 'barrier', target: 'caster', duration: 999, magnitude: 999, stacks: 999 },
    { id: 'pierce', target: 'caster', duration: 999, magnitude: 999, stacks: 999 },
    { id: 'time-slow', target: 'opponent', duration: 999, magnitude: -999, stacks: 999 },
    { id: 'vulnerable', target: 'opponent', duration: 999, magnitude: 999, stacks: 999 },
    { id: 'fire-rate', target: 'opponent', duration: 999, magnitude: 999, stacks: 999 },
    { id: 'fusion-separated', target: 'opponent', duration: 999, magnitude: 999, stacks: 999 },
  ];
  const patch = applyVersusStatusIntents(extreme);

  for (const duration of Object.values(patch.timers)) {
    ok(duration !== undefined && duration <= VERSUS_STATUS_RUNTIME_LIMITS.maxDuration);
  }
  for (const window of allWindows(patch)) {
    ok(window.duration <= VERSUS_STATUS_RUNTIME_LIMITS.maxDuration);
    ok(Math.abs(window.magnitude) <= VERSUS_STATUS_RUNTIME_LIMITS.maxMagnitude);
    ok(window.stacks <= VERSUS_STATUS_RUNTIME_LIMITS.maxStacks);
  }
  equal(patch.caster.barrierCharges, VERSUS_STATUS_RUNTIME_LIMITS.maxBarrierCharges);
  equal(patch.caster.pierceCharges, VERSUS_STATUS_RUNTIME_LIMITS.maxPierceCharges);
  equal(
    patch.opponent.windows.vulnerability?.magnitude,
    VERSUS_STATUS_RUNTIME_LIMITS.maxVulnerability,
  );
});

test('repeated application is pure and merges by longest window/strongest magnitude', () => {
  const first = applyVersusStatusIntents([
    { id: 'vulnerable', target: 'opponent', duration: 2, magnitude: 1.25 },
  ]);
  const snapshot = structuredClone(first);
  const merged = applyVersusStatusIntents([
    { id: 'thermal-fracture', target: 'opponent', duration: 7, magnitude: 1.5 },
  ], first);

  deepStrictEqual(first, snapshot);
  equal(merged.opponent.windows.vulnerability?.duration, 7);
  equal(merged.opponent.windows.vulnerability?.magnitude, 1.5);
  deepStrictEqual(
    merged.opponent.windows.vulnerability?.sources,
    ['vulnerable', 'thermal-fracture'],
  );
});

test('runtime advancement expires windows without replaying one-shot charges', () => {
  const active = applyVersusStatusIntents([
    { id: 'barrier', target: 'caster', duration: 4, magnitude: 1, stacks: 2 },
    { id: 'vulnerable', target: 'opponent', duration: 2, magnitude: 1.5 },
  ]);
  const advanced = advanceVersusStatusRuntime(active, 1.25);

  equal(advanced.caster.barrierCharges, 0);
  equal(advanced.caster.refreshHand, false);
  deepStrictEqual(advanced.timers, {});
  equal(advanced.caster.windows.barrier?.duration, 2.75);
  equal(advanced.opponent.windows.vulnerability?.duration, 0.75);
  equal(advanceVersusStatusRuntime(advanced, 1).opponent.windows.vulnerability, undefined);
});

test('invalid target combinations and unregistered status IDs fail loudly', () => {
  throws(
    () => applyVersusStatusIntents([
      { id: 'vulnerable', target: 'caster', duration: 2, magnitude: 1 },
    ]),
    /expected target opponent/,
  );
  throws(
    () => applyVersusStatusIntents([
      { id: 'future-status', target: 'caster', duration: 2, magnitude: 1 },
    ] as unknown as VersusStatusIntent[]),
    /No runtime adapter registered/,
  );
});
