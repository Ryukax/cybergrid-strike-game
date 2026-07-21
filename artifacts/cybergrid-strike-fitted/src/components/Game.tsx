import { useRef, useEffect, useState, useCallback } from 'react';

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

const ALL_ABILITY_IDS = new Set(ABILITY_POOL.map((a) => a.id));

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
  // shoot → 120 ms → post-shoot A → 200 ms → post-shoot B → 200 ms → idle
  // Any new shot while in post-shoot immediately jumps back to shoot pose.
  const rocketShootFlash = useCallback(() => {
    if (gifFramesRef.current.length < 4) return;
    rocketFrameRef.current = 1;                          // shoot pose
    if (rocketAnimTimer.current) clearTimeout(rocketAnimTimer.current);
    rocketAnimTimer.current = setTimeout(() => {
      rocketFrameRef.current = 2;                        // post-shoot A
      rocketAnimTimer.current = setTimeout(() => {
        rocketFrameRef.current = 3;                      // post-shoot B
        rocketAnimTimer.current = setTimeout(() => {
          rocketFrameRef.current = 0;                    // idle
        }, 200);
      }, 200);
    }, 120);
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
    // Also load gem attack + move frames whenever gem is selected
    if (playerSkin === 'gem') {
      const base = import.meta.env.BASE_URL;
      const loadBmp = (url: string): Promise<ImageBitmap> =>
        new Promise((resolve, reject) => {
          const img = new Image();
          img.onload  = () => createImageBitmap(img).then(resolve).catch(reject);
          img.onerror = () => reject(new Error(`Failed to load ${url}`));
          img.src = url;
        });
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
          ? [
              `${base}skins/rocket_frame_0.png`,
              `${base}skins/rocket_frame_1.png`,
              `${base}skins/rocket_frame_2.png`,
              `${base}skins/rocket_frame_3.png`,
            ]
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
        rocketFrameRef.current = 0;
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
      rocketFrameRef.current = 0;
      gemAttackFrameRef.current = -1;
      gemMoveStartRef.current = -1;
    };
  }, [playerSkin]);

  const [enabledAbilities, setEnabledAbilities] = useState<Set<string>>(ALL_ABILITY_IDS);
  const enabledAbilitiesRef = useRef<Set<string>>(ALL_ABILITY_IDS);

  const [boardBottom, setBoardBottom] = useState(0);

  const [hud, setHud] = useState<HudData>({
    hp: 5, score: 0, wave: 1, autoBuster: true, shieldCharges: 0,
    cardsReady: false, cardSelectionOpen: false, cardTimer: 0,
    cardOptions: [], usedInHand: [], abilityCooldowns: {}, running: true,
    message: 'Tap blue panels to move. Use BUSTER button to fire manually.',
    gameMode: 'classic', npcHp: NPC_HP, npcShieldCharges: 0, playerWon: false,
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
      for (const enemy of s.enemies) { enemy.colPos = Math.min(5.8, enemy.colPos + 0.8); enemy.flash = 0.1; }
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
        if (enemy.hp <= 1) {
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
      showMessage('Freeze — all viruses halted for 4s!', 1500);
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
      for (const e of s.enemies) { if (e.hp > 1) { e.hp = 1; e.flash = 0.12; hit++; } }
      showMessage(`EMP — ${hit} virus${hit !== 1 ? 'es' : ''} weakened to 1 HP!`, 1500);

    } else if (type === 'snipe') {
      s.bullets.push({ colPos: s.player.col + 0.55, row: s.player.row, speed: 16, power: 5, big: true, pierce: true });
      playShot();
      showMessage('Sniper — power-5 mega-shot fired!', 1200);

    } else if (type === 'gravity') {
      for (const e of s.enemies) { e.row = s.player.row; e.flash = 0.12; }
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
      for (const e of s.enemies) { e.row = Math.floor(Math.random() * 3); e.flash = 0.1; }
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
    if (s.pulseTimer > 0) {
      s.pulseTimer = Math.max(0, s.pulseTimer - dt);
      s.pulseTick  = Math.max(0, s.pulseTick  - dt);
      if (s.pulseTick <= 0) {
        for (const e of s.enemies) { e.colPos = Math.min(5.8, e.colPos + 0.5); e.flash = 0.06; }
        s.pulseTick = 1.5;
      }
    }
    if (s.magnetTimer > 0) {
      for (const e of s.enemies) e.colPos = Math.min(5.8, e.colPos + 0.4 * dt);
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

    // Throttled HUD tick: refresh cooldown display at most once per second
    hudTickRef.current += dt;
    if (hudTickRef.current >= 1) {
      hudTickRef.current = 0;
      if (s.cardsReady) updateHud();
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
    const spawnDelay = Math.max(0.6, 1.25 - s.wave * 0.05);
    if (s.enemySpawnTimer <= 0) {
      s.enemySpawnTimer = spawnDelay;
      const row = Math.floor(Math.random() * 3);
      const speed = 1.15 + Math.min(0.55, (s.wave - 1) * 0.08);
      const hp = Math.random() < 0.2 + Math.min(0.25, s.wave * 0.03) ? 2 : 1;
      s.enemies.push({ colPos: 5.6, row, speed, hp, flash: 0 });
    }

    // Move bullets
    for (const b of s.bullets) b.colPos += b.speed * dt;
    s.bullets = s.bullets.filter((b) => b.colPos < 6.4);

    // Move enemies
    const canvas = canvasRef.current;
    const m = canvas ? getBoardMetrics(canvas.offsetWidth, canvas.offsetHeight) : null;
    for (const e of s.enemies) {
      const speedScale = s.freezeTimer > 0 ? 0 : s.blizzardTimer > 0 ? 0.15 : s.slowTimer > 0 ? 0.45 : s.overdriveTimer > 0 ? 2.5 : 1;
      e.colPos -= e.speed * speedScale * dt;
      e.flash = Math.max(0, e.flash - dt);
      if (Math.round(e.colPos) === s.player.col && e.row === s.player.row && e.colPos < s.player.col + 0.45) {
        if (s.shieldCharges > 0) {
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

    // Bullet–enemy collisions
    for (const b of s.bullets) {
      for (const e of s.enemies) {
        if (Math.abs(b.colPos - e.colPos) < (b.big ? 0.52 : 0.38) && b.row === e.row) {
          if (!b.pierce) b.colPos = 99;
          e.hp -= b.power ?? 1;
          e.flash = 0.08;
          if (e.hp <= 0) {
            if (m) addParticles(m.x + (e.colPos + 0.5) * m.cell, m.y + (e.row + 0.5) * m.cell, '#7dd3fc');
            e.colPos = -9;
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
              });
            }
            playScore();
            updateHud();
          } else {
            playHit();
          }
        }
      }
    }

    s.enemies = s.enemies.filter((e) => e.colPos > -1);

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
  }, [handleGamepad, tryMoveTo, manualBuster, fireBullet, addParticles, showMessage, updateHud, endGame]);

  const loop = useCallback((ts: number) => {
    if (!lastTimeRef.current) lastTimeRef.current = ts;
    const dt = Math.min(0.1, (ts - lastTimeRef.current) / 1000);
    lastTimeRef.current = ts;

    // Only advance game state when playing and not paused; always draw so canvas looks alive behind menu
    if (phaseRef.current === 'playing' && !pausedRef.current) {
      update(dt);
    } else if (phaseRef.current === 'playing' && pausedRef.current) {
      // Still poll gamepad so Start button can unpause
      handleGamepad();
      const gp = gamepadRef.current;
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
            if (playerSkinRef.current === 'gem' && gemAttackFrameRef.current >= 0) {
              // Attack takes highest priority
              const aFrames = gifAttackFramesRef.current;
              bitmap = aFrames[gemAttackFrameRef.current % Math.max(1, aFrames.length)];
            } else if (playerSkinRef.current === 'gem' && gemMoveStartRef.current >= 0) {
              // Movement second priority
              const mFrames = gifMoveFramesRef.current;
              const elapsed = performance.now() - gemMoveStartRef.current;
              const mIdx = Math.min(Math.floor(elapsed / GEM_MOVE_FRAME_MS), mFrames.length - 1);
              bitmap = mFrames[mIdx % Math.max(1, mFrames.length)];
            } else if (playerSkinRef.current === 'dots' || playerSkinRef.current === 'gem') {
              // Idle auto-cycle
              bitmap = frames[Math.floor(performance.now() / 120) % frames.length];
            } else {
              bitmap = frames[rocketFrameRef.current % frames.length];
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
  }, [update]);

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
    lastTimeRef.current = 0; // reset so dt doesn't spike on resume
    setPaused(pausedRef.current);
  }, []);

  const restart = useCallback(() => {
    stopMusic();
    stateRef.current = makeInitialState(enabledAbilitiesRef.current);
    lastTimeRef.current = 0;
    hudTickRef.current = 0;
    phaseRef.current = 'menu';
    pausedRef.current = false;
    setPaused(false);
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
          style={{ position: 'absolute', pointerEvents: 'none', transform: 'translate(-50%,-50%)' }}
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
              <button
                id="menuPlayBtn"
                onPointerDown={(ev) => { ev.stopPropagation(); ensureAudio(); startGame('classic'); }}
              >
                ▶ PLAY
              </button>
              <button
                id="menuVsBtn"
                onPointerDown={(ev) => { ev.stopPropagation(); ensureAudio(); startGame('vs'); }}
              >
                ⚔ VS NPC
              </button>
              <button
                id="menuCustomBtn"
                onPointerDown={(ev) => { ev.stopPropagation(); setMenuScreen('customization'); }}
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
                  { id: 'gem',     label: 'Gem',     preview: `${import.meta.env.BASE_URL}skins/gem_thumb.png` },
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
                onPointerDown={(ev) => { ev.stopPropagation(); setMenuScreen('main'); }}
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
              onPointerDown={(ev) => { ev.stopPropagation(); togglePause(); }}
            >
              ▶ RESUME
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
            <button
              id="playAgainBtn"
              onPointerDown={(ev) => { ev.stopPropagation(); ensureAudio(); restart(); }}
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
