import { deepStrictEqual, equal, ok } from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import {
  LORD_ALPHA_ASSETS,
  LORD_ALPHA_ASSET_REVISION,
  LORD_ALPHA_ATTACK_SEQUENCE_ASSETS,
  LORD_ALPHA_COMBO_ASSET_SUFFIXES,
  LORD_ALPHA_FORM_IDS,
  LORD_ALPHA_SHURIKEN_PROJECTILE_SOURCE,
  LORD_ALPHA_THARTHAREON_CONNECTED_BITE_SEQUENCE_ASSET,
  LORD_ALPHA_THARTHAREON_FIREBALL_PROJECTILE_ASSET,
  LORD_ALPHA_THARTHAREON_HEADBUTT_LEGACY_SEQUENCE_ASSET,
  LORD_ALPHA_THARTHAREON_HEADBUTT_SEQUENCE_ASSET,
  LORD_ALPHA_THARTHAREON_HOLD_BITE_SEQUENCE_ASSET,
  LORD_ALPHA_THARTHAREON_PORTAL_SEQUENCE_ASSET,
  lordAlphaAssetUrl,
} from "./lord-alpha";
import {
  LORD_ALPHA_PROJECTILE_DURATION_MS,
  LORD_ALPHA_PROJECTILE_VARIANTS,
  resolveLordAlphaProjectileFrame,
  resolveTharthareonBiteRenderGeometry,
  resolveTharthareonBiteVisualFrame,
  resolveTharthareonHeadbuttVisualFrame,
} from "./renderer";
import {
  THARTHAREON_BITE_CLAMP_HOLD_SECONDS,
  THARTHAREON_BITE_MAX_CELLS,
  advanceTharthareonBiteCarrier,
} from "./tharthareon-bite";
import type { Bullet } from "./types";

const publicRoot = fileURLToPath(new URL("../../public/", import.meta.url));

function readPngDimensions(path: string): { width: number; height: number } {
  const header = readFileSync(path).subarray(0, 24);
  equal(header.length, 24, `${path} must include a complete PNG header`);
  deepStrictEqual(
    [...header.subarray(0, 8)],
    [137, 80, 78, 71, 13, 10, 26, 10],
    `${path} must have a valid PNG signature`,
  );
  equal(
    header.subarray(12, 16).toString("ascii"),
    "IHDR",
    `${path} must begin with an IHDR chunk`,
  );
  return {
    width: header.readUInt32BE(16),
    height: header.readUInt32BE(20),
  };
}

test("Lord Alpha projectile grammars begin at immutable age zero", () => {
  deepStrictEqual(LORD_ALPHA_PROJECTILE_VARIANTS, [
    "quick",
    "web",
    "power",
    "roc",
    "finisher",
  ]);

  for (const variant of LORD_ALPHA_PROJECTILE_VARIANTS) {
    const birth = 4_000;
    const frame = resolveLordAlphaProjectileFrame(birth, birth, variant);
    deepStrictEqual(frame, {
      variant,
      ageMs: 0,
      progress: 0,
      nodeReveal: 0,
      edgeReveal: 0,
      impact: 0,
      recovery: 0,
    });
    ok(LORD_ALPHA_PROJECTILE_DURATION_MS[variant] > 0);
  }
});

test("Lord Alpha projectile presentation is deterministic, monotonic, and clamped", () => {
  for (const variant of LORD_ALPHA_PROJECTILE_VARIANTS) {
    const duration = LORD_ALPHA_PROJECTILE_DURATION_MS[variant];
    const before = resolveLordAlphaProjectileFrame(99, 100, variant);
    const middle = resolveLordAlphaProjectileFrame(100 + duration / 2, 100, variant);
    const repeat = resolveLordAlphaProjectileFrame(100 + duration / 2, 100, variant);
    const completed = resolveLordAlphaProjectileFrame(100 + duration, 100, variant);
    const completedRepeat = resolveLordAlphaProjectileFrame(
      100 + duration,
      100,
      variant,
    );
    const after = resolveLordAlphaProjectileFrame(100 + duration * 4, 100, variant);

    equal(before.ageMs, 0);
    equal(before.progress, 0);
    deepStrictEqual(middle, repeat);
    ok(middle.progress > before.progress);
    ok(middle.nodeReveal >= before.nodeReveal);
    ok(middle.edgeReveal >= before.edgeReveal);
    deepStrictEqual(completed, completedRepeat);
    equal(completed.progress, 1);
    equal(completed.nodeReveal, 1);
    equal(completed.edgeReveal, 1);
    equal(completed.impact, 1);
    equal(completed.recovery, 1);
    equal(after.progress, 1);
    equal(after.nodeReveal, 1);
    equal(after.edgeReveal, 1);
    equal(after.impact, 1);
    equal(after.recovery, 1);
  }
});

test("the quick projectile samples the authored shuriken from its attack strip", () => {
  const quick = LORD_ALPHA_ATTACK_SEQUENCE_ASSETS.quick;
  const source = LORD_ALPHA_SHURIKEN_PROJECTILE_SOURCE;

  equal(source.suffix, quick.suffix);
  equal(source.frameIndex, 4);
  ok(source.x >= 0 && source.y >= 0);
  ok(source.x + source.width <= quick.frameWidth);
  ok(source.y + source.height <= quick.frameHeight);
});

test("all five Lord Alpha combo pose assets are valid 240x160 PNGs", () => {
  deepStrictEqual(Object.keys(LORD_ALPHA_COMBO_ASSET_SUFFIXES), [
    "quick",
    "web",
    "power",
    "roc",
    "finisher",
  ]);

  for (const variant of LORD_ALPHA_PROJECTILE_VARIANTS) {
    const suffix = LORD_ALPHA_COMBO_ASSET_SUFFIXES[variant];
    const path = join(publicRoot, ...suffix.split("/"));
    ok(existsSync(path), `missing Lord Alpha combo asset for ${variant}: ${suffix}`);
    deepStrictEqual(readPngDimensions(path), { width: 240, height: 160 });
  }
});

test("resolving projectile presentation cannot mutate projectile physics", () => {
  const projectile: Bullet = {
    colPos: 1.25,
    row: 2,
    speed: 0.018,
    power: 3,
    big: true,
    pierce: true,
    attackStyle: "energy",
    effectSkin: "lord-alpha",
    presentationBirthMs: 125,
    presentationVariant: "power",
    hitEnemySeeds: [7, 11],
    hitNpc: false,
  };
  const before = structuredClone(projectile);

  resolveLordAlphaProjectileFrame(
    220,
    projectile.presentationBirthMs!,
    projectile.presentationVariant!,
  );

  deepStrictEqual(projectile, before);
});

test("Tharthareon bite frames follow collision-carrier distance across three cells", () => {
  deepStrictEqual(resolveTharthareonBiteVisualFrame({
    colPos: 0.55,
    travelOriginCol: 0.55,
    travelLimitCells: 3,
  }), {
    originCol: 0.55,
    progress: 0,
    frameIndex: 0,
  });
  deepStrictEqual(resolveTharthareonBiteVisualFrame({
    colPos: 0.36,
    travelOriginCol: 0,
    travelLimitCells: 3,
  }), {
    originCol: 0,
    progress: 0.12,
    frameIndex: 2,
  });
  deepStrictEqual(resolveTharthareonBiteVisualFrame({
    colPos: 1.5,
    travelOriginCol: 0,
    travelLimitCells: 3,
  }), {
    originCol: 0,
    progress: 0.5,
    frameIndex: 4,
  });
  deepStrictEqual(resolveTharthareonBiteVisualFrame({
    colPos: 3.55,
    travelOriginCol: 0.55,
    travelLimitCells: 3,
  }), {
    originCol: 0.55,
    progress: 1,
    frameIndex: LORD_ALPHA_THARTHAREON_HOLD_BITE_SEQUENCE_ASSET.terminalOpenFrame,
  });
});

test("Tharthareon bite pose progression is direction-independent and clamped", () => {
  deepStrictEqual(resolveTharthareonBiteVisualFrame({
    colPos: -2.45,
    travelOriginCol: 0.55,
    travelLimitCells: 3,
  }), {
    originCol: 0.55,
    progress: 1,
    frameIndex: LORD_ALPHA_THARTHAREON_HOLD_BITE_SEQUENCE_ASSET.terminalOpenFrame,
  });
  equal(resolveTharthareonBiteVisualFrame({
    colPos: 8,
    travelOriginCol: 2,
    travelLimitCells: 3,
  }).frameIndex, LORD_ALPHA_THARTHAREON_HOLD_BITE_SEQUENCE_ASSET.terminalOpenFrame);
  equal(resolveTharthareonBiteVisualFrame({
    colPos: 1.1,
    travelOriginCol: 0.55,
    travelLimitCells: 3,
    tharthareonFinalBite: true,
  }).frameIndex, LORD_ALPHA_THARTHAREON_HOLD_BITE_SEQUENCE_ASSET.terminalFrame,
  "an early collision must finish the bite at its actual hit position");
});

test("Tharthareon connected creature and fixed portal match their manifests", () => {
  for (const sequence of [
    LORD_ALPHA_THARTHAREON_CONNECTED_BITE_SEQUENCE_ASSET,
    LORD_ALPHA_THARTHAREON_FIREBALL_PROJECTILE_ASSET,
    LORD_ALPHA_THARTHAREON_HEADBUTT_LEGACY_SEQUENCE_ASSET,
    LORD_ALPHA_THARTHAREON_HEADBUTT_SEQUENCE_ASSET,
    LORD_ALPHA_THARTHAREON_HOLD_BITE_SEQUENCE_ASSET,
    LORD_ALPHA_THARTHAREON_PORTAL_SEQUENCE_ASSET,
  ]) {
    const path = join(publicRoot, ...sequence.suffix.split("/"));
    ok(existsSync(path), `missing Tharthareon authored layer: ${sequence.suffix}`);
    const atlasColumns = "atlasColumns" in sequence ? sequence.atlasColumns : sequence.frameCount;
    const atlasRows = "atlasRows" in sequence ? sequence.atlasRows : 1;
    deepStrictEqual(readPngDimensions(path), {
      width: atlasColumns * sequence.frameWidth,
      height: atlasRows * sequence.frameHeight,
    });
  }
});

test("Hold Tharthareon owns the accepted emerge-roll-bite sequence without portal pixels", () => {
  const sequence = LORD_ALPHA_THARTHAREON_HOLD_BITE_SEQUENCE_ASSET;
  equal(sequence.suffix, "effects/lord-alpha/sequences/tharthareon-hold-emerge-midroll-bite-v2.png");
  equal(sequence.frameCount, 13);
  equal(sequence.frameWidth, 592);
  equal(sequence.frameHeight, 376);
  equal(sequence.atlasColumns, 4);
  equal(sequence.atlasRows, 4);
  const atlasPath = join(publicRoot, ...sequence.suffix.split("/"));
  const atlasSize = readPngDimensions(atlasPath);
  deepStrictEqual(atlasSize, { width: 2_368, height: 1_504 });
  ok(atlasSize.width <= 4_096);
  ok(atlasSize.height <= 4_096);
  deepStrictEqual(sequence.frameHoldMs, [
    240, 90, 90, 90, 100, 110, 110, 110, 110, 100, 100, 110, 580,
  ]);
  equal(sequence.durationMs, 1_940);
  equal(sequence.terminalFrame, 12);
  equal(sequence.portalBaked, false);
  equal(sequence.loopDuringHold, false);
  equal(sequence.playback, "play-once-then-hold-terminal-frame");
  equal(sequence.mouthAnchorXByFrame.length, sequence.frameCount);
  equal(sequence.mouthAnchorYByFrame.length, sequence.frameCount);
});

test("legacy Tharthareon headbutt remains the default finite authored cycle", () => {
  const sequence = LORD_ALPHA_THARTHAREON_HEADBUTT_LEGACY_SEQUENCE_ASSET;
  equal(sequence.frameCount, 9);
  equal(sequence.atlasColumns, 9);
  equal(sequence.atlasRows, 1);
  equal(
    sequence.frameHoldMs.reduce((total, duration) => total + duration, 0),
    sequence.durationMs,
  );
  equal(resolveTharthareonHeadbuttVisualFrame(0).frameIndex, 0);
  equal(resolveTharthareonHeadbuttVisualFrame(0.139).frameIndex, 0);
  equal(resolveTharthareonHeadbuttVisualFrame(0.14).frameIndex, 1);
  equal(resolveTharthareonHeadbuttVisualFrame(0.35).frameIndex, 2);
  equal(resolveTharthareonHeadbuttVisualFrame(1.2).frameIndex, 8);
  deepStrictEqual(resolveTharthareonHeadbuttVisualFrame(9), {
    frameIndex: 8,
    elapsedMs: 1_330,
    progress: 1,
    complete: true,
  });
});

test("solid Tharthareon headbutt uses every pose in its finite authored cycle", () => {
  const sequence = LORD_ALPHA_THARTHAREON_HEADBUTT_SEQUENCE_ASSET;
  equal(sequence.frameCount, 25);
  equal(sequence.atlasColumns, 5);
  equal(sequence.atlasRows, 5);
  equal(
    sequence.frameHoldMs.reduce((total, duration) => total + duration, 0),
    sequence.durationMs,
  );
  equal(resolveTharthareonHeadbuttVisualFrame(0, true).frameIndex, 0);
  equal(resolveTharthareonHeadbuttVisualFrame(0.139, true).frameIndex, 0);
  equal(resolveTharthareonHeadbuttVisualFrame(0.14, true).frameIndex, 1);
  equal(resolveTharthareonHeadbuttVisualFrame(0.35, true).frameIndex, 5);
  equal(resolveTharthareonHeadbuttVisualFrame(1.2, true).frameIndex, 23);
  deepStrictEqual(resolveTharthareonHeadbuttVisualFrame(9, true), {
    frameIndex: 24,
    elapsedMs: 1_330,
    progress: 1,
    complete: true,
  });
});

test("Hold Tharthareon enters its authored closing sequence after the open-jaw beat", () => {
  const terminal = {
    colPos: 3.55,
    travelOriginCol: 0.55,
    travelLimitCells: 3,
    tharthareonFinalBite: true,
  } as const;
  equal(resolveTharthareonBiteVisualFrame({
    ...terminal,
    tharthareonHoldRemaining: THARTHAREON_BITE_CLAMP_HOLD_SECONDS + 0.01,
  }).frameIndex, LORD_ALPHA_THARTHAREON_HOLD_BITE_SEQUENCE_ASSET.terminalOpenFrame);
  equal(resolveTharthareonBiteVisualFrame({
    ...terminal,
    tharthareonHoldRemaining: THARTHAREON_BITE_CLAMP_HOLD_SECONDS,
  }).frameIndex, LORD_ALPHA_THARTHAREON_HOLD_BITE_SEQUENCE_ASSET.terminalClosingFrame);
});

test("Tharthareon visibly clamps a live target after the opening bite beat", () => {
  const heldTarget = {
    colPos: 2.1,
    travelOriginCol: 0.55,
    travelLimitCells: 3,
    tharthareonFinalBite: true,
    tharthareonHoldRemaining: 2.9,
    tharthareonTargetNpc: true,
  } as const;
  equal(resolveTharthareonBiteVisualFrame({
    ...heldTarget,
    tharthareonTargetHoldElapsed: 0.08,
  }).frameIndex, LORD_ALPHA_THARTHAREON_HOLD_BITE_SEQUENCE_ASSET.terminalOpenFrame);
  equal(resolveTharthareonBiteVisualFrame({
    ...heldTarget,
    tharthareonTargetHoldElapsed: 0.2,
  }).frameIndex, LORD_ALPHA_THARTHAREON_HOLD_BITE_SEQUENCE_ASSET.terminalClosingFrame);
  equal(resolveTharthareonBiteVisualFrame({
    ...heldTarget,
    tharthareonTargetHoldElapsed: 2.99,
  }).frameIndex, LORD_ALPHA_THARTHAREON_HOLD_BITE_SEQUENCE_ASSET.terminalFrame,
  "a long hold freezes on the final bite instead of looping back to emergence");
});

test("Tharthareon travel stays rooted to its portal and samples the row-major atlas", () => {
  const geometry = resolveTharthareonBiteRenderGeometry(6, 120, 264, 90, 48);
  const sequence = LORD_ALPHA_THARTHAREON_HOLD_BITE_SEQUENCE_ASSET;
  equal(geometry.frameIndex, 6);
  equal(geometry.sourceX, (6 % sequence.atlasColumns) * sequence.frameWidth);
  equal(geometry.sourceY, Math.floor(6 / sequence.atlasColumns) * sequence.frameHeight);
  equal(geometry.sourceWidth, sequence.frameWidth);
  equal(geometry.sourceHeight, sequence.frameHeight);
  equal(geometry.renderedRootX, 120);
  equal(geometry.renderedContactX, 264);
  equal(geometry.portalAnchored, true);
  equal(geometry.mirrored, false);
  equal(geometry.rigidCreature, true);
  equal(geometry.clipX, 120);
  ok(geometry.clipWidth > 0);
  ok(!("headDestinationX" in geometry));
  ok(!("bodyDestinationX" in geometry));
  ok(!("connectorDestinationX" in geometry));
  equal(
    geometry.destinationWidth / geometry.sourceWidth,
    geometry.destinationHeight / geometry.sourceHeight,
    "the complete creature must use one uniform scale",
  );
  ok(Math.abs(
    geometry.destinationX
      + sequence.rootAnchorX * geometry.uniformScale
      - geometry.renderedRootX,
  ) < 1e-9);
  ok(Math.abs(
    geometry.destinationY
      + sequence.rootAnchorY * geometry.uniformScale
      - 90,
  ) < 1e-9);
});

test("Tharthareon terminal close keeps one fixed target placement", () => {
  const sequence = LORD_ALPHA_THARTHAREON_HOLD_BITE_SEQUENCE_ASSET;
  const geometries = [8, 9, 10, 11, 12].map((frameIndex) => (
    resolveTharthareonBiteRenderGeometry(frameIndex, 120, 264, 90, 48, true)
  ));
  const [open] = geometries;
  for (const geometry of geometries) {
    equal(geometry.destinationX, open.destinationX);
    equal(geometry.destinationY, open.destinationY);
    equal(geometry.destinationWidth, open.destinationWidth);
    equal(geometry.destinationHeight, open.destinationHeight);
  }
  ok(Math.abs(
    open.destinationX
      + sequence.mouthAnchorXByFrame[sequence.terminalFrame] * open.uniformScale
      - open.renderedContactX,
  ) < 1e-9);
});

test("solid Tharthareon contact eases from the portal root without scaling", () => {
  const sequence = LORD_ALPHA_THARTHAREON_HOLD_BITE_SEQUENCE_ASSET;
  const originX = 120;
  const contactX = originX + 48;
  const start = resolveTharthareonBiteRenderGeometry(
    sequence.terminalOpenFrame,
    originX,
    contactX,
    90,
    48,
    true,
    0,
  );
  const middle = resolveTharthareonBiteRenderGeometry(
    sequence.terminalOpenFrame,
    originX,
    contactX,
    90,
    48,
    true,
    0.5,
  );
  const settled = resolveTharthareonBiteRenderGeometry(
    sequence.terminalOpenFrame,
    originX,
    contactX,
    90,
    48,
    true,
    1,
  );
  const portalRootedX = originX - sequence.rootAnchorX * start.uniformScale;
  equal(start.destinationX, portalRootedX);
  ok(middle.destinationX < start.destinationX);
  ok(middle.destinationX > settled.destinationX);
  equal(start.destinationWidth, middle.destinationWidth);
  equal(middle.destinationWidth, settled.destinationWidth);
  equal(start.destinationHeight, settled.destinationHeight);
  equal(start.uniformScale, settled.uniformScale);
});

test("legacy Tharthareon left-roll asset remains archived and internally coherent", () => {
  const sequence = LORD_ALPHA_THARTHAREON_CONNECTED_BITE_SEQUENCE_ASSET;
  deepStrictEqual(
    sequence.axialRollDegreesByFrame,
    [0, 5, 20, 40, 60, 75, 90, 90],
  );
  ok(sequence.axialRollDegreesByFrame.every(
    (angle, index, angles) => index === 0 || angle >= angles[index - 1],
  ));
  ok(sequence.suffix.includes("left-roll-connected-v29"));
  equal(sequence.axialRollDegreesByFrame[6], sequence.axialRollDegreesByFrame[7]);
  equal(sequence.axialRollDegreesByFrame[6], 90);
});

test("Tharthareon keeps one stable scale while authored reveal frames change", () => {
  const sequence = LORD_ALPHA_THARTHAREON_HOLD_BITE_SEQUENCE_ASSET;
  const early = resolveTharthareonBiteRenderGeometry(2, 120, 150, 90, 48);
  const full = resolveTharthareonBiteRenderGeometry(12, 120, 264, 90, 48);
  equal(early.uniformScale, full.uniformScale);
  equal(early.destinationWidth, full.destinationWidth);
  equal(early.destinationHeight, full.destinationHeight);
  equal(early.destinationX, full.destinationX);
  equal(early.destinationY, full.destinationY);
  for (
    let frameIndex = 0;
    frameIndex < sequence.frameCount;
    frameIndex += 1
  ) {
    const geometry = resolveTharthareonBiteRenderGeometry(
      frameIndex,
      120,
      120 + frameIndex * 18,
      90,
      48,
    );
    equal(geometry.rigidCreature, true);
    equal(geometry.sourceX, (frameIndex % sequence.atlasColumns) * geometry.sourceWidth);
    equal(geometry.sourceY, Math.floor(frameIndex / sequence.atlasColumns) * geometry.sourceHeight);
    equal(geometry.renderedRootX, 120);
    equal(geometry.renderedContactX, 120 + frameIndex * 18);
    equal(geometry.destinationX, early.destinationX);
    equal(geometry.destinationY, early.destinationY);
    equal(geometry.destinationWidth / geometry.sourceWidth, geometry.uniformScale);
    equal(geometry.destinationHeight / geometry.sourceHeight, geometry.uniformScale);
  }
  equal(sequence.frameCount, 13);
});

test("Tharthareon portal clipping honors an explicitly shortened endpoint", () => {
  const cellSize = 48;
  const originX = 120;
  const earlyHitX = originX + cellSize * 0.55;
  const endpointX = originX + cellSize * 3;
  const early = resolveTharthareonBiteRenderGeometry(
    LORD_ALPHA_THARTHAREON_HOLD_BITE_SEQUENCE_ASSET.terminalFrame,
    originX,
    earlyHitX,
    90,
    cellSize,
    true,
  );
  const endpoint = resolveTharthareonBiteRenderGeometry(
    LORD_ALPHA_THARTHAREON_HOLD_BITE_SEQUENCE_ASSET.terminalFrame,
    originX,
    endpointX,
    90,
    cellSize,
    true,
  );

  equal(early.renderedRootX, originX);
  equal(early.renderedContactX, earlyHitX);
  equal(early.destinationWidth, endpoint.destinationWidth);
  ok(early.clipWidth < endpoint.clipWidth);
  equal(early.mirrored, false);
});

test("Tharthareon no-hit simulation and rendering share the exact three-cell endpoint", () => {
  const originColumn = 0.55;
  const cellSize = 48;
  const portalX = 120;
  const carrier = advanceTharthareonBiteCarrier(
    originColumn,
    originColumn,
    20,
    1,
  );
  const contactX = portalX + (carrier.column - originColumn) * cellSize;
  const geometry = resolveTharthareonBiteRenderGeometry(
    LORD_ALPHA_THARTHAREON_HOLD_BITE_SEQUENCE_ASSET.terminalFrame,
    portalX,
    contactX,
    90,
    cellSize,
    true,
  );

  equal(carrier.complete, true);
  equal(carrier.column - originColumn, THARTHAREON_BITE_MAX_CELLS);
  equal(
    geometry.renderedContactX - geometry.renderedRootX,
    THARTHAREON_BITE_MAX_CELLS * cellSize,
  );

  const boundedCells = 0.5;
  const bounded = resolveTharthareonBiteRenderGeometry(
    LORD_ALPHA_THARTHAREON_HOLD_BITE_SEQUENCE_ASSET.terminalFrame,
    portalX,
    portalX + boundedCells * cellSize,
    90,
    cellSize,
    true,
  );
  equal(bounded.renderedContactX - bounded.renderedRootX, boundedCells * cellSize);
  ok(
    bounded.renderedContactX - bounded.renderedRootX
      < geometry.renderedContactX - geometry.renderedRootX,
    "a deliberately shorter board bound must remain shorter than the full extent",
  );
});

test("Tharthareon defensive leftward geometry preserves authored orientation", () => {
  const geometry = resolveTharthareonBiteRenderGeometry(
    LORD_ALPHA_THARTHAREON_HOLD_BITE_SEQUENCE_ASSET.terminalFrame,
    264,
    120,
    90,
    48,
    true,
  );
  equal(geometry.renderedContactX, 120);
  equal(geometry.portalAnchored, false);
  equal(geometry.mirrored, false);
  ok(geometry.destinationWidth > 0, "negative travel must not mirror with negative width");
  ok(geometry.clipWidth > 0);
});

test("Lord Alpha manifest resolves to source PNGs at supported dimensions", () => {
  const expectedAssets = LORD_ALPHA_FORM_IDS.flatMap((form) => {
    const entry = LORD_ALPHA_ASSETS.forms[form];
    return [entry.idleSuffix, entry.attackSuffix];
  });

  for (const suffix of expectedAssets) {
    const path = join(publicRoot, ...suffix.split("/"));
    ok(existsSync(path), `missing Lord Alpha source asset: ${suffix}`);
    deepStrictEqual(readPngDimensions(path), { width: 240, height: 160 });
    equal(
      lordAlphaAssetUrl("/cybergrid-strike-game", suffix),
      `/cybergrid-strike-game/${suffix}?v=${encodeURIComponent(LORD_ALPHA_ASSET_REVISION)}`,
    );
  }

  for (const suffix of Object.values(LORD_ALPHA_ASSETS.effects)) {
    const path = join(publicRoot, ...suffix.split("/"));
    ok(existsSync(path), `missing Lord Alpha effect asset: ${suffix}`);
    deepStrictEqual(readPngDimensions(path), { width: 512, height: 342 });
    equal(
      lordAlphaAssetUrl("/", suffix),
      `/${suffix}?v=${encodeURIComponent(LORD_ALPHA_ASSET_REVISION)}`,
    );
  }
});
