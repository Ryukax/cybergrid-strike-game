import { deepStrictEqual, equal, ok } from 'node:assert/strict';
import { test } from 'node:test';

import { COMPETITIVE_RULESET } from './competitive-balance';
import {
  planVersusBossEvasion,
  versusBossImpactIsCommitted,
  type VersusBossEvasionContext,
  type VersusBossProjectileThreat,
} from './versus-boss-evasion';

const NORMAL_CONTACT_RADIUS = 0.38;

function projectileAtEta(
  row: number,
  eta: number,
  overrides: Partial<VersusBossProjectileThreat> = {},
): VersusBossProjectileThreat {
  const npcBoardCol = 4;
  const speed = overrides.speed ?? 8.5;
  const big = overrides.big ?? false;
  const radius = big ? 0.52 : NORMAL_CONTACT_RADIUS;
  return {
    row,
    colPos: npcBoardCol - radius - eta * speed,
    speed,
    power: 1,
    big,
    ...overrides,
  };
}

function context(
  projectiles: readonly VersusBossProjectileThreat[],
  overrides: Partial<VersusBossEvasionContext> = {},
): VersusBossEvasionContext {
  return {
    npcRow: 1,
    npcCol: 1,
    playerRow: 1,
    npcBoardCol: 4,
    preferredColumn: 0,
    step: 0,
    moveReady: true,
    decisionUnlocked: true,
    projectiles,
    ...overrides,
  };
}

test('an imminent same-lane projectile produces one adjacent committed dodge', () => {
  const plan = planVersusBossEvasion(context([projectileAtEta(1, 0.18)]));
  ok(plan);
  equal(Math.abs(plan.nextRow - plan.fromRow), 1);
  equal(plan.fromColumn, 1);
  equal(plan.nextColumn, 0);
  equal(plan.moveRecovery, COMPETITIVE_RULESET.npcDodgeRecovery);
  equal(plan.fireRecovery, COMPETITIVE_RULESET.npcDodgeFireRecovery);
});

test('reactive movement follows tactical depth one column at a time', () => {
  const projectile = projectileAtEta(1, 0.18);
  const advance = planVersusBossEvasion(context([projectile], {
    npcCol: 2,
    preferredColumn: 0,
  }));
  ok(advance);
  equal(advance.nextColumn, 1, 'a dodge cannot teleport across both depth columns');

  const hold = planVersusBossEvasion(context([projectile], {
    npcCol: 1,
    preferredColumn: 1,
  }));
  ok(hold);
  equal(hold.nextColumn, 1, 'the evasion layer preserves an authored hold');
});

test('a far projectile does not trigger spawn-time input reading', () => {
  equal(planVersusBossEvasion(context([projectileAtEta(1, 0.4)])), null);
});

test('an overlapping or too-late projectile cannot be teleport-dodged', () => {
  const late = context([projectileAtEta(1, 0.04)]);
  const overlapping = context([projectileAtEta(1, -0.02)]);
  equal(planVersusBossEvasion(late), null);
  equal(planVersusBossEvasion(overlapping), null);
  equal(versusBossImpactIsCommitted(late), true);
  equal(versusBossImpactIsCommitted(overlapping), true);
});

test('past, reverse-moving, and already-resolved piercing shots are ignored', () => {
  const ignored = [
    projectileAtEta(1, 0.18, { speed: -8.5 }),
    projectileAtEta(1, -0.02),
    projectileAtEta(1, 0.18, { hitNpc: true }),
  ];
  equal(planVersusBossEvasion(context(ignored)), null);
});

test('a projectile fully beyond the collision body no longer locks movement', () => {
  const past = projectileAtEta(1, -0.2);
  equal(versusBossImpactIsCommitted(context([past])), false);
});

test('the boss selects a safer adjacent lane instead of global random movement', () => {
  const plan = planVersusBossEvasion(context([
    projectileAtEta(1, 0.18, { power: 2 }),
    projectileAtEta(0, 0.45),
  ]));
  ok(plan);
  equal(plan.nextRow, 2);
  deepStrictEqual(plan.threatByRow, [1, 2, 0]);
});

test('an edge-lane boss cannot jump across the board', () => {
  const plan = planVersusBossEvasion(context(
    [projectileAtEta(0, 0.18)],
    { npcRow: 0, playerRow: 0 },
  ));
  ok(plan);
  equal(plan.fromRow, 0);
  equal(plan.nextRow, 1);
});

test('equal reachable pressure forces the boss to hold and take the exchange', () => {
  const projectiles = [0, 1, 2].map((row) => projectileAtEta(row, row === 1 ? 0.18 : 0.4));
  equal(planVersusBossEvasion(context(projectiles)), null);
});

test('movement recovery and authored action locks prevent a dodge', () => {
  const projectile = projectileAtEta(1, 0.18);
  equal(planVersusBossEvasion(context([projectile], { moveReady: false })), null);
  equal(planVersusBossEvasion(context([projectile], { decisionUnlocked: false })), null);
});

test('deterministic parity resolves an otherwise exact destination tie', () => {
  const projectile = projectileAtEta(1, 0.18);
  equal(planVersusBossEvasion(context([projectile], { step: 0 }))?.nextRow, 0);
  equal(planVersusBossEvasion(context([projectile], { step: 1 }))?.nextRow, 2);
});
