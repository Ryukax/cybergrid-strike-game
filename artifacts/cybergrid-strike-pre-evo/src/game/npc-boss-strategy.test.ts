import { deepStrictEqual, equal, ok } from 'node:assert/strict';
import { test } from 'node:test';

import { CAMPAIGN_ROUTE_BOSS_ROSTER } from './campaign-route-director';
import { ABILITY_LOOKUP } from './constants';
import {
  BOSS_STRATEGY_PROFILES,
  bossStrategyProfile,
  chooseVersusNpcAbility,
  chooseVersusNpcSignature,
  doctrineForSkill,
  resolveVersusNpcAbility,
  shotRowsForPlan,
  type VersusNpcContext,
  type VersusSignaturePlan,
} from './npc-strategy';
import { VERSUS_ABILITY_IDS } from './versus-ability-resolver';

const BOSS_IDS = CAMPAIGN_ROUTE_BOSS_ROSTER.map(({ id }) => id);

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
    playerFireCooldown: 0.7,
    playerMoveCooldown: 0.6,
    cardProgress: 0.2,
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

const TACTICAL_CONTEXTS: ReadonlyArray<Partial<VersusNpcContext>> = [
  {
    step: 1,
    npcHp: 94,
    playerHp: 72,
    npcRow: 1,
    playerRow: 2,
    incomingByRow: [0, 0, 0],
    playerFireCooldown: 0.8,
    playerMoveCooldown: 0.7,
    cardProgress: 0.12,
  },
  {
    step: 2,
    npcHp: 31,
    playerHp: 86,
    npcRow: 0,
    playerRow: 0,
    incomingByRow: [3, 0, 1],
    playerFireCooldown: 0.05,
    playerMoveCooldown: 0.08,
    cardProgress: 0.91,
  },
  {
    step: 3,
    npcHp: 70,
    playerHp: 24,
    npcShields: 2,
    npcRow: 2,
    playerRow: 1,
    incomingByRow: [0, 2, 0],
    playerFireCooldown: 0.12,
    playerMoveCooldown: 0.8,
    cardProgress: 0.48,
  },
  {
    step: 4,
    npcHp: 52,
    playerHp: 52,
    npcRow: 2,
    playerRow: 2,
    incomingByRow: [1, 0, 4],
    playerFireCooldown: 0.9,
    playerMoveCooldown: 0.05,
    cardProgress: 0.72,
  },
  {
    step: 5,
    npcHp: 20,
    playerHp: 20,
    npcShields: 3,
    npcRow: 1,
    playerRow: 1,
    incomingByRow: [0, 0, 0],
    playerFireCooldown: 0.9,
    playerMoveCooldown: 0.9,
    cardProgress: 0.08,
  },
];

function signatureHasEffect(
  before: VersusNpcContext,
  plan: VersusSignaturePlan,
): boolean {
  return shotRowsForPlan(plan).length > 0
    || plan.recovery > 0
    || plan.shields > 0
    || plan.fireDisruption > 0
    || plan.moveDisruption > 0
    || plan.cardPressure > 0
    || plan.columnDelta !== 0
    || plan.moveToRow !== undefined
    || plan.nextMode !== before.signatureMode
    || plan.nextCharges !== before.signatureCharges
    || plan.nextOriginRow !== before.signatureOriginRow
    || plan.nextOriginCol !== before.signatureOriginCol
    || plan.nextPlacements.join(',') !== before.signaturePlacements.join(',');
}

test('all 32 campaign bosses own canonical, distinct three-ability strategy profiles', () => {
  equal(BOSS_IDS.length, 32);
  equal(new Set(BOSS_IDS).size, 32);
  deepStrictEqual(new Set(Object.keys(BOSS_STRATEGY_PROFILES)), new Set(BOSS_IDS));

  const loadoutFingerprints = new Set<string>();
  for (const skillId of BOSS_IDS) {
    const profile = bossStrategyProfile(skillId);
    equal(profile, BOSS_STRATEGY_PROFILES[skillId]);
    equal(profile.skillId, skillId);
    equal(profile.doctrine, doctrineForSkill(skillId));
    equal(profile.abilities.length, 3, `${skillId} must choose exactly three abilities`);
    equal(
      new Set(profile.abilities).size,
      3,
      `${skillId} cannot repeat an ability within its own loadout`,
    );
    for (const abilityId of profile.abilities) {
      ok(ABILITY_LOOKUP[abilityId], `${skillId} references unknown ability ${abilityId}`);
    }
    loadoutFingerprints.add(profile.abilities.join('|'));
  }

  equal(
    loadoutFingerprints.size,
    BOSS_IDS.length,
    'boss strategies must not collapse into shared doctrine-only loadouts',
  );
});

test('every canonical ability card has a campaign Boss NPC encounter parallel', () => {
  const owners = new Map<string, string[]>();

  for (const skillId of BOSS_IDS) {
    for (const abilityId of bossStrategyProfile(skillId).abilities) {
      const abilityOwners = owners.get(abilityId) ?? [];
      abilityOwners.push(skillId);
      owners.set(abilityId, abilityOwners);
    }
  }

  const missing = VERSUS_ABILITY_IDS.filter((abilityId) => !owners.has(abilityId));
  deepStrictEqual(
    missing,
    [],
    `canonical cards without a campaign Boss NPC counterpart: ${missing.join(', ')}`,
  );

  for (const abilityId of VERSUS_ABILITY_IDS) {
    ok(
      (owners.get(abilityId)?.length ?? 0) > 0,
      `${abilityId} must belong to at least one campaign Boss NPC`,
    );
  }
});

test('ability decisions are deterministic, executable, and constrained to each boss loadout', () => {
  for (const skillId of BOSS_IDS) {
    const profile = bossStrategyProfile(skillId);
    const selected = new Set<string>();

    for (const tacticalState of TACTICAL_CONTEXTS) {
      const context = contextFor(skillId, tacticalState);
      const first = chooseVersusNpcAbility(context);
      const repeated = chooseVersusNpcAbility({
        ...context,
        incomingByRow: [...context.incomingByRow] as [number, number, number],
        signaturePlacements: [...context.signaturePlacements],
      });

      deepStrictEqual(repeated, first, `${skillId} produced an unstable decision`);
      ok(
        profile.abilities.includes(first.abilityId),
        `${skillId} selected ${first.abilityId} outside its authored loadout`,
      );
      ok(ABILITY_LOOKUP[first.abilityId], `${skillId} selected an unexecutable ability`);
      equal(first.doctrine, profile.doctrine);
      ok(first.reason.length > 0, `${skillId} ability choice needs a tactical reason`);
      selected.add(first.abilityId);
    }

    ok(
      selected.size >= 2,
      `${skillId} ignored battle state and always selected ${[...selected].join(', ')}`,
    );
  }
});

test('every chosen boss ability resolves to an observable bounded duel effect', () => {
  for (const skillId of BOSS_IDS) {
    const context = contextFor(skillId);
    for (const abilityId of bossStrategyProfile(skillId).abilities) {
      const plan = resolveVersusNpcAbility(abilityId, context);
      const hasEffect = shotRowsForPlan(plan).length > 0
        || plan.recovery > 0
        || plan.shields > 0
        || plan.fireDisruption > 0
        || plan.moveDisruption > 0
        || plan.cardPressure > 0
        || plan.moveToRow !== undefined;
      ok(hasEffect, `${skillId} ability ${abilityId} resolves to no duel effect`);
      ok(plan.salvo >= 1 && plan.salvo <= 3, `${abilityId} emits an unsafe salvo`);
      ok(plan.power >= 1 && plan.power <= 3, `${abilityId} exceeds bounded power`);
    }
  }
});

test('Phoenix and Bloom do not select recovery at full health', () => {
  for (const skillId of ['phoenix', 'bloom']) {
    const plan = chooseVersusNpcAbility(contextFor(skillId, {
      npcHp: 100,
      maxHp: 100,
      npcShields: 0,
      step: 0,
      incomingByRow: [0, 0, 0],
    }));

    ok(
      plan.abilityId !== 'heal' && plan.abilityId !== 'regen',
      `${skillId} wasted its full-health turn on ${plan.abilityId}`,
    );
    ok(
      shotRowsForPlan(plan).length > 0
        || plan.fireDisruption > 0
        || plan.moveDisruption > 0,
      `${skillId} did not replace unusable recovery with practical pressure`,
    );
  }
});

test('defensive Bosses do not select capped shield or armor resources', () => {
  const defensiveBosses = BOSS_IDS.filter((skillId) => (
    bossStrategyProfile(skillId).abilities.some((abilityId) => (
      abilityId === 'shield' || abilityId === 'armor'
    ))
  ));
  deepStrictEqual(
    new Set(defensiveBosses),
    new Set(['architect', 'counter', 'sovereign', 'terra']),
  );
  for (const skillId of defensiveBosses) {
    const plan = chooseVersusNpcAbility(contextFor(skillId, {
      npcHp: 100,
      npcShields: 3,
      maxShields: 3,
      step: 0,
      incomingByRow: [2, 0, 0],
      playerMoveCooldown: 0,
    }));

    ok(
      plan.abilityId !== 'shield' && plan.abilityId !== 'armor',
      `${skillId} wasted its capped-defense turn on ${plan.abilityId}`,
    );
    ok(shotRowsForPlan(plan).length > 0 || plan.moveDisruption > 0);
  }
});

test('counter skills require a live trigger instead of firing on an empty board', () => {
  const quiet = chooseVersusNpcAbility(contextFor('counter', {
    npcHp: 100,
    npcShields: 3,
    maxShields: 3,
    step: 0,
    incomingByRow: [0, 0, 0],
  }));
  ok(quiet.abilityId !== 'returnfire');

  const threatened = chooseVersusNpcAbility(contextFor('counter', {
    npcHp: 100,
    npcShields: 3,
    maxShields: 3,
    step: 0,
    incomingByRow: [0, 2, 0],
  }));
  equal(threatened.abilityId, 'returnfire');
});

test('Drain and Trait Theft recover only from a confirmed projectile hit', () => {
  for (const abilityId of ['drain', 'traittheft']) {
    const plan = resolveVersusNpcAbility(abilityId, contextFor('exchange', {
      npcHp: 25,
      maxHp: 100,
    }));

    equal(plan.recovery, 0, `${abilityId} must not recover merely because it was cast`);
    equal(plan.leechOnHit, 2, `${abilityId} must expose recovery for the hit resolver`);
    deepStrictEqual(shotRowsForPlan(plan), [2]);
  }
});

test('unknown ability IDs become an explicit canonical pressure fallback', () => {
  const plan = resolveVersusNpcAbility('not-a-real-ability', contextFor('apex'));

  equal(plan.abilityId, 'shotgun');
  deepStrictEqual(shotRowsForPlan(plan), [2, 1]);
  equal(plan.power, 2);
  ok(plan.reason.includes('rejected unknown ability not-a-real-ability'));
});

test('every boss can execute effectful signatures across materially different battle states', () => {
  const signatureStates: ReadonlyArray<Partial<VersusNpcContext>> = [
    {
      step: 0,
      npcHp: 100,
      playerHp: 100,
      npcShields: 3,
      npcRow: 1,
      playerRow: 2,
      incomingByRow: [0, 0, 0],
      signatureCharges: 0,
      signaturePlacements: [],
      signatureMode: 0,
      signatureLastCommand: -1,
    },
    {
      step: 1,
      npcHp: 80,
      playerHp: 20,
      npcShields: 3,
      npcRow: 0,
      playerRow: 0,
      incomingByRow: [0, 0, 0],
      signatureCharges: 4,
      signaturePlacements: [0, 1, 2, 3],
      signatureMode: 1,
      signatureLastCommand: 0,
    },
    {
      step: 2,
      npcHp: 25,
      playerHp: 90,
      npcShields: 0,
      npcRow: 2,
      playerRow: 1,
      incomingByRow: [4, 0, 2],
      signatureCharges: 2,
      signaturePlacements: [0, 4],
      signatureMode: 2,
      signatureLastCommand: 2,
    },
    {
      step: 3,
      npcHp: 55,
      playerHp: 55,
      npcShields: 1,
      npcRow: 1,
      playerRow: 1,
      incomingByRow: [0, 1, 0],
      signatureCharges: 1,
      signaturePlacements: [5],
      signatureMode: 0,
      signatureLastCommand: 1,
    },
  ];

  for (const skillId of BOSS_IDS) {
    const visitedCommands = new Set<number>();
    for (const signatureState of signatureStates) {
      const context = contextFor(skillId, signatureState);
      const plan = chooseVersusNpcSignature(context);

      equal(plan.abilityId, skillId);
      equal(plan.doctrine, bossStrategyProfile(skillId).doctrine);
      ok(plan.commandIndex >= 0 && plan.commandIndex <= 2);
      ok(plan.reason.length > 0, `${skillId} signature needs a tactical reason`);
      ok(plan.nextCharges >= 0 && plan.nextCharges <= 4);
      ok(plan.nextPlacements.length <= 4);
      ok(
        signatureHasEffect(context, plan),
        `${skillId} command ${plan.commandIndex} produced no combat or state effect`,
      );
      visitedCommands.add(plan.commandIndex);
    }

    ok(
      visitedCommands.size >= 2,
      `${skillId} ignored signature state and only used command ${[...visitedCommands].join(', ')}`,
    );
  }
});
