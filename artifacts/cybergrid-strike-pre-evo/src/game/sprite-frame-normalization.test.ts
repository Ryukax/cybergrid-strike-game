import assert from 'node:assert/strict';
import test from 'node:test';
import {
  measurePrimarySpriteIsland,
  resolveStableSpriteFrameProjection,
  selectSpriteActorIsland,
} from './sprite-frame-normalization';

function raster(width: number, height: number, opaque: ReadonlyArray<readonly [number, number]>) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (const [x, y] of opaque) data[(y * width + x) * 4 + 3] = 255;
  return data;
}

function rectangle(left: number, top: number, right: number, bottom: number) {
  const pixels: Array<readonly [number, number]> = [];
  for (let y = top; y <= bottom; y++) {
    for (let x = left; x <= right; x++) pixels.push([x, y]);
  }
  return pixels;
}

test('primary island measurement ignores detached effect specks', () => {
  const actor = rectangle(3, 2, 7, 9);
  const data = raster(16, 12, [...actor, [14, 1], [15, 1], [1, 11]]);
  assert.deepEqual(measurePrimarySpriteIsland(data, 16, 12), {
    minX: 3,
    minY: 2,
    maxX: 7,
    maxY: 9,
    pixels: 40,
  });
});

test('projection restores a smaller actor gauge and locks its root', () => {
  const reference = { minX: 20, minY: 20, maxX: 99, maxY: 139, pixels: 5_000 };
  const frame = { minX: 40, minY: 50, maxX: 99, maxY: 139, pixels: 2_500 };
  const projection = resolveStableSpriteFrameProjection(
    reference,
    { width: 160, height: 160 },
    frame,
    { width: 160, height: 160 },
    { lockRoot: true },
  );
  assert.ok(projection.scale > 1.3 && projection.scale < 1.35);
  assert.equal(Math.round(projection.drawY + (frame.maxY + 1) * projection.scale), 140);
});

test('projection preserves source aspect ratio and bounds extreme corrections', () => {
  const reference = { minX: 20, minY: 10, maxX: 119, maxY: 149, pixels: 8_000 };
  const tinyFrame = { minX: 110, minY: 70, maxX: 129, maxY: 99, pixels: 300 };
  const projection = resolveStableSpriteFrameProjection(
    reference,
    { width: 256, height: 160 },
    tinyFrame,
    { width: 256, height: 160 },
  );
  assert.equal(projection.scale, 1.35);
  assert.equal(projection.drawWidth / projection.drawHeight, 256 / 160);
});

test('projection registers the actor center instead of the full source canvas', () => {
  const reference = { minX: 20, minY: 20, maxX: 79, maxY: 139, pixels: 5_000 };
  const frame = { minX: 8, minY: 40, maxX: 67, maxY: 139, pixels: 3_500 };
  const projection = resolveStableSpriteFrameProjection(
    reference,
    { width: 160, height: 160 },
    frame,
    { width: 160, height: 160 },
  );
  const projectedCenter = projection.drawX
    + ((frame.minX + frame.maxX + 1) / 2) * projection.scale;
  assert.equal(Math.round(projectedCenter), 50);
});

test('actor selection rejects a larger detached effect away from the canonical root', () => {
  const reference = { minX: 20, minY: 20, maxX: 79, maxY: 139, pixels: 5_000 };
  const actor = { minX: 30, minY: 30, maxX: 89, maxY: 139, pixels: 3_600 };
  const effect = { minX: 120, minY: 5, maxX: 239, maxY: 90, pixels: 8_000 };
  assert.equal(selectSpriteActorIsland(
    [effect, actor],
    { width: 256, height: 160 },
    reference,
    { width: 160, height: 160 },
  ), actor);
});

test('effect-only right-side frames fall back instead of recentering around the VFX', () => {
  const reference = { minX: 20, minY: 20, maxX: 79, maxY: 139, pixels: 5_000 };
  const shield = { minX: 165, minY: 30, maxX: 239, maxY: 145, pixels: 8_000 };
  assert.equal(selectSpriteActorIsland(
    [shield],
    { width: 256, height: 160 },
    reference,
    { width: 160, height: 160 },
  ), null);
});

test('projection keeps the measured actor inside its output canvas', () => {
  const reference = { minX: 20, minY: 10, maxX: 139, maxY: 149, pixels: 8_000 };
  const frame = { minX: 2, minY: 35, maxX: 91, maxY: 134, pixels: 3_500 };
  const projection = resolveStableSpriteFrameProjection(
    reference,
    { width: 160, height: 160 },
    frame,
    { width: 160, height: 160 },
    { lockRoot: true },
  );
  const left = projection.drawX + frame.minX * projection.scale;
  const right = projection.drawX + (frame.maxX + 1) * projection.scale;
  const top = projection.drawY + frame.minY * projection.scale;
  const bottom = projection.drawY + (frame.maxY + 1) * projection.scale;
  assert.ok(left >= -0.001);
  assert.ok(right <= 160.001);
  assert.ok(top >= -0.001);
  assert.ok(bottom <= 160.001);
});

test('composition-preserving sequences keep an identity canvas transform', () => {
  const reference = { minX: 20, minY: 20, maxX: 79, maxY: 139, pixels: 5_000 };
  const actorPart = { minX: 56, minY: 177, maxX: 108, maxY: 232, pixels: 1_500 };
  const projection = resolveStableSpriteFrameProjection(
    reference,
    { width: 160, height: 160 },
    actorPart,
    { width: 256, height: 256 },
    { minScale: 1, maxScale: 1, alignActor: false },
  );
  assert.deepEqual(projection, {
    scale: 1,
    drawX: 0,
    drawY: 0,
    drawWidth: 256,
    drawHeight: 256,
  });
});
