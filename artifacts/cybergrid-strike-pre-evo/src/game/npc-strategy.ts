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
}

export interface VersusAbilityPlan {
  abilityId: string;
  doctrine: NpcDoctrine;
  targetRow: number;
  shotPattern: ShotPattern;
  power: number;
  big: boolean;
  recovery: number;
  shields: number;
  fireDisruption: number;
  moveDisruption: number;
  cardPressure: number;
  moveToRow?: number;
  reason: string;
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

const DOCTRINE_BY_SKILL: Record<string, NpcDoctrine> = {
  override: 'assault', apex: 'assault', phase: 'assault', phoenix: 'assault',
  arsenal: 'assault', assimilation: 'assault', predator: 'assault', orbital: 'assault',
  tempest: 'assault', swarm: 'assault',
  chrono: 'control', singularity: 'control', vector: 'control', gridshift: 'control',
  resonance: 'control', exchange: 'control', causality: 'control', null: 'control',
  polarity: 'control', hijack: 'control', echo: 'control',
  counter: 'guardian', architect: 'guardian', colossus: 'guardian', sovereign: 'guardian',
  cryo: 'guardian', terra: 'guardian',
  rift: 'skirmish', mirage: 'skirmish', tidal: 'skirmish',
  beacon: 'support', bloom: 'support',
};

const ABILITY_LOADOUTS: Record<NpcDoctrine, readonly [string, string, string]> = {
  assault: ['shotgun', 'overclock', 'seeker'],
  control: ['scramble', 'freeze', 'signaljam'],
  guardian: ['shield', 'heal', 'armor'],
  skirmish: ['backdash', 'rowshuffle', 'interceptor'],
  support: ['heal', 'shield', 'pulse'],
  adaptive: ['adaptive', 'seeker', 'scramble'],
};

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
  return (skillId && DOCTRINE_BY_SKILL[skillId]) || 'adaptive';
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

export function chooseVersusNpcAbility(context: VersusNpcContext): VersusAbilityPlan {
  const doctrine = doctrineForSkill(context.skillId);
  const currentThreat = context.incomingByRow[clampLane(context.npcRow)] ?? 0;
  const totalThreat = context.incomingByRow.reduce((sum, value) => sum + value, 0);
  const hpRatio = context.npcHp / Math.max(1, context.maxHp);
  const behind = context.npcHp + context.maxHp * 0.08 < context.playerHp;
  const loadout = ABILITY_LOADOUTS[doctrine];
  let abilityId = loadout[0];

  if ((hpRatio < 0.45 || behind) && loadout.includes('heal')) abilityId = 'heal';
  else if (currentThreat >= 1 && context.npcShields < context.maxShields
    && (loadout.includes('shield') || loadout.includes('armor'))) {
    abilityId = loadout.includes('armor') && totalThreat >= 3 ? 'armor' : 'shield';
  } else if (doctrine === 'guardian') {
    abilityId = 'interceptor';
  } else if (doctrine === 'control') {
    abilityId = context.cardProgress > 0.65 ? 'signaljam'
      : context.playerFireCooldown < 0.35 ? 'freeze' : 'scramble';
  } else if (doctrine === 'skirmish') {
    abilityId = currentThreat > 0 ? 'backdash'
      : context.npcRow !== context.playerRow ? 'interceptor' : 'rowshuffle';
  } else if (doctrine === 'adaptive') {
    abilityId = totalThreat >= 2 ? 'scramble'
      : context.npcRow === context.playerRow ? 'seeker' : 'adaptive';
  } else if (doctrine === 'assault') {
    abilityId = context.playerHp <= context.maxHp * 0.3 ? 'seeker'
      : totalThreat === 0 ? 'overclock' : 'shotgun';
  } else if (doctrine === 'support') {
    abilityId = context.npcShields < context.maxShields ? 'shield' : 'pulse';
  }

  const targetRow = clampLane(context.playerRow);
  const plan: VersusAbilityPlan = {
    abilityId,
    doctrine,
    targetRow,
    shotPattern: 'none',
    power: 1,
    big: false,
    recovery: 0,
    shields: 0,
    fireDisruption: 0,
    moveDisruption: 0,
    cardPressure: 0,
    reason: 'tempo',
  };
  if (doctrine === 'skirmish' && currentThreat > 0) {
    plan.moveToRow = safestLane(context.incomingByRow, context.step);
  }

  if (abilityId === 'heal') {
    plan.recovery = 4;
    plan.reason = 'recovering a health deficit';
  } else if (abilityId === 'shield' || abilityId === 'armor') {
    plan.shields = abilityId === 'armor' ? 2 : 1;
    plan.reason = 'answering incoming lane pressure';
  } else if (abilityId === 'freeze' || abilityId === 'signaljam') {
    plan.fireDisruption = abilityId === 'freeze' ? 0.95 : 0.72;
    plan.moveDisruption = abilityId === 'freeze' ? 0.55 : 0.35;
    plan.cardPressure = abilityId === 'signaljam' ? 0.9 : 0.35;
    plan.reason = 'denying the player action window';
  } else if (abilityId === 'scramble' || abilityId === 'rowshuffle' || abilityId === 'backdash') {
    plan.moveDisruption = 0.42;
    plan.fireDisruption = 0.45;
    plan.reason = 'breaking lane alignment';
  } else if (abilityId === 'overclock') {
    plan.shotPattern = 'adjacent';
    plan.power = 1;
    plan.big = false;
    plan.reason = 'converting a safe lane into pressure';
  } else if (abilityId === 'shotgun') {
    plan.shotPattern = 'adjacent';
    plan.power = 2;
    plan.big = true;
    plan.reason = 'pressuring a pair of adjacent lanes';
  } else if (abilityId === 'pulse') {
    plan.fireDisruption = 0.45;
    plan.moveDisruption = 0.25;
    plan.reason = 'interrupting the player while resources are stable';
  } else {
    plan.shotPattern = abilityId === 'adaptive' ? 'adjacent' : 'target';
    plan.power = abilityId === 'seeker' || abilityId === 'interceptor' ? 2 : 1;
    plan.big = true;
    plan.reason = 'exploiting an exposed lane';
  }
  return plan;
}

export function chooseVersusNpcSignature(context: VersusNpcContext): VersusSignaturePlan {
  const doctrine = doctrineForSkill(context.skillId);
  const specs: readonly [SignatureCommandSpec, SignatureCommandSpec, SignatureCommandSpec] =
    SIGNATURE_COMMANDS[context.skillId ?? ''] ?? [attack(), control(), guard()];
  let commandIndex: 0 | 1 | 2 = 0;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (let index = 0; index < specs.length; index++) {
    const candidate = specs[index];
    if ((candidate.requiresCharges ?? 0) > context.signatureCharges) continue;
    if ((candidate.requiresPlacements ?? 0) > context.signaturePlacements.length) continue;
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
    power: Math.min(3, (spec.power ?? 1) + storedPower),
    big: spec.big ?? false,
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
  const doctrine = doctrineForSkill(context.skillId);
  const currentRow = clampLane(context.npcRow);
  const currentThreat = context.incomingByRow[currentRow] ?? 0;
  if (currentThreat > 0) return safestLane(context.incomingByRow, context.step);
  if (doctrine === 'assault') return clampLane(context.playerRow);
  if (doctrine === 'control') {
    return clampLane(context.playerRow + (context.step % 2 === 0 ? 1 : -1));
  }
  if (doctrine === 'guardian' || doctrine === 'support') {
    return safestLane(context.incomingByRow, context.step);
  }
  if (doctrine === 'skirmish') {
    return clampLane(currentRow + (variation < 0.5 ? 1 : -1));
  }
  return variation < 0.55
    ? clampLane(context.playerRow)
    : safestLane(context.incomingByRow, context.step);
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
