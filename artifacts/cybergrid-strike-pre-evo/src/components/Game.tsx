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
import type { GameState, GameMode } from '../game/types';
import { ABILITY_POOL, ABILITY_LOOKUP, CARD_CHARGE_TIME, NPC_HP, NPC_FIRE_INTERVAL, NPC_MOVE_INTERVAL } from '../game/constants';
import { draw, getBoardMetrics } from '../game/renderer';
import {
  ensureAudio, startMusic, stopMusic,
  playShot, playHit, playScore, playGameOver,
  playMove, playAutoToggle, playCardReady, playAbility,
} from '../game/audio';
import { pickDiverseSeed, registerSpawn, getMorphSig } from '../game/virus-morphology';
import { canFuse, createGenome, fuseGenomes, selectAdaptiveRow } from '../game/evolution';
import { getEnemyMovementClass, type EnemyMovementClass } from '../game/procedural-virus';
import { ELEMENT_DOMAIN } from '../game/element-matrix';

const ALL_ABILITY_IDS = new Set(ABILITY_POOL.map((a) => a.id));
const AIR_CLASSES = new Set<EnemyMovementClass>(['flier', 'hover', 'spectral']);
const FLUID_CLASSES = new Set<EnemyMovementClass>(['aquatic', 'serpentine', 'tentacled']);
const GROUNDED_CLASSES = new Set<EnemyMovementClass>(['biped', 'quadruped', 'arthropod', 'burrower', 'vehicle', 'fortress']);
const HEAVY_CLASSES = new Set<EnemyMovementClass>(['fortress', 'vehicle', 'rooted']);
const CYBER_BASES = new Set([
  'robot', 'drone', 'vehicle', 'cyborg', 'mech', 'nanite',
  'data-wraith', 'turret', 'fish', 'mole',
]);

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

function randomAbilityOptions(exclude?: string[], enabledIds?: Set<string>): string[] {
  const source = enabledIds
    ? ABILITY_POOL.filter((a) => enabledIds.has(a.id))
    : ABILITY_POOL;
  // Need at least 1 enabled ability; fall back to full pool if somehow all disabled
  const pool = [...(source.length > 0 ? source : ABILITY_POOL)];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  let opts = pool.slice(0, 3).map((a) => a.id);
  if (exclude && pool.length > 3) {
    let guard = 0;
    while (guard < 8 && opts.join('|') === exclude.join('|')) {
      opts = randomAbilityOptions(undefined, enabledIds);
      guard++;
    }
  }
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
  ecosystem: { species: number; mutations: number; generation: number; fusions: number };
}

export default function Game() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<GameState>(makeInitialState());
  const animRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  // Input state (refs — no re-render needed)
  const keyboardRef = useRef({ up: false, down: false, left: false, right: false });
  const touchDpadRef = useRef({ up: false, down: false, left: false, right: false });
  const gamepadRef = useRef({
    moveX: 0, moveY: 0,
    fire: false, prevFire: false,
    cardX: false, prevCardX: false,   // button 2 → card slot 0
    cardY: false, prevCardY: false,   // button 3 → card slot 1
    cardB: false, prevCardB: false,   // button 1 → card slot 2
    rotate: false, prevRotate: false, // button 8/17 → rotate hand
    start: false, prevStart: false,   // button 9 → pause
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

  const [phase, setPhase] = useState<'menu' | 'playing'>('menu');
  const phaseRef = useRef<'menu' | 'playing'>('menu');
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  const [menuScreen, setMenuScreen] = useState<'main' | 'customization'>('main');
  const menuScreenRef = useRef<'main' | 'customization'>('main');
  const [menuSelection, setMenuSelection] = useState(0);
  const menuSelectionRef = useRef(0);
  const [pauseSelection, setPauseSelection] = useState(0);
  const pauseSelectionRef = useRef(0);
  const menuNavCooldownRef = useRef(0);

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
  const gemMoveMirrorRef   = useRef(false);

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
    cardsReady: false, cardSelectionOpen: false, cardTimer: 0,
    cardOptions: [], usedInHand: [], abilityCooldowns: {}, running: true,
    message: 'Tap blue panels to move. Use BUSTER button to fire manually.',
    gameMode: 'classic', npcHp: NPC_HP, npcShieldCharges: 0, playerWon: false,
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
      cardTimer: s.cardTimer,
      cardOptions: [...s.currentCardOptions],
      usedInHand: [...s.usedInHand],
      abilityCooldowns: { ...s.abilityCooldowns },
      running: s.running,
      gameMode: s.gameMode,
      npcHp: s.npc.hp,
      npcShieldCharges: s.npc.shieldCharges,
      playerWon: s.playerWon,
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
    if (s.voltageTimer > 0) { big = true; pierce = true; }
    if (s.doubleTimer > 0) power *= 2;
    if (!pierce && s.pierceShots > 0) {
      pierce = true;
      s.pierceShots = Math.max(0, s.pierceShots - 1);
    }
    if (s.critTimer > 0 && Math.random() < 0.4) power *= 3;
    s.bullets.push({ colPos: s.player.col + 0.55, row, speed: 8.5, power, big, pierce });
    if (s.echoTimer > 0) {
      const echoRow = (row + 1) % 3;
      s.bullets.push({ colPos: s.player.col + 0.55, row: echoRow, speed: 8.5, power: Math.max(1, power - 1), big: false, pierce: false });
    }
    playShot();
    if (playerSkinRef.current === 'rocket') rocketShootFlash();
    if (playerSkinRef.current === 'gem') gemShootFlash();
  }, [rocketShootFlash, gemShootFlash]);

  const tryMoveTo = useCallback((col: number, row: number) => {
    const s = stateRef.current;
    if (!s.running) return;
    if (col < 0 || col > 2 || row < 0 || row > 2) return;
    // Mirror state: only update on horizontal moves; vertical moves inherit the last h-direction
    if (playerSkinRef.current === 'gem' && col !== s.player.col) {
      gemMoveMirrorRef.current = col > s.player.col;
    }
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
      s.player.fireCooldown = s.berserkTimer > 0 ? 0.09 : s.overclockTimer > 0 ? 0.16 : 0.25;
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
      let nextOptions = randomAbilityOptions(s.currentCardOptions, enabledAbilitiesRef.current);
      for (let g = 0; g < 12 && nextOptions.every((id) => (s.abilityCooldowns[id] ?? 0) > 0); g++) {
        nextOptions = randomAbilityOptions(nextOptions, enabledAbilitiesRef.current);
      }
      s.currentCardOptions = nextOptions;
      s.usedInHand = [];
      s.cardsReady = true;
      s.cardSelectionOpen = true;
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
    // Guard: disabled once all cards in the current hand have been used
    const allUsed = s.cardsReady && s.currentCardOptions.length > 0 &&
      s.currentCardOptions.every((id) => s.usedInHand.includes(id));
    if (allUsed) return;
    ensureAudio();
    s.cardsReady = false;
    s.cardSelectionOpen = false;
    s.cardTimer = 0;
    s.usedInHand = [];
    if (cardBarFillRef.current) cardBarFillRef.current.style.width = '0%';
    updateHud();
    showMessage('Timer reset — new hand incoming!', 1500);
  }, [showMessage, updateHud]);

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
        g.moveX = 0; g.moveY = 0;
        g.fire = false; g.prevFire = false;
        g.cardX = false; g.prevCardX = false;
        g.cardY = false; g.prevCardY = false;
        g.cardB = false; g.prevCardB = false;
        g.rotate = false; g.prevRotate = false;
        g.start = false; g.prevStart = false;
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
    g.prevFire = g.fire;
    g.fire = buttonPressed(0);            // A only
    g.prevCardX = g.cardX; g.cardX = buttonPressed(2);  // X → slot 0
    g.prevCardY = g.cardY; g.cardY = buttonPressed(3);  // Y → slot 1
    g.prevCardB = g.cardB; g.cardB = buttonPressed(1);  // B → slot 2
    g.prevRotate = g.rotate;
    g.rotate = buttonPressed(8) || buttonPressed(17);   // View / ellipsis / share
    g.prevStart = g.start; g.start = buttonPressed(9);  // Start → pause
    g.moveX = moveX;
    g.moveY = moveY;
    g.connected = true;
  }, []);

  const update = useCallback((dt: number) => {
    const s = stateRef.current;
    if (!s.running) return;

    handleGamepad();

    // Gamepad Start button → pause (rising edge)
    const gpForPause = gamepadRef.current;
    if (gpForPause.start && !gpForPause.prevStart) { togglePause(); return; }

    // Controller movement
    controllerCooldownRef.current = Math.max(0, controllerCooldownRef.current - dt);
    const kb = keyboardRef.current;
    const td = touchDpadRef.current;
    const gp = gamepadRef.current;
    let dx = 0, dy = 0;
    if (kb.left || td.left) dx = -1; else if (kb.right || td.right) dx = 1;
    if (kb.up || td.up) dy = -1; else if (kb.down || td.down) dy = 1;
    if (Math.abs(gp.moveX) > 0.15) dx = gp.moveX > 0 ? 1 : -1;
    if (Math.abs(gp.moveY) > 0.15) dy = gp.moveY > 0 ? 1 : -1;

    if ((dx !== 0 || dy !== 0) && controllerCooldownRef.current <= 0) {
      const nc = Math.max(0, Math.min(2, s.player.col + dx));
      const nr = Math.max(0, Math.min(2, s.player.row + dy));
      if (nc !== s.player.col || nr !== s.player.row) {
        tryMoveTo(nc, nr);
        controllerCooldownRef.current = 0.16;
      }
    }
    if (gp.fire && !fireHeldRef.current) manualBuster();
    fireHeldRef.current = gp.fire;
    if (gp.rotate && !gp.prevRotate) rotateHand();

    // Gamepad X/Y/B → ability card slots 0/1/2 (rising edge only)
    if (s.cardsReady && s.cardSelectionOpen) {
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
      s.cardTimer = Math.min(CARD_CHARGE_TIME, s.cardTimer + dt);
      const pct = (s.cardTimer / CARD_CHARGE_TIME) * 100;
      if (cardBarFillRef.current) cardBarFillRef.current.style.width = `${pct.toFixed(2)}%`;
      if (cardLabelRef.current) {
        const secs = Math.max(0, Math.ceil(CARD_CHARGE_TIME - s.cardTimer));
        cardLabelRef.current.textContent = `New hand in ${secs}s`;
      }
      if (s.cardTimer >= CARD_CHARGE_TIME) {
        s.cardsReady = true;
        s.cardSelectionOpen = true;
        s.usedInHand = [];
        playCardReady();
        showMessage('Ability Cards loaded! Use them, then hand resets.', false);
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
        s.currentCardOptions = randomAbilityOptions(s.currentCardOptions, enabledAbilitiesRef.current);
        updateHud();
      }
    }

    s.player.fireCooldown -= dt;
    if (s.autoBuster && s.player.fireCooldown <= 0) {
      s.player.fireCooldown = s.berserkTimer > 0 ? 0.09 : s.overclockTimer > 0 ? 0.16 : 0.34;
      fireBullet();
      if (s.multishotTimer > 0) fireBullet((s.player.row + 1) % 3);
      if (s.turretTimer > 0) {
        for (let r = 0; r < 3; r++) { if (r !== s.player.row) fireBullet(r); }
      }
    }

    // Spawn enemies
    s.enemySpawnTimer -= dt;
    if (s.enemySpawnTimer <= 0) {
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
      // Population density, combat pressure, and wave intensity all affect cadence.
      const pressure = s.lanePressure.reduce((sum, lane) => sum + lane, 0);
      const densityBrake = Math.max(0, livingEnemies.length - 5) * 0.07;
      const pressureBoost = Math.min(0.24, pressure * 0.012);
      s.enemySpawnTimer = Math.max(0.48, 1.12 - s.wave * 0.025 + densityBrake - pressureBoost);
    }

    // Move bullets
    for (const b of s.bullets) b.colPos += b.speed * dt;
    s.bullets = s.bullets.filter((b) => b.colPos < 6.4);

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
      if (Math.round(e.colPos) === s.player.col && e.row === s.player.row && e.colPos < s.player.col + 0.45) {
        const eloIsIntangible = playerSkinRef.current === 'gem' && !s.autoBuster;
        if (eloIsIntangible) {
          // Elo phases while automation is disabled. The enemy continues
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
            s.score += s.overdriveTimer > 0 ? 300 : 100;
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
  }, [handleGamepad, tryMoveTo, manualBuster, rotateHand, fireBullet, addParticles, showMessage, updateHud, endGame]);

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
          menuSelectionRef.current = (menuSelectionRef.current + direction + 3) % 3;
          setMenuSelection(menuSelectionRef.current);
          menuNavCooldownRef.current = 0.22;
        }
        if (gp.fire && !gp.prevFire) {
          const ids = ['menuPlayBtn', 'menuVsBtn', 'menuCustomBtn'];
          document.getElementById(ids[menuSelectionRef.current])?.click();
        }
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
      menuNavCooldownRef.current = Math.max(0, menuNavCooldownRef.current - dt);
      if (Math.abs(gp.moveY) > 0.15 && menuNavCooldownRef.current <= 0) {
        const direction = gp.moveY > 0 ? 1 : -1;
        pauseSelectionRef.current = (pauseSelectionRef.current + direction + 2) % 2;
        setPauseSelection(pauseSelectionRef.current);
        menuNavCooldownRef.current = 0.22;
      }
      if (gp.fire && !gp.prevFire) {
        const ids = ['pauseResumeBtn', 'pauseMenuBtn'];
        document.getElementById(ids[pauseSelectionRef.current])?.click();
      }
      if (gp.start && !gp.prevStart) togglePause();
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
    }

    animRef.current = requestAnimationFrame(loop);
  }, [update, handleGamepad]);

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
    stateRef.current = makeInitialState(enabledAbilitiesRef.current, mode);
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
    }
    lastTimeRef.current = 0; // reset so dt doesn't spike on resume
    setPaused(pausedRef.current);
  }, []);

  const restart = useCallback(() => {
    stopMusic();
    stateRef.current = makeInitialState(enabledAbilitiesRef.current);
    lastTimeRef.current = 0;
    hudTickRef.current = 0;
    phaseRef.current = 'menu';
    menuScreenRef.current = 'main';
    menuSelectionRef.current = 0;
    pauseSelectionRef.current = 0;
    pausedRef.current = false;
    // Reset reward accumulator for new session
    rewardAccRef.current.reset();
    setSessionCGRD(0);
    setGameKills([]);
    setPaused(false);
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
      else if (ev.key === ' ' || ev.key === 'z' || ev.key === 'x') manualBuster();
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
  }, [resizeCanvas, loop, manualBuster, setupDpad, startGame, rotateHand]);

  const toggleAuto = () => {
    ensureAudio();
    playAutoToggle();
    stateRef.current.autoBuster = !stateRef.current.autoBuster;
    updateHud();
  };

  const cardProgress = Math.max(0, Math.min(1, hud.cardTimer / CARD_CHARGE_TIME));

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
            disabled={hud.cardsReady && hud.cardOptions.length > 0 && hud.cardOptions.every((id) => hud.usedInHand.includes(id))}
            onPointerDown={(ev) => {
              ev.stopPropagation();
              rotateHand();
            }}
          >
            ↻ ROTATE
          </button>
        )}
      </div>

      {/* D-Pad */}
      <div id="dpad">
        <div className="dpad-btn" id="dpadUp" />
        <div className="dpad-btn" id="dpadDown" />
        <div className="dpad-btn" id="dpadLeft" />
        <div className="dpad-btn" id="dpadRight" />
        <div className="dpad-btn" id="dpadCenter" />
      </div>

      {/* Controls */}
      <div id="controls">
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
              <div id="menuControls">
                <div className="menu-control-row"><span>Move</span><span>Tap grid · D-pad · WASD</span></div>
                <div className="menu-control-row"><span>Fire</span><span>Auto or BUSTER · Space</span></div>
                <div className="menu-control-row"><span>Abilities</span><span>Use all 3 cards, then hand resets</span></div>
                <div className="menu-control-row"><span>Rotate</span><span>ROTATE button or R key — reset timer (disabled once all 3 used)</span></div>
              </div>
            </div>
          ) : (
            <div id="menuCard" className="customization-card">
              <div id="menuTitle" style={{ fontSize: 'clamp(20px, 5vw, 28px)' }}>⚙ Customization</div>

              {/* Skin selector */}
              <div id="customSubtitle">Player skin</div>
              <div id="skinPickerRow">
                {([
                  { id: 'default', label: 'Default', preview: null },
                  { id: 'rocket',  label: 'Rocket',  preview: `${import.meta.env.BASE_URL}skins/rocket.gif` },
                  { id: 'dots',    label: 'Dots',    preview: `${import.meta.env.BASE_URL}skins/dots.gif` },
                  { id: 'gem',     label: 'Elo',     preview: `${import.meta.env.BASE_URL}skins/gem_thumb.png` },
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
          )}
        </div>
      )}

      {/* Pause overlay */}
      {paused && phase === 'playing' && (
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
              id="pauseMenuBtn"
              className={pauseSelection === 1 ? 'gamepad-selected' : ''}
              onClick={(ev) => { ev.stopPropagation(); restart(); }}
            >
              MAIN MENU
            </button>
          </div>
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
