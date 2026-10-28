import type { VersusStatusRuntimePatch } from './versus-status-runtime';

export type GameMode = 'classic' | 'vs';
export type EnemyNiche =
  | 'scout' | 'bulwark' | 'hunter' | 'swarm'
  | 'regenerator' | 'phase' | 'symbiote' | 'opportunist';
export type EnemyMutation =
  | 'accelerated' | 'armored' | 'miniature'
  | 'gigantic' | 'volatile' | 'resilient';
export type EnemyElement =
  | 'kinetic' | 'thermal' | 'cryo' | 'voltaic'
  | 'corrosive' | 'radiant' | 'void' | 'bloom';
export type EnemyType =
  | 'organic' | 'chitinous' | 'botanical' | 'lithic'
  | 'mechanical' | 'synthetic' | 'spectral' | 'fluidic';
export type EnemyClass =
  | 'skirmisher' | 'guardian' | 'predator' | 'replicator'
  | 'mender' | 'infiltrator' | 'support' | 'scavenger';
export type EnemyBaseElement =
  | 'robot' | 'insect' | 'beast' | 'plant' | 'crystal' | 'golem'
  | 'drone' | 'cephalopod' | 'skeleton' | 'avian' | 'serpent'
  | 'vehicle' | 'fungus' | 'cyborg' | 'mech' | 'nanite' | 'data-wraith'
  | 'crab' | 'owl' | 'fox' | 'snail' | 'fish' | 'mole' | 'turret';

export interface EnemyGenome {
  niche: EnemyNiche;
  baseElement: EnemyBaseElement;
  element: EnemyElement;
  entityType: EnemyType;
  enemyClass: EnemyClass;
  generation: number;
  mutations: EnemyMutation[];
  speedScale: number;
  hpBonus: number;
  sizeScale: number;
  regeneration: number;
  phaseChance: number;
  fusionLevel: number;
  fusionElement?: EnemyBaseElement;
  fusionAffinity?: EnemyElement;
}

/** Visual-only attack-language stages for Lord Alpha's existing projectile. */
export type LordAlphaProjectileVariant =
  | 'quick'
  | 'web'
  | 'power'
  | 'roc'
  | 'finisher';

export interface Bullet {
  colPos: number;
  row: number;
  speed: number;
  power: number;
  big: boolean;
  pierce: boolean;
  attackStyle?:
    | 'physical' | 'energy' | 'melee'
    | 'temporal' | 'gravity' | 'portal' | 'vector'
    | 'grid' | 'resonance' | 'adaptive' | 'reflective'
    | 'swarm' | 'suppression' | 'polarity' | 'orbital';
  /** Skin identity used only for additional projectile animation effects. */
  effectSkin?: string;
  /**
   * Visual presentation clock for Lord Alpha. This never participates in
   * movement, damage, collision, cooldown, or persistence calculations.
   */
  presentationBirthMs?: number;
  /** Visual-only Lord Alpha projectile grammar selected once per attack volley. */
  presentationVariant?: LordAlphaProjectileVariant;
  /** Route identity belongs only to the deliberately aimed primary carrier. */
  routeDirection?: 'last' | 'next';
  /** Stable enemy identities already resolved by this projectile. */
  hitEnemySeeds?: number[];
  /** A piercing player projectile may resolve against the versus boss once. */
  hitNpc?: boolean;
  /** A piercing NPC projectile may resolve against the player once. */
  hitPlayer?: boolean;
  /** NPC-side authored seeking keeps tracking the player's live lane. */
  homing?: boolean;
  /** NPC-only bounded recovery applied after this projectile deals HP damage. */
  leechOnHit?: number;
  /** Dedicated authored carrier; omitted for every ordinary projectile. */
  visualKind?: 'tharthareon-bite' | 'tharthareon-fireball';
  /** Input-authored Tharthareon action sharing the collision-owned carrier. */
  tharthareonMode?: 'fireball' | 'bite' | 'headbutt';
  /** Monotonic one-shot presentation clock; headbutt frames never wrap. */
  tharthareonCycleElapsed?: number;
  /** Fixed launch coordinate used to cap a short-range authored carrier. */
  travelOriginCol?: number;
  /** Maximum horizontal distance from travelOriginCol before the carrier expires. */
  travelLimitCells?: number;
  /** Previous simulation coordinate used by the bite's swept collision check. */
  previousColPos?: number;
  /** Set only on the frame the carrier reaches its bounded endpoint. */
  travelComplete?: boolean;
  /** Renderer contract: hold the authored final jaw-closed bite frame. */
  tharthareonFinalBite?: boolean;
  /** Simulation-owned final-frame hold, in seconds. */
  tharthareonHoldRemaining?: number;
  /** Prevents the held impact sprite from applying damage more than once. */
  tharthareonCollisionResolved?: boolean;
  /** True until the input source that launched this bite is released. */
  tharthareonInputHeld?: boolean;
  /** Stable campaign-enemy identity currently clamped in the jaws. */
  tharthareonTargetSeed?: number;
  /** Versus/boss target marker; the live NpcAgent remains the rendered entity. */
  tharthareonTargetNpc?: boolean;
  /** Simulation time spent retaining the live target, capped at three seconds. */
  tharthareonTargetHoldElapsed?: number;
}

/**
 * Rewind-safe horizontal displacement used by authored grid pulls. Keeping the
 * complete interpolation state in GameState makes the motion pause, rewind,
 * and render through the same simulation clock as its target.
 */
export interface GridColumnPullMotion {
  startColumn: number;
  endColumn: number;
  elapsed: number;
  delay: number;
  duration: number;
}

export type EnemyAbility =
  | 'momentumCharge'
  | 'phaseLeap'
  | 'mendingPulse'
  | 'laneShift'
  | 'arcArmor';

export interface Enemy {
  colPos: number;
  row: number;
  speed: number;
  hp: number;
  flash: number;
  /** Integer 1–255; determines virus morphology via Virus Morphology Encoding Standard v1 */
  value: number;
  /** Stable specimen identity; survives structured clones and timeline rewind. */
  visualSeed?: number;
  /** Shared by enemies spawned as one coordinated attack formation. */
  formationId?: number;
  genome?: EnemyGenome;
  maxHp?: number;
  regenerationCharge?: number;
  stasisTriggered?: boolean;
  catalystMarked?: boolean;
  /** Per-entity locomotion restraint used by specialist counter abilities. */
  mobilityLockTimer?: number;
  /** Lord Alpha's attached grapple; present only while the target crosses a cell. */
  grapplePull?: GridColumnPullMotion;
  /** A grappled campaign-route objective remains at its newly secured hold line. */
  routeHoldColumn?: number;
  /** Suppresses phase, regeneration, fusion and constitution casting. */
  traitSuppressionTimer?: number;
  ability?: EnemyAbility;
  /** Existing player ability translated into this enemy's constitution counterpart. */
  counterpartAbilityId?: string;
  abilityCooldown?: number;
  abilityWindup?: number;
  /** Compact, rewind-safe tactical state. Runtime strategy data stays scalar. */
  strategyDecisionCooldown?: number;
  strategyDecisionIndex?: number;
  strategyLaneChangeCooldown?: number;
  strategyTargetRow?: number;
  strategyAbilityTargetRow?: number;
  strategyCastReady?: boolean;
  strategySpeedMultiplier?: number;
  strategyCooldownScale?: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
}

export interface Player {
  col: number;
  row: number;
  fireCooldown: number;
  /** Versus control effects can temporarily prevent lane movement. */
  moveCooldown: number;
}

export interface NpcAgent {
  /** Column within the right half (0–2); actual board col = 3 + this. */
  col: number;
  row: number;
  fireCooldown: number;
  moveCooldown: number;
  hp: number;
  shieldCharges: number;
  /** Rewind-safe competitive decision timeline and signature resources. */
  abilityCooldown: number;
  signatureCooldown: number;
  signatureWindow: number;
  signatureActionCooldown: number;
  signatureActions: number;
  signatureLastCommand: number;
  signatureMode: number;
  signatureCharges: number;
  signaturePlacements: number[];
  signatureOriginCol: number;
  signatureOriginRow: number;
  strategyStep: number;
  decisionLock: number;
  /** Lord Alpha's attached grapple; columns remain local to the NPC half. */
  grapplePull?: GridColumnPullMotion;
}

export interface AbilityCooldowns {
  [key: string]: number;
}

export interface GameState {
  running: boolean;
  /** Legacy pacing counter. Player-facing progression uses integrityWork. */
  score: number;
  integrityWork: number;
  systemIntegrity: {
    global: number;
    sector: number;
    node: number;
  };
  wave: number;
  hp: number;
  timer: number;
  enemySpawnTimer: number;
  directorRecoveryTimer: number;
  directorCritical: boolean;
  nextUpgradeWave: number;
  upgradePromptOpen: boolean;
  upgradePromptTimer: number;
  upgradeRetryWave: number;
  upgradeSelectionOpen: boolean;
  upgradeOptions: string[];
  runUpgrades: Record<string, number>;
  milestoneDefeatStreak: number;
  milestoneVanguardDefeats: number;
  milestoneBonusWaves: number;
  /** Route-enabled campaigns derive world depth from secured route segments. */
  milestoneTraversalDriven: boolean;
  /** Monotonic world steps already converted into long-form traversal rewards. */
  milestoneWorldSteps: number;
  /** Fractional synthesis banks let every long-form rank contribute. */
  milestonePierceProgress: number;
  milestoneShieldProgress: number;
  shotsFired: number;
  enemyFormationId: number;
  lanePressure: [number, number, number];
  ecosystemStats: {
    entitySignatures: string[];
    mutationDiscoveries: number;
    maxGeneration: number;
    totalFusions: number;
  };
  recentBaseElements: EnemyBaseElement[];
  recentBodyClasses: string[];
  recentElementDomains: string[];
  moveFlash: number;
  // Status timers — original
  slowTimer: number;
  overclockTimer: number;
  freezeTimer: number;
  blizzardTimer: number;
  doubleTimer: number;
  multishotTimer: number;
  regenTimer: number;
  regenTick: number;
  drainTimer: number;
  voltageTimer: number;
  // Status timers — new abilities
  ghostTimer: number;      // invincible to hits
  turretTimer: number;     // auto-fires all 3 rows
  echoTimer: number;       // each bullet clones to adjacent row
  overdriveTimer: number;  // enemies faster but 3× score
  pulseTimer: number;      // periodic repulse wave
  pulseTick: number;       // time until next pulse
  overloadTimer: number;   // kills fire a bullet in same row
  magnetTimer: number;     // pushes enemies toward right edge
  berserkTimer: number;    // very fast fire rate
  critTimer: number;       // 40% chance of 3× damage per bullet
  signalJamTimer: number;
  stasisGateTimer: number;
  adaptiveAmmoTimer: number;
  // Card system
  cardTimer: number;
  cardsReady: boolean;
  cardSelectionOpen: boolean;
  rotateUsedThisHand: boolean;
  usedInHand: string[];   // ability IDs used in the current hand
  // Entities
  player: Player;
  architectCannons: Array<{
    col: number;
    row: number;
    timer: number;
    fireCooldown: number;
  }>;
  bullets: Bullet[];
  enemies: Enemy[];
  particles: Particle[];
  // Misc
  autoBuster: boolean;
  shieldCharges: number;
  pierceShots: number;
  abilityCooldowns: AbilityCooldowns;
  currentCardOptions: string[];
  // VS mode
  gameMode: GameMode;
  /** Seed advanced by the versioned competitive simulation for replay parity. */
  competitiveSeed: number;
  /** Persistent, bounded competitive status windows shared by player abilities. */
  versusStatusRuntime: VersusStatusRuntimePatch;
  npc: NpcAgent;
  npcBullets: Bullet[];
  npcEnemies: Enemy[];     // green enemies moving right, sent by player kills
  playerWon: boolean;
}

export interface Ability {
  id: string;
  name: string;
  desc: string;
  cooldown: number;
}

export interface BoardMetrics {
  cell: number;
  boardW: number;
  boardH: number;
  x: number;
  y: number;
}
