import type { EnemyGenome, EnemyNiche, EnemyMutation, EnemyBaseElement } from './types';
import { getFusionOutcome } from './element-matrix';

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
const BASE_ELEMENTS: EnemyBaseElement[] = [
  'robot', 'insect', 'beast', 'plant', 'crystal', 'golem', 'drone',
  'cephalopod', 'skeleton', 'avian', 'serpent', 'vehicle', 'fungus',
  'cyborg', 'mech', 'nanite', 'data-wraith',
  'crab', 'owl', 'fox', 'snail', 'fish', 'mole', 'turret',
];
const NICHE_BASES: Record<EnemyNiche, EnemyBaseElement[]> = {
  scout: ['drone', 'insect', 'beast', 'avian', 'nanite', 'owl', 'fox', 'fish'],
  bulwark: ['robot', 'crystal', 'golem', 'skeleton', 'vehicle', 'mech', 'crab', 'snail', 'turret'],
  hunter: ['beast', 'insect', 'skeleton', 'serpent', 'cyborg', 'mech', 'fox', 'owl', 'mole', 'fish'],
  swarm: ['insect', 'cephalopod', 'plant', 'fungus', 'nanite', 'crab', 'fish'],
  regenerator: ['plant', 'cephalopod', 'beast', 'fungus', 'snail', 'mole'],
  phase: ['skeleton', 'drone', 'cephalopod', 'serpent', 'data-wraith', 'nanite', 'owl', 'fish'],
  symbiote: ['cephalopod', 'plant', 'crystal', 'golem', 'fungus', 'cyborg', 'snail', 'mole'],
  opportunist: ['robot', 'drone', 'beast', 'vehicle', 'cyborg', 'mech', 'crab', 'fox', 'turret', 'mole'],
};

function hash01(seed: number, salt: number): number {
  const value = Math.sin(seed * 12.9898 + salt * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

export function createGenome(
  seed: number,
  wave: number,
  formationId: number,
  context?: {
    playerRow: number;
    lanePressure: [number, number, number];
    population: Partial<Record<EnemyNiche, number>>;
    basePopulation: Partial<Record<EnemyBaseElement, number>>;
    lanePopulation: [number, number, number];
  },
): EnemyGenome {
  const generation = Math.max(0, Math.floor((wave - 1) / 2));
  let niche: EnemyNiche;
  if (context) {
    const weights = NICHES.map((candidate, index) => {
      const scarcity = 1 / (1 + (context.population[candidate] ?? 0) * 0.85);
      let response = 1;
      if (candidate === 'hunter') response += context.playerRow === 1 ? 0.75 : 0.35;
      if (candidate === 'opportunist') response += Math.max(...context.lanePressure) * 0.12;
      if (candidate === 'phase') response += Math.max(...context.lanePressure) * 0.09;
      if (candidate === 'swarm') response += Math.max(0, 4 - context.lanePopulation.reduce((a, b) => a + b, 0)) * 0.14;
      if (candidate === 'bulwark') response += wave * 0.035;
      if (candidate === 'regenerator') response += context.lanePressure.reduce((a, b) => a + b, 0) * 0.025;
      if (candidate === 'symbiote') response += context.lanePopulation.some((count) => count > 1) ? 0.7 : 0;
      return Math.max(0.08, scarcity * response * (0.88 + hash01(seed + formationId, index + 3) * 0.24));
    });
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    let pick = hash01(seed + formationId * 17 + wave * 29, 11) * total;
    niche = NICHES[NICHES.length - 1];
    for (let i = 0; i < NICHES.length; i++) {
      pick -= weights[i];
      if (pick <= 0) { niche = NICHES[i]; break; }
    }
  } else {
    niche = NICHES[Math.floor(hash01(seed + formationId * 17, 11) * NICHES.length)];
  }
  const preferredBases = NICHE_BASES[niche];
  const baseWeights = BASE_ELEMENTS.map((candidate, index) => {
    const scarcity = 1 / (1 + (context?.basePopulation[candidate] ?? 0) * 2.4);
    const affinity = preferredBases.includes(candidate) ? 2.2 : 0.45;
    return scarcity * affinity * (0.82 + hash01(seed + formationId, 120 + index) * 0.36);
  });
  let basePick = hash01(seed + formationId * 23 + wave * 41, 119) * baseWeights.reduce((a, b) => a + b, 0);
  let baseElement = BASE_ELEMENTS[BASE_ELEMENTS.length - 1];
  for (let index = 0; index < BASE_ELEMENTS.length; index++) {
    basePick -= baseWeights[index];
    if (basePick <= 0) { baseElement = BASE_ELEMENTS[index]; break; }
  }
  const mutationChance = Math.min(0.92, 0.42 + wave * 0.04);
  const mutations: EnemyMutation[] = [];

  for (let i = 0; i < MUTATIONS.length; i++) {
    if (hash01(seed + generation * 31, 40 + i) < mutationChance * (i === 0 ? 0.72 : 0.38)) {
      mutations.push(MUTATIONS[i]);
    }
  }
  if (mutations.length === 0 && hash01(seed + wave * 19 + formationId, 73) < mutationChance) {
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
    baseElement,
    generation,
    mutations,
    speedScale: Math.max(0.72, speedScale),
    hpBonus,
    sizeScale: Math.max(0.62, Math.min(1.38, sizeScale)),
    regeneration,
    phaseChance,
    // Fusion is earned by two compatible living parents meeting in play.
    // Fresh spawns never invent an unseen secondary element.
    fusionLevel: 0,
  };
}

export function selectAdaptiveRow(
  genome: EnemyGenome,
  candidateRow: number,
  playerRow: number,
  lanePressure: [number, number, number],
  lanePopulation: [number, number, number] = [0, 0, 0],
): number {
  if (genome.niche === 'hunter') return playerRow;
  if (genome.niche === 'opportunist') {
    const opportunity = lanePressure.map((pressure, row) => pressure + lanePopulation[row] * 0.7);
    return opportunity.indexOf(Math.min(...opportunity));
  }
  if (genome.niche === 'swarm') return lanePopulation.indexOf(Math.min(...lanePopulation));
  if (genome.niche === 'symbiote') return lanePopulation.indexOf(Math.max(...lanePopulation));
  if (genome.niche === 'phase' && lanePressure[candidateRow] > 2.5) {
    return lanePressure.indexOf(Math.min(...lanePressure));
  }
  return candidateRow;
}

export function canFuse(a: EnemyGenome, b: EnemyGenome, seed: number): boolean {
  if (a.fusionLevel >= 2 || b.fusionLevel >= 2) return false;
  if (!getFusionOutcome(a.baseElement, b.baseElement) && !getFusionOutcome(b.baseElement, a.baseElement)) return false;
  if (a.niche === 'symbiote' || b.niche === 'symbiote') return true;
  return hash01(seed, 91) < 0.14 + (a.generation + b.generation) * 0.012;
}

export function fuseGenomes(a: EnemyGenome, b: EnemyGenome): EnemyGenome {
  const mutations = [...new Set([...a.mutations, ...b.mutations])].slice(0, 5);
  const primary = a.fusionLevel >= b.fusionLevel ? a : b;
  const secondary = primary === a ? b : a;
  return {
    niche: primary.niche,
    baseElement: primary.baseElement,
    generation: Math.max(a.generation, b.generation) + 1,
    mutations,
    speedScale: Math.min(1.55, (a.speedScale + b.speedScale) * 0.52),
    hpBonus: Math.max(a.hpBonus, b.hpBonus) + 1,
    sizeScale: Math.min(1.5, Math.max(a.sizeScale, b.sizeScale) + 0.14),
    regeneration: Math.max(a.regeneration, b.regeneration),
    phaseChance: Math.max(a.phaseChance, b.phaseChance),
    fusionLevel: Math.max(a.fusionLevel, b.fusionLevel) + 1,
    fusionElement: secondary.baseElement,
  };
}
