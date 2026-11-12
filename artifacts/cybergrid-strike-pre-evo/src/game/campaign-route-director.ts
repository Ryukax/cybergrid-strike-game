export type CampaignRouteLane = 'top' | 'middle' | 'bottom';
export type CampaignRouteDirection = 'last' | 'next';
export type CampaignRouteAvailability = Record<CampaignRouteDirection, boolean>;

export interface CampaignRouteSelection {
  lane: CampaignRouteLane;
  direction: CampaignRouteDirection | null;
}

export const CAMPAIGN_ROUTE_BOSS_ROSTER = [
  // Route order is the canonical 32-fighter table reversed into an escalating
  // ladder: competitive rank #32 opens the campaign and rank #1 closes it.
  { id: 'tempest', label: 'TEMPEST', rank: 32 },
  { id: 'phase', label: 'NYX', rank: 31 },
  { id: 'assimilation', label: 'MELD', rank: 30 },
  { id: 'arsenal', label: 'FORGE', rank: 29 },
  { id: 'resonance', label: 'CHORD', rank: 28 },
  { id: 'predator', label: 'TALON', rank: 27 },
  { id: 'singularity', label: 'GRAVITAS', rank: 26 },
  { id: 'colossus', label: 'BASTION', rank: 25 },
  { id: 'beacon', label: 'BEACON', rank: 24 },
  { id: 'polarity', label: 'DIPOLE', rank: 23 },
  { id: 'exchange', label: 'PROXY', rank: 22 },
  { id: 'orbital', label: 'ZENITH', rank: 21 },
  { id: 'architect', label: 'ARTIFEX', rank: 20 },
  { id: 'counter', label: 'AEGIS', rank: 19 },
  { id: 'swarm', label: 'SWARM', rank: 18 },
  { id: 'bloom', label: 'BLOOM', rank: 17 },
  { id: 'cryo', label: 'CRYO', rank: 16 },
  { id: 'sovereign', label: 'REGENT', rank: 15 },
  { id: 'chrono', label: 'CHRONA', rank: 14 },
  { id: 'causality', label: 'AXIOM', rank: 13 },
  { id: 'override', label: 'CIPHER', rank: 12 },
  { id: 'phoenix', label: 'EMBER', rank: 11 },
  { id: 'tidal', label: 'TIDAL', rank: 10 },
  { id: 'null', label: 'QUIETUS', rank: 9 },
  { id: 'echo', label: 'ECHO', rank: 8 },
  { id: 'mirage', label: 'MIRAGE', rank: 7 },
  { id: 'apex', label: 'VESPER', rank: 6 },
  { id: 'rift', label: 'MERIDIAN', rank: 5 },
  { id: 'vector', label: 'QUIVER', rank: 4 },
  { id: 'hijack', label: 'USURPER', rank: 3 },
  { id: 'gridshift', label: 'TESSERA', rank: 2 },
  { id: 'terra', label: 'TERRA', rank: 1 },
] as const;

export type CampaignRouteBossId = (typeof CAMPAIGN_ROUTE_BOSS_ROSTER)[number]['id'];

export interface CampaignRouteDestination {
  id: CampaignRouteBossId;
  label: string;
  rank: number;
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

// Each campaign stage owns one contiguous four-boss rank tier. The four bosses
// are alternative routes through that stage, so defeating any one of them
// advances the next fork to the following stronger tier.
export const CAMPAIGN_ROUTE_BOSS_TIER_SIZE = 4;
const BOSS_ROUTE_OFFSETS = {
  top: { last: 0, next: 1 },
  bottom: { last: 2, next: 3 },
} as const;

function resolveBossAt(completedBosses: number, offset: number): CampaignRouteDestination {
  const completed = Math.max(0, Math.floor(completedBosses));
  const finalTierStart = CAMPAIGN_ROUTE_BOSS_ROSTER.length - CAMPAIGN_ROUTE_BOSS_TIER_SIZE;
  const tierStart = Math.min(
    finalTierStart,
    completed * CAMPAIGN_ROUTE_BOSS_TIER_SIZE,
  );
  const rosterIndex = tierStart + offset;
  const boss = CAMPAIGN_ROUTE_BOSS_ROSTER[rosterIndex];
  const bearing = offset === 0 ? 'NW' : offset === 1 ? 'NE' : offset === 2 ? 'SW' : 'SE';
  return { ...boss, bearing };
}

/**
 * Resolve a stable four-way boss slate for the current completed-boss count.
 * One selected victory clears a tier, after which every bearing advances to
 * the next stronger quartet. The final #4-#1 tier remains in place after the
 * authored eight-stage arc instead of wrapping back to weaker opponents.
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
