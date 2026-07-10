export type GameMode = 'classic' | 'vs';

export interface Bullet {
  colPos: number;
  row: number;
  speed: number;
  power: number;
  big: boolean;
  pierce: boolean;
}

export interface Enemy {
  colPos: number;
  row: number;
  speed: number;
  hp: number;
  flash: number;
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
}

export interface NpcAgent {
  /** Column within the right half (0–2); actual board col = 3 + this. Fixed at 1. */
  col: number;
  row: number;
  fireCooldown: number;
  moveCooldown: number;
  hp: number;
  shieldCharges: number;
}

export interface AbilityCooldowns {
  [key: string]: number;
}

export interface GameState {
  running: boolean;
  score: number;
  wave: number;
  hp: number;
  timer: number;
  enemySpawnTimer: number;
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
  // Card system
  cardTimer: number;
  cardsReady: boolean;
  cardSelectionOpen: boolean;
  usedInHand: string[];   // ability IDs used in the current hand
  // Entities
  player: Player;
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
