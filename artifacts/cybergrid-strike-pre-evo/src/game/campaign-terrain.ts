export type TerrainPoint = readonly [x: number, y: number];

export interface ProvinceTerrain {
  id: string;
  image: string;
  ground: readonly TerrainPoint[];
  playerEntry: number;
  enemyEntry: number;
  combatZones: readonly number[];
  camera: {
    establish: readonly [x: number, y: number, width: number, height: number];
    ground: readonly [x: number, y: number, width: number, height: number];
  };
}

// Coordinates are normalized against the authored image. The ground points
// follow the upper surface of the generated causeway, not the canvas bounds.
export const LATTICE_FRONTIER: ProvinceTerrain = {
  id: 'lattice-frontier',
  image: 'province-lattice-frontier-v1.png',
  ground: [
    [0, .825], [.08, .824], [.18, .823], [.28, .822], [.38, .824],
    [.48, .826], [.58, .827], [.68, .825], [.78, .824], [.88, .823], [1, .821],
  ],
  playerEntry: .22,
  enemyEntry: .76,
  combatZones: [.32, .58, .82],
  camera: {
    establish: [0, 0, 1, 1],
    ground: [.04, .30, .52, .64],
  },
};

const FLAT_ROUTE: readonly TerrainPoint[] = [
  [0, .80], [.1, .80], [.2, .80], [.3, .80], [.4, .80],
  [.5, .80], [.6, .80], [.7, .80], [.8, .80], [.9, .80], [1, .80],
];

export const CAMPAIGN_PROVINCES: readonly ProvinceTerrain[] = [
  LATTICE_FRONTIER,
  {
    id: 'resonance-highlands',
    image: 'province-resonance-highlands-v1.png',
    ground: FLAT_ROUTE,
    playerEntry: .22,
    enemyEntry: .76,
    combatZones: [.2, .45, .7, .88],
    camera: { establish: [0, 0, 1, 1], ground: [.02, .29, .52, .66] },
  },
  {
    id: 'relay-delta',
    image: 'province-relay-delta-v1.png',
    ground: [
      [0, .744], [.1, .743], [.2, .744], [.3, .744], [.4, .745],
      [.5, .746], [.6, .745], [.7, .744], [.8, .743], [.9, .744], [1, .744],
    ],
    playerEntry: .22,
    enemyEntry: .76,
    combatZones: [.2, .45, .7, .88],
    camera: { establish: [0, 0, 1, 1], ground: [.02, .25, .52, .66] },
  },
  {
    id: 'archive-grove',
    image: 'province-archive-grove-v1.png',
    ground: [
      [0, .814], [.1, .813], [.2, .812], [.3, .812], [.4, .811],
      [.5, .812], [.6, .813], [.7, .814], [.8, .814], [.9, .813], [1, .812],
    ],
    playerEntry: .22, enemyEntry: .76,
    combatZones: [.15, .35, .58, .78, .92],
    camera: { establish: [0, 0, 1, 1], ground: [.02, .28, .52, .66] },
  },
  {
    id: 'thread-foundry',
    image: 'province-thread-foundry-v1.png',
    ground: [
      [0, .793], [.1, .793], [.2, .792], [.3, .793], [.4, .793],
      [.5, .794], [.6, .794], [.7, .793], [.8, .793], [.9, .792], [1, .792],
    ],
    playerEntry: .22, enemyEntry: .76,
    combatZones: [.15, .35, .58, .78, .92],
    camera: { establish: [0, 0, 1, 1], ground: [.02, .27, .52, .66] },
  },
  {
    id: 'null-expanse',
    image: 'province-null-expanse-v1.png',
    ground: [
      [0, .813], [.1, .812], [.2, .811], [.3, .811], [.4, .812],
      [.5, .813], [.6, .814], [.7, .814], [.8, .813], [.9, .812], [1, .811],
    ],
    playerEntry: .22, enemyEntry: .76,
    combatZones: [.15, .35, .58, .78, .92],
    camera: { establish: [0, 0, 1, 1], ground: [.02, .29, .52, .66] },
  },
];

export function terrainHeightAt(terrain: ProvinceTerrain, worldX: number): number {
  const points = terrain.ground;
  const x = Math.max(0, Math.min(1, worldX));
  for (let index = 1; index < points.length; index += 1) {
    const left = points[index - 1];
    const right = points[index];
    if (x <= right[0]) {
      const span = Math.max(.0001, right[0] - left[0]);
      const mix = (x - left[0]) / span;
      return left[1] + (right[1] - left[1]) * mix;
    }
  }
  return points[points.length - 1][1];
}
