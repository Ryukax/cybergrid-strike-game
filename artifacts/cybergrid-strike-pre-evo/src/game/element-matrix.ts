import type { EnemyBaseElement } from './types';

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
  cyborg: 'cyber', nanite: 'cyber', capsid: 'cyber', phage: 'cyber',
  parasite: 'cyber', spore: 'cyber',
  skeleton: 'spectral', 'data-wraith': 'spectral',
  cephalopod: 'fluid', serpent: 'fluid', snail: 'fluid', fish: 'fluid',
};

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

export function getFusionOutcome(
  primary: EnemyBaseElement,
  secondary: EnemyBaseElement,
): FusionOutcome | undefined {
  const primaryDomain = ELEMENT_DOMAIN[primary];
  const secondaryDomain = ELEMENT_DOMAIN[secondary];
  if (primaryDomain === secondaryDomain) return undefined;
  return CROSSINGS[primaryDomain][secondaryDomain];
}

export function compatibleFusionDonors(
  primary: EnemyBaseElement,
  bases: EnemyBaseElement[],
): EnemyBaseElement[] {
  return bases.filter((candidate) => candidate !== primary && getFusionOutcome(primary, candidate));
}
