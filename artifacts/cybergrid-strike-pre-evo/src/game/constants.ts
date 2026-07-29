import type { Ability } from './types';

export const CARD_CHARGE_TIME = 12;
export const ENEMY_ABILITY_WINDUP = 1.15;
export const ENEMY_ABILITY_FIRST_CAST_MIN = 1.25;
export const ENEMY_ABILITY_FIRST_CAST_RANGE = 1.35;

// VS mode NPC tuning
export const NPC_HP = 100;
export const NPC_FIRE_INTERVAL = 0.45;   // seconds between NPC shots
export const NPC_MOVE_INTERVAL = 0.75;   // seconds between NPC row changes

export const ABILITY_POOL: Ability[] = [
  // ── Existing ────────────────────────────────────────────────────────────────
  { id: 'shotgun',   name: 'SHOTGUN',    desc: 'Big power-2 blast across 3 adjacent rows',     cooldown: 8  },
  { id: 'heal',      name: 'RECOVER',    desc: 'Instantly restore 2 HP',                        cooldown: 10 },
  { id: 'time',      name: 'TIME SLOW',  desc: 'Fast movers drop to 32% speed; heavy forms resist for 6s', cooldown: 12 },
  { id: 'pierce',    name: 'PIERCE',     desc: 'Next shot punches through every virus',          cooldown: 9  },
  { id: 'bomb',      name: 'GRID BOMB',  desc: 'Detonate your row — damages all viruses on it', cooldown: 11 },
  { id: 'shield',    name: 'SHIELD',     desc: 'Generate a charge that blocks the next hit',     cooldown: 14 },
  { id: 'overclock', name: 'OVERCLOCK',  desc: 'Boost fire rate to double speed for 6s',        cooldown: 13 },
  { id: 'mirror',    name: 'MIRROR',     desc: 'Fire one big bullet down every lane at once',   cooldown: 10 },
  { id: 'scramble',  name: 'SCRAMBLE',   desc: 'Break formations; light and airborne enemies recoil farther', cooldown: 9  },

  // ── Instant / no new state ───────────────────────────────────────────────────
  { id: 'nuke',      name: 'NUKE',       desc: 'Emergency wipe — instantly destroy all viruses',        cooldown: 15 },
  { id: 'barrage',   name: 'BARRAGE',    desc: 'Fire 3 piercing power-2 shots down your row',           cooldown: 7  },
  { id: 'warpback',  name: 'WARP BACK',  desc: 'Teleport every virus all the way back to the edge',     cooldown: 10 },
  { id: 'purge',     name: 'PURGE',      desc: 'Erase weakened, fused, or heavily mutated enemies', cooldown: 8  },
  { id: 'armor',     name: 'ARMOR',      desc: 'Grant 3 shield charges at once',                        cooldown: 18 },
  { id: 'surge',     name: 'SURGE',      desc: 'Fire a power-2 piercing shot down all 3 lanes',         cooldown: 9  },
  { id: 'backdash',  name: 'BACKDASH',   desc: 'Push every virus 2 full cells back toward the edge',    cooldown: 7  },
  { id: 'megabomb',  name: 'MEGABOMB',   desc: 'Full-grid shockwave — neutralize all, earn double Integrity Work', cooldown: 20 },
  { id: 'cardflood', name: 'CARD FLOOD', desc: 'Instantly re-ready your ability cards for another pick', cooldown: 25 },

  // ── Timer-based ──────────────────────────────────────────────────────────────
  { id: 'freeze',    name: 'FREEZE',     desc: 'Force a crawl and suppress phase and regeneration for 4s', cooldown: 14 },
  { id: 'blizzard',  name: 'BLIZZARD',   desc: 'Cripple fliers and swimmers; burrowers partly resist for 10s', cooldown: 16 },
  { id: 'double',    name: 'DOUBLETAP',  desc: 'All bullets deal double damage for 6s',                 cooldown: 14 },
  { id: 'multishot', name: 'MULTISHOT',  desc: 'Each trigger fires an extra bullet on an adjacent row for 5s', cooldown: 12 },
  { id: 'regen',     name: 'REGEN',      desc: 'Regenerate 1 HP every 3 seconds for 12s',               cooldown: 20 },
  { id: 'drain',     name: 'LEECH',      desc: 'Each virus kill restores 1 HP for 8s',                  cooldown: 18 },
  { id: 'voltage',   name: 'VOLTAGE',    desc: 'Every bullet becomes big and piercing for 5s',          cooldown: 15 },

  // ── New instant abilities ─────────────────────────────────────────────────
  { id: 'emp',       name: 'EMP BURST',  desc: 'Damage cyber enemies and disable their traits for 4s', cooldown: 12 },
  { id: 'snipe',     name: 'SNIPER',     desc: 'Fire a power-5 piercing mega-shot at max velocity',    cooldown: 8  },
  { id: 'gravity',   name: 'GRAVITY',    desc: 'Ground air units and pull non-heavy enemies into your row', cooldown: 11 },
  { id: 'chain',     name: 'CHAIN KILL', desc: 'Destroy the most-advanced virus and all at equal HP',  cooldown: 9  },
  { id: 'cluster',   name: 'CLUSTER',    desc: 'Eliminate the 3 most-advanced viruses instantly',      cooldown: 11 },
  { id: 'rowshuffle',name: 'ROW CHAOS',  desc: 'Redirect mobile enemies; rooted and fortress forms stay anchored', cooldown: 7  },

  // ── New timer-based abilities ─────────────────────────────────────────────
  { id: 'ghost',     name: 'GHOST MODE', desc: 'Become invincible to virus collisions for 4s',         cooldown: 16 },
  { id: 'turret',    name: 'TURRET',     desc: 'Auto-fire covers all 3 rows simultaneously for 5s',   cooldown: 14 },
  { id: 'echo',      name: 'ECHO SHOT',  desc: 'Each bullet spawns a clone on the adjacent row for 5s', cooldown: 11 },
  { id: 'overdrive', name: 'OVERDRIVE',  desc: 'Viruses move 2.5× faster but generate 3× Integrity Work for 4s', cooldown: 12 },
  { id: 'pulse',     name: 'PULSE WAVE', desc: 'Repeatedly hurl light enemies; heavy and spectral forms resist', cooldown: 13 },
  { id: 'overload',  name: 'OVERLOAD',   desc: 'Each kill instantly fires a bullet in that row for 6s', cooldown: 10 },
  { id: 'magnet',    name: 'MAGNET',     desc: 'Strongly repel machines; cyber hybrids respond weakly for 6s', cooldown: 10 },
  { id: 'berserk',   name: 'BERSERK',    desc: 'Extreme fire rate — 4× speed for 4s',                  cooldown: 9  },
  { id: 'crit',      name: 'CRIT BOOST', desc: '40% chance per bullet to deal triple damage for 5s',   cooldown: 11 },
  // Movement-counter abilities
  { id: 'flak',        name: 'FLAK GRID',     desc: 'Ground and damage flying, hovering and spectral enemies', cooldown: 10 },
  { id: 'groundwire',  name: 'GROUNDWIRE',    desc: 'Shock grounded movers; heavy bodies are briefly staggered', cooldown: 10 },
  { id: 'signaljam',   name: 'SIGNAL JAM',    desc: 'Slow cyber enemies and suppress phase, regen and fusion for 6s', cooldown: 14 },
  { id: 'undertow',    name: 'UNDERTOW',      desc: 'Pull fluid-bodied enemies into your lane and drive them back', cooldown: 11 },
  { id: 'separate',    name: 'SEPARATION',    desc: 'Destabilize every fusion, stripping levels, health and mutations', cooldown: 13 },
  { id: 'interceptor', name: 'INTERCEPTOR',   desc: 'Strike the fastest advancing enemy with a power-6 shot', cooldown: 8 },
  { id: 'stasisgate',  name: 'STASIS GATE',   desc: 'For 7s, fast enemies take damage crossing the center boundary', cooldown: 14 },
  { id: 'adaptive',    name: 'ADAPTIVE AMMO', desc: 'Bullets exploit armor, spectral, colony and cyber weaknesses for 7s', cooldown: 15 },

  // Projectile expansion
  { id: 'ricochet', name: 'RICOCHET', desc: 'Fire piercing shots into your row and both adjacent rows', cooldown: 10 },
  { id: 'rearguard', name: 'REARGUARD', desc: 'Fire powerful shots in both facing directions', cooldown: 11 },
  { id: 'arcweb', name: 'ARC WEB', desc: 'Chain damage through the four most advanced enemies', cooldown: 12 },
  { id: 'splitter', name: 'SPLITTER', desc: 'Launch two piercing shots down every lane', cooldown: 12 },
  { id: 'seeker', name: 'SEEKER', desc: 'Strike the most dangerous living target regardless of lane', cooldown: 10 },
  { id: 'shattershot', name: 'SHATTERSHOT', desc: 'Break armor and heavily damage resilient enemies', cooldown: 11 },
  { id: 'marksman', name: 'MARKSMAN', desc: 'Long-range power shot deals more damage to distant targets', cooldown: 9 },
  { id: 'returnfire', name: 'RETURN FIRE', desc: 'Damage every enemy already inside the center boundary', cooldown: 14 },

  // Locomotion counters
  { id: 'oilslick', name: 'OIL SLICK', desc: 'Wheel and vehicle forms skid backward', cooldown: 10 },
  { id: 'rootsnare', name: 'ROOT SNARE', desc: 'Trap grounded movers and suppress their speed', cooldown: 13 },
  { id: 'sonicnet', name: 'SONIC NET', desc: 'Ground and damage airborne enemies', cooldown: 11 },
  { id: 'depthcharge', name: 'DEPTH CHARGE', desc: 'Expose and damage every burrowing enemy', cooldown: 10 },
  { id: 'anchorfield', name: 'ANCHOR FIELD', desc: 'Freeze heavy bodies while lighter enemies recoil', cooldown: 15 },
  { id: 'tailclamp', name: 'TAIL CLAMP', desc: 'Cripple serpentine and aquatic locomotion', cooldown: 10 },
  { id: 'tanglewire', name: 'TANGLEWIRE', desc: 'Damage rooted and tentacled entities', cooldown: 12 },
  { id: 'trafficjam', name: 'TRAFFIC JAM', desc: 'Vehicles and machines stagger backward into formation', cooldown: 13 },

  // Elemental matrix
  { id: 'thermalshock', name: 'THERMAL SHOCK', desc: 'Fracture thermal and cryo affinities', cooldown: 13 },
  { id: 'circuitarc', name: 'CIRCUIT ARC', desc: 'Arc through voltaic, mechanical and fluidic entities', cooldown: 12 },
  { id: 'acidetch', name: 'ACID ETCH', desc: 'Remove armor before corrosive damage lands', cooldown: 13 },
  { id: 'bloombind', name: 'BLOOM BIND', desc: 'Bind botanical enemies and share damage across them', cooldown: 14 },
  { id: 'radiantmark', name: 'RADIANT MARK', desc: 'Reveal phase forms and damage void or spectral enemies', cooldown: 12 },
  { id: 'voidaperture', name: 'VOID APERTURE', desc: 'Banish the leading enemy and return it weakened at the edge', cooldown: 15 },
  { id: 'kineticram', name: 'KINETIC RAM', desc: 'Drive one lane backward and deal collision damage', cooldown: 11 },
  { id: 'elementswap', name: 'ELEMENT SWAP', desc: 'Rotate enemy affinities to expose new weaknesses', cooldown: 14 },

  // Evolution and fusion
  { id: 'devolve', name: 'DEVOLVE', desc: 'Remove a generation, mutation and fusion level', cooldown: 14 },
  { id: 'mutationlock', name: 'MUTATION LOCK', desc: 'Suppress regeneration and phase traits across the grid', cooldown: 16 },
  { id: 'traittheft', name: 'TRAIT THEFT', desc: 'Steal vitality from the most mutated enemy', cooldown: 15 },
  { id: 'quarantine', name: 'QUARANTINE', desc: 'Separate converging entities and prevent immediate fusion', cooldown: 12 },
  { id: 'clonebreak', name: 'CLONE BREAK', desc: 'Damage every member of the most common species', cooldown: 13 },
  { id: 'hybridtax', name: 'HYBRID TAX', desc: 'Damage and slow enemies for every fusion level', cooldown: 12 },
  { id: 'forcedmolt', name: 'FORCED MOLT', desc: 'Strip armor and mutations but accelerate survivors', cooldown: 10 },
  { id: 'catalyst', name: 'CATALYST', desc: 'Empower fused enemies, then mark them for triple Integrity Work', cooldown: 16 },
];

export const ABILITY_LOOKUP: Record<string, Ability> = Object.fromEntries(
  ABILITY_POOL.map((a) => [a.id, a])
);
