import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { deepStrictEqual, equal, ok } from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { CANONICAL_ABILITY_IDS } from './ability-system';
import {
  ABILITY_IMAGEGEN_FRAME_COUNT,
  ABILITY_IMAGEGEN_VFX_ASSETS,
  abilityImagegenFrameIndex,
  abilityImagegenVfxUrl,
  resolveAbilityImagegenVfxAsset,
} from './ability-vfx-manifest';

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function assetPath(suffix: string): string {
  return fileURLToPath(new URL(`../../public/${suffix}`, import.meta.url));
}

test('every canonical card owns one unique versioned ImageGen asset', () => {
  deepStrictEqual(Object.keys(ABILITY_IMAGEGEN_VFX_ASSETS).sort(), [...CANONICAL_ABILITY_IDS].sort());
  const suffixes = new Set<string>();
  for (const abilityId of CANONICAL_ABILITY_IDS) {
    const asset = resolveAbilityImagegenVfxAsset(abilityId);
    ok(asset, `${abilityId} lacks an ImageGen asset`);
    equal(asset.abilityId, abilityId);
    equal(asset.frameCount, ABILITY_IMAGEGEN_FRAME_COUNT);
    equal(asset.columns * asset.rows, asset.frameCount);
    equal(asset.frameHoldMs.length, asset.frameCount);
    equal(asset.durationMs, asset.frameHoldMs.reduce((total, value) => total + value, 0));
    equal(asset.suffix, `effects/ability-cards/v1/${abilityId}.png`);
    equal(abilityImagegenVfxUrl(asset, '/game/'), `/game/${asset.suffix}?v=1`);
    suffixes.add(asset.suffix);
  }
  equal(suffixes.size, CANONICAL_ABILITY_IDS.length);
  equal(resolveAbilityImagegenVfxAsset('not-a-card'), null);
});

test('ImageGen frame timing is bounded and honors reduced motion', () => {
  for (const abilityId of CANONICAL_ABILITY_IDS) {
    const asset = ABILITY_IMAGEGEN_VFX_ASSETS[abilityId];
    equal(abilityImagegenFrameIndex(asset, Number.NaN), 0);
    equal(abilityImagegenFrameIndex(asset, -1), 0);
    equal(abilityImagegenFrameIndex(asset, 1), 3);
    equal(abilityImagegenFrameIndex(asset, 99), 3);
    equal(abilityImagegenFrameIndex(asset, 0.5, true), asset.reducedMotionFrame);
  }
});

test('all canonical ImageGen sheets exist as distinct transparent 2x2 PNGs', () => {
  const hashes = new Set<string>();
  for (const abilityId of CANONICAL_ABILITY_IDS) {
    const asset = ABILITY_IMAGEGEN_VFX_ASSETS[abilityId];
    const path = assetPath(asset.suffix);
    ok(existsSync(path), `${abilityId} is missing ${path}`);
    const png = readFileSync(path);
    ok(png.subarray(0, 8).equals(PNG_SIGNATURE), `${abilityId} is not a PNG`);
    const width = png.readUInt32BE(16);
    const height = png.readUInt32BE(20);
    const colorType = png.readUInt8(25);
    // ImageGen may trim a transparent outer row or column, so natural sheet
    // dimensions are not guaranteed to be even. The renderer intentionally
    // derives fractional half-width/half-height source rectangles instead of
    // resampling or padding the generated art.
    ok(
      width / asset.columns >= 512 && height / asset.rows >= 512,
      `${abilityId} frames are too small in ${width}x${height}`,
    );
    ok(colorType === 4 || colorType === 6, `${abilityId} PNG has no alpha channel`);
    hashes.add(createHash('sha256').update(png).digest('hex'));
  }
  equal(hashes.size, CANONICAL_ABILITY_IDS.length, 'canonical cards must not share copied artwork');
});
