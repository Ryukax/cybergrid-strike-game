/**
 * Complete authored signature contract for selectable VS NPC skins.
 *
 * This module deliberately contains no simulation state. Game.tsx owns the
 * decision and resolution adapters, while the renderer consumes the same
 * timing and presentation metadata. That keeps all 23 signatures exhaustive
 * and prevents VS behavior from silently falling back to a generic bucket.
 */

export const NPC_SIGNATURE_IDS = [
  'chrono',
  'singularity',
  'override',
  'architect',
  'apex',
  'counter',
  'phase',
  'phoenix',
  'rift',
  'vector',
  'gridshift',
  'resonance',
  'exchange',
  'causality',
  'arsenal',
  'assimilation',
  'null',
  'polarity',
  'colossus',
  'predator',
  'orbital',
  'hijack',
  'sovereign',
] as const;

export type NpcSignatureId = typeof NPC_SIGNATURE_IDS[number];

export type NpcSignatureRole =
  | 'controller'
  | 'assault'
  | 'defender'
  | 'support'
  | 'adaptive';

export type NpcTelegraphMotif =
  | 'clock'
  | 'orbit'
  | 'transfer'
  | 'construct'
  | 'adapt'
  | 'reflect'
  | 'phase'
  | 'flame'
  | 'portal'
  | 'vector'
  | 'grid'
  | 'wave'
  | 'exchange'
  | 'causality'
  | 'arsenal'
  | 'harvest'
  | 'null'
  | 'polarity'
  | 'fortress'
  | 'hunt'
  | 'orbital'
  | 'command'
  | 'crown';

export interface NpcSignatureProfile {
  readonly id: NpcSignatureId;
  readonly label: string;
  readonly castLabel: string;
  readonly role: NpcSignatureRole;
  readonly windupSeconds: number;
  readonly recoverySeconds: number;
  readonly cooldownSeconds: { readonly min: number; readonly max: number };
  readonly interruptible: boolean;
  readonly telegraph: {
    readonly color: string;
    readonly motif: NpcTelegraphMotif;
  };
  /** One-line contract used by debugging and future AI adapters. */
  readonly intent: string;
}

const defineSignature = <T extends NpcSignatureProfile>(profile: T): T => profile;

export const NPC_SIGNATURE_PROFILES = {
  chrono: defineSignature({
    id: 'chrono', label: 'Chrono Break', castLabel: 'QUEUE BREAK', role: 'controller',
    windupSeconds: 0.95, recoverySeconds: 0.75, cooldownSeconds: { min: 16, max: 19 },
    interruptible: true, telegraph: { color: '#67e8f9', motif: 'clock' },
    intent: 'Read the player lane, delay their next attack, then release a queued cross-lane volley.',
  }),
  singularity: defineSignature({
    id: 'singularity', label: 'Singularity Engine', castLabel: 'COLLAPSE', role: 'controller',
    windupSeconds: 1.15, recoverySeconds: 0.9, cooldownSeconds: { min: 17, max: 21 },
    interruptible: true, telegraph: { color: '#c084fc', motif: 'orbit' },
    intent: 'Collapse incoming projectiles toward one lane before firing a dense gravity round.',
  }),
  override: defineSignature({
    id: 'override', label: 'Neural Override', castLabel: 'TRANSFER', role: 'adaptive',
    windupSeconds: 0.9, recoverySeconds: 0.8, cooldownSeconds: { min: 17, max: 20 },
    interruptible: true, telegraph: { color: '#f472b6', motif: 'transfer' },
    intent: 'Capture the strongest incoming projectile and return a bounded copy to its owner.',
  }),
  architect: defineSignature({
    id: 'architect', label: 'Grid Architect', castLabel: 'RELAY FRAME', role: 'defender',
    windupSeconds: 1.05, recoverySeconds: 0.7, cooldownSeconds: { min: 16, max: 19 },
    interruptible: true, telegraph: { color: '#fbbf24', motif: 'construct' },
    intent: 'Construct one barrier layer and a relay shot in the lane under greatest pressure.',
  }),
  apex: defineSignature({
    id: 'apex', label: 'Apex Adaptation', castLabel: 'ADAPT', role: 'adaptive',
    windupSeconds: 0.8, recoverySeconds: 0.65, cooldownSeconds: { min: 15, max: 18 },
    interruptible: true, telegraph: { color: '#a3e635', motif: 'adapt' },
    intent: 'Choose armor, repair, or a breaker shot from the current health and projectile state.',
  }),
  counter: defineSignature({
    id: 'counter', label: 'Counter Matrix', castLabel: 'RETURN', role: 'defender',
    windupSeconds: 0.65, recoverySeconds: 0.8, cooldownSeconds: { min: 14, max: 17 },
    interruptible: false, telegraph: { color: '#93c5fd', motif: 'reflect' },
    intent: 'Lock the nearest incoming projectile and return its lane and bounded power.',
  }),
  phase: defineSignature({
    id: 'phase', label: 'Phase Hunt', castLabel: 'PHASE STRIKE', role: 'assault',
    windupSeconds: 0.85, recoverySeconds: 0.75, cooldownSeconds: { min: 14, max: 18 },
    interruptible: true, telegraph: { color: '#a78bfa', motif: 'phase' },
    intent: 'Relocate to the safest lane while committing a strike to the player lane sampled at cast.',
  }),
  phoenix: defineSignature({
    id: 'phoenix', label: 'Phoenix Circuit', castLabel: 'VENT', role: 'support',
    windupSeconds: 1.0, recoverySeconds: 0.8, cooldownSeconds: { min: 18, max: 22 },
    interruptible: true, telegraph: { color: '#fb923c', motif: 'flame' },
    intent: 'Convert accumulated damage into a capped repair and a three-lane heat vent.',
  }),
  rift: defineSignature({
    id: 'rift', label: 'Rift Circuit', castLabel: 'PORTAL LINK', role: 'controller',
    windupSeconds: 1.0, recoverySeconds: 0.8, cooldownSeconds: { min: 16, max: 20 },
    interruptible: true, telegraph: { color: '#818cf8', motif: 'portal' },
    intent: 'Link the target lane to its opposite and fire through both exits.',
  }),
  vector: defineSignature({
    id: 'vector', label: 'Vector Dominion', castLabel: 'REDIRECT', role: 'controller',
    windupSeconds: 0.8, recoverySeconds: 0.7, cooldownSeconds: { min: 15, max: 18 },
    interruptible: true, telegraph: { color: '#22d3ee', motif: 'vector' },
    intent: 'Slow hostile trajectories, accelerate allied rounds, and answer the densest lane.',
  }),
  gridshift: defineSignature({
    id: 'gridshift', label: 'Grid Shift', castLabel: 'ROW SHIFT', role: 'controller',
    windupSeconds: 0.9, recoverySeconds: 0.75, cooldownSeconds: { min: 16, max: 19 },
    interruptible: true, telegraph: { color: '#60a5fa', motif: 'grid' },
    intent: 'Cycle incoming projectiles out of their current rows while preserving their trajectories.',
  }),
  resonance: defineSignature({
    id: 'resonance', label: 'Resonance Array', castLabel: 'ACTIVATE ARRAY', role: 'assault',
    windupSeconds: 1.1, recoverySeconds: 0.8, cooldownSeconds: { min: 17, max: 20 },
    interruptible: true, telegraph: { color: '#e879f9', motif: 'wave' },
    intent: 'Mark the sampled player lane and emit a rhythmic three-pulse attack.',
  }),
  exchange: defineSignature({
    id: 'exchange', label: 'Code Exchange', castLabel: 'PROPERTY SWAP', role: 'support',
    windupSeconds: 1.0, recoverySeconds: 0.8, cooldownSeconds: { min: 18, max: 22 },
    interruptible: true, telegraph: { color: '#2dd4bf', motif: 'exchange' },
    intent: 'Trade one point of health only while behind, otherwise exchange pressure for armor.',
  }),
  causality: defineSignature({
    id: 'causality', label: 'Causality Lock', castLabel: 'REPEAT EVENT', role: 'adaptive',
    windupSeconds: 1.1, recoverySeconds: 0.85, cooldownSeconds: { min: 18, max: 21 },
    interruptible: true, telegraph: { color: '#f0abfc', motif: 'causality' },
    intent: 'Lock cast-time health and lane, then restore one lost point and repeat the sampled attack.',
  }),
  arsenal: defineSignature({
    id: 'arsenal', label: 'Living Arsenal', castLabel: 'WEAPON FORM', role: 'adaptive',
    windupSeconds: 0.85, recoverySeconds: 0.7, cooldownSeconds: { min: 15, max: 19 },
    interruptible: true, telegraph: { color: '#fb7185', motif: 'arsenal' },
    intent: 'Select rail-lance, shield-cannon, or propulsion shot from the immediate combat need.',
  }),
  assimilation: defineSignature({
    id: 'assimilation', label: 'Arsenal Assimilation', castLabel: 'HARVEST', role: 'adaptive',
    windupSeconds: 1.05, recoverySeconds: 0.85, cooldownSeconds: { min: 18, max: 22 },
    interruptible: true, telegraph: { color: '#4ade80', motif: 'harvest' },
    intent: 'Consume one incoming weapon carrier and redeploy its bounded power and properties.',
  }),
  null: defineSignature({
    id: 'null', label: 'Null Domain', castLabel: 'SUPPRESS', role: 'controller',
    windupSeconds: 0.9, recoverySeconds: 0.85, cooldownSeconds: { min: 17, max: 21 },
    interruptible: false, telegraph: { color: '#94a3b8', motif: 'null' },
    intent: 'Suppress active player ability cooldowns and erase one nearby projectile.',
  }),
  polarity: defineSignature({
    id: 'polarity', label: 'Polarity Crown', castLabel: 'REVERSE', role: 'controller',
    windupSeconds: 0.8, recoverySeconds: 0.75, cooldownSeconds: { min: 15, max: 19 },
    interruptible: true, telegraph: { color: '#f472b6', motif: 'polarity' },
    intent: 'Reverse the nearest incoming carrier into a hostile projectile with capped power.',
  }),
  colossus: defineSignature({
    id: 'colossus', label: 'Aegis Colossus', castLabel: 'SIEGE BULWARK', role: 'defender',
    windupSeconds: 1.2, recoverySeconds: 1.0, cooldownSeconds: { min: 19, max: 23 },
    interruptible: false, telegraph: { color: '#f59e0b', motif: 'fortress' },
    intent: 'Brace behind armor, then fire a slow, high-power siege round.',
  }),
  predator: defineSignature({
    id: 'predator', label: 'Predator Protocol', castLabel: 'HUNT', role: 'assault',
    windupSeconds: 0.75, recoverySeconds: 0.7, cooldownSeconds: { min: 14, max: 18 },
    interruptible: true, telegraph: { color: '#ef4444', motif: 'hunt' },
    intent: 'Lock the player lane at cast time, pursue it, then make a dodgeable precision strike.',
  }),
  orbital: defineSignature({
    id: 'orbital', label: 'Orbital Command', castLabel: 'ORDNANCE DROP', role: 'assault',
    windupSeconds: 1.25, recoverySeconds: 0.9, cooldownSeconds: { min: 19, max: 23 },
    interruptible: true, telegraph: { color: '#38bdf8', motif: 'orbital' },
    intent: 'Designate every lane, with the sampled player lane receiving the heavy payload.',
  }),
  hijack: defineSignature({
    id: 'hijack', label: 'Command Hijack', castLabel: 'BREAK ORDER', role: 'controller',
    windupSeconds: 0.95, recoverySeconds: 0.8, cooldownSeconds: { min: 17, max: 21 },
    interruptible: true, telegraph: { color: '#34d399', motif: 'command' },
    intent: 'Issue a false order that rotates active player projectiles between lanes.',
  }),
  sovereign: defineSignature({
    id: 'sovereign', label: 'Last Sovereign', castLabel: 'ASSERT', role: 'adaptive',
    windupSeconds: 1.0, recoverySeconds: 0.9, cooldownSeconds: { min: 18, max: 22 },
    interruptible: false, telegraph: { color: '#fde68a', motif: 'crown' },
    intent: 'Scale armor and attack power from missing health without exceeding duel caps.',
  }),
} as const satisfies Record<NpcSignatureId, NpcSignatureProfile>;

export function isNpcSignatureId(value: string | undefined | null): value is NpcSignatureId {
  return value !== undefined
    && value !== null
    && Object.prototype.hasOwnProperty.call(NPC_SIGNATURE_PROFILES, value);
}

export function getNpcSignatureProfile(
  id: string | undefined | null,
): NpcSignatureProfile | undefined {
  return isNpcSignatureId(id) ? NPC_SIGNATURE_PROFILES[id] : undefined;
}
