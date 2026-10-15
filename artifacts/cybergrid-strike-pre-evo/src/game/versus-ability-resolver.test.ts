import { deepStrictEqual, equal, ok, throws } from 'node:assert/strict';
import { test } from 'node:test';

import { ABILITY_POOL } from './constants';
import {
  VERSUS_ABILITY_IDS,
  VERSUS_ABILITY_LIMITS,
  hasMeaningfulVersusEffect,
  resolveVersusAbilityEffect,
  type VersusAbilityContext,
} from './versus-ability-resolver';

const context: VersusAbilityContext = {
  caster: { hp: 62, maxHp: 100, shields: 0, maxShields: 2, row: 1, column: 1 },
  opponent: { hp: 71, maxHp: 100, shields: 1, maxShields: 2, row: 2, column: 4 },
  opponentTraits: ['armored', 'accelerated'],
  opponentMovement: 'hover',
  opponentElement: 'voltaic',
  opponentEntityType: 'mechanical',
  opponentFusionLevel: 2,
  opponentMutationCount: 4,
  distance: 3,
};

const PREVIOUSLY_SILENT_VS_IDS = [
  'drain', 'overdrive', 'overload', 'flak', 'groundwire', 'undertow', 'separate',
  'interceptor', 'adaptive', 'depthcharge', 'tailclamp', 'tanglewire', 'bloombind',
  'elementswap', 'devolve', 'traittheft', 'forcedmolt', 'catalyst',
] as const;

test('shared versus resolver explicitly covers the complete canonical ability pool', () => {
  const poolIds = ABILITY_POOL.map(({ id }) => id).sort();
  const resolverIds = [...VERSUS_ABILITY_IDS].sort();
  deepStrictEqual(resolverIds, poolIds);
  equal(new Set(VERSUS_ABILITY_IDS).size, ABILITY_POOL.length);
  equal(ABILITY_POOL.length, 80);
});

test('every canonical ability resolves to a meaningful bounded outcome', () => {
  for (const abilityId of VERSUS_ABILITY_IDS) {
    const result = resolveVersusAbilityEffect(abilityId, context);
    equal(result.abilityId, abilityId);
    ok(result.summary.length > 12, `${abilityId} needs an explanatory summary`);
    ok(hasMeaningfulVersusEffect(result), `${abilityId} resolved to a silent no-op`);

    ok(result.casterHpDelta >= -VERSUS_ABILITY_LIMITS.maxDirectDamage);
    ok(result.casterHpDelta <= VERSUS_ABILITY_LIMITS.maxRecovery);
    ok(result.opponentHpDelta >= -VERSUS_ABILITY_LIMITS.maxDirectDamage);
    ok(result.opponentHpDelta <= VERSUS_ABILITY_LIMITS.maxRecovery);
    ok(Math.abs(result.casterShieldDelta) <= VERSUS_ABILITY_LIMITS.maxShieldDelta);
    ok(Math.abs(result.opponentShieldDelta) <= VERSUS_ABILITY_LIMITS.maxShieldDelta);
    ok(result.opponentFireDelay <= VERSUS_ABILITY_LIMITS.maxFireDelay);
    ok(result.opponentMoveDelay <= VERSUS_ABILITY_LIMITS.maxMoveDelay);
    ok(result.opponentCardDelay <= VERSUS_ABILITY_LIMITS.maxCardDelay);
    ok(Math.abs(result.casterColumnDelta) <= VERSUS_ABILITY_LIMITS.maxColumnDelta);
    ok(Math.abs(result.opponentColumnDelta) <= VERSUS_ABILITY_LIMITS.maxColumnDelta);
    ok(result.integrityMultiplier <= VERSUS_ABILITY_LIMITS.maxIntegrityMultiplier);
    for (const shot of result.projectiles) {
      ok(shot.power <= VERSUS_ABILITY_LIMITS.maxProjectilePower);
      ok(shot.countPerLane <= VERSUS_ABILITY_LIMITS.maxProjectilesPerLane);
    }
    for (const status of result.statuses) {
      ok(status.duration <= VERSUS_ABILITY_LIMITS.maxStatusDuration);
    }
  }
});

test('all previously silent player-versus abilities now produce their intended setup or payoff', () => {
  for (const abilityId of PREVIOUSLY_SILENT_VS_IDS) {
    const result = resolveVersusAbilityEffect(abilityId, context);
    ok(hasMeaningfulVersusEffect(result), `${abilityId} is still inert`);
    ok(
      result.projectiles.length > 0
      || result.statuses.length > 0
      || result.opponentHpDelta < 0
      || result.casterHpDelta > 0,
      `${abilityId} has no executable setup or payoff`,
    );
  }
});

test('resolver rejects unknown cards instead of silently converting them to a generic attack', () => {
  throws(
    () => resolveVersusAbilityEffect('future-unregistered-card', context),
    /No versus resolver registered/,
  );
});

test('resource cards respect missing health and shield capacity', () => {
  const capped: VersusAbilityContext = {
    ...context,
    caster: { ...context.caster, hp: 99, shields: 2 },
  };
  equal(resolveVersusAbilityEffect('heal', capped).casterHpDelta, 1);
  equal(resolveVersusAbilityEffect('armor', capped).casterShieldDelta, 0);
  equal(resolveVersusAbilityEffect('shield', capped).casterShieldDelta, 0);
});
