import { deepStrictEqual, equal, notEqual, ok } from 'node:assert/strict';
import { test } from 'node:test';

import { CANONICAL_ABILITY_IDS } from './ability-system';
import { ABILITY_POOL } from './constants';
import {
  ABILITY_ANIMATION_PROFILES,
  ABILITY_EFFECT_MOTIFS,
  createAbilityAnimationPresentation,
  createGeneratedAbilityAnimationProfile,
  resolveAbilityAnimationDrawPlan,
  resolveAbilityAnimationFootprint,
  resolveAbilityAnimationProfile,
} from './ability-animation';

test('the animation registry exactly covers every canonical card', () => {
  const poolIds = ABILITY_POOL.map(({ id }) => id).sort();
  const canonicalIds = [...CANONICAL_ABILITY_IDS].sort();
  const animationIds = Object.keys(ABILITY_ANIMATION_PROFILES).sort();
  const motifIds = Object.keys(ABILITY_EFFECT_MOTIFS).sort();
  deepStrictEqual(animationIds, poolIds);
  deepStrictEqual(animationIds, canonicalIds);
  deepStrictEqual(motifIds, canonicalIds);
});

test('all canonical cards have renderer-effective unique animation signatures', () => {
  const signatures = new Set<string>();
  for (const abilityId of CANONICAL_ABILITY_IDS) {
    const profile = resolveAbilityAnimationProfile(abilityId);
    ok(profile, `${abilityId} lacks an animation profile`);
    equal(profile.source, 'imagegen');
    equal(profile.abilityId, abilityId);
    equal(profile.imagegenAsset?.abilityId, abilityId);
    // The signature intentionally excludes ability id, label, revision, side,
    // and data attributes. Every field below is consumed by the renderer.
    signatures.add(profile.visualSignature);
  }
  equal(signatures.size, CANONICAL_ABILITY_IDS.length);
});

test('previously collapsed target and suppression cards now remain distinct', () => {
  const predator = ['seeker', 'marksman', 'snipe'] as const;
  const nullCards = ['signaljam', 'mutationlock', 'quarantine'] as const;
  for (const group of [predator, nullCards]) {
    const signatures = group.map((abilityId) => {
      const profile = resolveAbilityAnimationProfile(abilityId);
      ok(profile);
      return profile.visualSignature;
    });
    equal(new Set(signatures).size, group.length);
  }
});

test('unknown ids do not silently acquire a canonical fallback', () => {
  equal(resolveAbilityAnimationProfile('not-an-authored-card'), null);
});

test('presentation placement follows the authored profile without changing identity', () => {
  const nuke = resolveAbilityAnimationProfile('nuke');
  const heal = resolveAbilityAnimationProfile('heal');
  ok(nuke && heal);
  deepStrictEqual(createAbilityAnimationPresentation(nuke, 'NUKE', 2).targetRows, [0, 1, 2]);
  deepStrictEqual(createAbilityAnimationPresentation(heal, 'RECOVER', 2).targetRows, []);
  equal(createAbilityAnimationPresentation(nuke, 'NUKE', 2).profile, nuke);
});

test('multi-cell animation footprints compose one ordered unified span', () => {
  deepStrictEqual(resolveAbilityAnimationFootprint([2, 0, 1]), {
    rows: [0, 1, 2],
    minRow: 0,
    maxRow: 2,
    centerRow: 1,
    spanRows: 3,
    mode: 'unified-span',
  });
});

test('animation footprints clamp and deduplicate rows without changing hit coverage', () => {
  deepStrictEqual(resolveAbilityAnimationFootprint([3, 2, -4, 2]), {
    rows: [0, 2],
    minRow: 0,
    maxRow: 2,
    centerRow: 1,
    spanRows: 3,
    mode: 'unified-span',
  });
  deepStrictEqual(resolveAbilityAnimationFootprint([], 7), {
    rows: [2],
    minRow: 2,
    maxRow: 2,
    centerRow: 2,
    spanRows: 1,
    mode: 'single',
  });
  deepStrictEqual(resolveAbilityAnimationFootprint([Number.NaN, 1, Number.POSITIVE_INFINITY]), {
    rows: [1],
    minRow: 1,
    maxRow: 1,
    centerRow: 1,
    spanRows: 1,
    mode: 'single',
  });
});

test('multi-cell draw plans always place one authored image while preserving exact aim cells', () => {
  for (const rows of [[0, 1], [1, 2], [0, 1, 2], [0, 2]]) {
    const plan = resolveAbilityAnimationDrawPlan(rows, 2);
    equal(plan.imagePlacements.length, 1);
    deepStrictEqual(plan.maskRows, rows);
  }
  deepStrictEqual(resolveAbilityAnimationDrawPlan([0, 1]).imagePlacements, [{
    centerRow: 0.5,
    spanRows: 2,
  }]);
  deepStrictEqual(resolveAbilityAnimationDrawPlan([0, 2], 2).imagePlacements, [{
    centerRow: 2,
    spanRows: 3,
  }]);
});

test('generated cards resolve compositionally and deterministically', () => {
  const first = createGeneratedAbilityAnimationProfile(
    'manifest-alpha',
    'projector',
    'rupture',
    'kinetic',
  );
  const repeated = createGeneratedAbilityAnimationProfile(
    'manifest-alpha',
    'projector',
    'rupture',
    'kinetic',
  );
  const other = createGeneratedAbilityAnimationProfile(
    'manifest-beta',
    'field',
    'impulse',
    'phase',
  );
  equal(first.source, 'generated');
  equal(first.imagegenAsset, null);
  deepStrictEqual(first, repeated);
  notEqual(first.visualSignature, other.visualSignature);
});
