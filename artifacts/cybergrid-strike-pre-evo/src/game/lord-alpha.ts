/**
 * Pure presentation contract for the Lord Alpha skin.
 *
 * Asset values are suffixes intended to be appended to Vite's BASE_URL. This
 * module intentionally has no DOM, canvas, React, or game-state dependencies.
 */

import type { GridColumnPullMotion } from "./types";

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
  "ninjato-phase-slice",
  "ninjato-back-thrust",
  "tharthareon",
  "tharthareon-fireball",
  "millennium-dragon",
  "equip",
] as const;

export type LordAlphaSkillSequenceId =
  (typeof LORD_ALPHA_SKILL_SEQUENCE_IDS)[number];

/**
 * Active command identifiers may use a dedicated gameplay presentation while
 * legacy authored strips remain addressable through LordAlphaSkillSequenceId.
 */
export type LordAlphaSkillActionId =
  | Exclude<LordAlphaSkillSequenceId, "tharthareon-fireball">
  | "afterimage-step"
  | "equip";

export type LordAlphaSkillSequenceAssetSuffix =
  `skins/lord-alpha/skill-sequences/${LordAlphaSkillSequenceId}${"" | `-v${number}`}.png`;

/** Current authored target. The renderer accepts other positive frame counts. */
export const LORD_ALPHA_SKILL_SEQUENCE_FRAME_COUNT = 8 as const;
export const LORD_ALPHA_SKILL_SEQUENCE_FRAME_WIDTH = 240 as const;
export const LORD_ALPHA_SKILL_SEQUENCE_FRAME_HEIGHT = 160 as const;
/** Full visual charge: brace, traverse every cell, impact, return, recover. */
export const LORD_ALPHA_ROC_CHARGE_DURATION_MS = 1_800;
/** Approved twelve-pose spin played when R2 branches an active Roc charge. */
export const LORD_ALPHA_ROC_BRANCH_SPIN_DURATION_MS = 1_010;
/** Recoil begins after idle, extension, and brace frames in the Fireball strip. */
export const LORD_ALPHA_THARTHAREON_FIREBALL_RELEASE_MS = 550 + 160 + 180;

export interface LordAlphaFrameSequenceAssetManifest {
  readonly id: string;
  readonly suffix: string;
  readonly frameCount: number;
  readonly frameWidth: typeof LORD_ALPHA_SKILL_SEQUENCE_FRAME_WIDTH;
  readonly frameHeight: typeof LORD_ALPHA_SKILL_SEQUENCE_FRAME_HEIGHT;
  /** Per-frame display holds, in source-cell order. */
  readonly frameHoldMs: readonly number[];
  /** Zero-based representative frame shown when reduced motion is requested. */
  readonly reducedMotionFrame: number;
  /** Body animation only; the event and its VFX retain their canonical lifetime. */
  readonly durationMs: number;
}

/**
 * Body strips share the same 240x160 source cells, but a handful of generated
 * sheets were authored with a smaller skeleton inside those cells. The base
 * gauge and source-space foot root stay immutable; an explicitly authored,
 * discrete correction track may compensate cells generated at another gauge.
 */
export interface LordAlphaActorFrameSequenceAssetManifest
  extends LordAlphaFrameSequenceAssetManifest {
  readonly actorScale: number;
  readonly actorRootY: number;
  /**
   * Optional discrete gauge corrections for authored cells whose skeleton was
   * rendered at inconsistent sizes. These are applied around the actor root;
   * they never interpolate and never alter gameplay coordinates or hitboxes.
   */
  readonly frameScales?: readonly number[];
}

export interface LordAlphaSkillSequenceAssetManifest
  extends LordAlphaActorFrameSequenceAssetManifest {
  readonly id: LordAlphaSkillSequenceId;
  readonly suffix: LordAlphaSkillSequenceAssetSuffix;
}

/**
 * ImageGen-authored Supreme-form action strips. Sources use adjacent 240x160
 * frames; most contain eight, while Fireball and the Ninjato phase slice use
 * their own authored frame counts.
 * They are presentation-only and deliberately
 * omit the Roc Wing so the independent anatomical-left attachment remains
 * authoritative when the body is mirrored. Equip uses the same authored
 * frame-strip path so its construction is visible rather than a sprite swap.
 */
export const LORD_ALPHA_SKILL_SEQUENCE_ASSETS = {
  "web-shot": {
    id: "web-shot",
    suffix: "skins/lord-alpha/skill-sequences/web-shot-v14.png",
    frameCount: 8,
    frameWidth: 240,
    frameHeight: 160,
    frameHoldMs: [70, 70, 60, 60, 70, 90, 100, 120],
    reducedMotionFrame: 3,
    durationMs: 640,
    actorScale: 1,
    actorRootY: 148,
  },
  grapple: {
    id: "grapple",
    suffix: "skins/lord-alpha/skill-sequences/grapple-v14.png",
    frameCount: 8,
    frameWidth: 240,
    frameHeight: 160,
    frameHoldMs: [80, 70, 70, 80, 110, 110, 90, 90],
    reducedMotionFrame: 4,
    durationMs: 700,
    actorScale: 1,
    actorRootY: 148,
  },
  "roc-stun": {
    id: "roc-stun",
    suffix: "skins/lord-alpha/skill-sequences/roc-stun-v15.png",
    frameCount: 8,
    frameWidth: 240,
    frameHeight: 160,
    frameHoldMs: [140, 130, 140, 180, 420, 420, 210, 160],
    reducedMotionFrame: 3,
    durationMs: LORD_ALPHA_ROC_CHARGE_DURATION_MS,
    actorScale: 1,
    actorRootY: 153,
  },
  "dimensional-net": {
    id: "dimensional-net",
    suffix: "skins/lord-alpha/skill-sequences/dimensional-net-v14.png",
    frameCount: 8,
    frameWidth: 240,
    frameHeight: 160,
    frameHoldMs: [90, 90, 90, 100, 120, 120, 90, 100],
    reducedMotionFrame: 5,
    durationMs: 800,
    actorScale: 1,
    actorRootY: 148,
  },
  "wormhole-step": {
    id: "wormhole-step",
    // Keep the actor-focused strip here; the authored portal is rendered by
    // LordAlphaVfx. The v14 composite fit both layers into one cell and made
    // LASI visibly shrink whenever the portal widened.
    suffix: "skins/lord-alpha/skill-sequences/wormhole-step-v11.png",
    frameCount: 8,
    frameWidth: 240,
    frameHeight: 160,
    frameHoldMs: [80, 80, 90, 100, 90, 100, 100, 120],
    reducedMotionFrame: 5,
    durationMs: 760,
    actorScale: 1,
    actorRootY: 153,
    frameScales: [1, 1, 1.28, 0.92, 0.9, 1.13, 1.01, 1],
  },
  "shadow-clone": {
    id: "shadow-clone",
    // Clone construction has its own effect layer. This strip preserves the
    // player's skeleton scale instead of fitting both bodies into one frame.
    suffix: "skins/lord-alpha/skill-sequences/shadow-clone-v11.png",
    frameCount: 8,
    frameWidth: 240,
    frameHeight: 160,
    frameHoldMs: [90, 100, 110, 120, 140, 160, 120, 120],
    reducedMotionFrame: 6,
    durationMs: 960,
    actorScale: 1,
    actorRootY: 153,
    frameScales: [1, 1.01, 1.02, 1.09, 0.96, 1.02, 1.03, 1],
  },
  "ninjato-phase-slice": {
    id: "ninjato-phase-slice",
    suffix: "skins/lord-alpha/skill-sequences/ninjato-phase-slice-v1.png",
    frameCount: 10,
    frameWidth: 240,
    frameHeight: 160,
    frameHoldMs: [240, 90, 180, 50, 50, 60, 280, 60, 90, 320],
    reducedMotionFrame: 6,
    durationMs: 1_420,
    actorScale: 1.13,
    actorRootY: 152,
    frameScales: [1.01, 1.01, 1.04, 0.84, 0.84, 0.84, 1.05, 1.05, 1.04, 1.04],
  },
  "ninjato-back-thrust": {
    id: "ninjato-back-thrust",
    suffix: "skins/lord-alpha/skill-sequences/ninjato-back-thrust-v1.png",
    frameCount: 8,
    frameWidth: 240,
    frameHeight: 160,
    frameHoldMs: [90, 60, 55, 55, 100, 140, 70, 90],
    reducedMotionFrame: 5,
    durationMs: 660,
    actorScale: 1,
    actorRootY: 152,
  },
  tharthareon: {
    id: "tharthareon",
    // The portal and creature live in LordAlphaVfx. This actor-only recoil
    // strip keeps LASI at one gauge instead of growing with the portal art.
    suffix: "skins/lord-alpha/skill-sequences/tharthareon-v13.png",
    frameCount: 7,
    frameWidth: 240,
    frameHeight: 160,
    frameHoldMs: [150, 130, 140, 160, 140, 130, 130],
    reducedMotionFrame: 3,
    durationMs: 980,
    actorScale: 1.39,
    actorRootY: 153,
  },
  "tharthareon-fireball": {
    id: "tharthareon-fireball",
    // Tap Fireball alone uses LASI's stabilized left-arm brace and recoil.
    // Headbutt, Hold Bite, and ordinary emergence retain the canonical strip.
    suffix: "skins/lord-alpha/skill-sequences/tharthareon-fireball-v15.png",
    frameCount: 7,
    frameWidth: 240,
    frameHeight: 160,
    frameHoldMs: [550, 160, 180, 240, 180, 160, 550],
    reducedMotionFrame: 3,
    durationMs: 2_020,
    actorScale: 1.39,
    actorRootY: 153,
  },
  "millennium-dragon": {
    id: "millennium-dragon",
    // The board-sized dragon manifestation is rendered separately. Retaining
    // its composite in this actor strip compressed LASI to half height.
    suffix: "skins/lord-alpha/skill-sequences/millennium-dragon-v11.png",
    frameCount: 8,
    frameWidth: 240,
    frameHeight: 160,
    frameHoldMs: [110, 120, 130, 150, 170, 180, 110, 130],
    reducedMotionFrame: 6,
    durationMs: 1_100,
    actorScale: 1.35,
    actorRootY: 153,
    frameScales: [1.15, 1.18, 0.97, 0.91, 1.11, 1.23, 1.11, 1.15],
  },
  equip: {
    id: "equip",
    suffix: "skins/lord-alpha/skill-sequences/equip-v14.png",
    frameCount: 8,
    frameWidth: 240,
    frameHeight: 160,
    frameHoldMs: [70, 70, 80, 90, 100, 110, 90, 110],
    reducedMotionFrame: 7,
    durationMs: 720,
    actorScale: 1,
    actorRootY: 148,
  },
} as const satisfies Record<
  LordAlphaSkillSequenceId,
  LordAlphaSkillSequenceAssetManifest
>;

/**
 * The Roc Wing is authored independently from the body so facing changes can
 * move the same singular attachment to anatomical left without baking a
 * second wing into the mirrored character strip.
 */
export const LORD_ALPHA_ROC_WING_THRUST_SEQUENCE = {
  id: "roc-wing-thrust",
  suffix: "skins/lord-alpha/attachments/roc-wing-thrust-v19.png",
  frameCount: 8,
  frameWidth: 240,
  frameHeight: 160,
  frameHoldMs: [140, 130, 140, 180, 420, 420, 210, 160],
  reducedMotionFrame: 4,
  durationMs: LORD_ALPHA_ROC_CHARGE_DURATION_MS,
} as const satisfies LordAlphaFrameSequenceAssetManifest;

/**
 * R2-only Roc branch body choreography. The celestial wing remains an
 * independent anatomical-left attachment while this body strip rotates.
 */
export const LORD_ALPHA_ROC_WING_SPIN_SEQUENCE = {
  id: "roc-wing-spin",
  suffix: "skins/lord-alpha/skill-sequences/roc-wing-spin-v1.png",
  frameCount: 12,
  frameWidth: 240,
  frameHeight: 160,
  frameHoldMs: [150, 70, 55, 55, 55, 55, 55, 55, 65, 105, 50, 240],
  reducedMotionFrame: 9,
  durationMs: LORD_ALPHA_ROC_BRANCH_SPIN_DURATION_MS,
  actorScale: 1.18,
  actorRootY: 148,
  frameScales: [1.16, 1.35, 1.16, 1.13, 1.14, 1.01, 1.01, 1.04, 1.05, 1.31, 0.99, 0.97],
} as const satisfies LordAlphaActorFrameSequenceAssetManifest;

export const LORD_ALPHA_EFFECT_SEQUENCE_IDS = [
  "web-shot",
  "grapple",
  "grapple-orb",
  "roc-stun",
  "dimensional-net",
  "wormhole-step",
  "shadow-clone",
  "tharthareon",
  "millennium-dragon",
  "equip-latency",
] as const;

export type LordAlphaEffectSequenceId =
  (typeof LORD_ALPHA_EFFECT_SEQUENCE_IDS)[number];

export type LordAlphaEffectSequencePlacement =
  | "travel"
  | "target"
  | "dual"
  | "origin"
  | "board";

export interface LordAlphaEffectSequenceAssetManifest {
  readonly id: LordAlphaEffectSequenceId;
  /**
   * Most strips use their sequence id as the filename. Composite effects may
   * name an isolated authored layer instead (for example, Tharthareon's body
   * lunge is rendered independently from its fixed portal).
   */
  readonly suffix: `effects/lord-alpha/sequences/${string}-v${number}.png`;
  readonly frameCount: typeof LORD_ALPHA_SKILL_SEQUENCE_FRAME_COUNT;
  readonly frameWidth: typeof LORD_ALPHA_SKILL_SEQUENCE_FRAME_WIDTH;
  readonly frameHeight: typeof LORD_ALPHA_SKILL_SEQUENCE_FRAME_HEIGHT;
  readonly reducedMotionFrame: number;
  readonly placement: LordAlphaEffectSequencePlacement;
  /** Width relative to the shorter VFX surface dimension. */
  readonly spanScale: number;
}

/**
 * Legacy v24 connector manifest retained only so old saves/build artifacts can
 * still resolve their cached URL. The v27 renderer does not draw this layer:
 * its stretched spine was the stray segment visible beneath the old head.
 */
export const LORD_ALPHA_THARTHAREON_BODY_BITE_SEQUENCE_ASSET = {
  suffix: "effects/lord-alpha/sequences/tharthareon-headless-connector-v24.png",
  frameCount: 8,
  frameWidth: 240,
  frameHeight: 160,
  rootAnchorX: 6,
  contactAnchorXByFrame: [93, 95, 118, 168, 141, 226, 232, 233],
} as const;

/**
 * A rigid, uniformly scaled armored body emerging from the fixed portal. Each
 * complete body frame banks around the portal anchor with the head; no body
 * fragment is flipped, stretched, or rendered independently as a loose plug.
 */
export const LORD_ALPHA_THARTHAREON_ARMORED_BODY_SEQUENCE_ASSET = {
  suffix: "effects/lord-alpha/sequences/tharthareon-left-roll-body-v26.png",
  frameCount: 8,
  frameWidth: 320,
  frameHeight: 192,
  portalAnchorXByFrame: [16, 16, 16, 16, 16, 16, 16, 16],
  portalAnchorYByFrame: [96, 96, 96, 96, 96, 96, 96, 96],
  neckAnchorXByFrame: [112, 148, 150, 171, 177, 191, 213, 214],
  neckAnchorYByFrame: [96, 96, 91, 85, 76, 65, 54, 54],
  axialRollDegreesByFrame: [0, 0, 18, 32, 46, 50, 50, 50],
  /** Target full-size body height in board cells. */
  spanScaleByFrame: [0.5, 0.7, 0.92, 1.18, 1.4, 1.58, 1.72, 1.72],
} as const;

/**
 * Eight right-facing, single-eye head-and-neck poses. The visible cheek banks
 * down through authored perspective views while the muzzle remains on the
 * horizontal carrier. F6 and F7 share the terminal bank and differ only by
 * open bite versus closed clamp. No frame is vertically flipped or squashed.
 */
export const LORD_ALPHA_THARTHAREON_ROLL_HEAD_SEQUENCE_ASSET = {
  suffix: "effects/lord-alpha/sequences/tharthareon-left-roll-head-v26.png",
  frameCount: 8,
  frameWidth: 256,
  frameHeight: 192,
  mouthAnchorXByFrame: [239, 239, 239, 239, 239, 239, 239, 239],
  mouthAnchorYByFrame: [127, 127, 127, 127, 127, 127, 127, 127],
  displayRotationRadiansByFrame: [0, 0, 0, 0, 0, 0, 0, 0],
  /**
   * Authored axial roll around the neck-to-snout axis, not a flat canvas cant.
   * Positive values encode the requested opposite roll direction. They are
   * descriptive/testable metadata; the perspective change lives in pixels.
   */
  axialRollDegreesByFrame: [0, 0, 18, 32, 46, 50, 50, 50],
  sourceFrameByBodyFrame: [0, 1, 2, 3, 4, 5, 6, 7],
  scaleByBodyFrame: [0.52, 0.58, 0.64, 0.72, 0.82, 0.92, 1, 1],
} as const;

/**
 * V29 locks complete upright and fully side-rolled views of one connected
 * creature. It turns edge-on around the neck-to-snout axis before expanding
 * into the rolled view; the renderer never rotates the canvas or joins
 * independently scaled head, neck, torso, or forelimb rasters.
 */
export const LORD_ALPHA_THARTHAREON_CONNECTED_BITE_SEQUENCE_ASSET = {
  suffix: "effects/lord-alpha/sequences/tharthareon-left-roll-connected-v29.png",
  frameCount: 8,
  frameWidth: 384,
  frameHeight: 256,
  mouthAnchorXByFrame: [376, 376, 376, 376, 376, 376, 376, 376],
  mouthAnchorYByFrame: [128, 128, 128, 128, 128, 128, 128, 128],
  axialRollDegreesByFrame: [0, 5, 20, 40, 60, 75, 90, 90],
  /** Target connected-creature height in board cells. */
  displayHeightCells: 2.1,
} as const;

/**
 * Hold-only Tharthareon emergence supplied by the user. The thirteen authored
 * poses are a single, portal-free creature layer: transparent anticipation,
 * head-first emergence, anatomical-left body roll, open bite, then clamp.
 * The wormhole is rendered independently behind this strip so its rim can
 * never become attached to Tharthareon's neck.
 */
export const LORD_ALPHA_THARTHAREON_HOLD_BITE_SEQUENCE_ASSET = {
  suffix: "effects/lord-alpha/sequences/tharthareon-hold-emerge-midroll-bite-v2.png",
  frameCount: 13,
  frameWidth: 592,
  frameHeight: 376,
  /** Mobile-safe row-major atlas; neither texture dimension exceeds 4096. */
  atlasColumns: 4,
  atlasRows: 4,
  frameHoldMs: [240, 90, 90, 90, 100, 110, 110, 110, 110, 100, 100, 110, 580],
  durationMs: 1_940,
  /** Frames 0..8 carry the approach and arrive with the jaw fully open. */
  travelFrameCount: 9,
  travelDurationMs: 1_050,
  terminalOpenFrame: 8,
  terminalClosingFrame: 9,
  terminalFrame: 12,
  rootAnchorX: 76.5,
  rootAnchorY: 192,
  mouthAnchorXByFrame: [
    76.5, 79, 139, 199, 259, 293, 343, 389, 439, 477, 517, 551, 581,
  ],
  mouthAnchorYByFrame: [
    192, 171, 171, 171, 171, 190, 190, 188, 188, 204, 204, 175, 175,
  ],
  axialRollDegreesByFrame: [0, 0, 0, 0, 0, 25, 25, 55, 55, 75, 75, 90, 90],
  /** Scales the terminal mouth to the existing three-cell carrier extent. */
  displayHeightCells: 2.236,
  portalBaked: false,
  loopDuringHold: false,
  playback: "play-once-then-hold-terminal-frame",
} as const;

/**
 * Original nine-pose headbutt strip retained for the normal/legacy profile.
 * The solid animation lab selects the denser atlas below without changing the
 * default game's established timing or source sampling.
 */
export const LORD_ALPHA_THARTHAREON_HEADBUTT_LEGACY_SEQUENCE_ASSET = {
  suffix: "effects/lord-alpha/sequences/tharthareon-doubletap-forehead-headbutt-v6.png",
  frameCount: 9,
  frameWidth: 448,
  frameHeight: 256,
  atlasColumns: 9,
  atlasRows: 1,
  frameHoldMs: [140, 210, 180, 130, 110, 120, 80, 160, 200],
  durationMs: 1_330,
  rootAnchorX: 56.3333333333,
  rootAnchorY: 128,
  displayHeightCells: 2.18,
} as const;

/**
 * Portal-free, one-shot creature layer for the double-tap forehead headbutt.
 * The fixed root anchor sits on the independently rendered wormhole, so no
 * portal pixels can move with (or appear attached to) Tharthareon's neck.
 * This denser atlas is opt-in through the solid animation profile.
 */
export const LORD_ALPHA_THARTHAREON_HEADBUTT_SEQUENCE_ASSET = {
  suffix: "effects/lord-alpha/sequences/tharthareon-doubletap-forehead-headbutt-v7-atlas-5x5.png",
  frameCount: 25,
  frameWidth: 448,
  frameHeight: 256,
  /** Mobile-safe row-major atlas containing every cleaned authored pose. */
  atlasColumns: 5,
  atlasRows: 5,
  frameHoldMs: [
    140, 60, 50, 50, 50, 50, 60, 70, 50, 40, 40, 40, 30,
    40, 80, 40, 40, 40, 40, 40, 40, 40, 50, 50, 100,
  ],
  durationMs: 1_330,
  rootAnchorX: 56.3333333333,
  rootAnchorY: 128,
  /** Maps the impact forehead almost exactly three board cells from the root. */
  displayHeightCells: 2.18,
} as const;

/**
 * Portal-free projectile sampled from the supplied tap-fireball animation.
 * Board movement is simulation-owned, so the projectile remains present until
 * ordinary collision or board-exit logic resolves it.
 */
export const LORD_ALPHA_THARTHAREON_FIREBALL_PROJECTILE_ASSET = {
  suffix: "effects/lord-alpha/sequences/tharthareon-tap-fireball-projectile-v2.png",
  frameCount: 1,
  frameWidth: 320,
  frameHeight: 160,
  displayWidthCells: 1.18,
} as const;

export const LORD_ALPHA_THARTHAREON_PORTAL_SEQUENCE_ASSET = {
  suffix: "effects/lord-alpha/sequences/tharthareon-fixed-portal-v19.png",
  frameCount: 8,
  frameWidth: 240,
  frameHeight: 160,
} as const;

/**
 * ImageGen-authored, effect-only strips. These animate independently at their
 * board-space origin/target so player frames never need to grow beyond a tile.
 */
export const LORD_ALPHA_EFFECT_SEQUENCE_ASSETS = {
  "web-shot": {
    id: "web-shot",
    suffix: "effects/lord-alpha/sequences/web-shot-v16.png",
    frameCount: 8,
    frameWidth: 240,
    frameHeight: 160,
    reducedMotionFrame: 5,
    placement: "travel",
    spanScale: 0.38,
  },
  grapple: {
    id: "grapple",
    suffix: "effects/lord-alpha/sequences/grapple-v18.png",
    frameCount: 8,
    frameWidth: 240,
    frameHeight: 160,
    reducedMotionFrame: 4,
    placement: "travel",
    spanScale: 0.46,
  },
  "grapple-orb": {
    id: "grapple-orb",
    suffix: "effects/lord-alpha/sequences/grapple-orb-v18.png",
    frameCount: 8,
    frameWidth: 240,
    frameHeight: 160,
    reducedMotionFrame: 4,
    placement: "target",
    spanScale: 0.3,
  },
  "roc-stun": {
    id: "roc-stun",
    suffix: "effects/lord-alpha/sequences/roc-stun-v18.png",
    frameCount: 8,
    frameWidth: 240,
    frameHeight: 160,
    reducedMotionFrame: 6,
    placement: "target",
    spanScale: 0.32,
  },
  "dimensional-net": {
    id: "dimensional-net",
    suffix: "effects/lord-alpha/sequences/dimensional-net-v15.png",
    frameCount: 8,
    frameWidth: 240,
    frameHeight: 160,
    reducedMotionFrame: 5,
    placement: "target",
    spanScale: 0.42,
  },
  "wormhole-step": {
    id: "wormhole-step",
    suffix: "effects/lord-alpha/sequences/wormhole-step-v15.png",
    frameCount: 8,
    frameWidth: 240,
    frameHeight: 160,
    reducedMotionFrame: 4,
    placement: "dual",
    spanScale: 0.46,
  },
  "shadow-clone": {
    id: "shadow-clone",
    suffix: "effects/lord-alpha/sequences/shadow-clone-v16.png",
    frameCount: 8,
    frameWidth: 240,
    frameHeight: 160,
    reducedMotionFrame: 5,
    placement: "origin",
    spanScale: 0.62,
  },
  tharthareon: {
    id: "tharthareon",
    ...LORD_ALPHA_THARTHAREON_PORTAL_SEQUENCE_ASSET,
    reducedMotionFrame: 6,
    placement: "origin",
    spanScale: 0.52,
  },
  "millennium-dragon": {
    id: "millennium-dragon",
    suffix: "effects/lord-alpha/sequences/millennium-dragon-v16.png",
    frameCount: 8,
    frameWidth: 240,
    frameHeight: 160,
    reducedMotionFrame: 6,
    placement: "board",
    spanScale: 1.02,
  },
  "equip-latency": {
    id: "equip-latency",
    suffix: "effects/lord-alpha/sequences/equip-latency-v16.png",
    frameCount: 8,
    frameWidth: 240,
    frameHeight: 160,
    reducedMotionFrame: 6,
    placement: "origin",
    spanScale: 0.5,
  },
} as const satisfies Record<
  LordAlphaEffectSequenceId,
  LordAlphaEffectSequenceAssetManifest
>;

/**
 * Each combo beat owns a coherent ImageGen-authored body timeline. Keeping
 * these separate prevents Quick, Web, Power, Roc, and Finisher from replaying
 * one unrelated pose collage while their gameplay remains unchanged.
 */
export const LORD_ALPHA_ATTACK_SEQUENCE_ASSETS = {
  quick: {
    id: "supreme-combo-quick",
    suffix: "skins/lord-alpha/attack-sequences/supreme-combo-quick-v13.png",
    frameCount: 8,
    frameWidth: 240,
    frameHeight: 160,
    frameHoldMs: [42, 38, 30, 18, 42, 36, 34, 40],
    reducedMotionFrame: 4,
    durationMs: 280,
    actorScale: 1,
    actorRootY: 153,
  },
  web: {
    id: "supreme-combo-web",
    suffix: "skins/lord-alpha/attack-sequences/supreme-combo-web-v11.png",
    frameCount: 8,
    frameWidth: 240,
    frameHeight: 160,
    frameHoldMs: [48, 44, 32, 20, 44, 32, 36, 44],
    reducedMotionFrame: 4,
    durationMs: 300,
    actorScale: 1,
    actorRootY: 153,
  },
  power: {
    id: "supreme-combo-power",
    suffix: "skins/lord-alpha/attack-sequences/supreme-combo-power-v11.png",
    frameCount: 8,
    frameWidth: 240,
    frameHeight: 160,
    frameHoldMs: [50, 42, 32, 22, 48, 42, 40, 44],
    reducedMotionFrame: 4,
    durationMs: 320,
    actorScale: 1,
    actorRootY: 153,
  },
  roc: {
    id: "supreme-combo-roc",
    suffix: "skins/lord-alpha/attack-sequences/supreme-combo-roc-v11.png",
    frameCount: 8,
    frameWidth: 240,
    frameHeight: 160,
    frameHoldMs: [52, 44, 36, 22, 50, 42, 40, 44],
    reducedMotionFrame: 4,
    durationMs: 330,
    actorScale: 1.18,
    actorRootY: 153,
    frameScales: [1.28, 1.21, 0.87, 1.07, 0.99, 1.29, 1.26, 1.1],
  },
  finisher: {
    id: "supreme-combo-finisher",
    suffix: "skins/lord-alpha/attack-sequences/supreme-combo-finisher-v11.png",
    frameCount: 8,
    frameWidth: 240,
    frameHeight: 160,
    frameHoldMs: [52, 44, 36, 22, 50, 42, 40, 44],
    reducedMotionFrame: 4,
    durationMs: 330,
    actorScale: 1.08,
    actorRootY: 153,
  },
} as const satisfies Record<LordAlphaComboBeat, LordAlphaActorFrameSequenceAssetManifest>;

/** Backward-compatible default for consumers which do not yet supply a beat. */
export const LORD_ALPHA_ATTACK_SEQUENCE_ASSET = LORD_ALPHA_ATTACK_SEQUENCE_ASSETS.quick;

/**
 * Pixel-exact shuriken cutout inside the authored Quick attack strip.
 *
 * The projectile renderer samples this rectangle from the same bitmap used by
 * the body animation. Keeping the crop frame-relative makes that identity
 * explicit and prevents a separately drawn icon from drifting away from the
 * weapon visible at release.
 */
export const LORD_ALPHA_SHURIKEN_PROJECTILE_SOURCE = {
  suffix: LORD_ALPHA_ATTACK_SEQUENCE_ASSETS.quick.suffix,
  frameIndex: 4,
  x: 174,
  y: 25,
  width: 36,
  height: 36,
} as const;

export function resolveLordAlphaAttackSequence(
  beat: LordAlphaComboBeat | null | undefined,
): LordAlphaActorFrameSequenceAssetManifest {
  return LORD_ALPHA_ATTACK_SEQUENCE_ASSETS[beat ?? "quick"];
}

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
 * Skill events may outlive their body sequence so the authored recovery pose
 * remains readable at gameplay scale without gating controls.
 */
export const LORD_ALPHA_EVENT_TIMINGS_MS = {
  move: 330,
  web: 1_040,
  wormhole: 1_160,
  tharthareon: 2_020,
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
  "roc-stun": LORD_ALPHA_ROC_CHARGE_DURATION_MS,
  "dimensional-net": 1_320,
} as const;

export const LORD_ALPHA_ROC_CHARGE_PHASES = {
  chargeEnd: 0.18,
  outboundEnd: 0.50,
  impactEnd: 0.62,
  returnEnd: 0.90,
} as const;

export interface LordAlphaRocChargeCell {
  readonly col: number;
  readonly row: number;
}

export type LordAlphaRocChargePhase =
  | "charge"
  | "outbound"
  | "impact"
  | "return"
  | "recovered";

export interface LordAlphaRocChargePose extends LordAlphaRocChargeCell {
  readonly phase: LordAlphaRocChargePhase;
  readonly cellIndex: number;
}

export interface LordAlphaRocBranchRoute {
  readonly cells: readonly LordAlphaRocChargeCell[];
  readonly turnIndex: number;
}

const normalizeRocChargeCell = (
  cell: LordAlphaRocChargeCell,
): LordAlphaRocChargeCell => ({
  col: Math.min(5, Math.max(0, Math.round(Number.isFinite(cell.col) ? cell.col : 0))),
  row: Math.min(2, Math.max(0, Math.round(Number.isFinite(cell.row) ? cell.row : 0))),
});

/**
 * Produce a cell-complete out-and-back route without moving gameplay state.
 * LASI first aligns vertically, then drives forward through every column; the
 * return half is the exact reverse so the visual finishes on its source tile.
 */
export function buildLordAlphaRocChargeCells(
  originCell: LordAlphaRocChargeCell,
  targetCell: LordAlphaRocChargeCell,
): readonly LordAlphaRocChargeCell[] {
  const origin = normalizeRocChargeCell(originCell);
  const target = normalizeRocChargeCell(targetCell);
  const outbound: LordAlphaRocChargeCell[] = [{ ...origin }];
  let row = origin.row;
  while (row !== target.row) {
    row += Math.sign(target.row - row);
    outbound.push({ col: origin.col, row });
  }
  let col = origin.col;
  while (col !== target.col) {
    col += Math.sign(target.col - col);
    outbound.push({ col, row: target.row });
  }
  return [
    ...outbound,
    ...outbound.slice(0, -1).reverse().map((cell) => ({ ...cell })),
  ];
}

/** Legal one-lane destinations, ordered Up then Down. No edge wrapping. */
export function lordAlphaRocBranchCandidateRows(originRow: number): readonly number[] {
  const row = Math.min(2, Math.max(0, Math.round(Number.isFinite(originRow) ? originRow : 0)));
  return [row - 1, row + 1].filter((candidate) => candidate >= 0 && candidate <= 2);
}

/** R2 must arm the branch before LASI reaches the outbound apex. */
export function canArmLordAlphaRocBranch(progress: number): boolean {
  return Number.isFinite(progress)
    && progress >= 0
    && progress <= LORD_ALPHA_ROC_CHARGE_PHASES.outboundEnd;
}

/** Directional intent remains editable through the held apex/impact beat. */
export function canQueueLordAlphaRocBranchLane(progress: number): boolean {
  return Number.isFinite(progress)
    && progress >= 0
    && progress <= LORD_ALPHA_ROC_CHARGE_PHASES.impactEnd;
}

/**
 * A confirmed single R2 turns Roc Wing's otherwise non-damaging charge into
 * one impact at the forward apex. Double/triple taps reserve that input for
 * their sword move, so they leave impactEnabled false. Marking the impact
 * before applying effects keeps a long apex hold from dealing damage on every
 * simulation sample.
 */
export function shouldResolveLordAlphaRocBranchImpact(
  branchActive: boolean,
  impactEnabled: boolean,
  impactApplied: boolean,
  progress: number,
): boolean {
  return branchActive
    && impactEnabled
    && !impactApplied
    && Number.isFinite(progress)
    && progress >= LORD_ALPHA_ROC_CHARGE_PHASES.outboundEnd;
}

/** The branch lane changes recovery only; collision remains at the R1 apex. */
export function isLordAlphaRocBranchImpactContact(
  target: LordAlphaRocChargeCell,
  current: LordAlphaRocChargeCell,
  columnTolerance = 0.6,
): boolean {
  if (![target.col, target.row, current.col, current.row, columnTolerance]
    .every(Number.isFinite)) return false;
  return current.row === target.row
    && Math.abs(current.col - target.col) <= Math.max(0, columnTolerance);
}

/**
 * Capture the pane immediately above or below LASI at the instant directional
 * intent is sampled. Callers retain this value instead of recomputing it as
 * the charge advances, so the red lane marker cannot drift toward the apex.
 */
export function resolveLordAlphaRocBranchHighlightCell(
  cells: readonly LordAlphaRocChargeCell[],
  progress: number,
  turnIndex: number,
  verticalDirection: number,
): LordAlphaRocChargeCell | null {
  const direction = Math.sign(verticalDirection);
  if (direction === 0 || cells.length === 0) return null;
  const pose = resolveLordAlphaRocChargePose(cells, progress, turnIndex);
  const occupied = cells[pose.cellIndex] ?? pose;
  const col = Math.min(5, Math.max(0, Math.round(occupied.col)));
  const row = Math.round(occupied.row) + direction;
  if (row < 0 || row > 2) return null;
  return { col, row };
}

/**
 * Preserve the complete outbound charge. On recovery, reach the selected
 * pane's column in the original lane and turn into that pane. A pane on LASI's
 * 0..2 half becomes his landing cell; an enemy-side pane remains a visual turn
 * point and carries the new lane safely home. The explicit turn index keeps
 * the asymmetric return route sampleable.
 */
export function branchLordAlphaRocChargeCells(
  baseCells: readonly LordAlphaRocChargeCell[],
  destination: LordAlphaRocChargeCell,
): LordAlphaRocBranchRoute {
  const safeCells = baseCells.length > 0
    ? baseCells.map(normalizeRocChargeCell)
    : [{ col: 0, row: 0 }];
  const turnIndex = Math.floor(safeCells.length / 2);
  const origin = safeCells[0];
  const outbound = safeCells.slice(0, turnIndex + 1);
  const apex = outbound[outbound.length - 1];
  if (![destination.col, destination.row].every(Number.isFinite)) {
    return { cells: safeCells, turnIndex };
  }
  const normalizedDestination = normalizeRocChargeCell(destination);

  const recovery: LordAlphaRocChargeCell[] = [];
  let col = apex.col;
  let row = apex.row;
  // Retrace the original lane until LASI reaches the selected pane's column.
  while (col !== normalizedDestination.col) {
    col += Math.sign(normalizedDestination.col - col);
    recovery.push({ col, row });
  }
  // Turn into the highlighted pane at its actual board position.
  while (row !== normalizedDestination.row) {
    row += Math.sign(normalizedDestination.row - row);
    recovery.push({ col, row });
  }
  // Global columns 0..2 are LASI's legal player grid. Ending the visual route
  // here lets the existing completion handler commit this exact highlighted
  // pane without a snap or a second movement animation.
  if (normalizedDestination.col <= 2) {
    return {
      cells: [...outbound, ...recovery],
      turnIndex: outbound.length - 1,
    };
  }
  // Continue home through the newly selected lane.
  while (col !== origin.col) {
    col += Math.sign(origin.col - col);
    recovery.push({ col, row });
  }

  return {
    cells: [...outbound, ...recovery],
    turnIndex: outbound.length - 1,
  };
}

function sampleRocChargeLeg(
  cells: readonly LordAlphaRocChargeCell[],
  startIndex: number,
  endIndex: number,
  progress: number,
  phase: "outbound" | "return",
): LordAlphaRocChargePose {
  const direction = Math.sign(endIndex - startIndex);
  const segmentCount = Math.abs(endIndex - startIndex);
  if (segmentCount === 0) {
    return { ...cells[startIndex], phase, cellIndex: startIndex };
  }
  const bounded = clampTopologyProgress(progress);
  if (bounded >= 1) return { ...cells[endIndex], phase, cellIndex: endIndex };
  const position = bounded * segmentCount;
  const segment = Math.min(segmentCount - 1, Math.floor(position));
  const local = position - segment;
  // Brief center holds make each crossed tile legible at gameplay scale.
  const travel = local <= 0.14
    ? 0
    : local >= 0.86
      ? 1
      : (() => {
        const normalized = (local - 0.14) / 0.72;
        return normalized * normalized * (3 - 2 * normalized);
      })();
  const fromIndex = startIndex + segment * direction;
  const toIndex = fromIndex + direction;
  const from = cells[fromIndex];
  const to = cells[toIndex];
  return {
    col: from.col + (to.col - from.col) * travel,
    row: from.row + (to.row - from.row) * travel,
    phase,
    cellIndex: travel < 0.5 ? fromIndex : toIndex,
  };
}

/** Sample the grid-layer Roc charge while retaining the logical player tile. */
export function resolveLordAlphaRocChargePose(
  cells: readonly LordAlphaRocChargeCell[],
  progress: number,
  explicitTurnIndex?: number,
): LordAlphaRocChargePose {
  const safeCells = cells.length > 0 ? cells : [{ col: 0, row: 0 }];
  const bounded = clampTopologyProgress(progress);
  const turnIndex = Number.isInteger(explicitTurnIndex)
    ? Math.min(safeCells.length - 1, Math.max(0, explicitTurnIndex as number))
    : Math.floor(safeCells.length / 2);
  if (bounded < LORD_ALPHA_ROC_CHARGE_PHASES.chargeEnd) {
    return { ...safeCells[0], phase: "charge", cellIndex: 0 };
  }
  if (bounded <= LORD_ALPHA_ROC_CHARGE_PHASES.outboundEnd) {
    return sampleRocChargeLeg(
      safeCells,
      0,
      turnIndex,
      (bounded - LORD_ALPHA_ROC_CHARGE_PHASES.chargeEnd)
        / (LORD_ALPHA_ROC_CHARGE_PHASES.outboundEnd - LORD_ALPHA_ROC_CHARGE_PHASES.chargeEnd),
      "outbound",
    );
  }
  if (bounded <= LORD_ALPHA_ROC_CHARGE_PHASES.impactEnd) {
    return { ...safeCells[turnIndex], phase: "impact", cellIndex: turnIndex };
  }
  if (bounded < LORD_ALPHA_ROC_CHARGE_PHASES.returnEnd) {
    return sampleRocChargeLeg(
      safeCells,
      turnIndex,
      safeCells.length - 1,
      (bounded - LORD_ALPHA_ROC_CHARGE_PHASES.impactEnd)
        / (LORD_ALPHA_ROC_CHARGE_PHASES.returnEnd - LORD_ALPHA_ROC_CHARGE_PHASES.impactEnd),
      "return",
    );
  }
  return {
    ...safeCells[safeCells.length - 1],
    phase: "recovered",
    cellIndex: safeCells.length - 1,
  };
}

/** True once the return leg has actually entered the highlighted pane. */
export function hasLordAlphaRocReachedBranchPane(
  cells: readonly LordAlphaRocChargeCell[],
  progress: number,
  turnIndex: number,
  selectedCell: LordAlphaRocChargeCell,
): boolean {
  if (cells.length === 0) return false;
  const normalizedSelected = normalizeRocChargeCell(selectedCell);
  const selectedIndex = cells.findIndex((cell, index) => {
    if (index <= turnIndex) return false;
    const normalized = normalizeRocChargeCell(cell);
    return normalized.col === normalizedSelected.col
      && normalized.row === normalizedSelected.row;
  });
  if (selectedIndex < 0) return false;

  const pose = resolveLordAlphaRocChargePose(cells, progress, turnIndex);
  if (pose.phase !== "return" && pose.phase !== "recovered") return false;
  if (pose.cellIndex > selectedIndex) return true;
  return pose.cellIndex === selectedIndex
    && Math.abs(pose.col - normalizedSelected.col) <= 0.001
    && Math.abs(pose.row - normalizedSelected.row) <= 0.001;
}

/** Grapple reaches its radial latch before the target begins crossing a cell. */
export const LORD_ALPHA_GRAPPLE_ATTACH_DELAY_SECONDS = 0.38;
/** A short but readable board-space slide, driven by the simulation clock. */
export const LORD_ALPHA_GRAPPLE_PULL_DURATION_SECONDS = 0.34;
export const LORD_ALPHA_GRAPPLE_PULL_CELLS = 1;

export function resolveLordAlphaGrapplePullColumn(
  targetColumn: number,
  casterColumn: number,
  minimumColumn: number,
  maximumColumn: number,
): number {
  const minimum = Number.isFinite(minimumColumn) ? minimumColumn : 0;
  const maximum = Number.isFinite(maximumColumn)
    ? Math.max(minimum, maximumColumn)
    : minimum;
  const target = Number.isFinite(targetColumn)
    ? Math.min(maximum, Math.max(minimum, targetColumn))
    : minimum;
  if (!Number.isFinite(casterColumn)) return target;
  const distanceToCaster = casterColumn - target;
  if (Math.abs(distanceToCaster) <= Number.EPSILON) return target;
  const displacement = Math.sign(distanceToCaster) * Math.min(
    LORD_ALPHA_GRAPPLE_PULL_CELLS,
    Math.abs(distanceToCaster),
  );
  return Math.min(maximum, Math.max(minimum, target + displacement));
}

export function createLordAlphaGrapplePullMotion(
  targetColumn: number,
  casterColumn: number,
  minimumColumn: number,
  maximumColumn: number,
): GridColumnPullMotion | null {
  const endColumn = resolveLordAlphaGrapplePullColumn(
    targetColumn,
    casterColumn,
    minimumColumn,
    maximumColumn,
  );
  if (!Number.isFinite(targetColumn) || Math.abs(endColumn - targetColumn) <= Number.EPSILON) {
    return null;
  }
  return {
    startColumn: targetColumn,
    endColumn,
    elapsed: 0,
    delay: LORD_ALPHA_GRAPPLE_ATTACH_DELAY_SECONDS,
    duration: LORD_ALPHA_GRAPPLE_PULL_DURATION_SECONDS,
  };
}

export function advanceLordAlphaGrapplePullMotion(
  motion: GridColumnPullMotion,
  deltaSeconds: number,
): { column: number; motion: GridColumnPullMotion | null } {
  const total = Math.max(0, motion.delay) + Math.max(0.001, motion.duration);
  const elapsed = Math.min(total, motion.elapsed + Math.max(0, deltaSeconds));
  const linearProgress = Math.min(
    1,
    Math.max(0, (elapsed - Math.max(0, motion.delay)) / Math.max(0.001, motion.duration)),
  );
  const easedProgress = linearProgress * linearProgress * (3 - 2 * linearProgress);
  const column = motion.startColumn
    + (motion.endColumn - motion.startColumn) * easedProgress;
  return {
    column,
    motion: elapsed >= total ? null : { ...motion, elapsed },
  };
}

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
  "roc-wing-spin",
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
  "tharthareon-fireball",
  "tharthareon-bite-lunge",
  "ultimate-landing",
  "combo-quick",
  "combo-web",
  "combo-power",
  "combo-roc",
  "combo-finisher",
  "ninjato-phase-slice",
  "ninjato-back-thrust",
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
  "ninjato-phase-slice": "ninjato-phase-slice",
  "ninjato-back-thrust": "ninjato-back-thrust",
  "tharthareon-emerge": "tharthareon",
  "tharthareon-fireball": "tharthareon-fireball",
  "tharthareon-bite-lunge": "tharthareon",
  "ultimate-landing": "millennium-dragon",
  "equip-assembly": "equip",
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
      case "equip":
        sequenceId = "equip";
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
  /** Final target position after a board-space displacement such as Grapple. */
  readonly destination?: LordAlphaPresentationAnchor;
}

export interface LordAlphaPresentationEvent {
  readonly kind: LordAlphaPresentationEventKind;
  /** Normalized presentation progress, independent of simulation timing. */
  readonly progress: number;
  readonly subtype?: LordAlphaPresentationSubtype;
  /** Optional normalized source/target positions for target-local VFX. */
  readonly origin?: LordAlphaPresentationAnchor;
  readonly target?: LordAlphaPresentationAnchor;
  readonly destination?: LordAlphaPresentationAnchor;
}

/**
 * Keep the board-collision bite presentation distinct from the legacy full
 * creature emergence used by ordinary Nuke cards and NPC summons.
 */
export function resolveLordAlphaTharthareonPresentationSubtype(
  collisionOwnedAction: boolean | "fireball" | "bite" | "headbutt",
  fallback: LordAlphaPresentationSubtype,
): LordAlphaPresentationSubtype {
  if (!collisionOwnedAction) return fallback;
  return collisionOwnedAction === "fireball"
    ? "tharthareon-fireball"
    : "tharthareon-bite-lunge";
}

export function isLordAlphaCollisionOwnedTharthareon(
  event: LordAlphaPresentationEvent | null | undefined,
): boolean {
  return event?.kind === "tharthareon"
    && (
      event.subtype === "tharthareon-fireball"
      || event.subtype === "tharthareon-bite-lunge"
    );
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

const LORD_ALPHA_EFFECT_SEQUENCE_BY_VFX_MODE: Partial<
  Record<LordAlphaVfxMode, LordAlphaEffectSequenceId>
> = {
  web: "web-shot",
  "web-impact": "web-shot",
  grapple: "grapple",
  "roc-stun": "roc-stun",
  "dimensional-net": "dimensional-net",
  wormhole: "wormhole-step",
  clone: "shadow-clone",
  tharthareon: "tharthareon",
  dragon: "millennium-dragon",
  equip: "equip-latency",
};

/** Resolve one semantic presentation event into its independent board-space strip. */
export function resolveLordAlphaEffectSequence(
  event: LordAlphaPresentationEvent | null | undefined,
): LordAlphaEffectSequenceAssetManifest | null {
  if (!event) return null;
  const sequenceId = LORD_ALPHA_EFFECT_SEQUENCE_BY_VFX_MODE[resolveLordAlphaVfxMode(event)];
  return sequenceId ? LORD_ALPHA_EFFECT_SEQUENCE_ASSETS[sequenceId] : null;
}

export const LORD_ALPHA_ASSETS = {
  skinsRoot: "skins/lord-alpha/",
  effectsRoot: "effects/lord-alpha/",
  forms: LORD_ALPHA_FORMS,
  combo: LORD_ALPHA_COMBO_ASSET_SUFFIXES,
  attackSequence: LORD_ALPHA_ATTACK_SEQUENCE_ASSET,
  attackSequences: LORD_ALPHA_ATTACK_SEQUENCE_ASSETS,
  skillSequences: LORD_ALPHA_SKILL_SEQUENCE_ASSETS,
  rocWingThrustSequence: LORD_ALPHA_ROC_WING_THRUST_SEQUENCE,
  rocWingSpinSequence: LORD_ALPHA_ROC_WING_SPIN_SEQUENCE,
  tharthareonHoldBite: LORD_ALPHA_THARTHAREON_HOLD_BITE_SEQUENCE_ASSET,
  tharthareonFireballProjectile: LORD_ALPHA_THARTHAREON_FIREBALL_PROJECTILE_ASSET,
  effectSequences: LORD_ALPHA_EFFECT_SEQUENCE_ASSETS,
  effects: {
    tharthareon: "effects/lord-alpha/tharthareon.png",
  },
} as const;

/** Bump whenever a Lord Alpha bitmap changes so long-lived mobile tabs reload it. */
export const LORD_ALPHA_ASSET_REVISION = "2026-10-27-frame-normalization-v1";

/** Effects that remain entirely procedural rather than using an authored strip. */
export const LORD_ALPHA_PROCEDURAL_EFFECTS = [
  "move",
] as const satisfies readonly Exclude<
  LordAlphaPresentationEventKind,
  "tharthareon"
>[];

/** Resolve one manifest suffix without coupling this module to import.meta. */
export function lordAlphaAssetUrl(baseUrl: string, suffix: string): string {
  const prefix =
    baseUrl.length === 0 || baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  const path = `${prefix}${suffix.replace(/^\/+/, "")}`;
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}v=${encodeURIComponent(LORD_ALPHA_ASSET_REVISION)}`;
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
  const destination = normalizeLordAlphaAnchor(options.destination);
  return {
    kind,
    progress: clampTopologyProgress(progress),
    ...(options.subtype ? { subtype: options.subtype } : {}),
    ...(origin ? { origin } : {}),
    ...(target ? { target } : {}),
    ...(destination ? { destination } : {}),
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
export const LORD_ALPHA_ANIMATION_QUERY_KEY = "lordAlphaAnimation" as const;

export const LORD_ALPHA_ANIMATION_PROFILES = ["legacy", "solid"] as const;
export type LordAlphaAnimationProfile =
  (typeof LORD_ALPHA_ANIMATION_PROFILES)[number];

export interface LordAlphaHeldTargetVisualPolicy {
  /** Scale used by canvas-rendered campaign enemies and the default VS NPC. */
  readonly canvasScale: number;
  /** Scale used by custom-skin NPCs rendered through the DOM overlay. */
  readonly overlayScale: number;
  /** Optional CSS clip applied only to the custom-skin NPC overlay. */
  readonly overlayClipPath: string | null;
}

/**
 * Presentation-only policy for a target held by Tharthareon. Legacy values
 * preserve the current renderer while the opt-in solid profile keeps the live
 * target at its ordinary size and silhouette.
 */
export const LORD_ALPHA_HELD_TARGET_VISUAL_POLICIES = {
  legacy: {
    canvasScale: 0.56,
    overlayScale: 0.52,
    overlayClipPath: "ellipse(46% 42% at 50% 50%)",
  },
  solid: {
    canvasScale: 1,
    overlayScale: 1,
    overlayClipPath: null,
  },
} as const satisfies Record<
  LordAlphaAnimationProfile,
  LordAlphaHeldTargetVisualPolicy
>;

/**
 * Campaign signatures are part of Lord Alpha's persistent command set, so
 * their availability is not paced by the random-card cooldown economy.
 * Road-fork boss encounters remain campaign play even though they reuse the
 * VS runtime. Only a standalone competitive match keeps shared cooldowns.
 */
export function lordAlphaSignatureUsesCooldown(
  gameMode: "classic" | "vs",
  preview: boolean,
  campaignEncounter = false,
): boolean {
  return !preview && gameMode === "vs" && !campaignEncounter;
}

export interface LordAlphaSkillPreviewAction {
  readonly id: LordAlphaSkillActionId;
  readonly label: string;
  /** Existing live-game mechanic reused by the preview; null is a dedicated presentation path. */
  readonly mechanicId: string | null;
  readonly presentation: LordAlphaCardPresentation;
}

/**
 * Deterministic actions used by the isolated query-gated skill preview.
 * Mapped entries invoke their existing live-game mechanics while reusing the
 * corresponding Lord Alpha presentation; direct entries contain no balance data.
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
    label: "Roc Wing",
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
    id: "afterimage-step",
    label: "Afterimage Step",
    // The player runtime owns its queued teleport. Boss NPCs reuse the
    // competitive backdash counterpart instead of receiving a balance bonus.
    mechanicId: "backdash",
    presentation: cardPresentation("clone", "clone-symmetry"),
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

/**
 * Retired signature commands retained for saves, authored sequence playback,
 * ordinary ability-card presentation, and future migration tools. Archived
 * entries are deliberately excluded from the active three-bank command set.
 */
export const LORD_ALPHA_ARCHIVED_SKILL_ACTIONS = [
  {
    id: "wormhole-step",
    label: "Wormhole Step",
    mechanicId: "warpback",
    presentation: LORD_ALPHA_CARD_PRESENTATIONS.warpback,
  },
] as const satisfies readonly LordAlphaSkillPreviewAction[];

export const LORD_ALPHA_SKILL_BINDINGS = [
  { slot: 0, gamepad: "X", keyboard: "Z" },
  { slot: 1, gamepad: "Y", keyboard: "X" },
  { slot: 2, gamepad: "B", keyboard: "C" },
] as const;

/**
 * LASI's fixed controller shortcuts while the Lord Alpha skill panel is open.
 * These remain independent of the selected touch/keyboard skill bank.
 */
export const LORD_ALPHA_DIRECT_GAMEPAD_ACTIONS = {
  X: "tharthareon",
  B: "web-shot",
  R1: "roc-stun",
  R2: "afterimage-step",
} as const satisfies Record<"X" | "B" | "R1" | "R2", LordAlphaSkillActionId>;

export interface LordAlphaGamepadOwnershipContext {
  isLordAlpha: boolean;
  skillPanelOpen: boolean;
  evolutionSelectionActive?: boolean;
  npcVsNpcActive?: boolean;
}

/**
 * LASI's direct skill mappings own the controller only while the skill panel
 * is open. Closing it restores the standard ability, Evolution, and control
 * layers without changing the authored skill bindings.
 */
export function lordAlphaSkillControlsOwnGamepad({
  isLordAlpha,
  skillPanelOpen,
  evolutionSelectionActive = false,
  npcVsNpcActive = false,
}: LordAlphaGamepadOwnershipContext): boolean {
  return isLordAlpha
    && skillPanelOpen
    && !evolutionSelectionActive
    && !npcVsNpcActive;
}

export const LORD_ALPHA_L2_TAP_WINDOW_MS = 260;
export const LORD_ALPHA_R2_TAP_WINDOW_MS = 260;

export type LordAlphaL2TapCommand =
  | "toggle-skill-panel"
  | "cycle-forward"
  | "cycle-back";

/** Resolve one completed, bounded L2 gesture without firing an ability. */
export function resolveLordAlphaL2TapCommand(
  tapCount: number,
): LordAlphaL2TapCommand | null {
  if (!Number.isFinite(tapCount)) return null;
  const taps = Math.trunc(tapCount);
  if (taps === 1) return "toggle-skill-panel";
  if (taps === 2) return "cycle-forward";
  if (taps === 3) return "cycle-back";
  return null;
}

export type LordAlphaR2TapCommand =
  | "afterimage-step"
  | "ninjato-phase-slice"
  | "ninjato-back-thrust";

export type LordAlphaRocR2TapCommand =
  | "roc-wing-spin"
  | "ninjato-phase-slice"
  | "ninjato-back-thrust";

/** Resolve R2 without firing the single-tap step before a double tap completes. */
export function resolveLordAlphaR2TapCommand(
  tapCount: number,
): LordAlphaR2TapCommand | null {
  if (!Number.isFinite(tapCount)) return null;
  const taps = Math.trunc(tapCount);
  if (taps === 1) return "afterimage-step";
  if (taps === 2) return "ninjato-phase-slice";
  if (taps === 3) return "ninjato-back-thrust";
  return null;
}

/**
 * Roc Wing owns the first R2 press as its spin/lane-shift branch, while the
 * existing double- and triple-tap follow-ups remain available during flight.
 * Keeping this mapping pure lets the runtime buffer the double tap until the
 * triple-tap window closes without accidentally firing both sword moves.
 */
export function resolveLordAlphaRocR2TapCommand(
  tapCount: number,
): LordAlphaRocR2TapCommand | null {
  if (!Number.isFinite(tapCount)) return null;
  const taps = Math.trunc(tapCount);
  if (taps === 1) return "roc-wing-spin";
  if (taps === 2) return "ninjato-phase-slice";
  if (taps === 3) return "ninjato-back-thrust";
  return null;
}

export function resolveLordAlphaDirectGamepadBinding(
  actionId: LordAlphaSkillActionId,
): keyof typeof LORD_ALPHA_DIRECT_GAMEPAD_ACTIONS | null {
  for (const button of Object.keys(LORD_ALPHA_DIRECT_GAMEPAD_ACTIONS) as Array<
    keyof typeof LORD_ALPHA_DIRECT_GAMEPAD_ACTIONS
  >) {
    if (LORD_ALPHA_DIRECT_GAMEPAD_ACTIONS[button] === actionId) return button;
  }
  return null;
}

export const LORD_ALPHA_SKILL_BANKS = [
  {
    id: "web",
    label: "WEB SYSTEMS",
    // Preserve the original X / Y / B visual order while moving the actions:
    // Roc Wing vacates B, and Web Shot now occupies the actual B/right slot.
    actionIds: ["roc-stun", "grapple", "web-shot"],
  },
  {
    id: "mobility",
    label: "MOBILITY",
    actionIds: ["dimensional-net", "afterimage-step", "shadow-clone"],
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

export function resolveLordAlphaSkillActionById(
  actionId: LordAlphaSkillActionId,
): (typeof LORD_ALPHA_SKILL_PREVIEW_ACTIONS)[number] | null {
  return LORD_ALPHA_SKILL_PREVIEW_ACTIONS.find((action) => action.id === actionId) ?? null;
}

/** True only for the explicit local preview opt-in; ordinary routes stay clean. */
export function isLordAlphaSkillsPreviewSearch(search: string): boolean {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  return params.get(LORD_ALPHA_SKILL_PREVIEW_QUERY_KEY) === "1";
}

/**
 * Resolve the render-only Lord Alpha animation profile. Fixed-size rendering
 * is the game-wide default so attacks and skills cannot silently shrink the
 * actor or a held target. The legacy profile remains an explicit diagnostic
 * opt-in for comparing old captures.
 */
export function resolveLordAlphaAnimationProfile(
  search: string,
): LordAlphaAnimationProfile {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const requested = params.get(LORD_ALPHA_ANIMATION_QUERY_KEY);
  return requested === "legacy" ? "legacy" : "solid";
}

/** Return the immutable held-target visual policy for the selected profile. */
export function resolveLordAlphaHeldTargetVisualPolicy(
  profile: LordAlphaAnimationProfile,
): LordAlphaHeldTargetVisualPolicy {
  return LORD_ALPHA_HELD_TARGET_VISUAL_POLICIES[profile];
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
