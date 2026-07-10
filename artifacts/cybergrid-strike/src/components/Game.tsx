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
    cardTimer: 0,
    cardsReady: false,
    cardSelectionOpen: false,
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
  const [dpadRotation, setDpadRotation] = useState<'portrait' | 'landscape'>('portrait');
  const dpadRotationRef = useRef<'portrait' | 'landscape'>('portrait');

  const [hud, setHud] = useState<HudData>({
    hp: 5, score: 0, wave: 1, autoBuster: true, shieldCharges: 0,
    cardsReady: false, cardSelectionOpen: false, cardTimer: 0,
    cardOptions: [], abilityCooldowns: {}, running: true, message: 'Tap blue panels to move. Use BUSTER button to fire manually.',
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
    const power = opts?.power ?? 1;
    const big = opts?.big ?? false;
    let pierce = opts?.pierce ?? false;
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
    if ((s.abilityCooldowns[type] ?? 0) > 0) return;

    const canvas = canvasRef.current;
    const m = canvas ? getBoardMetrics(canvas.offsetWidth, canvas.offsetHeight) : null;

    if (type === 'shotgun') {
      for (let ro = -1; ro <= 1; ro++) {
        const tr = s.player.row + ro;
        if (tr >= 0 && tr < 3) fireBullet(tr, { power: 2, big: true });
      }
      showMessage('Shotgun card fired!', 1500);
    } else if (type === 'heal') {
      s.hp = s.hp + 2;
      if (m) addParticles(m.x + (s.player.col + 0.5) * m.cell, m.y + (s.player.row + 0.5) * m.cell, '#86efac');
      showMessage('Recover card restored 2 HP!', 1500);
    } else if (type === 'time') {
      s.slowTimer = 6;
      showMessage('Time Slow card activated!', 1500);
    } else if (type === 'pierce') {
      s.pierceShots = Math.max(s.pierceShots, 1);
      showMessage('Pierce loaded for your next shot!', 1500);
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
            hits++;
          }
        }
      }
      if (hits > 0) { if (s.score % 500 === 0) s.wave++; playScore(); }
      showMessage('Grid Bomb blasted the row!', 1500);
    } else if (type === 'shield') {
      s.shieldCharges = Math.min(3, s.shieldCharges + 1);
      showMessage('Shield charged!', 1500);
    } else if (type === 'overclock') {
      s.overclockTimer = 6;
      showMessage('Overclock boosted fire rate!', 1500);
    } else if (type === 'mirror') {
      for (let row = 0; row < 3; row++) fireBullet(row, { power: 1, big: true });
      showMessage('Mirror volley launched!', 1500);
    } else if (type === 'scramble') {
      for (const enemy of s.enemies) { enemy.colPos = Math.min(5.8, enemy.colPos + 0.8); enemy.flash = 0.1; }
      showMessage('Viruses scrambled backward!', 1500);
    }

    playAbility(type);
    s.abilityCooldowns[type] = ability.cooldown;

    // Consume cards
    const nextOptions = randomAbilityOptions(s.currentCardOptions, enabledAbilitiesRef.current);
    s.currentCardOptions = nextOptions;
    s.cardTimer = 0;
    s.cardsReady = false;
    s.cardSelectionOpen = false;

    updateHud();
  }, [fireBullet, addParticles, showMessage, updateHud]);

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
    let rdx = 0, rdy = 0;
    if (kb.left || td.left) rdx = -1; else if (kb.right || td.right) rdx = 1;
    if (kb.up || td.up) rdy = -1; else if (kb.down || td.down) rdy = 1;
    if (Math.abs(gp.moveX) > 0.15) rdx = gp.moveX > 0 ? 1 : -1;
    if (Math.abs(gp.moveY) > 0.15) rdy = gp.moveY > 0 ? 1 : -1;
    // Remap raw input through clockwise rotation
    let dx = rdx, dy = rdy;
    if (dpadRotationRef.current === 'landscape') { dx = -rdy; dy = rdx; }

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
    s.moveFlash = Math.max(0, s.moveFlash - dt);
    s.slowTimer = Math.max(0, s.slowTimer - dt);
    s.overclockTimer = Math.max(0, s.overclockTimer - dt);

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

    if (!s.cardsReady) {
      s.cardTimer = Math.min(CARD_CHARGE_TIME, s.cardTimer + dt);
      // Smooth bar + label: write directly to DOM every frame
      const pct = (s.cardTimer / CARD_CHARGE_TIME) * 100;
      if (cardBarFillRef.current) cardBarFillRef.current.style.width = `${pct.toFixed(2)}%`;
      if (cardLabelRef.current) {
        const secs = Math.max(0, Math.ceil(CARD_CHARGE_TIME - s.cardTimer));
        cardLabelRef.current.textContent = `Ability Cards ready in ${secs}s`;
      }
      if (s.cardTimer >= CARD_CHARGE_TIME) {
        s.cardsReady = true;
        s.cardSelectionOpen = true;
        playCardReady();
        showMessage('Ability Cards loaded! Pick one now.', false);
        updateHud();
      }
    } else {
      // If all shown card options are still on cooldown, reroll once they clear
      const allOnCd = s.currentCardOptions.every((id) => (s.abilityCooldowns[id] ?? 0) > 0);
      if (allOnCd) {
        // Check if any option just cleared (any cooldown ticked to 0 this frame)
        const anyJustCleared = s.currentCardOptions.some(
          (id) => (s.abilityCooldowns[id] ?? 0) === 0
        );
        if (anyJustCleared) {
          // Still blocked — wait until at least one is actually available
        }
        // Continuously reroll until we find options not all on cooldown
        let guard = 0;
        let next = randomAbilityOptions(s.currentCardOptions, enabledAbilitiesRef.current);
        while (guard < 12 && next.every((id) => (s.abilityCooldowns[id] ?? 0) > 0)) {
          next = randomAbilityOptions(next, enabledAbilitiesRef.current);
          guard++;
        }
        // If we found at least one usable option, swap in the new set
        if (!next.every((id) => (s.abilityCooldowns[id] ?? 0) > 0)) {
          s.currentCardOptions = next;
          updateHud();
        }
      }
    }

    s.player.fireCooldown -= dt;
    if (s.autoBuster && s.player.fireCooldown <= 0 && !s.cardSelectionOpen) {
      s.player.fireCooldown = s.overclockTimer > 0 ? 0.16 : 0.34;
      fireBullet();
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
      const speedScale = s.slowTimer > 0 ? 0.45 : 1;
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
  }, [resizeCanvas, loop, manualBuster, setupDpad, startGame]);

  const toggleAuto = () => {
    ensureAudio();
    playAutoToggle();
    stateRef.current.autoBuster = !stateRef.current.autoBuster;
    updateHud();
  };

  const cardProgress = Math.max(0, Math.min(1, hud.cardTimer / CARD_CHARGE_TIME));
  const allOnCooldown = hud.cardOptions.length > 0 &&
    hud.cardOptions.every((id) => (hud.abilityCooldowns[id] ?? 0) > 0);

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
              {hud.cardsReady
                ? allOnCooldown
                  ? 'All abilities on cooldown — cards will reroll when ready'
                  : 'Choose an Ability Card'
                : ''}
            </div>
            <div id="cardBarTrack">
              <div id="cardBarFill" ref={cardBarFillRef} style={{ width: hud.cardsReady ? '100%' : '0%' }} />
            </div>
          </div>

          {hud.cardsReady && (
            <div id="cardChoices">
              {hud.cardOptions.map((id) => {
                const ability = ABILITY_LOOKUP[id];
                if (!ability) return null;
                const cd = Math.ceil(hud.abilityCooldowns[id] ?? 0);
                return (
                  <button
                    key={id}
                    className="card-btn"
                    disabled={cd > 0}
                    onPointerDown={(ev) => {
                      ev.stopPropagation();
                      ensureAudio();
                      useCard(id);
                    }}
                  >
                    {ability.name}<br />
                    <span>{cd > 0 ? `Cooldown ${cd}s` : ability.desc}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Rotate-input button — sits below the bar, left-aligned */}
        {phase === 'playing' && (
          <button
            id="layoutToggleBtn"
            className="control-btn"
            onPointerDown={(ev) => {
              ev.stopPropagation();
              setDpadRotation((r) => {
                const next = r === 'portrait' ? 'landscape' : 'portrait';
                dpadRotationRef.current = next;
                return next;
              });
            }}
          >
            {dpadRotation === 'portrait' ? '⬜ Portrait' : '▭ Landscape'}
          </button>
        )}
      </div>

      {/* D-Pad — visually rotated to match input remapping */}
      <div
        id="dpad"
        style={{ transform: `translateX(-50%) rotate(${dpadRotation === 'landscape' ? 90 : 0}deg)` }}
      >
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
                <div className="menu-control-row"><span>Abilities</span><span>Card bar fills every 20s</span></div>
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
