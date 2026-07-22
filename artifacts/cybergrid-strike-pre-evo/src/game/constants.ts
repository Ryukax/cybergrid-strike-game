import type { Ability } from './types';

export const CARD_CHARGE_TIME = 20;

// VS mode NPC tuning
export const NPC_HP = 8;
export const NPC_FIRE_INTERVAL = 0.45;   // seconds between NPC shots
export const NPC_MOVE_INTERVAL = 0.75;   // seconds between NPC row changes

export const ABILITY_POOL: Ability[] = [
  // ── Existing ────────────────────────────────────────────────────────────────
  { id: 'shotgun',   name: 'SHOTGUN',    desc: 'Big power-2 blast across 3 adjacent rows',     cooldown: 8  },
  { id: 'heal',      name: 'RECOVER',    desc: 'Instantly restore 2 HP',                        cooldown: 10 },
  { id: 'time',      name: 'TIME SLOW',  desc: 'Slow all viruses to 45% speed for 6s',          cooldown: 12 },
  { id: 'pierce',    name: 'PIERCE',     desc: 'Next shot punches through every virus',          cooldown: 9  },
  { id: 'bomb',      name: 'GRID BOMB',  desc: 'Detonate your row — damages all viruses on it', cooldown: 11 },
  { id: 'shield',    name: 'SHIELD',     desc: 'Generate a charge that blocks the next hit',     cooldown: 14 },
  { id: 'overclock', name: 'OVERCLOCK',  desc: 'Boost fire rate to double speed for 6s',        cooldown: 13 },
  { id: 'mirror',    name: 'MIRROR',     desc: 'Fire one big bullet down every lane at once',   cooldown: 10 },
  { id: 'scramble',  name: 'SCRAMBLE',   desc: 'Knock every virus 0.8 cells back toward edge',  cooldown: 9  },

  // ── Instant / no new state ───────────────────────────────────────────────────
  { id: 'nuke',      name: 'NUKE',       desc: 'Emergency wipe — instantly destroy all viruses',        cooldown: 15 },
  { id: 'barrage',   name: 'BARRAGE',    desc: 'Fire 3 piercing power-2 shots down your row',           cooldown: 7  },
  { id: 'warpback',  name: 'WARP BACK',  desc: 'Teleport every virus all the way back to the edge',     cooldown: 10 },
  { id: 'purge',     name: 'PURGE',      desc: 'Instantly erase every weakened (1-HP) virus',           cooldown: 8  },
  { id: 'armor',     name: 'ARMOR',      desc: 'Grant 3 shield charges at once',                        cooldown: 18 },
  { id: 'surge',     name: 'SURGE',      desc: 'Fire a power-2 piercing shot down all 3 lanes',         cooldown: 9  },
  { id: 'backdash',  name: 'BACKDASH',   desc: 'Push every virus 2 full cells back toward the edge',    cooldown: 7  },
  { id: 'megabomb',  name: 'MEGABOMB',   desc: 'Full-grid shockwave — destroy all, earn double score',  cooldown: 20 },
  { id: 'cardflood', name: 'CARD FLOOD', desc: 'Instantly re-ready your ability cards for another pick', cooldown: 25 },

  // ── Timer-based ──────────────────────────────────────────────────────────────
  { id: 'freeze',    name: 'FREEZE',     desc: 'Completely halt all virus movement for 4s',             cooldown: 14 },
  { id: 'blizzard',  name: 'BLIZZARD',   desc: 'Extreme slowdown — viruses crawl at 15% speed for 10s', cooldown: 16 },
  { id: 'double',    name: 'DOUBLETAP',  desc: 'All bullets deal double damage for 6s',                 cooldown: 14 },
  { id: 'multishot', name: 'MULTISHOT',  desc: 'Each trigger fires an extra bullet on an adjacent row for 5s', cooldown: 12 },
  { id: 'regen',     name: 'REGEN',      desc: 'Regenerate 1 HP every 3 seconds for 12s',               cooldown: 20 },
  { id: 'drain',     name: 'LEECH',      desc: 'Each virus kill restores 1 HP for 8s',                  cooldown: 18 },
  { id: 'voltage',   name: 'VOLTAGE',    desc: 'Every bullet becomes big and piercing for 5s',          cooldown: 15 },

  // ── New instant abilities ─────────────────────────────────────────────────
  { id: 'emp',       name: 'EMP BURST',  desc: 'Instantly reduce every virus to 1 HP',                 cooldown: 12 },
  { id: 'snipe',     name: 'SNIPER',     desc: 'Fire a power-5 piercing mega-shot at max velocity',    cooldown: 8  },
  { id: 'gravity',   name: 'GRAVITY',    desc: 'Yank every virus into your current row',               cooldown: 11 },
  { id: 'chain',     name: 'CHAIN KILL', desc: 'Destroy the most-advanced virus and all at equal HP',  cooldown: 9  },
  { id: 'cluster',   name: 'CLUSTER',    desc: 'Eliminate the 3 most-advanced viruses instantly',      cooldown: 11 },
  { id: 'rowshuffle',name: 'ROW CHAOS',  desc: 'Randomly scramble every virus to a new row',           cooldown: 7  },

  // ── New timer-based abilities ─────────────────────────────────────────────
  { id: 'ghost',     name: 'GHOST MODE', desc: 'Become invincible to virus collisions for 4s',         cooldown: 16 },
  { id: 'turret',    name: 'TURRET',     desc: 'Auto-fire covers all 3 rows simultaneously for 5s',   cooldown: 14 },
  { id: 'echo',      name: 'ECHO SHOT',  desc: 'Each bullet spawns a clone on the adjacent row for 5s', cooldown: 11 },
  { id: 'overdrive', name: 'OVERDRIVE',  desc: 'Viruses move 2.5× faster but you earn 3× score for 4s', cooldown: 12 },
  { id: 'pulse',     name: 'PULSE WAVE', desc: 'Shockwave repulses all viruses 0.5 cells every 1.5s for 7s', cooldown: 13 },
  { id: 'overload',  name: 'OVERLOAD',   desc: 'Each kill instantly fires a bullet in that row for 6s', cooldown: 10 },
  { id: 'magnet',    name: 'MAGNET',     desc: 'Magnetic field pulls viruses back 0.4 cells/s for 6s', cooldown: 10 },
  { id: 'berserk',   name: 'BERSERK',    desc: 'Extreme fire rate — 4× speed for 4s',                  cooldown: 9  },
  { id: 'crit',      name: 'CRIT BOOST', desc: '40% chance per bullet to deal triple damage for 5s',   cooldown: 11 },
];

export const ABILITY_LOOKUP: Record<string, Ability> = Object.fromEntries(
  ABILITY_POOL.map((a) => [a.id, a])
);
