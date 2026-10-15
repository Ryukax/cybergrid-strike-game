import { deepStrictEqual, equal, ok, strictEqual } from 'node:assert/strict';
import { test } from 'node:test';

import {
  CAMPAIGN_ROUTE_AUTO_BUSTER_AIM_SETTLE_SECONDS,
  CAMPAIGN_ROUTE_AUTO_BUSTER_GRACE_SECONDS,
  CAMPAIGN_ROUTE_AUTO_BUSTER_MAX_PROJECTILES,
  CAMPAIGN_ROUTE_AUTO_BUSTER_MIN_INTERVAL_SECONDS,
  CAMPAIGN_ROUTE_QUOTA_REQUIRED_CONFIRMED_HITS,
  createCampaignRouteAutoBusterState,
  registerCampaignProjectileEnemyHit,
  resolveCampaignRouteAutoBuster,
  resolveCampaignRouteProjectileHp,
  resolveCampaignRouteQuotaImpact,
  resolveCampaignRouteTargetRows,
  type CampaignRouteAimPair,
  type CampaignRouteAutoBusterInput,
  type CampaignRouteAutoBusterState,
} from './campaign-route-auto-buster';

const pair: CampaignRouteAimPair = {
  last: { visualSeed: 101, row: 0 },
  next: { visualSeed: 202, row: 2 },
};

function input(
  overrides: Partial<CampaignRouteAutoBusterInput> = {},
): CampaignRouteAutoBusterInput {
  return {
    phase: 'aiming',
    pair,
    dt: 0,
    playerRow: 1,
    cooldownAfterTick: 0,
    requestedInterval: 0.34,
    activeProjectileCount: 0,
    ...overrides,
  };
}

function afterPairGrace(
  playerRow = 1,
  aimPair: CampaignRouteAimPair = pair,
): CampaignRouteAutoBusterState {
  const published = resolveCampaignRouteAutoBuster(
    createCampaignRouteAutoBusterState(playerRow),
    input({ pair: aimPair, playerRow }),
  );
  return resolveCampaignRouteAutoBuster(
    published.state,
    input({
      pair: aimPair,
      playerRow,
      dt: CAMPAIGN_ROUTE_AUTO_BUSTER_GRACE_SECONDS,
    }),
  ).state;
}

test('route targets occupy the two lanes away from the player', () => {
  deepStrictEqual(resolveCampaignRouteTargetRows(0), { last: 1, next: 2 });
  deepStrictEqual(resolveCampaignRouteTargetRows(1), { last: 0, next: 2 });
  deepStrictEqual(resolveCampaignRouteTargetRows(2), { last: 0, next: 1 });

  const clamped = resolveCampaignRouteTargetRows(99);
  notPlayerLane(clamped.last, 2);
  notPlayerLane(clamped.next, 2);
  notEqualRows(clamped.last, clamped.next);
});

test('route Auto timing creates a meaningful aim window and a single-shot budget', () => {
  ok(CAMPAIGN_ROUTE_AUTO_BUSTER_GRACE_SECONDS >= 0.75);
  ok(CAMPAIGN_ROUTE_AUTO_BUSTER_AIM_SETTLE_SECONDS > 0.16);
  ok(CAMPAIGN_ROUTE_AUTO_BUSTER_GRACE_SECONDS > CAMPAIGN_ROUTE_AUTO_BUSTER_AIM_SETTLE_SECONDS);
  ok(CAMPAIGN_ROUTE_AUTO_BUSTER_MIN_INTERVAL_SECONDS > 0.34);
  equal(CAMPAIGN_ROUTE_AUTO_BUSTER_MAX_PROJECTILES, 1);
});

test('acquisition pauses Auto until every prior projectile has drained', () => {
  const state = createCampaignRouteAutoBusterState(1);
  const draining = resolveCampaignRouteAutoBuster(state, input({
    phase: 'acquiring',
    pair: null,
    cooldownAfterTick: -4,
    activeProjectileCount: 1,
  }));
  equal(draining.governed, true);
  equal(draining.holdAuto, true);
  equal(draining.targetsMayPublish, false);
  equal(draining.nextCooldown, 0);
  strictEqual(draining.emission, null);
  equal(draining.reason, 'acquiring');

  const drained = resolveCampaignRouteAutoBuster(draining.state, input({
    phase: 'acquiring',
    pair: null,
    activeProjectileCount: 0,
  }));
  equal(drained.targetsMayPublish, true);
  strictEqual(drained.emission, null);
});

test('a complete pair starts grace once and the same pair does not restart it', () => {
  const initial = createCampaignRouteAutoBusterState(1);
  const published = resolveCampaignRouteAutoBuster(initial, input());
  equal(published.reason, 'pair-grace');
  equal(published.state.graceRemaining, CAMPAIGN_ROUTE_AUTO_BUSTER_GRACE_SECONDS);
  strictEqual(published.emission, null);

  const elapsed = resolveCampaignRouteAutoBuster(published.state, input({ dt: 0.4 }));
  equal(
    elapsed.state.graceRemaining,
    CAMPAIGN_ROUTE_AUTO_BUSTER_GRACE_SECONDS - 0.4,
  );
  equal(elapsed.reason, 'pair-grace');

  const replacementPair: CampaignRouteAimPair = {
    last: { visualSeed: 303, row: 0 },
    next: { visualSeed: 404, row: 2 },
  };
  const replaced = resolveCampaignRouteAutoBuster(elapsed.state, input({
    pair: replacementPair,
    dt: 0.4,
  }));
  equal(replaced.state.graceRemaining, CAMPAIGN_ROUTE_AUTO_BUSTER_GRACE_SECONDS);
  strictEqual(replaced.state.committedDirection, null);
  strictEqual(replaced.emission, null);
});

test('crossing intermediate lanes never emits before the final row settles', () => {
  let state = afterPairGrace();

  const crossingLast = resolveCampaignRouteAutoBuster(state, input({
    playerRow: 0,
    dt: 0.05,
  }));
  equal(crossingLast.reason, 'navigating');
  strictEqual(crossingLast.emission, null);
  state = crossingLast.state;

  const crossingMiddle = resolveCampaignRouteAutoBuster(state, input({
    playerRow: 1,
    dt: 0.05,
  }));
  equal(crossingMiddle.reason, 'navigating');
  strictEqual(crossingMiddle.emission, null);
  state = crossingMiddle.state;

  const arrivingNext = resolveCampaignRouteAutoBuster(state, input({
    playerRow: 2,
    dt: 0.05,
  }));
  equal(arrivingNext.reason, 'navigating');
  strictEqual(arrivingNext.emission, null);
  state = arrivingNext.state;

  const almostSettled = resolveCampaignRouteAutoBuster(state, input({
    playerRow: 2,
    dt: CAMPAIGN_ROUTE_AUTO_BUSTER_AIM_SETTLE_SECONDS - 0.01,
  }));
  equal(almostSettled.reason, 'navigating');
  strictEqual(almostSettled.emission, null);

  const settled = resolveCampaignRouteAutoBuster(almostSettled.state, input({
    playerRow: 2,
    dt: 0.02,
  }));
  equal(settled.reason, 'fire');
  equal(settled.state.committedDirection, 'next');
  equal(settled.state.committedSeed, pair.next.visualSeed);
  deepStrictEqual(settled.emission, {
    row: 2,
    routeDirection: 'next',
    suppressSecondary: true,
  });
});

test('an empty or ambiguous lane cannot become an automatic route choice', () => {
  const neutral = resolveCampaignRouteAutoBuster(
    afterPairGrace(),
    input({ playerRow: 1 }),
  );
  equal(neutral.reason, 'no-target-lane');
  strictEqual(neutral.emission, null);

  const ambiguousPair: CampaignRouteAimPair = {
    last: { visualSeed: 505, row: 1 },
    next: { visualSeed: 606, row: 1 },
  };
  const ambiguous = resolveCampaignRouteAutoBuster(
    afterPairGrace(1, ambiguousPair),
    input({ pair: ambiguousPair, playerRow: 1 }),
  );
  equal(ambiguous.reason, 'no-target-lane');
  strictEqual(ambiguous.emission, null);
});

test('a route commitment remains singular and moving away pauses it', () => {
  const ready = afterPairGrace(0);
  const committed = resolveCampaignRouteAutoBuster(ready, input({ playerRow: 0 }));
  equal(committed.state.committedDirection, 'last');
  equal(committed.state.committedRow, 0);
  equal(committed.emission?.routeDirection, 'last');

  const moved = resolveCampaignRouteAutoBuster(committed.state, input({
    playerRow: 2,
    dt: CAMPAIGN_ROUTE_AUTO_BUSTER_AIM_SETTLE_SECONDS,
    activeProjectileCount: 1,
  }));
  strictEqual(moved.emission, null);
  equal(moved.state.committedDirection, 'last');

  const settledElsewhere = resolveCampaignRouteAutoBuster(moved.state, input({
    playerRow: 2,
    dt: CAMPAIGN_ROUTE_AUTO_BUSTER_AIM_SETTLE_SECONDS,
    activeProjectileCount: 0,
  }));
  equal(settledElsewhere.reason, 'committed-off-lane');
  equal(settledElsewhere.state.committedDirection, 'last');
  strictEqual(settledElsewhere.emission, null);
});

test('route cadence ignores surge-speed intervals and emits one non-fanning carrier', () => {
  const ready = afterPairGrace(0);
  const fired = resolveCampaignRouteAutoBuster(ready, input({
    playerRow: 0,
    requestedInterval: 0.09,
    cooldownAfterTick: -8,
  }));
  equal(fired.reason, 'fire');
  equal(fired.nextCooldown, CAMPAIGN_ROUTE_AUTO_BUSTER_MIN_INTERVAL_SECONDS);
  deepStrictEqual(fired.emission, {
    row: 0,
    routeDirection: 'last',
    suppressSecondary: true,
  });

  const blocked = resolveCampaignRouteAutoBuster(fired.state, input({
    playerRow: 0,
    cooldownAfterTick: -8,
    activeProjectileCount: CAMPAIGN_ROUTE_AUTO_BUSTER_MAX_PROJECTILES,
  }));
  equal(blocked.reason, 'projectile-budget');
  equal(blocked.nextCooldown, 0);
  strictEqual(blocked.emission, null);

  const budgetFreed = resolveCampaignRouteAutoBuster(blocked.state, input({
    playerRow: 0,
    cooldownAfterTick: 0,
    activeProjectileCount: 0,
  }));
  equal(budgetFreed.reason, 'fire');
  equal(budgetFreed.emission?.routeDirection, 'last');
});

test('choosing hard-pauses Auto while inactive play remains ungoverned', () => {
  const state = createCampaignRouteAutoBusterState(1);
  const choosing = resolveCampaignRouteAutoBuster(state, input({
    phase: 'choosing',
    cooldownAfterTick: -1,
  }));
  equal(choosing.governed, true);
  equal(choosing.holdAuto, true);
  equal(choosing.nextCooldown, 0);
  strictEqual(choosing.emission, null);

  const inactive = resolveCampaignRouteAutoBuster(state, input({
    phase: 'inactive',
    pair: null,
    cooldownAfterTick: -1,
  }));
  equal(inactive.governed, false);
  equal(inactive.holdAuto, false);
  equal(inactive.nextCooldown, -1);
  equal(inactive.targetsMayPublish, true);
  strictEqual(inactive.emission, null);
});

test('secured combat uses the safe cadence without claiming another direction', () => {
  const decision = resolveCampaignRouteAutoBuster(
    createCampaignRouteAutoBusterState(1),
    input({
      phase: 'secured',
      playerRow: 1,
      requestedInterval: 0.16,
    }),
  );
  equal(decision.reason, 'secured');
  equal(decision.nextCooldown, CAMPAIGN_ROUTE_AUTO_BUSTER_MIN_INTERVAL_SECONDS);
  deepStrictEqual(decision.emission, {
    row: 1,
    routeDirection: null,
    suppressSecondary: true,
  });
});

test('collateral projectiles may soften but cannot select a route target', () => {
  equal(resolveCampaignRouteProjectileHp(3, 1, 'last', null), 2);
  equal(resolveCampaignRouteProjectileHp(1, 99, 'last', 'next'), 1);
  equal(resolveCampaignRouteProjectileHp(1, 1, 'last', 'last'), 0);
  equal(resolveCampaignRouteProjectileHp(1, 1, null, null), 0);
});

test('one lethal committed hit cannot meet a route quota', () => {
  equal(CAMPAIGN_ROUTE_QUOTA_REQUIRED_CONFIRMED_HITS > 1, true);
  const first = resolveCampaignRouteQuotaImpact(3, 99, 'last', 'last', 0);
  deepStrictEqual(first, {
    hp: 1,
    confirmedHits: 1,
    confirmedHit: true,
    defeated: false,
    quotaMet: false,
  });
});

test('three committed hits can defeat the advertised target and meet its quota', () => {
  const first = resolveCampaignRouteQuotaImpact(1, 1, 'next', 'next', 0);
  equal(first.hp, 1);
  equal(first.confirmedHits, 1);
  equal(first.quotaMet, false);

  const second = resolveCampaignRouteQuotaImpact(
    first.hp,
    1,
    'next',
    'next',
    first.confirmedHits,
  );
  deepStrictEqual(second, {
    hp: 1,
    confirmedHits: 2,
    confirmedHit: true,
    defeated: false,
    quotaMet: false,
  });

  const third = resolveCampaignRouteQuotaImpact(
    second.hp,
    1,
    'next',
    'next',
    second.confirmedHits,
  );
  deepStrictEqual(third, {
    hp: 0,
    confirmedHits: 3,
    confirmedHit: true,
    defeated: true,
    quotaMet: true,
  });
});

test('hit count alone cannot meet quota before the target is defeated', () => {
  const first = resolveCampaignRouteQuotaImpact(8, 1, 'last', 'last', 0);
  const second = resolveCampaignRouteQuotaImpact(
    first.hp,
    1,
    'last',
    'last',
    first.confirmedHits,
  );
  const third = resolveCampaignRouteQuotaImpact(
    second.hp,
    1,
    'last',
    'last',
    second.confirmedHits,
  );
  equal(third.confirmedHits, CAMPAIGN_ROUTE_QUOTA_REQUIRED_CONFIRMED_HITS);
  equal(third.hp, 5);
  equal(third.defeated, false);
  equal(third.quotaMet, false);
});

test('collateral or zero-damage contacts cannot advance a route quota', () => {
  const collateral = resolveCampaignRouteQuotaImpact(1, 99, 'last', 'next', 0);
  equal(collateral.hp, 1);
  equal(collateral.confirmedHits, 0);
  equal(collateral.quotaMet, false);

  const zeroDamage = resolveCampaignRouteQuotaImpact(1, 0, 'last', 'last', 0);
  equal(zeroDamage.hp, 1);
  equal(zeroDamage.confirmedHits, 0);
  equal(zeroDamage.quotaMet, false);
});

test('a piercing carrier resolves each stable enemy identity only once', () => {
  const first = registerCampaignProjectileEnemyHit(undefined, 707);
  equal(first.alreadyHit, false);
  deepStrictEqual(first.hitEnemySeeds, [707]);

  const overlapNextFrame = registerCampaignProjectileEnemyHit(first.hitEnemySeeds, 707);
  equal(overlapNextFrame.alreadyHit, true);
  deepStrictEqual(overlapNextFrame.hitEnemySeeds, [707]);

  const secondEnemy = registerCampaignProjectileEnemyHit(first.hitEnemySeeds, 808);
  equal(secondEnemy.alreadyHit, false);
  deepStrictEqual(secondEnemy.hitEnemySeeds, [707, 808]);
});

function notPlayerLane(row: number, playerRow: number) {
  ok(row !== playerRow);
}

function notEqualRows(left: number, right: number) {
  ok(left !== right);
}
