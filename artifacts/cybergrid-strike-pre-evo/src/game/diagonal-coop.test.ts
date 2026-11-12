import { deepStrictEqual, equal, throws } from 'node:assert/strict';
import { test } from 'node:test';

import {
  createDiagonalCoopSpawns,
  isDiagonalCoopCellInBounds,
  resolveDiagonalCoopMovement,
  resolveDiagonalCoopPairLayout,
} from './diagonal-coop';

test('player and ally NPC spawn separately in opposite corners', () => {
  deepStrictEqual(createDiagonalCoopSpawns(), {
    p1: { col: 0, row: 0 },
    p2: { col: 2, row: 2 },
  });
});

test('P1 can move without moving P2', () => {
  const result = resolveDiagonalCoopMovement(createDiagonalCoopSpawns(), {
    p1: { col: 1, row: 0 },
  });

  deepStrictEqual(result.positions, {
    p1: { col: 1, row: 0 },
    p2: { col: 2, row: 2 },
  });
  deepStrictEqual(result.moved, { p1: true, p2: false });
  deepStrictEqual(result.rejected, { p1: null, p2: null });
  equal(result.layout, null);
});

test('P2 can move without moving P1', () => {
  const result = resolveDiagonalCoopMovement(createDiagonalCoopSpawns(), {
    p2: { col: 1, row: 2 },
  });

  deepStrictEqual(result.positions, {
    p1: { col: 0, row: 0 },
    p2: { col: 1, row: 2 },
  });
  deepStrictEqual(result.moved, { p1: false, p2: true });
  equal(result.layout, null);
});

test('both actors may independently choose and share one destination', () => {
  const result = resolveDiagonalCoopMovement(createDiagonalCoopSpawns(), {
    p1: { col: 1, row: 1 },
    p2: { col: 1, row: 1 },
  });

  deepStrictEqual(result.positions, {
    p1: { col: 1, row: 1 },
    p2: { col: 1, row: 1 },
  });
  deepStrictEqual(result.moved, { p1: true, p2: true });
  deepStrictEqual(result.layout, { playerX: -1, playerY: -1 });
});

test('a newly co-located pair is diagonally arranged from its approach', () => {
  const previous = {
    p1: { col: 2, row: 0 },
    p2: { col: 1, row: 1 },
  };

  deepStrictEqual(resolveDiagonalCoopPairLayout(previous, {
    p1: { col: 1, row: 1 },
    p2: { col: 1, row: 1 },
  }), { playerX: 1, playerY: -1 });
});

test('cardinal collision still produces a stable diagonal', () => {
  const result = resolveDiagonalCoopMovement({
    p1: { col: 0, row: 1 },
    p2: { col: 1, row: 1 },
  }, {
    p1: { col: 1, row: 1 },
  });

  deepStrictEqual(result.layout, { playerX: -1, playerY: -1 });
});

test('layout persists while co-located and clears on separation', () => {
  const layout = { playerX: 1, playerY: -1 } as const;
  const together = resolveDiagonalCoopMovement({
    p1: { col: 1, row: 1 },
    p2: { col: 1, row: 1 },
  }, {
    p1: { col: 2, row: 2 },
    p2: { col: 2, row: 2 },
  }, layout);

  deepStrictEqual(together.layout, layout);

  const separated = resolveDiagonalCoopMovement(together.positions, {
    p2: { col: 1, row: 2 },
  }, together.layout);
  equal(separated.layout, null);
});

test('an out-of-bounds move rejects only its requesting actor', () => {
  const current = createDiagonalCoopSpawns();
  const result = resolveDiagonalCoopMovement(current, {
    p1: { col: 3, row: 0 },
    p2: { col: 1, row: 2 },
  });

  equal(isDiagonalCoopCellInBounds({ col: 0, row: 0 }), true);
  equal(isDiagonalCoopCellInBounds({ col: 2, row: 2 }), true);
  equal(isDiagonalCoopCellInBounds({ col: 3, row: 0 }), false);
  deepStrictEqual(result.positions, {
    p1: { col: 0, row: 0 },
    p2: { col: 1, row: 2 },
  });
  deepStrictEqual(result.moved, { p1: false, p2: true });
  deepStrictEqual(result.rejected, { p1: 'out-of-bounds', p2: null });
});

test('actors can swap cells without being treated as a collision', () => {
  const result = resolveDiagonalCoopMovement({
    p1: { col: 0, row: 0 },
    p2: { col: 1, row: 1 },
  }, {
    p1: { col: 1, row: 1 },
    p2: { col: 0, row: 0 },
  });

  deepStrictEqual(result.positions, {
    p1: { col: 1, row: 1 },
    p2: { col: 0, row: 0 },
  });
  equal(result.layout, null);
});

test('invalid current positions still fail fast', () => {
  throws(() => resolveDiagonalCoopMovement({
    p1: { col: -1, row: 0 },
    p2: { col: 2, row: 2 },
  }, {}), RangeError);
});
