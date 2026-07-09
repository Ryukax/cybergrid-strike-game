import type { Ability } from './types';

export const CARD_CHARGE_TIME = 20;

export const ABILITY_POOL: Ability[] = [
  { id: 'shotgun',   name: 'SHOTGUN',   desc: 'Wide 3-panel blast',         cooldown: 8  },
  { id: 'heal',      name: 'RECOVER',   desc: 'Heal 2 HP instantly',        cooldown: 10 },
  { id: 'time',      name: 'TIME SLOW', desc: 'Slow viruses briefly',       cooldown: 12 },
  { id: 'pierce',    name: 'PIERCE',    desc: 'Next shot punches through',  cooldown: 9  },
  { id: 'bomb',      name: 'GRID BOMB', desc: 'Blast the whole target row', cooldown: 11 },
  { id: 'shield',    name: 'SHIELD',    desc: 'Block the next hit',         cooldown: 14 },
  { id: 'overclock', name: 'OVERCLOCK', desc: 'Boost fire rate briefly',    cooldown: 13 },
  { id: 'mirror',    name: 'MIRROR',    desc: 'Fire on all rows once',      cooldown: 10 },
  { id: 'scramble',  name: 'SCRAMBLE',  desc: 'Jolt every virus backward',  cooldown: 9  },
];

export const ABILITY_LOOKUP: Record<string, Ability> = Object.fromEntries(
  ABILITY_POOL.map((a) => [a.id, a])
);
