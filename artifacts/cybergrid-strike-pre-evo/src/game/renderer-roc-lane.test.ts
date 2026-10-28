import { equal } from 'node:assert/strict';
import { test } from 'node:test';

import {
  isRocLaneChoiceCell,
  resolveRocLaneChoiceHighlight,
  type RocLaneChoice,
} from './renderer';

test('Roc Wing can highlight adjacent panes at its enemy-side apex', () => {
  const choice: RocLaneChoice = {
    col: 5,
    candidateRows: [0, 2],
    selectedRow: null,
  };

  equal(isRocLaneChoiceCell(choice, 5, 0), true);
  equal(isRocLaneChoiceCell(choice, 5, 2), true);
  equal(isRocLaneChoiceCell(choice, 5, 1), false);
  equal(isRocLaneChoiceCell(choice, 2, 0), false);
});

test('R2 alone shows no lane pane; directional input reveals only its selected pane', () => {
  equal(resolveRocLaneChoiceHighlight(5, null), null);

  const up = resolveRocLaneChoiceHighlight(5, 0);
  equal(isRocLaneChoiceCell(up, 5, 0), true);
  equal(isRocLaneChoiceCell(up, 5, 2), false);

  const down = resolveRocLaneChoiceHighlight(5, 2);
  equal(isRocLaneChoiceCell(down, 5, 0), false);
  equal(isRocLaneChoiceCell(down, 5, 2), true);
});

test('an active press-position highlight stays fixed away from the precomputed apex', () => {
  const locked = resolveRocLaneChoiceHighlight(3, 0);
  equal(isRocLaneChoiceCell(locked, 3, 0), true);
  equal(isRocLaneChoiceCell(locked, 5, 0), false);
  equal(isRocLaneChoiceCell(locked, 3, 1), false);
});
