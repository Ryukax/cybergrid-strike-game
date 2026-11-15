import { deepStrictEqual, equal, ok } from 'node:assert/strict';
import { test } from 'node:test';

import {
  applyVersusNpcCombatPlan,
  type VersusNpcCombatApplication,
  type VersusNpcCombatRuntimeState,
} from './npc-combat-runtime';
import {
  BOSS_STRATEGY_PROFILES,
  chooseVersusNpcSignature,
  type VersusNpcContext,
} from './npc-strategy';
import {
  BOSS_SIGNATURE_COMMANDS,
  BOSS_SIGNATURE_MOTIFS,
  resolveNpcSignaturePresentation,
  type BossSkillId,
} from './npc-skill-presentation';
import { createVersusBossCounterpart } from './versus-boss-counterpart';
import {
  createVersusBossSignatureRuntimeState,
  dispatchVersusBossSignature,
} from './versus-boss-signature-dispatch';

const SIGNATURE_ACTION_BUDGET = 6;

function initialContext(skillId: BossSkillId): VersusNpcContext {
  return {
    skillId,
    npcHp: 54,
    playerHp: 68,
    maxHp: 100,
    npcShields: 0,
    maxShields: 3,
    npcRow: 1,
    playerRow: 2,
    npcCol: 1,
    incomingByRow: [1, 2, 0],
    playerFireCooldown: 0,
    playerMoveCooldown: 0,
    cardProgress: 0.72,
    step: 0,
    signatureMode: 0,
    signatureCharges: 0,
    signaturePlacements: [],
    signatureOriginRow: 1,
    signatureOriginCol: 1,
    signatureLastCommand: -1,
    signatureObjectiveCommand: -1,
    signatureCommandUses: [0, 0, 0],
  };
}

function initialCombatState(): VersusNpcCombatRuntimeState {
  return {
    npc: {
      row: 1,
      col: 1,
      hp: 54,
      shieldCharges: 0,
      signatureMode: 0,
      signatureCharges: 0,
      signaturePlacements: [],
      signatureOriginRow: 1,
      signatureOriginCol: 1,
    },
    player: {
      fireCooldown: 0,
      moveCooldown: 0,
    },
    cardsReady: false,
    cardTimer: 6,
  };
}

function hasObservableCombatEffect(
  before: VersusNpcCombatRuntimeState,
  after: VersusNpcCombatApplication,
): boolean {
  return after.projectiles.length > 0
    || after.npc.row !== before.npc.row
    || after.npc.col !== before.npc.col
    || after.npc.hp !== before.npc.hp
    || after.npc.shieldCharges !== before.npc.shieldCharges
    || after.player.fireCooldown !== before.player.fireCooldown
    || after.player.moveCooldown !== before.player.moveCooldown
    || after.cardTimer !== before.cardTimer;
}

test('every boss signature selects, dispatches, and applies a concrete multi-command sequence', () => {
  const skillIds = Object.keys(BOSS_STRATEGY_PROFILES) as BossSkillId[];
  equal(skillIds.length, 32);
  deepStrictEqual(new Set(skillIds), new Set(Object.keys(BOSS_SIGNATURE_COMMANDS)));

  for (const skillId of skillIds) {
    const profile = BOSS_STRATEGY_PROFILES[skillId];
    const counterpart = createVersusBossCounterpart({
      skinId: skillId,
      playableAbilityPreset: profile.abilities,
    });
    let signatureRuntime = createVersusBossSignatureRuntimeState(
      counterpart,
      { col: 1, row: 1 },
    );
    let combatState = initialCombatState();
    let context = initialContext(skillId);
    const commandUses: [number, number, number] = [0, 0, 0];
    const selectedCommands = new Set<number>();
    let observedCombatEffect = false;

    for (let beat = 0; beat < SIGNATURE_ACTION_BUDGET; beat += 1) {
      const plan = chooseVersusNpcSignature(context);
      const dispatched = dispatchVersusBossSignature({
        counterpart,
        state: signatureRuntime,
        commandIndex: plan.commandIndex,
        currentPosition: {
          col: combatState.npc.col,
          row: combatState.npc.row,
        },
      });

      equal(dispatched.kind, 'rival-command', `${skillId} beat ${beat} did not dispatch`);
      if (dispatched.kind !== 'rival-command') continue;

      equal(dispatched.command.ownerSkinId, skillId, `${skillId} lost command ownership`);
      equal(dispatched.command.skillId, skillId, `${skillId} dispatched another signature`);
      equal(dispatched.command.commandIndex, plan.commandIndex, `${skillId} plan/dispatch mismatch`);
      equal(
        dispatched.command.label,
        BOSS_SIGNATURE_COMMANDS[skillId][plan.commandIndex],
        `${skillId} dispatched the wrong command label`,
      );

      const presentation = resolveNpcSignaturePresentation(plan, skillId, beat + 1);
      equal(presentation.source, 'signature');
      equal(presentation.bossSkillId, skillId);
      equal(presentation.abilityId, skillId);
      equal(presentation.commandIndex, plan.commandIndex);
      equal(presentation.label, dispatched.command.label);
      equal(presentation.motif, BOSS_SIGNATURE_MOTIFS[skillId][plan.commandIndex]);
      equal(
        presentation.presentationKey,
        `signature:${skillId}:${plan.commandIndex}:${beat + 1}`,
      );

      const applied = applyVersusNpcCombatPlan(plan, combatState);
      observedCombatEffect ||= hasObservableCombatEffect(combatState, applied);
      combatState = applied;
      signatureRuntime = dispatched.state;
      selectedCommands.add(plan.commandIndex);
      commandUses[plan.commandIndex] += 1;

      context = {
        ...context,
        npcHp: applied.npc.hp,
        npcShields: applied.npc.shieldCharges,
        npcRow: applied.npc.row,
        npcCol: applied.npc.col,
        playerFireCooldown: applied.player.fireCooldown,
        playerMoveCooldown: applied.player.moveCooldown,
        cardProgress: Math.max(0, Math.min(1, applied.cardTimer / 6)),
        step: context.step + 1,
        signatureMode: applied.npc.signatureMode,
        signatureCharges: applied.npc.signatureCharges,
        signaturePlacements: [...applied.npc.signaturePlacements],
        signatureOriginRow: applied.npc.signatureOriginRow,
        signatureOriginCol: applied.npc.signatureOriginCol,
        signatureLastCommand: dispatched.command.commandIndex,
        signatureObjectiveCommand: plan.nextObjectiveCommand ?? -1,
        signatureCommandUses: [...commandUses] as [number, number, number],
      };
    }

    ok(
      selectedCommands.size >= 2,
      `${skillId} repeated only command ${[...selectedCommands].join(', ')} across its signature window`,
    );
    ok(
      observedCombatEffect,
      `${skillId} completed a signature window without a projectile or observable combat delta`,
    );
  }
});

test('all signature presentations retain a unique boss-and-command identity', () => {
  const skillIds = Object.keys(BOSS_STRATEGY_PROFILES) as BossSkillId[];
  const presentationKeys = new Set<string>();

  for (const skillId of skillIds) {
    const baselinePlan = chooseVersusNpcSignature(initialContext(skillId));
    for (const commandIndex of [0, 1, 2] as const) {
      // Presentation identity is independent of tactical targeting. Keep the
      // live plan's spatial fields so changes to lane/target resolution do not
      // make this registry-level regression brittle.
      const plan = {
        ...baselinePlan,
        abilityId: skillId,
        commandIndex,
      };
      const presentation = resolveNpcSignaturePresentation(plan, skillId, 1);

      equal(presentation.source, 'signature');
      equal(presentation.bossSkillId, skillId);
      equal(presentation.abilityId, skillId);
      equal(presentation.commandIndex, commandIndex);
      equal(presentation.label, BOSS_SIGNATURE_COMMANDS[skillId][commandIndex]);
      equal(presentation.motif, BOSS_SIGNATURE_MOTIFS[skillId][commandIndex]);
      equal(presentation.presentationKey, `signature:${skillId}:${commandIndex}:1`);
      ok(
        !presentationKeys.has(presentation.presentationKey),
        `${skillId} command ${commandIndex} reused another signature presentation identity`,
      );
      presentationKeys.add(presentation.presentationKey);
    }
  }

  equal(presentationKeys.size, skillIds.length * 3);
});
