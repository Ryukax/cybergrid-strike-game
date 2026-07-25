import type {
  EnemyBaseElement,
  EnemyClass,
  EnemyElement,
  EnemyNiche,
  EnemyType,
} from './types';

export type ElementDomain =
  | 'fauna' | 'chitin' | 'flora' | 'mineral'
  | 'machine' | 'cyber' | 'spectral' | 'fluid';
export type FusionRole = 'head' | 'locomotion' | 'flank';

export interface FusionOutcome {
  role: FusionRole;
  function: 'sensor' | 'armor' | 'propulsion' | 'weapon' | 'growth' | 'phase' | 'colony';
}

export const ELEMENT_DOMAIN: Record<EnemyBaseElement, ElementDomain> = {
  beast: 'fauna', avian: 'fauna', fox: 'fauna', owl: 'fauna', mole: 'fauna',
  insect: 'chitin', crab: 'chitin',
  plant: 'flora', fungus: 'flora',
  crystal: 'mineral', golem: 'mineral',
  robot: 'machine', drone: 'machine', vehicle: 'machine', mech: 'machine', turret: 'machine',
  cyborg: 'cyber', nanite: 'cyber',
  skeleton: 'spectral', 'data-wraith': 'spectral',
  cephalopod: 'fluid', serpent: 'fluid', snail: 'fluid', fish: 'fluid',
};

export const DOMAIN_TYPE: Record<ElementDomain, EnemyType> = {
  fauna: 'organic',
  chitin: 'chitinous',
  flora: 'botanical',
  mineral: 'lithic',
  machine: 'mechanical',
  cyber: 'synthetic',
  spectral: 'spectral',
  fluid: 'fluidic',
};

export const NICHE_CLASS: Record<EnemyNiche, EnemyClass> = {
  scout: 'skirmisher',
  bulwark: 'guardian',
  hunter: 'predator',
  swarm: 'replicator',
  regenerator: 'mender',
  phase: 'infiltrator',
  symbiote: 'support',
  opportunist: 'scavenger',
};

const DOMAIN_ELEMENTS: Record<ElementDomain, EnemyElement[]> = {
  fauna: ['kinetic', 'thermal', 'corrosive'],
  chitin: ['kinetic', 'corrosive', 'cryo'],
  flora: ['bloom', 'corrosive', 'radiant'],
  mineral: ['kinetic', 'cryo', 'radiant'],
  machine: ['kinetic', 'thermal', 'voltaic'],
  cyber: ['voltaic', 'radiant', 'void'],
  spectral: ['void', 'radiant', 'cryo'],
  fluid: ['cryo', 'corrosive', 'voltaic'],
};

export function matrixIdentity(
  base: EnemyBaseElement,
  niche: EnemyNiche,
  seed: number,
): { element: EnemyElement; entityType: EnemyType; enemyClass: EnemyClass } {
  const domain = ELEMENT_DOMAIN[base];
  const options = DOMAIN_ELEMENTS[domain];
  const index = Math.abs(Math.floor(seed * 17 + niche.length * 13)) % options.length;
  return {
    element: options[index],
    entityType: DOMAIN_TYPE[domain],
    enemyClass: NICHE_CLASS[niche],
  };
}

// A crossing describes what the secondary element is allowed to contribute to
// the primary body. Missing pairs are intentionally incompatible.
const CROSSINGS: Record<ElementDomain, Partial<Record<ElementDomain, FusionOutcome>>> = {
  fauna: {
    chitin: { role: 'flank', function: 'armor' },
    flora: { role: 'flank', function: 'growth' },
    mineral: { role: 'head', function: 'armor' },
    machine: { role: 'flank', function: 'weapon' },
    cyber: { role: 'head', function: 'sensor' },
    spectral: { role: 'head', function: 'phase' },
    fluid: { role: 'locomotion', function: 'propulsion' },
  },
  chitin: {
    fauna: { role: 'head', function: 'sensor' },
    flora: { role: 'flank', function: 'growth' },
    mineral: { role: 'flank', function: 'armor' },
    machine: { role: 'head', function: 'weapon' },
    cyber: { role: 'head', function: 'sensor' },
    spectral: { role: 'flank', function: 'phase' },
    fluid: { role: 'locomotion', function: 'propulsion' },
  },
  flora: {
    fauna: { role: 'head', function: 'sensor' },
    chitin: { role: 'locomotion', function: 'propulsion' },
    mineral: { role: 'flank', function: 'armor' },
    machine: { role: 'flank', function: 'weapon' },
    cyber: { role: 'head', function: 'colony' },
    spectral: { role: 'head', function: 'phase' },
    fluid: { role: 'locomotion', function: 'growth' },
  },
  mineral: {
    fauna: { role: 'locomotion', function: 'propulsion' },
    chitin: { role: 'flank', function: 'armor' },
    flora: { role: 'flank', function: 'growth' },
    machine: { role: 'head', function: 'weapon' },
    cyber: { role: 'head', function: 'sensor' },
    spectral: { role: 'flank', function: 'phase' },
    fluid: { role: 'locomotion', function: 'propulsion' },
  },
  machine: {
    fauna: { role: 'locomotion', function: 'propulsion' },
    chitin: { role: 'flank', function: 'armor' },
    flora: { role: 'flank', function: 'growth' },
    mineral: { role: 'flank', function: 'armor' },
    cyber: { role: 'head', function: 'sensor' },
    spectral: { role: 'head', function: 'phase' },
    fluid: { role: 'locomotion', function: 'propulsion' },
  },
  cyber: {
    fauna: { role: 'locomotion', function: 'propulsion' },
    chitin: { role: 'flank', function: 'armor' },
    flora: { role: 'flank', function: 'colony' },
    mineral: { role: 'flank', function: 'armor' },
    machine: { role: 'head', function: 'weapon' },
    spectral: { role: 'head', function: 'phase' },
    fluid: { role: 'locomotion', function: 'propulsion' },
  },
  spectral: {
    fauna: { role: 'head', function: 'sensor' },
    chitin: { role: 'flank', function: 'armor' },
    flora: { role: 'flank', function: 'growth' },
    mineral: { role: 'flank', function: 'armor' },
    machine: { role: 'head', function: 'weapon' },
    cyber: { role: 'head', function: 'sensor' },
    fluid: { role: 'locomotion', function: 'phase' },
  },
  fluid: {
    fauna: { role: 'head', function: 'sensor' },
    chitin: { role: 'flank', function: 'armor' },
    flora: { role: 'flank', function: 'growth' },
    mineral: { role: 'flank', function: 'armor' },
    machine: { role: 'flank', function: 'propulsion' },
    cyber: { role: 'head', function: 'sensor' },
    spectral: { role: 'head', function: 'phase' },
  },
};

// Element reactions refine the structural crossing. Only explicit pairs alter
// anatomy; all other valid domain crossings keep their domain-defined socket.
const ELEMENT_REACTIONS: Partial<Record<EnemyElement, Partial<Record<EnemyElement, FusionOutcome>>>> = {
  thermal: {
    cryo: { role: 'flank', function: 'armor' },
    bloom: { role: 'flank', function: 'growth' },
  },
  cryo: {
    thermal: { role: 'flank', function: 'armor' },
    voltaic: { role: 'head', function: 'sensor' },
  },
  voltaic: {
    corrosive: { role: 'head', function: 'weapon' },
    cryo: { role: 'locomotion', function: 'propulsion' },
  },
  corrosive: {
    kinetic: { role: 'head', function: 'weapon' },
    bloom: { role: 'flank', function: 'colony' },
  },
  radiant: {
    void: { role: 'head', function: 'phase' },
    bloom: { role: 'flank', function: 'growth' },
  },
  void: {
    radiant: { role: 'head', function: 'phase' },
    kinetic: { role: 'locomotion', function: 'phase' },
  },
  bloom: {
    thermal: { role: 'flank', function: 'growth' },
    corrosive: { role: 'flank', function: 'colony' },
  },
};

export function getFusionOutcome(
  primary: EnemyBaseElement,
  secondary: EnemyBaseElement,
): FusionOutcome | undefined {
  const primaryDomain = ELEMENT_DOMAIN[primary];
  const secondaryDomain = ELEMENT_DOMAIN[secondary];
  if (primaryDomain === secondaryDomain) return undefined;
  return CROSSINGS[primaryDomain][secondaryDomain];
}

export function getMatrixFusionOutcome(
  primary: Pick<import('./types').EnemyGenome, 'baseElement' | 'element'>,
  secondary: Pick<import('./types').EnemyGenome, 'baseElement' | 'element'>,
): FusionOutcome | undefined {
  const structural = getFusionOutcome(primary.baseElement, secondary.baseElement);
  if (!structural) return undefined;
  return ELEMENT_REACTIONS[primary.element]?.[secondary.element] ?? structural;
}

export function compatibleFusionDonors(
  primary: EnemyBaseElement,
  bases: EnemyBaseElement[],
): EnemyBaseElement[] {
  return bases.filter((candidate) => candidate !== primary && getFusionOutcome(primary, candidate));
}
