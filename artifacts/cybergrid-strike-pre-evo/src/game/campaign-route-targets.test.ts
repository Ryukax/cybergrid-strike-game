import { equal, notEqual, strictEqual } from 'node:assert/strict';
import { test } from 'node:test';

import type { Enemy, EnemyGenome } from './types';
import {
  CAMPAIGN_ROUTE_TARGET_MIN_ACQUISITION_COL,
  CAMPAIGN_ROUTE_TARGET_HOLD_COL,
  CAMPAIGN_ROUTE_TARGET_PAIR_SPAWN_DELAY_SECONDS,
  CAMPAIGN_ROUTE_TARGET_REACQUIRE_DELAY_SECONDS,
  advanceCampaignRouteTargetColumn,
  campaignRouteTargetCandidates,
  findCampaignRouteTarget,
  getCompleteCampaignRouteTargetPair,
  isCampaignRouteTarget,
  pinCampaignRouteTargetLane,
  reconcileCampaignRouteTarget,
  selectCampaignRouteTargetCandidate,
} from './campaign-route-targets';
import { getEnemyVisualSeed } from './enemy-identity';

const genome: EnemyGenome = {
  niche: 'hunter',
  baseElement: 'robot',
  element: 'thermal',
  entityType: 'mechanical',
  enemyClass: 'predator',
  mutations: [],
  generation: 0,
  speedScale: 1,
  fusionLevel: 0,
  hpBonus: 0,
  sizeScale: 1,
  regeneration: 0,
  phaseChance: 0,
};

function enemy(visualSeed: number, colPos: number, row = 1, hp = 3): Enemy {
  return {
    visualSeed,
    value: visualSeed,
    colPos,
    row,
    hp,
    maxHp: hp,
    speed: 1,
    flash: 0,
    genome: { ...genome, mutations: [] },
  };
}

test('route target identity follows its specimen rather than its board position', () => {
  const last = enemy(101, 1, 0, 4);
  const next = enemy(202, 5, 2, 3);
  const lastBinding = { enemy: last, visualSeed: 101 };
  const nextBinding = { enemy: next, visualSeed: 202 };

  const movedLast = structuredClone(last);
  movedLast.colPos = 5.2;
  movedLast.row = 2;
  movedLast.hp = 1;
  const movedNext = structuredClone(next);
  movedNext.colPos = 0.8;
  movedNext.row = 0;
  movedNext.hp = 2;
  const newcomer = enemy(303, 0.2, 1, 6);

  strictEqual(findCampaignRouteTarget([newcomer, movedNext, movedLast], lastBinding), movedLast);
  strictEqual(findCampaignRouteTarget([newcomer, movedNext, movedLast], nextBinding), movedNext);
  equal(reconcileCampaignRouteTarget([newcomer, movedNext, movedLast], lastBinding).status, 'live');
  equal(reconcileCampaignRouteTarget([newcomer, movedNext, movedLast], nextBinding).status, 'live');
});

test('only an explicit zero-hp target resolves as defeated', () => {
  const escaped = enemy(404, -9, 1, 2);
  const replacement = enemy(505, 5.5);
  equal(reconcileCampaignRouteTarget([replacement], {
    enemy: escaped,
    visualSeed: 404,
  }).status, 'missing');

  escaped.hp = 0;
  equal(reconcileCampaignRouteTarget([replacement], {
    enemy: escaped,
    visualSeed: 404,
  }).status, 'defeated');
});

test('a canonical live clone overrides the stale bound object state', () => {
  const staleDefeated = enemy(506, -9, 1, 0);
  const rewoundAlive = enemy(506, 5, 1, 3);
  const restored = reconcileCampaignRouteTarget([rewoundAlive], {
    enemy: staleDefeated,
    visualSeed: 506,
  });
  equal(restored.status, 'live');
  if (restored.status === 'live') strictEqual(restored.enemy, rewoundAlive);

  const staleAlive = enemy(507, 5, 1, 3);
  const clonedDefeated = enemy(507, -9, 1, 0);
  equal(reconcileCampaignRouteTarget([clonedDefeated], {
    enemy: staleAlive,
    visualSeed: 507,
  }).status, 'defeated');
});

test('route candidates require visible runway and assigned specimens are fusion-protected', () => {
  const expiring = enemy(601, CAMPAIGN_ROUTE_TARGET_MIN_ACQUISITION_COL - 0.01);
  const fresh = enemy(602, CAMPAIGN_ROUTE_TARGET_MIN_ACQUISITION_COL + 0.01);
  const candidates = campaignRouteTargetCandidates([expiring, fresh]);
  equal(candidates.length, 1);
  strictEqual(candidates[0], fresh);
  equal(isCampaignRouteTarget(fresh, [{ enemy: fresh, visualSeed: 602 }, null]), true);
  equal(isCampaignRouteTarget(expiring, [{ enemy: fresh, visualSeed: 602 }, null]), false);
});

test('route target replacement is scheduled within one 60 Hz frame', () => {
  const oneSixtyHertzFrame = 1 / 60;
  equal(CAMPAIGN_ROUTE_TARGET_REACQUIRE_DELAY_SECONDS >= 0, true);
  equal(CAMPAIGN_ROUTE_TARGET_REACQUIRE_DELAY_SECONDS <= oneSixtyHertzFrame, true);
  equal(CAMPAIGN_ROUTE_TARGET_PAIR_SPAWN_DELAY_SECONDS >= 0, true);
  equal(CAMPAIGN_ROUTE_TARGET_PAIR_SPAWN_DELAY_SECONDS <= oneSixtyHertzFrame, true);
});

test('a published route target holds a stable engagement line until resolution', () => {
  equal(advanceCampaignRouteTargetColumn(4.4, 0.25, true), 4.15);
  equal(advanceCampaignRouteTargetColumn(3.7, 0.25, true), CAMPAIGN_ROUTE_TARGET_HOLD_COL);
  equal(advanceCampaignRouteTargetColumn(2.7, 0.25, true, 2.65), 2.65);
  equal(advanceCampaignRouteTargetColumn(3.7, 0.25, false), 3.45);
});

test('a rewound route target is repinned to its advertised lane', () => {
  const rewound = enemy(620, 4.8, 1);
  equal(pinCampaignRouteTargetLane(rewound, 0), 0);
  equal(rewound.row, 0);
  equal(rewound.strategyTargetRow, 0);
  equal(rewound.strategyAbilityTargetRow, 0);
});

test('route targets publish atomically only when both Last and Next are ready', () => {
  const last = { enemy: enemy(651, 4.4, 0), visualSeed: 651 };
  const next = { enemy: enemy(652, 5.3, 2), visualSeed: 652 };

  strictEqual(getCompleteCampaignRouteTargetPair({ last: null, next: null }), null);
  strictEqual(getCompleteCampaignRouteTargetPair({ last, next: null }), null);
  strictEqual(getCompleteCampaignRouteTargetPair({ last: null, next }), null);

  const published = getCompleteCampaignRouteTargetPair({ last, next });
  notEqual(published, null);
  strictEqual(published?.last, last);
  strictEqual(published?.next, next);
});

test('Last and Next choose prompt, independently aimable lanes', () => {
  const nearest = enemy(701, CAMPAIGN_ROUTE_TARGET_MIN_ACQUISITION_COL, 0);
  const middleSameLane = enemy(702, 4.3, 0);
  const fartherOtherLane = enemy(703, 5.4, 2);
  const used = new Set<number>();

  const last = selectCampaignRouteTargetCandidate(
    [fartherOtherLane, middleSameLane, nearest],
    'last',
    used,
  );
  strictEqual(last, nearest);
  used.add(getEnemyVisualSeed(nearest));

  const next = selectCampaignRouteTargetCandidate(
    [fartherOtherLane, middleSameLane, nearest],
    'next',
    used,
    nearest.row,
  );
  strictEqual(next, fartherOtherLane);
});

test('a unique same-row replacement remains immediately available for lane separation', () => {
  const survivingNext = enemy(801, 5.2, 1);
  const sameRowCandidate = enemy(802, 5.5, 1);
  strictEqual(selectCampaignRouteTargetCandidate(
    [sameRowCandidate],
    'last',
    new Set([getEnemyVisualSeed(survivingNext)]),
    survivingNext.row,
  ), sameRowCandidate);
});

test('legacy enemies share the exact renderer and route fallback identity', () => {
  const first = enemy(1, 5);
  delete first.visualSeed;
  first.value = 7;
  first.formationId = 3;
  first.genome = { ...genome, generation: 2, mutations: [] };
  const second = structuredClone(first);
  second.formationId = 4;

  equal(getEnemyVisualSeed(first), 7 * 131 + 3 * 104729 + 2 * 8191);
  notEqual(getEnemyVisualSeed(first), getEnemyVisualSeed(second));
});
