import { deepStrictEqual, equal, ok, strictEqual } from 'node:assert/strict';
import { test } from 'node:test';

import {
  CAMPAIGN_ACTS,
  TOTAL_CAMPAIGN_ENCOUNTERS,
  resolveCampaignProgress,
} from './campaign-director';
import {
  CAMPAIGN_ROUTE_BOSS_ROSTER,
  CAMPAIGN_ROUTE_BOSS_TIER_SIZE,
  isCampaignRouteBossForkDue,
  resolveCampaignRouteDestinations,
  resolveCampaignRouteBossEncounter,
  resolveCampaignRouteTraversal,
} from './campaign-route-director';
import {
  CAMPAIGN_BOSSES_PER_STAGE,
  CAMPAIGN_PROVINCES,
  resolveCampaignBossStageIndex,
} from './campaign-terrain';

const bossChoices = [
  [0, 'last'],
  [0, 'next'],
  [2, 'last'],
  [2, 'next'],
] as const;

const rankedBossIds = [
  'tempest', 'phase', 'assimilation', 'arsenal',
  'resonance', 'predator', 'singularity', 'colossus',
  'beacon', 'polarity', 'exchange', 'orbital',
  'architect', 'counter', 'swarm', 'bloom',
  'cryo', 'sovereign', 'chrono', 'causality',
  'override', 'phoenix', 'tidal', 'null',
  'echo', 'mirage', 'apex', 'rift',
  'vector', 'hijack', 'gridshift', 'terra',
] as const;

test('campaign route roster is the complete weakest-to-strongest boss ladder', () => {
  deepStrictEqual(CAMPAIGN_ROUTE_BOSS_ROSTER.map(({ id }) => id), rankedBossIds);
  deepStrictEqual(
    CAMPAIGN_ROUTE_BOSS_ROSTER.map(({ rank }) => rank),
    Array.from({ length: CAMPAIGN_ROUTE_BOSS_ROSTER.length }, (_, index) => 32 - index),
  );
});

test('boss encounters remain resolvable while route position and boss ordinal advance independently', () => {
  let segment: number | null = null;
  let previousStage = -1;

  for (let fork = 0; fork < 128; fork += 1) {
    const direction = fork % 3 === 0 ? 'last' : 'next';
    const traversal = resolveCampaignRouteTraversal(
      segment,
      fork + 8,
      direction,
      fork % 2 ? 'bottom' : 'top',
    );
    equal(
      traversal.toSegment,
      direction === 'last' ? Math.max(1, traversal.fromSegment - 1) : traversal.fromSegment + 1,
    );
    segment = traversal.toSegment;

    const bossForkDue = isCampaignRouteBossForkDue(fork);
    equal(bossForkDue, true, `fork ${fork + 1} unexpectedly lost its boss gate`);

    const row = fork % 2 ? 2 : 0;
    const encounter = resolveCampaignRouteBossEncounter(row, direction, segment, bossForkDue, fork);
    ok(encounter, `segment ${segment} did not resolve its boss encounter`);
    equal(encounter.segment, segment);
    equal(encounter.lane, row === 0 ? 'top' : 'bottom');
    deepStrictEqual(
      encounter.destination,
      resolveCampaignRouteDestinations(fork)[row === 0 ? 'top' : 'bottom'][direction],
    );

    const stage = resolveCampaignBossStageIndex(fork);
    ok(stage >= previousStage, `boss-driven stage progress regressed after boss ${fork}`);
    previousStage = stage;
  }

  equal(segment, 50, 'route traversal should remain directional rather than following boss count');
});

test('route forks advance through contiguous rank tiers from weakest to strongest', () => {
  equal(CAMPAIGN_ROUTE_BOSS_ROSTER.length, 32);
  equal(new Set(CAMPAIGN_ROUTE_BOSS_ROSTER.map((boss) => boss.id)).size, 32);
  equal(CAMPAIGN_ROUTE_BOSS_TIER_SIZE, CAMPAIGN_BOSSES_PER_STAGE);

  for (let completedBosses = 0;
    completedBosses < CAMPAIGN_ROUTE_BOSS_ROSTER.length;
    completedBosses += 1) {
    const tierStart = Math.floor(completedBosses / CAMPAIGN_ROUTE_BOSS_TIER_SIZE)
      * CAMPAIGN_ROUTE_BOSS_TIER_SIZE;
    const expectedTier = rankedBossIds.slice(
      tierStart,
      tierStart + CAMPAIGN_ROUTE_BOSS_TIER_SIZE,
    );
    const destinations = resolveCampaignRouteDestinations(completedBosses);
    const displayedTier = bossChoices.map(([row, direction]) => (
      destinations[row === 0 ? 'top' : 'bottom'][direction].id
    ));
    deepStrictEqual(
      displayedTier,
      expectedTier,
      `boss fork ${completedBosses} did not remain inside its contiguous rank tier`,
    );
  }

  const finalTier = rankedBossIds.slice(-CAMPAIGN_ROUTE_BOSS_TIER_SIZE);
  for (const completedBosses of [32, 33, 64, 128]) {
    const destinations = resolveCampaignRouteDestinations(completedBosses);
    deepStrictEqual(
      bossChoices.map(([row, direction]) => (
        destinations[row === 0 ? 'top' : 'bottom'][direction].id
      )),
      finalTier,
      `completed campaign ${completedBosses} wrapped back to weaker opponents`,
    );
  }
});

test('each boss fork presents four different candidates backed by encounter resolution', () => {
  for (let completedBosses = 0; completedBosses < CAMPAIGN_ROUTE_BOSS_ROSTER.length * 2; completedBosses += 1) {
    const destinations = resolveCampaignRouteDestinations(completedBosses);
    const displayedIds = bossChoices.map(([row, direction]) => (
      destinations[row === 0 ? 'top' : 'bottom'][direction].id
    ));
    equal(new Set(displayedIds).size, 4, `boss fork ${completedBosses} contains duplicate candidates`);

    for (const [row, direction] of bossChoices) {
      const encounter = resolveCampaignRouteBossEncounter(
        row,
        direction,
        completedBosses + 1,
        true,
        completedBosses,
      );
      ok(encounter, `missing ${direction} boss on row ${row} at ordinal ${completedBosses}`);
      deepStrictEqual(
        encounter.destination,
        destinations[row === 0 ? 'top' : 'bottom'][direction],
      );
    }
  }
});

test('four completed bosses advance the generated stage and the finite arc holds on stage eight', () => {
  equal(CAMPAIGN_BOSSES_PER_STAGE, 4);
  equal(CAMPAIGN_PROVINCES.length, 8);
  equal(CAMPAIGN_PROVINCES.length * CAMPAIGN_BOSSES_PER_STAGE, CAMPAIGN_ROUTE_BOSS_ROSTER.length);
  equal(resolveCampaignBossStageIndex(-100), 0);

  for (let completedBosses = 0; completedBosses < CAMPAIGN_ROUTE_BOSS_ROSTER.length; completedBosses += 1) {
    equal(
      resolveCampaignBossStageIndex(completedBosses),
      Math.floor(completedBosses / CAMPAIGN_BOSSES_PER_STAGE),
    );
  }
  for (let completedBosses = CAMPAIGN_ROUTE_BOSS_ROSTER.length;
    completedBosses < CAMPAIGN_ROUTE_BOSS_ROSTER.length * 2;
    completedBosses += 1) {
    equal(
      resolveCampaignBossStageIndex(completedBosses),
      CAMPAIGN_PROVINCES.length - 1,
      'completed campaigns must not visually roll back to the first stage',
    );
  }
});

test('every campaign province resolves to a unique generated stage definition', () => {
  const terrainById = new Map(CAMPAIGN_PROVINCES.map((province) => [province.id, province]));
  const referencedProvinceIds = new Set(CAMPAIGN_ACTS.map((act) => act.provinceId));

  equal(terrainById.size, CAMPAIGN_PROVINCES.length, 'campaign terrain IDs must be unique');
  equal(
    new Set(CAMPAIGN_PROVINCES.map((province) => province.image)).size,
    CAMPAIGN_PROVINCES.length,
    'each campaign stage must use its own generated image',
  );

  for (const provinceId of referencedProvinceIds) {
    const terrain = terrainById.get(provinceId);
    ok(terrain, `campaign province ${provinceId} has no stage definition`);
  }
});

test('all authored acts, operations, and boss finales remain reachable before completion', () => {
  const reachedActs = new Set<number>();
  const reachedOperations = new Set<string>();

  for (let segment = 1; segment <= TOTAL_CAMPAIGN_ENCOUNTERS; segment += 1) {
    const progress = resolveCampaignProgress(segment);
    reachedActs.add(progress.actIndex);
    reachedOperations.add(`${progress.actIndex}:${progress.operationIndex}`);
  }

  equal(reachedActs.size, CAMPAIGN_ACTS.length);
  equal(
    reachedOperations.size,
    CAMPAIGN_ACTS.reduce((total, act) => total + act.operations.length, 0),
  );
  for (const act of CAMPAIGN_ACTS) {
    strictEqual(act.operations.at(-1)?.objective, 'boss', `${act.title} must culminate in a boss operation`);
  }
});
