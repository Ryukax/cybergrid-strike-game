import {
  ABILITY_DEFINITIONS,
  CANONICAL_ABILITY_IDS,
  type AbilityId,
  type AbilityRole,
  type AbilityTarget,
} from './ability-system';

/**
 * The semantic effect language shared by player cards and NPC counterparts.
 * A motif selects the textured effect bank; the animation profile below adds
 * the card's unique motion, rhythm, palette and rune silhouette.
 */
export type AbilityEffectMotif =
  | 'time' | 'gravity' | 'command' | 'construct' | 'morph' | 'reflect'
  | 'dash' | 'restore' | 'portal' | 'vector' | 'grid' | 'resonance'
  | 'exchange' | 'lock' | 'weapon' | 'harvest' | 'suppress' | 'polarity'
  | 'colossus' | 'target' | 'orbital' | 'sovereign';

export type AbilityMotionFamily =
  | 'salvo'
  | 'impact'
  | 'field'
  | 'ward'
  | 'shift'
  | 'bind'
  | 'drain'
  | 'transmute'
  | 'temporal'
  | 'wave'
  | 'command';

export type AbilityAnimationAction = 'primary' | 'alternate' | 'defend';
export type AbilityAnimationAnchor = 'self' | 'player' | 'lane' | 'all-lanes';
export type AbilityAnimationRhythm = 'snap' | 'cascade' | 'pulse' | 'sustain';

export interface AbilityAnimationProfile {
  readonly source: 'authored' | 'generated';
  readonly abilityId: string;
  readonly motif: AbilityEffectMotif;
  readonly motion: AbilityMotionFamily;
  readonly action: AbilityAnimationAction;
  readonly anchor: AbilityAnimationAnchor;
  readonly rhythm: AbilityAnimationRhythm;
  readonly primary: string;
  readonly accent: string;
  /** A rendered binary rune. Canonical cards use distinct values 1–80. */
  readonly runeMask: number;
  readonly runeBits: number;
  readonly polygonSides: number;
  readonly echoCount: number;
  readonly rotationDegrees: number;
  readonly visualSignature: string;
  readonly durationMs: number;
}

export interface AbilityAnimationPresentation {
  readonly abilityId: string;
  readonly label: string;
  readonly profile: AbilityAnimationProfile;
  readonly action: AbilityAnimationAction;
  readonly anchor: AbilityAnimationAnchor;
  readonly targetRows: readonly number[];
  readonly motif: AbilityEffectMotif;
  readonly durationMs: number;
}

/**
 * Closed authored mapping. Unknown ids never acquire a generic canonical
 * presentation by accident; generated cards use the separate composition
 * resolver below.
 */
export const ABILITY_EFFECT_MOTIFS = {
  shotgun: 'weapon', heal: 'restore', time: 'time', pierce: 'vector', bomb: 'weapon',
  shield: 'reflect', overclock: 'dash', mirror: 'reflect', scramble: 'command',
  nuke: 'orbital', barrage: 'weapon', warpback: 'portal', purge: 'suppress',
  armor: 'reflect', surge: 'dash', backdash: 'dash', megabomb: 'orbital', cardflood: 'command',
  freeze: 'suppress', blizzard: 'suppress', double: 'resonance', multishot: 'weapon',
  regen: 'restore', drain: 'harvest', voltage: 'polarity', emp: 'suppress', snipe: 'target',
  gravity: 'gravity', chain: 'resonance', cluster: 'orbital', rowshuffle: 'grid',
  ghost: 'portal', turret: 'construct', echo: 'time', overdrive: 'dash', pulse: 'resonance',
  overload: 'weapon', magnet: 'polarity', berserk: 'sovereign', crit: 'target',
  flak: 'weapon', groundwire: 'grid', signaljam: 'suppress', undertow: 'vector',
  separate: 'exchange', interceptor: 'target', stasisgate: 'portal', adaptive: 'morph',
  ricochet: 'vector', rearguard: 'reflect', arcweb: 'resonance', splitter: 'morph',
  seeker: 'target', shattershot: 'weapon', marksman: 'target', returnfire: 'reflect',
  oilslick: 'grid', rootsnare: 'construct', sonicnet: 'lock', depthcharge: 'orbital',
  anchorfield: 'lock', tailclamp: 'lock', tanglewire: 'construct', trafficjam: 'grid',
  thermalshock: 'weapon', circuitarc: 'resonance', acidetch: 'morph', bloombind: 'construct',
  radiantmark: 'target', voidaperture: 'portal', kineticram: 'dash', elementswap: 'exchange',
  devolve: 'morph', mutationlock: 'lock', traittheft: 'harvest', quarantine: 'suppress',
  clonebreak: 'suppress', hybridtax: 'exchange', forcedmolt: 'morph', catalyst: 'exchange',
} as const satisfies Readonly<Record<AbilityId, AbilityEffectMotif>>;

const MOTIF_MOTION: Readonly<Record<AbilityEffectMotif, AbilityMotionFamily>> = {
  time: 'temporal', gravity: 'transmute', command: 'command', construct: 'field',
  morph: 'transmute', reflect: 'ward', dash: 'shift', restore: 'ward', portal: 'shift',
  vector: 'salvo', grid: 'field', resonance: 'wave', exchange: 'transmute', lock: 'bind',
  weapon: 'salvo', harvest: 'drain', suppress: 'bind', polarity: 'wave', colossus: 'impact',
  target: 'impact', orbital: 'impact', sovereign: 'command',
};

const MOTIF_HUE: Readonly<Record<AbilityEffectMotif, number>> = {
  time: 212, gravity: 267, command: 292, construct: 194, morph: 134, reflect: 188,
  dash: 222, restore: 143, portal: 276, vector: 177, grid: 201, resonance: 317,
  exchange: 151, lock: 24, weapon: 39, harvest: 113, suppress: 249, polarity: 339,
  colossus: 31, target: 355, orbital: 51, sovereign: 7,
};

function actionForRoles(roles: readonly AbilityRole[]): AbilityAnimationAction {
  if (roles.includes('defense') || roles.includes('sustain')) return 'defend';
  if (roles.includes('control') || roles.includes('tempo') || roles.includes('economy')) {
    return 'alternate';
  }
  return 'primary';
}

function anchorForTarget(target: AbilityTarget): AbilityAnimationAnchor {
  if (target === 'self' || target === 'hand' || target === 'projectiles') return 'self';
  if (target === 'grid') return 'all-lanes';
  if (target === 'lane') return 'lane';
  return 'player';
}

function rhythmForCadence(
  cadence: (typeof ABILITY_DEFINITIONS)[AbilityId]['cadence'],
  index: number,
): AbilityAnimationRhythm {
  if (cadence === 'window') return index % 2 === 0 ? 'pulse' : 'sustain';
  if (cadence === 'setup') return index % 2 === 0 ? 'sustain' : 'cascade';
  return index % 2 === 0 ? 'snap' : 'cascade';
}

function hueColor(hue: number, lightness: number): string {
  return `hsl(${Math.round((hue + 360) % 360)} 92% ${lightness}%)`;
}

function createCanonicalProfile(abilityId: AbilityId, index: number): AbilityAnimationProfile {
  const definition = ABILITY_DEFINITIONS[abilityId];
  const motif = ABILITY_EFFECT_MOTIFS[abilityId];
  const hue = MOTIF_HUE[motif] + ((index * 29) % 67) - 33;
  const accentHue = hue + 47 + ((index * 17) % 89);
  const motion = MOTIF_MOTION[motif];
  const action = actionForRoles(definition.roles);
  const anchor = anchorForTarget(definition.target);
  const rhythm = rhythmForCadence(definition.cadence, index);
  const runeMask = index + 1;
  const runeBits = 7;
  const polygonSides = 3 + (Math.floor(index / 3) % 6);
  const echoCount = 2 + (index % 4);
  const rotationDegrees = Math.round((index * 137.5) % 360);
  const primary = hueColor(hue, 64);
  const accent = hueColor(accentHue, 73);
  const visualSignature = [
    motif,
    motion,
    action,
    anchor,
    rhythm,
    primary,
    accent,
    runeMask,
    runeBits,
    polygonSides,
    echoCount,
    rotationDegrees,
  ].join('|');
  return Object.freeze({
    source: 'authored' as const,
    abilityId,
    motif,
    motion,
    action,
    anchor,
    rhythm,
    primary,
    accent,
    runeMask,
    runeBits,
    polygonSides,
    echoCount,
    rotationDegrees,
    visualSignature,
    durationMs: 1_050,
  });
}

export const ABILITY_ANIMATION_PROFILES = Object.freeze(Object.fromEntries(
  CANONICAL_ABILITY_IDS.map((abilityId, index) => [
    abilityId,
    createCanonicalProfile(abilityId, index),
  ]),
)) as Readonly<Record<AbilityId, AbilityAnimationProfile>>;

export function resolveAbilityAnimationProfile(abilityId: string): AbilityAnimationProfile | null {
  return Object.prototype.hasOwnProperty.call(ABILITY_ANIMATION_PROFILES, abilityId)
    ? ABILITY_ANIMATION_PROFILES[abilityId as AbilityId]
    : null;
}

function stableHash(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function generatedAbilityMotif(
  delivery: string,
  abilityFunction: string,
  medium: string,
): AbilityEffectMotif {
  if (abilityFunction === 'restore') return 'restore';
  if (abilityFunction === 'ward') return delivery === 'shell' ? 'reflect' : 'construct';
  if (abilityFunction === 'inhibit') return 'suppress';
  if (abilityFunction === 'impulse') return 'vector';
  if (abilityFunction === 'reveal') return 'target';
  if (abilityFunction === 'adapt') return 'morph';
  if (delivery === 'aperture' || medium === 'phase') return 'portal';
  if (delivery === 'field') return 'grid';
  if (delivery === 'pulse') return 'resonance';
  if (delivery === 'weave' || medium === 'organic') return 'harvest';
  return 'weapon';
}

/** Generated cards are compositional, not an unknown-id fallback. */
export function createGeneratedAbilityAnimationProfile(
  abilityId: string,
  delivery: string,
  abilityFunction: string,
  medium: string,
): AbilityAnimationProfile {
  const constitution = `${delivery}:${abilityFunction}:${medium}`;
  const hash = stableHash(`${abilityId}:${constitution}`);
  const motif = generatedAbilityMotif(delivery, abilityFunction, medium);
  const hue = MOTIF_HUE[motif] + (hash % 61) - 30;
  const accentHue = hue + 55 + ((hash >>> 8) % 101);
  const action: AbilityAnimationAction = abilityFunction === 'restore' || abilityFunction === 'ward'
    ? 'defend'
    : abilityFunction === 'rupture' ? 'primary' : 'alternate';
  const anchor: AbilityAnimationAnchor = action === 'defend'
    ? 'self'
    : delivery === 'pulse' || delivery === 'field' ? 'all-lanes' : 'player';
  const rhythm: AbilityAnimationRhythm = delivery === 'pulse'
    ? 'pulse'
    : delivery === 'weave' ? 'sustain' : delivery === 'projector' ? 'snap' : 'cascade';
  const primary = hueColor(hue, 64);
  const accent = hueColor(accentHue, 73);
  const runeMask = hash || 1;
  const runeBits = 12;
  const polygonSides = 3 + ((hash >>> 12) % 6);
  const echoCount = 2 + ((hash >>> 16) % 4);
  const rotationDegrees = hash % 360;
  const motion = MOTIF_MOTION[motif];
  const visualSignature = [
    'generated', constitution, motif, motion, action, anchor, rhythm, primary, accent,
    runeMask, runeBits, polygonSides, echoCount, rotationDegrees,
  ].join('|');
  return Object.freeze({
    source: 'generated',
    abilityId,
    motif,
    motion,
    action,
    anchor,
    rhythm,
    primary,
    accent,
    runeMask,
    runeBits,
    polygonSides,
    echoCount,
    rotationDegrees,
    visualSignature,
    durationMs: 1_050,
  });
}

export function createAbilityAnimationPresentation(
  profile: AbilityAnimationProfile,
  label: string,
  targetRow: number,
): AbilityAnimationPresentation {
  const targetRows = profile.anchor === 'all-lanes'
    ? [0, 1, 2]
    : profile.anchor === 'self'
      ? []
      : [Math.max(0, Math.min(2, Math.round(targetRow)))];
  return {
    abilityId: profile.abilityId,
    label,
    profile,
    action: profile.action,
    anchor: profile.anchor,
    targetRows,
    motif: profile.motif,
    durationMs: profile.durationMs,
  };
}
