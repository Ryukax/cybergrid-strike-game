import { ABILITY_LOOKUP } from './constants';
import {
  shotRowsForPlan,
  type NpcDoctrine,
  type NpcIntent,
  type VersusAbilityPlan,
  type VersusSignaturePlan,
} from './npc-strategy';

export type SkillExecutionMotif =
  | 'time' | 'gravity' | 'command' | 'construct' | 'morph' | 'reflect'
  | 'dash' | 'restore' | 'portal' | 'vector' | 'grid' | 'resonance'
  | 'exchange' | 'lock' | 'weapon' | 'harvest' | 'suppress' | 'polarity'
  | 'colossus' | 'target' | 'orbital' | 'sovereign';

export type NpcSkillPresentationAction = 'primary' | 'alternate' | 'defend';
export type NpcSkillPresentationSource = 'ability' | 'signature';
export type NpcSkillPresentationAnchor = 'self' | 'player' | 'lane' | 'all-lanes';

export const NPC_SKILL_PRESENTATION_DURATION_MS = 1_050;

export const BOSS_SIGNATURE_COMMANDS = {
  chrono: ['QUEUE', 'STEP', 'REWIND'],
  singularity: ['COLLAPSE', 'POLARITY', 'GUARD'],
  override: ['NATIVE', 'TRANSFER', 'SACRIFICE'],
  architect: ['CANNON', 'RELAY', 'BARRIER'],
  apex: ['TECHNIQUE', 'FORM', 'ADAPT'],
  counter: ['RETURN', 'REDIRECT', 'CONVERT'],
  phase: ['STRIKE', 'TARGET', 'BREAK'],
  phoenix: ['VENT', 'ANCHOR', 'RESTORE'],
  rift: ['TRAVERSE', 'PORTAL', 'REFLECT'],
  vector: ['REDIRECT', 'ACCELERATE', 'ARREST'],
  gridshift: ['SHIFT', 'OPERATION', 'REVERSE'],
  resonance: ['MARK', 'MOVE MARK', 'ACTIVATE'],
  exchange: ['PROPERTY', 'EXCHANGE', 'REVERSE'],
  causality: ['LOCK', 'EVENT', 'REPEAT'],
  arsenal: ['STRIKE', 'GUARD', 'DRIVE'],
  assimilation: ['HARVEST', 'ASSEMBLE', 'DEPLOY'],
  null: ['SUPPRESS', 'FOCUS', 'ANCHOR'],
  polarity: ['MARK', 'REVERSE', 'COLLIDE'],
  colossus: ['SIEGE', 'TRAMPLE', 'BULWARK'],
  predator: ['HUNT', 'TARGET', 'COUNTER'],
  orbital: ['DESIGNATE', 'ORDNANCE', 'DROP'],
  hijack: ['ORDER', 'COMMAND', 'BREAK'],
  sovereign: ['ASSERT', 'GAMBIT', 'ENDURE'],
  tempest: ['CHARGE', 'CHAIN', 'GROUND'],
  cryo: ['FREEZE', 'SHATTER', 'PRESERVE'],
  terra: ['RAISE', 'FAULT', 'HARDEN'],
  echo: ['TRACE', 'REPLAY', 'DISPLACE'],
  mirage: ['DECOY', 'VEIL', 'AMBUSH'],
  beacon: ['SIGNAL', 'ASSIST', 'SYNCHRONIZE'],
  swarm: ['SEED', 'VOTE', 'OVERRUN'],
  bloom: ['GRAFT', 'CULTIVATE', 'RECLAIM'],
  tidal: ['PRESSURE', 'CURRENT', 'BREAKWATER'],
} as const;

export type BossSkillId = keyof typeof BOSS_SIGNATURE_COMMANDS;

// Keep the public tuple values widened to `string`.  Canvas helper defaults are
// inferred from these values, and retaining every color as a literal union
// makes a helper initialized with the primary color reject an accent color.
export const BOSS_SKILL_COLORS: Readonly<Record<
  BossSkillId,
  readonly [string, string]
>> = {
  chrono: ['#93c5fd', '#e9d5ff'], singularity: ['#a78bfa', '#111827'],
  override: ['#c084fc', '#22d3ee'], architect: ['#60a5fa', '#f8fafc'],
  apex: ['#84cc16', '#f0abfc'], counter: ['#f0abfc', '#f8fafc'],
  phase: ['#818cf8', '#e9d5ff'], phoenix: ['#fb923c', '#fde047'],
  rift: ['#22d3ee', '#8b5cf6'], vector: ['#5eead4', '#f8fafc'],
  gridshift: ['#38bdf8', '#a7f3d0'], resonance: ['#f0abfc', '#67e8f9'],
  exchange: ['#4ade80', '#f472b6'], causality: ['#c4b5fd', '#f8fafc'],
  arsenal: ['#f59e0b', '#f8fafc'], assimilation: ['#34d399', '#fb923c'],
  null: ['#6366f1', '#030712'], polarity: ['#38bdf8', '#fb7185'],
  colossus: ['#fbbf24', '#94a3b8'], predator: ['#fb7185', '#f8fafc'],
  orbital: ['#fde047', '#60a5fa'], hijack: ['#c084fc', '#2dd4bf'],
  sovereign: ['#f43f5e', '#fde047'], tempest: ['#38bdf8', '#f8fafc'],
  cryo: ['#67e8f9', '#dbeafe'], terra: ['#f59e0b', '#57534e'],
  echo: ['#818cf8', '#22d3ee'], mirage: ['#c084fc', '#22d3ee'],
  beacon: ['#22d3ee', '#f8fafc'], swarm: ['#38bdf8', '#94a3b8'],
  bloom: ['#f472b6', '#4ade80'], tidal: ['#06b6d4', '#dbeafe'],
};

export const BOSS_SIGNATURE_MOTIFS = {
  chrono: ['time', 'portal', 'restore'],
  singularity: ['gravity', 'polarity', 'reflect'],
  override: ['command', 'portal', 'harvest'],
  architect: ['construct', 'portal', 'reflect'],
  apex: ['morph', 'morph', 'morph'],
  counter: ['reflect', 'vector', 'restore'],
  phase: ['dash', 'target', 'restore'],
  phoenix: ['weapon', 'construct', 'restore'],
  rift: ['portal', 'construct', 'reflect'],
  vector: ['vector', 'vector', 'lock'],
  gridshift: ['grid', 'grid', 'grid'],
  resonance: ['resonance', 'resonance', 'resonance'],
  exchange: ['target', 'exchange', 'exchange'],
  causality: ['lock', 'target', 'time'],
  arsenal: ['weapon', 'reflect', 'dash'],
  assimilation: ['harvest', 'morph', 'weapon'],
  null: ['suppress', 'target', 'construct'],
  polarity: ['polarity', 'polarity', 'gravity'],
  colossus: ['weapon', 'dash', 'colossus'],
  predator: ['dash', 'target', 'reflect'],
  orbital: ['target', 'morph', 'orbital'],
  hijack: ['command', 'target', 'suppress'],
  sovereign: ['sovereign', 'exchange', 'restore'],
  tempest: ['dash', 'resonance', 'reflect'],
  cryo: ['suppress', 'weapon', 'restore'],
  terra: ['construct', 'grid', 'reflect'],
  echo: ['lock', 'time', 'portal'],
  mirage: ['construct', 'suppress', 'dash'],
  beacon: ['target', 'resonance', 'restore'],
  swarm: ['harvest', 'command', 'morph'],
  bloom: ['construct', 'restore', 'harvest'],
  tidal: ['weapon', 'vector', 'reflect'],
} as const satisfies Record<BossSkillId, readonly [SkillExecutionMotif, SkillExecutionMotif, SkillExecutionMotif]>;

export const SKILL_VFX_SEQUENCE: Record<SkillExecutionMotif, { sheet: 'a' | 'b' | 'c'; row: number }> = {
  time: { sheet: 'a', row: 0 }, gravity: { sheet: 'a', row: 1 },
  command: { sheet: 'c', row: 1 }, construct: { sheet: 'c', row: 3 },
  grid: { sheet: 'a', row: 3 }, resonance: { sheet: 'a', row: 3 },
  orbital: { sheet: 'a', row: 3 }, morph: { sheet: 'c', row: 3 },
  harvest: { sheet: 'b', row: 0 }, suppress: { sheet: 'b', row: 0 },
  colossus: { sheet: 'c', row: 3 }, sovereign: { sheet: 'c', row: 3 },
  reflect: { sheet: 'c', row: 2 }, lock: { sheet: 'c', row: 1 },
  polarity: { sheet: 'b', row: 1 }, dash: { sheet: 'b', row: 2 },
  weapon: { sheet: 'c', row: 0 }, portal: { sheet: 'b', row: 2 },
  target: { sheet: 'b', row: 2 }, vector: { sheet: 'b', row: 2 },
  exchange: { sheet: 'c', row: 1 }, restore: { sheet: 'c', row: 2 },
};

export const BOSS_ABILITY_MOTIFS: Readonly<Record<string, SkillExecutionMotif>> = {
  acidetch: 'morph', adaptive: 'morph', anchorfield: 'lock', arcweb: 'resonance',
  armor: 'reflect', backdash: 'dash', barrage: 'weapon', berserk: 'sovereign',
  blizzard: 'suppress', bloombind: 'construct', bomb: 'weapon', cardflood: 'command',
  catalyst: 'exchange', chain: 'resonance', circuitarc: 'resonance', clonebreak: 'suppress',
  cluster: 'orbital', crit: 'target', depthcharge: 'orbital', devolve: 'morph',
  double: 'resonance', drain: 'harvest', echo: 'time', elementswap: 'exchange',
  emp: 'suppress', flak: 'weapon', forcedmolt: 'morph', freeze: 'suppress',
  ghost: 'portal', gravity: 'gravity', groundwire: 'grid', heal: 'restore',
  hybridtax: 'exchange', interceptor: 'target', kineticram: 'dash', magnet: 'polarity',
  marksman: 'target', megabomb: 'orbital', mirror: 'reflect', multishot: 'weapon',
  mutationlock: 'lock', nuke: 'orbital', oilslick: 'grid', overclock: 'dash',
  overdrive: 'dash', overload: 'weapon', pierce: 'vector', pulse: 'resonance',
  purge: 'suppress', quarantine: 'suppress', radiantmark: 'target', rearguard: 'reflect',
  regen: 'restore', returnfire: 'reflect', ricochet: 'vector', rootsnare: 'construct',
  rowshuffle: 'grid', scramble: 'command', seeker: 'target', separate: 'exchange',
  shattershot: 'weapon', shield: 'reflect', shotgun: 'weapon', signaljam: 'suppress',
  snipe: 'target', sonicnet: 'lock', splitter: 'morph', stasisgate: 'portal',
  surge: 'dash', tailclamp: 'lock', tanglewire: 'construct', thermalshock: 'weapon',
  time: 'time', trafficjam: 'grid', traittheft: 'harvest', turret: 'construct',
  undertow: 'vector', voidaperture: 'portal', voltage: 'polarity', warpback: 'portal',
};

export interface NpcSkillPresentation {
  revision: number;
  presentationKey: string;
  source: NpcSkillPresentationSource;
  bossSkillId: BossSkillId;
  abilityId: string;
  commandIndex: 0 | 1 | 2 | null;
  doctrine: NpcDoctrine;
  intent: NpcIntent;
  action: NpcSkillPresentationAction;
  motif: SkillExecutionMotif;
  anchor: NpcSkillPresentationAnchor;
  readonly targetRows: readonly number[];
  label: string;
  durationMs: number;
}

function abilityIntent(plan: VersusAbilityPlan): NpcIntent {
  if (plan.shotPattern !== 'none') return 'attack';
  if (plan.recovery > 0) return 'sustain';
  if (plan.shields > 0) return 'guard';
  if (plan.moveToRow !== undefined) return 'maneuver';
  if (plan.fireDisruption > 0 || plan.moveDisruption > 0 || plan.cardPressure > 0) return 'control';
  return 'setup';
}

function actionForIntent(intent: NpcIntent): NpcSkillPresentationAction {
  if (intent === 'guard' || intent === 'sustain' || intent === 'setup' || intent === 'mode') return 'defend';
  if (intent === 'control' || intent === 'maneuver') return 'alternate';
  return 'primary';
}

function fallbackMotif(plan: VersusAbilityPlan): SkillExecutionMotif {
  if (plan.leechOnHit > 0) return 'harvest';
  if (plan.recovery > 0) return 'restore';
  if (plan.shields > 0) return 'reflect';
  if (plan.cardPressure > 0 || plan.fireDisruption > 0 || plan.moveDisruption > 0) return 'suppress';
  if (plan.moveToRow !== undefined) return 'dash';
  if (plan.shotPattern === 'all') return 'orbital';
  if (plan.shotPattern === 'adjacent') return 'resonance';
  return 'target';
}

function presentationAnchor(
  intent: NpcIntent,
  targetRows: readonly number[],
): NpcSkillPresentationAnchor {
  if (targetRows.length > 1) return 'all-lanes';
  if (targetRows.length === 1) return 'lane';
  if (intent === 'guard' || intent === 'sustain' || intent === 'setup' || intent === 'mode') return 'self';
  if (intent === 'control') return 'player';
  return 'self';
}

export function resolveNpcAbilityPresentation(
  plan: VersusAbilityPlan,
  bossSkillId: BossSkillId,
  revision: number,
): NpcSkillPresentation {
  const intent = abilityIntent(plan);
  const targetRows = shotRowsForPlan(plan);
  const abilityName = ABILITY_LOOKUP[plan.abilityId]?.name
    ?? plan.abilityId.replace(/([a-z])([A-Z])/g, '$1 $2').toUpperCase();
  return {
    revision,
    presentationKey: `ability:${bossSkillId}:${plan.abilityId}:${revision}`,
    source: 'ability',
    bossSkillId,
    abilityId: plan.abilityId,
    commandIndex: null,
    doctrine: plan.doctrine,
    intent,
    action: actionForIntent(intent),
    motif: BOSS_ABILITY_MOTIFS[plan.abilityId] ?? fallbackMotif(plan),
    anchor: presentationAnchor(intent, targetRows),
    targetRows,
    label: abilityName,
    durationMs: NPC_SKILL_PRESENTATION_DURATION_MS,
  };
}

export function resolveNpcSignaturePresentation(
  plan: VersusSignaturePlan,
  bossSkillId: BossSkillId,
  revision: number,
): NpcSkillPresentation {
  const commandIndex = plan.commandIndex;
  const targetRows = shotRowsForPlan(plan);
  return {
    revision,
    presentationKey: `signature:${bossSkillId}:${commandIndex}:${revision}`,
    source: 'signature',
    bossSkillId,
    abilityId: bossSkillId,
    commandIndex,
    doctrine: plan.doctrine,
    intent: plan.intent,
    action: (['primary', 'alternate', 'defend'] as const)[commandIndex],
    motif: BOSS_SIGNATURE_MOTIFS[bossSkillId][commandIndex],
    anchor: presentationAnchor(plan.intent, targetRows),
    targetRows,
    label: BOSS_SIGNATURE_COMMANDS[bossSkillId][commandIndex],
    durationMs: NPC_SKILL_PRESENTATION_DURATION_MS,
  };
}
