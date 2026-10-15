import { ok, equal } from 'node:assert/strict';
import { test } from 'node:test';

import {
  ACTION_WINDOW_GRID_GAP,
  getActionWindowBottomLimit,
  getBoardMetrics,
} from './board-layout';

test('the default board placement remains unchanged without a reserved HUD floor', () => {
  const landscape = getBoardMetrics(1440, 900);
  equal(landscape.y, 216);

  const portrait = getBoardMetrics(390, 844);
  equal(portrait.y, 844 * 0.18);
});

test('the complete board clears the Action Window on representative viewports', () => {
  const cases = [
    { width: 2048, height: 864, actionBottom: 470 },
    { width: 724, height: 464, actionBottom: 203 },
    { width: 390, height: 844, actionBottom: 321 },
    { width: 844, height: 390, actionBottom: 273 },
  ];

  for (const { width, height, actionBottom } of cases) {
    const boundedActionBottom = Math.min(actionBottom, getActionWindowBottomLimit(height));
    const floor = boundedActionBottom + ACTION_WINDOW_GRID_GAP;
    const board = getBoardMetrics(width, height, floor);

    ok(board.y >= floor - 0.001, `${width}x${height} board starts below the Action Window`);
    ok(board.y + board.boardH <= height + 0.001, `${width}x${height} board remains visible`);
    ok(board.cell > 0, `${width}x${height} retains usable board cells`);
  }
});

test('oversized restored Action Windows retain room for all three grid rows', () => {
  for (const height of [300, 390, 464, 844, 900]) {
    const actionBottom = getActionWindowBottomLimit(height);
    const board = getBoardMetrics(844, height, actionBottom + ACTION_WINDOW_GRID_GAP);
    ok(board.y >= actionBottom + ACTION_WINDOW_GRID_GAP - 0.001);
    ok(board.y + board.boardH <= height + 0.001);
  }
});
