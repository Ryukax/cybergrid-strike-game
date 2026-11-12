import { equal, match, doesNotMatch, deepStrictEqual } from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  isCampaignRouteBossForkDue,
  resolveCampaignRouteBossEncounter,
  type CampaignRouteBossEncounter,
} from '../game/campaign-route-director';
import { CampaignRouteFork } from './CampaignRouteFork';

const routeEnemies = () => ({
  last: {
    id: 'last', label: 'LAST TARGET', sprite: null, row: 0,
    confirmedHits: 1, requiredHits: 3,
  },
  next: {
    id: 'next', label: 'NEXT TARGET', sprite: null, row: 2,
    confirmedHits: 0, requiredHits: 3,
  },
});

function renderFork(
  bossForkReady: boolean,
  bossEncounter: CampaignRouteBossEncounter | null = null,
  options: {
    selectable?: boolean;
    available?: { last: boolean; next: boolean };
    completedBosses?: number;
  } = {},
): string {
  return renderToStaticMarkup(
    <CampaignRouteFork
      enabled
      selectable={options.selectable ?? true}
      available={options.available ?? { last: true, next: true }}
      wave={9}
      startWave={6}
      securedSegments={5}
      completedBosses={options.completedBosses ?? 0}
      bossForkReady={bossForkReady}
      bossEncounter={bossEncounter}
      routeSegment={9}
      lastTraversal={null}
      getPlayerPosition={() => ({ row: 1, col: 1 })}
      getRouteEnemies={routeEnemies}
    />,
  );
}

test('combat targets remain prominent while the path fork stays absent before quota', () => {
  const markup = renderFork(false, null, {
    selectable: false,
    available: { last: false, next: false },
  });

  match(markup, /campaignRouteFork locked/);
  doesNotMatch(markup, /campaignRouteMap/);
  equal((markup.match(/campaignRouteContact [^\"]+ tracking/g) ?? []).length, 2);
  match(markup, /TARGET: LAST TARGET/);
  match(markup, /TARGET: NEXT TARGET/);
  match(markup, /DEFEAT TO SECURE LAST/);
  match(markup, /DEFEAT TO SECURE NEXT/);
  match(markup, /VALID HITS 1\/3/);
  match(markup, /VALID HITS 0\/3/);
  match(markup, /DEFEAT TO SECURE LAST · TOP LANE/);
  match(markup, /DEFEAT TO SECURE NEXT · BOTTOM LANE/);
});

test('securing one quota reveals the fork without making it selectable before wave end', () => {
  const markup = renderFork(false, null, {
    selectable: false,
    available: { last: true, next: false },
  });

  match(markup, /campaignRouteFork locked quotaPending/);
  match(markup, /ROUTE QUOTA SECURED/);
  match(markup, /campaignRouteMap standardMap/);
  match(markup, /campaignRouteContact last quotaMet/);
  match(markup, /QUOTA MET \u2014 FINISH WAVE/);
  match(markup, /campaignRouteContact next unavailable/);
  match(markup, /LOCKED \u2014 OTHER ROUTE SECURED/);
});

test('ordinary route choices do not advertise passive boss destinations', () => {
  const markup = renderFork(false);
  match(markup, /data-boss-fork="false"/);
  match(markup, /standardMap/);
  doesNotMatch(markup, /HIJACK|MIRAGE|TEMPEST|PHASE/);
  equal((markup.match(/SEG 6/g) ?? []).length, 2);
});

test('an armed boss fork displays only destinations backed by the boss gate', () => {
  const markup = renderFork(true);
  match(markup, /data-boss-fork="true"/);
  match(markup, /bossMap/);
  match(markup, /BOSS FORK READY/);
  match(markup, /TOP \/ BOTTOM BOSS/);
  match(markup, /MIDDLE STRAIGHT/);
  for (const destination of ['TEMPEST', 'NYX', 'MELD', 'FORGE']) {
    match(markup, new RegExp(destination));
  }
  for (const id of ['tempest', 'phase', 'assimilation', 'arsenal']) {
    match(markup, new RegExp(`skins/skill-${id}-idle\\.png`));
  }
  for (const destination of [
    'NW rank 32 TEMPEST',
    'NE rank 31 NYX',
    'SW rank 30 MELD',
    'SE rank 29 FORGE',
  ]) {
    match(markup, new RegExp(`<button[^>]+aria-label="${destination} boss route"`));
  }
});

test('the visible boss slate advances to the next stronger tier after one selected victory', () => {
  const markup = renderFork(true, null, { completedBosses: 1 });
  for (const destination of [
    'NW rank 28 CHORD',
    'NE rank 27 TALON',
    'SW rank 26 GRAVITAS',
    'SE rank 25 BASTION',
  ]) {
    match(markup, new RegExp(`<button[^>]+aria-label="${destination} boss route"`));
  }
  doesNotMatch(markup, /rank 32 TEMPEST|rank 31 NYX|rank 30 MELD|rank 29 FORGE/);
});

test('boss presentation and encounter resolution share the same route counter', () => {
  equal(isCampaignRouteBossForkDue(0), true);
  equal(isCampaignRouteBossForkDue(1), true);
  equal(isCampaignRouteBossForkDue(5), true);
  equal(isCampaignRouteBossForkDue(6), true);
  equal(isCampaignRouteBossForkDue(27), true);
  equal(isCampaignRouteBossForkDue(6, true), true);

  deepStrictEqual(resolveCampaignRouteBossEncounter(0, 'next', 6, true), {
    lane: 'top',
    direction: 'next',
    destination: { id: 'phase', label: 'NYX', rank: 31, bearing: 'NE' },
    segment: 6,
  });
  deepStrictEqual(resolveCampaignRouteBossEncounter(2, 'last', 6, true), {
    lane: 'bottom',
    direction: 'last',
    destination: { id: 'assimilation', label: 'MELD', rank: 30, bearing: 'SW' },
    segment: 6,
  });
  equal(resolveCampaignRouteBossEncounter(1, 'next', 6, true), null);
});

test('boss choices return on the next eligible fork after a boss is defeated', () => {
  const firstForkDue = isCampaignRouteBossForkDue(0);
  const completedEncounter = resolveCampaignRouteBossEncounter(0, 'next', 6, firstForkDue);
  equal(completedEncounter?.destination.id, 'phase');

  // Selecting the boss route secures one segment. Winning the temporary duel
  // restores campaign combat, so the following wave must arm another boss fork.
  const securedSegmentsAfterBoss = 1;
  const nextForkDue = isCampaignRouteBossForkDue(securedSegmentsAfterBoss);
  equal(nextForkDue, true);

  const markup = renderFork(nextForkDue, null, { completedBosses: 1 });
  match(markup, /BOSS FORK READY/);
  for (const destination of [
    'NW rank 28 CHORD',
    'NE rank 27 TALON',
    'SW rank 26 GRAVITAS',
    'SE rank 25 BASTION',
  ]) {
    match(markup, new RegExp(`<button[^>]+aria-label="${destination} boss route"`));
  }

  deepStrictEqual(resolveCampaignRouteBossEncounter(2, 'last', 7, nextForkDue, 1), {
    lane: 'bottom',
    direction: 'last',
    destination: { id: 'singularity', label: 'GRAVITAS', rank: 26, bearing: 'SW' },
    segment: 7,
  });
});

test('every top or bottom road-fork choice resolves its corresponding NPC boss', () => {
  const expectations = [
    [0, 'last', 'tempest', 'NW'],
    [0, 'next', 'phase', 'NE'],
    [2, 'last', 'assimilation', 'SW'],
    [2, 'next', 'arsenal', 'SE'],
  ] as const;

  for (const [row, direction, id, bearing] of expectations) {
    const encounter = resolveCampaignRouteBossEncounter(row, direction, 6, true);
    equal(encounter?.destination.id, id);
    equal(encounter?.destination.bearing, bearing);
    equal(encounter?.direction, direction);
    equal(encounter?.segment, 6);
  }
});

test('choosing the middle road preserves the armed boss fork for the next intermission', () => {
  const middleEncounter = resolveCampaignRouteBossEncounter(1, 'next', 7, true);
  equal(middleEncounter, null);

  const bossStillDue = isCampaignRouteBossForkDue(1, middleEncounter === null);
  equal(bossStillDue, true);
});

test('a resolved road-fork encounter stays visibly bound to the selected NPC boss', () => {
  const encounter = resolveCampaignRouteBossEncounter(2, 'next', 6, true);
  if (!encounter) throw new Error('expected the bottom-next boss encounter to resolve');

  const markup = renderFork(false, encounter);
  match(markup, /NPC BOSS ENCOUNTER/);
  match(markup, /SE/);
  match(markup, /RANK #29/);
  match(markup, /FORGE/);
  match(markup, /class="routeBossPortrait" src="\/skins\/skill-arsenal-idle\.png"/);
  equal((markup.match(/routeBossPortrait/g) ?? []).length, 1);
});
