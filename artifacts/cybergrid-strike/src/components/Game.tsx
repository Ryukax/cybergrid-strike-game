import { useRef, useEffect, useState, useCallback } from 'react';
import type { GameState } from '../game/types';
import { ABILITY_POOL, ABILITY_LOOKUP, CARD_CHARGE_TIME } from '../game/constants';
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

function makeInitialState(enabledIds?: Set<string>): GameState {
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
  const [menuScreen, setMenuScreen] = useState<'main' | 'customization'>('main');

  const [enabledAbilities, setEnabledAbilities] = useState<Set<string>>(ALL_ABILITY_IDS);
  const enabledAbilitiesRef = useRef<Set<string>>(ALL_ABILITY_IDS);

  const [boardBottom, setBoardBottom] = useState(0);

  const [hud, setHud] = useState<HudData>({
    hp: 5, score: 0, wave: 1, autoBuster: true, shieldCharges: 0,
    cardsReady: false, cardSelectionOpen: false, cardTimer: 0,
    cardOptions: [], usedInHand: [], abilityCooldowns: {}, running: true,
    message: 'Tap blue panels to move. Use BUSTER button to fire manually.',
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
    s.bullets.push({ colPos: s.player.col + 0.55, row, speed: 8.5, power, big, pierce });
    playShot();
  }, []);

  const tryMoveTo = useCallback((col: number, row: number) => {
    const s = stateRef.current;
    if (!s.running) return;
    if (col < 0 || col > 2 || row < 0 || row > 2) return;
    s.player.col = col;
    s.player.row = row;
    s.moveFlash = 0.15;
    playMove();
    updateHud();
  }, [updateHud]);

  const manualBuster = useCallback(() => {
    const s = stateRef.current;
    if (!s.running) return;
    if (s.player.fireCooldown <= 0) {
      fireBullet();
      if (s.multishotTimer > 0) fireBullet((s.player.row + 1) % 3);
      s.player.fireCooldown = 0.25;
    }
  }, [fireBullet]);

  const endGame = useCallback(() => {
    const s = stateRef.current;
    if (!s.running) return;
    s.running = false;
    stopMusic();
    playGameOver();
    showMessage('CONNECTION LOST — tap Play Again to restart.', false);
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
      if (g.connected) { g.connected = false; g.moveX = 0; g.moveY = 0; g.fire = false; g.prevFire = false; }
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
    g.moveX = moveX;
    g.moveY = moveY;
    g.connected = true;
  }, []);

  const update = useCallback((dt: number) => {
    const s = stateRef.current;
    if (!s.running) return;

    handleGamepad();

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
      s.player.fireCooldown = s.overclockTimer > 0 ? 0.16 : 0.34;
      fireBullet();
      if (s.multishotTimer > 0) fireBullet((s.player.row + 1) % 3);
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
      const speedScale = s.freezeTimer > 0 ? 0 : s.blizzardTimer > 0 ? 0.15 : s.slowTimer > 0 ? 0.45 : 1;
      e.colPos -= e.speed * speedScale * dt;
      e.flash = Math.max(0, e.flash - dt);
      if (Math.round(e.colPos) === s.player.col && e.row === s.player.row && e.colPos < s.player.col + 0.45) {
        if (s.shieldCharges > 0) {
          s.shieldCharges--;
          e.colPos = -9;
          showMessage('Shield absorbed a hit!', 1200);
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
            s.score += 100;
            if (s.score % 500 === 0) s.wave++;
            if (s.drainTimer > 0) { s.hp++; }
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
  }, [handleGamepad, tryMoveTo, manualBuster, fireBullet, addParticles, showMessage, updateHud, endGame]);

  const loop = useCallback((ts: number) => {
    if (!lastTimeRef.current) lastTimeRef.current = ts;
    const dt = Math.min(0.1, (ts - lastTimeRef.current) / 1000);
    lastTimeRef.current = ts;

    // Only advance game state when playing; always draw so canvas looks alive behind menu
    if (phaseRef.current === 'playing') update(dt);

    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) draw(ctx, canvas.offsetWidth, canvas.offsetHeight, stateRef.current);
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

  const startGame = useCallback(() => {
    stateRef.current = makeInitialState(enabledAbilitiesRef.current);
    lastTimeRef.current = 0;
    hudTickRef.current = 0;
    phaseRef.current = 'playing';
    setPhase('playing');
    updateHud();
    showMessage('Tap blue panels to move. Use BUSTER button to fire manually.', 2500);
    startMusic(() => stateRef.current.running);
  }, [updateHud, showMessage]);

  const restart = useCallback(() => {
    stopMusic();
    stateRef.current = makeInitialState(enabledAbilitiesRef.current);
    lastTimeRef.current = 0;
    hudTickRef.current = 0;
    phaseRef.current = 'menu';
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
      const s = stateRef.current;
      if (!s.running) return;
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

      {/* HUD */}
      <div className="hud" id="hud">
        <div className="panel">HP {hud.hp}</div>
        <div className="panel">Score {hud.score}</div>
        <div className="panel">Wave {hud.wave}</div>
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

      {/* Main Menu overlay */}
      {phase === 'menu' && (
        <div id="mainMenu">
          {menuScreen === 'main' ? (
            <div id="menuCard">
              <div id="menuTitle">CYBERGRID<br />STRIKE</div>
              <div id="menuTagline">Defend the grid. Eliminate the viruses.</div>
              <button
                id="menuPlayBtn"
                onPointerDown={(ev) => { ev.stopPropagation(); ensureAudio(); startGame(); }}
              >
                ▶ PLAY
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
              <div id="customSubtitle">Toggle which abilities appear in card draws</div>
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

      {/* Game Over overlay */}
      {!hud.running && phase === 'playing' && (
        <div id="gameOverOverlay">
          <div id="gameOverCard">
            <div id="gameOverTitle">CONNECTION LOST</div>
            <div id="gameOverScore">Score: {hud.score}</div>
            <div id="gameOverWave">Wave: {hud.wave}</div>
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
