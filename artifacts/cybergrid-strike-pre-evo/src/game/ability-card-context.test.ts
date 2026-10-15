import test from 'node:test';
import { deepEqual, doesNotMatch, equal, match, notEqual, ok, throws } from 'node:assert/strict';
import { ABILITY_POOL } from './constants';
import {
  GENERATED_ABILITY_FUNCTIONS,
  type GeneratedAbilityFunction,
  type GeneratedVersusAbilityCard,
} from './generated-versus-ability';
import {
  resolveAbilityCardContext,
  resolveGeneratedPlayerVersusEffect,
} from './ability-card-context';
import type { VersusAbilityContext } from './versus-ability-resolver';

const baseContext: VersusAbilityContext = {
  caster: {
    hp: 7,
    maxHp: 10,
    shields: 1,
    maxShields: 3,
    row: 1,
    column: 1,
  },
  opponent: {
    hp: 80,
    maxHp: 100,
    shields: 1,
    maxShields: 3,
    row: 1,
    column: 4,
  },
  opponentTraits: ['mobile', 'grounded'],
  opponentMovement: 'biped',
  distance: 3,
};

function generatedCard(
  generatedFunction: GeneratedAbilityFunction,
): GeneratedVersusAbilityCard {
  const id = `manifest-kinetic-${generatedFunction}-projector` as const;
  return {
    id,
    abilityId: id,
    name: `${generatedFunction.toUpperCase()} TEST`,
    desc: `Classic ${generatedFunction} description.`,
    cooldown: 10,
    delivery: 'projector',
    function: generatedFunction,
    medium: 'kinetic',
    constitutionSignature: `kinetic:${generatedFunction}:projector`,
    manifestedAt: 1,
  };
}

test('classic copy is unchanged for every canonical ability', () => {
  equal(ABILITY_POOL.length, 80);
  for (const ability of ABILITY_POOL) {
    deepEqual(resolveAbilityCardContext({
      ability,
      gameplay: 'regular-enemies',
    }), {
      label: 'REGULAR ENEMIES',
      description: ability.desc,
    });
  }
});

test('every canonical ability has explicit Boss NPC card copy', () => {
  for (const ability of ABILITY_POOL) {
    const copy = resolveAbilityCardContext({
      ability,
      gameplay: 'versus-boss-npc',
      versusContext: baseContext,
    });
    equal(copy.label, 'VERSUS BOSS NPC');
    notEqual(copy.description, ability.desc);
    match(copy.description, /\S/);
  }
});

test('canonical Boss copy reports context-sensitive recovery and shield capacity', () => {
  const heal = ABILITY_POOL.find(({ id }) => id === 'heal')!;
  const shield = ABILITY_POOL.find(({ id }) => id === 'shield')!;

  match(resolveAbilityCardContext({
    ability: heal,
    gameplay: 'versus-boss-npc',
    versusContext: baseContext,
  }).description, /Restore 2 missing HP/);
  match(resolveAbilityCardContext({
    ability: heal,
    gameplay: 'versus-boss-npc',
    versusContext: {
      ...baseContext,
      caster: { ...baseContext.caster, hp: baseContext.caster.maxHp },
    },
  }).description, /No missing HP to restore/);

  match(resolveAbilityCardContext({
    ability: shield,
    gameplay: 'versus-boss-npc',
    versusContext: baseContext,
  }).description, /Gain 1 shield charge/);
  match(resolveAbilityCardContext({
    ability: shield,
    gameplay: 'versus-boss-npc',
    versusContext: {
      ...baseContext,
      caster: { ...baseContext.caster, shields: baseContext.caster.maxShields },
    },
  }).description, /Shield capacity is already full/);
});

test('canonical Boss copy tracks purge state, marksman range, and hybrid complexity', () => {
  const purge = ABILITY_POOL.find(({ id }) => id === 'purge')!;
  const marksman = ABILITY_POOL.find(({ id }) => id === 'marksman')!;
  const hybridtax = ABILITY_POOL.find(({ id }) => id === 'hybridtax')!;

  match(resolveAbilityCardContext({
    ability: purge,
    gameplay: 'versus-boss-npc',
    versusContext: baseContext,
  }).description, /Deal 2 base damage/);
  match(resolveAbilityCardContext({
    ability: purge,
    gameplay: 'versus-boss-npc',
    versusContext: {
      ...baseContext,
      opponent: { ...baseContext.opponent, hp: 30 },
    },
  }).description, /Deal 4 base damage/);

  match(resolveAbilityCardContext({
    ability: marksman,
    gameplay: 'versus-boss-npc',
    versusContext: { ...baseContext, distance: 2 },
  }).description, /power-2 .*shot/);
  match(resolveAbilityCardContext({
    ability: marksman,
    gameplay: 'versus-boss-npc',
    versusContext: { ...baseContext, distance: 5 },
  }).description, /power-4 .*shot/);

  match(resolveAbilityCardContext({
    ability: hybridtax,
    gameplay: 'versus-boss-npc',
    versusContext: { ...baseContext, opponentFusionLevel: 1 },
  }).description, /Deal 2 base damage/);
  match(resolveAbilityCardContext({
    ability: hybridtax,
    gameplay: 'versus-boss-npc',
    versusContext: { ...baseContext, opponentFusionLevel: 4 },
  }).description, /Deal 5 base damage/);
});

test('Boss copy exposes competitive timing, displacement, statuses, refresh, reward, and projectile facts', () => {
  const byId = (id: string) => ABILITY_POOL.find((ability) => ability.id === id)!;
  const copy = (id: string) => resolveAbilityCardContext({
    ability: byId(id),
    gameplay: 'versus-boss-npc',
    versusContext: baseContext,
  }).description;

  match(copy('time'), /fire delay ≥0\.7s/);
  match(copy('time'), /move delay ≥0\.55s/);
  match(copy('time'), /card delay \+0\.35s/);
  match(copy('time'), /Slow rival actions for 6s/);
  match(copy('warpback'), /Push rival 2 columns back/);
  match(copy('cardflood'), /Immediately replace the current hand with 3 new choices/);
  match(copy('megabomb'), /2x Integrity Work/);
  match(copy('shotgun'), /Fire 1 power-2 heavy shot: your lane and adjacent lanes/);
});

test('Boss copy follows native player branches instead of NPC-only resolver intent', () => {
  const byId = (id: string) => ABILITY_POOL.find((ability) => ability.id === id)!;
  const copy = (id: string, context = baseContext) => resolveAbilityCardContext({
    ability: byId(id),
    gameplay: 'versus-boss-npc',
    versusContext: context,
  }).description;

  match(copy('armor', {
    ...baseContext,
    caster: { ...baseContext.caster, shields: 0 },
  }), /Gain 3 shield charges/);
  match(copy('armor', {
    ...baseContext,
    caster: { ...baseContext.caster, shields: 2 },
  }), /Gain 1 shield charge/);
  match(copy('pierce'), /next shot as piercing/);
  doesNotMatch(copy('pierce'), /8s|@/);

  match(copy('ricochet'), /power-2 piercing shot: all 3 lanes/);
  doesNotMatch(copy('ricochet'), /homing|adjacent/i);
  match(copy('interceptor'), /power-4 heavy shot: the rival's current lane/);
  match(copy('seeker'), /power-4 heavy shot: the rival's current lane/);
  doesNotMatch(copy('interceptor'), /homing/i);
  doesNotMatch(copy('seeker'), /homing/i);
});

test('Boss copy is player-facing and discloses direct-hit defenses', () => {
  for (const ability of ABILITY_POOL) {
    const description = resolveAbilityCardContext({
      ability,
      gameplay: 'versus-boss-npc',
      versusContext: baseContext,
    }).description;
    doesNotMatch(description, /@\d|\bhoming\b/i);
    ok(description.length <= 160, `${ability.id} Boss copy is too dense (${description.length})`);
  }

  const bomb = ABILITY_POOL.find(({ id }) => id === 'bomb')!;
  match(resolveAbilityCardContext({
    ability: bomb,
    gameplay: 'versus-boss-npc',
    versusContext: baseContext,
  }).description, /shield, phase, or Shadow Clone blocks/);
});

test('all generated functions have exact player-side Versus copy and classic copy stays authored', () => {
  equal(GENERATED_ABILITY_FUNCTIONS.length, 7);
  for (const generatedFunction of GENERATED_ABILITY_FUNCTIONS) {
    const ability = generatedCard(generatedFunction);
    const classic = resolveAbilityCardContext({
      ability,
      generatedAbility: ability,
      gameplay: 'regular-enemies',
    });
    equal(classic.description, ability.desc);
    equal(classic.label, 'REGULAR ENEMIES');

    const versus = resolveAbilityCardContext({
      ability,
      generatedAbility: ability,
      gameplay: 'versus-boss-npc',
      versusContext: baseContext,
      rank: 3,
    });
    equal(versus.label, 'VERSUS BOSS NPC');
    match(versus.description, /\S/);
    notEqual(versus.description, ability.desc);
  }

  match(resolveAbilityCardContext({
    ability: generatedCard('rupture'),
    generatedAbility: generatedCard('rupture'),
    gameplay: 'versus-boss-npc',
    versusContext: baseContext,
    rank: 3,
  }).description, /Deal 4 synchronized damage/);
  match(resolveAbilityCardContext({
    ability: generatedCard('ward'),
    generatedAbility: generatedCard('ward'),
    gameplay: 'versus-boss-npc',
    versusContext: baseContext,
    rank: 3,
  }).description, /Gain 2 shield charges/);
  match(resolveAbilityCardContext({
    ability: generatedCard('restore'),
    generatedAbility: generatedCard('restore'),
    gameplay: 'versus-boss-npc',
    versusContext: baseContext,
    rank: 3,
  }).description, /Restore 3 missing HP/);
});

test('generated player-side execution model is exhaustive and preserves current values', () => {
  deepEqual(resolveGeneratedPlayerVersusEffect('rupture', 3), {
    function: 'rupture', damage: 4,
  });
  deepEqual(resolveGeneratedPlayerVersusEffect('inhibit'), {
    function: 'inhibit', minimumFireDelay: 0.7, minimumMoveDelay: 0.55,
  });
  deepEqual(resolveGeneratedPlayerVersusEffect('reveal'), {
    function: 'reveal', minimumFireDelay: 0.7, minimumMoveDelay: 0.55,
  });
  deepEqual(resolveGeneratedPlayerVersusEffect('impulse'), {
    function: 'impulse', opponentColumnDelta: 1, minimumMoveDelay: 0.45,
  });
  deepEqual(resolveGeneratedPlayerVersusEffect('adapt'), {
    function: 'adapt', opponentRowDelta: 1, minimumMoveDelay: 0.4,
  });
  deepEqual(resolveGeneratedPlayerVersusEffect('ward'), {
    function: 'ward', nativeShieldGain: 1, versusAdapterPresentationOnly: true,
  });
  deepEqual(resolveGeneratedPlayerVersusEffect('restore'), {
    function: 'restore', nativeHpRecovery: 2, versusAdapterPresentationOnly: true,
  });
});

test('unknown or malformed cards never receive generic Boss copy', () => {
  throws(() => resolveAbilityCardContext({
    ability: { id: 'future-card', desc: 'Unknown' },
    gameplay: 'versus-boss-npc',
    versusContext: baseContext,
  }), /No Versus card context registered/);
  throws(() => resolveAbilityCardContext({
    ability: ABILITY_POOL[0],
    gameplay: 'versus-boss-npc',
  }), /requires a combat snapshot/);
});
