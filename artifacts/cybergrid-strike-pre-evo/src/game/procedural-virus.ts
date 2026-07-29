import type { EnemyBaseElement, EnemyGenome } from './types';
import {
  compatibleFusionDonors,
  ELEMENT_DOMAIN,
  getFusionOutcome,
  getMatrixFusionOutcome,
  type ElementDomain,
  type FusionRole,
} from './element-matrix';

const CACHE_LIMIT = 192;
const SPRITE_SIZE = 48;
const QUANTIZED_SIZE = 40;
const OUTPUT_WIDTH = 240;
const OUTPUT_HEIGHT = 160;
const spriteCache = new Map<string, HTMLCanvasElement>();
type ComponentSource =
  | 'gremlin' | 'jelly' | 'beetle' | 'automaton'
  | 'capsid' | 'phage' | 'parasite' | 'spore';
type VisualSource = EnemyBaseElement | ComponentSource;
type SourceRole = FusionRole | 'core';
const sourceCache = new Map<string, HTMLImageElement>();
interface OpaqueBounds { x: number; y: number; width: number; height: number }
const opaqueBoundsCache = new WeakMap<HTMLImageElement, OpaqueBounds>();
const BASES: EnemyBaseElement[] = [
  'robot', 'insect', 'beast', 'plant', 'crystal', 'golem', 'drone',
  'cephalopod', 'skeleton', 'avian', 'serpent', 'vehicle', 'fungus',
  'cyborg', 'mech', 'nanite', 'data-wraith',
  'crab', 'owl', 'fox', 'snail', 'fish', 'mole', 'turret',
];
const CHARACTER_BASES = new Set<EnemyBaseElement>([
  'crab', 'owl', 'fox', 'snail', 'fish', 'mole', 'turret',
]);
const ANIMAL_SOURCES = new Set<VisualSource>([
  'insect', 'beast', 'avian', 'serpent', 'cephalopod', 'crab', 'owl',
  'fox', 'snail', 'fish', 'mole', 'gremlin', 'beetle', 'parasite',
]);
const OBJECT_SOURCES = new Set<VisualSource>([
  'robot', 'drone', 'vehicle', 'cyborg', 'mech', 'turret',
  'automaton', 'capsid', 'phage',
]);
// All enemies advance from right to left. These source paintings were authored
// facing right, so normalize them before they enter any composition socket.
const RIGHT_FACING_SOURCES = new Set<VisualSource>(['cyborg', 'data-wraith']);

export type EnemyMovementClass =
  | 'biped' | 'quadruped' | 'arthropod' | 'flier'
  | 'hover' | 'serpentine' | 'tentacled' | 'rooted'
  | 'colony' | 'aquatic' | 'burrower' | 'vehicle' | 'fortress' | 'spectral';
type BodyType = EnemyMovementClass;

const BODY_TYPE: Record<EnemyBaseElement, BodyType> = {
  robot: 'biped', skeleton: 'biped', cyborg: 'biped',
  beast: 'quadruped', fox: 'quadruped',
  insect: 'arthropod', crab: 'arthropod',
  avian: 'flier', owl: 'flier',
  drone: 'hover',
  serpent: 'serpentine', snail: 'serpentine',
  cephalopod: 'tentacled',
  plant: 'rooted', fungus: 'colony', nanite: 'colony',
  fish: 'aquatic', mole: 'burrower',
  vehicle: 'vehicle',
  golem: 'fortress', crystal: 'fortress', mech: 'fortress', turret: 'fortress',
  'data-wraith': 'spectral',
};

export function getEnemyMovementClass(base: EnemyBaseElement): EnemyMovementClass {
  return BODY_TYPE[base];
}

interface ComponentDefinition {
  source: VisualSource;
  role: FusionRole;
  domains: ElementDomain[];
}

type GenericComponentKind =
  | 'sensor' | 'maw' | 'crown' | 'optic'
  | 'legs' | 'treads' | 'wings' | 'fins' | 'tendrils' | 'roots' | 'hover'
  | 'armor' | 'weapon' | 'growth' | 'emitter' | 'phase';

interface CompositionPlan {
  head: GenericComponentKind;
  locomotion: GenericComponentKind;
  flank: GenericComponentKind;
}

interface BodyPlanVocabulary {
  head: GenericComponentKind[];
  locomotion: GenericComponentKind[];
  flank: GenericComponentKind[];
}

// A body plan is decided before donor artwork is selected. These vocabularies
// describe stable, mechanically plausible silhouettes rather than named
// species: a flier must receive lift, a fortress must receive support, etc.
const BODY_PLAN_VOCABULARY: Record<BodyType, BodyPlanVocabulary> = {
  biped: { head: ['optic', 'sensor', 'crown'], locomotion: ['legs', 'treads', 'hover'], flank: ['weapon', 'armor', 'emitter'] },
  quadruped: { head: ['maw', 'sensor', 'optic'], locomotion: ['legs'], flank: ['armor', 'growth', 'weapon'] },
  arthropod: { head: ['sensor', 'maw', 'optic'], locomotion: ['legs', 'treads'], flank: ['armor', 'weapon', 'emitter'] },
  flier: { head: ['optic', 'sensor'], locomotion: ['wings', 'hover'], flank: ['emitter', 'weapon', 'phase'] },
  hover: { head: ['optic', 'sensor', 'crown'], locomotion: ['hover', 'wings'], flank: ['weapon', 'emitter', 'phase'] },
  serpentine: { head: ['sensor', 'maw', 'optic'], locomotion: ['fins', 'tendrils'], flank: ['armor', 'emitter', 'growth'] },
  tentacled: { head: ['sensor', 'maw', 'crown'], locomotion: ['tendrils', 'hover'], flank: ['growth', 'emitter', 'armor'] },
  rooted: { head: ['crown', 'sensor', 'optic'], locomotion: ['roots'], flank: ['growth', 'armor', 'emitter'] },
  colony: { head: ['sensor', 'crown', 'optic'], locomotion: ['roots', 'tendrils', 'hover'], flank: ['growth', 'emitter', 'phase'] },
  aquatic: { head: ['sensor', 'optic', 'maw'], locomotion: ['fins', 'tendrils'], flank: ['armor', 'emitter', 'growth'] },
  burrower: { head: ['sensor', 'maw', 'optic'], locomotion: ['legs', 'treads'], flank: ['armor', 'weapon', 'growth'] },
  vehicle: { head: ['optic', 'sensor'], locomotion: ['treads', 'hover'], flank: ['weapon', 'armor', 'emitter'] },
  fortress: { head: ['sensor', 'crown', 'optic'], locomotion: ['treads', 'roots', 'legs'], flank: ['armor', 'weapon', 'emitter'] },
  spectral: { head: ['sensor', 'optic', 'crown'], locomotion: ['hover', 'tendrils'], flank: ['phase', 'emitter', 'growth'] },
};

function chooseKind(
  seed: number,
  salt: number,
  choices: GenericComponentKind[],
): GenericComponentKind {
  return choices[Math.floor(gene(seed, salt) * choices.length)] ?? choices[0];
}

function buildCompositionPlan(
  genome: EnemyGenome,
  seed: number,
  bodyType: BodyType,
): CompositionPlan {
  const vocabulary = BODY_PLAN_VOCABULARY[bodyType];
  const locomotionChoices = genome.mutations.includes('accelerated')
    ? vocabulary.locomotion.filter((kind) => ['legs', 'treads', 'wings', 'fins', 'hover'].includes(kind))
    : vocabulary.locomotion;
  return {
    head: chooseKind(seed, 401 + genome.generation, vocabulary.head),
    locomotion: chooseKind(
      seed,
      409 + genome.enemyClass.length,
      locomotionChoices.length > 0 ? locomotionChoices : vocabulary.locomotion,
    ),
    flank: genome.mutations.includes('armored') && vocabulary.flank.includes('armor')
      ? 'armor'
      : genome.niche === 'phase' && vocabulary.flank.includes('phase')
        ? 'phase'
        : chooseKind(seed, 419 + genome.mutations.length, vocabulary.flank),
  };
}

function coherentConceptSources(
  base: EnemyBaseElement,
): Set<VisualSource> {
  if (ANIMAL_SOURCES.has(base)) return ANIMAL_SOURCES;
  if (OBJECT_SOURCES.has(base)) return OBJECT_SOURCES;
  // Flora, mineral, fluid, colony, and spectral forms have distinctive socket
  // geometry. Keep their normal anatomy anchored to the genome's base family;
  // explicit fusion outcomes below remain the only cross-family graft path.
  return new Set<VisualSource>([base]);
}

function genericComponentKind(component: ComponentDefinition): GenericComponentKind {
  const domain = ELEMENT_DOMAIN[component.source as EnemyBaseElement]
    ?? (['automaton', 'capsid', 'phage'].includes(component.source) ? 'machine'
      : component.source === 'beetle' ? 'chitin'
      : component.source === 'jelly' ? 'fluid'
      : component.source === 'spore' ? 'flora'
      : component.source === 'parasite' || component.source === 'gremlin' ? 'fauna'
      : 'cyber');
  if (component.role === 'head') {
    if (domain === 'machine' || domain === 'cyber') return 'optic';
    if (domain === 'mineral' || domain === 'flora') return 'crown';
    if (domain === 'spectral') return 'sensor';
    return 'maw';
  }
  if (component.role === 'locomotion') {
    if (['vehicle', 'turret', 'mech', 'automaton'].includes(component.source)) return 'treads';
    if (['avian', 'owl', 'drone'].includes(component.source)) return 'wings';
    if (['fish', 'serpent', 'snail'].includes(component.source)) return 'fins';
    if (['cephalopod', 'jelly', 'parasite'].includes(component.source)) return 'tendrils';
    if (['plant', 'fungus', 'spore'].includes(component.source)) return 'roots';
    if (domain === 'spectral' || domain === 'cyber') return 'hover';
    return 'legs';
  }
  if (domain === 'mineral' || domain === 'chitin') return 'armor';
  if (domain === 'flora' || domain === 'fluid') return 'growth';
  if (domain === 'spectral') return 'phase';
  if (domain === 'machine') return 'weapon';
  return 'emitter';
}

// Former full characters are retained only as cropped anatomical vocabulary.
// A definition is eligible only where that part has a practical body socket.
const COMPONENT_LIBRARY: ComponentDefinition[] = [
  { source: 'gremlin', role: 'head', domains: ['fauna', 'chitin'] },
  { source: 'gremlin', role: 'locomotion', domains: ['fauna', 'flora'] },
  { source: 'jelly', role: 'head', domains: ['fluid', 'spectral', 'cyber'] },
  { source: 'jelly', role: 'locomotion', domains: ['fluid', 'flora', 'spectral'] },
  { source: 'beetle', role: 'head', domains: ['chitin', 'mineral'] },
  { source: 'beetle', role: 'locomotion', domains: ['chitin', 'fauna', 'machine'] },
  { source: 'beetle', role: 'flank', domains: ['chitin', 'mineral', 'fauna', 'machine'] },
  { source: 'automaton', role: 'head', domains: ['machine', 'cyber', 'mineral'] },
  { source: 'automaton', role: 'locomotion', domains: ['machine', 'cyber'] },
  { source: 'automaton', role: 'flank', domains: ['machine', 'cyber', 'mineral'] },
  // Cyber-virus paintings are vocabulary sheets, never spawnable whole families.
  // Their coherent regions are clipped into generic functional sockets.
  { source: 'capsid', role: 'head', domains: ['cyber', 'machine', 'spectral'] },
  { source: 'capsid', role: 'flank', domains: ['cyber', 'machine', 'mineral', 'chitin'] },
  { source: 'phage', role: 'head', domains: ['cyber', 'machine', 'spectral'] },
  { source: 'phage', role: 'locomotion', domains: ['cyber', 'machine', 'chitin', 'fauna'] },
  { source: 'phage', role: 'flank', domains: ['cyber', 'machine', 'mineral'] },
  { source: 'parasite', role: 'head', domains: ['cyber', 'chitin', 'fauna', 'spectral'] },
  { source: 'parasite', role: 'locomotion', domains: ['cyber', 'chitin', 'fauna', 'fluid'] },
  { source: 'parasite', role: 'flank', domains: ['cyber', 'chitin', 'mineral'] },
  { source: 'spore', role: 'head', domains: ['cyber', 'flora', 'spectral', 'fluid'] },
  { source: 'spore', role: 'locomotion', domains: ['cyber', 'flora', 'fluid', 'machine'] },
  { source: 'spore', role: 'flank', domains: ['cyber', 'flora', 'mineral'] },
];

// Every authored base is also anatomical vocabulary. A component becomes
// eligible only when the existing crossing matrix sanctions that exact role
// for the receiving domain. This exposes the complete 25-family × 3-role
// library without turning any family painting into a repeated final enemy.
const MATRIX_COMPONENT_LIBRARY: ComponentDefinition[] = BASES.flatMap((sourceBase) =>
  (['head', 'locomotion', 'flank'] as FusionRole[]).map((role) => ({
    source: sourceBase,
    role,
    domains: [...new Set([
      ELEMENT_DOMAIN[sourceBase],
      ...BASES
        .filter((primaryBase) => getFusionOutcome(primaryBase, sourceBase)?.role === role)
        .map((primaryBase) => ELEMENT_DOMAIN[primaryBase]),
    ])],
  })),
);
const COMPLETE_COMPONENT_LIBRARY = [...COMPONENT_LIBRARY, ...MATRIX_COMPONENT_LIBRARY];

function selectGenericComponent(
  genome: EnemyGenome,
  seed: number,
  role: FusionRole,
  excluded: VisualSource[] = [],
  plannedKinds: GenericComponentKind[] = [],
  preferredSources: Set<VisualSource> | undefined = undefined,
): ComponentDefinition | undefined {
  const domain = ELEMENT_DOMAIN[genome.baseElement];
  const candidates = COMPLETE_COMPONENT_LIBRARY.filter((component) =>
    component.role === role
    && component.source !== genome.baseElement
    && !excluded.includes(component.source)
    && component.domains.includes(domain));
  if (candidates.length === 0) return undefined;
  const plannedCandidates = plannedKinds.length > 0
    ? candidates.filter((component) => plannedKinds.includes(genericComponentKind(component)))
    : [];
  const kindCandidates = plannedCandidates.length > 0 ? plannedCandidates : candidates;
  const contrastingCandidates = preferredSources
    ? kindCandidates.filter((component) => preferredSources.has(component.source))
    : [];
  const eligibleCandidates = contrastingCandidates.length > 0
    ? contrastingCandidates
    : kindCandidates;
  const preferredKinds: Partial<Record<EnemyGenome['enemyClass'], GenericComponentKind[]>> = {
    skirmisher: ['sensor', 'wings', 'fins', 'hover', 'emitter'],
    guardian: ['crown', 'treads', 'roots', 'armor'],
    predator: ['maw', 'legs', 'tendrils', 'weapon'],
    replicator: ['sensor', 'tendrils', 'roots', 'growth'],
    mender: ['crown', 'roots', 'hover', 'growth'],
    infiltrator: ['optic', 'wings', 'fins', 'phase'],
    support: ['sensor', 'hover', 'roots', 'emitter'],
    scavenger: ['optic', 'legs', 'treads', 'weapon'],
  };
  const preferred = preferredKinds[genome.enemyClass] ?? [];
  const weighted = eligibleCandidates.flatMap((component) => {
    const kind = genericComponentKind(component);
    const weight = preferred.includes(kind) ? 4
      : (genome.niche === 'phase' && kind === 'phase') ? 5
      : (genome.mutations.includes('armored') && kind === 'armor') ? 4
      : (genome.mutations.includes('accelerated')
        && ['wings', 'fins', 'hover', 'legs'].includes(kind)) ? 3
      : 1;
    return Array.from({ length: weight }, () => component);
  });
  const identitySalt =
    genome.niche.length * 37
    + genome.enemyClass.length * 53
    + genome.element.length * 71
    + genome.generation * 97
    + genome.mutations.length * 131;
  return weighted[Math.floor(gene(seed + identitySalt, 310 + role.length) * weighted.length)];
}

const COMPATIBLE_HEADS: Record<BodyType, EnemyBaseElement[]> = {
  biped: ['robot', 'skeleton', 'cyborg', 'golem', 'mech', 'owl'],
  quadruped: ['beast', 'fox', 'serpent', 'cyborg', 'owl'],
  arthropod: ['insect', 'crab', 'drone', 'crystal', 'nanite'],
  flier: ['avian', 'owl', 'drone', 'insect', 'data-wraith'],
  hover: ['drone', 'robot', 'nanite', 'crystal', 'data-wraith'],
  serpentine: ['serpent', 'snail', 'cephalopod', 'drone', 'data-wraith'],
  tentacled: ['cephalopod', 'fungus', 'plant', 'nanite', 'data-wraith'],
  rooted: ['plant', 'fungus', 'crystal', 'cephalopod', 'golem'],
  colony: ['fungus', 'nanite', 'plant', 'insect', 'crystal'],
  aquatic: ['fish', 'cephalopod', 'serpent', 'drone', 'crystal'],
  burrower: ['mole', 'beast', 'crab', 'golem', 'cyborg'],
  vehicle: ['vehicle', 'robot', 'drone', 'mech', 'crab'],
  fortress: ['golem', 'crystal', 'mech', 'turret', 'robot', 'crab'],
  spectral: ['data-wraith', 'skeleton', 'cephalopod', 'owl', 'nanite'],
};

const COMPATIBLE_LOCOMOTION: Record<BodyType, EnemyBaseElement[]> = {
  biped: ['robot', 'skeleton', 'cyborg', 'golem', 'mech'],
  quadruped: ['beast', 'fox', 'insect', 'cyborg', 'golem'],
  arthropod: ['insect', 'crab', 'nanite', 'vehicle'],
  flier: ['avian', 'owl', 'drone', 'insect'],
  hover: ['drone', 'nanite', 'data-wraith', 'vehicle'],
  serpentine: ['serpent', 'snail', 'cephalopod', 'nanite'],
  tentacled: ['cephalopod', 'plant', 'fungus', 'nanite'],
  rooted: ['plant', 'fungus', 'crystal', 'cephalopod'],
  colony: ['fungus', 'nanite', 'insect', 'plant'],
  aquatic: ['fish', 'serpent', 'cephalopod', 'drone'],
  burrower: ['mole', 'crab', 'beast', 'golem'],
  vehicle: ['vehicle', 'mech', 'drone', 'crab'],
  fortress: ['golem', 'crystal', 'mech', 'turret', 'vehicle'],
  spectral: ['data-wraith', 'skeleton', 'cephalopod', 'nanite'],
};

// Locomotion is an independent functional layer, not a synonym for body type.
// Each class deliberately spans several mechanisms so a torso may receive
// wheels/treads, hover propulsion, tails, roots, tentacles or distinct legs.
const CLASS_LOCOMOTION: Record<EnemyGenome['enemyClass'], EnemyBaseElement[]> = {
  skirmisher: ['vehicle', 'drone', 'avian', 'insect', 'fish', 'serpent'],
  guardian: ['vehicle', 'turret', 'mech', 'golem', 'crab', 'snail'],
  predator: ['beast', 'fox', 'mole', 'serpent', 'cephalopod', 'vehicle'],
  replicator: ['insect', 'nanite', 'fungus', 'cephalopod', 'drone', 'crab'],
  mender: ['plant', 'fungus', 'snail', 'cephalopod', 'drone', 'golem'],
  infiltrator: ['data-wraith', 'drone', 'serpent', 'mole', 'fish', 'vehicle'],
  support: ['plant', 'cephalopod', 'snail', 'robot', 'drone', 'vehicle'],
  scavenger: ['vehicle', 'mole', 'crab', 'fox', 'nanite', 'serpent'],
};

const VISUAL_SCALE: Record<EnemyBaseElement, number> = {
  insect: 0.82, drone: 0.86, fungus: 0.9, nanite: 0.94,
  crab: 0.92, owl: 0.9, fox: 0.94, snail: 0.9,
  fish: 1.04, mole: 1.08, turret: 1.16,
  plant: 0.96, skeleton: 0.98, serpent: 1, cephalopod: 1,
  avian: 1.02, robot: 1.04, crystal: 1.06, cyborg: 1.08,
  beast: 1.1, vehicle: 1.13, golem: 1.18, mech: 1.2,
  'data-wraith': 1.05,
};

export function getBaseVisualScale(base: EnemyBaseElement): number {
  return VISUAL_SCALE[base];
}

export interface EntityMotion {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  glow: number;
}

export function getEntityMotion(base: EnemyBaseElement, now: number, seed: number): EntityMotion {
  const phase = seed * 0.173;
  const bodyType = BODY_TYPE[base];
  const wave = (speed: number) => Math.sin(now * speed + phase);
  const pulse = (speed: number) => (Math.sin(now * speed + phase) + 1) / 2;

  if (base === 'crab') {
    return { x: wave(0.012) * 2.2, y: Math.abs(wave(0.024)) * -1.2, scaleX: 1.02, scaleY: 0.98, glow: pulse(0.006) };
  }
  if (base === 'owl') {
    return { x: wave(0.003) * 0.6, y: wave(0.006) * 3.2 - 2, scaleX: 1 + wave(0.012) * 0.025, scaleY: 1 - wave(0.012) * 0.02, glow: pulse(0.008) };
  }
  if (base === 'fox') {
    return { x: wave(0.008) * 1.3, y: -Math.abs(wave(0.008)) * 3, scaleX: 1 + pulse(0.008) * 0.035, scaleY: 0.98, glow: pulse(0.01) };
  }
  if (base === 'snail') {
    return { x: wave(0.002) * 1.4, y: wave(0.004) * 0.45, scaleX: 1 + wave(0.004) * 0.018, scaleY: 1 - wave(0.004) * 0.012, glow: pulse(0.003) };
  }
  if (bodyType === 'aquatic') {
    return { x: wave(0.006) * 2.6, y: wave(0.009) * 1.5, scaleX: 1 + wave(0.01) * 0.025, scaleY: 1 - wave(0.01) * 0.018, glow: pulse(0.007) };
  }
  if (bodyType === 'burrower') {
    return { x: wave(0.013) * 1.4, y: -Math.abs(wave(0.026)) * 0.75, scaleX: 1.02, scaleY: 0.98, glow: pulse(0.009) };
  }
  if (bodyType === 'flier') {
    return { x: wave(0.004) * 0.8, y: wave(0.007) * 3, scaleX: 1 + wave(0.014) * 0.025, scaleY: 1 - wave(0.014) * 0.02, glow: pulse(0.008) };
  }
  if (bodyType === 'hover') {
    return { x: wave(0.005) * 1.2, y: wave(0.009) * 2.2 - 1, scaleX: 1.01, scaleY: 0.99, glow: pulse(0.012) };
  }
  if (bodyType === 'quadruped') {
    return { x: wave(0.009) * 1.1, y: -Math.abs(wave(0.018)) * 1.8, scaleX: 1.015, scaleY: 0.985, glow: pulse(0.005) };
  }
  if (bodyType === 'serpentine') {
    return { x: wave(0.006) * 2.1, y: wave(0.012) * 0.7, scaleX: 1 + wave(0.006) * 0.025, scaleY: 1, glow: pulse(0.007) };
  }
  if (bodyType === 'arthropod') {
    return { x: wave(0.016) * 1.7, y: -Math.abs(wave(0.032)) * 0.9, scaleX: 1.02, scaleY: 0.98, glow: pulse(0.01) };
  }
  if (bodyType === 'tentacled') {
    return { x: wave(0.005) * 1.5, y: wave(0.008) * 1.1, scaleX: 1 + wave(0.01) * 0.025, scaleY: 1 - wave(0.01) * 0.02, glow: pulse(0.006) };
  }
  if (bodyType === 'rooted') {
    return { x: 0, y: wave(0.003) * 0.7, scaleX: 1 - wave(0.003) * 0.018, scaleY: 1 + wave(0.003) * 0.025, glow: pulse(0.004) };
  }
  if (bodyType === 'vehicle') {
    return { x: wave(0.028) * 0.7, y: Math.abs(wave(0.028)) * -0.5, scaleX: 1, scaleY: 1, glow: pulse(0.012) };
  }
  if (bodyType === 'colony') {
    return { x: wave(0.01) * 0.6, y: wave(0.015) * 0.6, scaleX: 1 + wave(0.007) * 0.035, scaleY: 1 - wave(0.007) * 0.025, glow: pulse(0.009) };
  }
  if (bodyType === 'fortress') {
    return { x: wave(0.022) * 0.28, y: -Math.abs(wave(0.011)) * 0.45, scaleX: 1 + wave(0.004) * 0.01, scaleY: 1, glow: pulse(0.004) };
  }
  if (bodyType === 'spectral') {
    return { x: wave(0.004) * 2.4, y: wave(0.006) * 2.1, scaleX: 1 + wave(0.008) * 0.035, scaleY: 1 - wave(0.008) * 0.025, glow: pulse(0.014) };
  }
  return { x: wave(0.007) * 0.45, y: -Math.abs(wave(0.014)) * 1.5, scaleX: 1, scaleY: 1, glow: pulse(0.006) };
}

function gene(seed: number, salt: number): number {
  const value = Math.sin(seed * 12.9898 + salt * 91.731) * 43758.5453;
  return value - Math.floor(value);
}

function selectDifferent(pool: EnemyBaseElement[], primary: EnemyBaseElement, value: number): EnemyBaseElement {
  const choices = pool.filter((candidate) => candidate !== primary);
  return choices[Math.floor(value * choices.length)] ?? primary;
}

function source(base: VisualSource, role: SourceRole, onReady: () => void): HTMLImageElement {
  const cacheKey = `${base}:${role}`;
  const cached = sourceCache.get(cacheKey);
  if (cached) {
    if (!cached.complete) cached.addEventListener('load', onReady, { once: true });
    return cached;
  }
  const image = new Image();
  image.decoding = 'async';
  image.src = `${import.meta.env.BASE_URL}enemies/components/${base}-${role}.png`;
  image.addEventListener('load', onReady, { once: true });
  sourceCache.set(cacheKey, image);
  return image;
}

function ready(image: HTMLImageElement): boolean {
  return image.complete && image.naturalWidth > 0;
}

function opaqueBounds(image: HTMLImageElement): OpaqueBounds {
  const cached = opaqueBoundsCache.get(image);
  if (cached) return cached;
  const probe = document.createElement('canvas');
  probe.width = image.naturalWidth;
  probe.height = image.naturalHeight;
  const probeContext = probe.getContext('2d', { willReadFrequently: true })!;
  probeContext.drawImage(image, 0, 0);
  const pixels = probeContext.getImageData(0, 0, probe.width, probe.height).data;
  let minX = probe.width;
  let minY = probe.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < probe.height; y++) {
    for (let x = 0; x < probe.width; x++) {
      if (pixels[(y * probe.width + x) * 4 + 3] < 8) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  const bounds = maxX >= minX && maxY >= minY
    ? { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 }
    : { x: 0, y: 0, width: image.naturalWidth, height: image.naturalHeight };
  opaqueBoundsCache.set(image, bounds);
  return bounds;
}

function drawOriented(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  base: VisualSource,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
): void {
  if (!RIGHT_FACING_SOURCES.has(base)) {
    ctx.drawImage(image, sx, sy, sw, sh, dx, dy, dw, dh);
    return;
  }
  ctx.save();
  ctx.translate(dx * 2 + dw, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(image, sx, sy, sw, sh, dx, dy, dw, dh);
  ctx.restore();
}

function drawCoreChassis(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  base: EnemyBaseElement,
  seed: number,
  genome: EnemyGenome,
): void {
  // A family contributes only its bounded central material/chassis module.
  // It must never contribute a complete snail, bird, mushroom, machine, etc.
  // The generous fit keeps small core crops readable without restoring their
  // donor's complete silhouette.
  const availableWidth = 36;
  const availableHeight = 32;
  const bounds = opaqueBounds(image);
  const sourceAspect = bounds.width / Math.max(1, bounds.height);
  const fitWidth = sourceAspect >= 1
    ? availableWidth
    : Math.min(availableWidth, availableHeight * sourceAspect);
  const fitHeight = sourceAspect >= 1
    ? Math.min(availableHeight, availableWidth / sourceAspect)
    : availableHeight;
  const scale = 0.92 + gene(seed, 354) * 0.08;
  const width = fitWidth * scale;
  const height = fitHeight * scale;
  const x = (SPRITE_SIZE - width) / 2;
  const y = 10 + (availableHeight - height) / 2;
  ctx.save();
  ctx.filter = genomeFilter(genome, seed);
  drawOriented(
    ctx,
    image,
    base,
    bounds.x, bounds.y, bounds.width, bounds.height,
    x, y, width, height,
  );
  ctx.filter = 'none';
  ctx.restore();
}

function genomeFilter(genome: EnemyGenome, seed: number): string {
  const generationShift = Math.min(18, genome.generation * 5);
  const nicheShift: Record<string, number> = {
    scout: 8, bulwark: -5, hunter: 0, swarm: 12,
    regenerator: 16, phase: 24, symbiote: -18, opportunist: -9,
  };
  const materialOptions = CHARACTER_BASES.has(genome.baseElement) ? [
    'brightness(1)',
    'saturate(0.84) contrast(1.08)',
    'hue-rotate(12deg) saturate(1.06)',
    'hue-rotate(-16deg) saturate(0.9) brightness(1.06)',
    'sepia(0.18) saturate(1.12) contrast(1.06)',
    'hue-rotate(28deg) saturate(0.78) contrast(1.14)',
    'saturate(1.22) brightness(0.94)',
    'saturate(0.64) contrast(1.18) brightness(1.08)',
  ] : [
    'brightness(1)',
    'saturate(0.7) contrast(1.14) brightness(0.94)',
    'sepia(0.3) saturate(1.08) brightness(0.92)',
    'saturate(0.58) contrast(1.3) brightness(0.76)',
    'hue-rotate(34deg) saturate(1.24)',
    'saturate(0.5) contrast(1.08) brightness(1.14)',
  ];
  const materialFilter = materialOptions[Math.floor(gene(seed, 205) * materialOptions.length)];
  return [
    `hue-rotate(${(nicheShift[genome.niche] ?? 0) + generationShift}deg)`,
    `saturate(${0.9 + Math.min(0.25, genome.generation * 0.06)})`,
    `contrast(${1.08 + Math.min(0.2, genome.fusionLevel * 0.05)})`,
    materialFilter,
  ].join(' ');
}

type MatrixRegion = FusionRole;

function fusionComponentKind(
  outcome: NonNullable<ReturnType<typeof getFusionOutcome>>,
  plan: CompositionPlan,
): GenericComponentKind {
  if (outcome.function === 'sensor') return 'sensor';
  if (outcome.function === 'armor') return 'armor';
  if (outcome.function === 'propulsion') return plan.locomotion;
  if (outcome.function === 'weapon') return 'weapon';
  if (outcome.function === 'growth' || outcome.function === 'colony') {
    return outcome.role === 'locomotion' ? plan.locomotion : 'growth';
  }
  return 'phase';
}

function graftMask(
  ctx: CanvasRenderingContext2D,
  seed: number,
  region: MatrixRegion,
  kind?: GenericComponentKind,
): void {
  ctx.beginPath();
  if (region === 'head') {
    if (kind === 'optic') {
      ctx.roundRect(12, 4, 24, 17, 7);
    } else if (kind === 'sensor') {
      ctx.moveTo(19, 2); ctx.lineTo(29, 2); ctx.lineTo(33, 18);
      ctx.lineTo(27, 23); ctx.lineTo(18, 20); ctx.lineTo(15, 9);
    } else if (kind === 'maw') {
      ctx.moveTo(9, 8); ctx.lineTo(39, 7); ctx.lineTo(34, 22);
      ctx.lineTo(24, 18); ctx.lineTo(14, 23);
    } else {
      // Crown/neutral cranial plate, deliberately not a cap or animal head.
      ctx.moveTo(8, 11); ctx.lineTo(15, 3); ctx.lineTo(23, 8);
      ctx.lineTo(31, 2); ctx.lineTo(40, 12); ctx.lineTo(35, 21);
      ctx.lineTo(13, 20);
    }
  } else if (region === 'locomotion') {
    if (kind === 'fins') {
      ctx.moveTo(5, 31); ctx.lineTo(24, 26); ctx.lineTo(43, 32);
      ctx.lineTo(31, 38); ctx.lineTo(44, 45); ctx.lineTo(17, 43);
    } else if (kind === 'treads') {
      ctx.roundRect(2, 30, 44, 15, 7);
    } else if (kind === 'wings' || kind === 'hover') {
      ctx.moveTo(3, 29); ctx.lineTo(18, 25); ctx.lineTo(24, 34);
      ctx.lineTo(31, 25); ctx.lineTo(45, 29); ctx.lineTo(38, 42);
      ctx.lineTo(10, 42);
    } else if (kind === 'tendrils' || kind === 'roots') {
      ctx.moveTo(9, 25); ctx.lineTo(39, 25); ctx.lineTo(45, 47);
      ctx.lineTo(32, 39); ctx.lineTo(25, 47); ctx.lineTo(17, 38);
      ctx.lineTo(3, 47);
    } else {
      ctx.moveTo(8, 25); ctx.lineTo(40, 25); ctx.lineTo(43, 47);
      ctx.lineTo(29, 47); ctx.lineTo(24, 35); ctx.lineTo(19, 47);
      ctx.lineTo(5, 47);
    }
  } else {
    // A single bounded flank socket; armor, weapons and growths replace one
    // another instead of accumulating over the chassis.
    const right = gene(seed, 71) > 0.5;
    const direction = right ? 1 : -1;
    const center = right ? 35 : 13;
    if (kind === 'weapon' || kind === 'emitter') {
      ctx.moveTo(center - 4 * direction, 15);
      ctx.lineTo(center + 11 * direction, 9);
      ctx.lineTo(center + 12 * direction, 19);
      ctx.lineTo(center + 3 * direction, 25);
      ctx.lineTo(center + 9 * direction, 32);
      ctx.lineTo(center - 5 * direction, 29);
    } else if (kind === 'growth' || kind === 'phase') {
      ctx.moveTo(center - 7 * direction, 12);
      ctx.lineTo(center + 5 * direction, 6);
      ctx.lineTo(center + 3 * direction, 18);
      ctx.lineTo(center + 10 * direction, 24);
      ctx.lineTo(center + 1 * direction, 35);
      ctx.lineTo(center - 8 * direction, 28);
    } else {
      ctx.moveTo(center - 9 * direction, 11);
      ctx.lineTo(center + 8 * direction, 8);
      ctx.lineTo(center + 10 * direction, 28);
      ctx.lineTo(center + 2 * direction, 36);
      ctx.lineTo(center - 8 * direction, 30);
    }
  }
  ctx.closePath();
}

function graft(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  base: VisualSource,
  seed: number,
  genome: EnemyGenome,
  region: MatrixRegion,
  alpha: number,
  kind?: GenericComponentKind,
): void {
  if (!ready(image)) return;
  const output = ctx;
  const patch = document.createElement('canvas');
  patch.width = SPRITE_SIZE;
  patch.height = SPRITE_SIZE;
  ctx = patch.getContext('2d')!;
  ctx.imageSmoothingEnabled = true;
  ctx.save();
  graftMask(ctx, seed, region, kind);
  ctx.clip();
  ctx.globalAlpha = alpha;
  ctx.filter = genomeFilter(genome, seed);
  const bounds = opaqueBounds(image);
  const drawDonor = (dx: number, dy: number, dw: number, dh: number) =>
    drawOriented(
      ctx, image, base,
      bounds.x, bounds.y, bounds.width, bounds.height,
      dx, dy, dw, dh,
    );
  if (region === 'head') {
    if (kind === 'crown') {
      drawDonor(7, 1, 34, 20);
    } else if (kind === 'maw') {
      drawDonor(9, 7, 30, 18);
    } else if (kind === 'optic') {
      drawDonor(12, 3, 24, 20);
    } else if (kind === 'sensor') {
      drawDonor(15, 0, 18, 24);
    } else {
      drawDonor(3, 0, 42, 25);
    }
  } else if (region === 'locomotion') {
    if (kind === 'fins') {
      drawDonor(5, 28, 40, 17);
    } else if (kind === 'treads') {
      drawDonor(0, 27, 48, 19);
    } else if (kind === 'wings' || kind === 'hover') {
      drawDonor(4, 23, 40, 21);
    } else if (kind === 'tendrils' || kind === 'roots') {
      drawDonor(3, 18, 42, 30);
    } else {
      drawDonor(1, 21, 46, 27);
    }
  } else {
    if (kind === 'armor') {
      drawDonor(4, 8, 40, 33);
    } else if (kind === 'weapon' || kind === 'emitter') {
      drawDonor(24, 8, 23, 34);
    } else if (kind === 'growth') {
      drawDonor(1, 7, 25, 35);
    } else {
      drawDonor(3, 4, 42, 40);
    }
  }
  ctx.filter = 'none';
  ctx.restore();

  // Replace only pixels for which the donor actually supplied visible
  // anatomy. Transparent padding inside a source crop must never punch a
  // rectangular or polygonal hole through the anchor.
  output.save();
  output.globalCompositeOperation = 'destination-out';
  output.drawImage(patch, 0, 0);
  output.restore();
  output.drawImage(patch, 0, 0);
}

function outlineSilhouette(ctx: CanvasRenderingContext2D): void {
  const snapshot = document.createElement('canvas');
  snapshot.width = SPRITE_SIZE; snapshot.height = SPRITE_SIZE;
  snapshot.getContext('2d')!.drawImage(ctx.canvas, 0, 0);
  ctx.save();
  ctx.globalCompositeOperation = 'destination-over';
  ctx.globalAlpha = 0.72;
  ctx.filter = 'brightness(0.12) saturate(0.4)';
  for (const [x, y] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1]]) {
    ctx.drawImage(snapshot, x, y);
  }
  ctx.restore();
}

function shadeStructure(ctx: CanvasRenderingContext2D, seed: number, genome: EnemyGenome): void {
  // All overlays are clipped to existing opaque anatomy.
  ctx.globalCompositeOperation = 'source-atop';

  const shadow = ctx.createLinearGradient(0, 5, 45, 44);
  shadow.addColorStop(0, 'rgba(255,255,255,0.10)');
  shadow.addColorStop(0.52, 'rgba(0,0,0,0)');
  shadow.addColorStop(1, 'rgba(0,5,18,0.30)');
  ctx.fillStyle = shadow;
  ctx.fillRect(0, 0, SPRITE_SIZE, SPRITE_SIZE);

  const marking = Math.floor(gene(seed, 260) * 8);
  const markHue = Math.floor(gene(seed, 261) * 360);
  ctx.strokeStyle = `hsla(${markHue}, 88%, 72%, 0.34)`;
  ctx.fillStyle = `hsla(${markHue}, 82%, 65%, 0.25)`;
  ctx.lineWidth = 1.2 + gene(seed, 262);
  if (marking === 0) {
    for (let y = 11; y < 42; y += 8) { ctx.beginPath(); ctx.moveTo(7, y); ctx.lineTo(41, y - 5); ctx.stroke(); }
  } else if (marking === 1) {
    for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc(10 + gene(seed, 270 + i) * 28, 9 + gene(seed, 280 + i) * 31, 1.4 + gene(seed, 290 + i) * 2.2, 0, Math.PI * 2); ctx.fill(); }
  } else if (marking === 2) {
    ctx.beginPath(); ctx.moveTo(8, 28); ctx.lineTo(18, 19); ctx.lineTo(26, 27); ctx.lineTo(40, 14); ctx.stroke();
  } else if (marking === 3) {
    for (let x = 10; x < 42; x += 9) { ctx.fillRect(x, 8, 2, 34); }
  } else if (marking === 4) {
    ctx.beginPath(); ctx.arc(24, 23, 11, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(24, 23, 5, 0, Math.PI * 2); ctx.stroke();
  } else if (marking === 5) {
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(7, 13 + i * 10); ctx.quadraticCurveTo(24, 5 + i * 12, 41, 13 + i * 10); ctx.stroke(); }
  } else if (marking === 6) {
    ctx.beginPath(); ctx.moveTo(24, 5); ctx.lineTo(24, 42); ctx.stroke();
    ctx.fillRect(17, 16, 14, 3); ctx.fillRect(14, 29, 20, 3);
  } else {
    for (let i = 0; i < 4; i++) { ctx.fillRect(8 + i * 9, 10 + (i % 2) * 15, 6, 6); }
  }

  if (genome.mutations.includes('armored')) {
    ctx.fillStyle = 'rgba(8,14,24,0.28)';
    for (let i = 0; i < 3; i++) {
      const x = 8 + gene(seed, 90 + i) * 23;
      const y = 8 + i * 9;
      ctx.beginPath();
      ctx.moveTo(x, y); ctx.lineTo(x + 8, y - 2); ctx.lineTo(x + 11, y + 4);
      ctx.lineTo(x + 4, y + 7); ctx.closePath(); ctx.fill();
    }
  }
  if (genome.mutations.includes('volatile')) {
    ctx.strokeStyle = 'rgba(255,116,45,0.82)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(13, 8); ctx.lineTo(18, 16); ctx.lineTo(15, 24);
    ctx.moveTo(31, 11); ctx.lineTo(26, 20); ctx.lineTo(32, 29);
    ctx.stroke();
  }
  if (genome.mutations.includes('resilient')) {
    ctx.fillStyle = 'rgba(70,210,130,0.13)';
    ctx.fillRect(0, 0, SPRITE_SIZE, SPRITE_SIZE);
  }
  if (genome.mutations.includes('accelerated')) {
    ctx.fillStyle = 'rgba(92,220,255,0.35)';
    ctx.fillRect(4, 34, 15, 1);
    ctx.fillRect(1, 38, 20, 1);
  }
  ctx.globalCompositeOperation = 'source-over';
}

function render(canvas: HTMLCanvasElement, seed: number, genome: EnemyGenome): void {
  const stage = document.createElement('canvas');
  stage.width = SPRITE_SIZE;
  stage.height = SPRITE_SIZE;
  const ctx = stage.getContext('2d')!;
  ctx.imageSmoothingEnabled = true;

  const primary = source(genome.baseElement, 'core', () => render(canvas, seed, genome));
  // Deliberate composition matrix: even the base is only a core component.
  // Independent donors provide the remaining functional sockets.
  const bodyType = BODY_TYPE[genome.baseElement];
  // Body-plan compatibility is the hard rule. Element, type and class then
  // color and refine the sockets, allowing broad combinations without asking
  // a complete authored family painting to serve as the final creature.
  const compositionPlan = buildCompositionPlan(genome, seed, bodyType);
  const conceptSources = coherentConceptSources(genome.baseElement);
  const headComponent = selectGenericComponent(
    genome,
    seed + 160,
    'head',
    [],
    [compositionPlan.head],
    conceptSources,
  );
  const locomotionComponent = selectGenericComponent(
    genome,
    seed + 165,
    'locomotion',
    headComponent ? [headComponent.source] : [],
    [compositionPlan.locomotion],
    conceptSources,
  );
  const flankComponent = selectGenericComponent(
    genome,
    seed + 175,
    'flank',
    [headComponent?.source, locomotionComponent?.source]
      .filter((candidate): candidate is VisualSource => Boolean(candidate)),
    [compositionPlan.flank],
    conceptSources,
  );
  const headPool = COMPATIBLE_HEADS[bodyType];
  const locomotionPool = [
    ...new Set([
      ...CLASS_LOCOMOTION[genome.enemyClass],
      ...COMPATIBLE_LOCOMOTION[bodyType],
    ]),
  ];
  const headBase = headComponent?.source
    ?? selectDifferent(headPool, genome.baseElement, gene(seed, 160));
  const locomotionBase = locomotionComponent?.source
    ?? selectDifferent(locomotionPool, genome.baseElement, gene(seed, 165));
  const fusionPool = compatibleFusionDonors(genome.baseElement, BASES);
  const generatedFusionBase = fusionPool[Math.floor(gene(seed, 170) * fusionPool.length)] ?? genome.baseElement;
  const fusionBase = genome.fusionElement && getFusionOutcome(genome.baseElement, genome.fusionElement)
    ? genome.fusionElement
    : generatedFusionBase;
  const fusionOutcome = genome.fusionElement
    ? getMatrixFusionOutcome(genome, {
      baseElement: genome.fusionElement,
      element: genome.fusionAffinity ?? genome.element,
    })
    : getFusionOutcome(genome.baseElement, fusionBase);
  const head = source(headBase, 'head', () => render(canvas, seed, genome));
  const locomotion = source(locomotionBase, 'locomotion', () => render(canvas, seed, genome));
  const fusion = source(fusionBase, fusionOutcome?.role ?? 'flank', () => render(canvas, seed, genome));
  const flankImage = flankComponent
    ? source(flankComponent.source, 'flank', () => render(canvas, seed, genome))
    : undefined;

  // Publish the sprite atomically. Safari decodes each PNG independently;
  // drawing the core or a geometric stand-in before its sockets are ready
  // produces the one-frame polygon/mound flash seen during play.
  const requiredImages = [
    primary,
    head,
    locomotion,
    ...(fusionOutcome ? [fusion] : []),
    ...(flankImage ? [flankImage] : []),
  ];
  if (requiredImages.some((image) => !ready(image))) {
    canvas.getContext('2d')!.clearRect(0, 0, OUTPUT_WIDTH, OUTPUT_HEIGHT);
    return;
  }

  ctx.save();
  if (genome.mutations.includes('accelerated')) {
    ctx.translate(-1.5, 1);
    ctx.scale(1.07, 0.96);
  }
  drawCoreChassis(ctx, primary, genome.baseElement, seed, genome);
  ctx.restore();

  // Every entity is assembled. No authored family sprite is ever the final
  // image: the base supplies only the core while independent donors fill the
  // head, locomotion and flank sockets.
  const fusionKind = fusionOutcome ? fusionComponentKind(fusionOutcome, compositionPlan) : undefined;
  const fusionActive = genome.fusionLevel > 0
    && fusionOutcome
    && fusionBase !== genome.baseElement;
  const resolvedHead = fusionActive && fusionOutcome.role === 'head'
    ? { image: fusion, base: fusionBase, kind: fusionKind }
    : {
        image: head,
        base: headBase,
        kind: headComponent ? genericComponentKind(headComponent) : undefined,
      };
  const resolvedLocomotion = fusionActive && fusionOutcome.role === 'locomotion'
    ? { image: fusion, base: fusionBase, kind: fusionKind }
    : {
        image: locomotion,
        base: locomotionBase,
        kind: locomotionComponent ? genericComponentKind(locomotionComponent) : undefined,
      };
  graft(
    ctx,
    resolvedHead.image,
    resolvedHead.base,
    seed + 31,
    genome,
    'head',
    0.98,
    resolvedHead.kind,
  );
  graft(
    ctx,
    resolvedLocomotion.image,
    resolvedLocomotion.base,
    seed + 37,
    genome,
    'locomotion',
    0.97,
    resolvedLocomotion.kind,
  );
  if (fusionActive && fusionOutcome.role === 'flank') {
    graft(
      ctx,
      fusion,
      fusionBase,
      seed + 41,
      genome,
      'flank',
      0.9,
      fusionKind,
    );
  } else if (flankComponent && flankImage) {
    graft(
      ctx,
      flankImage,
      flankComponent.source,
      seed + 43,
      genome,
      'flank',
      genome.fusionLevel > 0 ? 0.68 : 0.86,
      genericComponentKind(flankComponent),
    );
  }

  if (fusionActive) {
    // A restrained seam makes the graft read as connected engineered anatomy.
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    ctx.strokeStyle = 'rgba(128,235,255,0.48)';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    ctx.moveTo(24, 8); ctx.lineTo(22, 20); ctx.lineTo(26, 31); ctx.lineTo(23, 42);
    ctx.stroke();
    ctx.restore();
  }

  shadeStructure(ctx, seed, genome);
  outlineSilhouette(ctx);

  // Preserve facial/mechanical definition while retaining intentional pixel art.
  const low = document.createElement('canvas');
  low.width = QUANTIZED_SIZE; low.height = QUANTIZED_SIZE;
  const lowCtx = low.getContext('2d')!;
  lowCtx.imageSmoothingEnabled = true;
  lowCtx.drawImage(stage, 0, 0, QUANTIZED_SIZE, QUANTIZED_SIZE);
  ctx.clearRect(0, 0, SPRITE_SIZE, SPRITE_SIZE);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(low, 0, 0, QUANTIZED_SIZE, QUANTIZED_SIZE, 0, 0, SPRITE_SIZE, SPRITE_SIZE);

  // Final sprites use a true 3:2, 240×160 surface. The square anatomical stage
  // remains undistorted in the center while the side field accommodates wings,
  // tails, weapons and later fusion extensions.
  const output = canvas.getContext('2d')!;
  output.clearRect(0, 0, OUTPUT_WIDTH, OUTPUT_HEIGHT);
  output.imageSmoothingEnabled = false;
  output.drawImage(stage, 0, 0, SPRITE_SIZE, SPRITE_SIZE, 40, 0, 160, 160);
}

export function getProceduralVirusSprite(seed: number, genome: EnemyGenome): HTMLCanvasElement {
  const key = `${seed}:${genome.niche}:${genome.baseElement}:${genome.fusionElement ?? 'pure'}:${genome.generation}:${genome.fusionLevel}:${genome.mutations.join(',')}`;
  const cached = spriteCache.get(key);
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  canvas.width = OUTPUT_WIDTH;
  canvas.height = OUTPUT_HEIGHT;
  render(canvas, seed, genome);
  spriteCache.set(key, canvas);
  if (spriteCache.size > CACHE_LIMIT) spriteCache.delete(spriteCache.keys().next().value!);
  return canvas;
}
