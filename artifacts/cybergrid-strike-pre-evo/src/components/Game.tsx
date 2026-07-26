import { useRef, useEffect, useState, useCallback } from 'react';
import { ChainPanel } from './ChainPanel';
import { RewardAccumulator, type KillRecord } from '@/blockchain/rewards';

// Static one-time render of a GIF's first frame with white-background removed.
// The img is never added to the DOM — no element shows through transparent pixels —
// so the canvas background is genuinely transparent over the button.
function SkinPreviewCanvas({ src }: { src: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, 48, 48);
      const id = ctx.getImageData(0, 0, 48, 48);
      const d  = id.data;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i] > 210 && d[i + 1] > 210 && d[i + 2] > 210) d[i + 3] = 0;
      }
      ctx.putImageData(id, 0, 0);
    };
    img.src = src;
  }, [src]);
  return (
    <canvas ref={canvasRef} width={48} height={48}
      style={{ display: 'block', imageRendering: 'pixelated', width: 48, height: 48 }} />
  );
}
import type { GameState, GameMode, EnemyGenome } from '../game/types';
import { ABILITY_POOL, ABILITY_LOOKUP, CARD_CHARGE_TIME, NPC_HP, NPC_FIRE_INTERVAL, NPC_MOVE_INTERVAL } from '../game/constants';
import { draw, getBoardMetrics } from '../game/renderer';
import {
  ensureAudio, startMusic, stopMusic,
  playShot, playHit, playScore, playGameOver,
  playMove, playAutoToggle, playCardReady, playAbility,
} from '../game/audio';
import { pickDiverseSeed, registerSpawn, getMorphSig } from '../game/virus-morphology';
import { canFuse, createGenome, fuseGenomes, selectAdaptiveRow } from '../game/evolution';
import { getEnemyMovementClass, getProceduralVirusSprite, type EnemyMovementClass } from '../game/procedural-virus';
import { ELEMENT_DOMAIN } from '../game/element-matrix';

const ALL_ABILITY_IDS = new Set(ABILITY_POOL.map((a) => a.id));
const OFFENSE_ABILITY_IDS = new Set([
  'shotgun', 'pierce', 'bomb', 'mirror', 'nuke', 'barrage', 'purge', 'surge',
  'megabomb', 'double', 'voltage', 'snipe', 'chain', 'cluster', 'flak',
  'groundwire', 'interceptor', 'adaptive', 'ricochet', 'rearguard', 'arcweb',
  'splitter', 'seeker', 'shattershot', 'marksman', 'returnfire', 'thermalshock',
  'circuitarc', 'acidetch', 'radiantmark', 'kineticram',
]);
const CONTROL_ABILITY_IDS = new Set([
  'time', 'shield', 'scramble', 'warpback', 'armor', 'backdash', 'freeze',
  'blizzard', 'regen', 'ghost', 'pulse', 'magnet', 'signaljam', 'undertow',
  'stasisgate', 'oilslick', 'rootsnare', 'sonicnet', 'depthcharge',
  'anchorfield', 'tailclamp', 'tanglewire', 'trafficjam', 'bloombind',
  'voidaperture', 'quarantine',
]);
type AbilityCategory = 'offense' | 'control' | 'wildcard';
const abilityBags: Record<AbilityCategory, string[]> = {
  offense: [],
  control: [],
  wildcard: [],
};
let previousAbilityHand: string[] = [];
const AIR_CLASSES = new Set<EnemyMovementClass>(['flier', 'hover', 'spectral']);
const FLUID_CLASSES = new Set<EnemyMovementClass>(['aquatic', 'serpentine', 'tentacled']);
const GROUNDED_CLASSES = new Set<EnemyMovementClass>(['biped', 'quadruped', 'arthropod', 'burrower', 'vehicle', 'fortress']);
const HEAVY_CLASSES = new Set<EnemyMovementClass>(['fortress', 'vehicle', 'rooted']);
const CYBER_BASES = new Set([
  'robot', 'drone', 'vehicle', 'cyborg', 'mech', 'nanite',
  'data-wraith', 'turret', 'fish', 'mole',
]);
const BESTIARY_KEY = 'cgs_bestiary_v1';
const VIRTUAL_DPAD_KEY = 'cgs_virtual_dpad_v1';

interface BestiaryEntry {
  signature: string;
  seed: number;
  genome: EnemyGenome;
  discoveredAt: number;
}

interface RunUpgrade {
  id: string;
  name: string;
  desc: string;
  maxLevel: number;
}

const RUN_UPGRADES: RunUpgrade[] = [
  { id: 'capacitor', name: 'CAPACITOR', desc: 'Ability hands recharge 15% faster per level.', maxLevel: 3 },
  { id: 'rapidBuster', name: 'RAPID BUSTER', desc: 'Player fires 10% faster per level.', maxLevel: 3 },
  { id: 'phaseRounds', name: 'PHASE ROUNDS', desc: 'Every fifth shot pierces; higher levels trigger sooner.', maxLevel: 3 },
  { id: 'denseCharge', name: 'DENSE CHARGE', desc: 'Every fourth shot gains +1 damage per level.', maxLevel: 3 },
  { id: 'repairWeave', name: 'REPAIR WEAVE', desc: 'Restore 2 HP now and 1 HP after each recovery window.', maxLevel: 2 },
  { id: 'barrierArray', name: 'BARRIER ARRAY', desc: 'Gain 2 shield charges immediately.', maxLevel: 3 },
  { id: 'shockVent', name: 'SHOCK VENT', desc: 'Entering critical pressure pushes every enemy backward.', maxLevel: 2 },
  { id: 'hybridHunter', name: 'HYBRID HUNTER', desc: 'Shots deal +1 damage to fused enemies per level.', maxLevel: 2 },
];
const UPGRADE_PROMPT_TIME = 10;
const UPGRADE_RETRY_WAVES = 2;

function chooseUpgradeOptions(levels: Record<string, number>): string[] {
  return shuffleIds(RUN_UPGRADES
    .filter((upgrade) => (levels[upgrade.id] ?? 0) < upgrade.maxLevel)
    .map((upgrade) => upgrade.id)).slice(0, 3);
}

function BestiarySprite({ seed, genome }: { seed: number; genome: EnemyGenome }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const sprite = getProceduralVirusSprite(seed, genome);
    const redraw = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const context = canvas.getContext('2d');
      if (!context) return;
      context.imageSmoothingEnabled = false;
      context.clearRect(0, 0, 240, 160);
      context.drawImage(sprite, 0, 0, 240, 160);
    };
    redraw();
    // Component images load asynchronously and re-render the cached source
    // canvas. Refresh at a few widening intervals so the Bestiary receives the
    // completed composite instead of preserving the initial empty frame.
    const timers = [100, 300, 700, 1500, 3000].map((delay) =>
      window.setTimeout(redraw, delay));
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [seed, genome]);
  return <canvas ref={canvasRef} className="bestiarySprite" width={240} height={160} />;
}

function movementClassOf(enemy: GameState['enemies'][number]): EnemyMovementClass | undefined {
  return enemy.genome ? getEnemyMovementClass(enemy.genome.baseElement) : undefined;
}

function isCyberEnemy(enemy: GameState['enemies'][number]): boolean {
  return Boolean(enemy.genome && CYBER_BASES.has(enemy.genome.baseElement));
}

function genomeSignature(enemy: GameState['enemies'][number]): string | undefined {
  const genome = enemy.genome;
  if (!genome) return undefined;
  return [
    genome.baseElement,
    genome.element,
    genome.entityType,
    genome.enemyClass,
    genome.fusionElement ?? 'pure',
    genome.niche,
    [...genome.mutations].sort().join('+') || 'baseline',
    `fusion-${genome.fusionLevel}`,
  ].join(':');
}

function shuffleIds(ids: string[]): string[] {
  const shuffled = [...ids];
  for (let index = shuffled.length - 1; index > 0; index--) {
    const other = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[other]] = [shuffled[other], shuffled[index]];
  }
  return shuffled;
}

function relevantAbilityIds(enemies: GameState['enemies'], hp: number): string[] {
  const living = enemies.filter((enemy) => enemy.colPos >= -1);
  const relevant = new Set<string>();
  const add = (...ids: string[]) => ids.forEach((id) => {
    if (ABILITY_LOOKUP[id]) relevant.add(id);
  });

  if (living.length >= 4) add('bomb', 'megabomb', 'nuke', 'surge', 'chain', 'pulse', 'blizzard', 'backdash');
  if (living.some((enemy) => enemy.colPos <= 2.35)) {
    add('backdash', 'scramble', 'freeze', 'ghost', 'shield', 'pulse', 'stasisgate', 'returnfire');
  }
  if (living.some((enemy) => (enemy.genome?.fusionLevel ?? 0) > 0)) {
    add('separate', 'hybridtax', 'devolve', 'quarantine');
  }
  if (living.some((enemy) =>
    enemy.genome?.mutations.includes('armored') || enemy.genome?.mutations.includes('resilient'))) {
    add('shattershot', 'acidetch', 'adaptive', 'mutationlock');
  }
  if (living.some((enemy) => {
    const movement = movementClassOf(enemy);
    return movement && AIR_CLASSES.has(movement);
  })) add('time', 'flak', 'sonicnet', 'freeze');
  if (living.some(isCyberEnemy)) add('signaljam', 'circuitarc', 'trafficjam', 'magnet');
  if (hp <= 2) add('heal', 'armor', 'shield', 'ghost', 'regen', 'drain');
  if (relevant.size === 0) add('pierce', 'double', 'time', 'backdash', 'shield');
  return [...relevant];
}

function randomAbilityOptions(
  exclude?: string[],
  enabledIds?: Set<string>,
  cooldowns?: Record<string, number>,
  enemies: GameState['enemies'] = [],
  hp = 5,
): string[] {
  const source = enabledIds
    ? ABILITY_POOL.filter((a) => enabledIds.has(a.id))
    : ABILITY_POOL;
  const pool = [...(source.length > 0 ? source : ABILITY_POOL)];
  const categoryIds: Record<AbilityCategory, string[]> = {
    offense: pool.filter((ability) => OFFENSE_ABILITY_IDS.has(ability.id)).map((ability) => ability.id),
    control: pool.filter((ability) => CONTROL_ABILITY_IDS.has(ability.id)).map((ability) => ability.id),
    wildcard: pool.filter((ability) =>
      !OFFENSE_ABILITY_IDS.has(ability.id) && !CONTROL_ABILITY_IDS.has(ability.id)).map((ability) => ability.id),
  };
  const used = new Set<string>();
  const previous = new Set(exclude ?? previousAbilityHand);
  const opts: string[] = [];

  const draw = (category: AbilityCategory) => {
    const eligible = categoryIds[category].length > 0
      ? categoryIds[category]
      : pool.map((ability) => ability.id);
    const eligibleSet = new Set(eligible);
    abilityBags[category] = abilityBags[category]
      .filter((id) => eligibleSet.has(id) && !used.has(id));
    if (abilityBags[category].length === 0) {
      abilityBags[category] = shuffleIds(eligible.filter((id) => !used.has(id)));
    }

    const ready = (id: string) => (cooldowns?.[id] ?? 0) <= 0;
    let index = abilityBags[category].findIndex((id) =>
      !used.has(id) && !previous.has(id) && ready(id));
    if (index < 0) index = abilityBags[category].findIndex((id) => !used.has(id) && ready(id));
    if (index < 0) index = abilityBags[category].findIndex((id) => !used.has(id) && !previous.has(id));
    if (index < 0) index = abilityBags[category].findIndex((id) => !used.has(id));
    if (index >= 0) {
      const [selected] = abilityBags[category].splice(index, 1);
      used.add(selected);
      opts.push(selected);
    }
  };

  draw('offense');
  draw('control');
  draw('wildcard');
  while (opts.length < Math.min(3, pool.length)) {
    const fallback = pool.find((ability) =>
      !used.has(ability.id) && (cooldowns?.[ability.id] ?? 0) <= 0)
      ?? pool.find((ability) => !used.has(ability.id));
    if (!fallback) break;
    used.add(fallback.id);
    opts.push(fallback.id);
  }

  const relevant = relevantAbilityIds(enemies, hp).filter((id) =>
    pool.some((ability) => ability.id === id) && (cooldowns?.[id] ?? 0) <= 0);
  if (relevant.length > 0 && !opts.some((id) => relevant.includes(id))) {
    const replacement = relevant.find((id) => !used.has(id) && !previous.has(id))
      ?? relevant.find((id) => !used.has(id))
      ?? relevant[0];
    if (replacement) opts[Math.min(2, opts.length - 1)] = replacement;
  }
  previousAbilityHand = [...opts];
  return opts;
}

function makeInitialState(enabledIds?: Set<string>, mode: GameMode = 'classic'): GameState {
  return {
    running: true,
    score: 0,
    wave: 1,
    hp: 5,
    timer: 0,
    enemySpawnTimer: 0.4,
    directorRecoveryTimer: 0,
    directorCritical: false,
    nextUpgradeWave: 5,
    upgradePromptOpen: false,
    upgradePromptTimer: 0,
    upgradeRetryWave: 0,
    upgradeSelectionOpen: false,
    upgradeOptions: [],
    runUpgrades: {},
    shotsFired: 0,
    enemyFormationId: 0,
    lanePressure: [0, 0, 0],
    ecosystemStats: {
      entitySignatures: [],
      mutationDiscoveries: 0,
      maxGeneration: 0,
      totalFusions: 0,
    },
    recentBaseElements: [],
    recentBodyClasses: [],
    recentElementDomains: [],
    moveFlash: 0,
    slowTimer: 0,
    overclockTimer: 0,
    freezeTimer: 0,
    blizzardTimer: 0,
    doubleTimer: 0,
    multishotTimer: 0,
    regenTimer: 0,
    regenTick: 0,
    drainTimer: 0,
    voltageTimer: 0,
    ghostTimer: 0,
    turretTimer: 0,
    echoTimer: 0,
    overdriveTimer: 0,
    pulseTimer: 0,
    pulseTick: 1.5,
    overloadTimer: 0,
    magnetTimer: 0,
    berserkTimer: 0,
    critTimer: 0,
    signalJamTimer: 0,
    stasisGateTimer: 0,
    adaptiveAmmoTimer: 0,
    cardTimer: 0,
    cardsReady: false,
    cardSelectionOpen: false,
    rotateUsedThisHand: false,
    usedInHand: [],
    player: { col: 1, row: 1, fireCooldown: 0 },
    bullets: [],
    enemies: [],
    particles: [],
    autoBuster: true,
    shieldCharges: 0,
    pierceShots: 0,
    abilityCooldowns: Object.fromEntries(ABILITY_POOL.map((a) => [a.id, 0])),
    currentCardOptions: randomAbilityOptions(undefined, enabledIds),
    // VS mode
    gameMode: mode,
    npc: { col: 1, row: 1, fireCooldown: 0, moveCooldown: 0, hp: NPC_HP, shieldCharges: 0 },
    npcBullets: [],
    npcEnemies: [],
    playerWon: false,
  };
}

interface HudData {
  hp: number;
  score: number;
  wave: number;
  autoBuster: boolean;
  shieldCharges: number;
  cardsReady: boolean;
  cardSelectionOpen: boolean;
  rotateUsedThisHand: boolean;
  cardTimer: number;
  cardOptions: string[];
  usedInHand: string[];
  abilityCooldowns: Record<string, number>;
  running: boolean;
  message: string;
  // VS mode
  gameMode: GameMode;
  npcHp: number;
  npcShieldCharges: number;
  playerWon: boolean;
  pressureState: 'steady' | 'critical' | 'recovery';
  upgradePromptOpen: boolean;
  upgradePromptTimer: number;
  upgradeSelectionOpen: boolean;
  upgradeOptions: string[];
  runUpgrades: Record<string, number>;
  ecosystem: { species: number; mutations: number; generation: number; fusions: number };
}

type CloneDirection = 'north' | 'south';
type CloneStatus = 'idle' | 'attacking' | 'defending' | 'dispersing' | 'gone';
interface CloneView {
  visible: boolean;
  revealed: boolean;
  inputActive: boolean;
  playerLocked: boolean;
  controlled: CloneDirection;
  turn: 0 | 1;
  statuses: Record<CloneDirection, CloneStatus>;
  rows: Record<CloneDirection, number | null>;
}

const emptyCloneView = (): CloneView => ({
  visible: false,
  revealed: false,
  inputActive: false,
  playerLocked: false,
  controlled: 'north',
  turn: 0,
  statuses: { north: 'gone', south: 'gone' },
  rows: { north: null, south: null },
});

export default function Game() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<GameState>(makeInitialState());
  const animRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  // Input state (refs — no re-render needed)
  const keyboardRef = useRef({ up: false, down: false, left: false, right: false });
  const touchDpadRef = useRef({ up: false, down: false, left: false, right: false });
  const gamepadRef = useRef({
    moveX: 0, moveY: 0, prevMoveX: 0,
    fire: false, prevFire: false,
    cardX: false, prevCardX: false,   // button 2 → card slot 0
    cardY: false, prevCardY: false,   // button 3 → card slot 1
    cardB: false, prevCardB: false,   // button 1 → card slot 2
    rotate: false, prevRotate: false, // button 8/17 → rotate hand
    start: false, prevStart: false,   // button 9 → pause
    l1: false, prevL1: false,         // button 4 → combo modifier
    skill: false, prevSkill: false,   // button 6 / L2 → skill animation
    r1: false, prevR1: false,         // button 5 → evolution prompt
    connected: false,
  });
  const controllerCooldownRef = useRef(0);
  const fireHeldRef = useRef(false);

  // Message system
  const msgFadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Throttle HUD updates: only push cooldown state once per second
  const hudTickRef = useRef<number>(0);
  // Direct DOM refs for smooth per-frame bar + label updates (no React setState)
  const cardBarFillRef = useRef<HTMLDivElement>(null);
  const cardLabelRef = useRef<HTMLDivElement>(null);
  const skillNorthFxRef = useRef<HTMLDivElement>(null);
  const skillSouthFxRef = useRef<HTMLDivElement>(null);
  const skillPlayerFxRef = useRef<HTMLDivElement>(null);
  const skillFxTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cloneNorthRef = useRef<HTMLDivElement>(null);
  const cloneSouthRef = useRef<HTMLDivElement>(null);
  const cloneActionTimersRef = useRef<Record<CloneDirection, ReturnType<typeof setTimeout> | null>>({
    north: null,
    south: null,
  });
  const cloneSessionRef = useRef<CloneView>(emptyCloneView());

  const [phase, setPhase] = useState<'menu' | 'playing'>('menu');
  const phaseRef = useRef<'menu' | 'playing'>('menu');
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  const [menuScreen, setMenuScreen] = useState<'main' | 'customization' | 'bestiary' | 'options'>('main');
  const menuScreenRef = useRef<'main' | 'customization' | 'bestiary' | 'options'>('main');
  const [menuSelection, setMenuSelection] = useState(0);
  const menuSelectionRef = useRef(0);
  const [pauseSelection, setPauseSelection] = useState(0);
  const pauseSelectionRef = useRef(0);
  const [upgradeSelection, setUpgradeSelection] = useState(0);
  const upgradeSelectionRef = useRef(0);
  const [bestiarySelection, setBestiarySelection] = useState(0);
  const bestiarySelectionRef = useRef(0);
  const menuNavCooldownRef = useRef(0);
  const [pauseBestiary, setPauseBestiary] = useState(false);
  const pauseBestiaryRef = useRef(false);
  const [pauseOptions, setPauseOptions] = useState(false);
  const pauseOptionsRef = useRef(false);
  const [virtualDpadEnabled, setVirtualDpadEnabled] = useState(
    () => localStorage.getItem(VIRTUAL_DPAD_KEY) !== 'off',
  );
  const [skillFxRun, setSkillFxRun] = useState(0);
  const [skillFxActive, setSkillFxActive] = useState(false);
  const [cloneView, setCloneView] = useState<CloneView>(emptyCloneView);
  const [bestiaryEntries, setBestiaryEntries] = useState<BestiaryEntry[]>(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(BESTIARY_KEY) ?? '[]');
      return Array.isArray(stored) ? stored.slice(0, 160) : [];
    } catch {
      return [];
    }
  });
  const bestiaryRef = useRef<BestiaryEntry[]>(bestiaryEntries);
  const recordBestiary = useCallback((seed: number, genome: EnemyGenome) => {
    const signature = [
      genome.baseElement, genome.element, genome.entityType, genome.enemyClass,
      genome.fusionElement ?? 'pure', genome.niche,
      [...genome.mutations].sort().join('+') || 'baseline',
      `fusion-${genome.fusionLevel}`,
    ].join(':');
    if (bestiaryRef.current.some((entry) => entry.signature === signature)) return;
    const entry: BestiaryEntry = {
      signature,
      seed,
      genome: { ...genome, mutations: [...genome.mutations] },
      discoveredAt: Date.now(),
    };
    bestiaryRef.current = [entry, ...bestiaryRef.current].slice(0, 160);
    localStorage.setItem(BESTIARY_KEY, JSON.stringify(bestiaryRef.current));
    setBestiaryEntries(bestiaryRef.current);
  }, []);

  // Player skin
  type PlayerSkin = 'default' | 'rocket' | 'dots' | 'gem';
  const SKIN_KEY = 'cgs_player_skin';
  const savedSkin = (localStorage.getItem(SKIN_KEY) ?? 'default') as PlayerSkin;
  const [playerSkin, setPlayerSkin] = useState<PlayerSkin>(savedSkin);
  const playerSkinRef = useRef<PlayerSkin>(savedSkin);
  // DOM sprite overlay refs (rocket skin in-game)
  const spriteWrapRef   = useRef<HTMLDivElement | null>(null);
  const spriteCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Rocket skin frames (static pre-transparified PNGs):
  //   0 = idle  |  1 = shoot pose  |  2 = post-shoot A  |  3 = post-shoot B
  const gifFramesRef       = useRef<ImageBitmap[]>([]);
  const rocketFrameRef     = useRef(0);
  const rocketAnimTimer    = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Gem skin — separate attack frames; -1 = idle, 0–2 = attack sequence
  const gifAttackFramesRef = useRef<ImageBitmap[]>([]);
  const gemAttackFrameRef  = useRef(-1);
  const gemAttackTimer     = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Gem skin — move frames; gemMoveStartRef = performance.now() timestamp when move began, -1 = idle
  const gifMoveFramesRef   = useRef<ImageBitmap[]>([]);
  const gemMoveStartRef    = useRef(-1);
  const gemMoveTimer       = useRef<ReturnType<typeof setTimeout> | null>(null);
  const GEM_MOVE_FRAME_MS  = 75;  // ms per move frame
  // true = mirror sprite horizontally (left move, parallel to gun axis)
  const gemMoveMirrorRef   = useRef(true);
  const eloAttackDirectionRef = useRef<1 | -1>(1);

  // State machine driven entirely by timeouts — no React state, no re-renders.
  // rocketFrameRef: -1 = idle (show gifFramesRef[0]), 0–N = attack frame index into gifAttackFramesRef.
  // If already animating, ignore the new shot — let the current sequence finish.
  // Start at ROCKET_ATTACK_START to skip the opening frames that look identical to idle.
  const ROCKET_ATTACK_START = 3; // first visually distinct frame
  const rocketShootFlash = useCallback(() => {
    const attackFrames = gifAttackFramesRef.current;
    if (attackFrames.length < 1) return;
    if (rocketFrameRef.current >= 0) return;             // already animating, don't restart
    if (rocketAnimTimer.current) clearTimeout(rocketAnimTimer.current);
    const FRAME_MS = 100; // ms per attack frame
    const playFrom = (idx: number) => {
      rocketFrameRef.current = idx;
      if (idx < attackFrames.length - 1) {
        rocketAnimTimer.current = setTimeout(() => playFrom(idx + 1), FRAME_MS);
      } else {
        rocketAnimTimer.current = setTimeout(() => {
          rocketFrameRef.current = -1;                   // back to idle
        }, FRAME_MS);
      }
    };
    playFrom(ROCKET_ATTACK_START);
  }, []);

  // Gem move: plays all move frames once then returns to idle. Any new move restarts.
  const gemMoveFlash = useCallback(() => {
    if (gifMoveFramesRef.current.length < 1) return;
    gemMoveStartRef.current = performance.now();
    if (gemMoveTimer.current) clearTimeout(gemMoveTimer.current);
    const total = gifMoveFramesRef.current.length * GEM_MOVE_FRAME_MS;
    gemMoveTimer.current = setTimeout(() => {
      gemMoveStartRef.current = -1;
    }, total);
  }, []);

  // Gem attack: frame 0 → 1 → 2 → back to idle (-1). Any new shot restarts.
  const gemShootFlash = useCallback(() => {
    if (gifAttackFramesRef.current.length < 1) return;
    gemAttackFrameRef.current = 0;
    if (gemAttackTimer.current) clearTimeout(gemAttackTimer.current);
    gemAttackTimer.current = setTimeout(() => {
      gemAttackFrameRef.current = 1;
      gemAttackTimer.current = setTimeout(() => {
        gemAttackFrameRef.current = 2;
        gemAttackTimer.current = setTimeout(() => {
          gemAttackFrameRef.current = -1;               // back to idle
        }, 150);
      }, 150);
    }, 150);
  }, []);

  // Load pre-transparified PNG frames when a sprite skin is selected.
  useEffect(() => {
    if (playerSkin !== 'rocket' && playerSkin !== 'dots' && playerSkin !== 'gem') return;
    const base = import.meta.env.BASE_URL;
    const loadBmp = (url: string): Promise<ImageBitmap> =>
      new Promise((resolve, reject) => {
        const img = new Image();
        img.onload  = () => createImageBitmap(img).then(resolve).catch(reject);
        img.onerror = () => reject(new Error(`Failed to load ${url}`));
        img.src = url;
      });

    // Load rocket attack frames into gifAttackFramesRef
    if (playerSkin === 'rocket') {
      Promise.all(Array.from({ length: 13 }, (_, i) => loadBmp(`${base}skins/rocket_attack_frame_${i}.png`)))
        .then(bitmaps => { gifAttackFramesRef.current = bitmaps; })
        .catch(err => console.error('[rocket attack] frame load error:', err));
    }

    // Also load gem attack + move frames whenever gem is selected
    if (playerSkin === 'gem') {
      Promise.all([0,1,2].map(i => loadBmp(`${base}skins/gem_attack_frame_${i}.png`)))
        .then(bitmaps => { gifAttackFramesRef.current = bitmaps; })
        .catch(err => console.error('[gem attack] frame load error:', err));
      Promise.all(Array.from({ length: 18 }, (_, i) => loadBmp(`${base}skins/gem_move_frame_${i}.png`)))
        .then(bitmaps => { gifMoveFramesRef.current = bitmaps; })
        .catch(err => console.error('[gem move] frame load error:', err));
    }

    let cancelled = false;

    const loadBitmap = (url: string): Promise<ImageBitmap> =>
      new Promise((resolve, reject) => {
        const img = new Image();
        img.onload  = () => createImageBitmap(img).then(resolve).catch(reject);
        img.onerror = () => reject(new Error(`Failed to load ${url}`));
        img.src = url;
      });

    (async () => {
      try {
        const base = import.meta.env.BASE_URL;
        const urls = playerSkin === 'rocket'
          ? [`${base}skins/rocket_idle.png`]
          : playerSkin === 'dots'
          ? [
              `${base}skins/dots_frame_0.png`,
              `${base}skins/dots_frame_1.png`,
              `${base}skins/dots_frame_2.png`,
              `${base}skins/dots_frame_3.png`,
              `${base}skins/dots_frame_4.png`,
            ]
          : /* gem */ Array.from({ length: 12 }, (_, i) => `${base}skins/gem_frame_${i}.png`);
        const bitmaps = await Promise.all(urls.map(loadBitmap));
        if (cancelled) { bitmaps.forEach(b => b.close()); return; }
        gifFramesRef.current = bitmaps;
        rocketFrameRef.current = -1; // -1 = idle
      } catch (err) {
        console.error(`[${playerSkin} skin] frame load error:`, err);
      }
    })();

    return () => {
      cancelled = true;
      if (rocketAnimTimer.current) clearTimeout(rocketAnimTimer.current);
      if (gemAttackTimer.current) clearTimeout(gemAttackTimer.current);
      if (gemMoveTimer.current) clearTimeout(gemMoveTimer.current);
      gifFramesRef.current.forEach(b => b.close());
      gifFramesRef.current = [];
      gifAttackFramesRef.current.forEach(b => b.close());
      gifAttackFramesRef.current = [];
      gifMoveFramesRef.current.forEach(b => b.close());
      gifMoveFramesRef.current = [];
      rocketFrameRef.current = -1;
      gemAttackFrameRef.current = -1;
      gemMoveStartRef.current = -1;
    };
  }, [playerSkin]);

  // ── Blockchain reward state ───────────────────────────────────────────────
  const rewardAccRef = useRef<RewardAccumulator>(new RewardAccumulator());
  const [sessionCGRD, setSessionCGRD] = useState(0);
  const [gameKills,   setGameKills]   = useState<KillRecord[]>([]);

  const [enabledAbilities, setEnabledAbilities] = useState<Set<string>>(ALL_ABILITY_IDS);
  const enabledAbilitiesRef = useRef<Set<string>>(ALL_ABILITY_IDS);

  const [boardBottom, setBoardBottom] = useState(0);

  const [hud, setHud] = useState<HudData>({
    hp: 5, score: 0, wave: 1, autoBuster: true, shieldCharges: 0,
    cardsReady: false, cardSelectionOpen: false, rotateUsedThisHand: false, cardTimer: 0,
    cardOptions: [], usedInHand: [], abilityCooldowns: {}, running: true,
    message: 'Tap blue panels to move. Use BUSTER button to fire manually.',
    gameMode: 'classic', npcHp: NPC_HP, npcShieldCharges: 0, playerWon: false,
    pressureState: 'steady',
    upgradePromptOpen: false,
    upgradePromptTimer: 0,
    upgradeSelectionOpen: false,
    upgradeOptions: [],
    runUpgrades: {},
    ecosystem: { species: 0, mutations: 0, generation: 0, fusions: 0 },
  });

  const updateHud = useCallback(() => {
    const s = stateRef.current;
    setHud((prev) => ({
      ...prev,
      hp: s.hp,
      score: s.score,
      wave: s.wave,
      autoBuster: s.autoBuster,
      shieldCharges: s.shieldCharges,
      cardsReady: s.cardsReady,
      cardSelectionOpen: s.cardSelectionOpen,
      rotateUsedThisHand: s.rotateUsedThisHand,
      cardTimer: s.cardTimer,
      cardOptions: [...s.currentCardOptions],
      usedInHand: [...s.usedInHand],
      abilityCooldowns: { ...s.abilityCooldowns },
      running: s.running,
      gameMode: s.gameMode,
      npcHp: s.npc.hp,
      npcShieldCharges: s.npc.shieldCharges,
      playerWon: s.playerWon,
      pressureState: s.directorRecoveryTimer > 0
        ? 'recovery'
        : s.directorCritical ? 'critical' : 'steady',
      upgradePromptOpen: s.upgradePromptOpen,
      upgradePromptTimer: s.upgradePromptTimer,
      upgradeSelectionOpen: s.upgradeSelectionOpen,
      upgradeOptions: [...s.upgradeOptions],
      runUpgrades: { ...s.runUpgrades },
      ecosystem: {
        species: s.ecosystemStats.entitySignatures.length,
        mutations: s.ecosystemStats.mutationDiscoveries,
        generation: s.ecosystemStats.maxGeneration,
        fusions: s.ecosystemStats.totalFusions,
      },
    }));
  }, []);

  const showMessage = useCallback((text: string, duration: number | false = 2000) => {
    if (msgFadeTimerRef.current) clearTimeout(msgFadeTimerRef.current);
    setHud((prev) => ({ ...prev, message: text }));
    if (duration !== false) {
      msgFadeTimerRef.current = setTimeout(() => {
        setHud((prev) => ({ ...prev, message: '' }));
      }, duration);
    }
  }, []);

  const addParticles = useCallback((x: number, y: number, color: string) => {
    const s = stateRef.current;
    for (let i = 0; i < 10; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 30 + Math.random() * 90;
      s.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.35 + Math.random() * 0.25, maxLife: 0.6, color });
    }
  }, []);

  const fireBullet = useCallback((rowOverride?: number, opts?: { power?: number; big?: boolean; pierce?: boolean }) => {
    const s = stateRef.current;
    const row = rowOverride !== undefined ? rowOverride : s.player.row;
    let power = opts?.power ?? 1;
    let big = opts?.big ?? false;
    let pierce = opts?.pierce ?? false;
    s.shotsFired++;
    const phaseLevel = s.runUpgrades.phaseRounds ?? 0;
    const phaseInterval = Math.max(3, 6 - phaseLevel);
    if (phaseLevel > 0 && s.shotsFired % phaseInterval === 0) pierce = true;
    const denseLevel = s.runUpgrades.denseCharge ?? 0;
    if (denseLevel > 0 && s.shotsFired % 4 === 0) power += denseLevel;
    if (s.voltageTimer > 0) { big = true; pierce = true; }
    if (s.doubleTimer > 0) power *= 2;
    if (!pierce && s.pierceShots > 0) {
      pierce = true;
      s.pierceShots = Math.max(0, s.pierceShots - 1);
    }
    if (s.critTimer > 0 && Math.random() < 0.4) power *= 3;
    const direction = playerSkinRef.current === 'gem' ? eloAttackDirectionRef.current : 1;
    s.bullets.push({
      colPos: s.player.col + direction * 0.55,
      row,
      speed: direction * 8.5,
      power,
      big,
      pierce,
    });
    if (s.echoTimer > 0) {
      const echoRow = (row + 1) % 3;
      s.bullets.push({
        colPos: s.player.col + direction * 0.55,
        row: echoRow,
        speed: direction * 8.5,
        power: Math.max(1, power - 1),
        big: false,
        pierce: false,
      });
    }
    playShot();
    if (playerSkinRef.current === 'rocket') rocketShootFlash();
    if (playerSkinRef.current === 'gem') gemShootFlash();
  }, [rocketShootFlash, gemShootFlash]);

  const tryMoveTo = useCallback((col: number, row: number) => {
    const s = stateRef.current;
    if (!s.running) return;
    if (col < 0 || col > 2 || row < 0 || row > 2) return;
    // Player retains facing even while moving backward.
    s.player.col = col;
    s.player.row = row;
    s.moveFlash = 0.15;
    playMove();
    updateHud();
    if (playerSkinRef.current === 'gem') gemMoveFlash();
  }, [updateHud, gemMoveFlash]);

  const manualBuster = useCallback(() => {
    const s = stateRef.current;
    if (!s.running) return;
    if (s.player.fireCooldown <= 0) {
      fireBullet();
      if (s.multishotTimer > 0) fireBullet((s.player.row + 1) % 3);
      if (s.turretTimer > 0) {
        for (let r = 0; r < 3; r++) { if (r !== s.player.row) fireBullet(r); }
      }
      const rapidScale = 1 + (s.runUpgrades.rapidBuster ?? 0) * 0.1;
      s.player.fireCooldown = (s.berserkTimer > 0 ? 0.09 : s.overclockTimer > 0 ? 0.16 : 0.25) / rapidScale;
    }
  }, [fireBullet]);

  const endGame = useCallback((won = false) => {
    const s = stateRef.current;
    if (!s.running) return;
    s.running = false;
    s.playerWon = won;
    stopMusic();
    if (won) {
      showMessage('SYSTEM OVERRIDE — NPC neutralised!', false);
    } else {
      playGameOver();
      showMessage('CONNECTION LOST — tap Play Again to restart.', false);
    }
    // Capture final kills for blockchain claim
    setGameKills([...rewardAccRef.current.killList]);
    updateHud();
  }, [showMessage, updateHud]);

  const useCard = useCallback((type: string) => {
    const s = stateRef.current;
    if (!s.running || !s.cardsReady) return;
    const ability = ABILITY_LOOKUP[type];
    if (!ability) return;
    // Already used this hand or on cooldown — do nothing
    if (s.usedInHand.includes(type)) return;
    if ((s.abilityCooldowns[type] ?? 0) > 0) return;

    const canvas = canvasRef.current;
    const m = canvas ? getBoardMetrics(canvas.offsetWidth, canvas.offsetHeight) : null;
    const living = () => s.enemies.filter((enemy) => enemy.colPos > -1);
    const strike = (
      predicate: (enemy: GameState['enemies'][number]) => boolean,
      damage: number,
      push = 0,
    ) => {
      let hits = 0;
      for (const enemy of living()) {
        if (!predicate(enemy)) continue;
        enemy.hp -= damage;
        enemy.colPos = Math.min(5.8, enemy.colPos + push);
        enemy.flash = 0.16;
        hits++;
        if (enemy.hp <= 0) {
          enemy.colPos = -9;
          s.score += 100;
        }
      }
      return hits;
    };

    // ── Existing ────────────────────────────────────────────────────────────
    if (type === 'shotgun') {
      for (let ro = -1; ro <= 1; ro++) {
        const tr = s.player.row + ro;
        if (tr >= 0 && tr < 3) fireBullet(tr, { power: 2, big: true });
      }
      showMessage('Shotgun blasted 3 rows!', 1500);
    } else if (type === 'heal') {
      s.hp = s.hp + 2;
      if (m) addParticles(m.x + (s.player.col + 0.5) * m.cell, m.y + (s.player.row + 0.5) * m.cell, '#86efac');
      showMessage('Recover restored 2 HP!', 1500);
    } else if (type === 'time') {
      s.slowTimer = 6;
      showMessage('Time Slow — viruses at 45% speed!', 1500);
    } else if (type === 'pierce') {
      s.pierceShots = Math.max(s.pierceShots, 1);
      showMessage('Pierce loaded — next shot punches through!', 1500);
    } else if (type === 'bomb') {
      const targetRow = s.player.row;
      let hits = 0;
      for (const enemy of s.enemies) {
        if (enemy.row === targetRow) {
          enemy.hp -= 2;
          enemy.flash = 0.12;
          if (enemy.hp <= 0 && m) {
            addParticles(m.x + (enemy.colPos + 0.5) * m.cell, m.y + (enemy.row + 0.5) * m.cell, '#fde047');
            enemy.colPos = -9;
            s.score += 100;
            if (s.drainTimer > 0) s.hp++;
            hits++;
          }
        }
      }
      if (hits > 0) { if (s.score % 500 === 0) s.wave++; playScore(); }
      showMessage('Grid Bomb detonated your row!', 1500);
    } else if (type === 'shield') {
      s.shieldCharges = Math.min(3, s.shieldCharges + 1);
      showMessage('Shield charged — next hit blocked!', 1500);
    } else if (type === 'overclock') {
      s.overclockTimer = 6;
      showMessage('Overclock — double fire rate for 6s!', 1500);
    } else if (type === 'mirror') {
      for (let row = 0; row < 3; row++) fireBullet(row, { power: 1, big: true });
      showMessage('Mirror — one big shot on every lane!', 1500);
    } else if (type === 'scramble') {
      for (const enemy of s.enemies) {
        const movement = movementClassOf(enemy);
        const push = movement && HEAVY_CLASSES.has(movement) ? 0.35 : movement && AIR_CLASSES.has(movement) ? 1.05 : 0.8;
        enemy.colPos = Math.min(5.8, enemy.colPos + push);
        enemy.formationId = undefined;
        enemy.flash = 0.1;
      }
      showMessage('Scramble knocked viruses back!', 1500);

    // ── Instant / no new state ──────────────────────────────────────────────
    } else if (type === 'nuke') {
      let kills = 0;
      for (const enemy of s.enemies) {
        if (m) addParticles(m.x + (enemy.colPos + 0.5) * m.cell, m.y + (enemy.row + 0.5) * m.cell, '#f87171');
        enemy.colPos = -9;
        s.score += 100;
        if (s.drainTimer > 0) s.hp++;
        kills++;
      }
      if (kills > 0) { if (s.score % 500 === 0) s.wave++; playScore(); updateHud(); }
      showMessage('NUKE — all viruses wiped!', 1500);
    } else if (type === 'barrage') {
      for (let i = 0; i < 3; i++) fireBullet(undefined, { power: 2, big: true, pierce: true });
      showMessage('Barrage — 3 piercing shots on your row!', 1500);
    } else if (type === 'warpback') {
      for (const enemy of s.enemies) { enemy.colPos = 5.6; enemy.flash = 0.15; }
      showMessage('Warp Back — all viruses sent to the edge!', 1500);
    } else if (type === 'purge') {
      let kills = 0;
      for (const enemy of s.enemies) {
        if (enemy.hp <= 1 || (enemy.genome?.fusionLevel ?? 0) > 0 || (enemy.genome?.mutations.length ?? 0) >= 4) {
          if (m) addParticles(m.x + (enemy.colPos + 0.5) * m.cell, m.y + (enemy.row + 0.5) * m.cell, '#c4b5fd');
          enemy.colPos = -9;
          s.score += 100;
          if (s.drainTimer > 0) s.hp++;
          kills++;
        }
      }
      if (kills > 0) { if (s.score % 500 === 0) s.wave++; playScore(); updateHud(); }
      showMessage(`Purge erased ${kills} weakened virus${kills !== 1 ? 'es' : ''}!`, 1500);
    } else if (type === 'armor') {
      s.shieldCharges = Math.min(s.shieldCharges + 3, 9);
      showMessage('Armor — 3 shield charges granted!', 1500);
    } else if (type === 'surge') {
      for (let row = 0; row < 3; row++) fireBullet(row, { power: 2, pierce: true });
      showMessage('Surge — piercing shot on all 3 lanes!', 1500);
    } else if (type === 'backdash') {
      for (const enemy of s.enemies) { enemy.colPos = Math.min(5.8, enemy.colPos + 2.0); enemy.flash = 0.1; }
      showMessage('Backdash pushed viruses back 2 cells!', 1500);
    } else if (type === 'megabomb') {
      let kills = 0;
      for (const enemy of s.enemies) {
        if (m) {
          addParticles(m.x + (enemy.colPos + 0.5) * m.cell, m.y + (enemy.row + 0.5) * m.cell, '#fde047');
          addParticles(m.x + (enemy.colPos + 0.5) * m.cell, m.y + (enemy.row + 0.5) * m.cell, '#fb923c');
        }
        enemy.colPos = -9;
        s.score += 200;
        if (s.drainTimer > 0) s.hp++;
        kills++;
      }
      if (kills > 0) { if (s.score % 500 === 0) s.wave++; playScore(); updateHud(); }
      showMessage(`MEGABOMB — ${kills} virus${kills !== 1 ? 'es' : ''} destroyed, double score!`, 1800);
    } else if (type === 'cardflood') {
      // Give a brand-new hand immediately — reroll until at least one card is usable
      let nextOptions = randomAbilityOptions(
        s.currentCardOptions,
        enabledAbilitiesRef.current,
        s.abilityCooldowns,
        s.enemies,
        s.hp,
      );
      for (let g = 0; g < 12 && nextOptions.every((id) => (s.abilityCooldowns[id] ?? 0) > 0); g++) {
        nextOptions = randomAbilityOptions(
          nextOptions,
          enabledAbilitiesRef.current,
          s.abilityCooldowns,
          s.enemies,
          s.hp,
        );
      }
      s.currentCardOptions = nextOptions;
      s.usedInHand = [];
      s.cardsReady = true;
      s.cardSelectionOpen = true;
      s.rotateUsedThisHand = false;
      s.cardTimer = CARD_CHARGE_TIME;
      playAbility(type);
      s.abilityCooldowns[type] = ability.cooldown;
      updateHud();
      showMessage('Card Flood — new hand dealt instantly!', 1500);
      return; // skip standard mark-used below

    // ── Timer-based ─────────────────────────────────────────────────────────
    } else if (type === 'freeze') {
      s.freezeTimer = 4;
      showMessage('Freeze — all viruses reduced to a crawl for 4s!', 1500);
    } else if (type === 'blizzard') {
      s.blizzardTimer = 10;
      showMessage('Blizzard — extreme slowdown for 10s!', 1500);
    } else if (type === 'double') {
      s.doubleTimer = 6;
      showMessage('Doubletap — double damage for 6s!', 1500);
    } else if (type === 'multishot') {
      s.multishotTimer = 5;
      showMessage('Multishot — extra bullet per trigger for 5s!', 1500);
    } else if (type === 'regen') {
      s.regenTimer = 12;
      s.regenTick = 3;
      showMessage('Regen — restoring 1 HP every 3s for 12s!', 1500);
    } else if (type === 'drain') {
      s.drainTimer = 8;
      showMessage('Leech — kills restore HP for 8s!', 1500);
    } else if (type === 'voltage') {
      s.voltageTimer = 5;
      showMessage('Voltage — big piercing bullets for 5s!', 1500);

    // ── New instant abilities ──────────────────────────────────────────────
    } else if (type === 'emp') {
      let hit = 0;
      for (const e of s.enemies) {
        if (isCyberEnemy(e)) {
          e.hp = Math.max(1, e.hp - 3);
          e.flash = 0.12;
          hit++;
        }
      }
      s.signalJamTimer = Math.max(s.signalJamTimer, 4);
      showMessage(`EMP disabled ${hit} cyber entit${hit === 1 ? 'y' : 'ies'}!`, 1500);

    } else if (type === 'snipe') {
      s.bullets.push({ colPos: s.player.col + 0.55, row: s.player.row, speed: 16, power: 5, big: true, pierce: true });
      playShot();
      showMessage('Sniper — power-5 mega-shot fired!', 1200);

    } else if (type === 'gravity') {
      for (const e of s.enemies) {
        const movement = movementClassOf(e);
        if (!movement || !HEAVY_CLASSES.has(movement)) e.row = s.player.row;
        if (movement && AIR_CLASSES.has(movement)) e.colPos = Math.min(5.8, e.colPos + 0.9);
        e.flash = 0.12;
      }
      showMessage('Gravity — all viruses pulled to your row!', 1500);

    } else if (type === 'chain') {
      const sorted = [...s.enemies].filter(e => e.colPos > -1).sort((a, b) => a.colPos - b.colPos);
      if (sorted.length > 0) {
        const chainHp = sorted[0].hp;
        let kills = 0;
        for (const e of s.enemies) {
          if (e.hp === chainHp && e.colPos > -1) {
            if (m) addParticles(m.x + (e.colPos + 0.5) * m.cell, m.y + (e.row + 0.5) * m.cell, '#fde047');
            e.colPos = -9;
            s.score += 100;
            if (s.drainTimer > 0) s.hp++;
            kills++;
          }
        }
        if (kills > 0) { if (s.score % 500 === 0) s.wave++; playScore(); updateHud(); }
        showMessage(`Chain Kill — ${kills} virus${kills !== 1 ? 'es' : ''} destroyed!`, 1500);
      } else {
        showMessage('No viruses to chain!', 1000);
      }

    } else if (type === 'cluster') {
      const targets = [...s.enemies].filter(e => e.colPos > -1).sort((a, b) => a.colPos - b.colPos).slice(0, 3);
      let kills = 0;
      for (const e of targets) {
        if (m) addParticles(m.x + (e.colPos + 0.5) * m.cell, m.y + (e.row + 0.5) * m.cell, '#fb923c');
        e.colPos = -9;
        s.score += 100;
        if (s.drainTimer > 0) s.hp++;
        kills++;
      }
      if (kills > 0) { if (s.score % 500 === 0) s.wave++; playScore(); updateHud(); }
      showMessage(`Cluster — ${kills} most-advanced virus${kills !== 1 ? 'es' : ''} eliminated!`, 1500);

    } else if (type === 'rowshuffle') {
      for (const e of s.enemies) {
        const movement = movementClassOf(e);
        if (movement !== 'rooted' && movement !== 'fortress') e.row = Math.floor(Math.random() * 3);
        e.flash = 0.1;
      }
      showMessage('Row Chaos — viruses scrambled to random rows!', 1500);

    // ── New timer-based abilities ──────────────────────────────────────────
    } else if (type === 'ghost') {
      s.ghostTimer = 4;
      if (m) addParticles(m.x + (s.player.col + 0.5) * m.cell, m.y + (s.player.row + 0.5) * m.cell, '#e0f2fe');
      showMessage('Ghost Mode — invincible for 4s!', 1500);

    } else if (type === 'turret') {
      s.turretTimer = 5;
      showMessage('Turret — auto-firing all 3 rows for 5s!', 1500);

    } else if (type === 'echo') {
      s.echoTimer = 5;
      showMessage('Echo Shot — each bullet clones to adjacent row for 5s!', 1500);

    } else if (type === 'overdrive') {
      s.overdriveTimer = 4;
      showMessage('Overdrive — 2.5× virus speed, 3× score for 4s!', 1500);

    } else if (type === 'pulse') {
      s.pulseTimer = 7;
      s.pulseTick = 0.1; // fire first pulse almost immediately
      showMessage('Pulse Wave — repulse shockwaves every 1.5s for 7s!', 1500);

    } else if (type === 'overload') {
      s.overloadTimer = 6;
      showMessage('Overload — each kill fires a bullet in that row for 6s!', 1500);

    } else if (type === 'magnet') {
      s.magnetTimer = 6;
      showMessage('Magnet — pulling viruses away for 6s!', 1500);

    } else if (type === 'berserk') {
      s.berserkTimer = 4;
      showMessage('Berserk — extreme fire rate for 4s!', 1500);

    } else if (type === 'crit') {
      s.critTimer = 5;
      showMessage('Crit Boost — 40% chance of triple damage for 5s!', 1500);
    } else if (type === 'flak') {
      let hits = 0;
      for (const e of s.enemies) {
        const movement = movementClassOf(e);
        if (movement && AIR_CLASSES.has(movement)) {
          e.hp -= 2; e.colPos = Math.min(5.8, e.colPos + 0.75); e.flash = 0.14; hits++;
          if (e.hp <= 0) { e.colPos = -9; s.score += 100; }
        }
      }
      showMessage(`Flak Grid grounded ${hits} airborne entit${hits === 1 ? 'y' : 'ies'}!`, 1500);
    } else if (type === 'groundwire') {
      let hits = 0;
      for (const e of s.enemies) {
        const movement = movementClassOf(e);
        if (movement && GROUNDED_CLASSES.has(movement)) {
          e.hp -= HEAVY_CLASSES.has(movement) ? 1 : 2;
          e.colPos = Math.min(5.8, e.colPos + (HEAVY_CLASSES.has(movement) ? 0.35 : 0.7));
          e.flash = 0.14; hits++;
          if (e.hp <= 0) { e.colPos = -9; s.score += 100; }
        }
      }
      showMessage(`Groundwire shocked ${hits} grounded entit${hits === 1 ? 'y' : 'ies'}!`, 1500);
    } else if (type === 'signaljam') {
      s.signalJamTimer = 6;
      showMessage('Signal Jam disabled cyber traits and fusion for 6s!', 1500);
    } else if (type === 'undertow') {
      let hits = 0;
      for (const e of s.enemies) {
        const movement = movementClassOf(e);
        if (movement && FLUID_CLASSES.has(movement)) {
          e.row = s.player.row; e.colPos = Math.min(5.8, e.colPos + 1.25); e.flash = 0.14; hits++;
        }
      }
      showMessage(`Undertow redirected ${hits} fluid-bodied entit${hits === 1 ? 'y' : 'ies'}!`, 1500);
    } else if (type === 'separate') {
      let split = 0;
      for (const e of s.enemies) {
        if (!e.genome || e.genome.fusionLevel <= 0) continue;
        e.genome = {
          ...e.genome,
          fusionLevel: Math.max(0, e.genome.fusionLevel - 1),
          generation: Math.max(0, e.genome.generation - 1),
          mutations: e.genome.mutations.slice(0, Math.max(0, e.genome.mutations.length - 2)),
          hpBonus: Math.max(0, e.genome.hpBonus - 1),
          fusionElement: e.genome.fusionLevel <= 1 ? undefined : e.genome.fusionElement,
        };
        e.hp = Math.max(1, Math.ceil(e.hp * 0.55));
        e.maxHp = Math.max(e.hp, Math.ceil((e.maxHp ?? e.hp) * 0.65));
        e.flash = 0.16; split++;
      }
      showMessage(`Separation destabilized ${split} fusion${split === 1 ? '' : 's'}!`, 1500);
    } else if (type === 'interceptor') {
      const target = [...s.enemies].filter((e) => e.colPos > -1)
        .sort((a, b) => (a.colPos - b.colPos) || (b.speed - a.speed))[0];
      if (target) {
        target.hp -= 6; target.flash = 0.18;
        if (target.hp <= 0) { target.colPos = -9; s.score += 100; playScore(); }
        showMessage('Interceptor struck the leading threat!', 1500);
      } else {
        showMessage('Interceptor found no target.', 1000);
      }
    } else if (type === 'stasisgate') {
      s.stasisGateTimer = 7;
      for (const e of s.enemies) e.stasisTriggered = false;
      showMessage('Stasis Gate armed at the center boundary for 7s!', 1500);
    } else if (type === 'adaptive') {
      s.adaptiveAmmoTimer = 7;
      showMessage('Adaptive Ammo matched every target anatomy for 7s!', 1500);
    } else if (type === 'ricochet') {
      for (let row = 0; row < 3; row++) fireBullet(row, { power: 2, pierce: true });
      showMessage('Ricochet covered every lane!', 1200);
    } else if (type === 'rearguard') {
      const original = eloAttackDirectionRef.current;
      fireBullet(s.player.row, { power: 3, pierce: true });
      if (playerSkinRef.current === 'gem') {
        eloAttackDirectionRef.current = original === 1 ? -1 : 1;
        fireBullet(s.player.row, { power: 3, pierce: true });
        eloAttackDirectionRef.current = original;
      } else {
        s.bullets.push({ colPos: s.player.col - 0.55, row: s.player.row, speed: -8.5, power: 3, big: false, pierce: true });
      }
      showMessage('Rearguard fired in both directions!', 1200);
    } else if (type === 'arcweb') {
      const targets = living().sort((a, b) => a.colPos - b.colPos).slice(0, 4);
      targets.forEach((enemy, index) => {
        enemy.hp -= Math.max(1, 4 - index); enemy.flash = 0.16;
        if (enemy.hp <= 0) { enemy.colPos = -9; s.score += 100; }
      });
      showMessage(`Arc Web chained through ${targets.length} targets!`, 1200);
    } else if (type === 'splitter') {
      for (let row = 0; row < 3; row++) {
        fireBullet(row, { power: 2, pierce: true });
        fireBullet(row, { power: 2, pierce: true });
      }
      showMessage('Splitter launched six projectiles!', 1200);
    } else if (type === 'seeker') {
      const target = living().sort((a, b) => (a.colPos - b.colPos) || (b.hp - a.hp))[0];
      if (target) strike((enemy) => enemy === target, 5);
      showMessage(target ? 'Seeker acquired the leading threat!' : 'Seeker found no target.', 1200);
    } else if (type === 'shattershot') {
      const hits = strike((enemy) =>
        Boolean(enemy.genome?.mutations.includes('armored') || enemy.genome?.mutations.includes('resilient')),
      4, 0.35);
      showMessage(`Shattershot broke ${hits} armored targets!`, 1200);
    } else if (type === 'marksman') {
      const target = living().sort((a, b) => b.colPos - a.colPos)[0];
      if (target) strike((enemy) => enemy === target, Math.max(3, Math.ceil(target.colPos)));
      showMessage(target ? 'Marksman converted range into damage!' : 'Marksman found no target.', 1200);
    } else if (type === 'returnfire') {
      const hits = strike((enemy) => enemy.colPos <= 3.1, 3, 0.7);
      showMessage(`Return Fire struck ${hits} boundary threats!`, 1200);
    } else if (type === 'oilslick') {
      const hits = strike((enemy) => movementClassOf(enemy) === 'vehicle', 1, 1.8);
      showMessage(`Oil Slick sent ${hits} vehicles skidding!`, 1200);
    } else if (type === 'rootsnare') {
      const hits = strike((enemy) => {
        const movement = movementClassOf(enemy);
        return Boolean(movement && GROUNDED_CLASSES.has(movement));
      }, 1, 0.9);
      showMessage(`Root Snare trapped ${hits} grounded movers!`, 1200);
    } else if (type === 'sonicnet') {
      const hits = strike((enemy) => Boolean(movementClassOf(enemy) && AIR_CLASSES.has(movementClassOf(enemy)!)), 3, 0.6);
      showMessage(`Sonic Net grounded ${hits} targets!`, 1200);
    } else if (type === 'depthcharge') {
      const hits = strike((enemy) => movementClassOf(enemy) === 'burrower', 5, 0.4);
      showMessage(`Depth Charge exposed ${hits} burrowers!`, 1200);
    } else if (type === 'anchorfield') {
      const hits = strike((enemy) => Boolean(movementClassOf(enemy) && HEAVY_CLASSES.has(movementClassOf(enemy)!)), 2, 0.25);
      for (const enemy of living()) if (!HEAVY_CLASSES.has(movementClassOf(enemy)!)) enemy.colPos = Math.min(5.8, enemy.colPos + 0.75);
      showMessage(`Anchor Field locked ${hits} heavy bodies!`, 1200);
    } else if (type === 'tailclamp') {
      const hits = strike((enemy) => ['serpentine', 'aquatic'].includes(movementClassOf(enemy) ?? ''), 3, 1);
      showMessage(`Tail Clamp crippled ${hits} movers!`, 1200);
    } else if (type === 'tanglewire') {
      const hits = strike((enemy) => ['rooted', 'tentacled'].includes(movementClassOf(enemy) ?? ''), 4, 0.4);
      showMessage(`Tanglewire caught ${hits} entities!`, 1200);
    } else if (type === 'trafficjam') {
      const hits = strike((enemy) => movementClassOf(enemy) === 'vehicle' || isCyberEnemy(enemy), 2, 1.15);
      showMessage(`Traffic Jam staggered ${hits} machines!`, 1200);
    } else if (type === 'thermalshock') {
      const hits = strike((enemy) => ['thermal', 'cryo'].includes(enemy.genome?.element ?? ''), 4, 0.5);
      showMessage(`Thermal Shock fractured ${hits} affinities!`, 1200);
    } else if (type === 'circuitarc') {
      const hits = strike((enemy) =>
        enemy.genome?.element === 'voltaic'
        || ['mechanical', 'fluidic'].includes(enemy.genome?.entityType ?? ''),
      3, 0.45);
      showMessage(`Circuit Arc crossed ${hits} entities!`, 1200);
    } else if (type === 'acidetch') {
      const hits = strike((enemy) =>
        enemy.genome?.element === 'corrosive' || enemy.genome?.mutations.includes('armored') === true,
      3);
      for (const enemy of living()) {
        if (enemy.genome?.mutations.includes('armored')) {
          enemy.genome.mutations = enemy.genome.mutations.filter((mutation) => mutation !== 'armored');
        }
      }
      showMessage(`Acid Etch stripped ${hits} targets!`, 1200);
    } else if (type === 'bloombind') {
      const hits = strike((enemy) => enemy.genome?.entityType === 'botanical', 3, 0.8);
      showMessage(`Bloom Bind linked ${hits} botanical forms!`, 1200);
    } else if (type === 'radiantmark') {
      const hits = strike((enemy) =>
        enemy.genome?.element === 'void' || enemy.genome?.entityType === 'spectral',
      4, 0.4);
      showMessage(`Radiant Mark revealed ${hits} phase forms!`, 1200);
    } else if (type === 'voidaperture') {
      const target = living().sort((a, b) => a.colPos - b.colPos)[0];
      if (target) { target.hp = Math.max(1, Math.ceil(target.hp / 2)); target.colPos = 5.8; target.flash = 0.2; }
      showMessage(target ? 'Void Aperture returned the leader weakened!' : 'The aperture found no target.', 1200);
    } else if (type === 'kineticram') {
      const row = s.player.row;
      const hits = strike((enemy) => enemy.row === row, 2, 1.5);
      showMessage(`Kinetic Ram drove ${hits} enemies backward!`, 1200);
    } else if (type === 'elementswap') {
      const cycle = ['kinetic', 'thermal', 'cryo', 'voltaic', 'corrosive', 'radiant', 'void', 'bloom'] as const;
      for (const enemy of living()) if (enemy.genome) {
        enemy.genome.element = cycle[(cycle.indexOf(enemy.genome.element) + 1) % cycle.length];
        enemy.flash = 0.12;
      }
      showMessage('Element Swap rotated every affinity!', 1200);
    } else if (type === 'devolve') {
      let hits = 0;
      for (const enemy of living()) if (enemy.genome) {
        enemy.genome.generation = Math.max(0, enemy.genome.generation - 1);
        enemy.genome.fusionLevel = Math.max(0, enemy.genome.fusionLevel - 1);
        enemy.genome.mutations = enemy.genome.mutations.slice(0, -1);
        enemy.hp = Math.max(1, enemy.hp - 2); enemy.flash = 0.16; hits++;
      }
      showMessage(`Devolve regressed ${hits} entities!`, 1200);
    } else if (type === 'mutationlock') {
      s.signalJamTimer = Math.max(s.signalJamTimer, 8);
      showMessage('Mutation Lock suppressed adaptive traits for 8s!', 1200);
    } else if (type === 'traittheft') {
      const target = living().sort((a, b) =>
        (b.genome?.mutations.length ?? 0) - (a.genome?.mutations.length ?? 0))[0];
      if (target) {
        const traits = target.genome?.mutations.length ?? 0;
        s.hp += Math.min(3, Math.max(1, traits));
        target.genome && (target.genome.mutations = target.genome.mutations.slice(0, -1));
        target.hp = Math.max(1, target.hp - 2);
      }
      showMessage(target ? 'Trait Theft converted adaptation into vitality!' : 'No traits available.', 1200);
    } else if (type === 'quarantine') {
      const row = s.player.row;
      let offset = 0;
      for (const enemy of living().filter((item) => item.row === row)) {
        enemy.colPos = Math.min(5.8, enemy.colPos + offset * 0.55);
        offset++;
      }
      s.signalJamTimer = Math.max(s.signalJamTimer, 4);
      showMessage('Quarantine separated the current lane!', 1200);
    } else if (type === 'clonebreak') {
      const counts = new Map<string, number>();
      for (const enemy of living()) {
        const base = enemy.genome?.baseElement;
        if (base) counts.set(base, (counts.get(base) ?? 0) + 1);
      }
      const species = [...counts].sort((a, b) => b[1] - a[1])[0]?.[0];
      const hits = strike((enemy) => enemy.genome?.baseElement === species, 4);
      showMessage(`Clone Break struck ${hits} related entities!`, 1200);
    } else if (type === 'hybridtax') {
      let hits = 0;
      for (const enemy of living()) if ((enemy.genome?.fusionLevel ?? 0) > 0) {
        const level = enemy.genome!.fusionLevel;
        enemy.hp -= level * 2; enemy.speed *= 0.72; enemy.flash = 0.16; hits++;
        if (enemy.hp <= 0) { enemy.colPos = -9; s.score += 100; }
      }
      showMessage(`Hybrid Tax penalized ${hits} fusions!`, 1200);
    } else if (type === 'forcedmolt') {
      let hits = 0;
      for (const enemy of living()) if (enemy.genome && enemy.genome.mutations.length > 0) {
        enemy.genome.mutations = enemy.genome.mutations.filter((mutation) => mutation !== 'armored');
        enemy.genome.mutations = enemy.genome.mutations.slice(0, Math.max(0, enemy.genome.mutations.length - 1));
        enemy.speed *= 1.18; enemy.hp = Math.max(1, enemy.hp - 2); enemy.flash = 0.16; hits++;
      }
      showMessage(`Forced Molt stripped ${hits} entities!`, 1200);
    } else if (type === 'catalyst') {
      let marked = 0;
      for (const enemy of living()) if ((enemy.genome?.fusionLevel ?? 0) > 0) {
        enemy.hp += 2; enemy.maxHp = Math.max(enemy.maxHp ?? enemy.hp, enemy.hp);
        enemy.catalystMarked = true;
        enemy.flash = 0.18; marked++;
      }
      showMessage(`Catalyst empowered ${marked} fusions for greater rewards!`, 1200);
    }

    playAbility(type);
    s.abilityCooldowns[type] = ability.cooldown;

    // Mark this card as used in the current hand (cards stay visible, dimmed)
    s.usedInHand = [...s.usedInHand, type];

    updateHud();
  }, [fireBullet, addParticles, showMessage, updateHud]);

  // Rotate hand: reset the bar timer so it charges up and deals a fresh hand when full
  const rotateHand = useCallback(() => {
    const s = stateRef.current;
    if (!s.running) return;
    if (s.rotateUsedThisHand) return;
    // Guard: disabled once all cards in the current hand have been used
    const allUsed = s.cardsReady && s.currentCardOptions.length > 0 &&
      s.currentCardOptions.every((id) => s.usedInHand.includes(id));
    if (allUsed) return;
    ensureAudio();
    s.rotateUsedThisHand = true;
    s.cardsReady = false;
    s.cardSelectionOpen = false;
    s.cardTimer = 0;
    s.usedInHand = [];
    if (cardBarFillRef.current) cardBarFillRef.current.style.width = '0%';
    updateHud();
    showMessage('Timer reset — new hand incoming!', 1500);
  }, [showMessage, updateHud]);

  const chooseRunUpgrade = useCallback((id: string) => {
    const s = stateRef.current;
    if (!s.upgradeSelectionOpen || !s.upgradeOptions.includes(id)) return;
    const upgrade = RUN_UPGRADES.find((candidate) => candidate.id === id);
    if (!upgrade) return;
    const nextLevel = Math.min(upgrade.maxLevel, (s.runUpgrades[id] ?? 0) + 1);
    s.runUpgrades[id] = nextLevel;
    if (id === 'repairWeave') s.hp += 2;
    if (id === 'barrierArray') s.shieldCharges += 2;
    s.upgradePromptOpen = false;
    s.upgradePromptTimer = 0;
    s.upgradeRetryWave = 0;
    s.upgradeSelectionOpen = false;
    s.upgradeOptions = [];
    upgradeSelectionRef.current = 0;
    setUpgradeSelection(0);
    showMessage(`${upgrade.name} level ${nextLevel} installed!`, 1800);
    updateHud();
  }, [showMessage, updateHud]);

  const openUpgradeSelection = useCallback(() => {
    const s = stateRef.current;
    if (!s.upgradePromptOpen || s.upgradeOptions.length === 0) return;
    s.upgradePromptOpen = false;
    s.upgradePromptTimer = 0;
    s.upgradeSelectionOpen = true;
    upgradeSelectionRef.current = 0;
    setUpgradeSelection(0);
    menuNavCooldownRef.current = 0;
    updateHud();
  }, [updateHud]);

  const moveBestiarySelection = useCallback((direction: number) => {
    const count = bestiaryRef.current.length;
    if (count <= 0) return;
    bestiarySelectionRef.current = (bestiarySelectionRef.current + direction + count) % count;
    setBestiarySelection(bestiarySelectionRef.current);
    document.getElementById(`bestiaryEntry-${bestiarySelectionRef.current}`)
      ?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  }, []);

  const disperseClone = useCallback((direction: CloneDirection, returnControl: boolean) => {
    const current = cloneSessionRef.current;
    if (current.statuses[direction] === 'gone' || current.statuses[direction] === 'dispersing') return;
    const dispersing: CloneView = {
      ...current,
      inputActive: returnControl ? false : current.inputActive,
      statuses: { ...current.statuses, [direction]: 'dispersing' },
    };
    cloneSessionRef.current = dispersing;
    setCloneView(dispersing);
    const existing = cloneActionTimersRef.current[direction];
    if (existing) clearTimeout(existing);
    cloneActionTimersRef.current[direction] = setTimeout(() => {
      const latest = cloneSessionRef.current;
      const statuses = { ...latest.statuses, [direction]: 'gone' as CloneStatus };
      const visible = statuses.north !== 'gone' || statuses.south !== 'gone';
      const settled: CloneView = {
        ...latest,
        visible,
        playerLocked: returnControl ? false : latest.playerLocked,
        statuses,
      };
      cloneSessionRef.current = settled;
      setCloneView(settled);
      cloneActionTimersRef.current[direction] = null;
      if (returnControl) showMessage('Clone sequence complete — Player control restored.', 1100);
    }, 360);
  }, [showMessage]);

  const advanceToSecondClone = useCallback((from: CloneDirection) => {
    const next: CloneDirection = from === 'north' ? 'south' : 'north';
    const clone = cloneSessionRef.current;
    if (clone.rows[next] === null || clone.statuses[next] === 'gone') {
      cloneSessionRef.current = { ...clone, inputActive: false, playerLocked: false };
      setCloneView(cloneSessionRef.current);
      showMessage('No second clone available — Player control restored.', 1000);
      return;
    }
    const advanced: CloneView = {
      ...clone,
      inputActive: true,
      controlled: next,
      turn: 1,
    };
    cloneSessionRef.current = advanced;
    setCloneView(advanced);
    showMessage(`${next.toUpperCase()} clone controlled · X Attack · B Defend`, 1200);
  }, [showMessage]);

  const resolveCloneAction = useCallback((action: 'attack' | 'defend') => {
    const clone = cloneSessionRef.current;
    if (!clone.inputActive) return;
    const direction = clone.controlled;
    const row = clone.rows[direction];
    if (row === null) return;
    const firstAction = clone.turn === 0;
    const status: CloneStatus = action === 'attack' ? 'attacking' : 'defending';
    const committed: CloneView = {
      ...clone,
      inputActive: false,
      statuses: { ...clone.statuses, [direction]: status },
    };
    cloneSessionRef.current = committed;
    setCloneView(committed);

    if (action === 'attack') {
      fireBullet(row, { power: 3, big: true, pierce: true });
      showMessage(`${direction.toUpperCase()} clone attacked.`, 700);
      const existing = cloneActionTimersRef.current[direction];
      if (existing) clearTimeout(existing);
      cloneActionTimersRef.current[direction] = setTimeout(() => {
        disperseClone(direction, !firstAction);
        if (firstAction) advanceToSecondClone(direction);
      }, 520);
    } else if (firstAction) {
      showMessage(`${direction.toUpperCase()} clone defending until hit.`, 850);
      advanceToSecondClone(direction);
    } else {
      const released: CloneView = {
        ...cloneSessionRef.current,
        inputActive: false,
        playerLocked: false,
      };
      cloneSessionRef.current = released;
      setCloneView(released);
      showMessage(`${direction.toUpperCase()} clone guarding — Player control restored.`, 1200);
    }
  }, [advanceToSecondClone, disperseClone, fireBullet, showMessage]);

  const switchCloneControl = useCallback(() => {
    const clone = cloneSessionRef.current;
    if (!clone.inputActive || clone.turn !== 0) return;
    const direction = clone.controlled;
    const guarded: CloneView = {
      ...clone,
      inputActive: false,
      statuses: { ...clone.statuses, [direction]: 'defending' },
    };
    cloneSessionRef.current = guarded;
    setCloneView(guarded);
    advanceToSecondClone(direction);
  }, [advanceToSecondClone]);

  const playSkillAnimation = useCallback(() => {
    const s = stateRef.current;
    if (phaseRef.current !== 'playing' || !s.running || pausedRef.current
      || cloneSessionRef.current.visible) return;
    ensureAudio();
    const northRow = s.player.row > 0 ? s.player.row - 1 : null;
    const southRow = s.player.row < 2 ? s.player.row + 1 : null;
    const controlled: CloneDirection = northRow !== null ? 'north' : 'south';
    const clones: CloneView = {
      visible: true,
      revealed: false,
      inputActive: false,
      playerLocked: true,
      controlled,
      turn: 0,
      statuses: {
        north: northRow === null ? 'gone' : 'idle',
        south: southRow === null ? 'gone' : 'idle',
      },
      rows: { north: northRow, south: southRow },
    };
    cloneSessionRef.current = clones;
    setCloneView(clones);
    showMessage('Clones materializing…', 1300);
    if (skillFxTimerRef.current) clearTimeout(skillFxTimerRef.current);
    setSkillFxRun((run) => run + 1);
    setSkillFxActive(true);
    skillFxTimerRef.current = setTimeout(() => {
      setSkillFxActive(false);
      const current = cloneSessionRef.current;
      if (current.visible && !current.revealed) {
        const revealed: CloneView = { ...current, revealed: true, inputActive: true };
        cloneSessionRef.current = revealed;
        setCloneView(revealed);
        showMessage(`${revealed.controlled.toUpperCase()} clone controlled · X Attack · Y Switch · B Defend`, 1800);
      }
      skillFxTimerRef.current = null;
    }, 1530);
  }, [showMessage]);

  const handleGamepad = useCallback(() => {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let gp: Gamepad | null = null;
    for (let i = 0; i < pads.length; i++) {
      if (pads[i]?.connected) { gp = pads[i]; break; }
    }
    const g = gamepadRef.current;
    if (!gp) {
      if (g.connected) {
        g.connected = false;
        g.moveX = 0; g.moveY = 0; g.prevMoveX = 0;
        g.fire = false; g.prevFire = false;
        g.cardX = false; g.prevCardX = false;
        g.cardY = false; g.prevCardY = false;
        g.cardB = false; g.prevCardB = false;
        g.rotate = false; g.prevRotate = false;
        g.start = false; g.prevStart = false;
        g.l1 = false; g.prevL1 = false;
        g.skill = false; g.prevSkill = false;
        g.r1 = false; g.prevR1 = false;
      }
      return;
    }
    const buttonPressed = (idx: number) => { const b = gp!.buttons[idx]; return !!(b && (b.pressed || b.value > 0.2)); };
    const deadzone = 0.18;
    let moveX = gp.axes[0] ?? 0, moveY = gp.axes[1] ?? 0;
    if (buttonPressed(14)) moveX = -1; else if (buttonPressed(15)) moveX = 1;
    if (buttonPressed(12)) moveY = -1; else if (buttonPressed(13)) moveY = 1;
    if (Math.abs(moveX) < deadzone) moveX = 0;
    if (Math.abs(moveY) < deadzone) moveY = 0;
    g.prevMoveX = g.moveX;
    g.prevFire = g.fire;
    g.fire = buttonPressed(0);            // A only
    g.prevCardX = g.cardX; g.cardX = buttonPressed(2);  // X → slot 0
    g.prevCardY = g.cardY; g.cardY = buttonPressed(3);  // Y → slot 1
    g.prevCardB = g.cardB; g.cardB = buttonPressed(1);  // B → slot 2
    g.prevRotate = g.rotate;
    g.rotate = buttonPressed(8) || buttonPressed(17);   // View / ellipsis / share
    g.prevStart = g.start; g.start = buttonPressed(9);  // Start → pause
    g.prevL1 = g.l1; g.l1 = buttonPressed(4);          // L1 modifier
    g.prevSkill = g.skill; g.skill = buttonPressed(6); // L2 → skill animation
    g.prevR1 = g.r1; g.r1 = buttonPressed(5);          // R1 → evolution prompt
    g.moveX = moveX;
    g.moveY = moveY;
    g.connected = true;
  }, []);

  const update = useCallback((dt: number) => {
    const s = stateRef.current;
    if (!s.running) return;

    handleGamepad();

    if (!s.upgradePromptOpen && !s.upgradeSelectionOpen
      && s.upgradeRetryWave > 0 && s.wave >= s.upgradeRetryWave) {
      s.upgradePromptOpen = true;
      s.upgradePromptTimer = UPGRADE_PROMPT_TIME;
      s.upgradeRetryWave = 0;
      updateHud();
    } else if (!s.upgradePromptOpen && !s.upgradeSelectionOpen
      && s.upgradeOptions.length === 0 && s.wave >= s.nextUpgradeWave) {
      s.upgradeOptions = chooseUpgradeOptions(s.runUpgrades);
      s.nextUpgradeWave += 5;
      if (s.upgradeOptions.length > 0) {
        s.upgradePromptOpen = true;
        s.upgradePromptTimer = UPGRADE_PROMPT_TIME;
        upgradeSelectionRef.current = 0;
        setUpgradeSelection(0);
        updateHud();
      }
    }

    if (s.upgradePromptOpen) {
      s.upgradePromptTimer = Math.max(0, s.upgradePromptTimer - dt);
      if (s.upgradePromptTimer <= 0) {
        s.upgradePromptOpen = false;
        s.upgradeRetryWave = s.wave + UPGRADE_RETRY_WAVES;
        showMessage(`Evolution deferred — returns at wave ${s.upgradeRetryWave}.`, 1800);
        updateHud();
      }
    }

    const upgradeGamepad = gamepadRef.current;
    if (s.upgradePromptOpen && upgradeGamepad.r1 && !upgradeGamepad.prevR1) {
      openUpgradeSelection();
      return;
    }

    const slowMotionActive = s.upgradeSelectionOpen;
    if (s.upgradeSelectionOpen) {
      menuNavCooldownRef.current = Math.max(0, menuNavCooldownRef.current - dt);
      const axis = Math.abs(upgradeGamepad.moveX) > 0.15
        ? upgradeGamepad.moveX
        : upgradeGamepad.moveY;
      if (Math.abs(axis) > 0.15 && menuNavCooldownRef.current <= 0) {
        const direction = axis > 0 ? 1 : -1;
        upgradeSelectionRef.current =
          (upgradeSelectionRef.current + direction + s.upgradeOptions.length) % s.upgradeOptions.length;
        setUpgradeSelection(upgradeSelectionRef.current);
        menuNavCooldownRef.current = 0.22;
      }
      if (upgradeGamepad.fire && !upgradeGamepad.prevFire) {
        chooseRunUpgrade(s.upgradeOptions[upgradeSelectionRef.current]);
      }
      upgradeGamepad.moveX = 0;
      upgradeGamepad.moveY = 0;
      fireHeldRef.current = true;
      dt *= 0.08;
    }

    // Gamepad Start button → pause (rising edge)
    const gpForPause = gamepadRef.current;
    if (gpForPause.start && !gpForPause.prevStart) { togglePause(); return; }

    // Controller movement
    controllerCooldownRef.current = Math.max(0, controllerCooldownRef.current - dt);
    const kb = keyboardRef.current;
    const td = touchDpadRef.current;
    const gp = gamepadRef.current;
    if (gp.skill && !gp.prevSkill) playSkillAnimation();
    const cloneInputActive = cloneSessionRef.current.inputActive;
    const cloneControlActive = cloneSessionRef.current.playerLocked;
    if (cloneInputActive) {
      if (gp.cardX && !gp.prevCardX) resolveCloneAction('attack');
      else if (gp.cardY && !gp.prevCardY) switchCloneControl();
      else if (gp.cardB && !gp.prevCardB) resolveCloneAction('defend');
    }
    const eloFlipCombo = !cloneControlActive
      && playerSkinRef.current === 'gem'
      && gp.moveX < -0.15
      && ((gp.prevMoveX >= -0.15 && gp.l1) || (gp.l1 && !gp.prevL1));
    if (eloFlipCombo) {
      eloAttackDirectionRef.current = eloAttackDirectionRef.current === 1 ? -1 : 1;
      gemMoveMirrorRef.current = eloAttackDirectionRef.current === -1;
      showMessage(
        eloAttackDirectionRef.current === 1 ? 'Player facing right' : 'Player facing left',
        900,
      );
    }
    let dx = 0, dy = 0;
    if (!cloneControlActive) {
      if (kb.left || td.left) dx = -1; else if (kb.right || td.right) dx = 1;
      if (kb.up || td.up) dy = -1; else if (kb.down || td.down) dy = 1;
      if (Math.abs(gp.moveX) > 0.15 && !eloFlipCombo) dx = gp.moveX > 0 ? 1 : -1;
      if (Math.abs(gp.moveY) > 0.15) dy = gp.moveY > 0 ? 1 : -1;
    }

    if ((dx !== 0 || dy !== 0) && controllerCooldownRef.current <= 0) {
      const nc = Math.max(0, Math.min(2, s.player.col + dx));
      const nr = Math.max(0, Math.min(2, s.player.row + dy));
      if (nc !== s.player.col || nr !== s.player.row) {
        tryMoveTo(nc, nr);
        controllerCooldownRef.current = 0.16;
      }
    }
    if (!cloneControlActive && gp.fire && !fireHeldRef.current) manualBuster();
    fireHeldRef.current = gp.fire;
    if (!cloneControlActive && gp.rotate && !gp.prevRotate) {
      if (gp.l1) {
        s.autoBuster = !s.autoBuster;
        playAutoToggle();
        updateHud();
        showMessage(`Auto Fire: ${s.autoBuster ? 'ON' : 'OFF'}`, 900);
      } else {
        rotateHand();
      }
    }

    // Gamepad X/Y/B → ability card slots 0/1/2 (rising edge only)
    if (!cloneControlActive && !slowMotionActive && s.cardsReady && s.cardSelectionOpen) {
      if (gp.cardX && !gp.prevCardX && s.currentCardOptions[0]) useCard(s.currentCardOptions[0]);
      if (gp.cardY && !gp.prevCardY && s.currentCardOptions[1]) useCard(s.currentCardOptions[1]);
      if (gp.cardB && !gp.prevCardB && s.currentCardOptions[2]) useCard(s.currentCardOptions[2]);
    }

    s.timer += dt;
    s.moveFlash      = Math.max(0, s.moveFlash - dt);
    s.slowTimer      = Math.max(0, s.slowTimer - dt);
    s.overclockTimer = Math.max(0, s.overclockTimer - dt);
    s.freezeTimer    = Math.max(0, s.freezeTimer - dt);
    s.blizzardTimer  = Math.max(0, s.blizzardTimer - dt);
    s.doubleTimer    = Math.max(0, s.doubleTimer - dt);
    s.multishotTimer = Math.max(0, s.multishotTimer - dt);
    s.drainTimer     = Math.max(0, s.drainTimer - dt);
    s.voltageTimer   = Math.max(0, s.voltageTimer - dt);
    s.ghostTimer     = Math.max(0, s.ghostTimer - dt);
    s.turretTimer    = Math.max(0, s.turretTimer - dt);
    s.echoTimer      = Math.max(0, s.echoTimer - dt);
    s.overdriveTimer = Math.max(0, s.overdriveTimer - dt);
    s.overloadTimer  = Math.max(0, s.overloadTimer - dt);
    s.magnetTimer    = Math.max(0, s.magnetTimer - dt);
    s.berserkTimer   = Math.max(0, s.berserkTimer - dt);
    s.critTimer      = Math.max(0, s.critTimer - dt);
    s.signalJamTimer = Math.max(0, s.signalJamTimer - dt);
    s.stasisGateTimer = Math.max(0, s.stasisGateTimer - dt);
    s.adaptiveAmmoTimer = Math.max(0, s.adaptiveAmmoTimer - dt);
    if (s.pulseTimer > 0) {
      s.pulseTimer = Math.max(0, s.pulseTimer - dt);
      s.pulseTick  = Math.max(0, s.pulseTick  - dt);
      if (s.pulseTick <= 0) {
        for (const e of s.enemies) {
          const movement = movementClassOf(e);
          const push = movement && HEAVY_CLASSES.has(movement) ? 0.18 : movement === 'spectral' ? 0.28 : 0.65;
          e.colPos = Math.min(5.8, e.colPos + push);
          e.flash = 0.06;
        }
        s.pulseTick = 1.5;
      }
    }
    if (s.magnetTimer > 0) {
      for (const e of s.enemies) {
        const pull = isCyberEnemy(e) ? 0.62 : e.genome?.fusionLevel ? 0.2 : 0.05;
        e.colPos = Math.min(5.8, e.colPos + pull * dt);
      }
    }
    if (s.regenTimer > 0) {
      s.regenTimer = Math.max(0, s.regenTimer - dt);
      s.regenTick  = Math.max(0, s.regenTick  - dt);
      if (s.regenTick <= 0) {
        s.hp++;
        s.regenTick = 3;
        updateHud();
      }
    }

    // Stable session metrics update twice per second; their values only increase.
    hudTickRef.current += dt;
    if (hudTickRef.current >= 0.5) {
      hudTickRef.current = 0;
      updateHud();
    }

    for (const a of ABILITY_POOL) {
      if (s.abilityCooldowns[a.id] > 0) {
        s.abilityCooldowns[a.id] = Math.max(0, s.abilityCooldowns[a.id] - dt);
      }
    }

    // ── Card system ──────────────────────────────────────────────────────────
    if (!s.cardsReady) {
      // Bar is filling — tick toward next hand
      const capacitorMultiplier = 1 + (s.runUpgrades.capacitor ?? 0) * 0.15;
      const assistedRecharge = (s.hp <= 2 || s.directorCritical ? 1.55 : 1) * capacitorMultiplier;
      s.cardTimer = Math.min(CARD_CHARGE_TIME, s.cardTimer + dt * assistedRecharge);
      const pct = (s.cardTimer / CARD_CHARGE_TIME) * 100;
      if (cardBarFillRef.current) cardBarFillRef.current.style.width = `${pct.toFixed(2)}%`;
      if (cardLabelRef.current) {
        const secs = Math.max(0, Math.ceil((CARD_CHARGE_TIME - s.cardTimer) / assistedRecharge));
        cardLabelRef.current.textContent = assistedRecharge > 1
          ? `Assisted hand in ${secs}s`
          : `New hand in ${secs}s`;
      }
      if (s.cardTimer >= CARD_CHARGE_TIME) {
        s.currentCardOptions = randomAbilityOptions(
          s.currentCardOptions,
          enabledAbilitiesRef.current,
          s.abilityCooldowns,
          s.enemies,
          s.hp,
        );
        s.cardsReady = true;
        s.cardSelectionOpen = true;
        s.rotateUsedThisHand = false;
        s.usedInHand = [];
        playCardReady();
        showMessage('Ability Cards loaded! Use them, then hand resets.', 2000);
        updateHud();
      }
    } else {
      // Hand is active — bar stays full
      if (cardBarFillRef.current) cardBarFillRef.current.style.width = '100%';

      const allUsed = s.currentCardOptions.every((id) => s.usedInHand.includes(id));
      const allCooldownsDone = s.currentCardOptions.every((id) => (s.abilityCooldowns[id] ?? 0) === 0);

      if (cardLabelRef.current) {
        if (allUsed) {
          const maxCd = Math.max(0, ...s.currentCardOptions.map((id) => s.abilityCooldowns[id] ?? 0));
          cardLabelRef.current.textContent = maxCd > 0
            ? `All used — cooling down ${Math.ceil(maxCd)}s`
            : '';
        } else {
          const remaining = s.currentCardOptions.filter((id) => !s.usedInHand.includes(id)).length;
          cardLabelRef.current.textContent = `${remaining} card${remaining !== 1 ? 's' : ''} remaining — ROTATE to reset timer`;
        }
      }

      // Once all used AND all cooldowns expired → reset for next hand
      if (allUsed && allCooldownsDone) {
        s.cardsReady = false;
        s.cardSelectionOpen = false;
        s.cardTimer = 0;
        s.usedInHand = [];
        updateHud();
      }
    }

    s.player.fireCooldown -= dt;
    if (s.autoBuster && s.player.fireCooldown <= 0) {
      const rapidScale = 1 + (s.runUpgrades.rapidBuster ?? 0) * 0.1;
      s.player.fireCooldown = (s.berserkTimer > 0 ? 0.09 : s.overclockTimer > 0 ? 0.16 : 0.34) / rapidScale;
      fireBullet();
      if (s.multishotTimer > 0) fireBullet((s.player.row + 1) % 3);
      if (s.turretTimer > 0) {
        for (let r = 0; r < 3; r++) { if (r !== s.player.row) fireBullet(r); }
      }
    }

    // Adaptive pressure director: dangerous boards stop receiving reinforcements,
    // and clearing a critical state earns a short recovery window.
    s.directorRecoveryTimer = Math.max(0, s.directorRecoveryTimer - dt);
    const directorLiving = s.enemies.filter((enemy) => enemy.colPos >= -1);
    const nearestThreat = directorLiving.reduce(
      (nearest, enemy) => Math.min(nearest, enemy.colPos),
      Number.POSITIVE_INFINITY,
    );
    const fusedThreats = directorLiving.filter((enemy) => (enemy.genome?.fusionLevel ?? 0) > 0).length;
    const directorCritical =
      directorLiving.length >= 7
      || (directorLiving.length >= 5 && nearestThreat <= 2.25)
      || (s.hp <= 2 && directorLiving.length >= 4);
    if (s.directorCritical && !directorCritical) {
      s.directorRecoveryTimer = Math.max(s.directorRecoveryTimer, 3.5);
      if ((s.runUpgrades.repairWeave ?? 0) > 0) s.hp++;
      showMessage('Pressure cleared — reinforcement pause!', 1400);
    }
    if (!s.directorCritical && directorCritical && (s.runUpgrades.shockVent ?? 0) > 0) {
      const knockback = 0.55 + (s.runUpgrades.shockVent - 1) * 0.3;
      for (const enemy of directorLiving) {
        enemy.colPos = Math.min(5.8, enemy.colPos + knockback);
        enemy.flash = 0.12;
      }
      showMessage('Shock Vent expelled the pressure front!', 1200);
    }
    s.directorCritical = directorCritical;

    // Spawn enemies
    s.enemySpawnTimer -= dt;
    const populationCap = s.hp <= 2 ? 5 : 7;
    if (s.enemySpawnTimer <= 0 && s.directorRecoveryTimer <= 0 && directorLiving.length < populationCap) {
      const value = pickDiverseSeed();
      const livingEnemies = s.enemies.filter((enemy) => enemy.colPos >= -1);
      const lanePopulation: [number, number, number] = [0, 0, 0];
      const population: Record<string, number> = {};
      const basePopulation: Record<string, number> = {};
      for (const enemy of livingEnemies) {
        lanePopulation[enemy.row]++;
        if (enemy.genome) {
          population[enemy.genome.niche] = (population[enemy.genome.niche] ?? 0) + 1;
          basePopulation[enemy.genome.baseElement] = (basePopulation[enemy.genome.baseElement] ?? 0) + 1;
        }
      }
      const genome = createGenome(value, s.wave, s.enemyFormationId, {
        playerRow: s.player.row,
        lanePressure: s.lanePressure,
        population,
        basePopulation,
        lanePopulation,
        recentBases: s.recentBaseElements,
        recentBodyClasses: s.recentBodyClasses,
        recentElementDomains: s.recentElementDomains,
      });
      const concurrentSignal =
        value + s.enemyFormationId * 7 + s.player.row * 13 +
        Math.round(s.lanePressure.reduce((sum, pressure) => sum + pressure, 0) * 11) +
        livingEnemies.length * 17;
      const candidateRow = Math.abs(concurrentSignal) % 3;
      const row = selectAdaptiveRow(
        genome,
        candidateRow,
        s.player.row,
        s.lanePressure,
        lanePopulation,
      );
      const speed = (1.15 + Math.min(0.55, (s.wave - 1) * 0.08)) * genome.speedScale;
      const hp = (Math.random() < 0.2 + Math.min(0.25, s.wave * 0.03) ? 2 : 1) + genome.hpBonus;
      const discoverySignature = [
        genome.baseElement,
        genome.fusionElement ?? 'pure',
        genome.niche,
        [...genome.mutations].sort().join('+') || 'baseline',
        `fusion-${genome.fusionLevel}`,
      ].join(':');
      if (!s.ecosystemStats.entitySignatures.includes(discoverySignature)) {
        s.ecosystemStats.entitySignatures.push(discoverySignature);
      }
      recordBestiary(value, genome);
      s.recentBaseElements.push(genome.baseElement);
      s.recentBodyClasses.push(getEnemyMovementClass(genome.baseElement));
      s.recentElementDomains.push(ELEMENT_DOMAIN[genome.baseElement]);
      if (s.recentBaseElements.length > 48) s.recentBaseElements.shift();
      if (s.recentBodyClasses.length > 24) s.recentBodyClasses.shift();
      if (s.recentElementDomains.length > 18) s.recentElementDomains.shift();
      s.ecosystemStats.mutationDiscoveries += genome.mutations.length;
      s.ecosystemStats.maxGeneration = Math.max(s.ecosystemStats.maxGeneration, genome.generation);
      if (genome.fusionLevel > 0) s.ecosystemStats.totalFusions++;
      registerSpawn(getMorphSig(value));
      s.enemies.push({
        colPos: 5.6,
        row,
        speed,
        hp,
        flash: 0,
        value,
        formationId: s.enemyFormationId,
        genome,
        maxHp: hp,
        regenerationCharge: 0,
      });

      s.enemyFormationId++;
      // Courteous escalation: waves increase pressure, while density, advanced
      // threats, proximity and low health create enough room to respond.
      const wavePressure = Math.min(0.34, (s.wave - 1) * 0.018);
      const densityBrake = Math.max(0, livingEnemies.length - 3) * 0.13;
      const advancedBrake = Math.min(0.34, fusedThreats * 0.12);
      const proximityBrake = nearestThreat <= 2.25 ? 0.28 : 0;
      const healthBrake = s.hp <= 2 ? 0.42 : s.hp === 3 ? 0.16 : 0;
      s.enemySpawnTimer = Math.max(
        0.62,
        1.18 - wavePressure + densityBrake + advancedBrake + proximityBrake + healthBrake,
      );
    } else if (s.enemySpawnTimer <= 0) {
      s.enemySpawnTimer = 0.35;
    }

    // Move bullets
    for (const b of s.bullets) b.colPos += b.speed * dt;
    s.bullets = s.bullets.filter((b) => b.colPos > -0.6 && b.colPos < 6.4);

    // Move enemies
    const canvas = canvasRef.current;
    const m = canvas ? getBoardMetrics(canvas.offsetWidth, canvas.offsetHeight) : null;
    for (const e of s.enemies) {
      if (!Number.isFinite(e.speed) || e.speed < 0.15) e.speed = 0.85;
      const movement = movementClassOf(e);
      const isFastMover = movement === 'flier' || movement === 'hover' || movement === 'quadruped'
        || movement === 'arthropod' || movement === 'aquatic';
      let speedScale = s.overdriveTimer > 0 ? 2.5 : 1;
      if (s.slowTimer > 0) speedScale = isFastMover ? 0.32 : 0.55;
      if (s.blizzardTimer > 0) {
        speedScale = movement === 'flier' || movement === 'aquatic'
          ? 0.1
          : movement === 'burrower' ? 0.42 : 0.2;
      }
      if (s.freezeTimer > 0) speedScale = 0.08;
      if (s.signalJamTimer > 0 && isCyberEnemy(e)) speedScale *= 0.32;
      e.colPos -= e.speed * speedScale * dt;
      if (s.stasisGateTimer > 0 && !e.stasisTriggered && e.colPos <= 3.1) {
        e.stasisTriggered = true;
        e.hp -= e.speed >= 1.55 ? 3 : 1;
        e.colPos = Math.min(5.8, e.colPos + (e.speed >= 1.55 ? 0.9 : 0.35));
        e.flash = 0.16;
        if (e.hp <= 0) { e.colPos = -9; s.score += 100; }
      }
      e.flash = Math.max(0, e.flash - dt);
      if (e.genome?.regeneration && s.freezeTimer <= 0 && !(s.signalJamTimer > 0 && isCyberEnemy(e)) && e.hp < (e.maxHp ?? e.hp)) {
        e.regenerationCharge = (e.regenerationCharge ?? 0) + e.genome.regeneration * dt;
        if (e.regenerationCharge >= 1) {
          e.hp++;
          e.regenerationCharge -= 1;
          e.flash = 0.06;
        }
      }
      const clone = cloneSessionRef.current;
      const struckDefender = (['north', 'south'] as const).find((direction) =>
        clone.statuses[direction] === 'defending'
        && clone.rows[direction] === e.row
        && Math.round(e.colPos) === s.player.col
        && e.colPos < s.player.col + 0.45);
      if (struckDefender) {
        e.colPos = -9;
        playHit();
        showMessage(`${struckDefender.toUpperCase()} clone absorbed the hit and dispersed.`, 1000);
        disperseClone(struckDefender, false);
      }
      if (Math.round(e.colPos) === s.player.col && e.row === s.player.row && e.colPos < s.player.col + 0.45) {
        const eloIsIntangible = playerSkinRef.current === 'gem' && !s.autoBuster;
        if (eloIsIntangible) {
          // Player phases while automation is disabled. The enemy continues
          // through the occupied cell without damage or consuming a shield.
        } else if (s.shieldCharges > 0) {
          s.shieldCharges--;
          e.colPos = -9;
          showMessage('Shield absorbed a hit!', 1200);
        } else if (s.ghostTimer > 0) {
          // Ghost mode: enemy passes clean through, keep moving (don't remove it)
        } else {
          s.hp--;
          e.colPos = -9;
          playHit();
          showMessage('Watch incoming viruses on your row!', 1200);
          if (s.hp <= 0) { updateHud(); endGame(); return; }
        }
      }
    }

    // Compatible species that converge in one lane can fuse into a stronger hybrid.
    for (let i = 0; i < s.enemies.length; i++) {
      const a = s.enemies[i];
      if (a.colPos < -1 || !a.genome) continue;
      for (let j = i + 1; j < s.enemies.length; j++) {
        const b = s.enemies[j];
        if (b.colPos < -1 || !b.genome || a.row !== b.row) continue;
        if (Math.abs(a.colPos - b.colPos) > 0.28) continue;
        if (s.signalJamTimer > 0 && (isCyberEnemy(a) || isCyberEnemy(b))) continue;
        if (!canFuse(a.genome, b.genome, a.value + b.value + s.wave)) continue;
        a.genome = fuseGenomes(a.genome, b.genome);
        s.ecosystemStats.totalFusions++;
        s.ecosystemStats.maxGeneration = Math.max(s.ecosystemStats.maxGeneration, a.genome.generation);
        // Fusion creates a new procedural identity instead of collapsing back
        // into the old 1–255 catalog.
        a.value = (((a.value * 1664525) ^ (b.value * 1013904223) ^ (s.wave * 69069)) >>> 0) % 0x7ffffffe + 1;
        a.hp = Math.min(8, a.hp + b.hp);
        a.maxHp = a.hp;
        a.speed = (a.speed + b.speed) * 0.5;
        a.flash = 0.16;
        b.colPos = -9;
        const fusedSignature = genomeSignature(a);
        if (fusedSignature && !s.ecosystemStats.entitySignatures.includes(fusedSignature)) {
          s.ecosystemStats.entitySignatures.push(fusedSignature);
        }
        if (a.genome) recordBestiary(a.value, a.genome);
        registerSpawn(getMorphSig(a.value));
        break;
      }
    }

    // Bullet–enemy collisions
    for (const b of s.bullets) {
      for (const e of s.enemies) {
        if (Math.abs(b.colPos - e.colPos) < (b.big ? 0.52 : 0.38) && b.row === e.row) {
          if (!b.pierce) b.colPos = 99;
          const movement = movementClassOf(e);
          let damage = b.power ?? 1;
          if ((e.genome?.fusionLevel ?? 0) > 0) damage += s.runUpgrades.hybridHunter ?? 0;
          if (s.adaptiveAmmoTimer > 0) {
            if (movement === 'fortress' || e.genome?.mutations.includes('armored')) damage += 2;
            else if (movement === 'spectral' || movement === 'colony' || isCyberEnemy(e)) damage += 1;
          }
          e.hp -= damage;
          const phaseSuppressed = s.freezeTimer > 0
            || (s.signalJamTimer > 0 && isCyberEnemy(e))
            || (s.adaptiveAmmoTimer > 0 && movement === 'spectral');
          if (!phaseSuppressed && e.genome?.phaseChance && Math.random() < e.genome.phaseChance) {
            e.hp += damage;
            e.flash = 0.04;
            continue;
          }
          e.flash = 0.08;
          if (e.hp <= 0) {
            if (m) addParticles(m.x + (e.colPos + 0.5) * m.cell, m.y + (e.row + 0.5) * m.cell, '#7dd3fc');
            e.colPos = -9;
            s.lanePressure[e.row] = Math.min(6, s.lanePressure[e.row] + 1);
            s.score += s.overdriveTimer > 0 || e.catalystMarked ? 300 : 100;
            if (s.score % 500 === 0) s.wave++;
            if (s.drainTimer > 0) { s.hp++; }
            if (s.overloadTimer > 0) {
              s.bullets.push({ colPos: s.player.col + 0.55, row: e.row, speed: 8.5, power: 1, big: false, pierce: false });
            }
            // VS mode: killing a red enemy sends a green attack at the NPC
            if (s.gameMode === 'vs') {
              s.npcEnemies.push({
                colPos: 2.6,
                row: Math.floor(Math.random() * 3),
                speed: 1.15 + Math.random() * 0.5,
                hp: 1,
                flash: 0,
                value: (() => { const v = pickDiverseSeed(); registerSpawn(getMorphSig(v)); return v; })(),
              });
            }
            // Record kill for CGRD reward
            rewardAccRef.current.recordKill(e.value ?? 1);
            setSessionCGRD(rewardAccRef.current.totalCGRD);
            playScore();
            updateHud();
          } else {
            playHit();
          }
        }
      }
    }

    s.enemies = s.enemies.filter((e) => e.colPos > -1);
    for (let row = 0; row < 3; row++) {
      s.lanePressure[row] = Math.max(0, s.lanePressure[row] - dt * 0.09);
    }

    for (const p of s.particles) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.96;
      p.vy *= 0.96;
    }
    s.particles = s.particles.filter((p) => p.life > 0);

    // ── VS mode: NPC AI ───────────────────────────────────────────────────────
    if (s.gameMode === 'vs') {
      const npc = s.npc;

      // Move toward the most-advanced (rightmost) incoming green attack
      npc.moveCooldown -= dt;
      if (npc.moveCooldown <= 0) {
        npc.moveCooldown = NPC_MOVE_INTERVAL;
        const active = s.npcEnemies.filter((e) => e.colPos > 2.4 && e.colPos < 5.5);
        if (active.length > 0 && Math.random() < 0.75) {
          const target = active.reduce((a, b) => a.colPos > b.colPos ? a : b);
          if (npc.row < target.row) npc.row++;
          else if (npc.row > target.row) npc.row--;
        } else if (Math.random() < 0.2) {
          npc.row = Math.max(0, Math.min(2, npc.row + (Math.random() < 0.5 ? 1 : -1)));
        }
      }

      // Fire a left-moving bullet only when a green attack is in the NPC's row
      npc.fireCooldown -= dt;
      if (npc.fireCooldown <= 0) {
        const hasTarget = s.npcEnemies.some(
          (e) => e.row === npc.row && e.colPos > 2.4 && e.colPos < 5.5,
        );
        if (hasTarget) {
          s.npcBullets.push({
            colPos: 3 + npc.col - 0.55,
            row: npc.row,
            speed: -8.5,
            power: 1,
            big: false,
            pierce: false,
          });
        }
        npc.fireCooldown = NPC_FIRE_INTERVAL;
      }

      // Move NPC bullets left; remove when they exit the active zone
      for (const b of s.npcBullets) b.colPos += b.speed * dt;
      s.npcBullets = s.npcBullets.filter((b) => b.colPos > 2.4);

      // Move green attacks right; score against NPC when they reach the right wall
      for (const e of s.npcEnemies) {
        e.colPos += e.speed * dt;
        e.flash = Math.max(0, e.flash - dt);
        if (e.colPos >= 5.55) {
          e.colPos = -9; // remove
          if (npc.shieldCharges > 0) {
            npc.shieldCharges--;
            showMessage('NPC shield blocked an attack!', 1000);
            updateHud();
          } else {
            npc.hp--;
            if (npc.hp <= 0) { updateHud(); endGame(true); return; }
            updateHud();
          }
        }
      }
      s.npcEnemies = s.npcEnemies.filter((e) => e.colPos > -1);

      // NPC bullet vs green attack collision
      for (const b of s.npcBullets) {
        for (const e of s.npcEnemies) {
          if (e.colPos < 0) continue;
          if (Math.abs(b.colPos - e.colPos) < 0.42 && b.row === e.row) {
            b.colPos = 2.0; // kill bullet (filtered < 2.4 next frame)
            e.hp -= b.power;
            e.flash = 0.08;
            if (e.hp <= 0) {
              if (m) addParticles(
                m.x + (e.colPos + 0.5) * m.cell,
                m.y + (e.row + 0.5) * m.cell,
                '#4ade80',
              );
              e.colPos = -9;
              // NPC heals on every intercept — no cap, can exceed base HP
              npc.hp++;
              showMessage('NPC intercepted an attack and healed!', 900);
              updateHud();
            }
            break;
          }
        }
      }
    }
  }, [handleGamepad, tryMoveTo, manualBuster, playSkillAnimation, resolveCloneAction, switchCloneControl, disperseClone, rotateHand, fireBullet, addParticles, showMessage, updateHud, endGame, recordBestiary, chooseRunUpgrade, openUpgradeSelection]);

  const loop = useCallback((ts: number) => {
    if (!lastTimeRef.current) lastTimeRef.current = ts;
    const dt = Math.min(0.1, (ts - lastTimeRef.current) / 1000);
    lastTimeRef.current = ts;

    // Advance gameplay when active; otherwise keep polling controllers for
    // menus, pause, and game-over actions.
    if (phaseRef.current === 'playing' && !pausedRef.current && stateRef.current.running) {
      update(dt);
    } else if (phaseRef.current === 'menu') {
      handleGamepad();
      const gp = gamepadRef.current;
      menuNavCooldownRef.current = Math.max(0, menuNavCooldownRef.current - dt);
      if (menuScreenRef.current === 'main') {
        if (Math.abs(gp.moveY) > 0.15 && menuNavCooldownRef.current <= 0) {
          const direction = gp.moveY > 0 ? 1 : -1;
          menuSelectionRef.current = (menuSelectionRef.current + direction + 5) % 5;
          setMenuSelection(menuSelectionRef.current);
          menuNavCooldownRef.current = 0.22;
        }
        if (gp.fire && !gp.prevFire) {
          const ids = ['menuPlayBtn', 'menuVsBtn', 'menuCustomBtn', 'menuBestiaryBtn', 'menuOptionsBtn'];
          document.getElementById(ids[menuSelectionRef.current])?.click();
        }
      } else if (menuScreenRef.current === 'bestiary') {
        const axis = Math.abs(gp.moveY) > 0.15 ? gp.moveY : gp.moveX;
        if (Math.abs(axis) > 0.15 && menuNavCooldownRef.current <= 0) {
          moveBestiarySelection(axis > 0 ? 1 : -1);
          menuNavCooldownRef.current = 0.22;
        }
        if (gp.cardB && !gp.prevCardB) document.getElementById('menuBackBtn')?.click();
      } else if (menuScreenRef.current === 'options') {
        if (gp.fire && !gp.prevFire) document.getElementById('menuDpadToggleBtn')?.click();
        if (gp.cardB && !gp.prevCardB) document.getElementById('menuBackBtn')?.click();
      } else if (gp.cardB && !gp.prevCardB) {
        document.getElementById('menuBackBtn')?.click();
      }
    } else if (phaseRef.current === 'playing' && !pausedRef.current && !stateRef.current.running) {
      handleGamepad();
      const gp = gamepadRef.current;
      if (gp.fire && !gp.prevFire) document.getElementById('playAgainBtn')?.click();
    } else if (phaseRef.current === 'playing' && pausedRef.current) {
      handleGamepad();
      const gp = gamepadRef.current;
      if (pauseOptionsRef.current) {
        if (gp.fire && !gp.prevFire) document.getElementById('pauseDpadToggleBtn')?.click();
        if (gp.cardB && !gp.prevCardB) {
          pauseOptionsRef.current = false;
          setPauseOptions(false);
        }
        if (gp.start && !gp.prevStart) togglePause();
      } else if (pauseBestiaryRef.current) {
        menuNavCooldownRef.current = Math.max(0, menuNavCooldownRef.current - dt);
        const axis = Math.abs(gp.moveY) > 0.15 ? gp.moveY : gp.moveX;
        if (Math.abs(axis) > 0.15 && menuNavCooldownRef.current <= 0) {
          moveBestiarySelection(axis > 0 ? 1 : -1);
          menuNavCooldownRef.current = 0.22;
        }
        if (gp.cardB && !gp.prevCardB) {
          pauseBestiaryRef.current = false;
          setPauseBestiary(false);
        }
        if (gp.start && !gp.prevStart) togglePause();
      } else {
        menuNavCooldownRef.current = Math.max(0, menuNavCooldownRef.current - dt);
        if (Math.abs(gp.moveY) > 0.15 && menuNavCooldownRef.current <= 0) {
          const direction = gp.moveY > 0 ? 1 : -1;
          pauseSelectionRef.current = (pauseSelectionRef.current + direction + 4) % 4;
          setPauseSelection(pauseSelectionRef.current);
          menuNavCooldownRef.current = 0.22;
        }
        if (gp.fire && !gp.prevFire) {
          const ids = ['pauseResumeBtn', 'pauseBestiaryBtn', 'pauseOptionsBtn', 'pauseMenuBtn'];
          document.getElementById(ids[pauseSelectionRef.current])?.click();
        }
        if (gp.start && !gp.prevStart) togglePause();
      }
    }

    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      // Pass hasOverlay flag — tells renderer to skip drawing the default robot body
      const skinHasOverlay = playerSkinRef.current === 'rocket' || playerSkinRef.current === 'dots' || playerSkinRef.current === 'gem';
      if (ctx) draw(ctx, canvas.offsetWidth, canvas.offsetHeight, stateRef.current, skinHasOverlay);

      // Update DOM sprite overlay — position wrap, then blit pre-processed frame
      if (skinHasOverlay) {
        const wrap    = spriteWrapRef.current;
        const sCanvas = spriteCanvasRef.current;
        if (wrap && sCanvas) {
          const m  = getBoardMetrics(canvas.offsetWidth, canvas.offsetHeight);
          const px = m.x + (stateRef.current.player.col + 0.5) * m.cell;
          const py = m.y + (stateRef.current.player.row + 0.5) * m.cell;
          const szScale = playerSkinRef.current === 'dots' ? 1.0 : playerSkinRef.current === 'gem' ? 0.85 : 0.72;
          const sz = Math.round(m.cell * szScale);
          wrap.style.left   = `${px}px`;
          wrap.style.top    = `${py}px`;
          wrap.style.width  = `${sz}px`;
          wrap.style.height = `${sz}px`;

          const frames = gifFramesRef.current;
          if (frames.length > 0) {
            // Rocket: shoot-pose state machine via rocketFrameRef
            // Dots: auto-cycle walk animation via performance.now()
            // Gem idle: auto-cycle; Gem attack: use gifAttackFramesRef + gemAttackFrameRef
            let bitmap: ImageBitmap;
            if (playerSkinRef.current === 'rocket' && rocketFrameRef.current >= 0) {
              // Rocket attack — cycle through gifAttackFramesRef
              const aFrames = gifAttackFramesRef.current;
              bitmap = aFrames[Math.min(rocketFrameRef.current, aFrames.length - 1)];
            } else if (playerSkinRef.current === 'gem' && gemAttackFrameRef.current >= 0) {
              // Gem attack takes highest priority
              const aFrames = gifAttackFramesRef.current;
              bitmap = aFrames[gemAttackFrameRef.current % Math.max(1, aFrames.length)];
            } else if (playerSkinRef.current === 'gem' && gemMoveStartRef.current >= 0) {
              // Gem movement second priority
              const mFrames = gifMoveFramesRef.current;
              const elapsed = performance.now() - gemMoveStartRef.current;
              const mIdx = Math.min(Math.floor(elapsed / GEM_MOVE_FRAME_MS), mFrames.length - 1);
              bitmap = mFrames[mIdx % Math.max(1, mFrames.length)];
            } else if (playerSkinRef.current === 'dots' || playerSkinRef.current === 'gem') {
              // Idle auto-cycle
              bitmap = frames[Math.floor(performance.now() / 120) % frames.length];
            } else {
              // Rocket idle — frames[0] is the only idle frame
              bitmap = frames[0];
            }
            if (sCanvas.width !== sz || sCanvas.height !== sz) {
              sCanvas.width  = sz;
              sCanvas.height = sz;
            }
            const sctx = sCanvas.getContext('2d');
            if (sctx) {
              sctx.clearRect(0, 0, sz, sz);
              const mirror = playerSkinRef.current === 'gem' && gemMoveMirrorRef.current;
              if (mirror) {
                sctx.save();
                sctx.translate(sz, 0);
                sctx.scale(-1, 1);
                sctx.drawImage(bitmap, 0, 0, sz, sz);
                sctx.restore();
              } else {
                sctx.drawImage(bitmap, 0, 0, sz, sz);
              }
            }
          }
        }
      }

      const metrics = getBoardMetrics(canvas.offsetWidth, canvas.offsetHeight);
      const positionSkillEffect = (wrap: HTMLDivElement | null, rowOffset: -1 | 1) => {
        if (!wrap) return;
        const targetRow = stateRef.current.player.row + rowOffset;
        const onGrid = targetRow >= 0 && targetRow < 3;
        wrap.style.display = onGrid ? 'block' : 'none';
        if (!onGrid) return;
        const px = metrics.x + (stateRef.current.player.col + 0.5) * metrics.cell;
        const py = metrics.y + (targetRow + 0.5) * metrics.cell;
        const width = Math.round(metrics.cell * 1.55);
        wrap.style.left = `${px}px`;
        wrap.style.top = `${py}px`;
        wrap.style.width = `${width}px`;
        wrap.style.height = `${Math.round(width * 2 / 3)}px`;
      };
      positionSkillEffect(skillNorthFxRef.current, -1);
      positionSkillEffect(skillSouthFxRef.current, 1);
      const playerSkillFx = skillPlayerFxRef.current;
      if (playerSkillFx) {
        const px = metrics.x + (stateRef.current.player.col + 0.5) * metrics.cell;
        const py = metrics.y + (stateRef.current.player.row + 0.5) * metrics.cell;
        playerSkillFx.style.left = `${px}px`;
        playerSkillFx.style.top = `${py}px`;
        playerSkillFx.style.width = `${Math.round(metrics.cell * 0.78)}px`;
        playerSkillFx.style.height = `${Math.round(metrics.cell * 0.9)}px`;
      }

      const positionClone = (wrap: HTMLDivElement | null, direction: CloneDirection) => {
        if (!wrap) return;
        const row = cloneSessionRef.current.rows[direction];
        const onGrid = cloneSessionRef.current.visible && cloneSessionRef.current.revealed && row !== null;
        wrap.style.display = onGrid ? 'block' : 'none';
        if (!onGrid || row === null) return;
        const px = metrics.x + (stateRef.current.player.col + 0.5) * metrics.cell;
        const py = metrics.y + (row + 0.5) * metrics.cell;
        wrap.style.left = `${px}px`;
        wrap.style.top = `${py}px`;
        wrap.style.width = `${Math.round(metrics.cell * 0.82)}px`;
        wrap.style.height = `${Math.round(metrics.cell * 0.92)}px`;
      };
      positionClone(cloneNorthRef.current, 'north');
      positionClone(cloneSouthRef.current, 'south');
    }

    animRef.current = requestAnimationFrame(loop);
  }, [update, handleGamepad, moveBestiarySelection]);

  // Resize canvas to match DPR
  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const m = getBoardMetrics(window.innerWidth, window.innerHeight);
    setBoardBottom(m.y + m.boardH);
  }, []);

  const startGame = useCallback((mode: GameMode = 'classic') => {
    for (const direction of ['north', 'south'] as const) {
      const timer = cloneActionTimersRef.current[direction];
      if (timer) clearTimeout(timer);
      cloneActionTimersRef.current[direction] = null;
    }
    const clearedClones = emptyCloneView();
    cloneSessionRef.current = clearedClones;
    setCloneView(clearedClones);
    stateRef.current = makeInitialState(enabledAbilitiesRef.current, mode);
    eloAttackDirectionRef.current = 1;
    gemMoveMirrorRef.current = true;
    lastTimeRef.current = 0;
    hudTickRef.current = 0;
    phaseRef.current = 'playing';
    menuSelectionRef.current = 0;
    setMenuSelection(0);
    setPhase('playing');
    updateHud();
    if (mode === 'vs') {
      showMessage('VS NPC — kill viruses to send green attacks at the NPC!', 3000);
    } else {
      showMessage('Tap blue panels to move. Use BUSTER button to fire manually.', 2500);
    }
    startMusic(() => stateRef.current.running);
  }, [updateHud, showMessage]);

  const togglePause = useCallback(() => {
    if (phaseRef.current !== 'playing') return;
    const s = stateRef.current;
    if (!s.running) return;
    pausedRef.current = !pausedRef.current;
    if (pausedRef.current) {
      pauseSelectionRef.current = 0;
      setPauseSelection(0);
      menuNavCooldownRef.current = 0;
    } else {
      pauseBestiaryRef.current = false;
      setPauseBestiary(false);
      pauseOptionsRef.current = false;
      setPauseOptions(false);
    }
    lastTimeRef.current = 0; // reset so dt doesn't spike on resume
    setPaused(pausedRef.current);
  }, []);

  const restart = useCallback(() => {
    stopMusic();
    for (const direction of ['north', 'south'] as const) {
      const timer = cloneActionTimersRef.current[direction];
      if (timer) clearTimeout(timer);
      cloneActionTimersRef.current[direction] = null;
    }
    const clearedClones = emptyCloneView();
    cloneSessionRef.current = clearedClones;
    setCloneView(clearedClones);
    stateRef.current = makeInitialState(enabledAbilitiesRef.current);
    lastTimeRef.current = 0;
    hudTickRef.current = 0;
    phaseRef.current = 'menu';
    menuScreenRef.current = 'main';
    menuSelectionRef.current = 0;
    pauseSelectionRef.current = 0;
    pausedRef.current = false;
    pauseBestiaryRef.current = false;
    pauseOptionsRef.current = false;
    // Reset reward accumulator for new session
    rewardAccRef.current.reset();
    setSessionCGRD(0);
    setGameKills([]);
    setPaused(false);
    setPauseBestiary(false);
    setPauseOptions(false);
    setMenuScreen('main');
    setMenuSelection(0);
    setPauseSelection(0);
    setPhase('menu');
    updateHud();
  }, [updateHud]);

  // Pointer tap on board to move player
  const handleCanvasPointer = useCallback((ev: React.PointerEvent<HTMLCanvasElement>) => {
    ensureAudio();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = ev.clientX - rect.left;
    const y = ev.clientY - rect.top;
    const m = getBoardMetrics(canvas.offsetWidth, canvas.offsetHeight);
    if (x < m.x || x > m.x + m.boardW || y < m.y || y > m.y + m.boardH) return;
    const col = Math.floor((x - m.x) / m.cell);
    const row = Math.floor((y - m.y) / m.cell);
    if (col <= 2) tryMoveTo(col, row);
  }, [tryMoveTo]);

  // Dpad touch setup — stable handler refs so cleanup matches the originals
  const setupDpad = useCallback((dir: keyof typeof touchDpadRef.current, el: HTMLElement) => {
    const setTrue  = () => { touchDpadRef.current[dir] = true; };
    const setFalse = () => { touchDpadRef.current[dir] = false; };
    const onDown = (ev: PointerEvent) => {
      ev.preventDefault();
      ensureAudio();
      el.setPointerCapture(ev.pointerId);
      setTrue();
    };
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointerup', setFalse);
    el.addEventListener('pointercancel', setFalse);
    el.addEventListener('lostpointercapture', setFalse);
    return () => {
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointerup', setFalse);
      el.removeEventListener('pointercancel', setFalse);
      el.removeEventListener('lostpointercapture', setFalse);
    };
  }, []);


  useEffect(() => {
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Keyboard
    const onKeyDown = (ev: KeyboardEvent) => {
      ensureAudio();
      // Start game from menu on Enter/Space
      if (phaseRef.current === 'menu') {
        if (ev.key === 'Enter' || ev.key === ' ') startGame();
        return;
      }
      if (ev.repeat) return;
      if (ev.key === 'Escape' || ev.key === 'p' || ev.key === 'P') { togglePause(); return; }
      const s = stateRef.current;
      if (!s.running || pausedRef.current) return;
      const k = keyboardRef.current;
      if (ev.key === 'ArrowUp' || ev.key === 'w') k.up = true;
      else if (ev.key === 'ArrowDown' || ev.key === 's') k.down = true;
      else if (ev.key === 'ArrowLeft' || ev.key === 'a') k.left = true;
      else if (ev.key === 'ArrowRight' || ev.key === 'd') k.right = true;
      else if (ev.key === ' ') manualBuster();
      else if ((ev.key === 'z' || ev.key === 'Z') && s.currentCardOptions[0]) useCard(s.currentCardOptions[0]);
      else if ((ev.key === 'x' || ev.key === 'X') && s.currentCardOptions[1]) useCard(s.currentCardOptions[1]);
      else if ((ev.key === 'c' || ev.key === 'C') && s.currentCardOptions[2]) useCard(s.currentCardOptions[2]);
      else if (ev.key === 'v' || ev.key === 'V') playSkillAnimation();
      else if (ev.key === 'r' || ev.key === 'R') rotateHand();
    };
    const onKeyUp = (ev: KeyboardEvent) => {
      const k = keyboardRef.current;
      if (ev.key === 'ArrowUp' || ev.key === 'w') k.up = false;
      else if (ev.key === 'ArrowDown' || ev.key === 's') k.down = false;
      else if (ev.key === 'ArrowLeft' || ev.key === 'a') k.left = false;
      else if (ev.key === 'ArrowRight' || ev.key === 'd') k.right = false;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    // D-pad
    const dpadMap: [string, keyof typeof touchDpadRef.current][] = [
      ['dpadUp', 'up'], ['dpadDown', 'down'], ['dpadLeft', 'left'], ['dpadRight', 'right'],
    ];
    const cleanups: (() => void)[] = [];
    for (const [id, dir] of dpadMap) {
      const el = document.getElementById(id);
      if (el) cleanups.push(setupDpad(dir, el));
    }

    // D-pad center = fire
    const center = document.getElementById('dpadCenter');
    if (center) {
      const onDown = (ev: PointerEvent) => { ev.preventDefault(); ensureAudio(); center.setPointerCapture(ev.pointerId); manualBuster(); };
      center.addEventListener('pointerdown', onDown);
      cleanups.push(() => center.removeEventListener('pointerdown', onDown));
    }

    // Start canvas render loop immediately (draws idle state behind menu)
    animRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animRef.current);
      stopMusic();
      window.removeEventListener('resize', resizeCanvas);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      cleanups.forEach((c) => c());
    };
  }, [resizeCanvas, loop, manualBuster, playSkillAnimation, setupDpad, startGame, rotateHand, useCard]);

  const toggleAuto = () => {
    ensureAudio();
    playAutoToggle();
    stateRef.current.autoBuster = !stateRef.current.autoBuster;
    updateHud();
  };

  const toggleVirtualDpad = () => {
    setVirtualDpadEnabled((enabled) => {
      const next = !enabled;
      localStorage.setItem(VIRTUAL_DPAD_KEY, next ? 'on' : 'off');
      return next;
    });
  };

  const cardProgress = Math.max(0, Math.min(1, hud.cardTimer / CARD_CHARGE_TIME));
  const bestiaryPanel = (onBack: () => void) => (
    <div id="bestiaryCard">
      <div id="bestiaryHeader">
        <div>
          <div id="bestiaryTitle">BESTIARY</div>
          <div id="bestiaryCount">{bestiaryEntries.length} stable discoveries</div>
        </div>
        <button id="menuBackBtn" className="bestiaryBackBtn" onClick={(ev) => { ev.stopPropagation(); onBack(); }}>← BACK</button>
      </div>
      <div id="bestiaryLegend">
        <span>CORE</span><span>ELEMENT</span><span>TYPE</span><span>CLASS</span><span>FUSION</span>
      </div>
      {bestiaryEntries.length === 0 ? (
        <div id="bestiaryEmpty">Encounter entities in play to record stable genome snapshots.</div>
      ) : (
        <div id="bestiaryGrid">
          {bestiaryEntries.map((entry, index) => {
            const genome = entry.genome;
            return (
              <article
                id={`bestiaryEntry-${index}`}
                className={`bestiaryEntry${bestiarySelection === index ? ' gamepad-selected' : ''}`}
                key={entry.signature}
              >
                <BestiarySprite seed={entry.seed} genome={genome} />
                <div className="bestiaryIdentity">
                  {genome.entityType.toUpperCase()} / {genome.element.toUpperCase()} / {genome.enemyClass.toUpperCase()}
                </div>
                <div className="bestiaryMeta">
                  <span>Core <b>{genome.baseElement}</b></span>
                  <span>Generation <b>{genome.generation}</b></span>
                  <span>Fusion <b>{genome.fusionLevel}</b></span>
                  <span>Niche <b>{genome.niche}</b></span>
                </div>
                <div className="bestiaryTraits">
                  {genome.mutations.length > 0 ? genome.mutations.join(' · ') : 'baseline'}
                </div>
                {genome.fusionElement && (
                  <div className="bestiaryLineage">
                    {genome.baseElement} + {genome.fusionElement}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );

  const optionsPanel = (onBack: () => void, pausedView = false) => (
    <div id="optionsCard">
      <div id="optionsTitle">OPTIONS</div>
      <button
        id={pausedView ? 'pauseDpadToggleBtn' : 'menuDpadToggleBtn'}
        className="optionToggleBtn gamepad-selected"
        aria-pressed={virtualDpadEnabled}
        onClick={(event) => {
          event.stopPropagation();
          toggleVirtualDpad();
        }}
      >
        <span>
          <strong>VIRTUAL D-PAD</strong>
          <small>Show the on-screen movement control</small>
        </span>
        <b>{virtualDpadEnabled ? 'ON' : 'OFF'}</b>
      </button>
      <button
        id="menuBackBtn"
        className="bestiaryBackBtn"
        onClick={(event) => {
          event.stopPropagation();
          onBack();
        }}
      >
        ← BACK
      </button>
    </div>
  );

  return (
    <div id="game">
      <canvas
        ref={canvasRef}
        id="canvas"
        onPointerDown={handleCanvasPointer}
      />

      {/* Sprite overlay — canvas only; no background so pixel-removed areas are
          transparent and reveal the game canvas beneath */}
      {phase === 'playing' && (playerSkin === 'rocket' || playerSkin === 'dots' || playerSkin === 'gem') && (
        <div
          ref={spriteWrapRef}
          style={{
            position: 'absolute',
            pointerEvents: 'none',
            transform: 'translate(-50%,-50%)',
            opacity: playerSkin === 'gem' && !hud.autoBuster ? 0.52 : 1,
            filter: playerSkin === 'gem' && !hud.autoBuster ? 'drop-shadow(0 0 8px #a78bfa)' : 'none',
            transition: 'opacity 150ms ease, filter 150ms ease',
          }}
        >
          <canvas
            ref={spriteCanvasRef}
            style={{ position: 'relative', display: 'block', imageRendering: 'pixelated' }}
          />
        </div>
      )}

      {phase === 'playing' && skillFxActive && (
        <>
          <div
            key={`player-${skillFxRun}`}
            ref={skillPlayerFxRef}
            className="skillPlayerFx"
            aria-hidden="true"
          >
            <img
              src={`${import.meta.env.BASE_URL}effects/temporary-avatar.png`}
              alt=""
            />
          </div>
          {(['north', 'south'] as const).map((direction) => (
            <div
              key={`${direction}-${skillFxRun}`}
              ref={direction === 'north' ? skillNorthFxRef : skillSouthFxRef}
              className="skillFxWrap"
              data-direction={direction}
              aria-hidden="true"
            >
              <img
                src={`${import.meta.env.BASE_URL}effects/smoke-reveal-combined.webp?run=${skillFxRun}-${direction}`}
                alt=""
              />
            </div>
          ))}
        </>
      )}

      {phase === 'playing' && cloneView.visible && cloneView.revealed && (
        <>
          {(['north', 'south'] as const).map((direction) => {
            const status = cloneView.statuses[direction];
            if (cloneView.rows[direction] === null || status === 'gone') return null;
            const controlled = cloneView.inputActive && cloneView.controlled === direction;
            const defending = status === 'defending';
            const attacking = status === 'attacking';
            return (
              <div
                key={direction}
                ref={direction === 'north' ? cloneNorthRef : cloneSouthRef}
                className={[
                  'cloneAvatar',
                  controlled ? 'controlled' : '',
                  defending ? 'defending' : '',
                  attacking ? 'attacking' : '',
                  status === 'dispersing' ? 'dispersing' : '',
                ].filter(Boolean).join(' ')}
                data-direction={direction}
              >
                <img
                  src={`${import.meta.env.BASE_URL}effects/${
                    defending ? 'temporary-avatar-defense.png' : 'temporary-avatar.png'
                  }`}
                  alt=""
                />
                {controlled && <span>{direction.toUpperCase()}</span>}
              </div>
            );
          })}
        </>
      )}

      {phase === 'playing' && cloneView.inputActive && (
        <div
          id="cloneActionControls"
          style={{ top: boardBottom > 0 ? boardBottom + 12 : undefined }}
        >
          <button
            className="cloneActionBtn attack"
            onPointerDown={(event) => {
              event.stopPropagation();
              resolveCloneAction('attack');
            }}
          >
            <b>X</b>
            ATTACK
          </button>
          <button
            className="cloneActionBtn switch"
            disabled={cloneView.turn !== 0
              || cloneView.rows[cloneView.controlled === 'north' ? 'south' : 'north'] === null}
            onPointerDown={(event) => {
              event.stopPropagation();
              switchCloneControl();
            }}
          >
            <b>Y</b>
            SWITCH
          </button>
          <button
            className="cloneActionBtn defend"
            onPointerDown={(event) => {
              event.stopPropagation();
              resolveCloneAction('defend');
            }}
          >
            <b>B</b>
            DEFEND
          </button>
        </div>
      )}

      {/* HUD */}
      <div className="hud" id="hud">
        <div className="panel">
          HP {hud.hp}
          {hud.shieldCharges > 0 && (
            <span id="shieldChargesDisplay">
              {'🛡'.repeat(Math.min(hud.shieldCharges, 9))}
              {hud.shieldCharges > 9 ? ` ×${hud.shieldCharges}` : ''}
            </span>
          )}
        </div>
        <div className="panel">Score {hud.score}</div>
        {hud.gameMode === 'vs' ? (
          <div className="panel" id="npcHpPanel" data-overheal={hud.npcHp > NPC_HP ? 'true' : 'false'}>
            NPC {hud.npcHp} HP{hud.npcHp > NPC_HP ? ' ▲' : ''}
            {hud.npcShieldCharges > 0 && (
              <span id="npcShieldDisplay">{'🛡'.repeat(Math.min(hud.npcShieldCharges, 9))}</span>
            )}
          </div>
        ) : (
          <div className="panel">Wave {hud.wave}</div>
        )}
      </div>

      {phase === 'playing' && (
        <div id="ecosystemHud">
          <span className="ecosystemTitle">EVOLVING ECOSYSTEM</span>
          <span>DISCOVERED <b>{hud.ecosystem.species}</b></span>
          <span>TRAITS <b>{hud.ecosystem.mutations}</b></span>
          <span>MAX GEN <b>{hud.ecosystem.generation}</b></span>
          <span className={hud.ecosystem.fusions > 0 ? 'fusionActive' : ''}>
            FUSIONS <b>{hud.ecosystem.fusions}</b>
          </span>
          <span className={`pressureState ${hud.pressureState}`}>
            {hud.pressureState === 'critical'
              ? 'PRESSURE'
              : hud.pressureState === 'recovery' ? 'RECOVERY' : 'STEADY'}
          </span>
        </div>
      )}

      {/* Card UI + rotate button — column, positioned just below the grid */}
      <div id="cardUiWrapper" style={{ top: boardBottom > 0 ? boardBottom + 12 : undefined }}>
        <div id="cardUi">
          <div id="cardCharge">
            <div id="cardChargeLabel" ref={cardLabelRef}>
              {hud.cardsReady ? 'Choose ability cards — ROTATE to reset timer' : ''}
            </div>
            <div id="cardBarTrack">
              <div id="cardBarFill" ref={cardBarFillRef} style={{ width: hud.cardsReady ? '100%' : `${cardProgress * 100}%` }} />
            </div>
          </div>

          {hud.cardsReady && (
            <div id="cardChoices">
              {hud.cardOptions.map((id) => {
                const ability = ABILITY_LOOKUP[id];
                if (!ability) return null;
                const cd = Math.ceil(hud.abilityCooldowns[id] ?? 0);
                const used = hud.usedInHand.includes(id);
                const disabled = used || cd > 0;
                return (
                  <button
                    key={id}
                    className={`card-btn${used ? ' used' : ''}`}
                    disabled={disabled}
                    onPointerDown={(ev) => {
                      ev.stopPropagation();
                      ensureAudio();
                      useCard(id);
                    }}
                  >
                    {ability.name}<br />
                    <span>
                      {cd > 0 ? `Cooldown ${cd}s` : used ? 'Used' : ability.desc}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Rotate button — resets the bar timer; disabled once all cards are spent */}
        {phase === 'playing' && (
          <button
            id="rotateHandBtn"
            className="control-btn"
            disabled={hud.rotateUsedThisHand || (
              hud.cardsReady
              && hud.cardOptions.length > 0
              && hud.cardOptions.every((id) => hud.usedInHand.includes(id))
            )}
            onPointerDown={(ev) => {
              ev.stopPropagation();
              rotateHand();
            }}
          >
            {hud.rotateUsedThisHand ? 'ROTATE USED' : '↻ ROTATE'}
          </button>
        )}
      </div>

      {/* D-Pad */}
      <div id="dpad" style={{ display: virtualDpadEnabled ? undefined : 'none' }} aria-hidden={!virtualDpadEnabled}>
        <div className="dpad-btn" id="dpadUp" />
        <div className="dpad-btn" id="dpadDown" />
        <div className="dpad-btn" id="dpadLeft" />
        <div className="dpad-btn" id="dpadRight" />
        <div className="dpad-btn" id="dpadCenter" />
      </div>

      {/* Controls */}
      <div id="controls">
        {phase === 'playing' && (
          <button
            id="rotateLandscapeBtn"
            className="control-btn"
            disabled={hud.rotateUsedThisHand || (
              hud.cardsReady
              && hud.cardOptions.length > 0
              && hud.cardOptions.every((id) => hud.usedInHand.includes(id))
            )}
            onPointerDown={(ev) => {
              ev.stopPropagation();
              rotateHand();
            }}
          >
            {hud.rotateUsedThisHand ? 'ROTATE USED' : '↻ ROTATE'}
          </button>
        )}

        {phase === 'playing' && (
          <button
            id="skillBtn"
            className="control-btn"
            onPointerDown={(event) => {
              event.stopPropagation();
              playSkillAnimation();
            }}
          >
            SKILL
            <small>V · L2</small>
          </button>
        )}

        <button
          id="autoToggle"
          className={`control-btn ${hud.autoBuster ? 'on' : 'off'}`}
          onPointerDown={(ev) => { ev.stopPropagation(); toggleAuto(); }}
        >
          Auto: {hud.autoBuster ? 'ON' : 'OFF'}
        </button>

        <button
          id="busterBtn"
          className="control-btn"
          onPointerDown={(ev) => { ev.stopPropagation(); ensureAudio(); manualBuster(); }}
        >
          BUSTER
        </button>
      </div>

      {/* Pause button — centered below the d-pad, separate from the controls row */}
      {phase === 'playing' && hud.running && (
        <button
          id="pauseBtn"
          className="control-btn"
          onPointerDown={(ev) => { ev.stopPropagation(); togglePause(); }}
        >
          {paused ? '▶ RESUME' : '⏸ PAUSE'}
        </button>
      )}

      {/* Main Menu overlay */}
      {phase === 'menu' && (
        <div id="mainMenu">
          {menuScreen === 'main' ? (
            <div id="menuCard">
              <div id="menuTitle">CYBERGRID<br />STRIKE</div>
              <div id="menuTagline">Defend the grid. Eliminate the viruses.</div>
              <div id="preEvoLabel">⬡ PRE-EVOLUTION EDITION ⬡</div>
              <button
                id="menuPlayBtn"
                className={menuSelection === 0 ? 'gamepad-selected' : ''}
                onClick={(ev) => { ev.stopPropagation(); ensureAudio(); startGame('classic'); }}
              >
                ▶ PLAY
              </button>
              <button
                id="menuVsBtn"
                className={menuSelection === 1 ? 'gamepad-selected' : ''}
                onClick={(ev) => { ev.stopPropagation(); ensureAudio(); startGame('vs'); }}
              >
                ⚔ VS NPC
              </button>
              <button
                id="menuCustomBtn"
                className={menuSelection === 2 ? 'gamepad-selected' : ''}
                onClick={(ev) => {
                  ev.stopPropagation();
                  menuScreenRef.current = 'customization';
                  setMenuScreen('customization');
                }}
              >
                ⚙ Customization
              </button>
              <button
                id="menuBestiaryBtn"
                className={menuSelection === 3 ? 'gamepad-selected' : ''}
                onClick={(ev) => {
                  ev.stopPropagation();
                  menuScreenRef.current = 'bestiary';
                  bestiarySelectionRef.current = 0;
                  setBestiarySelection(0);
                  setMenuScreen('bestiary');
                }}
              >
                ◈ Bestiary ({bestiaryEntries.length})
              </button>
              <button
                id="menuOptionsBtn"
                className={menuSelection === 4 ? 'gamepad-selected' : ''}
                onClick={(event) => {
                  event.stopPropagation();
                  menuScreenRef.current = 'options';
                  setMenuScreen('options');
                }}
              >
                ⚙ Options
              </button>
              <div id="menuControls">
                <div className="menu-control-row"><span>Move</span><span>Tap grid · D-pad · WASD</span></div>
                <div className="menu-control-row"><span>Fire</span><span>Auto or BUSTER · Space</span></div>
                <div className="menu-control-row"><span>Abilities</span><span>Use all 3 cards, then hand resets</span></div>
                <div className="menu-control-row"><span>Rotate</span><span>ROTATE button or R key — once per hand, then locked until the next deal</span></div>
              </div>
            </div>
          ) : menuScreen === 'customization' ? (
            <div id="menuCard" className="customization-card">
              <div id="menuTitle" style={{ fontSize: 'clamp(20px, 5vw, 28px)' }}>⚙ Customization</div>

              {/* Skin selector */}
              <div id="customSubtitle">Player skin</div>
              <div id="skinPickerRow">
                {([
                  { id: 'default', label: 'Default', preview: null },
                  { id: 'rocket',  label: 'Rocket',  preview: `${import.meta.env.BASE_URL}skins/rocket.gif` },
                  { id: 'dots',    label: 'Dots',    preview: `${import.meta.env.BASE_URL}skins/dots.gif` },
                  { id: 'gem',     label: 'Player',  preview: `${import.meta.env.BASE_URL}skins/gem_thumb.png` },
                ] as { id: PlayerSkin; label: string; preview: string | null }[]).map((skin) => (
                  <button
                    key={skin.id}
                    className={`skin-btn ${playerSkin === skin.id ? 'selected' : ''}`}
                    onPointerDown={(ev) => {
                      ev.stopPropagation();
                      playerSkinRef.current = skin.id;
                      setPlayerSkin(skin.id);
                      localStorage.setItem(SKIN_KEY, skin.id);
                    }}
                  >
                    {skin.preview
                      ? <SkinPreviewCanvas src={skin.preview} />
                      : <span className="skin-default-icon">🤖</span>}
                    <span className="skin-label">{skin.label}</span>
                  </button>
                ))}
              </div>

              <div id="customSubtitle" style={{ marginTop: '16px' }}>Abilities in card draws</div>
              <div id="abilityToggleGrid">
                {ABILITY_POOL.map((ability) => {
                  const on = enabledAbilities.has(ability.id);
                  return (
                    <button
                      key={ability.id}
                      className={`ability-toggle-btn ${on ? 'enabled' : 'disabled'}`}
                      onPointerDown={(ev) => {
                        ev.stopPropagation();
                        setEnabledAbilities((prev) => {
                          const next = new Set(prev);
                          if (next.has(ability.id)) {
                            // Keep at least one enabled
                            if (next.size > 1) next.delete(ability.id);
                          } else {
                            next.add(ability.id);
                          }
                          enabledAbilitiesRef.current = next;
                          return next;
                        });
                      }}
                    >
                      <span className="ability-toggle-name">{ability.name}</span>
                      <span className="ability-toggle-desc">{ability.desc}</span>
                      <span className="ability-toggle-badge">{on ? 'ON' : 'OFF'}</span>
                    </button>
                  );
                })}
              </div>
              <button
                id="menuBackBtn"
                onClick={(ev) => {
                  ev.stopPropagation();
                  menuScreenRef.current = 'main';
                  menuSelectionRef.current = 0;
                  setMenuSelection(0);
                  setMenuScreen('main');
                }}
              >
                ← Back
              </button>
            </div>
          ) : menuScreen === 'bestiary' ? (
            bestiaryPanel(() => {
              menuScreenRef.current = 'main';
              menuSelectionRef.current = 0;
              setMenuSelection(0);
              setMenuScreen('main');
            })
          ) : (
            optionsPanel(() => {
              menuScreenRef.current = 'main';
              menuSelectionRef.current = 0;
              setMenuSelection(0);
              setMenuScreen('main');
            })
          )}
        </div>
      )}

      {phase === 'playing' && hud.upgradePromptOpen && !hud.upgradeSelectionOpen && (
        <button
          id="upgradePrompt"
          onPointerDown={(event) => {
            event.stopPropagation();
            openUpgradeSelection();
          }}
        >
          <strong>EVOLUTION READY · {Math.max(0, Math.ceil(hud.upgradePromptTimer))}s</strong>
          <span>Tap or press R1 to enter slow-time selection</span>
        </button>
      )}

      {phase === 'playing' && hud.upgradeSelectionOpen && (
        <div id="upgradeOverlay">
          <div id="upgradeCard">
            <div id="upgradeEyebrow">WAVE {hud.wave} MILESTONE</div>
            <div id="upgradeTitle">EVOLVE</div>
            <div id="upgradeSubtitle">Combat remains active at 8% speed</div>
            <div id="upgradeChoices">
              {hud.upgradeOptions.map((id, index) => {
                const upgrade = RUN_UPGRADES.find((candidate) => candidate.id === id);
                if (!upgrade) return null;
                const currentLevel = hud.runUpgrades[id] ?? 0;
                return (
                  <button
                    id={`upgradeChoice${index}`}
                    key={id}
                    className={`upgradeChoice${upgradeSelection === index ? ' gamepad-selected' : ''}`}
                    onPointerDown={(event) => {
                      event.stopPropagation();
                      chooseRunUpgrade(id);
                    }}
                  >
                    <span className="upgradeLevel">LV {currentLevel} → {currentLevel + 1}</span>
                    <strong>{upgrade.name}</strong>
                    <span>{upgrade.desc}</span>
                  </button>
                );
              })}
            </div>
            <div id="upgradeHint">D-PAD to choose · A to install</div>
          </div>
        </div>
      )}

      {/* Pause overlay */}
      {paused && phase === 'playing' && !pauseBestiary && !pauseOptions && (
        <div id="pauseOverlay">
          <div id="pauseCard">
            <div id="pauseTitle">PAUSED</div>
            <button
              id="pauseResumeBtn"
              className={pauseSelection === 0 ? 'gamepad-selected' : ''}
              onClick={(ev) => { ev.stopPropagation(); togglePause(); }}
            >
              ▶ RESUME
            </button>
            <button
              id="pauseBestiaryBtn"
              className={pauseSelection === 1 ? 'gamepad-selected' : ''}
              onClick={(ev) => {
                ev.stopPropagation();
                pauseBestiaryRef.current = true;
                bestiarySelectionRef.current = 0;
                setBestiarySelection(0);
                setPauseBestiary(true);
              }}
            >
              BESTIARY ({bestiaryEntries.length})
            </button>
            <button
              id="pauseOptionsBtn"
              className={pauseSelection === 2 ? 'gamepad-selected' : ''}
              onClick={(event) => {
                event.stopPropagation();
                pauseOptionsRef.current = true;
                setPauseOptions(true);
              }}
            >
              OPTIONS
            </button>
            <button
              id="pauseMenuBtn"
              className={pauseSelection === 3 ? 'gamepad-selected' : ''}
              onClick={(ev) => { ev.stopPropagation(); restart(); }}
            >
              MAIN MENU
            </button>
          </div>
        </div>
      )}

      {paused && phase === 'playing' && pauseBestiary && (
        <div id="pauseOverlay">
          {bestiaryPanel(() => {
            pauseBestiaryRef.current = false;
            setPauseBestiary(false);
          })}
        </div>
      )}

      {paused && phase === 'playing' && pauseOptions && (
        <div id="pauseOverlay">
          {optionsPanel(() => {
            pauseOptionsRef.current = false;
            setPauseOptions(false);
          }, true)}
        </div>
      )}

      {/* Game Over / Victory overlay */}
      {!hud.running && phase === 'playing' && (
        <div id="gameOverOverlay" className={hud.playerWon ? 'victory' : ''}>
          <div id="gameOverCard" className={hud.playerWon ? 'victory' : ''}>
            <div id="gameOverTitle">{hud.playerWon ? 'SYSTEM OVERRIDE' : 'CONNECTION LOST'}</div>
            {hud.playerWon
              ? <div id="gameOverScore">NPC neutralised — Score: {hud.score}</div>
              : <>
                  <div id="gameOverScore">Score: {hud.score}</div>
                  {hud.gameMode === 'classic' && <div id="gameOverWave">Wave: {hud.wave}</div>}
                </>
            }
            <ChainPanel
              kills={gameKills}
              totalCGRD={sessionCGRD}
              gameOver={true}
              finalScore={hud.score}
              finalWave={hud.wave}
            />
            <button
              id="playAgainBtn"
              className="gamepad-selected"
              onClick={(ev) => { ev.stopPropagation(); ensureAudio(); restart(); }}
            >
              PLAY AGAIN
            </button>
          </div>
        </div>
      )}

      {/* Status message */}
      {hud.message && (
        <div id="message">{hud.message}</div>
      )}
    </div>
  );
}
