import type {
  EnemyAbility,
  EnemyClass,
  EnemyElement,
  EnemyGenome,
  EnemyNiche,
  EnemyType,
} from './types';

/**
 * Authored enemy abilities that have a complete combat contract.
 *
 * The rest of the legacy EnemyAbility union remains valid. Keeping this as a
 * subset lets the simulation migrate one family at a time without changing
 * save data or silently giving an unfinished profile production behavior.
 */
export const AUTHORED_ENEMY_ABILITY_IDS = [
  'arcArmor',
  'mendingPulse',
  'phaseLeap',
] as const satisfies readonly EnemyAbility[];

export type AuthoredEnemyAbilityId = typeof AUTHORED_ENEMY_ABILITY_IDS[number];

export type EnemyCombatRole = 'protector' | 'support' | 'infiltrator';
export type EnemyAbilityPhaseId = 'windup' | 'commit' | 'active' | 'recovery';

export interface SecondsRange {
  readonly min: number;
  readonly max: number;
}

export interface EnemyAbilityPhaseDefinition {
  readonly durationSeconds: number;
  /** Multiplier applied to normal movement while this phase is active. */
  readonly movementScale: number;
  readonly interruptible: boolean;
  /** Prevents target selection from changing after the phase begins. */
  readonly locksTarget: boolean;
  /** Stable cue name for renderers and audio adapters. */
  readonly cue: string;
}

export interface EnemyAbilityTiming {
  readonly initialDelaySeconds: SecondsRange;
  readonly cooldownSeconds: SecondsRange;
  readonly phases: Readonly<Record<EnemyAbilityPhaseId, EnemyAbilityPhaseDefinition>>;
}

export type EnemyAbilityTargetingIntent =
  | {
      readonly kind: 'protect-ally';
      readonly includeSelf: true;
      readonly sameFormationOnly: true;
      readonly maxRowDistance: number;
      readonly maxTargets: 1;
      readonly priority: 'highest-incoming-damage';
      readonly fallback: 'self';
    }
  | {
      readonly kind: 'restore-allies';
      readonly includeSelf: boolean;
      readonly sameFormationOnly: true;
      readonly maxRowDistance: number;
      readonly maxTargets: number;
      readonly priority: 'lowest-hp-ratio';
      readonly fallback: 'hold';
    }
  | {
      readonly kind: 'intercept-player';
      readonly predictionSeconds: number;
      readonly maxTargets: 1;
      readonly destination: 'forward-adjacent-cell';
      readonly requireOpenDestination: true;
      readonly fallback: 'hold';
    };

export type EnemyAbilityEffectIntent =
  | {
      readonly kind: 'armor';
      readonly layers: number;
      readonly maximumLayers: number;
      readonly durationSeconds: number;
    }
  | {
      readonly kind: 'heal';
      readonly hitPoints: number;
      readonly maximumTargets: number;
      readonly cannotExceedMaxHp: true;
    }
  | {
      readonly kind: 'relocate';
      readonly destination: 'forward-adjacent-cell';
      readonly invulnerableDuringTransit: true;
    }
  | {
      readonly kind: 'strike';
      readonly damage: number;
      readonly reachCells: number;
      readonly collision: 'destination-lane';
    };

export type EnemyCounterplayAction =
  | 'interrupt'
  | 'focus-caster'
  | 'change-lane'
  | 'break-link'
  | 'punish-recovery';

export interface EnemyAbilityCounterplayWindow {
  readonly phase: EnemyAbilityPhaseId;
  readonly action: EnemyCounterplayAction;
  readonly playerRead: string;
  readonly result: string;
}

export interface EnemyAbilityCounterplay {
  /** Short rule surfaced by guides and accessibility descriptions. */
  readonly summary: string;
  readonly windows: readonly EnemyAbilityCounterplayWindow[];
  readonly onInterrupted: 'cancel-and-full-cooldown' | 'cancel-and-partial-cooldown';
}

export interface EnemyAbilityPresentation {
  readonly castLabel: string;
  readonly telegraphShape: 'ally-brackets' | 'link-arc' | 'destination-cell';
  readonly telegraphColor: string;
  readonly targetMarker: string;
  readonly windupAnimation: string;
  readonly activeAnimation: string;
  readonly recoveryAnimation: string;
  readonly audioCue: string;
}

/** Every field in a clause is ANDed; separate clauses are ORed. */
export interface EnemyConstitutionClause {
  readonly niches?: readonly EnemyNiche[];
  readonly enemyClasses?: readonly EnemyClass[];
  readonly entityTypes?: readonly EnemyType[];
  readonly elements?: readonly EnemyElement[];
}

export interface EnemyAbilityConstitution {
  /** Matches the existing maturity gate used by the current simulation. */
  readonly requiresMaturity: boolean;
  readonly anyOf: readonly EnemyConstitutionClause[];
}

export interface EnemyAbilityProfile {
  readonly id: AuthoredEnemyAbilityId;
  readonly familyId: 'bulwark' | 'mender' | 'phase-stalker';
  readonly familyName: string;
  readonly role: EnemyCombatRole;
  readonly summary: string;
  readonly selectionPriority: number;
  readonly constitution: EnemyAbilityConstitution;
  readonly timing: EnemyAbilityTiming;
  readonly targeting: EnemyAbilityTargetingIntent;
  readonly effects: readonly EnemyAbilityEffectIntent[];
  readonly counterplay: EnemyAbilityCounterplay;
  readonly presentation: EnemyAbilityPresentation;
}

const COMMON_INITIAL_DELAY: SecondsRange = { min: 1.25, max: 2.6 };

export const ENEMY_ABILITY_PROFILES = {
  arcArmor: {
    id: 'arcArmor',
    familyId: 'bulwark',
    familyName: 'Bulwark',
    role: 'protector',
    summary: 'Reads incoming pressure, then anchors one threatened formation member behind a visible voltaic armor layer.',
    selectionPriority: 100,
    constitution: {
      requiresMaturity: true,
      anyOf: [
        { niches: ['bulwark'] },
        { enemyClasses: ['guardian'] },
        { entityTypes: ['mechanical'], elements: ['voltaic'] },
      ],
    },
    timing: {
      initialDelaySeconds: COMMON_INITIAL_DELAY,
      cooldownSeconds: { min: 8.5, max: 10.5 },
      phases: {
        windup: {
          durationSeconds: 1.15,
          movementScale: 0.12,
          interruptible: true,
          locksTarget: false,
          cue: 'arc-armor:route-charge',
        },
        commit: {
          durationSeconds: 0.18,
          movementScale: 0,
          interruptible: false,
          locksTarget: true,
          cue: 'arc-armor:close-circuit',
        },
        active: {
          durationSeconds: 2.8,
          movementScale: 0.72,
          interruptible: false,
          locksTarget: true,
          cue: 'arc-armor:layer-active',
        },
        recovery: {
          durationSeconds: 0.75,
          movementScale: 0.42,
          interruptible: false,
          locksTarget: false,
          cue: 'arc-armor:discharge',
        },
      },
    },
    targeting: {
      kind: 'protect-ally',
      includeSelf: true,
      sameFormationOnly: true,
      maxRowDistance: 1,
      maxTargets: 1,
      priority: 'highest-incoming-damage',
      fallback: 'self',
    },
    effects: [
      { kind: 'armor', layers: 1, maximumLayers: 2, durationSeconds: 2.8 },
    ],
    counterplay: {
      summary: 'Interrupt the routing charge or change lanes and punish the Bulwark after its circuit discharges.',
      windows: [
        {
          phase: 'windup',
          action: 'interrupt',
          playerRead: 'Electric brackets converge on the protected target.',
          result: 'The armor layer is not created and the ability enters its full cooldown.',
        },
        {
          phase: 'recovery',
          action: 'punish-recovery',
          playerRead: 'The armor collapses inward and the Bulwark vents charge.',
          result: 'The Bulwark is movement-limited and cannot begin another cast.',
        },
      ],
      onInterrupted: 'cancel-and-full-cooldown',
    },
    presentation: {
      castLabel: 'ARC ARMOR',
      telegraphShape: 'ally-brackets',
      telegraphColor: '#69d8ff',
      targetMarker: 'voltaic-circuit-brackets',
      windupAnimation: 'bulwark-route-charge',
      activeAnimation: 'bulwark-armor-locked',
      recoveryAnimation: 'bulwark-discharge',
      audioCue: 'enemy.arc-armor',
    },
  },

  mendingPulse: {
    id: 'mendingPulse',
    familyId: 'mender',
    familyName: 'Mender',
    role: 'support',
    summary: 'Links to damaged members of its formation and releases a bounded repair pulse instead of healing indiscriminately.',
    selectionPriority: 300,
    constitution: {
      requiresMaturity: true,
      anyOf: [
        { niches: ['regenerator'] },
        { enemyClasses: ['mender'] },
      ],
    },
    timing: {
      initialDelaySeconds: COMMON_INITIAL_DELAY,
      cooldownSeconds: { min: 9, max: 11 },
      phases: {
        windup: {
          durationSeconds: 1.3,
          movementScale: 0.08,
          interruptible: true,
          locksTarget: false,
          cue: 'mending-pulse:acquire-links',
        },
        commit: {
          durationSeconds: 0.22,
          movementScale: 0,
          interruptible: true,
          locksTarget: true,
          cue: 'mending-pulse:seal-links',
        },
        active: {
          durationSeconds: 0.32,
          movementScale: 0,
          interruptible: false,
          locksTarget: true,
          cue: 'mending-pulse:repair',
        },
        recovery: {
          durationSeconds: 1,
          movementScale: 0.32,
          interruptible: false,
          locksTarget: false,
          cue: 'mending-pulse:link-cooldown',
        },
      },
    },
    targeting: {
      kind: 'restore-allies',
      includeSelf: false,
      sameFormationOnly: true,
      maxRowDistance: 1,
      maxTargets: 2,
      priority: 'lowest-hp-ratio',
      fallback: 'hold',
    },
    effects: [
      { kind: 'heal', hitPoints: 1, maximumTargets: 2, cannotExceedMaxHp: true },
    ],
    counterplay: {
      summary: 'Break the visible repair links or interrupt the Mender before the pulse releases.',
      windows: [
        {
          phase: 'windup',
          action: 'focus-caster',
          playerRead: 'Two ordered link arcs extend from the Mender to wounded allies.',
          result: 'Defeating or interrupting the Mender cancels every linked repair.',
        },
        {
          phase: 'commit',
          action: 'break-link',
          playerRead: 'Links narrow and brighten immediately before repair.',
          result: 'A target outside link range is removed from the pulse.',
        },
        {
          phase: 'recovery',
          action: 'punish-recovery',
          playerRead: 'The Mender remains open while its link emitters retract.',
          result: 'The Mender cannot move at full speed or begin another cast.',
        },
      ],
      onInterrupted: 'cancel-and-partial-cooldown',
    },
    presentation: {
      castLabel: 'MENDING PULSE',
      telegraphShape: 'link-arc',
      telegraphColor: '#7dffbd',
      targetMarker: 'ordered-repair-link',
      windupAnimation: 'mender-link-open',
      activeAnimation: 'mender-pulse-release',
      recoveryAnimation: 'mender-link-retract',
      audioCue: 'enemy.mending-pulse',
    },
  },

  phaseLeap: {
    id: 'phaseLeap',
    familyId: 'phase-stalker',
    familyName: 'Phase Stalker',
    role: 'infiltrator',
    summary: 'Marks a legal interception cell, crosses the grid through a readable phase path, strikes, then exposes itself during recovery.',
    selectionPriority: 200,
    constitution: {
      requiresMaturity: true,
      anyOf: [
        { niches: ['phase'], elements: ['void'] },
        { enemyClasses: ['infiltrator'], elements: ['void'] },
        { entityTypes: ['spectral'], elements: ['void'] },
      ],
    },
    timing: {
      initialDelaySeconds: COMMON_INITIAL_DELAY,
      cooldownSeconds: { min: 7.5, max: 9.5 },
      phases: {
        windup: {
          durationSeconds: 1.05,
          movementScale: 0.18,
          interruptible: true,
          locksTarget: false,
          cue: 'phase-leap:mark-destination',
        },
        commit: {
          durationSeconds: 0.28,
          movementScale: 0,
          interruptible: false,
          locksTarget: true,
          cue: 'phase-leap:cross-grid',
        },
        active: {
          durationSeconds: 0.2,
          movementScale: 0,
          interruptible: false,
          locksTarget: true,
          cue: 'phase-leap:intercept-strike',
        },
        recovery: {
          durationSeconds: 1.1,
          movementScale: 0.2,
          interruptible: false,
          locksTarget: false,
          cue: 'phase-leap:reconstitute',
        },
      },
    },
    targeting: {
      kind: 'intercept-player',
      predictionSeconds: 0.45,
      maxTargets: 1,
      destination: 'forward-adjacent-cell',
      requireOpenDestination: true,
      fallback: 'hold',
    },
    effects: [
      {
        kind: 'relocate',
        destination: 'forward-adjacent-cell',
        invulnerableDuringTransit: true,
      },
      { kind: 'strike', damage: 1, reachCells: 1, collision: 'destination-lane' },
    ],
    counterplay: {
      summary: 'Leave the marked destination before commitment, then punish the Stalker while it reconstitutes.',
      windows: [
        {
          phase: 'windup',
          action: 'change-lane',
          playerRead: 'A stable destination outline appears before the Stalker moves.',
          result: 'The locked interception cell is left empty and the strike misses.',
        },
        {
          phase: 'windup',
          action: 'interrupt',
          playerRead: 'A phase path connects the Stalker to the destination marker.',
          result: 'The crossing is cancelled before transit invulnerability begins.',
        },
        {
          phase: 'recovery',
          action: 'punish-recovery',
          playerRead: 'The Stalker rebuilds from the destination outward.',
          result: 'The Stalker is slow and fully vulnerable during reconstitution.',
        },
      ],
      onInterrupted: 'cancel-and-full-cooldown',
    },
    presentation: {
      castLabel: 'PHASE LEAP',
      telegraphShape: 'destination-cell',
      telegraphColor: '#bc7cff',
      targetMarker: 'phase-destination-outline',
      windupAnimation: 'phase-stalker-path-open',
      activeAnimation: 'phase-stalker-cross-and-strike',
      recoveryAnimation: 'phase-stalker-reconstitute',
      audioCue: 'enemy.phase-leap',
    },
  },
} as const satisfies Readonly<Record<AuthoredEnemyAbilityId, EnemyAbilityProfile>>;

const ALL_AUTHORED_PROFILES: readonly EnemyAbilityProfile[] = Object.values(ENEMY_ABILITY_PROFILES)
  .sort((left, right) => right.selectionPriority - left.selectionPriority);

const ABILITY_PROFILE_LOOKUP: Readonly<Partial<Record<EnemyAbility, EnemyAbilityProfile>>> =
  ENEMY_ABILITY_PROFILES;

export function getEnemyAbilityProfile(
  ability: EnemyAbility | null | undefined,
): EnemyAbilityProfile | undefined {
  return ability ? ABILITY_PROFILE_LOOKUP[ability] : undefined;
}

export function isAuthoredEnemyAbility(
  ability: EnemyAbility | null | undefined,
): ability is AuthoredEnemyAbilityId {
  return getEnemyAbilityProfile(ability) !== undefined;
}

export function getEnemyAbilityPhase(
  ability: EnemyAbility | null | undefined,
  phase: EnemyAbilityPhaseId,
): EnemyAbilityPhaseDefinition | undefined {
  return getEnemyAbilityProfile(ability)?.timing.phases[phase];
}

export function isMatureEnemyGenome(genome: EnemyGenome): boolean {
  return genome.fusionLevel > 0 || (genome.generation >= 2 && genome.mutations.length >= 2);
}

function clauseMatchesGenome(clause: EnemyConstitutionClause, genome: EnemyGenome): boolean {
  return (!clause.niches || clause.niches.includes(genome.niche))
    && (!clause.enemyClasses || clause.enemyClasses.includes(genome.enemyClass))
    && (!clause.entityTypes || clause.entityTypes.includes(genome.entityType))
    && (!clause.elements || clause.elements.includes(genome.element));
}

export function canGenomeUseEnemyAbility(
  genome: EnemyGenome,
  profile: EnemyAbilityProfile,
): boolean {
  if (profile.constitution.requiresMaturity && !isMatureEnemyGenome(genome)) return false;
  return profile.constitution.anyOf.some((clause) => clauseMatchesGenome(clause, genome));
}

/**
 * Selects the highest-priority complete profile supported by a genome.
 * Returns undefined for legacy families so callers can preserve their current
 * fallback until those abilities receive authored profiles.
 */
export function getEnemyAbilityProfileForGenome(
  genome: EnemyGenome | null | undefined,
): EnemyAbilityProfile | undefined {
  if (!genome) return undefined;
  return ALL_AUTHORED_PROFILES.find((profile) => canGenomeUseEnemyAbility(genome, profile));
}
