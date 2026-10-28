import { deepEqual, equal } from 'node:assert/strict';
import { test } from 'node:test';

import {
  constrainMovablePanelSize,
  normalizeMovablePanelPosition,
  parseMovablePanelPosition,
  parseMovablePanelSize,
  resolveMovablePanelPosition,
} from './movable-panel.ts';

test('movable panels resolve to every safe viewport edge', () => {
  const panel = { width: 310, height: 180 };
  const viewport = { width: 844, height: 390 };

  deepEqual(resolveMovablePanelPosition({ x: 0, y: 0 }, panel, viewport), { x: 8, y: 8 });
  deepEqual(resolveMovablePanelPosition({ x: 1, y: 1 }, panel, viewport), { x: 526, y: 202 });
});

test('pixel positions clamp before being normalized', () => {
  const panel = { width: 310, height: 180 };
  const viewport = { width: 844, height: 390 };

  deepEqual(normalizeMovablePanelPosition({ x: -200, y: 900 }, panel, viewport), { x: 0, y: 1 });
  deepEqual(normalizeMovablePanelPosition({ x: 267, y: 105 }, panel, viewport), { x: 0.5, y: 0.5 });
});

test('responsive coordinates remain centered after a viewport resize', () => {
  const normalized = { x: 0.5, y: 0.5 };
  deepEqual(
    resolveMovablePanelPosition(normalized, { width: 310, height: 180 }, { width: 844, height: 390 }),
    { x: 267, y: 105 },
  );
  deepEqual(
    resolveMovablePanelPosition(normalized, { width: 310, height: 180 }, { width: 390, height: 844 }),
    { x: 40, y: 332 },
  );
});

test('an oversized panel remains anchored in the available viewport', () => {
  deepEqual(
    resolveMovablePanelPosition(
      { x: 1, y: 1 },
      { width: 500, height: 900 },
      { width: 390, height: 844 },
    ),
    { x: 0, y: 0 },
  );
});

test('stored positions are validated and clamped', () => {
  deepEqual(parseMovablePanelPosition('{"x":1.4,"y":-0.2}'), { x: 1, y: 0 });
  equal(parseMovablePanelPosition('{"x":"right","y":0}'), null);
  equal(parseMovablePanelPosition('not json'), null);
});

test('stored panel sizes require finite positive dimensions', () => {
  deepEqual(parseMovablePanelSize('{"width":420,"height":210}'), { width: 420, height: 210 });
  equal(parseMovablePanelSize('{"width":0,"height":210}'), null);
  equal(parseMovablePanelSize('{"width":"wide","height":210}'), null);
  equal(parseMovablePanelSize('not json'), null);
});

test('panel resizing preserves its top-left anchor and viewport margin', () => {
  deepEqual(
    constrainMovablePanelSize(
      { width: 900, height: 600 },
      { x: 200, y: 100 },
      { width: 844, height: 390 },
      { width: 236, height: 150 },
    ),
    { width: 636, height: 282 },
  );
  deepEqual(
    constrainMovablePanelSize(
      { width: 120, height: 60 },
      { x: 8, y: 8 },
      { width: 844, height: 390 },
      { width: 236, height: 150 },
    ),
    { width: 236, height: 150 },
  );
});
