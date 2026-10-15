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
  lordAlphaAssetUrl,
} from "./lord-alpha";
import {
  LORD_ALPHA_PROJECTILE_DURATION_MS,
  LORD_ALPHA_PROJECTILE_VARIANTS,
  resolveLordAlphaProjectileFrame,
} from "./renderer";
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
