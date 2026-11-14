import { deepStrictEqual, equal, match, ok } from 'node:assert/strict';
import { test } from 'node:test';

import { CAMPAIGN_ROUTE_BOSS_ROSTER } from './campaign-route-director';
import { ABILITY_LOOKUP } from './constants';
import {
  BOSS_STRATEGY_PROFILES,
  bossStrategyProfile,
  chooseVersusNpcAbility,
  chooseVersusNpcSignature,
  doctrineForSkill,
  rankVersusNpcAbilities,
  resolveVersusNpcAbility,
  shotRowsForPlan,
  type VersusNpcContext,
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

test('ready-card ranking preserves each boss opening, pressure, and payoff progression', () => {
  const phases = [
    { npcHp: 90, expected: 'barrage', reason: /^opening:/ },
    { npcHp: 55, expected: 'shotgun', reason: /^pressure:/ },
    { npcHp: 20, expected: 'overclock', reason: /^desperation:/ },
  ] as const;

  for (const phase of phases) {
    const ranked = rankVersusNpcAbilities(contextFor('arsenal', {
      npcHp: phase.npcHp,
      incomingByRow: [0, 0, 0],
    }));
    equal(ranked[0]?.abilityId, phase.expected);
    match(ranked[0]?.reason ?? '', phase.reason);
    const owned = new Set<string>(bossStrategyProfile('arsenal').abilities);
    ok(ranked.every(({ abilityId }) => owned.has(abilityId)));
  }
});

test('reactive ranking elevates a boss-owned counter only while its trigger is live', () => {
  const quiet = rankVersusNpcAbilities(contextFor('counter', {
    incomingByRow: [0, 0, 0],
  }));
  ok(!quiet.some(({ abilityId }) => abilityId === 'returnfire'));

  const threatened = rankVersusNpcAbilities(contextFor('counter', {
    incomingByRow: [0, 3, 0],
  }));
  equal(threatened[0]?.abilityId, 'returnfire');
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

test('Resonance establishes two nodes before releasing its multi-lane payoff', () => {
  const opening = chooseVersusNpcSignature(contextFor('resonance'));
  equal(opening.commandIndex, 0);
  equal(opening.intent, 'setup');
  equal(opening.strategyStage, 'setup');
  equal(opening.objectiveCommandIndex, 2);
  equal(opening.objectiveIntent, 'attack');
  equal(opening.payoffReady, false);
  equal(opening.nextCharges, 1);
  deepStrictEqual(opening.nextPlacements, [5]);

  const secondNode = chooseVersusNpcSignature(contextFor('resonance', {
    step: 1,
    signatureCharges: opening.nextCharges,
    signaturePlacements: opening.nextPlacements,
    signatureLastCommand: opening.commandIndex,
  }));
  equal(secondNode.commandIndex, 1);
  equal(secondNode.strategyStage, 'setup');
  equal(secondNode.objectiveCommandIndex, 2);
  equal(secondNode.payoffReady, false);
  equal(secondNode.nextCharges, 2);
  deepStrictEqual(secondNode.nextPlacements, [5, 5]);

  const release = chooseVersusNpcSignature(contextFor('resonance', {
    step: 2,
    signatureCharges: secondNode.nextCharges,
    signaturePlacements: secondNode.nextPlacements,
    signatureLastCommand: secondNode.commandIndex,
  }));
  equal(release.commandIndex, 2);
  equal(release.intent, 'attack');
  equal(release.strategyStage, 'execute');
  equal(release.payoffReady, true);
  deepStrictEqual(shotRowsForPlan(release), [0, 1, 2]);
  equal(release.nextCharges, 0);
  deepStrictEqual(release.nextPlacements, []);
});

test('Chrono banks one recorded setup before executing its control payoff', () => {
  const bank = chooseVersusNpcSignature(contextFor('chrono'));
  equal(bank.commandIndex, 0);
  equal(bank.intent, 'setup');
  equal(bank.strategyStage, 'setup');
  equal(bank.objectiveCommandIndex, 2);
  equal(bank.objectiveIntent, 'control');
  equal(bank.payoffReady, false);
  equal(bank.nextCharges, 1);
  deepStrictEqual(bank.nextPlacements, [5]);

  const rewind = chooseVersusNpcSignature(contextFor('chrono', {
    step: 1,
    signatureCharges: bank.nextCharges,
    signaturePlacements: bank.nextPlacements,
    signatureLastCommand: bank.commandIndex,
  }));
  equal(rewind.commandIndex, 2);
  equal(rewind.intent, 'control');
  equal(rewind.strategyStage, 'execute');
  equal(rewind.payoffReady, true);
  ok(rewind.fireDisruption > 0);
  ok(rewind.moveDisruption > 0);
  equal(rewind.nextCharges, 0);
  deepStrictEqual(rewind.nextPlacements, []);
});

test('Predator Hunts before committing its TARGET payoff', () => {
  const hunt = chooseVersusNpcSignature(contextFor('predator'));
  equal(hunt.commandIndex, 0);
  equal(hunt.intent, 'setup');
  equal(hunt.strategyStage, 'setup');
  equal(hunt.objectiveCommandIndex, 1);
  equal(hunt.objectiveIntent, 'attack');
  equal(hunt.payoffReady, false);
  equal(hunt.nextCharges, 1);
  deepStrictEqual(shotRowsForPlan(hunt), []);

  const target = chooseVersusNpcSignature(contextFor('predator', {
    step: 1,
    signatureCharges: hunt.nextCharges,
    signatureLastCommand: hunt.commandIndex,
  }));
  equal(target.commandIndex, 1);
  equal(target.intent, 'attack');
  equal(target.strategyStage, 'execute');
  equal(target.payoffReady, true);
  equal(target.shotPattern, 'target');
  deepStrictEqual(shotRowsForPlan(target), [2]);
  equal(target.power, 2);
  equal(target.big, true);
  equal(target.nextCharges, 0);
});

test('Rift establishes an aperture before prioritizing its placement-gated maneuver', () => {
  const aperture = chooseVersusNpcSignature(contextFor('rift'));
  equal(aperture.commandIndex, 0);
  equal(aperture.intent, 'setup');
  equal(aperture.strategyStage, 'setup');
  equal(aperture.objectiveCommandIndex, 1);
  equal(aperture.objectiveIntent, 'maneuver');
  equal(aperture.payoffReady, false);
  equal(aperture.nextObjectiveCommand, 1);
  deepStrictEqual(aperture.nextPlacements, [5]);

  const fold = chooseVersusNpcSignature(contextFor('rift', {
    step: 1,
    signatureCharges: aperture.nextCharges,
    signaturePlacements: aperture.nextPlacements,
    signatureLastCommand: aperture.commandIndex,
    signatureObjectiveCommand: aperture.nextObjectiveCommand,
  }));
  equal(fold.commandIndex, 1);
  equal(fold.intent, 'maneuver');
  equal(fold.objectiveCommandIndex, 1);
  equal(fold.payoffReady, true);
  equal(fold.columnDelta, -1);
  equal(fold.nextObjectiveCommand, -1);
});

test('higher-threshold Terra and Tempest objectives stay sticky across setup beats', () => {
  const cases = [
    {
      skillId: 'terra',
      context: { npcHp: 50, incomingByRow: [0, 2, 0] as [number, number, number] },
      objectiveCommand: 2,
      objectiveIntent: 'guard',
    },
    {
      skillId: 'tempest',
      context: { npcHp: 78, incomingByRow: [0, 0, 0] as [number, number, number] },
      objectiveCommand: 1,
      objectiveIntent: 'attack',
    },
  ] as const;

  for (const scenario of cases) {
    const firstSetup = chooseVersusNpcSignature(contextFor(
      scenario.skillId,
      scenario.context,
    ));
    equal(firstSetup.commandIndex, 0);
    equal(firstSetup.strategyStage, 'setup');
    equal(firstSetup.objectiveCommandIndex, scenario.objectiveCommand);
    equal(firstSetup.objectiveIntent, scenario.objectiveIntent);
    equal(firstSetup.payoffReady, false);
    equal(firstSetup.nextCharges, 1);
    equal(firstSetup.nextObjectiveCommand, scenario.objectiveCommand);

    const secondSetup = chooseVersusNpcSignature(contextFor(scenario.skillId, {
      ...scenario.context,
      step: 1,
      signatureCharges: firstSetup.nextCharges,
      signaturePlacements: firstSetup.nextPlacements,
      signatureLastCommand: firstSetup.commandIndex,
      signatureObjectiveCommand: firstSetup.nextObjectiveCommand,
    }));
    equal(secondSetup.commandIndex, 0);
    equal(secondSetup.strategyStage, 'setup');
    equal(secondSetup.objectiveCommandIndex, scenario.objectiveCommand);
    equal(secondSetup.payoffReady, false);
    equal(secondSetup.nextCharges, 2);
    equal(secondSetup.nextObjectiveCommand, scenario.objectiveCommand);

    const payoff = chooseVersusNpcSignature(contextFor(scenario.skillId, {
      ...scenario.context,
      step: 2,
      signatureCharges: secondSetup.nextCharges,
      signaturePlacements: secondSetup.nextPlacements,
      signatureLastCommand: secondSetup.commandIndex,
      signatureObjectiveCommand: secondSetup.nextObjectiveCommand,
    }));
    equal(payoff.commandIndex, scenario.objectiveCommand);
    equal(payoff.intent, scenario.objectiveIntent);
    equal(payoff.strategyStage, 'execute');
    equal(payoff.payoffReady, true);
    equal(payoff.nextObjectiveCommand, -1);
  }
});

test('the same pressure state coordinates different owned cards with each exact signature', () => {
  const expectations = [
    { skillId: 'resonance', abilityId: 'sonicnet', objective: /coordinate resonance command 3 attack/ },
    { skillId: 'chrono', abilityId: 'freeze', objective: /coordinate chrono command 3 control/ },
    { skillId: 'predator', abilityId: 'marksman', objective: /coordinate predator command 2 attack/ },
  ] as const;

  for (const expectation of expectations) {
    const ranked = rankVersusNpcAbilities(contextFor(expectation.skillId, {
      npcHp: 55,
      playerFireCooldown: 0.1,
      playerMoveCooldown: 0.1,
      cardProgress: 0.8,
      incomingByRow: [0, 0, 0],
    }));
    equal(ranked[0]?.abilityId, expectation.abilityId);
    match(ranked[0]?.reason ?? '', expectation.objective);
    ok(bossStrategyProfile(expectation.skillId).abilities.includes(expectation.abilityId));
  }
});
