import {
  COMPETITIVE_RULESET,
  boundedRecovery,
  clampCompetitiveResources,
} from './competitive-balance';
import {
  shotRowsForPlan,
  type VersusAbilityPlan,
  type VersusSignaturePlan,
} from './npc-strategy';

export interface VersusNpcCombatantState {
  row: number;
  col: number;
  hp: number;
  shieldCharges: number;
  signatureMode: number;
  signatureCharges: number;
  signaturePlacements: readonly number[];
  signatureOriginRow: number;
  signatureOriginCol: number;
}

export interface VersusNpcOpponentState {
  fireCooldown: number;
  moveCooldown: number;
}

export interface VersusNpcCombatRuntimeState {
  npc: VersusNpcCombatantState;
  player: VersusNpcOpponentState;
  cardsReady: boolean;
  cardTimer: number;
}

export interface VersusNpcPlannedProjectile {
  row: number;
  power: number;
  big: boolean;
  salvoIndex: number;
  leechOnHit: number;
}

export interface VersusNpcCombatApplication extends VersusNpcCombatRuntimeState {
  projectiles: VersusNpcPlannedProjectile[];
}

function isSignaturePlan(
  plan: VersusAbilityPlan | VersusSignaturePlan,
): plan is VersusSignaturePlan {
  return 'nextCharges' in plan;
}

/**
 * Applies one already-selected NPC plan to a compact duel snapshot.
 *
 * Selection remains in npc-strategy, while the caller remains responsible for
 * materializing the returned projectile descriptors and resolving collisions.
 * In particular, leech is copied onto a projectile and never awarded at cast.
 */
export function applyVersusNpcCombatPlan(
  plan: VersusAbilityPlan | VersusSignaturePlan,
  state: VersusNpcCombatRuntimeState,
): VersusNpcCombatApplication {
  const npc: VersusNpcCombatantState = {
    ...state.npc,
    signaturePlacements: [...state.npc.signaturePlacements],
  };
  const player = { ...state.player };
  let cardTimer = state.cardTimer;

  if (plan.moveToRow !== undefined) {
    npc.row = Math.max(0, Math.min(2, plan.moveToRow));
  }
  if (isSignaturePlan(plan)) {
    if (plan.columnDelta !== 0) {
      npc.col = Math.max(0, Math.min(2, npc.col + plan.columnDelta));
    }
    npc.signatureMode = plan.nextMode;
    npc.signatureCharges = plan.nextCharges;
    npc.signaturePlacements = [...plan.nextPlacements];
    npc.signatureOriginRow = plan.nextOriginRow;
    npc.signatureOriginCol = plan.nextOriginCol;
  }

  if (plan.recovery > 0) npc.hp = boundedRecovery(npc.hp, plan.recovery);
  if (plan.shields > 0) {
    npc.shieldCharges = Math.min(
      COMPETITIVE_RULESET.maxShields,
      npc.shieldCharges + plan.shields,
    );
  }
  if (plan.fireDisruption > 0) {
    player.fireCooldown = Math.max(
      player.fireCooldown,
      Math.min(COMPETITIVE_RULESET.maxFireDisruption, plan.fireDisruption),
    );
  }
  if (plan.moveDisruption > 0) {
    player.moveCooldown = Math.max(
      player.moveCooldown,
      Math.min(COMPETITIVE_RULESET.maxMoveDisruption, plan.moveDisruption),
    );
  }
  if (plan.cardPressure > 0 && !state.cardsReady) {
    cardTimer = Math.max(0, cardTimer - Math.min(2, plan.cardPressure));
  }

  const projectiles: VersusNpcPlannedProjectile[] = [];
  for (const row of shotRowsForPlan(plan)) {
    for (let salvoIndex = 0; salvoIndex < Math.max(1, plan.salvo); salvoIndex++) {
      projectiles.push({
        row,
        power: plan.power,
        big: plan.big,
        salvoIndex,
        leechOnHit: plan.leechOnHit,
      });
    }
  }

  const normalized = clampCompetitiveResources(npc.hp, npc.shieldCharges);
  npc.hp = normalized.hp;
  npc.shieldCharges = normalized.shields;

  return {
    npc,
    player,
    cardsReady: state.cardsReady,
    cardTimer,
    projectiles,
  };
}
