export type CampaignRouteLane = 'top' | 'middle' | 'bottom';
export type CampaignRouteDirection = 'last' | 'next';
export type CampaignRouteAvailability = Record<CampaignRouteDirection, boolean>;

export interface CampaignRouteSelection {
  lane: CampaignRouteLane;
  direction: CampaignRouteDirection | null;
}

export const CAMPAIGN_ROUTE_BOSS_ROSTER = [
  { id: 'hijack', label: 'USURPER' },
  { id: 'chrono', label: 'CHRONA' },
  { id: 'singularity', label: 'GRAVITAS' },
  { id: 'override', label: 'CIPHER' },
  { id: 'architect', label: 'ARTIFEX' },
  { id: 'apex', label: 'VESPER' },
  { id: 'counter', label: 'AEGIS' },
  { id: 'tidal', label: 'TIDAL' },
  { id: 'mirage', label: 'MIRAGE' },
  { id: 'phoenix', label: 'EMBER' },
  { id: 'rift', label: 'MERIDIAN' },
  { id: 'vector', label: 'QUIVER' },
  { id: 'gridshift', label: 'TESSERA' },
  { id: 'resonance', label: 'CHORD' },
  { id: 'exchange', label: 'PROXY' },
  { id: 'causality', label: 'AXIOM' },
  { id: 'tempest', label: 'TEMPEST' },
  { id: 'arsenal', label: 'FORGE' },
  { id: 'assimilation', label: 'MELD' },
  { id: 'null', label: 'QUIETUS' },
  { id: 'polarity', label: 'DIPOLE' },
  { id: 'colossus', label: 'BASTION' },
  { id: 'predator', label: 'TALON' },
  { id: 'orbital', label: 'ZENITH' },
  { id: 'phase', label: 'NYX' },
  { id: 'sovereign', label: 'REGENT' },
  { id: 'cryo', label: 'CRYO' },
  { id: 'terra', label: 'TERRA' },
  { id: 'echo', label: 'ECHO' },
  { id: 'beacon', label: 'BEACON' },
  { id: 'swarm', label: 'SWARM' },
  { id: 'bloom', label: 'BLOOM' },
] as const;

export type CampaignRouteBossId = (typeof CAMPAIGN_ROUTE_BOSS_ROSTER)[number]['id'];

export interface CampaignRouteDestination {
  id: CampaignRouteBossId;
  label: string;
  bearing: 'NW' | 'NE' | 'SW' | 'SE';
}

export interface CampaignRouteBossEncounter {
  lane: Exclude<CampaignRouteLane, 'middle'>;
  direction: CampaignRouteDirection;
  destination: CampaignRouteDestination;
  segment: number;
}

export interface CampaignRouteTraversal {
  fromSegment: number;
  toSegment: number;
  direction: CampaignRouteDirection;
  lane: CampaignRouteLane;
}

export const CAMPAIGN_ROUTE_FORK_START_WAVE = 6;
// Once the campaign reaches road-fork progression, every completed-wave fork
// must offer its top/bottom NPC encounters. The middle road remains the
// encounter-free option, so the cadence belongs to each fork rather than an
// additional hidden six-route counter.
export const CAMPAIGN_ROUTE_BOSS_INTERVAL = 1;

/**
 * Freeze boss eligibility before a route intermission is presented. The first
 * eligible road fork and every subsequent road fork are boss forks. `pending`
 * keeps the encounter available when the middle road was deliberately chosen.
 */
export function isCampaignRouteBossForkDue(
  securedSegments: number,
  pending = false,
): boolean {
  return pending
    || securedSegments % CAMPAIGN_ROUTE_BOSS_INTERVAL === 0;
}

export type CampaignRouteDestinations = Record<
  Exclude<CampaignRouteLane, 'middle'>,
  Record<CampaignRouteDirection, CampaignRouteDestination>
>;

const BOSS_ROSTER_STRIDE = 5;
const BOSS_ROUTE_OFFSETS = {
  top: { last: 0, next: 8 },
  bottom: { last: 16, next: 24 },
} as const;

function resolveBossAt(completedBosses: number, offset: number): CampaignRouteDestination {
  const rosterIndex = (
    Math.max(0, Math.floor(completedBosses)) * BOSS_ROSTER_STRIDE + offset
  ) % CAMPAIGN_ROUTE_BOSS_ROSTER.length;
  const boss = CAMPAIGN_ROUTE_BOSS_ROSTER[rosterIndex];
  const bearing = offset === 0 ? 'NW' : offset === 8 ? 'NE' : offset === 16 ? 'SW' : 'SE';
  return { ...boss, bearing };
}

/**
 * Resolve a stable four-way boss slate for the current completed-boss count.
 * The stride is coprime to the 32-entry roster, so repeatedly choosing any
 * single bearing still encounters all 32 bosses before one repeats.
 */
export function resolveCampaignRouteDestinations(completedBosses = 0): CampaignRouteDestinations {
  return {
    top: {
      last: resolveBossAt(completedBosses, BOSS_ROUTE_OFFSETS.top.last),
      next: resolveBossAt(completedBosses, BOSS_ROUTE_OFFSETS.top.next),
    },
    bottom: {
      last: resolveBossAt(completedBosses, BOSS_ROUTE_OFFSETS.bottom.last),
      next: resolveBossAt(completedBosses, BOSS_ROUTE_OFFSETS.bottom.next),
    },
  };
}

// Backwards-compatible first fork for existing callers and snapshots.
export const CAMPAIGN_ROUTE_DESTINATIONS = resolveCampaignRouteDestinations(0);

export function resolveCampaignRouteSelection(row: number, col: number): CampaignRouteSelection {
  const lane: CampaignRouteLane = row <= 0 ? 'top' : row >= 2 ? 'bottom' : 'middle';
  const direction: CampaignRouteDirection | null = col <= 0 ? 'last' : col >= 2 ? 'next' : null;
  return { lane, direction };
}

export function campaignRouteSegment(wave: number, direction: CampaignRouteDirection): number {
  return Math.max(1, wave + (direction === 'last' ? -1 : 1));
}

/** Resolve the persistent world position produced by a route choice. */
export function resolveCampaignRouteTraversal(
  previousSegment: number | null,
  combatWave: number,
  direction: CampaignRouteDirection,
  lane: CampaignRouteLane,
): CampaignRouteTraversal {
  const fromSegment = Math.max(1, previousSegment ?? combatWave);
  return {
    fromSegment,
    toSegment: campaignRouteSegment(fromSegment, direction),
    direction,
    lane,
  };
}

export function resolveCampaignRouteBossEncounter(
  row: number,
  direction: CampaignRouteDirection,
  routeSegment: number,
  bossForkDue = routeSegment > 0 && routeSegment % CAMPAIGN_ROUTE_BOSS_INTERVAL === 0,
  completedBosses = 0,
): CampaignRouteBossEncounter | null {
  if (routeSegment <= 0 || !bossForkDue) return null;
  const lane = resolveCampaignRouteSelection(row, direction === 'last' ? 0 : 2).lane;
  if (lane === 'middle') return null;
  return {
    lane,
    direction,
    destination: resolveCampaignRouteDestinations(completedBosses)[lane][direction],
    segment: routeSegment,
  };
}
