import { deepStrictEqual, equal, throws } from 'node:assert/strict';
import { test } from 'node:test';

import { VERSUS_ABILITY_IDS } from './versus-ability-resolver';
import {
  advanceVersusBossAbilityRuntime,
  applyVersusBossVerifiedDamageEffects,
  applyVersusBossVerifiedDamageRecovery,
  createEmptyVersusBossAbilityRuntimeState,
  executeVersusBossAbility,
  launchVersusBossBasicProjectile,
  resolveVersusBossProjectileDamage,
  versusBossPlayerFireRecoveryMultiplier,
  type VersusBossAbilityCombatantState,
} from './versus-boss-ability-runtime';

function combatant(
  overrides: Partial<VersusBossAbilityCombatantState> = {},
): VersusBossAbilityCombatantState {
  return {
    hp: 100,
    maxHp: 100,
    shields: 0,
    maxShields: 2,
    row: 1,
    column: 1,
    fireCooldown: 0,
    moveCooldown: 0,
    cardCooldown: 0,
    ...overrides,
  };
}

function runtime() {
  return createEmptyVersusBossAbilityRuntimeState(
    combatant({ hp: 54, row: 2, column: 1 }),
    combatant({ hp: 72, row: 0, column: 1 }),
  );
}

test('Heal restores the NPC caster and never heals the player', () => {
  const before = runtime();
  const execution = executeVersusBossAbility('heal', before);

  equal(execution.state.npc.hp, 56);
  equal(execution.state.player.hp, 72);
  deepStrictEqual(before, runtime(), 'execution must not mutate its input state');
});

test('Pierce arms the NPC next ordinary shot and the charge is consumed by that shot', () => {
  const armed = executeVersusBossAbility('pierce', runtime());

  equal(armed.projectiles.length, 0, 'Pierce is a setup card, not an extra free shot');
  equal(armed.state.npcStatusRuntime.caster.pierceCharges, 1);

  const launch = launchVersusBossBasicProjectile(armed.state, { power: 2 });
  equal(launch.projectile.owner, 'npc');
  equal(launch.projectile.direction, -1);
  equal(launch.projectile.row, armed.state.player.row);
  equal(launch.projectile.piercing, true);
  equal(launch.state.npcStatusRuntime.caster.pierceCharges, 0);
});

test('an armed NPC Pierce survives frame advancement until consumed or expired', () => {
  const armed = executeVersusBossAbility('pierce', runtime()).state;
  const advanced = advanceVersusBossAbilityRuntime(armed, 1 / 60);
  equal(advanced.npcStatusRuntime.caster.pierceCharges, 1);

  const launch = launchVersusBossBasicProjectile(advanced);
  equal(launch.projectile.piercing, true);
  equal(launch.state.npcStatusRuntime.caster.pierceCharges, 0);

  const expired = advanceVersusBossAbilityRuntime(armed, 9);
  equal(expired.npcStatusRuntime.caster.windows.pierce, undefined);
  equal(expired.npcStatusRuntime.caster.pierceCharges, 0);
});

test('NPC setup windows modify the next ordinary shot and materialize Echo/Turret fire', () => {
  let prepared = executeVersusBossAbility('double', runtime()).state;
  prepared = executeVersusBossAbility('voltage', prepared).state;
  prepared = executeVersusBossAbility('crit', prepared).state;
  prepared = executeVersusBossAbility('echo', prepared).state;
  prepared = executeVersusBossAbility('turret', prepared).state;

  const launch = launchVersusBossBasicProjectile(prepared, {
    row: 1,
    power: 1,
    criticalRoll: 0,
  });

  equal(launch.projectile.power, 6, '2x adaptive damage and a 3x critical are preserved');
  equal(launch.projectile.piercing, true, 'Voltage preserves the playable piercing profile');
  equal(launch.projectile.big, true, 'Voltage preserves the playable broad-shot silhouette');
  equal(launch.projectiles.some((shot) => shot.sourceAbilityId === 'basic:echo'), true);
  deepStrictEqual(
    launch.projectiles
      .filter((shot) => shot.sourceAbilityId === 'basic:turret')
      .map((shot) => shot.row)
      .sort(),
    [0, 2],
  );
});

test('active projectile setup windows also apply to emitted ability projectiles', () => {
  let prepared = executeVersusBossAbility('double', runtime()).state;
  prepared = executeVersusBossAbility('voltage', prepared).state;
  prepared = executeVersusBossAbility('echo', prepared).state;

  const execution = executeVersusBossAbility('shotgun', prepared);
  const primary = execution.projectiles.filter((shot) => !shot.sourceAbilityId.includes(':'));
  const echoes = execution.projectiles.filter((shot) => shot.sourceAbilityId.endsWith(':echo'));
  equal(primary.length, 2, 'edge-lane adjacent fire stays inside the three-row board');
  equal(primary.every((shot) => shot.power === 4 && shot.piercing && shot.big), true);
  equal(echoes.length, primary.length);
});

test('Echo duplicates use real adjacent rows without wrapping the three-row board', () => {
  const prepared = executeVersusBossAbility('echo', runtime()).state;
  const expectedEchoRows = [1, 2, 1] as const;

  for (const sourceRow of [0, 1, 2] as const) {
    const launch = launchVersusBossBasicProjectile(prepared, { row: sourceRow });
    const primary = launch.projectiles.find((shot) => shot.sourceAbilityId === 'basic');
    const echo = launch.projectiles.find((shot) => shot.sourceAbilityId === 'basic:echo');

    equal(primary?.row, sourceRow, `source row ${sourceRow} changed`);
    equal(echo?.row, expectedEchoRows[sourceRow], `source row ${sourceRow} used a non-adjacent Echo lane`);
    equal(echo?.direction, primary?.direction, `source row ${sourceRow} changed Echo direction`);
  }
});

test('NPC Rearguard emits simultaneous forward and rear trajectories from the NPC lane', () => {
  const before = runtime();
  // The fixture deliberately puts the NPC and player in different rows so the
  // assertion also guards against attaching Rearguard to its target's lane.
  equal(before.npc.row, 2);
  equal(before.player.row, 0);

  const execution = executeVersusBossAbility('rearguard', before);

  deepStrictEqual(
    execution.projectiles.map(({ direction, row, power, piercing, salvoIndex }) => ({
      direction,
      row,
      power,
      piercing,
      salvoIndex,
    })),
    [
      { direction: -1, row: 2, power: 3, piercing: true, salvoIndex: 0 },
      { direction: 1, row: 2, power: 3, piercing: true, salvoIndex: 0 },
    ],
  );
});

test('NPC Rearguard applies projectile windows symmetrically without losing either direction', () => {
  let prepared = executeVersusBossAbility('double', runtime()).state;
  prepared = executeVersusBossAbility('voltage', prepared).state;
  prepared = executeVersusBossAbility('echo', prepared).state;

  const execution = executeVersusBossAbility('rearguard', prepared);
  const primary = execution.projectiles.filter((shot) => shot.sourceAbilityId === 'rearguard');
  const echoes = execution.projectiles.filter((shot) => shot.sourceAbilityId === 'rearguard:echo');

  deepStrictEqual(primary.map((shot) => shot.direction), [-1, 1]);
  deepStrictEqual(echoes.map((shot) => shot.direction), [-1, 1]);
  equal(primary.every((shot) => shot.power === 6 && shot.piercing && shot.big), true);
  equal(echoes.every((shot) => shot.row === 1), true);
});

test('target, adjacent, and all-lane NPC projectile patterns remain player-facing', () => {
  const cases = [
    { abilityId: 'seeker', expectedRows: [0] },
    { abilityId: 'shotgun', expectedRows: [0, 1] },
    { abilityId: 'splitter', expectedRows: [0, 0, 1, 1, 2, 2] },
  ] as const;

  for (const { abilityId, expectedRows } of cases) {
    const projectiles = executeVersusBossAbility(abilityId, runtime()).projectiles;
    deepStrictEqual(projectiles.map((shot) => shot.row), expectedRows, `${abilityId} rows changed`);
    equal(
      projectiles.every((shot) => shot.direction === -1),
      true,
      `${abilityId} must remain directed toward the player`,
    );
  }
});

test('NPC integrity multipliers return to neutral when their authored window expires', () => {
  const boosted = executeVersusBossAbility('overdrive', runtime()).state;
  equal(boosted.npcIntegrityMultiplier, 3);
  equal(advanceVersusBossAbilityRuntime(boosted, 1).npcIntegrityMultiplier, 3);
  equal(advanceVersusBossAbilityRuntime(boosted, 5).npcIntegrityMultiplier, 1);
});

test('NPC Overdrive trades player fire rate for bounded Boss card-tempo recovery', () => {
  const before = runtime();
  before.npc.cardCooldown = 2;
  const boosted = executeVersusBossAbility('overdrive', before).state;
  equal(versusBossPlayerFireRecoveryMultiplier(boosted), 2.5);

  const missed = applyVersusBossVerifiedDamageEffects(boosted, 0);
  equal(missed.state.npc.cardCooldown, 2);

  const hit = applyVersusBossVerifiedDamageEffects(boosted, 2);
  equal(hit.state.npc.cardCooldown, 1.4);
});

test('NPC vulnerability marks amplify later projectile hits once within the VS cap', () => {
  const marked = executeVersusBossAbility('radiantmark', runtime()).state;
  equal(resolveVersusBossProjectileDamage(marked, 2), 3);
  equal(resolveVersusBossProjectileDamage(marked, 4), 4);
  equal(resolveVersusBossProjectileDamage(runtime(), 2), 2);
});

test('Drain heals only after verified HP damage and never on cast or a miss', () => {
  const cast = executeVersusBossAbility('drain', runtime());
  equal(cast.state.npc.hp, 54);

  const missed = applyVersusBossVerifiedDamageRecovery(cast.state, 0);
  equal(missed.npc.hp, 54);

  const hit = applyVersusBossVerifiedDamageRecovery(cast.state, 2);
  equal(hit.npc.hp, 56);
  equal(cast.state.npc.hp, 54, 'collision settlement must remain pure');
});

test('Overload releases once after verified NPC HP damage and never on a miss', () => {
  const armed = executeVersusBossAbility('overload', runtime()).state;
  const missed = applyVersusBossVerifiedDamageEffects(armed, 0);
  equal(missed.projectiles.length, 0);
  equal(Boolean(missed.state.npcStatusRuntime.caster.windows.overload), true);

  const triggered = applyVersusBossVerifiedDamageEffects(armed, 2, 1);
  equal(triggered.projectiles.length >= 1, true);
  equal(triggered.projectiles[0]?.sourceAbilityId, 'basic');
  equal(triggered.projectiles[0]?.row, 1);
  equal(triggered.state.npcStatusRuntime.caster.windows.overload, undefined);

  const spent = applyVersusBossVerifiedDamageEffects(triggered.state, 2, 1);
  equal(spent.projectiles.length, 0, 'one Overload cast cannot fire twice');
});

test('Gravity pulls the player into the NPC lane and applies player-side disruption', () => {
  const before = runtime();
  const execution = executeVersusBossAbility('gravity', before);

  equal(execution.state.npc.row, 2);
  equal(execution.state.player.row, 2);
  equal(execution.state.player.moveCooldown, 0.6);
  equal(
    execution.state.npcStatusRuntime.opponent.traits['gravity-well']?.magnitude,
    1,
  );
});

test('unknown abilities fail instead of degrading into a generic NPC attack', () => {
  throws(
    () => executeVersusBossAbility('not-a-real-ability', runtime()),
    /No versus resolver registered/,
  );
});

test('every playable ability executes through the same NPC-side counterpart boundary', () => {
  for (const abilityId of VERSUS_ABILITY_IDS) {
    const execution = executeVersusBossAbility(abilityId, runtime(), {
      playerTraits: ['armored', 'accelerated'],
      playerMovement: 'biped',
      playerElement: 'voltaic',
      playerEntityType: 'synthetic',
      playerFusionLevel: 2,
      playerMutationCount: 3,
    });

    equal(execution.outcome.abilityId, abilityId);
    for (const projectile of execution.projectiles) {
      equal(projectile.owner, 'npc');
      equal(
        projectile.direction === -1 || (abilityId === 'rearguard' && projectile.direction === 1),
        true,
      );
      equal(projectile.row >= 0 && projectile.row <= 2, true);
    }
    if (abilityId === 'rearguard') {
      deepStrictEqual(execution.projectiles.map((projectile) => projectile.direction), [-1, 1]);
    }
  }
});

test('NPC-facing movement reverses authored player-side column deltas', () => {
  const before = runtime();
  const backdash = executeVersusBossAbility('backdash', before);
  equal(backdash.state.npc.column, 2);

  const warpback = executeVersusBossAbility('warpback', before);
  equal(warpback.state.player.column, 0);
});
