/**
 * Pure presentation contract for the Lord Alpha skin.
 *
 * Asset values are suffixes intended to be appended to Vite's BASE_URL. This
 * module intentionally has no DOM, canvas, React, or game-state dependencies.
 */

export const LORD_ALPHA_SKIN_ID = "lord-alpha" as const;
export type LordAlphaSkinId = typeof LORD_ALPHA_SKIN_ID;

export const LORD_ALPHA_FORM_IDS = ["relaxed", "afro", "supreme"] as const;
export type LordAlphaForm = (typeof LORD_ALPHA_FORM_IDS)[number];
export type LordAlphaFormId = LordAlphaForm;

export interface LordAlphaFormAssetManifest {
  readonly id: LordAlphaForm;
  readonly label: string;
  readonly idleSuffix: `skins/lord-alpha/${LordAlphaForm}-idle.png`;
  readonly attackSuffix: `skins/lord-alpha/${LordAlphaForm}-attack.png`;
}

export const LORD_ALPHA_FORMS = {
  relaxed: {
    id: "relaxed",
    label: "Relaxed Hair",
    idleSuffix: "skins/lord-alpha/relaxed-idle.png",
    attackSuffix: "skins/lord-alpha/relaxed-attack.png",
  },
  afro: {
    id: "afro",
    label: "Afro",
    idleSuffix: "skins/lord-alpha/afro-idle.png",
    attackSuffix: "skins/lord-alpha/afro-attack.png",
  },
  supreme: {
    id: "supreme",
    label: "Lord Alpha Supreme I",
    idleSuffix: "skins/lord-alpha/supreme-idle.png",
    attackSuffix: "skins/lord-alpha/supreme-attack.png",
  },
} as const satisfies Record<LordAlphaForm, LordAlphaFormAssetManifest>;

/** Alias retained for consumers that describe the form table as a manifest. */
export const LORD_ALPHA_FORM_MANIFEST = LORD_ALPHA_FORMS;

export const LORD_ALPHA_PRESENTATION_EVENT_KINDS = [
  "move",
  "web",
  "wormhole",
  "tharthareon",
  "dragon",
  "equip",
  "clone",
] as const;

export type LordAlphaPresentationEventKind =
  (typeof LORD_ALPHA_PRESENTATION_EVENT_KINDS)[number];

export const LORD_ALPHA_COMBO_BEATS = [
  "quick",
  "web",
  "power",
  "roc",
  "finisher",
] as const;

export type LordAlphaComboBeat = (typeof LORD_ALPHA_COMBO_BEATS)[number];

export type LordAlphaComboAssetSuffix =
  `skins/lord-alpha/supreme-combo-${LordAlphaComboBeat}.png`;

/**
 * Supreme-form pose assets keyed by presentation beat. Kept separate from the
 * form manifest so existing consumers of LordAlphaFormAssetManifest remain
 * source-compatible.
 */
export const LORD_ALPHA_COMBO_ASSET_SUFFIXES = {
  quick: "skins/lord-alpha/supreme-combo-quick.png",
  web: "skins/lord-alpha/supreme-combo-web.png",
  power: "skins/lord-alpha/supreme-combo-power.png",
  roc: "skins/lord-alpha/supreme-combo-roc.png",
  finisher: "skins/lord-alpha/supreme-combo-finisher.png",
} as const satisfies Record<LordAlphaComboBeat, LordAlphaComboAssetSuffix>;

export const LORD_ALPHA_SKILL_SEQUENCE_IDS = [
  "web-shot",
  "grapple",
  "roc-stun",
  "dimensional-net",
  "wormhole-step",
  "shadow-clone",
  "tharthareon",
  "millennium-dragon",
] as const;

export type LordAlphaSkillSequenceId =
  (typeof LORD_ALPHA_SKILL_SEQUENCE_IDS)[number];

export type LordAlphaSkillActionId = LordAlphaSkillSequenceId | "equip";

export type LordAlphaSkillSequenceAssetSuffix =
  `skins/lord-alpha/skill-sequences/${LordAlphaSkillSequenceId}.png`;

export const LORD_ALPHA_SKILL_SEQUENCE_FRAME_COUNT = 4 as const;
export const LORD_ALPHA_SKILL_SEQUENCE_FRAME_WIDTH = 240 as const;
export const LORD_ALPHA_SKILL_SEQUENCE_FRAME_HEIGHT = 160 as const;

export interface LordAlphaSkillSequenceAssetManifest {
  readonly id: LordAlphaSkillSequenceId;
  readonly suffix: LordAlphaSkillSequenceAssetSuffix;
  readonly frameCount: typeof LORD_ALPHA_SKILL_SEQUENCE_FRAME_COUNT;
  readonly frameWidth: typeof LORD_ALPHA_SKILL_SEQUENCE_FRAME_WIDTH;
  readonly frameHeight: typeof LORD_ALPHA_SKILL_SEQUENCE_FRAME_HEIGHT;
  /** Body animation only; the event and its VFX retain their canonical lifetime. */
  readonly durationMs: number;
}

/**
 * ImageGen-authored Supreme-form action strips. Each source is four adjacent
 * 240x160 frames (960x160 total). They are presentation-only and deliberately
 * omit the Roc Wing so the independent anatomical-left attachment remains
 * authoritative when the body is mirrored. Equip stays procedural.
 */
export const LORD_ALPHA_SKILL_SEQUENCE_ASSETS = {
  "web-shot": {
    id: "web-shot",
    suffix: "skins/lord-alpha/skill-sequences/web-shot.png",
    frameCount: 4,
    frameWidth: 240,
    frameHeight: 160,
    durationMs: 840,
  },
  grapple: {
    id: "grapple",
    suffix: "skins/lord-alpha/skill-sequences/grapple.png",
    frameCount: 4,
    frameWidth: 240,
    frameHeight: 160,
    durationMs: 960,
  },
  "roc-stun": {
    id: "roc-stun",
    suffix: "skins/lord-alpha/skill-sequences/roc-stun.png",
    frameCount: 4,
    frameWidth: 240,
    frameHeight: 160,
    durationMs: 840,
  },
  "dimensional-net": {
    id: "dimensional-net",
    suffix: "skins/lord-alpha/skill-sequences/dimensional-net.png",
    frameCount: 4,
    frameWidth: 240,
    frameHeight: 160,
    durationMs: 1_120,
  },
  "wormhole-step": {
    id: "wormhole-step",
    suffix: "skins/lord-alpha/skill-sequences/wormhole-step.png",
    frameCount: 4,
    frameWidth: 240,
    frameHeight: 160,
    durationMs: 960,
  },
  "shadow-clone": {
    id: "shadow-clone",
    suffix: "skins/lord-alpha/skill-sequences/shadow-clone.png",
    frameCount: 4,
    frameWidth: 240,
    frameHeight: 160,
    durationMs: 1_120,
  },
  tharthareon: {
    id: "tharthareon",
    suffix: "skins/lord-alpha/skill-sequences/tharthareon.png",
    frameCount: 4,
    frameWidth: 240,
    frameHeight: 160,
    durationMs: 1_240,
  },
  "millennium-dragon": {
    id: "millennium-dragon",
    suffix: "skins/lord-alpha/skill-sequences/millennium-dragon.png",
    frameCount: 4,
    frameWidth: 240,
    frameHeight: 160,
    durationMs: 1_280,
  },
} as const satisfies Record<
  LordAlphaSkillSequenceId,
  LordAlphaSkillSequenceAssetManifest
>;

/**
 * Presentation timing only. None of these values gate input, projectiles,
 * collision, damage, cooldowns, or movement.
 */
export const LORD_ALPHA_COMBO_RESET_MS = 700;

export const LORD_ALPHA_COMBO_TIMINGS_MS = {
  quick: 170,
  web: 190,
  power: 230,
  roc: 210,
  finisher: 300,
} as const satisfies Record<LordAlphaComboBeat, number>;

/**
 * Canonical canvas/attachment animation durations for existing event kinds.
 * Skill events deliberately outlive their four body frames so the authored
 * recovery pose remains readable at gameplay scale without gating controls.
 */
export const LORD_ALPHA_EVENT_TIMINGS_MS = {
  move: 330,
  web: 1_040,
  wormhole: 1_160,
  tharthareon: 1_480,
  dragon: 1_520,
  equip: 820,
  clone: 2_430,
} as const satisfies Record<LordAlphaPresentationEventKind, number>;

/**
 * Canvas-only render modes which refine a major presentation event without
 * introducing gameplay state. Major event durations above and these
 * specialized durations are the single timing source used by the live game.
 */
export const LORD_ALPHA_VFX_TIMINGS_MS = {
  ...LORD_ALPHA_EVENT_TIMINGS_MS,
  "web-impact": 1_320,
  grapple: 1_160,
  "roc-stun": 1_040,
  "dimensional-net": 1_320,
} as const;

export type LordAlphaVfxMode = keyof typeof LORD_ALPHA_VFX_TIMINGS_MS;

export const LORD_ALPHA_PRESENTATION_TIMINGS_MS = {
  comboReset: LORD_ALPHA_COMBO_RESET_MS,
  combo: LORD_ALPHA_COMBO_TIMINGS_MS,
  event: LORD_ALPHA_EVENT_TIMINGS_MS,
} as const;

export interface LordAlphaComboState {
  /** Beat that will be emitted by the next primary attack trigger. */
  readonly nextBeatIndex: number;
  readonly lastTriggerAt: number | null;
  /** Number of finishers already emitted in this presentation cycle. */
  readonly completedCycles: number;
}

export interface LordAlphaComboAdvanceResult {
  readonly beat: LordAlphaComboBeat;
  readonly beatIndex: number;
  readonly restarted: boolean;
  readonly completedCycle: boolean;
  readonly state: LordAlphaComboState;
}

export function createLordAlphaComboState(): LordAlphaComboState {
  return { nextBeatIndex: 0, lastTriggerAt: null, completedCycles: 0 };
}

export function resetLordAlphaCombo(
  state: LordAlphaComboState = createLordAlphaComboState(),
): LordAlphaComboState {
  return {
    nextBeatIndex: 0,
    lastTriggerAt: null,
    completedCycles: Math.max(0, Math.floor(state.completedCycles || 0)),
  };
}

/**
 * Advance one visual combo beat. Callers should invoke this once per primary
 * Buster trigger, never once per spawned secondary/card/clone projectile.
 */
export function advanceLordAlphaCombo(
  state: LordAlphaComboState,
  triggerAtMs: number,
  resetAfterMs = LORD_ALPHA_COMBO_RESET_MS,
): LordAlphaComboAdvanceResult {
  const triggerAt = Number.isFinite(triggerAtMs) ? Math.max(0, triggerAtMs) : 0;
  const resetWindow = Number.isFinite(resetAfterMs)
    ? Math.max(0, resetAfterMs)
    : LORD_ALPHA_COMBO_RESET_MS;
  const previousAt = state.lastTriggerAt;
  const restarted =
    previousAt !== null &&
    (triggerAt < previousAt || triggerAt - previousAt > resetWindow);
  const requestedIndex = restarted ? 0 : Math.floor(state.nextBeatIndex);
  const beatIndex = Number.isFinite(requestedIndex)
    ? ((requestedIndex % LORD_ALPHA_COMBO_BEATS.length) +
        LORD_ALPHA_COMBO_BEATS.length) %
      LORD_ALPHA_COMBO_BEATS.length
    : 0;
  const beat = LORD_ALPHA_COMBO_BEATS[beatIndex];
  const completedCycle = beatIndex === LORD_ALPHA_COMBO_BEATS.length - 1;

  return {
    beat,
    beatIndex,
    restarted,
    completedCycle,
    state: {
      nextBeatIndex: (beatIndex + 1) % LORD_ALPHA_COMBO_BEATS.length,
      lastTriggerAt: triggerAt,
      completedCycles:
        Math.max(0, Math.floor(state.completedCycles || 0)) +
        (completedCycle ? 1 : 0),
    },
  };
}

export const LORD_ALPHA_PRESENTATION_SUBTYPES = [
  "step",
  "grapple-align",
  "roc-boost",
  "roc-stun",
  "web-shot",
  "web-mark",
  "web-chain",
  "web-restraint",
  "web-pull",
  "dimensional-net",
  "wormhole-cast",
  "wormhole-departure",
  "wormhole-arrival",
  "dagger-node",
  "calculus",
  "clone-symmetry",
  "equip-assembly",
  "tharthareon-emerge",
  "ultimate-landing",
  "combo-quick",
  "combo-web",
  "combo-power",
  "combo-roc",
  "combo-finisher",
] as const;

export type LordAlphaPresentationSubtype =
  (typeof LORD_ALPHA_PRESENTATION_SUBTYPES)[number];

/**
 * Maps semantic skill choreography to its authored body sequence. VFX continue to
 * render independently from this lookup.
 */
export const LORD_ALPHA_SKILL_SEQUENCE_BY_SUBTYPE = {
  "web-shot": "web-shot",
  "web-mark": "web-shot",
  "web-chain": "web-shot",
  "web-restraint": "dimensional-net",
  "web-pull": "grapple",
  "grapple-align": "grapple",
  "roc-stun": "roc-stun",
  "dimensional-net": "dimensional-net",
  calculus: "dimensional-net",
  "wormhole-cast": "wormhole-step",
  "wormhole-departure": "wormhole-step",
  "wormhole-arrival": "wormhole-step",
  "dagger-node": "wormhole-step",
  "clone-symmetry": "shadow-clone",
  "tharthareon-emerge": "tharthareon",
  "ultimate-landing": "millennium-dragon",
} as const satisfies Partial<
  Record<LordAlphaPresentationSubtype, LordAlphaSkillSequenceId>
>;

export function resolveLordAlphaSkillSequence(
  event: LordAlphaPresentationEvent | null | undefined,
): LordAlphaSkillSequenceAssetManifest | null {
  const subtype = event?.subtype;
  let sequenceId: LordAlphaSkillSequenceId | undefined;
  if (!subtype) {
    switch (event?.kind) {
      case "web":
        sequenceId = "web-shot";
        break;
      case "wormhole":
        sequenceId = "wormhole-step";
        break;
      case "clone":
        sequenceId = "shadow-clone";
        break;
      case "tharthareon":
        sequenceId = "tharthareon";
        break;
      case "dragon":
        sequenceId = "millennium-dragon";
        break;
      default:
        return null;
    }
  } else {
    sequenceId = LORD_ALPHA_SKILL_SEQUENCE_BY_SUBTYPE[subtype as keyof typeof LORD_ALPHA_SKILL_SEQUENCE_BY_SUBTYPE];
  }
  return sequenceId ? LORD_ALPHA_SKILL_SEQUENCE_ASSETS[sequenceId] : null;
}

export interface LordAlphaComboPresentation {
  readonly beat: LordAlphaComboBeat;
  readonly subtype: Extract<
    LordAlphaPresentationSubtype,
    "combo-quick" | "combo-web" | "combo-power" | "combo-roc" | "combo-finisher"
  >;
  readonly durationMs: number;
}

export const LORD_ALPHA_COMBO_PRESENTATIONS = {
  quick: {
    beat: "quick",
    subtype: "combo-quick",
    durationMs: LORD_ALPHA_COMBO_TIMINGS_MS.quick,
  },
  web: {
    beat: "web",
    subtype: "combo-web",
    durationMs: LORD_ALPHA_COMBO_TIMINGS_MS.web,
  },
  power: {
    beat: "power",
    subtype: "combo-power",
    durationMs: LORD_ALPHA_COMBO_TIMINGS_MS.power,
  },
  roc: {
    beat: "roc",
    subtype: "combo-roc",
    durationMs: LORD_ALPHA_COMBO_TIMINGS_MS.roc,
  },
  finisher: {
    beat: "finisher",
    subtype: "combo-finisher",
    durationMs: LORD_ALPHA_COMBO_TIMINGS_MS.finisher,
  },
} as const satisfies Record<LordAlphaComboBeat, LordAlphaComboPresentation>;

/** Normalized coordinates within the VFX surface, inclusive from 0 to 1. */
export interface LordAlphaPresentationAnchor {
  readonly x: number;
  readonly y: number;
}

export interface LordAlphaPresentationEventOptions {
  readonly subtype?: LordAlphaPresentationSubtype;
  readonly origin?: LordAlphaPresentationAnchor;
  readonly target?: LordAlphaPresentationAnchor;
}

export interface LordAlphaPresentationEvent {
  readonly kind: LordAlphaPresentationEventKind;
  /** Normalized presentation progress, independent of simulation timing. */
  readonly progress: number;
  readonly subtype?: LordAlphaPresentationSubtype;
  /** Optional normalized source/target positions for target-local VFX. */
  readonly origin?: LordAlphaPresentationAnchor;
  readonly target?: LordAlphaPresentationAnchor;
}

/** Resolve a semantic subtype into the concrete renderer choreography. */
export function resolveLordAlphaVfxMode(
  event: LordAlphaPresentationEvent,
): LordAlphaVfxMode {
  switch (event.subtype) {
    case "web-restraint":
      return "web-impact";
    case "web-pull":
    case "grapple-align":
      return "grapple";
    case "roc-stun":
      return "roc-stun";
    case "dimensional-net":
      return "dimensional-net";
    case "wormhole-cast":
    case "wormhole-departure":
    case "wormhole-arrival":
      return "wormhole";
    case "clone-symmetry":
      return "clone";
    case "equip-assembly":
      return "equip";
    case "tharthareon-emerge":
      return "tharthareon";
    case "ultimate-landing":
      return "dragon";
    default:
      return event.kind;
  }
}

export const LORD_ALPHA_ASSETS = {
  skinsRoot: "skins/lord-alpha/",
  effectsRoot: "effects/lord-alpha/",
  forms: LORD_ALPHA_FORMS,
  combo: LORD_ALPHA_COMBO_ASSET_SUFFIXES,
  skillSequences: LORD_ALPHA_SKILL_SEQUENCE_ASSETS,
  effects: {
    tharthareon: "effects/lord-alpha/tharthareon.png",
  },
} as const;

/** Effects constructed at runtime rather than represented by binary sprites. */
export const LORD_ALPHA_PROCEDURAL_EFFECTS = [
  "move",
  "web",
  "wormhole",
  "dragon",
  "equip",
  "clone",
] as const satisfies readonly Exclude<
  LordAlphaPresentationEventKind,
  "tharthareon"
>[];

/** Resolve one manifest suffix without coupling this module to import.meta. */
export function lordAlphaAssetUrl(baseUrl: string, suffix: string): string {
  const prefix =
    baseUrl.length === 0 || baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return `${prefix}${suffix.replace(/^\/+/, "")}`;
}

export type LordAlphaFacing = "left" | "right";
export type LordAlphaScreenSide = "screen-left" | "screen-right";

/**
 * A front-facing character's anatomical left mirrors across the screen when
 * the character turns. The result names screen space, not world direction.
 */
export function anatomicalLeftScreenSide(
  facing: LordAlphaFacing,
): LordAlphaScreenSide {
  return facing === "right" ? "screen-left" : "screen-right";
}

export interface RocWingAttachment {
  readonly kind: "roc-wing";
  readonly anatomicalSide: "left";
  readonly screenSide: LordAlphaScreenSide;
  /** -1 is screen-left and 1 is screen-right in normalized sprite space. */
  readonly anchorX: -1 | 1;
}

export type RocWingPlacement = readonly [RocWingAttachment];

/** Returns one, and only one, Roc wing attached to anatomical left. */
export function rocWingPlacement(facing: LordAlphaFacing): RocWingPlacement {
  const screenSide = anatomicalLeftScreenSide(facing);
  return [
    {
      kind: "roc-wing",
      anatomicalSide: "left",
      screenSide,
      anchorX: screenSide === "screen-left" ? -1 : 1,
    },
  ];
}

export const LORD_ALPHA_TOPOLOGY_STAGES = [
  "points",
  "connections",
  "structure",
  "effect",
] as const;

export type LordAlphaTopologyStage =
  (typeof LORD_ALPHA_TOPOLOGY_STAGES)[number];

export function clampTopologyProgress(progress: number): number {
  if (Number.isNaN(progress) || progress <= 0) return 0;
  if (progress >= 1) return 1;
  return progress;
}

/** Divide clamped progress into four ordered, equal-duration stages. */
export function topologyStage(progress: number): LordAlphaTopologyStage {
  const clamped = clampTopologyProgress(progress);
  const index = Math.min(
    LORD_ALPHA_TOPOLOGY_STAGES.length - 1,
    Math.floor(clamped * LORD_ALPHA_TOPOLOGY_STAGES.length),
  );
  return LORD_ALPHA_TOPOLOGY_STAGES[index];
}

export function normalizeLordAlphaAnchor(
  anchor: LordAlphaPresentationAnchor | undefined,
): LordAlphaPresentationAnchor | undefined {
  if (!anchor || !Number.isFinite(anchor.x) || !Number.isFinite(anchor.y)) {
    return undefined;
  }
  return {
    x: Math.min(1, Math.max(0, anchor.x)),
    y: Math.min(1, Math.max(0, anchor.y)),
  };
}

export function createLordAlphaPresentationEvent(
  kind: LordAlphaPresentationEventKind,
  progress: number,
  options: LordAlphaPresentationEventOptions = {},
): LordAlphaPresentationEvent {
  const origin = normalizeLordAlphaAnchor(options.origin);
  const target = normalizeLordAlphaAnchor(options.target);
  return {
    kind,
    progress: clampTopologyProgress(progress),
    ...(options.subtype ? { subtype: options.subtype } : {}),
    ...(origin ? { origin } : {}),
    ...(target ? { target } : {}),
  };
}

export interface LordAlphaCardPresentation {
  readonly kind: LordAlphaPresentationEventKind;
  readonly subtype: LordAlphaPresentationSubtype;
  readonly durationMs: number;
}

const cardPresentation = (
  kind: LordAlphaPresentationEventKind,
  subtype: LordAlphaPresentationSubtype,
  durationMs: number = LORD_ALPHA_EVENT_TIMINGS_MS[kind],
): LordAlphaCardPresentation => ({
  kind,
  subtype,
  durationMs,
});

/**
 * Existing card mechanics translated into Lord Alpha's visual language.
 * This table intentionally contains no power, range, cooldown, or status data.
 */
export const LORD_ALPHA_CARD_PRESENTATIONS = {
  arcweb: cardPresentation("web", "web-chain"),
  rootsnare: cardPresentation("web", "web-restraint", LORD_ALPHA_VFX_TIMINGS_MS["web-impact"]),
  sonicnet: cardPresentation("web", "web-restraint", LORD_ALPHA_VFX_TIMINGS_MS["web-impact"]),
  tanglewire: cardPresentation("web", "web-restraint", LORD_ALPHA_VFX_TIMINGS_MS["web-impact"]),
  gravity: cardPresentation("web", "web-pull", LORD_ALPHA_VFX_TIMINGS_MS.grapple),
  undertow: cardPresentation("web", "web-pull", LORD_ALPHA_VFX_TIMINGS_MS.grapple),
  freeze: cardPresentation("move", "roc-stun", LORD_ALPHA_VFX_TIMINGS_MS["roc-stun"]),
  scramble: cardPresentation("move", "roc-stun", LORD_ALPHA_VFX_TIMINGS_MS["roc-stun"]),
  pulse: cardPresentation("move", "roc-stun", LORD_ALPHA_VFX_TIMINGS_MS["roc-stun"]),
  groundwire: cardPresentation("move", "roc-stun", LORD_ALPHA_VFX_TIMINGS_MS["roc-stun"]),
  warpback: cardPresentation("wormhole", "wormhole-cast"),
  backdash: cardPresentation("wormhole", "wormhole-cast"),
  voidaperture: cardPresentation("wormhole", "wormhole-cast"),
  stasisgate: cardPresentation("wormhole", "dimensional-net", LORD_ALPHA_VFX_TIMINGS_MS["dimensional-net"]),
  nuke: cardPresentation("tharthareon", "tharthareon-emerge"),
  megabomb: cardPresentation("dragon", "ultimate-landing"),
} as const satisfies Record<string, LordAlphaCardPresentation>;

export type LordAlphaMappedCardId = keyof typeof LORD_ALPHA_CARD_PRESENTATIONS;

export function getLordAlphaCardPresentation(
  abilityId: string,
): LordAlphaCardPresentation | null {
  return Object.prototype.hasOwnProperty.call(
    LORD_ALPHA_CARD_PRESENTATIONS,
    abilityId,
  )
    ? LORD_ALPHA_CARD_PRESENTATIONS[abilityId as LordAlphaMappedCardId]
    : null;
}

export const LORD_ALPHA_SKILL_PREVIEW_QUERY_KEY = "lordAlphaSkills" as const;

export interface LordAlphaSkillPreviewAction {
  readonly id: LordAlphaSkillActionId;
  readonly label: string;
  /** Existing live-game mechanic reused by the preview; null is a dedicated presentation path. */
  readonly mechanicId: string | null;
  readonly presentation: LordAlphaCardPresentation;
}

/**
 * Deterministic presentation-only triggers used by the isolated query-gated
 * skill preview. Existing card mappings are reused wherever one already owns
 * the visual language; direct entries never contain gameplay data.
 */
export const LORD_ALPHA_SKILL_PREVIEW_ACTIONS = [
  {
    id: "web-shot",
    label: "Web Shot / Chain",
    mechanicId: "arcweb",
    presentation: LORD_ALPHA_CARD_PRESENTATIONS.arcweb,
  },
  {
    id: "grapple",
    label: "Grapple / Pull",
    mechanicId: "gravity",
    presentation: LORD_ALPHA_CARD_PRESENTATIONS.gravity,
  },
  {
    id: "roc-stun",
    label: "Roc Stun",
    mechanicId: "freeze",
    presentation: LORD_ALPHA_CARD_PRESENTATIONS.freeze,
  },
  {
    id: "dimensional-net",
    label: "Dimensional Net",
    mechanicId: "stasisgate",
    presentation: LORD_ALPHA_CARD_PRESENTATIONS.stasisgate,
  },
  {
    id: "wormhole-step",
    label: "Wormhole Step",
    mechanicId: "warpback",
    presentation: LORD_ALPHA_CARD_PRESENTATIONS.warpback,
  },
  {
    id: "shadow-clone",
    label: "Shadow Clone",
    mechanicId: null,
    presentation: cardPresentation("clone", "clone-symmetry"),
  },
  {
    id: "tharthareon",
    label: "Tharthareon",
    mechanicId: "nuke",
    presentation: LORD_ALPHA_CARD_PRESENTATIONS.nuke,
  },
  {
    id: "millennium-dragon",
    label: "Millennium Dragon",
    mechanicId: "megabomb",
    presentation: LORD_ALPHA_CARD_PRESENTATIONS.megabomb,
  },
  {
    id: "equip",
    label: "Equip Latency",
    mechanicId: null,
    presentation: cardPresentation("equip", "equip-assembly"),
  },
] as const satisfies readonly LordAlphaSkillPreviewAction[];

export const LORD_ALPHA_SKILL_BINDINGS = [
  { slot: 0, gamepad: "X", keyboard: "Z" },
  { slot: 1, gamepad: "Y", keyboard: "X" },
  { slot: 2, gamepad: "B", keyboard: "C" },
] as const;

export const LORD_ALPHA_SKILL_BANKS = [
  {
    id: "web",
    label: "WEB SYSTEMS",
    actionIds: ["web-shot", "grapple", "dimensional-net"],
  },
  {
    id: "mobility",
    label: "MOBILITY",
    actionIds: ["roc-stun", "wormhole-step", "shadow-clone"],
  },
  {
    id: "summon-form",
    label: "SUMMON / FORM",
    actionIds: ["tharthareon", "millennium-dragon", "equip"],
  },
] as const satisfies readonly {
  readonly id: string;
  readonly label: string;
  readonly actionIds: readonly [
    LordAlphaSkillActionId,
    LordAlphaSkillActionId,
    LordAlphaSkillActionId,
  ];
}[];

export function wrapLordAlphaSkillBank(index: number): number {
  const requested = Number.isFinite(index) ? Math.trunc(index) : 0;
  return (
    (requested % LORD_ALPHA_SKILL_BANKS.length) + LORD_ALPHA_SKILL_BANKS.length
  ) % LORD_ALPHA_SKILL_BANKS.length;
}

export function resolveLordAlphaSkillAction(
  bankIndex: number,
  slotIndex: number,
): (typeof LORD_ALPHA_SKILL_PREVIEW_ACTIONS)[number] | null {
  if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= LORD_ALPHA_SKILL_BINDINGS.length) {
    return null;
  }
  const bank = LORD_ALPHA_SKILL_BANKS[wrapLordAlphaSkillBank(bankIndex)];
  const actionId = bank.actionIds[slotIndex];
  return LORD_ALPHA_SKILL_PREVIEW_ACTIONS.find((action) => action.id === actionId) ?? null;
}

/** True only for the explicit local preview opt-in; ordinary routes stay clean. */
export function isLordAlphaSkillsPreviewSearch(search: string): boolean {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  return params.get(LORD_ALPHA_SKILL_PREVIEW_QUERY_KEY) === "1";
}

export const LORD_ALPHA_TOPOLOGY_VOCABULARY = [
  "node",
  "strand",
  "radial",
  "net",
  "spiral",
  "fold",
  "portal",
  "torus",
] as const;

export type LordAlphaTopologyKind =
  (typeof LORD_ALPHA_TOPOLOGY_VOCABULARY)[number];

export const LORD_ALPHA_TOPOLOGY_LIMITS = {
  minNodes: 1,
  maxNodes: 64,
  maxEdges: 256,
  coordinateMin: -1,
  coordinateMax: 1,
  defaultNodes: 16,
} as const;

export interface LordAlphaTopologyNode {
  readonly id: number;
  readonly x: number;
  readonly y: number;
}

export interface LordAlphaTopologyEdge {
  readonly from: number;
  readonly to: number;
}

export interface LordAlphaTopology {
  readonly kind: LordAlphaTopologyKind;
  readonly nodes: readonly LordAlphaTopologyNode[];
  readonly edges: readonly LordAlphaTopologyEdge[];
}

export interface LordAlphaTopologyOptions {
  readonly kind: LordAlphaTopologyKind;
  readonly seed: number | string;
  readonly nodeCount?: number;
}

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(maximum, Math.max(minimum, value));

function boundedNodeCount(requested: number | undefined): number {
  if (requested === undefined || Number.isNaN(requested)) {
    return LORD_ALPHA_TOPOLOGY_LIMITS.defaultNodes;
  }
  if (requested === Number.POSITIVE_INFINITY) {
    return LORD_ALPHA_TOPOLOGY_LIMITS.maxNodes;
  }
  if (requested === Number.NEGATIVE_INFINITY) {
    return LORD_ALPHA_TOPOLOGY_LIMITS.minNodes;
  }
  return clamp(
    Math.floor(requested),
    LORD_ALPHA_TOPOLOGY_LIMITS.minNodes,
    LORD_ALPHA_TOPOLOGY_LIMITS.maxNodes,
  );
}

function seedHash(seed: number | string, kind: LordAlphaTopologyKind): number {
  const source = `${kind}:${String(seed)}`;
  let hash = 0x811c9dc5;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 0x100000000;
  };
}

function boundedCoordinate(value: number): number {
  const bounded = clamp(
    value,
    LORD_ALPHA_TOPOLOGY_LIMITS.coordinateMin,
    LORD_ALPHA_TOPOLOGY_LIMITS.coordinateMax,
  );
  return Math.round(bounded * 1_000_000) / 1_000_000;
}

function topologyCoordinate(
  kind: LordAlphaTopologyKind,
  index: number,
  count: number,
  phase: number,
  random: () => number,
): { x: number; y: number } {
  const fraction = count === 1 ? 0.5 : index / (count - 1);
  const jitter = () => (random() - 0.5) * 0.05;

  switch (kind) {
    case "node": {
      const angle = phase + random() * Math.PI * 2;
      const radius = Math.sqrt(random()) * 0.88;
      return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
    }
    case "strand":
      return {
        x: -0.9 + fraction * 1.8 + jitter(),
        y: Math.sin(phase + fraction * Math.PI * 3) * 0.28 + jitter(),
      };
    case "radial": {
      if (index === 0) return { x: 0, y: 0 };
      const spokeCount = Math.max(1, count - 1);
      const angle = phase + ((index - 1) / spokeCount) * Math.PI * 2;
      const radius = 0.64 + random() * 0.24;
      return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
    }
    case "net": {
      const columns = Math.ceil(Math.sqrt(count));
      const rows = Math.ceil(count / columns);
      const column = index % columns;
      const row = Math.floor(index / columns);
      return {
        x:
          columns === 1 ? 0 : -0.85 + (column / (columns - 1)) * 1.7 + jitter(),
        y: rows === 1 ? 0 : -0.85 + (row / (rows - 1)) * 1.7 + jitter(),
      };
    }
    case "spiral": {
      const angle = phase + fraction * Math.PI * 5;
      const radius = 0.08 + fraction * 0.82;
      return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
    }
    case "fold": {
      const folded = (index % 4) / 3;
      const y = index % 2 === 0 ? folded * 1.25 - 0.62 : 0.62 - folded * 1.25;
      return { x: -0.88 + fraction * 1.76 + jitter(), y: y + jitter() };
    }
    case "portal": {
      const leftCount = Math.ceil(count / 2);
      const isLeft = index < leftCount;
      const localIndex = isLeft ? index : index - leftCount;
      const localCount = isLeft ? leftCount : Math.max(1, count - leftCount);
      const angle = phase + (localIndex / localCount) * Math.PI * 2;
      return {
        x: (isLeft ? -0.48 : 0.48) + Math.cos(angle) * 0.3,
        y: Math.sin(angle) * 0.54,
      };
    }
    case "torus": {
      const majorAngle = phase + (index / count) * Math.PI * 2;
      const minorAngle = phase * 0.5 + ((index * 3) / count) * Math.PI * 2;
      const projectedRadius = 0.63 + Math.cos(minorAngle) * 0.24;
      return {
        x: Math.cos(majorAngle) * projectedRadius,
        y:
          Math.sin(majorAngle) * projectedRadius * 0.72 +
          Math.sin(minorAngle) * 0.16,
      };
    }
  }
}

function topologyEdges(
  kind: LordAlphaTopologyKind,
  nodeCount: number,
): LordAlphaTopologyEdge[] {
  const edges: LordAlphaTopologyEdge[] = [];
  const seen = new Set<string>();
  const add = (from: number, to: number): void => {
    if (
      from === to ||
      from < 0 ||
      to < 0 ||
      from >= nodeCount ||
      to >= nodeCount
    )
      return;
    const first = Math.min(from, to);
    const second = Math.max(from, to);
    const key = `${first}:${second}`;
    if (seen.has(key) || edges.length >= LORD_ALPHA_TOPOLOGY_LIMITS.maxEdges)
      return;
    seen.add(key);
    edges.push({ from: first, to: second });
  };
  const chain = (start: number, endExclusive: number): void => {
    for (let index = start; index + 1 < endExclusive; index += 1)
      add(index, index + 1);
  };
  const ring = (start: number, endExclusive: number): void => {
    chain(start, endExclusive);
    if (endExclusive - start > 2) add(endExclusive - 1, start);
  };

  switch (kind) {
    case "node":
      break;
    case "strand":
    case "spiral":
      chain(0, nodeCount);
      break;
    case "radial":
      for (let index = 1; index < nodeCount; index += 1) add(0, index);
      ring(1, nodeCount);
      break;
    case "net": {
      const columns = Math.ceil(Math.sqrt(nodeCount));
      for (let index = 0; index < nodeCount; index += 1) {
        if (index % columns !== columns - 1) add(index, index + 1);
        add(index, index + columns);
      }
      break;
    }
    case "fold":
      chain(0, nodeCount);
      for (let index = 0; index < Math.floor(nodeCount / 2); index += 1) {
        add(index, nodeCount - 1 - index);
      }
      break;
    case "portal": {
      const leftCount = Math.ceil(nodeCount / 2);
      ring(0, leftCount);
      ring(leftCount, nodeCount);
      for (let index = 0; index < nodeCount - leftCount; index += 1) {
        add(index, leftCount + index);
      }
      break;
    }
    case "torus": {
      const stride = Math.max(2, Math.floor(Math.sqrt(nodeCount)));
      for (let index = 0; index < nodeCount; index += 1) {
        add(index, (index + 1) % nodeCount);
        add(index, (index + stride) % nodeCount);
      }
      break;
    }
  }

  return edges;
}

/**
 * Generate deterministic normalized geometry. Counts, coordinates, and edge
 * references are bounded so callers can render untrusted/requested sizes.
 */
export function generateLordAlphaTopology(
  options: LordAlphaTopologyOptions,
): LordAlphaTopology {
  const nodeCount = boundedNodeCount(options.nodeCount);
  const random = seededRandom(seedHash(options.seed, options.kind));
  const phase = random() * Math.PI * 2;
  const nodes = Array.from({ length: nodeCount }, (_, id) => {
    const coordinate = topologyCoordinate(
      options.kind,
      id,
      nodeCount,
      phase,
      random,
    );
    return {
      id,
      x: boundedCoordinate(coordinate.x),
      y: boundedCoordinate(coordinate.y),
    };
  });

  return {
    kind: options.kind,
    nodes,
    edges: topologyEdges(options.kind, nodeCount),
  };
}

export interface LordAlphaTopologyMorphNode {
  readonly id: number;
  readonly from: LordAlphaTopologyNode;
  readonly to: LordAlphaTopologyNode;
}

/**
 * A stable identity map between two geometries. Renderers may cross-fade the
 * edge sets while sampling the same node ids throughout the transformation.
 */
export interface LordAlphaTopologyMorph {
  readonly fromKind: LordAlphaTopologyKind;
  readonly toKind: LordAlphaTopologyKind;
  readonly nodes: readonly LordAlphaTopologyMorphNode[];
  readonly fromEdges: readonly LordAlphaTopologyEdge[];
  readonly toEdges: readonly LordAlphaTopologyEdge[];
}

export interface LordAlphaTopologyMorphWeights {
  readonly from: number;
  readonly to: number;
}

export function createLordAlphaTopologyMorph(
  from: LordAlphaTopology,
  to: LordAlphaTopology,
): LordAlphaTopologyMorph {
  const fromById = new Map(from.nodes.map((node) => [node.id, node]));
  const toById = new Map(to.nodes.map((node) => [node.id, node]));
  const ids = [...new Set([...fromById.keys(), ...toById.keys()])].sort(
    (left, right) => left - right,
  );
  const origin = (id: number): LordAlphaTopologyNode => ({ id, x: 0, y: 0 });
  const nodes = ids.map((id) => ({
    id,
    from: fromById.get(id) ?? origin(id),
    to: toById.get(id) ?? origin(id),
  }));

  return {
    fromKind: from.kind,
    toKind: to.kind,
    nodes,
    fromEdges: from.edges,
    toEdges: to.edges,
  };
}

export function sampleLordAlphaTopologyMorph(
  morph: LordAlphaTopologyMorph,
  progress: number,
): readonly LordAlphaTopologyNode[] {
  const amount = clampTopologyProgress(progress);
  return morph.nodes.map((node) => ({
    id: node.id,
    x: boundedCoordinate(node.from.x + (node.to.x - node.from.x) * amount),
    y: boundedCoordinate(node.from.y + (node.to.y - node.from.y) * amount),
  }));
}

export function lordAlphaTopologyMorphWeights(
  progress: number,
): LordAlphaTopologyMorphWeights {
  const amount = clampTopologyProgress(progress);
  const eased = amount * amount * (3 - 2 * amount);
  return { from: 1 - eased, to: eased };
}

/** Create the canonical readable WEB -> CURVATURE -> FOLD relationship. */
export function createLordAlphaDimensionalNetMorph(
  seed: string | number,
  nodeCount = 25,
): LordAlphaTopologyMorph {
  const boundedCount = boundedNodeCount(nodeCount);
  return createLordAlphaTopologyMorph(
    generateLordAlphaTopology({ kind: "net", seed, nodeCount: boundedCount }),
    generateLordAlphaTopology({
      kind: "portal",
      seed,
      nodeCount: boundedCount,
    }),
  );
}

/** This skin is presentation-only: there are no gameplay balance changes. */
export const LORD_ALPHA_GAMEPLAY_BALANCE_CHANGES = false as const;

/** This skin is presentation-only: there are no gameplay hitbox changes. */
export const LORD_ALPHA_HITBOX_CHANGES = false as const;

export const LORD_ALPHA_PRESENTATION_SCOPE =
  "Presentation only: no gameplay balance changes and no hitbox changes." as const;
