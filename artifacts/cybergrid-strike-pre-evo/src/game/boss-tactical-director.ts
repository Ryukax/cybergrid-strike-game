import {
  bossStrategyProfile,
  type VersusAbilityPlan,
  type VersusNpcContext,
} from './npc-strategy';

export type BossTacticalAction =
  | 'hold'
  | 'evade'
  | 'signature-open'
  | 'signature-action'
  | 'ability'
  | 'maneuver'
  | 'basic';

export type BossTacticalFocus =
  | 'hold'
  | 'survival'
  | 'counter'
  | 'signature'
  | 'adapt'
  | 'pressure';

export interface BossPlayerObservation {
  readonly playerRow: number;
  readonly moved?: boolean;
  readonly fired?: boolean;
  readonly defended?: boolean;
}

export interface BossTacticalMemory {
  readonly laneSamples: readonly [number, number, number];
  readonly lastPlayerRow: number;
  readonly observedMoves: number;
  readonly observedShots: number;
  readonly observedDefenses: number;
  readonly sampleCount: number;
  readonly lastAction: BossTacticalAction | null;
  readonly repeatedActionCount: number;
}

export interface BossTacticalDirectorInput {
  readonly context: VersusNpcContext;
  readonly memory: BossTacticalMemory;
  /** A collision is already unavoidable, so a late teleport is not legal. */
  readonly impactCommitted: boolean;
  readonly decisionLocked: boolean;
  readonly evasionAvailable: boolean;
  readonly signatureAvailable: boolean;
  readonly signatureCooldownReady: boolean;
  readonly signatureWindowActive: boolean;
  readonly signatureActionReady: boolean;
  readonly abilityPlan: VersusAbilityPlan | null;
  readonly movementReady: boolean;
  readonly basicReady: boolean;
}

export interface BossTacticalDecision {
  readonly action: BossTacticalAction;
  readonly focus: BossTacticalFocus;
  readonly targetRow: number;
  readonly reason: string;
}

const REACTIVE_ABILITY_IDS = new Set(['interceptor', 'returnfire']);

function clampRow(row: number): number {
  return Math.max(0, Math.min(2, Math.round(row)));
}

export function createBossTacticalMemory(playerRow = 1): BossTacticalMemory {
  return {
    laneSamples: [0, 0, 0],
    lastPlayerRow: clampRow(playerRow),
    observedMoves: 0,
    observedShots: 0,
    observedDefenses: 0,
    sampleCount: 0,
    lastAction: null,
    repeatedActionCount: 0,
  };
}

/** Record only player-visible behavior; the director never reads hidden input. */
export function observeBossPlayerPattern(
  memory: BossTacticalMemory,
  observation: BossPlayerObservation,
): BossTacticalMemory {
  const row = clampRow(observation.playerRow);
  const laneSamples: [number, number, number] = [...memory.laneSamples];
  laneSamples[row] += 1;
  return {
    ...memory,
    laneSamples,
    lastPlayerRow: row,
    observedMoves: memory.observedMoves + Number(Boolean(observation.moved)),
    observedShots: memory.observedShots + Number(Boolean(observation.fired)),
    observedDefenses: memory.observedDefenses + Number(Boolean(observation.defended)),
    sampleCount: memory.sampleCount + 1,
  };
}

export function recordBossTacticalAction(
  memory: BossTacticalMemory,
  action: BossTacticalAction,
): BossTacticalMemory {
  return {
    ...memory,
    lastAction: action,
    repeatedActionCount: memory.lastAction === action
      ? memory.repeatedActionCount + 1
      : 1,
  };
}

export function dominantObservedPlayerRow(memory: BossTacticalMemory): number {
  const highest = Math.max(...memory.laneSamples);
  if (highest <= 0) return memory.lastPlayerRow;
  const candidates = [0, 1, 2].filter((row) => memory.laneSamples[row] === highest);
  return candidates.includes(memory.lastPlayerRow)
    ? memory.lastPlayerRow
    : candidates[0] ?? memory.lastPlayerRow;
}

function defensiveAbility(plan: VersusAbilityPlan): boolean {
  return plan.recovery > 0 || plan.shields > 0 || plan.moveToRow !== undefined;
}

function reactiveAbility(plan: VersusAbilityPlan): boolean {
  return REACTIVE_ABILITY_IDS.has(plan.abilityId)
    || plan.fireDisruption > 0
    || plan.moveDisruption > 0;
}

/**
 * Select the next category of action without executing it.
 *
 * The order makes authored skills the default plan, while still allowing a
 * readable projectile, critical health, or a repeated player habit to change
 * the answer. This is intentionally pure so campaign bosses and NPC-vs-NPC
 * can share the same decision contract.
 */
export function chooseBossTacticalAction(
  input: BossTacticalDirectorInput,
): BossTacticalDecision {
  const { context, memory, abilityPlan } = input;
  const profile = bossStrategyProfile(context.skillId);
  const incoming = context.incomingByRow.reduce((sum, count) => sum + count, 0);
  const critical = context.npcHp / Math.max(1, context.maxHp) <= 0.34;
  const targetRow = dominantObservedPlayerRow(memory);
  const reasonPrefix = `${profile.skillId}: ${profile.strategy}`;

  if (input.decisionLocked || input.impactCommitted) {
    return {
      action: 'hold',
      focus: 'hold',
      targetRow,
      reason: input.impactCommitted
        ? `${reasonPrefix}; committed impact resolves before another decision`
        : `${reasonPrefix}; current authored action remains locked`,
    };
  }

  if (input.signatureWindowActive && incoming > 0 && input.evasionAvailable) {
    return {
      action: 'evade',
      focus: 'survival',
      targetRow,
      reason: `${reasonPrefix}; preserve the signature chain with a readable evade`,
    };
  }

  if (input.signatureWindowActive && input.signatureActionReady) {
    return {
      action: 'signature-action',
      focus: 'signature',
      targetRow,
      reason: `${reasonPrefix}; continue the active signature chain`,
    };
  }

  if (input.signatureWindowActive) {
    return {
      action: 'hold',
      focus: 'signature',
      targetRow,
      reason: `${reasonPrefix}; preserve the active signature chain until its next legal command`,
    };
  }

  if (!input.signatureWindowActive
    && abilityPlan && incoming > 0 && reactiveAbility(abilityPlan)) {
    return {
      action: 'ability',
      focus: 'counter',
      targetRow: abilityPlan.targetRow,
      reason: `${reasonPrefix}; ${abilityPlan.abilityId} answers live pressure`,
    };
  }

  if (incoming > 0 && input.evasionAvailable) {
    return {
      action: 'evade',
      focus: 'survival',
      targetRow,
      reason: `${reasonPrefix}; visible incoming pressure requires a readable evade`,
    };
  }

  if (abilityPlan && critical && defensiveAbility(abilityPlan)) {
    return {
      action: 'ability',
      focus: 'survival',
      targetRow: abilityPlan.moveToRow ?? abilityPlan.targetRow,
      reason: `${reasonPrefix}; ${abilityPlan.abilityId} protects critical integrity`,
    };
  }

  if (input.signatureAvailable && input.signatureCooldownReady) {
    return {
      action: 'signature-open',
      focus: 'signature',
      targetRow,
      reason: `${reasonPrefix}; authored signature is ready`,
    };
  }

  if (abilityPlan) {
    return {
      action: 'ability',
      focus: 'pressure',
      targetRow: abilityPlan.moveToRow ?? abilityPlan.targetRow,
      reason: `${reasonPrefix}; execute ready owned card ${abilityPlan.abilityId}`,
    };
  }

  const playerHabitKnown = memory.sampleCount >= 3;
  const shouldBreakBasicLoop = memory.lastAction === 'basic'
    && memory.repeatedActionCount >= 2;
  if (input.movementReady && (
    (playerHabitKnown && targetRow !== context.npcRow)
    || shouldBreakBasicLoop
  )) {
    return {
      action: 'maneuver',
      focus: 'adapt',
      targetRow,
      reason: shouldBreakBasicLoop
        ? `${reasonPrefix}; vary a repeated basic-fire loop`
        : `${reasonPrefix}; adapt toward the player's observed lane habit`,
    };
  }

  if (input.basicReady) {
    return {
      action: 'basic',
      focus: 'pressure',
      targetRow: clampRow(context.playerRow),
      reason: `${reasonPrefix}; maintain pressure while skills recover`,
    };
  }

  if (input.movementReady) {
    return {
      action: 'maneuver',
      focus: 'adapt',
      targetRow,
      reason: `${reasonPrefix}; reposition while skills recover`,
    };
  }

  return {
    action: 'hold',
    focus: 'hold',
    targetRow,
    reason: `${reasonPrefix}; wait for the next legal authored action`,
  };
}
