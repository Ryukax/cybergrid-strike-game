import { deepStrictEqual, equal, ok } from 'node:assert/strict';
import { test } from 'node:test';

import type { AbilityBoardContext } from './ability-system';
import { CAMPAIGN_ROUTE_BOSS_ROSTER } from './campaign-route-director';
import { ABILITY_LOOKUP } from './constants';
import { LORD_ALPHA_SKILL_PREVIEW_ACTIONS } from './lord-alpha';
import { bossStrategyProfile } from './npc-strategy';
import { BOSS_SIGNATURE_COMMANDS } from './npc-skill-presentation';
import { VERSUS_ABILITY_IDS } from './versus-ability-resolver';
import {
  advanceVersusBossAbilityCooldowns,
  createVersusBossCounterpart,
  dealVersusBossAbilityHand,
  selectVersusBossReadyAbility,
  useVersusBossAbility,
  versusBossAbilityHandIsExhausted,
} from './versus-boss-counterpart';

const board = (overrides: Partial<AbilityBoardContext> = {}): AbilityBoardContext => ({
  mode: 'vs',
  enemies: [{ tags: ['grounded', 'mobile'], row: 1, distance: 0.4 }],
  playerHp: 3,
  playerMaxHp: 5,
  shieldCharges: 0,
  maxShieldCharges: 3,
  pendingThreats: 1,
  canRefreshHand: true,
  opponent: { present: true, hp: 4, maxHp: 5 },
  ...overrides,
});
test('counterpart snapshots the selected preset without skin-owned card injection', () => {
  const selectedPreset = ['heal', 'shield', 'shotgun'];
  const chrono = createVersusBossCounterpart({
    skinId: 'chrono',
    playableAbilityPreset: selectedPreset,
  });
  const tidal = createVersusBossCounterpart({
    skinId: 'tidal',
    playableAbilityPreset: selectedPreset,
  });
  selectedPreset.push('nuke');

  deepStrictEqual(chrono.abilities.pool, ['heal', 'shield', 'shotgun']);
  deepStrictEqual(tidal.abilities.pool, chrono.abilities.pool);
  ok(!('counterparts' in chrono));
  ok(!('counterparts' in chrono.signature));
});

test('every advanced boss skin resolves only its own exact signature', () => {
  for (const skillId of Object.keys(BOSS_SIGNATURE_COMMANDS)) {
    const counterpart = createVersusBossCounterpart({
      skinId: skillId,
      playableAbilityPreset: [],
    });
    equal(counterpart.signature.kind, 'boss-skill');
    equal(counterpart.signature.id, skillId);
    deepStrictEqual(counterpart.signature.actionIds, BOSS_SIGNATURE_COMMANDS[skillId as keyof typeof BOSS_SIGNATURE_COMMANDS]);
  }
});

test('Assembly uses its selected signature and preserves Shadow Clone as its default', () => {
  const shadow = createVersusBossCounterpart({
    skinId: 'assembly',
    playableAbilityPreset: [],
  });
  deepStrictEqual(shadow.signature, {
    kind: 'assembly-shadow',
    id: 'shadow',
    actionIds: ['shadow-clone'],
  });

  const selected = createVersusBossCounterpart({
    skinId: 'assembly',
    playableAbilityPreset: [],
    assemblySkillId: 'echo',
  });
  equal(selected.signature.kind, 'boss-skill');
  equal(selected.signature.id, 'echo');
  deepStrictEqual(selected.signature.actionIds, BOSS_SIGNATURE_COMMANDS.echo);

  const invalid = createVersusBossCounterpart({
    skinId: 'assembly',
    playableAbilityPreset: [],
    assemblySkillId: 'not-a-skill',
  });
  deepStrictEqual(invalid.signature, {
    kind: 'unsupported',
    id: 'not-a-skill',
    actionIds: [],
  });
});

test('Lord Alpha counterpart exposes all nine exact signature actions', () => {
  const counterpart = createVersusBossCounterpart({
    skinId: 'lord-alpha',
    playableAbilityPreset: ['arcweb', 'gravity'],
  });
  equal(counterpart.signature.kind, 'lord-alpha');
  deepStrictEqual(
    counterpart.signature.actionIds,
    LORD_ALPHA_SKILL_PREVIEW_ACTIONS.map(({ id }) => id),
  );
});

test('unsupported preset entries are reported and never replaced by a generic card', () => {
  const counterpart = createVersusBossCounterpart({
    skinId: 'default',
    playableAbilityPreset: ['heal', 'manifest-custom', 'heal', 'not-real'],
  });
  deepStrictEqual(counterpart.abilities.pool, ['heal']);
  deepStrictEqual(counterpart.abilities.unsupportedAbilityIds, ['manifest-custom', 'not-real']);
  equal(counterpart.signature.kind, 'none');
});

test('all canonical versus abilities can be owned by one explicit preset', () => {
  const counterpart = createVersusBossCounterpart({
    skinId: 'chrono',
    playableAbilityPreset: VERSUS_ABILITY_IDS,
  });
  deepStrictEqual(counterpart.abilities.pool, VERSUS_ABILITY_IDS);
  deepStrictEqual(counterpart.abilities.unsupportedAbilityIds, []);
});

test('every route Boss creates the exact authored card counterpart pool', () => {
  for (const boss of CAMPAIGN_ROUTE_BOSS_ROSTER) {
    const counterpart = createVersusBossCounterpart({
      skinId: boss.id,
      playableAbilityPreset: bossStrategyProfile(boss.id).abilities,
    });
    deepStrictEqual(
      counterpart.abilities.pool,
      bossStrategyProfile(boss.id).abilities,
      `${boss.id} must enter the encounter with its authored parallels`,
    );
  }
});

test('live ready-card selection rechecks resources and reactive pressure', () => {
  const resourceCounterpart = dealVersusBossAbilityHand(
    createVersusBossCounterpart({
      skinId: 'bloom',
      playableAbilityPreset: ['heal', 'shield', 'shotgun'],
    }),
    { context: board(), seed: 11 },
  );
  const resourceChoice = selectVersusBossReadyAbility(resourceCounterpart, {
    context: board({
      playerHp: 5,
      playerMaxHp: 5,
      shieldCharges: 3,
      maxShieldCharges: 3,
    }),
    seed: 11,
  });
  equal(resourceChoice, 'shotgun', 'full Boss resources must withhold Heal and Shield');

  const counterCounterpart = dealVersusBossAbilityHand(
    createVersusBossCounterpart({
      skinId: 'counter',
      playableAbilityPreset: ['returnfire', 'mirror', 'shield'],
    }),
    {
      context: board({
        shieldCharges: 3,
        maxShieldCharges: 3,
        pendingThreats: 1,
        opponent: { present: true, hp: 4, maxHp: 5, tags: ['inside-center'] },
      }),
      seed: 17,
    },
  );
  const quietChoice = selectVersusBossReadyAbility(counterCounterpart, {
    context: board({
      shieldCharges: 3,
      maxShieldCharges: 3,
      pendingThreats: 0,
      opponent: { present: true, hp: 4, maxHp: 5, tags: [] },
    }),
    seed: 17,
  });
  equal(quietChoice, 'mirror', 'Return Fire must wait for live incoming pressure');

  const threatenedChoice = selectVersusBossReadyAbility(counterCounterpart, {
    context: board({
      shieldCharges: 3,
      maxShieldCharges: 3,
      pendingThreats: 2,
      opponent: { present: true, hp: 4, maxHp: 5, tags: ['inside-center'] },
    }),
    seed: 17,
  });
  equal(threatenedChoice, 'returnfire');
});

test('NPC hand state is independent, practical, cooldown-aware, and immutable', () => {
  const original = createVersusBossCounterpart({
    skinId: 'chrono',
    playableAbilityPreset: ['heal', 'shield', 'shotgun', 'overclock'],
  });
  const dealt = dealVersusBossAbilityHand(original, { context: board(), seed: 41 });

  deepStrictEqual(original.abilities.hand, []);
  equal(dealt.abilities.hand.length, 3);
  ok(dealt.abilities.hand.every((abilityId) => dealt.abilities.pool.includes(abilityId)));

  const abilityId = dealt.abilities.hand[0];
  const used = useVersusBossAbility(dealt, abilityId);
  ok(used);
  deepStrictEqual(dealt.abilities.usedAbilityIds, []);
  deepStrictEqual(used.counterpart.abilities.usedAbilityIds, [abilityId]);
  equal(used.cooldown, ABILITY_LOOKUP[abilityId].cooldown);
  equal(useVersusBossAbility(used.counterpart, abilityId), null);

  const cooled = advanceVersusBossAbilityCooldowns(
    used.counterpart,
    used.cooldown + 1,
  );
  equal(cooled.abilities.cooldowns[abilityId], 0);

  let exhausted = dealt;
  for (const card of dealt.abilities.hand) {
    exhausted = useVersusBossAbility(exhausted, card)?.counterpart ?? exhausted;
  }
  ok(versusBossAbilityHandIsExhausted(exhausted));
});
