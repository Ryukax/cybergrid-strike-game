import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  isUsurperIdleSheetUrl,
  resolveUsurperSheetFrame,
  USURPER_IDLE_SHEET_PATH,
} from './usurper-sprite.ts';

test('Usurper uses the complete first authored square pose', () => {
  const assetPath = USURPER_IDLE_SHEET_PATH.split('?')[0];
  const png = readFileSync(new URL(`../../public/${assetPath}`, import.meta.url));
  assert.equal(png.subarray(1, 4).toString('ascii'), 'PNG');
  const width = png.readUInt32BE(16);
  const height = png.readUInt32BE(20);
  assert.deepEqual(resolveUsurperSheetFrame(width, height), {
    x: 0,
    y: 0,
    width: 256,
    height: 256,
  });
  assert.equal(isUsurperIdleSheetUrl(`/game/${USURPER_IDLE_SHEET_PATH}`), true);
});

test('invalid or non-sheet dimensions cannot fall back to the malformed idle composite', () => {
  assert.equal(resolveUsurperSheetFrame(240, 0), null);
  assert.equal(resolveUsurperSheetFrame(120, 160), null);
});
