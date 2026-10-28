import { ABILITY_LOOKUP } from './constants';
import type { VersusAbilityId } from './versus-ability-resolver';

export type NpcDoctrine =
  | 'assault'
  | 'control'
  | 'guardian'
  | 'skirmish'
  | 'support'
  | 'adaptive';

export type NpcIntent =
  | 'attack'
  | 'control'
  | 'guard'
  | 'maneuver'
  | 'sustain'
  | 'setup'
  | 'mode';

export type ShotPattern = 'none' | 'target' | 'adjacent' | 'all';

export interface VersusNpcContext {
  skillId?: string;
  npcHp: number;
  playerHp: number;
  maxHp: number;
  npcShields: number;
  maxShields: number;
  npcRow: number;
  playerRow: number;
  npcCol: number;
  incomingByRow: readonly [number, number, number];
  playerFireCooldown: number;
  playerMoveCooldown: number;
  cardProgress: number;
  step: number;
  signatureMode: number;
  signatureCharges: number;
  signaturePlacements: readonly number[];
  signatureOriginRow: number;
  signatureOriginCol: number;
  signatureLastCommand: number;
  /** Per-command coverage ledger; lower-use legal commands are surfaced first. */
  signatureCommandUses?: readonly [number, number, number];
}

export interface VersusAbilityPlan {
  abilityId: string;
  doctrine: NpcDoctrine;
  targetRow: number;
  shotPattern: ShotPattern;
  /** Number of staggered projectiles emitted per selected row. */
  salvo: number;
  power: number;
  big: boolean;
  /** Recovery awarded only after one of this plan's projectiles lands. */
  leechOnHit: number;
  recovery: number;
  shields: number;
  fireDisruption: number;
  moveDisruption: number;
  cardPressure: number;
  moveToRow?: number;
  reason: string;
}

export type BossMovementStyle = 'anchor' | 'cycle' | 'evade' | 'flank' | 'pursue';

/**
 * A boss's authored combat identity. The tuple order is intentional:
 * opening tool, pressure tool, desperation/payoff tool.
 */
export interface BossStrategyProfile {
  readonly skillId: string;
  readonly doctrine: NpcDoctrine;
  readonly abilities: readonly [VersusAbilityId, VersusAbilityId, VersusAbilityId];
  readonly movement: BossMovementStyle;
  readonly strategy: string;
}

export interface VersusSignaturePlan extends VersusAbilityPlan {
  commandIndex: 0 | 1 | 2;
  intent: NpcIntent;
  columnDelta: number;
  nextMode: number;
  nextCharges: number;
  nextPlacements: number[];
  nextOriginRow: number;
  nextOriginCol: number;
}

interface SignatureCommandSpec {
  intent: NpcIntent;
  stage?: 'instant' | 'setup' | 'mode' | 'execute';
  shotPattern?: ShotPattern;
  power?: number;
  big?: boolean;
  recovery?: number;
  shields?: number;
  fireDisruption?: number;
  moveDisruption?: number;
  cardPressure?: number;
  columnDelta?: number;
  moveTo?: 'safe' | 'target';
  requiresCharges?: number;
  requiresPlacements?: number;
  gainCharges?: number;
  place?: boolean;
  recordOrigin?: boolean;
  spendAll?: boolean;
  clearPlacements?: boolean;
}

const attack = (
  shotPattern: ShotPattern = 'target',
  power = 2,
  big = true,
): SignatureCommandSpec => ({ intent: 'attack', shotPattern, power, big });
const control = (
  fireDisruption = 0.75,
  moveDisruption = 0.4,
  cardPressure = 0,
): SignatureCommandSpec => ({
  intent: 'control', fireDisruption, moveDisruption, cardPressure,
});
const guard = (shields = 1, recovery = 0): SignatureCommandSpec => ({
  intent: 'guard', shields, recovery,
});
const maneuver = (columnDelta = 0): SignatureCommandSpec => ({
  intent: 'maneuver', columnDelta, moveTo: 'safe',
});
const sustain = (recovery = 2, shields = 0): SignatureCommandSpec => ({
  intent: 'sustain', recovery, shields,
});
const setup = (place = true, recordOrigin = false): SignatureCommandSpec => ({
  intent: 'setup', stage: 'setup', gainCharges: 1, place, recordOrigin,
});
const mode = (): SignatureCommandSpec => ({ intent: 'mode', stage: 'mode' });
const charged = (
  spec: SignatureCommandSpec,
  gainCharges = 1,
  place = false,
): SignatureCommandSpec => ({ ...spec, stage: 'setup', gainCharges, place });
const payoff = (
  spec: SignatureCommandSpec,
  requiresCharges = 1,
  requiresPlacements = 0,
): SignatureCommandSpec => ({
  ...spec,
  stage: 'execute',
  requiresCharges,
  requiresPlacements,
  spendAll: true,
  clearPlacements: requiresPlacements > 0,
});

/**
 * Each signature command keeps its authored meaning while exposing a common
 * tactical intent. The scoring layer can therefore make stateful decisions
 * without replacing each skin's identity with one generic NPC routine.
 */
const SIGNATURE_COMMANDS: Record<string, readonly [SignatureCommandSpec, SignatureCommandSpec, SignatureCommandSpec]> = {
  chrono: [setup(true), maneuver(-1), payoff(control(0.45, 0.65, 0.8), 1, 1)],
  singularity: [charged(control(0.45, 0.35), 1), payoff(attack('adjacent', 2, true)), guard(1)],
  override: [setup(false, true), mode(), payoff(guard(1, 2))],
  architect: [charged(attack('target', 1, false), 1, true), setup(true), payoff(guard(2), 2, 2)],
  apex: [mode(), attack('target', 3, true), guard(1, 1)],
  counter: [charged(control(0.25, 0.15), 1), mode(), payoff(attack('target', 2, true))],
  phase: [setup(false, true), payoff(attack('target', 3, true)), maneuver(1)],
  phoenix: [setup(false, true), payoff(attack('all', 1, true)), payoff(sustain(3, 1))],
  rift: [setup(true), { ...maneuver(-1), requiresPlacements: 1 }, guard(1)],
  vector: [control(0.4, 0.7), attack('adjacent', 2, true), control(0.55, 0.6)],
  gridshift: [mode(), control(0.55, 0.5, 0.45), guard(1)],
  resonance: [setup(true), setup(true), payoff(attack('all', 1, true), 2, 2)],
  exchange: [mode(), charged(control(0.45, 0.25, 0.55), 1), payoff(sustain(2, 1))],
  causality: [mode(), setup(false, true), payoff(attack('adjacent', 2, true))],
  arsenal: [charged(attack('target', 2, true), 1), charged(guard(1), 1), charged(maneuver(-1), 1)],
  assimilation: [charged(attack('target', 1, false), 1), mode(), payoff(attack('all', 2, true), 2)],
  null: [control(0.95, 0.2, 0.65), mode(), guard(1)],
  polarity: [setup(true), mode(), payoff(attack('adjacent', 2, true), 2, 2)],
  colossus: [attack('target', 3, true), attack('adjacent', 2, true), guard(2, 1)],
  predator: [setup(false), charged(attack('target', 2, true), 1), guard(1)],
  orbital: [setup(true), mode(), payoff(attack('all', 2, true), 2, 2)],
  hijack: [mode(), charged(control(0.55, 0.25, 0.6), 1), payoff(attack('target', 2, true))],
  sovereign: [attack('target', 3, true), charged(control(0.45, 0.3, 0.4), 1), sustain(3, 1)],
  tempest: [setup(false), payoff(attack('adjacent', 2, true), 2), payoff(guard(1), 1)],
  cryo: [charged(control(0.8, 0.55), 1), payoff(attack('target', 2, true), 2), payoff(sustain(3, 1))],
  terra: [charged(guard(1), 1), payoff(attack('target', 3, true)), payoff(guard(2, 1), 2)],
  echo: [setup(true), payoff(attack('adjacent', 1, true), 2, 2), maneuver(0)],
  mirage: [setup(true), guard(1), payoff(attack('target', 2, true), 1, 1)],
  beacon: [setup(true), { ...attack('all', 1, false), requiresPlacements: 1 }, payoff(sustain(3, 1), 2, 2)],
  swarm: [setup(true), mode(), payoff(attack('all', 1, true), 2, 2)],
  bloom: [setup(true), charged(sustain(1), 1), payoff(sustain(3, 1), 2, 1)],
  tidal: [charged(attack('target', 2, true), 1), control(0.45, 0.55), payoff(guard(1), 2)],
};

const bossProfile = (
  skillId: string,
  doctrine: NpcDoctrine,
  abilities: readonly [VersusAbilityId, VersusAbilityId, VersusAbilityId],
  movement: BossMovementStyle,
  strategy: string,
): BossStrategyProfile => ({ skillId, doctrine, abilities, movement, strategy });

/**
 * The campaign's complete advanced-skin boss roster. Abilities are all drawn
 * from the canonical player ability registry, but their VS effects are bounded
 * by the duel resolver below. No two bosses share the same loadout.
 */
export const BOSS_STRATEGY_PROFILES: Readonly<Record<string, BossStrategyProfile>> = {
  hijack: bossProfile('hijack', 'control', ['scramble', 'cardflood', 'trafficjam'], 'cycle', 'commandeer the player hand, then congest its escape'),
  chrono: bossProfile('chrono', 'control', ['time', 'freeze', 'warpback'], 'evade', 'bank time, arrest momentum, then rewind position'),
  singularity: bossProfile('singularity', 'control', ['gravity', 'magnet', 'anchorfield'], 'anchor', 'collapse movement toward one stable gravity well'),
  override: bossProfile('override', 'assault', ['traittheft', 'elementswap', 'emp'], 'pursue', 'read the opponent, rewrite the exchange, then disable its channel'),
  architect: bossProfile('architect', 'guardian', ['turret', 'tanglewire', 'shield'], 'anchor', 'construct covering fire, wire the escape, then defend it'),
  apex: bossProfile('apex', 'assault', ['forcedmolt', 'shattershot', 'purge'], 'pursue', 'force exposure, break defenses, then purge the weakened form'),
  counter: bossProfile('counter', 'guardian', ['returnfire', 'mirror', 'shield'], 'anchor', 'invite commitment and answer it symmetrically'),
  tidal: bossProfile('tidal', 'skirmish', ['undertow', 'depthcharge', 'tailclamp'], 'cycle', 'pull alignment apart, punish depth, then clamp the lane'),
  mirage: bossProfile('mirage', 'skirmish', ['ghost', 'backdash', 'oilslick'], 'evade', 'vanish from pressure, create distance, then foul pursuit'),
  phoenix: bossProfile('phoenix', 'assault', ['regen', 'overload', 'overdrive'], 'pursue', 'recover through attrition before risking accelerated output'),
  rift: bossProfile('rift', 'skirmish', ['voidaperture', 'rearguard', 'warpback'], 'flank', 'open distance on both sides and fold the lane backward'),
  vector: bossProfile('vector', 'control', ['pierce', 'ricochet', 'stasisgate'], 'flank', 'arm penetration, establish angles, then seal the chosen lane'),
  gridshift: bossProfile('gridshift', 'control', ['rowshuffle', 'kineticram', 'trafficjam'], 'cycle', 'reindex lanes and punish the route that becomes crowded'),
  resonance: bossProfile('resonance', 'control', ['pulse', 'sonicnet', 'splitter'], 'cycle', 'build synchronized pressure into a multi-lane release'),
  exchange: bossProfile('exchange', 'control', ['traittheft', 'separate', 'drain'], 'flank', 'steal a property, split its fusion, then reclaim damage as health'),
  causality: bossProfile('causality', 'control', ['time', 'devolve', 'returnfire'], 'anchor', 'delay the cause, regress it, then return its consequence'),
  tempest: bossProfile('tempest', 'assault', ['voltage', 'flak', 'chain'], 'pursue', 'charge the grid, deny flight, and propagate a decisive arc'),
  arsenal: bossProfile('arsenal', 'assault', ['barrage', 'shotgun', 'overclock'], 'anchor', 'open with ordnance, spread pressure, then accelerate output'),
  assimilation: bossProfile('assimilation', 'assault', ['acidetch', 'hybridtax', 'adaptive'], 'pursue', 'etch protection, tax hybrid traits, then adapt to the survivor'),
  null: bossProfile('null', 'control', ['signaljam', 'mutationlock', 'quarantine'], 'anchor', 'strip options until the opponent has no safe evolution'),
  polarity: bossProfile('polarity', 'control', ['magnet', 'circuitarc', 'kineticram'], 'flank', 'reverse spacing, bridge the charge, then drive the lane'),
  colossus: bossProfile('colossus', 'guardian', ['bomb', 'nuke', 'megabomb'], 'anchor', 'escalate ordnance until the formation cannot remain intact'),
  predator: bossProfile('predator', 'assault', ['seeker', 'marksman', 'snipe'], 'pursue', 'acquire the weakest line, mark it, then commit the shot'),
  orbital: bossProfile('orbital', 'assault', ['cluster', 'surge', 'stasisgate'], 'anchor', 'designate a cluster, saturate the grid, then deny transit'),
  phase: bossProfile('phase', 'assault', ['ghost', 'seeker', 'crit'], 'flank', 'pass through commitment and strike the exposed lane'),
  sovereign: bossProfile('sovereign', 'guardian', ['berserk', 'catalyst', 'armor'], 'pursue', 'assert tempo, risk a catalyst, and fortify the advantage'),
  cryo: bossProfile('cryo', 'guardian', ['freeze', 'blizzard', 'thermalshock'], 'anchor', 'slow motion into brittleness and finish with thermal fracture'),
  terra: bossProfile('terra', 'guardian', ['shield', 'groundwire', 'kineticram'], 'anchor', 'hold ground, electrify approach, then answer with mass'),
  echo: bossProfile('echo', 'control', ['echo', 'double', 'rearguard'], 'flank', 'record an attack, double its release, and replay it from behind'),
  beacon: bossProfile('beacon', 'support', ['turret', 'interceptor', 'radiantmark'], 'anchor', 'establish a sentry, intercept pressure, and mark the target'),
  swarm: bossProfile('swarm', 'assault', ['multishot', 'clonebreak', 'arcweb'], 'cycle', 'multiply local fire, break decoys, and conduct the formation'),
  bloom: bossProfile('bloom', 'support', ['heal', 'rootsnare', 'bloombind'], 'evade', 'restore vitality, root pursuit, and bind escape'),
};

const ADAPTIVE_BOSS_PROFILE = bossProfile(
  'adaptive',
  'adaptive',
  ['adaptive', 'seeker', 'scramble'],
  'cycle',
  'read the board and answer its strongest signal',
);

export function bossStrategyProfile(skillId?: string): BossStrategyProfile {
  return (skillId && BOSS_STRATEGY_PROFILES[skillId]) || ADAPTIVE_BOSS_PROFILE;
}

function clampLane(row: number): number {
  return Math.max(0, Math.min(2, Math.round(row)));
}

function stableNoise(key: string): number {
  let hash = 2166136261;
  for (const char of key) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 0x1_0000_0000;
}

function safestLane(incoming: readonly [number, number, number], step = 0): number {
  const minimum = Math.min(...incoming);
  const candidates = [0, 1, 2].filter((row) => incoming[row] === minimum);
  return candidates[Math.abs(step) % candidates.length] ?? 1;
}

export function doctrineForSkill(skillId?: string): NpcDoctrine {
  return bossStrategyProfile(skillId).doctrine;
}

function scoreIntent(
  spec: SignatureCommandSpec,
  context: VersusNpcContext,
  commandIndex: number,
): number {
  const maxHp = Math.max(1, context.maxHp);
  const npcRatio = context.npcHp / maxHp;
  const playerRatio = context.playerHp / maxHp;
  const currentThreat = context.incomingByRow[clampLane(context.npcRow)] ?? 0;
  const totalThreat = context.incomingByRow.reduce((sum, count) => sum + count, 0);
  const shieldRoom = Math.max(0, context.maxShields - context.npcShields);
  const missingHp = Math.max(0, maxHp - context.npcHp) / maxHp;
  const behind = context.playerHp - context.npcHp > maxHp * 0.08;
  let score = 1;

  if (spec.intent === 'setup' || spec.intent === 'mode') {
    score += 0;
  } else if (spec.intent === 'attack') {
    score += (1 - playerRatio) * 3 + (behind ? 0.8 : 0.25);
    if (totalThreat === 0) score += 0.8;
  } else if (spec.intent === 'control') {
    score += (context.playerFireCooldown < 0.35 ? 1.4 : 0.25)
      + (context.playerMoveCooldown < 0.2 ? 0.65 : 0)
      + context.cardProgress * 1.1
      + (behind ? 0.45 : 0);
  } else if (spec.intent === 'guard') {
    score += currentThreat * 1.35 + totalThreat * 0.35
      + (1 - npcRatio) * 2.4 + shieldRoom * 0.45;
  } else if (spec.intent === 'maneuver') {
    score += currentThreat * 1.6 + totalThreat * 0.25
      + (context.npcRow === context.playerRow ? 0.2 : 0.55);
  } else {
    score += missingHp * 4 + (behind ? 1.1 : 0) + shieldRoom * 0.25;
  }

  if (spec.stage === 'execute') {
    score += 2 + context.signatureCharges * 0.55 + context.signaturePlacements.length * 0.35;
  } else if (spec.stage === 'setup') {
    const room = Math.max(0, 4 - context.signatureCharges);
    score += room > 0 ? (context.signatureCharges === 0 ? 5 : 1.5) : -8;
    if (totalThreat > 2) score -= 0.4;
  } else if (spec.stage === 'mode') {
    score += context.signatureCharges > 0 ? 1.45 : 0.35;
  }
  if (context.signatureLastCommand === commandIndex) score -= 1.25;

  return score + stableNoise(`${context.skillId}:${context.step}:${commandIndex}`) * 0.08;
}

function rowsForPattern(pattern: ShotPattern, targetRow: number): number[] {
  const row = clampLane(targetRow);
  if (pattern === 'all') return [0, 1, 2];
  if (pattern === 'adjacent') return row === 0 ? [0, 1] : row === 2 ? [2, 1] : [1, 2];
  if (pattern === 'target') return [row];
  return [];
}

type BossBattlePhase = 'opening' | 'pressure' | 'desperation';

function bossBattlePhase(context: VersusNpcContext): BossBattlePhase {
  const ratio = context.npcHp / Math.max(1, context.maxHp);
  return ratio > 0.66 ? 'opening' : ratio > 0.33 ? 'pressure' : 'desperation';
}

const REACTIVE_ABILITY_IDS = new Set(['interceptor', 'returnfire']);

function ordinaryPressurePlan(
  context: VersusNpcContext,
  rejectedAbilityId?: string,
): VersusAbilityPlan {
  return {
    abilityId: 'shotgun',
    doctrine: bossStrategyProfile(context.skillId).doctrine,
    targetRow: clampLane(context.playerRow),
    shotPattern: 'adjacent',
    salvo: 1,
    power: 2,
    big: true,
    leechOnHit: 0,
    recovery: 0,
    shields: 0,
    fireDisruption: 0,
    moveDisruption: 0,
    cardPressure: 0,
    reason: rejectedAbilityId
      ? `ordinary pressure; rejected unknown ability ${rejectedAbilityId}`
      : 'ordinary pressure while no authored ability is practical',
  };
}

/**
 * Converts a canonical ability card into a bounded VS action. This deliberately
 * preserves the card's combat vocabulary without invoking campaign-only enemy
 * collections or changing the player's version of the card.
 */
export function resolveVersusNpcAbility(
  abilityId: string,
  context: VersusNpcContext,
): VersusAbilityPlan {
  // Unknown IDs must not masquerade as a working signature. Select a real,
  // canonical pressure action so the executed effect and announced card agree.
  if (!ABILITY_LOOKUP[abilityId]) return ordinaryPressurePlan(context, abilityId);

  const profile = bossStrategyProfile(context.skillId);
  const plan: VersusAbilityPlan = {
    abilityId,
    doctrine: profile.doctrine,
    targetRow: clampLane(context.playerRow),
    shotPattern: 'none',
    salvo: 1,
    power: 1,
    big: false,
    leechOnHit: 0,
    recovery: 0,
    shields: 0,
    fireDisruption: 0,
    moveDisruption: 0,
    cardPressure: 0,
    reason: 'maintaining tactical tempo',
  };
  const safeRow = safestLane(context.incomingByRow, context.step);

  switch (abilityId) {
    case 'shotgun':
      plan.shotPattern = 'adjacent';
      plan.power = 2;
      plan.big = true;
      plan.reason = 'applying ordinary adjacent-lane pressure';
      break;
    case 'heal':
      plan.recovery = 2;
      plan.reason = 'restoring a measured health deficit';
      break;
    case 'regen':
      plan.recovery = 3;
      plan.reason = 'converting the quiet interval into recovery';
      break;
    case 'drain':
    case 'traittheft':
      plan.shotPattern = 'target';
      plan.leechOnHit = 2;
      plan.big = true;
      plan.reason = 'reclaiming vitality through a committed hit';
      break;
    case 'shield':
      plan.shields = 1;
      plan.reason = 'guarding the next incoming strike';
      break;
    case 'armor':
      plan.shields = 2;
      plan.reason = 'layering defense against concentrated pressure';
      break;
    case 'ghost':
      plan.shields = 1;
      plan.moveToRow = safeRow;
      plan.reason = 'phasing toward the least threatened lane';
      break;
    case 'time':
      plan.fireDisruption = 0.7;
      plan.moveDisruption = 0.75;
      plan.cardPressure = 0.35;
      plan.reason = 'slowing the player action cycle';
      break;
    case 'freeze':
      plan.fireDisruption = 0.9;
      plan.moveDisruption = 0.85;
      plan.cardPressure = 0.25;
      plan.reason = 'arresting movement and fire together';
      break;
    case 'blizzard':
      plan.fireDisruption = 0.5;
      plan.moveDisruption = 0.8;
      plan.reason = 'turning the active lane into difficult terrain';
      break;
    case 'signaljam':
    case 'mutationlock':
      plan.fireDisruption = 0.68;
      plan.moveDisruption = 0.3;
      plan.cardPressure = 1;
      plan.reason = 'suppressing both input tempo and card recovery';
      break;
    case 'quarantine':
      plan.fireDisruption = 0.35;
      plan.moveDisruption = 0.7;
      plan.cardPressure = 0.5;
      plan.reason = 'isolating the player from the intended route';
      break;
    case 'scramble':
      plan.fireDisruption = 0.3;
      plan.moveDisruption = 0.45;
      plan.reason = 'breaking the current firing alignment';
      break;
    case 'rowshuffle':
      plan.fireDisruption = 0.2;
      plan.moveDisruption = 0.65;
      plan.moveToRow = safeRow;
      plan.reason = 'reindexing the duel around a safer lane';
      break;
    case 'trafficjam':
      plan.fireDisruption = 0.35;
      plan.moveDisruption = 0.8;
      plan.cardPressure = 0.35;
      plan.reason = 'congesting the route the player is trying to use';
      break;
    case 'backdash':
      plan.moveDisruption = 0.6;
      plan.moveToRow = safeRow;
      plan.reason = 'creating distance before the next engagement';
      break;
    case 'warpback':
      plan.shotPattern = 'target';
      plan.moveDisruption = 0.6;
      plan.cardPressure = 0.35;
      plan.big = true;
      plan.reason = 'folding the player route backward';
      break;
    case 'gravity':
      plan.shotPattern = 'adjacent';
      plan.moveDisruption = 0.6;
      plan.reason = 'pulling adjacent lanes toward a common center';
      break;
    case 'magnet':
      plan.fireDisruption = 0.25;
      plan.moveDisruption = 0.58;
      plan.reason = 'reversing spacing through polarized force';
      break;
    case 'anchorfield':
      plan.shields = 1;
      plan.moveDisruption = 0.85;
      plan.reason = 'anchoring both combatants around a defended position';
      break;
    case 'stasisgate':
      plan.shields = 1;
      plan.fireDisruption = 0.25;
      plan.moveDisruption = 0.55;
      plan.reason = 'guarding a lane boundary with a stasis threshold';
      break;
    case 'undertow':
      plan.shotPattern = 'target';
      plan.moveDisruption = 0.65;
      plan.big = true;
      plan.reason = 'dragging the target back into the contested lane';
      break;
    case 'tailclamp':
    case 'groundwire':
      plan.shotPattern = 'target';
      plan.moveDisruption = abilityId === 'tailclamp' ? 0.85 : 0.7;
      plan.reason = 'pinning movement before the follow-up';
      break;
    case 'sonicnet':
      plan.shotPattern = 'target';
      plan.fireDisruption = 0.4;
      plan.moveDisruption = 0.65;
      plan.reason = 'netting the active lane with a disruptive pulse';
      break;
    case 'voidaperture':
      plan.shotPattern = 'target';
      plan.moveDisruption = 0.8;
      plan.cardPressure = 0.6;
      plan.big = true;
      plan.reason = 'opening a void fold beneath the committed route';
      break;
    case 'elementswap':
      plan.shotPattern = 'adjacent';
      plan.cardPressure = 0.8;
      plan.reason = 'rewriting the present matchup before attacking it';
      break;
    case 'bloombind':
      plan.shotPattern = 'target';
      plan.fireDisruption = 0.35;
      plan.moveDisruption = 0.75;
      plan.reason = 'binding the target lane with a living restraint';
      break;
    case 'pulse':
      plan.shotPattern = 'adjacent';
      plan.fireDisruption = 0.4;
      plan.moveDisruption = 0.35;
      plan.reason = 'radiating pressure across neighboring lanes';
      break;
    case 'turret':
      plan.shotPattern = 'all';
      plan.reason = 'establishing measured covering fire';
      break;
    case 'overclock':
      plan.shotPattern = 'adjacent';
      plan.salvo = 2;
      plan.reason = 'compressing two attack cycles into one opening';
      break;
    case 'berserk':
      plan.shotPattern = 'target';
      plan.salvo = 3;
      plan.reason = 'committing a high-tempo burst to one lane';
      break;
    case 'overload':
      plan.shotPattern = 'target';
      plan.salvo = 2;
      plan.reason = 'cascading the first impact into a second shot';
      break;
    case 'multishot':
      plan.shotPattern = 'adjacent';
      plan.salvo = 2;
      plan.reason = 'multiplying fire across the neighboring lane';
      break;
    case 'echo':
      plan.shotPattern = 'adjacent';
      plan.salvo = 2;
      plan.reason = 'replaying the shot as an offset echo';
      break;
    case 'voltage':
      plan.shotPattern = 'adjacent';
      plan.power = 2;
      plan.big = true;
      plan.reason = 'driving a broad charged projectile through alignment';
      break;
    case 'adaptive':
      plan.shotPattern = 'adjacent';
      plan.power = 2;
      plan.reason = 'selecting the most useful current firing geometry';
      break;
    case 'barrage':
      plan.shotPattern = 'target';
      plan.salvo = 3;
      plan.power = 2;
      plan.big = true;
      plan.reason = 'saturating the selected lane with heavy ordnance';
      break;
    case 'mirror':
      plan.shotPattern = 'all';
      plan.big = true;
      plan.reason = 'mirroring one commitment across every lane';
      break;
    case 'surge':
      plan.shotPattern = 'all';
      plan.power = 2;
      plan.big = true;
      plan.reason = 'releasing stored pressure through all lanes';
      break;
    case 'splitter':
      plan.shotPattern = 'all';
      plan.salvo = 2;
      plan.big = true;
      plan.reason = 'splitting one release into a grid-wide pair';
      break;
    case 'ricochet':
      plan.shotPattern = 'all';
      plan.big = true;
      plan.reason = 'turning one angle into three lane trajectories';
      break;
    case 'arcweb':
      plan.shotPattern = 'all';
      plan.big = true;
      plan.fireDisruption = 0.2;
      plan.reason = 'conducting an attack through the full grid';
      break;
    case 'cluster':
      plan.shotPattern = 'all';
      plan.power = 2;
      plan.reason = 'detonating a bounded multi-lane cluster';
      break;
    case 'megabomb':
      plan.shotPattern = 'all';
      plan.power = 2;
      plan.big = true;
      plan.fireDisruption = 0.35;
      plan.reason = 'committing a full-grid shockwave';
      break;
    case 'returnfire':
      plan.shotPattern = 'all';
      plan.big = true;
      plan.reason = 'answering incoming pressure with synchronized return fire';
      break;
    case 'interceptor':
      plan.shotPattern = 'target';
      plan.power = 2;
      plan.big = true;
      plan.reason = 'intercepting live incoming pressure';
      break;
    case 'rearguard':
      plan.shotPattern = 'adjacent';
      plan.power = 2;
      plan.big = true;
      plan.reason = 'covering the opposite angle while maintaining advance';
      break;
    case 'kineticram':
      plan.shotPattern = 'target';
      plan.power = 2;
      plan.big = true;
      plan.moveDisruption = 0.55;
      plan.reason = 'driving mass directly through the chosen lane';
      break;
    case 'circuitarc':
      plan.shotPattern = 'adjacent';
      plan.power = 2;
      plan.big = true;
      plan.fireDisruption = 0.2;
      plan.reason = 'bridging the target lane with a charged arc';
      break;
    case 'thermalshock':
      plan.shotPattern = 'target';
      plan.power = 2;
      plan.big = true;
      plan.fireDisruption = 0.3;
      plan.reason = 'fracturing the target through thermal reversal';
      break;
    case 'shattershot':
      plan.shotPattern = 'target';
      plan.power = 3;
      plan.big = true;
      plan.reason = 'breaking defense with one concentrated projectile';
      break;
    case 'marksman':
      plan.shotPattern = 'target';
      plan.power = 3;
      plan.big = true;
      plan.reason = 'exploiting distance with a precise power shot';
      break;
    case 'crit':
      plan.shotPattern = 'target';
      plan.power = 3;
      plan.big = true;
      plan.reason = 'committing the critical strike at the payoff point';
      break;
    case 'chain':
      plan.shotPattern = 'target';
      plan.power = 3;
      plan.big = true;
      plan.fireDisruption = 0.2;
      plan.reason = 'propagating the initial hit into the next action cycle';
      break;
    case 'seeker':
      plan.shotPattern = 'target';
      plan.power = 2;
      plan.big = true;
      plan.reason = 'acquiring the player regardless of prior lane position';
      break;
    case 'cardflood':
      plan.cardPressure = 1;
      plan.reason = 'forcing an immediate hand replacement';
      break;
    case 'emp':
      plan.shotPattern = 'target';
      plan.power = 3;
      plan.fireDisruption = 0.45;
      plan.cardPressure = 0.5;
      plan.reason = 'damaging the target while disabling its active channel';
      break;
    case 'tanglewire':
      plan.shotPattern = 'target';
      plan.power = 3;
      plan.moveDisruption = 0.6;
      plan.reason = 'binding the occupied lane after impact';
      break;
    case 'purge':
      plan.shotPattern = 'target';
      plan.power = 3;
      plan.big = true;
      plan.reason = 'punishing a weakened or highly evolved target';
      break;
    case 'forcedmolt':
      plan.shotPattern = 'target';
      plan.power = 2;
      plan.moveDisruption = 0.2;
      plan.reason = 'breaking armor and forcing a risky speed tradeoff';
      break;
    case 'depthcharge':
      plan.shotPattern = 'target';
      plan.power = 3;
      plan.big = true;
      plan.reason = 'revealing the route with a high-impact counter';
      break;
    case 'oilslick':
      plan.moveDisruption = 0.5;
      plan.cardPressure = 0.2;
      plan.reason = 'forcing a backward skid and interrupting pursuit';
      break;
    case 'overdrive':
      plan.shotPattern = 'target';
      plan.salvo = 3;
      plan.big = true;
      plan.reason = 'accepting exposure to amplify the next integrity exchange';
      break;
    case 'pierce':
      plan.shotPattern = 'target';
      plan.power = 2;
      plan.big = true;
      plan.reason = 'arming a strike that passes through one defense';
      break;
    case 'separate':
      plan.shotPattern = 'target';
      plan.power = 2;
      plan.cardPressure = 0.45;
      plan.reason = 'separating one fusion layer before the follow-up';
      break;
    case 'devolve':
      plan.shotPattern = 'target';
      plan.power = 2;
      plan.fireDisruption = 0.25;
      plan.reason = 'regressing one evolution layer and weakening its form';
      break;
    case 'flak':
      plan.shotPattern = 'target';
      plan.power = 2;
      plan.moveDisruption = 0.4;
      plan.reason = 'grounding aerial movement with a light impact';
      break;
    case 'acidetch':
      plan.shotPattern = 'target';
      plan.power = 2;
      plan.big = true;
      plan.reason = 'etching through one barrier and exposing armor';
      break;
    case 'hybridtax':
      plan.shotPattern = 'target';
      plan.power = 3;
      plan.moveDisruption = 0.35;
      plan.reason = 'taxing fusion complexity with a bounded penalty';
      break;
    case 'nuke':
      plan.shotPattern = 'all';
      plan.power = 3;
      plan.big = true;
      plan.reason = 'applying the competitive damage ceiling across the grid';
      break;
    case 'bomb':
      plan.shotPattern = 'target';
      plan.power = 3;
      plan.big = true;
      plan.reason = 'detonating the occupied lane';
      break;
    case 'snipe':
      plan.shotPattern = 'target';
      plan.power = 3;
      plan.big = true;
      plan.reason = 'committing one fast precision projectile';
      break;
    case 'catalyst':
      plan.shotPattern = 'target';
      plan.power = 3;
      plan.big = true;
      plan.reason = 'granting a risky benefit before a high-value punish';
      break;
    case 'double':
      plan.shotPattern = 'target';
      plan.power = 2;
      plan.big = true;
      plan.reason = 'doubling the next projectile damage window';
      break;
    case 'radiantmark':
      plan.shotPattern = 'target';
      plan.power = 3;
      plan.big = true;
      plan.reason = 'revealing phase defenses and marking vulnerability';
      break;
    case 'clonebreak':
      plan.shotPattern = 'target';
      plan.power = 3;
      plan.reason = 'damaging the active body and marking related instances';
      break;
    case 'rootsnare':
      plan.shotPattern = 'target';
      plan.moveDisruption = 0.7;
      plan.reason = 'rooting the target in its current lane';
      break;
    default:
      // The exhaustive Boss ownership test prevents canonical cards from
      // reaching this branch through a campaign Boss profile.
      plan.reason = `${abilityId} has no authored versus effect`;
      break;
  }
  return plan;
}

function planChangesBattleState(
  plan: VersusAbilityPlan,
  context: VersusNpcContext,
): boolean {
  return rowsForPattern(plan.shotPattern, plan.targetRow).length > 0
    || (plan.recovery > 0 && context.npcHp < context.maxHp)
    || (plan.shields > 0 && context.npcShields < context.maxShields)
    || plan.fireDisruption > context.playerFireCooldown
    || plan.moveDisruption > context.playerMoveCooldown
    || (plan.cardPressure > 0 && context.cardProgress < 1)
    || (plan.moveToRow !== undefined && plan.moveToRow !== clampLane(context.npcRow));
}

/**
 * Resource and trigger checks are hard eligibility rules. They deliberately
 * run before phase scoring so an opening/desperation preference can never make
 * a boss announce and consume an ability that cannot affect the current duel.
 */
export function isVersusNpcAbilityPractical(
  abilityId: string,
  plan: VersusAbilityPlan,
  context: VersusNpcContext,
): boolean {
  if (!ABILITY_LOOKUP[abilityId] || plan.abilityId !== abilityId) return false;
  if ((abilityId === 'heal' || abilityId === 'regen') && context.npcHp >= context.maxHp) {
    return false;
  }
  if ((abilityId === 'shield' || abilityId === 'armor')
    && context.npcShields >= context.maxShields) {
    return false;
  }
  const totalThreat = context.incomingByRow.reduce((sum, count) => sum + count, 0);
  if (REACTIVE_ABILITY_IDS.has(abilityId) && totalThreat <= 0) return false;
  return planChangesBattleState(plan, context);
}

function scoreBossAbility(
  plan: VersusAbilityPlan,
  context: VersusNpcContext,
  slot: number,
  preferredSlot: number,
): number {
  const hpRatio = context.npcHp / Math.max(1, context.maxHp);
  const playerRatio = context.playerHp / Math.max(1, context.maxHp);
  const currentThreat = context.incomingByRow[clampLane(context.npcRow)] ?? 0;
  const totalThreat = context.incomingByRow.reduce((sum, count) => sum + count, 0);
  const shotWeight = rowsForPattern(plan.shotPattern, plan.targetRow).length
    * Math.max(1, plan.salvo) * Math.max(1, plan.power);
  let score = slot === preferredSlot ? 6 : 0;
  score += (1 - playerRatio) * shotWeight * 0.28;
  score += currentThreat * (plan.shields * 0.9 + (plan.moveToRow !== undefined ? 0.8 : 0));
  score += totalThreat * plan.shields * 0.3;
  score += (1 - hpRatio) * (
    plan.recovery * 0.8
    + plan.leechOnHit * 0.55
    + plan.shields * 0.45
  );
  score += (context.playerFireCooldown < 0.3 ? plan.fireDisruption : 0) * 1.4;
  score += (context.playerMoveCooldown < 0.2 ? plan.moveDisruption : 0) * 1.2;
  score += context.cardProgress * plan.cardPressure;
  if (context.signatureCharges > 0 && slot === 1) score += 0.55;
  if ((context.signatureMode > 0 || context.signaturePlacements.length > 0) && slot === 2) {
    score += 0.4;
  }
  return score + stableNoise(`${context.skillId}:${context.step}:${plan.abilityId}`) * 0.08;
}

export function chooseVersusNpcAbility(context: VersusNpcContext): VersusAbilityPlan {
  const profile = bossStrategyProfile(context.skillId);
  const phase = bossBattlePhase(context);
  const preferredSlot = phase === 'opening' ? 0 : phase === 'pressure' ? 1 : 2;
  let selected: VersusAbilityPlan | undefined;
  let selectedScore = Number.NEGATIVE_INFINITY;
  profile.abilities.forEach((abilityId, slot) => {
    const candidate = resolveVersusNpcAbility(abilityId, context);
    if (!isVersusNpcAbilityPractical(abilityId, candidate, context)) return;
    const score = scoreBossAbility(candidate, context, slot, preferredSlot);
    if (score > selectedScore) {
      selected = candidate;
      selectedScore = score;
    }
  });
  selected ??= ordinaryPressurePlan(context);
  selected.reason = `${phase}: ${selected.reason}; ${profile.strategy}`;
  return selected;
}

export function chooseVersusNpcSignature(context: VersusNpcContext): VersusSignaturePlan {
  const doctrine = doctrineForSkill(context.skillId);
  const specs: readonly [SignatureCommandSpec, SignatureCommandSpec, SignatureCommandSpec] =
    SIGNATURE_COMMANDS[context.skillId ?? ''] ?? [attack(), control(), guard()];
  const eligibleCommands = specs
    .map((candidate, index) => ({ candidate, index }))
    .filter(({ candidate }) => (
      (candidate.requiresCharges ?? 0) <= context.signatureCharges
      && (candidate.requiresPlacements ?? 0) <= context.signaturePlacements.length
    ));
  const commandUses = context.signatureCommandUses ?? [0, 0, 0];
  const leastUseCount = eligibleCommands.length > 0
    ? Math.min(...eligibleCommands.map(({ index }) => commandUses[index] ?? 0))
    : 0;
  const coverageCommands = eligibleCommands.filter(
    ({ index }) => (commandUses[index] ?? 0) === leastUseCount,
  );
  let commandIndex: 0 | 1 | 2 = 0;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (const { candidate, index } of coverageCommands) {
    // A signature is a sequence, not one optimal command spammed repeatedly.
    // When another legal command exists, force the boss to advance its plan.
    if (coverageCommands.length > 1 && index === context.signatureLastCommand) continue;
    const score = scoreIntent(specs[index], context, index);
    if (score > bestScore) {
      bestScore = score;
      commandIndex = index as 0 | 1 | 2;
    }
  }
  const spec = specs[commandIndex];
  const targetRow = clampLane(context.playerRow);
  let moveToRow = spec.moveTo === 'safe'
    ? safestLane(context.incomingByRow, context.step)
    : spec.moveTo === 'target' ? targetRow : undefined;
  if (spec.stage === 'setup' && spec.place) {
    moveToRow = (clampLane(context.npcRow) + 1) % 3;
  }
  let nextMode = context.signatureMode;
  let nextCharges = context.signatureCharges;
  let nextPlacements = [...context.signaturePlacements];
  let nextOriginRow = context.signatureOriginRow;
  let nextOriginCol = context.signatureOriginCol;
  if (spec.stage === 'setup') {
    nextCharges = Math.min(4, nextCharges + (spec.gainCharges ?? 0));
    if (spec.place) {
      const placementRow = moveToRow ?? clampLane(context.npcRow);
      nextPlacements = [...nextPlacements, context.npcCol * 3 + placementRow].slice(-4);
    }
    if (spec.recordOrigin) {
      nextOriginRow = clampLane(context.npcRow);
      nextOriginCol = Math.max(0, Math.min(2, context.npcCol));
    }
  } else if (spec.stage === 'mode') {
    nextMode = (nextMode + 1) % 3;
  } else if (spec.stage === 'execute') {
    if (spec.spendAll) nextCharges = 0;
    if (spec.clearPlacements) nextPlacements = [];
  }
  const storedPower = spec.stage === 'execute'
    ? Math.min(1, Math.floor(context.signatureCharges / 2))
    : 0;
  return {
    abilityId: context.skillId ?? 'adaptive',
    doctrine,
    commandIndex,
    intent: spec.intent,
    targetRow,
    shotPattern: spec.shotPattern ?? 'none',
    salvo: 1,
    power: Math.min(3, (spec.power ?? 1) + storedPower),
    big: spec.big ?? false,
    leechOnHit: 0,
    recovery: Math.min(3, (spec.recovery ?? 0) + storedPower),
    shields: Math.min(2, (spec.shields ?? 0) + (storedPower > 0 ? 1 : 0)),
    fireDisruption: spec.fireDisruption ?? 0,
    moveDisruption: spec.moveDisruption ?? 0,
    cardPressure: spec.cardPressure ?? 0,
    columnDelta: spec.columnDelta ?? 0,
    moveToRow,
    nextMode,
    nextCharges,
    nextPlacements,
    nextOriginRow,
    nextOriginCol,
    reason: `${doctrine} ${spec.intent}`,
  };
}

export function chooseVersusMovementRow(
  context: VersusNpcContext,
  variation = 0,
): number {
  const profile = bossStrategyProfile(context.skillId);
  const currentRow = clampLane(context.npcRow);
  const currentThreat = context.incomingByRow[currentRow] ?? 0;
  if (currentThreat > 0) {
    const safeRow = safestLane(context.incomingByRow, context.step);
    // Reactive movement obeys the same one-tile rule as the player. Equal
    // pressure is not a reason to jitter, and edge bosses cannot teleport
    // through the middle lane to escape a committed shot.
    return context.incomingByRow[safeRow] < currentThreat
      ? clampLane(currentRow + Math.sign(safeRow - currentRow))
      : currentRow;
  }
  if (profile.movement === 'pursue') return clampLane(context.playerRow);
  if (profile.movement === 'flank') {
    return clampLane(context.playerRow + (context.step % 2 === 0 ? 1 : -1));
  }
  if (profile.movement === 'anchor') {
    return currentRow;
  }
  if (profile.movement === 'evade') {
    const farthest = context.playerRow === 0 ? 2 : context.playerRow === 2 ? 0 : currentRow;
    return clampLane(farthest);
  }
  if (profile.movement === 'cycle') {
    return clampLane(currentRow + (variation < 0.5 ? 1 : -1));
  }
  return variation < 0.55
    ? clampLane(context.playerRow)
    : safestLane(context.incomingByRow, context.step);
}

export interface VersusBasicAttackAim {
  /** The live player lane this shot is trying to acquire. */
  targetRow: number;
  /** The next readable NPC lane; at most one cell from its current lane. */
  nextRow: number;
  /** A basic projectile may be emitted only when this is true. */
  aligned: boolean;
}

/**
 * Gives ordinary NPC fire a visible aim step. Abilities retain their authored
 * multi-lane patterns, while a basic shot waits until its body and muzzle share
 * the player's live lane instead of materializing remotely in another row.
 */
export function chooseVersusBasicAttackAim(
  context: Pick<VersusNpcContext, 'npcRow' | 'playerRow'>,
): VersusBasicAttackAim {
  const currentRow = clampLane(context.npcRow);
  const targetRow = clampLane(context.playerRow);
  return {
    targetRow,
    nextRow: clampLane(currentRow + Math.sign(targetRow - currentRow)),
    aligned: currentRow === targetRow,
  };
}

/**
 * Selects the NPC's column within its own 3-column half of the board.
 *
 * Column movement is deterministic and tactical: the movement profile, live
 * lane pressure, health state, and authored strategy step decide the result.
 * This deliberately avoids cosmetic random jitter and moves at most one cell
 * per decision so an opponent remains readable while traversing the grid.
 */
export function chooseVersusMovementColumn(context: VersusNpcContext): number {
  const profile = bossStrategyProfile(context.skillId);
  const currentCol = clampLane(context.npcCol);
  const currentRow = clampLane(context.npcRow);
  const underPressure = (context.incomingByRow[currentRow] ?? 0) > 0;
  const lowIntegrity = context.npcHp <= context.maxHp * 0.35;
  const stepToward = (target: number): number => {
    const boundedTarget = clampLane(target);
    return clampLane(currentCol + Math.sign(boundedTarget - currentCol));
  };

  if (profile.movement === 'pursue') {
    // Assault bosses occupy the forward column while healthy, but can yield
    // when low health and under fire. A measured regroup keeps either state
    // from becoming one permanent depth column under continuous autofire.
    return lowIntegrity && underPressure
      ? stepToward(context.step % 4 === 2 ? 1 : 2)
      : stepToward(context.step % 4 === 3 ? 1 : 0);
  }
  if (profile.movement === 'flank') {
    // Hold each authored side for two beats so the boss can actually reach
    // both edges, returning through center instead of teleporting across.
    const target = Math.floor(context.step / 2) % 2 === 0 ? 0 : 2;
    return currentCol === target ? 1 : stepToward(target);
  }
  if (profile.movement === 'anchor') {
    // Hold center by default and concede depth under fire. While pressure is
    // continuous, periodically re-center to brace the firing line; otherwise
    // an anchor would retreat once and remain a stationary rear-column target.
    return stepToward(underPressure
      ? (context.step % 4 === 2 ? 1 : 2)
      : (context.step % 4 === 3 ? 2 : 1));
  }
  if (profile.movement === 'evade') {
    // Evasive bosses retreat under pressure or while behind, then recover
    // toward center. Continuous pressure includes an authored center feint so
    // the boss changes the next intercept angle instead of camping at depth.
    const retreating = underPressure
      || context.npcHp < context.playerHp
      || context.step % 4 === 1;
    return stepToward(retreating
      ? (currentCol === 2 && context.step % 3 === 0 ? 1 : 2)
      : 1);
  }
  if (profile.movement === 'cycle') {
    // Traverse the complete depth circuit instead of oscillating forever
    // between center and the rear edge: center -> rear -> center -> front.
    const target = [2, 1, 0, 1][context.step % 4] ?? 1;
    return stepToward(target);
  }
  return stepToward(1);
}

export interface VersusMovementPosition {
  row: number;
  col: number;
}

/** Resolves both axes from the same immutable tactical snapshot. */
export function chooseVersusMovementPosition(
  context: VersusNpcContext,
  rowVariation = 0,
): VersusMovementPosition {
  return {
    row: chooseVersusMovementRow(context, rowVariation),
    col: chooseVersusMovementColumn(context),
  };
}

export interface CampaignNpcContext {
  seed: number;
  decisionIndex: number;
  niche: string;
  enemyClass: string;
  hasAbility: boolean;
  abilityFunction: string;
  delivery: string;
  row: number;
  colPos: number;
  hp: number;
  maxHp: number;
  playerRow: number;
  playerCol: number;
  laneThreat: readonly [number, number, number];
  alliesByRow: readonly [number, number, number];
  injuredAlliesByRow: readonly [number, number, number];
  nearbyInjuredAllies: number;
  canReposition: boolean;
  abilityReady: boolean;
}

export interface CampaignNpcPlan {
  doctrine: NpcDoctrine;
  shouldCast: boolean;
  targetRow: number;
  speedMultiplier: number;
  retryDelay: number;
  cooldownScale: number;
  reason: string;
}

function campaignDoctrine(context: CampaignNpcContext): NpcDoctrine {
  if (context.hasAbility) {
    if (context.abilityFunction === 'restore') return 'support';
    if (context.abilityFunction === 'ward') return 'guardian';
    if (context.abilityFunction === 'inhibit') return 'control';
    if (context.abilityFunction === 'adapt' || context.abilityFunction === 'reveal') return 'skirmish';
    if (context.abilityFunction === 'rupture' || context.abilityFunction === 'impulse') return 'assault';
  }
  if (context.niche === 'regenerator' || context.enemyClass === 'mender'
    || context.enemyClass === 'support') return 'support';
  if (context.enemyClass === 'guardian' || context.niche === 'bulwark') return 'guardian';
  if (context.niche === 'scout' || context.niche === 'phase'
    || context.niche === 'opportunist') return 'skirmish';
  if (context.niche === 'hunter' || context.enemyClass === 'predator') return 'assault';
  if (context.niche === 'swarm' || context.niche === 'symbiote') return 'adaptive';
  return 'adaptive';
}

function laneWithMost(values: readonly [number, number, number], seed: number): number {
  const maximum = Math.max(...values);
  const candidates = [0, 1, 2].filter((row) => values[row] === maximum);
  return candidates[Math.abs(seed) % candidates.length] ?? 1;
}

function laneWithLeast(values: readonly [number, number, number], seed: number): number {
  const minimum = Math.min(...values);
  const candidates = [0, 1, 2].filter((row) => values[row] === minimum);
  return candidates[Math.abs(seed) % candidates.length] ?? 1;
}

export function planCampaignNpc(context: CampaignNpcContext): CampaignNpcPlan {
  const doctrine = campaignDoctrine(context);
  const row = clampLane(context.row);
  const safeRow = safestLane(context.laneThreat, context.seed);
  const injuredRow = laneWithMost(context.injuredAlliesByRow, context.seed);
  const hpRatio = context.hp / Math.max(1, context.maxHp);
  const aligned = row === clampLane(context.playerRow);
  const nearPlayer = context.colPos <= context.playerCol + 3.2;
  let targetRow = row;
  let shouldCast = false;
  let speedMultiplier = 1;
  let reason = 'holding formation';

  if (doctrine === 'support') {
    const injured = context.injuredAlliesByRow.reduce((sum, value) => sum + value, 0);
    targetRow = context.canReposition && injured > 0 ? injuredRow : row;
    shouldCast = context.abilityReady
      && (context.nearbyInjuredAllies > 0 || hpRatio < 0.72);
    speedMultiplier = context.alliesByRow[row] > 1 ? 0.78 : 0.9;
    reason = shouldCast ? 'restoring a damaged formation' : 'remaining behind the pressure line';
  } else if (doctrine === 'guardian') {
    shouldCast = context.abilityReady
      && (hpRatio < 0.78 || context.laneThreat[row] > 0 || nearPlayer);
    speedMultiplier = 0.88;
    reason = shouldCast ? 'fortifying before contact' : 'anchoring the lane';
  } else if (doctrine === 'control') {
    targetRow = context.canReposition && !aligned ? clampLane(context.playerRow) : row;
    shouldCast = context.abilityReady
      && (context.delivery === 'field' || context.delivery === 'aperture' || aligned)
      && context.colPos < 5.15;
    speedMultiplier = aligned ? 0.92 : 1.02;
    reason = shouldCast ? 'denying the player lane' : 'seeking an effective control angle';
  } else if (doctrine === 'skirmish') {
    const playerRow = clampLane(context.playerRow);
    targetRow = context.canReposition
      ? context.laneThreat[row] > context.laneThreat[safeRow]
        ? safeRow
        : context.laneThreat[playerRow] === 0 ? playerRow : row
      : row;
    shouldCast = context.abilityReady
      && (targetRow !== row || aligned || context.delivery === 'field');
    speedMultiplier = context.laneThreat[row] > 0 ? 0.94 : 1.08;
    reason = shouldCast ? 'changing lanes around incoming fire' : 'probing for a flank';
  } else if (doctrine === 'assault') {
    targetRow = context.canReposition ? clampLane(context.playerRow) : row;
    shouldCast = context.abilityReady && aligned && nearPlayer;
    speedMultiplier = aligned ? 1.1 : 0.96;
    reason = shouldCast ? 'committing power at contact range' : 'closing on the player lane';
  } else if (context.niche === 'symbiote') {
    targetRow = context.canReposition
      ? laneWithMost(context.alliesByRow, context.seed)
      : row;
    shouldCast = context.abilityReady && context.alliesByRow[targetRow] > 1;
    speedMultiplier = context.alliesByRow[row] > 1 ? 0.86 : 1.04;
    reason = shouldCast ? 'supporting a viable convergence' : 'seeking a compatible formation';
  } else if (context.niche === 'swarm') {
    const sparseRow = laneWithLeast(context.alliesByRow, context.seed);
    targetRow = context.canReposition && context.alliesByRow[row] > 1 ? sparseRow : row;
    shouldCast = context.abilityReady && context.alliesByRow[row] >= 2;
    speedMultiplier = context.alliesByRow[row] >= 2 ? 1.08 : 0.98;
    reason = shouldCast ? 'converting local density into swarm pressure' : 'distributing the formation';
  } else {
    targetRow = context.canReposition && context.laneThreat[row] > 1 ? safeRow : row;
    shouldCast = context.abilityReady
      && (aligned || context.delivery === 'field' || hpRatio < 0.65);
    speedMultiplier = context.laneThreat[row] > 1 ? 0.9 : 1;
    reason = shouldCast ? 'adapting to the current board state' : 'maintaining formation';
  }

  return {
    doctrine,
    shouldCast,
    targetRow,
    speedMultiplier,
    retryDelay: 0.45 + stableNoise(`${context.seed}:${context.decisionIndex}`) * 0.35,
    cooldownScale: doctrine === 'support' ? 1.08
      : doctrine === 'assault' ? 0.92 : 1,
    reason,
  };
}

export function shotRowsForPlan(plan: Pick<VersusAbilityPlan, 'shotPattern' | 'targetRow'>): number[] {
  return rowsForPattern(plan.shotPattern, plan.targetRow);
}
