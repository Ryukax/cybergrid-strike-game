import type { EnemyGenome, EnemyNiche, EnemyMutation } from './types';

const NICHES: EnemyNiche[] = [
  'scout',
  'bulwark',
  'hunter',
  'swarm',
  'regenerator',
  'phase',
  'symbiote',
  'opportunist',
];

const MUTATIONS: EnemyMutation[] = [
  'accelerated',
  'armored',
  'miniature',
  'gigantic',
  'volatile',
  'resilient',
];

function hash01(seed: number, salt: number): number {
  const value = Math.sin(seed * 12.9898 + salt * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

export function createGenome(
  seed: number,
  wave: number,
  formationId: number,
): EnemyGenome {
  const generation = Math.max(0, Math.floor((wave - 1) / 2));
  const niche = NICHES[Math.floor(hash01(seed + formationId * 17, 11) * NICHES.length)];
  const mutationChance = Math.min(0.92, 0.42 + wave * 0.04);
  const mutations: EnemyMutation[] = [];

  for (let i = 0; i < MUTATIONS.length; i++) {
    if (hash01(seed + generation * 31, 40 + i) < mutationChance * (i === 0 ? 0.72 : 0.38)) {
      mutations.push(MUTATIONS[i]);
    }
  }
  if (mutations.length === 0 && formationId % 3 === 0) {
    mutations.push(MUTATIONS[Math.abs(seed + formationId) % MUTATIONS.length]);
  }

  let speedScale = 1;
  let hpBonus = 0;
  let sizeScale = 1;
  let regeneration = 0;
  let phaseChance = 0;

  if (niche === 'scout') speedScale += 0.22;
  if (niche === 'bulwark') { hpBonus += 2; sizeScale += 0.14; speedScale -= 0.12; }
  if (niche === 'hunter') speedScale += 0.12;
  if (niche === 'swarm') { sizeScale -= 0.2; speedScale += 0.08; }
  if (niche === 'regenerator') { hpBonus += 1; regeneration = 0.18; }
  if (niche === 'phase') phaseChance = 0.18;
  if (niche === 'symbiote') sizeScale += 0.06;
  if (niche === 'opportunist') speedScale += 0.05;

  if (mutations.includes('accelerated')) speedScale += 0.18;
  if (mutations.includes('armored')) hpBonus += 1;
  if (mutations.includes('miniature')) sizeScale -= 0.16;
  if (mutations.includes('gigantic')) { sizeScale += 0.2; hpBonus += 1; }
  if (mutations.includes('resilient')) regeneration += 0.1;

  return {
    niche,
    generation,
    mutations,
    speedScale: Math.max(0.72, speedScale),
    hpBonus,
    sizeScale: Math.max(0.62, Math.min(1.38, sizeScale)),
    regeneration,
    phaseChance,
    fusionLevel: wave >= 2 && formationId % 5 === 4 ? 1 : 0,
  };
}

export function selectAdaptiveRow(
  genome: EnemyGenome,
  formationRow: number,
  playerRow: number,
  lanePressure: [number, number, number],
): number {
  if (genome.niche === 'hunter') return playerRow;
  if (genome.niche === 'opportunist') {
    return lanePressure.indexOf(Math.min(...lanePressure));
  }
  if (genome.niche === 'phase' && lanePressure[formationRow] > 2.5) {
    return lanePressure.indexOf(Math.min(...lanePressure));
  }
  return formationRow;
}

export function canFuse(a: EnemyGenome, b: EnemyGenome, seed: number): boolean {
  if (a.fusionLevel >= 2 || b.fusionLevel >= 2) return false;
  if (a.niche === 'symbiote' || b.niche === 'symbiote') return true;
  return hash01(seed, 91) < 0.14 + (a.generation + b.generation) * 0.012;
}

export function fuseGenomes(a: EnemyGenome, b: EnemyGenome): EnemyGenome {
  const mutations = [...new Set([...a.mutations, ...b.mutations])].slice(0, 5);
  return {
    niche: a.fusionLevel >= b.fusionLevel ? a.niche : b.niche,
    generation: Math.max(a.generation, b.generation) + 1,
    mutations,
    speedScale: Math.min(1.55, (a.speedScale + b.speedScale) * 0.52),
    hpBonus: Math.max(a.hpBonus, b.hpBonus) + 1,
    sizeScale: Math.min(1.5, Math.max(a.sizeScale, b.sizeScale) + 0.14),
    regeneration: Math.max(a.regeneration, b.regeneration),
    phaseChance: Math.max(a.phaseChance, b.phaseChance),
    fusionLevel: Math.max(a.fusionLevel, b.fusionLevel) + 1,
  };
}
