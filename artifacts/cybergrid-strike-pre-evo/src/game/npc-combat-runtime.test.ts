import { deepStrictEqual, equal, ok } from 'node:assert/strict';
import { test } from 'node:test';

import { CAMPAIGN_ROUTE_BOSS_ROSTER } from './campaign-route-director';
import { COMPETITIVE_RULESET } from './competitive-balance';
import {
  applyVersusNpcCombatPlan,
  type VersusNpcCombatApplication,
  type VersusNpcCombatRuntimeState,
} from './npc-combat-runtime';
import {
  bossStrategyProfile,
  resolveVersusNpcAbility,
  type VersusNpcContext,
  type VersusSignaturePlan,
} from './npc-strategy';

function contextFor(skillId: string): VersusNpcContext {
  return {
    skillId,
    npcHp: 54,
    playerHp: 68,
    maxHp: COMPETITIVE_RULESET.maxHp,
    npcShields: 0,
    maxShields: COMPETITIVE_RULESET.maxShields,
    npcRow: 1,
    playerRow: 2,
    npcCol: 1,
    incomingByRow: [1, 2, 0],
    playerFireCooldown: 0,
    playerMoveCooldown: 0,
    cardProgress: 0.72,
    step: 3,
    signatureMode: 0,
    signatureCharges: 0,
    signaturePlacements: [],
    signatureOriginRow: 1,
    signatureOriginCol: 1,
    signatureLastCommand: -1,
  };
}

function runtimeState(
  overrides: Partial<VersusNpcCombatRuntimeState> = {},
): VersusNpcCombatRuntimeState {
  return {
    npc: {
      row: 1,
      col: 1,
      hp: 54,
      shieldCharges: 0,
      signatureMode: 0,
      signatureCharges: 0,
      signaturePlacements: [],
      signatureOriginRow: 1,
      signatureOriginCol: 1,
      ...overrides.npc,
    },
    player: {
      fireCooldown: 0,
      moveCooldown: 0,
      ...overrides.player,
    },
    cardsReady: overrides.cardsReady ?? false,
    cardTimer: overrides.cardTimer ?? 6,
  };
}

function hasConcreteEffect(
  before: VersusNpcCombatRuntimeState,
  after: VersusNpcCombatApplication,
): boolean {
  return after.projectiles.length > 0
    || JSON.stringify(after.npc) !== JSON.stringify(before.npc)
    || JSON.stringify(after.player) !== JSON.stringify(before.player)
    || after.cardTimer !== before.cardTimer;
}

test('plan application clamps board movement and emits the applied projectile rows', () => {
  const before = runtimeState({
    npc: {
      row: 0,
      col: 2,
      hp: 54,
      shieldCharges: 0,
      signatureMode: 0,
      signatureCharges: 0,
      signaturePlacements: [],
      signatureOriginRow: 0,
      signatureOriginCol: 2,
    },
  });
  const plan: VersusSignaturePlan = {
    ...resolveVersusNpcAbility('shotgun', contextFor('hijack')),
    targetRow: 99,
    moveToRow: 99,
    commandIndex: 0,
    intent: 'attack',
    columnDelta: 8,
    nextMode: 1,
    nextCharges: 2,
    nextPlacements: [8],
    nextOriginRow: 2,
    nextOriginCol: 2,
  };

  const applied = applyVersusNpcCombatPlan(plan, before);

  equal(applied.npc.row, 2);
  equal(applied.npc.col, 2);
  deepStrictEqual(applied.projectiles.map(({ row }) => row), [2, 1]);
  deepStrictEqual(before.npc.signaturePlacements, []);
});

test('recovery, shields, and disruption stay inside the competitive caps', () => {
  const plan: VersusSignaturePlan = {
    ...resolveVersusNpcAbility('shotgun', contextFor('terra')),
    shotPattern: 'none',
    recovery: 99,
    shields: 99,
    fireDisruption: 99,
    moveDisruption: 99,
    cardPressure: 99,
    commandIndex: 0,
    intent: 'guard',
    columnDelta: 0,
    nextMode: 0,
    nextCharges: 0,
    nextPlacements: [],
    nextOriginRow: 1,
    nextOriginCol: 1,
  };
  const applied = applyVersusNpcCombatPlan(plan, runtimeState({
    npc: {
      row: 1,
      col: 1,
      hp: 99,
      shieldCharges: COMPETITIVE_RULESET.maxShields - 1,
      signatureMode: 0,
      signatureCharges: 0,
      signaturePlacements: [],
      signatureOriginRow: 1,
      signatureOriginCol: 1,
    },
    cardTimer: 1,
  }));

  equal(applied.npc.hp, COMPETITIVE_RULESET.maxHp);
  equal(applied.npc.shieldCharges, COMPETITIVE_RULESET.maxShields);
  equal(applied.player.fireCooldown, COMPETITIVE_RULESET.maxFireDisruption);
  equal(applied.player.moveCooldown, COMPETITIVE_RULESET.maxMoveDisruption);
  equal(applied.cardTimer, 0);
});

test('leech remains projectile metadata and never heals merely because it was cast', () => {
  for (const abilityId of ['drain', 'traittheft']) {
    const context = contextFor('exchange');
    context.npcHp = 21;
    const before = runtimeState({
      npc: {
        row: 1,
        col: 1,
        hp: 21,
        shieldCharges: 0,
        signatureMode: 0,
        signatureCharges: 0,
        signaturePlacements: [],
        signatureOriginRow: 1,
        signatureOriginCol: 1,
      },
    });
    const applied = applyVersusNpcCombatPlan(
      resolveVersusNpcAbility(abilityId, context),
      before,
    );

    equal(applied.npc.hp, before.npc.hp, `${abilityId} healed during cast`);
    equal(applied.projectiles.length, 1);
    equal(applied.projectiles[0]?.leechOnHit, 2);
  }
});

test('all 32 bosses have three authored ability plans that apply concretely', () => {
  equal(CAMPAIGN_ROUTE_BOSS_ROSTER.length, 32);
  for (const boss of CAMPAIGN_ROUTE_BOSS_ROSTER) {
    const context = contextFor(boss.id);
    const profile = bossStrategyProfile(boss.id);
    equal(profile.abilities.length, 3);

    for (const abilityId of profile.abilities) {
      const before = runtimeState();
      const plan = resolveVersusNpcAbility(abilityId, context);
      const applied = applyVersusNpcCombatPlan(plan, before);

      ok(
        hasConcreteEffect(before, applied),
        `${boss.id} ability ${abilityId} had no applied combat effect`,
      );
      for (const projectile of applied.projectiles) {
        ok(projectile.row >= 0 && projectile.row <= 2);
        ok(projectile.power >= 1 && projectile.power <= 3);
        ok(projectile.salvoIndex >= 0 && projectile.salvoIndex < 3);
      }
    }
  }
});
