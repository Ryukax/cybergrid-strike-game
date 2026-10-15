import { deepStrictEqual, equal, notDeepStrictEqual, ok } from 'node:assert/strict';
import { test } from 'node:test';

import { CAMPAIGN_ACTS, TOTAL_CAMPAIGN_ENCOUNTERS } from './campaign-director.ts';
import {
  CAMPAIGN_WAVES_PER_ACT,
  LONG_FORM_MILESTONE_LEVELS,
  MILESTONE_EVOLUTIONS,
  MILESTONE_FIRST_WAVE,
  MILESTONE_INTERVAL_WAVES,
  chooseMilestoneEvolutionOptions,
  getMilestoneEvolution,
  milestoneAwardsThroughWave,
  milestoneBossEvolutionProfile,
  milestoneCardRechargeMultiplier,
  milestoneFireRateMultiplier,
  milestoneIntegrityBreachMultiplier,
  milestoneIntegrityRestorationMultiplier,
  milestoneProjectileDamageMultiplier,
  milestoneProjectileSpeedMultiplier,
  milestoneTrackCapacity,
  resolveMilestoneDefeatProgress,
  resolveMilestonePressureRecovery,
  resolveMilestoneWorldAct,
  resolveMilestoneWorldStepDelta,
  resolveMilestoneWorldStepReward,
  type MilestoneEvolutionTrack,
} from './milestone-evolution.ts';

test('milestone catalog has unique ids and valid level caps', () => {
  const ids = MILESTONE_EVOLUTIONS.map((evolution) => evolution.id);
  equal(new Set(ids).size, ids.length);
  equal(MILESTONE_EVOLUTIONS.every((evolution) => evolution.maxLevel > 0), true);
});
test('the same wave and build always produce the same offer', () => {
  const levels = { capacitor: 1, repairWeave: 1 };
  deepStrictEqual(
    chooseMilestoneEvolutionOptions(levels, 15),
    chooseMilestoneEvolutionOptions(levels, 15),
  );
});

test('a full offer represents score, wave and integrity tracks', () => {
  const offer = chooseMilestoneEvolutionOptions({}, 5);
  equal(offer.length, 3);
  deepStrictEqual(
    new Set(offer.map((id) => getMilestoneEvolution(id)?.track)),
    new Set(['score', 'wave', 'integrity']),
  );
});

test('maxed evolutions are removed without collapsing the remaining offer', () => {
  const maxed = Object.fromEntries(
    MILESTONE_EVOLUTIONS.map((evolution) => [evolution.id, evolution.maxLevel]),
  );
  equal(chooseMilestoneEvolutionOptions(maxed, 165).length, 0);

  const oneAvailable = { ...maxed, capacitor: 2 };
  deepStrictEqual(chooseMilestoneEvolutionOptions(oneAvailable, 165), ['capacitor']);
});

test('milestone wave contributes to deterministic offer rotation', () => {
  const early = chooseMilestoneEvolutionOptions({}, 5);
  const later = chooseMilestoneEvolutionOptions({}, 10);
  notDeepStrictEqual(early, later);
});

test('Merit Chain rewards a bounded no-breach defeat streak', () => {
  let progress = resolveMilestoneDefeatProgress({ meritChain: 2 }, 0, 0);
  equal(progress.defeatStreak, 1);
  equal(progress.bonusIntegrityWork, 20);

  progress = resolveMilestoneDefeatProgress({ meritChain: 2 }, 9, 0);
  equal(progress.defeatStreak, 10);
  equal(progress.bonusIntegrityWork, 100);
});

test('Vanguard Circuit converts only its authored defeat quota into bonus waves', () => {
  const before = resolveMilestoneDefeatProgress({ vanguardCircuit: 3 }, 0, 5);
  equal(before.bonusWaves, 1);
  equal(before.vanguardDefeats, 0);

  const inactive = resolveMilestoneDefeatProgress({}, 4, 11);
  equal(inactive.bonusWaves, 0);
  equal(inactive.vanguardDefeats, 0);
});

test('Integrity Lattice strengthens repair and reduces breach severity by level', () => {
  equal(milestoneIntegrityRestorationMultiplier({}), 1);
  equal(milestoneIntegrityRestorationMultiplier({ integrityLattice: 3 }), 1.6);
  equal(milestoneIntegrityBreachMultiplier({}), 1);
  equal(milestoneIntegrityBreachMultiplier({ integrityLattice: 3 }), 0.55);
});

test('long-form catalog spans the entire authored campaign in every track', () => {
  const longForm = MILESTONE_EVOLUTIONS.filter((evolution) => evolution.longForm);
  equal(longForm.length, 18);
  equal(longForm.every((evolution) => evolution.maxLevel === LONG_FORM_MILESTONE_LEVELS), true);
  equal(milestoneAwardsThroughWave(TOTAL_CAMPAIGN_ENCOUNTERS), 144);
  equal(MILESTONE_FIRST_WAVE, 5);
  equal(MILESTONE_INTERVAL_WAVES, 5);
  for (const track of ['score', 'wave', 'integrity'] as const) {
    equal(milestoneTrackCapacity(track), 158);
    ok(milestoneTrackCapacity(track) >= milestoneAwardsThroughWave(TOTAL_CAMPAIGN_ENCOUNTERS));
  }
});

test('each province unlocks exactly one new horizon line per track', () => {
  for (let act = 0; act < CAMPAIGN_ACTS.length; act++) {
    const additions = MILESTONE_EVOLUTIONS.filter(
      (evolution) => evolution.longForm && evolution.unlockAct === act,
    );
    equal(additions.length, 3);
    deepStrictEqual(
      new Set(additions.map((evolution) => evolution.track)),
      new Set(['score', 'wave', 'integrity']),
    );
    equal(resolveMilestoneWorldAct(act * CAMPAIGN_WAVES_PER_ACT + 1), act);
  }
});

test('a full milestone backlog remains redeemable at the final world depth', () => {
  const levels: Record<string, number> = {};
  for (
    let ordinal = MILESTONE_FIRST_WAVE;
    ordinal <= TOTAL_CAMPAIGN_ENCOUNTERS;
    ordinal += MILESTONE_INTERVAL_WAVES
  ) {
    const offer = chooseMilestoneEvolutionOptions(levels, ordinal, 3, {
      worldDepth: TOTAL_CAMPAIGN_ENCOUNTERS,
    });
    equal(offer.length, 3, `catch-up offer missing at milestone ${ordinal}`);
    const selected = offer.find((id) => getMilestoneEvolution(id)?.track === 'wave');
    ok(selected);
    levels[selected] = (levels[selected] ?? 0) + 1;
  }
});

test('a single-track specialist receives a valid three-track offer through wave 720', () => {
  const tracks: readonly MilestoneEvolutionTrack[] = ['score', 'wave', 'integrity'];
  for (const chosenTrack of tracks) {
    const levels: Record<string, number> = {};
    for (
      let wave = MILESTONE_FIRST_WAVE;
      wave <= TOTAL_CAMPAIGN_ENCOUNTERS;
      wave += MILESTONE_INTERVAL_WAVES
    ) {
      const offer = chooseMilestoneEvolutionOptions(levels, wave, 3, { worldDepth: wave });
      equal(offer.length, 3, `${chosenTrack} specialist lost an offer at wave ${wave}`);
      deepStrictEqual(
        new Set(offer.map((id) => getMilestoneEvolution(id)?.track)),
        new Set(tracks),
      );
      const selected = offer.find((id) => getMilestoneEvolution(id)?.track === chosenTrack);
      ok(selected);
      levels[selected] = (levels[selected] ?? 0) + 1;
      ok(levels[selected] <= (getMilestoneEvolution(selected)?.maxLevel ?? 0));
    }
  }
});

test('future-world horizon lines stay locked until their campaign act', () => {
  const actOne = chooseMilestoneEvolutionOptions({}, 5, MILESTONE_EVOLUTIONS.length, {
    worldDepth: 5,
  });
  equal(actOne.some((id) => (getMilestoneEvolution(id)?.unlockAct ?? 0) > 0), false);

  const actSix = chooseMilestoneEvolutionOptions({}, 605, MILESTONE_EVOLUTIONS.length, {
    worldDepth: 605,
  });
  equal(actSix.some((id) => getMilestoneEvolution(id)?.unlockAct === 5), true);

  const lateAwardAtEarlyFrontier = chooseMilestoneEvolutionOptions(
    {},
    605,
    MILESTONE_EVOLUTIONS.length,
    { worldDepth: 5 },
  );
  equal(
    lateAwardAtEarlyFrontier.some((id) => (getMilestoneEvolution(id)?.unlockAct ?? 0) > 0),
    false,
  );
});

test('long-form combat curves are monotonic and remain inside hard caps', () => {
  const low = {
    kineticIndex: 1,
    marchCadence: 1,
    pressureCompiler: 1,
    archiveTargeting: 1,
    foundryCaliber: 1,
  };
  const max = {
    kineticIndex: 24,
    marchCadence: 24,
    pressureCompiler: 24,
    archiveTargeting: 24,
    foundryCaliber: 24,
  };
  ok(milestoneProjectileSpeedMultiplier(max) > milestoneProjectileSpeedMultiplier(low));
  ok(milestoneFireRateMultiplier(max) > milestoneFireRateMultiplier(low));
  ok(milestoneCardRechargeMultiplier(max) > milestoneCardRechargeMultiplier(low));
  const damage = milestoneProjectileDamageMultiplier(max, {
    injured: true,
    evolved: true,
    big: true,
    piercing: true,
  });
  ok(damage > 1);
  ok(damage <= 1.9);
});

test('traversal and pressure rewards accumulate fractions without unbounded resources', () => {
  const levels = {
    routeCapacitor: 24,
    currentReserve: 1,
    continuityDrive: 24,
    relayAegis: 24,
    forgePlating: 1,
    tidalRecovery: 24,
  };
  const step = resolveMilestoneWorldStepReward(levels);
  equal(step.handChargeFraction, 0.24);
  equal(step.piercingProgress, 0.125);
  equal(step.shieldProgress, 0.125);
  ok(Math.abs(step.overclockSeconds - 2.4) < Number.EPSILON * 4);
  ok(step.nodeRepair > step.sectorRepair);
  const recovery = resolveMilestonePressureRecovery(levels);
  ok(recovery.nodeRepair > recovery.sectorRepair);
  ok(recovery.sectorRepair > recovery.globalRepair);
});

test('world traversal rewards only newly reached depth', () => {
  deepStrictEqual(resolveMilestoneWorldStepDelta(0, 10), {
    targetSteps: 9,
    newSteps: 9,
  });
  for (const revisitedDepth of [10, 9, 10, 2]) {
    deepStrictEqual(resolveMilestoneWorldStepDelta(9, revisitedDepth), {
      targetSteps: 9,
      newSteps: 0,
    });
  }
  deepStrictEqual(resolveMilestoneWorldStepDelta(9, 12), {
    targetSteps: 11,
    newSteps: 2,
  });
});

test('late integrity curves remain finite and never invert breach damage', () => {
  const max = { integrityLattice: 3, fieldWeave: 24, memoryBulkhead: 24, nullLattice: 24 };
  ok(milestoneIntegrityRestorationMultiplier(max, 20) <= 2.5);
  ok(milestoneIntegrityBreachMultiplier(max, 20) >= 0.3);
  ok(Number.isFinite(milestoneIntegrityBreachMultiplier(max, 20)));
});

test('expanded ranks map to bounded Boss evolution complexity', () => {
  deepStrictEqual(
    milestoneBossEvolutionProfile({ rapidBuster: 2, capacitor: 1 }),
    { mutationCount: 3, fusionLevel: 1 },
  );
  const maximum = Object.fromEntries(
    MILESTONE_EVOLUTIONS.map((evolution) => [evolution.id, evolution.maxLevel]),
  );
  const profile = milestoneBossEvolutionProfile(maximum);
  equal(profile.mutationCount, 8);
  equal(profile.fusionLevel, 3);

  deepStrictEqual(
    milestoneBossEvolutionProfile({
      rapidBuster: 999,
      capacitor: Number.NaN,
      repairWeave: -5,
      unknownEvolution: 999,
    }),
    { mutationCount: 3, fusionLevel: 0 },
  );
});

test('Horizon Engine accelerates Vanguard without invalid thresholds', () => {
  const base = resolveMilestoneDefeatProgress({ vanguardCircuit: 3 }, 0, 0);
  const accelerated = resolveMilestoneDefeatProgress(
    { vanguardCircuit: 3, horizonEngine: 24, fabricationCycle: 24 },
    0,
    5,
  );
  equal(base.vanguardDefeats, 1);
  equal(accelerated.bonusWaves, 1);
  equal(accelerated.overclockSeconds, 6);
  ok(accelerated.vanguardDefeats >= 0);
});

test('Horizon Engine keeps exact Vanguard quotas throughout the 720-wave campaign', () => {
  for (let vanguardLevel = 1; vanguardLevel <= 3; vanguardLevel++) {
    const threshold = 12 - vanguardLevel * 2;
    for (let horizonLevel = 0; horizonLevel <= LONG_FORM_MILESTONE_LEVELS; horizonLevel++) {
      let progress = 0;
      let awarded = 0;
      for (let defeats = 1; defeats <= 720; defeats++) {
        const resolved = resolveMilestoneDefeatProgress(
          { vanguardCircuit: vanguardLevel, horizonEngine: horizonLevel },
          0,
          progress,
        );
        progress = resolved.vanguardDefeats;
        awarded += resolved.bonusWaves;
        const expected = Math.floor(
          defeats * (LONG_FORM_MILESTONE_LEVELS + horizonLevel)
            / (LONG_FORM_MILESTONE_LEVELS * threshold),
        );
        equal(
          awarded,
          expected,
          `Vanguard ${vanguardLevel}, Horizon ${horizonLevel}, defeat ${defeats}`,
        );
      }
    }
  }
});
