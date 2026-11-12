import assert from 'node:assert/strict';
import test from 'node:test';

import {
  abilityHandCanPublish,
  abilityHandIsSpent,
  advanceSkillRecovery,
  resolveSignatureActionAttempt,
  startSignatureRecovery,
} from './skill-cadence';
import { ABILITY_POOL } from './constants';
import { COMPETITIVE_RULESET } from './competitive-balance';
import { NPC_SKILL_PRESENTATION_DURATION_MS } from './npc-skill-presentation';

test('a spent hand starts recharging without waiting for card cooldowns', () => {
  assert.equal(abilityHandIsSpent(['fast', 'slow', 'utility'], ['utility', 'fast']), false);
  assert.equal(
    abilityHandIsSpent(['fast', 'slow', 'utility'], ['utility', 'fast', 'slow']),
    true,
  );
});

test('an empty ready-card result stays in recharge instead of publishing a dead hand', () => {
  assert.equal(abilityHandCanPublish([]), false);
  assert.equal(abilityHandCanPublish(['ready-card']), true);
});

test('competitive signature recovery begins at activation and overlaps its active window', () => {
  const recovery = startSignatureRecovery('vs', 14);
  assert.equal(recovery, 14);
  assert.equal(advanceSkillRecovery(recovery, 7), 7);
});

test('campaign and co-op signatures remain free of the competitive recovery gate', () => {
  assert.equal(startSignatureRecovery('classic', 14), 0);
  assert.equal(startSignatureRecovery('coop', 14), 0);
});

test('skill recovery clamps elapsed time and never becomes negative', () => {
  assert.equal(advanceSkillRecovery(2, 8), 0);
  assert.equal(advanceSkillRecovery(2, -3), 2);
});

test('signature action recovery and budget reject input without advancing presentation', () => {
  const recovering = resolveSignatureActionAttempt({
    active: true,
    actionCount: 1,
    maxActions: 6,
    nowMs: 900,
    readyAtMs: 1_000,
    intervalMs: 550,
  });
  assert.deepEqual(recovering, {
    accepted: false,
    reason: 'recovery',
    nextReadyAtMs: 1_000,
  });

  const exhausted = resolveSignatureActionAttempt({
    active: true,
    actionCount: 6,
    maxActions: 6,
    nowMs: 1_000,
    readyAtMs: 1_000,
    intervalMs: 550,
  });
  assert.equal(exhausted.accepted, false);
  assert.equal(exhausted.reason, 'budget');

  const accepted = resolveSignatureActionAttempt({
    active: true,
    actionCount: 5,
    maxActions: 6,
    nowMs: 1_000,
    readyAtMs: 1_000,
    intervalMs: 550,
  });
  assert.deepEqual(accepted, {
    accepted: true,
    reason: 'accepted',
    nextReadyAtMs: 1_550,
  });
});

test('NPC global spacing covers presentation but remains below every authored card cooldown', () => {
  const shortestCardCooldown = Math.min(...ABILITY_POOL.map(({ cooldown }) => cooldown));
  assert.ok(
    COMPETITIVE_RULESET.npcAbilityInterval >= NPC_SKILL_PRESENTATION_DURATION_MS / 1000,
  );
  // Runtime adds less than one second of deterministic jitter.
  assert.ok(COMPETITIVE_RULESET.npcAbilityInterval + 1 < shortestCardCooldown);
});
