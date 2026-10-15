import { COMPETITIVE_RULESET } from './competitive-balance';

/**
 * Canonical authored ability IDs that can participate in a versus exchange.
 *
 * Keep this tuple in lockstep with ABILITY_POOL. The focused coverage test
 * deliberately fails when a card is added to the pool without an explicit
 * competitive interpretation here.
 */
export const VERSUS_ABILITY_IDS = [
  'shotgun', 'heal', 'time', 'pierce', 'bomb', 'shield', 'overclock', 'mirror',
  'scramble', 'nuke', 'barrage', 'warpback', 'purge', 'armor', 'surge',
  'backdash', 'megabomb', 'cardflood', 'freeze', 'blizzard', 'double',
  'multishot', 'regen', 'drain', 'voltage', 'emp', 'snipe', 'gravity', 'chain',
  'cluster', 'rowshuffle', 'ghost', 'turret', 'echo', 'overdrive', 'pulse',
  'overload', 'magnet', 'berserk', 'crit', 'flak', 'groundwire', 'signaljam',
  'undertow', 'separate', 'interceptor', 'stasisgate', 'adaptive', 'ricochet',
  'rearguard', 'arcweb', 'splitter', 'seeker', 'shattershot', 'marksman',
  'returnfire', 'oilslick', 'rootsnare', 'sonicnet', 'depthcharge', 'anchorfield',
  'tailclamp', 'tanglewire', 'trafficjam', 'thermalshock', 'circuitarc',
  'acidetch', 'bloombind', 'radiantmark', 'voidaperture', 'kineticram',
  'elementswap', 'devolve', 'mutationlock', 'traittheft', 'quarantine',
  'clonebreak', 'hybridtax', 'forcedmolt', 'catalyst',
] as const;

export type VersusAbilityId = (typeof VERSUS_ABILITY_IDS)[number];

const VERSUS_ABILITY_ID_SET = new Set<string>(VERSUS_ABILITY_IDS);

export function isVersusAbilityId(value: string): value is VersusAbilityId {
  return VERSUS_ABILITY_ID_SET.has(value);
}

export type VersusEffectTarget = 'caster' | 'opponent';
export type VersusAbilityTargeting =
  | 'self'
  | 'opponent'
  | 'target-lane'
  | 'adjacent-lanes'
  | 'all-lanes'
  | 'both-directions';

export type VersusProjectilePattern =
  | 'target'
  | 'adjacent'
  | 'all'
  | 'both-directions';

/**
 * Statuses are intents, not renderer instructions. A local simulation, replay
 * verifier, or future network authority can translate the same intent into its
 * own state representation without re-interpreting the ability name.
 */
export type VersusStatusId =
  | 'adaptive-damage'
  | 'affinity-exposed'
  | 'affinity-rotated'
  | 'airborne-grounded'
  | 'armor-broken'
  | 'barrier'
  | 'bind'
  | 'card-refresh'
  | 'catalyst-mark'
  | 'chain-mark'
  | 'clone-mark'
  | 'critical-chance'
  | 'devolved'
  | 'echo-shot'
  | 'emp-disabled'
  | 'fire-rate'
  | 'formation-broken'
  | 'fusion-separated'
  | 'ghost'
  | 'gravity-well'
  | 'heavy-anchored'
  | 'integrity-surge'
  | 'lane-scrambled'
  | 'leech'
  | 'mutation-locked'
  | 'oil-slick'
  | 'overload-shot'
  | 'pierce'
  | 'pulse-field'
  | 'quarantined'
  | 'regeneration'
  | 'revealed'
  | 'rooted'
  | 'signal-jammed'
  | 'staggered'
  | 'stasis-gate'
  | 'tail-clamped'
  | 'thermal-fracture'
  | 'time-slow'
  | 'trait-stolen'
  | 'turret-fire'
  | 'vulnerable'
  | 'weapon-voltage';

export interface VersusCombatantSnapshot {
  hp: number;
  maxHp: number;
  shields: number;
  maxShields: number;
  row: number;
  column: number;
}

export interface VersusAbilityContext {
  caster: VersusCombatantSnapshot;
  opponent: VersusCombatantSnapshot;
  /** Optional anatomy/evolution information used to strengthen counters. */
  opponentTraits?: readonly string[];
  opponentMovement?: string;
  opponentElement?: string;
  opponentEntityType?: string;
  opponentFusionLevel?: number;
  opponentMutationCount?: number;
  /** Distance in board cells. Defaults to the combatants' column distance. */
  distance?: number;
}

export interface VersusProjectileIntent {
  pattern: VersusProjectilePattern;
  countPerLane: number;
  power: number;
  piercing: boolean;
  big: boolean;
  homing?: boolean;
}

export interface VersusStatusIntent {
  id: VersusStatusId;
  target: VersusEffectTarget;
  duration: number;
  magnitude: number;
  stacks?: number;
}

export interface VersusAbilityOutcome {
  abilityId: VersusAbilityId;
  targeting: VersusAbilityTargeting;
  summary: string;
  /** Positive heals the caster; negative damages the caster. */
  casterHpDelta: number;
  /** Negative damages the opponent; positive heals the opponent. */
  opponentHpDelta: number;
  casterShieldDelta: number;
  opponentShieldDelta: number;
  opponentFireDelay: number;
  opponentMoveDelay: number;
  opponentCardDelay: number;
  casterColumnDelta: number;
  opponentColumnDelta: number;
  casterRow?: number;
  opponentRow?: number;
  projectiles: readonly VersusProjectileIntent[];
  statuses: readonly VersusStatusIntent[];
  integrityMultiplier: number;
  refreshHand: boolean;
}

export const VERSUS_ABILITY_LIMITS = Object.freeze({
  maxDirectDamage: COMPETITIVE_RULESET.maxAbilityDamage,
  maxRecovery: 3,
  maxShieldDelta: COMPETITIVE_RULESET.maxShields,
  maxFireDelay: COMPETITIVE_RULESET.maxFireDisruption,
  maxMoveDelay: COMPETITIVE_RULESET.maxMoveDisruption,
  maxCardDelay: 2,
  maxColumnDelta: 2,
  maxStatusDuration: 8,
  maxProjectilePower: COMPETITIVE_RULESET.maxProjectileDamage,
  maxProjectilesPerLane: 3,
  maxIntegrityMultiplier: 3,
});

type OutcomePatch = Partial<Omit<VersusAbilityOutcome, 'abilityId' | 'summary'>>;
type AbilityResolver = (context: VersusAbilityContext) => VersusAbilityOutcome;

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.max(minimum, Math.min(maximum, value));
const lane = (value: number) => clamp(Math.round(value), 0, 2);

function status(
  id: VersusStatusId,
  target: VersusEffectTarget,
  duration: number,
  magnitude = 1,
  stacks?: number,
): VersusStatusIntent {
  return {
    id,
    target,
    duration: clamp(duration, 0, VERSUS_ABILITY_LIMITS.maxStatusDuration),
    magnitude,
    ...(stacks === undefined ? {} : { stacks: Math.max(1, Math.round(stacks)) }),
  };
}

function projectile(
  pattern: VersusProjectilePattern,
  power: number,
  options: Partial<Omit<VersusProjectileIntent, 'pattern' | 'power'>> = {},
): VersusProjectileIntent {
  return {
    pattern,
    countPerLane: clamp(
      Math.round(options.countPerLane ?? 1),
      1,
      VERSUS_ABILITY_LIMITS.maxProjectilesPerLane,
    ),
    power: clamp(power, 1, VERSUS_ABILITY_LIMITS.maxProjectilePower),
    piercing: options.piercing ?? false,
    big: options.big ?? false,
    ...(options.homing === undefined ? {} : { homing: options.homing }),
  };
}

function outcome(
  abilityId: VersusAbilityId,
  summary: string,
  patch: OutcomePatch = {},
): VersusAbilityOutcome {
  return {
    abilityId,
    targeting: patch.targeting ?? 'opponent',
    summary,
    casterHpDelta: clamp(
      patch.casterHpDelta ?? 0,
      -VERSUS_ABILITY_LIMITS.maxDirectDamage,
      VERSUS_ABILITY_LIMITS.maxRecovery,
    ),
    opponentHpDelta: clamp(
      patch.opponentHpDelta ?? 0,
      -VERSUS_ABILITY_LIMITS.maxDirectDamage,
      VERSUS_ABILITY_LIMITS.maxRecovery,
    ),
    casterShieldDelta: clamp(
      patch.casterShieldDelta ?? 0,
      -VERSUS_ABILITY_LIMITS.maxShieldDelta,
      VERSUS_ABILITY_LIMITS.maxShieldDelta,
    ),
    opponentShieldDelta: clamp(
      patch.opponentShieldDelta ?? 0,
      -VERSUS_ABILITY_LIMITS.maxShieldDelta,
      VERSUS_ABILITY_LIMITS.maxShieldDelta,
    ),
    opponentFireDelay: clamp(
      patch.opponentFireDelay ?? 0,
      0,
      VERSUS_ABILITY_LIMITS.maxFireDelay,
    ),
    opponentMoveDelay: clamp(
      patch.opponentMoveDelay ?? 0,
      0,
      VERSUS_ABILITY_LIMITS.maxMoveDelay,
    ),
    opponentCardDelay: clamp(
      patch.opponentCardDelay ?? 0,
      0,
      VERSUS_ABILITY_LIMITS.maxCardDelay,
    ),
    casterColumnDelta: clamp(
      patch.casterColumnDelta ?? 0,
      -VERSUS_ABILITY_LIMITS.maxColumnDelta,
      VERSUS_ABILITY_LIMITS.maxColumnDelta,
    ),
    opponentColumnDelta: clamp(
      patch.opponentColumnDelta ?? 0,
      -VERSUS_ABILITY_LIMITS.maxColumnDelta,
      VERSUS_ABILITY_LIMITS.maxColumnDelta,
    ),
    ...(patch.casterRow === undefined ? {} : { casterRow: lane(patch.casterRow) }),
    ...(patch.opponentRow === undefined ? {} : { opponentRow: lane(patch.opponentRow) }),
    projectiles: patch.projectiles ?? [],
    statuses: patch.statuses ?? [],
    integrityMultiplier: clamp(
      patch.integrityMultiplier ?? 1,
      1,
      VERSUS_ABILITY_LIMITS.maxIntegrityMultiplier,
    ),
    refreshHand: patch.refreshHand ?? false,
  };
}

const fixed = (
  abilityId: VersusAbilityId,
  summary: string,
  patch: OutcomePatch,
): AbilityResolver => () => outcome(abilityId, summary, patch);

const recovery = (context: VersusAbilityContext, requested: number) =>
  Math.min(
    VERSUS_ABILITY_LIMITS.maxRecovery,
    Math.max(0, context.caster.maxHp - context.caster.hp),
    requested,
  );

const shieldRoom = (context: VersusAbilityContext, requested: number) =>
  Math.min(
    VERSUS_ABILITY_LIMITS.maxShieldDelta,
    Math.max(0, context.caster.maxShields - context.caster.shields),
    requested,
  );

const VERSUS_ABILITY_RESOLVERS = {
  shotgun: fixed('shotgun', 'Heavy spread covers the selected lane and its neighbors.', {
    targeting: 'adjacent-lanes',
    projectiles: [projectile('adjacent', 2, { big: true })],
  }),
  heal: (context) => outcome('heal', 'Restore a bounded portion of missing integrity.', {
    targeting: 'self', casterHpDelta: recovery(context, 2),
    statuses: [status('regeneration', 'caster', 0.2, 2)],
  }),
  time: fixed('time', 'Reduce the opponent action tempo without creating a permanent lock.', {
    opponentFireDelay: 0.7, opponentMoveDelay: 0.55, opponentCardDelay: 0.35,
    statuses: [status('time-slow', 'opponent', 6, 0.45)],
  }),
  pierce: fixed('pierce', 'Arm the next attack to pass through defended targets once.', {
    targeting: 'self', statuses: [status('pierce', 'caster', 8, 1, 1)],
  }),
  bomb: fixed('bomb', 'Detonate the opponent lane for bounded direct damage.', {
    targeting: 'target-lane', opponentHpDelta: -3,
  }),
  shield: (context) => outcome('shield', 'Raise one barrier without reducing existing shields.', {
    targeting: 'self', casterShieldDelta: shieldRoom(context, 1),
    statuses: [status('barrier', 'caster', 8, 1, 1)],
  }),
  overclock: fixed('overclock', 'Increase firing cadence for a controlled window.', {
    targeting: 'self', statuses: [status('fire-rate', 'caster', 6, 2)],
  }),
  mirror: fixed('mirror', 'Mirror one large projectile across all three lanes.', {
    targeting: 'all-lanes', projectiles: [projectile('all', 1, { big: true })],
  }),
  scramble: fixed('scramble', 'Break alignment, displace the opponent, and interrupt aim.', {
    opponentColumnDelta: 1, opponentFireDelay: 0.6, opponentMoveDelay: 0.35,
    statuses: [status('formation-broken', 'opponent', 3, 1)],
  }),
  nuke: fixed('nuke', 'Apply the competitive damage ceiling as an emergency strike.', {
    targeting: 'all-lanes', opponentHpDelta: -5,
  }),
  barrage: fixed('barrage', 'Stagger three heavy shots instead of stacking one invisible projectile.', {
    targeting: 'target-lane',
    projectiles: [projectile('target', 2, { countPerLane: 3, piercing: true, big: true })],
  }),
  warpback: fixed('warpback', 'Return the opponent to its rear column and delay movement.', {
    opponentColumnDelta: 2, opponentMoveDelay: 0.6,
  }),
  purge: (context) => {
    const vulnerable = context.opponent.hp <= context.opponent.maxHp * 0.35
      || (context.opponentFusionLevel ?? 0) > 0
      || (context.opponentMutationCount ?? 0) >= 3;
    return outcome('purge', 'Punish a weakened or highly evolved opponent.', {
      opponentHpDelta: vulnerable ? -4 : -2,
      statuses: [status('vulnerable', 'opponent', 2, vulnerable ? 1.5 : 1)],
    });
  },
  armor: (context) => outcome('armor', 'Layer two bounded barriers around the caster.', {
    targeting: 'self', casterShieldDelta: shieldRoom(context, 2),
    statuses: [status('barrier', 'caster', 8, 1, 2)],
  }),
  surge: fixed('surge', 'Release a power-two piercing line through every lane.', {
    targeting: 'all-lanes', projectiles: [projectile('all', 2, { piercing: true })],
  }),
  backdash: fixed('backdash', 'Create space and briefly break the opponent movement rhythm.', {
    targeting: 'self', casterColumnDelta: -2, opponentMoveDelay: 0.25,
  }),
  megabomb: fixed('megabomb', 'Trade the longest cooldown for capped damage and a brief disruption.', {
    targeting: 'all-lanes', opponentHpDelta: -5, opponentFireDelay: 0.35,
    statuses: [status('integrity-surge', 'caster', 3, 2)], integrityMultiplier: 2,
  }),
  cardflood: fixed('cardflood', 'Discard the exhausted hand and request three new choices.', {
    targeting: 'self', statuses: [status('card-refresh', 'caster', 0.2, 1)], refreshHand: true,
  }),
  freeze: fixed('freeze', 'Arrest fire and movement for a short, bounded window.', {
    opponentFireDelay: 0.9, opponentMoveDelay: 0.7, opponentCardDelay: 0.25,
    statuses: [status('time-slow', 'opponent', 4, 0.08)],
  }),
  blizzard: fixed('blizzard', 'Sustain movement suppression while leaving a response window.', {
    opponentFireDelay: 0.5, opponentMoveDelay: 0.7,
    statuses: [status('time-slow', 'opponent', 7, 0.2)],
  }),
  double: fixed('double', 'Double projectile damage for a short firing window.', {
    targeting: 'self', statuses: [status('adaptive-damage', 'caster', 6, 2)],
  }),
  multishot: fixed('multishot', 'Add one full-strength adjacent-lane shot per trigger.', {
    targeting: 'self', statuses: [status('echo-shot', 'caster', 5, 1, 1)],
  }),
  regen: (context) => outcome('regen', 'Recover gradually, capped by missing integrity.', {
    targeting: 'self', casterHpDelta: recovery(context, 1),
    statuses: [status('regeneration', 'caster', 8, 1, 3)],
  }),
  drain: fixed('drain', 'Convert verified outgoing damage into bounded recovery.', {
    targeting: 'self', statuses: [status('leech', 'caster', 8, 1)],
  }),
  voltage: fixed('voltage', 'Charge projectiles with a broad piercing profile.', {
    targeting: 'self', statuses: [status('weapon-voltage', 'caster', 5, 2)],
  }),
  emp: fixed('emp', 'Deal damage and disable the opponent active trait channel.', {
    opponentHpDelta: -3, opponentFireDelay: 0.45, opponentCardDelay: 0.5,
    statuses: [status('emp-disabled', 'opponent', 4, 1)],
  }),
  snipe: fixed('snipe', 'Launch one fast capped precision projectile.', {
    targeting: 'target-lane',
    projectiles: [projectile('target', 4, { piercing: true, big: true })],
  }),
  gravity: (context) => outcome('gravity', 'Pull the opponent into the caster lane and impede movement.', {
    targeting: 'target-lane', opponentRow: context.caster.row, opponentMoveDelay: 0.6,
    statuses: [status('gravity-well', 'opponent', 4, 1)],
  }),
  chain: fixed('chain', 'Mark the struck opponent so a follow-up can propagate.', {
    opponentHpDelta: -3, statuses: [status('chain-mark', 'opponent', 4, 1)],
  }),
  cluster: fixed('cluster', 'Distribute three bounded impacts across the grid.', {
    targeting: 'all-lanes', projectiles: [projectile('all', 2, { countPerLane: 1, big: true })],
  }),
  rowshuffle: (context) => outcome('rowshuffle', 'Reindex the opponent lane deterministically.', {
    opponentRow: (lane(context.opponent.row) + 1) % 3, opponentMoveDelay: 0.45,
    statuses: [status('lane-scrambled', 'opponent', 2, 1)],
  }),
  ghost: fixed('ghost', 'Phase through incoming collision damage for a short window.', {
    targeting: 'self', statuses: [status('ghost', 'caster', 4, 1)],
  }),
  turret: fixed('turret', 'Schedule independent covering fire rather than requiring a manual trigger.', {
    targeting: 'self', statuses: [status('turret-fire', 'caster', 5, 1)],
  }),
  echo: fixed('echo', 'Replay each primary shot as a reduced adjacent-lane echo.', {
    targeting: 'self', statuses: [status('echo-shot', 'caster', 5, 0.65, 1)],
  }),
  overdrive: fixed('overdrive', 'Accept increased incoming tempo for triple verified integrity gain.', {
    targeting: 'self', statuses: [
      status('fire-rate', 'opponent', 4, 2.5),
      status('integrity-surge', 'caster', 4, 3),
    ], integrityMultiplier: 3,
  }),
  pulse: fixed('pulse', 'Emit repeated lane pressure that disrupts both movement and fire.', {
    targeting: 'adjacent-lanes', opponentFireDelay: 0.4, opponentMoveDelay: 0.35,
    statuses: [status('pulse-field', 'opponent', 7, 0.65)],
  }),
  overload: fixed('overload', 'Queue one bounded return shot after the next verified hit or defeat.', {
    targeting: 'self', statuses: [status('overload-shot', 'caster', 6, 1)],
  }),
  magnet: fixed('magnet', 'Repel the opponent and disturb its movement timing.', {
    opponentColumnDelta: 1, opponentMoveDelay: 0.58,
    statuses: [status('gravity-well', 'opponent', 6, -1)],
  }),
  berserk: fixed('berserk', 'Trade duration for the strongest bounded fire-rate increase.', {
    targeting: 'self', statuses: [status('fire-rate', 'caster', 4, 4)],
  }),
  crit: fixed('crit', 'Enable a deterministic-authority critical chance window.', {
    targeting: 'self', statuses: [status('critical-chance', 'caster', 5, 0.4)],
  }),
  flak: fixed('flak', 'Ground the opponent and follow with a light impact.', {
    opponentHpDelta: -2, opponentMoveDelay: 0.4,
    statuses: [status('airborne-grounded', 'opponent', 5, 1)],
  }),
  groundwire: fixed('groundwire', 'Shock the occupied lane and impose a real stagger.', {
    targeting: 'target-lane', opponentHpDelta: -2, opponentMoveDelay: 0.65,
    statuses: [status('staggered', 'opponent', 2, 1)],
  }),
  signaljam: fixed('signaljam', 'Suppress trait, fire, and card tempo together.', {
    opponentFireDelay: 0.68, opponentMoveDelay: 0.3, opponentCardDelay: 1,
    statuses: [status('signal-jammed', 'opponent', 6, 1)],
  }),
  undertow: (context) => outcome('undertow', 'Pull the opponent into the caster lane, then drive it back.', {
    targeting: 'target-lane', opponentRow: context.caster.row, opponentColumnDelta: 1,
    opponentMoveDelay: 0.65, statuses: [status('gravity-well', 'opponent', 3, 1)],
  }),
  separate: fixed('separate', 'Strip one fusion layer and open a bounded punish window.', {
    opponentHpDelta: -2, opponentCardDelay: 0.45,
    statuses: [status('fusion-separated', 'opponent', 6, 1)],
  }),
  interceptor: fixed('interceptor', 'Acquire the leading threat with one capped power shot.', {
    projectiles: [projectile('target', 4, { big: true, homing: true })],
  }),
  stasisgate: fixed('stasisgate', 'Arm a crossing threshold that punishes the next advance.', {
    targeting: 'target-lane', opponentMoveDelay: 0.55,
    statuses: [status('stasis-gate', 'opponent', 7, 3, 1)],
  }),
  adaptive: fixed('adaptive', 'Adapt outgoing damage to the opponent current defense.', {
    targeting: 'self', statuses: [status('adaptive-damage', 'caster', 7, 1.5)],
  }),
  ricochet: fixed('ricochet', 'Send one shot wide before it returns to the selected lane.', {
    targeting: 'adjacent-lanes',
    projectiles: [projectile('adjacent', 2, { piercing: true, homing: true })],
  }),
  rearguard: fixed('rearguard', 'Cover both directions with independently useful trajectories.', {
    targeting: 'both-directions',
    projectiles: [projectile('both-directions', 3, { piercing: true })],
  }),
  arcweb: fixed('arcweb', 'Conduct a capped hit and leave a chain-ready mark.', {
    targeting: 'all-lanes', opponentHpDelta: -3, opponentFireDelay: 0.2,
    statuses: [status('chain-mark', 'opponent', 5, 1)],
  }),
  splitter: fixed('splitter', 'Launch two visibly staggered piercing shots on every lane.', {
    targeting: 'all-lanes',
    projectiles: [projectile('all', 2, { countPerLane: 2, piercing: true })],
  }),
  seeker: fixed('seeker', 'Home on the opponent regardless of current lane.', {
    projectiles: [projectile('target', 4, { big: true, homing: true })],
  }),
  shattershot: fixed('shattershot', 'Break a barrier before delivering concentrated damage.', {
    opponentHpDelta: -3, opponentShieldDelta: -1,
    statuses: [status('armor-broken', 'opponent', 5, 1)],
  }),
  marksman: (context) => {
    const distance = Math.abs(context.distance
      ?? (context.opponent.column - context.caster.column));
    const power = clamp(Math.ceil(distance), 2, 4);
    return outcome('marksman', 'Convert measured distance into precision power.', {
      projectiles: [projectile('target', power, { big: true })],
    });
  },
  returnfire: fixed('returnfire', 'Answer an opponent commitment with synchronized return fire.', {
    targeting: 'all-lanes', opponentHpDelta: -3,
  }),
  oilslick: fixed('oilslick', 'Force a backward skid and interrupt movement.', {
    opponentColumnDelta: 2, opponentMoveDelay: 0.5,
    statuses: [status('oil-slick', 'opponent', 5, 1)],
  }),
  rootsnare: fixed('rootsnare', 'Apply a genuine movement snare instead of only knockback.', {
    opponentHpDelta: -1, opponentMoveDelay: 0.7,
    statuses: [status('rooted', 'opponent', 4, 1)],
  }),
  sonicnet: fixed('sonicnet', 'Ground and disrupt the opponent with a sonic restraint.', {
    opponentHpDelta: -2, opponentMoveDelay: 0.55,
    statuses: [status('airborne-grounded', 'opponent', 5, 1)],
  }),
  depthcharge: fixed('depthcharge', 'Expose a hidden route and deliver a high-impact counter.', {
    opponentHpDelta: -4, statuses: [status('revealed', 'opponent', 5, 1)],
  }),
  anchorfield: fixed('anchorfield', 'Anchor heavy movement while preserving a response window.', {
    opponentHpDelta: -2, opponentMoveDelay: 0.7,
    statuses: [status('heavy-anchored', 'opponent', 5, 1)],
  }),
  tailclamp: fixed('tailclamp', 'Clamp locomotion and create a follow-up opening.', {
    opponentHpDelta: -2, opponentMoveDelay: 0.7,
    statuses: [status('tail-clamped', 'opponent', 5, 1)],
  }),
  tanglewire: fixed('tanglewire', 'Damage and bind the opponent lane.', {
    opponentHpDelta: -3, opponentMoveDelay: 0.6,
    statuses: [status('bind', 'opponent', 4, 1)],
  }),
  trafficjam: fixed('trafficjam', 'Congest movement and firing rhythm at once.', {
    opponentHpDelta: -2, opponentFireDelay: 0.35, opponentMoveDelay: 0.7,
    statuses: [status('staggered', 'opponent', 3, 1)],
  }),
  thermalshock: fixed('thermalshock', 'Fracture affinity before the next elemental exchange.', {
    opponentHpDelta: -3, opponentFireDelay: 0.3,
    statuses: [status('thermal-fracture', 'opponent', 5, 1.5)],
  }),
  circuitarc: fixed('circuitarc', 'Bridge a charged impact into adjacent firing pressure.', {
    targeting: 'adjacent-lanes', opponentHpDelta: -3, opponentFireDelay: 0.2,
    statuses: [status('emp-disabled', 'opponent', 2, 0.5)],
  }),
  acidetch: fixed('acidetch', 'Remove one barrier and expose armor to follow-up damage.', {
    opponentHpDelta: -2, opponentShieldDelta: -1,
    statuses: [status('armor-broken', 'opponent', 6, 1)],
  }),
  bloombind: fixed('bloombind', 'Bind the opponent and mark subsequent damage for sharing.', {
    opponentHpDelta: -2, opponentMoveDelay: 0.65,
    statuses: [status('bind', 'opponent', 6, 1.25)],
  }),
  radiantmark: fixed('radiantmark', 'Reveal phase defenses and mark them as vulnerable.', {
    opponentHpDelta: -3,
    statuses: [status('revealed', 'opponent', 6, 1), status('vulnerable', 'opponent', 4, 1.25)],
  }),
  voidaperture: fixed('voidaperture', 'Return the opponent to range in a weakened state.', {
    opponentHpDelta: -3, opponentColumnDelta: 2, opponentMoveDelay: 0.55,
    statuses: [status('revealed', 'opponent', 3, 1)],
  }),
  kineticram: fixed('kineticram', 'Drive through one lane with damage and real displacement.', {
    targeting: 'target-lane', opponentHpDelta: -2, opponentColumnDelta: 2,
    opponentMoveDelay: 0.5, statuses: [status('staggered', 'opponent', 2, 1)],
  }),
  elementswap: fixed('elementswap', 'Rotate affinity and guarantee a brief exploitable weakness.', {
    opponentCardDelay: 0.6,
    statuses: [
      status('affinity-rotated', 'opponent', 8, 1),
      status('affinity-exposed', 'opponent', 5, 1.25),
    ],
  }),
  devolve: fixed('devolve', 'Regress one evolution layer and weaken the resulting form.', {
    opponentHpDelta: -2, opponentFireDelay: 0.25,
    statuses: [status('devolved', 'opponent', 8, 1)],
  }),
  mutationlock: fixed('mutationlock', 'Suppress mutation, regeneration, and phase behavior universally.', {
    opponentFireDelay: 0.55, opponentCardDelay: 0.8,
    statuses: [status('mutation-locked', 'opponent', 8, 1)],
  }),
  traittheft: (context) => outcome('traittheft', 'Remove one trait and convert it into bounded recovery.', {
    opponentHpDelta: -2, casterHpDelta: recovery(context, 2),
    statuses: [status('trait-stolen', 'opponent', 7, 1)],
  }),
  quarantine: fixed('quarantine', 'Isolate the opponent from fusion and lane transitions.', {
    opponentMoveDelay: 0.7, opponentCardDelay: 0.5,
    statuses: [status('quarantined', 'opponent', 6, 1)],
  }),
  clonebreak: fixed('clonebreak', 'Damage the current form and mark related instances.', {
    opponentHpDelta: -3, statuses: [status('clone-mark', 'opponent', 6, 1)],
  }),
  hybridtax: (context) => {
    const fusion = Math.max(1, context.opponentFusionLevel ?? 0);
    return outcome('hybridtax', 'Scale a bounded penalty with fusion complexity.', {
      opponentHpDelta: -clamp(fusion * 2, 2, 5), opponentMoveDelay: 0.35,
      statuses: [status('fusion-separated', 'opponent', 4, fusion)],
    });
  },
  forcedmolt: fixed('forcedmolt', 'Strip armor while granting the opponent a risky speed tradeoff.', {
    opponentHpDelta: -2, opponentMoveDelay: 0.15,
    statuses: [
      status('armor-broken', 'opponent', 8, 1),
      status('fire-rate', 'opponent', 4, 1.18),
    ],
  }),
  catalyst: fixed('catalyst', 'Empower the opponent briefly, then mark it for a high-value punish.', {
    opponentShieldDelta: 1,
    statuses: [
      status('catalyst-mark', 'opponent', 8, 3),
      status('vulnerable', 'opponent', 5, 1.5),
    ], integrityMultiplier: 3,
  }),
} satisfies Record<VersusAbilityId, AbilityResolver>;

/**
 * Resolve an authored ability into a mode-safe, bounded competitive intent.
 * Unknown IDs fail loudly so a new card can never degrade into a generic shot
 * or an invisible no-op.
 */
export function resolveVersusAbilityEffect(
  abilityId: string,
  context: VersusAbilityContext,
): VersusAbilityOutcome {
  if (!isVersusAbilityId(abilityId)) {
    throw new Error(`No versus resolver registered for ability: ${abilityId}`);
  }
  return VERSUS_ABILITY_RESOLVERS[abilityId](context);
}

export function hasMeaningfulVersusEffect(outcome: VersusAbilityOutcome): boolean {
  return outcome.casterHpDelta !== 0
    || outcome.opponentHpDelta !== 0
    || outcome.casterShieldDelta !== 0
    || outcome.opponentShieldDelta !== 0
    || outcome.opponentFireDelay !== 0
    || outcome.opponentMoveDelay !== 0
    || outcome.opponentCardDelay !== 0
    || outcome.casterColumnDelta !== 0
    || outcome.opponentColumnDelta !== 0
    || outcome.casterRow !== undefined
    || outcome.opponentRow !== undefined
    || outcome.projectiles.length > 0
    || outcome.statuses.length > 0
    || outcome.integrityMultiplier !== 1
    || outcome.refreshHand;
}
