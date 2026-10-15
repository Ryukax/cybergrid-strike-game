import type { Ability } from './types';
import { COMPETITIVE_RULESET } from './competitive-balance';
import {
  readGeneratedVersusAbilityCard,
  type GeneratedAbilityFunction,
} from './generated-versus-ability';
import {
  isVersusAbilityId,
  resolveVersusAbilityEffect,
  type VersusAbilityContext,
  type VersusAbilityId,
  type VersusAbilityOutcome,
  type VersusProjectileIntent,
  type VersusStatusIntent,
} from './versus-ability-resolver';

export type AbilityCardGameplayContext = 'regular-enemies' | 'versus-boss-npc';

export interface AbilityCardContextCopy {
  readonly label: 'REGULAR ENEMIES' | 'VERSUS BOSS NPC';
  readonly description: string;
}

export interface AbilityCardContextRequest {
  readonly ability: Pick<Ability, 'id' | 'desc'>;
  readonly gameplay: AbilityCardGameplayContext;
  readonly versusContext?: VersusAbilityContext;
  readonly generatedAbility?: unknown;
  readonly rank?: number;
}

export type GeneratedPlayerVersusEffect =
  | {
    readonly function: 'rupture';
    readonly damage: number;
  }
  | {
    readonly function: 'inhibit' | 'reveal';
    readonly minimumFireDelay: 0.7;
    readonly minimumMoveDelay: 0.55;
  }
  | {
    readonly function: 'impulse';
    readonly opponentColumnDelta: 1;
    readonly minimumMoveDelay: 0.45;
  }
  | {
    readonly function: 'adapt';
    readonly opponentRowDelta: 1;
    readonly minimumMoveDelay: 0.4;
  }
  | {
    readonly function: 'ward';
    /** Applied by the native generated-card branch before the Versus adapter. */
    readonly nativeShieldGain: number;
    readonly versusAdapterPresentationOnly: true;
  }
  | {
    readonly function: 'restore';
    /** Applied by the native generated-card branch before the Versus adapter. */
    readonly nativeHpRecovery: number;
    readonly versusAdapterPresentationOnly: true;
  };

const clampRank = (rank: number) => Math.max(1, Math.min(5,
  Number.isFinite(rank) ? Math.round(rank) : 1));

/**
 * The generated-card branch used by the player in Versus is intentionally
 * separate from the NPC manifestation resolver. Keep this model shared by
 * execution and card copy so the UI cannot advertise NPC-only behavior.
 */
export function resolveGeneratedPlayerVersusEffect(
  generatedFunction: GeneratedAbilityFunction,
  rank = 1,
): GeneratedPlayerVersusEffect {
  switch (generatedFunction) {
    case 'rupture':
      return {
        function: generatedFunction,
        damage: Math.min(COMPETITIVE_RULESET.maxAbilityDamage, 1 + clampRank(rank)),
      };
    case 'inhibit':
    case 'reveal':
      return {
        function: generatedFunction,
        minimumFireDelay: 0.7,
        minimumMoveDelay: 0.55,
      };
    case 'impulse':
      return {
        function: generatedFunction,
        opponentColumnDelta: 1,
        minimumMoveDelay: 0.45,
      };
    case 'adapt':
      return {
        function: generatedFunction,
        opponentRowDelta: 1,
        minimumMoveDelay: 0.4,
      };
    case 'ward':
      return {
        function: generatedFunction,
        nativeShieldGain: 1 + Math.floor(clampRank(rank) / 2),
        versusAdapterPresentationOnly: true,
      };
    case 'restore':
      return {
        function: generatedFunction,
        nativeHpRecovery: 1 + Math.ceil(clampRank(rank) / 2),
        versusAdapterPresentationOnly: true,
      };
    default: {
      const exhaustive: never = generatedFunction;
      throw new Error(`No player Versus effect registered for generated function: ${exhaustive}`);
    }
  }
}

function plural(value: number, singular: string, pluralForm = `${singular}s`): string {
  return value === 1 ? singular : pluralForm;
}

/**
 * These cards create their projectiles in Game before the Versus adapter runs.
 * Describing only the resolver intent for them can therefore be wrong even
 * when that intent is valid for the NPC counterpart.
 */
const PLAYER_NATIVE_PROJECTILES: Partial<
  Record<VersusAbilityId, readonly VersusProjectileIntent[]>
> = {
  shotgun: [{ pattern: 'adjacent', countPerLane: 1, power: 2, piercing: false, big: true }],
  mirror: [{ pattern: 'all', countPerLane: 1, power: 1, piercing: false, big: true }],
  barrage: [{ pattern: 'target', countPerLane: 3, power: 2, piercing: true, big: true }],
  surge: [{ pattern: 'all', countPerLane: 1, power: 2, piercing: true, big: false }],
  // Native power 5 is capped to four when the projectile collides in Versus.
  snipe: [{ pattern: 'target', countPerLane: 1, power: 4, piercing: true, big: true }],
  ricochet: [{ pattern: 'all', countPerLane: 1, power: 2, piercing: true, big: false }],
  rearguard: [{
    pattern: 'both-directions', countPerLane: 1, power: 3, piercing: true, big: false,
  }],
  splitter: [{ pattern: 'all', countPerLane: 2, power: 2, piercing: true, big: false }],
};

function projectileDescription(
  projectile: VersusProjectileIntent,
  nativeProjectile: boolean,
): string {
  const lanes = projectile.pattern === 'all'
    ? 'all 3 lanes'
    : projectile.pattern === 'adjacent'
      ? 'your lane and adjacent lanes'
      : projectile.pattern === 'both-directions'
        ? 'forward and backward on your lane'
        : nativeProjectile
          ? 'your current lane'
          : "the rival's current lane";
  const modifiers = [
    projectile.piercing ? 'piercing' : '',
    projectile.big ? 'heavy' : '',
  ].filter(Boolean).join(' ');
  const shot = `power-${projectile.power} ${modifiers ? `${modifiers} ` : ''}${plural(
    projectile.countPerLane,
    'shot',
  )}`;
  return `Fire ${projectile.countPerLane} ${shot}: ${lanes}`;
}

/** Copy for effects executed by the player's native card branch. */
function nativePlayerCopy(
  outcome: VersusAbilityOutcome,
  context: VersusAbilityContext,
): string | null {
  switch (outcome.abilityId) {
    case 'heal':
      return outcome.casterHpDelta > 0
        ? `Restore ${outcome.casterHpDelta} missing HP.`
        : 'No missing HP to restore.';
    case 'pierce':
      return 'Load the next shot as piercing. The charge is spent by that shot.';
    case 'shield':
    case 'armor': {
      // The native branches run before the Versus adapter: Shield grants one
      // charge and Armor grants three, then competitive resource clamping runs.
      const requested = outcome.abilityId === 'armor' ? 3 : 1;
      const gain = Math.min(
        requested,
        Math.max(0, context.caster.maxShields - context.caster.shields),
      );
      return gain > 0
        ? `Gain ${gain} ${plural(gain, 'shield charge')} (maximum ${context.caster.maxShields}).`
        : `Shield capacity is already full (maximum ${COMPETITIVE_RULESET.maxShields}).`;
    }
    case 'cardflood':
      // Card Flood returns from Game before the Versus adapter executes.
      return 'Immediately replace the current hand with 3 new choices.';
    case 'overclock':
      return 'Set your firing interval to 0.16s for 6s.';
    case 'double':
      return `Double projectile power and add +1 Versus impact damage for 6s (damage cap ${COMPETITIVE_RULESET.maxProjectileDamage}).`;
    case 'multishot':
      return 'For 5s, each trigger fires your shot plus two adjacent-lane follow-ups.';
    case 'regen':
      return outcome.casterHpDelta > 0
        ? 'Restore 1 HP now, then restore 1 HP every 3s for 12s while HP is missing.'
        : 'HP is full now; restore 1 HP every 3s for 12s after damage.';
    case 'drain':
      return 'For 8s, verified projectile damage to the rival restores the same amount of your missing HP.';
    case 'voltage':
      return 'Make your projectiles heavy and piercing for 5s.';
    case 'ghost':
      return 'Ignore incoming collision damage for 4s.';
    case 'turret':
      return 'For 5s, every firing trigger covers all 3 lanes.';
    case 'echo':
      return 'For 5s, each shot adds a reduced-power shot on the next lane.';
    case 'overdrive':
      return 'For 4s, the rival fires faster while your verified hits score 3x Integrity Work.';
    case 'overload':
      return 'For 6s, your next verified HP hit fires one power-1 follow-up, then consumes the effect.';
    case 'berserk':
      return 'Set your firing interval to 0.09s for 4s.';
    case 'crit':
      return `For 5s, each shot has a 40% chance to triple power (damage cap ${COMPETITIVE_RULESET.maxProjectileDamage}).`;
    case 'stasisgate':
      return 'Delay rival movement now and slow its movement recovery for 7s.';
    case 'adaptive':
      return `Add +1 damage to projectile impacts for 7s (damage cap ${COMPETITIVE_RULESET.maxProjectileDamage}).`;
    default:
      return null;
  }
}

/** Translate persistent runtime windows into compact player-facing effects. */
function statusDescription(status: VersusStatusIntent): string | null {
  const seconds = `${status.duration}s`;
  switch (status.id) {
    // Native player branches grant these once. Game clears the adapter copies.
    case 'barrier':
    case 'pierce':
    case 'card-refresh':
      return null;
    case 'adaptive-damage':
      return `Increase shot damage for ${seconds}`;
    case 'affinity-exposed':
      return `Rival vulnerable ${status.magnitude}x for ${seconds}`;
    case 'affinity-rotated':
      return `Rotate rival affinity for ${seconds}`;
    case 'airborne-grounded':
      return `Rival movement suppressed ${seconds}`;
    case 'armor-broken':
      return `Rival vulnerable ${1 + Math.abs(status.magnitude) * 0.25}x for ${seconds}`;
    case 'bind':
      return `Rival movement heavily slowed ${seconds}`;
    case 'catalyst-mark':
      return `Hits score ${status.magnitude}x Integrity Work for ${seconds}`;
    case 'chain-mark':
      return `Rival vulnerable 1.15x for ${seconds}`;
    case 'clone-mark':
      return `Rival vulnerable 1.2x for ${seconds}`;
    case 'critical-chance':
      return `${Math.round(status.magnitude * 100)}% critical chance for ${seconds}`;
    case 'devolved':
      return `Rival vulnerable 1.2x and slowed ${seconds}`;
    case 'echo-shot':
      return `Add a reduced adjacent-lane shot for ${seconds}`;
    case 'emp-disabled':
      return `Rival fire/cards suppressed ${seconds}`;
    case 'fire-rate':
      return status.target === 'caster'
        ? `Increase your fire rate for ${seconds}`
        : `Change rival fire rate to ${status.magnitude}x for ${seconds}`;
    case 'formation-broken':
      return `Rival movement/cards disrupted ${seconds}`;
    case 'fusion-separated':
      return `Rival vulnerable ${1 + Math.min(3, status.stacks ?? 1) * 0.1}x for ${seconds}`;
    case 'ghost':
      return `Ignore collision damage for ${seconds}`;
    case 'gravity-well':
      return `Rival movement slowed ${seconds}`;
    case 'heavy-anchored':
      return `Rival movement heavily slowed ${seconds}`;
    case 'integrity-surge':
      return `Score ${status.magnitude}x Integrity Work for ${seconds}`;
    case 'lane-scrambled':
      return `Rival movement/cards disrupted ${seconds}`;
    case 'leech':
      return `Heal from verified damage for ${seconds}`;
    case 'mutation-locked':
      return `Rival fire/cards suppressed ${seconds}`;
    case 'oil-slick':
      return `Rival movement slowed ${seconds}`;
    case 'overload-shot':
      return `Arm one return shot for ${seconds}`;
    case 'pulse-field':
      return `Rival fire/movement disrupted ${seconds}`;
    case 'quarantined':
      return `Rival movement/cards suppressed ${seconds}`;
    case 'regeneration':
      return `Restore HP over ${seconds}`;
    case 'revealed':
      return `Rival vulnerable 1.15x for ${seconds}`;
    case 'rooted':
      return `Stop rival movement recovery for ${seconds}`;
    case 'signal-jammed':
      return `Rival fire/movement/cards suppressed ${seconds}`;
    case 'staggered':
      return `Rival fire/movement disrupted ${seconds}`;
    case 'stasis-gate':
      return `Rival movement slowed ${seconds}`;
    case 'tail-clamped':
      return `Rival movement heavily slowed ${seconds}`;
    case 'thermal-fracture':
      return `Rival vulnerable ${status.magnitude}x for ${seconds}`;
    case 'time-slow':
      return `Slow rival actions for ${seconds}`;
    case 'trait-stolen':
      return `Rival fire/cards suppressed ${seconds}`;
    case 'turret-fire':
      return `Cover all lanes for ${seconds}`;
    case 'vulnerable':
      return status.magnitude > 1
        ? `Rival vulnerable ${status.magnitude}x for ${seconds}`
        : null;
    case 'weapon-voltage':
      return `Make shots heavy and piercing for ${seconds}`;
    default: {
      const exhaustive: never = status.id;
      throw new Error(`No player-facing status copy for: ${exhaustive}`);
    }
  }
}

/** Format the effect the live player path actually executes in Boss Versus. */
export function describeVersusAbilityOutcome(
  outcome: VersusAbilityOutcome,
  context: VersusAbilityContext,
): string {
  const nativeCopy = nativePlayerCopy(outcome, context);
  if (nativeCopy) return nativeCopy;

  const details: string[] = [];
  if (outcome.casterHpDelta > 0) {
    details.push(`Restore ${outcome.casterHpDelta} HP`);
  }
  if (outcome.opponentHpDelta < 0) {
    const damage = Math.abs(outcome.opponentHpDelta);
    details.push(outcome.opponentShieldDelta < 0
      ? `Break ${Math.abs(outcome.opponentShieldDelta)} shield; deal ${damage} base damage unless another shield, phase, or Shadow Clone blocks`
      : `Deal ${damage} base damage unless shield, phase, or Shadow Clone blocks`);
  } else if (outcome.opponentHpDelta > 0) {
    details.push(`Give the rival ${outcome.opponentHpDelta} HP`);
  }
  if (outcome.casterShieldDelta > 0) {
    details.push(`Gain ${outcome.casterShieldDelta} ${plural(
      outcome.casterShieldDelta,
      'shield charge',
    )}`);
  }
  if (outcome.opponentShieldDelta < 0 && outcome.opponentHpDelta >= 0) {
    details.push(`Break ${Math.abs(outcome.opponentShieldDelta)} rival ${plural(
      Math.abs(outcome.opponentShieldDelta),
      'shield charge',
    )}`);
  } else if (outcome.opponentShieldDelta > 0) {
    details.push(`Give the rival ${outcome.opponentShieldDelta} ${plural(
      outcome.opponentShieldDelta,
      'shield charge',
    )}`);
  }
  if (outcome.opponentFireDelay > 0) {
    details.push(`Rival fire delay ≥${outcome.opponentFireDelay}s`);
  }
  if (outcome.opponentMoveDelay > 0) {
    details.push(`move delay ≥${outcome.opponentMoveDelay}s`);
  }
  if (outcome.opponentCardDelay > 0) {
    details.push(`card delay +${outcome.opponentCardDelay}s`);
  }
  if (outcome.casterColumnDelta !== 0) {
    details.push(`${outcome.casterColumnDelta < 0 ? 'Retreat' : 'Advance'} ${Math.abs(
      outcome.casterColumnDelta,
    )} ${plural(Math.abs(outcome.casterColumnDelta), 'column')}`);
  }
  if (outcome.opponentColumnDelta !== 0) {
    details.push(`Push rival ${Math.abs(outcome.opponentColumnDelta)} ${plural(
      Math.abs(outcome.opponentColumnDelta),
      'column',
    )} ${outcome.opponentColumnDelta > 0 ? 'back' : 'toward center'}`);
  }
  if (outcome.casterRow !== undefined) details.push(`Move to lane ${outcome.casterRow + 1}`);
  if (outcome.opponentRow !== undefined) {
    details.push(`move the rival to lane ${outcome.opponentRow + 1}`);
  }
  const nativeProjectiles = PLAYER_NATIVE_PROJECTILES[outcome.abilityId];
  for (const projectile of nativeProjectiles ?? outcome.projectiles) {
    details.push(projectileDescription(projectile, Boolean(nativeProjectiles)));
  }
  for (const status of outcome.statuses) {
    const description = statusDescription(status);
    if (description && !details.includes(description)) details.push(description);
  }
  if (outcome.integrityMultiplier !== 1
    && outcome.opponentHpDelta < 0
    && !outcome.statuses.some((status) => status.id === 'integrity-surge')) {
    details.push(`Direct HP damage scores ${outcome.integrityMultiplier}x Integrity Work`);
  }
  return details.length > 0
    ? `${details.join('; ')}.`
    : outcome.summary;
}

function describeGeneratedPlayerVersusEffect(
  effect: GeneratedPlayerVersusEffect,
  context: VersusAbilityContext,
): string {
  switch (effect.function) {
    case 'rupture':
      return `Deal ${effect.damage} synchronized damage; a shield, invulnerability, or Shadow Clone can intercept it.`;
    case 'inhibit':
    case 'reveal':
      return `Delay rival fire to at least ${effect.minimumFireDelay}s and movement to at least ${effect.minimumMoveDelay}s.`;
    case 'impulse':
      return `Push the rival ${effect.opponentColumnDelta} column toward its rear and delay movement to at least ${effect.minimumMoveDelay}s.`;
    case 'adapt':
      return `Cycle the rival ${effect.opponentRowDelta} lane and delay movement to at least ${effect.minimumMoveDelay}s.`;
    case 'ward': {
      const gain = Math.min(
        effect.nativeShieldGain,
        Math.max(0, context.caster.maxShields - context.caster.shields),
      );
      return gain > 0
        ? `Gain ${gain} ${plural(gain, 'shield charge')} (maximum ${context.caster.maxShields}).`
        : `Shield capacity is already full (maximum ${context.caster.maxShields}).`;
    }
    case 'restore': {
      const recovery = Math.min(
        effect.nativeHpRecovery,
        Math.max(0, context.caster.maxHp - context.caster.hp),
      );
      return recovery > 0
        ? `Restore ${recovery} missing HP.`
        : 'No missing HP to restore.';
    }
    default: {
      const exhaustive: never = effect;
      throw new Error(`No card copy registered for generated Versus effect: ${String(exhaustive)}`);
    }
  }
}

/**
 * Returns the card copy for the gameplay actually being played.
 *
 * Regular-enemy descriptions are returned byte-for-byte from the existing
 * authored/runtime card. Versus descriptions come from the same pure effect
 * model as execution. Unknown cards fail explicitly; there is no generic copy.
 */
export function resolveAbilityCardContext(
  request: AbilityCardContextRequest,
): AbilityCardContextCopy {
  if (request.gameplay === 'regular-enemies') {
    return {
      label: 'REGULAR ENEMIES',
      description: request.ability.desc,
    };
  }

  if (!request.versusContext) {
    throw new Error(`Versus card context requires a combat snapshot: ${request.ability.id}`);
  }

  if (isVersusAbilityId(request.ability.id)) {
    return {
      label: 'VERSUS BOSS NPC',
      description: describeVersusAbilityOutcome(
        resolveVersusAbilityEffect(request.ability.id, request.versusContext),
        request.versusContext,
      ),
    };
  }

  const generated = readGeneratedVersusAbilityCard(
    request.generatedAbility ?? request.ability,
  );
  if (!generated || generated.id !== request.ability.id) {
    throw new Error(`No Versus card context registered for ability: ${request.ability.id}`);
  }
  return {
    label: 'VERSUS BOSS NPC',
    description: describeGeneratedPlayerVersusEffect(
      resolveGeneratedPlayerVersusEffect(generated.function, request.rank),
      request.versusContext,
    ),
  };
}
