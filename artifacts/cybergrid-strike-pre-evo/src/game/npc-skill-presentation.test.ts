import { deepStrictEqual, equal, ok } from 'node:assert/strict';
import { test } from 'node:test';

import { CAMPAIGN_ROUTE_BOSS_ROSTER } from './campaign-route-director';
import { ABILITY_LOOKUP } from './constants';
import {
  BOSS_ABILITY_MOTIFS,
  BOSS_SIGNATURE_COMMANDS,
  BOSS_SIGNATURE_MOTIFS,
  BOSS_SKILL_COLORS,
  SKILL_VFX_SEQUENCE,
  resolveNpcAbilityPresentation,
  resolveNpcSignaturePresentation,
  type BossSkillId,
} from './npc-skill-presentation';
import {
  BOSS_STRATEGY_PROFILES,
  resolveVersusNpcAbility,
  type VersusNpcContext,
  type VersusSignaturePlan,
} from './npc-strategy';

const contextFor = (skillId: string): VersusNpcContext => ({
  skillId,
  npcHp: 70,
  playerHp: 55,
  maxHp: 100,
  npcShields: 1,
  maxShields: 3,
  npcRow: 1,
  playerRow: 2,
  npcCol: 1,
  incomingByRow: [0, 2, 0],
  playerFireCooldown: 0,
  playerMoveCooldown: 0,
  cardProgress: 0.8,
  step: 2,
  signatureMode: 1,
  signatureCharges: 3,
  signaturePlacements: [0, 4],
  signatureOriginRow: 1,
  signatureOriginCol: 1,
  signatureLastCommand: -1,
});

test('presentation registries cover the complete campaign boss roster', () => {
  const rosterIds = CAMPAIGN_ROUTE_BOSS_ROSTER.map(({ id }) => id).sort();
  deepStrictEqual(Object.keys(BOSS_SIGNATURE_COMMANDS).sort(), rosterIds);
  deepStrictEqual(Object.keys(BOSS_SIGNATURE_MOTIFS).sort(), rosterIds);
  deepStrictEqual(Object.keys(BOSS_SKILL_COLORS).sort(), rosterIds);

  for (const bossId of rosterIds) {
    equal(BOSS_SIGNATURE_COMMANDS[bossId].length, 3);
    equal(BOSS_SIGNATURE_MOTIFS[bossId].length, 3);
    equal(BOSS_SKILL_COLORS[bossId].length, 2);
  }
});

test('every boss loadout ability resolves to an exact authored presentation', () => {
  for (const boss of CAMPAIGN_ROUTE_BOSS_ROSTER) {
    const bossId = boss.id as BossSkillId;
    const profile = BOSS_STRATEGY_PROFILES[bossId];
    const keys = new Set<string>();
    for (const [index, abilityId] of profile.abilities.entries()) {
      ok(BOSS_ABILITY_MOTIFS[abilityId], `${bossId}/${abilityId} lacks a semantic motif`);
      const plan = resolveVersusNpcAbility(abilityId, contextFor(bossId));
      const presentation = resolveNpcAbilityPresentation(plan, bossId, index + 1);
      equal(presentation.abilityId, plan.abilityId);
      equal(presentation.source, 'ability');
      equal(presentation.label, ABILITY_LOOKUP[abilityId]?.name);
      ok(SKILL_VFX_SEQUENCE[presentation.motif]);
      keys.add(presentation.presentationKey);
    }
    equal(keys.size, 3, `${bossId} collapsed its ability presentations`);
  }
});

test('all boss signature commands preserve command identity and authored motif', () => {
  for (const boss of CAMPAIGN_ROUTE_BOSS_ROSTER) {
    const bossId = boss.id as BossSkillId;
    for (const commandIndex of [0, 1, 2] as const) {
      const plan: VersusSignaturePlan = {
        ...resolveVersusNpcAbility('shotgun', contextFor(bossId)),
        abilityId: bossId,
        commandIndex,
        intent: commandIndex === 0 ? 'attack' : commandIndex === 1 ? 'control' : 'guard',
        columnDelta: 0,
        nextMode: 0,
        nextCharges: 0,
        nextPlacements: [],
        nextOriginRow: 1,
        nextOriginCol: 1,
      };
      const presentation = resolveNpcSignaturePresentation(plan, bossId, commandIndex + 1);
      equal(presentation.commandIndex, commandIndex);
      equal(presentation.source, 'signature');
      equal(presentation.motif, BOSS_SIGNATURE_MOTIFS[bossId][commandIndex]);
      equal(presentation.label, BOSS_SIGNATURE_COMMANDS[bossId][commandIndex]);
      ok(SKILL_VFX_SEQUENCE[presentation.motif]);
    }
  }
});

test('presentation action and anchor communicate each practical plan shape', () => {
  const cases = [
    { abilityId: 'turret', intent: 'attack', action: 'primary', anchor: 'all-lanes' },
    { abilityId: 'signaljam', intent: 'control', action: 'alternate', anchor: 'player' },
    { abilityId: 'regen', intent: 'sustain', action: 'defend', anchor: 'self' },
    { abilityId: 'shield', intent: 'guard', action: 'defend', anchor: 'self' },
    { abilityId: 'backdash', intent: 'maneuver', action: 'alternate', anchor: 'self' },
  ] as const;

  for (const expected of cases) {
    const plan = resolveVersusNpcAbility(expected.abilityId, contextFor('architect'));
    const presentation = resolveNpcAbilityPresentation(plan, 'architect', 1);
    equal(presentation.intent, expected.intent, `${expected.abilityId} intent`);
    equal(presentation.action, expected.action, `${expected.abilityId} action`);
    equal(presentation.anchor, expected.anchor, `${expected.abilityId} anchor`);
    if (plan.moveToRow !== undefined && plan.shotPattern === 'none') {
      deepStrictEqual(presentation.targetRows, []);
    }
  }
});

test('presentation target lanes stay synchronized with applied projectile lanes', () => {
  const context = contextFor('tempest');
  for (const abilityId of BOSS_STRATEGY_PROFILES.tempest.abilities) {
    const plan = resolveVersusNpcAbility(abilityId, context);
    const presentation = resolveNpcAbilityPresentation(plan, 'tempest', 1);
    if (plan.shotPattern !== 'none') {
      ok(presentation.targetRows.length > 0);
      equal(presentation.anchor, presentation.targetRows.length > 1 ? 'all-lanes' : 'lane');
    }
  }
});

test('fresh revisions produce fresh presentation keys without changing semantics', () => {
  const plan = resolveVersusNpcAbility('freeze', contextFor('cryo'));
  const first = resolveNpcAbilityPresentation(plan, 'cryo', 4);
  const repeated = resolveNpcAbilityPresentation(plan, 'cryo', 5);
  equal(first.motif, repeated.motif);
  equal(first.label, repeated.label);
  ok(first.presentationKey !== repeated.presentationKey);
  deepStrictEqual(first.targetRows, repeated.targetRows);
});
