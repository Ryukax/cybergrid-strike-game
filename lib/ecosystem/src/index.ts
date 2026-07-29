import { createHash } from "node:crypto";

export const CLASSIFICATIONS = [
  "Memory Leech",
  "Hash Mimic",
  "Fork Carrier",
  "Packet Rammer",
  "Latency Stalker",
  "Entropy Bloom",
  "Phase Burrower",
] as const;

export type Classification = (typeof CLASSIFICATIONS)[number];
export type MeritRank =
  | "Initiate"
  | "Maintainer"
  | "Guardian"
  | "Architect"
  | "Sentinel"
  | "Sovereign";
export type WorkKind =
  | "corruption_removed"
  | "damage_prevented"
  | "ally_assistance"
  | "sector_restoration"
  | "infrastructure_repair"
  | "boss_elimination"
  | "virus_discovery";

export interface Genome {
  version: 1;
  seed: string;
  hash: string;
  classification: Classification;
  morphology: {
    bodyPlan: number;
    symmetry: number;
    appendages: number;
    scale: number;
  };
  locomotion: {
    mode: number;
    speed: number;
    agility: number;
  };
  constitution: {
    vitality: number;
    regeneration: number;
  };
  weapons: {
    architecture: number;
    power: number;
    cadence: number;
  };
  defense: {
    armor: number;
    phase: number;
  };
  animation: {
    cycle: number;
    distortion: number;
  };
  behavior: {
    aggression: number;
    cooperation: number;
    evasion: number;
  };
  mutation: {
    depth: number;
    volatility: number;
  };
  metrics: {
    entropy: number;
    uniqueness: number;
    behavioralComplexity: number;
    corruptionPotential: number;
    restorationImpact: number;
    rarity: number;
  };
  value: number;
}

export interface IntegrityState {
  global: number;
  sectors: Record<string, number>;
  nodes: Record<string, number>;
}

export interface IntegrityWork {
  id: string;
  playerId: string;
  encounterId: string;
  kind: WorkKind;
  amount: number;
  quality: number;
  sectorId: string;
  nodeId: string;
  recordedAt: string;
}

export interface Inventory {
  classifications: Partial<Record<Classification, number>>;
  genomeShards: Record<string, number>;
  mutationFragments: Record<string, number>;
  specimens: Record<string, {
    genomeHash: string;
    classification: Classification;
    mutationDepth: number;
    discoveredAt: string;
  }>;
  research: Partial<Record<Classification, number>>;
  assistTokens: number;
  cosmetics: string[];
  animations: string[];
  weaponExpressions: string[];
}

const clamp = (value: number, min = 0, max = 100) =>
  Math.max(min, Math.min(max, value));

const byte = (hash: string, offset: number) =>
  Number.parseInt(hash.slice(offset * 2, offset * 2 + 2), 16);

const normalized = (hash: string, offset: number) => byte(hash, offset) / 255;

const shannonEntropy = (hash: string) => {
  const values = hash.match(/../g) ?? [];
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return -[...counts.values()].reduce((sum, count) => {
    const probability = count / values.length;
    return sum + probability * Math.log2(probability);
  }, 0) / 5;
};

export function deriveGenome(seed: string): Genome {
  if (!seed.trim()) throw new Error("Genome seed cannot be empty");
  const hash = createHash("sha256").update(`cybergrid:v1:${seed}`).digest("hex");
  const entropy = clamp(shannonEntropy(hash), 0, 1);
  const uniqueness = normalized(hash, 20);
  const behavioralComplexity = (
    normalized(hash, 13) + normalized(hash, 14) + normalized(hash, 15)
  ) / 3;
  const corruptionPotential = (
    normalized(hash, 9) + normalized(hash, 10) + normalized(hash, 17)
  ) / 3;
  const restorationImpact = clamp(
    corruptionPotential * 0.55 + behavioralComplexity * 0.25 + entropy * 0.2,
    0,
    1,
  );
  const rarity = Math.pow(normalized(hash, 21), 3);
  const mutationDepth = byte(hash, 16) % 9;
  const value = Math.max(1, Math.round(
    18
    + rarity * 42
    + entropy * 18
    + uniqueness * 16
    + mutationDepth * 4
    + behavioralComplexity * 22
    + corruptionPotential * 28
    + restorationImpact * 34,
  ));

  return {
    version: 1,
    seed,
    hash,
    classification: CLASSIFICATIONS[byte(hash, 0) % CLASSIFICATIONS.length],
    morphology: {
      bodyPlan: byte(hash, 1) % 16,
      symmetry: 2 + (byte(hash, 2) % 7),
      appendages: byte(hash, 3) % 13,
      scale: 0.7 + normalized(hash, 4) * 0.9,
    },
    locomotion: {
      mode: byte(hash, 5) % 8,
      speed: 0.55 + normalized(hash, 6) * 1.7,
      agility: normalized(hash, 7),
    },
    constitution: {
      vitality: 1 + (byte(hash, 8) % 12),
      regeneration: normalized(hash, 9),
    },
    weapons: {
      architecture: byte(hash, 10) % 12,
      power: 0.5 + normalized(hash, 11) * 2.5,
      cadence: 0.4 + normalized(hash, 12) * 2,
    },
    defense: {
      armor: normalized(hash, 13),
      phase: normalized(hash, 14),
    },
    animation: {
      cycle: 0.45 + normalized(hash, 15) * 2.5,
      distortion: normalized(hash, 16),
    },
    behavior: {
      aggression: normalized(hash, 17),
      cooperation: normalized(hash, 18),
      evasion: normalized(hash, 19),
    },
    mutation: {
      depth: mutationDepth,
      volatility: normalized(hash, 22),
    },
    metrics: {
      entropy,
      uniqueness,
      behavioralComplexity,
      corruptionPotential,
      restorationImpact,
      rarity,
    },
    value,
  };
}

export function integrityWorkForGenome(genome: Genome, quality = 1): number {
  return Math.max(1, Math.round(genome.value * clamp(quality, 0.1, 1.5)));
}

export function applyIntegrityWork(
  state: IntegrityState,
  work: Pick<IntegrityWork, "amount" | "quality" | "sectorId" | "nodeId">,
): IntegrityState {
  const restoration = Math.sqrt(Math.max(0, work.amount)) * clamp(work.quality, 0, 1);
  return {
    global: clamp(state.global + restoration * 0.05),
    sectors: {
      ...state.sectors,
      [work.sectorId]: clamp((state.sectors[work.sectorId] ?? state.global) + restoration * 0.18),
    },
    nodes: {
      ...state.nodes,
      [work.nodeId]: clamp((state.nodes[work.nodeId] ?? state.global) + restoration * 0.5),
    },
  };
}

export function applyNeglect(
  state: IntegrityState,
  sectorId: string,
  nodeId: string,
  corruptionPotential: number,
): IntegrityState {
  const pressure = clamp(corruptionPotential, 0, 1);
  return {
    global: clamp(state.global - pressure * 0.08),
    sectors: {
      ...state.sectors,
      [sectorId]: clamp((state.sectors[sectorId] ?? state.global) - pressure * 0.35),
    },
    nodes: {
      ...state.nodes,
      [nodeId]: clamp((state.nodes[nodeId] ?? state.global) - pressure),
    },
  };
}

export function meritRank(totalVerifiedWork: number): MeritRank {
  if (totalVerifiedWork >= 250_000) return "Sovereign";
  if (totalVerifiedWork >= 80_000) return "Sentinel";
  if (totalVerifiedWork >= 25_000) return "Architect";
  if (totalVerifiedWork >= 7_500) return "Guardian";
  if (totalVerifiedWork >= 1_500) return "Maintainer";
  return "Initiate";
}

export function rewardWeight(
  verifiedWork: number,
  activeMerit: number,
  sectorImportance: number,
  contributionQuality: number,
  systemIntegrity: number,
): number {
  const diminishingContribution = Math.sqrt(Math.max(0, verifiedWork));
  const recoveryNeed = 0.65 + (100 - clamp(systemIntegrity)) / 100;
  return diminishingContribution
    * (0.8 + clamp(activeMerit, 0, 1) * 0.2)
    * (0.75 + clamp(sectorImportance, 0, 1) * 0.5)
    * clamp(contributionQuality, 0, 1)
    * recoveryNeed;
}

export function distributeTreasury<T extends { id: string; weight: number }>(
  treasury: number,
  contributions: T[],
): Array<T & { reward: number }> {
  const safeTreasury = Math.max(0, treasury);
  const totalWeight = contributions.reduce((sum, item) => sum + Math.max(0, item.weight), 0);
  return contributions.map((item) => ({
    ...item,
    reward: totalWeight === 0 ? 0 : safeTreasury * Math.max(0, item.weight) / totalWeight,
  }));
}

export function createEmptyInventory(): Inventory {
  return {
    classifications: {},
    genomeShards: {},
    mutationFragments: {},
    specimens: {},
    research: {},
    assistTokens: 0,
    cosmetics: [],
    animations: [],
    weaponExpressions: [],
  };
}

export function addSpecimen(inventory: Inventory, genome: Genome, discoveredAt: string): Inventory {
  const shardKey = genome.hash.slice(0, 12);
  return {
    ...inventory,
    classifications: {
      ...inventory.classifications,
      [genome.classification]: (inventory.classifications[genome.classification] ?? 0) + 1,
    },
    genomeShards: {
      ...inventory.genomeShards,
      [shardKey]: (inventory.genomeShards[shardKey] ?? 0) + 1,
    },
    research: {
      ...inventory.research,
      [genome.classification]: (inventory.research[genome.classification] ?? 0)
        + 1
        + genome.mutation.depth,
    },
    specimens: {
      ...inventory.specimens,
      [genome.hash]: {
        genomeHash: genome.hash,
        classification: genome.classification,
        mutationDepth: genome.mutation.depth,
        discoveredAt,
      },
    },
  };
}
