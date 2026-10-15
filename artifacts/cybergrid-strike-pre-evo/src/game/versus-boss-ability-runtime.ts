import { COMPETITIVE_RULESET } from './competitive-balance';
import {
  VERSUS_ABILITY_LIMITS,
  resolveVersusAbilityEffect,
  type VersusAbilityContext,
  type VersusAbilityOutcome,
  type VersusProjectileIntent,
} from './versus-ability-resolver';
import {
  advanceVersusStatusRuntime,
  applyVersusStatusIntents,
  createEmptyVersusStatusRuntimePatch,
  type VersusStatusRuntimePatch,
} from './versus-status-runtime';

/**
 * A side-neutral combatant snapshot with the timing fields needed by playable
 * abilities. The NPC adapter deliberately owns this state instead of mutating
 * GameState so campaign bosses and ordinary versus rivals can share it.
 */
export interface VersusBossAbilityCombatantState {
  hp: number;
  maxHp: number;
  shields: number;
  maxShields: number;
  row: number;
  /** Local column within that combatant's three-column half (0-2). */
  column: number;
  fireCooldown: number;
  moveCooldown: number;
  cardCooldown: number;
}

export interface VersusBossAbilityRuntimeState {
  npc: VersusBossAbilityCombatantState;
  player: VersusBossAbilityCombatantState;
  /** Statuses are stored relative to the NPC cast: caster = NPC, opponent = player. */
  npcStatusRuntime: VersusStatusRuntimePatch;
  npcHandRefreshRequested: boolean;
  npcIntegrityMultiplier: number;
}

export interface VersusBossAbilityMetadata {
  playerTraits?: readonly string[];
  playerMovement?: string;
  playerElement?: string;
  playerEntityType?: string;
  playerFusionLevel?: number;
  playerMutationCount?: number;
  distance?: number;
  /** Deterministic per-projectile rolls supplied by the game session. */
  criticalRolls?: readonly number[];
}

export interface VersusBossAbilityProjectile {
  owner: 'npc';
  /**
   * Board-space trajectory. Ordinary NPC fire travels left toward the player;
   * Rearguard additionally emits an independent right-moving rear trajectory.
   */
  direction: -1 | 1;
  row: number;
  power: number;
  piercing: boolean;
  big: boolean;
  homing: boolean;
  salvoIndex: number;
  sourceAbilityId: string;
}

export interface VersusBossAbilityExecution {
  state: VersusBossAbilityRuntimeState;
  outcome: VersusAbilityOutcome;
  projectiles: readonly VersusBossAbilityProjectile[];
}

export interface VersusBossBasicProjectileOptions {
  row?: number;
  power?: number;
  big?: boolean;
  homing?: boolean;
  /** Deterministic roll in [0, 1). Omit to resolve the shot as non-critical. */
  criticalRoll?: number;
}

export interface VersusBossBasicProjectileLaunch {
  state: VersusBossAbilityRuntimeState;
  /** Primary shot retained for callers that only need its authored lane. */
  projectile: VersusBossAbilityProjectile;
  /** Primary plus any exact Echo/Turret covering-fire counterparts. */
  projectiles: readonly VersusBossAbilityProjectile[];
}

export interface VersusBossVerifiedDamageEffects {
  state: VersusBossAbilityRuntimeState;
  /** One-shot releases, such as Overload, triggered by verified HP damage. */
  projectiles: readonly VersusBossAbilityProjectile[];
}

/**
 * Advance NPC-owned status windows without dropping an armed one-shot Pierce.
 *
 * `advanceVersusStatusRuntime` intentionally clears charge fields because its
 * generic result is also used as an application patch.  Here the patch is the
 * boss's authoritative runtime state, so Pierce must survive frame advancement
 * until a shot consumes it (or its authored window expires).
 */
export function advanceVersusBossAbilityRuntime(
  current: VersusBossAbilityRuntimeState,
  elapsedSeconds: number,
): VersusBossAbilityRuntimeState {
  const state = cloneRuntimeState(current);
  const advanced = advanceVersusStatusRuntime(
    state.npcStatusRuntime,
    elapsedSeconds,
  );
  const pierceStillActive = Boolean(advanced.caster.windows.pierce);
  state.npcStatusRuntime = {
    ...advanced,
    caster: {
      ...advanced.caster,
      pierceCharges: pierceStillActive
        ? state.npcStatusRuntime.caster.pierceCharges
        : 0,
    },
  };
  state.npcIntegrityMultiplier =
    advanced.caster.windows.integrityMultiplier?.magnitude ?? 1;
  return state;
}

/** Player-side cadence granted by an NPC-authored tradeoff such as Overdrive. */
export function versusBossPlayerFireRecoveryMultiplier(
  current: VersusBossAbilityRuntimeState | null | undefined,
): number {
  return clamp(
    current?.npcStatusRuntime.opponent.windows.fireRateMultiplier?.magnitude ?? 1,
    0.25,
    4,
  );
}

/** Apply NPC-authored marks to a later verified projectile without exceeding VS caps. */
export function resolveVersusBossProjectileDamage(
  current: VersusBossAbilityRuntimeState | null | undefined,
  baseDamage: number,
): number {
  const boundedBase = clamp(
    baseDamage,
    0,
    COMPETITIVE_RULESET.maxProjectileDamage,
  );
  if (boundedBase <= 0) return 0;
  const vulnerability = Math.max(
    1,
    current?.npcStatusRuntime.opponent.windows.vulnerability?.magnitude ?? 1,
  );
  return Math.min(
    COMPETITIVE_RULESET.maxProjectileDamage,
    Math.max(1, Math.ceil(boundedBase * vulnerability)),
  );
}

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.max(minimum, Math.min(maximum, Number.isFinite(value) ? value : minimum));

const lane = (value: number) => Math.round(clamp(value, 0, 2));

/**
 * Select a real neighboring lane for Echo's duplicate shot.
 *
 * The board is a three-row line, not a ring: row 2 cannot wrap to row 0.
 * Favor the next row toward the bottom until the lower edge, then use row 1.
 */
const echoAdjacentLane = (value: number): number => {
  const source = lane(value);
  return source < 2 ? source + 1 : 1;
};

function cloneCombatant(
  combatant: VersusBossAbilityCombatantState,
): VersusBossAbilityCombatantState {
  return { ...combatant };
}

function cloneStatusRuntime(runtime: VersusStatusRuntimePatch): VersusStatusRuntimePatch {
  return {
    timers: { ...runtime.timers },
    caster: {
      windows: { ...runtime.caster.windows },
      barrierCharges: runtime.caster.barrierCharges,
      pierceCharges: runtime.caster.pierceCharges,
      refreshHand: runtime.caster.refreshHand,
    },
    opponent: {
      windows: { ...runtime.opponent.windows },
      traits: { ...runtime.opponent.traits },
    },
    appliedStatusIds: [...runtime.appliedStatusIds],
  };
}

function cloneRuntimeState(
  state: VersusBossAbilityRuntimeState,
): VersusBossAbilityRuntimeState {
  return {
    npc: cloneCombatant(state.npc),
    player: cloneCombatant(state.player),
    npcStatusRuntime: cloneStatusRuntime(state.npcStatusRuntime),
    npcHandRefreshRequested: state.npcHandRefreshRequested,
    npcIntegrityMultiplier: state.npcIntegrityMultiplier,
  };
}

function clampCombatant(combatant: VersusBossAbilityCombatantState): void {
  combatant.hp = clamp(combatant.hp, 0, combatant.maxHp);
  combatant.shields = clamp(combatant.shields, 0, combatant.maxShields);
  combatant.row = lane(combatant.row);
  combatant.column = lane(combatant.column);
}

function resolverContext(
  state: VersusBossAbilityRuntimeState,
  metadata: VersusBossAbilityMetadata,
): VersusAbilityContext {
  return {
    caster: {
      hp: state.npc.hp,
      maxHp: state.npc.maxHp,
      shields: state.npc.shields,
      maxShields: state.npc.maxShields,
      row: state.npc.row,
      column: 3 + state.npc.column,
    },
    opponent: {
      hp: state.player.hp,
      maxHp: state.player.maxHp,
      shields: state.player.shields,
      maxShields: state.player.maxShields,
      row: state.player.row,
      column: state.player.column,
    },
    ...(metadata.playerTraits === undefined
      ? {}
      : { opponentTraits: metadata.playerTraits }),
    ...(metadata.playerMovement === undefined
      ? {}
      : { opponentMovement: metadata.playerMovement }),
    ...(metadata.playerElement === undefined
      ? {}
      : { opponentElement: metadata.playerElement }),
    ...(metadata.playerEntityType === undefined
      ? {}
      : { opponentEntityType: metadata.playerEntityType }),
    ...(metadata.playerFusionLevel === undefined
      ? {}
      : { opponentFusionLevel: metadata.playerFusionLevel }),
    ...(metadata.playerMutationCount === undefined
      ? {}
      : { opponentMutationCount: metadata.playerMutationCount }),
    distance: metadata.distance
      ?? Math.abs(3 + state.npc.column - state.player.column),
  };
}

function rowsForProjectile(
  intent: VersusProjectileIntent,
  playerRow: number,
  npcRow: number,
): number[] {
  if (intent.pattern === 'all') return [0, 1, 2];
  if (intent.pattern === 'adjacent') {
    return [playerRow - 1, playerRow, playerRow + 1]
      .filter((row) => row >= 0 && row <= 2);
  }
  // Rearguard originates from the caster lane. Targeting the opponent lane
  // would make one or both trajectories appear detached from the NPC whenever
  // the combatants occupy different rows.
  if (intent.pattern === 'both-directions') return [lane(npcRow)];
  return [lane(playerRow)];
}

function directionsForProjectile(intent: VersusProjectileIntent): readonly (-1 | 1)[] {
  // The NPC owns the right half, so -1 is its forward/player-facing shot and
  // +1 is its rear-covering shot. Keep every other authored pattern directed
  // toward the player.
  return intent.pattern === 'both-directions' ? [-1, 1] : [-1];
}

function materializeProjectiles(
  abilityId: string,
  intents: readonly VersusProjectileIntent[],
  playerRow: number,
  npcRow: number,
): VersusBossAbilityProjectile[] {
  const projectiles: VersusBossAbilityProjectile[] = [];
  for (const intent of intents) {
    for (const direction of directionsForProjectile(intent)) {
      for (const row of rowsForProjectile(intent, playerRow, npcRow)) {
        for (let salvoIndex = 0; salvoIndex < intent.countPerLane; salvoIndex++) {
          projectiles.push({
            owner: 'npc',
            direction,
            row,
            power: intent.power,
            piercing: intent.piercing,
            big: intent.big,
            homing: intent.homing ?? false,
            salvoIndex,
            sourceAbilityId: abilityId,
          });
        }
      }
    }
  }
  return projectiles;
}

/**
 * Apply persistent caster windows to emitted NPC projectiles.
 *
 * This is deliberately shared by card projectiles and ordinary fire: setup
 * abilities must keep the same meaning regardless of which emission happens
 * next. Secondary Echo/Turret shots are materialized here rather than reduced
 * to a UI-only timer.
 */
export function applyVersusBossProjectileStatusWindows(
  current: VersusBossAbilityRuntimeState,
  primaryProjectiles: readonly VersusBossAbilityProjectile[],
  criticalRolls: readonly number[] = [],
): readonly VersusBossAbilityProjectile[] {
  if (primaryProjectiles.length === 0) return [];
  const windows = current.npcStatusRuntime.caster.windows;
  const damageMultiplier = Math.max(1, windows.damageMultiplier?.magnitude ?? 1);
  const criticalChance = Math.max(0, windows.criticalChance?.magnitude ?? 0);
  const voltageActive = Boolean(windows.voltage);
  const modified = primaryProjectiles.map((projectile, index) => {
    const roll = criticalRolls[index] ?? 1;
    const criticalMultiplier = criticalChance > 0 && roll < criticalChance ? 3 : 1;
    return {
      ...projectile,
      power: Math.max(1, Math.round(projectile.power * damageMultiplier * criticalMultiplier)),
      piercing: projectile.piercing || voltageActive,
      big: projectile.big || voltageActive,
    };
  });

  const result: VersusBossAbilityProjectile[] = [...modified];
  const echo = windows.echo;
  if (echo) {
    for (const projectile of modified) {
      result.push({
        ...projectile,
        row: echoAdjacentLane(projectile.row),
        power: Math.max(1, Math.floor(projectile.power * echo.magnitude)),
        piercing: false,
        big: false,
        sourceAbilityId: `${projectile.sourceAbilityId}:echo`,
      });
    }
  }

  const turret = windows.turret;
  if (turret) {
    const occupiedRows = new Set(modified.map((projectile) => projectile.row));
    const template = modified[0];
    for (let row = 0; row < 3; row++) {
      if (occupiedRows.has(row)) continue;
      result.push({
        ...template,
        row,
        power: Math.max(1, Math.floor(template.power * turret.magnitude)),
        salvoIndex: result.length,
        sourceAbilityId: `${template.sourceAbilityId}:turret`,
      });
    }
  }
  return result;
}

/**
 * Execute one exact playable ability with the NPC in the caster role.
 *
 * The canonical resolver remains the sole source of card semantics. This
 * adapter only assigns those semantics to the correct side and materializes
 * NPC-owned projectile descriptors; it never falls back to a generic attack.
 */
export function executeVersusBossAbility(
  abilityId: string,
  current: VersusBossAbilityRuntimeState,
  metadata: VersusBossAbilityMetadata = {},
): VersusBossAbilityExecution {
  const outcome = resolveVersusAbilityEffect(
    abilityId,
    resolverContext(current, metadata),
  );
  const state = cloneRuntimeState(current);

  state.npc.hp += outcome.casterHpDelta;
  state.npc.shields += outcome.casterShieldDelta;

  // Shield changes occur before direct impact, matching the playable-side
  // resolver application (for example, Shatter Shot removes a shield first).
  state.player.shields = clamp(
    state.player.shields + outcome.opponentShieldDelta,
    0,
    state.player.maxShields,
  );

  const vulnerability =
    state.npcStatusRuntime.opponent.windows.vulnerability?.magnitude ?? 1;
  const directDamage = Math.min(
    VERSUS_ABILITY_LIMITS.maxDirectDamage,
    Math.ceil(Math.max(0, -outcome.opponentHpDelta) * Math.max(1, vulnerability)),
  );
  if (directDamage > 0) {
    if (state.player.shields > 0) state.player.shields -= 1;
    else state.player.hp -= directDamage;
  } else if (outcome.opponentHpDelta > 0) {
    state.player.hp += outcome.opponentHpDelta;
  }

  state.player.fireCooldown = Math.max(
    state.player.fireCooldown,
    outcome.opponentFireDelay,
  );
  state.player.moveCooldown = Math.max(
    state.player.moveCooldown,
    outcome.opponentMoveDelay,
  );
  state.player.cardCooldown = Math.max(
    state.player.cardCooldown,
    outcome.opponentCardDelay,
  );

  // Resolver column deltas are authored from the left-side player's view.
  // Reverse them for a right-side NPC so "back" and "advance" stay relative
  // to the caster instead of changing meaning with ownership.
  state.npc.column -= outcome.casterColumnDelta;
  state.player.column -= outcome.opponentColumnDelta;
  if (outcome.casterRow !== undefined) state.npc.row = outcome.casterRow;
  if (outcome.opponentRow !== undefined) state.player.row = outcome.opponentRow;

  const mergedStatus = applyVersusStatusIntents(
    outcome.statuses,
    state.npcStatusRuntime,
  );
  state.npcStatusRuntime = {
    ...mergedStatus,
    caster: {
      ...mergedStatus.caster,
      // Shield deltas and hand refresh are applied directly above/below. Keep
      // Pierce because it is deliberately consumed by a later projectile.
      barrierCharges: 0,
      refreshHand: false,
    },
  };
  state.npcHandRefreshRequested =
    state.npcHandRefreshRequested || outcome.refreshHand;
  state.npcIntegrityMultiplier = Math.max(
    state.npcIntegrityMultiplier,
    outcome.integrityMultiplier,
  );

  clampCombatant(state.npc);
  clampCombatant(state.player);

  const primaryProjectiles = materializeProjectiles(
    outcome.abilityId,
    outcome.projectiles,
    state.player.row,
    state.npc.row,
  );
  return {
    state,
    outcome,
    projectiles: applyVersusBossProjectileStatusWindows(
      state,
      primaryProjectiles,
      metadata.criticalRolls,
    ),
  };
}

/**
 * Materialize the NPC's next ordinary shot, consuming one armed Pierce charge.
 * This makes setup cards practical without inventing an extra attack at cast.
 */
export function launchVersusBossBasicProjectile(
  current: VersusBossAbilityRuntimeState,
  options: VersusBossBasicProjectileOptions = {},
): VersusBossBasicProjectileLaunch {
  const state = cloneRuntimeState(current);
  const pierceCharges = state.npcStatusRuntime.caster.pierceCharges;
  const piercing = pierceCharges > 0;
  if (piercing) {
    state.npcStatusRuntime = {
      ...state.npcStatusRuntime,
      caster: {
        ...state.npcStatusRuntime.caster,
        pierceCharges: pierceCharges - 1,
      },
    };
  }

  const projectile: VersusBossAbilityProjectile = {
    owner: 'npc',
    direction: -1,
    row: lane(options.row ?? state.player.row),
    power: Math.round(clamp(
      options.power ?? 1,
      1,
      COMPETITIVE_RULESET.maxProjectileDamage,
    )),
    piercing,
    big: options.big ?? false,
    homing: options.homing ?? false,
    salvoIndex: 0,
    sourceAbilityId: 'basic',
  };
  const projectiles = applyVersusBossProjectileStatusWindows(
    state,
    [projectile],
    options.criticalRoll === undefined ? [] : [options.criticalRoll],
  );
  return {
    state,
    projectile: projectiles[0],
    projectiles,
  };
}

/**
 * Resolve Drain only after collision authority confirms outgoing HP damage.
 * A miss, shield-only impact, or zero-damage collision cannot award recovery.
 */
export function applyVersusBossVerifiedDamageRecovery(
  current: VersusBossAbilityRuntimeState,
  verifiedHpDamage: number,
): VersusBossAbilityRuntimeState {
  const state = cloneRuntimeState(current);
  const leech = state.npcStatusRuntime.caster.windows.leech;
  if (!leech || verifiedHpDamage <= 0) return state;

  const recovery = Math.min(
    VERSUS_ABILITY_LIMITS.maxRecovery,
    Math.max(0, verifiedHpDamage) * clamp(leech.magnitude, 0, 1),
  );
  state.npc.hp = clamp(state.npc.hp + recovery, 0, state.npc.maxHp);
  return state;
}

/**
 * Resolve NPC-caster effects whose trigger is a verified outgoing HP hit.
 * A miss or shield-only impact cannot heal through Drain or consume Overload.
 */
export function applyVersusBossVerifiedDamageEffects(
  current: VersusBossAbilityRuntimeState,
  verifiedHpDamage: number,
  row = current.player.row,
): VersusBossVerifiedDamageEffects {
  let state = applyVersusBossVerifiedDamageRecovery(current, verifiedHpDamage);
  if (verifiedHpDamage > 0 && state.npcIntegrityMultiplier > 1) {
    const tempoRecovery = Math.min(
      1,
      verifiedHpDamage
        * (state.npcIntegrityMultiplier - 1)
        * COMPETITIVE_RULESET.npcOverdriveCardRecoveryPerDamage,
    );
    state.npc.cardCooldown = Math.max(0, state.npc.cardCooldown - tempoRecovery);
  }
  if (verifiedHpDamage <= 0 || !state.npcStatusRuntime.caster.windows.overload) {
    return { state, projectiles: [] };
  }

  // Consume the armed window before materializing the return shot so the
  // generated projectile cannot recursively retrigger the same Overload.
  state = cloneRuntimeState(state);
  delete state.npcStatusRuntime.caster.windows.overload;
  delete state.npcStatusRuntime.timers.overloadTimer;
  const release = launchVersusBossBasicProjectile(state, {
    row,
    power: 1,
    big: false,
  });
  return { state: release.state, projectiles: release.projectiles };
}

export function createEmptyVersusBossAbilityRuntimeState(
  npc: VersusBossAbilityCombatantState,
  player: VersusBossAbilityCombatantState,
): VersusBossAbilityRuntimeState {
  return {
    npc: cloneCombatant(npc),
    player: cloneCombatant(player),
    npcStatusRuntime: createEmptyVersusStatusRuntimePatch(),
    npcHandRefreshRequested: false,
    npcIntegrityMultiplier: 1,
  };
}
