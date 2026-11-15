import { deepStrictEqual, equal, match } from 'node:assert/strict';
import { test } from 'node:test';

import {
  chooseBossTacticalAction,
  createBossTacticalMemory,
  dominantObservedPlayerRow,
  observeBossPlayerPattern,
  recordBossTacticalAction,
  type BossTacticalDirectorInput,
  type BossTacticalMemory,
} from './boss-tactical-director';
import {
  chooseVersusNpcSignature,
  rankVersusNpcAbilities,
  resolveVersusNpcAbility,
  type VersusNpcContext,
} from './npc-strategy';

function context(overrides: Partial<VersusNpcContext> = {}): VersusNpcContext {
  return {
    skillId: 'counter',
    npcHp: 80,
    playerHp: 70,
    maxHp: 100,
    npcShields: 0,
    maxShields: 3,
    npcRow: 1,
    playerRow: 2,
    npcCol: 1,
    incomingByRow: [0, 0, 0],
    playerFireCooldown: 0.2,
    playerMoveCooldown: 0.2,
    cardProgress: 0.7,
    step: 0,
    signatureMode: 0,
    signatureCharges: 0,
    signaturePlacements: [],
    signatureOriginRow: 1,
    signatureOriginCol: 1,
    signatureLastCommand: -1,
    ...overrides,
  };
}

function directorInput(
  overrides: Partial<BossTacticalDirectorInput> = {},
): BossTacticalDirectorInput {
  return {
    context: context(),
    memory: createBossTacticalMemory(2),
    impactCommitted: false,
    decisionLocked: false,
    evasionAvailable: false,
    signatureAvailable: true,
    signatureCooldownReady: false,
    signatureWindowActive: false,
    signatureActionReady: false,
    abilityPlan: null,
    movementReady: true,
    basicReady: true,
    ...overrides,
  };
}

function observeRows(rows: readonly number[]): BossTacticalMemory {
  return rows.reduce(
    (memory, playerRow) => observeBossPlayerPattern(memory, { playerRow }),
    createBossTacticalMemory(rows[0] ?? 1),
  );
}

test('active signature chains remain the boss default skill plan', () => {
  const decision = chooseBossTacticalAction(directorInput({
    signatureWindowActive: true,
    signatureActionReady: true,
    abilityPlan: resolveVersusNpcAbility('shield', context()),
  }));

  equal(decision.action, 'signature-action');
  equal(decision.focus, 'signature');
  match(decision.reason, /continue the active signature chain/);
});

test('an active signature waits between legal commands instead of reopening or leaking into a card', () => {
  const decision = chooseBossTacticalAction(directorInput({
    signatureWindowActive: true,
    signatureActionReady: false,
    signatureCooldownReady: true,
    abilityPlan: resolveVersusNpcAbility('shield', context()),
  }));

  equal(decision.action, 'hold');
  equal(decision.focus, 'signature');
  match(decision.reason, /preserve the active signature chain/);
});

test('a visible projectile can reactively interrupt a skill plan, but committed hits cannot', () => {
  const threatened = context({ incomingByRow: [0, 3, 0] });
  const evade = chooseBossTacticalAction(directorInput({
    context: threatened,
    evasionAvailable: true,
    signatureWindowActive: true,
    signatureActionReady: true,
  }));
  equal(evade.action, 'evade');
  equal(evade.focus, 'survival');

  const committed = chooseBossTacticalAction(directorInput({
    context: threatened,
    impactCommitted: true,
    evasionAvailable: true,
  }));
  equal(committed.action, 'hold');
  match(committed.reason, /committed impact/);
});

test('continuous incoming pressure cannot starve a ready signature opening', () => {
  const threatened = context({ incomingByRow: [0, 2, 0] });
  const returnFire = resolveVersusNpcAbility('returnfire', threatened);
  const decision = chooseBossTacticalAction(directorInput({
    context: threatened,
    evasionAvailable: true,
    signatureCooldownReady: true,
    abilityPlan: returnFire,
  }));

  equal(decision.action, 'signature-open');
  equal(decision.focus, 'signature');
  match(decision.reason, /authored signature is ready/);
});

test('a ready signature opens before a critical recovery card', () => {
  const critical = context({ skillId: 'bloom', npcHp: 20 });
  const recovery = resolveVersusNpcAbility('heal', critical);
  const decision = chooseBossTacticalAction(directorInput({
    context: critical,
    signatureCooldownReady: true,
    abilityPlan: recovery,
  }));

  equal(decision.action, 'signature-open');
  equal(decision.focus, 'signature');
});

test('the director opens the exact setup-stage signature as soon as it is ready', () => {
  const ctx = context({
    skillId: 'chrono',
    incomingByRow: [0, 0, 0],
  });
  const signaturePlan = chooseVersusNpcSignature(ctx);
  const abilityPlan = rankVersusNpcAbilities(ctx)[0] ?? null;

  equal(signaturePlan.commandIndex, 0);
  equal(signaturePlan.strategyStage, 'setup');
  equal(signaturePlan.objectiveCommandIndex, 2);
  equal(signaturePlan.objectiveIntent, 'control');
  equal(abilityPlan?.abilityId, 'time');

  const open = chooseBossTacticalAction(directorInput({
    context: ctx,
    signatureCooldownReady: true,
    signaturePlan,
    abilityPlan,
  }));
  equal(open.action, 'signature-open');
  equal(open.focus, 'signature');
  equal(open.targetRow, signaturePlan.targetRow);
  match(open.reason, /open chrono command 3 control/);
});

test('committed pressure can open bookkeeping, but cannot execute an active signature command', () => {
  const threatened = context({ incomingByRow: [0, 3, 0] });
  const opening = chooseBossTacticalAction(directorInput({
    context: threatened,
    impactCommitted: true,
    decisionLocked: true,
    evasionAvailable: true,
    signatureCooldownReady: true,
  }));

  equal(opening.action, 'signature-open');
  equal(opening.focus, 'signature');

  const active = chooseBossTacticalAction(directorInput({
    context: threatened,
    impactCommitted: true,
    decisionLocked: true,
    evasionAvailable: true,
    signatureCooldownReady: true,
    signatureWindowActive: true,
    signatureActionReady: true,
  }));

  equal(active.action, 'hold');
  equal(active.focus, 'hold');
  match(active.reason, /committed impact/);
});

test('boss memory learns repeated lanes from visible player behavior', () => {
  let memory = createBossTacticalMemory(1);
  memory = observeBossPlayerPattern(memory, {
    playerRow: 2,
    moved: true,
    fired: true,
  });
  memory = observeBossPlayerPattern(memory, { playerRow: 2, fired: true });
  memory = observeBossPlayerPattern(memory, { playerRow: 0, defended: true });
  memory = observeBossPlayerPattern(memory, { playerRow: 2 });

  deepStrictEqual(memory.laneSamples, [1, 0, 3]);
  equal(memory.observedMoves, 1);
  equal(memory.observedShots, 2);
  equal(memory.observedDefenses, 1);
  equal(dominantObservedPlayerRow(memory), 2);
});

test('when skills recover, a boss adapts to lane habits and breaks basic-fire loops', () => {
  const learned = observeRows([2, 2, 2, 0]);
  const laneAdaptation = chooseBossTacticalAction(directorInput({
    context: context({ npcRow: 0, playerRow: 0 }),
    memory: learned,
    signatureAvailable: false,
    abilityPlan: null,
  }));
  equal(laneAdaptation.action, 'maneuver');
  equal(laneAdaptation.focus, 'adapt');
  equal(laneAdaptation.targetRow, 2);

  let repeated = recordBossTacticalAction(createBossTacticalMemory(), 'basic');
  repeated = recordBossTacticalAction(repeated, 'basic');
  const varied = chooseBossTacticalAction(directorInput({
    memory: repeated,
    signatureAvailable: false,
    abilityPlan: null,
  }));
  equal(varied.action, 'maneuver');
  match(varied.reason, /vary a repeated basic-fire loop/);
});

test('basic fire is only fallback pressure while all skills recover', () => {
  const decision = chooseBossTacticalAction(directorInput({
    signatureAvailable: false,
    abilityPlan: null,
    movementReady: false,
    basicReady: true,
  }));

  equal(decision.action, 'basic');
  equal(decision.focus, 'pressure');
  equal(decision.targetRow, 2);
});
