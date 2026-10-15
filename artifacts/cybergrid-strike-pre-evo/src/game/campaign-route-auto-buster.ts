export type CampaignRouteAutoBusterPhase =
  | 'inactive'
  | 'acquiring'
  | 'aiming'
  | 'secured'
  | 'choosing';

export type CampaignRouteAimDirection = 'last' | 'next';

export interface CampaignRouteAimTarget {
  visualSeed: number;
  row: number;
}

export interface CampaignRouteAimPair {
  last: CampaignRouteAimTarget;
  next: CampaignRouteAimTarget;
}

export interface CampaignRouteAutoBusterState {
  pairKey: string | null;
  graceRemaining: number;
  aimSettleRemaining: number;
  observedPlayerRow: number;
  committedDirection: CampaignRouteAimDirection | null;
  committedSeed: number | null;
  committedRow: number | null;
}

export interface CampaignRouteAutoBusterInput {
  phase: CampaignRouteAutoBusterPhase;
  pair: CampaignRouteAimPair | null;
  dt: number;
  playerRow: number;
  cooldownAfterTick: number;
  requestedInterval: number;
  activeProjectileCount: number;
}

export interface CampaignRouteAutoBusterEmission {
  row: number;
  routeDirection: CampaignRouteAimDirection | null;
  suppressSecondary: true;
}

export interface CampaignRouteAutoBusterDecision {
  state: CampaignRouteAutoBusterState;
  governed: boolean;
  holdAuto: boolean;
  nextCooldown: number;
  emission: CampaignRouteAutoBusterEmission | null;
  targetsMayPublish: boolean;
  reason:
    | 'normal'
    | 'acquiring'
    | 'pair-grace'
    | 'navigating'
    | 'no-target-lane'
    | 'committed-off-lane'
    | 'projectile-budget'
    | 'cooldown'
    | 'fire'
    | 'secured'
    | 'choosing';
}

/** Human-readable aim time, not a balance cooldown. */
export const CAMPAIGN_ROUTE_AUTO_BUSTER_GRACE_SECONDS = 0.9;
/** Longer than one controller repeat, so crossing a lane cannot auto-select it. */
export const CAMPAIGN_ROUTE_AUTO_BUSTER_AIM_SETTLE_SECONDS = 0.3;
export const CAMPAIGN_ROUTE_AUTO_BUSTER_MIN_INTERVAL_SECONDS = 0.58;
export const CAMPAIGN_ROUTE_AUTO_BUSTER_MAX_PROJECTILES = 1;
/**
 * A route is a deliberate combat objective, not a one-shot health check.
 * Requiring three committed contacts preserves multiple aim/response beats
 * while keeping ordinary enemy HP and weapon balance unchanged.
 */
export const CAMPAIGN_ROUTE_QUOTA_REQUIRED_CONFIRMED_HITS = 3;

export function createCampaignRouteAutoBusterState(
  playerRow = 1,
): CampaignRouteAutoBusterState {
  return {
    pairKey: null,
    graceRemaining: 0,
    aimSettleRemaining: 0,
    observedPlayerRow: playerRow,
    committedDirection: null,
    committedSeed: null,
    committedRow: null,
  };
}

/**
 * Put both objectives in distinct lanes while keeping the player's current
 * lane neutral. This makes the first Auto decision require navigation.
 */
export function resolveCampaignRouteTargetRows(
  playerRow: number,
): Record<CampaignRouteAimDirection, number> {
  const safePlayerRow = Math.max(0, Math.min(2, Math.round(playerRow)));
  const availableRows = [0, 1, 2].filter((row) => row !== safePlayerRow);
  return { last: availableRows[0], next: availableRows[1] };
}

export function getCampaignRouteAimPairKey(pair: CampaignRouteAimPair): string {
  return `${pair.last.visualSeed}:${pair.last.row}|${pair.next.visualSeed}:${pair.next.row}`;
}

export function getCampaignRouteAimDirectionAtRow(
  pair: CampaignRouteAimPair,
  row: number,
): CampaignRouteAimDirection | null {
  const matches = (['last', 'next'] as const).filter((direction) =>
    pair[direction].row === row);
  return matches.length === 1 ? matches[0] : null;
}

function heldDecision(
  state: CampaignRouteAutoBusterState,
  input: CampaignRouteAutoBusterInput,
  reason: CampaignRouteAutoBusterDecision['reason'],
  targetsMayPublish = false,
): CampaignRouteAutoBusterDecision {
  return {
    state,
    governed: true,
    holdAuto: true,
    nextCooldown: Math.max(0, input.cooldownAfterTick),
    emission: null,
    targetsMayPublish,
    reason,
  };
}

/**
 * Route Auto is a navigation assistant, never a target-selection engine. It
 * waits for the player to settle in one objective lane, commits that identity,
 * and permits one non-fanning carrier at a time.
 */
export function resolveCampaignRouteAutoBuster(
  current: CampaignRouteAutoBusterState,
  input: CampaignRouteAutoBusterInput,
): CampaignRouteAutoBusterDecision {
  if (input.phase === 'inactive') {
    return {
      state: createCampaignRouteAutoBusterState(input.playerRow),
      governed: false,
      holdAuto: false,
      nextCooldown: input.cooldownAfterTick,
      emission: null,
      targetsMayPublish: true,
      reason: 'normal',
    };
  }

  if (input.phase === 'choosing') {
    return heldDecision(current, input, 'choosing');
  }

  if (input.phase === 'acquiring' || !input.pair) {
    return heldDecision(
      createCampaignRouteAutoBusterState(input.playerRow),
      input,
      'acquiring',
      input.activeProjectileCount === 0,
    );
  }

  const pairKey = getCampaignRouteAimPairKey(input.pair);
  let state = current;
  if (state.pairKey !== pairKey) {
    state = {
      ...createCampaignRouteAutoBusterState(input.playerRow),
      pairKey,
      graceRemaining: CAMPAIGN_ROUTE_AUTO_BUSTER_GRACE_SECONDS,
      aimSettleRemaining: CAMPAIGN_ROUTE_AUTO_BUSTER_AIM_SETTLE_SECONDS,
    };
  } else {
    const rowChanged = state.observedPlayerRow !== input.playerRow;
    state = {
      ...state,
      observedPlayerRow: input.playerRow,
      graceRemaining: Math.max(0, state.graceRemaining - input.dt),
      aimSettleRemaining: rowChanged
        ? CAMPAIGN_ROUTE_AUTO_BUSTER_AIM_SETTLE_SECONDS
        : Math.max(0, state.aimSettleRemaining - input.dt),
    };
  }

  if (input.phase === 'secured') {
    if (input.activeProjectileCount >= CAMPAIGN_ROUTE_AUTO_BUSTER_MAX_PROJECTILES) {
      return heldDecision(state, input, 'projectile-budget');
    }
    if (input.cooldownAfterTick > 0) return heldDecision(state, input, 'cooldown');
    return {
      state,
      governed: true,
      holdAuto: false,
      nextCooldown: Math.max(
        input.requestedInterval,
        CAMPAIGN_ROUTE_AUTO_BUSTER_MIN_INTERVAL_SECONDS,
      ),
      emission: {
        row: input.playerRow,
        routeDirection: null,
        suppressSecondary: true,
      },
      targetsMayPublish: false,
      reason: 'secured',
    };
  }

  if (state.graceRemaining > 0) return heldDecision(state, input, 'pair-grace');
  if (state.aimSettleRemaining > 0) return heldDecision(state, input, 'navigating');

  if (!state.committedDirection) {
    const direction = getCampaignRouteAimDirectionAtRow(input.pair, input.playerRow);
    if (!direction) return heldDecision(state, input, 'no-target-lane');
    state = {
      ...state,
      committedDirection: direction,
      committedSeed: input.pair[direction].visualSeed,
      committedRow: input.pair[direction].row,
    };
  }

  if (state.committedRow !== input.playerRow) {
    return heldDecision(state, input, 'committed-off-lane');
  }
  if (input.activeProjectileCount >= CAMPAIGN_ROUTE_AUTO_BUSTER_MAX_PROJECTILES) {
    return heldDecision(state, input, 'projectile-budget');
  }
  if (input.cooldownAfterTick > 0) return heldDecision(state, input, 'cooldown');

  return {
    state,
    governed: true,
    holdAuto: false,
    nextCooldown: Math.max(
      input.requestedInterval,
      CAMPAIGN_ROUTE_AUTO_BUSTER_MIN_INTERVAL_SECONDS,
    ),
    emission: {
      row: state.committedRow,
      routeDirection: state.committedDirection,
      suppressSecondary: true,
    },
    targetsMayPublish: false,
    reason: 'fire',
  };
}

/** Collateral can soften an objective, but only its committed carrier claims it. */
export function resolveCampaignRouteProjectileHp(
  currentHp: number,
  damage: number,
  targetDirection: CampaignRouteAimDirection | null,
  projectileDirection: CampaignRouteAimDirection | null,
): number {
  const nextHp = currentHp - damage;
  if (targetDirection && projectileDirection !== targetDirection) {
    return Math.max(1, nextHp);
  }
  return nextHp;
}

export interface CampaignRouteQuotaImpact {
  hp: number;
  confirmedHits: number;
  confirmedHit: boolean;
  defeated: boolean;
  quotaMet: boolean;
}

/**
 * Resolve damage and quota progress for one projectile contact with a route
 * objective. Only a carrier committed to that exact direction advances its
 * quota. Early committed hits may soften an objective to one HP, but cannot
 * defeat it; the final required hit must finish the advertised target.
 *
 * This deliberately keeps `defeated` separate from `quotaMet`: reaching the
 * contact floor is necessary, but the route is not secured until the target
 * is actually defeated.
 */
export function resolveCampaignRouteQuotaImpact(
  currentHp: number,
  damage: number,
  targetDirection: CampaignRouteAimDirection | null,
  projectileDirection: CampaignRouteAimDirection | null,
  previousConfirmedHits: number,
): CampaignRouteQuotaImpact {
  const safeDamage = Number.isFinite(damage) ? Math.max(0, damage) : 0;
  const safePreviousHits = Math.max(0, Math.floor(previousConfirmedHits));
  const confirmedHit = Boolean(
    safeDamage > 0
    && targetDirection
    && projectileDirection === targetDirection,
  );

  if (!targetDirection) {
    const hp = currentHp - safeDamage;
    return {
      hp,
      confirmedHits: safePreviousHits,
      confirmedHit: false,
      defeated: hp <= 0,
      quotaMet: false,
    };
  }

  if (!confirmedHit) {
    const hp = resolveCampaignRouteProjectileHp(
      currentHp,
      safeDamage,
      targetDirection,
      projectileDirection,
    );
    return {
      hp,
      confirmedHits: safePreviousHits,
      confirmedHit: false,
      defeated: false,
      quotaMet: false,
    };
  }

  const confirmedHits = safePreviousHits + 1;
  const rawHp = currentHp - safeDamage;
  const hp = confirmedHits < CAMPAIGN_ROUTE_QUOTA_REQUIRED_CONFIRMED_HITS
    ? Math.max(1, rawHp)
    : rawHp;
  const defeated = hp <= 0;
  return {
    hp,
    confirmedHits,
    confirmedHit: true,
    defeated,
    quotaMet: defeated
      && confirmedHits >= CAMPAIGN_ROUTE_QUOTA_REQUIRED_CONFIRMED_HITS,
  };
}

export interface CampaignProjectileHitRegistration {
  alreadyHit: boolean;
  hitEnemySeeds: number[];
}

/**
 * A piercing carrier may cross several enemies, but it may resolve against a
 * particular enemy only once. Without this registry, overlap lasting several
 * animation frames multiplies Surge damage and floods hit feedback.
 */
export function registerCampaignProjectileEnemyHit(
  hitEnemySeeds: readonly number[] | undefined,
  enemySeed: number,
): CampaignProjectileHitRegistration {
  if (hitEnemySeeds?.includes(enemySeed)) {
    return { alreadyHit: true, hitEnemySeeds: [...hitEnemySeeds] };
  }
  return {
    alreadyHit: false,
    hitEnemySeeds: [...(hitEnemySeeds ?? []), enemySeed],
  };
}
